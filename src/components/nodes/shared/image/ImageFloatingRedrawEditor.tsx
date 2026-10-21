/**
 * ImageFloatingRedrawEditor —— 官方「浮动重绘编辑器」（`floatingEditorMode === 'redraw'`）复刻
 *
 * ══ 官方出处（`TapNowExtract/.../page-DVqoHdTT.js`，本轮实读；偏移是本文件的实数）══
 * · 工具项 @3113365：`{ node:<Pie size={20}/>, handle: () => k(e,'redraw'), tooltip:n("image.redraw") }`
 *   —— `k` = `openFloatingEditor` ⇒ 重绘 = 打开 mode `'redraw'` 的浮动编辑器（**不是**提示词栏）。
 * · 宿主 `zhe` @1343：`updateNode(id,{zIndex:1001, selected:false})`；点画布空白关闭（见
 *   `utils/officialInputBar.ts` 之外的判定，本次一并抄在 `ImageFloatingCropEditor` 的同类逻辑里）。
 * · 容器 `Fhe` @1340：顶栏 `ghe` 挂 `absolute -top-16 left-1/2 -translate-x-1/2 z-50 w-max`；
 *   底栏 `Dhe` 挂 `absolute left-1/2 -translate-x-1/2 z-50 w-[500px]` + `-bottom-[130px]`；
 *   画布 `xhe` @1316（konva：原图作 `excludeFromExport` 底图，笔画画在上层）；
 *   外框 `w-full h-full relative overflow-visible outline-2 outline-primary/30`。
 * · 顶栏 `ghe` @1330（本文件 `.irf-toolbar`）：
 *   `flex items-center gap-1 p-2 rounded-full bg-sidebar backdrop-blur shadow-lg border border-border`
 *   = ✕ ｜ `w-px h-6 mx-1` ｜ [画笔 / 框选 / 橡皮]（容器 `flex items-center gap-1 rounded-full bg-input/60`，
 *     选中态 `data-[state=on]:bg-white/20 transition-all duration-300`，每颗 `h-8 w-8 rounded-full`）
 *   ｜ `w-px h-6 mx-1` ｜ 粗细（`flex items-center gap-2 h-8 w-24`：24×24 曲线上标 + 滑条 min 1 / max 100 / step 1）
 *   ｜ `w-px h-6 mx-1` ｜ 撤销 / 重做（`h-8 w-8 rounded-full`，无可撤销时 disabled）
 *   ⚠️ redraw 的初始值（`ghe` 的 effect）：`tool='mosaic'`、`brushWidth=30`、brushColor `rgba(255, 255, 255)`
 *     —— 颜色几乎透明，因为官方靠 **mosaic（马赛克预览）** 让用户看见涂过哪里（见 `paint()`）。
 * · 底栏 `Dhe` @1333（本文件 `.irf-bar`）：
 *   `flex-1 flex flex-col gap-2 p-2 rounded-2xl bg-background/90 backdrop-blur shadow-xl border border-border`
 *   = 描述框（`resize-none min-h-[60px] text-sm bg-transparent border-muted`，占位 `image.promptBar.describeChange`
 *     =「描述你想改变什么...」）+ 一行：左「参考图」(`khe`)、右 模型/分辨率/次数(`Nhe`) + 发送(`Wu`，tooltip `image.promptBar.generate`)
 *     ＋ Enter（非 Shift、非输入法）即提交。
 * · 变化逻辑 `jhe.handleGenerate` @1327（本文件 `handleGenerate`）：
 *   ① 未涂蒙版 → toast `image.floatingEditor.drawMaskFirst`（=「请先在图片上绘制蒙版」）；
 *      `mode!=='erase'` 还需要提示词。
 *   ② mask = **黑底 + 原图**，再把画布上涂过的像素（`alpha>0`）在原图 alpha 上**打成 0** ⇒ `mask.png`。
 *   ③ `images = [refUrl?, maskUrl]`；prompt 模板逐字见 `REDRAW_PROMPT_TEMPLATE`。
 *   ④ 先建结果节点（`title: image.redraw` =「重绘」、`prompt` = 用户输入、`params {model,…,times}`）
 *      ＋ 连边（源→新；有参考图则 参考→新）＋ 关编辑器；**再**提交生成（失败则删节点 + `nodes.redrawProcessingFailed`）。
 *
 * ══ MTV 侧的两处结构差异（视觉/结果一致，已在代码内注明）══
 * 1. 官方画布是 konva 舞台；MTV 用三层 canvas/2D 等价实现（底图 `<img>` + 马赛克预览层 + 标记层）。
 * 2. 官方上传 mask 后把 URL 直接塞进 `images`；MTV 把 mask 落盘成项目内文件 URL，随结果节点数据
 *    （`data.redrawMaskUrl`）交给生成服务（`generationService` 会把它作为 `image_urls` 的第 1 张/最后 1 张）。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useT } from '../../../../i18n';
import { useAppStore } from '../../../../store/useAppStore';
import { toggleReferencePick } from '../../../../store/store.nodeSelection';
import { getCanvasViewportController } from '../../../../services/canvasViewportService';
import ModelSelector from '../ModelSelector';
import { createSafeImagePreviewSource, type SafeImagePreviewSource } from './imageUtils';
import { Icon } from './floatingEditorIcons';

/* 官方 `hf` 的 redraw 取景参数（`Uhe` 不传 safeArea ⇒ 用 `hf` 默认值；fitMarginRatio 0） */
const REDRAW_SAFE_TOP = 140;
const REDRAW_SAFE_BOTTOM = 140;
const REDRAW_SAFE_HORIZONTAL = 72;
const REDRAW_MIN_ZOOM_RATIO = 0.01;

/** 官方 `jhe` 里的 redraw 提示词模板（逐字，`${S}` = 用户输入） */
export const REDRAW_PROMPT_TEMPLATE = (userPrompt: string, hasReference: boolean) => (
  'Naturally redraw only the transparent-channel area in the image.'
  + ' The last image is the main image with transparency to redraw; keep the original content and aspect ratio of that image.'
  + (hasReference ? ' Image 1 is a reference for the redrawn area.' : '')
  + ` Redraw prompt: ${userPrompt}`
);

/** 官方 `erase` 的固定提示词（本轮未接工具栏入口，先把常量按源码落下来） */
export const ERASE_PROMPT_TEMPLATE = 'Naturally redraw the transparent-channel area in the image.'
  + ' Do not generate new objects that do not exist in the scene. Blend the transparent area into the surrounding environment.';

export type RedrawTool = 'brush' | 'rect' | 'eraser';
export type RedrawGenerateMode = 'redraw' | 'erase';
/** 官方 `Fhe` 的三种「蒙版编辑器」模式；`annotate` 只是同一宿主 + 同一 fabric 画布的另一种预设 */
export type FloatingMaskMode = RedrawGenerateMode | 'annotate';

/** 官方 `Ibs`（文本工具）的默认字号 / 颜色 / 字体（逐字） */
const ANNOTATE_TEXT_SIZE = 40;
const ANNOTATE_TEXT_FILL = 'rgba(255, 0, 0, 1)';
const ANNOTATE_TEXT_FONT = 'OpenSans';
/** 官方 `ghe` 的 effect：annotate ⇒ `handleBrushColorChange("#ff0000")`、`handleBrushWidthChange(4)` */
const ANNOTATE_DEFAULT_COLOR = '#ff0000';
const ANNOTATE_DEFAULT_WIDTH = 4;
/** 官方 `aJ`（颜色选择器）在标注里用的调色板（`Gdt`，annotate 默认色 `#ff0000` = 其中的 Red）
    `[{value,appliedValue,label}]` 七个：Amber Gold / Blaze Orange / Neon Pink / Red / Blue Violet / Sky Blue / White */
