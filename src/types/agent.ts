/**
 * Agent 领域类型。
 *
 * 本文件只描述可持久化的任务状态，不包含 AbortController、窗口句柄等运行时对象。
 */

/**
 * 会话的「确认模式」——**官方只有两态**（`chatAdapter.confirmMode.{ask,auto}`）：
 *   · `collaborative` = 手动确认（官方 `ask`；写操作先请求确认）
 *   · `autonomous`    = Auto（官方 `auto`；自动执行）
 * ⚠️ MTV 原有的第三态 `plan`（只读规划）**官方没有** ⇒ 已删除。
 *   「只读子任务」改用显式的 `readOnly` 标志（见 `AgentTask.readOnly` / `AgentToolContext.readOnly`），
 *   不再借用会话模式表达。
 */
export type AgentMode = 'collaborative' | 'autonomous';

/**
 * Agent 工具的「能力分类」——Policy Engine 按它 + 模式决定放行 / 确认 / 拒绝。
 *
 * ★ 放在 `types/` 而不是 `services/chat/toolRegistry.ts`：可持久化的配置
 *   （`AppConfig.agentCapabilities`）要按它做键，而 `types` 不应反向依赖 `services`。
 *   `toolRegistry.ts` 仍然把它 re-export 出去，原来的 import 路径不受影响。
 */
export type AgentToolEffect =
  | 'read'
  /** 不改任何东西，但必须由用户作答；任何模式下都会弹卡片等待，不会自动执行 */
  | 'user_choice'
  | 'canvas_write'
  | 'file_write'
  | 'permanent_delete'
  | 'media_generation'
  | 'memory_write'
  | 'config_write'
  | 'asset_write';

export const AGENT_EXPERT_ROLES = [
  'canvas_structure',
  'workflow_risk',
  'asset_reuse',
] as const;

export type AgentExpertRole = typeof AGENT_EXPERT_ROLES[number];

export type AgentTaskStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'waiting_tool'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'stopped';

export type AgentStepStatus =
  | 'pending'
  | 'running'
  | 'waiting_approval'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'stopped';

export type AgentStepKind =
  | 'planning'
  | 'tool'
  | 'approval'
  | 'observation'
  | 'response';

export type AgentApprovalKind =
  | 'user_choice'
  | 'canvas_write'
  | 'file_write'
  | 'permanent_delete'
  | 'media_generation'
  | 'memory_write'
  | 'config_write'
  | 'asset_write';

export type AgentApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

/**
 * 任务终身上限：跨全部执行段累计。
 * 本改动之前持久化的任务不带这些字段，读取时用 resolveAgentLifetimeBudget 回退到默认值。
 */
export interface AgentTaskLifetimeBudget {
  maxTotalModelRounds: number;
  maxTotalToolCalls: number;
  /** 累计 input + output token 上限 */
  maxTotalTokens: number;
}

/** 单段执行预算；终身上限见 AgentTaskLifetimeBudget。 */
export interface AgentTaskBudget extends Partial<AgentTaskLifetimeBudget> {
  maxModelRounds: number;
  maxToolCalls: number;
  maxParallelReadTools: number;
  maxReadRetries: number;
}

export interface AgentTaskMetrics {
  inputTokens: number;
  outputTokens: number;
  modelDurationMs: number;
  toolDurationMs: number;
  policyAllowed: number;
  policyDenied: number;
  approvalCount: number;
  retryCount: number;
}

export const DEFAULT_AGENT_TASK_METRICS: AgentTaskMetrics = {
  inputTokens: 0,
  outputTokens: 0,
  modelDurationMs: 0,
  toolDurationMs: 0,
  policyAllowed: 0,
  policyDenied: 0,
  approvalCount: 0,
  retryCount: 0,
};

export type AgentEventType =
  | 'task_queued'
  | 'task_status'
  | 'model_round_start'
  | 'model_round_end'
  | 'tool_proposed'
  | 'policy_decision'
  | 'approval_resolved'
  | 'tool_start'
  | 'tool_end'
  | 'canvas_checkpoint';

