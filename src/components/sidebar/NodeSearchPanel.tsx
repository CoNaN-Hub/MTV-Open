/**
 * NodeSearchPanel — 官方「节点搜索」面板（`Vxe`）的逐字移植。
 *
 * 官方出处：`E:\TapNow-0.4.66\resources\web\assets\page-DPdEgTS0.js`
 *   · 组件 `Vxe=({open:e,onOpenChange:t})=>{…}`                        @char1530700
 *   · 弹窗外壳 `lr`(=Radix Dialog Root) / `cr`(=DialogContent)          @char1533570
 *     实测 dlgClass（父级 CDP 9444 实测，已含 radix 基类合并后的结果）：
 *     `fixed left-[50%] top-[50%] z-50 min-w-[300px] max-w-none translate-x-[-50%] translate-y-[-50%]
 *      flex max-h-[min(520px,calc(100vh-72px))] w-[min(640px,calc(100vw-28px))] flex-col overflow-hidden
 *      rounded-2xl border border-border bg-popover/90 p-0 text-popover-foreground shadow-2xl backdrop-blur-2xl`
 *   · 遮罩 `I8a` 默认 `fixed inset-0 z-50 bg-black/80` + `overlayClassName:"bg-background/30"`
 *     （twMerge 后 = `fixed inset-0 z-50 bg-background/30`）              @char1533570
 *   · 头部 / 输入 / 清除键 / 筛选条 / 结果列表 / 结果行 / 空态             @char1533800–1536420
 *   · 键盘 `M`                                                            @char1533000
 *   · 结果行图标 `Oxe` + `Lxe`                                            @char1528955 / 1528470
 *   · 滚动保底 `Vy` / `ik` / `Bxe`（`to=8`）                              @char1530140–1530620
 *   · 选中后高亮 `A`（`j0`/`jxe` 加类 + `Exe=1100ms` 后移除）              @char1532580
 *   · 视口聚焦 `T`(`fitBounds` duration `sk=500` padding `Nxe=.35`) / `k` / `j`
 *   · 纯逻辑内核见 `nodeSearchCore.ts`（字段表 `ni`、打分 `T0`、排序 `Sxe`/`vxe`）
 *
 * ⚠️ MTV 偏离（逐条见下方注释）：
 *   1. 弹窗用 `createPortal` + 普通 DOM 复刻 Radix Dialog（MTV 无 `@radix-ui/*`），
 *      与 `shared/OfficialModalContainer.tsx` 同一套做法。
 *   2. 高亮类写在 **React Flow 的节点 DOM** 上（`.react-flow__node[data-id]`），
 *      不改 store 里的 node 对象（官方走 `setNodes` 改 `node.className`）。
 *   3. 视口聚焦用 MTV 的 `canvasViewportController.fitView`；官方 `k` 那套
 *      「节点 ∪ 生成输入条」并集取景 MTV 没有等价物（见 `focusNodeInViewport`）。
 *   4. 清除键的 shadcn `Button` 基类 MTV 没有复刻，只落官方显式传入的那串类。
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import type { BaseNodeData } from '../../types';
import type { Node } from '@xyflow/react';
import { useT } from '../../i18n';
import { getCanvasViewportController } from '../../services/canvasViewportService';
import { selectNodesInCanvas } from '../../services/canvasSelectionService';
import { OfficialIcon } from './OfficialIcon';
import {
  buildSearchDocuments,
  computeNodeSearchResults,
  fieldValue,
  filterDocuments,
  nodeSearchCategory,
  resolveNodeSearchThumbnail,
  type NodeSearchResult,
} from './nodeSearchCore';

/** 官方 `dO="node-search-focus-highlight"` @char1526670 */
const FOCUS_HIGHLIGHT_CLASS = 'node-search-focus-highlight';
/** 官方 `Exe=1100` —— 高亮持续时长 */
const FOCUS_HIGHLIGHT_MS = 1100;
/** 官方 `sk=500` —— 视口动画时长 */
const VIEWPORT_DURATION_MS = 500;
/** 官方 `Nxe=.35` —— 单节点取景 padding */
const VIEWPORT_PADDING = 0.35;
/** 官方 `to=8` —— 滚动保底留白 */
const SCROLL_GAP = 8;

