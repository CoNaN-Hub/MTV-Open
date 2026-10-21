/**
 * 官方 form 表单族的 **9 个字段控件** + `ThumbnailImage` —— 逐字复刻。
 *
 * 取证：`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`（偏移见每个组件上方注释）。
 * 契约：`D:\DEEPSEEK\live-提问表单族.md` §2.7.1–§2.7.11。
 *
 * 每个控件都是官方的 `a.memo(...)` + `displayName`；所有 className / DOM 层级 / 分支条件
 * 按源码逐字，不做「等价简化」。被 shadcn 包装吸收的那层见 `formFieldPrimitives.tsx`
 * （那里集中标注了「官方实体未解析，待替换」）。
 */
import { memo, useId, useInsertionEffect, useState } from 'react';
import {
  cx,
  isCompactOptionLayout,
  optionCardClass,
  optionPillClass,
  resolveFormImageUrl,
  numberOrUndefined,
  type FormField,
  type FormFieldValue,
  type FormLabelSet,
  type FormLanguage,
} from '../../services/chat/formSubmission';
import { IconCalendar, IconCheck, IconMinus, IconPhoto, IconPlus, IconStar, IconStarFilled } from './officialFormIcons';
import {
  Checkbox,
  FormCalendar,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Textarea,
} from './formFieldPrimitives';

/** 控件统一的 onChange 形状（官方 `y(T, E)` 里 `E` 的取值域）。 */
export type FormControlChange = (value: FormFieldValue) => void;

// ─────────────────────────────────────────────────────────────────────────────
// ThumbnailImage —— 官方 `eF = a.memo(...)` @2175637，displayName @2176004
// ─────────────────────────────────────────────────────────────────────────────

export interface ThumbnailImageProps {
  fileId: string;
  alt?: string;
  className?: string;
  iconSize?: number;
}

export const ThumbnailImage = memo(function ThumbnailImageInner({
  fileId,
  alt = '',
  className,
  iconSize = 22,
}: ThumbnailImageProps) {
  const [broken, setBroken] = useState(false);
  return broken ? (
    <span
      className={cx(
        'flex items-center justify-center bg-white/[0.03] text-muted-foreground/40',
        className,
      )}
    >
      <IconPhoto size={iconSize} stroke={1.5} />
    </span>
  ) : (
    <img
      src={resolveFormImageUrl(fileId)}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cx('object-cover', className)}
      onError={() => setBroken(true)}
    />
  );
});
ThumbnailImage.displayName = 'ThumbnailImage';

// ─────────────────────────────────────────────────────────────────────────────
// RadioFieldControl —— 官方 `Qoe = a.memo(...)` @2176875，displayName @2177956
// ─────────────────────────────────────────────────────────────────────────────

export interface RadioFieldControlProps {
  field: FormField;
  value: FormFieldValue;
  onChange: FormControlChange;
}

