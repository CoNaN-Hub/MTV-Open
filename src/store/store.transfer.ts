/**
 * TransferCenter slice — 官方「文件传输中心」（`index-*.js` @12177000 的 `Hu` store + `HTl` 组件）
 *
 * 官方数据模型（逐字对照）：
 *   items: [{ id, type:'upload'|'download', name, fileId?, thumbnail?, status, downloadPhase, percentage, total, loaded, error, updatedAt }]
 *   isOpen: 面板展开与否（`close()` 只关面板，不清 items）
 *   批次方法：`prepareForNewBatch()` / `upsertItems(items)`（按 id 合并）
 *
 * 官方常量：
 *   `RTl = 1e4`                      → 全部完成后 10s 自动关闭面板
 *   `D9t = 'transfer-center-list'`   → 列表 aria-controls id
 *   结束态 = completed / failed / canceled / rejected（`LTl`）
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './useAppStore';

/** 与 `src/i18n/index.ts` 的 `t` 同签名（中文原文即 key） */
type TranslateFn = (text: string, vars?: Record<string, string | number>) => string;

export type TransferItemStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled' | 'rejected';
/** 官方 `downloadPhase`：只有 download 才有，决定文案是「准备中/正在下载/已完成/已开始」 */
export type TransferDownloadPhase = 'preparing' | 'downloading' | 'completed';

export interface TransferItem {
  id: string;
  type: 'download' | 'upload';
  name: string;
  /** 行首缩略图（官方 `bTl`：image → img，video → 视频首帧，audio/archive/unknown → 图标） */
  thumbnail?: string;
  /** 缩略图不可用时的图标分类（MTV 用节点类型映射官方 `node-*` 图标） */
  kind?: 'image' | 'video' | 'audio' | 'text' | 'world' | 'archive' | 'unknown';
  status: TransferItemStatus;
  downloadPhase?: TransferDownloadPhase;
  /** 官方只在 `status==='running' && total>0` 时才画环形进度 + 百分比 */
  percentage: number;
  total: number;
  loaded: number;
  error?: string;
  updatedAt: number;
}

export interface TransferCenterSlice {
  transferItems: TransferItem[];
  transferPanelOpen: boolean;
  /** 官方 `prepareForNewBatch()`：新批次开始前清空上一批的行 */
  prepareTransferBatch: () => void;
  /** 官方 `upsertItems(items)`：按 id 合并（同 id 覆盖） */
  upsertTransferItems: (items: TransferItem[]) => void;
  patchTransferItem: (id: string, patch: Partial<TransferItem>) => void;
  openTransferPanel: () => void;
  /** 官方 `close()`：只收起面板，保留 items（下次 open 还在） */
  closeTransferPanel: () => void;
  clearTransferItems: () => void;
}

export const createTransferCenterSlice: StateCreator<AppState, [], [], TransferCenterSlice> = (set) => ({
  transferItems: [],
  transferPanelOpen: false,
  /* 官方 `prepareForNewBatch()`（`hCe` @12177000 逐字）：
       `set((s) => normalize(allSettled(s.items) ? [] : s.items, s.isOpen))`
     ⇒ **只有在「没有在途项」时才清空上一批**（正在传的行不会被新批次抹掉）；
       MTV 原来是无条件 `transferItems: []` ✗ */
  prepareTransferBatch: () => set((state) => ({
    transferItems: state.transferItems.every((item) => item.status !== 'queued' && item.status !== 'running')
      ? []
      : state.transferItems,
  })),
  /* 官方 `upsertItems`：按 id 合并 + 按 `createdAt`（MTV 用 `updatedAt` 兜底）排序 */
  upsertTransferItems: (items) => set((state) => {
    const next = [...state.transferItems];
    for (const item of items) {
      const index = next.findIndex((existing) => existing.id === item.id);
      if (index >= 0) next[index] = { ...next[index], ...item };
      else next.push(item);
    }
    next.sort((a, b) => a.updatedAt - b.updatedAt);
    return { transferItems: next };
  }),
  patchTransferItem: (id, patch) => set((state) => ({
    transferItems: state.transferItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  })),
  openTransferPanel: () => set({ transferPanelOpen: true }),
  closeTransferPanel: () => set({ transferPanelOpen: false }),
  clearTransferItems: () => set({ transferItems: [], transferPanelOpen: false }),
});

