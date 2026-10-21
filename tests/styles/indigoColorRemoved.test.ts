/**
 * MTV 品牌靛蓝（Tailwind `indigo-*` 一族 = 已删的 `--brand` 同色值）**全仓移除**的源码级回归。
 *
 * ── 为什么单开一个文件，而不是扩 `brandColorRemoved.test.ts` ──────────────────
 * `brandColorRemoved.test.ts` 钉的是「`--brand` 令牌本身」（`var(--brand` / `--brand-x:` 定义），
 * 本轮钉的是「**同色值的 Tailwind 调色板类与数值字面量**」——两层定义完全不同：
 *   · 令牌层：`--brand` = `#6366f1`，round 94 已 0 残留；
 *   · 调色板层：Tailwind v3 的 `indigo-500` = `#6366f1`、`indigo-400` = `#818cf8`、
 *     `indigo-300` = `#a5b4fc` —— 值一模一样，只是换个名字活下来。
 * 两层的扫描面（令牌名 vs 类名/字面量）与豁免清单也不同，混在一个文件里豁免会互相污染。
 * ⇒ 单开 `indigoColorRemoved.test.ts`，两个文件各自独立、失败时指向明确。
 *
 * ── 用户本轮裁决（原文）────────────────────────────────────────────────────
 *   「**画布统计色板保留 其他 全部移除**」
 * ⇒ 全仓唯一「逐字不许动」的靛蓝是 `src/utils/canvasStats.ts` 的 `CANVAS_STATS_PALETTE`。
 *
 * ── 替换口径（官方证据）──────────────────────────────────────────────────
 * 官方 Tailwind **v4** 里也有 `indigo-*`，但那是**另一组值**（`index-BroFpZiQ.css` 逐字）：
 *   `--color-indigo-300: oklch(78.5% .115 274.713)` / `--color-indigo-400: oklch(67.3% .182 276.935)`
 *   / `--color-indigo-500: oklch(58.5% .233 277.117)`  ⇒ `rgba(98,95,255,…)` / `rgba(164,179,255,…)`
 * 与 MTV v3 的 `#6366f1` / `#818cf8` / `#a5b4fc` **不是同一个颜色**。
 * ⇒ 在 MTV 这个 v3 构建里「继续用 `indigo-*` 类名」等于把刚删掉的品牌色原样放回来，
 *    所以一律改官方 `:root` 令牌（`base.css` 逐字 + `vendor-pkg-canvas` 打包 CSS 实测）：
 *      实心填充/选中面/开关 on → `--primary`(#1fa2dc)
 *      浅强调文字               → `--accent-primary`(#90c4e5)
 *      淡化底/描边              → 官方中性白刻度（`bg-white/10` = `--border` 档 · `border-white/25` …）
 *      焦点环                   → `focus-visible:ring-white/80`（官方 Pin 芯片类名逐字）
 *      阴影                     → 官方中性 `shadow-black/50`
 *
 * ⚠️ 本测试**不**覆盖、也**不**允许误伤：
 *   · 官方品牌资产 `.brand-flame-button` / `.canvas-brand-nav` / `.brand-trigger` / `.brand-mark-window`
 *   · 厂商徽标机制 `--badge-hue`（含其色值，理由见下）
 *   · `CANVAS_STATS_PALETTE`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const REPO = fileURLToPath(new URL('../../', import.meta.url));

const SCANNED_EXTENSIONS = ['.css', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** 注释里的同名文本不算命中（本仓习惯在注释里原样引用「被删掉的东西」）。 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    /* `//` 注释：保护 `https://` / `oklch(` 等里的冒号，只当行尾注释处理 */
    .replace(/(^|[^:])\/\/[^\n]*/gm, (_m, p1: string) => p1);
}

const sourceFiles = walk(SRC).filter((f) => SCANNED_EXTENSIONS.some((ext) => f.endsWith(ext)));

