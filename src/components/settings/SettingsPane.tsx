/**
 * settings/SettingsPane —— 官方设置面板右栏的版式原语（逐字照抄官方实测）
 *
 * 官方出处（9444 实测 + `course-api-base-url-CGXqZmAy.js`）：
 *   · 右栏容器：`flex-1 overflow-hidden`（内容列）；各面板自己给内边距
 *   · 面板头：`<header class="space-y-1.5">` +
 *       `<h2 class="text-lg font-medium leading-7 text-foreground">`（实测 18px / 500 / #f5f5f5）
 *       `<p class="text-sm text-muted-foreground">`（实测 14px / 400 / #7a7a7a）
 *     ⚠️ 不是每个面板都一样：官方「权限」面板的 h2 是 20px / 600 —— 用 `size="lg"` 区分。
 *   · 设置项行：`<section class="flex w-full flex-col gap-4 border-b border-border/60 pb-5
 *                sm:flex-row sm:items-center sm:justify-between sm:gap-8">`
 *       左：`<div class="min-w-0 space-y-1">`
 *           `<h3 class="text-sm font-medium text-foreground">`（14/500/#f5f5f5）
 *           `<p class="text-sm text-muted-foreground">`（14/400/#7a7a7a）
 *       右：控件
 *   · 分段控件：`role="radiogroup" class="flex w-fit shrink-0 gap-1 rounded-lg bg-muted/50 p-1"`
 *       选项：`<label class="flex h-9 min-w-24 cursor-pointer items-center justify-center gap-2
 *              rounded-md px-3 text-sm font-medium transition-colors text-muted-foreground
 *              hover:bg-background/60 hover:text-foreground">` + 16px 图标 + 文字 + `sr-only` radio
 *
 * 尺寸/色值/字号/字重/hover 全在 `styles/settings-panel.css`（含官方实测值）。
 */
import type { ReactNode } from 'react';

/** 官方面板头（h2 + 说明） */
export function SettingsPaneHeader({
  title,
  description,
  size = 'md',
}: {
  title: string;
  description?: string;
  /** 官方「画布设置」是 18/500（`md`）；「权限」是 20/600（`lg`） */
  size?: 'md' | 'lg';
}) {
  return (
    <header className="settings-pane-header">
      <h2
        className="settings-pane-title"
        style={size === 'lg' ? { fontSize: 20, fontWeight: 600, lineHeight: '28px' } : undefined}
      >
        {title}
      </h2>
      {description && <p className="settings-pane-desc">{description}</p>}
    </header>
  );
}

/** 官方设置项行（左标题/说明 + 右控件） */
export function SettingsRow({
  title,
  description,
  children,
  stacked = false,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  /** 控件放不进官方那种两栏行时用（标题在上、控件整块在下），其余仍按官方 `section` */
  stacked?: boolean;
}) {
  return (
    <section className={stacked ? 'settings-row settings-row--stacked' : 'settings-row'}>
      <div className="settings-row-label">
        <h3 className="settings-row-title">{title}</h3>
        {description && <p className="settings-row-desc">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** 官方面板体的通用外框（可滚动 + 官方内边距；官方右栏内容 x≈858，左栏右缘 806 ⇒ 左右各 52px） */
export function SettingsPaneBody({ children }: { children: ReactNode }) {
  return (
    <div className="settings-pane-body flex-1 overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}

export interface SettingsSegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** 官方分段控件（`role="radiogroup"` + `label` 选项 + `sr-only` radio） */
export function SettingsSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: SettingsSegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="settings-segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className="settings-segmented-option" aria-checked={value === option.value}>
          {option.icon}
          <span>{option.label}</span>
          <input
            type="radio"
            className="sr-only"
            name={label}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => { if (!disabled && value !== option.value) onChange(option.value); }}
          />
        </label>
      ))}
    </div>
  );
}
