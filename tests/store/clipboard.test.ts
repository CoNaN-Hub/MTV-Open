import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import type { BaseNodeData } from '../../src/types';

const fileMocks = vi.hoisted(() => ({
  copyFileToProjectData: vi.fn(),
  moveToUndoTrash: vi.fn(async () => undefined),
}));

vi.mock('../../src/services/fileService', () => ({
  ...fileMocks,
  setBaseDataDir: vi.fn(),
  syncAuthorizedDirectories: vi.fn(async () => undefined),
}));

vi.mock('../../src/services/pollManager', () => ({
  cancelNodePolling: vi.fn(),
  clearProjectTasks: vi.fn(),
  resumePendingTasks: vi.fn(async () => undefined),
}));

import { useAppStore } from '../../src/store/useAppStore';

function node(id: string): Node<BaseNodeData> {
  return {
    id,
    type: 'ai-text',
    position: { x: 0, y: 0 },
    data: { label: id, type: 'ai-text', status: 'success' },
  };
}

function mediaNode(id: string, projectId: string): Node<BaseNodeData> {
  return {
    id,
    type: 'ai-image',
    position: { x: 0, y: 0 },
    data: {
      label: id,
      type: 'ai-image',
      status: 'success',
      filePath: `/data/${projectId}/original.png`,
      relativePath: 'original.png',
      assetId: 'asset-from-source-project',
      imageUrl: `asset:///data/${projectId}/original.png`,
      thumbnailUrl: `asset:///data/${projectId}/original.png`,
    },
  };
}

function directorNode(
  id: string,
  runtime: 'lightweight-web' | 'blender',
  status: 'loading' | 'error',
): Node<BaseNodeData> {
  return {
    id,
    type: 'ai-director',
    position: { x: 0, y: 0 },
    data: {
      label: id,
      type: 'ai-director',
      role: 'source',
      status,
      error: '源节点的瞬时错误',
      directorRuntimeKind: runtime,
      directorInstanceId: id,
      directorStatus: 'ready',
      directorCaptureUrls: ['asset:///director/frame-a.png'],
      directorCaptureFilePaths: ['/data/project-a/frame-a.png'],
      imageUrl: 'asset:///director/frame-a.png',
      thumbnailUrl: 'asset:///director/frame-a.png',
      videoUrl: 'asset:///director/reference.mp4',
      filePath: '/data/project-a/reference.mp4',
    },
  };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  fileMocks.copyFileToProjectData.mockReset();
  fileMocks.copyFileToProjectData.mockImplementation(async (_source: string, projectId: string) => ({
    filePath: `/data/${projectId}/copied.png`,
    assetUrl: `asset:///data/${projectId}/copied.png`,
    fileName: 'copied.png',
  }));
});

