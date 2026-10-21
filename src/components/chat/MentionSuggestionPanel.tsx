/**
 * 官方 `Ub` —— `@` 建议弹层的**完整渲染树逐字移植**（live `vendor-pkg-canvas-ChpWx5JY.js`，
 * 原始偏移 248024 起；格式化全文见 `D:\DEEPSEEK\_ub_fmt.txt`）。
 *
 * ## 逐字常量（官方符号 → 取值；本文件常量名）
 * ```
 * _j(OP) = "text-white rounded-[16px] overflow-hidden backdrop-blur-[28px]"                          // SURFACE_CLASS
 * _h(PP) = { backgroundColor:"#2f2f2f", boxShadow:"0px 4px 16px 0px rgba(0,0,0,0.16), inset 0px 0.5px 0px 0px rgba(255,255,255,0.16)" }  // SURFACE_STYLE
 * sw     = "flex min-h-0 flex-1 flex-col gap-2 p-2"                                                  // BODY_CLASS
 * kk     = cx("flex min-h-0 flex-1 w-full min-w-0 flex-col items-stretch overflow-y-auto pb-1",
 *             "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]")      // SCROLL_CLASS
 * ER     = "min-w-[48px] self-stretch rounded-[12px] border-0 bg-accent px-3 py-1.5"                  // SEARCH_BAR_CLASS
 * Us     = cx(_j, narrow ? "flex w-full min-w-0 flex-col" : "flex flex-col w-[320px]",
 *                 tall ? "h-[320px]" : "max-h-[320px]")                                              // rootClassName
 * ```
 * `_j`/`_h` 的官方定义在 `vendor-packages-jvPqKqU8.js`（`export{OP as aj, PP as ak}` ← canvas
 * `import{aj as _j, ak as _h}`）；`ER` 定义在 canvas 本体 `@97189`；`sw`/`kk` 在 canvas `@234439`。
 *
 * ## 渲染树分支（官方 `if` 顺序，逐字）
 * 1. `Nr` 空态：根(`Us`+`data-mention-panel`) → `sw` → `[qr, noResults]`（`_ub_fmt.txt` 1735–1764）
 * 2. `Ke && W` 指令组下钻：根(`Us`，**官方此处没有 `data-mention-panel`**，照抄) → `sw` → `Am`（1765–1857）
 *    —— 首行「返回指令列表」`data-selectable-index=0`，其后每个 option 一行（索引 = `i+1`）
 * 3. `je && Y` 文件夹下钻：根(`Us`+`data-mention-panel`) → `sw` → `[qr, Am]`（1858–2080）
 * 4. `mentionUnavailableMessage`：`div._j/_h` + `div."px-3 py-3 text-[13px] leading-[18px] text-white/40"`（2068）
 * 5. 主分支（2081–2911）：linked / Apps / 元素库 / 资产库 / 指令 五段，条件与 children 逐字照抄
 *
 * ## 悬停由容器统一处理（`Ct`，`_ub_fmt.txt` 1144–1197）
 * `Am` 外壳上的 `onMouseMove` 用 `event.target.closest("[data-selectable-index]")` + `parseInt`，
 * 并用「上次坐标 `{x,y,idx}`」去重；命中且 `idx !== 上次 idx` 时才改选中索引。**行内不挂 `onMouseMove`**。
 *
 * ## 数据来源（MTV 与官方的差异）
 * 官方 `Ub` 直接从 store/hook 取「资产库 / 元素库 / 插件 / 指令」数据（`Dwe` 元素库 hook、
 * `Gwe`/`kwe` 资产库 hook、`$a`/`pc` 插件缓存…）。**MTV 没有这些域** ⇒ 全部改为 **props 注入**，
 * 默认空/关 ⇒ 只传 `items` 时行为与旧版完全一致（渲染「已连接节点」列表 / 空态）。
 * 行序列与可选索引一律走 `mentionSuggestionRows.ts` 的 `buildMentionRows()` /
 * `mentionRowSelectableIndices()`，不自建一套。
 *
 * ## 如实记录：没有落地的官方分支（均给出原因）
 * · `useEffect`「查询变化 / 选中索引不在 `We` 内时自动归位到 `We[0]`」（`_ub_fmt.txt` 1074–1097）：
 *   会破坏 `mentionSuggestionPopupDom.test.tsx` 的既有行为断言「`onStart` 后无任何行被选中」，
 *   且它属于选中状态同步、不属于渲染树 ⇒ 未移植（选中索引仍由宿主 `B4` / 调用方掌控）。
 * · `useLayoutEffect` 选中行 `scrollIntoView`（`Ywe`，1098–1126）：jsdom 无 `scrollIntoView`，且不属于渲染树。
 * · 元素库错误分支的「重试」由 `onElementsRetry` 注入；官方 `le()`（重新拉取）未移植。
 * · `jk` 的评审状态徽标（`N3(reviewStatus)` + `Ob`）未移植（MTV item 无 `reviewStatus`，`Ob` 未移植）。
 * · `Ak` 的封面缩略图（官方 `ZN`）与 `Su` 的前置图标（官方 `Dp`）未移植 ⇒ 由 `MentionSuggestionParts`
 *   的 `thumbnail` / `leadingIcon` 注入位承接，本次留空。
 * · 插件行：**已按官方 `tt` 逐字落地** —— 行点击用 `C$`/`I1`/`Pve` 造出
 *   `{id,label,type:"plugin",renderText,description,pluginStatus,pluginIsInstalled,pluginSkills,
 *   pluginConnectors,pluginConnectorStatus,pluginIconUrl}` 再交给 `onSelect`
 *   （见 `services/chat/mentionPlugins.ts`）。元素行 / 资产行 / 文件夹行的选中结果：
 *   官方会构造 item 再交给 `onSelect`（依赖 `i_e`/`r_e`/`a_e`/`B3` 等未移植的域转换器）
 *   ⇒ MTV 仍为注入式回调 `onElementSelect` / `onAssetSelect` / `onFolderSelect`；
 *   **linked 行走 `onSelect`**（既有调用方 `mentionSuggestionRenderer.tsx` 不变）。
 * · 官方 `R0e`/`A1` 的 300ms 搜索防抖（MTV 无异步取数）未移植；`R0e` 的「按 query 过滤 + 数字快选」已移植。
 * · `libraryMentionMode === "agent-reference"` 分支（`renderText` 由 `nc({kind:"node"})` 生成）未移植。
 *
 * ## i18n
 * `omniReference.suggestion.*` 走 `mentionStrings.ts`（官方 `omniReference.*` 表）；
 * `library.search` / `common.back` / `common.retry` / `elementLibrary.*` /
 * `omniReference.suggestion.referenceCurrentFolder` 是官方**点号 key**，落在
 * 各语言 `src/i18n/locales/<locale>/index.ts` 的同名条目里（逐字取自 live bundle，注释见各语言文件）。
 */
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { getLocale, useT } from '../../i18n';
import { mentionString } from '../../services/chat/mentionStrings';
import type { MentionSuggestionItem } from './createMentionExtension';
import {
  MENTION_ROW_CLASS,
  MENTION_ROW_SELECTED_CLASS,
  MentionFolderRow,
  MentionHighlight,
  MentionHintRow,
  MentionSectionHeader,
  MentionSeparator,
  MentionSkeleton,
} from './MentionSuggestionParts';
import {
  MentionAssetRow,
  MentionAssetRowsSkeleton,
  MentionAssetThumbnail,
  MentionAssetTypeBadge,
  MentionGroupRow,
  MentionIconChevronRight,
  MentionLibrarySearchInput,
  MentionPluginRow,
  MentionPluginRowsSkeleton,
  MentionScrollFade,
  MentionSkeletonBlock,
} from './MentionLibraryParts';
import {
  MENTION_SECTION_LIMIT,
  buildMentionRows,
  mentionAssetPath,
  mentionFolderPath,
  mentionRowSelectableIndices,
  type MentionDirectionGroup,
  type MentionDirectionOption,
  type MentionElementItem,
  type MentionLibraryAsset,
  type MentionLibraryFolder,
  type MentionLinkedItem,
  type MentionRow,
} from './mentionSuggestionRows';
import {
  buildMentionSuggestionPluginItem,
  mentionPluginConnectorStatus,
  type MentionConnectorStatus,
  type MentionPluginSource,
} from '../../services/chat/mentionPlugins';

/* ------------------------------------------------------------------ *
 * 逐字类串常量
 * ------------------------------------------------------------------ */

/** 官方 `OP`（canvas 侧别名 `_j`）。 */
const SURFACE_CLASS = 'text-white rounded-[16px] overflow-hidden backdrop-blur-[28px]';
/** 官方 `PP`（canvas 侧别名 `_h`）。 */
const SURFACE_STYLE: CSSProperties = {
  backgroundColor: '#2f2f2f',
  boxShadow: '0px 4px 16px 0px rgba(0,0,0,0.16), inset 0px 0.5px 0px 0px rgba(255,255,255,0.16)',
};
/** 官方 `sw`。 */
const BODY_CLASS = 'flex min-h-0 flex-1 flex-col gap-2 p-2';
/** 官方 `kk`。 */
const SCROLL_CLASS = 'flex min-h-0 flex-1 w-full min-w-0 flex-col items-stretch overflow-y-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';
/** 官方 `ER`（canvas @97189）。 */
const SEARCH_BAR_CLASS = 'min-w-[48px] self-stretch rounded-[12px] border-0 bg-accent px-3 py-1.5';
/** 官方空态容器类串。 */
const NO_RESULTS_CLASS = 'px-1 py-3 text-[14px] text-[rgba(255,255,255,0.4)]';

