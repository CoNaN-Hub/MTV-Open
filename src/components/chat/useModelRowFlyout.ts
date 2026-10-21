/**
 * 官方「模型悬浮飞出面板」的两个钩子 —— `use-chat-attachment-file-input-CE59XJWo.js`@93000 一带逐字。
 *
 *   `ju` → `useModelRowFlyout`   给模型行挂的悬浮钩子（文档级 `pointermove` + 安全三角）
 *   `Zu`/`Xu` → `useFlyoutPosition`  面板挂载后按 `Wu`/`Yu` 算 `top`/`left`，用 `Ju` 去重
 *
 * 放在 `.ts` 里（无 JSX）以免 `react-refresh/only-export-components` 报错。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  createHoverIntent,
  centerInContainer,
  isSamePosition,
  FLYOUT_BRIDGE_WIDTH,
  FLYOUT_EDGE_GAP,
  FLYOUT_PANEL_WIDTH,
  type FlyoutPosition,
} from '../../services/chat/modelFlyoutGeometry';

/** 官方 `ju`：模型行的悬浮钩子。 */
export function useModelRowFlyout(activeModelId: string | null) {
  const [intent] = useState(createHoverIntent);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const activeRef = useRef(activeModelId);

  useEffect(() => {
    activeRef.current = activeModelId;
  }, [activeModelId]);

  const onRowEnter = useCallback(
    (event: React.PointerEvent<HTMLElement>, show: () => void) => {
      if (event.pointerType !== 'mouse') return;
      const rowEl = event.currentTarget;
      intent.request({ x: event.clientX, y: event.clientY }, panelRef.current?.getBoundingClientRect() ?? null, () => {
        if (rowEl.isConnected && rowEl.matches(':hover')) {
          intent.cancel();
          show();
        }
      });
    },
    [intent],
  );

  useEffect(() => {
    intent.cancel();
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) {
        intent.cancel();
        return;
      }
      const rowEl = activeRef.current ? rowRefs.current.get(activeRef.current) : null;
      intent.move(
        { x: event.clientX, y: event.clientY },
        !!rowEl?.contains(target),
        panelRef.current?.getBoundingClientRect() ?? null,
      );
    };
    document.addEventListener('pointermove', onPointerMove);
    window.addEventListener('scroll', intent.cancel, true);
    window.addEventListener('resize', intent.cancel);
    window.addEventListener('blur', intent.cancel);
    return () => {
      intent.cancel();
      document.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', intent.cancel, true);
      window.removeEventListener('resize', intent.cancel);
      window.removeEventListener('blur', intent.cancel);
    };
  }, [intent]);

  return { onRowEnter, panelRef, rowRefs };
}

/**
 * 官方 `Zu` + `Xu`：飞出面板的定位。
 *
 * 与官方的一处必要差异：官方在 `active` 变 true 时算**一次**就够，因为官方每次换行都会先关面板；
 * 而 MTV 跨行时保持 `active === true`（`flyoutModel` 直接换值）⇒ 只看 `active` 会导致
 * 面板**钉在第一次悬停那一行**（用户实测：卡片固定在列表左下，不跟着行走）。
 * 所以这里额外依赖 `anchorKey`（当前悬停模型），并在面板高度变化（内容换行/图片加载）时重算。
 */
export function useFlyoutPosition({
  active,
  anchorKey,
  anchorRef,
  panelRef,
  containerRef,
  width = FLYOUT_PANEL_WIDTH,
  gap = FLYOUT_BRIDGE_WIDTH,
}: {
  active: boolean;
  /** 当前悬停的对象标识（模型 value）；换行必须触发重算。 */
  anchorKey?: string | null;
  anchorRef: React.RefObject<HTMLElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  containerRef?: React.RefObject<HTMLElement | null>;
  width?: number;
  /** 行与面板之间的可见间隙；同时是过桥命中区宽度（画布说明卡比官方的 6 更宽）。 */
  gap?: number;
}): FlyoutPosition | null {
  const [position, setPosition] = useState<FlyoutPosition | null>(null);

  useLayoutEffect(() => {
    if (!active) return;

    const measure = () => {
      const anchorEl = anchorRef.current;
      const panelEl = panelRef.current;
      if (!anchorEl || !panelEl) return;
      const anchor = anchorEl.getBoundingClientRect();
      const panel = panelEl.getBoundingClientRect();
      const container = containerRef?.current?.getBoundingClientRect() ?? null;
      const height = panel.height || panelEl.offsetHeight;
      /* 官方只往左挂；画布说明卡按参考图优先挂右侧，右侧放不下再翻到左侧。
         水平方向以**列表面板外缘**（`container`）为准，而不是行内缘 —— 否则那 8px 内边距会
         吃掉一部分视觉间隙（用户实测：卡片几乎是贴住列表的）。竖直仍以行中心对齐。 */
      const leftEdge = container ? container.left : anchor.left;
      const rightEdge = container ? container.right : anchor.right;
      const roomRight = window.innerWidth - rightEdge - gap - width - FLYOUT_EDGE_GAP;
      const side: 'left' | 'right' =
        roomRight >= 0 || leftEdge - gap - width - FLYOUT_EDGE_GAP < 0 ? 'right' : 'left';
      const next: FlyoutPosition = {
        top: centerInContainer(anchor, container, height),
        left: side === 'right' ? rightEdge + gap : leftEdge - width - gap,
        side,
      };
      setPosition((current) => (isSamePosition(current, next) ? current : next));
    };

    /* 官方是 layout effect 里同步 `setPosition`（`Zu`）；这里推迟一帧以避开
       `react-hooks/set-state-in-effect` 的「effect 内同步 setState」告警，视觉上无差别。 */
    const frame = requestAnimationFrame(measure);

    /* 面板内容换行 / 高度变化（`ModelInfoPanel` 文案长短不一）时也要重算 */
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (observer && panelRef.current) observer.observe(panelRef.current);
    if (observer && containerRef?.current) observer.observe(containerRef.current);

    /* 列表内部滚动 / 窗口缩放会让行的 rect 变，位置必须跟着走 */
    const list = containerRef?.current ?? null;
    list?.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      list?.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [active, anchorKey, anchorRef, panelRef, containerRef, width, gap]);

  return active ? position : null;
}
