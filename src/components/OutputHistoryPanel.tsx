/**
 * OutputHistoryPanel —— 左侧「历史」面板（TapNow 官方历史面板 1:1 复刻）
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 权威证据（全部在 D:\DEEPSEEK\）
 *   · official-history-panel.html        官方 9444 实测的**完整面板 outerHTML**
 *   · official-history-panel.styles.json 同一面板关键节点的 **computed style**
 *   · official-history-panel.src.js      官方源码片段
 *        = `E:\TapNow-0.4.66\resources\web\assets\page-DVqoHdTT.js` 偏移 1600000–1670000
 *   · official-history-panel.outline.txt 官方正文结构大纲
 *   · 官方 i18n（`index-BsHyQ2qj.js`）：loadFailed / imageType / videoType / audioType /
 *     myTitle / selectAsset / deselectAsset / listView / gridView / cancelSelection /
 *     threedAsset / typeFilter / search / clearSearch / select / selectedCount / noDownloadableAssets
 *
 * 组件与出处（page-DVqoHdTT.js 文件内字符偏移，均由本文件作者实测定位）
 *   · 面板本体 i0e        @1600000+（<Ct.aside data-history-panel>）
 *   · 底栏     JO         @1591881
 *   · 头部     ZO         @1594076
 *   · 选择按钮 eF         @1594540
 *   · 类型 tab Bbe        @1595035（滑动指示器 = 共享组件 EH，几何实测自 styles.json）
 *   · 复选     ev         @1597558
 *   · 展开弹窗 t0e        @1606159
 *   · 网格卡   H          @src.js 21476 附近；列表行 B @src.js 18376 附近
 *   · 展开卡   Gbe        @src.js 12 附近；日期分组 r0e @src.js 74 附近
 *   · 选择模式 hook tF    @src.js 31 附近
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 官方常量（逐字，**不改写数值**）
 *   sl = 2   网格列数（实测 `left: 0%/50%`、`width: 50%`）
 *   Hf = 30  网格日期标题行高（实测 `height: 30px; padding: 6px`）
 *   fd = 152 网格卡片行高（实测 `height: 152px; padding: 6px` ⇒ 卡内层 139.33×140）
 *   Dp = 56  列表行高（源码 `Dp=56,n0e=80,s0e=300` @src.js 73）
 *   n0e = 80 列表文案截断长度
 *   s0e = 300 搜索防抖
 *   zbe = 500 「应用到画布」按钮忙碌锁
 *   zk=80 / Bk=175 / ub=4 / Zbe=120  展开弹窗素材大小（最小/最大/步进/默认）
 *
 * ══════════════════════════════════════════════════════════════════════════
 * Tailwind v3 等价写法（MTV 是 v3，官方是 v4；数值一律不改）
 *   · 官方 `bg-white/8` / `ring-white/8` / `bg-red-400/8`：v3 的 opacity 刻度只到 5 的倍数
 *     ⇒ 落成等价 arbitrary value `bg-white/[0.08]` …（数值未改，只换写法）
 *   · 官方 `bg-popover/90`：MTV 的 `--popover` 是 hex、config 里没挂 `<alpha-value>`
 *     ⇒ v3 生成不出该工具类，落成等价 `bg-[color-mix(in_srgb,var(--popover)_90%,transparent)]`
 *   · `size-8` / `rounded-2xl` / `rounded-md`(10px) / `rounded-lg`(12px) / `rounded-xl`(16px)
 *     在 MTV 的 tailwind.config.js 里已经钉到官方 px 值，可逐字使用（实测一致）
 *   · 其余 arbitrary value（`z-[60]` / `bg-[rgba(22,22,22,0.82)]` / `shadow-[…]` /
 *     `backdrop-blur-[40px]` / `tracking-[-0.03em]` / `transition-[bottom]` /
 *     `text-[rgba(255,255,255,0.88)]` / `[&_[role=tab]]:px-2` …）v3 全部原样支持
 *
 * MTV 侧的必要偏离（详见文件末尾注释与交付报告）
 *   1. `返回` 官方语义 = 回上层（素材面板）；MTV 没有「素材↔历史」共享壳 ⇒ 关闭面板
 *   2. 官方面板是**非模态**（无遮罩、无 Esc、无外点关闭）⇒ MTV 同样移除，关闭入口 = `返回`
 *   3. 官方 `style={{bottom: y?210:60}}` 里的 `y` = **小地图开关**（官方小地图堆在左下控制条上方：
 *      占位 150(小地图) + 4 + 40(控制条) = 194、距下 59 ⇒ 打开时面板底部让到 210、关闭时 60；
 *      实测注释见 MTV `src/components/Canvas.tsx:2022-2026`）⇒ MTV 接 store 的 `minimapVisible`
 *   4. 官方用虚拟化列表（`Sb`）；MTV 无虚拟化组件 ⇒ 用**同样的 absolute 定位 + 同样的
 *      行高常量**铺全部行（DOM 结构与内联 style 与官方一致，只是不做窗口裁剪）
 *   5. MTV 历史记录里 `ai-text`/`ai-shotlist`/`ai-panorama` 在官方 4-tab 结构下没有对应 tab
 * ══════════════════════════════════════════════════════════════════════════
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAppStore } from '../store/useAppStore';
/* ★ 模型名唯一出口：历史卡片只显示 displayName */
import { useModelNameResolver } from '../services/models/display';
import OfficialSlider from './shared/OfficialSlider';
import OfficialScrollAreaBar from './shared/OfficialScrollAreaBar';
import { applyLibraryFileToCanvas } from '../services/assetRowActions';
import { downloadNodesByIds } from '../services/selectionToolbarActions';
import { getHistoryEntriesForExport } from '../services/indexedDbService';
import type { OutputHistoryEntry } from '../types';

/* ── 官方常量（数值逐字，见文件头） ── */
const GRID_COLUMN_COUNT = 2; // sl
const GRID_HEADER_HEIGHT = 30; // Hf
const GRID_ITEM_HEIGHT = 152; // fd
const LIST_ROW_HEIGHT = 56; // Dp
const LIST_TEXT_MAX = 80; // n0e
const SEARCH_DEBOUNCE_MS = 300; // s0e
const APPLY_BUSY_MS = 500; // zbe
const EXPAND_ITEM_SIZE_MIN = 80; // zk
const EXPAND_ITEM_SIZE_MAX = 175; // Bk
const EXPAND_ITEM_SIZE_STEP = 4; // ub
const EXPAND_ITEM_SIZE_DEFAULT = 120; // Zbe
const PANEL_EASE = [0.16, 1, 0.3, 1] as const; // 官方 transition ease

/** 官方 `Z_` / `Uk` = ["image","video","audio","threed"] */
type HistoryTabId = 'image' | 'video' | 'audio' | 'threed';
type HistoryViewMode = 'grid' | 'list';
/** 官方 `Vbe` 的项目范围（`historyPanel.scopeAll` / `scopeThisProject`） */
type HistoryScope = 'all' | 'current';
const HISTORY_TABS: { id: HistoryTabId; label: string }[] = [
  { id: 'image', label: '图片' }, // historyPanel.imageType
  { id: 'video', label: '视频' }, // historyPanel.videoType
  { id: 'audio', label: '音频' }, // historyPanel.audioType
  { id: 'threed', label: '3D' }, // "3D"
];

/**
 * MTV tab → 历史记录 nodeType **集合**。
 *
 * 官方不是按「节点类型」而是按 `generation_type` 过滤的 —— `page-DVqoHdTT.js`@1611100 附近
 * （`i0e` 里同一条查询写 4 遍，`E` = 不含 canvasId 的「所有项目」查询、`N` = 带 canvasId 且
 *  只在弹窗打开 + scope=current 时才 enabled 的「当前项目」查询）：
 *     const k = no("image","desc",E), T = no("video","desc",E),
 *           A = no("audio","desc",E), M = no("threed","desc",E)
 *     const P = no("image","desc",N), j = no("video","desc",N), …   ⇒  O = h==="current" ? R : I
 * 一个 `generation_type` 天然覆盖**多个** MTV nodeType：MTV 的「动画」历史写成
 * `nodeType: 'ai-animation'`（`AINodeDialog.tsx` 的 `isAnimation ? 'ai-animation' : 'ai-image'`），
 * 而 `historyCategoryOf` 把 `ai-animation` 判成 **video** ⇒ 它必须落在「视频」tab 里。
 * 之前这里是**单值** `TAB_TO_NODE_TYPE`（video 只查 `ai-video`）⇒ `ai-animation`、
 * `ai-panorama`、`ai-shotlist` 这类同类别记录在任何 tab 里都查不到
 * （这就是「所有项目显示不全」的根因）。
 *
 * 各 nodeType 的**写入点**（全仓 grep `nodeType:` 得到，无自创）：
 *   ai-image    : generationService / imageBatchService / shotlistFrameService / AINodeDialog
 *   ai-animation: AINodeDialog（`isAnimation` 分支）
 *   ai-panorama : generationService / batchExecute / AINodeDialog
 *   ai-video    : generationService / batchExecute / AINodeDialog
 *   ai-audio    : generationService / batchExecute / AINodeDialog
 *   ai-shotlist : shotlistService
 *   ai-text     : generationService / batchExecute / AINodeDialog（官方 4 tab 没有文本类 ⇒ 不归任何 tab）
 */
