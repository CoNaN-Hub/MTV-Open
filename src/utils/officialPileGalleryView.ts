/**
 * officialPileGalleryView —— 官方 **PILE 画廊（全屏层）** 的**布局 / 视口 / 拖拽交接**层，逐字移植。
 *
 * 官方出处：`zoom-slider-3ZcFvYQO.js`
 *   画廊组件 `WQe` @2955733（长度 11370）调用到的、**尚未**出现在 `officialPileGallery.ts` 里的
 *   全部纯函数。几何层（`vJ`/`xQe`/`wQe`/`Fk`/`CQe`/`_0`/`zG`/`qb`/`VG`/`SQe`/`kQe`/`dQe`/`RQe`/`IQe`）
 *   已在 `officialPileGallery.ts` 里，本文件**只 import、不重复实现**。
 *
 * 移植规则：
 *   - 保留官方**全部算式与比较**（含 `Number.EPSILON`、`Math.min/max` 的先后顺序）。
 *   - 只删掉 DOM/React 副作用（`style.transform=…`、`element.style.setProperty`、
 *     `new Image()`、`addEventListener`、`useRef/useCallback`）；返回值原样保留。
 *   - 官方常量表 `ms`（`zoom-slider` @2922576 起）与 `kd`（@1066000）逐字抄来。
 */

import {
  clampGalleryViewport,
  galleryInitialViewport,
  galleryReadableScale,
  galleryWorldTransform,
  normalizeWheelDelta,
  PILE_GALLERY_Z_INDEX,
  GALLERY_WHEEL_PAGE,
  type GalleryItem,
  type GalleryMemberSize,
  type GalleryRect,
  type GalleryViewportState,
} from './officialPileGallery';

/* ------------------------------------------------------------------ *
 * 常量（官方值，逐字）
 * ------------------------------------------------------------------ */

/**
 * 官方 `xu = 112` @2945320 —— 画廊行布局的外扩留白（画布包围盒四周各留 `112`）。
 * 对应 `ms.gallery` 行排布里每行两侧的安全边距。
 */
export const GALLERY_ROW_PADDING = 112;
/** 官方 `CC = 56` @2945320 —— 同一行内相邻成员的水平间距 */
export const GALLERY_ROW_GAP = 56;
/** 官方 `ZM = 40` @2945320 —— 每行顶部给标签留的高度 */
export const GALLERY_ROW_LABEL_HEIGHT = 40;
/** 官方 `gQe = 1872` @2945320 —— 单行最大宽度（超过就换行） */
export const GALLERY_ROW_MAX_WIDTH = 1872;

/** 官方 `kd = {min:.15, max:2}` @1066000 —— 画廊 zoom 上下限（`qb` 里用的就是它） */
export const GALLERY_ZOOM_MIN = 0.15;
export const GALLERY_ZOOM_MAX = 2;

/** 官方 `_Qe = 3` @2945444 —— dnd-kit 的激活位移（`activationConstraint.distance`） */
export const GALLERY_DRAG_ACTIVATION_DISTANCE = 3;
/** 官方 `TQe = xJ + 10` @2945444 —— 拖拽浮层（`DragOverlay`）的 z-index */
export const GALLERY_DRAG_OVERLAY_Z_INDEX = PILE_GALLERY_Z_INDEX + 10;
/** 官方 `EQe` 指针平移里写死的判定阈值：`|dx| + |dy| > 3` */
export const GALLERY_PAN_MOVE_THRESHOLD = 3;

/** 官方 `yu = [.16,1,.3,1]` @2922522 —— 回弹/旋转缓动 */
const EASE_EMPHASIS: readonly number[] = [0.16, 1, 0.3, 1];
/** 官方 `Bh = [.65,0,.35,1]` @2922538 —— 标准缓动 */
const EASE_STANDARD: readonly number[] = [0.65, 0, 0.35, 1];

/** 官方 `ms.gallery.openClose` @2922576（逐字） */
export const GALLERY_OPEN_CLOSE = {
  durationSeconds: 0.5,
  ease: EASE_STANDARD,
  rotationDurationSeconds: 0.26,
  rotationEase: EASE_EMPHASIS,
  closingRotationDelaySeconds: 0.18,
  staggerStepSeconds: 0.012,
  maxStaggerItems: 5,
  labelRevealDelaySeconds: 0.32,
  chromeExitLeadSeconds: 0.07,
  chromeReturnDelaySeconds: 0.28,
} as const;

/** 官方 `ms.gallery.collapse`（= 官方 `NQe` @2945444） */
export const GALLERY_COLLAPSE = {
  durationSeconds: 0.36,
  ease: EASE_STANDARD,
} as const;

/** 官方 `ms.gallery.drag` —— 拖拽拾起时长（`DQe` 之外的 `TZe`/浮层动画都用它） */
export const GALLERY_DRAG = {
  pickupDurationSeconds: 0.32,
  pickupEase: EASE_STANDARD,
} as const;

/** 官方 `ms.gallery.backdrop` —— 背景遮罩时长 */
export const GALLERY_BACKDROP = {
  standardDurationSeconds: 0.22,
  dragCollapseDurationSeconds: 0.18,
  ease: EASE_EMPHASIS,
} as const;

/** 官方 `ms.gallery.mediaPreview` —— 拖拽时的媒体交接时长 */
export const GALLERY_MEDIA_PREVIEW = {
  videoHoverIntentMs: 180,
  videoCrossfadeDurationMs: 100,
  dragAudioHandoffDurationSeconds: 0.14,
  dragVideoHandoffDurationSeconds: 0.12,
} as const;

/** 官方 `ms.handoff` —— 落回画布/堆叠的交接时长（`TZe`/`IZe`/`kZe`） */
export const GALLERY_HANDOFF = {
  canvasLanding: {
    movementDurationSeconds: 0.18,
    movementEase: EASE_EMPHASIS,
    contentHandoffDurationSeconds: 0.2,
    contentHandoffEase: 'linear',
  },
  completionBufferSeconds: 0.02,
} as const;

