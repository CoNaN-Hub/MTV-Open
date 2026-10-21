/**
 * transferReporting — 官方「文件传输中心」的写入端（store `Hu` = `hCe` @12177000）
 *
 * 官方 store（逐字）：
 *   ```js
 *   const pending = new Set(['queued', 'running']);
 *   const allSettled = (items) => items.length === 0 ? false : items.every((i) => !pending.has(i.status));
 *   const normalize = (items, isOpen) => ({ items, isOpen, isTransferring: items.some((i) => pending.has(i.status)) });
 *   const merge = (prev, next) => { // 按 id 合并，保留 createdAt，最后按 createdAt 排序
 *     const map = new Map(prev.map((i) => [i.id, i]));
 *     for (const item of next) { const old = map.get(item.id); map.set(item.id, old ? { ...old, ...item, createdAt: old.createdAt } : item); }
 *     return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
 *   };
 *   useTransferStore = create((set) => ({
 *     items: [], isOpen: false, isTransferring: false,
 *     open: () => set({ isOpen: true }),
 *     close: () => set({ isOpen: false }),
 *     prepareForNewBatch: () => set((s) => normalize(allSettled(s.items) ? [] : s.items, s.isOpen)),
 *     upsertItems: (items) => set((s) => normalize(merge(s.items, items), s.isOpen)),
 *     clear: () => set((s) => normalize([], s.isOpen)),
 *   }));
 *   ```
 *
 * 上传/下载两条链路都往这里写（面板 `HTl` @12181143 = MTV 的 `TransferCenter`）：
 *   · **上传**：选设备文件 / 粘贴 / 拖入 → 落盘时按 `type: 'upload'` 建行（写入进度 = `percentage`）
 *   · **下载**：节点「下载 / 另存为」→ 落盘时按 `type: 'download'` 建行
 * 面板文案/环形进度/10s 自动收起都由 `TransferCenter` 负责（已 1:1 复刻）。
 */
import { useAppStore } from '../store/useAppStore';
import type { TransferItem, TransferDownloadPhase } from '../store/store.transfer';

export type TransferVariant = 'upload' | 'download';
export type TransferKind = NonNullable<TransferItem['kind']>;

const PENDING: ReadonlySet<TransferItem['status']> = new Set(['queued', 'running']);

/** 官方 `allSettled`：没有在途项时才算「一批已结束」 */
export function allTransfersSettled(items: TransferItem[]): boolean {
  return items.length === 0 ? false : items.every((item) => !PENDING.has(item.status));
}

let seq = 0;
function nextTransferId(variant: TransferVariant): string {
  seq += 1;
  return `${variant}-${Date.now().toString(36)}-${seq}`;
}

/** 由文件名推断官方面板的行首图标分类 */
export function transferKindFromName(name: string): TransferKind {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'svg', 'heic'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['txt', 'md', 'json', 'csv'].includes(ext)) return 'text';
  if (['glb', 'gltf', 'obj', 'fbx'].includes(ext)) return 'world';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'unknown';
}

export interface BeginTransferInput {
  variant: TransferVariant;
  name: string;
  kind?: TransferKind;
  thumbnail?: string;
  /** 官方下载有 `downloadPhase`（决定「准备中/正在下载/已完成/已开始」文案），上传没有 */
  downloadPhase?: TransferDownloadPhase;
}

/** 官方 `prepareForNewBatch()` + `open()`：开一批新任务（没有在途项时才清空旧行）
 *  ⚠️ 官方每**一次用户动作**只 prepare 一次（然后 upsert 本批所有行）；
 *     所以这里带一个 `batchKey`：同一个 key 重复调用不会把本批已完成的行清掉
 *     （否则「粘贴 3 张图」会在第 2 张开始时把第 1 张的行抹掉 ✗ = 用户说的「上传一次就是一次，不叠加」的反面）。 */
let lastBatchKey: string | null = null;
export function startTransferBatch(batchKey: string): void {
  const store = useAppStore.getState();
  if (batchKey !== lastBatchKey) {
    lastBatchKey = batchKey;
    store.prepareTransferBatch();   // 官方语义：没有在途项时清空上一批
  }
  store.openTransferPanel();
}

/** 兼容旧调用：直接当作一个新批次 */
export function prepareTransferBatch(): void {
  startTransferBatch(`legacy:${Date.now().toString(36)}`);
}

/** 建一行并打开面板；返回行 id（后续用 `patchTransfer` 更新进度） */
export function beginTransfer(input: BeginTransferInput): string {
  const id = nextTransferId(input.variant);
  const store = useAppStore.getState();
  store.upsertTransferItems([{
    id,
    type: input.variant,
    name: input.name,
    kind: input.kind ?? transferKindFromName(input.name),
    thumbnail: input.thumbnail,
    status: 'running',
    downloadPhase: input.downloadPhase,
    percentage: 0,
    total: 0,
    loaded: 0,
    updatedAt: Date.now(),
  }]);
  store.openTransferPanel();
  return id;
}

export function patchTransfer(id: string | null, patch: Partial<TransferItem>): void {
  if (!id) return;
  useAppStore.getState().patchTransferItem(id, { ...patch, updatedAt: Date.now() });
}

/** 官方下载进度：`{ loaded, total }` → `percentage`（`total<=0` 时官方不画环） */
export function transferProgressPatch(loaded: number, total: number): Partial<TransferItem> {
  const percentage = total > 0 ? Math.min(100, Math.max(0, (loaded / total) * 100)) : 0;
  return { loaded, total, percentage };
}

export function finishTransfer(id: string | null, error?: string): void {
  if (!id) return;
  /* ⚠️ 不要给下载行写 `downloadPhase: 'completed'`：MTV 的文案映射（照官方）里
       「已完成」= `status:'completed'` **且 `downloadPhase` 仍是 `'downloading'`**，
       写成 `'completed'` 反而会落到「已开始」那一档（实测踩过）。 */
  patchTransfer(id, error
    ? { status: 'failed', error, percentage: 100 }
    : { status: 'completed', percentage: 100 });
}
