/**
 * agentMessageContents —— MTV 消息模型 → 官方「**有序** `contents: Item[]`」的**装配层**（纯函数、无 React）。
 *
 * 背景：官方 TapNow 的 assistant 消息体是一个**有序数组** `contents: Item[]`，文本 / 工具事件 / 确认卡 /
 * 子代理卡 / 任务快照按写入顺序排在一起，渲染时按序分派。MTV 没有这个数组（`ChatMessage.content` 是纯字符串，
 * 工具活动挂在 `AgentTask.steps` 上，子代理挂在 `parentTaskId` 子任务上）⇒ 本模块就是那层「装配」。
 *
 * ⚠️ 本模块**只产数据、不碰渲染**：不改 `agentContents.ts`（它的既有契约原样复用）、不改任何 `.tsx`。
 *
 * ── 权威来源（`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`，偏移都是该 chunk 内的字节偏移）──
 *
 * 官方读侧管线（`@2605444` 邻域，逐字）：
 * ```js
 * const ue = YNe(p1e(e.contents || []));
 * const { inlineContents: le, taskSnapshot: Se } = JNe(ue);
 * ```
 * ⇒ **`contents` = `YNe(p1e(raw))`**，然后才 `JNe` 拆分。本模块照抄这个组合顺序。
 *
 * 官方**顶层有序渲染器** `Z0`（@2614935 邻域，逐字）：
 * ```js
 * return Ne.type === "subagent" ? <sae item={Ne} .../> : <$M item={Ne} .../>
 * ```
 * 而 `$M`（`RenderContent`，@2425467）的**类型分派顺序**（逐字，本模块 `classifyToolEventFamily` 照抄此序）：
 * ```js
 * if (type === "agent_error")    → <Fot message={typeof content === "string" ? content : ""} .../>
 * if (type === "context_nodes")  → <LF nodeIds={content?.node_ids} attachments={…}/>
 * if (type === "form_submission")→ content 非对象 ⇒ null，否则 <lse content={content}/>
 * if (type === "text")           → content 非字符串取 ""；`!content.trim()` ⇒ null（正文）
 * if (type === "thinking")       → isStreaming && !collapsed 时 <MF label="Thinking..." .../>
 * if (type === "compact")        → <Tie phase={content?.phase ?? "started"} isStreaming/>
 * if (type === "task_snapshot")  → return null
 * if (type === "tool_event") {
 *   $b → <Moe content .../>            // AskUserQuestion 卡
 *   wS → return null                   // 不渲染
 *   dg → <qet content .../>            // 生成确认卡
 *   iT → <Btt content .../>            // 节点更新确认卡
 *   kD → <$Qe content .../>            // 桌面/批量下载确认卡
 *   MD → return null                   // 不渲染
 *   AD → content.status==="completed" ? <nre content .../> : null      // MCP app
 *   aT → (pending||started)&&isStreaming ? <fre .../> : status==="completed" ? <mre .../> : null
 *   lT → status!=="completed" ? null : <ure content .../>              // show_html
 *   ID → status==="completed" ? <Loe content .../> : undefined         // 连接器状态
 *   jD → (pending||started)&&isStreaming ? <HM toolName="show_form"/> : status!=="completed" ? null : <ase .../>
 *   ib && !hasConfirmationEvent → (completed||failed) ? <eet content .../> : null
 *   // 普通工具行
 *   const C = content || {}, S = String(C.status || ""), N = String(C.tool || "");
 *   return (S === "started" || S === "in_progress") && isStreaming
 *     ? <HM toolName={N}/> : <RY content={content} isStreaming/>
 * }
 * return null;
 * ```
 * `Xv`（todowrite / memory / inspect_canvas）**在 `$M` 里没有分支**——它是在更外层被过滤掉的
 * （@2435090：`e.filter(x => !Xv(x) && !RD(x, t))`；@450788 的 `wV` 同款），所以本模块仍把它保留在
 * `contents` 里、只打上 `utility_excluded` 家族标记。
 *
 * 官方写入口（决定**顺序**，逐字）：
 * ```js
 * // tool_event 追加（@31287 邻域）
 * contents: [...f, {type:"tool_event", content:t, startedAt:c??b, ...(i?{endedAt:d??b}:{})}, {type:"text", content:""}]
 * // subagent 追加（@31931）
 * const n = Fv(contents||[]), u = n[n.length-1],
 *       m = (u?.type === "text" && (typeof u.content !== "string" || u.content.length === 0)) ? n.slice(0,-1) : n,
 *       f = Date.now();
 * contents: [...m, {type:"subagent", content:c, startedAt:f, ...(eC(c.status)?{endedAt:f}:{})}, {type:"text", content:""}]
 * // task_snapshot 落位（`xxe` @32016）
 * xxe = (e,t) => { const n = Fv(e.contents||[]), o = n.findIndex(l => l.type === "task_snapshot"),
 *                  r = {type:"task_snapshot", content:t};
 *                  if (o < 0) return {...e, contents:[...n, r]};
 *                  const i = [...n]; i[o] = r; return {...e, contents:i}; }
 * // agent_error 追加（@2697441 `appendMessageContent(lt(), {type:"agent_error", content:ft}, ce)`）
 * ```
 * ⇒ 结论：**工具/子代理项排在它们各自之后的正文之前**，`task_snapshot` 末尾（或原地替换首个同类型项），
 *    `agent_error` 追加在末尾。MTV 只有一个 `message.content` 字符串，无法还原「中途文本」的插空位置
 *    ⇒ 本模块统一「活动项在前、正文在后」，这一条是**近似**（见模块底部 §诚实标注）。
 *
 * ── 复用而非重实现 ──
 * · 官方 `Ug`（普通工具事件）**直接调用** `agentContents.ts` 导出的 `isPlainToolEvent`；
 *   `classifyToolEventFamily` 只在排除前 12 族之后用 `isPlainToolEvent` 划「普通 vs `Xv`」的界，
 *   所以 `VNe`/`UY` 两个集合在这边**不需要重写**（官方恒等式：`Ug(x) === !($b|dg|wS|iT|kD|AD|aT|lT|ID|jD|MD|ib|Xv)(x)`）。
 * · `JNe` / `DD` 直接复用 `splitAgentContents`。
 * · MTV `AgentStep` / `AgentTask` → 官方载荷直接用 `agentActivityItems.ts` 的
 *   `stepToToolEvent` / `taskStepsToToolEvents` / `childTaskToSubagentEvent`（只是补齐它们漏掉的官方字段，见下）。
 *
 * ⚠️ `agentContents.ts` 把 12 个族谓词定义成**模块私有**（只有 `Ug` 用），所以本模块不得不把
 *    「工具名 → 族」的 11 个字符串集合再落一份（`MNe`…`XNe`，偏移见各行）。这是**缺东西 → 在新模块里补**，
 *    不是「等价实现」：集合成员、大小写敏感性、判定顺序都逐字照抄官方。
 *    `tests/agentMessageContents.test.ts` 里有一条交叉断言：**每个族成员都必须让 `isPlainToolEvent` 返回 false**，
 *    一旦两边漂移就会红。若将来 `agentContents.ts` 导出这 12 个谓词，本模块的集合应整体删除。
 */
