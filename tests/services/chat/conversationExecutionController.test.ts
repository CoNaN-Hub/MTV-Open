import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentScheduleResult, ConversationAgentExecution } from '../../../src/services/chat/agentScheduler';

const schedulerMocks = vi.hoisted(() => {
  // 记录已入队的任务，让 isAgentExecutionScheduled 能反映真实调度器的去重行为
  const scheduledTaskIds = new Set<string>();
  return {
    activeTaskId: undefined as string | undefined,
    scheduledTaskIds,
    schedule: vi.fn((execution: { taskId: string }): AgentScheduleResult => {
      scheduledTaskIds.add(execution.taskId);
      return { state: 'started', position: 0 };
    }),
    isScheduled: vi.fn((taskId: string) => scheduledTaskIds.has(taskId)),
  };
});

vi.mock('../../../src/services/chat/agentScheduler', () => ({
  getActiveConversationAgentTaskId: () => schedulerMocks.activeTaskId,
  scheduleConversationAgentExecution: schedulerMocks.schedule,
  isAgentExecutionScheduled: schedulerMocks.isScheduled,
}));

vi.mock('../../../src/services/chat/tools', () => ({
  ensureAgentToolsRegistered: vi.fn(),
}));

import {
  submitConversationMessage,
} from '../../../src/services/chat/conversationExecutionController';
import { useAppStore } from '../../../src/store/useAppStore';

function arrangeConversation(): void {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    currentProjectId: 'project-1',
    activeConversationId: 'conversation-1',
    conversations: [{
      id: 'conversation-1',
      projectId: 'project-1',
      title: 'Controller test',
      titleSource: 'auto',
      pinned: false,
      archived: false,
      agentMode: 'collaborative',
      createdAt: 1,
      updatedAt: 1,
      messageCount: 0,
    }],
    messages: [],
    agentTasks: [],
  });
}

beforeEach(() => {
  arrangeConversation();
  schedulerMocks.activeTaskId = undefined;
  schedulerMocks.scheduledTaskIds.clear();
  schedulerMocks.schedule.mockReset();
  schedulerMocks.schedule.mockImplementation((execution: { taskId: string }) => {
    schedulerMocks.scheduledTaskIds.add(execution.taskId);
    return { state: 'started', position: 0 };
  });
  schedulerMocks.isScheduled.mockReset();
  schedulerMocks.isScheduled.mockImplementation(
    (taskId: string) => schedulerMocks.scheduledTaskIds.has(taskId),
  );
});

