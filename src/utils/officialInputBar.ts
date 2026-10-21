/**
 * officialInputBar —— 官方「底部编辑区」（`GENERATION_INPUT_BAR`）的可见性门。
 *
 * ══ 官方源码（`course-api-base-url-*.js`，本轮实读）══
 * ```js
 * const V = Gi(nodeId)?.data?.hide_inputbar === true;     // R
 * const ae = Vg();                                        // 选中数
 * const be = ae <= 1 && !V;                               // pe
 * const ce = be && visible && !isAnyNodeDragging && !inProgress;   // le
 * if (!be) return;                                        // ★ 置位 ⇒ 整条**不渲染**
 * … className: Z("node-float-ui generation-input-bar-width-transition nodrag cursor-default
 *                absolute -bottom-2 z-20 …", ce ? "node-float-ui-visible" : "node-float-ui-hidden")
 * ```
 *
 * ══ 9444 官方实测（同一张画布，逐节点取 `[data-testid="canvas-node-generation-input-bar"]`）══
 * | 节点 | 卡面 | 编辑条 |
 * | --- | --- | --- |
 * | `Image替换` | 上传的参考卡（有「替换」钮） | **ABSENT** |
 * | `抠图` / `zhanbao替换` / `大理贴替换` | 同上 | **ABSENT** |
 * | `图片生成` / `游说学子`×3 | 生成卡 | **VISIBLE** |
 *
 * ⇒ 结论（用户也逐字确认过）：**从本地/网络上传、或粘贴到画布的图像卡，官方不出现卡片底部编辑区。**
 *   判据 = 卡片是不是「从文件进来的参考卡」：
 *     · 官方口径：节点数据上的 `hide_inputbar`（官方持久化字段，见 `types/index.ts`）；
 *     · MTV 老数据没有这个字段 ⇒ 追加一条**等价判据**：`role === 'source' && fileName` 非空
 *       —— 这两个字段正是上传/粘贴两条路径写进去的（`ImageNode.handleUpload`、
 *          `store.clipboard.ts::pasteExternalFromDataTransfer`），也正好等于卡片上「替换」按钮的门。
 *
 * ⚠️ 只挡「**选中**」这条路径（点卡片 / 空格）。卡片工具栏上的「重绘」是**显式**打开，照旧工作。
 *
 * ══ ⚠️ 官方底部浮条有**两支**，上面记的是「生成类」那一支（第 65 轮补充）══
 * 官方**处理类**节点（视频增强等）用的是**另一个容器 class**，逐字（`vendor-pkg-canvas-CvbAwZyy.js`）：
 * ```js
 * // KYe @1950453（该节点自己的底部面板）
 * className: z("nodrag cursor-default absolute -bottom-2 z-20 w-full", "min-w-[400px]",
 *              "node-float-ui-visible")
 * style: { left:"50%", "--float-y":"100%", "--float-offset":"-12px", transformOrigin:"top center" }
 * // 内壳：div.bg-card.rounded-2xl.shadow-xl.p-4.w-full.space-y-4
 * // 另一支同形 @2087244：内壳 div.bg-white.dark:bg-zinc-800.rounded-2xl.shadow-xl.mt-3.p-4.w-full
 * ```
 * ⇒ 处理类那一支**没有** `node-float-ui`、**没有** `generation-input-bar-width-transition`（无宽度过渡）、
 * **没有** `data-testid="canvas-node-generation-input-bar"`，宽度是 `w-full min-w-[400px]` 而不是
 * `w-max max-w-[min(960px,calc(100vw-32px))]`。
 * 2026-10 官方真机实测（同一张官方画布上的「视频增强」节点）读数与源码一致：
 * `nodrag cursor-default absolute -bottom-2 z-20 w-full min-w-[400px] node-float-ui-visible`。
 * MTV 目前**没有**这类节点（`upscale` 真行为按用户决定不建）⇒ `AINodeDialog` 只实现了「生成类」那一支；
 * 将来要建处理类节点时，**不要**套 `generation-input-bar-width-transition` / testid。
 */
