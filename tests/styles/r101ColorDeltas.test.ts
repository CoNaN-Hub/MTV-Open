/**
 * R101 · 4 处已知色差的落地回归（源码级钉住）
 *
 * ── 权威依据 ───────────────────────────────────────────────────────────────
 * `D:\DEEPSEEK\_r101-color-deltas.md`（只读取证报告，含逐字官方原文 + 偏移）。
 * 官方基准 dump：`D:\DEEPSEEK\live-assets-r100\`
 *   （构建哈希 `3ba264df7660179133784731923a0a6ab5d87cf0`，33 个资源 + `_manifest.json`）
 *
 * ⚠️ 官方 2026-10-14 更新过构建，**旧注释里的裸 `@偏移` 已大量失效**。本文件引用的每条
 *    官方证据都写全「哪份 dump 目录 + 哪个文件 + 偏移」，不写裸偏移。
 *    本仓其它注释里横跨多代的产物（桌面版 `TapNowExtract\web\resources\web\assets\`、
 *    上一版线上 `live-assets-new\`）与当前线上 `live-assets-r100\` **不是同一份**。
 *
 * ── 四条色差与官方逐字证据 ──────────────────────────────────────────────────
 *
 * 色差 1（文本层级）—— 官方设置面板里**根本不使用** `--text-text-secondary` /
 *   `--text-text-tertiary`，二/三级文本同色 `--muted-foreground`(#7a7a7a)、靠字号分档
 *   （`text-sm` 14px vs `text-xs leading-5` 12px）。
 *   · `live-assets-r100/index-BFQAZgBP.js` @1309969（官方「画布设置」页 `z3`）逐字：
 *     `t.jsx("h2",{className:"text-lg font-medium leading-7 text-foreground",…})` +
 *     `t.jsx("p",{className:"text-sm text-muted-foreground",…})` +
 *     `t.jsx("h3",{className:"text-sm font-medium text-foreground",…})` +
 *     `t.jsx("p",{className:"text-sm text-muted-foreground",…})`
 *   · `live-assets-r100/index-BFQAZgBP.js` @1130938（官方「权限」页 `bF`，MTV
 *     `McpControlSettings` 的对应物）逐字：`"font-semibold text-foreground text-xl"` +
 *     `"mt-1 text-muted-foreground text-sm"`
 *   · `live-assets-r100/index-BFQAZgBP.js` @1129557（设置项原语 `lo`）逐字：
 *     `"font-medium text-foreground text-sm tracking-tight"` +
 *     `"text-muted-foreground text-xs leading-5"`
 *   · **可证负结果（实测）**：官方设置面板（`z3`/`bF`/`lo`/`fF`/左栏）里 0 处
 *     `text-text-text-*`。`live-assets-r100/index-BFQAZgBP.js` 里那 4 处
 *     `text-text-text-primary`(@1482213/@1483710/@1607911/@1607948) 与 2 处
 *     `text-text-text-secondary`(@1228038 账单表格 / @1697871 社区 tooltip) **全部在设置面板之外**。
 *
 * 色差 2（面板内次级容器）—— 官方设置弹窗内「分组行容器」只有一种配方：
 *   · `live-assets-r100/index-BFQAZgBP.js` @1128506（容器串）/ @1130088（`function fF(`）逐字：
 *     `t.jsx("div",{className:C("overflow-hidden rounded-xl border border-border/80 bg-muted/30",a),…`
 *   · 编译产物 `live-assets-r100/index-DlJQu0XZ.css` @168223：
 *     `.bg-muted\/30{…color-mix(in oklab,var(--muted)30%,transparent)}`；`--muted:#2b2b2b`
 *   ⇒ 旧的 `bg-secondary`(#222) 不在官方设置弹窗的三个次级面配方（`!bg-background` /
 *     `bg-muted/50` / `bg-muted/30`）里。
 *
 * 色差 3（开关 off 态）—— 仓库**已有**官方等价组件 `OfficialSwitch`，换组件而不是手搓类串：
 *   · 官方 `Switch` 定义 `live-assets-r100/vendor-packages-JNk8f0_N.js` @453371 逐字：
 *     `"peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-xs
 *      transition-colors focus-visible:outline-hidden focus-visible:ring-ring
 *      focus-visible:ring-offset-2 focus-visible:ring-offset-background
 *      disabled:cursor-not-allowed disabled:opacity-50"` +
 *     `"data-[state=checked]:bg-primary"` +
 *     `"data-[state=unchecked]:bg-zinc-800 data-[state=unchecked]:shadow-inner"`
 *     thumb：`"pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0
 *             transition-transform data-[state=unchecked]:translate-x-0
 *             data-[state=checked]:translate-x-4"`
 *   · 官方编译产物 `live-assets-r100/index-DlJQu0XZ.css` @548708 /
 *     `.data-\[state\=unchecked\]\:bg-zinc-800[data-state=unchecked]{background-color:var(--color-zinc-800)}`
 *     @548809 `.data-\[state\=unchecked\]\:shadow-inner[data-state=unchecked]{--tw-shadow:inset 0 2px 4px 0 …}`
 *     `--color-zinc-800:oklch(27.4% .006 286.033)`（@21791）→ **#27272a**
 *   · 官方**设置面板**确实就用这个基础变体：`live-assets-r100/index-BFQAZgBP.js` @1130799（`fF` 内）逐字
 *     `t.jsx(Ms,{checked:n.checked,disabled:n.disabled,onCheckedChange:n.onCheckedChange,"aria-label":n.title,className:"mt-0.5 shrink-0"})`，
 *     其中 `Ms` = `vendor-packages-JNk8f0_N.js` 的导出 `S`（别名表 @6477 `… S as Ms, …`）。
 *
 * 色差 4（浅色面板底）—— 官方**没有浅色主题**（实测 CDP 只读：`document.documentElement.className`
 *   = `"dark fonts-loaded"`，`--bg-color` 读到 `.dark` 的 `#1a1b1c`），且官方 `--background` 在
 *   `:root` 与 `.dark` **同值** `#0f0f0f`（`live-assets-r100/index-DlJQu0XZ.css` @663816–@666716
 *   `:root` / @666717–@669583 `.dark`）⇒ `#F4F6FB` 是 MTV 自造值，按 MTV 自有浅色档回归
 *   （`base.css:404` `--theme-surface: #FFFFFF`）。
 *
 * ── 本文件同时钉住「报告判定「不改」的项没被误改」 ─────────────────────────────
 * 逐项理由见报告 §5.1 / §5.2 / §5.3 / §5.4 / §5.5 与末节「风险与拿不准」。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/** 注释里的同名文本不算命中（本仓习惯在注释里原样引用「官方逐字」与「改前长什么样」）。 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/gm, (_m, p1: string) => p1);
}

const CANVAS_SETTINGS = 'components/settings/CanvasSettings.tsx';
const MCP_SETTINGS = 'components/settings/McpControlSettings.tsx';
const HELP_CENTER = 'components/HelpCenterDialog.tsx';
const PROJECT_POPOVER = 'components/ProjectSettingsPopover.tsx';
const BASE_CSS = 'styles/base.css';
const OFFICIAL_CONTROLS_CSS = 'styles/official-controls.css';

/* ══ 色差 1：设置面板文本层级 ═══════════════════════════════════════════════ */
describe('R101 色差 1 · 设置面板二/三级文本统一到 --muted-foreground', () => {
  it('三个文件里不再有 text-text-text-secondary / text-text-text-tertiary', () => {
    for (const rel of [CANVAS_SETTINGS, MCP_SETTINGS, HELP_CENTER]) {
      const code = stripComments(read(rel));
      const residue = code.match(/text-text-text-(?:secondary|tertiary)\b/g) ?? [];
      expect(residue, `${rel} 残留 text-text-text-*：${residue.join(', ')}`).toEqual([]);
    }
  });

  it('CanvasSettings 的 5 个使用点（报告 1.1–1.5）逐字落到 text-muted-foreground', () => {
    const src = read(CANVAS_SETTINGS);
    /* 1.1 画布背景预设按钮（未选中态） */
    expect(src).toContain(": 'border-border bg-card text-muted-foreground hover:border-accent'");
    /* 1.2 自定义背景空占位 svg */
    expect(src).toContain('strokeWidth="1.5" className="text-muted-foreground"');
    /* 1.3 明暗检测状态文案 */
    expect(src).toContain('<span className="text-[11px] text-muted-foreground">');
    /* 1.4 透明度标签 */
    expect(src).toContain('<span className="shrink-0 text-[11px] text-muted-foreground">{t(\'透明度\')}</span>');
    /* 1.5 透明度百分比数字 */
    expect(src).toContain('<span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">');
  });

  it('McpControlSettings 的 1 个使用点（报告 1.6）随色差 2 同行落地', () => {
    /* 1.6 与 2.1 是同一行，断言在下面「色差 2」里逐字给出 */
    expect(stripComments(read(MCP_SETTINGS))).not.toMatch(/text-text-text-/);
  });

  it('HelpCenterDialog 的 4 个使用点（报告 1.7–1.10）逐字落到 text-muted-foreground', () => {
    const src = read(HELP_CENTER);
    /* 1.7 演示块标题 */
    expect(src).toContain('<span className="text-[11px] font-medium text-muted-foreground">操作演示</span>');
    /* 1.8 重播按钮 */
    expect(src).toContain('rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground');
    /* 1.9 分步标签 */
    expect(src).toContain('<span className="max-w-full truncate text-[10px] font-medium text-muted-foreground">{step.label}</span>');
    /* 1.10 演示说明 */
    expect(src).toContain('className="relative mt-3 text-pretty text-[11px] leading-5 text-muted-foreground"');
  });
});

