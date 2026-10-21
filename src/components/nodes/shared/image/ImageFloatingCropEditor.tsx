/**
 * ImageFloatingCropEditor —— 官方「图像浮动裁剪编辑器」**1:1 复刻**
 * （官方不是全屏弹窗：它覆盖在节点上，画布仍然可交互）
 *
 * 官方源码出处（`TapNowExtract/web/resources/web/assets/page-DPdEgTS0.js`）：
 *   · 容器     `dpe` @1322849  —— 默认选区 `{x:.1,y:.1,width:.8,height:.8}`；
 *                wrapper `w-full h-full relative overflow-visible outline-2 outline-primary/30`；
 *                浮条 `absolute -bottom-16 left-1/2 -translate-x-1/2 z-50 w-max`
 *   · 选区层   `Ufe` @1283854  —— 暗化底图 `brightness(0.5)` + `box-shadow:0 0 0 9999px rgba(0,0,0,.5)`
 *   · 手柄数学 `T5`  @1282907  —— minSize 40 · 角点锁比例 · 边手柄单轴 · 全程夹在容器内
 *   · 浮条     `zfe` @1291453  —— 取消 / 分隔线 / 宽高比 / 分隔线 / 确认裁剪
 *   · 浮动菜单 `j5`  @1288396  —— 原图比例 / 1:1 / 4:3 / 3:4 / 16:9 / 9:16 / 21:9 / 自定义…
 *   · 按钮原语 `KKo` @index-BiTZf8mJ.js 5920536 · 提示气泡 `u9e`/`K0` @index 2487065
 * 样式见 `src/styles/image-crop-float.css`（逐条注明官方类名与换算）。
 *
 * ★ 坐标系：官方把编辑器画在**未缩放的画布空间**（`px = 归一化 × 节点尺寸 × zoom`），
 *   因此手柄/描边/浮条都是**屏幕像素恒定**。MTV 把它画在**节点内**（随 React Flow 缩放）：
 *     · 选区几何用**流像素**（= 归一化 × 节点尺寸）；
 *     · 一切「固定屏幕像素」（手柄 3/12/24px、描边、浮条整体）乘 `--float-scale`（= 1/zoom）；
 *     · 最小选区 40px 同理取 `40 / zoom`。
 *   ⇒ 任意缩放下与官方逐像素一致（`--float-scale` 由 Canvas 每帧写在画布根上，与官方同源）。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../../../i18n';
import { useAppStore } from '../../../../store/useAppStore';
import { getCanvasViewportController } from '../../../../services/canvasViewportService';
import { assertEditorCanvasBudget, canvasToDataUrl } from './imageResourceBudget';
import { createSafeImagePreviewSource, type SafeImagePreviewSource } from './imageUtils';

/* 官方 `of` @1005456 的取景参数（`safeArea {top:80,bottom:88,horizontal:72}` + `fitMarginRatio:0`）
   ★★ **官方不夹取 zoom**：这条路径 `upe` 没传 `viewportFitOptions` ⇒ `minZoomRatio=.01`、
      `maxZoomRatio=+∞`，也不叠画布滚轮的上下限 ⇒ 卡片一定被放到「安全区内能放下的**最大**尺寸」。
      所以点裁剪后卡片**屏幕尺寸会明显变大**（小卡可能 5~7 倍），并移动到安全区正中 —— 这是官方行为，
      不要按 MTV 画布的滚轮缩放范围去夹（我上一版夹了 [0.15,2] ✗ 与源码不符，已去掉）。 */
const FIT_SAFE_TOP = 80;
const FIT_SAFE_BOTTOM = 88;
const FIT_SAFE_HORIZONTAL = 72;
const FIT_MIN_ZOOM_RATIO = 0.01;
/* 浮条：官方 `absolute -bottom-16` = `bottom:-64px` ⇒ **底边**锚定卡片下沿下方 64px（屏幕像素）。
   可见间距 = 64 − 浮条高(≈41.33) ≈ 22.7px ✓（官方上方工具栏 `-top-16` 是同一种「远端锚定 64」） */
export const CROP_BAR_GAP = 64;

/* ══════════════════════════════════════════════════════════════════════════
   几何：官方 `Ffe` @1282795 + `T5` @1282907（**逐字移植**，只改名）
   ══════════════════════════════════════════════════════════════════════════ */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type HandleId = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';

const HANDLE_DIRS: Record<HandleId, { x: number; y: number }> = {
  tl: { x: -1, y: -1 },
  tr: { x: 1, y: -1 },
  bl: { x: -1, y: 1 },
  br: { x: 1, y: 1 },
  t: { x: 0, y: -1 },
  b: { x: 0, y: 1 },
  l: { x: -1, y: 0 },
  r: { x: 1, y: 0 },
};

export const CROP_MIN_SIZE = 40;                       // 官方 `minSize = 40`（屏幕像素）