/** 官方 `z`（`cx` 口径：过滤 falsy 后按空格拼接）。 */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** 官方 `jy`（canvas @234082）：资产类型数值 → 名称；其余（含字符串）一律 `undefined`，与官方逐字一致。 */
function mentionAssetTypeName(assetType: number | string | null | undefined): string | undefined {
  switch (assetType) {
    case 1:
      return 'image';
    case 2:
      return 'video';
    case 3:
      return 'audio';
    case 4:
      return 'text';
    default:
      return undefined;
  }
}

/**
 * 官方 `U1`（canvas @199965）：文件夹名本地化。
 * `MentionLibraryParts.tsx` 里那份是模块私有（未导出）⇒ 这里按同一份映射复刻给文件夹行使用。
 */
function useMentionFolderDisplayName(): (name: string) => string {
  const t = useT();
  return useCallback(
    (name: string) => {
      const normalized = name.trim().toLowerCase();
      const key =
        normalized === 'favorites'
          ? 'common.favorite'
          : normalized === 'character'
            ? 'library.folders.character'
            : normalized === 'scene'
              ? 'library.folders.scene'
              : normalized === 'item'
                ? 'library.folders.item'
                : normalized === 'style'
                  ? 'library.folders.style'
                  : normalized === 'sound effect' || normalized === 'sound'
                    ? 'library.folders.sound'
                    : null;
      return key ? t(key) : name;
    },
    [t],
  );
}

/**
 * 官方 `R0e`（canvas @191734）：按 query 过滤「已连接节点」；query 为纯数字时把第 N 条提到最前。
 * 官方原文：`if(!n)return e; const o=e.filter(l=>l.label.toLowerCase().includes(n));
 *            if(!/^[1-9]\d*$/.test(n))return o; const r=Number(n),i=e[r-1];
 *            return i?[i,...o.filter(l=>l.id!==i.id)]:o`
 */
function filterLinkedItems(items: readonly MentionLinkedItem[], query: string): readonly MentionLinkedItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  const matched = items.filter((item) => String(item.label ?? '').toLowerCase().includes(normalized));
  if (!/^[1-9]\d*$/.test(normalized)) return matched;
  const quick = items[Number(normalized) - 1];
  return quick ? [quick, ...matched.filter((item) => item.id !== quick.id)] : matched;
}

/** 官方 `ow`（canvas @233863）：在可导航索引表里找上/下一条。 */
function navigateSelectableIndex(
  current: number,
  direction: 'up' | 'down',
  indices: readonly number[],
): number | null {
  if (indices.length === 0) return null;
  if (current < 0) return direction === 'down' ? indices[0] : indices[indices.length - 1];
  const at = indices.indexOf(current);
  if (at === -1) return direction === 'down' ? indices[0] : indices[indices.length - 1];
  if (direction === 'down') return at >= indices.length - 1 ? indices[indices.length - 1] : indices[at + 1];
  return at <= 0 ? indices[0] : indices[at - 1];
}

/* ------------------------------------------------------------------ *
 * 图标（官方 `Vi` / `dd`，逐字节内联 path；仓库未安装 `@tabler/icons-react`）
 * ------------------------------------------------------------------ */

/** 官方 `Vi`（canvas `import{iI as Vi}` ← vendor-libs `$Tt = p("outline","chevron-left","ChevronLeft",MSr)`，`MSr` @1965096）。 */
function MentionIconChevronLeft({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cx('tabler-icon', 'tabler-icon-chevron-left', className)}
      strokeWidth={2}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 6l-6 6l6 6" />
    </svg>
  );
}

/** 官方 `dd`（canvas `import{B as dd}` ← vendor-packages `export{nk as B}`，`nk` @258766）：文件夹图标（20 视框，stroke 1.5）。 */
function MentionIconFolder({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, aspectRatio: '1/1' }}
    >
      <path
        d="M13.2094 8.05177C13.6634 8.05177 14.0988 8.23211 14.4198 8.55312C14.7408 8.87413 14.9211 9.30951 14.9211 9.76348V15.3265C14.9211 15.7805 14.7408 16.2159 14.4198 16.5369C14.0988 16.8579 13.6634 17.0382 13.2094 17.0382H3.79505C3.34108 17.0382 2.9057 16.8579 2.58469 16.5369C2.26368 16.2159 2.08334 15.7805 2.08334 15.3265V7.62385C2.08334 7.16987 2.26368 6.73449 2.58469 6.41349C2.9057 6.09248 3.34108 5.91214 3.79505 5.91214H6.36261C6.56191 5.91214 6.75847 5.95854 6.93673 6.04767C7.11499 6.1368 7.27005 6.26621 7.38963 6.42565L7.90315 7.53826C8.02273 7.6977 8.17779 7.82711 8.35605 7.91624C8.53431 8.00537 8.73087 8.05177 8.93017 8.05177H13.2094Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.4153 13.5414C17.7363 13.2204 17.9167 12.785 17.9167 12.331V6.768C17.9167 6.31403 17.7363 5.87865 17.4153 5.55764C17.0943 5.23663 16.6589 5.05629 16.2049 5.05629H11.9257C11.7264 5.05629 11.5298 5.00989 11.3516 4.92076C11.1733 4.83163 11.0182 4.70222 10.8987 4.54278L10.3851 3.43017C10.2656 3.27073 10.1105 3.14132 9.93224 3.05219C9.75398 2.96306 9.55742 2.91666 9.35812 2.91666H6.79056C6.33659 2.91666 5.90121 3.097 5.5802 3.41801"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * props（MTV 注入式；命名贴官方语义）
 * ------------------------------------------------------------------ */

/**
 * 官方 `Re` 的插件项 = 官方 plugin 列表对象本体（`Ub` 里行读 `plugin.displayName` /
 * `plugin.pluginName` / `plugin.iconUrl`，行点击 `tt(plugin)` 再读
 * `skills` / `connectors` / `status` / `isInstalled` / `description`）。
 * ⇒ 直接用 `services/chat/mentionPlugins.ts` 的 `MentionPluginSource`，不再另造一层。
 */
export type MentionPanelPlugin = MentionPluginSource;

/** 官方 `et`/`Fe` 的元素项（渲染需要 `label`）。 */
export interface MentionPanelElement extends MentionElementItem {
  label: string;
  description?: string;
  avatar?: string;
}

/** 官方 `Ue`/`Ge`/`it` 的资产项（`Ik` 需要 `assetType` / `thumbnailUrl` / `complianceStatus`）。 */
export interface MentionPanelAsset extends MentionLibraryAsset {
  assetType?: number | string | null;
  thumbnailUrl?: string;
  sourceUrl?: string;
  complianceStatus?: number | string | null;
}

/** 官方 `me`/`He`/`Ce` 的文件夹项（官方 `ZN` 缩略图用 `coverThumbUrl` / `coverAssetType`）。 */
export interface MentionPanelFolder extends MentionLibraryFolder {
  coverThumbUrl?: string;
  coverAssetType?: number | string | null;
}

/** 官方 `N` 的指令分组（`Zwe` 需要 `label`）。 */
export interface MentionPanelDirectionGroup extends MentionDirectionGroup {
  label: string;
  selectionMode?: string;
  options: MentionPanelDirectionOption[];
}

/** 官方 `N[].options[]`（渲染需要 `label`）。 */
export interface MentionPanelDirectionOption extends MentionDirectionOption {
  label: string;
}

/** 官方 `at`/`ee` 的「选择文件夹」入参（官方构造 `{id,name,assetCount:0}`）。 */
export interface MentionPanelFolderRef {
  id: string;
  name: string;
  assetCount: number;
}

export interface MentionSuggestionPanelProps {
  /** 官方 `items`（`e`）：MTV 侧即「已连接节点」组。 */
  items: readonly MentionSuggestionItem[];
  /** 官方 `query`（`t`）。`enableAssetLibrary` 为真时改用内部搜索框（官方 `I = r ? T : t`）。 */
  query?: string;
  selectedIndex: number;
  /** 官方 `onSelect(item)`。linked 行（以及指令项）走它。 */
  onSelect: (item: MentionSuggestionItem) => void;
  /** MTV 侧悬停回调：官方 `u`（`setSelectedIndex`）触发时一并回调，保持旧调用方语义。 */
  onHover: (index: number) => void;
  /** 官方空态文案键 `omniReference.suggestion.noResults`（MTV 侧优先用调用方注入的文案）。 */
  emptyLabel: string;
  /** 官方 `onClose`（`g`）：删掉光标前的 `@query`。 */
  onClose?: () => void;
  /** 官方 `matchContainerWidth`（= `B4` 的 `matchEditorWidth`）。 */
  matchContainerWidth?: boolean;
  /** 官方 `setSelectedIndex`（`u`）：内部（悬停 / 翻页 / 面包屑）改选中索引。 */
  setSelectedIndex?: (index: number) => void;
  /** 官方 `setTotalItemCount`（`d`）：上报**可导航**条数（官方 `We.length`）。 */
  setTotalItemCount?: (count: number) => void;
  /** 官方 `setKeyDownInterceptor`（`c`）：内部劫持方向键 / 回车 / 退出。 */
  setKeyDownInterceptor?: (interceptor: ((event: KeyboardEvent) => boolean) | null) => void;

