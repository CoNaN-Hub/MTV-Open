/**
 * 官方「思考档位滑杆」几何 + 「模型悬浮飞出面板」悬浮意图的回归测试。
 *
 * 全部按官方压缩源码里的函数逐条对照（`use-chat-attachment-file-input-CE59XJWo.js`@80700 一带）：
 *   `Mr` / `Tr` / `Ci` / `vu` / `ku` / `Cu` / `Au` / `yu`
 *   `qu` / `Wu` / `Yu` / `Ju` / `Pr` / `Mu`
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  DOT_PAD,
  LEVEL_TWEEN_MS,
  THINKING_OFF_SENTINEL,
  dotLeft,
  dotState,
  levelRatio,
  ratioToPx,
  rippleAlpha,
  rippleFalloff,
  toFillRatio,
  tweenEase,
} from '../src/services/chat/thinkingSliderGeometry';
import {
  FLYOUT_BRIDGE_WIDTH,
  FLYOUT_EDGE_GAP,
  createHoverIntent,
  isSamePosition,
  leftOfAnchor,
  inSafeTriangle,
  centerInContainer,
  clampToViewport,
} from '../src/services/chat/modelFlyoutGeometry';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** 几何函数要读 `window.innerHeight`（官方 `qu`），node 环境下临时补一个。 */
function stubViewport(height: number) {
  vi.stubGlobal('window', { innerHeight: height, innerWidth: 1600, matchMedia: () => ({ matches: false }) });
}

describe('thinkingSliderGeometry（官方 Mr/Tr/Ci/vu/ku/Cu/Au/yu）', () => {
  const levels = ['low', 'medium', 'high', 'max'];

  it('levelRatio：关闭哨兵/未命中 ⇒ 0，单档 ⇒ 1，多档按位置均分', () => {
    expect(levelRatio(levels, null)).toBe(0);
    expect(levelRatio(levels, THINKING_OFF_SENTINEL)).toBe(0);
    expect(levelRatio(levels, 'nope')).toBe(0);
    expect(levelRatio(['only'], 'only')).toBe(1);
    expect(levelRatio(levels, 'low')).toBe(0);
    expect(levelRatio(levels, 'medium')).toBeCloseTo(1 / 3, 10);
    expect(levelRatio(levels, 'max')).toBe(1);
  });

  it('ratioToPx / dotLeft：两端各缩进 DOT_PAD，未测宽前退回 calc', () => {
    expect(ratioToPx(0, 240)).toBe(DOT_PAD);
    expect(ratioToPx(1, 240)).toBe(228);
    expect(ratioToPx(0.5, 240)).toBe(120);
    /* 轨道比两端内缩还窄 ⇒ 官方返回 0 */
    expect(ratioToPx(0.5, DOT_PAD * 2)).toBe(0);
    expect(dotLeft(0.5, 240)).toBe('120px');
    expect(dotLeft(0.5, 0)).toBe(`calc(${DOT_PAD}px + 0.5 * (100% - ${DOT_PAD * 2}px))`);
  });

  it('toFillRatio：扣掉 inset-0.5 的两端（ratio 0 也不是 0，而是首个档位点位置减 inset）', () => {
    expect(toFillRatio(0, 240)).toBeCloseTo(10 / 236, 10);
    expect(toFillRatio(1, 240)).toBe(1);
    /* 窄到放不下两层 inset 时按原比例返回 */
    expect(toFillRatio(0.5, 4)).toBe(0.5);
    expect(toFillRatio(0.5, 240)).toBeCloseTo(0.5, 10);
  });

  it('dotState：选中/最大/悬停/常态', () => {
    expect(dotState(3, 3, null, true)).toBe('max');
    expect(dotState(1, 1, null, false)).toBe('selected');
    expect(dotState(2, 1, 2, false)).toBe('hovered');
    expect(dotState(0, 1, 2, false)).toBe('idle');
  });

  it('rippleAlpha：非 live 恒 1；live 时靠近填充沿会抬升', () => {
    expect(rippleAlpha(10, 100, 0, false)).toBe(1);
    const far = rippleAlpha(10, 100, 0, true);
    const near = rippleAlpha(90, 100, 0, true);
    expect(far).toBeGreaterThanOrEqual(0.78 - 0.32);
    expect(near).toBeGreaterThan(far);
  });

  it('rippleFalloff：填充之外（x > fill）恒 0', () => {
    expect(rippleFalloff(120, 14, 100, 240, 28)).toBe(0);
    expect(rippleFalloff(10, 14, 100, 240, 28)).toBeGreaterThanOrEqual(0);
  });

  it('tweenEase：0 ⇒ 0，≥1 ⇒ 1，单调递增', () => {
    expect(tweenEase(0)).toBe(0);
    expect(tweenEase(1)).toBe(1);
    expect(tweenEase(2)).toBe(1);
    expect(tweenEase(0.5)).toBeGreaterThan(0.5);
    expect(tweenEase(0.5)).toBeLessThan(tweenEase(0.6));
    expect(LEVEL_TWEEN_MS).toBe(280);
  });
});

