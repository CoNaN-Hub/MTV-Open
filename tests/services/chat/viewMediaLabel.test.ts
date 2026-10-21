/**
 * 第 62 轮回归：`view_media` 行的**状态文案**。
 *
 * 用户实测（图 1/图 2）：行的 `data-tool-activity-status="completed"`、载荷
 * `response.images=[{ref:"node/…"}]`（成功），标签却是「查看媒体失败」。
 * 真因：MTV 把「条数 > 1」当成功判据，`count === 1` 一律走失败分支。
 * 官方判据 = `yrt(items)` 的 **delivered**（结算后 `response.images/videos` 非空），与条数无关。
 *
 * 验证分级 = **(b) 真函数 + (d) 官方 `yrt` 逐字**。
 */
import { describe, expect, it } from 'vitest';
import { agentToolLineLabel, viewMediaCounts } from '../../../src/services/chat/agentToolLabels';

const toolEvent = (status: string, response: Record<string, unknown> = {}, request: Record<string, unknown> = {}) => ({
  type: 'tool_event',
  content: { tool: 'view_media', status, response, request },
});

describe('view_media 行文案：delivered 才是「已查看」', () => {
  it('只查看 1 项且成功 ⇒ 「已查看 1 项内容」（旧版会错写成失败）', () => {
    const items = [toolEvent('completed', { images: [{ ref: 'node/node-a' }] })];
    expect(viewMediaCounts(items)).toEqual({ count: 1, delivered: true });
    const label = agentToolLineLabel(items as never, false);
    expect(label.kind).toBe('viewMedia');
    expect(label.key).toBe('chatAdapter.agentEvent.toolCallLine.viewedMedia');
    expect(label.count).toBe(1);
    expect(label.key).not.toContain('view_media_failed');
  });

  it('查看 2 项 ⇒ count=2、仍是已查看', () => {
    const items = [toolEvent('completed', { images: [{ ref: 'a' }, { ref: 'b' }] })];
    expect(viewMediaCounts(items)).toEqual({ count: 2, delivered: true });
    expect(agentToolLineLabel(items as never, false).count).toBe(2);
  });

  it('完成但**没有** images/videos ⇒ 失败文案（官方 fallback）', () => {
    const items = [toolEvent('completed', { unavailable: [{ ref: 'node/x', reason: '读盘失败' }] })];
    expect(viewMediaCounts(items)).toEqual({ count: 1, delivered: false });
    const label = agentToolLineLabel(items as never, false);
    expect(label.key).toBe('chatAdapter.agentEvent.toolLabels.view_media_failed');
  });

  it('failed 且没有像素 ⇒ 失败文案；视频也算 delivered', () => {
    expect(viewMediaCounts([toolEvent('failed', {})]).delivered).toBe(false);
    expect(viewMediaCounts([toolEvent('completed', { videos: [{ ref: 'v1' }] })])).toEqual({ count: 1, delivered: true });
  });

  it('进行中 ⇒ viewingMedia，且用未结算的 request.refs 计数', () => {
    const items = [toolEvent('in_progress', {}, { refs: ['a', 'b'] })];
    expect(viewMediaCounts(items)).toEqual({ count: 2, delivered: false });
    const label = agentToolLineLabel(items as never, true);
    expect(label.key).toBe('chatAdapter.agentEvent.toolCallLine.viewingMedia');
    expect(label.count).toBe(2);
  });
});
