/**
 * 官方 `FormCard`（`ase = a.memo(...)` @2189027，`displayName = "FormCard"` @2192338）
 * 与 `FormFieldBlock`（`ise = a.memo(...)` @2186835，`displayName = "FormFieldBlock"` @2188287）
 * —— 逐字复刻。契约：`D:\DEEPSEEK\live-提问表单族.md` §2.5 / §2.6。
 *
 * 官方 `FormCard` 原文（`vendor-pkg-canvas-ChpWx5JY.js` @2189040–@2192338，压缩名保留）：
 * ```js
 * ase=a.memo(({content:e,onSubmitForm:t})=>{const n=qe(hs),o=n.isLoading,
 *   r=a.useMemo(()=>Hoe(e??{}),[e]),i=e?.tool_call_id??e?.tool_use_id??"",
 *   l=a.useMemo(()=>cZe(n.messages,i),[n.messages,i]),
 *   [c,d]=a.useState(!1),[u,p]=a.useState({}),[m,f]=a.useState({}),
 *   h=a.useMemo(()=>{const T=r?qQe(r):"";return Voe(T)},[r]),g=PM[h],
 *   x=a.useMemo(()=>rZe(sZe(r?.accent),r?.display_type==="bubble"),[r?.accent,r?.display_type]),
 *   y=a.useCallback((T,E)=>{p(k=>({...k,[T]:E})),f(k=>{if(!k[T])return k;const I={...k};return delete I[T],I})},[]),
 *   b=a.useCallback(()=>{…校验→iZe→t(i,r.title,values,!1)→d(!1)…},[r,t,o,i,u,g,h]),
 *   _=a.useCallback(()=>{…t(i,r.title,[],!0)→d(!1)…},[r,t,o,i]),
 *   v=a.useCallback(()=>{…回填→f({})→d(!0)…},[o,l]);
 *   if(!r)return null;
 *   const w=!!l&&!c,C=o||!t,S=r.form_icon!=="none",N=r.display_type==="bubble"; …});
 * ```
 *
 * 官方 `FormFieldBlock` 原文（@2186920–@2188287）：
 * ```js
 * ise=a.memo(({field:e,value:t,error:n,labels:o,lang:r,bubble:i,onChange:l})=>{
 *   const c=af(e),d=a.useCallback(p=>l(e.id,p),[e.id,l]);let u;
 *   switch(c){case"radio":…;case"checkbox":…;case"select":…;case"rating":…;case"slider":…;
 *     case"date":…;case"number":…;case"image_select":…;
 *     default:u=s.jsx(ese,{field:e,value:t,multiline:c!=="text"||e.multiline===!0,lang:r,onChange:d})}
 *   return s.jsxs("div",{className:z("space-y-2.5",i&&"rounded-xl bg-[var(--form-section-bg,rgba(255,255,255,0.08))] px-4 py-3.5"),…});
 * });
 * ```
 */
import { memo, useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  FORM_LABELS,
  buildFormAccentVars,
  buildFormLanguageSample,
  buildImageFieldIndex,
  cx,
  detectFormLanguage,
  findSubmissionByToolCallId,
  formFieldType,
  normalizeFormAccent,
  parseFormContent,
  serializeSubmissionValues,
  toOfficialMessages,
  validateField,
  type FormField,
  type FormFieldValue,
  type FormLabelSet,
  type FormLanguage,
  type FormSubmission,
  type FormSubmissionValue,
  type FormValues,
  type OfficialMessageLike,
} from '../../services/chat/formSubmission';
import { IconCheck, IconClipboardList, IconPencil } from './officialFormIcons';
import {
  CheckboxFieldControl,
  DateFieldControl,
  ImageSelectFieldControl,
  NumberFieldControl,
  RadioFieldControl,
  RatingFieldControl,
  SelectFieldControl,
  SliderFieldControl,
  TextFieldControl,
} from './formFieldControls';
import { SubmissionRows } from './FormSubmissionSummaryCard';

/** 官方 `Oe`（`submitForm` @2730480）的前四个参数。 */
export type FormSubmitHandler = (
  toolCallId: string,
  formTitle: string,
  values: FormSubmissionValue[],
  skipped: boolean,
) => void;

/**
 * 官方 `tool_event.content` 的宽松形状（本组件只读 `tool_call_id` / `tool_use_id` / `response` / `request`）。
 */
export type FormEventContent = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// FormFieldBlock —— 官方 `ise` @2186835
// ─────────────────────────────────────────────────────────────────────────────

export interface FormFieldBlockProps {
  field: FormField;
  value: FormFieldValue;
  error?: string;
  labels: FormLabelSet;
  lang: FormLanguage;
  bubble: boolean;
  onChange: (fieldId: string, value: FormFieldValue) => void;
}