export interface AgentEventData {
  status?: AgentTaskStatus | AgentStepStatus;
  toolId?: string;
  callId?: string;
  effect?: AgentApprovalKind | 'read';
  decision?: 'allow' | 'deny' | 'require_approval';
  approved?: boolean;
  errorCode?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  retryCount?: number;
  revisionBefore?: number;
  revisionAfter?: number;
  historyIndexBefore?: number;
  historyIndexAfter?: number;
}

export interface AgentEvent {
  id: string;
  taskId: string;
  sequence: number;
  type: AgentEventType;
  timestamp: number;
  data?: AgentEventData;
}

export interface AgentCanvasCheckpoint {
  revisionBefore: number;
  revisionAfter: number;
  historyIndexBefore: number;
  historyIndexAfter: number;
}

export const DEFAULT_AGENT_TASK_BUDGET: AgentTaskBudget & AgentTaskLifetimeBudget = {
  maxModelRounds: 12,
  maxToolCalls: 24,
  maxParallelReadTools: 3,
  maxReadRetries: 3,
  maxTotalModelRounds: 60,
  maxTotalToolCalls: 120,
  maxTotalTokens: 1_500_000,
};

export type AgentToolDisplayValue = string | number | boolean;

export interface AgentToolDisplayField {
  label: string;
  value: AgentToolDisplayValue;
  source?: 'user' | 'project_default' | 'model_default' | 'resolved';
}

export interface AgentToolDisplayReference {
  kind: 'node' | 'asset';
  id: string;
  label: string;
  mediaKind?: 'image' | 'video' | 'audio';
}

export interface AgentToolDisplayEntity {
  id?: string;
  title: string;
  subtitle?: string;
  fields?: AgentToolDisplayField[];
  preview?: string;
}

export interface AgentToolDisplayChange {
  targetId: string;
  targetLabel?: string;
  field: string;
  before?: AgentToolDisplayValue;
  after?: AgentToolDisplayValue;
}

/** 面向用户的脱敏工具快照；禁止保存原始任意 JSON、密钥、路径或媒体 URL。 */
export interface AgentToolDisplaySnapshot {
  fields?: AgentToolDisplayField[];
  references?: AgentToolDisplayReference[];
  entities?: AgentToolDisplayEntity[];
  changes?: AgentToolDisplayChange[];
  note?: string;
}

export interface AgentToolCallSnapshot {
  callId: string;
  toolId: string;
  inputSummary?: string;
  inputDisplay?: AgentToolDisplaySnapshot;
  retryCount: number;
  startedAt?: number;
  finishedAt?: number;
  resultSummary?: string;
  resultDisplay?: AgentToolDisplaySnapshot;
  errorCode?: string;
  effect?: AgentApprovalKind | 'read';
  /**
   * **官方卡片载荷通道**（「工具生产者」用）。
   *
   * 官方那些卡片读的是 `tool_event.content.request ?? content`：
   * `mre`(`ShowWidgetCard`) 读 `request.{title,widget_code,…}`、
   * `ure`(`ShowHtmlCard`) 读 `request.{title,description,artifact_path}`、
   * `nre`(`McpAppCard`) 读 `content.ui.resource_uri`。
   * 而 MTV 的 `stepToToolEvent` 恒会写一个 `request:{description,prompt}` ⇒ `?? content` 的兜底**永远不触发**
   * ⇒ 官方载荷必须并进 `content.request`。
   *
   * ⚠️ **只允许放官方 schema 里真实存在的字段**；这是给卡片用的结构化载荷，
   * **不是**「原始任意 JSON 的倾倒口」（`resultDisplay` 的脱敏纪律仍然成立）。
   * 目前**没有生产者**（MTV 没有 `show_widget`/`show_html`/`prepare_widget` 工具）—— 详见
   * `agent-挖掘覆盖表.md` §7.6 / §7.8。
   */
  officialRequest?: Record<string, unknown>;
  /**
   * **官方 `content.ui` 载荷通道**（mcpApp 卡用）。
   *
   * 官方 `$M` 的 `AD(e)` 判据是**结构**而非工具名：`content.ui.resource_uri` 非空字符串
   * （`mcpAppCard.isMcpAppEvent` 逐字复刻）。MTV 的 `stepToToolEvent` 产不出 `content.ui`
   * ⇒ 没有这个通道，`McpAppCard` 永远不可达。
   *
   * ⚠️ 与 `officialRequest` 同纪律：**只放官方 schema 里真实存在的字段**，不是原始 JSON 倾倒口。
   */
  officialUi?: Record<string, unknown>;
  /**
   * **官方 `tool_event.content.response` 载荷通道**（与 `officialRequest` 对称）。
   * `ask_question` 用它交 `{answers:[…]}` —— 官方 `Ioe`(`answerLabelsOf`) 读
   * `content.response.answers` 才能把「已答」的提问历史卡渲染出来。
   */
  officialResponse?: Record<string, unknown>;
  inputFingerprint?: string;
  canvasCheckpoint?: AgentCanvasCheckpoint;
}