import type {
  AgentContentInput,
  AgentContentItem,
  AgentTaskSnapshotContent,
  AgentTaskSnapshotTask,
  SubagentContent,
  SubagentItem,
  TaskSnapshotItem,
  TextItem,
  ToolEventContent,
  ToolEventItem,
} from './agentContents';
import { isPlainToolEvent, splitAgentContents } from './agentContents';
import { childTaskToSubagentEvent, stepToToolEvent } from './agentActivityItems';
import type { AgentStep, AgentTask } from '../../types/agent';
import type { TodoSnapshot } from '../../types/chat';

/* ============================================================================
 * 1. 官方 Item 类型全集（字段逐字；`content` 形状见 `agentContents.ts` 的类型注释）
 * ============================================================================ */

/** 官方 `agent_error` item（`$M` @2425987 逐字：`typeof e.content === "string" ? e.content : ""`）。
 *  ⚠️ 本 chunk 内**没有**独立的写入口类型声明，只有分发器与写入口
 *  `appendMessageContent(id, {type:"agent_error", content: <string>}, sessionId)`（@2697441）。 */
export interface AgentErrorItem {
  type: 'agent_error';
  content: string;
}

/** 官方 `compact` item（`$M` 读 `content?.phase`，写入口 @32322：`{type:"compact", content:{phase:t}}`，
 *  `phase` 取 `started` / `finished`（`yxe` 里 `t === "started"` 只做「已有 started 就返回原对象」的短路）。 */
export interface CompactItem {
  type: 'compact';
  content: { phase: string };
}

/** 官方 `context_nodes` item（`$M` 读 `content?.node_ids`；生产者是用户消息的 `bZ`）。 */
export interface ContextNodesItem {
  type: 'context_nodes';
  content: { node_ids: string[] };
}

/** 官方 `form_submission` item（`$M`：`content` 必须是对象，否则不渲染；`content` 形状未在本 chunk 挖到）。 */
export interface FormSubmissionItem {
  type: 'form_submission';
  content: Record<string, unknown>;
}

/** 官方 `contents: Item[]` 的**全集**（本模块可产出的所有 item）。 */
export type OfficialAgentContentItem =
  | AgentContentItem
  | AgentErrorItem
  | CompactItem
  | ContextNodesItem
  | FormSubmissionItem;

/**
 * `ChatMessage.contents` 的元素类型（覆盖表 §6 #1）。
 *
 * **就是** `OfficialAgentContentItem`（同一条官方联合的别名，不是第二套形状）——
 * 消息级 `contents` 里放的必须是官方 item，渲染层才能按官方 `Z0`/`$M` 的分派顺序消费。
 */
export type AgentMessageContentItem = OfficialAgentContentItem;

/** 官方 `tool_event` 的族（= `$M` 的分派分支；`plain` 走 `RY`，`utility_excluded` 被外层过滤）。 */
export type AgentToolFamily =
  /** 官方 `$b`（`MNe` @442098）⇒ `$M` → `<Moe>`（AskUserQuestion 卡）。 */
  | 'ask_question'
  /** 官方 `wS`（`RNe` @442187）⇒ `$M` → `return null`（不渲染）。 */
  | 'cost_limit_confirmation'
  /** 官方 `dg`（`PNe` @442146）⇒ `$M` → `<qet>`（生成确认卡）。 */
  | 'generation_confirmation'
  /** 官方 `iT`（`DNe` @442228）⇒ `$M` → `<Btt>`（节点更新确认卡）。 */
  | 'node_update_confirmation'
  /** 官方 `kD`（`LNe` @442270）⇒ `$M` → `<$Qe>`（桌面权限 / 批量下载确认卡）。 */
  | 'desktop_confirmation'
  /** 官方 `MD`（`BNe` @442575）⇒ `$M` → `return null`（不渲染）。 */
  | 'prepare_widget'
  /** 官方 `AD`（@444487，看 `content.ui.resource_uri`）⇒ `$M` → `<nre>`（MCP app 卡）。 */
  | 'mcp_app'
  /** 官方 `aT`（`FNe` @442454）⇒ `$M` → `<fre>`（loading）/ `<mre>`（completed）。 */
  | 'show_widget'
  /** 官方 `lT`（`ONe` @442483）⇒ `$M` → `<ure>`（html 卡，仅 completed）。 */
  | 'show_html'
  /** 官方 `ID`（`zNe` @442510）⇒ `$M` → `<Loe>`（连接器状态卡，仅 completed）。 */
  | 'connector_status'
  /** 官方 `jD`（`UNe` @442548）⇒ `$M` → `<HM toolName="show_form">` / `<ase>`。 */
  | 'show_form'
  /** 官方 `ib`（`XNe` @445048）⇒ `$M` → `<eet>`（生成结果卡，completed/failed）。 */
  | 'generation'
  /** 官方 `Xv`（@445152）⇒ 不在 `$M` 里，被外层 `filter(x => !Xv(x) && !RD(x,t))` 剔除。 */
  | 'utility_excluded'
  /** 官方 `Ug`（@446236）⇒ `$M` 兜底：`<RY>`（工具行）或 `<HM>`（loading）。 */
  | 'plain';

/* ============================================================================
 * 2. 官方的 11 个工具名集合（逐字；偏移是 `vendor-pkg-canvas-ChpWx5JY.js` 内字节偏移）
 * ============================================================================ */

/** 官方 `MNe` @442098。 */
const ASK_QUESTION_TOOLS = new Set(['AskUserQuestion', 'ask_question']);
/** 官方 `PNe` @442146。 */
const GENERATION_CONFIRMATION_TOOLS = new Set(['generation_confirmation']);
/** 官方 `RNe` @442187。 */
const COST_LIMIT_CONFIRMATION_TOOLS = new Set(['cost_limit_confirmation']);
/** 官方 `DNe` @442228。 */
const NODE_UPDATE_CONFIRMATION_TOOLS = new Set(['node_update_confirmation']);
/** 官方 `LNe` @442270。 */
const DESKTOP_CONFIRMATION_TOOLS = new Set([
  'desktop_open_app_confirmation',
  'desktop_capture_screen_confirmation',
  'desktop_fs_confirmation',
  'desktop_shell_command_confirmation',
  'batch_download_files_confirmation',
]);
/** 官方 `FNe` @442454。 */
const SHOW_WIDGET_TOOLS = new Set(['show_widget']);
/** 官方 `ONe` @442483。 */
const SHOW_HTML_TOOLS = new Set(['show_html']);
/** 官方 `zNe` @442510。 */
const CONNECTOR_STATUS_TOOLS = new Set(['get_connector_status']);
/** 官方 `UNe` @442548。 */
const SHOW_FORM_TOOLS = new Set(['show_form']);
/** 官方 `BNe` @442575。 */
const PREPARE_WIDGET_TOOLS = new Set(['prepare_widget']);
/** 官方 `XNe` @445048 —— `ib` 的生成类（成员是 `generation_request`，**不是** `gen_audio`）。 */
const GENERATION_TOOLS = new Set(['gen_image', 'gen_video', 'generation_request']);

