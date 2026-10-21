/**
 * useCanvasNodePresenceEnter —— 官方「节点入场缩放动画」的 MTV 落地（①）。
 *
 * 官方源码（`zoom-slider-3ZcFvYQO.js` @1068021 起，逐字）：
 *   const VS = { presence: { durationSeconds: .23, collapsedScale: .2, frameBufferSeconds: .02 } }
 *   const m7 = { '--canvas-node-presence-duration': '0.23s',
 *                '--canvas-node-presence-collapsed-scale': '0.2' }
 *   XNe() = Math.ceil((.23 + .02) * 1000) = **250ms**   ← 入场 class 挂 250ms
 *   ZNe = 'canvas-node-presence-entering' / QNe = 'canvas-node-presence-exiting'
 *   JNe = new Set([COMMAND, GROUP, PILE, COMMENT])      ← 这四类**不参与**动画
 *   hA(node) = node.type === undefined || !JNe.has(node.type)
 *
 *   nAe(nodes, prevById, enteringIds, exitingById, suppressedIds, animateNew)：
 *     · 对每个节点：`isBrandNew = animateNew && !prevById.has(id) && !isExiting`
 *     · 命中 ⇒ `{ ...node, className: `${className} canvas-node-presence-entering`,
 *                     style: { ...style, ...m7 } }` 且记进 `enteringNodeIds`
 *   Mat(nodes, { ready })：`ready` 之前**一个都不动**（刷新/首次加载不播），
 *     之后用 ref 里的 id 表做 diff ⇒ **只有真正新增的节点**才会挂 entering，
 *     250ms 后由定时器摘掉（`hB(id, map, cb)`）。
 *
 * MTV 侧的差异只有两处（都写在这里，避免以后被当成 bug 改）：
 *   1. 动画落在 **`.node-wrapper > .node`**（MTV 的卡面），官方落在 `.canvas-node-presence-surface`。
 *      选择器在 `styles/nodes.css` 里，与官方 keyframes 逐字一致。
 *   2. 官方把 `--canvas-node-presence-*` 写进 node.style；MTV 直接写在
 *      `.canvas-node-presence-entering` 这条类规则上（等价，且不污染节点数据）。
 *
 * ⚠️ 只做**入场**。退场（`canvas-node-presence-exiting`）官方还会把已删除的节点在列表里
 * 多留 250ms 播完再移除，那需要改投影层，本轮未做（记录在案）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Node as RFNode } from '@xyflow/react';
import type { BaseNodeData } from '../types';

/** 官方 `ZNe` */
export const CANVAS_NODE_PRESENCE_ENTERING = 'canvas-node-presence-entering';
/** 官方 `XNe()` = 250ms */
export const CANVAS_NODE_PRESENCE_MS = 250;

/** 官方 `JNe`（`COMMAND / GROUP / PILE / COMMENT`）→ MTV 的对应类型 */
const PRESENCE_SKIP_TYPES = new Set(['group', 'command-menu', 'canvas-note']);

const EMPTY_SET: ReadonlySet<string> = new Set();

export function useCanvasNodePresenceEnter<T extends RFNode<BaseNodeData>>(nodes: readonly T[]): T[] {
  const readyRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const timersRef = useRef(new Map<string, number>());
  const [entering, setEntering] = useState<ReadonlySet<string>>(EMPTY_SET);

  /* 官方 `ready` 门：首帧之后才允许动画 ⇒ 刷新/首次加载不会「弹入」 */
  useEffect(() => {
    const raf = requestAnimationFrame(() => { readyRef.current = true; });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const seen = seenRef.current;
    const next = new Set<string>();
    for (const node of nodes) next.add(node.id);

    if (!readyRef.current) {
      seenRef.current = next;
      return;
    }

    const added: string[] = [];
    for (const node of nodes) {
      if (seen.has(node.id)) continue;
      if (PRESENCE_SKIP_TYPES.has(node.type ?? '')) continue;
      added.push(node.id);
    }
    seenRef.current = next;
    if (added.length === 0) return;

    /* ⚠️ 这里必须 setState：`entering` 是「相对上一帧节点表的差集」，只能在
       「节点表变化」这个外部信号里算（等价官方 `Mat()` 里那套 ref + 定时器）。
       eslint 的 set-state-in-effect 规则针对的是「能推导的状态」，这条属于订阅外部变化。 */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntering((prev) => {
      const copy = new Set(prev);
      for (const id of added) copy.add(id);
      return copy;
    });
    for (const id of added) {
      const previous = timersRef.current.get(id);
      if (previous !== undefined) window.clearTimeout(previous);
      const timer = window.setTimeout(() => {
        timersRef.current.delete(id);
        setEntering((prev) => {
          if (!prev.has(id)) return prev;
          const copy = new Set(prev);
          copy.delete(id);
          return copy;
        });
      }, CANVAS_NODE_PRESENCE_MS);
      timersRef.current.set(id, timer);
    }
  }, [nodes]);

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) window.clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  return useMemo(() => {
    if (entering.size === 0) return nodes as T[];
    return nodes.map((node) => {
      if (!entering.has(node.id)) return node;
      const className = node.className
        ? `${node.className} ${CANVAS_NODE_PRESENCE_ENTERING}`
        : CANVAS_NODE_PRESENCE_ENTERING;
      return { ...node, className };
    });
  }, [nodes, entering]);
}
