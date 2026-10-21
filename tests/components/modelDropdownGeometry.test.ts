/**
 * 画布模型下拉的**官方间距/行高**回归（源码级）。
 *
 * ## 官方证据（逐字，不是目测）
 * - `D:\DEEPSEEK\live-assets-new\vendor-packages-DRvCmDjR.js` **@1226275**（图片节点下拉 `Sme`）：
 *   ```jsx
 *   <Un className="p-2 w-full h-full rounded-none flex flex-col gap-1 max-h-[400px] overflow-y-auto">
 *     …<div className="flex items-center justify-between p-2 rounded-[12px] transition-colors relative">
 *        <div className="flex flex-col gap-1 flex-1 min-w-0">
 *          <div className="flex items-center gap-1 w-full"> … 图标 + 名字 … </div>
 *          {P.featureTags?.length > 0 && <div className="flex items-start gap-1 w-full flex-wrap"> … </div>}
 *        </div>
 *        … 选中勾：`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8` …
 *      </div>
 *   ```
 * - 同一批产物里视频下拉 `vendor-pkg-canvas-CvbAwZyy.js` **@1247003 / @1247116** 同形。
 * - 间距单位：`D:\DEEPSEEK\_official-css\index-BroFpZiQ.css` **@24046** `--spacing: .25rem`；
 *   `.gap-1 { gap: calc(var(--spacing)*1); }`（**@114602** 附近）、
 *   `.p-2 { padding: calc(var(--spacing)*2); }`（**@268927**）⇒ `gap-1` = **4px**、`p-2` = **8px**。
 *
 * ⇒ 本仓 `.model-dropdown` 必须是 `flex column` + `gap 4px` + `padding 8px` + `max-height 400px`；
 *   行 `.model-item` 是 `padding 8px`；名字行与标签行之间靠 `.model-item-info` 的 `gap 4px`；
 *   标签行 `.model-item-tags` 是 `flex` + `gap 4px` + `flex-wrap`（官方 `items-start gap-1 flex-wrap`）。
 *
 * 事故（用户实测）：「你看这个纵向间距 我这服了」—— 旧 CSS 没有 `display:flex` / `gap`，
 * 行是普通块级元素**紧贴**（0 间距），且行内只有一行（徽标挤在名字行上）。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
  fileURLToPath(new URL('../../src/styles/model-selector.css', import.meta.url)),
  'utf8',
);

/** 去掉注释（规则文本里会出现 `{ … }` 这种注释写法，直接正则会被截断）。 */
const CLEAN = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** 取选择器列表里**恰好包含**该选择器的那条规则（同选择器被覆盖写多次时取最后一条）。 */
function rule(selector: string): string {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let found: string | null = null;
  for (const match of CLEAN.matchAll(re)) {
    const selectors = match[1].split(',').map((part) => part.trim().replace(/\s+/g, ' '));
    if (selectors.includes(selector)) found = match[2];
  }
  expect(found, `CSS 里找不到规则：${selector}`).not.toBeNull();
  return found as string;
}

describe('官方间距：下拉内层 = `flex flex-col gap-1` + `p-2` + `max-h-[400px]`', () => {
  it('.model-dropdown 是 flex 竖排且行间距 4px（官方 gap-1）', () => {
    const block = rule('.model-dropdown');
    expect(block).toMatch(/display:\s*flex/);
    expect(block).toMatch(/flex-direction:\s*column/);
    expect(block).toMatch(/gap:\s*4px/);
    /* 外层宽度/高度/内边距 = 官方 w-[280px] / max-h-[400px] / p-2 */
    expect(block).toMatch(/width:\s*280px/);
    expect(block).toMatch(/max-height:\s*400px/);
    expect(block).toMatch(/padding:\s*8px/);
  });

  it('聊天/助手那两套弹层的间距保持 0（官方不是同一个参考）', () => {
    const block = rule('.model-dropdown.c-pop');
    expect(block).toMatch(/gap:\s*0/);
  });

  it('.model-item 行内边距 8px（官方 p-2）、圆角 12px（官方 rounded-[12px]）', () => {
    const block = rule('.model-item');
    expect(block).toMatch(/padding:\s*8px/);
    expect(block).toMatch(/border-radius:\s*12px/);
  });

  it('名字行与标签行之间 4px（官方 `flex flex-col gap-1` 的父层）', () => {
    const block = rule('.model-item-model .model-item-info');
    expect(block).toMatch(/flex-direction:\s*column/);
    expect(block).toMatch(/gap:\s*4px/);
  });

  it('标签行 = 官方 `flex items-start gap-1 w-full flex-wrap`', () => {
    const block = rule('.model-item-tags');
    expect(block).toMatch(/display:\s*flex/);
    expect(block).toMatch(/align-items:\s*flex-start/);
    expect(block).toMatch(/gap:\s*4px/);
    expect(block).toMatch(/flex-wrap:\s*wrap/);
    expect(block).toMatch(/width:\s*100%/);
  });

  it('名字行 = 官方 `flex items-center gap-1 w-full`（图标与名字之间 4px）', () => {
    const block = rule('.model-item-name-row');
    expect(block).toMatch(/display:\s*flex/);
    expect(block).toMatch(/align-items:\s*center/);
    expect(block).toMatch(/gap:\s*4px/);
  });
});
