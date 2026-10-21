/**
 * useViewportEmptyHint —— 官方「当前视窗没有节点」提示的**状态机**，逐字移植。
 *
 * 官方出处：`vendor-pkg-canvas-CvbAwZyy.js`（只读产物，4,570,188 字符 UTF-8）
 *   · 相交判定   `lwt` @3559820 逐字：
 *       `(e,t)=>!(t.right<e.left||t.left>e.right||t.bottom<e.top||t.top>e.bottom)`
 *   · 常量       `cwt=100`（重算防抖 ms）· `dwt=1e3`（显示前延迟 ms）     @3559820
 *   · 主体 hook  `uwt` @3559869–3561310 逐字（见下方各处的「官方逐字」注释）
 *   · 几何兜底   `ws={width:250,height:250}` @505425 · `Cn`/`Ao` @506115/@506243
 *   · 绝对坐标   `lo` @507879（递归沿 `parentId` 累加，带环检测 + 缓存）
 *   · 防抖       `wf` = vendor-libs 导出 `jf` = 本地 `NNo` @5537755 —— **lodash debounce**
 *                （默认 trailing；本 hook 只用到「调用」与 `.cancel()`）
 *
 * ⚠️ 官方 `uwt` 里 `cn` = React Flow/Zustand 的 `useStore`，`pt` = `useReactFlow`。
 *    MTV 对应物：`@xyflow/react` 的 `useStore` / `useReactFlow`（同一实现）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@xyflow/react';
import type { Node as RFNode } from '@xyflow/react';
import type { BaseNodeData } from '../types';
import { NODE_BASE_SIZE } from '../utils/nodeBounds';
import { pileAbsolutePosition } from '../utils/officialPile';

/* ══════════════════════════════════════════════════════════════════════════
   官方常量（逐字）
   ══════════════════════════════════════════════════════════════════════════ */

/** 官方 `cwt = 100` @3559820 —— 视窗/节点变化后**重算**的防抖窗口 */
export const VIEWPORT_EMPTY_RECOMPUTE_DEBOUNCE_MS = 100;
/** 官方 `dwt = 1e3` @3559820 —— 「没有节点」成立后**显示**提示前的延迟 */
export const VIEWPORT_EMPTY_SHOW_DELAY_MS = 1_000;
/**
 * 官方 `mwt = .2` @3561310 —— 点「回到节点」时 `fitView` 的 `maxZoom`。
 * 单节点 fitView 时如果节点很小，官方不允许放大超过 0.2 倍 ⇒ 逐字照抄。
 */
export const VIEWPORT_EMPTY_FIT_MAX_ZOOM = 0.2;
/** 官方 `ws = {width:250,height:250}` @505425 —— 取不到节点尺寸时的兜底 */
export const VIEWPORT_EMPTY_FALLBACK_SIZE = NODE_BASE_SIZE;

/* ══════════════════════════════════════════════════════════════════════════
   纯函数（与 hook 分离，便于单测；语义与官方逐一对应）
   ══════════════════════════════════════════════════════════════════════════ */

export interface ViewportRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 官方 `lwt(e,t)` 逐字 —— 两矩形相交 */
export function rectsIntersect(a: ViewportRect, b: ViewportRect): boolean {
  return !(b.right < a.left || b.left > a.right || b.bottom < a.top || b.top > a.bottom);
}

/** 官方 `pwt(e)` 逐字 —— 取**最后一个**节点（`nodes[nodes.length-1]`），空数组回 null */
export function pickLastNode<T>(nodes: readonly T[] | undefined | null): T | null {
  if (!nodes || nodes.length === 0) return null;
  return nodes[nodes.length - 1] ?? null;
}

/** 官方 `Cn(e)` 逐字 —— 节点宽度：`width || measured.width || dimensions.width`，否则兜底 250 */
export function viewportNodeWidth(node: RFNode<BaseNodeData> | undefined | null): number {
  if (!node) return VIEWPORT_EMPTY_FALLBACK_SIZE.width;
  /* `dimensions` 是 React Flow 11 的字段；官方产物同时读它（v12 里恒为 undefined），
     这里一并保留以逐字对齐取值链。 */
  const raw = node.width
    || node.measured?.width
    || (node as { dimensions?: { width?: number } }).dimensions?.width;
  return Number.isFinite(raw) ? (raw as number) : VIEWPORT_EMPTY_FALLBACK_SIZE.width;
}

/** 官方 `Ao(e)` 逐字 —— 节点高度：`height || measured.height || dimensions.height`，否则兜底 250 */
export function viewportNodeHeight(node: RFNode<BaseNodeData> | undefined | null): number {
  if (!node) return VIEWPORT_EMPTY_FALLBACK_SIZE.height;
  const raw = node.height
    || node.measured?.height
    || (node as { dimensions?: { height?: number } }).dimensions?.height;
  return Number.isFinite(raw) ? (raw as number) : VIEWPORT_EMPTY_FALLBACK_SIZE.height;
}

/**
 * 官方 `uwt.h` 里的视窗矩形：
 *   `const v=-y/_, w=-b/_; S={left:v, top:w, right:v+n/_, bottom:w+o/_}`
 *   （`y`/`b` = 平移，`_` = zoom，`n`/`o` = 画布宽高）
 */
export function viewportBoundsOf(
  width: number,
  height: number,
  transform: readonly [number, number, number],
): ViewportRect {
  const [x, y, zoom] = transform;
  const left = -x / zoom;
  const top = -y / zoom;
  return { left, top, right: left + width / zoom, bottom: top + height / zoom };
}

