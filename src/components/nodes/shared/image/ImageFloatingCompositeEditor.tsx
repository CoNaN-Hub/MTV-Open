/**
 * ImageFloatingCompositeEditor —— 「无损改图」浮动编辑器（MTV 自有功能）
 * ══════════════════════════════════════════════════════════════════════════
 * 纯**本地**合成，不调 AI：拿「原图 + AI 修改图」，自动对齐 → 自动校色 →
 * 改动检测（中位数+MAD 自适应阈值）→ 画笔补正 → 合成预览 → 回传合成图。
 *
 * · 算法全在 `utils/losslessComposite.ts`（参数逐条对齐参考实现 taozui，见那里的注释）
 * · UI **复用 `ImageFloatingRedrawEditor` 那套 `.irf-*` 宿主**（用户决策⑥：走 MTV 自己的设计体系）
 *   —— `.irf-root` 本来就有 `position:absolute; inset:0; z-index:30`（覆盖在卡片上），
 *      `.irf-stage` 是画面区、`.irf-toolbar` 是浮动工具条、`.irf-bar` 是底部条。
 * · 输出**新建一张合成卡**（用户决策⑦），由调用方 `onApply` 负责落节点，本组件不碰 store。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../../i18n';
import { downloadBlob } from '../../../../utils/downloadBlob';
import { useAppStore } from '../../../../store/useAppStore';
import ImageEditorZoomControls from './ImageEditorZoomControls';
import {
  ALIGN_RESID_WARN_PX,
  alignImages,
  applyColorCorrection,
  compositeLossless,
  computeColorCorrection,
  detectChanges,
  maskFromRegions,
  planAdoption,
  upscaleMask,
  type AlignResult,
  type ChangeDetection,
  type ChangedRegion,
  type ColorCorrection,
} from '../../../../utils/losslessComposite';

/* ── 笔刷：参考实现 `dt()` 的 14 圈同心描边（柔边就是它，不是高斯模糊）── */
const BRUSH_RING_COUNT = 14;
/** 参考实现默认值 `brush:{size:160, hardness:.5}` */
const BRUSH_DEFAULT_SIZE = 160;
const BRUSH_DEFAULT_HARDNESS = 0.5;
const BRUSH_MIN_SIZE = 8;
const BRUSH_MAX_SIZE = 600;
/** 撤销栈：参考实现 `lt()` 是「最多 40 步 / 600MB」 */
const UNDO_MAX_STEPS = 40;
const UNDO_MAX_BYTES = 600 * 1000 * 1000;
/** 蒙版显示色（参考实现里改动区是红色高亮） */
const MASK_VIEW_COLOR = '#ff2d55';

/* ── 视图缩放 / 平移（滚轮 + 空格拖拽）────────────────────────────────
   和抠图编辑器 `MattingEditor.tsx:406-455` **同一套手感**：
     · 滚轮：乘性步进（每格 ×/÷ `VIEW_ZOOM_STEP`），`{passive:false}` 才能 preventDefault；
     · 空格：按住进"平移就绪态"（grab），拖拽平移（grabbing）；
     · ⌘0 / ⌘⇧0：复位到 100%（`ImageComposerEditor.tsx:466` 的 `mod && e.key === '0'` 同款）。
   差别：抠图那边是围绕中心缩，这里**以光标为锚点**缩（放大后光标下的像素不动）。
   倍数下限取 1：卡片本身就是"铺满可见区"，再缩小只会露出空白边。 */
const VIEW_MIN_SCALE = 1;
const VIEW_MAX_SCALE = 8;
const VIEW_ZOOM_STEP = 1.15;

/**
 * 撤销栈的一步 —— 参考实现 `lt()` 的结构：
 * ```js
 * lt(t){                     // t = 本次笔迹的包围盒 {x,y,w,h}
 *   const e=p.prev.getImageData(t.x,t.y,t.w,t.h), n=p.mask.getImageData(t.x,t.y,t.w,t.h);
 *   o.undo.push({...t, before:e, after:n});
 *   o.undoBytes+=2*e.data.length;
 *   o.redo=[];
 *   while(o.undo.length>40 || (o.undoBytes>6e8 && o.undo.length>1)) o.undoBytes-=2*o.undo.shift().before.data.length;
 * }
 * ```
 * ⇒ **存的是蒙版 bbox 的快照（before/after 两份），不是整张图、也不是"存笔画"**。 */
interface UndoStep {
  before: ImageData;
  after: ImageData;
  x: number;
  y: number;
  bytes: number;
}

export type CompositeBrushMode = 'paint' | 'erase';

/** 「高级」弹层里的手动覆盖：对齐增量（相对自动值）+ 校色增益 */
export interface PipelineOverride {
  dx: number;
  dy: number;
  /** 相对自动缩放的倍数（1 = 不变） */
  scale: number;
  /** 手动校色增益；不给就用自动值 */
  gain?: [number, number, number];
}

export interface ImageFloatingCompositeEditorProps {
  nodeId: string;
  /** 修改图（本节点当前图） */
  imageUrl: string;
  /** 原图（上游节点的图）；没传就只显示提示 */
  originalUrl?: string;
  containerWidth: number;
  containerHeight: number;
  onCancel: () => void;
  /** 应用：回传合成图 dataURL，由调用方新建合成卡 */
  onApply: (payload: { dataUrl: string; width: number; height: number }) => void;
}

/** 把 URL 解码成 ImageBitmap。走 fetch→blob 是为了**避开画布污染**（远程图直接 drawImage 会让 getImageData 抛 SecurityError）。 */
async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function roundTo(v: number, digits: number): number {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
}

/**
 * 「高级」里的一行微调：`− 值 +`。
 * ⚠️ 故意**不用** number input：改一次就要**重跑一遍检测管线**（几百 ms），
 *    打字时每敲一个键都重算会卡到没法用；点按钮/拖滑块才是可控的节奏。
 */
function Tuner({
  label,
  value,
  step,
  digits,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  digits: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="ilf-adv-row">
      <span className="ilf-adv-row-label">{label}</span>
      <button
        type="button"
        className="irf-btn ilf-adv-step"
        onClick={() => onChange(roundTo(value - step, digits))}
        aria-label={`${label} −`}
      >
        −
      </button>
      <b className="ilf-adv-num">{digits > 0 ? value.toFixed(digits) : String(Math.round(value))}</b>
      <button
        type="button"
        className="irf-btn ilf-adv-step"
        onClick={() => onChange(roundTo(value + step, digits))}
        aria-label={`${label} +`}
      >
        +
      </button>
    </div>
  );
}

/** 合并一处手动覆盖并**立刻重跑**（对齐/校色都不是"下一次才生效"的参数） */
function updateOver(
  patch: Partial<PipelineOverride>,
  cur: PipelineOverride | null,
  setOver: (v: PipelineOverride) => void,
  rerun: (o: PipelineOverride) => void,
): void {
  const next: PipelineOverride = { dx: 0, dy: 0, scale: 1, ...(cur ?? {}), ...patch };
  setOver(next);
  rerun(next);
}

/**
 * 把裸 RGBA 写进画布（走 `createImageData` + `set`，避开 TS 5.7 的 `ImageDataArray` 兼容问题）。 */
function putRGBA(ctx: CanvasRenderingContext2D, data: Uint8ClampedArray, w: number, h: number): void {
  const img = ctx.createImageData(w, h);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
}

