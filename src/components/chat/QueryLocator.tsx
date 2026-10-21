/**
 * QueryLocator —— 官方 `Lit`（`vendor-pkg-canvas-ChpWx5JY.js` @2620253，聊天消息列表右缘的
 * `query-locator-v2` 导航轨 + 悬浮预览卡）逐字复刻。
 *
 * 官方原文（逐字，见 `services/chat/queryLocator.ts` 的符号对照）：
 * ```js
 * Lit = ({anchors:e, contentRef:t, scrollRootRef:n}) => {
 *   …
 *   const m = () => { const v=t.current, w=o.current, C=w?.isConnected?w:BI(n.current);
 *     o.current=C; if(!v||!C){l(N=>rG(N,MC)?N:MC);return}
 *     const S = Pit({anchors:Dit(v,e), clientHeight:C.clientHeight, scrollHeight:C.scrollHeight, scrollTop:C.scrollTop});
 *     l(N=>rG(N,S)?N:S) };
 *   // scroll(rAF 合并) + resize + ResizeObserver(滚动根 & 内容) 触发 m()
 *   // 点击/hover：h = (clientY, hitArea) => 取 topPx 最近且 ≤ Rit(8px) 的 tick
 *   if(!i.visible) return null;
 *   <nav aria-label="Conversation query locator" data-testid="query-locator-v2"
 *        className="pointer-events-none absolute top-1/2 right-0 left-0 z-20 -translate-y-1/2 transition-opacity duration-200"
 *        style={{height:`${i.trackHeightPx}px`}}>
 *     <div className="pointer-events-auto absolute inset-y-0 right-4 w-11" data-testid="query-locator-hit-area-v2"
 *          onClick={x} onMouseLeave={()=>d(null)} onMouseMove={g}>
 *       <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="query-locator-track-v2"
 *            style={fadeEdges ? {maskImage:'linear-gradient(to bottom, transparent 0, black 22px, black calc(100% - 22px), transparent 100%)'} : undefined}>
 *         {ticks.map(...)}   // 每条 = <button> w-2.5→w-8（按 hover 距离）/ h-4 / rounded-l-full
 *                            //        内含 <span class="h-px w-full rounded-l-full bg-chat-foreground/24">
 *       </div>
 *     </div>
 *     {hovered && <div className="pointer-events-none absolute right-[60px] z-30 w-[min(320px,calc(100%-76px))] …"
 *                       data-testid="query-locator-preview-card" style={{top:`${clamp(hovered.topPx,44,trackHeight-44)}px`}}>
 *       <div className="truncate text-[13px] font-semibold leading-5 text-chat-foreground"><hv text={previewTitle ?? label}/></div>
 *       {previewText && <div className={PREVIEW_TEXT_CLASS}><hv text={previewText}/></div>}
 *     </div>}
 *   </nav> }
 * ```
 * ⚠️ 官方预览卡里的 `hv` 是**行内引用渲染器**（把 `{{skill:…}}` 之类的提及渲染成芯片）——
 *    用户实测截图第一行的 `visual-art-dire…` 技能芯片就来自这里 ⇒ MTV 用既有 `ChatReferenceText compact`。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatReferenceText from './ChatReferenceText';
import {
  HOVER_TOLERANCE_PX,
  attachAnchorOffsets,
  computeQueryLocatorState,
  EMPTY_QUERY_LOCATOR_STATE,
  findScrollRoot,
  isSameQueryLocatorState,
  type QueryAnchor,
  type QueryLocatorState,
} from '../../services/chat/queryLocator';

/** 内容区元素的 `offsetTop` 与滚动根之间的换算：官方直接用 `offsetTop`（两侧结构一致）。 */
export interface QueryLocatorProps {
  anchors: readonly QueryAnchor[];
  /** 官方 `contentRef`：承载 `[data-query-locator-anchor-id]` 行的内容元素。 */
  contentRef: React.RefObject<HTMLElement | null>;
  /** 官方 `scrollRootRef`：滚动根（`BI` 会再挑第一个真正可滚的元素）。 */
  scrollRootRef: React.RefObject<HTMLElement | null>;
}

/* 官方每条 tick 的**状态类**（用 `z()` = clsx + **twMerge** 与基础类合并 ⇒ 冲突项只留状态那一个）。
   ⚠️ MTV 没有 `tailwind-merge` ⇒ 这里**不能**把基础类（`h-px` / `bg-chat-foreground/24`）与状态类
   同时挂在元素上：编译后的 CSS 里 `.h-[2px]`(29053) 在 `.h-px`(30361) **之前**、`.opacity-100`(102975)
   在 `.opacity-60`(103115) **之前** ⇒ 基础类会赢，悬浮/当前项永远停在 1px / 60% 透明
   （用户实测：「侧边的也没出来」）。⇒ 高度与底色**每个状态只给一个**，等价于官方 twMerge 的结果。

   ⚠️⚠️ 第 60 轮（用户实测「悬浮提示没有了 / 右侧那些线看不见」）**真因**：
   `bg-chat-foreground/24|40|56|85` 这些**带透明度的类在 dev 构建里根本没生成**
   （CDP 现场：`document.styleSheets` 里只有 `.bg-chat-foreground` 一条；prod 产物里有，
    但 dev 页面（`localhost:5180`，桌面端加载的就是它）里没有 ⇒ computed = `rgba(0,0,0,0)`
    ⇒ 整条导航轨的线**全透明**，看起来「没有」）。
   修法：改成**显式 rgba**（`#d4d4d8` = `--chat-foreground`，与官方实测的
   `oklab(0.871…)` 同一色），不再依赖 opacity modifier / `color-mix`。 */
