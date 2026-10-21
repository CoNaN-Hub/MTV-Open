/**
 * PromptPanel 提示词面板 — AI 生成节点的核心输入面板，集成模型选择器、提示词编辑器、质量/比例/视频参数、生成按钮、/ 指令菜单
 */
import Select from '../../shared/Select';
import { lazy, Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
// 生成中的思考球：仅在生成时按需加载
const ThinkingOrb = lazy(() => import('thinking-orbs').then((m) => ({ default: m.ThinkingOrb })));
import type {
  AnimationAction,
  CameraGenerationSettings,
  ImagePostProcess,
  ModelOption,
  NodeType,
  WorkflowDefinition,
} from '../../../types';
import { ANIMATION_ACTION_LABELS } from '../../../types';
import type { PresetOverride } from './SlashCommandMenu';
import { useAppStore } from '../../../store/useAppStore';
import { toggleReferencePick, useNodeSelectionStore } from '../../../store/store.nodeSelection';
import ModelSelector from './ModelSelector';
import RunningHubParameterFields, { RunningHubModelParameterFields } from './RunningHubParameterFields';
import { getRunningHubModel } from '../../../services/ai/providers/runninghubModelManifest';
import QualityRatioSelector from './QualityRatioSelector';
import { channelParamLimitsFor } from '../../../services/models/channelParamLimits';
import CreditEstimateBadge from './CreditEstimateBadge';
/* ★ P1 分组门：「确认前」劝告（**MTV 增强**，官方侧 NOT FOUND —— 见该文件头）。 */
import ModelEntitlementNotice from './ModelEntitlementNotice';
import { defaultQualityForModel } from '../../../utils/imageModelCapabilities';
/* ★ 摄影机控制的**官方逐模型白名单**（只有 7 个模型显示该按钮 —— 官方 @3211385 挂载条件）*/
import { cameraControlAllowedFor } from '../../../data/cameraControl';
import { OfficialIcon } from '../../sidebar/OfficialIcon';
/* ★ 摄影机控制 = 官方「Lens Combo」（`Ant`/`Snt`/`k0`）逐字复刻 ✓ 取代 MTV 旧的自造 4 下拉 ✓ */
import CameraControl from './CameraControl';
import VideoParamSelector from './VideoParamSelector';
/* §69：官方「生成方式」= 节点 `data.params.modelType` 经 `dd` 折出的 method key
   （`frames | reference | edit`，逐步见 `services/ai/modelParamCatalog.ts`）。 */
import type { VideoMethodKey } from '../../../services/ai/modelParamCatalog';
import AudioParamSelector from './AudioParamSelector';
import CharacterVoiceSelector, { type CharacterVoiceChoice } from './CharacterVoiceSelector';
import { collectAudioSpeechReferences, resolveAudioSpeechWorkflow } from '../../../services/ai/audioSpeechSettings';
import { resolveDramaVoiceRef } from '../../../services/dramaAssetPrompt';
import { buildDramaVoiceMentionId } from '../../../types/dramaAssets';
import StyleSelector from './StyleSelector';
import MentionEditor, { type MentionEditorHandle } from './MentionEditor';
import OfficialSlashCommandMenu, { type OfficialSlashCommandMenuHandle } from './image/OfficialSlashCommandMenu';
import { expandSkillReferences } from '../../../services/skillPromptService';
/* 图片卡的可选数量表见下方 `IMAGE_BATCH_COUNTS`（官方 `xXe=[1,2,4,8,12]`，上限由
   `types/aiTypes.ts` 的 `MAX_IMAGE_BATCH_COUNT = 12` 夹取；此处不再直接引用该常量）。 */
import type { AudioOutputFormat, AudioSpeechSettings, AudioSpeechReference, AudioTtsVoice, VideoReferenceItem } from '../../../types/aiTypes';
import type { AudioGenerationPurpose } from '../../../types/media';
import { useT } from '../../../i18n';
import WorkflowApiParameterFields from './WorkflowApiParameterFields';
import { DREAMINA_IMAGE_RATIOS, getDreaminaImageModel } from '../../../services/ai/dreaminaModels';
import UpstreamReferenceChips from './UpstreamReferenceChips';
import { collectUpstreamReferences } from '../../../utils/referenceTokens';
import { getCanvasViewportController } from '../../../services/canvasViewportService';
import { TEXT_TIMES_OPTIONS } from '../../../utils/textVariants';
import { orderedFrameRefs, swapFrameOrder } from '../../../utils/videoFrames';

const IMAGE_RATIO_CLASS_NAMES: Record<string, string> = {
  '1:1': 'img-rp-sq',
  '9:16': 'img-rp-tall',
  '16:9': 'img-rp-wide',
  '3:4': 'img-rp-p34',
  '4:3': 'img-rp-l43',
  '3:2': 'img-rp-l32',
  '2:3': 'img-rp-p23',
  '21:9': 'img-rp-ultra',
};

const ANIMATION_ACTIONS: AnimationAction[] = ['idle', 'walk', 'run', 'jump', 'attack', 'hit'];
/* ★★ 生成数量选项 —— **官方 `TimesSelector` 的 `timesOptions`**（不是自编的 2..N 递增表）。
   官方 `course-api-base-url-CGXqZmAy.js` @2814847-2814884：
     `yXe=[1,2,4]`（VARIANTS 模式 / 非 midjourney）· `vXe=[1]`（VARIANTS / midjourney）
     `xXe=[1,2,4,8,12]`（普通生成 / 非 midjourney）· `wXe=[1,2,3]`（普通生成 / midjourney）
     `CXe(mode,isMidjourney)` 按这两维选表；调用点 `pr=SJ({mode,isMidjourney,currentTimes})` ⇒ `qr=[...pr.options]`。
   图片卡在官方走 `xXe`（普通生成）⇒ **[1,2,4,8,12]**。
   ⚠️ MTV 原来写的是 `Array.from({length: MAX-1}, (_,i)=>i+2)` = `[2,3,…,8]`
      ⇒ 起点错（官方有 1）、步进错（官方是 1/2/4/8/12 而非逐个 +1）、顺序错（官方渲染前 `.reverse()`）。
   文本卡保持官方同款数组（`TEXT_TIMES_OPTIONS = [1,2,3,4]`，即官方 `yXe`-系）。
   两张表都**保持升序**，由下面的渲染 `[...].reverse()` 做**倒序显示**（与官方 `[...timesOptions].reverse()` 一致）。 */
const IMAGE_BATCH_COUNTS: readonly number[] = [1, 2, 4, 8, 12];
const TEXT_BATCH_COUNTS: readonly number[] = [...TEXT_TIMES_OPTIONS];
const BATCH_LONG_PRESS_MS = 450;

/* ★ MTV 原来在这里有 CAMERA_LENS_OPTIONS / CAMERA_SHUTTER_OPTIONS / CAMERA_APERTURE_OPTIONS /
   CAMERA_EXPOSURE_OPTIONS 四张表 + 自造的 CameraSettingsPreview（手绘 SVG 预览）与
   CameraSettingsSelector（4 个原生 select 的弹层）—— 那**不是官方的摄影机控制** ✗
   官方在同一位置是「Lens Combo」：机身/镜头/焦段/光圈 四个**滚轮选择器**，器材逐项配图。
   现已整块替换为 ./CameraControl（逐字复刻 Ant/Snt/k0），旧表一并删除 ✓ */

function AnimationPoseIcon({ action }: { action: AnimationAction }) {
  const commonProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (action) {
    case 'walk':
      return <svg {...commonProps}><circle cx="13" cy="4" r="2" /><path d="m12.5 7-1 7m.5-5-4.5 3.5m4-3 4.5 2.5m-4.5 2L7 20m4.5-6 5 5" /></svg>;
    case 'run':
      return <svg {...commonProps}><circle cx="14.5" cy="4" r="2" /><path d="m13.5 7-3 6m2-4-4.5-2m4 3 5 2m-6.5 1-5 3m5-3 5.5 6" /></svg>;
    case 'jump':
      return <svg {...commonProps}><circle cx="12" cy="4" r="2" /><path d="M12 7v7m0-5L7 5m5 4 5-4m-5 9-4.5 4m4.5-4 4.5 4" /></svg>;
    case 'attack':
      return <svg {...commonProps}><circle cx="9" cy="4.5" r="2" /><path d="m9.5 7 2 7m-1.5-5 7.5 1m-7-1.5L6 12m5.5 2-4.5 6m4.5-6 5 4" /><path d="m17.5 7.5 2.5 2.5-2.5 2.5" /></svg>;
    case 'hit':
      return <svg {...commonProps}><circle cx="14.5" cy="4.5" r="2" /><path d="m13 7-2 7m1-5-5-1m5 2 5 3m-6 1-4 5m4-5 5 5" /><path d="m19 5 2-2m-1 5 3-1" /></svg>;
    default:
      return <svg {...commonProps}><circle cx="12" cy="4" r="2" /><path d="M12 7v7m0-5-4.5 2m4.5-2 4.5 2M12 14l-3.5 6m3.5-6 3.5 6" /></svg>;
  }
}

interface PromptPanelProps {
  nodeType: NodeType;
  nodeId?: string;
  /* ⚠️ 这里原来有 `isExpanded` / `onToggleExpand` 两个 prop，用来驱动右上角那枚「放大/还原」钮。
     官方其实是**两个互不相干的 context**：
       · `Hq` = { isExpanded, toggle, hasAdvancedSettings }  → 高级设置面板（MTV 用内部 `advancedOpen`）
       · `Uq` = { isCollapsed, toggle, isOverflowing, setIsOverflowing } → 提示词折叠（现用内部 `promptCollapsed`）
     混用会导致「放大」和「高级设置」联动 ⇒ 两个 prop 已删除（AINodeDialog 侧同步移除）。 */
  prompt?: string;
  placeholder?: string;
  /* ★ 声明漂移补齐：`selectedModel` 在组件体内**大量使用**（L521/L548/L794/L1061/L1153/L1194…）
     且调用方（`AINodeDialog.tsx:1547`）一直在传 `selectedModel={data.model}` ⇒
     原来只是**接口里漏了声明**（`tsc -p tsconfig.app.json` 才会暴露；根 tsconfig 是 `files:[]`，跑 `tsc --noEmit` 查不出来）*/
  selectedModel?: string;
  selectedProvider?: string;
  selectedWorkflowId?: string;
  runninghubModelParameters?: Record<string, string>;
  onRunninghubModelParametersChange?: (values: Record<string, string>) => void;
  workflowInputs?: Record<string, string>;
  onWorkflowInputsChange?: (values: Record<string, string>) => void;
  animationAction?: AnimationAction;
  onAnimationActionChange?: (action: AnimationAction) => void;
  animationFrames?: number;
  onAnimationFramesChange?: (value: number) => void;
  canGenerate?: boolean;
  isGenerating?: boolean;
  onCancelGeneration?: () => void;
  onChange: (value: string) => void;
  onContinuousEditEnd?: () => void;
  onSubmit: (overridePrompt?: string, postProcess?: ImagePostProcess) => void;
  onModelSelect: (model: ModelOption) => void;
  onWorkflowSelect?: (workflowId: string | undefined) => void;
  onDebug?: () => void;
  onPassThrough?: () => void;
  imageSize?: string;
  aspectRatio?: string;
  onChangeImageSize?: (size: string) => void;
  onChangeAspectRatio?: (ratio: string) => void;
  /* ★★★ **「精细度」** ✓✓（官方弹窗第三组 ✓ EXE `qualityOptions: ["low","medium","high"]` ✓
     · i18n `quality:"精细度"` / `{low:"低", medium:"中", high:"高"}` ✓）
     ⚠️ 不传时：组件用默认 `low` ✓（UI 与官方 1:1 ✓ 状态由调用方接 ✓）*/
  quality?: string;
  onChangeQuality?: (q: string) => void;
  qualityOptions?: readonly string[];
  /** 是否显示「精细度」组（官方只有部分模型有 `qualityOptions` ✓）*/
  showQuality?: boolean;
  /* ★★★ **官方第 4 组「透明背景」** ✓✓（值 → `background:"transparent"` + `output_format:"png"` ✓）
     只有官方白名单那 2 个 2.5 模型会显示 ✓（由模型能力表决定 ✓ 见 QualityRatioSelector ✓）*/
  transparentBackground?: boolean;
  onChangeTransparentBackground?: (on: boolean) => void;
  batchCount?: number;
  onChangeBatchCount?: (count: number) => void;
  cameraSettings?: CameraGenerationSettings;
  onChangeCameraSettings?: (settings: CameraGenerationSettings | undefined) => void;
  videoResolution?: number;
  videoFps?: number;
  videoFrames?: number;
  onChangeVideoResolution?: (value: number) => void;
  onChangeVideoFps?: (value: number | undefined) => void;
  // ── Seedance 参数 ──
  seedanceResolution?: string;
  seedanceRatio?: string;
  seedanceDuration?: number;
  generateAudio?: boolean;
  videoReferences?: VideoReferenceItem[];
  onChangeVideoReferences?: (value: VideoReferenceItem[]) => void;
  onChangeSeedanceResolution?: (value: string | undefined) => void;
  onChangeSeedanceRatio?: (value: string | undefined) => void;
  onChangeSeedanceDuration?: (value: number | undefined) => void;
  onChangeGenerateAudio?: (value: boolean | undefined) => void;
  /* ★ §69 官方「生成方式」（`Roe` 的同名三件套）——
     值 = `dd(data.params.modelType)`；选项 = `EJ(model)`；回调写 `params.modelType`/`params.variant`。 */
  generateMethod?: VideoMethodKey;
  /**
   * §129 官方 `ha`（输入栏 headerSlot）首尾帧行里两个帧槽的「+」点击 —— 官方 `nt("first")/nt("last")`：
   * 进入「选首帧 / 选尾帧」的**画布选图模式**。MTV 侧由 `AINodeDialog` 接到 `videoReferences` 的选图流程；
   * 未提供时按钮仍按官方结构渲染（只是不触发选图）。
   */
  onRequestFrameSlot?: (slot: 'first' | 'last') => void;
  availableGenerateMethods?: VideoMethodKey[];
  onGenerateMethodChange?: (method: VideoMethodKey) => void;
  /** §93 官方目录表兜底（`videoModelInfo`）需要的官方 `state.modelType` 原样串。 */
  videoModelType?: string;
  /**
   * §124 官方 `fx` 的 `advancedSettings`（`v`）—— 官方 `S0` 的同名 prop（canvas:@1192000 邻域逐字）：
   *   `hasAdvancedSettings = !!advancedSettings && !readonly`（`G=a.useMemo(()=>({isExpanded:H,
   *    toggle:()=>V(pe=>!pe),hasAdvancedSettings:!!v&&!L}),[H,v,L])`）。
   * 官方视频链把它传成 `sy = Kf`：只有 `SEEDANCE_2_0 / SEEDANCE_2_5 / SEEDANCE_2_5_DRAFT`
   * 且 `modelType === zt.TEXT_TO_VIDEO` 时才有内容，内容 = 官方 `fQe`（一行「联网搜索」开关）。
   */
  advancedSettings?: ReactNode;
  audioSpeechSettings?: AudioSpeechSettings;
  onChangeAudioSpeechSettings?: (value: AudioSpeechSettings) => void;
  onRemoveAudioReference?: (reference: AudioSpeechReference) => void;
  audioPurpose?: AudioGenerationPurpose;
  audioVoice?: AudioTtsVoice;
  audioFormat?: AudioOutputFormat;
  audioSpeed?: number;
  musicTitle?: string;
  musicLyrics?: string;
  musicBpm?: number;
  musicDuration?: number;
  autoGenerateLyrics?: boolean;
  onChangeAudioVoice?: (value: AudioTtsVoice) => void;
  onChangeAudioFormat?: (value: AudioOutputFormat) => void;
  onChangeAudioSpeed?: (value: number) => void;
  onChangeMusicTitle?: (value: string) => void;
  onChangeMusicLyrics?: (value: string) => void;
  onChangeMusicBpm?: (value: number | undefined) => void;
  onChangeMusicDuration?: (value: number) => void;
  onChangeAutoGenerateLyrics?: (value: boolean) => void;
  workflows?: WorkflowDefinition[];
  editorRef?: React.Ref<MentionEditorHandle>;
  /**
   * 官方 `onMediaClick`：点上游引用条目 ⇒ 把该引用插进提示词输入区。
   * 由调用方（`AINodeDialog`）用编辑器 ref 的 `insertMentionAtCursor` 实现。
   */
  onInsertReferenceMention?: (reference: { nodeId: string; label: string }) => void;
  selectedStyle?: string;
  onStyleChange?: (styleId: string) => void;
}

export default function PromptPanel({
  nodeType,
  nodeId,
  prompt = '',
  placeholder,
  selectedModel,
  selectedProvider,
  selectedWorkflowId,
  workflowInputs,
  onWorkflowInputsChange,
  runninghubModelParameters,
  onRunninghubModelParametersChange,
  animationAction = 'idle',
  onAnimationActionChange,
  animationFrames = 8,
  onAnimationFramesChange,
  canGenerate = true,
  isGenerating = false,
  onCancelGeneration,
  onChange,
  onContinuousEditEnd,
  onSubmit,
  onModelSelect,
  onWorkflowSelect,
  imageSize,
  aspectRatio,
  onChangeImageSize,
  onChangeAspectRatio,
  /* ★ 「精细度」组 ✓（官方第三组 ✓ EXE `qualityOptions` ✓ 默认 low ✓）*/
  quality,
  onChangeQuality,
  qualityOptions,
  showQuality,
  transparentBackground,
  onChangeTransparentBackground,
  batchCount = 1,
  onChangeBatchCount,
  cameraSettings,
  onChangeCameraSettings,
  videoResolution,
  videoFps,
  videoFrames,
  onChangeVideoResolution,
  onChangeVideoFps,
  seedanceResolution,
  seedanceRatio,
  seedanceDuration,
  generateAudio,
  videoReferences,
  onChangeVideoReferences,
  onChangeSeedanceResolution,
  onChangeSeedanceRatio,
  onChangeSeedanceDuration,
  onChangeGenerateAudio,
  generateMethod,
  onRequestFrameSlot,
  availableGenerateMethods,
  onGenerateMethodChange,
  videoModelType,
  advancedSettings,
  audioSpeechSettings,
  onChangeAudioSpeechSettings,
  onRemoveAudioReference,
  audioPurpose,
  audioVoice,
  audioFormat,
  audioSpeed,
  musicTitle,
  musicLyrics,
  musicBpm,
  musicDuration,
  autoGenerateLyrics,
  onChangeAudioVoice,
  onChangeAudioFormat,
  onChangeAudioSpeed,
  onChangeMusicTitle,
  onChangeMusicLyrics,
  onChangeMusicBpm,
  onChangeMusicDuration,
  onChangeAutoGenerateLyrics,
  workflows = [],
  editorRef,
  onInsertReferenceMention,
  selectedStyle,
  onStyleChange,
}: PromptPanelProps) {
  const t = useT();
  const effectivePlaceholder = placeholder ?? t('输入提示词开始创作   (Enter 生成，Shift+Enter 换行)');
  /* 官方：提示词为空、且这条提示栏带「参考图」时，占位走**键帽版**
     （`zoom-slider` @1721577 的 `H && E.length > 0` 分支；官方 图2 正是这个状态）。
     MTV 里「带参考图」= 该节点有上游连线 ⇒ 订阅 store 的入边（响应式，不用 getState ✗） */
  const hasIncomingEdge = useAppStore((s) => (nodeId ? s.edges.some((edge) => edge.target === nodeId) : false));
  const useKeycapPlaceholder = Boolean(nodeId && !prompt.trim() && hasIncomingEdge);
  const [focused, setFocused] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  /* 官方 `fx` 的高级设置折叠态（`P`，默认 false；开关在底行左组末尾） */
  const [advancedOpen, setAdvancedOpen] = useState(false);
  /* 官方 `fx` 的 `isOverflowing`（`L`，由提示词输入通过 `setIsOverflowing` 上报）：
     右侧「放大/还原」钮只在 `isOverflowing || isCollapsed` 时出现 ⇒ 这里量编辑器的真实溢出 */
  const [promptOverflowing, setPromptOverflowing] = useState(false);
  /* ★ 官方 `Uq` context 里那套「提示词折叠」状态，**与高级设置面板的 `isExpanded` 完全分开**：
       · `Hq` = { isExpanded, toggle, hasAdvancedSettings }  → 高级设置面板（MTV 的 isExpanded/onToggleExpand）
       · `Uq` = { isCollapsed, toggle, isOverflowing, setIsOverflowing } → 提示词折叠（本状态）
     MTV 原来把两者混用一个 `isExpanded`（还在 AINodeDialog 里当 prop 传）⇒ 放大钮的行为跟官方对不上。
     官方出处：`zoom-slider-3ZcFvYQO.js` @1690575（`fx` 的 `[D,G]=useState(!1)`）。 */
  const [promptCollapsed, setPromptCollapsed] = useState(false);
  const slashBtnRef = useRef<HTMLButtonElement>(null);
  const promptInputRef = useRef<HTMLDivElement>(null);
  const batchTriggerRef = useRef<HTMLDivElement>(null);
  const batchLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressSubmitClickRef = useRef(false);
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);
  /* ★ 官方 `PopoverContent` 由 radix **portal 到 body** 渲染 ⇒ 不受任何祖先 `overflow:hidden` 裁剪。
     ⚠️ MTV 之前把弹层直接挂触发钮旁边 ⇒ 被底部编辑区的 `overflow:hidden` **裁掉顶部**
     （用户截图：12× 那一行被切、面板整体右偏）。
     ⇒ 照官方机制改成 `createPortal(..., document.body)` + `position:fixed`，
        并用触发钮的 `getBoundingClientRect()` 还原 `side=top align=center sideOffset=8`：
          left = rect.left + rect.width/2（align center）
          top  = rect.top - 8（side top + sideOffset 8） */
  const [batchAnchor, setBatchAnchor] = useState<{ left: number; top: number } | null>(null);
  const dreaminaImageModel = nodeType === 'ai-image' && selectedProvider === 'dreamina'
    ? getDreaminaImageModel(selectedModel)
    : undefined;

  useEffect(() => {
    if (!dreaminaImageModel) return;
    const normalizedSize = imageSize?.toLowerCase();
    const supportedSize = dreaminaImageModel.resolutions.some(
      (size) => size.toLowerCase() === normalizedSize,
    );
    if (!supportedSize) {
      const fallback = dreaminaImageModel.resolutions.find((size) => size.toLowerCase() === '2k')
        ?? dreaminaImageModel.resolutions[0];
      onChangeImageSize?.(fallback);
    }
    if (aspectRatio && !DREAMINA_IMAGE_RATIOS.includes(aspectRatio as typeof DREAMINA_IMAGE_RATIOS[number])) {
      onChangeAspectRatio?.('16:9');
    }
  }, [aspectRatio, dreaminaImageModel, imageSize, onChangeAspectRatio, onChangeImageSize]);

  const performanceMode = useAppStore((s) => s.config.performanceMode === true);
  /* ★★★★★ **自定义模型 → 官方模型的映射候选** ✓✓（用户："自定义模型 你映射官方的" ✓）
     自定义连接的模型 value 是 `general/<GeneralModelConfig.id>` ✗ 里面没有官方模型名 ✗
     但同一条配置里有 `modelId`（**上游真实模型名**，如 `gemini-3.1-flash-image-preview` ✓）
     和 `name`（可读名 ✓）→ 把它们作为候选交给能力表 ✓（依次尝试 ✓ 命中即用官方那套 ✓）
     命中不到仍走兜底 ✓（不编造 ✗）*/
  const generalModelConfig = useAppStore((s) =>
    s.config.generalModels?.find((m) => `general/${m.id}` === selectedModel) ?? null,
  );
  const modelAliases = useMemo(
    () => [generalModelConfig?.modelId, generalModelConfig?.name],
    [generalModelConfig?.modelId, generalModelConfig?.name],
  );
  /* ★ **渠道**能收的档位（≠ 官方能力表）——目前唯一的实例：土豆异步生图走免费池渠道，
     `resolution=4k` / `quality=high` 会被网关 409 挡回（2026-10-20 逐参数实测，
     详见 `services/models/channelParamLimits.ts`）。菜单里置灰，不剪掉。 */
  const channelLimits = useMemo(
    () => channelParamLimitsFor([selectedModel, generalModelConfig?.modelId, generalModelConfig?.name]),
    [generalModelConfig?.modelId, generalModelConfig?.name, selectedModel],
  );
  /* 官方没有 skill 概念；userSkills 仍被 handleSubmit 的 expandSkillReferences 用到（MTV 既有行为，先保留）*/
  const userSkills = useAppStore((s) => s.userSkills);
  const showToast = useAppStore((s) => s.showToast);
  const pendingPresetAction = useAppStore((s) => s.pendingPresetAction);
  const setPendingPresetAction = useAppStore((s) => s.setPendingPresetAction);
  const focusEditNodeId = useAppStore((s) => s.focusEditNodeId);
  const setFocusEditNodeId = useAppStore((s) => s.setFocusEditNodeId);
  /* 「参考」按钮走官方**通用节点选择模式**（store `dr`）—— 不再是 MTV 自造的 `referencePickNodeId`
     横幅：官方 `page-BeI7xydN.js@3224048` 的 `pt` 就是 `enterMode(id,{source:'reference',…})`。
     横幅/遮罩/遮罩态全部由 `NodeSelectionPickToolbar` + `NodeSelectionPickLayer` 按官方渲染。 */
  const referencePick = useNodeSelectionStore((s) => (
    s.isActive && s.originNodeId === nodeId && s.meta?.source === 'reference'
  ));
  const focusEdit = focusEditNodeId === nodeId;

  /* ★ 焦点编辑横幅的「定位」按钮 —— 官方门（`vendor-pkg-canvas-futqHM6N.js` @3255887 逐字）：
       `p = i && d`，其中
         `d = useCallback(m => { ... const v=(-x+g/2)/_, w=(-b+y/2)/_, ...
                                 return Math.hypot(v-T, w-A) > 200 })`
       ⇒ **源节点中心与视口中心距离 > 200（画布坐标）时才显示**（已经看得见就别再给按钮）。
       官方点击行为 `u`：`t(x, y + h*0.4, { zoom, duration: 500 })` —— 把源节点居中并下移 40% 高度，
       用当前 zoom、500ms 动画。MTV 用既有 `fitView({nodeIds})`（等价、且有现成控制器）+ 高亮环
       （与 `PinBar.locateNode` 同一手法）。 */
  const [showFocusEditLocate, setShowFocusEditLocate] = useState(false);
  const focusSourceNode = useCallback(() => {
    if (!focusEditNodeId) return;
    const controller = getCanvasViewportController();
    const node = useAppStore.getState().nodes.find((n) => n.id === focusEditNodeId);
    if (!controller || !node) return;
    /* 官方 `u`（@3492125 区）：`onClick:()=>{const E=…; t(y, b+h*.4, {zoom:_, duration:500})}`
       —— **保持当前 zoom**，把源节点**居中并下移 40% 自身高度**，500ms 过渡。
       ⚠️ MTV 原来用 `fitView({ nodeIds:[id], padding:1 })` ⇒ 会**改 zoom**（把节点缩得很小），
          与官方行为不同 ⇒ 这里按官方算 translate：`x' = W/2 - P·zoom`（W = 视口宽，画布坐标×zoom = 屏幕）。*/
    const { zoom, visibleBounds } = controller.getSnapshot();
    if (!(zoom > 0)) return;
    const width = node.measured?.width ?? node.width ?? 0;
    const height = node.measured?.height ?? node.height ?? 0;
    const cx = node.position.x + width / 2;
    const cy = node.position.y + height / 2 + height * 0.4;
    void controller.setViewport(
      {
        x: zoom * (visibleBounds.width / 2 - cx),
        y: zoom * (visibleBounds.height / 2 - cy),
        zoom,
      },
      500,
    );
  }, [focusEditNodeId]);

  useEffect(() => {
    if (!focusEdit || !focusEditNodeId) {
      // ⚠️ 不能在 effect 体里同步 setState（`react-hooks/set-state-in-effect`）⇒ 延到下一帧
      const raf = requestAnimationFrame(() => setShowFocusEditLocate(false));
      return () => cancelAnimationFrame(raf);
    }
    /* 官方门逐字（@3255887）：
         `const v=(-x+g/2)/_, w=(-b+y/2)/_`  ← 视口中心换算成画布坐标（x,b = transform 平移，_ = zoom，g,y = 视口宽高）
         `return Math.hypot(v-T, w-A) > 200` ← T/A = 源节点中心（画布坐标）
       即：**源节点中心离视口中心超过 200 画布单位时才显示**（已经看得见就不给按钮）。
       用**每帧**测量（不用 setInterval）：平移/缩放后显隐要立刻跟着变；
       只在值真的翻转时 setState，避免每帧重渲染。 */
    let raf = 0;
    let last: boolean | null = null;
    const measure = () => {
      const controller = getCanvasViewportController();
      const node = useAppStore.getState().nodes.find((n) => n.id === focusEditNodeId);
      if (controller && node) {
        const { visibleBounds } = controller.getSnapshot();
        const nodeWidth = node.measured?.width ?? node.width ?? 0;
        const nodeHeight = node.measured?.height ?? node.height ?? 0;
        const cx = node.position.x + nodeWidth / 2;
        const cy = node.position.y + nodeHeight / 2;
        /* ⚠️ `getSnapshot().visibleBounds` **已经是画布坐标**（Canvas.tsx:593 用
           `screenToFlowPosition` 换算过）⇒ 视口中心就是它的几何中心，
           **不能再除 zoom 一次**（旧实现 `-x/zoom + width/(2*zoom)` 把 zoom 除了两遍，
           算出来的中心严重偏移 ⇒ 判定恒为「太远」⇒ 定位键常驻）。*/
        const viewCx = visibleBounds.x + visibleBounds.width / 2;
        const viewCy = visibleBounds.y + visibleBounds.height / 2;
        const next = Math.hypot(cx - viewCx, cy - viewCy) > 200;
        if (next !== last) { last = next; setShowFocusEditLocate(next); }
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [focusEdit, focusEditNodeId]);

  // 焦点编辑用 ESC 退出（官方实测行为）；参考拾取的 ESC 由官方 store `dr` 自己监听（`EA`）。
  useEffect(() => {
    if (!focusEdit) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setFocusEditNodeId(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [focusEdit, setFocusEditNodeId]);

  const handleSubmit = useCallback((overridePrompt?: string, postProcess?: ImagePostProcess) => {
    const sourcePrompt = overridePrompt ?? prompt;
    onSubmit(expandSkillReferences(sourcePrompt, userSkills), postProcess);
  }, [onSubmit, prompt, userSkills]);

  /* ★ 按官方语义：**提交就按当前选中的数量提交**（数量选择器 `:650` 已是"纯选择器、不自动发送"）。
     ⚠️ 原来这里会 `onChangeBatchCount(1)` 把数量强行写回 1 ⇒ 用户选完 2× 再点发送，数量被改回 1、
        `AINodeDialog.tsx:814` 的批量分支永远走不到（"数量始终只能是 1" 的直接原因）⇒ 已去掉这行。 */
  const handleSingleSubmit = useCallback((overridePrompt?: string, postProcess?: ImagePostProcess) => {
    setBatchMenuOpen(false);
    handleSubmit(overridePrompt, postProcess);
  }, [handleSubmit]);

  const clearBatchLongPress = useCallback(() => {
    if (batchLongPressTimerRef.current) {
      clearTimeout(batchLongPressTimerRef.current);
      batchLongPressTimerRef.current = null;
    }
  }, []);

  const hasGenerationInput = !!prompt.trim() || selectedProvider === 'runninghub' || selectedProvider === 'runninghubwf' || selectedProvider === 'workflow-api';
  /* 官方 `mx` 的「生成次数」(`Wq` = TimesSelector @1693064) 是**所有节点类型共用**的底行控件；
     文本卡那一支（`zee` @3384358）传 `timesOptions:[1,2,3,4].slice(0, timesLimit || Jrt)`，而生成文本节点
     调 `zee` 时**不传 `timesLimit`** ⇒ 文本卡就是 [1,2,3,4]（见 utils/textVariants.ts 的取证）。
     ⚠️ 图卡分支另有 dreamina / 工作流的限制，保持原样不动。
     §115：**视频卡也必须有这颗** —— 官方 r100 `_0`（动作条）@1194880 区逐字：
       `K=…[!l&&s.jsx(go,{locked:c,message:d,children:s.jsx(Bee,{times:e,onTimesChange:t,timesOptions:i,batchSize:f,disabled:$})}),A,s.jsx(yl,{…})]`
     它排在**价格块与生成按钮之前**，唯一门是 `l`（`hideTimes`）；而 `ese` 给视频传的是
       `times:b?1:o.currentCount||1, timesOptions:b?AQe:p?.options?.timesOptions??[1,2]`（同文件 @2065600 区）
     ⇒ 视频**有**数量选择器（默认档 `[1,2]`）。MTV 原来把 `ai-video` 排除在外 ⇒ 底栏少一颗 `1×`（用户图1/图4 对比）。 */
  const textTimesControl = nodeType === 'ai-text';
  const batchSupported = (nodeType === 'ai-image' || nodeType === 'ai-video' || textTimesControl)
    && Boolean(onChangeBatchCount)
    && selectedProvider !== 'dreamina'
    && !selectedWorkflowId;

  const handleBatchPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!batchSupported || event.button !== 0 || !canGenerate || !hasGenerationInput) return;
    suppressSubmitClickRef.current = false;
    clearBatchLongPress();
    batchLongPressTimerRef.current = setTimeout(() => {
      suppressSubmitClickRef.current = true;
      setBatchMenuOpen(true);
      batchLongPressTimerRef.current = null;
    }, BATCH_LONG_PRESS_MS);
  }, [batchSupported, canGenerate, clearBatchLongPress, hasGenerationInput]);

  const handleSubmitClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    clearBatchLongPress();
    if (suppressSubmitClickRef.current) {
      suppressSubmitClickRef.current = false;
      return;
    }
    if (canGenerate && hasGenerationInput) handleSingleSubmit();
  }, [canGenerate, clearBatchLongPress, handleSingleSubmit, hasGenerationInput]);

  /* ★ 官方 `TimesSelector` 的 `select`：`const u = p => { t(p); c(!1) }` —— **只改数量并关闭，不生成**。
     ⚠️ MTV 原来多调了一次 `handleSubmit()`（选中即发送）。那是旧「内联展开条 + 长按」的语义；
        官方次数按钮就是个纯选择器 ⇒ 已按官方去掉。 */
  const handleBatchSelect = useCallback((count: number) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onChangeBatchCount?.(count);
    setBatchMenuOpen(false);
  }, [onChangeBatchCount]);

  useEffect(() => clearBatchLongPress, [clearBatchLongPress]);

  useEffect(() => {
    if (!batchMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Element | null;
      /* ★★ 弹层现在是 `createPortal(..., document.body)` 渲染的（照官方 radix 的 portal 机制），
         它**不在 `batchTriggerRef` 里面** ⇒ 原来的「不在触发钮内就关」会把弹层自己的选项也判成"外部"，
         **一按下选项菜单就先关了、click 根本没机会触发** ⇒ 用户实测「选数量后 1× 的显示和应用始终不变」✗。
         ⇒ 官方 radix 的 `DismissableLayer` 判定的是「是否在本 popover 的内容树内」，
            这里用 `[data-batch-menu]` 标记把弹层一起算作"内部" ✓ */
      if (target?.closest('[data-batch-menu]')) return;
      if (!batchTriggerRef.current?.contains(event.target as globalThis.Node)) {
        setBatchMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [batchMenuOpen]);

  const handleSlashSelect = useCallback((filledPrompt: string, shouldTrigger: boolean, preset?: PresetOverride) => {
    setSlashOpen(false);
    // 如果预设绑定了模型/尺寸，写入节点数据（覆盖节点当前设置）
    if (preset) {
      if (preset.model && preset.provider) {
        onModelSelect({ value: preset.model, provider: preset.provider, label: preset.model, nodeTypes: [] });
      }
      if (preset.imageSize && onChangeImageSize) {
        onChangeImageSize(preset.imageSize);
      }
      if (preset.aspectRatio && onChangeAspectRatio) {
        onChangeAspectRatio(preset.aspectRatio);
      }
    }
    if (shouldTrigger) {
      // Direct trigger: combine preset template + input box content, call model directly
      // Don't update the input box — the preset prompt is only used for this generation
      handleSingleSubmit(filledPrompt, preset?.postProcess);
    } else {
      // Insert mode: update input box with filled template, user can edit before generating
      onChange(filledPrompt);
      onContinuousEditEnd?.();
    }
  }, [handleSingleSubmit, onChange, onContinuousEditEnd, onModelSelect, onChangeImageSize, onChangeAspectRatio]);

  // ── 从 Toolbar 点击快捷指令后的自动执行 ──
  useEffect(() => {
    if (!pendingPresetAction || pendingPresetAction.nodeId !== nodeId) return;
    const { filledPrompt, shouldTrigger, override, postProcess } = pendingPresetAction;
    // 清除 pending，防止重复执行
    setPendingPresetAction(null);
    const raf = requestAnimationFrame(() => {
      handleSlashSelect(filledPrompt, shouldTrigger, override ? {
        model: override.model,
        provider: override.provider,
        imageSize: override.imageSize,
        aspectRatio: override.aspectRatio,
        postProcess: postProcess as ImagePostProcess | undefined,
      } : { postProcess: postProcess as ImagePostProcess | undefined });
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingPresetAction, nodeId, handleSlashSelect, setPendingPresetAction]);

  const handleEditorSlash = useCallback(() => {
    setSlashOpen(true);
  }, []);

  const handleButtonSlash = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSlashOpen((open) => !open);
  }, []);

  /* 官方 `/` 菜单的 ref（`lT` 暴露 moveUp/moveDown/selectCurrent/escape —— 上下循环） */
  const officialSlashRef = useRef<OfficialSlashCommandMenuHandle>(null);
  /* 官方 `/` 的键盘行为（`fF` @1624900 把按键转给菜单 ref）：
       ArrowUp/Down 移动选中（**循环**）、Enter 执行、Escape 关闭。
     ⚠️ 必须 stopPropagation：MTV 的节点面板在**捕获阶段**监听 Escape/Enter（AINodeDialog @629）；
        AINodeDialog 里已对官方菜单做了显式豁免，这里再拦住一层防误提交。 */
  useEffect(() => {
    if (!slashOpen) return;
    const onKey = (event: KeyboardEvent) => {
      const menu = officialSlashRef.current;
      if (!menu) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); setSlashOpen(false);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault(); event.stopPropagation(); menu.moveDown();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault(); event.stopPropagation(); menu.moveUp();
      } else if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); event.stopPropagation(); menu.selectCurrent();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slashOpen]);
  /* 官方可用性判定：`parentNodesCount<=0` 或父节点类型非 image ⇒ 菜单禁用 + 显示「至少连入一张图片」提示 */
  const incomingRefCount = useAppStore((s) => (nodeId ? s.edges.filter((e) => e.target === nodeId).length : 0));


  const selectedAudioWorkflow = nodeType === 'ai-audio' ? workflows.find((item) => item.id === selectedWorkflowId) : undefined;
  const speechControls = resolveAudioSpeechWorkflow(selectedAudioWorkflow);
  const referenceInputId = speechControls?.referenceInputId;
  const loadGlobalCharacters = useAppStore((state) => state.loadGlobalCharacters);
  useEffect(() => {
    if (referenceInputId) void loadGlobalCharacters();
  }, [referenceInputId, loadGlobalCharacters]);
  const voiceChoiceSnapshot = useAppStore((state) => JSON.stringify(referenceInputId ? [
    ...state.dramaAssets.characters.map((character) => ({ character, scope: 'project' as const })),
    ...state.globalCharacters.map((character) => ({ character, scope: 'global' as const })),
  ].flatMap(({ character, scope }) => {
    if (!character.primaryVoiceClipId) return [];
    const voice = resolveDramaVoiceRef(character, character.primaryVoiceClipId);
    if (!voice) return [];
    return [{
      id: `${scope}:${character.id}:${voice.id}`, scope, label: voice.label, url: voice.url,
      // 项目角色沿用声音片段引用；全局声音读取持久化音频快照，不依赖项目节点。
      value: scope === 'project'
        ? `@drama{${buildDramaVoiceMentionId(character.id, voice.id)}:${voice.label.replace(/[{}]/g, '')}}`
        : voice.url,
    }];
  }) : []));
  const voiceChoices = JSON.parse(voiceChoiceSnapshot) as CharacterVoiceChoice[];
  const selectedReference = referenceInputId ? workflowInputs?.[referenceInputId] ?? '' : '';
  const selectCharacterVoice = (value: string) => {
    if (!referenceInputId || !onWorkflowInputsChange) return;
    const inputs = { ...workflowInputs };
    if (value) inputs[referenceInputId] = value;
    else delete inputs[referenceInputId];
    // 同一输入已有手动 IO 芯片时移除旧赋值，防止编辑正文后重新覆盖下拉选择。
    const nextPrompt = prompt.replace(/@wf\{([^|]+)\|([^|]+)\|([^|}]+)\}\(([\s\S]*?)\)/g,
      (token, id: string) => id === referenceInputId ? '' : token);
    if (nextPrompt !== prompt) onChange(nextPrompt);
    onWorkflowInputsChange(inputs);
    onContinuousEditEnd?.();
  };
  /* 官方参考图计数（`As` 标签）—— 官方 `Ct = qt.normal + (qt.style ?? 0) + (qt.omni ?? 0)`，
     也就是**只数图片**（不含视频/音频/文本）⇒ 这里同样只统计 kind === 'image' 的上游引用。
     官方 markup：`shrink-0 whitespace-nowrap text-[11px] text-muted-foreground` + `aria-live="polite"` */
  const refEdges = useAppStore((s) => s.edges);
  const refNodes = useAppStore((s) => s.nodes);
  const referenceImageCount = useMemo(() => {
    if (!nodeId) return 0;
    const nodesById = new Map(refNodes.map((n) => [n.id, n] as const));
    return collectUpstreamReferences(nodeId, refEdges, nodesById).filter((item) => item.kind === 'image').length;
  }, [nodeId, refEdges, refNodes]);

  // 返回稳定标量，避免其他节点移动时让弹窗重渲染。
  const audioReferenceSnapshot = useAppStore((state) => speechControls ? JSON.stringify(collectAudioSpeechReferences(
    prompt, nodeId, state.nodes, state.edges, state.dramaAssets, selectedAudioWorkflow, workflowInputs,
  )) : '[]');
  const audioReferences = JSON.parse(audioReferenceSnapshot) as AudioSpeechReference[];
  const addAudioReference = () => {
    requestAnimationFrame(() => {
      const editor = promptInputRef.current?.querySelector<HTMLElement>('[contenteditable="true"]');
      if (!editor) return;
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('insertText', false, '@');
    });
  };
  const runninghubModel = selectedProvider === 'runninghub' ? getRunningHubModel(selectedModel, true) : undefined;
  const runninghubWorkflow = workflows?.find((workflow) => workflow.id === selectedWorkflowId && workflow.adapterType === 'runninghub');
  const workflowApi = workflows?.find((workflow) => workflow.id === selectedWorkflowId && workflow.adapterType === 'workflow-api');
  /* 官方 `TiptapInput` 的溢出判定（`use-waveform-data-DMduQqB-.js` @603521）：
       scrollHeight − paddingTop − paddingBottom  >  overflowLineThreshold(5) × 24(行高)
     ⚠️ 不是 `scrollHeight > clientHeight`：官方按**行数**判（超过 5 行就算溢出），
        与本机 max-height 有没有被撑到无关。MTV 原来按视口溢出判 ⇒ 放大钮出现的时机不对。 */
  useEffect(() => {
    const el = promptInputRef.current?.querySelector<HTMLElement>('.prompt-editor');
    if (!el) return undefined;
    const measure = () => {
      const style = window.getComputedStyle(el);
      const padTop = Number.parseFloat(style.paddingTop) || 0;
      const padBottom = Number.parseFloat(style.paddingBottom) || 0;
      const nextOverflowing = el.scrollHeight - padTop - padBottom > 5 * 24;
      setPromptOverflowing(nextOverflowing);
      /* 官方 `fx`：`useEffect(()=>{ !L && D && G(!1) }, [L, D])` —— 一旦不再溢出，
         折叠态**自动还原**（否则提示词删短之后面板会卡在折叠里）。
         官方写在 effect 里；这里并进同一个测量回调（等价，且避开
         `react-hooks/set-state-in-effect` 那条「effect 里同步 setState」的告警）。 */
      if (!nextOverflowing) setPromptCollapsed(false);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [prompt, nodeId]);
  /* 官方 `fx` 的 `advancedSettings`（`v`）是否存在 ⇒ 决定折叠面板 + 底行左组末尾那个开关
     （官方 `hasAdvancedSettings = !!advancedSettings && !readonly`） */
  /* §129 官方首尾帧行用到的计数：`at` = 已连的帧引用数组（官方 `at.length<2` 决定 ⇄ 的 disabled）。
     ★★★★★ **官方是「按顺序」而不是「按 role」** —— 用户裁决「⇄ 按照官方的来」。
     官方出处（`vendor-pkg-canvas-*.js` @2041103 区逐字，`at` = 按 `data.order` 排好序的两帧）：
       `first: He[0] ? { url: He[0].url, edgeId: He[0].edgeId, index: 0 } : null,`
       `last:  He[1] ? { url: He[1].url, edgeId: He[1].edgeId, index: 1 } : null`
     ⇒ **首帧 = `at[0]`、尾帧 = `at[1]`，官方源码里没有任何 frame/role 区分**
       （同一批 `{purpose:"generation-input"}` 引用，只有 `data.order` 排序）。
     ⚠️ MTV 原来按 `role === 'first_frame' / 'last_frame'` 找槽位 ⇒ 与官方「位置即身份」不等价
        （数组顺序与 role 不一致时两个槽会显示同一张、另一个空）。 */
  const frameRefs = orderedFrameRefs(videoReferences);
  const frameSlotCount = frameRefs.length;
  const hasAdvancedSettings = Boolean(
    (runninghubModel && onRunninghubModelParametersChange)
    || (runninghubWorkflow && onWorkflowInputsChange)
    || (workflowApi?.workflowApi && onWorkflowInputsChange)
    /* §124 官方视频链：`advancedSettings` = `Kf`（seedance 文本模式下的「联网搜索」开关）
       ⇒ 官方 `hasAdvancedSettings = !!advancedSettings && !readonly`，这里按同一口径接上。 */
    || advancedSettings,
  );
  return (
    <>
    {/* 焦点编辑模式横幅 — **官方逐字**（`vendor-pkg-canvas-futqHM6N.js` @3255887）：
         容器 `inline-flex min-w-[320px] rounded-lg` + padding 8/10/8/18 + 底 #1FA2DC
         + `box-shadow:0 4px 16px rgba(0,0,0,.16), inset 0 .5px 0 rgba(255,255,255,.16)` + `blur(28px)`。
         右侧 `ml-auto gap-2`：条件「定位」图标按钮 + `h-5 w-px bg-white/20` 分隔线 + 退出。
         ⚠️ 官方**没有齿轮/设置按钮** —— 旧实现那个是 MTV 自加的，已按官方删除。
         官方那个条件按钮是「定位」（把镜头带到源节点），门为 `isActive && 视口距离 > 200px`。
         必须 portal 到 body：节点祖先带 transform，会让 position:fixed 退化成相对该祖先定位。 */}
    {focusEdit && createPortal(
      <div className="focus-edit-banner" role="status">
        <div className="focus-edit-banner__text">
          <span className="focus-edit-banner__title">{t('焦点编辑')}</span>
          <span className="focus-edit-banner__subtitle">{t('点击其他节点以提取元素')}</span>
        </div>
        <div className="focus-edit-banner__actions">
          {showFocusEditLocate && (
            <>
              <button
                type="button"
                className="focus-edit-banner__btn focus-edit-banner__btn--icon"
                aria-label={t('定位到该节点')}
                onClick={focusSourceNode}
              >
                {/* 官方定位图标 = **Tabler `focus-2`**（用户提供的官方 svg 逐字）：
                    `circle r=.5 fill=currentColor`（中心实心点）+ `r=7` 圆环 + 上下左右 4 段刻度，
                    viewBox 24 / stroke-width 2 / linecap+linejoin round。
                    ⚠️ 之前用 `circle r=3` + 手写刻度 ⇒ 与官方不一样（用户实测两次指出）。 */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r=".5" fill="currentColor" />
                  <path d="M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
                  <path d="M12 3l0 2" />
                  <path d="M3 12l2 0" />
                  <path d="M12 19l0 2" />
                  <path d="M19 12l2 0" />
                </svg>
              </button>
              <div className="focus-edit-banner__divider" aria-hidden="true" />
            </>
          )}
          <button type="button" className="focus-edit-banner__btn" onClick={() => setFocusEditNodeId(null)}>
            {t('退出')}
          </button>
        </div>
      </div>,
      document.body,
    )}
    {/* 官方「参考」拾取**没有独立横幅**：它用的是通用节点选择模式那一条（`CW`），
        由 `NodeSelectionPickToolbar` 统一渲染（`meta.toolbarTitle` = 「从画布选择参考」）。
        旧的自造 `focus-edit-banner--compact` 横幅已删除。 */}
    <div className={`prompt-panel ${focused ? 'focused' : ''}`}>
      {/* ══ 官方 `fx` 的顶行（headerSlot）——**只有一行**（`zoom-slider` @1691831）══
          官方结构（逐字）：
            <div className={Z("px-3 pt-3 pb-2 flex gap-2 items-center min-w-0", headerClassName)}>
              <div className="flex items-center gap-2 min-w-0 flex-1">{headerSlot ?? 默认条}</div>
              {Be && <div className="shrink-0 self-start mt-px">{Oe}</div>}     // 右侧「放大/还原」
            </div>
          图像节点的 headerSlot（@3204087）= `<><gx …/>{计数标签}</>`；`gx`（@1700439）=
            <div className={Z("flex items-center gap-2 nodrag min-w-0")}>
              〔leadingAction ?? magicSelection 按钮 38×38 r10 border/white10 bg-white/[0.08]〕
              〔(leadingAction||magicSelection) && <div className="w-px h-4 bg-white/10 shrink-0"/>〕
              〔<div className="min-w-0 flex-1 relative">滚动 chips（gap-1.5）+ 两端渐隐按钮</div>〕
              〔加号 38×38 r10 bg-white/[0.08]（tooltip `videoConfigs.reference`=「参考」）〕
              〔extraActions〕〔可滚动时 <div className="w-px h-4 bg-white/10 shrink-0"/>〕
            </div>
          计数标签（`As`）= `shrink-0 whitespace-nowrap text-[11px] text-muted-foreground` + `aria-live="polite"`
            文案 `image.referenceCount` =「参考图 {count} 张」；官方 `Ct = qt.normal + style + omni`（**只数图片**）
          ⚠️ MTV 原来把这一整行拆成**两行**（第一行缩略图+计数、第二行 `.prompt-tool-row` 再放一遍
             ✦/chips/+/放大）⇒ 缩略图重复出现两次，与官方（单行）不符 ⇒ 已合并为官方单行。 */}
      {nodeId && (
        <div className="prompt-header-row" data-testid="prompt-reference-header">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="prompt-ref-strip nodrag" data-testid="prompt-ref-strip">
              {/* 官方 `magicSelection` 按钮（zh 文案 `magicSelection.activeTitle` =「焦点编辑」）
                  —— MTV 的「焦点编辑」就是官方这个功能，图标用官方 48-viewBox 原版 */}
              {nodeType !== 'ai-text' && (
                <>
                  <button
                    type="button"
                    className="prompt-magic-btn"
                    data-tooltip={t('焦点编辑')}
                    data-tooltip-pos="top"
                    /* 官方 `gx` 用的是 Tooltip 便捷封装 `Nn`（= `P9e` @5896347）：
                       `sideOffset=8 / delayDuration=200 / side=top / align=center` ✓ */
                    data-tooltip-offset="8"
                    data-tooltip-delay="200"
                    aria-label={t('焦点编辑')}
                    aria-pressed={focusEdit}
                    onClick={() => setFocusEditNodeId(focusEdit ? null : nodeId ?? null)}
                  >
                    <OfficialIcon name="focus-edit" size={16} />
                  </button>
                  <span className="prompt-magic-divider" aria-hidden="true" />
                </>
              )}
              {/* ══ §129 官方 `ha` 的 **`Se` 分支 = 首尾帧行**（canvas @2060400 区逐字）══
                   `Se = ge === Gu.FRAMES`（= 生成方式「首尾帧」）时才渲染；其余生成方式该行为 `null`。
                   官方结构（逐字）：
                     <div className="flex items-center gap-1">
                       首帧槽：有帧 ⇒ 38×38 缩略图 + hover ✕；无帧 ⇒
                         <button className="size-[38px] flex items-center justify-center rounded-[10px] shrink-0
                                            transition-all focus:outline-none bg-white/[0.08] hover:bg-white/[0.12]"
                                 onClick={()=>nt("first")}>{Qd size-4}</button>（tooltip `common.firstFrame`）
                       ⇄：<button type="button" onClick={On} disabled={at.length<2||me}
                            className="flex items-center justify-center shrink-0 rounded-sm p-1 transition-colors
                                       [hover:bg-white/[0.12]]">{ige size-4 text-white/40}</button>
                       尾帧槽：同首帧（tooltip `common.lastFrame`，onClick `nt("last")`）
                     </div>
                   图标真值（**全部取自官方真机 outerHTML**，非猜）：
                     · `Qd`（首/尾帧槽）= **lucide `plus`**：`<path d="M5 12h14"/><path d="M12 5v14"/>`
                       （`class="lucide lucide-plus size-4 transition-colors text-white/60"`，24 viewBox）
                     · `ige`（⇄）= 自绘 16 viewBox `class="size-4 text-white/40"`
                       `<path d="M10.5 2.84998L13 5.34998H3M5.5 13.1L3 10.6L13 10.6" stroke-linecap="round" stroke-linejoin="round"/>`
                   ⚠️ 与参数面板里的「参考帧/参考角色」两组**分开**：那两组按用户早前裁决保持关闭
                      （`SHOW_MTV_REFERENCE_PICKERS=false`），这里恢复的是**输入栏那一行**。 */}
              {generateMethod === 'frames' && onChangeVideoReferences && (
                <div className="flex items-center gap-1" data-testid="prompt-frame-row">
                  {(['first_frame', 'last_frame'] as const).map((slot, slotIndex) => {
                    /* 官方按**位置**取帧：槽 0 = `at[0]`（首帧）、槽 1 = `at[1]`（尾帧） */
                    const ref = frameRefs[slotIndex];
                    return (
                      <span key={slot} className="contents">
                        {slotIndex === 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              /* ══ 官方 `On`（`vendor-pkg-canvas-*.js` @2054966 逐字）══
                                   `at.length>=2&&(ie(at[0].nodeId),se(null))`
                                 配套效果（同文件 @2041103 逐字）：
                                   `if(at.findIndex(Bt=>Bt.nodeId===fe)===0){const Bt=setTimeout(()=>{re("image",[1,0]),ie(null)},50);…}`
                                 净效果 = **交换两帧的顺序**（`re("image",[1,0])` 把两条边的 `data.order` 0↔1 对调）。
                                 官方那个 50ms 两跳是它把首/尾存成边序的实现痕迹（中间态会闪一下），
                                 这里直接交换到位，**终态一致**、且不留中间闪烁。
                                 `swapFrameOrder` 连**数组位置**一起换、并按位置重派生 role ——
                                 槽位是按位置取帧的，不能只换 role（见 `utils/videoFrames.ts`）。 */
                              const next = swapFrameOrder(videoReferences);
                              onChangeVideoReferences(next);
                            }}
                            disabled={frameSlotCount < 2}
                            className="flex items-center justify-center shrink-0 rounded-sm p-1 transition-colors hover:bg-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label={t('交换首尾帧')}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="size-4 text-white/40" aria-hidden="true">
                              <path d="M10.5 2.84998L13 5.34998H3M5.5 13.1L3 10.6L13 10.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                        {ref ? (
                          <div className="relative group/frame shrink-0">
                            <img src={ref.url} alt={slot === 'first_frame' ? 'firstFrame' : 'lastFrame'} className="size-[38px] object-cover rounded-[10px] border border-white/10" />
                            <button
                              type="button"
                              onClick={() => onChangeVideoReferences((videoReferences ?? []).filter((r) => r !== ref))}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-black rounded-full flex items-center justify-center opacity-0 group-hover/frame:opacity-100 transition-opacity"
                              aria-label={t('移除')}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={frameSlotCount >= 2}
                            onClick={() => onRequestFrameSlot?.(slotIndex === 0 ? 'first' : 'last')}
                            className="size-[38px] flex items-center justify-center rounded-[10px] shrink-0 transition-all focus:outline-none bg-white/[0.08] hover:bg-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label={t(slotIndex === 0 ? '首帧' : '尾帧')}
                            data-tooltip={t(slotIndex === 0 ? '首帧' : '尾帧')}
                            data-tooltip-pos="top"
                            data-tooltip-offset="8"
                            data-tooltip-delay="200"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus size-4 transition-colors text-white/60" aria-hidden="true">
                              <path d="M5 12h14" />
                              <path d="M12 5v14" />
                            </svg>
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
              {/* chips 区（图片→视频→音频→文本）+ 加号，都在 `gx` 里 —— 官方 `Se` 分支下**不渲染** */}
              {generateMethod !== 'frames' && nodeId && <UpstreamReferenceChips nodeId={nodeId} onInsertMention={onInsertReferenceMention} />}
              {generateMethod !== 'frames' && (
              <button
                type="button"
                className="prompt-ref-add"
                data-tooltip={t('参考')}
                data-tooltip-pos="top"
                /* 官方加号也是 `Nn` 封装（`gx` 里 `l.jsx(Nn,{content:m,children:<button…>})`）⇒ 8 / 200 */
                data-tooltip-offset="8"
                data-tooltip-delay="200"
                aria-label={t('参考')}
                aria-pressed={referencePick}
                onClick={() => {
                  if (!nodeId) return;
                  /* 官方按**源卡类型**分类（图像/视频/音频/文本卡各一套白名单）——
                     见 `store.nodeSelection.ts` 的 `referencePickProfileFor`。 */
                  toggleReferencePick(nodeId, t('从画布选择参考'), { originType: nodeType });
                }}
              >
                <OfficialIcon name="reference-plus" size={16} />
              </button>
              )}
              {/* 官方计数标签紧跟在 `gx` 之后（不是右对齐） */}
              {referenceImageCount > 0 && (
                <span
                  className="prompt-ref-count"
                  aria-live="polite"
                  data-testid="connected-reference-count"
                >
                  {t('参考图 {count} 张', { count: referenceImageCount })}
                </span>
              )}
            </div>
          </div>
          {/* 官方右槽 `shrink-0 self-start mt-px`：只在 `Be = isOverflowing || isCollapsed`
              时出这个「放大/缩小」钮（`Oe`，tooltip `common.maximize`=「放大」/`common.minimize`=「缩小」）。
              ⇒ 正常态（提示词没溢出、也没折叠）**不渲染**（官方截图里就是空的 ✓）。
              ★ 按钮的显示/点击**只跟 `promptCollapsed` 有关**，与高级设置面板的 `isExpanded` 无关；
              图标用官方那对 lucide（`kU`/`IU`，16px 描边）：折叠态 `maximize-2`、展开态 `minimize-2`。
              文案取官方 i18n 的**中文**值（`index-BiTZf8mJ.js` @9120449）：
              `common.maximize: "放大"` / `common.minimize: "缩小"`（`最大化/最小化` 那是 ja-JP 那套）。
              ⚠️ MTV 的 i18n 以**中文原文当 key**，`'放大'`/`'缩小'` 同时被画布缩放占用
              （en-US 映射成 Zoom in / Zoom out）⇒ 英文界面下这两条会串；中文与官方一致。 */}
          {nodeType !== 'ai-text' && (promptOverflowing || promptCollapsed) && (
            <div className="prompt-header-right">
              <button
                type="button"
                className="prompt-maximize-btn"
                data-tooltip={t(promptCollapsed ? '放大' : '缩小')}
                data-tooltip-pos="top"
                /* 官方 `fx` 右槽的 `Oe` 也是 `Nn` 封装 ⇒ 8 / 200 */
                data-tooltip-offset="8"
                data-tooltip-delay="200"
                aria-label={t(promptCollapsed ? '放大' : '缩小')}
                aria-pressed={promptCollapsed}
                onClick={(event) => {
                  event.stopPropagation();
                  setPromptCollapsed((current) => !current);
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {promptCollapsed ? (
                    /* lucide `maximize-2`（官方 `kU`）—— 箭头朝外 = 放大 */
                    <>
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </>
                  ) : (
                    /* lucide `minimize-2`（官方 `IU`）—— 箭头朝内 = 缩小 */

                    <>
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
      <div
        className="prompt-input-wrap"
        ref={promptInputRef}
        /* 官方 `isCollapsed` ⇒ 编辑器的 maxHeight 由 400 收到 80（`TiptapInput` 的 style） */
        data-prompt-collapsed={promptCollapsed ? 'true' : 'false'}
      >
        {/* ══ 官方 `nodes.promptPlaceholder`：**键帽式**占位浮层 ══
            官方出处：`zoom-slider-3ZcFvYQO.js` @**1721577**（提示词栏的占位渲染）
            ```jsx
            <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex h-6 items-center gap-1 px-3
                            text-sm leading-6 text-muted-foreground">
              <span>{t("nodes.promptPlaceholder.prefix")}</span>
              <kbd className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] font-sans text-xs
                              text-muted-foreground outline-1 -outline-offset-1 outline-white/10">@</kbd>
              <span>{t("nodes.promptPlaceholder.atLabel")}</span>
              <kbd className="…">/</kbd>
              <span>{t("nodes.promptPlaceholder.slashLabel")}</span>
            </div>
            ```
            官方 i18n：`prefix:"描述任何你想要生成的内容，按"` / `atLabel:"引用素材，"` / `slashLabel:"呼出指令"`
            并且官方把编辑器的 `placeholder` 属性设成 **空串**（占位完全由这个浮层负责）——
            MTV 原来只用 `data-placeholder` 的纯文本伪元素 ⇒ 少了 @ / 两个键帽 ✗（用户 图3 对比） */}
        {useKeycapPlaceholder && (
          <div
            className="prompt-keycap-placeholder pointer-events-none absolute left-0 right-0 top-0 z-10 flex h-6 items-center gap-1 px-3 text-sm leading-6"
            aria-hidden="true"
            data-testid="prompt-keycap-placeholder"
          >
            <span>{t('描述任何你想要生成的内容，按')}</span>
            <kbd className="prompt-keycap">@</kbd>
            <span>{t('引用素材，')}</span>
            <kbd className="prompt-keycap">/</kbd>
            <span>{t('呼出指令')}</span>
          </div>
        )}
        <MentionEditor
          ref={editorRef}
          value={prompt}
          onChange={onChange}
          onSubmit={handleSingleSubmit}
          /* 键帽浮层接管占位时，编辑器的 placeholder 传空串（照官方） */
          placeholder={useKeycapPlaceholder ? '' : effectivePlaceholder}
          nodeId={nodeId}
          selectedWorkflowId={selectedWorkflowId}
          canSubmit={canGenerate}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            queueMicrotask(() => onContinuousEditEnd?.());
          }}
          onSlashTrigger={handleEditorSlash}
        />
      </div>
      {/* ══ 官方 `fx` 的高级设置面板（`zoom-slider` @1691831 逐字）══
            <div className={Z("nodrag overflow-hidden transition-all duration-300", isExpanded?"max-h-96":"max-h-0")}
                 data-testid={un.CANVAS.NODE.GENERATION_INPUT_BAR.ADVANCED_SETTINGS_PANEL}>
              <div className="p-4 bg-muted/30">{advancedSettings}</div>
            </div>
            开关在 `mx` 左组末尾（`un.…ADVANCED_SETTINGS_TOGGLE`，图标 = lucide `settings-2`，
            tooltip `common.advancedSettings`=「高级设置」）；`--muted`（官方 dark）= #2b2b2b ⇒ `bg-muted/30`。
          ⚠️ MTV 原来是自己 4 个 `<details className="ui-card m-2">`（自造 ✗）⇒ 已换成官方这个可折叠面板。 */}
      {/* ★ P1 **确认前**的分组门劝告（MTV 增强）：
          渲染在发送按钮**之前**、且**不阻断发送** —— 判不出就整块不渲染。
          ⚠️ 必须在这里（`onSubmit` 之外）：`AINodeDialog.handleGenerate` 在分派前就把节点
             置成 `loading`，任何放在 `onSubmit` 里的劝告都已经晚于「确认」了。 */}
      <ModelEntitlementNotice
        nodeType={nodeType}
        provider={selectedProvider}
        model={selectedModel}
        onSelectSuggestion={onModelSelect}
      />
      <div className="prompt-footer">
        {/* 官方 `mx` 底行 = **两组**：
              <div className="flex items-center justify-between w-full p-2 h-14">
                <div className="flex items-center gap-1 min-w-0">{左组：模型/比例/风格/摄影机…}</div>
                <div className="flex items-center gap-1">{麦克风位(MTV=提示词按钮) + ml-2 gap-1 的 [1×][发送]}</div>
              </div>
            MTV 原来是「平铺 + CSS `order` 补丁 + gap 8」✗ ⇒ 与官方结构不同、间距也不对
            ⇒ 这里按官方改成真正的左右两组（样式见 prompt.css 的 .prompt-footer-left / .prompt-actions） */}
        <div className="prompt-footer-left">
        <ModelSelector
          nodeType={nodeType}
          selectedModel={selectedModel}
          selectedProvider={selectedProvider}
          selectedWorkflowId={selectedWorkflowId}
          onSelect={onModelSelect}
          onWorkflowSelect={onWorkflowSelect}
          workflows={workflows}
        />

        {/* 官方底行左组 = `flex items-center gap-1 min-w-0`，组内每两项之间是**真实的分隔元素**
            `w-px h-4 bg-border`（`Rnt` children = [modelSelector, <div className="w-px h-4 bg-border"/>, TO]，
            `TO` 内部再依次排出 比例 | 风格 | 摄像机 —— 官方截图里那三条竖线就是它们）。
            ⚠️ MTV 原来用容器 `gap:9px` 假装（没有真正的线）✗ ⇒ 现在改成官方结构：gap 4 + 真分隔线。 */}
        {(nodeType === 'ai-image' || nodeType === 'ai-panorama' || nodeType === 'ai-video') && (
          <span className="prompt-footer-sep prompt-footer-sep--model" aria-hidden="true" />
        )}

        {referenceInputId && onWorkflowInputsChange ? (
          <CharacterVoiceSelector
            key={`${nodeId}:${selectedWorkflowId}:${isGenerating}`}
            choices={voiceChoices}
            value={selectedReference}
            disabled={isGenerating}
            onChange={selectCharacterVoice}
            onPlaybackError={() => showToast(t('声音试听失败，请检查音频文件是否可用'), 'error')}
          />
        ) : null}

        {nodeType === 'ai-animation' && onAnimationActionChange && (
          <>
            <div className="animation-action-picker" role="group" aria-label={t('动画动作')}>
              {ANIMATION_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  className={`animation-pose-btn${animationAction === action ? ' active' : ''}`}
                  data-tooltip={t(ANIMATION_ACTION_LABELS[action])}
                  aria-label={t(ANIMATION_ACTION_LABELS[action])}
                  aria-pressed={animationAction === action}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAnimationActionChange(action);
                  }}
                >
                  <AnimationPoseIcon action={action} />
                </button>
              ))}
            </div>
            <Select fixedMenu
              className="min-w-0 shrink-0"
              size="sm"
              value={animationFrames}
              aria-label={t('生成帧数')}
              onChange={(selectedOptionValue) => {
                onAnimationFramesChange?.(Number(selectedOptionValue));
              }}
            >
              {[6, 8, 10, 12, 16, 20].map((count) => (
                <option key={count} value={count}>{t('{count} 帧', { count })}</option>
              ))}
            </Select>
          </>
        )}

        {/* ★★★ 「风格」chip —— 官方**只在 Pixverse / Vidu 系模型上**才有这颗键。
            官方逐字证据（`vendor-pkg-canvas-CvbAwZyy.js`）：
              · 键名是 **`videoModels.pixverseStyleLabel`**（Pixverse 系）/
                **`videoModels.viduStyleLabel`**（Vidu 系），**不是** `videoConfigs.*`；
                非 locale 消费点全库只有 3 处：`videoModels.pixverseStyleLabel` @2000627 / @2002232、
                `videoModels.viduStyleLabel` @2003890。
              · 形态是**按模型注册的参数区里的一行**（逐字）：
                ```jsx
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{t("videoModels.pixverseStyleLabel")}</span>
                    <Tooltip tooltip={t("videoModels.pixverseStyleDesc")} side="top">…</Tooltip>
                  </div>
                  <Select disabled={n} value={r} onValueChange={c} className="w-32 h-8">…</Select>
                </div>
                ```
                档位逐字：Pixverse `["auto","anime","3d_animation","clay","comic","cyberpunk"]`；
                Vidu `["general","anime"]`。
              · 官方**参数弹窗**（那颗 `aria-haspopup="dialog"` 的 chip 打开的面板，@1878881 邻域）
                里逐字只有 `videoConfigs.mode`(生成模式) / `videoConfigs.aspectRatio`(比例) /
                `videoConfigs.resolution`(清晰度) / `videoConfigs.duration`(生成时长) /
                `videoModels.generateAudioLabel`(生成音频) —— **没有风格**。
              · 官方真机实测（9222，Seedance 2.0 那张卡）：底部条 9 颗键里没有风格，参数弹窗里也没有。
            ⇒ 官方在这批**通用视频模型**上不存在这颗键 ⇒ **视频节点不渲染它**（不是「等价替代」，
              是「官方没有 ⇒ 不渲染」）。
            ⚠️ MTV 这批通用视频模型也**没有**该能力数据源（模型目录 / 连接配置 / 工作流声明里
              都没有 `pixverseStyle*` / `viduStyle*` 这类能力键）⇒ **无法数据门控**，
              只能按「官方没有 ⇒ 不渲染」在节点类型这一层收窄。
            ⚠️ 那颗 `prompt-footer-sep--ratio` 是给风格键配的分隔符（见 styles/prompt.css 的
              order 表：… ui-schema-renderer(3) · sep--ratio(4) · style-selector-btn(5) …）
              ⇒ 视频节点不渲染风格键时**一并去掉这颗分隔符**，不留孤立分隔线。
            ⚠️ 只收窄 `ai-video`；`ai-image` / `ai-panorama` 的官方门控**尚未取证**，先不动。
            ⚠️ `data.style` 的另一条消费者（**登记，不动**）：`services/projectSettingsService.ts:271-285`
              的 `composePromptWithProjectStyle` 仍把 `ai-video` 算进 `supportsVisualStyle`，
              取值 `data.style || projectStyle?.styleId` ⇒ 视频节点上这颗 chip 撤掉后，
              `data.style` 不会再由这个 UI 写入，**但项目级 `visualStyle` 仍然会拼进视频提示词**
              （不是「恒为空的请求字段」：`generateVideo.ts` / `videoRequestResolver.ts` 里
              **没有任何** `style` 字段 —— 已 grep 确认）。是否保留「视频节点吃项目级画风」
              是另一件事，本次只登记、不改。 */}
        {(nodeType === 'ai-image' || nodeType === 'ai-panorama') && (
          <>
            <span className="prompt-footer-sep prompt-footer-sep--ratio" aria-hidden="true" />
            <StyleSelector
              nodeType={nodeType}
              selectedStyle={selectedStyle}
              /* 风格名/封面由 `StyleSelector` 自己从内置+自定义风格表解析（= 官方 `tnt` 的
                 `selectedStyleName` / `selectedStyleCover` 语义），这里不用额外传 */
              onChange={onStyleChange}
            />
          </>
        )}

        {/* ★★★★★ 摄影机控制：**官方是逐模型给的** —— 只有那 7 个模型才出现这个按钮 ✓
            （官方挂载条件 `zoom-slider-3ZcFvYQO.js` @3211385，展开见 `CAMERA_OFFICIAL_MODELS`）
            ⇒ 这里同样按「归一化到官方真实 id 后是否在白名单里」判 ⇒ flux / midjourney /
              seedream / imagen / grok 这些**都不会**出现（与官方一致 ✓） */}
        {(nodeType === 'ai-image' || nodeType === 'ai-video')
          && onChangeCameraSettings
          /* ⚠️ 必须带上自定义连接的**上游 modelId / 可读名**当候选（`general/provider-custom-…`
             这种 value 里没有官方模型名 ✗）—— 与 `modelAliases` 同一套归一化，别只传 value。
             实测：`去脏去噪工作流` 的图卡全走自定义连接，只传 value ⇒ 一个都判不出来 ✗ */
          && cameraControlAllowedFor([selectedModel, generalModelConfig?.modelId, generalModelConfig?.name]) && (
          <>
            <span className="prompt-footer-sep prompt-footer-sep--style" aria-hidden="true" />
            <CameraControl value={cameraSettings} onChange={onChangeCameraSettings} />
          </>
        )}

        {nodeType === 'ai-image' && !runninghubWorkflow && !runninghubModel && !workflowApi && (
          <QualityRatioSelector
            imageSize={imageSize}
            aspectRatio={aspectRatio}
            onChangeImageSize={onChangeImageSize || (() => {})}
            onChangeAspectRatio={onChangeAspectRatio || (() => {})}
            /* ★★★ **传当前模型** ✓✓ → 组件按【官方模型能力表】派生比例与画质 ✓
               （官方同一个弹窗在不同模型下项数不同：7 / 9 / 11 项 · 含 "Auto" ✓ 实测过 ✓
                 MTV 原来固定 10 项 ✗ —— 现在按官方表 ✓ 数据来自 EXE ✓）*/
            model={selectedModel}
            modelAliases={modelAliases}
            /* ★★★★★ **「精细度」组接线** ✓✓（官方弹窗第三组 ✓ 实测 ✓）
               EXE: `options.qualityOptions: ["low","medium","high"]` ✓ · `defaults.quality` ✓
               官方实测：默认选中 **「低」（low）** ✓ · 三格 97×32 ✓
               ★ 用户 2026：「界面显示低，但请求里其实没有 quality」——
                 显示默认值也走**该模型自己的默认档**（`defaultQualityForModel` ✓ 官方表 `defaultQuality` ✓），
                 与出站 `resolveOutgoingImageQuality` 的兜底**同一个来源** ⇒ 显示什么就发什么 ✓ */
            quality={quality ?? defaultQualityForModel(selectedModel) ?? undefined}
            onChangeQuality={onChangeQuality}
            qualityOptions={qualityOptions}
            showQuality={showQuality ?? true}
            /* 官方第 4 组「透明背景」✓（值与回调都从节点数据来 ✓）*/
            transparentBackground={transparentBackground}
            onChangeTransparentBackground={onChangeTransparentBackground}
            imageSizes={dreaminaImageModel?.resolutions}
            showAdaptive={!dreaminaImageModel}
            ratios={dreaminaImageModel
              ? DREAMINA_IMAGE_RATIOS.map((value) => ({
                value,
                className: IMAGE_RATIO_CLASS_NAMES[value],
              }))
              : undefined}
            /* 渠道档位限制（土豆异步免费池：4K / 高质量档置灰，当前值自动收敛到 2K / medium）*/
            disabledImageSizes={channelLimits?.disabledImageSizes}
            disabledQualities={channelLimits?.disabledQualities}
            fallbackImageSize={channelLimits?.fallbackImageSize}
            fallbackQuality={channelLimits?.fallbackQuality}
            channelLimitReason={channelLimits?.reason}
          />
        )}

        {nodeType === 'ai-panorama' && (
          <QualityRatioSelector
            imageSize={imageSize}
            aspectRatio={aspectRatio}
            onChangeImageSize={onChangeImageSize || (() => {})}
            onChangeAspectRatio={onChangeAspectRatio || (() => {})}
            showAdaptive={false}
            ratios={[
              { value: '2:1', className: 'img-rp-pano' },
              { value: '21:9', className: 'img-rp-ultra' },
            ]}
          />
        )}

        {nodeType === 'ai-video' && !runninghubWorkflow && !runninghubModel && workflowApi?.workflowApi?.version !== 2 && (
          <VideoParamSelector
            provider={selectedProvider}
            selectedModel={selectedModel}
            nodeId={nodeId}
            /* §69：官方 `VideoConfigsPanel`（`Roe`）的生成方式三件套 —— 官方把生成方式写在节点数据的
              `params.modelType`（`zt` 枚举字符串）/ `params.variant` 上，由 `AINodeDialog` 读写；
              官方口径：`generateMethod` 为空 ⇒ chip 不 push 这一段（`Poe` `r&&x.push(r)`），
              弹窗里那颗「生成方式」也在 `b` 为空时不渲染（`Roe` `M=b&&_&&_.length>0&&v`）。 */
            generateMethod={generateMethod}
            availableGenerateMethods={availableGenerateMethods}
            onGenerateMethodChange={onGenerateMethodChange}
            videoModelType={videoModelType}
            videoReferences={videoReferences}
            onChangeVideoReferences={onChangeVideoReferences}
            videoResolution={videoResolution}
            videoFps={videoFps}
            videoFrames={videoFrames}
            onChangeResolution={onChangeVideoResolution || (() => {})}
            onChangeFps={onChangeVideoFps || (() => {})}
            seedanceResolution={seedanceResolution}
            seedanceRatio={seedanceRatio}
            seedanceDuration={seedanceDuration}
            generateAudio={generateAudio}
            onChangeSeedanceResolution={onChangeSeedanceResolution}
            onChangeSeedanceRatio={onChangeSeedanceRatio}
            onChangeSeedanceDuration={onChangeSeedanceDuration}
            onChangeGenerateAudio={onChangeGenerateAudio}
            onContinuousEditEnd={onContinuousEditEnd}
          />
        )}

        {nodeType === 'ai-audio' && !runninghubWorkflow && !runninghubModel && !workflowApi && (
          <AudioParamSelector
            purpose={speechControls ? 'speech' : audioPurpose}
            speechControls={speechControls}
            speechSettings={audioSpeechSettings}
            references={audioReferences}
            onChangeSpeechSettings={onChangeAudioSpeechSettings}
            onAddReference={addAudioReference}
            onRemoveReference={onRemoveAudioReference}
            voice={audioVoice}
            format={audioFormat}
            speed={audioSpeed}
            musicTitle={musicTitle}
            musicLyrics={musicLyrics}
            musicBpm={musicBpm}
            musicDuration={musicDuration}
            autoGenerateLyrics={autoGenerateLyrics}
            onChangeVoice={onChangeAudioVoice}
            onChangeFormat={onChangeAudioFormat}
            onChangeSpeed={onChangeAudioSpeed}
            onChangeMusicTitle={onChangeMusicTitle}
            onChangeMusicLyrics={onChangeMusicLyrics}
            onChangeMusicBpm={onChangeMusicBpm}
            onChangeMusicDuration={onChangeMusicDuration}
            onChangeAutoGenerateLyrics={onChangeAutoGenerateLyrics}
            onContinuousEditEnd={onContinuousEditEnd}
          />
        )}

        {/* 官方 `mx` 左组末尾的「高级设置」开关（@1694351 逐字）：
              {hasAdvancedSettings && <>
                 <div className="w-px h-4 bg-border" />
                 <Tooltip content={t("common.advancedSettings")}>
                   <button type="button" onClick={toggle}
                     className="flex items-center justify-center rounded-lg px-2.5 py-2.5 transition-colors hover:bg-muted active:bg-white/[0.1]"
                     data-testid={un.CANVAS.NODE.GENERATION_INPUT_BAR.ADVANCED_SETTINGS_TOGGLE}>
                     <settings-2 className="h-4 w-4 text-foreground" />
                   </button>
                 </Tooltip>
               </>}
            图标 = 官方 lucide `settings-2`（`$2e=F("settings-2",…)`，两 rect + 两 line，24 viewBox）；
            文案 `common.advancedSettings`（zh「高级设置」）/`minimize`（zh「缩小」）。 */}
        {hasAdvancedSettings && (
          <>
            <span className="prompt-footer-sep" aria-hidden="true" />
            <button
              type="button"
              className="prompt-advanced-toggle"
              data-testid="official-advanced-settings-toggle"
              data-tooltip={advancedOpen ? t('缩小') : t('高级设置')}
              data-tooltip-pos="top"
              /* 官方 `mx` 的高级设置开关同样走 `Nn` 封装 ⇒ sideOffset 8 / delay 200 */
              data-tooltip-offset="8"
              data-tooltip-delay="200"
              aria-label={t('高级设置')}
              aria-pressed={advancedOpen}
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                className="lucide lucide-settings2 lucide-settings-2 h-4 w-4 text-foreground" aria-hidden="true">
                {/* §125 官方 `Q$`（= `F("settings-2",…)`）的**逐字图标**。
                    官方真机（9222 面板同开时）outerHTML：
                      `<svg xmlns=… width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                            class="lucide lucide-settings2 lucide-settings-2 h-4 w-4 text-foreground" aria-hidden="true">
                         <path d="M20 7h-9"></path><path d="M14 17H5"></path>
                         <circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>`
                      computed：`width/height 16px` · `stroke rgb(245,245,245)` · `stroke-width 2px`
                    ⚠️ MTV 原来画的是**另一颗图标**（两 rect + 两点 ⇒ `lucide rows` 那一类），
                      真机实测全页 `settings-2` 命中 **0**（官方为 1）⇒ 用户「高级设置的图标不对」。 */}
                <path d="M20 7h-9" />
                <path d="M14 17H5" />
                <circle cx="17" cy="17" r="3" />
                <circle cx="7" cy="7" r="3" />
              </svg>
            </button>
          </>
        )}
        </div>
        {/* 右组 —— 逐字按官方结构（官方 dump）：
              div[183×35] "flex items-center gap-1"
                ├ div[32×32]  "relative z-20 inline-flex shrink-0"   ← 麦克风位（MTV→提示词）
                └ div[134×35] "relative z-20 flex shrink-0 items-center **ml-2** gap-1"
                     ├ button[39×32] «1×»
                     └ div[91×35]    «发送胶囊»
            ⚠️ MTV 原来把提示词按钮放在 `.prompt-actions` **内部** ✗，与官方结构不同
               （官方麦克风是这个容器**外面**的兄弟）；而且 [1×][胶囊] 那层少了 ml-2(8px) ✗。 */}
        <div className="prompt-actions">
          {/* 提示词（预设）— 官方底行该位置是麦克风；MTV 没有语音输入，这里放自家的预设提示词功能 */}
          {(nodeType === 'ai-image' || nodeType === 'ai-text') && (
            <button
              ref={slashBtnRef}
              type="button"
              className={`prompt-btn prompt-slash-btn${slashOpen ? ' slash-active' : ''}`}
              data-tooltip={t('提示词')}
              aria-label={t('提示词')}
              onClick={handleButtonSlash}
            >
        {/* ★「提示词」按钮图标 —— 换成**用户提供的 SVG** ✓
             （18×18 · viewBox "0 0 18 18" · 铅笔 + 星火 · stroke=currentColor · sw 1.125 ✓）
             原来是自绘的「一个大星 + 一个小星」✗
             图标文件：src/assets/official-icons/prompt/prompt-edit.svg ✓ */}
        <OfficialIcon name="prompt-edit" size={16} />
            </button>
          )}
          {/* ⚠️ MTV 自有的两颗（调试 API 参数 = 扳手、直接输出（跳过模型调用）= 上箭头）**已按用户要求删除**：
               官方 `mx` 里 mic 那一格只有**一颗**按钮（MTV 用提示词按钮占这一格 ✓），
               这两颗既不是官方的、又紧挨在提示词按钮右边（上箭头看起来就是"多出来的发送按钮"）✗ */}
          {/* 官方结构：`[1×][胶囊]` 包在一个带 **ml-2(8px) gap-1** 的内层容器里，
              它与「麦克风位（MTV→提示词）」是**兄弟**（都在外层 gap-1 里）。 */}
          <div className="prompt-actions-inner">
          {isGenerating && onCancelGeneration ? (
            <div className="prompt-submit-wrap">
              <button
                type="button"
                className="prompt-btn prompt-stop-btn"
                data-tooltip={selectedProvider === 'workflow-api' ? t('停止等待') : t('终止 ComfyUI 任务')}
                aria-label={selectedProvider === 'workflow-api' ? t('停止等待') : t('终止 ComfyUI 任务')}
                onClick={(event) => {
                  event.stopPropagation();
                  onCancelGeneration();
                }}
              >
                {!performanceMode && (
                  <span className="prompt-stop-orb" aria-hidden="true">
                    <Suspense fallback={null}>
                      <ThinkingOrb state="composing" size={20} />
                    </Suspense>
                  </span>
                )}
                <svg className="prompt-stop-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              {/* 官方底行把「生成数量」摆在明面上（发送左边一个 `1×` 按钮），
                  而且它在**发送胶囊外面**（官方右组 = 麦克风 32 + 1× 39 + 胶囊 91）。
                  ⚠️ 不能塞进 .prompt-submit-wrap（固定 26×26 的盒子，会把发送挤出去），
                     也不能塞进 .prompt-send-pill（那是 91 宽的胶囊，只装 logo+数字+发送）。 */}
              {batchSupported && (
                /* 官方 `TimesSelector` 的 popover 锚在**触发钮**上（`PopoverTrigger asChild`）
                   ⇒ 弹层必须是触发钮的兄弟。MTV 没有 radix，这里只用 Tailwind 工具类还原官方定位：
                   `side="top"` → `bottom-full`、`align="center"` → `left-1/2 -translate-x-1/2`、
                   `sideOffset={8}` → `mb-2`（8px）。**不再引入任何 MTV 自有类**。 */
                <div className="relative">
                <button
                  type="button"
                  /* ★ 官方 `TimesSelector` 触发钮 className **逐字**（`course-api-base-url-CGXqZmAy.js` @1709387）：
                     `Q("flex items-center gap-1 px-3 py-1.5 rounded-lg","text-sm font-medium text-foreground",
                        "transition-all active:bg-white/[0.1]", open ? "bg-white/[0.1]" : "hover:bg-muted",
                        "disabled:opacity-50 disabled:cursor-not-allowed")`
                     ⚠️ 原来用的是 MTV 自有的 `.prompt-footer-batch` ⇒ 已按官方替换（用户：MTV 的一点不要）。 */
                  className={[
                    'flex items-center gap-1 px-3 py-1.5 rounded-lg',
                    'text-sm font-medium text-foreground',
                    'transition-all active:bg-white/[0.1]',
                    batchMenuOpen ? 'bg-white/[0.1]' : 'hover:bg-muted',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  ].join(' ')}
                  data-tooltip={t('生成数量')}
                  data-tooltip-pos="top"
                  /* 官方次数 `Wq` 外面也是 `Nn`（`l.jsx(Nn,{content:t("nodeDetail.generationCount")})`）⇒ 8 / 200 */
                  data-tooltip-offset="8"
                  data-tooltip-delay="200"
                  /* 官方 `Wq` 的 aria-label 逐字：`Generate ${times * batchSize} variations`
                     （文本卡 batchSize=1 ⇒ 就是 times）*/
                  aria-label={textTimesControl
                    ? t('生成数量：{count} 个变体', { count: batchCount })
                    : t('生成数量：{count} 张', { count: batchCount })}
                  aria-haspopup="menu"
                  aria-expanded={batchMenuOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!canGenerate || !hasGenerationInput) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    setBatchAnchor({ left: rect.left + rect.width / 2, top: rect.top - 8 });
                    setBatchMenuOpen((current) => !current);
                  }}
                >
                  {batchCount}×
                </button>
                {/* ★★ 官方 `PopoverContent` **逐字**：
                     `side="top" align="center" sideOffset={8}` → `bottom-full left-1/2 mb-2 -translate-x-1/2`
                     radix 是**条件挂载**（open 才渲染）⇒ 这里同样 `batchMenuOpen &&`，不做 CSS 显隐动画。
                     内层 div = 官方 className 逐字：
                       `p-1.5 bg-popover/95 backdrop-blur-sm rounded-xl border border-border shadow-2xl flex flex-col gap-1`
                     每项 = 官方 className 逐字：
                       `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors`
                       + 选中 `bg-popover-foreground/10 text-foreground`
                       + 未选 `text-muted-foreground hover:bg-secondary/50 hover:text-foreground`
                     ⚠️ MTV 无 radix，官方那层 `w-auto p-0 bg-transparent border-none shadow-none` 的定位外壳
                        在这里由上面的绝对定位工具类承担；**没有引入任何 MTV 自有类**。 */}
                {batchMenuOpen && batchAnchor && createPortal(
                  <div
                    className="fixed z-[100] -translate-x-1/2 -translate-y-full"
                    style={{ left: batchAnchor.left, top: batchAnchor.top }}
                    data-batch-menu=""
                    role="menu"
                    aria-label={t('选择批量生成数量')}
                  >
                    <div className="p-1.5 bg-popover/95 backdrop-blur-sm rounded-xl border border-border shadow-2xl flex flex-col gap-1">
                      {[...(textTimesControl ? TEXT_BATCH_COUNTS : IMAGE_BATCH_COUNTS)].reverse().map((count) => (
                        <button
                          key={count}
                          type="button"
                          role="menuitem"
                          className={[
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                            batchCount === count
                              ? 'bg-popover-foreground/10 text-foreground'
                              : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                          ].join(' ')}
                          aria-label={textTimesControl
                            ? t('生成 {count} 个变体', { count })
                            : t('生成 {count} 张图片', { count })}
                          title={textTimesControl
                            ? t('生成 {count} 个变体', { count })
                            : count >= 4 ? t('生成 {count} 张，费用可能按张计算', { count }) : t('生成 {count} 张', { count })}
                          onClick={handleBatchSelect(count)}
                        >
                          {count}×
                        </button>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
                </div>
              )}
              <div className="prompt-send-pill">
              {/* ★ 生成前的「预计花费（积分）」—— 对齐官方「预计花费约 X Tapies」那个位置。
                  纯本地预估：查连接**公开**的价目表按 模型+精细度+分辨率 算（不硬编码），
                  查不到就不渲染。口径见 `services/ai/creditEstimate.ts`（1 积分 = ¥0.01）。
                  ⚠️ **§119 更正**：本条注释原文写的是「MTV **没有**计费体系/无数据源」—— **错**。
                  用户 2026-10-15 纠正：「我们不是有积分体系和计费体系吗？目前匹配的是土豆」。
                  MTV 的计费链在本仓是完整的：`services/ai/creditEstimate.ts`（价目表 `model_price` →
                  兜底单价 → 手动覆盖；`CREDITS_PER_PRICE_UNIT = 100` ⇒ 1 积分 = ¥0.01）·
                  `services/ai/creditBalance.ts`（厂商余额 → 积分）· `useCreditBalance`（顶栏积分按钮）·
                  `types/index.ts` 的 `ProviderBillingConfig{creditsPerUnit, modelOverrides, fallbackUnitPrice,
                  priceSource, priceEndpoint, balancePath, balanceToken, balanceAmountPath…}`。
                  ⇒ 价格段就应当**用它**；**拿不到**（连接未配价目表 / `billing.enabled === false` /
                  换算失败）时按既有口径**不渲染/显示 `-`**，但**不许再说「MTV 无计费体系」**。
                  §119 同时把视频卡也接上（官方 `w4e` 的 `estimatedPriceDisplay`/`showPrice = generationPolicy?.creditsVisible !== false`
                  对视频同样生效；MTV 视频分支原来只传了 imageSize/quality 两个图卡字段 ⇒ 被门挡在外面）。 */}
              {(nodeType === 'ai-image' || nodeType === 'ai-video') && (
                <CreditEstimateBadge
                  provider={selectedProvider}
                  model={selectedModel}
                  /* 视频卡没有 imageSize/quality ⇒ 把**清晰度档**当 resolution 传（`estimateWithBilling`
                     的 `resolution` 是通用字段），`quality` 留空；`count` = 数量选择器那颗 `N×`。 */
                  imageSize={nodeType === 'ai-video' ? seedanceResolution : imageSize}
                  quality={nodeType === 'ai-video' ? undefined : quality}
                  count={batchCount}
                />
              )}
              <div
                ref={batchTriggerRef}
                className="prompt-submit-wrap"
              >
              <button
                type="button"
                className={`prompt-btn prompt-submit-btn${isGenerating ? ' is-generating' : ''} ${!canGenerate || !hasGenerationInput ? 'disabled' : ''}`}
                disabled={!canGenerate || !hasGenerationInput}
                aria-haspopup={batchSupported ? 'menu' : undefined}
                aria-expanded={batchSupported ? batchMenuOpen : undefined}
                /* ★ 按官方：那颗 Generate 按钮**没有任何 tooltip**（实测 hover 无浮层），
                   用户也明确"不要发送按钮上的提示" ⇒ 已整体移除 `data-tooltip` / `data-tooltip-legacy`。 */
                onPointerDown={handleBatchPointerDown}
                onPointerUp={clearBatchLongPress}
                onPointerCancel={clearBatchLongPress}
                onPointerLeave={clearBatchLongPress}
                onContextMenu={(event) => { if (batchSupported) event.preventDefault(); }}
                onClick={handleSubmitClick}
              >
                {isGenerating && !performanceMode ? (
                  <Suspense fallback={null}>
                    <ThinkingOrb state="composing" size={20} aria-label={t('生成中')} />
                  </Suspense>
                ) : (
                  // 官方发送按钮是 lucide arrow-up（用户提供 发送.svg），不是箭头朝右
                  <OfficialIcon name="send" size={16} />
                )}
              </button>
              </div>
            </div>
            </>
          )}
          </div>
        </div>
      </div>
    {hasAdvancedSettings && (
      <div
        className={`prompt-advanced-panel nodrag overflow-hidden transition-all duration-300${advancedOpen ? ' is-open' : ''}`}
        data-testid="official-advanced-settings-panel"
      >
        <div className="prompt-advanced-inner p-4 bg-muted/30">
          {/* §126 官方 `S0`（canvas:@1195200 逐字）的挂载方式：
                `s.jsx("div",{className:z("nodrag overflow-hidden transition-all duration-300",H?"max-h-96":"max-h-0"),
                                "data-testid":…ADVANCED_SETTINGS_PANEL,
                  children:s.jsx("div",{className:"p-4 bg-muted/30",children:v})})`
              ⇒ 内容盒 = **`p-4 bg-muted/30`**，且**里面直接就是 `v`（`advancedSettings`）本身**，没有额外包裹/间距。
              ⚠️ MTV 改前多包了一层 `<div className="mb-3">` ⇒ 该行整体高 **+12px**
                 （16+20+12+16 = 64 vs 官方 16+20+16 = **52**）—— 用户「明显高度 和居中 都不对」。现已按官方去掉。 */}
          {advancedSettings}
          {runninghubModel && onRunninghubModelParametersChange && (
            <div className="mb-3">
              <div className="mb-2 text-xs text-text-text-secondary">
                {t('模型参数')} · {runninghubModel.parameters.filter((field) => field.required && !field.binding && field.defaultValue === undefined).length} {t('项需填写')}
              </div>
              <div className="max-h-80 overflow-y-auto"><RunningHubModelParameterFields model={runninghubModel} values={runninghubModelParameters} onChange={onRunninghubModelParametersChange} disabled={isGenerating} /></div>
            </div>
          )}
          {runninghubWorkflow && onWorkflowInputsChange && (
            <div className="mb-3">
              <div className="mb-2 text-xs text-text-text-secondary">{t('云工作流参数')}</div>
              <div className="max-h-72 overflow-y-auto"><RunningHubParameterFields parameters={runninghubWorkflow.runninghub?.parameters ?? []} values={workflowInputs} onChange={onWorkflowInputsChange} disabled={isGenerating} /></div>
            </div>
          )}
          {workflowApi?.workflowApi?.version === 2 && onWorkflowInputsChange && (
            <div className="mb-3 text-xs">
              <div className="mb-2 text-text-text-secondary">{t('工作流输入')}</div>
              <div className="max-h-80 overflow-y-auto"><WorkflowApiParameterFields manifest={workflowApi.workflowApi} values={workflowInputs} onChange={onWorkflowInputsChange} disabled={isGenerating} /></div>
            </div>
          )}
          {workflowApi?.workflowApi?.version === 1 && onWorkflowInputsChange && (
            <div className="text-xs">
              <div className="mb-2 text-text-text-secondary">{t('工作流输入')}</div>
              <p className="my-2 text-text-text-secondary">{t('引用 1–9 张图片与最多 3 段音频；按引用顺序发送。')}</p>
              <label className="flex flex-wrap items-center gap-2">{t('随机种子（可选）')}<input className="ui-input min-w-0 flex-1" type="number" step={1} disabled={isGenerating}
                value={workflowInputs?.seed ?? ''} placeholder={workflowApi.workflowApi?.defaults?.seed?.toString() ?? t('留空随机')}
                onChange={(e) => { const values = { ...workflowInputs }; if (e.target.value === '') delete values.seed; else values.seed = e.target.value; onWorkflowInputsChange(values); }} /></label>
            </div>
          )}
        </div>
      </div>
    )}
    </div>
    {slashOpen && (
      /* 官方锚点：`fx` 里 `div."absolute bottom-full left-0 right-0 mb-2 z-50"`（挂在提示词栏**上方** 8px）
         ⇒ 菜单挂在 `.prompt-panel`（position: relative）内部，不再 portal + fixed ✗（MTV 旧做法） */
      <div className="official-slash-anchor">
        <OfficialSlashCommandMenu
          ref={officialSlashRef}
          visible={slashOpen}
          disabled={nodeType === 'ai-image' && incomingRefCount === 0}
          showConnectionHint={nodeType === 'ai-image' && incomingRefCount === 0}
          onSelect={(cmd) => {
            /* 官方：选中 = `onCommandSelect(item.prompt)` ⇒ 把模板整段写进提示词并**直接触发生成** */
            setSlashOpen(false);
            handleSlashSelect(cmd.prompt, true);
          }}
          onClose={() => setSlashOpen(false)}
        />
      </div>
    )}
    </>
  );
}
