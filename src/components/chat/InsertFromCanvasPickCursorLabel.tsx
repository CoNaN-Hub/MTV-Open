/**
 * InsertFromCanvasPickCursorLabel —— 官方「从画布添加」拾取模式下，悬浮在**可拾取卡片**上时
 * 跟随光标的提示条 1:1 复刻（官方组件 `Gk`，`course-api-base-url-*.js@1198053`）。
 *
 * 官方逐字：
 * ```jsx
 * Gk = memo(({label, name}) => {
 *   const tipRef = useRef(null);
 *   const onMove = e => { const el = tipRef.current; if (!el) return;
 *     el.style.transform = `translate(${e.clientX}px, ${e.clientY - 8}px) translate(-50%, -100%)`;
 *     el.style.opacity = '1'; };
 *   const onLeave = () => { const el = tipRef.current; if (el) el.style.opacity = '0'; };
 *   return (<>
 *     <div className="absolute inset-0 z-30 pointer-events-auto cursor-pointer" onMouseMove={onMove} onMouseLeave={onLeave} />
 *     {createPortal(
 *       <div ref={tipRef} className="fixed top-0 left-0 pointer-events-none z-[9999] text-nowrap text-xs leading-5"
 *         style={{ opacity: 0, padding: '4px 8px', background: 'rgba(51, 51, 51, 0.80)', borderRadius: 6,
 *                  backdropFilter: 'blur(28px)',
 *                  boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.16), inset 0px 0.5px 0px rgba(255, 255, 255, 0.16)' }}>
 *         <span className="text-white/88">{label} </span>
 *         <span className="text-white/60">{name}</span>
 *       </div>, document.body)}
 *   </>);
 * });
 * ```
 * 官方挂在**节点内容里**（节点外壳：`I && <Gk label={t('nodeSelectionMode.selectLabel','Select')} name={W}/>`，
 * 其中 `I` = `insertPick.showHighlight` = `isActive && eligible && !isPicked`）。
 *
 * 本仓做成**画布上的一层**（等价观感，且不必改每个节点组件）：拾取模式激活时监听 `pointermove`，
 * 命中 `.react-flow__node[data-id]`、该节点在白名单里、且尚未被引用 ⇒ 提示条跟随光标显示「选择 <节点名>」。
 * 样式（`4px 8px` / `rgba(51,51,51,.8)` / `r6` / `blur(28px)` / 双层阴影 / `z-[9999]` / 位移 `-8px + translate(-50%,-100%)`）
 * 全部逐字照抄官方。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';

/** 官方 `BIe = new Set([TEXT, IMAGE, VIDEO, VIDEO_EDIT, AUDIO])`（与 `Canvas.tsx` 同一份语义）。 */
const PICKABLE_TYPES = new Set<string>([
  'ai-text', 'ai-image', 'ai-video', 'ai-audio', 'ai-animation', 'ai-panorama', 'ai-shotlist',
]);

/**
 * 通用版（官方 `Gk` 本体）：`label` = 官方 `nodeSelectionMode.selectLabel`（「选择」），
 * `isCandidate(nodeId)` = 该模式下「可拾取且尚未选中」的判据。
 *
 * 官方 `Gk` 被**三种模式**共用（`page-BeI7xydN.js@1241047`）：
 *   · `_ && <Gk label name/>`   ← nodeSelection.showHighlight（含「参考」拾取）
 *   · `I && <Gk label name/>`   ← insertPick.showHighlight（「从画布添加」）
 *   · `playlistPick.showHighlight && <Gk label={t('playlist.pick.addLabel')} name/>`
 */
export function PickCursorLabel({
  active,
  isCandidate,
  label,
}: {
  active: boolean;
  isCandidate: (nodeId: string) => boolean;
  label: string;
}) {
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState<string | null>(null);

  const paint = useCallback((clientX: number, clientY: number) => {
    const el = tipRef.current;
    if (!el) return;
    el.style.transform = `translate(${clientX}px, ${clientY - 8}px) translate(-50%, -100%)`;
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const onMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const nodeId = target?.closest('.react-flow__node')?.getAttribute('data-id');
      if (!nodeId || !isCandidate(nodeId)) { setName(null); return; }
      const node = useAppStore.getState().nodes.find((item) => item.id === nodeId);
      const data = (node?.data ?? {}) as { label?: string; title?: string; name?: string };
      paint(event.clientX, event.clientY);
      setName(data.label || data.title || data.name || `node_${nodeId.slice(0, 6)}`);
    };
    const onLeave = () => setName(null);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerleave', onLeave, true);
    window.addEventListener('blur', onLeave);
    return () => {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerleave', onLeave, true);
      window.removeEventListener('blur', onLeave);
    };
  }, [active, isCandidate, paint]);

  if (typeof document === 'undefined' || !document.body) return null;
  if (!active) return null;

  return createPortal(
    <div
      ref={tipRef}
      data-testid="insert-from-canvas-pick-cursor-label"
      className="pointer-events-none fixed top-0 left-0 z-[9999] text-nowrap text-xs leading-5"
      style={{
        opacity: name ? 1 : 0,
        padding: '4px 8px',
        background: 'rgba(51, 51, 51, 0.80)',
        borderRadius: 6,
        backdropFilter: 'blur(28px)',
        boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.16), inset 0px 0.5px 0px rgba(255, 255, 255, 0.16)',
      }}
    >
      <span className="text-white/88">{label} </span>
      <span className="text-white/60">{name ?? ''}</span>
    </div>,
    document.body,
  );
}

export default function InsertFromCanvasPickCursorLabel() {
  const t = useT();
  const active = useAppStore((state) => state.insertFromCanvasPickActive);

  /** 官方 `insertPick.showHighlight = isActive && eligible && !isPicked`。 */
  const isCandidate = useCallback((nodeId: string) => {
    const state = useAppStore.getState();
    const node = state.nodes.find((item) => item.id === nodeId);
    if (!node || !PICKABLE_TYPES.has(node.type ?? '')) return false;
    return !state.chatComposerContextNodeIds.includes(nodeId);
  }, []);

  return <PickCursorLabel active={active} isCandidate={isCandidate} label={t('选择')} />;
}