const TAB_TO_NODE_TYPES: Record<HistoryTabId, readonly string[]> = {
  image: ['ai-image', 'ai-panorama', 'ai-shotlist'],
  video: ['ai-video', 'ai-animation'],
  audio: ['ai-audio'],
  /* `threed` 在 MTV 没有对应节点类型（`NodeType` 无 3D 项）⇒ 空集合查询，
     走官方同一条空结果通路（结果为空 = 官方空态），**不伪造数据**。 */
  threed: [],
};

/* ══════════════════════════════════════════════════════════════════════════
   图标 —— **逐字**照抄官方 SVG（官方用 tabler / lucide；这里内联原 path，
   避免图标集的命名/默认尺寸差异导致与官方实测 DOM 不一致）
   ══════════════════════════════════════════════════════════════════════════ */

/** 官方 `Ar` = tabler chevron-left（原 DOM：width/height 16） */
function IconChevronLeft() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="tabler-icon tabler-icon-chevron-left"
    >
      <path d="M15 6l-6 6l6 6" />
    </svg>
  );
}

/** 官方 `k4` = lucide list（className 由调用方给，官方为 `size-4`） */
function IconList({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-list ${className}`}
      aria-hidden="true"
    >
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
      <path d="M3 6h.01" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M8 6h13" />
    </svg>
  );
}

/** 官方 `YA` = lucide layout-grid（列表视图下显示的那个「网格视图」图标） */
function IconLayoutGrid({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-layout-grid ${className}`}
      aria-hidden="true"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

/** 官方 `VA` = lucide maximize-2（Expand） */
function IconMaximize2({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-maximize2 lucide-maximize-2 ${className}`}
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
      <path d="M9 21H3v-6" />
    </svg>
  );
}

/** 官方 `Ud` = lucide search（官方 className：`pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40`） */
function IconSearch({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-search ${className}`}
      aria-hidden="true"
    >
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  );
}