const TICK_LABEL_CLASS: Record<number, string> = {
  0: 'w-8 opacity-100',
  1: 'w-6 opacity-90',
  2: 'w-4 opacity-80',
};

/** 每条 tick 的线：`[高度, 底色]` —— 两个属性各只有一个值（无冲突）。 */
const LINE_2PX_85 = 'h-[2px] bg-[rgba(212,212,216,0.85)]';
const LINE_1PX_56 = 'h-px bg-[rgba(212,212,216,0.56)]';
const LINE_1PX_40 = 'h-px bg-[rgba(212,212,216,0.40)]';
const LINE_1PX_24 = 'h-px bg-[rgba(212,212,216,0.24)]';
/** 当前阅读位置（未悬浮）—— 官方 `h-[2px] bg-chat-foreground/56`。 */
const LINE_2PX_56 = 'h-[2px] bg-[rgba(212,212,216,0.56)]';
const TICK_LINE_CLASS: Record<number, string> = {
  0: LINE_2PX_85,
  1: LINE_1PX_56,
  2: LINE_1PX_40,
};
/** 预览卡副标题（官方 `text-chat-foreground/45`；同样在 dev 里没生成 ⇒ 显式 rgba）。 */
const PREVIEW_TEXT_CLASS = 'mt-0.5 line-clamp-2 text-[12px] leading-5 text-[rgba(212,212,216,0.45)]';

