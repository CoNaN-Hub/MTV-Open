/**
 * imageRoundtripService —— 「图片往返」：把本卡源图送到**本机桥接服务**，
 * 由外部编辑器（Photoshop 等）编辑后回传，画布自动建一张**关联源卡的下游图卡**。
 *
 * ## 分层（与官方「回传 / 建卡解耦」一致）
 * ```
 *   画布卡片 ──Tauri IPC──► 桥接服务(127.0.0.1，Rust/axum) ◄──HTTP── 外部编辑器
 *        ▲                          │
 *        └── completed 后自动建卡 ◄────┘（resultPath = 回传的扁平 PNG）
 * ```
 * · 画布侧走 **IPC**（`roundtrip_*` 命令），不经 HTTP —— 少一个攻击面，也免去 CORS；
 * · 编辑器侧走 **环回 HTTP**（`/api/roundtrip/*`，MTV 自己的端点），因为它只认 HTTP；
 * · 回传的 PNG 落盘后，画布用 **MTV 自己的「导入本地图片」那套**（`copyFileToProjectData`
 *   + `computeImageNodeDimensions` + `nodeBoxForImageSize` + `nearestAspectRatioForImage`）
 *   建卡 ⇒ 新卡与「拖一张图进画布」得到的卡**完全同构**（官方改造后的 MTV 卡片形态），
 *   而不是另造一套视觉。
 *
 * ## 卡片命名与关联
 * · 新卡是 `source-image` / `role:'source'`（和导入的图一样是可再用的素材）；
 * · 位置 = `derivedNodePlacement(源卡, 60)`（官方派生节点统一放源卡右侧），并**继承 parentId**
 *   以免源卡在分组里时新卡飞到画布原点；
 * · 源卡 → 新卡 连一条边，表达「派生 / 下游版本」。
 */
import { invoke } from '@tauri-apps/api/core';
import type { Edge, Node } from '@xyflow/react';
import type { BaseNodeData } from '../types';
import { useAppStore } from '../store/useAppStore';
import { computeImageNodeDimensions, derivedNodePlacement, generateId } from '../store/store.utils';
import { nearestAspectRatioForImage, nodeBoxForImageSize } from '../utils/nodeBounds';
import { isTauriAssetUrl, localMediaUrlToPath } from '../utils/mediaUrl';
import { getCanvasPointerPosition } from './canvasPointerService';
import { getCanvasViewportController } from './canvasViewportService';
import { copyFileToProjectData } from './fileService';
import { isTauriEnv } from './fs/core';

/** 桥接服务里的任务视图（字段与 Rust 侧 `RoundtripJobView` 一一对应，camelCase）。 */
export interface RoundtripJobView {
  jobId: string;
  sourceNodeId: string;
  projectId: string;
  canvasId: string;
  status: 'queued' | 'claimed' | 'editing' | 'completed' | 'expired' | 'cancelled';
  /** 时间戳一律是 **epoch 毫秒**（Rust 侧存数值，便于直接比较大小；不要当 ISO 字符串用）。 */
  createdAt: number;
  expiresAt: number;
  claimedAt?: number;
  completedAt?: number;
  /** 回传 PNG 的**本地绝对路径** —— 建卡就是把这个文件导进项目。 */
  resultPath?: string;
  message?: string;
}

export interface RoundtripBridgeStatus {
  running: boolean;
  port: number | null;
  editorOnline: boolean;
}

export interface RoundtripCreateInput {
  source: string;
  sourceMime?: string;
  sourceNodeId: string;
  projectId: string;
  canvasId: string;
}

/** 任务进行中的状态（Rust 侧状态机的前三态）。 */
const ACTIVE_STATUSES = new Set<RoundtripJobView['status']>(['queued', 'claimed', 'editing']);
/** 与 Rust 侧 TTL（30min）留一点余量的客户端兜底，避免服务没应答时死等。 */
const JOB_TIMEOUT_MS = 31 * 60 * 1000;
const POLL_INTERVAL_MS = 1800;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 「正在编辑」提示只报一次（模块级，避免每 1.8s 轮询重复提示）。 */
const editingNotified = new Set<string>();

export async function getRoundtripBridgeStatus(): Promise<RoundtripBridgeStatus> {
  return invoke<RoundtripBridgeStatus>('roundtrip_bridge_status');
}