/** `classNames`：官方用 `clsx`+`twMerge`；这里串接即可（本文件没有互相冲突的类） */
function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/**
 * 官方 `Axe` @char1526774 —— 筛选表**逐字**（id / i18n key / 官方 fallback / 图标）。
 * 图标别名 → 实体：`ia`=Tabler search · `or`=图片 · `$s`=视频 · `qs`=文本 ·
 * `Sr`=音频 · `fi`=Tabler box(world) · `fa`=双文件夹(group)。
 * ⚠️ 实测：`world` 项在官方 zh/ja/ko 词典里**都没有词条** ⇒ 各语言一律显示 fallback `World`，
 *    所以 MTV 侧 key 直接用 `World`（无译文 = 原样显示）✓
 * ⚠️ 图片/视频/文本/音频/group 图标官方**不传** `opacity` ⇒ 用图标自带默认透明度（0.2 / 0.6）。
 */
const NODE_SEARCH_FILTERS: ReadonlyArray<{ id: string; labelKey: string; icon: ReactNode }> = [
  { id: 'all', labelKey: '全部', icon: <OfficialIcon name="search" size={14} /> },
  { id: 'image', labelKey: '图片', icon: <OfficialIcon name="node-image" size={14} /> },
  { id: 'video', labelKey: '视频', icon: <OfficialIcon name="node-video" size={14} /> },
  { id: 'text', labelKey: '文本', icon: <OfficialIcon name="node-text" size={14} /> },
  { id: 'audio', labelKey: '音频', icon: <OfficialIcon name="node-audio" size={14} /> },
  { id: 'world', labelKey: 'World', icon: <OfficialIcon name="node-search-world" size={14} /> },
  { id: 'group', labelKey: '分组', icon: <OfficialIcon name="node-search-group" size={14} /> },
];

/** 官方 `ik` @char1530160 —— 只有真正量到尺寸的 rect 才算有效 */
function visibleRect(element: Element): DOMRect | null {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 || rect.top !== 0 || rect.bottom !== 0 ? rect : null;
}

/** 官方 `Vy` @char1530140 —— 把目标滚动量夹到 [0, scrollHeight-clientHeight] */
function clampScroll(container: HTMLElement, next: number): number {
  const max = Math.max(0, container.scrollHeight - container.clientHeight);
  return Math.min(max, Math.max(0, next));
}

/** 官方 `Bxe` @char1530240 —— 键盘移动时把当前项滚进视野（优先真实 rect，退化到 offsetTop） */
function scrollItemIntoView(container: HTMLElement, item: HTMLElement): void {
  const containerRect = visibleRect(container);
  const itemRect = visibleRect(item);
  if (containerRect && itemRect) {
    if (itemRect.top < containerRect.top + SCROLL_GAP) {
      container.scrollTop = clampScroll(
        container,
        container.scrollTop - (containerRect.top + SCROLL_GAP - itemRect.top),
      );
      return;
    }
    if (itemRect.bottom > containerRect.bottom - SCROLL_GAP) {
      container.scrollTop = clampScroll(
        container,
        container.scrollTop + (itemRect.bottom - (containerRect.bottom - SCROLL_GAP)),
      );
    }
    return;
  }
  const top = item.offsetTop;
  const bottom = top + item.offsetHeight;
  const viewTop = container.scrollTop;
  const viewBottom = viewTop + container.clientHeight;
  if (top < viewTop + SCROLL_GAP) {
    container.scrollTop = Math.max(0, top - SCROLL_GAP);
    return;
  }
  if (bottom > viewBottom - SCROLL_GAP) {
    container.scrollTop = clampScroll(container, bottom - container.clientHeight + SCROLL_GAP);
  }
}

/** 官方 `Lxe` @char1528470 —— 无缩略图时的节点类型图标（`opacity:1`，见 CSS 覆盖） */
function NodeSearchTypeGlyph({ node }: { node: Node<BaseNodeData> }) {
  const category = nodeSearchCategory(node.type);
  const name =
    category === 'video'
      ? 'node-video'
      : category === 'text'
        ? 'node-text'
        : category === 'audio'
          ? 'node-audio'
          : category === 'group'
            ? 'node-search-group'
            : category === 'world'
              ? 'node-search-world'
              : 'node-image';
  return <OfficialIcon name={name} size={18} className="node-search-result-glyph" />;
}

