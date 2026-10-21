/**
 * 官方 **per-model 参数目录** 的 MTV 载具（chips 的 options 真源）。
 *
 * ## 数据来源（逐字，未改写）
 * `src/data/model-param-catalog.json` = `D:\DEEPSEEK\_r63_model_param_catalog.json` 的逐字复制
 * （98 个模型：image 30 / video 55 / audio 13），由对官方产物
 * `vendor-packages-DRvCmDjR.js`（SHA-256 `b43060df…df904b` 同批产物）切片求值得到：
 *
 * | 官方表 | 官方本地名 | 载具字段 | 定义偏移 |
 * |---|---|---|---|
 * | 图像目录 | `qo`（`Jt`） | JSON 里 `kind:"image"` 的条目 | 1103726 |
 * | 视频目录 | `Hp`（`R2`）→ 表 `Fe` | `kind:"video"` | `Fe@1158162` |
 * | 音频目录 | `Af`（`kue`） | `kind:"audio"` | 1088393 |
 *
 * ## 官方消费方（本文件逐字移植的函数）
 *
 * | 本文件导出 | 官方符号 | 偏移 | 逐字来源 |
 * |---|---|---|---|
 * | `imageModelInfo` | `Db` | canvas:@2247409 | 完整函数体已切片 |
 * | `videoModelInfo` / `resolveVariant` | `qI` / `jre` / `Ire` | 2250420 / 2248144 / 2247183 | 完整 |
 * | `resolveExprList` | `$I` | 2246961 | 完整（含 19 个 `$expr` 求值器） |
 * | `modelIsFree` | `Og` | 2250212 | 完整 |
 * | `isSubscriptionRestricted` / `passesSubscriptionGate` | `E2` / `Dz`(=`Xb`) | vendor-packages:@976192 / 976231 | 完整 + `jz=new Set(Lz)`（vendor@976032，`Lz` 89 项已逐字抄回） |
 * | `videoMethodKeys` / `methodKeyOfModelType` | `EJ` / `dd` / `aDe` | 815812 / 815624 / 815397 | 完整 |
 * | `preferEnabledOptions` | `Pre` | 2250190 邻域 | 完整（`[...filter(!disabled), ...filter(disabled)]`） |
 *
 * ## 纪律
 * - `$expr` 值**不 eval**：按**逐字源码串**白名单映射到本文件里的字面翻译；白名单外的
 *   `$expr` ⇒ 返回 `undefined`（⇒ 无选项 ⇒ 该 chip 隐藏）。**绝不补默认值**。
 * - `variants[].modelType` 是官方 `zt`（=模型模式枚举）的字符串值（`text_to_video` / … / `digital_human`），
 *   与 `aDe` 的键集**完全一致**（8 值），故 `methodKeyOfModelType` 是逐字映射。
 * - `lockedDurations` / `lockedResolutions` **官方 chip 路径从不读取**（`jre` 只对
 *   `options.durations` / `options.resolutions` 调 `$I`）⇒ 本文件也不读，避免"等价实现"。
 */
import RAW from '../../data/model-param-catalog.json';
import MTV_MODEL_META from '../../data/official-model-meta.json';

export type ParamCatalogKind = 'image' | 'video' | 'audio';

/** 官方 `$expr`：源码里是函数、无法静态求值的字段（逐字源码串）。 */
export interface CatalogExpr {
  $expr: string;
}
export type CatalogValue<T> = T[] | CatalogExpr;

export interface CatalogRange {
  min?: number;
  max?: number;
}

export interface CatalogVariant {
  key?: string;
  modelType?: string;
  aspectRatioPolicy?: 'forbidden' | 'derived_from_reference' | 'optional' | 'required' | string;
  referenceImageRange?: CatalogRange;
  referenceVideoRange?: CatalogRange;
  referenceAudioRange?: CatalogRange;
  /**
   * 官方 variant 上的 `referenceAudioRequiresCompanion`（vendor-packages 视频目录表，
   * 全表 1 处）。官方 `_p`（`y9`@1220052）用它做一条额外否决：
   * `i.referenceAudioRequiresCompanion && r>0 && n===0 && s===0 ⇒ false`。
   */
  referenceAudioRequiresCompanion?: boolean;
  options?: {
    aspectRatios?: CatalogValue<string>;
    durations?: CatalogValue<number>;
    resolutions?: CatalogValue<string>;
    qualityOptions?: string[];
    /** 官方 KLING_VIDEO_O3 用 `modes` 代替 `qualityOptions`。 */
    modes?: string[];
    timesOptions?: number[];
    supportsAudio?: boolean;
    omniReference?: boolean;
  };
  defaults?: {
    aspectRatio?: string;
    duration?: number;
    resolution?: string;
    generateAudio?: boolean;
    generateMode?: string;
  } & Record<string, unknown>;
}

export interface CatalogEntry {
  kind: ParamCatalogKind;
  label?: string;
  isFree?: boolean;
  isHidden?: boolean;
  isComingSoon?: boolean;
  externalModelIds?: string[];
  /**
   * 官方 `Fe[modelId].referenceLabelKey`（视频目录表的**顶层**字段，不在 `variants` 里）。
   * 逐字形态见 `vendor-packages-DRvCmDjR.js`：`Nq={model:Y.SEEDANCE_2_0,…,referenceLabelKey:"videoConfigs.referenceOmni",…}`
   * （全表 6 处：`SEEDANCE_2_0` / `SEEDANCE_2_0_FAST` / `SEEDANCE_2_0_MINI` / `SEEDANCE_2_5` /
   *  `KLING_VIDEO_O1` / `KLING_VIDEO_O3`，值**全部**是 `"videoConfigs.referenceOmni"`）。
   *
   * ✅ **已按上面那条路径重新抽取补齐**（本次 §69）：`src/data/model-param-catalog.json` 里
   *   `seedance-2.0` / `seedance-2.0-fast` / `seedance-2.0-mini` / `seedance-2.5` /
   *   `kling-video-o1` / `kling-video-o3` 六个条目各自带上了
   *   `"referenceLabelKey": "videoConfigs.referenceOmni"`（全表 **6 处**，与官方逐字一致）。
   *   抽取点（vendor-packages-DRvCmDjR.js，逐字）：
   *   `Nq={model:Y.SEEDANCE_2_0,…}`@1111070 内 `referenceLabelKey:"videoConfigs.referenceOmni"`@1111383、
   *   `Sq`@1112754 内 @1112990、`Rq`@1114286 内 @1114606、`f1`@1116137 内 @1116487、
   *   `Xq`@1132135 内 @1132357、`Qq`@1134537 内 @1134750；
   *   枚举值 `Y.SEEDANCE_2_0="seedance-2.0"` 等见 vendor-packages @1106327。
   *   ⇒ `videoGenerateMethodLabelKey`（官方 `VA`）现在对 seedance 系列在 `reference` 档上
   *   直接命中官方第一档 `videoConfigs.referenceOmni`（zh「全能参考」）。
   */
  referenceLabelKey?: string;
  /** image */
  aspectRatios?: CatalogValue<string>;
  imageSizeOptions?: CatalogValue<string>;
  qualityOptions?: string[];
  maxImages?: number;
  batchSizes?: number[];
  defaults?: Record<string, unknown>;
  supportedModes?: string[];
  /** video */
  variants?: CatalogVariant[];
  durations?: CatalogValue<number>;
  resolutions?: CatalogValue<string>;
  timesOptions?: number[];
  supportsAudio?: boolean;
  generateAudio?: boolean;
  defaultDuration?: number;
  defaultResolution?: string;
  defaultAspectRatio?: string;
  _differAcrossVariants?: string[];
  /** audio */
  model?: string;
  provider?: string;
  defaultParams?: Record<string, unknown>;
  supportCustomLyrics?: boolean;
  characterLimit?: number;
  moodSupport?: boolean;
  referenceLimits?: unknown;
  descriptionKey?: string;
  duration?: number | string;
}

