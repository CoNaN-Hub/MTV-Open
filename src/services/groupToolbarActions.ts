/**
 * groupToolbarActions —— 官方 **group（打组）浮动工具条** 上那几个动作的 MTV 实现。
 *
 * 官方 `zoom-slider-3ZcFvYQO.js`@char2883801 的 `group` 工具条三组按钮：
 *   [第 1 组] 颜色选择器 `mQ` + 布局菜单 `gXe`
 *   [第 2 组] 整组执行（`text = common.runAll / common.cancel`，obsidian 变体）
 *             + 创建模板 `mXe`（`workflowManagement`）
 *             + 解组 `Toe`（`text = common.ungroup`）
 *   [第 3 组] 下载 `gQ`（`buttonType: "unwrapped"`）
 * 组之间渲染 `nodeToolbar.sep`（1×18px `bg-primary-border`）。
 *
 * ★ MTV 的取舍（用户 2026 决策 A）：
 *   · 「创建模板」**不出**：官方 `mXe` 是「创建/更新工作流模板」（`workflowId` + tabs 创建/更新），
 *     MTV 的 `WorkflowDefinition` 是 ComfyUI 形状的工作流、与官方 group 模板**不是一回事**
 *     ⇒ 按「不做假控件」先留空（`MTVCAPS.createWorkflow = false`）。
 *   · 颜色沿用 MTV 既有的 `GROUP_COLOR_PALETTE` + `setGroupColor`（官方 `R9e` 是另一套 7 色色表，
 *     换色表会改变用户既有分组的观感 ⇒ 属另一个议题，本轮只对齐**浮层形态**）。
 *
 * 官方的「整组执行/创建模板/颜色」行为**未被实测**（`taskbar-official-report.md` §4 第 7 条），
 * 所以这里一律接 MTV **已有的等价动作**，不臆造官方语义。
 */
import { useAppStore } from '../store/useAppStore';
import { batchExecuteNodes, hasBatchExecutableNodes, type BatchContext } from '../utils/batchExecute';
import { downloadNodesByIds } from './selectionToolbarActions';
import type { OfficialLayoutMode } from '../utils/officialCanvasLayout';
import { officialSquareGridLayout, officialTreeLayout, type OfficialTreeEdge } from '../utils/officialGroupLayout';
import { t } from '../i18n';

import type { BaseNodeData } from '../types';
import type { Edge, Node as RFNode } from '@xyflow/react';

/** 组内成员（MTV 用 React Flow 原生 `parentId` 表达父子关系） */
export function groupChildNodes(groupId: string): RFNode<BaseNodeData>[] {
  return useAppStore.getState().nodes.filter((node) => node.parentId === groupId);
}

/**
 * 官方「整组执行」的**前置门**（`zoom-slider-3ZcFvYQO.js`@char2879977 `I` 回调，逐条）：
 *
 * ```js
 * const I = useCallback(() => {
 *   if (!e) return;                              // 没有 groupId
 *   const V = C();                               // C = 组内成员
 *   if (V.length === 0) return;                  // ← 门 ① 组是空的
 *   const H = V.filter(Gu.isExecutableNode);
 *   if (H.length === 0) return;                  // ← 门 ② 一个可执行成员都没有
 *   …const q = ea.confirm({...});                 // 过门之后**才**弹确认框
 * ```
 *
 * ⇒ MTV 要点完全一致：**两道门都过不去就什么都不发生**（连确认框都不弹）。
 *   `isExecutableNode` 用 MTV 自己那份（`utils/batchExecute.ts:326`，
 *   条件：非 group · 是 6 种 AI 类型之一 · 有 model · 有 provider · 有非空 prompt · status !== 'loading'）。
 *   …而不另造一套判定。
 *
 * 返回 `null` = 官方那两条 `return`（调用方**不要**弹任何 UI）。
 * 返回值里带上官方同时算好的两个集合，供后续步骤复用（避免两次读 store 出现撕裂）：
 *   · `childNodes` = 官方 `V`（全部成员，执行时传进去的那份）
 *   · `internalEdges` = 官方 `Y` = `getEdges().filter(e => childIds.has(e.source) && childIds.has(e.target))`
 *     （**只保留组内连线**；官方确认框 `onConfirm` 就是 `u(V, Y, {…})`）
 */
export interface GroupRunPlan {
  childNodes: RFNode<BaseNodeData>[];
  internalEdges: Edge[];
}

export function planGroupRun(groupId: string): GroupRunPlan | null {
  const state = useAppStore.getState();
  const childNodes = state.nodes.filter((node) => node.parentId === groupId);
  if (childNodes.length === 0) return null;
  const childIds = childNodes.map((node) => node.id);
  if (!hasBatchExecutableNodes(childIds, state.nodes)) return null;
  const idSet = new Set(childIds);
  const internalEdges = state.edges.filter((edge) => idSet.has(edge.source) && idSet.has(edge.target));
  return { childNodes, internalEdges };
}

