/**
 * ToolbarMoreMenu — 节点工具栏上的「⋯ 浏览全部」菜单。
 *
 * ★ 官方依据（TapNowExtract · `zoom-slider-3ZcFvYQO.js` @1479352 `dPe` 的 `buttonType:"more"` 分支）：
 *   - 触发器 tooltip = `common.more` =「浏览全部」；
 *   - `menuItems` 为空 ⇒ **整个 ⋯ 按钮不渲染**（`if(!m?.length)return null`）；
 *   - 菜单是**竖向「图标 + 文字」列表**（不是横排图标条）：
 *     容器 `min-w-[220px] rounded-2xl border-none px-1 py-2 bg-[#2F2F2F]`
 *       + `shadow-[0px_4px_16px_rgba(0,0,0,0.16),inset_0px_0.5px_0px_rgba(255,255,255,0.16)]`，`align:"start" sideOffset:8`；
 *     行 `gap-1.5 rounded px-2 py-1.5 text-sm font-normal text-white/90 hover:bg-white/10`
 *       + `[&_svg:not([class*='size-'])]:size-5`；
 *     分隔线 `my-1 mx-0.5 h-[0.5px] bg-white/[0.10]`；
 *     子面板（宫格预览那种）在行右侧 `left-full pl-3` 淡入。
 *   - 禁用行：`opacity-50`（无 lockedTooltip 时再叠 `pointer-events-none`）。
 *
 * ★ 官方菜单里其实有**三种行形态**（`dPe` 的 `m?.map`）：
 *     ① `separator`      → `my-1 mx-0.5 h-[0.5px] bg-white/[0.10]`
 *     ② 有 `renderHoverContent` → 行 `text-sm **font-normal** hover:bg-white/10`，
 *        右侧「子操作 chips + `›` + hover 子面板」（快速切分 = 2×2/3×3/4×4 + 8×8 宫格面板）
 *     ③ 有 `subActions`（无 hover 内容）→ 行 `text-sm font-medium`，右侧同样有 chips（无箭头/面板）
 *     ④ 普通项 → `Uo` = DropdownMenuItem：`text-sm font-medium` + `focus:bg-accent`(#404040)
 *   本组件用「有没有 chips / hover 面板」在 ② 与 ④ 之间二选一（③ MTV 暂无使用者）。
 *
 * 为不影响其它节点工具栏，官方竖向形态走 `variant="official"`；不传则保持旧的横排图标菜单。
 */