/** 官方 `ms.stack.entry` —— 堆叠入场时长（`dJ`/`NZe` 用） */
export const STACK_ENTRY = {
  movementDurationSeconds: 0.46,
  rotationDurationSeconds: 0.28,
  rotationDelaySeconds: 0.16,
  staggerStepSeconds: 0.018,
  maxStaggerItems: 5,
} as const;

/* ------------------------------------------------------------------ *
 * 基础数据类型
 * ------------------------------------------------------------------ */

/** 官方画廊里的一个成员节点（各助手只读 `node.id`） */
export interface GalleryMemberRef {
  node: { id: string };
}

/** 带尺寸的成员（`bQe`/`wJ`/`BQe` 读它） */
export interface GalleryMemberItem extends GalleryMemberRef {
  displaySize: GalleryMemberSize;
}

/** 带 display 的成员（`mQe`/`MQe` 读它） */
export interface GalleryDisplayMember extends GalleryMemberItem {
  display: {
    status: { kind: string };
    content: { type: string; displaySrc?: string };
  };
}

/** `vQe` 产出的行内盒子（`bQe` 的结果） */
export interface GalleryBoxItem {
  id: string;
  width: number;
  height: number;
}

/** `yQe` 产出的一行 */
export interface GalleryRow {
  items: GalleryBoxItem[];
  width: number;
  height: number;
}

