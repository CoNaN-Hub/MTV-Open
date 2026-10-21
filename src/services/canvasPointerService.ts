/**
 * 缓存最近一次画布指针坐标，为 Agent 和快捷创建操作提供稳定的节点落点。
 */
export interface CanvasPointerPosition {
  x: number;
  y: number;
}

const DEFAULT_CANVAS_POINTER_POSITION: Readonly<CanvasPointerPosition> = {
  x: 300,
  y: 200,
};

let lastCanvasPointerPosition: CanvasPointerPosition | null = null;

/**
 * 指针的**屏幕坐标**（clientX/clientY）—— 判断"鼠标是不是还在画布上"用。
 *
 * 对齐 TapNow `page-DPdEgTS0.js` `k_()` 里的 `g.current`（鼠标位）+ `y.current`（在不在画布矩形内）：
 * 「鼠标在 `.react-flow` 矩形内才用鼠标位置当粘贴落点，否则退回视口中心」。
 * ⚠️ 没有这道门，切画布之后缓存的上一次画布指针会被当成"当前鼠标"，
 * 粘出来的卡片就落在看不见的地方（用户报过「粘贴不过去」）。
 *
 * ⚠️ **别改用 `mouseenter`/`mouseleave` 事件记这个状态** ✗：实测（CDP 合成鼠标移动、
 *    也在真实指针快速掠过时）`mouseenter` 可能不触发，而 `mousemove` 一定触发
 *    —— 于是标记永远停在 false，落点悄悄退回视口中心。这里按 TapNow 的原做法：
 *    只存**坐标**，需要时再和画布矩形现算，不依赖任何进出事件。
 */
let lastCanvasPointerClient: CanvasPointerPosition | null = null;

export function setCanvasPointerPosition(position: CanvasPointerPosition): void {
  lastCanvasPointerPosition = { x: position.x, y: position.y };
}

/** 记一次屏幕坐标（由画布的鼠标事件调用，与流坐标那份同时更新） */
export function setCanvasPointerClientPosition(position: CanvasPointerPosition): void {
  lastCanvasPointerClient = { x: position.x, y: position.y };
}

/** 鼠标现在是否落在画布上（现算，不依赖进出事件） */
export function isCanvasPointerOverCanvas(): boolean {
  if (typeof document === 'undefined') return false;
  const pane = document.querySelector('.react-flow');
  const pointer = lastCanvasPointerClient;
  if (!pane || !pointer) return false;
  const rect = pane.getBoundingClientRect();
  return (
    pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom
  );
}

export function getLastCanvasPointerPosition(): CanvasPointerPosition | null {
  return lastCanvasPointerPosition ? { ...lastCanvasPointerPosition } : null;
}

export function getCanvasPointerPosition(): CanvasPointerPosition {
  return getLastCanvasPointerPosition() ?? { ...DEFAULT_CANVAS_POINTER_POSITION };
}
