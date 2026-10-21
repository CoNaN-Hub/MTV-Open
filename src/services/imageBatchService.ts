/**
 * 图片节点批量生成生命周期：先在源节点右侧创建加载节点，再把批量结果逐一回填。
 */
import type { Node } from '@xyflow/react';
import type { BaseNodeData } from '../types';
import type { BatchImageResult, ImageGenerationResult } from '../types/aiTypes';
import { MAX_IMAGE_BATCH_COUNT } from '../types/aiTypes';
import { generateId } from '../store/store.utils';
import { useAppStore } from '../store/useAppStore';
import { persistMediaUrlToProjectData, type PersistedProjectMedia } from './fileService';
import { runBatchTasks } from './ai/batchUtils';
import { getRunningHubPersistedOutput } from './ai/providers/runninghubWorkflow';
import { officialNodePixelSize } from '../utils/officialCanvasLayout';
import { cloneGenerationInputEdges } from '../utils/officialBatchEdges';

interface ApplyImageBatchParams {
  isCurrent?: () => boolean;
  nodeId: string;
  /** 提交请求前创建的目标节点；恢复旧任务时可缺省，由 batchGroupId 自动找回。 */
  targetNodeIds?: string[];
  batch: BatchImageResult;
  projectId: string | null | undefined;
  prompt: string;
  imageSize: string;
  aspectRatio: string;
  /**
   * 官方「批量生成结果 = 多变体」（`ze === Ma.VARIANTS`）。
   * 官方那一支是 `regenerationMode: "replace-source"` ⇒ 结果**替换源节点自身**、不新增兄弟节点。
   * MTV 的批量本来就是「一次请求返回 N 张」（`generateImagesBatch`），所以这一支**不建兄弟节点**，
   * N 张全部落在源节点上：源节点显示第 1 张，N 张一起进它的输出历史（= MTV 的「变体/版本」载体），
   * 并把 N 个地址写进 `data.options`（既表达变体集合，也让 `collectNodeFileReferences` 保住这些文件不被清理）。
   */
  variantsMode?: boolean;
}

interface PrepareImageBatchParams {
  nodeId: string;
  count: number;
  projectId: string | null | undefined;
}

export interface PreparedImageBatchNodes {
  nodeIds: string[];
  batchGroupId: string;
}

interface SavedBatchItem {
  result: ImageGenerationResult;
  persisted: PersistedProjectMedia;
}

/** 官方 `bG = 64`：SPREAD 网格里节点之间的间距（官方 `Nqe` @2792075） */
const BATCH_NODE_GAP = 64;

/**
 * 一次生成多个结果时的默认保存方式（官方「画布设置 → 批量生成结果」）。
 * 官方取值见 `textVariantService` 文件头引的那段：
 *   `ze=Dy(); Be=ze===Ma.VARIANTS; Oe=Be?Ma.SPREAD:ze`
 *   ⇒ 官方把 `VARIANTS` **也**按 `SPREAD` 布局（变体是后续合并的），`PILE` 才是另一种排布。
 */
/**
 * 图卡命名：**官方不加任何序号，同批结果与源节点同名**。
 *
 * 官方出处（`course-api-base-url-CGXqZmAy.js`）：
 *   · @2826450 `function kC(e,t){const n=e[t];return typeof n=="string"&&n.trim()?n:""}`
 *   · @2826480 `function Bb(e,t){return kC(e,"title")||t}`
 *   · @2826780 `dZe` 的每个分支都用 `title: Bb(r,"Image")` —— 标题来自**服务端响应**；
 *   · 全部 i18n 里没有任何「图片 {{index}}」模板（只有无关的 `shotDefault:"Shot {{index}}"`、
 *     Tripo 物体库 `variantLabel:"{{category}}，变体 {{index}}"`）。
 * ⇒ 官方客户端**不给批量结果编号**，`赛博朋克2` 的 N 张结果都叫 `赛博朋克2`。
 * ⚠️ MTV 旧实现拼了 ` 2 / 3 …` 序号，且以**上一次的带序号标签**为基准 ⇒ 再批量时累加成
 *    `赛博朋克2 2 2`（用户报告的「图卡命名逻辑不完整」）。现已按官方去掉序号。
 */
export function readBatchResultLayout(): 'pile' | 'variants' | 'spread' {
  const value = useAppStore.getState().config?.batchResultLayout;
  return value === 'pile' || value === 'variants' ? value : 'spread';
}

