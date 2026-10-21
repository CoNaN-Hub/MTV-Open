import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentApprovalResolution, AgentTask } from '../../../src/types/agent';
import type { ProposedToolCall, ToolResultSummary } from '../../../src/types/chat';

const streamAssistantReplyMock = vi.hoisted(() => vi.fn());
const executeGenerationMock = vi.hoisted(() => vi.fn(async () => ({ success: true })));

vi.mock('../../../src/services/generationService', () => ({ executeGeneration: executeGenerationMock }));

vi.mock('../../../src/services/ai/assistantStream', () => ({
  streamAssistantReply: streamAssistantReplyMock,
  /* 「看图」回灌那条路要读模型有没有视觉能力（`supportsVision`），见下面的像素回灌用例。 */
  resolveAssistantModel: vi.fn(() => ({ supportsVision: true })),
}));

vi.mock('../../../src/services/chat/contextManager', () => ({
  ContextBudgetError: class ContextBudgetError extends Error {
    readonly code = 'CONTEXT_ERROR';
  },
  assembleAgentContext: vi.fn(async () => ({
    messages: [{ role: 'user', content: 'update canvas' }],
    usage: {},
  })),
  estimateModelMessagesTokens: vi.fn(() => 1),
  resolveAssistantContextSpec: vi.fn(() => ({ inputBudget: 100_000 })),
}));

import { executeAgentRound, prepareApprovalInput, resolveApprovalSelection, type AgentRoundCallbacks } from '../../../src/services/chat/agentRoundExecutor';
import { transitionAgentTask } from '../../../src/services/chat/agentRuntime';
import { registerCanvasAgentTools } from '../../../src/services/chat/tools/canvasTools';
import { registerMediaAgentTools } from '../../../src/services/chat/tools/mediaTools';
import {
  clearAgentToolRegistryForTests,
  getAgentTool,
  registerAgentTool,
  prepareAgentToolCall,
} from '../../../src/services/chat/toolRegistry';
import { useAppStore } from '../../../src/store/useAppStore';
import { registerProviderConfigAgentTools } from '../../../src/services/chat/tools/providerConfigTools';
import { clearProviderModelCatalogsForTests, clearProviderModelCatalogsForTask, createProviderModelCatalog } from '../../../src/services/chat/providerModelCatalogService';

afterEach(() => { clearProviderModelCatalogsForTests(); vi.restoreAllMocks(); });

