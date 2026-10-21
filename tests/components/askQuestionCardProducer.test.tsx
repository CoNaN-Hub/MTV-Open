// @vitest-environment jsdom
/**
 * `ask_question` 的**端到端渲染**回归（覆盖表 §6「补工具生产者」）。
 *
 * 链路：`ask_question` 工具（`askQuestionTools.ts`）产出
 *   · `officialRequest.questions` → `tool_event.content.request.questions`
 *   · `officialResponse.answers`  → `tool_event.content.response.answers`
 * ⇒ `MessageBubble` 的 `$M` 分支 `$b`(`isAskQuestionTool`) 路由到 `Moe`(`AskQuestionSummary`)。
 * 并锁定官方 `iQe` 的**订阅语义**：`pendingQuestion.toolUseId === content.tool_call_id`
 * 且 `status === "pending"` 时，摘要卡 `return null`（画面由 `Qie`(`AskQuestionSheet`) 承担）。
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {},
  mediaModelOptions: [],
  mediaModelAvailability: {},
  onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

const QUESTIONS = [{
  question_id: 'call-ask#0',
  question: '要哪种风格？',
  header: '风格',
  options: [{ label: '写实' }, { label: '动画' }],
  multiSelect: false,
}];

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000, status: 'complete', ...over };
}

function askStep(over: { answers?: unknown[] } = {}): AgentStep {
  return {
    id: 's1',
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: '向用户提问',
    status: 'succeeded',
    createdAt: 1_000,
    updatedAt: 2_000,
    toolCall: {
      callId: 'call-ask',
      toolId: 'ask_question',
      retryCount: 0,
      startedAt: 1_000,
      finishedAt: 2_000,
      officialRequest: { questions: QUESTIONS },
      ...(over.answers ? { officialResponse: { answers: over.answers } } : {}),
    },
  };
}

function task(steps: AgentStep[]): AgentTask {
  return { id: 'task-1', goal: '测试', status: 'running', steps, createdAt: 1, updatedAt: 2 } as AgentTask;
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(cleanup);

describe('ask_question —— 生产者到渲染器的端到端', () => {
  it('已答 ⇒ 渲染官方 `Moe` 摘要卡（题目 + 所选项 label）', () => {
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([askStep({ answers: [{ question_id: 'call-ask#0', selected_labels: ['写实'] }] })])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(container.textContent).toContain('要哪种风格？');
    expect(container.textContent).toContain('风格');
    expect(container.textContent).toContain('写实');
    /* 官方摘要卡外壳类串。 */
    expect(container.querySelector('div.mt-2.space-y-1\\.5')).not.toBeNull();
  });

  it('`pendingQuestion`（同 `tool_call_id` + `status:"pending"`）⇒ 摘要卡 `return null`（官方 `iQe`）', () => {
    useAppStore.getState().setPendingQuestion({
      toolUseId: 'call-ask',
      questionId: 'call-ask#0',
      questions: QUESTIONS as never,
      status: 'pending',
      step: 0,
      collectedAnswers: [],
    });
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([askStep({ answers: [{ question_id: 'call-ask#0', selected_labels: ['写实'] }] })])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(container.textContent).not.toContain('要哪种风格？');
  });

  it('`pendingQuestion` 属于**别的** toolUseId ⇒ 本卡照常渲染（不会互相串台）', () => {
    useAppStore.getState().setPendingQuestion({
      toolUseId: 'call-other',
      questions: QUESTIONS as never,
      status: 'pending',
      step: 0,
      collectedAnswers: [],
    });
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([askStep({ answers: [{ question_id: 'call-ask#0', selected_labels: ['写实'] }] })])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(container.textContent).toContain('要哪种风格？');
  });

  it('没有 `officialRequest` ⇒ `jM` 抽不出题目，卡片不渲染（不伪造）', () => {
    const step = askStep();
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([{ ...step, toolCall: { ...step.toolCall!, officialRequest: undefined } }])}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(container.textContent).not.toContain('要哪种风格？');
  });
});
