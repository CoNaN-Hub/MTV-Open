/**
 * agentToolLabels —— 官方**工具行文案系统**（`page-BeI7xydN.js` 的 `gs`/`dL`/`_L`/`fc`/`SL`/`CL` + `Dae`）逐字复刻。
 *
 * 官方源码（压缩名 → 语义）：
 * ```js
 * gs  = item => (item.type !== 'tool_event' || typeof item.content !== 'object' || !item.content)
 *                 ? '' : String(item.content.tool ?? '').toLowerCase();
 * b1  = new Set(['write','edit','multiedit','multi_edit','apply_patch']);   // 编辑类
 * v1  = new Set(['view_media']);                                           // 看图/看片
 * y1  = new Set(['read']);                                                 // 读文档（探索）
 * kx  = tool => ar(tool) === 'canvas_context';                             // 画布上下文
 * ir  = tool => ['…','…'].includes(ar(tool));                              // 命令类
 * ar  = v => (typeof v !== 'string' ? null : v.trim().toLowerCase() || null);
 * dL  = items => Math.max(1, Eg(items).reduce((n, g) => n + g.payloads.length, 0));
 * _L  = ({isWebSearch,isEdit,isSkill,isViewMedia,isCanvasContext,isExploration,…}) =>
 *         isWebSearch ? {kind:'webSearch',…} : isEdit ? {kind:'edit',…} : isSkill ? {kind:'skill',…}
 *       : isViewMedia ? {kind:'viewMedia',…} : isCanvasContext ? {kind:'canvasContext',…}
 *       : isExploration ? {kind:'exploration',…} : {kind:'command',…};
 * qs  = k => `chatAdapter.agentEvent.toolCallLine.${k}`;                    // 文案键前缀
 * SL  = labelInput => {                        // → {key, fallback}
 *   webSearch: Dae({isSearching, query, count})
 *   edit:      {key: qs(isActive?'editing':'edited'),        fallback: `Edited ${count} files`}
 *   skill:     skillActionInfo ? {key:`…skillActionLabels.${key}.${active|done}`, fallback}
 *                              : {key: qs(isActive?'readingSkill':'readSkill'), fallback}
 *   viewMedia: {key: qs(isActive?'viewingMedia':delivered?'viewedMedia':null),
 *               fallback: 'Looking at N items' | 'Looked at N items' | 'Failed to look at media'}
 *   canvasContext: {key: qs(isActive?'readingCanvasContext':'readCanvasContext')}
 *   exploration:   {key: qs(isActive?'exploring':'explored'), fallback: `Read N documents`}
 *   command:   commandDescription ? {key:null, fallback:commandDescription}
 *             : isActive ? {key:qs('workingOnActions')} : {key:qs('completedActions')}
 * };
 * Dae = ({isSearching, query, count}) => …searchingWeb[WithQuery] / searchedWeb[WithQuery]…
 * CL  = kind => ({webSearch:globe, skill:box, viewMedia:search, canvasContext:search,
 *                 exploration:search, edit:pencil, command:square-terminal})[kind];
 * ```
 * ⚠️ 官方 `fc` 里还有「多个工具项合并成一条行」的聚合（`count` 等）—— 这里同样按官方语义实现：
 *    `count` = 所有 payload 数之和（至少 1），分类判据要求「**每一项**都属同类、允许混入无工具的项」。
 */
import { agentEventString } from './agentEventStrings';

/** 官方 `gs`。 */
export function toolNameOf(item: ToolEventLike | unknown): string {
  const entry = item as { type?: string; content?: { tool?: unknown } } | null;
  if (!entry || entry.type !== 'tool_event' || typeof entry.content !== 'object' || !entry.content) return '';
  const tool = entry.content.tool;
  return typeof tool === 'string' ? tool.trim().toLowerCase() : '';
}

/** 官方 `b1`：编辑类工具。 */
const EDIT_TOOLS = new Set(['write', 'edit', 'multiedit', 'multi_edit', 'apply_patch']);
/** 官方 `v1`：看图/看片。 */
const VIEW_MEDIA_TOOLS = new Set(['view_media']);
/** 官方 `y1`：读文档（探索）。 */
const READ_TOOLS = new Set(['read']);
/** 官方 `dg`：画布上下文。 */
const CANVAS_CONTEXT_TOOL = 'canvas_context';

