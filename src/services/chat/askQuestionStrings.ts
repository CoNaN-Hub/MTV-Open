/**
 * 官方 `chatAdapter.askQuestion.*` 里 `AskQuestionSummary` 用到的两个键（live 逐字，5 语言）。
 *
 * | key | en | fr | ja | ko | zh |
 * |---|---|---|---|---|---|
 * | `unanswered`      | `Not answered` | `Sans réponse` | `未回答` | `미응답` | `未回答` |
 * | `answerSeparator` | `, `           | `, `           | `、`     | `, `     | `、`     |
 *
 * 只放这两键是因为它们属于 `chatAdapter.askQuestion` 命名空间，不适合并入
 * `agentEventStrings.ts`（那是 `chatAdapter.agentEvent` 组）。其余 askQuestion 键（`submit`/`next`/
 * `prev`/`progress`/`hintFreeText`/`freeText`/`emptyFreeText`）由 `AskQuestionSheet` 落地时一并加入。
 */
const ASK_QUESTION_LABELS: Record<string, Record<string, string>> = {
  'zh-CN': {
    unanswered: '未回答',
    answerSeparator: '、',
    freeText: '我有其他想法',
    emptyFreeText: '请输入你的想法后再发送。',
    hintFreeText: '或直接打字回答，@ 引用节点 / 素材',
    next: '下一题',
    prev: '上一题',
    confirm: '确认',
    answered: '已回答：',
    submit: '提交',
    progress: '{{current}} / {{total}}',
  },
  'en-US': {
    unanswered: 'Not answered',
    answerSeparator: ', ',
    freeText: 'I have another idea',
    emptyFreeText: 'Enter your answer first.',
    hintFreeText: 'or type your answer, @ to reference',
    next: 'Next',
    prev: 'Back',
    confirm: 'Confirm',
    answered: 'Answered: ',
    submit: 'Submit',
    progress: '{{current}} / {{total}}',
  },
  'ja-JP': {
    unanswered: '未回答',
    answerSeparator: '、',
    freeText: '他のアイデアがあります',
    emptyFreeText: '回答を入力してから送信してください。',
    hintFreeText: 'または直接入力して回答、@ で参照',
    next: '次へ',
    prev: '戻る',
    confirm: '確認',
    answered: '回答済み：',
    submit: '送信',
    progress: '{{current}} / {{total}}',
  },
  'ko-KR': {
    unanswered: '미응답',
    answerSeparator: ', ',
    freeText: '다른 아이디어가 있어요',
    emptyFreeText: '답변을 먼저 입력해 주세요.',
    hintFreeText: '또는 직접 입력해 답변, @로 참조',
    next: '다음',
    prev: '이전',
    confirm: '확인',
    answered: '답변 완료: ',
    submit: '제출',
    progress: '{{current}} / {{total}}',
  },
};

/** 取官方 `chatAdapter.askQuestion.<key>`（未知 locale 回落英文；未知 key 原样返回）。 */
export function askQuestionLabel(key: string, locale: string): string {
  const table = ASK_QUESTION_LABELS[locale] ?? ASK_QUESTION_LABELS['en-US'];
  return table[key] ?? ASK_QUESTION_LABELS['en-US'][key] ?? key;
}
