/**
 * Chat 类型定义 — 对话助手相关的 CommandId、Selector AST、CommandIntent、
 * CommandPlan、CommandResult、ChatMessage、ChatConversation 等核心类型
 */
import type { AgentMode, ProviderModelCatalogSummary } from './agent';

import type { NodeType } from './index';
import type {
  CanvasMaterializationStatus,
  MediaGenerationResult,
  MediaGenerationStatus,
} from './media';

// ============================================
// 命令 ID
// ============================================

export type CommandId =
  | 'query'
  | 'select'
  | 'deleteNodes'
  | 'undo'
  | 'redo'
  | 'connect'
  | 'groupByType'
  | 'translatePrompt'
  | 'regenerate'
  | 'describe'
  | 'cancelTask';

// ============================================
// Selector AST — 目标选择器
// ============================================

export type NodeSelector =
  | { op: 'selected' }
  | { op: 'displayId'; value: number }
  | { op: 'type'; value: NodeType }
  | { op: 'status'; value: 'idle' | 'loading' | 'success' | 'error' }
  | { op: 'and'; items: NodeSelector[] }
  | { op: 'or'; items: NodeSelector[] }
  | { op: 'not'; item: NodeSelector };

// ============================================
// CommandIntent — AI/规则引擎产出的意图
// ============================================

export interface CommandIntent {
  commandId: CommandId;
  selector?: NodeSelector;
  params?: unknown;
  parseSource: 'rule' | 'llm';
  confidence: number;
}

// ============================================
// CommandPlan — 规划器生成的执行计划
// ============================================

export interface CommandPlan<TParams = unknown> {
  id: string;
  projectId: string;
  baseRevision: number;
  commandId: CommandId;
  targetNodeIds: string[];
  params: TParams;
  summary: string;
  risk: 'read' | 'low' | 'destructive' | 'external';
  requiresConfirm: boolean;
  externalDataDisclosure?: ExternalDataDisclosure;
}

export interface ExternalDataDisclosure {
  modelId?: string;
  providerName?: string;
  fieldsSent: string[];
  mediaSent: boolean;
  estimatedCost: string;
}

// ============================================
// CommandResult — 命令执行结果
// ============================================

export interface CommandResult {
  planId: string;
  status: 'success' | 'partial' | 'rejected' | 'failed';
  affectedNodeIds: string[];
  message: string;
  errorCode?: string;
  historyIndex?: number;
}

// ============================================
// 流事件协议
// ============================================

export type StreamPhase = 'connecting' | 'responding' | 'planning';
export type FinishReason = 'stop' | 'length' | 'canceled' | 'error';

export type AssistantStreamEvent =
  | { type: 'start'; requestId: string; modelId: string }
  | { type: 'text.delta'; delta: string }
  /**
   * **思考通道**（推理/thinking 增量）——官方 `contents` 里与 `text` **并列**的 `thinking` item。
   *
   * 官方产物取证（第 75 轮，`vendor-packages-DRvCmDjR.js`，charIdx = JS 字符串下标）：
   * - 官方客户端**没有**「把 provider 的推理字段分流进正文」这一步：它读的是**自己服务端**的
   *   SSE 事件名（@715043 `hG = new Set(["initial","thinking","thinking_activity","content","title",
   *   "tool_event","subagent_event","task_snapshot","agent_session","compact","agent_result",
   *   "context_usage","usage","artifact_updated","3d_scene_update"])`），
   *   并在 @717549 逐字分派：`else if(p==="thinking") t.onThinking(b);`（`b` = 该事件的 **data 原文**，
   *   不 JSON.parse）、`else if(p==="thinking_activity"){…t.onThinkingActivity?.(E)}`、
   *   `else if(p==="content") t.onContent(b)`。
   * - 写入口逐字（`vendor-pkg-canvas-CvbAwZyy.js` @42429）
   *   `appendMessageThinkingChunk:(n,o,r)=>({…contents:[…d,{type:"thinking",content:p+o}]})`，
   *   与 `appendMessageTextChunk` 的 `{type:"text",content:…}` **同形但不同 type** ⇒
   *   官方把推理当**独立 item**，**不**并入正文。
   * - 消费端逐字（同 bundle @2746999）：`onThinking:Xe=>{…l.appendMessageThinkingChunk(yt(),Xe,ie)}`、
   *   `onContent:Xe=>{…Xe.trim()&&l.markRunActivity("content",ie),…l.appendMessageTextChunk(yt(),Xe,ie)}`。
   * - 官方全产物（9 个 JS，含 4,570,188 字符的 `vendor-pkg-canvas-CvbAwZyy.js`）搜
   *   `reasoning_content` / `reasoning_details` / `thinking_delta` / `redacted_thinking` = **0 命中**；
   *   `"reasoning"` 只作为 **i18n 命名空间**出现（`"reasoning":{"thoughtSeconds_one":…}`，@3615842 等 5 处）。
   *
   * ⇒ MTV 是**客户端直连 provider**（没有官方那层服务端归一化），所以本事件是 MTV 侧的
   *   等价物：协议层把 provider 的推理字段分流到这条事件，语义与官方 `event:thinking` 一致 ——
   *   **只进 thinking 通道，绝不当正文**（`delta` 不累加进 `fullContent`）。
   */
  | { type: 'thinking.delta'; delta: string }
  | { type: 'status'; phase: StreamPhase; message?: string }
  | { type: 'conversation.title'; title: string }
  | { type: 'tool.call.delta'; callId: string; delta: string }
  | { type: 'tool.call.final'; call: ProposedToolCall }
  | { type: 'tool.result'; result: ToolResultSummary }
  | { type: 'intent.final'; intents: CommandIntent[] }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'error'; code: string; message: string; retryable: boolean }
  | { type: 'done'; finishReason: FinishReason };