const CATALOG = RAW as unknown as Record<string, CatalogEntry>;

export function getParamEntry(modelId: string | undefined): CatalogEntry | undefined {
  if (!modelId) return undefined;
  return CATALOG[modelId];
}

/** 目录声明顺序（= 官方 `Object.keys(qo)` / `Object.keys(Fe)` 的顺序）。 */
export function listParamModelIds(kind: ParamCatalogKind): string[] {
  return Object.entries(CATALOG)
    .filter(([, entry]) => entry.kind === kind)
    .map(([modelId]) => modelId);
}

export function paramCatalogKeys(): string[] {
  return Object.keys(CATALOG);
}

/**
 * **MTV 模型目录**（`src/data/official-model-meta.json`）里该 kind 的模型 id，顺序 = 目录顺序。
 *
 * `hie` 的 model chip 选项来自官方 `gtt`/`btt`：`gtt` 用 `Bet("image")`
 * （`UE("image").filter(selectable!==false).map(modelId)`），`btt` 用**模型 id 字面量数组**。
 * 用户的硬要求是「厂商差异只能从连接配置/模型目录/工作流声明进来」⇒ MTV 用**自己的模型目录**做
 * 候选集与顺序，禁用/过滤判据仍用官方 `Og`(isFree) 与 `Xb`(订阅门控)。见 §56 记录。
 */
export function listDirectoryModelIds(kind: ParamCatalogKind): string[] {
  const table = (MTV_MODEL_META as unknown as Record<string, Record<string, unknown> | undefined>)[kind];
  return table ? Object.keys(table) : [];
}

/** MTV 模型显示名（modelId → displayName），用于 model option 的 `label`。 */
export function listDirectoryModelLabels(kind: ParamCatalogKind): Record<string, string> {
  const table = (MTV_MODEL_META as unknown as Record<string, Record<string, { displayName?: string }> | undefined>)[kind];
  if (!table) return {};
  const out: Record<string, string> = {};
  for (const [modelId, entry] of Object.entries(table)) {
    if (entry && typeof entry.displayName === 'string') out[modelId] = entry.displayName;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 官方 `$I` @2246961 + 19 个 `$expr` 的逐字翻译
 * ------------------------------------------------------------------ */

/** 官方 `dn` @1110853。`Pi` 用它做非付费时长裁剪。 */
const DN = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export interface ExprContext {
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  generateAudio?: boolean;
  generateMode?: string;
  modelType?: string;
  character_orientation?: string;
  isPayingCustomer: boolean;
  [key: string]: unknown;
}

type Evaluator = (ctx: ExprContext) => Array<string | number>;

/**
 * 19 个 `$expr` 的**逐字**翻译。键 = JSON `$expr` 字段的原文（含空白），
 * 值 = 与官方源码**逐字等价**的表达式（含 `K.IMAGE_TO_VIDEO` → 目录里 `modelType` 的字符串值）。
 */
const EXPR_EVALUATORS: Readonly<Record<string, Evaluator>> = {
  'e=>{const t=e.resolution;return t==="1080p"||t==="4k"?[8]:[4,6,8]}': (e) => {
    const t = e.resolution;
    return t === '1080p' || t === '4k' ? [8] : [4, 6, 8];
  },
  'e=>e.isPayingCustomer===!0?[]:dn.filter(t=>t>5)': (e) => (e.isPayingCustomer === true ? [] : DN.filter((t) => t > 5)),
  'e=>e.isPayingCustomer===!0?[]:["720p"]': (e) => (e.isPayingCustomer === true ? [] : ['720p']),
  'e=>e.isPayingCustomer===!0?[]:["1080P"]': (e) => (e.isPayingCustomer === true ? [] : ['1080P']),
  'e=>e.duration===10?["768P"]:["768P","1080P"]': (e) => (e.duration === 10 ? ['768P'] : ['768P', '1080P']),
  'function Wd(e){return e.isPayingCustomer===!0?[]:["1080P"]}': (e) => (e.isPayingCustomer === true ? [] : ['1080P']),
  'e=>e.duration===10?["360P","540P","720P"]:["360P","540P","720P","1080P"]': (e) => (
    e.duration === 10 ? ['360P', '540P', '720P'] : ['360P', '540P', '720P', '1080P']
  ),
  '({aspectRatio:e})=>e==="auto"?[]:["1K","2K","4K"]': (e) => (e.aspectRatio === 'auto' ? [] : ['1K', '2K', '4K']),
  'e=>e.isPayingCustomer===!0?[]:[10]': (e) => (e.isPayingCustomer === true ? [] : [10]),
  'e=>e.isPayingCustomer===!0?[]:["1080p"]': (e) => (e.isPayingCustomer === true ? [] : ['1080p']),
  'e=>e.isPayingCustomer===!0?[]:[10,15]': (e) => (e.isPayingCustomer === true ? [] : [10, 15]),
  'e=>e.isPayingCustomer===!0?[]:["720p","1080p"]': (e) => (e.isPayingCustomer === true ? [] : ['720p', '1080p']),
  'e=>e.isPayingCustomer===!0?[]:[6,7,8]': (e) => (e.isPayingCustomer === true ? [] : [6, 7, 8]),
  'void 0': () => [],
  'e=>e.isPayingCustomer===!0?[]:[6,7,8,9,10]': (e) => (e.isPayingCustomer === true ? [] : [6, 7, 8, 9, 10]),
  'function aX(e){return e.duration===10?["768P"]:["768P","1080P"]}': (e) => (e.duration === 10 ? ['768P'] : ['768P', '1080P']),
  'function i3(e){return e.duration===10?["512P","768P"]:["512P","768P","1080P"]}': (e) => (
    e.duration === 10 ? ['512P', '768P'] : ['512P', '768P', '1080P']
  ),
  'e=>e.character_orientation==="video"?[10,20,30]:[5,10]': (e) => (
    e.character_orientation === 'video' ? [10, 20, 30] : [5, 10]
  ),
  'e=>e.modelType===K.IMAGE_TO_VIDEO?["360p","540p","720p","1080p","2K"]:["360p","540p","720p","1080p"]': (e) => (
    e.modelType === 'image_to_video'
      ? ['360p', '540p', '720p', '1080p', '2K']
      : ['360p', '540p', '720p', '1080p']
  ),
};

/** 白名单是否覆盖全部 `$expr`（构建期自检；缺失的 `$expr` 只会让 chip 隐藏）。 */
export function hasExprEvaluator(expr: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXPR_EVALUATORS, expr);
}

/**
 * 官方 `$I(e, t, n = {}, o = true)`，逐字：
 * ```js
 * function $I(e,t,n={},o=!0){if(!e)return;if(Array.isArray(e))return e.slice();
 *   const r=Object.fromEntries(Object.entries(n).filter(([,i])=>i!==void 0));
 *   return e({...t.defaults,...r,modelType:t.modelType,isPayingCustomer:o})}
 * ```
 * 返回值 `undefined` ⇔ 官方 `return;`（无选项）。白名单外的 `$expr` 同样返回 `undefined`
 * （官方此处必然求值 → MTV 无证据 ⇒ 隐藏，绝不补默认值）。
 */
export function resolveExprList<T extends string | number>(
  value: CatalogValue<T> | undefined,
  variant: Pick<CatalogVariant, 'defaults' | 'modelType'>,
  overrides: Record<string, unknown>,
  isPayingCustomer: boolean,
): T[] | undefined {
  const evaluator = value === undefined
    ? null
    : Array.isArray(value)
      ? null
      : EXPR_EVALUATORS[value.$expr] ?? null;
  /* 数组值：官方 `e.slice()`。 */
  if (Array.isArray(value)) return value.slice() as T[];
  if (!value) return undefined;
  if (!evaluator) return undefined;
  const filtered = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined));
  const ctx: ExprContext = {
    ...(variant.defaults ?? {}),
    ...filtered,
    modelType: variant.modelType,
    isPayingCustomer,
  } as ExprContext;
  return evaluator(ctx) as T[];
}

