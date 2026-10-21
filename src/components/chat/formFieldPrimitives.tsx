/**
 * 官方 form 表单族里被 shadcn 包装（`vendor-packages-jvPqKqU8.js`）的那几个原语的**替身**。
 *
 * ## ⚠️『官方实体未解析，待替换』
 * 官方这 6 个控件全都建在 Radix / react-day-picker 之上，而 **MTV 没有安装任何它们**：
 * ```
 * node_modules/@radix-ui/ 下只有：collapsible dropdown-menu scroll-area switch tooltip
 *                            + 一批传递依赖（primitive/collection/…）
 * 缺：react-checkbox / react-radio-group / react-select / react-slider / react-popover
 * react-day-picker：未安装（node_modules/react-day-picker 不存在）
 * ```
 * ⇒ 本文件用**极简自研替身**复刻「可判定的那一层」，并逐字保留官方值：
 *   1. **官方 shadcn 包装自身的 base className**（已从 `vendor-packages-jvPqKqU8.js` 逐字抄出，
 *      见每个组件上方注释里的定义偏移）；
 *   2. **官方包装自身的 children 结构**（Indicator / Viewport / ItemIndicator / Thumb / Track 等）；
 *   3. **官方包装自身的 props 语义**（`onCheckedChange` / `onValueChange` / `hideIcon` /
 *      `asChild` / `align` / `side` / `sideOffset` / `mode`/`selected`/`onSelect`）；
 *   4. **Radix 的对外 DOM 契约**里，由官方 class 串**直接反证**存在的部分：
 *      `data-[state=checked]` ⇒ Root 上有 `data-state`；
 *      `data-[placeholder]` ⇒ Value 上有 `data-placeholder`；
 *      `data-[disabled]` ⇒ Item 上有 `data-disabled`；
 *      `[&>span]:line-clamp-1` ⇒ Trigger 内有一个 `span`。
 *   5. Radix **自身内部**实现（焦点陷阱、typeahead、portal 定位、动画 data-* 时序、
 *      `aria-activedescendant` 管理等）**未复刻**，因为源码不在手上、也不许凭记忆写。
 *
 * 因此：门禁能做到「类名/结构/属性与官方一致」，但**不是** Radix 的行为级替换。
 * 等 MTV 装上 `@radix-ui/react-{checkbox,radio-group,select,slider,popover}` 与
 * `react-day-picker` 后，把本文件整体换成真包装即可（对外 API 已按官方对齐）。
 */
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import { cx } from '../../services/chat/formSubmission';
import { RadixCheckIcon, RadixChevronDownIcon } from './officialFormIcons';

// ─────────────────────────────────────────────────────────────────────────────
// Checkbox —— 官方 `vp`（`Y0` @429886，`displayName = Jg.displayName`）
// ─────────────────────────────────────────────────────────────────────────────

/** 官方 `Y0` 的 base。 */
const CHECKBOX_BASE =
  'peer h-4 w-4 shrink-0 border-primary shadow-sm focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground';

/** 官方 `_C`(Indicator) 的 className：`I("flex items-center justify-center text-current")`。 */
const CHECKBOX_INDICATOR_CLASS = 'flex items-center justify-center text-current';

export interface CheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export function Checkbox({ id, checked, onCheckedChange, className, disabled }: CheckboxProps) {
  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      data-disabled={disabled ? '' : undefined}
      disabled={disabled}
      className={cx(CHECKBOX_BASE, className)}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        data-state={checked ? 'checked' : 'unchecked'}
        data-disabled={disabled ? '' : undefined}
        style={{ pointerEvents: 'none' }}
        className={cx(CHECKBOX_INDICATOR_CLASS)}
      >
        <RadixCheckIcon className="h-4 w-4 " />
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RadioGroup / RadioGroupItem —— 官方 `Mfe`(`$0` @438942) / `Pfe`(`kl` @439070)
// ─────────────────────────────────────────────────────────────────────────────

const RADIO_ITEM_BASE =
  'aspect-square h-4 w-4 rounded-full border border-black text-black ring-offset-background focus:outline-hidden focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const RADIO_INDICATOR_CLASS = 'flex items-center justify-center';
const RADIO_DOT_CLASS = 'h-2.5 w-2.5 fill-current text-current';

interface RadioGroupContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children?: ReactNode;
}

