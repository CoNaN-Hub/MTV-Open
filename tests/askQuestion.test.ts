/**
 * 官方「提问（ask_question）」纯函数回归。
 *
 * live 官方逐字（`vendor-pkg-canvas-ChpWx5JY.js`）：`jM`@2133355 · `MB`@2133037 · `sQe`@2132960 ·
 * `l_`@2133835 · `Toe`@2127342 · `Ioe`@2134015 · `rQe`@2134510。
 *
 * 两个官方事实被这组测试锁住：
 *  1. 族集合是 `new Set(["AskUserQuestion","ask_question"])`，**取名函数 `xl` 不做任何大小写归一**
 *     ⇒ **两个字面量都命中**（精确匹配）。
 *     ⚠️ **round 120 更正**：本文件原先写的是「`xl()` 会 `toLowerCase()` ⇒ `AskUserQuestion` 永不命中」——
 *     那条与 r100 原文不符。官方 `vendor-pkg-canvas-DuoOicPr.js` @448796 逐字：
 *     `xl=e=>e.type==="tool_event"&&typeof e.content=="object"&&e.content!==null?String(e.content.tool??""):""`
 *     （没有任何 `toLowerCase()`）；集合 @447426、谓词 @449104。
 *  2. 多题上行是 `{answers:[…]}`，每题的 `free_text` 用 `\n` 把「已选标签 + 自由文本」拼成一段；
 *     展示时再按 `\n` 拆回多个 label。
 */
import { describe, expect, it } from 'vitest';
import {
  answerLabels,
  answerLabelsOf,
  askQuestionsOf,
  askQuestionStatus,
  isAskQuestionTool,
} from '../src/services/chat/askQuestion';

const content = (extra: Record<string, unknown>) => ({ tool: 'ask_question', tool_call_id: 'call-1', ...extra });

describe('askQuestionsOf（官方 jM/MB/sQe）', () => {
  it('从 response.questions 抽出多题，并生成缺省 question_id', () => {
    const questions = askQuestionsOf(content({
      response: { questions: [{ question: 'Q1', options: [{ label: 'a' }] }, { question: 'Q2', options: [] }] },
    }));
    expect(questions).toHaveLength(2);
    expect(questions[0].question_id).toBe('call-1#0');
    expect(questions[1].question_id).toBe('call-1#1');
    expect(questions[0].multiSelect).toBe(false);
  });

  it('保留显式 question_id；header 空串归一为 undefined', () => {
    const questions = askQuestionsOf(content({
      response: { questions: [{ question_id: 'q-x', question: 'Q', options: [], header: '' }] },
    }));
    expect(questions[0].question_id).toBe('q-x');
    expect(questions[0].header).toBeUndefined();
  });

  it('multiSelect 兼容 mode:"multiple"', () => {
    const questions = askQuestionsOf(content({
      response: { questions: [{ question: 'Q', options: [], mode: 'multiple' }] },
    }));
    expect(questions[0].multiSelect).toBe(true);
  });

  it('缺 options / 非字符串 question 的条目被过滤；全被过滤时回落 request.questions', () => {
    const questions = askQuestionsOf(content({
      response: { questions: [{ question: 'Q-no-options' }, { options: [] }] },
      request: { questions: [{ question: 'from-request', options: [] }] },
    }));
    expect(questions.map((q) => q.question)).toEqual(['from-request']);
  });

  it('无 questions 数组时，单个 response/request 对象也当成一题', () => {
    const questions = askQuestionsOf(content({ response: { question: 'solo', options: [{ label: 'x' }] } }));
    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe('solo');
  });
});

describe('answerLabels / answerLabelsOf（官方 Toe/l_/Ioe）', () => {
  it('free_text 按 \\n 拆成多个 label', () => {
    expect(answerLabels({ free_text: 'a\nb\n' })).toEqual(['a', 'b']);
  });

  it('无 free_text 时用 selected_labels', () => {
    expect(answerLabels({ selected_labels: ['x', 'y'] })).toEqual(['x', 'y']);
  });

  it('多题 answers 按 question_id 对齐；缺 id 时用 #index 兜底', () => {
    const questions = askQuestionsOf(content({
      response: { questions: [{ question_id: 'q1', question: 'Q1', options: [] }, { question: 'Q2', options: [] }] },
    }));
    const labels = answerLabelsOf(content({
      response: {
        answers: [
          { question_id: 'q1', selected_labels: ['A'] },
          { free_text: 'B' },
        ],
      },
    }), questions);
    expect(labels[0]).toEqual(['A']);
    expect(labels[1]).toEqual(['B']);
  });

  it('空答案不计入 Map；但 `answers` 存在时返回的是「每题一个条目」⇒ 结果仍是 `[[]]`', () => {
    const questions = askQuestionsOf(content({ response: { questions: [{ question: 'Q', options: [] }] } }));
    /* 官方 `Ioe`：`o` 存在时 return `t.map(l => map.get(...) ?? [])` —— 空答案落在 `[]` 兜底上。 */
    expect(answerLabelsOf(content({ response: { answers: [{ question_id: 'x' }] } }), questions)).toEqual([[]]);
  });
});

describe('askQuestionStatus（官方 rQe）', () => {
  const questions = askQuestionsOf(content({ response: { questions: [{ question: 'Q', options: [] }] } }));

  it('有答案 ⇒ answered', () => {
    expect(askQuestionStatus(null, content({ response: { selected_labels: ['A'] } }), questions)).toBe('answered');
  });

  it('无答案 ⇒ cancelled', () => {
    expect(askQuestionStatus(null, content({ response: {} }), questions)).toBe('cancelled');
  });

  it('pendingStatus 优先（会话里还在待答 ⇒ pending）', () => {
    expect(askQuestionStatus('pending', content({ response: {} }), questions)).toBe('pending');
  });
});

describe('isAskQuestionTool（官方 `fEe` + `xl`，逐字精确匹配）', () => {
  it('ask_question 命中', () => {
    expect(isAskQuestionTool('ask_question')).toBe(true);
  });

  /* **用户 2026-10-15 裁决**：判据必须与官方逐字一致 —— 官方 `xl` @448796 **不**做大小写归一，
     集合 `fEe` @447426 含 `"AskUserQuestion"` ⇒ 它**命中**（MTV 自己产出的问答卡用的正是这个字面量）。 */
  it('`AskUserQuestion` **命中**（官方 `xl` 不归一化，集合里就是这个字面量）', () => {
    expect(isAskQuestionTool('AskUserQuestion')).toBe(true);
  });

  it('大小写变体**不**命中（官方是精确集合匹配，MTV 不自行放宽）', () => {
    expect(isAskQuestionTool('ASKUSERQUESTION')).toBe(false);
    expect(isAskQuestionTool('askuserquestion')).toBe(false);
    expect(isAskQuestionTool('Ask_Question')).toBe(false);
  });

  it('其它工具不命中', () => {
    expect(isAskQuestionTool('read')).toBe(false);
    expect(isAskQuestionTool('')).toBe(false);
  });
});
