/**
 * `generation_confirmation` 卡族 **6 个变体 + 顶层分发器** —— live 官方逐字移植。
 *
 * 权威源码：`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`
 * （**4,570,188 字符**；注意 `4,832,071` 是同一文件的**字节数**，不是字符偏移量纲。）
 *
 * ⚠️ **第 85 轮：下表已按实测重标；此前那张表来自另一个 bundle（`vendor-pkg-canvas-ChpWx5JY.js`）⇒ 对
 * `CvbAwZyy` 全错，已作废。** 旧表错例：它把 \`qet\`@2287990 标成顶层分发器，实测该偏移读到的是
 * \`gnt(){const o=t?.requests;…}\`（载荷解析器）；旧表还把 \`Rs\`@2228065 标成 ParamChip，实测 \`Rs\` 是
 * 从 \`./vendor-packages-DRvCmDjR.js\` 导入的 **PopoverContent**（26 处调用均为 \`side/align/sideOffset/…\`）。
 *
 * | 官方本地名 | 定义偏移 | 本文件导出名 | 说明 |
 * |---|---|---|---|
 * | `uot` | 2326934 | `GenerationConfirmationCard` | 顶层分发器（v1 → legacy → 回退） |
 * | `xot` | 2353836 | `BatchGenerationCard` | v1 图像/视频**批量**卡（`v1`） |
 * | `got` | 2351507 | `LegacyGenerationCard` | legacy 图像/视频**单条**卡 |
 * | `fot` | 2346917 | `BatchAudioGenerationCard` | v1 音频**批量**卡 |
 * | `mot` | 2344425 | `LegacyAudioGenerationCard` | legacy 音频**单条**卡 |
 * | `hot` | 2350243 | `FallbackGenerationCard` | 回退卡（`inconsistentBatch` / `unsupportedKind`） |
 * | `vnt` | 2289814 | `GenerationAutoPreviewCard` | 自动模式预览卡（`generation_request` 内联） |
 * | `Wet` | 2285965 邻域 | `LyricsEditor` | 歌词编辑块 |
 * | `xie` | 2340458 | `ImageVideoChipRow` | 图像/视频参数 chip 行 |
 * | `mie` | 2325111 | `AudioChipRow` | 音频参数 chip 行 |
 * | `bJe` / `yJe` | 2225676 / 2225316 | （`generationConfirmationProtocol.ts`） | v1 / legacy 解析器 |
 * | `Ntt` / `tO` / `$re` | 2254619 / 2255272 / 2264610 | （同文件） | `generation_confirmation` view-model 解析器 |
 * | `Ff` / `Of` / `Uoe` | 2159117 / 2159421 / 2268748 邻域 | （`generationConfirmation.ts`） | 状态解析 |
 * | `Ad` | 2189659 | （`generationConfirmation.ts`）`resolveConfirmationCardStatus` | 卡片状态推导 |
 * | `net` (`bF`) | 2253553 | （`generationConfirmation.ts`）`resolveMentionTokens` | mention 校验 |
 *
 * ⚠️ **未落地**（组件内均以 `官方实体未解析，待替换` 标注）：
 *   1. 参数控制器 —— **第 63 轮已移植**（官方 `hie` @2327822 / `uie` @2317385 ⇒
 *      `generationChipController.ts` 的 `useImageVideoChipController` / `useAudioChipController`）；
 *      音频的 model/scene/advanced/controls 因官方依赖未提取而**隐藏**（见该文件头）。
 *   2. 修改载荷构造 `Let` / `zet` / `fv` / `Gse` / `Qse` / `Fse`（@2316xxx–2318xxx）—— 依赖同一目录；
 *      本轮的 `buildModifications` 走官方 `rot`→`die`→`Mv`（`generationChipController.ts`）。
 *   3. 价格服务 `zse`（@2265453，网络 + `localStorage.access_token` + 300ms 防抖 + TTL 180000ms）。
 *   4. 缩略图 URL 变体器 `dnt`（@2281477）—— **已落地**，走仓库既有 `nodeLinkThumb`；
 *      画布聚焦走官方宿主桥 `jc()`@152784（`focusCanvasNodes`）—— 见 `ConfirmationCardParts.tsx` 文件头。
 *   5. mention 编辑器的建议扩展（官方 `JN`）—— 见 `PromptEditor`。
 */
import { memo, useCallback, useMemo, useState } from 'react';
import {
  GenerationCardFooter,
  GenerationCardHeader,
  NodeThumbRow,
  ParamChip,
  PromptItemList,
  type GenerationRequestKindName,
} from './ConfirmationCardParts';
import {
  useGenerationChipController,
  type GenerationChipController,
} from './generationChipController';
import { blurActiveElement, cx } from './confirmationCardUtils';
import { useBatchPromptState, useSinglePromptState } from '../../services/chat/confirmationPromptState';
import { OfficialTablerAspectRatio, OfficialTablerBadgeHd, OfficialTablerClock, OfficialTablerCopy, OfficialTablerSparkles, OfficialTablerTransform, OfficialTablerVolume } from './confirmationIcons';
import { useConfirmationText } from '../../services/chat/generationConfirmationStrings';
import { cardModelName, useGenerationCardCost } from './useGenerationCardCost';
import {
  isConfirmationInFlight,
  resolveCardVisualStatus,
  resolveConfirmationCardStatus,
  resolveMentionTokens,
  type ConfirmationStoreSlice,
} from '../../services/chat/generationConfirmation';
import {
  extractFallbackViewModel,
  parseGenerationAutoPreview,
  parseGenerationConfirmationLegacy,
  parseGenerationConfirmationV1,
  ra,
  type GenerationConfirmationBatchViewModel,
  type GenerationConfirmationSingleViewModel,
  type GenerationParams,
} from '../../services/chat/generationConfirmationProtocol';
import type { GenerationRequestKind } from '../../services/chat/generationConfirmationProtocol';

/* ------------------------------------------------------------------ *
 * 公共 props
 * ------------------------------------------------------------------ */

export type ConfirmationAnswer = (
  confirmationId: string,
  action: 'confirm' | 'reject',
  payload?: unknown,
) => void;

export interface GenerationCardBaseProps {
  content: Record<string, unknown>;
  onAnswer?: ConfirmationAnswer;
  /** 官方 `generationFailedMap[confirmationId]`。 */
  generationFailed?: boolean;
  /** 官方 `qe(hs)` 的只读切片（官方 `pendingConfirmation` / `resolvedConfirmations`）。 */
  store?: ConfirmationStoreSlice | null;
  /** 官方 `hie` / `uie` 的返回值（已移植；未注入时按「全芯片隐藏」的空控制器回落）。 */
  controller?: GenerationChipController;
  onNodeActivate?: (nodeId: string) => void;
  /** 官方 Radix Switch 的受控值（官方读 store）。 */
  autoMode?: boolean;
  onChangeAutoMode?: (mode: 'auto' | 'ask') => void;
}

