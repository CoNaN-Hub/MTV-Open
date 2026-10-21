/**
 * AgentChatEntryOrb —— 官方 TapNow「Chatbox 浮球」入口 1:1 复刻。
 *
 * 官方逐字依据（`page-BeI7xydN.js`，`Lpe` @1037600 / `BO` @994409 / 常量 @`course-api-base-url-*.js`）：
 *
 * ```js
 * BO = (isOpen, delay) => {                       // 面板收起后延迟 delay 才允许浮球出现
 *   const [collapsed, setCollapsed] = useState(() => !isOpen);
 *   useEffect(() => {
 *     if (isOpen) { setCollapsed(false); return; }
 *     if (collapsed) return;
 *     const id = setTimeout(() => setCollapsed(true), delay);
 *     return () => clearTimeout(id);
 *   }, [delay, isOpen, collapsed]);
 *   return { isPanelCollapsed: collapsed, shouldShowButton: !isOpen && collapsed };
 * };
 * // shouldShowButton = BO(isOpen, cbe) —— cbe = 280
 * ```
 *
 * ```jsx
 * <motion.div className="absolute bottom-6 right-6 z-50" data-pile-gallery-chrome="bottom-right"
 *   initial={reduce ? {opacity:0} : {opacity:0, scale:.92, y:8}}
 *   animate={reduce ? {opacity:1} : {opacity:1, scale:1, y:0}}
 *   transition={{duration: reduce ? .16 : UV, ease: reduce ? 'easeOut' : [.16,1,.3,1]}}>
 *   <div className="flex flex-col items-end gap-3">
 *     {…官方「收起建议」胶囊（需服务端建议流，MTV 无 ⇒ 见下）…}
 *     <dR proximityActive={shouldShowButton} onClick={onOpen} tooltip={reduce ? '' : t('chatAdapter.tooltips.openChat')} />
 *   </div>
 * </motion.div>
 * // UV = Qlt = .24
 * ```
 *
 * 实现注记（**视觉等价、机制不同**）：
 *   官方用 `BO` 的 state + `setTimeout` 决定「挂不挂载」（effect 里同步 setState）。
 *   本仓库 ESLint 启用 React 19 的 `react-hooks/set-state-in-effect` ⇒ 那套无法原样落地。
 *   这里改为「`AnimatePresence` 常驻 + 入场动画带 `delay:.28`」：
 *   `AnimatePresence initial={false}` 让首帧（面板本来就收着）**立即出现不加延迟**，
 *   之后每次「面板关闭 → 浮球出现」都带上 280ms 延迟 —— 与官方观感逐帧一致。
 *
 * 官方还有一颗「收起建议」胶囊（`chatAdapter.collapsedSuggestion.open/dismiss`），
 * 数据来自 `Dpe(canvasId, …)` 的服务端建议流；MTV 无该数据源 ⇒ **不伪造**，此处不渲染。
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import AgentMotionOrb from './AgentMotionOrb';

/** 官方 `UV` = `Qlt` = `.24`：浮球自身入场时长。 */
const ENTRY_DURATION = 0.24;
/** 官方展开缓动 `[.16,1,.3,1]`。 */
const ENTRY_EASE = [0.16, 1, 0.3, 1] as const;
/** 官方 `cbe` = 280：面板收起后浮球的出现延迟（ms）。 */
const REAPPEAR_DELAY_S = 0.28;
/** 官方 reduced-motion 分支时长 `.16`。 */
const REDUCED_DURATION = 0.16;
/**
 * 官方 `chatAdapter.tooltips.openChat` —— **四种语言（zh/en/ja/ko）与 fr 全部是同一条字面量**
 * `"TapNow Agent"`（`index-DjCL4F9p.js`@9109948 等），因此无需 i18n 表，直接用官方字面量。
 */
const OPEN_CHAT_TOOLTIP = 'TapNow Agent';

export default function AgentChatEntryOrb() {
  const chatOpen = useAppStore((state) => state.chatOpen);
  const openChat = useAppStore((state) => state.openChat);
  const prefersReducedMotion = useReducedMotion() ?? false;

  const handleOpen = useCallback(() => {
    openChat();
  }, [openChat]);

  const transition = prefersReducedMotion
    ? { duration: REDUCED_DURATION, ease: 'easeOut' as const, delay: REAPPEAR_DELAY_S }
    : { duration: ENTRY_DURATION, ease: ENTRY_EASE, delay: REAPPEAR_DELAY_S };

  return (
    <AnimatePresence initial={false}>
      {!chatOpen && (
        <motion.div
          key="agent-chat-entry-orb"
          className="absolute bottom-6 right-6 z-50"
          data-pile-gallery-chrome="bottom-right"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 8 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 8 }}
          transition={transition}
        >
          <div className="flex flex-col items-end gap-3">
            <AgentMotionOrb
              chrome="floating"
              orbSize="default"
              proximityActive
              tooltip={prefersReducedMotion ? '' : OPEN_CHAT_TOOLTIP}
              onClick={handleOpen}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
