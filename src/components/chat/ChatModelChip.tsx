/**
 * ChatModelChip —— 官方**聊天输入条**里的模型胶囊（官方 `Ae`）**逐字移植**。
 *
 * 官方出处：live `vendor-pkg-canvas-ChpWx5JY.js` @93300 邻域（`Ae = <button …>`），
 * 并有 **live CDP 9222 实测 outerHTML** 作为对照（`_live_chips.txt`）。
 *
 * 官方逐字（触发钮）：
 * ```jsx
 * <button type="button" disabled={t||K||Q} aria-disabled={V||undefined} onPointerDown={ie} onClick={ie}
 *   className={cx("flex h-[26px] min-w-[26px] items-center overflow-hidden rounded-md",
 *     n ? "max-w-[26px] shrink-0 justify-center px-[5px]" : "max-w-[188px] shrink-0 px-2 sm:max-w-[228px]",
 *     "bg-transparent text-text-text-primary",
 *     "transition-[max-width,padding,background-color] duration-150 ease-out motion-reduce:transition-none",
 *     V ? "cursor-default" : "cursor-pointer hover:bg-accent",
 *     "disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent",
 *     "focus:outline-none focus-visible:outline-none")}
 *   aria-label={Z} data-icon-only={n||undefined}>
 *   {Y ? <Skeleton className={cx("h-4 shrink-0 rounded-md transition-[width] duration-150 …", n?"w-4":"w-20")}/>
 *    : q ? (模型错误变体：标签块 + cd(size 14, stroke 1.5, className 里按 n 决定是否 ml-1))
 *    : (<>
 *        {B?.iconSrc
 *          ? <span className="flex size-4 shrink-0 items-center justify-center"><img src={B.iconSrc} alt="" aria-hidden="true" className={mq(B)}/></span>
 *          : <span aria-hidden data-compact-control-icon="model"
 *                  className={cx("flex shrink-0 items-center justify-center overflow-hidden transition-[width,opacity] duration-150 …",
 *                                n ? "w-4 opacity-100" : "w-0 opacity-0")}><ia size={16} stroke={1.5} className="shrink-0"/></span>}
 *        <span aria-hidden={n} data-adaptive-control-content="model"
 *          className={cx("grid min-w-0 transition-[grid-template-columns,opacity,margin] duration-150 …",
 *                        n ? "ml-0 grid-cols-[0fr] opacity-0" : cx("grid-cols-[1fr] opacity-100", B?.iconSrc ? "ml-1" : "ml-0"))}>
 *          <span className="flex min-w-0 items-center overflow-hidden whitespace-nowrap">
 *            <span className="min-w-0 truncate text-xs font-medium leading-5">{ge}</span>
 *            {H ? <span className="ml-1 shrink-0 border-l border-border/60 pl-1.5 text-[11px] leading-4 text-text-text-secondary">{H}</span> : null}
 *            {V ? null : <Hl size={14} stroke={1.5} className={cx("ml-1 shrink-0 transition-transform duration-150 …", N && "rotate-180")}/>}
 *          </span>
 *        </span>
 *      </>)}
 * </button>
 * ```
 * 其中 `Hl` 在 live DOM 里是 **Tabler `chevron-down`**（`width/height=14`、`stroke-width=1.5`、
 * `class="tabler-icon tabler-icon-chevron-down ml-1 shrink-0 transition-transform duration-150 motion-reduce:transition-none"`、
 * `<path d="M6 9l6 6l6 -6">`）—— 逐字见 `_live_chips.txt`。
 *
 * ⚠️ MTV 侧差异（如实记录）：
 *   1. 官方整个胶囊是 Radix `DropdownMenu` 的 Trigger（live DOM 有 `id="radix-…"` / `aria-haspopup="menu"` /
 *      `aria-expanded` / `data-state` / `data-slot="dropdown-menu-trigger"`）；MTV 的模型下拉是自建弹层
 *      ⇒ 这里把这些属性按官方**同名签出**（由调用方传入打开态），DOM 属性与官方一致。
 *   2. 官方图标取自模型目录的 `iconSrc`（data-URI SVG）与 `mq(model)` 尺寸类；MTV 由调用方以 `icon` ReactNode 注入，
 *      尺寸类由 `modelProviderIconClass()` 逐字实现官方 `mq`。
 */
import type { ReactNode } from 'react';

export interface ChatModelChipProps {
  /** 官方 `ge`：胶囊文案（`Auto` / 模型名）。 */
  label: string;
  /** 官方 `B?.iconSrc`：品牌图（`<img>`）。给了就走官方的 `span.flex.size-4 > img` 分支。 */
  icon?: ReactNode;
  /** 官方 `H`：次级信息（Effort），渲染在竖线之后。 */
  secondary?: string;
  /** 官方 `n`：`data-icon-only` 形态（rail 窄时只留图标）。 */
  iconOnly?: boolean;
  /** 官方 `Y`：加载中 → 骨架条。 */
  loading?: boolean;
  /** 官方 `V`：禁用（不渲染箭头）。 */
  disabled?: boolean;
  /** 官方 `N`：菜单打开态（箭头 `rotate-180`）。 */
  open?: boolean;
  /** 官方 `q`：模型错误态（走 `model-error` 分支，带自己的图标槽）。 */
  errorIcon?: ReactNode;
  /** 官方 `Z`：`aria-label`。 */
  ariaLabel?: string;
  onClick?: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  /** 官方 Radix Trigger 的属性（由调用方签出，保持 DOM 与官方一致）。 */
  triggerId?: string;
}

