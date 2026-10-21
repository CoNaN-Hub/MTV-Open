/**
 * mediaViewerHistory —— 官方媒体查看器「历史版本列」（`Obe` @472356）的纯逻辑
 *
 * 官方口径：
 *   · `e.length <= 1 ? null`：**资源 ≤1 条时整列不存在**，也没有空态文案
 *   · 缩略图 `Fbe(r) = r.thumbnailSrc || hs(r.src, "thumbnail") || r.src`（最后一档就是原图）
 *   · 顺序 `[打开时的媒体, ...其余]`（`pxe`）⇒ 入口媒体**钉在第 0 位**，当前项不上浮
 *   · 选中态用 `aria-current="true"` + `.is-near`（相邻项）
 */
export interface MediaHistoryVersion {
  /** 原图地址（点击后查看器显示它） */
  src: string;
  /** 缩略图（拿不到就回落原图，官方 `Fbe`） */
  thumbnailSrc?: string;
}

/** 官方 `Fbe`：`thumbnailSrc → src`（MTV 没有官方那套 URL 变换 ⇒ 直接回落原图） */
export function mediaHistoryThumbnail(version: MediaHistoryVersion): string {
  return version.thumbnailSrc || version.src;
}

/** 官方 `e.length <= 1 ? null` */
export function shouldShowMediaHistory(count: number): boolean {
  return count > 1;
}

/** 官方 `pxe`/`tye`：入口媒体钉在第 0 位，其余按原顺序去重 */
export function buildMediaHistoryVersions(
  entrySrc: string,
  versions: readonly MediaHistoryVersion[],
): MediaHistoryVersion[] {
  const seen = new Set<string>();
  const ordered: MediaHistoryVersion[] = [];
  const push = (version: MediaHistoryVersion) => {
    if (!version.src || seen.has(version.src)) return;
    seen.add(version.src);
    ordered.push(version);
  };
  if (entrySrc) push({ src: entrySrc, thumbnailSrc: versions.find((item) => item.src === entrySrc)?.thumbnailSrc });
  versions.forEach(push);
  return ordered;
}