export interface ToolEventLike {
  type?: string;
  content?: {
    tool?: unknown;
    status?: unknown;
    request?: unknown;
    response?: unknown;
    description?: unknown;
    prompt?: unknown;
    /* 官方 `subagent` 载荷（`agent_task_snapshot`/子代理事件）逐字字段。 */
    subagent_id?: unknown;
    agent_type?: unknown;
    parent_tool_call_id?: unknown;
    task_description?: unknown;
    tools?: unknown;
    text?: unknown;
    /* 官方 `show_widget`/`show_html`/mcpApp：`content.ui.resource_uri`。 */
    ui?: unknown;
    /**
     * 官方 `content.tool_call_id`（`iS` @21009 读它；`Gge` @21175 生产它）。
     * 消费方：本文件的 `callIdOf`（官方 `Fx`）→ `dedupeByCallId`（官方 `oie`）、
     * 以及官方 `e1e` 的 `pending-<callId>` 伪胶囊 / `p1e` 的 `$b` 同 id 合并。
     */
    tool_call_id?: unknown;
    /** 官方 `Gge` 生产的 `schema_version:"tool_event.v1"`。 */
    schema_version?: unknown;
  };
  [key: string]: unknown;
}

/** 官方 `dL`（`Eg` 的 payload 分组在 MTV 侧等价于「每个工具项算 1 个 payload」）。 */
export function toolItemCount(items: readonly ToolEventLike[]): number {
  return Math.max(1, items.length);
}

/**
 * 官方 `yrt(items)`（**新版** `vendor-pkg-canvas-CvbAwZyy.js` @2434969，逐字）：
 * 看图行的 `{count, delivered}`。
 * ```js
 * yrt = e => { let t=0,n=0,o=0,r=!1,i=!1;                 // t=images+videos, n=未结算 refs, o=已结算 refs
 *   for (const l of e) { … const c=l.content, d=String(c.status ?? ""), u=d==="completed"||d==="failed";
 *     u?i=!0:r=!0;
 *     const p=c.response; if(u&&typeof p=="object"&&p){ Array.isArray(p.images)&&(t+=p.images.length);
 *                                                      Array.isArray(p.videos)&&(t+=p.videos.length) }
 *     const m=c.request; if(typeof m=="object"&&m){ const f=m.refs; Array.isArray(f)&&(u?o+=f.length:n+=f.length) } }
 *   return r ? {count:Math.max(1,t+n),delivered:!1}
 *        : i ? (t>0 ? {count:t,delivered:!0} : {count:Math.max(1,o),delivered:!1})
 *            : {count:1,delivered:!1} }
 * ```
 * ⚠️ 第 62 轮修的**真 bug**：MTV 原来把「条数 > 1」当成功、`count === 1` 一律当失败
 * ⇒ **只查看 1 项时永远显示「查看媒体失败」**（用户实测：行的 `data-tool-activity-status="completed"`，
 * 载荷里 `response.images=[{ref:"node/…"}]` 明明是成功，标签却是「查看媒体失败」）。
 * 官方判据是 **`delivered`（结算后有 images/videos 才算取回像素）**，与条数无关。
 */
export function viewMediaCounts(items: readonly ToolEventLike[]): { count: number; delivered: boolean } {
  let media = 0;
  let pendingRefs = 0;
  let settledRefs = 0;
  let anyActive = false;
  let anySettled = false;
  for (const item of items) {
    const entry = item as { type?: string; content?: Record<string, unknown> } | null;
    if (!entry || entry.type !== 'tool_event' || typeof entry.content !== 'object' || !entry.content) continue;
    const content = entry.content;
    const status = String(content.status ?? '');
    const settled = status === 'completed' || status === 'failed';
    if (settled) anySettled = true; else anyActive = true;
    const response = content.response;
    if (settled && response && typeof response === 'object') {
      const record = response as { images?: unknown; videos?: unknown };
      if (Array.isArray(record.images)) media += record.images.length;
      if (Array.isArray(record.videos)) media += record.videos.length;
    }
    const request = content.request;
    if (request && typeof request === 'object') {
      const refs = (request as { refs?: unknown }).refs;
      if (Array.isArray(refs)) {
        if (settled) settledRefs += refs.length; else pendingRefs += refs.length;
      }
    }
  }
  if (anyActive) return { count: Math.max(1, media + pendingRefs), delivered: false };
  if (anySettled) return media > 0 ? { count: media, delivered: true } : { count: Math.max(1, settledRefs), delivered: false };
  return { count: 1, delivered: false };
}