describe('canvas clipboard', () => {
  it('keeps incoming connections without copying outgoing external connections', () => {
    const incomingEdge: Edge = {
      id: 'edge-source-copy',
      source: 'source',
      target: 'copy',
      sourceHandle: 'output',
      targetHandle: 'prompt',
      type: 'smoothstep',
      animated: true,
      data: { channel: 'reference' },
    };
    const outgoingEdge: Edge = {
      id: 'edge-copy-downstream',
      source: 'copy',
      target: 'downstream',
    };
    useAppStore.setState({
      nodes: [node('source'), node('copy'), node('downstream')],
      edges: [incomingEdge, outgoingEdge],
      selectedNodeIds: ['copy'],
      showToast: vi.fn(),
    });

    useAppStore.getState().copySelectedNodes();
    useAppStore.getState().pasteNodes({ x: 30, y: 30 });

    const pastedNode = useAppStore.getState().nodes.find((item) => (
      !['source', 'copy', 'downstream'].includes(item.id)
    ));
    expect(pastedNode).toBeDefined();

    const pastedIncomingEdge = useAppStore.getState().edges.find((edge) => (
      edge.source === 'source' && edge.target === pastedNode?.id
    ));
    expect(pastedIncomingEdge).toMatchObject({
      sourceHandle: 'output',
      targetHandle: 'prompt',
      type: 'smoothstep',
      animated: true,
      data: { channel: 'reference' },
    });
    expect(useAppStore.getState().edges).not.toContainEqual(expect.objectContaining({
      source: pastedNode?.id,
      target: 'downstream',
    }));
  });

  it('remaps both ends of connections between copied nodes', () => {
    useAppStore.setState({
      nodes: [node('first'), node('second')],
      edges: [{ id: 'edge-first-second', source: 'first', target: 'second' }],
      selectedNodeIds: ['first', 'second'],
      showToast: vi.fn(),
    });

    useAppStore.getState().copySelectedNodes();
    useAppStore.getState().pasteNodes({ x: 30, y: 30 });

    const pastedIds = useAppStore.getState().nodes
      .filter((item) => !['first', 'second'].includes(item.id))
      .map((item) => item.id);
    const pastedEdges = useAppStore.getState().edges.filter((edge) => (
      pastedIds.includes(edge.source) && pastedIds.includes(edge.target)
    ));
    expect(pastedEdges).toHaveLength(1);
  });

  it('copies director outputs but creates an independent runtime instance', () => {
    const source = directorNode('director-source', 'blender', 'error');
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [source],
      edges: [],
      selectedNodeIds: [source.id],
      showToast: vi.fn(),
    });

    useAppStore.getState().copySelectedNodes();
    useAppStore.getState().pasteNodes({ x: 30, y: 30 });

    const pasted = useAppStore.getState().nodes.find((item) => item.id !== source.id);
    expect(pasted).toBeDefined();
    expect(pasted?.data).toMatchObject({
      directorRuntimeKind: 'blender',
      directorInstanceId: pasted?.id,
      directorStatus: 'idle',
      status: 'success',
      directorCaptureUrls: ['asset:///director/frame-a.png'],
      directorCaptureFilePaths: ['/data/project-a/frame-a.png'],
      imageUrl: 'asset:///director/frame-a.png',
      videoUrl: 'asset:///director/reference.mp4',
      filePath: '/data/project-a/reference.mp4',
    });
    expect(pasted?.data.error).toBeUndefined();
    expect(pasted?.data.directorCaptureUrls).not.toBe(source.data.directorCaptureUrls);
    expect(useAppStore.getState().directorDeskRuntimeRequest).toBeNull();
  });
});

describe('control-drag duplication', () => {
  it('does not publish a late copy into a different project', async () => {
    let finish!: (value: unknown) => void;
    fileMocks.copyFileToProjectData.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    useAppStore.setState({ currentProjectId: 'a', nodes: [mediaNode('source', 'a')], showToast: vi.fn() });
    const pending = useAppStore.getState().duplicateNode('source');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    useAppStore.setState({ currentProjectId: 'b', nodes: [] });
    finish({ filePath: '/data/a/copy.png', assetUrl: 'asset:///data/a/copy.png' });
    await pending;
    expect(useAppStore.getState().nodes).toHaveLength(0);
    expect(fileMocks.moveToUndoTrash).toHaveBeenCalledWith('/data/a/copy.png');
  });

  it('does not replace a newly generated result while an older copy is pending', async () => {
    let finish!: (value: unknown) => void;
    fileMocks.copyFileToProjectData.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    useAppStore.setState({ currentProjectId: 'a', nodes: [mediaNode('source', 'a')], showToast: vi.fn() });
    const pending = useAppStore.getState().duplicateNode('source');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    useAppStore.getState().updateNodeData('source', { filePath: '/data/a/new.png', imageUrl: 'asset:///data/a/new.png' });
    finish({ filePath: '/data/a/copy.png', assetUrl: 'asset:///data/a/copy.png' });
    await pending;
    expect(useAppStore.getState().nodes).toHaveLength(1);
    expect(useAppStore.getState().nodes[0].data.filePath).toBe('/data/a/new.png');
  });

  it('keeps incoming connections on both nodes without inheriting outgoing connections', () => {
    const incomingEdge: Edge = {
      id: 'edge-source-dragged',
      source: 'source',
      target: 'dragged',
      sourceHandle: 'output',
      targetHandle: 'prompt',
      type: 'smoothstep',
      animated: true,
      data: { channel: 'reference' },
    };
    useAppStore.setState({
      nodes: [node('source'), node('dragged'), node('downstream')],
      edges: [
        incomingEdge,
        { id: 'edge-dragged-downstream', source: 'dragged', target: 'downstream' },
      ],
    });

    useAppStore.getState().duplicateNode('dragged');

    const stationaryClone = useAppStore.getState().nodes.find((item) => (
      !['source', 'dragged', 'downstream'].includes(item.id)
    ));
    expect(stationaryClone).toBeDefined();

    const incomingEdges = useAppStore.getState().edges.filter((edge) => edge.source === 'source');
    expect(incomingEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: stationaryClone?.id }),
      expect.objectContaining({
        target: 'dragged',
        sourceHandle: 'output',
        targetHandle: 'prompt',
        type: 'smoothstep',
        animated: true,
        data: { channel: 'reference' },
      }),
    ]));
    expect(useAppStore.getState().edges).not.toContainEqual(expect.objectContaining({
      source: 'dragged',
      target: 'downstream',
    }));
    expect(useAppStore.getState().edges).toContainEqual(expect.objectContaining({
      source: stationaryClone?.id,
      target: 'downstream',
    }));
  });

  it('keeps director media while resetting the cloned runtime session', () => {
    const source = directorNode('director-dragged', 'lightweight-web', 'loading');
    useAppStore.setState({ nodes: [source], edges: [] });

    useAppStore.getState().duplicateNode(source.id);

    const clone = useAppStore.getState().nodes.find((item) => item.id !== source.id);
    expect(clone).toBeDefined();
    expect(clone?.data).toMatchObject({
      directorRuntimeKind: 'lightweight-web',
      directorInstanceId: clone?.id,
      directorStatus: 'idle',
      status: 'success',
      directorCaptureUrls: ['asset:///director/frame-a.png'],
      imageUrl: 'asset:///director/frame-a.png',
      videoUrl: 'asset:///director/reference.mp4',
    });
    expect(clone?.data.error).toBeUndefined();
    expect(clone?.data.directorCaptureUrls).not.toBe(source.data.directorCaptureUrls);
    expect(useAppStore.getState().directorDeskRuntimeRequest).toBeNull();
  });
});

