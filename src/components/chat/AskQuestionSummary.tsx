/**
 * AskQuestionSummary —— 官方 `Moe`（displayName `AskQuestionSummary`，live bundle 偏移 2135155）1:1 复刻。
 *
 * 渲染点（官方 `@2427028`）：`if (isAskQuestion(e)) return <Moe content={e.content} renderLabel={Iot}/>`
 * —— 即**提问工具的历史卡**（已答/已取消/未答都渲染，pending 时不渲染）。
 *
 * 官方逐字：
 * ```js
 * iQe = ({content, renderLabel}) => {
 *   const id = content?.tool_use_id ?? content?.tool_call_id ?? "";
 *   const pending = useStore(p => { const m = hs(p).pendingQuestion; return m?.toolUseId===id ? m.status : null });
 *   const questions = useMemo(() => jM(content), [content]);
 *   const answers = useMemo(() => Ioe(content, pending), [content, pending]);
 *   const status = rQe(pending, content, pending);
 *   if (questions.length === 0 || status === "pending") return null;
 *   const answered = status === "answered";
 *   const separator = t("chatAdapter.askQuestion.answerSeparator", ", ");
 *   return <div className={cx("mt-2 space-y-1.5 rounded-[10px] bg-white/[0.03] px-3.5 py-2.5",
 *                             !answered && "opacity-60")}>
 *     {questions.map((q, m) => <QuestionRow question={q}
 *       labels={answered ? (answers[m] ?? []) : [t("chatAdapter.askQuestion.unanswered")]}
 *       separator={separator} renderLabel={answered ? renderLabel : undefined} key={q.question_id ?? `summary-${m}`}/>)}
 *   </div>;
 * };
 * ```
 * `QuestionRow`（官方 `joe`）逐字 class：
 * `flex flex-wrap items-baseline gap-x-2 gap-y-0.5` /
 * header `shrink-0 rounded-[5px] bg-white/[0.06] px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground` /
 * question `min-w-[8em] flex-1 text-[13px] leading-[1.6] text-muted-foreground` /
 * labels `min-w-0 max-w-full break-words text-[13px] leading-[1.6] text-chat-foreground`。
 * ⚠️ 摘要里 header chip 是 `bg-white/[0.06]` + `text-muted-foreground`；提问面板里 `HeaderChip` 用的是
 * `bg-white/[0.08]` + `text-chat-foreground` —— **两者不同，逐字如此**。
 *
 * ⚠️ MTV 侧差异（如实记录）：官方 `renderLabel = Iot = text => <hv text={text}/>`（`hv` =
 * `InlineUserReferenceParts`，渲染 `{{node/…}}` / `{{file_ref:…}}` 提及）；MTV 用等价的
 * `ChatReferenceText` 承担。`pendingStatus` 组件会自己从会话态订阅（官方 `iQe` 的 `useStore`）：
 * 面板待答时 `status==="pending"` ⇒ 摘要卡 `return null`；答完最后一题后 MTV 先是 `"answered"`
 * （官方 `answerQuestion` 的 `updatePendingQuestionStatus`），工具收尾再清成 `null`
 * ⇒ `rQe` 回落到「按 `content.response` 里有无答案判定」，两种态都渲染「已答」。
 */
import { memo } from 'react';
import { getLocale, useT } from '../../i18n';
import {
  answerLabelsOf,
  askQuestionStatus,
  askQuestionsOf,
  type AskQuestion,
} from '../../services/chat/askQuestion';
import { askQuestionLabel } from '../../services/chat/askQuestionStrings';
import { useAppStore } from '../../store/useAppStore';
import ChatReferenceText from './ChatReferenceText';

/** 官方 `joe` = `QuestionRow`。 */
const QuestionRow = memo(function QuestionRow({
  question,
  labels,
  separator,
  renderLabel,
}: {
  question: AskQuestion;
  labels: string[];
  separator: string;
  renderLabel?: (label: string) => React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {question.header ? (
        <span className="shrink-0 rounded-[5px] bg-white/[0.06] px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground">
          {question.header}
        </span>
      ) : null}
      <span className="min-w-[8em] flex-1 text-[13px] leading-[1.6] text-muted-foreground">{question.question}</span>
      <span className="min-w-0 max-w-full break-words text-[13px] leading-[1.6] text-chat-foreground">
        {renderLabel
          ? labels.map((label, index) => (
            // 官方用 `<Fragment key={`${label}-${index}`}>`：非首个前插分隔符，再渲染 label。
            <span key={`${label}-${index}`}>
              {index > 0 ? separator : null}
              {renderLabel(label)}
            </span>
          ))
          : labels.join(separator)}
      </span>
    </div>
  );
});

