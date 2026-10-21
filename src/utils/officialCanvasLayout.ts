/**
 * officialCanvasLayout —— 官方「布局」下拉的两个动作，逐字移植官方源码
 * （`page-DPdEgTS0.js`：`XL` @897175 / `QL` @898022 / `h0` @898700 / `Dme` @1441174 / `I0` @1441095）。
 *
 * 官方：
 *   `Dme(nodes, edges, mode)` —— `mode === 'horizontal' ? XL(nodes, edges) : QL(nodes)`；
 *   `I0(nodes)` 是前置门：**≥2 个节点，且全部不是 group、且都没有 parentId**。
 *   `XL` = dagre `rankdir:'LR'`, `nodesep = ranksep = 200`；
 *   `QL` = 方形宫格，列数 `ceil(sqrt(n))`，间距同样 200。
 *
 * 差异（已核实，见 t983c 官方实测）：
 *   · 官方 `XL` 用 dagre；MTV 不引 dagre（官方包 12MB 里那份没必要搬进来），
 *     改用**等价的 LR 分层**：按出/入边做最长路径分层，同层按「原 y → 原 x」排序，
 *     列宽 = 该层最大节点宽，层间距 `ranksep`，层内节点间距 `nodesep`、并在列内水平居中。
 *     t983c 实测（4 个无连线的图片节点）：官方把 4 个节点**竖着排**（同列、居中、间距 200），
 *     MTV 这套算法给出完全相同的落点（见 t98x 比对）。
 *   · 官方还会把 `sourcePosition:'right' / targetPosition:'left'` 与边的 handle 一起改写；
 *     MTV 的节点不吃这套 handle 语义 ⇒ 只改位置，不动 handle（记录在案）。
 */
import type { Edge, Node as RFNode } from '@xyflow/react';
import type { BaseNodeData } from '../types';
import { getNodeBounds } from './nodeBounds';

export type OfficialLayoutMode = 'grid' | 'horizontal';

/** 官方 `XL` 默认 `{nodeSpacing:200, rankSpacing:200}`、`QL` 默认 `{nodeSpacing:200}` */
const DEFAULT_NODE_SPACING = 200;
const DEFAULT_RANK_SPACING = 200;

export interface OfficialLayoutOptions {
  nodeSpacing?: number;
  rankSpacing?: number;
}

export interface OfficialLayoutResult {
  /** nodeId → 新的**绝对**坐标（官方 `I0` 保证没有 parentId ⇒ 绝对坐标即 position） */
  positions: Map<string, { x: number; y: number }>;
}

/** 官方 `I0(e)`：`e.length < 2 ? false : e.every(t => t.type !== GROUP && !t.parentId)` */
export function canLayoutSelection(nodes: readonly RFNode<BaseNodeData>[]): boolean {
  return nodes.length >= 2 && nodes.every((n) => n.type !== 'group' && !n.parentId);
}

/**
 * 节点**真实渲染尺寸**（官方 `ln(node)` / `bs(node)` 的等价物）。
 * ⚠️ 不能直接用 `getNodeBounds`：它优先读 `data.nodeWidth/nodeHeight`，而 MTV 的卡片这两项是
 * 「按内容算出的另一套值」（实测 AI 角色图卡 data.nodeWidth=444×250，渲染却是 250×333）⇒
 * 布局会按错尺寸算。React Flow 的 `measured` 才是真实 DOM 尺寸，次选 `width/height`、`style`。
 */
export function renderSizeOf(node: RFNode<BaseNodeData>, all: readonly RFNode<BaseNodeData>[]): { width: number; height: number } {
  const measured = node.measured as { width?: number; height?: number } | undefined;
  if (measured && measured.width && measured.height) {
    return { width: measured.width, height: measured.height };
  }
  if (typeof node.width === 'number' && typeof node.height === 'number' && node.width > 0 && node.height > 0) {
    return { width: node.width, height: node.height };
  }
  const style = (node.style ?? {}) as { width?: number | string; height?: number | string };
  const styleWidth = typeof style.width === 'number' ? style.width : parseFloat(String(style.width ?? ''));
  const styleHeight = typeof style.height === 'number' ? style.height : parseFloat(String(style.height ?? ''));
  if (Number.isFinite(styleWidth) && Number.isFinite(styleHeight) && styleWidth > 0 && styleHeight > 0) {
    return { width: styleWidth, height: styleHeight };
  }
  const bounds = getNodeBounds(node, all as RFNode<BaseNodeData>[]);
  return { width: bounds.width, height: bounds.height };
}

/** 官方 `rs = {width:250,height:250}`（`vendor-pkg-canvas-futqHM6N.js`@473158）—— `xn`/`ko` 的兜底 */
export const OFFICIAL_DEFAULT_NODE_SIZE = { width: 250, height: 250 } as const;

