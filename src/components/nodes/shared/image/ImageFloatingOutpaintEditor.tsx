/**
 * ImageFloatingOutpaintEditor —— 官方「扩图」浮动编辑器（`mode==='outpaint'`）1:1 复刻
 * ══════════════════════════════════════════════════════════════════════════
 * 官方源码出处（`E:\TapNow-0.4.66\resources\web\assets\page-DVqoHdTT.js`）：
 *  · 宿主 `Fhe` @1341333（EditorContainer）
 *      - 顶栏：`mode==='crop'||mode==='outpaint'` ⇒ **null**（扩图没有顶栏，✕ 在底栏里）
 *      - 画布：`default: <xhe/>`；`outpaint: <yhe containerWidth={S} containerHeight={b} imageWidth={v}
 *              imageHeight={_} src imageOffset={o} outpaintRect={N} onChange={k} visible={A}/>`
 *        其中 `v = nodeW*zoom`、`_ = nodeH*zoom`（**屏幕像素**）、
 *        `S = panelSize.width || v`、`b = panelSize.height || _`（扩图时 = 面板 = 安全区）
 *      - 底栏：`redraw|erase|outpaint` ⇒ `absolute left-1/2 -translate-x-1/2 z-50 w-[500px]` +
 *              `mode==='redraw' ? '-bottom-[130px]' : '-bottom-[64px]'` ⇒ 扩图 = **-64px**
 *      - 外壳：`w-full h-full relative overflow-visible` + `mode!=='outpaint' && 'outline-2 outline-primary/30'`
 *              ⇒ **扩图没有蓝色外框**
 *  · 取景 `Uhe` @1342（对 outpaint 的调用）：
 *      `hf({ node, onClose, safeArea:{top:80,bottom:88,horizontal:72}, fitMarginRatio:.6, layout:'safeArea' })`
 *  · 面板 `hf` @1024400（`layout==='safeArea'` 分支，逐字）：
 *      `panelStyle = { left: safeArea.horizontal, top: safeArea.top,
 *                      width: viewportW - horizontal*2, height: viewportH - top - bottom }`
 *      `nodePositionInPanel = { x: nodeScreenX - horizontal, y: nodeScreenY - top }`
 *      （overlayNode 分支才是节点自身尺寸 —— 扩图走 safeArea 分支）
 *  · pad / 比例数学 `Lhe` @1338203（`pixelOutpaintRect` / `handleOutpaintChange` / `handleOutpaintRatioSelect`）
 *  · 手柄拖拽 `dO` @1300076（`fhe` 手柄向量、角点锁比例、minSize 40、全程夹在容器内）
 *  · 覆盖层 `yhe` @1303000（`bg-black/80 backdrop-blur-md` 底 + 图 + `border-white/50` + 三分线 + 8 手柄 + 整块可拖）
 *  · 底栏 `Dhe` @1333679（outpaint 分支：左 = `Ahe`(✕ + 分隔 + 宽高比) + `Ihe`(提示)；
 *      右 = `basis-full` 一行 `Nhe`(chip+模型) + `Wu`(生成胶囊，`ml-auto`)、tooltip = `image.promptBar.outpaint`）
 *  · 生成 `Phe.handleGenerate` @1330724（透明画布 `targetSize` + 原图 `offset` → 上传 → 建节点
 *      `{title: image.outpainting('扩图'), editSubType: Nv.OUT_PAINT}` + 边 + 固定提示词 `Mhe`）
 *  · 固定提示词 `Mhe` @1330424（逐字，三行）
 * ──────────────────────────────────────────────────────────────────────────
 * ★ 坐标系：官方画在**未缩放的画布空间**（面板 = 屏幕像素的安全区矩形）。
 *   MTV 的编辑器挂在节点内部（随画布缩放）⇒ 这里用 `.opf-panel`（流坐标定位）+ `.opf-screen`
 *   （`width/height` = 面板屏幕尺寸，`transform: scale(1/zoom)`）复刻「屏幕像素层」，
 *   层内 `--irf-scale` 被重置为 1 ⇒ 底栏可以直接复用 redraw 那套 `.irf-*`（同为屏幕像素）✓
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useStore } from '@xyflow/react';
import { useT } from '../../../../i18n';
import { useAppStore } from '../../../../store/useAppStore';
import { getCanvasViewportController } from '../../../../services/canvasViewportService';
import ModelSelector from '../ModelSelector';
import { createSafeImagePreviewSource, type SafeImagePreviewSource } from './imageUtils';
import { Icon } from './floatingEditorIcons';
import { CropRatioMenu } from './ImageFloatingCropEditor';

/* 官方 `Uhe` 给 outpaint 的取景参数（`hf` 的 safeArea 覆盖值 + fitMarginRatio） */
const OUTPAINT_SAFE_TOP = 80;
const OUTPAINT_SAFE_BOTTOM = 88;
const OUTPAINT_SAFE_HORIZONTAL = 72;
const OUTPAINT_FIT_MARGIN_RATIO = 0.6;   // `Lhe`/`hf`：`z = 能放下的比例 × (1 - .6)`
const OUTPAINT_MIN_ZOOM_RATIO = 0.01;
const RATIO_SELECT_MIN_SIZE = 40;        // 官方 `dO` 的 `minSize=40`（屏幕像素）