/**
 * 官方确认框那第二段 `.then(...)` 的**结果**（MTV 版）。
 *
 * 官方 `zoom-slider-3ZcFvYQO.js`@char2880921 的取值链**逐条**：
 * ```js
 * l_(v).catch(()=>[]).then(X => {
 *   const te = HM(H, X, {allNodes: y(), edges: $});          // ① 校验 + 组执行计划
 *   if (te.invalidNodes.length > 0) { …confirmButton.disabled = true…; return null }   // ② 输入不合法
 *   if (te.items.length === 0) {                              // ③ 没有可计费项
 *     update(te.unlimitedNodeCount > 0
 *       ? estimated({amount:"0"})                              //    有「不限额」节点 ⇒ 约 0
 *       : unavailable);                                        //    否则 ⇒ 无法预估
 *     return null;
 *   }
 *   return Fu.batchEstimatePrice({items: te.items}).send();    // ④ 向服务端要价
 * }).then(X => { …yXe(X) 解析出金额… update(金额 ? estimated(金额) : unavailable) })
 *   .catch(() => update(unavailable));                         // ⑤ 任何异常 ⇒ 无法预估
 * ```
 *
 * ★★ MTV 的取舍（**不是「等价物」，是官方的兜底分支本身**）：
 *   · ①/② 的 `HM` 校验依赖官方**云端模型能力矩阵**（参考图张数、图生图/文生图支持位）。
 *       MTV 侧唯一同源的表是 `data/official-image-models.json` 的 `maxImages`，但
 *       MTV 的图片节点**没有**「本节点的输入参考图」这一概念
 *       （`referenceImages` 是**角色卡/剧集资产**的字段，不是画布连线的输入）
 *       ⇒ 无法在不臆造映射的前提下复算 `invalidNodes` ⇒ **该分支在本轮不实现**（记账）。
 *   · ③/④/⑤ 的 `Fu.batchEstimatePrice` 在 MTV **整仓 0 命中**：MTV 是本地桌面应用，
 *       **没有 Tapies / 余额 / 计费系统**（`types/index.ts:536` 的 `credit` 只是顶栏那块
 *       「0 余额」外观占位，见 `components/TopRightNav.tsx:21` 注释）。
 *       ⇒ 官方那条链在 MTV 上必然落到 **⑤ 的兜底** ⇒ 描述文案 = 官方
 *       `workflow.groupRunConfirmation.unavailable`「本次执行暂时无法预估花费。」**原文**。
 *
 *   返回 `null` = 官方 `ea.update(...)` 那一跳（描述已由调用方先置为 `.estimating`）。
 */
export function groupRunEstimateDescription(): string {
  return t('本次执行暂时无法预估花费。');
}

/**
 * 官方「整组执行」（`common.runAll`）—— 复用 `GroupNode` 里那份 `batchExecuteNodes` 编排。
 *
 * ⚠️ 官方 `onConfirm` 里那句 `u(V, Y, {validateBilling:!0, billingReferenceNodes, billingReferenceEdges})`
 *   的第三参 **MTV 没有对应物**：MTV 是本地桌面应用，**根本没有计费/余额系统**
 *   （`types/index.ts:536` 的 `credit` 只是顶部「0 余额」那块**外观占位**，
 *   官方 `Fu.batchEstimatePrice` / `billingPrecheck` 在 MTV 全仓 0 命中）⇒ 不传该参数。
 */
export async function runGroupChildren(groupId: string): Promise<{ ok: number; fail: number }> {
  const state = useAppStore.getState();
  const ids = groupChildNodes(groupId).map((node) => node.id);
  if (ids.length === 0) return { ok: 0, fail: 0 };
  const ctx: BatchContext = {
    commitToHistory: state.commitToHistory,
    updateNodeDataTransient: state.updateNodeDataTransient,
    recordOutputHistory: state.recordOutputHistory,
    currentProjectId: state.currentProjectId,
  };
  return batchExecuteNodes(ids, state.nodes, state.edges, ctx);
}

/**
 * 官方「解组」（`common.ungroup`）。
 * ⚠️ MTV 的 `ungroupSelectedNodes()` 是按**当前选区**解组的 ⇒ 先把选区聚焦到这个分组
 * （工具条本来也只在它被选中时出现，这一步只是保证「多选里含分组」时也解的是它）。
 */
export function ungroupGroupNode(groupId: string): void {
  const state = useAppStore.getState();
  if (!state.selectedNodeIds.includes(groupId)) {
    state.setSelectedNodeIds([groupId], 'direct');
  }
  state.ungroupSelectedNodes();
}

