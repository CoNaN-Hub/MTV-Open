/**
 * NodeSelectionPickToolbar —— 官方**通用节点选择模式**的浮动提示条 `CW`
 * （`page-BeI7xydN.js@~57800`，挂载点 @1748953）1:1 复刻。
 *
 * 官方逐字（去掉接线后的形状）：
 * ```jsx
 * // 官方把「回到源节点」按钮的出现条件算成：源节点中心离视口中心 > 200px
 * const f = originNodeId && (Math.hypot(视口中心, 源节点中心) > 200);
 * const p = () => setCenter(cx, cy + h * .4, { zoom: getZoom(), duration: 500 });   // 官方 500ms
 * const h = originNodeId && f;
 * <div className="inline-flex items-center gap-2.5 rounded-lg"
 *      style={{ padding:'6px 6px 6px 16px', background:'#1FA2DC',
 *               boxShadow:'0px 4px 16px rgba(0,0,0,0.16), inset 0px 0.5px 0px rgba(255,255,255,0.16)',
 *               backdropFilter:'blur(28px)' }}>
 *   <div className="flex flex-col">
 *     {meta?.toolbarTitle
 *       ? <span className="text-[14px] font-semibold leading-5 text-white">{meta.toolbarTitle}</span>
 *       : <><span className="text-[14px] font-semibold leading-5 text-white">{t('nodeSelectionMode.activeTitle')}</span>
 *           <span className="text-[12px] font-normal leading-4 text-white/72">{t('nodeSelectionMode.activeHint')}</span></>}
 *   </div>
 *   {h && <button className="flex items-center justify-center p-1.5 py-1 rounded-md transition-all active:scale-95 focus:outline-none"
 *                 style={{ background:'rgba(0, 0, 0, 0.40)' }} onClick={p}>
 *            <yT className="w-4 h-4 text-white/88" /></button>}<span/>   // tabler focus-2
 *   {h && <div className="w-px h-5 bg-white/20" />}
 *   {meta?.onComplete
 *     ? <><button className="flex items-center justify-center px-2 py-0.5 …" onClick={exitMode}>
 *           <span className="text-[12px] font-normal leading-5 text-white/88">{meta.cancelLabel || t('library.cancel')}</span></button>
 *         <button className="…" style={{ background:'rgba(0, 0, 0, 0.40)' }} onClick={completeMode}>
 *           <span className="text-[12px] font-normal leading-5 text-white/88">{meta.completeLabel || t('common.done')}</span></button></>
 *     : <button className="…" style={{ background:'rgba(0, 0, 0, 0.40)' }} onClick={exitMode}>
 *         <span className="text-[12px] font-normal leading-5 text-white/88">{t('common.exit')}</span></button>}
 * </div>
 * ```
 * 挂载外壳（官方 @1748953）：`<AnimatePresence><motion.div className="pointer-events-auto"
 *   initial={{opacity:0,y:-20,scale:.9}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:.9}}
 *   transition={{type:'spring',damping:20,stiffness:300}}>`。
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReactFlow } from '@xyflow/react';
import { Icon } from '@iconify/react';
import { useNodeSelectionStore } from '../../store/store.nodeSelection';
import { useAppStore } from '../../store/useAppStore';
import { getCanvasViewportController } from '../../services/canvasViewportService';
import { useT } from '../../i18n';

/** 官方工具栏内联样式（`NW` / `CW` 共用同一份）。 */
const BAR_STYLE = {
  padding: '6px 6px 6px 16px',
  background: '#1FA2DC',
  boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.16), inset 0px 0.5px 0px rgba(255, 255, 255, 0.16)',
  backdropFilter: 'blur(28px)',
} as React.CSSProperties;

/** 官方 `yT` = tabler `focus-2`。 */
const FOCUS_BUTTON_CLASS = 'flex items-center justify-center p-1.5 py-1 rounded-md transition-all active:scale-95 focus:outline-none';
const ACTION_BUTTON_CLASS = 'flex items-center justify-center px-2 py-0.5 rounded-md transition-all active:scale-95 focus:outline-none';
const ACTION_LABEL_CLASS = 'text-[12px] font-normal leading-5 text-white/88';