/** 官方 `Oxe` @char1528955 —— 结果行左侧 36×36 缩略图 / 视频首帧 / 类型图标 */
function NodeSearchResultThumb({
  node,
  selected,
  title,
}: {
  node: Node<BaseNodeData>;
  selected: boolean;
  title: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const { imageSrc, videoSrc } = resolveNodeSearchThumbnail(node);
  return (
    <span
      className={cx(
        'mt-0.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted text-muted-foreground transition-[background-color,border-color,transform] duration-150',
        selected && 'scale-105 border-accent/70 bg-accent/40',
      )}
    >
      {imageSrc && !imageFailed ? (
        <img
          src={imageSrc}
          alt=""
          className={cx('block h-full w-full object-cover transition-transform duration-150', selected && 'scale-110')}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : videoSrc && !videoFailed ? (
        <video
          src={`${videoSrc}#t=0.1`}
          aria-label={title}
          className={cx('block h-full w-full object-cover transition-transform duration-150', selected && 'scale-110')}
          muted
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <NodeSearchTypeGlyph node={node} />
      )}
    </span>
  );
}

export interface NodeSearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NodeSearchPanel({ open, onOpenChange }: NodeSearchPanelProps) {
  const t = useT();
  /** 官方 `s=Ot(R=>R.nodes)` —— 搜索对象是**画布上已有的节点** */
  const nodes = useAppStore((s) => s.nodes);
  /** 官方 `d` = 输入框 ref */
  const inputRef = useRef<HTMLInputElement>(null);
  /** 官方 `u` = 结果列表 ref */
  const listRef = useRef<HTMLDivElement>(null);
  /** 官方 `f` = 每行 ref（用于滚动保底） */
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  /** 官方 `p` = 高亮清除定时器 */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 官方 `h` = 逐帧回调句柄（`j` 的双 rAF） */
  const rafRefs = useRef<number[]>([]);
  /** 官方 `m` = 「刚用键盘移动过」标记 ⇒ 才做滚动保底 */
  const keyboardMovedRef = useRef(false);
  /** 官方 `[g,y]` = 查询词 */
  const [query, setQuery] = useState('');
  /** 官方 `[x,b]` = 键盘高亮下标 */
  const [activeIndex, setActiveIndex] = useState(0);
  /** 官方 `[w,_]` = 当前筛选 id */
  const [filterId, setFilterId] = useState('all');
  /* 官方 Radix Dialog 会自动把 Title / Description 与 `aria-labelledby` / `aria-describedby` 关联，
     portal 版这里自己接上（无障碍语义与官方一致） */
  const titleId = useId();
  const descriptionId = useId();

  /* 官方 `v=uxe(s)` / `S=Mxe(v,w)` / `C=g.trim()?Sxe(S,g,nk):vxe(S,nk)` */
  const documents = useMemo(() => buildSearchDocuments(nodes), [nodes]);
  const filtered = useMemo(() => filterDocuments(documents, filterId), [documents, filterId]);
  const results = useMemo(() => computeNodeSearchResults(filtered, query), [filtered, query]);
  /**
   * 官方 `E=C[x]`。官方另有一条 `useEffect(()=>{x>=C.length&&b(Math.max(0,C.length-1))},[C.length,x])`
   * 在结果数变少时把下标夹回来；MTV 改为**渲染期派生**同一个夹取结果
   * （等价、且不触发 react-hooks 的 set-state-in-effect 规则）。
   */
  const activeIndexClamped = results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1);
  const activeResult = results[activeIndexClamped];

  /* 官方：打开后下一帧聚焦输入框 */
  useEffect(() => {
    if (!open) return undefined;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  /* 官方：行 ref 数组随结果数收缩 */
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, results.length);
  }, [results.length]);

  /* 官方 `N=useCallback(R=>{…Bxe(O,G)},[])` */
  const ensureItemVisible = useCallback((index: number) => {
    const container = listRef.current;
    const item = itemRefs.current[index];
    if (!container || !item) return;
    scrollItemIntoView(container, item);
  }, []);

  /* 官方 `useLayoutEffect(()=>{!e||!m.current||(m.current=!1,N(x))},[e,N,x])` */
  useLayoutEffect(() => {
    if (!open || !keyboardMovedRef.current) return;
    keyboardMovedRef.current = false;
    ensureItemVisible(activeIndexClamped);
  }, [open, ensureItemVisible, activeIndexClamped]);

  /* 官方 `I` = 取消所有 rAF；卸载时清定时器 + rAF */
  const cancelFrames = useCallback(() => {
    for (const handle of rafRefs.current) cancelAnimationFrame(handle);
    rafRefs.current = [];
  }, []);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelFrames();
    },
    [cancelFrames],
  );

  /**
   * 官方 `T=R=>fitBounds({nodes:[{id:R}],duration:sk,padding:Nxe})`。
   * ⚠️ MTV 偏离：官方 `k` 还会把「节点矩形 ∪ 生成输入条矩形」一起取景（并集），
   *    MTV 的生成输入条是独立的浮层（`.ai-dialog-float`，没有官方那个 testid
   *    `canvas-node-generation-input-bar`）
   *    ⇒ 这里只做官方 `k` 的两条兜底分支都落到的那件事：单节点 `fitBounds`。
   */
  const focusNodeInViewport = useCallback((nodeId: string) => {
    void getCanvasViewportController()?.fitView({
      nodeIds: [nodeId],
      duration: VIEWPORT_DURATION_MS,
      padding: VIEWPORT_PADDING,
    });
  }, []);

  /**
   * 官方 `j=R=>{I();双 rAF → k(R)}` + `A=R=>{…setNodes(选中+加类);j(R);setTimeout(移除类,Exe)}`。
   * ⚠️ MTV 偏离：官方改的是 store 里 node 的 `selected`/`className`；
   *    MTV 用**画布选区 API**（`selectNodesInCanvas`）+ **节点 DOM 上的临时类**，
   *    不动 store 节点对象（避免与 React Flow 的受控节点同步打架）。视觉/时长与官方一致。
   */
  const highlightNode = useCallback(
    (nodeId: string) => {
      cancelFrames();
      if (timerRef.current) clearTimeout(timerRef.current);
      selectNodesInCanvas([nodeId]);
      const element = document.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${CSS.escape(nodeId)}"]`,
      );
      element?.classList.add(FOCUS_HIGHLIGHT_CLASS);
      const first = requestAnimationFrame(() => {
        const second = requestAnimationFrame(() => {
          rafRefs.current = [];
          focusNodeInViewport(nodeId);
        });
        rafRefs.current = [second];
      });
      rafRefs.current = [first];
      timerRef.current = setTimeout(() => {
        document
          .querySelectorAll<HTMLElement>(`.react-flow__node.${FOCUS_HIGHLIGHT_CLASS}`)
          .forEach((node) => node.classList.remove(FOCUS_HIGHLIGHT_CLASS));
      }, FOCUS_HIGHLIGHT_MS);
    },
    [cancelFrames, focusNodeInViewport],
  );

  /**
   * 官方 `useEffect(()=>{e||(y(""),b(0),_("all"))},[e])` —— 面板关闭后复位查询/下标/筛选。
   * MTV 改为在**每一条关闭路径**上复位（Esc / 点遮罩 / 选中一行）——等价，且避开
   * `react-hooks/set-state-in-effect`（面板的关闭全部由组件自己发起）。
   */
  const requestClose = useCallback(() => {
    setQuery('');
    setActiveIndex(0);
    setFilterId('all');
    onOpenChange(false);
  }, [onOpenChange]);

  /* 官方 `D=R=>{R&&(t(!1),A(R.document.node.id))}` —— 选中一行：先关面板，再高亮 */
  const selectResult = useCallback(
    (result: NodeSearchResult | undefined) => {
      if (!result) return;
      requestClose();
      highlightNode(result.document.node.id);
    },
    [highlightNode, requestClose],
  );

  /**
   * 官方 `M` @char1533000 —— 键盘处理。
   * ⚠️⚠️ **实测 vs 源码（以实测为准）**：
   *   源码 `M` 的 Escape 分支是「有 query ⇒ `preventDefault` + 清空 + 复位下标 + **return 不关**；
   *   无 query 才 `preventDefault` + 关」。但父级 CDP 9444 实测：**有输入时按第一次 Esc 面板就已关闭**
   *   （`stillOpen:false, dlg:false`）⇒ 这里按**实测**实现：Escape 一律 `preventDefault` + 关闭。
   *   （源码那套「先清空再关」在实测里观察不到；保留此注释以免后人「按源码改回去」。）
   */
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (results.length === 0) return;
        setActiveIndex((index) => {
          const base = Math.min(index, results.length - 1);
          const next = Math.min(base + 1, results.length - 1);
          keyboardMovedRef.current = next !== base;
          return next;
        });
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (results.length === 0) return;
        setActiveIndex((index) => {
          const base = Math.min(index, results.length - 1);
          const next = Math.max(base - 1, 0);
          keyboardMovedRef.current = next !== base;
          if (next === base && next === 0 && listRef.current) listRef.current.scrollTop = 0;
          return next;
        });
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        selectResult(activeResult);
      }
    },
    [activeResult, requestClose, results.length, selectResult],
  );

  /* 官方 `L=R=>{m.current=!1,y(R),b(0),u.current&&(u.current.scrollTop=0)}` */
  const handleQueryChange = useCallback((value: string) => {
    keyboardMovedRef.current = false;
    setQuery(value);
    setActiveIndex(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, []);

  /* 官方 `P=R=>{m.current=!1,_(R),b(0),u.current&&(u.current.scrollTop=0)}` */
  const handleFilterChange = useCallback((id: string) => {
    keyboardMovedRef.current = false;
    setFilterId(id);
    setActiveIndex(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, []);

  if (!open) return null;

  return createPortal(
    <>
      {/* 官方遮罩 `I8a`（`fixed inset-0 z-50 bg-black/80` + `overlayClassName:"bg-background/30"`，twMerge 后取后者） */}
      <div
        className="fixed inset-0 z-50 bg-background/30"
        data-testid="common-dialog-container"
        onClick={requestClose}
      />
      {/* 官方 `cr`（DialogContent, `showClose={false}`）+ 面板类名，逐字 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-testid="common-dialog-content"
        tabIndex={-1}
        className="node-search-dialog fixed left-[50%] top-[50%] z-50 min-w-[300px] max-w-none translate-x-[-50%] translate-y-[-50%] flex max-h-[min(520px,calc(100vh-72px))] w-[min(640px,calc(100vw-28px))] flex-col overflow-hidden rounded-2xl border border-border bg-popover/90 p-0 text-popover-foreground shadow-2xl backdrop-blur-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* 官方 `Or`(=DialogTitle) / `B0`(=DialogDescription) 的 sr-only 标题与说明 */}
        <h2 id={titleId} className="text-lg font-semibold leading-none tracking-tight sr-only">{t('节点搜索')}</h2>
        <p id={descriptionId} className="text-sm text-muted-foreground sr-only">{t('按标题、Prompt 或文本搜索画布节点。')}</p>

        {/* 头部：搜索图标 18 + 输入框 + 清除键 */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <OfficialIcon name="search" size={18} className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder={t('搜索节点...')}
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            /* ⚠️ MTV 偏离：官方 `Lt`(shadcn Button, ghost/icon) 的**基类** MTV 未复刻，
               只落官方显式传入的这串类（实测：ghost · `size-8 rounded-lg` · 图标 16） */
            <button
              type="button"
              className="size-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleQueryChange('')}
              aria-label={t('清除')}
            >
              <OfficialIcon name="x" size={16} />
            </button>
          ) : null}
        </div>

        {/* 筛选条：官方 `Axe` 7 项，1:1 */}
        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
          {NODE_SEARCH_FILTERS.map((filter) => {
            const active = filterId === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                className={cx(
                  'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground',
                )}
                aria-pressed={active}
                onClick={() => handleFilterChange(filter.id)}
              >
                {filter.icon}
                <span>{t(filter.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* 结果区：空态 / 列表 */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {results.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-8 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {query ? t('未找到匹配节点') : t('暂无可搜索节点')}
              </p>
            </div>
          ) : (
            <div
              ref={listRef}
              className="max-h-[min(404px,calc(100vh-188px))] overflow-y-auto overscroll-contain p-2"
              data-testid="node-search-results-list"
            >
              {results.map((result, index) => {
                const isGroup = result.document.node.type === 'group';
                const active = index === activeIndexClamped;
                return (
                  <button
                    key={`${result.document.node.id}:${result.field}`}
                    ref={(element) => {
                      itemRefs.current[index] = element;
                    }}
                    type="button"
                    className={cx(
                      'group flex w-full min-w-0 items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                    )}
                    onClick={() => {
                      setActiveIndex(index);
                      selectResult(result);
                    }}
                    onMouseMove={() => {
                      keyboardMovedRef.current = false;
                      setActiveIndex(index);
                    }}
                  >
                    <NodeSearchResultThumb
                      node={result.document.node}
                      selected={active}
                      title={result.document.title}
                    />
                    {/* ★ 官方 `Oxe` 的文本列**就是** `min-w-0 flex-1`（单一 class，没有 `flex`）。
                        ⚠️ 之前这里多加了 `flex min-h-9 items-center` ⇒ 两个 `block` 子 span 变成 flex 项
                        **横排** ⇒ 标题与「无 Prompt」挤在同一行（用户实测截图指出）；
                        同时把行高从官方的 60px 压成 58px。已按官方去掉。 */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {result.document.title}
                      </span>
                      {!isGroup ? (
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {fieldValue(result.document, 'prompt') || t('无 Prompt')}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
