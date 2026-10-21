/**
 * 「提问会话态是 **per-session**」的回归（覆盖表 §29 的 N1，主 agent 复现并修复）。
 *
 * 官方 store 是 `sessions: { [sessionId]: { …, pendingQuestion, multiSelectDraft, … } }`，
 * 所有读写都带 sessionId（`vendor-pkg-canvas-ChpWx5JY.js` @32655 邻域 / @43274 / @2696503 /
 * @2716950：`setPendingQuestion(n, o)` / `clearPendingQuestion(n)` /
 * `updatePendingQuestionStatus(n, o, r)` / `getSessionState(ce).pendingQuestion`）。
 * MTV 的 store 是「一个活动会话 + 一个全局 `pendingQuestion`」⇒ 必须自带会话戳，
 * 否则 **A 会话的提问面板会跟到 B 会话上去**（本轮修掉的真 bug）。
 *
 * 覆盖三处消费者：工具写入会话戳、宿主可见性、摘要卡的订阅。
 * 验证分级 = **(b) 纯逻辑 + jsdom 真 DOM**。
 */
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AskQuestionSummary from '../../src/components/chat/AskQuestionSummary';
import { setLocale } from '../../src/i18n';
import { registerAskQuestionAgentTools } from '../../src/services/chat/tools/askQuestionTools';
import { clearAgentToolRegistryForTests, getAgentTool } from '../../src/services/chat/toolRegistry';
import type { AgentToolContext } from '../../src/services/chat/toolRegistry';
import { useAppStore } from '../../src/store/useAppStore';

const QUESTIONS = [{ question_id: 'q#0', question: '第一题？', options: [{ label: 'A' }] }];

function context(conversationId: string): AgentToolContext {
  return {
    taskId: 'task-1',
    projectId: 'project-1',
    conversationId,
    mode: 'autonomous',
    callId: 'call-scope-1',
    signal: new AbortController().signal,
  };
}

afterEach(() => {
  cleanup();
  clearAgentToolRegistryForTests();
});

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ currentProjectId: 'project-1', activeConversationId: 'conv-A' });
});

describe('pendingQuestion 的会话作用域（官方 per-session）', () => {
  it('`ask_question` 工具写入的会话态自带 `conversationId`', async () => {
    registerAskQuestionAgentTools();
    const tool = getAgentTool('ask_question')!;
    const running = tool.execute(context('conv-B'), {
      questions: [{ question: '第一题？', options: [{ label: 'A' }] }],
    });
    const pending = useAppStore.getState().pendingQuestion;
    expect(pending?.conversationId).toBe('conv-B');
    expect(pending?.status).toBe('pending');
    /* 收尾：把等待者放掉，免得留下挂起的 promise。 */
    running.catch(() => undefined);
    useAppStore.getState().clearPendingQuestion();
  });

  it('摘要卡：会话戳不匹配 ⇒ **不**把别会话的待答状态当成自己的（不会误判 pending 而消失）', () => {
    const content = { tool: 'ask_question', tool_call_id: 'call-x', tool_use_id: 'call-x', request: { questions: QUESTIONS } };
    useAppStore.getState().setPendingQuestion({
      conversationId: 'conv-B',
      toolUseId: 'call-x',
      questions: QUESTIONS as never,
      status: 'pending',
      step: 0,
      collectedAnswers: [],
    });
    /* 当前会话是 conv-A ⇒ 这条属于 conv-B 的 pending 不该影响 A 里的摘要卡：
       它应按「未回答」渲染（而不是因为判定 pending 而整卡消失）。 */
    const { container } = render(<AskQuestionSummary content={content} />);
    expect(container.textContent).toContain('第一题？');
    expect(container.textContent).toContain('未回答');
  });

  it('摘要卡：会话戳匹配 ⇒ 官方 `iQe` 语义（pending 时整卡 `return null`）', () => {
    const content = { tool: 'ask_question', tool_call_id: 'call-y', tool_use_id: 'call-y', request: { questions: QUESTIONS } };
    useAppStore.getState().setPendingQuestion({
      conversationId: 'conv-A',
      toolUseId: 'call-y',
      questions: QUESTIONS as never,
      status: 'pending',
      step: 0,
      collectedAnswers: [],
    });
    const { container } = render(<AskQuestionSummary content={content} />);
    expect(container.textContent).not.toContain('第一题？');
  });

  it('摘要卡：`answered` 但 `response` 还没落盘 ⇒ 仍按「已答」读（官方 `m?.toolUseId===id ? m.status : null`，不看 status）', () => {
    const content = { tool: 'ask_question', tool_call_id: 'call-z', tool_use_id: 'call-z', request: { questions: QUESTIONS } };
    useAppStore.getState().setPendingQuestion({
      conversationId: 'conv-A',
      toolUseId: 'call-z',
      questions: QUESTIONS as never,
      status: 'answered',
      collectedAnswers: [],
    });
    const { container } = render(<AskQuestionSummary content={content} />);
    expect(container.textContent).not.toContain('未回答');
  });
});
