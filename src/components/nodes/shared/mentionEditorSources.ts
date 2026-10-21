/**
 * nodes/shared/mentionEditorSources — @ 提及候选来源解析。
 * 收集画布上可被引用的生成节点（含上游连线输出）与工作流 IO 节点，
 * 解析出带缩略图、输出类型与自引用标记的提及条目，供提示词编辑器联想补全。
 */
import type { AppState } from '../../../store/useAppStore';
import type { BaseNodeData, NodeType, StoryboardCellOverride, WorkflowIONodeType } from '../../../types';
import { bestNodeThumb, mentionLabelFor } from './mentionEditorDom';
import { resolveDramaVoiceRef } from '../../../services/dramaAssetPrompt';

export interface CanvasMentionItem {
  id: string;
  label: string;
  /** 节点自己的名字（官方 `item.title`）—— `label` 是在它基础上按 `Kind N` 编过号的显示名 */
  title?: string;
  type: NodeType;
  displayId: number | undefined;
  hasOutput: boolean;
  outputType: 'image' | 'video' | 'audio' | 'text';
  thumbnailUrl: string | undefined;
  isSelf: boolean;
}

export interface WorkflowMentionItem {
  id: string;
  label: string;
  _ioNodeId: string;
  _ioType: WorkflowIONodeType;
}

export function resolveCanvasMentionNodes(
  nodeId: string | undefined,
  nodes: AppState['nodes'],
  edges: AppState['edges'],
): CanvasMentionItem[] {
  if (!nodeId) return [];
  const currentNode = nodes.find((node) => node.id === nodeId);
  const rawSourceIds = new Set(edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source));
  if (currentNode?.parentId) {
    edges.filter((edge) => edge.target === currentNode.parentId)
      .forEach((edge) => rawSourceIds.add(edge.source));
  }

  const sourceNodeIds = new Set<string>();
  for (const sourceId of rawSourceIds) {
    const sourceNode = nodes.find((node) => node.id === sourceId);
    if (sourceNode?.type === 'group') {
      nodes.filter((node) => node.parentId === sourceId)
        .forEach((node) => sourceNodeIds.add(node.id));
    } else {
      sourceNodeIds.add(sourceId);
    }
  }

  const list: CanvasMentionItem[] = nodes
    .filter((node) => node.id !== nodeId && node.type !== 'group' && sourceNodeIds.has(node.id))
    .map((node) => ({
      id: node.id,
      label: (node.data.label as string) || '节点',
      title: (node.data.label as string) || undefined,
      type: node.data.type,
      displayId: node.data.displayId as number | undefined,
      hasOutput: !!node.data.output,
      outputType: node.data.imageUrl ? 'image' : node.data.videoUrl ? 'video' : node.data.audioUrl ? 'audio' : 'text',
      thumbnailUrl: bestNodeThumb(node.data),
      isSelf: false,
    }));

  const expanded: CanvasMentionItem[] = [];
  for (const item of list) {
    expanded.push(item);
    if (item.type !== 'ai-storyboard') continue;
    const storyboard = nodes.find((node) => node.id === item.id);
    if (!storyboard) continue;
    const data = storyboard.data as BaseNodeData;
    const cols = Math.max(1, data.storyboardCols || 3);
    const rows = Math.max(1, data.storyboardRows || 3);
    const extracted = data.storyboardExtracted ?? [];
    const overrides = data.storyboardOverrides ?? [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cols; column += 1) {
        const index = row * cols + column;
        if (extracted[index] && !overrides[index]) continue;
        expanded.push({
          id: `${item.id}/cell/${index}`,
          label: `${item.label} · 第${row + 1}行${column + 1}列`,
          title: `${item.label} · 第${row + 1}行${column + 1}列`,
          type: 'ai-image',
          displayId: undefined,
          hasOutput: true,
          outputType: 'image',
          thumbnailUrl: (overrides[index] as StoryboardCellOverride | null)?.url || data.imageUrl,
          isSelf: false,
        });
      }
    }
  }

  if (currentNode && currentNode.type !== 'group') {
    const { output, imageUrl, videoUrl, audioUrl } = currentNode.data;
    if ((typeof output === 'string' && output.trim()) || imageUrl || videoUrl || audioUrl) {
      expanded.unshift({
        id: currentNode.id,
        label: currentNode.data.label || '节点',
        title: currentNode.data.label || undefined,
        type: currentNode.data.type,
        displayId: currentNode.data.displayId,
        hasOutput: true,
        outputType: imageUrl ? 'image' : videoUrl ? 'video' : audioUrl ? 'audio' : 'text',
        thumbnailUrl: bestNodeThumb(currentNode.data),
        isSelf: true,
      });
    }
  }
  /* ★ 候选行的名字按**官方**口径算（`zoom-slider` @228896 / @3195786）：
       `label = 节点自己的名字 || \`Image N\` / \`Video N\` / \`Audio N\` / \`Text N\``，
       其中 N = **同类候选里的 1-based 序号**；类型默认名（`生成图像` 等）视作「没有名字」✓
       （用户：「@多张时 芯片显示名字逻辑不对」——原来直接把 `data.label` 拿来，
        多张图全是「生成图像」/「图片生成」，跟官方对不上 ✓） */
  const counters: Record<string, number> = { image: 0, video: 0, audio: 0, text: 0 };
  for (const item of expanded) {
    const kind = canvasMentionKind(item.type);
    counters[kind] += 1;
    item.label = mentionLabelFor(item.title ?? item.label, kind, counters[kind]);
  }
  return expanded;
}

/** 画布节点类型 → 官方那四档提及媒体档
    （导出供聊天 `@` 面板复用，避免两侧各写一套等价映射 ⇒ 编号口径才会一致） */
export function canvasMentionKind(type: NodeType): 'image' | 'video' | 'audio' | 'text' {
  if (type === 'ai-video') return 'video';
  if (type === 'ai-audio') return 'audio';
  if (type === 'ai-text' || type === 'ai-markdown') return 'text';
  return 'image';
}

export function resolveWorkflowMentionNodes(
  selectedWorkflowId: string | undefined,
  ioNodes: Array<{ nodeId: string; title: string; type: WorkflowIONodeType }>,
): WorkflowMentionItem[] {
  if (!selectedWorkflowId) return [];
  return ioNodes.map((io) => ({
    id: `wf:${io.nodeId}`,
    label: io.title,
    _ioNodeId: io.nodeId,
    _ioType: io.type,
  }));
}

export function resolveDramaMentionItems(
  dramaAssets: AppState['dramaAssets'],
  query: string,
  nodeType?: NodeType,
) {
  const items = [
    ...dramaAssets.characters.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind as string,
      imageNodeId: asset.imageNodeId,
      imageUrl: asset.imageUrl,
      referenceImages: asset.referenceImages,
      voice: nodeType === 'ai-audio' ? resolveDramaVoiceRef(asset) : null,
    })),
    ...dramaAssets.scenes.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind as string,
      imageNodeId: asset.imageNodeId,
      imageUrl: asset.imageUrl,
      referenceImages: undefined,
      voice: null,
    })),
    ...dramaAssets.props.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind as string,
      imageNodeId: asset.imageNodeId,
      imageUrl: asset.imageUrl,
      referenceImages: undefined,
      voice: null,
    })),
  ];
  const candidates = nodeType === 'ai-audio' ? items.filter((item) => item.voice) : items;
  if (!query) return candidates.slice(0, 20);
  const normalizedQuery = query.toLowerCase();
  return candidates.filter((asset) => asset.name.toLowerCase().includes(normalizedQuery)).slice(0, 20);
}
