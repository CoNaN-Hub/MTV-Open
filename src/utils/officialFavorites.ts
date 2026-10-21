/**
 * officialFavorites —— 官方「媒体收藏」体系的 **MTV 映射**（资产身份解析 + 收藏态读写）。
 *
 * 官方出处（`zoom-slider-3ZcFvYQO.js`，字节偏移均为 0-based 字符偏移）：
 *   · `g8(node, registeredFileIds, mediaSrc)` @582802 —— 节点 → `{sourceFileId, asset}`
 *   · `wp(value)` @582570 —— 非对象 / 数组 ⇒ `{}`
 *   · `cl(...values)` @582637 —— 第一个「是字符串且 trim 后非空」的值
 *   · `Xs(url)` = `index-BiTZf8mJ.js` 的 `d$` @1166981（别名链 `nA as Xs`，导出表 `d$ as nA`）
 *     三条 URL→UUID 正则 @1166684：
 *       `/api/conversation/storage/uploads/<uuid>` / `/uploads/<uuid>` / `/files/<uuid>[.ext]`
 *   · `nc`（收藏态 zustand store）@21670 —— 字段 `statuses / favoriteMutationSeq /
 *     lastFavoriteMutation / setStatuses / getStatus / toggleStatus / emitFavoriteMutation`
 *   · `L_(sourceFileId, asset)` @432268 —— 乐观切换 → 写 → 失败回滚
 *   · `B_(sourceFileIds, "gallery_open" | "viewer_open")` —— 打开时的收藏态预取/埋点
 *   · `oQe`（卡片收藏按钮）@2941561 / `Qge`（查看器底条）@436698 —— 两个消费点
 *
 * ⚠️ MTV 偏离（**只有一处**，其余逐字对应）：
 *   官方 `sourceFileId` 是**服务端文件库主键**（`s.currentSourceFileId` / 从 CDN URL 里抠出的 UUID /
 *   `Qd.nodeToFiles[node.id][0]`）。MTV 没有服务端文件库，也没有 `nodeToFiles` 索引
 *   ⇒ 同一优先级链换成 MTV 节点上已有的稳定身份：
 *     `data.currentSourceFileId`（逐字保留：MTV 若将来写入同名键则与官方同路）
 *     → `Xs(sourceUrl)`（官方正则**逐字**，远程 URL 与官方同路）
 *     → `data.assetId`（MTV `services/fs/assetIndex.ts` 的「稳定资产身份，不随文件移动/重命名变化」，
 *        正是官方 `sourceFileId` 的语义对偶）
 *     → `data.relativePath` / `data.filePath`（MTV 节点落库后必有的本地身份）
 *   全部取不到 ⇒ 返回 `null`，调用方与官方 `oQe` 的 `if(!o) return null` 完全一致
 *   （**不渲染按钮**，而不是渲染一个点了没反应的按钮）。
 */
import type { BaseNodeData } from '../types';

/** 官方 `cl(...values)` @582637 —— 第一个非空字符串（`typeof t=="string" && t.trim().length>0`） */
export function firstNonEmptyString(...values: readonly unknown[]): string | undefined {
  return values.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
}

/**
 * 官方 `d$`（别名 `Xs`）@`index-BiTZf8mJ.js` 1166981 —— 从资产 URL 里抠出文件 UUID。
 * 三条正则**逐字**（含 `i` 标志与 `/files/` 那条的 `(?:\.[a-z0-9]+)?(?=[/?#]|$)`）：
 * ```js
 * _pr=/\/api\/conversation\/storage\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
 * Mpr=/\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
 * Apr=/\/files\/([0-9a-f]{8}-...-[0-9a-f]{12})(?:\.[a-z0-9]+)?(?=[/?#]|$)/i
 * ```
 */
