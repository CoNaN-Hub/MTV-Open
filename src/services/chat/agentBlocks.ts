/**
 * agentBlocks —— 官方**块模型**（块分组管线）逐字移植。
 *
 * 覆盖表 §6 #2 原先写的是「块模型 `{kind:"collapsible"|"normal"}` 落进渲染层」—— **那个描述是错的**
 * （见 `agent-挖掘覆盖表.md` §11 的复核）。live 的真相是**两层**：
 *
 * **第 1 层 `exe`**（`vendor-pkg-canvas-ChpWx5JY.js` **@25081**）—— 切成 `plain` / `subagent`：
 * ```js
 * exe = e => { const t=[]; let n=[], o=null;
 *   const r=()=>{ n.length>0 && t.push({kind:"plain", items:n}); n=[] };
 *   const i=()=>{ o && t.push({kind:"subagent", ...o}); o=null };
 *   for (const l of e) {
 *     if (bR(l)) { r(); i(); o={agent:l, children:[]}; continue }
 *     if (o) { const c=o.agent.endedAt;
 *              if (!(typeof c=="number" && typeof l.startedAt=="number" && l.startedAt>c)) { o.children.push(l); continue }
 *              i() }
 *     n.push(l) }
 *   r(); i(); return t }
 * ```
 * `bR(e) = Uge(e).toLowerCase() === Bge`，`Bge = "agent"`（@20805）⇒ **subagent 判据 = 工具名小写等于 `"agent"`**。
 *
 * **第 2 层 `nie`**（@2394688）—— 把 `plain` 段再按 `search` / `activity` 连续分桶：
 * ```js
 * nie = e => exe(e).flatMap(t => t.kind==="subagent"
 *   ? [{kind:"subagent", agent:t.agent, children:t.children}]
 *   : PF(t.items).map(n => ({kind:"bucket", items:n})))
 * ```
 *
 * 分桶判据（@2393525–@2394546 邻域，全部逐字）：
 * ```js
 * Xnt = /^(?:(?:web\s+research|research)(?:\s+on)?|web\s+search(?:\s+(?:on|for))?|search\s+(?:the\s+)?web(?:\s+for)?|联网搜索|搜索网页|搜索网络|检索网页|检索网络)[\s:：]+(.+)$/i
 * tT  = e => typeof e != "string" ? null : e.trim().toLowerCase() || null
 * yi  = e => (…) ? "" : String(e.content.tool ?? "").toLowerCase()      // ⚠️ 小写化，但**不 trim**
 * fl  = e => { const t = tT(e); return t === "websearch" || t === "web_search" }
 * UM  = e => { if (!e || typeof e != "object") return ""; const t = e.description; return typeof t == "string" ? t.trim() : "" }
 * eie = e => { const t = e.content; return UM(t.request) || UM(t.response) }
 * Fx  = e => (content 里的 tool_call_id) || (tool_use_id) || ""
 * Qnt = e => { for (const n of [request, response]) for (const r of ["query","search_query","searchQuery","q"]) … }
 * tie = e => /(?:web[_-]?search|websearch)/i.test(Fx(e))
 * IE  = e => { const t = eie(e), n = Xnt.exec(t);
 *              return n?.[1]?.trim() ? n[1].trim() : (tie(e) ? Qnt(e) || t : "") }
 * BM  = e => fl(yi(e)) || tie(e) || !!IE(e)
 * jE  = e => BM(e) ? "search" : "activity"
 * PF  = e => { const t=[]; let n=""; for (const o of e) { const r=jE(o), i=t[t.length-1];
 *               if (i && r===n) { i.push(o); continue } const l=[o]; t.push(l); n=r } return t }
 * ```
 *
 * ⚠️ **本模块只产数据、不碰渲染**（接线由 `MessageBubble` 做）。
 */

/** 官方 `tT`（@414033）：`typeof e!="string"?null:e.trim().toLowerCase()||null`。 */
export function tT(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().toLowerCase() || null;
}

/** 官方 `Uge`（@20805 邻域）：`content.tool` 原样字符串（**不**归一化）。 */
export function Uge(item: OfficialItemLike | null | undefined): string {
  if (!item || item.type !== 'tool_event') return '';
  const content = item.content;
  if (typeof content !== 'object' || content === null) return '';
  return String((content as Record<string, unknown>).tool ?? '');
}

/** 官方 `yi`：工具名**小写化**（`toLowerCase()`，但**不 trim**）。 */
export function yi(item: OfficialItemLike | null | undefined): string {
  if (!item || item.type !== 'tool_event') return '';
  const content = item.content;
  if (typeof content !== 'object' || content === null) return '';
  return String((content as Record<string, unknown>).tool ?? '').toLowerCase();
}

/** 官方 `fl`（@414155）：`tT(e) === "websearch" || tT(e) === "web_search"`。 */
export function fl(tool: unknown): boolean {
  const t = tT(tool);
  return t === 'websearch' || t === 'web_search';
}

/** 官方 `UM`（@2393102）：取对象上的 `description`（trim 后）。 */
export function UM(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const t = (value as Record<string, unknown>).description;
  return typeof t === 'string' ? t.trim() : '';
}

/** 官方 `eie`（@2393678）：`UM(content.request) || UM(content.response)`。 */
export function eie(item: OfficialItemLike | null | undefined): string {
  if (!item || item.type !== 'tool_event') return '';
  const content = item.content;
  if (typeof content !== 'object' || content === null) return '';
  const c = content as Record<string, unknown>;
  return UM(c.request) || UM(c.response);
}