/* ------------------------------------------------------------------ *
 * 模型信息（官方 `Db` / `jre` / `qI`）
 * ------------------------------------------------------------------ */

export interface ImageModelInfo {
  kind: 'image';
  nameKey: string;
  aspectRatios?: string[];
  imageSizeOptions?: string[];
  maxImages?: number;
  batchSize?: number;
  defaultTimes: number;
  qualityOptions?: string[];
  defaultQuality?: string;
  defaultImageSize?: string;
  defaultAspectRatio?: string;
}

export interface VideoModelInfo {
  kind: 'video';
  nameKey: string;
  aspectRatios?: string[];
  durations?: number[];
  resolutions?: string[];
  qualityOptions?: string[];
  supportsGenerateAudio?: boolean;
  defaultGenerateAudio?: boolean;
  defaultDuration?: number;
  defaultResolution?: string;
  defaultAspectRatio?: string;
  aspectRatioPolicy?: string;
  variantKey?: string;
  modelType?: string;
}

/** 官方 `MIDJOURNEY_V8_2` 的 quality 覆盖常量（`ftt`/`htt`，canvas:@2247372 / @2247393）。 */
const MIDJOURNEY_V8_2_QUALITY_OPTIONS = ['standard', 'hd'];
const MIDJOURNEY_V8_2_DEFAULT_QUALITY = 'standard';

/** 官方 `Db` @2247409（逐字）。 */
export function imageModelInfo(modelId: string | undefined, editedAspectRatio?: string): ImageModelInfo | null {
  const entry = getParamEntry(modelId);
  if (!entry || (entry.kind !== 'image' && entry.kind !== undefined)) return null;
  const isMidjourneyV82 = modelId === 'midjourney-v8.2';
  const aspectRatios = Array.isArray(entry.aspectRatios) ? entry.aspectRatios : undefined;
  const defaults = editedAspectRatio
    ? { ...entry.defaults, aspectRatio: editedAspectRatio }
    : entry.defaults;
  const rawImageSizes = Array.isArray(entry.imageSizeOptions)
    ? entry.imageSizeOptions
    : resolveExprList(entry.imageSizeOptions, { defaults, modelType: undefined }, {}, false);
  const qualityOptions = isMidjourneyV82
    ? [...MIDJOURNEY_V8_2_QUALITY_OPTIONS]
    : entry.qualityOptions;
  const batchSize = typeof entry.batchSizes?.[0] === 'number' ? entry.batchSizes[0] : undefined;
  return {
    kind: 'image',
    nameKey: entry.label ?? String(modelId),
    aspectRatios,
    imageSizeOptions: Array.isArray(rawImageSizes) ? (rawImageSizes as string[]) : undefined,
    maxImages: entry.maxImages,
    batchSize,
    defaultTimes: typeof batchSize === 'number' && batchSize > 1 ? batchSize : 1,
    qualityOptions,
    defaultQuality: isMidjourneyV82 ? MIDJOURNEY_V8_2_DEFAULT_QUALITY : (defaults?.quality as string | undefined),
    defaultImageSize: defaults?.imageSize as string | undefined,
    defaultAspectRatio: defaults?.aspectRatio as string | undefined,
  };
}

/** 官方 `Ire` @2247183（逐字）：按 modelType 选 variant，`reference_video_to_video` 回落 `video_edit`。 */
export function resolveVariant(entry: CatalogEntry | undefined, modelType: string | undefined): CatalogVariant | undefined {
  if (!entry || !modelType) return undefined;
  const variants = entry.variants ?? [];
  const exact = variants.find((variant) => variant.modelType === modelType);
  if (exact) return exact;
  if (modelType === 'reference_video_to_video') {
    return variants.find((variant) => variant.modelType === 'video_edit');
  }
  return undefined;
}

/**
 * 官方 `jre` @2248144（逐字）。
 *
 * ⚠️ **有意省略的一处官方分支**（用户硬要求「不许按厂商/模型 id 写死」）：
 * ```js
 * const l = e === vt.KLING_VIDEO_O3 && i.modelType === zt.IMAGE_TO_VIDEO && !i.options.aspectRatios
 *   ? r.variants.find(h => h.modelType === zt.TEXT_TO_VIDEO) ?? i : i;
 * ```
 * 官方只在**该具体模型**上把「无 aspectRatios 的 image_to_video variant」换成 text_to_video variant。
 * 本文件不写死该模型名 ⇒ **整条分支省略**，不对其它模型做同样的替换。
 * 后果：仅 `kling-video-o3` 的 i2v 变体在 aspect chip 上与官方可能有差异（记录在 §56）。
 *
 * 另一处已省略：`Ere(e)` 的 videoContract 时长夹取（`minDuration`/`maxDuration`）——
 * MTV 无合同表（`UE(kind).videoContract` 未提取）。
 */