// ============================================
// 工具调用（P1）
// ============================================

export interface ProposedToolCall {
  callId: string;
  toolId: string;
  input: unknown;
}

export interface ToolResultSummary {
  callId: string;
  toolId: string;
  status: 'success' | 'error' | 'denied';
  summary: string;
  truncated: boolean;
  sources?: WebSource[];
}

export interface WebSource {
  id: string;
  citationId?: string;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
  fetchedAt: number;
  sourceType: 'search' | 'page';
  /** 官方来源对象里的 `favicon`（缺省时官方回落 Google s2 服务，见 `WebSearchSourceDisplay`）。 */
  favicon?: string;
  /** 官方来源对象里的 `image`（结果预览大图；缺省时卡片显示 favicon）。 */
  image?: string;
}

/** 读取完整性只描述本次有界读取，不代表整站内容已遍历完毕。 */
export type WebReadIssue =
  | 'page_limit' | 'body_limit' | 'text_limit' | 'timeout'
  | 'navigation_failed' | 'duplicate_page' | 'empty_page' | 'render_failed'
  | 'catalog_fallback';

export interface WebReadStatus {
  readMethod: 'static' | 'rendered' | 'catalog';
  complete: boolean;
  issues: WebReadIssue[];
}

/** 以下正文类型仅用于瞬时读取，不能挂到消息、任务摘要或其他持久化类型上。 */
export interface NativeWebReadPage {
  url: string;
  title?: string | null;
  contentType: string;
  body: string;
  truncated?: boolean;
}

export interface NativeWebReadResponse {
  url: string;
  contentType: string;
  /** 旧版本或静态读取的单页正文；新动态响应通过 pages 返回，不重复拼接正文。 */
  body: string;
  fetchedAt: number;
  pages?: NativeWebReadPage[];
  readMethod?: 'static' | 'rendered';
  complete?: boolean;
  issues?: WebReadIssue[];
}

export interface WebPageLink {
  title: string;
  url: string;
}

export interface WebReadPage {
  source: WebSource;
  text: string;
  links: WebPageLink[];
  truncated: boolean;
}

/** 宿主提供的读取作用域，不能由工具输入指定。 */
export interface WebReadAccessScope {
  projectId: string;
  conversationId: string;
  taskId: string;
}

export interface WebReadSection {
  id: string;
  title: string;
  offset: number;
  url: string;
}

/** 完整正文仅供有界内存快照使用，不可持久化。 */
export interface WebReadDocument extends WebReadStatus {
  pages: WebReadPage[];
  catalog?: ProviderModelCatalogSummary;
}

export interface WebReadContinuation {
  readSessionId?: string;
  cursor?: string;
  offset?: number;
  section?: string;
}

export interface WebPageResult extends WebReadStatus {
  /** 与旧调用方兼容，始终指向第一份有效正文的来源。 */
  source: WebSource;
  pages: WebReadPage[];
  text: string;
  truncated: boolean;
  links: WebPageLink[];
  readSessionId?: string;
  nextCursor?: string;
  nextOffset?: number;
  totalTextChars?: number;
  sections?: WebReadSection[];
  catalog?: ProviderModelCatalogSummary;
}

