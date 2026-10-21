/**
 * 弹层（菜单 / 下拉 / Popover）配方契约 —— 必须是**官方 dropdown 配方**。
 *
 * 用户口径（2026）：
 *   ·「这里就发蓝」（头像菜单 hover 行 rgb(37,37,53)，B−R=16）
 *   ·「弹窗面板的 质感也有问题」⇒ 选择「全套换成官方弹层配方」
 *
 * 官方源码实测的 dropdown：`flex w-[280px] … rounded-2xl border border-white/10 bg-popover shadow-2xl`
 *   （另有一族半透明 + 毛玻璃：`bg-popover/90 … backdrop-blur-2xl`）
 *   + 官方面板顶部内高光 `inset 0 1px 1px rgba(229,245,255,0.06)`（官方源码实测）。
 *
 * 改前 MTV 的弹层：面板色 #18181b · **硬灰圈** `--glass-bevel-border`(#3f3f46) · 圆角 10px ·
 *   `box-shadow: none` · `backdrop-filter: blur(0px)` —— 又扁又硬，这就是「质感有问题」。
 *
 * ⚠️ 面板（`.glass-bevel--panel`）**故意不跟着**这套走，别顺手统一。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(new URL(`../../src/styles/${file}`, import.meta.url), 'utf8');

/** 取出某条规则块（**行首**锚定选择器，避免 `.ui-menu {` 命中 `.ui-select--custom .ui-menu {`） */
function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)${escaped} \\{`).exec(source);
  expect(match, `找不到选择器 ${selector}`).toBeTruthy();
  const open = source.indexOf('{', match!.index);
  return source.slice(open + 1, source.indexOf('}', open)).replace(/\/\*[\s\S]*?\*\//g, '');
}

/** 下拉/弹层外壳（官方 dropdown 配方：bg-popover + border-white/10 + rounded-2xl + shadow-2xl） */
const POPOVERS: Array<[file: string, selector: string]> = [
  ['ui-kit.css', '.ui-menu'],
  ['composer.css', '.composer-menu'],
  ['panels.css', '.assets-add-menu'],
  ['prompt.css', '.slash-command-menu'],
  ['prompt.css', '.slash-command-submenu'],
  ['reactflow.css', '.canvas-history-panel'],
];

describe('弹层配方契约（官方 dropdown）', () => {
  it('官方弹层 token 齐全（暗色）', () => {
    const base = read('base.css');
    /* ★ round 103：`--popover-bg/-border/-item-hover` 原来抄的是官方**字面值**
       （`#262626` / `rgba(255,255,255,0.10)` / `#404040`），本轮改为**直接引用官方 shadcn 令牌**。
       契约不变（值等价），落点变成官方令牌 ⇒ 这里同时钉住「引用」与「官方令牌本身的逐字值」。
       官方逐字：`D:\DEEPSEEK\_official-css\index-BroFpZiQ.css` @739806 `--popover:#262626` ·
       @740531 `--border:#ffffff1a` · @740362 `--accent:#404040`。 */
    expect(base).toMatch(/--popover-bg:\s*var\(--popover\);/);
    expect(base).toMatch(/--popover-border:\s*var\(--border\);/);
    expect(base).toMatch(/--popover-radius:\s*16px;/);
    expect(base).toMatch(/--popover-blur:\s*16px;/);
    expect(base).toMatch(/--popover-item-radius:\s*12px;/);   /* 官方 rounded-lg = --radius = 12px */
    expect(base).toMatch(/--popover-item-hover:\s*var\(--accent\);/);
    /* 官方令牌本身的逐字值必须在位（引用不能指向空气） */
    expect(base).toMatch(/--popover:\s*#262626;/i);
    expect(base).toMatch(/--border:\s*#ffffff1a;/i);
    expect(base).toMatch(/--accent:\s*#404040;/i);
    /* 官方 `--shadow-2xl` **被 TapNow 覆盖过**：真值是 `0px 2px 4px 0px #00000040`，
       不是 Tailwind 默认那个 0 25px 50px -12px 的大投影 */
    const at = base.indexOf('--popover-shadow:');
    const body = base.slice(at, base.indexOf(';', at));
    expect(body).toMatch(/0 2px 4px 0 rgba\(0, 0, 0, 0\.25\)/);
    expect(body).not.toMatch(/25px 50px -12px/);
    expect(body).toMatch(/inset 0 1px 1px rgba\(229, 245, 255, 0\.06\)/);
  });

  it.each(POPOVERS)('%s 的 %s 用官方弹层配方', (file, selector) => {
    const body = ruleBody(read(file), selector);
    expect(body).toMatch(/var\(--popover-bg\)/);
    expect(body).toMatch(/var\(--popover-border\)/);
    expect(body).toMatch(/var\(--popover-radius\)/);
    expect(body).toMatch(/var\(--popover-shadow\)/);
    expect(body).toMatch(/var\(--popover-blur\)/);
    /* 硬灰圈 / 面板底色 / 无投影 都算回归 */
    expect(body).not.toMatch(/var\(--glass-bevel-border\)/);
    expect(body).not.toMatch(/var\(--theme-surface\)/);
    expect(body).not.toMatch(/box-shadow:\s*none/);
  });

  it('头像菜单项用官方 hover/圆角，且不再是偏蓝的 `--theme-hover`', () => {
    const hover = read('sidebar.css');
    const item = ruleBody(hover, '.avatar-menu-item:hover');
    expect(item).toMatch(/var\(--popover-item-hover\)/);
    expect(item).not.toMatch(/var\(--theme-hover\)/);
    expect(ruleBody(hover, '.avatar-menu-item')).toMatch(/border-radius:\s*var\(--menu-item-radius\)/);
  });

  /* ── 官方**账号菜单**那一版（用户图1）—— 与下拉菜单项是两套，别合并 ── */
  it('官方账号菜单 token 齐全（容器 260/r16/#1F1F1F · 单行 gap8/p6px8/14px/500/radius4 · 图标盒 24/#2B2B2B）', () => {
    const base = read('base.css');
    /* ★ round 103：三个颜色项改为**引用官方 shadcn 令牌**（值与原字面值逐字相同）。
       官方逐字：`D:\DEEPSEEK\_official-css\index-BroFpZiQ.css` @739733 `--card:#1f1f1f` ·
       @739924 `--secondary-foreground:#f0f0f0` · @740106 `--muted:#2b2b2b` ·
       @740246 `--secondary-muted-foreground:#a3a3a3`。 */
    expect(base).toMatch(/--menu-bg:\s*var\(--card\);/);
    expect(base).toMatch(/--menu-radius:\s*16px;/);
    expect(base).toMatch(/--menu-item-radius:\s*8px;/);
    expect(base).toMatch(/--menu-item-fg:\s*var\(--secondary-foreground\);/);
    expect(base).toMatch(/--menu-icon-box:\s*24px;/);
    expect(base).toMatch(/--menu-icon-radius:\s*8px;/);
    expect(base).toMatch(/--menu-icon-bg:\s*var\(--muted\);/);
    expect(base).toMatch(/--menu-icon-fg:\s*var\(--secondary-muted-foreground\);/);
    expect(base).toMatch(/--menu-icon-size:\s*16px;/);
    /* 官方令牌本身的逐字值必须在位 */
    expect(base).toMatch(/--card:\s*#1f1f1f;/i);
    expect(base).toMatch(/--secondary-foreground:\s*#f0f0f0;/i);
    expect(base).toMatch(/--muted:\s*#2b2b2b;/i);
    expect(base).toMatch(/--secondary-muted-foreground:\s*#a3a3a3;/i);
  });

  it('头像菜单 = 官方账号菜单：宽 260 / 圆角 16 / 内边距 10px 6px / 底色 #1F1F1F / **无描边**', () => {
    const body = ruleBody(read('sidebar.css'), '.avatar-menu');
    expect(body).toMatch(/width:\s*260px/);
    expect(body).toMatch(/border-radius:\s*var\(--menu-radius\)/);
    expect(body).toMatch(/padding:\s*10px 6px/);
    expect(body).toMatch(/background:\s*var\(--menu-bg\)/);
    /* 官方这个菜单没有描边（下拉那套才有 border-white/10）*/
    expect(body).toMatch(/border:\s*none/);
    expect(body).not.toMatch(/var\(--popover-border\)/);
  });

  it('单行是官方 `_d` 配方：gap 8 / padding 6px 8px / 14px 500 / radius 8（= --radius 12 - 4）', () => {
    const body = ruleBody(read('sidebar.css'), '.avatar-menu-item');
    expect(body).toMatch(/gap:\s*8px/);
    expect(body).toMatch(/padding:\s*6px 8px/);
    expect(body).toMatch(/font-size:\s*14px/);
    expect(body).toMatch(/font-weight:\s*500/);
    expect(body).toMatch(/color:\s*var\(--menu-item-fg\)/);
    expect(body).toMatch(/border-radius:\s*var\(--menu-item-radius\)/);
  });

  it('单行有官方那个**图标外壳 + 底色**（h-6 w-6 / rounded-sm / bg-muted）', () => {
    const css = read('sidebar.css');
    const box = ruleBody(css, '.avatar-menu-item-icon');
    expect(box).toMatch(/width:\s*var\(--menu-icon-box\)/);
    expect(box).toMatch(/height:\s*var\(--menu-icon-box\)/);
    expect(box).toMatch(/background:\s*var\(--menu-icon-bg\)/);
    expect(box).toMatch(/color:\s*var\(--menu-icon-fg\)/);
    expect(box).toMatch(/border-radius:\s*var\(--menu-icon-radius\)/);
    expect(ruleBody(css, '.avatar-menu-item-icon > svg')).toMatch(/width:\s*var\(--menu-icon-size\)/);
    /* TSX 里**每一个**菜单行都要真的套上这个外壳（只有 CSS 没有 DOM 等于没做）。
       ⚠️ 别写死数量：菜单行会增减 —— 用户后来就要求在前面加「简体中文 / 账户管理」两行。 */
    const tsx = readFileSync(new URL('../../src/components/Sidebar.tsx', import.meta.url), 'utf8');
    const iconShells = (tsx.match(/className="avatar-menu-item-icon"/g) ?? []).length;
    const menuRows = (tsx.match(/className="avatar-menu-item"/g) ?? []).length;
    expect(menuRows).toBeGreaterThanOrEqual(2);
    expect(iconShells, '每个菜单行都要有图标外壳').toBe(menuRows);
  });

  it('分隔线是官方 `LNe`：0.5px 发丝线 + my-2，且不被共用分隔线色覆盖', () => {
    expect(ruleBody(read('sidebar.css'), '.avatar-menu-sep')).toMatch(/border-top:\s*0\.5px solid var\(--menu-sep\)/);
    expect(read('separators.css')).not.toMatch(/\.avatar-menu-sep,/);
  });

  it('面板（--panel）不跟着弹层走：仍然用面板底色 + 面板投影', () => {
    const panel = ruleBody(read('base.css'), '.glass-bevel--panel');
    expect(panel).toMatch(/var\(--glass-panel-bg\)/);
    expect(panel).toMatch(/var\(--glass-shadow-panel\)/);
    expect(panel).not.toMatch(/var\(--popover-/);
  });
});