describe('provider approval round parity', () => {
  function arrangeSelection(catalog = false) {
    registerProviderConfigAgentTools();
    const options = Array.from({ length: catalog ? 1000 : 20 }, (_, index) => ({ id: `m-${index}`, name: `Model ${index}`, category: 'text' as const }));
    const input = catalog ? { catalogId: createProviderModelCatalog({ taskId: 'task-round', projectId: 'project-1', conversationId: 'conversation-1' }, options).catalogId } : { models: options };
    arrangeCalls([{ callId: 'choice', toolId: 'provider_models_select', input }]);
    return vi.spyOn(getAgentTool('provider_models_select')!, 'execute');
  }
  it.each([false, true])('returns only approved choices without media-only metadata (catalog %s)', async (catalog) => {
    const execute = arrangeSelection(catalog);
    const chosen = catalog ? 'm-999' : 'm-19';
    const onResult = vi.fn();
    await runRound(undefined, { onToolResult: onResult }, async () => ({ approved: true, inputValues: { selectedModelIds: [chosen] } }));
    expect(execute).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ selectedIds: [chosen] }));
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    expect(useAppStore.getState().agentTasks[0].steps[0].approval?.inputRequest).not.toHaveProperty('selectedModelRef');
  });
  it.each([[], ['fake'], ['m-0', 'm-0'], Array.from({ length: 17 }, (_, index) => `m-${index}`)].map((ids) => ({ ids })))('rejects invalid choices before execute: $ids', async ({ ids }) => {
    const execute = arrangeSelection();
    const onResult = vi.fn();
    await runRound(undefined, { onToolResult: onResult }, async () => ({ approved: true, inputValues: { selectedModelIds: ids } }));
    expect(execute).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'denied' }));
  });
  it('rejects expired catalogs before invoking the tool', async () => {
    const execute = arrangeSelection(true);
    const onResult = vi.fn();
    await runRound(undefined, { onToolResult: onResult }, async () => {
      clearProviderModelCatalogsForTask('task-round');
      return { approved: true, inputValues: { selectedModelIds: ['m-999'] } };
    });
    expect(execute).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ summary: expect.stringContaining('失效') }));
  });

  it.each([undefined, '', 42, { model: 'x' }])('rejects missing or malformed media selections: %j', (value) => {
    const execute = arrangeMedia();
    const context = { taskId: 'task-round', projectId: 'project-1', conversationId: 'conversation-1', mode: 'collaborative' as const };
    const call = { callId: 'media-choice', toolId: 'media_generate', input: { kind: 'image', prompt: 'a cat', deliveryMode: 'chat' } };
    const prepared = prepareAgentToolCall(call, context);
    if (!prepared.ok) throw new Error('media preparation failed');
    const approval = prepareApprovalInput(prepared.prepared, 'generate', 'collaborative');
    const selected = resolveApprovalSelection(call, approval.prepared, approval.inputRequest,
      { approved: true, inputValues: { modelRef: value } } as AgentApprovalResolution, context);
    expect(selected.error?.status).toBe('denied');
    expect(selected.error?.summary).toContain('必须选择');
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a registry definition replaced while the user was choosing', () => {
    registerProviderConfigAgentTools();
    const context = { taskId: 'task-round', projectId: 'project-1', conversationId: 'conversation-1', mode: 'autonomous' as const };
    const call = { callId: 'changed', toolId: 'provider_models_select', input: { models: [{ id: 'm', name: 'M', category: 'text' }] } };
    const result = prepareAgentToolCall(call, context);
    if (!result.ok) throw new Error('provider preparation failed');
    const approval = prepareApprovalInput(result.prepared, 'select');
    clearAgentToolRegistryForTests();
    registerProviderConfigAgentTools();
    const selected = resolveApprovalSelection(call, approval.prepared, approval.inputRequest,
      { approved: true, inputValues: { selectedModelIds: ['m'] } }, context);
    expect(selected.error?.summary).toContain('工具定义已变化');
  });
});

function createTask(): AgentTask {
  return {
    id: 'task-round',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    userMessageId: 'message-1',
    mode: 'autonomous',
    goal: 'update canvas',
    status: 'queued',
    steps: [],
    modelRounds: 0,
    toolCallCount: 0,
    budget: {
      maxModelRounds: 4,
      maxToolCalls: 4,
      maxParallelReadTools: 1,
      maxReadRetries: 3,
    },
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
      id: 'conversation-1',
      projectId: 'project-1',
      title: 'Round test',
      titleSource: 'auto',
      pinned: false,
      archived: false,
      agentMode: 'autonomous',
      createdAt: 1,
      updatedAt: 1,
      messageCount: 0,
    }],
    agentTasks: [createTask()],
  });
  streamAssistantReplyMock.mockReset();
  executeGenerationMock.mockClear();
});

function arrangeCanvas() {
  useAppStore.setState({
    nodes: ['a', 'b'].map((id, index) => ({
      id,
      type: 'ai-text',
      position: { x: index * 400, y: 0 },
      data: { type: 'ai-text', label: id, status: 'idle', prompt: 'initial', role: 'generator' },
    })),
    edges: [],
  });
  registerCanvasAgentTools();
}

function arrangeCalls(calls: ProposedToolCall[], duringStream?: () => void) {
  streamAssistantReplyMock.mockImplementation(async ({ onEvent }) => {
    duringStream?.();
    calls.forEach((call) => onEvent({ type: 'tool.call.final', call }));
  });
}

function runRound(
  controller = new AbortController(),
  callbacks: AgentRoundCallbacks = {},
  waitForApproval: () => Promise<AgentApprovalResolution> = async () => ({ approved: true }),
) {
  return executeAgentRound({
    taskId: 'task-round',
    signal: controller.signal,
    messages: [{ role: 'user', content: 'update canvas' }],
    fullText: '',
    totalToolResultChars: 0,
    callbacks,
    transitionTask: transitionAgentTask,
    waitForApproval,
  });
}

