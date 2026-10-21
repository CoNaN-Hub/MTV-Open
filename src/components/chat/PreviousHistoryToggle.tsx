/**
 * `PreviousHistoryToggle` —— 官方 `Xrt`（`vendor-pkg-canvas-ChpWx5JY.js` **@2581826**）逐字移植。
 *
 * 「查看 / 收起之前的历史」折叠条：`collapsed` 为真时先渲染两条**抓手**（`h-[3px] w-7` / `w-11`），
 * 再是文字胶囊；右侧 chevron 在**非折叠**态 `rotate-180`。
 *
 * 官方原文（逐字）：
 * ```js
 * Xrt = ({collapsed:e, onToggle:t, className:n}) => {
 *   const {t:o} = se();
 *   return s.jsx("div",{className:z("flex w-full justify-center py-1",n),children:
 *     s.jsxs("button",{type:"button",onClick:t,"aria-expanded":!e,
 *       className:"group flex cursor-pointer flex-col items-center",children:[
 *       e && s.jsxs("span",{"aria-hidden":!0,className:"flex flex-col items-center gap-[3px] pb-[4px]",children:[
 *         s.jsx("span",{className:"h-[3px] w-7 rounded-full bg-foreground/10 transition-transform duration-200 group-hover:-translate-y-[1.5px]"}),
 *         s.jsx("span",{className:"h-[3px] w-11 rounded-full bg-foreground/15 transition-transform duration-200 group-hover:-translate-y-[0.5px]"})]}),
 *       s.jsxs("span",{className:"inline-flex items-center gap-1.5 rounded-full bg-transparent px-3 py-1 text-xs font-medium leading-4 text-foreground/50 transition-colors duration-200 group-hover:bg-foreground/[0.08] group-hover:text-foreground/80",children:[
 *         s.jsx(kue,{className:"size-3.5 shrink-0",strokeWidth:1.5}),
 *         e ? o("chatAdapter.fork.viewPreviousHistory","View previous history")
 *           : o("chatAdapter.fork.hidePreviousHistory","Hide previous history"),
 *         s.jsx(sx,{className:z("size-3 shrink-0 transition-transform duration-200",!e&&"rotate-180"),strokeWidth:1.5})]})]})})}
 * ```
 *
 * 图标三步解析：
 *   · `kue` → canvas import `l3 as kue` → `vendor-libs` `export{jK as l3}` → `jK = L("history", …)`（@567908）
 *     ⇒ **lucide `history`**
 *   · `sx` → canvas import `fD as sx` → `vendor-libs` `export{LQ as fD}`（@8937678 之后）
 *     → `LQ = L("chevron-down", KIa)`（@447929）⇒ **lucide `chevron-down`**
 *
 * i18n：官方 key `chatAdapter.fork.viewPreviousHistory` / `.hidePreviousHistory`，
 * 调用点默认值 `"View previous history"` / `"Hide previous history"`；
 * 四语言逐字取自官方词典（zh @4229795 / en @3565510 / ja @3959364 / ko @4096555）。
 */
import { ChevronDown, History } from 'lucide-react';
import { useT } from '../../i18n';

export interface PreviousHistoryToggleProps {
  /** 官方 `collapsed`：折叠态（此时才渲染两条抓手，文案 = 「查看之前的历史」）。 */
  collapsed: boolean;
  /** 官方 `onToggle`。 */
  onToggle: () => void;
  className?: string;
}

export default function PreviousHistoryToggle({ collapsed, onToggle, className }: PreviousHistoryToggleProps) {
  const t = useT();
  return (
    <div className={['flex w-full justify-center py-1', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="group flex cursor-pointer flex-col items-center"
      >
        {collapsed && (
          <span aria-hidden="true" className="flex flex-col items-center gap-[3px] pb-[4px]">
            <span className="h-[3px] w-7 rounded-full bg-foreground/10 transition-transform duration-200 group-hover:-translate-y-[1.5px]" />
            <span className="h-[3px] w-11 rounded-full bg-foreground/15 transition-transform duration-200 group-hover:-translate-y-[0.5px]" />
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-transparent px-3 py-1 text-xs font-medium leading-4 text-foreground/50 transition-colors duration-200 group-hover:bg-foreground/[0.08] group-hover:text-foreground/80">
          <History className="size-3.5 shrink-0" strokeWidth={1.5} />
          {collapsed ? t('chatAdapter.fork.viewPreviousHistory') : t('chatAdapter.fork.hidePreviousHistory')}
          <ChevronDown
            className={['size-3 shrink-0 transition-transform duration-200', !collapsed ? 'rotate-180' : ''].filter(Boolean).join(' ')}
            strokeWidth={1.5}
          />
        </span>
      </button>
    </div>
  );
}