/** 供用户勾选的候选模型；category 用于在卡片里分组。 */
export interface ProviderModelChoice {
  id: string;
  name: string;
  category: 'text' | 'image' | 'video' | 'audio';
}

export interface ProviderModelCatalogSummary {
  catalogId: string;
  total: number;
  categoryCounts: Record<ProviderModelChoice['category'], number>;
  expiresAt: number;
  maxSelection: number;
}

/**
 * 生成确认卡要展示的**真实**生成参数（字段名用官方 wire 名，读侧见
 * `generationConfirmationProtocol.ts` 的 `Sse`：`carrier.prompt` / `carrier.image.aspect_ratio` …）。
 *
 * 第 59 轮新增：此前 `AgentApprovalInputRequest.media_model` 只带 `mediaKind`
 * ⇒ 官方卡只有 requestKind、**没有提示词与参数**（卡片比官方少一整块）。
 * 这些值全部来自 `media_generate` 工具入参（真实数据，不是补的默认值）。
 */
export interface AgentGenerationRequestSnapshot {
  kind: 'image' | 'video' | 'audio';
  prompt: string;
  /**
   * 官方 `request_json.model_name`（读侧 `generationConfirmationProtocol.Sse` 读 `carrier.model_name`）。
   *
   * ⚠️ 第 63 轮：官方卡上的**模型 chip** 与**价格**都来自「服务端已指派的模型」；MTV 的等价物 =
   * `media_generate` 解析出的那个模型（`input.modelRef` → 项目默认模型 → 自主模式自动路由）。
   * **解析不到时不写**（那时卡片上不显示模型与价格，直到用户在审批里选完）——不编造模型。
   */
  modelName?: string;
  /** 官方 `aspect_ratio`。 */
  aspectRatio?: string;
  /** 官方 `image_size`（图片档位）。 */
  imageSize?: string;
  /** 官方 `resolution`（视频档位）。 */
  resolution?: string;
  /** 官方 `duration`（秒）。 */
  duration?: number;
  /** 官方 `times`（张数/条数）；MTV 一次生成一个 ⇒ 1。 */
  times?: number;
}

export type AgentApprovalInputRequest =
  | {
    kind: 'media_model';
    mediaKind: 'image' | 'video' | 'audio';
    selectedModelRef?: string;
    /** 生成确认卡的参数载荷（见 `AgentGenerationRequestSnapshot`）。 */
    generationRequest?: AgentGenerationRequestSnapshot;
  }
  | {
    /** 中转站接入：让用户从清单里勾选要接入哪几个模型 */
    kind: 'provider_models';
    /** 受限候选元数据快照供主/独立窗口展示；最终仍由宿主复核目录。 */
    options: ProviderModelChoice[];
    catalog?: ProviderModelCatalogSummary;
    maxSelection?: number;
  };

