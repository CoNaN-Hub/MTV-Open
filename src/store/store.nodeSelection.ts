/**
 * store.nodeSelection —— 官方**通用「节点选择模式」**（`dr`，`course-api-base-url-CyloymxZ.js@1191063`）
 * 的 1:1 复刻。它就是「底部编辑区里那个『参考』按钮」点下去之后进入的模式。
 *
 * 官方逐字：
 * ```js
 * dr = create((set, get) => ({
 *   isActive: false, originNodeId: null, meta: null,
 *   enterMode: (nodeId, meta) => {
 *     const { isActive, exitMode } = dr.getState();
 *     if (isActive) exitMode();
 *     set({ isActive: true, originNodeId: nodeId, meta: meta ?? null });
 *     window.addEventListener('keydown', EA);
 *   },
 *   setSelectedNodeIds: ids => set(s => s.meta ? { meta: { ...s.meta, selectedNodeIds: [...ids] } } : s),
 *   updateMeta: meta => set(s => s.isActive && s.meta ? { meta: { ...s.meta, ...meta } } : s),
 *   exitMode: () => { const onExit = get().meta?.onExit;
 *                     window.removeEventListener('keydown', EA);
 *                     set({ isActive: false, originNodeId: null, meta: null }); onExit?.(); },
 *   completeMode: () => { const onComplete = get().meta?.onComplete;
 *                         window.removeEventListener('keydown', EA);
 *                         set({ isActive: false, originNodeId: null, meta: null }); onComplete?.(); },
 * }));
 * EA = e => { if (e.key === 'Escape') { e.preventDefault(); dr.getState().exitMode(); } }
 * ```
 *
 * 各入口传的 meta（官方原文）：
 *   · 图片卡「参考」按钮（`page-BeI7xydN.js@3224048`）
 *       `enterMode(id, { source:'reference', toolbarTitle:t('nodeSelectionMode.selectReference'),
 *                         autoExitOnConnect:true, allowedNodeTypes:[IMAGE, TEXT] })`
 *   · 音频参考（`course-api-base-url-*.js@3069295`）
 *       `{ source:'audioReference', toolbarTitle:…selectReference, autoExitOnConnect:false,
 *          allowedNodeTypes:[TEXT, VIDEO?, IMAGE?, AUDIO?] }`
 *   · 世界参考（同文件 @1763606）
 *       `{ source:'worldReference', toolbarTitle:…selectReference, autoExitOnConnect:true,
 *          allowedNodeTypes:[IMAGE, VIDEO], edgeData:{purpose:'generation-input'} }`
 *   · 提及编辑器（`page-BeI7xydN.js@1267653`）
 *       `{ source:Hp, toolbarTitle:…selectReference, autoExitOnConnect:true, connectionless:true,
 *          allowedNodeTypes:[IMAGE, VIDEO], isNodeSelectable:id=>J.some(w=>w.id===id), onSelect }`
 *
 * 每个节点上的三态由 `rke`（同文件 @1211063）判定 —— 见下面 `computeNodeSelectionPickState`。
 */
import { create } from 'zustand';
import { isCanvasConnectionValid } from './store.nodes';

