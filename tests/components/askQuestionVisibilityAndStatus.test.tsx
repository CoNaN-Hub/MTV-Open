// @vitest-environment jsdom
/**
 * `Qie`(`AskQuestionSheet`) 的**可见性门**与 `Moe`(`AskQuestionSummary`) 的**状态渲染**
 * （对抗性验证轮，覆盖表 §6）。
 *
 * 官方逐字：
 *  · `rq` @32655：`rq=e=>{const t=hs(e).pendingQuestion;return t?.status==="pending"&&(t.questions?.length??0)>0}`
 *    —— 面板可见性的**唯一**真值。
 *  · `jrt` @2558955：`j = d && !o`（`d` = `rq`，`o` = `suppressed`）⇒ `suppressed` 只是**再与一次**，
 *    不是取反；`AskQuestionSheet` 自己也在 store 上订阅 `status`。
 *  · `iQe` @2135482：`r = useStore(p => m?.toolUseId===o ? m.status : null)`；`c = rQe(r,e,i)`；
 *    `if(i.length===0||c==="pending")return null`；`d = c==="answered"`；
 *    `labels = d ? (l[m]??[]) : [t("chatAdapter.askQuestion.unanswered")]`，外壳带 `!d && "opacity-60"`。
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AskQuestionSheet from '../../src/components/chat/AskQuestionSheet';
import AskQuestionSummary from '../../src/components/chat/AskQuestionSummary';
import { askQuestionResponseAnswerOf, askQuestionResponseOf, askQuestionsOf } from '../../src/services/chat/askQuestion';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';

const QUESTIONS = [
  { question: '第一题？', options: [{ label: 'A1' }, { label: 'B1' }] },
  { question: '第二题？', options: [{ label: 'A2' }, { label: 'B2' }] },
  { question: '第三题？', options: [{ label: 'A3' }, { label: 'B3' }] },
];

const QUESTIONS_ZH = askQuestionsOf({ tool_call_id: 'call-1', request: { questions: QUESTIONS } });

const setPending = (status: string) => useAppStore.setState({
  pendingQuestion: {
    toolUseId: 'call-1',
    questions: QUESTIONS_ZH,
    status,
    step: 0,
    collectedAnswers: [],
  },
  multiSelectDraft: [],
});

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  cleanup();
  useAppStore.getState().clearPendingQuestion();
});

describe('面板可见性门（store 的 `status` 是真值，`suppressed` 只做与运算）', () => {
  it('`status:"pending"` + 有题 + `suppressed={false}` ⇒ 渲染', () => {
    setPending('pending');
    render(<AskQuestionSheet onAnswer={() => {}} suppressed={false} />);
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('`status:"answered"`（官方 `answerQuestion` 之后的态）⇒ 面板消失，`suppressed={false}` 也救不回来', () => {
    setPending('answered');
    render(<AskQuestionSheet onAnswer={() => {}} suppressed={false} />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('`status:"cancelled"`（官方 `stopGeneration` / 切会话之后的态）⇒ 面板消失', () => {
    setPending('cancelled');
    render(<AskQuestionSheet onAnswer={() => {}} suppressed={false} />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('`suppressed={true}` + `status:"pending"` ⇒ 不渲染（与 `rq` 做与运算，不是双重取反）', () => {
    setPending('pending');
    render(<AskQuestionSheet onAnswer={() => {}} suppressed />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('`status:"pending"` 但题目为空 ⇒ 不渲染（官方 `rq` 的 `questions.length>0`）', () => {
    useAppStore.setState({
      pendingQuestion: { toolUseId: 'call-1', questions: [], status: 'pending', step: 0, collectedAnswers: [] },
      multiSelectDraft: [],
    });
    render(<AskQuestionSheet onAnswer={() => {}} />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('摘要卡状态渲染（官方 `iQe` + `rQe`）', () => {
  const contentWith = (response?: Record<string, unknown>) => ({
    tool_call_id: 'call-1',
    request: { questions: QUESTIONS },
    ...(response ? { response } : {}),
  });

  it('`pending` ⇒ `return null`（画面由面板承担，不会同时出现「未回答」卡）', () => {
    setPending('pending');
    const { container } = render(<AskQuestionSummary content={contentWith()} />);
    expect(container.textContent).toBe('');
  });

  it('`answered` 但 `response` 还没落盘 ⇒ 按「已答」渲染（**不闪「未回答」**）', () => {
    setPending('answered');
    const { container } = render(<AskQuestionSummary content={contentWith()} />);
    expect(container.textContent).not.toContain('未回答');
    const card = container.querySelector('div.mt-2');
    expect(card?.className).not.toContain('opacity-60');
  });

  it('`null`（MTV 工具收尾清态）+ 无答案 ⇒ 官方 `rQe` 判 `cancelled`（「未回答」+ `opacity-60`）', () => {
    const { container } = render(<AskQuestionSummary content={contentWith()} />);
    expect(container.textContent).toContain('未回答');
    expect(container.querySelector('div.mt-2')?.className).toContain('opacity-60');
  });

  it('已答：3 题按 `question_id` 对齐，`DXe` 形状下选项 label 与自由文本都在', () => {
    const responses = QUESTIONS_ZH.map((question, index) => askQuestionResponseAnswerOf(
      index === 1
        ? { question_id: question.question_id, selected_labels: ['A2', 'B2'], free_text: '自己说' }
        : { question_id: question.question_id, selected_labels: [`A${index + 1}`] },
    ));
    const content = contentWith(askQuestionResponseOf(responses, 'call-1'));
    const { container } = render(<AskQuestionSummary content={content} />);
    expect(container.textContent).toContain('A1');
    expect(container.textContent).toContain('A2');
    expect(container.textContent).toContain('B2');
    expect(container.textContent).toContain('自己说');
    expect(container.textContent).toContain('A3');
    expect(container.textContent).not.toContain('未回答');
    expect(container.querySelector('div.mt-2')?.className).not.toContain('opacity-60');
  });

  it('`answers` 顺序被打乱也按 `question_id` 对齐（官方 `Ioe` 的 Map）', () => {
    const content = contentWith({
      answers: [
        { question_id: 'call-1#2', selected_labels: ['A3'] },
        { question_id: 'call-1#0', selected_labels: ['A1'] },
        { question_id: 'call-1#1', selected_labels: ['A2'] },
      ],
    });
    const { container } = render(<AskQuestionSummary content={content} />);
    const rows = [...container.querySelectorAll('div.flex.flex-wrap')];
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('A1');
    expect(rows[1].textContent).toContain('A2');
    expect(rows[2].textContent).toContain('A3');
  });
});