export function videoModelInfo(
  modelId: string | undefined,
  modelType: string | undefined,
  isPayingCustomer: boolean,
  overrides: Record<string, unknown> = {},
): VideoModelInfo | null {
  const entry = getParamEntry(modelId);
  if (!entry || !entry.variants) return null;
  const variant = resolveVariant(entry, modelType) ?? entry.variants[0];
  if (!variant) return null;
  const aspectRatios = resolveExprList(variant.options?.aspectRatios, variant, overrides, isPayingCustomer);
  let durations = resolveExprList(variant.options?.durations, variant, overrides, isPayingCustomer);
  if (durations) durations = durations.slice().sort((a, b) => a - b);
  const resolutions = resolveExprList(variant.options?.resolutions, variant, overrides, isPayingCustomer);
  /* 官方：`KLING_VIDEO_O3 && Array.isArray(i.options.modes)` ⇒ qualityOptions = modes。 */
  const qualityOptions = Array.isArray(variant.options?.modes) ? variant.options.modes : undefined;
  const defaults = variant.defaults ?? {};
  return {
    kind: 'video',
    nameKey: entry.label ?? String(modelId),
    aspectRatios,
    durations,
    resolutions,
    qualityOptions,
    supportsGenerateAudio: typeof defaults.generateAudio === 'boolean',
    defaultGenerateAudio: typeof defaults.generateAudio === 'boolean' ? defaults.generateAudio : undefined,
    defaultDuration: typeof defaults.duration === 'number' ? defaults.duration : undefined,
    defaultResolution: typeof defaults.resolution === 'string' ? defaults.resolution : undefined,
    defaultAspectRatio: typeof defaults.aspectRatio === 'string' ? defaults.aspectRatio : undefined,
    aspectRatioPolicy: variant.aspectRatioPolicy,
    variantKey: variant.key,
    modelType: variant.modelType,
  };
}

/** 官方 `qI` @2250420（逐字）：`jre` + SEEDANCE_2_0_MINI 的非付费默认值覆盖。 */
export function videoModelInfoForRequest(
  modelId: string | undefined,
  modelType: string | undefined,
  isPayingCustomer: boolean,
  overrides: Record<string, unknown> = {},
): VideoModelInfo | null {
  const info = videoModelInfo(modelId, modelType, isPayingCustomer, overrides);
  if (!info) return null;
  if (isPayingCustomer) return info;
  if (modelId !== 'seedance-2.0-mini') return info;
  return { ...info, defaultDuration: 5, defaultResolution: '480p' };
}

/* ------------------------------------------------------------------ *
 * 订阅 / 免费门控（官方 `Og` / `E2` / `Dz`）
 * ------------------------------------------------------------------ */

/**
 * 官方 `Lz`（vendor-packages:@974630，89 项）—— 订阅受限模型 id 全集，
 * `jz = new Set(Lz)`（@976032），`E2(e) = !!(e && jz.has(e))`。
 */
const LZ: readonly string[] = [
  'flux-2-pro', 'flux-kontext-pro', 'flux-kontext-max', 'nano-banana', 'tamar-google-gemini-pro',
  'nano-banana-2.1', 'nano-banana-flash', 'nano-banana-flash-lite', 'nano-banana-2', 'gpt-image-1',
  'gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'grok-2-image', 'grok-imagine-image',
  'grok-imagine-image-quality', 'midjourney-v7', 'midjourney-v8.1', 'midjourney-v8.2', 'midjourney-niji7',
  'fal-recraft-v4', 'fal-recraft-v4-vector', 'gemini-3.1-pro', 'gemini-3.1-flash-lite', 'gemini-3-pro',
  'gemini-3-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'minimax', 'flux-3', 'kling-motion-control',
  'kling-video-o1-edit', 'midjourney-video', 'sora-2-standard', 'sora-2-pro', 'grok-imagine-video-1.5',
  'grok-imagine-video', 'veo3', 'veo3-fast', 'veo3.1', 'veo3.1-fast', 'veo3.1-lite', 'veo3.1-lite-extend',
  'gemini-omni-flash', 'gemini-omni-1.1-flash', 'kling-video-o3-edit', 'kling-o3-video-edit',
  'happyhorse-1.0-edit', 'tripo-h3', 'tripo-image-to-model-h3', 'tripo-text-to-model-h3',
  'worldlabs-marble-1.1', 'worldlabs-marble-1.1-plus', 'sonilo-music', 'sonilo-sfx', 'elevenlabs-v3',
  'eleven_v3', 'music_v1', 'eleven_sound_effect', 'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-opus-5',
  'claude-opus-5-5', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-fable-5',
  'claude-fable-5-1', 'gpt-5.5', 'gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-6-astra',
  'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash', 'reve-2.1',
];
const JZ = new Set<string>(LZ);

/** 官方 `E2` @976192：订阅受限判定。 */
export function isSubscriptionRestricted(modelId: string | undefined): boolean {
  return !!(modelId && JZ.has(modelId));
}

/**
 * 官方 `Xb`（=`Dz` @976231）：`t || !E2(e)`。`E2`/`jz` 的名单见 `LZ`。
 *
 * ★ **round 129：`isPayingCustomer` 与 `modelIsFree` 同步收窄为「已知的付费态（`boolean | null`）」。**
 *   官方 `Xb(Ot.value, q)` 的 `q` 就是 @2324104 的 `q=i||G===!0`（`G` 来自 `hl()` 的
 *   `isPayingCustomer`）—— **与确认门 / model option 禁用同一个字段、同一处纪律**：
 *   只有**已知的付费态**才「按订阅名单过滤」；未知（`null`/`undefined`，MTV 现状）⇒ 不限制。
 *   ⚠️ 这是**同纪律的第二个落点**：round 116 曾明文把它冻结（`generationChipController.ts`
 *   文件头「`jz`(`Lz`) 订阅门控的 89 项白名单**未动**」），本轮按新证据（官方 `q` 在 MTV 无数据源；
 *   上游土豆 `/api/pricing` 的 `enable_groups`/`usable_group` MTV 不读，且该接口不声明本账号分组）
 *   **解冻** —— 不是静默放宽：反例（宿主明确传 `false`）逐字钉在
 *   `tests/components/generationChipController.test.tsx` 与 `tests/services/audioModelCatalog.test.tsx`。
 */
export function passesSubscriptionGate(
  modelId: string | undefined,
  /** 见 `modelIsFree` 第三参：`false` = 已知没付过费；`null`/`undefined` = 未知。 */
  isPayingCustomer: boolean | null,
): boolean {
  if (isPayingCustomer !== false) return true;
  return !isSubscriptionRestricted(modelId);
}

