/**
 * 生成 Agent 工具输入指纹，为重复写入抑制提供依据。
 */
import type {
  AgentStep,
  AgentTask,
} from '../../types/agent';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function fingerprintToolInput(toolId: string, input: unknown): string {
  const source = `${toolId}:${JSON.stringify(stableValue(input))}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function findSucceededDuplicateWrite(
  task: AgentTask,
  toolId: string,
  inputFingerprint: string,
  context: {
    callId: string;
    excludeStepId?: string;
    projectId: string | null;
  },
): AgentStep | undefined {
  if (context.projectId !== task.projectId) return undefined;
  return task.steps.find((step) => {
    const call = step.toolCall;
    if (
      step.id === context.excludeStepId
      || step.status !== 'succeeded'
      || call?.toolId !== toolId
      || call.inputFingerprint !== inputFingerprint
      || !call.effect
      || call.effect === 'read'
    ) return false;

    // 同一个请求重放可以复用；参数相同但 callId 不同，是新的操作（尤其是重新生成）。
    return !!context.callId && call.callId === context.callId;
  });
}
