/**
 * 官方媒体查看器的动画参数（`zoom-slider-3ZcFvYQO.js` @441328 `On`，逐字）
 * 单独成文件：`react-refresh/only-export-components` 不允许组件文件额外导出常量。
 */
export const OFFICIAL_VIEWER_MOTION = {
  sharedMedia: { duration: 0.44, ease: [0.65, 0, 0.35, 1] as [number, number, number, number] },
  backdrop: { duration: 0.44, ease: [0.65, 0, 0.35, 1] as [number, number, number, number] },
  contentHandoff: { duration: 0.2, ease: 'linear' as const },
  textViewer: {
    duration: 0.44,
    radiusStart: 0.3,
    radiusDuration: 0.14,
    contentEnterStart: 0.32,
    contentEnterDuration: 0.12,
    contentExitDuration: 0.12,
    fallbackDuration: 0.14,
  },
  /** 底部操作条（`mye`）的进出场 */
  actions: {
    enterDuration: 0.28,
    exitDuration: 0.16,
    offsetPixels: 18,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
} as const;
