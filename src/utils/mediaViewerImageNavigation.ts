/**
 * mediaViewerImageNavigation —— 官方媒体查看器「图片检视层」的纯几何/数值（逐字）
 *
 * 官方出处：`course-api-base-url-CGXqZmAy.js`
 *   · `Bt` @482900 → `const Bt = (e,t,n) => Math.max(t, Math.min(e,n))`（clamp）
 *   · 常量 @482951 → `iD = 5`（**最大缩放**）、`K2 = 80`（滚轮 delta 限幅）、`ove = .0015`（滚轮灵敏度）、
 *     `ive = .01`（捏合灵敏度）；@484241 → `X2 = {zoom:1,panX:0,panY:0}`、`dve = 16`（行高换算）、
 *     `uve = 180`（缩到最小后延时回预览）、`hve = 4`（拖动判定阈值）、`pve = 400`（拖动后不吃点击的窗口）
 *   · `ave(previewRect, inspectRect)` @482980 → `{minZoom, fitOffsetX, fitOffsetY, fitWidth, fitHeight}`
 *   · `jf(basis)` @483249 = 贴合预览（`{zoom:minZoom,panX:0,panY:0}`）
 *   · `lve()` @483301 = **检视目标**（`{zoom:1,panX:0,panY:0}` = 自然像素 1:1）
 *   · `eC(view)` @483345 = `view.zoom > 1`
 *   · `of(view, basis)` @483376（夹到 `[minZoom, iD]`，并按 fit 尺寸夹住平移）
 *   · `$$(view, basis)` @483568（→ CSS `{scale, x, y}`）
 *   · `q2(zoom, delta, kind, minZoom)` @483793（→ 下一档 zoom）
 *   · `Y2(view, nextZoom, point, basis)` @483911（以指针为锚点缩放）
 *   · `cve(view, delta, basis)` @484155（平移）
 *   · `gve(event, viewportHeight)` @484409（`deltaMode` → 像素）
 *   · `bve(mode)` @484493（过渡串：`to-contain` = `On.sharedMedia` .44s；`to-preview` = `On.imageReset` .28s）
 *   · `W2(container, media)` @476032（contain 居中）
 *   · `tve()` @478940（检视容器 = **视口四周内缩 `Qye = 24`**）
 *
 * 坐标系约定：`previewRect` / `inspectRect` 都在**视口坐标**下（与官方 `nve` 的
 * `navigationPreviewRect` / `navigationInspectRect` 同源），`ave` 只关心两者的相对关系。
 */
import { MEDIA_VIEWER_MOTION } from '../components/nodes/shared/media/mediaViewerMotion';

export interface NavRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface NavSize {
  width: number;
  height: number;
}

/** 官方 `X2`：默认视图（`zoom` = 相对**预览贴合**的倍率，1 = 贴合） */
export interface NavView {
  zoom: number;
  panX: number;
  panY: number;
}

/** 官方 `ave` 的返回值 */
export interface NavBasis {
  minZoom: number;
  fitOffsetX: number;
  fitOffsetY: number;
  fitWidth: number;
  fitHeight: number;
}

/** 官方 `Bt` */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** 官方 `iD`：最大缩放 */
export const MEDIA_VIEWER_MAX_ZOOM = 5;
/** 官方 `K2`：鼠标滚轮 delta 限幅 */
export const MEDIA_VIEWER_WHEEL_DELTA_CLAMP = 80;
/** 官方 `ove`：鼠标滚轮灵敏度 */
export const MEDIA_VIEWER_MOUSE_WHEEL_SENSITIVITY = 0.0015;
/** 官方 `ive`：捏合（ctrl+滚轮）灵敏度 */
export const MEDIA_VIEWER_PINCH_SENSITIVITY = 0.01;
/** 官方 `dve`：`deltaMode === DOM_DELTA_LINE` 时的一行像素 */
export const MEDIA_VIEWER_WHEEL_LINE_PX = 16;
/** 官方 `uve`：缩到最小后延时多久回预览态 */
export const MEDIA_VIEWER_ZOOM_OUT_RETURN_MS = 180;
/** 官方 `hve`：判定「拖动过」的像素阈值 */
export const MEDIA_VIEWER_DRAG_THRESHOLD_PX = 4;
/** 官方 `pve`：拖动结束后多久内不吃点击 */
export const MEDIA_VIEWER_CLICK_AFTER_DRAG_MS = 400;
/** 官方 `X2` */
export const MEDIA_VIEWER_DEFAULT_VIEW: NavView = { zoom: 1, panX: 0, panY: 0 };

/** 官方 `W2`：把 `size` 按 contain 居中放进 `container`（**结果在 container 所在的坐标系里**） */
export function fitRectIn(container: NavRect, size: NavSize): NavRect {
  if (size.width <= 0 || size.height <= 0) return { ...container };
  const scale = Math.min(container.width / size.width, container.height / size.height);
  const width = size.width * scale;
  const height = size.height * scale;
  return {
    left: container.left + (container.width - width) / 2,
    top: container.top + (container.height - height) / 2,
    width,
    height,
  };
}

/** 官方 `tve()`：检视容器 = 视口四周内缩 24px
 *  ★ 实现落在 `components/nodes/shared/media/mediaViewerLayout.ts` 的 `inspectContainerRect`
 *    （带单测），这里不再重复一份。 */

