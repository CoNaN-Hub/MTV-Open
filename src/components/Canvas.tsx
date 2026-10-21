/**
 * Canvas 画布主组件 — React Flow 画布核心，管理节点/边渲染、拖放、连线、右键菜单、空状态
 */
import { lazy, Suspense, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useT } from '../i18n';
import { isReferenceableNodeType } from './chat/referenceableNodes';
import NodeSelectionPickToolbar from './chat/NodeSelectionPickToolbar';
import NodeSelectionPickLayer from './chat/NodeSelectionPickLayer';
import { planReferencePromptRewrites } from '../utils/referencePromptPlan';
import { createPortal } from 'react-dom';
import { ReactFlow,
  Background,
  Handle,
  Position,
  BackgroundVariant,
  ConnectionMode,
  SelectionMode,
  PanOnScrollMode,
  useReactFlow,
  useStoreApi,
  useStore,
  useViewport,
  ReactFlowProvider,
  Panel,
  applyNodeChanges,
  type OnSelectionChangeParams,
  type NodeChange,
  type EdgeTypes,
} from '@xyflow/react';
/* ⚠️ `@xyflow/react/dist/style.css` 已移到 `main.tsx`（必须早于 `./index.css`，
   否则官方那套缩放控制点规则会被库 CSS 盖掉）—— 这里不要再导入。 */
import TextNode from './nodes/TextNode';
import ImageNode from './nodes/ImageNode';
import VideoNode from './nodes/VideoNode';
import AudioNode from './nodes/AudioNode';
import AnimationNode from './nodes/AnimationNode';
import MarkdownNode from './nodes/MarkdownNode';
import StoryboardNode from './nodes/StoryboardNode';
import ShotlistNode from './nodes/ShotlistNode';
import GroupNode from './nodes/GroupNode';
import PileNode from './nodes/PileNode';
import { PileGalleryProvider, PileGalleryHost } from './nodes/PileGalleryProvider';
import { PileMemberActionsScope } from './nodes/PileMemberActionsProvider';
import CanvasNoteNode from './noteNodes/CanvasNoteNode';
import CompareNode from './nodes/CompareNode';
import MockupNode from './nodes/mockup/MockupNode';
import PluginNode from './nodes/PluginNode';
import NodeRenderBoundary from './nodes/shared/NodeRenderBoundary';
import CanvasNodeLodBoundary from './nodes/shared/CanvasNodeLodBoundary';
import { CanvasNodeLodContext } from '../hooks/useCanvasNodeLod';
import { createCanvasNodeLodRuntime } from '../services/canvasNodeLodRuntime';
import { isEditableTarget } from '../utils/textSelection';
import { playNodeFocusPulse } from '../utils/nodeAnimations';
import ConnectionMenu from './canvas/ConnectionMenu';
import SaveToLibraryDialog from './canvas/SaveToLibraryDialog';
import ElementEditorPanel from './canvas/ElementEditorPanel';
import { registerCanvasSelectionController } from '../services/canvasSelectionService';
import { moveAssetToLibraryFolder, copyAssetToLibraryFolder, moveLibraryFolderTree, copyLibraryFolderTree } from '../services/assetRowActions';
/* 官方「添加 → 上传」第二步：选系统文件 → 拷进所选素材库文件夹（`t822-C2` 实测的两步流程） */
import { addAssetFilesToLibraryFolder } from '../services/fs/assetLibrary';
/* 官方「上传/下载」进度浮层（用户实测截图 图1/图2：缩略图 + 文件名 + 环形百分比；完成即消失、不弹 toast） */
import { saveNodeToLibrary } from '../services/saveToLibrary';
import CanvasContextMenu from './canvas/CanvasContextMenu';
import NodeContextMenu from './canvas/NodeContextMenu';
import CanvasControlPill from './canvas/CanvasControlPill';
import PinBar from './canvas/PinBar';
/* 画布内「返回我的项目」品牌按钮（官方 AppNavBar 顶部居中的火焰 logo，逐字复刻） */
import BrandFlameButton from './shared/BrandFlameButton';
import { setWorkspaceLandingTab } from './workspace/workspaceLanding';
import CanvasDrawingToolbar from './canvas/CanvasDrawingToolbar';
import CanvasNoteStylePanel from './canvas/CanvasNoteStylePanel';
import MiniMapNodeStats from './canvas/MiniMapNodeStats';
import SelectionToolbar from './canvas/SelectionToolbar';
import CanvasEmptyState from './canvas/CanvasEmptyState';
import CanvasViewportEmptyHint from './canvas/CanvasViewportEmptyHint';
import HistoryTimelinePanel from './canvas/HistoryTimelinePanel';
import { CANVAS_TOP_OVERLAYS } from '../config/canvasTopOverlays';
import SelectedNodeFlowEdge from './canvas/SelectedNodeFlowEdge';
import ScissorsEdge from './canvas/ScissorsEdge';
import CommandMenuNode from './canvas/CommandMenuNode';
import CanvasRadialMenu, { CanvasLongPressIndicator } from './canvas/CanvasRadialMenu';
import NodePluginToolDialog from './nodes/shared/toolbar/NodePluginToolDialog';
import { useConnectionDropMenu } from '../hooks/useConnectionDropMenu';
import { useCanvasContextMenu } from '../hooks/useCanvasContextMenu';
import { useNodeContextMenu } from '../hooks/useNodeContextMenu';
import { useCanvasSecondaryClickMenu } from '../hooks/useCanvasSecondaryClickMenu';
import { useCanvasLongPressRadialMenu } from '../hooks/useCanvasLongPressRadialMenu';
import { useAppStore } from '../store/useAppStore';
import { filterHiddenCanvasElements, isCanvasConnectionValid } from '../store/store.nodes';
import {
  createCanvasEdgeProjection,
  createCanvasNodeProjectionCache,
  getCanvasNodeById,
  hydrateCanvasNodeChanges,
  hydrateCanvasNodeData,
  projectCanvasNodesForReactFlow,
  projectSelectedCanvasEdges,
  projectTransientCanvasNode,
  syncCanvasNodeIndex,
} from '../utils/canvasRenderProjection';
/* 官方 PILE 拖拽入堆的命中判定（`page-DPdEgTS0.js` 的 `P1`/`dme`/`ume`/`fme` 逐字） */
import { findPileDropTarget, readPileDropCandidates } from '../utils/officialPileDrop';
/* 官方 PILE 投影层 `pJe`@2987702 + 同堆叠内的边隐藏 `ict`@2988335 */
import { hideIntraPileEdges, projectPilesForReactFlow } from '../utils/officialPileProjection';
import { PILE_MEMBER_ANCHOR_CLASS } from '../utils/officialPile';
import { renderSizeOf } from '../utils/officialCanvasLayout';
/* ★ 官方「折叠变体数」`V0`（`page-DVqoHdTT.js`@1359987）—— 驱动「删除其他历史」的可见条件 */
import { officialVariantCount } from '../utils/officialNodeHistory';
import { isInputBarSuppressedNode } from '../utils/officialInputBar';
import { useNodeCreation } from '../hooks/useNodeCreation';
import { useCanvasDrawing } from '../hooks/useCanvasDrawing';
import { useCanvasWheelZoom } from '../hooks/useCanvasWheelZoom';
import { useHandleMagnet } from '../hooks/useHandleMagnet';
import type { BaseNodeData } from '../types';
import { SHOTLIST_FRAME_SOURCE_TYPES, STORYBOARD_CELL_SOURCE_TYPES } from '../types';
import type { Node as RFNode, NodeProps, NodeTypes, OnMove } from '@xyflow/react';
import { useNodeSnap, ResizeSnapContext, type SnapLine } from '../hooks/useNodeSnap';
import { useCanvasNodePresenceEnter } from '../hooks/useCanvasNodePresenceEnter';
import { useCanvasImagePush } from '../hooks/useCanvasImagePush';
import {
  setCanvasPointerPosition,
  setCanvasPointerClientPosition,
  getCanvasPointerPosition,
  isCanvasPointerOverCanvas,
} from '../services/canvasPointerService';
import {
  CANVAS_PAN_BY_EVENT,
  CANVAS_PAN_DURATION_MS,
  registerCanvasViewportController,
  type CanvasPanByDetail,
} from '../services/canvasViewportService';

// 懒加载：全景节点引入 three（体积大户），画布上出现全景节点时才加载
const PanoramaNodeLazy = lazy(() => import('./nodes/PanoramaNode'));
function PanoramaNode(props: { id: string; data: BaseNodeData; selected?: boolean }) {
  return <Suspense fallback={null}><PanoramaNodeLazy {...props} /></Suspense>;
}

// 懒加载：3D 导演台节点按需连接本地 Tauri 独立窗口
const DirectorDeskNodeLazy = lazy(() => import('./nodes/DirectorDeskNode'));
function DirectorDeskNode(props: { id: string; data: BaseNodeData; selected?: boolean }) {
  return <Suspense fallback={null}><DirectorDeskNodeLazy {...props} /></Suspense>;
}

const CharacterAssetDialog = lazy(() => import('./CharacterAssetDialog'));

/**
 * 官方 `eat`（`course-api-base-url-CGXqZmAy.js`@3425552 逐字）—— **堆叠成员的裸锚点**：
 * ```jsx
 * function eat(){ return l.jsxs("div",{className:"pointer-events-none size-full opacity-0","aria-hidden":!0,
 *   children:[l.jsx(lc,{id:"left", type:"target", position:In.Left,  className:"invisible"}),
 *             l.jsx(lc,{id:"right",type:"source", position:In.Right, className:"invisible"})]}) }
 * ```
 * 官方 `ZT`（@3425894 逐字）—— **出现条件**：
 * ```jsx
 * function ZT({nodeId:e,children:t}){
 *   return Sn(s => s.nodeLookup.get(e)?.className === xee) ? l.jsx(eat,{}) : t }   // xee = "pile-member-anchor"
 * ```
 * ⇒ 节点的 `className` **严格等于** `"pile-member-anchor"` 时，**整卡内容（图/标题/工具栏/角标）一律不渲染**，
 *    只画两个 invisible Handle 给边用（官方为 IMAGE/AUDIO/TEXT 三种渲染器都包了这一层：
 *    `tat`/`nat`/`sat`/`rat` @3425918…）。
 * ⚠️ MTV 唯一必须偏离的一处：官方 IMAGE 节点的左 Handle 本身是 `type:"target"`（@3425583 附近
 *    `Hte`/`Gte` 的 `canAcceptInput`），所以它的锚点写 target；MTV 的 `ImageNode` 两个 Handle
 *    都是 `type:"source"`（`ImageNode.tsx:1745/1748`），边的 `sourceHandle:"left"` 依赖
 *    `${nodeId}-left-source` 这个 handle 键 ⇒ 锚点必须与 MTV 自己的节点同型，否则同堆叠内
 *    从 left 出发的边会找不到 handle。结构（裸 div + 两个 invisible Handle）与官方逐字一致。
 */
function PileMemberAnchor() {
  return (
    <div className="pointer-events-none size-full opacity-0" aria-hidden="true">
      <Handle id="left" type="source" position={Position.Left} className="invisible" />
      <Handle id="right" type="source" position={Position.Right} className="invisible" />
    </div>
  );
}

// ── Node types mapping ──
/**
 * 给每个节点组件包一层错误边界：单个节点渲染抛错（脏数据、导入文件、旧版迁移残留）
 * 只降级成一张占位卡，画布其余部分继续可用。
 * 只在模块顶层调用一次 —— React Flow 要求 nodeTypes 与其中的组件身份保持稳定。
 */
function withNodeRenderBoundaries(types: NodeTypes): NodeTypes {
  return Object.fromEntries(Object.entries(types).map(([typeName, NodeComponent]) => {
    const mediaLod = typeName === 'ai-image' || typeName === 'source-image'
      || typeName === 'ai-video' || typeName === 'source-video';
    const Bounded = (props: NodeProps) => {
      /* 官方 `ZT`：`nodeLookup.get(id)?.className === "pile-member-anchor"` ⇒ 只渲染裸锚点 */
      const isPileMember = useStore(
        (state: { nodeLookup: Map<string, { className?: string }> }) =>
          state.nodeLookup?.get(props.id)?.className === PILE_MEMBER_ANCHOR_CLASS,
      );
      const liveData = useAppStore((state) => getCanvasNodeById(state.nodes, props.id)?.data);
      const data = liveData ?? props.data;
      if (isPileMember) return <PileMemberAnchor />;
      return (
        <NodeRenderBoundary nodeId={props.id} typeName={typeName} data={data}>
          {mediaLod ? (
            <CanvasNodeLodBoundary node={props} data={data as BaseNodeData} video={typeName.endsWith('video')}>
              <NodeComponent {...props} data={data} />
            </CanvasNodeLodBoundary>
          ) : <NodeComponent {...props} data={data} />}
        </NodeRenderBoundary>
      );
    };
    Bounded.displayName = `NodeBoundary(${typeName})`;
    return [typeName, Bounded] as const;
  }));
}

const nodeTypes: NodeTypes = withNodeRenderBoundaries({
  'ai-text': TextNode,
  'ai-image': ImageNode,
  'ai-video': VideoNode,
  'ai-audio': AudioNode,
  'ai-animation': AnimationNode,
  'ai-panorama': PanoramaNode,
  'ai-markdown': MarkdownNode,
  'ai-storyboard': StoryboardNode,
  'ai-shotlist': ShotlistNode,
  'ai-director': DirectorDeskNode,
  'source-text': TextNode,
  'source-image': ImageNode,
  'source-video': VideoNode,
  'source-audio': AudioNode,
  comment: TextNode,
  group: GroupNode,
  /* 官方 PILE（堆叠）：`[he.PILE]: h.memo(uJe)`（`zoom-slider-3ZcFvYQO.js`@3390539） */
  pile: PileNode,
  'canvas-note': CanvasNoteNode,
  /* 画布「对比」节点（A/B 两路图片对比；无输出接点） */
  compare: CompareNode,
  mockup: MockupNode,
  'plugin-node': PluginNode,
  /* 官方 `type: COMMAND`：连线菜单的隐形占位节点（两个 invisible Handle 当连线锚点）*/
  'command-menu': CommandMenuNode,
});

const edgeTypes: EdgeTypes = {
  'selected-node-flow': SelectedNodeFlowEdge,
  'scissors-edge': ScissorsEdge,
};

// ── Stable ReactFlow props (hoisted to avoid new identities every render,
//    which makes React Flow re-run internal effects and drop frames on drag) ──
const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1 };
const PRO_OPTIONS = { hideAttribution: true };
const PAN_ON_DRAG_DEFAULT = [1, 2]; // 默认交互：右键(2) + 中键(1) 拖拽平移
const PAN_ON_DRAG_CLASSIC = [0];    // 传统交互：左键(0) 拖拽平移
// 连线本体 — TapNow 官方 rgba(255,255,255,.376) / 2px（Design.md §1.3 / checklist D3）
const DEFAULT_EDGE_STYLE = { stroke: 'var(--canvas-edge)', strokeWidth: 2 };
// 拖拽预览线 — TapNow 官方 #B1B1B7 / 1px 实线（Design.md §1.3 / checklist D5）
const CONNECTION_LINE_STYLE = { stroke: '#B1B1B7', strokeWidth: 1 };
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
const isMacOS = typeof navigator !== 'undefined'
  && /Macintosh|Mac OS X/.test(navigator.userAgent);
const shouldUseMacTrackpadPan = isTauri && isMacOS;
const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;
const CANVAS_INTERACTING_CLASS = 'canvas-interacting';
type CanvasInteractionKind = 'node' | 'viewport' | 'wheel';
// 官方实测下限：把画布缩到极限时 zoom = **0.15**（用户截图确认）
const MIN_CANVAS_ZOOM = 0.15;
// ⚠️ 官方上限是 **2.0**（把画布 Ctrl+滚轮推到极限后实测 zoom = 2.000，左下角滑条也正好推到 200%）。
//    MTV 原来写 5 ✗ —— 滑条虽然只到 200%，滚轮却能一路放大到 5 倍
//    （用户截图：同样窗口大小，MTV 推到极限时卡片比官方大一倍多）。
const MAX_CANVAS_ZOOM = 2;
/* ⚠️ 原来这里还有 `NODE_TOOLBAR_MIN/MAX_SCREEN_SCALE`（把节点工具条的屏幕尺寸夹到 [0.8, 1.25]）✗ ——
   与官方源码不符，已删除：官方 `Sh("--float-scale")` 写的是**精确 1/zoom**（无上下限），
   所以工具条屏幕尺寸恒定 48×40；消费方统一读画布根上的 `--float-scale`（见 styles/nodes.css）。 */