function resizeCropRect(options: {
  initialRect: CropRect;
  deltaX: number;
  deltaY: number;
  activeHandle: HandleId | null;
  containerWidth: number;
  containerHeight: number;
  minSize?: number;
}): CropRect {
  const {
    initialRect: t,
    deltaX: n,
    deltaY: s,
    activeHandle: i,
    containerWidth: o,
    containerHeight: a,
    minSize: c = CROP_MIN_SIZE,
  } = options;

  /* 无手柄 ⇒ 纯平移（夹在容器内） */
  if (!i) {
    return {
      ...t,
      x: Math.max(0, Math.min(t.x + n, o - t.width)),
      y: Math.max(0, Math.min(t.y + s, a - t.height)),
    };
  }
  const d = HANDLE_DIRS[i];
  if (!d) return t;

  const u = t.width / t.height;
  const f = d.x !== 0 && d.y !== 0;                    // 角点 ⇒ 锁比例
  let p = t.width + d.x * n;
  let h = t.height + d.y * s;
  if (f) {
    const y = p - t.width;
    const x = h - t.height;
    if (Math.abs(y / u) > Math.abs(x)) h = p / u;
    else p = h * u;
  }
  if (p < c || h < c) {
    if (f) {
      if (p < c) { p = c; h = p / u; }
      if (h < c) { h = c; p = h * u; }
    } else {
      p = Math.max(c, p);
      h = Math.max(c, h);
    }
  }
  let m = t.x;
  let g = t.y;
  if (d.x === -1) m = t.x + t.width - p;
  if (d.y === -1) g = t.y + t.height - h;
  if (m < 0) {
    m = 0;
    if (f) { p = t.x + t.width; h = p / u; if (d.y === -1) g = t.y + t.height - h; }
    else if (d.x === -1) p = t.x + t.width;
  }
  if (g < 0) {
    g = 0;
    if (f) { h = t.y + t.height; p = h * u; if (d.x === -1) m = t.x + t.width - p; }
    else if (d.y === -1) h = t.y + t.height;
  }
  if (m + p > o) {
    if (f) { p = o - m; h = p / u; if (d.y === -1) g = t.y + t.height - h; }
    else if (d.x === 1) p = o - m;
  }
  if (g + h > a) {
    if (f) { h = a - g; p = h * u; if (d.x === -1) m = t.x + t.width - p; }
    else if (d.y === 1) h = a - g;
  }
  return { x: m, y: g, width: p, height: h };
}

/* ══════════════════════════════════════════════════════════════════════════
   官方图标（Tabler 线稿，size 18 · stroke 2 · viewBox 24 · round 连接）
   出处：`x` @index 4975803（export fp）· `aspect-ratio` @index 3419594（export od）
        `check` @index 3755469（export fq）
   ══════════════════════════════════════════════════════════════════════════ */
