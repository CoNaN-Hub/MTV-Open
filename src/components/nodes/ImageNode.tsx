/**
 * ImageNode 图像节点 — 在画布上渲染图像内容，支持上传/粘贴图片、遮罩编辑、工具栏、全屏预览
 */
import { memo, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import type {
  AnnotationLayerProps,
} from '@tenney95/xiaoluo-image-editor';
import '@tenney95/xiaoluo-image-editor/style.css';
import type { BaseNodeData } from '../../types';
import NodeLabel from './shared/NodeLabel';
import { OfficialIcon } from '../sidebar/OfficialIcon';
import GooeyBtn from './shared/GooeyBtn';
import ImageNodeToolbar from './shared/image/ImageNodeToolbar';
import NodeToolbarShell from './shared/NodeToolbarShell';
import { PILE_NODE_TYPE, pileMemberIds } from '../../utils/officialPile';
import { authenticityStatusOf } from '../../utils/officialAuthenticityCheck';
import PinCardBorder from './shared/PinCardBorder';
import { readPins } from '../../services/canvasPin';
import { useLocatedPinNodeId } from '../../store/store.pin';
import { useIsDirectSingleSelection } from '../../hooks/useIsDirectSingleSelection';
import MediaViewer from './shared/media/MediaViewer';
import MediaViewerActions from './shared/media/MediaViewerActions';
import { collectNodeMediaVersions, versionFactsOf } from '../../utils/mediaViewerVersions';
import { saveNodeOutputToFile } from '../../services/fileService';
import NodeError from './shared/NodeError';
import ModelDownloadDialog from '../shared/ModelDownloadDialog';
import { computeImageNodeDimensions } from './shared/image/imageUtils';
import ImageFloatingCropEditor from './shared/image/ImageFloatingCropEditor';
import ImageFloatingRedrawEditor, { REDRAW_PROMPT_TEMPLATE, type RedrawGeneratePayload } from './shared/image/ImageFloatingRedrawEditor';
import ImageFloatingOutpaintEditor, { OUTPAINT_PROMPT_TEMPLATE, type OutpaintGeneratePayload } from './shared/image/ImageFloatingOutpaintEditor';
import ImageFloatingMultiAnglePanel from './shared/image/ImageFloatingMultiAnglePanel';
import { buildMultiAngleRequest, multiAnglePrompt, loe, type MultiAngleParams } from '../../services/ai/multiAngle';
import ImageFloatingRelightPanel from './shared/image/ImageFloatingRelightPanel';
import { buildRelightRequest, relight, type RelightParams } from '../../services/ai/relight';
import CanvasPreviewImage from './shared/image/CanvasPreviewImage';
import { useNodeRename } from './shared/useNodeRename';
import { useSourceFileUpload } from './shared/useSourceFileUpload';
import { useAppStore, generateId } from '../../store/useAppStore';
import { saveDataUrlToProjectData, buildNodeFileName } from '../../services/fileService';
import { copyImage as copyImageToClipboard } from '../../services/clipboardService';
import { executeGeneration } from '../../services/generationService';
import { getCanvasViewportController } from '../../services/canvasViewportService';
import { getMediaModelOptions } from './shared/defaultModels';
import { aspectRatioValue, nearestAspectRatioForImage, nodeSizeForAspectRatio } from '../../utils/nodeBounds';
import { useCompletionFlash } from '../../hooks/useCompletionFlash';
import { useCanvasNodeLodPreviewRevision, useCanvasNodeLodProtection } from '../../hooks/useCanvasNodeLod';
import { createPresetNode } from './shared/toolbar/presetAction';
import type { CameraStudioMode, CameraStudioResult } from './shared/image/cameraStudio';
import {
  useReferencedImageRevisions,
  withPreviewRevision,
} from '../../hooks/useReferencedImageWatcher';
import {
  cancelCanvasDerivation,
  completeCanvasDerivation,
  isCanvasDerivationFresh,
  registerCanvasDerivation,
  type CanvasDerivationGuard,
} from '../../services/canvasDerivationGuard';
import { useImageNodeOnnxActions } from './shared/image/useImageNodeOnnxActions';
import { useT } from '../../i18n';
import { getImageLoadRetryDelay, isRetryableImageSource } from '../../utils/imageLoadRetry';
import NodeGenerationProgress from './shared/NodeGenerationProgress';
import NodeLoadingAnimation from './shared/NodeLoadingAnimation';
import NodeImageHistoryGallery, { ImageHistoryCountPill } from './shared/image/NodeImageHistoryGallery';
import MagicSelectionOverlay from './shared/image/MagicSelectionOverlay';
import {
  officialGalleryDisplaySrc,
  officialGalleryIsHistoryMode,
  officialGalleryItems,
  officialHistoryPreviewSrc,
  officialLegacyGalleryCount,
  officialSelectVariantPatch,
} from '../../utils/officialNodeHistory';
import { favoriteTargetOf, officialSourceFileIdFromUrl } from '../../utils/officialFavorites';

const MattingEditor = lazy(() => import('./shared/image/MattingEditor'));
const CustomGridEditor = lazy(() => import('./shared/image/CustomGridEditor'));
const ImageComposerEditor = lazy(() => import('./shared/image/composer/ImageComposerEditor'));
const CameraStudioPanel = lazy(() => import('./shared/image/CameraStudioPanel'));

const loadImageEditorRuntime = () => import('@tenney95/xiaoluo-image-editor');

type DeferredAnnotationLayerProps = Omit<AnnotationLayerProps, 'layer'> & {
  layer: unknown;
  legacyUrl?: string;
  onLegacyError?: () => void;
};

const AnnotationLayer = lazy(async () => {
  const runtime = await loadImageEditorRuntime();
  const RuntimeAnnotationLayer = runtime.AnnotationLayer;
  return {
    default: function DeferredAnnotationLayer({
      layer,
      legacyUrl,
      onLegacyError,
      ...props
    }: DeferredAnnotationLayerProps) {
      if (runtime.isImageAnnotationLayer(layer)) {
        return <RuntimeAnnotationLayer {...props} layer={layer} />;
      }
      return legacyUrl ? (
        <img
          src={legacyUrl}
          alt="Annotation"
          className="image-preview-mask"
          onError={onLegacyError}
        />
      ) : null;
    },
  };
});


/* ════════════════════════════════════════════
   AIImageNode
   ════════════════════════════════════════════ */
/** 官方 `FH`（@3104345）默认值：`panelOffset = 120`（Ynt）、`duration = 500`（Xnt）；relight 传 `zoom = .9` */
const RELIGHT_CENTER_PANEL_OFFSET = 120;
const RELIGHT_CENTER_ZOOM = 0.9;
const RELIGHT_CENTER_DURATION = 500;
function AIImageNode({ id, data, selected, dragging }: { id: string; data: BaseNodeData; selected?: boolean; dragging?: boolean }) {
  const t = useT();
  const justCompleted = useCompletionFlash(data.status);
  const updateNodeData = useAppStore((s) => s.updateNodeData);
  const updateNodeDataTransient = useAppStore((s) => s.updateNodeDataTransient);
  /** 官方：卡片左上角「收藏」星标**只在单选时**渲染（多选/框选时官方不渲染，t1055 截图确认） */
  const singleSelected = useAppStore((s) => s.selectedNodeIds.length === 1);
  const previewProjectId = useAppStore((s) => s.currentProjectId);
  /** ★ 官方门 `nd(id)`：`selectionSource==="direct" && 单选 && ids.has(id)`（框选不算） */
  const isDirectSingleSelection = useIsDirectSingleSelection(id);
  /* ★ 堆叠成员在画布上仍以 `pile-member-anchor` 形式存在，成员被选中时会照常挂自己的图片工具栏，
     与堆叠卡 hover 出的 `PileNodeToolbar` **同时可见 ⇒ 用户实测「两个工具栏」**（以及两套 scale
     变换叠加造成的抖动）。官方语义：进入堆叠后由堆叠工具栏统一操作成员 ⇒ 成员自身工具栏不再显示。 */
  const inPile = useAppStore((s) =>
    s.nodes.some((n) => n.type === PILE_NODE_TYPE && pileMemberIds(n).includes(id)),
  );
  // 焦点编辑模式（官方实测：进入后面板顶部出蓝色横幅，卡片盖 rgba(0,0,0,.7) 遮罩 + 「ESC 退出模式」）
  const focusEdit = useAppStore((s) => s.focusEditNodeId === id);
  const focusEditNodeId = useAppStore((s) => s.focusEditNodeId);
  const focusEditMarks = useAppStore((s) => s.focusEditMarks);
  /* 「从画布选择参考」现在是官方通用节点选择模式（store `dr`），三态/遮罩由
     `NodeSelectionPickToolbar` + `NodeSelectionPickLayer` 渲染 ⇒ 节点侧不再持有该状态。 */
  /* 多角度兜底：源节点没有 model 时，自动取「可用的相关图像模型」（可见/已配置的 image 模型列表第一个） */
  const modelConfig = useAppStore((s) => s.config);
  const modelWorkflows = useAppStore((s) => s.workflows);
  const usableImageModels = useMemo(
    () => getMediaModelOptions(modelConfig.generalModels ?? [], modelConfig, modelWorkflows)
      .filter((model) => model.mediaKind === 'image'),
    [modelConfig, modelWorkflows],
  );

  const isSource = data.role === 'source';
  /* ★★★ **卡片尺寸改为由「比例」推导 —— 与官方 `pR` 一致** ✓
     官方源码（EXE `index-BiTZf8mJ.js`）：
       Od = { width: 250, height: 250 }
       pR = (ratio) => { h = Od.height, w = Od.width;
                         ratio > 1 → w = h * ratio;   // 横图 **高固定 250**
                         ratio < 1 → h = w / ratio;   // 竖图 **宽固定 250**
                         return { width: Math.round(w), height: Math.round(h) } }
     线上实测：编辑区显示「4:3·1K」时节点流坐标 = **333×250** ✓ = pR(4/3) ✓✓
     由此：1:1→250×250 · 4:3→333×250 · 3:2→375×250 · 16:9→444×250
           3:4→250×333 · 2:3→250×375 · 9:16→250×444
     ⚠️ 此前写死 333×250 ✗（那只是 4:3 的特例）→ 换比例时卡片不变 ✗

     ⚠️ MTV 旧数据里存过 `nodeWidth: 280 / nodeHeight: 210`（旧默认 ✗）
        以及**上传图后撑高的 `nodeHeight`（如 420）** ✗ —— 这些**都不该再赢** ✓
     → 没有图片像素尺寸时以**比例参数**为准 ✓（`Mvs(undefined)` → ratio 1 → 250×250 ✓ 与官方一致 ✓）

     ★★★★★ **有图 → 卡片贴合图片真实像素比例** ✓✓（用户实测口径 ✓ + 官方源码逐字 ✓）
     官方定节点尺寸的工具（`zoom-slider-3ZcFvYQO.js` @3111321 ✓ 逐字）：
       · `function N0({batch, imageUrl, fallback, intrinsicDimensions}) {`
       ·   `const o = intrinsicDimensions ?? Xb(batch?.resources.find(c => c.url === imageUrl));`
       ·   `const i = o ? o.width / o.height : tg(batch?.params?.aspectRatio);`   ← **图片真实比例优先** ✓
       ·   `const a = Ua(i);`                                                    ← 再套 `Ua`（= `pR`）
       ·   `return { width: a.width, height: a.height, intrinsicDimensions: o, hasReliableDimensions: !!o }; }`
       · `Xb(资源)` 取 `metadata.width/height` ✓ —— MTV 侧的等价字段就是 `imageWidth/imageHeight` ✓
       · 图片加载回调（`jJ` ✓）走同一条：`Ua(naturalWidth / naturalHeight)` → `updateNode(width, height)` ✓
         ⚠️ 那句 `if (b && cU(e, b)) { return }` 的语义是「**这张图已经量过**（`__metadata.url` 命中）就跳过重测」✓
            —— **不是**「上传时不改尺寸」✗✓（我上一轮把它读反了 ✗ → 错撤了一次 ✗ 用户实测纠正 ✓）
     ⇒ 落到 MTV（MTV 的盒子由 `aspectRatio` 驱动 ✗ 官方是 `width/height` ✗，所以这里要分流）：
         · **源图**（`role === 'source'`；上传/导入路径都会写 ✓）→ 用 `imageWidth/imageHeight` 的真实比例 ✓
         · **生成节点** → 仍用 `aspectRatio` ✓（这样「换比例时卡片与位置按官方 280ms 动画变化」那条
           对生成节点完全不受影响 ✓）
     ⚠️ 为什么不干脆把真实比例写进 `aspectRatio` ✗：`QualityRatioSelector` 有合法值夹取
        （`ratioValid` → `onChangeAspectRatio(effectiveRatios[0].value)` ✓）→ 写进去必被夹回 ✗
        而且它是**生成参数**（会发给 API ✗）—— 盒子与生成参数本不该共用一个字段 ✗✓
        上传时仍把 `aspectRatio` 写成「模型合法比例里最接近的」✓（官方 UI 也只能选表内值 ✓）*/
  const intrinsicRatio = isSource && data.imageWidth && data.imageHeight
    ? (data.imageWidth as number) / (data.imageHeight as number)
    : null;
  const sizeFromAspect = nodeSizeForAspectRatio(intrinsicRatio ?? aspectRatioValue(data.aspectRatio as string));
  const nodeWidth = sizeFromAspect.width;
  const nodeHeight = sizeFromAspect.height;

  /* ★★★★★ **比例/模型变化时，卡片的尺寸与位置按官方源码变化** ✓✓
     官方 EXE 原文（`Avs` + `$Ol` ✓）：
       x = x + (**旧宽 − 新宽**) / 2   → **水平居中保持** ✓
       y = y + (**旧高 − 新高**)        → **底边保持**（**不除 2** ✗✓）
       过渡 **280ms** ✓ · ease `1-(1-u)³`（ease-out-cubic ✓）
     ⚠️ 我此前写 `y − Δh/2` ✗ → 变成"上下对称长" ✗ 官方是**只往上长（底边不动）** ✓
        → 用户："选择不同比例时 卡片变化的逻辑不对" ✓✓
     ⚠️ 只在「尺寸真的变了」时执行 ✓ 首次挂载不动 ✓ 不干扰用户拖动坐标 ✓ */
  const prevSizeRef = useRef<{ w: number; h: number } | null>(null);
  const sizeAnimRafRef = useRef(0);
  const [animSize, setAnimSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const prev = prevSizeRef.current;
    prevSizeRef.current = { w: nodeWidth, h: nodeHeight };
    if (!prev) return;
    if (prev.w === nodeWidth && prev.h === nodeHeight) { setAnimSize(null); return; }
    const live = useAppStore.getState();
    const self = live.nodes.find((n) => n.id === id);
    if (!self) return;
    /* ★★★★★ **官方源码逐字照抄**（EXE `Avs` + `$Ol` ✓）
         Avs:  x = x + (**旧宽 − 新宽**) / 2   → **水平居中保持** ✓
               y = y + (**旧高 − 新高**)        → **底边保持** ✗✓（**不除 2** ✗）
         $Ol:  整个过渡 **280ms** ✓ · ease **1-(1-u)³**（ease-out-cubic ✓）
               逐帧插值 宽/高 ✓ 且 **x 由「固定中心 X」算 ✓ · y 由「固定底边 Y」算** ✓
       ⚠️ 我此前写成 `x - Δw/2, y - **Δh/2**` ✗✓
          → 竖直方向变成了"从中间向上下长" ✗ 而官方是**只往上长（底边不动）** ✓
          → 用户："选择不同比例时 卡片变化的逻辑不对" ✓✓ */
    const bottomY = self.position.y + prev.h;      /* 旧底边 Y —— 全程不变 ✓ */
    const centerX = self.position.x + prev.w / 2;  /* 旧中心 X —— 全程不变 ✓ */
    const DURATION = 280;                          /* 官方默认值 ✓ */
    const ease = (u: number) => 1 - (1 - u) ** 3;  /* 官方 ease-out-cubic ✓ */
    const t0 = performance.now();
    cancelAnimationFrame(sizeAnimRafRef.current);
    const step = (now: number) => {
      const f = Math.min((now - t0) / DURATION, 1);
      if (f >= 1) {
        setAnimSize(null);
        live.updateNodePositionTransient(id, {
          x: centerX - nodeWidth / 2,
          y: bottomY - nodeHeight,
        });
        return;
      }
      const e = ease(f);
      const w = Math.round(prev.w + (nodeWidth - prev.w) * e);
      const h = Math.round(prev.h + (nodeHeight - prev.h) * e);
      setAnimSize({ w, h });
      live.updateNodePositionTransient(id, { x: centerX - w / 2, y: bottomY - h });
      sizeAnimRafRef.current = requestAnimationFrame(step);
    };
    sizeAnimRafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(sizeAnimRafRef.current);
  }, [id, nodeWidth, nodeHeight]);

  // ── Upload ──
  const { isUploading, handleUpload: doUpload } = useSourceFileUpload('.png,.jpg,.jpeg,.gif,.webp,.svg');
  /* ComfyUI 真实进度（官方没有进度条 → 只有真拿到进度时才额外压一条，见下方 bare 用法 ✓） */
  const comfyGenerating = useAppStore((s) => {
    const p = s.comfyNodeProgress[id];
    return Boolean(p && p.projectId === s.currentProjectId);
  });

  const handleUpload = useCallback(async () => {
    const result = await doUpload();
    if (!result) return;
    const img = new Image();
    img.onload = () => {
      /* ★★★★★ **上传后：比例取「模型合法比例里最接近的」** ✓（用户裁定：跟官方一致 ✓）
         官方（`jJ` ✓）：上传后节点 `src` 已等于这张图 → `if (b && cU(e, b)) return` **不改卡片尺寸** ✓
           ⇒ 卡片始终 = `pR(aspectRatio)` ✓（自己那张图的比例**不参与**卡片 ✗）
         所以这里**只**把 `aspectRatio` 设成合法表里最接近的值 ✓（官方 UI 也只能选表内值 ✓）：
           · 写**原图真实比例**（如 `5907:6497`）✗ → 被 `QualityRatioSelector` 夹回 `effectiveRatios[0]` ✗
             （`ratioValid` → `onChangeAspectRatio(effectiveRatios[0].value)` ✓）= 上一版的失败原因 ✓
           · 写 `undefined` ✗ → 卡片按 1 处理 = 250×250，`contain` 留白多 ✗
         `imageWidth/imageHeight` 仍照写 ✓（真像素，给别的功能用 ✓ 不参与卡片 ✓）*/
      const rawW = img.naturalWidth;
      const rawH = img.naturalHeight;
      const sized = nodeSizeForAspectRatio(rawW / rawH);
      updateNodeData(id, {
        imageUrl: result.dataUrl,
        filePath: result.filePath,
        /* ★★★★ **上传不改标题** ✗✓（用户实测官方行为 ✓ 权威 ✓）
           官方：上传图后标题仍显示 **"Image"** ✓（按节点类型的兜底 ✓）
                只有**用户主动双击重命名**时才变成自定义名字 ✓
           MTV 原来写 `label: result.fileName` ✗ → 显示「南京.jpg」✗ = 与官方不一致 ✓✓
           （我此前引用的 EXE `title: e.name` 是**素材库导入**的路径 ✗ 不是节点上传 ✓ —— 用错了证据 ✗）
           `fileName` 仍照常存 ✓（其它功能用得到 ✓）只是**不写进 label** ✓ */
        fileName: result.fileName,
        status: 'success',
        /* ★ 上传后它就是**源图**节点 ✓（官方 `UploadImageNode` 同理 ✓）
           对图片节点这条**不改变点击行为** ✓ —— `Canvas` 的 `isSilentOnFirstClick` 已经因为
           「有 imageUrl」而不自动弹窗 ✓（实读源码逐条核对过 ✓）*/
        role: 'source',
        /* ★ 官方 `hide_inputbar`：上传后这张卡就是**参考卡**（卡片上出现「替换」按钮）
           ⇒ 官方门 `pe = 选中数 <= 1 && !R` 会让它的底部编辑区**整条不渲染**
           （9444 实测：带「替换」的上传卡 `canvas-node-generation-input-bar` = **ABSENT**，
             生成卡 = **VISIBLE**）。字段说明见 `types/index.ts`；
           新建节点那份打在 `store.nodes.ts::prepareNodeForInsertion`（粘贴/右键上传/拖入都走它）。 */
        hide_inputbar: true,
        /* ★ 比例 = 合法表里最接近的 ✓（卡片 = `pR(它)` ✓ 官方口径 ✓）*/
        ...nearestAspectRatioForImage(rawW, rawH),
        /* 盒子数据自洽（渲染由上面的比例决定 ✓）*/
        nodeWidth: sized.width,
        nodeHeight: sized.height,
        imageWidth: rawW,
        imageHeight: rawH,
        annotation: undefined,
        annotationLayer: undefined,
      } as Partial<BaseNodeData>);
    };
    img.src = result.dataUrl;
    /* ⚠️ 图加载失败时也要给出可用状态 ✗✓（原来**什么都不写** ✗ → 节点停在 idle、尺寸不变 ✗）
       官方此路径没有等价分支（它由 `<img>` 的 onLoad/onError 驱动 ✓）→ 这里只做兜底：
       仍把图片与文件名落进去 ✓，比例沿用原值（用户可再用比例选择器调 ✓）*/
    img.onerror = () => {
      updateNodeData(id, {
        imageUrl: result.dataUrl,
        filePath: result.filePath,
        fileName: result.fileName,
        status: 'success',
        role: 'source',
        hide_inputbar: true,
      } as Partial<BaseNodeData>);
    };
  }, [doUpload, id, updateNodeData]);

  const [isCameraStudio, setIsCameraStudio] = useState(false);
  /* 打光面板开关 + 全局「任务进行中」标记（提前声明：relight/多角度/重绘共用，避免声明顺序问题） */
  const [isRelight, setIsRelight] = useState(false);
  const pendingRedrawRef = useRef(false);
  /** 摄影棚打开时的模式（'camera' | 'lighting' | 'dual'）—— 官方 relight 按钮 = lighting */
  const [cameraStudioMode] = useState<CameraStudioMode>('camera');
  // 加载状态按来源记账：来源一变旧状态自然失效，无需 effect 逐个重置
  const [imgState, setImgState] = useState<{
    src?: string;
    loaded?: boolean;
    failed?: boolean;
    retryAttempt?: number;
    retrying?: boolean;
  }>({});
  const imageRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageRetryRef = useRef<{ src?: string; scheduledAttempts: number }>({ scheduledAttempts: 0 });
  /* ★ 官方手动「重新加载」计数（`d`/`u` @1819344 邻域，`b=()=>{i(!1),u(w=>w+1)}`）。
     同样**按来源记账**：`src` 一变旧计数自然失效 ⇒ 不需要额外 effect 重置。*/
  const [manualReload, setManualReload] = useState<{ src?: string; attempt: number }>({ attempt: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** 官方媒体查看器正在展示的媒体（打开时 = 卡片当前图） */
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const outputHistoryRecords = useAppStore((state) => state.outputHistoryRecords);
  const [mattingFailedSrc, setMattingFailedSrc] = useState<string | undefined>();
  const [annotateFailedSrc, setAnnotateFailedSrc] = useState<string | undefined>();

  // 文件被外部工具覆盖时只刷新本地预览，不修改节点数据或撤销历史。
  const lodPreviewRevision = useCanvasNodeLodPreviewRevision();
  const revisionFor = useReferencedImageRevisions([lodPreviewRevision === undefined ? data.filePath : undefined]);
  const previewRevision = lodPreviewRevision ?? revisionFor(data.filePath);
  /* ★ 官方「折叠态预览图」覆盖（`nK`/`Mwe`，`course-api-base-url-CGXqZmAy.js`@589300 逐字）：
     `function nK(e){const t=typeof e.src=="string"?e.src:"";return typeof e.historyPreviewSrc=="string"&&e.historyPreviewSrc?e.historyPreviewSrc:t}`
     官方 `Mwe` 在 `historyVariantsHidden !== true` 时把节点渲染图换成 `{...e, src: nK(e)}`。
     MTV 的 `data.imageUrl` 仍是真主图 ⇒ 这里只在**显示层**做同样的覆盖。 */
  const historyPreviewSrc = officialHistoryPreviewSrc(data);
  const rawDisplaySrc = (historyPreviewSrc ?? (data.imageUrl || data.thumbnailUrl)) as string | undefined;
  const displaySrc = withPreviewRevision(rawDisplaySrc, previewRevision);
  const locatedPinNodeId = useLocatedPinNodeId();   // Pin「定位节点」的高亮（官方 `highlightedNodes`）
  const annotationLayer = data.annotationLayer;

  // imageUrl 或外部文件版本变化后，下面这些标记自动回到初始态
  const imgLoaded = imgState.src === displaySrc && !!imgState.loaded;
  const imgLoadError = imgState.src === displaySrc && !!imgState.failed;
  const imgRetrying = imgState.src === displaySrc && !!imgState.retrying;
  const imgRetryAttempt = imgState.src === displaySrc ? (imgState.retryAttempt ?? 0) : 0;
  /* 手动重试计数同样按来源记账 ⇒ `displaySrc` 一变即视为归零（无需额外 effect）。 */
  const imgManualReloadAttempt = manualReload.src === displaySrc ? manualReload.attempt : 0;
  const mattingError = !!data.mattingMask && mattingFailedSrc === data.mattingMask;
  const annotateError = !!data.annotation && annotateFailedSrc === data.annotation;

  useEffect(() => {
    imageRetryRef.current = { src: displaySrc, scheduledAttempts: 0 };
    return () => {
      if (imageRetryTimerRef.current) clearTimeout(imageRetryTimerRef.current);
      imageRetryTimerRef.current = null;
    };
  }, [displaySrc]);

  const handlePreviewImageLoad = useCallback(() => {
    if (!displaySrc) return;
    if (imageRetryTimerRef.current) clearTimeout(imageRetryTimerRef.current);
    imageRetryTimerRef.current = null;
    imageRetryRef.current = { src: displaySrc, scheduledAttempts: 0 };
    setImgState({ src: displaySrc, loaded: true });
  }, [displaySrc]);

  const handlePreviewImageError = useCallback(() => {
    if (!displaySrc) return;

    if (imageRetryTimerRef.current) clearTimeout(imageRetryTimerRef.current);
    imageRetryTimerRef.current = null;

    if (imageRetryRef.current.src !== displaySrc) {
      imageRetryRef.current = { src: displaySrc, scheduledAttempts: 0 };
    }
    const scheduledAttempts = imageRetryRef.current.scheduledAttempts;
    const retryDelay = isRetryableImageSource(displaySrc)
      ? getImageLoadRetryDelay(scheduledAttempts)
      : null;
    if (retryDelay === null) {
      setImgState({ src: displaySrc, failed: true, retryAttempt: scheduledAttempts });
      return;
    }

    const nextAttempt = scheduledAttempts + 1;
    imageRetryRef.current.scheduledAttempts = nextAttempt;
    setImgState({ src: displaySrc, retryAttempt: scheduledAttempts, retrying: true });
    imageRetryTimerRef.current = setTimeout(() => {
      imageRetryTimerRef.current = null;
      if (imageRetryRef.current.src !== displaySrc) return;
      setImgState({ src: displaySrc, retryAttempt: nextAttempt, retrying: true });
    }, retryDelay);
  }, [displaySrc]);

  const handlePreviewImageReload = useCallback(() => {
    if (imageRetryTimerRef.current) clearTimeout(imageRetryTimerRef.current);
    imageRetryTimerRef.current = null;
    imageRetryRef.current = { src: displaySrc, scheduledAttempts: 0 };
    /* ★ 官方手动重试（逐字 · `source-snippets.md:276-278`）：`i(!1)` 清错误态 + `u(w=>w+1)` 计数 +1，
       并由 `const w=x.includes("?")?"&":"?"; return `${x}${w}retry=${d}`` 给 URL 追加 `retry=N` 破缓存。
       ⚠️ 旧实现只 `setImgState({})` —— 取图 URL 没变，React `key` 换元素也绕不过 WebView 图片缓存，
          「重新加载」会命中同一份坏缓存、恒失败。 */
    const nextManualAttempt = imgManualReloadAttempt + 1;
    setManualReload({ src: displaySrc, attempt: nextManualAttempt });
    setImgState({ src: displaySrc });
  }, [displaySrc, imgManualReloadAttempt]);

  /** 取图地址：手动重试时追加官方同款 `retry=N`（有 `?` 用 `&`）。
      一旦自动重试把 `imgState` 复位（`src` 账目改变），本值即回到原 URL —— 不粘住。 */
  const previewFetchSrc = (() => {
    if (!displaySrc || imgManualReloadAttempt <= 0) return displaySrc;
    const separator = displaySrc.includes('?') ? '&' : '?';
    return `${displaySrc}${separator}retry=${imgManualReloadAttempt}`;
  })();

  /* 用「有无源码遮罩」表达目标卡：焦点编辑开着、且本卡不是源卡（`!focusEdit`）时才可点。
     官方门：`isMagicSelectionActive && src && !(sourceNodeId === nodeId)`。 */
  const isFocusEditTarget = !!focusEditNodeId && !focusEdit && !!displaySrc;
  /* 焦点编辑覆盖层（官方 `MagicSelectionOverlay`）：目标卡渲染命中层 + mark 标记。
     官方把它作为卡片 body 的兄弟挂在 `absolute inset-0` 里（与图、复制按钮同级）。 */
  const focusEditOverlay = isFocusEditTarget || focusEditMarks.some((mark) => mark.targetNodeId === id)
    ? <MagicSelectionOverlay nodeId={id} isTarget={isFocusEditTarget} src={displaySrc} />
    : null;

  /* ★ 焦点编辑：**点一下**取归一化点坐标（0–1），交给 store 的识别流程。
     官方点/框坐标都是 0–1 归一化（覆盖层用 `*100` 变百分比）；
     `identifyFocusEditElement` 内部会把它换算成识别服务要的 0–1000 尺度。
     ⚠️ 官方这条只在**目标卡**上生效（源卡被 `.focus-edit-mask` 盖住、且外壳给了 showSourceOverlay）
        —— 所以这里用 `!focusEdit` 把源卡排除，避免源卡自己也能被点。
     ⚠️ 旧实现是「拖拽拉 ROI 矩形、坐标被丢弃」（纯视觉、不参与任何逻辑），已按官方撤掉。 */
  const handleFocusEditClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
    void useAppStore.getState().identifyFocusEditElement(id, displaySrc, point);
  }, [id, displaySrc]);

  /* 多角度已改为官方面板（`handleOpenMultiAngle`）⇒ 原摄影棚「camera」模式入口不再使用。 */
  /**
   * ★ 官方 `ptt` 的 relight 工具（`re` 回调，@3110110）：
   *   `updateNodeData(nodeId,{mode:'relight'})` + `FH({node, getNodes, setCenter, zoom:.9})`
   * 官方 `FH`（@3104345，逐字）：
   *   `const Ynt=120, DH=300, Xnt=500;`
   *   `function FH({node,getNodes,setCenter,zoom,panelOffset=Ynt,duration=Xnt}){ const {x,y}=_r(node,map);
   *      const w=node.measured?.width??node.width??DH, h=node.measured?.height??node.height??DH;
   *      setCenter(x+w/2, y+h/2+panelOffset, {zoom, duration}); }`
   *   ⇒ 打开打光面板时画布用 500ms 动画把「节点中心 + 下移 120px」居中并缩到 0.9，给下方面板让位。
   */
  const handleOpenRelight = useCallback(() => {
    setIsRelight(true);
    const controller = getCanvasViewportController();
    if (!controller) return;
    const snapshot = controller.getSnapshot();
    const viewportWidth = snapshot.visibleBounds.width * snapshot.zoom;
    const viewportHeight = snapshot.visibleBounds.height * snapshot.zoom;
    if (!(viewportWidth > 0) || !(viewportHeight > 0)) return;
    const node = useAppStore.getState().nodes.find((item) => item.id === id);
    const flowX = node?.position?.x ?? 0;
    const flowY = node?.position?.y ?? 0;
    const centerX = flowX + nodeWidth / 2;
    const centerY = flowY + nodeHeight / 2 + RELIGHT_CENTER_PANEL_OFFSET;
    void controller.setViewport({
      x: viewportWidth / 2 - centerX * RELIGHT_CENTER_ZOOM,
      y: viewportHeight / 2 - centerY * RELIGHT_CENTER_ZOOM,
      zoom: RELIGHT_CENTER_ZOOM,
    }, RELIGHT_CENTER_DURATION);
  }, [id, nodeHeight, nodeWidth]);
  const handleCloseRelight = useCallback(() => setIsRelight(false), []);

  /**
   * 官方 `RelightFeature` 的提交（@252-257）：
   *   `relight({ fileId, angle:{preset}, brightnessPercent, temperatureK, rimEnabled, rimPreset }).send()`
   *   ⇒ `{code, data:{fileUrl}}`，成功后 **原地替换源节点的图**（`updateNodeData(nodeId,{src:fileUrl,taskInfo:undefined})`）
   *   ⇒ **不新建卡片**（与其它工具不同）。失败时保留卡片 + 提示（用户口径）。
   */
  const handleRelightGenerate = useCallback(
    async (params: RelightParams) => {
      const src = (data.imageUrl || data.thumbnailUrl) as string | undefined;
      if (!src) {
        useAppStore.getState().showToast(t('没有可用的图片'), 'error');
        return;
      }
      const request = buildRelightRequest(params, { fileId: id });
      pendingRedrawRef.current = true;
      setIsRelight(false);
      try {
        const response = await relight(request).send(async (genParams) => {
          await executeGeneration(id, genParams.prompt);
          const created = useAppStore.getState().nodes.find((node) => node.id === id);
          const url = created?.data.imageUrl as string | undefined;
          return url ? [url] : [];
        });
        if (response.code === 0 && response.data?.fileUrl) {
          useAppStore.getState().updateNodeDataTransient(id, {
            imageUrl: response.data.fileUrl,
            status: 'success',
          } as Partial<BaseNodeData>);
        } else {
          useAppStore.getState().showToast(t('生成处理失败：请在卡片底部选择可用的图像模型后重试'), 'error');
        }
      } catch (error: unknown) {
        useAppStore.getState().showToast(
          error instanceof Error && error.message
            ? error.message
            : t('生成处理失败：请在卡片底部选择可用的图像模型后重试'),
          'error',
        );
      } finally {
        pendingRedrawRef.current = false;
      }
    },
    [data.imageUrl, data.thumbnailUrl, id, t],
  );
  const handleCloseCameraStudio = useCallback(() => setIsCameraStudio(false), []);

  const handleCameraStudioGenerate = useCallback((result: CameraStudioResult) => {
    const store = useAppStore.getState();
    const sourceNode = store.nodes.find((node) => node.id === id) as Node<BaseNodeData> | undefined;
    if (!sourceNode) {
      store.showToast(t('图片节点不存在'), 'error');
      return;
    }

    const modeLabel = result.mode === 'camera'
      ? t('摄影机视角')
      : result.mode === 'lighting'
        ? t('摄影棚打光')
        : t('视角与打光');
    const { node, edge } = createPresetNode(sourceNode, {
      label: modeLabel,
      icon: 'mdi:camera-control',
      filledPrompt: result.prompt,
      shouldTrigger: true,
    });

    store.addNodeWithEdge(node, edge);
    setIsCameraStudio(false);
    void executeGeneration(node.id, node.data.prompt, undefined, node.data);
  }, [id, t]);

  /* ════════════════════════════════════════════
     Crop State
     ════════════════════════════════════════════ */
  const [isCrop, setIsCrop] = useState(false);
  const pendingCropDerivation = useRef<CanvasDerivationGuard | null>(null);

  /** 官方裁剪产物节点标题（源码里就是硬编码英文 `"Cropped Image"`，非 i18n 键） */
  const CROPPED_IMAGE_TITLE = 'Cropped Image';

  const handleOpenCrop = useCallback(() => {
    if (pendingCropDerivation.current) {
      useAppStore.getState().showToast(t('已有裁切任务正在处理，请稍候'));
      return;
    }
    setIsCrop(true);
  }, [t]);
  const handleCloseCrop = useCallback(() => {
    setIsCrop(false);
  }, []);

  /** 确认裁切时立即调用：创建 loading 状态的新节点并关闭弹窗 */
  const handleCropStart = useCallback(() => {
    const store = useAppStore.getState();
    const currentNodes = store.nodes;
    const currentPos = currentNodes.find((n) => n.id === id)?.position || { x: 0, y: 0 };

    const newNodeId = `node-${generateId()}`;
    const projectId = store.currentProjectId;
    const derivation = registerCanvasDerivation(store, id, {
      placeholderNodeId: newNodeId,
      onCancel: () => {
        const liveStore = useAppStore.getState();
        if (liveStore.currentProjectId !== projectId) return;
        /* ⚠️ 占位节点被撤掉时，**连着它的那条边也要一起撤**（官方是「成功后才 addNodes + addEdges」，
           MTV 是占位节点架构 ⇒ 取消/失败路径必须把边一起清掉，否则留下指向不存在节点的悬空边）。 */
        liveStore.setNodes(liveStore.nodes.filter((node) => node.id !== newNodeId));
        liveStore.setEdges(liveStore.edges.filter((edge) => edge.target !== newNodeId && edge.source !== newNodeId));
      },
    });
    if (!derivation) {
      store.showToast(t('图片节点已失效，请重试'), 'error');
      return;
    }
    pendingCropDerivation.current = derivation;

    const newNode: Node<BaseNodeData> = {
      id: newNodeId,
      type: 'ai-image',
      /* ★ 位置：官方 `fc(q, R, { x: mn(q) + 100, y: 0 })` —— 源节点**右边缘 + 100**（`mn` = 右边缘）
         ＋ 官方 `fc` 的避让求解（MTV 没有那份求解器，保持源节点同一行 ⇒ y 用源节点 y）。 */
      position: { x: currentPos.x + nodeWidth + 100, y: currentPos.y },
      data: {
        /* ★ 标题：官方逐字 `Fm({ src: D, title:"Cropped Image", editSubType: Nv.CUTOUT }, …)`
           —— 官方这个节点标题就是硬编码英文 **"Cropped Image"**（不是 i18n 键，中文界面下同样是英文）。 */
        label: CROPPED_IMAGE_TITLE,
        type: 'ai-image',
        role: 'source',
        status: 'loading',
        /* ★ 官方 `editSubType: Nv.CUTOUT`（枚举值 = `'cutout'`，见 types/index.ts 的 `editSubType` 注释） */
        editSubType: 'cutout',
        nodeWidth,
        nodeHeight: 158,
      } as BaseNodeData,
    };
    store.addNode(newNode);
    /* ★ 官方确认裁剪后**把产物接在源节点后面**：
         `a([W]); O ? (c([qi(d(), { source: e.id, target: W.id })]), …)`
       （O = 源节点仍在；不在了就只提示「原图已被删除，裁剪结果已单独添加到画布」）。
       MTV 用同一套 handle 口径（源 → 右柄，产物 → 左柄），与 shotlist 等既有连边一致。 */
    if (currentNodes.some((node) => node.id === id)) {
      const liveStore = useAppStore.getState();
      liveStore.setEdges([
        ...liveStore.edges,
        { id: `edge-${generateId()}`, source: id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left' },
      ]);
    }
    setIsCrop(false);
  }, [id, nodeWidth, t]);

  /** 后台裁切完成后调用：更新节点数据 */
  const handleCropSave = useCallback(
    async (croppedDataUrl: string, metadata?: { width: number; height: number }) => {
      const derivation = pendingCropDerivation.current;
      const nodeId = derivation?.placeholderNodeId;
      const clearPending = () => {
        if (pendingCropDerivation.current === derivation) pendingCropDerivation.current = null;
      };

      if (!derivation || !croppedDataUrl || !nodeId) {
        if (derivation) cancelCanvasDerivation(derivation);
        clearPending();
        const store = useAppStore.getState();
        if (!derivation || store.currentProjectId === derivation.projectId) {
          store.showToast(t('裁切失败，请重试'), 'error');
        }
        return;
      }
      const ensureFresh = () => {
        const fresh = isCanvasDerivationFresh(derivation, useAppStore.getState());
        if (!fresh) {
          cancelCanvasDerivation(derivation);
          clearPending();
        }
        return fresh;
      };
      if (!ensureFresh()) return;

      try {
        let assetUrl = croppedDataUrl;
        let filePath: string | undefined;
        if (derivation.projectId !== 'default') {
          /* 与卡片标题同一口径（官方 `cropped-<时间戳>.png`；MTV 走项目内命名规则） */
          const savedName = buildNodeFileName(CROPPED_IMAGE_TITLE, 'png', 'cropped');
          const saved = await saveDataUrlToProjectData(croppedDataUrl, derivation.projectId, savedName);
          if (saved?.assetUrl) {
            assetUrl = saved.assetUrl;
            filePath = saved.filePath;
          }
        }
        if (!ensureFresh()) return;

        const dims = await computeImageNodeDimensions(assetUrl);
        if (!ensureFresh()) return;

        const liveStore = useAppStore.getState();
        liveStore.updateNodeDataTransient(nodeId, {
          imageUrl: assetUrl,
          filePath,
          status: 'success',
          imageWidth: metadata?.width ?? dims.imageWidth,
          imageHeight: metadata?.height ?? dims.imageHeight,
          nodeWidth: dims.nodeWidth,
          nodeHeight: dims.nodeHeight,
        } as Partial<BaseNodeData>);
        liveStore.commitToHistory();
        completeCanvasDerivation(derivation);
        clearPending();
        liveStore.showToast(t('裁切完成，已创建新节点'));
      } catch {
        const shouldNotify = isCanvasDerivationFresh(derivation, useAppStore.getState());
        cancelCanvasDerivation(derivation);
        clearPending();
        if (shouldNotify) useAppStore.getState().showToast(t('裁切失败，请重试'), 'error');
      }
    },
    [t],
  );

  /* ════════════════════════════════════════════
     CustomGrid State — 自定义宫格裁切
     ════════════════════════════════════════════ */
  const [isCustomGrid, setIsCustomGrid] = useState(false);

  const handleOpenCustomGrid = useCallback(() => setIsCustomGrid(true), []);
  const handleCloseCustomGrid = useCallback(() => setIsCustomGrid(false), []);

  /** 确认自定义宫格：按实际线位置生成 StoryboardNode */
  const handleCustomGridConfirm = useCallback(
    async (hPercentages: number[], vPercentages: number[]) => {
      setIsCustomGrid(false);
      const store = useAppStore.getState();
      const imageUrl = (data.imageUrl || data.thumbnailUrl) as string | undefined;
      if (!imageUrl) {
        store.showToast(t('无可裁切的图像'), 'error');
        return;
      }

      const rows = hPercentages.length + 1;
      const cols = vPercentages.length + 1;

      store.commitToHistory();
      const srcPos = store.nodes.find((n) => n.id === id)?.position || { x: 0, y: 0 };
      const dims = await computeImageNodeDimensions(imageUrl);

      store.addNodeTransient({
        id: `node-${generateId()}`,
        type: 'ai-storyboard',
        position: { x: srcPos.x + nodeWidth + 60, y: srcPos.y },
        data: {
          label: t('{name} 自定义宫格{rows}×{cols}', { name: (data.label as string) || t('图像'), rows, cols }),
          type: 'ai-storyboard',
          role: 'source',
          status: 'success',
          imageUrl,
          filePath: data.filePath as string | undefined,
          storyboardRows: rows,
          storyboardCols: cols,
          storyboardRowPositions: hPercentages,
          storyboardColPositions: vPercentages,
          nodeWidth: dims.nodeWidth,
          nodeHeight: dims.nodeHeight,
        } as BaseNodeData,
      });
      store.commitToHistory();
      store.showToast(t('已按线生成 {rows}×{cols} 自定义宫格节点', { rows, cols }));
    },
    [id, data.imageUrl, data.thumbnailUrl, data.label, data.filePath, nodeWidth, t],
  );

  /* ════════════════════════════════════════════
     宫格裁切（官方 `quickSplit`）：源图生成一个「宫格分镜」节点（单节点内按 rows×cols 拼接展示）
     ★ 官方 `de(le)` 同时接受**方形档数字**（chips 传 2/3/4）与 `{rows, cols}`（8×8 面板）⇒ 这里同义。
     ════════════════════════════════════════════ */
  const handleMultiGrid = useCallback(
    async (grid: number | { rows: number; cols: number }) => {
      const { rows, cols } = typeof grid === 'number' ? { rows: grid, cols: grid } : grid;
      const store = useAppStore.getState();
      const imageUrl = (data.imageUrl || data.thumbnailUrl) as string | undefined;
      if (!imageUrl) {
        store.showToast(t('无可裁切的图像'), 'error');
        return;
      }
      // 官方 `n1 = 8`：面板与 chips 都只到 8（防御性上限）
      if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 8 || cols > 8) return;

      store.commitToHistory();
      const srcPos = store.nodes.find((n) => n.id === id)?.position || { x: 0, y: 0 };
      // 分镜节点按源图纵横比展示 → 复用图像节点的尺寸计算
      const dims = await computeImageNodeDimensions(imageUrl);
      const sizeLabel = `${rows}×${cols}`;

      store.addNodeTransient({
        id: `node-${generateId()}`,
        type: 'ai-storyboard',
        position: { x: srcPos.x + nodeWidth + 60, y: srcPos.y },
        data: {
          label: t('{name} 宫格{size}', { name: (data.label as string) || t('图像'), size: sizeLabel }),
          type: 'ai-storyboard',
          role: 'source',
          status: 'success',
          imageUrl,
          filePath: data.filePath as string | undefined,
          storyboardRows: rows,
          storyboardCols: cols,
          nodeWidth: dims.nodeWidth,
          nodeHeight: dims.nodeHeight,
        } as BaseNodeData,
      });
      store.commitToHistory();
      store.showToast(t('已生成 {size} 宫格分镜节点', { size: sizeLabel }));
    },
    [id, data.imageUrl, data.thumbnailUrl, data.label, data.filePath, nodeWidth, t],
  );

  /* ════════════════════════════════════════════
     Compose (多图自由编辑) State
     ════════════════════════════════════════════ */
  const [isCompose, setIsCompose] = useState(false);
  const pendingComposeDerivation = useRef<CanvasDerivationGuard | null>(null);

  const handleOpenCompose = useCallback(() => {
    if (pendingComposeDerivation.current) {
      useAppStore.getState().showToast(t('已有合成任务正在处理，请稍候'));
      return;
    }
    setIsCompose(true);
  }, [t]);
  const handleCloseCompose = useCallback(() => {    setIsCompose(false);
  }, []);

  /** 确认合成：立即创建 loading 新节点并关闭弹窗 */
  const handleComposeStart = useCallback(() => {
    const store = useAppStore.getState();
    const currentPos = store.nodes.find((n) => n.id === id)?.position || { x: 0, y: 0 };

    const newNodeId = `node-${generateId()}`;
    const projectId = store.currentProjectId;
    const derivation = registerCanvasDerivation(store, id, {
      placeholderNodeId: newNodeId,
      onCancel: () => {
        const liveStore = useAppStore.getState();
        if (liveStore.currentProjectId !== projectId) return;
        liveStore.setNodes(liveStore.nodes.filter((node) => node.id !== newNodeId));
      },
    });
    if (!derivation) {
      store.showToast(t('图片节点已失效，请重试'), 'error');
      return;
    }
    pendingComposeDerivation.current = derivation;

    const newNode: Node<BaseNodeData> = {
      id: newNodeId,
      type: 'ai-image',
      position: { x: currentPos.x + nodeWidth + 40, y: currentPos.y },
      data: {
        label: t('{name} 合成', { name: (data.label as string) || t('图像') }),
        type: 'ai-image',
        role: 'source',
        status: 'loading',
        nodeWidth,
        nodeHeight: 158,
      } as BaseNodeData,
    };
    store.addNode(newNode);
    setIsCompose(false);
  }, [id, data.label, nodeWidth, t]);

  /** 合成完成后回填节点数据 */
  const handleComposeSave = useCallback(
    async (composedDataUrl: string, metadata?: { width: number; height: number }) => {
      const derivation = pendingComposeDerivation.current;
      const nodeId = derivation?.placeholderNodeId;
      const clearPending = () => {
        if (pendingComposeDerivation.current === derivation) pendingComposeDerivation.current = null;
      };

      if (!derivation || !composedDataUrl || !nodeId) {
        if (derivation) cancelCanvasDerivation(derivation);
        clearPending();
        const store = useAppStore.getState();
        if (!derivation || store.currentProjectId === derivation.projectId) {
          store.showToast(t('合成失败，请重试'), 'error');
        }
        return;
      }
      const ensureFresh = () => {
        const fresh = isCanvasDerivationFresh(derivation, useAppStore.getState());
        if (!fresh) {
          cancelCanvasDerivation(derivation);
          clearPending();
        }
        return fresh;
      };
      if (!ensureFresh()) return;

      try {
        let assetUrl = composedDataUrl;
        let filePath: string | undefined;
        if (derivation.projectId !== 'default') {
          const savedName = buildNodeFileName(t('{name} 合成', { name: (data.label as string) || t('图像') }), 'png', 'composed');
          const saved = await saveDataUrlToProjectData(composedDataUrl, derivation.projectId, savedName);
          if (saved?.assetUrl) {
            assetUrl = saved.assetUrl;
            filePath = saved.filePath;
          }
        }
        if (!ensureFresh()) return;

        const dims = await computeImageNodeDimensions(assetUrl);
        if (!ensureFresh()) return;

        const liveStore = useAppStore.getState();
        liveStore.updateNodeDataTransient(nodeId, {
          imageUrl: assetUrl,
          filePath,
          status: 'success',
          imageWidth: metadata?.width ?? dims.imageWidth,
          imageHeight: metadata?.height ?? dims.imageHeight,
          nodeWidth: dims.nodeWidth,
          nodeHeight: dims.nodeHeight,
        } as Partial<BaseNodeData>);
        liveStore.commitToHistory();
        completeCanvasDerivation(derivation);
        clearPending();
        liveStore.showToast(t('合成完成，已创建新节点'));
      } catch {
        const shouldNotify = isCanvasDerivationFresh(derivation, useAppStore.getState());
        cancelCanvasDerivation(derivation);
        clearPending();
        if (shouldNotify) useAppStore.getState().showToast(t('合成失败，请重试'), 'error');
      }
    },
    [data.label, t],
  );



  /* ════════════════════════════════════════════
     Matting State
     ════════════════════════════════════════════ */
  const [isMatting, setIsMatting] = useState(false);

  const handleOpenMatting = useCallback(() => setIsMatting(true), []);
  const handleCloseMatting = useCallback(() => setIsMatting(false), []);

  const handleMattingSave = useCallback(
    (maskUrl: string) => {
      updateNodeData(id, { mattingMask: maskUrl } as Partial<BaseNodeData>);
      setIsMatting(false);
    },
    [id, updateNodeData],
  );

  /* ════════════════════════════════════════════
     Annotate State
     ════════════════════════════════════════════ */
  /* ════════════════════════════════════════════
     Media viewer（官方媒体查看器：图片分支）
     ════════════════════════════════════════════
     ★ 官方**只有工具栏那一颗「全屏」按钮**能进查看器：
       `course-api-base-url-CGXqZmAy.js` 的图片工具栏条目
       ```js
       { node: l.jsx(Gg,{size:20}), dataTestId: yn.CANVAS.NODE.IMAGE.FULLSCREEN_BTN,
         handle: () => { …; c(e) },      // c = nT() → Pc.getState().open(会话)
         tooltip: n("common.fullScreen"), key:"scale" }
       ```
     ⚠️ MTV 偏离（已删）：卡片内层的 `onDoubleClick → handleOpenFullscreen` 是 MTV 自己加的。
       官方 `EditImageNode`（`Dee` @3126542）的卡片内部只有
       `div.absolute.inset-0.w-full.h-full.overflow-visible` → `<qx>` + `<hb>`，**没有 `onDoubleClick`**；
       全 chunk 的 `onDoubleClick` 只有文本框(@3421742 进编辑) / 表格节点(@2740512 开弹窗) /
       `EditorImageNode`(@3128895 开**编辑器**) / 分享页 VideoEditNode(@1469876) 这几处，
       而且应用的 `<ReactFlow>` 根本没传 `onNodeDoubleClick` ⇒ **双击图片卡在官方什么都不做**。 */
  const handleOpenFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setViewerSrc(displaySrc ?? null);
  }, [displaySrc]);
  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setViewerSrc(null);
  }, []);

  /* 历史版本 = 同节点的生成历史（MTV 生成历史；官方对应服务端 node history + 本地 queue） */
  const nodeMediaVersions = useMemo(
    () => collectNodeMediaVersions(id, outputHistoryRecords),
    [id, outputHistoryRecords],
  );
  const viewerVersionFacts = useMemo(
    () => versionFactsOf(nodeMediaVersions, viewerSrc ?? undefined),
    [nodeMediaVersions, viewerSrc],
  );
  const viewerPrompt = useMemo(() => {
    if (!viewerSrc) return '';
    return nodeMediaVersions.find((version) => version.src === viewerSrc)?.prompt
      || (data.prompt as string | undefined)
      || '';
  }, [data.prompt, nodeMediaVersions, viewerSrc]);
  const viewerVersion = useMemo(
    () => nodeMediaVersions.find((version) => version.src === viewerSrc),
    [nodeMediaVersions, viewerSrc],
  );
  /* 官方 `w = setAsMain && mainSrc && mo(mainSrc, media.src)`：当前展示的就是「主图」时按钮显示「当前主图」并禁用 */
  const viewerShowsCurrentMain = !!viewerSrc && viewerSrc === displaySrc;
  const [viewerDownloading, setViewerDownloading] = useState(false);

  /* 官方 `Qge` 的三个动作（复制提示词 / 设为主图 / 下载） */
  const handleViewerCopyPrompt = useCallback(() => {
    if (!viewerPrompt.trim()) return;
    void navigator.clipboard?.writeText(viewerPrompt).then(() => {
      useAppStore.getState().showToast(t('提示词已复制'));
    }).catch(() => {});
  }, [t, viewerPrompt]);

  const handleViewerSetAsMain = useCallback(() => {
    if (!viewerSrc || viewerShowsCurrentMain) return;
    updateNodeData(id, { imageUrl: viewerSrc, thumbnailUrl: viewerSrc } as Partial<BaseNodeData>);
    useAppStore.getState().showToast(t('主图已更新'));
  }, [id, updateNodeData, viewerShowsCurrentMain, viewerSrc, t]);

  const handleViewerDownload = useCallback(async () => {
    if (!viewerSrc || viewerDownloading) return;
    setViewerDownloading(true);
    try {
      const result = await saveNodeOutputToFile({
        filePath: viewerVersion?.filePath || (data.filePath as string | undefined),
        mediaUrl: viewerSrc,
        textOutput: undefined,
        nodeType: 'ai-image',
        fileName: (data.fileName as string | undefined) || (data.label as string | undefined),
      });
      /* 官方：保存/下载由「文件传输中心」自动上报，不再弹「文件已保存」toast */
      void result;
    } catch {
      useAppStore.getState().showToast(t('文件保存失败'));
    } finally {
      setViewerDownloading(false);
    }
  }, [data.fileName, data.filePath, data.label, t, viewerDownloading, viewerSrc, viewerVersion]);

  /* ════════════════════════════════════════════
     折叠变体画廊（官方 `UT`/`$O`，见 utils/officialNodeHistory.ts 顶部的逐字出处）
     ════════════════════════════════════════════ */
  /** 官方 `$x(nodeId)` = `isGalleryOpen(nodeId)`（画廊 store，`course-…`@3091790） */
  const galleryOpen = useAppStore((s) => s.galleryNodeId === id);
  const closeGallery = useAppStore((s) => s.closeGallery);
  const toggleGallery = useAppStore((s) => s.toggleGallery);
  const favoriteStatuses = useAppStore((s) => s.favoriteStatuses);
  const favoriteSourceFileIds = useAppStore((s) => s.config.favoriteSourceFileIds);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);

  /** 官方 `galleryItems: ce = X ? X.options : n`（**只取 options，不含 src**） */
  const galleryItems = useMemo(() => officialGalleryItems(data), [data]);
  /** 官方 `legacyGalleryTotalCount: Oe = Cst(t,n)`（**含 src**，= 计数药丸上的数字） */
  const legacyGalleryCount = useMemo(() => officialLegacyGalleryCount(data), [data]);
  /** 官方 `W = E ?? j ?? t`（当前展示的那张） */
  const galleryCurrentItem = useMemo(() => officialGalleryDisplaySrc(data), [data]);
  /** 官方 `ae`：历史模式（点一张卡直接换主图） */
  const galleryIsHistoryMode = useMemo(() => officialGalleryIsHistoryMode(data), [data]);

  /**
   * 官方药丸出现门（图像节点）：
   * `!magicSelectionActive && !loadingOverlay && selected && src && Lee({historyVariantsHidden,historyLoading,
   *  hasHistory,hasKnownHistory,hasLegacyGallery})`，其中
   * `Lee = hasLegacyGallery || hasHistory || (!hidden && historyLoading && hasKnownHistory)`。
   * MTV 没有服务端历史 ⇒ `hasHistory=false`、`historyLoading=false`，只剩 `hasLegacyGallery` / `hasKnownHistory`。
   */
  const hasKnownHistory = data.historyVariantsHidden !== true
    && typeof data.historyVariantCount === 'number'
    && data.historyVariantCount > 1;
  const hasLegacyGallery = data.historyVariantsHidden !== true && legacyGalleryCount > 1;
  const galleryPillVisible = !!selected
    && !!rawDisplaySrc
    && !isFullscreen
    && data.status !== 'loading'
    && (hasLegacyGallery || hasKnownHistory);

  /**
   * 官方画廊开/关的**预览暂存**（`course-…`@3142060 的 `ge` effect 逐字）：
   * ```js
   * if(b && !ge.current){ F.current = {…, historyPreviewSrc:_e.data?.[ma]}; G.current = !1 }
   * else if(!b && ge.current){ if(G.current){ G.current=!1; F.current=null; return }
   *   d(e, re=>({...re, data:{...re.data,[ma]:_e?.historyPreviewSrc}})) }
   * ```
   * ⇒ 打开时暂存 `historyPreviewSrc`；关闭时**若期间没点过变体**就原样写回。
   * `G.current` = 「这次打开期间点过变体」的标记（官方在 `Ct`/`he` 里置 `true`）。
   */
  const galleryStashRef = useRef<{ historyPreviewSrc?: string } | null>(null);
  const galleryPickedRef = useRef(false);
  const galleryWasOpenRef = useRef(false);
  useEffect(() => {
    if (galleryOpen && !galleryWasOpenRef.current) {
      const live = useAppStore.getState().nodes.find((node) => node.id === id);
      galleryStashRef.current = {
        historyPreviewSrc: (live?.data as BaseNodeData | undefined)?.historyPreviewSrc,
      };
      galleryPickedRef.current = false;
    } else if (!galleryOpen && galleryWasOpenRef.current) {
      const stash = galleryStashRef.current;
      galleryStashRef.current = null;
      if (!galleryPickedRef.current && stash) {
        updateNodeData(id, { historyPreviewSrc: stash.historyPreviewSrc } as Partial<BaseNodeData>);
      }
    }
    galleryWasOpenRef.current = galleryOpen;
  }, [galleryOpen, id, updateNodeData]);

  /**
   * 官方 `$O` 的**卸载副作用**（`course-…`@3096620 逐字）：
   * ```js
   * h.useEffect(()=>()=>{c()},[c])      // c = closeGallery
   * ```
   * 药丸只在 `selected && src && Lee(...)` 时渲染 ⇒ 药丸一卸载就 `closeGallery()`。
   * 这就是官方「点画布空白收回画廊」的真实机制（9444 实测：取消选中 ⇒ `itemCount:0`、药丸消失）。
   */
  useEffect(() => {
    if (!galleryPillVisible && galleryOpen) closeGallery();
  }, [closeGallery, galleryOpen, galleryPillVisible]);

  /** 官方 `Ct`（`handleSelectImage`）：换主图 + 清 `historyPreviewSrc` + 收回画廊 */
  const handleGallerySelect = useCallback((url: string) => {
    if (!url) return;
    /* 官方 `G.current = !0`（= 这次打开期间点过变体 ⇒ 关画廊时**不**回写 `historyPreviewSrc`） */
    galleryPickedRef.current = true;
    /**
     * 官方卡片点击（`onItemClick`）与「设为主图」（`onSelectMain`）**都**调到同一个 `handleSelectImage`（`Ct`）。
     * MTV 没有服务端批次 ⇒ 永远走它的**未命中批次分支**
     * （`u(e,{src:_e,[ma]:void 0,currentSourceFileId:tr(_e)})`）
     * ⇒ 只换主图 + 清 `historyPreviewSrc` + 写 `currentSourceFileId`，**不动 `options` / `historyVariantCount`**。
     */
    updateNodeData(id, officialSelectVariantPatch(url));
    closeGallery();
  }, [closeGallery, id, updateNodeData]);

  /**
   * 官方 `ft`（tooltip「应用到画布」）：在源节点右侧 `{x:+1000,y:0}` 处**新建一个同类型节点**
   * （`p({id,type:a,position:et.position,data:{src:_e,options:[],prompt,params,type:…}})`），
   * 并 toast `"The current image has been copied to the canvas"`（官方原文，非 i18n 键）。
   */
  const handleGalleryApply = useCallback(async (url: string) => {
    if (!url) return;
    const store = useAppStore.getState();
    const sourceNode = store.nodes.find((node) => node.id === id);
    /* ★★ 卡片盒子必须按**被应用的那张图自己的真实比例**算（用户 2026 报：
       「从历史应用到画布的卡尺寸被固定成 16:9，不是图原来的尺寸，我原本是 3:4」）。
       原来这里直接拿**源节点当前的比例参数** `data.aspectRatio`（MTV 新建图卡默认 `'16:9'`）
       ⇒ 历史/变体里那张 3:4 的图应用出来也是一张 16:9 的卡 ✗。
       改为：先量这张图的真实像素 → 官方 `pR` 盒子（短边恒 250）→ 合法比例表里最接近的比例；
       量不到才回落到源节点的比例参数（保底不炸）。 */
    const dims = await computeImageNodeDimensions(url).catch(() => null);
    const realWidth = dims?.imageWidth;
    const realHeight = dims?.imageHeight;
    const realRatio = realWidth && realHeight ? nearestAspectRatioForImage(realWidth, realHeight) : null;
    const size = realWidth && realHeight
      ? nodeSizeForAspectRatio(realWidth / realHeight)
      : nodeSizeForAspectRatio(aspectRatioValue(data.aspectRatio as string));
    store.commitToHistory();
    store.addNodeTransient({
      id: `node-${generateId()}`,
      type: 'ai-image',
      position: { x: (sourceNode?.position.x ?? 0) + 1000, y: sourceNode?.position.y ?? 0 },
      data: {
        label: (data.label as string) || t('图像'),
        type: 'ai-image',
        role: 'source',
        status: 'success',
        imageUrl: url,
        thumbnailUrl: url,
        output: url,
        prompt: (data.prompt as string) || '',
        aspectRatio: realRatio?.aspectRatio ?? (data.aspectRatio as string | undefined),
        ...(realWidth && realHeight ? { imageWidth: realWidth, imageHeight: realHeight } : {}),
        nodeWidth: size.width,
        nodeHeight: size.height,
      } as BaseNodeData,
    });
    store.commitToHistory();
    /* 官方原文硬编码英文，不走 i18n：`Ce.success("The current image has been copied to the canvas")` */
    store.showToast('The current image has been copied to the canvas');
  }, [data.aspectRatio, data.label, data.prompt, id, t]);

  /** 官方 `mt`（`handleFavorite`）：按**文件**收藏这张变体 */
  const favoriteStatusOf = useCallback((url: string) => {
    const sourceFileId = officialSourceFileIdFromUrl(url)
      ?? (url === officialGalleryDisplaySrc(data) ? (data.currentSourceFileId as string | undefined) : undefined);
    if (!sourceFileId) return false;
    return favoriteStatuses[sourceFileId] ?? favoriteSourceFileIds?.[sourceFileId] ?? false;
  }, [data, favoriteSourceFileIds, favoriteStatuses]);

  const handleGalleryFavorite = useCallback((url: string) => {
    const store = useAppStore.getState();
    const target = favoriteTargetOf({ id, type: 'ai-image', data }, url);
    if (!target) {
      /* 官方 `if(!je){Ce.error("This asset cannot be favorited yet");return}`（原文硬编码英文，不走 i18n） */
      store.showToast('This asset cannot be favorited yet', 'error');
      return;
    }
    void toggleFavorite(target.sourceFileId, target.asset);
  }, [data, id, toggleFavorite]);

  /** 官方 `R`（`MediaGalleryOnNode` 的 `onDownload`）：下载这一张变体 */
  const [galleryDownloadingUrl, setGalleryDownloadingUrl] = useState<string | null>(null);
  const handleGalleryDownload = useCallback(async (url: string) => {
    if (!url || galleryDownloadingUrl) return;
    setGalleryDownloadingUrl(url);
    try {
      await saveNodeOutputToFile({
        filePath: data.filePath as string | undefined,
        mediaUrl: url,
        textOutput: undefined,
        nodeType: 'ai-image',
        fileName: (data.fileName as string | undefined) || (data.label as string | undefined),
      });
    } catch {
      useAppStore.getState().showToast(t('文件保存失败'));
    } finally {
      setGalleryDownloadingUrl(null);
    }
  }, [data.fileName, data.filePath, data.label, galleryDownloadingUrl, t]);

  /**
   * 官方 `$O` 的 onClick：`b.stopPropagation()` → `toggleGallery(nodeId)` + `updateNode(nodeId,{selected:!0})`。
   * 官方 `toggleGallery` 本身就是「同一个 id 再点一次就关」（`course-…`@3091790）。
   *
   * ⚠️ MTV 偏离（官方那一句 `updateNode(t,{selected:!0})` 换成 no-op）：
   * 药丸**只在 `selected` 为真时渲染**（出现门里就有 `selected`），所以点它的时候节点必然已选中，
   * 复位选中是多余的。而 MTV 的 `selectNodesInCanvas()` 是**延迟**的：它只写
   * `Canvas.pendingSelectionRef`，要等下一次 `nodes` 变化才在 effect 里
   * `resetSelectedElements() + addSelectedNodes(ids)`（`Canvas.tsx` @1560-1590）。
   * 实测（9333 打点，`__rst` 栈）：点了药丸后那次 effect 里的 `resetSelectedElements()`
   * 把 RF 选区清空，`addSelectedNodes` 没能把它救回来（`pending` 日志显示 ids 与 lookup 都正常），
   * 于是 `selected:false` → 药丸卸载 → 画廊被「药丸卸载即 closeGallery」的官方规则关掉（点不开）。
   * ⇒ 这里**不调** `selectNodesInCanvas`，节点保持原选中态，行为反而与官方一致。
   */
  const handleGalleryPillClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    toggleGallery(id);
  }, [id, toggleGallery]);

  /**
   * ⚠️ MTV 必需（官方没有这一手）：React Flow 的 `Pane` onClick 里带
   * `store.getState().resetSelectedElements()`（见 `NodeImageHistoryGallery` 的记账），
   * 只靠 click 阶段的 `stopPropagation()` 拦不住 ⇒ 必须在 `pointerdown` 就掐断，
   * 否则「点药丸 → 节点被 RF 取消选中 → 药丸卸载 → 画廊被卸载规则关掉」。
   */
  const handleGalleryPillPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }, []);

  /* ════════════════════════════════════════════
     Redraw State —— 官方「浮动重绘编辑器」（`floatingEditorMode === 'redraw'`）
     ════════════════════════════════════════════ */
  const [redrawMode, setRedrawMode] = useState<'redraw' | 'erase' | null>(null);

  const handleOpenRedraw = useCallback((nextMode: 'redraw' | 'erase' = 'redraw') => {
    if (pendingRedrawRef.current) {
      useAppStore.getState().showToast(t('已有重绘任务正在处理，请稍候'));
      return;
    }
    setRedrawMode(nextMode);
  }, [t]);
  const handleCloseRedraw = useCallback(() => { setRedrawMode(null); }, []);

  /**
   * 官方 `jhe.handleGenerate`（@1327）的 MTV 落地：
   *   ① mask 落盘（官方是上传拿 URL；MTV 走项目内文件，同 crop）
   *   ② **先建结果节点**：`title: t('image.redraw')`（=「重绘」）、`prompt` = 用户输入、
   *      位置 = 源节点右边缘 + 100（官方 `fc(N,k,{x:mn(N)+100,y:0})`）
   *   ③ 连边：源 → 新（官方 `[{source:e.id,target:oe.id}]`；有参考图再加 参考→新）
   *   ④ 关编辑器，**再**提交生成；提示词用官方模板（节点上的 prompt 仍是用户原文）——
   *      官方 `send({frontendParams:{prompt:B, images:[refUrl?, maskUrl]}})`，节点 prompt 只用于展示。
   */
  const handleRedrawGenerate = useCallback(
    async ({ prompt, maskDataUrl, width, height, model, resolution, times, reference }: RedrawGeneratePayload) => {
      const store = useAppStore.getState();
      const source = store.nodes.find((node) => node.id === id);
      const currentPos = source?.position ?? { x: 0, y: 0 };
      const projectId = store.currentProjectId ?? 'default';
      const newNodeId = `node-${generateId()}`;
      const generateMode = redrawMode ?? 'redraw';
      pendingRedrawRef.current = true;
      setRedrawMode(null);

      try {
        let maskUrl = maskDataUrl;
        if (projectId !== 'default') {
          const saved = await saveDataUrlToProjectData(maskDataUrl, projectId, buildNodeFileName('redraw-mask', 'png', 'mask'));
          if (saved?.assetUrl) maskUrl = saved.assetUrl;
        }

        /* ★ 官方 `jhe`：`b.type==='file'` 时先把参考图上传并**建一个 `title:"Image"` 的节点**
            （位置 `fc(N,k,{x:0, y:ws(N)+50})` = 源节点正下方 50）、`selected:false`；
           `b.type==='node'` 则直接用画布上那个节点。两种情况都会 参考→新 连一条边。 */
        let refNodeId: string | undefined;
        let refUrl: string | undefined;
        if (reference?.kind === 'file') {
          let fileUrl = reference.dataUrl;
          if (projectId !== 'default') {
            const savedRef = await saveDataUrlToProjectData(reference.dataUrl, projectId, buildNodeFileName(reference.fileName || 'reference', 'png', 'ref'));
            if (savedRef?.assetUrl) fileUrl = savedRef.assetUrl;
          }
          const refNodeIdNew = `node-${generateId()}`;
          const live = useAppStore.getState();
          live.addNode({
            id: refNodeIdNew,
            type: 'ai-image',
            position: { x: 0, y: currentPos.y + nodeHeight + 50 },
            data: { label: 'Image', type: 'ai-image', role: 'source', status: 'success', imageUrl: fileUrl } as BaseNodeData,
          });
          refNodeId = refNodeIdNew;
          refUrl = fileUrl;
        } else if (reference?.kind === 'node') {
          const refNode = store.nodes.find((node) => node.id === reference.nodeId);
          if (refNode) {
            refNodeId = refNode.id;
            refUrl = (refNode.data.imageUrl as string | undefined)
              || (refNode.data.thumbnailUrl as string | undefined);
          }
        }

        const liveStore = useAppStore.getState();
        if (liveStore.currentProjectId !== projectId) return;
        const newNode: Node<BaseNodeData> = {
          id: newNodeId,
          type: 'ai-image',
          position: { x: currentPos.x + nodeWidth + 100, y: currentPos.y },
          data: {
            label: generateMode === 'erase' ? t('擦除') : t('重绘'),
            type: 'ai-image',
            role: 'generator',
            status: 'loading',
            prompt,
            model: model ?? (data.model as string | undefined) ?? undefined,
            imageSize: resolution,
            batchCount: times,
            nodeWidth,
            nodeHeight: Math.max(120, Math.round((nodeWidth * height) / Math.max(1, width))),
            redrawMaskUrl: maskUrl,
            ...(refUrl ? { redrawReferenceUrl: refUrl } : {}),
          } as BaseNodeData,
        };
        liveStore.addNode(newNode);
        const nextEdges = [
          ...liveStore.edges,
          { id: `edge-${generateId()}`, source: id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left' },
        ];
        if (refNodeId) {
          nextEdges.push({ id: `edge-${generateId()}`, source: refNodeId, target: newNodeId, sourceHandle: 'right', targetHandle: 'left' });
        }
        liveStore.setEdges(nextEdges);
        void executeGeneration(newNodeId, REDRAW_PROMPT_TEMPLATE(prompt, Boolean(refUrl)));
      } catch {
        useAppStore.getState().showToast(t('生成处理失败'), 'error');
      } finally {
        pendingRedrawRef.current = false;
      }
    },
    [data.model, id, nodeHeight, nodeWidth, redrawMode, t],
  );

  /* ════════════════════════════════════════════
     扩图（outpaint）State —— 官方 `Fhe(mode='outpaint')` + `Phe.handleGenerate` @1330724
     ① 合成图（**透明底 + 原图**）落盘（官方是上传拿 URL；MTV 走项目内文件，同 crop/redraw）
     ② 建结果节点：`title: image.outpainting`（=「扩图」）、`editSubType: OUT_PAINT`、
        固定提示词 `Mhe`，位置 = 源节点右边缘 + 100（官方 `fc(N,k,{x:mn(N)+100,y:0})`）
     ③ 连边 源→新（官方 `[{source:e.id,target:ne.id}]`）
     ④ 关编辑器 → **再**提交生成（固定提示词；失败则删节点 + `nodes.redrawProcessingFailed`）
     ════════════════════════════════════════════ */
  const [outpaintMode, setOutpaintMode] = useState(false);

  const handleOpenOutpaint = useCallback(() => {
    if (pendingRedrawRef.current) {
      useAppStore.getState().showToast(t('已有重绘任务正在处理，请稍候'));
      return;
    }
    setOutpaintMode(true);
  }, [t]);
  const handleCloseOutpaint = useCallback(() => setOutpaintMode(false), []);

  const handleOutpaintGenerate = useCallback(
    async ({ compositeDataUrl, width, height, model, resolution, times }: OutpaintGeneratePayload) => {
      const store = useAppStore.getState();
      const source = store.nodes.find((node) => node.id === id);
      const currentPos = source?.position ?? { x: 0, y: 0 };
      const projectId = store.currentProjectId ?? 'default';
      const newNodeId = `node-${generateId()}`;
      pendingRedrawRef.current = true;
      setOutpaintMode(false);

      try {
        let outpaintUrl = compositeDataUrl;
        if (projectId !== 'default') {
          const saved = await saveDataUrlToProjectData(
            compositeDataUrl,
            projectId,
            buildNodeFileName('outpaint', 'png', 'outpaint'),
          );
          if (saved?.assetUrl) outpaintUrl = saved.assetUrl;
        }

        const liveStore = useAppStore.getState();
        if (liveStore.currentProjectId !== projectId) return;
        const newNode: Node<BaseNodeData> = {
          id: newNodeId,
          type: 'ai-image',
          position: { x: currentPos.x + nodeWidth + 100, y: currentPos.y },
          data: {
            label: t('扩图'),
            type: 'ai-image',
            role: 'generator',
            status: 'loading',
            prompt: OUTPAINT_PROMPT_TEMPLATE,
            model: model ?? (data.model as string | undefined) ?? undefined,
            imageSize: resolution,
            batchCount: times,
            nodeWidth,
            nodeHeight: Math.max(120, Math.round((nodeWidth * height) / Math.max(1, width))),
            outpaintImageUrl: outpaintUrl,
          } as BaseNodeData,
        };
        liveStore.addNode(newNode);
        liveStore.setEdges([
          ...liveStore.edges,
          { id: `edge-${generateId()}`, source: id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left' },
        ]);
        void executeGeneration(newNodeId, OUTPAINT_PROMPT_TEMPLATE);
      } catch {
        useAppStore.getState().showToast(t('生成处理失败'), 'error');
      } finally {
        pendingRedrawRef.current = false;
      }
    },
    [data.model, id, nodeWidth, t],
  );

  /* ════════════════════════════════════════════
     多角度（multi-angle）State —— 官方 `image-tools/multi-angle` `_nt` @3074800
     · 打开：官方 policy 检查 `actionId:'multi_angle'` → `updateNodeData(nodeId,{mode:'multi-angle'})`
       （MTV 没有 policy 服务 ⇒ 直接打开；`parametersLocked` 预留为 false）
     · 生成：位置 = 源节点右边缘 **+200**、`title: image.multiAngle`、`editSubType: MULTI_ANGLE`、
       `taskInfo PENDING/SRC`、源→新一条边、`mode:undefined` + setCenter(…,{duration:500,zoom:1})、
       失败**删节点**；请求 = `loe({image_urls, rotate_right_left:-params.rotate_right_left, …}).send()`
     ════════════════════════════════════════════ */
  const [isMultiAngle, setIsMultiAngle] = useState(false);


  const handleOpenMultiAngle = useCallback(() => {
    if (pendingRedrawRef.current) {
      useAppStore.getState().showToast(t('已有任务正在处理，请稍候'));
      return;
    }
    setIsMultiAngle(true);
  }, [t]);
  const handleCloseMultiAngle = useCallback(() => setIsMultiAngle(false), []);

  const handleMultiAngleGenerate = useCallback(
    async (params: MultiAngleParams) => {
      const store = useAppStore.getState();
      const source = store.nodes.find((node) => node.id === id);
      const currentPos = source?.position ?? { x: 0, y: 0 };
      const src = (data.imageUrl || data.thumbnailUrl) as string | undefined;
      if (!src) {
        store.showToast(t('没有可用的图片'), 'error');
        return;
      }
      const newNodeId = `node-${generateId()}`;
      const canvasId = store.currentProjectId ?? undefined;
      /* ★ 兜底：源节点没有 model ⇒ 自动取「可用图像模型」列表第一个（可见且已配置的）
         ⇒ 官方端点自带模型，MTV 侧必须自己带上，否则 executeGeneration 无从发请求。 */
      const fallbackModel = usableImageModels[0];
      const resolvedModel = (data.model as string | undefined) ?? fallbackModel?.value;
      const resolvedProvider = (data.provider as string | undefined) ?? fallbackModel?.provider;
      const request = buildMultiAngleRequest(params, { imageUrls: [src], nodeId: newNodeId, canvasId });
      pendingRedrawRef.current = true;
      setIsMultiAngle(false);

      {
        const liveStore = useAppStore.getState();
        liveStore.addNode({
          id: newNodeId,
          type: 'ai-image',
          position: { x: currentPos.x + nodeWidth + 200, y: currentPos.y },
          data: {
            label: t('多角度'),
            type: 'ai-image',
            role: 'generator',
            status: 'loading',
            prompt: multiAnglePrompt(request),
            model: resolvedModel,
            provider: resolvedProvider,
            editSubType: 'multi_angle',
            nodeWidth,
            nodeHeight,
            multiAngleSourceUrl: src,
            multiAngleParams: params,
          } as BaseNodeData,
        });
        liveStore.setEdges([
          ...liveStore.edges,
          { id: `edge-${generateId()}`, source: id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left' },
        ]);
      }

      try {
        /* 官方成功后 setCenter(q.position.x, q.position.y, {duration:500, zoom:1})
           ⇒ MTV 用视口控制器把新卡片居中（zoom 1、500ms，与官方同一拍） */
        const controller = getCanvasViewportController();
        const snapshot = controller?.getSnapshot();
        if (controller && snapshot) {
          const viewportWidth = snapshot.visibleBounds.width * snapshot.zoom;
          const viewportHeight = snapshot.visibleBounds.height * snapshot.zoom;
          const centerX = currentPos.x + nodeWidth + 200 + nodeWidth / 2;
          const centerY = currentPos.y + nodeHeight / 2;
          void controller.setViewport({ x: viewportWidth / 2 - centerX, y: viewportHeight / 2 - centerY, zoom: 1 }, 500);
        }

        const response = await loe(request).send(async (genParams) => {
          await executeGeneration(newNodeId, genParams.prompt);
          const created = useAppStore.getState().nodes.find((node) => node.id === newNodeId);
          const url = created?.data.imageUrl as string | undefined;
          return url ? [url] : [];
        });
        if (response.code !== 0) {
          /* ★ 用户口径：**结果卡片不能消失**。MTV 侧失败（多半是新节点没拿到可用模型/额度）
             要留着卡片（卡片底部编辑区可换模型重试），只把状态标 error + 提示原因。 */
          useAppStore.getState().updateNodeDataTransient(newNodeId, { status: 'error' } as Partial<BaseNodeData>);
          useAppStore.getState().showToast(t('生成处理失败：请在卡片底部选择可用的图像模型后重试'), 'error');
        }
      } catch (error: unknown) {
        useAppStore.getState().updateNodeDataTransient(newNodeId, { status: 'error' } as Partial<BaseNodeData>);
        useAppStore.getState().showToast(
          error instanceof Error && error.message
            ? error.message
            : t('生成处理失败：请在卡片底部选择可用的图像模型后重试'),
          'error',
        );
      } finally {
        pendingRedrawRef.current = false;
      }
    },
    [data.imageUrl, data.model, data.provider, data.thumbnailUrl, id, nodeHeight, nodeWidth, t, usableImageModels],
  );

  /** 重绘 — 官方 `k(e,'redraw')`：打开浮动重绘编辑器（不是提示词栏） */
  const handleRepaint = useCallback(() => {
    handleOpenRedraw();
  }, [handleOpenRedraw]);

  /* ════════════════════════════════════════════
     标注（annotate）State —— 官方 `Fhe(mode='annotate')` + `mhe.handleSave` @1311241
     ★ 与 redraw 共用同一个浮层宿主与 **同一块 fabric 画布**（官方 `xhe`），
       区别：画布 `opacity: 1`、默认工具 `brush`、颜色 `#ff0000`、笔宽 4、顶栏多「文本/颜色/保存」、**没有底栏**。
     ★ 保存 = 原图尺寸画布上「先画原图、再画标注层导出」→ `Annotated Image` 节点（`editSubType: cutout`）+ 边。
     ════════════════════════════════════════════ */
  const [isAnnotate, setIsAnnotate] = useState(false);

  const handleOpenAnnotate = useCallback(() => setIsAnnotate(true), []);
  const handleCloseAnnotate = useCallback(() => setIsAnnotate(false), []);

  const handleAnnotateSave = useCallback(
    async ({ dataUrl }: { dataUrl: string; width: number; height: number }) => {
      const store = useAppStore.getState();
      const source = store.nodes.find((node) => node.id === id);
      const currentPos = source?.position ?? { x: 0, y: 0 };
      const projectId = store.currentProjectId ?? 'default';
      const newNodeId = `node-${generateId()}`;
      setIsAnnotate(false);
      try {
        let url = dataUrl;
        if (projectId !== 'default') {
          const saved = await saveDataUrlToProjectData(dataUrl, projectId, buildNodeFileName('annotation', 'png', 'annotation'));
          if (saved?.assetUrl) url = saved.assetUrl;
        }
        const liveStore = useAppStore.getState();
        if (liveStore.currentProjectId !== projectId) return;
        liveStore.addNode({
          id: newNodeId,
          type: 'ai-image',
          position: { x: currentPos.x + nodeWidth + 100, y: currentPos.y },
          data: {
            /* 官方 `Fm({src, title:"Annotated Image", editSubType: Nv.CUTOUT})` —— title 逐字英文 */
            label: 'Annotated Image',
            type: 'ai-image',
            role: 'source',
            status: 'success',
            imageUrl: url,
            editSubType: 'cutout',
            nodeWidth,
            nodeHeight,
          } as BaseNodeData,
        });
        liveStore.setEdges([
          ...liveStore.edges,
          { id: `edge-${generateId()}`, source: id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left' },
        ]);
        liveStore.showToast(t('标注保存成功'));
      } catch {
        useAppStore.getState().showToast(t('标注保存失败'), 'error');
      }
    },
    [id, nodeHeight, nodeWidth, t],
  );

  /** 复制图像到系统剪贴板（位图，可粘贴到 PS / 聊天） */
  const handleCopyImage = useCallback(async () => {
    const store = useAppStore.getState();
    const imageUrl = (data.imageUrl || data.thumbnailUrl) as string | undefined;
    if (!imageUrl) {
      store.showToast(t('没有可用的图片'), 'error');
      return;
    }
    const ok = await copyImageToClipboard(imageUrl);
    store.showToast(ok ? t('已复制图像到剪贴板') : t('复制失败'), ok ? undefined : 'error');
  }, [data.imageUrl, data.thumbnailUrl, t]);

  const handleReversePrompt = useCallback(() => {
    const store = useAppStore.getState();
    const imageUrl = (data.imageUrl || data.thumbnailUrl) as string | undefined;
    if (!imageUrl) {
      store.showToast(t('没有可反推的图片'), 'error');
      return;
    }
    store.setReversePromptRequest({ sourceNodeId: id, kind: 'image', imageUrls: [imageUrl] });
  }, [data.imageUrl, data.thumbnailUrl, id, t]);

  const {
    isUpscaling,
    upscaleProgress,
    downloadPrompt,
    isDownloadingModel,
    handleUpscale,
    handleDownloadConfirm,
    handleDownloadCancel,
    isMattingRunning,
    mattingDownloadPrompt,
    isDownloadingMattingModel,
    handleSubjectMatting,
    handleMattingDownloadConfirm,
    handleMattingDownloadCancel,
  } = useImageNodeOnnxActions({
    id,
    data,
    nodeWidth,
    updateNodeDataTransient,
  });

  const { displayLabel, handleRename } = useNodeRename(id, data, 'Image');

  // 重编辑器会自行解码原图或建立 GPU 纹理；打开期间卸载画布预览，避免同一资源双份常驻。
  const shouldSuspendCanvasPreview = isFullscreen
    || isMatting
    || isAnnotate
    || isCrop
    || isCustomGrid
    || isCameraStudio
    || isCompose;

  useCanvasNodeLodProtection(id, shouldSuspendCanvasPreview || isUploading || isUpscaling
    || isMattingRunning || imgLoadError || imgRetrying || mattingError || annotateError);

  /* ★ 左 `+` 只在**参考卡**上隐藏（官方源码 `Wke` @1209102 的谓词）：
       官方：`force-hidden = p(多选) || r(isDragging) || !o(isConnectable 该侧)`，
             `visible      = !p && (s 选中 || n4 悬停) && v`（`v = o && !i`）
       ⇒ 左 `+` 只在**该侧不可连接**时消失。官方实测（t1135）：角色库应用到画布的卡
         （有图）**左右都在** ✓；只有参考/上传卡才左隐。
       ⚠️ MTV 原来是「凡有图（has-media）就藏左 `+`」✗ ⇒ 角色卡本身有图，左 `+` 永远看不到 ✗
          （用户：「左右 + 按钮应该出现 … 不管是在组内还是组外」✓）
       ⚠️ 也不能用 `role === 'source'`：**角色库应用出来的卡也是 `role:'source'`**（assetRowActions.ts:266）✗
       ⇒ 用「**来自磁盘上传**」这个更窄的口径：`fileName`（`useNodeCreation.ts` 上传路径才写它）✓ */
  const isReferenceCard = typeof data.fileName === 'string' && data.fileName.length > 0;

  return (
    <>
      <div
        className={`node-wrapper relative${displaySrc ? ' has-media' : ''}${isReferenceCard ? ' is-reference-card' : ''}`}
        style={{ width: animSize?.w ?? nodeWidth }}
        /* 官方 `locateNode` 的 `highlightedNodes` ⇒ 定位后本卡亮一圈白环（1.6s 后自动消失） */
        data-pin-located={locatedPinNodeId === id ? 'true' : undefined}
      >
        {/* 官方 `Jke`：本卡被 Pin 后**始终挂载**这层外框，只有 opacity 随「是否命中当前过滤色」切换
            （3px 该组色 + 22px 光晕 · rounded-2xl · z-5 · 0.3s 过渡） */}
        <PinCardBorder pins={readPins(data)} />
        <NodeLabel
          kind="ai-image"
          // 官方卡片左上角标签是英文 **Image**（图标 + Image）。
          // 老数据里存的是「生成图像」，显示时归一化；用户自定义过的名字不动。
          label={displayLabel === '生成图像' ? 'Image' : displayLabel}
          displayId={data.displayId as number | undefined}
          nodeId={id}
          onRename={handleRename}
          /* ★ 标题行的「对号」只给**库里来的资产卡**（官方 t1182 实测：诸侯国君卡有、Image 上传卡没有）
             ⇒ 本地上传的参考卡（`isReferenceCard`）与**空白新建卡**（没有 `displaySrc`）都不显示 ✓
             用户 2026：「新建空白图片卡时 image 后面怎么有 √ 符号了」✓ */
          /* ★ 标题行的「对号」= 官方 `authenticityCheck` **内容校验通过**（`status === bs.APPROVED`）。
             官方 `KP`@258250：`UNKNOWN` 直接 `return null` ⇒ 没有该状态就**不画对号**。
             ⚠️ 旧实现用「有本地图 + 非参考卡」判定 ⇒ 语义与官方不符（用户实测「对号出现的不对劲」）。 */
          authenticityStatus={authenticityStatusOf(
            (data as { authenticityStatus?: unknown }).authenticityStatus
              ?? (data as { complianceStatus?: unknown }).complianceStatus,
          )}
        />
        {/* ★★ 官方「折叠变体」计数药丸 `N ▾`（`$O` @3096620；渲染处 `absolute top-3 right-3 z-10`）。
            出现门照官方 `Lee`：有 legacy 画廊（`src+options` 去重 > 1）或已知变体数 > 1，
            且**节点被选中**、卡里有图、未在生成中、媒体查看器未打开。 */}
        {galleryPillVisible && (
          <ImageHistoryCountPill
            totalCount={legacyGalleryCount}
            isOpen={galleryOpen}
            onClick={handleGalleryPillClick}
            onPointerDown={handleGalleryPillPointerDown}
          />
        )}
        {/* ★★ 官方变体画廊本体（`UT`/`Ree`）：折叠态露出「叠着的第 2 张」的边，
            点药丸后横向展开成一行卡片（覆盖原卡片位置）。 */}
        {(galleryOpen || (!!selected && galleryItems.length > 0)) && (
          <NodeImageHistoryGallery
            items={galleryItems}
            currentItem={galleryCurrentItem}
            isOpen={galleryOpen}
            isHistoryMode={galleryIsHistoryMode}
            cell={{ width: animSize?.w ?? nodeWidth, height: animSize?.h ?? nodeHeight }}
            favoriteStatusOf={favoriteStatusOf}
            downloadingUrl={galleryDownloadingUrl}
            onSelect={handleGallerySelect}
            onApply={handleGalleryApply}
            onFavorite={handleGalleryFavorite}
            onDownload={(url) => { void handleGalleryDownload(url); }}
          />
        )}
        {/* 官方：**没有图**的卡片 hover 时，标题上方浮出「上传」胶囊（75×37 · #262626 · r999）。
            ★★ 官方出现门（`GenerateImageNode`，`vendor-pkg-canvas-futqHM6N.js` @1810203 区段逐字）：
              `const ye = v || Ue;`                     // v = isGenerating · Ue = 「刚生成完」的短窗口
              `const Ee = t && !g && !d && !ye && !h && !S;`   // → `o.jsx(wE,{visible:Ee})`
            ⇒ **生成中**（`!v`）与**刚生成完**（`!Ue`）都不出上传胶囊；MTV 原来只写了 `!displaySrc`
            ⇒ 空白生成卡在生成期间会冒出「上传」（用户 2026：「图片生成卡在生成时点击是**没有**上传按钮的」）✗
            ⇒ 这里补上官方那两个门（生成中 = `status==='loading'`；刚生成完 = `justCompleted`）。 */}
        {!displaySrc && data.status !== 'loading' && !justCompleted && (
          <button
            type="button"
            className="node-upload-pill nodrag nopan"
            onClick={handleUpload}
          >
            <OfficialIcon name="upload" size={16} />
            {t('上传')}
          </button>
        )}
        {/* ⚠️ 这里**不再挂 `loading`** ✗✓：官方没有「卡面流光」这套（那是 MTV 自造的
            `.node.loading .node-preview::after` shimmer）—— 上传态/生成态一律改用官方动效：
              · 上传中 → `bg-secondary(#222)` 或 `bg-background/50(#0f0f0f 50%)` 全铺 + `animate-pulse` ✓
              · 生成中 → `node-loading` 五层动效（NodeLoadingAnimation ✓）
            见下方同级浮层 ✓ */}
        {/* ★ `gallery-open` = 官方图像节点 `GenerateImageNode` 的 `O`（`isGalleryOpen`，运行端 chunk
            `tapnow://app/assets/course-api-base-url-0D9Dk52r.js`，0.4.81，0-based 偏移）。官方用它一次性
            收掉节点自身的 chrome：`je = !Pe && !ht && !O && !!g && p`（@3244036，左上角收藏星标）、
            `canAcceptInput:!O, canProvideOutput:!O`（@3244226，左右 `+` 把手 force-hidden）、
            节点工具条 `visible:!O&&!!g&&t`（@3246999）。MTV 用同一个类名把这三条落到自己的 DOM 上。 */}
        <div
          className={`node image-node ${selected ? 'selected' : ''} ${justCompleted ? 'just-completed' : ''}${galleryOpen ? ' gallery-open' : ''}`}
          style={{ height: animSize?.h ?? nodeHeight }}
        >
          {/* ★★ 官方「卡片左上角收藏（星形）按钮」（t1060 官方 DOM 逐字，仅在**单选**时渲染）：
              ```html
              <button type="button" class="absolute top-3 left-3 z-[60] h-7 w-7 rounded-[10px] nodrag nopan
                            pointer-events-auto bg-black/50 hover:bg-black/70 flex items-center justify-center
                            cursor-pointer transition-colors text-[#F5F5F5]">
                <svg width="16" height="16" class="tabler-icon tabler-icon-star">…</svg>
              </button>
              ```
              官方四态实测：未选/悬停都没有这个按钮，**点一下（单选）才出现**；框选多张时官方也不渲染
              （t1055 官方框选态截图：卡片上没有星标）⇒ 用 `selected && 单选` 双重门控。
              （官方点它是「收藏」；MTV 没有收藏后端 ⇒ 落到节点数据的 `favorite` 标记 + toast，
                与「只有外观没有行为」的要求保持一致。） */}
          {/* ★★★★★ 收藏星标的判据 = **选中 + 单选 + 卡里有图 + 不是参考卡** ✓
                官方实测（t1172 / t1180 / t1181）：
                  · 角色/生成卡（有图）→ 选中时星标 `opacity:1` ✓
                  · 参考/上传卡（有图）→ **没有星标**（`星标: null`）✓
                  · **空白/无媒体的卡 → 没有星标** ✓
               语义依据：官方收藏接口按**文件**收藏
                  `Y1={ADD:"/api/library/v1/favorites", …}`，提交字段是 **`source_file_id`**
                  （`zoom-slider-3ZcFvYQO.js` @7727）⇒ **没有文件就没有可收藏的东西** ✓
               用户 2026：「新建图片空白卡时 怎么又收藏按钮了」⇒ 空白卡必须没有星标 ✓
               ⚠️ 上一版只写了 `!isReferenceCard` ✗ —— 空白卡既不是参考卡、又没有文件，
                  于是空白卡也冒出了星标 ✗✓ 现补上 `displaySrc`（= 卡里真的有媒体）✓
               （官方四态实测：未选/悬停都没有这个按钮，**单选才出现**；框选多张时也不渲染。）
               ★★ 用户 2026：「多变体点击后铺开后，左侧第一张卡 多一个 左上角有个收藏按钮 重复了」✗
                  —— 根因就在这里：画廊展开行的**最左那张卡**正好盖在节点原位，卡自己左上角已有一组
                  `收藏/应用到画布/下载`（`NodeImageHistoryGallery`，官方 `Mee` 的左浮层，box 与本节
                  这颗星标几乎完全重合），而 MTV 这颗**节点自身的**星标在画廊打开时**没有收起来** ⇒ 视觉上
                  「多了一颗收藏按钮」✗
                  官方出处（运行端 chunk @3244036，图像节点 `GenerateImageNode`）：
                  ```js
                  je = !Pe && !ht && !O && !!g && p;   // Pe=magicSelection、ht=loadingOverlay、O=isGalleryOpen
                  …
                  {je && <button className="absolute top-3 left-3 z-[60] h-7 w-7 …">…</button>}
                  ```
                  ⇒ **官方在画廊打开（`O`）时根本不渲染这颗星标** ⇒ MTV 补同一条门 ✓ */}
          {selected && singleSelected && displaySrc && !isReferenceCard && !galleryOpen && (
            <button
              type="button"
              className="node-favorite-btn nodrag nopan"
              aria-label={t('收藏')}
              aria-pressed={Boolean((data as Record<string, unknown>).favorite)}
              onClick={(event) => {
                event.stopPropagation();
                const next = !(data as Record<string, unknown>).favorite;
                updateNodeData(id, { favorite: next } as never);
                useAppStore.getState().showToast(next ? '已收藏' : '已取消收藏');
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="tabler-icon tabler-icon-star" aria-hidden="true">
                <path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" />
              </svg>
            </button>
          )}
          <div
            className={`node-preview compact${focusEdit ? ' nodrag nopan' : ''}`}
            /* ★ 焦点编辑：**点一下**目标图的某个位置 → 识别该处元素（官方 `VZ`/`WS` 的
               `onMagicClick`，`_official-interactions/source-snippets.md:268`）。
               ⚠️ 旧实现是「拖拽拉 ROI 矩形、坐标被丢弃」（纯视觉、不参与任何逻辑）——
                  与官方语义不符，已按官方撤掉，改为点击。 */
            onMouseDown={isFocusEditTarget ? handleFocusEditClick : undefined}
          >
            {/* ★★★★★ **「替换」按钮只在参考/上传卡上渲染**（用户 2026：「上传图后卡片 替换按钮没了」
                 + 官方实测 t1171/t1172）：
                   官方**参考/上传卡**（左 `+` 被 force-hidden 的那类）：
                     卡内**有**「替换」按钮 = shadcn Button（`h-9 px-4 py-2 rounded-md bg-secondary/80
                     text-white shadow-sm`），`position:absolute; top:8px; right:8px; z-index:5`，
                     类名里带 `opacity-0 group-hover:opacity-100 transition-opacity` ⇒ **悬停卡片时浮现** ✓
                   **没有**星标（实测 `星标: null`）
                   官方**角色/生成卡**（有图、左右 `+` 都可用）：**连「替换」按钮都不挂载**（`替换: null`）✓
                     只有星标（`top-3 left-3 z-[60] h-7 w-7 rounded-[10px] bg-black/50`，**选中时** op=1 ✓）
                 ⚠️ 上一轮我把这条 CSS 改成「永不显示」✗ —— 那是按「角色卡不该有替换」的一刀切，
                    结果**上传的参考卡也没有替换按钮了** ✗✓
                 ⇒ 改成：**只有参考卡才渲染**（`isReferenceCard`）+ 恢复 `:hover` 浮现 ✓
                 图标被官方 base 的 `[&_svg]:size-4` 压到 **16×16** ⇒ 这里直接给 16 */}
            {displaySrc && isReferenceCard && (
              <button
                type="button"
                className="node-replace-btn nodrag nopan"
                aria-label={t('替换')}
                onClick={handleUpload}
              >
                <OfficialIcon name="replace" size={16} />
                {t('替换')}
              </button>
            )}
            {/* ★ 焦点编辑覆盖层（官方 `MagicSelectionOverlay` @1600161）：目标卡命中层 + mark 标记。
                官方位置 = 卡片 body 内、与图/按钮同级（`absolute inset-0 z-20`）。 */}
            {focusEditOverlay}
            {/* 焦点编辑遮罩 — 官方实测：与卡片同尺寸 · bg rgba(0,0,0,.7) · radius 16px · 「ESC 退出模式」 */}
            {focusEdit && (
              <div className="focus-edit-mask" aria-hidden="true">
                <span>ESC {t('退出模式')}</span>
              </div>
            )}
            {/* 「从画布选择参考」的源节点遮罩**不在这里**：官方是通用节点选择模式的 `AIe`
                （`bg-black/70` + `rounded-[12px]` + ESC 键帽），由 `NodeSelectionPickLayer` 统一渲染。 */}
            {/* ⚠️ 旧的 `focusRoi` 白色虚线选框已删：官方焦点编辑是**点一下**取点，
                不是拖框；选中矩形由识别结果 `box_2d` 驱动（见 marks 覆盖层）。 */}
            {displaySrc ? (
              <div className="image-preview-container">
                {shouldSuspendCanvasPreview && (
                  <div
                    className="image-preview-suspended pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-card via-background to-secondary text-text-text-tertiary"
                    aria-hidden="true"
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.42">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span className="text-[10px] tracking-[0.16em] opacity-50">{t('编辑中')}</span>
                  </div>
                )}
                {!shouldSuspendCanvasPreview && (
                  <>
                {imgLoadError ? (
                  /* ★ 官方「图片加载失败」覆盖层（逐字 · `source-snippets.md:278-281`，`VZ` @1819344 邻域）：
                     `absolute inset-0 z-1000 pointer-events-auto flex flex-col items-center justify-center
                      bg-background/80 gap-2 p-4 text-center rounded-2xl`
                     子项：48×48 失败图标 → 第 1 行 `text-sm font-medium` → 第 2 行 `text-xs max-w-[200px]`
                           → 重试按钮 `variant="outline" size="sm"` + `mt-2` + 图标 `w-4 h-4 mr-1`
                     ⚠️ 旧实现（本轮修）：图标 24×24、只有 1 行文案、按钮是 `canvas-*` 蓝底药丸
                        —— 三处都与官方不符，且靛蓝令牌正是用户报的「蓝色太丑」。 */
                  <div className="image-load-error-overlay">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="image-load-error-icon"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p className="image-load-error-title">{t('预览加载失败')}</p>
                    <p className="image-load-error-desc">{t('图片已生成完成，因网络原因无法显示。请刷新页面，或前往左侧菜单栏「历史记录」查看。')}</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlePreviewImageReload(); }}
                      className="o-btn o-btn--outline o-btn--sm image-load-error-retry nodrag nopan"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                        <polyline points="21 3 21 9 15 9" />
                      </svg>
                      {t('重试')}
                    </button>
                  </div>
                ) : (
                  <CanvasPreviewImage
                    key={`${previewFetchSrc}:${imgRetryAttempt}`}
                    src={previewFetchSrc}
                    nodeId={id}
                    projectId={previewProjectId}
                    nodeWidth={nodeWidth}
                    nodeHeight={nodeHeight}
                    alt="Generated"
                    className={`image-preview-img compact img-reveal${imgLoaded ? ' is-loaded' : ''}`}
                    data-source-url={data.sourceUrl}
                    onLoad={handlePreviewImageLoad}
                    onError={handlePreviewImageError}
                  />
                )}
                {imgRetrying && (
                  /* ★ 底色改官方中性值（原来是 `canvas-*` = `--theme-card:#1a1a26`，蓝调 ✗）。
                     官方重试/加载态没有任何靛蓝/紫底：容器底 = `--background:#0f0f0f`，
                     卡面 = `#1f1f1f`。这里取 `#0f0f0f`，与官方 `bg-background` 一致。 */
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f0f]" aria-hidden="true">
                    <div className="spinner" />
                  </div>
                )}
                {data.mattingMask && !mattingError && (
                  <img
                    src={data.mattingMask as string}
                    alt="Mask"
                    className="image-preview-mask"
                    onError={() => setMattingFailedSrc(data.mattingMask as string)}
                  />
                )}
                {annotationLayer ? (
                  <Suspense fallback={data.annotation && !annotateError ? (
                    <img
                      src={data.annotation as string}
                      alt="Annotation"
                      className="image-preview-mask"
                      onError={() => setAnnotateFailedSrc(data.annotation as string)}
                    />
                  ) : null}>
                    <AnnotationLayer
                      layer={annotationLayer}
                      legacyUrl={data.annotation as string | undefined}
                      onLegacyError={() => setAnnotateFailedSrc(data.annotation as string)}
                      className="image-annotation-layer"
                      fit="cover"
                    />
                  </Suspense>
                ) : data.annotation && !annotateError ? (
                  <img
                    src={data.annotation as string}
                    alt="Annotation"
                    className="image-preview-mask"
                    onError={() => setAnnotateFailedSrc(data.annotation as string)}
                  />
                ) : null}
                {/* 超分加载动画：光晕流动 + 扫描光带 */}
                {isUpscaling && (
                  <div className="upscale-glow" aria-hidden="true">
                    <div className="upscale-glow-scan" />
                    <div className="upscale-glow-ring" />
                    <span className="upscale-glow-label">
                      <span className="upscale-glow-dot" />
                      {upscaleProgress > 0 ? t('超分中 {progress}%', { progress: upscaleProgress }) : t('超分中')}
                    </span>
                  </div>
                )}
                {/* 主体识别加载动画：复用超分光晕效果 */}
                {isMattingRunning && (
                  <div className="upscale-glow" aria-hidden="true">
                    <div className="upscale-glow-scan" />
                    <div className="upscale-glow-ring" />
                    <span className="upscale-glow-label">
                      <span className="upscale-glow-dot" />
                      {t('主体识别中...')}
                    </span>
                  </div>
                )}
                  </>
                )}
              </div>
            ) : isUploading ? (
              /* ★ 官方**空卡**上传态（逐字 · 官方 `Gtt({isUploading})`）：
                 `absolute inset-0 bg-secondary z-10 animate-pulse w-full h-full`，testid `image-uploading-overlay`
                 · `bg-secondary` = 官方 `--secondary` = **#222** ✓
                 · `animate-pulse` = Tailwind 默认（2s cubic-bezier(.4,0,.6,1) infinite，50% 时 opacity .5）
                 · **没有** spinner、**没有**「上传中…」文案 —— MTV 原来那个 `.node-preview-loading`
                   （32px 转圈 + 文案）是自造的 ✗ 已删 ✓
                 · 官方此处是**替换**占位图（占位图不渲染）→ 这里同样不渲染占位图 ✓
                   （`animate-pulse` 会降到 .5，若占位图留在下面会透出来 ✗）*/
              <div
                className="absolute inset-0 z-10 h-full w-full animate-pulse bg-[#222]"
                data-testid="image-uploading-overlay"
                aria-hidden="true"
              />
            ) : (
              isSource ? (
                <button
                  type="button"
                  className="node-preview-placeholder nodrag nopan border-0 bg-transparent p-0 cursor-pointer transition-[color,transform] duration-100 hover:text-text-text-secondary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleUpload();
                  }}
                  data-tooltip={t('上传图片')}
                  aria-label={t('上传图片')}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </button>
              ) : (
                <div className="node-preview-placeholder">
                  {/* 官方实测原版占位图标：48×48 viewBox 0 0 48 48 · fill=none · 内部 g opacity=0.2 ·
                      path fill=currentColor（MTV 原来用的是自己的 mdi 描边图标，尺寸/形状/颜色都不同） */}
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'rgb(245, 245, 245)' }}>
                    <g opacity="0.2">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M31.7998 3C33.727 3 35.293 2.998 36.5606 3.10157C37.8514 3.20704 39.0084 3.43147 40.0859 3.98047C41.7794 4.84333 43.1567 6.22061 44.0195 7.91407C44.5685 8.99162 44.793 10.1486 44.8984 11.4395C45.002 12.7071 45 14.273 45 16.2002V31.7998C45 33.727 45.002 35.293 44.8984 36.5606C44.793 37.8514 44.5685 39.0084 44.0195 40.0859C43.1567 41.7794 41.7794 43.1567 40.0859 44.0195C39.0084 44.5685 37.8514 44.793 36.5606 44.8984C35.293 45.002 33.727 45 31.7998 45H16.2002C14.273 45 12.7071 45.002 11.4395 44.8984C10.1486 44.793 8.99162 44.5685 7.91407 44.0195C6.22061 43.1567 4.84333 41.7794 3.98047 40.0859C3.43147 39.0084 3.20704 37.8514 3.10157 36.5606C2.998 35.293 3 33.727 3 31.7998V16.2002C3 14.273 2.998 12.7071 3.10157 11.4395C3.20704 10.1486 3.43147 8.99162 3.98047 7.91407C4.84333 6.22061 6.22061 4.84333 7.91407 3.98047C8.99162 3.43147 10.1486 3.20704 11.4395 3.10157C12.7071 2.998 14.273 3 16.2002 3H31.7998ZM16.6064 24.0537C16.0437 23.8709 15.4378 23.871 14.875 24.0537C14.6778 24.1178 14.3958 24.2616 13.8779 24.7012C13.3422 25.156 12.6948 25.8003 11.7207 26.7744L7 31.4951V31.7998C7 33.7928 7.00173 35.1675 7.08887 36.2344C7.17411 37.2777 7.33114 37.8498 7.54492 38.2695C8.02429 39.2103 8.78967 39.9757 9.73047 40.4551C10.1502 40.6689 10.7223 40.8259 11.7656 40.9111C12.8325 40.9983 14.2072 41 16.2002 41H31.7998C32.6238 41 33.342 40.9977 33.9766 40.9912L19.7598 26.7744C18.7856 25.8003 18.1383 25.155 17.6025 24.7002C17.085 24.2609 16.8036 24.1178 16.6064 24.0537ZM16.2002 7C14.2072 7 12.8325 7.00173 11.7656 7.08887C10.7223 7.17411 10.1502 7.33114 9.73047 7.54492C8.78967 8.02429 8.02429 8.78967 7.54492 9.73047C7.33114 10.1502 7.17411 10.7223 7.08887 11.7656C7.00173 12.8325 7 14.2072 7 16.2002V25.8389L8.89258 23.9463C9.82018 23.0187 10.5998 22.2365 11.2891 21.6514C11.9961 21.0511 12.7385 20.5413 13.6377 20.249C15.004 19.8051 16.4765 19.8042 17.8428 20.248C18.742 20.5402 19.4843 21.0511 20.1914 21.6514C20.8807 22.2366 21.6612 23.0186 22.5889 23.9463L38.79 40.1484C39.4929 39.6756 40.0676 39.0301 40.4551 38.2695C40.6689 37.8498 40.8259 37.2777 40.9111 36.2344C40.9983 35.1675 41 33.7928 41 31.7998V16.2002C41 14.2072 40.9983 12.8325 40.9111 11.7656C40.8259 10.7223 40.6689 10.1502 40.4551 9.73047C39.9757 8.78967 39.2103 8.02429 38.2695 7.54492C37.8498 7.33114 37.2777 7.17411 36.2344 7.08887C35.1675 7.00173 33.7928 7 31.7998 7H16.2002ZM31 13C33.2091 13 35 14.7909 35 17C35 19.2091 33.2091 21 31 21C28.7909 21 27 19.2091 27 17C27 14.7909 28.7909 13 31 13Z"
                        fill="currentColor"
                      />
                    </g>
                  </svg>
                </div>
              )
            )}
            {/* ★ 官方**有图**上传态（逐字 · 官方 `UploadImageNode`）：`bg-background/50`（= 官方 --background
                #0f0f0f 的 50%）+ `animate-pulse`，testid `upload-image-uploading-overlay` ✓
                有图时官方是**盖在图上**（图不卸载 ✓）*/}
            {displaySrc && isUploading && (
              <div
                className="absolute inset-0 z-10 h-full w-full animate-pulse bg-[#0f0f0f]/50"
                data-testid="upload-image-uploading-overlay"
                aria-hidden="true"
              />
            )}
            {/* ★ 官方生成态（逐字 · 官方 `p && l.jsx(Eh,{nodeId:t,src:u})`）：node-loading 五层动效 ✓
                `src` 有值 → `.62` 阴影层（旧图仍在下层，官方就是靠它做「生成中」底色）✓
                空卡 → `#070708` + `.66` + `blur(4px)` ✓（官方取上游底图那段是死代码，见组件注释）*/}
            {data.status === 'loading' && <NodeLoadingAnimation src={displaySrc || undefined} />}
            {/* ComfyUI 真实进度：官方生成态**没有**进度条 → 只用 bare 把「文案 + 进度条」压在动效之上 ✓ */}
            {data.status === 'loading' && comfyGenerating && (
              <NodeGenerationProgress nodeId={id} fallbackLabel={t('生成图像中...')} bare />
            )}
          </div>
          {data.error && <NodeError nodeId={id} message={data.error} />}
          {/* ★★ 左右 `+`（add handle 按钮）：官方在**画廊打开期间**把整条连接把手收掉 ✗✓
              用户 2026：「且官方是没有 + 按钮的」。
              官方出处（运行端 chunk @3244226，图像节点 `GenerateImageNode` 传给节点外壳 `io` 的 props）：
              ```js
              l.jsx(io,{id:s,selected:t,dragging:i,data:n,…,canAcceptInput:!O,canProvideOutput:!O,…})
              ```
              这两个 false 一路传到把手组件 `_Re`（@1222713；force-hidden 的类名拼接 @1223730）：
              ```js
              const a=lu(n), f=Hg()>1, y=o&&!a, w=i&&!f&&(s||z4)&&y;
              … className: Q("node-handle-plus", …, w&&"node-handle-plus-visible",
                              f&&"node-handle-plus-force-hidden", r&&"…", !o&&"node-handle-plus-force-hidden")
              ```
              ⇒ `O`（画廊打开）⇒ `o=isConnectable=false` ⇒ 挂 `node-handle-plus-force-hidden`
                （官方 CSS：`.node-handle-plus-force-hidden{opacity:0!important;pointer-events:none!important}`）
                ⇒ 把手**留在 DOM 里但不可见、不可点**（9444 实测：展开态两个 `.node-handle-plus` 都带该类、
                   computed opacity 0 / pointer-events none；收起态换成 `node-handle-plus-visible`、opacity 1）。
              MTV 落地（同一机制、同一出现条件，只对「画廊打开的这张卡」生效）：
                ① `isConnectable={!galleryOpen}` —— 与官方 `canAcceptInput/canProvideOutput:!O` 等价；
                ② `.node.gallery-open .node-handle::after` 规则（见 styles/reactflow.css）做 force-hidden，
                   不用 `!important` 去压别的 UI。
                   ⚠️ 上一版写的是 `.gooey-btn-wrapper` —— **打错了元素**：MTV 画面上那颗 `+` 是
                      `.node-handle::after` 画的（`.node-handle .gooey-btn-wrapper` 在本文件对应的
                      CSS @386 早已 `display:none!important`）⇒ 那条规则是死规则，`+` 其实没被隐藏 ✗。
                      用户给的两张官方截图 + 9333 实测（展开态 `::after` computed opacity 仍是 1）戳穿，
                      已改成打 `::after` ✓
              ⚠️ 只在画廊打开期间隐藏：官方正常选中时是**有** `+` 的（9444 收起态实测 `node-handle-plus-visible`、
                 opacity 1）⇒ 不能一刀切。 */}
          <Handle type="source" position={Position.Left} id="left" className="node-handle handle-source handle-image" isConnectable={!galleryOpen} >
            <GooeyBtn className="gooey-btn-left" hue={142} />
          </Handle>
          <Handle type="source" position={Position.Right} id="right" className="node-handle handle-source handle-image" isConnectable={!galleryOpen} >
            <GooeyBtn className="gooey-btn-right" hue={142} />
          </Handle>
        </div>

        {(data.imageUrl || data.thumbnailUrl) && (
          /* ★ 官方出现门（`jl`=NodeToolbarLayer：`visible && !isLoading && nd(id)`；`eT` 再叠 `!isDragging`）：
             有内容 && **直接单选**（框选不算）&& 未在生成中 && 未在拖拽中 ⇒ 才渲染工具栏
             ＋ MTV：**裁剪态不显示工具条** —— 官方 `fpe` 打开浮动编辑器时会把该节点 `selected:false`，
               工具条随之消失（官方裁剪态截图里没有工具条 ✓）。MTV 不在 store 层取消选中
               （会打断派生守卫，见 ImageFloatingCropEditor.tsx 顶部注释），改在这里加一条渲染门 ✓
               ★ 用户口径（最终以此为准）：**打开任一浮动编辑器期间，卡片工具栏一律不显示** ——
                 crop / redraw / erase / outpaint / annotate 全部隐藏。
                 （9444 实测：crop/redraw/erase/outpaint 官方会把节点 `selected:false` ⇒ 工具栏本就不渲染；
                   annotate 官方仍是 `selected:1` ⇒ 官方那条工具栏还在、且与编辑器顶栏重叠 16px。
                   用户明确要求「标注时卡片本体的工具栏是不显示的」⇒ annotate 也隐藏。）
              ★★ 画廊打开期间同样不显示（官方 9444 实测：展开态节点里**没有**工具条，收起态才出现）。
                 官方出处（运行端 chunk @3246999，图像节点 `GenerateImageNode`）：
                 `l.jsx(WT,{nodeId:s,nodeTitle:v,disabled:!g,visible:!O&&!!g&&t,isLoading:x,isDragging:i})`
                 —— `O` = `isGalleryOpen` ⇒ 官方把节点自身工具条的出现门与画廊状态绑死 ⇒ MTV 补 `!galleryOpen` ✓
               ⚠️ 这里原来还传了 `className="z-10"` —— 那会把**整条工具栏子树**（含「⋯ 浏览全部」菜单）
                  钉在 z=10，而 `.node-handle`（那个 `+` 圆）是 z=15 ⇒ 把手反压菜单
                  （用户：「浏览全部弹窗没在上层，能直接看到 + 按钮」）。
                  层级已统一收到 `NodeToolbarShell` 的基类里（`z-20`），这里不再各自指定。 */
          <NodeToolbarShell visible={isDirectSingleSelection && !inPile && data.status !== 'loading' && !isCrop && redrawMode === null && !isAnnotate && !outpaintMode && !galleryOpen} isDragging={dragging}>
            <ImageNodeToolbar
              nodeId={id}
              onUpload={handleUpload}
              onMatting={handleOpenMatting}
              onErase={() => handleOpenRedraw('erase')}
              onSubjectMatting={handleSubjectMatting}
              onCameraStudio={handleOpenMultiAngle}
              onRelight={handleOpenRelight}
              onExpand={handleOpenOutpaint}
              onMultiGrid={handleMultiGrid}
              onCustomGrid={handleOpenCustomGrid}
              onCompose={handleOpenCompose}
              onCrop={handleOpenCrop}
              onFullscreen={handleOpenFullscreen}
              onAnnotate={handleOpenAnnotate}
              onUpscale={handleUpscale}
              onRepaint={handleRepaint}
              onCopyFile={handleCopyImage}
              onReversePrompt={handleReversePrompt}
              /* 官方 Pin 的 `pinnable` 门与卡片内容门同源（官方是 `data.src`）⇒ 直接把卡片的内容门传进去 */
              hasContent={!!displaySrc}
              isUpscaling={isUpscaling}
              isSubjectMattingRunning={isMattingRunning}
            />
          </NodeToolbarShell>
        )}
        {/* ★ 官方「浮动裁剪编辑器」（`dpe` crop 分支 @1322849）——**不是全屏弹窗**：
            选区层铺满卡片（官方 `w-full h-full relative overflow-visible outline-2 outline-primary/30`），
            操作条挂在卡片下方 64px（官方 `absolute -bottom-16 left-1/2 -translate-x-1/2 z-50 w-max`）。
            ⚠️ 必须挂在 `.node-preview` **之外** —— 那张卡面是 `overflow:hidden`，
               挂在里面会把 `-bottom-16` 的操作条裁掉 ✗（官方是画布层的浮层，不裁剪）。 */}
        {isCrop && displaySrc && (
          <ImageFloatingCropEditor
            nodeId={id}
            imageUrl={displaySrc}
            containerWidth={animSize?.w ?? nodeWidth}
            containerHeight={animSize?.h ?? nodeHeight}
            onCancel={handleCloseCrop}
            onStart={handleCropStart}
            onSave={handleCropSave}
          />
        )}
        {/* ★ 官方「浮动重绘编辑器」（`Fhe` 的 redraw 分支 @1340）：与裁剪编辑器同一套宿主口径 ——
            顶栏 `-top-16`、底栏 `-bottom-[130px]`、外框 `outline-2 outline-primary/30`，
            也必须挂在 `.node-preview`（overflow:hidden）之外。 */}
        {redrawMode !== null && displaySrc && (
          <ImageFloatingRedrawEditor
            nodeId={id}
            imageUrl={displaySrc}
            containerWidth={animSize?.w ?? nodeWidth}
            containerHeight={animSize?.h ?? nodeHeight}
            mode={redrawMode}
            defaultModel={data.model as string | undefined}
            onCancel={handleCloseRedraw}
            onGenerate={handleRedrawGenerate}
          />
        )}
        {/* ★ 官方「浮动扩图编辑器」（`Fhe` 的 outpaint 分支 @1341333）：同一套宿主 ——
            没有顶栏、底栏 `-bottom-[64px]`、**没有**蓝色外框（`mode!=='outpaint'` 才画 outline）；
            面板 = 安全区矩形 `{top:80,bottom:88,horizontal:72}`，取景 `fitMarginRatio:.6`。 */}
        {outpaintMode && displaySrc && (
          <ImageFloatingOutpaintEditor
            nodeId={id}
            imageUrl={displaySrc}
            containerWidth={animSize?.w ?? nodeWidth}
            containerHeight={animSize?.h ?? nodeHeight}
            defaultModel={data.model as string | undefined}
            onCancel={handleCloseOutpaint}
            onGenerate={handleOutpaintGenerate}
          />
        )}
        {/* ★ 官方「浮动标注编辑器」（`Fhe` 的 annotate 分支 @1341333）：同一套宿主 ——
            画布 `opacity: 1`、默认画笔 `#ff0000`/4、顶栏含 文本/颜色/保存、**没有底栏**。 */}
        {isAnnotate && displaySrc && (
          <ImageFloatingRedrawEditor
            nodeId={id}
            imageUrl={displaySrc}
            containerWidth={animSize?.w ?? nodeWidth}
            containerHeight={animSize?.h ?? nodeHeight}
            mode="annotate"
            defaultModel={data.model as string | undefined}
            onCancel={handleCloseAnnotate}
            onGenerate={handleRedrawGenerate}
            onSaveAnnotation={handleAnnotateSave}
          />
        )}
        {/* ★ 官方「多角度」面板（`_nt` @3074800）：**挂在卡片下方**（`top-full mt-3` = +12px）、600px 宽、
            3D 立方体 + 3 滑块 + 广角开关 + 价格 10 的生成胶囊。
            生成走 `loe({image_urls, rotate_right_left:-params.rotate_right_left, …}).send()`（官方契约）。 */}
        {isRelight && displaySrc && (
          <ImageFloatingRelightPanel
            src={displaySrc}
            parametersLocked={false}
            onClose={handleCloseRelight}
            onGenerate={handleRelightGenerate}
          />
        )}
        {isMultiAngle && displaySrc && (
          <ImageFloatingMultiAnglePanel
            src={displaySrc}
            parametersLocked={false}
            onClose={handleCloseMultiAngle}
            onGenerate={handleMultiAngleGenerate}
          />
        )}
      </div>

      {/* 编辑器覆盖层：条件挂载 —— 关闭时不实例化组件（每个 ImageNode 少跑 6 套 hooks） */}

      <Suspense fallback={null}>
        {/* Matting Editor Overlay */}
        {isMatting && (
          <MattingEditor
            isOpen={isMatting}
            imageUrl={(data.imageUrl || data.thumbnailUrl) as string}
            initialMask={data.mattingMask as string | undefined}
            onClose={handleCloseMatting}
            onSave={handleMattingSave}
          />
        )}

        {/* (官方标注已改为画布上的浮动编辑器 —— `Fhe(mode='annotate')`，见节点内 redraw 同级渲染) */}

        {/* (官方扩图已改为画布上的浮动编辑器 `ImageFloatingOutpaintEditor`，见节点内 redraw 同级渲染) */}

        {/* CustomGrid Editor */}
        {isCustomGrid && (
          <CustomGridEditor
            isOpen={isCustomGrid}
            imageUrl={(data.imageUrl || data.thumbnailUrl) as string}
            onClose={handleCloseCustomGrid}
            onConfirm={handleCustomGridConfirm}
          />
        )}
      </Suspense>

      {isCameraStudio && (
        <Suspense fallback={null}>
          <CameraStudioPanel
            isOpen={isCameraStudio}
            imageUrl={(data.imageUrl || data.thumbnailUrl) as string | undefined}
            initialMode={cameraStudioMode}
            onClose={handleCloseCameraStudio}
            onGenerate={handleCameraStudioGenerate}
          />
        </Suspense>
      )}

      {/* 多图自由编辑 / 合成（konva 懒加载，首次打开时才拉取 chunk） */}
      {isCompose && (
        <Suspense fallback={null}>
          <ImageComposerEditor
            isOpen={isCompose}
            nodeId={id}
            imageUrl={(data.imageUrl || data.thumbnailUrl) as string}
            onClose={handleCloseCompose}
            onStart={handleComposeStart}
            onSave={handleComposeSave}
          />
        </Suspense>
      )}

      {/* 官方媒体查看器（图片分支）：双击卡片 / 工具栏「全屏」都走这里
          —— 结构、几何、动效见 components/nodes/shared/media/MediaViewer.tsx */}
      <MediaViewer
        isOpen={isFullscreen && !!displaySrc}
        mediaType="image"
        entrySrc={displaySrc ?? ''}
        versions={nodeMediaVersions}
        activeSrc={viewerSrc ?? displaySrc}
        prompt={viewerPrompt}
        model={viewerVersionFacts.model || (data.model as string | undefined)}
        width={(data.imageWidth as number | undefined)}
        height={(data.imageHeight as number | undefined)}
        createdAt={viewerVersionFacts.createdAt}
        onSelectVersion={setViewerSrc}
        onClose={handleCloseFullscreen}
        actions={(
          <MediaViewerActions
            prompt={viewerPrompt}
            canSetAsMain={!!viewerSrc}
            isCurrentMain={viewerShowsCurrentMain}
            onCopyPrompt={handleViewerCopyPrompt}
            onSetAsMain={handleViewerSetAsMain}
            onDownload={() => { void handleViewerDownload(); }}
            downloading={viewerDownloading}
          />
        )}
      />

      {/* ── 超分模型下载弹窗（Portal → body）── */}
      <ModelDownloadDialog
        type="upscale"
        showPrompt={downloadPrompt}
        showDownloading={isDownloadingModel}
        onConfirm={handleDownloadConfirm}
        onCancel={handleDownloadCancel}
      />

      {/* ── 主体识别模型下载弹窗（Portal → body）── */}
      <ModelDownloadDialog
        type="matting"
        showPrompt={mattingDownloadPrompt}
        showDownloading={isDownloadingMattingModel}
        onConfirm={handleMattingDownloadConfirm}
        onCancel={handleMattingDownloadCancel}
      />
    </>
  );
}

export default memo(AIImageNode);
