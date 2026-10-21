/**
 * NodeToolbarShell —— 官方浮层机制（`zoom-slider-3ZcFvYQO.js` @1228500 `eT` = NodeFloatingLayer）
 *
 * 源码机制（逐字对齐）：
 *   Lf = { reveal:[.42,0,.58,1], topEnter:[.16,1,.3,1], topExit:[.4,0,1,1],
 *          bottomEnter:[.25,1,.5,1], bottomExit:[.45,0,1,1] }                 // @1227944
 *   Zw = { enter:{ top:{opacity:{duration:.18,ease:Lf.reveal}, y:{duration:.22,ease:Lf.topEnter}}, … },
 *          exit:{ top:{duration:.16,ease:Lf.topExit}, … },
 *          reducedEnter:{duration:.1,ease:"linear"}, reducedExit:{duration:.08,ease:"linear"} }
 *   bIe = { top:-10, bottom:14 };  vIe = (placement, zoom) => bIe[placement] / max(zoom, 1)
 *
 *   const u = visible && !isDragging;        // ← 拖拽中不显示
 *   const p = u || keepMounted;              // ← keepMounted 默认 false ⇒ 关闭即卸载
 *   initial {opacity:0, y:m} · animate {opacity:u?1:0, y:u?0:m} · exit {opacity:0, y:m}
 *   外层 <div className="pointer-events-none absolute inset-0 overflow-visible">
 *   内层 motion.div 带 data-node-floating-layer={placement} + origin center bottom|top
 */
import { memo, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useStore, type ReactFlowState } from '@xyflow/react';

type Placement = 'top' | 'bottom';

/** 官方 easing 常量表（@1227944 `Lf`） */
const Lf = {
  reveal: [0.42, 0, 0.58, 1],
  topEnter: [0.16, 1, 0.3, 1],
  topExit: [0.4, 0, 1, 1],
  bottomEnter: [0.25, 1, 0.5, 1],
  bottomExit: [0.45, 0, 1, 1],
} as const;

/** 官方进出场表（@1227944 `Zw`） */
const Zw = {
  enter: {
    top: { opacity: { duration: 0.18, ease: Lf.reveal }, y: { duration: 0.22, ease: Lf.topEnter } },
    bottom: { opacity: { duration: 0.21, ease: Lf.reveal }, y: { duration: 0.25, ease: Lf.bottomEnter } },
  },
  exit: {
    top: { duration: 0.16, ease: Lf.topExit },
    bottom: { duration: 0.19, ease: Lf.bottomExit },
  },
  reducedEnter: { duration: 0.1, ease: 'linear' },
  reducedExit: { duration: 0.08, ease: 'linear' },
} as const;

/** 官方位移基准（@1227944 `bIe`）＋ 缩放归一（`yIe`/`vIe`） */
const bIe: Record<Placement, number> = { top: -10, bottom: 14 };
const vIe = (placement: Placement, zoom: number) => bIe[placement] / (zoom > 0 ? zoom : 1);

interface NodeToolbarShellProps {
  visible?: boolean;
  children: ReactNode;
  /** 官方 `placement`（节点工具栏固定 "top"） */
  placement?: Placement;
  /** 官方 `isDragging`：拖拽中整层不显示 */
  isDragging?: boolean;
  /** 官方 `keepMounted`（默认 false ⇒ 关闭即卸载） */
  keepMounted?: boolean;
  className?: string;
}

function NodeToolbarShell({
  visible = false,
  children,
  placement = 'top',
  isDragging = false,
  keepMounted = false,
  className,
}: NodeToolbarShellProps) {
  const reduced = useReducedMotion();
  const zoom = useStore((s: ReactFlowState) => s.transform[2]);
  const show = visible && !isDragging;          // 官方 `u = n && !o`
  const mounted = show || keepMounted;          // 官方 `p = u || s`
  const m = reduced ? 0 : vIe(placement, zoom); // 官方 `m = c ? 0 : vIe(r, f)`
  const enter = reduced ? Zw.reducedEnter : Zw.enter[placement];
  const exit = reduced ? Zw.reducedExit : Zw.exit[placement];

  return (
    /* ★ `z-20` 是**必需的**，不是装饰：
       本层（以及里面的 `.node-floating-toolbar`、「⋯ 浏览全部」菜单）必须盖住节点两侧的
       `+` 把手 `.node-handle`（reactflow.css 里是 **z-index: 15**）。
       ⚠️ 在这里定层级而不是让各节点自己传 className —— 之前 `ImageNode` 传了 `z-10`，
          整条工具栏子树（含菜单里那个 `z-index:10010`）被封在 10 ⇒ 15 的把手压在上面，
          用户在「⋯ 浏览全部」弹窗上能直接看到 `+` 按钮 ✗。 */
    <div className={`pointer-events-none absolute inset-0 z-20 overflow-visible${className ? ` ${className}` : ''}`}>
      <AnimatePresence mode="sync">
        {mounted && (
          <motion.div
            key="node-floating-layer"
            data-node-floating-layer={placement}
            className="pointer-events-none absolute inset-0 overflow-visible"
            initial={{ opacity: 0, y: m }}
            animate={{ opacity: show ? 1 : 0, y: show ? 0 : m }}
            exit={{ opacity: 0, y: m, transition: exit }}
            transition={(show ? enter : exit) as never}
            style={{ transformOrigin: placement === 'top' ? 'center bottom' : 'center top' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(NodeToolbarShell);
