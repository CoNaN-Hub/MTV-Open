/**
 * mediaViewerLayout —— 官方媒体查看器的「媒体帧 → CSS 变量」这一套（逐字）
 *
 * 出处：EXE `zoom-slider-3ZcFvYQO.js`
 *   · `const kbe=32, Ibe=24;` @470538（`kbe` = 提示词与帧的上间距，`Ibe` = 检视容器内缩）
 *   · `Rbe(outer, inner)` @470558 → `{ left: outer.left - inner.left, top: outer.top - inner.top, width, height }`
 *   · `Mbe(frame, container)` @470649 →
 *       `--media-viewer-frame-left/top/width/height` + `--media-viewer-prompt-offset: 32 - n`，
 *       其中 `n = container.height - frame.top - frame.height`（帧下方剩余高度；剩余越多提示词越往上贴）
 *   · `Pbe()` @470923 = 检视容器：四周内缩 24px
 *   · `Dbe({viewerRef, media})` @471053：用 `ResizeObserver` + `resize` 事件量容器矩形
 *   · 图片本体的固有尺寸由 `lbe` 的 `onIntrinsicSize(src, {width: naturalWidth, height: naturalHeight})` 上报
 *
 * MTV 侧：图片的固有尺寸优先取节点数据（`data.imageWidth/imageHeight`），拿不到时由
 * `img.onLoad` 的 `naturalWidth/naturalHeight` 兜底（与官方 `onIntrinsicSize` 等价）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_VIEWER_INSPECT_INSET, MEDIA_VIEWER_PROMPT_GAP } from './mediaViewerMotion';

export interface ViewerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ViewerSize {
  width: number;
  height: number;
}

/** 官方 `Rbe`：把 `outer` 换算成相对于 `inner` 的矩形 */
export function relativeRect(outer: ViewerRect, inner: ViewerRect): ViewerRect {
  return {
    left: outer.left - inner.left,
    top: outer.top - inner.top,
    width: outer.width,
    height: outer.height,
  };
}

/** 官方 `Mbe`：帧矩形 + 容器 → 4 个 `--media-viewer-frame-*` 变量 + 提示词偏移 */
export function mediaFrameVars(frame: ViewerRect, container: ViewerSize): Record<string, string> {
  const remaining = container.height - frame.top - frame.height;
  return {
    '--media-viewer-frame-left': `${frame.left}px`,
    '--media-viewer-frame-top': `${frame.top}px`,
    '--media-viewer-frame-width': `${frame.width}px`,
    '--media-viewer-frame-height': `${frame.height}px`,
    '--media-viewer-prompt-offset': `${MEDIA_VIEWER_PROMPT_GAP - remaining}px`,
  };
}

/** 官方 `Pbe`：检视（inspect）容器 = 视口四周内缩 24px */
export function inspectContainerRect(viewport: ViewerSize): ViewerRect {
  return {
    left: MEDIA_VIEWER_INSPECT_INSET,
    top: MEDIA_VIEWER_INSPECT_INSET,
    width: Math.max(1, viewport.width - MEDIA_VIEWER_INSPECT_INSET * 2),
    height: Math.max(1, viewport.height - MEDIA_VIEWER_INSPECT_INSET * 2),
  };
}

/**
 * 图片按 `object-fit: contain` 放进容器后**实际占据**的矩形（居中）——
 * 等价于官方 `Mbe` 里那个 `e`（帧矩形）：官方是量出来的，这里用固有尺寸算，
 * 两者一致（都是 contain 居中）。
 */
export function fitFrame(container: ViewerSize, intrinsic: ViewerSize | null | undefined): ViewerRect {
  if (!container.width || !container.height) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  if (!intrinsic || !intrinsic.width || !intrinsic.height) {
    /* 拿不到固有尺寸（还在加载）⇒ 帧 = 容器，侧栏先贴容器边，图片 load 后自动归位 */
    return { left: 0, top: 0, width: container.width, height: container.height };
  }
  const scale = Math.min(container.width / intrinsic.width, container.height / intrinsic.height);
  const width = intrinsic.width * scale;
  const height = intrinsic.height * scale;
  return {
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
    width,
    height,
  };
}

export interface MediaFrameLayout {
  /** **回调 ref**（不是 `RefObject`）：媒体容器随 `isOpen` 挂/卸（`ImageNode`/`VideoNode` 常驻挂载
   *  `MediaViewer`，只有打开时才把画框放进 DOM）⇒ 必须在挂载那一刻就量一次，
   *  否则 `containerRect` 永远是 0，图片层的尺寸会是 0×0（实测：节点全屏只剩黑底 + chrome）。 */
  containerRef: (node: HTMLDivElement | null) => void;
  vars: Record<string, string>;
  /** 媒体容器（官方 `nve` 的 `containerRect`）在**视口坐标**下的矩形；未测到时为 0 尺寸。
   *  官方 `previewRect = W2(containerRect, media)`、`inspectRect = W2(tve(), media)` 都以它为基准。 */
  containerRect: ViewerRect;
  /** 视口尺寸（官方 `tve()` 读 `window.innerWidth/innerHeight`；这里跟着同一条 `resize` 走） */
  viewport: ViewerSize;
}

/**
 * 量容器尺寸（官方 `Dbe` 的等价物：`ResizeObserver` + `resize`）并按 contain 拟合出帧变量。
 */
export function useMediaFrameLayout(intrinsic: ViewerSize | null | undefined): MediaFrameLayout {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [containerRect, setContainerRect] = useState<ViewerRect>({ left: 0, top: 0, width: 0, height: 0 });
  const [viewport, setViewport] = useState<ViewerSize>({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const el = elementRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setContainerRect((current) => (
        Math.abs(current.left - rect.left) < 0.5
        && Math.abs(current.top - rect.top) < 0.5
        && Math.abs(current.width - rect.width) < 0.5
        && Math.abs(current.height - rect.height) < 0.5
          ? current
          : { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      ));
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    setViewport((current) => (
      Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
        ? current
        : { width, height }
    ));
  }, []);

  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    elementRef.current = node;
    if (!node) {
      /* 画框卸载（查看器关闭）⇒ 复位，避免下次挂载前用上一轮的矩形 */
      setContainerRect({ left: 0, top: 0, width: 0, height: 0 });
      return;
    }
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      observerRef.current = observer;
    }
    /* 挂载当帧就量：`setState` 会在同一次 commit 的布局阶段被 React 冲刷，不会闪一帧 0×0 */
    measure();
  }, [measure]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    /* 官方 `u8` 的根节点把 `onScroll: _.measure` 挂在查看器上（查看器的进度条/长提示词会滚动）
       ⇒ 位置一变就要重量，否则 `previewRect` 会带着旧 `top` 算 `ave()` 的 `fitOffset`。 */
    window.addEventListener('scroll', measure, true);
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  return {
    containerRef: attachContainer,
    vars: mediaFrameVars(fitFrame(containerRect, intrinsic), containerRect),
    containerRect,
    viewport,
  };
}