/** Tailwind 类名里的靛蓝 token（含变体前缀：`hover:` / `focus-visible:` / `peer-checked:` / `border-t-` …）。 */
const CLASS_RE = /[-a-zA-Z0-9_:[\]/.%,]+indigo-[0-9]+(?:\/[0-9]+)?/g;
/** 数值字面量：MTV 靛蓝那一组 hex / rgb / oklch 色相。 */
const LITERAL_RE =
  /#(?:6366f1|818cf8|a5b4fc|4f46e5|4338ca|3730a3|c7d2fe|e0e7ff|eef2ff)\b|rgba?\(\s*(?:99\s*[, ]\s*102\s*[, ]\s*241|129\s*[, ]\s*140\s*[, ]\s*248|165\s*[, ]\s*180\s*[, ]\s*252|79\s*[, ]\s*70\s*[, ]\s*229)|oklch\([^)]*277[^)]*\)/gi;

function scan(re: RegExp): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles) {
    re.lastIndex = 0;
    const body = stripComments(readFileSync(file, 'utf8'));
    if (re.test(body)) hits.push(relative(REPO, file).replace(/\\/g, '/'));
  }
  return hits.sort();
}

/**
 * ★ 声明的残留（allow-list）—— 每一类都有明确理由，**不是**漏网。
 *
 * 1) **`indigo-*` Tailwind 类：声明残留 = 0 个文件。**
 *    本轮把最后 4 个 `src/components/nodes/**` 组件也迁走了（`PluginNode` /
 *    `ConnectedNodesPreview` / `StyleSelector` / `NodePluginToolDialog`），
 *    并且把全仓注释里残留的 `indigo-` 字面量也改成「`indigo` 色族」的写法
 *    ⇒ `src/**` 的**原始文本**（连注释算上）里 `indigo-` 也是 0 命中。
 * 2) **`indigo-*` 数值字面量：只剩 2 个文件**，两个都有裁决/证据支撑：
 *    · `src/utils/canvasStats.ts` —— 用户裁决「画布统计色板保留」（`CANVAS_STATS_PALETTE` 逐字保留）；
 *    · `src/styles/model-selector.css` 的 `--badge-hue` —— 厂商徽标色相（见 3）。
 * 3) `--badge-hue`：官方全部 6 份 CSS dump + 11 份 JS 产物搜
 *    `badge-hue` / `badgeHue` / `--badge` / `vendor` / `provider` / `model-icon`
 *    **全部 0 命中** ⇒ 官方**没有**「厂商 → 色相」表，官方模型徽标走图片 logo（不是色相）。
 *    按任务裁决「查不到 ⇒ 原样保留」⇒ 这里钉**机制仍在 + 色值逐字未变**。
 */
const DECLARED_CLASS_RESIDUAL_FILES: string[] = [];

const DECLARED_LITERAL_RESIDUAL_FILES = ['src/styles/model-selector.css', 'src/utils/canvasStats.ts'];

/** 原始文本（**不剥注释**）里 `indigo-` 字面量的声明残留 —— 本仓已做到 0。 */
const DECLARED_RAW_INDIGO_RESIDUAL_FILES: string[] = [];

/** `CANVAS_STATS_PALETTE` 逐字节原文（用户裁决：一个字符都不许动）。 */
const CANVAS_STATS_PALETTE_VERBATIM = `export const CANVAS_STATS_PALETTE: readonly CanvasStatsColor[] = [
  { fill: 'oklch(62.3% 0.214 259.8)', text: 'oklch(54.6% 0.245 262.9)', textDark: '#60a5fa', hex: '#3b82f6' },
  { fill: 'oklch(62.7% 0.265 303.9)', text: 'oklch(55.8% 0.288 302.3)', textDark: '#c084fc', hex: '#a855f7' },
  { fill: 'oklch(65.6% 0.241 354.3)', text: 'oklch(59.2% 0.249 0.584)', textDark: '#f472b6', hex: '#ec4899' },
  { fill: 'oklch(70.5% 0.213 47.6)', text: 'oklch(64.6% 0.222 41.1)', textDark: '#fb923c', hex: '#f97316' },
  { fill: 'oklch(69.6% 0.17 162.5)', text: 'oklch(59.6% 0.145 163.2)', textDark: '#34d399', hex: '#10b981' },
  { fill: 'oklch(71.5% 0.143 215.2)', text: 'oklch(60.9% 0.126 221.7)', textDark: '#22d3ee', hex: '#06b6d4' },
  { fill: 'oklch(64.5% 0.246 16.4)', text: 'oklch(58.6% 0.253 17.6)', textDark: '#fb7185', hex: '#f43f5e' },
  { fill: 'oklch(76.9% 0.188 70.1)', text: 'oklch(66.6% 0.179 58.3)', textDark: '#fbbf24', hex: '#f59e0b' },
  { fill: 'oklch(58.5% 0.233 277.1)', text: 'oklch(51.1% 0.262 277)', textDark: '#818cf8', hex: '#6366f1' },
  { fill: 'oklch(76.8% 0.233 130.9)', text: 'oklch(64.8% 0.2 131.7)', textDark: '#a3e635', hex: '#84cc16' },
];`;

