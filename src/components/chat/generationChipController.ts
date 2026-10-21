/**
 * 官方**生成参数 chips 控制器** `hie`（图像/视频，canvas:@2327822..2338116，61 字段）与
 * `uie`（音频，canvas:@2317385..2324420，40 字段）的 MTV 实现。
 *
 * 官方事实、逐字源码切片与偏移见 `D:\DEEPSEEK\_r63_xse_spec.md`（本文件所有判据都能回查该文档）；
 * options 真源见 `_r63_model_param_catalog.md` + `src/data/model-param-catalog.json`。
 *
 * ## 逐字对齐的判据
 * - 所有 `show*Chip` 的**真源 = `presentFields`（`activeFields`）+ `requestKind` + 模型能力**，
 *   表达式逐字照抄（见每个字段旁注释里的官方原文）。
 * - `isFree` → 免费额度 gate：落到 model option 的 `disabled`/`disabledReason`
 *   （官方 `video.modelRestricted`）与 `confirmDisabled`。
 * - `variants` → method chip 选项 + 各参数 chip 的 options 集合；**不控制任何 `show*`**。
 *
 * ## 本文件有意为之的**结构性差异**（都写进 `agent-挖掘覆盖表.md` §56）
 * 1. **`isPayingCustomer` 默认「未知」（round 129 起；此前默认 `false` = 非付费分支）**。
 *    官方从订阅态 hook `hl()`（r127 的 `P2` @812084：`{isDisabled,isPayingCustomer,loading}`）取值；
 *    MTV 全仓无此来源 ⇒ 三态 `payingCustomer: boolean | null`（`forcePaidAccess` 折成 `true`）。
 *    `X = !forcePaidAccess && (loading || isPayingCustomer === null)` 仍逐字保留
 *    （`loading` 默认 `false`）。可在入参覆盖（厂商差异只能从连接配置/模型目录进来）。
 *    **凡是要用它下判断的地方，未知一律走「不限制」那一侧**：
 *      · 受限断言（`modelIsFree` / `audioModelIsFree`）⇒ 传 `payingCustomer`（未知 ⇒ 放行）；
 *      · 订阅名单门（`passesSubscriptionGate`=`Xb`）⇒ 传 `payingCustomer`（未知 ⇒ 不过滤）；
 *      · 非付费档位表达式（`$expr`）/ `qI` 的非付费兜底 ⇒ 传 `paidOptions = payingCustomer !== false`。
 *    逐字理由（官方偏移）见下面「round 129」段。
 *
 *    ⚠️ **round 116 修正**：原注释写的「后果 = `jz` 里的模型被 `.filter(Xb)` 移除、非 `isFree` 模型被
 *    `disabled`……这是官方非付费行为」**只说对了一半**。官方那句 `isFree === true` 为假时，表达的是
 *    「该模型属付费档 **且该用户当前不可用**」——后半句官方靠订阅态 `hl()` 得出，**MTV 拿不到**
 *    （没有订阅/权益数据源；⚠️ **但计费/积分体系 MTV 是有的** —— `services/ai/creditEstimate.ts`
 *    的本地积分预估 + `creditBalance.ts` 的余额折算，见 `CreditEstimateBadge`）。
 *    ⚠️ **§119 更正**：本条注释原文写的是「没有订阅 / 计费 / 权益数据源」，**其中「计费」两字是错的**
 *    （用户 2026-10-15 纠正：「我们不是有积分体系和计费体系吗？」）。准确表述：
 *    **订阅态（`isPayingCustomer`）拿不到；计费/积分数据源在本仓是有的**（价目表 + 换算 + 余额），
 *    价格段就该用它（`estimateWithBilling`）。原样照抄的结果是：官方参数目录 98 个模型里 **79 个没有 `isFree` 键**
 *    （= 官方语义的付费档）被一律判「受限」⇒ 每张生成确认卡都浮一个 `Subscription required`
 *    把「确认」挡住（用户现场）。现按仓库规矩「**官方有、MTV 无数据源 ⇒ 不阻断**」收口到
 *    `modelParamCatalog.modelIsFree`：只有官方**显式**的 `isFree:false` 仍判受限，
 *    「没有该键 / 目录外（自接 provider 模型）」一律放行。`jz`(`Lz`) 订阅门控 `passesSubscriptionGate`
 *    的 89 项白名单**未动**。
 *
 *    ⚠️ **round 129 续修：round 116 只收口到「目录里没有 `isFree` 键」这一种情形，剩下一半仍在误报。**
 *    那条修正把第三参仍按 `false`（=「该用户没付过费」）传进去，于是官方 `Ft = !Fg(e,qt,q)` 里的
 *    `q` 被**凭空**当成 `false` ⇒ 目录里 **8 个显式 `isFree:false`** 的模型仍被判「受限」：
 *    `tapnow-image-turbo`（图片）、`wanxiang-plus`/`wanxiang-i2v-flash`/`wanxiang-preview`（视频）——
 *    这四个既不在 `jz`(`Lz`) 白名单里（不会被 `passesSubscriptionGate` 滤掉）又是 `isFree:false`
 *    ⇒ **会以「带锁 + Subscription required」出现在模型下拉里**
 *    （`modelOptions` 的 option `disabledReason`，修复前在 `:1054`）；音频侧更宽：
 *    `H1` 里只有 `mureka-v8`/`mureka-o2` 是 `isFree:true`，其余全部命中
 *    （audio model option `disabledReason` 与 confirm 理由，修复前在 `:1777` / `:1848`）。
 *
 *    真机正样本（`agent-挖掘覆盖表.md` §123.5 取证 1 + §120.3，2026-10-15）：图片卡模型 chip
 *    的 7 项候选里**恰好 1 项 disabled** = `TapNow Flash`(`tapnow-image-turbo`)，其余 6 项 enabled。
 *
 *    `q` 在 MTV **没有数据源**：官方读的是计费/订阅 store（`hl()` = r127 的 `P2` @812084
 *    逐字：`P2=()=>{const e=Ne(n=>n.isPayingCustomer),t=Ne(n=>n.isPayingCustomerLoading);
 *    return{isDisabled:!e||t,isPayingCustomer:e,loading:t}}`；后端
 *    `isPayingCustomer:(e,t)=>Ae.Get(Te.stripev2("customer/paying-status"),…)` @755467）。
 *    ⚠️ 上游土豆**有**分组数据（`GET https://api.ai-tudou.net/api/pricing` 的 `usable_group`、
 *    每模型 `enable_groups`、`group_ratio`），但 ① 它不是官方这条判据读的字段
 *    （官方是 `isPayingCustomer × 目录 isFree`：`vendor-packages-CvEFn1fJ.js` @1228842 `$$` 的
 *    `g=i.isFree??!1, C=!t&&!g`、@1236529 `aQ` 的 `b=x.isFree??!1, w=!r&&!b`；
 *    该键的 zh 原文 = **「任意一次付费即可全部解锁」**（`index-CsQaPZ-H.js` @724151/@878905、
 *    `vendor-pkg-canvas-Dp0xADoD.js` @4363108；en "Any payment unlocks all models" @188460），
 *    即**一次性付费门槛**，不是「本模型不在你所属分组」），
 *    ② 该接口**不声明本账号所属分组**（无鉴权；`auto_groups` 只是默认可选分组集合）⇒ 归属判据
 *    在 MTV **不可求值**。⇒ 按同一纪律「官方无对应判据 ⇒ 不阻断」：未知付费态一律放行，
 *    **不自造分组闸门**（详见 `modelParamCatalog.modelIsFree` 的 round 129 段）。
 *    这里仍然保留 `false`（宿主**明确**告知「已知没付过费」时）与 `true` 两条官方路径。
 *
 *    **同纪律的第二个落点（本轮一起解冻）**：`passesSubscriptionGate`（官方 `Xb`=`Dz` @976231，
 *    `t || !E2(e)`）的 `t` 与上面是**同一个字段**（@2324104 的 `q`）。修复前它吃 MTV 自己折的
 *    `false` ⇒ 非付费态下 `jz`(`Lz`) 89 项名单里的目录模型被 `.filter(Xb)` **整条从下拉移除**
 *    （真机那份"模型下拉 7 项"就是滤剩的；`gpt-image-2`/`midjourney-*` 等直接消失，用户想选都选不到）。
 *    round 116 曾明文冻结（「89 项白名单**未动**」），本轮按新证据解冻：未知 ⇒ 不过滤；
 *    宿主明确 `false` ⇒ 逐字保留官方过滤（反例见 `generationChipController.test.tsx`）。
 *
 *    **`$expr` 非付费档位裁剪**：官方 `qI`/`$I` 的 `e=>e.isPayingCustomer===!0?[]:…` 同样吃这个字段，
 *    故 `qI`/(`videoModelInfoForRequest`) 与 `resolveExprList` 改传 `paidOptions`（未知 ⇒ 付费侧）。
 *    ⚠️ 实测**唯一**使用该 `$expr` 的目录字段是 `lockedDurations`/`lockedResolutions`（36 处，
 *    全在 `seedance-2.0-mini`）—— 而这两个字段**官方 chip 路径从不读取**（`modelParamCatalog.ts:32-33`），
 *    MTV 也不读 ⇒ 该改动在此处是**无消费者**的口径统一；真正生效的只有 `qI` 对
 *    `seedance-2.0-mini` 的「非付费默认 5s/480p」覆写（未知 ⇒ 不再覆写，用目录默认）。
 * 2. **不许按厂商名/模型 id 写死分支**（用户硬要求）。官方在这些位置**确实**写了模型 id 字面量，
 *    本移植把对应判据换成**目录数据**：
 *      · `ze = !isImage && !q && U === vt.SEEDANCE_2_0_MINI`（@2330846）⇒ 恒 `false`（省略；
 *        `effectiveEditedDuration = y`、`effectiveEditedResolution = k`）。
 *      · `btt` 的视频模型白名单 `["seedance-2.0",…,"happyhorse-1.1"]` 与 `ytt` 的
 *        `new Set(["seedance-2.0-mini"])`（@2251158）⇒ 换成本文件所在目录 + `Og`(isFree) 门控。
 *      · `WI` 的 `durations = e==="sonilo-music"?[30,60,120]:e==="sonilo-sfx"?[5,10,30]:undefined` ⇒ 省略。
 *      · `KLING_VIDEO_O3` 分支保留，但**判据换成 variant 形状**（`image_to_video` 且无 `aspectRatios`）。
 * 3. **未移植的官方依赖 ⇒ 对应能力隐藏，绝不补默认值**（每处都有 `官方实体未解析` 注释）：
 *      · `Fx`（prompt 引用解析）⇒ `elementReferences` 计数恒 0、`unresolved=false`。
 *      · `aie`/`da`（mention → elementRefs）⇒ `buildChanges` 不产出 `elementRefs`。
 *      · `E3`（不可用原因 i18n，vendor@1222139）⇒ `isComingSoon`/`isInputIncompatible` 两类的
 *        `disabledReason` 为 `undefined`（官方 `video.modelRestricted` 的文案有证据 ⇒ 保留）。
 *      · `eG`（模型切换时的 visible/cleared 字段差分，@2310657）⇒ **不移植**：
 *        `handleModelChange` 只改编辑态模型，不收紧可见字段、不产 `clearedFields`。
 *      · `_p`/`iD`/`xx` 的非空形状分支、`dtt`（@2245721）⇒ 参考形状恒为「空形状」时不需要；
 *        非空形状一律判**不兼容**（不猜）。`AN` 退化为恒等（官方本身 `?? t` 兜底）。
 *      · **（第 73 轮更新）** 音频 `H1`/`zE`/`I2`/`G1`/`Mre`/`mq`/`j_`/`Sh`/`_h`/`aq`/`mge`：
 *        其中 `H1`(`_ue`@1086298)、`zE`(@2235852)、`I2`(@1085747)、`G1`/`wg`/`wC`/`Gp`
 *        (vendor@1088046/1088083/1087928/1084959)、`Mre`(@2249494)、`mq` 依赖（=`W7` 的
 *        `supportCustomLyrics`）**都已逐字取到** ⇒ 音频 model/scene chip、
 *        `confirmDisabled` 的 `pe/me/he/_e` 音频 gate、以及音频 `buildChanges`/`buildModifications`
 *        **本轮已按官方落表实现**（见 `useAudioChipController` 与 `src/services/ai/audioModelCatalog.ts`）。
 *        **确实取不到**的只有 `j_`（高级参数契约表）/`Sh`/`_h`（参数映射）/`YV`/`mge`(=`M7`)/
 *        `aq` 所依赖的 `Int`/`oG`/`tie` 之外的运行时构造 ⇒ 音频的
 *        `advancedParamChips` / `settledAudioParams` / `ControlsComponent` / `voice` / 高级键
 *        **继续隐藏**（静态不可得，绝不用近似物替代）。
 */
import { useCallback, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  getParamEntry,
  imageModelInfo,
  isSubscriptionRestricted,
  listDirectoryModelLabels,
  methodKeyOfModelType,
  modelIsFree,
  passesSubscriptionGate,
  preferEnabledOptions,
  resolveVariant,
  videoGenerateMethodLabelKey,
  videoMethodKeys,
  videoModelInfoForRequest,
  type ImageModelInfo,
  type ParamCatalogKind,
  type VideoModelInfo,
  type VideoMethodKey,
} from '../../services/ai/modelParamCatalog';
import { findImageModelCapability, imageSizesForModel } from '../../utils/imageModelCapabilities';
import {
  useConfirmationText,
  type ConfirmationTextFn,
} from '../../services/chat/generationConfirmationStrings';
import {
  AUDIO_SCENE,
  AUDIO_SCENE_MODE,
  AUDIO_WIRE_DIRECTORY,
  AUDIO_VIRTUAL_MODELS,
  audioModelForScene,
  audioModelForWireAndMode,
  audioModelDurations,
  audioModelIsFree,
  audioModelSupportsVideoInput,
  audioSceneOfModel,
  audioScenesOfVirtual,
  audioWireOfModelEntity,
} from '../../services/ai/audioModelCatalog';
import type {
  GenerationConfirmationBatchViewModel,
  GenerationConfirmationSingleViewModel,
  GenerationParams,
  GenerationRequestKind,
  ProtocolContext,
} from '../../services/chat/generationConfirmationProtocol';
import { displayNameOfModelRef } from '../../services/models/display';
import { channelParamLimitsFor, isChannelDisabled } from '../../services/models/channelParamLimits';
import { useAppStore } from '../../store/useAppStore';
import type { AppConfig } from '../../types';
import { getMediaModelOptions } from '../nodes/shared/defaultModels';

/* ------------------------------------------------------------------ *
 * 契约（官方两个返回对象的并集，87 字段）
 * ------------------------------------------------------------------ */

/**
 * 官方「生成方式」i18n 键的 **zh 原文**（`t()` 查不到该键时的回落值，逐字取自官方 zh 语言块
 * `live-assets-new/vendor-pkg-canvas-CvbAwZyy.js` @4399450 邻域：`videoConfigs.referenceOmni/
 * frames/reference` 与 `videoModels.videoEdit`）。
 * 只覆盖 `VA`（= `videoGenerateMethodLabelKey`）可能返回的四个键 —— 其余一律回落到 key 本身，
 * **不编造译文**。
 */
const OFFICIAL_METHOD_LABEL_ZH_FALLBACK: Readonly<Record<string, string>> = {
  'videoConfigs.referenceOmni': '全能参考',
  'videoConfigs.frames': '首尾帧',
  'videoConfigs.reference': '参考',
  'videoModels.videoEdit': '视频编辑',
};

/** chip 选项（官方 `Hs` 的 `options[]` 元素）。 */
export interface ParamChipOption {
  value: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  disabledReason?: string;
  /**
   * ★ 2026-10-15 **MTV 增强**（官方 option 形状里没有这三个字段）：这条候选**走哪条连接**。
   *
   * 用户口径（逐字）：「我是自定义的厂商 我后台接入什么厂商 你就显示什么厂商的 我接入两个 
   * 你就显示两个厂商的」⇒ 接了多条连接时，下拉里必须能一眼看出某项来自哪个厂商。
   * 数据直接来自连接级权益层 `providerEntitlements`（`defaultModels.withConnectionAvailability`
   * 已经算好并挂在 `ModelOption` 上）—— 这里**只是透传**，不重算判定。
   */
  connectionId?: string;
  connectionName?: string;
  /** 不在该连接带 Key 的 `/v1/models` 权威清单里（`isCandidateUnavailable` 的既有标注）。 */
  unavailable?: boolean;
}

/** 官方 `uie.settledAudioParams[]` 元素。 */
export interface SettledAudioParam {
  key: string;
  label?: string;
  value: string;
}

/** 官方 `uie.advancedParamChips[]` 元素。 */
export interface AdvancedAudioParamChip {
  key: string;
  label: string;
  selectedValue?: string;
  displayValue: string;
  options: ParamChipOption[];
}

/** 官方 `Jnt()` 的产物。 */
export interface AspectRatioState {
  value: string;
  options: ParamChipOption[];
  editable: boolean;
  visible: boolean;
  requestValue: string;
  estimateValue: string;
  modificationMode: 'legacy' | 'none' | 'optional' | 'value';
}

/** 引用形状计数（官方 `pF` 的产物元素 `shape`）。 */
export interface ReferenceShapeCounts {
  imageCount: number;
  videoCount: number;
  audioCount: number;
  unknownCount: number;
  totalCount: number;
}

export interface ResolvedReferenceEntry {
  shape: ReferenceShapeCounts;
  estimateVideoDurations?: readonly (number | undefined)[];
}

/** 官方 `mZe`/`fZe`/`xZe` 的模型实体（`bI` 归一化后仍保留 `id`/`displayName` 两形）。 */
export type ModelEntity =
  | { status: 'known'; id: string }
  | { status: 'unknown'; displayName: string }
  | Record<string, unknown>
  | null
  | undefined;

export interface VideoModeEntity {
  status: 'known';
  modelType: string;
}

