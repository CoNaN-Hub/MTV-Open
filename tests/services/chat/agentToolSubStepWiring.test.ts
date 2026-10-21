/**
 * 执行器 → 工具的**子步骤通道**接线（`agentRoundExecutor.executePreparedToolCall` 注入 `reportStep`）。
 *
 * 这条路是「一个 `media_generate` 回合产出多条官方步骤行」的唯一入口：
 * 工具自己拿不到 `appendStep`（步骤 id / index / 时间戳 / 脱敏都在执行器侧），
 * 所以必须由执行器注入。这个测试用一个假工具走**真实执行链**
 * （`executeRegisteredAgentToolCall` → `executePreparedToolCall` → `definition.execute`），
 * 钉住「注入确实发生、步骤确实落到任务上、且与父步骤的 callId 不同（官方 `oie` 去重不吞）」。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentTask } from '../../../src/types/agent';
import { executeRegisteredAgentToolCall } from '../../../src/services/chat/agentToolExecution';
import {
  clearAgentToolRegistryForTests,
  registerAgentTool,
  type AgentToolContext,
} from '../../../src/services/chat/toolRegistry';
import { transitionAgentTask, waitForAgentApproval } from '../../../src/services/chat/agentTaskControl';
import { dedupeToolItems } from '../../../src/services/chat/agentToolLabels';
import { stepToToolEvent } from '../../../src/services/chat/agentActivityItems';
import { useAppStore } from '../../../src/store/useAppStore';

function createTask(): AgentTask {
  return {
    id: 'substep-task-1',
    projectId: 'project-1',
    conversationId: 'substep-conversation',
    userMessageId: 'message-1',
    mode: 'autonomous',
    goal: '生成2只非洲象 9:16尺寸',
    status: 'queued',
    steps: [],
    modelRounds: 0,
    toolCallCount: 0,
    budget: {
      maxModelRounds: 1,
      maxToolCalls: 1,
      maxParallelReadTools: 1,
      maxReadRetries: 0,
    },
    createdAt: 1,
    updatedAt: 1,
  } as AgentTask;
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    currentProjectId: 'project-1',
    activeConversationId: 'substep-conversation',
    conversations: [{
      id: 'substep-conversation',
      projectId: 'project-1',
      title: '子步骤',
      titleSource: 'user',
      pinned: false,
      archived: false,
      agentMode: 'autonomous',
      createdAt: 1,
      updatedAt: 1,
      messageCount: 0,
    }],
    agentTasks: [createTask()],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  clearAgentToolRegistryForTests();
});

describe('执行器注入 reportStep', () => {
  it('工具在 execute 里上报 ⇒ 真实步骤落到任务上，且与父步骤 callId 不同', async () => {
    const seen: AgentToolContext[] = [];
    registerAgentTool({
      id: 'substep_probe',
      title: '子步骤探针',
      description: '子步骤探针',
      effect: 'read',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async (context) => {
        seen.push(context);
        expect(typeof context.reportStep).toBe('function');
        const step = context.reportStep!({ title: '确认当前可用的图像生成选项' });
        expect(step.stepId).toBeTruthy();
        step.finish('succeeded', '已确认');
        return { status: 'success' as const, summary: 'done', modelContent: 'done' };
      },
    });

    await executeRegisteredAgentToolCall({
      taskId: 'substep-task-1',
      call: { callId: 'substep-call', toolId: 'substep_probe', input: {} },
      signal: new AbortController().signal,
      transitionTask: transitionAgentTask,
      waitForApproval: waitForAgentApproval,
    });

    const steps = useAppStore.getState().agentTasks.find((task) => task.id === 'substep-task-1')!.steps;
    expect(steps).toHaveLength(2);
    /* 父步骤 + 子步骤：两者都在、状态各自真实。 */
    expect(steps[0].toolCall?.callId).toBe('substep-call');
    expect(steps[0].status).toBe('succeeded');
    expect(steps[1].title).toBe('确认当前可用的图像生成选项');
    expect(steps[1].status).toBe('succeeded');
    expect(steps[1].toolCall?.callId).not.toBe('substep-call');
    /* 官方 `oie` 去重后仍是两条 ⇒ 两条都会出现在同一折叠节的明细列表里。 */
    expect(dedupeToolItems(steps.map(stepToToolEvent))).toHaveLength(2);
    expect(seen).toHaveLength(1);
  });

  it('工具不调用 reportStep ⇒ 任务里只有父步骤（不凭空多出步骤）', async () => {
    registerAgentTool({
      id: 'substep_silent',
      title: '静默工具',
      description: '静默工具',
      effect: 'read',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => ({ status: 'success' as const, summary: 'done', modelContent: 'done' }),
    });

    await executeRegisteredAgentToolCall({
      taskId: 'substep-task-1',
      call: { callId: 'silent-call', toolId: 'substep_silent', input: {} },
      signal: new AbortController().signal,
      transitionTask: transitionAgentTask,
      waitForApproval: waitForAgentApproval,
    });

    const steps = useAppStore.getState().agentTasks.find((task) => task.id === 'substep-task-1')!.steps;
    expect(steps).toHaveLength(1);
  });
});