const VISIBLE_GOOEY_BUTTONS = '.react-flow__node:hover .gooey-btn-wrapper, .react-flow__node.selected .gooey-btn-wrapper, .node-handle:hover .gooey-btn-wrapper';

// ── 交互模式预设（冻结对象，避免每次 render 产生新身份，导致 React Flow 内部 effect 重跑、拖拽掉帧）──
// 官方滚轮逻辑（用户明确）：
//   1) 普通滚轮 = **画布上下平移**，不缩放
//   2) Ctrl + 滚轮 = 缩放（前滚放大 / 后滚缩小），并与左下角滑条联动，受 min/max 限制
const DEFAULT_INTERACTION = Object.freeze({
  panOnScroll: true,
  /* ★ 官方 `ei`（`page-DPdEgTS0.js`@char1448354 逐字）：`panOnScrollSpeed: 1.2`
     ⚠️ MTV 原来是 0.5（自己定的）⇒ 已按官方改 */
  panOnScrollSpeed: 1.2,
  panOnScrollMode: PanOnScrollMode.Free, // Free 兼顾 Shift+滚轮水平平移
  zoomOnScroll: false,
  zoomOnPinch: true,
  // 必须显式关掉：React Flow 默认 true，会和「双击空白弹添加节点菜单」冲突（漏过一次）
  zoomOnDoubleClick: false,
  zoomActivationKeyCode: 'Control',
  panOnDrag: PAN_ON_DRAG_DEFAULT,
  /* ★ 以下四条都与官方 `ei` 逐条对齐（逐字）：
       `panOnDrag:[1,2]`（只有中键/右键拖才平移 · 左键拖 = 框选）
       `selectNodesOnDrag:!BS` / `selectionOnDrag:!BS` = **true**
       `selectionMode: xV.Partial`
       `multiSelectionKeyCode: null` ← **官方没有多选修饰键**（原来 MTV 写 'Shift'，自己加的）
       `selectionKeyCode: "Shift"`（Shift+拖 = 框选） */
  selectNodesOnDrag: true,
  selectionOnDrag: true,
  selectionMode: SelectionMode.Partial,
  multiSelectionKeyCode: null,
  selectionKeyCode: 'Shift',
  deleteKeyCode: null,
});

const CLASSIC_INTERACTION = Object.freeze({
  /* ⚠️ 这一套是 **MTV 自有**的用户选项（设置里 `config.interactionMode === 'classic'`），
     官方 `ei` 里**没有**对应物 —— 官方只有「左键拖=框选、中键/右键拖=平移」这一套
     （见上面 `DEFAULT_INTERACTION` 的逐字注释）。保留给习惯传统画布的用户，
     但**它不是官方规格**，不要再往这里加「对齐官方」的改动。 */
  panOnScroll: true,
  panOnScrollMode: PanOnScrollMode.Free, // Free 才能兼顾 Shift+滚轮水平平移与普通滚轮垂直平移
  panOnScrollSpeed: 0.5,
  zoomOnScroll: false,
  zoomOnPinch: true,
  zoomOnDoubleClick: false, // 关闭双击缩放，避免与「双击空白创建文本节点」冲突
  zoomActivationKeyCode: 'Control', // Ctrl+滚轮缩放
  panOnDrag: PAN_ON_DRAG_CLASSIC,
  selectionOnDrag: false,
  selectionKeyCode: 'Shift', // Shift+左键拖拽 → 框选
  multiSelectionKeyCode: 'Shift',
  selectionMode: SelectionMode.Partial,
  deleteKeyCode: null,
});
const INLINE_EDIT_DOUBLE_CLICK_DELAY_MS = 280;
/** 官方「从画布添加」拾取模式的重复点击防抖（`page-BeI7xydN.js@61888` 的 `kW = 300`）。 */
const INSERT_FROM_CANVAS_PICK_DEBOUNCE_MS = 300;
/**
 * 官方 `Jd`（`course-api-base-url-*.js` 的 `zIe`）**逐字**：
 *   `BIe = new Set([TEXT, IMAGE, VIDEO, VIDEO_EDIT, AUDIO])`
 *   `zIe = e => !!(e.id && BIe.has(e.type ?? ''))`
 * ⇒ **只有文本 / 图片 / 视频 / 视频编辑 / 音频 五类节点可被拾取**，分组、堆叠、便签等一律不参与。
 * 同一个谓词也决定 ContextStrip 的引用计数（`jle`）⇒ 抽到 `chat/referenceableNodes` 共用。
 */

// ── Snap lines overlay ──
type SpacingSnapLine = Extract<SnapLine, { kind: 'spacing' }>;

/**
 * 吸附参考线的颜色 = **白色**。
 *
 * 用户 2026：「网格吸附时拖动卡片…出现的蚂蚁线 我要白色，不要 MTV 的品牌色」
 * ⚠️ 这套对齐/等间距参考线**官方 canvas chunk 里没有**（`course-api-base-url-CGXqZmAy.js`
 *    全文只有两处 `strokeDasharray`，都与参考线无关）⇒ 属 MTV 自有功能，颜色按用户指定，
 *    不再沿用 MTV 品牌色（靛蓝 `#6366f1`）。
 * 原先的 0.7 不透明度保留（深色画布上白线 70% 正好与官方那批 `#ffffff60` 级描边同档）。
 */
const SNAP_GUIDE_COLOR = '#ffffff';

function formatSpacingDistance(distance: number): string {
  return Number.isInteger(distance) ? String(distance) : distance.toFixed(1);
}