/**
 * 官方 `xn(e)` / `ko(e)`（`vendor-pkg-canvas-futqHM6N.js`@473754 / @473878 逐字）：
 * ```js
 * const xn = e => { if(!e) return rs.width;  const t = e.width || e.measured?.width  || e?.dimensions?.width;  return Number.isFinite(t) ? t : rs.width;  };
 * const ko = e => { if(!e) return rs.height; const t = e.height || e.measured?.height || e?.dimensions?.height; return Number.isFinite(t) ? t : rs.height; };
 * ```
 * **用途**：SPREAD（铺开）布局的步长 —— 官方 `rLe`@1204870 `const i = xn(s)+64, l = ko(s)+64`。
 * ⚠️ 与 `renderSizeOf` 的区别：本函数顺序是 **`width` 优先、`measured` 次之**（官方逐字），
 *    `renderSizeOf` 是 `measured` 优先。MTV 的图卡不写 `width`（9333 实测 `n.width === undefined`、
 *    `measured = 250×333`）⇒ 两种顺序同值 ✓
 * ⚠️ 别用 `data.nodeWidth/nodeHeight` 代替它：那一对与实际渲染尺寸不是一个量
 *    （实测 3:4 图卡 `data = 444×592`，真实渲染却是 `250×333`）⇒ 铺开间距会偏大（用户报的 bug）。
 */
export function officialNodePixelSize(node: unknown): { width: number; height: number } {
  const n = node as {
    width?: number; height?: number;
    measured?: { width?: number; height?: number };
    dimensions?: { width?: number; height?: number };
  } | undefined;
  if (!n) return { ...OFFICIAL_DEFAULT_NODE_SIZE };
  const width = n.width || n.measured?.width || n.dimensions?.width;
  const height = n.height || n.measured?.height || n.dimensions?.height;
  return {
    width: Number.isFinite(width) ? (width as number) : OFFICIAL_DEFAULT_NODE_SIZE.width,
    height: Number.isFinite(height) ? (height as number) : OFFICIAL_DEFAULT_NODE_SIZE.height,
  };
}

function sizeOf(node: RFNode<BaseNodeData>, all: readonly RFNode<BaseNodeData>[]): { width: number; height: number } {
  return renderSizeOf(node, all);
}

/**
 * 选中节点的**真实包围盒**（官方 `Bi(points, 0)`）——位置取 `getNodeBounds`（含 parentId 偏移），
 * 尺寸取 `renderSizeOf`（真实渲染尺寸）。
 */