export interface GenerationChipController {
  /* ── 官方 `hie` 的 12 个开关（@2337759..2338091，逐字） ── */
  showModelChip: boolean;
  showMethodChip: boolean;
  showAspectRatioChip: boolean;
  showImageSizeChip: boolean;
  showImageSizeAutoChip: boolean;
  showQualityChip: boolean;
  showDurationChip: boolean;
  showDurationAutoChip: boolean;
  showResolutionChip: boolean;
  showResolutionAutoChip: boolean;
  showTimesChip: boolean;
  showGenerateAudioMenu: boolean;
  /* ── 官方 `uie` 的 3 个开关（@2323685..2323900，逐字） ── */
  showSceneChip: boolean;
  /* ── 公共 ── */
  confirmDisabled: boolean;
  confirmDisabledReason?: string;
  /* ── 模型 chip ── */
  modelInfo?: { icon?: string };
  modelDisplayName?: string;
  modelSelectedValue?: string;
  modelOptions?: ParamChipOption[];
  /**
   * ★ 2026-10-15（MTV 增强，官方无此字段）：模型候选的**可操作提示**。
   *
   * 两个触发条件（都要求「不许静默」）：
   *   ① `modelOptions.length === 0` —— 所有已配置连接都没有为该 kind 声明模型（或声明了但一条
   *      都不在该连接的 `/v1/models` 清单里）。卡片据此**不渲染空下拉**，改渲染这句提示。
   *   ② 本次过滤**真的隐藏了 ≥1 条**（`catalogModels` 过时 ⇒ 用户声明过的模型不在清单里）——
   *      **部分隐藏也必须可见**，提示里带数量，并告诉用户去「设置 → API 连接」重新拉取。
   *
   * 零隐藏且非空时该字段为 `undefined` ⇒ 卡片什么都不加，行为与改动前一致。
   */
  modelOptionsHint?: string;
  handleModelChange?: (value: string) => void;
  modelChipEditable?: boolean;
  /* ── method chip ── */
  currentMethod?: string;
  methodChipOptions?: ParamChipOption[];
  handleMethodChange?: (value: string) => void;
  methodChipEditable?: boolean;
  /* ── aspect / imageSize / quality ── */
  aspectRatioState: AspectRatioState;
  setEditedAspectRatio?: (value: string) => void;
  editedImageSize?: string;
  imageSizeOptions?: ParamChipOption[];
  setEditedImageSize?: (value: string) => void;
  editedQuality?: string;
  qualityOptions?: ParamChipOption[];
  handleQualityChange?: (value: string) => void;
  /* ── duration / resolution ── */
  effectiveEditedDuration?: number;
  durationOptions: ParamChipOption[];
  setEditedDuration?: (value: number) => void;
  effectiveEditedResolution?: string;
  resolutionOptions?: ParamChipOption[];
  setEditedResolution?: (value: string) => void;
  /* ── generateAudio ── */
  editedGenerateAudio?: boolean;
  audioOptions?: ParamChipOption[];
  handleGenerateAudioChange?: (value: string) => void;
  /* ── times ── */
  effectiveTimes?: number;
  editedTimes?: number;
  setEditedTimes?: (value: number) => void;
  fixedImageCount?: number | null;
  /* ── 音频 ── */
  sceneDisplayName?: string;
  sceneOptions?: ParamChipOption[];
  handleSceneChange?: (value: string) => void;
  sceneChipEditable?: boolean;
  durationDisplayName?: string;
  durationChipEditable?: boolean;
  supportsLyrics?: boolean;
  lyricsMode?: string;
  lyricsModeOptions?: ParamChipOption[];
  lyricsModeDisplayName?: string;
  handleLyricsModeChange?: (value: string) => void;
  lyrics?: string;
  setEditedLyrics?: (value: string) => void;
  /* ── 提交链路 ── */
  buildChanges?: (prompt: string, originalParams?: GenerationParams) => Record<string, unknown> | undefined;
  buildModifications?: (prompt: string, addedNodeIds: readonly string[]) => Record<string, unknown> | undefined;
  clearedFields?: readonly string[];
  /* ── 估价入口 ── */
  modelId?: string;
  effectiveDuration?: number;

  /* ══ 以下是官方接口比 MTV 旧契约**多出的 23 个字段**（规格 §6.3） ══ */
  /** 官方 `M = e === "image"`。 */
  isImage: boolean;
  /** 官方 `String((_e ? F : ge?.value) ?? "")`。 */
  editedModelId: string;
  /** 官方 `w`。 */
  editedAspectRatio: string;
  /** 官方 `y`。 */
  editedDuration?: number;
  /** 官方 `k`。 */
  editedResolution: string;
  /** 官方 `Ct = _t != null ? 1 : ht ?? 1`。 */
  estimateTimes: number;
  /** 官方 `me = M ? void 0 : pe`。 */
  displayVideoModelType?: string;
  /** 官方入参 `resolvedReferences`。 */
  resolvedReferences?: ResolvedReferenceEntry;
  /** 官方 `J = Fx(aa(m ?? t.prompt))`。 */
  elementReferences: { count: { image: number; video: number; audio: number }; unresolved: boolean };
  /** 官方 `je = D ?? new Set(o)`。 */
  activeFields: ReadonlySet<string>;
  /** 官方 `Pt = cie(ye)`。 */
  clearedEstimateParams: readonly string[];
  /** 官方 `Te = f("videoConfigs.auto")`。 */
  autoLabel: string;
  /** 官方 `it = f("videoConfigs.autoUnsupportedTooltip")`。 */
  autoUnsupportedTooltip: string;
  /** 官方 `lt`。 */
  imageSizeCollapsed: boolean;
  /** 官方 `$ = lot(f)`（音频场景）。 */
  scene?: string;
  /** 官方 `G = Sh(S, v)` 的只读项。 */
  settledAudioParams: readonly SettledAudioParam[];
  /** 官方 `U = j_(v)` 的高级参数 chip。 */
  advancedParamChips: readonly AdvancedAudioParamChip[];
  /** 官方 `B`。 */
  handleAdvancedParamChange?: (key: string, value: string) => void;
  /** 官方 `ne = r && !!H && !E`。 */
  controlsWillRender: boolean;
  /** 官方 `H = a.useMemo(() => v ? aq(v) : null, [v])`（模型自带控件组件）。 */
  ControlsComponent?: ComponentType<Record<string, unknown>>;
  /** 官方 `S`。 */
  controlParams: Record<string, unknown>;
  /** 官方 `T`。 */
  handleControlParamChange?: (value: Record<string, unknown>) => void;
  /** 官方 `J = Q.some(ge => ge.videoCount > 0)`。 */
  isVideoAdaptive: boolean;
}

/** 「全部芯片隐藏」的空控制器（官方 `show*Chip` 全 `false` ⇒ 不渲染任何 chip）。 */
export function createEmptyChipController(): GenerationChipController {
  return {
    showModelChip: false,
    showMethodChip: false,
    showAspectRatioChip: false,
    showImageSizeChip: false,
    showImageSizeAutoChip: false,
    showQualityChip: false,
    showDurationChip: false,
    showDurationAutoChip: false,
    showResolutionChip: false,
    showResolutionAutoChip: false,
    showTimesChip: false,
    showGenerateAudioMenu: false,
    showSceneChip: false,
    confirmDisabled: false,
    aspectRatioState: {
      value: '',
      options: [],
      editable: false,
      visible: false,
      requestValue: '',
      estimateValue: '',
      modificationMode: 'legacy',
    },
    durationOptions: [],
    isImage: false,
    editedModelId: '',
    editedAspectRatio: '',
    editedResolution: '',
    estimateTimes: 1,
    elementReferences: { count: { image: 0, video: 0, audio: 0 }, unresolved: false },
    activeFields: new Set<string>(),
    clearedEstimateParams: [],
    autoLabel: 'Auto',
    autoUnsupportedTooltip: 'Adjustments are not supported in the current mode',
    imageSizeCollapsed: false,
    settledAudioParams: [],
    advancedParamChips: [],
    controlsWillRender: false,
    controlParams: {},
    isVideoAdaptive: false,
  };
}

/* ------------------------------------------------------------------ *
 * 官方小工具函数的逐字移植
 * ------------------------------------------------------------------ */

/** 官方 `xm` @2309292 邻域。 */
export const AUTO_ASPECT_SENTINEL = '__tapnow_auto_aspect__';

/** 官方 `aa` @2252515。 */
function aa(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 官方 `IN` @2309399。 */
function IN(entity: ModelEntity): string | undefined {
  const record = entity as { status?: string; id?: unknown } | null | undefined;
  return record?.status === 'known' && typeof record.id === 'string' ? record.id : undefined;
}

/** 官方 `Fb` @2309453。 */
function Fb(entity: unknown): string | undefined {
  const record = entity as { status?: string; modelType?: unknown } | null | undefined;
  return record?.status === 'known' && typeof record.modelType === 'string' ? record.modelType : undefined;
}

/** 官方 `qnt` @2309453 邻域：模型实体等价。 */
function qnt(left: unknown, right: unknown): boolean {
  if (!left || !right) return left === right;
  const a = left as { status?: string; id?: string; displayName?: string };
  const b = right as { status?: string; id?: string; displayName?: string };
  if (a.status !== b.status) return false;
  if (a.status === 'known') return a.id === b.id;
  return a.displayName === b.displayName;
}

/** 官方 `wd` @2244798：引用形状含未知项。 */
function wd(shape: ReferenceShapeCounts): boolean {
  return (shape.unknownCount ?? 0) > 0;
}

/** 官方 `VE` @2244841：空引用形状。 */
function VE(shape: ReferenceShapeCounts): boolean {
  if (wd(shape)) return false;
  return (shape.totalCount ?? shape.imageCount + shape.videoCount + shape.audioCount) === 0;
}

/** 官方 `Lb` @2308808。 */
function Lb(values: readonly string[] | undefined, current: string): string[] {
  const list = values ?? [];
  return !current || list.includes(current) ? [...list] : [current, ...list];
}

/** 官方 `lO` @2309292。 */
function lO(values: readonly number[] | undefined, current: number | null | undefined): number[] {
  const list = values ?? [];
  return current == null || list.includes(current) ? [...list] : [current, ...list];
}

/* ------------------------------------------------------------------ *
 * 参数胶囊的**官方完整候选表**（比例 / 清晰度 / 分辨率 / 张数）
 *
 * 用户 2026-10-15 现场（P0）：「官方的有四个 都可以点击选择 你现在除了模型 都不行」。
 * 根因不是「没接下拉」，而是**候选被裁成了 1 项**：
 * `Jnt`（官方 `@2312154`）的候选来自 `modelInfo.aspectRatios` / `imageSizeOptions`，
 * 而 MTV 的模型引用是 `general/<配置 id>` / `<provider>/<modelId>` —— 官方参数目录
 * （`src/data/model-param-catalog.json`，键 = 官方 `qo` 的 wireName）**查不到**
 * ⇒ `modelInfo === null` ⇒ `Lb(undefined, 当前值)` = `[当前值]` ⇒ 菜单点开只有自己那一行
 * ⇒ 用户看到的就是「点了没反应」（`ParamChip` 仍然渲染成 button + chevron）。
 *
 * 下面这三张表是**官方候选**，仅在「模型能力未知 / 该模型没声明该项」时补位；
 * 模型能力**已知**时按官方声明集判定，未声明的项**置灰**（用户要求：
 * 「不支持的模型能力可以置灰但不要剪掉整个菜单」）。
 *
 * 官方证据（逐字）：
 * · 比例 15 项 —— `D:\DEEPSEEK\live-assets-new\vendor-packages-DRvCmDjR.js` @1095139 邻域：
 *   `rq={model:re.NANO_BANANA_2_1, … options:{aspectRatios:["Auto","1:1","9:16","16:9","3:4","4:3",
 *   "3:2","2:3","5:4","4:5","21:9","1:4","4:1","1:8","8:1"], maxImages:14,
 *   imageSizeOptions:["1K","2K","4K"], …}}`（与本仓 `src/data/model-param-catalog.json` 的
 *   `nano-banana-2.1` 条目一致 —— 该 JSON 就是这份 bundle 的抽取结果）。
 * · 清晰度 3 项 —— 同上 `imageSizeOptions:["1K","2K","4K"]`。
 * · 张数 3 项 —— `vendor-pkg-canvas-CvbAwZyy.js` @1327920 `const p8e=[1,2,4]`
 *   （＝卡片 `xie` 行 `GRID_TIMES` 的官方来源，见 `GenerationConfirmationCard.tsx`）。
 * · 视频分辨率 —— 本仓 `model-param-catalog.json` 全部 video variant 的 `resolutions` 并集
 *   （`480p / 720p / 1080p / 4k`；仅在模型不在目录时启用，且**大小写不敏感**比对）。
 * ------------------------------------------------------------------ */

const OFFICIAL_ASPECT_RATIO_CANDIDATES: readonly string[] = [
  'Auto', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '4:5', '21:9', '1:4', '4:1', '1:8', '8:1',
];

const OFFICIAL_IMAGE_SIZE_CANDIDATES: readonly string[] = ['1K', '2K', '4K'];

const OFFICIAL_VIDEO_RESOLUTION_CANDIDATES: readonly string[] = ['480p', '720p', '1080p', '4k'];

/** 参数值等价（清晰度/分辨率的大小写在不同厂商写法里并不统一：`1080p` vs `1080P`）。 */
function sameParamValue(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/**
 * 生成一颗 chip 的候选：**官方完整表在前** + 模型自己声明的 + 当前值。
 *
 * @param official  官方完整候选（顺序 = 菜单顺序）
 * @param resolved  已解析出的候选（模型目录/官方能力表给的 + 当前值）
 * @param supported 该模型**声明支持**的候选；`null` = 未知（**不置灰**，与仓库同一条纪律
 *                  「官方无对应判据 ⇒ 不阻断」）
 * @param labelOf   逐项文案（清晰度要 `0.5K → 512P` 之类）
 *
 * 置灰规则：`supported != null && !supported.includes(value)`（大小写不敏感）。
 * 值去重也按大小写不敏感，且**保留 resolved 里的写法**（避免 `1080P` 被写成 `1080p`
 * 导致 `ParamChip` 的选中态判定落空 —— 它用 `option.value === selectedValue` 严格比较）。
 */
function gatedParamOptions(input: {
  official: readonly string[];
  resolved: readonly string[];
  supported: readonly string[] | null;
  labelOf?: (value: string) => string;
}): ParamChipOption[] {
  const { official, resolved, supported, labelOf } = input;
  const out: ParamChipOption[] = [];
  const seen: string[] = [];
  /** 官方写法与已解析写法等价时，采用**已解析写法**（保住当前值/厂商大小写）。 */
  const canonical = (value: string) => resolved.find((entry) => sameParamValue(entry, value)) ?? value;
  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.some((entry) => sameParamValue(entry, trimmed))) return;
    seen.push(trimmed);
    const unsupported = supported != null
      && !supported.some((entry) => sameParamValue(entry, trimmed));
    /* ★ 用户 2026 实测（截图）：「你有些尺寸带锁是什么意思？」——比例菜单里 1:4/4:1/1:8/8:1 挂了把🔒。
       官方菜单**只列该模型支持的档位**（不支持的根本不出现）⇒ 这里改成**不列**。
       当前值由 `resolved` 那条循环补进来，不会因为过滤而丢失选中态。 */
    if (unsupported) return;
    out.push({
      value: trimmed,
      label: labelOf ? labelOf(trimmed) : trimmed,
    });
  };
  for (const value of official) push(canonical(value));
  for (const value of resolved) push(value);
  if (supported) for (const value of supported) push(canonical(value));
  return out;
}

/** 官方 `Wnt` @2308874。 */
function Wnt(values: readonly string[] | undefined, current: string): ParamChipOption[] {
  const seen = new Set<string>();
  const source = current ? [current, ...(values ?? [])] : (values ?? []);
  return source.flatMap((raw) => {
    const label = raw.trim().toUpperCase();
    if (!label || seen.has(label)) return [];
    seen.add(label);
    return [{ value: raw, label }];
  });
}

/** 官方 `QV` @2309035。 */
function QV(value: number | null | undefined, info: { durationBounds?: { min?: number; max?: number }; durations?: number[]; defaultDuration?: number } | null | undefined): number | null | undefined {
  if (value == null || !info?.durationBounds) return value;
  const { min, max } = info.durationBounds;
  if ((min === undefined || value >= min) && (max === undefined || value <= max)) return value;
  const list = info.durations ?? [];
  if (info.defaultDuration != null && list.includes(info.defaultDuration)) return info.defaultDuration;
  return list.at(-1);
}

/** 官方 `vp` / `YE` / `iie` @2309686 / @2309399 / @2309962。 */
function vp(values: readonly string[] | undefined, current: string | undefined): string | undefined {
  if (!values || values.length === 0 || !current) return undefined;
  return values.includes(current) ? current : undefined;
}

function YE(values: readonly string[] | undefined): string | undefined {
  if (!values || values.length === 0) return undefined;
  return values[0];
}

function iie(values: readonly string[] | undefined, current: string | undefined, fallback: string | undefined): string | undefined {
  return vp(values, current) ?? vp(values, fallback) ?? YE(values);
}

/** 官方 `fie` @2327558。 */
function fie(
  shape: ReferenceShapeCounts,
  element: { count: { image: number; video: number; audio: number }; unresolved: boolean },
): ReferenceShapeCounts {
  const { count } = element;
  const added = count.image + count.video + count.audio;
  const unresolved = element.unresolved ? 1 : 0;
  if (added === 0 && unresolved === 0) return shape;
  return {
    ...shape,
    imageCount: shape.imageCount + count.image,
    videoCount: shape.videoCount + count.video,
    audioCount: shape.audioCount + count.audio,
    unknownCount: shape.unknownCount + unresolved,
    totalCount: shape.totalCount + added,
  };
}

/** 官方 `die` @2317052。 */
function die(changes: Record<string, unknown> | undefined, addedNodeIds: readonly string[]): Record<string, unknown> | undefined {
  if (!addedNodeIds || addedNodeIds.length === 0) return changes;
  return { ...(changes ?? {}), addedNodeReferences: addedNodeIds };
}

/** 官方 `Pre` 的调用侧（启用项前置）。 */
const preferEnabled = preferEnabledOptions;

/** 官方 i18n `defaultValue` 语义：MTV 文案表缺键时 `t` 原样返回 key ⇒ 回落到官方英文默认文案。 */
function tx(t: ConfirmationTextFn, key: string, defaultValue: string): string {
  const value = t(key);
  return value === key ? defaultValue : value;
}

/* ------------------------------------------------------------------ *
 * 官方 `Jnt` @2312154（逐字）
 * ------------------------------------------------------------------ */

