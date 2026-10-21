/**
 * officialGroupLayout —— 官方**分组工具条**里「布局」用的两个算法本体（逐字抄自官方包）
 *
 * 出处：`index-BiTZf8mJ.js`，`zoom-slider` 通过 import 别名引用
 *   `Rse`（宫格）= index 导出名 `_Bl` @char8270327
 *   `Mse`（水平）= index 导出名 `bBl` @char8269087
 *
 * 官方 `_Bl` 逐字：
 * ```js
 * _Bl = (t, e = {}) => {
 *   const { padding: n = 100, nodeSpacing: a = 200 } = e;
 *   const r = t.length;
 *   if (r === 0) return { nodes: [], groupSize: { width: 200, height: 200 } };
 *   const o = Math.sqrt(r), s = Math.ceil(o), l = Math.ceil(r / s);
 *   const c = t.map(y => ({ id: y.id, width: JB(y), height: ez(y) }));
 *   const d = Math.max(...c.map(y => y.width));
 *   const u = Math.max(...c.map(y => y.height));
 *   const h = t.map((y, p) => {
 *     const m = Math.floor(p / l), k = p % l;
 *     const b = c.find(A => A.id === y.id);
 *     if (!b) return y;
 *     const _ = n + k * (d + a) + (d - b.width) / 2;
 *     const M = n + m * (u + a) + (u - b.height) / 2;
 *     return { ...y, position: { x: _, y: M } };
 *   });
 *   const f = { width: n * 2 + l * d + (l - 1) * a, height: n * 2 + s * u + (s - 1) * a };
 *   return { nodes: h, groupSize: f };
 * }
 * ```
 * （`t` = 子节点数组 · `JB`/`ez` = 节点宽/高 —— MTV 用 `renderSizeOf` 取同一个「真实渲染尺寸」）
 *
 * ⚠️ 与 MTV 旧实现（`officialCanvasLayout.officialSquareGridLayout`）的**关键差异**（用户实测「执行逻辑官方不一样」）：
 *   · 官方 **padding = 100 · nodeSpacing = 200**（旧 MTV 用的是它自己那套间距）
 *   · 官方的**列数** = `cols = ceil(sqrt(n))`、**行数** = `ceil(n / cols)` ⇒ **按列排**（`col = i % cols`）
 *   · 每个格子是 **maxW × maxH**，节点在格子里**居中**（`(maxW - w)/2`）
 *   · 官方**同时返回 `groupSize`**，调用点会把它写进分组节点的 `width/height/measured`
 *     （见 `services/groupToolbarActions.layoutGroupChildren`）
 *
 * ⚠️ 水平布局 `bBl` 用的是 **dagre**（`graphlib.Graph` + `dagre.layout`，`rankdir:"LR"`,
 *    `nodesep/ranksep = 200`, `marginx/marginy = 100`），MTV 目前**没有 dagre 依赖**
 *    ⇒ 这一支暂时保留 MTV 既有的水平算法，但**groupSize 按官方公式**（`maxX/maxY + padding`）算，
 *      并在下方显式标注这是待对齐项（下一轮补 dagre 或等价 LR 分层）。
 */
import dagre from '@dagrejs/dagre';
import { renderSizeOf } from './officialCanvasLayout';
import type { BaseNodeData } from '../types';
import type { Node as RFNode } from '@xyflow/react';

/** 官方 `_Bl` 的默认参数（逐字） */
export const OFFICIAL_GRID_PADDING = 100;
export const OFFICIAL_GRID_NODE_SPACING = 200;
/** 官方 `bBl` 的默认参数（逐字） */
export const OFFICIAL_TREE_NODE_SPACING = 200;
export const OFFICIAL_TREE_RANK_SPACING = 200;
export const OFFICIAL_TREE_PADDING = 100;

export interface OfficialLayoutResult<T> {
  nodes: T[];
  /** 官方同款：分组节点应当被写成这个尺寸 */
  groupSize: { width: number; height: number };
}

/**
 * 官方 `_Bl`（宫格布局）逐字实现。
 * 返回的是**相对坐标**（与官方一致：官方直接把这些 position 写进子节点，子节点坐标本就是相对分组的）。
 */
