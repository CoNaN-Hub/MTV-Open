/**
 * Agent 工具权限的本地固定策略矩阵，根据模式和 effect 返回放行、确认或拒绝决策。
 */
import type { AgentMode } from '../../types/agent';
import type {
  AgentToolDefinition,
  AgentToolEffect,
} from './toolRegistry';

export type AgentPolicyDecision =
  | { outcome: 'allow'; reason: string }
  | {
      outcome: 'require_approval';
      reason: string;
      approvalKind: Exclude<AgentToolEffect, 'read'>;
    }
  | { outcome: 'deny'; reason: string; errorCode: string };

export interface AgentPolicyContext {
  mode: AgentMode;
  /** 只读子任务（子智能体/专家任务）：除 `read` 外的 effect 一律拒绝。 */
  readOnly?: boolean;
  projectId: string;
  conversationId: string;
  taskId: string;
  baseRevision?: number;
  /**
   * 「设置 → 权限」里被**关掉**的能力（`config.agentCapabilities[effect] === false`）。
   * 缺省 / 空数组 = 全部开启，行为与加这个开关之前完全一致。
   * `read` 与 `user_choice` 即使传进来也会被忽略（见下面的注释）。
   */
  disabledEffects?: readonly AgentToolEffect[];
}

/**
 * 可以从「设置 → 权限」关掉的能力清单。
 *
 * ⚠️ `read` 与 `user_choice` **不在此列**，故意的：
 *   · `read` 关掉等于把 Agent 变成废人（它连自己的上下文都读不了），官方也没有这个开关；
 *   · `user_choice` 是「必须由用户作答」本身，它不是能力而是交互约束，关掉只会让工具卡死。
 * 这两项在权限页里用**禁用**的开关展示（官方 `Pal` 的开关行 + `footer` 说明）。
 */
export const AGENT_TOGGLEABLE_EFFECTS = [
  'canvas_write',
  'file_write',
  'permanent_delete',
  'media_generation',
  'memory_write',
  'config_write',
  'asset_write',
] as const satisfies readonly AgentToolEffect[];

export type AgentToggleableEffect = (typeof AGENT_TOGGLEABLE_EFFECTS)[number];

/** 某条能力是否被本机配置关掉（缺省 = 开启）。 */
export function isAgentEffectDisabled(
  effect: AgentToolEffect,
  disabledEffects?: readonly AgentToolEffect[],
): boolean {
  if (effect === 'read' || effect === 'user_choice') return false;
  return disabledEffects?.includes(effect) === true;
}

/** 从本机配置算出「被关掉的能力」列表（纯函数，调用方负责把 `config.agentCapabilities` 递进来）。 */
export function disabledAgentEffects(
  capabilities?: Partial<Record<AgentToolEffect, boolean>>,
): AgentToolEffect[] {
  if (!capabilities) return [];
  return (Object.keys(capabilities) as AgentToolEffect[])
    .filter((effect) => capabilities[effect] === false);
}

export function evaluateAgentToolPolicy(
  definition: AgentToolDefinition,
  input: unknown,
  context: AgentPolicyContext,
): AgentPolicyDecision {
  // 能力开关优先于模式：关掉的能力在**任何模式**下都不放行（含自主模式）。
  if (isAgentEffectDisabled(definition.effect, context.disabledEffects)) {
    return {
      outcome: 'deny',
      reason: `「${definition.effect}」能力已在「设置 → 权限」中关闭`,
      errorCode: 'AGENT_CAPABILITY_DISABLED',
    };
  }

  /* 只读子任务（官方没有的「Plan 模式」已被删除，只读性改用显式标志表达）：
     只读任务里除 `read` 之外的一切 effect 一律拒绝。 */
  if (context.readOnly && definition.effect !== 'read') {
    return {
      outcome: 'deny',
      reason: '只读任务只允许使用只读工具',
      errorCode: 'AGENT_READ_ONLY_TOOL_DENIED',
    };
  }

  const authorization = definition.authorize?.(context, input);
  if (authorization && !authorization.allowed) {
    return {
      outcome: 'deny',
      reason: authorization.reason || '当前会话没有执行该工具的授权',
      errorCode: 'AGENT_TOOL_UNAUTHORIZED',
    };
  }

  // 需要用户作答的工具在任何模式下都必须停下等人：自动"批准"等于替用户做决定，
  // 拿不到选择结果，工具本身也无事可做。
  if (definition.effect === 'user_choice') {
    return {
      outcome: 'require_approval',
      reason: '需要你从清单中选择',
      approvalKind: 'user_choice',
    };
  }

  if (context.mode === 'autonomous') {
    return {
      outcome: 'allow',
      /* 第 85 轮：`自主模式` 是 MTV 自造词。官方两态表 `Qk` @188605 只有 `ask` / `auto`，
         用户可见词 = `chatAdapter.confirmMode.autoTitle` = zh「自动生成」@4288850 ⇒ 换成官方词。 */
      reason: `自动生成模式允许自动执行 ${definition.effect} 工具`,
    };
  }

  switch (definition.effect) {
    case 'read':
      return { outcome: 'allow', reason: '只读工具可自动执行' };
    case 'canvas_write':
      return {
        outcome: 'require_approval',
        /* ⚠️ 第 59 轮：这里原来写成 `'B 协作模式的画布写操作需要确认'` —— 那个 `B ` 是内部模式标记
           （A/B/C 模式编号）误漏进**用户可见**文案，实测直接显示在「确认节点更新」卡正文里。
           用户可见串里不许留内部标记 ⇒ 去掉前缀。
           ⚠️ 第 85 轮：`协作模式` 也是 MTV 自造词（官方两态表 `Qk` @188605 只有 `ask` / `auto`；
           用户可见词是 `chatAdapter.confirmMode.ask` = zh「手动确认」@4288786）⇒ 换成官方词。 */
        reason: '需手动确认：画布修改要经你批准后才执行',
        approvalKind: 'canvas_write',
      };
    case 'file_write':
      return {
        outcome: 'require_approval',
        reason: '本地文件写入始终需要确认',
        approvalKind: 'file_write',
      };
    case 'permanent_delete':
      return {
        outcome: 'require_approval',
        reason: '永久删除始终需要二次确认',
        approvalKind: 'permanent_delete',
      };
    case 'media_generation':
      return {
        outcome: 'require_approval',
        reason: '付费媒体生成和重新生成每次都需要确认',
        approvalKind: 'media_generation',
      };
    case 'memory_write':
      return {
        outcome: 'require_approval',
        reason: '项目记忆必须由用户确认后保存',
        approvalKind: 'memory_write',
      };
    case 'config_write':
      return {
        outcome: 'require_approval',
        reason: 'API 厂商配置必须由用户确认后保存',
        approvalKind: 'config_write',
      };
    case 'asset_write':
      return {
        outcome: 'require_approval',
        reason: '写入资产库与角色库必须由用户确认',
        approvalKind: 'asset_write',
      };
  }
}
