/**
 * AINodeDialog AI 生成弹窗 — 点击节点后弹出的浮动面板，包含 Prompt 输入、模型选择、参数配置、生成按钮
 */
import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
// 生成中的流光边框：仅在生成时按需加载
const BorderBeam = lazy(() => import('border-beam').then((m) => ({ default: m.BorderBeam })));
import { convertFileSrc } from '@tauri-apps/api/core';
import { useShallow } from 'zustand/react/shallow';
import { generateId, useAppStore } from '../../store/useAppStore';
import { absoluteNodePosition } from '../../store/store.nodes';
import { derivedNodePlacement } from '../../store/store.utils';
import { buildPileIndex } from '../../utils/officialPile';
import type { AnimationAction, BaseNodeData, CameraGenerationSettings, ImagePostProcess, ModelOption } from '../../types';
import { ANIMATION_FRAME_GRIDS } from '../../types';
import { generateShotlistRows } from '../../services/shotlistService';
import { MAX_IMAGE_BATCH_COUNT, type AudioSpeechSettings, type AudioSpeechReference, type AudioOutputFormat, type AudioTtsVoice, type VideoReferenceItem } from '../../types/aiTypes';
import { resolveTextTimes } from '../../utils/textVariants';
import { prepareTextVariantNodes } from '../../services/textVariantService';
import { runBatchTasks } from '../../services/ai/batchUtils';
import { generateText, generateImage, generateImagesBatch, generateVideo, generateAudio, buildPanoramaPrompt } from '../../services/aiService';
import { removeAudioSpeechReference } from '../../services/ai/audioSpeechSettings';
import { persistAudioGenerationResult } from '../../services/ai/generateAudio';
import { persistMediaUrlToProjectData } from '../../services/fileService';
import {
  applyImageBatchResults,
  failImageBatchNodes,
  prepareImageBatchNodes,
  readBatchResultLayout,
} from '../../services/imageBatchService';
import { createCharacterDirectionGrid } from '../../services/onnxService';
import PromptPanel from './shared/PromptPanel';
import type { MentionEditorHandle } from './shared/MentionEditor';
import { findMediaModelOption } from './shared/defaultModels';
import {
  CANVAS_PAN_DURATION_MS,
  requestCanvasPanBy,
} from '../../services/canvasViewportService';
import {
  getImageNodeDimensionsForAspectRatio,
  resolveProjectGenerationPrompt,
} from '../../services/projectSettingsService';
import {
  buildAnimationSpritePrompt,
  resolveAnimationSheetAspectRatio,
} from '../../services/ai/animationPrompt';
import { resolveVideoSubmissionControls } from '../../services/ai/videoRequestResolver';
import { buildGenerationCameraPrompt } from './shared/image/cameraStudio';
import { cancelComfyUINodeTask } from '../../services/comfyWorkflowService';
import { getPendingTasksForProject, resumeComfyUINodeTask, resumeRunningHubNodeTask, updatePendingTask, removePendingTask } from '../../services/pollManager';
import { isCloudWorkflow, getCloudWorkflowPersistedOutput, workflowExecution } from '../../services/workflowExecutionService';
import { completeWorkflowApiNodeTask, stopWorkflowApiNodeTask } from '../../services/workflowApi/workflowApiAdapter';
import WorkflowApiTaskStatus from './shared/WorkflowApiTaskStatus';
import { cancelRunningHubNodeTask, completeRunningHubNodeTask } from '../../services/ai/providers/runninghubWorkflow';
import { completeCanvasDerivation, isCanvasDerivationFresh, registerCanvasDerivation } from '../../services/canvasDerivationGuard';
import { useT } from '../../i18n';
/* §69 官方「生成方式」：载体 = 节点 `data.params.modelType`（官方 `zt` 枚举字符串）
   + `data.params.variant`（目录 `variants[].key`）。读出/写入/选项表全部走目录表逐字移植。 */
import {
  currentVariantModelType,
  getParamEntry,
  methodKeyOfModelType,
  videoMethodKeys,
  videoVariantForMethod,
  videoVariantForModel,
  type VideoInputCounts,
  type VideoMethodKey,
} from '../../services/ai/modelParamCatalog';
import { imageModelAliases } from '../../utils/imageNodeDefaults';
/* §71 官方 `LXe` 的 `parentCounts`（上游连线素材计数）：`_p`/`x9` 挑 variant 的**输入感知**输入。
   官方三段：`Cee`(@1044905 入边 source) → `Ac`(@1045039 父节点) → `vu`(@731952 purpose 过滤)
   → `Sc`(@810176 按类型计数)。MTV 同源实现在 `utils/referenceTokens.ts`。 */
import { collectParentReferenceCounts } from '../../utils/referenceTokens';
import { setFrameSlot } from '../../utils/videoFrames';
/* §131 官方 `nt` 的画布选图状态机（MTV 等价物 = `store.nodeSelection`）。 */
import { useNodeSelectionStore } from '../../store/store.nodeSelection';
import { GENERATION_INPUT_BAR_TESTID } from './shared/video/officialVideoTestIds';

const DIALOG_VIEWPORT_MARGIN = 16;

/**
 * ★★ **官方真值（实测 + 类名铁证）—— 编辑区是「跟随画布缩放」的** ✗
 *   官方面板类名：`node-float-ui generation-input-bar-width-transition nodrag cursor-default
 *                 **absolute -bottom-2** z-20 w-full …`
 *     → `absolute` + Tailwind `-bottom-2` = `bottom: -8px`，**写在节点坐标系里** ✓
 *     → 即 **流坐标** ✓ → **间距随 zoom 缩放** ✓✓
 *   官方实测（zoom 2.0）：面板 屏显 680×207 = **流 340×103** ✓ · 间距 屏显 16 = **流 8** ✓
 *
 *   ⚠️ 原先注释（"固定屏幕 680×199、下方固定 24 屏幕像素、不随缩放"）是**错误假设** ✗
 *      那两次观测把「面板自己固定成 680」当成了官方行为（自证循环 ✗）
 *   → 现按官方：**面板流宽 340 · 流间距 8**，屏幕值 = 流值 × zoom ✓
 */
/* ★★★★★ **官方源码 + 官方实测：视觉间距 = 12 流** ✓✓（用户："间距也不对劲" ✓）
   官方**源码原文**（EXE ✓ 4 处完全一致 ✓）：
     外层: className="… **absolute -bottom-2** z-20 … **node-float-ui-visible**"
           style={{ left:"50%", **"--float-y":"100%"**, "--float-offset":"-12px", transformOrigin:"top center" }}
      内层: className="bg-card rounded-2xl border border-border shadow-lg **mt-2** w-full relative"
     CSS: `.node-float-ui-visible { transform: translate(-50%) translateY(var(--float-y)) scale(var(--float-scale)) }`
   ⚠️ `--float-offset` 在官方 CSS 里**根本没被消费** ✗（死变量 ✓ 只有 `--float-y` 生效 ✓）
   → 真正的间距 = 外层 `-bottom-2`(8) + 内层 **`mt-2`(8)** ✓
   官方**实测**（同一次 dump ✓ 权威 ✓）：
     卡片底 屏885 · zoom 2
       外层 .node-float-ui 顶 = 屏901 → 间距 **16 屏 = 8.00 流** ✓
     ★ 内层 .bg-card 顶    = 屏909 → **视觉间距 24 屏 = 12.00 流** ✓✓ ← **用户看到的**
       内层 `mt-2` 的 8px 在外层坐标系里 ✓ × `--float-scale`(0.5) = **4 流** ✓ → 8+4 = **12** ✓✓ 吻合 ✓
   → MTV 的面板是**单层** ✗（没有内层 `mt-2` ✗）→ 直接把间距设成 **8 + 4 = 12 流** ✓（等价 ✓）*/
/* ⚠️⚠️ 上面这段旧推导**只在 zoom = 2 时成立**（8 + 8/2 = 12 巧合）✗
   t1098 重新实测（zoom 1.63982）：官方**视觉间距 = 8×zoom + 8**，即
     ① 外层 `-bottom-2` = 8 流 ⇒ 屏幕 8×zoom = 13.12 ✓
     ② 内层 `mt-2` = 8px 在外层坐标系里、而 `--float-scale = 1/zoom` 与画布缩放抵消 ⇒ 净 8 屏幕 ✓
     ⇒ 屏幕 21.12 = 8×zoom+8 ✓ · 流坐标 8 + 8/zoom = 12.88（不是恒定 12）✓
   旧结论「12 流」在 zoom=1 时会少 4 屏、zoom≠2 时都有偏差 ⇒ 已按官方两段公式改 ✓ */

const DIALOG_GAP_OUTER_FLOW = 8;
const DIALOG_GAP_INNER_SCREEN = 8;

/** 官方视觉间距（**屏幕像素**）= `8 × zoom + 8`（t1098 实测 21.12 屏 @ zoom 1.63982 ✓） */
function dialogGapScreen(zoom: number): number {
  return DIALOG_GAP_OUTER_FLOW * zoom + DIALOG_GAP_INNER_SCREEN;
}

/** 官方视觉间距（**流坐标**）= `8 + 8 / zoom`（预览层那条 2× 流坐标 + 0.5 scale 的算法要流值） */
function dialogGapFlow(zoom: number): number {
  return DIALOG_GAP_OUTER_FLOW + DIALOG_GAP_INNER_SCREEN / zoom;
}

/**
 * ★★★★★ **官方底部编辑框的「可见性门」（`zoom-slider-3ZcFvYQO.js` @1691826 逐字）** ✓✓
 * ```js
 * const fe = Fg();                      // ← 选中数
 * const R  = Ui(s)?.data?.hide_inputbar === true;
 * const pe = fe <= 1 && !R;             // ← 多选（≥2）时**整条不渲染**
 * const le = pe && n && !I && !B;       // n=visible(两处调用都恒传 !0) · I=isAnyNodeDragging · B=inProgress
 * … className: Z("node-float-ui generation-input-bar-width-transition nodrag cursor-default
 *                absolute -bottom-2 z-20 …", le ? "node-float-ui-visible" : "node-float-ui-hidden")
 * ```
 * 官方 CSS（`zoom-slider-B3yfHu80.css` @59973 逐字）：
 *   `.node-float-ui-visible{opacity:1;transform:translate(-50%) translateY(var(--float-y,0%)) scale(var(--float-scale,1));pointer-events:auto}`
 *   `.node-float-ui-hidden{display:none}`
 *
 * 官方**实测**（t1074 + t1076，两窗口都是我实测的）：
 *   · 点「有图 / 无图」的卡 → 条都出现（**与卡里有没有产物无关** ✓）
 *   · 点空白清空选择 → 条**仍在**（官方不随选择清空而收 ✓ 与 `fe<=1` 相符：0 选也算 ≤1）
 *   · 换成点另一张卡 → 旧卡那条消失、新卡那条出现（同一时刻**只有一条** ✓）
 *   · **多选（≥2）→ 条消失**，画布交给「打组工具栏 + 选区灰底白 +」✓（用户图 1/图 2 的现象）
 * ⇒ MTV：`selectedNodeIds.length > 1` 时给面板挂官方的 `node-float-ui-hidden`（`display:none`），
 *    并且**保持 `activeNodeId` 不变** —— 官方也是「藏起来」而不是「关掉」：选择掉回 1 个时条自己回来 ✓
 */
const OFFICIAL_BAR_VISIBLE_CLASS = 'node-float-ui-visible';
const OFFICIAL_BAR_HIDDEN_CLASS = 'node-float-ui-hidden';
/* ⚠️ 官方流宽是 **340** ✓（面板 `w-full`、是节点的子元素 ✓）
   但 MTV 的面板是 **fixed 浮层且内部按 680px 屏幕布局** ✗ → **不能直接套用 340** ✗
   （我试过改成 340 + scale(zoom) ✗ → 内部挤压、"4:3/2K"折行、"选择模型"被压 ✓ 用户截图 ✓）
   此处**暂不设宽度** ✓，保持 CSS 里的固定屏幕尺寸 ✓；将来若要把面板做成"跟画布缩放"，
   需要先把面板内部所有尺寸改成流坐标 ✓（等于按官方重写面板布局 ✓）*/

/** 读当前画布 zoom（**只用于面板的初始定位**；逐帧跟随走 viewport-change 事件里的 detail.zoom ✓）。
 *  官方：面板是节点子元素、跟着画布缩放 ✓ → 间距 = 8 流 × zoom ✓ */
function currentCanvasZoom(): number {
  const vp = document.querySelector('.react-flow__viewport');
  if (!vp) return 1;
  const m = getComputedStyle(vp).transform;
  if (m.startsWith('matrix')) {
    const z = Number.parseFloat(m.slice(7, -1).split(',')[0]);
    return Number.isFinite(z) && z > 0 ? z : 1;
  }
  return 1;
}