/** 官方 `GNe` @442671：`YNe` 里被当作「确认卡占位」的 CLI 工具名（比对前 `.toLowerCase()`）。 */
const CLI_CONFIRMATION_PLACEHOLDER_TOOL = 'tapnow_cli';

/* ============================================================================
 * 3. 官方 `xl` / `Hb` / `Yv` / `Uk`（@443724 / @443828 / @443934 / @452667 邻域）
 * ============================================================================ */

/** 官方 `xl`（@443724）：**不归一化**（大小写敏感）地取 `content.tool`。 */
function toolNameRaw(item: AgentContentInput | null | undefined): string {
  if (!item || item.type !== 'tool_event') return '';
  const content = item.content;
  if (typeof content !== 'object' || content === null) return '';
  return String((content as Record<string, unknown>).tool ?? '');
}

/** 官方 `Hb`（@443828）：同上取 `content.status`。 */
function toolStatusRaw(item: AgentContentInput | null | undefined): string {
  if (!item || item.type !== 'tool_event') return '';
  const content = item.content;
  if (typeof content !== 'object' || content === null) return '';
  return String((content as Record<string, unknown>).status ?? '');
}

/** 官方 `Yv`（@443934）：`e.type==="text" && (typeof e.content!="string" || !e.content.trim())`（「空正文」）。 */
function isEmptyTextItem(item: AgentContentInput | null | undefined): boolean {
  if (!item || item.type !== 'text') return false;
  return typeof item.content !== 'string' || !item.content.trim();
}

/** 官方 `Uk`（@452667）：**只对 `$b`（ask_question）成立**，取 `tool_call_id` → `tool_use_id`。 */
function askQuestionCallId(item: AgentContentInput | null | undefined): string {
  if (!item || !ASK_QUESTION_TOOLS.has(toolNameRaw(item))) return '';
  const content = item.content;
  if (typeof content !== 'object' || content === null) return '';
  const record = content as Record<string, unknown>;
  if (typeof record.tool_call_id === 'string') return record.tool_call_id;
  if (typeof record.tool_use_id === 'string') return record.tool_use_id;
  return '';
}

/* ============================================================================
 * 4. 官方 `AD`：MCP app 资源（@444487，**不看工具名**）
 * ============================================================================ */

/** 官方 `AD`（@444487）：`content.ui.resource_uri` 是非空字符串。 */
function hasMcpAppResource(item: AgentContentInput | null | undefined): boolean {
  if (!item || item.type !== 'tool_event') return false;
  const content = item.content;
  if (typeof content !== 'object' || content === null) return false;
  const ui = (content as Record<string, unknown>).ui;
  if (!ui || typeof ui !== 'object') return false;
  const resourceUri = (ui as Record<string, unknown>).resource_uri;
  return typeof resourceUri === 'string' && resourceUri.length > 0;
}

/* ============================================================================
 * 5. 导出：官方 `$M` 的工具分派顺序 → 家族
 * ============================================================================ */

/**
 * 把一条 item 分到 `$M` 的某个分派分支。
 *
 * **判定顺序逐字照抄 `$M`**：`$b` → `wS` → `dg` → `iT` → `kD` → `MD` → `AD` → `aT` → `lT` → `ID` → `jD` → `ib`
 * → 兜底（`Ug` vs `Xv`）。非 `tool_event` 返回 `null`（`$M` 里它们走别的类型分支）。
 *
 * 兜底用**既有导出谓词** `isPlainToolEvent`（官方 `Ug` @446236）划界：
 * 官方恒等式 `Ug(x) === !($b|dg|wS|iT|kD|AD|aT|lT|ID|jD|MD|ib|Xv)(x)`，上面已排除前 12 族，
 * ⇒ `isPlainToolEvent(x) === !Xv(x)`。所以 `VNe` / `UY` **不需要**在本模块重写。
 */
export function classifyToolEventFamily(item: AgentContentInput): AgentToolFamily | null {
  if (!item || item.type !== 'tool_event') return null;
  const tool = toolNameRaw(item);
  if (ASK_QUESTION_TOOLS.has(tool)) return 'ask_question';
  if (COST_LIMIT_CONFIRMATION_TOOLS.has(tool)) return 'cost_limit_confirmation';
  if (GENERATION_CONFIRMATION_TOOLS.has(tool)) return 'generation_confirmation';
  if (NODE_UPDATE_CONFIRMATION_TOOLS.has(tool)) return 'node_update_confirmation';
  if (DESKTOP_CONFIRMATION_TOOLS.has(tool)) return 'desktop_confirmation';
  if (PREPARE_WIDGET_TOOLS.has(tool)) return 'prepare_widget';
  if (hasMcpAppResource(item)) return 'mcp_app';
  if (SHOW_WIDGET_TOOLS.has(tool)) return 'show_widget';
  if (SHOW_HTML_TOOLS.has(tool)) return 'show_html';
  if (CONNECTOR_STATUS_TOOLS.has(tool)) return 'connector_status';
  if (SHOW_FORM_TOOLS.has(tool)) return 'show_form';
  if (GENERATION_TOOLS.has(tool)) return 'generation';
  return isPlainToolEvent(item) ? 'plain' : 'utility_excluded';
}

/**
 * 家族 → 官方 `$M` 的渲染落点（供后续接线时「族 → 组件」查表；本模块自身不使用）。
 * `null` = 官方在该分支 `return null`（不渲染）；`'filtered'` = 在 `$M` 之前被外层 filter 掉。
 */
export const TOOL_FAMILY_DISPATCH: Record<AgentToolFamily, string | null | 'filtered'> = {
  ask_question: 'Moe',
  cost_limit_confirmation: null,
  generation_confirmation: 'qet',
  node_update_confirmation: 'Btt',
  desktop_confirmation: '$Qe',
  prepare_widget: null,
  mcp_app: 'nre',
  show_widget: 'fre|mre',
  show_html: 'ure',
  connector_status: 'Loe',
  show_form: 'HM|ase',
  generation: 'eet',
  utility_excluded: 'filtered',
  plain: 'HM|RY',
};

/* ============================================================================
 * 6. 官方 `p1e` / `YNe`：`contents` 的读侧归一化（@452667 / @444231）
 * ============================================================================ */