/**
 * 官方 `Nqe`（SPREAD 布局，@2792075）：`cols = ceil(sqrt(targets.length))`，
 * 步长 = 节点宽/高 + `bG`(64)，第 d 个目标 `position = anchor + (d%cols*stepX, floor(d/cols)*stepY)`，
 * 且 `d === 0`（源节点）**位置不变**。
 */
function batchNodePosition(
  anchor: { x: number; y: number },
  index: number,
  total: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
  const stepX = width + BATCH_NODE_GAP;
  const stepY = height + BATCH_NODE_GAP;
  const column = index % columns;
  const row = Math.floor(index / columns);
  /* index 0 是源节点本身 ⇒ 它的位置不动，克隆体从 index 1 开始排 */
  return {
    x: anchor.x + column * stepX,
    y: anchor.y + row * stepY,
  };
}

const MISSING_BATCH_RESULT_ERROR = '批量生成未返回结果';

function emptyImageOutput(): Partial<BaseNodeData> {
  return {
    imageUrl: undefined,
    sourceUrl: undefined,
    filePath: undefined,
    assetId: undefined,
    relativePath: undefined,
    artifactId: undefined,
    fileName: undefined,
    mattingMask: undefined,
    annotation: undefined,
    thumbnailUrl: undefined,
    output: undefined,
    imageWidth: undefined,
    imageHeight: undefined,
  };
}

/**
 * 数量包含源节点：选择 4 时保留源节点，并在其右侧立即创建 3 个加载节点。
 */
export function prepareImageBatchNodes({
  nodeId,
  count,
  projectId,
}: PrepareImageBatchParams): PreparedImageBatchNodes {
  const store = useAppStore.getState();
  const sourceNode = store.nodes.find((node) => node.id === nodeId) as Node<BaseNodeData> | undefined;
  if (!sourceNode) throw new Error('生成节点不存在');
  if (store.currentProjectId !== projectId) throw new Error('任务已被取消');

  const requestedCount = Math.min(MAX_IMAGE_BATCH_COUNT, Math.max(1, Math.floor(count)));
  const batchGroupId = `image-batch-${generateId()}`;
  const resultLayout = readBatchResultLayout();
  /* ★★ 步长必须用**节点真实渲染尺寸**（官方 `xn(s)` / `ko(s)`），不是 `data.nodeWidth/nodeHeight`。
     用户 2026 报：「画布设置=铺开 时，卡之间的间距与官方对不上」。
     根因：MTV 原来取 `data.nodeWidth/nodeHeight`，而这一对字段与**实际渲染尺寸**不是一个量 ——
     9333 实测（真实画布，3:4 的图卡）：`data.nodeWidth/nodeHeight = 444×592`，但
     DOM/`measured` = **250×333**（官方 `pR`：短边恒 250）。
     ⇒ 步长 508×656（MTV） vs 314×397（官方）＝ 横多 194、纵多 259 ✗。
     官方出处（`vendor-pkg-canvas-futqHM6N.js`@1204870 的 `rLe`，SPREAD 布局）：
       `const i = xn(s) + _4, l = ko(s) + _4;`（`_4 = 64`，`s` = 源节点） */
  const sourceSize = officialNodePixelSize(sourceNode);
  const nodeWidth = sourceSize.width;
  const nodeHeight = sourceSize.height;
  const additionalNodes = Array.from({ length: requestedCount - 1 }, (_, index) => {
    /* +1：第 0 个是源节点本身（官方 `b = c ? clones : [source, ...clones]`） */
    const position = batchNodePosition(sourceNode.position, index + 1, requestedCount, nodeWidth, nodeHeight);
    return {
      id: `node-${generateId()}`,
      type: 'ai-image',
      position,
      data: {
        ...sourceNode.data,
        ...emptyImageOutput(),
        /* 官方：同批结果与源节点**同名**（标题由服务端给，客户端不加序号） */
        label: sourceNode.data.label,
        type: 'ai-image',
        batchCount: 1,
        batchGroupId,
        status: 'loading',
        error: undefined,
      },
    } as Node<BaseNodeData>;
  });

  store.commitToHistory();
  store.updateNodeDataTransient(nodeId, {
    batchGroupId,
    status: 'loading',
    error: undefined,
  });
  store.addNodesTransient(additionalNodes);

  const nodeIds = [nodeId, ...additionalNodes.map((node) => node.id)];

  /* ★★ 官方 `fLe`（`vendor-pkg-canvas-futqHM6N.js` @1206600 区段）：**源节点的每条「生成输入」入边
     都要给每一个新建的目标节点各复制一条** —— 见 `utils/officialBatchEdges.ts` 的逐字出处。
     用户 2026 报的两个症状同源（MTV 这条路径原来完全没做）：
       ①「多张时都没和参考卡连上」（第 1 张有边、其余 N-1 张 `inEdges: []`，实测）；
       ②「引用的参考生成时完全不参考」（克隆体没有入边 ⇒ 参考图解析拿不到参考卡）。
     ⚠️ 必须在 `pileSelectedNodes()` **之前**加：堆叠投影只按成员锚点重排，边要先生效。 */
  const clonedEdges = cloneGenerationInputEdges(
    useAppStore.getState().edges,
    nodeId,
    additionalNodes.map((node) => node.id),
    () => `edge-${generateId()}`,
  );
  if (clonedEdges.length > 0) {
    useAppStore.getState().onEdgesChange(clonedEdges.map((item) => ({ type: 'add' as const, item })));
  }

  /* 官方「批量生成结果 = 堆叠」：N 个结果直接收进一个堆叠节点。
     MTV 用既有的 `pileSelectedNodes()`（与手动堆叠同一条路径），源节点位置保持不变。 */
  if (resultLayout === 'pile') {
    store.setSelectedNodeIds(nodeIds, 'direct');
    store.pileSelectedNodes();
  }

  return {
    nodeIds,
    batchGroupId,
  };
}

