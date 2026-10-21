/**
 * commandRegistry · cancelTask 终态回归
 *
 * 背景：自然语言「取消/停止」曾只 abort `activeRequestAbort`（流式控制器）。
 * Agent 任务池的 AbortController 不会因此中止 ⇒ runAgentTask 的 catch 看不到
 * signal.aborted，任务被记成 failed / AGENT_RUNTIME_ERROR，而不是 stopped。
 * 该用例锁住「必须走任务控制器」这一条。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentTask } from '../../../src/types/agent';
import type { CommandPlan } from '../../../src/types/chat';
import { executeCommand } from '../../../src/services/chat/commandRegistry';
import { useAppStore } from '../../../src/store/useAppStore';

function createTask(id: string, conversationId: string, status: AgentTask['status']): AgentTask {
  return {
    id,
    projectId: 'project-1',
    conversationId,
    userMessageId: `message-${id}`,
    mode: 'autonomous',
    goal: 'goal',
    status,
    steps: [],
    modelRounds: 0,
    toolCallCount: 0,
    budget: {
      maxModelRounds: 12,
      maxToolCalls: 24,
      maxParallelReadTools: 3,
      maxReadRetries: 3,
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

function cancelPlan(baseRevision: number): CommandPlan {
  return {
    id: 'plan-cancel',
    projectId: 'project-1',
    baseRevision,
    commandId: 'cancelTask',
    targetNodeIds: [],
    params: undefined,
    summary: '取消当前任务',
    risk: 'read',
    requiresConfirm: false,
  };
}

describe('commandRegistry · cancelTask', () => {
  beforeEach(() => {
    useAppStore.setState({
      agentTasks: [],
      activeConversationId: 'conv-1',
      activeRequestAbort: null,
    });
  });

  it('把活动会话未终止的 Agent 任务落成 stopped，而不是 failed', async () => {
    useAppStore.setState({ agentTasks: [createTask('task-1', 'conv-1', 'running')] });

    const result = await executeCommand(
      cancelPlan(useAppStore.getState().getCurrentRevision()),
    );

    expect(result.status).toBe('success');
    const task = useAppStore.getState().agentTasks[0];
    expect(task?.status).toBe('stopped');
    expect(task?.errorCode).toBe('AGENT_STOPPED');
  });

  it('只停当前会话：其他会话的任务不受影响', async () => {
    useAppStore.setState({
      agentTasks: [
        createTask('task-1', 'conv-1', 'running'),
        createTask('task-2', 'conv-2', 'running'),
      ],
    });

    await executeCommand(cancelPlan(useAppStore.getState().getCurrentRevision()));

    const tasks = useAppStore.getState().agentTasks;
    expect(tasks.find((item) => item.id === 'task-1')?.status).toBe('stopped');
    expect(tasks.find((item) => item.id === 'task-2')?.status).toBe('running');
  });

  it('同时中止遗留的流式控制器并清空句柄', async () => {
    const abort = vi.fn();
    useAppStore.setState({ activeRequestAbort: { abort } as unknown as AbortController });

    await executeCommand(cancelPlan(useAppStore.getState().getCurrentRevision()));

    expect(abort).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().activeRequestAbort).toBeNull();
  });
});
