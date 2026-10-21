/**
 * agentContents —— 官方 live「有序 `contents: Item[]`」消息体层的**纯函数逐字复刻**。
 *
 * 权威来源：`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`（同名符号在不同 chunk 含义不同，
 * 下面所有偏移都是**这个 chunk 内**的字节偏移）。逐字抽取，未挖到的字段一律在注释里标注。
 *
 * 官方符号 → 本模块（偏移见函数上方注释）：
 * ```js
 * JNe(e) = { inlineContents: e.filter(t => t.type !== "task_snapshot"), taskSnapshot: DD(e) }  // @446152
 * Ug(e)  = e.type === "tool_event" && !$b && !dg && !wS && !iT && !kD && !AD
 *                                  && !aT && !lT && !ID && !jD && !MD && !ib && !Xv        // @446152
 * e1e(e) = 从 contents 里收「生图/CLI 工具产出的画布节点」→ {key,nodeId,tool,title?}[]     // @446152
 * DD(e)  = 从后往前找最后一个合法 agent_task_snapshot                                     // @445911
 * Kv(t)  = 工具名归一化后 === "bash" || "tapnow_cli"                                       // @414092
 * ```
 *
 * 官方调用方（@2427485 邻域的分发器）逐字确认了每个谓词在管线里的作用：
 * ```js
 * if (type === "text")     → 正文
 * if (type === "thinking") → 思考行（streaming 时才显示）
 * if (type === "compact")  → 压缩行（content.phase）
 * if (type === "task_snapshot") → return null        // 行内**不渲染**，喂给任务历史卡
 * if (type === "tool_event") {
 *   if ($b) → AskQuestion 卡；  if (wS) → return null；        if (dg) → 生成确认卡
 *   if (iT) → 节点更新确认卡；  if (kD) → 桌面确认卡；         if (MD) → return null
 *   if (AD) → MCP app（ui.resource_uri）卡； if (aT) → widget 卡； if (lT) → html 卡
 *   if (ID) → 连接器状态卡；    if (jD) → 表单卡；             if (ib) → 生成结果卡
 *   else    → 普通工具行（PE / ToolCallStatusLine）
 * }
 * ```
 * `e1e` 的调用方（@2611656）：
 * ```js
 * Re = useMemo(() => e1e(T), [T]); De = Re.length > 0 && !n;
 * ...De && <div>{(me ? Re : Re.slice(0, 6)).map(u => <DF nodeId={u.nodeId} tool={u.tool} title={u.title} key={u.key}/>)}</div>
 * ```
 * ⇒ 它就是**消息底部的画布节点胶囊列表**（最多 6 个，可「显示全部 N」）。
 *
 * ⚠️ 本模块**纯函数、不依赖 React**；12 个「特殊族」谓词是模块私有（只有 `Ug` 用它们）。
 */
/* ============================================================================
 * 0. 入参类型（官方这些函数不做编译期形状校验，只做运行时判据）
 * ============================================================================ */

/**
 * 宽松入参：官方 `xl`/`Hb`/`Ug` 只保证「`type === "tool_event"` 且 `content` 是对象」，
 * 其余字段一概靠运行时 `typeof` 判。允许传 MTV 侧未归一化的旧形状（例如缺 `schema_version`）。
 */
export type AgentContentInput = { type?: unknown; content?: unknown };

/* ============================================================================
 * 1. 官方 item 类型联合（字段来源逐条标注，未挖到的一律注明）
 * ============================================================================ */

/**
 * `tool_event` 的 `content`。**已确认**字段来自官方 wire 归一化器 `Gge`（@21101）：
 * ```js
 * Gge=e=>e.tool_event&&typeof e.tool_event=="object"?e.tool_event
 *   :typeof e.tool_call_id=="string"&&e.tool_call_id?{
 *     schema_version:"tool_event.v1", type:"tool_event",
 *     tool:e.tool_name||"",
 *     status:e.tool_status||(e.phase==="tool_completed"?"completed":"started"),
 *     tool_call_id:e.tool_call_id, request:{}, response:null}:null
 * ```
 * 另从 mock item（@2327757）确认 `ui:{resource_uri, host_capabilities}` 与
 * `projection_revision:{message_sequence, part_index}`；从分发器 @2610900 邻域确认 `result.confirmation_id`。
 * `tool_use_id` 是官方 `iS`/`e1e` 读的旧字段回退（有些 item 只有它没有 `tool_call_id`）。
 */
