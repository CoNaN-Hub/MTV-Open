/**
 * mediaInputResolution —— 「媒体生成用哪个模型 / 哪组参数」的**单一来源**。
 *
 * 背景：同一条 `media_generate` 有两个阶段要知道「这次到底用哪个模型、哪组参数」——
 *   ① 审批卡阶段（`agentRoundExecutor.prepareApprovalInput`）：卡片上的**模型 chip / 比例 chip /
 *      清晰度 chip 与价格**要显示它们；
 *   ② 执行阶段（`tools/mediaTools.resolveMediaToolInput` + `ai/generationRuntime.runMediaGeneration`）：
 *      真正要发出去的请求要用它们。
 * 官方语义里卡上显示的就是「已指派的参数」（读侧 `Sse` 读 `request_json.model_name` /
 * `request_json.image.aspect_ratio` / `request_json.image.image_size`），
 * 所以两处**必须同源**，否则会出现「卡上写 A、实际发 B」。
 *
 * 本模块只承载**纯规则**（不读 store、不碰注册表），由调用方把自己的数据源递进来：
 *   · 执行阶段递 `projectSettings`（来自 `useAppStore`）；
 *   · 审批卡阶段递同一个 `projectSettings`。
 *
 * ⚠️ 这里**只有** `显式指定 ?? 项目默认` 这一条：
 *   · 自主模式的「按提示词相关度自动路由」是**运行期**决策（要看用户当轮文字），
 *     审批卡只出现在协作模式（`prepareApprovalInput` 在自主模式提前返回）⇒ 不在这里承载；
 *   · 两者都为空 ⇒ 返回 `undefined`，调用方**不写该字段**（卡片不显示该 chip，不补默认值）。
 */
import type { ProjectSettings } from '../../types';
import { catalogImageAspectRatioDefault, catalogImageSizeDefault } from '../ai/modelParamCatalog';

/**
 * 解析媒体生成要用的模型引用。
 *
 * @param projectSettings 当前项目设置（可缺省 = 没有项目设置）
 * @param kind            媒体类型（`image` / `video` / `audio`；`text` 不走媒体生成）
 * @param explicitModelRef 调用方显式指定的模型（`media_generate` 的 `modelRef`）
 */
export function resolveDefaultMediaModelRef(
  projectSettings: Pick<ProjectSettings, 'defaultModels'> | undefined,
  kind: string,
  explicitModelRef?: string,
): string | undefined {
  const explicit = typeof explicitModelRef === 'string' ? explicitModelRef.trim() : '';
  if (explicit) return explicit;
  const defaults = projectSettings?.defaultModels;
  const fallback = defaults?.[kind as keyof NonNullable<typeof defaults>];
  const trimmed = typeof fallback === 'string' ? fallback.trim() : '';
  return trimmed ? trimmed : undefined;
}

/** 项目设置里的那组「项目默认生成参数」。 */
type MediaParamSettings = Pick<ProjectSettings, 'generation'>;

/** `media_generate` 入参里的那三个可覆盖字段（MTV 的 wire 名是 camelCase）。 */
export interface MediaRequestParamInput {
  aspectRatio?: string;
  /** 图片清晰度档位（`media_generate` 目前不暴露该字段；预留给宿主/项目默认）。 */
  imageSize?: string;
  resolution?: string;
  duration?: number;
}

/**
 * 已解析模型的 protocol 家族 —— 逐字对应 `ai/generationRuntime.resolveMediaModel` 的返回值
 * （`provider` / `workflowId`）。用它决定「项目默认参数能不能套」。
 */
export interface MediaModelProtocolHint {
  provider?: string;
  workflowId?: string;
  /**
   * 已解析模型的**目录 id**（= `MediaModelOption.value`，`generationRuntime.resolveMediaModel` 的 `configId`）。
   * round 122：图片清晰度的兜底要查**该模型**的目录默认（`catalogImageSizeDefault`）。
   */
  modelId?: string;
}

/** 解析结果：键名是**官方 `request_json` 的 wire 名对应的 camel 形**，与 `GB` 的输出同形。 */
export interface ResolvedMediaRequestParams {
  aspectRatio?: string;
  imageSize?: string;
  resolution?: string;
  duration?: number;
}

function trimmedParam(value: unknown): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : undefined;
}