/* ------------------------------------------------------------------ *
 * 官方纯函数（逐字搬运，便于比对与复用）
 * ------------------------------------------------------------------ */

/** 官方 `LTl`：是否结束态 */
export function isTransferItemFinished(item: Pick<TransferItem, 'status'>): boolean {
  return item.status === 'completed' || item.status === 'failed' || item.status === 'canceled' || item.status === 'rejected';
}

/** 官方 `FTl`：全部完成（空列表 ⇒ false） */
export function isTransferBatchCompleted(items: Pick<TransferItem, 'status'>[]): boolean {
  return items.length === 0 ? false : items.every((item) => item.status === 'completed');
}

/** 官方 `P9t`：按类型统计 { 已完成数, 总数 } */
function countByType(items: TransferItem[], type: TransferItem['type']): { current: number; total: number } {
  const list = items.filter((item) => item.type === type);
  return { current: list.filter(isTransferItemFinished).length, total: list.length };
}

/** 官方 `OTl`：整体状态（决定头部左侧图标） */
export function transferOverallState(
  items: Pick<TransferItem, 'status'>[],
): 'active' | 'failed' | 'canceled' | 'completed' {
  if (items.some((item) => item.status === 'queued' || item.status === 'running')) return 'active';
  if (items.some((item) => item.status === 'failed' || item.status === 'rejected')) return 'failed';
  if (items.some((item) => item.status === 'canceled')) return 'canceled';
  return 'completed';
}

/** 官方 `BTl`：头部文案（upload/download 混合时用 ` · ` 连接） */
export function transferHeaderText(items: TransferItem[], state: ReturnType<typeof transferOverallState>, t: TranslateFn): string {
  const upload = countByType(items, 'upload');
  const download = countByType(items, 'download');
  const downloading = items.some((item) => item.type === 'download' && item.downloadPhase === 'downloading');
  if (download.total === 0) {
    return t(state === 'active' ? '正在上传 {current}/{total}' : state === 'completed' ? '上传完成 {current}/{total}' : '上传 {current}/{total}', upload);
  }
  if (upload.total === 0) {
    const key = state === 'active'
      ? (downloading ? '正在下载 {current}/{total}' : '准备文件中 {current}/{total}')
      : state === 'completed'
        ? (downloading ? '下载完成 {current}/{total}' : '下载已开始 {current}/{total}')
        : '准备文件 {current}/{total}';
    return t(key, download);
  }
  return state === 'completed'
    ? [t('上传完成 {current}/{total}', upload), t(downloading ? '下载完成 {current}/{total}' : '下载已开始 {current}/{total}', download)].join(' · ')
    : [t('上传 {current}/{total}', upload), t(downloading ? '下载 {current}/{total}' : '准备文件 {current}/{total}', download)].join(' · ');
}

/** 官方 `dUe`：行内状态文案 */
export function transferStatusText(item: TransferItem, t: TranslateFn): string {
  if (item.status === 'queued') return t('等待中');
  if (item.status === 'completed') {
    if (item.type === 'download') return t(item.downloadPhase === 'downloading' ? '已完成' : '已开始');
    return t('已完成');
  }
  if (item.status === 'failed') return t('失败');
  if (item.status === 'canceled') return t('已取消');
  if (item.status === 'rejected') return t('无法上传');
  if (item.type === 'download' && item.downloadPhase === 'downloading') return t('正在下载');
  if (item.type === 'download') return t('准备中');
  return t('正在上传');
}

/** 官方 `$Tl`：行内状态颜色（失败红 / 等待·取消灰 / 其余浅灰） */
export function transferStatusClass(item: Pick<TransferItem, 'status'>): string {
  if (item.status === 'failed' || item.status === 'rejected') return 'text-red-300';
  if (item.status === 'queued' || item.status === 'canceled') return 'text-neutral-400';
  return 'text-neutral-300';
}

/** 官方 `UTl`：是否显示环形进度（running 且有总大小） */
export function shouldShowTransferProgress(item: TransferItem): boolean {
  return item.status === 'running' && item.total > 0 && Number.isFinite(item.percentage);
}

/** 官方 `VBa`：百分比夹取 */
export function clampTransferPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}
