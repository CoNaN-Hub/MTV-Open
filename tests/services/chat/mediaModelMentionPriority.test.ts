/**
 * 第 86 轮复现 + 回归：`@model{…}` 提及与「项目默认模型」的优先级。
 *
 * 现象（第 79 轮登记、本轮修）：项目**已经设了该类型默认模型**时，用户在消息里写
 * `@model{X}`，`media_generate` 会被整次拒绝（连生成确认卡都不出）——
 * `resolveMediaToolInput` 先把项目默认模型填进 `input.modelRef`，
 * `authorize` 再拿它跟 `extractModelMention(task.goal)` 比对 ⇒ 两者不同 ⇒ deny。
 *
 * 本文件用**真 registry + 真 `prepareAgentToolCall` + 真 Policy + 真 store**跑同一条路径
 * （`agentRoundExecutor` 里就是 `prepareAgentToolCall` → `evaluateAgentToolPolicy`，
 * 见 `src/services/chat/agentRoundExecutor.ts:1135` / `:1153`）。
 *
 * ⚠️ `@model` 是 **MTV 自有语法**（官方产物 `indexOf('@model') === -1`，官方无对应物）
 * ⇒ 本条**没有官方可抄**，判据是**用户显式意图优先**：用户明确写了 `@model` 就用它，
 * 不该被项目默认值抢先、更不该因此拒绝整次调用。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareApprovalInput } from '../../../src/services/chat/agentRoundExecutor';
import { evaluateAgentToolPolicy } from '../../../src/services/chat/policyEngine';
import {
  clearAgentToolRegistryForTests,
  prepareAgentToolCall,
} from '../../../src/services/chat/toolRegistry';
import { registerMediaAgentTools } from '../../../src/services/chat/tools/mediaTools';
import { useAppStore } from '../../../src/store/useAppStore';
import type { AgentToolContext } from '../../../src/services/chat/toolRegistry';

const TASK_ID = 'task-mention';

type ToolContext = Omit<AgentToolContext, 'signal'>;

function context(mode: 'autonomous' | 'collaborative' = 'collaborative'): ToolContext {
  return {
    taskId: TASK_ID,
    projectId: 'project-1',
    conversationId: 'conversation-1',
    mode,
  };
}

/** 真实 store 种子：一个带 API Key 的连接 + 两个真实可解析的图片模型。 */
function seedStore(defaultImageModel: string | undefined) {
  useAppStore.setState((state) => ({
    config: {
      ...state.config,
      providers: {
        ...state.config.providers,
        audit: { name: 'Audit', baseUrl: 'https://example.invalid', apiKey: 'test-only-key' },
      },
      generalModels: [
        { id: 'audit-image', name: 'Default', modelId: 'media-a', category: 'image', providerConfigId: 'audit' },
        { id: 'audit-style', name: 'Style', description: 'cinematic', modelId: 'media-b', category: 'image', providerConfigId: 'audit' },
        { id: 'audit-photo', name: 'Photo', modelId: 'media-c', category: 'image', providerConfigId: 'audit' },
      ],
    },
    projects: [{
      id: 'project-1', name: 'Audit', createdAt: 1, updatedAt: 1,
      settings: { defaultModels: defaultImageModel ? { image: defaultImageModel } : {} },
    }],
    currentProjectId: 'project-1',
    activeConversationId: 'conversation-1',
    conversations: [{
      id: 'conversation-1',
      projectId: 'project-1',
      title: 'Mention test',
      titleSource: 'auto',
      pinned: false,
      archived: false,
      agentMode: 'collaborative',
      createdAt: 1,
      updatedAt: 1,
      messageCount: 0,
    }],
    agentTasks: [{
      id: TASK_ID,
      projectId: 'project-1',
      conversationId: 'conversation-1',
      userMessageId: 'message-1',
      mode: 'collaborative',
      goal: '生成一张图',
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
    }],
  }));
}

function setGoal(goal: string) {
  const task = useAppStore.getState().agentTasks[0];
  useAppStore.getState().upsertAgentTask({ ...task, goal });
}

/** 走一次真实的「准备 → 审批输入 → Policy」三步，与 `agentRoundExecutor` 的顺序一致。 */
function runPipeline(
  input: Record<string, unknown>,
  mode: 'autonomous' | 'collaborative' = 'collaborative',
) {
  const ctx = context(mode);
  const prepared = prepareAgentToolCall(
    { callId: 'media-call', toolId: 'media_generate', input },
    ctx,
  );
  if (!prepared.ok) throw new Error(`准备阶段失败：${prepared.result.summary}`);
  const approval = prepareApprovalInput(
    prepared.prepared,
    useAppStore.getState().agentTasks[0]!.goal,
    mode,
    ctx.projectId,
  );
  const policy = evaluateAgentToolPolicy(approval.prepared.definition, approval.prepared.input, ctx);
  const inputRequest = approval.inputRequest?.kind === 'media_model' ? approval.inputRequest : undefined;
  return {
    effectiveModelRef: (approval.prepared.input as { modelRef?: string }).modelRef,
    hasCard: inputRequest !== undefined,
    cardModelName: inputRequest?.generationRequest?.modelName,
    policy,
  };
}

