/**
 * 官方「模型悬浮飞出面板」的几何与悬浮意图 —— `use-chat-attachment-file-input-CE59XJWo.js`@93000 一带逐字。
 *
 * 官方压缩名 → 语义（本文件导出名）：
 *   `zu` = 240   面板宽                  · `_i` = 6   朝行那侧的过桥命中区宽
 *   `_n` = 8     视口留边                · `Hu` = 400 跨行切换迟滞（ms）
 *   `Rr` = 8     安全三角上下外扩        · `Gu` = "(hover: hover) and (pointer: fine)"
 *   `Si` = "data-chat-model-floating-surface"
 *   `qu` → clampToViewport              竖直：钳进视口
 *   `Wu` → centerInContainer            竖直：行上居中，放得下时钳进列表盒
 *   `Yu` → leftOfAnchor                 水平：面板在行**左侧**（`anchor.left − 宽 − 过桥`）
 *   `Ju` → isSamePosition               位置等价判定（< 0.5px）
 *   `Pr` → inSafeTriangle               安全三角（行 ⇄ 面板之间移动时不收起）
 *   `Mu` → createHoverIntent            悬浮意图状态机（`cancel` / `move` / `request`）
 *   `Br` → isFloatingSurfaceTarget      `closest('[data-chat-model-floating-surface]')`
 *   `Vu` → hasFinePointer · `tn` → isTouchPointer
 */

/** 官方 `zu`：飞出面板宽度（px）。 */
export const FLYOUT_PANEL_WIDTH = 240;
/** 官方 `_i`：面板朝行那一侧的过桥命中区宽度（px）。 */
export const FLYOUT_BRIDGE_WIDTH = 6;
/** 官方 `_n`：距离视口边缘的最小留白（px）。 */
export const FLYOUT_EDGE_GAP = 8;
/** 官方 `Hu`：跨行切换时的迟滞（ms）。 */
export const FLYOUT_DISMISS_DELAY = 400;
/** 官方 `Rr`：安全三角上下外扩（px）。 */
export const SAFE_TRIANGLE_OVERHANG = 8;
/** 官方 `Gu`：判定「精细指针」的媒体查询。 */
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
/** 官方 `Si`：飞出面板的标记属性。 */
export const FLOATING_SURFACE_ATTR = 'data-chat-model-floating-surface';

/** 指针坐标。 */
export interface Point {
  x: number;
  y: number;
}

/** 飞出面板的 `fixed` 定位。 */
export interface FlyoutPosition {
  top: number;
  left: number;
  /** 面板贴在锚点的哪一侧（`right` = 面板在行的右边）。缺省按官方 = 左侧。 */
  side?: 'left' | 'right';
}

/** `getBoundingClientRect()` 的最小子集。 */
export interface RectLike {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** 官方 `Vu`：是否为「可悬浮」的精细指针设备。 */
export function hasFinePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(FINE_POINTER_QUERY).matches
  );
}

/** 官方 `tn`：触屏 / 手写笔指针不参与悬浮逻辑。 */
export function isTouchPointer(pointerType: string): boolean {
  return pointerType === 'touch' || pointerType === 'pen';
}

/** 官方 `Br`：是否落在飞出面板内部（含过桥）。 */
export function isFloatingSurfaceTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(`[${FLOATING_SURFACE_ATTR}]`);
}

/** 官方 `qu`：把期望的 `top` 钳进视口（上下各留 `FLYOUT_EDGE_GAP`）。 */
export function clampToViewport(top: number, panelHeight: number): number {
  const max = Math.max(FLYOUT_EDGE_GAP, window.innerHeight - panelHeight - FLYOUT_EDGE_GAP);
  return Math.min(Math.max(FLYOUT_EDGE_GAP, top), max);
}

/** 官方 `Wu`：竖直定位 —— 先在行上居中；面板放得进容器时再钳进容器盒内。 */
export function centerInContainer(anchor: RectLike, container: RectLike | null, panelHeight: number): number {
  let top = anchor.top + anchor.height / 2 - panelHeight / 2;
  if (container && panelHeight <= container.height) {
    top = Math.min(Math.max(container.top, top), container.bottom - panelHeight);
  }
  return clampToViewport(top, panelHeight);
}