export const FormFieldBlock = memo(function FormFieldBlockInner({
  field,
  value,
  error,
  labels,
  lang,
  bubble,
  onChange,
}: FormFieldBlockProps) {
  const kind = formFieldType(field);
  const handleChange = useCallback(
    (next: FormFieldValue) => onChange(field.id, next),
    [field.id, onChange],
  );
  let control;
  switch (kind) {
    case 'radio':
      control = <RadioFieldControl field={field} value={value} onChange={handleChange} />;
      break;
    case 'checkbox':
      control = <CheckboxFieldControl field={field} value={value} onChange={handleChange} />;
      break;
    case 'select':
      control = (
        <SelectFieldControl field={field} value={value} labels={labels} onChange={handleChange} />
      );
      break;
    case 'rating':
      control = <RatingFieldControl field={field} value={value} onChange={handleChange} />;
      break;
    case 'slider':
      control = <SliderFieldControl field={field} value={value} onChange={handleChange} />;
      break;
    case 'date':
      control = (
        <DateFieldControl field={field} value={value} labels={labels} onChange={handleChange} />
      );
      break;
    case 'number':
      control = <NumberFieldControl field={field} value={value} onChange={handleChange} />;
      break;
    case 'image_select':
      control = <ImageSelectFieldControl field={field} value={value} onChange={handleChange} />;
      break;
    default:
      control = (
        <TextFieldControl
          field={field}
          value={value}
          multiline={kind !== 'text' || field.multiline === true}
          lang={lang}
          onChange={handleChange}
        />
      );
      break;
  }
  return (
    <div
      className={cx(
        'space-y-2.5',
        bubble && 'rounded-xl bg-[var(--form-section-bg,rgba(255,255,255,0.08))] px-4 py-3.5',
      )}
    >
      <div className={bubble ? 'space-y-1.5' : 'space-y-1'}>
        <div
          className={cx(
            bubble
              ? 'text-[13px] font-semibold leading-5 text-[var(--form-title,#e4e4e7)]'
              : 'text-[13px] font-medium leading-5 text-chat-foreground',
          )}
        >
          {field.label}
          {field.required ? <span className="ml-0.5 text-red-400">*</span> : null}
        </div>
        {field.description ? (
          <div className="text-xs leading-5 text-[var(--form-desc,var(--secondary-muted-foreground))]">
            {field.description}
          </div>
        ) : null}
      </div>
      {control}
      {error ? <div className="text-xs leading-4 text-red-400">{error}</div> : null}
    </div>
  );
});
FormFieldBlock.displayName = 'FormFieldBlock';

// ─────────────────────────────────────────────────────────────────────────────
// FormCard —— 官方 `ase` @2189027
// ─────────────────────────────────────────────────────────────────────────────

export interface FormCardProps {
  /** 官方 `content`（`tool_event.content`）。 */
  content: FormEventContent;
  /** 官方 `onSubmitForm`；缺省 ⇒ 按钮进入官方 `C = o || !t` 的禁用态。 */
  onSubmitForm?: FormSubmitHandler;
  /** 官方 `hs(e).messages`；测试/接线可显式覆盖。 */
  messages?: ReadonlyArray<OfficialMessageLike>;
  /** 官方 `hs(e).isLoading`。MTV store **没有**该字段（见接线说明），默认 `false`。 */
  isLoading?: boolean;
}

