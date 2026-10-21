/**
 * 「图片往返」画布侧回归测试。
 *
 * 覆盖三件容易悄悄坏掉的事：
 *   1. 源图解析必须**优先本地原图**、把资产协议 URL 还原成路径，并且**不把后端取不到的 URL 传下去**；
 *   2. 轮询只在 `completed` 成功返回，`expired` / `cancelled` 必须抛错，否则会拿空结果去建卡；
 *   3. 建出来的卡必须与「导入本地图片」**同构**（`source-image` / `role:'source'` / imageUrl+filePath），
 *      并且带一条 源卡→新卡 的派生边 —— 这是需求里「关联到源卡片、显示为下游版本」的落点。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  copyFileToProjectData: vi.fn(),
  computeImageNodeDimensions: vi.fn(),
  addNodeWithEdge: vi.fn(),
  addNode: vi.fn(),
  showToast: vi.fn(),
  state: {
    nodes: [] as Array<{ id: string; position: { x: number; y: number }; data: Record<string, unknown> }>,
    currentProjectId: 'project-1' as string | null,
  },
  viewport: { controller: null as null | { getSnapshot: () => unknown } },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('../../src/services/fs/core', () => ({ isTauriEnv: () => true }));
vi.mock('../../src/services/canvasViewportService', () => ({
  getCanvasViewportController: () => mocks.viewport.controller,
}));
vi.mock('../../src/services/fileService', () => ({
  copyFileToProjectData: mocks.copyFileToProjectData,
}));
vi.mock('../../src/store/store.utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/store/store.utils')>()),
  computeImageNodeDimensions: mocks.computeImageNodeDimensions,
}));
vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      ...mocks.state,
      addNode: mocks.addNode,
      addNodeWithEdge: mocks.addNodeWithEdge,
      showToast: mocks.showToast,
    }),
  },
}));

import {
  importPushedCanvasImage,
  importRoundtripResultCard,
  resolveRoundtripSource,
  waitForRoundtripJob,
  type RoundtripJobView,
} from '../../src/services/imageRoundtripService';

function jobView(overrides: Partial<RoundtripJobView> = {}): RoundtripJobView {
  return {
    jobId: 'job-1',
    sourceNodeId: 'node-src',
    projectId: 'project-1',
    canvasId: 'project-1',
    status: 'queued',
    createdAt: 0,
    expiresAt: 0,
    ...overrides,
  };
}

describe('图片往返 · 源图解析', () => {
  it('优先本地原图（保真最高，后端直接读盘）', () => {
    expect(resolveRoundtripSource({
      filePath: 'E:\\源码\\保存\\项目 21\\a.png',
      imageUrl: 'http://asset.localhost/E%3A/a.png',
    })).toEqual({ source: 'E:\\源码\\保存\\项目 21\\a.png' });
  });

  it('把资产协议 URL 还原成本地路径（生成的图只存 imageUrl，后端取不到 asset.localhost）', () => {
    const assetUrl = `http://asset.localhost/${encodeURIComponent('E:/源码/保存/项目 21/a.png')}`;
    expect(resolveRoundtripSource({ imageUrl: assetUrl }))
      .toEqual({ source: 'E:/源码/保存/项目 21/a.png' });
  });

  it('还原不出路径的资产 URL / 非 http(s) 来源视为没有可发送的图片', () => {
    /* 编码坏了 ⇒ localMediaUrlToPath 抛错返回 undefined ⇒ 不能把坏 URL 传给后端 */
    expect(resolveRoundtripSource({ imageUrl: 'http://asset.localhost/%E0%A4%A' })).toBeNull();
    expect(resolveRoundtripSource({ thumbnailUrl: 'blob:http://localhost:5180/abc' })).toBeNull();
    /* Unix 形态的资产路径照 MTV 自己的口径接受（`/…` 就是绝对路径） */
    expect(resolveRoundtripSource({ imageUrl: 'http://asset.localhost/relative/only.png' }))
      .toEqual({ source: '/relative/only.png' });
  });

  it('没有本地文件时接受公网 URL', () => {
    expect(resolveRoundtripSource({ imageUrl: 'https://cdn.example/a.png' }))
      .toEqual({ source: 'https://cdn.example/a.png' });
  });

  it('data URL 连 mime 一起给后端（省一次嗅探）', () => {
    expect(resolveRoundtripSource({ imageUrl: 'data:image/jpeg;base64,AAAA' }))
      .toEqual({ source: 'data:image/jpeg;base64,AAAA', sourceMime: 'image/jpeg' });
  });

  it('回退到 thumbnailUrl（官方口径里它与 imageUrl 同步）', () => {
    expect(resolveRoundtripSource({ thumbnailUrl: 'http://127.0.0.1:9/t.png' }))
      .toEqual({ source: 'http://127.0.0.1:9/t.png' });
  });
});

