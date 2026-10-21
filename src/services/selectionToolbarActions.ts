/**
 * selectionToolbarActions —— 官方「多选浮动工具栏」8 个按钮的**动作实现**（MTV 侧收口）。
 *
 * 官方组件（`page-DPdEgTS0.js` @1442137 `Bme`）里各按钮的真实动作：
 *   布局   `Ee(mode)`   → `Dme(nodes, edges, mode)` = `XL`（dagre LR）/ `QL`（方形宫格）  ⇒ `applyOfficialLayout`
 *   堆叠   `Te()`       → 建 `PILE` 节点（`pile.stack`）                                ⇒ `pileSelectedNodes`（MTV 无 PILE 节点类型，见下）
 *   打组   `C()`        → `X5().handleGroupNodes`（包围盒 + GROUP 节点 + `parentId`）    ⇒ MTV `groupSelectedNodes()`（已等价）
 *   加入对话 `ce()`     → `setIsOpen(true)` + 派发 `nodes-dropped-on-chat`              ⇒ `addSelectionToChat`（打开对话 + 把节点做成 @ 引用）
 *   新建主体 `ee()`     → `PileRules` 播放列表（MTV 无该节点类型）                       ⇒ 能力位关闭
 *   保存到素材库 `k()`  → `sO().openForSelection(eligible)`                             ⇒ `saveSelectionToLibrary`
 *   下载全部 `we()`     → `_v().downloadNodes(ids)`（文件传输中心）                      ⇒ `downloadSelectedNodes`
 *   反馈问题 `P()`      → 打开反馈面板（MTV 用户已裁定用「在 PS 中打开」顶替）            ⇒ 能力位关闭
 *
 * ⚠️ 与官方的两处**已知差异**（都写在注释里，避免以后被当成 bug 改）：
 *   1. 堆叠：官方建 PILE 节点；MTV 没有这个节点类型 ⇒ 实现为「紧凑堆叠」——按阅读顺序把选中节点
 *      按目标行宽紧密排布（间距 `PILE_GAP`），视觉上等价于官方 PILE 的「叠在一起」。
 *   2. ~~保存到素材库：MTV 的 `saveToLibraryMenu` 只承载单个 nodeId ⇒ 逐个保存到根目录~~
 *      **本轮已对齐** ✓：`saveToLibraryMenu` 现在承载 `nodeIds: string[]`（整个选择），
 *      `saveSelectionToLibrary` 改为**打开官方那个「保存到素材库」文件夹对话框**（官方 `openForSelection`），
 *      落盘在 `Canvas` 的 `onConfirm` 里按所选文件夹做（原来直接写根目录、根本不开对话框 ✗）。
 *   3. 加入对话：官方把节点作为**附件**投进对话；MTV 没有该附件通道 ⇒ 打开对话并在输入框里插入
 *      这些节点的 @ 引用（`chatComposerDraft` 的 `@{id:label}` 与 @ 提及同构）。
 */
import { useAppStore } from '../store/useAppStore';
import { saveNodeOutputsToDirectory } from './fileService';
import { startTransferBatch } from './transferReporting';
import { referenceUrlOfData } from '../utils/referenceTokens';
import { canLayoutSelection, officialLayoutSelection, renderSizeOf, type OfficialLayoutMode } from '../utils/officialCanvasLayout';
import { getNodeBounds } from '../utils/nodeBounds';
import type { BaseNodeData } from '../types';
import type { Node as RFNode } from '@xyflow/react';

/** 官方「堆叠」在 MTV 的紧凑间距（官方 PILE 的层叠视觉等价） */
const PILE_GAP = 8;

/** 官方 `Ce`/`U` 的门用到的节点类型白名单（`z` 里那份 `ge.TEXT/IMAGE/VIDEO/PLAYLIST/AUDIO/THREED/THREE_D_STUDIO`） */
const GROUPABLE_TYPES = [
  'ai-text', 'source-text', 'ai-markdown', 'ai-shotlist',
  'ai-image', 'source-image', 'ai-panorama',
  'ai-video', 'source-video', 'ai-animation',
  'ai-audio', 'source-audio',
  'ai-storyboard', 'ai-timeline',
];

/** 官方 `pe`（加入到对话的候选择）：IMAGE / VIDEO / AUDIO 且有 `src` */
const CHAT_ELIGIBLE_TYPES = new Set([
  'ai-image', 'source-image', 'ai-panorama',
  'ai-video', 'source-video', 'ai-animation',
  'ai-audio', 'source-audio',
]);