/** 引用形状（官方 `pF` 的产物元素）。 */
export interface ReferenceShape {
  imageCount: number;
  videoCount: number;
  audioCount: number;
  unknownCount: number;
  totalCount: number;
}

/** 官方 `pF`（@2277xxx）本轮未解析 —— 以「空形状」注入。 */
const EMPTY_REFERENCE_SHAPE: ReferenceShape = {
  imageCount: 0,
  videoCount: 0,
  audioCount: 0,
  unknownCount: 0,
  totalCount: 0,
};

/* ------------------------------------------------------------------ *
 * 官方 `xie` @2340458 —— 图像/视频参数 chip 行（逐字 DOM）
 * ------------------------------------------------------------------ */

/** 官方自动比例哨兵 `xm`（@2309292 邻域，逐字 `"__tapnow_auto_aspect__"`）。 */
const AUTO_ASPECT_SENTINEL = '__tapnow_auto_aspect__';

const GRID_TIMES = [1, 2, 4] as const;

/** 官方 `yF`（@2301xxx）本轮未解析 —— 保留调用形状，返回原数组。 */
function yF(values: readonly number[], _current?: number): number[] {
  /* 官方实体未解析，待替换：`yF` 会按模型能力过滤候选倍数。 */
  return [...values];
}

export interface ChipRowProps {
  controller: GenerationChipController;
  editable?: boolean;
}