/** 官方 `Mhe`（逐字，**含换行**） */
export const OUTPAINT_PROMPT_TEMPLATE = `Seamlessly extend the image into the empty transparent areas around it.
Carefully analyze the existing scene.
Only generate new content in the transparent regions, blending invisibly with the existing edges.`;

export interface OutpaintGeneratePayload {
  /** 官方 `Phe` 里那张「透明底 + 原图」的合成图（data URL；**原图像素**尺寸） */
  compositeDataUrl: string;
  /** 目标画布尺寸（原图像素） */
  width: number;
  height: number;
  model?: string;
  /** 官方 `Nhe` 的分辨率 chip */
  resolution?: string;
  /** 官方 `Nhe` 的次数 chip */
  times: number;
}

export interface ImageFloatingOutpaintEditorProps {
  nodeId?: string;
  imageUrl: string;
  /** 节点**流尺寸**（官方 `node.measured.width/height`） */
  containerWidth: number;
  containerHeight: number;
  defaultModel?: string;
  onCancel: () => void;
  onGenerate: (payload: OutpaintGeneratePayload) => void | Promise<void>;
}

type HandleId = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
interface Rect { x: number; y: number; width: number; height: number }
interface Pad { left: number; right: number; top: number; bottom: number }

/** 官方 `fhe`（手柄 → 单位向量） */
const HANDLE_VECTORS: Record<HandleId, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  tl: { x: -1, y: -1 }, tr: { x: 1, y: -1 }, bl: { x: -1, y: 1 }, br: { x: 1, y: 1 },
  t: { x: 0, y: -1 }, b: { x: 0, y: 1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 },
};

