/**
 * officialVideoNodeVariant —— 官方**视频节点变体分派**（`data.type`）与官方**标题命名逻辑**。
 *
 * ══ 官方逐字（`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`，偏移 = JS 字符串 charIdx）══
 *
 * ① 变体枚举 `_o` @152208（**不是**节点类型；官方节点类型在 react-flow 的 `node.type` 上）：
 * ```js
 * var _o=(e=>(e.UPLOAD="upload",e.GENERATE="generate",e.UPSCALE="upscale",e.CLIP="clip",e))(_o||{})
 * ```
 *
 * ② 分派表 + 分派组件 `vV` / `fse` @2093744（`fse.displayName="VideoNode"`）：
 * ```js
 * const vV={[_o.UPLOAD]:dse,[_o.GENERATE]:cse,[_o.CLIP]:qoe,[_o.UPSCALE]:mse},
 * fse=a.memo(e=>{const t=a.useMemo(()=>{const o=e.data.type||_o.GENERATE;return vV[o]||vV[_o.GENERATE]},[e.data.type]);
 *   return ka(o=>o.playlistNodeCount>0)?s.jsx(ZYe,{…children:s.jsx(t,{...e})}):s.jsx(t,{...e})});
 * ```
 * ⇒ **缺省 = `GENERATE`**；未知值 → `vV[_o.GENERATE]`。
 *
 * ③ 标题：外层壳 `gr`（= `pLe` @846915）逐字
 * ```js
 * H = y?.title || i || "Title"      // y=data（官方 data.title）· i=defaultTitle
 * ```
 * 各变体的 `defaultTitle` 逐字：
 * · GENERATE `cse` @2076580：`C=n?.title||"Video"`（**硬编码，不走 i18n**）→ `defaultTitle:C`
 * · UPLOAD   `dse` @2081160：**不传 `defaultTitle`** ⇒ 落到 `data.title || "Title"`
 *     建卡工厂 `ePe` @741800：`data:{src:"",title:"Upload Video",type:_o.UPLOAD,...e}`
 *     真实上传链路 `S0t` @3522844：`KT({src:t,title:qO(e,"Video")},{position:n})`
 *     文件名取标题 `function qO(e,t){}` @3522516：`return e.name?.split(".")[0]||t`
 *     ⇒ **上传节点标题 = 文件名去掉扩展名**（不是「Video」，也不是带扩展名的文件名）
 * · CLIP     `qoe` @1977578：`defaultTitle:o?.title||l("video.clip")`     —— MTV 无实现
 * · UPSCALE  `mse` @2093105：`defaultTitle:o?.title||l("video.upscale")`  —— MTV 无实现
 * 渲染处 `WDe` @833604：`children:e`（**原样输出 `data.title`，全链无本地化**）
 * 生成卡工厂 `Tr` @743392：`C={src:"",prompt:"",title:"Video",type:_o.GENERATE,…}`
 * 增强卡工厂 `GZ` @743866：`u={src:"",prompt:"",title:"Upscale Video",type:_o.UPSCALE,…}`
 *
 * ══ ⚠️ MTV 适配点（唯一的偏离，必须记账）══
 * 官方把变体放在 **`data.type`** 上；MTV 的 `data.type` **已经被 `NodeType` 占用**
 * （`'ai-video' | 'source-video' | …`，全仓 ~200 处读写），两者同名不同义。
 * 直接抢占会让 `data.type === 'generate'` 的节点在 `Canvas.nodeTypes` 里找不到组件。
 * ⇒ MTV 把官方 `data.type` 的**值域与语义**原样搬到一个**不冲突的槽** `data.videoNodeType`：
 *    · 值 = 官方 `_o` 的**同一批字面量**（`'upload' | 'generate' | 'upscale' | 'clip'`）
 *    · 缺省 = 官方 `_o.GENERATE`（`'generate'`）
 *    · 未知值 → `'generate'`（= 官方 `vV[o]||vV[_o.GENERATE]`）
 *    · **历史数据兼容**：没有该字段时，MTV 旧的 `role:'source'` 等价于官方 `_o.UPLOAD`
 *      （官方上传节点的唯一来源就是「从文件进来」），其余一律官方默认 `GENERATE`。
 */
import type { BaseNodeData } from '../types';

/** 官方 `_o` @152208 逐字值域 */
export const OFFICIAL_VIDEO_NODE_TYPE = {
  UPLOAD: 'upload',
  GENERATE: 'generate',
  UPSCALE: 'upscale',
  CLIP: 'clip',
} as const;

export type OfficialVideoNodeType =
  (typeof OFFICIAL_VIDEO_NODE_TYPE)[keyof typeof OFFICIAL_VIDEO_NODE_TYPE];

/** 官方分派缺省 —— `e.data.type||_o.GENERATE` */
export const DEFAULT_OFFICIAL_VIDEO_NODE_TYPE: OfficialVideoNodeType =
  OFFICIAL_VIDEO_NODE_TYPE.GENERATE;

const OFFICIAL_VIDEO_NODE_TYPES: ReadonlySet<string> = new Set(
  Object.values(OFFICIAL_VIDEO_NODE_TYPE),
);

