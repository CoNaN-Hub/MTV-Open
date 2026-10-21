// @vitest-environment jsdom
/**
 * Agent/对话生成出来的媒体卡 = 官方的 **GENERATE** 变体，**不是** UPLOAD/源文件变体。
 *
 * 事故（用户截图）：Agent 建的生图卡「对话生成图片」在「模型失败 / 被打断」时露出的是
 * **上传态空卡**（36px 上传箭头 + 「上传图片」tooltip），而不是图像卡自己的空卡占位图。
 *
 * 根因（`store/store.nodes.ts`）：`createMediaPlaceholder` / `materializeMediaArtifact`
 * 先用字面量写 `role: 'generator'`，**紧接着又把它覆盖成 `'source'`**（该覆盖来自 MTV 初始提交）。
 * 而 `role === 'source'` 在 MTV 里是「从文件进来的卡」的唯一判据，被三处消费：
 *   ① `ImageNode` 的 `isSource` 空态分派（= 用户看到的错）；
 *   ② `officialVideoNodeVariant`：`source` → 官方 UPLOAD 变体 ⇒
 *      `officialInputBar.isInputBarSuppressedNode` 把**底部生成输入条整条收掉**；
 *   ③ `mentionEditorDom.chipMentionKind`：`source` → 灰底 attachment 芯片，
 *      官方「生成出来的图片节点」是蓝胶囊。
 *
 * 这个测试钉住「生成占位卡一律 `role: 'generator'`」这条不变量，以及它派生的②③两条后果。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { isInputBarSuppressedNode } from '../../src/utils/officialInputBar';
import { OFFICIAL_VIDEO_NODE_TYPE, resolveOfficialVideoNodeType } from '../../src/utils/officialVideoNodeVariant';
import { useAppStore } from '../../src/store/useAppStore';
import type { MediaGenerationIntent, MediaGenerationResult } from '../../src/types/media';

function imageIntent(): MediaGenerationIntent {
  return { kind: 'image', prompt: 'test image', modelRef: 'tudou/gpt-image-2.5', deliveryMode: 'both' };
}
function videoIntent(): MediaGenerationIntent {
  return { kind: 'video', prompt: 'test video', modelRef: 'tudou/seedance-2.5', deliveryMode: 'both' };
}
function artifact(kind: 'image' | 'video'): MediaGenerationResult {
  return {
    id: `artifact-${kind}`,
    kind,
    url: `https://example.com/media.${kind === 'image' ? 'png' : 'mp4'}`,
    sourceUrl: `https://example.com/media.${kind === 'image' ? 'png' : 'mp4'}`,
    prompt: 'test',
    modelId: 'test',
    provider: 'tudou',
    deliveryMode: 'both',
    persistence: 'saved',
    createdAt: 1,
    ...(kind === 'image' ? { width: 1024, height: 1024 } : {}),
  };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    currentProjectId: 'project-1',
    projects: [{ id: 'project-1', name: 'Project 1', createdAt: 1, updatedAt: 1 }],
    nodes: [],
    edges: [],
    groups: [],
    canvasRevision: 0,
  });
});

describe('对话/Agent 生成的媒体卡：role 必须是 generator', () => {
  it('生图占位卡（模型失败/被打断时留下的那张空卡）⇒ role generator，空态走图像卡而不是上传态', () => {
    const nodeId = useAppStore.getState().createMediaPlaceholder(imageIntent(), { x: 0, y: 0 });
    const node = useAppStore.getState().nodes.find((item) => item.id === nodeId)!;

    expect(node.type).toBe('ai-image');
    expect(node.data.role).toBe('generator');
    /* 用户看到的字面文案就是这条路的标签。
       ⚠️ 2026：模型没给 `title` 时不再回落成泛化的「对话生成图片」（用户实测：「跟内容无关」），
       改成从 prompt 取首个短句（这里 prompt 是 `test…`）⇒ 断言按新规则。 */
    expect(node.data.label).not.toBe('对话生成图片');
    expect(node.data.label).toContain('test');
    /* 失败/被打断 ⇒ 这张卡会停在「没有图」的状态，此时空态由 `role` 决定 */
    expect(node.data.imageUrl).toBeFalsy();
  });

  it('生视频占位卡 ⇒ role generator，且**不**被判成官方 UPLOAD 变体（否则底部生成输入条会被整条收掉）', () => {
    const nodeId = useAppStore.getState().createMediaPlaceholder(videoIntent(), { x: 0, y: 0 });
    const node = useAppStore.getState().nodes.find((item) => item.id === nodeId)!;

    expect(node.data.role).toBe('generator');
    expect(resolveOfficialVideoNodeType(node.data)).toBe(OFFICIAL_VIDEO_NODE_TYPE.GENERATE);
    expect(isInputBarSuppressedNode(node.type, node.data)).toBe(false);
  });

  it('已落地的对话产物（materializeMediaArtifact）同样是 generator，不能倒退回 source', () => {
    const imageNodeId = useAppStore.getState().materializeMediaArtifact(artifact('image'), { x: 0, y: 0 });
    const imageNode = useAppStore.getState().nodes.find((item) => item.id === imageNodeId)!;
    expect(imageNode.data.role).toBe('generator');
    expect(imageNode.data.imageUrl).toBe('https://example.com/media.png');

    const videoNodeId = useAppStore.getState().materializeMediaArtifact(artifact('video'), { x: 10, y: 10 });
    const videoNode = useAppStore.getState().nodes.find((item) => item.id === videoNodeId)!;
    expect(videoNode.data.role).toBe('generator');
    expect(resolveOfficialVideoNodeType(videoNode.data)).toBe(OFFICIAL_VIDEO_NODE_TYPE.GENERATE);
  });

  it('★ 本轮生成参数落到节点：要 3:4 就写 3:4（卡片不再一律按 1:1 出）', () => {
    /* 事故（用户真机）：「我给 agent 是 3:4，画布上出现的是 1:1 的尺寸」——
       `ImageNode` 的卡片尺寸取自 `aspectRatioValue(data.aspectRatio)`（生成节点的 intrinsicRatio 恒 null）
       ⇒ 占位卡不写 aspectRatio 就一定是 1:1。 */
    const nodeId = useAppStore.getState().createMediaPlaceholder(
      { ...imageIntent(), aspectRatio: '3:4' },
      { x: 0, y: 0 },
    );
    const node = useAppStore.getState().nodes.find((item) => item.id === nodeId)!;
    expect(node.data.aspectRatio).toBe('3:4');
  });

  it('★ 建占位卡时把镜头带过去（否则生成动画在视口外，用户看不到）', () => {
    const batches: unknown[] = [];
    const listener = (event: Event) => batches.push((event as CustomEvent).detail);
    window.addEventListener('canvas-focus-nodes', listener);
    let nodeId: string;
    try {
      nodeId = useAppStore.getState().createMediaPlaceholder(imageIntent(), { x: 0, y: 0 });
    } finally {
      window.removeEventListener('canvas-focus-nodes', listener);
    }
    expect(batches).toEqual([{ nodeIds: [nodeId!] }]);
  });

  it('对照组：上传/导入那几条路仍然是 source（这条修正没有把「上传卡」一起改掉）', () => {
    useAppStore.getState().addNodes([{
      id: 'uploaded-image',
      type: 'ai-image',
      position: { x: 0, y: 0 },
      data: { label: 'photo.png', type: 'ai-image', role: 'source', fileName: 'photo.png', status: 'success' },
    } as never]);

    const node = useAppStore.getState().nodes.find((item) => item.id === 'uploaded-image')!;
    expect(node.data.role).toBe('source');
    /* 从文件进来的图像卡 ⇒ 官方口径「不渲染底部编辑区」 */
    expect(isInputBarSuppressedNode(node.type, node.data)).toBe(true);
  });
});