/** 官方 `p1e`（@452667）：把 `$b`（ask_question）里**同 `tool_call_id`** 的重复项合并成一条。
 *
 *  逐字要点（**容易写错的地方都在这里**）：
 *  · 只有 `Uk(item)` 非空（即 `$b` 命中的 ask_question）才参与分组 —— 别的工具「同 id 多条」不合并；
 *  · 合并后的 item 是**新建的** `{type:"tool_event", content:c}`，**丢掉** `startedAt`/`endedAt`；
 *  · 同组内 `content` 的键**后者覆盖前者**，唯一例外是 `response`：`typeof u.response==="object" && u.response`
 *    时做**浅合并**（`{...c.response, ...u.response}`）；
 *  · 保留位置 = 该 id **第一次**出现的位置；后续同 id 项被剔除。
 *  · `n.size === 0` 时**原数组原样返回**（同一引用；与官方一致，不做防御性拷贝）。 */
export function mergeDuplicateToolEvents(
  contents: readonly OfficialAgentContentItem[],
): readonly OfficialAgentContentItem[] {
  const groups = new Map<string, OfficialAgentContentItem[]>();
  for (const item of contents) {
    const callId = askQuestionCallId(item);
    if (!callId) continue;
    const group = groups.get(callId);
    if (group) group.push(item);
    else groups.set(callId, [item]);
  }
  const duplicated = new Set<string>();
  for (const [callId, group] of groups) if (group.length > 1) duplicated.add(callId);
  if (duplicated.size === 0) return contents;

  const merged = new Map<string, OfficialAgentContentItem>();
  for (const callId of duplicated) {
    const group = groups.get(callId) ?? [];
    const content: Record<string, unknown> = {};
    for (const item of group) {
      const source = item.content as unknown as Record<string, unknown>;
      for (const key of Object.keys(source)) {
        if (key === 'response' && typeof source.response === 'object' && source.response) {
          content.response = {
            ...(typeof content.response === 'object' && content.response ? content.response : {}),
            ...(source.response as Record<string, unknown>),
          };
        } else {
          content[key] = source[key];
        }
      }
    }
    merged.set(callId, { type: 'tool_event', content: content as unknown as ToolEventContent });
  }

  const emitted = new Set<string>();
  const out: OfficialAgentContentItem[] = [];
  for (const item of contents) {
    const callId = askQuestionCallId(item);
    if (!callId || !duplicated.has(callId)) {
      out.push(item);
      continue;
    }
    if (emitted.has(callId)) continue;
    emitted.add(callId);
    out.push(merged.get(callId) ?? item);
  }
  return out;
}

/** 官方 `KNe`（@444231 邻域）：从 `start` 起按 `step` 走，返回**第一个非空正文**的 item，否则 `null`。
 *  `YNe` 只以 `step = 1` 调用它。 */
function firstNonEmptyItem(
  contents: readonly OfficialAgentContentItem[],
  start: number,
  step: number,
): OfficialAgentContentItem | null {
  for (let index = start; index >= 0 && index < contents.length; index += step) {
    const item = contents[index];
    if (!isEmptyTextItem(item)) return item;
  }
  return null;
}

/** 官方 `qNe`（@444089）：`dg(e) || iT(e) || kD(e)` —— 生成 / 节点更新 / 桌面确认卡。 */
function isConfirmationCardItem(item: AgentContentInput | null | undefined): boolean {
  const tool = toolNameRaw(item);
  return GENERATION_CONFIRMATION_TOOLS.has(tool)
    || NODE_UPDATE_CONFIRMATION_TOOLS.has(tool)
    || DESKTOP_CONFIRMATION_TOOLS.has(tool);
}

/** 官方 `YNe`（@444231）：丢掉「紧跟在一条**新的** `tapnow_cli` 事件后面、且下一条非空项是确认卡」的
 *  那种 CLI 占位事件（`status` 为 `pending` / `started` 才算占位）。
 *
 *  逐字：
 *  ```js
 *  YNe = e => { const t = new Set;
 *    for (let n = 0; n < e.length; n += 1) { const o = e[n];
 *      if (xl(o).toLowerCase() !== GNe) continue;          // GNe === "tapnow_cli"
 *      const r = Hb(o), i = KNe(e, n + 1, 1);
 *      i && qNe(i) && (r !== "pending" && r !== "started" || t.add(n)); }
 *    return t.size === 0 ? e : e.filter((n, o) => !t.has(o)); }
 *  ```
 *  注意 `||` 的短路：`(r!=="pending" && r!=="started") || t.add(n)` ⇒ **只有** `status` 是
 *  `pending` / `started` 时才把下标加进待删集合。 */
export function dropCliConfirmationPlaceholders(
  contents: readonly OfficialAgentContentItem[],
): readonly OfficialAgentContentItem[] {
  const dropped = new Set<number>();
  for (let index = 0; index < contents.length; index += 1) {
    const item = contents[index];
    if (toolNameRaw(item).toLowerCase() !== CLI_CONFIRMATION_PLACEHOLDER_TOOL) continue;
    const status = toolStatusRaw(item);
    const next = firstNonEmptyItem(contents, index + 1, 1);
    if (!next || !isConfirmationCardItem(next)) continue;
    if (status === 'pending' || status === 'started') dropped.add(index);
  }
  if (dropped.size === 0) return contents;
  return contents.filter((_, index) => !dropped.has(index));
}

/** 官方读侧归一化组合：`YNe(p1e(contents))`（@2605444 邻域逐字）。 */
export function normalizeAgentContents(
  contents: readonly OfficialAgentContentItem[],
): readonly OfficialAgentContentItem[] {
  return dropCliConfirmationPlaceholders(mergeDuplicateToolEvents(contents));
}

/* ============================================================================
 * 7. MTV 消息模型 → 官方 item
 * ============================================================================ */

/** MTV `ChatMessage` 里本模块**真正读取**的字段（结构化最小面，方便测试与后续接线）。 */
export interface MtvAgentMessageLike {
  role?: string;
  content?: string;
  status?: string;
  timestamp?: number;
  /** 官方 `bZ` 的 `context_nodes` part 的 MTV 等价物（**有生产者**：`conversationExecutionController`）。 */
  contextNodeIds?: string[];
  /** 官方 `task_snapshot` item 的 MTV 等价物（⚠️ **无生产者**，见 `types/chat.ts`）。 */
  todoSnapshot?: TodoSnapshot | null;
  /** 已经是官方 item 的直通口（MTV 目前**无生产者**；非空时**完全接管**装配）。 */
  contents?: readonly OfficialAgentContentItem[] | null;
}

/** `assembleRawAgentMessageContents` 的入参。 */
export interface AgentMessageAssemblyInput {
  message: MtvAgentMessageLike;
  /** `message.agentTaskId` 指向的主任务（`useAppStore.agentTasks`）。 */
  agentTask?: AgentTask | null;
  /** 该任务的子任务（`parentTaskId === agentTask.id`），顺序不限（内部按时间戳排）。 */
  childTasks?: readonly AgentTask[] | null;
}