export function isOfficialVideoNodeType(value: unknown): value is OfficialVideoNodeType {
  return typeof value === 'string' && OFFICIAL_VIDEO_NODE_TYPES.has(value);
}

/** 变体字段在 MTV 数据上的键名（见文件头「MTV 适配点」） */
export const VIDEO_NODE_TYPE_FIELD = 'videoNodeType' as const;

/**
 * 官方 `fse` @2093744 的分派解析，原样搬到 MTV 的字段槽。
 * `vV[o] || vV[_o.GENERATE]` ⇒ 未知值一律回落 GENERATE。
 */
export function resolveOfficialVideoNodeType(
  data: (Partial<BaseNodeData> & Record<string, unknown>) | null | undefined,
): OfficialVideoNodeType {
  const raw = data?.[VIDEO_NODE_TYPE_FIELD];
  if (isOfficialVideoNodeType(raw)) return raw;
  /* MTV 历史数据兼容：`role:'source'` = 从文件进来的卡 = 官方 `_o.UPLOAD` 体 */
  if (data?.role === 'source') return OFFICIAL_VIDEO_NODE_TYPE.UPLOAD;
  return DEFAULT_OFFICIAL_VIDEO_NODE_TYPE;
}

/** 官方 `qO` @3522516：`function qO(e,t){return e.name?.split(".")[0]||t}` */
export function officialUploadTitleFromFileName(
  fileName: string | null | undefined,
  fallback: string,
): string {
  if (typeof fileName !== 'string' || fileName.length === 0) return fallback;
  return fileName.split('.')[0] || fallback;
}

/**
 * MTV 历史默认标题 —— 这些值**不是用户手改的标题**，而是 MTV 旧的「节点类型默认」被写死在
 * `data.label` 里造成的残留（`useConnectionDropMenu` / `useKeyboardShortcuts` /
 * `useNodeCreation` 的老路径）。官方是 `data.title || defaultTitle`，即「用户设过就用用户的」，
 * 所以这里把 MTV 的旧默认值视为「未自定义」。**用户真正改过的标题不在集合里，原样保留。**
 */
export const MTV_LEGACY_VIDEO_NODE_LABELS: ReadonlySet<string> = new Set([
  /* MTV 旧默认（§96 之前 `useConnectionDropMenu` / `useKeyboardShortcuts` 写的自造文案）。
     §96 已把那些调用点改成**官方逐字「视频」**，所以现在只剩「历史 `data.label` 归一化」这一个用途
     —— 集合项必须保留，删了老项目的卡片标题就会被当成「用户自定义标题」原样显示。 */
  '生成视频',
  '视频',
]);

/** 官方 `cse` @2076580：`C=n?.title||"Video"` */
export const OFFICIAL_VIDEO_NODE_DEFAULT_TITLE = 'Video';
/** 官方 `ePe` @741800：`title:"Upload Video"` */
export const OFFICIAL_UPLOAD_VIDEO_NODE_DEFAULT_TITLE = 'Upload Video';

/**
 * 标题解析 = 官方 `data.title || defaultTitle` 的 MTV 版。
 *
 * 返回顺序：
 *   1. `data.label`（= 官方 `data.title`）**是用户自定义时**原样返回；
 *   2. 否则按变体给官方默认：
 *      · UPLOAD  → `qO(fileName, 'Video')`（文件名去扩展名）；没有文件名 → `'Upload Video'`
 *      · GENERATE → `'Video'`
 *      · UPSCALE / CLIP → MTV 无实现（分派已回落 GENERATE）⇒ 一律 `'Video'`，
 *        官方 `mse`/`qoe` 的 `video.upscale` / `video.clip` 本地化默认**未落地**，见报告。
 */
export function resolveOfficialVideoNodeTitle(
  data: (Partial<BaseNodeData> & Record<string, unknown>) | null | undefined,
): string {
  const variant = resolveOfficialVideoNodeType(data);
  const rawLabel = typeof data?.label === 'string' ? data.label : '';
  const fileName = typeof data?.fileName === 'string' ? data.fileName : '';
  const isLegacy =
    rawLabel.length === 0
    || MTV_LEGACY_VIDEO_NODE_LABELS.has(rawLabel)
    /* MTV 上传路径把 `label` 直接写成**带扩展名的文件名**（`useNodeCreation.ts:443` /
       `store.clipboard.ts:745`）⇒ 与 `fileName` 相同即「未自定义」，官方口径是 `qO` 去扩展名。 */
    || (fileName.length > 0 && rawLabel === fileName);
  if (!isLegacy) return rawLabel;

  if (variant === OFFICIAL_VIDEO_NODE_TYPE.UPLOAD) {
    return fileName.length > 0
      ? officialUploadTitleFromFileName(fileName, OFFICIAL_VIDEO_NODE_DEFAULT_TITLE)
      : OFFICIAL_UPLOAD_VIDEO_NODE_DEFAULT_TITLE;
  }
  return OFFICIAL_VIDEO_NODE_DEFAULT_TITLE;
}
