/**
 * Node slice — canvas nodes / edges core state and CRUD
 */
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import type { StateCreator } from 'zustand';
import type { AppState } from './useAppStore';
import type {
  BaseNodeData,
  CanvasNoteData,
  CanvasNoteLayerDirection,
  CanvasNotePatch,
  CharacterLibraryNodeLink,
  NodeGroup,
  ShotRow,
  StoryboardCellOverride,
} from '../types';
import { createCanvasNoteData, STORYBOARD_CELL_SOURCE_TYPES } from '../types';
import type { MediaGenerationIntent, MediaGenerationResult } from '../types/media';
import { generateId, getNextDisplayId } from './store.utils';
import { BATCH_NODE_LIMIT } from './store.chat';
import * as fileService from '../services/fileService';
import { playNodeExit } from '../utils/nodeAnimations';
import { cancelNodePolling } from '../services/pollManager';
import { applyProjectDefaultsToNodeData } from '../services/projectSettingsService';
import { getCanvasPointerPosition } from '../services/canvasPointerService';
import { resolveDirectorRuntime } from '../services/directorRuntimeRegistry';
import { copyNodeMedia, needsNodeMediaCopy, discardCopiedNodeMedia } from '../services/nodeMediaCopy';
import { registerCanvasDerivation, isCanvasDerivationFresh, completeCanvasDerivation } from '../services/canvasDerivationGuard';
import { markHideInputBarForFileBackedImage } from '../utils/officialInputBar';

interface GroupNodeDataAccess {
  groupId: string;
}

export function isCanvasConnectionValid(connection: {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): boolean {
  if (connection.source === connection.target) return false;
  const { sourceHandle, targetHandle } = connection;
  if (
    (sourceHandle === 'left' || sourceHandle === 'right')
    && (targetHandle === 'left' || targetHandle === 'right')
  ) {
    return sourceHandle !== targetHandle;
  }
  return true;
}

function normalizeCanvasConnection(connection: Connection): Connection | null {
  if (!isCanvasConnectionValid(connection)) return null;
  const draggedFromInput = connection.sourceHandle === 'left' && connection.targetHandle === 'right';
  if (!draggedFromInput) return connection;
  return {
    source: connection.target,
    target: connection.source,
    sourceHandle: connection.targetHandle,
    targetHandle: connection.sourceHandle,
  };
}

function hasMaterializedNodeOutput(data: BaseNodeData, nodeType: string | undefined): boolean {
  const hasValue = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  if (['ai-image', 'source-image', 'ai-animation', 'ai-panorama', 'ai-storyboard'].includes(nodeType ?? '')) {
    return hasValue(data.imageUrl) || hasValue(data.thumbnailUrl);
  }
  if (['ai-video', 'source-video'].includes(nodeType ?? '')) return hasValue(data.videoUrl);
  if (['ai-audio', 'source-audio'].includes(nodeType ?? '')) return hasValue(data.audioUrl);
  if (nodeType === 'ai-director') {
    return hasValue(data.imageUrl)
      || hasValue(data.videoUrl)
      || (Array.isArray(data.directorCaptureUrls) && data.directorCaptureUrls.some(hasValue));
  }
  return hasValue(data.output);
}

function prepareDirectorNodeDataForInsertion(
  data: BaseNodeData,
  nodeType: string | undefined,
  instanceId: string,
): BaseNodeData {
  if (nodeType !== 'ai-director') return data;
  const resolution = resolveDirectorRuntime(data.directorRuntimeKind);
  const next: BaseNodeData = {
    ...data,
    ...(Array.isArray(data.directorCaptureUrls)
      ? { directorCaptureUrls: [...data.directorCaptureUrls] }
      : {}),
    ...(Array.isArray(data.directorCaptureFilePaths)
      ? { directorCaptureFilePaths: [...data.directorCaptureFilePaths] }
      : {}),
    directorInstanceId: instanceId,
    directorStatus: 'idle',
  };
  if (resolution.supported) next.directorRuntimeKind = resolution.kind;
  if (next.status === undefined || next.status === 'loading' || next.status === 'error') {
    next.status = hasMaterializedNodeOutput(next, nodeType) ? 'success' : 'idle';
  }
  delete next.error;
  return next;
}

function prepareNodeForInsertion(
  node: Node<BaseNodeData>,
  data: BaseNodeData,
  displayId: number,
): Node<BaseNodeData> {
  const prepared = prepareDirectorNodeDataForInsertion(data, node.type, node.id);
  /* ★ 官方「参考卡不渲染底部编辑区」（`hide_inputbar`）：打标规则与实测见
     `utils/officialInputBar.ts` 的文件头。粘贴 / 右键上传 / 拖文件进画布都走这个插入漏斗。 */
  const withInputBarGate = markHideInputBarForFileBackedImage(node.type, prepared);
  return { ...node, data: { ...withInputBarGate, displayId } } as Node<BaseNodeData>;
}

/** 节点相对画布的绝对流坐标（把祖先分组的偏移累加上去）。
 *  导出给 AINodeDialog 用：它要靠坐标换算浮层位置，而不能读 DOM 几何（会触发强制同步布局）。 */
export function absoluteNodePosition(node: Node<BaseNodeData>, nodes: Node<BaseNodeData>[]) {
  const position = { ...node.position };
  const visited = new Set([node.id]);
  let parentId = node.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = nodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    position.x += parent.position.x;
    position.y += parent.position.y;
    parentId = parent.parentId;
  }
  return position;
}

function nodeSize(node: Node<BaseNodeData>) {
  return {
    width: node.measured?.width ?? node.width ?? (Number(node.style?.width) || node.data.nodeWidth || 333),
    height: node.measured?.height ?? node.height ?? (Number(node.style?.height) || node.data.nodeHeight || 160),
  };
}

function groupContainsPoint(group: Node<BaseNodeData>, point: { x: number; y: number }, nodes: Node<BaseNodeData>[]) {
  const position = absoluteNodePosition(group, nodes);
  const size = nodeSize(group);
  return point.x >= position.x && point.x <= position.x + size.width
    && point.y >= position.y && point.y <= position.y + size.height;
}

function nodeCenter(node: Node<BaseNodeData>, nodes: Node<BaseNodeData>[]) {
  const position = absoluteNodePosition(node, nodes);
  const size = nodeSize(node);
  return { x: position.x + size.width / 2, y: position.y + size.height / 2 };
}

/** 新建节点按画布位置加入展开分组，与插入本身共用一次历史快照。 */
function insertNodeInGroup(state: Pick<AppState, 'nodes' | 'groups'>, node: Node<BaseNodeData>) {
  const center = nodeCenter(node, state.nodes);
  const parent = node.parentId || node.type === 'group' ? undefined : state.nodes.find((candidate) => (
    candidate.type === 'group' && !candidate.hidden && !candidate.data.groupCollapsed
    && groupContainsPoint(candidate, center, state.nodes)
  ));
  if (!parent) return { nodes: [...state.nodes, node], groups: state.groups };
  const position = absoluteNodePosition(parent, state.nodes);
  return {
    nodes: [...state.nodes, {
      ...node, parentId: parent.id,
      position: { x: node.position.x - position.x, y: node.position.y - position.y },
    }],
    groups: state.groups.map((group) => group.id === parent.data.groupId
      ? { ...group, nodeIds: [...new Set([...group.nodeIds, node.id])] } : group),
  };
}