/** 官方 `task_snapshot` 的 `tasks[]` 元素（字段逐字，见 `agentContents.ts` 的 `AgentTaskSnapshotTask`）。 */
function toTaskSnapshotTask(item: TodoSnapshot['items'][number]): AgentTaskSnapshotTask {
  const task: AgentTaskSnapshotTask = {};
  /* MTV `TodoItem.content` ⇄ 官方 `subject`（`todosFromSnapshot` 的反函数）。 */
  if (typeof item.content === 'string') task.subject = item.content;
  if (typeof item.status === 'string') task.status = item.status;
  if (typeof item.activeForm === 'string') task.active_form = item.activeForm;
  if (typeof item.taskId === 'string') task.task_id = item.taskId;
  if (typeof item.description === 'string') task.description = item.description;
  if (Array.isArray(item.blocks)) task.blocks = item.blocks.filter((value): value is string => typeof value === 'string');
  if (Array.isArray(item.blockedBy)) {
    task.blocked_by = item.blockedBy.filter((value): value is string => typeof value === 'string');
  }
  return task;
}

/**
 * MTV `TodoSnapshot` → 官方 `task_snapshot` item（官方 `xxe` 的 `r = {type:"task_snapshot", content:t}`）。
 * ⚠️ `plan_ready` **不臆造**：MTV 的 `TodoSnapshot` 没有这个字段，官方消费方
 * （`fG` @2660990 / `Kue`）要求 `plan_ready === true` 才显示任务历史卡 ⇒ 这里留空。
 */
export function toTaskSnapshotItem(snapshot: TodoSnapshot | null | undefined): TaskSnapshotItem | null {
  if (!snapshot || !Array.isArray(snapshot.items) || snapshot.items.length === 0) return null;
  const content: AgentTaskSnapshotContent = {
    schema_version: 'agent_task_snapshot.v1',
    tasks: snapshot.items.map(toTaskSnapshotTask),
  };
  return { type: 'task_snapshot', content };
}

/** 官方 `xxe`（@32016）：**首个** `task_snapshot` 原地替换，否则追加到末尾。
 *  ```js
 *  xxe = (e,t) => { const n = Fv(e.contents||[]), o = n.findIndex(l => l.type === "task_snapshot"),
 *                   r = {type:"task_snapshot", content:t};
 *                   if (o < 0) return {...e, contents:[...n, r]};
 *                   const i = [...n]; i[o] = r; return {...e, contents:i}; }
 *  ```
 *  ⚠️ 当前 MTV 装配路径里**替换分支不可达**（MTV 没有别的 `task_snapshot` 生产者），
 *  但后续「写入口」接线会用到，故导出。 */
export function upsertTaskSnapshotItem(
  contents: readonly OfficialAgentContentItem[],
  item: TaskSnapshotItem,
): OfficialAgentContentItem[] {
  const index = contents.findIndex((entry) => entry.type === 'task_snapshot');
  if (index < 0) return [...contents, item];
  const next = contents.slice();
  next[index] = item;
  return next;
}

/** MTV 里「会变成官方 `tool_event`」的 `AgentStep.kind` —— 与 `taskStepsToToolEvents` 的过滤条件一致
 *  （`step.kind === 'tool' || step.kind === 'approval' || step.kind === 'planning'`）。 */
const RENDERABLE_STEP_KINDS = new Set<AgentStep['kind']>(['tool', 'approval', 'planning']);

/**
 * 一条 MTV `AgentStep` → 官方 `tool_event` item。
 *
 * 复用 `agentActivityItems.stepToToolEvent`（它已经做了 MTV 工具 id → 官方工具名、状态归一化、
 * `request.description` / `request.prompt` / `response.summary` 的映射），只补三件官方 item 必需而它漏掉的东西：
 *  · `content.schema_version === "tool_event.v1"`（官方归一化器 `Gge` @21102 的产物形状）；
 *  · `content.type === "tool_event"`；
 *  · `content.tool_call_id`（= MTV `AgentToolCallSnapshot.callId`）—— **`stepToToolEvent` 没带这个字段**，
 *    缺了它官方 `e1e` 的 `pending-<callId>` 伪胶囊、`Fx`（工具行 key）、`p1e` 的分组全都失能。
 */
export function stepToOfficialToolEventItem(step: AgentStep): ToolEventItem {
  const base = stepToToolEvent(step);
  const baseContent = (base.content ?? {}) as Record<string, unknown>;
  const callId = typeof step.toolCall?.callId === 'string' ? step.toolCall.callId : '';
  const content: ToolEventContent = {
    ...(baseContent as unknown as ToolEventContent),
    schema_version: 'tool_event.v1',
    type: 'tool_event',
    tool: String(baseContent.tool ?? ''),
    status: String(baseContent.status ?? ''),
    ...(callId ? { tool_call_id: callId } : {}),
  };
  return {
    type: 'tool_event',
    content,
    ...(typeof base.startedAt === 'number' ? { startedAt: base.startedAt } : {}),
    ...(typeof base.endedAt === 'number' ? { endedAt: base.endedAt } : {}),
  };
}

/* ============================================================================
 * 7b. 已批准的媒体生成步骤 → **两个**官方 item（官方同一件事就是两项）
 * ============================================================================ */

/** 官方 `dg`（`PNe` @442146）确认卡的 `content.tool`：`generation_confirmation`。
 *  MTV 侧只由 `agentApprovalContents` 的 `case 'media_generation'` 产出。 */
const GENERATION_CONFIRMATION_CARD_TOOL = 'generation_confirmation';

/** item 的 `content.tool`（官方 `xl` @443724：**不归一化**）。 */
function itemToolName(item: ToolEventItem): string {
  const content = item.content as unknown as Record<string, unknown> | undefined;
  return String((content ?? {}).tool ?? '');
}