/**
 * 官方 `gXe` 的 `onSquareGridLayout` / `onHorizontalLayout`（分组工具条里的「布局」）：
 * 排的是**组内成员**（官方 `handleSquareGridLayout` 直接吃 `getChildNodes()`）。
 *
 * ⚠️⚠️ **绝对不能走 `canLayoutSelection`**：那是官方**多选工具栏**的门 `I0`
 *   （`e.length<2 ? !1 : e.every(t => t.type!==GROUP && !t.parentId)`）——
 *   而组内成员**必然有 `parentId`** ⇒ 用它当门会让「布局」永远返回 false
 *   （用户实测：「布局按钮的宫格和水平 点击没任何反应」✗）。
 *
 * ⚠️ 子节点坐标是**相对分组**存的，而布局算法是按「绝对/根坐标」算的
 *   ⇒ 这里先把 `parentId` 抹掉再排：算法拿到的就是那套相对坐标，算出来的目标位置也是同一空间，
 *     直接写回 `position` 才不会整体偏移一个分组位移。
 */
export function layoutGroupChildren(mode: OfficialLayoutMode, groupId: string): boolean {
  const store = useAppStore.getState();
  const children = groupChildNodes(groupId);
  if (children.length < 2) return false;

  const flat = children.map((node) => ({ ...node, parentId: undefined }));

  let nextPositions: Map<string, { x: number; y: number }>;
  let groupSize: { width: number; height: number };
  /* 水平布局要**回写的组内边 handle**（官方 `bBl` 的 `x`；宫格不产生） */
  let treeEdgeHandles: OfficialTreeEdge[] = [];

  if (mode === 'grid') {
    /* ★ 官方 `Rse` = index 导出名 `_Bl`（@char8270327）—— **宫格算法本体逐字照做**
       （padding 100 / nodeSpacing 200 / cols=ceil(sqrt(n)) / 格子=maxW×maxH 且节点居中；
        见 `utils/officialGroupLayout.ts` 的逐字注释） */
    const result = officialSquareGridLayout(flat, flat);
    nextPositions = new Map(result.nodes.map((node) => [node.id, node.position]));
    groupSize = result.groupSize;
  } else {
    /* ★ 官方水平 `Mse` = index 导出名 `bBl`（@char8269087）—— **dagre 逐字实现**：
       `rankdir:"LR"` · `nodesep/ranksep = 200` · `marginx/marginy = 100`，
       位置 = dagre 中心点 − 半宽/半高，再整体平移到 `+padding`；`groupSize = max(x+w)/max(y+h) + padding`。 */
    const result = officialTreeLayout(
      flat,
      store.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
      flat,
    );
    if (result.nodes.length === 0) return false;
    nextPositions = new Map(result.nodes.map((node) => [node.id, node.position]));
    groupSize = result.groupSize;
    /* 官方同一处还会**回写组内边的 handle**：`c(q.id, { sourceHandle:"right", targetHandle:"left" })`
       （`zoom-slider`@char2879277 的 `k` = handleTreeLayout）⇒ MTV 用 setEdges 做同一件事。 */
    treeEdgeHandles = result.edges;
  }

  if (nextPositions.size === 0) return false;

  /* ★★ 官方调用点（`zoom-slider`@char2879277 逐字）把**分组尺寸**和子节点位置**一起**写：
     ```js
     N([{ id: e, changes: { width: $.width, height: $.height, measured: {…} } },
        ...H.map(Y => ({ id: Y.id, changes: { position: Y.position } }))]);
     ```
     ⚠️ 上一轮我只写了子节点位置、**没写分组盒子尺寸** ⇒ 就是用户报的
        「宫格/水平 底部不变化、长图**溢出底色**」。 */
  store.commitToHistory();
  store.setNodes(store.nodes.map((node) => {
    if (node.id === groupId) {
      return {
        ...node,
        width: groupSize.width,
        height: groupSize.height,
        measured: { width: groupSize.width, height: groupSize.height },
        style: { ...(node.style ?? {}), width: groupSize.width, height: groupSize.height },
      };
    }
    const position = nextPositions.get(node.id);
    return position ? { ...node, position } : node;
  }));
  /* 官方同一处 `W.forEach(q => c(q.id, { sourceHandle: q.sourceHandle, targetHandle: q.targetHandle }))`
     ⇒ 把组内边的 handle 回写成 right / left */
  if (treeEdgeHandles.length > 0) {
    const handleById = new Map(treeEdgeHandles.map((edge) => [edge.id, edge]));
    store.setEdges(store.edges.map((edge) => {
      const next = handleById.get(edge.id);
      return next ? { ...edge, sourceHandle: next.sourceHandle, targetHandle: next.targetHandle } : edge;
    }));
  }
  return true;
}

/** 官方分组工具条第 3 组的「下载」—— 下的是**组内成员**的内容 */
export async function downloadGroupChildren(groupId: string): Promise<boolean> {
  return downloadNodesByIds(groupChildNodes(groupId).map((node) => node.id));
}

/** 组内是否有东西可下（决定「下载」那颗钮是否渲染；官方 `_v().canDownloadNodes` 同理） */
export function canDownloadGroup(groupId: string): boolean {
  return groupChildNodes(groupId).some((node) => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    return ['imageUrl', 'videoUrl', 'audioUrl', 'src', 'output'].some(
      (key) => typeof data[key] === 'string' && (data[key] as string).length > 0,
    );
  });
}