function Jnt(input: {
  activeFields: ReadonlySet<string>;
  autoLabel: string;
  editedAspectRatio: string;
  isImage: boolean;
  isPending: boolean;
  modelInfo: ImageModelInfo | VideoModelInfo | null;
}): AspectRatioState {
  const { activeFields, autoLabel, editedAspectRatio, isImage, isPending, modelInfo } = input;
  const label = (values: readonly string[]): ParamChipOption[] => values.map((value) => ({
    value,
    label: value === AUTO_ASPECT_SENTINEL ? autoLabel : value,
  }));
  const autoOnly = label([AUTO_ASPECT_SENTINEL]);
  const videoInfo = modelInfo?.kind === 'video' ? modelInfo : null;
  if (isImage || !videoInfo?.aspectRatioPolicy) {
    const options = Lb(modelInfo?.aspectRatios, activeFields.has('aspectRatio') ? editedAspectRatio : '');
    return {
      visible: activeFields.has('aspectRatio') && options.length > 0,
      editable: isPending,
      value: editedAspectRatio,
      requestValue: editedAspectRatio,
      estimateValue: editedAspectRatio,
      options: label(options),
      modificationMode: 'legacy',
    };
  }
  if (videoInfo.aspectRatioPolicy === 'forbidden' || videoInfo.aspectRatioPolicy === 'derived_from_reference') {
    return {
      visible: true,
      editable: false,
      value: AUTO_ASPECT_SENTINEL,
      requestValue: '',
      estimateValue: '',
      options: autoOnly,
      modificationMode: 'none',
    };
  }
  if (videoInfo.aspectRatioPolicy === 'optional') {
    const current = editedAspectRatio || '';
    const values = [AUTO_ASPECT_SENTINEL, ...Lb(videoInfo.aspectRatios, current)];
    return {
      visible: true,
      editable: isPending && values.length > 1,
      value: current || AUTO_ASPECT_SENTINEL,
      requestValue: current,
      estimateValue: current,
      options: label(values),
      modificationMode: 'optional',
    };
  }
  const resolved = iie(videoInfo.aspectRatios, editedAspectRatio, videoInfo.defaultAspectRatio) ?? editedAspectRatio ?? '';
  const options = Lb(videoInfo.aspectRatios, resolved);
  return {
    visible: !!resolved && options.length > 0,
    editable: isPending && options.length > 0,
    value: resolved,
    requestValue: resolved,
    estimateValue: resolved,
    options: label(options),
    modificationMode: 'value',
  };
}

/* ------------------------------------------------------------------ *
 * 官方 `rot` / `sot` / `tG` / `nG` / `Mv`（逐字）—— 提交链路
 * ------------------------------------------------------------------ */

/** 官方 `tot` / `not` @2314018。 */
const TOT = ['times', 'aspectRatio', 'imageSize', 'quality'] as const;
const NOT = ['aspectRatio', 'quality', 'duration', 'resolution', 'generateAudio'] as const;

/** 官方 `Jet` @2241439（wire key 顺序）。 */
const JET = [
  'model_name', 'prompt', 'times', 'aspect_ratio', 'image_size', 'quality', 'duration', 'resolution',
  'generate_audio', 'mode', 'element_refs', 'references', 'voice', 'lyrics', 'stability', 'instrumental',
  'loop', 'prompt_influence', 'subtitle', 'audio_format',
] as const;

/** 官方 `ett` @2241685（camel 字段 → wire key）。 */
const ETT: Readonly<Record<string, string>> = {
  times: 'times',
  aspectRatio: 'aspect_ratio',
  imageSize: 'image_size',
  quality: 'quality',
  duration: 'duration',
  resolution: 'resolution',
  generateAudio: 'generate_audio',
  voice: 'voice',
  lyrics: 'lyrics',
  stability: 'stability',
  instrumental: 'instrumental',
  loop: 'loop',
  promptInfluence: 'prompt_influence',
  subtitle: 'subtitle',
  audioFormat: 'audio_format',
};

/** 官方 `Ar`：标量编码（逐字身份变换；官方用于 prompt/quality/duration/resolution/generateAudio 等）。 */
function encodeScalar(value: unknown): unknown {
  return value;
}

/** 官方 `qF` @2243953 邻域。 */
function encodeElementRefs(value: unknown): unknown {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => {
    const record = item as { elementId: string; alias: string };
    return { ref: `element/${record.elementId}`, alias: record.alias };
  });
}

/** 官方 `KF` @2243953 邻域。 */
function encodeAddedNodeReferences(value: unknown, context: ProtocolContext): unknown {
  if (value == null || !Array.isArray(value) || value.length === 0) return undefined;
  return [
    ...(context?.originalReferences ?? []),
    ...value.map((nodeId) => ({ ref: `node/${String(nodeId)}` })),
  ];
}

/**
 * 官方 `Are` / `Tre` / `ttt` / `ntt` / `ott` 的**编码器**：把模型实体编码成 wire 名。
 *
 * 官方实现要走 `UE(kind)`（wireName↔modelId 目录，canvas:@2237595）。**MTV 侧该目录为空**
 * （`generationConfirmationProtocol.ts` 的 `MODEL_CATALOG` 三个 kind 全空表，同一个原因），
 * 故 `Tre(e,t) = String(t.id)` 的身份分支生效 ⇒ 编码器 = 身份。**未自创 wire 名。**
 */
function encodeModelEntity(value: unknown, context: ProtocolContext): unknown {
  if (value == null) return undefined;
  const record = value as { status?: string; id?: string; displayName?: string };
  if (record.status === 'unknown' && record.displayName === context?.originalModelName) {
    return context?.originalModelName;
  }
  return IN(value as ModelEntity) ?? `unused:${String(record.displayName ?? '')}`;
}

/** 官方 `att` @2243860（image `stt` / video `rtt` / audio `itt`）。 */
const ATT: Readonly<Record<ParamCatalogKind, Readonly<Record<string, { wireKey: string; encode: (value: unknown, context: ProtocolContext) => unknown }>>>> = {
  image: {
    model: { wireKey: 'model_name', encode: encodeModelEntity },
    prompt: { wireKey: 'prompt', encode: encodeScalar },
    times: { wireKey: 'times', encode: encodeScalar },
    aspectRatio: { wireKey: 'aspect_ratio', encode: encodeScalar },
    imageSize: { wireKey: 'image_size', encode: encodeScalar },
    quality: { wireKey: 'quality', encode: encodeScalar },
    duration: { wireKey: 'duration', encode: encodeScalar },
    resolution: { wireKey: 'resolution', encode: encodeScalar },
    generateAudio: { wireKey: 'generate_audio', encode: encodeScalar },
    videoMode: { wireKey: 'mode', encode: encodeModelEntity },
    elementRefs: { wireKey: 'element_refs', encode: encodeElementRefs },
    addedNodeReferences: { wireKey: 'references', encode: encodeAddedNodeReferences },
  },
  video: {
    model: { wireKey: 'model_name', encode: encodeModelEntity },
    prompt: { wireKey: 'prompt', encode: encodeScalar },
    aspectRatio: { wireKey: 'aspect_ratio', encode: encodeScalar },
    quality: { wireKey: 'quality', encode: encodeScalar },
    duration: { wireKey: 'duration', encode: encodeScalar },
    resolution: { wireKey: 'resolution', encode: encodeScalar },
    generateAudio: { wireKey: 'generate_audio', encode: encodeScalar },
    videoMode: { wireKey: 'mode', encode: encodeModelEntity },
    elementRefs: { wireKey: 'element_refs', encode: encodeElementRefs },
    addedNodeReferences: { wireKey: 'references', encode: encodeAddedNodeReferences },
  },
  audio: {
    model: { wireKey: 'model_name', encode: encodeModelEntity },
    prompt: { wireKey: 'prompt', encode: encodeScalar },
    duration: { wireKey: 'duration', encode: encodeScalar },
    audioScene: { wireKey: 'mode', encode: encodeModelEntity },
    elementRefs: { wireKey: 'element_refs', encode: encodeElementRefs },
    addedNodeReferences: { wireKey: 'references', encode: encodeAddedNodeReferences },
    voice: { wireKey: 'voice', encode: encodeScalar },
    lyrics: { wireKey: 'lyrics', encode: encodeScalar },
    stability: { wireKey: 'stability', encode: encodeScalar },
    instrumental: { wireKey: 'instrumental', encode: encodeScalar },
    loop: { wireKey: 'loop', encode: encodeScalar },
    promptInfluence: { wireKey: 'prompt_influence', encode: encodeScalar },
    subtitle: { wireKey: 'subtitle', encode: encodeScalar },
    audioFormat: { wireKey: 'audio_format', encode: encodeScalar },
  },
};

/** 官方 `Mv` @2243952（逐字）。 */
export function buildWireModifications(
  kind: ParamCatalogKind,
  changes: Record<string, unknown> | undefined,
  context: ProtocolContext,
  cleared: ReadonlySet<string> | null | undefined,
): Record<string, unknown> | undefined {
  if (!changes && !cleared?.size) return undefined;
  const entries = new Map<string, unknown>();
  for (const field of cleared ?? []) entries.set(ETT[field], null);
  const table = ATT[kind];
  for (const [field, codec] of Object.entries(table)) {
    if (!changes || !(field in changes)) continue;
    const encoded = codec.encode(changes[field], context);
    if (encoded !== undefined) entries.set(codec.wireKey, encoded);
  }
  const out: Record<string, unknown> = {};
  for (const wireKey of JET) if (entries.has(wireKey)) out[wireKey] = entries.get(wireKey);
  return Object.keys(out).length > 0 ? out : undefined;
}

/* ------------------------------------------------------------------ *
 * `hie` 入参 / `uie` 入参
 * ------------------------------------------------------------------ */

export interface ImageVideoChipControllerInput {
  requestKind: Exclude<GenerationRequestKind, 'audio'>;
  params: GenerationParams;
  originalParams?: GenerationParams;
  presentFields: readonly string[];
  protocolContext?: ProtocolContext;
  /** 官方 `forcePaidAccess`。 */
  forcePaidAccess?: boolean;
  /** 官方 `paramControlsEditable`（卡片 `interactive`）。 */
  paramControlsEditable?: boolean;
  /** 官方 `inferVideoMode`，默认 `true`。 */
  inferVideoMode?: boolean;
  modelEditingLocked?: boolean;
  prompt?: string;
  resolvedReferences?: ResolvedReferenceEntry;
  allResolvedReferenceShapes?: readonly ResolvedReferenceEntry[];
  /**
   * 官方 `hl().isPayingCustomer`。**MTV 默认「未知」**（省略 / `null`）—— 依据：MTV 无订阅/付费态
   * 数据源（见文件头 round 129）。语义收窄为「**已知的**付费态」：
   *   · 省略 / `null` ⇒ 未知 ⇒ 一切「受限 / `Subscription required`」断言**不成立 ⇒ 放行**；
   *   · `true`  ⇒ 已知付过费 ⇒ 官方付费档分支；
   *   · `false` ⇒ 已知没付过费 ⇒ 保留官方非付费分支（目录显式 `isFree:false` 仍受限）。
   * 宿主若要接「连接配置/模型目录」的付费能力，从入参覆盖（这是唯一入口）。
   */
  isPayingCustomer?: boolean | null;
  /** 官方 `hl().loading`；MTV 无异步订阅查询 ⇒ 默认 `false`。 */
  loading?: boolean;
  /**
   * **宿主 / 测试显式注入的候选 id**（该 kind 的模型 id）。
   *
   * ⚠️ 2026-10-15 语义收窄：**省略时不再回落 MTV 内置目录** —— 候选只来自「用户已配置连接
   * 声明的模型」（`connectionModels`，见 `useImageVideoChipController` 内的口径注释）。
   * 传了才把它当候选（并按 `getParamEntry(id)?.kind === kind` 过滤）。
   * 旧语义（`?? listDirectoryModelIds(kind)`）对应的"内置目录当候选"已被用户明令废止。
   */
  directoryModelIds?: readonly string[];
  /** MTV 模型显示名（modelId → displayName），用于 model option 的 `label`。 */
  modelLabels?: Readonly<Record<string, string>>;
  /**
   * 卡片载荷的 `request_json.model_name`（= `media_generate` 解析出的模型；官方读侧 `Sse`）。
   * 仅在 `params.model` 缺失时作为模型实体的兜底来源（`params.model` 本身已由 `GB`→`hE` 从它派生）。
   */
  modelName?: string;
  /**
   * **round 116（MTV 专有输入）**：系统**没有**给这次生成指派模型 ⇒ 必须在卡上让用户选。
   *
   * 官方**不存在这个状态**：官方的模型是服务端在出确认卡之前就指派好的（`request_json.model_name`
   * 恒存在），卡上的模型 chip 只是「改一下」。MTV 的 `media_generate` 审批在**用户选模型之前**产生，
   * 卡片载荷里没有 `model_name`（真机证据：`agentTasks` 的
   * `inputRequest.generationRequest = {kind:"image",prompt,times:1}`，无 `modelName`；
   * 生产者 `agentRoundExecutor.buildMediaGenerationRequestSnapshot` 在「显式 `input.modelRef` +
   * 项目默认模型」两者都空时**不写该字段**，见该文件 @668-702）。
   * 此时官方那套 `presentFields`（只装载体里真的存在的键）会得到两件坏事：
   *   · `showModelChip = presentFields.has('model') && !!editedModel` ⇒ **模型 chip 不渲染**；
   *   · `modelId` 为空 ⇒ `modelAvailable` 假 ⇒ `confirmDisabled` 真，且拿不到 `modelId` 分支
   *     ⇒ 文案落到 `video.modelRestricted`（"Subscription required"）——一个**MTV 无法成立的断言**。
   * 置真后：chip 渲染（用户可选）+ 未选时禁用「确认」并给**诚实理由**（不是订阅受限）。
   * 默认 `false` ⇒ 官方行为不变。
   */
  modelSelectionRequired?: boolean;
}

/** 官方 `jz` 命中（订阅受限）判定，导出供测试断言。 */
export { isSubscriptionRestricted };

/**
 * 模型引用 → **用户可读名**（model chip 的 option `label` 与 `modelDisplayName` 的兜底）。
 *
 * 官方出处（`vendor-pkg-canvas-DuoOicPr.js` @2321750 邻域，逐字）：
 * ```js
 * .map(Ot => ({ value: Ot.value, label: f(Ot.labelKey, { defaultValue: Ot.value }), … }))
 * ```
 * 官方 option 的 label 兜底就是 **`Ot.value` 本身** —— 官方世界里 `value` 就是可读模型 id
 * （官方**没有**「自定义连接」这一层，模型只能从官方目录里来）。MTV 的**目录外**引用形如
 * `general/<配置 id>` / `<provider>/<modelId>`，直接落 `value` 会把**内部调用引用**印到卡上；
 * 本仓明文禁止：`components/ProjectSettingsPopover.tsx:644`
 * 「绝不把 `apimart/xxx` / `general/<cfgId>` 这种调用引用印给用户」，
 * `services/models/display.ts` 文件头「UI 只允许通过这里拿模型名」。
 *
 * 兜底链（**任何一级都不会产出 `general/` / `apimart/` 这类内部前缀**）：
 *   1. `displayNameOfModelRef` —— 全仓唯一的展示名出口（映射配置 → 官方 Registry → 原始模型 id）；
 *   2. 解析不出来（连接配置缺失 / store 未就绪）⇒ 该配置条目自己的可读字段（`name` → `modelId`）；
 *   3. 仍没有 ⇒ 剥掉第一段命名空间，返回引用尾巴（`general/xxx` → `xxx`）。
 */
export function resolveChipModelDisplayName(
  modelRef: string | undefined,
  options: {
    generalModels?: AppConfig['generalModels'];
    providers?: AppConfig['providers'];
  } = {},
): string {
  const raw = (modelRef ?? '').trim();
  if (!raw) return '';
  const resolved = displayNameOfModelRef(raw, {
    generalModels: options.generalModels,
    providers: options.providers,
  }).trim();
  /* `!== raw` 才算**真的解析到了** —— `displayNameOfModelRef` 在自定义连接条目缺失时会
     原样返回输入（`display.ts:124` 的 `return raw`），那正是我们要挡住的那条路径。 */
  if (resolved && resolved !== raw) return resolved;
  if (raw.startsWith('general/')) {
    const config = options.generalModels?.find((model) => `general/${model.id}` === raw);
    const readable = (config?.name ?? config?.modelId ?? '').trim();
    if (readable) return readable;
  }
  const slash = raw.indexOf('/');
  return slash > 0 ? raw.slice(slash + 1) : raw;
}

/**
 * 官方 `hie` @2327822（61 字段）。README：见文件头「逐字对齐的判据」。
 */