function finiteParam(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * 解析「这次生成实际会用到的比例 / 清晰度 / 时长」—— 与**真实请求**同源。
 *
 * 逐字对标 `ai/generationRuntime.runMediaGeneration` 的两个决议点（那是**最后**说了算的地方）：
 *
 * ```
 * // generationRuntime.ts:250-256（kind === 'image'，逐字）
 * imageSize: projectSettings?.generation?.imageSize || '2K',
 * aspectRatio: projectSettings?.generation?.imageAspectRatio || '1:1',
 *
 * // generationRuntime.ts:293-300（kind === 'video'，逐字）
 * const directGeneralProtocol = ((model.provider === 'general' || model.provider === 'runninghub')
 *   && !model.workflowId) || model.provider === 'workflow-api';
 * const aspectRatio = intent.aspectRatio ?? (directGeneralProtocol ? undefined : projectSettings?.generation?.videoAspectRatio);
 * const resolution  = intent.resolution  ?? (directGeneralProtocol ? undefined : projectSettings?.generation?.videoResolution);
 * const duration    = intent.duration    ?? (directGeneralProtocol ? undefined : projectSettings?.generation?.videoDuration);
 * ```
 *
 * 同一组 `settings.generation.*` 也是**节点数据**的来源 —— `projectSettingsService.ts:205-256`
 * 的 `applyProjectDefaultsToNodeData` 把 `imageAspectRatio` 写进 `data.aspectRatio`、
 * `imageSize` 写进 `data.imageSize`、`videoAspectRatio`/`videoResolution`/`videoDuration` 写进
 * `data.seedanceRatio`/`data.seedanceResolution`/`data.seedanceDuration`；
 * `defaultModels[kind]` 写进 `data.model`（+`data.provider`）。
 * ⇒ 这里读 settings 与「读节点上那组字段」是**同一份数据**（`media_generate` 审批时目标节点还不存在，
 * 见 `store/store.nodes.ts:470-513` 的 `createMediaPlaceholder` 只在执行期建节点）。
 *
 * ⚠️ **唯一故意不复刻的一处**：图片那两个 `|| '2K'` / `|| '1:1'` 兜底**没有**带进载荷。
 * 用户明令「不许自创『用户没给就填个 1:1』这类默认值」⇒ 项目没设图片默认时**不写**该字段
 * （卡片不显示比例/清晰度 chip），而不是替用户断言一个 `1:1`。
 * 代价：那一刻「卡片不显示」≠「请求发 `1:1`/`2K`」。如实登记，是否解除禁令由用户裁定。
 *
 * @param projectSettings 当前项目设置（与执行期同一个来源）
 * @param kind            `image` / `video` / `audio`
 * @param input           `media_generate` 入参里用户显式给的那三个字段
 * @param model           已解析模型的 protocol 家族（`findMediaModelOption(...)` 的 `provider`/`workflowId`）
 */
export function resolveDefaultMediaRequestParams(
  projectSettings: MediaParamSettings | undefined,
  kind: string,
  input: MediaRequestParamInput = {},
  model: MediaModelProtocolHint = {},
): ResolvedMediaRequestParams {
  const generation = projectSettings?.generation;

  if (kind === 'image') {
    /**
     * 逐字对标 `generationRuntime.ts:255-256`（**真正发出去的值**）。
     * ⚠️ **round 120**：那两行把**请求自己的值**丢了 ⇒ 改为「请求显式 > 项目默认 > 运行时兜底」，
     * 与视频分支同一优先级（用户现场：「我给了 3:4，卡上却是 1:1」）。
     * ⚠️ **round 122（用户裁决①）**：`imageSize` 的兜底**不再是常量 `'2K'`** ——
     * 改为读**所选模型的目录默认** `catalogImageSizeDefault(modelId, aspectRatio)`：
     * MTV 目录里 30 个图片模型有 16 个声明了 `defaults.imageSize`，其余 **14 个不填**
     * （不写字段、不渲染该 chip）。硬填 `'2K'` 是真 bug：`nano-banana-flash-lite` 只有 `["1K"]`，
     * `2K` 是它**不支持**的值。
     * 顺序：**请求显式 > 项目默认 > 目录默认 > 不填**。
     */
    const aspectRatio = trimmedParam(input.aspectRatio)
      ?? trimmedParam(generation?.imageAspectRatio)
      ?? catalogImageAspectRatioDefault(model.modelId);
    const imageSize = trimmedParam(input.imageSize)
      ?? trimmedParam(generation?.imageSize)
      ?? catalogImageSizeDefault(model.modelId, aspectRatio ?? '');
    /* 两级都**没有来源就不写**（比例与清晰度走**同一条链**，不搞两套逻辑）：
       · 官方 `Pb(e,t)`：`i = t ? {...n.defaults, aspectRatio:t} : n.defaults` ⇒ 值为空时用模型 `defaults`；
       · 官方 `Eoe` 的比例组 gate `M = b && _ && _.length>0 && v` **要求当前值已定义**
         ⇒ 官方不伪造比例值。`1:1` 也不是普适值（`grok-2-image` 只有 `["Auto"]`）。 */
    return {
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(imageSize ? { imageSize } : {}),
    };
  }

  if (kind !== 'video') return {};

  /* 逐字对标 generationRuntime.ts:294。 */
  const directGeneralProtocol = (
    (model.provider === 'general' || model.provider === 'runninghub') && !model.workflowId
  ) || model.provider === 'workflow-api';
  const projectFallback = directGeneralProtocol ? undefined : generation;

  const aspectRatio = trimmedParam(input.aspectRatio) ?? trimmedParam(projectFallback?.videoAspectRatio);
  const resolution = trimmedParam(input.resolution) ?? trimmedParam(projectFallback?.videoResolution);
  const duration = finiteParam(input.duration) ?? finiteParam(projectFallback?.videoDuration);
  return {
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(resolution ? { resolution } : {}),
    ...(duration !== undefined ? { duration } : {}),
  };
}