// ============================================
// 聊天消息状态
// ============================================

export type ChatMessageStatus =
  | 'queued'
  | 'parsing'
  | 'streaming'
  /* 官方**全部**产物中 `clarifying` / `clarify` / `awaiting_user` / `requires_user_input` 均
     **0 次命中**（`vendor-pkg-canvas-CvbAwZyy.js` 等逐一全量枚举，逐字节）；MTV 全库也只有这里
     一个定义点、无任何生产者 ⇒ 已删除（死枚举）。 */
  | 'preview'
  | 'executing'
  | 'done'
  | 'partial'
  | 'interrupted'
  | 'error'
  | 'canceled';

// ============================================
// 聊天消息
// ============================================

/** 输入卡附件（官方 `ContextStrip` 里 `OG`/`tp` 读的 `attachment`）：
 *  官方字段是 `{ type, src, fileId?, mimeType?, thumbnailUrl? }`，类型域为 image/video/audio/file。 */
export interface ChatAttachment {
  src: string;
  type: 'image' | 'video' | 'audio' | 'file';
  name?: string;
  mimeType?: string;
  /** 视频缩略图（官方 `Je(src, THUMBNAIL)`）。 */
  thumbnailUrl?: string;
}

/** 单个模型的「思考」设置（官方 `chatModelThinkingSettings` 的 value）。
 *  官方校验 `Ehe`：`enabled` 必须是 boolean，`level` 若存在必须是 string。 */
export interface ChatModelThinkingSetting {
  enabled: boolean;
  level?: string;
}

/** 官方 `chatModelThinkingSettings`：**按模型 id** 存思考档位，落 localStorage
 *  `tap:agent_chat_thinking_settings:v1`（`course-api-base-url-*.js`@192076 `d6`）。 */
export type ChatModelThinkingSettings = Record<string, ChatModelThinkingSetting>;

/** 官方 `ask_question` 的单题答案（上行 / 收集用）。 */
export interface AskQuestionAnswer {
  question_id?: string;
  selected_labels?: string[];
  free_text?: string;
}

/**
 * 官方会话状态 `pendingQuestion`（session store；初始形状偏移 28409，写入点 2696365）：
 * ```js
 * setPendingQuestion({ toolUseId, questionId, questions: jM(event), status: "pending" })
 * ```
 * `status` 取值：`"pending"` / `"answered"` / `"cancelled"`（失败时官方直接 `clearPendingQuestion`）。
 */
export interface PendingAskQuestion {
  toolUseId: string;
  questionId?: string;
  /**
   * **这条提问属于哪个会话**（官方 `pendingQuestion` 是 **per-session** 的）。
   *
   * 官方 store 形状是 `sessions: { [sessionId]: { …, pendingQuestion, multiSelectDraft, … } }`，
   * 所有读写都带 sessionId：`setPendingQuestion(n, o)` / `clearPendingQuestion(n)` /
   * `updatePendingQuestionStatus(n, o, r)` / `getSessionState(ce).pendingQuestion`
   * （`vendor-pkg-canvas-ChpWx5JY.js` @32655 邻域 / @43274 / @2696503 / @2716950）。
   * ⚠️ MTV 的 store 是「一个活动会话 + 一个全局 `pendingQuestion` 字段」⇒ 必须自带会话戳，
   * 否则 A 会话的提问面板会跟着用户跑到 B 会话上去（MTV 侧真 bug）。
   * 消费者一律要求 `pendingQuestion.conversationId === activeConversationId`，
   * 语义上等价于官方的 `getSessionState(activeSessionId).pendingQuestion`。
   */
  conversationId?: string;
  /** 官方 `jM(event)` 归一化后的题目。 */
  questions: import('../services/chat/askQuestion').AskQuestion[];
  status: 'pending' | 'answered' | 'cancelled' | string;
  /** 官方 `collectedAnswers`：`goPrev` 会把已答结果写回这里。 */
  collectedAnswers?: (AskQuestionAnswer | null)[];
  /** 官方 `step`：当前题号（从 0 起）。 */
  step?: number;
  /** 官方 `selectedAnswers`（`updatePendingQuestionStatus` 的第二个参数）。 */
  selectedAnswers?: AskQuestionAnswer[];
}

