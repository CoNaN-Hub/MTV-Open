/**
 * referenceHoverCard — 官方参考/提及芯片的**悬浮预览卡**（`eme` @364745 / `Wy` @362996 / `h6` 延时）
 *
 * 官方行为（逐字）：
 *   · 触发：`PopoverTrigger` 的 `onMouseEnter` → **300ms** 后开；`onMouseLeave` → **150ms** 后关（`h6`）
 *   · 位置：`PopoverContent side="top" align="center" sideOffset={6}`（芯片上方、水平居中、间距 6）
 *   · 卡片：`h-[100px] rounded-[12px] overflow-hidden shadow-[0px_8px_24px_rgba(0,0,0,0.5)] bg-black`
 *       图片 `block h-[100px] w-auto object-cover` · 视频 `h-[100px] aspect-video`
 *       文本 `w-[100px] h-[100px] bg-[#1a1a1a] px-3 pt-3 pb-9` + `line-clamp-4 text-[12px] leading-[16px] text-white/70`
 *       音频 `w-[100px] h-[100px] bg-[#1a1a1a] p-3`
 *   · 底部条：`absolute inset-x-0 bottom-0 h-[40px] bg-gradient-to-t from-black/60 to-transparent
 *              flex items-end justify-center pb-[6px] px-2` + `text-[12px] font-medium leading-[20px]
 *              text-white/[0.88] truncate`，内容 = `@{标题}`
 *   · 夹取：官方 tippy `preventOverflow(padding: 8)`
 *
 * 这个 hook 把上面这套封装成「一份实现，两处复用」：
 *   ① `UpstreamReferenceChips` 顶行的参考图芯片
 *   ② `MentionEditor` 里插进提示词的提及芯片（官方 `tme` 外层同样包了 `eme`）
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ReferenceHoverKind = 'image' | 'video' | 'audio' | 'text';

export interface ReferenceHoverData {
  title: string;
  kind: ReferenceHoverKind;
  url?: string;
  text?: string;
  /* ★ 底部 `@{标题}` 渐变条按**挂载点**分两套（官方两套预览卡，别混）：

       · `'text-only'` = 官方 `Zj`（`zoom-slider` @370174）——**输入框里的提及芯片**用这套
           （`tme` @366345 的 Popover 里 `children: G && <Zj …/>`）：
             video → `Qfe` · audio → `Jfe`（波形）· text → `f6` + `@label` 条 ·
             **默认（图片/附件）→ `p6`：只有 `<img h-[100px] w-auto>`，没有文案条** ✔
       · `'always'`  = 官方 `eme`（@366745）——**顶行参考图芯片**用这套
           （`r0` @1699083 末尾 `return p ? x : <eme url mediaType title textContent>{x}</eme>`）：
             那张卡 `g` 里**每条分支后面都跟着**同一条 40px 渐变条（`["@",n]`）✔ */
  captionMode?: 'text-only' | 'always';
}

interface HoverState extends ReferenceHoverData {
  /** 锚点：芯片中线 x（`align="center"`） */
  centerX: number;
  top: number;
}

/** 官方 `h6` 的延时 */
const OPEN_DELAY = 300;
const CLOSE_DELAY = 150;
/** 官方 `sideOffset={6}` */
const SIDE_OFFSET = 6;
/** 官方卡片固定高度 `h-[100px]` */
const CARD_HEIGHT = 100;

/* ★ 同一时刻**只能有一张悬浮预览卡**（官方 tippy 也只允许一个 popper 可见 ✓）
   —— MTV 每个芯片各持一份 hook 状态，芯片被移除/编辑器重挂时那张卡会**留在 DOM 里** ✗
   （实测：电池回归里上一支用例的图片卡残留，导致后续读卡读到旧卡 ✓）
   这里用一个模块级注册表：新卡开的时候把其它实例的卡关掉 ✓ */
const hoverCardClosers = new Set<() => void>();

export function useReferenceHoverCard() {
  const [state, setState] = useState<HoverState | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const closeNow = useCallback(() => setState(null), []);
  useEffect(() => {
    hoverCardClosers.add(closeNow);
    return () => { hoverCardClosers.delete(closeNow); };
  }, [closeNow]);

  const clearOpen = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
  }, []);
  const clearClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  useEffect(() => () => { clearOpen(); clearClose(); }, [clearOpen, clearClose]);

  const openFor = useCallback((element: HTMLElement, data: ReferenceHoverData) => {
    clearClose();
    clearOpen();
    openTimer.current = setTimeout(() => {
      /* 芯片已从 DOM 摘掉（编辑器重挂 / 芯片被删）⇒ 不开卡，避免留下孤儿卡 ✓ */
      if (!element.isConnected) return;
      hoverCardClosers.forEach((close) => { if (close !== closeNow) close(); });
      const rect = element.getBoundingClientRect();
      setState({
        ...data,
        centerX: rect.left + rect.width / 2,
        top: Math.max(8, rect.top - CARD_HEIGHT - SIDE_OFFSET),
      });
    }, OPEN_DELAY);
  }, [clearClose, clearOpen, closeNow]);

  const scheduleClose = useCallback(() => {
    clearOpen();
    clearClose();
    closeTimer.current = setTimeout(() => setState(null), CLOSE_DELAY);
  }, [clearClose, clearOpen]);

  /* 官方 `preventOverflow(padding: 8)`：按实测宽度把卡片夹回视口内 */
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !state) return;
    const width = el.offsetWidth || 100;
    const center = Math.min(
      Math.max(state.centerX, 8 + width / 2),
      window.innerWidth - 8 - width / 2,
    );
    el.style.left = `${Math.round(center)}px`;
  }, [state]);

  const card = state
    ? createPortal(
      <div
        ref={cardRef}
        className={`ref-hover-card${state.kind === 'audio' || state.kind === 'text' ? ' ref-hover-card--square' : ''}`}
        style={{ left: state.centerX, top: state.top, transform: 'translateX(-50%)' }}
        onMouseEnter={clearClose}
        onMouseLeave={scheduleClose}
      >
        {state.kind === 'video' && state.url ? (
          <video className="ref-hover-media-video" src={state.url} autoPlay muted loop playsInline />
        ) : state.kind === 'image' && state.url ? (
          <img className="ref-hover-media-img" src={state.url} alt={state.title} draggable={false} />
        ) : state.kind === 'text' ? (
          <div className="ref-hover-text">
            <div className="ref-hover-text-inner">{state.text || state.title}</div>
          </div>
        ) : (
          <div className="ref-hover-audio">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
        {/* 底部 `@{标题}` 渐变条：按 `captionMode` 分两套（见 `ReferenceHoverData` 的注释）
             · `Zj`（输入框芯片，`tme`）= **只有 `type === 'text'` 那一支带条**
               （官方 `Zj` @370174 逐字：video→`Qfe`、audio→`Jfe`、默认→`p6` 都**没有**文案条）
             · `eme`（顶行参考图芯片，`r0`）= **每条分支后面都跟一条**同款 40px 渐变条 */}
        {((state.captionMode ?? 'text-only') === 'always' || state.kind === 'text') && (
          <div className="ref-hover-caption"><span>@{state.title}</span></div>
        )}
      </div>,
      document.body,
    )
    : null;

  return { card, openFor, scheduleClose, clearClose } satisfies {
    card: ReactNode; openFor: (el: HTMLElement, data: ReferenceHoverData) => void; scheduleClose: () => void; clearClose: () => void;
  };
}
