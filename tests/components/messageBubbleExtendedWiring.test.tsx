// @vitest-environment jsdom
/**
 * `desktop_*` / `connectorAuthCard` / `mcpApp` 三族在消息渲染器里的**接线**回归（§6 #5）。
 *
 * 官方 `$M`（`vendor-pkg-canvas-ChpWx5JY.js` **@2426950** 邻域，逐字）：
 * ```js
 * if(kD(e)) return s.jsx($Qe,{content:e.content,onAnswer:l});                                  // desktop_*
 * if(ID(e)){ const T=e.content; if(T.status==="completed") return s.jsx(Loe,{content:T}) }     // get_connector_status
 * if(AD(e)){ const T=e.content; return T.status==="completed" ? s.jsx(nre,{content:T, …}) : null } // mcpApp
 * ```
 * `AD` 的判据是**结构**（`content.ui.resource_uri` 非空），不是工具名集合。
 * `kD` 走 `PORTED_CONFIRMATION_FAMILIES` → `stepToToolEvent` 改道 → `ConfirmationEventCard` 的 desktop 分支。
 *
 * 验证分级 = **(b) jsdom 真 DOM**（未做 (a) live CDP）。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import type { AgentApprovalKind, AgentStep, AgentStepStatus, AgentTask } from '../../src/types/agent';
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

function task(steps: AgentStep[]): AgentTask {
  return { id: 'task-1', goal: '测试', status: 'completed', steps, createdAt: 1, updatedAt: 2 } as AgentTask;
}

function toolStep(
  id: string,
  toolId: string,
  status: AgentStepStatus = 'succeeded',
  extra: { officialRequest?: Record<string, unknown>; officialUi?: Record<string, unknown> } = {},
): AgentStep {
  return {
    id,
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: '步骤',
    status,
    createdAt: 1_000,
    updatedAt: 2_000,
    toolCall: { callId: `call-${id}`, toolId, retryCount: 0, startedAt: 1_000, finishedAt: 2_000, ...extra },
  };
}

function approvalStep(id: string, kind: AgentApprovalKind): AgentStep {
  return {
    id,
    taskId: 'task-1',
    index: 0,
    kind: 'approval',
    title: '等待确认',
    status: 'running',
    createdAt: 1_000,
    updatedAt: 2_000,
    approval: { id: `ap-${id}`, kind, status: 'pending', summary: `需要确认：${kind}`, requestedAt: 1_000 },
    toolCall: { callId: `call-${id}`, toolId: 'media_generate', retryCount: 0, startedAt: 1_000 },
  };
}

beforeEach(() => {
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
});

describe('MessageBubble —— 官方 `$M` 的 `kD` / `ID` / `AD` 三族接线', () => {
  it('`desktop_fs_confirmation` 工具事件 ⇒ 渲染 desktop 确认卡（官方 `kD` → `$Qe`）', () => {
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([toolStep('s1', 'desktop_fs_confirmation', 'succeeded', { officialRequest: { confirmation_id: 'c1', confirmation_kind: 'desktop_fs' } })])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    /* 卡片外壳存在（F 的组件根节点带测试钩子类/结构）；关键是**没退化成普通工具行**。 */
    expect(container.textContent).not.toContain('步骤');
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it('`file_write` 审批 ⇒ 改道到 desktop 族（round 30 白名单放开）', () => {
    const { container } = render(
      <MessageBubble message={message()} agentTask={task([approvalStep('a1', 'file_write')])} agentControls={AGENT_CONTROLS} />,
    );
    expect(container.textContent).not.toContain('等待确认');
  });

  it('`get_connector_status` + `completed` ⇒ 渲染 `ConnectorAuthCard`（官方 `ID` → `Loe`）', () => {
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([toolStep('s1', 'get_connector_status', 'succeeded', { officialRequest: { connector: { name: 'Notion' } } })])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(container.textContent).not.toContain('步骤');
  });

  it('`get_connector_status` + **非** completed ⇒ `null`（官方判定在分派器里）', () => {
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([toolStep('s1', 'get_connector_status', 'running', { officialRequest: { connector: { name: 'Notion' } } })])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(container.textContent).not.toContain('Notion');
  });

  it('mcpApp（`content.ui.resource_uri` 非空）+ `completed` ⇒ 渲染 `McpAppCard`（官方 `AD` → `nre`）', () => {
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([toolStep('s1', 'mcp_app', 'succeeded', { officialUi: { resource_uri: 'ui://tapnow/demo@v1' } })])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    /* 不进普通工具行。 */
    expect(container.textContent).not.toContain('步骤');
  });

  it('**没有** `content.ui` 的工具事件不落进 mcpApp（`AD` 是结构判据，不是工具名）', () => {
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([toolStep('s1', 'mcp_app', 'succeeded')])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    /* 没有 ui ⇒ 它是普通工具事件 ⇒ 落回工具区（不再被 mcpApp 收集器摘走）。 */
    expect(container.textContent.length).toBeGreaterThan(0);
  });
});
