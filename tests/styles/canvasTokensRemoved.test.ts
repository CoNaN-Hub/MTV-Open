/**
 * MTV 第二套自有调色板 `canvas-*`（偏紫偏蓝的中性灰）**全仓移除**的源码级回归。
 *
 * ── 为什么单开一个文件，而不是扩 `brandColorRemoved` / `indigoColorRemoved` ──────────
 * 前两轮清的是**同一族色值的两种写法**：
 *   · round 94：`--brand` 令牌本身（`#6366f1`）；
 *   · round 95：Tailwind `indigo-*` 调色板类 + `#6366f1`/`#818cf8`/`#a5b4fc` 数值字面量。
 * 本轮清的是**另一套完全不同的色值**：`#14141c` / `#1a1a26` / `#2a2a3a` / `#252535` / `#8888a0` / `#7d7d91`
 * —— 它们的蓝通道普遍比红通道高 8~24 ⇒ 整块 UI 泛蓝紫。扫描面（`canvas-*` 令牌名）、
 * 豁免清单、允许的例外都与前两个文件不同，混在一起豁免会互相污染 ⇒ 单开本文件。
 *
 * ── 用户现场证据（本轮触发点）────────────────────────────────────────────────
 *   启动时加载屏（`src/components/shared/LazyLoadBoundary.tsx` 的 `variant="root"`）：
 *   纯黑底 + 一道 `rgb(136,136,160)`（= `--canvas-text-secondary` #8888a0）的转圈弧。
 *   用户原话：「之前给你说了全局 都不要 MTV 品牌色吗？**怎么还有？**」
 *
 * ── 官方证据（均为**实测**，不是推断）────────────────────────────────────────
 * ① 官方 `:root`（`D:\DEEPSEEK\_official-css\index-BroFpZiQ.css` @738536 起，逐字）里
 *    **没有任何偏紫的灰**，全是中性灰：`--background:#0f0f0f` `--foreground:#f5f5f5`
 *    `--card:#1f1f1f` `--secondary:#222` `--muted:#2b2b2b` `--muted-foreground:#7a7a7a`
 *    `--text-text-secondary:#9c9c9c` `--text-text-tertiary:#737373` `--accent:#404040`
 *    `--border:#ffffff1a` `--chat-background:#141414` `--chat-bubble-header:#1a1a1a`
 *    （`--background-canvas:#0a0a0a` 官方也有；**MTV 仓里没有这个令牌**，见下「未做到」）。
 * ② 官方 `index.html`（`D:\DEEPSEEK\TapNowExtract\web\resources\web\index.html` 逐字）
 *    在 `<head>` 内联 `html, body, #root { background: #000; … }` + `<div id="root"></div>`。
 * ③ ⚠️ **官方有根加载屏**（round 100 更正；本文件旧版本曾写「官方没有根级加载屏」，那个前提
 *    是基于**旧构建**得出的，已被推翻）。当前构建（哈希 `3ba264df7660179133784731923a0a6ab5d87cf0`）：
 *    `D:\DEEPSEEK\live-assets-r100\loading-overlay-DoLoNJJU.js`（1,325 字节，逐字见
 *    `src/components/shared/LazyLoadBoundary.tsx` 的注释）＝
 *    `fixed inset-0 z-50 … bg-black` + 一张 **200×200 动图 WebP**（`w-16 h-16 object-contain`，
 *    `scale:[.95,1.05,.95]` / `duration:2 / repeat:Infinity`）+ **唯一文案是 `sr-only`**。
 *    ⇒ 加载屏那道弧**不是**官方形态；官方根加载屏没有可见文字、也不是转圈。
 *    ⚠️ 旧构建的 `index-BDGj8rGN.js` @1023323 / @1137085 / @1001942 等偏移**已全部失效**，
 *       不得再作为依据引用（引用规范见仓库根 `AGENTS.md`）。
 *
 * ── 替换口径（按**角色**选官方令牌，不机械一一对应）──────────────────────────
 *   页面底 / 覆盖层底   → `background`(#0f0f0f)
 *   面 / 次级面         → `secondary`(#222) · `chat-background`(#141414) · `surface-secondary`(#1f1f1f)
 *   卡面 / 浮层         → `card`(#1f1f1f)
 *   hover / 选中底      → `accent`(#404040)
 *   **静态**底色位（图标井 / kbd / 内联 code / 进度轨道 / 次级按钮面）→ `muted`(#2b2b2b)
 *   描边                → `border`(#ffffff1a)
 *   正文 / 次级 / 弱化  → `foreground`(#f5f5f5) · `text-text-secondary`(#9c9c9c) · `text-text-tertiary`(#737373)
 *   焦点环              → `ring`(#7373731a)
 *   旋转器弧线          → `primary`(#1fa2dc)
 *   助手面板（`.c-scope`）→ `chat-foreground` · `chat-bubble-header` · `chat-background` · `bg-foreground/5`
 *
 * ⚠️ 本测试**不**覆盖、也**不**允许误伤（官方品牌资产 / 与本令牌族无关的 canvas 命名）：
 *   · `.brand-flame-button` / `.canvas-brand-nav` / `.brand-trigger` / `.brand-mark-window`
 *   · 厂商徽标机制 `--badge-hue`
 *   · 用户裁决保留的 `CANVAS_STATS_PALETTE` 与 `--canvas-stats-*`
 *   · `--canvas-edge` / `--canvas-node-presence-*` / `--canvas-note-opacity` / `--canvas-control-*`
 *   · **官方类名** `.canvas-text-markdown`（官方产物逐字，不是 MTV 令牌）
 *   · 背景预设名 `.canvas-bg-minimal` / `.canvas-bg-off-white` / `.canvas-bg-frosted-*`
 *   · 结构类名 / testid / 自定义事件名（`.canvas-nav-bar`、`data-canvas-container`、
 *     `'canvas-focus-node'`、`'canvas-viewport-change'`、`'canvas-session-project-ids'` 等）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const REPO = fileURLToPath(new URL('../../', import.meta.url));

const SCANNED_EXTENSIONS = ['.css', '.ts', '.tsx', '.js', '.jsx'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** 注释里的同名文本不算命中（本仓习惯在注释里原样引用「被删掉的东西」＋记录改前→改后映射）。 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    /* `//` 注释：保护 `https://` / `oklch(` 等里的冒号，只当行尾注释处理 */
    .replace(/(^|[^:])\/\/[^\n]*/gm, (_m, p1: string) => p1);
}