/** `vQe` 产出的一个已摆位盒子（画廊空间坐标，原点 = 画布中心） */
export interface GalleryPlacedBox {
  id: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

/** 官方 `vQe` 的 `canvasBounds`：用的是 `.left/.top/.right/.bottom` 四边（不是 width/height） */
export interface GalleryEdges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 官方 `vQe` 的返回值 */
export interface GalleryRowCanvas {
  canvasBounds: GalleryEdges;
  items: GalleryPlacedBox[];
}

/** 官方 `bJ` 的结果：元素在视口里的左上原点（宽高为 0 时按 0 处理） */
export interface GalleryOrigin {
  left: number;
  top: number;
}

/** 官方 `hQe` 的结果：拖拽浮层的携行几何 */
export interface GalleryDragCarry {
  left: number;
  top: number;
  originX: number;
  originY: number;
  sourceScale: number;
  carryScale: number;
}

/** 官方 `uQe` 的结果：拾取点在成员矩形里的归一化位置 */
export interface GalleryGrabPoint {
  xRatio: number;
  yRatio: number;
}

/** 官方 `fQe` 的结果：拖拽的源矩形 + 屏幕中心 + 指针 */
export interface GalleryDragGeometry {
  sourceRect: GalleryRect;
  screenCenter: { x: number; y: number };
  pointer: { x: number; y: number };
}

/** 官方 `dnd-kit` 的 `active`（只读这里用到的形状） */
export interface GalleryDragActive {
  rect: {
    current: {
      translated?: GalleryRect | null;
      initial?: GalleryRect | null;
    };
  };
}

/** 官方 `dnd-kit` 的拖拽事件（`activatorEvent` + `delta` + `active`） */
export interface GalleryDragEvent {
  activatorEvent?: unknown;
  delta: { x: number; y: number };
  active: GalleryDragActive;
}

/** 官方 `EQe` 的指针事件（只读这几个字段） */
export interface GalleryPointerLike {
  pointerId: number;
  clientX: number;
  clientY: number;
  button?: number;
}

/** 官方 `EQe` 的滚轮事件 */
export interface GalleryWheelEventLike {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  shiftKey?: boolean;
  ctrlKey: boolean;
  clientX: number;
  clientY: number;
}

/** 官方 `tU`(= 官方 chunk `index-BiTZf8mJ.js` 导出 `tQ` → 本地 `_6e`) 读的事件形状 */
export interface GalleryEventPointLike {
  touches?: ReadonlyArray<{ clientX: number; clientY: number }>;
  changedTouches?: ReadonlyArray<{ clientX: number; clientY: number }>;
  clientX?: number;
  clientY?: number;
}

/** 官方 `LG` 的返回：成员从画廊布局空间到世界层的变换 */
export interface GalleryLayoutTransform {
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

/** 官方成员的展示内容（`VQe` 读 `content.type`） */
export interface GalleryContentLike {
  type: string;
}

/* ------ 拖拽 / 交接状态（官方 `WQe` 里的 `T`） ------ */

/** 官方 `T.phase === "dragging"` */
export interface GalleryDragPhase {
  phase: 'dragging';
  memberId: string;
  members: readonly GalleryMemberRef[];
  screenRect: GalleryRect;
  grabPoint: GalleryGrabPoint;
  isCollapsing: boolean;
}

/** 官方交接计划（`kind: "slot" | "canvas" | "pile"`） */
export type GalleryHandoffPlan =
  | {
      kind: 'slot';
      memberId: string;
      sourceRect: GalleryRect;
      target: GalleryItem;
    }
  | {
      kind: 'canvas';
      memberId: string;
      sourceRect: GalleryRect;
      finalPileMemberIds: readonly string[];
      target: GalleryItem;
    }
  | {
      kind: 'pile';
      memberId: string;
      sourceRect: GalleryRect;
      finalPileMemberIds: readonly string[];
      target: GalleryItem;
    };

/** 官方 `T.phase === "handoff"` */
export interface GalleryHandoffPhase {
  phase: 'handoff';
  members: readonly GalleryMemberRef[];
  plan: GalleryHandoffPlan;
}

export type GalleryDragOrHandoff = GalleryDragPhase | GalleryHandoffPhase;

/** 官方 `WQe` 的相位机状态（`S`） */
export type GalleryPhase = 'opening' | 'open' | 'closing';

/** 官方 `PQe` 的单段过渡描述 */
export interface GalleryTransitionSpec {
  duration: number;
  delay: number;
  ease: readonly number[];
}

/** 官方 `PQe` 返回的完整过渡表 */
export interface GalleryMemberTransition {
  x: GalleryTransitionSpec;
  y: GalleryTransitionSpec;
  scale: GalleryTransitionSpec;
  opacity: GalleryTransitionSpec;
  rotate: GalleryTransitionSpec;
}

/** 官方 `EQe` 返回的 `worldStyle`（去掉 `style.transform=` 的副作用，只留值） */
export interface GalleryWorldStyle {
  transformOrigin: string;
  transform: string;
  readableScale: number;
  readableWidth: string;
}

/* ------------------------------------------------------------------ *
 * 视口尺寸 / 元素原点
 * ------------------------------------------------------------------ */

/**
 * 官方 `GG(e)` @2945444 —— 视口尺寸：元素矩形，宽/高为 0 时回落 `window.innerWidth/Height`，
 * 且下限为 `1`。这里把 `window` 的回落值显式传进来，保持函数纯净。
 */
export function galleryViewportSize(
  element: { getBoundingClientRect(): { width: number; height: number } },
  fallback: { width: number; height: number },
): { width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(rect.width || fallback.width, 1),
    height: Math.max(rect.height || fallback.height, 1),
  };
}

/**
 * 官方 `bJ(e)` @2945228 —— 元素在视口里的左上原点；宽高为 0（未挂载）时当作 `0`。
 */
export function galleryElementOrigin(element: {
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}): GalleryOrigin {
  const rect = element.getBoundingClientRect();
  return { left: rect.width ? rect.left : 0, top: rect.height ? rect.top : 0 };
}

/* ------------------------------------------------------------------ *
 * 矩形 / 命中
 * ------------------------------------------------------------------ */

/**
 * 官方 `OG(e, t)` @2945228 —— 点是否落在矩形内（**含边界**）。
 * ⚠️ 与 `officialPileDrop.ts` 的 `dme` 语义相同，但入参形状不同（这里点在前、矩形在后）。
 */
export function galleryPointInBounds(
  point: { x: number; y: number },
  bounds: GalleryRect,
): boolean {
  return (
    point.x >= bounds.left &&
    point.x <= bounds.left + bounds.width &&
    point.y >= bounds.top &&
    point.y <= bounds.top + bounds.height
  );
}

/** 官方 `XM(e)` @2945228 —— 只挑四个字段，剔除 DOMRect 上多余的属性 */
export function galleryRect(rect: GalleryRect): GalleryRect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/** 官方 `vQe` 的 `canvasBounds`（四边）→ `clampGalleryViewport` 需要的 `{left,top,width,height}` */
export function galleryCanvasEdgesToRect(edges: GalleryEdges): GalleryRect {
  return {
    left: edges.left,
    top: edges.top,
    width: edges.right - edges.left,
    height: edges.bottom - edges.top,
  };
}

/**
 * 官方 `qb` 的 zoom 段用的是 `kd`（`min:.15, max:2`）。
 * ⚠️ `officialPileGallery.ts` 的 `clampGalleryViewport` 因为当时没抽到 `kd`，用的是**占位**边界
 * `0.05 / 8`（该文件里有记账注释）。这里先按官方 `kd` 夹一次，再交给共用实现做 center 夹取，
 * 以免整份画廊视口被占位上限污染。
 */
function clampGalleryZoom(zoom: number): number {
  return Math.min(Math.max(zoom, GALLERY_ZOOM_MIN), GALLERY_ZOOM_MAX);
}

/* ------------------------------------------------------------------ *
 * 指针事件
 * ------------------------------------------------------------------ */

/**
 * 官方 `tU` @2945xxx —— 该标识符是从 `./index-BiTZf8mJ.js` 导入的：
 * 官方 import 子句（`zoom-slider-3ZcFvYQO.js` @5425）写的是 **`tQ as tU`**，
 * 而 `index-BiTZf8mJ.js` 的导出表（@12247966）把 `tQ` 映射到本地 `_6e`：
 *
 * ```js
 * function _6e(t){
 *   if(p7s(t)){                                   // 触摸事件
 *     if(t.touches&&t.touches.length){const{clientX:e,clientY:n}=t.touches[0];return{x:e,y:n}}
 *     else if(t.changedTouches&&t.changedTouches.length){const{clientX:e,clientY:n}=t.changedTouches[0];return{x:e,y:n}}
 *   }
 *   return h7s(t)?{x:t.clientX,y:t.clientY}:null  // 鼠标事件
 * }
 * ```
 * ⇒ 触摸取 `touches[0]`，否则 `changedTouches[0]`，否则鼠标 `clientX/clientY`，都没有则 `null`。
 */
export function galleryEventPoint(event: GalleryEventPointLike): { x: number; y: number } | null {
  const touches = event.touches;
  if (touches && touches.length > 0) {
    const { clientX, clientY } = touches[0];
    return { x: clientX, y: clientY };
  }
  const changed = event.changedTouches;
  if (changed && changed.length > 0) {
    const { clientX, clientY } = changed[0];
    return { x: clientX, y: clientY };
  }
  if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return { x: event.clientX, y: event.clientY };
  }
  return null;
}

/**
 * 官方 `uQe(e, t)` @2944788 —— 拾取点在成员屏幕矩形里的**归一化**位置（夹在 `[0,1]`；
 * 没有激活事件或矩形无面积时是正中心 `.5/.5`）。
 */
export function galleryDragGrabPoint(
  drag: { activatorEvent?: unknown },
  rect: GalleryRect,
): GalleryGrabPoint {
  const point = drag.activatorEvent ? galleryEventPoint(drag.activatorEvent as GalleryEventPointLike) : null;
  if (!point || rect.width <= 0 || rect.height <= 0) return { xRatio: 0.5, yRatio: 0.5 };
  return {
    xRatio: Math.min(Math.max((point.x - rect.left) / rect.width, 0), 1),
    yRatio: Math.min(Math.max((point.y - rect.top) / rect.height, 0), 1),
  };
}

/* ------------------------------------------------------------------ *
 * 拖拽几何
 * ------------------------------------------------------------------ */

/**
 * 官方 `yJ(e, t, n)` @2945546 —— 指针在容器坐标系里的位置。
 * 起点取 `activatorEvent` 的指针位置（触摸/鼠标），没有就退回矩形中心；
 * 再加 `delta`，最后减去容器原点。
 */