/** 启动（幂等）桥接服务并返回端口。已在跑就直接拿现有端口。 */
export async function ensureRoundtripBridge(): Promise<number> {
  return invoke<number>('roundtrip_bridge_start', { port: null });
}

export async function stopRoundtripBridge(): Promise<void> {
  await invoke('roundtrip_bridge_stop');
}

export async function createRoundtripJob(input: RoundtripCreateInput): Promise<RoundtripJobView> {
  return invoke<RoundtripJobView>('roundtrip_create_job', { input });
}

export async function getRoundtripJobStatus(jobId: string): Promise<RoundtripJobView> {
  return invoke<RoundtripJobView>('roundtrip_job_status', { jobId });
}

export async function cancelRoundtripJob(jobId: string): Promise<RoundtripJobView> {
  return invoke<RoundtripJobView>('roundtrip_job_cancel', { jobId });
}

/**
 * 取本卡可发送的源。**优先级是按「后端拿得到什么」定的**：
 * 1. `filePath`（MTV 偶尔会带）—— 本地原图，保真最高；
 * 2. `imageUrl` / `thumbnailUrl` 的**资产协议 URL 还原成本地路径**
 *    （`localMediaUrlToPath`）—— 这是**绝大多数卡片的实际形态**：
 *    实测项目数据里生成的图只存 `imageUrl = http://asset.localhost/E%3A%2F…`，
 *    没有 `filePath`；而这个 URL 后端 reqwest 取不到，必须还原成路径交盘读取；
 * 3. 真 `data:` / `http(s):` URL —— 直接透传给后端。
 *
 * 三步都不命中时返回 `null`，让调用方提示「没有可发送的图片」，
 * 而不是把后端取不到的 URL 塞进任务（那样任务会一直领不到图）。
 */
export function resolveRoundtripSource(
  data: Pick<BaseNodeData, 'filePath' | 'imageUrl' | 'thumbnailUrl'>,
): { source: string; sourceMime?: string } | null {
  const filePath = typeof data.filePath === 'string' ? data.filePath.trim() : '';
  if (filePath && /^(?:[a-z]:[\\/]|\/|\\\\)/i.test(filePath)) return { source: filePath };

  for (const key of ['imageUrl', 'thumbnailUrl'] as const) {
    const value = data[key];
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(text)) {
      return { source: text, sourceMime: text.slice('data:'.length, text.indexOf(';')).toLowerCase() };
    }
    /* 资产协议（`http://asset.localhost/<encoded>`）→ 本地路径；后端只认路径 */
    if (isTauriAssetUrl(text)) {
      const localPath = localMediaUrlToPath(text);
      if (localPath) return { source: localPath };
      continue;
    }
    if (/^https?:\/\//i.test(text)) return { source: text };
  }
  return null;
}

/** 轮询到终态；`onProgress` 用于给用户显示「等待编辑器 / 编辑中」。 */
export async function waitForRoundtripJob(
  jobId: string,
  onProgress?: (job: RoundtripJobView) => void,
): Promise<RoundtripJobView> {
  const startedAt = Date.now();
  for (;;) {
    const job = await getRoundtripJobStatus(jobId);
    onProgress?.(job);
    if (job.status === 'completed') return job;
    if (job.status === 'expired') throw new Error(job.message || '编辑任务已过期，请重新发送');
    if (job.status === 'cancelled') throw new Error(job.message || '编辑任务已取消');
    if (!ACTIVE_STATUSES.has(job.status)) throw new Error(job.message || `编辑任务异常（${job.status}）`);
    if (Date.now() - startedAt > JOB_TIMEOUT_MS) throw new Error('编辑任务超时，请重新发送');
    await delay(POLL_INTERVAL_MS);
  }
}

/**
 * 回传后建卡：把 `resultPath` 当作「一张本地图片」导进项目，
 * 用与 `canvasResourceImportService` **同一套** 尺寸/盒子/比例算法，再连一条源卡→新卡的边。
 * 返回新卡 id。
 */
