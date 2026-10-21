/**
 * useMediaViewerImageNavigation —— 官方图片检视层导航 hook `yve` @484668 的逐字移植
 *
 * 官方签名：`yve({active, inspecting, sourceId, previewRect, inspectRect, onRequestInspect, onRequestPreview, onInteraction})`
 * 官方返回：`{frameRef, imageStyle, isDragging, isZoomed, isReturning, zoomToContain, returnToPreview,
 *            resetToPreview, handleTransitionEnd, handlePointerDown, handlePointerMove, handlePointerEnd,
 *            handleAuxClick, consumeClickAfterDrag}`
 *
 * 官方行为（逐条与源码对齐）：
 *   · 预览态滚轮：**只有 `ctrl + 向上滚`**（`ctrlKey && delta < 0`）才 `onRequestInspect()` 并放大
 *     —— `if(!t){ if(!W.ctrlKey || (preventDefault, stopPropagation, Q>=0)) return; … o(); a?.(); _(Y2(ne,te,…)) }`
 *   · 检视态滚轮：`kind = ctrlKey ? "trackpad-pinch" : "mouse-wheel"`；`ee = q2(zoom, delta, kind, minZoom)`；
 *     `ee === minZoom` ⇒ 延时 `uve=180ms` 后 `onRequestPreview()`（**缩到底自动回预览**）
 *   · 检视态拖动：`eC(view)`（已放大）才允许；`button 0 | 1`；超过 `hve=4px` 记 `moved`；
 *     拖动结束若 `moved` 则记 `f = performance.now()`（`consumeClickAfterDrag` 用它吞掉随后的 click）
 *   · `transition` 三态：`null`（无过渡）/ `to-contain`（点图放大）/ `to-preview`（退回预览）
 *   · 显示的 view：`B = (basis && !inspecting && transition===null) ? jf(basis) : view`
 *
 * ⚠️ MTV 偏离（已在文件内逐条标注）：
 *   1. 官方 `Xye` 的入口/出口**锚点形变**（`sourceAnchor` / `closeTargetAnchor`）MTV 没有，保留原有的淡入淡出；
 *      本 hook 只负责**图片在画框内的几何**。
 *   2. 官方 `previewRect`/`inspectRect` 由 `nve` 量出（含滚动偏移）；MTV 用 `getBoundingClientRect` 直接量，
 *      两者都在视口坐标下 ⇒ `ave()` 的相对关系一致。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useReducedMotion } from 'framer-motion';

import {
  MEDIA_VIEWER_CLICK_AFTER_DRAG_MS,
  MEDIA_VIEWER_DEFAULT_VIEW,
  MEDIA_VIEWER_DRAG_THRESHOLD_PX,
  MEDIA_VIEWER_ZOOM_OUT_RETURN_MS,
  clampView,
  containView,
  fitView,
  imageNavigationBasis,
  imageTransform,
  imageTransformTransition,
  isViewZoomed,
  translateView,
  wheelDelta,
  zoomAt,
  zoomStep,
  type NavBasis,
  type NavRect,
  type NavView,
} from '../../../../utils/mediaViewerImageNavigation';

export interface UseMediaViewerImageNavigationOptions {
  /** 官方 `active`：查看器是否已经可以交互（`u8` 传 `phase === "open"`） */
  active: boolean;
  /** 官方 `inspecting`：是否处于检视(放大)态 */
  inspecting: boolean;
  /** 官方 `sourceId`：换图时复位视图 */
  sourceId: string | null;
  /** 官方 `previewRect`（视口坐标，= contain 贴合后的图片矩形） */
  previewRect: NavRect | null;
  /** 官方 `inspectRect`（视口坐标，= 视口内缩 24px 后再 contain 贴合） */
  inspectRect: NavRect | null;
  /** 官方 `onRequestInspect`（`ctrl+滚轮向上` 会触发） */
  onRequestInspect?: () => void;
  /** 官方 `onRequestPreview`（缩到底 180ms 后触发） */
  onRequestPreview?: () => void;
  /** 官方 `onInteraction`（滚动/拖动时触发，用于重置 chrome 自动隐藏计时） */
  onInteraction?: () => void;
}

export interface MediaViewerImageNavigation {
  frameRef: React.RefObject<HTMLDivElement | null>;
  /** 官方 `imageStyle`：给内层 `div.relative.size-full.overflow-hidden` 的 `style` */
  imageStyle: React.CSSProperties;
  isDragging: boolean;
  isZoomed: boolean;
  isReturning: boolean;
  zoomToContain: () => void;
  returnToPreview: () => void;
  resetToPreview: () => void;
  handleTransitionEnd: (event: React.TransitionEvent<HTMLDivElement>) => void;
  handlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleAuxClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** 官方 `z()`：拖动刚结束时返回 `true`，表示这次 click 要吞掉 */
  consumeClickAfterDrag: () => boolean;
}