export interface NodeSelectionMeta {
  /** 官方 `meta.source`：`'reference' | 'audioReference' | 'worldReference' | …`。 */
  source: string;
  /** 官方 `meta.toolbarTitle`：给了就只显示这一行标题（不再显示 activeTitle/activeHint）。 */
  toolbarTitle?: string;
  /** 官方 `meta.autoExitOnConnect`：选完（连上）就退出模式。 */
  autoExitOnConnect?: boolean;
  /** 官方 `meta.connectionless`：为 true 时**不检查连线合法性**（纯选择，不连边）。 */
  connectionless?: boolean;
  /** 官方 `meta.allowedNodeTypes`：不在表里的类型 ⇒ `showDisabled`（糊掉 + 黑罩，点不动）。 */
  allowedNodeTypes?: string[];
  /** 官方 `meta.isNodeSelectable`：自定义可选中谓词（优先级在 allowedNodeTypes 之后）。 */
  isNodeSelectable?: (nodeId: string) => boolean;
  /** 官方 `meta.onSelect(nodeId)`：**connectionless** 模式下选中回调（提及编辑器用它插 mention）。 */
  onSelect?: (nodeId: string) => void;
  /** 官方 `meta.onConnect(nodeId)`：非 connectionless 模式下**建边之后**的回调。 */
  onConnect?: (nodeId: string) => void;
  /** 官方 `meta.edgeData`：建边时带给 `isValidConnection` 的 data。 */
  edgeData?: Record<string, unknown>;
  /** 官方 `meta.appearance`：`'element-library'` 时改为「缩略图墙」那套遮罩/对号。 */
  appearance?: 'default' | 'element-library';
  /** 官方 `meta.selectedNodeIds`：已选集合（`isPicked` 的来源）。 */
  selectedNodeIds?: string[];
  /** 官方 `meta.cancelLabel` / `completeLabel`：工具栏「取消 / 完成」。 */
  cancelLabel?: string;
  completeLabel?: string;
  onExit?: () => void;
  onComplete?: () => void;
}

interface NodeSelectionState {
  isActive: boolean;
  originNodeId: string | null;
  meta: NodeSelectionMeta | null;
  enterMode: (originNodeId: string, meta?: NodeSelectionMeta | null) => void;
  updateMeta: (patch: Partial<NodeSelectionMeta>) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  exitMode: () => void;
  completeMode: () => void;
}

/** 官方 `EA`。 */
function escapeHandler(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  useNodeSelectionStore.getState().exitMode();
}

export const useNodeSelectionStore = create<NodeSelectionState>((set, get) => ({
  isActive: false,
  originNodeId: null,
  meta: null,
  enterMode: (originNodeId, meta) => {
    const { isActive, exitMode } = get();
    if (isActive) exitMode();
    set({ isActive: true, originNodeId, meta: meta ?? null });
    if (typeof window !== 'undefined') window.addEventListener('keydown', escapeHandler);
  },
  updateMeta: (patch) => set((state) => (
    state.isActive && state.meta ? { meta: { ...state.meta, ...patch } } : state
  )),
  setSelectedNodeIds: (ids) => set((state) => (
    state.meta ? { meta: { ...state.meta, selectedNodeIds: [...ids] } } : state
  )),
  exitMode: () => {
    const onExit = get().meta?.onExit;
    if (typeof window !== 'undefined') window.removeEventListener('keydown', escapeHandler);
    set({ isActive: false, originNodeId: null, meta: null });
    onExit?.();
  },
  completeMode: () => {
    const onComplete = get().meta?.onComplete;
    if (typeof window !== 'undefined') window.removeEventListener('keydown', escapeHandler);
    set({ isActive: false, originNodeId: null, meta: null });
    onComplete?.();
  },
}));

/** 官方 `rke(nodeId)` 的返回值。 */
export interface NodeSelectionPickState {
  showDisabled: boolean;
  showHighlight: boolean;
  showSourceOverlay: boolean;
  isPicked: boolean;
  appearance: 'default' | 'element-library';
}

/** MTV 侧的类型名：图片卡取参考时允许「图片 / 文本」两类（官方 `[IMAGE, TEXT]`）。 */
export const REFERENCE_PICK_ALLOWED_TYPES: readonly string[] = ['ai-image', 'source-image', 'ai-text', 'ai-shotlist', 'ai-markdown'];