/* ══ 色差 2：面板内次级容器 ═════════════════════════════════════════════════ */
describe('R101 色差 2 · 面板内次级容器改用官方 fF 配方', () => {
  it('McpControlSettings 非 Tauri 提示块 = 官方逐字容器串（报告 2.1）', () => {
    const src = read(MCP_SETTINGS);
    expect(src).toContain(
      '<div className="overflow-hidden rounded-xl border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">',
    );
    /* 旧的 bg-secondary 面不许回来 */
    expect(src).not.toContain('bg-secondary px-4 py-3');
  });

  it('官方 fF 容器配方本身没被改（官方逐字锚点）', () => {
    /* 该串是官方原文（index-BFQAZgBP.js @1128506），MTV 侧逐字照抄 ⇒ 作为常量锚点 */
    const officialRecipe = 'overflow-hidden rounded-xl border border-border/80 bg-muted/30';
    expect(read(MCP_SETTINGS)).toContain(officialRecipe);
  });
});

/* ══ 色差 3：开关 off 态 ═══════════════════════════════════════════════════ */
describe('R101 色差 3 · ProjectSettingsPopover 4 处手搓开关换成 OfficialSwitch', () => {
  it('4 处开关全部走官方组件，且不再有手搓 role="switch"', () => {
    const src = read(PROJECT_POPOVER);
    expect(src).toContain("import { OfficialSwitch } from './settings/official/OfficialControls';");
    const uses = src.match(/<OfficialSwitch\b/g) ?? [];
    expect(uses).toHaveLength(4);
    expect(src).not.toMatch(/role="switch"/);
    /* 手搓开关的 off 态轨道与 peer checkbox 形态都不许回来 */
    expect(src).not.toContain('peer sr-only');
    expect(src).not.toContain('peer-checked:bg-primary');
    expect(stripComments(src)).not.toMatch(/bg-border/);
  });

  it('官方组件用的 .o-switch 皮肤就是官方 Switch 逐字（off = zinc-800 + shadow-inner）', () => {
    const css = read(OFFICIAL_CONTROLS_CSS);
    /* `vendor-packages-JNk8f0_N.js` @453371：data-[state=unchecked]:bg-zinc-800 + shadow-inner */
    expect(css).toContain('background: #27272a; /* 官方 data-[state=unchecked]:bg-zinc-800 */');
    expect(css).toContain('box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);');
    /* on = bg-primary；thumb = 16px 白 + translateX(16px) */
    expect(css).toContain(".o-switch[aria-checked='true'] {");
    expect(css).toContain('background: var(--o-primary);');
    expect(css).toContain(".o-switch[aria-checked='true'] .o-switch__thumb {");
    expect(css).toContain('transform: translateX(16px);');
  });

  it('OfficialSwitch 组件本身仍是官方契约（role/aria-checked/off 内阴影靠 CSS）', () => {
    const src = read('components/settings/official/OfficialControls.tsx');
    expect(src).toContain('export function OfficialSwitch({');
    expect(src).toContain('role="switch"');
    expect(src).toContain('aria-checked={checked}');
    expect(src).toContain('className="o-switch"');
    expect(src).toContain('className="o-switch__thumb"');
  });
});