export type ToolEventContent = {
  schema_version: 'tool_event.v1';
  type: 'tool_event';
  tool: string;
  status: string;
  /** 与 `tool_use_id` 二选一（官方 `iS`/`e1e` 的取值顺序是 `tool_call_id` → `tool_use_id`）。 */
  tool_call_id?: string;
  tool_use_id?: string;
  request?: Record<string, unknown>;
  /** 工具返回体；形状随工具而异（`TY` 只按各工具的键去挖节点）。可为 `null`。 */
  response?: unknown;
  /** 官方 `AD` 判 MCP app 的依据：`ui.resource_uri` 为非空字符串。 */
  ui?: { resource_uri?: string; host_capabilities?: string[]; [key: string]: unknown };
  /** 流式投影版本（@2327757 mock 里出现）。 */
  projection_revision?: { message_sequence: number; part_index: number };
  /** 确认类工具的确认单 id（分发器读 `content.result?.confirmation_id`）。 */
  result?: Record<string, unknown>;
  /** 其余未挖到的键按官方风格原样透传。 */
  [key: string]: unknown;
};

/** `tool_event` item。item 级 `startedAt`/`endedAt` 由写入口 `@31193` 确认（`{type:"tool_event",content:t,startedAt:c??b,...i?{endedAt:d??b}:{}}`）。 */
export type ToolEventItem = {
  type: 'tool_event';
  content: ToolEventContent;
  startedAt?: number;
  endedAt?: number;
};

/** `text` item。**未挖到**除 `content` 外的独立字段契约；`startedAt`/`endedAt` 见 `Fv`（@28928）与聚合处 @2608253 对 `item.startedAt/endedAt` 的读取。 */
export type TextItem = {
  type: 'text';
  content: string;
  startedAt?: number;
  endedAt?: number;
};

/**
 * `thinking` item。字段来自写入口 `appendMessageThinkingChunk`（@40363：
 * `{type:"thinking",content:o,startedAt:Date.now()}`）与聚合处 @2608253（读取 `item.startedAt`/`endedAt`、
 * 输出 `{content, totalDurationMs}`）。`totalDurationMs` 是聚合产物，不是 wire 字段。
 */
export type ThinkingItem = {
  type: 'thinking';
  content: string;
  startedAt?: number;
  endedAt?: number;
  totalDurationMs?: number;
};

/**
 * `subagent` 的 `content`。**已确认**字段来自官方归一化器 `YW`（@22982）：
 * ```js
 * return{subagent_id:t, status:o, agent_type:…:void 0, parent_tool_call_id:…:void 0,
 *        task_description:…:void 0, text:…:"", tools:r,
 *        ...typeof e.last_content_seq=="number"?{last_content_seq:e.last_content_seq}:{}}
 * ```
 * `status` 只可能是 `running | completed | failed | stopped | ended_unknown`（`YW` 里其余一律归 `ended_unknown`）。
 */
export type SubagentContent = {
  subagent_id: string;
  status: 'running' | 'completed' | 'failed' | 'stopped' | 'ended_unknown' | string;
  agent_type?: string;
  parent_tool_call_id?: string;
  task_description?: string;
  /** 子代理自带正文（`YW` 缺省 `""`）。 */
  text?: string;
  /** 子代理内部的工具事件（`QW` 只保留对象项）。 */
  tools?: ToolEventContent[];
  last_content_seq?: number;
};

/** `subagent` item。item 级字段由写入口 `gxe`（@31287）确认：`{type:"subagent",content:c,startedAt:f,...eC(c.status)?{endedAt:f}:{}}`。 */
export type SubagentItem = {
  type: 'subagent';
  content: SubagentContent;
  startedAt?: number;
  endedAt?: number;
};

/**
 * `task_snapshot.content.tasks` 的一个条目。
 * ⚠️ **诚实标注**：本 chunk 内**只**确认了 `content.schema_version === "agent_task_snapshot.v1"`
 * 与 `Array.isArray(content.tasks)`（`DD` @445911），**以及** `content.plan_ready`（见下）。`tasks[]`
 * 的元素形状**未在本 chunk 挖到**——下面的字段抄自 MTV 既有 `services/chat/todoTasks.ts`
 * `todosFromSnapshot`（其头注释标注为官方 `Ix`，源 chunk 是
 * `use-chat-attachment-file-input-CE59XJWo.js`@294130，**不是本 chunk**）。全部可选，不做保证。
 */
export type AgentTaskSnapshotTask = {
  /** 官方 `Ix` 读的题面字段（MTV 侧称 `content`）。 */
  subject?: string;
  status?: string;
  active_form?: string;
  task_id?: string;
  description?: string;
  blocks?: string[];
  blocked_by?: string[];
};

