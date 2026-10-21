/**
 * R103 · 「官方无对应物的 MTV 自有颜色族」→ 官方令牌 的源码级回归。
 *
 * ── 权威依据 ───────────────────────────────────────────────────────────────
 * `D:\DEEPSEEK\_r98-token-mapping.md`（只读取证报告，894 行，逐族给了
 * 「用途 / MTV 逐条取值（含浅色）/ 官方对应令牌（文件名 + 偏移 + 逐字原文）」）。
 * 官方基准 dump：`D:\DEEPSEEK\_official-css\`（14 份官方 CSS，本文件引用的偏移全部在其中
 * `index-BroFpZiQ.css` / `vendor-pkg-canvas-DjxHVVpA.css`，已逐条复核过）。
 *
 * ── 用户定的口径（A 档）────────────────────────────────────────────────────
 *   · **暗色段**（`:root` / `.sidebar-floating` / `.canvas-stats-modal` …）→ 引用**官方令牌**；
 *   · **浅色段**（`[data-theme='light']` 内）→ **保留 MTV 字面值不动**。
 *   理由（报告 §0.1 实测）：**官方没有 `[data-theme='light']` 令牌层**
 *   （14 份官方 CSS 只有 `:root` 与 `.dark`，且两者里 shadcn 令牌值**相同**）
 *   ⇒ 浅色段跟着换成 `var(官方令牌)` 会取到官方暗色值，浅色主题直接反转。
 *
 * ── 本轮**没做**的事（别误判成漏网）────────────────────────────────────────
 *   · 族名（`--node-*` / `--glass-*` / `--rail-*` …）**保留**：它们就是上面那条
 *     「暗色引用官方 / 浅色保留字面值」的**分层载体**，删掉名字等于把浅色入口删掉。
 *     真正删掉的是它们原来的 **MTV 自有字面色值**。
 *   · `tailwind.config.js` 里对应色键**没有删**（任务书原文是「删除」）：`bg-node-image/15` /
 *     `text-node-image-light` / `border-danger/40` / `border-border-subtle` 等类名在
 *     `ProjectSettingsPopover.tsx` / `NodeRenderBoundary.tsx` 等处**真实在用**，
 *     删键 ⇒ 类名不再生成 ⇒ 样式静默消失。改为「键 → `var(--同名 CSS 令牌)`」，
 *     既去掉本文件里的 MTV 字面值，又让浅色马卡龙能生效（原来写死 hex 是既存缺陷）。
 *
 * ⚠️ 本测试**不**覆盖、也**不**允许误伤：
 *   · `CANVAS_STATS_PALETTE`（`src/utils/canvasStats.ts`，用户裁决逐字保留）
 *   · `--badge-hue` 机制与色值（`model-selector.css`，官方查不到）
 *   · `--theme-*` 全族（用户要保留的「浅色入口」）
 *   · 官方品牌资产 `.brand-flame-button` / `.canvas-brand-nav` / `.brand-trigger` / `.brand-mark-window`
 *   · 官方已有令牌（`--o-*` 与 shadcn 名）
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const REPO = fileURLToPath(new URL('../../', import.meta.url));

const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/** 注释里的同名文本不算命中（本仓习惯在注释里原样引用「改前长什么样」与官方逐字原文）。 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/gm, (_m, p1: string) => p1);
}

const BASE = stripComments(read('styles/base.css'));
/** base.css 的**暗色段**（`[data-theme='light']` 令牌块之前的部分）。 */
const BASE_DARK = BASE.slice(0, BASE.indexOf("[data-theme='light'] {"));
/** base.css 的**浅色令牌块**。 */
const LIGHT_START = BASE.indexOf("[data-theme='light'] {");
const BASE_LIGHT = BASE.slice(LIGHT_START, BASE.indexOf('\n}', LIGHT_START));