/** 官方分类谓词（`dae/pae/uae/hae/cae` 的语义：**至少一个**命中且**其余都同类或无工具**）。 */
function classify(items: readonly ToolEventLike[], matches: (tool: string) => boolean): boolean {
  let hit = false;
  for (const item of items) {
    const tool = toolNameOf(item);
    if (!tool) continue;
    if (!matches(tool)) return false;
    hit = true;
  }
  return hit;
}

export type AgentToolLineKind = 'webSearch' | 'edit' | 'skill' | 'viewMedia' | 'canvasContext' | 'exploration' | 'command';

export interface AgentToolLineLabel {
  kind: AgentToolLineKind;
  /** 官方 `key`：`chatAdapter.agentEvent.toolCallLine.*`；`null` 表示直接用 fallback 文案。 */
  key: string | null;
  /** 官方 `fallback`（英文原文，多语言时用 key 取官方表）。 */
  fallback: string;
  count: number;
  skillName: string;
  /**
   * 官方 `Eot` 的分组汇总行会带自己的 `LeadingIcon`（`gue` = lucide `ListChecks`），
   * 覆盖 `Tot[labelInput.kind]` —— 即 `G = R?.LeadingIcon ?? mie(F.kind)`。
   */
  iconOverride?: 'listChecks';
}

/** 官方 `qs`。 */
const labelKey = (key: string) => `chatAdapter.agentEvent.toolCallLine.${key}`;

/** 官方 `Eot`：kind 全都一致且属于这四种时，不折叠成「已完成 N 个操作」。
 *  官方 `Sot`（同 kind 合并白名单，偏移 2400809）成员**完全相同**，但源码里是两个独立常量。 */
const EOT_SINGLE_KINDS = new Set<AgentToolLineKind>(['edit', 'exploration', 'viewMedia', 'command']);

/** 官方 `oie(items)`：按 `tool_call_id` 去重（后者覆盖前者，保持位置）。
 *  `PE` 用它得到 `u`，并用 `M = u.length > 0` 判「可展开」。 */
export function dedupeToolItems(items: readonly ToolEventLike[]): ToolEventLike[] {
  return dedupeByCallId(items);
}

/** 官方 `oie(items)`：按 `tool_call_id` 去重（后者覆盖前者，保持位置）。 */
function dedupeByCallId(items: readonly ToolEventLike[]): ToolEventLike[] {
  const seen = new Map<string, number>();
  const out: ToolEventLike[] = [];
  for (const item of items) {
    const id = callIdOf(item);
    if (!id) { out.push(item); continue; }
    const at = seen.get(id);
    if (at === undefined) { seen.set(id, out.length); out.push(item); continue; }
    out[at] = item;
  }
  return out;
}

/** 官方 `Fx(it)`：工具调用 id。 */
function callIdOf(item: ToolEventLike): string {
  const content = item.content;
  if (content && typeof content === 'object') {
    const record = content as { tool_call_id?: unknown; tool_use_id?: unknown };
    if (typeof record.tool_call_id === 'string') return record.tool_call_id;
    if (typeof record.tool_use_id === 'string') return record.tool_use_id;
  }
  const id = (item as { id?: unknown }).id;
  return typeof id === 'string' ? id : '';
}