export function selectionBoundsOf(
  nodes: readonly RFNode<BaseNodeData>[],
  all: readonly RFNode<BaseNodeData>[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const node of nodes) {
    const origin = getNodeBounds(node, all as RFNode<BaseNodeData>[]);
    const size = renderSizeOf(node, all);
    if (origin.x < minX) minX = origin.x;
    if (origin.y < minY) minY = origin.y;
    if (origin.x + size.width > maxX) maxX = origin.x + size.width;
    if (origin.y + size.height > maxY) maxY = origin.y + size.height;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { minX, minY, maxX, maxY };
}

/** 官方 `h0(e)`：所有节点 `position` 的最小 x / 最小 y（非法值按 0） */
function originOf(nodes: readonly { position: { x: number; y: number } }[]): { minX: number; minY: number } {
  let minX = Infinity;
  let minY = Infinity;
  for (const node of nodes) {
    const x = Number.isFinite(node.position?.x) ? node.position.x : 0;
    const y = Number.isFinite(node.position?.y) ? node.position.y : 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;
  return { minX, minY };
}

/** 官方 `QL`：方形宫格（列数 `ceil(sqrt(n))`），列/行间距 `nodeSpacing`，节点在格内居中 */
export function officialSquareGridLayout(
  nodes: readonly RFNode<BaseNodeData>[],
  options: OfficialLayoutOptions = {},
): OfficialLayoutResult {
  const nodeSpacing = options.nodeSpacing ?? DEFAULT_NODE_SPACING;
  const count = nodes.length;
  const positions = new Map<string, { x: number; y: number }>();
  if (count === 0) return { positions };

  const sqrt = Math.sqrt(count);
  const columns = Math.ceil(sqrt);
  const rows = Math.ceil(count / columns);
  const sizes = nodes.map((node) => sizeOf(node, nodes));
  const cellWidth = Math.max(...sizes.map((s) => s.width));
  const cellHeight = Math.max(...sizes.map((s) => s.height));
  const origin = originOf(nodes);

  const raw = nodes.map((node, index) => {
    /* 官方：`w = Math.floor(b / a)`（行）、`_ = b % a`（列），`a = rows` */
    const row = Math.floor(index / rows);
    const column = index % rows;
    const size = sizes[index];
    const x = origin.minX + column * (cellWidth + nodeSpacing) + (cellWidth - size.width) / 2;
    const y = origin.minY + row * (cellHeight + nodeSpacing) + (cellHeight - size.height) / 2;
    positions.set(node.id, { x, y });
    return { x, y };
  });

  /* 官方收尾：把结果整体平移回原 `minX/minY`（`m = f.minX - h.minX`） */
  const layoutOrigin = originOf(raw.map((p) => ({ position: p })));
  const shiftX = origin.minX - layoutOrigin.minX;
  const shiftY = origin.minY - layoutOrigin.minY;
  for (const node of nodes) {
    const p = positions.get(node.id)!;
    positions.set(node.id, { x: p.x + shiftX, y: p.y + shiftY });
  }
  return { positions };
}

/**
 * 官方 `XL`（dagre `rankdir:'LR'` 的等价实现）：
 * 只对**选中集合内部**的边分层（官方 `d = t.filter(x => c.has(x.source) && c.has(x.target))`）。
 */
export function officialHorizontalLayout(
  nodes: readonly RFNode<BaseNodeData>[],
  edges: readonly Edge[],
  options: OfficialLayoutOptions = {},
): OfficialLayoutResult {
  const nodeSpacing = options.nodeSpacing ?? DEFAULT_NODE_SPACING;
  const rankSpacing = options.rankSpacing ?? DEFAULT_RANK_SPACING;
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return { positions };

  const origin = originOf(nodes);
  const ids = new Set(nodes.map((n) => n.id));
  const inner = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const sizes = new Map(nodes.map((n) => [n.id, sizeOf(n, nodes)]));

  /* ---- 最长路径分层（Kahn）；有环时退化为「按原位置顺序依次递增层」 ---- */
  const rank = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const adjacency = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const edge of inner) {
    adjacency.get(edge.source)!.push(edge.target);
    indeg.set(edge.target, (indeg.get(edge.target) ?? 0) + 1);
  }
  const queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const settled = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    settled.add(current);
    for (const next of adjacency.get(current) ?? []) {
      rank.set(next, Math.max(rank.get(next) ?? 0, (rank.get(current) ?? 0) + 1));
      indeg.set(next, (indeg.get(next) ?? 0) - 1);
      if ((indeg.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  if (settled.size < nodes.length) {
    /* 有环：剩余节点按原位置顺序依次放到最右层（dagre 会打破环，此处只求可用） */
    let extra = Math.max(...nodes.map((n) => rank.get(n.id) ?? 0)) + 1;
    const ordered = nodes
      .filter((n) => !settled.has(n.id))
      .slice()
      .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
    for (const node of ordered) {
      rank.set(node.id, extra);
      extra += 1;
    }
  }

  /* ---- 同层排序：原 y → 原 x（官方由 dagre 的 ordering 决定，实测与此一致） ---- */
  const maxRank = Math.max(...nodes.map((n) => rank.get(n.id) ?? 0));
  const layers: RFNode<BaseNodeData>[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const node of nodes) layers[rank.get(node.id) ?? 0].push(node);
  for (const layer of layers) {
    layer.sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x));
  }

  /* ---- 列 x：前一列最大宽 + ranksep；节点在列内水平居中 ---- */
  let cursorX = 0;
  const layerX: number[] = [];
  for (const layer of layers) {
    layerX.push(cursorX);
    const widest = layer.length === 0 ? 0 : Math.max(...layer.map((n) => sizes.get(n.id)!.width));
    cursorX += widest + rankSpacing;
  }

  const raw: { id: string; x: number; y: number }[] = [];
  layers.forEach((layer, index) => {
    const widest = layer.length === 0 ? 0 : Math.max(...layer.map((n) => sizes.get(n.id)!.width));
    let cursorY = 0;
    for (const node of layer) {
      const size = sizes.get(node.id)!;
      raw.push({
        id: node.id,
        x: layerX[index] + (widest - size.width) / 2,
        y: cursorY,
      });
      cursorY += size.height + nodeSpacing;
    }
  });

  const layoutOrigin = originOf(raw.map((p) => ({ position: p })));
  const shiftX = origin.minX - layoutOrigin.minX;
  const shiftY = origin.minY - layoutOrigin.minY;
  for (const item of raw) positions.set(item.id, { x: item.x + shiftX, y: item.y + shiftY });
  return { positions };
}

/** 官方 `Dme(e, t, n)`：`n === 'horizontal' ? XL : QL` */
export function officialLayoutSelection(
  mode: OfficialLayoutMode,
  nodes: readonly RFNode<BaseNodeData>[],
  edges: readonly Edge[],
  options: OfficialLayoutOptions = {},
): OfficialLayoutResult {
  if (!canLayoutSelection(nodes)) return { positions: new Map() };
  return mode === 'horizontal'
    ? officialHorizontalLayout(nodes, edges, options)
    : officialSquareGridLayout(nodes, options);
}
