import { describe, expect, it } from 'vitest';
import {
  fitFrame,
  inspectContainerRect,
  mediaFrameVars,
  relativeRect,
} from '../../src/components/nodes/shared/media/mediaViewerLayout';
import {
  MEDIA_VIEWER_INSPECT_INSET,
  MEDIA_VIEWER_MOTION,
  MEDIA_VIEWER_PROMPT_GAP,
} from '../../src/components/nodes/shared/media/mediaViewerMotion';

/**
 * 官方依据（zoom-slider-3ZcFvYQO.js / zoom-slider-B3yfHu80.css）：
 *   · `const kbe=32, Ibe=24;` @470538
 *   · `Rbe(outer, inner)` @470558 → 相对矩形
 *   · `Mbe(frame, container)` @470649 →
 *       `--media-viewer-frame-left/top/width/height` + `--media-viewer-prompt-offset = 32 - (container.height - frame.top - frame.height)`
 *   · `Pbe()` @470923 = 视口内缩 24px
 *   · `On` @441328：`chrome = {.24s, delay .08, offset 18px, [.22,1,.36,1]}`、`backdrop = {.44s, [.65,0,.35,1]}`
 */
describe('official media viewer layout (Mbe / Rbe / Pbe)', () => {
  it('numbers the layout constants exactly like the bundle', () => {
    expect(MEDIA_VIEWER_PROMPT_GAP).toBe(32);
    expect(MEDIA_VIEWER_INSPECT_INSET).toBe(24);
    expect(MEDIA_VIEWER_MOTION.chrome).toEqual({
      durationSeconds: 0.24,
      delaySeconds: 0.08,
      offsetPixels: 18,
      ease: [0.22, 1, 0.36, 1],
    });
    expect(MEDIA_VIEWER_MOTION.backdrop).toEqual({ durationSeconds: 0.44, ease: [0.65, 0, 0.35, 1] });
    expect(MEDIA_VIEWER_MOTION.contentHandoff).toEqual({ durationSeconds: 0.2, ease: 'linear' });
  });

  it('converts an outer rect into coordinates relative to the container', () => {
    expect(relativeRect(
      { left: 120, top: 90, width: 40, height: 20 },
      { left: 100, top: 80, width: 500, height: 400 },
    )).toEqual({ left: 20, top: 10, width: 40, height: 20 });
  });

  it('emits the frame css variables with the prompt offset formula', () => {
    const vars = mediaFrameVars(
      { left: 100, top: 50, width: 800, height: 500 },
      { width: 1000, height: 900 },
    );
    expect(vars).toEqual({
      '--media-viewer-frame-left': '100px',
      '--media-viewer-frame-top': '50px',
      '--media-viewer-frame-width': '800px',
      '--media-viewer-frame-height': '500px',
      /* remaining = 900 - 50 - 500 = 350 ⇒ 32 - 350 */
      '--media-viewer-prompt-offset': '-318px',
    });
  });

  it('insets the inspect container by 24px', () => {
    expect(inspectContainerRect({ width: 1000, height: 800 })).toEqual({
      left: 24,
      top: 24,
      width: 952,
      height: 752,
    });
  });

  it('fits the frame to the image aspect ratio (contain, centered)', () => {
    /* 4:3 图片放进 1000×1000 容器 ⇒ 1000×750，垂直居中 top=125 */
    expect(fitFrame({ width: 1000, height: 1000 }, { width: 800, height: 600 }))
      .toEqual({ left: 0, top: 125, width: 1000, height: 750 });
    /* 竖图：300×600 放进 1000×600 ⇒ 300×600，水平居中 left=350 */
    expect(fitFrame({ width: 1000, height: 600 }, { width: 300, height: 600 }))
      .toEqual({ left: 350, top: 0, width: 300, height: 600 });
  });

  it('falls back to the container while the intrinsic size is unknown', () => {
    expect(fitFrame({ width: 800, height: 600 }, null))
      .toEqual({ left: 0, top: 0, width: 800, height: 600 });
    expect(fitFrame({ width: 0, height: 0 }, { width: 10, height: 10 }))
      .toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});
