/**
 * `ask_question` **答案形状 + 多题宿主逻辑**回归（对抗性验证轮）。
 *
 * 官方链路（`vendor-pkg-canvas-ChpWx5JY.js` 逐字，偏移见下），全部在 `askQuestion.ts` 里有对位：
 *  · `AB`  @2127571  面板 `{labels,freeText}` → **收集态**一题答案（trim/去重；空 ⇒ `null`）
 *  · `DXe` @2127785  收集态一题答案 → **上行/`response`** 一题答案（有自由文本时把 labels 并进 `free_text`）
 *  · `LXe` @2128062  一组答案 → `content.response` 载荷（>1 题 `{answers:[…]}`；单题 `{free_text}`/`{selected_labels}`）
 *  · `Ioe` @2134015  `content` → 每题展示 labels（`l_ @2134040` / `Toe @2127342`）
 *  · 宿主 `Ve` @2717400（非数组分支）：写回 `collectedAnswers` → 还有下一题 `setPendingQuestionProgress`
 *    → 最后一题 `updatePendingQuestionStatus("answered", lt)` + `LXe` 并进 `content.response`
 *
 * 验证分级 = **(d) 源码级 + (b) 纯逻辑断言**。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  answerLabelsOf,
  askQuestionAnswerOf,
  askQuestionResponseAnswerOf,
  askQuestionResponseOf,
  askQuestionsOf,
  askQuestionStatus,
} from '../../../src/services/chat/askQuestion';
import {
  answerPendingQuestion,
  hasPendingAskQuestion,
  waitForAskQuestionAnswers,
} from '../../../src/services/chat/askQuestionRuntime';
import { useAppStore } from '../../../src/store/useAppStore';

const QUESTIONS = [
  { question: '第一题？', options: [{ label: 'A1' }, { label: 'B1' }] },
  { question: '第二题？', options: [{ label: 'A2' }, { label: 'B2' }] },
  { question: '第三题？', options: [{ label: 'A3' }, { label: 'B3' }] },
];

const normalized = () => askQuestionsOf({ tool_call_id: 'call-1', request: { questions: QUESTIONS } });

function setPending(raw = QUESTIONS, step = 0, collected: (ReturnType<typeof askQuestionAnswerOf>)[] = []) {
  const questions = askQuestionsOf({ tool_call_id: 'call-1', request: { questions: raw } });
  useAppStore.setState({
    pendingQuestion: { toolUseId: 'call-1', questions, status: 'pending', step, collectedAnswers: collected },
    multiSelectDraft: [],
  });
  return questions;
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  useAppStore.getState().clearPendingQuestion();
  vi.restoreAllMocks();
});

describe('官方 `AB`（面板回调 → 收集态一题答案）', () => {
  it('trim + 去空 + 去重，保留 `question_id`', () => {
    expect(askQuestionAnswerOf({ labels: [' A ', '', 'A', 'B'] }, 'q#0'))
      .toEqual({ question_id: 'q#0', selected_labels: ['A', 'B'] });
  });

  it('自由文本 trim；`selected_labels` 与 `free_text` 可同时存在（收集态就是这么存的）', () => {
    expect(askQuestionAnswerOf({ labels: ['A'], freeText: '  我自己说 ' }, 'q#0'))
      .toEqual({ question_id: 'q#0', selected_labels: ['A'], free_text: '我自己说' });
  });

  it('两者都空 ⇒ `null`（官方 `Ve` 随后 `if(!Ct)return`，**不推进**）', () => {
    expect(askQuestionAnswerOf({ labels: [], freeText: '   ' }, 'q#0')).toBeNull();
    expect(askQuestionAnswerOf(undefined, 'q#0')).toBeNull();
  });
});

describe('官方 `DXe` + `LXe`（收集态 → `content.response`）', () => {
  it('`DXe`：没有自由文本 ⇒ 原样 `selected_labels`', () => {
    expect(askQuestionResponseAnswerOf({ question_id: 'q#0', selected_labels: ['A'] }))
      .toEqual({ question_id: 'q#0', selected_labels: ['A'] });
  });

  it('`DXe`：有自由文本 ⇒ 把 labels 用 `\\n` 并进 `free_text`（官方不丢选项 label）', () => {
    expect(askQuestionResponseAnswerOf({ question_id: 'q#0', selected_labels: ['A', 'B'], free_text: '自己说' }))
      .toEqual({ question_id: 'q#0', free_text: 'A\nB\n自己说' });
  });

  it('`LXe`：>1 题 ⇒ `{answers:[…]}`，缺 `question_id` 的用 `${toolCallId}#${index}` 兜底', () => {
    expect(askQuestionResponseOf([
      { question_id: 'q#0', selected_labels: ['A'] },
      { selected_labels: ['B'] },
    ], 'call-1')).toEqual({
      answers: [
        { question_id: 'q#0', selected_labels: ['A'] },
        { question_id: 'call-1#1', selected_labels: ['B'] },
      ],
    });
  });

  it('`LXe`：单题 ⇒ `{selected_labels}` / `{free_text}`（**不是** `{answers}`）', () => {
    expect(askQuestionResponseOf([{ question_id: 'q#0', selected_labels: ['A'] }], 'call-1'))
      .toEqual({ selected_labels: ['A'] });
    expect(askQuestionResponseOf([{ question_id: 'q#0', free_text: 'A\n自己说' }], 'call-1'))
      .toEqual({ free_text: 'A\n自己说' });
    /* 没有答案（`answers` 为空）时官方 `LXe` 走 `n?.selected_labels ?? []`。 */
    expect(askQuestionResponseOf([], 'call-1')).toEqual({ selected_labels: [] });
  });

  it('`Ioe` 读 `DXe` 结果：多选 + 自由文本 ⇒ 选项 label **不丢**（官方展示语义）', () => {
    const questions = normalized();
    const content = {
      tool_call_id: 'call-1',
      request: { questions: QUESTIONS },
      response: askQuestionResponseOf(
        [askQuestionResponseAnswerOf({ question_id: questions[0].question_id, selected_labels: ['A1', 'B1'], free_text: '自己说' })],
        'call-1',
      ),
    };
    /* 单题：`response` 本身是 `{free_text}` ⇒ `Ioe` 走非数组分支。 */
    expect(answerLabelsOf(content, questions)).toEqual([['A1', 'B1', '自己说']]);
    expect(askQuestionStatus(undefined, content, questions)).toBe('answered');
  });
});