function prepareDuplicateNodeData(
  data: BaseNodeData,
  nodeType: string | undefined,
  cloneId: string,
): BaseNodeData {
  const duplicate = structuredClone(data);

  if (duplicate.status === 'loading') {
    duplicate.status = hasMaterializedNodeOutput(duplicate, nodeType) ? 'success' : 'idle';
    delete duplicate.error;
  }

  if (nodeType === 'ai-director') {
    return prepareDirectorNodeDataForInsertion(duplicate, nodeType, cloneId);
  }

  if (nodeType === 'ai-markdown') {
    delete duplicate.fileName;
    delete duplicate.filePath;
    delete duplicate.assetId;
    delete duplicate.relativePath;
  }

  return duplicate;
}

/**
 * 删除节点前统计「还有人在用」的文件：存活节点的媒体文件、宫格各格引用的图片、
 * 对话里的媒体产物。宫格格子和源图共用同一个文件，漏掉它就会把还在显示的图搬进回收站。
 */
export function collectKeepPaths(
  nodes: Node<BaseNodeData>[],
  idsToDelete: ReadonlySet<string>,
  messages: { mediaResult?: { filePath?: string } }[],
): Set<string> {
  const keepPaths = new Set<string>();
  for (const node of nodes) {
    const data = node.data as BaseNodeData;
    if (!idsToDelete.has(node.id) || data.artifactId) {
      fileService.collectNodeFileReferences(data).forEach((reference) => keepPaths.add(reference));
    }
  }
  for (const message of messages) {
    if (message.mediaResult?.filePath) keepPaths.add(message.mediaResult.filePath);
  }
  return keepPaths;
}

function mergeNodeData(previous: BaseNodeData, patch: Partial<BaseNodeData>): BaseNodeData {
  const next = { ...previous, ...patch } as BaseNodeData;
  // 节点换了底层文件（重新生成、裁切、重命名…）就必须一并作废旧的资产身份：
  // 加载时 relativePath 的优先级高于 filePath，留着上一次的身份会把节点解析回上一张图。
  // 调用方自己带了 assetId / relativePath（移动到分组目录之类）说明身份仍然有效，按它的来。
  if (
    'filePath' in patch && patch.filePath !== previous.filePath
    && !('assetId' in patch) && !('relativePath' in patch)
  ) {
    next.assetId = undefined;
    next.relativePath = undefined;
  }
  return next;
}

function mergeCanvasNotePatch(note: CanvasNoteData, patch: CanvasNotePatch): CanvasNoteData {
  return {
    ...note,
    ...patch,
    style: patch.style ? { ...note.style, ...patch.style } : note.style,
  };
}

function pruneDeletedNodesAndEmptyGroups(
  nodes: Node<BaseNodeData>[],
  edges: Edge[],
  groups: NodeGroup[],
  deletedNodeIds: Set<string>,
) {
  const deletedGroupDataIds = new Set(
    nodes
      .filter((node) => deletedNodeIds.has(node.id) && node.type === 'group')
      .map((node) => (node.data as unknown as GroupNodeDataAccess).groupId)
      .filter(Boolean),
  );
  const prunedGroups = groups
    .filter((group) => !deletedNodeIds.has(group.id) && !deletedGroupDataIds.has(group.id))
    .map((group) => ({
      ...group,
      nodeIds: group.nodeIds.filter((nodeId) => !deletedNodeIds.has(nodeId)),
    }));
  // 只清理「因删除而变空」的分组；手动创建的空文件夹要留着
  const emptyGroupIds = new Set(
    prunedGroups
      .filter((group) => group.nodeIds.length === 0
        && (groups.find((g) => g.id === group.id)?.nodeIds.length ?? 0) > 0)
      .map((group) => group.id),
  );
  const allDeletedNodeIds = new Set(deletedNodeIds);
  for (const groupId of emptyGroupIds) allDeletedNodeIds.add(groupId);
  for (const node of nodes) {
    if (
      node.type === 'group'
      && emptyGroupIds.has((node.data as unknown as GroupNodeDataAccess).groupId)
    ) {
      allDeletedNodeIds.add(node.id);
    }
  }

  return {
    nodes: nodes.filter((node) => !allDeletedNodeIds.has(node.id)),
    edges: edges.filter(
      (edge) => !allDeletedNodeIds.has(edge.source) && !allDeletedNodeIds.has(edge.target),
    ),
    groups: prunedGroups.filter((group) => !emptyGroupIds.has(group.id)),
  };
}

/** 渲染前剔除隐藏元素：角色库收纳的节点、已折叠分组的子节点，以及它们的连线 */
export function filterHiddenCanvasElements(
  nodes: Node<BaseNodeData>[],
  edges: Edge[],
): { nodes: Node<BaseNodeData>[]; edges: Edge[] } {
  const collapsedGroupIds = new Set(
    nodes.filter((node) => node.data.groupCollapsed === true).map((node) => node.id),
  );
  const visibleNodes = nodes.filter((node) => (
    node.data.hiddenByCharacterLibrary !== true
    && !(node.parentId && collapsedGroupIds.has(node.parentId))
  ));
  if (visibleNodes.length === nodes.length) return { nodes, edges };
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  return {
    nodes: visibleNodes,
    edges: edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
    ),
  };
}

/**
 * 选区来源 —— 官方 `selectionSource` 的等价物
 * （TapNowExtract · `index-BiTZf8mJ.js` @7600860 的选区 store：`selectionSource:"direct"` 初值，
 *  `setSelectedNodes:(n,a="direct")` 时写入由调用方给的来源，框选传 `"marquee"`）。
 * 官方门：**只有 `"direct"`（点选）才允许节点工具栏出现**（`eBl` @7601574）。
 */
export type SelectionSource = 'direct' | 'marquee';