export async function importRoundtripResultCard(
  job: RoundtripJobView,
  sourceNode: Pick<Node<BaseNodeData>, 'id' | 'position' | 'parentId' | 'data'>,
): Promise<string> {
  const store = useAppStore.getState();
  if (!job.resultPath) throw new Error('编辑结果缺失，未生成卡片');

  const saved = await copyFileToProjectData(job.resultPath, job.projectId, { redactErrors: true });
  if (!saved?.assetUrl) throw new Error('编辑结果写入项目失败，请检查目录授权');

  const dims = await computeImageNodeDimensions(saved.assetUrl);
  const sourceLabel = sourceNode.data?.label || sourceNode.data?.fileName || '图片';
  const newNodeId = `node-${generateId()}`;

  const data: BaseNodeData = {
    type: 'source-image',
    role: 'source',
    label: `${sourceLabel} · 往返`,
    status: 'success',
    filePath: saved.filePath,
    fileName: saved.fileName,
    imageUrl: saved.assetUrl,
    /* 与导入本地图片同一口径：盒子数据自洽 + 比例取合法表里最接近的那个 */
    ...dims,
    ...nodeBoxForImageSize(dims.imageWidth, dims.imageHeight),
    ...nearestAspectRatioForImage(dims.imageWidth, dims.imageHeight),
  };

  const edge: Edge = {
    id: `edge-${generateId()}`,
    source: sourceNode.id,
    target: newNodeId,
    sourceHandle: 'right',
    targetHandle: 'left',
  };

  /* 一次提交落「卡片 + 派生边」（`derivedNodePlacement` 会连 parentId 一起给，
     源卡在分组里时新卡才不会落到画布原点）。 */
  store.addNodeWithEdge(
    { id: newNodeId, type: 'source-image', ...derivedNodePlacement(sourceNode, 60), data },
    edge,
  );
  return newNodeId;
}

/**
 * 卡片工具栏「图片往返」的入口：发送 → 等回传 → 建下游卡。
 * 全程用 toast 报状态，不阻塞 UI；同一个源卡重复点击会各自建任务（桥接服务按任务隔离）。
 */