/**
 * `task_snapshot` 的 `content`。
 * 已确认：`schema_version`（字面量）与 `tasks` 是数组（`DD` @445911）。
 * `plan_ready` 抄自 MTV `todoTasks.ts`（同上面的诚实标注），未在本 chunk 复验。
 */
export type AgentTaskSnapshotContent = {
  schema_version: 'agent_task_snapshot.v1';
  tasks: AgentTaskSnapshotTask[];
  plan_ready?: boolean;
};

/**
 * `task_snapshot` item。**已确认**：`xxe`（@32022）逐字
 * ```js
 * const r = { type: "task_snapshot", content: t };   // ← 只有这两个字段，没有 startedAt/endedAt
 * ```
 * 且它会**替换**（而不是追加）已有的同类型 item。分发器里 `type === "task_snapshot"` 直接 `return null`。
 */
export type TaskSnapshotItem = {
  type: 'task_snapshot';
  content: AgentTaskSnapshotContent;
};

/** 官方行内渲染认得的 5 种 item。
 *  （另有 `compact`（`content.phase`）与 `agent_error` 也被分发器/聚合读到，但不属本次交付范围，故不入联合。） */
export type AgentContentItem = ToolEventItem | TextItem | ThinkingItem | SubagentItem | TaskSnapshotItem;

/** `JNe.inlineContents` 的元素类型（剔掉 `task_snapshot`）。 */
export type InlineAgentContentItem = Exclude<AgentContentItem, TaskSnapshotItem>;

/** 官方 `JNe` 的产物。 */
export interface AgentContentsSplit {
  /** 官方：`contents.filter(t => t.type !== "task_snapshot")`（运行时不校验，只按 `type` 剔）。 */
  inlineContents: InlineAgentContentItem[];
  /** 官方 `DD`：最后一个合法快照的 `content`，没有则 `null`。 */
  taskSnapshot: AgentTaskSnapshotContent | null;
}

/* ============================================================================
 * 2. 基础取数（官方 `xl` / `Hb`）
 * ============================================================================ */

/** TS 侧窄化：官方在 JS 里直接点 `e.content`，这里返回归一化后的 content 记录。 */
function toolEventContent(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as AgentContentInput;
  if (record.type !== 'tool_event') return null;
  const content = record.content;
  if (typeof content !== 'object' || content === null) return null;
  return content as Record<string, unknown>;
}

/** 官方 `xl(e)`（@443723）：`e.type==="tool_event" && typeof e.content=="object" && e.content!==null ? String(e.content.tool??"") : ""`。
 *  **注意不归一化**（大小写敏感），所以下面所有 `Set.has` 都是大小写敏感的。 */
function toolNameRaw(item: unknown): string {
  const content = toolEventContent(item);
  return content ? String(content.tool ?? '') : '';
}

/** 官方 `Hb(e)`（@443827）：同上取 `String(e.content.status ?? "")`。 */
function toolStatusRaw(item: unknown): string {
  const content = toolEventContent(item);
  return content ? String(content.status ?? '') : '';
}

/* ============================================================================
 * 3. 工具族集合（逐字，偏移见各行）
 * ============================================================================ */

