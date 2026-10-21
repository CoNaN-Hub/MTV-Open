/**
 * settings/official/OfficialControls —— 官方 TapNow 控件词汇表的 React 封装
 *
 * 样式全部在 `styles/official-controls.css`（值来自官方实测，逐条对得上官方源码里的
 * shadcn 组件定义 `index-BsHyQ2qj.js` @1748503 起那一簇）。
 * 这里只做 props → class 的映射，**不写内联样式**，避免两套来源打架。
 *
 * Button  variants: default / destructive / outline / secondary / ghost / link
 *         sizes:    md(h-9) / sm(h-8) / lg(h-10) / icon(h-9 w-9) / icon-sm(h-7 w-7)
 * 其余：Input / Textarea / Label / Switch / Select / Card / CardRow / Badge /
 *       Toggle / Slider / Note / Tabs
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/* ── Button ─────────────────────────────────────────────────────────── */
export type OfficialButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type OfficialButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface OfficialButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: OfficialButtonVariant;
  size?: OfficialButtonSize;
}

export function OfficialButton({
  variant = 'outline',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: OfficialButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={['o-btn', `o-btn--${variant}`, `o-btn--${size}`, className].filter(Boolean).join(' ')}
    />
  );
}

/* ── Input / Textarea ───────────────────────────────────────────────── */
export interface OfficialInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 输入框内左侧图标（官方：`relative flex items-center w-full` + `absolute left-3` + `pl-10`） */
  leadingIcon?: ReactNode;
}

export function OfficialInput({ className, leadingIcon, ...rest }: OfficialInputProps) {
  const input = <input {...rest} className={['o-input', className].filter(Boolean).join(' ')} />;
  if (!leadingIcon) return input;
  return (
    <div className="o-input-row">
      <span className="o-input-row__icon" aria-hidden="true">{leadingIcon}</span>
      {input}
    </div>
  );
}

export function OfficialTextarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={['o-input', 'o-input--textarea', className].filter(Boolean).join(' ')} />;
}

/* ── Label ──────────────────────────────────────────────────────────── */
export function OfficialLabel({
  children,
  muted = false,
  className,
  htmlFor,
}: {
  children: ReactNode;
  /** 官方 `filled`：true → `text-tap-text-3`（更淡） */
  muted?: boolean;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={['o-label', muted && 'o-label--muted', className].filter(Boolean).join(' ')}>
      {children}
    </label>
  );
}

/* ── Switch ─────────────────────────────────────────────────────────── */
export function OfficialSwitch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** 无障碍名（官方 `aria-label`） */
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="o-switch"
      onClick={() => onChange(!checked)}
    >
      <span className="o-switch__thumb" aria-hidden="true" />
    </button>
  );
}

/* ── Select ─────────────────────────────────────────────────────────
   ⚠️ 官方用的是 radix Select；MTV 有仓库级硬规矩（`tests/components/select.test.tsx`）：
      **只有 `src/components/shared/Select.tsx` 可以出现原生 `<select>`**，业务控件一律走那个
      Portal 版共享 Select。所以这里**不提供**自己的 select 组件，只给一个官方皮肤的类名，
      用的时候挂到共享 Select 的 `triggerClassName` 上：
      ```jsx
      <Select triggerClassName={OFFICIAL_SELECT_TRIGGER} ... />
      ``` */
export const OFFICIAL_SELECT_TRIGGER = 'o-select-trigger';

/* ── Card / 行 ──────────────────────────────────────────────────────── */
export function OfficialCard({ children, solid = false, className }: { children: ReactNode; solid?: boolean; className?: string }) {
  return <div className={['o-card', solid && 'o-card--solid', className].filter(Boolean).join(' ')}>{children}</div>;
}

export function OfficialCardRow({
  icon,
  title,
  description,
  trailing,
  center = false,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={['o-card__row', center && 'o-card__row--center', className].filter(Boolean).join(' ')}>
      {icon}
      <div className="o-card__body">
        <div className="o-card__title">{title}</div>
        {description && <div className="o-card__desc">{description}</div>}
      </div>
      {trailing}
    </div>
  );
}

/* ── Badge ──────────────────────────────────────────────────────────── */
export type OfficialBadgeTone = 'secondary' | 'outline' | 'primary' | 'success' | 'warning' | 'danger';

export function OfficialBadge({
  children,
  tone = 'secondary',
  small = false,
  className,
}: {
  children: ReactNode;
  tone?: OfficialBadgeTone;
  small?: boolean;
  className?: string;
}) {
  return (
    <span className={['o-badge', small ? 'o-badge--sm' : `o-badge--${tone}`, className].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}

/* ── Toggle（分段/开关按钮） ────────────────────────────────────────── */
export function OfficialToggle({
  pressed,
  onClick,
  children,
  disabled = false,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="button" aria-pressed={pressed} disabled={disabled} className="o-toggle" onClick={onClick}>
      {children}
    </button>
  );
}

/* ── Slider ─────────────────────────────────────────────────────────── */
export function OfficialSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  suffix,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="o-slider">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {suffix !== undefined && <span className="o-slider__value">{suffix}</span>}
    </div>
  );
}

/* ── Note（说明块） ─────────────────────────────────────────────────── */
export function OfficialNote({
  children,
  tone = 'default',
  icon,
}: {
  children: ReactNode;
  tone?: 'default' | 'info' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
}) {
  return (
    <div className={['o-note', tone !== 'default' && `o-note--${tone}`].filter(Boolean).join(' ')}>
      {icon}
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