/* ══ 色差 4：浅色主题的面板底色 ═════════════════════════════════════════════ */
describe("R101 色差 4 · 浅色 [data-theme='light'] 的 bg-background 回归 MTV 自有浅色档", () => {
  it('.bg-background / .bg-background\\/60 两条浅色覆盖按报告 4.1 / 4.2 落地', () => {
    const css = read(BASE_CSS);
    expect(css).toContain("[data-theme='light'] .bg-background { background-color: var(--theme-surface); }");
    expect(css).toContain("[data-theme='light'] .bg-background\\/60 { background-color: rgb(255 255 255 / 0.6); }");
  });

  it('#F4F6FB 只剩 --theme-bg 一处（自造值不许再当面板底用）', () => {
    const css = read(BASE_CSS);
    const hits = css.match(/#F4F6FB/gi) ?? [];
    expect(hits).toHaveLength(1);
    expect(css).toContain('--theme-bg: #F4F6FB;');
  });

  it('--theme-surface 的浅色值就是 #FFFFFF（4.1 的 var() 指向它）', () => {
    const css = read(BASE_CSS);
    expect(css).toContain('--theme-surface: #FFFFFF;');
  });
});

/* ══ 报告判定「不改」的项：钉住，防止被顺手改掉 ═════════════════════════════ */
describe('报告判定「不改」的项未被误改', () => {
  it('--theme-bg / --theme-surface / --theme-border / --theme-hover / --theme-node-border 保持原值', () => {
    const css = read(BASE_CSS);
    /* 5.1 官方真机 html/body/#root = rgb(0,0,0)（CDP 只读实测）⇒ 窗口根层保持 #000000 */
    expect(css).toContain('--theme-bg: #000000;');
    /* 5.2 #18181b = 官方 zinc-900；改成 --surface-secondary(#1f1f1f) 会摧毁 surface/card 分层 */
    expect(css).toContain('--theme-surface: #18181b;');
    /* 5.3 暗色段有 19 处 background: var(--theme-border) + 14 处粗描边 + 3 处 TS 取值 ⇒ 实心底契约 */
    expect(css).toContain('--theme-border: #3f3f46;');
    /* 5.4 #2f2f2f = 官方最主流 hover:bg-white/10（110 处）叠在 #18181b 上的合成实心值 */
    expect(css).toContain('--theme-hover: #2f2f2f;');
    /* 5.5 rgba(255,255,255,0.1) 与官方 --border:#ffffff1a 同档（Δα≈0.5/255）⇒ 不改 */
    expect(css).toContain('--theme-node-border: rgba(255, 255, 255, 0.1);');
  });

  it('CanvasSettings.tsx:368 空占位缩略图仍是 bg-secondary（官方无对应物，报告「拿不准」⇒ 未动）', () => {
    expect(read(CANVAS_SETTINGS)).toContain("? (config.customBackgroundUrl ? '' : 'bg-secondary')");
  });

  it('CanvasSettings.tsx:455 是 8px 状态圆点、不是开关（行号误报）⇒ 未动', () => {
    expect(read(CANVAS_SETTINGS)).toContain(
      "bgDetection ? (bgDetection.isDark ? 'bg-primary' : 'bg-amber-400') : 'bg-border'",
    );
    /* 该文件里本来就没有开关；「色差 3」只落在 ProjectSettingsPopover */
    expect(stripComments(read(CANVAS_SETTINGS))).not.toMatch(/<OfficialSwitch\b/);
  });

  it('.o-btn--outline 按官方改为 `bg-input/30` / hover `bg-input/80`（round 102 落地）', () => {
    const css = read(OFFICIAL_CONTROLS_CSS);
    expect(css).toContain('.o-btn--outline {');
    /* 官方逐字：`index-DlJQu0XZ.css` @166059 / @466702
       —— `.bg-input\/30{background-color:color-mix(in oklab,var(--input)30%,transparent)}`
       —— `.hover\:bg-input\/80:hover{…color-mix(in oklab,var(--input)80%,transparent)}`
       退化写法 = 官方 `@supports` 之外那条 `var(--input)`。 */
    /* ⚠️ 必须**只在 `.o-btn--outline` 这一块内**断言 —— 该 CSS 文件别处也有合法的
       `background: transparent;`，全局 not.toContain 会误报。 */
    const block = css.slice(css.indexOf('.o-btn--outline {'), css.indexOf('.o-btn--outline:hover'));
    expect(block).toContain('background: color-mix(in oklab, var(--o-input) 30%, transparent);');
    expect(block).toContain('background: var(--o-input);' /* 官方的退化写法 */);
    expect(block).not.toContain('background: transparent;');
    const hover = css.slice(css.indexOf('.o-btn--outline:hover'));
    expect(hover.slice(0, hover.indexOf('}'))).toContain(
      'background: color-mix(in oklab, var(--o-input) 80%, transparent);',
    );
  });
});