/** 官方 `MNe` @442097。 */
const ASK_QUESTION_TOOLS = new Set(['AskUserQuestion', 'ask_question']);
/** 官方 `PNe` @442145。 */
const GENERATION_CONFIRMATION_TOOLS = new Set(['generation_confirmation']);
/** 官方 `RNe` @442186。 */
const COST_LIMIT_CONFIRMATION_TOOLS = new Set(['cost_limit_confirmation']);
/** 官方 `DNe` @442227。 */
const NODE_UPDATE_CONFIRMATION_TOOLS = new Set(['node_update_confirmation']);
/** 官方 `LNe` @442269。 */
const DESKTOP_CONFIRMATION_TOOLS = new Set([
  'desktop_open_app_confirmation',
  'desktop_capture_screen_confirmation',
  'desktop_fs_confirmation',
  'desktop_shell_command_confirmation',
  'batch_download_files_confirmation',
]);
/** 官方 `FNe` @442453。 */
const SHOW_WIDGET_TOOLS = new Set(['show_widget']);
/** 官方 `ONe` @442482。 */
const SHOW_HTML_TOOLS = new Set(['show_html']);
/** 官方 `zNe` @442509。 */
const CONNECTOR_STATUS_TOOLS = new Set(['get_connector_status']);
/** 官方 `UNe` @442547。 */
const SHOW_FORM_TOOLS = new Set(['show_form']);
/** 官方 `BNe` @442574。 */
const PREPARE_WIDGET_TOOLS = new Set(['prepare_widget']);
/** 官方 `VNe` @442606（`Xv` 用小写后的名字比对，所以这一族大小写不敏感）。 */
const UTILITY_TOOLS_EXCLUDED_FROM_TOOL_LINE = new Set(['todowrite', 'memory', 'inspect_canvas']);
/** 官方 `UY` @442659 —— 官方源码就是 `UY=new Set`（**空集**，见 `Xv` 的注释）。 */
const EMPTY_TOOL_SET = new Set<string>();
/** 官方 `XNe` @445047 —— `ib` 的生成类（注意成员是 `generation_request`，**不是** `gen_audio`）。 */
const GENERATION_TOOLS = new Set(['gen_image', 'gen_video', 'generation_request']);
/** 官方 `HNe` @442687 —— `e1e` 的「会产出画布节点」生成类（成员是 `gen_audio`，**不是** `generation_request`）。 */
const NODE_PRODUCING_GENERATION_TOOLS = new Set(['gen_image', 'gen_video', 'gen_audio']);
/** 官方 `rNe` @428589 —— 判定 `canvas_changed` 是否真的改了画布。 */
const CANVAS_MUTATION_ACTIONS = new Set(['create', 'bind_job', 'generate']);
/** 官方 `YSe` @413985 / `eT` @413996 —— `Kv` 的成员。 */
const CLI_TOOL_NAMES = new Set(['bash', 'tapnow_cli']);

/* ============================================================================
 * 4. 13 个工具族谓词（官方 `$b`…`Xv`，模块私有；`Ug` 依次调用它们）
 * ============================================================================ */

/** 官方 `$b`（@444004）：`MNe.has(xl(e))` ⇒ **AskUserQuestion / ask_question**（问答卡）。 */
const isAskQuestionTool = (item: unknown): boolean => ASK_QUESTION_TOOLS.has(toolNameRaw(item));

/** 官方 `dg`（@444025）：`PNe.has(xl(e))` ⇒ **generation_confirmation**（生成确认卡）。 */
const isGenerationConfirmationTool = (item: unknown): boolean =>
  GENERATION_CONFIRMATION_TOOLS.has(toolNameRaw(item));

/** 官方 `wS`（@444046）：`RNe.has(xl(e))` ⇒ **cost_limit_confirmation**（分发器对它 `return null`，即不渲染）。 */
const isCostLimitConfirmationTool = (item: unknown): boolean =>
  COST_LIMIT_CONFIRMATION_TOOLS.has(toolNameRaw(item));

/** 官方 `iT`（@444067）：`DNe.has(xl(e))` ⇒ **node_update_confirmation**（节点更新确认卡）。 */
const isNodeUpdateConfirmationTool = (item: unknown): boolean =>
  NODE_UPDATE_CONFIRMATION_TOOLS.has(toolNameRaw(item));

/** 官方 `kD`（@444088）：`LNe.has(xl(e))` ⇒ **desktop_open_app_confirmation /
 *  desktop_capture_screen_confirmation / desktop_fs_confirmation /
 *  desktop_shell_command_confirmation / batch_download_files_confirmation**（桌面权限/批量下载确认卡）。 */
const isDesktopConfirmationTool = (item: unknown): boolean => DESKTOP_CONFIRMATION_TOOLS.has(toolNameRaw(item));

/** 官方 `AD`（@444486）：**不看工具名**，看 `content.ui.resource_uri` 是非空字符串 ⇒ MCP app 卡片。 */
const hasMcpAppResource = (item: unknown): boolean => {
  const content = toolEventContent(item);
  if (!content) return false;
  const ui = content.ui;
  if (!ui || typeof ui !== 'object') return false;
  const resourceUri = (ui as { resource_uri?: unknown }).resource_uri;
  return typeof resourceUri === 'string' && resourceUri.length > 0;
};

/** 官方 `aT`（@444691）：`FNe.has(xl(e))` ⇒ **show_widget**（widget 卡 / 加载态）。 */
const isShowWidgetTool = (item: unknown): boolean => SHOW_WIDGET_TOOLS.has(toolNameRaw(item));

/** 官方 `lT`（@444963）：`ONe.has(xl(e))` ⇒ **show_html**（html 卡）。 */
const isShowHtmlTool = (item: unknown): boolean => SHOW_HTML_TOOLS.has(toolNameRaw(item));

/** 官方 `ID`（@444984）：`zNe.has(xl(e))` ⇒ **get_connector_status**（连接器状态卡）。 */
const isConnectorStatusTool = (item: unknown): boolean => CONNECTOR_STATUS_TOOLS.has(toolNameRaw(item));

