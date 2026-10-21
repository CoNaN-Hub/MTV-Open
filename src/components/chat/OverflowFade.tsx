/**
 * OverflowFade —— 官方 `T_`（旧名 `Xw`，`page-BeI7xydN.js`@362978）逐字复刻。
 *
 * 官方原文：
 *   function T_({children, className, fadeFromClassName = "from-chat-background", deps}) {
 *     const {ref, isOverflowing, isScrolledToStart, isScrolledToEnd} = Iw(deps);
 *     return (
 *       <div className="relative min-w-0">
 *         {isOverflowing && !isScrolledToStart
 *           ? <div aria-hidden className={cx("pointer-events-none absolute left-0 top-0 bottom-0 z-[1] w-10
 *                                            bg-gradient-to-r to-transparent transition-opacity", fadeFromClassName)} />
 *           : null}
 *         {isOverflowing && !isScrolledToEnd
 *           ? <div aria-hidden className={cx("pointer-events-none absolute right-0 top-0 bottom-0 z-[1] w-10
 *                                            bg-gradient-to-l to-transparent transition-opacity", fadeFromClassName)} />
 *           : null}
 *         <div ref={ref} className={cx("[scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
 *           {children}
 *         </div>
 *       </div>
 *     );
 *   }
 *
 * 用途：横向可滚动的分段导航/芯片条 —— 两侧按实际滚动位置渐隐，并隐藏原生横向滚动条。
 * MTV 的溢出测量见 `useOverflowState.ts`（官方 `Iw`/旧 `Qv` 逐字）。
 */
import type { ReactNode } from 'react';
import useOverflowState from './useOverflowState';

export interface OverflowFadeProps {
  children: ReactNode;
  /** 内层滚动层的类串（官方原样拼在隐藏滚动条那两个类之后）。 */
  className?: string;
  /** 渐隐色的起点类（默认 `from-chat-background`）。 */
  fadeFromClassName?: string;
  /** 重算溢出的依赖数组（官方 `deps`）。 */
  deps?: readonly unknown[];
}

export default function OverflowFade({
  children,
  className,
  fadeFromClassName = 'from-chat-background',
  deps = [],
}: OverflowFadeProps) {
  const { ref, isOverflowing, isScrolledToStart, isScrolledToEnd } = useOverflowState<HTMLDivElement>(deps);
  return (
    <div className="relative min-w-0">
      {isOverflowing && !isScrolledToStart ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 bottom-0 z-[1] w-10 bg-gradient-to-r to-transparent transition-opacity ${fadeFromClassName}`}
        />
      ) : null}
      {isOverflowing && !isScrolledToEnd ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute right-0 top-0 bottom-0 z-[1] w-10 bg-gradient-to-l to-transparent transition-opacity ${fadeFromClassName}`}
        />
      ) : null}
      <div ref={ref} className={['[scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className].filter(Boolean).join(' ')}>
        {children}
      </div>
    </div>
  );
}
