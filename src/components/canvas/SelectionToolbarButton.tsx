/**
 * SelectionToolbarButton —— 官方多选工具栏那颗圆钮（`Xm / ToolbarIconButton`）的 1:1 落地。
 *
 * 单独成文件的原因：`SelectionToolbar.tsx` 会拖进 `@xyflow/react` / framer-motion / zustand store，
 * 而这颗按钮是**纯展示**的，独立出来才能在 node 环境里用 `renderToStaticMarkup` 做单测
 * （`tests/components/selectionToolbarButton.test.tsx` 就断言这颗钮的禁用/忙碌语义）。
 *
 * 官方依据：`zoom-slider-3ZcFvYQO.js`@char2758295（`Xm`）、@char2759086（`gQ` 下载钮）、
 *          `index-BiTZf8mJ.js`@char5919771（`YKo` = 光效层，在 zoom-slider 里重导出为 `mse`）。
 */
import { useState, type Ref } from 'react';
import OfficialSelectionToolbarIcon, { type SelectionToolbarIconName } from '../../data/officialSelectionToolbarIcons';

export interface ToolbarButtonProps {
  icon: SelectionToolbarIconName;
  tooltip: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  dataTestId?: string;
  /** 「布局」那颗触发器要拿 ref 做下拉定位，并回填 `aria-haspopup/aria-expanded` */
  buttonRef?: Ref<HTMLButtonElement>;
  ariaHasPopup?: 'menu';
  ariaExpanded?: boolean;
}

/**
 * 官方按钮内那两层光效（`index-BiTZf8mJ.js`@char5919771 `YKo`，在 `zoom-slider` 里重导出为 `mse`，逐字）：
 * ```js
 * ({className}) => <div className={cn(
 *   "absolute inset-0 z-[-1] overflow-hidden rounded-[inherit] opacity-0 transition-opacity duration-400
 *    ease-[cubic-bezier(0.25,0.8,0.25,1)] group-hover/button:opacity-100 pointer-events-none", className)}>
 *     <div className="absolute inset-[-100%] flex items-center justify-center">
 *       <div className="w-full h-full" style={{background:"conic-gradient(from 0deg, rgba(93, 93, 93, 1) 0deg,
 *         rgba(106, 106, 106, 0.1) 70deg, rgba(144, 144, 144, 1) 180deg, rgba(144, 144, 144, 0.1) 290deg,
 *         rgba(93, 93, 93, 1) 360deg)", transform:"scale(1.1, 0.7)"}}/>
 *     </div>
 *     <div className="absolute inset-[1px] rounded-[inherit]"
 *          style={{background:"radial-gradient(200% 140% at 50% 40.25%, #1A1A1A 16%, #656766 85%)"}}/>
 *   </div>
 * ```
 * ⚠️ 官方这层是**真实 DOM**（不是伪元素）—— 只有这样 `isActive`（= 忙碌/按下）才能把它强制 `opacity-100`。
 *    MTV 原来用 `.ftb-btn::before/::after` 两层伪元素做等价视觉，但**没法表达 isActive 常亮**，
 *    而且复用 `.ftb-btn` 会同时吃到它 `padding:10px`（官方 `Xm` 没有 padding）与原生 `disabled` 语义 ⇒
 *    这里改成官方那份真实 DOM。
 * ⚠️ 官方类名 `duration-400` 在 MTV 的 Tailwind **v3** 里没有刻度（v4 才有 400）⇒ 写任意值 `duration-[400ms]`；
 *    时长与缓动仍是官方的 400ms + `cubic-bezier(0.25,0.8,0.25,1)` ✓
 *    （已在开发服务器实测：`transition: opacity 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)` ✓）
 */
const HOVER_CONIC =
  'conic-gradient(from 0deg, rgba(93, 93, 93, 1) 0deg, rgba(106, 106, 106, 0.1) 70deg, '
  + 'rgba(144, 144, 144, 1) 180deg, rgba(144, 144, 144, 0.1) 290deg, rgba(93, 93, 93, 1) 360deg)';
const HOVER_RADIAL = 'radial-gradient(200% 140% at 50% 40.25%, #1A1A1A 16%, #656766 85%)';

export function ToolbarHoverLight({ lit }: { lit: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        'pointer-events-none absolute inset-0 z-[-1] overflow-hidden rounded-[inherit] '
        + 'transition-opacity duration-[400ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] '
        + (lit ? 'opacity-100' : 'opacity-0 group-hover/button:opacity-100')
      }
    >
      <span className="absolute inset-[-100%] flex items-center justify-center">
        <span className="h-full w-full" style={{ background: HOVER_CONIC, transform: 'scale(1.1, 0.7)' }} />
      </span>
      <span className="absolute inset-[1px] rounded-[inherit]" style={{ background: HOVER_RADIAL }} />
    </span>
  );
}