function arrangeRead(beforeReturn: () => void) {
  registerAgentTool({
    id: 'round_read_boundary',
    title: 'Read boundary',
    description: 'Read boundary',
    effect: 'read',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => {
      beforeReturn();
      return { status: 'success', summary: 'read complete', modelContent: 'read complete' };
    },
  });
}

function nodePrompt(id: string) {
  return useAppStore.getState().nodes.find((node) => node.id === id)?.data.prompt;
}

function arrangeMedia(kind: 'image' | 'video' | 'audio' = 'image') {
  registerMediaAgentTools();
  useAppStore.setState((state) => ({
    config: {
      ...state.config,
      providers: { ...state.config.providers, audit: { name: 'Audit', baseUrl: 'https://example.invalid', apiKey: 'test-only-key' } },
      generalModels: [
        { id: `audit-${kind}`, name: 'Default', modelId: 'media-a', category: kind, providerConfigId: 'audit' },
        { id: 'audit-style', name: 'Style', description: 'cinematic', modelId: 'media-b', category: kind, providerConfigId: 'audit' },
      ],
    },
    projects: [{
      id: 'project-1', name: 'Audit', createdAt: 1, updatedAt: 1,
      settings: { defaultModels: { [kind]: `general/audit-${kind}` } },
    }],
  }));
  // 复用真实 schema、默认值解析和 authorize，只替换最终付费调用。
  return vi.spyOn(getAgentTool('media_generate')!, 'execute').mockResolvedValue({
    status: 'success', summary: 'generated', modelContent: 'generated',
  });
}

