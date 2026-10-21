/**
 * 面板几何「官方对齐」源码守卫
 *
 * 官方依据（`tapnow-agent-panel-ground-truth.md` §1.1，逐字取自 SHARED@416026..416252）：
 *   min 360 · default 480 · max = innerWidth × 48% · 隐藏位 x 偏移 12px · 持久化 key "canvas-chat-width"
 * 任何人把默认宽度改回 400 或把上限换回固定 px，这些断言会立刻失败。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

describe('面板几何官方对齐', () => {
  const panel = read('src/components/chat/ChatPanel.tsx');

  it('取官方的 min / default / max 比例', () => {
    expect(panel).toContain('const CHAT_PANEL_DEFAULT_WIDTH = 480;');
    expect(panel).toContain('const CHAT_PANEL_MIN_WIDTH = 360;');
    expect(panel).toContain('const CHAT_PANEL_MAX_VIEWPORT_RATIO = 0.48;');
  });

  it('用官方持久化 key `canvas-chat-width` 读写宽度', () => {
    expect(panel).toContain("const CHAT_PANEL_WIDTH_STORAGE_KEY = 'canvas-chat-width';");
    expect(panel).toContain('CHAT_PANEL_WIDTH_STORAGE_KEY');
  });

  it('宽度全由 JS 的官方数值驱动（外壳改回流内后不再有 CSS 兜底变量）', () => {
    /* 官方是 motion `animate={{width,minWidth,x}}` 的**数值**，不是 CSS 变量；
       面板改回流内后 `--chat-panel-width` / `--chat-panel-inset` / `max-width:48vw` 全部删除。 */
    const base = read('src/styles/base.css');
    const panels = read('src/styles/panels.css');
    expect(base).not.toContain('--chat-panel-width');
    expect(panels).not.toContain('max-width: 48vw');
    /* 内层壳逐字：bg-chat-background + 仅左侧 16px 圆角 */
    expect(panels).toContain('border-radius: 16px 0 0 16px;');
    expect(panels).toContain('background: var(--chat-background, #141414);');
    /* 面板不再自定位（官方是流内 flex 子项）—— 只看 `.chat-panel{…}` 这一条规则 */
    const chatPanelRule = panels.match(/\.chat-panel\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(chatPanelRule).not.toContain('position: fixed');
    /* 官方收起位 x=12（SHARED@416252）写在 ChatPanel 常量里 */
    expect(panel).toContain('const CHAT_PANEL_HIDDEN_X_OFFSET = 12;');
  });

  it('头部图标 18px、拖拽柄 4px + 12px 热区（CDP 9222 官方实测）', () => {
    const chatCss = read('src/styles/official-chat.css');
    expect(chatCss).toContain('width: 18px;');
    const panels = read('src/styles/panels.css');
    expect(panels).toContain('width: 4px;');
    expect(panels).toContain('left: -4px;');
  });
});