/**
 * 官方 `Og` @2250212（逐字）：`if(n)return!0; switch(e){case"image": qo[t]?.isFree===!0; …}`。
 *
 * ⚠️ **round 116 修正（用户现场：「Subscription required」挡住生成确认卡的「确认」）**
 *
 * 官方这条判据本身依赖**订阅态**：`Lg(e,t,n)` 的第三参 `n` 就是 `isPayingCustomer`
 * （`vendor-pkg-canvas-DuoOicPr.js` @2242485 逐字：
 * `function Lg(e,t,n){if(n)return!0;switch(e){case"image":return qo[t]?.isFree===!0;…}}`），
 * 而它的调用点（同文件 @2324048）是
 * `we=G||(!!F&&Lg(e,F,q)&&GF(e,F,de))`、`q=i||H===!0`，`H` 来自订阅态 hook `hl()`。
 * 也就是说官方那句 `isFree === true` 为假时表达的是**「该模型属付费档 / 该用户当前不可用」**——
 * 官方拿得到这个结论，**MTV 拿不到**：MTV 没有订阅/计费/权益体系
 * （`hl().isPayingCustomer` 全仓无数据源，见 `generationChipController.ts` 文件头），
 * 原先一律按「非付费分支」跑 ⇒ **目录里 98 个模型有 79 个没有 `isFree` 键**（= 官方语义的付费档）
 * 被当成「受限」，于是每张生成确认卡都浮一个 `Subscription required` 把「确认」挡住。
 *
 * 按仓库规矩「**官方有、MTV 无数据源 ⇒ 不阻断**」，这里只保留官方目录里**显式**给出的取值：
 *   · `isFree === false` **且**付费态已知为 `false` → 官方显式标注为付费档且该用户确实没付过费
 *     ⇒ **维持受限**（**不放宽**官方既有口径）；
 *   · `isFree === true`  → 免费 ⇒ 放行（与官方一致）；
 *   · 没有该键 → 官方语义是付费档，但「该用户能不能用」要靠订阅态 ⇒ MTV 无此数据 ⇒ **放行**；
 *   · 目录外（`media_generate` 的 `provider/model` 自接模型，**官方不存在这种输入**
 *     —— 官方用户只能选官方目录里的模型）⇒ 官方无对应判据 ⇒ **放行**。
 *
 * ★ **round 129 修正 —— 第三参的语义从「布尔」收窄为「已知的付费态（`boolean | null`）」**：
 *   原来第三参恒被调用方按 `false` 传（`generationChipController` 的 `input.isPayingCustomer ?? false`），
 *   于是官方 `Ft = !Fg(e,qt,q)` 里的 `q` 被**凭空**当成「该用户没付过费」⇒ 目录里
 *   `isFree:false` 的 8 个模型（`tapnow-image-turbo` / `midjourney-v7/v8.1/v8.2/niji7` /
 *   `wanxiang-plus` / `wanxiang-i2v-flash` / `wanxiang-preview`）被断言「Subscription required」，
 *   把「确认」挡住。真机正样本（`agent-挖掘覆盖表.md` §123.5 取证 1，2026-10-15）：图片卡模型 chip
 *   的 7 项候选里**恰好 1 项被禁用** = `tapnow-image-turbo`（下拉显示名 `TapNow Flash`），
 *   其余 6 项 enabled —— 这正是本条误报。
 *
 *   `q` 在 MTV **没有数据源**：官方来自计费/订阅 store（`hl()`；后端 `stripev2/customer/paying-status`，
 *   见 `vendor-packages-CvEFn1fJ.js` @755467/798631/799448），MTV 全仓无此接口。
 *   ⚠️ 上游**土豆**确实有「分组」概念（`GET https://api.ai-tudou.net/api/pricing` 的
 *   `usable_group` / 每模型 `enable_groups` / `group_ratio`），但：
 *     ① 那不是官方这条判据读的字段（官方读 `isPayingCustomer` × 目录 `isFree`，不是
 *        `enable_groups` 成员检查 —— 见 `vendor-packages-CvEFn1fJ.js` @1229xxx `$$` 的
 *        `g=i.isFree??!1, C=!t&&!g` 与 @1236529 `aQ` 的 `b=x.isFree??!1, w=!r&&!b`）；
 *     ② 该接口**不声明调用方所属分组**（无鉴权、`auto_groups` 只是默认可选分组集合）
 *        ⇒ MTV 无法求「本账号在不在该模型的 `enable_groups` 里」。
 *   ⇒ 归属判据在 MTV **不可求值** ⇒ 官方无对应判据 ⇒ **不阻断**。**没有自造**新的分组闸门。
 *
 *   因此第三参改为：`false` = **已知**该用户没付过费（宿主接了真实付费态时才传）；
 *   `true` = 已知付过费；`null`/`undefined` = **未知**（MTV 现状）⇒ 放行。
 *   这样「官方既有口径」对**知道付费态的宿主**一个字没放宽，只是 MTV 自己不再替官方编 `q`。
 *
 * ★ round 121 —— **「目录外 ⇒ 不阻断」是一条多处落点的纪律，不是只在这里**：
 *   ① 本函数（「能不能用 / 是不是付费档」）；
 *   ② `components/chat/generationChipController.ts` 的 `KR`（图像参考图数量上限）；
 *   ③ 同文件 `xx`（视频参考素材形状兼容）。
 *   三处必须一致，否则自接模型会**半边放行、半边卡死**（round 121 现场：自接模型从
 *   `unknown` 升为 `known` 后 `confirmDisabled` 改走 `modelSupportsShapes`
 *   ⇒ 只放宽本函数会把整类自接模型卡死）。**改一处必须同时看另两处。**
 *
 * `kind === 'audio'`：官方该分支查的是虚拟音频目录 `H1`+`G1`（MTV 未提取，见 `audioModelCatalog.ts`
 * `audioModelIsFree` 才是音频的逐字落点）⇒ 这里同样属「无数据」⇒ 放行，音频 chip 一律走
 * `audioModelCatalog.audioModelIsFree`。
 */
export function modelIsFree(
  kind: ParamCatalogKind,
  modelId: string | undefined,
  /**
   * 官方 `q`/`n` = **付费态**。`false` = 已知没付过费；`true` = 已知付过费；
   * `null`/`undefined` = **未知**（MTV 现状：无订阅/付费态数据源）⇒ 见上方 round 129 修正。
   */
  isPayingCustomer: boolean | null,
): boolean {
  /* 付费态未知（`null`/`undefined`）⇒ 官方 `Ft = !Fg(e,qt,q)` 的 `q` 这一半求不出来
     ⇒ 官方无对应判据 ⇒ 不阻断。**只有「已知没付过费」才可能判受限。** */
  if (isPayingCustomer !== false) return true;
  const entry = getParamEntry(modelId);
  // 目录外 / 无目录条目 ⇒ 官方无此输入，MTV 无法判定 ⇒ 不阻断。
  if (!entry) return true;
  // 官方音频分支的目录（`H1`）未提取 ⇒ 无数据 ⇒ 不阻断（音频另有 `audioModelIsFree`）。
  if (kind === 'audio') return true;
  // 只保留官方**显式**的 `isFree:false`（付费档）作为受限判据。
  return entry.isFree !== false;
}

/**
 * **round 122（用户裁决①）**：图片模型的**目录级** `imageSize` 默认值。
 *
 * 用户现场：「我给 agent 下达 3:4 的小猫，卡上清晰度却是 **2K**」。2K 是 MTV 自己硬填的常量
 * （`generationRuntime` 的 `|| '2K'` / `mediaInputResolution` 的 `?? '2K'`），
 * 而**目录里本来就有模型级默认**：MTV `src/data/model-param-catalog.json` 里 30 个图片模型有 **16 个**
 * 同时声明了模型级 `imageSizeOptions` 与 `defaults.imageSize`（另外 14 个两者都没有）。
 * 例：`doubao-seedream-5.0-lite` = `["2K","3K"]` / `"2K"`（用户那次**恰好**撞对）、
 * `nano-banana-2.1` = `["1K","2K","4K"]` / `"1K"`、`nano-banana-flash-lite` = **`["1K"]`** / `"1K"`
 * —— 给它硬填 `2K` 就是**发出该模型不支持的值**。
 *
 * 口径（与 `aspectRatio` 同一条链，不另起一套）：
 * `请求显式值 > 项目默认 > 本函数（目录 defaults.imageSize） > 不填`。
 * 返回 `undefined` ⇔ 该模型没有可用的目录默认（14 个没声明的 / 目录外模型 / `$expr` 在
 * 当前比例下求值为空列表，例如 `gpt-image-2.5-*` 在 `aspectRatio === "auto"` 时返回 `[]`）
 * ⇒ 调用方**不写该字段、不渲染该 chip**（绝不自造）。
 */