/** 官方 `$0`：`<div role="radiogroup">`，base `grid gap-2`。 */
export function RadioGroup({ value, onValueChange, className, children }: RadioGroupProps) {
  const context = useMemo(() => ({ value, onValueChange }), [value, onValueChange]);
  return (
    <div role="radiogroup" className={cx('grid gap-2', className)}>
      <RadioGroupContext.Provider value={context}>{children}</RadioGroupContext.Provider>
    </div>
  );
}

export interface RadioGroupItemProps {
  id?: string;
  value: string;
  className?: string;
}

/** 官方 `kl`：Root 带 base + className，内部 Indicator(`WC`) > Dot(`B1` = lucide `Circle`)。 */
export function RadioGroupItem({ id, value, className }: RadioGroupItemProps) {
  const context = useContext(RadioGroupContext);
  const checked = context?.value === value;
  return (
    <button
      type="button"
      id={id}
      role="radio"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      className={cx(RADIO_ITEM_BASE, className)}
      onClick={() => context?.onValueChange(value)}
    >
      {checked ? (
        <span data-state="checked" style={{ pointerEvents: 'none' }} className={RADIO_INDICATOR_CLASS}>
          <Circle className={RADIO_DOT_CLASS} />
        </span>
      ) : null}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Textarea —— 官方 `vr`(`jn` @438284) / `Wl`(`Kt` @456530)
// ─────────────────────────────────────────────────────────────────────────────

const INPUT_BASE =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

const TEXTAREA_BASE =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

export interface InputProps {
  value: string;
  maxLength?: number;
  placeholder?: string;
  onChange: (event: { target: { value: string } }) => void;
  className?: string;
}

/** 官方 `jn`：不带 `icon` 时直接渲染 `<input>`。 */
export function Input({ value, maxLength, placeholder, onChange, className }: InputProps) {
  return (
    <input
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(event) => onChange({ target: { value: event.target.value } })}
      className={cx(INPUT_BASE, className)}
    />
  );
}

export interface TextareaProps {
  value: string;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  onChange: (event: { target: { value: string } }) => void;
  className?: string;
}

/** 官方 `Kt`：`<textarea data-slot="textarea">`。 */
export function Textarea({ value, rows, maxLength, placeholder, onChange, className }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      value={value}
      rows={rows}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(event) => onChange({ target: { value: event.target.value } })}
      className={cx(TEXTAREA_BASE, className)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slider —— 官方 `Ol`(`vn` @470863)
// ─────────────────────────────────────────────────────────────────────────────

const SLIDER_ROOT_CLASS =
  'group relative flex touch-none select-none items-center data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:flex-col';
const SLIDER_TRACK_CLASS =
  'relative grow overflow-hidden rounded-full bg-white/18 data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5';
const SLIDER_RANGE_CLASS =
  'absolute bg-white data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full';
const SLIDER_THUMB_CLASS =
  'block h-4 w-4 rounded-full border-2 border-white bg-white shadow-md transition-transform ease-in-out group-hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50';

export interface SliderProps {
  value: number[];
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number[]) => void;
  className?: string;
}

/**
 * 官方 `vn`：Root(`ov`) > (Track(`iv`) > Range(`lv`)) + Thumb(`cv`)。
 * 这里用 `input[type=range]` 承担指针/键盘交互（Radix 那套拖拽与 `role="slider"` 语义未复刻），
 * 视觉三层仍按官方渲染：轨道 span > 进度 span，加一枚按官方 class 定位的拇指 span。
 */
export function Slider({ value, min, max, step, onValueChange, className }: SliderProps) {
  const current = value[0] ?? min;
  const percent = max === min ? 0 : ((current - min) / (max - min)) * 100;
  return (
    <span data-orientation="horizontal" className={cx(SLIDER_ROOT_CLASS, className)}>
      <span data-orientation="horizontal" className={SLIDER_TRACK_CLASS}>
        <span data-orientation="horizontal" className={SLIDER_RANGE_CLASS} style={{ width: `${percent}%` }} />
      </span>
      <span
        aria-hidden="true"
        data-orientation="horizontal"
        className={SLIDER_THUMB_CLASS}
        style={{ position: 'absolute', left: `calc(${percent}% - 8px)` }}
      />
      <input
        type="range"
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(event) => onValueChange([Number(event.target.value)])}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Select —— 官方 `Mr`(`Yn` @439535) / `Pr`(`Dn` @439547) / `Rr`(`Zn`) /
//            `Dr`(`Vn` @440561) / `Do`(`Bt` @441810)
// ─────────────────────────────────────────────────────────────────────────────

const SELECT_TRIGGER_CLASS =
  'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1';
const SELECT_TRIGGER_ICON_ROTATE = '[&[data-state=open]>svg]:rotate-180';

const SELECT_CONTENT_CLASS =
  'relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]';
const SELECT_CONTENT_POPPER_CLASS =
  'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1';

const SELECT_VIEWPORT_CLASS = 'p-1';
const SELECT_VIEWPORT_POPPER_CLASS =
  'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]';

const SELECT_ITEM_CLASS =
  'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

interface SelectContextValue {
  value: string | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
  onValueChange: (value: string) => void;
  labels: Record<string, string>;
  registerLabel: (value: string, label: string) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

export interface SelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  children?: ReactNode;
}

/** 官方 `Yn = KC`（Radix Select.Root，**不渲染 DOM**）。 */
export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const registerLabel = useCallback((itemValue: string, label: string) => {
    setLabels((previous) => (previous[itemValue] === label ? previous : { ...previous, [itemValue]: label }));
  }, []);
  const context = useMemo(
    () => ({ value, open, setOpen, onValueChange, labels, registerLabel }),
    [value, open, onValueChange, labels, registerLabel],
  );
  return <SelectContext.Provider value={context}>{children}</SelectContext.Provider>;
}

export interface SelectTriggerProps {
  className?: string;
  children?: ReactNode;
  /** 官方 `hideIcon`（默认 `false`）。 */
  hideIcon?: boolean;
}

/** 官方 `Dn`：`m5`(Radix Select.Trigger) + children + (`!hideIcon && <p5 …/>`)。 */
export function SelectTrigger({ className, children, hideIcon = false }: SelectTriggerProps) {
  const context = useContext(SelectContext);
  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={!!context?.open}
      aria-haspopup="listbox"
      data-state={context?.open ? 'open' : 'closed'}
      className={cx(SELECT_TRIGGER_CLASS, !hideIcon && SELECT_TRIGGER_ICON_ROTATE, className)}
      onClick={() => context?.setOpen(!context.open)}
    >
      {children}
      {!hideIcon ? <RadixChevronDownIcon className="ml-2 h-4 w-4 transition-transform duration-200" /> : null}
    </button>
  );
}