/* ── 官方**按源卡类型分类**的「参考」拾取白名单（这就是用户问的「图像卡能选哪些/屏蔽哪些」）──
 * 官方源码里不是一套白名单，而是**每类卡的底部编辑区各自 enterMode 一套**：
 *
 *   ① 图片卡 `pt`（`course-api-base-url-CyloymxZ.js@3224013`）：
 *        `source:'reference', allowedNodeTypes:[ue.IMAGE, ue.TEXT]`
 *   ② 视频卡 `vt`（同文件 @3367819）：
 *        `source:'reference', allowedNodeTypes:[ue.IMAGE, ue.VIDEO, ue.AUDIO, ue.TEXT]`
 *   ③ 音频卡 `Ct`（同文件 @3069255，源 `audioReference`）：
 *        `allowedNodeTypes:[ue.TEXT, ...(T?[ue.VIDEO]:[]), ...(R.maxImages>0?[ue.IMAGE]:[]),
 *                           ...(R.maxAudios>0?[ue.AUDIO]:[])]`
 *        其中 `T = Gg(model)`、`R = qv(model)` —— **按音频模型能力**决定能不能引用视频/图片/音频。
 *        MTV 没有音频模型的这份能力表 ⇒ 按 MTV 音频卡实际支持的引用类型全给（TEXT/IMAGE/AUDIO/VIDEO）。
 *   ④ 文本卡 `ye`（同文件 @3421335，源 `textReference`）：
 *        `allowedNodeTypes:[ue.IMAGE, ue.VIDEO, ue.TEXT]`
 *
 * 官方其它入口：提及编辑器 `[IMAGE, VIDEO]` + `connectionless`；世界参考 `[IMAGE, VIDEO]`；
 * 首/尾帧 `[IMAGE]`；元素库按其自身类型集合 + `appearance:'element-library'`。
 * MTV 的节点类型与官方不是一一对应 ⇒ 按**同一语义**归类（animation/panorama 归视频/图片，
 * markdown/shotlist 归文本）。
 */
const T_IMAGE = ['ai-image', 'source-image', 'ai-panorama'];
const T_VIDEO = ['ai-video', 'ai-animation'];
const T_AUDIO = ['ai-audio', 'source-audio'];
const T_TEXT = ['ai-text', 'ai-markdown', 'ai-shotlist'];

export interface ReferencePickProfile {
  /** 官方 `meta.source`。 */
  source: string;
  /** 官方 `meta.allowedNodeTypes`（MTV 类型名）。 */
  allowedNodeTypes: string[];
}

const IMAGE_CARD_REFERENCE: ReferencePickProfile = { source: 'reference', allowedNodeTypes: [...T_IMAGE, ...T_TEXT] };
const VIDEO_CARD_REFERENCE: ReferencePickProfile = { source: 'reference', allowedNodeTypes: [...T_IMAGE, ...T_VIDEO, ...T_AUDIO, ...T_TEXT] };
const AUDIO_CARD_REFERENCE: ReferencePickProfile = { source: 'audioReference', allowedNodeTypes: [...T_TEXT, ...T_IMAGE, ...T_AUDIO, ...T_VIDEO] };
const TEXT_CARD_REFERENCE: ReferencePickProfile = { source: 'textReference', allowedNodeTypes: [...T_IMAGE, ...T_VIDEO, ...T_TEXT] };

/** 官方 `I9`（`course-…@1235069`）的 kind 表：`{[IMAGE]:'image',[VIDEO]:'video',[VIDEO_EDIT]:'video',[AUDIO]:'audio',[TEXT]:'text',[THREED]:'world'}`。 */
export function referencePickProfileFor(nodeType: string | undefined): ReferencePickProfile {
  if (nodeType && T_VIDEO.includes(nodeType)) return VIDEO_CARD_REFERENCE;
  if (nodeType && T_AUDIO.includes(nodeType)) return AUDIO_CARD_REFERENCE;
  if (nodeType && T_TEXT.includes(nodeType)) return TEXT_CARD_REFERENCE;
  /* 图片卡是默认（`pt`）——`ai-image` / `source-image` / `ai-panorama` / 其它带图卡。 */
  return IMAGE_CARD_REFERENCE;
}

