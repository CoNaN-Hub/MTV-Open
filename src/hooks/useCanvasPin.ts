/**
 * useCanvasPin —— 官方 `mIe()`（zoom-slider @1222010 起）的两个动作：
 *   · `togglePinOnNode(nodeId, groupId)`     单节点开关 → 写 `data.color_pins`（官方走 `updateNodeData`）
 *   · `removeAllNodesFromGroup(groupId)`     把该色组从**所有**节点上摘掉（官方走 `setNodes` 一次性）
 * 官方埋点（PIN_ADDED / PIN_REMOVED / GROUP_CLEARED）MTV 无埋点通道，这里留出调用点注释。
 */
import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { BaseNodeData } from '../types';
import { pinGroupById, readPins, removePin, togglePin, withPins, PINNABLE_KIND } from '../services/canvasPin';
import { PIN_EVENTS, trackPinEvent } from '../services/pinAnalytics';

export function useCanvasPinActions() {
  const togglePinOnNode = useCallback((nodeId: string, groupId: string) => {
    if (!pinGroupById(groupId)) return;
    const store = useAppStore.getState();
    const node = store.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const current = readPins(node.data);
    const next = togglePin(current, groupId);
    if (next === current) return;                       // 官方：值没变就直接返回
    store.updateNodeData(nodeId, { color_pins: next } as Partial<BaseNodeData>);
    // 官方埋点：加上/去掉分别打点（`hIe`/`pIe`）
    trackPinEvent(next.length > current.length ? PIN_EVENTS.ADDED : PIN_EVENTS.REMOVED, {
      node_type: PINNABLE_KIND[node.type as keyof typeof PINNABLE_KIND] ?? null,
      node_id: nodeId,
      color_group_id: groupId,
      pins_after: next.length,
    });
  }, []);

  const removeAllNodesFromGroup = useCallback((groupId: string) => {
    if (!pinGroupById(groupId)) return;
    const store = useAppStore.getState();
    const affected = store.nodes.filter((n) => readPins(n.data).includes(groupId));
    if (affected.length === 0) return;
    const ids = new Set(affected.map((n) => n.id));
    store.setNodes(store.nodes.map((n) => (
      ids.has(n.id) ? { ...n, data: withPins(n.data, removePin(readPins(n.data), groupId)) } : n
    )));
    // 官方埋点：`fIe` = CANVAS_PIN_GROUP_CLEARED
    trackPinEvent(PIN_EVENTS.GROUP_CLEARED, { color_group_id: groupId, affected_node_count: affected.length });
  }, []);

  return { togglePinOnNode, removeAllNodesFromGroup };
}