/** 排队中的一条消息（官方 `queuedMessages` 元素）。
 *  官方形状 = `{id, text, attachments?, contextNodeIds?, quotedText?}`（`page-BeI7xydN.js`@907446
 *  的 `QueuedMessagesBar` / `yue`）；MTV 只存 `id` + `text`，附件/引用上下文仍走发送时的 store 切片。 */
export interface QueuedChatMessage {
  id: string;
  text: string;
  /**
   * 官方排队消息的完整载荷（`u(U.contextNodeIds…)` / `p(U.quotedText)` / `U.attachments`）：
   * 点「编辑」时官方会把 `text + attachments + contextNodeIds + quotedText` **全部**搬回输入框；
   * 只搬 text 会丢掉附件与引用。
   */
  attachments?: ChatAttachment[];
  contextNodeIds?: string[];
  quotedText?: string;
}

/** 官方模型目录里的 `thinking` 元数据（服务端 `textModels` 条目字段）。
 *  `levels` 为档位 code 列表；`default` 给默认档；`can_disable:false` ⇒ 不许关思考；
 *  `switchable` 官方仅用于列表展示，控件本身用 `levels.length > 1` 判断。
 *  ⚠️ MTV 的本地模型目录暂无该字段 ⇒ 选择器控件走**官方逐字档位词汇表兜底**
 *  （`configuredModelThinking.officialFallbackThinkingMeta()`，★ 唯一偏离官方处：官方这里不渲染 ★）。 */
export interface ModelThinkingMeta {
  levels?: string[];
  default?: { enabled?: boolean; level?: string | null };
  can_disable?: boolean;
  switchable?: boolean;
  /** 官方 `thinkingLevel.wireField`：线上字段名（未设 ⇒ `thinking_level`）。 */
  wireField?: string;
  /** 官方 `thinkingLevel.wireCase`：线上大小写（未设 ⇒ `upper`）。 */
  wireCase?: 'upper' | 'lower';
  /** 官方 `thinkingLevel.labels`：档位 code → i18n 键（例 `textModels.thinkingLevel.deepseekOff`）。 */
  labels?: Record<string, string>;
}

/** 官方模型目录里的「能力评分」（`uu` 的 `dl` 列表：速度 / 智能 / 花费，1..5）。 */
export interface ModelCapabilityScores {
  speed?: number;
  intelligence?: number;
  cost?: number;
}

/* ── 任务 / 待办（官方 `todowrite` 与 `task_snapshot` 的等价物）──
   逻辑层在 `services/chat/todoTasks.ts`（官方 `An`/`Nx`/`Mx`/`Ex`/`Ix` 逐字）；
   类型放这里，避免 `types` ⇄ `services` 循环引用。 */

/** 一条待办。 */
export interface TodoItem {
  content: string;
  status?: string;
  activeForm?: string;
  taskId?: string;
  description?: string;
  blocks?: string[];
  blockedBy?: string[];
}

