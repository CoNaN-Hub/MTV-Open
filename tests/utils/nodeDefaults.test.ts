import { describe, expect, it } from 'vitest';
import {
  NODE_BASE_SIZE,
  nodeSizeForAspect,
  nodeSizeForAspectRatio,
} from '../../src/utils/nodeBounds';
import { buildNodeData } from '../../src/components/sidebar/nodePickerActions';

/**
 * 官方默认尺寸（EXE `index-BiTZf8mJ.js` @6935951 / `zoom-slider-3ZcFvYQO.js` @2787783）：
 *   Od = { width: 250, height: 250 }        // 节点基准尺寸；标题栏/空卡的默认值
 *   pR(ratio) = ratio>1 ? (250*ratio)×250 : 250×(250/ratio)   // 短边恒 250
 *   文本创建器 `wT`(纯文本) / `Dx`(生成文本) 都写 `width: Ha.width, height: Ha.height`，Ha = Od
 *   ⇒ 新建文本卡 = 250×250；新建图卡 = pR(存入的 aspectRatio)（MTV 存 16:9 ⇒ 444×250）
 */
describe('official node default size (Od / pR)', () => {
  it('keeps the official base size 250×250', () => {
    expect(NODE_BASE_SIZE).toEqual({ width: 250, height: 250 });
  });

  it('follows pR: the short side stays 250', () => {
    // 官方给出的整表（短边恒 250，圆整）
    expect(nodeSizeForAspectRatio(1)).toEqual({ width: 250, height: 250 });
    expect(nodeSizeForAspectRatio(4 / 3)).toEqual({ width: 333, height: 250 });
    expect(nodeSizeForAspectRatio(3 / 2)).toEqual({ width: 375, height: 250 });
    expect(nodeSizeForAspectRatio(16 / 9)).toEqual({ width: 444, height: 250 });
    expect(nodeSizeForAspectRatio(3 / 4)).toEqual({ width: 250, height: 333 });
    expect(nodeSizeForAspectRatio(2 / 3)).toEqual({ width: 250, height: 375 });
    expect(nodeSizeForAspectRatio(9 / 16)).toEqual({ width: 250, height: 444 });
  });

  it('maps ratio strings through Mvs-like parsing (missing/garbage ⇒ ratio 1)', () => {
    expect(nodeSizeForAspect('16:9')).toEqual({ width: 444, height: 250 });
    expect(nodeSizeForAspect('9:16')).toEqual({ width: 250, height: 444 });
    expect(nodeSizeForAspect(undefined)).toEqual({ width: 250, height: 250 });
    expect(nodeSizeForAspect('')).toEqual({ width: 250, height: 250 });
  });
});

describe('add-node menu defaults (buildNodeData)', () => {
  it('creates the text card at the official 250×250', () => {
    const data = buildNodeData('ai-text');
    expect(data.nodeWidth).toBe(250);
    expect(data.nodeHeight).toBe(250);
  });

  it('creates the image card at pR(16:9) = 444×250, consistent with the stored ratio', () => {
    const data = buildNodeData('ai-image');
    expect(data.aspectRatio).toBe('16:9');
    expect(data.nodeWidth).toBe(444);
    expect(data.nodeHeight).toBe(250);
  });
});