/**
 * 官方下载按钮的忙碌图标（`zoom-slider-3ZcFvYQO.js`@char2759086 `gQ` 逐字）：
 * ```js
 * function gQ({tooltip, isLoading=!1, dataTestId, onClick}) {
 *   return <Xm tooltip={tooltip} isActive={isLoading} isDisabled={isLoading} ariaBusy={isLoading}
 *              dataTestId={dataTestId} onClick={onClick}
 *              children={isLoading ? <_oe size={40} className="shrink-0 animate-spin"/>
 *                                   : <Pd size={16} strokeWidth={2}/>}/>
 * }
 * ```
 * ⚠️ `_oe` 的字形**没有逐字解出**（它是跨 chunk 的重导出别名：`zoom-slider` 顶部 `import{… d as _oe …}`，
 *    指向的模块无法从压缩产物里唯一确定）。可核到的官方事实只有 `size={40}` + `shrink-0 animate-spin` 这一串；
 *    字形按**同 bundle 内官方通用 spinner** 取 Tabler `loader-2`
 *    （`index-BiTZf8mJ.js`：`Zc=g("outline","loader-2","Loader2",[["path",{d:"M12 3a9 9 0 1 0 9 9"}]])`；
 *    AGENTS.md 也记着 `<Wo size={20} className="animate-spin">` = Tabler loader-2）。
 *    ⇒ **记号：尺寸/动效是源码逐字，字形是推断。**
 */
export function ToolbarSpinner() {
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 animate-spin"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

/**
 * 官方 `Xm / ToolbarIconButton`（`zoom-slider-3ZcFvYQO.js`@char2758295 逐字）：
 * ```js
 * Xm = forwardRef(function({tooltip, children, isActive=!1, isDisabled=!1, dataTestId, ariaBusy,
 *                            onClick, preventEvent=!0, ...d}, u) {
 *   const [p, f] = useState(!1);                       // p = 指针 hover **或**键盘 focus（两者共用一个 state）
 *   const m = isActive || p;                           // ⇒ 光效层的点亮条件
 *   const g = b => { preventEvent && (b.preventDefault(), b.stopPropagation()); !isDisabled && onClick(b) };
 *   return <Nn content={tooltip}>
 *     <button {...d} ref={u} type="button" aria-label={tooltip} aria-busy={ariaBusy}
 *             aria-disabled={isDisabled} data-testid={dataTestId} tabIndex={isDisabled ? -1 : void 0}
 *             onClick={g} onFocus={()=>f(!0)} onBlur={()=>f(!1)}
 *             onMouseEnter={()=>f(!0)} onMouseLeave={()=>f(!1)}
 *             className={Z("group/button relative z-0 size-10 shrink-0 rounded-full",
 *                           "flex items-center justify-center overflow-hidden",
 *                           "cursor-pointer bg-transparent text-[#F5F5F5] transition-colors",
 *                           isDisabled && "cursor-default")}>
 *       <mse className={m ? "opacity-100" : void 0}/>{children}
 *     </button>
 *   </Nn>
 * })
 * ```
 * ⚠️ 三条 MTV 原来（`.ftb-btn` + 原生 `disabled`）**偏了**的语义，这里逐条照抄官方：
 *   ① **不用原生 `disabled`**，改用 `aria-disabled` + `tabIndex={-1}` + `cursor-default`
 *      —— 官方禁用**不改 opacity / 颜色**（规格 §9 逐字：`无 opacity/颜色变化；仅光标与可聚焦性改变`），
 *      而且 hover 光效**照样亮**（`group-hover/button:opacity-100` 与禁用无关）；
 *   ② 光效层是**真实 DOM**（官方 `mse`），点亮条件 = `isActive || hover || focus`；
 *   ③ 「忙碌」= 官方 `gQ` 的 `isActive={isLoading} isDisabled={isLoading} ariaBusy={isLoading}` 三连
 *      ⇒ 光效**常亮** + 图标换成 40px spinner + 不可点。
 * 官方类名里 `size-10`（Tailwind ≥3.4）、`group/button`（命名 group，≥3.4）MTV 的 v3.4.19 都支持 ✓
 * （已在开发服务器核对：`size` = 40×40、`padding` = 0、`border-radius` = 9999px、光效层 `z-index:-1`）。
 */
export function ToolbarButton({
  icon, tooltip, onClick, disabled, busy, dataTestId, buttonRef, ariaHasPopup, ariaExpanded,
}: ToolbarButtonProps) {
  const [pointerLit, setPointerLit] = useState(false);
  const inert = Boolean(disabled || busy);
  const lit = Boolean(busy) || pointerLit;

  return (
    <button
      ref={buttonRef}
      type="button"
      className={
        'group/button relative z-0 size-10 shrink-0 rounded-full '
        + 'flex items-center justify-center overflow-hidden '
        + 'bg-transparent text-[#F5F5F5] transition-colors '
        + (inert ? 'cursor-default' : 'cursor-pointer')
      }
      aria-label={tooltip}
      aria-busy={busy ? true : undefined}
      aria-disabled={inert ? true : undefined}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      tabIndex={inert ? -1 : undefined}
      data-tooltip={tooltip}
      data-testid={dataTestId}
      onFocus={() => setPointerLit(true)}
      onBlur={() => setPointerLit(false)}
      onMouseEnter={() => setPointerLit(true)}
      onMouseLeave={() => setPointerLit(false)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (inert) return;
        onClick?.();
      }}
    >
      <ToolbarHoverLight lit={lit} />
      {busy ? <ToolbarSpinner /> : <OfficialSelectionToolbarIcon name={icon} size={16} />}
    </button>
  );
}

export default ToolbarButton;