export interface SelectValueProps {
  placeholder?: string;
}

/** 官方 `Zn = qC`（Radix Select.Value）：官方只传 `placeholder`，无 className。 */
export function SelectValue({ placeholder }: SelectValueProps) {
  const context = useContext(SelectContext);
  const selected = context?.value ? (context.labels[context.value] ?? context.value) : undefined;
  return (
    <span data-placeholder={selected ? undefined : ''} style={{ pointerEvents: 'none' }}>
      {selected ?? placeholder}
    </span>
  );
}

export interface SelectContentProps {
  className?: string;
  children?: ReactNode;
}

/** 官方 `Vn`：`XC`(Portal) > `f5`(Content) > [`Q0`(ScrollUp) , `YC`(Viewport), `J0`(ScrollDown)]。 */
export function SelectContent({ className, children }: SelectContentProps) {
  const context = useContext(SelectContext);
  if (!context?.open) return null;
  return (
    <div
      data-state="open"
      data-side="bottom"
      className={cx(SELECT_CONTENT_CLASS, SELECT_CONTENT_POPPER_CLASS, className)}
    >
      <div className={cx(SELECT_VIEWPORT_CLASS, SELECT_VIEWPORT_POPPER_CLASS)}>{children}</div>
    </div>
  );
}

export interface SelectItemProps {
  value: string;
  className?: string;
  children?: ReactNode;
}

