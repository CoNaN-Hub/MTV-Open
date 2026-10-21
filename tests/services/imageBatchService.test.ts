import type { Edge, Node } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaseNodeData } from '../../src/types';

interface TestStore {
  nodes: Node<BaseNodeData>[];
  edges: Edge[];
  currentProjectId: string | null;
  config?: { batchResultLayout?: 'pile' | 'variants' | 'spread' };
  commitToHistory: ReturnType<typeof vi.fn>;
  addNodesTransient: ReturnType<typeof vi.fn>;
  updateNodeDataTransient: ReturnType<typeof vi.fn>;
  updateNodeData: ReturnType<typeof vi.fn>;
  setSelectedNodeIds: ReturnType<typeof vi.fn>;
  pileSelectedNodes: ReturnType<typeof vi.fn>;
  recordOutputHistory: ReturnType<typeof vi.fn>;
  showToast: ReturnType<typeof vi.fn>;
  onEdgesChange: ReturnType<typeof vi.fn>;
}

let store: TestStore;
let generatedId = 0;

const persistMediaUrlToProjectData = vi.fn();

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: {
    getState: () => store,
  },
}));

vi.mock('../../src/store/store.utils', () => ({
  generateId: () => `generated-${++generatedId}`,
}));

vi.mock('../../src/services/fileService', () => ({
  persistMediaUrlToProjectData,
}));

function createStore(): TestStore {
  const sourceNode: Node<BaseNodeData> = {
    id: 'source',
    type: 'ai-image',
    position: { x: 100, y: 200 },
    /* ★ 这里必须给 `measured`，而且**故意与 `data.nodeWidth/nodeHeight` 不一致**：
       官方 SPREAD 步长用的是「节点**真实渲染尺寸**」`xn(s)/ko(s)`（= `width || measured || dimensions`），
       根本不读 `data.nodeWidth`。真实画布上这两者本来就不同（9333 实测 3:4 图卡：
       `data = 444×592`，渲染 = `250×333`）—— 用 data 就是用户报的「铺开间距对不上」那个 bug。
       ⇒ 这条断言同时锁住「步长 = 渲染尺寸 + 64」。 */
    measured: { width: 250, height: 333 },
    data: {
      type: 'ai-image',
      label: '原图节点',
      prompt: 'a cat',
      model: 'image-model',
      provider: 'general',
      batchCount: 4,
      nodeWidth: 280,
      nodeHeight: 220,
      status: 'idle',
      imageUrl: 'asset://old-image',
    },
  };

  const nextStore = {
    nodes: [sourceNode],
    edges: [] as Edge[],
    currentProjectId: 'project-a',
    commitToHistory: vi.fn(),
    addNodesTransient: vi.fn((nodes: Node<BaseNodeData>[]) => {
      nextStore.nodes = [...nextStore.nodes, ...nodes];
    }),
    updateNodeDataTransient: vi.fn((nodeId: string, patch: Partial<BaseNodeData>) => {
      nextStore.nodes = nextStore.nodes.map((node) => node.id === nodeId
        ? { ...node, data: { ...node.data, ...patch } }
        : node);
    }),
    updateNodeData: vi.fn((nodeId: string, patch: Partial<BaseNodeData>) => {
      nextStore.nodes = nextStore.nodes.map((node) => node.id === nodeId
        ? { ...node, data: { ...node.data, ...patch } }
        : node);
    }),
    setSelectedNodeIds: vi.fn(),
    pileSelectedNodes: vi.fn(),
    recordOutputHistory: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
    onEdgesChange: vi.fn((changes: { type: 'add'; item: Edge }[]) => {
      for (const change of changes) nextStore.edges = [...nextStore.edges, change.item];
    }),
  } satisfies TestStore;
  return nextStore;
}

beforeEach(() => {
  generatedId = 0;
  persistMediaUrlToProjectData.mockImplementation(async (url: string) => ({
    mediaUrl: url,
    sourceUrl: url,
  }));
  store = createStore();
});