/**
 * 本令牌族（**词边界**，故意不匹配其它 canvas 命名）：
 *   `(?![a-zA-Z0-9-])` ⇒ 不会命中 `.canvas-text-markdown`（官方类名）、
 *   `.canvas-bg-minimal` / `.canvas-bg-frosted-preview`（背景预设）、`canvas-focus-node`（事件名）、
 *   `canvas-nav-bar` / `canvas-history-*`（结构类名）、`--canvas-edge` / `--canvas-stats-*`（别的变量）。
 */
const TOKEN_RE = /canvas-(bg|surface|card|border|hover|text-secondary|text-muted|text)(?![a-zA-Z0-9-])/;

const sourceFiles = walk(SRC).filter((f) => SCANNED_EXTENSIONS.some((ext) => f.endsWith(ext)));

function scanTokenFiles(): string[] {
  const hits: string[] = [];
  for (const file of sourceFiles) {
    if (TOKEN_RE.test(stripComments(readFileSync(file, 'utf8')))) {
      hits.push(relative(REPO, file).replace(/\\/g, '/'));
    }
  }
  return hits.sort();
}

/**
 * ★ 声明的例外（allow-list）—— 每一类都有明确理由，**不是**漏网。
 *
 * A. **非令牌字符串字面量（2 个文件，永久例外）**：`canvas-bg` 在这里是**配置值 / 上报来源键**，
 *    不是 Tailwind 颜色类，改它会改变运行时行为（背景预设 id 与埋点来源标签）。
 * B. **本轮禁改的在飞文件（2 个文件，另一个 agent 正在改）**：
 *    任务书明确「一个字都不许碰」⇒ 这里只把它们的残留**登记在案**，
 *    并在报告里逐行列出（见本轮报告「禁区文件里剩下的 `canvas-*` 清单」）。
 *    成员用「允许存在」而不是「必须存在」登记 ⇒ 那边落地后本测试不会误报。
 */
const NON_TOKEN_LITERAL_EXCEPTIONS = [
  'src/components/backgrounds/backgroundOptions.ts',
  'src/components/nodes/shared/image/composer/ComposerToolbar.tsx',
];
const IN_FLIGHT_FORBIDDEN_FILES = [
  'src/components/nodes/shared/NodeGenerationProgress.tsx',
  'src/components/nodes/shared/toolbar/NodePluginToolDialog.tsx',
];
const DECLARED_EXCEPTIONS = new Set([
  ...NON_TOKEN_LITERAL_EXCEPTIONS,
  ...IN_FLIGHT_FORBIDDEN_FILES,
]);