export interface NodeSlice {
  nodes: Node<BaseNodeData>[];
  edges: Edge[];
  selectedNodeIds: string[];
  selectionSource: SelectionSource;
  setNodes: (nodes: Node<BaseNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNodeIds: (ids: string[], source?: SelectionSource) => void;
  addNode: (node: Node<BaseNodeData>) => void;
  addNodeTransient: (node: Node<BaseNodeData>) => void;
  addNodes: (nodes: Node<BaseNodeData>[]) => void;
  addNodesTransient: (nodes: Node<BaseNodeData>[]) => void;
  addNodeWithEdge: (node: Node<BaseNodeData>, edge: Edge) => void;
  /** 原子添加一组节点和连线，只创建一次历史快照。 */
  addNodesWithEdges: (nodes: Node<BaseNodeData>[], edges: Edge[]) => void;
  createMediaPlaceholder: (
    intent: MediaGenerationIntent,
    position?: { x: number; y: number },
  ) => string;
  settleMediaPlaceholder: (nodeId: string, artifact: MediaGenerationResult) => boolean;
  failMediaPlaceholder: (nodeId: string, error: string) => void;
  materializeMediaArtifact: (
    artifact: MediaGenerationResult,
    position?: { x: number; y: number },
  ) => string;
  /** 在原位复制一个节点，并让拖出的副本继承入口边——用于 Ctrl 拖拽复制。 */
  duplicateNode: (nodeId: string) => Promise<string | undefined>;
  duplicateCanvasNote: (nodeId: string) => string | null | Promise<string | null>;
  convertImageNodeKind: (nodeId: string) => 'to-note' | 'to-node' | 'connected' | null;
  updateCanvasNote: (nodeId: string, patch: CanvasNotePatch) => boolean;
  updateCanvasNoteTransient: (nodeId: string, patch: CanvasNotePatch) => boolean;
  moveCanvasNoteLayer: (nodeId: string, direction: CanvasNoteLayerDirection) => boolean;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
  /** 高频手势内更新节点数据，不创建历史快照；调用方负责提交手势开始和结束状态。 */
  updateNodeDataTransient: (nodeId: string, data: Partial<BaseNodeData>) => void;
  /** 高频手势内更新节点位置（左/上边缩放要反向移动节点），同样不写历史。 */
  updateNodePositionTransient: (nodeId: string, position: { x: number; y: number }) => void;
  /** 原子批量更新节点数据（一次历史提交）。 */
  updateNodesDataBatch: (nodeIds: string[], data: Partial<BaseNodeData>) => void;
  linkNodeToCharacter: (
    nodeId: string,
    link: CharacterLibraryNodeLink,
    hideNode: boolean,
  ) => boolean;
  /** 在画布上隐藏/显示被角色库收纳的节点，可来回切换。 */
  setCharacterLibraryNodeHidden: (nodeId: string, hidden: boolean) => boolean;
  releaseCharacterLibraryNodes: (
    scope: CharacterLibraryNodeLink['scope'],
    characterId?: string,
    actionId?: string,
    mediaId?: string,
  ) => string[];
  deleteNode: (nodeId: string) => void;
  /** 原子批量删除多个节点（一次 commitToHistory，一次退场动画） */
  deleteNodesBatch: (nodeIds: string[]) => void;
  onConnect: (connection: Connection) => void;
  /** 批量补边（一次历史、一次渲染）。用于焦点编辑退出时的自动连线等场景。 */
  onConnectBatch: (connections: Connection[]) => void;
  onNodesChange: (changes: NodeChange<Node<BaseNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  clearGroupedSelection: () => void;
  settleNodeGroupingOnDragStop: (node: Node<BaseNodeData>) => void;
  /** 把一个图像节点拖入宫格分镜的某格：该格显示此图，源节点被消耗移除 */
  fillStoryboardCell: (storyboardId: string, cellIdx: number, sourceNodeId: string) => void;
  /** 把一个图像/视频节点拖入分镜表的画面格：建立引用，源节点留在画布上 */
  bindShotlistFrame: (shotlistId: string, rowId: string, sourceNodeId: string) => void;
}

export const createNodeSlice: StateCreator<AppState, [], [], NodeSlice> = (set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  selectionSource: 'direct',

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNodeIds: (ids, source = 'direct') => set({ selectedNodeIds: ids, selectionSource: source }),

  addNode: (node) => {
    get().commitToHistory();
    get().addNodeTransient(node);
  },

  addNodeTransient: (node) => {
    set((state) => {
      const displayId = getNextDisplayId(state.nodes);
      const settings = state.projects.find((project) => project.id === state.currentProjectId)?.settings;
      const data = applyProjectDefaultsToNodeData(node.data, settings);
      return insertNodeInGroup(state, prepareNodeForInsertion(node, data, displayId));
    });
  },

  addNodeWithEdge: (node, edge) => {
    get().commitToHistory();
    set((state) => {
      const displayId = getNextDisplayId(state.nodes);
      const settings = state.projects.find((project) => project.id === state.currentProjectId)?.settings;
      const data = applyProjectDefaultsToNodeData(node.data, settings);
      return {
        ...insertNodeInGroup(state, prepareNodeForInsertion(node, data, displayId)),
        edges: [...state.edges, edge],
      };
    });
  },

  addNodesWithEdges: (nodes, edges) => {
    if (nodes.length === 0) return;
    get().commitToHistory();
    set((state) => {
      const nextNodes = [...state.nodes];
      const settings = state.projects.find((project) => project.id === state.currentProjectId)?.settings;
      for (const node of nodes) {
        const displayId = getNextDisplayId(nextNodes);
        const data = applyProjectDefaultsToNodeData(node.data, settings);
        nextNodes.push(prepareNodeForInsertion(node, data, displayId));
      }
      return {
        nodes: nextNodes,
        edges: [...state.edges, ...edges],
      };
    });
  },

  addNodes: (nodes) => {
    if (nodes.length === 0) return;
    get().commitToHistory();
    get().addNodesTransient(nodes);
  },

  addNodesTransient: (nodes) => {
    if (nodes.length === 0) return;
    set((state) => {
      const nextNodes = [...state.nodes];
      const settings = state.projects.find((project) => project.id === state.currentProjectId)?.settings;
      for (const node of nodes) {
        const displayId = getNextDisplayId(nextNodes);
        const data = applyProjectDefaultsToNodeData(node.data, settings);
        nextNodes.push(prepareNodeForInsertion(node, data, displayId));
      }
      return { nodes: nextNodes };
    });
  },

  createMediaPlaceholder: (intent, requestedPosition) => {
    const state = get();
    const id = `node-${generateId()}`;
    const type = intent.kind === 'image'
      ? 'ai-image'
      : intent.kind === 'video'
        ? 'ai-video'
        : 'ai-audio';
    const position = requestedPosition ?? getCanvasPointerPosition();
    /* ★ 标题优先用**模型给的短名**（`intent.title`）—— 官方 agent 产出的节点标题就是这样来的
       （用户 2026 对照官方：prompt「一只可爱的小猫，蓬松柔软的毛发…」→ 节点名「可爱的小猫」，
       是**概括**不是截断 ⇒ 客户端推不出来，只能由模型给；`canvas_create_nodes` 一直是这个口径）。
       没给才回落到 MTV 原来的固定文案。 */
    const fallbackLabel = intent.kind === 'image'
      ? '对话生成图片'
      : intent.kind === 'video'
        ? '对话生成视频'
        : intent.audioPurpose === 'music'
          ? '对话生成音乐'
          : '对话生成语音';
    /* 模型没给短名时（官方要求 2–8 字主体名，例如「两只非洲象」）别再回落成泛化固定词
   「对话生成图片」——用户实测那就是「跟内容无关」。这里退一步：取 prompt 的首个短句
   去掉标点、截到 8 字，作为**可读的**兜底（不是概括，但至少和画面相关）。 */
    const labelFromPrompt = (() => {
      const raw = (intent.prompt ?? '').replace(/[，。,.!?！？；;：:\n\r]/g, ' ').trim();
      const first = raw.split(/\s+/).filter(Boolean)[0] ?? '';
      return first.slice(0, 8);
    })();
    const label = intent.title?.trim() || labelFromPrompt || fallbackLabel;
    const settings = state.projects.find(
      (project) => project.id === state.currentProjectId,
    )?.settings;
    const nodeData = applyProjectDefaultsToNodeData({
      label,
      type,
      role: 'generator',
      prompt: intent.prompt,
      model: intent.modelRef,
      status: 'loading',
      /* ★★ 必须把本轮**生成参数**带进节点 —— 事故（用户真机）：
         「我给 agent 是 3:4，画布上出现的是 1:1 的尺寸」。
         `ImageNode` 的卡片尺寸 = `nodeSizeForAspectRatio(intrinsicRatio ?? aspectRatioValue(data.aspectRatio))`
         （`ImageNode.tsx:195`），而生成节点的 `intrinsicRatio` 恒为 `null`（只对 `role:'source'` 生效）
         ⇒ `data.aspectRatio` 缺省时**一律按 1:1** 出卡片，与 agent 实际提交的比例无关。
         这里把 `intent` 上已经解析好的参数原样落到节点，卡片才会跟着本轮比例。
         ⚠️ 只在有值时写，不给未指定比例的节点编一个默认值（与工具描述里那条口径一致）。 */
      ...(intent.aspectRatio ? { aspectRatio: intent.aspectRatio } : {}),
      ...(intent.resolution ? { resolution: intent.resolution } : {}),
      ...(intent.duration !== undefined ? { duration: intent.duration } : {}),
      /* ★ 2026-10-15：确认卡第三颗胶囊（清晰度档位 `1K/2K/4K`）也落到节点上 ——
         与上面比例/分辨率同一条口径（「这轮真的提交了什么，节点就是什么」）。
         官方依据：`vendor-packages-DRvCmDjR.js` @1095139 的 `rq.options.imageSizeOptions`。 */
      ...(intent.imageSize ? { imageSize: intent.imageSize } : {}),
      /* ★ 2026-10-15：确认卡第四颗胶囊（张数 `1×/2×/4×`，官方 `p8e=[1,2,4]` @1327920）。
         `generationRuntime` 的图片分支一次只产一个产物 ⇒ 本轮不批量；这里把用户选的张数落到
         **节点数据 `batchCount`**（`services/generationService.ts:95` 读它走 `generateImagesBatch`）
         ⇒「节点上再次生成」时按用户选的张数跑。这是 MTV 侧该值**唯一**的真实落点（见
         `MediaGenerationIntent.times` 的说明）。 */
      ...(intent.times !== undefined && intent.times > 1 ? { batchCount: intent.times } : {}),
      nodeWidth: 333,
      nodeHeight: intent.kind === 'image' ? 158 : 160,
    }, settings);
    state.commitToHistory();
    set((current) => ({
      nodes: [...current.nodes, {
        id,
        type,
        position,
        data: {
          ...nodeData,
          /* ⚠️ 这里**不能**再覆盖 `role` —— 上面那句已经把它写死成 `'generator'`。
             事故（用户截图：「对话生成图片」的空卡显示成**上传**态）：
               官方把图像卡分成**两个变体** —— 从文件进来的是 `UploadImageNode`（空态 = 上传按钮），
               对话/Agent 生成的是 `GenerateImageNode`（空态 = 官方 48×48 占位图，
               `ImageNode.tsx` 的 `isSource ? <上传> : <占位图>` 就是这条分派）。
               MTV 原来在这里把 `'generator'` 改写成 `'source'` ⇒ 生成卡被当成上传卡：
                 · 空卡态错（`ImageNode` 的 `isSource` 分支）
                 · 视频卡变体错（`officialVideoNodeVariant` 的 `role==='source'` → UPLOAD 变体
                   ⇒ 官方 UPLOAD 变体**不渲染底部生成输入条**，`officialInputBar.isInputBarSuppressedNode`）
                 · 提及芯片颜色错（`mentionEditorDom.chipMentionKind`：`source` → 灰底 attachment，
                   而官方「生成出来的图片节点」是蓝胶囊）
               ⇒ 生成占位卡必须是 `'generator'`。`role: 'source'` 只属于**上传/导入/粘贴**那几条路
                 （`useNodeCreation` / `store.clipboard` / `assetRowActions` …）。 */
          displayId: getNextDisplayId(current.nodes),
        },
      } as Node<BaseNodeData>],
    }));
    /* ★★ 生成期间把镜头带到这张**正在生成**的卡上。
       事故（用户真机）：「agent 在画布上生图时，卡片的动画呢？」——
       动画本身是有的（`ImageNode` 的 `data.status === 'loading'` → `NodeLoadingAnimation`；
       现场验证：`node-loading-shadow-layer-empty` / `node-loading-motion-enter` /
       grid-stars / grid-sweep / sweep-glow / burst / dither 七层都在），
       但这张占位卡落在 `getCanvasPointerPosition()`（鼠标停在对话面板上时，那个位置可能离视口很远）
       ⇒ 动画在**视口外**跑，用户看不到。
       官方在画布上提交生成后能看见那张卡在生成 ⇒ 这里用既有的 `canvas-focus-nodes` 通道
       把节点带进视口（参数交给 `Canvas.focusNodes` 的默认值，与「在画布上查看」同一通道）。 */
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('canvas-focus-nodes', { detail: { nodeIds: [id] } }));
    }
    return id;
  },

