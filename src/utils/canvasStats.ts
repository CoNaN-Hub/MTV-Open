/**
 * 画布统计 —— 纯计算层（弹窗只负责画）。
 *
 * 口径照 Artigine「画布统计」复刻手册（2026-10-06 抓取）：
 *   · **纯前端、零后端**：打开面板不发任何请求，直接从画布节点数组现场聚合。
 *   · 按 `type` 分组计数 → 数量降序 → 百分比取整 → 10 色循环取色。
 *   · 甜甜圈是**手写 SVG 扇形**（无图表库）：极坐标 `polar` + 扇形路径 `donutSlicePath`。
 *
 * 单独成文件是为了能直接单测（不依赖 React / DOM）。
 */
import { getNodeTypeLabel } from './nodeTypeLabels';

/** `fill` = 扇形底色（手册 §8.3 的 500）；`text` = 浅色主题文字（600）；`textDark` = 暗色主题文字（400）；`hex` = 同色 hex（chip 底色 / 描边用）。 */
export interface CanvasStatsColor {
  fill: string;
  text: string;
  textDark: string;
  hex: string;
}

/**
 * 类型分布的 10 色调色板（照抄手册 §8.3「甜甜圈 / 类型 chip 的 10 色调色板」）。
 * 类型数 > 10 时回环取色（`index % length`），第 11 类重新从 blue 开始。
 *
 * ⚠️ 文字分两档：原版 chip 类是 `text-{color}-600 dark:text-{color}-400`
 * —— 暗色底上必须用 400 那档，否则 600 在深色面板上几乎看不清（实测对比度不足）。
 */
export const CANVAS_STATS_PALETTE: readonly CanvasStatsColor[] = [
  { fill: 'oklch(62.3% 0.214 259.8)', text: 'oklch(54.6% 0.245 262.9)', textDark: '#60a5fa', hex: '#3b82f6' },
  { fill: 'oklch(62.7% 0.265 303.9)', text: 'oklch(55.8% 0.288 302.3)', textDark: '#c084fc', hex: '#a855f7' },
  { fill: 'oklch(65.6% 0.241 354.3)', text: 'oklch(59.2% 0.249 0.584)', textDark: '#f472b6', hex: '#ec4899' },
  { fill: 'oklch(70.5% 0.213 47.6)', text: 'oklch(64.6% 0.222 41.1)', textDark: '#fb923c', hex: '#f97316' },
  { fill: 'oklch(69.6% 0.17 162.5)', text: 'oklch(59.6% 0.145 163.2)', textDark: '#34d399', hex: '#10b981' },
  { fill: 'oklch(71.5% 0.143 215.2)', text: 'oklch(60.9% 0.126 221.7)', textDark: '#22d3ee', hex: '#06b6d4' },
  { fill: 'oklch(64.5% 0.246 16.4)', text: 'oklch(58.6% 0.253 17.6)', textDark: '#fb7185', hex: '#f43f5e' },
  { fill: 'oklch(76.9% 0.188 70.1)', text: 'oklch(66.6% 0.179 58.3)', textDark: '#fbbf24', hex: '#f59e0b' },
  { fill: 'oklch(58.5% 0.233 277.1)', text: 'oklch(51.1% 0.262 277)', textDark: '#818cf8', hex: '#6366f1' },
  { fill: 'oklch(76.8% 0.233 130.9)', text: 'oklch(64.8% 0.2 131.7)', textDark: '#a3e635', hex: '#84cc16' },
];

/** 只用到统计需要的字段，方便单测直接喂字面量。 */
export interface CanvasStatsNodeLike {
  type?: string;
  data?: { type?: string; label?: string };
}

export interface CanvasStatsGroup {
  /** 分组键（= 节点 type） */
  key: string;
  /** 展示名（中文原文，调用方再过 `t()`） */
  label: string;
  count: number;
  /** 取整后的百分比（手册口径：`Math.round(count / total * 100)`） */
  percent: number;
  /** 调色板下标（已经取过模，直接索引 `CANVAS_STATS_PALETTE`） */
  colorIndex: number;
}

export interface CanvasStatsSummary {
  /** 节点总数 */
  total: number;
  /** 类型数（分组数） */
  typeCount: number;
  /** 数量降序 */
  groups: CanvasStatsGroup[];
}

/** 画布节点数组 → 统计摘要。空数组返回全 0，调用方据此渲染空状态。 */
export function summarizeCanvasNodes(nodes: readonly CanvasStatsNodeLike[]): CanvasStatsSummary {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    /* 手册的分组键：`node.type ?? node.data.type`（React Flow 节点用前者，MTV 的数据用后者兜底） */
    const type = node.type ?? node.data?.type ?? '';
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  const total = nodes.length;
  const groups = [...counts.entries()]
    /* 数量降序；同数量按类型名稳定排序，避免每次打开面板顺序抖动 */
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count], index) => ({
      key,
      label: getNodeTypeLabel(key),
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
      colorIndex: index % CANVAS_STATS_PALETTE.length,
    }));

  return { total, typeCount: groups.length, groups };
}

/**
 * 角度 → 坐标。**-90° 偏移**让 0° 从 12 点钟方向开始（手册 §4）。
 */
export function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * 扇形路径：圆心 → 起点半径线 → 弧线 → 闭合（手册 §4 原文还原）。
 * 单类型占满 100% 时 `endAngle - startAngle === 360`，`largeArc` 取 1，画出来是一个整圆。
 */
export function donutSlicePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const p1 = polar(cx, cy, r, endAngle);
  const p2 = polar(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${cx} ${cy}`,
    `L ${p1.x} ${p1.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${p2.x} ${p2.y}`,
    'Z',
  ].join(' ');
}

export interface CanvasStatsSlice {
  key: string;
  colorIndex: number;
  startAngle: number;
  endAngle: number;
  d: string;
}

/**
 * 统计分组 → 扇形序列。弧段角度 = `count / total * 360`，起点角度依次累加。
 * `valueOf` 取哪个字段由调用方决定（默认按数量），方便复用成别的占比图。
 */
export function donutSlices(
  groups: readonly CanvasStatsGroup[],
  opts: { cx: number; cy: number; r: number },
): CanvasStatsSlice[] {
  const sum = groups.reduce((acc, group) => acc + group.count, 0);
  if (sum <= 0) return [];
  let angle = 0;
  return groups.map((group) => {
    const startAngle = angle;
    const endAngle = angle + (group.count / sum) * 360;
    angle = endAngle;
    return {
      key: group.key,
      colorIndex: group.colorIndex,
      startAngle,
      endAngle,
      d: donutSlicePath(opts.cx, opts.cy, opts.r, startAngle, endAngle),
    };
  });
}
