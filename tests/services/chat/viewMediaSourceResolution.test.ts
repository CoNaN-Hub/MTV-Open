/**
 * `view_media` 的**取像素顺序**回归（用户实测：节点在聊天里有缩略图，工具却报「图片读取失败」）。
 *
 * 根因：`fetchImageForCrop` 对**本地媒体**返回的是 `asset://` URL（`getAssetUrlFromPath`）、**不是** data URL；
 * 旧代码只认 `data:` 前缀 ⇒ 本地节点一律判失败。正确顺序 = 本地先读盘、远程才走 Rust 下载。
 *
 * 这里用 `vi.mock` 桩住 `fileService` 的两个读取函数，钉住**调用次序**。
 * 验证分级 = **(b) 真 service 代码路径 + 桩 I/O**。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readFileToDataUrl = vi.fn<(path: string) => Promise<string | null>>();
const fetchImageForCrop = vi.fn<(url: string) => Promise<string>>();

vi.mock('../../../src/services/fileService', () => ({
  readFileToDataUrl: (path: string) => readFileToDataUrl(path),
  fetchImageForCrop: (url: string) => fetchImageForCrop(url),
}));

const { getAgentTool, clearAgentToolRegistryForTests } = await import('../../../src/services/chat/toolRegistry');
const { registerViewMediaAgentTools } = await import('../../../src/services/chat/tools/viewMediaTools');
const { useAppStore } = await import('../../../src/store/useAppStore');

const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

function context() {
  return {
    taskId: 'task-1',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    mode: 'autonomous' as const,
    callId: 'call-view-1',
    signal: new AbortController().signal,
  };
}

function seedNode(source: Record<string, unknown>): void {
  useAppStore.setState({
    nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { type: 'ai-image', label: '图', ...source } }],
  } as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
}

beforeEach(() => {
  clearAgentToolRegistryForTests();
  registerViewMediaAgentTools();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ currentProjectId: 'project-1' });
  readFileToDataUrl.mockReset();
  fetchImageForCrop.mockReset();
});

afterEach(() => {
  clearAgentToolRegistryForTests();
});

describe('view_media 的取像素顺序', () => {
  it('裸本地路径 ⇒ 只读盘，**不**走网络下载', async () => {
    readFileToDataUrl.mockResolvedValue(DATA_URL);
    seedNode({ filePath: 'D:/project/out/a.png' });
    const result = await getAgentTool('view_media')!.execute(context(), { node_ids: ['n1'] });
    expect(result.status).toBe('success');
    expect(readFileToDataUrl).toHaveBeenCalledWith('D:/project/out/a.png');
    expect(fetchImageForCrop).not.toHaveBeenCalled();
  });

  it('`asset://`（本地媒体 URL，聊天缩略图那条路）⇒ 也只读盘', async () => {
    readFileToDataUrl.mockResolvedValue(DATA_URL);
    seedNode({ imageUrl: 'asset://localhost/D:/project/out/a.png' });
    const result = await getAgentTool('view_media')!.execute(context(), { node_ids: ['n1'] });
    expect(result.status).toBe('success');
    expect(readFileToDataUrl).toHaveBeenCalledWith('asset://localhost/D:/project/out/a.png');
    expect(fetchImageForCrop).not.toHaveBeenCalled();
  });

  it('本地读取失败时不会退化成网络下载（避免把 asset 主机丢给 reqwest）', async () => {
    readFileToDataUrl.mockResolvedValue(null);
    seedNode({ imageUrl: 'asset://localhost/D:/project/out/a.png' });
    const result = await getAgentTool('view_media')!.execute(context(), { node_ids: ['n1'] });
    expect(result.status).toBe('error');
    expect(fetchImageForCrop).not.toHaveBeenCalled();
  });

  it('远程 `https` ⇒ 走 Rust 下载；返回 data URL 就用它', async () => {
    fetchImageForCrop.mockResolvedValue(DATA_URL);
    seedNode({ imageUrl: 'https://cdn.example/a.png' });
    const result = await getAgentTool('view_media')!.execute(context(), { node_ids: ['n1'] });
    expect(result.status).toBe('success');
    expect(fetchImageForCrop).toHaveBeenCalledWith('https://cdn.example/a.png');
    expect(readFileToDataUrl).not.toHaveBeenCalled();
  });

  it('远程下载回的是**本地 asset URL**（`fetchImageForCrop` 的本地分支）⇒ 再退回读盘', async () => {
    fetchImageForCrop.mockResolvedValue('asset://localhost/D:/cache/a.png');
    readFileToDataUrl.mockResolvedValue(DATA_URL);
    seedNode({ imageUrl: 'https://cdn.example/a.png' });
    const result = await getAgentTool('view_media')!.execute(context(), { node_ids: ['n1'] });
    expect(result.status).toBe('success');
    expect(fetchImageForCrop).toHaveBeenCalledTimes(1);
    expect(readFileToDataUrl).toHaveBeenCalledWith('asset://localhost/D:/cache/a.png');
  });
});