describe('官方宿主 `Ve` 的多题推进（`answerPendingQuestion`）', () => {
  it('逐题推进：前两题 `advanced` 且保留已答，工具不 resolve；最后一题才 `submitted`', async () => {
    setPending();
    const waiting = waitForAskQuestionAnswers('call-1', new AbortController().signal);
    let settled = false;
    void waiting.then(() => { settled = true; });

    expect(answerPendingQuestion('call-1', { labels: ['A1'] })).toBe('advanced');
    let pending = useAppStore.getState().pendingQuestion!;
    expect(pending.step).toBe(1);
    expect(pending.status).toBe('pending');
    expect(pending.collectedAnswers?.[0]).toEqual({ question_id: 'call-1#0', selected_labels: ['A1'] });

    expect(answerPendingQuestion('call-1', { labels: ['B2'] })).toBe('advanced');
    pending = useAppStore.getState().pendingQuestion!;
    expect(pending.step).toBe(2);
    /* 已答的第 1 题被保留。 */
    expect(pending.collectedAnswers?.[0]).toEqual({ question_id: 'call-1#0', selected_labels: ['A1'] });
    expect(pending.collectedAnswers?.[1]).toEqual({ question_id: 'call-1#1', selected_labels: ['B2'] });
    await Promise.resolve();
    expect(settled).toBe(false);

    expect(answerPendingQuestion('call-1', { labels: ['A3'] })).toBe('submitted');
    /* 官方 `updatePendingQuestionStatus("answered")`：面板立刻收起、摘要卡按「已答」渲染。 */
    expect(useAppStore.getState().pendingQuestion?.status).toBe('answered');
    await expect(waiting).resolves.toEqual([
      { question_id: 'call-1#0', selected_labels: ['A1'] },
      { question_id: 'call-1#1', selected_labels: ['B2'] },
      { question_id: 'call-1#2', selected_labels: ['A3'] },
    ]);
  });

  it('不属于当前待答问题 / 状态不是 pending / 空答案 ⇒ `ignored`（不推进、不唤醒）', () => {
    setPending();
    expect(answerPendingQuestion('call-other', { labels: ['A1'] })).toBe('ignored');
    expect(answerPendingQuestion('call-1', { labels: [], freeText: '  ' })).toBe('ignored');
    expect(useAppStore.getState().pendingQuestion?.step).toBe(0);
    useAppStore.getState().updatePendingQuestionStatus('answered');
    expect(answerPendingQuestion('call-1', { labels: ['A1'] })).toBe('ignored');
  });

  it('多选 + 自由文本：收集态两者都存，`response` 里并成 `free_text`（官方 `DXe`）', async () => {
    const single = [{ question: '多选？', multiSelect: true, options: [{ label: 'A' }, { label: 'B' }] }];
    setPending(single);
    const waiting = waitForAskQuestionAnswers('call-1', new AbortController().signal);
    expect(answerPendingQuestion('call-1', { labels: ['A', 'B'], freeText: '自己说' })).toBe('submitted');
    /* 最后一题不会写回 `collectedAnswers`（官方同样只在「还有下一题」时 `setPendingQuestionProgress`）
       —— 答案随 resolve 交给工具。 */
    const submitted = await waiting;
    expect(submitted).toEqual([{ question_id: 'call-1#0', selected_labels: ['A', 'B'], free_text: '自己说' }]);
    const response = askQuestionResponseOf(submitted.map(askQuestionResponseAnswerOf), 'call-1');
    expect(response).toEqual({ free_text: 'A\nB\n自己说' });
    /* `Ioe` 读回来 ⇒ 选项 label 与自由文本都在。 */
    expect(answerLabelsOf(
      { tool_call_id: 'call-1', request: { questions: single }, response },
      askQuestionsOf({ tool_call_id: 'call-1', request: { questions: single } }),
    )).toEqual([['A', 'B', '自己说']]);
  });

  it('没有等待者时 `submitted` ⇒ 不留 `answered` 残影（工具已中止的兜底）', () => {
    /* 停在最后一题，保证这一答就是「提交」。 */
    setPending(QUESTIONS, QUESTIONS.length - 1);
    expect(hasPendingAskQuestion('call-1')).toBe(false);
    expect(answerPendingQuestion('call-1', { labels: ['A1'] })).toBe('submitted');
    expect(useAppStore.getState().pendingQuestion).toBeNull();
  });
});
