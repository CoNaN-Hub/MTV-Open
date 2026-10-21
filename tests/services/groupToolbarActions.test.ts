import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `services/groupToolbarActions.ts` —— 官方 group 浮动工具条那几个动作的 MTV 实现。
 *
 * 这里接的是**从 `GroupNode` 内联小钮搬出来**的那条语义（原测试在
 * `tests/components/nodeCriticalInteractions.test.tsx` 里断言的是内联钮；那个钮已按官方
 * 删掉 —— 官方的「整组执行」只在工具条里，所以语义移到这里按现行实现验）。
 *
 * 官方依据：`zoom-slider-3ZcFvYQO.js`@char2883801 group 工具条第 2 组
 *   `[整组执行(text=common.runAll/common.cancel) + 创建模板 + 解组(text=common.ungroup)]`
 * ⚠️ 官方这三个按钮的**真实行为未被实测**（`taskbar-official-report.md` §4 第 7 条）
 *   ⇒ MTV 接的是**自己的等价动作**（`batchExecuteNodes` / `ungroupSelectedNodes`），不臆造官方语义。
 */
const mocks = vi.hoisted(() => ({
  batchExecuteNodes: vi.fn(async () => ({ ok: 1, fail: 0 })),
  /* 宫格 = 官方 `_Bl` 逐字实现：返回 `{nodes, groupSize}` */
  officialSquareGridLayout: vi.fn(() => ({
    nodes: [] as Array<{ id: string; position: { x: number; y: number } }>,
    groupSize: { width: 0, height: 0 },
  })),
  /* 水平 = 官方 `bBl`（dagre）逐字实现：返回 `{nodes, edges, groupSize}` */
  officialTreeLayout: vi.fn(() => ({
    nodes: [] as Array<{ id: string; position: { x: number; y: number } }>,
    edges: [] as Array<{ id: string; sourceHandle: string; targetHandle: string }>,
    groupSize: { width: 0, height: 0 },
  })),
  downloadNodesByIds: vi.fn(async () => true),
  state: {
    nodes: [] as unknown[],
    edges: [] as unknown[],
    selectedNodeIds: [] as string[],
    currentProjectId: 'project-a',
    commitToHistory: vi.fn(),
    updateNodeDataTransient: vi.fn(),
    recordOutputHistory: vi.fn(),
    setSelectedNodeIds: vi.fn(),
    setEdges: vi.fn(),
    setNodes: vi.fn(),
    ungroupSelectedNodes: vi.fn(),
  },
}));

vi.mock('../../src/utils/batchExecute', () => ({ batchExecuteNodes: mocks.batchExecuteNodes }));
/* 宫格 = **官方 `_Bl` 逐字实现**、水平 = **官方 `bBl`（dagre）逐字实现**（都在 utils/officialGroupLayout）
   ⇒ 一并 mock 掉，以便断言**传进去的 nodes**（验证 parentId 被抹掉、用的是相对坐标）。 */
vi.mock('../../src/utils/officialGroupLayout', () => ({
  officialSquareGridLayout: mocks.officialSquareGridLayout,
  officialTreeLayout: mocks.officialTreeLayout,
}));
/* 掐断 `selectionToolbarActions` 的重依赖链（fileService / tauri 插件 …）——只用这一个函数 */
vi.mock('../../src/services/selectionToolbarActions', () => ({
  downloadNodesByIds: mocks.downloadNodesByIds,
}));
vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: { getState: () => mocks.state },
}));

import {
  canDownloadGroup,
  downloadGroupChildren,
  groupChildNodes,
  layoutGroupChildren,
  runGroupChildren,
  ungroupGroupNode,
} from '../../src/services/groupToolbarActions';

function node(id: string, parentId?: string, data: Record<string, unknown> = {}) {
  return { id, type: 'ai-image', parentId, position: { x: 0, y: 0 }, data };
}