export const FormCard = memo(function FormCardInner({
  content,
  onSubmitForm,
  messages,
  isLoading = false,
}: FormCardProps) {
  const storeMessages = useAppStore((state) => state.messages);
  const officialMessages = useMemo(
    () => messages ?? toOfficialMessages(storeMessages),
    [messages, storeMessages],
  );

  const form = useMemo(() => parseFormContent(content ?? {}), [content]);
  const toolCallId =
    (typeof content?.tool_call_id === 'string' ? (content.tool_call_id as string) : undefined) ??
    (typeof content?.tool_use_id === 'string' ? (content.tool_use_id as string) : undefined) ??
    '';
  const submission = useMemo(
    () => findSubmissionByToolCallId(officialMessages, toolCallId),
    [officialMessages, toolCallId],
  );

  /** 官方 `[c, d] = a.useState(!1)`：编辑态。 */
  const [editing, setEditing] = useState(false);
  /** 官方 `[u, p] = a.useState({})`：当前字段值。 */
  const [values, setValues] = useState<FormValues>({});
  /** 官方 `[m, f] = a.useState({})`：字段错误。 */
  const [errors, setErrors] = useState<Record<string, string>>({});

  const lang = useMemo<FormLanguage>(
    () => detectFormLanguage(form ? buildFormLanguageSample(form) : ''),
    [form],
  );
  const labels = FORM_LABELS[lang];
  const accentVars = useMemo(
    () => buildFormAccentVars(normalizeFormAccent(form?.accent), form?.display_type === 'bubble'),
    [form?.accent, form?.display_type],
  );

  /** 官方 `y`：写值并清掉该字段错误。 */
  const handleChange = useCallback((fieldId: string, next: FormFieldValue) => {
    setValues((previous) => ({ ...previous, [fieldId]: next }));
    setErrors((previous) => {
      if (!previous[fieldId]) return previous;
      const copy = { ...previous };
      delete copy[fieldId];
      return copy;
    });
  }, []);

  /** 官方 `b`：校验 → 全通过才提交。 */
  const handleSubmit = useCallback(() => {
    if (!form || !onSubmitForm || isLoading || !toolCallId) return;
    const nextErrors: Record<string, string> = {};
    for (const field of form.fields) {
      const error = validateField(field, values[field.id] ?? null, labels, lang);
      if (error) nextErrors[field.id] = error;
    }
    setErrors(nextErrors);
    if (!(Object.keys(nextErrors).length > 0)) {
      onSubmitForm(toolCallId, form.title, serializeSubmissionValues(form.fields, values), false);
      setEditing(false);
    }
  }, [form, onSubmitForm, isLoading, toolCallId, values, labels, lang]);

  /** 官方 `_`：跳过。 */
  const handleSkip = useCallback(() => {
    if (!form || !onSubmitForm || isLoading || !toolCallId) return;
    onSubmitForm(toolCallId, form.title, [], true);
    setEditing(false);
  }, [form, onSubmitForm, isLoading, toolCallId]);

  /** 官方 `v`：进入编辑态并用已提交值回填。 */
  const handleEdit = useCallback(() => {
    if (isLoading) return;
    if (submission && !submission.skipped) {
      const restored: FormValues = {};
      for (const item of submission.values) restored[item.field_id] = item.value ?? null;
      setValues(restored);
    }
    setErrors({});
    setEditing(true);
  }, [isLoading, submission]);

  if (!form) return null;

  /** 官方 `w = !!l && !c`。 */
  const submitted = !!submission && !editing;
  /** 官方 `C = o || !t`。 */
  const disabled = isLoading || !onSubmitForm;
  /** 官方 `S = r.form_icon !== "none"`（缺省 `undefined` ⇒ 显示图标）。 */
  const showIcon = form.form_icon !== 'none';
  /** 官方 `N = r.display_type === "bubble"`。 */
  const bubble = form.display_type === 'bubble';

  return (
    <div
      className={cx(
        'mt-2 w-full min-w-0 max-w-[720px] space-y-5',
        !bubble &&
          'rounded-[14px] bg-[var(--form-card-bg,#1f1f1f)] p-4 shadow-[inset_0_0_0_1px_var(--form-card-ring,rgba(255,255,255,0.08))]',
      )}
      style={accentVars as CSSProperties | undefined}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {showIcon ? (
            <IconClipboardList size={16} stroke={1.5} className="shrink-0 text-muted-foreground" />
          ) : null}
          <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-[var(--form-title,#e4e4e7)]">
            {form.title}
          </span>
          {submitted ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
              <IconCheck size={12} stroke={1.5} />
              {submission?.skipped ? labels.skipped : labels.submitted}
            </span>
          ) : null}
        </div>
        {form.description && !submitted ? (
          <div className="text-xs leading-5 text-[var(--form-desc,var(--secondary-muted-foreground))]">
            {form.description}
          </div>
        ) : null}
      </div>
      {submitted && submission ? (
        <div className="space-y-3">
          {!submission.skipped && submission.values.length > 0 ? (
            <SubmissionRows
              values={submission.values}
              unansweredLabel={labels.unanswered}
              /* 官方内联写 `Koe(r)`（@2175150）。 */
              imageFields={buildImageFieldIndex(form)}
            />
          ) : null}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleEdit}
            className={cx(
              'inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors',
              isLoading ? 'opacity-40' : 'cursor-pointer hover:text-chat-foreground',
            )}
          >
            <IconPencil size={12} stroke={1.5} />
            {labels.edit}
          </button>
        </div>
      ) : (
        <>
          <div className={bubble ? 'space-y-2.5' : 'space-y-6'}>
            {form.fields.map((field) => (
              <FormFieldBlock
                key={field.id}
                field={field}
                value={values[field.id] ?? null}
                error={errors[field.id]}
                labels={labels}
                lang={lang}
                bubble={bubble}
                onChange={handleChange}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={handleSubmit}
              className={cx(
                'inline-flex h-9 items-center justify-center rounded-full px-6 text-sm font-medium transition-all',
                disabled
                  ? 'bg-white/[0.03] text-muted-foreground/40 cursor-not-allowed'
                  : 'cursor-pointer bg-[var(--form-btn-bg,rgba(255,255,255,0.10))] text-[var(--form-btn-fg,#d4d4d8)] shadow-[inset_0_0_0_1px_var(--form-btn-ring,transparent)] hover:bg-[var(--form-btn-bg-hover,rgba(255,255,255,0.16))]',
              )}
            >
              {form.submit_label || labels.submit}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleSkip}
              className={cx(
                'shrink-0 px-2 text-xs text-muted-foreground transition-colors',
                disabled ? 'opacity-40' : 'cursor-pointer hover:text-chat-foreground',
              )}
            >
              {labels.skip}
            </button>
          </div>
        </>
      )}
    </div>
  );
});
FormCard.displayName = 'FormCard';

/** 供接线方使用的类型别名（官方 `FormSubmission` / `FormSubmissionValue`）。 */
export type { FormSubmission, FormSubmissionValue };
