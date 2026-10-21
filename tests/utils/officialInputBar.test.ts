/**
 * 底部编辑区可见性门（官方 `hide_inputbar`）回归测试。
 *
 * 用户 2026 报的 bug：「从 PS 传回画布的图卡，底部编辑区只剩一个『选择模型』按钮，其他按钮都没了」。
 * 根因：MTV 把官方**一种**图卡拆成了两种类型，而这两个门**只认 `ai-image`** ——
 *   · 粘贴 / 「替换」上传 → `ai-image`
 *   · 拖文件进画布 / 图片往返回传 / PS 主动推送 / 短剧资产 → **`source-image`**
 * ⇒ 所有 `source-image` 卡都渲染出一条**只剩模型选择器的半截编辑条**。
 * 而官方口径（用户此前逐字确认过）是：**从文件进来的参考卡不渲染底部编辑区**。
 */
import { describe, expect, it } from 'vitest';
import { isInputBarSuppressedNode, markHideInputBarForFileBackedImage } from '../../src/utils/officialInputBar';

const fileBacked = { role: 'source' as const, fileName: 'a.png' };

describe('底部编辑区可见性门', () => {
  it('两种「从文件进来」的图卡都挡掉（ai-image 与 source-image）', () => {
    expect(isInputBarSuppressedNode('ai-image', fileBacked)).toBe(true);
    /* 这条就是本次修的：以前只有 ai-image 会命中 */
    expect(isInputBarSuppressedNode('source-image', fileBacked)).toBe(true);
  });

  it('没有 fileName 的 source 卡不挡（不是「从文件进来」的）', () => {
    expect(isInputBarSuppressedNode('source-image', { role: 'source' })).toBe(false);
    expect(isInputBarSuppressedNode('source-image', { role: 'source', fileName: '' })).toBe(false);
  });

  it('生成卡（role=generator）照常显示编辑区', () => {
    expect(isInputBarSuppressedNode('ai-image', { role: 'generator', fileName: 'a.png' })).toBe(false);
    expect(isInputBarSuppressedNode('source-image', { role: 'generator', fileName: 'a.png' })).toBe(false);
  });

  it('显式 hide_inputbar 优先（任意类型、任意角色）', () => {
    expect(isInputBarSuppressedNode('ai-video', { hide_inputbar: true })).toBe(true);
    expect(isInputBarSuppressedNode('source-image', { hide_inputbar: true })).toBe(true);
  });

  it('插入打标：文件进来的 source-image 会被标上 hide_inputbar', () => {
    expect(markHideInputBarForFileBackedImage('source-image', { ...fileBacked }).hide_inputbar).toBe(true);
    expect(markHideInputBarForFileBackedImage('ai-image', { ...fileBacked }).hide_inputbar).toBe(true);
    /* 没有文件来源（生成卡）不打标 */
    expect(markHideInputBarForFileBackedImage('source-image', { role: 'generator' }).hide_inputbar).toBeUndefined();
    /* 调用方已显式给值时不覆盖 */
    expect(markHideInputBarForFileBackedImage('source-image', { ...fileBacked, hide_inputbar: false }).hide_inputbar).toBe(false);
  });
});