describe('imageBatchService', () => {
  it('数量 4 时保留原节点，并立即按官方 Nqe 网格创建 3 个加载节点', async () => {
    const { prepareImageBatchNodes } = await import('../../src/services/imageBatchService');

    const prepared = prepareImageBatchNodes({
      nodeId: 'source',
      count: 4,
      projectId: 'project-a',
    });

    expect(prepared.nodeIds).toHaveLength(4);
    expect(prepared.nodeIds[0]).toBe('source');
    expect(store.nodes).toHaveLength(4);
    expect(store.commitToHistory).toHaveBeenCalledTimes(1);
    expect(store.nodes.map((node) => node.data.status)).toEqual([
      'loading',
      'loading',
      'loading',
      'loading',
    ]);
    /* 官方 `Nqe`（SPREAD 布局 @2792075）：`cols = ceil(sqrt(4)) = 2`，
       步长 = **节点真实渲染尺寸** + `bG`(64)（官方 `xn/ko`，@473754/@473878）
       ⇒ stepX = measured.width(250)+64 = 314、stepY = measured.height(333)+64 = 397；
       第 0 个（源节点）位置不变，克隆体按 (d%cols, floor(d/cols)) 排 ⇒
       d1=(414,200) d2=(100,597) d3=(414,597)。
       ⚠️ 若哪天又改回读 `data.nodeWidth/nodeHeight`（280/220）⇒ 步长会变成 344/284、这条就红 ✓ */
    expect(store.nodes.slice(1).map((node) => node.position)).toEqual([
      { x: 414, y: 200 },
      { x: 100, y: 597 },
      { x: 414, y: 597 },
    ]);
    expect(store.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(store.nodes.slice(1).map((node) => node.data.batchCount)).toEqual([1, 1, 1]);
    expect(store.nodes.slice(1).map((node) => node.data.imageUrl)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('批量克隆体继承源节点的「生成输入」入边（官方 fLe/mLe；用户报的「多张都没连参考卡 / 完全不参考」）', async () => {
    const { prepareImageBatchNodes } = await import('../../src/services/imageBatchService');
    /* 参考卡 → 源节点 的一条生成输入边（用户流程：参考卡右柄拖出菜单 → 图片生成） */
    store.edges = [{
      id: 'edge-ref',
      source: 'ref-card',
      sourceHandle: 'right',
      target: 'source',
      targetHandle: 'left',
      data: {},
    } as Edge];
    /* 加一条 purpose 不是 generation-input 的边：官方 `Gg` 明确**不**复制它 */
    store.edges.push({
      id: 'edge-chat',
      source: 'ref-card',
      sourceHandle: 'right',
      target: 'source',
      targetHandle: 'left',
      data: { purpose: 'chat-context' },
    } as Edge);

    prepareImageBatchNodes({ nodeId: 'source', count: 3, projectId: 'project-a' });

    const cloned = store.edges.filter((edge) => edge.id.startsWith('edge-generated-'));
    const targets = store.nodes.slice(1).map((node) => node.id);
    /* 每个新节点各得**一条**（那条 chat-context 不该被复制） */
    expect(targets).toHaveLength(2);
    expect(cloned).toHaveLength(2);
    expect(cloned.map((edge) => edge.target).sort()).toEqual([...targets].sort());
    for (const edge of cloned) {
      expect(edge.source).toBe('ref-card');
      expect(edge.sourceHandle).toBe('right');
      expect(edge.targetHandle).toBe('left');
    }
  });

  it('多变体：N 张全部落在源节点（不建兄弟节点），源节点显示第 1 张、options 收齐 N 个地址', async () => {
    const { applyImageBatchResults } = await import('../../src/services/imageBatchService');
    const urls = ['asset://v1', 'asset://v2', 'asset://v3', 'asset://v4'];
    persistMediaUrlToProjectData.mockImplementation(async (url: string) => ({
      mediaUrl: url, sourceUrl: url, filePath: `/tmp/${url.slice(8)}.png`,
    }));

    await applyImageBatchResults({
      nodeId: 'source',
      targetNodeIds: ['source'],
      variantsMode: true,
      batch: {
        requestedCount: 4,
        failedCount: 0,
        results: urls.map((url, index) => ({ url, width: 100 + index, height: 200 + index })),
      },
      projectId: 'project-a',
      prompt: 'a cat',
      imageSize: '2K',
      aspectRatio: '1:1',
    });

    /* 官方 `regenerationMode:"replace-source"` ⇒ 不新增兄弟节点 */
    expect(store.nodes).toHaveLength(1);
    const source = store.nodes[0];
    expect(source.data.imageUrl).toBe('asset://v1');
    expect(source.data.options).toEqual(urls);
    /* ★ 官方 `historyVariantCount`（`course-api-base-url-CGXqZmAy.js`@1040274 的 `onTaskComplete`）：
       由 `V0`（`page-DVqoHdTT.js`@1359987）读走，节点右键菜单「删除其他历史」的可见条件
       `V0(data) > 1` 就吃这个值 ⇒ 多变体收尾必须一并写入。 */
    expect(source.data.historyVariantCount).toBe(urls.length);
    /* 官方 `ZAe` 里 `historyVariantsHidden` 是**原样沿用**（正常节点没有该字段）⇒ 不能凭空写 false */
    expect('historyVariantsHidden' in source.data).toBe(false);
    /* N 张全部记在源节点名下 ⇒ 成为它的变体/版本 */
    expect(store.recordOutputHistory).toHaveBeenCalledTimes(4);
    for (const call of store.recordOutputHistory.mock.calls) {
      expect(call[0]).toBe('source');
      expect(call[1].nodeId).toBe('source');
    }
    expect(store.recordOutputHistory.mock.calls.map((call) => call[1].params.batchIndex)).toEqual([1, 2, 3, 4]);
    expect(store.showToast).toHaveBeenCalledWith('批量生成完成：共 4 张', 'success');
  });

  it('把成功结果依次回填，并将缺少结果的加载节点标记为失败', async () => {
    const { applyImageBatchResults, prepareImageBatchNodes } = await import('../../src/services/imageBatchService');
    const prepared = prepareImageBatchNodes({
      nodeId: 'source',
      count: 4,
      projectId: 'project-a',
    });

    await applyImageBatchResults({
      nodeId: 'source',
      targetNodeIds: prepared.nodeIds,
      batch: {
        requestedCount: 4,
        results: [
          { url: 'https://example.com/1.png', width: 1024, height: 1024 },
          { url: 'https://example.com/2.png', width: 1024, height: 1024 },
        ],
        failedCount: 2,
      },
      projectId: 'project-a',
      prompt: 'a cat',
      imageSize: '1K',
      aspectRatio: '1:1',
    });

    expect(store.nodes.map((node) => node.data.status)).toEqual([
      'success',
      'success',
      'error',
      'error',
    ]);
    expect(store.nodes[0].data.imageUrl).toBe('https://example.com/1.png');
    expect(store.nodes[1].data.imageUrl).toBe('https://example.com/2.png');
    expect(store.nodes[2].data.error).toContain('未返回结果');
    expect(store.recordOutputHistory).toHaveBeenCalledTimes(2);
    expect(store.showToast).toHaveBeenCalledWith('批量生成完成：成功 2/4 张', 'error');
  });

  it('stores inline batch results as local project references only', async () => {
    const { applyImageBatchResults } = await import('../../src/services/imageBatchService');
    const inline = 'data:image/png;base64,AQID';
    persistMediaUrlToProjectData.mockResolvedValueOnce({
      filePath: '/project/data/原图节点-1.png',
      assetUrl: 'asset:///project/data/原图节点-1.png',
      mediaUrl: 'asset:///project/data/原图节点-1.png',
      sourceUrl: 'asset:///project/data/原图节点-1.png',
    });

    await applyImageBatchResults({
      nodeId: 'source',
      targetNodeIds: ['source'],
      batch: {
        requestedCount: 1,
        failedCount: 0,
        results: [{ url: inline, width: 10, height: 10 }],
      },
      projectId: 'project-a',
      prompt: 'a cat',
      imageSize: '2K',
      aspectRatio: '1:1',
    });

    expect(JSON.stringify(store.nodes[0].data)).not.toContain('data:image');
    expect(store.nodes[0].data).toMatchObject({
      imageUrl: 'asset:///project/data/原图节点-1.png',
      sourceUrl: 'asset:///project/data/原图节点-1.png',
      thumbnailUrl: 'asset:///project/data/原图节点-1.png',
      output: 'asset:///project/data/原图节点-1.png',
      filePath: '/project/data/原图节点-1.png',
    });
    expect(JSON.stringify(store.recordOutputHistory.mock.calls[0][1])).not.toContain('data:image');
  });
});
