/**
 * officialVideoNodeParams —— 官方 `Tr`（生成视频节点工厂）的 **`params` 种子**。
 *
 * ══ 官方逐字（`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`）══
 * `Tr` @743227 邻域：
 * ```js
 * const f=e.params?.model||m||p, h=Zs[f],
 *       x=(e.params?.modelType?h.variants.find(k=>k.modelType===e.params?.modelType):null)||h.variants[0],
 *       w={model:f,provider:h.provider,modelType:x?.modelType||null,...x?.defaults||{},
 *          ...y?.aspectRatio!==void 0&&{aspectRatio:y.aspectRatio},
 *          ...y?.duration!==void 0&&{duration:y.duration},
 *          ..._!==void 0&&{resolution:_},
 *          ...y?.times!==void 0&&{times:y.times},
 *          ...v&&y?.generateAudio!==void 0&&{generateAudio:y.generateAudio},
 *          ...y?.generateMode!==void 0&&{generateMode:y.generateMode}},
 *       C={src:"",prompt:"",title:"Video",type:_o.GENERATE,...o, params:{...w,...e.params}};
 * ```
 * ⇒ 建卡时 **`params.modelType` 必须被写入** —— 官方 `LXe` @1991362 的 `state.modelType`
 *   读的就是它；缺省 ⇒ `dd(null)=null` ⇒ 底部 chip 的「生成方式」段不 push
 *   （用户实测「生成方式」缺失的直接原因）。同一批 `variants[0].defaults`
 *   （`aspectRatio` / `duration` / `resolution` / `generateAudio`）一并铺进 `params`，
 *   比例 / 清晰度 / 时长三段随之有值。
 *
 * ⚠️ **MTV 适配点**：
 *  1. 官方 `h.provider` 来自目录表条目；MTV 的 `model-param-catalog.json` 是**按 variants
 *     抽取**的，条目顶层没有 `provider` ⇒ provider 由调用方（模型偏好）传入。
 *  2. MTV 的请求层读的是**平铺**在 `data` 上的字段（`seedanceRatio` / `seedanceResolution` /
 *     `seedanceDuration` / `generateAudio`，见 `types/index.ts`），官方只写 `params`
 *     ⇒ 建卡时两边都写：`params` 照官方原样，平铺字段供 MTV 请求层消费。
 *
 * ⚠️ **本文件单独成模块**：它依赖 `services/ai/modelParamCatalog`（会拉 127KB 的官方目录 JSON），
 *    而 `utils/officialVideoNodeVariant.ts` 被 **store 侧**（`store/store.nodes.ts` →
 *    `utils/officialInputBar.ts`）引用。把目录依赖混进那条链会出现模块求值顺序问题
 *    （Vite HMR 实测：`Cannot access 'createNodeSlice' before initialization`）
 *    ⇒ 纯逻辑（变体/标题）留 `officialVideoNodeVariant`，**带目录依赖的种子单独放这里**。
 */
import { getParamEntry } from '../services/ai/modelParamCatalog';

/** 官方 `Tr` @743227 的 `params` 种子（`w = {model, provider, modelType, ...defaults}`）。 */
export function officialVideoNodeParamsSeed(
  model: string | undefined,
  provider: string | undefined,
): Record<string, unknown> {
  const entry = getParamEntry(model);
  const variant = entry?.variants?.[0];
  return {
    ...(model ? { model } : {}),
    ...(provider ? { provider } : {}),
    modelType: variant?.modelType ?? null,
    ...(variant?.defaults ?? {}),
  };
}

/**
 * MTV 请求层读的**平铺**默认值（见文件头「MTV 适配点 2」）。
 * 取值源与 `officialVideoNodeParamsSeed` 完全同一处（`variants[0].defaults`）。
 */
export function officialVideoNodeFlatDefaults(
  model: string | undefined,
): Record<string, unknown> {
  const defaults = getParamEntry(model)?.variants?.[0]?.defaults ?? {};
  const flat: Record<string, unknown> = {};
  if (typeof defaults.aspectRatio === 'string') flat.seedanceRatio = defaults.aspectRatio;
  if (typeof defaults.resolution === 'string') flat.seedanceResolution = defaults.resolution;
  if (typeof defaults.duration === 'number') flat.seedanceDuration = defaults.duration;
  if (typeof defaults.generateAudio === 'boolean') flat.generateAudio = defaults.generateAudio;
  return flat;
}
