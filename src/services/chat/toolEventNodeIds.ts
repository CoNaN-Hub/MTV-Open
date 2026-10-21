/**
 * toolEventNodeIds —— 官方「从工具事件里挖画布节点 id」这一支的**逐字**移植
 * （live `vendor-pkg-canvas-ChpWx5JY.js` @2400124 邻域）。
 *
 * 官方逐字（三步反解见文末）：
 * ```js
 * // @2400124  wot：工具事件数组 → 节点 id 去重列表
 * wot = e => {
 *   const t = [];
 *   for (const n of e)
 *     if (!(n.type !== "tool_event" || typeof n.content != "object" || !n.content))
 *       for (const o of TD(n.content)) t.includes(o) || t.push(o);
 *   return t;
 * };
 *
 * // @430830  TD = TY(content).map(t => t.nodeId).filter(t => typeof t == "string" && t.length > 0)
 * // @429244  TY：按 tool 名分流
 * TY = e => {
 *   const t = e?.response;
 *   if (!t || typeof t != "object") return [];
 *   const n = String(e.tool || "");
 *   if (Kv(n)) return aNe(t);                       // bash / tapnow_cli ⇒ canvas_changed.node_ids
 *   const o = d => Array.isArray(d) ? d.reduce((u, p) => {
 *     if (!p || typeof p != "object") return u;
 *     const m = typeof p.node_id == "string" ? p.node_id : void 0;
 *     return m && u.push({ nodeId: m }), u; }, []) : [];
 *   const r = d => { if (typeof d.title == "string" && d.title) return d.title;
 *                    if (typeof d.label == "string" && d.label) return d.label;
 *                    if (typeof d.reason == "string" && d.reason) return d.reason; };
 *   const i = d => { const u = [d.node_id, d.nodeId, d.id].find(m => typeof m == "string");
 *                    if (!u) return null; const p = r(d); return p ? { nodeId: u, title: p } : { nodeId: u }; };
 *   const l = d => Array.isArray(d) ? d.reduce((u, p) => {
 *     if (!p || typeof p != "object") return u; const m = i(p); return m && u.push(m), u; }, []) : [];
 *   const c = d => { const u = new Set(["node_id","nodeId","id","title","label","reason"]);
 *                    const p = typeof d.node_id == "string" || typeof d.nodeId == "string" || typeof d.id == "string";
 *                    const m = r(d) !== void 0;
 *                    return p && m && Object.keys(d).every(f => u.has(f)); };
 *   if (n === "locate_canvas_nodes") {
 *     if (Array.isArray(t)) return l(t);
 *     if (c(t)) { const d = i(t); return d ? [d] : []; }
 *     for (const d of [t.matches, t.node_pills, t.nodes, t.results, t.items, t.raw]) {
 *       const u = l(d); if (u.length > 0) return u;
 *     }
 *     return [];
 *   }
 *   if (n === "view_media") return lNe(t);
 *   if (Array.isArray(t.items)) return o(t.items);
 *   if (typeof t.node_id == "string") return [{ nodeId: t.node_id }];
 *   if (typeof t.group_node_id == "string") {
 *     const d = [{ nodeId: t.group_node_id }];
 *     if (Array.isArray(t.node_ids)) for (const u of t.node_ids) typeof u == "string" && d.push({ nodeId: u });
 *     return d;
 *   }
 *   return Array.isArray(t.node_ids) ? t.node_ids.filter(d => typeof d == "string").map(d => ({ nodeId: d }))
 *        : Array.isArray(t.results) ? o(t.results) : [];
 * };
 *
 * // @428959  lNe：view_media 的 images/videos[].ref（去掉 `node/` 前缀、去重）
 * lNe = e => { const t = [], n = new Set;
 *   for (const o of [e.images, e.videos]) if (Array.isArray(o)) for (const r of o) {
 *     if (!r || typeof r != "object") continue;
 *     const i = typeof r.ref == "string" ? r.ref.trim() : ""; if (!i) continue;
 *     const l = i.replace(/^node\//i, "");
 *     !l || n.has(l) || (n.add(l), t.push({ nodeId: l }));
 *   }
 *   return t; };
 *
 * // @428153 邻域  iNe / aNe：canvas_changed.actions 命中 {create,bind_job,generate} 才取 node_ids
 * iNe = e => { if (!e || typeof e != "object") return !1; const t = e.actions;
 *   return Array.isArray(t) ? t.some(n => typeof n == "string" && rNe.has(n.trim().toLowerCase())) : !1; };
 * aNe = e => { const t = e.canvas_changed; if (!iNe(t)) return [];
 *   const n = t.node_ids;
 *   return Array.isArray(n) ? n.filter(o => typeof o == "string" && o.trim().length > 0).map(o => ({ nodeId: o })) : []; };
 *
 * // @414092 / @414033  Kv = tT(e) === YSe || tT(e) === eT；tT = trim().toLowerCase() || null
 * YSe = "bash"; eT = "tapnow_cli"; XSe = "canvas_context";
 * ```
 *
 * 三步反解（import 别名 → `export{local as name}` → local 定义）：
 *   `wot`/`TD`/`TY`/`lNe`/`aNe`/`iNe`/`tT`/`Kv`/`YSe`/`eT`/`rNe` 均为 canvas chunk **本地**定义
 *   （`_live_find.mjs` 定位：TY@429244 · lNe@428959 · aNe@428723 · iNe@428598 · tT@414033 · Kv@414092），
 *   不进 import 表 ⇒ 直接读本地源。
 */