/**
 * 官方 `uwt.h` 的 `e.some(...)` 逐字 —— 是否存在**未被隐藏**且与视窗相交的节点。
 * 坐标用 `lo(node, nodeByIdMap)` 的**绝对坐标**（沿 `parentId` 累加），不是 `position` 原始值。
 *
 * ⚠️ MTV 复用仓库既有的等价 helper：`pileAbsolutePosition`（`utils/officialPile.ts` @394，
 *    文件头注释即写明是官方 `vr(e,t,n,s)` 的逐字移植：递归 + 环检测 + 缓存）——
 *    与官方 `lo` @507879 是同一条算法（两处产物里各有一份同名副本）。
 *    官方调用点只传 2 个参数（无缓存/无 visiting）⇒ 这里也保持「无缓存」的调用法。
 */
export function anyNodeInViewport(
  nodes: readonly RFNode<BaseNodeData>[],
  bounds: ViewportRect,
): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.some((node) => {
    if (node?.hidden) return false;
    const { x, y } = pileAbsolutePosition(node, byId);
    return rectsIntersect(bounds, {
      left: x,
      top: y,
      right: x + viewportNodeWidth(node),
      bottom: y + viewportNodeHeight(node),
    });
  });
}

/**
 * 官方 `wf`（= vendor-libs `jf` = `NNo` @5537755 的 lodash `debounce`）在**本 hook 用到的子集**：
 * 默认 trailing 行为 + `.cancel()`。官方没有传 `leading`/`maxWait` 选项。
 */
function debounce<F extends () => void>(fn: F, wait: number): F & { cancel: () => void } {
  let timer: number | undefined;
  const debounced = (() => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = undefined;
      fn();
    }, wait);
  }) as F & { cancel: () => void };
  debounced.cancel = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}

/* ══════════════════════════════════════════════════════════════════════════
   hook 主体（官方 `uwt` 逐字）
   ══════════════════════════════════════════════════════════════════════════ */

export interface ViewportEmptyHintState {
  /** 官方 `hasNodeInViewport`：视窗内是否**有**节点（hidden 的节点不算） */
  hasNodeInViewport: boolean;
  /** 官方 `viewportBounds`：flow 坐标系下的视窗矩形；视窗不可用时为 null */
  viewportBounds: ViewportRect | null;
  /** 官方 `shouldShowEmptyHint`：是否显示提示（延迟 + 前置条件都已满足） */
  shouldShowEmptyHint: boolean;
  /** 官方 `dismissEmptyHint`：立即收起提示 */
  dismissEmptyHint: () => void;
}

export function useViewportEmptyHint(
  nodes: readonly RFNode<BaseNodeData>[],
  delay: number = VIEWPORT_EMPTY_SHOW_DELAY_MS,
): ViewportEmptyHintState {
  /* 官方 `const{width:n,height:o,transform:r}=cn(y=>({width:y.width,height:y.height,transform:y.transform}))`
     ⚠️ MTV 适配点：官方把三个值塞进**一个对象选择器**（每次返回新对象 ⇒ React Flow store
        任何一次变化都会让本 hook 重渲染）。这里拆成 3 个原始值选择器，取值语义完全一致，
        只是避免拖拽/缩放期间的无谓重渲染。 */
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const transform = useStore((state) => state.transform);

  const [viewportBounds, setViewportBounds] = useState<ViewportRect | null>(null); // 官方 i / l
  const [hasNodeInViewport, setHasNodeInViewport] = useState(false);              // 官方 c / d
  const [shouldShowEmptyHint, setShouldShowEmptyHint] = useState(false);          // 官方 u / p
  const showTimerRef = useRef<number | undefined>(undefined);                     // 官方 m

  /** 官方 `f` 逐字 */
  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = undefined;
    }
  }, []);

  /** 官方 `h` 逐字 */
  const recompute = useCallback(() => {
    const [x, y, zoom] = transform ?? [0, 0, 0];
    if (!transform || width === 0 || height === 0 || zoom === 0) {
      setViewportBounds(null);
      setHasNodeInViewport(false);
      return;
    }
    const left = -x / zoom;
    const top = -y / zoom;
    const bounds: ViewportRect = {
      left,
      top,
      right: left + width / zoom,
      bottom: top + height / zoom,
    };
    setViewportBounds(bounds);
    setHasNodeInViewport(anyNodeInViewport(nodes, bounds));
  }, [height, nodes, transform, width]);

  /* 官方：`const y=wf(h,cwt); return y(), ()=>y.cancel()` */
  useEffect(() => {
    const debounced = debounce(recompute, VIEWPORT_EMPTY_RECOMPUTE_DEBOUNCE_MS);
    debounced();
    return () => debounced.cancel();
  }, [recompute]);

  /* 官方：`const g=e.length>0&&i!==null&&!c`
     ⚠️ `nodes.length===0`（画布空）**不**显示本提示 —— 空画布走官方另一套空状态。 */
  const candidate = nodes.length > 0 && viewportBounds !== null && !hasNodeInViewport;

  /* 官方：
     `if(f(),!g){p(!1);return} return m.current=window.setTimeout(()=>p(!0),t), f` */
  useEffect(() => {
    clearShowTimer();
    if (!candidate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 官方 `uwt` 逐字：`if(f(),!g){p(!1);return}`
      setShouldShowEmptyHint(false);
      return;
    }
    showTimerRef.current = window.setTimeout(() => setShouldShowEmptyHint(true), delay);
    return clearShowTimer;
  }, [candidate, delay, clearShowTimer]);

  /** 官方 `x` 逐字 */
  const dismissEmptyHint = useCallback(() => setShouldShowEmptyHint(false), []);

  return { hasNodeInViewport, viewportBounds, shouldShowEmptyHint, dismissEmptyHint };
}