/** 官方 `xie`（逐字；只有 `show*Chip` 为真才渲染对应 chip 与分隔符）。 */
export function ImageVideoChipRow({ controller: c, editable = false }: ChipRowProps) {
  const t = useConfirmationText();
  const effectiveDuration = c.effectiveEditedDuration;
  const isSeedance25 = typeof effectiveDuration === 'number'
    && c.durationOptions.every((option) => Number(option.value) >= 0);
  const timesOptions = useMemo(
    () => (c.fixedImageCount != null
      ? [{ value: String(c.fixedImageCount), label: `${c.fixedImageCount}×` }]
      : yF(GRID_TIMES, c.editedTimes).sort((a, b) => a - b).map((value) => ({ value: String(value), label: `${value}×` }))),
    [c.fixedImageCount, c.editedTimes],
  );

  return (
    <>
      {c.showModelChip && (
        <ParamChip
          icon={c.modelInfo?.icon}
          value={c.modelDisplayName}
          selectedValue={c.modelSelectedValue}
          options={c.modelOptions}
          onChange={c.handleModelChange}
          editable={editable && c.modelChipEditable}
          menuVariant="model"
        />
      )}
      {/* ★ 2026-10-15 用户口径：候选**只**来自「他接入的连接」⇒ 所有连接都没为这个 kind
          声明模型时，候选是 0 条。此时**不渲染空下拉**（`ParamChip` 在 options 为空时本就
          降级为静态 chip，打不开菜单），而是在原地给一句**可操作**提示
          （`modelOptionsHint` = 「先在设置 → API 连接里拉取模型列表」）。
          **绝不**用「塞内置模型进去」来避免空下拉 —— 那正是用户现场那一批调不到的模型。
          ★ 同一句提示也覆盖**部分隐藏**：严格裁剪（清单在 ⇒ 只列清单内）把 `catalogModels`
          里没有的候选隐藏掉时，提示会带上「有 N 个…已隐藏」—— **静默隐藏不许发生**。 */}
      {c.showModelChip && c.modelOptionsHint && (
        <span data-model-options-hint="" className="text-[11px] leading-4 text-white/56">
          {c.modelOptionsHint}
        </span>
      )}
      {c.showMethodChip && (
        <>
          {c.showModelChip && <div className="h-4 w-px bg-white/10" />}
          <ParamChip
            leadingIcon={<OfficialTablerTransform size={14} className="text-white/56" />}
            value={c.currentMethod}
            options={c.methodChipOptions}
            onChange={c.handleMethodChange}
            editable={c.methodChipEditable}
          />
        </>
      )}
      {c.showAspectRatioChip && (
        <>
          {(c.showModelChip || c.showMethodChip) && <div className="h-4 w-px bg-white/10" />}
          <ParamChip
            leadingIcon={<OfficialTablerAspectRatio size={14} className="text-white/56" />}
            title={!c.aspectRatioState.editable && c.aspectRatioState.value === AUTO_ASPECT_SENTINEL
              ? c.confirmDisabledReason as string | undefined
              : undefined}
            value={c.aspectRatioState.value}
            options={c.aspectRatioState.options}
            onChange={(value) => c.setEditedAspectRatio?.(value === AUTO_ASPECT_SENTINEL ? '' : value)}
            editable={c.aspectRatioState.editable}
          />
        </>
      )}
      {c.showImageSizeChip && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <ParamChip
            leadingIcon={<OfficialTablerBadgeHd size={14} className="text-white/56" />}
            value={c.editedImageSize}
            options={c.imageSizeOptions}
            onChange={c.setEditedImageSize}
            editable={editable}
          />
        </>
      )}
      {c.showImageSizeAutoChip && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <ParamChip
            leadingIcon={<OfficialTablerBadgeHd size={14} className="text-white/56" />}
            value={c.autoLabel}
            editable={false}
          />
        </>
      )}
      {c.showQualityChip && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <ParamChip
            leadingIcon={<OfficialTablerSparkles size={14} className="text-white/56" />}
            value={c.editedQuality}
            options={c.qualityOptions}
            onChange={c.handleQualityChange}
            editable={editable}
          />
        </>
      )}
      {c.showDurationChip && (
        <>
          <div className="h-4 w-px bg-white/10" />
          {isSeedance25 ? (
            <ParamChip
              leadingIcon={<OfficialTablerClock size={14} className="text-white/56" />}
              value={effectiveDuration}
              options={c.durationOptions}
              /* 官方这里用的是 `Snt`@2293521（数字步进器，**未落地**）；改用 chip 原语 `Hs` 后需把字符串转回数字。 */
              onChange={(value) => c.setEditedDuration?.(Number(value))}
              editable={editable}
              title={t('videoConfigs.durationSelectorTitle')}
            />
          ) : (
            <ParamChip
              leadingIcon={<OfficialTablerClock size={14} className="text-white/56" />}
              value={String(c.effectiveEditedDuration)}
              options={c.durationOptions}
              onChange={(value) => c.setEditedDuration?.(Number(value))}
              editable={editable}
            />
          )}
        </>
      )}
      {c.showDurationAutoChip && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <ParamChip
            leadingIcon={<OfficialTablerClock size={14} className="text-white/56" />}
            value={c.autoLabel}
            editable={false}
          />
        </>
      )}
      {c.showResolutionChip && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <ParamChip
            leadingIcon={<OfficialTablerBadgeHd size={14} className="text-white/56" />}
            value={c.effectiveEditedResolution}
            options={c.resolutionOptions}
            onChange={c.setEditedResolution}
            editable={editable}
          />
        </>
      )}
      {c.showResolutionAutoChip && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <ParamChip
            leadingIcon={<OfficialTablerBadgeHd size={14} className="text-white/56" />}
            value={c.autoLabel}
            editable={false}
          />
        </>
      )}
      {c.showGenerateAudioMenu && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <ParamChip
            leadingIcon={<OfficialTablerVolume size={14} className="text-white/56" />}
            value={c.editedGenerateAudio ? 'on' : 'off'}
            options={c.audioOptions}
            onChange={c.handleGenerateAudioChange}
            editable={editable}
          />
        </>
      )}
      {c.showTimesChip && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <ParamChip
            /* round 111 修正：此处原为 lucide `Share2`（**非官方资产**）。官方 `xie` 的张数 chip 是
               `s.jsx(_x,{size:14,className:"text-white/56"})`（`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js`
               @2336527），`_x` ← `dl` ← `HBt = p("outline","copy","Copy",$Pr)`
               （`live-assets-r100/vendor-libs-D64ouk08.js` 常量 `$Pr` @2087784 / 工厂 @2088101 / 导出 `HBt as dl` @8934607）。 */
            leadingIcon={<OfficialTablerCopy size={14} className="text-white/56" />}
            value={String(c.effectiveTimes)}
            options={timesOptions}
            onChange={(value) => c.setEditedTimes?.(Number(value))}
            editable={editable && c.fixedImageCount == null}
          />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * 官方 `mie` @2325111 —— 音频参数 chip 行（逐字 DOM）
 * ------------------------------------------------------------------ */

export function AudioChipRow({ controller: c, editable = false }: ChipRowProps) {
  return (
    <>
      {c.showModelChip && (
        <ParamChip
          icon={c.modelInfo?.icon}
          value={c.modelDisplayName}
          selectedValue={c.modelSelectedValue}
          options={c.modelOptions}
          onChange={c.handleModelChange}
          editable={editable && c.modelChipEditable}
          menuVariant="model"
        />
      )}
      {c.showSceneChip && (
        <>
          {c.showModelChip && <div className="h-4 w-px bg-white/10" />}
          <ParamChip
            leadingIcon={<OfficialTablerVolume size={14} className="text-white/56" />}
            value={c.sceneDisplayName}
            selectedValue={c.sceneOptions ? undefined : undefined}
            options={c.sceneOptions}
            onChange={c.handleSceneChange}
            editable={editable && c.sceneChipEditable}
          />
        </>
      )}
      {c.showDurationChip && (
        <>
          {(c.showModelChip || c.showSceneChip) && <div className="h-4 w-px bg-white/10" />}
          <ParamChip
            leadingIcon={<OfficialTablerClock size={14} className="text-white/56" />}
            value={c.durationDisplayName}
            options={c.durationOptions}
            onChange={(value) => c.setEditedDuration?.(Number(value))}
            editable={editable && c.durationChipEditable}
          />
        </>
      )}
      {editable && c.supportsLyrics && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <ParamChip
            leadingIcon={<OfficialTablerVolume size={14} className="text-white/56" />}
            value={c.lyricsModeDisplayName}
            selectedValue={c.lyricsMode}
            options={c.lyricsModeOptions}
            onChange={c.handleLyricsModeChange}
            editable={editable}
          />
        </>
      )}
      {/*
        官方 `mie` 尾部还有三段本轮**未落地**（依赖未解析的控制器字段）：
          · `e.advancedParamChips.map(...)` —— 逐项 `<div className="h-4 w-px bg-white/10"/>` + `<Rs prefixLabel value selectedValue options onChange editable/>`
          · `e.settledAudioParams.map(...)` —— `<Rs prefixLabel value editable={false}/>`
          · `e.controlsWillRender && <e.ControlsComponent params onParamChange disabled isVideoAdaptive filter.../>`
        官方实体未解析，待替换（`Wse` 未落地）。
      */}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * 官方 `Wet` @2285965 邻域 —— 歌词编辑块（逐字）
 * ------------------------------------------------------------------ */

export interface LyricsEditorProps {
  value?: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}

export function LyricsEditor({ value, editable, onChange }: LyricsEditorProps) {
  return editable ? (
    <textarea
      aria-label="lyrics-editor"
      defaultValue={value}
      onBlur={(event) => onChange?.(event.target.value)}
      rows={4}
      className="w-full resize-y rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-white/72 outline-none focus:bg-white/[0.05]"
    />
  ) : (
    <div className="whitespace-pre-wrap rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-white/72">{value}</div>
  );
}

/* ------------------------------------------------------------------ *
 * 官方 `hot` @2350243 —— 回退卡
 * ------------------------------------------------------------------ */

export function FallbackGenerationCard({ content, onAnswer, store, autoMode, onChangeAutoMode }: GenerationCardBaseProps) {
  const t = useConfirmationText();
  const viewModel = extractFallbackViewModel(content);
  if (!viewModel) return null;
  const hasItems = [content.request, content.response, content.result, content]
    .some((candidate) => Array.isArray((candidate as { detail?: { items?: unknown[] } } | undefined)?.detail?.items)
      && ((candidate as { detail?: { items?: unknown[] } }).detail?.items?.length ?? 0) > 0);
  const knownKind = ['image', 'video', 'audio'].includes(viewModel.requestKind);
  const inconsistent = hasItems && knownKind;
  const started = content.status === 'started';
  /* `store` 仅用于满足 `V0` 的宿主契约（官方 `hot` 这里只读 `pendingConfirmation`，见下）。 */
  /* 官方 `hot`@2350243 卡脚门 @2351206 逐字：
     `d=e.status==="started"&&o.pendingConfirmation?.confirmationId===r.confirmationId
      &&Ad(e,r.confirmationId,o)==="pending"`，然后 `d&&s.jsx(V0,{…})` @2351194。
     本文件 `started` 为真 ⇒ 状态必为 `'started'` ⇒ `Ad` 返回 `'pending'`（`resolveConfirmationCardStatus`），
     故这里只需补上 `store.pendingConfirmation` 命中 + `status==='pending'` 那一半门（= `interactive`），
     与官方逐字同口径。 */
  const interactive = content.status === 'started'
    && store?.pendingConfirmation?.confirmationId === viewModel.confirmationId
    && store?.pendingConfirmation?.status === 'pending';

  return (
    <div className="my-2 flex w-full flex-col gap-3 rounded-2xl bg-[#1F1F1F] p-3">
      <div className="px-2 text-xs text-white/60">
        {inconsistent
          ? t('chatAdapter.generationConfirmation.inconsistentBatch')
          : t('chatAdapter.generationConfirmation.unsupportedKind', { kind: viewModel.requestKind })}
      </div>
      {started && interactive && (
        <GenerationCardFooter
          showAutoModeSwitch={false}
          confirmDisabled
          confirmDisabledReason={inconsistent
            ? t('chatAdapter.generationConfirmation.inconsistentBatchShort')
            : t('chatAdapter.generationConfirmation.unsupportedKindShort')}
          onReject={() => onAnswer?.(viewModel.confirmationId, 'reject')}
          autoMode={autoMode}
          onChangeAutoMode={onChangeAutoMode}
        />
      )}
      {store ? null : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 官方 `vnt` @2289814 —— 自动模式预览卡
 * ------------------------------------------------------------------ */

export function GenerationAutoPreviewCard({ content }: { content: Record<string, unknown> }) {
  const t = useConfirmationText();
  const preview = parseGenerationAutoPreview(content);
  if (!preview) return null;
  const isImage = preview.toolName === 'gen_image';
  const failed = preview.status === 'failed';
  /* 官方 `hE(...)`/`nF(...)` 走模型目录；目录为空 ⇒ `T = null`、`E = modelName ?? "Unknown"`。
     官方实体未解析，待替换：MTV 无 wireName↔modelId 目录。 */
  const modelIcon: string | undefined = undefined;
  const modelLabel = preview.modelName ?? 'Unknown';
  const qualityLabel = preview.quality
    ? t(isImage
      ? `imageModels.gpt2.qualityOptions.${preview.quality}`
      : `videoConfigs.modeOptions.${preview.quality}`)
    : '';
  const requestKind: GenerationRequestKindName = isImage ? 'image' : 'video';
  const items = preview.isBatch
    ? preview.requests.map((request, index) => ({
      prompt: request.prompt
        || t(isImage
          ? 'chatAdapter.generationConfirmation.imageN'
          : 'chatAdapter.generationConfirmation.videoN', { n: index + 1 }),
      /* 官方逐字：`M.reference_node_ids`（**原始请求**一侧是 snake_case）→ 赋给 camel 名 `WJe` prop。 */
      referenceNodeIds: request.reference_node_ids,
    }))
    : [{
      prompt: preview.prompt ?? '',
      references: preview.normalizedReferences,
      referenceNodeIds: preview.referenceNodeIds,
    }];

  return (
    <div
      style={{ containerType: 'inline-size' }}
      className={cx(
        'my-2 flex w-full flex-col gap-3 overflow-hidden rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
        failed && 'opacity-50',
      )}
    >
      <GenerationCardHeader requestKind={requestKind} status={failed ? 'failed' : 'auto'} />
      {preview.isBatch && (
        <p className="px-2 text-sm font-medium leading-relaxed text-white/80">
          {t(preview.toolName === 'gen_video'
            ? 'chatAdapter.generationConfirmation.generateVideos'
            : 'chatAdapter.generationConfirmation.generateImages', { count: preview.requestCount })}
        </p>
      )}
      <div>
        <PromptItemList
          mode={preview.isBatch ? 'batch' : 'single'}
          items={items}
          editable={false}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <ParamChip icon={modelIcon} value={modelLabel} editable={false} />
          {preview.aspectRatio && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <ParamChip value={preview.aspectRatio} editable={false} />
            </>
          )}
          {isImage && preview.imageSize && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <ParamChip value={preview.imageSize === '0.5K' ? '512P' : preview.imageSize} editable={false} />
            </>
          )}
          {preview.quality && qualityLabel && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <ParamChip value={qualityLabel} editable={false} />
            </>
          )}
          {preview.duration != null && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <ParamChip
                value={preview.duration === -1 ? t('videoConfigs.durationAuto') : `${preview.duration}s`}
                editable={false}
              />
            </>
          )}
          {!isImage && preview.resolution && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <ParamChip value={preview.resolution} editable={false} />
            </>
          )}
          {isImage && !preview.isBatch && preview.times != null && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <ParamChip value={`${preview.times}×`} editable={false} />
            </>
          )}
          {preview.isBatch && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <ParamChip
                variant="static"
                value={t('chatAdapter.generationConfirmation.batchTasks', { count: preview.requestCount })}
                editable={false}
              />
            </>
          )}
        </div>
        {preview.referenceNodeIds.length > 0 && <NodeThumbRow nodeIds={preview.referenceNodeIds} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 官方 `got` @2351507 —— legacy 图像/视频卡（单条）
 * ------------------------------------------------------------------ */

function useCommonCardState(
  content: Record<string, unknown>,
  confirmationId: string,
  store: ConfirmationStoreSlice | null | undefined,
  prompt: string,
) {
  const status = resolveConfirmationCardStatus(content, confirmationId, store);
  const interactive = status === 'pending'
    && store?.pendingConfirmation?.confirmationId === confirmationId
    && store?.pendingConfirmation?.status === 'pending';
  const promptState = useSinglePromptState(prompt);
  const inFlight = isConfirmationInFlight(content, confirmationId, store);
  return { status, interactive, promptState, inFlight };
}

export interface LegacyGenerationCardProps extends GenerationCardBaseProps {
  viewModel: GenerationConfirmationSingleViewModel;
}

export const LegacyGenerationCard = memo(function LegacyGenerationCard({
  viewModel,
  content,
  onAnswer,
  generationFailed,
  store,
  controller: injected,
  onNodeActivate,
  autoMode,
  onChangeAutoMode,
}: LegacyGenerationCardProps) {
  const t = useConfirmationText();
  const { confirmationId, requestKind, params, originalParams, presentFields, protocolContext } = viewModel;
  const { status, interactive, promptState, inFlight } = useCommonCardState(
    content,
    confirmationId,
    store,
    ra(params.prompt),
  );
  /* 官方 `uot` 分发（@2326934）：控制器由本层按 viewModel 构造（官方 `hie`/`uie` 是 hook），
     宿主仍可用 `controller` prop 覆盖。批量卡官方取 `items[0]`（见 `useGenerationChipController`）。
     当前请求模型优先用卡片载荷的 `request_json.model_name`（官方 `Sse` 读 `carrier.model_name`）。 */
  /* round 116：载荷里**没有** `model_name`（MTV 的 `media_generate` 审批发生在用户选模型之前；
     生产者 `agentRoundExecutor.buildMediaGenerationRequestSnapshot` 在「显式 modelRef + 项目默认模型」
     都空时不写该字段）⇒ 让控制器把模型 chip 渲染出来（用户可选），并把「未选」的理由从假的
     `Subscription required` 换成「先选模型」。详细依据见 `generationChipController.ts`
     的 `ImageVideoChipControllerInput.modelSelectionRequired`（音频卡忽略该输入）。 */
  const assignedModelName = cardModelName(content);
  const builtController = useGenerationChipController(viewModel, {
    editable: interactive,
    modelName: assignedModelName,
    modelSelectionRequired: interactive && !assignedModelName,
  });
  const controller = injected ?? builtController;
  /* 官方 `Pc` 估价 hook 的 MTV 等价：连接级计费（手动价 → 厂商价目表 → 兜底）折成积分。
     取值口径 = 「项目该类型默认模型」（与 `generationService` 一致）；算不出价就不渲染。 */
  const costParams = params as { imageSize?: unknown; resolution?: unknown; quality?: unknown; times?: unknown };
  const cost = useGenerationCardCost({
    kind: requestKind as 'image' | 'video' | 'audio',
    /* 官方算的是**已指派模型**的价 ⇒ 先读卡片载荷里的 `request_json.model_name`（第 63 轮补的生产者）。 */
    modelName: cardModelName(content),
    imageSize: typeof costParams.imageSize === 'string' ? costParams.imageSize : undefined,
    resolution: typeof costParams.resolution === 'string' ? costParams.resolution : undefined,
    quality: typeof costParams.quality === 'string' ? costParams.quality : undefined,
    times: typeof costParams.times === 'number' ? costParams.times : undefined,
  });
  const { getEffectivePrompt, handleItemChange, pendingEditsRef, prompt } = promptState;
  /* 官方 `mF(params.normalizedReferences)`（引用形状合并）未落地 ⇒ 空形状。 */
  const referenceShape = EMPTY_REFERENCE_SHAPE;

  const handleConfirm = useCallback(() => {
    if (!onAnswer || !interactive || controller.confirmDisabled) return;
    const resolved = resolveMentionTokens({
      prompt: getEffectivePrompt(),
      resolvedReferences: null,
      getNodeKind: () => null,
    });
    if (resolved.unresolvedNodeIds.length > 0) {
      /* 官方 `ne.error(t("...mentionUnresolved"))`；MTV 侧走宿主 toast（此处保留官方分支语义）。 */
      window.dispatchEvent(new CustomEvent('chat-toast-error', {
        detail: { message: t('chatAdapter.generationConfirmation.mentionUnresolved') },
      }));
      return;
    }
    if (resolved.numberingUnavailable) {
      window.dispatchEvent(new CustomEvent('chat-toast-error', {
        detail: { message: t('chatAdapter.generationConfirmation.mentionNumberingUnavailable') },
      }));
      return;
    }
    /* 官方 `controller.buildModifications(resolved.prompt, resolved.addedNodeIds)`。
       第 63 轮已移植：第三参 = 官方 `rot`→`die`→`Mv` 的产物。 */
    onAnswer(confirmationId, 'confirm', controller.buildModifications?.(resolved.prompt, resolved.addedNodeIds));
  }, [onAnswer, interactive, controller, getEffectivePrompt, t, confirmationId]);

  const handleReject = useCallback(() => {
    if (interactive) onAnswer?.(confirmationId, 'reject');
  }, [onAnswer, confirmationId, interactive]);

  if (inFlight) return null;

  const visual = resolveCardVisualStatus({ cardStatus: status, generationFailed });
  const headerStatus = visual === 'pending' ? undefined : visual;

  return (
    <div
      style={{ containerType: 'inline-size' }}
      className={cx(
        'relative my-2 flex w-full flex-col gap-2 rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
        'overflow-hidden',
        (status === 'rejected' || status === 'skipped' || (status === 'confirmed' && generationFailed)) && 'opacity-50',
      )}
    >
      <GenerationCardHeader requestKind={requestKind} status={headerStatus} costText={cost.text} costLoading={cost.loading} />
      <div>
        <PromptItemList
          mode="single"
          items={[{
            prompt: ra(prompt),
            references: (params as GenerationParams).normalizedReferences,
            referenceNodeIds: (params as GenerationParams).referenceNodeIds,
          }]}
          editable={interactive}
          mentionsEnabled
          pendingEditsRef={pendingEditsRef}
          onItemChange={handleItemChange}
          hideEmptyItems
          onNodeActivate={onNodeActivate}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <ImageVideoChipRow controller={controller} editable={interactive} />
        </div>
        {(params as GenerationParams).referenceNodeIds
          && ((params as GenerationParams).referenceNodeIds?.length ?? 0) > 0 && (
          <NodeThumbRow
            nodeIds={(params as GenerationParams).referenceNodeIds as string[]}
            onNodeActivate={onNodeActivate}
          />
        )}
      </div>
      {/* 官方 `got`@2351507 卡脚门 @2353747 逐字：`A==="pending"&&s.jsx(V0,{…})`，
          其中 `A=Ad(content,confirmationId,store)`、`h=A==="pending"&&store.pendingConfirmation?.confirmationId===confirmationId
          &&store.pendingConfirmation?.status==="pending"`（= 本文件的 `interactive`）。
          官方**非 pending 时压根不渲染卡脚**；MTV 原来只用 `visual==='pending'` ⇒ 会渲染出「禁用但可见」的
          `取消`/`确认`（用户实测的「假按钮」）⇒ 收紧为 `&& interactive`。 */}
      {visual === 'pending' && interactive && (
        <GenerationCardFooter
          onConfirm={handleConfirm}
          onReject={handleReject}
          rejectDisabled={!interactive}
          showAutoModeSwitch={interactive}
          confirmDisabled={!interactive || controller.confirmDisabled}
          confirmDisabledReason={controller.confirmDisabledReason}
          autoMode={autoMode}
          onChangeAutoMode={onChangeAutoMode}
        />
      )}
      {referenceShape ? null : null}
      {presentFields && protocolContext ? null : null}
      {originalParams ? null : null}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `xot` @2353836 —— v1 图像/视频批量卡
 * ------------------------------------------------------------------ */

export interface BatchGenerationCardProps extends GenerationCardBaseProps {
  viewModel: GenerationConfirmationBatchViewModel;
}

export const BatchGenerationCard = memo(function BatchGenerationCard({
  viewModel,
  content,
  onAnswer,
  generationFailed,
  store,
  controller: injected,
  onNodeActivate,
  autoMode,
  onChangeAutoMode,
}: BatchGenerationCardProps) {
  const t = useConfirmationText();
  const { confirmationId, requestKind, items } = viewModel;
  const status = resolveConfirmationCardStatus(content, confirmationId, store);
  const interactive = status === 'pending'
    && store?.pendingConfirmation?.confirmationId === confirmationId
    && store?.pendingConfirmation?.status === 'pending';
  const initialPrompts = useMemo(() => items.map((item) => ra(item.params.prompt)), [items]);
  const { prompts, handleItemChange, pendingEditsRef, getEffectivePrompts } = useBatchPromptState(initialPrompts);
  const [rejectedIndices, setRejectedIndices] = useState<ReadonlySet<number>>(() => new Set<number>());
  const toggleReject = useCallback((index: number) => {
    setRejectedIndices((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);
  const promptItems = useMemo(() => items.map((item, index) => ({
    prompt: prompts[index] ?? '',
    references: item.params.normalizedReferences,
    referenceNodeIds: item.params.referenceNodeIds,
  })), [items, prompts]);
  const { sharedReferences, showPerItemReferences } = useMemo(() => {
    const nodeIdLists = items.map((item) => item.params.referenceNodeIds ?? []);
    if (!nodeIdLists.some((list) => list.length > 0)) {
      return { sharedReferences: [] as string[], showPerItemReferences: false };
    }
    const fingerprint = (list: readonly string[]) => [...list].sort().join('|');
    const first = fingerprint(nodeIdLists[0]);
    return nodeIdLists.every((list) => fingerprint(list) === first)
      ? { sharedReferences: nodeIdLists[0], showPerItemReferences: false }
      : { sharedReferences: [] as string[], showPerItemReferences: true };
  }, [items]);

  const first = items[0];
  const costFirst = first?.params as { imageSize?: unknown; resolution?: unknown; quality?: unknown; times?: unknown } | undefined;
  const cost = useGenerationCardCost({
    kind: requestKind as 'image' | 'video' | 'audio',
    modelName: cardModelName(content),
    imageSize: typeof costFirst?.imageSize === 'string' ? costFirst.imageSize : undefined,
    resolution: typeof costFirst?.resolution === 'string' ? costFirst.resolution : undefined,
    quality: typeof costFirst?.quality === 'string' ? costFirst.quality : undefined,
    times: typeof costFirst?.times === 'number' ? costFirst.times : undefined,
  });
  /* 官方 `uot` 分发（@2326934）：控制器由本层按 viewModel 构造（官方 `hie`/`uie` 是 hook），
     宿主仍可用 `controller` prop 覆盖。批量卡官方取 `items[0]`（见 `useGenerationChipController`）。
     当前请求模型优先用卡片载荷的 `request_json.model_name`（官方 `Sse` 读 `carrier.model_name`）。 */
  /* round 116：载荷里**没有** `model_name`（MTV 的 `media_generate` 审批发生在用户选模型之前；
     生产者 `agentRoundExecutor.buildMediaGenerationRequestSnapshot` 在「显式 modelRef + 项目默认模型」
     都空时不写该字段）⇒ 让控制器把模型 chip 渲染出来（用户可选），并把「未选」的理由从假的
     `Subscription required` 换成「先选模型」。详细依据见 `generationChipController.ts`
     的 `ImageVideoChipControllerInput.modelSelectionRequired`（音频卡忽略该输入）。 */
  const assignedModelName = cardModelName(content);
  const builtController = useGenerationChipController(viewModel, {
    editable: interactive,
    modelName: assignedModelName,
    modelSelectionRequired: interactive && !assignedModelName,
  });
  const controller = injected ?? builtController;
  const remaining = Math.max(0, items.length - rejectedIndices.size);
  const confirmDisabled = rejectedIndices.size < items.length && controller.confirmDisabled;
  const inFlight = isConfirmationInFlight(content, confirmationId, store);

  const handleConfirm = useCallback(() => {
    if (!onAnswer || !interactive || confirmDisabled) return;
    const effectivePrompts = getEffectivePrompts();
    const resolved = items.map((_item, index) => (rejectedIndices.has(index)
      ? null
      : resolveMentionTokens({
        prompt: effectivePrompts[index] ?? '',
        resolvedReferences: null,
        getNodeKind: () => null,
      })));
    if (resolved.some((entry) => entry && entry.unresolvedNodeIds.length > 0)) {
      window.dispatchEvent(new CustomEvent('chat-toast-error', {
        detail: { message: t('chatAdapter.generationConfirmation.mentionUnresolved') },
      }));
      return;
    }
    if (resolved.some((entry) => entry?.numberingUnavailable)) {
      window.dispatchEvent(new CustomEvent('chat-toast-error', {
        detail: { message: t('chatAdapter.generationConfirmation.mentionNumberingUnavailable') },
      }));
      return;
    }
    /* 官方逐条 `{index, action, modifications?}`；`modifications` 由未落地的 `Let`/`fv` 产出
       （官方实体未解析，待替换）⇒ 只发 `{index, action}`。 */
    const perRequest = items.map((item, index) => (
      rejectedIndices.has(index) || !resolved[index]
        ? { index: item.index, action: 'reject' as const }
        : { index: item.index, action: 'confirm' as const }
    ));
    const anyConfirm = perRequest.some((entry) => entry.action === 'confirm');
    onAnswer(confirmationId, anyConfirm ? 'confirm' : 'reject', { per_request_modifications: perRequest });
  }, [onAnswer, interactive, confirmDisabled, getEffectivePrompts, items, rejectedIndices, t, confirmationId]);

  const handleReject = useCallback(() => {
    if (interactive) onAnswer?.(confirmationId, 'reject');
  }, [onAnswer, confirmationId, interactive]);

  if (inFlight) return null;

  const visual = resolveCardVisualStatus({ cardStatus: status, generationFailed });
  const headerStatus = visual === 'pending' ? undefined : visual;

  return (
    <div
      style={{ containerType: 'inline-size' }}
      className={cx(
        'my-2 flex w-full flex-col gap-2 overflow-hidden rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
        (status === 'rejected' || status === 'skipped' || (status === 'confirmed' && generationFailed)) && 'opacity-50',
      )}
    >
      <GenerationCardHeader requestKind={requestKind} status={headerStatus} costText={cost.text} costLoading={cost.loading} />
      <div>
        <PromptItemList
          mode="batch"
          items={promptItems}
          editable={interactive}
          mentionsEnabled
          pendingEditsRef={pendingEditsRef}
          onItemChange={handleItemChange}
          rejectedIndices={rejectedIndices}
          onToggleReject={interactive ? toggleReject : undefined}
          showItemReferences={showPerItemReferences}
          hideEmptyItems
          onNodeActivate={onNodeActivate}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <ParamChip
            variant="static"
            value={t('chatAdapter.generationConfirmation.batchTasks', { count: items.length })}
            editable={false}
          />
          {controller.showModelChip && <div className="h-4 w-px bg-white/10" />}
          <ImageVideoChipRow controller={controller} editable={interactive} />
        </div>
        {sharedReferences.length > 0 && (
          <NodeThumbRow nodeIds={sharedReferences} onNodeActivate={onNodeActivate} />
        )}
      </div>
      {/* 官方 `xot`@2353836 卡脚门 @2359142 逐字：`$==="pending"&&s.jsx(V0,{…})`，
          其中 `p=u==="pending"&&store.pendingConfirmation?.confirmationId===confirmationId
          &&store.pendingConfirmation?.status==="pending"`（= 本文件的 `interactive`）。
          官方非 pending ⇒ 不渲染卡脚 ⇒ 收紧为 `&& interactive`（同 Legacy）。 */}
      {visual === 'pending' && interactive && (
        <GenerationCardFooter
          onConfirm={handleConfirm}
          onReject={handleReject}
          rejectDisabled={!interactive}
          showAutoModeSwitch={interactive}
          showRejectButton={remaining > 0}
          confirmLabel={remaining === 0 ? t('chatAdapter.generationConfirmation.rejectAll') : undefined}
          confirmDisabled={!interactive || confirmDisabled}
          confirmDisabledReason={controller.confirmDisabledReason}
          autoMode={autoMode}
          onChangeAutoMode={onChangeAutoMode}
        />
      )}
      {first ? null : null}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `fot` @2346917 —— v1 音频批量卡
 * ------------------------------------------------------------------ */

export const BatchAudioGenerationCard = memo(function BatchAudioGenerationCard({
  viewModel,
  content,
  onAnswer,
  generationFailed,
  store,
  controller: injected,
  onNodeActivate,
  autoMode,
  onChangeAutoMode,
}: BatchGenerationCardProps) {
  const { confirmationId, items } = viewModel;
  const status = resolveConfirmationCardStatus(content, confirmationId, store);
  const interactive = status === 'pending'
    && store?.pendingConfirmation?.confirmationId === confirmationId
    && store?.pendingConfirmation?.status === 'pending';
  const initialPrompts = useMemo(() => items.map((item) => ra(item.params.prompt)), [items]);
  const { prompts, handleItemChange, pendingEditsRef, getEffectivePrompts } = useBatchPromptState(initialPrompts);
  const [rejectedIndices, setRejectedIndices] = useState<ReadonlySet<number>>(() => new Set<number>());
  const toggleReject = useCallback((index: number) => {
    setRejectedIndices((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);
  /* 官方 `uot` 分发（@2326934）：控制器由本层按 viewModel 构造（官方 `hie`/`uie` 是 hook），
     宿主仍可用 `controller` prop 覆盖。批量卡官方取 `items[0]`（见 `useGenerationChipController`）。
     当前请求模型优先用卡片载荷的 `request_json.model_name`（官方 `Sse` 读 `carrier.model_name`）。 */
  /* round 116：载荷里**没有** `model_name`（MTV 的 `media_generate` 审批发生在用户选模型之前；
     生产者 `agentRoundExecutor.buildMediaGenerationRequestSnapshot` 在「显式 modelRef + 项目默认模型」
     都空时不写该字段）⇒ 让控制器把模型 chip 渲染出来（用户可选），并把「未选」的理由从假的
     `Subscription required` 换成「先选模型」。详细依据见 `generationChipController.ts`
     的 `ImageVideoChipControllerInput.modelSelectionRequired`（音频卡忽略该输入）。 */
  const assignedModelName = cardModelName(content);
  const builtController = useGenerationChipController(viewModel, {
    editable: interactive,
    modelName: assignedModelName,
    modelSelectionRequired: interactive && !assignedModelName,
  });
  const controller = injected ?? builtController;
  const confirmDisabled = rejectedIndices.size < items.length && controller.confirmDisabled;
  const inFlight = isConfirmationInFlight(content, confirmationId, store);

  const handleConfirm = useCallback(() => {
    if (!onAnswer || !interactive || confirmDisabled) return;
    blurActiveElement();
    const effectivePrompts = getEffectivePrompts();
    const perRequest = items.map((item, index) => (
      rejectedIndices.has(index)
        ? { index: item.index, action: 'reject' as const }
        : { index: item.index, action: 'confirm' as const, prompt: effectivePrompts[index] ?? '' }
    ));
    onAnswer(confirmationId, perRequest.some((entry) => entry.action === 'confirm') ? 'confirm' : 'reject', {
      per_request_modifications: perRequest,
    });
  }, [onAnswer, interactive, confirmDisabled, getEffectivePrompts, items, rejectedIndices, confirmationId]);

  const handleReject = useCallback(() => {
    if (interactive) onAnswer?.(confirmationId, 'reject');
  }, [onAnswer, confirmationId, interactive]);

  if (inFlight) return null;

  const visual = resolveCardVisualStatus({ cardStatus: status, generationFailed });
  const headerStatus = visual === 'pending' ? undefined : visual;

  return (
    <div
      style={{ containerType: 'inline-size' }}
      className={cx(
        'my-2 flex w-full flex-col gap-2 overflow-hidden rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
        (status === 'rejected' || status === 'skipped' || (status === 'confirmed' && generationFailed)) && 'opacity-50',
      )}
    >
      <GenerationCardHeader requestKind="audio" status={headerStatus} costText={null} costLoading={false} />
      <PromptItemList
        mode="batch"
        items={items.map((item, index) => ({
          prompt: prompts[index] ?? '',
          references: item.params.normalizedReferences,
          referenceNodeIds: item.params.referenceNodeIds,
        }))}
        editable={interactive}
        pendingEditsRef={pendingEditsRef}
        onItemChange={handleItemChange}
        rejectedIndices={rejectedIndices}
        onToggleReject={interactive ? toggleReject : undefined}
        showItemReferences
        onNodeActivate={onNodeActivate}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <AudioChipRow controller={controller} editable={interactive} />
      </div>
      {/* 官方 `fot`@2346917 卡脚门 @2349795 逐字：`I==="pending"&&s.jsx(V0,{…})`，
          其中 `d=c==="pending"&&store.pendingConfirmation?.confirmationId===confirmationId
          &&store.pendingConfirmation?.status==="pending"`（= 本文件的 `interactive`）。
          官方非 pending ⇒ 不渲染卡脚 ⇒ 收紧为 `&& interactive`（同 Legacy）。 */}
      {visual === 'pending' && interactive && (
        <GenerationCardFooter
          onConfirm={handleConfirm}
          onReject={handleReject}
          rejectDisabled={!interactive}
          showAutoModeSwitch={interactive}
          confirmDisabled={!interactive || confirmDisabled}
          confirmDisabledReason={controller.confirmDisabledReason}
          autoMode={autoMode}
          onChangeAutoMode={onChangeAutoMode}
        />
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `mot` @2344425 —— legacy 音频卡（单条）
 * ------------------------------------------------------------------ */

export interface LegacyAudioGenerationCardProps extends GenerationCardBaseProps {
  viewModel: GenerationConfirmationSingleViewModel;
}

export const LegacyAudioGenerationCard = memo(function LegacyAudioGenerationCard({
  viewModel,
  content,
  onAnswer,
  generationFailed,
  store,
  controller: injected,
  onNodeActivate,
  autoMode,
  onChangeAutoMode,
}: LegacyAudioGenerationCardProps) {
  const { confirmationId, params } = viewModel;
  const { status, interactive, promptState, inFlight } = useCommonCardState(
    content,
    confirmationId,
    store,
    ra(params.prompt),
  );
  const { getEffectivePrompt, handleItemChange, pendingEditsRef, prompt } = promptState;
  /* 官方 `uot` 分发（@2326934）：控制器由本层按 viewModel 构造（官方 `hie`/`uie` 是 hook），
     宿主仍可用 `controller` prop 覆盖。批量卡官方取 `items[0]`（见 `useGenerationChipController`）。
     当前请求模型优先用卡片载荷的 `request_json.model_name`（官方 `Sse` 读 `carrier.model_name`）。 */
  /* round 116：载荷里**没有** `model_name`（MTV 的 `media_generate` 审批发生在用户选模型之前；
     生产者 `agentRoundExecutor.buildMediaGenerationRequestSnapshot` 在「显式 modelRef + 项目默认模型」
     都空时不写该字段）⇒ 让控制器把模型 chip 渲染出来（用户可选），并把「未选」的理由从假的
     `Subscription required` 换成「先选模型」。详细依据见 `generationChipController.ts`
     的 `ImageVideoChipControllerInput.modelSelectionRequired`（音频卡忽略该输入）。 */
  const assignedModelName = cardModelName(content);
  const builtController = useGenerationChipController(viewModel, {
    editable: interactive,
    modelName: assignedModelName,
    modelSelectionRequired: interactive && !assignedModelName,
  });
  const controller = injected ?? builtController;

  const handleConfirm = useCallback(() => {
    if (!onAnswer || !interactive || controller.confirmDisabled) return;
    blurActiveElement();
    onAnswer(confirmationId, 'confirm', controller.buildModifications?.(getEffectivePrompt(), []));
  }, [onAnswer, interactive, controller, getEffectivePrompt, confirmationId]);

  const handleReject = useCallback(() => {
    if (interactive) onAnswer?.(confirmationId, 'reject');
  }, [onAnswer, confirmationId, interactive]);

  if (inFlight) return null;

  const visual = resolveCardVisualStatus({ cardStatus: status, generationFailed });
  const headerStatus = visual === 'pending' ? undefined : visual;

  return (
    <div
      style={{ containerType: 'inline-size' }}
      className={cx(
        'relative my-2 flex w-full flex-col gap-2 overflow-hidden rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
        (status === 'rejected' || status === 'skipped' || (status === 'confirmed' && generationFailed)) && 'opacity-50',
      )}
    >
      <GenerationCardHeader requestKind="audio" status={headerStatus} costText={null} costLoading={false} />
      <PromptItemList
        mode="single"
        items={[{
          prompt: ra(prompt),
          references: (params as GenerationParams).normalizedReferences,
          referenceNodeIds: (params as GenerationParams).referenceNodeIds,
        }]}
        editable={interactive}
        pendingEditsRef={pendingEditsRef}
        onItemChange={handleItemChange}
        onNodeActivate={onNodeActivate}
      />
      {controller.supportsLyrics && controller.lyricsMode === 'custom' && (
        <LyricsEditor
          value={controller.lyrics}
          editable={interactive}
          onChange={controller.setEditedLyrics}
        />
      )}
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <AudioChipRow controller={controller} editable={interactive} />
        </div>
        {((params as GenerationParams).referenceNodeIds?.length ?? 0) > 0 && (
          <NodeThumbRow
            nodeIds={(params as GenerationParams).referenceNodeIds as string[]}
            onNodeActivate={onNodeActivate}
          />
        )}
      </div>
      {/* 官方 `mot`@2344425 卡脚门 @2346828 逐字：`N==="pending"&&s.jsx(V0,{…})`，
          其中 `f=m==="pending"&&store.pendingConfirmation?.confirmationId===confirmationId
          &&store.pendingConfirmation?.status==="pending"`（= 本文件的 `interactive`）。
          官方非 pending ⇒ 不渲染卡脚 ⇒ 收紧为 `&& interactive`（同 Legacy）。 */}
      {visual === 'pending' && interactive && (
        <GenerationCardFooter
          onConfirm={handleConfirm}
          onReject={handleReject}
          rejectDisabled={!interactive}
          showAutoModeSwitch={interactive}
          confirmDisabled={!interactive || controller.confirmDisabled}
          confirmDisabledReason={controller.confirmDisabledReason}
          autoMode={autoMode}
          onChangeAutoMode={onChangeAutoMode}
        />
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `uot` @2326934 —— 顶层分发器
 * ------------------------------------------------------------------ */

export interface GenerationConfirmationCardProps extends GenerationCardBaseProps {
  /** 官方 `generationFailedMap`（key = confirmationId）。 */
  generationFailedMap?: Record<string, boolean> | null;
}

/** 官方 `uot`（逐字分支：v1 → legacy → 回退卡）。 */
export const GenerationConfirmationCard = memo(function GenerationConfirmationCard({
  content,
  onAnswer,
  generationFailedMap,
  store,
  controller,
  onNodeActivate,
  autoMode,
  onChangeAutoMode,
}: GenerationConfirmationCardProps) {
  const v1 = parseGenerationConfirmationV1(content);
  const failedOf = (confirmationId: string) => generationFailedMap?.[confirmationId] ?? false;
  if (v1) {
    const shared = { content, onAnswer, store, controller, onNodeActivate, autoMode, onChangeAutoMode };
    return v1.requestKind === 'audio'
      ? (
        <BatchAudioGenerationCard
          viewModel={v1}
          generationFailed={failedOf(v1.confirmationId)}
          {...shared}
        />
      )
      : (
        <BatchGenerationCard
          viewModel={v1}
          generationFailed={failedOf(v1.confirmationId)}
          {...shared}
        />
      );
  }
  const legacy = parseGenerationConfirmationLegacy(content);
  if (legacy) {
    const shared = { content, onAnswer, store, controller, onNodeActivate, autoMode, onChangeAutoMode };
    return legacy.requestKind === 'audio'
      ? <LegacyAudioGenerationCard viewModel={legacy} generationFailed={failedOf(legacy.confirmationId)} {...shared} />
      : <LegacyGenerationCard viewModel={legacy} generationFailed={failedOf(legacy.confirmationId)} {...shared} />;
  }
  return <FallbackGenerationCard content={content} onAnswer={onAnswer} store={store} />;
});

export type { GenerationRequestKind };