const IMAGE_CALL = { kind: 'image', prompt: 'a cat', deliveryMode: 'chat' };

beforeEach(() => {
  clearAgentToolRegistryForTests();
  useAppStore.setState(useAppStore.getInitialState(), true);
  registerMediaAgentTools();
});

afterEach(() => {
  clearAgentToolRegistryForTests();
});

describe('media_generate 的 @model 提及优先级', () => {
  it('① 项目有图片默认模型 + 消息带 @model{ X } ⇒ 用 X，且不被拒绝（确认卡上就是 X）', () => {
    seedStore('general/audit-image');
    setGoal('Generate @model{general/audit-style|Style}');
    const { effectiveModelRef, hasCard, cardModelName, policy } = runPipeline(IMAGE_CALL);
    expect(effectiveModelRef).toBe('general/audit-style');
    expect(policy.outcome).toBe('require_approval');
    expect(hasCard).toBe(true);
    expect(cardModelName).toBe('general/audit-style');
  });

  it('② 项目有图片默认模型 + 无提及 ⇒ 仍用项目默认模型（行为不变）', () => {
    seedStore('general/audit-image');
    setGoal('生成一张图');
    /* 协作模式下没提及 ⇒ 审批输入里**故意摘掉** `modelRef`，让用户在卡上选
       （`agentRoundExecutor.prepareApprovalInput` 第 777-791 行那条注释）⇒
       这里断言的是**卡片载荷里的项目默认模型**（与真实请求同源），不是 `prepared.input`。 */
    const { cardModelName, hasCard, policy } = runPipeline(IMAGE_CALL);
    expect(policy.outcome).toBe('require_approval');
    expect(hasCard).toBe(true);
    expect(cardModelName).toBe('general/audit-image');
  });

  it('③ 提及 X + 显式 modelRef: Y 冲突 ⇒ 维持原有拒绝语义', () => {
    /** 两个形状都钉：Y 恰好等于项目默认模型（`agentRoundExecutor.test.ts:472` 那条的形状，
     *  有歧义），以及 Y 既不是默认也不是提及（无歧义）—— 两条都必须拒。 */
    seedStore('general/audit-image');
    setGoal('Generate @model{general/audit-style|Style}');
    const ambiguous = runPipeline({ ...IMAGE_CALL, modelRef: 'general/audit-image' });
    expect(ambiguous.effectiveModelRef).toBe('general/audit-image');
    expect(ambiguous.policy.outcome).toBe('deny');
    expect(ambiguous.policy.outcome === 'deny' && ambiguous.policy.reason).toContain('@model');
    const unambiguous = runPipeline({ ...IMAGE_CALL, modelRef: 'general/audit-photo' });
    expect(unambiguous.effectiveModelRef).toBe('general/audit-photo');
    expect(unambiguous.policy.outcome).toBe('deny');
    expect(unambiguous.policy.outcome === 'deny' && unambiguous.policy.reason).toContain('@model');
  });

  it('④ 无项目默认模型 + 提及 ⇒ 用提及的 X', () => {
    seedStore(undefined);
    setGoal('Generate @model{general/audit-style|Style}');
    /* 这一条在修复前**就已经是绿的**：没有项目默认模型 ⇒ 解析器不填 `modelRef`，
       `prepareApprovalInput` 第 762-763 行那条 `if (mentionedModelRef && !input.modelRef)`
       才轮到生效。修复后解析器直接给出提及 ⇒ 两条通道口径一致（原来是「只有没默认时才轮到提及」，
       这正是缺口的一半）。 */
    const { effectiveModelRef, cardModelName, policy } = runPipeline(IMAGE_CALL);
    expect(effectiveModelRef).toBe('general/audit-style');
    expect(policy.outcome).toBe('require_approval');
    expect(cardModelName).toBe('general/audit-style');
  });

  it('⑤ 自主模式自动路由不得覆盖用户提及（提及 > 按提示词自动路由 > 项目默认）', () => {
    seedStore('general/audit-image');
    setGoal('Generate @model{general/audit-image|Default}');
    useAppStore.setState((state) => ({
      projects: state.projects.map((project) => ({
        ...project,
        settings: { ...project.settings, modelAutoRouting: true },
      })),
    }));
    /* 提示词里的 `cinematic` 正是 `general/audit-style` 的相关词 ⇒ 自动路由会挑中它。 */
    const { effectiveModelRef, policy } = runPipeline({ ...IMAGE_CALL, prompt: 'cinematic cat' }, 'autonomous');
    expect(effectiveModelRef).toBe('general/audit-image');
    expect(policy.outcome).toBe('allow');
  });
});
