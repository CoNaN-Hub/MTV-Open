/**
 * Agent 工具的注册、可用性过滤与本地 schema 校验中心；实际权限仍由 Policy Engine 决定。
 */
import type { AgentMode, AgentToolDisplaySnapshot, AgentToolEffect } from '../../types/agent';
import type { ProposedToolCall, ToolResultSummary, WebSource } from '../../types/chat';
import type { McpContent } from '../../types/mcp';
import {
  validateAgentToolInput,
  type AgentToolSchema,
} from './agentToolSchemas';

/** `AgentToolEffect` 的定义已搬到 `types/agent.ts`（本机配置要按它做键）；这里保持原 import 路径可用。 */
export type { AgentToolEffect };

/**
 * **工具内部子步骤上报**（一个工具调用 → 多条官方 `tool_event` 行）。
 *
 * 官方证据（`live-assets\vendor-pkg-canvas-ChpWx5JY.js`）：
 *   · 官方**没有**「子步骤」这个模型 —— 「确认选项 / 提交生成」这些行在官方是**服务端**分别发出的
 *     独立 `tool_event`（`Gge` @21175 生产），客户端只是按 `content.tool` + `request.description`
 *     渲染（`Mae` 邻域 → 本仓 `agentToolLabels.commandDescriptionOf`）。
 *   · `live-assets-new\vendor-pkg-canvas-CvbAwZyy.js` @2433961 `sk=e=>NP(e)?"search":"activity"`、
 *     @2433993 `CO`（连续同 `jE` 分桶）、@2434136 `Cae`（`exe`+`CO`）⇒ 一个桶 = 一行 `ik`（@2448014）；
 *     桶内每一项在展开后的 `hie`（本仓 `ToolActivityDetailList`）里**各自一行**。
 * ⇒ MTV 侧**官方未建模**（没有服务端发工具事件）⇒ 按 MTV 现有 `AgentStep` 机制等价表达：
 *   工具在自己**真实执行到的阶段边界**上追加 `AgentStep`（`agentRoundExecutor.appendStep`），
 *   不伪造、不预生成、结束后不改写已有步骤。
 */
export interface AgentToolSubStepInput {
  /** 步骤标题 ⇒ `tool_event.content.request.description`（官方工具行文案就取这里）。 */
  title: string;
  /** 这次子步骤实际做了什么（`content.request.prompt`，脱敏前原文，执行器会脱敏）。 */
  inputSummary?: string;
  /** 参数详情快照（与 `AgentToolCallSnapshot.inputDisplay` 同形；不传则只渲染标题）。 */
  inputDisplay?: AgentToolDisplaySnapshot;
  /** 覆盖 `content.tool`（官方工具名）；缺省沿用父步骤的工具 id。 */
  toolId?: string;
}

/** 一条已追加到任务里的子步骤句柄：只在**真实阶段结束时**调 `finish` 一次。 */
export interface AgentToolSubStepHandle {
  readonly stepId: string;
  /** 收尾：写真实状态与结束时间（`succeeded` / `failed` / `stopped`）。 */
  finish(status?: 'succeeded' | 'failed' | 'stopped', outputSummary?: string): void;
}

/** 执行器注入给工具的「追加子步骤」能力（未注入 ⇒ 工具不得假设它能上报）。 */
export type AgentToolReportStep = (input: AgentToolSubStepInput) => AgentToolSubStepHandle;

export interface AgentToolContext {
  taskId: string;
  projectId: string;
  conversationId: string;
  mode: AgentMode;
  /**
   * 执行期子步骤上报通道（见 `AgentToolSubStepInput` 的官方证据）。
   * 只有 `agentRoundExecutor.executePreparedToolCall` 注入；直接调 `definition.execute` 的
   * 单测/脚本拿不到它 ⇒ 工具必须写成可选调用（`context.reportStep?.(…)`）。
   */
  reportStep?: AgentToolReportStep;
  /**
   * **本次工具调用的官方 call id**（`tool_event.content.tool_call_id`）。
   * 少数工具需要「用官方那个 id 做 key」才能和渲染层的官方卡片对上 ——
   * 例如 `ask_question`：官方 `Moe`(`AskQuestionSummary`) 读
   * `content.tool_use_id ?? content.tool_call_id`，再拿它去匹配会话态
   * `pendingQuestion.toolUseId`（`iQe` 里的 `useStore`）。
   */
  callId?: string;
  /** 只读子任务（子智能体/专家任务）：注册表与 Policy 都只放行 `read`。 */
  readOnly?: boolean;
  /** 任务级工具上限；缺省表示不额外限制，空数组表示无工具。 */
  toolAllowlist?: string[];
  /** 工具提案时的画布修订号；写工具执行前必须复核。 */
  baseRevision?: number;
  /** 「设置 → 权限」里被关掉的能力（缺省 = 全部开启）。 */
  disabledEffects?: readonly AgentToolEffect[];
  signal: AbortSignal;
}