export default function NodeSelectionPickToolbar() {
  const t = useT();
  const isActive = useNodeSelectionStore((state) => state.isActive);
  const originNodeId = useNodeSelectionStore((state) => state.originNodeId);
  const meta = useNodeSelectionStore((state) => state.meta);
  const exitMode = useNodeSelectionStore((state) => state.exitMode);
  const completeMode = useNodeSelectionStore((state) => state.completeMode);
  const { setCenter, getZoom } = useReactFlow();
  const [showFocusButton, setShowFocusButton] = useState(false);

  /**
   * 官方门逐字（`page-BeI7xydN.js` 的 `CW`）：`h = originNodeId && f`，其中
   * `f = m => { const [_,S,b] = m.transform, w = (-_ + m.width/2)/b, C = (-S + m.height/2)/b,
   *                    A = 节点中心.x, T = 节点中心.y; return Math.hypot(w-A, C-T) > 200 }`
   * ⇒ 源节点中心离**视口中心**超过 200 画布单位才给「回到源节点」钮。
   * 这里用与 `PromptPanel` 焦点编辑横幅同一份已验证实现（每帧 rAF + 只在翻转时 setState；
   * `visibleBounds` = 画布容器尺寸，而不是 window —— 官方用的就是画布视口宽高）。
   */
  useEffect(() => {
    if (!isActive || !originNodeId) {
      // 不能在 effect 体里同步 setState（`react-hooks/set-state-in-effect`）⇒ 延到下一帧
      const raf = requestAnimationFrame(() => setShowFocusButton(false));
      return () => cancelAnimationFrame(raf);
    }
    let raf = 0;
    let last: boolean | null = null;
    const measure = () => {
      const controller = getCanvasViewportController();
      const node = useAppStore.getState().nodes.find((n) => n.id === originNodeId);
      if (controller && node) {
        const { visibleBounds } = controller.getSnapshot();
        const nodeWidth = node.measured?.width ?? node.width ?? 0;
        const nodeHeight = node.measured?.height ?? node.height ?? 0;
        const cx = node.position.x + nodeWidth / 2;
        const cy = node.position.y + nodeHeight / 2;
        /* ⚠️ `visibleBounds` 已是**画布坐标**（`Canvas.tsx` 用 `screenToFlowPosition` 换算）⇒
           视口中心 = 它的几何中心，**不能再除一次 zoom**（旧写法除了两遍 ⇒ 判定恒「太远」⇒ 常驻）。*/
        const viewCx = visibleBounds.x + visibleBounds.width / 2;
        const viewCy = visibleBounds.y + visibleBounds.height / 2;
        const next = Math.hypot(cx - viewCx, cy - viewCy) > 200;
        if (next !== last) { last = next; setShowFocusButton(next); }
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [isActive, originNodeId, setShowFocusButton]);

  /** 官方 `p`：把源节点居中（`cy + h * .4`，`duration: 500`）。 */
  const panToOrigin = () => {
    const node = useAppStore.getState().nodes.find((item) => item.id === originNodeId);
    if (!node) return;
    const width = node.measured?.width ?? node.width ?? 0;
    const height = node.measured?.height ?? node.height ?? 0;
    setCenter(node.position.x + width / 2, node.position.y + height / 2 + height * 0.4, {
      zoom: getZoom(),
      duration: 500,
    });
  };

  return (
    <div
      data-testid="node-selection-pick-toolbar"
      className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center"
    >
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="pointer-events-auto"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <div className="inline-flex items-center gap-2.5 rounded-lg" style={BAR_STYLE}>
              <div className="flex flex-col">
                {meta?.toolbarTitle ? (
                  <span className="text-[14px] font-semibold leading-5 text-white">{meta.toolbarTitle}</span>
                ) : (
                  <>
                    <span className="text-[14px] font-semibold leading-5 text-white">{t('选择节点连接')}</span>
                    <span className="text-[12px] font-normal leading-4 text-white/72">{t('点击节点以创建连线')}</span>
                  </>
                )}
              </div>
              {showFocusButton && (
                <button
                  type="button"
                  className={FOCUS_BUTTON_CLASS}
                  style={{ background: 'rgba(0, 0, 0, 0.40)' }}
                  onClick={panToOrigin}
                >
                  <Icon icon="tabler:focus-2" width={16} height={16} className="w-4 h-4 text-white/88" />
                </button>
              )}
              {showFocusButton && <div className="w-px h-5 bg-white/20" />}
              {meta?.onComplete ? (
                <>
                  <button
                    type="button"
                    className={ACTION_BUTTON_CLASS}
                    onClick={exitMode}
                  >
                    <span className={ACTION_LABEL_CLASS}>{meta.cancelLabel ?? t('取消')}</span>
                  </button>
                  <button
                    type="button"
                    className={ACTION_BUTTON_CLASS}
                    style={{ background: 'rgba(0, 0, 0, 0.40)' }}
                    onClick={completeMode}
                  >
                    <span className={ACTION_LABEL_CLASS}>{meta.completeLabel ?? t('完成')}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={ACTION_BUTTON_CLASS}
                  style={{ background: 'rgba(0, 0, 0, 0.40)' }}
                  onClick={exitMode}
                >
                  <span className={ACTION_LABEL_CLASS}>{t('退出')}</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