describe('R103 · 官方令牌层确实被引入（官方无同名族的落点）', () => {
  const OFFICIAL_VERBATIM: Array<[string, string]> = [
    /* `D:\DEEPSEEK\_official-css\index-BroFpZiQ.css` 逐字，偏移写在注释里 */
    ['--tap-state-success', '#4caf50'],       /* @738907 */
    ['--tap-state-warning', '#ff9800'],       /* @738937 */
    ['--tap-state-error', '#f44336'],         /* @738967 */
    ['--tap-state-info', '#2196f3'],          /* @738995 */
    ['--accent-accent-success', '#63d99a'],   /* @740438 */
    ['--color-zinc-700', 'oklch(37% 0.013 285.805)'],       /* @23404 */
    ['--color-zinc-800', 'oklch(27.4% 0.006 286.033)'],     /* @23447 */
    ['--color-zinc-900', 'oklch(21% 0.006 285.885)'],       /* @23492 */
    ['--color-neutral-50', 'oklch(98.5% 0 0)'],             /* @23580 */
    ['--color-neutral-400', 'oklch(70.8% 0 0)'],            /* @23731 */
    ['--color-neutral-500', 'oklch(55.6% 0 0)'],            /* @23770 */
    ['--color-neutral-800', 'oklch(26.9% 0 0)'],            /* @23887 */
    ['--color-green-400', 'oklch(79.2% 0.209 151.711)'],    /* @20801 */
    ['--color-green-500', 'oklch(72.3% 0.219 149.579)'],    /* @20847 */
    ['--color-emerald-400', 'oklch(76.5% 0.177 163.223)'],  /* @21081 */
    ['--color-emerald-500', 'oklch(69.6% 0.17 162.48)'],    /* @21129 */
    ['--color-cyan-400', 'oklch(78.9% 0.154 211.53)'],      /* @21267 */
    ['--color-cyan-500', 'oklch(71.5% 0.143 215.221)'],     /* @21311 */
    ['--color-blue-400', 'oklch(70.7% 0.165 254.624)'],     /* @21706 */
    ['--color-blue-500', 'oklch(62.3% 0.214 259.815)'],     /* @21751 */
    ['--color-orange-400', 'oklch(75% 0.183 55.934)'],      /* @20034 */
    ['--color-orange-500', 'oklch(70.5% 0.213 47.604)'],    /* @20078 */
    ['--color-purple-400', 'oklch(71.4% 0.203 305.504)'],   /* @22211 */
    ['--color-purple-500', 'oklch(62.7% 0.265 303.9)'],     /* @22258 */
    ['--color-amber-400', 'oklch(82.8% 0.189 84.429)'],     /* @20394 */
    ['--color-amber-500', 'oklch(76.9% 0.188 70.08)'],      /* @20439 */
    ['--color-rose-500', 'oklch(64.5% 0.246 16.439)'],      /* @22521 */
    ['--sidebar', '#1c1c1c'],                       /* @740691 */
    ['--sidebar-foreground', '#cfcece'],            /* @740711 */
    ['--sidebar-primary', '#fafafa'],               /* @740742 */
    ['--sidebar-primary-foreground', '#1c1c1c'],    /* @740770 */
    ['--sidebar-accent', '#262626'],                /* @740809 */
    ['--sidebar-accent-foreground', '#fafafa'],     /* @740836 */
    ['--sidebar-border', '#ffffff1a'],              /* @740874 */
    ['--sidebar-ring', '#fafafaa3'],                /* @740903 */
  ];

  it.each(OFFICIAL_VERBATIM)('%s 逐字在位（%s）', (name, value) => {
    expect(BASE_DARK).toContain(`${name}: ${value};`);
  });

  it('官方 shadcn / chat / 语义令牌本身的逐字值没被这轮改动碰掉', () => {
    for (const needle of [
      '--popover: #262626;',
      '--accent: #404040;',
      '--border: #ffffff1a;',
      '--card: #1f1f1f;',
      '--card-background: #1f1f1f;',
      '--muted: #2b2b2b;',
      '--muted-foreground: #7a7a7a;',
      '--secondary-foreground: #f0f0f0;',
      '--secondary-muted-foreground: #a3a3a3;',
      '--destructive: #934c4c;',
      '--destructive-foreground: #ff6163;',
      '--chat-background: #141414;',
      '--chat-bubble-header: #1a1a1a;',
      '--text-text-primary: #e6e6e6;',
    ]) {
      expect(BASE_DARK, `官方令牌 ${needle} 丢了`).toContain(needle);
    }
  });
});

