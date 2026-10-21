import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AGENT_TASK_BUDGET,
  DEFAULT_AGENT_TASK_METRICS,
  type AgentTask,
  type AgentTaskBudget,
} from '../../../src/types/agent';
import {
  evaluateAgentLifetimeUsage,
  resolveAgentLifetimeBudget,
  totalAgentTaskTokens,
} from '../../../src/services/chat/agentBudgetService';

function createTask(partial: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    userMessageId: 'message-1',
    mode: 'autonomous',
    goal: 'build the storyboard',
    status: 'running',
    steps: [],
    modelRounds: 0,
    toolCallCount: 0,
    budget: { ...DEFAULT_AGENT_TASK_BUDGET },
    metrics: { ...DEFAULT_AGENT_TASK_METRICS },
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

describe('agent lifetime budget', () => {
  it('falls back to defaults for tasks persisted without lifetime limits', () => {
    const legacyBudget: AgentTaskBudget = {
      maxModelRounds: 12,
      maxToolCalls: 24,
      maxParallelReadTools: 3,
      maxReadRetries: 3,
    };

    expect(resolveAgentLifetimeBudget(legacyBudget)).toEqual({
      maxTotalModelRounds: DEFAULT_AGENT_TASK_BUDGET.maxTotalModelRounds,
      maxTotalToolCalls: DEFAULT_AGENT_TASK_BUDGET.maxTotalToolCalls,
      maxTotalTokens: DEFAULT_AGENT_TASK_BUDGET.maxTotalTokens,
    });
    expect(evaluateAgentLifetimeUsage(createTask({ budget: legacyBudget })).exceeded).toBe(false);
  });

  it('sums input and output tokens across every execution segment', () => {
    const task = createTask({
      metrics: { ...DEFAULT_AGENT_TASK_METRICS, inputTokens: 900, outputTokens: 100 },
    });
    expect(totalAgentTaskTokens(task)).toBe(1000);
  });

  it('stops the task once cumulative rounds, tool calls or tokens hit the lifetime cap', () => {
    expect(evaluateAgentLifetimeUsage(createTask({
      modelRounds: DEFAULT_AGENT_TASK_BUDGET.maxTotalModelRounds,
    }))).toMatchObject({ exceeded: true, errorCode: 'AGENT_LIFETIME_BUDGET_EXHAUSTED' });

    expect(evaluateAgentLifetimeUsage(createTask({
      toolCallCount: DEFAULT_AGENT_TASK_BUDGET.maxTotalToolCalls,
    }))).toMatchObject({ exceeded: true, errorCode: 'AGENT_LIFETIME_BUDGET_EXHAUSTED' });

    expect(evaluateAgentLifetimeUsage(createTask({
      metrics: {
        ...DEFAULT_AGENT_TASK_METRICS,
        inputTokens: DEFAULT_AGENT_TASK_BUDGET.maxTotalTokens,
        outputTokens: 1,
      },
    }))).toMatchObject({ exceeded: true, errorCode: 'AGENT_LIFETIME_BUDGET_EXHAUSTED' });
  });

});
