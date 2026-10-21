/**
 * 管理 AgentTask 状态机、运行时取消控制器和审批 Promise，统一约束任务状态迁移。
 */
import { useAppStore } from '../../store/useAppStore';
import {
  AGENT_TERMINAL_STATUSES,
  type AgentApprovalResolution,
  type AgentTask,
  type AgentTaskStatus,
} from '../../types/agent';
import {
  cancelConversationAgentExecutions,
} from './agentScheduler';
import { appendAgentEvent } from './agentJournal';
import { emitAgentLifecycleEvent } from './agentLifecycle';

export type AgentExecutionOutcome =
  | 'completed'
  | 'failed'
  | 'waiting_approval';
export type AgentTaskExecutor = (signal: AbortSignal) => Promise<AgentExecutionOutcome>;

const activeControllers = new Map<string, AbortController>();
const pendingApprovalResolvers = new Map<
  string,
  (resolution: AgentApprovalResolution) => void
>();

const ALLOWED_TRANSITIONS: Record<AgentTaskStatus, ReadonlySet<AgentTaskStatus>> = {
  queued: new Set(['planning', 'failed', 'stopped']),
  planning: new Set([
    'running',
    'waiting_tool',
    'waiting_approval',
    'completed',
    'failed',
    'stopped',
  ]),
  running: new Set([
    'planning',
    'waiting_tool',
    'waiting_approval',
    'completed',
    'failed',
    'stopped',
  ]),
  waiting_tool: new Set(['running', 'planning', 'failed', 'stopped']),
  waiting_approval: new Set(['running', 'planning', 'failed', 'stopped']),
  completed: new Set(),
  failed: new Set(['queued', 'planning', 'stopped']),
  stopped: new Set(['queued']),
};

export class InvalidAgentTaskTransitionError extends Error {
  readonly code = 'AGENT_INVALID_TRANSITION';

  constructor(from: AgentTaskStatus, to: AgentTaskStatus) {
    super(`不允许 Agent 任务从 ${from} 迁移到 ${to}`);
    this.name = 'InvalidAgentTaskTransitionError';
  }
}

export function transitionAgentTask(
  taskId: string,
  nextStatus: AgentTaskStatus,
  partial: Partial<AgentTask> = {},
): AgentTask {
  const store = useAppStore.getState();
  const task = store.agentTasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error(`未找到 Agent 任务: ${taskId}`);
  }
  if (task.status !== nextStatus && !ALLOWED_TRANSITIONS[task.status].has(nextStatus)) {
    throw new InvalidAgentTaskTransitionError(task.status, nextStatus);
  }

  const now = Date.now();
  const nextTask: AgentTask = {
    ...task,
    ...partial,
    id: task.id,
    status: nextStatus,
    updatedAt: now,
    startedAt: partial.startedAt ?? task.startedAt ?? (
      nextStatus === 'planning' ? now : undefined
    ),
    completedAt: nextStatus === 'completed' ? now : partial.completedAt ?? task.completedAt,
  };
  store.upsertAgentTask(nextTask);
  if (task.status !== nextStatus) {
    appendAgentEvent(taskId, 'task_status', { status: nextStatus });
    emitAgentLifecycleEvent({
      type: 'task.status',
      taskId,
      projectId: nextTask.projectId,
      conversationId: nextTask.conversationId,
      status: nextStatus,
    });
  }
  return nextTask;
}

export async function runAgentTask(
  taskId: string,
  executor: AgentTaskExecutor,
): Promise<AgentTask> {
  const previous = activeControllers.get(taskId);
  previous?.abort();

  const controller = new AbortController();
  activeControllers.set(taskId, controller);

  try {
    transitionAgentTask(taskId, 'planning', {
      errorCode: undefined,
      errorMessage: undefined,
    });
    transitionAgentTask(taskId, 'running');

    const outcome = await executor(controller.signal);
    const current = useAppStore.getState().agentTasks.find((task) => task.id === taskId);
    if (!current) {
      throw new Error(`Agent 任务在执行期间被删除: ${taskId}`);
    }
    if (activeControllers.get(taskId) !== controller) return current;
    if (AGENT_TERMINAL_STATUSES.has(current.status)) return current;

    return transitionAgentTask(taskId, outcome, outcome === 'failed'
      ? { errorCode: 'AGENT_EXECUTION_FAILED' }
      : {});
  } catch (error) {
    const current = useAppStore.getState().agentTasks.find((task) => task.id === taskId);
    if (!current) throw error;
    if (activeControllers.get(taskId) !== controller) return current;
    if (current.status === 'stopped') return current;

    const aborted = controller.signal.aborted;
    return transitionAgentTask(taskId, aborted ? 'stopped' : 'failed', {
      errorCode: aborted ? 'AGENT_STOPPED' : 'AGENT_RUNTIME_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Agent 任务执行失败',
    });
  } finally {
    if (activeControllers.get(taskId) === controller) {
      activeControllers.delete(taskId);
    }
  }
}

export function stopAgentTask(taskId: string): AgentTask {
  activeControllers.get(taskId)?.abort();
  return transitionAgentTask(taskId, 'stopped', {
    errorCode: 'AGENT_STOPPED',
  });
}

export function stopConversationAgentTasks(conversationId: string): void {
  cancelConversationAgentExecutions(conversationId);
  const tasks = useAppStore.getState().agentTasks.filter(
    (task) => task.conversationId === conversationId
      && !AGENT_TERMINAL_STATUSES.has(task.status),
  );
  for (const task of tasks) {
    activeControllers.get(task.id)?.abort();
    try {
      transitionAgentTask(task.id, 'stopped', {
        errorCode: 'AGENT_STOPPED',
      });
    } catch {
      /* 非法迁移（如已终态）忽略 */
    }
  }
}

export function stopProjectAgentTasks(projectId: string): void {
  const tasks = useAppStore.getState().agentTasks.filter(
    (task) => task.projectId === projectId
      && !AGENT_TERMINAL_STATUSES.has(task.status),
  );
  for (const conversationId of new Set(tasks.map((task) => task.conversationId))) {
    cancelConversationAgentExecutions(conversationId);
  }
  for (const task of tasks) {
    activeControllers.get(task.id)?.abort();
    try {
      transitionAgentTask(task.id, 'stopped', {
        errorCode: 'AGENT_STOPPED',
      });
    } catch {
      /* 非法迁移（如已终态）忽略 */
    }
  }
}

export function resolveAgentApproval(
  approvalId: string,
  resolution: AgentApprovalResolution,
): boolean {
  const resolver = pendingApprovalResolvers.get(approvalId);
  if (!resolver) return false;
  const store = useAppStore.getState();
  const task = store.agentTasks.find((item) =>
    item.steps.some((step) => step.approval?.id === approvalId),
  );
  if (
    !task
    || store.activeConversationId !== task.conversationId
    || store.currentProjectId !== task.projectId
  ) {
    return false;
  }
  resolver(resolution);
  return true;
}

export function waitForAgentApproval(
  approvalId: string,
  signal: AbortSignal,
): Promise<AgentApprovalResolution> {
  return new Promise<AgentApprovalResolution>((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener('abort', handleAbort);
      pendingApprovalResolvers.delete(approvalId);
    };
    const handleAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    pendingApprovalResolvers.set(approvalId, (resolution) => {
      cleanup();
      resolve(resolution);
    });
    signal.addEventListener('abort', handleAbort, { once: true });
    if (signal.aborted) handleAbort();
  });
}