/** 官方 `jD`（@445005 邻域）：`UNe.has(xl(e))` ⇒ **show_form**（表单卡）。 */
const isShowFormTool = (item: unknown): boolean => SHOW_FORM_TOOLS.has(toolNameRaw(item));

/** 官方 `MD`（@445026 邻域）：`BNe.has(xl(e))` ⇒ **prepare_widget**（分发器对它 `return null`，即不渲染）。 */
const isPrepareWidgetTool = (item: unknown): boolean => PREPARE_WIDGET_TOOLS.has(toolNameRaw(item));

/** 官方 `ib`（@445107）：`e.type==="tool_event" && XNe.has(xl(e))` ⇒ **gen_image / gen_video / generation_request**
 *  （生成结果卡）。`XNe` 与 `HNe` **不是同一个集合**：这里没有 `gen_audio`，却有 `generation_request`。 */
const isGenerationTool = (item: unknown): boolean =>
  (item as AgentContentInput | null)?.type === 'tool_event' && GENERATION_TOOLS.has(toolNameRaw(item));

/** 官方 `Xv`（@445151）：**todowrite / memory / inspect_canvas**（先 `toLowerCase()`，所以那几个名字大小写不敏感），
 *  或「属于官方 `UY` 且 `status === "completed"`」。⚠️ 官方 `UY` 是**空 Set** ⇒ 第二个分支恒为 false（死代码），
 *  但按「逐字」要求原样保留。 */
const isUtilityToolExcluded = (item: unknown): boolean => {
  if ((item as AgentContentInput | null)?.type !== 'tool_event') return false;
  const name = toolNameRaw(item).toLowerCase();
  return Boolean(UTILITY_TOOLS_EXCLUDED_FROM_TOOL_LINE.has(name) || (EMPTY_TOOL_SET.has(name) && toolStatusRaw(item) === 'completed'));
};

/* ============================================================================
 * 5. 导出：`JNe` / `Ug` / `DD`
 * ============================================================================ */

/** 官方 `DD`（@445911）：从后往前找**最后一个**合法的 `agent_task_snapshot` content。
 *  ```js
 *  DD=e=>{for(let t=e.length-1;t>=0;t-=1){const n=e[t];
 *    if(n?.type!=="task_snapshot"||typeof n.content!="object"||!n.content)continue;
 *    const o=n.content;
 *    if(o.schema_version==="agent_task_snapshot.v1"&&Array.isArray(o.tasks))return o}return null}
 *  ``` */
function lastAgentTaskSnapshot(contents: readonly AgentContentInput[]): AgentTaskSnapshotContent | null {
  for (let index = contents.length - 1; index >= 0; index -= 1) {
    const item = contents[index];
    if (item?.type !== 'task_snapshot' || typeof item.content !== 'object' || !item.content) continue;
    const content = item.content as Record<string, unknown>;
    if (content.schema_version === 'agent_task_snapshot.v1' && Array.isArray(content.tasks)) {
      return content as unknown as AgentTaskSnapshotContent;
    }
  }
  return null;
}

/**
 * 官方 `JNe`（@446152）：把有序 `contents` 拆成「行内项」+「任务快照」。
 * `task_snapshot` **不参与行内渲染**（分发器对它 `return null`），而是喂给任务历史卡。
 *
 * ⚠️ 与官方一致：只按 `type` 剔除，**不做任何字段校验**；`inlineContents` 的静态类型是 TS 侧的收窄。
 */
export function splitAgentContents(contents: readonly AgentContentInput[]): AgentContentsSplit {
  return {
    inlineContents: contents.filter((item): item is InlineAgentContentItem => item.type !== 'task_snapshot'),
    taskSnapshot: lastAgentTaskSnapshot(contents),
  };
}

/**
 * 官方 `Ug`（@446152）：**普通工具事件**——即「该落到 `PE`（ToolCallStatusLine）那一行」的工具。
 * 命中任何一个特殊族都返回 `false`（那个族有自己的专用卡片）。逐字保留全部 13 个排除项：
 * ```js
 * Ug=e=>e.type==="tool_event"&&!$b(e)&&!dg(e)&&!wS(e)&&!iT(e)&&!kD(e)&&!AD(e)&&!aT(e)
 *        &&!lT(e)&&!ID(e)&&!jD(e)&&!MD(e)&&!ib(e)&&!Xv(e)
 * ```
 */
