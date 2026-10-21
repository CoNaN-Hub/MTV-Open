/**
 * pinAnalytics —— 官方 Pin 的 5 个埋点（`zoom-slider-3ZcFvYQO.js` @1222297 起逐字）：
 *   `Bv(zv.CANVAS_PIN_ADDED, { node_type, node_id, color_group_id, pins_after })`
 *   `Bv(zv.CANVAS_PIN_REMOVED, 同上)`
 *   `Bv(zv.CANVAS_PIN_GROUP_CLEARED, { color_group_id, affected_node_count })`
 *   `Bv(zv.CANVAS_PIN_GROUP_DOWNLOADED, { color_group_id, node_count, file_count })`
 *   `Bv(zv.CANVAS_PIN_NODE_LOCATED, { color_group_id, node_id, group_node_count })`
 * MTV 目前没有埋点通道（官方是 `Bv` + 事件枚举 `zv`），所以这里落一个**同形**的入口：
 * 开发环境打 console.debug，生产环境可在这里接上真实上报，调用点一律不改。
 */
export const PIN_EVENTS = {
  ADDED: 'CanvasPinAdded',
  REMOVED: 'CanvasPinRemoved',
  GROUP_CLEARED: 'CanvasPinGroupCleared',
  GROUP_DOWNLOADED: 'CanvasPinGroupDownloaded',
  NODE_LOCATED: 'CanvasPinNodeLocated',
} as const;

export type PinEventName = (typeof PIN_EVENTS)[keyof typeof PIN_EVENTS];

export function trackPinEvent(name: PinEventName, payload: Record<string, unknown>): void {
  if (import.meta.env?.DEV) console.debug('[pin]', name, payload);
}