/** 官方 `Bt`：`g5`(Item) > [勾槽 `span`(>`ZC`>`U1`), `$C`(ItemText)]。 */
export function SelectItem({ value, className, children }: SelectItemProps) {
  const context = useContext(SelectContext);
  const label = typeof children === 'string' ? children : value;
  const registerLabel = context?.registerLabel;
  useEffect(() => {
    registerLabel?.(value, label);
  }, [registerLabel, value, label]);
  const isSelected = context?.value === value;
  return (
    <div
      role="option"
      aria-selected={isSelected}
      data-state={isSelected ? 'checked' : 'unchecked'}
      data-value={value}
      className={cx(SELECT_ITEM_CLASS, className)}
      onClick={() => {
        context?.onValueChange(value);
        context?.setOpen(false);
      }}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected ? <RadixCheckIcon className="h-4 w-4" /> : null}
      </span>
      <span>{children}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Popover —— 官方 `or`(`Et`) / `sr`(`At`) / `Ls`(`xt` @404564)
// ─────────────────────────────────────────────────────────────────────────────

const POPOVER_CONTENT_CLASS =
  'z-50 w-fit border-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 focus:outline-none';

interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

export interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}

/** 官方 `Et = Dg`（Radix Popover.Root，**不渲染 DOM**）。 */
export function Popover({ open, onOpenChange, children }: PopoverProps) {
  const context = useMemo(() => ({ open, onOpenChange }), [open, onOpenChange]);
  return <PopoverContext.Provider value={context}>{children}</PopoverContext.Provider>;
}

export interface PopoverTriggerProps {
  /** 官方 `asChild`（Radix Slot 语义）：把 props 合并到唯一子元素上。 */
  asChild?: boolean;
  children?: ReactNode;
}

export function PopoverTrigger({ asChild, children }: PopoverTriggerProps) {
  const context = useContext(PopoverContext);
  const toggle = () => context?.onOpenChange(!context.open);
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ onClick?: () => void }>;
    return cloneElement(child, {
      onClick: () => {
        child.props.onClick?.();
        toggle();
      },
    });
  }
  return (
    <button type="button" onClick={toggle}>
      {children}
    </button>
  );
}

export interface PopoverContentProps {
  className?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  children?: ReactNode;
}

