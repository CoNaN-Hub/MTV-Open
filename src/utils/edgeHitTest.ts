/**
 * edgeHitTest —— 官方剪刀命中判定的等价实现。
 *
 * 依据（EXE `page-DPdEgTS0.js` @1335157 `Lpe` 及其前面的几何工具）：
 *   · `L5(domNode)` = 建立**命中索引**（缓存；`useEffect(...,[nodes,edges])` 里失效重建）
 *   · `wpe(index, flowPoint, Dpe / zoom)` = 在索引里找**到路径距离 < 阈值**的最近边，返回 edgeId
 *   · 距离用的贝塞尔工具：`Epe` = 曲线取点，`Npe` = 包围盒（用导数根求极值），`Ape` = 外扩 padding
 *   · `Dpe = 10`（屏幕像素；换算成流坐标 = `10 / zoom`）
 *
 * 本模块只做几何：把每条边换算成**流坐标下的三次贝塞尔**，再算点到曲线的最近距离。
 * ⚠️ 控制点算式对齐 React Flow `getBezierPath`：`calculateControlOffset(d) = 0.5 * d`（d >= 0）。
 */
import type { Node as RFNode, Edge } from '@xyflow/react';

export interface FlowPoint {
  x: number;
  y: number;
}

/** 一条边在流坐标下的三次贝塞尔 + 其 edgeId */
export interface EdgeHitSegment {
  edgeId: string;
  p0: FlowPoint;
  c1: FlowPoint;
  c2: FlowPoint;
  p3: FlowPoint;
}

/** React Flow 的 handle 方位（决定控制点朝哪边伸出） */
type Side = 'left' | 'right';

function nodeSize(node: RFNode): { w: number; h: number } {
  const data = (node.data ?? {}) as { nodeWidth?: number; nodeHeight?: number };
  const style = (node.style ?? {}) as { width?: number | string; height?: number | string };
  const w = Number(data.nodeWidth ?? style.width ?? 0) || 0;
  const h = Number(data.nodeHeight ?? style.height ?? 0) || 0;
  return { w, h };
}

function sideOf(handleId: string | null | undefined, fallback: Side): Side {
  return handleId === 'left' ? 'left' : handleId === 'right' ? 'right' : fallback;
}

/** handle 锚点 = 卡边中点（MTV 的左右 handle 都在竖直中线） */
function anchor(node: RFNode, side: Side): FlowPoint {
  const { w, h } = nodeSize(node);
  return { x: node.position.x + (side === 'right' ? w : 0), y: node.position.y + h / 2 };
}

function controlOffset(distance: number): number {
  return distance >= 0 ? 0.5 * distance : 0.25 * 25 * Math.sqrt(-distance);
}

/** 官方 `L5`：建立命中索引（调用方负责按 nodes/edges 变化缓存重建） */
export function buildEdgeHitIndex(
  nodes: readonly RFNode[],
  edges: readonly Edge[],
): EdgeHitSegment[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const segments: EdgeHitSegment[] = [];
  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    const sourceSide = sideOf(edge.sourceHandle, 'right');
    const targetSide = sideOf(edge.targetHandle, 'left');
    const p0 = anchor(source, sourceSide);
    const p3 = anchor(target, targetSide);
    const dx = Math.abs(p3.x - p0.x);
    const offset = controlOffset(dx);
    const c1: FlowPoint = { x: p0.x + (sourceSide === 'right' ? offset : -offset), y: p0.y };
    const c2: FlowPoint = { x: p3.x + (targetSide === 'right' ? offset : -offset), y: p3.y };
    segments.push({ edgeId: edge.id, p0, c1, c2, p3 });
  }
  return segments;
}

/** 官方 `Epe`：三次贝塞尔取点 */
export function bezierPointAt(segment: EdgeHitSegment, t: number): FlowPoint {
  const o = 1 - t;
  const a = o * o * o;
  const b = 3 * o * o * t;
  const c = 3 * o * t * t;
  const d = t * t * t;
  return {
    x: a * segment.p0.x + b * segment.c1.x + c * segment.c2.x + d * segment.p3.x,
    y: a * segment.p0.y + b * segment.c1.y + c * segment.c2.y + d * segment.p3.y,
  };
}

/** 点到该边的最短距离（采样法；阈值判定用，采样 32 段足够精确） */
export function distanceToEdge(segment: EdgeHitSegment, point: FlowPoint, samples = 32): number {
  let best = Number.POSITIVE_INFINITY;
  let prev = bezierPointAt(segment, 0);
  for (let i = 1; i <= samples; i++) {
    const next = bezierPointAt(segment, i / samples);
    /* 点到线段的距离（比只测端点更稳，避免采样点跨过最近点） */
    const vx = next.x - prev.x;
    const vy = next.y - prev.y;
    const lenSq = vx * vx + vy * vy;
    const t = lenSq > 0
      ? Math.max(0, Math.min(1, ((point.x - prev.x) * vx + (point.y - prev.y) * vy) / lenSq))
      : 0;
    const px = prev.x + t * vx;
    const py = prev.y + t * vy;
    const dist = Math.hypot(point.x - px, point.y - py);
    if (dist < best) best = dist;
    prev = next;
  }
  return best;
}

/** 官方 `wpe`：返回**最近的、且距离小于阈值**的那条边；没有则 null */
export function findEdgeNearFlowPoint(
  index: readonly EdgeHitSegment[],
  point: FlowPoint,
  threshold: number,
): string | null {
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const segment of index) {
    const distance = distanceToEdge(segment, point);
    if (distance <= threshold && distance < bestDistance) {
      bestDistance = distance;
      bestId = segment.edgeId;
    }
  }
  return bestId;
}

/** 官方常量：`Dpe = 10`（屏幕像素）⇒ 流坐标阈值 = `10 / zoom` */
export const EDGE_HIT_RADIUS_PX = 10;

export function hitThresholdForZoom(zoom: number): number {
  return zoom > 0 ? EDGE_HIT_RADIUS_PX / zoom : EDGE_HIT_RADIUS_PX;
}