/** 官方 `Yu`：水平定位 —— 面板贴在行的**左侧**，中间留 `FLYOUT_BRIDGE_WIDTH` 过桥。 */
export function leftOfAnchor(anchor: RectLike, panelWidth: number, gap = FLYOUT_BRIDGE_WIDTH): number {
  return anchor.left - panelWidth - gap;
}

/** `leftOfAnchor` 的镜像：面板贴在行的**右侧**，中间留同样宽的过桥。 */
export function rightOfAnchor(anchor: RectLike, gap = FLYOUT_BRIDGE_WIDTH): number {
  return anchor.right + gap;
}

/** 官方 `Ju`：两个位置是否「等价」（< 0.5px 视为不变）。 */
export function isSamePosition(a: FlyoutPosition | null, b: FlyoutPosition | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5;
}

/**
 * 官方 `Pr`：**安全三角**判定。
 * `origin` 是指针在行上的起点，`pointer` 是上一帧位置，`next` 是当前帧位置，
 * `panel` 是飞出面板矩形。返回 `true` 表示指针正沿「行 → 面板」的连线移动 ⇒ 不要收起。
 */
export function inSafeTriangle(
  origin: Point | null,
  pointer: Point | null,
  next: Point | null,
  panel: RectLike | null,
): boolean {
  if (!origin || !pointer || !next || !panel) return false;
  if (
    panel.right <= panel.left ||
    panel.bottom <= panel.top ||
    origin.x <= panel.right ||
    next.x >= pointer.x ||
    next.x < panel.right ||
    next.x > origin.x
  ) {
    return false;
  }
  const ratio = (origin.x - next.x) / (origin.x - panel.right);
  const top = origin.y + (panel.top - SAFE_TRIANGLE_OVERHANG - origin.y) * ratio;
  const bottom = origin.y + (panel.bottom + SAFE_TRIANGLE_OVERHANG - origin.y) * ratio;
  return next.y >= top && next.y <= bottom;
}

/** 官方 `Mu` 的返回值。 */
export interface HoverIntent {
  cancel: () => void;
  move: (pointer: Point, insideAnchor: boolean, panel: RectLike | null) => void;
  request: (pointer: Point, panel: RectLike | null, show: () => void) => void;
}

/** 官方 `Mu`：悬浮意图状态机（在行与面板之间横扫时不闪烁）。 */
export function createHoverIntent(): HoverIntent {
  let origin: Point | null = null;
  let pointer: Point | null = null;
  let prev: Point | null = null;
  let pending: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = null;
    origin = null;
    pointer = null;
    prev = null;
  };

  const fire = () => {
    const callback = pending;
    cancel();
    callback?.();
  };

  const inTriangle = (next: Point, panel: RectLike | null) =>
    origin !== null && pointer !== null && panel !== null && inSafeTriangle(origin, pointer, next, panel);

  return {
    cancel,
    move(next, insideAnchor, panel) {
      if (insideAnchor) {
        if (pending) cancel();
        if (origin === null) origin = next;
      } else if (pointer && (pointer.x !== next.x || pointer.y !== next.y) && !inTriangle(next, panel)) {
        fire();
      }
      prev = pointer;
      pointer = next;
    },
    request(next, panel, show) {
      /* 官方 `p = (t.x===l.x && t.y===l.y) ? n : t`：指针没动过就用「上上个」位置当参考。 */
      const reference = pointer && pointer.x === next.x && pointer.y === next.y ? prev : pointer;
      if (origin !== null && reference !== null && panel !== null && inSafeTriangle(origin, reference, next, panel)) {
        pending = show;
        if (timer === null) timer = setTimeout(fire, FLYOUT_DISMISS_DELAY);
      } else {
        cancel();
        show();
        origin = next;
      }
      prev = pointer;
      pointer = next;
    },
  };
}
