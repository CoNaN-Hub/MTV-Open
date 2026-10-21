/**
 * MediaViewer —— 官方「媒体查看器」（图片/视频分支）的 MTV 实现
 *
 * 官方出处（EXE `course-api-base-url-CGXqZmAy.js`，坐标按**当前** build）：
 *   · 查看器根 `u8`：`createPortal(..., document.body)`；
 *     `div[data-media-viewer][data-media-viewer-inspecting-image][role=dialog][aria-modal=true]`
 *   · 顶栏 @585428：`header[data-media-viewer-dismiss-blocker].fixed.inset-x-0.top-0.z-30.h-20`
 *     → `motion.div.absolute.left-5.top-5` 里的左上返回箭头（`H$` + `$ne` = Tabler arrow-left）
 *   · 媒体列 @585468：`div.relative.z-10.min-h-full.w-screen.px-8.pb-32.pt-16`（`opacity: W`）
 *     → `main.media-viewer__media-column.relative.mx-auto` → `div.relative.h-[calc(100vh-240px)]…`
 *     → prompt / history / facts
 *   · 底部操作条 @586021：`fixed bottom-7 left-1/2 z-30 -translate-x-1/2`（`p && phase==="open" && W`）
 *   · **图片层 `Xye` @476418**：见下
 *
 * ★ 图片层 `Xye`（逐字）：
 *   ```jsx
 *   <motion.div ref={nav.frameRef} data-media-viewer-dismiss-blocker
 *     data-media-viewer-image-inspecting={isImageInspecting || undefined}
 *     className={cn("absolute z-20",
 *       (isImage && (inspecting || isReturning)) ? "overflow-visible" : "overflow-hidden",
 *       isImage && !isImageInspecting && "cursor-zoom-in",
 *       isImageInspecting && nav.isZoomed && (nav.isDragging ? "cursor-grabbing" : "cursor-grab"))}
 *     style={{left, top, width, height, transformOrigin:"top left", touchAction: inspecting ? "none" : undefined}}
 *     onPointerDown/Move/Up/Cancel={nav.handlePointer*} onAuxClick={nav.handleAuxClick}
 *     onClick={() => { nav.consumeClickAfterDrag() || onImageClick() }}>
 *     <div className="relative size-full overflow-hidden" style={nav.imageStyle}
 *          onTransitionEnd={nav.handleTransitionEnd}>
 *       <img src={media.displaySrc} draggable={false}
 *            className="absolute inset-0 size-full select-none object-contain" />
 *     </div>
 *   </motion.div>
 *   ```
 *   `left/top/width/height` = `previewRect`（= 媒体容器里 contain 贴合后的图片矩形，官方 `nve` 的 `W2`）。
 *   **检视态 `overflow-visible`** ⇒ 放大后的图可以溢出画框、铺到「视口内缩 24px」的检视容器里；
 *   预览态 `cursor-zoom-in`（放大镜）；点图 ⇒ `onImageClick = T ? z : L`。
 *
 * ★ 检视(放大)态的状态机（官方 `u8` 头部，逐条照抄）：
 *   ```js
 *   const [g, b] = useState("preview")     // g = mode
 *   const [v, y] = useState(!1)            // v = chrome 被"钉住"（自动隐藏计时中）
 *   const N = media.type === "image";  const T = N && g === "inspect"
 *   const C = () => { x(); w.current = setTimeout(() => { w.current=null; y(!1) }, 3e3) }
 *   const R = () => { if (phase!=="open" || !N) return; x(); y(!1); b("inspect") }
 *   const I = () => { x(); y(!1); b("preview") }
 *   const L = () => { R(); G.zoomToContain() }        // 预览态点图 = 进检视（自然像素 1:1）
 *   const z = () => { T && (y(!0), C()) }             // 检视态点图 = 亮出 chrome 3 秒
 *   const P = () => { if (T) { G.returnToPreview(); I(); return } s() }   // 返回键/Esc：一级退检视、二级才关
 *   const $ = !isText && phase !== "closing";  const W = $ && !T;  const Y = W || (T && v)
 *   ```
 *
 * ⚠️ MTV 偏离（逐条记账）：
 *   1. 入口/出口的**锚点形变**（`sourceAnchor` / `closeTargetAnchor` → `Xye` 的 `initial`/`animate`）
 *      MTV 没有 ⇒ 保留原来的淡入淡出；`Xye` 的**几何与交互**已按官方逐字落地。
 *   2. 官方媒体列的 `opacity: W` 会把「图片以外的 chrome」整片压掉（图片在 `Xye` 里，是另一棵子树）；
 *      MTV 的图片就在这一列里 ⇒ 不能给整列加 opacity，改成 CSS 变量 `--media-viewer-chrome-opacity`
 *      由 `.media-viewer__prompt/__facts/__history` 消费（视觉结果相同）。
 *   3. 打开时**不隐藏**源节点 DOM（官方 `h8` 会 `visibility:hidden`）。
 *   4. `[data-media-viewer-returning-image]` 属性已挂；官方 `u8` 的 `F = N && (T || isReturning)`
 *      还参与根节点 `overflow-hidden` 的切换，MTV 用 `data-media-viewer-inspecting-image` 一条覆盖
 *      （退场 .28s 内溢出仍可见，实测无差异）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useT } from '../../../../i18n';
import { MEDIA_VIEWER_MOTION } from './mediaViewerMotion';
import { useMediaFrameLayout, fitFrame, inspectContainerRect } from './mediaViewerLayout';
import { useMediaViewerImageNavigation } from './useMediaViewerImageNavigation';
import MediaViewerFacts from './MediaViewerFacts';
import MediaViewerHistory from './MediaViewerHistory';
import MediaViewerPrompt from './MediaViewerPrompt';
import { MediaViewerActionButton } from './MediaViewerActions';
import { OfficialIcon } from '../../../sidebar/OfficialIcon';
import { fitRectIn, type NavRect } from '../../../../utils/mediaViewerImageNavigation';
import {
  buildMediaHistoryVersions,
  shouldShowMediaHistory,
  type MediaHistoryVersion,
} from '../../../../utils/mediaViewerHistory';

/** 官方 `Twe = 3e3`（@580945）：检视态下 chrome 的自动隐藏时长 */
const INSPECT_CHROME_HIDE_MS = 3000;

