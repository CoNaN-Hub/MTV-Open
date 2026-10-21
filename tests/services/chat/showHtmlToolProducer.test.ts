/**
 * `show_html` **生产者**回归（覆盖表 §6「补工具生产者」）。
 *
 * 官方链路：工具族 `ONe = Set(["show_html"])`（`lT` @444963）→ `$M` 分支
 * `status !== "completed" ? null : <ure content={e.content}/>`；`ure`(`ShowHtmlCard`) 读
 * `content.request ?? content` 的 `{title, description, artifact_path}`，点击写
 * `setHtmlPreviewTarget`，`mst`(`HtmlPreview`) 再用 `vo.getCanvasArtifact` 拉正文。
 *
 * MTV 侧差异（如实登记）：没有服务端 artifact 接口 ⇒ 正文落本地 IndexedDB
 * （`chatArtifactService`），由 `localHtmlPreviewTransport` 读回。
 * 验证分级 = **(b) 真实执行链（fake-indexeddb）+ 纯逻辑断言**。
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentToolContext } from '../../../src/services/chat/toolRegistry';
import { clearAgentToolRegistryForTests, getAgentTool } from '../../../src/services/chat/toolRegistry';
import { registerShowHtmlAgentTools } from '../../../src/services/chat/tools/showHtmlTools';
import {
  clearChatArtifactsForTests,
  readChatArtifact,
} from '../../../src/services/chat/chatArtifactService';
import { officialHtmlPreviewTransport } from '../../../src/services/chat/htmlPreviewTransport';
import { stepToToolEvent } from '../../../src/services/chat/agentActivityItems';
import { classifyToolEventFamily } from '../../../src/services/chat/agentMessageContents';
import { useAppStore } from '../../../src/store/useAppStore';
import type { AgentStep } from '../../../src/types/agent';

function context(over: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    taskId: 'task-1',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    mode: 'autonomous',
    callId: 'call-html-1',
    signal: new AbortController().signal,
    ...over,
  };
}

beforeEach(async () => {
  clearAgentToolRegistryForTests();
  registerShowHtmlAgentTools();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ currentProjectId: 'project-1', activeConversationId: 'conversation-1' });
  await clearChatArtifactsForTests();
});

afterEach(() => {
  clearAgentToolRegistryForTests();
});

describe('show_html 生产者', () => {
  it('已注册；`effect` 是写操作（官方对 html 产物按 file_write 处理）', () => {
    const tool = getAgentTool('show_html');
    expect(tool).toBeDefined();
    expect(tool!.effect).toBe('file_write');
  });

  it('执行 ⇒ 落本地 artifact + 返回官方 `request` 形状 `{title, description, artifact_path}`', async () => {
    const tool = getAgentTool('show_html')!;
    const result = await tool.execute(context(), {
      title: '销量报告',
      description: '按周汇总',
      html: '<html><body>hello</body></html>',
    });
    expect(result.status).toBe('success');
    expect(result.officialRequest).toEqual({
      title: '销量报告',
      description: '按周汇总',
      /* 纯中文标题 slug 化后为空 ⇒ 官方 artifact 目录约定回落到 `page.html`。 */
      artifact_path: 'artifacts/conversation-1/page.html',
    });
    /* 落盘可按 `canvas_id + artifact_path` 读回（官方 `getCanvasArtifact` 的两个入参）。 */
    const artifactPath = String((result.officialRequest as Record<string, unknown>).artifact_path);
    const record = await readChatArtifact('project-1', artifactPath);
    expect(record?.content).toBe('<html><body>hello</body></html>');
    /* 本地传输层把正文按官方的 `{data:{artifact:{content}}}` 形状交出来。 */
    const response = await officialHtmlPreviewTransport.getCanvasArtifact({
      canvas_id: 'project-1',
      artifact_path: artifactPath,
    });
    expect(response.data?.artifact?.content).toBe('<html><body>hello</body></html>');
  });

  it('缺省 `artifact_path` 时用官方 artifact 目录约定 `artifacts/<conversationId>/<slug>.html`', async () => {
    const tool = getAgentTool('show_html')!;
    const result = await tool.execute(context(), { title: 'My Page!', html: '<p>x</p>' });
    expect((result.officialRequest as Record<string, unknown>).artifact_path)
      .toBe('artifacts/conversation-1/my-page.html');
  });

  it('端到端：快照 → `tool_event` ⇒ `classifyToolEventFamily` 归到 `show_html` 族（`lT` 命中）', async () => {
    const tool = getAgentTool('show_html')!;
    const result = await tool.execute(context(), { title: 'P', html: '<p>x</p>' });
    const step: AgentStep = {
      id: 's1',
      taskId: 'task-1',
      index: 0,
      kind: 'tool',
      title: '生成交互页',
      status: 'succeeded',
      createdAt: 1,
      updatedAt: 2,
      toolCall: {
        callId: 'call-html-1',
        toolId: 'show_html',
        retryCount: 0,
        startedAt: 1,
        finishedAt: 2,
        officialRequest: result.officialRequest,
      },
    };
    const event = stepToToolEvent(step);
    expect(classifyToolEventFamily(event as never)).toBe('show_html');
    expect((event as unknown as { content: Record<string, unknown> }).content.request)
      .toEqual(result.officialRequest);
  });

  it('空 HTML ⇒ `SHOW_HTML_EMPTY`（不落盘、不伪造产物）', async () => {
    const tool = getAgentTool('show_html')!;
    const result = await tool.execute(context(), { title: 'X', html: '   ' });
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('SHOW_HTML_EMPTY');
    expect(result.officialRequest).toBeUndefined();
  });
});