/** 把同一次批量请求仍在等待的节点统一收敛为失败状态。 */
export function failImageBatchNodes(
  nodeIds: string[],
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

function resolveBatchTargetNodeIds(
  sourceNode: Node<BaseNodeData>,
  requestedCount: number,
  explicitNodeIds?: string[],
): string[] {
  if (explicitNodeIds?.length) return explicitNodeIds.slice(0, requestedCount);

  const groupId = sourceNode.data.batchGroupId;
  if (groupId) {
    const state = useAppStore.getState();
    const groupedNodeIds = [
      sourceNode.id,
      ...state.nodes
        .filter((node) => node.id !== sourceNode.id && node.data.batchGroupId === groupId)
        .map((node) => node.id),
    ];
    return groupedNodeIds.slice(0, requestedCount);
  }

  return [];
}

/** Save and materialize a batch while keeping node placement and history consistent. */
export async function applyImageBatchResults({
  nodeId,
  targetNodeIds,
  batch,
  projectId,
  prompt,
  imageSize,
  aspectRatio,
  isCurrent,
  variantsMode = false,
}: ApplyImageBatchParams): Promise<void> {
  if (isCurrent && !isCurrent()) throw new Error('画布已变化，批量产物已保留');
  if (batch.results.length === 0) throw new Error('批量图片生成未返回可用结果');

  const initialStore = useAppStore.getState();
  const sourceNode = initialStore.nodes.find((node) => node.id === nodeId) as Node<BaseNodeData> | undefined;
  if (!sourceNode) throw new Error('生成节点不存在');
  const sourceData = sourceNode.data;

  const savedBatch = await runBatchTasks(batch.results.length, 3, async (index): Promise<SavedBatchItem> => {
    const result = batch.results[index];
    const persisted = getRunningHubPersistedOutput(result.runninghubOutputs, result.url) ?? (projectId
      ? await persistMediaUrlToProjectData(
          result.url,
          projectId,
          'ai-image',
          /* 落盘文件名（不是图卡名）：仍带批内序号，避免同批 N 张同名撞车 */
          `${sourceData.label ?? ''}-${index + 1}`,
        )
      : { mediaUrl: result.url, sourceUrl: result.url });
    return { result, persisted };
  });

  let store = useAppStore.getState();
  if (isCurrent && !isCurrent()) throw new Error('画布已变化，批量产物已保留');
  let liveSource = store.nodes.find((node) => node.id === nodeId) as Node<BaseNodeData> | undefined;
  if (!liveSource || store.currentProjectId !== projectId) throw new Error('任务已被取消');

  let resolvedTargetNodeIds = variantsMode
    /* 多变体：全部落在源节点上（不建兄弟节点） */
    ? [nodeId]
    : resolveBatchTargetNodeIds(liveSource, batch.requestedCount, targetNodeIds);
  if (resolvedTargetNodeIds.length === 0) {
    resolvedTargetNodeIds = prepareImageBatchNodes({
      nodeId,
      count: batch.requestedCount,
      projectId,
    }).nodeIds;
    store = useAppStore.getState();
    liveSource = store.nodes.find((node) => node.id === nodeId) as Node<BaseNodeData> | undefined;
    if (!liveSource) throw new Error('任务已被取消');
  }

  const items = savedBatch.results;
  const liveNodeIds = new Set(store.nodes.map((node) => node.id));
  items.forEach((item, index) => {
    /* 多变体：每一张都写到源节点上（`variantsMode` 时 `resolvedTargetNodeIds` 只有源节点），
       最后一张写完之后再由下面的收尾把 `imageUrl` 定到第 1 张并把 N 个地址写进 `options`。 */
    const targetNodeId = variantsMode ? nodeId : resolvedTargetNodeIds[index];
    if (!targetNodeId || !liveNodeIds.has(targetNodeId)) return;
    store.updateNodeDataTransient(targetNodeId, {
      imageUrl: item.persisted.mediaUrl,
      sourceUrl: item.persisted.sourceUrl,
      filePath: item.persisted.filePath,
      assetId: undefined,
      relativePath: undefined,
      artifactId: undefined,
      fileName: undefined,
      mattingMask: undefined,
      annotation: undefined,
      thumbnailUrl: item.persisted.mediaUrl,
      output: item.persisted.sourceUrl,
      status: 'success',
      error: undefined,
      imageWidth: item.result.width,
      imageHeight: item.result.height,
    });
  });

  resolvedTargetNodeIds.slice(items.length).forEach((targetNodeId) => {
    if (liveNodeIds.has(targetNodeId)) {
      store.updateNodeDataTransient(targetNodeId, {
        status: 'error',
        error: MISSING_BATCH_RESULT_ERROR,
      });
    }
  });

  await Promise.all(items.map((item, index) => {
    /* 多变体：全部记在源节点名下 ⇒ 它们就是源节点的「版本/变体」，媒体查看器的历史列能逐张翻 */
    const targetNodeId = variantsMode ? nodeId : resolvedTargetNodeIds[index];
    if (!targetNodeId || !liveNodeIds.has(targetNodeId)) return Promise.resolve();
    return store.recordOutputHistory(targetNodeId, {
      nodeId: targetNodeId,
      nodeLabel: sourceData.label,
      timestamp: Date.now(),
      prompt,
      output: item.persisted.sourceUrl,
      nodeType: 'ai-image',
      model: (sourceData.model as string) || '',
      provider: (sourceData.provider as string) || '',
      status: 'success',
      mediaUrl: item.persisted.mediaUrl,
      filePath: item.persisted.filePath,
      params: { imageSize, aspectRatio, batchCount: batch.requestedCount, batchIndex: index + 1 },
    });
  }));

  if (variantsMode && items.length > 0) {
    /* 源节点显示第 1 张；N 个地址写进 `options`（= 变体集合；同时让 `collectNodeFileReferences`
       保住全部文件，避免以后删别的节点时把这些变体图误删）。
       ★ 与官方 `ZAe`（`course-api-base-url-CGXqZmAy.js`@1040274，`onTaskComplete` 里 @1047627 调用）逐字对齐：
         `{src: e[0], options: p（= 全部 N 张）, historyVariantsHidden: <原值>,
           historyVariantCount: <options 的去重张数>, …}`
         · **主图 = 本批第 1 张**（官方 `const u=e[0]`，没有任何分支保留旧主图）——MTV 原本就是这个口径 ✓
         · `historyVariantCount` 由官方 `V0`（`page-DVqoHdTT.js`@1359987）读走，
           节点右键菜单「删除其他历史」的可见条件 `V0(data) > 1` 就吃这个值 ⇒ 必须写；
         · `historyVariantsHidden` 官方是**原样沿用**（正常节点上根本不存在该字段）
           ⇒ MTV 这里不写（不能凭空置 false，否则会与官方「字段不存在」的状态不一致）。 */
    const first = items[0].persisted;
    const optionUrls = [...new Set(items.map((item) => item.persisted.mediaUrl).filter(Boolean))];
    store.updateNodeData(nodeId, {
      imageUrl: first.mediaUrl,
      sourceUrl: first.sourceUrl,
      filePath: first.filePath,
      thumbnailUrl: first.mediaUrl,
      output: first.sourceUrl,
      imageWidth: items[0].result.width,
      imageHeight: items[0].result.height,
      options: optionUrls,
      historyVariantCount: optionUrls.length,
    });
  }

  const failedCount = Math.max(batch.failedCount, batch.requestedCount - items.length);
  store.showToast(
    failedCount > 0
      ? `批量生成完成：成功 ${items.length}/${batch.requestedCount} 张`
      : `批量生成完成：共 ${items.length} 张`,
    failedCount > 0 ? 'error' : 'success',
  );
}