export function selectedNodesOf(): { selected: RFNode<BaseNodeData>[]; all: RFNode<BaseNodeData>[] } {
  const state = useAppStore.getState();
  const ids = new Set(state.selectedNodeIds);
  const selected = state.nodes.filter((n) => ids.has(n.id));
  return { selected, all: state.nodes };
}

/** 官方 `K5`：多选时把 GROUP 节点剔掉（全是 group 时保留原样） */
export function selectionWithoutGroups(selected: readonly RFNode<BaseNodeData>[]): RFNode<BaseNodeData>[] {
  if (selected.length <= 1) return [...selected];
  const withoutGroups = selected.filter((n) => n.type !== 'group');
  return withoutGroups.length > 0 ? withoutGroups : [...selected];
}

export function canLayoutSelected(): boolean {
  const { selected } = selectedNodesOf();
  return canLayoutSelection(selectionWithoutGroups(selected));
}

/** 官方 `z`（打组门）：≥2 个、无 group、不是「同一个父节点的全部子节点」、类型都在白名单里 */
export function canGroupSelected(): boolean {
  const { selected } = selectedNodesOf();
  const list = selectionWithoutGroups(selected);
  if (list.length < 2) return false;
  if (list.some((n) => n.type === 'group')) return false;
  const parents = new Set(list.map((n) => n.parentId).filter(Boolean));
  if (parents.size === 1 && list.every((n) => n.parentId === [...parents][0])) return false;
  return list.every((n) => GROUPABLE_TYPES.includes(n.type ?? ''));
}

/** 官方 `pe`：可加入对话的候选择（图片 / 视频 / 音频 且有内容） */
export function chatEligibleOf(list: readonly RFNode<BaseNodeData>[]): RFNode<BaseNodeData>[] {
  return list.filter((n) => CHAT_ELIGIBLE_TYPES.has(n.type ?? '') && !!referenceUrlOfData(n.data));
}

/** 官方 `_v().canDownloadNodes`：选择里至少一个节点有可下载内容 */
export function canDownloadSelected(ids: readonly string[]): boolean {
  const { all } = selectedNodesOf();
  return ids.some((id) => {
    const node = all.find((n) => n.id === id);
    const data = (node?.data ?? {}) as Record<string, unknown>;
    return ['imageUrl', 'videoUrl', 'audioUrl', 'src', 'output'].some(
      (key) => typeof data[key] === 'string' && (data[key] as string).length > 0,
    );
  });
}

/** 官方 `Ee`：套用「布局」下拉选中的算法（走 MTV 历史记录，可 Ctrl+Z 撤销） */
export function applyOfficialLayout(mode: OfficialLayoutMode): boolean {
  const { selected } = selectedNodesOf();
  return applyOfficialLayoutToNodes(mode, selectionWithoutGroups(selected));
}

/**
 * 与 `applyOfficialLayout` 同一套算法，但**指定节点集合**（group 工具条的「布局」要排的是**组内子节点**，
 * 而不是当前选区）—— 官方 group 工具条的 `gXe` 就是拿分组自己的成员去排。
 */
export function applyOfficialLayoutToNodes(
  mode: OfficialLayoutMode,
  list: readonly RFNode<BaseNodeData>[],
): boolean {
  const store = useAppStore.getState();
  if (!canLayoutSelection(list) ) return false;
  if (list.length === 0) return false;

  const { positions } = officialLayoutSelection(mode, [...list], store.edges);
  if (positions.size === 0) return false;

  store.commitToHistory();
  const next = store.nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? { ...node, position } : node;
  });
  store.setNodes(next);
  return true;
}

/**
 * 官方「堆叠」= 建 **PILE 节点**。⚠️⚠️ **MTV 这里不是官方实现**（2026-09-26 复核，用户：
 * 「堆叠 也没实现」）。
 *
 * 官方 PILE 的真实结构（本轮已从源码抽全，见 `AGENTS.md`「官方 PILE 规格（未实现）」）：
 *   · 节点类型 `he.PILE`（值 `"pile"`），**不用 `parentId`** —— 成员是**平铺的顶层节点**，
 *     归属关系存在堆叠节点自己的 `data.memberIds: string[]`（官方 `FE(pile)` 会去重清洗）。
 *   · 可堆叠类型 `wQ = [IMAGE, VIDEO, AUDIO, TEXT]`（官方 `CQ`）。
 *   · 工具条 `nJe({canEdit,members,onUnpile})`：取消堆叠 / 加入对话 / 保存到素材库 / 下载全部。
 *   · 渲染器 `uJe` 还挂着一整套**堆叠专属状态与动画**（`dropTargetPileId` / `entryPlansByPileId` /
 *     `unstackPlan` / `finishEntryPlan` + `ms.stack.*` 的 reflow/entry 运动参数 + 画廊会话
 *     `{session, openGallery}` + `pile-gallery` 全屏层）—— 体量是独立的一个子系统。
 *
 * ⇒ 本函数现在做的**只是「按阅读顺序紧凑排布」**（旧实现，属用户明令禁止的「MTV 等价物」），
 *    **本轮不动**：改成官方 PILE 需要成套移植上面那套子系统，做一半会得到更糟的东西。
 *    待办已记账，下一轮按官方规格整体替换。
 */
