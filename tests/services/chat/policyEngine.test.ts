import { describe, expect, it, vi } from 'vitest';
import {
  AGENT_TOGGLEABLE_EFFECTS,
  disabledAgentEffects,
  evaluateAgentToolPolicy,
  isAgentEffectDisabled,
} from '../../../src/services/chat/policyEngine';
import type {
  AgentToolDefinition,
  AgentToolEffect,
} from '../../../src/services/chat/toolRegistry';
import type { AgentMode } from '../../../src/types/agent';

function createTool(
  effect: AgentToolEffect,
  authorize?: AgentToolDefinition['authorize'],
): AgentToolDefinition {
  return {
    id: `test_${effect}`,
    title: effect,
    description: effect,
    effect,
    authorize,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: vi.fn(async () => ({
      status: 'success' as const,
      summary: 'ok',
      modelContent: 'ok',
    })),
  };
}

function context(mode: AgentMode, readOnly = false) {
  return {
    mode,
    readOnly,
    projectId: 'project-1',
    conversationId: 'conversation-1',
    taskId: 'task-1',
    baseRevision: 3,
  };
}

describe('evaluateAgentToolPolicy', () => {
  it.each<AgentMode>(['collaborative', 'autonomous'])(
    'allows read tools automatically in %s mode',
    (mode) => {
      expect(evaluateAgentToolPolicy(createTool('read'), {}, context(mode))).toMatchObject({
        outcome: 'allow',
      });
    },
  );

  it('requires approval for canvas writes in collaborative mode', () => {
    expect(
      evaluateAgentToolPolicy(createTool('canvas_write'), {}, context('collaborative')),
    ).toEqual(expect.objectContaining({
      outcome: 'require_approval',
      approvalKind: 'canvas_write',
    }));
  });

  it('allows canvas writes in autonomous mode', () => {
    expect(
      evaluateAgentToolPolicy(createTool('canvas_write'), {}, context('autonomous')),
    ).toMatchObject({ outcome: 'allow' });
  });

  it.each<Exclude<AgentToolEffect, 'read'>>([
    'canvas_write',
    'file_write',
    'permanent_delete',
    'media_generation',
    'memory_write',
    'config_write',
    'asset_write',
  ])('denies %s independently in a read-only task', (effect) => {
    expect(evaluateAgentToolPolicy(createTool(effect), {}, context('collaborative', true))).toEqual({
      outcome: 'deny',
      reason: '只读任务只允许使用只读工具',
      errorCode: 'AGENT_READ_ONLY_TOOL_DENIED',
    });
  });

  it.each<Exclude<AgentToolEffect, 'read'>>([
    'canvas_write',
    'file_write',
    'permanent_delete',
    'media_generation',
    'memory_write',
    'config_write',
    'asset_write',
  ])('allows %s automatically in autonomous mode', (effect) => {
    expect(evaluateAgentToolPolicy(createTool(effect), {}, context('autonomous')))
      .toMatchObject({ outcome: 'allow' });
  });

  it.each<Exclude<AgentToolEffect, 'read'>>([
    'canvas_write',
    'file_write',
    'permanent_delete',
    'media_generation',
    'memory_write',
    'config_write',
    'asset_write',
  ])('requires approval for %s in collaborative mode', (effect) => {
    expect(evaluateAgentToolPolicy(createTool(effect), {}, context('collaborative'))).toEqual(
      expect.objectContaining({
        outcome: 'require_approval',
        approvalKind: effect,
      }),
    );
  });

  it('denies unauthorized tools before applying mode permissions', () => {
    const tool = createTool('read', () => ({ allowed: false, reason: 'grant revoked' }));

    expect(evaluateAgentToolPolicy(tool, {}, context('autonomous'))).toEqual({
      outcome: 'deny',
      reason: 'grant revoked',
      errorCode: 'AGENT_TOOL_UNAUTHORIZED',
    });
  });
});

describe('权限页的能力开关（config.agentCapabilities）', () => {
  it('未下发配置时行为与开关之前完全一致', () => {
    expect(disabledAgentEffects(undefined)).toEqual([]);
    expect(disabledAgentEffects({})).toEqual([]);
    expect(disabledAgentEffects({ canvas_write: true })).toEqual([]);
    expect(disabledAgentEffects({ canvas_write: false, file_write: true })).toEqual(['canvas_write']);
  });

  it('只读与「需要你作答」不接受关闭', () => {
    expect(isAgentEffectDisabled('read', ['read'])).toBe(false);
    expect(isAgentEffectDisabled('user_choice', ['user_choice'])).toBe(false);
    expect(isAgentEffectDisabled('canvas_write', ['canvas_write'])).toBe(true);
  });

  it('只有七种可写能力在可拨列表里', () => {
    expect([...AGENT_TOGGLEABLE_EFFECTS]).toEqual([
      'canvas_write',
      'file_write',
      'permanent_delete',
      'media_generation',
      'memory_write',
      'config_write',
      'asset_write',
    ]);
  });

  it.each<AgentToolEffect>([
    'canvas_write',
    'file_write',
    'permanent_delete',
    'media_generation',
    'memory_write',
    'config_write',
    'asset_write',
  ])('关掉 %s 后在自主模式下也直接拒绝', (effect) => {
    const decision = evaluateAgentToolPolicy(createTool(effect), {}, {
      ...context('autonomous'),
      disabledEffects: [effect],
    });

    expect(decision).toMatchObject({ outcome: 'deny', errorCode: 'AGENT_CAPABILITY_DISABLED' });
    expect((decision as { reason: string }).reason).toContain('权限');
  });

  it('关掉画布写入不影响其它能力', () => {
    const disabled: AgentToolEffect[] = ['canvas_write'];

    expect(evaluateAgentToolPolicy(createTool('canvas_write'), {}, {
      ...context('collaborative'),
      disabledEffects: disabled,
    })).toMatchObject({ outcome: 'deny', errorCode: 'AGENT_CAPABILITY_DISABLED' });

    expect(evaluateAgentToolPolicy(createTool('file_write'), {}, {
      ...context('collaborative'),
      disabledEffects: disabled,
    })).toMatchObject({ outcome: 'require_approval', approvalKind: 'file_write' });
  });

  it('能力开关优先于只读任务的拒绝口径', () => {
    // 只读任务下原本就会拒绝；带开关时给出的是「能力已关闭」这条更明确的理由
    expect(evaluateAgentToolPolicy(createTool('canvas_write'), {}, {
      ...context('collaborative', true),
      disabledEffects: ['canvas_write'],
    })).toMatchObject({ errorCode: 'AGENT_CAPABILITY_DISABLED' });
  });
});