export function isPlainToolEvent(item: AgentContentInput): boolean {
  return (item as AgentContentInput | null)?.type === 'tool_event'
    && !isAskQuestionTool(item)
    && !isGenerationConfirmationTool(item)
    && !isCostLimitConfirmationTool(item)
    && !isNodeUpdateConfirmationTool(item)
    && !isDesktopConfirmationTool(item)
    && !hasMcpAppResource(item)
    && !isShowWidgetTool(item)
    && !isShowHtmlTool(item)
    && !isConnectorStatusTool(item)
    && !isShowFormTool(item)
    && !isPrepareWidgetTool(item)
    && !isGenerationTool(item)
    && !isUtilityToolExcluded(item);
}

/* ============================================================================
 * 6. 官方 `Kv` / `TY` / `TD` / `aNe` / `lNe` —— `e1e` 的取数依赖
 * ============================================================================ */

/** 官方 `tT`（@414033）：`typeof e!="string" ? null : e.trim().toLowerCase() || null`。 */
function normalizeToolName(tool: unknown): string | null {
  if (typeof tool !== 'string') return null;
  return tool.trim().toLowerCase() || null;
}

/** 官方 `Kv`（@414092）：归一化后 === `bash`（`YSe` @413985）或 `tapnow_cli`（`eT` @413996）。 */
function isCliTool(tool: unknown): boolean {
  const normalized = normalizeToolName(tool);
  return normalized !== null && CLI_TOOL_NAMES.has(normalized);
}

/** `TY` 的产物：一个画布节点引用（`title` 只在官方能挖到时才有）。 */
export type AgentNodeRef = { nodeId: string; title?: string };

/** 官方 `iNe`（@428635）：`canvas_changed.actions` 里有没有 `create` / `bind_job` / `generate`（逐项 trim+小写）。 */
function hasCanvasMutation(response: Record<string, unknown>): boolean {
  const changed = response.canvas_changed;
  if (!changed || typeof changed !== 'object') return false;
  const actions = (changed as Record<string, unknown>).actions;
  return Array.isArray(actions)
    ? actions.some((action) => typeof action === 'string' && CANVAS_MUTATION_ACTIONS.has(action.trim().toLowerCase()))
    : false;
}

/** 官方 `aNe`（@428787）：CLI 工具（bash/tapnow_cli）的节点来源 = `response.canvas_changed.node_ids`。 */
function cliCanvasChangedRefs(response: Record<string, unknown>): AgentNodeRef[] {
  const changed = response.canvas_changed;
  if (!hasCanvasMutation(response)) return [];
  const nodeIds = (changed as Record<string, unknown>).node_ids;
  return Array.isArray(nodeIds)
    ? nodeIds
      .filter((nodeId): nodeId is string => typeof nodeId === 'string' && nodeId.trim().length > 0)
      .map((nodeId) => ({ nodeId }))
    : [];
}

/** 官方 `lNe`（@428841）：`view_media` 的节点来源 = `response.images[]` / `response.videos[]` 的 `ref`（去掉 `node/` 前缀、去重）。
 *  ⚠️ 在 `e1e` 里这个分支**不可达**：进 `e1e` 的工具必须先过 `HNe`（gen_image/gen_video/gen_audio）或 `Kv`（bash/tapnow_cli）闸门。 */
function viewMediaRefs(response: Record<string, unknown>): AgentNodeRef[] {
  const refs: AgentNodeRef[] = [];
  const seen = new Set<string>();
  for (const list of [response.images, response.videos]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const rawRef = (entry as Record<string, unknown>).ref;
      const ref = typeof rawRef === 'string' ? rawRef.trim() : '';
      if (!ref) continue;
      const nodeId = ref.replace(/^node\//i, '');
      if (!nodeId || seen.has(nodeId)) continue;
      seen.add(nodeId);
      refs.push({ nodeId });
    }
  }
  return refs;
}

/**
 * 官方 `TY`（@429244）：从某个 `tool_event.content` 的 `response` 里挖画布节点引用。
 * 参数就是 **content**（官方在 `e1e` 里调 `TY(l)`、在 `TD` 里调 `TY(e)`）。
 * 逐字保留了 `o` / `r` / `i` / `l` / `c` 五个内联辅助与全部分支顺序：
 * `Kv(tool)` → `aNe`；`locate_canvas_nodes` → `l`/`c`/六个候选键；`view_media` → `lNe`；
 * `items[]` → 只取 `node_id`；`node_id`；`group_node_id` + `node_ids[]`；`node_ids[]`；`results[]`。
 */
