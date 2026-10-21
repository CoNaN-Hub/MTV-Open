/**
 * OfficialTooltip —— 官方那套 **Radix** tooltip 的 1:1 复刻。
 *
 * 官方 `Kt`（`index-BsHyQ2qj.js`@5898205 的 `$9e`）逐字：
 *   ({children, content, side="top", align="center", sideOffset=8, delayDuration=200,
 *     open, onOpenChange, disableHoverableContent, className}) =>
 *     <TooltipProvider delayDuration=… open=… onOpenChange=… disableHoverableContent=…>
 *       <TooltipTrigger asChild>{children}</TooltipTrigger>
 *       {content != null && content !== '' && <TooltipContent side align sideOffset className>{content}</TooltipContent>}
 *     </TooltipProvider>
 *
 * 官方带样式的 `TooltipContent`（同文件 `v9e`）逐字：
 *   <TooltipPortal>
 *     <Content sideOffset={4}
 *       className={cx("z-50 overflow-hidden rounded-lg border-none px-3 py-1.5 text-xs font-medium text-white
 *                      shadow-[0px_4px_16px_rgba(0,0,0,0.16),inset_0px_0.5px_0px_rgba(255,255,255,0.16)]
 *                      [background:rgba(51,51,51,0.80)] [backdrop-filter:blur(28px)]
 *                      animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0
 *                      data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2
 *                      data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2
 *                      data-[side=top]:slide-in-from-bottom-2
 *                      origin-[--radix-tooltip-content-transform-origin]", className)} />
 *   </TooltipPortal>
 *
 * ⚠️ MTV 原来**没有 `@radix-ui/*` 依赖**（源码里明确写着"用 createPortal 复刻"）⇒
 *    本文件按官方改用真 Radix：依赖 `@radix-ui/react-tooltip` + 插件 `tailwindcss-animate`（都已装）。
 *    用法与官方完全一致：`<OfficialTooltip content="…"><button/></OfficialTooltip>`。
 */
import { forwardRef, type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

/** 官方 `v9e` 的类串（逐字）。 */
const TOOLTIP_CONTENT_CLASS = [
  'z-50 overflow-hidden rounded-lg border-none px-3 py-1.5 text-xs font-medium text-white',
  'shadow-[0px_4px_16px_rgba(0,0,0,0.16),inset_0px_0.5px_0px_rgba(255,255,255,0.16)]',
  '[background:rgba(51,51,51,0.80)] [backdrop-filter:blur(28px)]',
  'animate-in fade-in-0 zoom-in-95',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
  'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
  'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
  'origin-[--radix-tooltip-content-transform-origin]',
].join(' ');

export const OfficialTooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function OfficialTooltipContent({ className, sideOffset = 4, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={[TOOLTIP_CONTENT_CLASS, className].filter(Boolean).join(' ')}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});

export interface OfficialTooltipProps {
  children: ReactNode;
  content?: ReactNode;
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['side'];
  align?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['align'];
  sideOffset?: number;
  delayDuration?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disableHoverableContent?: boolean;
  className?: string;
}

/** 官方 `Kt`（`$9e`）逐字复刻。 */
export default function OfficialTooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  sideOffset = 8,
  delayDuration = 200,
  open,
  onOpenChange,
  disableHoverableContent,
  className,
}: OfficialTooltipProps) {
  return (
    /* 官方 `b0` = Radix `Tooltip.Root`（`delayDuration` / `open` / `onOpenChange` /
       `disableHoverableContent` 四个 prop 都挂在 Root 上，不是 Provider）。 */
    /* ⚠️ 自己再包一层 Provider：助手面板是 `createPortal` 出去的，祖先链上不一定有
       `TooltipProvider`（实测会抛 `Tooltip must be used within TooltipProvider`，
       整个「对话助手」惰性边界直接判失败）。Radix 允许 Provider 嵌套。 */
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root
        delayDuration={delayDuration}
        open={open}
        onOpenChange={onOpenChange}
        disableHoverableContent={disableHoverableContent}
      >
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        {content != null && content !== '' && (
          <OfficialTooltipContent side={side} align={align} sideOffset={sideOffset} className={className}>
            {content}
          </OfficialTooltipContent>
        )}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
