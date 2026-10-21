/**
 * 官方「输入区上方浮层」原语 —— `page-BeI7xydN.js`@811979 的 `Lce`（`Mo = memo(Lce)`，
 * `displayName="InputTopSheet"`）逐字。
 *
 * 官方源码：
 *   const W1 = 12;                                            // 底部 header 条高度
 *   const Pce = { type:'spring', stiffness:420, damping:34, mass:.82 };   // 进场
 *   const Dce = { duration:.16, ease:[.4,0,.2,1] };                        // 退场
 *   <AnimatePresence onExitComplete={onExitComplete}>
 *     {visible && (
 *       <motion.div ref={contentRef}
 *         className="pointer-events-auto absolute bottom-full inset-x-[4%]"
 *         style={{ marginBottom: -W1 + anchorOffsetPx, transformOrigin:'bottom center',
 *                  willChange:'transform, opacity' }}
 *         initial={{opacity:0,y:10,scale:.98}} animate={{opacity:1,y:0,scale:1}}
 *         exit={{opacity:0,y:6,scale:.98,transition:Dce}} transition={Pce} key={motionKey}>
 *         <div className={cx('overflow-hidden rounded-t-xl bg-chat-bubble-surface', className)}>{children}</div>
 *         <div aria-hidden className="bg-chat-bubble-header" style={{ height: W1 }} />
 *       </motion.div>
 *     )}
 *   </AnimatePresence>
 *
 * 它是 O1「InputTopSheet 族」（排队条 / todoQueue / 提问 / 会话锁）共用的外壳。
 */
import type { ReactNode, RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/** 官方 `W1`：底部 header 条高度（px）。 */
export const INPUT_TOP_SHEET_HEADER_HEIGHT = 12;
/** 官方 `Pce`：进场 spring。 */
const ENTER_TRANSITION = { type: 'spring', stiffness: 420, damping: 34, mass: 0.82 } as const;
/** 官方 `Dce`：退场。 */
const EXIT_TRANSITION = { duration: 0.16, ease: [0.4, 0, 0.2, 1] } as const;

export default function InputTopSheet({
  visible,
  onExitComplete,
  motionKey,
  className,
  contentRef,
  anchorOffsetPx = 0,
  children,
}: {
  visible: boolean;
  onExitComplete?: () => void;
  motionKey?: string;
  className?: string;
  contentRef?: RefObject<HTMLDivElement | null>;
  anchorOffsetPx?: number;
  children: ReactNode;
}) {
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {visible && (
        <motion.div
          ref={contentRef}
          className="pointer-events-auto absolute bottom-full inset-x-[4%]"
          style={{
            marginBottom: -INPUT_TOP_SHEET_HEADER_HEIGHT + anchorOffsetPx,
            transformOrigin: 'bottom center',
            willChange: 'transform, opacity',
          }}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98, transition: EXIT_TRANSITION }}
          transition={ENTER_TRANSITION}
          key={motionKey}
        >
          <div className={['overflow-hidden rounded-t-xl bg-chat-bubble-surface', className ?? ''].join(' ').trim()}>
            {children}
          </div>
          <div aria-hidden className="bg-chat-bubble-header" style={{ height: INPUT_TOP_SHEET_HEADER_HEIGHT }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
