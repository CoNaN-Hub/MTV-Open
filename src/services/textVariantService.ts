/**
 * textVariantService —— 文本卡「生成次数 N」= **画布上 N 个兄弟节点**（官方口径）
 *
 * 官方出处（`zoom-slider-3ZcFvYQO.js`，逐字）：
 *   · 文本生成入口 @2827275：
 *       `ze=Dy(); Be=ze===Ma.VARIANTS; Oe=Be?Ma.SPREAD:ze;
 *        Ie=Bqe({currentNodes,currentEdges,sourceInputEdges,sourceNodeId,sourceNodeSnapshot,
 *                editorPrompt, regenerationMode: Be||r ? "replace-source" : "preserve-source",
 *                resultCount:q, resultsPerRequest:1, runId, resultLayout:Oe, pileRules})`
 *     其中 `Q=I.params?.times||1, q=_.requestedResultCount??Q`（@2823789）
 *     ⇒ **要生成 N 个 = 目标节点数 N，每个节点各发一次请求（`resultsPerRequest:1`）**。
 *   · 克隆逻辑 `Dqe` @2793626：
 *       `c = Mv(source) && regenerationMode === "preserve-source"`（`Mv` = 节点已有内容：文本看 `data.text`）
 *       `u = c ? resultCount : resultCount - 1`（克隆数）· `b = c ? clones : [source, ...clones]`
 *       ⇒ 首次生成（空节点）：**源节点 + N-1 个克隆**；对已有内容的节点再生成：N 个新增克隆、源节点保留。
 *   · 克隆体数据 `Mqe` @2793222：新 id、`selected:!1`、剥离
 *       `kqe=["options","historyVariantCount","historyLocalQueues","historyLocalQueueMetadata",
 *             "historyLocalQueueResourceMetadata"]`、文本节点 `text:""`；
 *       `Pqe` 写 `taskInfo{status:PENDING, injectType, runId, requestId, resultIndex}`。
 *   · 布局 `Nqe`（SPREAD，@2792075）：`bG = 64`；`cols = ceil(sqrt(targets.length))`；
 *       步长 = 节点宽/高 + 64；第 d 个目标 `position = anchor.position + (d%cols*stepX, floor(d/cols)*stepY)`，
 *       且 `d===0`（源节点）**位置不变** ✓
 *   · 连线 `Oqe` @2794374：把源节点的「生成输入」入边**逐条复制**到每个新节点（`Fqe` 造新 edge，带 order）。
 *   · 结果回填 `qTe` @1022981：文本写 `{[t]:i}`，`t = nodeType===TEXT ? "text" : "src"`，按 `target.resultIndex` 取。
 *   · `historyLocalQueues` 只给 IMAGE/VIDEO/AUDIO（`INe` 调用点 @1038815）⇒ 文本**不用**它。
 *
 * MTV 落地：
 *   · 节点字段是扁平的（`data.output` 存正文、`data.batchCount` 存次数）⇒ 克隆体清空 `output`、
 *     `batchCount: 1`（官方克隆体 `params.times` 也被强制回 1：`f = r>1||c ? {...params, times:1} : void 0`）
 *   · 每个目标节点各调用一次 `generateText`（官方 `resultsPerRequest:1`），并发沿用 MTV 既有的 3
 */
import type { Node } from '@xyflow/react';
import type { BaseNodeData } from '../types';
import { generateId } from '../store/store.utils';
import { useAppStore } from '../store/useAppStore';
import { TEXT_MAX_VARIANTS } from '../utils/textVariants';
import { officialNodePixelSize } from '../utils/officialCanvasLayout';
import { cloneGenerationInputEdges } from '../utils/officialBatchEdges';

/** 官方 `bG = 64`：SPREAD 网格里节点之间的间距 */
export const TEXT_VARIANT_NODE_GAP = 64;

/** 官方 `Nqe` 的 SPREAD 网格：`cols = ceil(sqrt(count))`，第 0 个（源节点）留在原地 */
export function textVariantNodePosition(
  anchor: { x: number; y: number },
  width: number,
  height: number,
  index: number,
  count: number,
): { x: number; y: number } {
  if (index <= 0) return { x: anchor.x, y: anchor.y };
  const columns = Math.ceil(Math.sqrt(Math.max(1, count)));
  const stepX = width + TEXT_VARIANT_NODE_GAP;
  const stepY = height + TEXT_VARIANT_NODE_GAP;
  const column = index % columns;
  const row = Math.floor(index / columns);
  return { x: anchor.x + column * stepX, y: anchor.y + row * stepY };
}

