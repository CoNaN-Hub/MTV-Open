/**
 * `generation_confirmation` / `node_update_confirmation` 两族的**共享卡件** —— live 官方逐字移植。
 *
 * 权威源码：`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`
 *
 * ⚠️ **第 85 轮：下表已按实测重标；此前那张表来自另一个 bundle（`vendor-pkg-canvas-ChpWx5JY.js`）⇒ 对
 * `CvbAwZyy` 全错，已作废。** 最严重的一条：旧表把 `Rs`@2228065 标成 ParamChip，**`Rs` 根本不是 chip** ——
 * 它是从 `./vendor-packages-DRvCmDjR.js` 导入的 **PopoverContent**（26 处调用一律 `side/align/sideOffset/
 * className/forceMount/onCloseAutoFocus`）。真正的 chip 原语是 **`Hs`@2266984**（尾部 2270214）。
 *
 * | 官方本地名 | 定义偏移 | 本文件导出名 |
 * |---|---|---|
 * | `Hs` | 2266984 | `ParamChip`（**旧表误标为 `Rs`@2228065，已作废**） |
 * | `v0` | 2193932 | `GenerationCardHeader` |
 * | `V0` | 2305841 | `GenerationCardFooter`（**旧表误标为 `_0`@2266921，已作废**） |
 * | `Rx` | 2244666 | `PromptItemList` |
 * | `WJe` | 2245470 | `PromptItem` |
 * | `LJe` | 2238671 | `promptItemReducer` |
 * | `Kf` | 2283167 | `NodeThumbRow`（**旧表误标为 `zf`@2244242，已作废** —— 该偏移实测在 `qF`/`ltt`/`wd`/`VE`/`xx` 一带，是**载荷形状 helper**，不是缩略行） |
 * | `Jre` | 2281908 | `ThumbItem`（`displayName="ThumbItem"`；**旧表误标为 `Rse`@2242989**） |
 * | `lnt` | 2281203 | `selectVisibleThumbnails`（逐字 `lnt(e,t=4)`；`Kf` 调用点传 `3`） |
 * | `unt` | 2281586 | `thumbFallbackGlyph`（`unt({nodeType,audioScene})`；**旧表误标为 `$Je`@2242092**） |
 * | `dnt` | 2281477 | 缩略图地址 —— 即 `nodeLinkChipModel.ts` 的 `ND(type,src)` / `nodeLinkThumb` |
 * | `cnt` | 2281421 | `{padding:1,maxZoom:2,minZoom:.5,duration:500}`（`Jre` 点击时传给 `fitView`） |
 * | `jc` | 152784 | 官方 `fitView` 的**宿主桥**（见下方「点击」） |
 * | `DJe` | 2237505 | `PromptEditor` |
 * | `xF` / `Use` | 2268459 / 2269308 | `useSinglePromptState` / `useBatchPromptState` |
 * | `qse` | 2286133 | `blurActiveElement` |
 * | `da` | vendor-packages @453497 | Radix `Switch`（底类逐字） |
 * | `Dt` | — | `OfficialTooltip`（仓库既有逐字移植） |
 * | `Os`/`Is`/`zs`/`un` | vendor-packages @434202 起 | Radix DropdownMenu 包装（`data-slot` 与底类逐字） |
 * | `Snt` | 2293521 | 官方时长 chip 的数字步进器（旧表 `oet` 的类比物，**未落地**） |
 *
 * ⚠️ **未落地 / 替换点**（见落地报告「诚实清单」，均在代码内以 `官方实体未解析，待替换` 标注）：
 *   1. `DJe` 的 mention 建议扩展（官方 `JN({items,onSearch,suggestionEnabled,resolveMentionToken,renderer,…})`）
 *      —— 依赖官方 `vE()` 提及缓存；本轮只渲染官方 `jv`(`TiptapMentionEditor`) 壳，`extensions` 传空。
 *   2. `dnt`（缩略图 URL 变体器 `pn(src, $t.SMALL|THUMBNAIL)`）—— **本轮已落地**：走仓库既有的
 *      `nodeLinkChipModel.ts` 的 `nodeLinkThumb`（=`ND`）+ `imageVariantUrl`（=`pn`/`qu`），
 *      它同时处理了 MTV 侧 `asset://`/`blob:`/`data:` 不能加 `?variant_name=` 这一适配点。
 *   3. `Jre` 的点击 —— 官方 `jc()`@152784 是**宿主桥**：
 *      ```js
 *      function jc(){ const{fitView:e}=pt(); const n=Ic()?.focusCanvasNodes;
 *        return {fitView:a.useCallback(async r=>{ if(!n) return e(r);
 *          const i=r?.nodes?.map(l=>l.id)??[]; return i.length?(n(i),!0):!1 },[e,n])} }
 *      ```
 *      **官方画布页确实提供了这条桥**（`mK=a.createContext(null)`，唯一 Provider 在 `uIt`@4562700：
 *      `const S={...t, focusCanvasNodes:C=>m(C[0]??null), …}; return s.jsxs(Qye,{value:S,…}`，
 *      其中 `m` 是 `useState` 的 setter）⇒ 官方 `cnt`=`{padding:1,maxZoom:2,minZoom:.5,duration:500}`
 *      在真实应用里**从不生效**（只剩 `!n` 那条 fallback 分支）。`mC[0]` 被喂给一个
 *      **「画布素材预览」对话框**（`Ko`/`Yo`/`ns`/`qv` + 本地 `pIt`，`pIt` 实测在 **@4565328**；
 *      旧表写的 `@4565917` 是它的**函数体尾部**，不是函数起点），
 *      正文按 `node.type` 分派 `img` / `video controls` / `audio controls` / 纯文本，
 *      底部 `Link`「在画布中打开」→ `/canvas/<id>?focus_node=<nodeId>`。
 *      ⇒ 官方点击缩略图/mention **不移镜头**，而是弹这个预览框。
 *      **本轮已落地**：`components/chat/CanvasResourcePreviewDialog.tsx` +
 *      `services/chat/canvasResourcePreview.ts`（MTV 事件通道），由 `ChatPanel.tsx` 持有开关状态。
 *   4. `unt` 音频分支的 `scene` prop —— **本轮已落地**：官方本地名 `_s`（=`vendor-packages-DRvCmDjR.js`
 *      的 `av` = `Wk`@311612，三态 `Text-to-Speech`→等化器 / `Music`→双音符 / `Sound`→双声波，
 *      缺省回落等化器）；MTV 复用仓库既有的 `officialIcons.tsx` 的 `OfficialAudioSceneIcon`
 *      （= 官方 `Mr`/`Xm`，同一套三条 path 逐字）。
 *   5. 官方 `_D`(markdown) 支持 `className`；仓库 `ChatMarkdown` 只有 `{value, ...handlers}` —— className 改挂在
 *      外层 `<div>`（官方 `_D` 自身就是这个 div 的角色）。
 */