export interface AgentApprovalInputValues {
  modelRef?: string;
  selectedModelIds?: string[];
  /**
   * ★ 2026-10-15：**生成确认卡上三颗参数胶囊的落点**。
   *
   * 官方 `qet`（`GenerationConfirmationCard`）的 `onAnswer(confirmationId, action, modifications)`
   * 第三参是官方 `Mv` 编出来的 **wire 修改载荷**（`aspect_ratio` / `image_size` / `times` /
   * `resolution` …）；服务端 `gJe` 把它**逐字段叠回** `request_json` 再真正发请求。
   * MTV 没有服务端 ⇒ 这里就是那个「叠回」的携带面：卡 → `confirmationAnswerResolution` →
   * `resolveApprovalSelection` → `media_generate` 的有效入参 → `runMediaGeneration`。
   * 字段名用 **camelCase**（= 工具入参名），wire 名的翻译在 `confirmationAnswerResolution` 里做。
   */
  aspectRatio?: string;
  imageSize?: string;
  resolution?: string;
  duration?: number;
  /** 张数（官方 `1×/2×/4×`）。图片侧 `media_generate` 入参有此键。 */
  times?: number;
}

export interface AgentApprovalResolution {
  approved: boolean;
  inputValues?: AgentApprovalInputValues;
}

export interface AgentApprovalSnapshot {
  id: string;
  kind: AgentApprovalKind;
  status: AgentApprovalStatus;
  summary: string;
  requestedAt: number;
  resolvedAt?: number;
  inputRequest?: AgentApprovalInputRequest;
}

export interface AgentStep {
  id: string;
  taskId: string;
  index: number;
  kind: AgentStepKind;
  title: string;
  status: AgentStepStatus;
  createdAt: number;
  updatedAt: number;
  toolCall?: AgentToolCallSnapshot;
  approval?: AgentApprovalSnapshot;
  outputSummary?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * 用户显式引用 Skill 在任务创建时形成的不可变快照。
 * 任务恢复时只读取该快照，避免全局 Skill 的后续编辑或删除改变既有任务语义。
 */
export interface AgentSkillBinding {
  skillId: string;
  name: string;
  version?: string;
  content: string;
  origin?: 'user' | 'agent-package';
  packageId?: string;
  packageName?: string;
  packageVersion?: string;
  entryPath?: string;
  contentHash?: string;
  /** 存在时只能缩小任务可见工具集合；空数组表示该 Skill 不允许任何工具。 */
  allowedTools?: string[];
}

export interface AgentTask {
  id: string;
  projectId: string;
  conversationId: string;
  userMessageId: string;
  mode: AgentMode;
  /** 只读子任务（子智能体 / 专家任务）：注册表与 Policy 只放行 `read`。 */
  readOnly?: boolean;
  goal: string;
  status: AgentTaskStatus;
  steps: AgentStep[];
  currentStepId?: string;
  modelRounds: number;
  toolCallCount: number;
  budget: AgentTaskBudget;
  /** 任务创建时由用户显式引用的 Skill 计算，只能缩小 Registry 可见集合。 */
  toolAllowlist?: string[];
  /** 任务创建时固定的显式 Skill 内容；undefined 仅用于兼容旧任务。 */
  skillBindings?: AgentSkillBinding[];
  /** 只读专家任务的父任务；存在时嵌套深度固定为 1。 */
  parentTaskId?: string;
  expertRole?: AgentExpertRole;
  expertDepth?: 1;
  resultSummary?: string;
  events?: AgentEvent[];
  metrics?: AgentTaskMetrics;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  errorCode?: string;
  errorMessage?: string;
}

export const AGENT_TERMINAL_STATUSES = new Set<AgentTaskStatus>([
  'completed',
  'failed',
  'stopped',
]);

/** 应用重启时视为「被中断」的状态集合（这些任务会收敛为 failed，不再有 paused 停放态）。 */
export const AGENT_RESTART_INTERRUPT_STATUSES = new Set<AgentTaskStatus>([
  'queued',
  'planning',
  'running',
  'waiting_tool',
  'waiting_approval',
]);