  /* ── 官方 `Ub` 的域数据（MTV 以 props 注入，默认空 / 关） ── */

  /** 官方 `enableAssetLibrary`（`r`）。 */
  enableAssetLibrary?: boolean;
  /** 官方 `enableElementLibrary`（`i`）。 */
  enableElementLibrary?: boolean;
  /** 官方 `showPlugins`（`v`）。 */
  showPlugins?: boolean;
  /** 官方 `selectFolders`（`m`）。 */
  selectFolders?: boolean;
  /** 官方 `libraryMentionMode`（`p`，默认 `"asset-node"`）。 */
  libraryMentionMode?: string;
  /** 官方 `linkedSectionLabel`（`l`）。 */
  linkedSectionLabel?: string;
  /** 官方 `mentionUnavailableMessage`（`f`）。 */
  mentionUnavailableMessage?: string;
  /** 官方 `getDisabledAssetTypes()`（`h` → `S`）。 */
  getDisabledAssetTypes?: () => Set<string>;
  /** 官方 `getDirectionItems()`（`x` → `N`）。 */
  getDirectionItems?: () => MentionPanelDirectionGroup[];
  /** 官方 `Ee` 的 `y?.(groupId, optionId, label)`。 */
  onDirectionOptionSelect?: (groupId: string, optionId: string, label: string) => void;
  /** 官方 `_e` 的 `b?.(group)`（`selectionMode === "direct"` 时直接选中）。 */
  onDirectionGroupSelect?: (group: MentionPanelDirectionGroup) => void;

  /** 官方 `Re`：插件列表。 */
  plugins?: readonly MentionPanelPlugin[];
  /** 官方 `ie`：插件加载中。 */
  pluginsLoading?: boolean;
  /** 官方 `ae`：连接器状态表 `Map<connectorName, status>`（喂 `I1` 合并状态）。 */
  connectorStatusById?: ReadonlyMap<string, MentionConnectorStatus>;

  /** 官方 `et`：私有元素。 */
  privateElements?: readonly MentionPanelElement[];
  /** 官方 `Fe`：团队元素。 */
  teamElements?: readonly MentionPanelElement[];
  /** 官方 `Ve`：元素加载中。 */
  elementsLoading?: boolean;
  /** 官方 `ue`：元素加载失败。 */
  elementsError?: boolean;
  /** 官方 `le`：元素重试。 */
  onElementsRetry?: () => void;

  /** 官方 `Ue`：私有资产（资产列表态）。 */
  privateAssets?: readonly MentionPanelAsset[];
  /** 官方 `Ge`：团队资产（资产列表态）。 */
  teamAssets?: readonly MentionPanelAsset[];
  /** 官方 `me`：私有文件夹（文件夹列表态）。 */
  privateFolders?: readonly MentionPanelFolder[];
  /** 官方 `He`：团队文件夹（文件夹列表态）。 */
  teamFolders?: readonly MentionPanelFolder[];
  /** 官方 `Te`/`Ie`（`Se`）：资产库加载中。 */
  libraryLoading?: boolean;

  /** 官方 `Ce`：当前下钻文件夹的子文件夹（`fe(Y.id)`）。 */
  folders?: readonly MentionPanelFolder[];
  /** 官方 `it`：当前下钻文件夹的资产（`ye(Y.id)`）。 */
  assets?: readonly MentionPanelAsset[];
  /** 官方 `Be`：当前下钻文件夹的资产加载中（`he(Y.id)`）。 */
  folderAssetsLoading?: boolean;

  /** 官方 `de(folder, path, space)`：文件夹主操作（下钻）。 */
  onFolderPrimaryAction?: (folder: MentionLibraryFolder, path: string, space: string) => void;
  /** 官方 `ee(folder, path)`：选中文件夹本身（面包屑「引用当前文件夹」/ `selectCurrentFolder` 行）。 */
  onFolderSelect?: (folder: MentionPanelFolderRef, path: string) => void;
  /** 官方 `J(asset, path)`：选中资产。 */
  onAssetSelect?: (asset: MentionLibraryAsset, path: string) => void;
  /** 官方 `ce(item)`：选中元素。 */
  onElementSelect?: (item: MentionPanelElement) => void;
  /** 官方 `at()`：文件夹下钻返回。 */
  onBackToFolders?: () => void;
}

const NO_FOLDERS: readonly never[] = [];
const NO_ASSETS: readonly never[] = [];
const NO_PLUGINS: readonly never[] = [];
const NO_ELEMENTS: readonly never[] = [];
/** `getDirectionItems()` 缺失时的稳定空数组（稳定引用，避免 useMemo 依赖每次变化）。 */
const NO_DIRECTIONS: MentionPanelDirectionGroup[] = [];

/** 官方 `q` 栈元素（= `MentionCurrentFolder`）。 */
interface MentionViewStackEntry {
  id: string;
  name: string;
  path: string;
  space: string;
}

/** 官方 `Nt.current` 的快照（interceptor / 键盘回调读它，避免闭包过期）。 */
interface MentionHandlerSnapshot {
  rows: MentionRow[];
  navigableIndices: number[];
  activateRow: (row: MentionRow | undefined) => boolean;
  goBackToFolders: () => void;
  goBackFromDirectionGroup: () => void;
  drillIntoDirectionGroup: (group: MentionPanelDirectionGroup) => void;
  folderDrilldown: boolean;
  directionDrilldown: boolean;
}

/**
 * 官方 `Ub`（`@` 建议弹层本体）。
 *
 * MTV 侧：官方内部 store 的「资产库 / 元素库 / 插件 / 指令」数据全部由 props 注入，
 * 默认空 / 关 ⇒ 只传 `items` 时行为与旧版（只渲染 `items` / 空态）一致。
 */