/** 官方 `Yn` = lucide x（清空搜索 size-3 / 底栏取消 size=11） */
function IconX({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `lucide lucide-x ${className}` : 'lucide lucide-x'}
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/** 官方 `$A` = lucide download（size 13） */
function IconDownload({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-download"
      aria-hidden="true"
    >
      <path d="M12 15V3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

/** 官方 `Rm` = tabler copy（「应用到画布」16×16；原 DOM class `tabler-icon tabler-icon-copy`） */
function IconCopy() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="tabler-icon tabler-icon-copy"
      aria-hidden="true"
    >
      <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
      <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
    </svg>
  );
}

/** 官方 `jr` = lucide music（音频占位卡用） */
function IconMusic({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-music ${className}`}
      aria-hidden="true"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

/** 官方图片类型角标图标（lucide image） */
function IconImageType({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-image ${className}`}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

/** 官方视频类型角标图标（lucide video） */
function IconVideoType({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-video ${className}`}
      aria-hidden="true"
    >
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   工具函数
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 官方日期分组键 = `created_at.split('T')[0]`（`r0e` / `N` 分组），
 * 分组标题 `Mb(dateKey)` 在实测 DOM 里就是 `2026-10-01` 这种 `YYYY-MM-DD`。
 * MTV 只有 `timestamp`（ms）⇒ 取**本地**日期，格式与官方一致。
 */
function historyDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface HistoryGroup {
  date: string;
  items: OutputHistoryEntry[];
}

/** 官方 `r0e`/`N` 的等价物：按日期分组，保持传入顺序（官方是 created_at desc） */
function groupHistoryByDate(entries: OutputHistoryEntry[]): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  const index = new Map<string, HistoryGroup>();
  for (const entry of entries) {
    const date = historyDateKey(entry.timestamp);
    let group = index.get(date);
    if (!group) {
      group = { date, items: [] };
      index.set(date, group);
      groups.push(group);
    }
    group.items.push(entry);
  }
  return groups;
}

/** 官方列表行文案：`(prompt || model_name || file_url 文件名 || '—').slice(0, n0e)` */
function historyListLabel(
  entry: OutputHistoryEntry,
  /** ★ 展示名解析器（`services/models/display`）—— 有它就绝不显示原始调用 id */
  resolveModelName?: (modelRef: string | undefined, provider?: string) => string,
): string {
  const raw = entry.prompt?.trim()
    || (entry.model ? resolveModelName?.(entry.model, entry.provider) || entry.model : '')
    || entry.mediaUrl?.split('/').pop()
    || entry.output?.trim()
    || '—';
  return raw.slice(0, LIST_TEXT_MAX);
}

/** 官方分类型：image / video / audio / threed → MTV NodeType
 *  ⚠️ 必须与 `TAB_TO_NODE_TYPES`（tab 的查询口径）一致：
 *     凡是落在某个 tab 里的 nodeType，这里都得判成同一个类别，否则会出现
 *     「查得到但画错图标 / 画成另一类」的矛盾。 */
function historyCategoryOf(entry: OutputHistoryEntry): 'image' | 'video' | 'audio' | 'text' {
  if (entry.nodeType === 'ai-text' || entry.nodeType === 'ai-markdown') return 'text';
  if (TAB_TO_NODE_TYPES.video.includes(entry.nodeType)) return 'video';
  if (TAB_TO_NODE_TYPES.audio.includes(entry.nodeType)) return 'audio';
  return 'image';
}

/** 本地文件优先、线上 URL 兜底（Tauri 里 filePath 要走 convertFileSrc） */
function initialMediaSrc(filePath?: string, mediaUrl?: string): string {
  if (filePath) {
    try { return convertFileSrc(filePath); } catch { /* 非 Tauri 环境忽略 */ }
  }
  return mediaUrl || '';
}

/* ══════════════════════════════════════════════════════════════════════════
   懒加载媒体 —— 官方 `Od`(LazyImage) / `tv`(LazyVideo) @src.js 2 / 10
   官方：IntersectionObserver({threshold:.1, rootMargin:'50px'})，首次可见后才挂 <img>/<video>；
   未可见 = `w-full h-full bg-gray-200 animate-pulse rounded-md flex items-center justify-center`
   + `text-gray-400 text-xs` 的「加载中」；失败 = `bg-gray-100` + 「加载失败」。
   ══════════════════════════════════════════════════════════════════════════ */
function useDeferredVisibility<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled || visible) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { threshold: 0.1, rootMargin: '50px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, visible]);
  return { ref, visible };
}

function HistoryLazyImage({
  mediaUrl,
  filePath,
  alt,
  className,
  onClick,
}: {
  mediaUrl?: string;
  filePath?: string;
  alt: string;
  className: string;
  onClick?: () => void;
}) {
  const { ref, visible } = useDeferredVisibility<HTMLDivElement>();
  const [src, setSrc] = useState(() => initialMediaSrc(filePath, mediaUrl));
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(() => {
    // MTV 必需：本地文件读不到时退回线上地址（官方只有线上地址，无此分支）
    if (mediaUrl && src !== mediaUrl) {
      setSrc(mediaUrl);
      return;
    }
    setFailed(true);
  }, [mediaUrl, src]);

  const placeholder = (
    <div className="w-full h-full bg-gray-200 animate-pulse rounded-md flex items-center justify-center">
      <span className="text-gray-400 text-xs">加载中</span>
    </div>
  );

  return (
    <div ref={ref} className="relative w-full h-full">
      {!visible || !src ? placeholder : failed ? (
        <div className="w-full h-full bg-gray-100 rounded-md flex items-center justify-center">
          <span className="text-gray-400 text-xs">加载失败</span>
        </div>
      ) : (
        <>
          {!loaded && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-md flex items-center justify-center">
              <span className="text-gray-400 text-xs">加载中</span>
            </div>
          )}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onClick={onClick}
            onLoad={() => setLoaded(true)}
            onError={handleError}
            className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
          />
        </>
      )}
    </div>
  );
}

function HistoryLazyVideo({
  mediaUrl,
  filePath,
  className,
  hoverPlay = false,
  onClick,
}: {
  mediaUrl?: string;
  filePath?: string;
  className: string;
  hoverPlay?: boolean;
  onClick?: () => void;
}) {
  const { ref, visible } = useDeferredVisibility<HTMLDivElement>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [src, setSrc] = useState(() => initialMediaSrc(filePath, mediaUrl));
  const [failed, setFailed] = useState(false);

  const placeholder = (
    <div className="w-full h-full bg-gray-200 animate-pulse rounded-md flex items-center justify-center">
      <span className="text-gray-400 text-xs">加载中</span>
    </div>
  );

  if (!visible || !src) return <div ref={ref} className="relative w-full h-full">{placeholder}</div>;

  return (
    <div ref={ref} className="relative w-full h-full">
      {failed ? (
        <div className="w-full h-full bg-gray-100 rounded-md flex items-center justify-center">
          <span className="text-gray-400 text-xs">视频加载失败</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={src}
          muted
          loop={hoverPlay}
          playsInline
          preload="none"
          onClick={onClick}
          onError={() => {
            if (mediaUrl && src !== mediaUrl) { setSrc(mediaUrl); return; }
            setFailed(true);
          }}
          onMouseEnter={hoverPlay ? () => { void videoRef.current?.play().catch(() => {}); } : undefined}
          onMouseLeave={hoverPlay ? () => {
            const el = videoRef.current;
            if (!el) return;
            el.pause();
            el.currentTime = 0;
          } : undefined}
          className={className}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   选择框 —— 官方 `ev` @1597558
   几何逐字：外层 <svg viewBox="0 0 8 8"> + <rect width=7.25 height=7.25 rx=2.07143>；
   选中时叠一层 <svg viewBox="0 0 10 10" class="absolute text-zinc-950"> 的勾。
   尺寸：内勾 = round(size * 0.56)（官方 `Math.round(n*.56)`）。
   ══════════════════════════════════════════════════════════════════════════ */
function HistoryCheckbox({
  selected,
  onToggle,
  size = 16,
  placement = 'overlay',
  className,
}: {
  selected: boolean;
  onToggle: (event?: { stopPropagation: () => void }) => void;
  size?: number;
  placement?: 'overlay' | 'inline';
  className?: string;
}) {
  const checkSize = Math.round(size * 0.56);
  return (
    <button
      type="button"
      className={[
        'z-10 flex cursor-pointer items-center justify-center',
        selected ? 'text-white' : 'text-[var(--Text-Text-Secondary,#9C9C9C)]',
        placement === 'overlay' ? 'absolute left-1.5 top-1.5' : 'relative shrink-0',
        className ?? '',
      ].filter(Boolean).join(' ')}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => onToggle(event)}
      aria-pressed={selected}
      aria-label={selected ? '取消选择素材' : '选择素材'}
    >
      <span className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 8 8" fill="none" aria-hidden="true">
          <rect
            width="7.25"
            height="7.25"
            rx="2.07143"
            fill={selected ? 'currentColor' : 'none'}
            stroke={selected ? 'none' : 'currentColor'}
            strokeWidth={selected ? undefined : 0.75}
            x="0.375"
            y="0.375"
          />
        </svg>
        {selected && (
          <svg width={checkSize} height={checkSize} viewBox="0 0 10 10" fill="none" className="absolute text-zinc-950" aria-hidden="true">
            <path
              d="M1.5 5L3.8 7.5L8.5 2.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   类型 tab 条 —— 官方 `Bbe`（= `EH`，定义在 course-api-base-url-CGXqZmAy.js@402326）
   ★ 指示器是 **framer-motion 的弹簧补间**，不是 CSS 过渡 —— 官方源码逐字：
       d ? l.jsx(Gn.div, {
             className: "pointer-events-none absolute rounded-lg bg-white/[0.12] backdrop-blur-[28px]",
             style: { boxShadow: "0 0.5px 0 0 rgba(255, 255, 255, 0.12) inset, 0 4px 8px 0 rgba(0, 0, 0, 0.04)" },
             initial: !1,
             animate: d,                                    // d = {left, top, width, height}（px）
             transition: { type: "spring", stiffness: 400, damping: 30 }
           }) : null
     所以 `getComputedStyle(ind).transitionDuration` 才是 **0s**（补间在 JS 里跑），
     真正动的是**内联 `left/top/width/height`**（实测：切 tab 后 left 227px→153px，
     每 ~16ms 一帧，中途过冲到 150.9px 再回 153px = ζ≈0.75 的欠阻尼弹簧 ✓）。
     测量用 `offsetLeft/offsetTop/offsetWidth/offsetHeight`（官方 `Zge` 原样）。
   ══════════════════════════════════════════════════════════════════════════ */
function HistoryTypeTabs({
  value,
  onChange,
}: {
  value: HistoryTabId;
  onChange: (next: HistoryTabId) => void;
}) {
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<HistoryTabId, HTMLButtonElement | null>>>({});
  /* 官方 `useState(null)`：没量到之前**不渲染**指示器（`d ? … : null`），
     首次挂载靠 `initial:false` 直接落位、不播动画。 */
  const [indicator, setIndicator] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const measure = useCallback(() => {
    const wrap = tablistRef.current;
    const button = tabRefs.current[value];
    if (!wrap || !button) return;
    setIndicator({
      left: button.offsetLeft,
      top: button.offsetTop,
      width: button.offsetWidth,
      height: button.offsetHeight,
    });
  }, [value]);

  /* 官方 `Zge`：`useLayoutEffect(()=>{p()},[p,n,e])` + ResizeObserver(tablist) + window resize */
  useLayoutEffect(() => {
    measure();
    const wrap = tablistRef.current;
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    if (wrap) observer.observe(wrap);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  /* 官方 `Zge` 的 tab 键盘导航（← → 换 tab 并聚焦） */
  const handleTabKeyDown = useCallback((event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextIndex = event.key === 'ArrowRight'
      ? (index + 1) % HISTORY_TABS.length
      : (index - 1 + HISTORY_TABS.length) % HISTORY_TABS.length;
    const next = HISTORY_TABS[nextIndex];
    onChange(next.id);
    tabRefs.current[next.id]?.focus();
  }, [onChange]);

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label="历史类型"
      className="relative grid auto-cols-fr grid-flow-col items-center gap-1 rounded-xl bg-white/10 p-1 w-full [&_[role=tab]]:whitespace-nowrap [&_[role=tab]]:px-2"
      style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
    >
      {indicator && (
        <motion.div
          className="pointer-events-none absolute rounded-lg bg-white/[0.12] backdrop-blur-[28px]"
          style={{ boxShadow: '0 0.5px 0 0 rgba(255, 255, 255, 0.12) inset, 0 4px 8px 0 rgba(0, 0, 0, 0.04)' }}
          initial={false}
          animate={indicator}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      {HISTORY_TABS.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(element) => { tabRefs.current[tab.id] = element; }}
            role="tab"
            type="button"
            tabIndex={selected ? 0 : -1}
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`relative z-10 flex h-7 w-full min-w-0 appearance-none items-center justify-center rounded-lg p-0 text-xs font-medium leading-none ${
              selected ? 'text-[rgba(255,255,255,0.88)]' : 'text-[rgba(255,255,255,0.60)]'
            }`}
          >
            <span className="flex h-full w-full items-center justify-center px-4 text-center">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   搜索框 —— 官方 `Hbe` @1594xxx 之后
   ══════════════════════════════════════════════════════════════════════════ */
function HistorySearchBox({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <span className="relative block w-full">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={200}
        autoComplete="off"
        aria-label="搜索历史"
        placeholder="Search"
        className="h-8 w-full appearance-none rounded-full bg-transparent py-1 pl-[34px] pr-8 text-sm font-normal leading-5 text-white/80 shadow-none outline-none transition-colors placeholder:text-white/30 focus:ring-1 focus:ring-white/10 [&::-webkit-search-cancel-button]:hidden"
        /* 官方该 input 有内联 `style="border: 1px solid var(--Line-Primary, #FFFFFF14)"` */
        style={{ border: '1px solid var(--Line-Primary, #FFFFFF14)' }}
      />
      {value && (
        <button
          type="button"
          className="absolute right-2 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          onClick={() => onChange('')}
          aria-label="清除搜索"
          data-tooltip="清除搜索"
        >
          <IconX size={12} className="size-3" />
        </button>
      )}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   底栏 —— 官方 `JO` @1591881
   内层：`bg-popover/90` 在 MTV 用等价 color-mix 表达（见文件头说明）
   ══════════════════════════════════════════════════════════════════════════ */
function HistoryBottomBar({
  count,
  onClear,
  onApply,
  onDownload,
  isDownloading,
}: {
  count: number;
  onClear: () => void;
  onApply: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  const visible = count > 0;
  const [applying, setApplying] = useState(false);
  const lockRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  // 官方 `h`：500ms 忙碌锁（zbe）
  const handleApply = () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setApplying(true);
    onApply();
    timerRef.current = window.setTimeout(() => {
      lockRef.current = false;
      setApplying(false);
      timerRef.current = null;
    }, APPLY_BUSY_MS);
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center pb-3 pt-1.5 pointer-events-none transition-transform duration-300 ease-out"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(140%)' }}
      aria-hidden={!visible}
    >
      <div
        /* 官方底栏内层是**恒定** `pointer-events-auto`（实测 official-history-panel.html：
           `… h-9 rounded-lg pointer-events-auto bg-popover/90 backdrop-blur-md shadow-lg ring-1 ring-white/10`）；
           隐藏时靠外层 `translateY(140%)` 移出视口 ⇒ 这里不再按 `visible` 切换 pointer-events，保持逐字一致。 */
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg pointer-events-auto bg-[color-mix(in_srgb,var(--popover)_90%,transparent)] backdrop-blur-md shadow-lg ring-1 ring-white/10"
      >
        <button
          type="button"
          className="flex items-center justify-center w-5 h-5 rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          onClick={onClear}
          tabIndex={visible ? 0 : -1}
          aria-label="取消"
        >
          <IconX size={11} />
        </button>
        <span className="whitespace-nowrap px-1 text-xs text-white/70">{`已选 ${count} 个`}</span>
        <div className="mx-0.5 h-4 w-px shrink-0 bg-white/15" />
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] text-[#F5F5F5] transition-colors hover:bg-white/10 hover:text-[#F5F5F5] disabled:cursor-wait disabled:opacity-50"
          disabled={applying}
          aria-busy={applying}
          tabIndex={visible ? 0 : -1}
          onClick={handleApply}
          aria-label="应用到画布"
          data-tooltip="应用到画布"
          data-state="closed"
        >
          <IconCopy />
        </button>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50"
          disabled={isDownloading}
          aria-busy={isDownloading}
          tabIndex={visible ? 0 : -1}
          onClick={onDownload}
          aria-label="下载"
          data-tooltip="下载"
          data-state="closed"
        >
          <IconDownload size={13} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   网格卡（内联面板）—— 官方 `H` @src.js 21476 附近
   官方 DOM：
     div.absolute.overflow-hidden[@top/left/width/height/padding:6px]
       > div.w-full.h-full.overflow-hidden.rounded-md.relative.group[+ ring-2 ring-white ring-offset-1 ring-offset-background]
         > div.relative.w-full.h-full > img/video…
   ══════════════════════════════════════════════════════════════════════════ */
function HistoryGridCard({
  entry,
  selected,
  selectionMode,
  onToggleSelect,
  onActivate,
}: {
  entry: OutputHistoryEntry;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: (entry: OutputHistoryEntry, event?: { stopPropagation: () => void }) => void;
  onActivate: (entry: OutputHistoryEntry) => void;
}) {
  const category = historyCategoryOf(entry);
  const mediaUrl = entry.mediaUrl;
  const filePath = entry.filePath;
  /* ★ 模型名唯一出口（卡片标题只显示 displayName）*/
  const modelName = useModelNameResolver();
  return (
    <div
      className={[
        'w-full h-full overflow-hidden rounded-md relative group',
        selected ? 'ring-2 ring-white ring-offset-1 ring-offset-background' : '',
      ].filter(Boolean).join(' ')}
    >
      {category === 'video' ? (
        <HistoryLazyVideo
          mediaUrl={mediaUrl}
          filePath={filePath}
          onClick={() => onActivate(entry)}
          className="w-full h-full object-cover cursor-pointer hover:scale-105 hover:shadow-lg transition-all duration-300"
        />
      ) : category === 'image' && (mediaUrl || filePath) ? (
        <HistoryLazyImage
          mediaUrl={mediaUrl}
          filePath={filePath}
          alt={entry.id}
          onClick={() => onActivate(entry)}
          className="w-full h-full aspect-square object-cover cursor-pointer hover:scale-105 hover:shadow-lg transition-all duration-300"
        />
      ) : (
        <div
          className="w-full h-full overflow-hidden rounded-md bg-white/10 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/20 transition-colors"
          onClick={() => onActivate(entry)}
        >
          <IconMusic className="size-8 text-zinc-300" />
          <span className="text-xs text-zinc-400 px-2 text-center line-clamp-2">
            {entry.prompt || (entry.model ? modelName(entry.model, entry.provider) : '') || 'Audio'}
          </span>
        </div>
      )}
      {selectionMode && (
        <HistoryCheckbox
          selected={selected}
          className="opacity-100"
          onToggle={(event) => onToggleSelect(entry, event)}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   列表行（内联面板）—— 官方 `B` @src.js 18376 附近
   外层 `div.absolute.w-full.px-1[top/height:Dp=56]`，
   内层 `div.group.flex.items-center.gap-2.5.h-full.px-2.rounded-md.cursor-pointer…`
   ══════════════════════════════════════════════════════════════════════════ */
function HistoryListRow({
  entry,
  selected,
  selectionMode,
  onToggleSelect,
  onActivate,
}: {
  entry: OutputHistoryEntry;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: (entry: OutputHistoryEntry, event?: { stopPropagation: () => void }) => void;
  onActivate: (entry: OutputHistoryEntry) => void;
}) {
  const category = historyCategoryOf(entry);
  const mediaUrl = entry.mediaUrl;
  const filePath = entry.filePath;
  /* ★ 模型名唯一出口（列表行名只显示 displayName）*/
  const modelName = useModelNameResolver();
  return (
    <div
      className={[
        'group flex items-center gap-2.5 h-full px-2 rounded-md cursor-pointer transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        selected ? 'bg-white/5' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onActivate(entry)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onActivate(entry);
      }}
      role="button"
      tabIndex={0}
    >
      {selectionMode && (
        <div className="flex w-5 shrink-0 items-center justify-center">
          <HistoryCheckbox
            selected={selected}
            size={12}
            placement="inline"
            className="opacity-100"
            onToggle={(event) => onToggleSelect(entry, event)}
          />
        </div>
      )}
      <div className="relative shrink-0 w-11 h-11 rounded-md overflow-hidden bg-white/10">
        {category === 'video' ? (
          <HistoryLazyVideo mediaUrl={mediaUrl} filePath={filePath} className="w-full h-full object-cover" />
        ) : category === 'image' && (mediaUrl || filePath) ? (
          <HistoryLazyImage mediaUrl={mediaUrl} filePath={filePath} alt={entry.id} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <IconMusic className="size-5 text-zinc-300" />
          </div>
        )}
      </div>
      <span className="flex-1 min-w-0 truncate text-xs text-zinc-300">{historyListLabel(entry, modelName)}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   展开弹窗卡 —— 官方 `Gbe` @src.js 12 附近
   与内联网格卡不同：方形定尺（itemSize）、带右上角类型角标、hover 播放视频
   ══════════════════════════════════════════════════════════════════════════ */
function HistoryExpandCard({
  entry,
  size,
  selected,
  selectionMode,
  onToggleSelect,
  onActivate,
}: {
  entry: OutputHistoryEntry;
  size: number;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: (entry: OutputHistoryEntry, event?: { stopPropagation: () => void }) => void;
  onActivate: (entry: OutputHistoryEntry) => void;
}) {
  const category = historyCategoryOf(entry);
  const mediaUrl = entry.mediaUrl;
  const filePath = entry.filePath;
  return (
    <div
      className={[
        'group relative cursor-pointer overflow-hidden rounded-md bg-card transition-[width,height,box-shadow] duration-150 ease-out hover:shadow-lg',
        selected ? 'ring-2 ring-white ring-offset-1 ring-offset-background' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onActivate(entry)}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {selectionMode && (
        <HistoryCheckbox
          selected={selected}
          className="opacity-100"
          onToggle={(event) => onToggleSelect(entry, event)}
        />
      )}
      {!selected && (
        <div className="pointer-events-none absolute right-1.5 top-1.5 z-[5] rounded bg-black/55 px-1 py-0.5">
          {category === 'image'
            ? <IconImageType className="size-3.5 text-white/90" />
            : category === 'video'
              ? <IconVideoType className="size-3.5 text-white/90" />
              : <IconMusic className="size-3.5 text-white/90" />}
        </div>
      )}
      {category === 'image' ? (
        <HistoryLazyImage mediaUrl={mediaUrl} filePath={filePath} alt={entry.id} className="w-full h-full object-cover" />
      ) : category === 'video' ? (
        <HistoryLazyVideo
          mediaUrl={mediaUrl}
          filePath={filePath}
          hoverPlay
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-white/10">
          <IconMusic className="size-6 text-zinc-300" />
          <span className="text-[10px] text-zinc-400 px-1.5 text-center line-clamp-2">
            {entry.prompt || entry.model || 'Audio'}
          </span>
        </div>
      )}
    </div>
  );
}

/** 「加载中」转圈 —— 官方 `Tm`(lucide loader-circle) + `size-5 animate-spin` */
function HistorySpinner() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-loader-circle size-5 animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   素材大小滑块 —— 官方是 Radix Slider（`mv`，`w-32` min=80 max=175 step=4）
   ⚠️ MTV 没有 Radix ⇒ 这里按官方实测 DOM 复刻同样的三层结构 + 同样的类名与几何：
     实测 outerHTML（D:\DEEPSEEK\official-history-expand.html 第 15–24 行）：
       span[aria-label=素材大小].group.relative.flex.touch-none.select-none.items-center.w-32
         > span.relative.grow.overflow-hidden.rounded-full.bg-white/18.h-1.5   ← 轨道
             > span.absolute.bg-white.h-full  style="left:0%;right:57.8947%"   ← 已填充
         > span[style="transform:var(--radix-slider-thumb-transform);position:absolute;left:calc(42.1053% + 1.26316px)"]
             > span[role=slider][aria-valuemin=80][aria-valuemax=175][aria-valuenow=120]
                   .block.h-4.w-4.rounded-full.border-2.border-white.bg-white.shadow-md…
   拇指偏移 = Radix 的 `calc(p% + (thumbSize/2 − p/100·thumbSize)px)`：
     42.1053% ⇒ 8 − 0.421053×16 = 1.26316px ✓（与实测逐字一致）
   Tailwind v3 差异：官方 `bg-white/18`（18 不是 v3 opacity 刻度的倍数）⇒ `bg-white/[0.18]`
   ══════════════════════════════════════════════════════════════════════════ */
function HistorySizeSlider({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  /* 结构与 class 全部来自共享的 `OfficialSlider`（官方同一套 Radix Slider DOM）。
     这里只固定官方 `mv` 的两个参数：`className:"w-32"` + `aria-label:"素材大小"`。 */
  return (
    <OfficialSlider
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      className="w-32"
      ariaLabel="素材大小"
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   展开弹窗 —— 官方 `t0e` @1606159
   实测 outerHTML：D:\DEEPSEEK\official-history-expand.html
   实测 computed style：D:\DEEPSEEK\official-history-expand.styles.json
   结构（逐字）：
     div[role=dialog][data-testid=common-dialog-content][data-state=open].fixed.left-[50%].top-[50%].z-50…
       > h2.text-lg.font-semibold.leading-none.tracking-tight.sr-only「历史」（无障碍标题）
       > div.flex.h-full.min-h-0.flex-col（framer：opacity/scale/y）
           > 头部 div.flex.w-full.shrink-0.flex-col.gap-3.px-4.pb-3.pt-4
                > div.flex.h-8.w-full.items-center.gap-1.5（h2 + div.flex.items-center.gap-2 的按钮组）
                > 项目范围 tablist（div.flex.h-8.items-center.gap-1[role=tablist][aria-label=项目范围]）
                > 搜索框（与侧栏面板同一个 Hbe）
           > Radix ScrollArea（root class 多了 `min-h-0 flex-1 px-4 pb-6`）
                > div.space-y-6 > 每个日期一个 section（标题 text-xs font-medium text-white/65
                  + div.flex.flex-wrap.items-center.gap-2 的卡片流）
           > 底部选择栏（同一个 `JO`）
   遮罩：div.fixed.inset-0.z-50.bg-black/45[data-testid=common-dialog-container][data-state=open]（无 blur）
   ══════════════════════════════════════════════════════════════════════════ */
export function HistoryExpandDialog({
  open,
  onClose,
  groups,
  itemSize,
  onItemSizeChange,
  selectionMode,
  selectedCount,
  isSelected,
  onToggleSelect,
  onActivate,
  onExitSelection,
  onEnterSelection,
  hasError,
  loading,
  hasMore,
  scope,
  onScopeChange,
  currentScopeDisabled,
  searchValue,
  onSearchChange,
  onApplySelection,
  onDownloadSelection,
  isDownloading,
}: {
  open: boolean;
  onClose: () => void;
  groups: HistoryGroup[];
  itemSize: number;
  onItemSizeChange: (next: number) => void;
  selectionMode: boolean;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  onToggleSelect: (entry: OutputHistoryEntry, event?: { stopPropagation: () => void }) => void;
  onActivate: (entry: OutputHistoryEntry) => void;
  onExitSelection: () => void;
  onEnterSelection: () => void;
  hasError: boolean;
  loading: boolean;
  hasMore: boolean;
  scope: HistoryScope;
  onScopeChange: (next: HistoryScope) => void;
  currentScopeDisabled: boolean;
  searchValue: string;
  onSearchChange: (next: string) => void;
  onApplySelection: () => void;
  onDownloadSelection: () => void;
  isDownloading: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  /* Radix ScrollArea Root / Viewport（弹窗正文那一处）—— 滑条与几何都挂这两层 */
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const reachedEnd = !hasMore;
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  // 官方 Radix Dialog：Esc 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose, open]);

  return createPortal(
    /* ⚠️ `createPortal(...)` 返回的是 **REACT_PORTAL_TYPE** 节点、不是 `REACT_ELEMENT_TYPE`
       ⇒ `React.isValidElement(portal) === false` ⇒ 如果把它直接塞进 `<AnimatePresence>` 当子节点，
       framer 会**直接忽略**这个子树（弹窗永远不渲染）✗。
       所以 portal 必须在**最外层**，AnimatePresence 仍然看到原来的 Fragment 子节点（进出场动画不变）。
       下面是官方 Radix `Dialog.Overlay` / `Dialog.Content` 的结构（官方都 portal 到 document.body）。 */
    <AnimatePresence>
      {open && (
        <>
          {/* 官方遮罩：`fixed inset-0 z-50 bg-black/45`（无 backdrop-blur）
              ★ 官方是 Radix Dialog ⇒ 遮罩与弹窗内容都 **portal 到 document.body**。
                实测（9444）：遮罩 `div.fixed.inset-0.z-50.bg-black/45[data-testid=common-dialog-container]`
                是 **body 的直接子节点**，而面板 `aside[data-history-panel]` 的 `z-60` 在
                `div.app-shell__content`（MTV 那个容器有 `clip-path` ⇒ **自有堆叠上下文**）里 ⇒
                遮罩虽只有 z-50，却在**根**堆叠上下文里，实际画在面板之上：
                `document.elementFromPoint(面板底部中心)` = 遮罩 DIV ✓、`elementFromPoint(竖条历史按钮)` 也是遮罩 ✓。
                MTV 之前把遮罩留在 `.app-shell__content` 内 ⇒ 与面板同一个堆叠上下文 ⇒ z-50 < z-60
                ⇒ 面板盖住遮罩、竖条按钮还能点 ✗ —— 这就是本条要修的问题。 */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/45"
            data-testid="common-dialog-container"
            data-state="open"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={onClose}
          />
          {/* ⚠️ 官方弹窗本体是 `z-50`（`.z-50` 未被改写）；MTV 保持同一数值 */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="common-dialog-content"
            data-state="open"
            /* 官方弹窗内也没有可见滚动条（Radix ScrollArea + 注入的 display:none）⇒
               与侧栏面板同样排除 MTV 自绘滑条（见 `[data-history-panel]` 上的注释）。 */
            data-overlay-scrollbar="off"
            tabIndex={-1}
            className="fixed left-[50%] top-[50%] z-50 bg-popover text-popover-foreground min-w-[300px] max-w-none translate-x-[-50%] translate-y-[-50%] h-[min(760px,calc(100vh-32px))] w-[min(1180px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(140%_120%_at_50%_0%,rgba(101,103,102,0.36)_0%,rgba(26,26,26,0.92)_55%,rgba(18,18,18,0.96)_100%)] p-0 shadow-[0_24px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[40px]"
            style={{ pointerEvents: 'auto' }}
          >
            <h2 id={titleId} className="text-lg font-semibold leading-none tracking-tight sr-only">历史</h2>
            <motion.div
              className="flex h-full min-h-0 flex-col"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99, y: -6 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: PANEL_EASE }}
            >
              {/* 头部 —— 官方 `ZO`（无 leadingAction；actions 的 gap 是 `gap-2`，与侧栏面板的 `gap-1` 不同） */}
              <div className="flex w-full shrink-0 flex-col gap-3 px-4 pb-3 pt-4">
                <div className="flex h-8 w-full items-center gap-1.5">
                  <h2 className="min-w-0 flex-1 truncate text-xl font-semibold leading-7 tracking-[-0.03em] text-white/90">历史</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={selectionMode}
                      onClick={selectionMode ? onExitSelection : onEnterSelection}
                      className={`inline-flex h-8 shrink-0 items-center justify-center rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${selectionMode ? 'bg-white/90 text-black hover:bg-white' : 'text-white/60 hover:bg-white/10 hover:text-white/90'}`}
                    >
                      {selectionMode ? '取消' : '选择'}
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
                      onClick={() => onItemSizeChange(Math.max(itemSize - EXPAND_ITEM_SIZE_STEP, EXPAND_ITEM_SIZE_MIN))}
                      aria-label="缩小素材"
                      data-tooltip="缩小素材"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-minus size-4" aria-hidden="true">
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <HistorySizeSlider
                      value={itemSize}
                      onChange={onItemSizeChange}
                      min={EXPAND_ITEM_SIZE_MIN}
                      max={EXPAND_ITEM_SIZE_MAX}
                      step={EXPAND_ITEM_SIZE_STEP}
                    />
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
                      onClick={() => onItemSizeChange(Math.min(itemSize + EXPAND_ITEM_SIZE_STEP, EXPAND_ITEM_SIZE_MAX))}
                      aria-label="放大素材"
                      data-tooltip="放大素材"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus size-4" aria-hidden="true">
                        <path d="M5 12h14" />
                        <path d="M12 5v14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
                      aria-label="关闭"
                      data-tooltip="关闭"
                      onClick={onClose}
                    >
                      <IconX size={24} className="size-4" />
                    </button>
                  </div>
                </div>

                {/* 项目范围 —— 官方 `Vbe`：`div.flex.h-8.items-center.gap-1[role=tablist][aria-label=项目范围]` */}
                <div className="flex h-8 items-center gap-1" role="tablist" aria-label="项目范围">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scope === 'all'}
                    className={`h-7 rounded-lg px-3 text-xs font-medium transition-colors ${scope === 'all' ? 'bg-white/10 text-white/90 ring-1 ring-white/[0.08]' : 'text-white/55 hover:bg-white/5 hover:text-white/80'}`}
                    onClick={() => onScopeChange('all')}
                  >
                    所有项目
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scope === 'current'}
                    disabled={currentScopeDisabled}
                    className={[
                      'h-7 rounded-lg px-3 text-xs font-medium transition-colors',
                      scope === 'current'
                        ? 'bg-white/10 text-white/90 ring-1 ring-white/[0.08]'
                        : 'text-white/55 hover:bg-white/5 hover:text-white/80',
                      currentScopeDisabled ? 'cursor-not-allowed text-white/25 hover:bg-transparent' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => onScopeChange('current')}
                  >
                    当前项目
                  </button>
                </div>

                <HistorySearchBox value={searchValue} onChange={onSearchChange} />
              </div>

              {/* 正文 —— 官方 Radix ScrollArea root：`min-h-0 flex-1 px-4 pb-6`（+ Radix 的 `relative overflow-hidden`） */}
              <div
                ref={scrollRootRef}
                dir="ltr"
                className="relative overflow-hidden min-h-0 flex-1 px-4 pb-6"
                style={{
                  position: 'relative',
                  '--radix-scroll-area-corner-width': '0px',
                  '--radix-scroll-area-corner-height': '0px',
                } as CSSProperties}
              >
                <style>{'[data-radix-scroll-area-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-scroll-area-viewport]::-webkit-scrollbar{display:none}'}</style>
                <div ref={scrollerRef} data-radix-scroll-area-viewport="" className="h-full w-full rounded-[inherit]" style={{ overflow: 'hidden scroll' }}>
                  <div style={{ minWidth: '100%', display: 'table' }}>
                    <div className="space-y-6">
                      {hasError && (
                        <div role="alert" className="rounded-lg border border-red-400/15 bg-red-400/[0.08] px-3 py-2 text-sm text-red-100/75">
                          历史记录加载失败
                        </div>
                      )}
                      {groups.map((group) => (
                        <section key={group.date}>
                          <div className="mb-3 text-xs font-medium text-white/65">{group.date}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            {group.items.map((entry, index) => (
                              <HistoryExpandCard
                                key={`dialog-${entry.nodeType}-${entry.id || index}-${index}`}
                                entry={entry}
                                size={itemSize}
                                selected={isSelected(entry.id)}
                                selectionMode={selectionMode}
                                onToggleSelect={onToggleSelect}
                                onActivate={onActivate}
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                      {!reachedEnd && (
                        <div className="flex justify-center py-4 text-white/45">
                          <HistorySpinner />
                        </div>
                      )}
                      {reachedEnd && total === 0 && !hasError && (
                        <div className="flex min-h-48 items-center justify-center text-sm text-white/40">
                          {loading ? '正在加载历史记录…' : '暂无历史记录'}
                        </div>
                      )}
                      <div className="h-3 w-full" aria-hidden="true" />
                    </div>
                  </div>
                </div>
                {/* 官方 `<ScrollBar/>`（只有竖向一条）+ `<Corner/>`（无横向条 ⇒ 官方渲染 null） */}
                <OfficialScrollAreaBar rootRef={scrollRootRef} viewportRef={scrollerRef} />
              </div>

              <HistoryBottomBar
                count={selectedCount}
                onClear={onExitSelection}
                onApply={onApplySelection}
                onDownload={onDownloadSelection}
                isDownloading={isDownloading}
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   面板主体 —— 官方 `i0e`
   ══════════════════════════════════════════════════════════════════════════ */
export default function OutputHistoryPanel() {
  const {
    outputHistoryRecords,
    historyHasMore,
    historyLoading,
    historyError,
    historyProjectId,
    currentProjectId,
    historyPanelOpen,
    setHistoryPanelOpen,
    loadHistoryFromDb,
    loadMoreHistoryFromDb,
    showToast,
    minimapVisible,
  } = useAppStore(
    useShallow((s) => ({
      outputHistoryRecords: s.outputHistoryRecords,
      historyHasMore: s.historyHasMore,
      historyLoading: s.historyLoading,
      historyError: s.historyError,
      historyProjectId: s.historyProjectId,
      currentProjectId: s.currentProjectId,
      historyPanelOpen: s.historyPanelOpen,
      setHistoryPanelOpen: s.setHistoryPanelOpen,
      loadHistoryFromDb: s.loadHistoryFromDb,
      loadMoreHistoryFromDb: s.loadMoreHistoryFromDb,
      showToast: s.showToast,
      /* 官方 `style={{bottom: y?210:60}}` 的 `y` = 小地图开关（见文件头偏离 3） */
      minimapVisible: s.minimapVisible,
    })),
  );

  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<HistoryTabId>('image');
  const [view, setView] = useState<HistoryViewMode>('grid');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // 官方 `f`（防抖 300ms 后）
  const [expanded, setExpanded] = useState(false);
  const [itemSize, setItemSize] = useState(EXPAND_ITEM_SIZE_DEFAULT);
  const [downloading, setDownloading] = useState(false);
  /* 项目范围 —— 官方 `h`（初始 "all"）；弹窗关闭时官方会重置回 "all"（`i0e`: `a||m("all")`） */
  const [scope, setScope] = useState<HistoryScope>('all');
  const [allProjectEntries, setAllProjectEntries] = useState<OutputHistoryEntry[] | null>(null);
  const [allProjectsLoading, setAllProjectsLoading] = useState(false);
  const [allProjectsError, setAllProjectsError] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  /* Radix ScrollArea **Root**（`relative overflow-hidden` 那层）—— 滑条的 pointerenter/leave 挂这里 */
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  /* 选择模式 —— 官方 `tF` @src.js 31 */
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);
  const toggleSelect = useCallback((entry: OutputHistoryEntry, event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  }, []);
  const enterSelectionMode = useCallback(() => setSelectionMode(true), []);
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  /* 搜索防抖：官方 `s0e = 300`
     + 官方 `useEffect(()=>{b.exitSelectionMode()},[f])`：防抖后的搜索词变化时退出选择模式
     （放在 timer 回调里，避免在 effect 体内同步 setState） */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      exitSelectionMode();
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [exitSelectionMode, searchInput]);

  const historyQuery = useMemo(() => ({
    /* 一组 nodeType = 官方一个 `generation_type`（见 `TAB_TO_NODE_TYPES` 注释） */
    nodeTypes: TAB_TO_NODE_TYPES[tab],
    search: search || undefined,
  }), [search, tab]);

  /* 当前项目：MTV 现有 store 管道（只在 scope = current 时查询，避免重复打库） */
  useEffect(() => {
    if (!historyPanelOpen || scope !== 'current') return;
    void loadHistoryFromDb(historyQuery);
  }, [currentProjectId, historyPanelOpen, historyQuery, loadHistoryFromDb, scope]);

  /* 所有项目：官方 `h==="all"` 分支。MTV 的历史库按项目分片（`getHistoryEntriesPage(projectId,…)`），
     没有跨项目分页 API ⇒ 复用**既有只读服务** `getHistoryEntriesForExport(projectId, query)`
     逐项目取回后按时间倒序合并（一次性取全，因此该范围下没有「加载更多」）。 */
  useEffect(() => {
    if (!historyPanelOpen || scope !== 'all') return;
    let cancelled = false;
    void (async () => {
      setAllProjectsLoading(true);
      setAllProjectsError(false);
      try {
        const projectIds = useAppStore.getState().projects.map((project) => project.id);
        const pages = await Promise.all(
          projectIds.map((projectId) => getHistoryEntriesForExport(projectId, historyQuery)),
        );
        if (cancelled) return;
        const merged = pages.flat().map((record) => record as unknown as OutputHistoryEntry);
        merged.sort((a, b) => b.timestamp - a.timestamp);
        setAllProjectEntries(merged);
      } catch (error) {
        console.warn('Failed to load history across projects:', error);
        if (!cancelled) setAllProjectsError(true);
      } finally {
        if (!cancelled) setAllProjectsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [historyPanelOpen, historyQuery, scope]);

  /* 切换 tab / 搜索后回到顶部（官方每种类型各有独立列表，天然从顶部开始） */
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [historyQuery]);

  /* 无限滚动（官方由虚拟化列表的 viewportBuffer=320 触发 `loadMore`）
     仅「当前项目」范围有分页；「所有项目」是一次性取全 ⇒ hasMore 恒 false */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!historyPanelOpen || scope !== 'current' || !historyHasMore || historyLoading || !sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      void loadMoreHistoryFromDb(historyQuery);
    }, { root: scrollerRef.current, rootMargin: '300px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historyHasMore, historyLoading, historyPanelOpen, historyQuery, loadMoreHistoryFromDb, scope]);

  const storeEntries = useMemo(
    () => (historyProjectId === currentProjectId ? outputHistoryRecords : []),
    [currentProjectId, historyProjectId, outputHistoryRecords],
  );
  const entries = useMemo(
    () => (scope === 'current' ? storeEntries : (allProjectEntries ?? [])),
    [allProjectEntries, scope, storeEntries],
  );
  const isLoading = scope === 'current' ? historyLoading : allProjectsLoading;
  const hasError = scope === 'current' ? historyError : allProjectsError;
  const hasMore = scope === 'current' ? historyHasMore : false;
  const groups = useMemo(() => groupHistoryByDate(entries), [entries]);

  /* ── 网格行（官方 `r0e` + `Sb` 的 absolute 布局） ── */
  const gridRows = useMemo(() => {
    type GridRow = {
      key: string;
      top: number;
      kind: 'header' | 'assets';
      dateKey: string;
      entries: (OutputHistoryEntry | null)[];
    };
    const rows: GridRow[] = [];
    let top = 0;
    for (const group of groups) {
      rows.push({
        key: `header-${group.date}`,
        top,
        kind: 'header',
        dateKey: group.date,
        entries: [],
      });
      top += GRID_HEADER_HEIGHT;
      for (let index = 0; index < group.items.length; index += GRID_COLUMN_COUNT) {
        rows.push({
          key: `row-${group.date}-${index}`,
          top,
          kind: 'assets',
          dateKey: group.date,
          entries: group.items.slice(index, index + GRID_COLUMN_COUNT),
        });
        top += GRID_ITEM_HEIGHT;
      }
    }
    return { rows, totalHeight: top };
  }, [groups]);

  /* ── 列表行（官方 `Dp=56` 的同构布局） ── */
  const listRows = useMemo(() => {
    type ListRow = { key: string; top: number; kind: 'header' | 'asset'; dateKey: string; entry?: OutputHistoryEntry };
    const rows: ListRow[] = [];
    let top = 0;
    for (const group of groups) {
      rows.push({ key: `list-header-${group.date}`, top, kind: 'header', dateKey: group.date });
      top += GRID_HEADER_HEIGHT;
      for (const entry of group.items) {
        rows.push({ key: `list-asset-${entry.id}`, top, kind: 'asset', dateKey: group.date, entry });
        top += LIST_ROW_HEIGHT;
      }
    }
    return { rows, totalHeight: top };
  }, [groups]);

  /* ── 「应用到画布」：官方 `Q`（把选中素材落成画布节点 + 选中新节点） ──
     MTV 复用既有服务 `applyLibraryFileToCanvas`（`services/assetRowActions.ts`），
     不新建/修改任何画布或节点逻辑。 */
  const applyEntriesToCanvas = useCallback((targets: OutputHistoryEntry[]) => {
    if (targets.length === 0) return;
    /* ⚠️ `applyLibraryFileToCanvas` 现在是 **async**（要 load 图片量真实比例，
        卡片尺寸才不会被写死成 16:9 —— 见该函数注释）⇒ 这里改成 Promise.all。 */
    void Promise.all(targets.map((entry) => applyLibraryFileToCanvas({
      category: historyCategoryOf(entry),
      name: entry.prompt?.trim() || entry.nodeLabel || entry.id,
      assetUrl: entry.mediaUrl,
      path: entry.filePath || entry.mediaUrl || '',
    }))).then((results) => {
      if (!results.some(Boolean)) {
        showToast('该素材无法添加到画布', 'error');
        return;
      }
      showToast('已添加到画布');
    });
  }, [showToast]);

  /** 官方 `J`：选择模式下点击 = 切换选中；否则 = 应用到画布 */
  const handleActivate = useCallback((entry: OutputHistoryEntry) => {
    if (selectionMode) {
      toggleSelect(entry);
      return;
    }
    applyEntriesToCanvas([entry]);
  }, [applyEntriesToCanvas, selectionMode, toggleSelect]);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedIds.has(entry.id)),
    [entries, selectedIds],
  );

  const handleApplySelection = useCallback(() => {
    const targets = [...selectedEntries];
    exitSelectionMode();
    applyEntriesToCanvas(targets);
  }, [applyEntriesToCanvas, exitSelectionMode, selectedEntries]);

  /* 官方 `S` = `downloadHistoryAssets`（走官方下载/传输通道）；
     MTV 复用既有 `downloadNodesByIds`（要的是**来源节点 id**） */
  const handleDownloadSelection = useCallback(() => {
    const ids = selectedEntries.map((entry) => entry.nodeId);
    if (ids.length === 0) {
      showToast('所选记录没有可下载的文件', 'error');
      return;
    }
    setDownloading(true);
    void downloadNodesByIds(ids).finally(() => setDownloading(false));
  }, [selectedEntries, showToast]);

  /* 官方 `z`：切 tab ⇒ 退出选择模式；`re`：Expand ⇒ 退出选择模式并打开弹窗
     弹窗关闭时把项目范围重置回「所有项目」（官方 `i0e`: `useEffect(()=>{a||m("all")},[a])`） */
  const handleTabChange = useCallback((next: HistoryTabId) => {
    setTab(next);
    exitSelectionMode();
  }, [exitSelectionMode]);
  const handleExpand = useCallback(() => {
    exitSelectionMode();
    setExpanded(true);
  }, [exitSelectionMode]);
  const handleExpandClose = useCallback(() => {
    setExpanded(false);
    setScope('all');
  }, []);
  /* 官方 `t0e`: `useEffect(()=>{_.exitSelectionMode()},[c,o,_.exitSelectionMode])`（范围变化也退出选择） */
  const handleScopeChange = useCallback((next: HistoryScope) => {
    setScope(next);
    exitSelectionMode();
  }, [exitSelectionMode]);

  const showSkeleton = isLoading && entries.length === 0;

  return (
    <AnimatePresence>
      {historyPanelOpen && (
        <>
        <motion.aside
          data-history-panel="true"
          /* ★ 官方这个面板用 Radix ScrollArea 且**完全不显示滚动条**（注入样式
             `[data-radix-scroll-area-viewport]{scrollbar-width:none}::-webkit-scrollbar{display:none}`，
             实测 DOM 里也没有任何 `[data-radix-scroll-area-scrollbar]`）—— 而 MTV 全局
             `OverlayScrollbarLayer` 会给可滚动元素自绘 4px `#3a3a50` 的滑条（用户：「列表视图里
             水平排列时的滑条 粗细和颜色不对」）。这里按 MTV 既有约定
             （`OverlayScrollbarLayer.tsx:22` 的 `DISCOVERY_EXCLUSION_SELECTOR`，设置面板/官方弹窗
             `.o-dialog__body` 都这么标）把整棵子树排除 ⇒ 与官方一样没有滑条。 */
          data-overlay-scrollbar="off"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.2, ease: PANEL_EASE }}
          /* 官方 `style={{width:320, bottom: y?210:60}}`；`y` = **小地图开关**
             （官方小地图占位 150 + 4 + 40 = 194、距下 59 ⇒ 打开时底部让到 210；
               实测注释见 `src/components/Canvas.tsx:2022-2026`）。
             `top: 64`（`top-16`）不变 ⇒ 切换时**只有底部/高度变化**。 */
          style={{ width: 320, bottom: minimapVisible ? 210 : 60 }}
          className="fixed left-4 top-16 z-[60] flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border-[0.5px] border-white/10 bg-[rgba(22,22,22,0.82)] px-2 py-3 shadow-[0_0.5px_0_0_rgba(255,255,255,0.14)_inset,0_4px_8px_0_rgba(0,0,0,0.04)] backdrop-blur-[40px] transition-[bottom] duration-200"
        >
          {/* 头部 —— 官方 `ZO` 的 `flex w-full shrink-0 flex-col gap-3` 容器 */}
          <div className="flex w-full shrink-0 flex-col gap-3">
            <div className="flex h-8 w-full items-center gap-1.5">
              <button
                type="button"
                /* ⚠️ 官方语义：`onClick = onBack`（回素材面板）；MTV 无共享壳 ⇒ 关闭面板 */
                onClick={() => setHistoryPanelOpen(false)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
                aria-label="返回"
                data-state="closed"
                data-tooltip="返回"
              >
                <IconChevronLeft />
              </button>
              <h2 className="min-w-0 flex-1 truncate text-xl font-semibold leading-7 tracking-[-0.03em] text-white/90">历史</h2>
              <div className="flex shrink-0 items-center gap-1">
                {/* 官方 `eF`：恒在，文案在「选择 / 取消」之间切换 */}
                <button
                  type="button"
                  aria-pressed={selectionMode}
                  onClick={selectionMode ? exitSelectionMode : enterSelectionMode}
                  className={`inline-flex h-8 shrink-0 items-center justify-center rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${selectionMode ? 'bg-white/90 text-black hover:bg-white' : 'text-white/60 hover:bg-white/10 hover:text-white/90'}`}
                >
                  {selectionMode ? '取消' : '选择'}
                </button>
                <button
                  type="button"
                  onClick={() => setView((prev) => (prev === 'grid' ? 'list' : 'grid'))}
                  className="inline-flex size-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
                  aria-label={view === 'grid' ? '列表视图' : '网格视图'}
                  data-state="closed"
                  data-tooltip={view === 'grid' ? '列表视图' : '网格视图'}
                >
                  {view === 'grid' ? <IconList className="size-4" /> : <IconLayoutGrid className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleExpand}
                  className="inline-flex size-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
                  aria-label="Expand"
                  data-state="closed"
                  data-tooltip="展开"
                >
                  <IconMaximize2 className="size-4" />
                </button>
              </div>
            </div>
            <HistoryTypeTabs value={tab} onChange={handleTabChange} />
            <HistorySearchBox
              value={searchInput}
              onChange={(next) => {
                setSearchInput(next);
                scrollerRef.current?.scrollTo({ top: 0 });
              }}
            />
          </div>

          {/* 正文 —— 官方 `div[data-history-content] relative min-h-0 w-full flex-1` */}
          <div data-history-content="true" className="relative min-h-0 w-full flex-1">
            {/* 骨架层（官方：仅 `loading && items.length===0` 时可见） */}
            <div className={`absolute inset-0 z-20 transition-opacity duration-300 ${showSkeleton ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="px-2 py-1 mt-1 mb-2">
                <div className="animate-pulse">
                  <div className="h-4 w-24 rounded bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 px-1.5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className="animate-pulse">
                    <div className="rounded-md bg-muted" style={{ height: `${GRID_ITEM_HEIGHT}px` }} />
                  </div>
                ))}
              </div>
            </div>

            {/* 错误条（官方网格视图：`absolute inset-x-2 top-2 z-30 … backdrop-blur`） */}
            {hasError && (
              <div role="alert" className="absolute inset-x-2 top-2 z-30 rounded-lg border border-red-400/15 bg-[#21191a]/95 px-3 py-2 text-center text-xs text-red-100/75 backdrop-blur">
                历史记录加载失败
              </div>
            )}

            {/* 内容层 —— 官方 Radix ScrollArea 的等价 DOM（同样的 class 与内联 style） */}
            <div className="absolute inset-0 block">
              <div
                ref={scrollRootRef}
                dir="ltr"
                className="relative overflow-hidden h-full"
                /* 官方 `ScrollArea.Root` 的内联 style（@2492007 逐字）：
                   `{position:"relative","--radix-scroll-area-corner-width":b+"px","--radix-scroll-area-corner-height":M+"px"}`
                   —— 没有角（Corner 渲染 null）⇒ width/height 都是 0px */
                style={{
                  position: 'relative',
                  '--radix-scroll-area-corner-width': '0px',
                  '--radix-scroll-area-corner-height': '0px',
                } as CSSProperties}
              >
                <style>{'[data-radix-scroll-area-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-scroll-area-viewport]::-webkit-scrollbar{display:none}'}</style>
                <div
                  ref={scrollerRef}
                  data-radix-scroll-area-viewport=""
                  className="h-full w-full rounded-[inherit]"
                  style={{ overflow: 'hidden scroll' }}
                >
                  <div style={{ minWidth: '100%', display: 'table' }}>
                    <div className="relative" style={{ height: `${view === 'grid' ? gridRows.totalHeight : listRows.totalHeight}px`, contain: 'none' }}>
                      {view === 'grid'
                        ? gridRows.rows.map((row) => (
                          row.kind === 'header' ? (
                            <div
                              key={row.key}
                              className="absolute"
                              style={{ top: `${row.top}px`, left: 0, width: '100%', height: `${GRID_HEADER_HEIGHT}px`, padding: '6px' }}
                            >
                              <div className="flex items-center h-full px-2 text-sm font-medium text-zinc-200">{row.dateKey}</div>
                            </div>
                          ) : (
                            row.entries.map((entry, columnIndex) => (
                              entry && (
                                <div
                                  key={`${row.key}-${entry.id}`}
                                  className="absolute overflow-hidden"
                                  style={{
                                    top: `${row.top}px`,
                                    left: `${columnIndex * (100 / GRID_COLUMN_COUNT)}%`,
                                    width: `${100 / GRID_COLUMN_COUNT}%`,
                                    height: `${GRID_ITEM_HEIGHT}px`,
                                    padding: '6px',
                                  }}
                                >
                                  <HistoryGridCard
                                    entry={entry}
                                    selected={selectedIds.has(entry.id)}
                                    selectionMode={selectionMode}
                                    onToggleSelect={toggleSelect}
                                    onActivate={handleActivate}
                                  />
                                </div>
                              )
                            ))
                          )
                        ))
                        : listRows.rows.map((row) => (
                          row.kind === 'header' ? (
                            <div
                              key={row.key}
                              className="absolute"
                              style={{ top: `${row.top}px`, left: 0, width: '100%', height: `${GRID_HEADER_HEIGHT}px` }}
                            >
                              <div className="flex items-center h-full px-3 text-xs font-medium text-zinc-400">{row.dateKey}</div>
                            </div>
                          ) : (
                            row.entry && (
                              <div
                                key={row.key}
                                className="absolute w-full px-1"
                                style={{ top: `${row.top}px`, height: `${LIST_ROW_HEIGHT}px` }}
                              >
                                <HistoryListRow
                                  entry={row.entry}
                                  selected={selectedIds.has(row.entry.id)}
                                  selectionMode={selectionMode}
                                  onToggleSelect={toggleSelect}
                                  onActivate={handleActivate}
                                />
                              </div>
                            )
                          )
                        ))}
                    </div>
                  </div>
                  {/* 无限滚动哨兵（官方 `t0e` 的 `<div ref={x} className="h-3 w-full"/>` 同位元素） */}
                  <div ref={sentinelRef} className="h-3 w-full" aria-hidden="true" />
                </div>
                {/* 官方 `<ScrollBar/>`（**只有竖向**一条）+ `<Corner/>`（无横向条 ⇒ 官方 Corner 渲染 null） */}
                <OfficialScrollAreaBar rootRef={scrollRootRef} viewportRef={scrollerRef} />
              </div>
            </div>

            {/* 空态：官方内联面板本身不渲染空态（`i0e` 只渲染列表），
                这里沿用官方展开弹窗 `t0e` 的空态 markup（`assets.empty`） */}
            {!showSkeleton && !hasError && entries.length === 0 && (
              <div className="absolute inset-0 z-10 flex min-h-48 items-center justify-center text-sm text-white/40">
                暂无历史记录
              </div>
            )}

            <HistoryBottomBar
              count={selectedIds.size}
              onClear={exitSelectionMode}
              onApply={handleApplySelection}
              onDownload={handleDownloadSelection}
              isDownloading={downloading}
            />
          </div>

        </motion.aside>

        {/* 弹出层放在 aside 之外：aside 有 `overflow-hidden` + framer 的 transform，
            弹窗留在里面会被裁掉（官方是 Radix Dialog，portal 到 body） */}
        <HistoryExpandDialog
          open={expanded}
          onClose={handleExpandClose}
          groups={groups}
          itemSize={itemSize}
          onItemSizeChange={setItemSize}
          selectionMode={selectionMode}
          selectedCount={selectedIds.size}
          isSelected={isSelected}
          onToggleSelect={toggleSelect}
          onActivate={handleActivate}
          onExitSelection={exitSelectionMode}
          onEnterSelection={enterSelectionMode}
          hasError={hasError}
          loading={isLoading}
          hasMore={hasMore}
          scope={scope}
          onScopeChange={handleScopeChange}
          currentScopeDisabled={!currentProjectId}
          searchValue={searchInput}
          onSearchChange={(next) => {
            setSearchInput(next);
            scrollerRef.current?.scrollTo({ top: 0 });
          }}
          onApplySelection={handleApplySelection}
          onDownloadSelection={handleDownloadSelection}
          isDownloading={downloading}
        />
        </>
      )}
    </AnimatePresence>
  );
}
