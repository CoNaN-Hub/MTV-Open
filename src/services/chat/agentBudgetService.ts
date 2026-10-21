/**
 * Agent 任务的终身成本上限。
 *
 * budget.maxModelRounds / maxToolCalls 只约束单次执行段，本模块在其之上提供
 * 跨全部执行段累计的硬上限（轮次、工具调用、token），由 executeAgentRound（每轮前）执行。
 */
import {
  DEFAULT_AGENT_TASK_BUDGET,
  type AgentTask,
  type AgentTaskBudget,
  type AgentTaskLifetimeBudget,
} from '../../types/agent';

export const AGENT_LIFETIME_BUDGET_ERROR_CODE = 'AGENT_LIFETIME_BUDGET_EXHAUSTED';

export interface AgentLifetimeBudgetStatus {
  exceeded: boolean;
  errorCode?: string;
  message?: string;
}

/** 读取任务的终身上限；旧记录缺省字段时回退到默认值。 */
export function resolveAgentLifetimeBudget(
  budget?: Partial<AgentTaskBudget>,
): AgentTaskLifetimeBudget {
  return {
    maxTotalModelRounds: budget?.maxTotalModelRounds ?? DEFAULT_AGENT_TASK_BUDGET.maxTotalModelRounds,
    maxTotalToolCalls: budget?.maxTotalToolCalls ?? DEFAULT_AGENT_TASK_BUDGET.maxTotalToolCalls,
    maxTotalTokens: budget?.maxTotalTokens ?? DEFAULT_AGENT_TASK_BUDGET.maxTotalTokens,
  };
}

/** 任务累计消耗的 token（input + output），跨全部执行段。 */
export function totalAgentTaskTokens(task: AgentTask): number {
  return (task.metrics?.inputTokens ?? 0) + (task.metrics?.outputTokens ?? 0);
}

function exhausted(message: string): AgentLifetimeBudgetStatus {
  return { exceeded: true, errorCode: AGENT_LIFETIME_BUDGET_ERROR_CODE, message };
}

/**
 * 累计用量是否已耗尽终身上限。
 * 执行中每轮复核。
 */
export function evaluateAgentLifetimeUsage(task: AgentTask): AgentLifetimeBudgetStatus {
  const limits = resolveAgentLifetimeBudget(task.budget);
  if (task.modelRounds >= limits.maxTotalModelRounds) {
    return exhausted(`任务累计模型轮次已达上限（${limits.maxTotalModelRounds} 轮），请基于当前结果新建任务`);
  }
  if (task.toolCallCount >= limits.maxTotalToolCalls) {
    return exhausted(`任务累计工具调用已达上限（${limits.maxTotalToolCalls} 次），请基于当前结果新建任务`);
  }
  const tokens = totalAgentTaskTokens(task);
  if (tokens >= limits.maxTotalTokens) {
    return exhausted(`任务累计 token 已达上限（${limits.maxTotalTokens.toLocaleString()}），请基于当前结果新建任务`);
  }
  return { exceeded: false };
}

/** 父任务与其全部子任务共用的 token 预算倍率。 */
export const AGENT_GROUP_TOKEN_MULTIPLIER = 2;

/**
 * 任务组累计用量：父任务与其全部子任务的 token 之和。
 *
 * 子智能体可并行派出多个，各自有独立的单任务预算，只靠单任务上限无法约束总开销，
 * 因此派出新子任务前必须先过这一层。
 */
export function evaluateAgentGroupUsage(
  parentTask: AgentTask,
  childTasks: AgentTask[],
): AgentLifetimeBudgetStatus {
  const limits = resolveAgentLifetimeBudget(parentTask.budget);
  const groupLimit = limits.maxTotalTokens * AGENT_GROUP_TOKEN_MULTIPLIER;
  const tokens = totalAgentTaskTokens(parentTask)
    + childTasks.reduce((sum, task) => sum + totalAgentTaskTokens(task), 0);
  if (tokens >= groupLimit) {
    return exhausted(
      `本任务与其子智能体累计 token 已达上限（${groupLimit.toLocaleString()}），请基于当前结果新建任务`,
    );
  }
  return { exceeded: false };
}