export function useImageVideoChipController(input: ImageVideoChipControllerInput): GenerationChipController {
  const t = useConfirmationText();
  const {
    requestKind,
    params,
    originalParams,
    presentFields,
    protocolContext,
    paramControlsEditable = false,
    inferVideoMode = true,
    modelEditingLocked = false,
    modelSelectionRequired = false,
  } = input;
  const forcePaidAccess = input.forcePaidAccess ?? false;
  const loading = input.loading ?? false;

  const isImage = requestKind === 'image';
  const kind: ParamCatalogKind = isImage ? 'image' : 'video';

  /* ── 自定义连接（MTV 独有；官方没有这一层）──
     这三张表同时供两件事用：
       · `generalModels` / `providers` —— 目录外引用（`general/<配置 id>`）的可读名来源；
       · `connectionModels` —— ★ **卡片模型候选的唯一来源**（用户 2026-10-15 口径）。
     枚举直接复用节点/对话共用的那条现有通道 `getMediaModelOptions`（`defaultModels.ts:1343`）：
     它内部按 `getConfiguredModelGroups`（连接存在 + 有 apiKey + `visibleModelCategories` +
     `selectedModels`）与 `getGeneralModelGroups`（`generalModels` + 分类可见性）筛，
     并且**每个候选项都已经过** `withConnectionAvailability`（连接级权益层）⇒
     这里**不重写一套筛选**、也不自己拼 label（官方文案/图标一律不自造）。
     ⚠️ `workflows` 传 `[]`：ComfyUI/RunningHub 工作流不是「接入的厂商连接」，与本轮口径无关
     （卡片的候选来源改动前后都不含工作流模型，不是本轮新引入的缺口 —— 见交付报告）。 */
  const { generalModels, providers, dreaminaAuth } = useAppStore(
    useShallow((state) => ({
      generalModels: state.config.generalModels,
      providers: state.config.providers,
      dreaminaAuth: state.config.dreaminaAuth,
    })),
  );
  /**
   * ★ 2026-10-15 用户口径（逐字）：
   *   「我是自定义的厂商 我后台接入什么厂商 你就显示什么厂商的 我接入两个 你就显示两个厂商的」
   *
   * ⇒ **MTV 内置目录（`official-model-meta.json` / `listDirectoryModelIds`）不再是候选来源**，
   *   只降级为**展示元数据**（`labels` 按 id 查名称、`getParamEntry` 查分类）。
   *   候选 = **用户已配置连接声明的模型**：
   *     · `<provider>/<modelId>` —— 内置品牌连接（apimart / dreamina / runninghub …），
   *       模型来自该连接的 `selectedModels`（用户从该连接带 Key 的 `/v1/models` 里勾的）；
   *     · `general/<配置 id>` —— 自定义连接（`generalModels`，由 `provider.selectedModels` 同步而来）。
   *   没有连接、或连接没有任何模型声明 ⇒ **贡献 0 条**（**绝不回落成内置全量**）。
   *   **清单在 ⇒ 只列清单内**（见下面的 `unavailable` 过滤器）；全部为空 ⇒ 卡片渲染
   *   **可操作提示**（`modelOptionsHint`），不渲染空下拉、也不塞内置模型充数。
   *
   * ⚠️ **「内置品牌连接」与「MTV 展示目录」是两件事**（2026-10-15 父 agent 裁决 2，**保留**）：
   *   · `getConfiguredModelGroups` 产出的 `<provider>/<modelId>`（apimart / dreamina / runninghub …）
   *     = **用户接入的连接**里**已勾选的 `selectedModels`**，且**前提是该连接已配置并且填了 apiKey**
   *     ⇒ 属于**「用户接入的厂商」**，**是**合法候选来源；
   *   · `src/data/official-model-meta.json` 的 `image`/`video` 表（`listDirectoryModelIds`）
   *     = **MTV 展示目录** ⇒ **不是**候选来源（只按 id 提供名称/分类等展示元数据）。
   *   ⇒ **下一个人不要因为「看着像内置的就删掉」**：前者删了会让只配了 apimart 的用户在卡上 0 候选。
   */
  const connectionModelsAll = useMemo(
    () => getMediaModelOptions(generalModels ?? [], { providers, dreaminaAuth }, [])
      .filter((model) => model.mediaKind === (isImage ? 'image' : 'video')),
    [dreaminaAuth, generalModels, isImage, providers],
  );
  const connectionModels = useMemo(
    () => connectionModelsAll
      /**
       * ★ **「该连接能调用才是事实」**：`unavailable === true` = 不在该连接**带 Key 的
       *   `/v1/models`** 权威清单里 —— 这个布尔由权益层既有函数算出
       *   （`connectionCandidateAvailability` + `isCandidateUnavailable`，见 `defaultModels.ts`
       *   的 `withConnectionAvailability`）；本文件**只消费**它，不重算、不另写一套「哪些能用」。
       *
       * 口径（用户 2026-10-15）：**清单在 ⇒ 只列清单内**（**严格裁剪，不走保守的 `trim` 版**）。
       *   · `unavailable === true`  ⇒ 该连接调不到它 ⇒ **不列**（但**必须可见**：见 `hiddenModelCount`
       *     与 `modelOptionsHint` —— 静默隐藏用户的东西是本项目出过事故的模式）；
       *   · `unavailable === false` ⇒ 在清单里 ⇒ 列；
       *   · `unavailable === undefined`（该连接**没有**任何清单：没拉过目录 / 拉失败 / 换过进程）
       *     ⇒ **不裁**，列它自己声明的模型（退回现状，不阻断 —— 与
       *     `services/ai/providerEntitlements.ts` 文件头「没有数据 ⇒ 不阻断」同一条纪律）。
       *
       * ⚠️ 价目表 `/api/pricing` 的 `enable_groups` **不参与**这里 —— 它只用于解释原因
       *    （P1 的 `evaluateModelGate` / `ModelEntitlementNotice`），不能拿来判定能力。
       */
      .filter((model) => model.unavailable !== true),
    [connectionModelsAll],
  );
  /**
   * ★ 本次过滤**真的隐藏掉**的候选数（≥1 ⇒ 必须给提示，**不许静默**）。
   *
   * 具体场景：该连接的 `catalogModels` 过时（上游新加了模型、本地还没重新拉目录）⇒ 用户明明
   * 在连接里声明过、却在卡上找不到它。**静默隐藏是这个项目出过事故的模式**（「下拉变空」，
   * 见 `defaultModels.ts` 的 `isProviderCategoryVisible`）⇒ 隐藏必须**可见且可操作**。
   */
  const hiddenModelCount = connectionModelsAll.length - connectionModels.length;
  /**
   * 候选值 → **来源标注**（`connectionId` / `connectionName` / `unavailable`）。
   *
   * 这三个值由权益层既有函数算出（`withConnectionAvailability` → `connectionCandidateAvailability`
   * + `applyCandidateAvailability`），本文件**只做透传**，不做第二套判定
   * （用户硬约束：「过滤/判定一律复用 `providerEntitlements.ts` 既有函数」）。
   */
  const connectionByValue = useMemo(() => {
    const map = new Map<string, Pick<ParamChipOption, 'connectionId' | 'connectionName' | 'unavailable'>>();
    for (const model of connectionModels) {
      map.set(model.value, {
        connectionId: model.connectionId,
        connectionName: model.connectionName,
        unavailable: model.unavailable,
      });
    }
    return map;
  }, [connectionModels]);
  /** 目录外引用 → 可读名（唯一出口，见 `resolveChipModelDisplayName`）。 */
  const resolveModelDisplayName = useMemo(
    () => (modelRef: string | undefined) => resolveChipModelDisplayName(modelRef, {
      generalModels,
      providers,
    }),
    [generalModels, providers],
  );
  /** 用户配置里真实存在的目录外模型引用 —— 喂给 `resolveModelEntity` 的第 3 档（见其文档）。 */
  const configuredModelRefs = useMemo(
    () => (generalModels ?? []).map((model) => `general/${model.id}`),
    [generalModels],
  );

  /* ── 编辑态（官方 `a.useState` 的 1:1 对应） ── */
  const [editedTimes, setEditedTimes] = useState<number | undefined>(
    typeof params.times === 'number' ? params.times : undefined,
  );
  const [editedDuration, setEditedDuration] = useState<number | undefined>(
    typeof params.duration === 'number' ? params.duration : undefined,
  );
  const [editedModel, setEditedModel] = useState<ModelEntity>(() => {
    const fromParams = resolveModelEntity(requestKind, params.model);
    if (fromParams) return fromParams;
    if (input.modelName) {
      return resolveModelEntity(requestKind, { status: 'unknown', displayName: input.modelName });
    }
    return null;
  });
  const [editedAspectRatio, setEditedAspectRatio] = useState<string>(aa(params.aspectRatio));
  const [editedImageSize, setEditedImageSize] = useState<string>(aa(params.imageSize));
  const [editedQuality, setEditedQuality] = useState<string>(aa(params.quality));
  const [editedResolution, setEditedResolution] = useState<string>(aa(params.resolution));
  const [editedGenerateAudio, setEditedGenerateAudio] = useState<boolean | undefined>(
    typeof params.generateAudio === 'boolean' ? params.generateAudio : undefined,
  );
  /* 官方 `D`/`L`（`visibleFields`/`clearedFields` 的编辑态覆盖）只由未移植的 `eG` 写入 ⇒ 恒 `null`。 */
  const visibleFields: ReadonlySet<string> | null = null;
  const clearedFields: ReadonlySet<string> | null = null;

  /* ★ round 121：把「用户配置里真实存在」的 `general/<配置 id>` 认作 `known`（见 `resolveModelEntity` 第 3 档）。
     ⚠️ **只用于读侧**（`modelId` / `modelUnknown` ⇒ chip 可编辑 + 当前模型进候选 + 选中值正确）。
     `editedModel` 状态**保持原样** ⇒ `rot` 的 `!qnt(editedModel, params.model)`（:1403）语义不变，
     未改动的卡不会谎报 `modifications.model_name`。 */
  const knownEditedModel = useMemo(
    () => resolveModelEntity(requestKind, editedModel, configuredModelRefs),
    [configuredModelRefs, editedModel, requestKind],
  );
  const modelId = IN(knownEditedModel);
  const imageModelId = isImage ? modelId : undefined;
  const videoModelId = isImage ? undefined : modelId;
  const videoModeType = Fb(params.videoMode);
  const modelUnknown = (knownEditedModel as { status?: string } | null | undefined)?.status === 'unknown';
  const videoModeUnknown = (params.videoMode as { status?: string } | undefined)?.status === 'unknown';
  /**
   * ★ 2026-10-15：**模型引用 → 官方能力表**的别名链（用户口径：「自定义模型 你映射官方的」）。
   *
   * 为什么需要它（现场根因）：MTV 卡上的模型引用是 `general/<配置 id>` 或 `<provider>/<modelId>`，
   * 而官方参数目录（`getParamEntry` / `imageModelInfo`）是**精确键**表（`CATALOG[modelId]`，
   * 见 `modelParamCatalog.ts:143`）—— 带前缀的引用**永远查不到** ⇒ `modelInfo === null`
   * ⇒ `Jnt` 的 `Lb(undefined, 当前值)` 只给出 `[当前值]` ⇒ 比例/清晰度菜单被裁成一行
   * （用户「点了没反应」的真因；模型 chip 不受影响，因为它的候选来自连接声明）。
   *
   * 复用仓里既有能力表 `utils/imageModelCapabilities.ts`（数据源
   * `src/data/official-image-models.json`，抽取自官方 EXE），候选顺序与「谁支持什么」都由它给：
   *   · `general/<配置 id>` ⇒ 该配置的 `modelId`（上游真名，最有价值）+ `name`；
   *   · `<provider>/<modelId>`（内置连接）⇒ 取 `/` 之后那段模型 id。
   * 匹配不到 ⇒ 返回 `null`（调用方走「官方完整候选 + 不置灰」的兜底，绝不再裁成一行）。
   */
  const modelAliasKeys = useMemo<readonly string[]>(() => {
    if (!modelId) return [];
    const keys: string[] = [modelId];
    if (modelId.startsWith('general/')) {
      const configId = modelId.slice('general/'.length);
      const config = (generalModels ?? []).find((model) => model.id === configId);
      if (config?.modelId) keys.push(config.modelId);
      if (config?.name) keys.push(config.name);
    }
    const slash = modelId.indexOf('/');
    if (slash > 0) keys.push(modelId.slice(slash + 1));
    return keys;
  }, [generalModels, modelId]);
  /** 官方能力表命中（图片侧；视频能力仍由参数目录 `videoModelInfoForRequest` 给）。 */
  const imageCapability = useMemo(
    () => (isImage && modelAliasKeys.length > 0 ? findImageModelCapability([...modelAliasKeys]) : null),
    [isImage, modelAliasKeys],
  );
  /**
   * **渠道**能收的档位（≠ 官方能力表）：土豆异步生图的免费池渠道拒 `resolution=4k` / `quality=high`
   * （`409 free_pool_param_mismatch`，2026-10-20 逐参数实测；详见 `services/models/channelParamLimits.ts`）。
   * chip 菜单没有「置灰」态（官方口径是「不支持就不列」）⇒ 这里直接把这些档位从候选里去掉。
   */
  const channelLimits = useMemo(
    () => channelParamLimitsFor([...modelAliasKeys]),
    [modelAliasKeys],
  );
  /**
   * **round 129（MTV 专有取值，不是官方字段）**：官方 `Og(e,t,n)` 的 `n` / `Xb(e,t)` 的 `t` /
   * `q=i||H===!0`（@2324104）里那个 `H` = `hl().isPayingCustomer`（计费/订阅 store，账号级）。
   * MTV **没有**这个数据源 ⇒ 三态：`true`（已知付过费）/ `false`（已知没付过费）/ `null`（未知）。
   * **凡是要用它下判断的地方，未知一律走「不限制」那一侧**（官方有、MTV 无数据 ⇒ 不阻断）。
   */
  const payingCustomer: boolean | null = forcePaidAccess ? true : (input.isPayingCustomer ?? null);
  /**
   * 官方 `q = i || H === !0` 的**消费值**：喂给
   *  · 官方**非付费档位表达式**（`$expr`：`e=>e.isPayingCustomer===!0?[]:…`，落到
   *    `videoModelInfoForRequest(…, q, …)` 的时长/清晰度集合与 `seedance-2.0-mini` 的 5s/480p 兜底）；
   *  · `Xb`(`passesSubscriptionGate`) 的订阅名单门。
   * 官方那位是布尔；MTV 未知 ⇒ 取 `true`（= 不按非付费档位裁剪、不按名单过滤），
   * **仍然保留 `false`**（宿主明确「已知没付过费」时逐字回到官方非付费分支）。
   */
  const paidOptions = payingCustomer !== false;
  /** 官方 `X = !i && ($ || H === null)`。 */
  const subscriptionLoading = !forcePaidAccess && (loading || input.isPayingCustomer === null);

  const referenceImageCount = params.referenceImageSources?.length ?? 0;
  const referenceVideoCount = params.referenceVideoSources?.length ?? 0;
  const referenceAudioCount = params.referenceAudioSources?.length ?? 0;

  /* 官方 `J = Fx(aa(m ?? t.prompt))`：MTV 无 `Fx` ⇒ 恒空计数、`unresolved:false`。 */
  const elementReferences = useMemo(
    () => ({ count: { image: 0, video: 0, audio: 0 }, unresolved: false }),
    [],
  );
  const baseShape = useMemo<ReferenceShapeCounts>(() => (
    input.resolvedReferences?.shape ?? {
      imageCount: referenceImageCount,
      videoCount: referenceVideoCount,
      audioCount: referenceAudioCount,
      unknownCount: 0,
      totalCount: referenceImageCount + referenceVideoCount + referenceAudioCount,
    }
  ), [input.resolvedReferences, referenceAudioCount, referenceImageCount, referenceVideoCount]);
  const mergedShape = useMemo(() => fie(baseShape, elementReferences), [baseShape, elementReferences]);
  const allShapes = useMemo<readonly ResolvedReferenceEntry[]>(
    () => input.allResolvedReferenceShapes ?? [{ shape: mergedShape }],
    [input.allResolvedReferenceShapes, mergedShape],
  );
  const referenceShapes = useMemo<readonly ResolvedReferenceEntry[]>(
    () => (allShapes.length > 0 ? allShapes : [{ shape: mergedShape }]),
    [allShapes, mergedShape],
  );
  const shapes = useMemo(() => referenceShapes.map((entry) => entry.shape), [referenceShapes]);
  const referencesPending = useMemo(
    () => shapes.some((shape) => shape.unknownCount > 0) || elementReferences.unresolved,
    [elementReferences.unresolved, shapes],
  );
  const referencesDeferred = !isImage && inferVideoMode && shapes.length > 0
    && shapes.every((shape) => shape.unknownCount === 0 && shape.totalCount === 0);

  const activeFields = useMemo(
    () => {
      const base = visibleFields ?? new Set(presentFields);
      /* round 116：系统未指派模型（MTV 专有状态）时，模型字段视作「可编辑」——
         否则 `buildChanges`（官方 `sot`：`activeFields.has("model") && …`）不会把用户选中的模型
         写进 `modifications`，「卡上选的」与「实际发的」就对不上了。 */
      if (!modelSelectionRequired || base.has('model')) return base;
      return new Set([...base, 'model']);
    },
    [presentFields, visibleFields, modelSelectionRequired],
  );
  const cleared = useMemo(() => clearedFields ?? new Set<string>(), [clearedFields]);

  /* ── 官方 `Se = isImage&&O ? Db(O,w) : U ? qI(U,me,q,overrides) : null` ──
     官方 `pe = M || i || !c || Ce || G || V || !U ? B : AN(U, Le ?? B, Y)`，`me = M ? void 0 : pe`。
     `dtt`（@2245721）依赖未提取的 `_p`/`iD`/`Ere` 契约表 ⇒ 官方本身 `?? t` 兜底生效 ⇒ `AN` 恒等；
     故 `me === B`（`B = Fb(params.videoMode)`）。**不是自创：官方每个分支都以 `?? t` / `? B` 收尾。** */
  const videoModelType = isImage ? undefined : videoModeType;

  const modelInfo = useMemo<ImageModelInfo | VideoModelInfo | null>(() => {
    if (isImage) return imageModelId ? imageModelInfo(imageModelId, editedAspectRatio || undefined) : null;
    if (!videoModelId) return null;
    return videoModelInfoForRequest(videoModelId, videoModelType, paidOptions, {
      aspectRatio: editedAspectRatio || undefined,
      duration: editedDuration,
      resolution: editedResolution || undefined,
      generateAudio: editedGenerateAudio,
      generateMode: editedQuality || undefined,
    });
  }, [
    editedAspectRatio, editedDuration, editedGenerateAudio, editedQuality, editedResolution,
    imageModelId, isImage, paidOptions, videoModelId, videoModelType,
  ]);
  const imageInfo = modelInfo?.kind === 'image' ? modelInfo : null;
  const videoInfo = modelInfo?.kind === 'video' ? modelInfo : null;

  /* ── 官方 `he = (M ? gtt(...) : btt(...)).filter(Xb).map(...)` ──
     ★ 2026-10-15：`input.directoryModelIds` **收窄为「宿主 / 测试显式注入的候选 id」**。
     省略 ⇒ **不再回落 MTV 内置目录**（见 `connectionModels` 的注释：候选只来自用户接入的连接）。
     ⚠️ 这推翻了本仓旧注释「卡上候选 = 官方逐字复刻，不许改（判 B 被否）」—— 用户 2026-10-15
     重新裁决：内置目录**不许再往里贡献候选**。注入时仍按 `kind` 过滤内置参数目录条目
     （`getParamEntry(id)?.kind === kind`），保持既有调用方/测试的语义不变。 */
  const directory = useMemo<string[]>(() => {
    const injected = input.directoryModelIds;
    if (!injected) return [];
    return injected.filter((id) => getParamEntry(id)?.kind === kind);
  }, [input.directoryModelIds, kind]);
  const labels = useMemo(
    () => input.modelLabels ?? listDirectoryModelLabels(kind),
    [input.modelLabels, kind],
  );

  const modelOptions = useMemo<ParamChipOption[]>(() => {
    const candidates: { value: string; disabled: boolean; isComingSoon: boolean }[] = [];
    const seen = new Set<string>();
    const push = (id: string | undefined, isCurrent: boolean, catalogExternal = false) => {
      if (!id || seen.has(id)) return;
      const entry = getParamEntry(id);
      if (isCurrent) {
        /* 当前请求模型（卡片载荷 `request_json.model_name`，MTV 形如 `provider/model` /
           `general/<配置 id>`）**必须在选项里**，否则 model chip 的 selectedValue 会落空。
           官方目录里必然含当前模型，故这不是"补默认值"。它通常没有官方目录条目 ⇒ 不标禁用，
           交由官方 `Og` 的 `G`（模型未知）分支处理。 */
        if (entry && entry.kind !== kind) return;
      } else if (!catalogExternal && (!entry || entry.kind !== kind)) {
        /* `catalogExternal`：**目录外**的合法引用（用户自定义连接的 `general/<配置 id>`）。
           官方 `dtt`/`mtt` 只枚举目录 id ⇒ 官方这条 `entry.kind !== kind` 过滤对它们不存在；
           MTV 的可用量 = 官方目录 + 该用户配置的连接模型，故单列一个放行口。 */
        return;
      }
      seen.add(id);
      /* 官方 `gtt`/`btt`：空引用形状下 `g=false`（形状维度不产生禁用），
         `c/x = isPayingCustomer === false && !Og(kind, model, false)`，`d = isComingSoon`。
         官方 `btt` 的 `ytt` 用的是模型 id 字面量集合 ⇒ 按用户硬要求换成目录 `isFree` 门控。
         ⚠️ round 129：官方那个 `q` 是**付费态**，MTV 未知 ⇒ 传 `payingCustomer`（`null` = 未知）
         ⇒ `modelIsFree` 直接放行；**只有宿主明确说「没付过费」时才回到官方非付费分支**。 */
      const freeDisabled = isCurrent && !entry
        ? false
        : !modelIsFree(kind, id, payingCustomer);
      const comingSoon = entry?.isComingSoon === true;
      candidates.push({ value: id, disabled: freeDisabled || comingSoon, isComingSoon: comingSoon });
    };
    push(modelId, true);
    for (const id of directory) push(id, false);
    /* ★ 候选来源 = **用户已配置连接声明的模型**（`connectionModels`）—— **平铺追加**，不造分组：
       官方 `he`（@2321750 邻域逐字）是 `(M ? dtt(...) : mtt(...)).filter(Kb).map(...)`
       产出**扁平**的 `{value,label,icon,disabled,disabledReason}`（`dtt` @2242907 内部也只是
       `Det("image").map(...).filter(...)`），`ParamChip` 同样扁平 `.map` 渲染
       ⇒ 官方模型菜单**没有任何分组**，所以这里没有「放哪个组」这回事
       （厂商区分靠 option 上的 `connectionId` / `connectionName` 标注，见 `ParamChipOption`）。
       门控/文案：官方那套 `isPayingCustomer === !1 && !Og(...)` 只作用于 `dtt`/`mtt` 枚举出的
       **目录模型**；目录外引用官方无对应判据，本仓已明文「目录外 ⇒ 不阻断」
       （`services/ai/modelParamCatalog.ts:486-487`）⇒ 不按 `isPayingCustomer` 门控；
       官方 option 形状里**没有 `hint` 字段** ⇒ 也不加 hint（不造官方没有的文案）。 */
    for (const option of connectionModels) push(option.value, false, true);
    return preferEnabled(candidates)
      .filter((option) => passesSubscriptionGate(option.value, payingCustomer))
      .map((option) => {
        const entry = getParamEntry(option.value);
        /* ⚠️ round 129：这里原来把 `false`（=「该用户没付过费」）硬传进 `modelIsFree` ⇒
           目录里 8 个显式 `isFree:false` 的模型无条件带锁 + 文案。改为传 `payingCustomer`
           （未知 = `null` ⇒ 放行）。 */
        const freeDisabled = entry
          ? !modelIsFree(kind, option.value, payingCustomer)
          : false;
        const disabled = option.disabled;
        return {
          value: option.value,
          /* 官方 `label: f(Ot.labelKey,{defaultValue:Ot.value})` 的 MTV 落点：
             目录内走目录 displayName / 目录 label；**目录外必须过展示名出口**，
             否则 `general/<配置 id>` 会原样印在卡上（见 `resolveChipModelDisplayName`）。
             ★ 2026-10-15：`labels`/`entry` 现在是内置目录**仅作为展示元数据**的用法
             （按 value 匹配取名称/图标），不再贡献候选本身。 */
          label: labels[option.value] ?? entry?.label ?? resolveModelDisplayName(option.value),
          /* 官方 `icon: jt?.icon`：`oe` 图标枚举 + 目录 `icon` 字段未落在本 JSON（规格 §7 边界）⇒ 不补。 */
          disabled,
          disabledReason: disabled
            ? option.isComingSoon
              ? undefined /* 官方 `E3({isComingSoon:!0,…})` 文案未提取（见文件头）。 */
              : freeDisabled
                ? tx(t, 'video.modelRestricted', 'Subscription required')
                : undefined
            : undefined,
          /* ★ 来源标注（**只透传权益层的既有标注**，不在这里重算）：
             接了多条连接时，下拉里靠它分辨「哪条来自哪个厂商」。 */
          ...connectionByValue.get(option.value),
        } satisfies ParamChipOption;
      });
  }, [connectionByValue, connectionModels, directory, kind, labels, modelId, payingCustomer, resolveModelDisplayName, t]);

  const firstEnabledModel = modelOptions.find((option) => !option.disabled) ?? modelOptions[0];

  /**
   * ★ 2026-10-15 用户口径：候选**只**来自「他接入的连接」⇒ **所有已配置连接都没有为这个 kind
   *   声明任何模型**时，候选就是 0 条。此时：
   *     · **不塞 MTV 内置模型充数**（内置目录已降级为展示元数据）；
   *     · **也不渲染空下拉**（`ParamChip` 在 `options.length === 0` 时降级为静态 chip ⇒ 打不开菜单）；
   *     · 改为给一句**可操作**的提示：卡片渲染它（`modelOptionsHint`），确认按钮的禁用理由也用它。
   *   空下拉是历史事故（`defaultModels.ts` 的 `isProviderCategoryVisible`：`visibleModelCategories`
   *   被存成空数组 ⇒ 该连接所有模型被滤光 ⇒ 下拉 280×16、`children: 0`）——**这条纪律沿用，
   *   但解法不是"多列几个内置模型"，而是"告诉用户去哪儿把模型拉出来"**。
   *
   * ★ 2026-10-15 追加（父 agent 必改项）：**「部分被隐藏」也不许静默**。
   *   严格裁剪（「清单在 ⇒ 只列清单内」）会隐藏掉 `catalogModels` 里没有的候选 —— 如果清单过时
   *   （上游新加、本地没重新拉目录），用户会以为「我明明接过这个模型，怎么不见了」。
   *   ⇒ **只要本次过滤真的隐藏了 ≥1 条，就出提示并给出数量**（`hiddenModelCount`）。
   *   零隐藏 / 无连接声明 ⇒ 不出提示（不吓人）。
   *
   * ★ 追加（零隐藏空候选的措辞）：原文案「**重新拉取模型列表**」把「重拉」说成了解药，
   *   但有一类空候选**重拉无效** —— 勾选确实落盘了、却没有镜进 `generalModels`
   *   （`store.config.ts` 的镜像名单漏了新厂商；现改为定义驱动 + 加载期自愈）。
   *   ⇒ 事实先写在前面（「没有可用模型」），动作改成「**拉取并勾选**要接入的模型」
   *   （只重拉、不勾选同样还是空）。
   */
  const modelCandidatesEmpty = modelOptions.length === 0;
  /* ⚠️ 占位符用 `.replace` 而不是 `t(key, {count})`：`useConfirmationText` 的包装
     （`generationConfirmationStrings.ts:137-140`）只把 zh 源串交给 `t()`，**不透传 vars**
     ⇒ 传 vars 会被静默丢掉（`{count}` 原样印在卡上）。`.replace` 与语言无关，且字典键
     = 带 `{count}` 的中文源串本身。 */
  const fillCount = (template: string) => template.replace('{count}', String(hiddenModelCount));
  const modelOptionsHint = modelCandidatesEmpty
    ? (hiddenModelCount > 0
      /* 这一支隐藏数 > 0 ⇒ 声明过模型、只是被这份清单滤掉 ⇒ **重拉**确实是解药，保留原措辞 */
      ? fillCount(t('这条连接还没有可用模型（有 {count} 个模型不在本连接的当前清单里、已隐藏）。先在「设置 → API 连接」里重新拉取模型列表，确认卡的候选只来自你接入的厂商。'))
      : t('这条连接没有可用模型：请在「设置 → API 连接」里拉取模型并勾选要接入的模型；确认卡的候选只来自你接入的厂商。'))
    : hiddenModelCount > 0
      ? fillCount(t('有 {count} 个模型不在本连接的当前清单里、已隐藏；清单可能过时，可在「设置 → API 连接」重新拉取。'))
      : undefined;

  /* ── 官方 `_e = !l || Xb(F,h)` / `ce` ── */
  const modelChipValueEditable = !paramControlsEditable || passesSubscriptionGate(modelId, payingCustomer);
  /* round 116：MTV 专有的「系统未指派模型」状态 ⇒ 未选时显示**占位文案**。
     占位用的是官方自己的模型 chip 兜底键 `chatAdapter.modelOptions.model`（默认值 `"Model"`，
     官方 @2324048 邻域 `ge?.label ?? f("chatAdapter.modelOptions.model","Model")`）——
     是**标签占位**，不是任何模型数据（不拿别的串顶替真实模型名）。 */
  const modelUnassigned = modelSelectionRequired && !editedModel;
  const modelDisplayName = modelUnassigned
    ? tx(t, 'chatAdapter.modelOptions.model', 'Model')
    : modelChipValueEditable
      ? (modelInfo
        ? tx(t, modelInfo.nameKey, String(modelId ?? ''))
        : modelUnknown
          /* 官方 `_.displayName`（@2331722 邻域逐字）—— 官方 `hE`/`gZe` 用的是**非空**模型目录
             （`wireName`↔`modelId`），拿到的 `displayName` 天然是可读名。
             MTV 的 `generationConfirmationProtocol.hE` 目录为空（该文件 @679-690 自述），
             于是 `displayName` 就是载荷 `request_json.model_name` **原样**
             ——真机现象（用户 2026-10-15 17:57）：`@model` 了自定义连接模型后，
             确认卡上直接印出 `general/provider-custom-2611fc0a-7n7og`。
             ⇒ 这里必须过展示名出口（本仓明文禁止印内部调用引用：
             `components/ProjectSettingsPopover.tsx:644`）。非引用串（如真实的展示名）经出口是**恒等**的。 */
          ? resolveModelDisplayName(String((editedModel as { displayName?: string }).displayName ?? ''))
          /* 官方 `ce` 的第三支 `String(F ?? "")`：官方世界里 `F = IN(_)` 就是可读模型 id
             （官方没有 `general/<配置 id>` 这一层）⇒ MTV 的目录外引用同样过展示名出口。 */
          : resolveModelDisplayName(modelId))
      : firstEnabledModel?.label ?? tx(t, 'chatAdapter.modelOptions.model', 'Model');
  const editedModelId = modelUnassigned
    ? ''
    : String((modelChipValueEditable ? modelId : firstEnabledModel?.value) ?? '');

  /* ── method chip（官方 `HI` @2246570 / `GV` @2246469） ── */
  const methodKeys = useMemo(() => videoMethodKeys(videoModelId), [videoModelId]);
  const HI = useCallback((id: string | undefined, resolvedModelType: string | undefined): VideoMethodKey | null => {
    if (!resolvedModelType || !id) return null;
    const entry = getParamEntry(id);
    if (!entry) return null;
    const variant = resolveVariant(entry, resolvedModelType);
    return methodKeyOfModelType(variant?.modelType);
  }, []);
  const methodChipOptions = useMemo<ParamChipOption[]>(() => (
    isImage || !inferVideoMode || !videoModelId
      ? []
      : methodKeys.map((key) => ({
        value: key,
        /* 官方 `label: O(VA(o.model, He))`（canvas `@2057900`）：方法键 → **该模型的**
           `referenceLabelKey` 优先（seedance-2.0/-fast/-mini/2.5、kling-video-o1/-o3 六条都是
           `videoConfigs.referenceOmni`），其次 `edit → videoModels.videoEdit`，否则 `videoConfigs.<method>`。
           ⚠️ 第 65 轮修正：这里先前直接拼 `videoConfigs.${key}` ⇒ seedance 在 `reference` 档显示
           「参考」，而官方显示「**全能参考**」（这正是 §69 报告里点出的会话侧残留缺口）。 */
        label: tx(t, videoGenerateMethodLabelKey(videoModelId, key), OFFICIAL_METHOD_LABEL_ZH_FALLBACK[key] ?? key),
        /* 官方 `GV(U,Y)` 的 `disabled: !utt(U,n,shapes)`；`utt` 依赖未提取的 `_p`/`iD`/`xx`
           （见文件头）⇒ 不产生禁用标记（空引用形状下官方 `g` 亦为 false）。 */
        disabled: false,
        disabledReason: undefined,
      }))
  ), [inferVideoMode, isImage, methodKeys, t, videoModelId]);
  const currentMethod = useMemo<VideoMethodKey | null>(() => {
    if (isImage || !inferVideoMode || !videoModelId) return null;
    /* 官方 `Ue = Ce ? HI(U,B) : be && Le ? be : HI(U,me)`；`be`/`Le` 在 MTV 恒 `null`。 */
    if (referencesPending) return HI(videoModelId, videoModeType);
    return HI(videoModelId, videoModelType);
  }, [HI, inferVideoMode, isImage, referencesPending, videoModelId, videoModeType, videoModelType]);

  /* ── aspect / imageSize / quality ── */
  const autoLabel = tx(t, 'videoConfigs.auto', 'Auto');
  const autoUnsupportedTooltip = tx(
    t,
    'videoConfigs.autoUnsupportedTooltip',
    'Adjustments are not supported in the current mode',
  );
  const aspectRatioState = useMemo(() => {
    const base = Jnt({
      activeFields,
      autoLabel,
      editedAspectRatio,
      isImage,
      isPending: paramControlsEditable,
      modelInfo,
    });
    /**
     * ★ 2026-10-15（用户现场 P0「比例胶囊点了没反应」）：**只有官方目录查不到该模型时**
     * 才补候选 —— 目录/官方能力表**能给出声明集**时，菜单保持官方逐模型原样
     * （既有回归 `generationChipController.test.tsx`「options 全部来自 per-model 参数目录」
     * 钉的就是这个：`doubao-seedream-4.5 → 2K/4K`，不许被并集冲掉）。
     *
     * 触发条件 = `modelInfo === null`：官方 `Jnt`（`@2312154`）图片分支给的是
     * `Lb(modelInfo.aspectRatios, 当前值)`；MTV 的自接模型（`general/<配置 id>` /
     * `<provider>/<modelId>`）在参数目录里查不到 ⇒ 只剩当前值 1 项 ⇒ 菜单点开只有自己，
     * 选中等于没选。这里按官方 `NANO_BANANA_2_1` 的 15 项补位（出处见
     * `OFFICIAL_ASPECT_RATIO_CANDIDATES` 注释）；别名链能查到官方能力时，**不支持的项置灰**
     * （用户口径：「可以置灰但不要剪掉整个菜单」）。
     * 视频侧保持官方 `Jnt` 原样（候选由 `videoModelInfoForRequest` 的 variant 能力表给，
     * 与图片是两套机制，未在本轮改动）。
     */
    if (!isImage || modelInfo) return base;
    const supported = imageCapability ? (imageCapability.aspectRatios ?? []) : null;
    return {
      ...base,
      options: gatedParamOptions({
        official: OFFICIAL_ASPECT_RATIO_CANDIDATES,
        resolved: base.options.map((option) => option.value),
        supported,
      }),
    };
  }, [
    activeFields, autoLabel, editedAspectRatio, imageCapability, isImage, modelInfo, paramControlsEditable,
  ]);

  const imageSizeCollapsed = isImage && Array.isArray(imageInfo?.imageSizeOptions)
    && imageInfo.imageSizeOptions.length === 0;
  /**
   * 该模型**声明支持**的清晰度档位（`null` = 未知 ⇒ 不置灰）。
   * 顺序：参数目录（官方 `qo` 抽取）→ 官方能力表（`official-image-models.json`，按别名链命中）。
   */
  const declaredImageSizes = useMemo<readonly string[] | null>(() => {
    if (!isImage) return null;
    const allowed = (list: readonly string[]) => (channelLimits
      ? list.filter((value) => !isChannelDisabled(channelLimits.disabledImageSizes, value))
      : list);
    if (Array.isArray(imageInfo?.imageSizeOptions)) return allowed(imageInfo.imageSizeOptions);
    if (imageCapability) {
      return allowed(imageSizesForModel([...modelAliasKeys], editedAspectRatio || undefined));
    }
    return null;
  }, [channelLimits, editedAspectRatio, imageCapability, imageInfo?.imageSizeOptions, isImage, modelAliasKeys]);
  const imageSizeOptions = useMemo<ParamChipOption[]>(() => (
    imageSizeCollapsed
      ? []
      /* ★ 2026-10-15：**目录没给声明集时**才补官方候选 —— 与比例胶囊同一条纪律
         （目录/能力表能给就保持官方逐模型原样，例如 `doubao-seedream-4.5 → 2K/4K`；
         查不到才补 `["1K","2K","4K"]`，不支持的档位置灰，绝不剪成「只有当前值」）。
         自接模型走 `general/<配置 id>` ⇒ 参数目录查不到 ⇒ 旧行为是 `Lb(undefined, 当前值)` =
         一项（用户「点了没反应」）。 */
      : Array.isArray(imageInfo?.imageSizeOptions)
        ? Lb(imageInfo.imageSizeOptions, activeFields.has('imageSize') ? editedImageSize : '')
          .map((value) => ({ value, label: value === '0.5K' ? '512P' : value }))
        : gatedParamOptions({
          official: OFFICIAL_IMAGE_SIZE_CANDIDATES,
          resolved: Lb(undefined, activeFields.has('imageSize') ? editedImageSize : ''),
          supported: declaredImageSizes,
          labelOf: (value) => (value === '0.5K' ? '512P' : value),
        })
  ), [activeFields, declaredImageSizes, editedImageSize, imageInfo, imageSizeCollapsed]);

  const qualityOptions = useMemo<ParamChipOption[]>(() => Lb(
    videoInfo?.qualityOptions ?? imageInfo?.qualityOptions,
    activeFields.has('quality') ? editedQuality : '',
  ).map((value) => ({
    value,
    label: tx(t, isImage ? `imageModels.gpt2.qualityOptions.${value}` : `videoConfigs.modeOptions.${value}`, value),
  })), [activeFields, editedQuality, imageInfo?.qualityOptions, isImage, t, videoInfo?.qualityOptions]);

  /* ── duration / resolution ── */
  const durationOptions = useMemo<ParamChipOption[]>(() => lO(
    videoInfo?.durations,
    (activeFields.has('duration')) ? QV(editedDuration, videoInfo) : undefined,
  ).map((value) => ({
    value: String(value),
    label: value === -1 ? tx(t, 'videoConfigs.durationAuto', 'Auto') : `${value}s`,
  })), [activeFields, editedDuration, t, videoInfo]);

  const resolutionOptions = useMemo<ParamChipOption[]>(() => {
    const resolved = Wnt(
      videoInfo?.resolutions,
      activeFields.has('resolution') ? editedResolution : '',
    );
    /* 目录里有该模型的声明集 ⇒ 保持官方逐模型菜单（`Wnt` 原样）。 */
    if ((videoInfo?.resolutions?.length ?? 0) > 0) return resolved;
    /**
     * ★ 2026-10-15：模型不在参数目录（自接连接）或该 variant 没声明分辨率 ⇒ `Wnt` 只回
     * `[当前值]` ⇒ 菜单只有一行。补上目录里出现过的分辨率档位并集
     * （`model-param-catalog.json` 全部 video variant 的 `resolutions`），大小写不敏感合并、
     * 保留当前值写法（`1080P` 不会被改写成 `1080p`）；**全部可点**（无能力数据 ⇒ 不阻断）。
     */
    return gatedParamOptions({
      official: OFFICIAL_VIDEO_RESOLUTION_CANDIDATES,
      resolved: resolved.map((option) => option.value),
      supported: null,
      labelOf: (value) => value.toUpperCase(),
    });
  }, [activeFields, editedResolution, videoInfo?.resolutions]);

  /* ── times ── */
  const fixedImageCount = isImage && typeof imageInfo?.batchSize === 'number' && imageInfo.batchSize > 1
    ? imageInfo.batchSize
    : undefined;
  const effectiveTimes = fixedImageCount ?? editedTimes;
  const estimateTimes = fixedImageCount != null ? 1 : effectiveTimes ?? 1;

  /* ── confirm gate ── */
  /* ⚠️ round 129：官方 `Fg(e,O,q)` 的第三参是**付费态**。原来传 `paidAccess`（未知 ⇒ `false`）
     ⇒ 显式 `isFree:false` 的目录模型即使被指派/选中也判「不可用」，理由落到
     `video.modelRestricted`（"Subscription required"）。改传 `payingCustomer`（未知 ⇒ 放行）。 */
  const modelAvailable = modelUnknown
    || (!!modelId && modelIsFree(requestKind, modelId, payingCustomer) && modelSupportsShapes(requestKind, modelId, shapes));
  /**
   * round 116：MTV 专有状态「系统未指派模型」⇒ 「确认」仍必须禁用（`resolveApprovalSelection` 对
   * `media_model` 审批要求 `inputValues.modelRef`，缺了会被下游 deny），但**理由必须是诚实的**：
   * 官方那串 `video.modelRestricted`（"Subscription required"）在 MTV 无法成立（无付费态数据源），
   * 原来它恰好落在这里 ⇒ 卡片上浮一个假提示把「确认」挡住（用户现场）。
   * 这里改报「先选模型」，并且**用官方已有的选择模型文案键**（zh 取值在懒加载语言包里，未提取
   * ⇒ 回落官方英文默认值，与仓库既有 `tx(key, fallback)` 纪律一致；**不自造中文**）。
   *
   * round 129 补：这条理由链**一个字都没删**（`Subscription required` 的四个落点原样保留）——
   * 只是「什么时候轮到它」变了：未知付费态不再落到它；宿主明确 `isPayingCustomer:false`、
   * 且该模型在官方目录里是显式付费档时，仍然落到它（见测试里的反例）。
   */
  const confirmDisabled = subscriptionLoading || !modelAvailable;
  const confirmDisabledReason = subscriptionLoading
    ? tx(t, 'common.loading', 'Checking subscription')
    : modelCandidatesEmpty
      /* ★ 2026-10-15：候选为 0（所有连接都没声明模型）⇒ 理由不是「先选模型」（没得选），
         而是**可操作提示**（去哪儿把模型拉出来）。这一段在 `modelSelectionRequired` 之前判，
         因为此时 `!modelId` 与「候选为空」是同一件事的两个说法，后者更可操作。 */
      ? modelOptionsHint
      : modelSelectionRequired && !modelId
        ? tx(t, 'videoConfigs.selectModel', 'Select a model')
        : modelAvailable
          ? undefined
          : modelId && modelIsFree(requestKind, modelId, payingCustomer)
            ? tx(t, 'video.modelInputIncompatible', 'The selected model does not support these references')
            : tx(t, 'video.modelRestricted', 'Subscription required');

  /* ── 官方 `Et`（`eG`）未移植：模型切换只改编辑态模型 ── */
  const handleModelChange = useCallback((value: string) => {
    if (value === modelId || referencesPending || modelEditingLocked) return;
    setEditedModel({ status: 'known', id: value });
  }, [modelEditingLocked, modelId, referencesPending]);

  const handleMethodChange = useCallback((value: string) => {
    /* 官方 `tt`：`if (M || !c || Ce || De) return;` —— 空引用形状下 `De` 为真 ⇒ no-op。 */
    if (isImage || !inferVideoMode || referencesPending || referencesDeferred) return;
    void value;
  }, [inferVideoMode, isImage, referencesDeferred, referencesPending]);

  const handleQualityChange = useCallback((value: string) => {
    setEditedQuality(value);
  }, []);

  const handleGenerateAudioChange = useCallback((value: string) => {
    setEditedGenerateAudio(value === 'on');
  }, []);

  /* ── 官方 `at`（=`rot`）/ `W`（=`Mv` o `die`） ── */
  const buildChanges = useCallback((prompt: string, source?: GenerationParams) => {
    const sourceParams = source ?? originalParams ?? params;
    return rot({
      requestKind,
      params: sourceParams,
      activeFields,
      clearedFields: cleared,
      editedPrompt: prompt,
      editedTimes,
      editedDuration,
      editedModel,
      editedAspectRatio: aspectRatioState.requestValue,
      editedImageSize,
      editedQuality,
      editedResolution,
      aspectRatioModificationMode: aspectRatioState.modificationMode,
      editedGenerateAudio,
      aspectRatioOptionsLength: aspectRatioState.options.length,
      imageSizeOptionsLength: imageSizeOptions.length,
      qualityOptionsLength: qualityOptions.length,
      durationOptionsLength: durationOptions.length,
      resolutionOptionsLength: resolutionOptions.length,
      effectiveVideoModelType: videoModelType,
      originalVideoModelType: Fb(sourceParams.videoMode),
    });
  }, [
    activeFields, aspectRatioState.modificationMode, aspectRatioState.options.length, aspectRatioState.requestValue,
    cleared, durationOptions.length, editedDuration, editedGenerateAudio, editedImageSize,
    editedModel, editedQuality, editedResolution, editedTimes, imageSizeOptions.length, originalParams, params,
    qualityOptions.length, requestKind, resolutionOptions.length, videoModelType,
  ]);

  const buildModifications = useCallback((prompt: string, addedNodeIds: readonly string[]) => (
    buildWireModifications(kind, die(buildChanges(prompt), addedNodeIds), protocolContext ?? {}, cleared)
  ), [buildChanges, cleared, kind, protocolContext]);

  return {
    /* 12 个开关（官方逐字）。
       round 116：`modelSelectionRequired`（MTV 专有：系统未指派模型）时，即使 `editedModel` 还为空
       也要把模型 chip 渲染出来 —— 它是用户**唯一**能选到模型的入口；否则卡片既没有模型 chip、
       「确认」又永远禁用（用户现场）。`!!editedModel` 这一半只对「已指派但解析不出实体」的场景保留。 */
    showModelChip: (activeFields.has('model') && !!editedModel) || modelUnassigned,
    showMethodChip: !isImage && !!currentMethod && methodChipOptions.length > 0,
    showAspectRatioChip: aspectRatioState.visible,
    showImageSizeChip: isImage && activeFields.has('imageSize') && imageSizeOptions.length > 0,
    showImageSizeAutoChip: imageSizeCollapsed && activeFields.has('imageSize'),
    showQualityChip: activeFields.has('quality') && qualityOptions.length > 0,
    showDurationChip: !isImage && (activeFields.has('duration')) && editedDuration != null && durationOptions.length > 0,
    showDurationAutoChip: !isImage && !!videoInfo && durationOptions.length === 0,
    showResolutionChip: !isImage && (activeFields.has('resolution')) && resolutionOptions.length > 0,
    showResolutionAutoChip: !isImage && !!videoInfo && resolutionOptions.length === 0,
    showTimesChip: isImage && activeFields.has('times') && editedTimes != null,
    showGenerateAudioMenu: !isImage && activeFields.has('generateAudio')
      && videoInfo?.supportsGenerateAudio === true && typeof editedGenerateAudio === 'boolean',
    showSceneChip: false,

    confirmDisabled,
    confirmDisabledReason,

    modelInfo: { icon: undefined },
    modelDisplayName,
    modelSelectedValue: editedModelId,
    modelOptions,
    modelOptionsHint,
    handleModelChange,
    modelChipEditable: !modelEditingLocked && !referencesPending && !modelUnknown && !videoModeUnknown,

    currentMethod: currentMethod ?? undefined,
    methodChipOptions,
    handleMethodChange,
    methodChipEditable: paramControlsEditable && !referencesPending && !modelUnknown && !videoModeUnknown
      && !referencesDeferred && methodChipOptions.length > 1,

    aspectRatioState,
    setEditedAspectRatio,
    editedImageSize,
    imageSizeOptions,
    setEditedImageSize,
    editedQuality,
    qualityOptions,
    handleQualityChange,

    effectiveEditedDuration: editedDuration,
    durationOptions,
    setEditedDuration,
    effectiveEditedResolution: editedResolution,
    resolutionOptions,
    setEditedResolution,

    editedGenerateAudio,
    audioOptions: [
      { value: 'on', label: tx(t, 'common.on', 'On') },
      { value: 'off', label: tx(t, 'common.off', 'Off') },
    ],
    handleGenerateAudioChange,

    effectiveTimes,
    editedTimes,
    setEditedTimes,
    fixedImageCount: fixedImageCount ?? null,

    sceneDisplayName: undefined,
    sceneOptions: [],
    handleSceneChange: undefined,
    sceneChipEditable: false,
    durationDisplayName: undefined,
    durationChipEditable: false,
    supportsLyrics: false,
    lyricsMode: undefined,
    lyricsModeOptions: [],
    lyricsModeDisplayName: undefined,
    handleLyricsModeChange: undefined,
    lyrics: undefined,
    setEditedLyrics: undefined,

    buildChanges,
    buildModifications,
    clearedFields: [...cleared],

    modelId,
    effectiveDuration: editedDuration,

    /* 官方多出的 23 个字段 */
    isImage,
    editedModelId,
    editedAspectRatio,
    editedDuration,
    editedResolution,
    estimateTimes,
    displayVideoModelType: videoModelType,
    resolvedReferences: input.resolvedReferences,
    elementReferences,
    activeFields,
    clearedEstimateParams: [],
    autoLabel,
    autoUnsupportedTooltip,
    imageSizeCollapsed,
    scene: undefined,
    settledAudioParams: [],
    advancedParamChips: [],
    handleAdvancedParamChange: undefined,
    controlsWillRender: false,
    ControlsComponent: undefined,
    controlParams: {},
    handleControlParamChange: undefined,
    isVideoAdaptive: false,
  };
}

