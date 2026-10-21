/**
 * downloadArchivePlan —— 官方「下载全部」的**分界与命名规则**（纯函数，便于单测）。
 *
 * 官方事实（`zoom-slider-3ZcFvYQO.js`，逐字；交叉验证见 `taskbar-official-report.md` §3）：
 * ```js
 * // @char2762764  产出 file_items：按 file_id **全局去重**，并顺带算 downloadableNodeCount
 * function m0(e,t){const n=[],s=new Set;
 *   for(const i of e){const a=W9e(i),c=a.length>0?a:U9e(i).map(Xs).filter(d=>!!d);
 *     for(const d of c)s.add(i.id),n.push({file_id:d,node_id:i.id,canvas_id:t??null})}
 *   const r=new Set;
 *   return{items:n.filter(i=>r.has(i.file_id)?!1:(r.add(i.file_id),!0)),downloadableNodeCount:s.size}}
 *
 * // @char35181  archive 判定：**去重后的「文件数」** > 1（不是节点数）
 * function XU(e){return e.length>1}
 * // @char35280  mimeType：多文件 => application/zip（eae="application/zip" @34229）；单文件 => ""
 * function ZU(e){return e?eae:""}
 * // @char2763074  建议文件名：<=1 个文件时**不给** download_name；否则 canvas_<yyyyMMddHHmmss>
 * function $9e(e){if(!(e.length<=1))return`${H9e}_${m3(new Date())}`}   // H9e="canvas" @2762325
 * // 建议文件名收口：mode==="archive" 时补 .zip
 * function NL(e){const t=e.task,
 *   n=t.result?.download_name||(t.mode==="direct"?t.items?.[0]?.file_name:void 0)||t.download_name||"download";
 *   return t.mode!=="archive"||n.toLowerCase().endsWith(".zip")?n:`${n}.zip`}
 * ```
 * 官方实测（CDP 抓 POST body，未真下载）：`download_name = "canvas_20260925165619"`（**本地时间** yyyyMMddHHmmss）。
 *
 * MTV 的差异：官方 zip 由**服务端**产出（客户端只 POST `file_items` + `download_name`，再下 `download_url`）；
 * MTV 没有服务端 ⇒ 由 `fileService.saveNodeOutputsToDirectory` 用 JSZip **本地打包**。
 * 另外官方有服务端 `file_id`，MTV 没有 ⇒ 用「本地文件路径 > 媒体 URL > 节点 id」代替（见 `batchFileIdentity`）。
 */

/** 参与批量下载的一项里，本模块只关心这几个字段（`fileService.BatchSaveItem` 是它的超集） */
export interface DownloadFileIdentity {
  id: string;
  filePath?: string;
  mediaUrl?: string;
  textOutput?: string;
}

export type DownloadPlanMode = 'direct' | 'archive';

export interface DownloadPlan<T> {
  /** `direct` = 去重后只有 1 个文件（原始单文件，不加 zip）；`archive` = 去重后 > 1 个文件 */
  mode: DownloadPlanMode;
  /** 身份 ⇒ 该身份下的全部项（同一文件被多个节点引用时，这些项都算「已完成」） */
  groups: T[][];
  /** 去重后的代表项（保留**首次出现**的顺序，与官方 `file_items` 的 push 顺序一致） */
  uniqueItems: T[];
}

/**
 * 一个待下载项的**文件身份**（官方 `file_id` 的 MTV 等价物）：
 *   · 有本地文件路径 ⇒ 按路径（同一文件被多个节点引用 ⇒ 同一个身份，与官方同义）
 *   · 否则有媒体 URL ⇒ 按 URL
 *   · 都没有（纯文本输出）⇒ 按**节点 id** 各算一条（官方 `U9e(i).map(Xs)` 的兜底也是按节点取）
 */
export function batchFileIdentity(item: DownloadFileIdentity): string {
  if (item.filePath) return `path:${item.filePath}`;
  if (item.mediaUrl) return `url:${item.mediaUrl}`;
  return `text:${item.id}`;
}

/** 官方 `m0` 的去重 + `XU` 的分界（纯函数，单测见 `tests/services/downloadArchivePlan.test.ts`） */
export function planDownload<T extends DownloadFileIdentity>(items: readonly T[]): DownloadPlan<T> {
  const byIdentity = new Map<string, T[]>();
  for (const item of items) {
    const key = batchFileIdentity(item);
    const bucket = byIdentity.get(key);
    if (bucket) bucket.push(item);
    else byIdentity.set(key, [item]);
  }
  const groups = [...byIdentity.values()];
  return {
    // 官方 `XU(e) = e.length > 1`：严格大于 1 才打包
    mode: groups.length > 1 ? 'archive' : 'direct',
    groups,
    uniqueItems: groups.map((bucket) => bucket[0]),
  };
}

/**
 * 官方 `$9e` 的 `canvas_<yyyyMMddHHmmss>`（**本地时间**，与官方实测的 `canvas_20260925165619` 同口径）。
 * 调用方负责补 `.zip`（官方 `NL(task)` 也是分开两步）。
 */
export function canvasArchiveStamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
    + `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

/** 官方 zip 的建议文件名（不含目录） */
export function canvasArchiveFileName(now: Date): string {
  return `canvas_${canvasArchiveStamp(now)}.zip`;
}

/**
 * zip **包内**条目名去重 —— ⚠️ 官方这一层客户端看不到（只拿得到 `download_url` / `file_count`），
 * 所以「同名补 `_1/_2`」是 **MTV 自定**（与项目里 `resolveUniqueDestPath` 的补号口径一致）。
 */
export function uniqueZipEntryNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((base) => {
    let name = base;
    let counter = 1;
    while (used.has(name)) {
      const dot = base.lastIndexOf('.');
      name = dot > 0 ? `${base.slice(0, dot)}_${counter}${base.slice(dot)}` : `${base}_${counter}`;
      counter += 1;
    }
    used.add(name);
    return name;
  });
}
