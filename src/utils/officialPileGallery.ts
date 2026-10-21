/**
 * officialPileGallery —— 官方 **PILE 画廊（全屏层）** 的几何层，逐字移植。
 *
 * 官方出处：`zoom-slider-3ZcFvYQO.js`
 *   @2947232 `vJ(members, g)`   —— 把成员按**同一套 `fO` 叠放数学**摆到画廊空间
 *   @2947xxx `xQe(rect)`        —— 旋转矩形的轴对齐包围盒
 *   @2947xxx `wQe(members,m,t)` —— 全部成员的包围盒并集
 *   @2947xxx `Fk(members, t)`   —— `{members: vJ(...), bounds: wQe(...)}`
 *   @2948315 `CQe({members,pileRect,portalRect,canvasZoom,previewExpansion})`
 *   @2949391 `_0(state, viewportSize)` —— 世界层变换 `translate3d + scale`
 *   @2948315 `zG(zoom)`         —— 可读性缩放 `{scale: 1/zoom, width: 100/(1/zoom)%}`
 *   @2949950 `qb` / `VG`        —— 视口夹取（zoom 上下限 = 官方 `kd = {min:.15, max:2}` @1066000）
 *   @2948xxx `SQe(event, rect)` —— 滚轮 delta（含 DOM_DELTA_LINE/PAGE 换算）
 *   @2952951 `kQe(rect, el)`    —— 元素内几何
 *   @2952951 `RQe` / `IQe`      —— 相邻项的位移与过渡
 */
import { pileStackPlacement, PILE_FAN_GAP } from './officialPile';

export interface GalleryRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GalleryMemberSize {
  width: number;
  height: number;
}

export interface GallerySourceGeometry {
  /** 堆叠节点在 portal 坐标系里的中心 X */
  centerX: number;
  /** 同上，Y */
  centerY: number;
  /** 画布 zoom */
  zoom: number;
  /** 官方 `wC(mode)` 的展开倍数 */
  previewExpansion: number;
}

export interface GalleryItem {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotate: number;
  zIndex: number;
}

export interface GalleryViewportState {
  centerX: number;
  centerY: number;
  zoom: number;
}

/** 官方 `xJ = 60` —— 画廊根节点的 z-index（**逐字照抄，不抬高**）。
 *
 * ⚠️ 记账（**已按用户决定回到源码口径**）：MTV 的弹窗层散在 `z-70/80`（素材库）、`199/200`（AI 角色库）、
 *    `10000+`（设置 / 裁剪 / 提示词浮层）⇒ 素材库弹窗开着时进堆叠全屏，**弹窗会盖在画廊之上**。
 *    官方源码就是这个口径：画廊 `60`、素材库弹窗内容 `z-[70]`（`SaveToLibraryDialog.tsx` 里那段
 *    官方类名逐字含 `z-[70]`），两边各自 portal ⇒ `70 > 60`。
 *    ⇒ 这里**不做 MTV 侧抬高**（曾经试过 `100000`，属于按口述臆造，已撤销）。 */
export const PILE_GALLERY_Z_INDEX = 60;
/** 官方 `jG = 1.2`、`BG = 20` —— 滚轮换算用的行高/页高倍率 */
export const GALLERY_WHEEL_LINE = 20;
export const GALLERY_WHEEL_PAGE = 1.2;
/** 官方 `cQe = 72` —— 判定「拖拽而不是点击」的位移平方阈值（`dQe`） */
export const PILE_GALLERY_DRAG_THRESHOLD = 72;
/** 官方 `ms.gallery.mediaViewer.surroundingItemsDistancePixels = 56` */
export const GALLERY_SURROUNDING_DISTANCE = 56;

/** 官方 `_l(e)` —— 只取最后 5 个（`officialPile.ts` 同一份语义） */
function lastFive<T>(items: readonly T[]): T[] {
  return items.slice(-5);
}

