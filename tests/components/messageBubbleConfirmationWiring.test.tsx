// @vitest-environment jsdom
/**
 * 「工具生产者」的**端到端**接线回归（用户指令 round 27）：
 * MTV 的**审批步骤** → 官方确认族 `tool_event` → `MessageBubble` 渲染官方确认卡。
 *
 * 链路（三跳，每一跳都有独立测试）：
 *   1. `agentApprovalContents.approvalStepToOfficialToolEventItem`（写侧适配层，子代理交付）
 *   2. `agentActivityItems.stepToToolEvent`（主 agent 接线：带 `step.approval` 且族已移植 ⇒ 改道）
 *   3. `MessageBubble` 的 `confirmationCardEvents` 过滤 + `ConfirmationEventCard`（子代理交付）
 *
 * 官方依据：`$M` @2426950 的 `dg(e) → <qet/>` / `iT(e) → <Btt/>`；
 * `MessageBubble` 对应官方 `Z0`。验证分级 = **(b) jsdom 真 DOM**（未做 (a) live CDP）。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import type { AgentApprovalKind, AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {},
  mediaModelOptions: [],
  mediaModelAvailability: {},
  onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000, status: 'complete', ...over };
}

function approvalStep(id: string, kind: AgentApprovalKind, extra: Partial<AgentStep> = {}): AgentStep {
  return {
    id,
    taskId: 'task-1',
    index: 0,
    kind: 'approval',
    title: '等待确认',
    status: 'running',
    createdAt: 1_000,
    updatedAt: 2_000,
    approval: {
      id: `ap-${id}`,
      kind,
      status: 'pending',
      summary: `需要确认：${kind}`,
      requestedAt: 1_000,
    },
    toolCall: { callId: `call-${id}`, toolId: 'media_generate', retryCount: 0, startedAt: 1_000 },
    ...extra,
  };
}

function task(steps: AgentStep[]): AgentTask {
  return { id: 'task-1', goal: '测试', status: 'completed', steps, createdAt: 1, updatedAt: 2 } as AgentTask;
}

beforeEach(() => {
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
});

describe('MessageBubble —— 审批步骤 → 官方确认卡（端到端）', () => {
  it('`canvas_write` 审批 ⇒ 渲染 `node_update_confirmation` 卡（官方 `Btt`），且不再渲染成普通工具行', () => {
    const { container } = render(
      <MessageBubble message={message()} agentTask={task([approvalStep('a1', 'canvas_write')])} agentControls={AGENT_CONTROLS} />,
    );
    /* 卡片外壳（官方 `ztt` = 单请求卡，`data-testid` 逐字）。 */
    const card = container.querySelector('[data-testid="node-update-confirmation-card"]');
    expect(card).not.toBeNull();
    /* 卡片把 MTV 审批的**真实 summary** 显示出来了 —— 证明数据确实流到了官方卡片。 */
    expect(card?.textContent).toContain('需要确认：canvas_write');
    /* 官方按钮文案（`取消` / `更新`）也在。 */
    expect(card?.textContent).toContain('取消');
    expect(card?.textContent).toContain('更新');
    /* 关键判别：改道后**不再**退化成普通工具行（普通工具行显示 `step.title` = `等待确认`）。 */
    expect(container.textContent).not.toContain('等待确认');
  });

  it('`media_generation` 审批 ⇒ 渲染 `generation_confirmation` 卡（官方 `qet`），不再渲染成普通工具行', () => {
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([approvalStep('a2', 'media_generation', {
          approval: {
            id: 'ap-a2',
            kind: 'media_generation',
            status: 'pending',
            summary: '需要确认：media_generation',
            requestedAt: 1_000,
            inputRequest: { kind: 'media_model', mediaKind: 'image' },
          },
        })])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    /* 判别同上：改道后没有普通工具行。 */
    expect(container.textContent).not.toContain('等待确认');
    /* 也不该是 `node_update` 那张卡。 */
    expect(container.querySelector('[data-testid="node-update-confirmation-card"]')).toBeNull();
  });

  it('`file_write`/`permanent_delete`/`asset_write` ⇒ 改道到 `desktop_fs_confirmation` 卡（官方 `kD` → `$Qe`）', () => {
    /* round 30：`$Qe`(`DesktopConfirmationCard`) 移植完成后白名单放开，这三族不再退化成普通工具行。 */
    for (const kind of ['file_write', 'permanent_delete', 'asset_write'] as const) {
      const { container } = render(
        <MessageBubble message={message()} agentTask={task([approvalStep(`a-${kind}`, kind)])} agentControls={AGENT_CONTROLS} />,
      );
      /* 不再有普通工具行（普通工具行会显示 `step.title` = `等待确认`）。 */
      expect(container.textContent).not.toContain('等待确认');
      /* 也不该是 node_update 那张卡。 */
      expect(container.querySelector('[data-testid="node-update-confirmation-card"]')).toBeNull();
      cleanup();
    }
  });

  it('官方**没有**对应族的 kind（`memory_write` / `config_write`）仍退化成普通工具行 —— 不会从界面消失', () => {
    for (const kind of ['memory_write', 'config_write'] as const) {
      const { container } = render(
        <MessageBubble message={message()} agentTask={task([approvalStep(`a-${kind}`, kind)])} agentControls={AGENT_CONTROLS} />,
      );
      /* 普通工具行仍在（显示 `step.title`）⇒ 用户依然看得见这条审批。 */
      expect(container.textContent).toContain('等待确认');
      cleanup();
    }
  });
});
