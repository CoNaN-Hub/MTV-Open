/**
 * 官方 `FormSubmissionSummaryCard`（`lse = a.memo(...)`，`displayName` @2193284）
 * 与 `SubmissionRows`（`tF = a.memo(...)` @2188300 邻域，`displayName = "SubmissionRows"` @2188996）
 * —— 逐字复刻。契约：`D:\DEEPSEEK\live-提问表单族.md` §2.8 / §3.3。
 *
 * 官方 `tF` 原文（@2188360–@2188996）：
 * ```js
 * tF = a.memo(({values:e, unansweredLabel:t, imageFields:n}) => s.jsx("div", {
 *   className:"space-y-1.5", children: e.map(o => s.jsxs("div", {
 *     className:"flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-5", children:[
 *       s.jsx("span",{className:"shrink-0 text-muted-foreground",children:o.field_label}),
 *       n?.has(o.field_id) && Array.isArray(o.value)
 *         ? s.jsx("span",{className:"flex flex-wrap items-center gap-1.5",children:o.value.map(r =>
 *             s.jsx(eF,{fileId:n.get(o.field_id)?.get(r) ?? r, className:"h-9 w-9 rounded-md", iconSize:16}, r))})
 *         : s.jsx("span",{className:z("min-w-0 break-words", o.display ? "text-chat-foreground"
 *             : "text-muted-foreground/50"), children:o.display ?? t})
 *     ]}, o.field_id))}));
 * tF.displayName = "SubmissionRows";
 * ```
 *
 * 官方 `lse` 原文（@2192440–@2193284）：
 * ```js
 * lse = a.memo(({content:e}) => {
 *   const t = a.useMemo(() => qoe(e ?? {}), [e]),
 *         n = qe(hs),
 *         o = a.useMemo(() => Koe(t ? lZe(n.messages, t.tool_call_id) : null), [n.messages, t]),
 *         r = a.useMemo(() => { if (!t) return PM.en;
 *           const i = [t.form_title, ...t.values.map(l => `${l.field_label} ${l.display ?? ""}`)].join(" ");
 *           return PM[Voe(i)] }, [t]);
 *   return t ? s.jsxs("div",{className:"w-full min-w-0 max-w-[360px] space-y-2 rounded-xl bg-white/[0.04] px-3.5 py-3",children:[ … ]}) : null;
 * });
 * lse.displayName = "FormSubmissionSummaryCard";
 * ```
 */
import { memo, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  FORM_LABELS,
  buildImageFieldIndex,
  cx,
  detectFormLanguage,
  findFormDefinitionByToolCallId,
  parseFormSubmission,
  toOfficialMessages,
  type FormSubmissionValue,
  type OfficialMessageLike,
} from '../../services/chat/formSubmission';
import { IconClipboardList } from './officialFormIcons';
import { ThumbnailImage } from './formFieldControls';

// ─────────────────────────────────────────────────────────────────────────────
// SubmissionRows —— 官方 `tF` @2188300 邻域
// ─────────────────────────────────────────────────────────────────────────────

export interface SubmissionRowsProps {
  values: FormSubmissionValue[];
  unansweredLabel: string;
  imageFields?: Map<string, Map<string, string>>;
}

export const SubmissionRows = memo(function SubmissionRowsInner({
  values,
  unansweredLabel,
  imageFields,
}: SubmissionRowsProps) {
  return (
    <div className="space-y-1.5">
      {values.map((value) => (
        <div
          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-5"
          key={value.field_id}
        >
          <span className="shrink-0 text-muted-foreground">{value.field_label}</span>
          {imageFields?.has(value.field_id) && Array.isArray(value.value) ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {value.value.map((id) => (
                <ThumbnailImage
                  fileId={imageFields.get(value.field_id)?.get(id) ?? id}
                  className="h-9 w-9 rounded-md"
                  iconSize={16}
                  key={id}
                />
              ))}
            </span>
          ) : (
            <span
              className={cx(
                'min-w-0 break-words',
                value.display ? 'text-chat-foreground' : 'text-muted-foreground/50',
              )}
            >
              {value.display ?? unansweredLabel}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});
SubmissionRows.displayName = 'SubmissionRows';

// ─────────────────────────────────────────────────────────────────────────────
// FormSubmissionSummaryCard —— 官方 `lse` @2192360 邻域
// ─────────────────────────────────────────────────────────────────────────────

export interface FormSubmissionSummaryCardProps {
  /** 官方 `content`（`form_submission` item 的 `content`）。 */
  content: Record<string, unknown>;
  /** 官方 `qe(hs).messages`；测试/接线可显式覆盖。 */
  messages?: ReadonlyArray<OfficialMessageLike>;
}

export const FormSubmissionSummaryCard = memo(function FormSubmissionSummaryCardInner({
  content,
  messages,
}: FormSubmissionSummaryCardProps) {
  const submission = useMemo(() => parseFormSubmission(content ?? {}), [content]);
  const storeMessages = useAppStore((state) => state.messages);
  const officialMessages = useMemo(
    () => messages ?? toOfficialMessages(storeMessages),
    [messages, storeMessages],
  );
  /** 官方 `o = Koe(lZe(n.messages, t.tool_call_id))`（仅在拿得到 `t` 时求值）。 */
  const imageFields = useMemo(
    () =>
      buildImageFieldIndex(
        submission ? findFormDefinitionByToolCallId(officialMessages, submission.tool_call_id) : null,
      ),
    [officialMessages, submission],
  );
  /** 官方 `r`：**按内容侦测**语言；`!t` 时回退 `PM.en`。 */
  const labels = useMemo(() => {
    if (!submission) return FORM_LABELS.en;
    const sample = [
      submission.form_title,
      ...submission.values.map((value) => `${value.field_label} ${value.display ?? ''}`),
    ].join(' ');
    return FORM_LABELS[detectFormLanguage(sample)];
  }, [submission]);
  return submission ? (
    <div className="w-full min-w-0 max-w-[360px] space-y-2 rounded-xl bg-white/[0.04] px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        <IconClipboardList size={16} stroke={1.5} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 break-words text-xs font-medium leading-4 text-chat-foreground">
          {submission.form_title}
        </span>
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
          {submission.skipped ? labels.skipped : labels.submitted}
        </span>
      </div>
      {!submission.skipped && submission.values.length > 0 ? (
        <SubmissionRows
          values={submission.values}
          unansweredLabel={labels.unanswered}
          imageFields={imageFields}
        />
      ) : null}
    </div>
  ) : null;
});
FormSubmissionSummaryCard.displayName = 'FormSubmissionSummaryCard';