/** 官方 `xt`：`Fg`(Portal) > `D1`(Content)，base 为 `z-50 w-fit border-none …`。 */
export function PopoverContent({
  className,
  align = 'center',
  side = 'right',
  sideOffset = 4,
  children,
}: PopoverContentProps) {
  const context = useContext(PopoverContext);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!context?.open) return;
    const onPointerDown = (event: MouseEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) context.onOpenChange(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [context]);
  if (!context?.open) return null;
  return (
    <div
      ref={containerRef}
      data-state="open"
      data-side={side}
      data-align={align}
      data-side-offset={sideOffset}
      style={{ position: 'absolute', zIndex: 50 }}
      className={cx(POPOVER_CONTENT_CLASS, className)}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 日历 —— 官方 `Rfe`(`fK` → vendor-packages `z0`，**react-day-picker**)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️『官方实体未解析，待替换』—— `Rfe` 是 shadcn 的 `Calendar`（`z0`，vendor-packages @424437，
 * 内部 `yC` = **react-day-picker**）。原文（逐字）：
 * ```js
 * function z0({className:e, classNames:t, showOutsideDays:n=!0, ...s}) {
 *   return a.jsx(yC, { showOutsideDays:n, className:e,
 *     classNames: { months:"flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
 *       month:"space-y-4", caption:"flex justify-center pt-1 relative items-center",
 *       caption_label:"text-sm font-medium", nav:"space-x-1 flex items-center",
 *       nav_button:I(vr({variant:"outline"}),"h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
 *       nav_button_previous:"absolute left-1", nav_button_next:"absolute right-1",
 *       table:"w-full border-collapse space-y-1", head_row:"flex",
 *       head_cell:"text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
 *       row:"flex w-full mt-2",
 *       cell:I("relative p-0 text-center text-sm focus-within:relative focus-within:z-20 …", …),
 *       day:I(vr({variant:"ghost"}),"h-8 w-8 p-0 font-normal aria-selected:opacity-100"),
 *       day_range_start:"day-range-start", day_range_end:"day-range-end",
 *       day_selected:"bg-primary text-primary-foreground hover:bg-primary …",
 *       day_today:"bg-accent text-accent-foreground",
 *       day_outside:"day-outside text-muted-foreground aria-selected:bg-accent/50 …",
 *       day_disabled:"text-muted-foreground opacity-50",
 *       day_range_middle:"aria-selected:bg-accent …", day_hidden:"invisible",
 *       ...t },
 *     components:{IconLeft:…, IconRight:…}, ...s });
 * }
 * ```
 * ⇒ 两点官方事实：
 *   1. 调用方的 `classNames` **是** `...t` 展开合并的（官方 `ose` 的 6 个键生效，覆盖 shadcn 默认）；
 *   2. 其余键（`months`/`month`/`caption`/`nav`/`nav_button`/`table`/`head_row`/`head_cell`/`row`…）
 *      用 shadcn 默认值。
 * 本替身：**保留上面全部逐字 class**，但 RDP 自己的网格/键盘/月历内部实现**未复刻**
 * （react-day-picker 未安装、源码不在手上）⇒ 结构按上述 class 键名还原。
 */
export interface FormCalendarProps {
  mode: 'single';
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  classNames: {
    day: string;
    day_selected: string;
    day_today: string;
    cell: string;
    day_outside: string;
    day_disabled: string;
  };
}

/** shadcn `Calendar`（`z0`）里未被官方 `ose` 覆盖的默认 class，逐字。 */
const CALENDAR_DEFAULT_CLASS = {
  months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
  month: 'space-y-4',
  caption: 'flex justify-center pt-1 relative items-center',
  caption_label: 'text-sm font-medium',
  nav: 'space-x-1 flex items-center',
  nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
  nav_button_previous: 'absolute left-1',
  nav_button_next: 'absolute right-1',
  table: 'w-full border-collapse space-y-1',
  head_row: 'flex',
  head_cell: 'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]',
  row: 'flex w-full mt-2',
} as const;

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

export function FormCalendar({ selected, onSelect, classNames }: FormCalendarProps) {
  const [month, setMonth] = useState(() => (selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date()));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = new Date();
  const cells: Array<{ date: Date; outside: boolean }> = [];
  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), index - startOffset + 1), outside: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), day), outside: false });
  }
  return (
    <div className="rdp" data-mode="single">
      <div className={CALENDAR_DEFAULT_CLASS.months}>
        <div className={CALENDAR_DEFAULT_CLASS.month}>
          <div className={CALENDAR_DEFAULT_CLASS.caption}>
            <div className={CALENDAR_DEFAULT_CLASS.nav}>
              <button
                type="button"
                aria-label="Previous Month"
                className={cx(CALENDAR_DEFAULT_CLASS.nav_button, CALENDAR_DEFAULT_CLASS.nav_button_previous)}
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next Month"
                className={cx(CALENDAR_DEFAULT_CLASS.nav_button, CALENDAR_DEFAULT_CLASS.nav_button_next)}
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className={CALENDAR_DEFAULT_CLASS.caption_label} role="presentation">
              {month.getFullYear()}-{String(month.getMonth() + 1).padStart(2, '0')}
            </div>
          </div>
          <table role="grid" className={CALENDAR_DEFAULT_CLASS.table}>
            <thead>
              <tr className={CALENDAR_DEFAULT_CLASS.head_row}>
                {WEEKDAY_LABELS.map((label) => (
                  <th key={label} className={CALENDAR_DEFAULT_CLASS.head_cell}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil(cells.length / 7) }, (_, rowIndex) => (
                <tr key={rowIndex} className={CALENDAR_DEFAULT_CLASS.row}>
                  {cells.slice(rowIndex * 7, rowIndex * 7 + 7).map((cell) => {
                    const isSelected = !!selected && sameDay(cell.date, selected);
                    const isToday = sameDay(cell.date, today);
                    return (
                      <td key={cell.date.toISOString()} className={classNames.cell}>
                        <button
                          type="button"
                          aria-selected={isSelected}
                          className={cx(
                            classNames.day,
                            isSelected && classNames.day_selected,
                            isToday && classNames.day_today,
                            cell.outside && classNames.day_outside,
                          )}
                          onClick={() => onSelect(cell.date)}
                        >
                          {cell.date.getDate()}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
