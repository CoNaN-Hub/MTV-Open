import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentTask } from '../../../src/types/agent';

const streamAssistantReplyMock = vi.hoisted(() => vi.fn());
const assembleAgentContextMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/ai/assistantStream', () => ({
  streamAssistantReply: streamAssistantReplyMock,
}));

vi.mock('../../../src/services/chat/contextManager', () => ({
  ContextBudgetError: class ContextBudgetError extends Error { readonly code = 'CONTEXT_ERROR'; },
  assembleAgentContext: assembleAgentContextMock,
  estimateModelMessagesTokens: vi.fn(() => 1),
  resolveAssistantContextSpec: vi.fn(() => ({ inputBudget: 100_000 })),
}));

import { runAgentLoop } from '../../../src/services/chat/agentRuntime';
import { clearWebReadSessionsForTests, readWebSession } from '../../../src/services/chat/webReadSessionService';
import { clearProviderModelCatalogsForTests, createProviderModelCatalog, getProviderModelCatalog } from '../../../src/services/chat/providerModelCatalogService';
import {
  clearAgentLifecycleListenersForTests,
  subscribeAgentLifecycle,
} from '../../../src/services/chat/agentLifecycle';
import {
  clearAgentToolRegistryForTests,
  registerAgentTool,
} from '../../../src/services/chat/toolRegistry';
import { useAppStore } from '../../../src/store/useAppStore';

const input = { nodeIds: ['node-1'], label: 'updated' };

function createTask(): AgentTask {
  const now = Date.now();
  return {
    id: 'task-diagnostics',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    userMessageId: 'message-1',
    mode: 'autonomous',
    goal: 'update canvas',
    status: 'queued',
    steps: [],
    modelRounds: 0,
    toolCallCount: 0,
    budget: { maxModelRounds: 4, maxToolCalls: 4, maxParallelReadTools: 1, maxReadRetries: 3 },
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    currentProjectId: 'project-1',
    activeConversationId: 'conversation-1',
    conversations: [{
      id: 'conversation-1', projectId: 'project-1', title: 'Diagnostics', titleSource: 'auto',
      pinned: false, archived: false, agentMode: 'autonomous', createdAt: 1, updatedAt: 1,
      messageCount: 0,
    }],
    historyIndex: 0,
    canvasRevision: 0,
    agentTasks: [createTask()],
  });
  streamAssistantReplyMock.mockReset();
  assembleAgentContextMock.mockReset();
  assembleAgentContextMock.mockResolvedValue({
    messages: [{ role: 'user', content: 'update canvas' }],
    usage: {},
  });
});

afterEach(() => {
  clearWebReadSessionsForTests();
  clearProviderModelCatalogsForTests();
  clearAgentToolRegistryForTests();
  clearAgentLifecycleListenersForTests();
});

function arrangeStream() {
  let round = 0;
  streamAssistantReplyMock.mockImplementation(async ({ onEvent }) => {
    round += 1;
    onEvent({ type: 'usage', inputTokens: round === 1 ? 10 : 2, outputTokens: round === 1 ? 3 : 1 });
    if (round === 1) {
      onEvent({
        type: 'tool.call.final',
        call: { callId: 'call-1', toolId: 'canvas_write_test', input },
      });
    }
  });
}