describe('图片往返 · 轮询到终态', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('一路 queued → claimed → editing → completed，并逐次回报进度', async () => {
    const statuses = ['queued', 'claimed', 'editing', 'completed'];
    let index = 0;
    mocks.invoke.mockImplementation(async () => jobView({
      status: statuses[Math.min(index++, statuses.length - 1)] as RoundtripJobView['status'],
      resultPath: 'G:/rt/out.png',
    }));

    const seen: string[] = [];
    const promise = waitForRoundtripJob('job-1', (job) => seen.push(job.status));
    /* 轮询间隔 1.8s，逐段推进假时钟直到 promise 落定 */
    for (let i = 0; i < 10 && seen.at(-1) !== 'completed'; i++) {
      await vi.advanceTimersByTimeAsync(2000);
    }
    const done = await promise;
    expect(done.status).toBe('completed');
    expect(done.resultPath).toBe('G:/rt/out.png');
    expect(seen).toEqual(['queued', 'claimed', 'editing', 'completed']);
  });

  it('过期 / 取消都抛错（不能拿空结果去建卡）', async () => {
    for (const [status, message] of [['expired', '编辑任务已过期，请重新发送'], ['cancelled', '编辑任务已取消']] as const) {
      mocks.invoke.mockReset();
      mocks.invoke.mockResolvedValue(jobView({ status }));
      await expect(waitForRoundtripJob('job-1')).rejects.toThrow(message);
    }
  });
});

describe('图片往返 · 回传建卡', () => {
  beforeEach(() => {
    mocks.copyFileToProjectData.mockReset();
    mocks.addNodeWithEdge.mockReset();
    mocks.computeImageNodeDimensions.mockReset();
  });

  it('建出与「导入本地图片」同构的下游卡，并连一条源卡 → 新卡的边', async () => {
    mocks.copyFileToProjectData.mockResolvedValue({
      filePath: 'G:/project-data/result.png',
      assetUrl: 'http://asset.localhost/G%3A/project-data/result.png',
      fileName: 'result.png',
    });
    mocks.computeImageNodeDimensions.mockResolvedValue({
      nodeWidth: 240, nodeHeight: 180, imageWidth: 768, imageHeight: 1024,
    });

    const sourceNode = {
      id: 'node-src',
      position: { x: 100, y: 200 },
      data: { type: 'ai-image', label: '原图' },
    };

    const newNodeId = await importRoundtripResultCard(
      jobView({ status: 'completed', resultPath: 'G:/rt/out.png' }),
      sourceNode as never,
    );

    /* 结果文件按「本地图片」导进项目 */
    expect(mocks.copyFileToProjectData).toHaveBeenCalledWith('G:/rt/out.png', 'project-1', { redactErrors: true });

    const [node, edge] = mocks.addNodeWithEdge.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(node.id).toBe(newNodeId);
    expect(node.type).toBe('source-image');
    /* 位置 = 官方派生口径：源卡右侧（源卡 data.nodeWidth 缺省 280 + 默认 gap 60） */
    expect(node.position).toEqual({ x: 100 + 280 + 60, y: 200 });
    const data = node.data as Record<string, unknown>;
    expect(data.type).toBe('source-image');
    expect(data.role).toBe('source');
    expect(data.status).toBe('success');
    expect(data.imageUrl).toBe('http://asset.localhost/G%3A/project-data/result.png');
    expect(data.filePath).toBe('G:/project-data/result.png');
    expect(data.fileName).toBe('result.png');
    expect(data.label).toBe('原图 · 往返');
    /* 盒子数据自洽（比例取合法表里最接近的那个，dims 原样带上） */
    expect(data.imageWidth).toBe(768);
    expect(data.imageHeight).toBe(1024);
    expect(typeof data.aspectRatio).toBe('string');

    expect(edge.source).toBe('node-src');
    expect(edge.target).toBe(newNodeId);
    expect(edge.sourceHandle).toBe('right');
    expect(edge.targetHandle).toBe('left');
  });

  it('结果缺失时报错而不是建一张空卡', async () => {
    await expect(importRoundtripResultCard(jobView({ status: 'completed' }), {
      id: 'node-src', position: { x: 0, y: 0 }, data: { type: 'ai-image', label: 'x' },
    } as never)).rejects.toThrow('编辑结果缺失，未生成卡片');
    expect(mocks.addNodeWithEdge).not.toHaveBeenCalled();
  });
});