import { Fragment, memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import type { ToolbarMenuRowDef } from '../../../../types';
import AnimatedButton from '../../../shared/AnimatedButton';
import { OfficialIcon } from '../../../sidebar/OfficialIcon';

interface ToolbarMoreMenuProps {
  /**
   * 菜单行。用 `ToolbarMenuRowDef`（`icon` 可选）—— `ToolbarButtonDef` 结构上兼容它，
   * 所以图像/文本工具栏照旧传 registry 里的按钮定义，行为不变。
   */
  items: ToolbarMenuRowDef[];
  renderItem: (key: string) => ReactNode;
  /**
   * 触发器外观（含 tooltip 文案 / testid / 图标）。
   *
   * ⚠️ 不传 = 旧的「⋯ 浏览全部」形态（`OfficialIcon name="more"` + `浏览全部`），
   * 图像/文本工具栏因此**行为不变**。
   * 传入用于「本项自己就是官方 `buttonType:"more"` 的下拉」的场景 —— 官方视频卡的
   * `video_frame_capture` 就是这样一颗（桌面版 `course-api-base-url-DmmB7bTf.js@2687052`：
   * `buttonType:"more"` · `tooltip: y("video.captureFrame")` =「截帧」 · `tooltipInsideTrigger:!0` ·
   * `dataTestId: …CAPTURE_FRAME_BTN`）。
   */
  trigger?: {
    /** tooltip / aria-label 文案（官方 `tooltip`） */
    label: string;
    /** 触发器图标：iconify 名，或直接给 ReactNode（用于官方原版 SVG） */
    icon: string | ReactNode;
    /** 图标对应的官方原版 SVG 名（`OfficialIcon` 注册表）；给了就优先用它，20×20 */
    officialIcon?: string;
    /** 触发器附加 class（默认 `ftb-btn icon-only act-more`） */
    className?: string;
    /** `data-testid`（官方 `dataTestId`） */
    testId?: string;
    /**
     * 触发器禁用（官方 `disabled` 那一维）。
     * ⚠️ 与「`items` 为空 ⇒ 连触发器都不渲染」不同：这里**保留触发器**（布局按官方给禁用态，
     * 官方 `cPe` 的项级门是 `invisible` 才不渲染，`disabled` 只是 `cursor-not-allowed opacity-40`）。
     */
    disabled?: boolean;
  };
  /** 'official' = 官方竖向「图标+文字」行（本组件的目标形态）；'legacy' = 旧横排图标条 */
  variant?: 'legacy' | 'official';
  /** 行点击（官方形态必传）：把点击派发回工具栏自己的 actionMap */
  onSelect?: (key: string) => void;
  /**
   * 行的图标（官方形态必传，复用工具栏的 DefIcon，保证 officialIcon 优先）。
   *
   * ⚠️ 这里**故意用 `{ bivarianceHack(...) }['bivarianceHack']` 这种写法**：
   * 它让形参走**双变**检查。调用方传的是 `DefIcon`（形参收 `ToolbarButtonDef`，它要读 `officialIcon`），
   * 而本组件内部传进来的是 `ToolbarMenuRowDef`（`icon` 可选）。用普通的函数属性写法会因逆变报
   * 「`icon` 可能是 undefined」；用双变写法两边都成立 —— **不为一个类型去改调用方**。
   */
  renderIcon?: { bivarianceHack(def: ToolbarMenuRowDef): ReactNode }['bivarianceHack'];
  /** 行后内联展开的子面板（宫格裁切用），返回 null 表示不展开 */
  renderExpanded?: (key: string) => ReactNode;
  /** 行的动态禁用/文案（如「超分处理中...」）—— 同样用双变写法（理由见 `renderIcon`） */
  getRowState?: { bivarianceHack(def: ToolbarMenuRowDef): { disabled?: boolean; tooltip?: string } | undefined }['bivarianceHack'];
  /** 官方行的**子操作 chips**（`dPe` 的 `E.subActions`）：如快速切分的 2×2 / 3×3 / 4×4 */
  getSubActions?: (key: string) => ToolbarSubAction[] | undefined;
  /** 官方行的**右侧 hover 子面板**（`E.renderHoverContent`）：如快速切分的 8×8 宫格面板 */
  renderHoverContent?: (key: string, close: () => void) => ReactNode;
  /** 官方 `E.onHoverEnd`：鼠标离开该行时回调（用于清掉宫格高亮预览） */
  onRowHoverEnd?: (key: string) => void;
}

/**
 * 官方 `dPe` 菜单行里的子操作（`E.subActions`）：
 *   `{ key, label, handle, disabled?, lockedTooltip?, onMouseEnter? }`
 *   点击 = `N.handle()` 然后**关闭菜单**（官方 `v(!1)`）；hover 时先跑 `onMouseEnter`（宫格高亮预览）。
 */
export interface ToolbarSubAction {
  key: string;
  label: string;
  disabled?: boolean;
  lockedTooltip?: string;
  onMouseEnter?: () => void;
  handle: () => void;
}

function ToolbarMoreMenu({
  items,
  renderItem,
  trigger,
  variant = 'legacy',
  onSelect,
  renderIcon,
  renderExpanded,
  getRowState,
  getSubActions,
  renderHoverContent,
  onRowHoverEnd,
}: ToolbarMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const toggleMenu = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (trigger?.disabled) return;
    setOpen((current) => !current);
  }, [trigger?.disabled]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as globalThis.Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // 官方：`menuItems` 为空 ⇒ 按钮自身也不渲染
  if (items.length === 0) return null;

  const official = variant === 'official';
  const triggerLabel = trigger?.label ?? '浏览全部';
  const triggerClassName = trigger?.className ?? 'ftb-btn icon-only act-more';

  return (
    <div ref={wrapperRef} className="toolbar-more-wrap nodrag">
      <AnimatedButton
        type="button"
        /* ★ 官方 ⋯ 触发器**没有** active/选中态：`dPe` 的 more 分支渲染按钮时**刻意不传 `active`**
           （Menu 打开只是 Popover 的 `open`），hover 仅由 obsidian 高光层表达
           ⇒ MTV 原来跟的 `is-active` 类已去掉（样式也一并删了）。 */
        className={triggerClassName}
        data-testid={trigger?.testId}
        data-tooltip={triggerLabel}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={trigger?.disabled}
        onClick={toggleMenu}
      >
        {/* 不传 trigger = 官方 `dPe` 的 more 分支：触发器图标 = `jU`（20×20 viewBox 三点），
            tooltip = `common.more`「浏览全部」 */}
        {/* §93 官方工具栏图标恒 **20×20**（`xXe` 每颗键 `size:20`）；`more` 触发器 `xq` 也是 20。
            MTV 原来字符串图标走 14×14 ⇒ 已对齐到 20。 */}
        {trigger
          ? (typeof trigger.icon === 'string'
            ? (trigger.officialIcon
              ? <OfficialIcon name={trigger.officialIcon} size={20} />
              : <Icon icon={trigger.icon} width={20} height={20} />)
            : trigger.icon)
          : <OfficialIcon name="more" size={20} />}
      </AnimatedButton>

      {open && (
        <div
          className={`toolbar-more-menu nodrag${official ? ' toolbar-more-menu--official' : ''}`}
          role="menu"
          aria-label={triggerLabel}
          onClick={(event) => {
            event.stopPropagation();
            if (official) return; // 官方形态：宫格等子面板需要保持打开，只由外部点击/Esc 关闭
            const target = event.target as HTMLElement;
            if (!target.closest('.act-multigrid')) setOpen(false);
          }}
        >
          {official
            ? items.map((item) => {
              const state = getRowState?.(item);
              const locked = item.lockedTooltip;
              const disabled = state?.disabled ?? !!(item.disabled || locked);
              const label = state?.tooltip ?? locked ?? item.label;
              const subActions = getSubActions?.(item.key);
              const hoverContent = renderHoverContent?.(item.key, () => setOpen(false));
              /* ★ 官方菜单有**两种行**（`dPe`）：
                   ① 带 `renderHoverContent` / `subActions` 的行 —— `div.group/menuitem … text-sm **font-normal**
                      hover:bg-white/10`，右侧是子操作 chips + `›` + hover 子面板（见 styles/nodes.css）
                   ② 普通行 —— `Uo`(DropdownMenuItem) `font-medium` + `focus:bg-accent`(#404040)
                 ⇒ 这里按「有没有子操作/子面板」二选一，不混用。 */
              if (subActions?.length || hoverContent) {
                return (
                  <div
                    key={item.key}
                    className="toolbar-more-menu-row toolbar-more-menu-row--hover"
                    role="menuitem"
                    aria-disabled={disabled || undefined}
                    onMouseLeave={() => onRowHoverEnd?.(item.key)}
                  >
                    <span className="toolbar-more-menu-row-icon">{renderIcon?.(item)}</span>
                    <span className="toolbar-more-menu-row-label">{label}</span>
                    {subActions?.length ? (
                      <span className="toolbar-more-subactions">
                        {subActions.map((sub) => {
                          const subLocked = sub.lockedTooltip;
                          const subDisabled = !!(sub.disabled || subLocked);
                          return (
                            <button
                              key={sub.key}
                              type="button"
                              className="toolbar-more-subaction"
                              title={subLocked}
                              aria-disabled={subDisabled || undefined}
                              disabled={!!sub.disabled && !subLocked}
                              onMouseEnter={() => { if (!subDisabled) sub.onMouseEnter?.(); }}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (subDisabled) {
                                  event.preventDefault();
                                  return;
                                }
                                /* 官方：`N.handle(); v(!1)` —— 执行子操作并**关闭菜单** */
                                sub.handle();
                                setOpen(false);
                              }}
                            >
                              {sub.label}
                            </button>
                          );
                        })}
                      </span>
                    ) : null}
                    <span className="toolbar-more-chevron" aria-hidden="true">›</span>
                    {hoverContent ? (
                      <span className="toolbar-more-hoverpanel">{hoverContent}</span>
                    ) : null}
                  </div>
                );
              }
              return (
                <Fragment key={item.key}>
                  <button
                    type="button"
                    role="menuitem"
                    className="toolbar-more-menu-row"
                    /* ★ 官方普通行（`dPe` 菜单第 4 分支，`Uo` = DropdownMenuItem）的点击语义，逐字：
                         onClick:    `if (E.lockedTooltip) { N.preventDefault(); return } E.handle?.(N.currentTarget)`
                         aria-disabled: `E.disabled || !!E.lockedTooltip`
                         disabled:   `E.disabled && !E.lockedTooltip`
                       ⇒ **锁定项不是原生 disabled**（仍可 hover 出 tooltip，只是点了不执行）；
                         而纯禁用项才是原生 disabled（配 `data-disabled:pointer-events-none`）。 */
                    title={locked}
                    aria-disabled={disabled || undefined}
                    disabled={disabled && !locked}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (disabled || locked) {
                        event.preventDefault();
                        return;
                      }
                      onSelect?.(item.key);
                    }}
                  >
                    <span className="toolbar-more-menu-row-icon">{renderIcon?.(item)}</span>
                    <span className="toolbar-more-menu-row-label">{label}</span>
                  </button>
                  {renderExpanded?.(item.key)}
                </Fragment>
              );
            })
            : items.map((item) => (
              <div key={item.key} className="toolbar-more-menu-item">
                {renderItem(item.key)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default memo(ToolbarMoreMenu);