describe('R103 · 暗色段的 MTV 自有色已落官方令牌', () => {
  it('`--node-*` 五族身份色全部引用官方 Tailwind 调色板令牌', () => {
    for (const line of [
      '--node-image: var(--color-green-500);',
      '--node-image-light: var(--color-green-400);',
      '--node-image-bg: color-mix(in oklab, var(--color-emerald-500) 15%, transparent);',
      '--node-image-text: var(--color-emerald-400);',
      '--node-video: var(--color-blue-500);',
      '--node-video-light: var(--color-blue-400);',
      '--node-audio: var(--color-orange-500);',
      '--node-audio-light: var(--color-orange-400);',
      '--node-panorama: var(--color-cyan-500);',
      '--node-panorama-light: var(--color-cyan-400);',
      '--node-markdown: var(--color-purple-500);',
      '--node-markdown-light: var(--color-purple-400);',
    ]) {
      expect(BASE_DARK).toContain(line);
    }
    /* 裸 hex 不许回来 */
    expect(BASE_DARK).not.toMatch(/--node-\w+:\s*#[0-9a-f]{6};/i);
  });

  it('语义状态色按角色落官方令牌（危险→destructive · 成功→accent-accent-success · 状态点→tap-state-*）', () => {
    expect(BASE_DARK).toContain('--danger: var(--destructive);');
    expect(BASE_DARK).toContain('--danger-light: var(--destructive-foreground);');
    expect(BASE_DARK).toContain('--danger-bg: color-mix(in oklab, var(--destructive) 15%, transparent);');
    expect(BASE_DARK).toContain('--success: var(--accent-accent-success);');
    expect(BASE_DARK).toContain('--success-light: var(--tap-state-success);');
    expect(BASE_DARK).toContain('--info: var(--tap-state-info);');
    expect(BASE_DARK).toContain('--warning: var(--tap-state-warning);');
    expect(BASE_DARK).toContain('--warning-light: var(--color-amber-500);');
    expect(BASE_DARK).toContain('--info-light: var(--color-blue-500);');
    expect(BASE_DARK).toContain('--accent-amber: var(--color-amber-500);');
    expect(BASE_DARK).toContain('--accent-amber-text: var(--color-amber-400);');
    /* 旧 MTV 裸 hex 不许回来 */
    expect(BASE_DARK).not.toMatch(/--(danger|success|info|warning|accent-amber)\w*:\s*#/i);
  });

  it('弹层 / 菜单 / 玻璃面 / 滚动条 / 边框 / 轨道色 全部引用官方令牌', () => {
    for (const line of [
      '--popover-bg: var(--popover);',
      '--popover-border: var(--border);',
      '--popover-item-hover: var(--accent);',
      '--menu-bg: var(--card);',
      '--menu-item-fg: var(--secondary-foreground);',
      '--menu-icon-bg: var(--muted);',
      '--menu-icon-fg: var(--secondary-muted-foreground);',
      '--menu-sep: var(--border);',
      '--glass-bg: var(--color-zinc-900);',
      '--glass-bg-light: var(--card);',
      '--glass-bg-node: var(--card-background);',
      '--glass-panel-bg: var(--color-zinc-900);',
      '--glass-ring-strong: var(--border);',
      '--floating-surface-bg: var(--color-zinc-900);',
      '--glass-bevel-border: linear-gradient(var(--color-zinc-700), var(--color-zinc-700));',
      '--separator-color: var(--border);',
      '--border-focus: var(--sidebar-ring);',
      '--scrollbar-thumb: var(--input);',
      '--scrollbar-thumb-active: var(--muted-foreground);',
      '--text-disabled: var(--secondary-accent);',
      '--track-color-1: var(--primary);',
      '--track-color-2: var(--color-green-500);',
      '--track-color-5: var(--color-rose-500);',
      '--track-color-6: var(--color-cyan-500);',
    ]) {
      expect(BASE_DARK).toContain(line);
    }
    /* 偏蓝紫的旧值不许回来 */
    for (const dead of ['#3a3a50', '#555570', '#6b6b88', '#444455', '#1f1f23', '#3a3a50']) {
      expect(BASE_DARK, `${dead} 是 MTV 品牌期偏蓝残留，不该回来`).not.toContain(dead);
    }
  });

  it('白色/黑色 alpha 族按官方刻度保留（数值本身就是官方刻度）', () => {
    /* 0.03/0.04/0.06/0.08/0.12 官方全表逐字有；0.10/0.15 与官方令牌重合 ⇒ 引用令牌 */
    expect(BASE_DARK).toContain('--white-alpha-08: rgba(255, 255, 255, 0.08);');
    expect(BASE_DARK).toContain('--white-alpha-10: var(--border);');
    expect(BASE_DARK).toContain('--white-alpha-15: var(--input);');
    expect(BASE_DARK).toContain('--black-alpha-60: rgba(0, 0, 0, 0.60);');
  });
});

describe("R103 · 浅色段（[data-theme='light']）逐字保留（用户口径 A 档）", () => {
  it('base.css 浅色令牌块仍是 MTV 字面值', () => {
    for (const line of [
      '--white-alpha-15: rgba(51, 54, 77, 0.14);',
      '--glass-bg: rgba(255, 255, 255, 0.95);',
      '--glass-panel-bg: rgba(252, 253, 255, 0.86);',
      '--menu-bg: #FFFFFF;',
      '--popover-bg: #FFFFFF;',
      '--node-image: #6ECBAA;',
      '--node-video: #7FBBF2;',
      '--danger: #E27C89;',
      '--success: #6ECBAA;',
      '--accent-amber: #EDBE63;',
      '--scrollbar-thumb: #CBD1E0;',
      '--border-focus: rgba(51, 54, 77, 0.55);',
      '--text-disabled: #A9AEC0;',
      '--separator-color: rgba(51, 54, 77, 0.12);',
    ]) {
      expect(BASE_LIGHT, `浅色段 ${line} 被换成了官方令牌（会造成浅色主题反转）`).toContain(line);
    }
  });

  it('--theme-* 全族未动（用户要保留的浅色入口）', () => {
    expect(BASE).toContain('--theme-bg: #000000;');
    expect(BASE).toContain('--theme-surface: #18181b;');
    expect(BASE).toContain('--theme-border: #3f3f46;');
    expect(BASE).toContain('--theme-hover: #2f2f2f;');
    expect(BASE).toContain('--theme-node-border: rgba(255, 255, 255, 0.1);');
    expect(BASE).toContain("--canvas-edge: rgba(255, 255, 255, 0.376);");
  });

  it('sidebar.css 的浅色竖条 / 节点面板仍是 MTV 字面值', () => {
    const sidebar = stripComments(read('styles/sidebar.css'));
    const idx = sidebar.indexOf("[data-theme='light'] .sidebar-floating {");
    expect(idx, '浅色竖条块不见了').toBeGreaterThan(0);
    const light = sidebar.slice(idx, sidebar.indexOf('\n}', idx));
    expect(light).toContain('--rail-bg: #ffffff;');
    expect(light).toContain('--rail-badge: #3b82f6;');
    expect(light).toContain('--node-picker-bg: #ffffff;');
  });
});

describe('R103 · 其余定义点', () => {
  it('sidebar.css 暗色竖条 = 官方 `--sidebar*`（报告 §4 最干净的一族，逐条值相同）', () => {
    const sidebar = stripComments(read('styles/sidebar.css'));
    const dark = sidebar.slice(0, sidebar.indexOf("[data-theme='light'] .sidebar-floating {"));
    for (const line of [
      '--rail-bg: var(--sidebar);',
      '--rail-border: var(--sidebar-border);',
      '--rail-avatar-bg: var(--muted);',
      '--rail-icon: var(--sidebar-foreground);',
      '--rail-icon-hover: var(--sidebar-primary);',
      '--rail-hover-bg: var(--sidebar-accent);',
      '--rail-primary-bg: var(--foreground);',
      '--rail-primary-fg: var(--background);',
      '--rail-badge: var(--accent-primary);',
      '--node-picker-bg: var(--sidebar);',
      '--node-picker-border: var(--border);',
      '--node-picker-muted: var(--muted-foreground);',
      '--node-picker-title: var(--popover-foreground);',
    ]) {
      expect(dark).toContain(line);
    }
    /* 官方 `--rail-max` / `--rail-screen-gutter`（横向 chip 条的**宽度**）不是颜色，别误接 */
    expect(dark).not.toContain('--rail-max');
  });

  it('canvas-stats.css 暗色 = 官方 neutral / zinc 刻度（`--canvas-stats-*` 名字保留）', () => {
    const cs = stripComments(read('styles/canvas-stats.css'));
    expect(cs).toContain('--canvas-stats-fg: var(--color-neutral-50);');
    expect(cs).toContain('--canvas-stats-muted: var(--color-neutral-400);');
    expect(cs).toContain('--canvas-stats-donut-gap: var(--color-zinc-900);');
    expect(cs).toContain('--canvas-stats-hole: var(--color-neutral-800);');
    expect(cs).not.toContain('#27272a');
    expect(cs).not.toContain('oklab(24.354%');
  });

  it('official-chat.css 的 `--c-*` 副本层改为引用官方 chat 令牌（名字保留 ⇒ 浅色覆写仍生效）', () => {
    const chat = stripComments(read('styles/official-chat.css'));
    for (const line of [
      '--c-chat-bg: var(--chat-background);',
      '--c-bubble: var(--chat-bubble-header);',
      '--c-bubble-surface: var(--chat-bubble-surface);',
      '--c-chat-fg: var(--chat-foreground);',
      '--c-text-1: var(--text-text-primary);',
      '--c-text-2: var(--text-text-secondary);',
      '--c-muted: var(--muted-foreground);',
      '--c-border: var(--border);',
    ]) {
      expect(chat).toContain(line);
    }
    /* 浅色覆写还在（用的是 `--theme-*`，不是官方暗色令牌） */
    expect(chat).toContain('--c-chat-bg: var(--theme-surface, #ffffff);');
  });

  it('nodes-text.css 的 `--quote-*` 去掉 fallback（官方原文没有 fallback）', () => {
    const nt = stripComments(read('styles/nodes-text.css'));
    /* ⚠️ 只在 `blockquote` 那一块里断言：本文件别处还有一批**与 `--quote-*` 无关**的
       通用 markdown fallback（`var(--muted-foreground, #7a7a7a)` 等），不在本轮族清单里。 */
    const start = nt.indexOf('.canvas-text-markdown blockquote {');
    expect(start, 'blockquote 规则不见了').toBeGreaterThan(0);
    const block = nt.slice(start, nt.indexOf('\n}', start));
    expect(block).toContain('--quote-text: color-mix(in srgb, var(--muted-foreground) 84%, transparent);');
    expect(block).toContain('--quote-strong: color-mix(in srgb, var(--foreground) 85%, transparent);');
    expect(block).not.toContain(', #7a7a7a)');
    expect(block).not.toContain(', #f5f5f5)');
    expect(nt).not.toContain('var(--border, rgba(255, 255, 255, 0.06)); background: var(--quote-code-bg)');
  });

  it('image-compare.css 的 MTV 品牌期靛蓝 fallback `#2231dd` 已清', () => {
    /* 注释里保留它作为「改前长什么样」的历史记录是允许的 ⇒ 只扫代码 */
    const cmp = stripComments(read('styles/image-compare.css'));
    expect(cmp).not.toContain('#2231dd');
    expect(cmp).toContain('var(--signal, var(--foreground))');
  });

  it('video-editor-shell.css 的偏蓝 fallback 已换官方 `--card`', () => {
    const ve = stripComments(read('styles/video-editor-shell.css'));
    expect(ve).not.toContain('#14141c');
    expect(ve).not.toContain('#1a1a26');
    expect(ve).toContain('--video-editor-panel: var(--theme-surface, var(--card));');
    expect(ve).toContain('--video-editor-card: var(--theme-card, var(--card));');
  });

  it('image-lossless-float.css 的 `--ilf-surface` = 官方 `--sidebar`（#1c1c1c 逐字同值）', () => {
    expect(read('styles/image-lossless-float.css')).toContain('--ilf-surface: var(--sidebar);');
  });

  it('panorama-viewer.css 的 `--xiaoluo-compact-danger` 落官方前景档', () => {
    const pv = stripComments(read('styles/panorama-viewer.css'));
    expect(pv).toContain('--xiaoluo-compact-danger: var(--destructive-foreground);');
    expect(pv).toContain('--xiaoluo-compact-brand: var(--primary);');
  });
});

describe('R103 · tailwind.config.js 里不再有 MTV 自有颜色的字面值', () => {
  const tw = stripComments(readFileSync(join(REPO, 'tailwind.config.js'), 'utf8'));

  it('node / semantic / scrollbar 色键改为引用同名 CSS 令牌', () => {
    for (const line of [
      "'node-image': 'var(--node-image)',",
      "'node-image-light': 'var(--node-image-light)',",
      "'node-video': 'var(--node-video)',",
      "'node-audio': 'var(--node-audio)',",
      "'node-panorama': 'var(--node-panorama)',",
      "'danger': 'var(--danger)',",
      "'danger-light': 'var(--danger-light)',",
      "'success': 'var(--success)',",
      "'warning': 'var(--warning)',",
      "'info': 'var(--info)',",
      "'border-subtle': 'var(--border-subtle)',",
      "'scrollbar-thumb': 'var(--scrollbar-thumb)',",
      "'scrollbar-thumb-hover': 'var(--scrollbar-thumb-hover)',",
    ]) {
      expect(tw).toContain(line);
    }
  });

  it('那些 MTV 裸 hex 已经不在 config 里', () => {
    for (const dead of ['#22c55e', '#4ade80', '#34d399', '#3b82f6', '#60a5fa', '#f97316', '#fb923c',
      '#06b6d4', '#22d3ee', '#ef4444', '#f87171', '#fca5a5', '#f59e0b', '#3a3a50', '#555570', '#3a3a4a']) {
      expect(tw, `tailwind.config.js 里仍留着 MTV 裸 hex ${dead}`).not.toContain(dead);
    }
  });
});
