/**
 * 「带审批的步骤」在官方事件里的**改道规则**回归。
 *
 * 背景（子代理审计发现，主 agent 独立复现）：`stepToToolEvent` 原来对**任何**带 `step.approval`
 * 的步骤无条件改道成官方审批卡，于是：
 *   · 协作模式下 `show_html`（`effect:'file_write'` ⇒ `require_approval`）执行成功后，
 *     步骤仍带 `approval`（`agentToolExecution.ts` 只把 status 变 approved），
 *   · `toolCall.officialRequest` 被整块丢弃 ⇒ **HTML 卡片在协作模式永远不出现**。
 *
 * 官方语义（源码级）：官方**没有**「审批包住任意工具」这层包装 —— 确认卡族
 * （`generation_confirmation` / `node_update_confirmation` / `desktop_fs_confirmation`）
 * 在官方是**各自的工具**。MTV 的 `AgentApprovalSnapshot` 只是「这一步在等用户批」的表达。
 * ⇒ 规则改为：**审批还挂着（pending）时走确认卡；一旦这一步已经产出了自己的官方载荷，
 * 就渲染它自己的卡**（否则卡片族在协作模式下不可达）。没有自己载荷的步骤行为不变。
 * 验证分级 = **(b) 纯逻辑断言**。
 */
import { describe, expect, it } from 'vitest';
import { stepToToolEvent } from '../../../src/services/chat/agentActivityItems';
import { classifyToolEventFamily } from '../../../src/services/chat/agentMessageContents';
import { isMcpAppEvent } from '../../../src/services/chat/mcpAppCard';
import type { AgentApprovalSnapshot, AgentStep } from '../../../src/types/agent';

const SHOW_HTML_REQUEST = {
  title: '周报',
  description: '',
  artifact_path: 'artifacts/conv-1/report.html',
};

function step(over: {
  approval?: AgentApprovalSnapshot | null;
  officialRequest?: Record<string, unknown>;
} = {}): AgentStep {
  return {
    id: 's1',
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: '生成交互页',
    status: 'succeeded',
    createdAt: 1,
    updatedAt: 2,
    toolCall: {
      callId: 'call-1',
      toolId: 'show_html',
      retryCount: 0,
      startedAt: 1,
      finishedAt: 2,
      ...(over.officialRequest ? { officialRequest: over.officialRequest } : {}),
    },
    ...(over.approval !== undefined && over.approval !== null ? { approval: over.approval } : {}),
  } as AgentStep;
}

function approval(status: string): AgentApprovalSnapshot {
  return {
    id: 'ap-1',
    kind: 'file_write',
    status: status as AgentApprovalSnapshot['status'],
    summary: '写入文件',
    requestedAt: 1,
  } as AgentApprovalSnapshot;
}

describe('stepToToolEvent —— 审批步骤的改道规则', () => {
  it('审批**还挂着**（pending）⇒ 仍走官方确认卡（审批 UI 不能丢）', () => {
    const event = stepToToolEvent(step({ approval: approval('pending') }));
    const tool = String((event as unknown as { content: Record<string, unknown> }).content.tool);
    expect(tool).not.toBe('show_html');
    expect(classifyToolEventFamily(event as never)).toBe('desktop_confirmation');
  });

  it('审批已通过 + 该步骤有自己的官方载荷 ⇒ 渲染**工具自己的卡**（HTML 卡），不再被审批卡劫持', () => {
    const event = stepToToolEvent(step({
      approval: approval('approved'),
      officialRequest: SHOW_HTML_REQUEST,
    }));
    const content = (event as unknown as { content: Record<string, unknown> }).content;
    expect(content.tool).toBe('show_html');
    expect(content.request).toEqual(SHOW_HTML_REQUEST);
    expect(classifyToolEventFamily(event as never)).toBe('show_html');
  });

  it('审批已通过 + 没有自己的载荷 ⇒ 行为不变（继续走确认卡）', () => {
    const event = stepToToolEvent(step({ approval: approval('approved') }));
    expect(classifyToolEventFamily(event as never)).toBe('desktop_confirmation');
  });

  it('没有审批 ⇒ 一律走工具自己的事件（原有行为不变）', () => {
    const event = stepToToolEvent(step({ officialRequest: SHOW_HTML_REQUEST }));
    expect(classifyToolEventFamily(event as never)).toBe('show_html');
    /* mcpApp 的**结构判据**同样只在「无审批/已产出载荷」时生效。 */
    const mcp = stepToToolEvent(step({ officialRequest: {}, approval: approval('approved') }));
    expect(isMcpAppEvent({ type: 'tool_event', content: (mcp as unknown as { content: Record<string, unknown> }).content }))
      .toBe(false);
  });
});
