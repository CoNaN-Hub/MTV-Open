/**
 * mediaViewerVersions —— 把 MTV 的生成历史（`OutputHistoryEntry[]`）整理成
 * 官方媒体查看器「历史版本列」需要的数据（`resources`）
 *
 * 官方对照：历史列的数据来自媒体查看器 session 的 `m.resources`
 * （本地变体队列 `historyLocalQueues` + 服务端 node history，见 `Stt` @3106101），
 * 每项形如 `{ src, thumbnailSrc, width, height, prompt, model, createdAt }`，
 * 缩略图回落链 `Fbe(r) = r.thumbnailSrc || hs(r.src, "thumbnail") || r.src`。
 *
 * MTV 侧：没有服务端 node history，等价物是 IndexedDB 生成历史里的同节点记录
 * （`store.outputHistoryRecords`，新→旧，按 `nodeId` 过滤）。MTV 的记录没有 `thumbnailUrl`
 * ⇒ 缩略图直接用原图（= 官方 `Fbe` 的最后一档回落）✓
 */
import type { OutputHistoryEntry } from '../types';

export interface MediaViewerVersion {
  /** 原图地址 */
  src: string;
  prompt?: string;
  model?: string;
  createdAt?: number;
  /** 本地文件路径（下载该版本时优先用它，与节点工具栏「下载」同一条路径） */
  filePath?: string;
}

/** 记录里的媒体地址：官方取 `resource.src`，MTV 取 `mediaUrl ?? output` */
export function historyRecordMediaUrl(record: OutputHistoryEntry): string {
  return (record.mediaUrl || record.output || '').trim();
}

/**
 * 收集某个节点的历史版本（新→旧，去重）。
 * ⚠️ 只收成功的记录（失败记录没有可用媒体）——官方 `resources` 也只会是已生成的资源。
 */
export function collectNodeMediaVersions(
  nodeId: string,
  records: readonly OutputHistoryEntry[] | undefined,
): MediaViewerVersion[] {
  const seen = new Set<string>();
  const versions: MediaViewerVersion[] = [];
  /* 防御：部分调用点（老的测试桩 / 半初始化 store）没有这个字段 ⇒ 当空列表，别炸 */
  for (const record of records ?? []) {
    if (record.nodeId !== nodeId || record.status !== 'success') continue;
    const src = historyRecordMediaUrl(record);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    versions.push({
      src,
      prompt: record.prompt || undefined,
      model: record.model || undefined,
      createdAt: record.timestamp,
      filePath: record.filePath || undefined,
    });
  }
  return versions;
}

/** 官方事实栏的 `createdAt` / `model`：取当前展示版本对应的那条记录 */
export function versionFactsOf(
  versions: readonly MediaViewerVersion[],
  src: string | undefined,
): { createdAt?: number; model?: string } {
  if (!src) return {};
  const match = versions.find((version) => version.src === src);
  return { createdAt: match?.createdAt, model: match?.model };
}