/** 官方 `dO` @1300076（逐字语义，注释为官方那一行的直译） */
function resizeRect({
  initialRect,
  deltaX,
  deltaY,
  activeHandle,
  containerWidth,
  containerHeight,
  minSize = RATIO_SELECT_MIN_SIZE,
}: {
  initialRect: Rect;
  deltaX: number;
  deltaY: number;
  activeHandle: HandleId | null;
  containerWidth: number;
  containerHeight: number;
  minSize?: number;
}): Rect {
  if (!activeHandle) {
    return {
      ...initialRect,
      x: Math.max(0, Math.min(initialRect.x + deltaX, containerWidth - initialRect.width)),
      y: Math.max(0, Math.min(initialRect.y + deltaY, containerHeight - initialRect.height)),
    };
  }
  const vector = HANDLE_VECTORS[activeHandle];
  if (!vector) return initialRect;
  const aspect = initialRect.width / initialRect.height;
  const isCorner = vector.x !== 0 && vector.y !== 0;
  let width = initialRect.width + vector.x * deltaX;
  let height = initialRect.height + vector.y * deltaY;
  if (isCorner) {
    /* 角点锁比例：按位移更大的那一轴决定另一轴 */
    const dx = width - initialRect.width;
    const dy = height - initialRect.height;
    if (Math.abs(dx / aspect) > Math.abs(dy)) height = width / aspect;
    else width = height * aspect;
  }
  if (width < minSize || height < minSize) {
    if (isCorner) {
      if (width < minSize) { width = minSize; height = width / aspect; }
      if (height < minSize) { height = minSize; width = height * aspect; }
    } else {
      width = Math.max(minSize, width);
      height = Math.max(minSize, height);
    }
  }
  let x = initialRect.x;
  let y = initialRect.y;
  if (vector.x === -1) x = initialRect.x + initialRect.width - width;
  if (vector.y === -1) y = initialRect.y + initialRect.height - height;
  if (x < 0) {
    x = 0;
    if (isCorner) {
      width = initialRect.x + initialRect.width;
      height = width / aspect;
      if (vector.y === -1) y = initialRect.y + initialRect.height - height;
    } else if (vector.x === -1) {
      width = initialRect.x + initialRect.width;
    }
  }
  if (y < 0) {
    y = 0;
    if (isCorner) {
      height = initialRect.y + initialRect.height;
      width = height * aspect;
      if (vector.x === -1) x = initialRect.x + initialRect.width - width;
    } else if (vector.y === -1) {
      height = initialRect.y + initialRect.height;
    }
  }
  if (x + width > containerWidth) {
    if (isCorner) {
      width = containerWidth - x;
      height = width / aspect;
      if (vector.y === -1) y = initialRect.y + initialRect.height - height;
    } else if (vector.x === 1) {
      width = containerWidth - x;
    }
  }
  if (y + height > containerHeight) {
    if (isCorner) {
      height = containerHeight - y;
      width = height * aspect;
      if (vector.x === -1) x = initialRect.x + initialRect.width - width;
    } else if (vector.y === 1) {
      height = containerHeight - y;
    }
  }
  return { x, y, width, height };
}

