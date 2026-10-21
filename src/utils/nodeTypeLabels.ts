/**
 * 节点类型 → 界面标签（**唯一事实来源**）。
 *
 * `NODE_TYPE_CONFIG`（`src/types`）覆盖了画布节点类型，但画布上还会出现几种
 * 「不是节点类型」的条目（源素材、分组等）—— 它们统一在这里补，避免各处各写一份。
 *
 * 使用方：`canvas/MiniMapNodeStats`（小地图悬浮统计）、`canvas/CanvasStatsDialog`（画布统计弹窗）。
 */
import { getNodeTypeConfig } from '../types';

/** `NODE_TYPE_CONFIG` 之外的类型名 */
export const EXTRA_NODE_LABELS: Record<string, string> = {
  'source-text': '源文本',
  'source-image': '源图像',
  'source-video': '源视频',
  'source-audio': '源音频',
  group: '分组',
};

/** 未知类型回落到类型串本身，保证统计表里不会出现空标签。 */
export function getNodeTypeLabel(type: string): string {
  if (!type) return '';
  return EXTRA_NODE_LABELS[type] ?? getNodeTypeConfig(type).label;
}