export interface AskQuestionSummaryProps {
  /** 官方 `content`：提问工具的 `content`（含 `request`/`response`）。 */
  content: unknown;
  /** 官方 `pendingQuestion.status`；不传时由组件自己订阅会话态（官方 `iQe` 就是这么做的）。 */
  pendingStatus?: string | null;
}

function AskQuestionSummary({ content, pendingStatus }: AskQuestionSummaryProps) {
  useT(); // 订阅语言切换
  const locale = getLocale();
  /* 官方 `iQe` 里的 `useStore(p => { const m = hs(p).pendingQuestion; return m?.toolUseId===id ? m.status : null })`
     —— **组件自己订阅**会话态（不是外部传）。`id` = `content.tool_use_id ?? content.tool_call_id`；
     MTV 的 `ask_question` 工具用 `AgentToolContext.callId` 当 `pendingQuestion.toolUseId`
     ⇒ 两者是同值（`stepToToolEvent` 写的 `tool_call_id = callId`）。
     ⚠️ 官方在这一步是「正在等用户答」⇒ `status === "pending"` ⇒ 摘要卡 `return null`
     （此时画面由 `Qie`(`AskQuestionSheet`) 承担）；不订阅的话 MTV 会把同一组题**同时**渲染成
     「未回答」摘要卡，与官方不符。 */
  const storePending = useAppStore((state) => state.pendingQuestion);
  const activeConversationId = useAppStore((state) => state.activeConversationId);
  const questionToolId = (() => {
    if (!content || typeof content !== 'object') return '';
    const record = content as Record<string, unknown>;
    if (typeof record.tool_use_id === 'string' && record.tool_use_id) return record.tool_use_id;
    return typeof record.tool_call_id === 'string' ? record.tool_call_id : '';
  })();
  /* 官方读的是 `getSessionState(activeSessionId).pendingQuestion`（**per-session**）⇒
     除 `toolUseId` 之外还要求会话戳一致，否则别的会话的待答状态会串到这条消息上。
     ⚠️ **不要**额外要求 `status === "pending"`：官方那一句是
     `m?.toolUseId===id ? m.status : null` —— `answered` / `cancelled` 也要读出来，
     否则「已答但 response 还没落盘」会闪一下「未回答」。 */
  const pendingMatches = !!storePending
    && storePending.toolUseId === questionToolId
    && (!storePending.conversationId || storePending.conversationId === activeConversationId);
  const resolvedPendingStatus = pendingStatus ?? (pendingMatches ? storePending.status : null);
  const questions = askQuestionsOf(content);
  const answers = answerLabelsOf(content, questions);
  const status = askQuestionStatus(resolvedPendingStatus, content, questions);
  if (questions.length === 0 || status === 'pending') return null;
  const answered = status === 'answered';
  const separator = askQuestionLabel('answerSeparator', locale);
  const unanswered = askQuestionLabel('unanswered', locale);
  /* 官方 `renderLabel = Iot = text => <hv text={text}/>`（`hv` = `InlineUserReferenceParts`）；
     MTV 用等价的 `ChatReferenceText`（渲染 `{{node/…}}` / `{{file_ref:…}}` 提及）。 */
  const renderLabel = (label: string) => <ChatReferenceText value={label} compact />;
  return (
    <div className={`mt-2 space-y-1.5 rounded-[10px] bg-white/[0.03] px-3.5 py-2.5${answered ? '' : ' opacity-60'}`}>
      {questions.map((question, index) => (
        <QuestionRow
          key={question.question_id ?? `summary-${index}`}
          question={question}
          labels={answered ? (answers[index] ?? []) : [unanswered]}
          separator={separator}
          renderLabel={answered ? renderLabel : undefined}
        />
      ))}
    </div>
  );
}

export default memo(AskQuestionSummary);