export default function ImageFloatingOutpaintEditor({
  nodeId,
  imageUrl,
  containerWidth,
  containerHeight,
  defaultModel,
  onCancel,
  onGenerate,
}: ImageFloatingOutpaintEditorProps) {
  const t = useT();
  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const workflows = useAppStore((s) => s.workflows);
  const editedNodeId = nodeId ?? activeNodeId ?? undefined;
  /* 官方 `Fhe`：`const u = Ht(L=>L.transform); const [f,p] = useState(1); useEffect(()=>p(u[2]),[u])` */
  const transform = useStore((s) => s.transform);
  const paneWidth = useStore((s) => s.width);
  const paneHeight = useStore((s) => s.height);
  const zoom = transform?.[2] ?? 1;
  const inverseZoom = zoom > 0 ? 1 / zoom : 1;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; initialRect: Rect; activeHandle: HandleId | null } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<HandleId | null>(null);
  /* 官方打开时先 `setPad({0,0,0,0})`、紧接着 `y('original')`（铺成 1.5 倍）；
     MTV 用 `null` 表示「还没动过」⇒ 走 `derivedRect`（同一段 `y('original')` 数学），
     用户一拖动才写 `pad` ✓ */
  const [pad, setPad] = useState<Pad | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<{ width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string | undefined>(defaultModel);
  const [resolution, setResolution] = useState<string>('2K');
  const [times, setTimes] = useState(1);

  /* ── 面板几何（官方 `hf` 的 `layout==='safeArea'` 分支，逐字） ── */
  const panel = useMemo(() => {
    const width = Math.max(0, (paneWidth || 0) - OUTPAINT_SAFE_HORIZONTAL * 2);
    const height = Math.max(0, (paneHeight || 0) - OUTPAINT_SAFE_TOP - OUTPAINT_SAFE_BOTTOM);
    /* 官方 `hf`：`K = node.x*zoom + transform.x`（节点屏幕左上角），
       `nodePositionInPanel = {x: K - horizontal, y: W - top}` */
    const node = useAppStore.getState().nodes.find((item) => item.id === editedNodeId);
    const nodeFlowX = node?.position?.x ?? 0;
    const nodeFlowY = node?.position?.y ?? 0;
    const nodeScreenX = nodeFlowX * zoom + (transform?.[0] ?? 0);
    const nodeScreenY = nodeFlowY * zoom + (transform?.[1] ?? 0);
    return {
      width,
      height,
      /* 面板左上角在**节点本地流坐标**里 */
      localX: (OUTPAINT_SAFE_HORIZONTAL - nodeScreenX) * inverseZoom,
      localY: (OUTPAINT_SAFE_TOP - nodeScreenY) * inverseZoom,
      nodePositionInPanel: {
        x: nodeScreenX - OUTPAINT_SAFE_HORIZONTAL,
        y: nodeScreenY - OUTPAINT_SAFE_TOP,
      },
    };
  }, [editedNodeId, inverseZoom, paneHeight, paneWidth, transform, zoom]);

  /* 图片显示尺寸（官方 `v,_ = nodeW*zoom, nodeH*zoom`，屏幕像素） */
  const imageWidth = Math.max(1, containerWidth * zoom);
  const imageHeight = Math.max(1, containerHeight * zoom);

  /* 源图（拿自然尺寸 = 官方 `ka().originalSize`） */
  useEffect(() => {
    let active = true;
    let prepared: SafeImagePreviewSource | null = null;
    void createSafeImagePreviewSource(imageUrl, '扩图源图')
      .then((result) => {
        if (!active) { result.release(); return; }
        prepared = result;
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          if (!active) return;
          setSource({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
          setLoaded(true);
        };
        image.src = result.src;
      })
      .catch((error: unknown) => {
        if (!active) return;
        useAppStore.getState().showToast(
          error instanceof Error ? error.message : t('扩图源图读取失败，请重试'),
          'error',
        );
        onCancel();
      });
    return () => {
      active = false;
      prepared?.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  /* ── pad ⇄ 像素矩形（官方 `Lhe` 的两段数学） ── */
  const toRect = useCallback((value: Pad): Rect | null => {
    if (!imageWidth || !imageHeight) return null;
    const padLeft = value.left * imageWidth;
    const padRight = value.right * imageWidth;
    const padTop = value.top * imageHeight;
    const padBottom = value.bottom * imageHeight;
    const originX = panel.nodePositionInPanel.x;
    const originY = panel.nodePositionInPanel.y;
    return {
      x: originX - padLeft,
      y: originY - padTop,
      width: imageWidth + padLeft + padRight,
      height: imageHeight + padTop + padBottom,
    };
  }, [imageHeight, imageWidth, panel.nodePositionInPanel.x, panel.nodePositionInPanel.y]);

  const toPad = useCallback((rect: Rect): Pad | null => {
    if (!imageWidth || !imageHeight) return null;
    const originX = panel.nodePositionInPanel.x;
    const originY = panel.nodePositionInPanel.y;
    const imageRight = originX + imageWidth;
    const imageBottom = originY + imageHeight;
    /* 官方：目标矩形必须包含原图（不够大就等比放大） */
    let width = rect.width;
    let height = rect.height;
    if (width < imageWidth || height < imageHeight) {
      const scale = Math.max(imageWidth / width, imageHeight / height);
      width = rect.width * scale;
      height = rect.height * scale;
    }
    const minX = imageRight - width;
    const maxX = originX;
    const minY = imageBottom - height;
    const maxY = originY;
    const x = Math.min(Math.max(rect.x, minX), maxX);
    const y = Math.min(Math.max(rect.y, minY), maxY);
    return {
      left: Math.max(0, originX - x) / imageWidth,
      right: Math.max(0, x + width - imageRight) / imageWidth,
      top: Math.max(0, originY - y) / imageHeight,
      bottom: Math.max(0, y + height - imageBottom) / imageHeight,
    };
  }, [imageHeight, imageWidth, panel.nodePositionInPanel.x, panel.nodePositionInPanel.y]);

  /* 官方 `Lhe.y` 的纯函数版（比例 → 目标矩形）：初始态与「点比例」共用同一段数学 */
  const rectForRatio = useCallback((aspect: number): Rect | null => {
    if (!imageWidth || !imageHeight || panel.width <= 0) return null;
    const originX = panel.nodePositionInPanel.x;
    const originY = panel.nodePositionInPanel.y;
    /* 官方：先取 1.5 倍宽，再保证高 ≥ 1.2 倍、宽 ≥ 1 倍，最后按容器夹取 */
    let targetWidth = imageWidth * 1.5;
    let targetHeight = targetWidth / aspect;
    if (targetHeight < imageHeight) {
      targetHeight = imageHeight * 1.2;
      targetWidth = targetHeight * aspect;
    }
    if (targetWidth < imageWidth) {
      targetWidth = imageWidth;
      targetHeight = targetWidth / aspect;
    }
    const fit = Math.min(1, panel.width / targetWidth, panel.height / targetHeight);
    targetWidth *= fit;
    targetHeight *= fit;
    return {
      x: originX + imageWidth / 2 - targetWidth / 2,
      y: originY + imageHeight / 2 - targetHeight / 2,
      width: targetWidth,
      height: targetHeight,
    };
  }, [imageHeight, imageWidth, panel.height, panel.nodePositionInPanel.x, panel.nodePositionInPanel.y, panel.width]);

  /** 原图比例（官方 `Lhe.y('original')`：`originalSize` 有就用它，否则用显示尺寸） */
  const originalAspect = source && source.width > 0 && source.height > 0
    ? source.width / source.height
    : imageWidth / Math.max(1, imageHeight);

  /* 官方打开时 `setPad({0,0,0,0})` 后立刻 `y('original')`；MTV 直接**派生**默认矩形
     （不在 effect 里 setState —— 用户一拖动才写 `pad`，几何后续变化也能跟上） */
  const derivedRect = useMemo(() => rectForRatio(originalAspect), [originalAspect, rectForRatio]);
  const effectiveRect = pad ? toRect(pad) : derivedRect;
  const effectivePad = useMemo(
    () => (pad ?? (derivedRect ? toPad(derivedRect) : null)),
    [derivedRect, pad, toPad],
  );

  const handleRectChange = useCallback((next: Rect) => {
    setRatio(null);              // 官方 `x`：拖动即解除比例锁定
    const nextPad = toPad(next);
    if (nextPad) setPad(nextPad);
  }, [toPad]);

  /* 官方 `Lhe.y`（比例选择：原图比例 / 数值） */
  const handleRatioSelect = useCallback((value: number | 'original') => {
    const aspect = value === 'original' ? originalAspect : value;
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    const next = rectForRatio(aspect);
    if (!next) return;
    const nextPad = toPad(next);
    if (!nextPad) return;
    setPad(nextPad);
    setRatio(aspect);
  }, [originalAspect, rectForRatio, toPad]);

  /* ── 取景（官方 `hf`：`z = min(能放下的比例) * (1 - fitMarginRatio)`，safeArea 80/88/72） ── */
  useEffect(() => {
    const controller = getCanvasViewportController();
    if (!controller || !editedNodeId) return;
    const snapshot = controller.getSnapshot();
    const viewportWidth = snapshot.visibleBounds.width * snapshot.zoom;
    const viewportHeight = snapshot.visibleBounds.height * snapshot.zoom;
    if (!(viewportWidth > 0) || !(viewportHeight > 0)) return;
    const node = useAppStore.getState().nodes.find((item) => item.id === editedNodeId);
    if (!node) return;
    const nodeFlowX = node.position?.x ?? 0;
    const nodeFlowY = node.position?.y ?? 0;
    const fit = Math.min(
      (viewportWidth - OUTPAINT_SAFE_HORIZONTAL * 2) / Math.max(1, containerWidth),
      (viewportHeight - OUTPAINT_SAFE_TOP - OUTPAINT_SAFE_BOTTOM) / Math.max(1, containerHeight),
    );
    const target = Math.max(OUTPAINT_MIN_ZOOM_RATIO, fit * (1 - OUTPAINT_FIT_MARGIN_RATIO));
    if (!Number.isFinite(target) || target <= 0) return;
    const x = viewportWidth / 2 - (nodeFlowX + containerWidth / 2) * target;
    const y = OUTPAINT_SAFE_TOP + (viewportHeight - OUTPAINT_SAFE_TOP - OUTPAINT_SAFE_BOTTOM) / 2
      - (nodeFlowY + containerHeight / 2) * target;
    const targetCenterX = OUTPAINT_SAFE_HORIZONTAL + (viewportWidth - OUTPAINT_SAFE_HORIZONTAL * 2) / 2;
    const targetCenterY = OUTPAINT_SAFE_TOP + (viewportHeight - OUTPAINT_SAFE_TOP - OUTPAINT_SAFE_BOTTOM) / 2;
    const currentCenterX = (nodeFlowX + containerWidth / 2) * snapshot.zoom + snapshot.x;
    const currentCenterY = (nodeFlowY + containerHeight / 2) * snapshot.zoom + snapshot.y;
    const distance = Math.hypot(currentCenterX - targetCenterX, currentCenterY - targetCenterY);
    const deltaZoom = Math.abs(target - snapshot.zoom);
    const duration = Math.min(
      Math.max(200, 200 + distance * 0.5 + deltaZoom * 600 + (1 / Math.max(target, 0.2)) * 200),
      1500,
    );
    void controller.setViewport({ x, y, zoom: target }, duration);
    // 只在打开时取景一次（官方 re-fit 阈值只在节点被拖动时才触发）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedNodeId]);

  /* 取景后（zoom 变 → 面板几何变）默认矩形由 `derivedRect` 自动跟上 —— 无需 effect 初始化 */

  /* ── 拖拽（官方 `yhe`：窗口级 pointermove/pointerup + rAF 节流） ── */
  const handleMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = resizeRect({
      initialRect: drag.initialRect,
      deltaX: event.clientX - drag.startX,
      deltaY: event.clientY - drag.startY,
      activeHandle: drag.activeHandle,
      containerWidth: panel.width,
      containerHeight: panel.height,
    });
    handleRectChange(next);
  }, [handleRectChange, panel.height, panel.width]);

  useEffect(() => {
    if (!dragging) return;
    let frame: number | null = null;
    let latest: PointerEvent | null = null;
    const onMove = (event: PointerEvent) => {
      if (event.cancelable) event.preventDefault();
      latest = event;
      if (frame === null) {
        frame = requestAnimationFrame(() => {
          frame = null;
          if (latest) { handleMove(latest); latest = null; }
        });
      }
    };
    const onEnd = () => {
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      if (latest) { handleMove(latest); latest = null; }
      setDragging(false);
      setActiveHandle(null);
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragging, handleMove]);

  const beginDrag = (event: ReactPointerEvent, handle: HandleId | null = null) => {
    if (!event.isPrimary) return;
    event.stopPropagation();
    event.preventDefault();
    if (!effectiveRect) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, initialRect: { ...effectiveRect }, activeHandle: handle };
    setDragging(true);
    setActiveHandle(handle);
  };

  /* ── 提交（官方 `Dhe.z()` 的 outpaint 分支 + `Phe.handleGenerate`） ── */
  const handleGenerate = useCallback(async () => {
    if (busy || !effectiveRect || !source || !effectivePad) return;
    /* 官方：显示 → 原图 的换算比例 */
    const scaleX = source.width / Math.max(1, imageWidth);
    const scaleY = source.height / Math.max(1, imageHeight);
    let targetWidth = Math.round(effectiveRect.width * scaleX);
    let targetHeight = Math.round(effectiveRect.height * scaleY);
    if (targetWidth <= 0 || targetHeight <= 0) return;
    let correctionX = 0;
    let correctionY = 0;
    /* 官方 `D`：锁了比例时把目标尺寸补到正好等于比例（多出来的部分左右/上下均分） */
    if (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0) {
      if (targetWidth / targetHeight < ratio) {
        const next = Math.ceil(targetHeight * ratio);
        correctionX = (next - targetWidth) / 2;
        targetWidth = next;
      } else if (targetWidth / targetHeight > ratio) {
        const next = Math.ceil(targetWidth / ratio);
        correctionY = (next - targetHeight) / 2;
        targetHeight = next;
      }
    }
    const offsetX = Math.round(effectivePad.left * imageWidth * scaleX + correctionX);
    const offsetY = Math.round(effectivePad.top * imageHeight * scaleY + correctionY);
    setBusy(true);
    try {
      const prepared = await createSafeImagePreviewSource(imageUrl, '扩图源图');
      try {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('failed'));
          image.src = prepared.src;
        });
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no-ctx');
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(image, offsetX, offsetY, source.width, source.height);
        const compositeDataUrl = canvas.toDataURL('image/png');
        await onGenerate({ compositeDataUrl, width: targetWidth, height: targetHeight, model, resolution, times });
      } finally {
        prepared.release();
      }
    } catch (error: unknown) {
      useAppStore.getState().showToast(
        error instanceof Error && error.message ? error.message : t('扩图处理失败，请重试'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, effectivePad, effectiveRect, imageHeight, imageUrl, imageWidth, model, onGenerate, ratio, resolution, source, t, times]);

  const submitDisabled = busy || !effectiveRect || !source;

  return (
    <div
      ref={rootRef}
      className="opf-root nodrag nopan"
      data-testid="image-outpaint-editor"
      data-redraw-mode="outpaint"
    >
      {/* 官方 `hf` 的面板（safeArea 布局）：`left:72 top:80 w-144 h-168`（屏幕像素） */}
      <div
        className="opf-panel"
        style={{
          left: panel.localX,
          top: panel.localY,
          width: panel.width * inverseZoom,
          height: panel.height * inverseZoom,
        }}
      >
        <div
          className="opf-screen"
          style={{
            width: panel.width,
            height: panel.height,
            transform: `scale(${inverseZoom})`,
          }}
        >
          {/* 官方 `yhe` 覆盖层 */}
          <div className="opf-overlay">
            {effectiveRect && (
              <div
                className="opf-rect"
                style={{ left: effectiveRect.x, top: effectiveRect.y, width: effectiveRect.width, height: effectiveRect.height }}
              >
                {loaded && <div className="opf-backdrop" aria-hidden="true" />}
                {imageUrl && (
                  <div className="opf-image-layer" aria-hidden="true">
                    <img
                      className="opf-image"
                      src={imageUrl}
                      alt=""
                      draggable={false}
                      style={{
                        width: imageWidth,
                        height: imageHeight,
                        left: panel.nodePositionInPanel.x - effectiveRect.x,
                        top: panel.nodePositionInPanel.y - effectiveRect.y,
                      }}
                    />
                  </div>
                )}
                <div className="opf-border" aria-hidden="true" />
                <div className={`opf-grid${dragging || activeHandle ? ' is-on' : ''}`} aria-hidden="true">
                  <div className="opf-grid-h" style={{ top: '33.333%' }} />
                  <div className="opf-grid-h" style={{ top: '66.667%' }} />
                  <div className="opf-grid-v" style={{ left: '33.333%' }} />
                  <div className="opf-grid-v" style={{ left: '66.667%' }} />
                </div>
                {(['tl', 'tr', 'bl', 'br'] as const).map((handle) => (
                  <div
                    key={handle}
                    className={`opf-handle opf-handle--${handle}`}
                    role="presentation"
                    onPointerDown={(event) => beginDrag(event, handle)}
                    data-testid={`image-outpaint-handle-${handle}`}
                  >
                    <div className="opf-handle-h" />
                    <div className="opf-handle-v" />
                  </div>
                ))}
                {(['t', 'b'] as const).map((handle) => (
                  <div
                    key={handle}
                    className={`opf-handle opf-handle--${handle}`}
                    role="presentation"
                    onPointerDown={(event) => beginDrag(event, handle)}
                    data-testid={`image-outpaint-handle-${handle}`}
                  >
                    <div className="opf-handle-bar-h" />
                  </div>
                ))}
                {(['l', 'r'] as const).map((handle) => (
                  <div
                    key={handle}
                    className={`opf-handle opf-handle--${handle}`}
                    role="presentation"
                    onPointerDown={(event) => beginDrag(event, handle)}
                    data-testid={`image-outpaint-handle-${handle}`}
                  >
                    <div className="opf-handle-bar-v" />
                  </div>
                ))}
                <div className="opf-move" onPointerDown={(event) => beginDrag(event, null)} data-testid="image-outpaint-move" />
              </div>
            )}
          </div>

          {/* 官方 `Dhe`（outpaint 分支）—— 底栏；扩图**没有**顶栏 */}
          <div className="irf-bar opf-bar" data-testid="image-outpaint-bar">
            <div className="irf-bar-inner">
              <div className="irf-row">
                <div className="irf-row-left">
                  {/* 官方 `Ahe`：✕ + 1px 分隔 + 宽高比 */}
                  <button
                    type="button"
                    className="irf-btn opf-cancel"
                    onClick={onCancel}
                    title={t('取消')}
                    aria-label={t('取消')}
                    data-testid="image-outpaint-cancel"
                  >
                    <Icon name="x" size={18} />
                  </button>
                  <span className="opf-divider" aria-hidden="true" />
                  <CropRatioMenu disabled={busy} onSelect={handleRatioSelect} />
                  <div className="irf-hint">{t('拖拽外框进行扩图')}</div>
                </div>
                {/* 官方：`basis-full`（整行换行） */}
                <div className="irf-row-right-basis">
                  <div className="irf-selectors">
                    <button
                      type="button"
                      className="irf-chip"
                      title={t('分辨率')}
                      data-testid="image-outpaint-resolution"
                      onClick={() => {
                        const options = ['1K', '2K', '4K'];
                        const index = options.indexOf(resolution);
                        setResolution(options[index < 0 ? 0 : (index + 1) % options.length]);
                      }}
                    >
                      {resolution}
                    </button>
                    <button
                      type="button"
                      className="irf-chip"
                      title={t('生成次数')}
                      data-testid="image-outpaint-times"
                      onClick={() => setTimes(times === 4 ? 1 : times + 1)}
                    >
                      {`x${times}`}
                    </button>
                    <ModelSelector
                      nodeType="ai-image"
                      selectedModel={model}
                      onSelect={(option) => setModel(option.value)}
                      workflows={workflows}
                    />
                  </div>
                  <div className="irf-generate opf-generate">
                    {/* 官方 `Wu` 胶囊 = 预估价格图标 + 数字 + 白圆 ↑；MTV 没有价格源 ⇒ 数字放「次数」 */}
                    <div className="irf-generate-count" title={`${t('生成次数')} ${times}`}>
                      <Icon name="coins" size={16} />
                      <span className="irf-generate-number">{times}</span>
                    </div>
                    <button
                      type="button"
                      className="irf-generate-btn"
                      onClick={() => void handleGenerate()}
                      disabled={submitDisabled}
                      title={t('扩图')}
                      aria-label="Outpaint"
                      data-testid="image-outpaint-generate"
                    >
                      <Icon name="arrowUp" size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
