/**
 * `OfficialCombobox` —— 官方「国家 / 地区 · 城市 · 语言」那三种下拉的**同一个外壳**。
 *
 * 官方出处：`web/resources/web/assets/index-BiTZf8mJ.js`
 *   · `PSl` @12018716 国家（cmdk Command + Popover，带搜索）
 *   · `TSl` @12017267 城市（同上 + 「使用「{city}」」自定义项）
 *   · 语言    @12037509（Radix Select，**无搜索行**，右侧 ✓）
 *
 * 官方 JSX 逐字（三处共用的那套）：
 * ```jsx
 * <Popover>
 *   <PopoverTrigger asChild>
 *     <button role="combobox" data-state={open?'open':'closed'}
 *       className="flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap px-3 py-2
 *                  transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50
 *                  [&[data-state=open]>svg]:rotate-180"
 *       + (!found || !value) && "text-secondary-accent"
 *       + triggerClassName(L6)>
 *       <span className="min-w-0 flex-1 truncate text-left">{显示名}</span>
 *       <ChevronDown className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200" />
 *     </button>
 *   </PopoverTrigger>
 *   <PopoverContent align="start" side="bottom" sideOffset={4}
 *     className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border-solid
 *                border border-white/5 bg-popover p-0 text-popover-foreground shadow-md">
 *     <Command className="rounded-md bg-popover p-1 text-popover-foreground" filter={includes}>
 *       <CommandInput placeholder={搜索国家…/搜索城市…} className="h-9" />   ← 语言那处没有
 *       <CommandList className="max-h-[260px] gap-0 px-0 py-1">
 *         <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">…</CommandEmpty>
 *         <CommandGroup className="p-0 [&_[cmdk-group-items]]:gap-0">
 *           <CommandItem className="text-sm text-popover-foreground
 *                                    data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground">
 *             <span className="min-w-0 flex-1 truncate">{localizedName}</span>
 *             <Check className={clsx('ml-auto h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
 *           </CommandItem>
 * ```
 *
 * ★ 存的/显的**不是同一个东西**（官方就是这么写的，别"顺手统一"）：
 *     · `value`  = **英文名**（国家 `englishName` / 城市 `name`）—— 落进资料的就是它
 *     · `label`  = **本地化名** —— 触发器与列表显示的就是它
 *   ⇒ 换语言时已选值不变、显示跟着变 ✓
 *
 * ⚠️ 官方原语（radix Popover / cmdk Command、`--radix-popover-trigger-width`）MTV 没有 ⇒
 *   等价位实现：portal 到 body + 按触发器实时 rect 定位（宽度也照抄"与触发器等宽"），
 *   键盘行为按 cmdk：↑↓ 循环、Enter 选中、Esc 关闭、打开即选中首项（官图里首项就是高亮的 ✓）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* ── 内联图标（**不要换回 `<Icon>`**）──
   MTV 的图标走 Iconify **网络**加载（`services/iconCacheService.ts`：API + localStorage 缓存），
   而 `@iconify/react` 在图标未到时**什么都不渲染** —— 搜索行的放大镜晚到 130ms，
   会把输入框从 left 12 推到 36（CDP 逐帧实测：`t=697ms` 搜索行在、图标 null；`t=829ms` 图标到、输入框右移 24px）。
   用户 2026 点名：「点击厂商，搜索这里先出来 搜索厂商，然后再出来图标」。
   ⇒ 这三个图标内联成 SVG（`Select.tsx` 的箭头也是这么做的），路径**逐字复制**自运行中的应用。 */
const ICON_BODY = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function SearchIcon() {
  return (
    <svg className="o-combobox__search-icon" width={16} height={16} viewBox="0 0 24 24" aria-hidden="true">
      <g {...ICON_BODY}>
        <path d="m21 21l-4.34-4.34" />
        <circle cx="11" cy="11" r="8" />
      </g>
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="o-combobox__chevron" width={16} height={16} viewBox="0 0 24 24" aria-hidden="true">
      <g {...ICON_BODY}>
        <path d="m6 9l6 6l6-6" />
      </g>
    </svg>
  );
}

function CheckIcon({ on = false }: { on?: boolean }) {
  return (
    <svg
      className={`o-combobox__check${on ? ' is-on' : ''}`}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <g {...ICON_BODY}>
        <path d="M20 6L9 17l-5-5" />
      </g>
    </svg>
  );
}

export interface ComboboxOption {
  /** 存起来的值（官方 = 英文名 / 语言 code）*/
  value: string;
  /** 显示出来的名字（官方 = 本地化名）*/
  label: string;
}

interface OfficialComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  /** 带搜索行（国家 / 城市）；语言那种「纯列表」传 false */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /**
   * 输入了列表里没有的值时，顶部给一条可选项（官方 `cityUseCustom`：
   * `A = query.trim().length>0 && !列表里已有同名` ⇒ `使用「{city}」`，`forceMount` 所以不受过滤影响）。
   */
  customLabel?: (input: string) => string;
  disabled?: boolean;
  /** 无障碍名（官方这三处用 label 的 `htmlFor`，这里再补一个 aria-label）*/
  ariaLabel?: string;
  className?: string;
}

/** 官方 cmdk 的 `filter`：拿 **item.value 原文**做 includes（城市那边 value 拼了本地化名+英文名）*/
const matches = (haystack: string, query: string) => haystack.toLowerCase().includes(query);