export function catalogImageSizeDefault(modelId: string | undefined, aspectRatio: string): string | undefined {
  const entry = getParamEntry(modelId);
  if (!entry || entry.kind !== 'image') return undefined;
  const options = resolveExprList<string>(
    entry.imageSizeOptions as CatalogValue<string> | undefined,
    { defaults: entry.defaults ?? {}, modelType: undefined },
    { aspectRatio },
    false,
  );
  const list = Array.isArray(options) ? options.map(String) : [];
  const fallback = typeof entry.defaults?.imageSize === 'string' ? entry.defaults.imageSize.trim() : '';
  return fallback && list.includes(fallback) ? fallback : undefined;
}

/**
 * **round 122**：图片模型的**目录级** `aspectRatio` 默认值（`defaults.aspectRatio`）。
 *
 * 与 `catalogImageSizeDefault` 同一条链、同一份依据 —— 用户裁决要求「两者不能走两套逻辑」。
 * 官方证据：`Pb(e,t)`（`vendor-pkg-canvas-DuoOicPr.js` @2239682 邻域）里
 * `i = t ? { ...n.defaults, aspectRatio: t } : n.defaults` —— **当前值为空时用模型自己的 `defaults`**
 * （含 `defaults.aspectRatio`）；`Eoe` 的比例组 gate 是 `M = b && _ && _.length > 0 && v`
 * （**要求当前值 `v` 已定义**）⇒ 官方**不伪造**比例值。
 * **实测（读真 JSON，`src/data/model-param-catalog.json`，30 个 `kind:"image"`）**：
 * `defaults.aspectRatio` **30/30 都声明了**（值域 `"1:1"` / `"Auto"` / `"Auto(4K)"` / `"16:9"`），
 * 且都落在该模型 `aspectRatios` 数组内。
 * ⇒ 只有**目录外**模型（自接 provider 的 `general/<配置 id>`）才拿不到比例默认 ⇒ 那一档**不填**。
 */
export function catalogImageAspectRatioDefault(modelId: string | undefined): string | undefined {
  const entry = getParamEntry(modelId);
  if (!entry || entry.kind !== 'image') return undefined;
  const value = typeof entry.defaults?.aspectRatio === 'string' ? entry.defaults.aspectRatio.trim() : '';
  if (!value) return undefined;
  /**
   * 与 `catalogImageSizeDefault` **对称**的同一道门：默认值必须在该模型**声明过的**
   * `aspectRatios` 里 —— 否则就是「发一个它菜单里没有的值」。
   * 当前目录 **30/30** 图片模型都满足（`aspectRatios` 全为数组且含 `defaults.aspectRatio`，
   * 例 `doubao-seedream-4.5` = `["1:1","4:3","3:4","16:9","9:16","3:2","2:3"]` / `"16:9"`）
   * ⇒ 这道门**不改变任何现状**，只是把「两者走同一条逻辑」写死，防止以后目录改坏时静默发出非法值。
   * 非数组（未声明的形状）⇒ 视为无来源 ⇒ 不填。
   */
  const options = Array.isArray(entry.aspectRatios) ? entry.aspectRatios.map(String) : [];
  return options.includes(value) ? value : undefined;
}

/* ------------------------------------------------------------------ *
 * method chip（官方 `EJ` / `dd` / `aDe`）
 * ------------------------------------------------------------------ */

export type VideoMethodKey = 'frames' | 'reference' | 'edit';

/** 官方 `aDe` @815397（逐字）：`zt` 枚举值 → method key。 */
const MODEL_TYPE_TO_METHOD: Readonly<Record<string, VideoMethodKey>> = {
  text_to_video: 'frames',
  image_to_video: 'frames',
  start_end_to_video: 'frames',
  reference_to_video: 'reference',
  reference_video_to_video: 'reference',
  video_edit: 'edit',
  video_extend: 'reference',
};

/** 官方 `dd` @815624：`e?aDe[e]??null:null`。 */
export function methodKeyOfModelType(modelType: string | undefined): VideoMethodKey | null {
  return modelType ? MODEL_TYPE_TO_METHOD[modelType] ?? null : null;
}

/** 官方 `EJ` @815812（逐字）：按 `frames → reference → edit` 顺序输出。 */
export function videoMethodKeys(modelId: string | undefined): VideoMethodKey[] {
  const entry = getParamEntry(modelId);
  if (!entry?.variants) return [];
  const seen = new Set<VideoMethodKey>();
  for (const variant of entry.variants) {
    const key = methodKeyOfModelType(variant.modelType);
    if (key) seen.add(key);
  }
  const out: VideoMethodKey[] = [];
  if (seen.has('frames')) out.push('frames');
  if (seen.has('reference')) out.push('reference');
  if (seen.has('edit')) out.push('edit');
  return out;
}

/**
 * 官方 `VA`（canvas `@815764`，逐字）：
 * ```js
 * function VA(e, t) {
 *   if (t === "reference") { const n = Zs[e]?.referenceLabelKey; if (n) return n }
 *   return t === "edit" ? "videoModels.videoEdit" : `videoConfigs.${t}`
 * }
 * ```
 * `e` = 模型 id（官方 `vt` 枚举值，`Zs` = 视频目录表 `Fe` 的键）；
 * `t` = method key（官方 `dd` 的输出，= 本文件的 `VideoMethodKey`）。
 * 返回的是 **i18n key**（不是文案本身）—— 调用点 `label: O(VA(o.model, He))`（canvas `@2057900`）。
 *
 * ✅ 已按上面那条路径补齐 `referenceLabelKey`（见 `CatalogEntry.referenceLabelKey`）⇒
 *    seedance 系列 / kling-video-o1 / kling-video-o3 在 `reference` 档上命中官方第一档
 *    `videoConfigs.referenceOmni`（zh「全能参考」），其余模型仍走官方下一档。
 */
export function videoGenerateMethodLabelKey(
  modelId: string | undefined,
  method: VideoMethodKey,
): string {
  if (method === 'reference') {
    const key = getParamEntry(modelId)?.referenceLabelKey;
    if (key) return key;
  }
  return method === 'edit' ? 'videoModels.videoEdit' : `videoConfigs.${method}`;
}