export function galleryDragPointer(
  drag: { activatorEvent?: unknown; delta: { x: number; y: number } },
  fallbackRect: GalleryRect,
  container: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } },
): { x: number; y: number } {
  const origin = galleryElementOrigin(container);
  const start = (drag.activatorEvent
    ? galleryEventPoint(drag.activatorEvent as GalleryEventPointLike)
    : null) ?? {
    x: fallbackRect.left + fallbackRect.width / 2,
    y: fallbackRect.top + fallbackRect.height / 2,
  };
  return {
    x: start.x + drag.delta.x - origin.left,
    y: start.y + drag.delta.y - origin.top,
  };
}

/**
 * 官方 `pQe(e, t, n, s)` @2945320 —— 拖拽中「当前矩形」的优先级：
 * ① 显式 `override`（有面积时）→ ② `rect.current.translated` → ③ `rect.current.initial`（或 `fallback`）
 * 且在第 ③ 种情况下才加 `delta`。
 */
export function galleryActiveRect(
  active: GalleryDragActive,
  delta: { x: number; y: number },
  fallbackRect: GalleryRect,
  override?: GalleryRect | null,
): GalleryRect {
  if (override && override.width > 0 && override.height > 0) return galleryRect(override);
  const translated = active.rect.current.translated;
  if (translated) return galleryRect(translated);
  const initial = active.rect.current.initial ?? fallbackRect;
  return {
    left: initial.left + delta.x,
    top: initial.top + delta.y,
    width: initial.width,
    height: initial.height,
  };
}

/**
 * 官方 `fQe(e, t, n, s)` @2945320 —— 一次拿到 `{sourceRect, screenCenter, pointer}`：
 * `sourceRect` 是**相对容器原点**的矩形，`screenCenter` 是**视口**坐标的中心，`pointer` 是容器坐标。
 */
export function galleryDragState(
  drag: GalleryDragEvent,
  fallbackRect: GalleryRect,
  container: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } },
  override?: GalleryRect | null,
): GalleryDragGeometry {
  const origin = galleryElementOrigin(container);
  const active = galleryActiveRect(drag.active, drag.delta, fallbackRect, override);
  return {
    sourceRect: {
      left: active.left - origin.left,
      top: active.top - origin.top,
      width: active.width,
      height: active.height,
    },
    screenCenter: { x: active.left + active.width / 2, y: active.top + active.height / 2 },
    pointer: galleryDragPointer(drag, fallbackRect, container),
  };
}

/**
 * 官方 `hQe(e, t, n, s)` @2945019 —— 拖拽浮层的携行几何。
 * `n` = 拾取点比率（`uQe`），`s` = 源几何 `zoom`（`sourceGeometry.zoom`）。
 */
export function galleryDragCarry(
  displaySize: GalleryMemberSize,
  screenRect: GalleryRect,
  grab: GalleryGrabPoint,
  sourceZoom: number,
): GalleryDragCarry {
  const originX = displaySize.width * grab.xRatio;
  const originY = displaySize.height * grab.yRatio;
  const targetX = screenRect.width * grab.xRatio;
  const targetY = screenRect.height * grab.yRatio;
  return {
    left: targetX - originX,
    top: targetY - originY,
    originX,
    originY,
    sourceScale: galleryFitScale(displaySize, screenRect),
    carryScale: Math.max(sourceZoom, Number.EPSILON),
  };
}

/**
 * 官方 `Px(e, t)` @2771512 —— `cover` 式适配：`min(t.w/e.w, t.h/e.h)`；
 * 任一边不是「有限正数」（官方 `b0`）时返回 `1`。
 */
export function galleryFitScale(
  source: GalleryMemberSize,
  target: GalleryMemberSize,
): number {
  if (
    !isPositiveFinite(source.width) ||
    !isPositiveFinite(source.height) ||
    !isPositiveFinite(target.width) ||
    !isPositiveFinite(target.height)
  ) {
    return 1;
  }
  return Math.min(target.width / source.width, target.height / source.height);
}

