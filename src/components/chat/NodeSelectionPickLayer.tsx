/**
 * NodeSelectionPickLayer —— 官方**通用「节点选择模式」**（`dr`）在画布上的整条可视链路。
 *
 * 官方没有「一层」，而是把三件事分别放在三个地方；这里合成一层，观感与判据完全一致：
 *
 * ① **节点三态**（`rke` @1211063，见 `store.nodeSelection.ts`）
 *      · `showHighlight`  ⇒ 节点外壳加 `flowing-border`（官方 `ye ? "flowing-border" : "bg-card"`）
 *      · `showDisabled`   ⇒ 节点外壳加 `node-disabled-blur cursor-not-allowed`
 *        （官方 CSS `course-api-base-url-*.css`：`filter:blur(3px)` + `:after{background:#000000b3}`）
 *      · `isPicked`       ⇒ `boxShadow:"0 0 0 2px var(--muted-foreground)"` + 右上/左上那个
 *                           16×16 圆角方块对号 `<yU size={12} strokeWidth={3}/>`（lucide check）
 *      MTV 不改每个节点组件 ⇒ 在节点壳上打 `data-node-pick`，由 CSS 把官方规则挂到真实卡面。
 *
 * ② **源节点遮罩**：官方 `AIe`（同文件 @1192408 之前）
 *      `<div className="absolute inset-0 p-5 flex flex-col items-center justify-center gap-4 rounded-[12px]
 *                     bg-black/70 border border-white/10 text-card-foreground z-30 cursor-drag"
 *            style={{boxShadow:'0px 4px 4px rgba(0, 0, 0, 0.25)'}} onClick={preventDefault+stopPropagation}>
 *         <div className="text-sm text-foreground/60 mt-2">
 *           <span className="inline-flex items-center justify-center px-1 bg-white/10 rounded-[4px] outline-1
 *                            -outline-offset-1 outline-white/10 text-[12px] font-mono font-normal leading-5
 *                            text-white/60">ESC</span>
 *           <span className="ml-1.5">{t('nodeSelectionMode.shortcutExit')}</span></div></div>`
 *
 * ③ **点击处理**：官方 `VW().handleNodeClick`（`page-BeI7xydN.js@66248`）**逐字**：
 *      ```js
 *      if (!originNodeId || id === originNodeId) return false;
 *      if (meta.allowedNodeTypes) { const n = getNode(id); if (!n || !meta.allowedNodeTypes.includes(n.type)) return false; }
 *      if (meta.isNodeSelectable && !meta.isNodeSelectable(id)) return false;
 *      if (meta.connectionless) { meta.onSelect?.(id); if (meta.autoExitOnConnect) exitMode(); return true; }
 *      const c = {source:id, target:originNodeId, sourceHandle:null, targetHandle:null};
 *      if (!isValidConnection({...c, data:meta.edgeData})) return false;
 *      onEdgesChange?.([{type:'add', item:{...c, data:meta.edgeData}}]);
 *      if (onEdgesChange && meta.onConnect) meta.onConnect(id);
 *      if (meta.autoExitOnConnect) exitMode();
 *      return true;
 *      ```
 *      命中返回 `true` ⇒ 调用方掐断事件（不再选中节点）。
 *      拾取用**原生 document 捕获监听**（MTV 里 React Flow 的 `onNodeClick` 收不到事件，见 `Canvas.tsx` 注释）。
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { computeNodeSelectionPickState, useNodeSelectionStore, type NodeSelectionMeta } from '../../store/store.nodeSelection';
import { isCanvasConnectionValid } from '../../store/store.nodes';
import { PickCursorLabel } from './InsertFromCanvasPickCursorLabel';
import { useT } from '../../i18n';

/** 官方 `kW = 300`（与「从画布添加」同一个防抖值）。 */
const PICK_DEBOUNCE_MS = 300;

interface OriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export default function NodeSelectionPickLayer() {
  const t = useT();
  const isActive = useNodeSelectionStore((state) => state.isActive);
  const originNodeId = useNodeSelectionStore((state) => state.originNodeId);
  const meta = useNodeSelectionStore((state) => state.meta);
  const nodes = useAppStore((state) => state.nodes);
  const [originRect, setOriginRect] = useState<OriginRect | null>(null);
  const lastPickRef = useRef<{ nodeId: string; at: number } | null>(null);

  /* 与「从画布添加」互斥（官方是两套 store + 工具栏优先级，这里直接退让，避免两层叠加）。 */
  const insertFromCanvasPickActive = useAppStore((state) => state.insertFromCanvasPickActive);
  useEffect(() => {
    if (insertFromCanvasPickActive && useNodeSelectionStore.getState().isActive) {
      useNodeSelectionStore.getState().exitMode();
    }
  }, [insertFromCanvasPickActive]);