const OFFICIAL_FILE_ID_PATTERNS: readonly RegExp[] = [
  /\/api\/conversation\/storage\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  /\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  /\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.[a-z0-9]+)?(?=[/?#]|$)/i,
];

/** 官方 `Xs(url)` —— 三条正则按序命中，取第 1 个捕获组；全不命中 ⇒ `null` */
export function officialSourceFileIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  for (const pattern of OFFICIAL_FILE_ID_PATTERNS) {
    const match = pattern.exec(url);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * 官方 `O_({...})` 产出的 asset 描述符（`g8` @582802 的 `asset` 字段）。
 * 官方把它交给收藏写入接口（`nie` / `GU`）；MTV 无服务端 ⇒ **只作为形参保留**（见 `store.favorites.ts`）。
 */
export interface FavoriteAsset {
  /** 官方 `generationType: e.type`（MTV = 节点 type 字符串） */
  generationType: string;
  /** 官方 `sourceUrl: r` */
  sourceUrl: string;
  /** 官方 `thumbnailUrl: d`（**仅视频**：`hs(ur(r), Pn.THUMBNAIL_V2)`） */
  thumbnailUrl?: string;
  /** 官方 `sourceNodeId: e.id` */
  sourceNodeId: string;
  /** 官方 `nodeTitle: cl(s.title)` */
  nodeTitle?: string;
  /** 官方 `prompt: cl(s.prompt)` */
  prompt?: string;
  /** 官方 `modelName: cl(a.model)`（`a` = `s.params`） */
  modelName?: string;
  /** 官方 `additionalParameters: a`（= `s.params`） */
  additionalParameters: Record<string, unknown>;
  /** 官方 `metadata: c`（= `s.__metadata`） */
  metadata: Record<string, unknown>;
}

/** 官方 `g8` 的返回值 */
export interface FavoriteTarget {
  sourceFileId: string;
  asset: FavoriteAsset;
}

/** 官方 `g8` 要读的节点形状（`RFNode<BaseNodeData>` 的最小结构子集，避免拉进 React Flow 类型） */
export interface FavoriteNodeLike {
  id: string;
  type?: string;
  data?: BaseNodeData | Record<string, unknown>;
}

/** 官方 `he.VIDEO` 的 MTV 对应（`video` / `ai-video` / `source-video`） */
function isVideoNodeType(type: string | undefined): boolean {
  return type === 'video' || type === 'ai-video' || type === 'source-video';
}

/**
 * 官方 `g8(e, t = [], n)` @582802 —— 节点 → `{sourceFileId, asset}`（MTV 版）。
 *
 * 官方逐字：
 * ```js
 * const s = wp(e.data), r = cl(n, s.src),
 *       i = cl(s.currentSourceFileId) || Xs(r ?? "") || t[0];
 * if(!r || !i) return;
 * const a = wp(s.params), c = wp(s.__metadata),
 *       d = e.type === he.VIDEO ? hs(ur(r), Pn.THUMBNAIL_V2) : void 0;
 * return { sourceFileId:i, asset: O_({ generationType:e.type, sourceUrl:r, thumbnailUrl:d,
 *          sourceNodeId:e.id, nodeTitle:cl(s.title), prompt:cl(s.prompt),
 *          modelName:cl(a.model), additionalParameters:a, metadata:c }) };
 * ```
 *
 * ⚠️ MTV 偏离（逐条，见文件头）：
 *   · `n`（画廊传来的 `mediaSrc`）→ MTV 由调用方给 `mediaSrc`；
 *   · `s.src` → MTV 依次尝试 `imageUrl / videoUrl / audioUrl / sourceUrl`；
 *   · `cl(s.currentSourceFileId) || Xs(r) || t[0]` 的第三档 `registeredFileIds[0]`
 *     → MTV 用 `assetId → relativePath → filePath`（`Qd.nodeToFiles` 索引 MTV 没有）；
 *   · `d = hs(ur(r), Pn.THUMBNAIL_V2)`（官方 CDN 缩略图变体）→ MTV 没有变体服务
 *     ⇒ 直接用节点自己的 `thumbnailUrl`（内容等价，与 `officialPilePreviewContent.ts` 同一条记账）。
 */
export function favoriteTargetOf(
  node: FavoriteNodeLike,
  mediaSrc?: string,
): FavoriteTarget | null {
  /** 官方 `wp(e.data)` */
  const data = (node.data && typeof node.data === 'object' && !Array.isArray(node.data)
    ? node.data
    : {}) as Record<string, unknown>;
  /** 官方 `r = cl(n, s.src)` */
  const sourceUrl = firstNonEmptyString(
    mediaSrc,
    data.imageUrl,
    data.videoUrl,
    data.audioUrl,
    data.sourceUrl,
  );
  if (!sourceUrl) return null;

  /** 官方 `i = cl(s.currentSourceFileId) || Xs(r ?? "") || t[0]`（第三档见文件头记账） */
  const sourceFileId =
    firstNonEmptyString(data.currentSourceFileId)
    ?? officialSourceFileIdFromUrl(sourceUrl)
    ?? firstNonEmptyString(data.assetId, data.relativePath, data.filePath);
  if (!sourceFileId) return null;

  const params = (data.params && typeof data.params === 'object' && !Array.isArray(data.params)
    ? data.params
    : {}) as Record<string, unknown>;
  const metadata = (data.__metadata && typeof data.__metadata === 'object' && !Array.isArray(data.__metadata)
    ? data.__metadata
    : {}) as Record<string, unknown>;

  return {
    sourceFileId,
    asset: {
      generationType: node.type ?? '',
      sourceUrl,
      ...(isVideoNodeType(node.type)
        ? { thumbnailUrl: firstNonEmptyString(data.thumbnailUrl) }
        : {}),
      sourceNodeId: node.id,
      nodeTitle: firstNonEmptyString(data.title),
      prompt: firstNonEmptyString(data.prompt),
      modelName: firstNonEmptyString(params.model),
      additionalParameters: params,
      metadata,
    },
  };
}
