/**
 * `ask_question` —— 官方「向用户提问」工具族的 **生产者**（覆盖表 §6 的「补工具生产者」）。
 *
 * 官方链路（源码级）：
 *   · 工具族 `MNe = Set(["AskUserQuestion","ask_question"])`，官方 `xl()` 会 `toLowerCase()`
 *     ⇒ **实际生效的只有 `ask_question`**（`askQuestion.ts` 已记这一点）；
 *   · 官方生产者（@2132894）产出的 `tool_event`：
 *     `{status:"started", tool_call_id: e.question_id, tool_use_id: e.question_id,
 *       tool:"AskUserQuestion", request:{question_id, question, mode, options, …}}`；
 *   · 会话态：`setPendingQuestion({toolUseId, questionId, questions: jM(event), status:"pending"})`
 *     ⇒ 提问面板 `Qie`(`AskQuestionSheet`) 出现；
 *   · 答完最后一题 ⇒ `clearPendingQuestion()`，工具带着答案继续。
 *
 * ⚠️ MTV 侧差异（如实登记）：
 *   1. 官方工具由**服务端**发起，答案是上行给服务端的；MTV 的 `ask_question` 是本地工具
 *      ⇒ 「等待答复」用本地 resolver 表（`askQuestionRuntime`，与审批同款）。
 *   2. 工具名用 `ask_question`（官方实际生效的那个）；渲染层读的是
 *      `content.tool`，`AskQuestionSummary` 的 id 读 `content.tool_use_id ?? content.tool_call_id`
 *      —— MTV 的 `stepToToolEvent` 写的正是 `tool_call_id = callId`，所以用 `context.callId` 当 key。
 *   3. 答案走**新开的** `officialResponse` 通道落到 `content.response`
 *      （官方 `ze = LXe(We.map(DXe), Ke||J)` @2128062；官方 `Ioe`(`answerLabelsOf`) 读的就是它）。
 */
import { useAppStore } from '../../../store/useAppStore';
import type { AskQuestionAnswer } from '../../../types/chat';
import { askQuestionsOf, askQuestionResponseAnswerOf, askQuestionResponseOf } from '../askQuestion';
import { waitForAskQuestionAnswers } from '../askQuestionRuntime';
import { registerAgentTool } from '../toolRegistry';

interface AskQuestionInput {
  /** 官方 `request.questions`（`jM` 会逐题归一化：`question` 必填、`options` 必须是数组）。 */
  questions: Array<{
    question_id?: string;
    question: string;
    options: Array<{ label?: string; description?: string; value?: string }>;
    multiSelect?: boolean;
    header?: string;
  }>;
}

export function registerAskQuestionAgentTools(): Array<() => void> {
  return [registerAgentTool<AskQuestionInput>({
    id: 'ask_question',
    title: '向用户提问',
    description: [
      '向用户提出 1~4 个选择题（每题可给选项与说明，可多选），用户答完后你才会拿到答案。',
      '适合：需求有歧义、需要用户在若干方案里选一个、需要确认关键参数时。',
      '不要在能从画布或上下文推断出来时提问；一次问清最重要的问题，不要连珠炮。',
    ].join(''),
    effect: 'read',
    inputSchema: {
      type: 'object',
      required: ['questions'],
      additionalProperties: false,
      properties: {
        questions: {
          type: 'array',
          minItems: 1,
          maxItems: 4,
          items: {
            type: 'object',
            required: ['question', 'options'],
            additionalProperties: false,
            properties: {
              question_id: { type: 'string' },
              question: { type: 'string' },
              multiSelect: { type: 'boolean' },
              header: { type: 'string' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    label: { type: 'string' },
                    description: { type: 'string' },
                    value: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    summarizeInput: (input) => `向用户提问（${input.questions?.length ?? 0} 题）`,
    authorize: (context) => {
      const store = useAppStore.getState();
      if (store.pendingQuestion?.status === 'pending') {
        return { allowed: false, reason: '已经有一组问题在等用户回答' };
      }
      if (store.currentProjectId !== context.projectId) {
        return { allowed: false, reason: '只能对当前项目提问' };
      }
      return { allowed: true };
    },
    execute: async (context, input) => {
      const store = useAppStore.getState();
      /* key = 官方 `content.tool_call_id`（`AskQuestionSummary` 的 id 就读它）。 */
      const toolUseId = context.callId
        ?? `ask-${context.taskId}-${Math.random().toString(36).slice(2, 8)}`;
      /* 官方 `jM` 归一化（这里给出的 `tool_call_id` 就是它生成 question_id 的 scope）。 */
      const rawQuestions = Array.isArray(input.questions) ? input.questions : [];
      const questions = askQuestionsOf({ request: { questions: rawQuestions }, tool_call_id: toolUseId });
      if (questions.length === 0) {
        return {
          status: 'error',
          summary: '提问失败：没有问题',
          modelContent: 'ask_question 至少需要一道含 question 与 options 的题。',
          retryable: false,
          errorCode: 'ASK_QUESTION_EMPTY',
        };
      }

      /* 官方 `setPendingQuestion({…}, sessionId)` —— 会话态是 **per-session** 的。 */
      store.setPendingQuestion({
        /* 官方按 session 存；MTV 的全局字段自带会话戳（见 `PendingAskQuestion.conversationId`）。 */
        conversationId: context.conversationId,
        toolUseId,
        questionId: questions[0].question_id,
        questions,
        status: 'pending',
        step: 0,
        collectedAnswers: [],
      });

      let answers: AskQuestionAnswer[];
      try {
        answers = await waitForAskQuestionAnswers(toolUseId, context.signal);
      } finally {
        /* 官方答完最后一题 ⇒ `clearPendingQuestion()`；中止时也要清，否则面板会一直挂着。 */
        const current = useAppStore.getState().pendingQuestion;
        if (current?.toolUseId === toolUseId) useAppStore.getState().clearPendingQuestion();
      }

      const answered = answers.filter((answer) => answer
        && ((answer.selected_labels?.length ?? 0) > 0 || !!answer.free_text));
      /* 官方 `Ve` @2718337：`st = We.map(DXe)`（收集态 → 上行/`response` 的一题答案）
         —— 有自由文本时把 `selected_labels` 并进 `free_text`，否则 `Ioe`→`l_` 只读 `free_text`、
         选项 label 会被自由文本吃掉（官方不丢，见 `DXe` @2127785）。
         官方 `ze = LXe(st, Ke||J)` @2128062 ⇒ 写进 `content.response` 的载荷。 */
      const responseAnswers = answers.map(askQuestionResponseAnswerOf);
      const response = askQuestionResponseOf(
        responseAnswers,
        questions[0]?.question_id ?? toolUseId,
      );
      return {
        status: 'success',
        summary: `已收到 ${answered.length}/${questions.length} 个回答`,
        modelContent: JSON.stringify({ answers: responseAnswers }),
        /* 官方 `request.questions`（渲染层 `jM` 读它拿题目）。 */
        officialRequest: { questions: rawQuestions },
        /* 官方 `Ioe`(`answerLabelsOf`) 读 `content.response.answers`（多题）/ `response` 本身（单题）。 */
        officialResponse: response,
      };
    },
  })];
}
