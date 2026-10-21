// @vitest-environment jsdom
/**
 * 覆盖表 **§6 #1**：`ChatMessage.contents`（官方有序 `contents: Item[]`）被渲染层**优先消费**。
 *
 * 官方消息模型是 `{contents: Item[]}`，`Z0`/`$M` **按数组顺序逐项分派**；MTV 旧记录没有该字段
 * ⇒ 回落 `buildMessageContents(...)` 现场生产同一份列表（见 `tests/services/chat/buildMessageContents.test.ts`）。
 * 本文件锁住两件事：
 *   1. `message.contents` **存在时以它为准**（哪怕与 `agentTask.steps` 的时间戳顺序矛盾）；
 *   2. 不存在时**行为不回归**（与 `agentTask` 的时间戳顺序一致）。
 *
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import type { AgentMessageContentItem } from '../../src/services/chat/agentMessageContents';
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
  return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000, status: 'done', ...over };
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

function toolItem(tool: string, at: number, content: Record<string, unknown> = {}): AgentMessageContentItem {
  return {
    type: 'tool_event',
    content: { schema_version: 'tool_event.v1', type: 'tool_event', tool, status: 'completed', ...content },
    startedAt: at,
  } as AgentMessageContentItem;
}

beforeEach(() => setLocale('zh-CN'));
afterEach(() => cleanup());

describe('§6 #1 —— 渲染层优先消费 `message.contents`', () => {
  it('`contents` 的顺序胜出（工具行被排在卡片之前，即使任务时间戳相反）', () => {
    /* 任务的时间戳顺序是「卡片(1000) → 工具(2000)」，但 `contents` 明写「工具 → 卡片」。 */
    const steps = [
      toolStep('s1', 'show_form', 1_000, { officialRequest: FORM_PAYLOAD }),
      toolStep('s2', 'canvas_query', 2_000),
    ];
    const contents: AgentMessageContentItem[] = [
      toolItem('canvas_context', 2_000),
      toolItem('show_form', 1_000, { request: FORM_PAYLOAD }),
    ];
    const { container } = render(
      <MessageBubble message={message({ contents })} agentTask={task(steps)} agentControls={AGENT_CONTROLS} />,
    );
    const html = container.innerHTML;
    const toolIndex = html.indexOf('已读取画布上下文');
    const formIndex = html.indexOf('发布前确认');
    expect(toolIndex).toBeGreaterThanOrEqual(0);
    expect(formIndex).toBeGreaterThan(toolIndex);
  });

  it('`contents` 里的 `compact` item 渲染官方 `Tie`（`phase` 取自 item）', () => {
    const { container } = render(
      <MessageBubble
        message={message({ contents: [
          { type: 'text', content: '回答' },
          { type: 'compact', content: { phase: 'finished' } },
        ] })}
      />,
    );
    expect(container.textContent).toContain('上下文已自动压缩');
  });

  it('**不**认识官方之外的 item：没有 `stopped` item（官方 `Fit` 走消息列表级信号）', () => {
    const { container } = render(
      <MessageBubble
        message={message({ content: '回答', contents: [{ type: 'text', content: '回答' }] })}
        agentTask={task([])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(container.textContent).toContain('回答');
    expect(container.textContent).not.toContain('你已停止本次回复');
  });
});

describe('§6 #1 —— 回落路径（旧记录没有 `contents`）', () => {
  it('工具行 → 表单卡 → 工具行：按任务时间戳，卡片**插在中间**（行为不回归）', () => {
    const steps = [
      toolStep('s1', 'canvas_query', 1_000),
      toolStep('s2', 'show_form', 2_000, { officialRequest: FORM_PAYLOAD }),
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
    expect(html.slice(formIndex)).toContain('步骤 s3');
  });

  it('没有 Agent 任务时只渲染正文（不产生任何活动段）', () => {
    const { container } = render(<MessageBubble message={message({ content: '你好' })} />);
    expect(container.textContent).toContain('你好');
    expect(container.querySelector('.tool-call-status-icon-active')).toBeNull();
  });
});