/** 官方 `b0(e)` @2771512 —— 有限且 > 0 的数字 */
function isPositiveFinite(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * 官方 `LG(e, t, n, s)` @2945xxx —— 把画廊布局里的成员映射成世界层变换：
 * `x/y` 是「目标中心在画廊画布上的位置 − 目标中心×zoom」，再整体除以 zoom。
 * `scale` = 适配比例 / zoom，`rotate` 原样透传。
 */
export function galleryLayoutTransform(
  source: { centerX: number; centerY: number; rotate: number },
  target: { centerX: number; centerY: number; width: number; height: number },
  transform: { x: number; y: number; zoom: number },
  displaySize: GalleryMemberSize,
): GalleryLayoutTransform {
  const zoom = Math.max(transform.zoom, Number.EPSILON);
  const targetX = transform.x + target.centerX * zoom;
  const targetY = transform.y + target.centerY * zoom;
  return {
    x: (source.centerX - targetX) / zoom,
    y: (source.centerY - targetY) / zoom,
    scale: galleryFitScale(displaySize, target) / zoom,
    rotate: source.rotate,
  };
}

/* ------------------------------------------------------------------ *
 * 行布局（vQe 家族）
 * ------------------------------------------------------------------ */

/** 官方 `bQe(e)` @2945320 —— 成员 → `{id, width, height}` */
export function galleryRowBox(member: GalleryMemberItem): GalleryBoxItem {
  return {
    id: member.node.id,
    width: member.displaySize.width,
    height: member.displaySize.height,
  };
}

/**
 * 官方 `yQe(e, t)` @2945320 —— 贪心换行：从左往右塞，超过 `t` 就另起一行。
 * 行高 = `ZM + max(成员高)`（`ZM` = 标签高度）。
 */
export function galleryRowLayout(items: readonly GalleryBoxItem[], maxWidth: number): GalleryRow[] {
  const rows: GalleryRow[] = [];
  for (const item of items) {
    const last = rows.at(-1);
    const width = last ? last.width + GALLERY_ROW_GAP + item.width : item.width;
    if (!last || width > maxWidth) {
      rows.push({ items: [item], width: item.width, height: GALLERY_ROW_LABEL_HEIGHT + item.height });
      continue;
    }
    last.items.push(item);
    last.width = width;
    last.height = Math.max(last.height, GALLERY_ROW_LABEL_HEIGHT + item.height);
  }
  return rows;
}

/**
 * 官方 `vQe(e)` @2945320 —— **画廊全屏层的画布布局**：
 * 所有成员按 `yQe` 换行，整块垂直居中、每行水平居中，原点在画布中心；
 * `canvasBounds` 再把四周外扩 `xu=112`。空列表时是一个 `±112` 的小方块。
 */
export function galleryRowCanvas(members: readonly GalleryMemberItem[]): GalleryRowCanvas {
  const rows = galleryRowLayout(members.map((member) => galleryRowBox(member)), GALLERY_ROW_MAX_WIDTH);
  if (rows.length === 0) {
    return {
      canvasBounds: {
        left: -GALLERY_ROW_PADDING,
        top: -GALLERY_ROW_PADDING,
        right: GALLERY_ROW_PADDING,
        bottom: GALLERY_ROW_PADDING,
      },
      items: [],
    };
  }
  const widest = Math.max(...rows.map((row) => row.width));
  const totalHeight =
    rows.reduce((sum, row) => sum + row.height, 0) + GALLERY_ROW_GAP * (rows.length - 1);
  const items: GalleryPlacedBox[] = [];
  let cursorY = -totalHeight / 2;
  for (const row of rows) {
    let cursorX = -row.width / 2;
    for (const item of row.items) {
      items.push({
        id: item.id,
        centerX: cursorX + item.width / 2,
        centerY: cursorY + GALLERY_ROW_LABEL_HEIGHT + item.height / 2,
        width: item.width,
        height: item.height,
      });
      cursorX += item.width + GALLERY_ROW_GAP;
    }
    cursorY += row.height + GALLERY_ROW_GAP;
  }
  const left = -widest / 2;
  const top = -totalHeight / 2;
  return {
    canvasBounds: {
      left: left - GALLERY_ROW_PADDING,
      top: top - GALLERY_ROW_PADDING,
      right: left + widest + GALLERY_ROW_PADDING,
      bottom: top + totalHeight + GALLERY_ROW_PADDING,
    },
    items,
  };
}

/* ------------------------------------------------------------------ *
 * 图片预载 / 媒体成员
 * ------------------------------------------------------------------ */

/**
 * 官方 `mQe(e)` @2945320 —— 预热所有**图片**来源。
 * 官方会 `new Image(); img.decoding="async"; img.src=s; img.decode().catch(…)` 并返回 `Image[]`；
 * 这里**只保留筛选逻辑**（非 image / 无 `displaySrc` 全部跳过，顺序不变），副作用交给调用方。
 */
export function galleryPreloadImageSources(
  members: readonly GalleryDisplayMember[],
): string[] {
  const sources: string[] = [];
  for (const member of members) {
    if (member.display.content.type !== 'image') continue;
    const src = member.display.content.displaySrc;
    if (!src) continue;
    sources.push(src);
  }
  return sources;
}

/**
 * 官方 `MQe(e)` @2952951 —— 为**媒体查看器**准备 `nodeId → 成员视图模型`。
 *
 * ```js
 * function MQe(e){
 *   const t=Qd.getState().nodeToFiles, n=new Map;
 *   for(const s of e){
 *     if(s.display.status.kind!=="ready")continue;
 *     const r=s.display.content.type==="image"?s.display.content.displaySrc:void 0,
 *           o=b8(s.node,{displaySrc:r,mode:"view",registeredFileIds:t[s.node.id]});
 *     o&&n.set(s.node.id,o)
 *   }
 *   return n
 * }
 * ```
 * ⚠️ 官方的 `b8`（`mediaViewerMember`）是一个**跨模块的大构造函数**（读 `node.data`/`measured`/
 * 资源与动作表，见官方 @583457），不属于纯几何，**未移植**；本函数把它作为注入回调 `buildMember`
 * 保留下来，其余流程（过滤 `status.kind === "ready"`、只有 image 才给 `displaySrc`、
 * `registeredFileIds` 按 `nodeToFiles[node.id]` 取、结果非空才 `set`）逐字保留。
 * `nodeToFiles` 就是官方 `Qd` store 的 `nodeToFiles` 字段（@417024）。
 */
export function galleryViewerMembers<T>(
  members: readonly GalleryDisplayMember[],
  nodeToFiles: Readonly<Record<string, readonly string[] | undefined>>,
  buildMember: (
    node: GalleryDisplayMember['node'],
    options: {
      displaySrc: string | undefined;
      mode: 'view';
      registeredFileIds: readonly string[] | undefined;
    },
  ) => T | null,
): Map<string, T> {
  const out = new Map<string, T>();
  for (const member of members) {
    if (member.display.status.kind !== 'ready') continue;
    const displaySrc =
      member.display.content.type === 'image' ? member.display.content.displaySrc : undefined;
    const built = buildMember(member.node, {
      displaySrc,
      mode: 'view',
      registeredFileIds: nodeToFiles[member.node.id],
    });
    if (built) out.set(member.node.id, built);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 交接成员筛选
 * ------------------------------------------------------------------ */

/**
 * 官方 `wJ(e, t)` @2945459 —— 按 `t`（id 顺序）从 `e` 里挑出成员。
 * `t` 里出现但 `e` 里没有的 id 直接跳过；`e` 里多出来的不参与。
 */
export function galleryMemberOrder<T extends GalleryMemberRef>(
  members: readonly T[],
  ids: readonly string[],
): T[] {
  const byId = new Map(members.map((member) => [member.node.id, member] as const));
  const out: T[] = [];
  for (const id of ids) {
    const found = byId.get(id);
    if (found) out.push(found);
  }
  return out;
}

/**
 * 官方 `BQe(e, t, n)` @2945459 —— 交接阶段的成员集合：
 * `plan.kind` 是 `canvas`/`pile` ⇒ 按 `plan.finalPileMemberIds` 重排；
 * 否则正在拖某个成员 `t` ⇒ 把它剔掉；否则原样。
 */
export function galleryHandoffMembers<T extends GalleryMemberRef>(
  members: readonly T[],
  dragMemberId: string | null,
  plan: GalleryHandoffPlan | null | undefined,
): readonly T[] {
  if (plan?.kind === 'canvas' || plan?.kind === 'pile') {
    return galleryMemberOrder(members, plan.finalPileMemberIds);
  }
  if (dragMemberId) return members.filter((member) => member.node.id !== dragMemberId);
  return members;
}

/* ------------------------------------------------------------------ *
 * 相位判定 / 时长
 * ------------------------------------------------------------------ */

/** 官方 `jQe(e)` @2945459 —— 当前「正在交出的成员 id」（拖拽中要等塌缩才给，交接中 slot 不给） */
export function galleryCollapseMemberId(state: GalleryDragOrHandoff | null): string | null {
  if (!state) return null;
  if (state.phase === 'dragging') return state.isCollapsing ? state.memberId : null;
  return state.plan.kind === 'slot' ? null : state.plan.memberId;
}

/**
 * 官方 `LQe(e)` @2945320 —— 拖拽相位标签：
 * `dragging` / 计划是 `canvas`（落回画布）=`landing` / 其它=`returning` / 无拖拽=`idle`。
 */
export function galleryDragPhaseLabel(state: GalleryDragOrHandoff | null): string {
  if (!state) return 'idle';
  if (state.phase === 'dragging') return 'dragging';
  return state.plan.kind === 'canvas' ? 'landing' : 'returning';
}

/** 官方 `zQe(e, t)` @2945459 —— 是否处于「可以开媒体预览」的静默态 */
export function galleryCanTogglePreview(phase: GalleryPhase, state: GalleryDragOrHandoff | null): boolean {
  return phase === 'open' && state === null;
}

/**
 * 官方 `VQe(e)` @2945459 —— 内容类型对应的**拖拽交接**时长（音频 `.14`、视频 `.12`、其它 `0`）。
 */
export function galleryContentHandoffSeconds(content: GalleryContentLike): number {
  const preview = GALLERY_MEDIA_PREVIEW;
  if (content.type === 'audio') return preview.dragAudioHandoffDurationSeconds;
  if (content.type === 'video') return preview.dragVideoHandoffDurationSeconds;
  return 0;
}

/**
 * 官方 `GQe(e, t)` @2945459 —— 背景遮罩时长：减少动态 ⇒ `0`；
 * 拖拽塌缩 ⇒ `.18`；否则标准 `.22`。
 */
export function galleryBackdropDurationSeconds(collapsing: boolean, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return collapsing
    ? GALLERY_BACKDROP.dragCollapseDurationSeconds
    : GALLERY_BACKDROP.standardDurationSeconds;
}

/**
 * 官方 `HQe(e, t)` @2945459 —— 顶栏（chrome）进场延迟：
 * 减少动态 ⇒ `0`；`opening` ⇒ `.07`；`closing` ⇒ `.28`；其它 `0`。
 */
export function galleryChromeDelaySeconds(phase: GalleryPhase, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const openClose = GALLERY_OPEN_CLOSE;
  if (phase === 'opening') return openClose.chromeExitLeadSeconds;
  if (phase === 'closing') return openClose.chromeReturnDelaySeconds;
  return 0;
}

/**
 * 官方 `UQe(e, t, n, s, r)` @2945459 —— 成员的目标变换：
 * 塌缩/交接 ⇒ `s`（最终布局），`closing` ⇒ `n`（初始布局），否则 ⇒ `r`（静止）。
 */
export function galleryCollapseTargetTransform<T>(
  phase: GalleryPhase,
  collapsingOrHandoff: boolean,
  initialTransform: T,
  finalTransform: T,
  restTransform: T,
): T {
  if (collapsingOrHandoff) return finalTransform;
  if (phase === 'closing') return initialTransform;
  return restTransform;
}

/** 官方 `DQe(e, t, n, s)` @2945406 —— 深度阴影不透明度：塌缩 ⇒ `s`，`closing` ⇒ `n`，否则 `0` */
export function galleryDepthShadeOpacity(
  phase: GalleryPhase,
  collapsingOrHandoff: boolean,
  handoffOpacity: number,
  restOpacity: number,
): number {
  if (collapsingOrHandoff) return restOpacity;
  return phase === 'closing' ? handoffOpacity : 0;
}

/** 官方 `FQe(e, t, n)` @2945406 —— **初始**深度阴影：减少动态 ⇒ `false`（不动画），`opening` ⇒ `n`，否则 `0` */
export function galleryInitialDepthShadeOpacity(
  phase: GalleryPhase,
  reducedMotion: boolean,
  depth: number,
): number | false {
  if (reducedMotion) return false;
  return phase === 'opening' ? depth : 0;
}

/**
 * 官方 `OQe(e, t, n)` @2945406 —— 标签浮现延迟：减少动态或非 `opening` ⇒ `0`；
 * 否则 `.32 + min(index, maxStaggerItems-1) * .012`。
 */
export function galleryLabelDelaySeconds(
  phase: GalleryPhase,
  index: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || phase !== 'opening') return 0;
  const openClose = GALLERY_OPEN_CLOSE;
  const stagger = Math.min(index, openClose.maxStaggerItems - 1);
  return openClose.labelRevealDelaySeconds + stagger * openClose.staggerStepSeconds;
}

/**
 * 官方 `PQe(e, t, n, s, r)` @2945406 —— 成员入场/退场过渡：
 * ① 减少动态 ⇒ 只有 `{duration: 0}`（framer-motion 会把它当整体过渡）；
 * ② 塌缩 ⇒ 官方 `NQe`（`collapse`）；③ 否则按 `openClose` 逐层错开，
 *    `closing` 时索引用 `count - index - 1`（**从后往前**），旋转再额外延后 `.18`。
 */
export function galleryMemberTransition(
  phase: GalleryPhase,
  collapsing: boolean,
  reducedMotion: boolean,
  index: number,
  count: number,
): GalleryMemberTransition | { duration: number; ease?: readonly number[] } {
  if (reducedMotion) return { duration: 0 };
  if (collapsing) {
    return { duration: GALLERY_COLLAPSE.durationSeconds, ease: GALLERY_COLLAPSE.ease };
  }
  const openClose = GALLERY_OPEN_CLOSE;
  const order = phase === 'closing' ? count - index - 1 : index;
  const delay =
    Math.min(Math.max(order, 0), openClose.maxStaggerItems - 1) * openClose.staggerStepSeconds;
  const base: GalleryTransitionSpec = {
    duration: openClose.durationSeconds,
    delay,
    ease: openClose.ease,
  };
  const rotationDelay = delay + (phase === 'closing' ? openClose.closingRotationDelaySeconds : 0);
  return {
    x: base,
    y: base,
    scale: base,
    opacity:
      phase === 'closing'
        ? {
            duration: openClose.durationSeconds - openClose.closingRotationDelaySeconds,
            delay: rotationDelay,
            ease: openClose.ease,
          }
        : base,
    rotate: {
      duration: openClose.rotationDurationSeconds,
      delay: rotationDelay,
      ease: phase === 'closing' ? openClose.ease : openClose.rotationEase,
    },
  };
}

/* ------------------------------------------------------------------ *
 * 交接计时的辅助（dJ / NZe / TZe）
 * ------------------------------------------------------------------ */

/** 官方 `dJ(e)` @2924739 —— `min(max(index,0), maxStaggerItems-1) * .018`（堆叠入场逐层延迟） */
export function stackEntryStepSeconds(index: number): number {
  const entry = STACK_ENTRY;
  return Math.min(Math.max(index, 0), entry.maxStaggerItems - 1) * entry.staggerStepSeconds;
}

/**
 * 官方 `NZe(e)` @2924849 —— `dJ(index) + max(movement .46, rotationDelay .16 + rotation .28)`
 * （即 `dJ(index) + .46`）。
 */
export function stackEntrySeconds(index: number): number {
  const entry = STACK_ENTRY;
  const tail = Math.max(
    entry.movementDurationSeconds,
    entry.rotationDelaySeconds + entry.rotationDurationSeconds,
  );
  return stackEntryStepSeconds(index) + tail;
}

/**
 * 官方 `TZe(e)` @2924556 —— 「谁在接管」的动画时长：
 * `canvas` ⇒ `.18 + .2`；`pile` ⇒ `NZe(0)`；其它 ⇒ 画廊拖拽拾起 `.32`。
 */
export function handoffSeconds(kind: string): number {
  const landing = GALLERY_HANDOFF.canvasLanding;
  if (kind === 'canvas') {
    return landing.movementDurationSeconds + landing.contentHandoffDurationSeconds;
  }
  if (kind === 'pile') return stackEntrySeconds(0);
  return GALLERY_DRAG.pickupDurationSeconds;
}

/**
 * 官方 `IZe(e)` @2925579 —— 交接完成后的延迟（毫秒）：
 * `max(slot ? 0 : openClose.durationSeconds, TZe(kind)) + completionBufferSeconds`，四舍五入到 ms。
 */
export function handoffDelayMs(kind: string): number {
  const duration = kind === 'slot' ? 0 : GALLERY_OPEN_CLOSE.durationSeconds;
  const seconds = Math.max(duration, handoffSeconds(kind)) + GALLERY_HANDOFF.completionBufferSeconds;
  return Math.round(seconds * 1e3);
}

/** 官方 `kZe()` @2925482 —— 落回画布的时长（毫秒）：`round(.18 * 1000) = 180` */
export function canvasLandingMs(): number {
  return Math.round(GALLERY_HANDOFF.canvasLanding.movementDurationSeconds * 1e3);
}

/**
 * 官方 `RZe(e)` @2925738 —— 关闭时的整体延迟（毫秒）：
 * `durationSeconds + min(max(count-1,0), maxStaggerItems-1) * staggerStepSeconds`，四舍五入到 ms。
 */
export function closeDelayMs(count: number): number {
  const openClose = GALLERY_OPEN_CLOSE;
  const last = Math.max(count - 1, 0);
  const stagger = Math.min(last, openClose.maxStaggerItems - 1);
  const seconds = openClose.durationSeconds + stagger * openClose.staggerStepSeconds;
  return Math.round(seconds * 1e3);
}

/* ------------------------------------------------------------------ *
 * EQe —— 视口/相机 hook 的**纯几何**部分
 * ------------------------------------------------------------------ */

/**
 * 官方 `EQe` 内部 `f(camera)`（@2949487）+ 它 `useMemo` 出来的 `worldStyle` @295xxxx：
 * 只保留纯计算，`worldRef.current.style.transform=…` / `setProperty(…)` 由调用方执行。
 *
 * ```js
 * const T = _0(E, t);                       // = galleryWorldTransform
 * N.style.transform = `translate3d(${T.x}px, ${T.y}px, 0) scale(${T.zoom})`;
 * const k = zG(E.zoom);                     // = galleryReadableScale
 * N.style.setProperty("--pile-gallery-readable-scale", String(k.scale));
 * N.style.setProperty("--pile-gallery-readable-width", k.width);
 * ```
 * 官方只在 `zoom` 变化时才写那两条 CSS 变量（`c.current !== E.zoom`）；`Zoom` 是否变化由调用方比对。
 */
export function galleryWorldStyle(
  camera: GalleryViewportState,
  viewportSize: { width: number; height: number },
): GalleryWorldStyle {
  const transform = galleryWorldTransform(camera, viewportSize);
  const readable = galleryReadableScale(camera.zoom);
  return {
    transformOrigin: '0 0',
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.zoom})`,
    readableScale: readable.scale,
    readableWidth: readable.width,
  };
}

/** 官方 `EQe` 内部 `f` 的「CSS 变量是否需要重写」判据：`c.current !== E.zoom` */
export function galleryReadableScaleChanged(
  lastAppliedZoom: number | null,
  nextZoom: number,
): boolean {
  return lastAppliedZoom !== nextZoom;
}

/**
 * 官方 `EQe` 内部 `m(nextZoom, point)` @2949487 —— **以某点为锚**缩放：
 * 先把锚点换成相机坐标，夹到 `kd` 区间后，再让锚点在屏幕上保持不动。
 */
export function galleryZoomAboutPoint(
  camera: GalleryViewportState,
  nextZoom: number,
  point: { x: number; y: number },
  bounds: GalleryRect,
  viewportSize: { width: number; height: number },
): GalleryViewportState {
  const halfWidth = viewportSize.width / 2;
  const halfHeight = viewportSize.height / 2;
  const anchorX = camera.centerX + (point.x - halfWidth) / camera.zoom;
  const anchorY = camera.centerY + (point.y - halfHeight) / camera.zoom;
  const zoom = clampGalleryZoom(nextZoom);
  return clampGalleryViewport(
    {
      centerX: anchorX - (point.x - halfWidth) / zoom,
      centerY: anchorY - (point.y - halfHeight) / zoom,
      zoom,
    },
    bounds,
  );
}

/**
 * 官方 `EQe` 内部 `g(item)` @2949487 —— 画廊空间里的成员 → **portal 视口**里的屏幕矩形
 * （`portalOrigin` 就是官方那次 `s.getBoundingClientRect()` 的 `left/top`，宽高为 0 时取 0）。
 */
export function galleryItemScreenRect(
  item: { centerX: number; centerY: number; width: number; height: number },
  portalOrigin: GalleryOrigin,
  transform: { x: number; y: number; zoom: number },
): GalleryRect {
  return {
    left: portalOrigin.left + transform.x + (item.centerX - item.width / 2) * transform.zoom,
    top: portalOrigin.top + transform.y + (item.centerY - item.height / 2) * transform.zoom,
    width: item.width * transform.zoom,
    height: item.height * transform.zoom,
  };
}

/** 官方 `EQe` 内部 `v(E)` 的 `hasMoved` 判据：`|dx| + |dy| > 3` */
export function galleryPanHasMoved(
  start: { clientX: number; clientY: number },
  current: { clientX: number; clientY: number },
): boolean {
  return (
    Math.abs(current.clientX - start.clientX) + Math.abs(current.clientY - start.clientY) >
    GALLERY_PAN_MOVE_THRESHOLD
  );
}

/**
 * 官方 `EQe` 内部 `v(E)` @2949487 —— 指针平移：位移除以**按下时的** `camera.zoom`，
 * 再夹取（`qb`）。平移不改变 zoom。
 */
export function galleryPanCamera(
  camera: GalleryViewportState,
  delta: { x: number; y: number },
  bounds: GalleryRect,
): GalleryViewportState {
  return clampGalleryViewport(
    {
      centerX: camera.centerX - delta.x / camera.zoom,
      centerY: camera.centerY - delta.y / camera.zoom,
      zoom: clampGalleryZoom(camera.zoom),
    },
    bounds,
  );
}

/**
 * 官方 `EQe` 内部 `x(E)` @2949487 —— 滚轮：
 * ① `ctrlKey`（触控板捏合 / 浏览器把捏合当 ctrl+wheel）⇒ 以指针为锚缩放：
 *    步长 `deltaMode===1 ? .05 : deltaMode ? 1 : .002`，Mac(`nU()`) 再 `×10`，
 *    倍率 `2 ** (-deltaY * 步长 * 系数)`；
 * ② 否则按 `SQe` 归一后的 delta 平移，倍率是官方 `jG = 1.2`。
 *
 * `isMac` 对应官方 `nU()`（= `index-BiTZf8mJ.js` 导出 `tR` → 本地 `l_a`，即 `/Mac|Macintosh/i.test(ua)`），
 * 这里作为参数传入以免触碰 `navigator`。
 */
export function galleryWheelCamera(
  event: GalleryWheelEventLike,
  camera: GalleryViewportState,
  bounds: GalleryRect,
  viewportSize: { width: number; height: number },
  portalOrigin: GalleryOrigin,
  isMac: boolean,
): GalleryViewportState {
  if (event.ctrlKey) {
    const step = event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002;
    const multiplier = isMac ? 10 : 1;
    const ratio = 2 ** (-event.deltaY * step * multiplier);
    return galleryZoomAboutPoint(
      camera,
      camera.zoom * ratio,
      { x: event.clientX - portalOrigin.left, y: event.clientY - portalOrigin.top },
      bounds,
      viewportSize,
    );
  }
  // 官方 `SQe` 里的 `!nU()`：**Mac 上 shift 不换轴**（`nU()` = `l_a` = isMac）
  const delta = normalizeWheelDelta(
    { ...event, shiftKey: event.shiftKey === true && !isMac },
    viewportSize,
  );
  return clampGalleryViewport(
    {
      centerX: camera.centerX + (delta.x * GALLERY_WHEEL_PAGE) / camera.zoom,
      centerY: camera.centerY + (delta.y * GALLERY_WHEEL_PAGE) / camera.zoom,
      zoom: clampGalleryZoom(camera.zoom),
    },
    bounds,
  );
}

/**
 * 官方 `EQe` 的初值（`useRef(VG(e, n))` + 首次 `useLayoutEffect`）：
 * 首次永远是 `VG(canvasBounds, initialZoom)`（居中），之后每次 bounds 变化走 `qb(currentCamera, bounds)`
 * （官方用一个 `p.current` 布尔记住「已经跑过一次」）。
 * 直接复用 `officialPileGallery.ts` 的两个官方实现，这里只把「第几次」表达清楚。
 */
export function galleryCameraForBounds(
  canvasBounds: GalleryRect,
  initialZoom: number,
  currentCamera: GalleryViewportState | null,
): GalleryViewportState {
  return currentCamera
    ? clampGalleryViewport({ ...currentCamera, zoom: clampGalleryZoom(currentCamera.zoom) }, canvasBounds)
    : galleryInitialViewport(canvasBounds, initialZoom);
}
