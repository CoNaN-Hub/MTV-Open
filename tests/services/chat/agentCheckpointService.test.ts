import { describe, expect, it } from 'vitest';
import type { AgentCanvasCheckpoint, AgentStep, AgentTask } from '../../../src/types/agent';
import {
  findSucceededDuplicateWrite,
  fingerprintToolInput,
} from '../../../src/services/chat/agentCheckpointService';

function step(index: number, checkpoint: AgentCanvasCheckpoint): AgentStep {
  return {
    id: `step-${index}`,
    taskId: 'task-1',
    index,
    kind: 'tool',
    title: 'Canvas write',
    status: 'succeeded',
    createdAt: index,
    updatedAt: index,
    toolCall: {
      callId: `call-${index}`,
      toolId: 'canvas_update_nodes',
      retryCount: 0,
      effect: 'canvas_write',
      inputFingerprint: 'fingerprint-1',
      canvasCheckpoint: checkpoint,
    },
  };
}

function task(steps: AgentStep[]): AgentTask {
  return {
    id: 'task-1', projectId: 'project-1', conversationId: 'conversation-1',
    userMessageId: 'message-1', mode: 'autonomous', goal: 'update', status: 'completed',
    steps, modelRounds: 1, toolCallCount: steps.length,
    budget: { maxModelRounds: 12, maxToolCalls: 24, maxParallelReadTools: 3, maxReadRetries: 3 },
    createdAt: 1, updatedAt: 1,
  };
}

const replayContext = {
  callId: 'new-call', projectId: 'project-1',
};

describe('agent canvas checkpoints', () => {
  it('creates the same fingerprint for semantically identical object key order', () => {
    expect(fingerprintToolInput('tool', { a: 1, b: { x: 2 } }))
      .toBe(fingerprintToolInput('tool', { b: { x: 2 }, a: 1 }));
  });

  it('does not equate a new operation with identical parameters but a different request identity', () => {
    const existing = step(0, { historyIndexBefore: 2, historyIndexAfter: 3, revisionBefore: 4, revisionAfter: 5 });
    expect(findSucceededDuplicateWrite(task([existing]), 'canvas_update_nodes', 'fingerprint-1', replayContext))
      .toBeUndefined();
  });

  it('still suppresses replay of the same succeeded request identity', () => {
    const existing = step(0, { historyIndexBefore: 2, historyIndexAfter: 3, revisionBefore: 4, revisionAfter: 5 });
    expect(findSucceededDuplicateWrite(task([existing]), 'canvas_update_nodes', 'fingerprint-1', {
      ...replayContext, callId: 'call-0',
    })).toBe(existing);
  });

  it.each([
    { projectId: 'project-2' },
    { excludeStepId: 'step-0' },
  ])('does not reuse an inapplicable checkpoint: %j', (override) => {
    const existing = step(0, { historyIndexBefore: 2, historyIndexAfter: 3, revisionBefore: 4, revisionAfter: 5 });
    expect(findSucceededDuplicateWrite(task([existing]), 'canvas_update_nodes', 'fingerprint-1', {
      ...replayContext, callId: 'call-0', ...override,
    })).toBeUndefined();
  });

  it('does not reuse a new media-generation request by matching its parameters', () => {
    const existing = step(0, { historyIndexBefore: 2, historyIndexAfter: 3, revisionBefore: 4, revisionAfter: 5 });
    existing.toolCall!.toolId = 'canvas_run_nodes';
    existing.toolCall!.effect = 'media_generation';
    expect(findSucceededDuplicateWrite(task([existing]), 'canvas_run_nodes', 'fingerprint-1', replayContext))
      .toBeUndefined();
  });
});