/**
 * 官方 **`Tr` 建卡工厂** @737829（逐字）与 **`LXe` 的 `currentVariant`** @1988649（逐字）
 * —— 这两处用的是**同一条规则**：
 *
 * ```js
 * // Tr  @737829 ：建卡时把当前 variant 的 modelType 写进 params（这就是 LXe 读的那个字段）
 * x = (e.params?.modelType ? h.variants.find(k => k.modelType === e.params?.modelType) : null) || h.variants[0],
 * w = { model:f, provider:h.provider, modelType: x?.modelType || null, ...x?.defaults || {} }
 *
 * // LXe @1988649 ：读取时的 currentVariant（`d`）
 * const d = a.useMemo(() => {
 *   const f = Zs[c.model];
 *   return !f || !c.modelType ? f?.variants?.[0]
 *                             : f.variants.find(h => h.modelType === c.modelType) || f.variants[0]
 * }, [c.model, c.modelType])
 * ```
 *
 * 即：**`modelType` 为空、或不在该模型的 `variants` 里 ⇒ 取 `variants[0].modelType`**。
 * 官方靠这条规则保证「节点上永远有一个当前 variant」。
 *
 * ⚠️ **MTV 为什么需要它（登记）**：官方 `o.model` 是官方 `vt` 模型枚举值（`Zs` 的键），
 * 而 MTV 节点上的模型值是模型选择器的 value（自定义连接形如 `general/<cfgId>`），
 * 建卡时（`utils/officialVideoNodeParams.ts` 的 `officialVideoNodeParamsSeed`）若别名还没解析，
 * `params.modelType` 会落成 `null`（真机取证：`ai-canvas-db/projects` 的
 * `node-uzc77cygr.params = {model:"general/provider-custom-…", provider:"general", modelType:null}`）。
 * 此时官方字面的 `LXe`（`let g = h ?? null`，`h` 为空时**不做** `variants[0]` 兜底）
 * 会让 `dd(null) = null` ⇒ 「生成方式」组（官方门 `M = b && _ && _.length>0 && v`）整组不渲染。
 * 这里按官方**建卡工厂**的同一条 `variants[0]` 规则把该字段补回，使读取端拿到的是
 * 「官方 `Tr` 本会写进 `params.modelType` 的那个值」。
 */
export function currentVariantModelType(
  modelId: string | undefined,
  modelType: string | null | undefined,
): string | undefined {
  const entry = getParamEntry(modelId);
  if (!entry?.variants?.length) return undefined;
  const found = modelType ? entry.variants.find((v) => v.modelType === modelType) : undefined;
  return (found ?? entry.variants[0])?.modelType;
}

/* ------------------------------------------------------------------ *
 * 官方「生成方式」的 variant 解析与输入兼容判定
 * （`_p` / `qb` / `cDe` / `dDe` / `x9` / `o$` / `lDe` 逐字移植）
 * ------------------------------------------------------------------ *
 * 官方本地名与出处：
 * | 本文件导出 | 官方本地名 | 偏移 |
 * |---|---|---|
 * | `variantMatchesExactInputs` | `_p`（本地名 `y9`）| vendor-packages-DRvCmDjR.js@1220052 |
 * | `variantAcceptsInputs`     | `qb`（本地名 `v9`）| vendor-packages-DRvCmDjR.js@1218799 |
 * | `videoMethodSupportsInputs`| `cDe`       | canvas:816544 |
 * | `videoVariantForMethod`    | `dDe`       | canvas:816560 |
 * | `videoVariantForModel`     | `x9`（本地名 `Uhe`）再 `o$`（本地名 `YR`）| vendor-packages:1216950 / 1219506；调用点 canvas:2037060（`CQe`）|
 * | `videoReferenceCapabilitySummaries` | `lDe` | canvas:816079 |
 * `Ta`（vendor-packages:1216778）= `!!(e&&!e.isHidden&&!e.isComingSoon)`；`R2`/`Fe` = 视频目录表
 * （本文件 = `getParamEntry`）。
 *
 * ⚠️ §71 复核（**修正上游任务描述里的一处错标**）：任务把 `_p` 直接等同于 `y9`，实际是
 *   **`_p` = `y9`**（5 参：`model, modelType, imageCount, videoCount, audioCount=0`），
 *   而**调用点那一层是 `x9`**（4 参：`model, modelType, imageCount=0, videoCount=0`，
 *   音频**没有入参** ⇒ `y9` 的 `r` 走默认 0）。`x9` 逐字 @1216950：
 *   ```js
 *   function x9(e,t,n=0,s=0){const r=R2(e); if(!Ta(r))return null;
 *     for(const o of r.variants) if(y9(e,o.modelType,t,n,s))
 *       return{variant:o.key,modelType:o.modelType,defaults:o.defaults,variantConfig:o};
 *     return null}
 *   ```
 *   ⇒ MTV 的 `videoVariantForModel(modelId, imageCount, videoCount, audioCount)` 按 `x9`+`o$`
 *     两段写；由于官方 `x9` 根本不传音频，`videoVariantForModel` 带 `audioCount` 比官方**多**一个
 *     入参（`o$` 的 `v9` 也不吃音频）—— 取值上只有 `audioCount>0` 时才会与官方产生差异，
 *     当前调用点传的是真实计数，官方在此处恒为 0（见下文「已知差异」）。
 */

/** 官方 `LXe`（canvas:@1991414）算出的 `parentCounts`：上游连线素材计数。 */
export interface VideoInputCounts {
  imageCount: number;
  videoCount: number;
  audioCount: number;
}

/**
 * 官方 `_p`（`y9`，vendor-packages-DRvCmDjR.js@1220052）**逐字**移植：
 * 指定 `modelType` 的 variant 是否**精确**匹配当前输入计数。
 * ```js
 * y9=(e,t,n,s,r=0)=>{if(!t)return!1;const i=Fe[e]?.variants?.find(c=>c.modelType===t);
 *   if(!i||!(i.referenceAudioRange?r>=i.referenceAudioRange.min&&r<=i.referenceAudioRange.max:r===0)
 *      ||i.referenceAudioRequiresCompanion&&r>0&&n===0&&s===0)return!1;
 *   switch(t){ case K.TEXT_TO_VIDEO: return n===0&&s===0; … }}
 * ```
 */
export function variantMatchesExactInputs(
  modelId: string | undefined,
  modelType: string | undefined,
  imageCount: number,
  videoCount: number,
  audioCount = 0,
): boolean {
  if (!modelType) return false;
  const variant = getParamEntry(modelId)?.variants?.find((item) => item.modelType === modelType);
  if (
    !variant
    || !(variant.referenceAudioRange
      ? audioCount >= (variant.referenceAudioRange.min ?? 0) && audioCount <= (variant.referenceAudioRange.max ?? 0)
      : audioCount === 0)
    || (variant.referenceAudioRequiresCompanion && audioCount > 0 && imageCount === 0 && videoCount === 0)
  ) return false;
  switch (modelType) {
    case 'text_to_video': return imageCount === 0 && videoCount === 0;
    case 'image_to_video': return imageCount === 1 && videoCount === 0;
    case 'start_end_to_video': return imageCount === 2 && videoCount === 0;
    case 'reference_to_video':
      return !!(variant.referenceImageRange
        && imageCount >= (variant.referenceImageRange.min ?? 0)
        && imageCount <= (variant.referenceImageRange.max ?? 0)
        && (variant.referenceVideoRange
          ? videoCount >= (variant.referenceVideoRange.min ?? 0) && videoCount <= (variant.referenceVideoRange.max ?? 0)
          : videoCount === 0));
    case 'video_edit':
    case 'video_extend':
    case 'reference_video_to_video':
      return !!(variant.referenceVideoRange
        && videoCount >= (variant.referenceVideoRange.min ?? 0)
        && videoCount <= (variant.referenceVideoRange.max ?? 0)
        && (!variant.referenceImageRange
          || (imageCount >= (variant.referenceImageRange.min ?? 0)
            && imageCount <= (variant.referenceImageRange.max ?? 0))));
    case 'digital_human':
      return !!(variant.referenceImageRange
        && imageCount >= (variant.referenceImageRange.min ?? 0)
        && imageCount <= (variant.referenceImageRange.max ?? 0)
        && videoCount === 0);
    default: return false;
  }
}

