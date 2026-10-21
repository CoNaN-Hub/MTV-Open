// @vitest-environment jsdom
/**
 * `ask_question` 的**多题端到端 DOM**回归（对抗性验证轮）—— 覆盖表 §6。
 *
 * 与既有 `askQuestionSheetDom.test.tsx`（单题 happy path + class 串）互补：这里跑的是
 * **真实的 3 题链路**，宿主回调用的就是 `ChatPanel.handleAnswerQuestion` 调的同一个函数
 * （`answerPendingQuestion`，官方宿主 `Ve` @2717400 的非数组分支）：
 *
 *   工具 `execute`（`setPendingQuestion`） → 面板逐题作答 → 写回 `collectedAnswers`
 *   → 还有下一题 `setPendingQuestionProgress(step+1)`（**工具继续等**）
 *   → `goPrev` 回写当前题并回到上一题（已答内容原样还原）
 *   → 最后一题 `updatePendingQuestionStatus("answered")` + `resolveAskQuestionAnswers`
 *   → 工具 `finally` 清会话态。
 *
 * 官方事实：`hrt`(`Qie` 的内部 hook) @2547641 的 `goNext`/`goPrev`、`rq` @32655（面板可见性）、
 * `Be`(`stopGeneration`) @2737720（停止时把待答问题判成 `cancelled`）。
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AskQuestionSheet from '../../src/components/chat/AskQuestionSheet';
import { askQuestionsOf } from '../../src/services/chat/askQuestion';
import {
  answerPendingQuestion,
  hasPendingAskQuestion,
} from '../../src/services/chat/askQuestionRuntime';
import {
  clearAgentToolRegistryForTests,
  getAgentTool,
  type AgentToolContext,
} from '../../src/services/chat/toolRegistry';
import { registerAskQuestionAgentTools } from '../../src/services/chat/tools/askQuestionTools';
import { useAppStore } from '../../src/store/useAppStore';

const QUESTIONS = [
  { question: '第一题？', header: 'Q1', options: [{ label: 'A1' }, { label: 'B1' }] },
  { question: '第二题？', header: 'Q2', options: [{ label: 'A2' }, { label: 'B2' }] },
  { question: '第三题？', header: 'Q3', options: [{ label: 'A3' }, { label: 'B3' }] },
];

function context(over: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    taskId: 'task-1',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    mode: 'autonomous',
    callId: 'call-1',
    signal: new AbortController().signal,
    ...over,
  };
}

/** 与 `ChatPanel` 完全同款的宿主接线。 */
function Harness() {
  return (
    <AskQuestionSheet
      onAnswer={(toolUseId, answer) => {
        answerPendingQuestion(toolUseId, answer);
      }}
    />
  );
}

const pending = () => useAppStore.getState().pendingQuestion;
const optionLabels = (index: number) =>
  screen.getAllByRole('option')[index].getAttribute('aria-selected');

beforeEach(() => {
  clearAgentToolRegistryForTests();
  registerAskQuestionAgentTools();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ currentProjectId: 'project-1', activeConversationId: 'conversation-1' });
});

afterEach(() => {
  cleanup();
  useAppStore.getState().clearPendingQuestion();
  clearAgentToolRegistryForTests();
});

