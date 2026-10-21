/**
 * InsertFromCanvasPickToolbar —— 官方「从画布添加」拾取模式的浮动提示条 1:1 复刻。
 *
 * 官方逐字依据（`page-BeI7xydN.js`，`NW` @61053 / `IW` @61053）：
 *
 * ```js
 * NW = { padding: '6px 6px 6px 16px', background: '#1FA2DC',
 *        boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.16), inset 0px 0.5px 0px rgba(255, 255, 255, 0.16)',
 *        backdropFilter: 'blur(28px)', WebkitAppRegion: 'no-drag' };
 *
 * IW = () => {
 *   const { t } = useT();
 *   const { exitMode } = useInsertFromCanvasPick();
 *   return (
 *     <div className="inline-flex items-center gap-4 rounded-lg" style={NW}>
 *       <div className="flex flex-col">
 *         <span className="text-sm font-semibold leading-5 text-primary-foreground">
 *           {t('insertFromCanvasPick.toolbarTitle', 'Insert from canvas')}</span>
 *         <span className="text-xs font-normal leading-4 text-primary-foreground/72">
 *           {t('insertFromCanvasPick.toolbarHint', 'Click nodes to add as reference')}</span>
 *       </div>
 *       <button type="button"
 *         className="flex items-center justify-center rounded-md bg-black/40 px-2 py-0.5 transition-all active:scale-95 focus:outline-none"
 *         onClick={exitMode}>
 *         <span className="text-xs font-normal leading-5 text-primary-foreground/88">{t('common.exit', 'Exit')}</span>
 *       </button>
 *     </div>
 *   );
 * };
 * ```
 *
 * ⚠️ 官方 `IW` 的**挂载位置**（`page-BeI7xydN.js`@1748953）：
 * ```jsx
 * <AnimatePresence>
 *   {w && !v && !_ && !b && (
 *     <motion.div className="pointer-events-auto"
 *       initial={{ opacity: 0, y: -20, scale: .9 }}
 *       animate={{ opacity: 1, y: 0, scale: 1 }}
 *       exit={{ opacity: 0, y: -20, scale: .9 }}
 *       transition={{ type: 'spring', damping: 20, stiffness: 300 }}>
 *       <IW />
 *     </motion.div>
 *   )}
 * </AnimatePresence>
 * ```
 * ⇒ 提示条**从上往下 20px + 0.9→1 缩放**弹簧入场（用户实测「从画布添加悬浮卡片动画缺失」就是这个 wrapper）。
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';

/** 官方 `NW`：蓝底 + 外阴影 + 内高光 + 28px 背景模糊 + `WebkitAppRegion:'no-drag'`。 */
const TOOLBAR_STYLE = {
  padding: '6px 6px 6px 16px',
  background: '#1FA2DC',
  boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.16), inset 0px 0.5px 0px rgba(255, 255, 255, 0.16)',
  backdropFilter: 'blur(28px)',
  WebkitAppRegion: 'no-drag',
} as unknown as React.CSSProperties;

export default function InsertFromCanvasPickToolbar() {
  const t = useT();
  const active = useAppStore((state) => state.insertFromCanvasPickActive);
  const exitPick = useAppStore((state) => state.exitInsertFromCanvasPick);
  return (
    <div
      data-testid="insert-from-canvas-pick-toolbar"
      className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center"
    >
      {/* 官方用 `<AnimatePresence>` + `motion.div`（spring damping20/stiffness300）包住 `IW`。 */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="pointer-events-auto"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <div className="inline-flex items-center gap-4 rounded-lg" style={TOOLBAR_STYLE}>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-5 text-primary-foreground">{t('从画布添加')}</span>
                <span className="text-xs font-normal leading-4 text-primary-foreground/72">{t('点击节点以添加为引用')}</span>
              </div>
              <button
                type="button"
                className="flex items-center justify-center rounded-md bg-black/40 px-2 py-0.5 transition-all active:scale-95 focus:outline-none"
                onClick={exitPick}
              >
                <span className="text-xs font-normal leading-5 text-primary-foreground/88">{t('退出')}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