describe('MTV `canvas-*` 偏紫令牌族已按官方移除（2026 round 96）', () => {
  it('全仓 src/** 里 canvas-* 令牌残留只允许落在声明的例外文件里', () => {
    const hits = scanTokenFiles();
    const unexpected = hits.filter((f) => !DECLARED_EXCEPTIONS.has(f));
    expect(
      unexpected,
      `仍有文件带 canvas-* 令牌（不在声明的例外里）：\n${unexpected.join('\n')}`,
    ).toEqual([]);
    /* 两个「非令牌字面量」例外必须真的还在（有人在时不许当作已清理） */
    for (const file of NON_TOKEN_LITERAL_EXCEPTIONS) {
      expect(hits, `${file} 的 canvas-bg 字面量被误改/误删了`).toContain(file);
    }
  });

  it('tailwind.config.js 里不再有 canvas-* 色键（否则 .bg-canvas-card 会被重新生成）', () => {
    const config = stripComments(readFileSync(join(REPO, 'tailwind.config.js'), 'utf8'));
    expect(config).not.toMatch(/['"]canvas-[a-z-]+['"]\s*:/);
    expect(config).not.toMatch(/#(?:14141c|1a1a26|2a2a3a|252535|8888a0|7d7d91)\b/i);
    /* 官方替代键必须在位（缺键 ⇒ 官方类名惰性 = 等于没写） */
    expect(config).toMatch(/background:\s*'var\(--background\)'/);
    expect(config).toMatch(/card:\s*\{\s*DEFAULT:\s*'var\(--card\)'/);
    expect(config).toMatch(/secondary:\s*\{\s*DEFAULT:\s*'var\(--secondary\)'/);
    expect(config).toMatch(/muted:\s*\{\s*DEFAULT:\s*'var\(--muted\)',\s*foreground:\s*'var\(--muted-foreground\)'\s*\}/);
    expect(config).toMatch(/accent:\s*\{\s*DEFAULT:\s*'var\(--accent\)'/);
    expect(config).toMatch(/['"]text-text-secondary['"]:\s*'var\(--text-text-secondary\)'/);
    expect(config).toMatch(/['"]text-text-tertiary['"]:\s*'var\(--text-text-tertiary\)'/);
    expect(config).toMatch(/['"]chat-background['"]:\s*'var\(--chat-background\)'/);
    expect(config).toMatch(/['"]chat-bubble-header['"]:\s*'var\(--chat-bubble-header\)'/);
  });

  it('base.css 里 canvas-* 令牌类覆盖已删，且官方中性令牌逐字在位', () => {
    const base = stripComments(readFileSync(join(SRC, 'styles/base.css'), 'utf8'));
    expect(base).not.toMatch(TOKEN_RE);
    expect(base).not.toMatch(/#(?:14141c|1a1a26|2a2a3a|252535|8888a0|7d7d91)\b/i);
    /* 官方 `:root` 逐字 */
    expect(base).toMatch(/--background:\s*#0f0f0f;/);
    expect(base).toMatch(/--foreground:\s*#f5f5f5;/);
    expect(base).toMatch(/--card:\s*#1f1f1f;/);
    expect(base).toMatch(/--secondary:\s*#222;/);
    expect(base).toMatch(/--muted:\s*#2b2b2b;/);
    expect(base).toMatch(/--muted-foreground:\s*#7a7a7a;/);
    expect(base).toMatch(/--text-text-secondary:\s*#9c9c9c;/);
    expect(base).toMatch(/--text-text-tertiary:\s*#737373;/);
    expect(base).toMatch(/--accent:\s*#404040;/);
    expect(base).toMatch(/--border:\s*#ffffff1a;/);
    expect(base).toMatch(/--chat-background:\s*#141414;/);
    expect(base).toMatch(/--chat-bubble-header:\s*#1a1a1a;/);
  });

  it('原来那三段 canvas-* 字面色归一化层确实没了（使用点已直接写官方类）', () => {
    const chat = stripComments(readFileSync(join(SRC, 'styles/official-chat.css'), 'utf8'));
    const controls = stripComments(readFileSync(join(SRC, 'styles/official-controls.css'), 'utf8'));
    const panels = stripComments(readFileSync(join(SRC, 'styles/panels.css'), 'utf8'));
    expect(chat).not.toMatch(/\.c-scope \.[\w\\:/-]*canvas-/);
    expect(controls).not.toMatch(/\.settings-panel-dialog \.[\w\\:/-]*canvas-/);
    expect(panels).not.toMatch(/class~='[^']*canvas-/);
    /* 同段里**非 canvas** 的规则不许被误删 */
    expect(chat).toContain('.c-scope .bg-emerald-400\\/10,');
    expect(panels).toContain("[data-theme='light'] .agent-task-center [class~='text-violet-400']");
    /* 助手面板那几个组件现在直接写官方 chat 令牌 ⇒ 浅色覆盖必须在位 */
    expect(chat).toContain(".c-scope .text-chat-foreground");
  });

  it('LazyLoadBoundary 的 root 加载态 = 官方根加载屏逐字复刻（**当前构建**证据）', () => {
    const raw = readFileSync(join(SRC, 'components/shared/LazyLoadBoundary.tsx'), 'utf8');
    const code = stripComments(raw);
    expect(code).not.toMatch(TOKEN_RE);
    /* 用户现场那道 `#8888a0` 弧不许再出现在**代码/类名**里；
       注释里保留它作为「改前长什么样」的历史记录是允许的（下一条钉死） */
    expect(code).not.toMatch(/#8888a0/i);
    expect(raw).toContain('#8888a0');

    /* ① 官方根加载屏的逐字要素在位 */
    for (const needle of [
      'bg-black', // 官方写死 #000（不是 `--background` #0f0f0f）
      'common-loading-overlay', // 官方 `COMMON.LOADING.OVERLAY`
      'aria-label="Loading canvas"',
      'Loading canvas, please wait...', // 官方唯一文案 = sr-only
      'w-16 h-16 object-contain',
    ]) {
      expect(code, `LazyLoadBoundary 缺少官方逐字要素：${needle}`).toContain(needle);
    }

    /* ② 官方依据必须是**当前构建**（2026-10-14 更新后），且按 AGENTS.md 规范写明
          「dump 目录 + 文件名 + 偏移」——只写裸 `@偏移` 无法核对。 */
    for (const needle of [
      '3ba264df7660179133784731923a0a6ab5d87cf0', // 当前构建哈希
      'live-assets-r100', // 当前构建的 dump 目录
      'loading-overlay-DoLoNJJU.js', // 官方根加载屏本体
      '@643361', // vendor-packages-JNk8f0_N.js：LOADING.OVERLAY 字面值
      '@52315', // page-BFzZXoBV.js：AnimatePresence 包裹处（exit 会跑）
      '@49613', // 同文件：裸挂处（与 MTV 的挂载方式一致）
      '@1446520', // AnimatePresence 定义
      '@1522781', // framer-motion `motion` 导出
      '@8936031', // react/jsx-runtime 导出
    ]) {
      expect(raw, `LazyLoadBoundary 注释里缺少**当前构建**的官方依据：${needle}`).toContain(needle);
    }

    /* ③ 上一轮那批**旧构建**偏移必须被显式标注为失效，不许冒充现行依据
          （旧偏移 `@1023323` / `@1137085` / `@1001942` 只保留在「历史记录」块里） */
    expect(raw).toContain('已全部失效');
  });

  it('官方品牌资产 / --badge-hue / CANVAS_STATS_PALETTE / 结构类名未被误伤', () => {
    const flame = readFileSync(join(SRC, 'styles/brand-flame-button.css'), 'utf8');
    for (const sel of ['.brand-flame-button {', '.canvas-brand-nav {']) {
      expect(flame).toContain(sel);
    }
    const nav = readFileSync(join(SRC, 'styles/canvas-nav.css'), 'utf8');
    expect(nav).toContain('.canvas-nav-bar .brand-trigger {');
    expect(nav).toContain('.canvas-nav-bar .brand-mark-window {');

    const modelSelector = readFileSync(join(SRC, 'styles/model-selector.css'), 'utf8');
    expect(modelSelector).toContain('--badge-hue:');
    expect(modelSelector).toContain('.text-model-icon-badge[data-badge="OA"] { --badge-hue: #818cf8; }');

    const stats = readFileSync(join(SRC, 'utils/canvasStats.ts'), 'utf8');
    expect(stats).toContain('CANVAS_STATS_PALETTE');
    expect(stats).toContain('oklch(58.5% 0.233 277.1)');
    expect(stats).toContain('#6366f1');
    const statsCss = readFileSync(join(SRC, 'styles/canvas-stats.css'), 'utf8');
    expect(statsCss).toContain('--canvas-stats-fg:');

    /* 官方类名（`.canvas-text-markdown` 逐字来自官方产物）与背景预设名、其它 canvas 变量 */
    const nodesText = readFileSync(join(SRC, 'styles/nodes-text.css'), 'utf8');
    expect(nodesText).toContain('.canvas-text-markdown {');
    const backgrounds = readFileSync(join(SRC, 'styles/backgrounds.css'), 'utf8');
    expect(backgrounds).toContain('.canvas-bg-minimal {');
    expect(backgrounds).toContain('.canvas-bg-off-white {');
    expect(backgrounds).toContain('.canvas-bg-frosted-three {');
    const base = readFileSync(join(SRC, 'styles/base.css'), 'utf8');
    expect(base).toContain('--canvas-edge: rgba(255, 255, 255, 0.376);');
  });
});