/** 官方 `Nx` 的产物。 */
export interface TodoProgress {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

/** 官方 `xI` 的产物：todoQueue 胶囊与任务历史卡的共同输入。 */
export interface TodoSnapshot {
  items: TodoItem[];
  progress: TodoProgress;
  digest: string;
  allCompleted: boolean;
}

export interface ChatMessage {  id: string;
  /** 所属会话 ID */
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status: ChatMessageStatus;
  /** AI 请求 ID（assistant 消息使用） */
  requestId?: string;
  /* ── 官方 `bZ` 产出的两个 content part 的 MTV 等价物 ──
     官方 `bZ({brainstormPrefix, contextNodeIds, quotedText, rawInput, sourceInput})` 返回
     `[{type:'context_nodes', content:{node_ids}}, {type:'text', content}]`：
       · `text` 的拼法已按官方逐字做进 `content`（引用文本 = `> {quotedText}\n\n{输入}`）；
       · `context_nodes` 是**独立的结构化 part**，MTV 的 `ChatMessage.content` 是纯字符串装不下，
         这里按等价语义挂在消息上；附件同理。 */
  contextNodeIds?: string[];
  attachments?: ChatAttachment[];
  /** 官方 `onMessageFeedback` 落下来的评价（`'up' | 'down' | null`，可反复切换）。 */
  feedback?: 'up' | 'down' | null;
  /** 关联的 Agent 任务，用于时间线和后台状态恢复。 */
  agentTaskId?: string;
  /** 使用的模型 ID */
  modelId?: string;
  /** 关联的解析指令 */
  commands?: CommandIntent[];
  /** 执行结果 */
  executionResults?: CommandResult[];
  /** 流结束原因 */
  finishReason?: FinishReason;
  /** 媒体生成与文本回答使用独立状态，避免互相覆盖。 */
  mediaStatus?: MediaGenerationStatus;
  mediaError?: string;
  /**
   * **MTV 特有的异步轮询「运维提示」**（官方**没有任何对应物**）。
   *
   * 与 `mediaError` 的**分工**（刻意分开，不是白名单漏字段）：
   *   · `mediaError` —— 普通**生成失败**的原始报错。渲染层按官方
   *     `chatAdapter.agentEvent.toolDescriptions.{gen_image,gen_video}.failed_one`
   *     文案族显示（见 `services/chat/mediaErrorMessage.ts`），**不**再拼成 MTV 自造的
   *     「媒体生成失败：<原始报错>」（该句式在 4 个官方产物里命中数 = 0）。
   *   · `mediaNotice` —— RunningHub / 工作流查询那套**「任务已保留 / 请到平台核对」**提示。
   *     这些提示的作用是**防止用户重复发起已经付费的生成**（真金白银的重复扣费风险），
   *     官方没有这套异步保留语义 ⇒ 保留文案，但**不塞进官方那两条错误句式里冒充官方 UI**，
   *     改用 MTV 既有的 `c-msg__state--warning` 行承载。
   *     生产者：`services/pollManager.ts`（1009 / 1032 / 1186 邻域）与
   *     `services/chat/tools/{mediaTools,comfyTools}.ts` 的「已停止跟踪 / 已终止」分支。
   *
   * 报告里登记为「MTV 适配点（授权偏离）」。
   */
  mediaNotice?: string;
  mediaResult?: MediaGenerationResult;
  canvasStatus?: CanvasMaterializationStatus;
  canvasNodeId?: string;
  canvasError?: string;
  /** 联网工具返回的可追溯来源；不包含网页正文。 */
  sources?: WebSource[];
  /** 官方 `task_snapshot` item 的 MTV 等价物（todoQueue 胶囊的数据源）。
   *  ⚠️ 目前**没有生产者**：MTV 的 Agent 没有 `todowrite` 工具，工具快照也禁止保存原始 JSON ⇒
   *  胶囊不显示（与官方「没有待办就不显示」一致）。见 `DEEPSEEK/Agent-面板结构-官方对照.md` §9 / §18。 */
  todoSnapshot?: TodoSnapshot | null;
  /**
   * 官方 `compact` item（`{type:"compact", content:{phase}}`）的 MTV 等价物 ——**生产者**在
   * `contextCompressionService.compressConversationContext()`：自动压缩成功后，把**被折进摘要的最后一条消息**
   * 打上这个时间戳，渲染层据此在该条消息处显示官方 `Tie`(`CompactLifecycleLine`)。
   *
   * 官方 `$M`（@2426911 逐字）：`if(e.type==="compact"){ const C=e.content?.phase??"started";
   *   return s.jsx(Tie,{phase:C,isStreaming:t}) }`。
   * ⚠️ 官方把它作为**消息 contents 里的一个 item**；MTV 没有消息级 contents ⇒ 用这个字段承载
   * 「此处发生过压缩」这一事实（与其它族的近似口径一致）。
   */
  compactedAt?: number;
  /**
   * 官方消息体模型 `contents: Item[]`（覆盖表 §6 #1）。**可选**：旧记录没有该字段，渲染层
   * 缺省时回落到 `messageContents.buildMessageContents(...)` 现场生产同一份有序列表。
   *
   * 官方 `Z0`/`$M`（`vendor-pkg-canvas-ChpWx5JY.js` @2425467 / @2614935）**按数组顺序逐项分派**；
   * MTV 的元素类型直接复用官方的 `OfficialAgentContentItem` 联合（`agentMessageContents.ts`），
   * 不另立一套形状。
   *
   * ⚠️ 与官方的一处诚实偏移：官方 `contents` 里有 `text` / `tool_event` / `subagent` / `compact` /
   * `task_snapshot` / `agent_error` … 但**没有**「已被用户停止」的 item —— 官方那条分割线（`Fit`）
   * 是**消息列表级**的（@2629518：`N?.includes(Y.id) && !(Y.id === k && o !== "idle") && s.jsx(Fit,{})`），
   * 全 bundle 的 `"stopped"` 只出现在**子代理 status** 与文案里（`KW` @20850、`$ge` @21980、`pit` @2596877）。
   */
  contents?: import('../services/chat/agentMessageContents').AgentMessageContentItem[];
  /**
   * **中途正文 item 的落库位**（官方 `contents` 里的多个 `text` item）。
   *
   * 官方流式协议把每一段正文 chunk 按**到达顺序**追加成独立的 `text` item（`yxe` 写入口）；
   * 工具事件之间的「中途说明」（例如「我会先读这次更新的剧本文本…」）因此是一个**独立的 item**，
   * 并在 `absorbTextInRange` 时被官方一起收进折叠面板（用户实测 图8）。
   *
   * MTV 的 `content` 只有**一个最终正文字符串**（流式 delta 全被拼进去）⇒ 中途正文的
   * 「到达位置」这一信息原先完全丢失。这里按 delta 到达时刻记录成 item 列表：
   * `startedAt` = 该段正文**开始到达**的墙钟时间，与工具事件的 `startedAt` 同轴，
   * 于是渲染层能把它们按官方语义交错/吸收。
   *
   * ⚠️ 与 `contents` 的分工：`contents` 是**完整**列表的落库位（官方历史导入那条路会写它，
   * 含 `tool_event`）；`textItems` 只承载**流式正文分段**这一件事。两者同时存在时
   * `contents` 优先（它是权威列表）。
   */
  textItems?: ChatMessageTextItem[];
  /**
   * **思考 item 的落库位**（官方 `contents` 里的 `thinking` item）。
   *
   * 官方流式协议把推理 chunk 按到达顺序追加成 `{type:"thinking",content,startedAt}` item
   * （`appendMessageThinkingChunk`，`vendor-pkg-canvas-CvbAwZyy.js` @42429），与 `text` item
   * **并列**、**不合并进正文**。MTV 侧生产者是 `conversationExecutionController` 的
   * `StreamingMessageBuffer.appendThinking`（由 `AssistantStreamEvent.thinking.delta` 驱动）。
   *
   * ⚠️ 与 `textItems` 的一处**刻意差异**：`textItems` 与 `content` 是**同一份数据**（拼接关系），
   * 所以 `buildMessageContents` 给了 `textItems` 就不再产 `content` item；`thinkingItems` 与
   * `content` **无关**（推理永远不是正文）⇒ 两者都会各自成为 item。
   */
  thinkingItems?: ChatMessageThinkingItem[];
  /**
   * **官方 `agent_error` item 的文案落库位**（`{type:"agent_error", content}` 的 `content`）。
   *
   * 官方写入口是 `appendMessageContent(id, {type:"agent_error", content}, sessionId)`
   * （`@41087` 逐字：`contents:[...(c.contents||[]), o]` ⇒ 追加）与若干
   * `updateMessage(id, {contents:[{type:"agent_error", content}]})`（整体替换）。官方渲染层
   * `$M`（@2466855 逐字）对 `agent_error` 是 **`return s.jsx(Qrt, …)`** —— **全 bundle 只有
   * 这一条**错误横幅渲染路径（`data-testid="agent-error-banner"` 命中数 = 1）。
   *
   * ⚠️ 为什么是独立字段而不是 `contents`：MTV 的报错发生在**流式过程中**，此时消息已有正文 /
   * 工具事件；直接写 `contents` 会命中「**完全接管**」语义而丢掉那些项（见下 `contents` 注释）。
   * ⇒ 这里只存**文案**，由 `messageContents.buildMessageContents` / `ensureAgentErrorContent`
   * 在渲染层把它装配成官方 `agent_error` item，落位与官方 `appendMessageContent` 一致（列表末尾）。
   *
   * ⚠️ 文案**必须在写入时就已经是最终形态**（真实报错原文，或官方 i18n 兜底句）；
   * 官方 `Jct`（@2713029）在写入前做这件事，**从不加任何前缀**。
   */
  agentError?: string;
}

/** 官方 `contents` 里的一个 `thinking` item（MTV 侧的落库形状，逐字对应官方写入口字段）。 */
export interface ChatMessageThinkingItem {
  content: string;
  /** 该段思考**开始到达**的时间（与工具事件 `startedAt` 同轴）。 */
  startedAt: number;
}

/** 官方 `contents` 里的一个 `text` item（MTV 侧的落库形状）。 */
export interface ChatMessageTextItem {
  content: string;
  /** 该段正文**开始到达**的时间（与工具事件 `startedAt` 同轴）。 */
  startedAt: number;
}

// ============================================
// 持久化消息
// ============================================

export interface PersistedChatMessage {
  id: string;
  projectId: string;
  conversationId: string;
  sequence: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: ChatMessageStatus;
  requestId?: string;
  agentTaskId?: string;
  modelId?: string;
  createdAt: number;
  updatedAt: number;
  finishReason?: FinishReason;
  commands?: CommandIntent[];
  executionResults?: CommandResult[];
  mediaStatus?: MediaGenerationStatus;
  mediaError?: string;
  mediaResult?: MediaGenerationResult;
  canvasStatus?: CanvasMaterializationStatus;
  canvasNodeId?: string;
  canvasError?: string;
  sources?: WebSource[];
  /** 官方 `agent_error` item 的文案（见 `ChatMessage.agentError`）。 */
  agentError?: string;
  /** MTV 运维提示原文（见 `ChatMessage.mediaNotice`）。 */
  mediaNotice?: string;
}

// ============================================
// 会话
// ============================================

/**
 * 会话上下文压缩摘要（P3-D1）。
 * 只影响发送给模型的上下文组装，不删除原始消息。
 */
export interface ConversationContextSummary {
  /** 摘要正文；需保留目标、约束、决定、未完成计划、节点 ID、工具来源和失败原因 */
  text: string;
  /** 已被摘要覆盖的最后一条消息 ID */
  coveredUntilMessageId: string;
  /** 已被摘要覆盖的最后一条消息时间戳；组装时早于等于该时间的消息用摘要替代 */
  coveredUntilTimestamp: number;
  /** 被摘要覆盖的消息条数 */
  coveredMessageCount: number;
  /** 摘要自身的估算 token 数 */
  estimatedTokens: number;
  updatedAt: number;
  /** P4 结构化摘要格式版本；旧摘要缺省时按 v1 读取。 */
  formatVersion?: 2;
}

export interface ChatConversation {
  id: string;
  projectId: string;
  title: string;
  /** 标题来源：auto=自动生成，user=用户手动命名 */
  titleSource: 'auto' | 'user';
  pinned: boolean;
  archived: boolean;
  /** 当前会话的 Agent 自治模式；旧会话读取时回填 collaborative。 */
  agentMode: AgentMode;
  /**
   * 官方「头脑风暴」（`addMenu.brainstorm`）：会话级开关。
   * 开启后助手被要求持续维护一份 `brainstorm.md`（本地存 IndexedDB），
   * 面板（官方头部第 1 颗 sidePanel）按小节展示/编辑它。
   */
  brainstormMode?: boolean;
  /** 上下文压缩摘要；不存在表示尚未压缩过 */
  contextSummary?: ConversationContextSummary;
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  /** 最近一条消息预览文本 */
  lastMessagePreview?: string;
  messageCount: number;
  /** 软删除时间戳，存在则在回收站中 */
  deletedAt?: number;
}

// ============================================
// 操作日志
// ============================================

export interface OperationLog {
  id: string;
  projectId: string;
  conversationId: string;
  timestamp: number;
  /** 命令 ID */
  commandId: CommandId;
  /** 人类可读摘要 */
  summary: string;
  /** 受影响的节点 */
  targetNodeIds: string[];
  /** 解析来源 */
  parseSource: 'rule' | 'llm';
  /** AI 请求 ID（如果有） */
  requestId?: string;
  /** 模型 ID */
  modelId?: string;
  /** 执行结果 */
  status: 'success' | 'partial' | 'failed';
  /** 对应历史索引 */
  historyIndex?: number;
  /** 是否仍可撤销 */
  undoable: boolean;
  /** 耗时毫秒 */
  duration?: number;
  /** 错误码 */
  errorCode?: string;
}

// ============================================
// 上下文脱敏
// ============================================

export interface CanvasNodeSummary {
  id: string;
  type: NodeType;
  status: 'idle' | 'loading' | 'success' | 'error';
  displayId?: number;
  selected: boolean;
}

export interface CanvasContext {
  projectId: string;
  totalNodes: number;
  totalEdges: number;
  selectedNodeIds: string[];
  nodes: CanvasNodeSummary[];
}

// ============================================
// Store revision 模式
// ============================================

/** Revision 计数模式 */
export type RevisionScope = 'project' | 'global';