  settleMediaPlaceholder: (nodeId, artifact) => {
    if (!get().nodes.some((node) => node.id === nodeId)) return false;
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const mediaField = artifact.kind === 'image'
          ? { imageUrl: artifact.url, imageWidth: artifact.width, imageHeight: artifact.height }
          : artifact.kind === 'video'
            ? { videoUrl: artifact.url }
            : { audioUrl: artifact.url };
        return {
          ...node,
          data: {
            ...node.data,
            ...mediaField,
            artifactId: artifact.id,
            prompt: artifact.prompt,
            model: artifact.modelId,
            provider: artifact.provider,
            output: artifact.sourceUrl,
            sourceUrl: artifact.sourceUrl,
            filePath: artifact.filePath,
            thumbnailUrl: artifact.kind === 'image' ? artifact.url : undefined,
            status: 'success',
            error: undefined,
          },
        } as Node<BaseNodeData>;
      }),
    }));
    return true;
  },

  failMediaPlaceholder: (nodeId, error) => {
    set((state) => ({
      nodes: state.nodes.map((node) => node.id === nodeId
        ? { ...node, data: { ...node.data, status: 'error', error } as BaseNodeData }
        : node),
    }));
  },

  materializeMediaArtifact: (artifact, requestedPosition) => {
    const state = get();
    const existing = state.nodes.find((node) => node.data.artifactId === artifact.id);
    if (existing) return existing.id;

    const id = `node-${generateId()}`;
    const type = artifact.kind === 'image'
      ? 'ai-image'
      : artifact.kind === 'video'
        ? 'ai-video'
        : 'ai-audio';
    const position = requestedPosition ?? getCanvasPointerPosition();
    const mediaField = artifact.kind === 'image'
      ? { imageUrl: artifact.url, imageWidth: artifact.width, imageHeight: artifact.height }
      : artifact.kind === 'video'
        ? { videoUrl: artifact.url }
        : { audioUrl: artifact.url };
    /* ⚠️ 2026 用户实测（又一次）：「名字又不对了」——落地**成品卡**走的是这条路径，
       而它把 label 写死成「对话生成图片」，与占位卡那条（已改成 title/prompt 兜底）不一致。
       这里同口径：有 title 用 title，否则取 prompt 首个短句，最后才是固定文案。 */
    const artifactFallback = artifact.kind === 'image'
      ? '对话生成图片'
      : artifact.kind === 'video'
        ? '对话生成视频'
        : artifact.audioPurpose === 'music'
          ? '对话生成音乐'
          : '对话生成语音';
    const artifactLabelFromPrompt = (() => {
      /* 用户实测吐槽：「恰好两只非洲象 是什么鬼东西」——直接取 prompt 前 8 字会把
         「恰好 / 请 / 帮我 / 一张」这类**语气词**带进来。官方是模型给的短名，
         MTV 只能兜底 ⇒ 先剥掉常见起手词，再取逗号前的短语。 */
      const raw = (artifact.prompt ?? '').replace(/[，。,.!?！？；;：:\n\r]/g, ' ').trim();
      const stripped = raw
        .replace(/^(请|请帮|帮我|帮忙|给我|帮忙把|把|生成|画|绘制|做|来|要|恰好|刚好|正好|一张|一幅)+/g, '')
        .replace(/(的图片|的画面|图片|画面)$/g, '')
        .trim();
      const first = (stripped || raw).split(/\s+/).filter(Boolean)[0] ?? '';
      return first.slice(0, 10);
    })();
    const label = (artifact as { title?: string }).title?.trim()
      || artifactLabelFromPrompt
      || artifactFallback;
    /* ★ 同一事故的另一半：「9:16 的图画到卡上却是 1:1」。
       卡片尺寸由 ImageNode 的 nodeSizeForAspectRatio(intrinsicRatio ?? aspectRatioValue(data.aspectRatio))
       决定，而生成了的卡 intrinsicRatio 恒为 null ⇒ 不写 aspectRatio 就一律按 1:1。
       所以这里按**产物真实像素**反推比例（官方同源：比例=这轮真正提交的参数，
       vendor-packages-DRvCmDjR.js @1095139 的 aspectRatios）。 */
    const artifactAspectRatio = (() => {
      const w = Number(artifact.width) || 0;
      const h = Number(artifact.height) || 0;
      if (!w || !h) return '';
      const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
      const g = gcd(w, h);
      return `${Math.round(w / g)}:${Math.round(h / g)}`;
    })();
    const settings = state.projects.find(
      (project) => project.id === state.currentProjectId,
    )?.settings;
    const nodeData = applyProjectDefaultsToNodeData({
      label,
      type,
      role: 'generator',
      prompt: artifact.prompt,
      model: artifact.modelId,
      provider: artifact.provider,
      status: 'success',
      ...(artifactAspectRatio ? { aspectRatio: artifactAspectRatio } : {}),
      nodeWidth: 333,
      nodeHeight: artifact.kind === 'image' ? 158 : 160,
    }, settings);
    state.commitToHistory();
    set((current) => ({
      nodes: [...current.nodes, {
        id,
        type,
        position,
        data: {
          ...nodeData,
          /* 同上：`nodeData` 已是 `role: 'generator'`（对话/Agent 生成出来的卡 = 官方
             `GenerateImageNode` / `GenerateVideoNode` 变体），**不要**改写成 `'source'`。 */
          artifactId: artifact.id,
          output: artifact.sourceUrl,
          sourceUrl: artifact.sourceUrl,
          filePath: artifact.filePath,
          thumbnailUrl: artifact.kind === 'image' ? artifact.url : undefined,
          ...mediaField,
          displayId: getNextDisplayId(current.nodes),
        },
      } as Node<BaseNodeData>],
    }));
    return id;
  },

  updateNodeData: (nodeId, data) => {
    get().commitToHistory();
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: mergeNodeData(n.data, data) } : n
      ),
    }));
  },

  updateNodeDataTransient: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: mergeNodeData(node.data, data) } : node
      ),
    }));
  },

  updateNodePositionTransient: (nodeId, position) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, position } : node
      ),
    }));
  },

  updateNodesDataBatch: (nodeIds, data) => {
    if (nodeIds.length === 0) return;
    const targetIds = new Set(nodeIds);
    get().commitToHistory();
    set((state) => ({
      nodes: state.nodes.map((node) => targetIds.has(node.id)
        ? { ...node, data: mergeNodeData(node.data, data) }
        : node),
    }));
  },

  linkNodeToCharacter: (nodeId, link, hideNode) => {
    const node = get().nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return false;
    const previousLinks = node.data.characterLibraryLinks ?? [];
    const retainedLinks = previousLinks.filter(
      (item) => item.scope !== link.scope || item.characterId !== link.characterId
        || (link.actionId !== undefined
          ? item.actionId !== link.actionId || item.mediaId !== link.mediaId
          : item.actionId !== undefined),
    );
    const nextLinks = [...retainedLinks, link];
    const nextHidden = node.data.hiddenByCharacterLibrary === true || hideNode;
    const sameLink = previousLinks.length === nextLinks.length
      && previousLinks.every((item, index) => (
        item.scope === nextLinks[index].scope
        && item.characterId === nextLinks[index].characterId
        && item.referenceImageId === nextLinks[index].referenceImageId
        && item.actionId === nextLinks[index].actionId
        && item.mediaId === nextLinks[index].mediaId
      ));
    if (sameLink && nextHidden === (node.data.hiddenByCharacterLibrary === true)) return false;

    get().commitToHistory();
    set((state) => ({
      nodes: state.nodes.map((candidate) => candidate.id === nodeId
        ? {
            ...candidate,
            selected: hideNode ? false : candidate.selected,
            data: {
              ...candidate.data,
              characterLibraryLinks: nextLinks,
              hiddenByCharacterLibrary: nextHidden || undefined,
            },
          }
        : candidate),
      selectedNodeIds: hideNode
        ? state.selectedNodeIds.filter((id) => id !== nodeId)
        : state.selectedNodeIds,
    }));
    return true;
  },

  setCharacterLibraryNodeHidden: (nodeId, hidden) => {
    const node = get().nodes.find((candidate) => candidate.id === nodeId);
    if (!node || (node.data.hiddenByCharacterLibrary === true) === hidden) return false;
    get().commitToHistory();
    set((state) => ({
      nodes: state.nodes.map((candidate) => candidate.id === nodeId
        ? {
            ...candidate,
            selected: hidden ? false : candidate.selected,
            data: { ...candidate.data, hiddenByCharacterLibrary: hidden },
          }
        : candidate),
      // 隐藏的节点不能留在选中集里，否则后续操作会作用到看不见的节点上
      selectedNodeIds: hidden
        ? state.selectedNodeIds.filter((id) => id !== nodeId)
        : state.selectedNodeIds,
    }));
    return true;
  },

  releaseCharacterLibraryNodes: (scope, characterId, actionId, mediaId) => {
    const matches = (link: CharacterLibraryNodeLink) => (
      link.scope === scope && (characterId === undefined || link.characterId === characterId)
      && (actionId === undefined || link.actionId === actionId)
      && (mediaId === undefined || link.mediaId === mediaId)
    );
    const affectedNodes = get().nodes.filter((node) => (
      node.data.characterLibraryLinks ?? []
    ).some(matches));
    if (affectedNodes.length === 0) return [];

    get().commitToHistory();
    const restoredNodeIds: string[] = [];
    set((state) => ({
      nodes: state.nodes.map((node) => {
        const links = node.data.characterLibraryLinks ?? [];
        const nextLinks = links.filter((link) => !matches(link));
        if (nextLinks.length === links.length) return node;
        const data = { ...node.data };
        if (nextLinks.length > 0) data.characterLibraryLinks = nextLinks;
        else delete data.characterLibraryLinks;
        if (data.hiddenByCharacterLibrary && nextLinks.length === 0) {
          data.hiddenByCharacterLibrary = false;
          restoredNodeIds.push(node.id);
        }
        return { ...node, data };
      }),
    }));
    return restoredNodeIds;
  },

  duplicateNode: async (nodeId) => {
    const state = get();
    const src = state.nodes.find((n) => n.id === nodeId);
    // 分组节点暂不支持拖拽复制（涉及子节点/边重映射）
    if (!src || src.type === 'group') return;
    let duplicateData = src.data;
    if (needsNodeMediaCopy(src.data)) {
      const guard = registerCanvasDerivation(state, nodeId);
      if (!guard) { state.showToast('请先创建项目再复制媒体', 'error'); return; }
      state.showToast('正在复制素材…');
      try {
        duplicateData = await copyNodeMedia(src.data, guard.projectId);
        if (!isCanvasDerivationFresh(guard, get())
          || get().nodes.find((node) => node.id === nodeId)?.data !== src.data) {
          await discardCopiedNodeMedia(duplicateData, src.data);
          get().showToast('画布已变化，请重新复制');
          return;
        }
      } catch {
        if (get().currentProjectId === guard.projectId) get().showToast('素材复制失败，请重试', 'error');
        return;
      } finally { completeCanvasDerivation(guard); }
    }
    get().commitToHistory();

    // 身份对调：克隆留在原位并承接原节点的边与编号；被拖动的节点
    // 改成新编号，同时额外继承一份入口边。
    const cloneId = `node-${generateId()}`;
    const newDisplayId = getNextDisplayId(get().nodes);

    set((s) => {
      const clone = {
        ...src,
        id: cloneId,
        position: { ...src.position },
        data: prepareDuplicateNodeData(duplicateData, src.type, cloneId),
        selected: false,
        dragging: false,
      } as Node<BaseNodeData>;
      const nodes = s.nodes.map((n) =>
        n.id === nodeId
          ? ({ ...n, data: { ...n.data, displayId: newDisplayId } } as Node<BaseNodeData>)
          : n,
      );
      nodes.push(clone);
      // 原边改连到原位克隆，拖出的节点仅继承入口边，避免复制输出影响下游。
      const remappedEdges = s.edges.map((e) =>
        e.source === nodeId || e.target === nodeId
          ? { ...e, source: e.source === nodeId ? cloneId : e.source, target: e.target === nodeId ? cloneId : e.target }
          : e,
      );
      const inheritedIncomingEdges = s.edges
        .filter((edge) => edge.target === nodeId)
        .map((edge) => ({ ...edge, id: `edge-${generateId()}` }));
      return { nodes, edges: [...remappedEdges, ...inheritedIncomingEdges] };
    });
    return cloneId;
  },

  duplicateCanvasNote: (nodeId) => {
    const state = get();
    const source = state.nodes.find((node) => node.id === nodeId && node.type === 'canvas-note');
    if (!source?.data.note) return null;
    if (needsNodeMediaCopy(source.data)) {
      const guard = registerCanvasDerivation(state, nodeId);
      if (!guard) return null;
      return (async () => {
        try {
          const data = await copyNodeMedia(source.data, guard.projectId);
          if (!isCanvasDerivationFresh(guard, get())
            || get().nodes.find((node) => node.id === nodeId)?.data !== source.data) {
            await discardCopiedNodeMedia(data, source.data);
            return null;
          }
          const cloneId = `node-${generateId()}`;
          get().commitToHistory();
          get().addNodeTransient({ ...source, id: cloneId,
            position: { x: source.position.x + 24, y: source.position.y + 24 },
            data, selected: false, dragging: false });
          return cloneId;
        } catch {
          if (get().currentProjectId === guard.projectId) get().showToast('素材复制失败，请重试', 'error');
          return null;
        } finally { completeCanvasDerivation(guard); }
      })();
    }
    state.commitToHistory();
    const cloneId = `node-${generateId()}`;
    const clone = {
      ...source,
      id: cloneId,
      position: { x: source.position.x + 24, y: source.position.y + 24 },
      selected: true,
      dragging: false,
      data: {
        ...structuredClone(source.data),
        displayId: getNextDisplayId(state.nodes),
      },
    } as Node<BaseNodeData>;
    set((current) => ({
      nodes: [
        ...current.nodes.map((node) => node.selected ? { ...node, selected: false } : node),
        clone,
      ],
      selectedNodeIds: [cloneId],
    }));
    return cloneId;
  },

  convertImageNodeKind: (nodeId) => {
    const state = get();
    const source = state.nodes.find((node) => node.id === nodeId);
    if (!source) return null;

    const isImageNode = source.type === 'ai-image' || source.type === 'source-image';
    const isImageNote = source.type === 'canvas-note' && source.data.note?.kind === 'image';
    const imageUrl = source.data.imageUrl || source.data.thumbnailUrl;
    if ((!isImageNode && !isImageNote) || !imageUrl) return null;

    if (isImageNode && state.edges.some((edge) => edge.source === nodeId || edge.target === nodeId)) {
      return 'connected';
    }

    state.commitToHistory();
    set((current) => ({
      nodes: current.nodes.map((node) => {
        if (node.id !== nodeId) return node;

        if (isImageNode) {
          const width = node.data.nodeWidth ?? node.data.imageWidth ?? 320;
          const height = node.data.nodeHeight ?? node.data.imageHeight ?? 220;
          const note = createCanvasNoteData('image', { width, height });
          return {
            ...node,
            type: 'canvas-note',
            data: {
              ...node.data,
              type: 'canvas-note',
              imageUrl,
              note,
              nodeWidth: width,
              nodeHeight: height,
            },
          } as Node<BaseNodeData>;
        }

        const { note, ...data } = node.data;
        return {
          ...node,
          type: 'ai-image',
          data: {
            ...data,
            type: 'ai-image',
            role: data.role === 'generator' ? 'generator' : 'source',
            status: data.status ?? 'success',
            imageUrl,
            nodeWidth: note?.width ?? data.nodeWidth,
            nodeHeight: note?.height ?? data.nodeHeight,
          },
        } as Node<BaseNodeData>;
      }),
    }));
    return isImageNode ? 'to-note' : 'to-node';
  },

  updateCanvasNote: (nodeId, patch) => {
    const node = get().nodes.find((candidate) => candidate.id === nodeId && candidate.type === 'canvas-note');
    if (!node?.data.note) return false;
    get().commitToHistory();
    return get().updateCanvasNoteTransient(nodeId, patch);
  },

  updateCanvasNoteTransient: (nodeId, patch) => {
    let changed = false;
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== nodeId || node.type !== 'canvas-note' || !node.data.note) return node;
        changed = true;
        const note = mergeCanvasNotePatch(node.data.note, patch);
        return {
          ...node,
          data: {
            ...node.data,
            note,
            nodeWidth: note.width,
            nodeHeight: note.height,
          },
        } as Node<BaseNodeData>;
      }),
    }));
    return changed;
  },

  moveCanvasNoteLayer: (nodeId, direction) => {
    const state = get();
    const index = state.nodes.findIndex((node) => node.id === nodeId && node.type === 'canvas-note');
    if (index < 0) return false;
    let target = index;
    if (direction === 'back') target = 0;
    if (direction === 'backward') target = Math.max(0, index - 1);
    if (direction === 'forward') target = Math.min(state.nodes.length - 1, index + 1);
    if (direction === 'front') target = state.nodes.length - 1;
    if (target === index) return false;
    state.commitToHistory();
    set((current) => {
      const nodes = [...current.nodes];
      const [note] = nodes.splice(index, 1);
      nodes.splice(target, 0, note);
      return { nodes };
    });
    return true;
  },

  deleteNode: (nodeId) => {
    get().commitToHistory();

    // Collect all node IDs to delete: self + descendants (for group nodes)
    const idsToDelete = new Set<string>([nodeId]);
    const { nodes } = get();
    const q = [nodeId];
    while (q.length > 0) {
      const pid = q.shift()!;
      nodes.filter((n) => n.parentId === pid).forEach((c) => {
        idsToDelete.add(c.id);
        q.push(c.id);
      });
    }
    // Cancel any active polling for all deleted nodes
    for (const id of idsToDelete) {
      cancelNodePolling(id);
    }

    // Delete local files for all affected nodes —— 跳过仍被存活节点引用的共享文件（复制节点场景）
    const keepPaths = collectKeepPaths(nodes, idsToDelete, get().messages);
    void fileService.deleteNodeFiles(
      nodes.filter((node) => idsToDelete.has(node.id) && !node.data.artifactId).map((node) => node.data),
      keepPaths, get().currentProjectId,
      fileService.deletedGroupFolderNames(get().groups, idsToDelete),
    ).catch((e) => console.warn('[删除节点] 文件清理失败:', e));

    // 先播放退场动画，结束后再真正从状态中移除（动画期间历史已提交，撤销仍指向删除前状态）
    playNodeExit([...idsToDelete]).then(() => {
      set((state) => pruneDeletedNodesAndEmptyGroups(
        state.nodes,
        state.edges,
        state.groups,
        idsToDelete,
      ));
    });
  },

  deleteNodesBatch: (nodeIds) => {
    if (nodeIds.length === 0) return;
    // 最多删 BATCH_NODE_LIMIT 个
    const limitedIds = nodeIds.length > BATCH_NODE_LIMIT ? nodeIds.slice(0, BATCH_NODE_LIMIT) : nodeIds;

    get().commitToHistory();

    // 收集所有要删除的 ID（包含子节点递归）
    const idsToDelete = new Set<string>(limitedIds);
    const { nodes } = get();
    const q = [...limitedIds];
    while (q.length > 0) {
      const pid = q.shift()!;
      nodes.filter((n) => n.parentId === pid).forEach((c) => {
        idsToDelete.add(c.id);
        q.push(c.id);
      });
    }
    // 取消所有轮询
    for (const id of idsToDelete) {
      cancelNodePolling(id);
    }

    // 清理文件
    const keepPaths = collectKeepPaths(nodes, idsToDelete, get().messages);
    void fileService.deleteNodeFiles(
      nodes.filter((node) => idsToDelete.has(node.id) && !node.data.artifactId).map((node) => node.data),
      keepPaths, get().currentProjectId,
      fileService.deletedGroupFolderNames(get().groups, idsToDelete),
    ).catch((e) => console.warn('[批量删除] 文件清理失败:', e));

    // 统一播放退场动画后移除
    playNodeExit([...idsToDelete]).then(() => {
      set((state) => pruneDeletedNodesAndEmptyGroups(
        state.nodes,
        state.edges,
        state.groups,
        idsToDelete,
      ));
    });
  },

  bindShotlistFrame: (shotlistId, rowId, sourceNodeId) => {
    const { nodes } = get();
    const shotlist = nodes.find((n) => n.id === shotlistId && n.type === 'ai-shotlist');
    const src = nodes.find((n) => n.id === sourceNodeId);
    if (!shotlist || !src) return;

    const isVideo = src.type === 'ai-video' || src.type === 'source-video';
    const isImage = src.type === 'ai-image' || src.type === 'source-image';
    if (!isVideo && !isImage) return;

    const url = (isVideo
      ? src.data.videoUrl
      : (src.data.imageUrl || src.data.thumbnailUrl)) as string | undefined;
    if (!url && !src.data.filePath) return;

    const rows = Array.isArray(shotlist.data.shotlistRows)
      ? (shotlist.data.shotlistRows as ShotRow[])
      : [];
    if (!rows.some((row) => row.id === rowId)) return;

    get().commitToHistory();
    // 快照仅供源节点日后被删除时兜底显示；渲染与推送都以画布上的实时节点为准
    const nextRows = rows.map((row) => (row.id === rowId
      ? {
        ...row,
        frame: {
          nodeId: sourceNodeId,
          kind: isVideo ? ('video' as const) : ('image' as const),
          url,
          filePath: src.data.filePath as string | undefined,
          assetId: src.data.assetId as string | undefined,
          sourceDuration: typeof src.data.videoDuration === 'number' ? src.data.videoDuration : undefined,
        },
      }
      : row));
    // 源节点保持在画布上：分镜表持有的是引用，不是所有权
    get().updateNodeDataTransient(shotlistId, { shotlistRows: nextRows } as Partial<BaseNodeData>);
    get().commitToHistory();
    get().showToast('已放入分镜表');
  },

  fillStoryboardCell: (storyboardId, cellIdx, sourceNodeId) => {
    const { nodes } = get();
    const sb = nodes.find((n) => n.id === storyboardId && n.type === 'ai-storyboard');
    const src = nodes.find((n) => n.id === sourceNodeId);
    if (!sb || !src || !STORYBOARD_CELL_SOURCE_TYPES.includes(src.type ?? '')) return;
    const url = (src.data.imageUrl || src.data.thumbnailUrl) as string | undefined;
    if (!url) return;

    const cols = (sb.data.storyboardCols as number) || 3;
    const rows = (sb.data.storyboardRows as number) || 3;
    const total = cols * rows;
    const overrides: (StoryboardCellOverride | null)[] = Array.isArray(sb.data.storyboardOverrides)
      ? [...(sb.data.storyboardOverrides as (StoryboardCellOverride | null)[])]
      : new Array(total).fill(null);
    const extracted = Array.isArray(sb.data.storyboardExtracted)
      ? [...(sb.data.storyboardExtracted as boolean[])]
      : new Array(total).fill(false);
    while (overrides.length < total) overrides.push(null);
    while (extracted.length < total) extracted.push(false);

    // 只允许填入已提取形成的空格；同时防止陈旧拖拽目标覆盖已有 override。
    if (
      !Number.isInteger(cellIdx)
      || cellIdx < 0
      || cellIdx >= total
      || overrides[cellIdx]
      || !extracted[cellIdx]
    ) return;

    get().commitToHistory();

    overrides[cellIdx] = { url, filePath: (src.data.filePath as string) || undefined };
    extracted[cellIdx] = false;
    get().updateNodeDataTransient(storyboardId, {
      storyboardOverrides: overrides,
      storyboardExtracted: extracted,
    } as Partial<BaseNodeData>);

    // 直接移除源节点，不走 deleteNode —— 避免回收正被该格复用的图片文件
    cancelNodePolling(sourceNodeId);
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== sourceNodeId),
      edges: state.edges.filter((e) => e.source !== sourceNodeId && e.target !== sourceNodeId),
    }));
    get().commitToHistory();
    get().showToast('已放入宫格');
  },

  /* ★ 批量补边 —— 供「焦点编辑退出时自动连线」（官方 `Jg` 的 `addEdges(normalize(add))`）
     这类**一次多边**的场景用。逐条调 `onConnect` 会写多条历史、产生中间帧；
     这里一次性归一化 + 一次 set + 一次 commit，语义与官方 `addEdges` 一致。 */
  onConnectBatch: (connections) => {
    const normalized = connections
      .map((connection) => normalizeCanvasConnection(connection))
      .filter((connection): connection is Connection => !!connection);
    if (normalized.length === 0) return;
    const existing = get().edges;
    const fresh = normalized.filter((connection) => !existing.some((edge) => (
      edge.source === connection.source && edge.target === connection.target
    )));
    if (fresh.length === 0) return;
    get().commitToHistory();
    set((state) => ({
      edges: [
        ...state.edges,
        ...fresh.map((connection) => ({ id: `edge-${generateId()}`, ...connection }) as Edge),
      ],
    }));
  },

  onConnect: (connection) => {
    // Loose 模式允许从任一端开始拖拽；持久化前统一为「右侧输出 → 左侧输入」。
    const normalized = normalizeCanvasConnection(connection);
    if (!normalized) return;
    get().commitToHistory();
    const id = `edge-${generateId()}`;
    const edge: Edge = {
      id,
      ...normalized,
    };
    set((state) => ({ edges: [...state.edges, edge] }));
  },

  onNodesChange: (changes) => {
    const removedIds = changes
      .filter((c) => c.type === 'remove')
      .map((c) => c.id);

    // Cancel any active polling for removed nodes
    for (const id of removedIds) {
      cancelNodePolling(id);
    }

    if (removedIds.length === 0) {
      set((s) => ({
        nodes: applyNodeChanges(changes, s.nodes) as Node<BaseNodeData>[],
      }));
      return;
    }

    const state = get();
    const removedGroupNodes = state.nodes.filter(
      (n) => removedIds.includes(n.id) && n.type === 'group',
    );

    if (removedGroupNodes.length > 0) {
      state.commitToHistory();
      const groupNodeIdSet = new Set(removedGroupNodes.map((n) => n.id));
      const removedGroupDataIds = removedGroupNodes.map(
        (n) => (n.data as unknown as GroupNodeDataAccess).groupId,
      );

      const groupPositions = new Map(
        removedGroupNodes.map((gn) => [gn.id, gn.position]),
      );

      const repositioned = state.nodes
        .map((n) => {
          if (!n.parentId || !groupPositions.has(n.parentId)) return n;
          const gp = groupPositions.get(n.parentId)!;
          return {
            ...n,
            position: { x: n.position.x + gp.x, y: n.position.y + gp.y },
            parentId: undefined,
          };
        })
        .filter((n) => !groupNodeIdSet.has(n.id));

      const finalNodes = applyNodeChanges(
        changes.filter((c) => c.type !== 'remove' || !groupNodeIdSet.has(c.id)),
        repositioned,
      ) as Node<BaseNodeData>[];

      set((s) => ({
        nodes: finalNodes,
        edges: s.edges.filter(
          (e) => !removedIds.includes(e.source) && !removedIds.includes(e.target),
        ),
        groups: s.groups.filter((g) => !removedGroupDataIds.includes(g.id)),
      }));
      return;
    }

    state.commitToHistory();
    const removedIdSet = new Set(removedIds);
    set((s) => pruneDeletedNodesAndEmptyGroups(
      applyNodeChanges(changes, s.nodes) as Node<BaseNodeData>[],
      s.edges,
      s.groups,
      removedIdSet,
    ));
  },

  onEdgesChange: (changes) => {
    const hasRemoval = changes.some((c) => c.type === 'remove');
    if (hasRemoval) get().commitToHistory();
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges) as Edge[],
    }));
  },

  clearGroupedSelection: () => {
    set((s) => {
      if (!s.nodes.some((n) => n.selected && n.type !== 'group')) return {};
      let changed = false;
      const nodes = s.nodes.map((n) => {
        if (n.type === 'group' && n.selected) {
          changed = true;
          return { ...n, selected: false };
        }
        return n;
      });
      return changed ? { nodes } : {};
    });
  },

  settleNodeGroupingOnDragStop: (node) => {
    const state = get();
    const allNodes = state.nodes;

    if (node.type === 'group') return;

    if (!allNodes.some((candidate) => candidate.id === node.id)) return;
    const groupNodes = allNodes.filter((candidate) => candidate.type === 'group' && !candidate.hidden);
    const oldParent = groupNodes.find((candidate) => candidate.id === node.parentId);
    // 分镜等非普通分组的父子关系由对应业务入口管理。
    if (node.parentId && !oldParent) return;
    const center = nodeCenter(node, allNodes);
    const parent = oldParent && groupContainsPoint(oldParent, center, allNodes)
      ? oldParent
      : groupNodes.find((candidate) => groupContainsPoint(candidate, center, allNodes));
    if (parent?.id === node.parentId) return;

    const absPos = absoluteNodePosition(node, allNodes);
    const parentPos = parent ? absoluteNodePosition(parent, allNodes) : { x: 0, y: 0 };
    let newNodes = allNodes.map((candidate) => candidate.id === node.id ? {
      ...candidate,
      parentId: parent?.id,
      position: { x: absPos.x - parentPos.x, y: absPos.y - parentPos.y },
    } : candidate);
    let newGroups = state.groups.map((group) => {
      if (group.id === parent?.data.groupId) {
        return { ...group, nodeIds: [...new Set([...group.nodeIds, node.id])] };
      }
      if (group.id === oldParent?.data.groupId) {
        return { ...group, nodeIds: group.nodeIds.filter((id) => id !== node.id) };
      }
      return group;
    });

    const emptyGroupIds = new Set(
      groupNodes
        .filter((gn) => gn.id === oldParent?.id && !newNodes.some((n) => n.parentId === gn.id))
        .map((gn) => gn.id),
    );
    if (emptyGroupIds.size > 0) {
      newNodes = newNodes.filter((n) => !emptyGroupIds.has(n.id));
      const emptyDataIds = new Set(
        groupNodes
          .filter((gn) => emptyGroupIds.has(gn.id))
          .map((gn) => (gn.data as unknown as GroupNodeDataAccess).groupId)
          .filter(Boolean),
      );
      newGroups = newGroups.filter((g) => !emptyDataIds.has(g.id));
    }

    // React Flow 要求父节点排在子节点之前，旧空节点拖入后也必须满足。
    newNodes = [...newNodes.filter((n) => n.type === 'group'), ...newNodes.filter((n) => n.type !== 'group')];
    state.commitToHistory();
    set({ nodes: newNodes, groups: newGroups });
  },
});