function AINodeDialog() {
  const t = useT();
  const { activeNodeId, dialogPosition, closeNodeDialog, updateNodeData, updateNodeDataTransient, commitToHistory, recordOutputHistory, showToast, workflows, currentProjectId } = useAppStore(
    useShallow((s) => ({
      activeNodeId: s.activeNodeId,
      dialogPosition: s.dialogPosition,
      closeNodeDialog: s.closeNodeDialog,
      updateNodeData: s.updateNodeData,
      updateNodeDataTransient: s.updateNodeDataTransient,
      commitToHistory: s.commitToHistory,
      recordOutputHistory: s.recordOutputHistory,
      showToast: s.showToast,
      workflows: s.workflows,
      currentProjectId: s.currentProjectId,
    })),
  );

  // 仅订阅当前激活的节点（而非整个 nodes 数组），拖拽其他节点时不会触发本弹窗重渲染
  const node = useAppStore((s) => (s.activeNodeId ? s.nodes.find((n) => n.id === s.activeNodeId) : undefined));
  /* 官方 `fe <= 1`：**多选（≥2）时底部编辑框整条隐藏**（此时画布只留打组工具栏 + 选区 `+`） */
  const multiSelected = useAppStore((s) => s.selectedNodeIds.length > 1);
  /* 官方 `I = isAnyNodeDragging`：**拖节点时也隐藏**（`le` 里必须 `!I`） */
  const anyNodeDragging = useAppStore((s) => s.canvasNodeDragging === true);
  /**
   * ★★ 官方：**折叠变体画廊展开期间，整条底部编辑区「不渲染」**（用户 2026：「按照官方的来」）。
   * 9444 实测（同一张画布，官方图像节点）：
   *   · 画廊**收起**（节点选中）：`.node-float-ui` 存在 1 个 → class 含 `node-float-ui-visible`、
   *     box [505,947,680,207]、display block / opacity 1 / pointer-events auto；
   *   · 画廊**展开**（点药丸后）：`document.querySelectorAll('.node-float-ui').length === 0`
   *     —— 整条从 DOM 里消失（连里面的 ProseMirror 编辑区一起）。
   *
   * 官方出处（运行端 chunk `tapnow://app/assets/course-api-base-url-0D9Dk52r.js`，0.4.81，0-based 偏移）：
   * ① 图像节点把它挂在自己的浮层 `uu`（= NodeFloatingLayer，`AnimatePresence` 关闭即卸载）里，@3247045 逐字：
   *    ```js
   *    l.jsx(uu,{visible:k&&!O, isDragging:i,
   *               children: l.jsx(ete,{nodeId:s,visible:!0,isGenerating:x,isReadonly:c})})
   *    ```
   *    `O` = 该组件的 `isGalleryOpen`（解构处 @3242219 `…,isGalleryOpen:O,…`），
   *    `k` = 「这条卡该不该有编辑条」（`(p||u) && !(multi-angle|relight|resize|world-creation)`）
   *    ⇒ 画廊打开 ⇒ 浮层 `visible=false` ⇒ **整条（含 `.node-float-ui`）卸载** ✓
   * ② 编辑条自身组件 `Ex`（@1711035）里那条 `le` **不含画廊项**，只含：
   *    ```js
   *    ye = ie<=1 && !V;          // ie=Hg() 选中数 · V=data.hide_inputbar
   *    le = ye && n && !O && !R;  // n=visible · O=isDragging · R=inProgress
   *    if(!ye) return;            // 多选/hide_inputbar ⇒ 整条不渲染
   *    ```
   *    —— 也就是画廊那条门**在节点层**（①），不在条自身（②）⇒ MTV 按①补：只对
   *    「画廊正开着的那张卡」生效（`galleryNodeId === activeNodeId`）。
   *
   * ⚠️ MTV 落地取舍：MTV 的条是**全局 fixed 浮层**（`activeNodeId` 驱动、位置由 JS 逐帧写），
   *   unmount/remount 会丢命令式写进去的 `style.transform`（定位 effect 的依赖是
   *   `[activeNodeId, isExpanded]`，画廊开关不改这两个）⇒ 回来时可能落在错位置。
   *   ⇒ 沿用本文件既有的官方机制（`multiSelected` / `anyNodeDragging` / `hiddenInPile` 同一套）：
   *     挂官方 `.node-float-ui-hidden{display:none}`（**不可见、不可点、不参与布局**），
   *     `activeNodeId` 不动 ⇒ 画廊一收起，条**原地自己回来**（含原有定位）✓
   *   ⚠️ 只在画廊打开期间收：正常选中/悬浮时照旧出现，不一刀切 ✓
   */
  const galleryOpenHere = useAppStore((s) => s.galleryNodeId !== null && s.galleryNodeId === s.activeNodeId);
  /**
   * ★ 官方：**堆叠（PILE）状态不出现底部编辑区**（用户实测反馈）。
   *
   * 官方这条编辑条是**节点自己的子元素**（见文件头 `pe`/`le` 记账：面板 `w-full`、跟着节点走），
   * 而官方堆叠节点（`uJe`）**根本不渲染它** —— 点堆叠卡的语义是「进入全屏堆叠画廊」
   * （官方 `uJe` 的 `ne` → `openGallery`），不是编辑单个节点。
   * MTV 的编辑条是**全局浮层**（`activeNodeId` 驱动），没有这层「节点自己有没有条」的结构约束
   * ⇒ 必须把官方的排除语义显式补上，覆盖两条路径：
   *   ① 激活节点**本身是堆叠**（点堆叠卡）；
   *   ② 激活节点**已被收进某个堆叠** —— 官方把成员投影成 `.pile-member-anchor`
   *      （`pointer-events:none!important; opacity:0!important`）⇒ 成员自己那条也看不见。
   * 用官方 `qa` 的索引（`buildPileIndex` ⇒ `pileIdByNodeId`）判断，与堆叠投影同一份口径 ✓
   */
  const hiddenInPile = useAppStore((s) => {
    const activeId = s.activeNodeId;
    if (!activeId) return false;
    const active = s.nodes.find((n) => n.id === activeId);
    if (!active) return false;
    if (active.type === 'pile') return true;
    return buildPileIndex(s.nodes as never).pileIdByNodeId.has(activeId);
  });
  const performanceMode = useAppStore((s) => s.config.performanceMode === true);
  const data: BaseNodeData | undefined = node?.data;
  const nodeType = data?.type;

  /* §71 官方 `LXe`（canvas:@1991414）的 `parentCounts` = 上游连线素材计数，
     是 `_p`/`x9` 挑 variant 的**输入感知**入参（官方 `CQe`@2037060 / 面板@2074414 都吃它）。
     · `parentCountsRef`：在 effect 里随「本节点是否有入边」刷新（连线增删必然重渲染），
       给 `useCallback` 里那些**零依赖**的调用点（`onModelSelect`，与它一起现读
       `currentParams` 是同一口径）读用 —— 不能在渲染期写 ref（React 的 `react-hooks/refs`）。
     · `onGenerateMethodChange` 不走 ref：它的依赖数组能安全列入 `readParentCounts`。 */
  const hasUpstreamEdges = useAppStore((s) => (
    activeNodeId ? s.edges.some((edge) => edge.target === activeNodeId) : false
  ));
  const readParentCounts = useCallback(() => {
    if (!activeNodeId) return { imageCount: 0, videoCount: 0, audioCount: 0 };
    const state = useAppStore.getState();
    return collectParentReferenceCounts(activeNodeId, state.edges ?? [], state.nodes);
  }, [activeNodeId]);
  const parentCountsRef = useRef<VideoInputCounts>({ imageCount: 0, videoCount: 0, audioCount: 0 });
  useEffect(() => {
    parentCountsRef.current = readParentCounts();
    /* ⚠️ `hasUpstreamEdges` 必须留在依赖里：只订阅布尔是因为「边的对象引用」每次拖拽都在变，
       而这个 effect 只需要在「本节点的入边有无变化」时重算一次计数。 */
  }, [readParentCounts, hasUpstreamEdges]);

  const panelRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const cancellingNodeIdsRef = useRef(new Set<string>());
  const [isExpanded, setIsExpanded] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState({ nodeId: '', taskId: '', confirmed: false });

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const preview = previewRef.current;
    if (!panel || !activeNodeId || isExpanded) return;

    let scheduledFrame = 0;
    let settleTimer = 0;
    let releaseTransitionFrame = 0;
    let adjustmentLocked = false;
    let disposed = false;
    let trackedNodeElement: HTMLElement | null = null;

    // 浮层与节点的纵向偏移 — 官方两段公式：**屏幕间距 = 8×zoom + 8**（见文件头 t1098 实测）。
    // （MTV 原来对空节点用 −20px「盖住卡片」，那会让面板压进卡片，看起来像两个面板重叠。）
    const computeVerticalOffset = () => dialogGapScreen(currentCanvasZoom());

    const positionDialog = (anchor: { x: number; y: number }, _nodeHasMedia: boolean) => {
      const offsetY = computeVerticalOffset();
      panel.style.left = `${anchor.x}px`;
      panel.style.top = `${anchor.y + offsetY}px`;
      if (preview) {
        preview.style.left = `${anchor.x}px`;
        preview.style.top = `${anchor.y + offsetY - 42}px`;
      }
    };

    const readNodeHasMedia = (): boolean => {
      if (!activeNodeId) return false;
      const latestData = useAppStore.getState().nodes.find((n) => n.id === activeNodeId)?.data as BaseNodeData | undefined;
      return !!(
        latestData?.imageUrl || latestData?.thumbnailUrl ||
        latestData?.videoUrl || latestData?.audioUrl
      );
    };

    const syncDialogToNode = () => {
      if (!trackedNodeElement?.isConnected) {
        trackedNodeElement = document.querySelector<HTMLElement>(
          `.react-flow__node[data-id="${activeNodeId}"]`,
        );
      }
      const nodeRect = trackedNodeElement?.getBoundingClientRect();
      if (!nodeRect) return null;

      const anchor = {
        x: nodeRect.left + nodeRect.width / 2,
        y: nodeRect.bottom,
      };
      positionDialog(anchor, readNodeHasMedia());
      return anchor;
    };

    const panCanvasWithDialog = (deltaX: number, deltaY: number, duration: number) => {
      cancelAnimationFrame(releaseTransitionFrame);
      /* ⚠️ 这里原来写 `panel.style.transition = 'none'` ✗ —— 会**内联压掉官方的宽度过渡** ✗✓
         （`.ai-dialog-float` 的基础 CSS 本来就是 `transition: none`，
           官方的 `.generation-input-bar-width-transition…` 只额外过渡 width/min-width/max-width）
         ⇒ 位置跟随照样瞬时，而宽度过渡恢复 ✓（`preview` 是另一个元素，保留原样 ✓）*/
      if (preview) preview.style.transition = 'none';
      const startAnchor = syncDialogToNode();
      if (!startAnchor) {
        adjustmentLocked = false;
        preview?.style.removeProperty('transition');
        return;
      }

      // 平移过程中也要按节点当前是否有内容来决定偏移，否则空节点和有内容节点之间会跳变
      const nodeHasMediaDuringPan = readNodeHasMedia();
      requestCanvasPanBy({
        deltaX,
        deltaY,
        duration,
        onProgress: (progress) => {
          if (disposed) return;
          positionDialog({
            x: startAnchor.x + progress.deltaX,
            y: startAnchor.y + progress.deltaY,
          }, nodeHasMediaDuringPan);
        },
        onComplete: (progress) => {
          if (disposed) return;
          const finalAnchor = {
            x: startAnchor.x + progress.deltaX,
            y: startAnchor.y + progress.deltaY,
          };
          positionDialog(finalAnchor, nodeHasMediaDuringPan);
          useAppStore.getState().openNodeDialog(activeNodeId, finalAnchor);
          releaseTransitionFrame = requestAnimationFrame(() => {
            preview?.style.removeProperty('transition');
            adjustmentLocked = false;
            scheduleUpdate();
          });
        },
      });
    };

    const revealDialog = () => {
      if (adjustmentLocked) return;

      /* ★★ 用户 2026 报的 bug：「多变体状态下点卡片右上角那个数字 2（变体药丸）⇒ 画廊一展开
         **整张卡和画布就向右下小角度移一下**；收回就不动」。
         根因就在这里：点药丸 ⇒ 画廊展开 ⇒ 底部编辑条按**官方语义整条不挂载**（上面
         `if (galleryOpenHere && !isExpanded) return null`）。但本 effect 的依赖只有
         `[activeNodeId, isExpanded]`（不变）⇒ 闭包里这个 `panel` 元素已经**脱离文档**，
         `getBoundingClientRect()` 变成 **0×0、位置 (0,0)** ⇒ 下面「贴边」判断算出
         `deltaX = safeLeft - 0`、`deltaY = safeTop - 0`（= 视口 margin，实测 31~32px）
         ⇒ `panCanvasWithDialog` 把**整块画布向右下平移 32px**（卡片跟着走，故用户看到卡也动）。
         已经卸载的浮条**没有任何位置需要救** ⇒ 直接返回。
         （`isConnected` + 0 尺寸两道门：前者对付「已移除」，后者对付「还在 DOM 但被 display:none/塌陷」。） */
      if (!panel.isConnected) return;
      const panelRect = panel.getBoundingClientRect();
      if (panelRect.width < 1 || panelRect.height < 1) return;
      const visualViewport = window.visualViewport;
      const appRect = panel.closest<HTMLElement>('.app-box')?.getBoundingClientRect();
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportRight = viewportLeft + (visualViewport?.width ?? window.innerWidth);
      const viewportBottom = viewportTop + (visualViewport?.height ?? window.innerHeight);
      const safeLeft = Math.max(viewportLeft, appRect?.left ?? viewportLeft) + DIALOG_VIEWPORT_MARGIN;
      const safeTop = Math.max(viewportTop, appRect?.top ?? viewportTop) + DIALOG_VIEWPORT_MARGIN;
      const safeRight = Math.min(viewportRight, appRect?.right ?? viewportRight) - DIALOG_VIEWPORT_MARGIN;
      const safeBottom = Math.min(viewportBottom, appRect?.bottom ?? viewportBottom) - DIALOG_VIEWPORT_MARGIN;
      const availableWidth = safeRight - safeLeft;
      const availableHeight = safeBottom - safeTop;
      let deltaX = 0;
      let deltaY = 0;

      if (panelRect.width <= availableWidth) {
        if (panelRect.left < safeLeft) deltaX = safeLeft - panelRect.left;
        else if (panelRect.right > safeRight) deltaX = safeRight - panelRect.right;
      }
      if (panelRect.height <= availableHeight) {
        if (panelRect.top < safeTop) deltaY = safeTop - panelRect.top;
        else if (panelRect.bottom > safeBottom) deltaY = safeBottom - panelRect.bottom;
      }

      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = reduceMotion ? 0 : CANVAS_PAN_DURATION_MS;
      adjustmentLocked = true;
      panCanvasWithDialog(deltaX, deltaY, duration);
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(scheduledFrame);
      scheduledFrame = requestAnimationFrame(revealDialog);
    };
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(panel);
    const appBox = panel.closest<HTMLElement>('.app-box');
    if (appBox) observer.observe(appBox);
    scheduleUpdate();
    settleTimer = window.setTimeout(scheduleUpdate, CANVAS_PAN_DURATION_MS);
    window.addEventListener('resize', scheduleUpdate);
    window.visualViewport?.addEventListener('resize', scheduleUpdate);

    return () => {
      disposed = true;
      cancelAnimationFrame(scheduledFrame);
      cancelAnimationFrame(releaseTransitionFrame);
      window.clearTimeout(settleTimer);
      panel.style.removeProperty('transition');
      preview?.style.removeProperty('transition');
      observer.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
    };
  }, [activeNodeId, isExpanded]);

  // 节点尺寸变化时，重新计算浮动面板位置，使其跟随节点平滑移动
  useEffect(() => {
    if (!activeNodeId || isExpanded) return;
    const el = document.querySelector(`.react-flow__node[data-id="${activeNodeId}"]`);
    if (!el) return;

    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      useAppStore.getState().openNodeDialog(activeNodeId, { x: rect.left + rect.width / 2, y: rect.bottom });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeNodeId, isExpanded]);

  // 画布平移/缩放时重算锚点 —— zoom 是 transform:scale()，节点的 layout 尺寸不变，
  // 上面的 ResizeObserver 收不到通知，所以靠 Canvas 广播的 viewport-change 事件补上。
  //
  // ⚠️ 这里**只直接写 DOM，绝不能调用 openNodeDialog()（zustand 写入）**：
  //     那会在缩放的每一帧触发 React 重渲染整个面板 → 明显卡顿（实测踩过）。
  //     直接写 style.left/top 与组件内联样式同源，重渲染时也会得到同样的值，不会打架。
  /* ★★★★ **统一的位置写入函数（方案 A：与官方 1:1 同步）** ✓
     官方：编辑面板是**节点的子元素** ✓ → 跟着画布 transform **同一帧**缩放 ✓
          实测：面板 **340 流宽** ✓（zoom 2 时屏显 680 ✓）· 间距 **15 流** ✓
     MTV ：内部布局是 **680px** ✗ → 用 `scale(zoom × 0.5)` 把它折算成 **340 × zoom 屏幕** ✓✓
           = 与官方**完全等价** ✓ 且**不动内部布局** ✓

     一个 transform 完成四件事（从右往左生效 ✓）：
       ① translateX(-50%)          布局空间里 -340 → 水平居中 ✓
       ② translate(flowX*2, flowY*2) 布局空间是 680 基准 → 流坐标 ×2 ✓
       ③ scale(zoom * 0.5)         680 布局 → 340×zoom 屏幕 ✓（= 官方 340 流 ✓）
       ④ translate(origin + v)     屏幕原点 ✓
     最终屏幕位置 = origin + v + 流坐标 × zoom ✓✓ 与画布**逐像素同源** ✓
     ★ 只用 **transform**（合成层 ✓ 零重排 ✓）—— 原来写 left/top 会触发重排 ✗
       表现就是：间距看起来会变 ✗ 动画偏移 ✗ 上传按钮被带得卡顿 ✗（用户反馈 ✓）*/
  const viewportRef = useRef<{ zoom: number; x: number; y: number; left: number; top: number } | null>(null);
  /* ★★★★ **读实时 viewport + 兼容 `matrix` / `matrix3d`** ✓✓
     为什么还要读 ✗：面板目前**仍未 portal 进画布** ✓（`position: fixed` ✓）
       → 必须自己算屏幕坐标 ✓ → 需要 zoom / 偏移 ✓
     ⚠️ 事故记录（**务必保留**）：
       ① 曾只按 **6 值**解析 ✗ → **WebView2 返回 `matrix3d`（16 值）** ✗ → zoom 算错/为 1 ✗
          → `scale(zoom×0.5)` 恒 0.5 ✗ → **面板固定 340px 不跟随** ✓✓（= 用户报的现象 ✓）
       ② 曾误删 zoom 乘数（以为 portal 已生效 ✗）→ **同样固定 340** ✓（本地实测复现 ✓）
     → 本函数必须兼容两种 matrix ✓ 且 transform 里**必须带 zoom** ✓ */
  const readLiveViewport = useCallback(() => {
    const vpEl = document.querySelector('.react-flow__viewport');
    const flowEl = document.querySelector('.react-flow');
    if (!vpEl || !flowEl) return viewportRef.current;
    const m = getComputedStyle(vpEl).transform;
    let zoom = 1; let x = 0; let y = 0;
    if (m.startsWith('matrix')) {
      const p = m.slice(m.indexOf('(') + 1, -1).split(',').map(Number);
      if (Number.isFinite(p[0]) && p[0] > 0) zoom = p[0];
      const is3d = m.startsWith('matrix3d');
      const ix = is3d ? 12 : 4;
      const iy = is3d ? 13 : 5;
      if (Number.isFinite(p[ix])) x = p[ix];
      if (Number.isFinite(p[iy])) y = p[iy];
    }
    const r = flowEl.getBoundingClientRect();
    const next = { zoom, x, y, left: r.left, top: r.top };
    viewportRef.current = next;
    return next;
  }, []);
  const applyDialogTransform = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || !activeNodeId) return;
    const vp = readLiveViewport();
    if (!vp) return;
    /* ★★★★★ **位置与尺寸全部取自节点元素的实时 rect** ✓✓（同源 ✓ 彻底避开不一致 ✓）
       事故（在用户 Tauri 窗口实测 ✓ 权威 ✓）：
         我上一轮把**尺寸**改成读实时 rect ✓ 但**位置**仍用 store 的流坐标 ✗
         → **两者不同源** ✗✓ → 实测面板跑到卡片**上方 128.53 流** ✗（应 +8 ✓）
         → panel transform = translate(2252.79, 147.6) translate(**-783.3**, 670.4)
              ← `flowX = -516` ✗ 而卡片实际中心在别处 ✗
       现在：**中心 X 与底边 Y 都从同一个 rect 直接算** ✓✓
         面板屏幕位置 = (rect.left + rect.width/2, rect.bottom + 8 × zoom) ✓
         → 不需要 flow 坐标 ✓ 不需要读 store ✓ **永不失配** ✓✓
       ⚠️ 读 rect 只在「节点/画布有变化时」发生 ✓（由 MutationObserver / ResizeObserver /
          viewport 变化驱动 ✓）**不是逐帧** ✓ → 不会触发注释里那个 1917ms 的 layout thrashing ✓ */
    const nodeEl = document.querySelector(`.react-flow__node[data-id="${activeNodeId}"]`);
    if (!(nodeEl instanceof HTMLElement)) return;
    const rect = nodeEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    /* 屏幕坐标直接用 ✓（rect 本身就是屏幕值 ✓）*/
    const anchorX = rect.left + rect.width / 2;
    const anchorY = rect.bottom + dialogGapScreen(vp.zoom);
    /* ⚠️ 这里原来写 `panel.style.transition = 'none'` 且**从不清理** ✗✓
       —— 实测它把官方的宽度过渡**永久压掉**（`getComputedStyle.panel.transitionProperty`
          返回 `none`，官方是 `width, min-width, max-width`，t1090/t1091）。
       现在不写：`.ai-dialog-float` 基础 CSS 已是 `transition: none`（位置跟随天然瞬时 ✓），
       宽度过渡交给官方那条 `.generation-input-bar-width-transition` 规则 ✓ */
    panel.style.left = '0px';
    panel.style.top = '0px';
    /* 官方 `transformOrigin:"top center"`（@1691826 逐字；它那边配合 `scale(--float-scale)` 用 ✓）
       MTV 的 transform 是纯 translate ⇒ origin 无几何影响，照抄官方保持一致 ✓ */
    panel.style.transformOrigin = 'top center';
    /* ★★★★★ **修定：scale 恒为 1，面板屏幕尺寸不随画布缩放变化** ✓✓
       官方 CSS 原文（`zoom-slider-B3yfHu80.css` ✓）：
         `.node-float-ui-visible { transform: translate(-50%)
              translateY(var(--float-y, 0%)) scale(var(--float-scale, 1)) }`
         `--float-scale = **1 / zoom**`（EXE: `function xB(e){return 1/I7(e)}` ✓ 由 `Sh()` 逐帧写 ✓）
       → 在**画布内**的元素上乘 `1/zoom` = **抵消画布缩放** ✓
       → 官方**实测**（我量的 ✓）：
           zoom 0.9202 → 面板屏显 **680×207** ✓   --float-scale = 1.0867
           zoom 0.5586 → 面板屏显 **680×207** ✓   --float-scale = 1.7901
           zoom 0.2643 → 面板屏显 **680×207** ✓   --float-scale = 3.7842
         ★ 三档**完全恒定 680×207** ✓✓ —— **面板屏幕尺寸不随缩放变化** ✓
       → 用户实测："缩小画布时面板**相应变大**，慢慢恢复时慢慢恢复" ✓✓
            = 卡片变小了而面板没变（**相对**变大 ✓）+ 官方的 width 过渡 ✓
       MTV：内部布局就是 **680px** ✓ → 屏幕尺寸 = 680 × **scale(1)** ✓（**不带 zoom** ✗✓）
           原来写 `scale(zoom × 0.5)` ✗ → 跟着画布缩小 ✗ **方向与官方相反** ✓✓ */
    /* ★ 位置 = **卡片实时 rect 的中心 X / 底边 Y + 8×zoom** ✓✓（屏幕坐标直给 ✓ 不再换算流坐标 ✓）
       `translate(-50%)` 做水平居中 ✓（面板 680 宽 → 左移 340 ✓）*/
    panel.style.transform =
      `translate(${anchorX}px, ${anchorY}px)`
      + ' translateX(-50%)';
    const preview = previewRef.current;
    if (preview) {
      preview.style.transition = 'none';
      preview.style.left = '0px';
      preview.style.top = '0px';
      preview.style.transformOrigin = 'top left';
      preview.style.transform =
        /* 预览层用**同一个锚点** ✓（同源 ✓ 必然对齐 ✓）· 再上移 84 布局 px ✓ */
        `translate(${anchorX}px, ${anchorY}px)`
        + ' translateX(-50%) translateY(-84px)';
    }
  }, [activeNodeId, readLiveViewport]);

  useEffect(() => {
    if (!activeNodeId || isExpanded) return;
    let frame = 0;
    let restoreTimer = 0;
    const handleViewportChange = (event: Event) => {
      if (frame) return;
      const detail = (event as CustomEvent<{ zoom: number; x: number; y: number; left: number; top: number }>).detail;
      if (!detail || !Number.isFinite(detail.zoom)) return;
      viewportRef.current = detail;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const panel = panelRef.current;
        if (!panel) return;
        /* ★ 位置全部由 applyDialogTransform() 用**一个 transform** 写 ✓
           （原先是逐帧写 left/top ✗ → 触发重排 ✗ → 间距漂移 / 动画偏移 / 上传按钮卡顿 ✓）*/
        applyDialogTransform();
        // ⚠️ 这里**绝不能**调 getBoundingClientRect()：Canvas 在同一帧刚写过一批样式，
        //    此时读几何会触发**强制同步布局**，实测出现过 1917ms 的单帧（layout thrashing）。
        //    applyDialogTransform 全程只用坐标计算 ✓ 不读几何 ✓
        const preview = previewRef.current;
        if (preview && viewportRef.current) {
          preview.style.transition = 'none';
          // 预览层与面板同源定位 ✓（比面板再高 42 布局像素 ✓ = 42×zoom×0.5 屏幕 ✓）
          const vp = viewportRef.current;
          const state = useAppStore.getState();
          const node = state.nodes.find((n) => n.id === activeNodeId);
          if (node) {
            const pos = absoluteNodePosition(node, state.nodes);
            const width = node.measured?.width ?? node.width ?? 280;
            const height = node.measured?.height ?? node.height ?? 160;
            const flowX = pos.x + width / 2;
            const flowY = pos.y + height + dialogGapFlow(vp.zoom);
            preview.style.left = '0px';
            preview.style.top = '0px';
            preview.style.transformOrigin = 'top left';
            preview.style.transform =
              `translate(${vp.left + vp.x}px, ${vp.top + vp.y}px)` +
              ` scale(${vp.zoom * 0.5})` +
              ` translate(${flowX * 2}px, ${flowY * 2}px)` +
              ` translateX(-50%) translateY(-84px)`;
          }
        }
        window.clearTimeout(restoreTimer);
        restoreTimer = window.setTimeout(() => {
          panel.style.removeProperty('transition');
          previewRef.current?.style.removeProperty('transition');
        }, 250);
      });
    };
    window.addEventListener('canvas-viewport-change', handleViewportChange);
    return () => {
      window.removeEventListener('canvas-viewport-change', handleViewportChange);
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(restoreTimer);
    };
  }, [activeNodeId, isExpanded, applyDialogTransform]);
  /**
   * 面板位置的**唯一写入方**：store 里 dialogPosition 变化时命令式写 left/top。
   * 与 JSX 内联样式分离 —— 两边同时管 left/top 会互相覆盖：
   * React 重渲染把面板拉回旧 dialogPosition，逐帧跟随写入又拉回来，实测出现 ±1200px 跳变。
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !dialogPosition || isExpanded) return;
    // 画布交互（平移/缩放）期间**不要写**：此时位置由 canvas-viewport-change 处理器逐帧驱动。
    // 这里再写一次 store 里的值会和逐帧值短暂不一致，产生一次可见跳变（实测残留 ~105px）。
    if (document.documentElement.classList.contains('canvas-interacting')) return;
    /* ★ 统一走 applyDialogTransform() ✓（一个 transform ✓ 不再写 left/top ✗）*/
    applyDialogTransform();
  }, [dialogPosition, isExpanded, applyDialogTransform]);

  /**
   * 拖动节点时跟随（`canvas-node-move` 由 Canvas 的 handleNodeDrag 广播）。
   * 位置现在只由命令式代码写 DOM —— JSX 里不写 left/top（那是为了消除"React 与逐帧写入抢 left/top"的抖动），
   * 而拖动节点既不改 zoom 也不改视口，所以 canvas-viewport-change 不会触发，必须单独接这条。
   */
  useEffect(() => {
    if (!activeNodeId || isExpanded) return;
    let frame = 0;
    let pending: { left: number; top: number; width: number; height: number } | null = null;
    const handleNodeMove = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; left: number; top: number; width: number; height: number }>).detail;
      if (!detail || detail.id !== activeNodeId) return;
      pending = detail;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const panel = panelRef.current;
        const rect = pending;
        pending = null;
        if (!panel || !rect) return;
        /* ★ 统一走 applyDialogTransform() ✓（它从 store 读节点流坐标 ✓ 一个 transform ✓）
           `rect` 只用于"确认是本节点" ✓ 不再用它的屏幕坐标 ✗（那是旧方案 ✓）*/
        applyDialogTransform();
        const preview = previewRef.current;
        if (preview) {
          preview.style.transition = 'none';
        }
      });
    };
    window.addEventListener('canvas-node-move', handleNodeMove);
    return () => {
      window.removeEventListener('canvas-node-move', handleNodeMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [activeNodeId, isExpanded, applyDialogTransform]);

  /**
   * ★★ **卡片尺寸变化时跟随**（换比例 / 换模型 / 上传图后撑高 ✓）
   *
   * 为什么必须有这条 ✗：MTV 原本只有两条跟随路径 ——
   *   ① `canvas-viewport-change`（缩放/平移 ✓）
   *   ② `canvas-node-move`（**只在拖动节点时**广播 ✓）
   * 而**尺寸变化**既不改 zoom、也不拖动 → 两条都不触发 ✗✓
   *   → 换比例后卡片变宽变高，底部编辑区**不重算** → **间距被破坏** ✗
   *   → 用户："不同比例卡片出现时 底部编辑区与卡片的间距 应该是保持一致的" ✓
   *
   * 官方为什么没这问题 ✓：编辑面板是**节点的子元素** + `absolute -bottom-2` ✓
   *   → 卡片怎么变尺寸，面板都自动跟着、间距恒为 **8 流** ✓（`pR` 换尺寸也一样 ✓）
   *
   * 这里用 ResizeObserver 看住该节点的真实 DOM 元素 ✓，尺寸一变就按
   *   `left + width/2`（水平居中）· `top + height + 8 × zoom`（间距 8 流 ✓）重算 ✓
   */
  useEffect(() => {
    if (!activeNodeId || isExpanded) return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodeEl = document.querySelector(`.react-flow__node[data-id="${activeNodeId}"]`);
    if (!(nodeEl instanceof HTMLElement)) return;
    let frame = 0;
    const reposition = () => {
      frame = 0;
      /* ★ 统一走 applyDialogTransform() ✓（从 store 读节点流坐标 ✓ 一个 transform ✓）
         卡片尺寸一变（换比例/换模型/上传图 ✓）→ store 里的宽高随之更新 ✓ → 这里重算 ✓
         间距恒为 **15 流** ✓（不随卡片尺寸变化 ✓ 用户要求 ✓）*/
      applyDialogTransform();
    };
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(reposition);
    });
    observer.observe(nodeEl);
    /* ★★★★ **同时用 MutationObserver 盯节点元素的 `style`** ✓✓
       为什么必须加 ✗（实测抓到的真 bug ✓）：
         「卡片从中心向外长」用的是 `updateNodePositionTransient()` ✗
         → 它**不发 `canvas-node-move` 事件** ✗✓ → 现有跟随路径收不到通知 ✗
         → 面板 retain **旧坐标** ✗ → 在 Tauri 窗口实测：间距漂到 **33.92 流** ✗（应 15 ✓）
       加上这条后：节点**任何**位置/尺寸写入（不论谁写的 ✓）都会触发重算 ✓✓ */
    const styleObserver = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(reposition);
    });
    styleObserver.observe(nodeEl, { attributes: true, attributeFilter: ['style'] });
    reposition();
    return () => {
      observer.disconnect();
      styleObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [activeNodeId, isExpanded, applyDialogTransform]);

  /**
   * ★★★★ **最终兜底：盯住画布 viewport 的 style 变化** ✓✓
   *
   * 为什么还需要这一条 ✗：前面四条路径（viewport-change 事件 / 节点拖动 / ResizeObserver / store 变化）
   * 都依赖「别处把事件发出来」✓ —— 但浏览器里能工作、**Tauri(WebView2) 里不工作** ✗（用户实测 ✓），
   * 说明 Tauri 下缩放可能走了**不派发该事件**的路径 ✗。
   *
   * 这一条**不依赖任何事件** ✓：MutationObserver 直接盯 `.react-flow__viewport` 的 `style` ✓
   * —— React Flow 每次缩放/平移都**必然重写它的 transform** ✓ → **一次都不会漏** ✓✓
   * 开销：只在属性真变化时回调 ✓（用 rAF 合并同帧多次 ✓）不轮询 ✓
   */
  useEffect(() => {
    if (!activeNodeId || isExpanded) return;
    const vpEl = document.querySelector('.react-flow__viewport');
    if (!(vpEl instanceof HTMLElement)) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        applyDialogTransform();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(vpEl, { attributes: true, attributeFilter: ['style'] });
    schedule();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [activeNodeId, isExpanded, applyDialogTransform]);

  /* ★★ 画廊打开时整条「生成输入条」**不挂载**（见 `galleryOpenHere` 的官方出处记账）⇒
      关掉画廊重新挂载后，`panelRef.current` 是一个**全新的 DOM 节点**，它身上没有任何命令式写过的
      `style.transform` —— 而上面那些定位 effect 的依赖是 `[activeNodeId, isExpanded, applyDialogTransform]`，
      画廊开关不改这三个值 ⇒ **它们不会重跑** ⇒ 浮条会落在错位（这才是上一版不敢用 unmount 的原因）。
      ⇒ 这里补一条只在「重新挂载」时跑的 effect：`galleryOpenHere` 由 true→false（= 画廊收起、浮条重新挂载）
        时，layout 阶段立刻按 store 里的节点流坐标 + 当前视口重算一次 transform ✓（首屏/其它情况不重复写）。 */
  useLayoutEffect(() => {
    if (galleryOpenHere || !activeNodeId || isExpanded) return;
    applyDialogTransform();
  }, [galleryOpenHere, activeNodeId, isExpanded, applyDialogTransform]);

  const editorApiRef = useRef<MentionEditorHandle>(null);
  const continuousEditActiveRef = useRef(false);
  const finishContinuousEdit = useCallback(() => {
    if (!continuousEditActiveRef.current) return;
    commitToHistory();
    continuousEditActiveRef.current = false;
  }, [commitToHistory]);
  const updateContinuousNodeData = useCallback((patch: Partial<BaseNodeData>) => {
    if (!activeNodeId) return;
    if (!continuousEditActiveRef.current) {
      commitToHistory();
      continuousEditActiveRef.current = true;
    }
    updateNodeDataTransient(activeNodeId, patch);
  }, [activeNodeId, commitToHistory, updateNodeDataTransient]);
  const handleCloseNodeDialog = useCallback(() => {
    finishContinuousEdit();
    closeNodeDialog();
  }, [closeNodeDialog, finishContinuousEdit]);

  useEffect(() => () => finishContinuousEdit(), [activeNodeId, finishContinuousEdit]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        /* ★ 条没有真正显示时**必须早退**：本组件是常驻挂载（`App.tsx` 的 `mountNodeDialog`），
           而下面这行监听在 window **捕获**阶段调 `stopPropagation()` ⇒ 只要画布在跑、
           且 `activeNodeId` 还留着（堆叠隐藏 / 画廊接管 / compare 条不挂载 / 面板已卸载），
           整个应用的 Escape 都被它截走。CDP 实测（把 Escape 派发到 `.title-input`）：
           window 捕获先 stop，React 的 `onKeyDown` 根本收不到 ⇒ 官方导航的
           「Esc 取消重命名」「Esc 关闭画布切换菜单」失效，`useKeyboardShortcuts`
           的 document 捕获 Escape 分支同样死掉。
           判据用**读时的 DOM 事实**（挂载 + 可见），而不是 `activeNodeId` —— 后者在上述
           几种「条不在屏幕上」的情况下都还是非空（实测：面板已卸载，Escape 仍被吃掉）。 */
        const panel = panelRef.current;
        if (!panel || panel.getClientRects().length === 0) return;
        // 先让顶层 UI Kit 下拉处理 Escape，保留当前节点参数弹窗。
        if (document.querySelector('[data-ui-select-portal]')) return;
        /* 官方语义：`@` 候选弹窗 / `/` 指令菜单**优先**消费 Escape（前者还会删掉 `@` 触发字符），
           面板不能被一起关掉。MTV 的监听在**捕获阶段**（下面的 `true`）⇒ 编辑器里 stopPropagation 拦不住 ✗
           ⇒ 这里按本文件已有模式（`[data-ui-select-portal]`）显式豁免。 */
        if (document.querySelector('.mention-dropdown')) return;
        if (document.querySelector('[data-testid="official-slash-menu"]')) return;
        /* 官方「摄影机控制」的 Lens Combo 是 radix Popover ⇒ 最上层浮层**独占** Escape
           （`DismissableLayer` 的语义），按下去只关它、不关整个节点面板。
           MTV 同样在捕获阶段 ⇒ 照上面两条的既有模式显式豁免（`CameraControl` 自己的
           document 冒泡监听随即把 `.cc-popover` 关掉 ✓）。 */
        if (document.querySelector('.cc-popover')) return;
        e.stopPropagation();
        if (isExpanded) {
          setIsExpanded(false);
        } else {
          handleCloseNodeDialog();
        }
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handleCloseNodeDialog, isExpanded]);

  // All hooks must be called before any early return
  const onPromptChange = useCallback(
    (value: string) => {
      const current = useAppStore.getState().nodes.find((item) => item.id === activeNodeId)?.data;
      if (isCloudWorkflow(useAppStore.getState().workflows.find((item) => item.id === current?.workflowId))) {
        updateContinuousNodeData({ prompt: value }); return;
      }
      // Extract workflow IO node assignments from the prompt string
      // Format: @wf{ioNodeId|title|type}(value content)
      // ioNodeId can contain ":" (e.g. "57:27"), fields are pipe-separated to avoid ambiguity
      const workflowInputs: Record<string, string> = { ...current?.workflowInputs };
      const wfRegex = /@wf\{([^|]+)\|([^|]+)\|([^|}]+)\}\(([\s\S]*?)\)/g;
      // 芯片赋值随正文重建；下拉等面板直接写入的输入保留。
      for (const previous of (current?.prompt ?? '').matchAll(wfRegex)) {
        delete workflowInputs[previous[1]];
      }
      wfRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = wfRegex.exec(value)) !== null) {
        const ioNodeId = match[1]; // Full ID (may contain ":")
        const valueText = match[4].replace(/\n$/, '');
        workflowInputs[ioNodeId] = valueText;
      }
      updateContinuousNodeData({ prompt: value, workflowInputs: Object.keys(workflowInputs).length > 0 ? workflowInputs : undefined });
    },
    [activeNodeId, updateContinuousNodeData]
  );

  // 调用选中模型生成（文本 or 图片）
  // overridePrompt: / 指令菜单直接触发时传入的整合后模板，不走 store → 对话框不闪烁
  const onSubmit = useCallback(async (overridePrompt?: string, postProcess?: ImagePostProcess) => {
    finishContinuousEdit();
    // 实时从 store 读取全部数据 — 避免闭包 data 为 undefined
    const store = useAppStore.getState();
    const latestNode = store.nodes.find((n) => n.id === activeNodeId);
    const latestData = latestNode?.data as BaseNodeData | undefined;
    if (!latestData) {
      showToast(t('节点不存在'), 'error');
      return;
    }
    if (store.currentProjectId && getPendingTasksForProject(store.currentProjectId).some((task) => (
      task.nodeId === activeNodeId && task.taskType === 'comfyui' && task.comfyRecoveryState
    ))) {
      showToast(t('该节点还有未确认结束的 ComfyUI 任务，请先继续查询或终止任务'), 'error');
      return;
    }
    const rawPrompt = overridePrompt ?? (latestData.prompt as string) ?? '';
    const cloudWorkflow = isCloudWorkflow(store.workflows.find((item) => item.id === latestData.workflowId));
    if (!rawPrompt.trim() && !cloudWorkflow && latestData.provider !== 'runninghub') {
      showToast(t('请输入提示词'), 'error');
      return;
    }
    const projectSettings = store.projects.find(
      (project) => project.id === currentProjectId,
    )?.settings;
    const projectPrompt = resolveProjectGenerationPrompt({
      prompt: rawPrompt,
      data: latestData,
      settings: projectSettings,
      customStyles: store.customStyles,
    });
    /* 摄影机控制 → 提示词片段：官方那四段片段自带 `", "` 前导 ⇒ **直接接在提示词尾部**，
       不再用 MTV 自造的 `\n\nCamera settings: …` 包装；关掉时返回空串（与官方一致）*/
    const cameraPrompt = buildGenerationCameraPrompt(latestData.cameraSettings);
    const effectivePrompt = cameraPrompt && (nodeType === 'ai-image' || nodeType === 'ai-video')
      ? `${projectPrompt}${cameraPrompt}`
      : projectPrompt;
    const nodeModel = latestData?.model;
    const nodeProvider = latestData?.provider;
    const nodeLabel = latestData?.label ?? '';
    if (!nodeModel || !nodeProvider) {
      showToast(t('请先在底部模型选择器中选择一个模型'), 'error');
      return;
    }
    const submittingNodeId = activeNodeId!;
    const submittingProjectId = currentProjectId;
    const runningHubTask = cloudWorkflow || latestData.provider === 'runninghub';
    let cloudGuard = runningHubTask ? registerCanvasDerivation(store, submittingNodeId) : null;
    const isStillCurrentSubmission = () => {
      const state = useAppStore.getState();
      return (
        state.currentProjectId === submittingProjectId
        && state.nodes.some((n) => n.id === submittingNodeId)
        && (!runningHubTask || (!!cloudGuard && isCanvasDerivationFresh(cloudGuard, state)))
      );
    };
    updateNodeDataTransient(activeNodeId!, { status: 'loading', error: undefined });
    let batchNodeIds: string[] | undefined;
    try {
      const batchCount = cloudWorkflow ? 1 : Math.min(MAX_IMAGE_BATCH_COUNT, Math.max(1, Math.floor(Number(latestData.batchCount) || 1)));
      if (nodeType === 'ai-image' && batchCount > 1) {
        if (postProcess) throw new Error(t('批量生成暂不支持图片后处理，请将数量设为 1'));
        /* ★ 画布设置「批量生成结果」= 多变体时：**不建兄弟节点**，N 张全部折叠进源节点
           （`applyImageBatchResults` 的 `variantsMode`：主图 = 第 1 张，其余写进 `data.options`）。
           官方依据：`ze=Dy(); Be=ze===Ma.VARIANTS; Oe=Be?Ma.SPREAD:ze` —— 变体是"后续合并折叠"的那一种。
           ⚠️ 修复前这里**无条件** `prepareImageBatchNodes` 建 N 个兄弟节点，且 `applyImageBatchResults`
              从未收到 `variantsMode` ⇒ "多变体"永远走不到（永远铺开）。 */
        const variantsMode = readBatchResultLayout() === 'variants';
        const imageSize = (latestData.imageSize as string) || '2K';
        const aspectRatio = (latestData.aspectRatio as string) || '1:1';
        if (!variantsMode) {
          batchNodeIds = prepareImageBatchNodes({
            nodeId: submittingNodeId,
            count: batchCount,
            projectId: submittingProjectId,
          }).nodeIds;
        }
        if (cloudGuard) completeCanvasDerivation(cloudGuard);
        cloudGuard = runningHubTask ? registerCanvasDerivation(useAppStore.getState(), submittingNodeId) : null;
        showToast(t('正在批量生成 {count} 张图片', { count: batchCount }));
        const batch = await generateImagesBatch({
          prompt: effectivePrompt,
          model: nodeModel,
          provider: nodeProvider,
          imageSize,
          aspectRatio,
          workflowId: latestData.workflowId,
          workflowInputs: latestData.workflowInputs, runninghubModelParameters: latestData.runninghubModelParameters,
          nodeId: activeNodeId ?? undefined,
        }, batchCount);
        if (!isStillCurrentSubmission()) return;
        await applyImageBatchResults({
          nodeId: submittingNodeId,
          targetNodeIds: batchNodeIds,
          isCurrent: runningHubTask ? isStillCurrentSubmission : undefined,
          batch,
          projectId: submittingProjectId,
          prompt: effectivePrompt,
          imageSize,
          aspectRatio,
          variantsMode,
        });
        return;
      }
      if (nodeType === 'ai-image' || nodeType === 'ai-animation') {
        const isAnimation = nodeType === 'ai-animation';
        const imageSize = (latestData.imageSize as string) || '2K';
        const animationAction = latestData.animationAction ?? 'idle';
        const animationFrames = latestData.animationFrames ?? 8;
        const aspectRatio = isAnimation
          ? resolveAnimationSheetAspectRatio(animationFrames, nodeProvider)
          : (latestData.aspectRatio as string) || '1:1';
        const requestPrompt = isAnimation
          ? buildAnimationSpritePrompt(effectivePrompt, animationAction, animationFrames, aspectRatio)
          : effectivePrompt;
        const result = await generateImage({
          prompt: requestPrompt,
          model: nodeModel,
          provider: nodeProvider,
          imageSize,
          aspectRatio,
          /* ★ 官方「精细度」+「透明背景」随请求送出 ✓
               （透明背景官方只对 2.5 系列那 2 个模型开放 ✓ 映射成
                 `background:"transparent"` + `output_format:"png"` ✓）*/
          quality: latestData.quality as string | undefined,
          transparentBackground: latestData.transparentBackground === true,
          workflowId: latestData.workflowId,
          workflowInputs: latestData.workflowInputs, runninghubModelParameters: latestData.runninghubModelParameters,
          nodeId: activeNodeId ?? undefined,
        });
        if (!isStillCurrentSubmission()) return;
        // 下载远程 URL 到本地项目目录
        const persisted = getCloudWorkflowPersistedOutput(result.workflowApiOutputs ?? result.runninghubOutputs, result.url) ?? (currentProjectId
          ? await persistMediaUrlToProjectData(result.url, currentProjectId, 'ai-image', nodeLabel)
          : { mediaUrl: result.url, sourceUrl: result.url });
        if (runningHubTask && !isStillCurrentSubmission()) return;
        const mediaUrl = persisted.mediaUrl;
        updateNodeData(activeNodeId!, {
          imageUrl: mediaUrl,
          sourceUrl: persisted.sourceUrl,
          filePath: persisted.filePath,
          thumbnailUrl: mediaUrl,
          output: persisted.sourceUrl,
          status: 'success',
          imageWidth: result.width,
          imageHeight: result.height,
          ...(isAnimation ? { aspectRatio } : {}),
        });
        if (runningHubTask) completeRunningHubNodeTask(submittingNodeId);
        if (result.workflowApiTaskId) completeWorkflowApiNodeTask(submittingNodeId, result.workflowApiTaskId);
        useAppStore.getState().syncDramaAssetImageFromNode?.(activeNodeId!, mediaUrl);
        recordOutputHistory(activeNodeId!, {
          nodeId: activeNodeId!,
          nodeLabel: nodeLabel,
          timestamp: Date.now(),
          prompt: effectivePrompt,
          output: persisted.sourceUrl,
          nodeType: isAnimation ? 'ai-animation' : 'ai-image',
          model: nodeModel,
          provider: nodeProvider,
          status: 'success',
          mediaUrl,
          filePath: persisted.filePath,
          params: isAnimation
            ? { imageSize, aspectRatio, animationAction, animationFrames, grid: ANIMATION_FRAME_GRIDS[animationFrames] }
            : { imageSize, aspectRatio, cameraSettings: latestData.cameraSettings },
        });
        if (postProcess === 'character-8-direction-grid') {
          if (!persisted.filePath) {
            showToast(t('原图已生成，但未能保存到本地，无法自动生成 8 向宫格'), 'error');
          } else {
            showToast(t('图片生成完成，正在后台切图生成 8 向宫格'));
            try {
              if (!isStillCurrentSubmission()) return;

              const gridResult = await createCharacterDirectionGrid(persisted.filePath);
              if (!isStillCurrentSubmission()) return;

              const store2 = useAppStore.getState();
              const sourceNode = store2.nodes.find((item) => item.id === submittingNodeId);
              if (!sourceNode) return;
              store2.addNode({
                id: `node-${generateId()}`,
                type: 'ai-storyboard',
                ...derivedNodePlacement(sourceNode, 60),
                data: {
                  label: `${nodeLabel} 8向宫格`,
                  type: 'ai-storyboard',
                  role: 'source',
                  status: 'success',
                  imageUrl: convertFileSrc(gridResult.grid_path),
                  filePath: gridResult.grid_path,
                  imageWidth: gridResult.grid_size,
                  imageHeight: gridResult.grid_size,
                  storyboardRows: 3,
                  storyboardCols: 3,
                  nodeWidth: 360,
                  nodeHeight: 360,
                },
              });
              showToast(t('角色 8 向宫格已生成'));
            } catch (postProcessError) {
              const message = postProcessError instanceof Error
                ? postProcessError.message
                : typeof postProcessError === 'string'
                  ? postProcessError
                  : t('未知错误');
              showToast(t('原图已生成，8 向宫格处理失败：{message}', { message }), 'error');
            }
          }
        } else {
          showToast(isAnimation ? t('Sprite Sheet 生成完成') : t('图片生成完成'));
        }
      } else if (nodeType === 'ai-panorama') {
        const imageSize = (latestData.imageSize as string) || '2K';
        const aspectRatio = (latestData.aspectRatio as string) || '2:1';
        const fullPrompt = buildPanoramaPrompt(effectivePrompt);
        const result = await generateImage({
          prompt: fullPrompt,
          model: nodeModel,
          provider: nodeProvider,
          imageSize,
          aspectRatio,
          workflowId: latestData.workflowId,
          workflowInputs: latestData.workflowInputs, runninghubModelParameters: latestData.runninghubModelParameters,
          nodeId: activeNodeId ?? undefined,
        });
        if (!isStillCurrentSubmission()) return;
        const persisted = currentProjectId
          ? await persistMediaUrlToProjectData(result.url, currentProjectId, 'ai-panorama', nodeLabel)
          : { mediaUrl: result.url, sourceUrl: result.url };
        const mediaUrl = persisted.mediaUrl;
        updateNodeData(activeNodeId!, {
          imageUrl: mediaUrl,
          sourceUrl: persisted.sourceUrl,
          filePath: persisted.filePath,
          thumbnailUrl: mediaUrl,
          output: persisted.sourceUrl,
          status: 'success',
          imageWidth: result.width,
          imageHeight: result.height,
        });
        recordOutputHistory(activeNodeId!, {
          nodeId: activeNodeId!,
          nodeLabel: nodeLabel,
          timestamp: Date.now(),
          prompt: effectivePrompt,
          output: persisted.sourceUrl,
          nodeType: 'ai-panorama',
          model: nodeModel,
          provider: nodeProvider,
          status: 'success',
          mediaUrl,
          filePath: persisted.filePath,
          params: { imageSize, aspectRatio },
        });
        showToast(t('全景图生成完成'));
      } else if (nodeType === 'ai-video') {
        const {
          videoResolution,
          videoFps,
          videoFrames,
          seedanceResolution,
          seedanceRatio,
          seedanceDuration,
        } = resolveVideoSubmissionControls({
          provider: nodeProvider,
          workflowId: latestData.workflowId,
          videoResolution: latestData.videoResolution as number | undefined,
          videoFps: latestData.videoFps as number | undefined,
          videoFrames: latestData.videoFrames as number | undefined,
          seedanceResolution: latestData.seedanceResolution as string | undefined,
          seedanceRatio: latestData.seedanceRatio as string | undefined,
          seedanceDuration: latestData.seedanceDuration as number | undefined,
        });
        const generateAudio = latestData.generateAudio as boolean | undefined;
        const result = await generateVideo({
          prompt: effectivePrompt,
          model: nodeModel,
          provider: nodeProvider,
          videoResolution,
          videoFps,
          videoFrames,
          seedanceResolution,
          seedanceRatio,
          seedanceDuration,
          generateAudio,
          workflowId: latestData.workflowId,
          workflowInputs: latestData.workflowInputs, runninghubModelParameters: latestData.runninghubModelParameters,
          nodeId: activeNodeId ?? undefined,
        });
        if (!isStillCurrentSubmission()) return;
        // 下载远程 URL 到本地项目目录
        const persisted = getCloudWorkflowPersistedOutput(result.workflowApiOutputs ?? result.runninghubOutputs, result.url) ?? (currentProjectId
          ? await persistMediaUrlToProjectData(result.url, currentProjectId, 'ai-video', nodeLabel)
          : { mediaUrl: result.url, sourceUrl: result.url });
        if (runningHubTask && !isStillCurrentSubmission()) return;
        const mediaUrl = persisted.mediaUrl;
        updateNodeData(activeNodeId!, {
          videoUrl: mediaUrl,
          sourceUrl: persisted.sourceUrl,
          filePath: persisted.filePath,
          thumbnailUrl: mediaUrl,
          output: persisted.sourceUrl,
          status: 'success',
        });
        if (result.workflowApiTaskId) completeWorkflowApiNodeTask(submittingNodeId, result.workflowApiTaskId);
        if (runningHubTask) completeRunningHubNodeTask(submittingNodeId);
        if (result.workflowApiTaskId) completeWorkflowApiNodeTask(submittingNodeId, result.workflowApiTaskId);
        recordOutputHistory(activeNodeId!, {
          nodeId: activeNodeId!,
          nodeLabel: nodeLabel,
          timestamp: Date.now(),
          prompt: effectivePrompt,
          output: persisted.sourceUrl,
          nodeType: 'ai-video',
          model: nodeModel,
          provider: nodeProvider,
          status: 'success',
          mediaUrl,
          filePath: persisted.filePath,
          params: { videoResolution, videoFps, videoFrames, seedanceResolution, seedanceRatio, seedanceDuration, generateAudio, cameraSettings: latestData.cameraSettings },
        });
        showToast(t('视频生成完成'));
      } else if (nodeType === 'ai-audio') {
        const result = await generateAudio({
          prompt: effectivePrompt,
          model: nodeModel,
          provider: nodeProvider,
          audioSpeechSettings: latestData.audioSpeechSettings,
          audioVoice: latestData.audioVoice,
          audioFormat: latestData.audioFormat,
          audioSpeed: latestData.audioSpeed,
          musicTitle: latestData.musicTitle,
          musicLyrics: latestData.musicLyrics,
          musicBpm: latestData.musicBpm,
          musicDuration: latestData.musicDuration,
          autoGenerateLyrics: latestData.autoGenerateLyrics,
          workflowId: latestData.workflowId,
          workflowInputs: latestData.workflowInputs, runninghubModelParameters: latestData.runninghubModelParameters,
          nodeId: activeNodeId ?? undefined,
        });
        if (!isStillCurrentSubmission()) {
          if (result.url.startsWith('blob:')) URL.revokeObjectURL(result.url);
          return;
        }
        const persisted = await persistAudioGenerationResult(result, currentProjectId, nodeLabel);
        if (runningHubTask && !isStillCurrentSubmission()) return;
        updateNodeData(activeNodeId!, {
          audioUrl: persisted.mediaUrl,
          sourceUrl: persisted.sourceUrl,
          filePath: persisted.filePath,
          thumbnailUrl: persisted.mediaUrl,
          output: persisted.outputUrl,
          musicClipId: result.clipId,
          ...(result.title ? { musicTitle: result.title } : {}),
          ...(result.lyrics ? { musicLyrics: result.lyrics } : {}),
          status: 'success',
        });
        if (runningHubTask) completeRunningHubNodeTask(submittingNodeId);
        if (result.workflowApiTaskId) completeWorkflowApiNodeTask(submittingNodeId, result.workflowApiTaskId);
        recordOutputHistory(activeNodeId!, {
          nodeId: activeNodeId!,
          nodeLabel: nodeLabel,
          timestamp: Date.now(),
          prompt: effectivePrompt,
          output: persisted.outputUrl,
          nodeType: 'ai-audio',
          model: nodeModel,
          provider: nodeProvider,
          status: 'success',
          mediaUrl: persisted.mediaUrl,
          filePath: persisted.filePath,
          params: {
            audioSpeechSettings: latestData.audioSpeechSettings,
            audioVoice: latestData.audioVoice,
            audioFormat: latestData.audioFormat,
            audioSpeed: latestData.audioSpeed,
            musicTitle: result.title || latestData.musicTitle,
            musicBpm: latestData.musicBpm,
            musicDuration: latestData.musicDuration,
            autoGenerateLyrics: latestData.autoGenerateLyrics,
          },
        });
        showToast(t('音频生成完成'));
      } else if (nodeType === 'ai-shotlist') {
        const rows = await generateShotlistRows(submittingNodeId, effectivePrompt, nodeModel, nodeProvider);
        showToast(t('已生成 {count} 个镜头', { count: rows.length }));
      } else {
        /* 官方文本卡「生成次数 N」= **画布上 N 个兄弟节点**（不是一次请求 N 条结果）：
             `q = requestedResultCount ?? params.times`（@2823789）喂给 `Bqe`(@2794625)，
             `resultsPerRequest:1` ⇒ 每个目标节点各发一次请求；克隆体由 `Dqe`(@2793626) 生成、
             布局走 SPREAD 网格 `Nqe`(@2792075)、入边由 `Oqe`(@2794374) 复制。
            （`historyLocalQueues` 那套本地变体队列只给 IMAGE/VIDEO/AUDIO —— 见 utils/textVariants.ts。） */
        const variantCount = resolveTextTimes(batchCount);
        const variantTargets = variantCount > 1
          ? prepareTextVariantNodes({
              nodeId: submittingNodeId,
              count: variantCount,
              projectId: submittingProjectId,
            }).nodeIds
          : [submittingNodeId];
        if (variantCount > 1) {
          showToast(t('正在生成 {count} 个变体', { count: variantCount }));
        }
        const { postProcessDramaExtractOutput } = await import('../../services/dramaAssetExtract');
        const variantTimestamp = Date.now();
        /* 官方 `resultsPerRequest:1` ⇒ 每个节点一条请求；并发沿用 MTV 既有的 3 */
        const settledVariants = await runBatchTasks(
          variantTargets.length,
          3,
          async (index): Promise<string> => {
            const targetNodeId = variantTargets[index];
            try {
              const raw = await generateText({
                prompt: effectivePrompt,
                model: nodeModel,
                provider: nodeProvider,
              });
              if (!isStillCurrentSubmission()) throw new Error(t('任务已被取消'));
              /* 官方 `qTe`：文本结果按节点写回（`t = nodeType===TEXT ? "text" : "src"`）；
                 只有源节点做短剧资产抽取后处理（克隆体原样落库） */
              const output = index === 0
                ? postProcessDramaExtractOutput(effectivePrompt, raw).output
                : raw;
              updateNodeData(targetNodeId, { output, status: 'success' });
              recordOutputHistory(targetNodeId, {
                nodeId: targetNodeId,
                nodeLabel: index === 0 ? nodeLabel : `${nodeLabel} ${index + 1}`,
                timestamp: variantTimestamp,
                prompt: effectivePrompt,
                output,
                nodeType: 'ai-text',
                model: nodeModel,
                provider: nodeProvider,
                status: 'success',
                ...(variantTargets.length > 1
                  ? { params: { times: variantTargets.length, variantIndex: index + 1 } }
                  : {}),
              });
              return raw;
            } catch (variantError) {
              const message = variantError instanceof Error && variantError.message
                ? variantError.message
                : t('生成失败');
              useAppStore.getState().updateNodeDataTransient(targetNodeId, { status: 'error', error: message });
              recordOutputHistory(targetNodeId, {
                nodeId: targetNodeId,
                nodeLabel: index === 0 ? nodeLabel : `${nodeLabel} ${index + 1}`,
                timestamp: variantTimestamp,
                prompt: effectivePrompt,
                output: '',
                nodeType: 'ai-text',
                model: nodeModel,
                provider: nodeProvider,
                status: 'error',
                error: message,
              });
              throw variantError;
            }
          },
        );
        if (settledVariants.failedCount > 0) {
          if (settledVariants.results.length === 0) return;   // 全部失败：错误态与历史已逐节点写过
          showToast(t('{count} 个变体生成失败', { count: settledVariants.failedCount }), 'error');
        }
        /* 源节点的结果已经在任务里落库（含后处理）⇒ 这里读回它做短剧资产抽取 */
        const primaryOutput = useAppStore.getState().nodes
          .find((node) => node.id === submittingNodeId)?.data.output as string | undefined;
        const processed = postProcessDramaExtractOutput(effectivePrompt, primaryOutput ?? '');
        if (processed.kind) {
          if (processed.ok && processed.parsed) {
            useAppStore.getState().mergeDramaExtract(processed.parsed, {
              sourceNodeId: activeNodeId!,
              modelId: nodeModel,
            });
          }
          const kindLabel =
            processed.kind === 'character' ? t('人物') : processed.kind === 'scene' ? t('场景') : t('道具');
          if (processed.ok) {
            showToast(t('{kind}简介已提取并入库 · 「资产管理 > 短剧资产」可查看', { kind: kindLabel }));
          } else {
            showToast(t('已提取，但 JSON 未完全规范化，请检查输出'), 'error');
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (typeof err === 'string' && err.trim() ? err : t('生成失败'));
      if (
        (err instanceof DOMException && err.name === 'AbortError')
        || msg === '任务已被取消'
        || msg === '请求已取消'
      ) {
        return;
      }
      if (!isStillCurrentSubmission()) return;
      if (batchNodeIds) failImageBatchNodes(batchNodeIds, msg, submittingProjectId);
      updateNodeDataTransient(activeNodeId!, { status: 'error', error: msg });
      recordOutputHistory(activeNodeId!, {
        nodeId: activeNodeId!,
        nodeLabel: nodeLabel,
        timestamp: Date.now(),
        prompt: effectivePrompt,
        output: '',
        nodeType: nodeType as 'ai-text' | 'ai-image' | 'ai-video' | 'ai-audio' | 'ai-panorama',
        model: nodeModel,
        provider: nodeProvider,
        status: 'error',
        error: msg,
      });
      showToast(msg, 'error');
    } finally {
      if (runningHubTask && isStillCurrentSubmission() && useAppStore.getState().nodes.find((item) => item.id === submittingNodeId)?.data.status === 'success') completeRunningHubNodeTask(submittingNodeId);
      if (cloudGuard) completeCanvasDerivation(cloudGuard);
    }
  }, [activeNodeId, nodeType, currentProjectId, finishContinuousEdit, updateNodeData, updateNodeDataTransient, recordOutputHistory, showToast, t]);

  const onCancelGeneration = useCallback(async () => {
    if (!activeNodeId || cancellingNodeIdsRef.current.has(activeNodeId)) return;
    const nodeId = activeNodeId;
    const projectId = currentProjectId;
    if (useAppStore.getState().nodes.find((item) => item.id === nodeId)?.data.provider === 'workflow-api') {
      stopWorkflowApiNodeTask(nodeId); return;
    }
    const cloud = ['runninghubwf', 'runninghub'].includes(useAppStore.getState().nodes.find((item) => item.id === nodeId)?.data.provider ?? '');
    const originalTaskId = projectId ? getPendingTasksForProject(projectId).find((task) => task.nodeId === nodeId)?.taskId : undefined;
    const isCurrent = () => useAppStore.getState().currentProjectId === projectId
      && useAppStore.getState().nodes.some((item) => item.id === nodeId)
      && (!projectId || !getPendingTasksForProject(projectId).some((task) => task.nodeId === nodeId && task.taskId !== originalTaskId));
    cancellingNodeIdsRef.current.add(nodeId);
    try {
      const cloudResult = cloud ? await cancelRunningHubNodeTask(nodeId) : undefined;
      if (!cloud) await cancelComfyUINodeTask(nodeId);
      if (!isCurrent()) return;
      updateNodeDataTransient(nodeId, { status: 'idle', error: undefined });
      showToast(cloud ? (cloudResult === 'local-stopped' ? '已停止本地等待；已提交的任务仍在平台运行，可继续查询' : 'RunningHub 已确认任务结束') : t('已终止 ComfyUI 任务'));
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof Error ? error.message : t('无法终止 ComfyUI 任务');
      updateNodeDataTransient(nodeId, { status: 'error', error: cloud ? message : t('ComfyUI 取消尚未确认，任务已保留，可继续查询或再次终止') });
      showToast(t('取消尚未确认，任务已保留：{message}', { message }), 'error');
    } finally {
      cancellingNodeIdsRef.current.delete(nodeId);
    }
  }, [activeNodeId, currentProjectId, showToast, t, updateNodeDataTransient]);

  /**
   * 「直接输出」只对产物就是文字的节点成立：媒体节点没有模型就没有素材，
   * 分镜表的产物是表格行，把提示词原样倒进 output 也不会出现在表里。
   */
  const supportsPassThrough = nodeType !== 'ai-image'
    && nodeType !== 'ai-animation'
    && nodeType !== 'ai-video'
    && nodeType !== 'ai-audio'
    && nodeType !== 'ai-shotlist';

  // 直接将输入内容作为节点输出（跳过模型调用）
  const onPassThrough = useCallback(() => {
    const ld = useAppStore.getState().nodes.find((n) => n.id === activeNodeId)?.data as BaseNodeData | undefined;
    if (!ld?.prompt?.trim() || !ld?.type) return;
    updateNodeData(activeNodeId!, { output: ld.prompt, status: 'success' });
    recordOutputHistory(activeNodeId!, {
      nodeId: activeNodeId!,
      nodeLabel: ld.label,
      timestamp: Date.now(),
      prompt: ld.prompt,
      output: ld.prompt,
      nodeType: ld.type,
      model: ld.model || 'passthrough',
      provider: ld.provider || 'passthrough',
      status: 'success',
    });
  }, [activeNodeId, updateNodeData, recordOutputHistory]);

  const onModelSelect = useCallback(
    (model: ModelOption) => {
      /* §69/§71 官方 `CQe`（canvas:@2037060 逐字）选模型时把「生成方式」一并种进节点参数：
       * ```js
       * let k = Uhe(E, o.imageCount, o.videoCount, o.audioCount);
       * if (!k && (k = YR(E, o.imageCount, o.videoCount, o.audioCount), !k)) return;
       * const U = { ...k.defaults, model: E, variant: k.variant, modelType: k.modelType, … };
       * c(n, { params: U });
       * ```
       * `Uhe` = `x9`（vendor-packages:@1216950：`_p` 精确匹配的第一个 variant）；
       * `YR` = `o$`（vendor-packages:@1219506：`qb` 宽松接受的第一个 variant）。逐字移植见
       * `services/ai/modelParamCatalog.ts` 的 `videoVariantForModel`。
       *
       * §71 —— 计数来源（本轮的落地）：`o` 就是官方 `LXe` 的 `parentCounts`。
       * `lse`（canvas:@2040000 起）里 `const{…,parentCounts:u,currentVariant:p}=LXe(e);`，
       * `o` 与 `u` 是**同一个对象**（`u` 又经 `s.jsx(CQe,{model:o.model,nodeId:e,parentCounts:u,disabled:A})`
       * @2074414 转交给选择器）⇒ 选模型这条路径的计数**必须与连线实时同步**，
       * 所以这里读 `parentCountsRef.current`（每次渲染刷新，与下面 `currentParams` 现读 store
       * 同一口径，且不给这个 `useCallback` 增加依赖）。
       *
       * ⚠️ 记账（§69，仍在）：官方在 `k` 为空时**中止整次选模型**，
       *    MTV 改为「照常换模型、但不写 `params.modelType`/`variant`」（不中止用户操作）。
       * ⚠️ 官方同一处还写 `...k.defaults`（`aspectRatio`/`duration`/`resolution`/`generateAudio`/
       *    `generateMode`）—— MTV 的节点参数是**平铺**命名（`seedanceRatio`/`seedanceDuration`/…），
       *    没有官方同名的 `defaults` 键 ⇒ 不做改名映射，按铁律登记不落地（见 §69）。 */
      const parentCounts = parentCountsRef.current;
      const isVideoNode = nodeType === 'ai-video';
      const currentParams = isVideoNode
        ? (useAppStore.getState().nodes.find((item) => item.id === activeNodeId)?.data.params ?? {})
        : {};
      const seededVariant = isVideoNode
        ? videoVariantForModel(model.value, parentCounts.imageCount, parentCounts.videoCount, parentCounts.audioCount)
        : null;
      updateNodeData(activeNodeId!, {
        model: model.value,
        provider: model.provider,
        audioPurpose: model.audioPurpose,
        runninghubModelParameters: undefined, runninghubOutputs: undefined, runninghubStage: undefined, workflowId: undefined,
        ...(isVideoNode && model.provider === 'general' ? {
          videoResolution: undefined,
          videoFps: undefined,
          videoFrames: undefined,
          seedanceResolution: undefined,
          seedanceRatio: undefined,
          seedanceDuration: undefined,
          generateAudio: undefined,
        } : {}),
        ...(isVideoNode ? {
          params: {
            ...currentParams,
            modelType: seededVariant?.modelType,
            variant: seededVariant?.variant,
          },
        } : {}),
        ...(model.provider === 'dreamina' ? { batchCount: 1 } : {}),
      });
    },
    [activeNodeId, nodeType, updateNodeData]
  );

  const onWorkflowSelect = useCallback(
    (workflowId: string | undefined) => {
      const workflow = useAppStore.getState().workflows.find((item) => item.id === workflowId);
      updateNodeData(activeNodeId!, {
        workflowId,
        workflowInputs: undefined, runninghubModelParameters: undefined, runninghubOutputs: undefined, runninghubStage: undefined,
        workflowApiOutputs: undefined, workflowApiStage: undefined,
        ...(workflow ? { ...workflowExecution(workflow), batchCount: 1, audioPurpose: undefined } : {}),
      });
    },
    [activeNodeId, updateNodeData]
  );

  const onChangeImageSize = useCallback(
    (value: string) => updateNodeData(activeNodeId!, { imageSize: value }),
    [activeNodeId, updateNodeData]
  );

  /* ★★★★★ **官方「精细度」** → 节点数据 ✓（官方 `defaults.quality` 随模型 ✓）*/
  const onChangeQuality = useCallback(
    (value: string) => updateNodeData(activeNodeId!, { quality: value }),
    [activeNodeId, updateNodeData]
  );

  /* ★★★★★ **官方「透明背景」** → 节点数据 ✓
     （生成时映射成 `background:"transparent"` + `output_format:"png"` ✓ 见
        `imageParameterMappings.buildStandardImageRequestBody` ✓ 官方原文对照 ✓）*/
  const onChangeTransparentBackground = useCallback(
    (value: boolean) => updateNodeData(activeNodeId!, { transparentBackground: value }),
    [activeNodeId, updateNodeData]
  );

  const onChangeAspectRatio = useCallback(
    (value: string) => {
      const updateData: Partial<BaseNodeData> = { aspectRatio: value };
      // 官方实测：改比例时卡片**宽度不变**，只按比例改高度 —— 所以把当前宽度传进去
      const currentNode = useAppStore.getState().nodes.find((n) => n.id === activeNodeId);
      const baseWidth = (currentNode?.data?.nodeWidth as number) || 280;
      const dimensions = getImageNodeDimensionsForAspectRatio(value, baseWidth);
      if (dimensions) Object.assign(updateData, dimensions);

      updateNodeData(activeNodeId!, updateData);
    },
    [activeNodeId, updateNodeData]
  );

  const onChangeBatchCount = useCallback(
    (value: number) => updateNodeData(activeNodeId!, { batchCount: value }),
    [activeNodeId, updateNodeData],
  );

  const onChangeCameraSettings = useCallback(
    (value: CameraGenerationSettings | undefined) => updateNodeData(activeNodeId!, { cameraSettings: value }),
    [activeNodeId, updateNodeData],
  );

  const onChangeVideoResolution = useCallback(
    // 自定义长边是逐字输入的，走连续编辑，别把每个键都记成一步撤销
    (value: number) => updateContinuousNodeData({ videoResolution: value }),
    [updateContinuousNodeData]
  );

  const onChangeVideoFps = useCallback(
    (value: number | undefined) => updateNodeData(activeNodeId!, { videoFps: value }),
    [activeNodeId, updateNodeData]
  );

  const onChangeSeedanceResolution = useCallback(
    (value: string | undefined) => updateNodeData(activeNodeId!, { seedanceResolution: value }),
    [activeNodeId, updateNodeData]
  );

  const onChangeSeedanceRatio = useCallback(
    (value: string | undefined) => updateNodeData(activeNodeId!, { seedanceRatio: value }),
    [activeNodeId, updateNodeData]
  );

  const onChangeSeedanceDuration = useCallback(
    (value: number | undefined) => updateContinuousNodeData({ seedanceDuration: value }),
    [updateContinuousNodeData]
  );

  const onChangeGenerateAudio = useCallback(
    (value: boolean | undefined) => updateNodeData(activeNodeId!, { generateAudio: value }),
    [activeNodeId, updateNodeData]
  );

  const onChangeVideoReferences = useCallback(
    (value: VideoReferenceItem[]) => updateNodeData(activeNodeId!, { videoReferences: value }),
    [activeNodeId, updateNodeData]
  );

  /* ══ §131 官方 `nt`（`ha` 首尾帧行两个帧槽的「+」，canvas @2055100 逐字）══
       ```js
       nt = a.useCallback(He => { const Bt = He==="first" ? "firstFrame" : "lastFrame";
         const {isActive:dn, originNodeId:wn, meta:so, exitMode:kn} = Qn.getState();
         if (dn && wn===e && so?.source===Bt) { kn(); return }        // 再点一次 = 退出
         dn && wn===e && kn();
         To(e, { source: Bt,
                 toolbarTitle: D(He==="first" ? "nodeSelectionMode.selectFirstFrame" : "nodeSelectionMode.selectLastFrame"),
                 autoExitOnConnect: !0,
                 allowedNodeTypes: [Z.IMAGE],                          // ← 只允许图片节点
                 onConnect: ds => { He==="first" ? se(ds) : ie(ds) } })})
       ```
       MTV 等价物 = `store.nodeSelection` 的 `enterMode(originNodeId, meta)`：meta 字段逐一对上官方
       （`source`/`toolbarTitle`/`autoExitOnConnect`/`allowedNodeTypes`/`onConnect`，见 `NodeSelectionMeta`）。
       `onConnect` 里把选中的图片节点写成 `videoReferences` 的 `first_frame`/`last_frame`（同角色先替换）。 */
  const onRequestFrameSlot = useCallback((slot: 'first' | 'last') => {
    if (!activeNodeId) return;
    const role: VideoReferenceItem['role'] = slot === 'first' ? 'first_frame' : 'last_frame';
    const source = slot === 'first' ? 'firstFrame' : 'lastFrame';
    const selection = useNodeSelectionStore.getState();
    if (selection.isActive && selection.originNodeId === activeNodeId && selection.meta?.source === source) {
      selection.exitMode();
      return;
    }
    selection.enterMode(activeNodeId, {
      source,
      /* 官方 `nt` 逐字：`toolbarTitle: D(He==="first" ? "nodeSelectionMode.selectFirstFrame" : "nodeSelectionMode.selectLastFrame")`
         ⇒ 官方 key = `nodeSelectionMode.selectFirstFrame` / `selectLastFrame`；
           zh 逐字（`index-CsQaPZ-H.js` **@862600 区** 的 `X2`）：
             `selectFirstFrame:"从画布中选择首帧图片"` · `selectLastFrame:"从画布中选择尾帧图片"`。
         ⚠️ MTV 的 `t()` 用**中文原文当 key**（与本仓既有用法一致：`toggleReferencePick(..., t('从画布选择参考'))`
            对应官方 `nodeSelectionMode.selectReference:"从画布选择参考"`）⇒ 直接用官方 zh 原文，**不自造文案**。 */
      toolbarTitle: t(slot === 'first' ? '从画布中选择首帧图片' : '从画布中选择尾帧图片'),
      autoExitOnConnect: true,
      allowedNodeTypes: ['ai-image'],
      onConnect: (pickedId: string) => {
        const state = useAppStore.getState();
        const picked = state.nodes.find((item) => item.id === pickedId);
        const url = picked?.data?.imageUrl;
        if (typeof url !== 'string' || !url) return;
        const current = (state.nodes.find((item) => item.id === activeNodeId)?.data
          ?.videoReferences ?? []) as VideoReferenceItem[];
        /* ★ 官方 `nt` 的 `onConnect` 是 `He==="first" ? se(ds) : ie(ds)` —— `se`/`ie` 写的是
           **首帧槽 / 尾帧槽**，而官方 `at` = `[first, last]` 过滤空值 ⇒ 位置即身份。
           ⚠️ MTV 原来是「按 role 过滤掉同 role 的旧条目再 append」⇒ 在「已有两帧、改首帧」时
             会得到 `[旧尾, 新首]` 这种顺序与 role 相反的状态（改成按位置取槽后就会显示错位）。
           用 `setFrameSlot` 按官方槽位语义写入，并把 role 按位置重派生（见 `utils/videoFrames.ts`）。 */
        const next = setFrameSlot(current, slot === 'first' ? 0 : 1, {
          id: pickedId,
          kind: 'frame',
          role,
          url,
          label: picked?.data?.label,
          sourceNodeId: pickedId,
        });
        updateNodeData(activeNodeId, { videoReferences: next });
      },
    });
  }, [activeNodeId, t, updateNodeData]);

  /* ── §69 官方「生成方式」（`Roe` 的 `generateMethod` / `availableGenerateMethods` / `onGenerateMethodChange`） ──
   *  · 读出：官方 `LXe`（canvas:@1991362 逐字）`const h=n?.params?.modelType; … return {…, modelType:g}`
   *    ⇒ `dd(modelType)` = 本文件的 `methodKeyOfModelType`。字段缺省 ⇒ `null` ⇒ chip 不 push 该段。
   *  · 选项表：官方 `EJ(o.model)`（canvas:@815812 逐字）= `videoMethodKeys`（顺序 `frames→reference→edit`）。
   *  · 写入：官方 `an`（canvas:@2058180 逐字）
   *    `const kn = dDe(o.model, so, u.imageCount, u.videoCount, u.audioCount);
   *     if (kn) { …; i({ modelType: kn.modelType, variant: kn.variant, ...er }) }`
   *    `i` = `updateParams` = `t(e,h=>({params:{...h.data?.params,...f}}))`。
   *  ✅ §71 已接线：`u.imageCount/videoCount/audioCount` 走官方 `LXe` 的 `parentCounts`
   *      （上游连线素材计数，逐字出处见 `utils/referenceTokens.ts` 的
   *        `collectParentReferenceCounts`；MTV 侧唯一一处「刻意收窄」也在那段注释里记账）。 */
  const videoCatalogModelId = (() => {
    const aliases = imageModelAliases(data?.model);
    return aliases.find((alias) => Boolean(getParamEntry(alias))) ?? data?.model;
  })();
  const generateMethod = methodKeyOfModelType(
    /* 官方 `LXe` @1988649 的 `currentVariant`（`d`）与官方 `Tr` 建卡工厂 @737829 是同一条规则：
       `modelType` 为空、或不在该模型 `variants` 里 ⇒ 取 `variants[0]`。
       MTV 的 `params.modelType` 会因模型值是 `general/<cfgId>`（别名建卡时未解析）而落成 `null`
       ⇒ 走官方同一条兜底，否则组门 `M = b && _ && _.length>0 && v` 永远为假。取证与登记见
       `modelParamCatalog.currentVariantModelType` 的注释。 */
    currentVariantModelType(
      videoCatalogModelId,
      typeof data?.params?.modelType === 'string' ? data.params.modelType : undefined,
    ),
  ) ?? undefined;
  const availableGenerateMethods = videoMethodKeys(videoCatalogModelId);

  /* ══ §124 官方 `Tr` 建卡工厂写进 `params` 的**默认值**（`...x?.defaults`）══
     官方 @737829 逐字：`x=(e.params?.modelType?h.variants.find(k=>k.modelType===e.params?.modelType):null)||h.variants[0]`,
       `w={model:f,provider:h.provider,modelType:x?.modelType||null,**...x?.defaults||{}**}`。
     ⇒ 官方节点天生带 `generateAudio`（seedance-2.5 = `true`）与 `enableWebSearch`（默认无 = `false`）。
     ⚠️ MTV 的模型值是 `general/<cfgId>`，`officialVideoNodeParamsSeed` 里 `getParamEntry(model)` 命中不了别名
        ⇒ 这些 defaults **没被写进节点**。真机取证（只读 CDP 9333）：视频节点 `data.generateAudio === undefined`
        ⇒ 官方 chip 的音频门 `g = i && l !== void 0`（`Poe` 逐字）为假 ⇒ **底栏那颗 🔊 图标不渲染**
        （用户：「音频的图标呢?」），同时面板「生成音频」两个格子都不高亮。
     ⇒ 读取端按官方同一条 `variants[0].defaults` 规则补回；已有值不动。 */
  const catalogVariantDefaults = getParamEntry(videoCatalogModelId)?.variants?.[0]?.defaults;
  const effectiveGenerateAudio = (data?.generateAudio as boolean | undefined)
    ?? catalogVariantDefaults?.generateAudio;
  const effectiveEnableWebSearch = (data?.params?.enableWebSearch as boolean | undefined) ?? false;

  const onChangeEnableWebSearch = useCallback((value: boolean) => {
    if (!activeNodeId) return;
    const current = useAppStore.getState().nodes.find((item) => item.id === activeNodeId)?.data;
    /* 官方 `fQe` 的写入口逐字：`i = l => { t({enableWebSearch: l}) }`，`t` = `updateParams`
       = `t(e,h=>({params:{...h.data?.params,...f}}))` ⇒ 落在 `params.enableWebSearch`。 */
    updateNodeData(activeNodeId, {
      params: { ...(current?.params ?? {}), enableWebSearch: value },
    });
  }, [activeNodeId, updateNodeData]);

  /* ══ §124 官方底栏「高级设置」（⚙ lucide `settings-2`）的内容 ══
     ① 按钮本体（canvas:@1198587 逐字）：
        `O && s.jsxs(s.Fragment,{children:[s.jsx("div",{className:"w-px h-4 bg-border"}),
           s.jsx(Gt,{content:L("common.advancedSettings"),children:s.jsx("button",{type:"button",onClick:M,
             className:z("flex items-center justify-center rounded-lg px-2.5 py-2.5 transition-colors",
                         "hover:bg-muted active:bg-white/[0.1]"),
             "data-testid":At.CANVAS.NODE.GENERATION_INPUT_BAR.ADVANCED_SETTINGS_TOGGLE,
             children:s.jsx(Q$,{className:"h-4 w-4 text-foreground"})})})]})`
        `O` = `hasAdvancedSettings`（= `!!advancedSettings && !readonly`）；真机 9222：按钮 36×36
        @(1005.5,682.6)，图标 16×16 `class="lucide lucide-settings2 lucide-settings-2 h-4 w-4 text-foreground"`，
        左右各一条 `div.w-px.h-4.bg-border`（1×16 @x=1000.5 / 760.6）。
     ② 内容 `Kf`（canvas:@2067700 邻域 switch 逐字）：
        `case vt.SEEDANCE_2_0: case vt.SEEDANCE_2_5: case vt.SEEDANCE_2_5_DRAFT:
           return o.modelType!==zt.TEXT_TO_VIDEO ? null : s.jsx(fQe,{params:d,updateParams:i,disabled:n||T||I})`
        ⇒ **模型 ∈ {seedance-2.0, seedance-2.5, seedance-2.5-draft} 且 `modelType === "text_to_video"`** 才有内容。
     ③ 内容组件 `fQe`（canvas:@1999407 逐字）：
        `fQe=({params:e,updateParams:t,disabled:n=!1})=>{const{t:o}=ne(),r=e?.enableWebSearch??!1,
           i=l=>{t({enableWebSearch:l})};
           return s.jsxs("div",{className:"flex items-center justify-between",children:[
             s.jsx("span",{className:"text-sm text-muted-foreground",children:o("videoConfigs.enableWebSearch")}),
             s.jsx(ua,{checked:r,onCheckedChange:i,disabled:n})]})}`
        `videoConfigs.enableWebSearch` zh = 「联网搜索」（`index-CsQaPZ-H.js` `CI` @914866 区）；
        `ua` = 官方 shadcn `Switch` 原语（MTV 已有同一原语，见 `ConfirmationCardParts` 的用法）。
     ⚠️ 登记：MTV 的**请求层尚未把 `enableWebSearch` 发给上游**（全仓只有
        `generationConfirmationProtocol.ts` 的 `enable_web_search` 映射）⇒ 本开关目前只落 `params`，
        与官方 `fQe` 的读写口径一致，但真正生效还需要请求层跟进（不在本次 6+3 项范围内）。 */
  const openSeedanceWebSearch = [
    'seedance-2.0', 'seedance-2.5', 'seedance-2.5-draft',
  ].includes(videoCatalogModelId ?? '')
    && (data?.params?.modelType === 'text_to_video'
      || currentVariantModelType(videoCatalogModelId, data?.params?.modelType as string | undefined) === 'text_to_video');
  const videoAdvancedSettings = useMemo(() => {
    if (nodeType !== 'ai-video' || !openSeedanceWebSearch) return undefined;
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('联网搜索')}</span>
        <SwitchPrimitive.Root
          checked={effectiveEnableWebSearch}
          disabled={Boolean(data?.loading)}
          /* §126 官方 Switch 逐字（`vendor-packages-CvEFn1fJ.js` @455140，shadcn `Switch` = `Z4`）：
               root: `I("peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-xs transition-colors",
                       "focus-visible:outline-hidden focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                       "disabled:cursor-not-allowed disabled:opacity-50",
                       "data-[state=checked]:bg-primary",
                       "data-[state=unchecked]:bg-zinc-800 data-[state=unchecked]:shadow-inner", className)`
               thumb: `I("pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform
                        data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4")`
             ⇒ 开 = `bg-primary`（MTV 的 `--primary` = `#1fa2dc`，见 tailwind.config 的官方 dark 表注释）·
               关 = `bg-zinc-800`(#27272a) + `shadow-inner`；圆点**恒 `bg-white`**，位置由 `translate-x-0/4` 切。
             ⚠️ MTV 改前用 `data-[state=unchecked]:bg-input` + 圆点 `bg-background` ⇒ 关态灰底发蓝、
                圆点不是纯白（用户图5「开关的打开和关闭的颜色也不对」）。 */
          className="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-zinc-800 data-[state=unchecked]:shadow-inner"
          onCheckedChange={onChangeEnableWebSearch}
        >
          <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4" />
        </SwitchPrimitive.Root>
      </div>
    );
  }, [nodeType, openSeedanceWebSearch, effectiveEnableWebSearch, data?.loading, onChangeEnableWebSearch, t]);

  const onGenerateMethodChange = useCallback(
    (method: VideoMethodKey) => {
      if (!activeNodeId) return;
      const current = useAppStore.getState().nodes.find((item) => item.id === activeNodeId)?.data;
      const model = current?.model as string | undefined;
      const modelId = imageModelAliases(model).find((alias) => Boolean(getParamEntry(alias))) ?? model;
      const parentCounts = readParentCounts();
      const resolved = videoVariantForMethod(
        modelId,
        method,
        parentCounts.imageCount,
        parentCounts.videoCount,
        parentCounts.audioCount,
      );
      if (!resolved) return;
      updateNodeData(activeNodeId, {
        params: {
          ...(current?.params ?? {}),
          modelType: resolved.modelType,
          variant: resolved.variant,
        },
      });
    },
    [activeNodeId, updateNodeData, readParentCounts],
  );

  const onChangeAudioSpeechSettings = useCallback((value: AudioSpeechSettings) => {
    updateContinuousNodeData({ audioSpeechSettings: value });
  }, [updateContinuousNodeData]);

  const onRemoveAudioReference = useCallback((reference: AudioSpeechReference) => {
    finishContinuousEdit();
    const state = useAppStore.getState();
    const current = state.nodes.find((item) => item.id === activeNodeId)?.data;
    if (!current || !activeNodeId) return;
    if (reference.edgeId) {
      state.onEdgesChange([{ type: 'remove', id: reference.edgeId }]);
    } else {
      updateNodeData(activeNodeId, removeAudioSpeechReference(current.prompt ?? '', current.workflowInputs, reference));
    }
  }, [activeNodeId, finishContinuousEdit, updateNodeData]);

  const onChangeAudioVoice = useCallback(
    (value: AudioTtsVoice) => updateNodeData(activeNodeId!, { audioVoice: value }),
    [activeNodeId, updateNodeData],
  );

  const onChangeAudioFormat = useCallback(
    (value: AudioOutputFormat) => updateNodeData(activeNodeId!, { audioFormat: value }),
    [activeNodeId, updateNodeData],
  );

  const onChangeAudioSpeed = useCallback(
    (value: number) => updateContinuousNodeData({ audioSpeed: value }),
    [updateContinuousNodeData],
  );

  const onChangeMusicTitle = useCallback(
    (value: string) => updateContinuousNodeData({ musicTitle: value }),
    [updateContinuousNodeData],
  );

  const onChangeMusicLyrics = useCallback(
    (value: string) => updateContinuousNodeData({ musicLyrics: value }),
    [updateContinuousNodeData],
  );

  const onChangeMusicBpm = useCallback(
    (value: number | undefined) => updateContinuousNodeData({ musicBpm: value }),
    [updateContinuousNodeData],
  );

  const onChangeMusicDuration = useCallback(
    (value: number) => updateContinuousNodeData({ musicDuration: value }),
    [updateContinuousNodeData],
  );

  const onChangeAutoGenerateLyrics = useCallback(
    (value: boolean) => updateNodeData(activeNodeId!, { autoGenerateLyrics: value }),
    [activeNodeId, updateNodeData],
  );

  const onStyleChange = useCallback(
    (styleId: string) => updateNodeData(activeNodeId!, { style: styleId }),
    [activeNodeId, updateNodeData]
  );

  const onAnimationActionChange = useCallback(
    (action: AnimationAction) => updateNodeData(activeNodeId!, { animationAction: action }),
    [activeNodeId, updateNodeData]
  );

  const onAnimationFramesChange = useCallback(
    (value: number) => updateNodeData(activeNodeId!, { animationFrames: value as BaseNodeData['animationFrames'] }),
    [activeNodeId, updateNodeData]
  );

  // Early return must come after ALL hooks
  /* ★★ 画廊打开期间：**整条浮层不挂载**（官方 `l.jsx(uu,{visible:k&&!O})` @3247045，`O=isGalleryOpen`
     ⇒ `visible=false` ⇒ `AnimatePresence` 把它整条卸掉）。见 `galleryOpenHere` 的官方出处记账。
     ⚠️ `&& !isExpanded`：全屏编辑态（`is-expanded`）保持挂载 —— 官方那条门是给「节点浮条」的，
        全屏编辑器不是同一层，别顺手一起卸掉。
     ⚠️ 上一版（80eab50）走的是 `.node-float-ui-hidden`（display:none，DOM 仍在）——**本版改成 unmount**，
        与官方 DOM 级一致（9444 实测展开态 `document.querySelectorAll('.node-float-ui').length === 0`）。 */
  if (!activeNodeId || !node || !data || !nodeType) return null;
  if (galleryOpenHere && !isExpanded) return null;
  /* ★★ 堆叠（PILE）：**整条不挂载**（官方语义，见上方 `hiddenInPile` 的记账）。
     ⚠️ 旧实现是**挂载后挂 `.node-float-ui-hidden` 类**（display:none）。问题：
        `hiddenInPile` 依赖 `activeNodeId`，而 `activeNodeId` 会在 `null ↔ pileId` 之间反复横跳
        ⇒ 同一个浮条上 **`node-float-ui-hidden` 与 `node-float-ui-visible` 两个类同时存在、且互相抢**
        ⇒ 再加上堆叠卡自己 hover 出的 `.node-floating-toolbar`（它硬编码带 `-visible`），
          画布上表现为「**两个工具栏 + 闪烁**」（用户实测：生成中/生成后都闪）。
     官方 `uJe`（堆叠节点）里**根本没有这条编辑区**（点堆叠卡的语义是进全屏堆叠画廊）
     ⇒ 这里按官方改成**不挂载**，而不是"挂载再隐藏"。全屏编辑态（`isExpanded`）不受影响。 */
  if (hiddenInPile && !isExpanded) return null;
  /* ★★ 用户 2026：「对比卡 不需要出现 底部编辑区，只需要出现 左侧 + 按钮，
     能我链接入图卡 实现对比就行」。
     「对比」节点的输入是**连进来的两张图**，不是提示词 ⇒ 这条编辑器（模型/比例/提示词/生成按钮）
     对它没有任何意义，参考实现 `compareNode` 也没有这块 UI。
     ⇒ 与上面两条同一口径：**整条不挂载**（`isExpanded` 对它也毫无意义，不必放行）。 */
  if (nodeType === 'compare') return null;

  const recoverableComfyTask = currentProjectId && data.status !== 'loading'
    ? getPendingTasksForProject(currentProjectId).find((task) => task.nodeId === activeNodeId && task.taskType === 'comfyui' && task.comfyRecoveryState)
    : undefined;
  const cloudTask = currentProjectId ? getPendingTasksForProject(currentProjectId).find((task) => task.nodeId === activeNodeId && ['runninghub-workflow', 'runninghub-model'].includes(task.taskType)) : undefined;
  const workflowApiTask = currentProjectId ? getPendingTasksForProject(currentProjectId).find((task) => task.nodeId === activeNodeId && task.taskType === 'workflow-api') : undefined;
  const cloudOutputs = data.workflowApiOutputs ?? data.runninghubOutputs;

  const audioPurpose = data.audioPurpose
    ?? (data.model ? findMediaModelOption(data.model)?.audioPurpose : undefined);

  // 官方：底部编辑区在卡片下方 **8 流**（= Tailwind `-bottom-2` ✓），屏幕值 = 8 × zoom ✓

  return (
    <>
      {isExpanded && (
        <button
          type="button"
          className="ai-dialog-expanded-backdrop"
          aria-label={t('还原')}
          onClick={() => setIsExpanded(false)}
        />
      )}

      <div
        ref={panelRef}
        /* 官方类名（`zoom-slider-3ZcFvYQO.js` @1691826 逐字）：
             `node-float-ui generation-input-bar-width-transition nodrag cursor-default
              absolute -bottom-2 z-20 …` + `node-float-ui-visible` / `node-float-ui-hidden`
           MTV 的面板是 fixed 浮层（位置靠 JS 逐帧写），所以只取**语义**：
             `.node-float-ui-visible` → 正常显示、`.node-float-ui-hidden` → `display:none` ✓
           ⚠️ `is-expanded`（全屏编辑）时即便多选也要保持可见 ⇒ `:not(.is-expanded)` 兜底 ✓
           ＋ 画廊展开期间**不再走这个类**：整条浮层已在上面的 early return 里**不挂载**
             （= 官方 `visible:k&&!O` 的 unmount 语义）⇒ 这条 class 里保留 `galleryOpenHere` 只会是死分支，已移除 */
        className={`ai-dialog-float node-float-ui generation-input-bar-width-transition${isExpanded ? ' is-expanded' : ''} ${
          multiSelected || anyNodeDragging || hiddenInPile
            ? OFFICIAL_BAR_HIDDEN_CLASS
            : OFFICIAL_BAR_VISIBLE_CLASS
        }`}
        /* ★ 官方同一元素的 `data-testid`（web @1198716 逐字）：
             `"data-testid": At.CANVAS.NODE.GENERATION_INPUT_BAR.CONTAINER`
           —— 官方 CDP 实测选择器就是 `[data-testid="canvas-node-generation-input-bar"]`
             （见 `src/utils/officialInputBar.ts:15` 的记账）。 */
        data-testid={GENERATION_INPUT_BAR_TESTID}
        role={isExpanded ? 'dialog' : undefined}
        aria-modal={isExpanded ? true : undefined}
        aria-label={isExpanded ? t('节点生成对话框') : undefined}
        style={isExpanded ? undefined : (dialogPosition ? {
          // ⚠️ 这里**故意不写 left/top**：位置由命令式代码独占写入
          //    （见下方的定位 effect 与 canvas-viewport-change 处理器）。
          //    交给 React 管会和逐帧跟随写入互相覆盖：
          //    React 一重渲染就把面板拉回 store 里的旧 dialogPosition，
          //    下一帧命令式写入又拉回来 —— 实测产生 ±1200px 的位置跳变（用户报的"抖动"）。
          //
          // ★★ **方案 A 已落地：transform 完全交给 JS** ✓（`applyDialogTransform()` ✓）
          //    这里**不要再写 transform / left / top** ✗
          //    —— React 每次重渲染都会把它们覆盖回旧值 ✗ 这正是"间距漂移 / 一卡一卡"的来源之一 ✓
          //    JS 的公式：translate(origin+v) · scale(zoom×0.5) · translate(flow×2) · translateX(-50%)
          //    与画布 transform **逐像素同源** ✓ 同帧 ✓ 零重排 ✓
          //
          // ★ 官方**同一个 style 对象**里的那几项（`Qe`，@1691826 逐字）：
          //     `{ left:"50%", "--float-y":"100%", "--float-offset":"-12px",
          //        transformOrigin:"top center", … }`
          //   官方靠 CSS `.node-float-ui-visible{ transform: translate(-50%)
          //     translateY(var(--float-y,0%)) scale(var(--float-scale,1)) }` 消费它们；
          //   MTV 是 fixed 浮层、位置由 `applyDialogTransform()` 命令式写 ⇒ **按官方照抄变量**
          //   （便于逐项对照，且 `--float-scale` 是官方全局发布、跨组件读取的量 ✓）。
          //   ⚠️ `left:"50%"` **故意不写**：写了会和命令式写入互相覆盖（见上）✗
          '--float-y': '100%',
          '--float-offset': '-12px',
          '--float-scale': String(1 / currentCanvasZoom()),
          transformOrigin: 'top center',
        } as React.CSSProperties : {
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        })}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {data.status === 'loading' && !performanceMode && (
          <Suspense fallback={null}>
            <BorderBeam
              className="ai-dialog-beam"
              borderRadius={14}
              colorVariant="colorful"
              /* 长宽比大，角度匀速旋转在角落会加速；放慢一圈的时间让观感平顺些 */
              duration={5}
              strength={0.85}
              theme={typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'}
            >
              {null}
            </BorderBeam>
          </Suspense>
        )}
        {/* （参考图条已搬进 prompt 卡片内的顶行 —— 见下方 `<PromptPanel referenceStrip=…>`；
             MTV 原来这里还有一条 `is-expanded` 的面板外浮条 ✗ 一并删除） */}
        {/* 官方底部编辑区没有「放大/最大化」按钮（实测只有 3 行：工具行 / 输入 / 底行），
            MTV 这个展开按钮已移除，对齐官方。 */}
        {['runninghubwf', 'runninghub'].includes(data.provider ?? '') && data.runninghubStage && <p role="status" className="px-3 py-1 text-xs text-text-text-secondary">RunningHub · {data.runninghubStage}</p>}
        {data.provider === 'workflow-api' && data.workflowApiStage && <p role="status" className="px-3 py-1 text-xs text-text-text-secondary">AutoDL · {data.workflowApiStage}</p>}
        {workflowApiTask && data.status !== 'loading' && <WorkflowApiTaskStatus key={`${activeNodeId}:${workflowApiTask.workflowApi?.attemptId}`} task={workflowApiTask} />}
        {cloudTask && data.status !== 'loading' && <div className="ui-card m-2 flex flex-col gap-2 p-3 text-xs">
          <p>{cloudTask.taskId ? `任务 ${(cloudTask.taskIds?.length ? cloudTask.taskIds : [cloudTask.taskId]).join('、')} 已保留，可以继续查询。${cloudTask.runninghubSubmissionUncertain ? '另有提交状态未知，请到平台核对后再清除恢复记录。' : ''}` : '提交状态未知。请到 RunningHub 平台核对，补充任务 ID 后继续查询。'}</p>
          {!cloudTask.taskId && <input aria-label="RunningHub 任务 ID" className="ui-input w-full" value={recoveryInput.nodeId === activeNodeId ? recoveryInput.taskId : ''} inputMode="numeric" onChange={(event) => setRecoveryInput({ nodeId: activeNodeId, taskId: event.target.value, confirmed: false })} />}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="ui-btn ui-btn--sm" onClick={() => {
              if (!cloudTask.taskId) {
                if (recoveryInput.nodeId !== activeNodeId || !/^\d{1,30}$/.test(recoveryInput.taskId.trim())) { showToast('请填写正确的任务 ID', 'error'); return; }
                updatePendingTask(activeNodeId, { taskId: recoveryInput.taskId.trim(), taskIds: [recoveryInput.taskId.trim()], submitted: true, runninghubRecoveryState: 'disconnected', runninghubSubmissionUncertain: false }, '');
              }
              void resumeRunningHubNodeTask(activeNodeId).catch((error: unknown) => showToast(error instanceof Error ? error.message : '恢复查询失败', 'error'));
            }}>继续查询 / 保存</button>
            {cloudTask.taskId && <button type="button" className="ui-btn ui-btn--sm ui-btn--danger" onClick={() => { void onCancelGeneration(); }}>请求远端取消</button>}
          </div>
          <details><summary className="cursor-pointer text-text-text-secondary">在平台确认任务结束后解除限制</summary>
            <label className="my-2 flex gap-2"><input type="checkbox" checked={recoveryInput.nodeId === activeNodeId && recoveryInput.confirmed} onChange={(event) => setRecoveryInput({ nodeId: activeNodeId, taskId: '', confirmed: event.target.checked })} />我已在平台确认任务未提交或已经结束</label>
            <button type="button" className="ui-btn ui-btn--sm" disabled={recoveryInput.nodeId !== activeNodeId || !recoveryInput.confirmed} onClick={() => { removePendingTask(activeNodeId, cloudTask.taskId); updateNodeDataTransient(activeNodeId, { status: 'idle', error: undefined, runninghubStage: undefined }); setRecoveryInput({ nodeId: '', taskId: '', confirmed: false }); }}>清除本地恢复记录</button>
          </details>
        </div>}
        {cloudOutputs && cloudOutputs.length > 1 && <details className="ui-card m-2 p-2 text-xs"><summary className="cursor-pointer">全部产物 · {cloudOutputs.length}</summary><div className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto">{cloudOutputs.map((output, index) => <div key={`${output.url}:${index}`}>
          <p className="mb-1 text-text-text-secondary">产物 {index + 1}{output.nodeId ? ` · 节点 ${output.nodeId}` : ''}</p>
          {output.kind === 'image' ? <img className="max-h-48 max-w-full object-contain" src={output.url} alt={`产物 ${index + 1}`} /> : output.kind === 'video' ? <video className="max-h-48 w-full" src={output.url} controls preload="metadata" /> : <audio className="w-full" src={output.url} controls preload="metadata" />}
        </div>)}</div></details>}
        {recoverableComfyTask && (
          <div className="ui-alert ui-alert--warning mx-3 mb-2 flex-wrap" role="status">
            <span className="min-w-0 flex-1 text-xs">
              {recoverableComfyTask.comfyRecoveryState === 'cancel_pending'
                ? t('ComfyUI 取消尚未确认，任务已保留')
                : t('ComfyUI 查询中断，任务已保留')}
            </span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="ui-btn ui-btn--sm" onClick={() => {
                void resumeComfyUINodeTask(activeNodeId).catch(() => showToast(t('继续查询失败，任务仍保留'), 'error'));
              }}>{t('继续查询')}</button>
              <button type="button" className="ui-btn ui-btn--sm ui-btn--danger" onClick={() => { void onCancelGeneration(); }}>{t('再次终止')}</button>
            </div>
          </div>
        )}
        <PromptPanel
          editorRef={editorApiRef}
          /* ★ 官方 `onMediaClick`：点上游引用缩略图 ⇒ 把该引用**插进提示词输入区**
             （用户 2026：「点击缩略图窗口 官方会自动让参考图进入输入区，MTV 现在无法点击 也无法进去」）。
             官方源码就是 `k.current?.insertMention?.(pt)` —— MTV 的等价物就是编辑器的
             `insertMentionAtCursor(nodeId, label)`（原本只在 `@` 菜单里被调过，从没接到这条链路上）。 */
          onInsertReferenceMention={(reference) => {
            editorApiRef.current?.insertMentionAtCursor(reference.nodeId, reference.label);
          }}
          nodeType={nodeType}
          nodeId={activeNodeId}
          prompt={data.prompt || ''}
          placeholder={t('描述任何你想要生成的内容')}
          selectedModel={data.model}
          selectedProvider={data.provider}
          selectedWorkflowId={data.workflowId}
          animationAction={data.animationAction ?? 'idle'}
          onAnimationActionChange={onAnimationActionChange}
          animationFrames={data.animationFrames ?? 8}
          onAnimationFramesChange={onAnimationFramesChange}
          canGenerate={data.status !== 'loading' && !recoverableComfyTask && !cloudTask && !workflowApiTask}
          isGenerating={data.status === 'loading'}
          onCancelGeneration={['comfyui', 'runninghubwf', 'runninghub', 'workflow-api'].includes(data.provider ?? '') ? () => { void onCancelGeneration(); } : undefined}
          onChange={onPromptChange}
          onContinuousEditEnd={finishContinuousEdit}
          onSubmit={onSubmit}
          onModelSelect={onModelSelect}
          onWorkflowSelect={onWorkflowSelect}
          runninghubModelParameters={data.runninghubModelParameters}
          onRunninghubModelParametersChange={(runninghubModelParameters) => updateNodeData(activeNodeId, { runninghubModelParameters })}
          workflowInputs={data.workflowInputs}
          onWorkflowInputsChange={(workflowInputs) => updateNodeData(activeNodeId, { workflowInputs })}
          onPassThrough={supportsPassThrough ? onPassThrough : undefined}
          imageSize={(data.imageSize as string) || '2K'}
          aspectRatio={(data.aspectRatio as string) || (nodeType === 'ai-panorama' ? '2:1' : '1:1')}
          onChangeImageSize={onChangeImageSize}
          onChangeAspectRatio={onChangeAspectRatio}
          /* ★★★★★ **「精细度」+「透明背景」接线到节点数据** ✓✓（官方弹窗的第 3、4 组 ✓）
               官方：`defaults.quality` 随模型 ✓ · `background:"transparent"` 只对 2.5 系列 ✓
               （此前 UI 有了但**值没落地** ✗ —— 点完不生效 ✓ 已接 ✓）*/
          quality={data.quality as string | undefined}
          onChangeQuality={onChangeQuality}
          transparentBackground={data.transparentBackground === true}
          onChangeTransparentBackground={onChangeTransparentBackground}
          batchCount={(data.batchCount as number) || 1}
          onChangeBatchCount={onChangeBatchCount}
          cameraSettings={data.cameraSettings}
          onChangeCameraSettings={onChangeCameraSettings}
          videoResolution={data.videoResolution as number | undefined}
          videoFps={data.videoFps as number | undefined}
          videoFrames={data.videoFrames as number | undefined}
          onChangeVideoResolution={onChangeVideoResolution}
          onChangeVideoFps={onChangeVideoFps}
          seedanceResolution={data.seedanceResolution as string | undefined}
          seedanceRatio={data.seedanceRatio as string | undefined}
          seedanceDuration={data.seedanceDuration as number | undefined}
          generateAudio={effectiveGenerateAudio}
          /* §124 官方 `fx` 的 `advancedSettings`（`v`）—— 见上方 `videoAdvancedSettings` */
          advancedSettings={videoAdvancedSettings}
          videoReferences={data.videoReferences}
          onChangeVideoReferences={onChangeVideoReferences}
          onChangeSeedanceResolution={onChangeSeedanceResolution}
          onChangeSeedanceRatio={onChangeSeedanceRatio}
          onChangeSeedanceDuration={onChangeSeedanceDuration}
          onChangeGenerateAudio={onChangeGenerateAudio}
          generateMethod={generateMethod}
          availableGenerateMethods={availableGenerateMethods}
          onGenerateMethodChange={onGenerateMethodChange}
          /* §131 官方 `ha` 首尾帧行的两个帧槽「+」（官方 `nt("first")/nt("last")`） */
          onRequestFrameSlot={onRequestFrameSlot}
          /* §93 官方目录表兜底（`videoModelInfo`）需要官方 `state.modelType` 原样串 */
          videoModelType={typeof data?.params?.modelType === 'string' ? data.params.modelType : undefined}
          audioPurpose={audioPurpose}
          audioSpeechSettings={data.audioSpeechSettings}
          onChangeAudioSpeechSettings={onChangeAudioSpeechSettings}
          onRemoveAudioReference={onRemoveAudioReference}
          audioVoice={data.audioVoice ?? 'alloy'}
          audioFormat={data.audioFormat ?? 'wav'}
          audioSpeed={data.audioSpeed ?? 1}
          musicTitle={data.musicTitle ?? ''}
          musicLyrics={data.musicLyrics ?? ''}
          musicBpm={data.musicBpm}
          musicDuration={data.musicDuration ?? 60}
          autoGenerateLyrics={data.autoGenerateLyrics ?? false}
          onChangeAudioVoice={onChangeAudioVoice}
          onChangeAudioFormat={onChangeAudioFormat}
          onChangeAudioSpeed={onChangeAudioSpeed}
          onChangeMusicTitle={onChangeMusicTitle}
          onChangeMusicLyrics={onChangeMusicLyrics}
          onChangeMusicBpm={onChangeMusicBpm}
          onChangeMusicDuration={onChangeMusicDuration}
          onChangeAutoGenerateLyrics={onChangeAutoGenerateLyrics}
          workflows={workflows}
          selectedStyle={data.style as string | undefined}
          onStyleChange={onStyleChange}
        />
      </div>
    </>
  );
}

export default memo(AINodeDialog);