function nodeRefsWithTitle(content: unknown): AgentNodeRef[] {
  const record = content && typeof content === 'object' ? (content as Record<string, unknown>) : null;
  const response = record?.response;
  if (!response || typeof response !== 'object') return [];
  const responseRecord = response as Record<string, unknown>;
  const tool = String(record?.tool || '');
  if (isCliTool(tool)) return cliCanvasChangedRefs(responseRecord);

  /** 官方 `TY` 内部 `o`：数组里的每一项只取 `node_id`。 */
  const idsFromNodeId = (value: unknown): AgentNodeRef[] =>
    Array.isArray(value)
      ? value.reduce<AgentNodeRef[]>((acc, entry) => {
        if (!entry || typeof entry !== 'object') return acc;
        const nodeId = (entry as Record<string, unknown>).node_id;
        if (typeof nodeId === 'string' && nodeId) acc.push({ nodeId });
        return acc;
      }, [])
      : [];

  /** 官方 `TY` 内部 `r`：`title` → `label` → `reason`。 */
  const titleOf = (entry: Record<string, unknown>): string | undefined => {
    if (typeof entry.title === 'string' && entry.title) return entry.title;
    if (typeof entry.label === 'string' && entry.label) return entry.label;
    if (typeof entry.reason === 'string' && entry.reason) return entry.reason;
    return undefined;
  };

  /** 官方 `TY` 内部 `i`：`node_id` / `nodeId` / `id` 里第一个字符串当 id，再挂可有可无的 title。 */
  const refOf = (entry: Record<string, unknown>): AgentNodeRef | null => {
    const found = [entry.node_id, entry.nodeId, entry.id].find((value) => typeof value === 'string');
    if (typeof found !== 'string' || !found) return null;
    const title = titleOf(entry);
    return title ? { nodeId: found, title } : { nodeId: found };
  };

  /** 官方 `TY` 内部 `l`。 */
  const refsOf = (value: unknown): AgentNodeRef[] =>
    Array.isArray(value)
      ? value.reduce<AgentNodeRef[]>((acc, entry) => {
        if (!entry || typeof entry !== 'object') return acc;
        const ref = refOf(entry as Record<string, unknown>);
        if (ref) acc.push(ref);
        return acc;
      }, [])
      : [];

  /** 官方 `TY` 内部 `c`：`locate_canvas_nodes` 的单条「裸」节点描述（键必须全在白名单里）。 */
  const isLooseNodeRef = (entry: Record<string, unknown>): boolean => {
    const allowed = new Set(['node_id', 'nodeId', 'id', 'title', 'label', 'reason']);
    const hasId = typeof entry.node_id === 'string' || typeof entry.nodeId === 'string' || typeof entry.id === 'string';
    const hasTitle = titleOf(entry) !== undefined;
    return hasId && hasTitle && Object.keys(entry).every((key) => allowed.has(key));
  };

  if (tool === 'locate_canvas_nodes') {
    if (Array.isArray(responseRecord)) return refsOf(responseRecord);
    if (isLooseNodeRef(responseRecord)) {
      const ref = refOf(responseRecord);
      return ref ? [ref] : [];
    }
    for (const candidate of [
      responseRecord.matches,
      responseRecord.node_pills,
      responseRecord.nodes,
      responseRecord.results,
      responseRecord.items,
      responseRecord.raw,
    ]) {
      const refs = refsOf(candidate);
      if (refs.length > 0) return refs;
    }
    return [];
  }
  if (tool === 'view_media') return viewMediaRefs(responseRecord);
  if (Array.isArray(responseRecord.items)) return idsFromNodeId(responseRecord.items);
  if (typeof responseRecord.node_id === 'string') return [{ nodeId: responseRecord.node_id }];
  if (typeof responseRecord.group_node_id === 'string') {
    const refs: AgentNodeRef[] = [{ nodeId: responseRecord.group_node_id }];
    if (Array.isArray(responseRecord.node_ids)) {
      for (const nodeId of responseRecord.node_ids) if (typeof nodeId === 'string') refs.push({ nodeId });
    }
    return refs;
  }
  return Array.isArray(responseRecord.node_ids)
    ? responseRecord.node_ids
      .filter((nodeId): nodeId is string => typeof nodeId === 'string')
      .map((nodeId) => ({ nodeId }))
    : Array.isArray(responseRecord.results)
      ? idsFromNodeId(responseRecord.results)
      : [];
}

/** 官方 `TD`（@430830）：`TY(e).map(t => t.nodeId).filter(t => typeof t === "string" && t.length > 0)`。 */
function nodeRefIds(content: unknown): string[] {
  return nodeRefsWithTitle(content)
    .map((ref) => ref.nodeId)
    .filter((nodeId): nodeId is string => typeof nodeId === 'string' && nodeId.length > 0);
}