export default function ChatModelChip({
  label,
  icon,
  secondary,
  iconOnly = false,
  loading = false,
  disabled = false,
  open = false,
  errorIcon,
  ariaLabel,
  onClick,
  onPointerDown,
  triggerId,
}: ChatModelChipProps) {
  const className = [
    'flex h-[26px] min-w-[26px] items-center overflow-hidden rounded-md',
    iconOnly ? 'max-w-[26px] shrink-0 justify-center px-[5px]' : 'max-w-[188px] shrink-0 px-2 sm:max-w-[228px]',
    'bg-transparent text-text-text-primary',
    'transition-[max-width,padding,background-color] duration-150 ease-out motion-reduce:transition-none',
    disabled ? 'cursor-default' : 'cursor-pointer hover:bg-accent',
    'disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent',
    'focus:outline-none focus-visible:outline-none',
  ].join(' ');

  return (
    <button
      type="button"
      id={triggerId}
      disabled={disabled}
      data-icon-only={iconOnly || undefined}
      aria-label={ariaLabel}
      aria-haspopup="menu"
      aria-expanded={open}
      data-state={open ? 'open' : 'closed'}
      data-slot="dropdown-menu-trigger"
      onPointerDown={onPointerDown}
      onClick={onClick}
      className={className}
    >
      {loading ? (
        /* 官方 `$n`（shadcn Skeleton）：`animate-pulse rounded-md bg-input/30` + 宽度随形态。 */
        <span
          className={`animate-pulse rounded-md bg-input/30 h-4 shrink-0 transition-[width] duration-150 ease-out motion-reduce:transition-none ${iconOnly ? 'w-4' : 'w-20'}`}
        />
      ) : errorIcon ? (
        <>
          <span
            aria-hidden={iconOnly}
            data-adaptive-control-content="model-error"
            className={`grid min-w-0 transition-[grid-template-columns,opacity,margin] duration-150 ease-out motion-reduce:transition-none ${iconOnly ? 'grid-cols-[0fr] opacity-0' : 'grid-cols-[1fr] opacity-100'}`}
          >
            <span className="min-w-0 overflow-hidden">
              <span className="block truncate text-xs font-medium leading-5">{label}</span>
            </span>
          </span>
          <span className={`shrink-0 transition-[margin] duration-150 ease-out motion-reduce:transition-none${iconOnly ? '' : ' ml-1'}`}>
            {errorIcon}
          </span>
        </>
      ) : (
        <>
          {icon ? (
            <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
          ) : (
            <span
              aria-hidden
              data-compact-control-icon="model"
              className={`flex shrink-0 items-center justify-center overflow-hidden transition-[width,opacity] duration-150 ease-out motion-reduce:transition-none ${iconOnly ? 'w-4 opacity-100' : 'w-0 opacity-0'}`}
            >
              {/* 官方 `ia`（`Ae` 的正常分支里 `B?.iconSrc` 为空时的**兜底图标**）。
                  三步解析：canvas 本地名 `ia` ← import `iz as ia` ← vendor-libs `export{VAn as iz}`
                  ← `VAn = p("outline","sparkles","Sparkles", hAi)`（vendor-libs @2971176）
                  ⇒ **Tabler `sparkles`**（单条 path）。
                  渲染 = 官方工厂 `p("outline",…)`：`class = "tabler-icon tabler-icon-sparkles shrink-0"`
                  + outline 默认属性 + `width/height = size(16)`、`strokeWidth = stroke(1.5)`。
                  ⚠️ 这里以前是**自绘四角星占位** ⇒ 小屏 `data-icon-only` 时露出来的形状与官方不一致。 */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="tabler-icon tabler-icon-sparkles shrink-0"
                aria-hidden="true"
              >
                <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z" />
              </svg>
            </span>
          )}
          <span
            aria-hidden={iconOnly}
            data-adaptive-control-content="model"
            className={`grid min-w-0 transition-[grid-template-columns,opacity,margin] duration-150 ease-out motion-reduce:transition-none ${iconOnly ? 'ml-0 grid-cols-[0fr] opacity-0' : `grid-cols-[1fr] opacity-100${icon ? ' ml-1' : ' ml-0'}`}`}
          >
            <span className="flex min-w-0 items-center overflow-hidden whitespace-nowrap">
              <span className="min-w-0 truncate text-xs font-medium leading-5">{label}</span>
              {secondary ? (
                <span className="ml-1 shrink-0 border-l border-border/60 pl-1.5 text-[11px] leading-4 text-text-text-secondary">{secondary}</span>
              ) : null}
              {disabled ? null : (
                /* 官方 `Hl` = Tabler `chevron-down`（live DOM 逐字）。 */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`tabler-icon tabler-icon-chevron-down ml-1 shrink-0 transition-transform duration-150 motion-reduce:transition-none${open ? ' rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6l6 -6" />
                </svg>
              )}
            </span>
          </span>
        </>
      )}
    </button>
  );
}