export interface PrepareTextVariantParams {
  nodeId: string;
  /** 目标节点总数（官方 `resultCount`）：包含源节点 */
  count: number;
  projectId: string | null | undefined;
}

export interface PreparedTextVariants {
  /** 源节点在前、克隆体在后，顺序 = 官方 `targetNodeIds` */
  nodeIds: string[];
  variantGroupId: string;
}

/**
 * 官方 `Dqe` 的 MTV 等价实现：源节点（首次生成时自带内容位）+ N-1 个克隆兄弟节点，
 * 并把源节点的入边复制到克隆体（官方 `Oqe`）。
 */
export function prepareTextVariantNodes({
  nodeId,
  count,
  projectId,
}: PrepareTextVariantParams): PreparedTextVariants {
  const store = useAppStore.getState();
  const sourceNode = store.nodes.find((node) => node.id === nodeId) as Node<BaseNodeData> | undefined;
  if (!sourceNode) throw new Error('生成节点不存在');
  if (store.currentProjectId !== projectId) throw new Error('任务已被取消');

  const total = Math.min(TEXT_MAX_VARIANTS, Math.max(1, Math.floor(count)));
  const variantGroupId = `text-variant-${generateId()}`;
  /* ★ 步长用官方 `xn/ko`（= 节点真实渲染尺寸），不是 `data.nodeWidth/nodeHeight` ——
     与 `imageBatchService` 同一口径（见 `officialNodePixelSize` 的注释；用户报的「铺开间距对不上」）。 */
  const sourceSize = officialNodePixelSize(sourceNode);
  const nodeWidth = sourceSize.width;
  const nodeHeight = sourceSize.height;
  const label = sourceNode.data.label ?? '';

  const clones = Array.from({ length: total - 1 }, (_, index) => ({
    id: `node-${generateId()}`,
    type: 'ai-text',
    position: textVariantNodePosition(sourceNode.position, nodeWidth, nodeHeight, index + 1, total),
    data: {
      ...sourceNode.data,
      /* 官方 `Mqe`：克隆体剥掉历史/变体字段，文本清空正文（MTV 的正文字段是扁平 `output`） */
      output: undefined,
      text: undefined,
      status: 'loading',
      error: undefined,
      /* 官方 `Dqe`：克隆体的 times 强制回 1 ⇒ 每个节点各生成一条 */
      batchCount: 1,
      textVariantGroupId: variantGroupId,
      /* 官方：同批结果与源节点**同名**（标题由服务端给，客户端不加序号；见 imageBatchService 头注） */
      label,
      type: 'ai-text',
    },
  } as Node<BaseNodeData>));

  store.commitToHistory();
  store.updateNodeDataTransient(nodeId, {
    textVariantGroupId: variantGroupId,
    batchCount: total,
    status: 'loading',
    error: undefined,
  });
  store.addNodesTransient(clones);

  /* 官方 `fLe`/`mLe`：源节点的「生成输入」入边逐条复制到**每个克隆体**（否则克隆体丢失上游引用）。
     与 `imageBatchService` 走**同一个** helper（官方 @1206600 区段 + `Gg` @668599 的 purpose 过滤）✓ */
  const clonedEdges = cloneGenerationInputEdges(
    store.edges,
    nodeId,
    clones.map((clone) => clone.id),
    () => `edge-${generateId()}`,
  );
  if (clonedEdges.length > 0) {
    useAppStore.getState().onEdgesChange(clonedEdges.map((item) => ({ type: 'add' as const, item })));
  }

  return { nodeIds: [nodeId, ...clones.map((node) => node.id)], variantGroupId };
}

/** 把同一次多变的、仍在 loading 的目标节点统一收敛为失败态（对标 `failImageBatchNodes`） */
export function failTextVariantNodes(
  nodeIds: readonly string[],
  error: string,
  projectId: string | null | undefined,
): void {
  const store = useAppStore.getState();
  if (store.currentProjectId !== projectId) return;
  const liveNodes = new Map(store.nodes.map((node) => [node.id, node]));
  nodeIds.forEach((nodeId) => {
    if (liveNodes.get(nodeId)?.data.status === 'loading') {
      store.updateNodeDataTransient(nodeId, { status: 'error', error });
    }
  });
}