export interface MediaViewerProps {
  isOpen: boolean;
  mediaType: 'image' | 'video';
  /** 打开时的媒体（官方 `entryMedia`：历史列的**第 0 位**） */
  entrySrc: string;
  /** 历史版本（含当前项；≤1 条时历史列不渲染） */
  versions?: readonly MediaHistoryVersion[];
  /** 正在展示的媒体 */
  activeSrc?: string;
  prompt?: string;
  model?: string;
  width?: number;
  height?: number;
  createdAt?: number;
  durationSeconds?: number;
  /** 选中某个历史版本（官方 `onSelect` → `selectResource`） */
  onSelectVersion: (src: string) => void;
  onClose: () => void;
  /** 底部操作条（官方 `Qge`，位置/动效 = 官方 `fixed bottom-7 left-1/2 z-30` + `On.actions`） */
  actions?: React.ReactNode;
  /**
   * 媒体本体（MTV 侧扩展）：视频卡要把自己的 `<video ref=… controls …>` 交给查看器渲染
   * （官方 `Nbe` 是双 `<video>` 交叉淡入 + 播放交接；MTV 保留自己的播放交接机件，
   *  只把元素放进官方媒体列 ⇒ 传这个插槽时不再套缩放，与官方视频分支一致）
   */
  mediaContent?: React.ReactNode;
}

