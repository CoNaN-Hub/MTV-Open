/**
 * `view_media` 第 58 轮真因回归（用户实测「查看媒体失败·查看画面 又不行了」）。
 *
 * 现场证据（CDP → MTV 页面 → IndexedDB）：
 *  · 项目 `72269479`（去脏去噪工作流）节点 `#28 / node-wxw3ghkpq` 的 data：
 *    `label: "5ef6f3b65d85…"`、`assetId: "9cab8502-…"`、
 *    `relativePath: "5ef6f3b65d85….jpg"`（**相对文件名**）、
 *    `imageUrl: "http://asset.localhost/E%3A%2F…jpg"`（可读）；
 *  · 同一个 `view_media(node-wxw3ghkpq)` 输入，一次 `VIEW_MEDIA_NO_PIXELS`、随后两次成功
 *    （`agentTasks` 里 `inputFingerprint` 三次相同）⇒ 读盘失败是**瞬时**的、且旧代码**只试一个来源**。
 *
 * 三条修复对应三组断言：
 *  ① `assetId` ⇒ 资产索引换回**绝对路径**（相对文件名永远读不到）；
 *  ② 相对文件名不再被当成图片地址（旧版把它当来源 ⇒ 必然一次失败）；
 *  ③ 逐候选 + 重试，且失败时把**真实原因**（候选数 + 每个错误的明细）回报，并标记可重试。
 *
 * 验证分级 = **(b) 真 service 代码路径 + 桩 I/O**。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readFileToDataUrl = vi.fn<(path: string) => Promise<string | null>>();
const fetchImageForCrop = vi.fn<(url: string) => Promise<string>>();
const resolveIndexedAssetPath = vi.fn<(assetId: string) => Promise<string | null>>();

vi.mock('../../../src/services/fileService', () => ({
  readFileToDataUrl: (path: string) => readFileToDataUrl(path),
  fetchImageForCrop: (url: string) => fetchImageForCrop(url),
  resolveIndexedAssetPath: (assetId: string) => resolveIndexedAssetPath(assetId),
}));

const { getAgentTool, clearAgentToolRegistryForTests } = await import('../../../src/services/chat/toolRegistry');
const { registerViewMediaAgentTools } = await import('../../../src/services/chat/tools/viewMediaTools');
const { useAppStore } = await import('../../../src/store/useAppStore');

const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const RELATIVE_NAME = '5ef6f3b65d8533ec338e7110cf7388f9--c8c6fa71052441769511dac930b1a5fa.jpg';
const ABSOLUTE_PATH = `E:/源码/保存/去脏去噪工作流-72269479/${RELATIVE_NAME}`;

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
    nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { type: 'ai-image', label: '素材', ...source } }],
  } as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
}

beforeEach(() => {
  clearAgentToolRegistryForTests();
  registerViewMediaAgentTools();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ currentProjectId: 'project-1' });
  readFileToDataUrl.mockReset();
  fetchImageForCrop.mockReset();
  resolveIndexedAssetPath.mockReset();
});

afterEach(() => {
  clearAgentToolRegistryForTests();
});

describe('view_media 真因修复', () => {
  it('只有 assetId + relativePath（没有 imageUrl）⇒ 经资产索引换回**绝对路径**再读', async () => {
    resolveIndexedAssetPath.mockResolvedValue(ABSOLUTE_PATH);
    readFileToDataUrl.mockResolvedValue(DATA_URL);
    seedNode({ assetId: '9cab8502-c5f1-489b-b459-9009991d96f7', relativePath: RELATIVE_NAME, status: 'success' });

    const result = await getAgentTool('view_media')!.execute(context(), { node_ids: ['n1'] });
    expect(result.status).toBe('success');
    expect(resolveIndexedAssetPath).toHaveBeenCalledWith('9cab8502-c5f1-489b-b459-9009991d96f7');
    expect(readFileToDataUrl).toHaveBeenCalledWith(ABSOLUTE_PATH);
    expect(JSON.stringify(result.officialResponse)).toContain('node/n1');
  });

  it('相对文件名不再被当成图片地址（旧版从这里开始就注定失败）', async () => {
    readFileToDataUrl.mockResolvedValue(DATA_URL);
    seedNode({ relativePath: RELATIVE_NAME, fileName: RELATIVE_NAME, status: 'success' });

    const result = await getAgentTool('view_media')!.execute(context(), { node_ids: ['n1'] });
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('VIEW_MEDIA_NO_PIXELS');
    /* 关键：没有把相对名丢去读盘 */
    expect(readFileToDataUrl).not.toHaveBeenCalled();
    expect(result.modelContent).toContain('该节点没有可读的图片地址');
    expect(result.modelContent).toContain('relativePath');
  });

  it('首次读盘失败、重试成功 ⇒ 仍然成功（现场同一输入一次失败两次成功）', async () => {
    readFileToDataUrl.mockResolvedValueOnce(null).mockResolvedValue(DATA_URL);
    seedNode({ imageUrl: `http://asset.localhost/${encodeURIComponent(ABSOLUTE_PATH)}` });

    const result = await getAgentTool('view_media')!.execute(context(), { node_ids: ['n1'] });
    expect(result.status).toBe('success');
    expect(readFileToDataUrl).toHaveBeenCalledTimes(2);
  });

  it('全部候选都失败 ⇒ reason 带候选数与错误明细，并标记 retryable', async () => {
    readFileToDataUrl.mockResolvedValue(null);
    seedNode({ imageUrl: `http://asset.localhost/${encodeURIComponent(ABSOLUTE_PATH)}` });

    const result = await getAgentTool('view_media')!.execute(context(), { node_ids: ['n1'] });
    expect(result.status).toBe('error');
    expect(result.retryable).toBe(true);
    expect(result.modelContent).toContain('候选');
    expect(result.modelContent).toContain('读盘返回空');
  });

  it('节点确实不存在 ⇒ 明确说「节点不存在」，不可重试', async () => {
    const result = await getAgentTool('view_media')!.execute(context(), { node_ids: ['不存在的节点'] });
    expect(result.status).toBe('error');
    expect(result.modelContent).toContain('节点不存在');
    expect(result.retryable).toBe(false);
  });
});
