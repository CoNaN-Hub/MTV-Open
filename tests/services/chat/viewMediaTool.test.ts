/**
 * `view_media` 生产者回归 —— 用户实测：「把图和 skill 一起发给 agent」时，agent 只会回复
 * 「当前画布工具只返回节点元数据，不提供图像像素或可视预览…请直接上传该图片」。
 *
 * 官方事实：`xV = new Set(["view_media"])`（工具名，@2393308）、结果形状 `lNe(t)` =
 * `response.images[]/videos[].ref`（@428841）——**像素**由服务端在下一轮塞进模型上下文。
 * MTV 没有服务端 ⇒ 工具直接交出 data URL，由 `agentRoundExecutor` 作为下一条 **user** 消息的
 * `image_url` 内容块回灌（`role:'tool'` 三条协议都只能放文本）。
 *
 * 验证分级 = **(b) 真实 toolRegistry + 桩数据 + (d) 源码级**。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentToolContext } from '../../../src/services/chat/toolRegistry';
import { clearAgentToolRegistryForTests, getAgentTool } from '../../../src/services/chat/toolRegistry';
import { registerViewMediaAgentTools } from '../../../src/services/chat/tools/viewMediaTools';
import { ensureAgentToolsRegistered } from '../../../src/services/chat/tools';
import { useAppStore } from '../../../src/store/useAppStore';

const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

function context(over: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    taskId: 'task-1',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    mode: 'autonomous',
    callId: 'call-view-1',
    signal: new AbortController().signal,
    ...over,
  };
}

function seedNodes(): void {
  useAppStore.setState({
    nodes: [
      { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'ai-image', label: '额娘深秋', imageUrl: DATA_URL } },
      { id: 'n2', position: { x: 0, y: 0 }, data: { type: 'source-image', label: '图片生成', thumbnailUrl: DATA_URL } },
      { id: 'n3', position: { x: 0, y: 0 }, data: { type: 'ai-video', label: '分镜视频', videoUrl: 'https://example.com/v.mp4' } },
      { id: 'n4', position: { x: 0, y: 0 }, data: { type: 'ai-text', label: '纯文本节点', output: 'hi' } },
    ],
  } as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
}

beforeEach(() => {
  clearAgentToolRegistryForTests();
  registerViewMediaAgentTools();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ currentProjectId: 'project-1', activeConversationId: 'conversation-1' });
  seedNodes();
});

afterEach(() => {
  clearAgentToolRegistryForTests();
});

describe('view_media 生产者', () => {
  it('已注册、只读、描述里点名「像素 / canvas_query 看不到」', () => {
    const tool = getAgentTool('view_media');
    expect(tool).toBeDefined();
    expect(tool!.effect).toBe('read');
    expect(tool!.description).toContain('像素');
    expect(tool!.description).toContain('canvas_query');
  });

  it('取到像素 ⇒ `modelImages` 带 data URL，且 `officialResponse.images[].ref` 走官方展示链', async () => {
    const tool = getAgentTool('view_media')!;
    const result = await tool.execute(context(), { node_ids: ['n1'] });
    expect(result.status).toBe('success');
    expect(result.summary).toBe('已查看 1 项内容');
    expect(result.modelImages).toEqual([{ url: DATA_URL, label: '额娘深秋' }]);
    expect(result.officialResponse).toEqual({ images: [{ ref: 'node/n1' }] });
    expect(result.modelContent).toContain('node/n1');
  });

  it('去重 + 一次最多 4 项（第 5 个 id 被截断）', async () => {
    const tool = getAgentTool('view_media')!;
    const result = await tool.execute(context(), {
      node_ids: ['n1', 'n1', 'n2', 'n3', 'n4', 'n1'],
    });
    /* n1/n2 有像素；n3 是视频、n4 无图 ⇒ 只有 2 项带像素，其余进 `unavailable`。 */
    expect(result.modelImages).toHaveLength(2);
    expect(result.modelImages!.map((image) => image.label)).toEqual(['额娘深秋', '图片生成']);
    expect(result.summary).toBe('已查看 2 项内容');
    const payload = JSON.parse(result.modelContent) as { unavailable: Array<{ ref: string }> };
    expect(payload.unavailable.map((item) => item.ref)).toEqual(['node/n3', 'node/n4']);
  });

  it('视频节点不假装能看（只报告未取帧）', async () => {
    const tool = getAgentTool('view_media')!;
    const result = await tool.execute(context(), { node_ids: ['n3'] });
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('VIEW_MEDIA_NO_PIXELS');
    expect(result.modelImages).toBeUndefined();
  });

  it('节点不存在 ⇒ 报错；授权对未知 id 直接拒绝', async () => {
    const tool = getAgentTool('view_media')!;
    const result = await tool.execute(context(), { node_ids: ['nope'] });
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('VIEW_MEDIA_NO_PIXELS');
    expect(tool.authorize?.(context(), { node_ids: ['nope'] })).toMatchObject({ allowed: false });
    expect(tool.authorize?.(context(), { node_ids: ['n1'] })).toEqual({ allowed: true });
  });

  it('全量注册也带上它', () => {
    clearAgentToolRegistryForTests();
    ensureAgentToolsRegistered();
    expect(getAgentTool('view_media')).toBeDefined();
  });

  it('图片藏在**非标准键**里也能找到（深度受限扫描；用户实测：节点有缩略图但工具报「没有可用的图片数据」）', async () => {
    useAppStore.setState({
      nodes: [
        {
          id: 'n-odd',
          position: { x: 0, y: 0 },
          /* 既没有 imageUrl 也没有 filePath：像素埋在历史队列里（粘贴/导入节点的常见形状）。 */
          data: { type: 'source-image', label: '导入的图', historyLocalQueues: [[{ url: DATA_URL, params: {} }]] },
        },
      ],
    } as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
    const tool = getAgentTool('view_media')!;
    const result = await tool.execute(context(), { node_ids: ['n-odd'] });
    expect(result.status).toBe('success');
    expect(result.modelImages).toEqual([{ url: DATA_URL, label: '导入的图' }]);
  });

  it('只有 `filePath`（没有 imageUrl）时也能取到；`output` 里长得像图片 URL 的也认', async () => {
    useAppStore.setState({
      nodes: [
        { id: 'n-path', position: { x: 0, y: 0 }, data: { type: 'source-image', label: '本地图', filePath: DATA_URL } },
        { id: 'n-out', position: { x: 0, y: 0 }, data: { type: 'ai-image', label: '输出图', output: DATA_URL } },
      ],
    } as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
    const tool = getAgentTool('view_media')!;
    const result = await tool.execute(context(), { node_ids: ['n-path', 'n-out'] });
    expect(result.status).toBe('success');
    expect(result.modelImages?.map((image) => image.label)).toEqual(['本地图', '输出图']);
  });

  it('失败时把该节点**真实字段名**回报给模型（便于定位下一步补哪个键）', async () => {
    useAppStore.setState({
      nodes: [{
        id: 'n-noimg',
        position: { x: 0, y: 0 },
        data: { type: 'ai-image', label: '空图', prompt: '一只猫', status: 'idle' },
      }],
    } as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
    const tool = getAgentTool('view_media')!;
    const result = await tool.execute(context(), { node_ids: ['n-noimg'] });
    expect(result.status).toBe('error');
    expect(result.modelContent).toContain('现有字段');
    expect(result.modelContent).toContain('prompt');
  });

  it('`prompt`/说明文本不会被误当成图片源（只认 data URL / http / 图片扩展名）', async () => {
    useAppStore.setState({
      nodes: [{
        id: 'n-text',
        position: { x: 0, y: 0 },
        data: { type: 'ai-image', label: '文字节点', src: '这不是图片，只是一段 prompt 文本' },
      }],
    } as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
    const tool = getAgentTool('view_media')!;
    const result = await tool.execute(context(), { node_ids: ['n-text'] });
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('VIEW_MEDIA_NO_PIXELS');
  });
});

describe('运行时的像素回灌（源码级）', () => {
  it('工具结果之后另起一条 user 消息，带 `image_url` 内容块', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/services/chat/agentRoundExecutor.ts'), 'utf8');
    expect(source).toContain('visionImages');
    expect(source).toContain("type: 'image_url'");
    const toolPush = source.lastIndexOf("role: 'tool'");
    const imagePush = source.indexOf("role: 'user'");
    expect(imagePush).toBeGreaterThan(toolPush);
    /* 必须在同一个函数结束前（即下一轮请求之前）注入。 */
    expect(source.slice(imagePush, imagePush + 400)).toContain('image_url');
  });
});