export const RadioFieldControl = memo(function RadioFieldControlInner({
  field,
  value,
  onChange,
}: RadioFieldControlProps) {
  /* 官方 `const o = a.useId()`：网格态的 label/id 前缀。 */
  const prefix = useId();
  if (isCompactOptionLayout(field)) {
    return (
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((option) => {
          const selected = value === option.value;
          return (
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : option.value)}
              className={optionPillClass(selected)}
              key={option.value}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <RadioGroup
      value={typeof value === 'string' ? value : ''}
      onValueChange={(next) => onChange(next)}
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2"
    >
      {(field.options ?? []).map((option, index) => {
        const selected = value === option.value;
        const htmlId = `${prefix}-${index}`;
        return (
          <label htmlFor={htmlId} className={optionCardClass(selected)} key={option.value}>
            <RadioGroupItem
              id={htmlId}
              value={option.value}
              className="mt-0.5 h-4 w-4 shrink-0 border-white/40 text-chat-foreground data-[state=checked]:border-white"
            />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-xs font-medium leading-5 text-chat-foreground">
                {option.label}
              </span>
              {option.description ? (
                <span className="mt-0.5 block break-words text-[11px] leading-4 text-[var(--form-desc,var(--secondary-muted-foreground))]">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
});
RadioFieldControl.displayName = 'RadioFieldControl';

// ─────────────────────────────────────────────────────────────────────────────
// CheckboxFieldControl —— 官方 `Zoe = a.memo(...)` @2178000 邻域，displayName @2179284
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckboxFieldControlProps {
  field: FormField;
  value: FormFieldValue;
  onChange: FormControlChange;
}

export const CheckboxFieldControl = memo(function CheckboxFieldControlInner({
  field,
  value,
  onChange,
}: CheckboxFieldControlProps) {
  const selected = Array.isArray(value) ? value : [];
  const prefix = useId();
  /* 官方 `i = l => {…}`：取消到空 ⇒ `null`；达到 `max_select` 时**静默忽略**。 */
  const toggle = (optionValue: string) => {
    if (selected.includes(optionValue)) {
      const next = selected.filter((item) => item !== optionValue);
      onChange(next.length > 0 ? next : null);
      return;
    }
    /* 官方原文是 `typeof field.max_select === "number" && o.length >= field.max_select || onChange([...o, l])`。 */
    if (typeof field.max_select === 'number' && selected.length >= field.max_select) return;
    onChange([...selected, optionValue]);
  };
  if (isCompactOptionLayout(field)) {
    return (
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(option.value)}
              className={optionPillClass(isSelected)}
              key={option.value}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
      {(field.options ?? []).map((option, index) => {
        const isSelected = selected.includes(option.value);
        const htmlId = `${prefix}-${index}`;
        return (
          <label htmlFor={htmlId} className={optionCardClass(isSelected)} key={option.value}>
            <Checkbox
              id={htmlId}
              checked={isSelected}
              onCheckedChange={() => toggle(option.value)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded-[4px] border border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
            />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-xs font-medium leading-5 text-chat-foreground">
                {option.label}
              </span>
              {option.description ? (
                <span className="mt-0.5 block break-words text-[11px] leading-4 text-[var(--form-desc,var(--secondary-muted-foreground))]">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
});
CheckboxFieldControl.displayName = 'CheckboxFieldControl';

// ─────────────────────────────────────────────────────────────────────────────
// SelectFieldControl —— 官方 `Joe = a.memo(...)` @2179300 邻域，displayName @2179880
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectFieldControlProps {
  field: FormField;
  value: FormFieldValue;
  labels: FormLabelSet;
  onChange: FormControlChange;
}

export const SelectFieldControl = memo(function SelectFieldControlInner({
  field,
  value,
  labels,
  onChange,
}: SelectFieldControlProps) {
  return (
    <Select
      value={typeof value === 'string' && value ? value : undefined}
      onValueChange={(next) => onChange(next)}
    >
      <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.03] text-[13px] text-chat-foreground shadow-none focus:ring-0 data-[placeholder]:text-muted-foreground/60">
        <SelectValue placeholder={field.placeholder || labels.selectPlaceholder} />
      </SelectTrigger>
      <SelectContent className="border-white/10 bg-[#1c1c1e] text-chat-foreground">
        {(field.options ?? []).map((option) => (
          <SelectItem value={option.value} className="text-xs" key={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
SelectFieldControl.displayName = 'SelectFieldControl';

// ─────────────────────────────────────────────────────────────────────────────
// TextFieldControl —— 官方 `ese = a.memo(...)` @2180080 邻域，displayName @2180471
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `OB`。 */
const TEXT_FIELD_BASE =
  'border-white/10 bg-white/[0.03] text-[13px] md:text-[13px] text-chat-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0';

export interface TextFieldControlProps {
  field: FormField;
  value: FormFieldValue;
  multiline: boolean;
  lang: FormLanguage;
  onChange: FormControlChange;
}

export const TextFieldControl = memo(function TextFieldControlInner({
  field,
  value,
  multiline,
  onChange,
}: TextFieldControlProps) {
  /* 官方 `lang` 参数在实现体里**未被读取**（保留在签名上）。 */
  const text = typeof value === 'string' ? value : '';
  const maxLength = numberOrUndefined(field.max_length);
  return multiline ? (
    <Textarea
      value={text}
      rows={3}
      maxLength={maxLength}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value || null)}
      className={cx(TEXT_FIELD_BASE, 'min-h-[72px] resize-y leading-5')}
    />
  ) : (
    <Input
      value={text}
      maxLength={maxLength}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value || null)}
      className={cx(TEXT_FIELD_BASE, 'h-9')}
    />
  );
});
TextFieldControl.displayName = 'TextFieldControl';

// ─────────────────────────────────────────────────────────────────────────────
// RatingFieldControl —— 官方 `tse = a.memo(...)` @2180485，displayName @2181190
// ─────────────────────────────────────────────────────────────────────────────

export interface RatingFieldControlProps {
  field: FormField;
  value: FormFieldValue;
  onChange: FormControlChange;
}

export const RatingFieldControl = memo(function RatingFieldControlInner({
  field,
  value,
  onChange,
}: RatingFieldControlProps) {
  /** 官方 `const o = Math.min(10, Math.max(1, Math.round(e.max ?? 5)))`。 */
  const starCount = Math.min(10, Math.max(1, Math.round(field.max ?? 5)));
  const current = typeof value === 'number' ? value : 0;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: starCount }, (_, index) => index + 1).map((star) => {
        const filled = current >= star;
        return (
          <button
            type="button"
            onClick={() => onChange(current === star ? null : star)}
            className="cursor-pointer rounded-sm p-0.5 transition-transform hover:scale-110"
            aria-label={`${star}/${starCount}`}
            key={star}
          >
            {filled ? (
              <IconStarFilled size={18} className="text-[var(--form-star,#d4d4d8)]" />
            ) : (
              <IconStar size={18} stroke={1.33} className="text-muted-foreground/50" />
            )}
          </button>
        );
      })}
      {current > 0 ? (
        <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">
          {current}/{starCount}
        </span>
      ) : null}
    </div>
  );
});
RatingFieldControl.displayName = 'RatingFieldControl';

// ─────────────────────────────────────────────────────────────────────────────
// SliderFieldControl —— 官方 `nse = a.memo(...)` @2181190 邻域，displayName @2181629
// ─────────────────────────────────────────────────────────────────────────────

export interface SliderFieldControlProps {
  field: FormField;
  value: FormFieldValue;
  onChange: FormControlChange;
}

export const SliderFieldControl = memo(function SliderFieldControlInner({
  field,
  value,
  onChange,
}: SliderFieldControlProps) {
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const step = field.step ?? 1;
  const current = typeof value === 'number' ? value : min;
  return (
    <div className="flex items-center gap-3">
      <Slider
        value={[current]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0] ?? min)}
        className="flex-1"
      />
      <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {current}
        {field.unit ?? ''}
      </span>
    </div>
  );
});
SliderFieldControl.displayName = 'SliderFieldControl';

// ─────────────────────────────────────────────────────────────────────────────
// DateFieldControl —— 官方 `ose = a.memo(...)` @2182200 邻域，displayName @2183594
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `zB`。 */
const DATE_POPOVER_STYLE_ID = 'tap-agent-form-date-popover-style';

/** 官方 `dZe`（逐字，含换行）。 */
const DATE_POPOVER_CSS = `
.agent-form-date-popover .rdp {
  --rdp-background-color: rgba(255, 255, 255, 0.1);
  --rdp-accent-color: #ffffff;
}
.agent-form-date-popover .rdp-day_selected,
.agent-form-date-popover .rdp-day_selected:focus-visible,
.agent-form-date-popover .rdp-day_selected:hover {
  color: #000000;
  background-color: #ffffff;
}
`;

/** 官方 `uZe`：只在首次挂载时把 `<style id="tap-agent-form-date-popover-style">` 插进 `<head>`。 */
function useDatePopoverStyle() {
  useInsertionEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(DATE_POPOVER_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = DATE_POPOVER_STYLE_ID;
    style.textContent = DATE_POPOVER_CSS;
    document.head.appendChild(style);
  }, []);
}

/**
 * 官方用 date-fns 的 `uue`(`format`)(`d`, `"yyyy-MM-dd"`)。
 * ⚠️ date-fns **不是** MTV 的声明依赖（`package.json` 里没有）⇒ 这里用等价的本地格式化，
 * 输出与 `format(d, "yyyy-MM-dd")` 在全部日期上逐字相同（官方只用于这一处）。
 */
function formatDateIso(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface DateFieldControlProps {
  field: FormField;
  value: FormFieldValue;
  labels: FormLabelSet;
  onChange: FormControlChange;
}

export const DateFieldControl = memo(function DateFieldControlInner({
  field,
  value,
  labels,
  onChange,
}: DateFieldControlProps) {
  const [open, setOpen] = useState(false);
  useDatePopoverStyle();
  const text = typeof value === 'string' ? value : '';
  /* 官方 `const c = l ? new Date(`${l}T00:00:00`) : void 0`。 */
  const selected = text ? new Date(`${text}T00:00:00`) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full cursor-pointer items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 text-[13px] transition-colors hover:bg-white/[0.06]"
        >
          <span className={text ? 'text-chat-foreground' : 'text-muted-foreground/60'}>
            {text || field.placeholder || labels.datePlaceholder}
          </span>
          <IconCalendar size={14} stroke={1.5} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="agent-form-date-popover w-auto rounded-xl border border-solid border-white/20 bg-[#1c1c1e] p-2"
      >
        <FormCalendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onChange(date ? formatDateIso(date) : null);
            setOpen(false);
          }}
          classNames={{
            day: 'inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-xs font-normal text-chat-foreground transition-colors aria-selected:font-medium aria-selected:opacity-100',
            day_selected: 'rdp-day_selected',
            day_today: 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]',
            cell: 'relative p-0 text-center [&:has([aria-selected])]:rounded-md',
            day_outside: 'text-muted-foreground/40',
            day_disabled: 'text-muted-foreground/30 opacity-50',
          }}
        />
      </PopoverContent>
    </Popover>
  );
});
DateFieldControl.displayName = 'DateFieldControl';

// ─────────────────────────────────────────────────────────────────────────────
// NumberFieldControl —— 官方 `sse = a.memo(...)` @2183600 邻域，displayName @2185313
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `u`。 */
const NUMBER_STEP_BUTTON_CLASS =
  'flex h-full w-8 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-chat-foreground disabled:cursor-not-allowed disabled:opacity-30';

export interface NumberFieldControlProps {
  field: FormField;
  value: FormFieldValue;
  onChange: FormControlChange;
}

export const NumberFieldControl = memo(function NumberFieldControlInner({
  field,
  value,
  onChange,
}: NumberFieldControlProps) {
  const current = typeof value === 'number' ? value : null;
  /** 官方 `const r = typeof e.step === "number" && e.step > 0 ? e.step : 1`。 */
  const stepSize = typeof field.step === 'number' && field.step > 0 ? field.step : 1;
  /** 官方 `i = p => { let m = p; …clamp…; return m }`。 */
  const clamp = (input: number) => {
    let next = input;
    if (typeof field.min === 'number' && next < field.min) next = field.min;
    if (typeof field.max === 'number' && next > field.max) next = field.max;
    return next;
  };
  /** 官方 `l = p => { const m = o ?? (typeof e.min === "number" ? e.min : 0); n(i(m + p * r)) }`。 */
  const stepBy = (direction: number) => {
    const base = current ?? (typeof field.min === 'number' ? field.min : 0);
    onChange(clamp(base + direction * stepSize));
  };
  /** 官方 `c`：减号禁用。 */
  const minusDisabled = current !== null && typeof field.min === 'number' && current <= field.min;
  /** 官方 `d`：加号禁用。 */
  const plusDisabled = current !== null && typeof field.max === 'number' && current >= field.max;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 items-center overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
        <button
          type="button"
          disabled={minusDisabled}
          onClick={() => stepBy(-1)}
          className={NUMBER_STEP_BUTTON_CLASS}
          aria-label="minus"
        >
          <IconMinus size={14} stroke={1.5} />
        </button>
        <input
          type="number"
          value={current ?? ''}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          onChange={(event) => {
            const raw = event.target.value;
            if (!raw) {
              onChange(null);
              return;
            }
            const parsed = Number(raw);
            onChange(Number.isFinite(parsed) ? parsed : null);
          }}
          onBlur={() => {
            if (current !== null) {
              const clamped = clamp(current);
              if (clamped !== current) onChange(clamped);
            }
          }}
          className="h-full w-16 border-x border-white/10 bg-transparent text-center text-xs text-chat-foreground outline-none tabular-nums placeholder:text-muted-foreground/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          disabled={plusDisabled}
          onClick={() => stepBy(1)}
          className={NUMBER_STEP_BUTTON_CLASS}
          aria-label="plus"
        >
          <IconPlus size={14} stroke={1.5} />
        </button>
      </div>
      {field.unit ? <span className="text-[11px] text-muted-foreground">{field.unit}</span> : null}
    </div>
  );
});
NumberFieldControl.displayName = 'NumberFieldControl';

// ─────────────────────────────────────────────────────────────────────────────
// ImageSelectFieldControl —— 官方 `rse = a.memo(...)` @2185320 邻域，displayName @2186807
// ─────────────────────────────────────────────────────────────────────────────

export interface ImageSelectFieldControlProps {
  field: FormField;
  value: FormFieldValue;
  onChange: FormControlChange;
}

export const ImageSelectFieldControl = memo(function ImageSelectFieldControlInner({
  field,
  value,
  onChange,
}: ImageSelectFieldControlProps) {
  const selected = Array.isArray(value) ? value : [];
  /** 官方 `r = i => {…}`：与 Checkbox 相同的 `max_select` 守卫（取消到空 ⇒ `null`）。 */
  const toggle = (optionValue: string) => {
    if (selected.includes(optionValue)) {
      const next = selected.filter((item) => item !== optionValue);
      onChange(next.length > 0 ? next : null);
      return;
    }
    if (typeof field.max_select === 'number' && selected.length >= field.max_select) return;
    onChange([...selected, optionValue]);
  };
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
      {(field.options ?? []).map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            type="button"
            aria-pressed={isSelected}
            onClick={() => toggle(option.value)}
            className={cx(
              'group relative cursor-pointer overflow-hidden rounded-lg transition-all',
              !isSelected &&
                'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]',
            )}
            key={option.value}
          >
            {option.file_id ? (
              <ThumbnailImage fileId={option.file_id} alt={option.label} className="aspect-square w-full" />
            ) : (
              <span className="flex aspect-square w-full items-center justify-center bg-white/[0.03] text-muted-foreground/40">
                <IconPhoto size={22} stroke={1.5} />
              </span>
            )}
            {isSelected ? (
              <>
                <span className="pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0_0_0_2px_var(--form-selected-ring,rgba(255,255,255,0.85))]" />
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                  <IconCheck size={12} stroke={2} />
                </span>
              </>
            ) : null}
            {option.label && option.label !== option.value ? (
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-left text-[11px] leading-4 text-white/90">
                {option.label}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
ImageSelectFieldControl.displayName = 'ImageSelectFieldControl';
