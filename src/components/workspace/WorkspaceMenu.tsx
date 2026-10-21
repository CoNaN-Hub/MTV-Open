/**
 * WorkspaceMenu —— 官方「我的项目」页的卡片菜单（kebab 下拉 + 右键上下文菜单）
 * ══════════════════════════════════════════════════════════════════════════
 * 官方实现（`page-CoyqNJe1.js` 的 `St`/`$o` 组件，逐字）：
 *
 *   const $o = ({children, menuItems, showTriggerButton = true, triggerButtonWithBackground = true,
 *                triggerButtonClassName, disabled = false}) => (
 *     <ContextMenu>
 *       <ContextMenuTrigger asChild disabled={disabled}>
 *         <div className="relative group/menu outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
 *              onContextMenu={disabled ? e => e.preventDefault() : undefined}>
 *           {children}
 *           {showTriggerButton && !disabled && (
 *             <DropdownMenu open onOpenChange modal={false}>
 *               <DropdownMenuTrigger asChild>
 *                 <button className={R("absolute p-1.5 rounded-md", "text-white/80", "transition-opacity duration-200",
 *                                       "z-30", "outline-none focus:outline-none focus-visible:outline-none",
 *                                       triggerButtonWithBackground && "bg-black/50",
 *                                       open ? "opacity-100" : "opacity-0 group-hover/menu:opacity-100",
 *                                       triggerButtonClassName)}>
 *                   <MoreVertical size={16} />
 *                 </button>
 *               </DropdownMenuTrigger>
 *               <DropdownMenuContent align="end" className="w-34">
 *                 <DropdownMenuItems menuItems={menuItems} />
 *               </DropdownMenuContent>
 *             </DropdownMenu>
 *           )}
 *         </div>
 *       </ContextMenuTrigger>
 *       {!disabled && (
 *         <ContextMenuContent className="w-34" onCloseAutoFocus={e => e.preventDefault()}>
 *           <ContextMenuItems menuItems={menuItems} />
 *         </ContextMenuContent>
 *       )}
 *     </ContextMenu>
 *   );
 *
 * 9444 实测（Radix popper，视窗 2560×1344）：
 *   · kebab 下拉：`data-side="bottom" data-align="end"`，弹窗 right 与触发器 right 对齐（差 0.27px），
 *     弹窗 top = 触发器 bottom + 3.82px ⇒ **sideOffset = 4**（shadcn `DropdownMenuContent` 默认值）
 *   · 右键菜单：`data-side="right" data-align="start"`，弹窗左上角 = 指针坐标（sideOffset = 0）
 *   · 弹窗：136×251.33（`w-34` = 8.5rem = 136px）、min-w 128px、padding 4px、
 *     `rounded-md` 10px、bg `#262626`、border 1px `rgba(255,255,255,0.1)`、
 *     shadow `0 2px 4px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.1)`、`overflow-y: auto`
 *   · 菜单项：高 32px、padding `6px 8px`、gap 8px、`rounded-sm` 8px、14px/400、
 *     文字 `#ccc`；危险项 `#934c4c`（官方 `--destructive`）
 *   · 分隔线：`bg-border -mx-1 my-1 h-px` ⇒ 高 1px、上下外边距 4px、左右 -4px
 *
 * Radix 的翻转/限高行为在此手写等价实现：优先 bottom，下方空间不足且上方更宽裕时翻到顶部；
 * 内容限高为可用空间（对应官方的 `max-h-(--radix-dropdown-menu-content-available-height)`）。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface WorkspaceMenuItem {
  key: string;
  label: string;
  /** 官方 `menuItems[].danger` ⇒ `text-destructive` */
  danger?: boolean;
  /** 官方 `menuItems[].separator` ⇒ **该项之后**插一条分隔线（末项不插） */
  separator?: boolean;
  onSelect: () => void;
}

export type WorkspaceMenuAnchor =
  | { kind: 'trigger'; el: HTMLElement }
  | { kind: 'point'; x: number; y: number };