import {
  memo,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import TiptapMentionEditor from './TiptapMentionEditor';
import ChatMarkdown from './ChatMarkdown';
import ChatReferenceText from './ChatReferenceText';
import OfficialTooltip from './OfficialTooltip';
import { MentionIconAudio, MentionIconImage, MentionIconText, MentionIconVideo } from './MentionLibraryParts';
import { OfficialAudioSceneIcon } from './officialIcons';
import {
  OfficialTablerCheck,
  OfficialTablerChevronDown,
  OfficialTablerChevronRight,
  OfficialTablerLock,
} from './confirmationIcons';
import { useAppStore } from '../../store/useAppStore';
import { useConfirmationText } from '../../services/chat/generationConfirmationStrings';
import { selectVisibleThumbnails } from '../../services/chat/generationConfirmation';
import { nodeLinkPlaceholderType, nodeLinkThumb } from '../../services/chat/nodeLinkChipModel';
import { cx, promptItemReducer, resolveChipLabel, type PromptItemView } from './confirmationCardUtils';
import type { ParamChipOption } from './generationChipController';

export type { ParamChipOption };

/* ------------------------------------------------------------------ *
 * 官方 `Hs` @2266984 —— 参数 chip
 * ------------------------------------------------------------------ */

export interface ParamChipProps {
  icon?: string;
  leadingIcon?: ReactNode;
  value: ReactNode;
  prefixLabel?: ReactNode;
  options?: readonly ParamChipOption[];
  selectedValue?: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  variant?: 'default' | 'static';
  title?: string;
  menuVariant?: 'compact' | 'model';
  className?: string;
}

/** 官方 Radix DropdownMenu 包装的底类（vendor-packages @434202 起，逐字）。 */
const DROPDOWN_CONTENT_BASE = [
  'bg-popover text-popover-foreground z-50',
  'max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem]',
  'origin-(--radix-dropdown-menu-content-transform-origin)',
  'overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
].join(' ');

const DROPDOWN_ITEM_BASE = [
  'focus:bg-accent focus:text-accent-foreground',
  'data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10',
  'dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive',
  'data-[variant=destructive]:*:[svg]:!text-destructive',
  "[&_svg:not([class*='text-'])]:text-muted-foreground",
  'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8',
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
].join(' ');

/** 官方 `Hs`：三种渲染形态逐字。 */
function ParamChipInner({
  icon,
  leadingIcon,
  value,
  prefixLabel,
  options,
  selectedValue,
  onChange,
  editable,
  variant = 'default',
  title,
  menuVariant = 'compact',
  className,
}: ParamChipProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const display = resolveChipLabel(value, options);
  const selected = options?.find((option) => option.value === selectedValue);
  const isModel = menuVariant === 'model';
  const staticClass = cx(
    'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium leading-5 text-white/88',
    'font-inter',
    className,
  );

  const body = (
    <>
      {leadingIcon}
      {icon && <img src={icon} alt="" className="h-4 w-4 rounded-sm" />}
      {prefixLabel && <span className="text-white/56">{prefixLabel}</span>}
      <span>{display}</span>
    </>
  );

  if (variant === 'static') {
    return (
      <span title={title} className={staticClass}>
        {body}
      </span>
    );
  }

  if (!editable || !options || options.length === 0) {
    return (
      <span title={title} className={staticClass}>
        {body}
        {selected?.disabled && (
          <OfficialTablerLock size={12} className="text-white/40" aria-label={selected.disabledReason} />
        )}
        {editable && <OfficialTablerChevronDown size={12} className="text-white/40" />}
      </span>
    );
  }

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          title={title}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium leading-5 text-white/88',
            'font-inter transition-colors hover:bg-white/[0.05]',
            'cursor-pointer focus:outline-none',
            className,
          )}
        >
          {body}
          {selected?.disabled && (
            <OfficialTablerLock size={12} className="text-white/40" aria-label={selected.disabledReason} />
          )}
          <OfficialTablerChevronDown size={12} className="text-white/40" />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          side="bottom"
          sideOffset={4}
          className={cx(
            DROPDOWN_CONTENT_BASE,
            isModel ? 'w-[248px] max-h-[400px] rounded-2xl p-2' : 'min-w-[120px] rounded-xl p-1',
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === selectedValue;
            const showDisabledOverlay = isModel && option.disabled && option.disabledReason
              && hovered === option.value;
            return (
              <DropdownMenuPrimitive.Item
                key={option.value}
                /* ★ 2026-10-15（**MTV 增强**）：候选**走哪条连接** —— 与节点侧 `ModelSelector`
                   用同一组排障属性（`data-model-connection` / `data-model-connection-name` /
                   `data-model-unavailable`），两个入口一查就能对上。
                   用户口径：「我是自定义的厂商 我后台接入什么厂商 你就显示什么厂商的 
                   我接入两个 你就显示两个厂商的」⇒ 接了多条连接时靠它分辨来源。 */
                data-model-value={option.value}
                data-model-connection={option.connectionId ?? ''}
                data-model-connection-name={option.connectionName ?? ''}
                data-model-unavailable={option.unavailable ? '1' : undefined}
                aria-disabled={option.disabled || undefined}
                aria-label={option.disabled && option.disabledReason
                  ? `${String(option.label)}: ${option.disabledReason}`
                  : undefined}
                onMouseEnter={() => setHovered(option.value)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(option.value)}
                onBlur={() => setHovered(null)}
                onSelect={(event) => {
                  if (option.disabled) {
                    event.preventDefault();
                    return;
                  }
                  onChange?.(option.value);
                }}
                className={cx(
                  DROPDOWN_ITEM_BASE,
                  'justify-between gap-3 rounded-lg px-2 py-1.5 text-xs',
                  isModel && 'min-h-10 rounded-xl px-3 py-2',
                  option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                  isSelected && (isModel ? 'bg-white/10 font-semibold' : 'font-semibold'),
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {isModel && option.icon && <img src={option.icon} alt="" className="h-4 w-4 shrink-0 rounded-sm" />}
                  <span className="truncate">{option.label}</span>
                  {/* ★ 2026-10-15：**厂商/连接名徽章** —— 接了多条连接时，光看模型名分不出
                      哪条来自哪个厂商（自定义连接的配置 key 形如 `custom-<uuid8>`）。
                      与节点侧 `ModelSelector` 的 `data-model-connection-badge` 同形同义；
                      拿不到连接名（内置目录注入的 id / 目录外无配置）⇒ 不渲染，绝不猜。 */}
                  {isModel && option.connectionName && (
                    <span
                      className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] leading-4 text-white/56"
                      data-model-connection-badge={option.connectionId ?? ''}
                      title={option.connectionName}
                    >
                      {option.connectionName}
                    </span>
                  )}
                  {isModel && option.unavailable && (
                    <span
                      className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] leading-4 text-white/56"
                      data-model-unavailable-badge=""
                      title="该连接的 key 在上游用不了这个模型（以带 Key 的模型清单为准）"
                    >
                      不可用
                    </span>
                  )}
                </span>
                {option.disabled && !showDisabledOverlay ? (
                  <OfficialTablerLock size={14} className={cx('shrink-0', isModel ? 'text-primary' : 'text-white/40')} />
                ) : isSelected && !showDisabledOverlay ? (
                  <OfficialTablerCheck size={14} className="shrink-0" />
                ) : null}
                {showDisabledOverlay && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center rounded-xl bg-black/20 px-3 backdrop-blur-sm">
                    <OfficialTablerLock size={16} className="mr-2 shrink-0 text-primary" />
                    <span className="truncate">{option.disabledReason}</span>
                  </div>
                )}
              </DropdownMenuPrimitive.Item>
            );
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

export const ParamChip = memo(ParamChipInner);

/* ------------------------------------------------------------------ *
 * 官方 `v0` @2193932 —— 卡头
 * ------------------------------------------------------------------ */

export type GenerationRequestKindName = 'image' | 'video' | 'audio';

export interface GenerationCardHeaderProps {
  requestKind: GenerationRequestKindName;
  status?: 'confirmed' | 'cancelled' | 'failed' | 'skipped' | 'auto' | null;
  costText?: string | null;
  costLoading?: boolean;
}

/** 官方 `pZe`（卡头状态色板，逐字）。 */
const HEADER_STATUS_STYLE = {
  confirmed: { colorClass: 'text-[#7CD5A7]', dotClass: 'bg-[#7CD5A7]', labelKey: 'chatAdapter.generationConfirmation.confirmed' },
  cancelled: { colorClass: 'text-white/90', dotClass: 'bg-white/90', labelKey: 'chatAdapter.generationConfirmation.cancelled' },
  failed: { colorClass: 'text-[#A55050]', dotClass: 'bg-[#A55050]', labelKey: 'chatAdapter.generationConfirmation.generationFailed' },
  skipped: { colorClass: 'text-white/40', dotClass: 'bg-white/40', labelKey: 'chatAdapter.generationConfirmation.skipped' },
  auto: { colorClass: 'text-[#90C4E5]', dotClass: 'bg-[#90C4E5]', labelKey: 'chatAdapter.generationConfirmation.autoModeStatus' },
} as const;

/** 官方 `v0`（逐字；无 displayName）。 */
export const GenerationCardHeader = memo(function GenerationCardHeader({
  requestKind,
  status,
  costText,
  costLoading,
}: GenerationCardHeaderProps) {
  const t = useConfirmationText();
  const title = t(
    requestKind === 'video'
      ? 'chatAdapter.generationConfirmation.videoGeneration'
      : requestKind === 'audio'
        ? 'audio.audioGeneration'
        : 'chatAdapter.generationConfirmation.imageGeneration',
  );
  const style = status ? HEADER_STATUS_STYLE[status] : null;

  return (
    <div className="flex items-center gap-1.5 px-2">
      {requestKind === 'video' ? (
        <MentionIconVideo size={12} className="text-white/60" opacity={1} />
      ) : requestKind === 'audio' ? (
        <MentionIconAudio size={12} className="text-white/60" opacity={1} />
      ) : (
        <MentionIconImage size={12} className="text-white/60" opacity={1} />
      )}
      <span className="text-xs font-normal leading-4 tracking-[0.12px] text-white/60">{title}</span>
      {costText && (
        <span className={cx('relative inline-flex text-xs font-normal leading-4 tracking-[0.12px] text-white/60', costLoading && 'opacity-60')}>
          <span className={cx('whitespace-nowrap', !costLoading && 'tap-price-change')}>{costText}</span>
          {costLoading && (
            <span aria-hidden="true" className="tap-price-shimmer absolute inset-0">{costText}</span>
          )}
        </span>
      )}
      {style && (
        <span className={cx('ml-auto flex items-center gap-1.5', style.colorClass)}>
          <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', style.dotClass)} />
          <span className="hidden text-xs font-normal leading-4 @[350px]:inline">{t(style.labelKey)}</span>
        </span>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `V0` @2305841 —— 卡脚
 * ------------------------------------------------------------------ */

export interface GenerationCardFooterProps {
  autoModeDisabled?: boolean;
  confirmHighlighted?: boolean;
  onConfirm?: () => void;
  onReject?: () => void;
  rejectDisabled?: boolean;
  showAutoModeSwitch?: boolean;
  showRejectButton?: boolean;
  confirmLabel?: ReactNode;
  confirmDisabled?: boolean;
  confirmDisabledReason?: ReactNode;
  /** 官方 `nK(mode)`：自动模式开关的写入回调。 */
  onChangeAutoMode?: (mode: 'auto' | 'ask') => void;
  /** 官方 Radix Switch 的受控值（官方读 store，MTV 由宿主注入）。 */
  autoMode?: boolean;
}

/** 官方 `V0`（逐字）。 */
export const GenerationCardFooter = memo(function GenerationCardFooter({
  autoModeDisabled = false,
  confirmHighlighted = false,
  onConfirm,
  onReject,
  rejectDisabled = false,
  showAutoModeSwitch = true,
  showRejectButton = true,
  confirmLabel,
  confirmDisabled = false,
  confirmDisabledReason,
  onChangeAutoMode,
  autoMode = false,
}: GenerationCardFooterProps) {
  const t = useConfirmationText();
  const confirmButton = (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        className={cx(
          'relative inline-flex items-center rounded-lg px-3 py-2 text-xs font-normal leading-3 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
          confirmHighlighted
            ? 'bg-[#90C4E5] text-black transition-colors hover:bg-[#A9D3EC] animate-[starter-attention-breathe_1.6s_ease-in-out_infinite,starter-attention-ping_1.6s_ease-out_infinite]'
            : 'bg-[#F5F5F5] text-[#0F0F0F] transition-opacity hover:opacity-85',
        )}
        onClick={onConfirm}
        disabled={confirmDisabled}
      >
        <span className="relative z-[1]">{confirmLabel ?? t('chatAdapter.generationConfirmation.confirm')}</span>
      </button>
    </span>
  );

  return (
    <div className="flex items-center gap-2">
      {showAutoModeSwitch && (
        <div className={cx('hidden min-w-0 cursor-pointer select-none items-center gap-2 @[350px]:flex', autoModeDisabled && 'cursor-not-allowed opacity-45')}>
          <SwitchPrimitive.Root
            checked={autoMode}
            disabled={autoModeDisabled}
            /* 底子 = 官方 `da`(`b4`) 的类串；尾部追加调用点（`V0`）传的 className（逐字拼接顺序）。 */
            className={cx(
              'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-xs transition-colors',
              'focus-visible:outline-hidden focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'data-[state=checked]:bg-primary',
              'data-[state=unchecked]:bg-zinc-800 data-[state=unchecked]:shadow-inner',
              'shrink-0 data-[state=checked]:bg-[#90C4E5] [&>span]:bg-white focus-visible:outline-none',
            )}
            onCheckedChange={(checked) => {
              if (autoModeDisabled) return;
              onChangeAutoMode?.(checked ? 'auto' : 'ask');
            }}
          >
            <SwitchPrimitive.Thumb
              className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4"
            />
          </SwitchPrimitive.Root>
          <span className="truncate text-xs text-white/40">{t('chatAdapter.generationConfirmation.autoMode')}</span>
        </div>
      )}
      <span className="flex-1" />
      {showRejectButton && (
        <button
          type="button"
          disabled={rejectDisabled}
          className="inline-flex items-center rounded-lg bg-white/[0.09] px-3 py-2 text-xs font-normal leading-3 text-[#F5F5F5] transition-colors hover:bg-white/[0.14] focus:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white/[0.09]"
          onClick={onReject}
        >
          {t('chatAdapter.generationConfirmation.cancel')}
        </button>
      )}
      {confirmDisabled && confirmDisabledReason
        ? <OfficialTooltip content={confirmDisabledReason}>{confirmButton}</OfficialTooltip>
        : confirmButton}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `Kf` / `Jre` / `unt` —— 引用缩略图
 * ------------------------------------------------------------------ */

type NodeMedia = { nodeId: string; title: string; type: string; src: string; scene?: string };

/** 官方 `Jre` 用 `cn(useCallback(p => p.nodeLookup.get(e) ?? null, [e]))` **订阅**节点；
 *  MTV 没有 `nodeLookup`，改用等价的选择器订阅（旧实现是 `getState()` 惰性读 ⇒
 *  节点 `src` 后到时不重渲染，缩略图永远停在兜底图标）。 */
function useNodeMedia(nodeId: string): NodeMedia | null {
  const node = useAppStore((state) => state.nodes.find((item) => item.id === nodeId) ?? null);
  if (!node) return null;
  const data = (node.data ?? {}) as {
    src?: string;
    type?: string;
    label?: string;
    title?: string;
    name?: string;
    params?: { scene?: unknown };
  };
  const title = (typeof data.title === 'string' && data.title.trim())
    || (typeof data.name === 'string' && data.name.trim())
    || `node_${nodeId.slice(0, 6)}`;
  return {
    nodeId,
    title,
    type: typeof data.type === 'string' ? data.type : '',
    src: typeof data.src === 'string' ? data.src : '',
    /* 官方 `Jre`：`typeof r.params?.scene === "string" ? r.params.scene : void 0`。 */
    scene: typeof data.params?.scene === 'string' ? data.params.scene : undefined,
  };
}

/** 官方 `unt` @2281586：`n = "text-white/60"`、size 14、opacity .6。
 *  ⚠️ 入参是**官方节点类型字面量**（`text`/`video`/`audio`/`image`…），MTV 的 `ai-*`/`source-*`
 *  必须①经 `nodeLinkPlaceholderType`（= 官方 `nT`）归一；旧实现直接拿 MTV 类型比 `=== 'video'`，
 *  永远落 default ⇒ 任何类型都画成图片图标。
 *  ②音频分支按官方把 `data.params.scene` 透传给三态 glyph
 *  （`Text-to-Speech` 等化器 / `Music` 双音符 / `Sound` 双声波，缺省 = 等化器）。 */
function thumbFallbackGlyph(nodeType: string | undefined, audioScene?: string): ReactNode {
  const className = 'text-white/60';
  switch (nodeLinkPlaceholderType(nodeType)) {
    case 'text': return <MentionIconText size={14} className={className} opacity={0.6} />;
    case 'video': return <MentionIconVideo size={14} className={className} opacity={0.6} />;
    case 'audio': return <OfficialAudioSceneIcon size={14} className={className} opacity={0.6} scene={audioScene} />;
    default: return <MentionIconImage size={14} className={className} opacity={0.6} />;
  }
}

export interface ThumbItemProps {
  nodeId: string;
  overlayBadge?: string | null;
  onActivate?: (nodeId: string) => void;
}

/** 官方 `Jre`@2281908（`displayName="ThumbItem"`）。 */
export const ThumbItem = memo(function ThumbItemInner({ nodeId, overlayBadge, onActivate }: ThumbItemProps) {
  const media = useNodeMedia(nodeId);
  /* 官方 `dnt(nodeType, src)`@2281477 —— 即 `nodeLinkThumb`：`image` ⇒ `pn(src, SMALL)`、
     `video`/`videoEdit` ⇒ `pn(src, THUMBNAIL)`、其余恒 `""`。由它负责 MTV 类型归一与
     `asset://`/`blob:`/`data:` 不加 `?variant_name=` 的适配。 */
  const thumbnail = nodeLinkThumb(media?.type, media?.src ?? '');
  const label = media?.title ?? `node_${nodeId.slice(0, 6)}`;
  const handleClick = useCallback(() => {
    if (!media) return;
    onActivate?.(nodeId);
  }, [media, nodeId, onActivate]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!media}
      aria-label={label}
      className={cx(
        'relative h-5 w-5 shrink-0 overflow-hidden rounded-[4px] bg-white/[0.08] transition-[filter,box-shadow] duration-200 ease-out focus:outline-none',
        media
          ? 'cursor-pointer hover:brightness-110 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
          : 'cursor-default',
      )}
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/5">
          {thumbFallbackGlyph(media?.type, media?.scene)}
        </div>
      )}
      {overlayBadge && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-end pr-0.5 text-[10px] font-medium text-white/90"
          style={{ background: 'linear-gradient(270deg, #1F1F1F 0%, rgba(31,31,31,0.6) 60%, transparent 100%)' }}
        >
          {overlayBadge}
        </div>
      )}
    </button>
  );
});
ThumbItem.displayName = 'ThumbItem';

export interface NodeThumbRowProps {
  nodeIds: readonly string[];
  maxVisible?: number;
  showTooltip?: boolean;
  onNodeActivate?: (nodeId: string) => void;
}

/** 官方 `Kf`@2283167（`maxVisible` 默认 **3**、`showTooltip` 默认 **true**；内部 `lnt(nodeIds,3)`）。 */
export const NodeThumbRow = memo(function NodeThumbRow({
  nodeIds,
  maxVisible = 3,
  showTooltip = true,
  onNodeActivate,
}: NodeThumbRowProps) {
  const t = useConfirmationText();
  const { visible, badgeText } = selectVisibleThumbnails(nodeIds, maxVisible);
  if (!visible.length) return null;
  const row = (
    <div className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-1.5 py-1">
      {visible.map((nodeId, index) => (
        <ThumbItem
          key={nodeId}
          nodeId={nodeId}
          overlayBadge={index === visible.length - 1 ? badgeText : null}
          onActivate={onNodeActivate}
        />
      ))}
    </div>
  );
  return showTooltip
    ? <OfficialTooltip content={t('chatAdapter.generationConfirmation.reference')}>{row}</OfficialTooltip>
    : row;
});

/* ------------------------------------------------------------------ *
 * 官方 `DJe` @2237505 —— prompt 内嵌编辑器
 * ------------------------------------------------------------------ */

export interface PromptEditorProps {
  prompt: string;
  minHeight?: number;
  onChange: (value: string) => void;
}

/** 官方 `DJe`。mention 建议扩展（官方 `JN(...)`）本轮未落地。 */
export function PromptEditor({ prompt, minHeight, onChange }: PromptEditorProps) {
  return (
    <TiptapMentionEditor
      value={prompt}
      /* 官方 `extensions:[y]`（`JN` 提及建议）。官方实体未解析，待替换：本轮传空数组。 */
      extensions={[]}
      onTextChange={onChange}
      enableInputRules={false}
      enablePasteRules={false}
      className="mb-1 w-full bg-transparent text-sm leading-5 tracking-[0.12px] text-white/90"
      minHeight={minHeight}
      maxHeight={minHeight}
      placeholder=""
      autoFocus
    />
  );
}

/* ------------------------------------------------------------------ *
 * 官方 `WJe` @2245470 —— 单条目
 * ------------------------------------------------------------------ */

export type PromptItemMode = 'single' | 'batch';

/** 官方共享按钮 class（变量 `E`，逐字）。 */
const WJE_BUTTON_CLASS = 'rounded-[8px] bg-white/[0.09] px-[12px] py-[6px] text-xs font-normal leading-[12px] text-[#F5F5F5] transition-colors hover:bg-white/[0.14] focus:outline-none';

export interface PromptItemProps {
  index: number;
  mode: PromptItemMode;
  prompt: string;
  placeholder: string;
  references?: unknown;
  referenceNodeIds?: readonly string[];
  editable?: boolean;
  renderMarkdown?: boolean;
  pendingEditsRef?: { current: Record<string, string> };
  onChange?: (value: string) => void;
  rejected?: boolean;
  onToggleReject?: () => void;
  showItemReferences?: boolean;
  mentionsEnabled?: boolean;
  onNodeActivate?: (nodeId: string) => void;
}

/** 官方 `WJe`（逐字；无 displayName）。 */
export function PromptItem({
  index,
  mode,
  prompt,
  placeholder,
  referenceNodeIds,
  editable,
  renderMarkdown,
  pendingEditsRef,
  onChange,
  rejected = false,
  onToggleReject,
  showItemReferences = false,
  onNodeActivate,
}: PromptItemProps) {
  const t = useConfirmationText();
  const [view, dispatch] = useReducer(promptItemReducer, 'collapsed' as PromptItemView);
  /* 官方 `WJe`：`const[b,_]=a.useState(n); a.useEffect(()=>{_(n)},[n])`。
     这里改成「源串比对」的等价状态（**不新增行为**）：`draftState.source !== prompt` 时直接用新 prompt。 */
  const [draftState, setDraftState] = useState({ source: prompt, value: prompt });
  const draft = draftState.source === prompt ? draftState.value : prompt;
  const setDraft = useCallback((value: string) => {
    setDraftState((current) => ({ source: current.source, value }));
  }, []);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (element) setOverflowing(element.scrollHeight > element.clientHeight + 1);
  }, [prompt, view]);

  const single = mode === 'single';
  const batch = mode === 'batch';
  const interactive = !!editable && !rejected;

  if (view === 'editing' && interactive) {
    return (
      <div className="rounded-xl p-2">
        <div className="rounded-2xl bg-[#3F3F3F] p-2 outline outline-1 outline-white/30 outline-offset-[-1px]">
          <PromptEditor
            prompt={draft}
            minHeight={single ? 200 : 160}
            onChange={(value) => {
              setDraft(value);
              if (pendingEditsRef) pendingEditsRef.current[index] = value;
            }}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className={WJE_BUTTON_CLASS}
              onClick={() => {
                onChange?.(draft);
                if (pendingEditsRef) delete pendingEditsRef.current[index];
                dispatch({ type: 'exitEditing' });
              }}
            >
              {t('chatAdapter.generationConfirmation.finish')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const clampClass = single ? 'line-clamp-5' : 'line-clamp-1';
  const body = draft || placeholder;
  const markdownClass = cx(
    '!text-sm !font-normal !leading-5 !tracking-[0.12px] !text-white/90',
    '[&_p]:!text-sm [&_p]:!font-normal [&_p]:!leading-5 [&_p]:!tracking-[0.12px] [&_p]:!text-white/90',
    '[&_li]:!text-sm [&_li]:!font-normal [&_li]:!leading-5 [&_li]:!tracking-[0.12px] [&_li]:!text-white/90',
    '[&_ul]:!my-0 [&_ol]:!my-0 [&_[data-streamdown=code-block]]:!my-1',
  );

  return (
    <div className={cx('group/prompt-item rounded-xl p-2', !single && 'hover:bg-white/10')}>
      <div className="flex items-start gap-1.5">
        {batch && (
          <span className={cx('shrink-0 text-sm leading-5 text-white/90', rejected && 'line-through opacity-40')}>
            {index + 1}.
          </span>
        )}
        <div className={cx('min-w-0 flex-1', rejected && 'opacity-40')}>
          <div
            ref={contentRef}
            className={cx(
              'text-sm leading-5 tracking-[0.12px] text-white/90',
              view === 'collapsed' && clampClass,
              (editable || overflowing || view === 'expanded') && 'cursor-pointer',
            )}
            style={single && view === 'collapsed' && overflowing
              ? {
                maskImage: 'linear-gradient(to bottom, white 60%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, white 60%, transparent 100%)',
              }
              : undefined}
            onClick={() => {
              if (editable || overflowing || view === 'expanded') dispatch({ type: 'toggleExpanded' });
            }}
          >
            {renderMarkdown
              ? <div className={markdownClass}><ChatMarkdown value={body} /></div>
              : <ChatReferenceText value={body} />}
          </div>

          {interactive && view === 'expanded' && (
            <div className="mt-2 flex justify-end">
              <button type="button" className={WJE_BUTTON_CLASS} onClick={() => dispatch({ type: 'enterEditing' })}>
                {t('chatAdapter.generationConfirmation.edit')}
              </button>
            </div>
          )}

          {showItemReferences && (referenceNodeIds && referenceNodeIds.length > 0
            ? <div className="mt-1.5"><NodeThumbRow nodeIds={referenceNodeIds} onNodeActivate={onNodeActivate} /></div>
            : <div className="mt-1.5 text-xs leading-5 text-white/40">{t('chatAdapter.generationConfirmation.noReference')}</div>)}
        </div>

        {view === 'collapsed' && (interactive || overflowing) && (
          <button
            type="button"
            aria-label="Expand"
            className="shrink-0 text-white/60 transition-colors hover:text-white/80 focus:outline-none"
            onClick={() => dispatch({ type: 'toggleExpanded' })}
          >
            <OfficialTablerChevronRight size={16} />
          </button>
        )}

        {onToggleReject && (
          <button
            type="button"
            className="shrink-0 self-start rounded-md px-1.5 py-0.5 text-xs leading-5 text-white/50 transition-colors hover:text-white/80 focus:outline-none"
            onClick={onToggleReject}
          >
            {t(rejected
              ? 'chatAdapter.generationConfirmation.restoreItem'
              : 'chatAdapter.generationConfirmation.rejectItem')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 官方 `Rx` @2244666 —— 条目列表
 * ------------------------------------------------------------------ */

export interface PromptItemInput {
  prompt: string;
  references?: unknown;
  referenceNodeIds?: readonly string[];
}

export interface PromptItemListProps {
  mode: PromptItemMode;
  items: readonly PromptItemInput[];
  editable?: boolean;
  onItemChange?: (index: number, value: string) => void;
  renderMarkdown?: boolean;
  pendingEditsRef?: { current: Record<string, string> };
  rejectedIndices?: ReadonlySet<number>;
  onToggleReject?: (index: number) => void;
  showItemReferences?: boolean;
  mentionsEnabled?: boolean;
  hideEmptyItems?: boolean;
  onNodeActivate?: (nodeId: string) => void;
}

/** 官方 `Rx`（逐字）。 */
export const PromptItemList = memo(function PromptItemList({
  mode,
  items,
  editable,
  onItemChange,
  renderMarkdown = false,
  pendingEditsRef,
  rejectedIndices,
  onToggleReject,
  showItemReferences = false,
  mentionsEnabled = false,
  hideEmptyItems = false,
  onNodeActivate,
}: PromptItemListProps) {
  const t = useConfirmationText();
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl bg-[#2F2F2F] p-1">
      <div className={cx('flex flex-col gap-0.5', mode === 'batch' && items.length > 1 && 'max-h-[320px] overflow-y-auto')}>
        {items.map((item, index) => (
          hideEmptyItems && !item.prompt.trim() ? null : (
            <PromptItem
              key={index}
              index={index}
              mode={mode}
              prompt={item.prompt}
              placeholder={t('chatAdapter.generationConfirmation.noPrompt')}
              references={item.references}
              referenceNodeIds={item.referenceNodeIds}
              editable={editable}
              renderMarkdown={renderMarkdown}
              pendingEditsRef={pendingEditsRef}
              onChange={(value) => onItemChange?.(index, value)}
              rejected={rejectedIndices?.has(index) ?? false}
              onToggleReject={onToggleReject ? () => onToggleReject(index) : undefined}
              showItemReferences={showItemReferences}
              mentionsEnabled={mentionsEnabled}
              onNodeActivate={onNodeActivate}
            />
          )
        ))}
      </div>
    </div>
  );
});