describe('ask_question 多题链路（真实 DOM + 真实工具）', () => {
  it('3 题逐题推进、已答保留；工具只在最后一题后才 resolve', async () => {
    const tool = getAgentTool('ask_question')!;
    let settled = false;
    const running = tool.execute(context(), { questions: QUESTIONS })
      .then((value) => { settled = true; return value; });
    /* 立刻挂上 catch，避免中止类用例出现未处理拒绝噪音（这里不会 reject）。 */
    void running.catch(() => undefined);

    render(<Harness />);

    /* 第 1 题：面板 + 官方进度 `{{current}} / {{total}}`。 */
    expect(screen.getByText('第一题？')).toBeTruthy();
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: '下一题' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '提交' })).toBeNull();

    fireEvent.click(screen.getAllByRole('option')[0]);
    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    await waitFor(() => expect(screen.getByText('第二题？')).toBeTruthy());
    expect(pending()!.step).toBe(1);
    expect(pending()!.collectedAnswers?.[0]).toEqual({ question_id: 'call-1#0', selected_labels: ['A1'] });
    /* 还是 `pending`：工具**没有**被唤醒。 */
    expect(pending()!.status).toBe('pending');
    await Promise.resolve();
    expect(settled).toBe(false);

    /* 第 2 题。 */
    fireEvent.click(screen.getAllByRole('option')[1]);
    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    await waitFor(() => expect(screen.getByText('第三题？')).toBeTruthy());
    expect(pending()!.step).toBe(2);
    expect(pending()!.collectedAnswers?.[0]).toEqual({ question_id: 'call-1#0', selected_labels: ['A1'] });
    expect(pending()!.collectedAnswers?.[1]).toEqual({ question_id: 'call-1#1', selected_labels: ['B2'] });
    await Promise.resolve();
    expect(settled).toBe(false);

    /* 第 3 题（最后一题）：官方按钮文案是 `submit`。 */
    fireEvent.click(screen.getAllByRole('option')[0]);
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    /* 官方 `updatePendingQuestionStatus("answered")`：面板立刻收起（`rq` 只认 `pending`）。 */
    expect(pending()!.status).toBe('answered');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());

    const value = await running;
    expect(value.status).toBe('success');
    expect(value.summary).toContain('3/3');
    /* 官方 `ze = LXe(We.map(DXe), Ke||J)`：多题 ⇒ `{answers:[{question_id, selected_labels}]}`。 */
    expect(value.officialResponse).toEqual({
      answers: [
        { question_id: 'call-1#0', selected_labels: ['A1'] },
        { question_id: 'call-1#1', selected_labels: ['B2'] },
        { question_id: 'call-1#2', selected_labels: ['A3'] },
      ],
    });
    /* 工具收尾 ⇒ 会话态清空（不再 `pending`，也不留 `answered`）。 */
    expect(pending()).toBeNull();
  });

  it('`goPrev` 回退：已答的那一题被原样还原；往回退到未答的题不会伪造答案', async () => {
    useAppStore.getState().setPendingQuestion({
      toolUseId: 'call-1',
      questions: askQuestionsOf({ tool_call_id: 'call-1', request: { questions: QUESTIONS } }),
      status: 'pending',
      step: 0,
      collectedAnswers: [],
    });
    render(<Harness />);

    /* 答第 1 题 → 第 2 题。 */
    fireEvent.click(screen.getAllByRole('option')[0]);
    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    await waitFor(() => expect(screen.getByText('第二题？')).toBeTruthy());

    /* 第 2 题什么都不选，直接回退 ⇒ 官方 `M = null`（写 `null`，不是只有 `question_id` 的空壳）。 */
    fireEvent.click(screen.getByRole('button', { name: '上一题' }));
    await waitFor(() => expect(screen.getByText('第一题？')).toBeTruthy());
    expect(pending()!.step).toBe(0);
    expect(pending()!.collectedAnswers?.[1]).toBeNull();
    /* 第 1 题的答案被原样还原（`aria-selected=true`）。 */
    await waitFor(() => expect(optionLabels(0)).toBe('true'));

    /* 再前进 ⇒ 第 2 题仍空（没被伪造），第 1 题的答案还在。 */
    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    await waitFor(() => expect(screen.getByText('第二题？')).toBeTruthy());
    await waitFor(() => expect(optionLabels(0)).toBe('false'));
    expect(pending()!.collectedAnswers?.[0]).toEqual({ question_id: 'call-1#0', selected_labels: ['A1'] });
  });

  it('停止生成（任务 abort）⇒ 工具按 `AbortError` 拒绝、会话态清空、resolver 不残留', async () => {
    const tool = getAgentTool('ask_question')!;
    const controller = new AbortController();
    const running = tool.execute(
      context({ callId: 'call-stop', signal: controller.signal }),
      { questions: QUESTIONS },
    );
    void running.catch(() => undefined);
    render(<Harness />);

    expect(pending()!.toolUseId).toBe('call-stop');
    expect(hasPendingAskQuestion('call-stop')).toBe(true);

    /* 停在第 2 题时被停止 —— 官方 `Be`(`stopGeneration`) 会把待答问题判成 `cancelled`。 */
    fireEvent.click(screen.getAllByRole('option')[0]);
    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    await waitFor(() => expect(pending()!.step).toBe(1));

    await act(async () => {
      controller.abort();
      await running.catch(() => undefined);
    });

    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
    /* 关键：**不能**留下 `status:"pending"`（否则 `authorize` 永久拒绝后续提问、面板永远挂着）。 */
    expect(pending()).toBeNull();
    expect(hasPendingAskQuestion('call-stop')).toBe(false);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  /**
   * 切会话。官方 `pendingQuestion` 是**per-session** 的（`hs(e).pendingQuestion`），切会话时
   * `Be` @2737720 会把目标会话的待答问题判成 `cancelled` 并 `et(...)` 打断 run；
   * MTV 的 `pendingQuestion` 是**单个全局字段**（不在本轮可改的文件里），所以面板会跟着用户走。
   *
   * 这里只锁「**工具不会被悬空**」这条不变量（无论将来按官方改成 per-session + cancel，
   * 还是保持现状，都必须满足）：待答问题还在等 ⇒ 一定能被作答 ⇒ 工具拿到答案继续跑。
   */
  it('切会话：待答问题不会把工具悬空（仍可作答并 resolve）', async () => {
    const tool = getAgentTool('ask_question')!;
    let settled = false;
    const running = tool.execute(context({ callId: 'call-switch' }), { questions: QUESTIONS })
      .then((value) => { settled = true; return value; });
    void running.catch(() => undefined);
    render(<Harness />);

    await act(async () => {
      useAppStore.getState().setActiveConversation('conversation-2');
    });
    /* 还在等（不是「既没人等、又留着 pending」的死锁态）。 */
    expect(hasPendingAskQuestion('call-switch')).toBe(true);
    expect(pending()?.toolUseId).toBe('call-switch');
    expect(pending()?.status).toBe('pending');
    expect(settled).toBe(false);

    /* 切回来作答 ⇒ 工具照常拿到答案。 */
    fireEvent.click(screen.getAllByRole('option')[0]);
    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    fireEvent.click(screen.getAllByRole('option')[0]);
    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    fireEvent.click(screen.getAllByRole('option')[0]);
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    const value = await running;
    expect(value.status).toBe('success');
    expect(value.officialResponse).toEqual({
      answers: [
        { question_id: 'call-switch#0', selected_labels: ['A1'] },
        { question_id: 'call-switch#1', selected_labels: ['A2'] },
        { question_id: 'call-switch#2', selected_labels: ['A3'] },
      ],
    });
    expect(pending()).toBeNull();
    expect(hasPendingAskQuestion('call-switch')).toBe(false);
  });
});
