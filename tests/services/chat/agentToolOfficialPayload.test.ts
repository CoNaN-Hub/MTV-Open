/**
 * 「工具生产者」端到端回归 —— 官方卡片载荷通道
 * `AgentToolExecutionResult.officialRequest / officialUi` → `AgentToolCallSnapshot` → `tool_event`。
 *
 * 背景（覆盖表 §7.6 / §7.8 / §13.4）：渲染侧的官方卡片族（`ShowWidgetCard` / `ShowHtmlCard` /
 * `McpAppCard` …）早就移植完，但 `AgentToolCallSnapshot.officialRequest/officialUi`
 * **没有任何写入者** ⇒ 卡片是死代码。官方读的是 `tool_event.content.request`（`request ?? content`）
 * 与 `content.ui.resource_uri`，所以工具必须能把官方载荷交出来。
 *
 * 本测试跑**真实的一轮**（`executeAgentRound` + 真 store），注册一个返回官方载荷的测试工具，
 * 断言载荷一路落到快照、并让官方卡片判据成立。验证分级 = **(b) 真实执行链（jsdom 无关的纯逻辑链）**。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentTask } from '../../../src/types/agent';
import type { ProposedToolCall } from '../../../src/types/chat';

const streamAssistantReplyMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/generationService', () => ({ executeGeneration: vi.fn(async () => ({ success: true })) }));

vi.mock('../../../src/services/ai/assistantStream', () => ({
  streamAssistantReply: streamAssistantReplyMock,
}));

vi.mock('../../../src/services/chat/contextManager', () => ({
  ContextBudgetError: class ContextBudgetError extends Error {
    readonly code = 'CONTEXT_ERROR';
  },
  assembleAgentContext: vi.fn(async () => ({
    messages: [{ role: 'user', content: 'official payload' }],
    usage: {},
  })),
  estimateModelMessagesTokens: vi.fn(() => 1),
  resolveAssistantContextSpec: vi.fn(() => ({ inputBudget: 100_000 })),
}));

import { executeAgentRound } from '../../../src/services/chat/agentRoundExecutor';
import { transitionAgentTask } from '../../../src/services/chat/agentRuntime';
import { clearAgentToolRegistryForTests, registerAgentTool } from '../../../src/services/chat/toolRegistry';
import { stepToToolEvent } from '../../../src/services/chat/agentActivityItems';
import { isMcpAppEvent } from '../../../src/services/chat/mcpAppCard';
import { classifyToolEventFamily } from '../../../src/services/chat/agentMessageContents';
import { useAppStore } from '../../../src/store/useAppStore';

/** 官方 `ShowHtmlCard`（`ure`）读的 `request` 形状：`{title, description, artifact_path}`。 */
const SHOW_HTML_REQUEST = {
  title: '交互式讲解页',
  description: '把当前创作整理成可分享的动态成果',
  artifact_path: 'artifacts/interactive.html',
};
/** 官方 mcpApp 判据是结构：`content.ui.resource_uri` 非空字符串。 */
const MCP_APP_UI = { resource_uri: 'ui://tapnow/app.html' };

function createTask(): AgentTask {
  return {
    id: 'task-payload',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    userMessageId: 'message-1',
    mode: 'autonomous',
    goal: 'official payload',
    status: 'queued',
    steps: [],
    modelRounds: 0,
    toolCallCount: 0,
    budget: { maxModelRounds: 4, maxToolCalls: 4, maxParallelReadTools: 1, maxReadRetries: 3 },
    createdAt: 1,
    updatedAt: 1,
  };
}

beforeEach(() => {
  clearAgentToolRegistryForTests();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    currentProjectId: 'project-1',
    activeConversationId: 'conversation-1',
    conversations: [{
      id: 'conversation-1', projectId: 'project-1', title: 'Payload', titleSource: 'auto',
      pinned: false, archived: false, agentMode: 'autonomous', createdAt: 1, updatedAt: 1, messageCount: 0,
    }],
    agentTasks: [createTask()],
  });
  streamAssistantReplyMock.mockReset();
});

