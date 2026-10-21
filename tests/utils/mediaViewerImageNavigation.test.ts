import { describe, expect, it } from 'vitest';

import {
  MEDIA_VIEWER_MAX_ZOOM,
  clampView,
  containView,
  fitRectIn,
  fitView,
  imageNavigationBasis,
  imageTransform,
  imageTransformTransition,
  isViewZoomed,
  translateView,
  wheelDelta,
  zoomAt,
  zoomStep,
  type NavRect,
} from '../../src/utils/mediaViewerImageNavigation';

/**
 * 官方 `course-api-base-url-CGXqZmAy.js` 图片检视层几何的逐字移植：
 *   `ave` @482980 · `jf` @483249 · `lve` @483301 · `eC` @483345 · `of` @483376 · `$$` @483568
 *   `q2` @483793 · `Y2` @483911 · `cve` @484155 · `gve` @484409 · `bve` @484493 · `W2` @476032
 * 常量：`iD=5` · `K2=80` · `ove=.0015` · `ive=.01` · `dve=16`
 */

/** 预览贴合矩形（视口坐标） */
const PREVIEW: NavRect = { left: 100, top: 100, width: 400, height: 300 };
/** 检视矩形 = 视口 960×600 内缩 24px 后 contain 贴合同一条媒体 */
const INSPECT: NavRect = { left: 24, top: 24, width: 912, height: 552 };

describe('imageNavigationBasis —— 官方 ave', () => {
  const basis = imageNavigationBasis(PREVIEW, INSPECT);

  it('ratio = max(1, min(inspectW/previewW, inspectH/previewH))', () => {
    expect(basis.minZoom).toBeCloseTo(1 / 1.84, 10);
    expect(basis.fitWidth).toBeCloseTo(736, 10);
    expect(basis.fitHeight).toBeCloseTo(552, 10);
  });

  it('fitOffset = 两个矩形中心的位移', () => {
    expect(basis.fitOffsetX).toBeCloseTo(180, 10);
    expect(basis.fitOffsetY).toBeCloseTo(50, 10);
  });

  it('ratio 至少为 1（预览框比检视框还大时 minZoom 不超过 1）', () => {
    const big = imageNavigationBasis({ left: 0, top: 0, width: 2000, height: 2000 }, INSPECT);
    expect(big.minZoom).toBe(1);
  });
});