describe('paste anchor (落点)', () => {
  /* 事故（用户实测）：「把图卡复制粘贴到其他画布，粘贴不过去」——
     `pasteNodes(_position)` 把参数丢了，副本按**源卡片的绝对坐标**落：
     跨画布粘贴时常整个落在新画布视口外（看不见）；同一画布连粘几次则**逐像素重叠**
     （实测目标画布里三组卡片坐标完全相同）。 */
  const at = (id: string, x: number, y: number): Node<BaseNodeData> => ({
    ...node(id),
    position: { x, y },
  });

  it('以复制内容的包围盒左上角对齐锚点，组内相对布局保持不变', () => {
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [at('a', 1000, 2000), at('b', 1200, 2400)],
      edges: [],
      selectedNodeIds: ['a', 'b'],
      showToast: vi.fn(),
    });
    useAppStore.getState().copySelectedNodes();

    useAppStore.setState({ currentProjectId: 'project-b', nodes: [], edges: [] });
    useAppStore.getState().pasteNodes({ x: -500, y: 700 });

    const pasted = useAppStore.getState().nodes;
    expect(pasted).toHaveLength(2);
    const xs = pasted.map((n) => n.position.x);
    const ys = pasted.map((n) => n.position.y);
    expect(Math.min(...xs)).toBe(-500);
    expect(Math.min(...ys)).toBe(700);
    // 相对布局（dx=200 / dy=400）原样保留 —— 老实现给每个节点各错 30px，整组会被拉斜
    expect(Math.max(...xs) - Math.min(...xs)).toBe(200);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(400);
  });

  it('阶梯 = 第几次 × 40 屏幕 px ÷ zoom（TapNow 同款），连粘不再逐像素重叠', () => {
    /* 参考实现 TapNow `page-DPdEgTS0.js` 的 `pasteCopiedNodes`：
       `const J = P * 40 / F;` ← `P = pasteIteration`、`F = getZoom()`
       ⇒ 每次粘贴整组右下挪 **40 个屏幕 px**（除以 zoom 换算成流坐标），
         所以任何缩放档下阶梯的视觉大小都一样；复制时归零。 */
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [at('a', 1000, 2000)],
      edges: [],
      selectedNodeIds: ['a'],
      showToast: vi.fn(),
    });
    useAppStore.getState().copySelectedNodes();

    useAppStore.setState({ currentProjectId: 'project-b', nodes: [], edges: [] });
    useAppStore.getState().pasteNodes({ x: 0, y: 0 }, 1); // 第 0 次 ⇒ 不偏移
    useAppStore.getState().pasteNodes({ x: 0, y: 0 }, 1); // 第 1 次 ⇒ +40 流 = 40 屏幕
    useAppStore.getState().pasteNodes({ x: 0, y: 0 }, 0.5); // 第 2 次 ⇒ 2×40/0.5 = +160 流

    const positions = useAppStore.getState().nodes.map((n) => `${n.position.x},${n.position.y}`);
    expect(positions).toEqual(['0,0', '40,40', '160,160']);
    expect(new Set(positions).size).toBe(positions.length);

    /* 复制 ⇒ 阶梯归零（TapNow 的 `resetPasteIteration()`） */
    useAppStore.getState().copySelectedNodes();
    expect(useAppStore.getState().clipboard.pasteIteration).toBe(0);
  });
});