describe('MTV 品牌靛蓝（indigo-*）已按官方移除', () => {
  it('全仓 src/** 里 indigo-* Tailwind 类命中的文件数 == 声明的残留数（0）', () => {
    const hits = scan(CLASS_RE);
    expect(hits, `仍有文件带 indigo-* 工具类：\n${hits.join('\n')}`).toEqual(
      DECLARED_CLASS_RESIDUAL_FILES,
    );
    expect(hits).toHaveLength(DECLARED_CLASS_RESIDUAL_FILES.length);
  });

  it('全仓 src/** 原始文本（**含注释**）里 `indigo-` 字面量命中的文件数 == 声明残留数（0）', () => {
    const hits: string[] = [];
    for (const file of sourceFiles) {
      if (readFileSync(file, 'utf8').includes('indigo-')) {
        hits.push(relative(REPO, file).replace(/\\/g, '/'));
      }
    }
    expect(hits.sort(), `注释里仍留着 indigo- 字面量：\n${hits.join('\n')}`).toEqual(
      DECLARED_RAW_INDIGO_RESIDUAL_FILES,
    );
  });

  it('数值字面量（#6366f1 / #818cf8 / #a5b4fc / rgba(99,102,241 / rgba(129,140,248 / oklch(…277…)）命中文件数 == 声明残留数 2', () => {
    const hits = scan(LITERAL_RE);
    expect(hits, `靛蓝字面量残留：\n${hits.join('\n')}`).toEqual(DECLARED_LITERAL_RESIDUAL_FILES);
    expect(hits).toHaveLength(DECLARED_LITERAL_RESIDUAL_FILES.length);
  });

  it('★ 用户裁决的唯一例外：CANVAS_STATS_PALETTE 逐字未变', () => {
    const text = readFileSync(join(SRC, 'utils/canvasStats.ts'), 'utf8');
    expect(text).toContain(CANVAS_STATS_PALETTE_VERBATIM);
    /* 任务点名的两个字符串，单独再钉一次 */
    expect(text).toContain('oklch(58.5% 0.233 277.1)');
    expect(text).toContain('#6366f1');
    expect(text).toContain('#818cf8');
    /* 不多不少：整份文件里 `#6366f1` 只出现这一次 */
    expect((text.match(/#6366f1/g) ?? []).length).toBe(1);
  });

  it('tailwind.config.js 里不再有 indigo 色键（否则 .bg-indigo-500 会被重新生成）', () => {
    const config = stripComments(readFileSync(join(REPO, 'tailwind.config.js'), 'utf8'));
    expect(config).not.toMatch(/['"]indigo['"]\s*:/);
    expect(config).not.toMatch(/--tw-indigo/);
    /* 官方替代键必须在位 */
    expect(config).toMatch(/primary:\s*\{\s*DEFAULT:\s*'var\(--primary\)'/);
    expect(config).toMatch(/['"]accent-primary['"]:\s*'var\(--accent-primary\)'/);
  });

  it('base.css 里 --tw-indigo-*（暗色 + 浅色两份）已全部删除，且官方令牌逐字在位', () => {
    const base = stripComments(readFileSync(join(SRC, 'styles/base.css'), 'utf8'));
    expect(base).not.toMatch(/--tw-indigo-[\w-]*\s*:/);
    /* 官方 `:root` 逐字（vendor-pkg-canvas 打包 CSS 的 `:root` 段） */
    expect(base).toMatch(/--primary:\s*#1fa2dc;/);
    expect(base).toMatch(/--primary-foreground:\s*#fafafa;/);
    expect(base).toMatch(/--accent-primary:\s*#90c4e5;/);
    expect(base).toMatch(/--border:\s*#ffffff1a;/);
    expect(base).toMatch(/--input:\s*#ffffff26;/);
    expect(base).toMatch(/--ring:\s*#7373731a;/);
  });

  it('同一轮删掉的三个「靛蓝重映射段」确实没了（使用点已改成官方类）', () => {
    const chat = stripComments(readFileSync(join(SRC, 'styles/official-chat.css'), 'utf8'));
    const controls = stripComments(readFileSync(join(SRC, 'styles/official-controls.css'), 'utf8'));
    const panels = stripComments(readFileSync(join(SRC, 'styles/panels.css'), 'utf8'));

    expect(chat).not.toMatch(/\.c-scope \.[\w\\:-]*indigo/);
    expect(controls).not.toMatch(/\.settings-panel-dialog \.[\w\\:-]*indigo/);
    expect(panels).not.toMatch(/text-indigo-300|text-indigo-400/);

    /* 同段里**非靛蓝**的归一化规则：`canvas-*` 那批已随 2026 round 96 整体移除（见
       `tests/styles/canvasTokensRemoved.test.ts`），所以这里改成钉「规则确实没了」；
       剩下的官方语义色重映射规则不许被误删。 */
    expect(controls).not.toMatch(/\.settings-panel-dialog \.[\w\\:-]*canvas-/);
    expect(chat).toContain('.c-scope .bg-emerald-400\\/10,');
    expect(panels).toContain("[data-theme='light'] .agent-task-center [class~='text-violet-400']");
  });

  it('节点类型身份色 / 分组色板改用官方令牌，`--node-text` 一族不再是靛蓝', () => {
    const types = readFileSync(join(SRC, 'types/index.ts'), 'utf8');
    expect(types).toContain("'ai-text':     { icon: 'mdi:text-box-outline',         color: 'text-accent-primary', bg: 'bg-primary/15',");
    expect(types).toContain("'plugin-node':   { icon: 'mdi:puzzle-outline',          color: 'text-accent-primary', bg: 'bg-primary/15',");
    expect(types).toMatch(/GROUP_COLOR_PALETTE = \[\s*'#1fa2dc',/);

    const base = stripComments(readFileSync(join(SRC, 'styles/base.css'), 'utf8'));
    /* 暗色 + 浅色两份 --node-text 都落官方 primary / accent-primary */
    expect(base.match(/--node-text:\s*var\(--primary\);/g) ?? []).toHaveLength(2);
    expect(base).toContain('--node-text-light: var(--accent-primary);');
    expect(base).toContain('--node-text-bg: rgba(31, 162, 220, 0.15);');
    expect(base).not.toMatch(/--node-text[-\w]*:\s*(#6366f1|#818cf8|#7280E4|#5A69D4)/);

    const tw = readFileSync(join(REPO, 'tailwind.config.js'), 'utf8');
    /* ★ round 103：色键不再硬编码官方 hex，改为引用 `base.css` 同名 CSS 令牌
      （`--node-text` 的暗色值就是官方 `--primary`，`--node-text-light` 就是官方 `--accent-primary`）
      ⇒ 契约不变（仍然不是靛蓝），而且浅色马卡龙也能跟着生效。 */
    expect(tw).toContain("'node-text': 'var(--node-text)',");
    expect(tw).toContain("'node-text-light': 'var(--node-text-light)',");
    expect(base).toMatch(/--node-text:\s*var\(--primary\);/);
  });

  it('官方品牌资产与 --badge-hue 机制未受影响（不许误伤）', () => {
    const flame = readFileSync(join(SRC, 'styles/brand-flame-button.css'), 'utf8');
    for (const sel of ['.brand-flame-button {', '.canvas-brand-nav {', '.brand-flame-button__image {']) {
      expect(flame).toContain(sel);
    }
    const nav = readFileSync(join(SRC, 'styles/canvas-nav.css'), 'utf8');
    expect(nav).toContain('.canvas-nav-bar .brand-trigger {');
    expect(nav).toContain('.canvas-nav-bar .brand-mark-window {');

    /* `--badge-hue` = 厂商徽标各带自己的品牌色（官方模型徽标机制），必须保留。
       官方没有「厂商 → 色相」表（CSS/JS 全部 0 命中）⇒ 色值原样保留，只钉机制。 */
    const modelSelector = readFileSync(join(SRC, 'styles/model-selector.css'), 'utf8');
    expect(modelSelector).toContain('--badge-hue:');
    expect(modelSelector).toContain('background: color-mix(in srgb, var(--badge-hue) 18%, transparent);');
    expect(modelSelector).toContain('color: color-mix(in srgb, var(--badge-hue) 62%, var(--theme-text));');

    /* ★ 官方无「厂商 → 色相」表 ⇒ 色值原样保留，逐字钉死（改这里等于自造官方没有的色相）。 */
    for (const line of [
      '.text-model-icon-badge[data-badge="OA"] { --badge-hue: #818cf8; }',
      '.text-model-icon-mini[data-badge="OA"]  { --badge-hue: #818cf8; }',
      '.text-model-icon-mini[data-badge="SD"]  { --badge-hue: #818cf8; }',
      '.text-model-icon-mini[data-badge="RW"]  { --badge-hue: #a5b4fc; }',
    ]) {
      expect(modelSelector, `--badge-hue 色值被改动：${line}`).toContain(line);
    }
  });

  it('本轮迁移的 4 个节点组件改用官方令牌类，且不再有 indigo 残留', () => {
    const expectations: Array<[string, string[]]> = [
      [
        'src/components/nodes/PluginNode.tsx',
        [
          "selected ? 'border-primary' : 'border-border'",
          'rounded-lg bg-primary/15 text-accent-primary',
          'bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-primary/90',
          'outline-none focus:border-primary/60',
          'className="ml-2 align-middle accent-primary"',
        ],
      ],
      [
        'src/components/nodes/shared/StyleSelector.tsx',
        [
          'transition-colors hover:border-border-secondary focus:border-primary',
          'className="h-3.5 w-3.5 shrink-0 text-accent-primary"',
        ],
      ],
      [
        'src/components/nodes/shared/ConnectedNodesPreview.tsx',
        [
          'rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-lg',
          'hover:bg-primary/90 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
        ],
      ],
      [
        'src/components/nodes/shared/toolbar/NodePluginToolDialog.tsx',
        [
          /* ⚠️ 这里**只钉靛蓝相关**的部分（`focus:border-primary` / `ring-primary`）。
             前面原本还带一个 `placeholder:text-canvas-text-muted` 的 `canvas-*` 断言，
             2026 round 96 已删 —— 那是另一个令牌族的东西，钉在这里会让两轮清理互相耦合
             （`NodePluginToolDialog` 由并行的 round-96 批次改完后，这条会误报）。
             canvas-* 的回归在 `tests/styles/canvasTokensRemoved.test.ts`。 */
          'focus:border-primary/60 focus:ring-2 focus:ring-primary/15',
          'justify-center rounded-lg bg-primary/10 text-accent-primary',
          'className="mt-0.5 h-3.5 w-3.5 accent-primary"',
          'rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90',
        ],
      ],
    ];
    for (const [file, needles] of expectations) {
      const text = readFileSync(join(REPO, file), 'utf8');
      for (const needle of needles) {
        expect(text, `${file} 缺少官方类替换：${needle}`).toContain(needle);
      }
      expect(text, `${file} 仍有 indigo- 残留`).not.toContain('indigo-');
    }

    /* 焦点环口径：官方 `focus-visible:ring-white/80`（`base.css` 记录官方原文）。 */
    const base = readFileSync(join(SRC, 'styles/base.css'), 'utf8');
    expect(base).toContain('focus-visible:ring-white/80');
  });
});