const ANNOTATE_COLORS: readonly { value: string; label: string }[] = [
  { value: '#ffbe0b', label: 'Amber Gold' },
  { value: '#fb5607', label: 'Blaze Orange' },
  { value: '#ff006e', label: 'Neon Pink' },
  { value: '#ff0000', label: 'Red' },
  { value: '#8338ec', label: 'Blue Violet' },
  { value: '#3a86ff', label: 'Sky Blue' },
  { value: '#FFFFFF', label: 'White' },
];
/** 官方 `dO`/rect 钩子里判断「白色」用的**逐字**判定（白色矩形是**实心填充**、没有描边） */
const ANNOTATE_WHITE = 'rgba(255, 255, 255)';

/** 官方 `jhe.handleGenerate(prompt, reference, options)` 的 `reference` 参数（`{type:'file'|'node'}`） */
export type RedrawReference =
  | { kind: 'file'; dataUrl: string; fileName: string }
  | { kind: 'node'; nodeId: string; label: string; thumbnailUrl?: string };

export interface RedrawGeneratePayload {
  prompt: string;
  maskDataUrl: string;
  width: number;
  height: number;
  /** 官方 `options.model`（`Nhe` 模型选择器） */
  model?: string;
  /** 官方 `Nhe` 的分辨率 chip（`1K/2K/4K`；MTV 落到节点 `data.imageSize`） */
  resolution?: string;
  /** 官方 `options.count`（`Nhe` 的 `imageInputCount` / 次数） */
  times: number;
  /** 官方 `b`（参考图：本地文件 / 画布上的节点） */
  reference?: RedrawReference | null;
}

export interface ImageFloatingRedrawEditorProps {
  nodeId?: string;
  /** 官方 `node.data.src` */
  imageUrl: string;
  /** 节点流尺寸（面板尺寸 = 容器尺寸 × zoom，与 crop 编辑器同一套 `--float-scale` 口径） */
  containerWidth: number;
  containerHeight: number;
  mode?: FloatingMaskMode;
  /** 源节点当前模型（官方 `Nhe` 的默认值来自 `eb(mode)` 预设，MTV 先用源节点模型兜底） */
  defaultModel?: string;
  onCancel: () => void;
  /** 官方 `jhe.handleGenerate(prompt, reference, options)` 的等价物 */
  onGenerate: (payload: RedrawGeneratePayload) => void | Promise<void>;
  /** 官方 `mhe.handleSave(nodeId, src)`（只在 `mode==='annotate'` 用）：
      合成图（原图 + 标注层）data URL → 上层建 `Annotated Image` 节点 */
  onSaveAnnotation?: (payload: { dataUrl: string; width: number; height: number }) => void | Promise<void>;
}

/** 官方 `Nhe` 的分辨率 chip（`image.promptBar.resolution`；实测渲染成 `2K` 这种文案）
    点一下循环下一个（官方 `onClick` 就是这个语义，**没有下拉菜单**） */
const REDRAW_RESOLUTION_OPTIONS: readonly string[] = ['1K', '2K', '4K'];

/* 官方 tabler 图标（path 逐字取自 `index-BsHyQ2qj.js` 的 `F("<name>", …)` 定义表） */
/* ══════════════════════════════════════════════════════════════════════════
   官方图标 —— **path 逐字取自 9444 实测的 outerHTML**（不是从 bundle 反推；上一版反推错了）
     · `x`               → `M18 6l-12 12` / `M6 6l12 12`
     · `brush`           → 4 段（见下）
     · `rectangle`       → 框选（官方 aria-label = "Marquee Selection"）
     · `eraser`          → 2 段
     · `arrow-back-up`   → 撤销；`arrow-forward-up` → 重做
     · `paperclip`       → 底栏「添加参考图」
     · lucide `arrow-up` → 生成键（白色圆钮）
   ══════════════════════════════════════════════════════════════════════════ */
/* 图标表已抽到 `./floatingEditorIcons`（redraw / outpaint 共用）—— path 逐字不变 */
/* ══ 官方 `mosaic` 画笔的图案（`index-BsHyQ2qj.js` @7575476 `wft` = data:image/svg+xml;base64,… 逐字解码）══
   ```svg
   <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
     <rect x="0"  y="0"  width="10" height="10" fill="#cccccc"/>
     <rect x="10" y="0"  width="10" height="10" fill="#ffffff"/>
     <rect x="0"  y="10" width="10" height="10" fill="#ffffff"/>
     <rect x="10" y="10" width="10" height="10" fill="#cccccc"/>
   </svg>
   ```
   ⇒ 20×20 的 **棋盘格**（#ccc / #fff 各 10px）。
   官方 `handleToolChange('mosaic')` 里：
   ```js
   const P = new pve(t);                       // PatternBrush
   P.getPatternSrc = function(){ const L=20×20 canvas; ctx.drawImage(tile,0,0,20,20); return L };
   P.width = brushWidth; P.color = brushColor;  t.freeDrawingBrush = P;
   ```
   ★ 所以画布上落下的是**这张棋盘格图案**（不是把原图打马赛克）—— 上一版我做成「低分辨率原图」，方向就是错的。 */
const PATTERN_TILE_SIZE = 20;                  // 官方贴图 20×20（**画布/屏幕像素**）
/* 官方 `ghe` 的 effect（源码逐字）：
   ```js
   e==="annotate" ? (o("brush"), a("#ff0000"), c(4))
                  : (e==="redraw"||e==="erase") && (o("mosaic"), a("rgba(255, 255, 255)"), c(30))
   ```
   ⇒ redraw / erase 打开时：工具 = **mosaic**（棋盘格）、颜色 = **不透明白 `rgba(255,255,255)`**、笔宽 = **30**。
   ★ 「画笔」用同一份颜色 ⇒ 纯白（`handleToolChange('brush')` 走 fabric `PencilBrush` + `P.color = 颜色`）；
     9444 实测：用户用「画笔」画的笔迹在 canvas 上就是 `255,255,255,255`（不透明白）✓
   ★ 看起来「半透明」是**画布元素**的 `opacity: 0.6` 造成的（见 `.irf-mask`），不是笔色带 alpha。 */
const BRUSH_VISIBLE_COLOR = 'rgba(255, 255, 255, 1)';
const MARK_ALPHA = 1;                          // 图案本身按原 alpha 落下
const HISTORY_LIMIT = 20;