export function officialSquareGridLayout<T extends RFNode<BaseNodeData>>(
  children: readonly T[],
  all: readonly RFNode<BaseNodeData>[],
  options: { padding?: number; nodeSpacing?: number } = {},
): OfficialLayoutResult<T> {
  const padding = options.padding ?? OFFICIAL_GRID_PADDING;
  const nodeSpacing = options.nodeSpacing ?? OFFICIAL_GRID_NODE_SPACING;
  const count = children.length;
  if (count === 0) return { nodes: [], groupSize: { width: 200, height: 200 } };

  const root = Math.sqrt(count);
  const rows = Math.ceil(root);
  const cols = Math.ceil(count / rows);
  const sizes = children.map((node) => ({ id: node.id, ...renderSizeOf(node, all) }));
  const maxWidth = Math.max(...sizes.map((s) => s.width));
  const maxHeight = Math.max(...sizes.map((s) => s.height));

  const nodes = children.map((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const size = sizes.find((s) => s.id === node.id);
    if (!size) return node;
    const x = padding + col * (maxWidth + nodeSpacing) + (maxWidth - size.width) / 2;
    const y = padding + row * (maxHeight + nodeSpacing) + (maxHeight - size.height) / 2;
    return { ...node, position: { x, y } };
  });

  const groupSize = {
    width: padding * 2 + cols * maxWidth + (cols - 1) * nodeSpacing,
    height: padding * 2 + rows * maxHeight + (rows - 1) * nodeSpacing,
  };
  return { nodes, groupSize };
}

/**
 * 官方 `bBl`（水平/树布局）的 **groupSize 公式**（逐字）：
 *   `width = max(x + w) + padding` · `height = max(y + h) + padding`
 * （官方是先跑 dagre、再整体平移到 `+padding`，所以是**单边** padding，与宫格的 `padding*2` 不同）
 */
export function treeGroupSize<T extends RFNode<BaseNodeData>>(
  laidOut: readonly T[],
  all: readonly RFNode<BaseNodeData>[],
  padding = OFFICIAL_TREE_PADDING,
): { width: number; height: number } {
  if (laidOut.length === 0) return { width: 200, height: 200 };
  const right = laidOut.map((node) => node.position.x + renderSizeOf(node, all).width);
  const bottom = laidOut.map((node) => node.position.y + renderSizeOf(node, all).height);
  return {
    width: Math.max(...right) + padding,
    height: Math.max(...bottom) + padding,
  };
}

/**
 * 官方 `bBl`（水平/树布局）**逐字实现** —— 用 dagre。
 *
 * 官方源码（`index-BiTZf8mJ.js`@char8269087，逐字）：
 * ```js
 * bBl = (t, e, n = {}) => {
 *   const { nodeSpacing: a = 200, rankSpacing: r = 200, padding: o = 100 } = n;
 *   if (t.length === 0) return { nodes: [], edges: [], groupSize: { width: 200, height: 200 } };
 *   const s = new Nmt.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
 *   s.setGraph({ rankdir: "LR", nodesep: a, ranksep: r, marginx: o, marginy: o });
 *   const l = new Set(t.map(S => S.id));
 *   t.forEach(S => s.setNode(S.id, { width: JB(S), height: ez(S) }));
 *   const c = e.filter(S => l.has(S.source) && l.has(S.target));   // 只看**两端都在组内**的边
 *   c.forEach(S => s.setEdge(S.source, S.target));
 *   Nmt.layout(s);
 *   const d = t.map(S => {
 *     const I = s.node(S.id), N = Number.isFinite(I?.x) ? I.x : 0, T = Number.isFinite(I?.y) ? I.y : 0;
 *     return { ...S, targetPosition: "left", sourcePosition: "right",
 *              position: { x: N - JB(S) / 2, y: T - ez(S) / 2 } };   // dagre 给的是**中心点**
 *   });
 *   // 再整体平移到 padding：先减去 min(x)/min(y)，再加 o
 *   const A = { width: _(max right) + o, height: M(max bottom) + o };   // **单边** padding
 *   const x = c.map(S => ({ ...S, sourceHandle: "right", targetHandle: "left" }));
 *   return { nodes: m, edges: x, groupSize: A };
 * }
 * ```
 * ⚠️ 官方**同时回写组内边的 handle**（`sourceHandle:"right"` / `targetHandle:"left"`）
 *    —— MTV 侧同样要写回（见 `layoutGroupChildren`）。
 * ⚠️ MTV 之前没有 dagre 依赖、这一支用的是自己的算法 ⇒ 位置与官方不同（用户：「执行逻辑官方不一样」）。
 *    现在补上 `@dagrejs/dagre`（官方就是 dagre），按逐字实现。
 */
