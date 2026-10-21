/**
 * mediaViewerMotion —— 官方媒体查看器的动效常量（逐字）
 *
 * 出处：EXE `zoom-slider-3ZcFvYQO.js` `const On={` @441328（9 个分支全量）
 *   · 媒体查看器只用到 `On.backdrop`（黑底层）与 `On.chrome`（回退键/事实栏/操作条）；
 *     `On.sharedMedia` 是媒体帧本身的形变时长，`On.contentHandoff` 是图片换图的交叉淡入，
 *     `On.imageReset` 是「复位到预览」动画，`On.actions` 是底部操作条、`On.returnButton` 是返回键，
 *     `On.videoLoading` 是视频加载态；文本分支的常量在 `shared/text/mediaViewerMotion.ts`（`On.textViewer`）。
 *
 * ⚠️ 官方所有 duration 都要乘 `useReducedMotion()`（`duration: reduced ? 0 : …`），
 *    历史列的自动滚动在减动效时用 `behavior:"auto"` —— 见 `MediaViewerHistory.tsx`。
 */

type Ease4 = [number, number, number, number];

export interface MediaViewerMotion {
  sharedMedia: { durationSeconds: number; ease: Ease4 };
  backdrop: { durationSeconds: number; ease: Ease4 };
  contentHandoff: { durationSeconds: number; ease: 'linear' };
  videoLoading: {
    delaySeconds: number;
    enterDurationSeconds: number;
    exitDurationSeconds: number;
    ease: Ease4;
  };
  imageReset: { durationSeconds: number; ease: Ease4 };
  chrome: { durationSeconds: number; delaySeconds: number; offsetPixels: number; ease: Ease4 };
  returnButton: { durationSeconds: number };
  actions: {
    enterDurationSeconds: number;
    exitDurationSeconds: number;
    offsetPixels: number;
    ease: Ease4;
  };
}

/** 官方 `On` @441328（逐字） */
export const MEDIA_VIEWER_MOTION: MediaViewerMotion = {
  sharedMedia: { durationSeconds: 0.44, ease: [0.65, 0, 0.35, 1] },
  backdrop: { durationSeconds: 0.44, ease: [0.65, 0, 0.35, 1] },
  contentHandoff: { durationSeconds: 0.2, ease: 'linear' },
  videoLoading: {
    delaySeconds: 0.18,
    enterDurationSeconds: 0.16,
    exitDurationSeconds: 0.12,
    ease: [0.25, 1, 0.5, 1],
  },
  imageReset: { durationSeconds: 0.28, ease: [0.65, 0, 0.35, 1] },
  chrome: { durationSeconds: 0.24, delaySeconds: 0.08, offsetPixels: 18, ease: [0.22, 1, 0.36, 1] },
  returnButton: { durationSeconds: 0.42 },
  actions: {
    enterDurationSeconds: 0.28,
    exitDurationSeconds: 0.16,
    offsetPixels: 18,
    ease: [0.22, 1, 0.36, 1],
  },
};

/** 媒体帧布局常量（官方 `const kbe=32, Ibe=24;` @470538） */
export const MEDIA_VIEWER_PROMPT_GAP = 32;
export const MEDIA_VIEWER_INSPECT_INSET = 24;
