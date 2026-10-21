/**
 * OfficialScrollFade —— 官方滚动淡出壳 `_s`（= `course-api-base-url-*.js` 的 `bN`）**逐字**。
 *
 * ```jsx
 * const Xj = 1;                       // 阈值
 * forwardRef(function({ children, className, fadeColor = 'var(--popover)', deps = [], onScroll, ...rest }, ref) {
 *   const [showTop, setShowTop] = useState(false);
 *   const [showBottom, setShowBottom] = useState(false);
 *   const measure = () => {
 *     const el = innerRef.current;
 *     if (!el) return;
 *     setShowTop(el.scrollTop > Xj);
 *     setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - Xj);
 *   };
 *   // ResizeObserver 观察内层；deps 变化时重新测量
 *   return (
 *     <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
 *       <div aria-hidden className={cx('pointer-events-none absolute inset-x-0 top-0 z-[1] h-5 transition-opacity duration-150', showTop ? 'opacity-100' : 'opacity-0')}
 *            style={{ background: `linear-gradient(to bottom, ${fadeColor}, transparent)` }} />
 *       <div aria-hidden className={cx('pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-5 transition-opacity duration-150', showBottom ? 'opacity-100' : 'opacity-0')}
 *            style={{ background: `linear-gradient(to top, ${fadeColor}, transparent)` }} />
 *       <div ref={setRef} className={cx('[scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)} onScroll={...} {...rest}>{children}</div>
 *     </div>
 *   );
 * })
 * ```
 *
 * 官方把它用在**模型选择弹窗**的列表（`_s` + `Ou = max-h-[280px] min-h-0 overflow-y-auto overscroll-contain`）
 * 与 **`/` 技能面板**的列表上 —— MTV 之前两处都没有这层渐隐。
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type UIEvent } from 'react';

/** 官方 `Xj`。 */
const SCROLL_FADE_THRESHOLD = 1;

export default function OfficialScrollFade({
  children,
  className,
  /** 官方默认 `var(--popover)`。 */
  fadeColor = 'var(--popover)',
  onScroll,
  deps = [],
}: {
  children: ReactNode;
  /** 官方 `className`（接在隐藏滚动条的两个类之后）。 */
  className?: string;
  fadeColor?: string;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
  /** 官方 `deps`：这些值变化时重新测量。 */
  deps?: unknown[];
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const measure = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    setShowTop(el.scrollTop > SCROLL_FADE_THRESHOLD);
    setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - SCROLL_FADE_THRESHOLD);
  }, []);

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return undefined;
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, depsKey]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 z-[1] h-5 transition-opacity duration-150 ${showTop ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: `linear-gradient(to bottom, ${fadeColor}, transparent)` }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-5 transition-opacity duration-150 ${showBottom ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: `linear-gradient(to top, ${fadeColor}, transparent)` }}
      />
      <div
        ref={innerRef}
        className={['[scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className].filter(Boolean).join(' ')}
        onScroll={(event) => {
          measure();
          onScroll?.(event);
        }}
      >
        {children}
      </div>
    </div>
  );
}
