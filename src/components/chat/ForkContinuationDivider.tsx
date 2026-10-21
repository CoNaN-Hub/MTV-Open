/**
 * `ForkContinuationDivider` —— 官方 `JV`（`vendor-pkg-canvas-ChpWx5JY.js` **@2583040**）逐字移植。
 *
 * 官方原文（逐字）：
 * ```js
 * JV = ({onClick:e, className:t}) => {
 *   const {t:n} = se();
 *   return s.jsxs("div",{className:z("flex w-full items-center gap-3 py-1.5 text-xs leading-4",t),children:[
 *     s.jsx("span",{"aria-hidden":!0,className:"h-px flex-1 bg-gradient-to-r from-transparent to-foreground/25"}),
 *     s.jsxs("button",{type:"button",onClick:e,
 *       className:"inline-flex shrink-0 cursor-pointer items-center gap-1.5 hover:underline hover:decoration-[#90C4E5]",children:[
 *       s.jsx(Aue,{className:"size-3.5 shrink-0 text-foreground/70",strokeWidth:1.5}),
 *       s.jsx("span",{className:"font-medium text-[#90C4E5]",children:n("chatAdapter.fork.fromConversation","Continued from chat")})]}),
 *     s.jsx("span",{"aria-hidden":!0,className:"h-px flex-1 bg-gradient-to-l from-transparent to-foreground/25"})]})}
 * ```
 *
 * 图标三步解析：`Aue` → canvas import `l4 as Aue` → `vendor-libs` `export{BY as l4}` →
 * `BY = L("git-branch", nRa)`（`vendor-libs` @547326）⇒ **lucide `git-branch`**。
 *
 * i18n：官方 key = `chatAdapter.fork.fromConversation`，调用点默认值 `"Continued from chat"`；
 * 四语言逐字取自官方词典（zh @4229891 / en @3565668 / ja @3959473 / ko @4096662）。
 */
import { GitBranch } from 'lucide-react';
import { useT } from '../../i18n';

export interface ForkContinuationDividerProps {
  /** 官方 `onClick`：点「延续自原对话」跳回原对话。 */
  onClick?: () => void;
  className?: string;
}

export default function ForkContinuationDivider({ onClick, className }: ForkContinuationDividerProps) {
  const t = useT();
  return (
    <div className={['flex w-full items-center gap-3 py-1.5 text-xs leading-4', className].filter(Boolean).join(' ')}>
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-transparent to-foreground/25" />
      <button
        type="button"
        onClick={onClick}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 hover:underline hover:decoration-[#90C4E5]"
      >
        <GitBranch className="size-3.5 shrink-0 text-foreground/70" strokeWidth={1.5} />
        <span className="font-medium text-[#90C4E5]">{t('chatAdapter.fork.fromConversation')}</span>
      </button>
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-l from-transparent to-foreground/25" />
    </div>
  );
}