export default function MediaViewer({
  isOpen,
  mediaType,
  entrySrc,
  versions = [],
  activeSrc,
  prompt = '',
  model,
  width,
  height,
  createdAt,
  durationSeconds,
  onSelectVersion,
  onClose,
  actions,
  mediaContent,
}: MediaViewerProps) {
  const t = useT();
  const reducedMotion = useReducedMotion();
  const displaySrc = activeSrc || entrySrc;
  const historyVersions = buildMediaHistoryVersions(entrySrc || displaySrc, versions);
  /* 固有尺寸：优先节点数据，其次 `img.onLoad` 探到的（与官方 `onIntrinsicSize` 等价）。
     ⚠️ 不用 effect 回写 state（会触发级联渲染）⇒ 用 src 做键在渲染期取用 ✓ */
  const [probedSize, setProbedSize] = useState<{ src: string; width: number; height: number } | null>(null);
  const intrinsic = useMemo(() => {
    if (probedSize && probedSize.src === displaySrc) {
      return { width: probedSize.width, height: probedSize.height };
    }
    return width && height ? { width, height } : null;
  }, [displaySrc, height, probedSize, width]);
  const { containerRef: frameContainerRef, vars, containerRect, viewport } = useMediaFrameLayout(intrinsic);

  /* ────────────────────────────────────────────────────────────────────────
     官方 `u8` 的检视态状态机（`[g,b]` / `[v,y]` / `N` / `T` / `$` / `W` / `Y`）
     ──────────────────────────────────────────────────────────────────────── */
  const [mode, setMode] = useState<'preview' | 'inspect'>('preview');
  /** 官方 `v`：chrome 被钉住（3 秒自动隐藏计时中） */
  const [chromePinned, setChromePinned] = useState(false);
  const chromeTimerRef = useRef<number | null>(null);

  /** 官方 `x`：清掉自动隐藏计时 */
  const clearChromeTimer = useCallback(() => {
    if (chromeTimerRef.current !== null) {
      window.clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = null;
    }
  }, []);
  /** 官方 `C`：重新计时，到点取消钉住 */
  const scheduleChromeHide = useCallback(() => {
    clearChromeTimer();
    chromeTimerRef.current = window.setTimeout(() => {
      chromeTimerRef.current = null;
      setChromePinned(false);
    }, INSPECT_CHROME_HIDE_MS);
  }, [clearChromeTimer]);
  useEffect(() => clearChromeTimer, [clearChromeTimer]);

  /** 官方 `N = media.type === "image"` + `T = N && g === "inspect"` */
  const inspectingImage = mediaType === 'image' && mode === 'inspect';
  /** 官方 `$ = !isText && phase !== "closing"` + `W = $ && !T` */
  const previewVisible = isOpen && !inspectingImage;
  /** 官方 `Y = W || (T && v)`：chrome（返回箭头）可见 */
  const chromeVisible = previewVisible || (inspectingImage && chromePinned);

  /** 官方 `R`：请求进入检视态 */
  const requestInspect = useCallback(() => {
    if (!isOpen || mediaType !== 'image') return;
    clearChromeTimer();
    setChromePinned(false);
    setMode('inspect');
  }, [clearChromeTimer, isOpen, mediaType]);

  /** 官方 `I`：请求回预览态 */
  const requestPreview = useCallback(() => {
    clearChromeTimer();
    setChromePinned(false);
    setMode('preview');
  }, [clearChromeTimer]);

  /** 官方 `z`：检视态下点图 ⇒ 亮出 chrome 3 秒（**不是**退出检视；退出走 `P`） */
  const revealChrome = useCallback(() => {
    if (!inspectingImage) return;
    setChromePinned(true);
    scheduleChromeHide();
  }, [inspectingImage, scheduleChromeHide]);

  /* 关闭后复位检视态（官方 `g` 只在会话内）。用「渲染期按 props 复位」而不是 effect ——
     `set-state-in-effect` 是仓库 lint 的硬门；两处 set 在已经复位时会被 React 直接 bail out。 */
  const [openedFor, setOpenedFor] = useState(isOpen);
  if (openedFor !== isOpen) {
    setOpenedFor(isOpen);
    if (!isOpen) {
      setChromePinned(false);
      setMode('preview');
    }
  }

  /* ────────────────────────────────────────────────────────────────────────
     图片检视层（官方 `Xye` + `yve`）：预览矩形 / 检视矩形 / 导航
     ──────────────────────────────────────────────────────────────────────── */
  /** 图片在媒体容器里的 contain 贴合矩形（官方 `W2(containerRect, media)`），**容器坐标** */
  const localFrame = useMemo(() => fitFrame(containerRect, intrinsic), [containerRect, intrinsic]);
  /** 官方 `previewRect`（视口坐标） */
  const previewRect: NavRect | null = useMemo(() => (
    containerRect.width > 0
      ? { ...localFrame, left: containerRect.left + localFrame.left, top: containerRect.top + localFrame.top }
      : null
  ), [containerRect.left, containerRect.top, containerRect.width, localFrame]);
  /** 官方 `inspectRect = W2(tve(), media)`（视口坐标；`tve()` = 视口四周内缩 24px） */
  const inspectRect: NavRect | null = useMemo(() => (
    intrinsic && viewport.width > 0
      ? fitRectIn(inspectContainerRect(viewport), intrinsic)
      : null
  ), [intrinsic, viewport]);

  /** 官方 `D = () => { v && C() }`（`yve` 的 `onInteraction`）：检视态里的交互重新计时 chrome */
  const handleInspectInteraction = useCallback(() => {
    if (chromePinned) scheduleChromeHide();
  }, [chromePinned, scheduleChromeHide]);

  const navigation = useMediaViewerImageNavigation({
    active: isOpen,
    inspecting: inspectingImage,
    sourceId: displaySrc,
    previewRect,
    inspectRect,
    onRequestInspect: requestInspect,
    onRequestPreview: requestPreview,
    onInteraction: handleInspectInteraction,
  });
  const {
    frameRef: imageLayerRef,
    imageStyle,
    isDragging: imageDragging,
    isZoomed: imageZoomed,
    isReturning: imageReturning,
    zoomToContain,
    returnToPreview,
    resetToPreview,
    handleTransitionEnd,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleAuxClick,
    consumeClickAfterDrag,
  } = navigation;

  /**
   * 官方 `onImageClick = T ? z : L`：
   * ```js
   * L = () => { R(); G.zoomToContain() }   // 预览态点图 ⇒ 进检视（自然像素 1:1）
   * z = () => { T && (y(!0), C()) }        // 检视态点图 ⇒ 亮出 chrome 3 秒
   * ```
   */
  const handleImageClick = useCallback(() => {
    if (inspectingImage) {
      revealChrome();
      return;
    }
    requestInspect();
    zoomToContain();
  }, [inspectingImage, requestInspect, revealChrome, zoomToContain]);

  /** 官方 `M` / `B`（顶栏 `motion.div` 的 pointer enter/leave、focus/blur capture） */
  const handleChromeEnter = useCallback(() => {
    if (chromePinned) clearChromeTimer();
  }, [chromePinned, clearChromeTimer]);
  const handleChromeLeave = useCallback(() => {
    if (chromePinned) scheduleChromeHide();
  }, [chromePinned, scheduleChromeHide]);

  /**
   * 官方 `P` @583360（返回键 / Esc 共用一个入口）：
   * ```js
   * if (T) { G.returnToPreview(); I(); return }   // 放大态 ⇒ 退回预览态，**不关**
   * s()                                          // 非放大态 ⇒ 才真的关
   * ```
   * ⇒ 一级 Esc/返回 = 退出放大；二级才关掉查看器。
   */
  const handleBack = useCallback(() => {
    if (inspectingImage) {
      returnToPreview();
      requestPreview();
      return;
    }
    onClose();
  }, [inspectingImage, onClose, requestPreview, returnToPreview]);

  /* 官方 `j` @583406 的 Esc 分支：
     `re.key==="Escape" && (document.fullscreenElement || (preventDefault(), stopPropagation(), P()))`
     ⚠️ 官方挂在根元素 `onKeyDown`；MTV 的查看器是 portal 出来的浮层 ⇒ 用 `document` **capture**
     （画廊的 `window` capture 在查看器打开时直接 return，不会抢）。 */
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      /* 原生全屏里 Esc 归浏览器（退全屏），查看器/画廊都留着 */
      if (document.fullscreenElement) return;
      event.preventDefault();
      event.stopPropagation();
      handleBack();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleBack, isOpen]);

  /* 官方 `V` @583380（点空白关）：
     ```js
     if (phase !== "open") return;
     if (T) { z(); return }
     const te = ne.target; te instanceof Element && te.closest("[data-media-viewer-dismiss-blocker]") || P()
     ```
     MTV 的对偶：空白层 `onPointerDown`（`target === currentTarget`）→ 同一条分支。 */
  const handleLayerPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (inspectingImage) {
      revealChrome();
      return;
    }
    onClose();
  }, [inspectingImage, onClose, revealChrome]);

  /** 换图/换版本时复位视图（官方 `imageReset` / `useEffect(...,[t.id, p?.src])` 里的 `x()`） */
  useEffect(() => {
    resetToPreview();
  }, [displaySrc, resetToPreview]);

  /** 官方 `Iwe(f, Y, a)` 的**非文本**分支：`{duration: On.returnButton, ease: On.sharedMedia.ease}` */
  const chromeTransition = {
    duration: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.returnButton.durationSeconds,
    ease: MEDIA_VIEWER_MOTION.sharedMedia.ease,
  };
  const chrome = {
    duration: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.chrome.durationSeconds,
    ease: MEDIA_VIEWER_MOTION.chrome.ease,
  };
  const showHistory = shouldShowMediaHistory(historyVersions.length);
  const isImage = mediaType === 'image' && !mediaContent;

  /** 官方 `Xye` 的类名（逐字，见文件头） */
  const imageLayerClassName = [
    'absolute z-20',
    isImage && (inspectingImage || imageReturning) ? 'overflow-visible' : 'overflow-hidden',
    isImage && !inspectingImage && 'cursor-zoom-in',
    inspectingImage && imageZoomed && (imageDragging ? 'cursor-grabbing' : 'cursor-grab'),
  ].filter(Boolean).join(' ');

  /* ★★★ 结构必须是 **portal 在外、`AnimatePresence` 在内**（曾经反过来，导致整个查看器不渲染）。
   *
   * `createPortal()` 返回的是 `ReactPortal`，**不是 `ReactElement`**
   * （`React.isValidElement(portal) === false`，它的 `$$typeof` 是 `react.portal`）。
   * 而 framer-motion 的 `AnimatePresence` 内部对 children 做的是
   * `Children.toArray(children).filter(isValidElement)` ⇒ **portal 子节点会被静默丢掉**：
   * 组件不报错、不警告，portal 里的 DOM **一个都不出现**。
   *
   * 修法：把 `AnimatePresence` 放进 portal 里 —— 退出动画照常由它驱动，
   * 且 portal 本身不再经过 `isValidElement` 过滤 ✓ */
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="media-viewer__layer"
          data-media-viewer="media"
          {...(inspectingImage ? { 'data-media-viewer-inspecting-image': true } : {})}
          role="dialog"
          aria-modal="true"
          onPointerDown={handleLayerPointerDown}
          initial={{ opacity: reducedMotion ? 1 : 0 }}
          animate={{ opacity: 1, transition: { duration: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.backdrop.durationSeconds, ease: MEDIA_VIEWER_MOTION.backdrop.ease } }}
          exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.backdrop.durationSeconds, ease: MEDIA_VIEWER_MOTION.backdrop.ease } }}
        >
          {/* 官方的黑底层（与文本查看器同一条 `On.backdrop`） */}
          <motion.div
            className="media-viewer__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.backdrop.durationSeconds, ease: MEDIA_VIEWER_MOTION.backdrop.ease } }}
            exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.backdrop.durationSeconds, ease: MEDIA_VIEWER_MOTION.backdrop.ease } }}
          />

          {/* ★ 官方左上返回箭头 @585428（细节见文件头） */}
          <header
            data-media-viewer-dismiss-blocker=""
            className="fixed inset-x-0 top-0 z-30 h-20"
            style={{ pointerEvents: chromeVisible ? 'auto' : 'none' }}
          >
            <motion.div
              className="absolute left-5 top-5"
              onPointerEnter={handleChromeEnter}
              onPointerLeave={handleChromeLeave}
              onFocusCapture={handleChromeEnter}
              onBlurCapture={handleChromeLeave}
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: chromeVisible ? 1 : 0, x: chromeVisible ? 0 : -28 }}
              transition={chromeTransition}
            >
              <MediaViewerActionButton
                label={t('返回')}
                surface="solid"
                showTooltip={false}
                onClick={handleBack}
              >
                <OfficialIcon name="actions-back" size={20} />
              </MediaViewerActionButton>
            </motion.div>
          </header>

          <motion.div
            /* 官方 @585468 的媒体列外层：`relative z-10 min-h-full w-screen px-8 pb-32 pt-16`
               （`px-8 pb-32 pt-16` 在 MTV 落在 `.media-viewer__layer` 上，这里只留定位与宽度）
               ⚠️ MTV 原来多写了 `flex flex-col justify-center` —— **已删**：
                  `justify-center` 会让内容高度变化（提示词/历史/事实异步挂上）时整列上下重排，
                  实测媒体框的 `top` 会从 64 漂到 56，而 `previewRect` 只在挂载时量一次
                  ⇒ 放大后的图会偏 8px。官方没有 flex ⇒ 贴 `pt-16` 后位置恒定 ✓ */
            className="relative z-10 min-h-full w-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { ...chrome, delay: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.chrome.delaySeconds } }}
            exit={{ opacity: 0, transition: chrome }}
          >
            {/* 官方 `main.media-viewer__media-column.relative.mx-auto` + 帧变量。
                `--media-viewer-chrome-opacity` = 官方媒体列的 `opacity: W`（见文件头偏离 2）。 */}
            <main
              className="media-viewer__media-column relative mx-auto"
              data-media-viewer-preview={previewVisible ? undefined : 'false'}
              style={{
                ...(vars as React.CSSProperties),
                '--media-viewer-chrome-opacity': previewVisible ? '1' : '0',
              } as React.CSSProperties}
            >
              {/* 官方媒体容器：`relative h-[calc(100vh-240px)] min-h-[320px] w-full` */}
              <div className="media-viewer__frame" ref={frameContainerRef}>
                {isImage ? (
                  /* ★ 官方 `Xye` @476418：绝对定位在 `previewRect` 上的图片层 */
                  <div
                    ref={imageLayerRef}
                    data-media-viewer-dismiss-blocker=""
                    {...(inspectingImage ? { 'data-media-viewer-image-inspecting': true } : {})}
                    {...(imageReturning ? { 'data-media-viewer-image-returning': true } : {})}
                    className={imageLayerClassName}
                    style={containerRect.width > 0 ? {
                      left: localFrame.left,
                      top: localFrame.top,
                      width: localFrame.width,
                      height: localFrame.height,
                      transformOrigin: 'top left',
                      touchAction: inspectingImage ? 'none' : undefined,
                    } : {
                      /* 兜底：媒体容器还没量到（首帧）⇒ 先铺满画框，别渲染成 0×0 的黑底 */
                      inset: 0,
                      transformOrigin: 'top left',
                      touchAction: inspectingImage ? 'none' : undefined,
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onPointerCancel={handlePointerEnd}
                    onAuxClick={handleAuxClick}
                    onClick={() => { if (!consumeClickAfterDrag()) handleImageClick(); }}
                  >
                    {/* 官方 `Sye` 的根：`relative size-full overflow-hidden` + `navigation.imageStyle` */}
                    <div
                      className="relative size-full overflow-hidden"
                      style={{ ...imageStyle, cursor: 'inherit' }}
                      onTransitionEnd={handleTransitionEnd}
                    >
                      <img
                        className="media-viewer__media"
                        src={displaySrc}
                        alt=""
                        draggable={false}
                        onLoad={(event) => {
                          const image = event.currentTarget;
                          if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                            setProbedSize({ src: displaySrc, width: image.naturalWidth, height: image.naturalHeight });
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative size-full overflow-hidden">
                    {mediaContent ?? (
                      /* 视频分支：官方 `Nbe` = 旧/新双 `<video>` 交叉淡入（`On.contentHandoff`）+ 播放交接；
                         MTV 的视频卡把自己的 `<video>` 通过 `mediaContent` 传进来（保留其播放交接/内存守卫机件），
                         这里的内建 `<video>` 只是没有自定义播放器时的兜底 */
                      <video
                        className="media-viewer__media"
                        src={displaySrc}
                        controls
                        autoPlay
                        playsInline
                        crossOrigin="anonymous"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* 官方：提示词在帧下方，宽度 = 帧宽（`.media-viewer__prompt`） */}
              {prompt && (
                <div data-media-viewer-dismiss-blocker="" className="media-viewer__prompt">
                  <MediaViewerPrompt prompt={prompt} />
                </div>
              )}

              {/* 官方 `Obe`：历史列（左），`resources.length > 1` 才渲染 */}
              {showHistory && (
                <MediaViewerHistory
                  versions={historyVersions}
                  currentSrc={displaySrc}
                  onSelect={onSelectVersion}
                />
              )}

              {/* 官方 `tbe`：事实侧栏（右），`motion.aside` x:18→0 / .24s / delay .08 */}
              <motion.aside
                data-media-viewer-dismiss-blocker=""
                className="media-viewer__facts"
                initial={{ x: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.chrome.offsetPixels }}
                animate={{ x: 0, transition: { ...chrome, delay: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.chrome.delaySeconds } }}
                exit={{ x: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.chrome.offsetPixels, transition: chrome }}
              >
                <MediaViewerFacts
                  mediaType={mediaType}
                  width={intrinsic?.width ?? width}
                  height={intrinsic?.height ?? height}
                  createdAt={createdAt}
                  model={model}
                  durationSeconds={durationSeconds}
                />
              </motion.aside>
            </main>
          </motion.div>

          {/* 官方底部操作条落点：`p && phase==="open" && W`（检视态整个条退场） */}
          {actions && previewVisible && (
            <motion.div
              data-media-viewer-dismiss-blocker=""
              className="media-viewer__chrome-bottom"
              initial={{ opacity: 0, y: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.actions.offsetPixels }}
              animate={{ opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.actions.enterDurationSeconds, ease: MEDIA_VIEWER_MOTION.actions.ease } }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.actions.offsetPixels, transition: { duration: reducedMotion ? 0 : MEDIA_VIEWER_MOTION.actions.exitDurationSeconds, ease: MEDIA_VIEWER_MOTION.actions.ease } }}
            >
              {actions}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
