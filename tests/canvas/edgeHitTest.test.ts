/**
 * edgeHitTest 单测 —— 官方剪刀命中判定（指针↔贝塞尔路径距离）的几何正确性。
 * 依据：EXE `page-DPdEgTS0.js` @1335157 `Lpe` / `wpe` / `Dpe = 10`。
 */
import { describe, expect, it } from 'vitest';
import {
  buildEdgeHitIndex,
  bezierPointAt,
  distanceToEdge,
  findEdgeNearFlowPoint,
  hitThresholdForZoom,
  EDGE_HIT_RADIUS_PX,
} from '../../src/utils/edgeHitTest';

/** 造一个 280×160 的卡（MTV 默认尺寸），位置 (x,y) */
function card(id: string, x: number, y: number) {
  return {
    id,
    type: 'ai-image',
    position: { x, y },
    data: { nodeWidth: 280, nodeHeight: 160 },
  } as never;
}

function edge(id: string, source: string, target: string, sourceHandle = 'right', targetHandle = 'left') {
  return { id, source, target, sourceHandle, targetHandle } as never;
}

describe('剪刀命中判定（官方几何）', () => {
  it('锚点取卡边中点（右柄 = 右缘中点 / 左柄 = 左缘中点）', () => {
    const index = buildEdgeHitIndex([card('a', 0, 0), card('b', 500, 0)], [edge('e1', 'a', 'b')]);
    expect(index).toHaveLength(1);
    expect(index[0].p0).toEqual({ x: 280, y: 80 });   // a 的右缘中点
    expect(index[0].p3).toEqual({ x: 500, y: 80 });   // b 的左缘中点
  });

  it('t=0 / t=1 取到两端点；t=0.5 落在中线附近', () => {
    const [seg] = buildEdgeHitIndex([card('a', 0, 0), card('b', 500, 0)], [edge('e1', 'a', 'b')]);
    expect(bezierPointAt(seg, 0)).toEqual(seg.p0);
    expect(bezierPointAt(seg, 1)).toEqual(seg.p3);
    const mid = bezierPointAt(seg, 0.5);
    expect(Math.abs(mid.y - 80)).toBeLessThan(0.001);  // 同高 ⇒ 曲线是直线，y 不变
    expect(mid.x).toBeGreaterThan(280);
    expect(mid.x).toBeLessThan(500);
  });

  it('点到曲线的距离：同高直线上，横向中点的垂距 = 0，纵向偏移 = |dy|', () => {
    const [seg] = buildEdgeHitIndex([card('a', 0, 0), card('b', 500, 0)], [edge('e1', 'a', 'b')]);
    expect(distanceToEdge(seg, { x: 390, y: 80 })).toBeLessThan(0.5);
    expect(distanceToEdge(seg, { x: 390, y: 100 })).toBeGreaterThan(19);
    expect(distanceToEdge(seg, { x: 390, y: 100 })).toBeLessThan(21);
  });

  it('命中阈值：10px 内命中、之外不命中（同高直线，纵向偏移 9 / 11）', () => {
    const index = buildEdgeHitIndex([card('a', 0, 0), card('b', 500, 0)], [edge('e1', 'a', 'b')]);
    expect(findEdgeNearFlowPoint(index, { x: 390, y: 89 }, 10)).toBe('e1');
    expect(findEdgeNearFlowPoint(index, { x: 390, y: 91 }, 10)).toBeNull();
  });

  it('多条边时取**最近**的一条', () => {
    const index = buildEdgeHitIndex(
      [card('a', 0, 0), card('b', 500, 0), card('c', 0, 300)],
      [edge('near', 'a', 'b'), edge('far', 'a', 'c')],
    );
    expect(findEdgeNearFlowPoint(index, { x: 390, y: 84 }, 10)).toBe('near');
    /* 用「far 曲线上的真实点」验证：距离 ≈ 0 ⇒ 命中 far（手写坐标容易不在曲线上 ✗）*/
    const onFar = bezierPointAt(index[1], 0.5);
    expect(distanceToEdge(index[1], onFar)).toBeLessThan(0.5);
    expect(findEdgeNearFlowPoint(index, onFar, 10)).toBe('far');
  });

  it('缩放换算：阈值 = 10 / zoom（官方 `Dpe / zoom`）', () => {
    expect(EDGE_HIT_RADIUS_PX).toBe(10);
    expect(hitThresholdForZoom(1)).toBe(10);
    expect(hitThresholdForZoom(2)).toBe(5);
    expect(hitThresholdForZoom(0)).toBe(10);   // 非法缩放兜底
  });

  it('缺少端点节点的边会被跳过（不建索引）', () => {
    const index = buildEdgeHitIndex([card('a', 0, 0)], [edge('e1', 'a', 'ghost')]);
    expect(index).toHaveLength(0);
  });
});
