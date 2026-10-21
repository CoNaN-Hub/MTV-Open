/**
 * `media_generate` 的**真实阶段**子步骤（`AgentToolContext.reportStep`）。
 *
 * 官方那几行在官方是服务端分别发出的独立 `tool_event`（见 `toolRegistry.AgentToolSubStepInput` 的
 * 官方偏移），客户端只按 `content.tool` 分桶渲染 ⇒ **官方未建模「工具内部子步骤」**，
 * 这里验证的是 MTV 等价表达必须遵守的边界：
 *   · 只在**真正走到了那个阶段**时才上报（校验失败 → 一条都不上报）；
 *   · 文案里的比例/尺寸/主体来自**真实解析结果**，不是常量；
 *   · 提交阶段以真实结果收尾（成功 / 失败）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runMediaGeneration = vi.fn();

vi.mock('../../../src/services/ai/generationRuntime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/ai/generationRuntime')>();
  return { ...actual, runMediaGeneration: (...args: unknown[]) => runMediaGeneration(...args) };
});

const { useAppStore } = await import('../../../src/store/useAppStore');
const { registerMediaAgentTools } = await import('../../../src/services/chat/tools/mediaTools');
const { clearAgentToolRegistryForTests, prepareAgentToolCall } = await import('../../../src/services/chat/toolRegistry');
type AgentToolContext = import('../../../src/services/chat/toolRegistry').AgentToolContext;
type AgentToolSubStepInput = import('../../../src/services/chat/toolRegistry').AgentToolSubStepInput;

const context: Omit<AgentToolContext, 'signal'> = {
  taskId: 'task-media',
  projectId: 'project-1',
  conversationId: 'conversation-1',
  mode: 'collaborative',
};

/** 假的子步骤句柄簿记：记录每次上报与收尾。 */
function makeReporter() {
  const calls: Array<{ input: AgentToolSubStepInput; finishes: Array<[string, string | undefined]> }> = [];
  const reporter = (input: AgentToolSubStepInput) => {
    const record = { input, finishes: [] as Array<[string, string | undefined]> };
    calls.push(record);
    return {
      stepId: `sub-${calls.length}`,
      finish(status: string = 'succeeded', outputSummary?: string) {
        record.finishes.push([status, outputSummary]);
      },
    };
  };
  return { calls, reporter };
}

function setupStore(): void {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    currentProjectId: 'project-1',
    messages: [{
      id: 'assistant-1',
      conversationId: 'conversation-1',
      role: 'assistant',
      content: '',
      timestamp: 1,
      status: 'executing',
      agentTaskId: 'task-media',
    }],
    projects: [{ id: 'project-1', name: '测试项目', createdAt: 1, updatedAt: 1, settings: {} }],
    config: {
      ...useAppStore.getState().config,
      providers: { custom: { name: '自定义', apiKey: 'secret', baseUrl: 'https://example.com' } },
      generalModels: [
        { id: 'image-a', name: '通用图片', modelId: 'image-a', category: 'image', providerConfigId: 'custom' },
      ],
    },
  } as never);
}

/** 取出已注册的 `media_generate` 定义（与执行器同一条 prepare 路径）。 */
function preparedFor(input: Record<string, unknown>) {
  const prepared = prepareAgentToolCall(
    { callId: 'call-media-1', toolId: 'media_generate', input: { deliveryMode: 'chat', ...input } },
    context,
  );
  if (!prepared.ok) throw new Error(`prepareAgentToolCall failed: ${prepared.result.summary}`);
  return prepared.prepared;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAgentToolRegistryForTests();
  setupStore();
  registerMediaAgentTools();
  runMediaGeneration.mockResolvedValue({
    id: 'artifact-1',
    kind: 'image',
    provider: 'general',
    modelId: 'image-a',
    persistence: 'saved',
    deliveryMode: 'chat',
  });
});

describe('media_generate：一个工具调用 → 三条真实阶段步骤', () => {
  it('① 三条步骤按真实顺序上报，文案带真实比例与主体', async () => {
    const prepared = preparedFor({
      kind: 'image',
      prompt: '两只非洲象，恰好两只，置身非洲稀树草原。',
      title: '两只非洲象',
      modelRef: 'general/image-a',
      aspectRatio: '9:16',
    });
    const { calls, reporter } = makeReporter();
    const result = await prepared.definition.execute(
      { ...context, signal: new AbortController().signal, reportStep: reporter },
      prepared.input,
    );

    expect(result.status).toBe('success');
    expect(calls.map((call) => call.input.title)).toEqual([
      '确认当前可用的图像生成选项',
      '确认9:16画面与尺寸选项',
      '提交9:16两只非洲象图像生成',
    ]);
    /* 三条都以真实结果收尾（成功态）。 */
    expect(calls.map((call) => call.finishes[0][0])).toEqual(['succeeded', 'succeeded', 'succeeded']);
    /* 模型名来自目录解析，不是入参原文以外的编造。 */
    expect(calls[0].input.inputSummary).toContain('通用图片');
    expect(runMediaGeneration).toHaveBeenCalledTimes(1);
  });

  it('② 生成失败时**提交**那一步以 failed 收尾，前两步保持 succeeded', async () => {
    runMediaGeneration.mockRejectedValueOnce(new Error('供应商返回 500'));
    const prepared = preparedFor({
      kind: 'image',
      prompt: '两只非洲象',
      title: '两只非洲象',
      modelRef: 'general/image-a',
      aspectRatio: '9:16',
    });
    const { calls, reporter } = makeReporter();
    const result = await prepared.definition.execute(
      { ...context, signal: new AbortController().signal, reportStep: reporter },
      prepared.input,
    );

    expect(result.status).toBe('error');
    expect(calls).toHaveLength(3);
    expect(calls[2].finishes).toEqual([['failed', '供应商返回 500']]);
    expect(calls[0].finishes[0][0]).toBe('succeeded');
  });

  it('③ 校验阶段就失败（参考节点不存在）⇒ 一条子步骤都不上报', async () => {
    useAppStore.setState({ nodes: [] } as never);
    const prepared = preparedFor({
      kind: 'image',
      prompt: '把 @{n-missing:首帧} 换掉',
      title: '两只非洲象',
      modelRef: 'general/image-a',
      aspectRatio: '9:16',
    });
    const { calls, reporter } = makeReporter();
    const result = await prepared.definition.execute(
      { ...context, signal: new AbortController().signal, reportStep: reporter },
      prepared.input,
    );

    expect(result.status).toBe('error');
    expect(calls).toEqual([]);
    expect(runMediaGeneration).not.toHaveBeenCalled();
  });

  it('④ 未注入 `reportStep` 时照常执行（工具不得假设它存在）', async () => {
    const prepared = preparedFor({
      kind: 'image',
      prompt: '两只非洲象',
      title: '两只非洲象',
      modelRef: 'general/image-a',
      aspectRatio: '9:16',
    });
    const result = await prepared.definition.execute(
      { ...context, signal: new AbortController().signal },
      prepared.input,
    );
    expect(result.status).toBe('success');
    expect(runMediaGeneration).toHaveBeenCalledTimes(1);
  });
});