/**
 * 官方 `vJ(e, t)` @2947232 —— **画廊里的成员摆位**。
 *
 * ```js
 * function vJ(e,t){
 *   const n=_l(e), s=n[0]?.displaySize??null, r=Math.max(t.zoom,Number.EPSILON), o=new Map;
 *   for(const i of e){
 *     const a=i.node.id, c=n.findIndex(u=>u.node.id===a),
 *       d=fO({memberSize:i.displaySize, coverSize:s, visibleIndex:c,
 *             visibleCount:n.length, expansion:t.previewExpansion});
 *     o.set(a,{ centerX:t.centerX + d.x*r, centerY:t.centerY + d.y*r,
 *               width: i.displaySize.width*d.scale*r,
 *               height: i.displaySize.height*d.scale*r,
 *               rotate: d.rotate, zIndex: d.zIndex });}
 *   return o}
 * ```
 * ⇒ 与节点内那一摞**同一个 `fO`**（`visibleIndex`/`visibleCount`/`expansion`/`coverSize` 全同），
 *   只是 `x/y` 与 `width/height` 再乘一次画布 `zoom`，中心换成堆叠节点在 portal 里的屏幕中心。
 */
export function gallerySourceLayout(
  members: ReadonlyArray<{ id: string; displaySize: GalleryMemberSize }>,
  geometry: GallerySourceGeometry,
): Map<string, GalleryItem> {
  const visible = lastFive(members);
  const cover = visible[0]?.displaySize ?? null;
  const zoom = Math.max(geometry.zoom, Number.EPSILON);
  const out = new Map<string, GalleryItem>();
  for (const member of members) {
    const index = visible.findIndex((entry) => entry.id === member.id);
    const placement = pileStackPlacement({
      memberSize: member.displaySize,
      coverSize: cover,
      visibleIndex: index,
      visibleCount: visible.length,
      expansion: geometry.previewExpansion,
    });
    out.set(member.id, {
      centerX: geometry.centerX + placement.x * zoom,
      centerY: geometry.centerY + placement.y * zoom,
      width: member.displaySize.width * placement.scale * zoom,
      height: member.displaySize.height * placement.scale * zoom,
      rotate: placement.rotate,
      zIndex: placement.zIndex,
    });
  }
  return out;
}