/* ============================================================================
 * 7. 导出：官方 `e1e` —— 消息底部的画布节点胶囊
 * ============================================================================ */

/** `e1e` 产出的一个胶囊。`nodeId` 为 `null` 表示「工具还在跑、节点还没出来」（官方 `pending-<toolCallId>` 伪条目）。 */
export interface AgentNodeChip {
  /** 官方 `key`：有节点时就是 `nodeId`，否则是 `` `pending-${toolCallId}` ``。 */
  key: string;
  nodeId: string | null;
  /** 原始（**未归一化**）的 `content.tool`。 */
  tool: string;
  title?: string;
}

/**
 * 官方 `e1e`（@446152 邻域）：从 `contents` 里收「生图 / CLI 工具产出的画布节点」。
 *
 * 闸门（逐字）：
 * - `content.tool` **原样**（不 trim/不小写）必须命中 `HNe`（`gen_image` / `gen_video` / `gen_audio`），
 *   **或** `Kv(tool)`（归一化后 `bash` / `tapnow_cli`）；
 * - `status` 只认 `started` / `pending` / `completed`；
 * - CLI 工具只认 `completed`；
 * - 节点来自 `response`（`TY` 带标题 / `TD` 只有 id）；
 * - `completed` 的调用 id 会记进 `completed` 集合，最后用来丢弃「已经完成、但当时没节点」的 pending 伪条目。
 *
 * 官方调用方（@2611656）：`De = chips.length > 0 && !isStreaming`，然后最多渲染 6 个（`Re.slice(0, 6)`），
 * 超出显示「显示全部 N」。每个胶囊 `<DF nodeId tool title>`。
 */
export function collectNodeChips(contents: readonly AgentContentInput[]): AgentNodeChip[] {
  /** 官方 `t`：已 `completed` 的 tool_call_id。 */
  const completedCallIds = new Set<string>();
  /** 官方 `n`：nodeId → 胶囊。 */
  const byNodeId = new Map<string, AgentNodeChip>();
  /** 官方 `o`：tool_call_id → pending 伪胶囊。 */
  const pendingByCallId = new Map<string, AgentNodeChip>();

  for (const item of contents) {
    if (item.type !== 'tool_event' || typeof item.content !== 'object' || !item.content) continue;
    const content = item.content as Record<string, unknown>;
    /** 官方 `c`：**原始**工具名（不归一化）。 */
    const tool = String(content.tool ?? '');
    /** 官方 `d`：`Kv(c)`。 */
    const isCli = isCliTool(tool);
    if (!NODE_PRODUCING_GENERATION_TOOLS.has(tool) && !isCli) continue;

    /** 官方 `u`。 */
    const status = String(content.status ?? '');
    if (status !== 'started' && status !== 'pending' && status !== 'completed') continue;

    /** 官方 `p`。 */
    const callId =
      (typeof content.tool_call_id === 'string' ? content.tool_call_id : '')
      || (typeof content.tool_use_id === 'string' ? content.tool_use_id : '');

    /** 官方 `m = TY(l)`。 */
    const titledRefs = nodeRefsWithTitle(content);

    if (isCli) {
      if (status !== 'completed') continue;
      if (callId) completedCallIds.add(callId);
      for (const ref of titledRefs) {
        if (ref.nodeId) byNodeId.set(ref.nodeId, { key: ref.nodeId, nodeId: ref.nodeId, tool, title: ref.title });
      }
      continue;
    }

    /** 官方 `f = TD(l)`。 */
    const plainIds = nodeRefIds(content);

    if (status === 'completed') {
      if (callId) completedCallIds.add(callId);
      if (titledRefs.length > 0) {
        for (const ref of titledRefs) {
          if (ref.nodeId) byNodeId.set(ref.nodeId, { key: ref.nodeId, nodeId: ref.nodeId, tool, title: ref.title });
        }
        continue;
      }
      for (const nodeId of plainIds) byNodeId.set(nodeId, { key: nodeId, nodeId, tool });
    } else {
      for (const nodeId of plainIds) {
        if (!byNodeId.has(nodeId)) byNodeId.set(nodeId, { key: nodeId, nodeId, tool });
      }
      if (callId && plainIds.length === 0) {
        pendingByCallId.set(callId, { key: `pending-${callId}`, nodeId: null, tool });
      }
    }
  }

  const chips = Array.from(byNodeId.values());
  for (const [callId, chip] of pendingByCallId) {
    if (!completedCallIds.has(callId)) chips.push(chip);
  }
  return chips;
}