  /** ① 在节点壳上打三态标记（与 `Canvas.tsx` 里 `data-insert-pick` 同一套路）。 */
  const metaKey = meta ? `${meta.source}|${(meta.allowedNodeTypes ?? []).join(',')}|${(meta.selectedNodeIds ?? []).join(',')}|${meta.appearance ?? ''}` : '';
  useEffect(() => {
    const wrappers = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node[data-id]'));
    if (!isActive) {
      wrappers.forEach((el) => el.removeAttribute('data-node-pick'));
      return;
    }
    const live = useAppStore.getState().nodes;
    wrappers.forEach((el) => {
      const id = el.getAttribute('data-id') ?? '';
      const node = live.find((item) => item.id === id);
      const state = computeNodeSelectionPickState(
        id, node?.type, originNodeId, meta, true, !!node,
      );
      if (state.showSourceOverlay) el.setAttribute('data-node-pick', 'source');
      else if (state.showDisabled) el.setAttribute('data-node-pick', 'disabled');
      else if (state.isPicked) el.setAttribute('data-node-pick', state.appearance === 'element-library' ? 'picked-library' : 'picked');
      else if (state.showHighlight) el.setAttribute('data-node-pick', 'highlight');
      else el.removeAttribute('data-node-pick');
    });
    return undefined;
  }, [isActive, originNodeId, metaKey, meta, nodes]);

  /* 退出/卸载时清标记。 */
  useEffect(() => () => {
    document.querySelectorAll<HTMLElement>('.react-flow__node[data-node-pick]')
      .forEach((el) => el.removeAttribute('data-node-pick'));
  }, [isActive]);

  /** ② 源节点遮罩的定位：跟随源节点在屏幕上的矩形（rAF 跟随，缩放/平移都不掉队）。 */
  useEffect(() => {
    /* 关掉时**不**同步 setState（会触发级联渲染，且遮罩本身已被 `isActive && originRect` 挡住）；
       残留的 rect 在下次进入时会被第一帧 rAF 覆写。 */
    if (!isActive || !originNodeId) return undefined;
    let raf = 0;
    const tick = () => {
      const selector = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? `.react-flow__node[data-id="${CSS.escape(originNodeId)}"]`
        : `.react-flow__node[data-id="${originNodeId}"]`;
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setOriginRect((prev) => (
          prev && Math.abs(prev.left - rect.left) < 0.5 && Math.abs(prev.top - rect.top) < 0.5
            && Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5
            ? prev
            : { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        ));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive, originNodeId]);

  /** ③ 点击拾取（官方 `VW().handleNodeClick` 逐字）。 */
  useEffect(() => {
    if (!isActive) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const nodeId = target?.closest('.react-flow__node')?.getAttribute('data-id');
      const store = useNodeSelectionStore.getState();
      const currentMeta: NodeSelectionMeta | null = store.meta;
      const origin = store.originNodeId;
      if (!nodeId || !origin || nodeId === origin) return;
      if (currentMeta?.allowedNodeTypes) {
        const node = useAppStore.getState().nodes.find((item) => item.id === nodeId);
        if (!node || !currentMeta.allowedNodeTypes.includes(node.type ?? '')) return;
      }
      if (currentMeta?.isNodeSelectable && !currentMeta.isNodeSelectable(nodeId)) return;

      event.preventDefault();
      event.stopPropagation();

      const last = lastPickRef.current;
      const now = Date.now();
      if (last && last.nodeId === nodeId && now - last.at < PICK_DEBOUNCE_MS) return;
      lastPickRef.current = { nodeId, at: now };

      if (currentMeta?.connectionless) {
        currentMeta.onSelect?.(nodeId);
        if (currentMeta.autoExitOnConnect) store.exitMode();
        return;
      }
      const connection = { source: nodeId, target: origin, sourceHandle: null, targetHandle: null };
      if (!isCanvasConnectionValid({ ...connection })) return;
      const appStore = useAppStore.getState();
      appStore.onConnect({ ...connection, data: currentMeta?.edgeData } as never);
      if (currentMeta?.onConnect) currentMeta.onConnect(nodeId);
      currentMeta?.onSelect?.(nodeId);
      if (currentMeta?.autoExitOnConnect) store.exitMode();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [isActive]);

  /** 官方 `Gk`（此模式下 label = `nodeSelectionMode.selectLabel`）。 */
  const isCandidate = (nodeId: string) => {
    const state = useNodeSelectionStore.getState();
    if (!state.isActive || !state.originNodeId || nodeId === state.originNodeId) return false;
    const node = useAppStore.getState().nodes.find((item) => item.id === nodeId);
    const pick = computeNodeSelectionPickState(
      nodeId, node?.type, state.originNodeId, state.meta, true, !!node,
    );
    return pick.showHighlight;
  };

  return (
    <>
      {isActive && (
        <PickCursorLabel active={isActive} isCandidate={isCandidate} label={t('选择')} />
      )}
      {isActive && originRect && typeof document !== 'undefined' && document.body
        ? createPortal(
          /* 官方 `AIe`（源节点遮罩）。`cursor-drag` 是官方类名；MTV 用等价的内联 cursor。 */
          <div
            data-testid="node-selection-source-overlay"
            className="fixed z-30 flex flex-col items-center justify-center gap-4 rounded-[12px] border border-white/10 bg-black/70 p-5 text-card-foreground"
            style={{
              left: originRect.left,
              top: originRect.top,
              width: originRect.width,
              height: originRect.height,
              boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
              cursor: 'grab',
            }}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
          >
            <div className="mt-2 text-sm text-foreground/60">
              <span className="inline-flex items-center justify-center rounded-[4px] bg-white/10 px-1 font-mono text-[12px] font-normal leading-5 text-white/60 outline-1 -outline-offset-1 outline-white/10">
                ESC
              </span>
              <span className="ml-1.5">{t('退出')}</span>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
