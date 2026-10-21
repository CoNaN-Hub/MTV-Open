/**
 * `ask_question` **生产者**回归（覆盖表 §6「补工具生产者」）。
 *
 * 官方链路：工具族 `MNe`（实际生效的只有 `ask_question`）→ 生产者产出
 * `tool_event{status:"started", tool_call_id/tool_use_id: question_id, tool:"AskUserQuestion",
 * request:{…}}` → 会话态 `setPendingQuestion({toolUseId, questionId, questions, status:"pending"})`
 * → `Qie`(`AskQuestionSheet`) 出现 → 答完最后一题 `clearPendingQuestion()` + 工具继续。
 *
 * MTV 侧：`ask_question` 是**本地工具**，「等待答复」用本地 resolver 表
 * （`askQuestionRuntime`，与审批的 `waitForAgentApproval` 同款）。
 * 验证分级 = **(d) 源码级 + (b) 纯逻辑断言**。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentToolContext } from '../../../src/services/chat/toolRegistry';
import { clearAgentToolRegistryForTests, getAgentTool } from '../../../src/services/chat/toolRegistry';
import { registerAskQuestionAgentTools } from '../../../src/services/chat/tools/askQuestionTools';
import { resolveAskQuestionAnswers } from '../../../src/services/chat/askQuestionRuntime';
import { useAppStore } from '../../../src/store/useAppStore';

function context(over: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    taskId: 'task-1',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    mode: 'autonomous',
    callId: 'call-ask-1',
    signal: new AbortController().signal,
    ...over,
  };
}

const QUESTIONS = [{
  question: '要哪种风格？',
  header: '风格',
  options: [{ label: '写实' }, { label: '动画' }],
}];

beforeEach(() => {
  clearAgentToolRegistryForTests();
  registerAskQuestionAgentTools();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ currentProjectId: 'project-1', activeConversationId: 'conversation-1' });
});

afterEach(() => {
  useAppStore.getState().clearPendingQuestion();
  vi.restoreAllMocks();
});

describe('ask_question 生产者', () => {
  it('工具已注册，且是 `read`（不需要审批）', () => {
    const tool = getAgentTool('ask_question');
    expect(tool).toBeDefined();
    expect(tool!.effect).toBe('read');
    expect(tool!.id).toBe('ask_question');
  });

  it('执行 ⇒ 写入官方会话态 `pendingQuestion`（toolUseId = 官方 callId）并**挂起等答复**', async () => {
    const tool = getAgentTool('ask_question')!;
    let settled = false;
    const running = tool.execute(context(), { questions: QUESTIONS }).then((result) => {
      settled = true;
      return result;
    });

    /* 官方 `setPendingQuestion({toolUseId, questionId, questions, status:"pending"})`。 */
    const pending = useAppStore.getState().pendingQuestion;
    expect(pending).not.toBeNull();
    expect(pending!.toolUseId).toBe('call-ask-1');
    expect(pending!.status).toBe('pending');
    expect(pending!.step).toBe(0);
    expect(pending!.questions).toHaveLength(1);
    expect(pending!.questions[0].question).toBe('要哪种风格？');
    expect(pending!.questions[0].header).toBe('风格');
    /* 题目归一化时 question_id 用 callId 当 scope（官方 `sQe(value, toolCallId, index)`）。 */
    expect(pending!.questions[0].question_id).toBe('call-ask-1#0');
    /* 还在等 ⇒ 没有 settle。 */
    await Promise.resolve();
    expect(settled).toBe(false);

    /* 用户在面板里答完最后一题（宿主调 `resolveAskQuestionAnswers`）。 */
    expect(resolveAskQuestionAnswers('call-ask-1', [{ question_id: 'call-ask-1#0', selected_labels: ['写实'] }]))
      .toBe(true);
    const result = await running;
    expect(result.status).toBe('success');
    expect(result.summary).toContain('1/1');
    /* 官方载荷双通道：`request.questions`（题目）+ `response`（答案）。
       单题时官方 `ze = LXe(st, Ke||J)` 退化为 `{selected_labels}`（**不带** `answers` 外壳）。 */
    expect(result.officialRequest).toEqual({ questions: QUESTIONS });
    expect(result.officialResponse).toEqual({ selected_labels: ['写实'] });
    /* 答完 ⇒ 会话态清空（官方 `clearPendingQuestion`）。 */
    expect(useAppStore.getState().pendingQuestion).toBeNull();
  });

  it('中止 ⇒ 按 `AbortError` 拒绝，并且**会话态也要清掉**（否则面板一直挂着）', async () => {
    const tool = getAgentTool('ask_question')!;
    const controller = new AbortController();
    const running = tool.execute(
      context({ callId: 'call-ask-2', signal: controller.signal }),
      { questions: QUESTIONS },
    );
    expect(useAppStore.getState().pendingQuestion?.toolUseId).toBe('call-ask-2');
    controller.abort();
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
    expect(useAppStore.getState().pendingQuestion).toBeNull();
  });

  it('已有待答问题时再提问 ⇒ `authorize` 拒绝（官方同一时刻只有一组问题）', () => {
    const tool = getAgentTool('ask_question')!;
    useAppStore.getState().setPendingQuestion({
      toolUseId: 'call-other',
      questions: [],
      status: 'pending',
      step: 0,
      collectedAnswers: [],
    });
    const decision = tool.authorize!(context(), { questions: QUESTIONS });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('等用户回答');
  });

  it('没有合法题目 ⇒ 直接返回 `ASK_QUESTION_EMPTY`（不挂起）', async () => {
    const tool = getAgentTool('ask_question')!;
    const result = await tool.execute(context(), { questions: [] as never });
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('ASK_QUESTION_EMPTY');
    expect(useAppStore.getState().pendingQuestion).toBeNull();
  });
});