import type { ToolEventLike } from './agentToolLabels';

/** 官方 `YSe` / `eT`：这两个工具走「画布变更」分支。 */
const CANVAS_CHANGED_TOOLS = ['bash', 'tapnow_cli'] as const;
/** 官方 `rNe`：`canvas_changed.actions` 里算「真的改了画布」的动作名。 */
const CANVAS_CHANGED_ACTIONS = new Set(['create', 'bind_job', 'generate']);
/** 官方 `r`/`c` 的紧凑 NodePill 字段白名单。 */
const NODE_PILL_KEYS = new Set(['node_id', 'nodeId', 'id', 'title', 'label', 'reason']);

/** 官方 `TY` 的返回值：`{nodeId}` 或 `{nodeId, title}`。 */
export interface ToolCallNodeEntry {
  nodeId: string;
  title?: string;
}

/** 官方 `tT`：非字符串 ⇒ `null`；`trim().toLowerCase()` 为空 ⇒ `null`。 */
function normalizeToolName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

/** 官方 `Kv(e)`：`tT(e) === YSe || tT(e) === eT`。 */
function isCanvasChangedTool(tool: string): boolean {
  const normalized = normalizeToolName(tool);
  return normalized === CANVAS_CHANGED_TOOLS[0] || normalized === CANVAS_CHANGED_TOOLS[1];
}

/** 官方 `iNe(e)`：`actions` 里有一个命中 `rNe` 的字符串。 */
function hasCanvasChangedAction(canvasChanged: unknown): boolean {
  if (!canvasChanged || typeof canvasChanged !== 'object') return false;
  const actions = (canvasChanged as { actions?: unknown }).actions;
  if (!Array.isArray(actions)) return false;
  return actions.some(
    (action) => typeof action === 'string' && CANVAS_CHANGED_ACTIONS.has(action.trim().toLowerCase()),
  );
}

/** 官方 `aNe(response)`：`response.canvas_changed` → `node_ids`。 */
function canvasChangedNodeEntries(response: Record<string, unknown>): ToolCallNodeEntry[] {
  const canvasChanged = response.canvas_changed;
  if (!hasCanvasChangedAction(canvasChanged)) return [];
  const nodeIds = (canvasChanged as { node_ids?: unknown }).node_ids;
  if (!Array.isArray(nodeIds)) return [];
  return nodeIds
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id) => ({ nodeId: id }));
}

/** 官方 `lNe(response)`：`images`/`videos` 的 `ref`（去掉 `node/` 前缀、去重）。 */
function viewMediaNodeEntries(response: Record<string, unknown>): ToolCallNodeEntry[] {
  const out: ToolCallNodeEntry[] = [];
  const seen = new Set<string>();
  for (const list of [response.images, response.videos]) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const ref = typeof (raw as { ref?: unknown }).ref === 'string'
        ? ((raw as { ref: string }).ref).trim()
        : '';
      if (!ref) continue;
      const nodeId = ref.replace(/^node\//i, '');
      if (!nodeId || seen.has(nodeId)) continue;
      seen.add(nodeId);
      out.push({ nodeId });
    }
  }
  return out;
}

/** 官方 `r(d)`：`title` → `label` → `reason`。 */
function pillTitle(record: Record<string, unknown>): string | undefined {
  if (typeof record.title === 'string' && record.title) return record.title;
  if (typeof record.label === 'string' && record.label) return record.label;
  if (typeof record.reason === 'string' && record.reason) return record.reason;
  return undefined;
}

