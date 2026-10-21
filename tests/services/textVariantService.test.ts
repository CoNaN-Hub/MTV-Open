import type { Edge, Node as RFNode } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaseNodeData } from '../../src/types';

/**
 * 官方依据（`zoom-slider-3ZcFvYQO.js`）：
 *   · 文本「生成次数 N」= 画布上 N 个兄弟节点：`q = requestedResultCount ?? params.times`（@2823789）
 *     喂给 `Bqe`；`resultsPerRequest:1` ⇒ 每节点各一次请求（@2827275）
 *   · 克隆体 `Dqe`（@2793626）：首次生成 = 源节点 + N-1 个克隆，克隆体 times 强制回 1
 *   · 布局 `Nqe`（@2792075）：`bG = 64`；`cols = ceil(sqrt(N))`；步长 = 节点尺寸 + 64；
 *     第 0 个（源节点）位置不变
 *   · 连线 `Oqe`（@2794374）：源节点入边逐条复制到每个新节点
 */
const driver = vi.hoisted(() => ({
  nodes: [] as RFNode<BaseNodeData>[],
  edges: [] as Edge[],
  currentProjectId: 'p1',
  commitToHistory: vi.fn(),
  updateNodeDataTransient: vi.fn(),
  addNodesTransient: vi.fn(),
  onEdgesChange: vi.fn(),
}));

vi.mock('../../src/store/useAppStore', () => {
  const useAppStore = (selector: (state: typeof driver) => unknown) => selector(driver);
  (useAppStore as unknown as { getState: () => typeof driver }).getState = () => driver;
  return { useAppStore };
});

import {
  TEXT_VARIANT_NODE_GAP,
  prepareTextVariantNodes,
  textVariantNodePosition,
} from '../../src/services/textVariantService';

function textNode(id: string, x: number, y: number): RFNode<BaseNodeData> {
  return {
    id,
    type: 'ai-text',
    position: { x, y },
    data: {
      type: 'ai-text',
      label: '生成文本',
      prompt: '写一段开场白',
      model: 'gpt-4o',
      provider: 'general',
      output: '旧正文',
      nodeWidth: 250,
      nodeHeight: 250,
      batchCount: 3,
    } as BaseNodeData,
  };
}

beforeEach(() => {
  driver.nodes = [textNode('source', 100, 200)];
  driver.edges = [{ id: 'e-in', source: 'upstream', target: 'source', data: { order: 0 } }];
  driver.currentProjectId = 'p1';
  driver.commitToHistory.mockClear();
  driver.updateNodeDataTransient.mockClear();
  driver.addNodesTransient.mockClear();
  driver.onEdgesChange.mockClear();
});

describe('official SPREAD layout for text variants (Nqe)', () => {
  it('keeps the source at the anchor and steps by size + 64', () => {
    expect(TEXT_VARIANT_NODE_GAP).toBe(64);
    expect(textVariantNodePosition({ x: 100, y: 200 }, 250, 250, 0, 4)).toEqual({ x: 100, y: 200 });
    expect(textVariantNodePosition({ x: 100, y: 200 }, 250, 250, 1, 4)).toEqual({ x: 414, y: 200 });
  });

  it('wraps into ceil(sqrt(N)) columns', () => {
    const anchor = { x: 0, y: 0 };
    /* N=4 ⇒ 2 列：1 右 · 2 下 · 3 右下 */
    expect(textVariantNodePosition(anchor, 250, 250, 2, 4)).toEqual({ x: 0, y: 314 });
    expect(textVariantNodePosition(anchor, 250, 250, 3, 4)).toEqual({ x: 314, y: 314 });
    /* N=9 ⇒ 3 列 */
    expect(textVariantNodePosition(anchor, 250, 250, 3, 9)).toEqual({ x: 0, y: 314 });
    expect(textVariantNodePosition(anchor, 250, 250, 4, 9)).toEqual({ x: 314, y: 314 });
  });
});

describe('text variant node preparation (Dqe / Oqe)', () => {
  it('creates N-1 sibling clones with cleared output and times reset to 1', () => {
    const prepared = prepareTextVariantNodes({ nodeId: 'source', count: 3, projectId: 'p1' });

    expect(prepared.nodeIds).toHaveLength(3);
    expect(prepared.nodeIds[0]).toBe('source');
    expect(driver.commitToHistory).toHaveBeenCalledTimes(1);

    const clones = driver.addNodesTransient.mock.calls[0][0] as RFNode<BaseNodeData>[];
    expect(clones).toHaveLength(2);
    clones.forEach((clone) => {
      expect(clone.type).toBe('ai-text');
      expect(clone.data.output).toBeUndefined();
      expect(clone.data.batchCount).toBe(1);
      expect(clone.data.textVariantGroupId).toBe(prepared.variantGroupId);
      expect(clone.data.prompt).toBe('写一段开场白');
      expect(clone.data.status).toBe('loading');
    });
    /* 官方 Nqe：第 1 个克隆在右一格，第 2 个换行 */
    expect(clones[0].position).toEqual({ x: 414, y: 200 });
    expect(clones[1].position).toEqual({ x: 100, y: 514 });
    /* 官方：同批结果与源节点**同名**（客户端不加序号；标题由服务端给，见官方 `Bb(r,"Image")`） */
    expect(clones[0].data.label).toBe(clones[1].data.label);

    /* 源节点：次数 = 总数，进入 loading */
    expect(driver.updateNodeDataTransient).toHaveBeenCalledWith('source', expect.objectContaining({
      batchCount: 3,
      status: 'loading',
    }));
  });

  it('copies the source input edges onto every clone (Oqe)', () => {
    prepareTextVariantNodes({ nodeId: 'source', count: 2, projectId: 'p1' });

    const changes = driver.onEdgesChange.mock.calls[0][0] as Array<{ type: string; item: Edge }>;
    const clones = driver.addNodesTransient.mock.calls[0][0] as RFNode<BaseNodeData>[];
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('add');
    expect(changes[0].item.source).toBe('upstream');
    expect(changes[0].item.target).toBe(clones[0].id);
    expect(changes[0].item.id).not.toBe('e-in');
  });

  it('refuses to spawn when the project changed', () => {
    driver.currentProjectId = 'other';
    expect(() => prepareTextVariantNodes({ nodeId: 'source', count: 2, projectId: 'p1' }))
      .toThrow('任务已被取消');
  });
});
