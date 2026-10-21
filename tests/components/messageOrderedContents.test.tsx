// @vitest-environment jsdom
/**
 * 覆盖表 **§6 #1**：消息渲染层按官方**有序 `contents: Item[]`** 走。
 *
 * 官方消息模型是 `{contents: Item[]}`，`Z0`/`$M` **按数组顺序逐项分派**：
 * 命中卡片族的 item 各自成一张卡，其余 `tool_event`/`subagent` 交给 `kh`
 * (`CollapsibleToolSection`) 连续分桶。⇒ **卡片会插在工具行中间**，而不是统统排到最后。
 *
 * MTV 的 `ChatMessage` 没有 `contents`（`content` 是流式正文、任务态在 `agentTask`）⇒
 * `MessageBubble` 在渲染前**生产**出同一份有序列表（时间戳序），再按顺序渲染。
 * 本测试锁住「顺序」这一用户可见差异（此前恒为「活动区 → 提问 → 确认 → widget → 表单 →
 * 连接器 → mcpApp」）。
 *
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import type { AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {},
  mediaModelOptions: [],
  mediaModelAvailability: {},
  onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

const FORM_PAYLOAD = {
  title: '发布前确认',
  fields: [{ id: 'q1', type: 'text', label: '标题写什么？' }],
};

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000, status: 'complete', ...over };
}

function toolStep(id: string, toolId: string, at: number, extra: Partial<AgentStep['toolCall']> = {}): AgentStep {
  return {
    id,
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: `步骤 ${id}`,
    status: 'succeeded',
    createdAt: at,
    updatedAt: at + 10,
    toolCall: { callId: `call-${id}`, toolId, retryCount: 0, startedAt: at, finishedAt: at + 10, ...extra },
  };
}

function task(steps: AgentStep[]): AgentTask {
  return { id: 'task-1', goal: '测试', status: 'running', steps, createdAt: 1, updatedAt: 2 } as AgentTask;
}

beforeEach(() => setUp());
function setUp() {
  setLocale('zh-CN');
}

afterEach(() => {
  cleanup();
});

describe('§6 #1 —— 渲染层严格按有序 `contents` 走', () => {
  it('工具行 → 表单卡 → 工具行：卡片**插在中间**，不再排到全部工具行之后', () => {
    const steps = [
      /* 普通工具（`canvas_query` → 官方 `canvas_context`，行文案走官方表「已读取画布上下文」）。 */
      toolStep('s1', 'canvas_query', 1_000),
      /* 中间弹出的表单卡。 */
      toolStep('s2', 'show_form', 2_000, { officialRequest: FORM_PAYLOAD }),
      /* 表单之后继续跑的工具。 */
      toolStep('s3', 'canvas_undo', 3_000),
    ];
    const { container } = render(
      <MessageBubble message={message()} agentTask={task(steps)} agentControls={AGENT_CONTROLS} />,
    );

    const html = container.innerHTML;
    const beforeIndex = html.indexOf('已读取画布上下文');
    const formIndex = html.indexOf('发布前确认');
    expect(beforeIndex).toBeGreaterThanOrEqual(0);
    expect(formIndex).toBeGreaterThan(beforeIndex);
    /* 表单卡之后仍然渲染了工具行（顺序不是「卡片全部靠后」）。
       `canvas_undo` 在官方工具表里没有映射 ⇒ 该行按 MTV 步骤标题渲染成 `步骤 s3`。 */
    const afterFormHtml = html.slice(formIndex);
    expect(afterFormHtml).toContain('步骤 s3');
  });

  it('卡片**连续**排列时合成一段（不额外插入工具段）', () => {
    const steps = [
      toolStep('s1', 'show_form', 1_000, { officialRequest: FORM_PAYLOAD }),
      toolStep('s2', 'canvas_query', 2_000),
    ];
    const { container } = render(
      <MessageBubble message={message()} agentTask={task(steps)} agentControls={AGENT_CONTROLS} />,
    );
    const html = container.innerHTML;
    expect(html.indexOf('发布前确认')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('已读取画布上下文')).toBeGreaterThan(html.indexOf('发布前确认'));
  });

  it('没有 Agent 任务时行为不变（不渲染任何活动段）', () => {
    const { container } = render(<MessageBubble message={message({ content: '你好' })} />);
    expect(container.textContent).toContain('你好');
    expect(container.querySelector('.tool-call-status-icon-active')).toBeNull();
  });
});