/**
 * 官方 `PE` 的行文案入口（偏移 2408414 邻域）：
 * ```js
 * const R = d ? null
 *         : (!C && p.length > 1 ? Brt(k.length > 0 ? k : p, t)   // 非活跃 + 多条 ⇒ 先试多 kind 回落
 *                               : Vg(h, C, t));                    // 否则走单组
 * const L = R ? R.displayText : t(...)                          // 单组用 i18n，回落行直接用 displayText
 * ```
 * ⚠️ **官方用到的 `Vg` 只有 `isActive` 一个变量 `C`/`!1`**；`Brt` 内部**两条分类都写死 `!1`**：
 * ```js
 * const Brt = (e, t) => {
 *   const n = e.map(c => Vg([c], !1, t));            // ← 分类：!1
 *   const o = new Set(n.map(c => c.labelInput.kind));
 *   const [r] = o;
 *   if (o.size === 1 && (r === 'edit' || r === 'exploration' || r === 'viewMedia' || r === 'command'))
 *     return Vg(e, !1, t);                           // ← 单组：也是 !1
 *   const l = e.length;
 *   return { labelInput: {kind:'command', isActive:!1, count:l, commandDescription:''},
 *            displayText: t(ba('completedActions'), {count:l, defaultValue:`Completed ${l} …`}),
 *            LeadingIcon: gue };                   // lucide ListChecks
 * };
 * ```
 * 🚨 **第 72 轮修的真 bug（用户实测：画布类步骤组多出一行「已完成 2 个操作」）**：
 * 早前这里把「参与聚合判定的 kind 集合」用 `singleKindLabel(item, isActive)` 算，
 * 而**收窄后的单组文案**用 `isActive:false` 算 —— 官方 `Vg` 的 `Dae({isActive, …})` 里
 * `isActive` **会改变 kind**（`viewMedia` 分支：活跃 ⇒ `count = media + pendingRefs`、
 * 不活跃 ⇒ `delivered ? media : settledRefs`）。于是：
 * ```
 * [view_media, canvas_context]（都已完成、非活跃、末项 canvas_context）
 *   kinds(isActive=true)  = {viewMedia, canvasContext}  ⇒ size===2 ⇒ 命中回落 ⇒「已完成 2 个操作」  ✗
 *   kinds(isActive=false) = {viewMedia, canvasContext}  ⇒ size===2 ⇒ 命中回落 ⇒「已完成 2 个操作」（官方也这样）
 * [canvas_context, canvas_context]
 *   早前 kinds(isActive=true) = {canvasContext} ⇒ size===1 但 canvasContext ∉ 白名单 ⇒「已完成 2 个操作」✗
 * ```
 * 但官方判据写死 `!1` ⇒ `[canvas_context, canvas_context]` 得 `kinds={canvasContext}`、`size===1`，
 * 只是**不在白名单**里 —— 那也应该走 `Vg(e, !1, t)`（单组文案「已读取画布上下文」），
 * 而不是 `completedActions` 聚合行。⇒ 修法：**两条分类都用 `false`**（逐字对齐官方 `!1`）。
 */
export function agentToolLineLabel(
  items: readonly ToolEventLike[],
  isActive: boolean,
): AgentToolLineLabel {
  /* 官方先 `oie` 去重，再判条数与 kind。 */
  const deduped = dedupeByCallId(items);
  /* 官方 `Brt` 的分类**写死 `!1`**（不是调用点的 `C`）⇒ 这里也必须 `false`：
     收窄判据、白名单判据、回落计数三处共用同一套 kind，否则「同类」会被判成「不同类」。 */
  const kindOf = (item: ToolEventLike) => singleKindLabel([item], false).kind;
  /* 官方 `p = Znt(items)`（最后一条「新」tool_event）、`m = Sg([p], true).labelInput.kind`，
     `Sot` 白名单命中时把参与**文案**的集合收窄成同 kind（偏移 2400809 / 2408414 邻域）。
     ⚠️ `Sot` 那一侧官方用的是 `Vg([ae], !0, c)`（活跃分类）—— 它只用于**挑出参与文案的集合**，
     与 `Brt` 的分类是两套（官方源码里也确实是 `!0` 与 `!1` 并存）。 */
  const last = deduped.length > 0 ? deduped[deduped.length - 1] : null;
  const lastKind = last ? singleKindLabel([last], true).kind : null;
  const sameKindGroup = last
    ? (lastKind !== null && EOT_SINGLE_KINDS.has(lastKind)
      ? deduped.filter((item) => singleKindLabel([item], true).kind === lastKind)
      : [last])
    : [...items];
  if (!isActive && deduped.length > 1) {
    const kinds = new Set(deduped.map(kindOf));
    const only = [...kinds][0];
    if (!(kinds.size === 1 && only !== undefined && EOT_SINGLE_KINDS.has(only))) {
      const n = deduped.length;
      return {
        kind: 'command',
        key: labelKey('completedActions'),
        fallback: `Completed ${n} ${n === 1 ? 'action' : 'actions'}`,
        count: n,
        skillName: '',
        iconOverride: 'listChecks',
      };
    }
  }
  /* 官方 `R = … : Sg(f, C, t)` —— 单组文案用的是收窄后的 `f`（不是全量 `u`）。 */
  return singleKindLabel(sameKindGroup, isActive);
}