describe('agent runtime diagnostics', () => {
  it.each(['completed', 'budget_failed', 'context_error', 'aborted'] as const)('clears document snapshots and catalogs on %s', async (outcome) => {
    const task = createTask();
    const options = { scope: { taskId: task.id, projectId: task.projectId, conversationId: task.conversationId },
      kind: 'web' as const, url: 'https://example.com/docs', authorize: () => true };
    const load = async () => ({ readMethod: 'static' as const, complete: true, issues: [], pages: [{
      source: { id: 's', title: 'doc', url: options.url, domain: 'example.com', fetchedAt: 1, sourceType: 'page' as const },
      text: 'temporary body', links: [], truncated: false }] });
    const snapshot = await readWebSession(options, load);
    const catalog = createProviderModelCatalog(options.scope, [{ id: 'm', name: 'M', category: 'text' }]);
    streamAssistantReplyMock.mockResolvedValue(undefined);
    if (outcome === 'budget_failed') useAppStore.setState({ agentTasks: [{ ...task, budget: { ...task.budget, maxModelRounds: 0 } }] });
    const controller = new AbortController();
    if (outcome === 'aborted') controller.abort();
    if (outcome === 'context_error') assembleAgentContextMock.mockRejectedValue(new Error('context failed'));
    const result = runAgentLoop({ taskId: task.id, systemPrompt: 'system', userMessage: 'done', signal: controller.signal });
    if (outcome === 'completed') await result;
    else if (outcome === 'budget_failed') await expect(result).resolves.toBe('failed');
    else await expect(result).rejects.toThrow();
    expect(() => getProviderModelCatalog(options.scope, catalog.catalogId)).toThrow('失效');
    await expect(readWebSession({ ...options, readSessionId: snapshot.readSessionId }, load)).rejects.toThrow('失效');
  });
  it('marks older conversation requests as context outside the current task boundary', async () => {
    assembleAgentContextMock.mockResolvedValue({
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: '帮我规划一个科幻短片' },
        { role: 'assistant', content: '我先为你创建短片节点' },
        { role: 'user', content: '只配置 RightAPI 厂商' },
      ],
      usage: {},
    });
    streamAssistantReplyMock.mockImplementation(async ({ onEvent }) => {
      onEvent({ type: 'usage', inputTokens: 4, outputTokens: 1 });
    });

    await runAgentLoop({
      taskId: 'task-diagnostics',
      systemPrompt: 'system',
      userMessage: '只配置 RightAPI 厂商',
      signal: new AbortController().signal,
    });

    const messages = streamAssistantReplyMock.mock.calls[0]?.[0].messages as Array<{
      role: string;
      content: string;
    }>;
    expect(messages.at(-1)).toEqual({ role: 'user', content: '只配置 RightAPI 厂商' });
    expect(messages.at(-2)).toMatchObject({
      role: 'system',
      content: expect.stringContaining('是本任务的唯一执行目标'),
    });
    expect(messages.at(-2)?.content).toContain('不得回头执行历史中的其他请求');
    expect(messages.at(-3)).toEqual({ role: 'assistant', content: '我先为你创建短片节点' });
  });

  it('records usage, lifecycle events, and a canvas checkpoint', async () => {
    const lifecycleTypes: string[] = [];
    const unsubscribe = subscribeAgentLifecycle((event) => {
      lifecycleTypes.push(event.type);
    });
    arrangeStream();
    registerAgentTool({
      id: 'canvas_write_test',
      title: 'Update canvas',
      description: 'Update canvas',
      effect: 'canvas_write',
      inputSchema: { type: 'object', additionalProperties: true, properties: {} },
      execute: vi.fn(async () => {
        useAppStore.setState({ historyIndex: 1, canvasRevision: 1 });
        return { status: 'success' as const, summary: 'updated', modelContent: 'updated' };
      }),
    });

    await runAgentLoop({
      taskId: 'task-diagnostics',
      systemPrompt: 'system',
      userMessage: 'update canvas',
      signal: new AbortController().signal,
    });

    const task = useAppStore.getState().agentTasks[0];
    expect(task.metrics).toMatchObject({ inputTokens: 12, outputTokens: 4, policyAllowed: 1 });
    expect(task.steps[0].toolCall?.canvasCheckpoint).toEqual({
      historyIndexBefore: 0,
      historyIndexAfter: 1,
      revisionBefore: 0,
      revisionAfter: 1,
    });
    expect(task.events?.map((event) => event.type)).toContain('canvas_checkpoint');
    expect(lifecycleTypes).toEqual(expect.arrayContaining([
      'model.round',
      'policy.decision',
      'tool.execution',
    ]));
    unsubscribe();
  });

});