/** 官方 `ave(previewRect, inspectRect)` */
export function imageNavigationBasis(previewRect: NavRect, inspectRect: NavRect): NavBasis {
  const ratioW = previewRect.width > 0 ? inspectRect.width / previewRect.width : 1;
  const ratioH = previewRect.height > 0 ? inspectRect.height / previewRect.height : 1;
  const ratio = Math.max(1, Math.min(ratioW, ratioH));
  return {
    minZoom: 1 / ratio,
    fitOffsetX: inspectRect.left + inspectRect.width / 2 - (previewRect.left + previewRect.width / 2),
    fitOffsetY: inspectRect.top + inspectRect.height / 2 - (previewRect.top + previewRect.height / 2),
    fitWidth: previewRect.width * ratio,
    fitHeight: previewRect.height * ratio,
  };
}

/** 官方 `jf(basis)`：贴合预览 */
export function fitView(basis: NavBasis): NavView {
  return { zoom: basis.minZoom, panX: 0, panY: 0 };
}

/** 官方 `lve()`：检视目标（自然像素 1:1） */
export function containView(): NavView {
  return { zoom: 1, panX: 0, panY: 0 };
}

/** 官方 `eC(view)` */
export function isViewZoomed(view: NavView): boolean {
  return view.zoom > 1;
}

/** 官方 `of(view, basis)`：夹到 `[minZoom, iD]`，并按 fit 尺寸夹住平移 */
export function clampView(view: NavView, basis: NavBasis): NavView {
  const zoom = clampNumber(view.zoom, basis.minZoom, MEDIA_VIEWER_MAX_ZOOM);
  if (zoom <= 1) return { zoom, panX: 0, panY: 0 };
  const limitX = (basis.fitWidth * (zoom - 1)) / 2;
  const limitY = (basis.fitHeight * (zoom - 1)) / 2;
  return {
    zoom,
    panX: clampNumber(view.panX, -limitX, limitX),
    panY: clampNumber(view.panY, -limitY, limitY),
  };
}

/** 官方 `$$(view, basis)`：→ CSS `transform` 的 `{scale, x, y}` */
export function imageTransform(view: NavView, basis: NavBasis): { scale: number; x: number; y: number } {
  const clamped = clampView(view, basis);
  const scale = clamped.zoom / basis.minZoom;
  if (clamped.zoom <= 1) {
    const span = 1 - basis.minZoom;
    const progress = span > 0 ? (clamped.zoom - basis.minZoom) / span : 1;
    return { scale, x: basis.fitOffsetX * progress, y: basis.fitOffsetY * progress };
  }
  return { scale, x: basis.fitOffsetX + clamped.panX, y: basis.fitOffsetY + clamped.panY };
}

/** 官方 `q2(zoom, delta, kind, minZoom)`：下一档 zoom（`kind` = `mouse-wheel` | `trackpad-pinch`） */
export function zoomStep(
  zoom: number,
  delta: number,
  kind: 'mouse-wheel' | 'trackpad-pinch',
  minZoom: number,
): number {
  const clampedDelta = kind === 'mouse-wheel' ? clampNumber(delta, -MEDIA_VIEWER_WHEEL_DELTA_CLAMP, MEDIA_VIEWER_WHEEL_DELTA_CLAMP) : delta;
  const sensitivity = kind === 'mouse-wheel' ? MEDIA_VIEWER_MOUSE_WHEEL_SENSITIVITY : MEDIA_VIEWER_PINCH_SENSITIVITY;
  return clampNumber(zoom * 2 ** (-clampedDelta * sensitivity), minZoom, MEDIA_VIEWER_MAX_ZOOM);
}

/** 官方 `Y2(view, nextZoom, point, basis)`：以 `point`（相对画框中心的像素）为锚点缩放 */
export function zoomAt(view: NavView, nextZoom: number, point: { x: number; y: number }, basis: NavBasis): NavView {
  const current = clampView(view, basis);
  const zoom = clampNumber(nextZoom, basis.minZoom, MEDIA_VIEWER_MAX_ZOOM);
  if (zoom <= 1) return { zoom, panX: 0, panY: 0 };
  const transform = imageTransform(current, basis);
  const currentScale = current.zoom / basis.minZoom;
  const ratio = zoom / basis.minZoom / currentScale;
  const x = point.x - (point.x - transform.x) * ratio;
  const y = point.y - (point.y - transform.y) * ratio;
  return clampView({ zoom, panX: x - basis.fitOffsetX, panY: y - basis.fitOffsetY }, basis);
}

/** 官方 `cve(view, delta, basis)`：平移（未放大时是 no-op） */
export function translateView(view: NavView, delta: { x: number; y: number }, basis: NavBasis): NavView {
  if (!isViewZoomed(view)) return clampView(view, basis);
  return clampView({ ...view, panX: view.panX + delta.x, panY: view.panY + delta.y }, basis);
}

/** 官方 `gve(event, viewportHeight)`：把 `deltaY` 折成像素 */
export function wheelDelta(event: { deltaY: number; deltaMode: number }, viewportHeight: number): number {
  const unit = event.deltaMode === 1 ? MEDIA_VIEWER_WHEEL_LINE_PX : event.deltaMode === 2 ? viewportHeight : 1;
  return event.deltaY * unit;
}

/** 官方 `bve(mode)`：`transform` 过渡串（`null` ⇒ 无过渡 = 滚轮/拖动的即时跟随） */
export function imageTransformTransition(mode: 'to-contain' | 'to-preview' | null): string | undefined {
  if (mode === 'to-contain') {
    const { durationSeconds, ease } = MEDIA_VIEWER_MOTION.sharedMedia;
    return `transform ${durationSeconds}s cubic-bezier(${ease.join(', ')})`;
  }
  if (mode === 'to-preview') {
    const { durationSeconds, ease } = MEDIA_VIEWER_MOTION.imageReset;
    return `transform ${durationSeconds}s cubic-bezier(${ease.join(', ')})`;
  }
  return undefined;
}