export interface AgentToolExecutionResult {
  status: 'success' | 'error';
  summary: string;
  /** 经过裁剪和脱敏、可以回传给模型的内容。 */
  modelContent: string;
  retryable?: boolean;
  truncated?: boolean;
  errorCode?: string;
  sources?: WebSource[];
  /** 面向用户的脱敏结果详情；不得包含本地路径、密钥或完整媒体 URL。 */
  display?: AgentToolDisplaySnapshot;
  /** 仅由 MCP 控制层返回的瞬时富内容；不得进入模型上下文、消息或任务持久化。 */
  mcpContent?: McpContent[];
  /**
   * **官方卡片载荷通道（「工具生产者」）** —— 工具把官方 `tool_event.content.request`
   * 原样交出来（`ShowWidgetCard` 读 `request.{title,widget_code,…}`、`ShowHtmlCard` 读
   * `request.{title,description,artifact_path}`）。见 `AgentToolCallSnapshot.officialRequest`。
   *
   * ⚠️ 与 `display` 不同，这块**会**进入任务快照（官方卡片的载荷本来就是消息的一部分）；
   * 但纪律相同：**只放官方 schema 里真实存在的字段**，不是原始 JSON 倾倒口。
   */
  officialRequest?: Record<string, unknown>;
  /**
   * **官方 `content.ui` 载荷通道（mcpApp 卡）** —— 官方 `$M` 的判据是**结构**而非工具名：
   * `content.ui.resource_uri` 非空字符串 ⇒ `McpAppCard`。见 `AgentToolCallSnapshot.officialUi`。
   */
  officialUi?: Record<string, unknown>;
  /**
   * **官方 `tool_event.content.response` 载荷通道** —— 工具把官方 schema 里 `response` 的字段
   * 原样交出来（与 `officialRequest` 对称）。`ask_question` 用它交 `{answers:[…]}`：
   * 官方 `Ioe`(`answerLabelsOf`) 读的正是 `content.response.answers`。
   */
  officialResponse?: Record<string, unknown>;
  /**
   * **「看图」通道**（官方 `view_media` 的客户端形态）—— 工具把**像素**交回给模型。
   *
   * 官方 `view_media` 是服务端工具：结果里带 `response.images[]/videos[].ref`（节点 id，见
   * `toolEventNodeIds.viewMediaRefs` = 官方 `lNe`），**像素**由服务端在下一轮把它作为图片内容
   * 塞进模型上下文。MTV 没有服务端 ⇒ 工具在这里直接交出 data URL / https URL，
   * 由 `agentRoundExecutor` 作为**下一条 user 消息**的 `image_url` 内容块回灌
   * （`chatApiProtocol` 三套协议都已支持：OpenAI 兼容原样、Gemini `inlineData`、Anthropic `image`）。
   *
   * ⚠️ `role: 'tool'` 的消息在 OpenAI/Gemini/Anthropic 三条协议里都**只能放文本** ⇒ 必须另起一条
   * user 消息承载图片，这是协议约束，不是 MTV 的随意设计。
   */
  modelImages?: AgentModelImage[];
}

/** 回灌给模型的一张图（`url` 建议用 data URL：三套协议都能吃）。 */
export interface AgentModelImage {
  url: string;
  /** 仅用于日志/摘要（不发给模型）。 */
  label?: string;
}

export interface AgentToolDefinition<TInput = unknown> {
  id: string;
  title: string;
  description: string;
  inputSchema: AgentToolSchema;
  effect: AgentToolEffect;
  isAvailable?: (context: Omit<AgentToolContext, 'signal'>) => boolean;
  authorize?: (
    context: Omit<AgentToolContext, 'signal'>,
    input: TInput,
  ) => { allowed: boolean; reason?: string };
  summarizeInput?: (input: TInput) => string;
  /** 构建审批和时间线使用的脱敏参数详情；异常时执行器会退化为摘要。 */
  buildInputDisplay?: (
    input: TInput,
    context: Omit<AgentToolContext, 'signal'>,
  ) => AgentToolDisplaySnapshot;
  /** 在策略与审批前把项目默认值解析进输入，形成执行期间不可变的有效参数。 */
  resolveInput?: (
    input: TInput,
    context: Omit<AgentToolContext, 'signal'>,
  ) => TInput;
  execute: (context: AgentToolContext, input: TInput) => Promise<AgentToolExecutionResult>;
}