describe('agent round executor', () => {
  it('does not execute queued writes after a task is stopped during a read', async () => {
    arrangeCanvas();
    const controller = new AbortController();
    arrangeRead(() => {
      controller.abort();
      transitionAgentTask('task-round', 'stopped');
    });
    arrangeCalls([
      { callId: 'read-stop', toolId: 'round_read_boundary', input: {} },
      { callId: 'write-after-stop', toolId: 'canvas_update_nodes', input: { nodeIds: ['b'], prompt: 'too late' } },
    ]);

    await expect(runRound(controller)).rejects.toMatchObject({ name: 'AbortError' });
    expect(nodePrompt('b')).toBe('initial');
    expect(useAppStore.getState().agentTasks[0].status).toBe('stopped');
  });

  it('checks task state even when its caller has not aborted the signal', async () => {
    arrangeCanvas();
    arrangeRead(() => transitionAgentTask('task-round', 'failed'));
    arrangeCalls([
      { callId: 'read-stop-state', toolId: 'round_read_boundary', input: {} },
      { callId: 'write-after-stop-state', toolId: 'canvas_update_nodes', input: { nodeIds: ['b'], prompt: 'too late' } },
    ]);
    await expect(runRound()).rejects.toMatchObject({ name: 'AbortError' });
    expect(nodePrompt('b')).toBe('initial');
  });

  it('rechecks a read-only switch before executing queued writes', async () => {
    arrangeCanvas();
    arrangeRead(() => useAppStore.getState().upsertAgentTask({
      ...useAppStore.getState().agentTasks[0]!,
      readOnly: true,
    }));
    arrangeCalls([
      { callId: 'read-mode', toolId: 'round_read_boundary', input: {} },
      { callId: 'write-mode', toolId: 'canvas_update_nodes', input: { nodeIds: ['b'], prompt: 'not authorized' } },
    ]);
    const results: ToolResultSummary[] = [];
    await runRound(undefined, { onToolResult: (result) => results.push(result) });
    expect(nodePrompt('b')).toBe('initial');
    expect(results.at(-1)?.status).toBe('denied');
  });

  it('rejects the entire stale write batch without overwriting a user edit', async () => {
    arrangeCanvas();
    arrangeCalls([
      { callId: 'stale-a', toolId: 'canvas_update_nodes', input: { nodeIds: ['a'], prompt: 'stale A' } },
      { callId: 'stale-b', toolId: 'canvas_update_nodes', input: { nodeIds: ['b'], prompt: 'stale B' } },
    ], () => {
      useAppStore.getState().updateNodesDataBatch(['b'], { prompt: 'user B' });
      useAppStore.getState().incrementRevision();
    });
    await runRound();
    expect(nodePrompt('a')).toBe('initial');
    expect(nodePrompt('b')).toBe('user B');
    expect(useAppStore.getState().agentTasks[0].steps.map((step) => step.status))
      .toEqual(['failed', 'failed']);
  });

  it('does not absorb an edit made after one write returns into the next write baseline', async () => {
    arrangeCanvas();
    arrangeCalls([
      { callId: 'write-a', toolId: 'canvas_update_nodes', input: { nodeIds: ['a'], prompt: 'agent A' } },
      { callId: 'write-b', toolId: 'canvas_update_nodes', input: { nodeIds: ['b'], prompt: 'stale B' } },
    ]);
    await runRound(undefined, { onToolResult: (result) => {
      if (result.callId === 'write-a') {
        useAppStore.getState().updateNodesDataBatch(['b'], { prompt: 'user B' });
        useAppStore.getState().incrementRevision();
      }
    } });
    expect(nodePrompt('a')).toBe('agent A');
    expect(nodePrompt('b')).toBe('user B');
  });

  it('cancels dependent writes after a preceding write fails without automatically retrying it', async () => {
    arrangeCanvas();
    const execute = vi.fn(async () => ({ status: 'error' as const, retryable: true, summary: 'write failed', modelContent: 'write failed' }));
    registerAgentTool({
      id: 'failed_write', title: 'Failed write', description: 'Failed write', effect: 'canvas_write',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute,
    });
    arrangeCalls([
      { callId: 'fail', toolId: 'failed_write', input: {} },
      { callId: 'dependent', toolId: 'canvas_update_nodes', input: { nodeIds: ['b'], prompt: 'depends on failed write' } },
    ]);
    await runRound();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(nodePrompt('b')).toBe('initial');
    expect(useAppStore.getState().agentTasks[0].steps.at(-1)?.errorCode).toBe('AGENT_WRITE_BATCH_ABORTED');
  });

  it('does not treat external canvas changes during a successful file operation as its own writes', async () => {
    arrangeCanvas();
    registerAgentTool({
      id: 'file_wait', title: 'File wait', description: 'File wait', effect: 'file_write',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => {
        useAppStore.getState().updateNodesDataBatch(['b'], { prompt: 'user B' });
        useAppStore.getState().incrementRevision();
        return { status: 'success', summary: 'file saved', modelContent: 'file saved' };
      },
    });
    arrangeCalls([
      { callId: 'file', toolId: 'file_wait', input: {} },
      { callId: 'stale-after-file', toolId: 'canvas_update_nodes', input: { nodeIds: ['b'], prompt: 'stale' } },
    ]);
    await runRound();
    expect(nodePrompt('b')).toBe('user B');
  });

  it('does not start the model for an already stopped task', async () => {
    transitionAgentTask('task-round', 'stopped');
    await expect(runRound()).rejects.toMatchObject({ name: 'AbortError' });
    expect(streamAssistantReplyMock).not.toHaveBeenCalled();
  });

  it('does not report a late model response as completed after cancellation', async () => {
    const controller = new AbortController();
    arrangeCalls([], () => controller.abort());
    const onComplete = vi.fn();
    await expect(runRound(controller, { onComplete })).rejects.toMatchObject({ name: 'AbortError' });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('really regenerates the same node after its prompt changes within the task', async () => {
    arrangeCanvas();
    arrangeCalls([{ callId: 'generate-1', toolId: 'canvas_run_nodes', input: { nodeIds: ['b'] } }]);
    await runRound();
    arrangeCalls([{ callId: 'change-prompt', toolId: 'canvas_update_nodes', input: { nodeIds: ['b'], prompt: 'new prompt' } }]);
    await runRound();
    arrangeCalls([{ callId: 'generate-2', toolId: 'canvas_run_nodes', input: { nodeIds: ['b'] } }]);
    await runRound();
    expect(executeGenerationMock).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().agentTasks[0].steps.at(-1)?.outputSummary).not.toContain('复用');
  });

  it('distinguishes replay of one generation request from a new request with identical parameters', async () => {
    arrangeCanvas();
    arrangeCalls([{ callId: 'generation-original', toolId: 'canvas_run_nodes', input: { nodeIds: ['b'] } }]);
    await runRound();
    await runRound();
    expect(executeGenerationMock).toHaveBeenCalledTimes(1);
    arrangeCalls([{ callId: 'generation-new', toolId: 'canvas_run_nodes', input: { nodeIds: ['b'] } }]);
    await runRound();
    expect(executeGenerationMock).toHaveBeenCalledTimes(2);
  });

  it('allows two intentional relative moves with identical parameters', async () => {
    arrangeCanvas();
    arrangeCalls([{ callId: 'move-1', toolId: 'canvas_update_nodes', input: { nodeIds: ['b'], dx: 40 } }]);
    await runRound();
    arrangeCalls([{ callId: 'move-2', toolId: 'canvas_update_nodes', input: { nodeIds: ['b'], dx: 40 } }]);
    await runRound();
    expect(useAppStore.getState().nodes.find((node) => node.id === 'b')?.position.x).toBe(480);
  });

  it.each(['image', 'video', 'audio'] as const)('preserves a valid project default %s model in autonomous mode', async (kind) => {
    const execute = arrangeMedia(kind);
    arrangeCalls([{
      callId: 'media-default', toolId: 'media_generate',
      input: { kind, prompt: 'a cat', deliveryMode: 'chat', ...(kind === 'audio' ? { audioPurpose: 'music' } : {}) },
    }]);
    await runRound();
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ mode: 'autonomous' }), expect.objectContaining({ modelRef: `general/audit-${kind}` }));
  });

  it('preserves the actual autonomous model-routing result', async () => {
    const execute = arrangeMedia();
    useAppStore.setState((state) => ({
      projects: state.projects.map((project) => ({ ...project, settings: { ...project.settings, modelAutoRouting: true } })),
    }));
    arrangeCalls([{ callId: 'media-route', toolId: 'media_generate', input: { kind: 'image', prompt: 'cinematic', deliveryMode: 'chat' } }]);
    await runRound();
    expect(execute).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ modelRef: 'general/audit-style' }));
  });

  it('still requires the user to choose a media model in collaborative mode', async () => {
    const execute = arrangeMedia();
    useAppStore.getState().updateConversation('conversation-1', { agentMode: 'collaborative' });
    arrangeCalls([{ callId: 'media-approval', toolId: 'media_generate', input: { kind: 'image', prompt: 'a cat', deliveryMode: 'chat' } }]);
    const waitForApproval = vi.fn(async () => ({ approved: true, inputValues: { modelRef: 'general/audit-style' } }));
    const onApprovalRequired = vi.fn();
    await runRound(undefined, { onApprovalRequired }, waitForApproval);
    expect(onApprovalRequired).toHaveBeenCalledWith(expect.objectContaining({
      approval: expect.objectContaining({
        inputRequest: expect.objectContaining({
          kind: 'media_model',
          mediaKind: 'image',
          /* 第 59 轮：审批同时带上生成确认卡的**真实参数**（官方 wire 名，来自工具入参）。
             第 65 轮：`modelName` 改成**与真实请求同一个解析器**（显式 `modelRef` ?? 项目默认模型）——
             协作模式下 agent 没指定模型 ⇒ 卡片必须显示这次请求真正会用的那个项目默认模型
             （官方读侧 `Sse` 读 `request_json.model_name`，卡上显示的本来就是「已指派的模型」）。 */
          generationRequest: expect.objectContaining({
            kind: 'image',
            prompt: 'a cat',
            modelName: 'general/audit-image',
          }),
        }),
      }),
    }));
    expect(waitForApproval).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ mode: 'collaborative' }), expect.objectContaining({ modelRef: 'general/audit-style' }));
  });

  it('omits model_name when neither an explicit model nor a project default exists', async () => {
    const execute = arrangeMedia();
    /* 项目没有任何图像默认模型（真实项目里很常见，例如 `去脏去噪工作流` 只设了文本默认模型）。 */
    useAppStore.setState((state) => ({
      projects: state.projects.map((project) => ({ ...project, settings: { defaultModels: {} } })),
    }));
    useAppStore.getState().updateConversation('conversation-1', { agentMode: 'collaborative' });
    arrangeCalls([{ callId: 'media-no-model', toolId: 'media_generate', input: { kind: 'image', prompt: 'a cat', deliveryMode: 'chat' } }]);
    const waitForApproval = vi.fn(async () => ({ approved: true, inputValues: { modelRef: 'general/audit-style' } }));
    const onApprovalRequired = vi.fn();
    await runRound(undefined, { onApprovalRequired }, waitForApproval);
    const approval = onApprovalRequired.mock.calls[0]?.[0]?.approval as {
      inputRequest?: { generationRequest?: Record<string, unknown> };
    } | undefined;
    const generationRequest = approval?.inputRequest?.generationRequest;
    expect(generationRequest).toBeTruthy();
    /* 解析不出模型 ⇒ **不写该字段**（卡片不显示模型 chip 与价格），绝不补默认值。 */
    expect(generationRequest && 'modelName' in generationRequest).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does not replace an unavailable default model with an arbitrary model', async () => {
    const execute = arrangeMedia();
    useAppStore.setState((state) => ({ projects: state.projects.map((project) => ({
      ...project, settings: { defaultModels: { image: 'general/missing' } },
    })) }));
    arrangeCalls([{ callId: 'media-missing', toolId: 'media_generate', input: { kind: 'image', prompt: 'a cat', deliveryMode: 'chat' } }]);
    const onToolResult = vi.fn();
    await runRound(undefined, { onToolResult });
    expect(execute).not.toHaveBeenCalled();
    expect(onToolResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'denied' }));
  });

  it('rejects a model that conflicts with the explicit model mention', async () => {
    const execute = arrangeMedia();
    useAppStore.getState().updateAgentTask('task-round', { goal: 'Generate @model{general/audit-style|Style}' });
    arrangeCalls([{
      callId: 'media-mismatch', toolId: 'media_generate',
      input: { kind: 'image', prompt: 'a cat', deliveryMode: 'chat', modelRef: 'general/audit-image' },
    }]);
    await runRound();
    expect(execute).not.toHaveBeenCalled();
  });

  it('回灌「看图」像素：工具顶层交出的 `modelImages` 会作为 `image_url` 内容块进下一轮上下文', async () => {
    /* 🚨 第 65 轮修的真 bug 的回归：像素在 `AgentToolExecutionResult.modelImages`（顶层），
       而执行器构造 `ExecutedToolCall` 时**丢了它**、回灌点又去 `summary.modelImages` 里找
       （`ToolResultSummary` 根本没有该字段）⇒ `visionImages` 恒空 ⇒ 模型只能看到 JSON 元数据。 */
    registerAgentTool({
      id: 'round_view_pixels',
      title: 'View pixels',
      description: 'View pixels',
      effect: 'read',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => ({
        status: 'success',
        summary: '已查看 1 项内容',
        modelContent: '{"images":[{"ref":"node/n1"}]}',
        modelImages: [{ url: 'data:image/png;base64,AAAA', label: '测试画面' }],
      }),
    });
    arrangeCalls([{ callId: 'pixels', toolId: 'round_view_pixels', input: {} } as never]);
    await runRound();

    /* `streamAssistantReply` 收到的是**同一个** messages 数组引用，回灌发生在其后 ⇒ 直接查它。 */
    const sent = streamAssistantReplyMock.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: unknown }>;
    };
    const lastUser = [...sent.messages].reverse().find((message) => message.role === 'user');
    expect(lastUser).toBeTruthy();
    expect(Array.isArray(lastUser!.content)).toBe(true);
    const blocks = lastUser!.content as Array<{ type: string; image_url?: { url: string } }>;
    expect(blocks.some((block) => block.type === 'image_url'
      && block.image_url?.url === 'data:image/png;base64,AAAA')).toBe(true);
  });

  it('runs one model round and returns a terminal response without owning the loop', async () => {
    streamAssistantReplyMock.mockImplementation(async ({ onEvent }) => {
      onEvent({ type: 'text.delta', delta: 'round complete' });
      onEvent({ type: 'usage', inputTokens: 7, outputTokens: 3 });
    });
    const onComplete = vi.fn();

    const result = await executeAgentRound({
      taskId: 'task-round',
      signal: new AbortController().signal,
      messages: [{ role: 'user', content: 'update canvas' }],
      fullText: '',
      totalToolResultChars: 0,
      callbacks: { onComplete },
      transitionTask: transitionAgentTask,
      waitForApproval: vi.fn(),
    });

    expect(result).toEqual({
      outcome: 'completed',
      fullText: 'round complete',
      totalToolResultChars: 0,
    });
    expect(onComplete).toHaveBeenCalledWith('round complete');
    expect(useAppStore.getState().agentTasks[0]).toMatchObject({
      status: 'planning',
      modelRounds: 1,
      metrics: { inputTokens: 7, outputTokens: 3 },
    });
  });

  it('persists the same structured displays for model-proposed tools', async () => {
    registerAgentTool<{ nodeId: string }>({
      id: 'round_display_test',
      title: 'Round display',
      description: 'Round display',
      effect: 'read',
      inputSchema: {
        type: 'object',
        required: ['nodeId'],
        additionalProperties: false,
        properties: { nodeId: { type: 'string', minLength: 1 } },
      },
      buildInputDisplay: (input) => ({
        fields: [{ label: '节点', value: input.nodeId }],
      }),
      execute: async () => ({
        status: 'success',
        summary: 'done',
        modelContent: 'done',
        display: { fields: [{ label: '状态', value: '完成' }] },
      }),
    });
    streamAssistantReplyMock.mockImplementation(async ({ onEvent }) => {
      onEvent({
        type: 'tool.call.final',
        call: {
          callId: 'call-round-display',
          toolId: 'round_display_test',
          input: { nodeId: 'node-1' },
        },
      });
    });

    const result = await executeAgentRound({
      taskId: 'task-round',
      signal: new AbortController().signal,
      messages: [{ role: 'user', content: 'update canvas' }],
      fullText: '',
      totalToolResultChars: 0,
      callbacks: {},
      transitionTask: transitionAgentTask,
      waitForApproval: vi.fn(),
    });

    expect(result.outcome).toBe('continue');
    expect(useAppStore.getState().agentTasks[0].steps[0].toolCall).toMatchObject({
      inputDisplay: { fields: [{ label: '节点', value: 'node-1' }] },
      resultDisplay: { fields: [{ label: '状态', value: '完成' }] },
    });
  });

  it('advances the write baseline so later writes in one round are not self-invalidated', async () => {
    const seen: Array<{ base?: number; current: number }> = [];
    registerAgentTool<{ index: number }>({
      id: 'round_write_test',
      title: 'Round write',
      description: 'Round write',
      effect: 'canvas_write',
      inputSchema: {
        type: 'object',
        required: ['index'],
        additionalProperties: false,
        properties: { index: { type: 'integer' } },
      },
      execute: async (context) => {
        seen.push({
          base: context.baseRevision,
          current: useAppStore.getState().getCurrentRevision(),
        });
        useAppStore.getState().incrementRevision();
        return { status: 'success', summary: 'done', modelContent: 'done' };
      },
    });
    streamAssistantReplyMock.mockImplementation(async ({ onEvent }) => {
      onEvent({
        type: 'tool.call.final',
        call: { callId: 'call-write-1', toolId: 'round_write_test', input: { index: 1 } },
      });
      onEvent({
        type: 'tool.call.final',
        call: { callId: 'call-write-2', toolId: 'round_write_test', input: { index: 2 } },
      });
    });

    await executeAgentRound({
      taskId: 'task-round',
      signal: new AbortController().signal,
      messages: [{ role: 'user', content: 'update canvas' }],
      fullText: '',
      totalToolResultChars: 0,
      callbacks: {},
      transitionTask: transitionAgentTask,
      waitForApproval: vi.fn(async () => ({ approved: true })),
    });

    expect(seen).toHaveLength(2);
    for (const entry of seen) expect(entry.base).toBe(entry.current);
    expect(seen[1].current).toBe(seen[0].current + 1);
  });
});