/**
 * 官方「参考」按钮点下去走的那条（`pt`/`vt`/`Ct`/`ye` 四条同构，模式见 `referencePickProfileFor`）：
 * ```js
 * const { isActive, originNodeId, meta, exitMode } = dr.getState();
 * if (isActive && originNodeId === id && meta?.source === <本卡的 source>) { exitMode(); return; }  // 再点一次 = 退出
 * enterMode(id, { source:<…>, toolbarTitle:t('nodeSelectionMode.selectReference'),
 *                 autoExitOnConnect:true, allowedNodeTypes:[…本卡的白名单…] });
 * ```
 * `originType` = 源卡类型（MTV 节点 `type`）⇒ 决定白名单的分类（图像/视频/音频/文本卡各一套）。
 */
export function toggleReferencePick(
  originNodeId: string,
  toolbarTitle: string,
  options?: {
    onSelect?: (nodeId: string) => void;
    onConnect?: (nodeId: string) => void;
    /** 源卡类型（MTV 节点 `type`）——决定白名单分类。 */
    originType?: string;
  },
) {
  const profile = referencePickProfileFor(options?.originType);
  const store = useNodeSelectionStore.getState();
  if (store.isActive && store.originNodeId === originNodeId && store.meta?.source === profile.source) {
    store.exitMode();
    return;
  }
  store.enterMode(originNodeId, {
    source: profile.source,
    toolbarTitle,
    autoExitOnConnect: true,
    allowedNodeTypes: profile.allowedNodeTypes,
    onSelect: options?.onSelect,
    onConnect: options?.onConnect,
  });
}

/** 官方 `rke(nodeId)` 的返回值。 */
export interface NodeSelectionPickState {
  showDisabled: boolean;
  showHighlight: boolean;
  showSourceOverlay: boolean;
  isPicked: boolean;
  appearance: 'default' | 'element-library';
}

/**
 * 官方 `rke`（同文件 @1211063）**逐字**：
 * ```js
 * showDisabled = (() => {
 *   if (!isActive || !originNodeId || isOrigin) return false;
 *   if (meta.allowedNodeTypes) { const n = getNode(id); if (!n || !meta.allowedNodeTypes.includes(n.type)) return true; }
 *   if (meta.isNodeSelectable && !meta.isNodeSelectable(id)) return true;
 *   if (meta.connectionless) return false;
 *   return !isValidConnection({source:id, target:originNodeId, sourceHandle:null, targetHandle:null, data:meta.edgeData});
 * })();
 * showHighlight     = isActive && !showDisabled && !isOrigin && !isPicked;
 * showSourceOverlay = isActive && isOrigin;
 * appearance        = meta?.appearance ?? 'default';
 * ```
 * 这里做成**纯函数**：画布那一层要一次性给所有节点算三态（官方是在每个节点组件里各算一次）。
 */
export function computeNodeSelectionPickState(
  nodeId: string,
  nodeType: string | undefined,
  originNodeId: string | null,
  meta: NodeSelectionMeta | null,
  isActive: boolean,
  nodeExists: boolean,
): NodeSelectionPickState {
  const isOrigin = !!originNodeId && originNodeId === nodeId;
  const isPicked = meta?.selectedNodeIds?.includes(nodeId) ?? false;
  let showDisabled = false;
  if (isActive && originNodeId && !isOrigin) {
    if (meta?.allowedNodeTypes) {
      if (!nodeExists || !meta.allowedNodeTypes.includes(nodeType ?? '')) showDisabled = true;
    }
    if (!showDisabled && meta?.isNodeSelectable && !meta.isNodeSelectable(nodeId)) showDisabled = true;
    if (!showDisabled && !meta?.connectionless) {
      showDisabled = !isCanvasConnectionValid({
        source: nodeId,
        target: originNodeId,
        sourceHandle: null,
        targetHandle: null,
      });
    }
  }
  return {
    showDisabled,
    showHighlight: isActive && !showDisabled && !isOrigin && !isPicked,
    showSourceOverlay: isActive && isOrigin,
    isPicked,
    appearance: meta?.appearance ?? 'default',
  };
}