export default function OfficialCombobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  searchable = true,
  searchPlaceholder,
  emptyText,
  customLabel,
  disabled = false,
  ariaLabel,
  className,
}: OfficialComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);

  const selected = useMemo(() => options.find((item) => item.value === value), [options, value]);
  /* 官方：`!found && !value` 才算"空"（值不在表里但非空时按原样显示）*/
  const isEmpty = !selected && !value;
  const display = selected?.label ?? value ?? '';

  /* 过滤：官方把「本地化名 + 英文名 (+ iso2)」拼成一个字符串给 cmdk ⇒ 搜哪个都命中 */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => matches(`${item.label} ${item.value}`, q));
  }, [options, query]);

  /* 官方 `cityUseCustom` 的 `A`：输入非空、且列表里没有同名（本地化名或英文名）*/
  const customValue = query.trim();
  const showCustom = Boolean(customLabel) && customValue.length > 0
    && !options.some((item) => item.label.toLowerCase() === customValue.toLowerCase()
      || item.value.toLowerCase() === customValue.toLowerCase());

  /* 打开时把定位算出来（官方 radix 是 `sideOffset={4}`、宽度 = 触发器宽度）。
     ⚠️ 官方「个人简介」的国家 / 城市实测就是**一律在下方**（用户 2026 明确：「菜单是在下面
        不是在上面，逻辑跟个人简介里国家/城市一样」）⇒ 这里**不做翻转**，保持下方对齐。 */
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) setRect({ left: r.left, top: r.bottom + 4, width: r.width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  /* 外部点击 / Esc 关闭（官方 radix `DismissableLayer`）
     用标记类名判定：面板是 portal 出去的，不在触发器里 */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Element | null;
      if (target?.closest('.o-combobox')) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* 打开：清搜索、高亮**当前选中项**（cmdk 默认选首项；有选中项时选它更符合直觉，
     语言那处官方截图里也是「当前语言」那一行高亮 ✓）*/
  const openPanel = useCallback(() => {
    if (disabled) return;
    setQuery('');
    const at = options.findIndex((item) => item.value === value);
    setActiveIndex(at >= 0 ? at : 0);
    setOpen(true);
    /* 搜索框自动聚焦（cmdk 行为）。
       ⚠️ 必须 `preventScroll`：面板是 `position: fixed` 且常贴着窗口下沿，
          不带这个参数时浏览器会为了让输入框可见去**滚动外层容器**，触发器连同面板一起跑位
          （CDP 实测：触发器被推下去 249px，面板底部出视口）。`Select.tsx` 同样是这么写的。 */
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
  }, [disabled, options, value]);

  const commit = useCallback((next: string) => {
    onChange(next);
    setQuery('');
    setOpen(false);
  }, [onChange]);

  /* 键盘：cmdk 的 ↑↓ 循环 + Enter 选中 */
  const rowCount = filtered.length + (showCustom ? 1 : 0);
  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (rowCount === 0 ? 0 : (prev + 1) % rowCount));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (rowCount === 0 ? 0 : (prev - 1 + rowCount) % rowCount));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (showCustom && activeIndex === 0) { commit(customValue); return; }
      const item = filtered[showCustom ? activeIndex - 1 : activeIndex];
      if (item) commit(item.value);
    }
  }, [activeIndex, commit, customValue, filtered, rowCount, showCustom]);

  return (
    <div className={`o-combobox${className ? ` ${className}` : ''}`}>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder}
        disabled={disabled}
        data-state={open ? 'open' : 'closed'}
        className={`o-combobox__trigger${isEmpty ? ' is-empty' : ''}`}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            openPanel();
          }
        }}
      >
        <span className="o-combobox__value">{display || placeholder}</span>
        <ChevronIcon />
      </button>

      {open && rect && createPortal(
        <div
          ref={panelRef}
          className="o-combobox__panel o-combobox"
          style={{ left: rect.left, top: rect.top, width: rect.width }}
          onKeyDown={onKeyDown}
        >
          {searchable && (
            <div className="o-combobox__search">
              <SearchIcon />
              <input
                ref={inputRef}
                className="o-combobox__input"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              />
            </div>
          )}

          {/* ⚠️ `data-overlay-scrollbar="off"`：关掉 MTV 自绘的悬浮滑条（面板 portal 到 body，
              不关的话它会飘到视口边缘）+ CSS 里再去掉原生条 ⇒ 列表照样能滚，但不出现滑条。 */}
          <div
            className="o-combobox__list"
            role="listbox"
            aria-label={ariaLabel ?? placeholder}
            data-overlay-scrollbar="off"
          >
            {rowCount === 0 && <div className="o-combobox__empty">{emptyText}</div>}
            {showCustom && (
              <button
                type="button"
                role="option"
                aria-selected={activeIndex === 0}
                className={`o-combobox__item${activeIndex === 0 ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(0)}
                onClick={() => commit(customValue)}
              >
                <span className="o-combobox__item-label">{customLabel!(customValue)}</span>
              </button>
            )}
            {filtered.map((item, index) => {
              const row = showCustom ? index + 1 : index;
              const isSelected = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={row === activeIndex}
                  className={`o-combobox__item${row === activeIndex ? ' is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(row)}
                  onClick={() => commit(item.value)}
                >
                  <span className="o-combobox__item-label">{item.label}</span>
                  <CheckIcon on={isSelected} />
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
