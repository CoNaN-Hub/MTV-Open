/**
 * referencePromptPlan 单测 —— 断/改边时下游（图片/文本）卡 prompt 的重写计划。
 * 依据：EXE `page-DPdEgTS0.js` @1451700 `rge` + 非 VIDEO 的 `onBeforeDelete` 路径。
 */
import { describe, expect, it } from 'vitest';
import {
  collectAffectedTargets,
  planReferencePromptRewrites,
} from '../../src/utils/referencePromptPlan';

function node(id: string, type: string, data: Record<string, unknown> = {}) {
  return { id, type, position: { x: 0, y: 0 }, data } as never;
}
function edge(id: string, source: string, target: string, order = 0) {
  return { id, source, target, data: { order } } as never;
}

const IMG1 = node('i1', 'ai-image', { imageUrl: '1.png', label: 'A 图' });
const IMG2 = node('i2', 'ai-image', { imageUrl: '2.png', label: 'B 图' });
const TXT1 = node('t1', 'ai-text', { text: '文案一' });
const TARGET = node('target', 'ai-image', { prompt: '看 {{Image 1}} 和 {{Image 2}} 与 {{Text 1}}' });
const VIDEO_TARGET = node('vt', 'ai-video', { prompt: '看 {{Image 1}}' });

describe('受影响 target（官方 rge 第一步）', () => {
  it('新增/删除/改动边都算；未变的边不算', () => {
    const before = [edge('e1', 'i1', 'target', 1), edge('e2', 'i2', 'target', 2)];
    const after = [edge('e1', 'i1', 'target', 1), edge('e3', 't1', 'target', 3)];
    const affected = collectAffectedTargets(before, after);
    expect([...affected]).toEqual(['target']);
  });
});

describe('图片/文本卡 prompt 重写计划', () => {
  it('断开一条上游 ⇒ 计划里去掉对应 token（只吃前导空格）', () => {
    const plan = planReferencePromptRewrites({
      nodes: [IMG1, IMG2, TXT1, TARGET],
      previousEdges: [edge('e1', 'i1', 'target', 1), edge('e2', 'i2', 'target', 2), edge('e3', 't1', 'target', 3)],
      nextEdges: [edge('e2', 'i2', 'target', 2), edge('e3', 't1', 'target', 3)],
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].id).toBe('target');
    /* {{Image 1}} 断开被删（吃掉前导空格），{{Image 2}} 重编号为 {{Image 1}} */
    expect(plan[0].prompt).toBe('看 和 {{Image 1}} 与 {{Text 1}}');
    expect(plan[0].draft).toBe('看 和 {{Image 1}} 与 {{Text 1}}');
  });

  it('引用没变 ⇒ 不产出计划（无副作用）', () => {
    const plan = planReferencePromptRewrites({
      nodes: [IMG1, TXT1, TARGET],
      previousEdges: [edge('e1', 'i1', 'target', 1)],
      nextEdges: [edge('e1', 'i1', 'target', 1)],
    });
    expect(plan).toEqual([]);
  });

  it('提示词里没有 token ⇒ 不产出计划', () => {
    const plain = node('p', 'ai-text', { prompt: '纯文本没有引用' });
    const plan = planReferencePromptRewrites({
      nodes: [IMG1, plain],
      previousEdges: [edge('e1', 'i1', 'p', 1)],
      nextEdges: [],
    });
    expect(plan).toEqual([]);
  });

  it('官方 rge 只碰 VIDEO —— 但本次范围是图片/文本，所以视频 target 被跳过', () => {
    const plan = planReferencePromptRewrites({
      nodes: [IMG1, VIDEO_TARGET],
      previousEdges: [edge('e1', 'i1', 'vt', 1)],
      nextEdges: [],
    });
    expect(plan).toEqual([]);
  });

  it('有草稿时以草稿为基准重写（官方 getPromptDraft 优先）', () => {
    const plan = planReferencePromptRewrites({
      nodes: [IMG1, IMG2, TARGET],
      previousEdges: [edge('e1', 'i1', 'target', 1), edge('e2', 'i2', 'target', 2)],
      nextEdges: [edge('e2', 'i2', 'target', 2)],
      getDraft: () => '草稿 {{Image 1}} 与 {{Image 2}}',
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].prompt).toBe('草稿 与 {{Image 1}}');
  });
});