/**
 * **一次媒体生成 = 官方 `contents` 里的两项**：确认卡 + 被执行的工具事件。
 *
 * 官方证据（`live-assets/vendor-pkg-canvas-ChpWx5JY.js`，偏移是该 chunk 内 charIdx）：
 *  · `$M` @2426950 邻域：`if(dg(e)) return s.jsx(qet,{content:e.content,…})` —— 确认卡
 *    （`generation_confirmation`）是 `contents` 里的**一个** item；
 *  · 同一 `$M` 的 `ib` 分支（@2428328 邻域）：`if(ib(e)&&!f){ if(status==="completed"||"failed")
 *    return s.jsx(eet,{content}) }` —— **被提交的那次生成**是**另一个** item
 *    （官方 `XNe` @445048 的 `gen_image`/`gen_video`/`generation_request`）；
 *  · 写入口（@31287 邻域）：`contents:[...f,{type:"tool_event",content:t,startedAt:c??b,…},
 *    {type:"text",content:""}]` —— **每次工具调用各追加一条**，确认与被确认的调用是两次调用。
 *  ⇒ 官方用户看到的那条「生成两只非洲象」消息，`contents` 里同时有
 *    `generation_confirmation` 卡 **和** 提交生成那条工具事件（实测：`live-工具行DOM实测.md`
 *    的分组汇总行正是把多条工具事件聚成「已完成 N 个操作」）。
 *
 * MTV 的现实：**一次 `media_generate` 调用同时包含「请用户确认」与「真的执行」**
 * （`agentToolExecution` 为它建的 `AgentStep.kind === 'approval'` + `approval.kind === 'media_generation'`，
 * 审批通过后同一个 step 继续执行到 `succeeded`）。若只产确认卡那一个 item
 * （`stepToOfficialToolEventItem` 的现值），消息里就**没有任何 `Ug`（普通工具事件）**
 * ⇒ 官方 `lae` 的 `F` 分块（@2606530）不会产生 `kind:"collapsible"` 块
 * ⇒ 消息级吸收 `O`（`if(n)return[]` 之后 `xe<0||!ue(Pe)` 直接 `continue`）没有可吸收的块
 * ⇒ `FF`(`AgentStepsSection`) 不渲染、`AC`(`CollapsibleToolSection`) 也没有工具行。
 * 这条注释所指的就是「MTV 只显示一张图片生成卡 + 一句正文」的现象（真机复现：
 * 该消息的 `AgentTask.steps` 只有 1 条 `approval/media_generation`）。
 *
 * ⇒ 补齐官方那第二项：审批**通过并已开始执行**时，追加一条**普通** `tool_event`
 *   （`tool` 保持 MTV 自己的工具 id，因此走官方 `Ug` 兜底 ⇒ `PE` 工具行 + 组内文案；
 *   **不用** `gen_image`：那属于官方 `ib` 族，会被渲染成**第二张卡** `eet`，与本卡重复）。
 *
 * 时序取官方口径：卡 = 审批请求时刻（`requestedAt`/step 创建），执行项 = 审批**通过**时刻
 * （`resolvedAt`）到工具结束（`finishedAt`）—— 与官方「确认后工具才开始跑」一致。
 *
 * 不做的事：审批还挂着（`pending`）、被拒（`rejected`）、过期（`expired`）⇒ **不产**执行项
 * （官方那时也只有确认卡）；
 * 该步已有自己的官方载荷（`toolCall.officialRequest` 等 ⇒ `stepToToolEvent` 没走确认卡）
 * 时也不产 —— 那种情况本来就是一条普通工具行，再补一条就重复了。
 */
function mediaGenerationExecutionItem(
  step: AgentStep,
  cardItem: ToolEventItem,
): ToolEventItem | null {
  const approval = step.approval;
  if (!approval || approval.kind !== 'media_generation') return null;
  if (approval.status !== 'approved') return null;
  /* 只有「主 item 已经被官方确认卡接管」才需要补执行行（否则这一步本来就是普通工具行）。 */
  if (itemToolName(cardItem) !== GENERATION_CONFIRMATION_CARD_TOOL) return null;

  /* 复用 `stepToToolEvent` 的**无审批**视图：工具名（`media_generate`）、`status`、
     `request.description`（= `step.title`，官方 `commandDescriptionOf` 优先读它）、
     `response.summary` 全部照旧，只是不再被改道成确认卡。 */
  const plain = stepToToolEvent({ ...step, approval: undefined });
  const plainContent = (plain.content ?? {}) as Record<string, unknown>;
  const callId = typeof step.toolCall?.callId === 'string' ? step.toolCall.callId : '';
  const content: ToolEventContent = {
    ...(plainContent as unknown as ToolEventContent),
    schema_version: 'tool_event.v1',
    type: 'tool_event',
    tool: String(plainContent.tool ?? ''),
    status: String(plainContent.status ?? ''),
    /* 同一次调用的第二项：`tool_call_id` 必须与卡区分，否则官方 `oie`/`Fx` 去重会把它们当成同一条
       （`dedupeByCallId` 后者覆盖前者 ⇒ 卡或行会凭空消失）。 */
    ...(callId ? { tool_call_id: `${callId}:execution` } : {}),
  };
  const startedAt = approval.resolvedAt ?? step.toolCall?.startedAt ?? step.createdAt;
  return {
    type: 'tool_event',
    content,
    startedAt,
    /* `stepToToolEvent` 的 `endedAt` = `finishedAt ?? updatedAt`；执行项必须**收尾在结束之后**，
       缺 `finishedAt`（还在跑）时按官方写入口只带 `startedAt`（`i?{endedAt:d??b}:{}`）。 */
    ...(typeof step.toolCall?.finishedAt === 'number' ? { endedAt: step.toolCall.finishedAt } : {}),
  };
}

/**
 * 一条 MTV `AgentStep` → 官方 `contents` 里的 **1 或 2 个** `tool_event` item。
 *
 * 绝大多数步骤是 1 项（= `stepToOfficialToolEventItem`）；已批准的媒体生成是 2 项
 * （官方确认卡 + 被执行的工具事件，见 `mediaGenerationExecutionItem`）。
 * 渲染路径（`messageContents.buildMessageContents`）**必须用这个函数**，否则媒体生成那条消息
 * 永远没有可折叠的操作行。
 *
 * ⚠️ 数组顺序只是**同刻**的兜底顺序；真正决定落在组上还是组下的是 `itemAppendOrderAt`
 * （见 §7c）。这里保持「卡在前」是因为它在官方是**先到达**的那条事件。
 */
export function stepToOfficialToolEventItems(step: AgentStep): ToolEventItem[] {
  const card = stepToOfficialToolEventItem(step);
  const execution = mediaGenerationExecutionItem(step, card);
  return execution ? [card, execution] : [card];
}

/* ============================================================================
 * 7c. 生成卡在 `contents` 里的**位置** —— 为什么官方的「处理了 Xs」组在卡**上方**
 * ============================================================================ */