/* ------------------------------------------------------------------ *
 * 官方 `rot` @2315137（逐字）
 * ------------------------------------------------------------------ */

interface RotInput {
  requestKind: ParamCatalogKind;
  params: GenerationParams;
  activeFields: ReadonlySet<string>;
  clearedFields: ReadonlySet<string>;
  editedPrompt: string;
  editedTimes?: number;
  editedDuration?: number;
  editedModel: ModelEntity;
  editedAspectRatio: string;
  editedImageSize: string;
  editedQuality: string;
  editedResolution: string;
  aspectRatioModificationMode: AspectRatioState['modificationMode'];
  editedGenerateAudio?: boolean;
  aspectRatioOptionsLength: number;
  imageSizeOptionsLength: number;
  qualityOptionsLength: number;
  durationOptionsLength: number;
  resolutionOptionsLength: number;
  effectiveVideoModelType?: string;
  originalVideoModelType?: string;
}

/** 官方 `sot` @2314386（`aie` 的 elementRefs 分支未移植，见文件头）。 */
function sot(input: RotInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.editedPrompt !== aa(input.params.prompt)) out.prompt = input.editedPrompt;
  if (input.activeFields.has('model') && input.editedModel && !qnt(input.editedModel, input.params.model)) {
    out.model = input.editedModel;
  }
  return out;
}

