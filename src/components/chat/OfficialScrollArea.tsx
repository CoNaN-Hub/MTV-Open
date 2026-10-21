/**
 * OfficialScrollArea —— 官方 `Ni` 的等价实现。
 *
 * 官方 `Ni` 是 vendor-packages 里对 **Radix ScrollArea** 的再封装（`Dt`），逐字结构：
 * ```
 * <ScrollAreaPrimitive.Root className={className} ...>
 *   <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
 *     {children}
 *   </ScrollAreaPrimitive.Viewport>
 *   <ScrollBar />
 *   <ScrollAreaPrimitive.Corner />
 * </ScrollAreaPrimitive.Root>
 *
 * <ScrollBar orientation="vertical">  // 默认
 *   <ScrollAreaPrimitive.ScrollAreaScrollbar
 *     className="flex touch-none select-none transition-colors h-full w-2.5 p-[1px]">
 *     <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border dark:bg-zinc-600" />
 *   </ScrollAreaPrimitive.ScrollAreaScrollbar>
 * ```
 * 官方**没有传 `type`** ⇒ 用 Radix ScrollArea 的默认值（`hover`）。
 * 用法（`TaskHistoryCard`）在根上挂任意变体覆盖 viewport：
 * `[&>[data-radix-scroll-area-viewport]]:!h-auto` + `[&>[data-radix-scroll-area-viewport]]:max-h-80`。
 *
 * 依赖 `@radix-ui/react-scroll-area`（官方同款 Radix 原语；MTV 原先用普通
 * `div.max-h-80.overflow-y-auto` 顶替，与官方 DOM 不一致）。
 */
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';

export const OfficialScrollArea = forwardRef<
  ElementRef<typeof ScrollAreaPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(function OfficialScrollArea({ className, children, ...props }, ref) {
  return (
    <ScrollAreaPrimitive.Root ref={ref} className={className} {...props}>
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <OfficialScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});

export const OfficialScrollBar = forwardRef<
  ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(function OfficialScrollBar({ className, orientation = 'vertical', ...props }, ref) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={[
        'flex touch-none select-none transition-colors',
        orientation === 'vertical' ? 'h-full w-2.5 p-[1px]' : 'h-2.5 flex-col p-[1px]',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border dark:bg-zinc-600" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
});

export default OfficialScrollArea;