/**
 * # 官方成因（三处逐字证据，全部在 `D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`）
 *
 * ① **消息体先把有序 `contents` 折成 blocks**（MessageItem 的 `j` memo，@2653993–@2654300 邻域）：
 * ```js
 * const Te=()=>{Me&&Me.length>0&&(re.push({kind:"collapsible",items:Me,startIdx:ke}),Me=null)}
 *   , it=()=>{for(const Ne of Re)re.push({kind:"normal",item:Ne.item,idx:Ne.idx});Re=[]};
 * for(let Ne=0;Ne<T.length;Ne++){ const Ae=T[Ne];
 *   …
 *   if(Cb(Ae)||kg(Ae)){Te(),it(),re.push({kind:"normal",item:Ae,idx:Ne});continue}   // ← 卡片：独立 normal 块
 *   if(sx(Ae)){ …Me||(Me=[],ke=Ne),Me.push(Ae)… }                                    // ← 普通工具：进 collapsible
 *   else Me&&(Ae.type==="thinking"||ct(Ae))?Re.push({item:Ae,idx:Ne}):(Te(),it(),re.push({kind:"normal",item:Ae,idx:Ne})) }
 * ```
 * `sx` @459483 逐字：`e=>e.type==="tool_event"&&!cv(e)&&!kg(e)&&!GC(e)&&!IT(e)&&!xL(e)&&!yL(e)&&!jT(e)&&!MT(e)&&!bL(e)&&!vL(e)&&!wL(e)&&!Cb(e)&&!g0(e)`
 * ⇒ **只有「不属于任何卡片族」的 tool_event 才进 `collapsible`**；卡片族
 * （`kg`=`generation_confirmation` @457273、`Cb`=`gen_image|gen_video|generation_request` @458355 …）
 * 一律是 `kind:"normal"` 的**独立块**，块下标 = 它在 `contents` 里的下标。
 *
 * ② **折叠组只吸收「最后一个非空正文之前的 JG 块」**（`blt` @2631800 / `JG` @2631888 邻域，逐字）：
 * ```js
 * function blt(e,t){ if(!t)return[]; let n=-1;
 *   for(let o=e.length-1;o>=0;o--){const r=e[o];
 *     if(r.kind==="normal"&&r.item.type==="text"&&typeof r.item.content=="string"&&r.item.content.trim()){n=o;break}}
 *   if(n<0||e.slice(n+1).some(JG))return[];
 *   return e.flatMap((o,r)=>r<n&&JG(o)?[r]:[]) }
 * function JG(e){ if(e.kind==="collapsible")return!0; const{item:t}=e;
 *   if(t.type==="text"){…return !/!\[[^\]]*\]\(|\[[^\]]*\.(?:mp4|webm|mov|m4v)\]\(…/.test(i)}
 *   if(["thinking","compact","subagent"].includes(t.type))return!0;
 *   if(t.type!=="tool_event"||!t.content||typeof t.content!="object")return!1;
 *   const n=t.content,o=String(n.tool||""),r=String(n.request?.operation||"");
 *   return ["desktop_fs_confirmation",…].includes(o)&&… }
 * ```
 * ⇒ `JG(卡片块) === false`（卡片既不是 collapsible，也不是 text/thinking/compact/subagent，
 *   更不是那 4 个 desktop_* 确认）⇒ **卡片永远不被吸收，也永远不进折叠组内部**（= 常显）。
 *
 * ③ **组只渲染在被吸收块的第一个下标上**（@2661289 邻域，逐字）：
 * ```js
 * R.map((re,Me)=>{ const ke=M.find(Te=>Te.indices.includes(Me));
 *   if(ke){ const {absorbFrom:Te,lastCollapsible:it,toolItems:ct,absorbTextInRange:lt}=ke;
 *     if(Me>=Te&&Me<=it&&(lt||re.kind!=="normal")){ if(Me!==Te)return null;
 *       const Qe=ke.indices.map(Ne=>R[Ne]); return … <EO autoCollapse={O||F.current}> … </EO> … } } … })
 * ```
 *（`M` 由 `blt` 产出：`[{indices:Me,absorbFrom:Me[0],lastCollapsible:Me[Me.length-1],toolItems:ke,…Zrt(ke),absorbTextInRange:!0}]`）
 *
 * ⇒ **结论（不是自创规则）**：官方那条「组 → 卡 → 正文」**纯粹由 `contents` 的顺序决定** ——
 *   卡的下标 > 被吸收块的首个下标 ⇒ 卡渲染在组**下方**；卡的下标更小 ⇒ 卡渲染在组**上方**
 *   （= MTV 修前的错误版式）。官方之所以天然如此，是因为确认卡是「用户确认前到达的**最后**一条
 *   tool_event」：写入口 `onPendingQuestionSnapshot` 里 `dt||a.appendToolEventWithAnchor(Ge(),wt,$)`
 *   把 `generation_confirmation` 追加进 `contents`（= 之前那些步骤之后），而生成**结果卡** `eet`
 *   更是生成**完成**时才追加。
 *
 * ⚠️ 迁移到 MTV 的难点：MTV 把「请求确认 + 真执行 + 3 条执行期子步骤」压进**一个**
 *   `media_generate` 步骤（子步骤由 `agentRoundExecutor.createToolSubStepReporter` 在工具**执行期间**
 *   追加）。按 `item.startedAt` 排序时，卡（父调用开始时刻）必然排在子步骤**之前** ⇒ 卡跑到组上方。
 *   ⇒ 忠实等价物：**这张卡按「该次生成活动的收尾时刻」参与排序**（官方那张卡在到达序里就是
 *   「这次生成的所有工具事件之后」），而 item 自己的 `startedAt`/`endedAt` **一个字节都不改**
 *   （时长口径 `RE` = `min(startedAt)..max(endedAt)` 不受影响，卡片本来也不进组）。
 */
export function itemAppendOrderAt(step: AgentStep, item: ToolEventItem): number {
  const startedAt = typeof item.startedAt === 'number'
    ? item.startedAt
    : (step.toolCall?.startedAt ?? step.createdAt);
  /* 只有生成确认卡需要改道；其余 item 一律按自己的 `startedAt`（官方「到达即追加」）。 */
  if (itemToolName(item) !== GENERATION_CONFIRMATION_CARD_TOOL) return startedAt;
  /* 只有「**已批准** ⇒ 真的被执行了」的那次生成才有「一批排在自己之前的工具事件」
     （父执行项 + 执行期子步骤）。待批 / 被拒 / 过期时官方那张卡就是最后一条事件 ⇒ 位置不变。 */
  if (step.approval?.kind !== 'media_generation' || step.approval.status !== 'approved') {
    return startedAt;
  }
  const endAt = step.toolCall?.finishedAt ?? step.updatedAt;
  if (typeof endAt !== 'number' || !Number.isFinite(endAt)) return startedAt;
  return Math.max(startedAt, endAt);
}

/**
 * 一个 MTV 子任务 → 官方 `subagent` item。
 *
 * 复用 `agentActivityItems.childTaskToSubagentEvent` 的 `content`（官方 `YW` @23026 归一化后的载荷），
 * 但把它包进**官方真正的 item 类型 `subagent`**：官方写入口是
 * `{type:"subagent", content:c, startedAt:f, ...(eC(c.status)?{endedAt:f}:{})}`（@31931），
 * 而 `childTaskToSubagentEvent` 返回的是 `type:"tool_event"` —— 那是给旧渲染路径用的，不是官方 item 形状。
 */
export function childTaskToSubagentItem(task: AgentTask): SubagentItem {
  const base = childTaskToSubagentEvent(task);
  const baseContent = (base.content ?? {}) as Record<string, unknown>;
  const content: SubagentContent = {
    ...(baseContent as unknown as SubagentContent),
    subagent_id: String(baseContent.subagent_id ?? ''),
    status: String(baseContent.status ?? ''),
  };
  const startedAt = typeof base.startedAt === 'number' ? base.startedAt : undefined;
  const endedAt = typeof base.endedAt === 'number' ? base.endedAt : undefined;
  return {
    type: 'subagent',
    content,
    ...(startedAt !== undefined ? { startedAt } : {}),
    ...(endedAt !== undefined ? { endedAt } : {}),
  };
}