export interface OfficialTreeEdge {
  id: string;
  sourceHandle: string;
  targetHandle: string;
}

export interface OfficialTreeLayoutResult<T> extends OfficialLayoutResult<T> {
  /** 需要把 handle 回写成 `right` / `left` 的**组内边**（官方 `x`） */
  edges: OfficialTreeEdge[];
}

export function officialTreeLayout<T extends RFNode<BaseNodeData>>(
  children: readonly T[],
  edges: readonly { id: string; source: string; target: string }[],
  all: readonly RFNode<BaseNodeData>[],
  options: { nodeSpacing?: number; rankSpacing?: number; padding?: number } = {},
): OfficialTreeLayoutResult<T> {
  const nodeSpacing = options.nodeSpacing ?? OFFICIAL_TREE_NODE_SPACING;
  const rankSpacing = options.rankSpacing ?? OFFICIAL_TREE_RANK_SPACING;
  const padding = options.padding ?? OFFICIAL_TREE_PADDING;
  if (children.length === 0) {
    return { nodes: [], edges: [], groupSize: { width: 200, height: 200 } };
  }

  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: 'LR',
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    marginx: padding,
    marginy: padding,
  });
  const inside = new Set(children.map((node) => node.id));
  for (const node of children) {
    const size = renderSizeOf(node, all);
    graph.setNode(node.id, { width: size.width, height: size.height });
  }
  const innerEdges = edges.filter((edge) => inside.has(edge.source) && inside.has(edge.target));
  for (const edge of innerEdges) graph.setEdge(edge.source, edge.target);

  dagre.layout(graph);

  /* dagre 给的是**中心点**，官方减半宽/半高换成左上角坐标。
     ⚠️ 官方这里写的是字面量 `targetPosition:"left" / sourcePosition:"right"`；RF 的类型要求
        `Position` 枚举 —— 枚举值就是这两个字符串（`Position.Left === 'left'`）⇒ 用 `as unknown as T` 保留官方字面量。 */
  const centered = children.map((node) => {
    const laid = graph.node(node.id) as { x?: number; y?: number } | undefined;
    const cx = Number.isFinite(laid?.x) ? (laid!.x as number) : 0;
    const cy = Number.isFinite(laid?.y) ? (laid!.y as number) : 0;
    const size = renderSizeOf(node, all);
    return {
      ...node,
      targetPosition: 'left',
      sourcePosition: 'right',
      position: { x: cx - size.width / 2, y: cy - size.height / 2 },
    } as unknown as T;
  });

  /* 再整体平移到 padding（官方：减 min、加 o） */
  const minX = Math.min(...centered.map((node) => (Number.isFinite(node.position.x) ? node.position.x : 0)));
  const minY = Math.min(...centered.map((node) => (Number.isFinite(node.position.y) ? node.position.y : 0)));
  const nodes = centered.map((node) => ({
    ...node,
    position: {
      x: (Number.isFinite(node.position.x) ? node.position.x : 0) - minX + padding,
      y: (Number.isFinite(node.position.y) ? node.position.y : 0) - minY + padding,
    },
  }));

  const rights = nodes.map((node) => node.position.x + renderSizeOf(node, all).width);
  const bottoms = nodes.map((node) => node.position.y + renderSizeOf(node, all).height);
  const groupSize = { width: Math.max(...rights) + padding, height: Math.max(...bottoms) + padding };

  return {
    nodes,
    edges: innerEdges.map((edge) => ({ id: edge.id, sourceHandle: 'right', targetHandle: 'left' })),
    groupSize,
  };
}
