/**
 * ShimmerText —— 官方 `Aa`（`IconSkill-UAYZEup5.js`@2149 的 `G`，导出为 `Q`=`memo(G)`）逐字复刻。
 *
 * 官方原文：
 *   const G = ({children, as: Tag = "p", className, duration = 1, spread = 2, baseColor}) => {
 *     const Motion = useMemo(() => motion.create(Tag), [Tag]);
 *     const spreadPx = useMemo(() => (children.length || 0) * spread, [children, spread]);
 *     const base = baseColor ?? "var(--color-muted-foreground)";
 *     return (
 *       <Motion
 *         animate={{ backgroundPosition: "0% center" }}
 *         initial={{ backgroundPosition: "100% center" }}
 *         transition={{ repeat: Infinity, duration, ease: "linear" }}
 *         className={cx(
 *           "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
 *           "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),rgba(255,255,255,0.46),#0000_calc(50%+var(--spread)))]",
 *           "[background-repeat:no-repeat,padding-box]", className)}
 *         style={{ "--spread": `${spreadPx}px`, backgroundImage: `var(--bg), linear-gradient(${base}, ${base})` }}>
 *         {children}
 *       </Motion>
 *     );
 *   };
 *
 * 思考状态行（`P_`/ThinkingStatusLine）在 streaming 时用它：
 *   `<ShimmerText as="span" duration={1.7} spread={1.4} className="text-[13px]">{label}</ShimmerText>`
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';

export interface ShimmerTextProps {
  children: string;
  /** 官方 `as`：渲染成哪个标签（默认 `p`，思考行传 `span`）。 */
  as?: 'span' | 'p' | 'div';
  className?: string;
  /** 官方 `duration`：一个扫光周期的秒数（思考行 1.7）。 */
  duration?: number;
  /** 官方 `spread`：每个字符贡献的渐变宽度（思考行 1.4）。 */
  spread?: number;
  /** 官方 `baseColor`：底色（默认 `var(--color-muted-foreground)`）。 */
  baseColor?: string;
}

export default function ShimmerText({
  children,
  as = 'p',
  className,
  duration = 1,
  spread = 2,
  baseColor,
}: ShimmerTextProps) {
  /* 官方 `motion.create(as)`；旧版 framer-motion 没有 `create` ⇒ 退回 `motion[as]`。 */
  const MotionTag = useMemo(() => {
    const create = (motion as unknown as { create?: (component: string) => unknown }).create;
    if (typeof create === 'function') return create(as) as React.ElementType;
    const table = motion as unknown as Record<string, React.ElementType>;
    return table[as] ?? motion.span;
  }, [as]);
  const spreadPx = useMemo(() => (children.length || 0) * spread, [children, spread]);
  /**
   * 官方 `baseColor ?? "var(--color-muted-foreground)"`。
   *
   * ⚠️ **MTV 必须给回落值**：官方是 Tailwind v4，`--color-muted-foreground` 是**主题变量**（全局可用）；
   * MTV 是 v3，该变量名在全局**不存在**（只有 `AgentToolLine`/`SubAgentLine`/`ToolLoadingIndicator`
   * 用任意属性类 `[--color-muted-foreground:color-mix(in_srgb,var(--muted-foreground)_92%,transparent)]`
   * 就地补过）。`ThinkingStatusLine` 没补 ⇒ 这里的 `linear-gradient(var(--color-muted-foreground), …)`
   * **整条 `background-image` 声明失效** ⇒ 配上 `text-transparent` 就是**文字全透明**
   * （用户实测：发送后只剩动图 + `· 5s`，「整理中…」不见了）。
   * 用 `var(…, <fallback>)` 把 MTV 的等价底色作为回落即可 —— 官方语义不变，且不影响外部显式传 `baseColor`。
   */
  const base = baseColor
    ?? 'var(--color-muted-foreground, color-mix(in srgb, var(--muted-foreground) 92%, transparent))';

  return (
    <MotionTag
      animate={{ backgroundPosition: '0% center' }}
      initial={{ backgroundPosition: '100% center' }}
      transition={{ repeat: Number.POSITIVE_INFINITY, duration, ease: 'linear' }}
      className={[
        'relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent',
        '[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),rgba(255,255,255,0.46),#0000_calc(50%+var(--spread)))]',
        '[background-repeat:no-repeat,padding-box]',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        '--spread': `${spreadPx}px`,
        backgroundImage: `var(--bg), linear-gradient(${base}, ${base})`,
      } as React.CSSProperties}
    >
      {children}
    </MotionTag>
  );
}