/** 官方 `tG` @2314605（逐字）。 */
function tG(target: Record<string, unknown>, fields: readonly string[], clearedFields: ReadonlySet<string>): void {
  for (const field of fields) if (clearedFields.has(field)) target[field] = null;
}

/** 官方 `nG` @2314674（逐字）。 */
function nG(target: Record<string, unknown>, input: RotInput): void {
  const params = input.params as Record<string, unknown>;
  const { activeFields: fields, editedAspectRatio, editedQuality, aspectRatioModificationMode, aspectRatioOptionsLength, qualityOptionsLength } = input;
  if (aspectRatioModificationMode === 'optional') {
    if (aspectRatioOptionsLength > 0 && editedAspectRatio) {
      if (editedAspectRatio !== (params.aspectRatio ?? '')) target.aspectRatio = editedAspectRatio;
    } else if (params.aspectRatio) {
      target.aspectRatio = null;
    }
  } else if (
    (aspectRatioModificationMode === 'value' && aspectRatioOptionsLength > 0 && editedAspectRatio
      && editedAspectRatio !== (params.aspectRatio ?? ''))
    || (aspectRatioModificationMode === 'legacy' && fields.has('aspectRatio') && aspectRatioOptionsLength > 0
      && editedAspectRatio && editedAspectRatio !== (params.aspectRatio ?? ''))
  ) {
    target.aspectRatio = editedAspectRatio;
  }
  if (fields.has('quality') && qualityOptionsLength > 0 && editedQuality
    && editedQuality !== (params.quality ?? '')) {
    target.quality = editedQuality;
  }
}