export async function startImageRoundtrip(nodeId: string): Promise<string | null> {  const store = useAppStore.getState();
  if (!isTauriEnv()) {
    store.showToast('图片往返仅桌面端可用', 'error');
    return null;
  }

  const sourceNode = store.nodes.find((node) => node.id === nodeId);
  const source = sourceNode ? resolveRoundtripSource(sourceNode.data) : null;
  if (!sourceNode || !source) {
    store.showToast('这张卡片没有可发送的图片', 'error');
    return null;
  }

  const projectId = store.currentProjectId;
  if (!projectId) {
    store.showToast('请先打开一个项目', 'error');
    return null;
  }

  let job: RoundtripJobView;
  try {
    const port = await ensureRoundtripBridge();
    job = await createRoundtripJob({
      source: source.source,
      ...(source.sourceMime ? { sourceMime: source.sourceMime } : {}),
      sourceNodeId: nodeId,
      projectId,
      /* MTV 的「画布」就是项目（见 ImageNode 里 multi-angle 的 canvasId 口径） */
      canvasId: projectId,
    });
    store.showToast('已发送到外部编辑器', 'success', `桥接服务 127.0.0.1:${port}，编辑完成后自动生成卡片`);
  } catch (error) {
    store.showToast(error instanceof Error ? error.message : '发送失败，请检查桥接服务', 'error');
    return null;
  }

  try {
    const completed = await waitForRoundtripJob(job.jobId, (current) => {
      /* 只在第一次「被编辑器领走」时提示一次，避免每 1.8s 刷屏 */
      if (current.status === 'editing' && !editingNotified.has(current.jobId)) {
        editingNotified.add(current.jobId);
        useAppStore.getState().showToast('外部编辑器正在编辑', 'info');
      }
    });
    const newNodeId = await importRoundtripResultCard(completed, sourceNode);
    useAppStore.getState().showToast('已回传，生成下游卡片', 'success');
    return newNodeId;
  } catch (error) {
    useAppStore.getState().showToast(error instanceof Error ? error.message : '往返失败', 'error');
    return null;
  } finally {
    editingNotified.delete(job.jobId);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   反向：编辑器（PS 面板）**主动**把图推到画布 ⇒ 落成一张独立的新卡片
   ─────────────────────────────────────────────────────────────────────────
   与「回传」的区别：回传是任务的结果、要接在**源卡下面**（有派生边）；
   这个方向由编辑器发起、与任何任务无关 ⇒ 落成一张**独立**图片卡（无边），
   位置用**画布指针位置**（`getCanvasPointerPosition`，没有指针历史则回落到默认点），
   卡片形态与「拖一张图进画布」完全一致。
   ══════════════════════════════════════════════════════════════════════════ */

/** `roundtrip://canvas-image` 事件的负载（Rust 侧 `push` 端点发的）。 */
export interface PushedCanvasImage {
  /** 桥接服务落盘后的**本地绝对路径** —— 建卡就是把这个文件导进项目。 */
  path: string;
  fileName?: string;
  label?: string;
  /** epoch 毫秒；只有轮询兜底（`roundtrip_pending_pushes`）会带 */
  receivedAt?: number;
}

/**
 * 落点：**当前视口中心**（按卡片尺寸居中）。
 *
 * 为什么不用画布指针位置：推图是用户在 **PS 里**点的，那时鼠标根本不在画布上，
 * `getCanvasPointerPosition()` 拿到的是陈旧的（甚至从没记录过的默认 300,200）坐标 ——
 * 实测踩过：卡片建在了视口外，画布上什么都看不见（React Flow 不渲染视口外的节点）。
 */
function pushedImagePosition(nodeWidth?: number, nodeHeight?: number): { x: number; y: number } {
  const snapshot = getCanvasViewportController()?.getSnapshot();
  if (!snapshot) return getCanvasPointerPosition();
  const { x, y, width, height } = snapshot.visibleBounds;
  return {
    x: Math.round(x + width / 2 - (nodeWidth ?? 0) / 2),
    y: Math.round(y + height / 2 - (nodeHeight ?? 0) / 2),
  };
}

/** 把推来的图落成画布卡片。返回新卡 id；没有项目/路径无效时返回 null。 */
export async function importPushedCanvasImage(payload: PushedCanvasImage): Promise<string | null> {  const store = useAppStore.getState();
  const projectId = store.currentProjectId;
  if (!projectId || !payload?.path) return null;

  try {
    const saved = await copyFileToProjectData(payload.path, projectId, { redactErrors: true });
    if (!saved?.assetUrl) throw new Error('写入项目失败，请检查目录授权');

    const dims = await computeImageNodeDimensions(saved.assetUrl);
    const data: BaseNodeData = {
      type: 'source-image',
      role: 'source',
      label: payload.label?.trim() || saved.fileName || '外部编辑器',
      status: 'success',
      filePath: saved.filePath,
      fileName: saved.fileName,
      imageUrl: saved.assetUrl,
      /* 与导入本地图片同一口径：盒子数据自洽 + 比例取合法表里最接近的那个 */
      ...dims,
      ...nodeBoxForImageSize(dims.imageWidth, dims.imageHeight),
      ...nearestAspectRatioForImage(dims.imageWidth, dims.imageHeight),
    };

    const nodeId = `node-${generateId()}`;
    useAppStore.getState().addNode({
      id: nodeId,
      type: 'source-image',
      position: pushedImagePosition(dims.nodeWidth, dims.nodeHeight),
      data,
    });
    useAppStore.getState().showToast('已接收外部编辑器发来的图片', 'success');
    /* 认领掉，避免下次开画布时轮询兜底又建一遍 */
    await ackPushedCanvasImage(payload.path).catch(() => undefined);
    return nodeId;
  } catch (error) {
    useAppStore.getState().showToast(error instanceof Error ? error.message : '接收图片失败', 'error');
    return null;
  }
}

/** 订阅推送事件；返回取消订阅函数。 */
export async function listenForPushedCanvasImages(): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event');
  return listen<PushedCanvasImage>('roundtrip://canvas-image', (event) => {
    void importPushedCanvasImage(event.payload);
  });
}

/** 还没被画布认领的推送（事件丢了/画布当时没开时的兜底）。 */
export async function listPendingPushedImages(): Promise<PushedCanvasImage[]> {
  return invoke<PushedCanvasImage[]>('roundtrip_pending_pushes');
}

export async function ackPushedCanvasImage(path: string): Promise<void> {
  await invoke('roundtrip_ack_push', { path });
}

/** 把遗留的推送补齐成卡片（画布挂载时调一次）。 */
export async function drainPushedCanvasImages(): Promise<void> {
  const pending = await listPendingPushedImages();
  for (const item of pending) {
    await importPushedCanvasImage(item);
  }
}