/** 官方 `w-34` = 8.5rem = 136px */
const MENU_WIDTH = 136;
/** 官方 shadcn `DropdownMenuContent` 默认 `sideOffset = 4` */
const SIDE_OFFSET = 4;
/** Radix 的 avoidCollisions 默认 padding = 8px（视窗边距） */
const VIEWPORT_MARGIN = 8;

interface Placement {
  left: number;
  top: number;
  maxHeight: number;
  side: 'top' | 'bottom' | 'right' | 'left';
  align: 'start' | 'end';
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function WorkspacePopper({
  anchor,
  items,
  onClose,
}: {
  anchor: WorkspaceMenuAnchor;
  items: WorkspaceMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  /* 官方 Radix：先按锚点算「首选 side」，必要时翻转，并把内容限高到可用空间 */
  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const naturalHeight = el.offsetHeight;

    if (anchor.kind === 'point') {
      /* 官方 Radix `ContextMenu`：`data-side="right" data-align="start"`，弹窗左上角 = 指针（sideOffset 0） */
      const fitsRight = anchor.x + MENU_WIDTH + VIEWPORT_MARGIN <= window.innerWidth;
      const flipLeft = !fitsRight && anchor.x - MENU_WIDTH - VIEWPORT_MARGIN >= 0;
      const left = flipLeft ? anchor.x - MENU_WIDTH : anchor.x;
      const top = clamp(anchor.y, VIEWPORT_MARGIN, window.innerHeight - naturalHeight - VIEWPORT_MARGIN);
      setPlacement({
        left: clamp(left, VIEWPORT_MARGIN, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
        top,
        maxHeight: Math.max(80, window.innerHeight - top - VIEWPORT_MARGIN),
        side: flipLeft ? 'left' : 'right',
        align: 'start',
      });
      return;
    }

    const box = anchor.el.getBoundingClientRect();
    const below = window.innerHeight - (box.bottom + SIDE_OFFSET) - VIEWPORT_MARGIN;
    const above = box.top - SIDE_OFFSET - VIEWPORT_MARGIN;
    const flipTop = below < Math.min(naturalHeight, 120) && above > below;

    setPlacement({
      left: clamp(
        box.right - MENU_WIDTH,
        VIEWPORT_MARGIN,
        window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN,
      ),
      top: flipTop ? Math.max(VIEWPORT_MARGIN, box.top - SIDE_OFFSET - Math.min(naturalHeight, above)) : box.bottom + SIDE_OFFSET,
      maxHeight: Math.max(80, flipTop ? above : below),
      side: flipTop ? 'top' : 'bottom',
      align: 'end',
    });
  }, [anchor]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  /* 官方 Radix：滚动/resize 时重新定位 */
  useEffect(() => {
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [place]);

  /* 官方 Radix DismissableLayer：Esc 关闭、指针落在外层关闭 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && ref.current?.contains(target)) return;
      if (anchor.kind === 'trigger' && target && anchor.el.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [anchor, onClose]);

  /* 官方弹窗尺寸：宽 136（w-34）· 最小宽 128（min-w-[8rem]）· padding 4（p-1）· 圆角 10（rounded-md） */
  const content = (
    <div
      ref={ref}
      role="menu"
      data-side={placement?.side ?? 'bottom'}
      data-align={placement?.align ?? 'end'}
      aria-orientation="vertical"
      style={{
        position: 'fixed',
        left: placement ? placement.left : -9999,
        top: placement ? placement.top : -9999,
        width: MENU_WIDTH,
        minWidth: 128,
        maxHeight: placement ? placement.maxHeight : undefined,
        visibility: placement ? 'visible' : 'hidden',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
      }}
      className="z-50 overflow-x-hidden overflow-y-auto rounded-[10px] border border-[#ffffff1a] bg-[#262626] p-1 text-[#ccc]"
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) => (
        <div key={item.key}>
          <button
            type="button"
            role="menuitem"
            data-testid={item.key}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-[#404040] ${
              item.danger ? 'text-[#934c4c]' : 'text-[#ccc]'
            }`}
          >
            {item.label}
          </button>
          {item.separator && index < items.length - 1 && <div className="-mx-1 my-1 h-px bg-[#ffffff1a]" role="separator" />}
        </div>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}