import type { BaseNodeData } from '../types';
import {
  OFFICIAL_VIDEO_NODE_TYPE,
  resolveOfficialVideoNodeType,
} from './officialVideoNodeVariant';

/**
 * 「从文件进来的图像卡」的两种节点类型。
 *
 * ⚠️ 为什么必须有 `source-image`：MTV 里**从文件进画布的图**有两条创建路径 ——
 *   · `store.clipboard.ts` 的粘贴 / `ImageNode.handleUpload` 的「替换」→ `ai-image` + `role:'source'`
 *   · `canvasResourceImportService.importLocalResources`（拖文件进画布 / 粘贴板资源）与
 *     `store.dramaAssets`、`shotlistStoryboardService` → **`source-image`**
 *   而这两个门以前**只认 `ai-image`**（官方源码里只有一种图卡类型，MTV 拆成了两种），
 *   于是所有 `source-image` 卡（拖进来的图、「图片往返」回传/推送的卡）都会渲染一条**只剩
 *   「选择模型」的半截编辑条** —— 看起来像按钮丢了。按官方口径「文件进来的参考卡不渲染底部编辑区」，
 *   这两类都该被挡掉，所以类型集合并进来。
 */
const FILE_BACKED_IMAGE_TYPES: ReadonlySet<string> = new Set(['ai-image', 'source-image']);

/**
 * 「从文件进来的**视频**卡」的两种节点类型（§93 新增）。
 *
 * 官方视频卡的**变体**在这里是硬门：`cse`（`GenerateVideoNode`）才挂 `Su`（底部生成输入条 +
 * 生成控件），`dse`（`UploadVideoNode`）**根本不渲染 `Su`**（逐字见 `utils/officialVideoNodeVariant.ts`）。
 * MTV 的底部输入条由 `AINodeDialog` 按节点选中态渲染 ⇒ 需要一条「本节点是不是 UPLOAD 体」的判据。
 */
const FILE_BACKED_VIDEO_TYPES: ReadonlySet<string> = new Set(['ai-video', 'source-video']);

/** 该节点是否属于官方「不渲染底部编辑区」的那一类（参考卡 / 已置位 `hide_inputbar`）。 */
export function isInputBarSuppressedNode(
  type: string | undefined,
  data: BaseNodeData | undefined | null,
): boolean {
  if (!data) return false;
  if (data.hide_inputbar === true) return true;
  /* §93 视频卡：官方 UPLOAD 变体（`dse`）**不渲染 `Su`**（底部生成输入条），
     只有 GENERATE 变体（`cse`）才有 ⇒ 按官方变体分派挡住。 */
  if (FILE_BACKED_VIDEO_TYPES.has(type ?? '')
    && resolveOfficialVideoNodeType(data) !== OFFICIAL_VIDEO_NODE_TYPE.GENERATE) {
    return true;
  }
  /* MTV 老数据兜底：上传/粘贴写进去的那两个字段（= 卡片「替换」按钮的门） */
  return FILE_BACKED_IMAGE_TYPES.has(type ?? '')
    && data.role === 'source'
    && typeof data.fileName === 'string'
    && data.fileName.length > 0;
}

/**
 * 插入/上传时按官方口径打标：**从文件进来的图像卡**（`fileName` 非空）⇒ `hide_inputbar: true`。
 * 已经是 `undefined` 之外的显式值（含 `false`）时不覆盖，保留调用方的意图。
 */
export function markHideInputBarForFileBackedImage(
  type: string | undefined,
  data: BaseNodeData,
): BaseNodeData {
  if (data.hide_inputbar !== undefined) return data;
  if (!FILE_BACKED_IMAGE_TYPES.has(type ?? '')) return data;
  const fileBacked = typeof data.fileName === 'string' && data.fileName.length > 0;
  return fileBacked ? { ...data, hide_inputbar: true } : data;
}