afterEach(() => { vi.restoreAllMocks(); });

function runRound(calls: ProposedToolCall[]) {
  streamAssistantReplyMock.mockImplementation(async ({ onEvent }: { onEvent: (event: unknown) => void }) => {
    calls.forEach((call) => onEvent({ type: 'tool.call.final', call }));
  });
  return executeAgentRound({
    taskId: 'task-payload',
    signal: new AbortController().signal,
    messages: [{ role: 'user', content: 'official payload' }],
    fullText: '',
    totalToolResultChars: 0,
    callbacks: {},
    transitionTask: transitionAgentTask,
    waitForApproval: async () => ({ approved: true }),
  });
}

describe('「工具生产者」：官方卡片载荷通道', () => {
  it('工具返回 `officialRequest`/`officialUi` ⇒ 落到快照，并让官方卡片判据成立', async () => {
    registerAgentTool({
      id: 'test_show_html',
      title: '生成交互页',
      description: '测试用：返回官方 show_html 载荷。',
      effect: 'read',
      inputSchema: { type: 'object', properties: {}, additionalProperties: true },
      execute: async () => ({
        status: 'success',
        summary: '已生成交互页',
        modelContent: '{}',
        officialRequest: SHOW_HTML_REQUEST,
        officialUi: MCP_APP_UI,
      }),
    });

    await runRound([{ callId: 'call-1', toolId: 'test_show_html', input: {} }]);

    const step = useAppStore.getState().agentTasks[0].steps[0];
    /* ① 快照层：载荷原样保留（不是被 `sanitizeToolDisplay` 洗掉的展示字段）。 */
    expect(step.toolCall?.officialRequest).toEqual(SHOW_HTML_REQUEST);
    expect(step.toolCall?.officialUi).toEqual(MCP_APP_UI);

    /* ② 适配层：`stepToToolEvent` 把它并进官方 `content.request` / `content.ui`。 */
    const event = stepToToolEvent(step);
    const content = (event as unknown as { content: Record<string, unknown> }).content;
    expect(content.request).toEqual(SHOW_HTML_REQUEST);
    expect(content.ui).toEqual(MCP_APP_UI);

    /* ③ 渲染层判据：官方 `$M` 的 mcpApp 判据是**结构**（`content.ui.resource_uri`）且优先级更高
       ⇒ 带 `ui` 时分类为 `mcp_app`；去掉 `ui` 后同一份 `request` 被正确分类为 `show_html`。 */
    expect(isMcpAppEvent({ type: 'tool_event', content })).toBe(true);
    expect(classifyToolEventFamily({ type: 'tool_event', content } as never)).toBe('mcp_app');
    const { ui: _ui, ...withoutUi } = content;
    /* 族识别按**工具名**（官方 `xl(e)`）⇒ 工具名是 `show_html` 时走 html 卡分支。 */
    expect(classifyToolEventFamily({
      type: 'tool_event',
      content: { ...withoutUi, tool: 'show_html' },
    } as never)).toBe('show_html');
  });

  it('工具不返回官方载荷 ⇒ 仍然退回 MTV 的工具行形状（`request.{description,prompt}`）', async () => {
    registerAgentTool({
      id: 'test_plain',
      title: '普通工具',
      description: '测试用：没有官方载荷。',
      effect: 'read',
      inputSchema: { type: 'object', properties: {}, additionalProperties: true },
      execute: async () => ({ status: 'success', summary: '完成', modelContent: '{}' }),
    });

    await runRound([{ callId: 'call-2', toolId: 'test_plain', input: {} }]);

    const step = useAppStore.getState().agentTasks[0].steps[0];
    expect(step.toolCall?.officialRequest).toBeUndefined();
    expect(step.toolCall?.officialUi).toBeUndefined();
    const content = (stepToToolEvent(step) as unknown as { content: Record<string, unknown> }).content;
    expect(content).not.toHaveProperty('ui');
    expect(content.request).toEqual({
      description: '普通工具',
      prompt: step.toolCall?.inputSummary ?? '',
    });
  });
});
