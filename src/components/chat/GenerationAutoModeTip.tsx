/**
 * GenerationAutoModeTip —— 官方 `tae`（`Yrt = memo(...)`，`displayName="GenerationAutoModeTip"`）
 * 的**逐字移植**。官方出处：`vendor-pkg-canvas-ChpWx5JY.js` @2581382（组件体 `Yrt`）
 * + @2582296（`tae = a.memo(Yrt); tae.displayName = "GenerationAutoModeTip"`）。
 *
 * 官方源码（逐字）：
 *   const Yrt = ({visible, onClose, onExitComplete}) => { const {t} = se();
 *     return s.jsx(Mp, {visible, onExitComplete, motionKey:"generation-auto-mode-tip",
 *       children: s.jsxs("div", {className:"flex items-start gap-2.5 px-4 py-3", children:[
 *         s.jsx("div", {className:"flex-1 min-w-0", children:
 *           s.jsx("div", {className:"text-xs leading-snug text-white/90",
 *             children: t("chatAdapter.generationConfirmation.autoModeTipMessage",
 *                         "In auto-generate mode, Tapies will be auto-deducted for all generation tasks.")})}),
 *         s.jsx("button", {type:"button", onClick:onClose,
 *           className:"text-white/40 hover:text-white/70 transition-colors cursor-pointer focus:outline-none shrink-0 mt-0.5",
 *           "aria-label": t("chatAdapter.generationConfirmation.closeTip","Close"),
 *           children: s.jsx(us, {size:14, strokeWidth:1.5})})]})});
 *   };
 *   tae = a.memo(Yrt); tae.displayName = "GenerationAutoModeTip";
 *
 * `Mp` = 官方 `InputTopSheet`（同 chunk @2557231：`const Trt = ({visible,onExitComplete,motionKey,
 * className,contentRef,anchorOffsetPx=0,children}) => …`，`Mp = a.memo(Trt); Mp.displayName="InputTopSheet"`）
 * ⇒ 与 MTV 已有的 `src/components/chat/InputTopSheet.tsx`（逐字移植、常量 `GV=12`、
 * spring `{stiffness:420,damping:34,mass:.82}`、exit `{duration:.16,ease:[.4,0,.2,1]}`）**同一物**
 * ⇒ 直接复用 `InputTopSheet`，不再新建最薄壳。（官方这里只传 `visible/onExitComplete/motionKey/children`，
 * 不传 `className/contentRef/anchorOffsetPx` ⇒ 复用件默认值即逐字等价。）
 *
 * `us` = 官方图标（canvas chunk 顶部 `import{… dr as us …} from "./vendor-libs-CQ5RMq_I.js"`）
 * ⇒ 在 vendor-libs @8946387 的导出表里 `dr` = `Px`，而 `Px = L("x", IYa)`（@790332），
 * `IYa = [["path",{d:"M18 6 6 18",…}],["path",{d:"m6 6 12 12",…}]]`
 * ⇒ **`us` 是 lucide 的 `x`**（`L` 是 lucide 的 `createLucideIcon`：`Act` 渲染
 * `className: Mct("lucide", r)`、`width/height=size`、`strokeWidth`、`strokeLinecap/Linejoin="round"`、
 * `fill="none"`、`viewBox="0 0 24 24"`、无 children 时自动 `aria-hidden="true"`），
 * **不是** Tabler `IconX`（Tabler 的 `x` 在 vendor-libs 里是另一个常量 `p("outline","x","X",KDi)`，
 * path 写作 `M18 6l-12 12` / `M6 6l12 12`，类名 `tabler-icon tabler-icon-x`）。
 * 两者几何形状相同（同为 6↔18 的对角十字），但官方 `us` 的产物类名是 `lucide lucide-x`，
 * 故这里按仓库既有的 **lucide 内联口径**（见 `OutputHistoryPanel.tsx` 的 `IconX`：class `lucide lucide-x`）
 * 内联官方 path，并把官方 props `size={14} strokeWidth={1.5}` 逐字透传。
 */
import { memo } from 'react';
import InputTopSheet from './InputTopSheet';
import { useT } from '../../i18n';

/** 官方 `us`（lucide `x`）的逐字内联。 */
function OfficialIconX({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-x"
      aria-hidden="true"
    >
      {/* 官方 `IYa` 的两段 path。 */}
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

interface GenerationAutoModeTipProps {
  visible: boolean;
  onClose: () => void;
  /** 官方 `Mp` 的 `onExitComplete`（画布页挂在 @2781326，取 `Us`）。 */
  onExitComplete?: () => void;
}

function GenerationAutoModeTip({ visible, onClose, onExitComplete }: GenerationAutoModeTipProps) {
  const t = useT();
  return (
    <InputTopSheet visible={visible} onExitComplete={onExitComplete} motionKey="generation-auto-mode-tip">
      <div className="flex items-start gap-2.5 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs leading-snug text-white/90">
            {t('chatAdapter.generationConfirmation.autoModeTipMessage')}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 hover:text-white/70 transition-colors cursor-pointer focus:outline-none shrink-0 mt-0.5"
          aria-label={t('chatAdapter.generationConfirmation.closeTip')}
        >
          <OfficialIconX size={14} strokeWidth={1.5} />
        </button>
      </div>
    </InputTopSheet>
  );
}

/** 官方 `tae = a.memo(Yrt)` + `tae.displayName = "GenerationAutoModeTip"`。 */
const MemoGenerationAutoModeTip = memo(GenerationAutoModeTip);
MemoGenerationAutoModeTip.displayName = 'GenerationAutoModeTip';

export default MemoGenerationAutoModeTip;