function TablerIcon({ size = 18, className, children }: { size?: number; className?: string; children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const CropCancelIcon = ({ size = 18 }: { size?: number }) => (
  <TablerIcon size={size} className="icf-btn-icon">
    <path d="M18 6l-12 12" />
    <path d="M6 6l12 12" />
  </TablerIcon>
);

const CropRatioIcon = ({ size = 18 }: { size?: number }) => (
  <TablerIcon size={size} className="icf-btn-icon">
    <path d="M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" />
    <path d="M7 12v-3h3" />
    <path d="M17 12v3h-3" />
  </TablerIcon>
);

const CropCheckIcon = ({ size = 18 }: { size?: number }) => (
  <TablerIcon size={size} className="icf-btn-icon">
    <path d="M5 12l5 5l10 -10" />
  </TablerIcon>
);

/* ══════════════════════════════════════════════════════════════════════════
   选区层 —— 官方 `Ufe`（@1283854）逐字复刻
   ══════════════════════════════════════════════════════════════════════════ */
function CropRectOverlay({
  src,
  cropRect,
  onChange,
  width,
  height,
}: {
  src: string;
  cropRect: CropRect;
  onChange: (rect: CropRect) => void;
  width: number;
  height: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<HandleId | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialRect: CropRect;
    activeHandle: HandleId | null;
    inverseZoom: number;
  } | null>(null);
  /* 官方 `ZI` = `e => ({x:e.clientX, y:e.clientY})`（屏幕坐标，选区需再乘 1/zoom 才到流像素） */
  const pointOf = (event: PointerEvent | ReactPointerEvent) => ({ x: event.clientX, y: event.clientY });
  /* 官方把 width/height/onChange 装进 ref，避免重新绑定窗口监听；
     这里改为让 `handleMove` 直接闭包捕获（依赖变化时重绑一次窗口监听，行为等价、无 ref-in-render ✗） */
  const handleMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    const root = rootRef.current;
    if (!drag || !root) return;
    const { startX, startY, initialRect, activeHandle: handle, inverseZoom } = drag;
    const point = pointOf(event);
    void root;
    /* ★ 指针位移是**屏幕像素**，选区是**流像素**（节点随画布缩放）⇒ 必须乘 1/zoom。
       官方两者同为单位（它画在未缩放的画布空间），所以官方这里直接用位移 ✓ 别照抄那句。 */
    const next = resizeCropRect({
      initialRect,
      deltaX: (point.x - startX) * inverseZoom,
      deltaY: (point.y - startY) * inverseZoom,
      activeHandle: handle,
      containerWidth: width,
      containerHeight: height,
      minSize: CROP_MIN_SIZE * inverseZoom,
    });
    onChange(next);
  }, [width, height, onChange]);

  /* 官方 `m(g, y=null)`：指针按下 —— 只认主指针，立刻 stopPropagation + preventDefault */
  const beginDrag = (event: ReactPointerEvent, handle: HandleId | null = null) => {
    if (!event.isPrimary) return;
    event.stopPropagation();
    event.preventDefault();
    if (!cropRect) return;
    const point = pointOf(event);
    /* 官方把 40px 当**屏幕像素** ⇒ 节点内（已随画布缩放）要换算回流像素：40 / zoom */
    const root = rootRef.current;
    let inverseZoom = 1;
    if (root) {
      const raw = getComputedStyle(root).getPropertyValue('--float-scale').trim();
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) inverseZoom = parsed;
    }
    dragRef.current = {
      startX: point.x,
      startY: point.y,
      initialRect: { ...cropRect },
      activeHandle: handle,
      inverseZoom,
    };
    setDragging(true);
    setActiveHandle(handle);
  };

  /* 官方：window 上的 pointermove（rAF 合并）/ pointerup / pointercancel */
  useEffect(() => {
    if (!dragging) return;
    let frame: number | null = null;
    let pending: PointerEvent | null = null;
    const onMove = (event: PointerEvent) => {
      if (event.cancelable) event.preventDefault();
      pending = event;
      if (frame === null) {
        frame = requestAnimationFrame(() => {
          frame = null;
          if (pending) {
            handleMove(pending);
            pending = null;
          }
        });
      }
    };
    const finish = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      if (pending) {
        handleMove(pending);
        pending = null;
      }
      setDragging(false);
      setActiveHandle(null);
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [dragging, handleMove]);

  const gridActive = dragging || activeHandle !== null;   // 官方 `(a||d) && "opacity-100"`
  /* ★ 几何一律用**百分比**（= 归一化 × 节点尺寸，与单位/缩放无关）；
     `--icf-*f` 供亮图按「选框相对卡片」的比例反算自身尺寸/偏移（见 css 注释）。 */
  const fx = cropRect.x / width;
  const fy = cropRect.y / height;
  const fw = cropRect.width / width;
  const fh = cropRect.height / height;
  const boxStyle: CSSProperties = {
    left: `${fx * 100}%`,
    top: `${fy * 100}%`,
    width: `${fw * 100}%`,
    height: `${fh * 100}%`,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
    '--icf-xf': fx,
    '--icf-yf': fy,
    '--icf-wf': fw,
    '--icf-hf': fh,
  } as CSSProperties;

  const corner = (id: 'tl' | 'tr' | 'bl' | 'br') => (
    <div className={`icf-corner is-${id}`} onPointerDown={(event) => beginDrag(event, id)}>
      <div className="icf-corner-bar-h" />
      <div className="icf-corner-bar-v" />
    </div>
  );
  const edge = (id: 't' | 'b' | 'l' | 'r') => (
    <div className={`icf-edge is-${id}`} onPointerDown={(event) => beginDrag(event, id)}>
      <div className={id === 't' || id === 'b' ? 'icf-edge-bar-h' : 'icf-edge-bar-v'} />
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="icf-screen icf-stage"
      data-testid="image-crop-overlay"
    >
      {src && <img src={src} alt="" className="icf-dim" draggable={false} />}
      <div className="icf-box" style={boxStyle}>
        <div className="icf-box-img-clip">
          {src && (
            <img
              src={src}
              alt=""
              className="icf-box-img"
              draggable={false}
            />
          )}
        </div>
        <div className="icf-box-border" />
        <div className={`icf-grid${gridActive ? ' is-active' : ''}`}>
          <div className="icf-grid-line-h is-1" />
          <div className="icf-grid-line-h is-2" />
          <div className="icf-grid-line-v is-1" />
          <div className="icf-grid-line-v is-2" />
        </div>
        {corner('tl')}
        {corner('tr')}
        {corner('bl')}
        {corner('br')}
        {edge('t')}
        {edge('b')}
        {edge('l')}
        {edge('r')}
        {/* 移动层：`absolute inset-0 cursor-move`（**必须最后**，否则盖住手柄） */}
        <div className="icf-move" onPointerDown={(event) => beginDrag(event)} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   宽高比下拉 —— 官方 `j5`（@1288396）逐字复刻
   触发钮：clean + sm + `h-8 rounded-full text-muted-foreground hover:text-foreground
           hover:bg-muted/60 gap-1`，图标 Tabler `aspect-ratio` 18，文案「宽高比」
   菜单：`align="center" side="top" className="mb-2 w-32"`；条目 `rounded-sm px-2 py-1.5 text-sm`
   自定义行：两个输入框（Enter 提交 / 450ms 防抖自动应用 / 1..10000 校验）
   ══════════════════════════════════════════════════════════════════════════ */
const RATIO_PRESETS: { key: string; label: string; ratio: number | 'original' }[] = [
  { key: 'original', label: '原图比例', ratio: 'original' },
  { key: '1-1', label: '1 : 1', ratio: 1 },
  { key: '4-3', label: '4 : 3', ratio: 4 / 3 },
  { key: '3-4', label: '3 : 4', ratio: 3 / 4 },
  { key: '16-9', label: '16 : 9', ratio: 16 / 9 },
  { key: '9-16', label: '9 : 16', ratio: 9 / 16 },
  { key: '21-9', label: '21 : 9', ratio: 21 / 9 },
];

export function CropRatioMenu({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: (ratio: number | 'original') => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  /* 官方 Radix 有关闭动画（`data-[state=closed]` fade-out + zoom-out 150ms）⇒
     这里用「先播退场动画、150ms 后再卸载」来复刻（否则 React 会立刻摘掉 DOM ✗）*/
  const [menuMounted, setMenuMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [widthText, setWidthText] = useState('');
  const [heightText, setHeightText] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const widthInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const unmountTimerRef = useRef<number | null>(null);
  const lastAppliedRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (unmountTimerRef.current !== null) window.clearTimeout(unmountTimerRef.current);
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    if (customOpen) widthInputRef.current?.focus();
  }, [customOpen]);

  /* 官方 `b(v)`：选中预设 ⇒ 应用 + 关菜单（走 closeMenu ⇒ 播 150ms 退场动画后卸载）+ 关自定义行 */
  const selectPreset = (ratio: number | 'original') => {
    onSelect(ratio);
    closeMenu(false);
  };

  /* 官方 `w(v)`：**Escape 故意不 stopPropagation**（其余按键阻止冒泡，避免菜单类型搜索/关闭） */
  const guardKey = (event: { key: string; stopPropagation: () => void }) => {
    if (event.key !== 'Escape') event.stopPropagation();
  };

  /* 官方 `_`：自定义比例提交（整数 · >0 · ≤10000，否则弹 toast） */
  const applyCustom = useCallback(() => {
    const w = Number.parseInt(widthText.trim(), 10);
    const h = Number.parseInt(heightText.trim(), 10);
    if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) {
      useAppStore.getState().showToast(t('请输入两个正整数作为宽高比。'), 'error');
      return;
    }
    if (w > 1e4 || h > 1e4) {
      useAppStore.getState().showToast(t('每个数值不能超过 10000。'), 'error');
      return;
    }
    const signature = `${w}:${h}`;
    if (lastAppliedRef.current !== signature) {
      lastAppliedRef.current = signature;
      onSelect(w / h);
    }
  }, [widthText, heightText, onSelect, t]);

  /* 官方：自定义行打开时 450ms 防抖自动应用（非法值 ⇒ 取消定时器 + 清 lastApplied） */
  useEffect(() => {
    if (!customOpen) return;
    const w = Number.parseInt(widthText.trim(), 10);
    const h = Number.parseInt(heightText.trim(), 10);
    const clear = () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 || w > 1e4 || h > 1e4) {
      clear();
      lastAppliedRef.current = null;
      return;
    }
    clear();
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      applyCustom();
    }, 450);
    return clear;
  }, [customOpen, widthText, heightText, applyCustom]);

  /* 官方 `onOpenChange`：关闭时清定时器、应用一次、收起自定义行、清输入（+ 播 150ms 退场动画） */
  const closeMenu = useCallback((next: boolean) => {
    if (!next) {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (customOpen) applyCustom();
      setCustomOpen(false);
      setWidthText('');
      setHeightText('');
      lastAppliedRef.current = null;
      setOpen(false);
      setClosing(true);
      if (unmountTimerRef.current !== null) window.clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = window.setTimeout(() => {
        unmountTimerRef.current = null;
        setMenuMounted(false);
        setClosing(false);
      }, 150);
    } else {
      if (unmountTimerRef.current !== null) {
        window.clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
      setClosing(false);
      setMenuMounted(true);
      setOpen(true);
    }
  }, [customOpen, applyCustom]);

  /* MTV：菜单挂在浮条内部（官方 Radix 是 portal；视觉/尺寸一致），点击外部关闭 */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      if (!wrapRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, closeMenu]);

  return (
    <div className="icf-ratio-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icf-btn icf-btn--clean icf-btn--sm icf-btn--custom icf-ratio-trigger"
        disabled={disabled}
        onClick={() => closeMenu(!open)}
        data-testid="image-crop-ratio-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CropRatioIcon size={18} />
        {t('宽高比')}
      </button>
      {menuMounted && (
        <div
          className={`icf-ratio-menu${closing ? ' is-closing' : ''}`}
          role="menu"
          data-state={closing ? 'closed' : 'open'}
          data-testid="image-crop-ratio-menu"
        >
          {RATIO_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              role="menuitem"
              className="icf-menu-item"
              data-testid={`image-crop-ratio-${preset.key}`}
              onClick={() => selectPreset(preset.ratio)}
            >
              {t(preset.label)}
            </button>
          ))}
          <div className="icf-menu-sep" role="separator" />
          {customOpen ? (
            <div
              className="icf-custom-row"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={guardKey}
              onKeyUp={guardKey}
            >
              <input
                ref={widthInputRef}
                type="text"
                inputMode="numeric"
                className="icf-custom-input"
                placeholder={t('宽')}
                value={widthText}
                onChange={(event) => setWidthText(event.target.value)}
                onKeyDown={(event) => guardKey(event)}
                onKeyUp={guardKey}
              />
              <span className="icf-colon">:</span>
              <input
                type="text"
                inputMode="numeric"
                className="icf-custom-input"
                placeholder={t('高')}
                value={heightText}
                onChange={(event) => setHeightText(event.target.value)}
                onKeyDown={(event) => {
                  guardKey(event);
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (debounceRef.current !== null) {
                      window.clearTimeout(debounceRef.current);
                      debounceRef.current = null;
                    }
                    applyCustom();
                  }
                }}
                onKeyUp={guardKey}
              />
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="icf-menu-item"
              data-testid="image-crop-ratio-custom"
              onClick={(event) => {
                event.preventDefault();
                setCustomOpen(true);
              }}
            >
              {t('自定义…')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   主组件 —— 官方 `dpe`（@1322849）的 crop 分支
   ══════════════════════════════════════════════════════════════════════════ */
export interface ImageFloatingCropEditorProps {
  /** 当前节点 id（官方取景动画需要节点在画布中的位置） */
  nodeId?: string;
  /** 当前节点显示的图像 URL（官方 `node.data.src`） */
  imageUrl: string;
  /** 节点框**流尺寸**（官方 `node.measured.width/height`；屏幕尺寸 = ×zoom） */
  containerWidth: number;
  containerHeight: number;
  /** 取消 / 点击外部 —— 官方 `onClose` */
  onCancel: () => void;
  /** 确认后**立即**调用（在关掉编辑器之前）—— MTV 用它创建 loading 节点 */
  onStart?: () => void;
  /** 裁切结果交付 */
  onSave: (croppedDataUrl: string, metadata?: { width: number; height: number }) => void | Promise<void>;
}

export default function ImageFloatingCropEditor({
  nodeId,
  imageUrl,
  containerWidth,
  containerHeight,
  onCancel,
  onStart,
  onSave,
}: ImageFloatingCropEditorProps) {
  const t = useT();
  /* 官方：`h = {x:.1,y:.1,width:.8,height:.8}`（归一化）⇒ 初始选区 = 内缩 10% */
  const [cropRect, setCropRect] = useState<CropRect>(() => ({
    x: 0.1 * containerWidth,
    y: 0.1 * containerHeight,
    width: 0.8 * containerWidth,
    height: 0.8 * containerHeight,
  }));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  /* 官方 `upe`：打开时读原图 naturalWidth / naturalHeight（MTV 走同源 object URL，避免 canvas 污染）。
     状态带 `url` 一起存 ⇒ 换图时旧值自然失效，不需要在 effect 里同步 setState(null) ✗ */
  const [prepared, setPrepared] = useState<{ url: string; src: string; width: number; height: number } | null>(null);
  const mountedRef = useRef(true);
  const rootElRef = useRef<HTMLDivElement>(null);
  /* 浮条 portal 到 body 之后的位置（屏幕坐标）：
     · 水平：`left-1/2 -translate-x-1/2` ⇒ left = 卡片水平中心（官方相对面板，面板 = 卡片屏幕矩形）
     · 垂直：官方 `absolute -bottom-16` = `bottom:-64px` ⇒ **浮条「底边」在卡片下沿下方 64px**。
       可见间距 = 64 − 浮条高（40 + 上下 0.667px 描边 ≈ 41.33）≈ **22.7px**（不是 64px ✗）。
       同一份源码里上方工具栏是 `-top-16`（同样 64px 远端锚定）⇒ 对称的 ~22px 视觉间距，互为佐证。 */
  const [barBox, setBarBox] = useState<{ left: number; bottom: number } | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ── ① 裁剪态：给 `.react-flow__node` 打标记 ⇒ CSS 把描边切回「未选中」样式（官方 selected:false 的等价视觉） ── */
  useEffect(() => {
    const nodeEl = rootElRef.current?.closest('.react-flow__node') as HTMLElement | null;
    if (!nodeEl) return;
    nodeEl.setAttribute('data-crop-mode', 'true');
    return () => { nodeEl.removeAttribute('data-crop-mode'); };
  }, []);

  /* ── ② 浮条定位：每帧跟随卡片（画布平移/缩放/卡片尺寸动画都跟得上）
        · `bottom = 窗口高 − 卡片下沿 − 64`（= 官方 `-bottom-16`，远端锚定，屏幕像素）
        · 不需要任何夹取：高度受限时卡片下沿 = 容器底 − 88 ⇒ 浮条底边 = 容器底 − 24 ✓ 完整可见 */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      /* 面板矩形 = 官方 `panelSize`（节点屏幕矩形）。量 `.icf-screen` 自己的 rect：
         `t212` 已断言它和卡片 rect 逐位相同（dw/dh/dx/dy = 0）；
         它比 `.node-wrapper` 更稳 —— 便签节点（`CanvasNoteNode`）里没有 `.node-wrapper` ✗ */
      const host = (rootElRef.current?.querySelector('.icf-screen') as HTMLElement | null)
        ?? (rootElRef.current?.closest('.node-wrapper') as HTMLElement | null)
        ?? rootElRef.current;
      if (host) {
        const rect = host.getBoundingClientRect();
        const next = {
          left: rect.left + rect.width / 2,
          bottom: window.innerHeight - rect.bottom - CROP_BAR_GAP,
        };
        setBarBox((prev) => (prev && Math.abs(prev.left - next.left) < 0.1 && Math.abs(prev.bottom - next.bottom) < 0.1 ? prev : next));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let active = true;
    let loaded: SafeImagePreviewSource | null = null;
    void createSafeImagePreviewSource(imageUrl, '裁切源图')
      .then((result) => {
        if (!active) {
          result.release();
          return;
        }
        loaded = result;
        setPrepared({
          url: imageUrl,
          src: result.src,
          width: result.dimensions.width,
          height: result.dimensions.height,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        useAppStore.getState().showToast(
          error instanceof Error ? error.message : t('裁切源图读取失败，请重试'),
          'error',
        );
      });
    return () => {
      active = false;
      loaded?.release();
    };
  }, [imageUrl, t]);
  const source = prepared && prepared.url === imageUrl ? prepared : null;

  /* 官方 `of` @1005456 —— **打开时的取景动画**（官方唯一的「打开过渡」；面板本身没有动画）：
        zoom = max(.01, min((W−144)/nodeW, (H−168)/nodeH))
        x    = W/2 − (nodeX + nodeW/2)·zoom
        y    = 80 + (H−168)/2 − (nodeY + nodeH/2)·zoom
        duration = min(max(200, 200 + dist·0.5 + |Δzoom|·600 + (1/max(zoom,.2))·200), 1500) ms
     关闭时官方**不还原**视口（只 clearHistory + close）⇒ 这里同样不还原。 */
  useEffect(() => {
    const controller = getCanvasViewportController();
    if (!controller || !nodeId) return;
    const snapshot = controller.getSnapshot();
    const viewportWidth = snapshot.visibleBounds.width * snapshot.zoom;
    const viewportHeight = snapshot.visibleBounds.height * snapshot.zoom;
    if (!(viewportWidth > 0) || !(viewportHeight > 0)) return;
    const node = useAppStore.getState().nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const nodeFlowX = node.position?.x ?? 0;
    const nodeFlowY = node.position?.y ?? 0;
    /* 官方：`z = max(0.01, min((viewportW-144)/nodeW, (viewportH-168)/nodeH))` —— **只有下限 .01，没有上限** */
    const zoom = Math.max(
      FIT_MIN_ZOOM_RATIO,
      Math.min(
        (viewportWidth - FIT_SAFE_HORIZONTAL * 2) / containerWidth,
        (viewportHeight - FIT_SAFE_TOP - FIT_SAFE_BOTTOM) / containerHeight,
      ),
    );
    if (!Number.isFinite(zoom) || zoom <= 0) return;
    const x = viewportWidth / 2 - (nodeFlowX + containerWidth / 2) * zoom;
    const y =
      FIT_SAFE_TOP + (viewportHeight - FIT_SAFE_TOP - FIT_SAFE_BOTTOM) / 2
      - (nodeFlowY + containerHeight / 2) * zoom;
    /* ★★ 位置：**源码公式，分毫不动**（`ue = safeArea.top + Z/2` 处居中）。
       高度受限时：卡片顶 = 80、卡片底 = H − 88 ⇒ 浮条（底边锚定 64px）底边 = H − 24
       ⇒ **仍在容器内、还剩 24px 余量** ⇒ 不需要任何补偿 ✓（见下方浮条定位注释）。 */
    const targetCenterX = FIT_SAFE_HORIZONTAL + (viewportWidth - FIT_SAFE_HORIZONTAL * 2) / 2;
    const targetCenterY = FIT_SAFE_TOP + (viewportHeight - FIT_SAFE_TOP - FIT_SAFE_BOTTOM) / 2;
    const currentCenterX = (nodeFlowX + containerWidth / 2) * snapshot.zoom + snapshot.x;
    const currentCenterY = (nodeFlowY + containerHeight / 2) * snapshot.zoom + snapshot.y;
    const distance = Math.hypot(currentCenterX - targetCenterX, currentCenterY - targetCenterY);
    const deltaZoom = Math.abs(zoom - snapshot.zoom);
    const duration = Math.min(
      Math.max(200, 200 + distance * 0.5 + deltaZoom * 600 + (1 / Math.max(zoom, 0.2)) * 200),
      1500,
    );
    void controller.setViewport({ x, y, zoom }, duration);
    /* 只在打开时取景一次（官方 re-fit 阈值 |Δx|≥.5 / |Δy|≥.5 / |Δzoom|≥5e-4 只在节点被拖动时才会触发） */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ★ 官方 `fpe` @1326210（floating-editor root）在打开时把该节点 **`zIndex: 1001` + `selected: false`**
     ⇒ 裁剪态**没有节点工具条**、也没有选中描边。
     ⚠️⚠️ MTV **不能**照抄「取消选中」这一步（已实测）：`setSelectedNodeIds` 会触发一次历史提交，
        而 MTV 的派生守卫（`registerCanvasDerivation` / `isCanvasDerivationFresh`，见
        `store/canvasDerivation.ts`）把「start → save 之间发生过状态提交」视为**产物已过期** ⇒
        loading 占位节点会被撤销、裁切结果被静默丢弃 ✗（本轮实测踩过两次）。
     ⇒ 改用**纯渲染侧**等价做法：由 `ImageNode` 把工具条的 `visible` 门多加一条 `!isCrop`
        （见 `ImageNode.tsx` 的 `NodeToolbarShell visible={… && !isCrop}`）——工具条照样消失 ✓，
        且完全不碰 store ✓。剩余差异：卡片仍带选中描边（官方会掉），已记入报告。 */

  /* 官方 `m(y)`：按比例铺满 → 居中（`x=(s-w)/2, y=(i-h)/2`） */
  const handleRatioSelect = useCallback((ratio: number | 'original') => {
    let aspect: number;
    if (ratio === 'original' && source) aspect = source.width / source.height;
    else if (ratio === 'original') aspect = containerWidth / containerHeight;
    else aspect = ratio;
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    let w = containerWidth;
    let h = w / aspect;
    if (h > containerHeight) {
      h = containerHeight;
      w = h * aspect;
    }
    setCropRect({ x: (containerWidth - w) / 2, y: (containerHeight - h) / 2, width: w, height: h });
  }, [containerWidth, containerHeight, source]);

  /* 官方 `g()`：确认裁剪 —— 归一化 → 原图像素 → canvas PNG → 交付 */
  const handleConfirm = useCallback(async () => {
    if (!source) {
      useAppStore.getState().showToast(t('原图尺寸尚未加载，请稍后重试'), 'error');
      return;
    }
    if (!imageUrl) {
      useAppStore.getState().showToast(t('找不到原图像，无法裁剪'), 'error');
      return;
    }
    const nx = cropRect.x / containerWidth;
    const ny = cropRect.y / containerHeight;
    const nw = cropRect.width / containerWidth;
    const nh = cropRect.height / containerHeight;
    const originalWidth = source.width;
    const originalHeight = source.height;
    const sx = Math.max(0, Math.floor(nx * originalWidth));
    const sy = Math.max(0, Math.floor(ny * originalHeight));
    const sw = Math.min(originalWidth - sx, Math.floor(nw * originalWidth));
    const sh = Math.min(originalHeight - sy, Math.floor(nh * originalHeight));
    if (sw <= 0 || sh <= 0) {
      useAppStore.getState().showToast(t('裁剪区域无效，请调整裁剪选区'), 'error');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    let started = false;
    let delivered = false;
    try {
      assertEditorCanvasBudget(sw, sh, '矩形裁切输出');

      /* ⚠️⚠️ 顺序与官方**不同**，这里是 MTV 特有的坑（实测：裁切 100% 失败，报「裁切源图解码失败」）：
         官方 `e.data?.src` 是节点上**稳定的** URL，所以官方可以「先 `t()` 关编辑器 → 再异步解码」；
         MTV 解码用的是 `createSafeImagePreviewSource()` 造的 **blob: URL**，它属于编辑器，
         编辑器一卸载（`onStart` → `setIsCrop(false)`）清理函数就 `URL.revokeObjectURL()` ⇒
         紧接着 `image.src = source.src` 指向一个**已撤销**的 blob ⇒ `onerror` ⇒ 永远失败。
         ⇒ 这里把**解码提到 `onStart` 之前**：先把像素读出来，再关编辑器、再走 canvas/落盘。
         （附带好处：解码失败时编辑器不关，用户能直接看到错误并重试。） */
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = source.src;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('裁切源图解码失败'));
      });

      /* 官方：先 `t()`（onClose）→ 再异步 canvas + 上传 */
      onStart?.();
      started = true;

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('矩形裁切画布初始化失败，请重试');
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataUrl = await canvasToDataUrl(canvas);
      delivered = true;
      await onSave(dataUrl, { width: sw, height: sh });
    } catch (error) {
      console.error('[ImageFloatingCropEditor] crop failed:', error);
      if (started && !delivered) {
        try {
          await onSave('', { width: 0, height: 0 });
        } catch (deliveryError) {
          console.error('[ImageFloatingCropEditor] cancel derivation failed:', deliveryError);
        }
      }
      useAppStore.getState().showToast(t('图片裁剪失败，请重试'), 'error');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }, [source, imageUrl, cropRect, containerWidth, containerHeight, onStart, onSave, t]);

  /* 官方 `zhe` 的「点外部关闭」判定（本轮实读 `page-DVqoHdTT.js` @1343）：
     ```js
     const b = N => !N || N === document.body || N === document.documentElement ? true
       : N.closest(".react-flow__node") || N.closest(".react-flow__edge") || N.closest(".react-flow__handle") ||
         N.closest("button") || N.closest("a") || N.closest("input") || N.closest("textarea") ||
         N.closest('[role="button"]') || N.isContentEditable ? false          // ← 交互元素：**不关**
       : N.classList.contains("react-flow__pane") || N.closest(".react-flow__pane") ||
         N.classList.contains("react-flow__background") || N.closest(".react-flow__background") ? true  // ← 空白：关
       : !!N.closest(".react-flow__viewport");
     ```
     ⇒ 官方只在「点到画布空白/背景」时才关；点到**节点 / 边 / 手柄 / 按钮 / 输入框**等交互元素时
       把这次点击**透传给下层**并且**保持编辑器打开**（MTV 的编辑器挂在节点内、根层 `inset:0` 已覆盖节点，
       所以「透传」这一步在 MTV 结构下自然成立，这里只需照抄「关不关」的判定）。
     ★ 官方**没有** Escape 处理（穷举搜索确认）⇒ 这里也不加。 */
  useEffect(() => {
    const shouldCloseOnTarget = (element: Element | null): boolean => {
      if (!element) return true;
      const el = element as HTMLElement;
      if (el === document.body || el === document.documentElement) return true;
      if (
        el.closest('.react-flow__node') || el.closest('.react-flow__edge') || el.closest('.react-flow__handle')
        || el.closest('button') || el.closest('a') || el.closest('input') || el.closest('textarea')
        || el.closest('[role="button"]') || el.isContentEditable
      ) return false;
      if (
        el.classList.contains('react-flow__pane') || el.closest('.react-flow__pane')
        || el.classList.contains('react-flow__background') || el.closest('.react-flow__background')
      ) return true;
      return Boolean(el.closest('.react-flow__viewport'));
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const root = document.querySelector('[data-testid="image-floating-crop-editor"]');
      if (root && target && root.contains(target)) return;
      /* 浮条 portal 到 body，不在 root 内 ⇒ 必须单独排除，否则点浮条会把编辑器关掉 ✗ */
      const barRoot = document.querySelector('[data-testid="image-crop-bar-root"]');
      if (barRoot && target && barRoot.contains(target)) return;
      if (!shouldCloseOnTarget(target instanceof Element ? target : null)) return;
      onCancel();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onCancel]);

  /* 显示用图：官方直接用 `src`；MTV 在 object URL 就绪前先用卡片已显示的图，避免闪一下空白 */
  const displaySrc = source?.src ?? imageUrl;

  const frame = useMemo(() => (
    <CropRectOverlay
      src={displaySrc}
      cropRect={cropRect}
      onChange={setCropRect}
      width={containerWidth}
      height={containerHeight}
    />
  ), [displaySrc, cropRect, containerWidth, containerHeight]);

  return (
    <>
      <div ref={rootElRef} className="icf-root nodrag nopan" data-testid="image-floating-crop-editor">
        {frame}
      </div>
      {/* 官方浮条：`absolute -bottom-16 left-1/2 -translate-x-1/2 z-50 w-max`
          ⇒ **底边**在卡片下沿下方 64px（可见间距 ≈22.7px）。
          ★ portal 到 body + `position: fixed`：MTV 的卡片在缩放视口内，浮条若留在流内会跟着视口被放大 ✗
            （官方那边编辑器整体渲染在**屏幕空间面板**里，所以 64px 就是屏幕像素） */}
      {barBox && createPortal(
        <div
          className="icf-bar-anchor"
          data-testid="image-crop-bar-root"
          style={{ left: barBox.left, bottom: barBox.bottom }}
        >
          <div className="icf-bar" data-testid="image-crop-bar">
            <button
              type="button"
              className="icf-btn icf-btn--clean icf-btn--circle icf-btn--sm icf-cancel"
              onClick={onCancel}
              disabled={busy}
              data-testid="image-crop-cancel"
              aria-label={t('取消')}
              /* 官方 `Qg` 气泡：Provider `delayDuration:200` + `K0`（= 原语 + leading-relaxed）+ sideOffset 4（默认） */
              data-tooltip={t('取消')}
              data-tooltip-delay="200"
              data-tooltip-relaxed="true"
            >
              <CropCancelIcon size={18} />
            </button>
            <div className="icf-divider" />
            <CropRatioMenu disabled={busy} onSelect={handleRatioSelect} />
            <div className="icf-divider" />
            <button
              type="button"
              className="icf-btn icf-btn--default icf-btn--custom icf-btn--sm icf-confirm"
              onClick={() => { void handleConfirm(); }}
              disabled={busy}
              data-testid="image-crop-confirm"
            >
              <CropCheckIcon size={18} />
              {t('确认裁剪')}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