export function pileSelectedNodes(): boolean {
  const store = useAppStore.getState();
  const { selected, all } = selectedNodesOf();
  const list = selectionWithoutGroups(selected);
  if (list.length < 2) return false;

  const sizes = new Map(list.map((n) => [n.id, renderSizeOf(n, all)]));
  const ordered = [...list].sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
  const originX = Math.min(...ordered.map((n) => getNodeBounds(n, all).x));
  const originY = Math.min(...ordered.map((n) => getNodeBounds(n, all).y));

  /* 每行放「宫格布局」一列那么多宽（列数 = ceil(sqrt(n))）；不够就退化为每行 ceil(sqrt(n)) 个 */
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
  const rowWidth = ordered.reduce((sum, n) => sum + sizes.get(n.id)!.width, 0) / columns;

  const positions = new Map<string, { x: number; y: number }>();
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let rowUsed = 0;
  ordered.forEach((node, index) => {
    const size = sizes.get(node.id)!;
    if (index > 0 && rowUsed + size.width > rowWidth + 0.5) {
      x = 0;
      y += rowHeight + PILE_GAP;
      rowHeight = 0;
      rowUsed = 0;
    }
    positions.set(node.id, { x: originX + x, y: originY + y });
    x += size.width + PILE_GAP;
    rowUsed += size.width + PILE_GAP;
    rowHeight = Math.max(rowHeight, size.height);
  });

  store.commitToHistory();
  store.setNodes(store.nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? { ...node, position } : node;
  }));
  return true;
}

/** 官方 `C()`：打组（MTV 的 `groupSelectedNodes` 已是等价实现：包围盒 + GROUP 节点 + parentId） */
export function groupSelection(): boolean {
  if (!canGroupSelected()) return false;
  useAppStore.getState().groupSelectedNodes();
  return true;
}

/**
 * 官方 `ce()`：加入到对话 —— 打开对话 + 把选中节点放进**上下文引用条**。
 *
 * 官方逐字（`vendor-pkg-canvas-ChpWx5JY.js`）：
 * ```js
 * // ① 工具条那颗钮（@3227028 的 `Me`）：只做两件事 —— 开对话 + 派发事件
 * Me = () => { oe(!0), setTimeout(() => { const we = re.filter(Te => Te.data?.src);
 *   if (we.length > 0) window.dispatchEvent(new CustomEvent("nodes-dropped-on-chat", { detail: { nodes: we } })) }, 100) }
 * // ② 聊天侧的处理（@2740531 的 `qlt`）—— 收的是**节点 id**，加进**上下文节点**：
 * t = n => { const { nodes: o } = n.detail; const r = o.map(i => i.id).filter(Boolean);
 *   r.length > 0 && qe.getState().addContextNodeIds(r) }
 * ```
 * ⇒ 节点进的是 `ContextStrip` 那排 38×38 缩略图 chip（`addContextNodeIds`），
 * **不往正文里插 `@` 引用**。
 *
 * ⚠️ MTV 原来把它做成「打开对话 + 往输入框里插 `@` 引用」（本文件头部旧注释已登记该偏差），
 * 用户实测图 2：正文里堆出一排 `额娘深秋 / 图片生成 / …` 的 `@` chip，与官方图 1 的缩略图条完全不同。
 */
export function addSelectionToChat(): boolean {
  const { selected } = selectedNodesOf();
  const eligible = chatEligibleOf(selectionWithoutGroups(selected));
  if (eligible.length === 0) return false;

  const store = useAppStore.getState();
  /* 顺序照官方：先开对话（`oe(true)`），再把 id 灌进上下文引用（事件在 100ms 后派发，这里同步等价）。 */
  store.openChat();
  store.addContextNodeIds(eligible.map((node) => node.id));
  return true;
}