export default function ImageFloatingRedrawEditor({
  nodeId,
  imageUrl,
  containerWidth,
  containerHeight,
  mode = 'redraw',
  defaultModel,
  onCancel,
  onGenerate,
  onSaveAnnotation,
}: ImageFloatingRedrawEditorProps) {
  const t = useT();
  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const workflows = useAppStore((s) => s.workflows);
  const canvasNodes = useAppStore((s) => s.nodes);
  /* 官方 `fpe` 是用 `updateNode(nodeId, {zIndex:1001, selected:false})` 标记**正在编辑的那个节点**；
     MTV 侧：优先用调用方传进来的 `nodeId`（参考卡走「选中也不弹底部编辑区」那条门，`activeNodeId` 可能是 null）。 */
  const editedNodeId = nodeId ?? activeNodeId ?? undefined;
  const paintRef = useRef<HTMLCanvasElement | null>(null);
  const patternRef = useRef<CanvasPattern | null>(null);
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const preparedRef = useRef<SafeImagePreviewSource | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const cursorRef = useRef(-1);
  const strokeRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  /* ★ 官方打开时的「当前工具」是 `'mosaic'`（`ghe` 的 effect：`handleToolChange('mosaic')`），
     而三个按钮的取值是 `brush` / `mosaic-rect` / `eraser` ⇒ **没有一个命中** ⇒
     9444 实测三个按钮全部 `data-state="off"`、`bg: rgba(0,0,0,0)`（用户也指出：「默认是没有圆形底色的，只有 hover 才有」）。
     ⇒ 这里初始 = `null`（无高亮），真正落笔仍按 mosaic/画笔行为；点某个工具才点亮它。
     ★ annotate 不同：官方 effect 走 `handleToolChange('brush')` ⇒ **画笔那颗是亮着的**（取值命中 `brush`）。 */
  const isAnnotate = mode === 'annotate';
  const [tool, setTool] = useState<RedrawTool | null>(isAnnotate ? 'brush' : null);
  /** 内部落笔工具：`'mosaic'` = redraw/erase 的默认（开编辑器时 `selectedTool='mosaic'`，三颗按钮都不亮）
      ⇒ 默认落笔必须是**棋盘格 pattern**；annotate 默认就是 `brush`（见上）。 */
  const activeTool: RedrawTool | 'mosaic' = tool ?? (isAnnotate ? 'brush' : 'mosaic');
  /* 官方 `ghe` 的 effect：annotate ⇒ `#ff0000` / 4；redraw|erase ⇒ `rgba(255,255,255)` / 30 */
  const [brushColor, setBrushColor] = useState(isAnnotate ? ANNOTATE_DEFAULT_COLOR : BRUSH_VISIBLE_COLOR);
  const [brushWidth, setBrushWidth] = useState(isAnnotate ? ANNOTATE_DEFAULT_WIDTH : 30);
  const [colorOpen, setColorOpen] = useState(false);
  /* 官方 `Ibs.addText`：`canvas.centerObject(text)` ⇒ 文本落在画布**正中**、可拖动、可编辑 */
  const [textEditor, setTextEditor] = useState<null | { x: number; y: number; value: string }>(null);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [painted, setPainted] = useState(false);
  const [historyState, setHistoryState] = useState({ idx: -1, len: 0 });
  const [rectPreview, setRectPreview] = useState<null | { x: number; y: number; width: number; height: number }>(null);
  const [loaded, setLoaded] = useState(false);
  /* 官方底栏 `Nhe` / `khe` 的等价状态 */
  const [model, setModel] = useState<string | undefined>(defaultModel);
  const [resolution, setResolution] = useState<string>('2K');
  const [times, setTimes] = useState(1);
  const [reference, setReference] = useState<RedrawReference | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const width = Math.max(1, Math.round(containerWidth));
  const height = Math.max(1, Math.round(containerHeight));

  /* 源图：与 crop 编辑器同一套「同源 object URL」通道（canvas 不会被污染） */
  useEffect(() => {
    let active = true;
    let prepared: SafeImagePreviewSource | null = null;
    void createSafeImagePreviewSource(imageUrl, '重绘源图')
      .then((result) => {
        if (!active) { result.release(); return; }
        prepared = result;
        preparedRef.current = result;
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          if (!active) return;
          sourceRef.current = image;
          setLoaded(true);
        };
        image.src = result.src;
      })
      .catch((error: unknown) => {
        if (!active) return;
        useAppStore.getState().showToast(
          error instanceof Error ? error.message : t('重绘源图读取失败，请重试'),
          'error',
        );
        onCancel();
      });
    return () => {
      active = false;
      prepared?.release();
      preparedRef.current = null;
      sourceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  /* 画布尺寸（流像素 = 面板尺寸；缩放由画布的 CSS transform 决定，绘制坐标按 rect 换算） */
  useEffect(() => {
    const paint = paintRef.current;
    if (!paint) return;
    if (paint.width !== width || paint.height !== height) {
      paint.width = width;
      paint.height = height;
      historyRef.current = [];
      cursorRef.current = -1;
      setHistoryState({ idx: -1, len: 0 });
      setPainted(false);
    }
  }, [width, height]);

  /** 读当前缩放（`--float-scale` = 1/zoom）：官方笔宽/贴图都是画布屏幕像素，落笔时换算成流像素 */
  const readScale = useCallback(() => {
    const host = paintRef.current?.parentElement ?? null;
    const raw = host ? getComputedStyle(host).getPropertyValue('--float-scale').trim() : '';
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }, []);

  /* 官方 mosaic 图案：20×20 棋盘格 → `createPattern`（贴图按**屏幕像素**，所以要乘 `--irf-scale` 换算成流像素） */
  const buildPattern = useCallback((ctx: CanvasRenderingContext2D): CanvasPattern | null => {
    const scale = Math.max(0.05, readScale());
    const tile = document.createElement('canvas');
    const size = Math.max(2, Math.round(PATTERN_TILE_SIZE * scale));
    tile.width = size;
    tile.height = size;
    const tctx = tile.getContext('2d');
    if (!tctx) return null;
    const half = size / 2;
    tctx.fillStyle = '#cccccc';
    tctx.fillRect(0, 0, half, half);
    tctx.fillRect(half, half, half, half);
    tctx.fillStyle = '#ffffff';
    tctx.fillRect(half, 0, half, half);
    tctx.fillRect(0, half, half, half);
    return ctx.createPattern(tile, 'repeat');
  }, [readScale]);

  const pushHistory = useCallback(() => {
    const paint = paintRef.current;
    const ctx = paint?.getContext('2d');
    if (!paint || !ctx) return;
    const snapshot = ctx.getImageData(0, 0, paint.width, paint.height);
    const stack = historyRef.current.slice(0, cursorRef.current + 1);
    stack.push(snapshot);
    while (stack.length > HISTORY_LIMIT) stack.shift();
    historyRef.current = stack;
    cursorRef.current = stack.length - 1;
    setHistoryState({ idx: cursorRef.current, len: stack.length });
    setPainted(true);
  }, []);

  const applySnapshot = useCallback((snapshot: ImageData | undefined) => {
    const paint = paintRef.current;
    const ctx = paint?.getContext('2d');
    if (!paint || !ctx || !snapshot) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.putImageData(snapshot, 0, 0);
  }, []);

  const undo = useCallback(() => {
    if (cursorRef.current <= 0) {
      /* 回到「什么都没画」 */
      const paint = paintRef.current;
      const ctx = paint?.getContext('2d');
      if (paint && ctx) {
        ctx.clearRect(0, 0, paint.width, paint.height);
      }
      cursorRef.current = -1;
      setHistoryState({ idx: -1, len: historyRef.current.length });
      setPainted(false);
      return;
    }
    cursorRef.current -= 1;
    applySnapshot(historyRef.current[cursorRef.current]);
    setHistoryState({ idx: cursorRef.current, len: historyRef.current.length });
    setPainted(true);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    if (cursorRef.current >= historyRef.current.length - 1) return;
    cursorRef.current += 1;
    applySnapshot(historyRef.current[cursorRef.current]);
    setHistoryState({ idx: cursorRef.current, len: historyRef.current.length });
    setPainted(true);
  }, [applySnapshot]);

  /** 客户端坐标 → 画布流坐标 */
  const pointOf = useCallback((canvas: HTMLCanvasElement, event: { clientX: number; clientY: number }) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  /* 落笔（官方三种笔的语义，逐条对应 fabric 源码）：
       · `mosaic`（**默认**：官方打开时 `selectedTool='mosaic'`，三颗按钮都不亮）= **棋盘格 pattern 笔**
       · `brush`（点「画笔」）= 纯色笔（官方 redraw 色值 `rgba(255, 255, 255)` = 不透明纯白；9444 实测笔迹 = `255,255,255,255`）
       · `eraser` = `destination-out`（擦掉已画的图案；官方 `EraserBrush` 的 `inverted=false / eraseBackgroundOnly=false`）
     ★ 笔宽 = 官方 `brushWidth`（**画布/屏幕像素**）⇒ 流像素要乘 `--irf-scale`。 */
  const strokeTo = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const paint = paintRef.current;
    const ctx = paint?.getContext('2d');
    if (!paint || !ctx) return;
    const scale = Math.max(0.05, readScale());
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
    if (activeTool === 'eraser') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    } else if (activeTool === 'brush') {
      /* 官方 `handleToolChange('brush')`：`new PencilBrush(canvas); P.color = brushColor`
         ⇒ annotate 用调色板颜色（默认 `#ff0000`）、redraw 用不透明白 ✓ */
      ctx.strokeStyle = brushColor;
    } else {
      const pattern = patternRef.current ?? buildPattern(ctx);
      patternRef.current = pattern;
      ctx.strokeStyle = pattern ?? BRUSH_VISIBLE_COLOR;
    }
    ctx.lineWidth = Math.max(1, brushWidth * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }, [activeTool, brushColor, brushWidth, buildPattern, readScale]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (busy || event.button !== 0) return;
    const canvas = event.currentTarget;
    const point = pointOf(canvas, event);
    canvas.setPointerCapture(event.pointerId);
    if (activeTool === 'rect') {
      dragStartRef.current = point;
      return;
    }
    strokeRef.current = point;
    strokeTo(point, point);
  }, [activeTool, busy, pointOf, strokeTo]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (busy) return;
    const canvas = event.currentTarget;
    const point = pointOf(canvas, event);
    if (activeTool === 'rect') {
      const start = dragStartRef.current;
      if (start) {
        setRectPreview({
          x: Math.min(start.x, point.x),
          y: Math.min(start.y, point.y),
          width: Math.abs(point.x - start.x),
          height: Math.abs(point.y - start.y),
        });
      }
      return;
    }
    const previous = strokeRef.current;
    if (!previous) return;
    strokeRef.current = point;
    strokeTo(previous, point);
  }, [activeTool, busy, pointOf, strokeTo]);

  const endStroke = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (busy) return;
    const canvas = event.currentTarget;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (activeTool === 'rect') {
      const start = dragStartRef.current;
      const rect = rectPreview;
      dragStartRef.current = null;
      setRectPreview(null);
      if (!start || !rect || rect.width < 2 || rect.height < 2) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.globalCompositeOperation = 'source-over';
      if (isAnnotate) {
        /* 官方 `rect` 钩子（@7564405）的 mouseup 逐字：
           `new Rect({left,top,width,height, fill: isWhite?color:'transparent', stroke: isWhite?'transparent':color,
                       strokeWidth: isWhite?0:width})`（白色 ⇒ 实心填充、无描边；其余 ⇒ 纯色描边、不带虚线）
           + 判定条件 `w>5 || h>5`（官方用的是 5，不是 2） */
        const isWhite = brushColor === ANNOTATE_WHITE || brushColor === '#FFFFFF' || brushColor === '#ffffff';
        const lineWidth = Math.max(1, brushWidth * Math.max(0.05, readScale()));
        ctx.fillStyle = brushColor;
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = lineWidth;
        if (isWhite) {
          ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        } else {
          /* canvas 的 strokeRect 以线心描边 ⇒ 官方 fabric 的 left/top 是外框 ⇒ 内缩半个线宽 */
          ctx.strokeRect(
            rect.x + lineWidth / 2,
            rect.y + lineWidth / 2,
            Math.max(0, rect.width - lineWidth),
            Math.max(0, rect.height - lineWidth),
          );
        }
      } else {
        /* 官方 `mosaic-rect`：拖出虚线框后，框内填**同一张棋盘格 pattern**（不是白块） */
        const pattern = patternRef.current ?? buildPattern(ctx);
        patternRef.current = pattern;
        ctx.fillStyle = pattern ?? `rgba(255, 255, 255, ${MARK_ALPHA})`;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
      ctx.globalCompositeOperation = 'source-over';
      pushHistory();
      return;
    }
    if (!strokeRef.current) return;
    strokeRef.current = null;
    pushHistory();
  }, [activeTool, brushColor, brushWidth, buildPattern, busy, isAnnotate, pushHistory, readScale, rectPreview]);

  /* 官方 `Ibs.addText`：文本落在画布正中、可拖动、可编辑；提交后**烙进标注层**
     （官方是 fabric `Textbox`（`fontSize:40 fill:'rgba(255,0,0,1)' fontFamily:'OpenSans' textAlign:'left'`），
      MTV 没有 fabric ⇒ 用同规格的 DOM 输入框编辑、失焦时按同规格画到 canvas 上） */
  const commitText = useCallback(() => {
    setTextEditor((current) => {
      if (!current) return null;
      const value = current.value.trim();
      const paint = paintRef.current;
      const ctx = paint?.getContext('2d');
      if (value && paint && ctx) {
        const scale = Math.max(0.05, readScale());
        const fontSize = ANNOTATE_TEXT_SIZE * scale;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = ANNOTATE_TEXT_FILL;
        ctx.font = `${fontSize}px ${ANNOTATE_TEXT_FONT}, Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(value, current.x, current.y);
        pushHistory();
      }
      return null;
    });
  }, [pushHistory, readScale]);

  /* 官方 `mhe.handleSave(nodeId, src)` 逐字：
       canvas(w=originalSize.width||canvas.width||1024) → 先画原图 → 再画**画布导出**
       （`toDataURL({format:'png',quality:1,multiplier:1})`，`excludeFromExport` 的对象不参与）
       → `annotation.png` → 上传 → 新节点 `{title:'Annotated Image', editSubType: CUTOUT}` + 边 */
  const handleSaveAnnotation = useCallback(async () => {
    if (!isAnnotate || !onSaveAnnotation) return;
    const paint = paintRef.current;
    const image = sourceRef.current;
    if (!paint || !image) return;
    setSaving(true);
    try {
      const w = image.naturalWidth || paint.width || 1024;
      const h = image.naturalHeight || paint.height || 1024;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');
      if (!ctx) {
        useAppStore.getState().showToast(t('创建蒙版失败，请重试'), 'error');
        return;
      }
      ctx.drawImage(image, 0, 0, w, h);
      ctx.drawImage(paint, 0, 0, w, h);
      await onSaveAnnotation({ dataUrl: out.toDataURL('image/png'), width: w, height: h });
    } catch {
      useAppStore.getState().showToast(t('标注保存失败'), 'error');
    } finally {
      setSaving(false);
    }
  }, [isAnnotate, onSaveAnnotation, t]);

  /* 官方 `jhe`：mask = 黑底 + 原图，再把涂过的像素在原图 alpha 上打成 0 */
  const buildMask = useCallback((): { dataUrl: string; width: number; height: number } | null => {
    const paint = paintRef.current;
    const image = sourceRef.current;
    if (!paint || !image) return null;
    const nw = image.naturalWidth || width;
    const nh = image.naturalHeight || height;
    const out = document.createElement('canvas');
    out.width = nw;
    out.height = nh;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, nw, nh);
    ctx.drawImage(image, 0, 0, nw, nh);

    const scaled = document.createElement('canvas');
    scaled.width = nw;
    scaled.height = nh;
    const scaledCtx = scaled.getContext('2d');
    if (!scaledCtx) return null;
    scaledCtx.drawImage(paint, 0, 0, nw, nh);
    const paintedData = scaledCtx.getImageData(0, 0, nw, nh).data;

    const target = ctx.getImageData(0, 0, nw, nh);
    const data = target.data;
    for (let i = 0; i < data.length; i += 4) {
      /* 官方：`W[i+3] > 0 && W[i] > 200 && W[i+1] > 200 && W[i+2] > 200` ⇒ 把该像素 alpha 打成 0 */
      if (paintedData[i + 3] > 0) data[i + 3] = 0;
    }
    ctx.putImageData(target, 0, 0);
    return { dataUrl: out.toDataURL('image/png'), width: nw, height: nh };
  }, [height, width]);

  const handleGenerate = useCallback(async () => {
    if (busy) return;
    if (!painted) {
      useAppStore.getState().showToast(t('请先在图片上绘制蒙版'), 'error');
      return;
    }
    if (mode === 'redraw' && !prompt.trim()) {
      useAppStore.getState().showToast(t('请在指令框输入您的重绘需求'), 'error');
      return;
    }
    const mask = buildMask();
    if (!mask) {
      useAppStore.getState().showToast(t('创建蒙版失败，请重试'), 'error');
      return;
    }
    setBusy(true);
    try {
      await onGenerate({
        prompt: prompt.trim(),
        maskDataUrl: mask.dataUrl,
        width: mask.width,
        height: mask.height,
        model,
        resolution,
        times,
        reference,
      });
    } finally {
      setBusy(false);
    }
  }, [buildMask, busy, mode, model, onGenerate, painted, prompt, reference, resolution, t, times]);

  /** 官方 `khe` →「从设备上传」：读成 data URL，交给上层落盘 + 建参考图节点 */
  const onReferenceFile = useCallback((file: File | null | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setReference({ kind: 'file', dataUrl, fileName: file.name });
      setRefOpen(false);
    };
    reader.readAsDataURL(file);
  }, []);

  /** 官方 `J5`：画布上可当参考图的其他图片节点（只用于把 `kind:'node'` 的参考解析出缩略图）。 */
  const canvasImageOptions = useMemo(() => canvasNodes
    .filter((node) => node.id !== editedNodeId && node.type === 'ai-image')
    .map((node) => ({
      nodeId: node.id,
      label: String(node.data.label || t('图像')),
      thumbnailUrl: (node.data.thumbnailUrl as string | undefined) || (node.data.imageUrl as string | undefined),
    }))
    .filter((item) => Boolean(item.thumbnailUrl)), [canvasNodes, editedNodeId, t]);

  /**
   * 官方 `khe` 的「从画布选择」**不是自造一份列表**，而是进**通用节点选择模式**：
   * `page-BeI7xydN.js@3224048` 的 `pt` 逐字 ——
   * ```js
   * const { isActive, originNodeId, meta, exitMode } = dr.getState();
   * if (isActive && originNodeId === id && meta?.source === 'reference') { exitMode(); return; }
   * enterMode(id, { source:'reference', toolbarTitle:t('nodeSelectionMode.selectReference'),
   *                 autoExitOnConnect:true, allowedNodeTypes:[IMAGE, TEXT] });
   * ```
   * 于是在画布上：图片/文本卡亮 `flowing-border`、鼠标跟随「选择 <卡名>」、
   * **其它类型的卡被 `node-disabled-blur` 糊掉 + 黑罩（点不动）**；点中的卡会连一条边到本卡。
   */
  const enterReferencePick = useCallback(() => {
    if (!editedNodeId) return;
    /* 官方 `pt` 里没有 onConnect（官方从**新连边**取参考）；MTV 的重绘载荷是显式 `reference` 字段
       ⇒ 用官方同样存在的 `meta.onConnect(nodeId)`（见 `VW().handleNodeClick` 里那句
       `if (onEdgesChange && meta.onConnect) meta.onConnect(id)`）把选中的卡同步进来。 */
    toggleReferencePick(editedNodeId, t('从画布选择参考'), {
      /* 官方 `pt` = 图片卡那套白名单（`[IMAGE, TEXT]`）。 */
      originType: 'ai-image',
      onConnect: (pickedId: string) => {
        const picked = useAppStore.getState().nodes.find((node) => node.id === pickedId);
        if (!picked) return;
        const data = picked.data as { label?: string; thumbnailUrl?: string; imageUrl?: string };
        setReference({
          kind: 'node',
          nodeId: pickedId,
          label: String(data.label || t('图像')),
          thumbnailUrl: data.thumbnailUrl ?? data.imageUrl,
        });
      },
    });
  }, [editedNodeId, t]);

  const referenceThumb = useMemo(() => {
    if (!reference) return null;
    if (reference.kind === 'file') return reference.dataUrl;
    return reference.thumbnailUrl ?? canvasImageOptions.find((item) => item.nodeId === reference.nodeId)?.thumbnailUrl ?? null;
  }, [canvasImageOptions, reference]);

  /* 官方：点浮层外（画布空白）关闭；点到节点/交互元素不关（判定见 ImageFloatingCropEditor 同名字段） */
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
    const onPointerDownDocument = (event: PointerEvent) => {
      if (busy) return;
      const target = event.target;
      const root = document.querySelector('[data-testid="image-floating-redraw-editor"]');
      if (root && target instanceof Node && root.contains(target)) return;
      if (!shouldCloseOnTarget(target instanceof Element ? target : null)) return;
      onCancel();
    };
    document.addEventListener('pointerdown', onPointerDownDocument, true);
    return () => document.removeEventListener('pointerdown', onPointerDownDocument, true);
  }, [busy, onCancel]);

  /* 官方：`updateNode(id,{zIndex:1001, selected:false})` ⇒ MTV 用 DOM 属性补视觉（同 crop 编辑器） */
  useEffect(() => {
    const nodeEl = editedNodeId ? document.querySelector(`.react-flow__node[data-id="${editedNodeId}"]`) : null;
    if (!nodeEl) return undefined;
    nodeEl.setAttribute('data-redraw-mode', 'true');
    return () => { nodeEl.removeAttribute('data-redraw-mode'); };
  }, [editedNodeId]);

  /* ══════════════════════════════════════════════════════════════════════════
     ★ 点「重绘」之后的**取景（放大）动画** —— 官方 `hf`（NodeFloatingLayer）@1022675
     `Uhe` 对 redraw 的调用（@1342）：
       `hf({ node, onClose, safeArea: mode==='crop'||mode==='outpaint' ? {top:80,bottom:88,horizontal:72} : undefined,
             fitMarginRatio: mode==='outpaint' ? .6 : 0, layout: mode==='outpaint' ? 'safeArea' : 'overlayNode' })`
     ⇒ **redraw 用 `hf` 的默认 safeArea = `{top:140, bottom:140, horizontal:72}`**（比 crop 的 80/88 更"矮"，
       因为重绘要在节点上方留出顶栏、下方留出 −130px 的底栏），`fitMarginRatio = 0`，布局 = `overlayNode`。
     官方 `hf` 里那几行（逐字）：
       ```js
       const q = viewportW - (safeArea.horizontal||0)*2;
       const K = viewportH - (safeArea.top||0) - (safeArea.bottom||0);
       const ne = Math.min(q / nodeW, K / nodeH);                  // 能放下的比例
       const J  = layout==='belowNode'||layout==='aboveNode' ? .25 : Math.max(0, Math.min(.8, fitMarginRatio));
       const z  = Math.max(.01, ne * (1 - J));                     // fitMarginRatio=0 ⇒ z = ne
       … const Y = Math.min(B, te);                                // 本路径无 panel 预留 ⇒ Y = z
       const le = (safeArea.top||0) + K/2 + se;                    // 目标中心 Y（se=0）
       const oe = viewportW/2;                                     // 目标中心 X
       setViewport({ x: oe - nodeCenterX*Y, y: le - nodeCenterY*Y, zoom: Y }, { duration })
       // duration = min(max(200, 200 + dist*.5 + |Δzoom|*600 + (1/max(zoom,.2))*200), 1500)
       ```
     ★ 与 `viewBox` 的差异：官方这条路径**不夹取 zoom**（没有 `viewportFitOptions`）⇒ 小卡片会被放到
        「安全区内能放下的最大尺寸」（可能放大好几倍）——这是官方行为，别按 MTV 的滚轮范围去夹。
     ★ 关闭时官方**不还原**视口（只 clearHistory + close）⇒ 这里同样不还原。
     ══════════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    const controller = getCanvasViewportController();
    const targetId = editedNodeId;
    if (!controller || !targetId) return;
    const snapshot = controller.getSnapshot();
    const viewportWidth = snapshot.visibleBounds.width * snapshot.zoom;
    const viewportHeight = snapshot.visibleBounds.height * snapshot.zoom;
    if (!(viewportWidth > 0) || !(viewportHeight > 0)) return;
    const node = useAppStore.getState().nodes.find((item) => item.id === targetId);
    if (!node) return;
    const nodeFlowX = node.position?.x ?? 0;
    const nodeFlowY = node.position?.y ?? 0;
    const zoom = Math.max(
      REDRAW_MIN_ZOOM_RATIO,
      Math.min(
        (viewportWidth - REDRAW_SAFE_HORIZONTAL * 2) / containerWidth,
        (viewportHeight - REDRAW_SAFE_TOP - REDRAW_SAFE_BOTTOM) / containerHeight,
      ),
    );
    if (!Number.isFinite(zoom) || zoom <= 0) return;
    const x = viewportWidth / 2 - (nodeFlowX + containerWidth / 2) * zoom;
    const y =
      REDRAW_SAFE_TOP + (viewportHeight - REDRAW_SAFE_TOP - REDRAW_SAFE_BOTTOM) / 2
      - (nodeFlowY + containerHeight / 2) * zoom;
    const targetCenterX = REDRAW_SAFE_HORIZONTAL + (viewportWidth - REDRAW_SAFE_HORIZONTAL * 2) / 2;
    const targetCenterY = REDRAW_SAFE_TOP + (viewportHeight - REDRAW_SAFE_TOP - REDRAW_SAFE_BOTTOM) / 2;
    const currentCenterX = (nodeFlowX + containerWidth / 2) * snapshot.zoom + snapshot.x;
    const currentCenterY = (nodeFlowY + containerHeight / 2) * snapshot.zoom + snapshot.y;
    const distance = Math.hypot(currentCenterX - targetCenterX, currentCenterY - targetCenterY);
    const deltaZoom = Math.abs(zoom - snapshot.zoom);
    const duration = Math.min(
      Math.max(200, 200 + distance * 0.5 + deltaZoom * 600 + (1 / Math.max(zoom, 0.2)) * 200),
      1500,
    );
    void controller.setViewport({ x, y, zoom }, duration);
    // 只在打开时取景一次（官方 re-fit 阈值只在节点被拖动时才触发）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canUndo = historyState.idx >= 0 || painted;
  const canRedo = historyState.idx < historyState.len - 1;
  /* 官方 `Dhe` 的生成胶囊逐字：`disabled={!q||_||(n==="redraw"&&!c.trim())}`
     —— 只由 **busy / redraw 缺提示词** 决定；**是否涂过蒙版不参与 disabled**，
     没涂就点 → `handleGenerate` 弹 `floatingEditor.drawMaskFirst`「请先在图片上绘制蒙版」。 */
  const submitDisabled = busy || (mode === 'redraw' && !prompt.trim());
  const toolButtons = useMemo(() => ([
    { id: 'brush' as const, icon: 'brush' as const, label: t('画笔') },
    { id: 'rect' as const, icon: 'rectangle' as const, label: t('框选') },
    { id: 'eraser' as const, icon: 'eraser' as const, label: t('橡皮擦') },
  ]), [t]);
  /* 官方 slider 的填充比例（实测：`left:0%; right:100-value%`，radix thumb `left: calc(v% - 2.18px)`） */
  const brushPercent = ((brushWidth - 1) / 99) * 100;

  return (
    <div className="irf-root nodrag nopan" data-mode={mode} data-testid="image-floating-redraw-editor">
      <div className="irf-stage" data-testid="image-redraw-stage">
        <img className="irf-image" src={imageUrl} alt="" draggable={false} />
        {/* 官方 `xhe` 只有一个 fabric canvas（图案 + 虚线框都画在它上面），整个 canvas 带
            `style={{opacity: mode==='redraw'||mode==='erase' ? .6 : 1}}`（源码逐字 + 9444 实测 inline `opacity: 0.6`）
            ⇒ 蒙版层（图案笔迹 + 框选虚线框）整体 60% 不透明，原图（节点本体）不受影响。 */}
        <div className="irf-mask">
          <canvas
            ref={paintRef}
            className="irf-paint"
            data-testid="image-redraw-paint"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          />
          {rectPreview && (
            <div
              className="irf-rect"
              style={{
                left: rectPreview.x,
                top: rectPreview.y,
                width: rectPreview.width,
                height: rectPreview.height,
                /* 官方 `rect` 钩子的**预览**：`stroke: 颜色`、`strokeWidth: 笔宽`、`strokeDashArray:[5,5]`
                   （redraw 的 `mosaic-rect` 预览才是 `rgba(0,0,0,0.5)` 1px 虚线） */
                ...(isAnnotate
                  ? {
                    borderColor: brushColor,
                    /* 官方预览的描边宽 = `brushWidth`（屏幕像素）⇒ 这里用 CSS 变量换回屏幕像素，
                       避免在 render 里读 `readScale()`（refs 不能在 render 期访问） */
                    borderWidth: `calc(${brushWidth}px * var(--irf-scale, 1))`,
                    borderStyle: 'dashed',
                  }
                  : {}),
              }}
              aria-hidden="true"
            />
          )}
        </div>
        {!loaded && <div className="irf-loading">{isAnnotate ? t('标注源图加载中…') : t('重绘源图加载中…')}</div>}
        {/* 官方 `Ibs.addText` 的文本对象（可拖动，失焦/Enter 落笔） */}
        {textEditor && (
          <textarea
            className="irf-text-object"
            data-testid="image-redraw-text-input"
            value={textEditor.value}
            autoFocus
            style={{ left: textEditor.x, top: textEditor.y }}
            onChange={(event) => setTextEditor((current) => (current ? { ...current, value: event.target.value } : current))}
            onBlur={commitText}
            onPointerDown={(event) => {
              /* 官方文本对象可拖动：拖动 = 改 left/top（流像素） */
              const canvas = paintRef.current;
              if (!canvas) return;
              event.stopPropagation();
              const rect = canvas.getBoundingClientRect();
              const startX = event.clientX;
              const startY = event.clientY;
              const origin = { ...textEditor };
              const onMove = (move: PointerEvent) => {
                const scale = rect.width > 0 ? canvas.width / rect.width : 1;
                setTextEditor({
                  ...origin,
                  x: origin.x + (move.clientX - startX) * scale,
                  y: origin.y + (move.clientY - startY) * scale,
                });
              };
              const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
              };
              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', onUp);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                commitText();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setTextEditor(null);
              }
              event.stopPropagation();
            }}
          />
        )}
      </div>

      {/* ══ 顶栏（官方 `ghe` outerHTML 逐字，9444 实测 [1088,76,384×57]）══
          `flex items-center gap-1 p-2 rounded-full bg-sidebar backdrop-blur shadow-lg border border-border`
          ══ 由 4 段组成：✕ ｜ `w-[1px] h-6 mx-1` ｜ 工具组(`bg-input/60 p-1`) ｜ 分隔 ｜ 粗细(`px-1` 包 `h-8 w-24`) ｜ 分隔 ｜ 撤销/重做 */}
      <div className="irf-toolbar" data-testid="image-redraw-toolbar">
        <button
          type="button"
          className="irf-btn irf-close"
          onClick={onCancel}
          title={t('取消')}
          data-testid="image-redraw-cancel"
          aria-label={t('取消')}
        >
          {/* 官方实测：✕ 的 svg = **16×16**（`[&_svg]:size-4` 把 18 压到 16）；工具图标才是 18×18 */}
          <Icon name="x" size={16} />
        </button>
        <span className="irf-sep" aria-hidden="true" />
        <div className="irf-toolgroup" role="group" dir="ltr">
          {toolButtons.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={tool === item.id}
              data-state={tool === item.id ? 'on' : 'off'}
              className="irf-tool"
              aria-label={item.label}
              data-testid={`image-redraw-tool-${item.id}`}
              onClick={() => setTool(item.id)}
            >
              <Icon name={item.icon} />
            </button>
          ))}
        </div>
        {/* 官方 `ghe`：annotate 才有「文本」钮（`onClick:()=>{o("none"),x()}`）
            图标 = 9444 实测 `tabler-icon-typography` 18×18（5 段 path 见 `floatingEditorIcons`） */}
        {isAnnotate && (
          <button
            type="button"
            className="irf-btn"
            title={t('文本')}
            aria-label={t('文本')}
            data-testid="image-redraw-text"
            onClick={() => {
              setTool(null);
              if (textEditor) { commitText(); return; }
              setTextEditor({ x: Math.round(width / 2), y: Math.round(height / 2), value: t('我的文本') });
            }}
          >
            <Icon name="typography" />
          </button>
        )}
        <span className="irf-sep" aria-hidden="true" />
        <div className="irf-size-outer">
          {/* 官方 `ghe`：`div.flex.items-center.gap-2.px-1` 里 annotate 先放**颜色选择器** `aJ`
              （触发器 `size-5 aspect-square rounded-full border cursor-pointer` + `backgroundColor`） */}
          {isAnnotate && (
            <div className="irf-color-wrap">
              <button
                type="button"
                className="irf-color-trigger"
                style={{ backgroundColor: brushColor }}
                aria-haspopup="menu"
                aria-expanded={colorOpen}
                aria-label={t('颜色')}
                data-testid="image-redraw-color"
                onClick={() => setColorOpen((open) => !open)}
              />
              {colorOpen && (
                <div className="irf-color-menu" role="menu">
                  {ANNOTATE_COLORS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      role="menuitem"
                      className={`irf-color-swatch${item.value === brushColor ? ' is-on' : ''}`}
                      style={{ backgroundColor: item.value }}
                      title={item.label}
                      aria-label={item.label}
                      data-testid={`image-redraw-color-${item.label.replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={() => { setBrushColor(item.value); setColorOpen(false); }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="irf-size">
            <span className="irf-size-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M4 12 C8 6, 14 20, 20 12"
                  strokeWidth={Math.max(1.5, brushWidth * 0.12)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {/* 官方 radix Slider 结构：track `bg-white/18 h-1.5 rounded-full` + range `bg-white` + 16×16 白圆 thumb */}
            <span className="irf-slider">
              <span className="irf-slider-track">
                <span className="irf-slider-range" style={{ right: `${100 - brushPercent}%` }} />
              </span>
              <span className="irf-slider-thumb" style={{ left: `calc(${brushPercent}% - 2.18px)` }} />
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={brushWidth}
                aria-label={t('画笔粗细')}
                onChange={(event) => setBrushWidth(Number(event.target.value))}
              />
            </span>
          </div>
        </div>
        <span className="irf-sep" aria-hidden="true" />
        <div className="irf-undo-group">
          <button
            type="button"
            className="irf-btn"
            onClick={undo}
            disabled={!canUndo}
            aria-label={t('撤销')}
            data-testid="image-redraw-undo"
          >
            <Icon name="arrowBackUp" size={16} />
          </button>
          <button
            type="button"
            className="irf-btn"
            onClick={redo}
            disabled={!canRedo}
            aria-label={t('重做')}
            data-testid="image-redraw-redo"
          >
            <Icon name="arrowForwardUp" size={16} />
          </button>
        </div>
        {/* 官方 `ghe`：annotate 末尾再一段分隔 + **保存**钮
            `Ns size="sm" variant="white" className="h-8 rounded-full px-4 gap-2"`（图标 16 + 「保存」/「保存中...」） */}
        {isAnnotate && onSaveAnnotation && (
          <>
            <span className="irf-sep" aria-hidden="true" />
            <button
              type="button"
              className="irf-save"
              onClick={() => void handleSaveAnnotation()}
              disabled={saving}
              data-testid="image-redraw-save"
            >
              <Icon name="save" size={16} />
              <span>{saving ? t('保存中...') : t('保存')}</span>
            </button>
          </>
        )}
      </div>

      {/* 官方 `Fhe.j()`：`redraw|erase|outpaint` 才有底栏（annotate ⇒ null，保存走顶栏那颗） */}
      {/* ══ 底栏（官方 `Dhe` outerHTML 逐字，9444 实测 [1030,1239,500×121]）══
          `absolute left-1/2 -translate-x-1/2 z-50 w-[500px] -bottom-[130px]`
          inner `flex-1 flex flex-col gap-2 p-2 rounded-2xl bg-background/90 backdrop-blur shadow-xl border border-border`
          row  `flex justify-between items-center flex-wrap gap-2 text-nowrap`
           左  `flex items-center gap-2 flex-1`：hidden file input ｜ 回形针圆钮(32×32) ｜ `text-xs text-muted-foreground` 提示
           右  `flex items-center gap-2`：[分辨率 chip][次数 chip][模型 chip] ｜ 生成胶囊（min-w-8 数字 + 白圆 ↑ 26×26） */}
      {!isAnnotate && (
      <div className="irf-bar" data-testid="image-redraw-bar">
        <div className="irf-bar-inner">
          {/* 官方 `Dhe` 逐字：`{mode==="redraw" && r.jsx(Ru,{placeholder:…})}` —— **只有 redraw 有描述框**，
              erase 的底栏就只有下面那一行（所以容器才是 `-bottom-[64px]`）。 */}
          {mode === 'redraw' && (
            <textarea
              className="irf-textarea"
              placeholder={t('描述你想改变什么...')}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                if ((event.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
                event.preventDefault();
                void handleGenerate();
              }}
              data-testid="image-redraw-prompt"
            />
          )}
          <div className="irf-row">
            <div className="irf-row-left">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  onReferenceFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              {/* 官方 `Dhe` 逐字：参考图按钮 `khe` 也**只在 redraw** 出现；
                  `khe`：**有参考图** = 40×40 缩略图卡 + 右上角 ✕（点掉即移除）；
                        **没有** = 32×32 圆钮（回形针 16px）+ Popover 两条来源。 */}
              {mode === 'redraw' && (reference && referenceThumb ? (
                <div className="irf-ref-card" data-testid="image-redraw-reference-card">
                  <img className="irf-ref-card-img" src={referenceThumb} alt="reference" draggable={false} />
                  <button
                    type="button"
                    className="irf-ref-remove"
                    aria-label={t('移除参考图')}
                    title={t('移除参考图')}
                    data-testid="image-redraw-reference-remove"
                    onClick={() => { setReference(null); setRefOpen(false); }}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="irf-btn irf-ref-btn"
                  title={t('添加参考图')}
                  aria-haspopup="menu"
                  aria-expanded={refOpen}
                  data-testid="image-redraw-reference"
                  onClick={() => { setRefOpen((open) => !open); }}
                >
                  <Icon name="paperclip" size={16} />
                </button>
              ))}
              {mode === 'redraw' && !reference && refOpen && (
                <div className="irf-pop" role="menu">
                  <button type="button" role="menuitem" className="irf-pop-item" onClick={() => fileInputRef.current?.click()}>
                    {t('从设备上传')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="irf-pop-item"
                    onClick={() => {
                      /* 官方 `khe` 的第二项 = 进「节点选择模式」（不是弹自家列表）。
                         官方原文（`Dhe` 的参考图按钮分支）：
                           `<DropdownMenuItem onClick={() => inputRef.current?.click()}><uj/>{t('image.promptBar.uploadDevice')}</DropdownMenuItem>`
                           `<DropdownMenuItem onClick={onSelectCanvas}><Xu/>{t('image.promptBar.selectCanvas')}</DropdownMenuItem>`
                         其中 `onSelectCanvas` 就是图片卡的 `pt`（`enterMode(source:'reference', allowedNodeTypes:[IMAGE,TEXT])`）。 */
                      setRefOpen(false);
                     
                      enterReferencePick();
                    }}
                  >
                    {t('从画布选择')}
                  </button>
                </div>
              )}
              <div className="irf-hint">
                {reference
                  ? (reference.kind === 'file' ? reference.fileName : reference.label)
                  : (mode === 'erase' ? t('绘制蒙版以擦除') : t('绘制蒙版以重绘'))}
              </div>
            </div>

            <div className="irf-row-right">
              <div className="irf-selectors">
                {/* 官方 `Nhe` 的分辨率 chip 逐字（**点一下循环下一个，没有下拉菜单**）：
                    `Ns variant="outline" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        tooltip={t("image.promptBar.resolution")}
                        onClick={()=>{const h=i.indexOf(s),m=h<0?0:(h+1)%i.length;o(i[m])}}` */}
                <button
                  type="button"
                  className="irf-chip"
                  title={t('分辨率')}
                  data-testid="image-redraw-resolution"
                  onClick={() => {
                    const options = REDRAW_RESOLUTION_OPTIONS;
                    const index = options.indexOf(resolution);
                    setResolution(options[index < 0 ? 0 : (index + 1) % options.length]);
                  }}
                >
                  {resolution}
                </button>
                {/* 官方 `Nhe` 的生成次数 chip 逐字（同样是**点一下 +1**，`x4` 之后回到 `x1`）：
                    `onClick={()=>{const h=u==="4"?"1":String(parseInt(u,10)+1);f(h)}}` */}
                <button
                  type="button"
                  className="irf-chip"
                  title={t('生成次数')}
                  data-testid="image-redraw-times"
                  onClick={() => setTimes(times === 4 ? 1 : times + 1)}
                >
                  {`x${times}`}
                </button>
                {/* 官方 `Nhe`：模型选择器（MTV 复用节点用的那份官方皮下拉）—— 官方顺序是 分辨率 → 次数 → 模型 */}
                <ModelSelector
                  nodeType="ai-image"
                  selectedModel={model}
                  onSelect={(option) => setModel(option.value)}
                  workflows={workflows}
                />
              </div>
              {/* 官方生成胶囊：`flex items-center gap-1 rounded-full p-1 border border-white/10`
                  + `backdrop-filter: blur(10px)` + 官方那条径向渐变；内层 = 数字（官方是「预估价格」，
                  MTV 没有价格源 ⇒ 这里放**生成次数**并同时用 tooltip 说明）+ 白色圆 ↑ 26×26 */}
              <div className="irf-generate">
                <div
                  className="irf-generate-count"
                  title={`${t('生成次数')} ${times}`}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path
                      d="M11.2077 11.0832C13.7219 11.0832 15.7601 9.04507 15.7601 6.53088C15.7601 4.01668 13.7219 1.97852 11.2077 1.97852C8.6935 1.97852 6.65533 4.01668 6.65533 6.53088C6.65533 9.04507 8.6935 11.0832 11.2077 11.0832Z"
                      stroke="rgb(204, 204, 204)"
                      strokeWidth="2"
                    />
                    <path
                      d="M2.05883 7.07063C2.40649 5.06634 4.30083 3.70985 6.31403 4.03225C8.31238 4.35169 9.68225 6.2074 9.41481 8.20129C9.41481 8.34911 9.51357 8.81255 9.57973 9.03629C9.77436 9.69448 10.1844 10.6335 11.015 11.721C12.2615 13.3554 11.948 15.691 10.3152 16.9375C8.68085 18.1841 6.34524 17.8721 5.09869 16.2378C2.41541 12.7239 1.71413 9.22201 2.0514 7.11817L2.05883 7.07063Z"
                      stroke="rgb(204, 204, 204)"
                      strokeWidth="2"
                    />
                    <path
                      d="M8.52786 8.98262L7.26662 12.7829C6.82516 14.1131 7.54561 15.5493 8.87578 15.9907L12.6761 17.252C14.0062 17.6934 15.4424 16.973 15.8839 15.6428L17.1451 11.8425C17.5866 10.5124 16.8662 9.07616 15.536 8.6347L11.7357 7.37346C10.4055 6.932 8.96932 7.65244 8.52786 8.98262Z"
                      stroke="rgb(204, 204, 204)"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="irf-generate-number">{times}</span>
                </div>
                <button
                  type="button"
                  className="irf-generate-btn"
                  onClick={() => void handleGenerate()}
                  disabled={submitDisabled}
                  title={mode === 'erase' ? t('擦除') : t('生成')}
                  aria-label="Generate"
                  data-testid="image-redraw-generate"
                >
                  <Icon name="arrowUp" size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