/** 官方 `Sg(items, isActive, t)`：单组文案。 */
function singleKindLabel(
  items: readonly ToolEventLike[],
  isActive: boolean,
): AgentToolLineLabel {
  const count = toolItemCount(items);
  const isEdit = classify(items, (tool) => EDIT_TOOLS.has(tool));
  const isSkill = classify(items, (tool) => tool === 'skill');
  const isViewMedia = classify(items, (tool) => VIEW_MEDIA_TOOLS.has(tool));
  const isCanvasContext = classify(items, (tool) => tool === CANVAS_CONTEXT_TOOL);
  const isExploration = classify(items, (tool) => READ_TOOLS.has(tool));

  if (isEdit) {
    const verb = isActive ? 'Editing' : 'Edited';
    return {
      kind: 'edit',
      key: labelKey(isActive ? 'editing' : 'edited'),
      fallback: `${verb} ${count} ${count === 1 ? 'file' : 'files'}`,
      count,
      skillName: '',
    };
  }
  if (isSkill) {
    const skillName = skillNameOf(items);
    const actionKey = skillActionKeyOf(items);
    if (actionKey) {
      return {
        kind: 'skill',
        key: `chatAdapter.agentEvent.skillActionLabels.${actionKey}.${isActive ? 'active' : 'done'}`,
        fallback: `${isActive ? 'Working' : 'Finished'}: ${skillName}`,
        count,
        skillName,
      };
    }
    return {
      kind: 'skill',
      key: labelKey(isActive ? 'readingSkill' : 'readSkill'),
      fallback: isActive ? `Reading ${skillName}` : `Read ${skillName}`,
      count,
      skillName,
    };
  }
  if (isViewMedia) {
    /* 官方 `Dae` 的 viewMedia 分支：`{kind:'viewMedia', isActive, count:viewMediaCount, delivered}`，
       文案 `{key: qs(isActive ? 'viewingMedia' : delivered ? 'viewedMedia' : null), …}`
       —— **delivered 才有「已查看」，否则才是失败**（与条数无关，见 `viewMediaCounts` 的注释）。 */
    const { count: mediaCount, delivered } = viewMediaCounts(items);
    const unit = mediaCount === 1 ? 'item' : 'items';
    if (isActive) {
      return { kind: 'viewMedia', key: labelKey('viewingMedia'), fallback: `Looking at ${mediaCount} ${unit}`, count: mediaCount, skillName: '' };
    }
    return delivered
      ? { kind: 'viewMedia', key: labelKey('viewedMedia'), fallback: `Looked at ${mediaCount} ${unit}`, count: mediaCount, skillName: '' }
      /* 官方：失败态文案在 `agentEvent.toolLabels.view_media_failed`（**不是** `toolCallLine.*`）。 */
      : { kind: 'viewMedia', key: 'chatAdapter.agentEvent.toolLabels.view_media_failed', fallback: 'Failed to look at media', count: mediaCount, skillName: '' };
  }
  if (isCanvasContext) {
    return {
      kind: 'canvasContext',
      key: labelKey(isActive ? 'readingCanvasContext' : 'readCanvasContext'),
      fallback: isActive ? 'Reading canvas context' : 'Read canvas context',
      count,
      skillName: '',
    };
  }
  if (isExploration) {
    const verb = isActive ? 'Reading' : 'Read';
    return {
      kind: 'exploration',
      key: labelKey(isActive ? 'exploring' : 'explored'),
      fallback: `${verb} ${count} ${count === 1 ? 'document' : 'documents'}`,
      count,
      skillName: '',
    };
  }
  const description = commandDescriptionOf(items, isActive);
  if (description) {
    return { kind: 'command', key: null, fallback: description, count, skillName: '' };
  }
  return isActive
    ? {
      kind: 'command',
      key: labelKey('workingOnActions'),
      fallback: count === 1 ? 'Working on an action' : `Working on ${count} actions`,
      count,
      skillName: '',
    }
    : {
      kind: 'command',
      key: labelKey('completedActions'),
      fallback: `Completed ${count} ${count === 1 ? 'action' : 'actions'}`,
      count,
      skillName: '',
    };
}

/** 官方 `vL`/`Eae`：从技能工具项里取技能名。 */
export function skillNameOf(items: readonly ToolEventLike[]): string {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (toolNameOf(item) !== 'skill' || typeof item.content !== 'object' || !item.content) continue;
    const request = item.content.request;
    if (!request || typeof request !== 'object') continue;
    const record = request as Record<string, unknown>;
    const description = typeof record.description === 'string' ? record.description.trim() : '';
    if (description) return description;
    for (const field of ['path', 'file', 'filepath']) {
      const value = record[field];
      if (typeof value === 'string' && value) return value.split('/').pop() ?? value;
    }
  }
  return '';
}