/**
 * 官方 `k()`：保存到素材库 —— `sO().openForSelection(eligible)`：
 * **先弹「保存到素材库」文件夹选择对话框**（`z2`），确认后才落盘（`page-DPdEgTS0.js`@char1430453 区域）。
 *
 * ⚠️ 与之前的差异（本轮对齐）：MTV 原来直接 `saveNodeToLibrary(id)` 逐个写进素材库**根目录**、
 *    根本不开对话框 ⇒ 用户没法选文件夹（官方这一步是「先选文件夹」）。
 *    现在改成：把**整个选择**交给对话框（官方 `openForSelection`），落盘在 `Canvas` 的 `onConfirm` 里做。
 * 返回 `false` = 选择为空、没打开对话框。
 */
export function saveSelectionToLibrary(): boolean {
  const { selected } = selectedNodesOf();
  const list = selectionWithoutGroups(selected);
  if (list.length === 0) return false;

  /* 官方对话框是 radix ⇒ 由它自己居中（`fixed left-1/2 top-1/2 -translate-x/y-1/2`），
     `position` 只是 MTV 的既有字段，居中显示时不参与布局。 */
  useAppStore.getState().openSaveToLibraryMenu(list.map((node) => node.id), { x: 0, y: 0 });
  return true;
}

/**
 * 官方 `we()`：下载全部（走官方「文件传输中心」，与 PinBar 的下载全部同一套 → 同一个 `saveNodeOutputsToDirectory`）。
 *
 * ★ 产物形态按官方规则：**去重后的文件数 > 1 ⇒ zip，== 1 ⇒ 原始单文件**（`zoom-slider-3ZcFvYQO.js`
 *   `XU(e) = e.length > 1`，见 `services/downloadArchivePlan.ts` 的逐字引用）。
 *   官方 zip 由服务端产出；MTV 无服务端 ⇒ 本地 JSZip 打包（`fileService` 内动态 import）。
 */
export async function downloadSelectedNodes(): Promise<boolean> {
  const { selected } = selectedNodesOf();
  return downloadNodesByIds(selectionWithoutGroups(selected).map((node) => node.id));
}

/**
 * 与 `downloadSelectedNodes` 同一套编排，但**指定节点集合**
 * （group 工具条的「下载全部」要下的是**组内子节点** —— 官方的分组下载同理）。
 */
export async function downloadNodesByIds(ids: readonly string[]): Promise<boolean> {
  const store = useAppStore.getState();
  const idSet = new Set(ids);
  const list = store.nodes.filter((node) => idSet.has(node.id));
  if (list.length === 0) return false;

  const items = list.flatMap((node) => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    const mediaUrl = referenceUrlOfData(data) || undefined;
    const label = typeof data.label === 'string' && data.label.trim() ? data.label.trim() : node.id;
    const kind = node.type?.includes('video') ? 'video'
      : node.type?.includes('audio') ? 'audio'
        : node.type?.includes('text') || node.type?.includes('markdown') ? 'text' : 'image';
    return [{
      id: node.id,
      batch: {
        id: node.id,
        type: 'download' as const,
        name: label,
        thumbnail: kind === 'text' ? undefined : mediaUrl,
        kind: kind as 'image' | 'video' | 'audio' | 'text',
        status: 'queued' as const,
        downloadPhase: 'preparing' as const,
        percentage: 0,
        total: 0,
        loaded: 0,
        updatedAt: Date.now(),
      },
      file: {
        id: node.id,
        mediaUrl,
        textOutput: !mediaUrl && typeof data.output === 'string' ? data.output : undefined,
        nodeType: node.type ?? 'ai-image',
        fileName: label,
      },
    }];
  });

  if (items.length === 0) return false;
  startTransferBatch(`download-selection:${Date.now().toString(36)}`);
  store.upsertTransferItems(items.map((entry) => entry.batch));

  const outcome = await saveNodeOutputsToDirectory(items.map((entry) => entry.file), {
    onItemStart: (id) => useAppStore.getState().patchTransferItem(id, {
      status: 'running', downloadPhase: 'downloading', updatedAt: Date.now(),
    }),
    onItemDone: (id, error) => useAppStore.getState().patchTransferItem(id, error
      ? { status: 'failed', error, updatedAt: Date.now() }
      : { status: 'completed', percentage: 100, updatedAt: Date.now() }),
  });

  if (outcome.canceled) {
    for (const entry of items) {
      useAppStore.getState().patchTransferItem(entry.id, { status: 'canceled', updatedAt: Date.now() });
    }
    return false;
  }
  if (outcome.failed.length > 0) {
    useAppStore.getState().showToast(`已下载 ${outcome.savedIds.length} 个节点，${outcome.failed.length} 个失败`, 'error');
  }
  return outcome.savedIds.length > 0;
}