/** 官方 `i(d)`：紧凑 NodePill → 条目。 */
function pillEntry(record: Record<string, unknown>): ToolCallNodeEntry | null {
  const nodeId = [record.node_id, record.nodeId, record.id].find((id): id is string => typeof id === 'string');
  if (!nodeId) return null;
  const title = pillTitle(record);
  return title ? { nodeId, title } : { nodeId };
}

/** 官方 `l(d)`：数组 → 条目数组（丢弃非对象 / 没有 id 的项）。 */
function pillEntries(list: unknown): ToolCallNodeEntry[] {
  if (!Array.isArray(list)) return [];
  const out: ToolCallNodeEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const entry = pillEntry(item as Record<string, unknown>);
    if (entry) out.push(entry);
  }
  return out;
}

/** 官方 `o(d)`：只看 `node_id` 的窄化版本（`items` / `results` 用）。 */
function itemNodeEntries(list: unknown): ToolCallNodeEntry[] {
  if (!Array.isArray(list)) return [];
  const out: ToolCallNodeEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const nodeId = (item as { node_id?: unknown }).node_id;
    if (typeof nodeId === 'string' && nodeId) out.push({ nodeId });
  }
  return out;
}

/** 官方 `c(d)`：整个对象就是一条紧凑 NodePill（键集合被白名单限死）。 */
function isCompactPill(record: Record<string, unknown>): boolean {
  const hasId = typeof record.node_id === 'string'
    || typeof record.nodeId === 'string'
    || typeof record.id === 'string';
  const hasTitle = pillTitle(record) !== undefined;
  return hasId && hasTitle && Object.keys(record).every((key) => NODE_PILL_KEYS.has(key));
}

/** 官方 `TY(content)`：按 `tool` 分流，返回 `{nodeId, title?}[]`。 */
export function toolCallNodeEntries(content: unknown): ToolCallNodeEntry[] {
  if (!content || typeof content !== 'object') return [];
  const record = content as Record<string, unknown>;
  const response = record.response;
  if (!response || typeof response !== 'object') return [];
  const res = response as Record<string, unknown>;
  const tool = String(record.tool ?? '');

  if (isCanvasChangedTool(tool)) return canvasChangedNodeEntries(res);

  if (tool === 'locate_canvas_nodes') {
    if (Array.isArray(response)) return pillEntries(response);
    if (isCompactPill(res)) {
      const entry = pillEntry(res);
      return entry ? [entry] : [];
    }
    for (const candidate of [res.matches, res.node_pills, res.nodes, res.results, res.items, res.raw]) {
      const entries = pillEntries(candidate);
      if (entries.length > 0) return entries;
    }
    return [];
  }
  if (tool === 'view_media') return viewMediaNodeEntries(res);
  if (Array.isArray(res.items)) return itemNodeEntries(res.items);
  if (typeof res.node_id === 'string') return [{ nodeId: res.node_id }];
  if (typeof res.group_node_id === 'string') {
    const out: ToolCallNodeEntry[] = [{ nodeId: res.group_node_id }];
    if (Array.isArray(res.node_ids)) {
      for (const nodeId of res.node_ids) if (typeof nodeId === 'string') out.push({ nodeId });
    }
    return out;
  }
  if (Array.isArray(res.node_ids)) {
    return res.node_ids.filter((id): id is string => typeof id === 'string').map((id) => ({ nodeId: id }));
  }
  if (Array.isArray(res.results)) return itemNodeEntries(res.results);
  return [];
}

/** 官方 `TD(content)`：只要 id，且过滤空串。 */
export function toolCallNodeIds(content: unknown): string[] {
  return toolCallNodeEntries(content)
    .map((entry) => entry.nodeId)
    .filter((nodeId) => typeof nodeId === 'string' && nodeId.length > 0);
}

/**
 * 官方 `wot(e)`：工具事件数组 → 节点 id **去重**列表。
 * MTV 的工具事件里若没有 `response`（或字段对不上）⇒ 官方同样返回 `[]` ⇒ `chips` 行不渲染。
 */
export function toolEventNodeIds(items: readonly ToolEventLike[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    const entry = item as { type?: unknown; content?: unknown };
    if (entry.type !== 'tool_event' || typeof entry.content !== 'object' || !entry.content) continue;
    for (const nodeId of toolCallNodeIds(entry.content)) {
      if (!out.includes(nodeId)) out.push(nodeId);
    }
  }
  return out;
}