describe('modelFlyoutGeometry（官方 qu/Wu/Yu/Ju/Pr/Mu）', () => {
  const anchor = { top: 300, left: 900, right: 1100, bottom: 332, width: 200, height: 32 };
  const container = { top: 100, left: 700, right: 1100, bottom: 700, width: 400, height: 600 };

  it('leftOfAnchor：面板贴在行左侧并留 6px 过桥', () => {
    expect(leftOfAnchor(anchor, 240)).toBe(900 - 240 - FLYOUT_BRIDGE_WIDTH);
  });

  it('centerInContainer：行上居中，且放得下时钳进列表盒', () => {
    stubViewport(900);
    expect(centerInContainer(anchor, null, 200)).toBe(216);
    /* 面板比容器还高 ⇒ 只做视口钳制，不再用容器 */
    expect(centerInContainer(anchor, container, 800)).toBe(FLYOUT_EDGE_GAP);
  });

  it('clampToViewport：上下各留 8px', () => {
    stubViewport(800);
    expect(clampToViewport(-50, 100)).toBe(FLYOUT_EDGE_GAP);
    expect(clampToViewport(99999, 100)).toBe(800 - 100 - FLYOUT_EDGE_GAP);
  });

  it('isSamePosition：< 0.5px 视为不变', () => {
    expect(isSamePosition({ top: 1, left: 2 }, { top: 1, left: 2 })).toBe(true);
    expect(isSamePosition({ top: 1, left: 2 }, { top: 1.49, left: 2 })).toBe(true);
    expect(isSamePosition({ top: 1, left: 2 }, { top: 1.5, left: 2 })).toBe(false);
    expect(isSamePosition(null, null)).toBe(true);
    expect(isSamePosition(null, { top: 0, left: 0 })).toBe(false);
  });

  it('inSafeTriangle：从面板往行里扫时判为「安全」，反向扫不判安全', () => {
    const panel = { top: 280, left: 640, right: 880, bottom: 400, width: 240, height: 120 };
    const origin = { x: 900, y: 316 };
    const pointer = { x: 890, y: 316 };
    expect(inSafeTriangle(origin, pointer, { x: 885, y: 316 }, panel)).toBe(true);
    expect(inSafeTriangle(origin, pointer, { x: 895, y: 316 }, panel)).toBe(false);
    expect(inSafeTriangle({ x: 800, y: 316 }, pointer, { x: 885, y: 316 }, panel)).toBe(false);
    expect(inSafeTriangle(null, pointer, { x: 885, y: 316 }, panel)).toBe(false);
  });

  it('createHoverIntent：首次 request 立刻 show', () => {
    const intent = createHoverIntent();
    const show = vi.fn();
    intent.request({ x: 10, y: 10 }, null, show);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('createHoverIntent：跨行时挂起，400ms 后才 show', () => {
    vi.useFakeTimers();
    const intent = createHoverIntent();
    const show = vi.fn();
    const panel = { top: 0, left: 0, right: 80, bottom: 100, width: 80, height: 100 };
    intent.request({ x: 100, y: 50 }, panel, () => {});
    /* 第二次 request 落在安全三角内 ⇒ 走「挂起 + 定时器」分支 */
    intent.request({ x: 90, y: 50 }, panel, show);
    expect(show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(399);
    expect(show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('createHoverIntent：cancel 会清掉挂起的 show', () => {
    vi.useFakeTimers();
    const intent = createHoverIntent();
    const show = vi.fn();
    const panel = { top: 0, left: 0, right: 80, bottom: 100, width: 80, height: 100 };
    intent.request({ x: 100, y: 50 }, panel, () => {});
    intent.request({ x: 90, y: 50 }, panel, show);
    intent.cancel();
    vi.advanceTimersByTime(1000);
    expect(show).not.toHaveBeenCalled();
  });
});
