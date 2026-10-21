/**
 * 流式正文收尾对账 —— 事故现场（用户 2026 真机，原始数据）：
 *
 * ```
 * content   = '已在画布上生成 3:4 竖幅小猫图片：@{node-gxx0zfmw2:%E5%AF%B9%E8%AF%9D%E7%94%9F%E6%88%90%E5%9B%BE%E7%89%87}'
 * textItems = '已在画布上生成 3:4 竖幅小猫图片：@'
 * DOM       = '已在画布上生成 3:4 竖幅小猫图片：@'      <- @ 后面既没有 chip 也没有字
 * ```
 * 成因：`onComplete` 用权威 `fullText` 整体覆盖 `content`，而 `textItems` 只有已 flush 的前缀，
 * `cancel()` 又把缓冲里的尾部丢掉；渲染层用的是 `textItems` ⇒ 界面被截断（chip 也一起没了）。
 */
import { describe, expect, it, vi } from 'vitest';

import {
  appendStreamingTextItem,
  reconcileStreamingTextItems,
} from '../../../src/services/chat/messageContents';

describe('reconcileStreamingTextItems', () => {
  it('事故复现：尾部（含提及 token）必须补回来', () => {
    const prefix = '已在画布上生成 3:4 竖幅小猫图片：@';
    const full = '已在画布上生成 3:4 竖幅小猫图片：@{node-gxx0zfmw2:%E5%AF%B9%E8%AF%9D%E7%94%9F%E6%88%90%E5%9B%BE%E7%89%87}';
    const items = appendStreamingTextItem(undefined, prefix, 1);

    const next = reconcileStreamingTextItems(items, full);
    expect(next.map((item) => item.content).join('')).toBe(full);
    expect(next).toHaveLength(1);
    expect(next[0].startedAt).toBe(1);
  });

  it('多段正文（工具事件切出来）只补最后一段，前面的边界与时间戳不动', () => {
    let items = appendStreamingTextItem(undefined, '先说明一下：', 10);
    items = appendStreamingTextItem(items, '正在生成图片…', 10);
    items = appendStreamingTextItem(items, 'done: @', 20, true);

    const next = reconcileStreamingTextItems(items, '先说明一下：正在生成图片…done: @{n1:猫}');
    expect(next.map((item) => item.content)).toEqual(['先说明一下：正在生成图片…', 'done: @{n1:猫}']);
    expect(next.map((item) => item.startedAt)).toEqual([10, 20]);
  });

  it('已经一致 ⇒ 内容不变（不制造无谓的重渲染）', () => {
    const items = appendStreamingTextItem(undefined, '完全一致', 1);
    expect(reconcileStreamingTextItems(items, '完全一致').map((item) => item.content)).toEqual(['完全一致']);
    expect(reconcileStreamingTextItems(undefined, '无 item')).toEqual([
      { content: '无 item', startedAt: expect.any(Number) },
    ]);
  });

  it('前缀对不上（模型补写/回滚）⇒ 收敛成一项权威全文', () => {
    const items = appendStreamingTextItem(undefined, '旧的半句', 1);
    const next = reconcileStreamingTextItems(items, '新的完整回答');
    expect(next).toEqual([{ content: '新的完整回答', startedAt: 1 }]);
  });

  it('纯函数：不改传入的数组', () => {
    const items = appendStreamingTextItem(undefined, 'abc', 1);
    const spy = vi.fn();
    spy(reconcileStreamingTextItems(items, 'abcd'));
    expect(spy).toHaveBeenCalledWith([{ content: 'abcd', startedAt: 1 }]);
    expect(items[0].content).toBe('abc');
  });
});