export default function QueryLocator({ anchors, contentRef, scrollRootRef }: QueryLocatorProps) {
  const scrollElRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [state, setState] = useState<QueryLocatorState>(EMPTY_QUERY_LOCATOR_STATE);
  /** 官方 `u = anchors.map(a=>a.id).join('\n')`：锚点集合变化时清掉悬浮。
   *  ⚠️ 官方是 `useEffect(() => d(null), [u])`（在 effect 里 setState）；React 19 的
   *  `react-hooks/set-state-in-effect` 不允许，这里改成**把锚点键一起存进悬浮状态**：
   *  键不匹配时渲染期即为 `null` —— 与官方「锚点集合变了就清空」等价，且不产生级联渲染。 */
  const anchorKey = useMemo(() => anchors.map((anchor) => anchor.id).join('\n'), [anchors]);
  const [hover, setHover] = useState<{ key: string; id: string } | null>(null);
  const setHoveredId = useCallback((id: string | null) => {
    setHover(id === null ? null : { key: anchorKey, id });
  }, [anchorKey]);
  const hoveredId = hover && hover.key === anchorKey ? hover.id : null;

  const hovered = useMemo(
    () => state.ticks.find((tick) => tick.id === hoveredId) ?? null,
    [state.ticks, hoveredId],
  );

  const measure = useCallback(() => {
    const content = contentRef.current;
    const scrollRoot = scrollElRef.current?.isConnected
      ? scrollElRef.current
      : findScrollRoot(scrollRootRef.current);
    scrollElRef.current = scrollRoot;
    if (!content || !scrollRoot) {
      setState((previous) => (isSameQueryLocatorState(previous, EMPTY_QUERY_LOCATOR_STATE) ? previous : EMPTY_QUERY_LOCATOR_STATE));
      return;
    }
    const next = computeQueryLocatorState({
      anchors: attachAnchorOffsets(content, anchors),
      clientHeight: scrollRoot.clientHeight,
      scrollHeight: scrollRoot.scrollHeight,
      scrollTop: scrollRoot.scrollTop,
    });
    setState((previous) => (isSameQueryLocatorState(previous, next) ? previous : next));
  }, [anchors, contentRef, scrollRootRef]);

  useEffect(() => {
    const content = contentRef.current;
    const scrollRoot = findScrollRoot(scrollRootRef.current);
    if (!content || !scrollRoot) return undefined;
    scrollElRef.current = scrollRoot;
    const schedule = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        measure();
      });
    };
    measure();
    scrollRoot.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule);
      observer.observe(scrollRoot);
      observer.observe(content);
    }
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      scrollRoot.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
    };
  }, [anchorKey, contentRef, scrollRootRef, measure]);

  const scrollTo = useCallback((top: number) => {
    const scrollRoot = scrollElRef.current ?? findScrollRoot(scrollRootRef.current);
    scrollRoot?.scrollTo({ behavior: 'smooth', top });
  }, [scrollRootRef]);

  /** 官方 `h`：命中 `topPx` 最近且垂直距离 ≤ `Rit`(8px) 的 tick。 */
  const hitTest = useCallback((clientY: number, hitArea: HTMLElement) => {
    if (state.ticks.length === 0) return null;
    const offset = clientY - hitArea.getBoundingClientRect().top;
    const nearest = state.ticks.reduce((best, tick) => (
      Math.abs(tick.topPx - offset) < Math.abs(best.topPx - offset) ? tick : best
    ));
    return Math.abs(nearest.topPx - offset) <= HOVER_TOLERANCE_PX ? nearest : null;
  }, [state.ticks]);

  if (!state.visible) return null;

  const maskStyle = state.fadeEdges
    ? {
      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 22px, black calc(100% - 22px), transparent 100%)',
      maskImage: 'linear-gradient(to bottom, transparent 0, black 22px, black calc(100% - 22px), transparent 100%)',
    }
    : undefined;
  const cardTop = hovered ? Math.min(Math.max(hovered.topPx, 44), state.trackHeightPx - 44) : 0;
  const hoveredIndex = hovered ? state.ticks.findIndex((tick) => tick.id === hovered.id) : -1;

  return (
    <nav
      aria-label="Conversation query locator"
      data-testid="query-locator-v2"
      className="pointer-events-none absolute top-1/2 right-0 left-0 z-20 -translate-y-1/2 transition-opacity duration-200"
      style={{ height: `${state.trackHeightPx}px` }}
    >
      <div
        data-testid="query-locator-hit-area-v2"
        className="pointer-events-auto absolute inset-y-0 right-4 w-11"
        onClick={(event) => {
          const hit = hitTest(event.clientY, event.currentTarget);
          if (hit) scrollTo(hit.targetTop);
        }}
        onMouseLeave={() => setHoveredId(null)}
        onMouseMove={(event) => {
          const hit = hitTest(event.clientY, event.currentTarget);
          setHoveredId(hit?.id ?? null);
        }}
      >
        <div
          data-testid="query-locator-track-v2"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={maskStyle}
        >
          {state.ticks.map((tick, index) => {
            const distance = hoveredIndex >= 0 ? Math.abs(index - hoveredIndex) : null;
            const isHovered = distance === 0;
            const near = distance === 1;
            const far = distance === 2;
            const activeIdle = hoveredIndex < 0 && tick.active;
            const widthClass = isHovered
              ? TICK_LABEL_CLASS[0]
              : far
                ? TICK_LABEL_CLASS[2]
                : near
                  ? TICK_LABEL_CLASS[1]
                  : activeIdle
                    ? 'w-4 opacity-100'
                    : 'w-2.5 opacity-60';
            const lineClass = isHovered
              ? TICK_LINE_CLASS[0]
              : far
                ? TICK_LINE_CLASS[2]
                : near
                  ? TICK_LINE_CLASS[1]
                  : activeIdle
                    ? LINE_2PX_56
                    : LINE_1PX_24;
            return (
              <button
                key={tick.id}
                type="button"
                aria-current={tick.active ? 'location' : undefined}
                aria-label={`Jump to ${tick.label}`}
                className={`group pointer-events-auto absolute right-0 h-4 -translate-y-1/2 cursor-pointer rounded-l-full transition-[top,width,opacity,transform] duration-150 ease-out motion-reduce:transition-none focus-visible:w-6 focus-visible:opacity-100 focus-visible:outline-none ${widthClass}`}
                style={{ top: `${tick.topPx}px` }}
                onBlur={() => setHoveredId(null)}
                onFocus={() => setHoveredId(tick.id)}
                onMouseEnter={() => setHoveredId(tick.id)}
                onClick={(event) => {
                  event.stopPropagation();
                  scrollTo(tick.targetTop);
                }}
              >
                <span
                  className={`pointer-events-none absolute top-1/2 right-0 w-full -translate-y-1/2 rounded-l-full transition-colors duration-200 ease-out group-focus-visible:h-[2px] group-focus-visible:bg-[rgba(212,212,216,0.85)] ${lineClass}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {hovered && (
        <div
          data-testid="query-locator-preview-card"
          className="pointer-events-none absolute right-[60px] z-30 w-[min(320px,calc(100%-76px))] -translate-y-1/2 rounded-[14px] border border-white/[0.08] bg-[#2d2d2f]/94 px-3 py-2.5 text-left shadow-[0_14px_30px_rgba(0,0,0,0.34)] backdrop-blur-xl"
          style={{ top: `${cardTop}px` }}
        >
          <div className="truncate text-[13px] font-semibold leading-5 text-chat-foreground">
            {/* 官方 `<hv text={previewTitle ?? label}/>`：行内提及渲染（技能/节点引用会出芯片）。 */}
            <ChatReferenceText value={hovered.previewTitle ?? hovered.label} compact />
          </div>
          {hovered.previewText && (
            <div className={PREVIEW_TEXT_CLASS}>
              <ChatReferenceText value={hovered.previewText} compact />
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