describe('conversation execution controller', () => {
  it.each([
    { body: 'data: [DONE]\n\n', contentType: 'text/event-stream', status: 'failed', messageStatus: 'error', text: '未返回' },
    { body: 'data: {"error":{"message":"Provider unavailable"}}\n\n', contentType: 'text/event-stream', status: 'failed', messageStatus: 'error', text: 'Provider unavailable' },
    { body: '{"choices":[{"message":{"content":"已收到你的要求"},"finish_reason":"stop"}]}', contentType: 'application/json', status: 'completed', messageStatus: 'done', text: '已收到你的要求' },
    { body: 'data:{"choices":[{"delta":{"content":"已收到你的要求"},"finish_reason":"stop"}]}\n\n', contentType: 'text/event-stream', status: 'completed', messageStatus: 'done', text: '已收到你的要求' },
  ])('keeps a visible final message for $body', async ({ body, contentType, status, messageStatus, text }) => {
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        assistantModelId: 'reply-test',
        providers: { ...state.config.providers, reply: { name: 'Reply test', baseUrl: 'https://example.invalid/v1', apiKey: 'test-only' } },
        generalModels: [{ id: 'reply-test', name: 'Reply test', category: 'text', providerConfigId: 'reply', modelId: 'reply-model' }],
      },
      conversations: state.conversations.map((conversation) => ({ ...conversation, agentMode: 'autonomous' as const })),
    }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': contentType } }));
    vi.stubGlobal('fetch', fetchMock);
    let execution: ConversationAgentExecution | undefined;
    schedulerMocks.schedule.mockImplementation((scheduled) => {
      execution = scheduled as ConversationAgentExecution;
      return { state: 'started', position: 0 };
    });
    const result = submitConversationMessage({ content: '你好', conversationId: 'conversation-1' });
    if (result.status !== 'started') throw new Error('Expected a scheduled assistant reply');
    expect(execution).toBeDefined();
    execution!.onStart?.();
    await execution!.run();
    const state = useAppStore.getState();
    expect(state.agentTasks.find((task) => task.id === result.taskId)?.status).toBe(status);
    const finalMessage = state.messages.find((message) => message.id === result.assistantMessageId);
    expect(finalMessage).toMatchObject({ status: messageStatus });
    /* ✅ 官方收口（覆盖表 §91）：报错文案**不再**写进正文 `content`（官方从不这么做，也不加前缀），
       而是落官方 `agent_error` item 的文案位 `agentError` ⇒ 由唯一的 `AgentErrorBanner` 呈现。
       ⚠️ 本用例的原意「最后的消息必须是**可见**的」仍然成立：可见性改由横幅承担。 */
    if (messageStatus === 'error') {
      expect(finalMessage?.agentError).toEqual(expect.stringContaining(text));
      expect(finalMessage?.content ?? '').not.toContain(text);
    } else {
      expect(finalMessage?.content).toEqual(expect.stringContaining(text));
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('creates the message pair and schedules one Agent task', () => {
    const result = submitConversationMessage({
      content: '  update the canvas  ',
      conversationId: 'conversation-1',
    });

    expect(result.status).toBe('started');
    const state = useAppStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }))).toEqual([
      { role: 'user', content: 'update the canvas' },
      { role: 'assistant', content: '' },
    ]);
    expect(state.agentTasks).toHaveLength(1);
    expect(state.messages[1].agentTaskId).toBe(state.agentTasks[0].id);
    expect(schedulerMocks.schedule).toHaveBeenCalledWith(expect.objectContaining({
      taskId: state.agentTasks[0].id,
      conversationId: 'conversation-1',
    }));
  });

  it('captures explicit Skill content and tool restrictions when the task is created', () => {
    useAppStore.setState({
      userSkills: [{
        id: 'skill-1',
        name: 'Canvas audit',
        description: 'Audit the canvas',
        fileName: 'SKILL.md',
        content: '---\nname: Canvas audit\n---\n\n# Fixed audit rules',
        sourceType: 'file',
        manifest: {
          version: '2.0.0',
          allowedTools: ['canvas_get_state'],
        },
        createdAt: 1,
      }],
    });

    submitConversationMessage({
      content: '检查当前项目 @skill{skill-1|Canvas audit}',
      conversationId: 'conversation-1',
    });

    const task = useAppStore.getState().agentTasks[0];
    expect(task.skillBindings).toEqual([{
      skillId: 'skill-1',
      name: 'Canvas audit',
      version: '2.0.0',
      content: '# Fixed audit rules',
      origin: 'user',
      allowedTools: ['canvas_get_state'],
    }]);
    expect(task.toolAllowlist).toEqual(['canvas_get_state']);
  });

  it('snapshots an explicitly selected AgentPackage Skill before the package is disabled', () => {
    useAppStore.setState({
      agentPackageSkills: [{
        id: 'ap-skill-1',
        name: '短剧分镜',
        description: '生成短剧分镜',
        fileName: 'SKILL.md',
        content: '---\nversion: 1.4.1\n---\n# 固定分镜规则',
        sourceType: 'agent-package',
        manifest: { version: '1.4.1', allowedTools: ['canvas_get_state'] },
        createdAt: 2,
        installationId: 'installation-1',
        packageId: 'legacy.drama',
        packageName: 'AI短剧知识库',
        packageVersion: '0.0.0-legacy',
        packageContentHash: 'a'.repeat(64),
        sourceId: 'source:opaque',
        entryPath: '04-分镜设计/storyboard-script/SKILL.md',
        skillRoot: '04-分镜设计/storyboard-script',
        contentHash: 'b'.repeat(64),
        branch: 'domestic',
        packageUserInvocable: true,
        packageAutoInvoke: false,
        mcpSkillReadEnabled: false,
        readOnly: true,
      }],
    });

    submitConversationMessage({
      content: '生成分镜 @skill{ap-skill-1|短剧分镜}',
      conversationId: 'conversation-1',
    });

    const task = useAppStore.getState().agentTasks[0];
    expect(task.skillBindings).toEqual([expect.objectContaining({
      skillId: 'ap-skill-1',
      content: '# 固定分镜规则',
      origin: 'agent-package',
      packageName: 'AI短剧知识库',
      entryPath: '04-分镜设计/storyboard-script/SKILL.md',
      contentHash: 'b'.repeat(64),
    })]);
    useAppStore.setState({ agentPackageSkills: [] });
    expect(task.skillBindings?.[0].content).toBe('# 固定分镜规则');
  });

  it('rejects more explicit Skills than can be represented by the task snapshot', () => {
    useAppStore.setState({
      userSkills: Array.from({ length: 5 }, (_, index) => ({
        id: `skill-${index + 1}`,
        name: `Skill ${index + 1}`,
        description: 'Test skill',
        fileName: 'SKILL.md',
        content: `# Skill ${index + 1}`,
        sourceType: 'file' as const,
        createdAt: index + 1,
      })),
    });
    const refs = useAppStore.getState().userSkills
      .map((item) => `@skill{${item.id}|${item.name}}`)
      .join(' ');

    const result = submitConversationMessage({
      content: `检查画布 ${refs}`,
      conversationId: 'conversation-1',
    });

    expect(result).toMatchObject({ status: 'started', taskId: undefined });
    expect(useAppStore.getState().agentTasks).toHaveLength(0);
    /* ✅ 官方收口（覆盖表 §91）：报错文案**只**落 `agentError`（渲染层据此装配官方 `agent_error`
       item ⇒ 唯一的 `AgentErrorBanner`），**不再**写进正文 `content`，也**不再**带 MTV 自造的
       「处理失败: 」前缀（官方产物里没有这种前缀）。 */
    expect(useAppStore.getState().messages.at(-1)).toMatchObject({
      role: 'assistant',
      status: 'error',
      content: '',
      agentError: '单个任务最多注入 4 个 Skill',
    });
  });
});