/** 装配顺序用的事件时间戳（缺一个就用另一个；都没有就 `0`）。 */
function activityTime(task: AgentTask): number {
  const value = task.startedAt ?? task.createdAt ?? task.updatedAt ?? 0;
  return Number.isFinite(value) ? value : 0;
}

/**
 * 按官方写入口的顺序把 MTV 数据装配成「官方有序 `contents`」（**归一化之前**的原始序）。
 *
 * 顺序（逐字依据见模块头 ·官方写入口）：
 * 1. 用户消息：官方 `bZ` 的 `context_nodes` part（有 `contextNodeIds` 时）；
 * 2. 活动项：主任务 steps → `tool_event`，子任务 → `subagent`，按时间戳**稳定**合并；
 * 3. 正文：`text`；
 * 4. `agent_error`（assistant + `status==='error'` + `agentTask.errorMessage`）；
 * 5. `task_snapshot`（官方 `xxe`：首个同类型项原地替换，否则末尾追加）。
 *
 * `message.contents` 非空时**完全接管**（直通，不再从 MTV 派生）—— 给后续接线留的逃生口；
 *
 * 🔴 **这条路径当前没有任何调用方**（`grep` 全仓：只有定义、注释与它自己的单测）。
 * **渲染层唯一的 `contents` 生产者是 `services/chat/messageContents.buildMessageContents`**
 * —— 两者对 `text` item 的**位置**口径不同：本函数是「活动项在前、正文在后」，而渲染用的那条是
 * 「正文按 `message.timestamp` 参与统一时间戳排序 ⇒ 落最前」（与 MTV 既有版式一致）。
 * 官方是**到达即追加**（@31177 `contents:[...f,{type:"tool_event",…},{type:"text",content:""}]`，
 * 正文流进尾部那条 @39787），所以「单条 string 的正文该放哪」两边都只是近似。
 * ⇒ **不要**在渲染路径上改用本函数（会移动正文位置）；要收敛请先决定正文位置口径。
 */
export function assembleRawAgentMessageContents(
  input: AgentMessageAssemblyInput,
): OfficialAgentContentItem[] {
  const message = input.message ?? {};
  if (Array.isArray(message.contents) && message.contents.length > 0) return [...message.contents];

  const isUser = message.role === 'user';
  const items: OfficialAgentContentItem[] = [];

  if (isUser) {
    /* 官方 `bZ` 产出的两个 part：`context_nodes` 在前，`text` 在后。 */
    const nodeIds = Array.isArray(message.contextNodeIds)
      ? message.contextNodeIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    if (nodeIds.length > 0) items.push({ type: 'context_nodes', content: { node_ids: nodeIds } });
    if (typeof message.content === 'string' && message.content.length > 0) {
      items.push({ type: 'text', content: message.content });
    }
    return items;
  }

  /* ── 活动项：主任务工具步骤 + 子任务（官方 subagent）。按时间戳稳定排序。 ── */
  const agentTask = input.agentTask ?? null;
  const activity: Array<{ at: number; order: number; item: ToolEventItem | SubagentItem }> = [];
  let order = 0;
  const steps = agentTask?.steps ?? [];
  const renderableSteps = steps.filter((step) => RENDERABLE_STEP_KINDS.has(step.kind));
  for (const step of renderableSteps) {
    /* 与渲染路径**同一套**适配器（复数版）：已批准的媒体生成 = 确认卡 + 被执行的工具事件，
       见 `stepToOfficialToolEventItems`。用单数版会让这条路径少一项、与官方 `contents` 不一致。
       ⚠️ 排序键用 `itemAppendOrderAt`（生成卡按该次生成的收尾时刻，见 §7c），
       否则卡会排到自己的子步骤之前 ⇒ 渲染成「卡 → 步骤组」（官方是「步骤组 → 卡 → 正文」）。 */
    for (const item of stepToOfficialToolEventItems(step)) {
      activity.push({
        at: itemAppendOrderAt(step, item),
        order: order++,
        item,
      });
    }
  }
  const childTasks = [...(input.childTasks ?? [])].sort(
    (left, right) => activityTime(left) - activityTime(right),
  );
  for (const child of childTasks) {
    activity.push({ at: activityTime(child), order: order++, item: childTaskToSubagentItem(child) });
  }
  activity.sort((left, right) => (left.at - right.at) || (left.order - right.order));
  for (const entry of activity) items.push(entry.item);

  /* ── 正文（官方 `appendMessageTextChunk` 在工具/子代理项之后写入）。 ── */
  if (typeof message.content === 'string' && message.content.length > 0) {
    const text: TextItem = { type: 'text', content: message.content };
    if (typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)) {
      text.startedAt = message.timestamp;
    }
    items.push(text);
  }

  /* ── 官方错误横幅：`appendMessageContent(id, {type:"agent_error", content})` 追加。 ── */
  if (message.status === 'error') {
    const errorMessage = agentTask?.errorMessage;
    if (typeof errorMessage === 'string' && errorMessage.length > 0) {
      items.push({ type: 'agent_error', content: errorMessage });
    }
  }

  /* ── 任务快照（官方 `xxe` 的落位规则）。 ── */
  const snapshotItem = toTaskSnapshotItem(message.todoSnapshot);
  return snapshotItem ? upsertTaskSnapshotItem(items, snapshotItem) : items;
}

/** 官方读侧入口：`contents = YNe(p1e(raw))`。 */
export function assembleAgentMessageContents(
  input: AgentMessageAssemblyInput,
): readonly OfficialAgentContentItem[] {
  return normalizeAgentContents(assembleRawAgentMessageContents(input));
}

/* ============================================================================
 * 8. 与 `agentContents.ts` 的组合（官方 `@{contents, taskSnapshot} = JNe(YNe(p1e(raw)))`）
 * ============================================================================ */

export interface AgentMessageContentsSplit {
  /** 装配 + 归一化后的**有序** inline item（不含 `task_snapshot`）。 */
  contents: ReturnType<typeof splitAgentContents>['inlineContents'];
  /** 官方 `DD`：最后一个合法 `agent_task_snapshot.v1` content。 */
  taskSnapshot: ReturnType<typeof splitAgentContents>['taskSnapshot'];
}

/** 官方读侧 `JNe` 的一次到位封装：`splitAgentContents(assembleAgentMessageContents(input))`。 */
export function splitAgentMessageContents(input: AgentMessageAssemblyInput): AgentMessageContentsSplit {
  const split = splitAgentContents(assembleAgentMessageContents(input));
  return { contents: split.inlineContents, taskSnapshot: split.taskSnapshot };
}