describe('图片往返 · 反向（编辑器主动推图到画布）', () => {
  beforeEach(() => {
    mocks.copyFileToProjectData.mockReset();
    mocks.computeImageNodeDimensions.mockReset();
    mocks.addNode.mockReset();
    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue(undefined);
    mocks.state.currentProjectId = 'project-1';
    mocks.viewport.controller = null;
  });

  it('落成一张**独立**图片卡（无边、无源卡），并认领掉这条推送', async () => {
    mocks.copyFileToProjectData.mockResolvedValue({
      filePath: 'G:/project-data/from-ps.png',
      assetUrl: 'http://asset.localhost/G%3A/project-data/from-ps.png',
      fileName: 'from-ps.png',
    });
    mocks.computeImageNodeDimensions.mockResolvedValue({
      nodeWidth: 280, nodeHeight: 210, imageWidth: 1400, imageHeight: 1050,
    });

    const nodeId = await importPushedCanvasImage({ path: 'G:/rt/pushed/x.png', fileName: 'x.png', label: '我的稿子' });
    expect(nodeId).toBeTruthy();

    /* 关键差异：走的是 addNode（**不建派生边**），不是 addNodeWithEdge */
    expect(mocks.addNodeWithEdge).not.toHaveBeenCalled();
    const node = mocks.addNode.mock.calls[0][0] as Record<string, unknown>;
    expect(node.type).toBe('source-image');
    /* 位置 = 画布指针位置（没有指针历史时的默认落点 300,200） */
    expect(node.position).toEqual({ x: 300, y: 200 });    const data = node.data as Record<string, unknown>;
    expect(data.role).toBe('source');
    expect(data.label).toBe('我的稿子');
    expect(data.imageUrl).toBe('http://asset.localhost/G%3A/project-data/from-ps.png');
    expect(data.filePath).toBe('G:/project-data/from-ps.png');

    /* 建卡成功后要认领，避免下次开画布又建一遍 */
    expect(mocks.invoke).toHaveBeenCalledWith('roundtrip_ack_push', { path: 'G:/rt/pushed/x.png' });
    expect(mocks.showToast).toHaveBeenCalled();
  });

  it('有视口时落在**当前视口中心**（按卡片尺寸居中），不是陈旧的指针坐标', async () => {
    /* 实测踩过的坑：用指针坐标（用户此刻在 PS 里，画布上没有指针）会把卡片建到视口外，
       React Flow 不渲染视口外节点 ⇒ 画布上"什么都没发生"。 */
    mocks.viewport.controller = {
      getSnapshot: () => ({ x: 0, y: 0, zoom: 1, visibleBounds: { x: 1000, y: 500, width: 800, height: 600 } }),
    };
    mocks.copyFileToProjectData.mockResolvedValue({
      filePath: 'G:/project-data/from-ps.png',
      assetUrl: 'http://asset.localhost/G%3A/project-data/from-ps.png',
      fileName: 'from-ps.png',
    });
    mocks.computeImageNodeDimensions.mockResolvedValue({
      nodeWidth: 250, nodeHeight: 300, imageWidth: 1000, imageHeight: 1200,
    });

    await importPushedCanvasImage({ path: 'G:/rt/pushed/y.png' });
    const node = mocks.addNode.mock.calls[0][0] as Record<string, unknown>;
    /* 视口中心 (1400, 800)，卡片 250×300 ⇒ 左上角各回退一半 */
    expect(node.position).toEqual({ x: 1400 - 125, y: 800 - 150 });
  });

  it('没有打开项目时不建卡（避免把图丢到别处）', async () => {
    mocks.state.currentProjectId = null;
    expect(await importPushedCanvasImage({ path: 'G:/rt/pushed/x.png' })).toBeNull();
    expect(mocks.addNode).not.toHaveBeenCalled();
  });
});