/** 官方 `Fx`：`content.tool_call_id || content.tool_use_id || ""`。 */
export function Fx(item: OfficialItemLike | null | undefined): string {
  if (!item || item.type !== 'tool_event') return '';
  const content = item.content;
  if (typeof content !== 'object' || content === null) return '';
  const c = content as Record<string, unknown>;
  return (typeof c.tool_call_id === 'string' ? c.tool_call_id : '')
    || (typeof c.tool_use_id === 'string' ? c.tool_use_id : '');
}

/** 官方 `Qnt`（@2394025）：从 `request`/`response` 里找 `query` / `search_query` / `searchQuery` / `q`。 */
export function Qnt(item: OfficialItemLike | null | undefined): string {
  if (!item || item.type !== 'tool_event') return '';
  const content = item.content;
  if (typeof content !== 'object' || content === null) return '';
  const c = content as Record<string, unknown>;
  for (const n of [c.request, c.response]) {
    if (!n || typeof n !== 'object') continue;
    const o = n as Record<string, unknown>;
    for (const r of ['query', 'search_query', 'searchQuery', 'q']) {
      const v = o[r];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return '';
}

/** 官方 `tie`（@2393525 邻域）：对 `Fx(e)` 跑 `/(?:web[_-]?search|websearch)/i`。 */
export function tie(item: OfficialItemLike | null | undefined): boolean {
  return /(?:web[_-]?search|websearch)/i.test(Fx(item));
}

/** 官方 `Xnt`：把「联网搜索」类指令式描述里的**查询词**捕出来（逐字，含中文触发词）。 */
export const Xnt = /^(?:(?:web\s+research|research)(?:\s+on)?|web\s+search(?:\s+(?:on|for))?|search\s+(?:the\s+)?web(?:\s+for)?|联网搜索|搜索网页|搜索网络|检索网页|检索网络)[\s:：]+(.+)$/i;

/** 官方 `IE`：先试 `Xnt` 捕查询词，否则 `tie` 命中时用 `Qnt`（或描述本身）。 */
export function IE(item: OfficialItemLike | null | undefined): string {
  const t = eie(item);
  const n = Xnt.exec(t);
  if (n?.[1]?.trim()) return n[1].trim();
  return tie(item) ? Qnt(item) || t : '';
}

/** 官方 `BM`：`fl(yi(e)) || tie(e) || !!IE(e)`。 */
export function BM(item: OfficialItemLike | null | undefined): boolean {
  return fl(yi(item)) || tie(item) || !!IE(item);
}

/** 官方 `jE`：`BM(e) ? "search" : "activity"`。 */
export function jE(item: OfficialItemLike | null | undefined): 'search' | 'activity' {
  return BM(item) ? 'search' : 'activity';
}

/** 官方 `PF`（@2394545）：把一串项按 `jE` **连续**分组（同 key 才并入同一桶）。 */
export function PF<T extends OfficialItemLike>(items: readonly T[]): T[][] {
  const t: T[][] = [];
  let n = '';
  for (const o of items) {
    const r = jE(o);
    const i = t[t.length - 1];
    if (i && r === n) { i.push(o); continue; }
    t.push([o]);
    n = r;
  }
  return t;
}

/** 官方 `Bge`（@20805 邻域）= `"agent"`。 */
export const Bge = 'agent';

/** 官方 `bR`：`Uge(e).toLowerCase() === "agent"` ⇒ 起一个 subagent 块。 */
export function bR(item: OfficialItemLike | null | undefined): boolean {
  return Uge(item).toLowerCase() === Bge;
}

export interface OfficialItemLike {
  type?: string;
  content?: unknown;
  startedAt?: number;
  endedAt?: number;
  [key: string]: unknown;
}

export interface PlainBlock<T> { kind: 'plain'; items: T[] }
export interface SubagentBlock<T> { kind: 'subagent'; agent: T; children: T[] }
export type ExeBlock<T> = PlainBlock<T> | SubagentBlock<T>;

export interface BucketBlock<T> { kind: 'bucket'; items: T[] }
export type NieBlock<T> = SubagentBlock<T> | BucketBlock<T>;

/**
 * 官方 `exe`（@25081）—— 第 1 层：切成 `plain` 段与 `subagent` 块。
 * subagent 的 `children` 归属判据：`l.startedAt <= agent.endedAt`（两侧都必须是 number）。
 */
export function exe<T extends OfficialItemLike>(contents: readonly T[]): ExeBlock<T>[] {
  const t: ExeBlock<T>[] = [];
  let n: T[] = [];
  let o: { agent: T; children: T[] } | null = null;
  const r = () => {
    if (n.length > 0) t.push({ kind: 'plain', items: n });
    n = [];
  };
  const i = () => {
    if (o) t.push({ kind: 'subagent', agent: o.agent, children: o.children });
    o = null;
  };
  for (const l of contents) {
    if (bR(l)) { r(); i(); o = { agent: l, children: [] }; continue; }
    if (o) {
      const c = o.agent.endedAt;
      if (!(typeof c === 'number' && typeof l.startedAt === 'number' && l.startedAt > c)) {
        o.children.push(l);
        continue;
      }
      i();
    }
    n.push(l);
  }
  r();
  i();
  return t;
}

/** 官方 `nie`（@2394688）—— 第 2 层：`plain` 段按 `PF` 切成 `bucket`。 */
export function nie<T extends OfficialItemLike>(contents: readonly T[]): NieBlock<T>[] {
  const out: NieBlock<T>[] = [];
  for (const block of exe(contents)) {
    if (block.kind === 'subagent') {
      out.push({ kind: 'subagent', agent: block.agent, children: block.children });
      continue;
    }
    for (const items of PF(block.items)) out.push({ kind: 'bucket', items });
  }
  return out;
}