/** 官方 `vL` 里 `skillActionInfo` 的 key（`brainstorm` / `buildingWidget`）。 */
function skillActionKeyOf(items: readonly ToolEventLike[]): string | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (toolNameOf(item) !== 'skill' || typeof item.content !== 'object' || !item.content) continue;
    const request = item.content.request as Record<string, unknown> | undefined;
    if (!request) continue;
    const action = request.action ?? request.skill_action ?? request.skillAction;
    if (typeof action === 'string' && action) {
      const normalized = action.replace(/[_\s-]+/g, '').toLowerCase();
      if (normalized === 'brainstorm') return 'brainstorm';
      if (normalized === 'buildingwidget') return 'buildingWidget';
      return null;
    }
  }
  return null;
}

/** 官方 `Mae`/`_1`/`Nae`：命令类工具的描述文案。 */
function commandDescriptionOf(items: readonly ToolEventLike[], isActive: boolean): string {
  const read = (onlyActive: boolean): string => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const item = items[i];
      const tool = toolNameOf(item);
      if (!tool) continue;
      if (EDIT_TOOLS.has(tool) || VIEW_MEDIA_TOOLS.has(tool) || READ_TOOLS.has(tool) || tool === 'skill' || tool === CANVAS_CONTEXT_TOOL) continue;
      if (onlyActive && item.content?.status !== 'pending' && item.content?.status !== 'started') continue;
      const request = item.content?.request as Record<string, unknown> | undefined;
      const description = request && typeof request.description === 'string' ? request.description.trim() : '';
      if (description) return description;
    }
    return '';
  };
  if (isActive) {
    const active = read(true);
    if (active) return active;
  }
  return read(false);
}

/** 官方 `SL` 的最终显示文案（走官方 `chatAdapter.agentEvent.toolCallLine.*` 四语言表）。 */
export function agentToolLineText(label: AgentToolLineLabel, locale: string): string {
  if (label.key === null) return label.fallback;
  const path = label.key.replace(/^chatAdapter\.agentEvent\./, '');
  /* 官方用 i18next 复数：键是 `<key>_one` / `<key>_other`（例如 `completedActions_other`）⇒ 先按 count 取复数键，
     再退回裸键，最后才是官方源码里的英文 fallback（官方缺键时也是这样）。 */
  const pluralPath = `${path}_${label.count === 1 ? 'one' : 'other'}`;
  const pluralText = agentEventString(pluralPath, locale);
  const text = pluralText === pluralPath ? agentEventString(path, locale) : pluralText;
  if (text === path) return label.fallback;
  return text
    .replace(/\{\{count\}\}/g, String(label.count))
    .replace(/\{\{skillName\}\}/g, label.skillName);
}

/* ── webSearch 由调用方直接构造（官方 `Dae`）── */
export function webSearchLabel(
  { isSearching, query, count }: { isSearching: boolean; query: string; count: number },
): { key: string; fallback: string } {
  if (isSearching) {
    return query
      ? { key: labelKey('searchingWebWithQuery'), fallback: `Searching the web: ${query}` }
      : { key: labelKey('searchingWeb'), fallback: 'Searching the web' };
  }
  const base = count === 1 ? 'Searched the web' : `Ran ${count} web searches`;
  return query
    ? { key: labelKey('searchedWebWithQuery'), fallback: `${base}: ${query}` }
    : { key: labelKey('searchedWeb'), fallback: base };
}

/**
 * MTV 自有工具名 → 人话。官方文案表里没有它们（`media_generate` 在官方 bundle **0 命中**）：
 * 官方对应叫 `gen_image` / `gen_video`，MTV 把「图片/视频/音乐/语音」合成一个工具，
 * 所以这里统一用工具注册时的 title（`生成媒体内容`）的进行/完成两态，
 * 免得把 snake_case 工具名直接甩进对话（用户实测：「media_generate 是干嘛的 官方是这样的吗？」）。
 */
const MTV_TOOL_TEXT: Record<string, { active: string; done: string }> = {
  media_generate: { active: '正在生成媒体内容', done: '已生成媒体内容' },
  media_model_parameters: { active: '正在读取模型参数', done: '已读取模型参数' },
  media_workflow_parameters: { active: '正在读取工作流参数', done: '已读取工作流参数' },
};

/** 把「恰好等于某个 MTV 自有工具名」的文案换成人话；其它一律原样返回。 */
export function humanizeToolLineText(text: string, isActive: boolean): string {
  const entry = MTV_TOOL_TEXT[text.trim()];
  if (!entry) return text;
  return isActive ? entry.active : entry.done;
}