/** 官方 `xQe(e)` —— 旋转矩形的轴对齐包围盒 */
export function rotatedBounds(rect: GalleryItem): GalleryRect {
  const rad = (rect.rotate * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const width = rect.width * cos + rect.height * sin;
  const height = rect.width * sin + rect.height * cos;
  return {
    left: rect.centerX - width / 2,
    top: rect.centerY - height / 2,
    width,
    height,
  };
}

/** 官方 `wQe(e, t, n)` —— 包围盒并集 */
export function galleryBounds(
  members: ReadonlyArray<{ id: string }>,
  layout: ReadonlyMap<string, GalleryItem>,
  geometry: GallerySourceGeometry,
): GalleryRect {
  const visible = lastFive(members);
  const boxes = visible.flatMap((member) => {
    const item = layout.get(member.id);
    return item ? [rotatedBounds(item)] : [];
  });
  if (boxes.length === 0) {
    return { left: geometry.centerX, top: geometry.centerY, width: 1, height: 1 };
  }
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
}

/** 官方 `Fk(e, t)` —— 一次拿 `{members, bounds}` */
export function galleryLayout(
  members: ReadonlyArray<{ id: string; displaySize: GalleryMemberSize }>,
  geometry: GallerySourceGeometry,
): { members: Map<string, GalleryItem>; bounds: GalleryRect } {
  const layout = gallerySourceLayout(members, geometry);
  return { members: layout, bounds: galleryBounds(members, layout, geometry) };
}

/**
 * 官方 `CQe({members, pileRect, portalRect, canvasZoom, previewExpansion})` @2948315
 * —— 由**堆叠节点的屏幕矩形**算出源几何。
 */
export function gallerySourceGeometryOf(input: {
  pileRect: GalleryRect;
  portalRect: GalleryRect;
  canvasZoom: number;
  previewExpansion: number;
}): GallerySourceGeometry {
  return {
    centerX: input.pileRect.left - input.portalRect.left + input.pileRect.width / 2,
    centerY: input.pileRect.top - input.portalRect.top + input.pileRect.height / 2,
    zoom: Math.max(input.canvasZoom, Number.EPSILON),
    previewExpansion: input.previewExpansion,
  };
}

/** 官方 `_0(e, t)` @2949391 —— **世界层变换**（`t` = 视口尺寸） */
export function galleryWorldTransform(
  state: GalleryViewportState,
  viewport: { width: number; height: number },
): { x: number; y: number; zoom: number } {
  return {
    x: viewport.width / 2 - state.centerX * state.zoom,
    y: viewport.height / 2 - state.centerY * state.zoom,
    zoom: state.zoom,
  };
}

/** 官方 `zG(e)` @2948315 —— 可读性缩放（让节点内文字不随画廊缩放变大/变小） */
export function galleryReadableScale(zoom: number): { scale: number; width: string } {
  const safe = Math.max(zoom, Number.EPSILON);
  const scale = Math.max(1, 1 / safe);
  return { scale, width: `${100 / scale}%` };
}

/**
 * 官方 `qb(e, t)` / `VG(e, t)` —— 视口夹取。
 * 官方逐字（zoom-slider-3ZcFvYQO.js @2949950）：
 *   `function qb(e,t){return{centerX:Math.min(Math.max(e.centerX,t.left),t.right),
 *                            centerY:Math.min(Math.max(e.centerY,t.top),t.bottom),
 *                            zoom:Math.min(Math.max(e.zoom,kd.min),kd.max)}}`
 * 其中 `kd={min:.15,max:2}`（同文件 @1066000 `…,kd={min:.15,max:2},Aat={min:.7,max:1.3},…`）✓
 * ⚠️ MTV 早前用占位值 `min:.05 / max:8`（当时 `kd` 未抽到）⇒ 已换成官方值 ✓
 */
export const PILE_GALLERY_ZOOM_MIN = 0.15;
export const PILE_GALLERY_ZOOM_MAX = 2;

export function clampGalleryViewport(
  state: GalleryViewportState,
  bounds: GalleryRect,
): GalleryViewportState {
  return {
    centerX: Math.min(Math.max(state.centerX, bounds.left), bounds.left + bounds.width),
    centerY: Math.min(Math.max(state.centerY, bounds.top), bounds.top + bounds.height),
    zoom: Math.min(Math.max(state.zoom, PILE_GALLERY_ZOOM_MIN), PILE_GALLERY_ZOOM_MAX),
  };
}

/** 官方 `VG(e, t)` —— 以包围盒中心为初始视口
 *  ⚠️ 官方逐字：`{centerX:(e.left+e.right)/2, centerY:(e.top+e.bottom)/2, zoom:t}`
 *     （zoom-slider-3ZcFvYQO.js @2950000 `function VG(e,t){return qb({centerX:(e.left+e.right)/2,…`）
 *     MTV 曾写成 `(left+left+width)/2`（数学等价但浮点结合律不同 ⇒ 与官方差 1 ULP）⇒ 已修 ✓ */
export function galleryInitialViewport(bounds: GalleryRect, zoom: number): GalleryViewportState {
  /* ⚠️ 必须写 `left + (left + width)`（先算 right 再加 left），不能写 `(left + left + width)`
     —— 浮点结合律不同，会与官方差 1 ULP（已实测）。官方 `right` 就是上游 `left + width` ✓ */
  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;
  return clampGalleryViewport(
    {
      centerX: (bounds.left + right) / 2,
      centerY: (bounds.top + bottom) / 2,
      zoom,
    },
    bounds,
  );
}

/** 官方 `SQe(e, t)` @2948xxx —— 滚轮 delta 归一（行/页 → 像素） */
export function normalizeWheelDelta(
  event: { deltaX: number; deltaY: number; deltaMode: number; shiftKey?: boolean },
  viewport: { width: number; height: number },
): { x: number; y: number } {
  let x = Number.isFinite(event.deltaX) ? event.deltaX : 0;
  let y = Number.isFinite(event.deltaY) ? event.deltaY : 0;
  if (event.shiftKey) {
    x = y;
    y = 0;
  }
  if (event.deltaMode === 1) {
    x *= GALLERY_WHEEL_LINE;
    y *= GALLERY_WHEEL_LINE;
  } else if (event.deltaMode === 2) {
    x *= viewport.width;
    y *= viewport.height;
  }
  return { x, y };
}

/** 官方 `kQe(e, t)` @2952951 —— 某个 DOM 矩形在元素坐标系里的几何 */
export function galleryDomGeometry(rect: GalleryRect, element: { getBoundingClientRect(): DOMRect }): GalleryItem {
  const box = element.getBoundingClientRect();
  const left = box.width ? box.left : 0;
  const top = box.height ? box.top : 0;
  return {
    centerX: rect.left - left + rect.width / 2,
    centerY: rect.top - top + rect.height / 2,
    width: rect.width,
    height: rect.height,
    rotate: 0,
    zIndex: 30,
  };
}

/** 官方 `dQe(e)` @2952951 —— 是否超过「拖拽」阈值 */
export function isGalleryDrag(offset: { x: number; y: number }): boolean {
  return offset.x * offset.x + offset.y * offset.y >= PILE_GALLERY_DRAG_THRESHOLD ** 2;
}

/**
 * 官方 `RQe(e, t, n, s)` @2952951 —— **相邻项**从焦点向外推开 `56px`。
 * `n` = 是否有焦点项，`s` = 是否正在拖拽（拖拽时不推开）。
 */
export function gallerySurroundingOffset(
  source: { centerX: number; centerY: number },
  focus: { centerX: number; centerY: number } | null,
  hasFocus: boolean,
  dragging: boolean,
  distance: number = GALLERY_SURROUNDING_DISTANCE,
): { x: number; y: number } {
  if (!hasFocus || dragging || !focus) return { x: 0, y: 0 };
  const dx = source.centerX - focus.centerX;
  const dy = source.centerY - focus.centerY;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return { x: source.centerX < focus.centerX ? -distance : distance, y: 0 };
  }
  return { x: (dx / length) * distance, y: (dy / length) * distance };
}

/** 官方 `ms.gallery.mediaViewer`（逐字）：相邻项过渡时长/缓动 */
export const GALLERY_SURROUNDING_DURATION_S = 0.38;
export const GALLERY_SURROUNDING_EASE = [0.65, 0, 0.35, 1] as const;
export const GALLERY_SHARED_MEDIA_DURATION_S = 0.44;

/** 官方 `IQe(e, t)` @2952951 —— 相邻项的过渡（关闭相位要减去共享媒体的时长） */
export function gallerySurroundingTransition(
  phase: string | undefined,
  reduced: boolean,
): { duration: number; delay: number; ease: readonly number[] } {
  const closing = phase === 'closing'
    ? Math.max(GALLERY_SHARED_MEDIA_DURATION_S - GALLERY_SURROUNDING_DURATION_S, 0)
    : 0;
  return {
    duration: reduced ? 0 : GALLERY_SURROUNDING_DURATION_S,
    delay: reduced ? 0 : closing,
    ease: GALLERY_SURROUNDING_EASE,
  };
}

/** 官方画廊没有用到 `PILE_FAN_GAP`，但成员尺寸计算共用同一套常量，导出以备核对 */
export const GALLERY_FAN_GAP = PILE_FAN_GAP;