function SpacingGuideMarks({ line, index }: { line: SpacingSnapLine; index: number }) {
  const label = formatSpacingDistance(line.distance);
  return (
    <g key={`spacing-${line.type}-${index}`}>
      {line.segments.map((segment, segmentIndex) => {
        const middle = (segment.start + segment.end) / 2;
        return line.type === 'horizontal' ? (
          <g key={`horizontal-gap-${segmentIndex}`}>
            <line
              x1={segment.start}
              y1={line.crossPosition}
              x2={segment.end}
              y2={line.crossPosition}
              stroke={SNAP_GUIDE_COLOR}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={segment.start}
              y1={line.crossPosition - 4}
              x2={segment.start}
              y2={line.crossPosition + 4}
              stroke={SNAP_GUIDE_COLOR}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={segment.end}
              y1={line.crossPosition - 4}
              x2={segment.end}
              y2={line.crossPosition + 4}
              stroke={SNAP_GUIDE_COLOR}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={middle}
              y={line.crossPosition - 6}
              fill={SNAP_GUIDE_COLOR}
              stroke="var(--theme-bg)"
              strokeWidth={3}
              paintOrder="stroke"
              fontSize={11}
              fontWeight={600}
              textAnchor="middle"
            >
              {label}
            </text>
          </g>
        ) : (
          <g key={`vertical-gap-${segmentIndex}`}>
            <line
              x1={line.crossPosition}
              y1={segment.start}
              x2={line.crossPosition}
              y2={segment.end}
              stroke={SNAP_GUIDE_COLOR}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={line.crossPosition - 4}
              y1={segment.start}
              x2={line.crossPosition + 4}
              y2={segment.start}
              stroke={SNAP_GUIDE_COLOR}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={line.crossPosition - 4}
              y1={segment.end}
              x2={line.crossPosition + 4}
              y2={segment.end}
              stroke={SNAP_GUIDE_COLOR}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={line.crossPosition - 6}
              y={middle}
              fill={SNAP_GUIDE_COLOR}
              stroke="var(--theme-bg)"
              strokeWidth={3}
              paintOrder="stroke"
              fontSize={11}
              fontWeight={600}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SnapLinesOverlay({ lines }: { lines: SnapLine[] }) {
  const { x, y, zoom } = useViewport();
  if (lines.length === 0) return null;
  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 999,
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        transformOrigin: '0 0',
      }}
    >
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          overflow: 'visible',
        }}
      >
        {lines.map((line, i) => {
          if (line.kind === 'spacing') {
            return <SpacingGuideMarks key={`spacing-${line.type}-${i}`} line={line} index={i} />;
          }
          return line.type === 'horizontal' ? (
            <line
              key={`h-${i}`}
              x1={-99999}
              y1={line.position}
              x2={99999}
              y2={line.position}
              stroke={SNAP_GUIDE_COLOR}
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          ) : (
            <line
              key={`v-${i}`}
              x1={line.position}
              y1={-99999}
              x2={line.position}
              y2={99999}
              stroke={SNAP_GUIDE_COLOR}
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          );
        })}
      </svg>
    </div>
  );
}

function CanvasInner() {
  const nodes = useAppStore((s) => s.nodes);
  const edges = useAppStore((s) => s.edges);
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds);
  const onConnect = useAppStore((s) => s.onConnect);
  const setSelectedNodeIds = useAppStore((s) => s.setSelectedNodeIds);
  const applyStableNodeChanges = useAppStore((s) => s.onNodesChange);
  const handleEdgesChange = useAppStore((s) => s.onEdgesChange);

  /* ★ 官方「边变化 -> 重写下游卡 prompt 里的引用 token」（rge + 非 VIDEO 的 onBeforeDelete 语义）：
       本次只覆盖 图片 / 文本（用户定的范围），且只写 data.prompt；官方的 promptDraft 体系 MTV 还没有，
       等确认等价物后再接（不写半吊子）。实现 = 纯规划 planReferencePromptRewrites(...) + 应用 ✓ */
  const handleEdgesChangeWithReferences = useCallback((changes: Parameters<typeof handleEdgesChange>[0]) => {
    const before = useAppStore.getState().edges;
    handleEdgesChange(changes);
    const state = useAppStore.getState();
    const plan = planReferencePromptRewrites({
      nodes: state.nodes,
      previousEdges: before,
      nextEdges: state.edges,
    });
    for (const item of plan) state.updateNodeData(item.id, { prompt: item.prompt });
  }, [handleEdgesChange]);
  const clearGroupedSelection = useAppStore((s) => s.clearGroupedSelection);
  const settleNodeGroupingOnDragStop = useAppStore((s) => s.settleNodeGroupingOnDragStop);
  const duplicateNode = useAppStore((s) => s.duplicateNode);
  const commitToHistory = useAppStore((s) => s.commitToHistory);
  const minimapVisible = useAppStore((s) => s.minimapVisible);
  const closeNodeDialog = useAppStore((s) => s.closeNodeDialog);
  const interactionMode = useAppStore((s) => s.config.interactionMode ?? 'default');
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  /* 工作空间（我的项目）开着时画布被盖住 ⇒ 画布内的品牌按钮也不该出现 */
  const projectLibraryOpen = useAppStore((s) => s.projectLibraryOpen);
  /* 顶部品牌按钮的落点：与画布左上角 logo / 「切换画布 ⌄」同一条口径 —— 直接落到「我的项目」 */
  const backToProjects = useCallback(() => {
    setWorkspaceLandingTab('projects');
    useAppStore.getState().setProjectLibraryOpen(true);
  }, []);
  const canvasNoteToolbarVisible = useAppStore((s) => s.config.canvasNoteToolbarVisible !== false);
  const [nodeProjectionCache] = useState(createCanvasNodeProjectionCache);
  const interaction = interactionMode === 'classic' ? CLASSIC_INTERACTION : DEFAULT_INTERACTION;
  // 右键 effect 用 ref 读取模式，避免把 interactionMode 加进 effect 依赖而导致监听器重挂
  const interactionModeRef = useRef(interactionMode);
  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);
  useEffect(() => {
    syncCanvasNodeIndex(nodes);
  }, [nodes]);
  const reactFlowInstance = useReactFlow();
  const flowStore = useStoreApi();
  const lodSession = useMemo(() => ({
    projectId: currentProjectId,
    runtime: createCanvasNodeLodRuntime(reactFlowInstance.getViewport().zoom),
  }), [currentProjectId, reactFlowInstance]);
  const nodeLodRuntime = lodSession.runtime;
  useEffect(() => {
    nodeLodRuntime.activate();
    const { x, y, zoom } = reactFlowInstance.getViewport();
    const { width, height } = flowStore.getState();
    nodeLodRuntime.viewport(zoom, (width / 2 - x) / zoom, (height / 2 - y) / zoom);
    nodeLodRuntime.interaction(activeInteractionsRef.current.size > 0);
    return () => nodeLodRuntime.deactivate();
  }, [nodeLodRuntime, reactFlowInstance, flowStore]);
  const wheelZoomCancelRef = useRef<(() => void) | null>(null);
  const activeCanvasPanRef = useRef<{
    startX: number;
    startY: number;
    detail: CanvasPanByDetail;
  } | null>(null);

  useEffect(() => registerCanvasViewportController({
    getSnapshot: () => {
      const viewport = reactFlowInstance.getViewport();
      /* ★ 必须按**画布容器的真实矩形**算可见范围：
         旧实现写死 `{0,0} → {window.innerWidth, window.innerHeight}`，等于假设「容器贴窗口左上角、且与窗口同尺寸」✗。
         一旦外壳给画布让出空间就会算错 —— 例如玻璃外框模式内缩 5px（偏 5px），
         或页面顶部有 54px 标题栏时高度多算 54px（取景中心会偏低 ~27px、让位量算不出来 ✗ 实测踩过）。
         `getSnapshot` 不在帧循环里（只在打开编辑器 / 聊天工具命令时调一次）⇒ 这里直接量 rect 是安全的。 */
      const flowEl = canvasRootRef.current?.querySelector<HTMLElement>('.react-flow') ?? null;
      const rect = flowEl?.getBoundingClientRect();
      const left = rect ? rect.left : 0;
      const top = rect ? rect.top : 0;
      const width = rect ? rect.width : window.innerWidth;
      const height = rect ? rect.height : window.innerHeight;
      const topLeft = reactFlowInstance.screenToFlowPosition({ x: left, y: top });
      const bottomRight = reactFlowInstance.screenToFlowPosition({
        x: left + width,
        y: top + height,
      });
      return {
        ...viewport,
        visibleBounds: {
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        },
      };
    },
    setViewport: async (viewport, duration = 0) => {
      wheelZoomCancelRef.current?.();
      await reactFlowInstance.setViewport(viewport, { duration });
    },
    fitView: async (options = {}) => {
      wheelZoomCancelRef.current?.();
      const ids = options.nodeIds ? new Set(options.nodeIds) : null;
      const nodes = ids
        ? reactFlowInstance.getNodes().filter((node) => ids.has(node.id))
        : undefined;
      await reactFlowInstance.fitView({
        nodes,
        padding: options.padding ?? 0.25,
        duration: options.duration ?? 0,
      });
    },
  }), [reactFlowInstance]);
  const canvasRootRef = useRef<HTMLDivElement>(null);
  /**
   * `.react-flow` 容器在屏幕上的原点，缓存在这里。
   * 用途：让 portal 出去的浮层能**纯用坐标**换算出节点屏幕位置，
   * 从而彻底避免在动画帧里调 getBoundingClientRect()（那会强制同步布局 → 1.9 秒长帧）。
   * 它只在挂载/窗口尺寸变化时变，所以不在帧内读。
   */
  const flowContainerRectRef = useRef<{ left: number; top: number } | null>(null);
  const refreshFlowContainerRect = useCallback(() => {
    const el = canvasRootRef.current?.querySelector<HTMLElement>('.react-flow');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    flowContainerRectRef.current = { left: rect.left, top: rect.top };
  }, []);
  useEffect(() => {
    refreshFlowContainerRect();
    window.addEventListener('resize', refreshFlowContainerRect);
    return () => window.removeEventListener('resize', refreshFlowContainerRect);
  }, [refreshFlowContainerRect]);
  const activeInteractionsRef = useRef(new Set<CanvasInteractionKind>());
  const interactionReleaseFramesRef = useRef<Record<CanvasInteractionKind, number>>({
    node: 0,
    viewport: 0,
    wheel: 0,
  });

  const gooeyScaleRef = useRef(Number.NaN);
  const latestCanvasZoomRef = useRef(Number.NaN);
  const localGooeyButtonsRef = useRef(new Set<HTMLElement>());
  const zoomTargetsObserverRef = useRef<MutationObserver | null>(null);

  const clearLocalZoomCompensation = useCallback(() => {
    localGooeyButtonsRef.current.forEach((element) => element.style.removeProperty('--gooey-inv-zoom'));
    localGooeyButtonsRef.current.clear();
  }, []);

  const updateNodeZoomCompensation = useCallback((zoom: number, refreshTargets = false) => {
    const canvasRoot = canvasRootRef.current;
    if (!canvasRoot || !Number.isFinite(zoom) || zoom <= 0) return;
    // 不要在 documentElement 上写 CSS 变量：那会让**全文档样式失效**并每帧重算，直接把缩放拖卡。
    // （曾经为了让底部面板跟随缩放写过 --canvas-zoom；后经官方实测，面板是固定屏幕尺寸、不跟随，已移除。）
    const previousZoom = latestCanvasZoomRef.current;
    latestCanvasZoomRef.current = zoom;
    /* ★★★★★ **`--float-scale` = 1 / zoom，每帧无条件写** ✓✓（= 官方机制 ✓）
       EXE 原文：
         `function xB(e){ return 1 / I7(e) }`   // I7(e)= e>0?e:1
         `Sh("--float-scale")`  →  `r.style.setProperty(e, String(xB(zoom)))`
                                  + **订阅 store 逐帧同步**（zoom 一变就写 ✓）
       官方消费方（都乘 `scale(var(--float-scale,1))` ✓）：
         · 上传胶囊 `NJ`：`translateX(-50%) scale(var(--float-scale,1))` ✓
         · 编辑区 `.node-float-ui-visible`（CSS ✓）
         · 节点工具条 `cPe` / label 气泡 ✓
       ★ 为什么必须**在交互中也写** ✗✓（用户："上传按钮动画有延迟、不丝滑" ✓）：
         MTV 原来只在**交互结束后**写 `--canvas-inv-zoom` ✗（见下方 `return` ✓）
         → 缩放**过程中**胶囊的反缩放值一直是旧的 ✗ → 被画布拉伸 ✗ → 结束时才"啪"地校正 ✗
         → 观感 = 延迟 + 不丝滑 ✓✓
       开销：一个 CSS 变量写在 canvasRoot 上 ✓（不是全文档 ✓ 与原实现同源 ✓）*/
    if (canvasRoot.style.getPropertyValue('--float-scale') !== String(1 / zoom)) {
      canvasRoot.style.setProperty('--float-scale', String(1 / zoom));
    }
    /* ★ `--pile-toolbar-scale` —— 官方 `QZe` 给**缩放层**挂的 ref：`o = Sh("--pile-toolbar-scale")`
       （zoom-slider-3ZcFvYQO.js @2958000 `function QZe(...)` 第一行）
       ⇒ `Sh` 写的值与 `--float-scale` **同源同公式**（`xB(zoom) = 1/zoom`）⇒ 这里一并写 ✓
       官方堆叠工具条：`cPe` 传 `scaleMode:"inherit"`（`f = {"--float-scale": 1}`），
       缩放只由**缩放层**做一次 ⇒ 工具条屏幕尺寸 = 48×(1/zoom)×zoom 里只剩缩放层那一次 ⇒ 与普通节点一致。
       ⚠️ 若不写这个变量（= 默认 1），而工具条又继承了画布根的 `--float-scale`(=1/zoom)，
          则缩放被**等价地**做了一次（结果相同）——但结构上偏离官方；两者必须**同时**成立才安全，
          所以这里与 PileNodeToolbar 的 `--float-scale:1` 配套（缺一就会放大/缩小错乱）。 */
    if (canvasRoot.style.getPropertyValue('--pile-toolbar-scale') !== String(1 / zoom)) {
      canvasRoot.style.setProperty('--pile-toolbar-scale', String(1 / zoom));
    }
    /* ★★ 官方 `od` 的**定位公式**（NodeToolbarLayer 上移量）—— 全项目**只写这一处** ✓
       EXE 原文：`top: -${Math.min(48 * (1 / zoom), 60)}px`（**画布单位**，`left-1/2` + `origin-bottom`）
       ⇒ 屏幕上的「卡片顶 ↔ 工具条底」= `min(48, 60 × zoom)`：放大到 ≥0.8 恒定 48px，缩小到 0.8 以下按比例收。
       消费方：所有节点工具条共用 `.node-floating-toolbar { top: var(--float-top) }`（styles/nodes.css）⇒
       以后新增节点类型**不用**再各自写一遍内联 top（这正是原来"挨个手改"的坑）。 */
    const floatTop = `-${Math.min(48 / zoom, 60)}px`;
    if (canvasRoot.style.getPropertyValue('--float-top') !== floatTop) {
      canvasRoot.style.setProperty('--float-top', floatTop);
    }
    const gooeyCompensation = Math.min(1, 1 / zoom);

    if (activeInteractionsRef.current.size > 0) {
      // 普通平移无需查找控件；缩放只改控件自身，避免根变量让整个媒体子树重算样式。
      if (!refreshTargets && zoom === previousZoom) return;
      const updateLocal = (selector: string, elements: Set<HTMLElement>, property: string, value: number) => {
        canvasRoot.querySelectorAll<HTMLElement>(selector).forEach((element) => elements.add(element));
        const text = String(value);
        elements.forEach((element) => {
          if (!canvasRoot.contains(element)) {
            element.style.removeProperty(property);
            elements.delete(element);
          } else if (element.style.getPropertyValue(property) !== text) {
            element.style.setProperty(property, text);
          }
        });
      };
      if (localGooeyButtonsRef.current.size > 0 || gooeyCompensation !== gooeyScaleRef.current) {
        updateLocal(VISIBLE_GOOEY_BUTTONS, localGooeyButtonsRef.current, '--gooey-inv-zoom', gooeyCompensation);
      }
      return;
    }

    // 根引用只记录已发布的值；整段交互结束时先同步，再移除局部覆盖。
    if (gooeyCompensation !== gooeyScaleRef.current) {
      gooeyScaleRef.current = gooeyCompensation;
      canvasRoot.style.setProperty('--gooey-inv-zoom', String(gooeyCompensation));
    }
    // 完整反比缩放（1/zoom）——给「固定屏幕尺寸」的画布内元素用。
    // 官方实测：上传胶囊在画布内却**不随缩放变化**（固定 74×36 屏幕），
    // 底部编辑区同理。--gooey-inv-zoom 是被 min(1,·) 夹过的，不能替代它。
    canvasRoot.style.setProperty('--canvas-inv-zoom', String(1 / zoom));
    /* ★ 节点工具条不再单独有"补偿变量"✗：官方 `Sh("--float-scale")` 就是 `1/zoom`，
       工具条直接消费上面那个 `--float-scale`（见 styles/nodes.css）⇒
       原来这里额外写 `--node-toolbar-zoom-compensation`（被夹在 [0.8,1.25]）已删除。 */
    clearLocalZoomCompensation();
  }, [clearLocalZoomCompensation]);

  const refreshLocalZoomTargets = useCallback(() => {
    if (activeInteractionsRef.current.size > 0) {
      updateNodeZoomCompensation(latestCanvasZoomRef.current, true);
    }
  }, [updateNodeZoomCompensation]);

  const stopObservingZoomTargets = useCallback(() => {
    zoomTargetsObserverRef.current?.disconnect();
    zoomTargetsObserverRef.current = null;
    canvasRootRef.current?.removeEventListener('pointerover', refreshLocalZoomTargets);
    canvasRootRef.current?.removeEventListener('pointerout', refreshLocalZoomTargets);
  }, [refreshLocalZoomTargets]);

  useEffect(() => {
    updateNodeZoomCompensation(reactFlowInstance.getViewport().zoom);
  }, [reactFlowInstance, updateNodeZoomCompensation]);

  const setCanvasInteraction = useCallback((kind: CanvasInteractionKind, active: boolean) => {
    const wasInteracting = activeInteractionsRef.current.size > 0;
    if (active) activeInteractionsRef.current.add(kind);
    else activeInteractionsRef.current.delete(kind);
    const interacting = activeInteractionsRef.current.size > 0;
    if (wasInteracting === interacting) return;
    nodeLodRuntime.interaction(interacting);
    if (interacting) {
      const canvasRoot = canvasRootRef.current;
      if (canvasRoot) {
        // 只在交互期间监听挂载/选中与 hover；不读取布局，也不监听自身的 style 写入。
        const observer = new MutationObserver((records) => {
          if (records.some((record) => record.type === 'childList'
            || (record.target instanceof Element && record.target.matches('.react-flow__node, .node, .node-toolbar-shell')))) {
            refreshLocalZoomTargets();
          }
        });
        zoomTargetsObserverRef.current = observer;
        observer.observe(canvasRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        canvasRoot.addEventListener('pointerover', refreshLocalZoomTargets, { passive: true });
        canvasRoot.addEventListener('pointerout', refreshLocalZoomTargets, { passive: true });
      }
    } else {
      stopObservingZoomTargets();
      updateNodeZoomCompensation(reactFlowInstance.getViewport().zoom);
    }
    document.documentElement.classList.toggle(CANVAS_INTERACTING_CLASS, interacting);
  }, [nodeLodRuntime, reactFlowInstance, refreshLocalZoomTargets, stopObservingZoomTargets, updateNodeZoomCompensation]);

  const beginCanvasInteraction = useCallback((kind: CanvasInteractionKind) => {
    const pendingFrame = interactionReleaseFramesRef.current[kind];
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    interactionReleaseFramesRef.current[kind] = 0;
    setCanvasInteraction(kind, true);
  }, [setCanvasInteraction]);

  const endCanvasInteraction = useCallback((kind: CanvasInteractionKind) => {
    const state = useAppStore.getState();
    if (!state.activeNodeId || document.querySelector('.ai-dialog-float.is-expanded')) {
      setCanvasInteraction(kind, false);
      return;
    }

    const pendingFrame = interactionReleaseFramesRef.current[kind];
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    interactionReleaseFramesRef.current[kind] = requestAnimationFrame(() => {
      const latestState = useAppStore.getState();
      const activeNodeId = latestState.activeNodeId;
      if (activeNodeId) {
        const nodeElement = document.querySelector<HTMLElement>(
          `.react-flow__node[data-id="${activeNodeId}"]`,
        );
        const nodeRect = nodeElement?.getBoundingClientRect();
        if (nodeRect) {
          latestState.openNodeDialog(activeNodeId, {
            x: nodeRect.left + nodeRect.width / 2,
            y: nodeRect.bottom,
          });
        }
      }

      interactionReleaseFramesRef.current[kind] = requestAnimationFrame(() => {
        interactionReleaseFramesRef.current[kind] = 0;
        setCanvasInteraction(kind, false);
      });
    });
  }, [setCanvasInteraction]);

  useEffect(() => () => {
    Object.values(interactionReleaseFramesRef.current).forEach((frameId) => {
      if (frameId) cancelAnimationFrame(frameId);
    });
    activeInteractionsRef.current.clear();
    stopObservingZoomTargets();
    clearLocalZoomCompensation();
    document.documentElement.classList.remove(CANVAS_INTERACTING_CLASS);
  }, [clearLocalZoomCompensation, stopObservingZoomTargets]);

  const handleCanvasViewportMoveStart = useCallback<OnMove>(() => {
    beginCanvasInteraction('viewport');
  }, [beginCanvasInteraction]);

  const handleCanvasViewportMoveEnd = useCallback<OnMove>(() => {
    if (activeInteractionsRef.current.has('wheel')) {
      setCanvasInteraction('viewport', false);
      return;
    }
    endCanvasInteraction('viewport');
  }, [endCanvasInteraction, setCanvasInteraction]);

  const handleCanvasViewportMove = useCallback<OnMove>((_, viewport) => {
    const { width, height } = flowStore.getState();
    nodeLodRuntime.viewport(viewport.zoom, (width / 2 - viewport.x) / viewport.zoom, (height / 2 - viewport.y) / viewport.zoom);
    updateNodeZoomCompensation(viewport.zoom);
    // 通知 portal 出去的浮层（底部编辑区）重算位置。
    // ⚠️ 事件里必须带上完整的 viewport 与容器原点，让监听方**用坐标算**而不是读 getBoundingClientRect()：
    //    本函数刚刚给一批元素写过 style（样式已失效），同一帧再读几何会触发**强制同步布局**，
    //    实测出现过 1917ms 的单帧（layout thrashing），就是"一帧一帧"卡顿的来源。
    const flowRect = flowContainerRectRef.current;
    window.dispatchEvent(new CustomEvent('canvas-viewport-change', {
      detail: {
        zoom: viewport.zoom,
        x: viewport.x,
        y: viewport.y,
        left: flowRect?.left ?? 0,
        top: flowRect?.top ?? 0,
      },
    }));
    const activePan = activeCanvasPanRef.current;
    if (!activePan) return;
    activePan.detail.onProgress?.({
      deltaX: viewport.x - activePan.startX,
      deltaY: viewport.y - activePan.startY,
    });
  }, [flowStore, nodeLodRuntime, updateNodeZoomCompensation]);

  const handleWheelZoomStart = useCallback(() => beginCanvasInteraction('wheel'), [beginCanvasInteraction]);
  const handleWheelZoomEnd = useCallback((interrupted: boolean) => {
    if (interrupted) setCanvasInteraction('wheel', false);
    else endCanvasInteraction('wheel');
  }, [endCanvasInteraction, setCanvasInteraction]);
  useCanvasWheelZoom({
    rootRef: canvasRootRef,
    cancelRef: wheelZoomCancelRef,
    // ⚠️ 已停用：这个 hook 会把**普通滚轮**抢去当缩放，而官方逻辑是
    //   「普通滚轮 = 上下平移；Ctrl+滚轮 = 缩放」。现在交给 React Flow 的
    //   panOnScroll / zoomActivationKeyCode('Control') 原生处理。
    enabled: false,
    nativeMouseWheel: shouldUseMacTrackpadPan,
    projectId: currentProjectId,
    getViewport: reactFlowInstance.getViewport,
    setViewport: reactFlowInstance.setViewport,
    onStart: handleWheelZoomStart,
    onEnd: handleWheelZoomEnd,
    minZoom: MIN_CANVAS_ZOOM,
    maxZoom: MAX_CANVAS_ZOOM,
  });

  // 节点连接「+」按钮的磁吸跟手（官方：半径 80px 内 1:1 跟随，超出回弹）
  useHandleMagnet(canvasRootRef);

  const {
    isDragOver,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    onDoubleClick,
  } = useNodeCreation();

  const {
    activeTool: activeDrawingTool,
    chooseTool: chooseDrawingTool,
    selectedNoteNode,
    panelNote,
    pendingImage,
    draftNode,
    applyNotePatch,
    beginNoteChange,
    endNoteChange,
    duplicateSelectedNote,
    deleteSelectedNote,
    moveSelectedNoteLayer,
    requestCrop,
    handlePointerDownCapture: handleDrawingPointerDown,
    handlePointerMoveCapture: handleDrawingPointerMove,
    handlePointerUpCapture: handleDrawingPointerUp,
  } = useCanvasDrawing();
  useEffect(() => {
    if (!canvasNoteToolbarVisible && activeDrawingTool !== 'select') {
      chooseDrawingTool('select');
    }
  }, [activeDrawingTool, canvasNoteToolbarVisible, chooseDrawingTool]);

  const drawingActive = activeDrawingTool !== 'select';
  const {
    position: radialMenuPosition,
    holdPosition: radialMenuHoldPosition,
    close: closeRadialMenu,
  } = useCanvasLongPressRadialMenu(canvasRootRef, !drawingActive);
  const drawingInteraction = useMemo(() => ({
    ...interaction,
    ...(drawingActive ? {
      panOnDrag: false,
      selectionOnDrag: false,
    } : {}),
    // React Flow 会忽略变回 undefined 的受控属性，因此结束绘图时必须显式恢复。
    nodesDraggable: !drawingActive,
    elementsSelectable: !drawingActive,
  }), [drawingActive, interaction]);

  /* ★ 官方左下按钮③ 是 **「网格吸附」**（snap to grid），**不是**「显示/隐藏背景网格」✓
     官方实测（t1193，fiber 里读 ReactFlow props）：
       `snapToGrid`（可切）· **`snapGrid = [15, 15]`** · 按钮 `data-active={snapToGrid}`（官方源码）
     官方 i18n（index-BiTZf8mJ.js @9103072 `zoomSlider`）只有
       `hideNodeConnections / showNodeConnections / snapToGrid / reset / zoomInOut` + `minimap.open/close`
       ⇒ **整份 i18n 里没有任何「显示网格 / 隐藏网格」的键** ⇒ 官方**没有**隐藏背景网格这个行为 ✗
     ⚠️ MTV 原来这个按钮接的是「显示/隐藏**背景网格**」✗（`localStorage 'canvas-showGrid'`）——
        用户 2026 指出后**已移除**：网格改为**常驻**，按钮改回官方的「网格吸附」✓ */
  const [snapToGrid, setSnapToGrid] = useState(() => localStorage.getItem('canvas-snapToGrid') === 'true');
  /* 官方左下按钮②「隐藏节点连线 / 显示节点连线」
     （i18n `canvas.zoomSlider.hideNodeConnections` / `showNodeConnections`）
     —— MTV 原本没有这个能力，按用户要求实现官方功能 */
  const [edgesVisible, setEdgesVisible] = useState(() => localStorage.getItem('canvas-edgesVisible') !== 'false');

  useEffect(() => { localStorage.setItem('canvas-snapToGrid', String(snapToGrid)); }, [snapToGrid]);
  useEffect(() => { localStorage.setItem('canvas-edgesVisible', String(edgesVisible)); }, [edgesVisible]);

  // Track the live canvas pointer so keyboard-created nodes can place their top-left corner here.
  const handleCanvasPointer = useCallback(
    (e: React.MouseEvent) => {
      const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCanvasPointerPosition(flowPos);
      /* ★ 同时记**屏幕坐标** —— 粘贴落点要用它判断「鼠标是不是还在画布上」
         （对齐 TapNow 的 `g.current` + `y.current`：鼠标在 `.react-flow` 矩形内才用鼠标位置，
         否则退回视口中心；没有这道门，切画布后缓存的上一次画布指针会被当成"当前鼠标"，
         粘出来的卡片就落在看不见的地方）。 ⚠️ 别改用 `mouseenter` 记状态 —— 实测它可能不触发。 */
      setCanvasPointerClientPosition({ x: e.clientX, y: e.clientY });
      /* ⚠️ 原来这里还往工具条上写 `--toolbar-pointer-x/y`（跟随鼠标的容器光斑）✗ ——
         官方容器没有任何 hover 光晕（高光只在按钮内部的 `YKo` 层），已删除，见 styles/nodes.css。 */
    },
    [reactFlowInstance],
  );

  const handleCanvasPaneClick = useCallback(() => {
    /* ★★★★★ **官方：点空白**会关**底部编辑框** ✓✓（t1126 决定性 A/B 实测 —— 修正此前的错误结论）
       官方读数口径（**必须用 fiber 上的 prop**，见下「测量陷阱」）：
         每个 `.node-float-ui` 外面套一层 `NodeFloatingLayer`（props: `visible/placement/isDragging`），
         条自身那层 CSS 类 `node-float-ui-visible` **不随点空白变化** ✗ ——
         真正决定显隐的是**外层 layer 的 `visible` prop** ✓
       t1126 实测（三个「命中栈顶部 = `.react-flow__pane`」的真空点，逐个 A/B 各一次）：
         · 点卡 A → 选中 1 · layer.visible = **true**
         · 点空白 (2400,900) → 选中 0 · layer.visible = **false**（+1.2s 仍 false）
         · 点空白 (30,60)    → 选中 0 · layer.visible = **false**
         · 点空白 (1300,1290)→ 选中 0 · layer.visible = **false**
         · 对照：点「节点上的图」(900,200) → 选中 1 · layer.visible = true（那不是 pane 点击）
       ⇒ 官方 **点空白就关** ✓（与 MTV 原有行为一致）
       ⇒ 上一版注释（t1110–t1112）说「官方点空白不关」是**错的** ✗，原因见下 ⚠️⚠️
       ⚠️⚠️ **测量陷阱（这次踩得很深，别再踩）**：
         ① **条自身的 `className`/`display` 全是假信号** ✗
            点空白后条仍是 `node-float-ui-visible` / `display:block`（因为那是 `le = pe && n && !I && !B`
            算出来的，`n` 是节点组件的 sticky `visible`）—— **真正隐藏发生在更外层的 layer（opacity→0）** ✗
            只看条自身 ⇒ 会得出「点空白不关」的错误结论（t1110/t1111 就是这么错判的）
         ② **窗口被遮挡时 `checkVisibility()`/opacity 也不可信** ✗
            官方窗口 `document.visibilityState === 'hidden'`（被遮住）时 Chromium **节流 rAF**
            ⇒ framer-motion 的 opacity 进出场动画**卡在旧值**（该淡出的还是 1）
            ⇒ t1121 因此又误判成「真可见=1」（t1123 实测到 visibilityState=hidden）
         ③ **可靠口径 = fiber 上的 prop**（React 提交后即刻更新，与渲染/节流无关）✓
            `fiberOf(el)` → 上溯找带 `placement`+`visible` 的层，读 `memoizedProps.visible` ✓
       ⚠️ 另有「多条并存」的疑问也已用同一口径定死：**任何时刻只有一条** ——
          t1124 实测 layer.visible 逐个转移（点 A→A true，点 B→B true 且 A false），
          `层的visible为true的个数` 恒为 **1** ⇒ 不存在多条并存 ✓ */
    closeNodeDialog();
    // 双击画布打开的「定位菜单」在点别处时关闭
    if (useAppStore.getState().canvasPickerPosition) useAppStore.getState().closeCanvasPicker();
  }, [closeNodeDialog]);

  // ── 连线「剪刀」断开按钮（官方实测：hover 连线时剪刀正中跟随鼠标；点它断线）──
  const t = useT();
  const [edgeScissors, setEdgeScissors] = useState<{ id: string; x: number; y: number; deletable: boolean } | null>(null);
  // 鼠标从连线移到剪刀钮上时会先触发 onEdgeMouseLeave；留一个延迟由剪刀自身取消，
  // 否则按钮会在 click 之前被卸载，点击落空。
  const edgeScissorsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* 已显示的边 id（enter 里判断「是否同一条边」，避免直接读 state 的闭包滞后）*/
  const edgeScissorsRef = useRef<{ id: string; deletable: boolean } | null>(null);
  useEffect(() => { edgeScissorsRef.current = edgeScissors; }, [edgeScissors]);

  const cancelEdgeScissorsClose = useCallback(() => {
    if (edgeScissorsTimer.current) {
      clearTimeout(edgeScissorsTimer.current);
      edgeScissorsTimer.current = null;
    }
  }, []);

  /* ★★ 官方剪刀的显隐时序（EXE `page-DPdEgTS0.js` @1335157 `Lpe` 逐字）：
       const Mpe = 800, Ppe = 150, Dpe = 10;
       · 出现：指针停在**同一条边**上满 `Mpe = 800ms` 才真正显示（换边 ⇒ 重置计时；离开 ⇒ 取消）
       · 消失：未命中 / 离开该边 ⇒ `Ppe = 150ms` 延迟隐藏（不是立刻）
       · 平移缩放中（`isViewportMoving`）⇒ 强制隐藏；指针在节点/面板上 ⇒ 隐藏
       · 出现后圆心跟随指针（`translate(-50%,-50%)`），指针移到剪刀上时位置冻结
     ⚠️ MTV 原来「进入即显示 + 160ms 隐藏」✗ —— 没有那 800ms 悬停判定，手感与官方不同 ✓ */
  const edgeScissorsShowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeScissorsPending = useRef<{ id: string; x: number; y: number; deletable: boolean } | null>(null);

  const cancelEdgeScissorsShow = useCallback(() => {
    if (edgeScissorsShowTimer.current) {
      clearTimeout(edgeScissorsShowTimer.current);
      edgeScissorsShowTimer.current = null;
    }
  }, []);

  const handleEdgeMouseEnter = useCallback((event: React.MouseEvent, edge: { id: string; data?: { edgeTag?: string } }) => {
    /* 官方：不可删的边（command 临时边 / 策略禁删）**不是不显示剪刀**，而是显示为禁用态
       （aria-disabled + opacity-70 + 换 16px 图标）。MTV 没有 mergedPolicy，就用 edgeTag 判定 ✓ */
    const deletable = edge.data?.edgeTag !== 'command';
    cancelEdgeScissorsClose();
    edgeScissorsPending.current = { id: edge.id, x: event.clientX, y: event.clientY, deletable };
    setEdgeScissors((current) => {
      /* 已经是这条边 → 直接跟随，不重置那 800ms */
      if (current?.id === edge.id) return { id: edge.id, x: event.clientX, y: event.clientY, deletable };
      return current;
    });
    if (edgeScissorsRef.current?.id === edge.id) return;
    cancelEdgeScissorsShow();
    edgeScissorsShowTimer.current = setTimeout(() => {
      edgeScissorsShowTimer.current = null;
      const pending = edgeScissorsPending.current;
      if (pending) setEdgeScissors(pending);
    }, 800);
  }, [cancelEdgeScissorsClose, cancelEdgeScissorsShow]);

  const handleEdgeMouseMove = useCallback((event: React.MouseEvent, edge: { id: string; data?: { edgeTag?: string } }) => {
    cancelEdgeScissorsClose();
    const deletable = edge.data?.edgeTag !== 'command';
    edgeScissorsPending.current = { id: edge.id, x: event.clientX, y: event.clientY, deletable };
    /* 已显示的边 → 圆心跟随指针；尚未显示 → 只更新待显示位置 ✓ */
    setEdgeScissors((current) => (current?.id === edge.id
      ? { id: edge.id, x: event.clientX, y: event.clientY, deletable }
      : current));
  }, [cancelEdgeScissorsClose]);

  const handleEdgeMouseLeave = useCallback(() => {
    cancelEdgeScissorsClose();
    /* 官方 `Ppe = 150ms` 延迟隐藏，并按官方语义取消「待显示」计时 ✓ */
    cancelEdgeScissorsShow();
    edgeScissorsPending.current = null;
    edgeScissorsTimer.current = setTimeout(() => setEdgeScissors(null), 150);
  }, [cancelEdgeScissorsClose, cancelEdgeScissorsShow]);

  const handleEdgeCut = useCallback(() => {
    /* 官方策略门禁：不可删的边点了不删、只提示（MTV 无 mergedPolicy ⇒ 用 deletable 标记）✓ */
    if (edgeScissorsRef.current && !edgeScissorsRef.current.deletable) {
      useAppStore.getState().showToast(t('该连线不可删除'), 'error');
      cancelEdgeScissorsClose();
      return;
    }
    setEdgeScissors((current) => {
      if (current) handleEdgesChangeWithReferences([{ type: 'remove', id: current.id }]);
      return null;
    });
    /* 剪断后把「待显示 / 延迟隐藏」两个计时与待显示位置一并清掉 ✓ */
    cancelEdgeScissorsShow();
    edgeScissorsPending.current = null;
    cancelEdgeScissorsClose();
  }, [handleEdgesChangeWithReferences, cancelEdgeScissorsClose, cancelEdgeScissorsShow, t]);

  // （原 `toggleGrid` 已删除 —— 官方没有「隐藏背景网格」这个行为，见上方 `snapToGrid` 注释）

  // ── Connection drop menu ──
  const {
    menu: connectionMenu,
    menuRef: connectionMenuRef,
    handleConnectEnd,
    handleSelect: handleConnectionMenuSelect,
    menuGroups: connectionMenuGroups,
    pending: connectionPending,
    openHandleMenu,
    openSelectionMenuAt,
  } = useConnectionDropMenu();

  /**
   * ★ 官方 `Wke` 的 `+` 按钮 `onClick`（`zoom-slider-3ZcFvYQO.js` @1209989 逐字）：
   *   `onClick = (w, x) => { w.stopPropagation(); …; setNodes(把该节点 selected:false);
   *                          d(w.nativeEvent, { nodeId, nodeType, handleType: x }) }`
   *   —— `d` 就是拖拽结束用的同一个派发器 ⇒ **点 `+` 与「拖到空白」走同一条路**；
   *   选中 ≥2 时官方换用 `wme`（「用所有选中的图片节点生成」）。
   *
   * MTV 的 `+` 是 `.node-handle::after` 伪元素（点击命中的就是 `.node-handle` 本身）
   * ⇒ 用 document **捕获阶段**委托，并在捕获阶段 stopPropagation（官方也是 stopPropagation）。
   * 真拖拽（按下后移开再松手）不会产生 click ⇒ 不会误触发。
   */
  useEffect(() => {
    const onHandleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const handle = target?.closest?.('.node-handle');
      if (!handle) return;
      const nodeEl = handle.closest<HTMLElement>('.react-flow__node[data-id]');
      const nodeId = nodeEl?.dataset.id;
      if (!nodeId) return;
      event.stopPropagation();
      event.preventDefault();
      const handleId = handle.getAttribute('data-handleid')
        || (handle.classList.contains('react-flow__handle-left') ? 'left' : 'right');
      /* 官方：先把被点的那颗取消选中（其余选中保留 ⇒ 多选菜单引用的就是它们） */
      const store = useAppStore.getState();
      store.setNodes(store.nodes.map((n) => (n.id === nodeId && n.selected ? { ...n, selected: false } : n)));
      store.setSelectedNodeIds(store.selectedNodeIds.filter((id) => id !== nodeId));
      openHandleMenu(nodeId, handleId, { x: event.clientX, y: event.clientY });
    };
    document.addEventListener('click', onHandleClick, true);
    return () => document.removeEventListener('click', onHandleClick, true);
  }, [openHandleMenu]);

  // ── 「保存到素材库」文件夹选择器（官方 `library.selectFolder`）──
  const saveToLibraryMenu = useAppStore((s) => s.saveToLibraryMenu);
  const elementEditorNodeIds = useAppStore((s) => s.elementEditorNodeIds);
  const closeSaveToLibraryMenu = useAppStore((s) => s.closeSaveToLibraryMenu);
  useEffect(() => {
    if (!saveToLibraryMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSaveToLibraryMenu(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [saveToLibraryMenu, closeSaveToLibraryMenu]);

  // ── Node context menu ──
  const {
    menu: nodeCtxMenu,
    menuRef: nodeCtxMenuRef,
    openMenu: openNodeCtxMenu,
    closeMenu: closeNodeCtxMenu,
    handleCopy,
    handleCut,
    handleCopyText,
    handleCutText,
    handleDuplicate,
    handleToggleLock,
    isNodeLocked,
    handleConvertImage,
    showImageConversion,
    imageConversionLabel,
    handleUngroup,
    handleOpenGroupFolder,
    handleDelete,
    handleShowInFolder,
    showInFolder,
    handleSaveAs,
    showSaveAs,
    handleOpenInPS,
    showOpenInPS,
    handleEditVideo,
    showEditVideo,
    editVideoLabel,
    handleOpenInJianying,
    handleOpenInPremiere,
    showOpenInVideoEditor,
    handleCopyMedia,
    showCopyMedia,
    copyMediaLabel,
    characterCaptureNodeId,
    handleAddToCharacter,
    closeCharacterCapture,
    showAddToCharacter,
    pluginTools,
    handlePluginTool,
    pendingPluginTool,
    closePluginToolDialog,
  } = useNodeContextMenu();
  /* ★ 官方卡片菜单「删除其他历史」(`deleteVariants`) 的可见条件 =
       `V0(data) > 1`（`page-DVqoHdTT.js`@1362698 逐字 `hidden:N<=1`）。`V0` 数的是
       `src + options`（去重；折叠态再并 `historyLocalQueues`），**不是历史记录条数**
       ⇒ 只有「多变体」批量那种折叠变体节点会出现这一项（铺开/堆叠节点与官方一致地不出现）。
       执行本体见 `useCanvasContextMenu` 的 `deleteNodeVariants`（官方 `Sme`）。 */
  const ctxVariantCount = useAppStore((s) => {
    const id = nodeCtxMenu.nodeId;
    if (!id) return 0;
    return officialVariantCount(s.nodes.find((n) => n.id === id)?.data);
  });
  /* ★ 官方「应用所有历史」的条件是 **`hidden: !data.src`**（节点**有内容**就显示；没历史时点击弹 `noHistoryToApply`），
     不是"有历史才显示" ⇒ 这里按"节点有媒体/文件"判断。 */
  const ctxNodeHasMedia = useAppStore((s) => {
    const id = nodeCtxMenu.nodeId;
    if (!id) return false;
    const node = s.nodes.find((n) => n.id === id);
    const d = (node?.data ?? {}) as Record<string, unknown>;
    return Boolean(d.mediaUrl || d.imageUrl || d.videoUrl || d.audioUrl || d.src || d.filePath);
  });
  const isGroupNode = nodeCtxMenu.nodeId
    ? nodes.find((n) => n.id === nodeCtxMenu.nodeId && n.type === 'group') != null
    : false;

  // ── Canvas context menu ──
  const {
    menu: ctxMenu,
    menuRef: ctxMenuRef,
    openMenu: openCtxMenu,
    insertCommandNodeAtCtxPos,
    applyNodeHistory,
    deleteNodeVariants,
    uploadNodeAtCtxPos,
    handleUndo: handleCtxUndo,
    handleRedo: handleCtxRedo,
    handlePaste: handleCtxPaste,
    hasSelection: ctxHasSelection,
  } = useCanvasContextMenu();

  /* ★ 官方卡片菜单「删除其他历史」的执行体（`page-DVqoHdTT.js`@1361521 → `Sme`@1360239）
       ⇒ 清空 `options` / 置 `historyVariantsHidden`、**保留主图与全部历史记录**、toast「历史已被删除，可在文件管理内查看」。 */
  const handleDeleteVariants = useCallback(() => {
    const nodeId = nodeCtxMenu.nodeId;
    if (nodeId) deleteNodeVariants(nodeId);
  }, [nodeCtxMenu.nodeId, deleteNodeVariants]);

  useCanvasSecondaryClickMenu({
    interactionModeRef,
    openNodeMenu: openNodeCtxMenu,
    openCanvasMenu: openCtxMenu,
  });

  // ── Paste（原生 paste 事件；对齐 TapNow `k_()` 的 `pasteCopiedNodes` 接管逻辑）──
  /* TapNow 把「粘节点」也挂在**原生 paste 事件**上（不是 keydown V），因为只有这里能**同步**看到
     `clipboardData` 里有没有文件。三道守卫（逐条对齐）：
       ① 焦点在输入框 / contenteditable ⇒ 不接管；
       ② 系统剪贴板里有**文件**（图片/视频）⇒ 不接管，让给下面的外部粘贴；
       ③ 内部剪贴板为空 ⇒ 不接管。
     落点也同款：鼠标在画布内 ⇒ 鼠标位置；否则视口中心（`pasteNodes` 内部再按 40 屏幕px × 第几次 做阶梯）。 */
  useEffect(() => {    const handler = (e: ClipboardEvent) => {
      // ① 正在编辑文本 ⇒ 交给浏览器原生行为
      if (isEditableTarget(e.target)) return;

      const dt = e.clipboardData;
      // ② 剪贴板里有文件？
      const hasFiles = !!dt && (
        dt.files.length > 0 || Array.from(dt.items ?? []).some((item) => item.kind === 'file')
      );
      const { clipboard, pasteNodes } = useAppStore.getState();

      // ③ 内部剪贴板有节点、且系统剪贴板没有文件 ⇒ **粘节点**
      if (clipboard.nodes.length > 0 && !hasFiles) {
        e.preventDefault();
        e.stopPropagation();
        const vp = reactFlowInstance.getViewport();
        const anchor = isCanvasPointerOverCanvas()
          ? getCanvasPointerPosition()
          : {
              x: (window.innerWidth / 2 - vp.x) / vp.zoom,
              y: (window.innerHeight / 2 - vp.y) / vp.zoom,
            };
        void pasteNodes(anchor, vp.zoom);
        return;
      }

      // 有文件 + 内部剪贴板也非空 ⇒ 不抢，让外部粘贴（图片先落盘建卡）走
      if (clipboard.nodes.length > 0) return;

      e.preventDefault();
      e.stopPropagation();

      const vp = reactFlowInstance.getViewport();
      const centerX = (window.innerWidth / 2 - vp.x) / vp.zoom;
      const centerY = (window.innerHeight / 2 - vp.y) / vp.zoom;
      useAppStore.getState().pasteExternalFromDataTransfer(e.clipboardData, { x: centerX, y: centerY });
    };
    window.addEventListener('paste', handler, true);
    return () => window.removeEventListener('paste', handler, true);
  }, [reactFlowInstance]);

  // ── Fit view event (project switch / F key) ──
  useEffect(() => {
    const handler = () => {
      wheelZoomCancelRef.current?.();
      // Wait one frame for React to finish rendering new nodes/edges
      requestAnimationFrame(() => {
        void reactFlowInstance.fitView(FIT_VIEW_OPTIONS);
      });
    };
    window.addEventListener('canvas-fit-view', handler);
    return () => window.removeEventListener('canvas-fit-view', handler);
  }, [reactFlowInstance]);

  // ── Keep anchored overlays visible by panning the whole canvas ──
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CanvasPanByDetail>).detail;
      if (!detail) return;
      const { deltaX, deltaY, duration = CANVAS_PAN_DURATION_MS } = detail;
      if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

      wheelZoomCancelRef.current?.();
      const viewport = reactFlowInstance.getViewport();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const activePan = {
        startX: viewport.x,
        startY: viewport.y,
        detail,
      };
      activeCanvasPanRef.current = activePan;

      void reactFlowInstance.setViewport(
        {
          x: viewport.x + deltaX,
          y: viewport.y + deltaY,
          zoom: viewport.zoom,
        },
        {
          duration: reduceMotion ? 0 : duration,
          ease: easeOutCubic,
          interpolate: 'linear',
        },
      ).finally(() => {
        if (activeCanvasPanRef.current !== activePan) return;
        const finalViewport = reactFlowInstance.getViewport();
        const progress = {
          deltaX: finalViewport.x - activePan.startX,
          deltaY: finalViewport.y - activePan.startY,
        };
        detail.onProgress?.(progress);
        detail.onComplete?.(progress);
        activeCanvasPanRef.current = null;
      });
    };

    window.addEventListener(CANVAS_PAN_BY_EVENT, handler);
    return () => {
      activeCanvasPanRef.current = null;
      window.removeEventListener(CANVAS_PAN_BY_EVENT, handler);
    };
  }, [reactFlowInstance]);

  // ── Focus node events (history / Agent-created node batch) ──
  useEffect(() => {
    const scheduledFrames = new Set<number>();
    const scheduledTimers = new Set<number>();
    const focusNodes = (
      nodeIds: string[],
      options?: { padding?: number; maxZoom?: number; duration?: number; pulse?: boolean },
    ) => {
      if (nodeIds.length === 0) return;
      const firstFrame = requestAnimationFrame(() => {
        scheduledFrames.delete(firstFrame);
        const secondFrame = requestAnimationFrame(() => {
          scheduledFrames.delete(secondFrame);
          const targetIds = new Set(nodeIds);
          const targetNodes = reactFlowInstance.getNodes().filter((node) => targetIds.has(node.id));
          if (targetNodes.length === 0) return;
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const duration = reduceMotion ? 0 : (options?.duration ?? 420);
          void reactFlowInstance.fitView({
            nodes: targetNodes,
            padding: options?.padding ?? (targetNodes.length === 1 ? 0.45 : 0.3),
            minZoom: targetNodes.length > 6 ? 0.18 : 0.28,
            maxZoom: options?.maxZoom ?? (targetNodes.length === 1 ? 1.1 : 0.95),
            duration,
          });
          // 单个节点定位后补一记「放大 → 回弹」脉冲，等镜头停稳再播
          if (options?.pulse && nodeIds.length === 1 && !reduceMotion) {
            const [nodeId] = nodeIds;
            const timer = window.setTimeout(() => {
              scheduledTimers.delete(timer);
              playNodeFocusPulse(nodeId);
            }, duration + 90);
            scheduledTimers.add(timer);
          }
        });
        scheduledFrames.add(secondFrame);
      });
      scheduledFrames.add(firstFrame);
    };
    const handleSingleNodeFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ nodeId: string; pulse?: boolean }>).detail;
      if (detail?.nodeId) {
        focusNodes([detail.nodeId], { maxZoom: 1, duration: 400, pulse: detail.pulse });
      }
    };
    const handleNodeBatchFocus = (e: Event) => {
      const detail = (e as CustomEvent<{
        nodeIds: string[];
        padding?: number;
        maxZoom?: number;
        duration?: number;
      }>).detail;
      if (detail?.nodeIds?.length) focusNodes(detail.nodeIds, detail);
    };
    window.addEventListener('canvas-focus-node', handleSingleNodeFocus);
    window.addEventListener('canvas-focus-nodes', handleNodeBatchFocus);
    return () => {
      window.removeEventListener('canvas-focus-node', handleSingleNodeFocus);
      window.removeEventListener('canvas-focus-nodes', handleNodeBatchFocus);
      for (const frameId of scheduledFrames) cancelAnimationFrame(frameId);
      for (const timerId of scheduledTimers) window.clearTimeout(timerId);
    };
  }, [reactFlowInstance]);

  // ── Node click → AI dialog ──
  const openNodeDialog = useAppStore((s) => s.openNodeDialog);

  /* ══ 拖拽连线的四态（官方 `zoom-slider` @1225218 + `zoom-slider-B3yfHu80.css` @53681/@58607/@29904）
      · 目标卡扫光 = `flowing-border`（方向为左再加 `flow-reverse`）→ hover 时 `flowingLight` 1.5s 循环
      · 不可连 → 目标卡 `node-disabled-blur cursor-not-allowed`（blur 3px + #000000b3 遮罩）
      · 拖拽线未连上 → `animated`（5px 蚂蚁线 0.5s）；连上/失效立即摘掉 ⇒ 动画立刻停
     ⚠️ `flowing-border` 含 `position:relative`，必须挂在卡片**内层 surface**，不能挂 `.react-flow__node` */
  const connectionState = useStore((s) => s.connection);
  const connectionInProgress = Boolean(connectionState?.inProgress);
  const hoveredConnectTargetRef = useRef<string | null>(null);
  useEffect(() => {
    const nodesRoot = document.querySelector('.react-flow__nodes') || document;
    const clearMarks = () => {
      nodesRoot.querySelectorAll<HTMLElement>('.flowing-border, .flow-reverse, .node-disabled-blur')
        .forEach((el) => el.classList.remove('flowing-border', 'flow-reverse', 'node-disabled-blur', 'cursor-not-allowed'));
    };
    const applyFor = (targetId: string) => {
      const nodeEl = nodesRoot.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(targetId)}"]`);
      if (!nodeEl) return;
      const surface = (nodeEl.firstElementChild as HTMLElement | null) ?? nodeEl;
      surface.classList.add('flowing-border');
      if (connectionState?.toPosition === 'left' || connectionState?.fromPosition === 'right') {
        surface.classList.add('flow-reverse');
      }
      const invalid = !isCanvasConnectionValid({
        source: connectionState?.fromNode?.id ?? '',
        target: targetId,
        sourceHandle: connectionState?.fromHandle?.id ?? null,
        targetHandle: connectionState?.toHandle?.id ?? null,
      });
      if (invalid) surface.classList.add('node-disabled-blur', 'cursor-not-allowed');
    };
    clearMarks();
    if (!connectionInProgress) {
      hoveredConnectTargetRef.current = null;
      return undefined;
    }
    /* ★ React Flow 在拖拽中每次移动都会更新 `connection` ⇒ 本 effect 会不停重跑；
       所以「悬停的是哪张卡」存在 ref 里，重跑时按 ref **重新打标**（不然刚打的类会被清掉）✓ */
    if (hoveredConnectTargetRef.current) applyFor(hoveredConnectTargetRef.current);
    const onMove = (event: MouseEvent) => {
      const stack = (document.elementsFromPoint?.(event.clientX, event.clientY) ?? []) as HTMLElement[];
      const nodeEl = stack.map((el) => el.closest?.('.react-flow__node') as HTMLElement | null)
        .find((el): el is HTMLElement => Boolean(el)) ?? null;
      const targetId = nodeEl?.getAttribute('data-id') ?? null;
      hoveredConnectTargetRef.current = targetId;
      clearMarks();
      if (targetId) applyFor(targetId);
    };
    window.addEventListener('mousemove', onMove, true);
    return () => window.removeEventListener('mousemove', onMove, true);
  }, [connectionInProgress, connectionState]);

  const inlineEditClickTimerRef = useRef<number | null>(null);
  /**
   * ★ 官方 `pe = 选中数 <= 1 && !R`（`R = data.hide_inputbar`）＋ `if (!be) return;`
   *   ⇒ **从本地/网络上传、或粘贴到画布的图像卡（参考卡）整条底部编辑区都不渲染**。
   *   9444 实测：4 张带「替换」的参考卡 → `canvas-node-generation-input-bar` **ABSENT**；
   *             4 张生成卡 → **VISIBLE**。判据与实测见 `utils/officialInputBar.ts`。
   *   ⚠️ 这里只挡**选中**这条路径（点卡片 / 空格）；工具栏「重绘」那种**显式**打开照旧。
   */
  const openDialogForNode = useCallback(
    (node: RFNode<BaseNodeData>) => {
      if (isInputBarSuppressedNode(node.type, node.data)) {
        // 参考卡：不弹底部编辑区（并把可能停在别的节点上的那一条收掉）
        closeNodeDialog();
        return;
      }
      const el = document.querySelector(`.react-flow__node[data-id="${node.id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        openNodeDialog(node.id, { x: rect.left + rect.width / 2, y: rect.bottom });
        return;
      }
      openNodeDialog(node.id);
    },
    [closeNodeDialog, openNodeDialog],
  );

  useEffect(() => () => {
    if (inlineEditClickTimerRef.current !== null) {
      window.clearTimeout(inlineEditClickTimerRef.current);
    }
  }, []);

  /* 官方拾取模式的 300ms 防抖（`page-BeI7xydN.js@61888` 的 `kW = 300`）。 */
  const insertFromCanvasPickRef = useRef<{ nodeId: string; at: number } | null>(null);
  /* 官方「从画布添加」拾取模式开关（见下面那段原生监听）。 */
  const insertFromCanvasPickActive = useAppStore((state) => state.insertFromCanvasPickActive);
  /* 拾取模式下 `flowing-border` 标记要跟着「节点集合 / 已引用集合」重算。 */
  const canvasNodesForPick = useAppStore((state) => state.nodes);
  const chatComposerContextNodeIdsForPick = useAppStore((state) => state.chatComposerContextNodeIds);

  /**
   * 官方拾取模式的**实际挂载点**。
   *
   * 官方把拾取接在 React Flow 的 `onNodeClick`（`AW().handleNodePick`）。实测（CDP 真鼠标点击）
   * 在 MTV 里 **`onNodeClick` 与画布根的 React 捕获处理器都不会被调用** ——
   * 节点虽然 DOM 上在 `div.canvas-drawing-root` 之内，但事件不经过这两个 React 处理器
   * （埋点后 `window.__mtvPick` 始终为 null；节点却照常被 RF 选中）。
   * ⇒ 改用**原生 document 捕获监听**（与 React 的事件树无关，必命中），
   *   只在本模式激活期间挂载，命中 `.react-flow__node[data-id]` 就地处理并掐断事件，
   *   保证 RF 不再选中该节点；非拾取模式下这段监听根本不存在，既有行为零影响。
   */
  useEffect(() => {
    if (!insertFromCanvasPickActive) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const nodeId = target?.closest('.react-flow__node')?.getAttribute('data-id');
      if (!nodeId) return;
      /* 官方 `Jd`：不在白名单里的节点**根本不能被拾取**（点了也不加）——
         这是截图里「7 张一模一样的文件图标」的根因：以前什么节点都往里塞。 */
      const state = useAppStore.getState();
      const canvasNode = state.nodes.find((item) => item.id === nodeId);
      if (!canvasNode || !isReferenceableNodeType(canvasNode.type ?? '')) return;
      event.preventDefault();
      event.stopPropagation();
      const last = insertFromCanvasPickRef.current;
      const now = Date.now();
      if (last && last.nodeId === nodeId && now - last.at < INSERT_FROM_CANVAS_PICK_DEBOUNCE_MS) return;
      insertFromCanvasPickRef.current = { nodeId, at: now };
      if (state.chatComposerContextNodeIds.includes(nodeId)) state.removeContextNodeId(nodeId);
      else state.addContextNodeIds([nodeId]);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [insertFromCanvasPickActive]);

  /**
   * 官方 `flowing-border`（拾取模式下可拾取卡片的 hover 流动光带，`course-api-base-url-*.js@1238881`）：
   * 官方节点外壳里是 `ye ? "flowing-border" : "bg-card"`，而
   * `ye = … || insertPick.showHighlight`，`showHighlight = isActive && eligible && !isPicked`。
   * MTV 不改每个节点组件，改为在**节点壳上打标记**、由 CSS 把官方那两条伪元素规则挂到真实卡面。
   */
  useEffect(() => {
    const wrappers = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node[data-id]'));
    if (!insertFromCanvasPickActive) {
      wrappers.forEach((el) => el.removeAttribute('data-insert-pick'));
      return undefined;
    }
    const { nodes: allNodes, chatComposerContextNodeIds } = useAppStore.getState();
    const picked = new Set(chatComposerContextNodeIds);
    wrappers.forEach((el) => {
      const id = el.getAttribute('data-id') ?? '';
      const node = allNodes.find((item) => item.id === id);
      const eligible = !!node && isReferenceableNodeType(node.type ?? '');
      if (eligible && !picked.has(id)) el.setAttribute('data-insert-pick', 'eligible');
      else el.removeAttribute('data-insert-pick');
    });
    return undefined;
  }, [insertFromCanvasPickActive, canvasNodesForPick, chatComposerContextNodeIdsForPick]);

  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: RFNode<BaseNodeData>) => {
      const liveNode = hydrateCanvasNodeData(node, useAppStore.getState().nodes);
      /* 官方「从画布添加」拾取模式（`AW()` @page-BeI7xydN.js@61900 逐字）：
           isNodeEligible(id) = 节点存在且有可用类型；
           300ms 内重复点同一节点**忽略**（`kW = 300`，防抖双击）；
           否则：已在 `contextNodeIds` 里 ⇒ 移出，否则 ⇒ 加入。
         官方在这条路径上**不开节点对话框**，所以这里直接 return。 */
      const pickState = useAppStore.getState();
      if (pickState.insertFromCanvasPickActive) {
        const nodeId = liveNode.id;
        const last = insertFromCanvasPickRef.current;
        const now = Date.now();
        if (last && last.nodeId === nodeId && now - last.at < INSERT_FROM_CANVAS_PICK_DEBOUNCE_MS) return;
        insertFromCanvasPickRef.current = { nodeId, at: now };
        if (pickState.chatComposerContextNodeIds.includes(nodeId)) {
          pickState.removeContextNodeId(nodeId);
        } else {
          pickState.addContextNodeIds([nodeId]);
        }
        return;
      }
      if (inlineEditClickTimerRef.current !== null) {
        window.clearTimeout(inlineEditClickTimerRef.current);
        inlineEditClickTimerRef.current = null;
      }
      // Shift+click is for multi-select, don't open dialog
      if (e.shiftKey) return;
      const target = e.target instanceof Element ? e.target : null;
      const isEmptyTextEditTrigger = target?.closest('[data-inline-edit-trigger]')
        && liveNode.data?.type === 'ai-text'
        && liveNode.data?.role !== 'source';
      if (isEmptyTextEditTrigger) {
        // 第一次点击先让 React Flow 完成选中；第二次点击会取消弹窗并交给 TextNode 的双击编辑。
        if (e.detail > 1) return;
        inlineEditClickTimerRef.current = window.setTimeout(() => {
          inlineEditClickTimerRef.current = null;
          const latestNode = getCanvasNodeById(useAppStore.getState().nodes, liveNode.id);
          if (!latestNode?.selected || latestNode.data.output) return;
          openDialogForNode(latestNode);
        }, INLINE_EDIT_DOUBLE_CLICK_DELAY_MS);
        return;
      }
      // 硬边界：这几类节点没有任何可用的 AI 对话框。
      // group / ai-markdown 与空格键（useKeyboardShortcuts.ts）的 canOpen 规则一致；
      // canvas-note 的 data.type 是 'canvas-note'，一旦唤起会让 AINodeDialog 给 PromptPanel 传入
      // 未知 nodeType，所以点击路径上一律不打开，只能走它自己的绘图/文本交互。
      // ★ pile（堆叠）：官方底部编辑条是**节点自己的子元素**（`AINodeDialog.tsx` 头部的 `pe`/`le` 记账），
      //   堆叠节点（官方 `uJe`）**根本不渲染它** —— 堆叠卡片点击的语义是「进入全屏堆叠画廊」
      //   （官方 `uJe` 的 `ne` → `openGallery`），而不是编辑单一节点。
      //   ⚠️ MTV 的编辑条是全局浮层（`activeNodeId` 驱动）⇒ 少了这条排除，点堆叠卡会
      //      **同时**弹出底部编辑区（用户实测「官方堆叠时不出现，MTV 出现了」✗）。
      const isNeverDialogNode =
        liveNode.type === 'group' ||
        liveNode.type === 'canvas-note' ||
        liveNode.type === 'pile' ||
        liveNode.data?.type === 'ai-markdown';
      if (isNeverDialogNode) {
        // 用户已经切换了选中节点，关闭可能仍停留在上一个节点上的对话框，避免浮层卡在错处。
        closeNodeDialog();
        return;
      }

      // 对话框已开启时直接切到被点击的节点：已有产物的节点也一视同仁，不必再按空格。
      // 这里读 getState() 而非订阅 activeNodeId，避免对话框开关导致 onNodeClick 反复重建。
      const isDialogOpen = useAppStore.getState().activeNodeId !== null;
      if (isDialogOpen) {
        openDialogForNode(liveNode);
        return;
      }

      /* ★★★★★ **官方：底部编辑框「单选即出现」，与卡里有没有产物无关** ✓✓
            （`zoom-slider-3ZcFvYQO.js` @1691826 逐字）
              `const fe = Fg();              // ← 选中数
               const pe = fe <= 1 && !R;     // R = data.hide_inputbar
               const le = pe && n && !I && !B;// n=visible(恒 true) · I=isAnyNodeDragging · B=inProgress
               … le ? "node-float-ui-visible" : "node-float-ui-hidden"`
            官方实测（t1074/t1076）：**点任意有图/无图的卡，条都出现**；
            点空白清空选择后条**仍在**；**多选（≥2）时条消失** ✓
            ⚠️ MTV 原来在这里有 `isSilentOnFirstClick`（有产物 / role==='source' 就不弹 ✗）
               —— 用户：「点击时单张卡片时 左右+按钮**与底部编辑框都会出现**」⇒ 已删 ✓
            ⚠️ 「≥2 选中就隐藏」由 `AINodeDialog` 的官方类名（visible/hidden）负责 ✓ */
      openDialogForNode(liveNode);
    },
    [openDialogForNode, closeNodeDialog],
  );

  // ── Selection sync ──
  const onSelectionChange = useCallback(
    (changes: OnSelectionChangeParams) => {
      const sel = changes.nodes;
      const nonGroup = sel.filter((n) => n.type !== 'group');
      // 框选忽略分组节点：与其它节点一同被选中时，store 选区剔除分组（删除/分组不波及容器）；
      // 单独点击分组仍保留（便于删除/解散）。RF 视觉去选在 onSelectionEnd 处理。
      const next = nonGroup.length > 0 ? nonGroup : sel;
      // ★ 官方 `selectionSource`（index-BiTZf8mJ.js @7600860）：框选写 "marquee"
      //   ⇒ 官方门 `nd(id)` 为假 ⇒ 节点工具栏 / 输入栏在这一轮选区里都不出现
      const fromMarquee = flowStore.getState().userSelectionActive;
      setSelectedNodeIds(next.map((n) => n.id), fromMarquee ? 'marquee' : 'direct');
    },
    [flowStore, setSelectedNodeIds],
  );

  // 框选结束后：若分组节点与其它节点一同被框中，取消分组节点的选中，避免随后被一起拖动
  const onSelectionEnd = useCallback(() => {
    clearGroupedSelection();
  }, [clearGroupedSelection]);

  /* ★ 程序化改选区的唯一入口（见 `services/canvasSelectionService.ts` 的说明）：
     MTV 的 store 选区只是 RF 选区的**镜像**，别处直接改 store 会让两边分裂
     ⇒ 这里把 RF 自己的 API 注册出去，请求方通过 `selectNodesInCanvas(ids)` 走 RF 改选，
       再由 `onSelectionChange` 回流到 store（单一事实来源 = RF）✓
     ⚠️ 请求方常常是**和 nodes 同一次更新**发出的（例：`groupSelectedNodes` 刚 `set()` 完新建的分组），
        而 React Flow 要等下一次渲染才把新节点收进它自己的 lookup ⇒ 同一次调用里直接
        `addSelectedNodes(newId)` 会被 RF 丢掉（实测：分组建出来了，但一个都没选中）。
        ⇒ 先记进 ref，等 `nodes` 变化后的 effect 再应用 —— React Flow 是 Canvas 的子组件，
          子组件 effects 先跑 ⇒ 那时 RF 已经同步完 ✓ */
  const pendingSelectionRef = useRef<string[] | null>(null);
  /* ★ 新节点刚 `addNodes` 进来时的选区请求（「立刻路径」）：
     这些 id **当帧不在 RF 的 lookup 里**，`selectNodes` 那套「记 ref 等 `nodes` 变化」会一直悬着，
     要等到下一次任意 `nodes` 变化才被应用到（实测：+3s 分组仍未选中 ✗）。
     ⇒ 分帧等到节点真进 RF，再 `reset + add`，Promise 在选区真正落下后 resolve。 */
  const selectNodesAfterRender = useCallback((ids: readonly string[]): Promise<void> => new Promise((resolve) => {
    let attempts = 0;
    const step = () => {
      const flow = flowStore.getState();
      const landed = ids.every((id) => flow.nodeLookup.has(id));
      if (landed) {
        flow.resetSelectedElements();
        if (ids.length > 0) flow.addSelectedNodes([...ids]);
        pendingSelectionRef.current = null;
        resolve();
        return;
      }
      attempts += 1;
      if (attempts >= 40) { resolve(); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), [flowStore]);
  useEffect(() => registerCanvasSelectionController({
    selectNodes: (ids) => { pendingSelectionRef.current = [...ids]; },
    selectNodesAfterRender,
  }), [selectNodesAfterRender]);
  useEffect(() => {
    const ids = pendingSelectionRef.current;
    if (!ids) return;
    pendingSelectionRef.current = null;
    const flow = flowStore.getState();
    /* RF v12 的 store API：`resetSelectedElements()` 清空（没有 `unselectAll`）+ `addSelectedNodes(ids)` */
    flow.resetSelectedElements();
    if (ids.length > 0) flow.addSelectedNodes(ids);
  }, [flowStore, nodes]);

  // ── Node snap ──
  const {
    snapLines,
    onNodeDragStart,
    applySnap,
    onNodeDragStop,
    onResizeStart,
    applyResizeSnap,
    onResizeStop,
  } = useNodeSnap();

  // 缩放吸附桥接：稳定引用透传给节点内的 ResizeHandle（经 Context）
  const resizeSnapApi = useMemo(
    () => ({ onResizeStart, applyResizeSnap, onResizeStop }),
    [onResizeStart, applyResizeSnap, onResizeStop],
  );

  // 按住 Ctrl/⌘ 开始拖拽 → 在原位复制一个节点（拖动的仍是原节点，等于"拖出一个副本"）
  const handleNodeDragStart = useCallback(
    (evt: React.MouseEvent, node: RFNode<BaseNodeData>) => {
      const liveNode = hydrateCanvasNodeData(node, useAppStore.getState().nodes);
      beginCanvasInteraction('node');
      /* 官方 `isAnyNodeDragging`：拖节点期间底部编辑框隐藏（见 `AINodeDialog` 的可见性门） */
      useAppStore.getState().setCanvasNodeDragging(true);
      if (liveNode.type === 'canvas-note') commitToHistory();
      if ((evt.ctrlKey || evt.metaKey) && liveNode.type !== 'group') {
        duplicateNode(liveNode.id);
      }
      onNodeDragStart(evt, liveNode);
    },
    [beginCanvasInteraction, commitToHistory, duplicateNode, onNodeDragStart],
  );

  /* ★ 官方画布 props（EXE `page-DPdEgTS0.js` @1448550 逐字）：
       `defaultEdgeOptions: { zIndex: 0 }` —— **只有 zIndex，没有 `type`**；全 chunk 里
       `connectionLineType` / `connectionLineStyle` / `connectionMode` 均 **0 处**
       ⇒ 官方**不指定线型**，走 React Flow 默认 `Bezier`（贝塞尔曲线）✓
     ⚠️ MTV 原来写死 `type:'smoothstep'` ✗（用户：「连接线都是一个类似 z 字形」）
        —— 拖拽预览线、卡片间连线、上游发指令后新卡的连线**都是同一个源头**，去掉 type 一次修好 ✓ */
  const defaultEdgeOptions = useMemo(
    () => ({
      style: DEFAULT_EDGE_STYLE,
      animated: false,
    }),
    [],
  );

  const renderableGraph = useMemo(
    () => filterHiddenCanvasElements(nodes, edges),
    [edges, nodes],
  );
  const renderedCanvasNodes = useMemo(() => {
    /* ⚠️ 顺序很重要：官方 PILE 投影 `pJe`@2987702 **必须跑在
       `projectCanvasNodesForReactFlow` 之前** —— 后者会把节点 data 换成一版轻量
       `createRenderData`（完整 data 由节点 wrapper 按 id 回 store 取），`data.memberIds`
       会被剥掉 ⇒ 在它之后再投影就认不出成员了（实测：anchor 数 = 0，成员照旧可见，
       与堆叠节点自己画的那一摞**双重渲染**）。 */
    const piled = projectPilesForReactFlow(renderableGraph.nodes, (node) =>
      renderSizeOf(node as never, renderableGraph.nodes as never),
    );
    const projected = projectCanvasNodesForReactFlow(piled, nodeProjectionCache);
    return draftNode ? [...projected, projectTransientCanvasNode(draftNode)] : projected;
  }, [draftNode, nodeProjectionCache, renderableGraph.nodes]);

  /** ① 官方节点入场缩放动画：给**新增**节点挂 `canvas-node-presence-entering`（250ms 后摘掉） */
  const presenceCanvasNodes = useCanvasNodePresenceEnter(renderedCanvasNodes);

  // 仅派生渲染状态，不把隐藏和节点选中效果写回可持久化的边数据。
  const edgeProjection = useMemo(
    () => createCanvasEdgeProjection(renderableGraph.edges),
    [renderableGraph.edges],
  );
  const renderedEdges = useMemo(() => {
    const projected = projectSelectedCanvasEdges(edgeProjection, selectedNodeIds);
    /* 官方 `ict`@2988335：**同一个堆叠内两个成员之间的边直接 hidden** */
    const piled = hideIntraPileEdges(projected, renderableGraph.nodes);
    // 官方左下按钮②：隐藏节点连线 —— 用 React Flow 的 edge.hidden 隐藏，不写回图数据
    return edgesVisible ? piled : piled.map((e) => ({ ...e, hidden: true }));
  }, [edgeProjection, selectedNodeIds, edgesVisible, renderableGraph.nodes]);

  // ── Node change handler ──
  const handleNodesChange = useCallback(
    (changes: NodeChange<RFNode<BaseNodeData>>[]) => {
      const currentNodes = useAppStore.getState().nodes;
      const hydratedChanges = hydrateCanvasNodeChanges(changes, currentNodes);
      const lockedNodeIds = new Set(
        currentNodes
          .filter((node) => node.draggable === false)
          .map((node) => node.id),
      );
      const unlockedChanges = hydratedChanges.filter(
        (change) => change.type !== 'position' || !lockedNodeIds.has(change.id),
      );
      if (unlockedChanges.length === 0) return;

      // 把吸附后的位置直接注入 React Flow 的变更管线
      // （成为唯一真相源，避免二次 setNodes 覆盖导致的漂移/橡皮筋）。
      // 注意：松手那一帧 dragging=false 也要吸附，否则会弹回原始落点（位移）。
      // applySnap 在非拖拽期（dragCtx 为空）是无副作用直通，故无需判断 dragging。
      const draggingPosChanges = unlockedChanges.filter(
        (c) => c.type === 'position' && c.position,
      );
      let snapped = unlockedChanges;
      if (draggingPosChanges.length > 0) {
        const dc = draggingPosChanges[0];
        if (dc.type === 'position' && dc.position) {
          const snappedPos = applySnap(dc.id, dc.position);
          const correctionX = snappedPos.x - dc.position.x;
          const correctionY = snappedPos.y - dc.position.y;
          const draggedIds = new Set(
            draggingPosChanges.flatMap((change) => change.type === 'position' ? [change.id] : []),
          );
          snapped = hydratedChanges.map((change) => {
            if (change.type !== 'position' || !change.position || !draggedIds.has(change.id)) return change;
            return {
              ...change,
              position: {
                x: change.position.x + correctionX,
                y: change.position.y + correctionY,
              },
            };
          });
        }
      }

      // Detect group node removals — convert to ungroup
      const removedIds = snapped
        .filter((c) => c.type === 'remove')
        .map((c) => c.id);

      // 快速路径：纯拖拽/选择变更（无删除）—— 用函数式更新，始终基于最新
      // store.nodes，避免快速拖动时闭包 nodes 过期导致的抖动卡顿。
      if (removedIds.length === 0) {
        useAppStore.setState((s) => ({
          nodes: applyNodeChanges(snapped, s.nodes) as RFNode<BaseNodeData>[],
        }));
        return;
      }

      applyStableNodeChanges(snapped);
    },
    [applySnap, applyStableNodeChanges],
  );

  // ── 拖入宫格分镜：进入节点范围显示缩略图，只有空格允许放置 ──
  const sbDropTarget = useRef<HTMLElement | null>(null);
  const [dropGhost, setDropGhost] = useState<{
    url: string;
    x: number;
    y: number;
    canDrop: boolean;
  } | null>(null);
  const ghostNodeId = useRef<string | null>(null);
  const shotlistDropTarget = useRef<HTMLElement | null>(null);

  const clearGhostNodeHidden = useCallback(() => {
    if (ghostNodeId.current) {
      document.querySelector(`.react-flow__node[data-id="${ghostNodeId.current}"]`)?.classList.remove('sb-drop-hidden');
      ghostNodeId.current = null;
    }
  }, []);

  const clearSbDropTarget = useCallback(() => {
    sbDropTarget.current?.classList.remove('sb-cell--drop-target');
    sbDropTarget.current = null;
  }, []);

  const clearShotlistDropTarget = useCallback(() => {
    shotlistDropTarget.current?.classList.remove('shot-frame--drop-target');
    shotlistDropTarget.current = null;
  }, []);

  // 拖到折叠分组（文件夹）上：文件夹打开，被拖节点缩小并微微倾斜
  const folderDropTarget = useRef<HTMLElement | null>(null);
  const folderDropNode = useRef<HTMLElement | null>(null);
  const clearFolderDropTarget = useCallback(() => {
    folderDropTarget.current?.classList.remove('is-folder-drop-target');
    folderDropTarget.current = null;
    folderDropNode.current?.classList.remove('folder-drop-shrink');
    folderDropNode.current = null;
  }, []);

  /**
   * 命中分镜表的画面格。
   * 与宫格不同，已绑定的格子也接受放置——直接换绑，比先解绑再拖一次顺手。
   */
  const findShotlistDropHit = useCallback((
    node: RFNode,
    clientX: number,
    clientY: number,
  ): HTMLElement | null => {
    if (!SHOTLIST_FRAME_SOURCE_TYPES.includes(node.type ?? '')) return null;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const el of stack) {
      const shotlist = el.closest<HTMLElement>('.shotlist-node');
      if (!shotlist) continue;
      if (shotlist.closest(`.react-flow__node[data-id="${node.id}"]`)) continue;
      const cell = el.closest<HTMLElement>('[data-shot-frame-row]');
      return cell?.closest('.shotlist-node') === shotlist ? cell : null;
    }
    return null;
  }, []);

  // 按鼠标位置命中宫格节点与真实空格，兼容缩放和非均匀自定义宫格。
  const findStoryboardDropHit = useCallback((
    node: RFNode,
    clientX: number,
    clientY: number,
  ): { storyboard: HTMLElement; emptyCell: HTMLElement | null } | null => {
    if (!STORYBOARD_CELL_SOURCE_TYPES.includes(node.type ?? '')) return null;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const el of stack) {
      const storyboard = el.closest<HTMLElement>('.storyboard-node');
      if (!storyboard) continue;
      if (storyboard.closest(`.react-flow__node[data-id="${node.id}"]`)) continue;
      const cell = el.closest<HTMLElement>('[data-sb-cell-idx]');
      const emptyCell = cell?.closest('.storyboard-node') === storyboard
        && cell.classList.contains('sb-cell--empty')
        ? cell
        : null;
      return { storyboard, emptyCell };
    }
    return null;
  }, []);

  const handleNodeDrag = useCallback(
    (e: React.MouseEvent, node: RFNode) => {
      // 拖动节点时也要让底部编辑区跟随。
      // 说明：浮层的位置现在**只由命令式代码写 DOM**（JSX 里已不写 left/top，那是为了修抖动），
      // 而拖动节点既不改 zoom 也不改视口，所以 canvas-viewport-change 不会触发 ——
      // 这里补一次带节点实时矩形的广播。（handleNodeDrag 本来就在做 elementsFromPoint，多读一个 rect 无额外代价。）
      const draggedRect = document
        .querySelector<HTMLElement>(`.react-flow__node[data-id="${node.id}"]`)
        ?.getBoundingClientRect();
      if (draggedRect) {
        window.dispatchEvent(new CustomEvent('canvas-node-move', {
          detail: {
            id: node.id,
            left: draggedRect.left,
            top: draggedRect.top,
            width: draggedRect.width,
            height: draggedRect.height,
          },
        }));
      }

      const liveNode = hydrateCanvasNodeData(
        node as RFNode<BaseNodeData>,
        useAppStore.getState().nodes,
      );
      const folder = node.type === 'group'
        ? null
        : document.elementsFromPoint(e.clientX, e.clientY)
          .map((el) => el.closest<HTMLElement>('.canvas-group-folder'))
          .find((el): el is HTMLElement => el != null) ?? null;
      if (folder !== folderDropTarget.current) {
        clearFolderDropTarget();
        if (folder) {
          folder.classList.add('is-folder-drop-target');
          folderDropTarget.current = folder;
          const dragged = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${node.id}"]`);
          dragged?.classList.add('folder-drop-shrink');
          folderDropNode.current = dragged;
        }
      }

      const hit = findStoryboardDropHit(node, e.clientX, e.clientY);
      const cell = hit?.emptyCell ?? null;
      if (cell !== sbDropTarget.current) {
        clearSbDropTarget();
        if (cell) { cell.classList.add('sb-cell--drop-target'); sbDropTarget.current = cell; }
      }
      // 进入宫格节点后隐藏真实节点；空格上倾斜表示可放置，占用区域保持水平。
      const url = (liveNode.data?.imageUrl || liveNode.data?.thumbnailUrl) as string | undefined;
      if (hit && url) {
        setDropGhost({ url, x: e.clientX, y: e.clientY, canDrop: cell != null });
        if (ghostNodeId.current !== node.id) {
          clearGhostNodeHidden();
          document.querySelector(`.react-flow__node[data-id="${node.id}"]`)?.classList.add('sb-drop-hidden');
          ghostNodeId.current = node.id;
        }
      } else {
        setDropGhost(null);
        clearGhostNodeHidden();
      }

      // 分镜表画面格：只做高亮，不隐藏被拖的节点——绑定后它仍要留在画布上
      const frameCell = findShotlistDropHit(node, e.clientX, e.clientY);
      if (frameCell !== shotlistDropTarget.current) {
        clearShotlistDropTarget();
        if (frameCell) {
          frameCell.classList.add('shot-frame--drop-target');
          shotlistDropTarget.current = frameCell;
        }
      }
    },
    [findStoryboardDropHit, clearSbDropTarget, clearGhostNodeHidden, findShotlistDropHit, clearShotlistDropTarget, clearFolderDropTarget],
  );

  // ── Auto group/ungroup on drag stop ──
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      const liveNode = hydrateCanvasNodeData(
        node as RFNode<BaseNodeData>,
        useAppStore.getState().nodes,
      );
      endCanvasInteraction('node');
      /* 官方 `isAnyNodeDragging=false`：拖拽结束，底部编辑框恢复显示 ✓ */
      useAppStore.getState().setCanvasNodeDragging(false);
      const cell = findStoryboardDropHit(node, event.clientX, event.clientY)?.emptyCell ?? null;
      const frameCell = findShotlistDropHit(node, event.clientX, event.clientY);
      clearSbDropTarget();
      clearShotlistDropTarget();
      clearFolderDropTarget();
      setDropGhost(null);
      clearGhostNodeHidden();
      if (frameCell) {
        const shotlistId = frameCell.closest('.react-flow__node')?.getAttribute('data-id');
        const rowId = frameCell.dataset.shotFrameRow;
        if (shotlistId && shotlistId !== node.id && rowId) {
          useAppStore.getState().bindShotlistFrame(shotlistId, rowId, node.id);
          onNodeDragStop();
          return;
        }
      }
      if (cell) {
        const sbId = cell.closest('.react-flow__node')?.getAttribute('data-id');
        const idx = Number(cell.dataset.sbCellIdx);
        if (sbId && sbId !== node.id && !Number.isNaN(idx)) {
          useAppStore.getState().fillStoryboardCell(sbId, idx, node.id);
          onNodeDragStop();
          return;
        }
      }
      /* 官方 PILE「拖拽入堆」（`page-DPdEgTS0.js`@1419600 `P1` + @1422826 `dme`/`ume`/`fme`）：
         取被拖节点的**屏幕中心**，在**包含它**的堆叠矩形里选**中心平方距离最近**的那个
         （官方**没有**重叠比例、也没有距离阈值）。
         ⚠️ 放在 `settleNodeGroupingOnDragStop` 之前 —— 落进堆叠时不再走分组收尾。 */
      const draggedEl = document.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${node.id}"]`,
      );
      if (draggedEl) {
        const r = draggedEl.getBoundingClientRect();
        const dropPileId = findPileDropTarget(readPileDropCandidates(), {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
        });
        if (dropPileId && dropPileId !== node.id) {
          useAppStore.getState().addNodesToPile(dropPileId, [node.id]);
          onNodeDragStop();
          return;
        }
      }
      settleNodeGroupingOnDragStop(liveNode);
      onNodeDragStop();
    },
    [onNodeDragStop, settleNodeGroupingOnDragStop, findStoryboardDropHit, clearSbDropTarget, clearGhostNodeHidden, endCanvasInteraction, findShotlistDropHit, clearShotlistDropTarget, clearFolderDropTarget],
  );

  return (
    <CanvasNodeLodContext.Provider value={nodeLodRuntime}>
    <ResizeSnapContext.Provider value={resizeSnapApi}>
    <div
      ref={canvasRootRef}
      className={`absolute inset-0 canvas-drawing-root is-tool-${activeDrawingTool}`}
      /* ⚠️ `data-canvas-container` **不在这里** —— 它在页面级容器上（`App.tsx` 的
          `.app-shell__content`）。官方那只容器**同时**包住画布与四周的页面 chrome，
          而「画廊打开 ⇒ chrome 飞出」是后代选择器（`[data-canvas-container] … [data-pile-gallery-chrome]`）
          ⇒ 挂在画布根上时，只有画布内部的「左下」控件命中，另外 4 个（顶左/顶右/左栏/右下）
            是画布根的兄弟，规则永不生效。`uJe` 的 `closest()` portal 锚点也一并上移 ✓ */
      /* 官方 `Wke`：`p = 选中数 > 1` 时所有节点的 `+` 都被 force-hidden ⇒ 这里把多选态写到容器上，
         由 `styles/reactflow.css` 的 `[data-multi-selection='true'] .node-handle::after` 隐藏。 */
      data-multi-selection={selectedNodeIds.length > 1 ? 'true' : 'false'}
      onPointerDownCapture={handleDrawingPointerDown}
      onPointerMoveCapture={handleDrawingPointerMove}
      onPointerUpCapture={handleDrawingPointerUp}
      /* 双击空白处 → 官方实测弹出「添加节点」菜单。
         必须用**捕获阶段**：React Flow 的 pane 会 stopPropagation，冒泡到不了这里。 */
      onDoubleClickCapture={onDoubleClick}
    >
      <ReactFlow
        nodes={connectionPending ? [...presenceCanvasNodes, connectionPending.node] : presenceCanvasNodes}
        edges={connectionPending ? [...renderedEdges, connectionPending.edge] : renderedEdges}
        onConnect={onConnect}
        onConnectEnd={handleConnectEnd}
        onEdgeMouseEnter={handleEdgeMouseEnter}
        onEdgeMouseMove={handleEdgeMouseMove}
        onEdgeMouseLeave={handleEdgeMouseLeave}
        isValidConnection={isCanvasConnectionValid}
        onNodeClick={onNodeClick}
        onDoubleClick={onDoubleClick}
        onSelectionChange={onSelectionChange}
        onSelectionEnd={onSelectionEnd}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChangeWithReferences}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        zIndexMode="manual"
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={CONNECTION_LINE_STYLE}
        connectionRadius={30}
        /* ★ 官方「网格吸附」（左下按钮③）：`snapToGrid` 可切 + **`snapGrid = [15,15]`**（t1193 fiber 实测）✓
           ⚠️ 别与背景网格的 `gap 20` / 圆点 `r 0.5` 搞混（那是背景 pattern，两个 App 本来就一致）*/
        snapToGrid={snapToGrid}
        snapGrid={[15, 15]}
        onlyRenderVisibleElements
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={MIN_CANVAS_ZOOM}
        maxZoom={MAX_CANVAS_ZOOM}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={PRO_OPTIONS}
        {...drawingInteraction}
        onContextMenu={(e) => e.preventDefault()}
        onMove={handleCanvasViewportMove}
        onMoveStart={handleCanvasViewportMoveStart}
        onMoveEnd={handleCanvasViewportMoveEnd}
        onPaneClick={handleCanvasPaneClick}
        onMouseMove={handleCanvasPointer}
        onMouseUp={handleCanvasPointer}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Snap alignment lines */}
        {snapLines.length > 0 && <SnapLinesOverlay lines={snapLines} />}

        {/* Grid background —— 官方实测（**两次不同缩放**反推，务必除以 zoom ✗ 别只看 pattern 原值）：
             官方 @zoom 1.02 : pattern **20.4×20.4** · circle cx=0.51 cy=0.51 r=**0.51**
                               → 20.4 / 1.02 = **20**（gap）· 0.51 / 1.02 = **0.5**（r → size 1）
             官方 @zoom 2    : pattern **40×40**    · circle r=**1**
                               → 40 / 2 = 20 ✓ · 1 / 2 = 0.5 ✓  **互相印证**
             → React Flow props：gap **20** · size **1** · bgColor rgb(0,0,0) · color rgba(255,255,255,0.3)
             ⚠️ 我上一版把 gap 记成 40 / size 记成 2 ✗ —— 那是**忘了除以当时的缩放** ✓ 已改回。 */}
        {/* ★ 背景网格**常驻**（官方没有隐藏网格的开关 ⇒ 不再受任何 state 影响）✓ */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          bgColor="rgb(0, 0, 0)"
          color="rgba(255, 255, 255, 0.3)"
        />


        {/* 画布左下控制条 — 逐字对齐官方源码（zoom-slider-3ZcFvYQO.js）：
              容器 241×40 · r16 · gap8 · pad 0 12 0 8 · 距左 15 / 距下 15
              4 个 28×28 r8 按钮（缩略图 / 连线 / 网格 / 重置）+ 77px 滑条 + 容器外圆形帮助钮
              按钮图标为官方三态（默认 / 悬浮 / 激活）
            ★ 小地图**必须在同一个 Panel 内**、堆在控制条上方 —— 官方实测：
                打开小地图后该 Panel 由 293×40 变成 **293×194**
                194 = 150(小地图) + 4(mb-1) + 40(控制条) ✓
                小地图 距左 16 / 距下 59（= 40 + 15 + 4）· 横向与控制条仅差 1px
              MTV 原来把 `.minimap-stats-zone` 做成游离的 absolute 浮层 ✗
              → 纵向、横向都对不上（用户反馈）✅ 已改为同 Panel 内 flex-col 堆叠 */}
        {/* 官方 Pin 条：画布顶部居中（官方 = `Panel position="top-center" className="!z-50 pointer-events-none !mt-4"`
            内的 `flex flex-col items-center gap-3` → `flex h-10 items-center gap-x-3` 一行；
            条自身 `pointer-events-auto mt-2.5 flex self-start items-center` + `no-drag`）*/}
        <Panel position="top-center" className="pin-bar-slot">
          <PinBar />
        </Panel>
        <Panel position="bottom-left" className="canvas-control-pill-slot"
          /* 官方 page-DPdEgTS0.js：画廊打开时左下缩放簇左下移出（CSS 在 nodes-pile.css） */
          data-pile-gallery-chrome="bottom-left">
          <div className="canvas-control-stack">
            {minimapVisible && <MiniMapNodeStats />}
            <CanvasControlPill
              snapToGrid={snapToGrid}
              minimapVisible={minimapVisible}
              edgesVisible={edgesVisible}
              onToggleSnap={() => setSnapToGrid((v) => !v)}
              onToggleMinimap={() => useAppStore.getState().toggleMinimap()}
              onToggleEdgesVisible={() => setEdgesVisible((v) => !v)}
              onOpenHelp={() => useAppStore.getState().setHelpOpen(true)}
            />
          </div>
        </Panel>
        {/* ⚠️ 官方小地图的视口框是**直角**的 ✗ 没有任何圆角 ——
             用户截图**像素采样**证实：上下两条线相距 76 design px、左右看不到线
             （视口框比小地图宽 → 左右被裁），且四角是尖的 ✓
             MTV 原来挂载 RoundedMiniMapMask ✗ 会给视口框加 6px 圆角 ✗ → **已停用** ✓
             （组件文件保留，日后若要圆角框可再启用 ✓） */}

        {/* 操作记录 — 撤销 / 还原 + 可回溯的操作列表
            ⚠️ 用户要求取消（见 `config/canvasTopOverlays.ts`）；官方构建里**没有**这个浮层
            （「操作记录」在 index/page bundle 均 0 命中）⇒ 关掉更接近 1:1 */}
        {CANVAS_TOP_OVERLAYS.history && (
          <Panel position="top-right" className="canvas-history-slot">
            <HistoryTimelinePanel />
          </Panel>
        )}

        {canvasNoteToolbarVisible && (
          <Panel position="bottom-left" className="canvas-drawing-toolbar-slot canvas-drawing-ui">
            <CanvasDrawingToolbar
              activeTool={activeDrawingTool}
              imageReady={Boolean(pendingImage)}
              onSelectTool={chooseDrawingTool}
            />
          </Panel>
        )}

        {panelNote && (
          <Panel position="top-left" className="canvas-note-style-panel-slot canvas-drawing-ui">
            <CanvasNoteStylePanel
              key={selectedNoteNode?.id ?? activeDrawingTool}
              note={panelNote}
              selected={Boolean(selectedNoteNode)}
              onPatch={(patch) => { applyNotePatch(patch); }}
              onTransientPatch={(patch) => { applyNotePatch(patch, true); }}
              onBeginChange={beginNoteChange}
              onEndChange={endNoteChange}
              onDuplicate={() => { duplicateSelectedNote(); }}
              onDelete={() => { deleteSelectedNote(); }}
              onMoveLayer={(direction) => { moveSelectedNoteLayer(direction); }}
              onCrop={requestCrop}
            />
          </Panel>
        )}

        {/* 官方「当前视窗没有节点」提示（`fwt` @3561288；挂载点 `!Ct&&!de&&s.jsx(fwt,{})` @3569115）
              —— 底部居中胶囊 + 「回到节点」按钮。官方两个门控：
                · `de = Ud("viewportEmptyHint")` 是 **TapNow 平台策略**（`mergedPolicy.canvasControls
                  .hiddenItems`，默认策略 @634272 里确实含它）；MTV 没有这套配置 ⇒ 恒渲染。
                · `Ct` @3566290 = `window.location.host.includes("mediastorm")`（域名开关，
                  不是教程/活动门控）；MTV 的 host 不是 mediastorm ⇒ 恒不命中，不移植。
              组件内部自己按 `shouldShowEmptyHint` 决定渲染，与官方 `r ? <Panel…> : null` 一致。*/}
        <CanvasViewportEmptyHint />

        {/* 原右下工具条已并入左下控制条，这里不再重复渲染 */}

        {/* Empty state */}
        {nodes.length === 0 && <CanvasEmptyState />}

        {/* Drop zone overlay */}
        {isDragOver && (
          <Panel position="top-left" className="!m-0 !inset-0 pointer-events-none z-50">
            <div className="absolute inset-0 border-2 border-dashed border-white/60 rounded-2xl m-3 flex items-center justify-center">
            </div>
          </Panel>
        )}

      </ReactFlow>

      {radialMenuHoldPosition && (
        <CanvasLongPressIndicator position={radialMenuHoldPosition} />
      )}
      {radialMenuPosition && (
        <CanvasRadialMenu position={radialMenuPosition} onClose={closeRadialMenu} />
      )}

      {/* Connection drop menu */}
      <ConnectionMenu
        visible={connectionMenu.visible}
        position={connectionMenu.position}
        groups={connectionMenuGroups}
        menuRef={connectionMenuRef}
        onSelect={handleConnectionMenuSelect}
        /* ★ 官方选区 `+`（`page-DPdEgTS0.js` @1437683）：锚点已按 `x$` 钳制过 ⇒
           菜单走官方「居中 + mt-4」那套，不再二次钳制（否则和白色贝塞尔曲线对不上） */
        selectionAnchor={connectionMenu.mode === 'selection'}
      />

      {/* Context menu */}
      <CanvasContextMenu
        visible={ctxMenu.visible}
        position={ctxMenu.position}
        menuRef={ctxMenuRef}
        onUndo={handleCtxUndo}
        onRedo={handleCtxRedo}
        onPaste={handleCtxPaste}
        hasSelection={ctxHasSelection}
        onUpload={uploadNodeAtCtxPos}
        onAddAsset={() => useAppStore.getState().setProjectLibraryOpen(true)}
        /* ★ 官方「添加节点 / 添加辅助工具」= 在点击处插 command 节点 + 弹出该节点的面板 */
        onInsertCommandNode={() => insertCommandNodeAtCtxPos('default')}
        onInsertUtilityNode={() => insertCommandNodeAtCtxPos('utility')}
      />

      {/* Node context menu */}
      <NodeContextMenu
        visible={nodeCtxMenu.visible}
        position={nodeCtxMenu.position}
        menuRef={nodeCtxMenuRef}
        /* 官方 radix Item 选中即关菜单 ⇒ MTV 在动作后显式关闭（否则会压住随之弹出的对话框） */
        onClose={closeNodeCtxMenu}
        onCopy={handleCopy}
        onCut={handleCut}
        hasTextSelection={nodeCtxMenu.textSelection != null}
        onCopyText={handleCopyText}
        onCutText={handleCutText}
        onDuplicate={handleDuplicate}
        onToggleLock={handleToggleLock}
        isLocked={isNodeLocked}
        onConvertImage={showImageConversion ? handleConvertImage : undefined}
        imageConversionLabel={imageConversionLabel}
        onAddToCharacter={showAddToCharacter ? handleAddToCharacter : undefined}
        onUngroup={isGroupNode ? handleUngroup : undefined}
        onOpenGroupFolder={isGroupNode ? handleOpenGroupFolder : undefined}
        onDelete={handleDelete}
        onShowInFolder={showInFolder ? handleShowInFolder : undefined}
        onSaveAs={showSaveAs ? handleSaveAs : undefined}
        onOpenInPS={showOpenInPS ? handleOpenInPS : undefined}
        onEditVideo={showEditVideo ? handleEditVideo : undefined}
        editVideoLabel={editVideoLabel}
        onOpenInJianying={showOpenInVideoEditor ? handleOpenInJianying : undefined}
        onOpenInPremiere={showOpenInVideoEditor ? handleOpenInPremiere : undefined}
        onCopyMedia={showCopyMedia ? handleCopyMedia : undefined}
        copyMediaLabel={copyMediaLabel}
        pluginTools={pluginTools}
        onPluginTool={handlePluginTool}
        onApplyAllHistory={() => applyNodeHistory(nodeCtxMenu.nodeId ?? '')}
        showApplyHistory={ctxNodeHasMedia}
        /* ★ 官方卡片菜单「删除其他历史」(`deleteVariants`, hidden: 历史数<=1)：
             保留当前主图那条记录，其余走 MTV 的 `deleteHistoryEntry(nodeId, entryId)`。 */
        onDeleteVariants={handleDeleteVariants}
        showDeleteVariants={ctxVariantCount > 1}
        /* ★ 官方卡片菜单「保存到素材库」（与**节点工具栏同一个 handler**）：
             官方 = 先选素材库文件夹（`library.selectFolder`）→ 落盘 → toast「已保存到「{folder}」」；
             `showSaveToLibrary` = 官方条件 `q`（IMAGE/VIDEO/TEXT/AUDIO） */
        onSaveToLibrary={() => {
          const id = nodeCtxMenu.nodeId;
          if (!id) return;
          useAppStore.getState().openSaveToLibraryMenu(id, nodeCtxMenu.position);
        }}
        showSaveToLibrary
      />

      {/* ★ 官方「新建主体」左侧编辑器面板（`page-DPdEgTS0.js`@char1618455 element library editor）：
           由多选工具栏的「新建主体」按钮打开（官方 `re` 门 / `elementLibrary.editor.createTitle`）。
           打开时把**可捕节点**一起交过去（官方 `openForNodes(se)`），面板负责建 `DramaCharacter` + 挂参考图。 */}
      {elementEditorNodeIds ? (
        <ElementEditorPanel
          nodeIds={elementEditorNodeIds}
          onClose={() => useAppStore.getState().closeElementEditor()}
        />
      ) : null}

      {/* ★ 官方「保存到素材库」的文件夹选择器（`library.selectFolder`）：选中 → 落盘 → toast「已保存到「{folder}」」 */}
      {/* ★ 官方「保存到素材库」对话框（源码 `page-DPdEgTS0.js` @263193 `z2`）：
          360 宽 · r16 · bg rgba(38,38,38,.95) · 居中；选中文件夹 → 落盘 → toast「已保存到「{folder}」」 */}
      <SaveToLibraryDialog
        visible={saveToLibraryMenu !== null}
        nodeIds={saveToLibraryMenu?.nodeIds}
        mode={saveToLibraryMenu?.mode ?? 'save'}
        sourceFolder={saveToLibraryMenu?.folderPath}
        onClose={closeSaveToLibraryMenu}
        onConfirm={(folder) => {
          const target = saveToLibraryMenu;
          closeSaveToLibraryMenu();
          if (!target) return;
          /* 官方 z2 的 onConfirm 按 kind 分派：upload=保存 / move=移动到 / copy=创建副本 */
          /* ★ 官方多选工具栏的 `saveToLibrary` 是**整个选择**一起进对话框（`openForSelection`）
               ⇒ 这里对 `nodeIds` 逐个落盘（官方服务端一次收一批，MTV 逐个写同一文件夹）。 */
          if (target.mode === 'save' && target.nodeIds?.length) {
            for (const id of target.nodeIds) void saveNodeToLibrary(id, folder);
          }
          else if (target.mode === 'move' && target.filePath) void moveAssetToLibraryFolder(target.filePath, folder);
          else if (target.mode === 'copy' && target.filePath) void copyAssetToLibraryFolder(target.filePath, folder);
          else if (target.mode === 'move' && target.folderPath) void moveLibraryFolderTree(target.folderPath, folder);
          else if (target.mode === 'copy' && target.folderPath) void copyLibraryFolderTree(target.folderPath, folder + '/' + target.folderPath.split('/').pop());
          /* ★ 官方「添加 → 上传」的**第二步**（9444 实测 t822-C2）：确认文件夹后才走系统文件选择，
             把文件拷进所选文件夹；完成后 bump `libraryRevision` ⇒ 素材库面板重读（面板不在本组件树内） */
          else if (target.mode === 'upload') {
            void (async () => {
              /* 官方：上传时弹**进度浮层**（文件缩略图 + 名称 + 环形百分比），完成即消失，
                 不再弹「文件已保存」这类 toast。
                 ⚠️ 本地拷贝是**瞬时**的（不像官方云端上传有耗时）⇒ 卡片若立即消失会「完全看不到」，
                    所以给一个**最短可见时长**（1.8s），保证用户能看到 0/N → N/N 的过程。 */
              /* 官方：素材库上传走「文件传输中心」自动上报（行首缩略图也由那里显示）——见 services/fs/assetLibrary.ts */
              await addAssetFilesToLibraryFolder(folder);
              useAppStore.getState().bumpLibraryRevision();
            })();
          }
        }}
      />

      {pendingPluginTool ? (
        <NodePluginToolDialog
          pluginTool={pendingPluginTool.tool}
          nodeId={pendingPluginTool.nodeId}
          onClose={closePluginToolDialog}
        />
      ) : null}

      {characterCaptureNodeId ? createPortal(
        <Suspense fallback={null}>
          <CharacterAssetDialog
            isOpen
            sourceNodeId={characterCaptureNodeId}
            onClose={closeCharacterCapture}
          />
        </Suspense>,
        document.body,
      ) : null}

      {/* 官方「多选浮动工具栏」（`Bme`）：MTV 自有那套（对齐/分布/批量生成）已按用户要求移除 */}
      <SelectionToolbar
        onOpenSelectionMenu={openSelectionMenuAt}
        selectionMenuOpen={connectionMenu.visible && connectionMenu.mode === 'selection'}
      />

      {/* ★ 画布内「返回我的项目」品牌按钮（用户口径）：
          官方 `AppNavBar` 顶部居中的火焰 logo（`size={48}` ⇒ small 变体 + 入场点火），
          但**只作为画布内的一个按钮**存在 —— 不做全局导航栏，且只在进入项目后出现。 */}
      {currentProjectId && !projectLibraryOpen && (
        <div className="canvas-brand-nav">
          <BrandFlameButton
            label={t('返回我的项目')}
            onActivate={backToProjects}
            autoIgnite
          />
        </div>
      )}

      {/* 官方「上传/下载」进度浮层（图1/图2） */}

      {/* 官方**通用节点选择模式**（store `dr` @1191063 + 工具条 `CW` + 源节点遮罩 `AIe` + 三态 `rke` @1211063
          + 点击处理 `VW` @page66248）：底部编辑区「参考 → 从画布选择」走的就是它。
          必须挂在 **ReactFlowProvider 之内**（工具条要 `useViewport` / `useReactFlow` 才能算「源节点是否在屏幕里」）。 */}
      <NodeSelectionPickToolbar />
      <NodeSelectionPickLayer />
    </div>

    {/* 拖入宫格：节点范围内显示缩略图，空格上倾斜表示可放置 */}
    {dropGhost && createPortal(
      <div
        className={`sb-drag-ghost${dropGhost.canDrop ? '' : ' sb-drag-ghost--over-storyboard'}`}
        style={{ left: dropGhost.x, top: dropGhost.y }}
      >
        <div className="sb-drag-ghost-clip">
          <img src={dropGhost.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>,
      document.body,
    )}
    {/* 连线剪刀 — 官方 `Lpe`：hover 连线（同边 800ms）后 32×32 圆钮正中跟随鼠标，点它断开连线。
        官方对**不可删的边**不是「不显示」，而是显示为**禁用态**：
          aria-disabled={!deletable} · aria-disabled:opacity-70 · aria-disabled:hover:* 还原 ·
          图标换成 16px `text-zinc-500`（可删时 18px `text-zinc-400` + rotate(-45deg)）· 带 tooltip */}
    {edgeScissors && createPortal(
      <div
        className="edge-scissors-layer"
        style={{ '--scissors-x': `${edgeScissors.x}px`, '--scissors-y': `${edgeScissors.y}px` } as React.CSSProperties}
        onMouseEnter={cancelEdgeScissorsClose}
      >
        <button
          type="button"
          className="edge-scissors-btn"
          aria-disabled={edgeScissors.deletable ? undefined : true}
          aria-label={edgeScissors.deletable ? '删除连线' : t('该连线不可删除')}
          data-tooltip={edgeScissors.deletable ? undefined : t('该连线不可删除')}
          data-tooltip-delay="0"
          onClick={handleEdgeCut}
        >
          {edgeScissors.deletable ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
              <path d="M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
              <path d="M9.15 14.85l8.85 -10.85" />
              <path d="M6 4l8.85 10.85" />
            </svg>
          ) : (
            /* 官方：不可删时换 16px、`text-zinc-500` 的图标 ✓ */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-zinc-500">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </button>
      </div>,
      document.body,
    )}
    </ResizeSnapContext.Provider>
    </CanvasNodeLodContext.Provider>
  );
}

export default function Canvas() {
  /* 接收外部编辑器（PS 面板）**主动推来**的图片 → 落成画布卡片；顺带把桥接服务拉起。 */
  useCanvasImagePush();
  return (
    <ReactFlowProvider>
      {/* 官方 `rct`（PileGalleryProvider）包住画布，`oct`（PileGalleryHost）与画布同级：
          · Provider 必须在**堆叠节点之上**（`uJe` 里 `_J()` 取 openGallery）
          · Host 必须**在 ReactFlowProvider 之内**（它读 React Flow 的节点表）
          见 `components/nodes/PileGalleryProvider.tsx` 顶部注释的官方源码对照。 */}
      {/* 官方 PILE **成员操作上下文**（`mJ` + `ect`@2939710 + 真实 value `us`@page1460466）：
          画廊 `WQe` 的 `removeMember` / `moveMemberToTop` / `dismissMemberError` 与堆叠渲染器
          `uJe` 的 `enabled` / `unpile` / `dismissMemberError` 都走它 ⇒ 必须**同时包住**
          `CanvasInner`（堆叠节点）与 `PileGalleryHost`（全屏画廊），且在 ReactFlowProvider 之内
          （`removeMember` 用 `useReactFlow().screenToFlowPosition` 换算拖拽落点）。 */}
      <PileMemberActionsScope>
        <PileGalleryProvider>
          <CanvasInner />
          <PileGalleryHost />
        </PileGalleryProvider>
      </PileMemberActionsScope>
    </ReactFlowProvider>
  );
}