/** 官方 `rot` @2315137（逐字）。 */
function rot(input: RotInput): Record<string, unknown> | undefined {
  const base = sot(input);
  const params = input.params as Record<string, unknown>;
  const fields = input.activeFields;
  if (input.requestKind === 'image') {
    const out = { ...base };
    tG(out, TOT, input.clearedFields);
    nG(out, input);
    if (fields.has('times') && input.editedTimes != null && input.editedTimes !== params.times) {
      out.times = input.editedTimes;
    }
    if (fields.has('imageSize') && input.imageSizeOptionsLength > 0 && input.editedImageSize
      && input.editedImageSize !== (params.imageSize ?? '')) {
      out.imageSize = input.editedImageSize;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  const out = { ...base };
  tG(out, NOT, input.clearedFields);
  nG(out, input);
  if (input.effectiveVideoModelType && input.effectiveVideoModelType !== input.originalVideoModelType) {
    out.videoMode = { status: 'known', modelType: input.effectiveVideoModelType };
  }
  if (fields.has('duration') && input.durationOptionsLength > 0 && input.editedDuration != null
    && input.editedDuration > 0 && input.editedDuration !== params.duration) {
    out.duration = input.editedDuration;
  }
  if (fields.has('resolution') && input.editedResolution && input.resolutionOptionsLength > 0
    && input.editedResolution !== (params.resolution ?? '')) {
    out.resolution = input.editedResolution;
  }
  if (fields.has('generateAudio') && typeof input.editedGenerateAudio === 'boolean'
    && input.editedGenerateAudio !== params.generateAudio) {
    out.generateAudio = input.editedGenerateAudio;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/* ------------------------------------------------------------------ *
 * 模型实体解析 & 形状兼容
 * ------------------------------------------------------------------ */

/**
 * 官方 `hE`/`gZe`（canvas:@2200xxx 邻域）解析 `model_name` → 模型实体。
 *
 * MTV 的 `hE` 依赖 `MODEL_CATALOG`（`generationConfirmationProtocol.ts`，三个 kind 全空表）
 * ⇒ 恒 `{status:"unknown",displayName}`。这里补上官方 `BE`（@2237624）**逐字**的兜底：
 * ```js
 * switch (e) { case "image": if (t in qo) return {status:"known", id:t}; break;
 *              case "video": if (Hp(t)) return {status:"known", id:t}; break; … }
 * ```
 * 即「wire 名本身就是目录键 ⇒ 它同时是 model id」。**不是按厂商写死，而是查目录。**
 *
 * ★ round 121 —— 追加第 3 档（`configuredModelRefs`）：
 * 官方这条兜底之所以够用，是因为**官方没有「自定义连接」这一层**，用户能选的模型恒在官方目录里
 * ⇒ `G = _.status==="unknown"`（`iie` @2324048）在官方**永远为假**。
 * MTV 的 `general/<配置 id>`（自接连接模型）**永远不在官方目录里** ⇒ 若只照字面查目录，
 * 自定义连接用户会被永久判成 unknown ⇒ `modelChipEditable` 里的 `!modelUnknown` 恒假
 * ⇒ **卡上永远换不了模型**（用户原话：「为什么要去 @ 模型」）——这是 MTV 自己的功能不可用，
 * 不是「偏离官方」。故这里给同一条规则**换一个数据源**：目录查不到就**查用户配置**。
 *
 * 判据纪律与 `services/ai/modelParamCatalog.ts:486-487`「**目录外（自接模型，官方不存在这种输入）
 * ⇒ 官方无对应判据 ⇒ 放行**」**同源**（那里管「能不能用」，这里管「认不认得」）。
 *
 * ⚠️ 只影响**读侧**（`modelId` / `modelUnknown` ⇒ chip 可编辑 + 当前项进候选）。
 * 调用方**不要**用它替换 `editedModel` 状态：`rot`（@1390）的
 * `!qnt(editedModel, params.model)` 决定「用户是否真的改过模型」⇒ 替换会让未改动的卡
 * 也写出 `modifications.model_name`（谎报「用户改过」）。
 */
export function resolveModelEntity(
  kind: GenerationRequestKind,
  model: unknown,
  /** **用户配置里真实存在**的目录外模型引用（`general/<配置 id>`，来自 `config.generalModels`）。 */
  configuredModelRefs?: readonly string[],
): ModelEntity {
  const record = model as { status?: string; id?: unknown; displayName?: unknown } | null | undefined;
  if (!record || typeof record !== 'object') return (record ?? null) as ModelEntity;
  if (record.status === 'known') return model as ModelEntity;
  const wireName = typeof record.displayName === 'string' ? record.displayName : undefined;
  if (wireName && getParamEntry(wireName)?.kind === kind) return { status: 'known', id: wireName };
  /* 目录外：查用户配置（判据同上，见 `modelParamCatalog.ts:486-487`）。 */
  if (wireName && configuredModelRefs?.includes(wireName)) return { status: 'known', id: wireName };
  return model as ModelEntity;
}

/**
 * 官方 `KR`（图像最大参考图数判定）—— `Db().maxImages` 是目录里唯一的上限字段。
 *
 * ★ round 121：**目录外**模型（`general/<配置 id>` 自接连接）在官方目录里**没有上限数据**
 * ⇒ 按与 `modelIsFree` **同一处纪律**处理：「目录外 ⇒ 官方无对应判据 ⇒ **不阻断**」
 * （`services/ai/modelParamCatalog.ts:486-487`）。
 * ⚠️ 这条纪律有**多个落点**（本函数 + `xx` + `modelParamCatalog.modelIsFree`）——
 * 改一处必须同时看另一处，否则会半边放行、半边卡死。
 */
function KR(imageModelId: string, imageCount: number): number | null {
  const entry = getParamEntry(imageModelId);
  if (!entry) return imageCount;
  const max = entry.maxImages;
  return max === undefined || imageCount <= max ? imageCount : null;
}

/** 官方 `_p(model, TEXT_TO_VIDEO, 0, 0, 0)` 的目录等价：模型是否存在 `text_to_video` variant。 */
function supportsTextToVideo(videoModelId: string): boolean {
  const entry = getParamEntry(videoModelId);
  return (entry?.variants ?? []).some((variant) => variant.modelType === 'text_to_video');
}

/**
 * 官方 `xx` @2245152（`Ere` 契约与非空形状分支无证据 ⇒ 见文件头）。
 *
 * ★ round 121：**目录外**视频模型（`general/<配置 id>` 自接连接）查不到 `variants`
 * ⇒ 与 `KR` / `modelIsFree` 同一处纪律：「官方无对应判据 ⇒ 不阻断」
 * （`services/ai/modelParamCatalog.ts:486-487`）。
 * ⚠️ 这条**必须**一起加：round 121 把自接模型从 `unknown` 升成 `known` 之后，
 * `modelAvailable` 不再走 `modelUnknown` 那条短路，改走本函数 ⇒ 若这里仍返回 `false`，
 * 自接**视频**模型的「确认」会被卡死（升级前是放行的 ⇒ 那就是回归）。
 */
function xx(videoModelId: string, shape: ReferenceShapeCounts): boolean {
  if (wd(shape)) return true;
  if (!getParamEntry(videoModelId)) return true;
  if (VE(shape)) return supportsTextToVideo(videoModelId);
  return false;
}

/** 官方 `ctt` @2244931（音频；`Gp`/`uq` 分支在空形状下不可达）。 */
function ctt(_audioModelId: string, shape: ReferenceShapeCounts): boolean {
  if (wd(shape)) return true;
  if (shape.imageCount > 0 || shape.audioCount > 0 || shape.videoCount > 1) return false;
  if (shape.videoCount === 0) return true;
  return false;
}

/**
 * 官方 `YF` @2245444（逐字）。
 *
 * ★ round 121：本函数是「参考素材形状 × 模型能力」的判定口。**目录外**模型（自接连接）
 * 无目录数据 ⇒ 内部 `KR`（image）与 `xx`（video）都按同一处纪律放行
 * （`services/ai/modelParamCatalog.ts:486-487`：目录外 ⇒ 官方无判据 ⇒ 不阻断）。
 * 目录内模型的行为**完全不变**（那两处只在 `getParamEntry` 为空时才提前放行）。
 * `ctt`（audio）**不需要**这条：音频的 model id 恒来自官方 wire 目录
 * （`audioModelCatalog.AUDIO_WIRE_DIRECTORY`），不存在「自接音频连接」这条输入。
 */
export function modelSupportsShapes(
  kind: ParamCatalogKind,
  modelId: string,
  shapes: readonly ReferenceShapeCounts[],
): boolean {
  switch (kind) {
    case 'image':
      return shapes.every((shape) => wd(shape)
        || (shape.videoCount === 0 && shape.audioCount === 0
          && (shape.imageCount === 0 || KR(modelId, shape.imageCount) !== null)));
    case 'video':
      return shapes.every((shape) => (wd(shape) ? true : xx(modelId, shape)));
    case 'audio':
      return shapes.every((shape) => ctt(modelId, shape));
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ *
 * 官方 `uie` @2317385（音频）
 * ------------------------------------------------------------------ */

export interface AudioChipControllerInput {
  params: GenerationParams;
  originalParams?: GenerationParams;
  presentFields: readonly string[];
  protocolContext?: ProtocolContext;
  paramControlsEditable?: boolean;
  modelEditingLocked?: boolean;
  /** 官方 `Pnt` @2298490（逐字）。 */
  lyricsModeLabels?: { auto: string; custom: string; instrumental: string };
  /**
   * 官方 `uie` 的引用形状入参：`resolvedReferenceShapes = pF(...)`；
   * `Q = (l ?? [i]).map(ge => ({...ge.shape, videoDurations: ge.estimateVideoDurations}))`。
   * 省略 ⇒ 空数组（官方 `[]`），⇒ `ee=false`、`J=false`。
   */
  resolvedReferences?: ResolvedReferenceEntry;
  resolvedReferenceShapes?: readonly ResolvedReferenceEntry[];
  /** 官方 `forcePaidAccess`。 */
  forcePaidAccess?: boolean;
  /**
   * 官方 `hl().isPayingCustomer`。与 `hie` 同纪律：MTV 无订阅/付费态数据源 ⇒ 省略 / `null` = **未知**
   * ⇒ 不阻断（见文件头 round 129）；只有明确传 `false`（已知没付过费）才走官方非付费分支。
   * 它直接决定 model option 的 `disabled`（官方 `ze = !!Ue && !Og("audio", Ue, _)`）与
   * `confirmDisabled` 的 `pe`/`_e`（见 §73）。
   */
  isPayingCustomer?: boolean | null;
  /** 官方 `hl().loading`；MTV 无异步订阅查询 ⇒ 默认 `false`。 */
  loading?: boolean;
}

/** 官方 `Pnt` @2298490：歌词模式常量表（逐字 value + labelKey）。 */
const PNT = [
  { value: 'auto', labelKey: 'audio.auto', defaultLabel: 'Auto' },
  { value: 'custom', labelKey: 'audio.custom', defaultLabel: 'Custom' },
  { value: 'instrumental', labelKey: 'audio.forceInstrumental', defaultLabel: 'Instrumental' },
];

/**
 * 官方 `uie` @2317385（40 字段）。
 *
 * ## 官方逐字骨架（canvas @2317385..2324420，全量已复核）
 * ```js
 * const [p,m]=useState(e.model), [f,h]=useState(e.audioScene), [g,x]=useState(e.duration)
 * const {isPayingCustomer:y,loading:b}=hl(), _=y===!0, v=IN(p)
 * const X = p?.status==="unknown", K = f?.status==="unknown"
 * const Q = (l ?? [i]).map(ge=>({...ge.shape, videoDurations: ge.estimateVideoDurations}))
 * const ee = Q.some(ge=>ge.unknownCount>0), J = Q.some(ge=>ge.videoCount>0)
 * const fe = Zh(p), $ = lot(f)
 * const Y = useMemo(()=>GI.filter(({virtual:ge})=>Xb(ge,u)).map(({wireName:ge,virtual:Se})=>{
 *   const Oe = H1.find(re=>re.value===Se), $e = wg(Se), nt = $ && $e.includes($) ? $ : $e[0],
 *         Ue = nt ? wC(Se,nt) : void 0,
 *         ze = !!Ue && !Og("audio",Ue,_), Ee = J && (!Ue || !Gp(Ue));
 *   return {value:ge, label:Oe?.nameKey ? d(Oe.nameKey,{defaultValue:Oe.name??ge}) : ge,
 *           icon: Ue ? WI(Ue)?.icon : void 0, disabled: ze||Ee,
 *           disabledReason: ze ? d("video.modelRestricted",{defaultValue:"Subscription required"})
 *                           : Ee ? d("video.modelInputIncompatible",{defaultValue:"The connected video source is not supported"}) : void 0}}),
 *   [u,_,J,$,d])
 * const oe = useMemo(()=>[{value:Bo.MUSIC_GENERATION,…},{value:Bo.SOUND_EFFECT,…},{value:Bo.TEXT_TO_SPEECH,…}]
 *   .map(ge=>{ const Se=Zh(p), Oe=GI.find(Ue=>Ue.wireName===Se), $e=Oe?wg(Oe.virtual):void 0,
 *                    nt=!!$e && !$e.includes(ge.value);
 *              return {...ge, disabled:nt, disabledReason: nt ? d("chatAdapter.generationConfirmation.sceneUnsupportedByModel") : void 0}}),
 *   [_,Q,d])
 * const ne = r && !!H && !E, ae = !(ne && qS(v))
 * const de = useMemo(()=>{ const ge = ae ? j_(v).duration : void 0;
 *   if(ge?.kind==="number" && ge.presets?.length){ const Se=ge.presets.map(Oe=>({value:String(Oe),label:`${Oe}s`}));
 *     return ge.allowAuto ? [{value:"",label:d("audio.auto",{defaultValue:"Auto"})},...Se] : Se }
 *   return lO(q?.durations,g).map(Se=>({value:String(Se),label:`${Se}s`})) }, [ae,g,v,q?.durations,d])
 * const pe = !!v && Og("audio",v,_), me = ee || (!!v && YF("audio",v,Q)),
 *       he = K || !$ || (!!v && Mre(v)===$), _e = X || pe&&me&&he
 * // 返回：modelSelectedValue: (ye?fe:be?.value) ?? String(v??"")
 * //       scene: $, sceneDisplayName / sceneOptions: oe
 * //       showModelChip: n.has("model") && !!p
 * //       showSceneChip: n.has("audioScene") && !!f && oe.filter(ge=>!ge.disabled).length>1
 * //       showDurationChip: n.has("duration") && (g!=null || J) && ae
 * //       confirmDisabled: b || !_e
 * //       confirmDisabledReason: b ? common.loading
 * //         : _e ? void 0 : pe ? video.modelInputIncompatible("… does not support this scene or these references")
 * //                            : video.modelRestricted
 * ```
 *
 * ## 仍未落地（官方依赖**确实取不到**，继续隐藏，见文件头与 §73「取不到清单」）
 * | 能力 | 官方依赖 | 未落地原因 |
 * |---|---|---|
 * | `advancedParamChips` / `handleAdvancedParamChange` | `j_`（高级参数契约表）/ `Sh` / `_h` | 三者在 canvas 与 vendor-packages 里**均无声明、也无导入绑定** ⇒ 不可得 |
 * | `settledAudioParams` | 同上 + `oG`/`Int` 之外的运行期映射 | 同上 |
 * | `ControlsComponent` / `controlParams` / `handleControlParamChange` | `aq` / `YV` | `aq`(`Pue`) 的 `WK` 表涉及未提取的 UI 组件；`YV` 无声明 |
 * | model chip 的 `icon` | `WI(Ue)?.icon` → `H1[].icon` = 官方 `oe` 图标**组件**（`oe`@1017688） | 组件非字符串，MTV 目录无载具（与 `hie` 的 `jt?.icon` 同一缺口） |
 * | `buildChanges`/`buildModifications` 的 `voice` 与高级键 | `Nnt` / `Sh` / `Tnt` / `oG` / `Int` | `mge`(`M7`) 是 hook，`Sh`/`Tnt`/`Nnt` 不可得 ⇒ 只落 prompt/model/audioScene/duration/lyrics 五键 |
 */
export function useAudioChipController(input: AudioChipControllerInput): GenerationChipController {
  const t = useConfirmationText();
  const { params, presentFields, paramControlsEditable = false, modelEditingLocked = false } = input;
  const forcePaidAccess = input.forcePaidAccess ?? false;
  const loading = input.loading ?? false;
  /**
   * **round 129（与 `hie` 同纪律）**：官方 `Og("audio",Ue,_)` 的 `_` = 付费态。官方从 `hl()` 拿，
   * MTV 没有数据源 ⇒ 这里保留「未知」（`null`）供 `audioModelIsFree` 放行；
   * 只有宿主明确传 `false`（已知没付过费）才回到官方非付费分支。见 `hie` 的同名变量与文件头。
   */
  const payingCustomer: boolean | null = forcePaidAccess ? true : (input.isPayingCustomer ?? null);

  /* 官方 `const [p,m]=useState(e.model), [f,h]=useState(e.audioScene), [g,x]=useState(e.duration)` */
  const [editedModel, setEditedModel] = useState<ModelEntity>(() => resolveModelEntity('audio', params.model));
  const [editedScene, setEditedScene] = useState<ModelEntity>(() => resolveModelEntity('audio', params.audioScene));
  const [editedDuration, setEditedDuration] = useState<number | undefined>(
    typeof params.duration === 'number' ? params.duration : undefined,
  );
  const [lyrics, setEditedLyrics] = useState<string>(aa(params.lyrics));
  const [lyricsModeOverride, setLyricsModeOverride] = useState<string | undefined>(undefined);

  const modelId = IN(editedModel);
  const activeFields = useMemo(() => new Set(presentFields), [presentFields]);
  /* `X` = 模型未知；`K` = 场景未知。 */
  const modelUnknown = (editedModel as { status?: string } | null | undefined)?.status === 'unknown';
  const sceneUnknown = (editedScene as { status?: string } | null | undefined)?.status === 'unknown';

  /* `Q` / `ee` / `J`：官方把 `shape` 与 `estimateVideoDurations` 摊平成一项。 */
  const { resolvedReferences, resolvedReferenceShapes } = input;
  const referenceVideoCount = params.referenceVideoSources?.length ?? 0;
  const shapes = useMemo<readonly ReferenceShapeCounts[]>(
    () => {
      const source = resolvedReferenceShapes ?? (resolvedReferences ? [resolvedReferences] : []);
      if (source.length > 0) return source.map((entry) => entry.shape);
      return [{
        imageCount: 0,
        videoCount: referenceVideoCount,
        audioCount: 0,
        unknownCount: 0,
        totalCount: referenceVideoCount,
      }];
    },
    [referenceVideoCount, resolvedReferenceShapes, resolvedReferences],
  );
  const referencesPending = useMemo(
    () => shapes.some((shape) => (shape.unknownCount ?? 0) > 0),
    [shapes],
  );
  const isVideoAdaptive = useMemo(
    () => shapes.some((shape) => (shape.videoCount ?? 0) > 0),
    [shapes],
  );

  /* `fe = Zh(p)`：模型 wire 名。 */
  const wireName = useMemo(() => audioWireOfModelEntity(editedModel as never), [editedModel]);
  /* `pe = !!v && Og("audio",v,_)`。 */
  const modelFree = !!wireName && audioModelIsFree(wireName, payingCustomer);
  /* `$ = lot(f)`：场景字符串（官方 `lot` 未提取 ⇒ 只取已知场景的 id）。 */
  const scene = sceneUnknown
    ? undefined
    : (editedScene as { scene?: unknown; id?: unknown } | null | undefined)?.scene as string | undefined
      ?? (typeof (editedScene as { id?: unknown } | null | undefined)?.id === 'string'
        ? (editedScene as { id: string }).id
        : undefined);

  /* `Y = GI.filter(({virtual}) => Xb(virtual, u)).map(...)`. */
  const modelOptions = useMemo<ParamChipOption[]>(() => AUDIO_WIRE_DIRECTORY
    .filter(({ virtual }) => passesSubscriptionGate(virtual, payingCustomer))
    .map(({ wireName: wire, virtual }) => {
      const virtualEntry = AUDIO_VIRTUAL_MODELS.find((item) => item.value === virtual);
      const supportedScenes = audioScenesOfVirtual(virtual);
      const chosenScene = scene && supportedScenes.includes(scene) ? scene : supportedScenes[0];
      const optionModelId = chosenScene ? audioModelForScene(virtual, chosenScene) : undefined;
      /* 官方 `ze = !!Ue && !Og("audio",Ue,_)` —— `Ue` 是**模型 id**，`Og("audio",…)` 内部
         再走 `G1` 映射到虚拟模型查 `isFree`（`audioModelIsFree` 逐字落点）。 */
      const restrictedDisabled = !!optionModelId && !audioModelIsFree(wire, payingCustomer);
      const videoDisabled = isVideoAdaptive
        && (!optionModelId || !audioModelSupportsVideoInput(optionModelId));
      const disabled = restrictedDisabled || videoDisabled;
      return {
        value: wire,
        /* 官方 `label: Oe?.nameKey ? d(Oe.nameKey,{defaultValue:Oe.name??ge}) : ge`。 */
        label: virtualEntry?.nameKey
          ? tx(t, virtualEntry.nameKey, virtualEntry.name ?? wire)
          : wire,
        /* 官方 `icon: Ue ? WI(Ue)?.icon : void 0`：`H1[].icon` 是 `oe` 组件 ⇒ 见文件头，不补。 */
        icon: undefined,
        disabled,
        disabledReason: restrictedDisabled
          ? tx(t, 'video.modelRestricted', 'Subscription required')
          : videoDisabled
            ? tx(t, 'video.modelInputIncompatible', 'The connected video source is not supported')
            : undefined,
      } satisfies ParamChipOption;
    }), [isVideoAdaptive, payingCustomer, scene, t]);

  const firstEnabledModel = modelOptions.find((option) => !option.disabled) ?? modelOptions[0];

  /* `oe = [...].map(...)`：场景三选项 + 逐项 `disabled`。 */
  const sceneOptions = useMemo<ParamChipOption[]>(() => [
    { value: AUDIO_SCENE.MUSIC_GENERATION, label: tx(t, 'audio.scene.musicGeneration.label', 'Music') },
    { value: AUDIO_SCENE.SOUND_EFFECT, label: tx(t, 'audio.scene.soundEffect.label', 'Sound effect') },
    { value: AUDIO_SCENE.TEXT_TO_SPEECH, label: tx(t, 'audio.scene.textToSpeech.label', 'Text to speech') },
  ].map((option) => {
    const currentWire = wireName;
    const directoryEntry = AUDIO_WIRE_DIRECTORY.find((item) => item.wireName === currentWire);
    const supported = directoryEntry ? audioScenesOfVirtual(directoryEntry.virtual) : undefined;
    const disabled = !!supported && !supported.includes(option.value);
    return {
      ...option,
      disabled,
      disabledReason: disabled
        ? t('chatAdapter.generationConfirmation.sceneUnsupportedByModel')
        : undefined,
    };
  }), [t, wireName]);

  /* `E = !!v && mq(v)`（官方 `mq` = 目录 `supportCustomLyrics`）。 */
  const supportsLyrics = !!modelId && getParamEntry(modelId)?.supportCustomLyrics === true;
  const instrumental = params.instrumental === true;
  const hasLyrics = !!aa(params.lyrics);
  const lyricsMode = lyricsModeOverride ?? (instrumental ? 'instrumental' : hasLyrics ? 'custom' : 'auto');
  const lyricsModeOptions = useMemo<ParamChipOption[]>(() => PNT.map((item) => ({
    value: item.value,
    label: input.lyricsModeLabels?.[item.value as 'auto' | 'custom' | 'instrumental']
      ?? tx(t, item.labelKey, item.defaultLabel),
  })), [input.lyricsModeLabels, t]);

  /* `H = v ? aq(v) : null`（模型自带控件组件）：`aq` 依赖未提取的 UI 组件 ⇒ 恒 `null`，
     故 `ne = r && !!H && !E` 恒 `false`，`ae = !(ne && qS(v))` 恒 `true`（`durationEditable`）。 */
  const durationEditable = true;

  /* `q = v ? WI(v) : null`；`q.durations = v==="sonilo-music"?[30,60,120]:v==="sonilo-sfx"?[5,10,30]:void 0`。
     `de`：`j_(v).duration` 的高级分支不可得 ⇒ 只走 `lO(q?.durations, g)` 这条。 */
  const modelDurations = useMemo(() => audioModelDurations(modelId), [modelId]);
  const durationOptions = useMemo<ParamChipOption[]>(
    () => lO(modelDurations, editedDuration).map((value) => ({ value: String(value), label: `${value}s` })),
    [editedDuration, modelDurations],
  );

  const effectiveDuration = editedDuration;

  /* `me = ee || (!!v && YF("audio",v,Q))`。 */
  const shapesSupported = !!modelId && modelSupportsShapes('audio', modelId, shapes);
  const referencesOk = referencesPending || shapesSupported;
  /* `he = K || !$ || (!!v && Mre(v)===$)`。 */
  const sceneOk = sceneUnknown || !scene || (!!modelId && audioSceneOfModel(modelId) === scene);
  /* `_e = X || pe&&me&&he`。 */
  const confirmAvailable = modelUnknown || (modelFree && referencesOk && sceneOk);
  const confirmDisabled = loading || !confirmAvailable;
  const confirmDisabledReason = loading
    ? tx(t, 'common.loading', 'Checking subscription')
    : confirmAvailable
      ? undefined
      : modelFree
        ? tx(
          t,
          'video.modelInputIncompatible',
          'The selected audio model does not support this scene or these references',
        )
        : tx(t, 'video.modelRestricted', 'Subscription required');

  /* ── 官方 `De` / `je`：模型切换 ── */
  const applyModelChange = useCallback((nextModelId: string, nextScene: string | undefined) => {
    setEditedModel({ status: 'known', id: nextModelId });
    if (nextScene) {
      setEditedScene({ status: 'known', scene: nextScene });
    }
    /* `Oe?.defaultDuration != null && x(Oe.defaultDuration)`：`WI()` 的 `defaultDuration`
       取自 `Af` 条目的 `defaultParams.duration/_seconds/music_length_ms`；MTV 目录只有
       `defaultParams` 原值 ⇒ 这里逐字按同一三个来源取（不做别的推断）。 */
    const entry = getParamEntry(nextModelId);
    const defaults = entry?.defaultParams ?? {};
    const defaultDuration = typeof defaults.duration === 'number'
      ? defaults.duration
      : typeof defaults.duration_seconds === 'number'
        ? defaults.duration_seconds
        : typeof defaults.music_length_ms === 'number'
          ? (defaults.music_length_ms as number) / 1000
          : undefined;
    if (defaultDuration != null) setEditedDuration(defaultDuration);
  }, []);

  /* `je(ge) = (Se) => { const Oe = GI.find(Ue=>Ue.wireName===ge); if(!Oe){ De(ge, void 0); return }
       const $e = wg(Oe.virtual), $e2 = $ && $e.includes($) ? $ : $e[0],
             nt = $e2 ? wC(Oe.virtual, $e2) : void 0;
       nt && De(nt, $e2) }` */
  const handleModelChange = useCallback((value: string) => {
    const directoryEntry = AUDIO_WIRE_DIRECTORY.find((item) => item.wireName === value);
    if (!directoryEntry) {
      applyModelChange(value, undefined);
      return;
    }
    const supportedScenes = audioScenesOfVirtual(directoryEntry.virtual);
    const nextScene = scene && supportedScenes.includes(scene) ? scene : supportedScenes[0];
    const nextModelId = nextScene ? audioModelForScene(directoryEntry.virtual, nextScene) : undefined;
    if (nextModelId) applyModelChange(nextModelId, nextScene);
  }, [applyModelChange, scene]);

  /* `We(ge) = (Se) => { const Oe = Zh(p), $e = kre({status:"known",scene:Se}),
                          nt = Oe && $e ? Fet(Oe,$e) : void 0;
                          nt && (nt !== v ? De(nt,Se) : h({status:"known",scene:Se})) }`
     ⚠️ 这里用的是 **`Fet(wireName, mode)`**（`zE[wire].byMode[mode] ?? default`，`mode` 是 `Ket` 出的
     `speech`/`music`/`sound`），**不是** `wC(virtual, scene)`（后者是 model chip 那条路）。 */
  const handleSceneChange = useCallback((value: string) => {
    const mode = AUDIO_SCENE_MODE[value];
    const nextModelId = wireName && mode ? audioModelForWireAndMode(wireName, mode) : undefined;
    if (!nextModelId) return;
    if (nextModelId !== modelId) {
      applyModelChange(nextModelId, value);
    } else {
      setEditedScene({ status: 'known', scene: value });
    }
  }, [applyModelChange, modelId, wireName]);

  /* ── 官方 `we`（`buildChanges`）── 只落可行的五键：prompt / model / audioScene / duration / lyrics。
        `voice` 与 `oG`/`Int` 的高级键因 `Sh`/`Tnt`/`Nnt` 不可得而**不产出**（见文件头表）。 ── */
  const buildChanges = useCallback(
    (prompt: string, source?: GenerationParams): Record<string, unknown> | undefined => {
      const original = source ?? input.originalParams ?? params;
      const out: Record<string, unknown> = {};
      if (prompt !== aa(original.prompt)) out.prompt = prompt;
      /* 官方 `n.has("model") && Zh(p)!==Zh(Se.model) && (Oe.model = p)`。 */
      if (activeFields.has('model')) {
        const originalModel = resolveModelEntity('audio', original.model);
        if (audioWireOfModelEntity(editedModel as never) !== audioWireOfModelEntity(originalModel as never)) {
          out.model = editedModel;
        }
      }
      /* 官方 `n.has("audioScene") && !cot(f, Se.audioScene) && (Oe.audioScene = f)`。 */
      if (activeFields.has('audioScene') && !qnt(editedScene, resolveModelEntity('audio', original.audioScene))) {
        out.audioScene = editedScene;
      }
      /* 官方 `nt !== Se.duration && (Oe.duration = nt)`（`nt = qS(v) ? Sh(...).duration : g`；
         这里 `qS`/`Sh` 不可得 ⇒ `nt = g`，与官方非控件分支一致）。 */
      if (effectiveDuration !== original.duration) out.duration = effectiveDuration;
      /* 官方 `if(E){ … const Me = R==="custom" ? M : ""; Me!=="" && Me!==(ze.lyrics??"") && (Oe.lyrics=Me) }`。 */
      if (supportsLyrics) {
        const nextLyrics = lyricsMode === 'custom' ? lyrics : '';
        if (nextLyrics !== '' && nextLyrics !== (original.lyrics ?? '')) out.lyrics = nextLyrics;
      }
      return Object.keys(out).length > 0 ? out : undefined;
    },
    [activeFields, editedModel, editedScene, effectiveDuration, input.originalParams, lyrics, lyricsMode, params, supportsLyrics],
  );

  /* ── 官方 `Le`：`Mv("audio", die(we(ge), Se), o, Oe)`，`Oe = new Set(ue) ∪ (E&&R!=="custom"&&j ? "lyrics" : ∅)`。 ── */
  const buildModifications = useCallback((prompt: string, addedNodeIds: readonly string[]) => {
    const cleared = new Set<string>();
    if (supportsLyrics && lyricsMode !== 'custom' && aa(params.lyrics)) cleared.add('lyrics');
    return buildWireModifications(
      'audio',
      die(buildChanges(prompt), addedNodeIds),
      input.protocolContext ?? {},
      cleared,
    );
  }, [buildChanges, input.protocolContext, lyricsMode, params.lyrics, supportsLyrics]);

  /* `ye = !r || Xb(v,u)`；`Xb(ge,u)` 在 u 为假时退化为 `!E2(ge)`，而 `E2` 查的是
     **视频**订阅受限表（`jz`，见 `modelParamCatalog.ts`）⇒ 对音频 wire 名恒 `false`
     ⇒ 官方 `ye` 在音频上恒等于 `!r`（=MTV `!modelEditingLocked`）。 */
  /* 官方 `ye = !r || Xb(v,u)`（`r` = `paramControlsEditable`，`v` = 当前模型 id，
     `u = Nx()` = 载荷里的订阅提示数组）。
     `Xb` = `Dz(e,t) = t || !E2(e)`，`E2(e) = !!(e && jz.has(e))`（vendor @976155/976231 逐字）。
     ⚠️ 两个关键事实（真机 CDP 实测，§73）：
       1. `u` 是数组，**空数组 truthy** ⇒ 官方只按 `!E2(v)` 过滤（与 `Y` 的 filter 同源）；
       2. `Y` 的 filter 用的是 `virtual`（`GI` 的虚拟名，如 `sonilo-music`），故 `Xb` 也必须用
          当前模型的**虚拟名**才能与 `Y` 一致（用 wire 名 `sonilo` 会得 `false`，与官方结果不符）。 */
  const modelVirtual = wireName
    ? AUDIO_WIRE_DIRECTORY.find((entry) => entry.wireName === wireName)?.virtual
    : undefined;
  const modelValueBlocked = !!modelVirtual && !passesSubscriptionGate(modelVirtual, payingCustomer);
  const modelChipValueEditable = !paramControlsEditable || modelValueBlocked;
  /* 官方 `q = v ? WI(v) : null`，`q.nameKey` 取自 `H1` 里该虚拟模型的 `nameKey`。 */
  const virtualEntry = wireName
    ? AUDIO_VIRTUAL_MODELS.find((item) => item.value === AUDIO_WIRE_DIRECTORY.find((entry) => entry.wireName === wireName)?.virtual)
    : undefined;
  /* 官方逐字（两个分支**不可**对调）：
     `modelSelectedValue: (ye ? fe : be?.value) ?? String(v??"")`
     `modelDisplayName: … : (ye ? Y.find(ge=>ge.value===fe)?.label : be?.label) ?? (q ? d(q.nameKey,…) : String(v??""))`
     `ye` 为真 ⇒ 用**当前模型** `fe`；`ye` 为假 ⇒ 用**第一个启用项** `be`。 */
  const editedModelId = String((modelChipValueEditable ? wireName : firstEnabledModel?.value) ?? '');
  const modelDisplayName = editedModel?.status === 'unknown'
    ? String((editedModel as { displayName?: string }).displayName ?? '')
    : (modelChipValueEditable
      ? modelOptions.find((option) => option.value === wireName)?.label
      : firstEnabledModel?.label)
      ?? (virtualEntry?.nameKey
        ? tx(t, virtualEntry.nameKey, String(wireName ?? ''))
        : String(wireName ?? ''));

  return {
    ...createEmptyChipController(),
    modelId,
    modelInfo: undefined,
    modelOptions,
    modelDisplayName,
    modelSelectedValue: editedModelId,
    handleModelChange,
    showModelChip: activeFields.has('model') && !!editedModel,
    modelChipEditable: paramControlsEditable && !modelEditingLocked
      && !modelUnknown && !sceneUnknown && !referencesPending,

    scene,
    sceneDisplayName: sceneUnknown
      ? String((editedScene as { displayName?: string }).displayName ?? '')
      : sceneOptions.find((option) => option.value === scene)?.label ?? String(scene ?? ''),
    sceneOptions,
    handleSceneChange,
    showSceneChip: activeFields.has('audioScene') && !!editedScene
      && sceneOptions.filter((option) => !option.disabled).length > 1,
    sceneChipEditable: paramControlsEditable && !modelEditingLocked
      && !modelUnknown && !sceneUnknown && !referencesPending,

    showDurationChip: activeFields.has('duration') && (editedDuration != null || isVideoAdaptive) && durationEditable,
    durationOptions,
    setEditedDuration,
    effectiveDuration,
    durationDisplayName: isVideoAdaptive
      ? tx(t, 'audio.durationAuto', 'Auto')
      : String(effectiveDuration ?? ''),
    durationChipEditable: paramControlsEditable && !modelUnknown && !sceneUnknown
      && !referencesPending && !isVideoAdaptive && durationOptions.length > 1,

    supportsLyrics,
    lyricsMode,
    lyricsModeOptions,
    lyricsModeDisplayName: lyricsModeOptions.find((option) => option.value === lyricsMode)?.label ?? lyricsMode,
    handleLyricsModeChange: setLyricsModeOverride,
    lyrics,
    setEditedLyrics,

    confirmDisabled,
    confirmDisabledReason,

    advancedParamChips: [],
    handleAdvancedParamChange: undefined,
    settledAudioParams: [],
    controlsWillRender: false,
    ControlsComponent: undefined,
    controlParams: {},
    handleControlParamChange: undefined,

    buildChanges,
    buildModifications,
    clearedFields: [],

    activeFields,
    isImage: false,
    editedModelId,
    editedAspectRatio: '',
    editedResolution: '',
    editedDuration,
    estimateTimes: 1,
    elementReferences: { count: { image: 0, video: 0, audio: 0 }, unresolved: false },
    clearedEstimateParams: [],
    autoLabel: tx(t, 'videoConfigs.auto', 'Auto'),
    autoUnsupportedTooltip: tx(
      t,
      'videoConfigs.autoUnsupportedTooltip',
      'Adjustments are not supported in the current mode',
    ),
    imageSizeCollapsed: false,
    isVideoAdaptive,
  };
}

/* ------------------------------------------------------------------ *
 * 卡片注入点：官方 `uot` 的分发（@2326934）
 * ------------------------------------------------------------------ */

export interface GenerationChipControllerOptions {
  /** 卡片是否可编辑（官方 `paramControlsEditable`）。 */
  editable?: boolean;
  /** 引用形状（官方 `pF` 的产物；MTV 卡片暂无 ⇒ 省略即空形状）。 */
  resolvedReferences?: ResolvedReferenceEntry;
  /**
   * 官方 `hl().isPayingCustomer`；省略 / `null` ⇒ **未知付费态**（MTV 现状）⇒ 不阻断（见文件头 round 129）。
   */
  isPayingCustomer?: boolean | null;
  /** 官方 `hl().loading`；省略 ⇒ `false`。 */
  loading?: boolean;
  /** 宿主显式注入的候选 id（省略 ⇒ 候选只来自用户已配置连接声明的模型，见 `ImageVideoChipControllerInput`）。 */
  directoryModelIds?: readonly string[];
  /** MTV 模型显示名（modelId → displayName）。 */
  modelLabels?: Readonly<Record<string, string>>;
  /** 卡片载荷的 `request_json.model_name`（`params.model` 缺失时的兜底模型来源）。 */
  modelName?: string;
  /** 见 `ImageVideoChipControllerInput.modelSelectionRequired`（round 116，MTV 专有）。 */
  modelSelectionRequired?: boolean;
}

/**
 * 官方 `uot`（@2326934）的分发：
 * ```js
 * if (r) return r.requestKind === "audio" ? s.jsx(fot, {...}) : s.jsx(xot, {...});
 * ```
 * **批量卡用第一条** —— 官方 `xot` 逐字：`C = d[0]; I = hie({params: C.params, …})`（@2355113），
 * `fot` 逐字：`v = i[0]; w = uie({params: v.params, …})`（@2347433）。
 *
 * 两个 hook **无条件都调用**（遵守 hooks 规则），再按 `requestKind` 选其一。
 */
export function useGenerationChipController(
  viewModel: GenerationConfirmationSingleViewModel | GenerationConfirmationBatchViewModel | null | undefined,
  options: GenerationChipControllerOptions = {},
): GenerationChipController {
  const item = viewModel && 'items' in viewModel ? viewModel.items[0] : viewModel ?? undefined;
  const kind = viewModel?.requestKind;
  const editable = options.editable ?? false;
  const imageVideo = useImageVideoChipController({
    requestKind: kind === 'video' ? 'video' : 'image',
    params: item?.params ?? {},
    originalParams: item?.originalParams,
    presentFields: item?.presentFields ?? [],
    protocolContext: item?.protocolContext,
    paramControlsEditable: editable,
    prompt: typeof item?.params.prompt === 'string' ? item.params.prompt : undefined,
    resolvedReferences: options.resolvedReferences,
    isPayingCustomer: options.isPayingCustomer,
    loading: options.loading,
    directoryModelIds: options.directoryModelIds,
    modelLabels: options.modelLabels,
    modelName: options.modelName,
    modelSelectionRequired: options.modelSelectionRequired,
  });
  const audio = useAudioChipController({
    params: item?.params ?? {},
    originalParams: item?.originalParams,
    presentFields: item?.presentFields ?? [],
    protocolContext: item?.protocolContext,
    paramControlsEditable: editable,
    resolvedReferences: options.resolvedReferences,
    isPayingCustomer: options.isPayingCustomer,
    loading: options.loading,
  });
  if (!viewModel || !item) return createEmptyChipController();
  return kind === 'audio' ? audio : imageVideo;
}
