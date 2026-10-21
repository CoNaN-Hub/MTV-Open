/**
 * 官方「思考档位滑杆」几何与状态函数 —— `use-chat-attachment-file-input-CE59XJWo.js`@80700 一带逐字。
 *
 * 官方压缩名 → 语义（本文件导出的名字与之一一对应，注释里标注原压缩名）：
 *   `xu`/`$e` = `__thinking_off__`        关闭哨兵（不是档位 code）
 *   `Ze`      = 12                        档位点距离轨道两端的像素内缩
 *   `Ut`      = 2                         轨道内层 inset（`inset-0.5`）
 *   `pu`      = 8                         涟漪边缘淡出宽度
 *   `fu`      = 280                       档位切换的补间时长（ms）
 *   `mu`      = 4                         判定「拖拽」而非「点击」的位移阈值（px）
 *   `Nr`      = 24                        涟漪靠近激活点的衰减窗口（px）
 *   `gu`      = 6                         涟漪靠近轨道上下边的收缩量
 *   `Pe`      = 5                         canvas 圆点网格间距（px）
 *   `hu`      = 0.7                       canvas 圆点半径（px）
 *   `Mr`      = levelRatio                档位 → 0..1 比例
 *   `Ci`      = ratioToPx                 比例 → 像素
 *   `Tr`      = toFillRatio               比例 → 填充比例（扣掉两端 inset）
 *   `vu`      = dotLeft                   档位点的 left 样式
 *   `wu`      = levelLabel                档位标签（关闭 ⇒ i18n `off`）
 *   `ku`      = dotState                  档位点视觉状态 `max|selected|hovered|idle`
 *   `Cu`      = rippleAlpha               涟漪透明度
 *   `Au`      = rippleFalloff             单个圆点的径向衰减
 *   `jr`      = scaleByWidth              比例 → 像素
 */

/** 官方 `xu`：关闭哨兵。 */
export const THINKING_OFF_SENTINEL = '__thinking_off__';

/** 官方 `Ze`：档位点距轨道两端的像素内缩。 */
export const DOT_PAD = 12;
/** 官方 `Ut`：轨道内层 inset（对应 `inset-0.5`）。 */
export const TRACK_INSET = 2;
/** 官方 `pu`：涟漪靠近填充边缘的淡出宽度。 */
export const RIPPLE_FADE = 8;
/** 官方 `fu`：档位切换补间时长（ms）。 */
export const LEVEL_TWEEN_MS = 280;
/** 官方 `mu`：点击/拖拽判定阈值（px）。 */
export const DRAG_THRESHOLD = 4;
/** 官方 `Nr`：涟漪靠近激活点的衰减窗口（px）。 */
export const RIPPLE_WINDOW = 24;
/** 官方 `gu`：涟漪靠近轨道上下边的收缩量。 */
export const RIPPLE_PAD = 6;
/** 官方 `Pe`：canvas 圆点网格间距（px）。 */
export const RIPPLE_GRID = 5;
/** 官方 `hu`：canvas 圆点半径（px）。 */
export const RIPPLE_DOT_RADIUS = 0.7;

/** 官方 `Mr`：档位 → 0..1；关闭哨兵或未命中 ⇒ 0；只有一个档位 ⇒ 1。 */
export function levelRatio(levels: readonly string[], level: string | null): number {
  if (!level || level === THINKING_OFF_SENTINEL) return 0;
  const index = levels.indexOf(level);
  if (index < 0) return 0;
  return levels.length <= 1 ? 1 : index / (levels.length - 1);
}

/** 官方 `jr` / `Ci`：比例 → 像素（四舍五入，越界钳到 0..1）。 */
export function scaleByWidth(ratio: number, width: number): number {
  if (ratio >= 1) return width;
  return Math.round(Math.min(1, Math.max(0, ratio)) * width);
}

/** 官方 `Ci`：比例 → 轨道内像素位置（扣掉两端 `DOT_PAD`）。 */
export function ratioToPx(ratio: number, width: number): number {
  if (width <= DOT_PAD * 2) return 0;
  return Math.round(DOT_PAD + Math.min(1, Math.max(0, ratio)) * (width - DOT_PAD * 2));
}

/** 官方 `Tr`：比例 → 填充比例（`inset-0.5` 内层）。 */
export function toFillRatio(ratio: number, width: number): number {
  if (width <= TRACK_INSET * 2) return Math.min(1, Math.max(0, ratio));
  const inner = width - TRACK_INSET * 2;
  const px = ratio >= 1 ? width - TRACK_INSET : ratioToPx(ratio, width);
  return Math.min(1, Math.max(0, (px - TRACK_INSET) / inner));
}

/** 官方 `vu`：档位点的 `left` 样式（未测到宽度前用 `calc` 兜底）。 */
export function dotLeft(ratio: number, width: number): string {
  if (width > 0) return `${ratioToPx(ratio, width)}px`;
  return `calc(${DOT_PAD}px + ${ratio} * (100% - ${DOT_PAD * 2}px))`;
}

/** 官方 `ku`：档位点视觉状态。 */
export function dotState(
  index: number,
  selectedIndex: number,
  hoveredIndex: number | null,
  isMax: boolean,
): 'max' | 'selected' | 'hovered' | 'idle' {
  if (index === selectedIndex) return isMax ? 'max' : 'selected';
  if (hoveredIndex === index) return 'hovered';
  return 'idle';
}

/** 官方 `Cu`：涟漪透明度（`live` 为 false 时恒 1）。 */
export function rippleAlpha(px: number, fillPx: number, now: number, live: boolean): number {
  if (!live) return 1;
  const delta = fillPx - px;
  const near = delta >= 0 && delta < RIPPLE_WINDOW ? 1 - delta / RIPPLE_WINDOW : 0;
  const wave = px <= fillPx ? 0.5 + 0.5 * Math.sin(px * 0.38 - now * 0.012) : 0;
  return 0.78 + 0.32 * wave + 0.55 * near;
}

/** 官方 `Au`：单个圆点的径向衰减（0..1 平滑阶梯）。 */
export function rippleFalloff(x: number, y: number, fillPx: number, width: number, height: number): number {
  void y;
  const pad = Math.min(RIPPLE_PAD, height / 2);
  /* 官方：`o = clamp(px, pad, max(pad, width − pad))` —— 注意钳的是 **x**；
     `c = pad − hypot(px − o, py − pad)` 是「左端胶囊边」的有符号距离。 */
  const clampedX = Math.min(Math.max(x, pad), Math.max(pad, width - pad));
  const edgeDist = pad - Math.hypot(x - clampedX, y - pad);
  const toFill = fillPx - x;
  const t = Math.min(1, Math.max(0, Math.min(edgeDist, toFill) / RIPPLE_FADE));
  return t * t * (3 - 2 * t);
}

/** 官方 `yu`：`1 - 2^(-10t)` 缓动。 */
export function tweenEase(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

/** 官方 `Vt`：系统是否偏好减少动态效果。 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
