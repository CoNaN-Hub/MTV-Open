import { describe, expect, it } from 'vitest';
import {
  CANVAS_STATS_PALETTE,
  donutSlicePath,
  donutSlices,
  polar,
  summarizeCanvasNodes,
  type CanvasStatsNodeLike,
} from '../../src/utils/canvasStats';

/** 造节点：`type` 走 React Flow 的节点类型字段 */
function node(type: string): CanvasStatsNodeLike {
  return { type };
}

describe('画布统计 · 聚合', () => {
  it('按 type 分组计数，数量降序', () => {
    const summary = summarizeCanvasNodes([
      node('ai-image'), node('ai-image'), node('ai-image'),
      node('ai-text'), node('ai-text'),
      node('ai-video'),
    ]);
    expect(summary.total).toBe(6);
    expect(summary.typeCount).toBe(3);
    expect(summary.groups.map((g) => [g.key, g.count])).toEqual([
      ['ai-image', 3],
      ['ai-text', 2],
      ['ai-video', 1],
    ]);
  });

  it('百分比取整（与官方同口径 Math.round）', () => {
    const summary = summarizeCanvasNodes([node('ai-image'), node('ai-image'), node('ai-video')]);
    expect(summary.groups.map((g) => g.percent)).toEqual([67, 33]);
  });

  it('空画布返回全 0', () => {
    expect(summarizeCanvasNodes([])).toEqual({ total: 0, typeCount: 0, groups: [] });
  });

  it('node.type 缺失时回落到 node.data.type', () => {
    const summary = summarizeCanvasNodes([{ data: { type: 'group' } }, { type: 'ai-image' }]);
    expect(summary.groups.map((g) => g.key).sort()).toEqual(['ai-image', 'group']);
  });

  it('标签走节点类型表；表外类型有专属中文名；完全未知则回落类型串', () => {
    const summary = summarizeCanvasNodes([node('ai-image'), node('group'), node('weird-type')]);
    const labels = Object.fromEntries(summary.groups.map((g) => [g.key, g.label]));
    expect(labels['ai-image']).toBe('生成图像');
    expect(labels.group).toBe('分组');
    expect(labels['weird-type']).toBe('weird-type');
  });

  it('类型数超过 10 时调色板回环取色', () => {
    const nodes = Array.from({ length: 11 }, (_, index) => node(`type-${index}`));
    const summary = summarizeCanvasNodes(nodes);
    expect(CANVAS_STATS_PALETTE).toHaveLength(10);
    expect(summary.typeCount).toBe(11);
    expect(summary.groups.map((g) => g.colorIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
  });
});

describe('画布统计 · 甜甜圈几何', () => {
  it('角度 0° 在 12 点钟方向，90° 在 3 点钟方向', () => {
    const top = polar(80, 80, 70, 0);
    expect(top.x).toBeCloseTo(80, 6);
    expect(top.y).toBeCloseTo(10, 6);

    const right = polar(80, 80, 70, 90);
    expect(right.x).toBeCloseTo(150, 6);
    expect(right.y).toBeCloseTo(80, 6);
  });

  it('扇形路径 = 圆心 → 半径线 → 弧线 → 闭合；超过半圆时 largeArc = 1', () => {
    const half = donutSlicePath(80, 80, 70, 0, 180);
    expect(half.startsWith('M 80 80 L ')).toBe(true);
    expect(half).toContain('A 70 70 0 0 0');
    expect(half.endsWith('Z')).toBe(true);

    expect(donutSlicePath(80, 80, 70, 0, 270)).toContain('A 70 70 0 1 0');
  });

  it('扇形角度按数量累加，合计 360°', () => {
    const summary = summarizeCanvasNodes([node('ai-image'), node('ai-image'), node('ai-image'), node('ai-text')]);
    const slices = donutSlices(summary.groups, { cx: 80, cy: 80, r: 70 });
    expect(slices).toHaveLength(2);
    expect(slices[0].startAngle).toBe(0);
    expect(slices[0].endAngle).toBeCloseTo(270, 6);
    expect(slices[1].startAngle).toBeCloseTo(270, 6);
    expect(slices[1].endAngle).toBeCloseTo(360, 6);
    expect(slices[0].d.startsWith('M 80 80 L ')).toBe(true);
  });

  it('单类型占满时是一个整圆（largeArc = 1）', () => {
    const summary = summarizeCanvasNodes([node('ai-image'), node('ai-image')]);
    const [slice] = donutSlices(summary.groups, { cx: 80, cy: 80, r: 70 });
    expect(slice.startAngle).toBe(0);
    expect(slice.endAngle).toBe(360);
    expect(slice.d).toContain('A 70 70 0 1 0');
  });

  it('没有节点时不出扇形', () => {
    expect(donutSlices(summarizeCanvasNodes([]).groups, { cx: 80, cy: 80, r: 70 })).toEqual([]);
  });
});