export function useMediaViewerImageNavigation({
  active,
  inspecting,
  sourceId,
  previewRect,
  inspectRect,
  onRequestInspect,
  onRequestPreview,
  onInteraction,
}: UseMediaViewerImageNavigationOptions): MediaViewerImageNavigation {
  const reducedMotion = useReducedMotion() ?? false;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<NavView>(MEDIA_VIEWER_DEFAULT_VIEW);
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; view: NavView; moved: boolean } | null>(null);
  const lastDragEndRef = useRef(0);
  const zoomOutTimerRef = useRef<number | null>(null);
  const sourceIdRef = useRef<string | null>(null);

  const [view, setView] = useState<NavView>(MEDIA_VIEWER_DEFAULT_VIEW);
  const [isDragging, setIsDragging] = useState(false);
  const [transition, setTransition] = useState<'to-contain' | 'to-preview' | null>(null);

  /* 官方 `S = useMemo(() => s && r ? ave(s, r) : null, [...])` */
  const basis: NavBasis | null = useMemo(
    () => (previewRect && inspectRect ? imageNavigationBasis(previewRect, inspectRect) : null),
    [inspectRect, previewRect],
  );

  /** 官方 `_` */
  const applyView = useCallback((next: NavView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  /** 官方 `E` */
  const clearZoomOutTimer = useCallback(() => {
    if (zoomOutTimerRef.current !== null) {
      window.clearTimeout(zoomOutTimerRef.current);
      zoomOutTimerRef.current = null;
    }
  }, []);

  /** 官方 `N`：缩到最小后延时回预览态 */
  const scheduleZoomOutReturn = useCallback((current: NavBasis) => {
    clearZoomOutTimer();
    zoomOutTimerRef.current = window.setTimeout(() => {
      zoomOutTimerRef.current = null;
      if (viewRef.current.zoom === current.minZoom) {
        setTransition(null);
        onRequestPreview?.();
      }
    }, MEDIA_VIEWER_ZOOM_OUT_RETURN_MS);
  }, [clearZoomOutTimer, onRequestPreview]);

  useEffect(() => clearZoomOutTimer, [clearZoomOutTimer]);

  /* 换图 ⇒ 复位（官方 `useEffect(..., [_, S, E, n])`，`n = sourceId`） */
  useEffect(() => {
    if (!basis || sourceIdRef.current === sourceId) return;
    sourceIdRef.current = sourceId;
    dragRef.current = null;
    lastDragEndRef.current = 0;
    clearZoomOutTimer();
    setIsDragging(false);
    setTransition(null);
    applyView(fitView(basis));
  }, [applyView, basis, clearZoomOutTimer, sourceId]);

  /* 检视态/过渡态变化 ⇒ 夹住当前 view（官方 `useEffect(..., [_, S, t, x])`） */
  useEffect(() => {
    if (!basis) return;
    if (inspecting || transition !== null) {
      applyView(clampView(viewRef.current, basis));
      return;
    }
    applyView(fitView(basis));
  }, [applyView, basis, inspecting, transition]);

  /* 会话关掉 ⇒ 清拖动/计时（官方 `useEffect(..., [e, E])`）。
     ⚠️ 仓库 lint 硬门禁止在 effect 里直接 `setState` ⇒ 复位用「渲染期按 props 复位」
     （与 `MediaViewer` 的检视态复位同一套写法；已复位时 React 会 bail out），
     effect 里只留 ref 清理。 */
  const [activeFor, setActiveFor] = useState(active);
  if (activeFor !== active) {
    setActiveFor(active);
    if (!active) setIsDragging(false);
  }
  useEffect(() => {
    if (active) return;
    dragRef.current = null;
  }, [active]);

  /** 官方 `T`：点图放大到检视目标（自然像素 1:1） */
  const zoomToContain = useCallback(() => {
    if (!basis) return;
    clearZoomOutTimer();
    setTransition(reducedMotion ? null : 'to-contain');
    applyView(containView());
  }, [applyView, basis, clearZoomOutTimer, reducedMotion]);

  /** 官方 `R`：退回预览（带 `to-preview` 过渡） */
  const returnToPreview = useCallback(() => {
    if (!basis) return;
    clearZoomOutTimer();
    dragRef.current = null;
    setIsDragging(false);
    setTransition(reducedMotion ? null : 'to-preview');
    applyView(fitView(basis));
  }, [applyView, basis, clearZoomOutTimer, reducedMotion]);

  /** 官方 `I`：立即回预览（清过渡） */
  const resetToPreview = useCallback(() => {
    if (!basis) return;
    clearZoomOutTimer();
    dragRef.current = null;
    setIsDragging(false);
    setTransition(null);
    applyView(fitView(basis));
  }, [applyView, basis, clearZoomOutTimer]);

  /* 官方 wheel 监听（挂在图片层元素上，`passive: false`） */
  useEffect(() => {
    const node = frameRef.current;
    if (!active || !basis || !node) return undefined;
    const handleWheel = (event: WheelEvent) => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const delta = wheelDelta(event, rect.height);

      if (!inspecting) {
        /* 预览态：只有 ctrl + 向上滚 */
        if (!event.ctrlKey || (event.preventDefault(), event.stopPropagation(), delta >= 0)) return;
        const start = fitView(basis);
        const next = zoomStep(start.zoom, delta, 'trackpad-pinch', basis.minZoom);
        clearZoomOutTimer();
        setTransition(null);
        onRequestInspect?.();
        onInteraction?.();
        applyView(zoomAt(start, next, {
          x: event.clientX - rect.left - rect.width / 2,
          y: event.clientY - rect.top - rect.height / 2,
        }, basis));
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (delta === 0) return;
      onInteraction?.();
      setTransition(null);
      const current = clampView(viewRef.current, basis);
      const kind = event.ctrlKey ? 'trackpad-pinch' : 'mouse-wheel';
      const next = zoomStep(current.zoom, delta, kind, basis.minZoom);
      applyView(zoomAt(current, next, {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      }, basis));
      if (next === basis.minZoom) scheduleZoomOutReturn(basis);
      else clearZoomOutTimer();
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [
    active, applyView, basis, clearZoomOutTimer, inspecting, onInteraction, onRequestInspect,
    scheduleZoomOutReturn,
  ]);

  /** 官方 `D` */
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const primary = event.button === 0 || event.button === 1;
    if (!active || !inspecting || !isViewZoomed(viewRef.current) || !primary) return;
    clearZoomOutTimer();
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      view: viewRef.current,
      moved: false,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [active, clearZoomOutTimer, inspecting]);

  /** 官方 `G` */
  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!active || !basis || !drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.clientX;
    const dy = event.clientY - drag.clientY;
    if (Math.hypot(dx, dy) > MEDIA_VIEWER_DRAG_THRESHOLD_PX) drag.moved = true;
    onInteraction?.();
    applyView(translateView(drag.view, { x: dx, y: dy }, basis));
    event.preventDefault();
  }, [active, applyView, basis, onInteraction]);

  /** 官方 `L` */
  const handlePointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.moved) lastDragEndRef.current = performance.now();
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  /** 官方 `F`：中键在已放大时不要触发浏览器自动滚动 */
  const handleAuxClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button === 1 && isViewZoomed(viewRef.current)) event.preventDefault();
  }, []);

  /** 官方 `z` */
  const consumeClickAfterDrag = useCallback(() => {
    const elapsed = performance.now() - lastDragEndRef.current;
    lastDragEndRef.current = 0;
    return elapsed >= 0 && elapsed <= MEDIA_VIEWER_CLICK_AFTER_DRAG_MS;
  }, []);

  /** 官方 `M` */
  const handleTransitionEnd = useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target || event.propertyName !== 'transform') return;
    setTransition(null);
  }, []);

  /** 官方 `B = S && !t && x===null ? jf(S) : b` */
  const displayedView = basis && !inspecting && transition === null ? fitView(basis) : view;
  const transform = basis ? imageTransform(displayedView, basis) : { scale: 1, x: 0, y: 0 };
  /** 官方 `P = t && eC(b)` */
  const isZoomed = inspecting && isViewZoomed(view);
  /** 官方 `j = x === "to-preview"` */
  const isReturning = transition === 'to-preview';

  const imageStyle: React.CSSProperties = useMemo(() => ({
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
    transformOrigin: 'center center',
    transition: imageTransformTransition(transition),
    willChange: inspecting || transition ? 'transform' : undefined,
  }), [inspecting, transform.scale, transform.x, transform.y, transition]);

  return {
    frameRef,
    imageStyle,
    isDragging,
    isZoomed,
    isReturning,
    zoomToContain,
    returnToPreview,
    resetToPreview,
    handleTransitionEnd,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleAuxClick,
    consumeClickAfterDrag,
  };
}
