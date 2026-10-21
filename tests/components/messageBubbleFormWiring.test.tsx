// @vitest-environment jsdom
/**
 * form 族（`show_form`）在消息渲染器里的**接线**回归（覆盖表 §6 #3）。
 *
 * 官方 `$M`（`vendor-pkg-canvas-ChpWx5JY.js` **@2426950** 邻域，逐字）：
 * ```js
 * if(jD(e)){ const T=e.content;
 *   return (T.status==="pending"||T.status==="started")&&t ? <HM toolName="show_form"/>
 *        : T.status!=="completed" ? null : <ase content={T} onSubmitForm={m}/> }
 * ```
 * `jD = e => UNe.has(xl(e))`，`UNe = new Set(["show_form"])`（大小写敏感）。
 * `HM` = `ToolLoadingIndicator`（专属图标 `Wae = { show_form: m4 }`，`m4` = Tabler `forms`）；
 * `ase` = `FormCard`。
 *
 * 载荷通道 = `AgentToolCallSnapshot.officialRequest` → 并进 `tool_event.content.request`
 * （官方 `Hoe`/`parseFormContent` 读 `content.response.form ?? content.request`）。
 *
 * 验证分级 = **(b) jsdom 真 DOM**（未做 (a) live CDP）。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import type { AgentStep, AgentStepStatus, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {},
  mediaModelOptions: [],
  mediaModelAvailability: {},
  onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

/** 官方 `parseFormContent` 认得的最小表单定义（`content.request` / `content.response.form`）。 */
const FORM_PAYLOAD = {
  title: '发布前确认',
  fields: [{ id: 'q1', type: 'text', label: '标题写什么？' }],
};

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000, status: 'complete', ...over };
}

function formStep(id: string, status: AgentStepStatus, withPayload: boolean): AgentStep {
  return {
    id,
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: '收集表单',
    status,
    createdAt: 1_000,
    updatedAt: 2_000,
    toolCall: {
      callId: `call-${id}`,
      toolId: 'show_form',
      retryCount: 0,
      startedAt: 1_000,
      finishedAt: 2_000,
      ...(withPayload ? { officialRequest: FORM_PAYLOAD } : {}),
    },
  };
}

function task(steps: AgentStep[]): AgentTask {
  return { id: 'task-1', goal: '测试', status: 'running', steps, createdAt: 1, updatedAt: 2 } as AgentTask;
}

function renderBubble(steps: AgentStep[], msg = message()) {
  return render(<MessageBubble message={msg} agentTask={task(steps)} agentControls={AGENT_CONTROLS} />);
}

beforeEach(() => {
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
});

describe('MessageBubble —— 官方 `$M` 的 `jD`(show_form) 接线', () => {
  it('`started` 且流式中 ⇒ 渲染 `ToolLoadingIndicator`（官方 `HM`），图标为专属 `tabler-icon-forms`', () => {
    const { container } = renderBubble([formStep('s1', 'running', false)], message({ status: 'streaming' }));
    const svg = container.querySelector('svg.tabler-icon-forms');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('tool-call-status-icon-active');
    /* 不应退化成普通工具行。 */
    expect(container.textContent).not.toContain('收集表单');
  });

  it('`completed` + 官方载荷 ⇒ 渲染 `FormCard`（官方 `ase`）', () => {
    const { container } = renderBubble([formStep('s1', 'succeeded', true)]);
    /* 表单标题与字段 label 来自 `content.request`。 */
    expect(container.textContent).toContain('发布前确认');
    expect(container.textContent).toContain('标题写什么？');
    /* 不再渲染成普通工具行。 */
    expect(container.textContent).not.toContain('收集表单');
  });

  it('`completed` 但**没有**官方载荷 ⇒ `FormCard` 的 `parseFormContent` 返回 null（不渲染卡片）', () => {
    const { container } = renderBubble([formStep('s1', 'succeeded', false)]);
    expect(container.textContent).not.toContain('发布前确认');
  });

  it('`pending`/`started` 但**不在流式中** ⇒ 本分支 `null`（官方 `&& t`）—— 卡片不出现', () => {
    const { container } = renderBubble([formStep('s1', 'running', false)], message({ status: 'complete' }));
    /* ⚠️ 这里**不断言**图标消失：MTV 另有一条「当前活动工具」指示行（`activeToolName`），
       只要还有 running 步骤就会渲染 `ToolLoadingIndicator` —— 那是既有行为，与本分支无关。
       本分支的判据是**卡片不出现**。 */
    expect(container.textContent).not.toContain('发布前确认');
    expect(container.textContent).not.toContain('提交');
  });

  it('`failed` ⇒ 本分支 `null`（官方 `T.status!=="completed" ? null : …`），卡片不出现', () => {
    const { container } = renderBubble([formStep('s1', 'failed', true)]);
    expect(container.textContent).not.toContain('发布前确认');
  });

  it('`show_form` 事件不会同时落进普通工具行（`restToolItems` 已排除）', () => {
    const other: AgentStep = {
      id: 's2',
      taskId: 'task-1',
      index: 1,
      kind: 'tool',
      title: '读画布',
      status: 'succeeded',
      createdAt: 3_000,
      updatedAt: 4_000,
      toolCall: { callId: 'call-s2', toolId: 'canvas_query', retryCount: 0, startedAt: 3_000, finishedAt: 4_000 },
    };
    const { container } = renderBubble([formStep('s1', 'succeeded', true), other]);
    expect(container.textContent).toContain('发布前确认');
    /* 普通工具行仍在；`canvas_query` 经 `mtvToolToOfficial` 映射成官方 `canvas_context`，
       行文案走官方表（`已读取画布上下文`），不是步骤 title。 */
    expect(container.textContent).toContain('已读取画布上下文');
    expect(container.textContent).not.toContain('收集表单');
  });
});