export interface AssistantFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: AgentToolSchema;
  };
}

export interface PreparedAgentToolCall {
  definition: AgentToolDefinition;
  input: unknown;
}

export type PrepareAgentToolCallResult =
  | { ok: true; prepared: PreparedAgentToolCall }
  | { ok: false; result: ToolResultSummary };

const registry = new Map<string, AgentToolDefinition>();

export function registerAgentTool<TInput>(definition: AgentToolDefinition<TInput>): () => void {
  if (registry.has(definition.id)) {
    throw new Error(`Agent 工具已注册: ${definition.id}`);
  }
  registry.set(definition.id, definition as AgentToolDefinition);
  return () => {
    if (registry.get(definition.id) === definition) registry.delete(definition.id);
  };
}

export function getAgentTool(toolId: string): AgentToolDefinition | undefined {
  return registry.get(toolId);
}

/** 注册编排专用：取当前已注册工具 ID 的快照。 */
export function snapshotAgentToolIds(): Set<string> {
  return new Set(registry.keys());
}

/**
 * 注册编排专用：按 ID 移除工具。
 *
 * 仅供失败回滚使用：某个注册函数在中途抛错时，它内部已注册但尚未返回注销函数的
 * 工具无法通过注销回调回收，只能按注册前快照的差异集合兜底清理。
 */
export function removeAgentToolsById(toolIds: Iterable<string>): void {
  for (const toolId of toolIds) registry.delete(toolId);
}

export function getAvailableAgentTools(
  context: Omit<AgentToolContext, 'signal'>,
): AgentToolDefinition[] {
  return [...registry.values()].filter((definition) => {
    if (context.readOnly && definition.effect !== 'read') return false;
    if (
      context.toolAllowlist !== undefined
      && !context.toolAllowlist.includes(definition.id)
    ) return false;
    if (!definition.isAvailable) return true;
    try {
      return definition.isAvailable(context);
    } catch (error) {
      // 单个工具的可用性判断出错不应拖垮整份列表（例如 MCP 工具发现没有真实任务上下文）。
      console.error(`[AgentToolRegistry] isAvailable failed for ${definition.id}:`, error);
      return false;
    }
  });
}

export function buildAssistantFunctionTools(
  context: Omit<AgentToolContext, 'signal'>,
): AssistantFunctionTool[] {
  return getAvailableAgentTools(context).map((definition) => ({
    type: 'function',
    function: {
      name: definition.id,
      description: definition.description,
      parameters: definition.inputSchema,
    },
  }));
}

export function prepareAgentToolCall(
  call: ProposedToolCall,
  context: Omit<AgentToolContext, 'signal'>,
): PrepareAgentToolCallResult {
  const definition = registry.get(call.toolId);
  const unavailable = !definition
    || (context.readOnly && definition.effect !== 'read')
    || (
      context.toolAllowlist !== undefined
      && !context.toolAllowlist.includes(call.toolId)
    )
    || (definition.isAvailable && !definition.isAvailable(context));
  if (unavailable) {
    return {
      ok: false,
      result: {
        callId: call.callId,
        toolId: call.toolId,
        status: 'denied',
        summary: `工具不可用或未注册: ${call.toolId}`,
        truncated: false,
      },
    };
  }

  const validation = validateAgentToolInput(definition.inputSchema, call.input);
  if (!validation.valid) {
    return {
      ok: false,
      result: {
        callId: call.callId,
        toolId: call.toolId,
        status: 'error',
        summary: `工具参数无效: ${validation.errors.join('；')}`,
        truncated: false,
      },
    };
  }

  let resolvedInput: unknown;
  try {
    resolvedInput = definition.resolveInput
      ? definition.resolveInput(call.input, context)
      : call.input;
  } catch (error) {
    return {
      ok: false,
      result: {
        callId: call.callId,
        toolId: call.toolId,
        status: 'error',
        summary: `工具参数解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
        truncated: false,
      },
    };
  }
  const resolvedValidation = validateAgentToolInput(definition.inputSchema, resolvedInput);
  if (!resolvedValidation.valid) {
    return {
      ok: false,
      result: {
        callId: call.callId,
        toolId: call.toolId,
        status: 'error',
        summary: `工具有效参数无效: ${resolvedValidation.errors.join('；')}`,
        truncated: false,
      },
    };
  }

  return { ok: true, prepared: { definition, input: resolvedInput } };
}

export function clearAgentToolRegistryForTests(): void {
  registry.clear();
}
