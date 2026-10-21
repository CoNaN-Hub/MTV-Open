/**
 * 画布**卡面**配色契约 —— 卡面只能用 `--theme-node-bg`，不许用面板 token `--theme-surface`。
 *
 * 事故（用户实测 2026）：
 *   「现在 mtv 缓存 加载时 颜色 是偏蓝的 不对 应该是MTV 原始的 全局移除这个丑死了的颜色 换成官方的」
 *   取证：用户截图里的卡片填充色**逐像素采样 = `#14141C`**，正好是 `--theme-surface` 的值
 *   （v1.0.0 重品牌留下的**偏蓝**面板色）；而 MTV 的卡面本色是 `--theme-node-bg: #1F1F1F`
 *   （commit 8f1592dd「画布卡面（节点面）—— 对齐 TapNow 官方实测 #1F1F1F」）。
 *
 * 根因：`.canvas-node-lod-preview`（LOD **缓存缩略图加载中**的占位盒，
 *   `acquireCanvasImagePreview` 的 256px 预览还没就绪时露出来的就是它；`lite` / `is-cover` 两态共用）
 *   背景写成了面板 token，可**同一个盒子的描边却已经是** `--theme-node-border`（卡面描边）——
 *   一条规则里自相矛盾。同时 `.image-preview` / `.video-preview` / 音频波形 / 分镜格 / 动画预览底面
 *   也都被漏在面板 token 上 ⇒ 卡片一进"加载中"就发蓝。
 *
 * ⚠️ 这条契约很容易被"顺手统一成 --theme-surface"改回去 —— 一旦改回去，
 *    卡片在缓存加载时会**闪一下偏蓝**（用户能看见），所以在这里钉死。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(new URL(`../../src/styles/${file}`, import.meta.url), 'utf8');

/** 取出 `选择器 {` 到第一个 `}` 之间的规则体（行首锚定；先剥注释，免得注释里的旧 token 误伤断言） */
function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)${escaped} \\{`).exec(source);
  expect(match, `找不到选择器 ${selector}`).toBeTruthy();
  const open = source.indexOf('{', match!.index);
  const raw = source.slice(open + 1, source.indexOf('}', open));
  return raw.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** 卡面 = 画布上"卡片的那块面"，一律必须用卡面本色 */
const CARD_FACES: Array<[file: string, selector: string, 说明: string]> = [
  ['nodes.css', '.canvas-node-lod-preview', 'LOD 缓存缩略图加载中的占位盒（lite / is-cover 共用）'],
  ['nodes.css', '.image-preview', '图卡内的媒体区'],
  ['nodes.css', '.video-preview', '视频卡内的媒体区'],
  ['nodes-audio.css', '.audio-waveform-wrapper', '音频卡的波形区'],
  ['nodes-storyboard.css', '.storyboard-grid', '分镜卡的宫格底'],
  ['nodes-storyboard.css', '.sb-cell--empty', '分镜空格占位'],
  ['nodes-animation.css', '.animation-preview', '动画卡预览的棋盘格底面'],
];

describe('画布卡面配色契约（不许用面板 token）', () => {
  it('`--theme-node-bg` = 官方实测的卡面本色 #1F1F1F，且与面板色 `--theme-surface` 不同', () => {
    const base = read('base.css');
    expect(base).toMatch(/--theme-node-bg:\s*#1F1F1F;/i);
    /* 两者是**两个角色**：卡面 ≠ 面板。面板 token 自己也已经中性化（#18181b = 官方 zinc-900）*/
    expect(base).toMatch(/--theme-surface:\s*#18181b;/i);
  });

  it.each(CARD_FACES)('%s 的 %s（%s）用 `--theme-node-bg`', (file, selector) => {
    const body = ruleBody(read(file), selector);
    expect(body).toMatch(/var\(--theme-node-bg/);
    /* 面板 token 出现在卡面上 = 卡片加载时发蓝（本次事故） */
    expect(body).not.toMatch(/var\(--theme-surface/);
  });

  it('LOD 占位盒的背景与描边取自**同一套**卡面 token（不再自相矛盾）', () => {
    const body = ruleBody(read('nodes.css'), '.canvas-node-lod-preview');
    expect(body).toMatch(/background:\s*var\(--theme-node-bg\)/);
    expect(body).toMatch(/box-shadow:[^;]*var\(--theme-node-border\)/);
  });
});