function MentionSuggestionPanel({
  items,
  query = '',
  selectedIndex,
  onSelect,
  onHover,
  emptyLabel,
  onClose,
  matchContainerWidth = false,
  setSelectedIndex: setSelectedIndexProp,
  setTotalItemCount,
  setKeyDownInterceptor,
  enableAssetLibrary = false,
  enableElementLibrary = false,
  showPlugins = false,
  selectFolders = false,
  libraryMentionMode = 'asset-node',
  linkedSectionLabel,
  mentionUnavailableMessage,
  getDisabledAssetTypes,
  getDirectionItems,
  onDirectionOptionSelect,
  onDirectionGroupSelect,
  plugins = NO_PLUGINS,
  pluginsLoading = false,
  connectorStatusById,
  privateElements = NO_ELEMENTS,
  teamElements = NO_ELEMENTS,
  elementsLoading = false,
  elementsError = false,
  onElementsRetry,
  privateAssets = NO_ASSETS,
  teamAssets = NO_ASSETS,
  privateFolders = NO_FOLDERS,
  teamFolders = NO_FOLDERS,
  libraryLoading = false,
  folders = NO_FOLDERS,
  assets = NO_ASSETS,
  folderAssetsLoading = false,
  onFolderPrimaryAction,
  onFolderSelect,
  onAssetSelect,
  onElementSelect,
  onBackToFolders,
}: MentionSuggestionPanelProps) {
  /* 官方 `libraryMentionMode`（`p`）只影响 `Le`/`ce`/`J`/`ee` 在 `agent-reference` 模式下的域转换器
     （`nc`/`r_e`/`a_e`/`i_e`/`B3` 均未移植）⇒ 保留入参，不参与本次渲染。 */
  void libraryMentionMode;

  const t = useT();
  /** `useT()` 已订阅语言变化 ⇒ 每次重渲染取到的 `locale` 都是最新的。 */
  const locale = getLocale();
  /** 官方 `C("omniReference.…")`：走 `mentionStrings.ts` 的官方 `omniReference.*` 表。 */
  const tm = useCallback(
    (path: string, params?: Record<string, string | number>) => mentionString(path, { locale, params }),
    [locale],
  );
  const folderDisplayName = useMentionFolderDisplayName();

  /** 官方 `S = h?.()`：每次渲染重新求值（与官方一致）。 */
  const disabledAssetTypes = getDisabledAssetTypes?.() ?? null;
  /** 官方 `N = x?.()`。 */
  const directions = getDirectionItems?.() ?? NO_DIRECTIONS;

  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /** 官方 `j`/`D`/`O`/`U`/`G`/`H`：各分组「展开更多」。 */
  const [showAllLinked, setShowAllLinked] = useState(false);
  const [showAllPlugins, setShowAllPlugins] = useState(false);
  const [showAllPrivate, setShowAllPrivate] = useState(false);
  const [showAllTeam, setShowAllTeam] = useState(false);
  const [showAllPrivateElements, setShowAllPrivateElements] = useState(false);
  const [showAllTeamElements, setShowAllTeamElements] = useState(false);
  /** 官方 `W`：当前下钻的指令组。 */
  const [activeDirectionGroup, setActiveDirectionGroup] = useState<MentionPanelDirectionGroup | null>(null);
  /** 官方 `q`：文件夹下钻栈（官方初值 `__initialViewStateStack`；MTV 由 `onFolderPrimaryAction` 驱动）。 */
  const [viewStack, setViewStack] = useState<readonly MentionViewStackEntry[]>([]);

  /* 官方：`r && requestAnimationFrame(() => k.current?.focus())`（deps `[r]`）。 */
  useEffect(() => {
    if (!enableAssetLibrary) return;
    const handle = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(handle);
  }, [enableAssetLibrary]);

  /** 官方 `I = r ? T : t`。 */
  const activeQuery = enableAssetLibrary ? search : query;
  /** 官方 `Z = I.trim().length > 0`。 */
  const assetListView = activeQuery.trim().length > 0;
  /** 官方 `Ms = Z ? I.trim() : void 0`。 */
  const highlightKeyword = assetListView ? activeQuery.trim() : undefined;

  /** 官方 `Y = q.length>0 ? q[q.length-1] : null`。 */
  const currentFolder = viewStack.length > 0 ? viewStack[viewStack.length - 1] : null;
  /** 官方 `Ke = W !== null && !Z`。 */
  const directionDrilldown = activeDirectionGroup !== null && !assetListView;
  /** 官方 `je = Y !== null && !Z`。 */
  const folderDrilldown = currentFolder !== null && !assetListView;
  /** 官方 `Ze = (N?.length ?? 0) > 0`。 */
  const hasDirections = directions.length > 0;

  /** 官方 `Oe = R0e(e, Z ? I : "")`。 */
  const filteredLinked = useMemo(
    () =>
      filterLinkedItems(
        items.map((item) => ({
          id: item.id,
          label: item.label,
          description: item.description,
          type: item.type,
          avatar: item.avatar,
          videoSrc: item.videoSrc,
        })),
        assetListView ? activeQuery : '',
      ),
    [items, assetListView, activeQuery],
  );
  /** 官方 `xe`：id → 序号（`#n` 快捷编号）。 */
  const shortcutNumbers = useMemo(
    () => new Map(items.map((item, index) => [item.id, index + 1] as const)),
    [items],
  );

  /* ── 官方 `be`：行序列（复用仓库已移植的行模型） ── */
  const rows = useMemo<MentionRow[]>(
    () =>
      buildMentionRows({
        folderDrilldown,
        activeDirectionGroup,
        currentFolder,
        subFolders: folders,
        folderAssets: assets,
        linked: filteredLinked,
        linkedExpanded: showAllLinked,
        plugins,
        pluginsExpanded: showAllPlugins,
        privateElements,
        privateElementsExpanded: showAllPrivateElements,
        teamElements,
        teamElementsExpanded: showAllTeamElements,
        privateAssets,
        privateAssetsExpanded: showAllPrivate,
        teamAssets,
        teamAssetsExpanded: showAllTeam,
        privateFolders,
        teamFolders,
        directions,
        assetListView,
        enableAssetLibrary,
        enableElementLibrary,
        showPlugins,
        selectFolders,
        displayName: (folder) => folderDisplayName(folder.name),
      }),
    // 官方 deps 数组为 `[je,Ke,W,Ce,it,D,j,Oe,r,Z,O,Ue,U,Ge,me,He,Y,Ne,Ze,N,v,Re,i,G,et,H,Fe,m]`，
    // 以下一一对应（`Ne` = folderDisplayName，`Re` = plugins，`D` = showAllPlugins…）。
    // 官方的 `Ke`(directionDrilldown) 与 `Ze`(hasDirections) 由 `W`/`N` 派生，属冗余依赖，此处省略。
    [
      folderDrilldown,
      activeDirectionGroup,
      folders,
      assets,
      showAllPlugins,
      showAllLinked,
      filteredLinked,
      enableAssetLibrary,
      assetListView,
      showAllPrivate,
      privateAssets,
      showAllTeam,
      teamAssets,
      privateFolders,
      teamFolders,
      currentFolder,
      folderDisplayName,
      directions,
      showPlugins,
      plugins,
      enableElementLibrary,
      showAllPrivateElements,
      privateElements,
      showAllTeamElements,
      teamElements,
      selectFolders,
    ],
  );

  /** 官方 `We`：可导航索引（被禁用类型命中的行 → `-1`，再过滤掉 `-1`）。 */
  const navigableIndices = useMemo(
    () =>
      mentionRowSelectableIndices(rows, (item) => !!(item.type && disabledAssetTypes?.has(item.type))).filter(
        (index) => index >= 0,
      ),
    [rows, disabledAssetTypes],
  );

  /** 官方 `S`/`We` 变化后 `d?.(We.length)`。 */
  useEffect(() => {
    setTotalItemCount?.(navigableIndices.length);
  }, [navigableIndices.length, setTotalItemCount]);

  /* ── 派生标志（官方 `_ub_fmt.txt` 1651–1714 逐字） ── */

  /** 官方 `Et = j ? Oe : Oe.slice(0, Zo)`。 */
  const visibleLinked = showAllLinked ? filteredLinked : filteredLinked.slice(0, MENTION_SECTION_LIMIT);
  /** 官方 `dn = Oe.length - Zo`。 */
  const linkedMoreCount = filteredLinked.length - MENTION_SECTION_LIMIT;
  /** 官方 `yn = Oe.length > 0`。 */
  const linkedVisible = filteredLinked.length > 0;
  /** 官方 `Cn = !j && dn>0 ? be.findIndex(showMoreLinked) : -1`。 */
  const showMoreLinkedIndex =
    !showAllLinked && linkedMoreCount > 0 ? rows.findIndex((row) => row.kind === 'showMoreLinked') : -1;

  /** 官方 `Re = v ? re : []`。 */
  const pluginSource = showPlugins ? plugins : NO_PLUGINS;
  /** 官方 `ve = v && (De || ie)`。 */
  const pluginsVisible = showPlugins && (pluginSource.length > 0 || pluginsLoading);
  /** 官方 `gn = D ? Re : Re.slice(0, Zo)`。 */
  const visiblePlugins = showAllPlugins ? pluginSource : pluginSource.slice(0, MENTION_SECTION_LIMIT);
  /** 官方 `xo = Re.length - Zo`。 */
  const pluginsMoreCount = pluginSource.length - MENTION_SECTION_LIMIT;
  /** 官方 `Gt = !D && xo>0 ? be.findIndex(showMorePlugins) : -1`。 */
  const showMorePluginsIndex =
    !showAllPlugins && pluginsMoreCount > 0 ? rows.findIndex((row) => row.kind === 'showMorePlugins') : -1;

  /** 官方 `Sn = G ? et : et.slice(0, Zo)`。 */
  const visiblePrivateElements = showAllPrivateElements
    ? privateElements
    : privateElements.slice(0, MENTION_SECTION_LIMIT);
  /** 官方 `On = et.length - Zo`。 */
  const privateElementsMoreCount = privateElements.length - MENTION_SECTION_LIMIT;
  /** 官方 `yo = H ? Fe : Fe.slice(0, Zo)`。 */
  const visibleTeamElements = showAllTeamElements ? teamElements : teamElements.slice(0, MENTION_SECTION_LIMIT);
  /** 官方 `uo = Fe.length - Zo`。 */
  const teamElementsMoreCount = teamElements.length - MENTION_SECTION_LIMIT;
  /** 官方 `Vo = et.length>0 || Fe.length>0`。 */
  const elementsAny = privateElements.length > 0 || teamElements.length > 0;
  /** 官方 `zo = Ve || ue || Vo`。 */
  const elementsBlockVisible = elementsLoading || elementsError || elementsAny;

  /** 官方 `Xo = O ? Ue : Ue.slice(0, Zo)`。 */
  const visiblePrivateAssets = showAllPrivate ? privateAssets : privateAssets.slice(0, MENTION_SECTION_LIMIT);
  /** 官方 `ir = Ue.length - Zo`。 */
  const privateAssetsMoreCount = privateAssets.length - MENTION_SECTION_LIMIT;
  /** 官方 `ar = U ? Ge : Ge.slice(0, Zo)`。 */
  const visibleTeamAssets = showAllTeam ? teamAssets : teamAssets.slice(0, MENTION_SECTION_LIMIT);
  /** 官方 `Sr = Ge.length - Zo`。 */
  const teamAssetsMoreCount = teamAssets.length - MENTION_SECTION_LIMIT;
  /** 官方 `Cs = O ? me : me.slice(0, Zo)`。 */
  const visiblePrivateFolders = showAllPrivate ? privateFolders : privateFolders.slice(0, MENTION_SECTION_LIMIT);
  /** 官方 `Uo = me.length - Zo`。 */
  const privateFoldersMoreCount = privateFolders.length - MENTION_SECTION_LIMIT;
  /** 官方 `Wn = U ? He : He.slice(0, Zo)`。 */
  const visibleTeamFolders = showAllTeam ? teamFolders : teamFolders.slice(0, MENTION_SECTION_LIMIT);
  /** 官方 `ps = He.length - Zo`。 */
  const teamFoldersMoreCount = teamFolders.length - MENTION_SECTION_LIMIT;
  /** 官方 `bn = Z ? Ue.length>0 : me.length>0`。 */
  const privateLibraryVisible = assetListView ? privateAssets.length > 0 : privateFolders.length > 0;
  /** 官方 `hn = Z ? Ge.length>0 : He.length>0`。 */
  const teamLibraryVisible = assetListView ? teamAssets.length > 0 : teamFolders.length > 0;

  /** 官方 `to = v && ie && re.length===0 && !Z`。 */
  const pluginsLoadingEmpty = showPlugins && pluginsLoading && plugins.length === 0 && !assetListView;
  /** 官方 `Gn = r && !to`。 */
  const libraryEnabled = enableAssetLibrary && !pluginsLoadingEmpty;
  /** 官方 `Se = Z ? Te : Ie`。 */
  const librarySectionLoading = libraryLoading;
  /** 官方 `js = ve || yn || zo`。 */
  const sectionsVisible = pluginsVisible || linkedVisible || elementsBlockVisible;
  /** 官方 `no`。 */
  const anyContentVisible =
    linkedVisible ||
    pluginsVisible ||
    elementsBlockVisible ||
    (libraryEnabled && (librarySectionLoading || privateLibraryVisible || teamLibraryVisible));
  /** 官方 `Nr`：空态。 */
  const showNoResults =
    !mentionUnavailableMessage &&
    !linkedVisible &&
    (!enableElementLibrary || (!elementsLoading && !elementsError && !elementsAny)) &&
    (!libraryEnabled || (!librarySectionLoading && !privateLibraryVisible && !teamLibraryVisible)) &&
    !hasDirections &&
    !pluginsVisible;

  /* ── 选中索引：官方 `u`。MTV 额外回调 `onHover` 以保持既有调用方语义。 ── */
  const applySelectedIndex = useCallback(
    (index: number) => {
      setSelectedIndexProp?.(index);
      onHover(index);
    },
    [setSelectedIndexProp, onHover],
  );

  /* ── 容器级悬停（官方 `Ct`，`_ub_fmt.txt` 1144–1197 逐字） ── */
  const hoverPointRef = useRef<{ x: number; y: number; idx: number } | null>(null);
  const keyboardNavRef = useRef(false);
  const inputMethodRef = useRef<'keyboard' | 'mouse' | null>(null);
  const selectedIndexRef = useRef(selectedIndex);
  /* 官方在渲染期直接 `yt.current = n`；React 19 的 `react-hooks/refs` 规则禁止渲染期写 ref，
     因此改到 effect 里同步（事件回调总是在 effect 之后触发，语义等价）。 */
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const handleContainerMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const { clientX, clientY } = event;
      const last = hoverPointRef.current;
      if (last?.x === clientX && last?.y === clientY) return;
      /* 官方 `ft.current && (ft.current = !1)`。 */
      if (keyboardNavRef.current) keyboardNavRef.current = false;
      const target = (event.target as Element).closest('[data-selectable-index]');
      if (!target) {
        hoverPointRef.current = { x: clientX, y: clientY, idx: -1 };
        return;
      }
      const index = parseInt(target.getAttribute('data-selectable-index') ?? '', 10);
      if (Number.isNaN(index)) return;
      const previousIndex = last?.idx ?? -1;
      hoverPointRef.current = { x: clientX, y: clientY, idx: index };
      if (index !== previousIndex) {
        selectedIndexRef.current = index;
        inputMethodRef.current = 'mouse';
        applySelectedIndex(index);
      }
    },
    [applySelectedIndex],
  );

  /** 官方 `pt`：键盘选中。 */
  const selectByKeyboard = useCallback(
    (index: number) => {
      selectedIndexRef.current = index;
      keyboardNavRef.current = true;
      inputMethodRef.current = 'keyboard';
      applySelectedIndex(index);
    },
    [applySelectedIndex],
  );

  /* ── 官方 `Pe`/`at`/`_e`/`Xe`/`Ee`/`Le`：域操作 ── */

  const drillIntoFolder = useCallback(
    (folder: MentionLibraryFolder, path: string, space: string) => {
      setViewStack((stack) => [...stack, { id: folder.id, name: folderDisplayName(folder.name), path, space }]);
      applySelectedIndex(0);
    },
    [folderDisplayName, applySelectedIndex],
  );

  /** 官方 `at`：出栈一层；同时通知调用方（MTV 侧用于清掉自己的下钻数据）。 */
  const goBackToFolders = useCallback(() => {
    onBackToFolders?.();
    setViewStack((stack) => stack.slice(0, -1));
    applySelectedIndex(0);
  }, [onBackToFolders, applySelectedIndex]);

  /** 官方 `Xe`。 */
  const goBackFromDirectionGroup = useCallback(() => {
    setActiveDirectionGroup(null);
    applySelectedIndex(0);
  }, [applySelectedIndex]);

  /** 官方 `_e`。 */
  const drillIntoDirectionGroup = useCallback(
    (group: MentionPanelDirectionGroup) => {
      if (group.selectionMode === 'direct' && onDirectionGroupSelect?.(group)) {
        onClose?.();
        return;
      }
      setActiveDirectionGroup(group);
      applySelectedIndex(0);
    },
    [onClose, onDirectionGroupSelect, applySelectedIndex],
  );

  /** 官方 `Ee(option, groupId)`。 */
  const selectDirectionOption = useCallback(
    (option: MentionPanelDirectionOption, groupId: string) => {
      onDirectionOptionSelect?.(groupId, option.id, option.label);
      onSelect({
        id: `direction_option:${option.id}`,
        label: option.label,
        type: `direction_${groupId}`,
        renderText: `direction:${groupId}:${option.id}:${option.label}`,
      });
    },
    [onDirectionOptionSelect, onSelect],
  );

  /** 官方 `Le`（`agent-reference` 模式的 `renderText` 补全未移植）。 */
  const selectLinkedItem = useCallback(
    (item: MentionLinkedItem) => onSelect({ ...item, label: item.label ?? '' }),
    [onSelect],
  );

  /** 官方 `de` = `Pe`。 */
  const handleFolderPrimaryAction = useCallback(
    (folder: MentionLibraryFolder, path: string, space: string) => {
      onFolderPrimaryAction?.(folder, path, space);
      drillIntoFolder(folder, path, space);
    },
    [onFolderPrimaryAction, drillIntoFolder],
  );

  /* ── 官方 `activateRow`：回车主操作（interceptor 与搜索框共用） ── */
  const activateRow = useCallback(
    (row: MentionRow | undefined): boolean => {
      if (!row) return false;
      switch (row.kind) {
        case 'linked':
          selectLinkedItem(row.item);
          return true;
        case 'showMoreLinked':
          setShowAllLinked(true);
          return true;
        case 'privateElement':
        case 'teamElement':
          onElementSelect?.(row.item as MentionPanelElement);
          return true;
        case 'showMorePrivateElements':
          setShowAllPrivateElements(true);
          return true;
        case 'showMoreTeamElements':
          setShowAllTeamElements(true);
          return true;
        case 'showMorePlugins':
          setShowAllPlugins(true);
          return true;
        case 'privateFolder':
        case 'teamFolder':
        case 'subFolder':
          handleFolderPrimaryAction(row.folder, row.path, row.space);
          return true;
        case 'showMorePrivateFolders':
        case 'showMorePrivate':
          setShowAllPrivate(true);
          return true;
        case 'showMoreTeamFolders':
        case 'showMoreTeam':
          setShowAllTeam(true);
          return true;
        case 'privateAsset':
        case 'teamAsset':
        case 'folderAsset':
          onAssetSelect?.(row.asset, row.path);
          return true;
        case 'backToFolders':
          goBackToFolders();
          return true;
        case 'selectCurrentFolder':
          onFolderSelect?.({ id: row.folder.id, name: row.folder.name, assetCount: 0 }, row.folder.path);
          return true;
        case 'directionGroup':
          drillIntoDirectionGroup(row.group as MentionPanelDirectionGroup);
          return true;
        case 'backToDirectionList':
          goBackFromDirectionGroup();
          return true;
        case 'directionOption':
          selectDirectionOption(row.option as MentionPanelDirectionOption, row.groupId);
          return true;
        case 'plugin':
          /* 官方 `tt(plugin)`（键盘激活路径）：造 mention 项再交给 `onSelect`。 */
          onSelect(buildMentionSuggestionPluginItem(
            row.plugin as MentionPanelPlugin,
            mentionPluginConnectorStatus(row.plugin as MentionPanelPlugin, connectorStatusById),
          ));
          return true;
        default:
          return false;
      }
    },
    [
      selectLinkedItem,
      onElementSelect,
      handleFolderPrimaryAction,
      onAssetSelect,
      goBackToFolders,
      onFolderSelect,
      drillIntoDirectionGroup,
      goBackFromDirectionGroup,
      selectDirectionOption,
      onSelect,
      connectorStatusById,
    ],
  );

  /** 官方 `Nt.current`：interceptor / 键盘回调读的最新闭包快照。 */
  const handlerRef = useRef<MentionHandlerSnapshot>({
    rows,
    navigableIndices,
    activateRow,
    goBackToFolders,
    goBackFromDirectionGroup,
    drillIntoDirectionGroup,
    folderDrilldown,
    directionDrilldown,
  });
  /* 官方在渲染期直接 `Nt.current = {...}`；这里改到「每次渲染后」的 effect（无 deps 数组），
     等价于渲染期赋值，且满足 `react-hooks/refs`。 */
  useEffect(() => {
    handlerRef.current = {
      rows,
      navigableIndices,
      activateRow,
      goBackToFolders,
      goBackFromDirectionGroup,
      drillIntoDirectionGroup,
      folderDrilldown,
      directionDrilldown,
    };
  });

  /* 官方 keydown interceptor（`_ub_fmt.txt` 1256–1425）。 */
  useEffect(() => {
    setKeyDownInterceptor?.((event: KeyboardEvent) => {
      const state = handlerRef.current;
      const row = state.rows[selectedIndexRef.current];
      if (event.key === 'Escape' || event.key === 'ArrowLeft') {
        if (state.directionDrilldown) {
          state.goBackFromDirectionGroup();
          return true;
        }
        if (state.folderDrilldown) {
          state.goBackToFolders();
          return true;
        }
        return false;
      }
      if (event.key === 'ArrowRight') {
        if (!row) return false;
        if (row.kind === 'privateFolder' || row.kind === 'teamFolder' || row.kind === 'subFolder') {
          handleFolderPrimaryAction(row.folder, row.path, row.space);
          return true;
        }
        if (row.kind === 'directionGroup') {
          state.drillIntoDirectionGroup(row.group as MentionPanelDirectionGroup);
          return true;
        }
        return false;
      }
      if (event.key === 'Tab') {
        const next = navigateSelectableIndex(
          selectedIndexRef.current,
          event.shiftKey ? 'up' : 'down',
          state.navigableIndices,
        );
        if (next === null) return false;
        event.preventDefault();
        event.stopPropagation();
        selectByKeyboard(next);
        return true;
      }
      if (event.key === 'Enter') {
        if (!row) return false;
        return state.activateRow(row);
      }
      return false;
    });
    return () => setKeyDownInterceptor?.(null);
  }, [setKeyDownInterceptor, selectByKeyboard, handleFolderPrimaryAction]);

  /** 官方 `Vn`：搜索框按键。 */
  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const state = handlerRef.current;
      const row = state.rows[selectedIndexRef.current];
      if (event.key === 'Escape') {
        event.preventDefault();
        if (state.folderDrilldown) state.goBackToFolders();
        else onClose?.();
        return;
      }
      if (event.key === 'Backspace') {
        if (event.currentTarget.value === '') {
          event.preventDefault();
          onClose?.();
        }
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        const next = navigateSelectableIndex(
          selectedIndexRef.current,
          event.key === 'ArrowDown' ? 'down' : 'up',
          state.navigableIndices,
        );
        if (next === null) return;
        selectByKeyboard(next);
        return;
      }
      if (event.key === 'Tab') {
        const next = navigateSelectableIndex(
          selectedIndexRef.current,
          event.shiftKey ? 'up' : 'down',
          state.navigableIndices,
        );
        if (next === null) return;
        event.preventDefault();
        event.stopPropagation();
        selectByKeyboard(next);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (!row) return;
        state.activateRow(row);
      }
    },
    [onClose, selectByKeyboard],
  );

  /** 官方 `En`：搜索框失焦 —— 焦点仍在面板内则抢回，否则关闭。 */
  const handleSearchBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      const panel = event.currentTarget.closest('[data-mention-panel]');
      if (panel && event.relatedTarget && panel.contains(event.relatedTarget)) {
        requestAnimationFrame(() => searchRef.current?.focus());
        return;
      }
      requestAnimationFrame(() => onClose?.());
    },
    [onClose],
  );

  /* ── 官方 `qr`：搜索行（仅 `enableAssetLibrary`） ── */
  const searchRow = enableAssetLibrary ? (
    <MentionLibrarySearchInput
      value={search}
      onChange={setSearch}
      onKeyDown={handleSearchKeyDown}
      onBlur={handleSearchBlur}
      placeholder={t('library.search')}
      inputRef={searchRef}
      wrapperClassName="px-0 pt-0 pb-0"
      barClassName={SEARCH_BAR_CLASS}
    />
  ) : null;

  /** 官方 `Us`。 */
  const rootClassName = cx(
    SURFACE_CLASS,
    matchContainerWidth ? 'flex w-full min-w-0 flex-col' : 'flex flex-col w-[320px]',
    enableAssetLibrary ? 'h-[320px]' : 'max-h-[320px]',
  );

  const noResultsLabel = emptyLabel || tm('omniReference.suggestion.noResults');

  const renderSkeletonBlock = (className: string, key: string) => (
    <MentionSkeletonBlock className={className} key={key} />
  );

  /* ① 官方 `Nr`：空态（1735–1764）。 */
  if (showNoResults) {
    return (
      <div
        className={rootClassName}
        style={SURFACE_STYLE}
        data-mention-panel=""
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className={BODY_CLASS}>
          {searchRow}
          <div className={NO_RESULTS_CLASS}>{noResultsLabel}</div>
        </div>
      </div>
    );
  }

  /* ② 官方 `Ke && W`：指令组下钻（1765–1857）。官方此处**没有** `data-mention-panel`，照抄。 */
  if (directionDrilldown && activeDirectionGroup) {
    return (
      <div className={rootClassName} style={SURFACE_STYLE} onMouseDown={(event) => event.preventDefault()}>
        <div className={BODY_CLASS}>
          <MentionScrollFade
            ref={scrollRef}
            deps={[activeDirectionGroup.options.length]}
            className={cx(SCROLL_CLASS, 'gap-[2px]')}
            onMouseMove={handleContainerMouseMove}
          >
            <button
              type="button"
              data-selectable-index={0}
              className={cx(MENTION_ROW_CLASS, selectedIndex === 0 && MENTION_ROW_SELECTED_CLASS)}
              onClick={goBackFromDirectionGroup}
            >
              <MentionIconChevronLeft size={16} className="shrink-0 text-white/60" />
              <span className="flex-1 min-w-0 text-xs font-medium leading-[1.3] text-white/60 tracking-[0.48px] truncate">
                {activeDirectionGroup.label}
              </span>
            </button>
            {activeDirectionGroup.options.map((option, index) => {
              const optionIndex = index + 1;
              return (
                <button
                  key={option.id}
                  type="button"
                  data-selectable-index={optionIndex}
                  className={cx(MENTION_ROW_CLASS, optionIndex === selectedIndex && MENTION_ROW_SELECTED_CLASS)}
                  onClick={() => selectDirectionOption(option, activeDirectionGroup.id)}
                >
                  <span className="flex-1 min-w-0 text-sm font-medium leading-5 text-white/90 truncate">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </MentionScrollFade>
        </div>
      </div>
    );
  }

  /* ③ 官方 `je && Y`：文件夹下钻（1858–2080）。 */
  if (folderDrilldown && currentFolder) {
    /** 官方 `Ye = m ? 2 : 1`：行索引偏移。 */
    const rowOffset = selectFolders ? 2 : 1;
    return (
      <div
        className={rootClassName}
        style={SURFACE_STYLE}
        data-mention-panel=""
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className={BODY_CLASS}>
          {searchRow}
          <MentionScrollFade
            ref={scrollRef}
            deps={[folders.length, assets.length, folderAssetsLoading]}
            className={cx(SCROLL_CLASS, 'gap-[2px]')}
            onMouseMove={handleContainerMouseMove}
          >
            <div className="flex h-8 w-full min-w-0 items-center gap-1 px-1">
              <button
                type="button"
                data-selectable-index={0}
                className={cx(
                  'group flex size-8 shrink-0 items-center justify-center rounded-[8px] text-white/60 transition-colors hover:bg-white/10 hover:text-white/90',
                  selectedIndex === 0 && 'bg-white/10 text-white/90',
                )}
                aria-label={`${t('common.back')}: ${currentFolder.name}`}
                title={t('common.back')}
                onClick={goBackToFolders}
              >
                <MentionIconChevronLeft size={16} className="shrink-0" />
              </button>
              <span
                className="min-w-0 flex-1 truncate px-1 text-[13px] font-medium leading-5 text-white/80"
                title={currentFolder.name}
              >
                {currentFolder.name}
              </span>
              {selectFolders ? (
                <button
                  type="button"
                  data-selectable-index={1}
                  className={cx(
                    'inline-flex h-8 shrink-0 items-center gap-1 rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-2 text-xs font-medium leading-5 text-white/70 transition-colors hover:border-white/[0.12] hover:bg-white/10 hover:text-white/90',
                    selectedIndex === 1 && 'border-white/[0.14] bg-white/10 text-white/90',
                  )}
                  onClick={() =>
                    onFolderSelect?.(
                      { id: currentFolder.id, name: currentFolder.name, assetCount: 0 },
                      currentFolder.path,
                    )
                  }
                >
                  <MentionIconFolder size={13} className="shrink-0 text-current" />
                  {t('omniReference.suggestion.referenceCurrentFolder')}
                </button>
              ) : null}
            </div>
            <MentionSeparator />
            {folders.map((folder, index) => {
              const globalIndex = index + rowOffset;
              /** 官方 `zt = My(Y.path, Ne(vt))`。 */
              const path = mentionFolderPath(currentFolder.space, folderDisplayName(folder.name));
              return (
                <MentionFolderRow
                  key={folder.id}
                  displayName={folderDisplayName(folder.name)}
                  globalIndex={globalIndex}
                  isSelected={globalIndex === selectedIndex}
                  onClick={() => handleFolderPrimaryAction(folder, path, currentFolder.space)}
                  trailingIcon={<MentionIconChevronRight size={16} />}
                />
              );
            })}
            {folders.length > 0 && (folderAssetsLoading || assets.length > 0) ? <MentionSeparator /> : null}
            {folderAssetsLoading && assets.length === 0 ? (
              <MentionSkeleton count={3} renderBlock={renderSkeletonBlock} />
            ) : null}
            {assets.map((asset, index) => {
              const globalIndex = index + rowOffset + folders.length;
              /** 官方 `zt = My(Y.path, vt.name)`。 */
              const path = mentionAssetPath(currentFolder.space, asset);
              const typeName = mentionAssetTypeName(asset.assetType);
              const disabled = !!(typeName && disabledAssetTypes?.has(typeName));
              return (
                <MentionAssetRow
                  key={asset.id}
                  asset={asset}
                  globalIndex={globalIndex}
                  isSelected={globalIndex === selectedIndex}
                  onClick={() => onAssetSelect?.(asset, path)}
                  scrollRoot={scrollRef}
                  hidePath
                  disabled={disabled}
                />
              );
            })}
            {!folderAssetsLoading && assets.length === 0 && folders.length === 0 ? (
              <div className={NO_RESULTS_CLASS}>{noResultsLabel}</div>
            ) : null}
          </MentionScrollFade>
        </div>
      </div>
    );
  }

  /* ④ 官方 `f`：不可用文案（2068–2080）。 */
  if (mentionUnavailableMessage) {
    return (
      <div className={SURFACE_CLASS} style={SURFACE_STYLE}>
        <div className="px-3 py-3 text-[13px] leading-[18px] text-white/40">{mentionUnavailableMessage}</div>
      </div>
    );
  }

  /* ⑤ 官方主分支（2081–2911）。 */
  return (
    <div
      className={rootClassName}
      style={SURFACE_STYLE}
      data-mention-panel=""
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className={BODY_CLASS}>
        {searchRow}
        <MentionScrollFade
          ref={scrollRef}
          deps={[rows.length, librarySectionLoading, showAllPlugins, showAllLinked, showAllPrivate, showAllTeam]}
          className={cx(SCROLL_CLASS, 'gap-[6px]')}
          onMouseMove={handleContainerMouseMove}
        >
          {/* 已连接节点（官方 main children[0]） */}
          {linkedVisible ? (
            <div className="flex w-full flex-col gap-[2px]">
              <MentionSectionHeader hint={tm('omniReference.suggestion.linkedNodeShortcutHint')}>
                {linkedSectionLabel || tm('omniReference.suggestion.linkedNodeSection')}
              </MentionSectionHeader>
              {visibleLinked.map((item) => {
                const globalIndex = rows.findIndex((row) => row.kind === 'linked' && row.item.id === item.id);
                const disabled = !!(item.type && disabledAssetTypes?.has(item.type));
                const shortcut = shortcutNumbers.get(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-selectable-index={disabled ? undefined : globalIndex}
                    className={cx(
                      MENTION_ROW_CLASS,
                      !disabled && globalIndex === selectedIndex && MENTION_ROW_SELECTED_CLASS,
                      disabled && 'opacity-35 cursor-not-allowed',
                    )}
                    onClick={disabled ? undefined : () => selectLinkedItem(item)}
                  >
                    <MentionAssetThumbnail
                      src={item.avatar}
                      videoSrc={item.videoSrc}
                      type={item.type === 'attachment' ? item.description : item.type}
                      scrollRoot={scrollRef}
                    />
                    <span className="flex-1 min-w-0 flex items-center gap-1">
                      <span className="text-sm font-medium leading-5 text-white/90 truncate">
                        <MentionHighlight text={item.label ?? ''} keyword={highlightKeyword} />
                      </span>
                    </span>
                    {shortcut ? (
                      <span
                        aria-hidden="true"
                        className={cx(
                          'min-w-[22px] shrink-0 text-right text-[11px] font-medium leading-4 tabular-nums text-white/30',
                          globalIndex === selectedIndex && 'text-white/60',
                        )}
                      >
                        {'#'}
                        {shortcut}
                      </span>
                    ) : null}
                    <MentionAssetTypeBadge type={item.type === 'attachment' ? item.description : item.type} />
                  </button>
                );
              })}
              {showMoreLinkedIndex >= 0 ? (
                <MentionHintRow
                  index={showMoreLinkedIndex}
                  isSelected={showMoreLinkedIndex === selectedIndex}
                  onClick={() => setShowAllLinked(true)}
                >
                  {tm('omniReference.suggestion.showMoreResults', { count: linkedMoreCount })}
                </MentionHintRow>
              ) : null}
            </div>
          ) : null}

          {linkedVisible && pluginsVisible ? <MentionSeparator /> : null}

          {/* 应用（插件） */}
          {pluginsVisible ? (
            <div className="flex w-full flex-col gap-[2px]">
              <MentionSectionHeader>{tm('omniReference.suggestion.pluginSection')}</MentionSectionHeader>
              {pluginsLoading ? (
                <MentionAssetRowsSkeleton count={MENTION_SECTION_LIMIT} />
              ) : (
                <>
                  {visiblePlugins.map((plugin) => {
                    const globalIndex = rows.findIndex(
                      (row) => row.kind === 'plugin' && row.plugin.pluginName === plugin.pluginName,
                    );
                    return (
                      <MentionPluginRow
                        key={plugin.pluginName}
                        plugin={plugin}
                        globalIndex={globalIndex}
                        isSelected={globalIndex === selectedIndex}
                        onClick={() => onSelect(buildMentionSuggestionPluginItem(
                          plugin,
                          mentionPluginConnectorStatus(plugin, connectorStatusById),
                        ))}
                      />
                    );
                  })}
                  {showMorePluginsIndex >= 0 ? (
                    <MentionHintRow
                      index={showMorePluginsIndex}
                      isSelected={showMorePluginsIndex === selectedIndex}
                      onClick={() => setShowAllPlugins(true)}
                    >
                      {tm('omniReference.suggestion.showMoreResults', { count: pluginsMoreCount })}
                    </MentionHintRow>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {(linkedVisible || pluginsVisible) && enableElementLibrary && elementsBlockVisible ? (
            <MentionSeparator />
          ) : null}

          {/* 元素库：加载 / 失败 */}
          {enableElementLibrary && elementsLoading && !elementsAny ? (
            <MentionSkeleton count={3} renderBlock={renderSkeletonBlock} />
          ) : null}
          {enableElementLibrary && elementsError && !elementsLoading ? (
            <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-white/45">
              <span>{t('elementLibrary.errors.loadFailed')}</span>
              <button
                type="button"
                className="shrink-0 text-white/70 hover:text-white"
                onClick={() => onElementsRetry?.()}
              >
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {/* 元素库：私有 */}
          {enableElementLibrary && visiblePrivateElements.length > 0 ? (
            <div className="flex w-full flex-col gap-[2px]">
              <MentionSectionHeader>{t('elementLibrary.mention.privateSection')}</MentionSectionHeader>
              {visiblePrivateElements.map((item) => {
                const globalIndex = rows.findIndex(
                  (row) => row.kind === 'privateElement' && row.item.id === item.id,
                );
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-selectable-index={globalIndex}
                    className={cx(MENTION_ROW_CLASS, globalIndex === selectedIndex && MENTION_ROW_SELECTED_CLASS)}
                    onClick={() => onElementSelect?.(item)}
                  >
                    <MentionAssetThumbnail src={item.avatar} type="image" scrollRoot={scrollRef} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-5 text-white/90">
                        <MentionHighlight text={item.label} keyword={highlightKeyword} />
                      </span>
                      {item.description ? (
                        <span className="block truncate text-[11px] text-white/35">{item.description}</span>
                      ) : null}
                    </span>
                    <MentionAssetTypeBadge type="library_element" />
                  </button>
                );
              })}
              {!showAllPrivateElements && privateElementsMoreCount > 0 ? (
                <MentionHintRow
                  index={rows.findIndex((row) => row.kind === 'showMorePrivateElements')}
                  isSelected={rows.findIndex((row) => row.kind === 'showMorePrivateElements') === selectedIndex}
                  onClick={() => setShowAllPrivateElements(true)}
                >
                  {tm('omniReference.suggestion.showMoreResults', { count: privateElementsMoreCount })}
                </MentionHintRow>
              ) : null}
            </div>
          ) : null}

          {enableElementLibrary && visiblePrivateElements.length > 0 && visibleTeamElements.length > 0 ? (
            <MentionSeparator />
          ) : null}

          {/* 元素库：团队 */}
          {enableElementLibrary && visibleTeamElements.length > 0 ? (
            <div className="flex w-full flex-col gap-[2px]">
              <MentionSectionHeader>{t('elementLibrary.mention.teamSection')}</MentionSectionHeader>
              {visibleTeamElements.map((item) => {
                const globalIndex = rows.findIndex((row) => row.kind === 'teamElement' && row.item.id === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-selectable-index={globalIndex}
                    className={cx(MENTION_ROW_CLASS, globalIndex === selectedIndex && MENTION_ROW_SELECTED_CLASS)}
                    onClick={() => onElementSelect?.(item)}
                  >
                    <MentionAssetThumbnail src={item.avatar} type="image" scrollRoot={scrollRef} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-5 text-white/90">
                        <MentionHighlight text={item.label} keyword={highlightKeyword} />
                      </span>
                      {item.description ? (
                        <span className="block truncate text-[11px] text-white/35">{item.description}</span>
                      ) : null}
                    </span>
                    <MentionAssetTypeBadge type="library_element" />
                  </button>
                );
              })}
              {!showAllTeamElements && teamElementsMoreCount > 0 ? (
                <MentionHintRow
                  index={rows.findIndex((row) => row.kind === 'showMoreTeamElements')}
                  isSelected={rows.findIndex((row) => row.kind === 'showMoreTeamElements') === selectedIndex}
                  onClick={() => setShowAllTeamElements(true)}
                >
                  {tm('omniReference.suggestion.showMoreResults', { count: teamElementsMoreCount })}
                </MentionHintRow>
              ) : null}
            </div>
          ) : null}

          {sectionsVisible && libraryEnabled && (librarySectionLoading || privateLibraryVisible || teamLibraryVisible) ? (
            <MentionSeparator />
          ) : null}

          {/* 资产库：加载 */}
          {libraryEnabled && librarySectionLoading ? <MentionPluginRowsSkeleton count={3} /> : null}

          {/* 资产库：私有 */}
          {libraryEnabled && !librarySectionLoading && privateLibraryVisible ? (
            <div className="flex w-full flex-col gap-[2px]">
              <MentionSectionHeader>{tm('omniReference.suggestion.privateSection')}</MentionSectionHeader>
              {assetListView ? (
                <>
                  {visiblePrivateAssets.map((asset) => {
                    const globalIndex = rows.findIndex(
                      (row) => row.kind === 'privateAsset' && row.asset.id === asset.id,
                    );
                    const row = rows[globalIndex];
                    const typeName = mentionAssetTypeName(asset.assetType);
                    const disabled = !!(typeName && disabledAssetTypes?.has(typeName));
                    return (
                      <MentionAssetRow
                        key={asset.id}
                        asset={asset}
                        globalIndex={globalIndex}
                        isSelected={globalIndex === selectedIndex}
                        onClick={() =>
                          onAssetSelect?.(
                            asset,
                            row && row.kind === 'privateAsset' ? row.path : mentionAssetPath('private', asset),
                          )
                        }
                        keyword={highlightKeyword}
                        scrollRoot={scrollRef}
                        disabled={disabled}
                      />
                    );
                  })}
                  {!showAllPrivate && privateAssetsMoreCount > 0 ? (
                    <MentionHintRow
                      index={rows.findIndex((row) => row.kind === 'showMorePrivate')}
                      isSelected={rows.findIndex((row) => row.kind === 'showMorePrivate') === selectedIndex}
                      onClick={() => setShowAllPrivate(true)}
                    >
                      {tm('omniReference.suggestion.showMoreResults', { count: privateAssetsMoreCount })}
                    </MentionHintRow>
                  ) : null}
                </>
              ) : (
                <>
                  {visiblePrivateFolders.map((folder) => {
                    const globalIndex = rows.findIndex(
                      (row) => row.kind === 'privateFolder' && row.folder.id === folder.id,
                    );
                    const row = rows[globalIndex];
                    const path =
                      row && row.kind === 'privateFolder'
                        ? row.path
                        : mentionFolderPath('private', folderDisplayName(folder.name));
                    return (
                      <MentionFolderRow
                        key={folder.id}
                        displayName={folderDisplayName(folder.name)}
                        globalIndex={globalIndex}
                        isSelected={globalIndex === selectedIndex}
                        onClick={() => handleFolderPrimaryAction(folder, path, 'private')}
                        trailingIcon={<MentionIconChevronRight size={16} />}
                      />
                    );
                  })}
                  {!showAllPrivate && privateFoldersMoreCount > 0 ? (
                    <MentionHintRow
                      index={rows.findIndex((row) => row.kind === 'showMorePrivateFolders')}
                      isSelected={rows.findIndex((row) => row.kind === 'showMorePrivateFolders') === selectedIndex}
                      onClick={() => setShowAllPrivate(true)}
                    >
                      {tm('omniReference.suggestion.showMoreResults', { count: privateFoldersMoreCount })}
                    </MentionHintRow>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {libraryEnabled && !librarySectionLoading && privateLibraryVisible && teamLibraryVisible ? (
            <MentionSeparator />
          ) : null}

          {/* 资产库：团队 */}
          {libraryEnabled && !librarySectionLoading && teamLibraryVisible ? (
            <div className="flex w-full flex-col gap-[2px]">
              <MentionSectionHeader>{tm('omniReference.suggestion.teamSection')}</MentionSectionHeader>
              {assetListView ? (
                <>
                  {visibleTeamAssets.map((asset) => {
                    const globalIndex = rows.findIndex(
                      (row) => row.kind === 'teamAsset' && row.asset.id === asset.id,
                    );
                    const row = rows[globalIndex];
                    const typeName = mentionAssetTypeName(asset.assetType);
                    const disabled = !!(typeName && disabledAssetTypes?.has(typeName));
                    return (
                      <MentionAssetRow
                        key={asset.id}
                        asset={asset}
                        globalIndex={globalIndex}
                        isSelected={globalIndex === selectedIndex}
                        onClick={() =>
                          onAssetSelect?.(
                            asset,
                            row && row.kind === 'teamAsset' ? row.path : mentionAssetPath('team', asset),
                          )
                        }
                        keyword={highlightKeyword}
                        scrollRoot={scrollRef}
                        disabled={disabled}
                      />
                    );
                  })}
                  {!showAllTeam && teamAssetsMoreCount > 0 ? (
                    <MentionHintRow
                      index={rows.findIndex((row) => row.kind === 'showMoreTeam')}
                      isSelected={rows.findIndex((row) => row.kind === 'showMoreTeam') === selectedIndex}
                      onClick={() => setShowAllTeam(true)}
                    >
                      {tm('omniReference.suggestion.showMoreResults', { count: teamAssetsMoreCount })}
                    </MentionHintRow>
                  ) : null}
                </>
              ) : (
                <>
                  {visibleTeamFolders.map((folder) => {
                    const globalIndex = rows.findIndex(
                      (row) => row.kind === 'teamFolder' && row.folder.id === folder.id,
                    );
                    const row = rows[globalIndex];
                    const path =
                      row && row.kind === 'teamFolder'
                        ? row.path
                        : mentionFolderPath('team', folderDisplayName(folder.name));
                    return (
                      <MentionFolderRow
                        key={folder.id}
                        displayName={folderDisplayName(folder.name)}
                        globalIndex={globalIndex}
                        isSelected={globalIndex === selectedIndex}
                        onClick={() => handleFolderPrimaryAction(folder, path, 'team')}
                        trailingIcon={<MentionIconChevronRight size={16} />}
                      />
                    );
                  })}
                  {!showAllTeam && teamFoldersMoreCount > 0 ? (
                    <MentionHintRow
                      index={rows.findIndex((row) => row.kind === 'showMoreTeamFolders')}
                      isSelected={rows.findIndex((row) => row.kind === 'showMoreTeamFolders') === selectedIndex}
                      onClick={() => setShowAllTeam(true)}
                    >
                      {tm('omniReference.suggestion.showMoreResults', { count: teamFoldersMoreCount })}
                    </MentionHintRow>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {/* 指令分组 */}
          {hasDirections && !assetListView ? (
            <>
              {anyContentVisible ? <MentionSeparator /> : null}
              <div className="flex w-full flex-col gap-[2px]">
                <MentionSectionHeader>{tm('omniReference.suggestion.directionSection')}</MentionSectionHeader>
                {directions.map((group) => {
                  const globalIndex = rows.findIndex(
                    (row) => row.kind === 'directionGroup' && row.group.id === group.id,
                  );
                  return (
                    <MentionGroupRow
                      key={group.id}
                      group={group}
                      globalIndex={globalIndex}
                      isSelected={globalIndex === selectedIndex}
                      onClick={() => drillIntoDirectionGroup(group)}
                    />
                  );
                })}
              </div>
            </>
          ) : null}
        </MentionScrollFade>
      </div>
    </div>
  );
}

export default memo(MentionSuggestionPanel);