/**
 * 官方 `qb`（`v9`，vendor-packages-DRvCmDjR.js@1218799）**逐字**移植：
 * variant 是否**宽松**接受当前输入（只比对上限，不看下限）。
 */
export function variantAcceptsInputs(
  variant: CatalogVariant,
  imageCount: number,
  videoCount: number,
  audioCount: number,
): boolean {
  if (!(variant.referenceAudioRange
    ? audioCount <= (variant.referenceAudioRange.max ?? 0)
    : audioCount === 0)) return false;
  switch (variant.modelType) {
    case 'text_to_video': return imageCount === 0 && videoCount === 0;
    case 'image_to_video': return imageCount <= 1 && videoCount === 0;
    case 'start_end_to_video': return imageCount <= 2 && videoCount === 0;
    case 'reference_to_video':
      return !!(variant.referenceImageRange
        && imageCount <= (variant.referenceImageRange.max ?? 0)
        && (variant.referenceVideoRange ? videoCount <= (variant.referenceVideoRange.max ?? 0) : videoCount === 0));
    case 'video_edit':
    case 'video_extend':
    case 'reference_video_to_video':
      return !!(variant.referenceVideoRange
        && videoCount <= (variant.referenceVideoRange.max ?? 0)
        && (!variant.referenceImageRange || imageCount <= (variant.referenceImageRange.max ?? 0)));
    case 'digital_human':
      return !!(variant.referenceImageRange
        && imageCount <= (variant.referenceImageRange.max ?? 0)
        && variant.referenceAudioRange
        && videoCount === 0);
    default: return false;
  }
}

/** 官方 `cDe`（canvas@816544，逐字）：该模型是否存在「属于该 method 且接受当前输入」的 variant。 */
export function videoMethodSupportsInputs(
  modelId: string | undefined,
  method: VideoMethodKey,
  imageCount: number,
  videoCount: number,
  audioCount: number,
): boolean {
  const entry = getParamEntry(modelId);
  return entry?.variants
    ? entry.variants.some((variant) => (
      methodKeyOfModelType(variant.modelType) === method
      && variantAcceptsInputs(variant, imageCount, videoCount, audioCount)
    ))
    : false;
}

export interface ResolvedVideoVariant {
  modelType?: string;
  variant?: string;
  defaults?: Record<string, unknown>;
  variantConfig: CatalogVariant;
}

/**
 * 官方 `dDe`（canvas@816560，逐字）：把 method key 落成具体 variant
 * （先按 `_p` 精确匹配输入，否则官方自带的 `?? l[0]` 兜底）。
 */
export function videoVariantForMethod(
  modelId: string | undefined,
  method: VideoMethodKey,
  imageCount: number,
  videoCount: number,
  audioCount: number,
): ResolvedVideoVariant | null {
  const entry = getParamEntry(modelId);
  if (!entry?.variants) return null;
  const candidates = entry.variants.filter((variant) => methodKeyOfModelType(variant.modelType) === method);
  if (candidates.length === 0) return null;
  const variant = candidates.find((item) => (
    variantMatchesExactInputs(modelId, item.modelType, imageCount, videoCount, audioCount)
  )) ?? candidates[0];
  return {
    modelType: variant.modelType,
    variant: variant.key,
    defaults: variant.defaults,
    variantConfig: variant,
  };
}

/**
 * 官方 `CQe`（canvas@2037060）选模型时的解析（逐字）：
 * ```js
 * let k = Uhe(E, o.imageCount, o.videoCount, o.audioCount);
 * if (!k && (k = YR(E, o.imageCount, o.videoCount, o.audioCount), !k)) return;
 * ```
 * `Uhe` = `x9`@1216950（**按 `_p` 精确匹配**的**第一个** variant），
 * `YR`  = `o$`@1219506（**按 `qb` 宽松接受**的第一个 variant）。
 *
 * ⚠️ §71 记账（逐字核对后的差异）：官方 `x9(e,t,n=0,s=0)` 与 `o$(e,t,n,s,r)` 的**第 4/5 位
 *   都不是音频**（`x9` 第 4 位 = `videoCount`；`o$` 第 4 位 = `videoCount`、第 5 位 = `preferred`），
 *   即**官方在这条「选模型」路径上根本不传音频数** ⇒ 两处 `y9`/`v9` 的 `audioCount` 恒为默认 0。
 *   MTV 这里多带了一个 `audioCount` 入参（因为它就是 `LXe.parentCounts` 里现成的字段），
 *   只有在 `audioCount > 0` 且「精确匹配那一段挑不出 variant」时才会与官方分叉；
 *   已知差异，按铁律登记（不是等价实现、也没有补默认值）。
 */
export function videoVariantForModel(
  modelId: string | undefined,
  imageCount: number,
  videoCount: number,
  audioCount: number,
): ResolvedVideoVariant | null {
  const entry = getParamEntry(modelId);
  if (!entry || entry.isHidden || entry.isComingSoon || !entry.variants) return null;
  for (const variant of entry.variants) {
    if (variantMatchesExactInputs(modelId, variant.modelType, imageCount, videoCount, audioCount)) {
      return { variant: variant.key, modelType: variant.modelType, defaults: variant.defaults, variantConfig: variant };
    }
  }
  for (const variant of entry.variants) {
    if (variantAcceptsInputs(variant, imageCount, videoCount, audioCount)) {
      return { variant: variant.key, modelType: variant.modelType, defaults: variant.defaults, variantConfig: variant };
    }
  }
  return null;
}

export interface VideoReferenceCapabilitySummary {
  imageMax: number;
  videoMax: number;
  audioMax: number;
}

/** 官方 `lDe`（canvas@816079，逐字）：参考档能力摘要（去重后按出现顺序）。 */
export function videoReferenceCapabilitySummaries(
  modelId: string | undefined,
): VideoReferenceCapabilitySummary[] {
  const entry = getParamEntry(modelId);
  if (!entry?.variants) return [];
  const out: VideoReferenceCapabilitySummary[] = [];
  const seen = new Set<string>();
  for (const variant of entry.variants) {
    if (methodKeyOfModelType(variant.modelType) !== 'reference') continue;
    const imageMax = variant.referenceImageRange?.max ?? 0;
    const videoMax = variant.referenceVideoRange?.max ?? 0;
    const audioMax = variant.referenceAudioRange?.max ?? 0;
    if (imageMax === 0 && videoMax === 0 && audioMax === 0) continue;
    const dedupeKey = `${imageMax}-${videoMax}-${audioMax}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ imageMax, videoMax, audioMax });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 官方 `Pre`（启用项前置）
 * ------------------------------------------------------------------ */

export function preferEnabledOptions<T extends { disabled?: boolean }>(options: readonly T[]): T[] {
  return [...options.filter((option) => !option.disabled), ...options.filter((option) => option.disabled)];
}