export default function ImageFloatingCompositeEditor({
  nodeId: _nodeId,
  imageUrl,
  originalUrl,
  containerWidth,
  containerHeight,
  onCancel,
  onApply,
}: ImageFloatingCompositeEditorProps) {
  const t = useT();

  const viewRef = useRef<HTMLCanvasElement>(null);
  const maskViewRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  /** 离屏画布：原图 / 已校色修改图 / 蒙版（数据层）/ 羽化后的蒙版 / 临时层 */
  const offRef = useRef<{
    orig: HTMLCanvasElement;
    mod: HTMLCanvasElement;
    mask: HTMLCanvasElement;
    soft: HTMLCanvasElement;
    tmp: HTMLCanvasElement;
    /** 落笔前把整张蒙版拷到这儿（`drawImage` 很快），收笔时只从它抠 bbox 存撤销 */
    scratch: HTMLCanvasElement;
    w: number;
    h: number;
  } | null>(null);

/** 蒙版显示色（参考实现里改动区是红色高亮） */
  const rawRef = useRef<{ orig: ImageBitmap; mod: ImageBitmap } | null>(null);

  /** 撤销栈：**只存一笔的包围盒**（`before`/`after` 都是 bbox 大小的 ImageData） */
  const undoRef = useRef<UndoStep[]>([]);
  const redoRef = useRef<UndoStep[]>([]);
  const strokeBoxRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const drawingRef = useRef(false);
  /** 本次检测结果（点「擦掉」时要按当前 `adopted` 重算蒙版） */
  const detRef = useRef<ChangeDetection | null>(null);
  /** 面板的**屏幕**尺寸（≈ 底栏宽度）；定位循环用它算居中/夹取 */

  const [status, setStatus] = useState<'loading' | 'running' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [info, setInfo] = useState({ align: '', corr: '', noise: '', regions: '' });
  /** 改动标注（参考实现：**所有**候选都画虚线框 + `#N 改动大` 编号 chip，含已自动采用的） */
  const [cands, setCands] = useState<ChangedRegion[]>([]);
  /** 采用过多时不画框（README：「超过 5 处…不再画框」） */
  const [showBoxes, setShowBoxes] = useState(true);
  /** 检测分辨率下的区域坐标 → 画面上要按比例定位 ⇒ 存一份检测尺寸 + 画面区的**屏幕**尺寸
      （后者只用来把参考实现的 150px / 30px 避让阈值换算成百分比） */
  const [detSize, setDetSize] = useState({ dw: 0, dh: 0, screenW: 1, screenH: 1 });
  /** 采纳 / 候选计数（title 上那行状态）。点「擦掉」后要跟着变 —— 不能停在检测那一刻 */
  const [adopt, setAdopt] = useState({ adopted: 0, candidates: 0, autoAll: false });

  const [brushMode, setBrushMode] = useState<CompositeBrushMode>('paint');
  /** ⇄ 交换「原图 / 修改图」两个角色（参考实现 `#bSwap`）：换完整条管线按新角色重跑 */
  const [swapped, setSwapped] = useState(false);
  const origSrc = (swapped ? imageUrl : originalUrl) ?? '';
  const modSrc = (swapped ? originalUrl : imageUrl) ?? '';
  const [brushSize, setBrushSize] = useState(BRUSH_DEFAULT_SIZE);
  const [hardness, setHardness] = useState(BRUSH_DEFAULT_HARDNESS);
  const [opacity, setOpacity] = useState(1);
  const [showMask, setShowMask] = useState(true);
  const [comparing, setComparing] = useState(false);
  /** 离屏画布：原图 / 已校色修改图 / 蒙版（数据层）/ 羽化后的蒙版 / 临时层 */
  const [advOpen, setAdvOpen] = useState(false);
  /** 柔边半径（px，原图分辨率）：把蒙版边缘羽化，硬边太"抠图"时不自然 */
  const [feather, setFeather] = useState(0);
  /** 「高级」里的对齐 / 校色覆盖值；null = 纯自动 */
  const [over, setOver] = useState<PipelineOverride | null>(null);
  /** 自动算出来的校色增益（「高级」里当手动微调的起点；ref 不能在渲染期读 ⇒ 用 state） */
  const [autoGain, setAutoGain] = useState<[number, number, number] | null>(null);
/**
   * 面板尺寸 —— ★ **跟图片比例走**，不再拿卡片尺寸去算缩放。
   * 之前是「宽 760 × 卡片高 260」的横条，而图是 1152×2048 的竖图 ⇒
   * 图被塞进 260 高度缩成邮票、右边一大片空、半透明底下还透出对比卡（像两张图重叠）。
   */
  const [panel, setPanel] = useState({ w: 0, h: 0 });

  /* ── 视图（滚轮缩放 / 空格拖拽平移）──
     `.irf-stage`（量取祖先 zoom 的基准，自己不被变换）；
       ├ `.ilf-vport`：**唯一**挂 `translate`/`scale` 的节点：画面 / 蒙版 / 绘制层 / 改动标注全挂在它下面；
     ⇒ 画笔坐标走 `getBoundingClientRect()`（`:750` 的 `toImageCoords`），元素被变换后 rect 跟着变，
       所以缩放/平移之后落笔位置**自动**还是对的，不用另算。*/
  const stageRef = useRef<HTMLDivElement>(null);
  const vportRef = useRef<HTMLDivElement>(null);
  /** 空格按住中（平移就绪）；用 ref 是因为 pointerdown 里要同步读到，不能等 state */
  const spaceRef = useRef(false);
  /** 平移会话：起点 client 坐标 + 起点位移 + 当时的祖先缩放倍数 */
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number; k: number } | null>(null);
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 });
  const [panReady, setPanReady] = useState(false);
  const [panning, setPanning] = useState(false);
  /** `view` 的镜像：`onPointerDown` 起手时读当前位移，避免把 `view` 塞进回调依赖 */
  const viewStateRef = useRef(view);
  useEffect(() => {
    viewStateRef.current = view;
  }, [view]);


  /** 祖先把所有东西放大了多少倍（画布 zoom / `--float-scale`）—— 位移量要按它折算回布局 px */
  const ancestorScale = useCallback(() => {
    const el = stageRef.current;
    if (!el || !el.offsetWidth) return 1;
    const rect = el.getBoundingClientRect();
    return rect.width / el.offsetWidth || 1;
  }, []);

  /** 位移夹取：放大后不许把图拖出可视区（`s >= 1` 时 tx ∈ [W(1-s), 0]，反之对称） */
  const clampView = useCallback((next: { s: number; tx: number; ty: number }) => {
    const el = vportRef.current;
    const limit = (size: number) => {
      const edge = size * (1 - next.s);
      return { lo: Math.min(0, edge), hi: Math.max(0, edge) };
    };
    const x = limit(el?.offsetWidth ?? 0);
    const y = limit(el?.offsetHeight ?? 0);
    return {
      s: next.s,
      tx: Math.min(x.hi, Math.max(x.lo, next.tx)),
      ty: Math.min(y.hi, Math.max(y.lo, next.ty)),
    };
  }, []);

  /** 缩放到 `s`，并让画面内 (px,py) 那一点保持不动（锚点缩放） */
  const zoomAt = useCallback(
    (s: number, px: number, py: number) => {
      setView((prev) => {
        const next = Math.min(VIEW_MAX_SCALE, Math.max(VIEW_MIN_SCALE, s));
        const ux = (px - prev.tx) / prev.s;
        const uy = (py - prev.ty) / prev.s;
        return clampView({ s: next, tx: px - ux * next, ty: py - uy * next });
      });
    },
    [clampView],
  );

  const zoomToCenter = useCallback(
    (s: number) => {
      const el = vportRef.current;
      zoomAt(s, (el?.offsetWidth ?? 0) / 2, (el?.offsetHeight ?? 0) / 2);
    },
    [zoomAt],
  );

  const resetView = useCallback(() => setView({ s: 1, tx: 0, ty: 0 }), []);

  /* 滚轮缩放：挂 `.ilf-vport` 且 `{passive:false}`（否则 preventDefault 无效、画布会跟着滚） */
  useEffect(() => {
    const el = vportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      /* ⚠️ Ctrl/⌘ + 滚轮是**画布缩放**（用户口径：「ctrl+滚轮 放大缩小时 图像也跟着一起
         放大缩小」✗）—— 那是 React Flow 的事，这里必须让开：
         不 preventDefault、不改视图，否则一次滚轮会同时缩放画布和编辑器两层。 */
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      /* ⚠️ 还须 stopPropagation：React Flow 的滚轮处理挂在**祖先 pane** 上，是 JS 监听，
         preventDefault 拦不住它 —— 实机验收里不按 Ctrl 滚轮会顺带把画布平移 144px。
         Ctrl/⌘ 已在上一行 return，所以画布缩放不受影响。 */
      event.stopPropagation();
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const k = stage.offsetWidth ? rect.width / stage.offsetWidth : 1;
      const px = (event.clientX - rect.left) / k;
      const py = (event.clientY - rect.top) / k;
      setView((prev) => {
        const next = Math.min(
          VIEW_MAX_SCALE,
          Math.max(VIEW_MIN_SCALE, prev.s * (event.deltaY > 0 ? 1 / VIEW_ZOOM_STEP : VIEW_ZOOM_STEP)),
        );
        const ux = (px - prev.tx) / prev.s;
        const uy = (py - prev.ty) / prev.s;
        return clampView({ s: next, tx: px - ux * next, ty: py - uy * next });
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampView]);

  /**
   * 取「用于合成」的蒙版：
   *   · 柔边 = 0 ⇒ 就是 `off.mask`（原始笔迹/采纳层，零拷贝）
   *   · 柔边 > 0 ⇒ 用 canvas `filter: blur()` 现算到 `off.soft`（**不改 `off.mask`**，
   *     所以 ⌘Z、PSD 的图层蒙版、后续画笔都还是原始数据）
   * ⚠️ 三处消费方必须**共用**它（预览 / 下载 / PSD），否则导出和预览对不上。
   */
  const softMask = useCallback((): HTMLCanvasElement | null => {
    const off = offRef.current;
    if (!off) return null;
    if (feather <= 0) return off.mask;
    const ctx = off.soft.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, off.w, off.h);
    ctx.filter = `blur(${feather}px)`;
    ctx.drawImage(off.mask, 0, 0);
    ctx.filter = 'none';
    return off.soft;
  }, [feather]);

  /** 把「合成」重画到可见画布：等价于参考实现 `tt()` 的图层顺序 */
  const redrawComposite = useCallback(() => {
    const off = offRef.current;
    const view = viewRef.current;
    if (!off || !view) return;
    const vctx = view.getContext('2d');
    const tctx = off.tmp.getContext('2d');
    if (!vctx || !tctx) return;
    const maskCanvas = softMask() ?? off.mask;

    // tmp = 原图 destination-out 蒙版（= "原图挖掉改动区"）
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, off.w, off.h);
    tctx.drawImage(off.orig, 0, 0);
    tctx.globalCompositeOperation = 'destination-out';
    tctx.drawImage(maskCanvas, 0, 0);
    tctx.globalCompositeOperation = 'source-over';

    // 可见画布：原图 → 已校色修改图 → tmp（按"原图不透明度"）
    vctx.globalCompositeOperation = 'source-over';
    vctx.globalAlpha = 1;
    vctx.clearRect(0, 0, off.w, off.h);
    vctx.drawImage(off.orig, 0, 0);
    vctx.drawImage(off.mod, 0, 0);
    vctx.globalAlpha = comparing ? 1 : opacity;
    vctx.drawImage(off.tmp, 0, 0);
    vctx.globalAlpha = 1;

    /* 蒙版显示层：**把红色画进 canvas 本身**（mask 做 `source-in` 剪影）。
       ⚠️ 原来的写法是「父层 `background:#ff2d55` + canvas `mix-blend-mode:multiply`」✗：
          父层的红底是 canvas 的 backdrop，而 canvas 在**未涂抹处是透明的** ⇒
          multiply 的透明源不改变 backdrop ⇒ **整张图都被红色罩住**（不是只有蒙版区），
          实测观感就是「画面发红、看不出改哪儿」。现在 canvas 只在蒙版处不透明 ⇒ 只有改动区变红 ✓ */
    const mctx = maskViewRef.current?.getContext('2d');
    if (mctx && maskViewRef.current) {
      mctx.globalCompositeOperation = 'source-over';
      mctx.clearRect(0, 0, off.w, off.h);
      mctx.drawImage(maskCanvas, 0, 0);
      mctx.globalCompositeOperation = 'source-in';
      mctx.fillStyle = MASK_VIEW_COLOR;
      mctx.fillRect(0, 0, off.w, off.h);
      mctx.globalCompositeOperation = 'source-over';
    }
  }, [opacity, comparing, softMask]);

  /* ── 撤销 / 重做：**按笔迹包围盒**存快照（参考实现 `lt()` 只存 bbox 的 before/after）
     ⚠️ 旧实现每落一笔就 `getImageData(0,0,w,h)` 存整张（1440×2560 = 14.7 MB/步，
        40 步上限 ⇒ 588 MB，几乎顶满 600 MB 的预算，而且每次 pointerdown 都要整张回读）。
        现在：落笔前把蒙版 `drawImage` 到 scratch（GPU 拷贝，快），收笔时只从 scratch/mask
        抠出本笔的 bbox 存起来 ⇒ 一次笔迹通常只有几十 KB。── */
  const beginStrokeSnapshot = useCallback(() => {
    const off = offRef.current;
    if (!off) return;
    const sctx = off.scratch.getContext('2d')!;
    sctx.globalCompositeOperation = 'source-over';
    sctx.clearRect(0, 0, off.w, off.h);
    sctx.drawImage(off.mask, 0, 0);
  }, []);

  /** 把 [x,y,w,h] 这块的 before(scratch) / after(mask) 推进撤销栈 */
  const pushUndoBox = useCallback((x: number, y: number, w: number, h: number) => {
    const off = offRef.current;
    if (!off || w <= 0 || h <= 0) return;
    const before = off.scratch.getContext('2d')!.getImageData(x, y, w, h);
    const after = off.mask.getContext('2d')!.getImageData(x, y, w, h);
    const stack = undoRef.current;
    stack.push({ before, after, x, y, bytes: before.data.length * 2 });
    let total = stack.reduce((n, s) => n + s.bytes, 0);
    while (stack.length > UNDO_MAX_STEPS || (total > UNDO_MAX_BYTES && stack.length > 1)) {
      total -= stack.shift()!.bytes;
    }
    redoRef.current = [];
  }, []);

  const undo = useCallback(() => {
    const off = offRef.current;
    const step = undoRef.current.pop();
    if (!off || !step) return;
    const ctx = off.mask.getContext('2d')!;
    ctx.putImageData(step.before, step.x, step.y);
    redoRef.current.push(step);
    redrawComposite();
  }, [redrawComposite]);

  const redo = useCallback(() => {
      const off = offRef.current;
    const step = redoRef.current.pop();
    if (!off || !step) return;
    const ctx = off.mask.getContext('2d')!;
    ctx.putImageData(step.after, step.x, step.y);
    undoRef.current.push(step);
    redrawComposite();
  }, [redrawComposite]);

  /* ── 改动候选「擦掉」（参考实现：虚线框上那颗按钮）──
     点一下 = 把该区域并入蒙版（等同"自动采纳"它），并在画面上撤掉这个框。
     走的是**和画笔同一条写蒙版路径**（重算 `adopted` → `maskFromRegions` → `upscaleMask`），
     所以它天然可被 ⌘Z 撤销、可被后续画笔叠加。 */
  const adoptCandidate = useCallback(
    (region: ChangedRegion) => {
      const off = offRef.current;
      const det = detRef.current;
      if (!off || !det || region.adopted) return;
      const ctx = off.mask.getContext('2d', { willReadFrequently: true })!;
    const before = ctx.getImageData(0, 0, off.w, off.h);
      region.adopted = true;
      ctx.clearRect(0, 0, off.w, off.h);
      const big = upscaleMask(maskFromRegions(det), det.dw, det.dh, off.w, off.h, det.maskBlurPx);
      putRGBA(ctx, big, off.w, off.h);
    const after = ctx.getImageData(0, 0, off.w, off.h);
      undoRef.current.push({ before, after, x: 0, y: 0, bytes: before.data.length * 2 });
      redoRef.current = [];
      setCands((prev) => prev.filter((r) => r !== region));
      setAdopt((prev) => ({
        ...prev,
        adopted: prev.adopted + 1,
        candidates: Math.max(0, prev.candidates - 1),
      }));
      redrawComposite();
    },
    [redrawComposite],
  );

  /* ── 管线：可带「高级」里的手动微调**重跑**（对齐 dx/dy/缩放、校色增益）──
     抽出来是因为「重新识别 / 对齐微调 / 校色参数」都要拿**同一份原图 / 修改图**重算一遍，
     而载图（异步、要 `createImageBitmap`）只做一次 ⇒ 位图放 `rawRef`，这里纯同步。*/
  const runPipeline = useCallback(
    (over: PipelineOverride | null) => {
      const raw = rawRef.current;
    const off = offRef.current;
      if (!raw || !off) return;
      const { orig: origBmp, mod: modBmp } = raw;
      const w = off.w;
      const h = off.h;

        const octx = off.orig.getContext('2d', { willReadFrequently: true })!;
      octx.globalCompositeOperation = 'source-over';
      octx.clearRect(0, 0, w, h);
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(origBmp, 0, 0, w, h);
        const origData = octx.getImageData(0, 0, w, h);

      /* ① 自动对齐（以原图为准，修改图缩放对齐 —— 用户决策④） */
        const modRaw = makeCanvas(w, h);
        const mrawCtx = modRaw.getContext('2d', { willReadFrequently: true })!;
        mrawCtx.imageSmoothingQuality = 'high';
        mrawCtx.drawImage(modBmp, 0, 0, w, h);
        const rawData = mrawCtx.getImageData(0, 0, w, h);
      const autoAlign: AlignResult = alignImages(origData.data, rawData.data, w, h);
      /* 手动微调是**叠加在自动结果上**的增量（相对自动值），不是绝对偏移 —— 用户拖一下
         dx 才发现"自动找错了"，从自动值起步比从 0 起步好用得多 */
      const align: AlignResult = over
        ? {
            ...autoAlign,
            tx: autoAlign.tx + over.dx,
            ty: autoAlign.ty + over.dy,
            sx: autoAlign.sx * over.scale,
            sy: autoAlign.sy * over.scale,
          }
        : autoAlign;

        const mctx = off.mod.getContext('2d', { willReadFrequently: true })!;
        mctx.clearRect(0, 0, w, h);
        mctx.imageSmoothingQuality = 'high';
        mctx.drawImage(modBmp, align.tx, align.ty, w * align.sx, h * align.sy);
        const alignedData = mctx.getImageData(0, 0, w, h);

      /* ② 自动校色（样本 = "看起来没变"的像素）
          ⚠️ 参考实现 `q()` 会跳过 `mask.a>8` 的像素 —— 重跑（用户已经涂过）时要把**旧蒙版**喂进去，
             不然被涂过的区域会污染采样、增益被拉偏。*/
      const prevMask = over ? off.mask.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h) : null;
      const autoCorr: ColorCorrection = computeColorCorrection(
        origData.data,
        alignedData.data,
        prevMask ? prevMask.data : null,
        w,
        h,
      );
      const corr: ColorCorrection = over?.gain
        ? { ...autoCorr, gain: over.gain, sampled: autoCorr.sampled || 1 }
        : autoCorr;
        const corrected = applyColorCorrection(alignedData.data, corr, 1);
      putRGBA(mctx, corrected, w, h);

      /* ③ 改动检测（双路信号 + 中位数+MAD 自适应阈值 + 连通域合并 + 鬼影剔除）*/
        const det: ChangeDetection = detectChanges(origData.data, corrected, w, h);
      const plan = planAdoption(det);
      const adopted = plan.adopted;
      detRef.current = det;
        const maskCtx = off.mask.getContext('2d', { willReadFrequently: true })!;
        maskCtx.clearRect(0, 0, w, h);
      /* ④ 铺初始蒙版：
         · 背景替换模式（参考 `Y()`）—— **整张图**除了"没变的前景块"以外全换成修改图。
           旧实现只把这句话当文案、蒙版留空 ⇒ 用户那张"AI 重渲"的图在 MTV 上一个像素都没被换掉。
         · 局部改动 —— 按已采纳连通域的**真实形状**（不是包围盒！）膨胀 + 羽化。*/
      if (det.bgMode) {
        const big = upscaleMask(maskFromRegions(det), det.dw, det.dh, w, h, det.maskBlurPx);
        putRGBA(maskCtx, big, w, h);
      } else if (adopted.length) {
          const small = maskFromRegions(det);
        const big = upscaleMask(small, det.dw, det.dh, w, h, det.maskBlurPx);
        putRGBA(maskCtx, big, w, h);
      }
      setAutoGain([autoCorr.gain[0], autoCorr.gain[1], autoCorr.gain[2]]);
      setCands(plan.cands);
      /* 画面区的屏幕尺寸：面板 = 卡片（流坐标）⇒ 屏幕 = 流 × zoom = 流 / `--float-scale`。
         只用于把 chip 避让阈值（150 / 30 屏幕 px）换算成百分比。 */
      const drawRoot = rootRef.current?.closest('.canvas-drawing-root') as HTMLElement | null;
      const floatScale =
        Number.parseFloat(drawRoot ? getComputedStyle(drawRoot).getPropertyValue('--float-scale') : '1') || 1;
      setDetSize({
        dw: det.dw,
        dh: det.dh,
        screenW: Math.max(1, containerWidth / floatScale),
        screenH: Math.max(1, containerHeight / floatScale),
      });
      setAdopt({ adopted: adopted.length, candidates: plan.extra, autoAll: plan.auto });
      setShowBoxes(plan.showBoxes);

      const ratio = modBmp.width / modBmp.height;
      const origRatio = w / h;
      const parts: string[] = [];
      /* 对齐读数按网页版 `N()`（html:34220）的写法：偏移 x/y + 缩放百分比 + 模式 + 块数 + 残差 */
      const sign = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
      const scalePct = (v: number) => `${(100 * v).toFixed(2)}%`;
      const geo =
        `${t('已自动对齐')} ${align.mode} · x ${sign(align.tx)} y ${sign(align.ty)}` +
        (align.sx !== 1 || align.sy !== 1 ? ` · ${t('缩放')} ${scalePct(align.sx)}/${scalePct(align.sy)}` : '') +
        (align.blocks ? ` · ${align.blocks} ${t('个纹理块')}` : '') +
        (over ? ` · ${t('含手动微调')}` : '');
      parts.push(
        geo +
          (align.resid > ALIGN_RESID_WARN_PX ? ` · ${t('两图有局部形变，边缘建议用大一点的画笔')}` : ''),
      );
      parts.push(
        corr.sampled > 0
          ? `${t('已校色')} R×${corr.gain[0].toFixed(3)} G×${corr.gain[1].toFixed(3)} B×${corr.gain[2].toFixed(3)}`
          : t('可用于校色的未变像素太少，跳过校色'),
      );
      /* ⚠️ 「自动采用 N 处 · 框出 M 处」**不放进 `parts`** —— 那个字符串只在检测那一刻生成，
          点「擦掉」后不会更新，悬停看到的计数就是假的 ✗。它由 `adopt` 状态在渲染时拼。 */
      if (Math.abs(ratio - origRatio) / origRatio > 0.01) parts.push(t('两图比例不同，已按原图拉伸'));
      if (det.bgMode) {
        parts.push(`${t('背景替换模式')}：${det.changedShare}% ${t('的图像素差异超过 20')} · ${t('保留')} ${det.keepCount} ${t('处未变前景')}`);
      }
      setInfo({
        align: parts.join(' · '),
        corr:
          corr.sampled > 0
            ? `R×${corr.gain[0].toFixed(3)} G×${corr.gain[1].toFixed(3)} B×${corr.gain[2].toFixed(3)}`
            : '—',
        noise: `T=${det.noise.threshold.toFixed(1)}`,
        regions: det.bgMode
          ? `${t('背景替换')} · ${det.keepCount} ${t('处前景')} · ${t('残差')} ${align.resid.toFixed(2)}px`
          : `${adopted.length}/${det.regions.length} · ${t('残差')} ${align.resid.toFixed(2)}px`,
      });

      // 可见画布尺寸 = 原图尺寸；CSS 负责缩放适配
        const view = viewRef.current;
        const maskView = maskViewRef.current;
        if (view) {
          view.width = w;
          view.height = h;
      }
        if (maskView) {
          maskView.width = w;
          maskView.height = h;
      }
      /* ★☆★ 面板尺寸 = **卡片尺寸**（用户 2026：「其他卡片什么样就什么样吧，图卡的逻辑」）。
         就是 MTV 图卡那套 `pR(ratio)`：短边恒 250、跟着图片比例走 ⇒ 编辑器 = 一张图卡，
         **不放大也不缩小**，和其它编辑器（重绘 / 裁剪）完全同构。
         ⚠️ 别再用视口去算一个"屏幕恒定"的大面板 ✗ —— 实测那样竖图会占满整屏
            （宽 = 底栏 645 ⇒ 高被比例锁成 1148），用户直接反问「怎么一点击就全屏了」。
         ⚠️ 高宽用 `containerWidth/Height`（对比卡派生、源图卡尺寸）内联给，流坐标 ✓ */
      setPanel({
        w: Math.max(1, Math.round(containerWidth)),
        h: Math.max(1, Math.round(containerHeight)),
      });
        setStatus('ready');
        redrawComposite();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );
  /* 载图 effect 只认图源 ⇒ 用 ref 拿最新的 `runPipeline`（否则它每次重建都会重载位图）。
     ⚠️ 必须**渲染之后**写（`react-hooks/refs` 禁止渲染期改 ref）；
     本 effect 声明在载图 effect **之前** ⇒ 同一次 commit 里先跑到，载图 await 回来时一定是最新的 ✓ */
  const runRef = useRef(runPipeline);
  useEffect(() => {
    runRef.current = runPipeline;
  });

  /** 「高级」里改了对齐/校色 ⇒ 带着覆盖值重跑；「重新识别」⇒ 清掉覆盖值重跑 */
  const rerun = useCallback((over: PipelineOverride | null) => {
    setBusy(true);
        /* ① 自动对齐（以原图为准，修改图缩放对齐 —— 用户决策④） */
    requestAnimationFrame(() => {
      try {
        runRef.current(over);
      } finally {
        setBusy(false);
      }
    });
  }, []);

        /* 拿不到捕获也能画，只是移出元素就断笔 */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!origSrc || !modSrc) {
          setStatus('error');
          setErrorText(t('没有找到原图：请把本卡连在一个图片节点的下游（上游那张就是原图）'));
          return;
        }
        setStatus('running');
        const [origBmp, modBmp] = await Promise.all([loadBitmap(origSrc), loadBitmap(modSrc)]);
        if (cancelled) return;

        const w = origBmp.width;
        const h = origBmp.height;
        const off = {
          orig: makeCanvas(w, h),
          mod: makeCanvas(w, h),
          mask: makeCanvas(w, h),
          soft: makeCanvas(w, h),
          tmp: makeCanvas(w, h),
          scratch: makeCanvas(w, h),
          w,
          h,
        };
        offRef.current = off;
        rawRef.current = { orig: origBmp, mod: modBmp };
        undoRef.current = [];
        redoRef.current = [];
        /* 换图（含 ⇄ 交换角色）⇒ 视图复位到 100%，否则上一张的缩放/位移会套到新图上 */
        resetView();
        runRef.current(null);
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setErrorText(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
    /* 载图只在换图时重来；管线走 `runRef`，所以不需要把 `runPipeline` 放进依赖 */
  }, [origSrc, modSrc, resetView, t]);

  useEffect(() => {
    redrawComposite();
  }, [redrawComposite]);

  /**
   * 编号 chip 的纵向避让（参考实现 `layoutCandidates()` 的 `placed` 循环）：
   *   挨个放；如果和已放的某个 chip 在 **x 差 < 150 屏幕 px** 且 **y 差 < 30 屏幕 px** 内撞了，
   *   就把它往下挪 30 屏幕 px，最多试 6 次。
   * 返回每个 chip 相对框顶边的偏移（屏幕 px，已含参考实现那 -4px 的抬升）。
   */
  const chipShift = useMemo(() => {
    const W = Math.max(1, detSize.screenW);
    const H = Math.max(1, detSize.screenH);
    const cw = Math.max(1, detSize.dw);
    const ch = Math.max(1, detSize.dh);
    const xTol = (150 / W) * 100;
    const yTol = (30 / H) * 100;
    const step = (30 / H) * 100;
    const placed: { x: number; y: number }[] = [];
    return cands.map((r) => {
      const x = (r.minX / cw) * 100;
      const base = (r.minY / ch) * 100;
      let y = base;
      for (let k = 0; k < 6; k++) {
        const hit = placed.find((p) => Math.abs(p.x - x) < xTol && Math.abs(p.y - y) < yTol);
        if (!hit) break;
        y = hit.y + step;
      }
      placed.push({ x, y });
      return -4 + ((y - base) / 100) * H;
    });
  }, [cands, detSize]);

  /* ── 打开期间让开 MTV 的品牌火焰按钮 ────────────────────────────────────
     那颗 `brand-flame-button` 是 48×48、挂在 `canvas-brand-nav`（`z-index:40`，画布顶部居中），
     属于**画布 chrome**、层级在 React Flow 节点之上 ⇒ 实测它正好压在本编辑器工具条的中段
     （`elementsFromPoint` 在工具条内的采样点命中的就是它），既挡视线又抢点击
     （用户口径：不要出现"被遮挡"）。它只是品牌装饰 ⇒ 编辑期间挂一个类把它让开；
     挂在 `.canvas-drawing-root` 上（`canvas-brand-nav` 的祖先），关闭时移除。 */
  useEffect(() => {
    const rootEl = rootRef.current?.closest('.canvas-drawing-root');
    if (!rootEl) return;
    rootEl.classList.add('ilf-editor-open');
    /* ★ 顺手把对比滑块的焦点摘掉：`.cmp:focus-visible` 会画一条 **官方白 `--foreground`** 的
       `box-shadow: 0 0 0 2px` 焦点圈（`image-compare.css` 的 `--signal`），它就在卡片边缘
       ⇒ 编辑器盖上去之后，卡片四周会出现一圈蓝边（用户实测报「有蓝色」✗）。
       CSS 那边也加了 `.ilf-editor-open .cmp:focus-visible{box-shadow:none}` 兜底。 */
    const active = rootEl.ownerDocument.activeElement as HTMLElement | null;
    if (active && active.classList.contains('cmp')) active.blur();
    return () => rootEl.classList.remove('ilf-editor-open');
  }, []);

  /* ── 顶栏 / 底栏贴边自动内移（按帧）─────────────────────────────────────
     面板 = 卡片本身（跟其他图卡一样大），位置不用管；要管的只有挂在它上下的两条：
     顶栏（悬在面板上方 64）与底栏（挂在下 16），它们**屏幕尺寸恒定**、比卡片宽得多
     ⇒ 卡片靠近屏幕左右边缘时会有一半出画。画布的平移/缩放是**逐帧**变的
     （`--float-scale` 就是逐帧写的），CSS 里拿不到卡片的屏幕位置，
     所以按帧量一次越界量、写进 `--ilf-shift`（CSS 那两条 `transform` 用它）。 */
  useEffect(() => {
    if (status !== 'ready') return;
    let raf = 0;
    const EDGE_PAD = 12;
    const tick = () => {
      const root = rootRef.current;
      if (root) {
        const rect = root.getBoundingClientRect();
        const toolbar = root.querySelector<HTMLElement>('.irf-toolbar');
        const bar = root.querySelector<HTMLElement>('.irf-bar');
        /* 顶栏 / 底栏都以**卡片中线**居中（`left:50%` + `translateX(-50%)`），
           而它们比卡片宽得多（底栏要 645 屏幕 px 才能一行放下，卡片可能只有 125）
           ⇒ 卡片靠屏幕边缘时它们会有一半出画。按帧量一次越界量写进 `--ilf-shift`
           （CSS 那两条 `transform` 用它）。`offsetWidth` 已经等于屏幕宽度
           （元素自带 `scale(--irf-scale)`，与祖先 `zoom` 恰好抵消）。 */
        const centerX = rect.left + rect.width / 2;
        for (const el of [toolbar, bar]) {
          if (!el) continue;
          const w = el.offsetWidth;
          let shift = 0;
          if (w <= window.innerWidth - 2 * EDGE_PAD) {
            const left = centerX - w / 2;
            if (left < EDGE_PAD) shift = EDGE_PAD - left;
            else if (left + w > window.innerWidth - EDGE_PAD) {
              shift = window.innerWidth - EDGE_PAD - (left + w);
            }
          }
          const value = `${Math.round(shift)}px`;
          if (el.style.getPropertyValue('--ilf-shift') !== value) {
            el.style.setProperty('--ilf-shift', value);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  /* ── 画笔：参考实现 `dt()` 的同心圈柔边 ── */
  const strokeAt = useCallback(
    (pts: { x: number; y: number }[]) => {
    const off = offRef.current;
      if (!off || !pts.length) return;
      const ctx = off.mask.getContext('2d')!;
      ctx.globalCompositeOperation = brushMode === 'erase' ? 'destination-out' : 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#fff';
      const rings = hardness >= 0.99 ? 1 : BRUSH_RING_COUNT;
      for (let i = 1; i <= rings; i++) {
        ctx.lineWidth =
          rings === 1
            ? brushSize
            : Math.max(0.5, brushSize * (hardness + (1 - hardness) * (1 - (i - 1) / rings)));
        ctx.globalAlpha = rings === 1 ? 1 : 1 / (rings - i + 1);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 1) ctx.lineTo(pts[0].x + 0.01, pts[0].y);
        else for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
    [brushMode, brushSize, hardness],
  );

  const toImageCoords = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const off = offRef.current;
    const canvas = event.currentTarget;
    if (!off) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * off.w,
      y: ((event.clientY - rect.top) / rect.height) * off.h,
    };
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== 'ready') return;
      /* ⚠️ 必须 try/catch：`setPointerCapture` 对"非活动指针"会抛 NotFoundError
          （合成事件、以及指针在别处被系统收走时都会中招）—— 抛出去会把整条笔画吞掉。 */
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* 拿不到捕获也能画，只是移出元素就断笔 */
      }
      /* 空格按住 = 平移，不落笔（参考 `MattingEditor.tsx:431-455` 的"平移就绪态"）*/
      if (spaceRef.current) {
        const cur = viewStateRef.current;
        panRef.current = {
          x: event.clientX,
          y: event.clientY,
          tx: cur.tx,
          ty: cur.ty,
          k: ancestorScale(),
        };
        setPanning(true);
      return;
      }
      drawingRef.current = true;
      /* 落笔前把蒙版拷到 scratch（撤销只在收笔时按 bbox 抠，见 `pushUndoBox`）*/
      beginStrokeSnapshot();
      const p = toImageCoords(event);
      strokeBoxRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      strokeAt([p]);
      redrawComposite();
    },
    [ancestorScale, beginStrokeSnapshot, redrawComposite, status, strokeAt, toImageCoords],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const pan = panRef.current;
      if (pan) {
        setView((prev) =>
          clampView({
            s: prev.s,
            tx: pan.tx + (event.clientX - pan.x) / pan.k,
            ty: pan.ty + (event.clientY - pan.y) / pan.k,
          }),
        );
        return;
      }
      if (!drawingRef.current) return;
      const p = toImageCoords(event);
      const box = strokeBoxRef.current;
      if (box) {
        box.x0 = Math.min(box.x0, p.x);
        box.y0 = Math.min(box.y0, p.y);
        box.x1 = Math.max(box.x1, p.x);
        box.y1 = Math.max(box.y1, p.y);
      }
      strokeAt([p]);
      redrawComposite();
    },
    [clampView, redrawComposite, strokeAt, toImageCoords],
  );

  const endStroke = useCallback(() => {
    /* 平移收手：既不推撤销、也不能把 drawing 状态带歪 */
    if (panRef.current) {
      panRef.current = null;
      setPanning(false);
      return;
    }
    drawingRef.current = false;
    /* 收笔：按本笔的包围盒（外扩半个笔头，覆盖柔边）推一步撤销 —— 参考实现 `lt(bbox)` */
    const box = strokeBoxRef.current;
    const off = offRef.current;
    strokeBoxRef.current = null;
    if (box && off) {
      const pad = brushSize / 2 + 3;
      const x = Math.max(0, Math.floor(Math.min(box.x0, box.x1) - pad));
      const y = Math.max(0, Math.floor(Math.min(box.y0, box.y1) - pad));
      const x1 = Math.min(off.w, Math.ceil(Math.max(box.x0, box.x1) + pad));
      const y1 = Math.min(off.h, Math.ceil(Math.max(box.y0, box.y1) + pad));
      pushUndoBox(x, y, Math.max(0, x1 - x), Math.max(0, y1 - y));
    }
  }, [brushSize, pushUndoBox]);

  /* 参考实现：**撤销是 ⌘Z**（不是按钮）；这里照做，另外补 Esc 关闭。
     挂 window 且只用捕获阶段监听按键，不拦截输入框里的原生撤销。
     2026 补：空格（平移，见 `MattingEditor.tsx:431`）与 ⌘0（复位视图，见 `ImageComposerEditor.tsx:466`）。*/
  useEffect(() => {
    const inField = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      return !!node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.code === 'Space') {
        if (inField(e.target)) return;
        /* 必须 preventDefault：否则空格会滚动画布 / 触发刚点过的按钮 */
        e.preventDefault();
        spaceRef.current = true;
        setPanReady(true);
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === '0') {
        e.preventDefault();
        resetView();
        return;
      }
      if (e.key.toLowerCase() !== 'z') return;
      if (inField(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      spaceRef.current = false;
      setPanReady(false);
      if (panRef.current) {
        panRef.current = null;
        setPanning(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      spaceRef.current = false;
      panRef.current = null;
    };
  }, [onCancel, redo, resetView, undo]);

  /**
   * 用**算法层**再算一遍最终像素（不依赖画布合成）。
   * 这样"蒙版外逐像素等于原图"这条无损契约有测试兜底（见 `tests/utils/losslessComposite.test.ts`），
   * 而不是靠一连串 canvas 合成操作"看起来对"。
   */
  const buildCompositeCanvas = useCallback((): HTMLCanvasElement | null => {
    const off = offRef.current;
    if (!off) return null;
    const octx = off.orig.getContext('2d', { willReadFrequently: true })!;
    const mctx = off.mod.getContext('2d', { willReadFrequently: true })!;
    /* ⚠️ 用**羽化后**的蒙版：预览走 `redrawComposite`（同样用 `softMask()`）⇒ 两边一致 */
    const kctx = (softMask() ?? off.mask).getContext('2d', { willReadFrequently: true })!;
    const out = compositeLossless(
      octx.getImageData(0, 0, off.w, off.h).data,
      mctx.getImageData(0, 0, off.w, off.h).data,
      kctx.getImageData(0, 0, off.w, off.h).data,
      1,
    );
    const final = makeCanvas(off.w, off.h);
    putRGBA(final.getContext('2d')!, out, off.w, off.h);
    return final;
  }, [softMask]);

  const handleApply = useCallback(() => {
    const off = offRef.current;
    const final = buildCompositeCanvas();
    if (!off || !final) return;
    onApply({ dataUrl: final.toDataURL('image/png'), width: off.w, height: off.h });
  }, [buildCompositeCanvas, onApply]);

  /** 下载合成图（原尺寸 PNG）—— 参考实现的「下载合成图」*/
  const handleDownloadPng = useCallback(() => {
    const final = buildCompositeCanvas();
    if (!final) return;
    final.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${t('无损改图')}-${Date.now()}.png`);
    }, 'image/png');
  }, [buildCompositeCanvas, t]);

  /**
   * 导出分层 PSD。图层结构与参考实现**逐条一致**：
   *   [原图] [修改图（已校色）+ 蒙版] [盖印_合成]
   * `ag-psd` 按需 `import()`（参考实现也是运行时才加载 `vendor/ag-psd.js`）⇒ 不进主包。
   */
  const handleExportPsd = useCallback(async () => {
    const off = offRef.current;
    const composite = buildCompositeCanvas();
    if (!off || !composite) return;
    setBusy(true);
    try {
      const agPsd = await import('ag-psd');
      const psd = agPsd.writePsd(
        {
          width: off.w,
          height: off.h,
          canvas: composite,
          children: [
            { name: t('原图'), canvas: off.orig },
            {
              name: t('修改图（已校色）'),
              canvas: off.mod,
              /* 参考实现：蒙版是图层自带的 raster mask，矩形铺满整张。
                 ⚠️ 给**原始**蒙版（不是羽化后的）：PSD 里的蒙版是数据，柔边只属于「合成结果」 */
              mask: { top: 0, left: 0, right: off.w, bottom: off.h, defaultColor: 0, canvas: off.mask },
            },
            { name: t('盖印_合成'), canvas: composite },
          ],
        },
        { generateThumbnail: true },
      );
      downloadBlob(
        new Blob([psd as unknown as BlobPart], { type: 'application/octet-stream' }),
        `${t('无损改图')}-${Date.now()}.psd`,
      );
    } catch (error) {
      useAppStore.getState().showToast(
        `${t('PSD 导出失败')}：${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    } finally {
      setBusy(false);
    }
  }, [buildCompositeCanvas, t]);


  return (
        <div
      className="irf-root nodrag nopan"
      data-mode="lossless"
      data-testid="image-floating-composite-editor"
      ref={rootRef}
      /* 面板尺寸内联给（运行时才知道图片比例），CSS 只负责居中与描边 */
      style={panel.w ? { width: panel.w, height: panel.h } : undefined}
      /* 处理状态（对齐/校色/噪声/采纳）挂 title —— 「高级」层还没做。
         「自动采用 / 框出」由 `adopt` 状态拼 ⇒ 点「擦掉」后悬停看到的计数是**实时**的 ✗ */
      title={
        status === 'ready'
          ? [
              info.align,
              adopt.autoAll
                ? `${t('自动采用')} ${adopt.adopted} ${t('处改动')}`
                : `${t('自动采用')} ${adopt.adopted} ${t('处改动')} · ${t('框出')} ${adopt.candidates} ${t('处候选')}`,
            ]
              .filter(Boolean)
              .join(' · ')
          : info.align || undefined
      }
    >
      {/* ── 画面区：合成预览 + 蒙版（可绘制）── */}
      <div className="irf-stage" data-testid="image-composite-stage" ref={stageRef}>
        {/* ★ 视图层：**唯一**挂 `translate`/`scale` 的节点（滚轮缩放 / 空格平移）。
            画面、蒙版层、绘制层、改动标注必须同挂在它下面 —— 分开变换会让笔迹和底图错位。
            `--ilf-vscale` = 当前视图倍数，CSS 用它把 `--irf-scale` 再除一次，
            这样「屏幕恒定」的标注在放大后**不会**跟着变大（见 image-lossless-float.css）。*/}
              <div
          className="ilf-vport"
          ref={vportRef}
          data-testid="image-composite-vport"
          data-zoom={view.s}
          style={
            {
              /* ★ 100% 时**不写 transform**：`transform` 会让这层变成 containing block
                 + 独立合成层，图/蒙版在画布 zoom 下的取样会跟着变（用户实测：
                 「放大缩小画布后 图卡内部也跟着变化」「粉红蒙版和底图对不上」）。
                 只在真的缩放/平移过之后才上变换 ⇒ 默认状态与改造前逐像素一致。 */
              transform:
                view.s === 1 && view.tx === 0 && view.ty === 0
                  ? undefined
                  : `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`,
              '--ilf-vscale': String(view.s),
            } as React.CSSProperties
          }
        >
          {/* 几何交给 `.irf-image`（absolute inset:0 + 100%）—— 面板本身就是图片比例 ⇒ 等比铺满、不变形 */}
          <canvas ref={viewRef} className="irf-image" />
      <div
          className="ilf-mask-view"
          style={{
            position: 'absolute',
              inset: 0,
              opacity: showMask ? 0.45 : 0,
              /* ⚠️ 这里**不能**给底色：canvas 未涂抹处是透明的，父层底色会整片透出来
                 （配 `mix-blend-mode` 时尤其明显）。红色由 canvas 自己画，见 `redrawComposite`。*/
            pointerEvents: 'none',
            transition: 'opacity .15s ease',
            }}
          >
            <canvas ref={maskViewRef} style={{ width: '100%', height: '100%' }} />
        </div>
        <canvas
          className="irf-paint"
          style={{
            background: 'transparent',
              /* 空格按住时换抓手（`grabbing` 在拖拽中）—— 否则一直是 `.irf-paint` 的十字准星 */
              ...(panReady ? { cursor: panning ? 'grabbing' : 'grab' } : null),
            }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
          />
        {/* ── 改动标注：虚线框 + `#N 改动大` 彩色编号 chip（参考实现 `#cands`）──
            · 框 = **真实 bbox**（参考 `strokeRect(box[0]..box[2], box[1]..box[3])`），
              不要"取中心 + 最小尺寸"那套 —— 那样框和改动位置对不上（用户：「框选不对」✗）
            · 颜色 5 色循环（参考 `['#3ccf8e','#f5b342','#ff5c6c','#4f8cff','#c77dff']`）
            · chip 贴在框**左上角上方**，撞了就往下让 30 屏幕 px（参考 `layoutCandidates` 的避让）
            · 点 chip = 把这块换成修改图（参考 `eraseCandidate(i)`）
            ⚠️ **含已自动采用的高强度区域** —— 参考实现的 `cands` 就是"采用 + 候选"的并集；
               只画未采用的那批，会在「N 处自动采用 + 0 个弱候选」的图上**一个标注都没有** ✗
            ⚠️ 「按住对比」时必须**整层隐藏**（README：「对比时候选框和提示会隐藏」） */}
        {status === 'ready' && !comparing && showBoxes && cands.length > 0 && detSize.dw > 0 && (
          <div className="ilf-cands" data-testid="image-composite-cands">
            {cands.map((r, i) => (
              <div
                key={`${r.minX}-${r.minY}-${i}`}
                className={`ilf-cand c${i % 5}`}
          style={{
                  left: `${((r.minX / detSize.dw) * 100).toFixed(4)}%`,
                  top: `${((r.minY / detSize.dh) * 100).toFixed(4)}%`,
                  width: `${(((r.maxX - r.minX + 1) / detSize.dw) * 100).toFixed(4)}%`,
                  height: `${(((r.maxY - r.minY + 1) / detSize.dh) * 100).toFixed(4)}%`,
                }}
              >
                <button
                  type="button"
                  className="ilf-cand-chip"
                  data-testid={`image-composite-cand-${i}`}
                  style={{ top: `calc(${chipShift[i] ?? -4}px * var(--irf-scale))` }}
                  title={`${t('点一下把这块换成修改图')} · ${t('差异强度')} ${Math.round(r.meanExcess * 100)} · ${t('占画面')} ${(((r.maxX - r.minX + 1) * (r.maxY - r.minY + 1)) / (detSize.dw * detSize.dh) * 100).toFixed(1)}%`}
                  onClick={(event) => {
                    event.stopPropagation();
                    adoptCandidate(r);
                  }}
                >
                  #{i + 1} {t('改动大')}
      </button>
          </div>
            ))}
              </div>
        )}
          </div>
        {/* 加载/报错提示**不随视图变换**（它盖的是整个画面区，不是图）*/}
        {status !== 'ready' && (
          <div className="irf-loading">
            {status === 'error'
              ? errorText
              : status === 'running'
                ? t('正在自动对齐与校色…')
                : t('原图 / 修改图加载中…')}
        </div>
        )}
          </div>

      {/* ── 浮动工具条 ── */}
      {/* ── 顶部工具条（用户口径）：
            修改 | 还原  ·  修改范围  ·  实心 | 柔边 + 大小滑块 + 预览点
            ⚠️ 「原图不透明度」按用户更正**只保留在底部**，这里不改。
            ⚠️ 撤销/重做按参考实现改成 **⌘Z / ⌘⇧Z**（见上面的 keydown effect），不再占按钮位。
── */}
      <div
        className={`irf-toolbar${advOpen ? ' ilf-toolbar-adv' : ''}`}
        data-testid="image-composite-toolbar"
      >
        {/* 处理状态（对齐/校色/噪声/采纳）—— 放工具条末尾单行省略，**不占底栏的行**
            （否则底栏变 3 行；用户口径：底部就是 2 行） */}
        <button type="button" className="irf-btn irf-close" onClick={onCancel} title={t('关闭')} aria-label={t('关闭')}>×</button>
        <span className="irf-sep" aria-hidden="true" />
        <div className="irf-toolgroup" role="group">
          <button
            type="button"
            className="irf-tool"
            data-state={brushMode === 'paint' ? 'on' : 'off'}
            onClick={() => setBrushMode('paint')}
            title={t('修改')}
            aria-label={t('修改')}
            data-testid="composite-brush-paint"
          >
            {t('修改')}
                </button>
          <button
            type="button"
            className="irf-tool"
            data-state={brushMode === 'erase' ? 'on' : 'off'}
            onClick={() => setBrushMode('erase')}
            title={t('还原')}
            aria-label={t('还原')}
            data-testid="composite-brush-erase"
          >
            {t('还原')}
        </button>
      </div>
        <span className="irf-sep" aria-hidden="true" />
        {/* 参考实现叫「修改范围」（= 用红色标出已换成修改图的范围）*/}
        <button
          type="button"
          className="irf-tool"
          data-state={showMask ? 'on' : 'off'}
          onClick={() => setShowMask((v) => !v)}
          title={t('显示蒙版')}
          data-testid="composite-show-mask"
        >
            {t('撤销')}
          </button>
        <span className="irf-sep" aria-hidden="true" />
        {/* 画笔组：实心 | 柔边 + 大小滑块 + 预览点（参考实现是 `#tip` 段控件 + `#rSize` + `#tipPrev`）*/}
        <div className="irf-toolgroup" role="group">
        <button
          type="button"
            className="irf-tool"
            data-state={hardness >= 0.99 ? 'on' : 'off'}
            onClick={() => setHardness(1)}
            title={t('实心画笔，边缘清晰')}
            data-testid="composite-hard-solid"
          >
            {t('重做')}
          </button>
              <button
                type="button"
            className="irf-tool"
            data-state={hardness < 0.99 ? 'on' : 'off'}
            onClick={() => setHardness(0.5)}
            title={t('柔边画笔，边缘渐变')}
            data-testid="composite-hard-soft"
          >
          {t('显示蒙版')}
          </button>
        </div>
            <input
              type="range"
          className="ilf-size-range"
              min={BRUSH_MIN_SIZE}
              max={BRUSH_MAX_SIZE}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
          title={t('按住对比')}
              aria-label={t('笔刷大小')}
          data-testid="composite-brush-size"
        />
        {/* 预览点：当前画笔的**大小与软硬**（参考实现 `#tipPrev` 那枚 80×80 小画布） */}
              <span
          className="ilf-tip-preview"
          title={t('当前画笔的大小和软硬')}
          aria-hidden="true"
                style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            flexShrink: 0,
            background:
              hardness >= 0.99
                ? '#fff'
                : `radial-gradient(circle, #fff ${Math.round(hardness * 100)}%, rgba(255,255,255,0) 100%)`,
          }}
        />
        <span className="irf-sep" aria-hidden="true" />
        {/* 「高级」：对齐微调 / 校色参数 / 柔边 / 重新识别 / 处理状态
            （参考实现：「对齐微调、校色参数、柔边、重新识别、PSD 导出、处理状态全部收在
             「高级」弹层里」。这里的 PSD 导出按用户口径留在底栏，不重复放）*/}
        <button
          type="button"
          className="irf-tool ilf-adv-btn"
          data-state={advOpen ? 'on' : 'off'}
          onClick={() => setAdvOpen((v) => !v)}
          title={t('对齐微调 / 校色参数 / 柔边 / 重新识别')}
              aria-label={t('笔刷硬度')}
          data-testid="composite-advanced"
        >
          {t('按住对比')}
          </button>
        {advOpen && (
          <div className="ilf-adv" data-testid="image-composite-advanced">
            <div className="ilf-adv-head">
              <b>{t('高级')}</b>
              <button
                type="button"
          className="irf-btn"
                onClick={() => setAdvOpen(false)}
                  aria-label={t('原图不透明度')}
                title={t('关闭')}
              >
                脳
        </button>
        </div>

            {/* ① 处理状态（原来挂在面板 `title` 上，进了高级就该看得见） */}
            <div className="ilf-adv-sec">
              <div className="ilf-adv-label">{t('澶勭悊鐘舵€')}</div>
              <div className="ilf-adv-status">
                <span>{info.align || '—'}</span>
                <span>
                  {t('对齐')}：{info.regions || '—'}
                </span>
                <span>
                  {t('校色')}：{info.corr || '—'}
                </span>
                <span>
                  {t('噪声')}：{info.noise || '—'}
                </span>
        </div>
      </div>

            {/* ② 对齐微调（增量，叠加在自动结果上）*/}
            <div className="ilf-adv-sec">
              <div className="ilf-adv-label">{t('对齐微调')}</div>
              <Tuner
                label="dx"
                value={over?.dx ?? 0}
                step={1}
                digits={0}
                onChange={(v) =>
                  updateOver({ dx: v }, over, setOver, rerun)
                }
              />
              <Tuner
                label="dy"
                value={over?.dy ?? 0}
                step={1}
                digits={0}
                onChange={(v) =>
                  updateOver({ dy: v }, over, setOver, rerun)
                }
              />
              <Tuner
                label={t('缩放')}
                value={over?.scale ?? 1}
                step={0.001}
                digits={3}
                onChange={(v) =>
                  updateOver({ scale: v }, over, setOver, rerun)
                }
              />
            </div>

            {/* ③ 校色参数（增益，手动改了就盖掉自动值） */}
            <div className="ilf-adv-sec">
              <div className="ilf-adv-label">{t('校色参数')}</div>
              {(['R', 'G', 'B'] as const).map((ch, i) => (
                <Tuner
                  key={ch}
                  label={`${ch} 脳`}
                  value={over?.gain?.[i] ?? autoGain?.[i] ?? 1}
                  step={0.005}
                  digits={3}
                  onChange={(v) => {
                    const base = over?.gain ?? autoGain ?? [1, 1, 1];
                    const next = [...base] as [number, number, number];
                    next[i] = v;
                    updateOver({ gain: next }, over, setOver, rerun);
                  }}
                />
              ))}
            </div>

            {/* ④ 柔边：只作用在**合成用的蒙版**上，不动笔迹数据 */}
            <div className="ilf-adv-sec">
              <div className="ilf-adv-label">
                {t('取消')}
                <span className="ilf-adv-val">{feather}px</span>
          </div>
            <input
              type="range"
                className="ilf-adv-range"
              min={0}
                max={24}
                step={1}
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
                aria-label={t('鏌旇竟')}
                data-testid="composite-feather"
              />
        </div>

            {/* ⑤ 视图缩放：滚轮缩放 / 空格平移 / ⌘0 复位之外的**可发现入口**
                （复用抠图编辑器同一套 `ImageEditorZoomControls`，行为与数字一致） */}
            <div className="ilf-adv-sec" data-testid="composite-view-zoom">
              <div className="ilf-adv-label">
                {t('生成合成图')}
                <span className="ilf-adv-val">{Math.round(view.s * 100)}%</span>
      </div>
              <ImageEditorZoomControls
                scale={view.s}
                minScale={VIEW_MIN_SCALE}
                maxScale={VIEW_MAX_SCALE}
                onZoomChange={zoomToCenter}
                onReset={resetView}
              />
              <div className="ilf-adv-row-label" style={{ fontWeight: 400 }}>
                {t('滚轮缩放 · 空格拖拽平移 · 鈱? 复位')}
    </div>
            </div>

            <div className="ilf-adv-actions">
              <button
                type="button"
                className="irf-btn"
                onClick={() => {
                  setOver(null);
                  rerun(null);
                }}
                title={t('清掉手动微调，按自动结果重算')}
                data-testid="composite-reanalyze"
              >
                {t('重新识别')}
        </button>
              <button
                type="button"
                className="irf-btn"
                disabled={busy}
                onClick={() => rerun(over)}
                title={t('鎸夊綋鍓嶅弬鏁伴噸绠')}
                data-testid="composite-reapply"
              >
                {t('应用')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 底部（用户口径）──
            行 1：原图槽 / 修改图槽 / ⇄
            行 2：原图不透明度 · 按住对比 · 下载合成图 · 下载 PSD
            （「生成合成卡」 本功能的产出口，决策①；不在参考实现里，因为它是网页工具） ── */}
      <div className="irf-bar" data-testid="image-composite-bar">
        <div className="irf-bar-inner">
          {/* 行 1：两个素材槽 + 交换 */}
          <div className="ilf-slots" data-testid="composite-slots">
            <span className="ilf-slot" title={t('原图')}>
              <img src={origSrc} alt="" draggable={false} />
              <b>{t('原图')}</b>
          </span>
            <button
              type="button"
              className="irf-btn"
              onClick={() => setSwapped((v) => !v)}
              title={t('交换两张图')}
              aria-label={t('交换两张图')}
              data-testid="composite-swap"
            >
              ⇄
            </button>
            <span className="ilf-slot" title={t('修改图')}>
              <img src={modSrc} alt="" draggable={false} />
              <b>{t('修改图')}</b>
              </span>
          </div>


          {/* 行 2：原图不透明度 · 按住对比 · 下载合成图 · 下载 PSD · 生成合成卡 */}
          <div className="irf-row">
            <div className="irf-row-left">
              <span className="irf-hint" style={{ whiteSpace: 'nowrap' }}>
                {t('原图不透明度')} {Math.round(opacity * 100)}%
                </span>
              <span className="irf-slider" style={{ width: 92, flexShrink: 0 }}>
            <span className="irf-slider-track">
                  <span className="irf-slider-range" style={{ right: `${100 - opacity * 100}%` }} />
                  <span className="irf-slider-thumb" style={{ left: `calc(${opacity * 100}% - 2.18px)` }} />
              </span>
                <input
                  type="range"
                  min={0}
              max={1}
              step={0.01}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  aria-label={t('原图不透明度')}
                  data-testid="composite-opacity"
                />
              </span>
              <button
                type="button"
                className="irf-btn"
          onPointerDown={() => setComparing(true)}
          onPointerUp={() => setComparing(false)}
          onPointerLeave={() => setComparing(false)}
                title={t('按住对比')}
                data-testid="composite-compare"
              >
                {t('按住对比')}
              </button>
            </div>
            <div className="irf-row-right">
              <button
                type="button"
                className="irf-btn"
                onClick={handleDownloadPng}
                disabled={status !== 'ready'}
                data-testid="composite-download-png"
              >
                {t('下载合成图')}
              </button>
              <button
                type="button"
                className="irf-btn"
                onClick={() => void handleExportPsd()}
                disabled={status !== 'ready' || busy}
                data-testid="image-composite-psd"
              >
                {t('下载 PSD')}
              </button>
              <button
                type="button"
                className="irf-save"
                onClick={handleApply}
                disabled={status !== 'ready'}
                data-testid="image-composite-apply"
              >
                {t('生成合成图')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