describe('粘贴连线（跨画布也要连上）', () => {
  /* 事故（用户实测）：「跨项复制粘贴后节点连接线怎么没加上」。
     原来 `pasteNodes` 拿 **`get().edges`（当前/目标画布的边）** 去 filter `idMap.has(edge.target)`：
       · 目标画布里根本没有源画布的边 ⇒ 跨画布粘贴永远是空集 ✗
       · 而且 `idMap` 的 key 是**源节点 id**、value 才是新卡 id，判据本身就写反了 ✗
     现在照 TapNow `she(copiedEdges, idMap, edges)`：**从剪贴板快照的边**重建。
     ⚠️ 上面两个老用例之所以没抓到，是因为它们粘贴前**没清 `edges`**（等于同画布粘贴），
        所以走的是 `get().edges` 里那份旧边。这里必须显式清空来模拟"另一个画布"。 */
  const at = (id: string, x = 0, y = 0): Node<BaseNodeData> => ({ ...node(id), position: { x, y } });

  it('选区内部连线的两端都重映射到新卡（跨画布）', async () => {
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [at('a', 0, 0), at('b', 300, 0)],
      edges: [{
        id: 'edge-a-b',
        source: 'a',
        target: 'b',
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'smoothstep',
      }],
      selectedNodeIds: ['a', 'b'],
      showToast: vi.fn(),
    });
    useAppStore.getState().copySelectedNodes();

    // 切到"另一个画布"：节点与连线都换掉（关键：目标画布没有源画布的边）
    useAppStore.setState({ currentProjectId: 'project-b', nodes: [], edges: [] });
    await useAppStore.getState().pasteNodes({ x: 0, y: 0 });

    const { nodes, edges } = useAppStore.getState();
    const ids = nodes.map((n) => n.id);
    expect(ids).toHaveLength(2);
    const pastedEdges = edges.filter((e) => ids.includes(e.source) && ids.includes(e.target));
    expect(pastedEdges).toHaveLength(1);
    // 句柄 / 类型也一起带过来，否则连线会掉到默认句柄上（视觉上像"没连上"）
    expect(pastedEdges[0]).toMatchObject({
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'smoothstep',
    });
    // 边 id 必须是新的，不能和源画布的 id 撞（否则目标画布上会串线）
    expect(pastedEdges[0].id).not.toBe('edge-a-b');
  });

  it('同画布粘贴：外部连进来的边指到副本上（上游原卡还在）', async () => {
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [at('upstream'), at('copy')],
      edges: [{ id: 'edge-up-copy', source: 'upstream', target: 'copy', targetHandle: 'left' }],
      selectedNodeIds: ['copy'],
      showToast: vi.fn(),
    });
    useAppStore.getState().copySelectedNodes();
    await useAppStore.getState().pasteNodes({ x: 0, y: 0 });

    const nodes = useAppStore.getState().nodes;
    const pasted = nodes.find((n) => n.id !== 'upstream' && n.id !== 'copy');
    expect(pasted).toBeDefined();
    const incoming = useAppStore.getState().edges.filter((e) => e.target === pasted?.id);
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ source: 'upstream', targetHandle: 'left' });
    // 原卡那条边原封不动
    expect(useAppStore.getState().edges).toContainEqual(expect.objectContaining({
      id: 'edge-up-copy', source: 'upstream', target: 'copy',
    }));
  });

  it('跨画布粘贴不留下指向"不存在的卡"的悬空连线', async () => {
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [at('upstream'), at('copy')],
      edges: [{ id: 'edge-up-copy', source: 'upstream', target: 'copy', targetHandle: 'left' }],
      selectedNodeIds: ['copy'],
      showToast: vi.fn(),
    });
    useAppStore.getState().copySelectedNodes();

    // 目标画布上没有 `upstream` ⇒ 这条连线带过去也画不出来，不该落库
    useAppStore.setState({ currentProjectId: 'project-b', nodes: [], edges: [] });
    await useAppStore.getState().pasteNodes({ x: 0, y: 0 });

    expect(useAppStore.getState().nodes).toHaveLength(1);
    expect(useAppStore.getState().edges).toHaveLength(0);
  });

  it('只从选区连出去的连线（源端被复制、目标端没复制）不跟着粘贴', async () => {
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [at('picked'), at('downstream')],
      edges: [{ id: 'edge-picked-down', source: 'picked', target: 'downstream' }],
      selectedNodeIds: ['picked'],
      showToast: vi.fn(),
    });
    useAppStore.getState().copySelectedNodes();
    expect(useAppStore.getState().clipboard.edges).toHaveLength(0);

    useAppStore.setState({ currentProjectId: 'project-b', nodes: [], edges: [] });
    await useAppStore.getState().pasteNodes({ x: 0, y: 0 });

    expect(useAppStore.getState().nodes).toHaveLength(1);
    expect(useAppStore.getState().edges).toHaveLength(0);
  });
});