describe('imageTransform —— 官方 $$ / of / jf / lve', () => {
  const basis = imageNavigationBasis(PREVIEW, INSPECT);

  it('贴合视图（jf）⇒ 恒等变换', () => {
    expect(imageTransform(fitView(basis), basis)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('检视目标（lve，自然像素 1:1）⇒ 放大 1/minZoom 并居中到检视框', () => {
    const t = imageTransform(containView(), basis);
    expect(t.scale).toBeCloseTo(1 / basis.minZoom, 10);
    expect(t.x).toBeCloseTo(basis.fitOffsetX, 10);
    expect(t.y).toBeCloseTo(basis.fitOffsetY, 10);
  });

  it('zoom 被夹到 [minZoom, iD=5]', () => {
    expect(clampView({ zoom: 100, panX: 0, panY: 0 }, basis).zoom).toBe(MEDIA_VIEWER_MAX_ZOOM);
    expect(clampView({ zoom: 0.0001, panX: 0, panY: 0 }, basis).zoom).toBe(basis.minZoom);
  });

  it('zoom <= 1 时平移被清零、zoom > 1 时按 fit 尺寸夹住', () => {
    expect(clampView({ zoom: 0.9, panX: 999, panY: -999 }, basis)).toEqual({ zoom: 0.9, panX: 0, panY: 0 });
    const clamped = clampView({ zoom: 2, panX: 1e6, panY: -1e6 }, basis);
    expect(clamped.panX).toBeCloseTo(basis.fitWidth / 2, 10);
    expect(clamped.panY).toBeCloseTo(-basis.fitHeight / 2, 10);
  });
});

describe('zoomStep —— 官方 q2（阈值 = minZoom / iD=5、滚轮限幅 K2=80）', () => {
  const minZoom = imageNavigationBasis(PREVIEW, INSPECT).minZoom;

  it('鼠标滚轮：delta 先夹到 ±80，再乘 2^(-delta*0.0015)', () => {
    expect(zoomStep(1, -100, 'mouse-wheel', minZoom)).toBeCloseTo(2 ** (80 * 0.0015), 10);
    expect(zoomStep(1, 100, 'mouse-wheel', minZoom)).toBeCloseTo(2 ** (-80 * 0.0015), 10);
  });

  it('捏合（ctrl+滚轮）：灵敏度 .01 且不限幅', () => {
    expect(zoomStep(1, -10, 'trackpad-pinch', minZoom)).toBeCloseTo(2 ** (10 * 0.01), 10);
  });

  it('结果被夹到 [minZoom, iD=5]（单次事件的倍数另有 K2=80 限幅）', () => {
    expect(zoomStep(5, -80, 'mouse-wheel', minZoom)).toBe(MEDIA_VIEWER_MAX_ZOOM);
    expect(zoomStep(1, 80, 'mouse-wheel', 0.95)).toBeCloseTo(0.95, 10);
  });
});

describe('zoomAt —— 官方 Y2（以指针为锚点）', () => {
  const basis = imageNavigationBasis(PREVIEW, INSPECT);

  it('指针下的那个图像点缩放前后停在原地', () => {
    const start = containView();
    /** 指针相对图片层中心的屏幕偏移（未缩放的画框坐标） */
    const pointer = { x: 120, y: -60 };
    const before = imageTransform(start, basis);
    /** 指针下的图像点（图片层局部坐标） */
    const local = { x: (pointer.x - before.x) / before.scale, y: (pointer.y - before.y) / before.scale };
    const next = zoomAt(start, 2, pointer, basis);
    const after = imageTransform(next, basis);
    expect(local.x * after.scale + after.x).toBeCloseTo(pointer.x, 6);
    expect(local.y * after.scale + after.y).toBeCloseTo(pointer.y, 6);
  });

  it('缩到 minZoom 以下 ⇒ 夹到 minZoom 且平移归零', () => {
    const next = zoomAt(containView(), 0.5, { x: 10, y: 10 }, basis);
    expect(next.zoom).toBeCloseTo(basis.minZoom, 10);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);
  });
});

describe('translateView —— 官方 cve', () => {
  const basis = imageNavigationBasis(PREVIEW, INSPECT);

  it('未放大 ⇒ no-op', () => {
    expect(translateView(fitView(basis), { x: 50, y: 50 }, basis)).toEqual(fitView(basis));
  });

  it('已放大 ⇒ 累加并按边界夹住', () => {
    const moved = translateView({ zoom: 2, panX: 0, panY: 0 }, { x: 10, y: -10 }, basis);
    expect(moved.panX).toBeCloseTo(10, 10);
    expect(moved.panY).toBeCloseTo(-10, 10);
  });
});

describe('其它逐字常量', () => {
  it('wheelDelta：deltaMode 0/1/2 → px / ×16 / ×视口高', () => {
    expect(wheelDelta({ deltaY: 3, deltaMode: 0 }, 600)).toBe(3);
    expect(wheelDelta({ deltaY: 3, deltaMode: 1 }, 600)).toBe(48);
    expect(wheelDelta({ deltaY: 3, deltaMode: 2 }, 600)).toBe(1800);
  });

  it('imageTransformTransition：to-contain = On.sharedMedia；to-preview = On.imageReset', () => {
    expect(imageTransformTransition('to-contain')).toBe('transform 0.44s cubic-bezier(0.65, 0, 0.35, 1)');
    expect(imageTransformTransition('to-preview')).toBe('transform 0.28s cubic-bezier(0.65, 0, 0.35, 1)');
    expect(imageTransformTransition(null)).toBeUndefined();
  });

  it('isViewZoomed = zoom > 1', () => {
    expect(isViewZoomed({ zoom: 1, panX: 0, panY: 0 })).toBe(false);
    expect(isViewZoomed({ zoom: 1.0001, panX: 0, panY: 0 })).toBe(true);
  });

  it('fitRectIn = 官方 W2（contain 居中）', () => {
    expect(fitRectIn({ left: 24, top: 24, width: 912, height: 552 }, { width: 1000, height: 500 }))
      .toEqual({ left: 24, top: 72, width: 912, height: 456 });
    expect(fitRectIn({ left: 0, top: 0, width: 100, height: 100 }, { width: 0, height: 0 }))
      .toEqual({ left: 0, top: 0, width: 100, height: 100 });
  });
});