beforeEach(() => {
  mocks.batchExecuteNodes.mockClear();
  mocks.officialSquareGridLayout.mockClear();
  mocks.officialTreeLayout.mockClear();
  mocks.state.setNodes.mockClear();
  mocks.downloadNodesByIds.mockClear();
  mocks.state.selectedNodeIds = [];
  mocks.state.commitToHistory.mockClear();
  mocks.state.setSelectedNodeIds.mockClear();
  mocks.state.ungroupSelectedNodes.mockClear();
  mocks.state.nodes = [
    node('group-a'),
    node('direct', 'group-a', { imageUrl: 'a.png' }),
    node('nested', 'direct', { imageUrl: 'n.png' }),
    node('external', 'group-b', { imageUrl: 'e.png' }),
  ];
  mocks.state.edges = [];
});

describe('groupToolbarActions（官方 group 工具条的动作层）', () => {
  it('groupChildNodes 只取**直接**子节点（孙节点与别人的子节点都不算）', () => {
    expect(groupChildNodes('group-a').map((n) => n.id)).toEqual(['direct']);
  });

  it('整组执行 = batchExecuteNodes(直接子节点) + 转发 store 的批量上下文', async () => {
    const res = await runGroupChildren('group-a');
    expect(res).toEqual({ ok: 1, fail: 0 });
    expect(mocks.batchExecuteNodes).toHaveBeenCalledWith(
      ['direct'],
      mocks.state.nodes,
      mocks.state.edges,
      expect.objectContaining({ currentProjectId: 'project-a' }),
    );
  });

  it('空分组不触发批量执行（官方：没成员就没什么可跑）', async () => {
    const res = await runGroupChildren('group-without-children');
    expect(res).toEqual({ ok: 0, fail: 0 });
    expect(mocks.batchExecuteNodes).not.toHaveBeenCalled();
  });

  it('解组：分组已在选区里时直接用当前选区解组', () => {
    mocks.state.selectedNodeIds = ['group-a'];
    ungroupGroupNode('group-a');
    expect(mocks.state.setSelectedNodeIds).not.toHaveBeenCalled();
    expect(mocks.state.ungroupSelectedNodes).toHaveBeenCalledTimes(1);
  });

  it('解组：选区里没有该分组时（多选含分组）先把选区聚焦到它', () => {
    mocks.state.selectedNodeIds = ['other'];
    ungroupGroupNode('group-a');
    expect(mocks.state.setSelectedNodeIds).toHaveBeenCalledWith(['group-a'], 'direct');
    expect(mocks.state.ungroupSelectedNodes).toHaveBeenCalledTimes(1);
  });

  it('宫格布局：走官方 `_Bl` 逐字实现，传**抹掉 parentId** 的直接成员，并写回位置 + 分组尺寸', () => {
    /* 布局至少要 2 个**直接**成员 ⇒ 补一个（默认 fixture 只有 1 个直接子节点） */
    mocks.state.nodes = [
      node('group-a'),
      node('direct', 'group-a', { imageUrl: 'a.png' }),
      node('direct-2', 'group-a', { imageUrl: 'b.png' }),
      node('nested', 'direct', { imageUrl: 'n.png' }),
      node('external', 'group-b', { imageUrl: 'e.png' }),
    ];
    mocks.officialSquareGridLayout.mockReturnValueOnce({
      nodes: [{ id: 'direct', position: { x: 5, y: 6 } }],
      groupSize: { width: 700, height: 900 },
    } as never);
    const ok = layoutGroupChildren('grid', 'group-a');

    expect(ok).toBe(true);
    const call = mocks.officialSquareGridLayout.mock.calls[0] as unknown as [Array<{ id: string; parentId?: string }>];
    /* 只把**直接**成员交出去（孙节点 / 别的分组的子节点都不进） */
    expect(call[0].map((n) => n.id)).toEqual(['direct', 'direct-2']);
    /* ★ 核心：`parentId` 必须被抹掉 —— 官方**分组**布局走的是 `getChildNodes()`；
       若复用 `applyOfficialLayoutToNodes`，它内部会先过 `canLayoutSelection`
       （= 官方**多选工具栏**的门 `I0`，要求 `!parentId`）⇒ 永远返回 false，
       表现就是「点宫格/水平没任何反应」（用户实测）。 */
    expect(call[0].every((n) => n.parentId === undefined)).toBe(true);
    expect(mocks.state.setNodes).toHaveBeenCalledTimes(1);
    /* ★ 官方调用点会把 `groupSize` 写进分组节点（`changes:{width,height,measured}`）*/
    const setNodesArg = mocks.state.setNodes.mock.calls[0][0] as Array<{ id: string; width?: number; height?: number }>;
    const group = setNodesArg.find((n) => n.id === 'group-a');
    expect(group?.width).toBe(700);
    expect(group?.height).toBe(900);
  });

  it('水平布局：位置走 MTV 既有算法（官方那支是 dagre），尺寸按官方 `bBl` 公式', () => {
    mocks.state.nodes = [
      node('group-a'),
      node('direct', 'group-a'), node('direct-2', 'group-a'),
    ];
    mocks.officialTreeLayout.mockReturnValueOnce({
      nodes: [{ id: 'direct', position: { x: 1, y: 2 } }],
      edges: [{ id: 'edge-1', sourceHandle: 'right', targetHandle: 'left' }],
      groupSize: { width: 333, height: 444 },
    } as never);
    mocks.state.edges = [{ id: 'edge-1', source: 'direct', target: 'direct-2', sourceHandle: 'x', targetHandle: 'y' }];

    expect(layoutGroupChildren('horizontal', 'group-a')).toBe(true);
    const call = mocks.officialTreeLayout.mock.calls[0] as unknown as [
      Array<{ id: string; parentId?: string }>,
      Array<{ id: string; source: string; target: string }>,
    ];
    /* 同样只把**直接**成员 + 组内边交出去，且成员必须已抹掉 parentId */
    expect(call[0].map((n) => n.id)).toEqual(['direct', 'direct-2']);
    expect(call[0].every((n) => n.parentId === undefined)).toBe(true);
    expect(call[1].map((e) => e.id)).toEqual(['edge-1']);
    const setNodesArg = mocks.state.setNodes.mock.calls[0][0] as Array<{ id: string; width?: number; height?: number }>;
    expect(setNodesArg.find((n) => n.id === 'group-a')?.width).toBe(333);
    expect(setNodesArg.find((n) => n.id === 'group-a')?.height).toBe(444);
    /* ★ 官方同一处还会**回写组内边的 handle**（`sourceHandle:"right" / targetHandle:"left"`） */
    const setEdgesArg = mocks.state.setEdges.mock.calls[0][0] as Array<{ id: string; sourceHandle?: string; targetHandle?: string }>;
    expect(setEdgesArg.find((e) => e.id === 'edge-1')?.sourceHandle).toBe('right');
    expect(setEdgesArg.find((e) => e.id === 'edge-1')?.targetHandle).toBe('left');
  });

  it('布局：直接成员不足 2 个 / 算法没给位置时不写库', () => {
    /* 默认 fixture 只有 1 个直接成员（`nested` 是孙节点、`external` 属于别的分组） */
    expect(layoutGroupChildren('grid', 'group-a')).toBe(false);
    expect(mocks.state.setNodes).not.toHaveBeenCalled();

    mocks.state.nodes = [
      node('group-a'),
      node('a', 'group-a'), node('b', 'group-a'),
    ];
    mocks.officialSquareGridLayout.mockReturnValueOnce({ nodes: [], groupSize: { width: 0, height: 0 } } as never);
    expect(layoutGroupChildren('grid', 'group-a')).toBe(false);
    expect(mocks.state.setNodes).not.toHaveBeenCalled();
  });

  it('下载下的是**组内成员**的内容', async () => {
    await downloadGroupChildren('group-a');
    expect(mocks.downloadNodesByIds).toHaveBeenCalledWith(['direct']);
  });

  it('canDownloadGroup：组内有可下载内容才为真', () => {
    expect(canDownloadGroup('group-a')).toBe(true);
    mocks.state.nodes = [node('group-a'), node('direct', 'group-a', {})];
    expect(canDownloadGroup('group-a')).toBe(false);
  });
});