describe('cross-project paste (跨项目粘贴)', () => {  it('把媒体文件复制到目标项目，副本不再引用源项目', async () => {
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [mediaNode('media', 'project-a')],
      edges: [],
      selectedNodeIds: ['media'],
      showToast: vi.fn(),
    });
    useAppStore.getState().copySelectedNodes();

    useAppStore.setState({ currentProjectId: 'project-b', nodes: [], edges: [] });
    useAppStore.getState().pasteNodes({ x: 30, y: 30 });

    await vi.waitFor(() => expect(fileMocks.copyFileToProjectData).toHaveBeenCalledTimes(1));
    expect(fileMocks.copyFileToProjectData)
      .toHaveBeenCalledWith('/data/project-a/original.png', 'project-b', { redactErrors: true });
    await vi.waitFor(() => {
      expect(useAppStore.getState().nodes[0].data.filePath).toBe('/data/project-b/copied.png');
    });

    const pasted = useAppStore.getState().nodes[0];
    // 源项目的资产身份必须清掉，否则保存时会把副本认成源项目那份资产
    expect(pasted.data.assetId).toBeUndefined();
    expect(pasted.data.relativePath).toBeUndefined();
    expect(pasted.data.imageUrl).toBe('asset:///data/project-b/copied.png');
    expect(pasted.data.thumbnailUrl).toBe('asset:///data/project-b/copied.png');
  });

  it('复制失败时不插入共享源文件的副本', async () => {
    fileMocks.copyFileToProjectData.mockResolvedValue(null);
    const showToast = vi.fn();
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [mediaNode('media', 'project-a')],
      edges: [],
      selectedNodeIds: ['media'],
      showToast,
    });
    useAppStore.getState().copySelectedNodes();

    useAppStore.setState({ currentProjectId: 'project-b', nodes: [], edges: [], showToast });
    await useAppStore.getState().pasteNodes({ x: 30, y: 30 });
    expect(useAppStore.getState().nodes).toHaveLength(0);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('复制失败'), 'error');
  });

  it('同项目内粘贴也复制独立文件', async () => {
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [mediaNode('media', 'project-a')],
      edges: [],
      selectedNodeIds: ['media'],
      showToast: vi.fn(),
    });
    useAppStore.getState().copySelectedNodes();
    await useAppStore.getState().pasteNodes({ x: 30, y: 30 });
    expect(fileMocks.copyFileToProjectData).toHaveBeenCalledTimes(1);
    const pasted = useAppStore.getState().nodes.find((item) => item.id !== 'media');
    expect(pasted?.data.filePath).toBe('/data/project-a/copied.png');
  });

  it('复制后编辑源节点不会改到剪贴板内容', () => {
    useAppStore.setState({
      currentProjectId: 'project-a',
      nodes: [node('text')],
      edges: [],
      selectedNodeIds: ['text'],
      showToast: vi.fn(),
    });
    useAppStore.getState().copySelectedNodes();
    useAppStore.getState().updateNodeData('text', { label: '改过的标题' });

    expect(useAppStore.getState().clipboard.nodes[0].data.label).toBe('text');
  });
});
