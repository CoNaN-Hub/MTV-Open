/**
 * agentActivityItems —— MTV 的 `AgentTask`/`AgentStep` → 官方 `tool_event` 形状的**适配层**。
 *
 * 目的：让官方那套工具行/子代理行/分组渲染（`px`/`FL`/`kh`）**直接吃 MTV 的真实数据**，
 * 而不用在组件里塞 MTV 的任务模型。
 *
 * 官方侧的形状（`page-BeI7xydN.js` 里到处用的判据）：
 * ```js
 * gs(item) = item.type === 'tool_event' && item.content
 *              ? String(item.content.tool ?? '').toLowerCase() : ''
 * item.content.{status, request.description, request.prompt, response}
 * item.startedAt / item.endedAt        // `hx` 用它们算时长
 * ```
 * 官方按 `tool` 名分类（`b1`/`v1`/`y1`/`canvas_context`/`skill`，其余归 `command`），
 * 所以这里做一张 **MTV 工具 id → 官方工具名** 的映射表；映射不到的一律保持原 id（⇒ 官方会当成
 * `command`，用工具自己的 `inputSummary` 当描述，这正是官方对自家 canvas 类工具的做法）。
 *
 * 官方工具名集合（逐字）：
 *   edit      : write · edit · multiedit · multi_edit · apply_patch
 *   viewMedia : view_media
 *   read      : read                     （→ exploration「Read N documents」）
 *   skill     : skill                    （→ readingSkill / readSkill）
 *   canvas    : canvas_context           （→ readingCanvasContext / readCanvasContext）
 */
import type { AgentStep, AgentTask } from '../../types/agent';
import type { ToolEventLike } from './agentToolLabels';
import { approvalStepToOfficialToolEventItem } from './agentApprovalContents';

/**
 * **已经移植完官方卡片**的确认族（只有这些允许在 `stepToToolEvent` 里改走官方 content）。
 *
 * 判据 = 官方 `$M`（@2426950）分派到的组件在 MTV 已存在：
 *   · `generation_confirmation` → `qet` → `GenerationConfirmationCard`（round 27 移植）
 *   · `node_update_confirmation` → `Btt` → `NodeUpdateConfirmationCard`（round 27 移植）
 * **不在**此列的族（`desktop_fs_confirmation` → `$Qe`、`AskUserQuestion` → `Moe` 的可交互支）
 * 等对应组件移植后（§6 #5）再加进来 —— 否则审批会「既不是工具行、也没卡片」而从界面消失。
 */
const PORTED_CONFIRMATION_FAMILIES: ReadonlySet<string> = new Set([
  'generation_confirmation',
  'node_update_confirmation',
  /* round 30：`$Qe`(`DesktopConfirmationCard`) 已由并发子代理移植并接进 `ConfirmationEventCard`
     （官方 `$M` @2426950 的 `kD` 分支）⇒ `desktop_fs_confirmation` 现在有卡片可渲染，放开。 */
  'desktop_fs_confirmation',
]);

/**
 * MTV 工具 id → 官方工具名。**只映射语义等价的**，其余保持原样（官方按 `command` 处理）。
 * 官方 `toolLabels` 表里也有 `create_text_node` / `layout_canvas_nodes` / `update_canvas_node` 这些
 * canvas 操作名 —— 说明官方把这类也归 `command`，所以 MTV 的 `canvas_*` 不必硬塞进 `canvas_context`。
 */
const MTV_TOOL_TO_OFFICIAL: Record<string, string> = {
  /* 文件写入 = 官方 edit（`b1` 集合里的 write/edit） */
  file_write_text: 'write',
  /* 文件/文档读取 = 官方 read（`y1` → exploration） */
  file_read_text: 'read',
  series_read: 'read',
  series_read_chapter: 'read',
  episode_read: 'read',
  shotlist_read: 'read',
  provider_docs_read: 'read',
  /* 技能读取 = 官方 skill */
  skill_load: 'skill',
  skill_read_file: 'skill',
  /* 画布上下文 = 官方 canvas_context */
  canvas_query: 'canvas_context',
  canvas_select: 'canvas_context',
  ui_get_layout: 'canvas_context',
  ui_get_interaction_state: 'canvas_context',
  canvas_get_viewport: 'canvas_context',
};

/** 官方 `ar`：工具名归一化（小写去空白；空 ⇒ `''`）。 */
export function mtvToolToOfficial(toolId: string | undefined): string {
  if (!toolId) return '';
  const normalized = toolId.trim().toLowerCase();
  if (!normalized) return '';
  return MTV_TOOL_TO_OFFICIAL[normalized] ?? normalized;
}

/** MTV `AgentStepStatus` → 官方 `content.status`。 */
export function stepStatusToOfficial(status: AgentStep['status']): string {
  switch (status) {
    case 'running': return 'started';
    case 'waiting_approval': return 'started';
    case 'pending': return 'pending';
    case 'succeeded': return 'completed';
    case 'failed': return 'failed';
    case 'stopped': return 'cancelled';   // 官方 `X0` 认识 cancelled/canceled/aborted/interrupted
    case 'skipped': return 'completed';
    default: return 'completed';
  }
}

/** MTV `AgentTaskStatus` → 官方 **subagent** `content.status`（子代理行 `sae` 用）。
 *  官方 `YW` 归一化后的合法值只有 `running | completed | failed | stopped | ended_unknown`
 *  （`n === "running" || "completed" || "failed" || "stopped" ? n : "ended_unknown"`），
 *  且官方 `working = status === "running"`。MTV 的 `queued/planning/waiting_*` 都属「在跑」。 */
export function taskStatusToOfficial(status: AgentTask['status']): string {
  switch (status) {
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'stopped': return 'stopped';
    case 'queued':
    case 'planning':
    case 'running':
    case 'waiting_tool':
    case 'waiting_approval':
    default:
      return 'running';
  }
}

/**
 * 这个审批步骤会不会走 **官方确认卡**（= `stepToToolEvent` 的那条改道分支）。
 *
 * 判据与 `stepToToolEvent` **共用同一份实现**（抽出来，避免两处判据漂移）：
 * `approvalStepToOfficialToolEventItem(step)` 产出的官方族在 `PORTED_CONFIRMATION_FAMILIES` 里。
 */
export function approvalRendersOfficialCard(step: AgentStep): boolean {
  const approvalItem = approvalStepToOfficialToolEventItem(step);
  const approvalTool = String((approvalItem?.content as { tool?: unknown } | undefined)?.tool ?? '');
  return !!approvalItem && PORTED_CONFIRMATION_FAMILIES.has(approvalTool);
}

/**
 * **round 117（用户 2026-10-15 裁决：媒体生成类改由官方确认卡承担）**
 * 该审批步骤的官方确认卡是不是**媒体生成**那一族（官方 `generation_confirmation`）。
 *
 * 判别口径（从代码查实，不是猜）：
 *   · `types/agent.ts:75` `AgentApprovalKind` 里**只有一个**媒体生成取值 `'media_generation'`；
 *     图片 / 视频 / 音频**共用**它，靠 `AgentApprovalInputRequest.mediaKind`（`'image'|'video'|'audio'`）区分
 *     ⇒ 收口径按 `kind === 'media_generation'`，**不按 `mediaKind`**。
 *   · 但 `effect: 'media_generation'` 的工具**不止 `media_generate`**：还有
 *     `shotlist_generate_frames` / 快捷指令 `runStep` / `director_render_frame` / `director_render_video` /
 *     ComfyUI 工作流 / `canvas_run`（见 `policyEngine.ts:151` ⇒ 它们**同样**拿到
 *     `approvalKind: 'media_generation'`），而 `inputRequest: {kind:'media_model'}`
 *     只在 `agentRoundExecutor.prepareApprovalInput` 里对 **`id === 'media_generate'`** 产出
 *     （该文件 @732-812）⇒ 这 6 类**产不出官方 content**，官方卡不会渲染。
 *   · `generation_confirmation` 这个 content.tool 只由
 *     `agentApprovalContents.approvalToOfficialContent` 的 `case 'media_generation'` 产出
 *     ⇒ 「`kind === 'media_generation'` ∧ 官方 content 非空」**等价于**
 *     「官方确认卡会渲染」。（这一条同时排除了 `node_update_confirmation` /
 *     `desktop_fs_confirmation` —— 那两族的 MTV 审批卡按裁决**必须保留**。）
 */
export function approvalRendersGenerationCard(step: AgentStep): boolean {
  if (step.approval?.kind !== 'media_generation') return false;
  const item = approvalStepToOfficialToolEventItem(step);
  return String((item?.content as { tool?: unknown } | undefined)?.tool ?? '') === 'generation_confirmation';
}

/** 把一条 MTV `AgentStep` 变成官方 `tool_event` 项。 */
export function stepToToolEvent(step: AgentStep): ToolEventLike {
  const toolCall = step.toolCall;
  const officialTool = mtvToolToOfficial(toolCall?.toolId);

  /* ── 「工具生产者」接线（用户指令 round 27）────────────────────────────────
     带 `step.approval` 的步骤先走写侧适配层 `agentApprovalContents`：
     MTV 的 `approvalKind` → 官方族 content（`media_generation`→`generation_confirmation`、
     `canvas_write`→`node_update_confirmation`、`file_write`/`permanent_delete`/`asset_write`→
     `desktop_fs_confirmation`、`user_choice`→`AskUserQuestion`）。

     ⚠️ **只接「官方卡片已经移植完」的族**（见 `PORTED_CONFIRMATION_FAMILIES`）：
     没移植的族若在这里改道，会被 `MessageBubble` 的确认卡过滤器摘走、而卡片又渲染不出东西
     ⇒ 那条审批会**从界面上消失**，比现在（退化成普通工具行）更差。
     其余族等 §6 #5（`$Qe`）移植后再放开。 */
  if (step.approval) {
    /* ⚠️ **改道的时机**（子代理审计发现的 bug，主 agent 已独立复现）：官方**没有**
       「审批包住任意工具」这层包装 —— 确认卡族（`generation_confirmation` /
       `node_update_confirmation` / `desktop_fs_confirmation`）在官方是**各自的工具**；
       MTV 的 `step.approval` 只是「这一步在等用户批」的表达。
       原来对**任何**带 `approval` 的步骤无条件改道，于是：
         · 协作模式下 `show_html`（`effect:file_write` ⇒ `require_approval`）执行成功后，
           步骤仍带 `approval`（`agentToolExecution` 只把 status 改成 `approved`），
         · `toolCall.officialRequest` 被整块丢弃 ⇒ **HTML 卡片在协作模式永远不出现**。
       规则：
         · 审批**还挂着**（`pending`）⇒ 走确认卡（那就是审批 UI，不能丢）；
         · 审批已了结、且这一步**已有自己的官方载荷**（`officialRequest` / `officialUi` /
           `officialResponse` 任一）⇒ 渲染**它自己的卡**；
         · 其余（已了结、无自己的载荷）⇒ 保持原行为（继续走确认卡，例如真正的生成确认卡）。 */
    const hasOwnOfficialPayload = !!(toolCall?.officialRequest || toolCall?.officialUi || toolCall?.officialResponse);
    if (step.approval.status === 'pending' || !hasOwnOfficialPayload) {
      if (approvalRendersOfficialCard(step)) {
        const approvalItem = approvalStepToOfficialToolEventItem(step);
        return {
          ...(approvalItem as unknown as ToolEventLike),
          startedAt: toolCall?.startedAt ?? step.createdAt,
          endedAt: toolCall?.finishedAt ?? step.updatedAt,
        };
      }
    }
  }

  return {
    type: 'tool_event',
    content: {
      /* 官方 `Gge`（@21175 邻域，逐字）生产的 `schema_version`。 */
      schema_version: 'tool_event.v1',
      /* 官方 `gs` 读的就是 `content.tool`；没有 toolCall 的步骤（计划/回答）用 step.kind 当名字，
         官方对认不出的名字一律按 `command` 处理 ⇒ 显示 `inputSummary`/`title`。 */
      tool: officialTool || step.kind,
      status: stepStatusToOfficial(step.status),
      /* 官方 `content.tool_call_id`（`iS` @21009 读它）。
         ⚠️ 以前这里**漏了** ⇒ 本文件的 `callIdOf`（官方 `Fx`）对 MTV 的工具项恒返回 `''`，
         连带 `dedupeByCallId`（官方 `oie`）恒不生效、官方 `e1e` 的 `pending-<callId>` 伪胶囊与
         `p1e` 的 `$b` 同 id 合并全部失能。MTV 的 `AgentToolCallSnapshot.callId` 就是官方那个 id。 */
      tool_call_id: toolCall?.callId,
      /* 官方卡片载荷通道（见 `AgentToolCallSnapshot.officialRequest` 的注释）。
         官方 `mre`/`ure`/`nre`/`ase` 读的是 `content.request ?? content`，而 MTV 原先**恒**会写一个
         `{description, prompt}`（那是给工具行用的 MTV 自造形状）⇒ 两个后果：
           ① `?? content` 的兜底永不触发；② `description` 会**撞上**官方 schema 里的同名字段
              （例如 `show_form` 的 `Hoe` 把 `request.description` 当表单说明，于是 MTV 的 `step.title`
              漏进了表单描述里）。
         ⇒ 有官方载荷时**整块替换**成官方 `request`（官方那把 `request` 本来就是卡片定义本体）；
            没有时才退回 MTV 的工具行形状。 */
      request: toolCall?.officialRequest ?? {
        /* 官方 `i6(e,'description')`（子代理描述）/ 命令行的 `commandDescription` 都读这里。 */
        description: step.title,
        /* 官方子代理行摘要读 `request.prompt`。 */
        prompt: step.approval?.summary ?? step.toolCall?.inputSummary ?? '',
      },
      response: {
        summary: step.outputSummary ?? step.toolCall?.resultSummary ?? '',
        /* ⚠️ **官方「输出」块（`OX` → `response.output/text/content/result/stdout*`）在 MTV 没有生产者。**
           官方那些文本来自**服务端工具 payload**（`desktop_*` / `tapnow_cli` 的 stdout…），
           MTV 的等价物 `AgentToolExecutionResult.modelContent` 是**给模型看的载荷**
           （结构化工具就是 JSON 字符串），官方 schema 里没有这个字段、也不是「输出」语义。
           第 61 轮曾把它截断后写进 `content.response.output` ⇒ 画布类工具行下多出一坨原始 JSON，
           与官方实测行为相反（官方 `canvas_query` 类工具行只有「结果」，没有「输出」块）。
           ⇒ 这里**不写** `output` / `truncated`：没有该字段就不渲染（官方 `TT` 的
           `if (!visible.length && !truncated) return null`）。 */
        /* 官方 `content.response` 载荷通道（见 `AgentToolCallSnapshot.officialResponse`）：
           `ask_question` 用它交 `{answers:[…]}`，官方 `Ioe`(`answerLabelsOf`) 读的正是这里。 */
        ...(toolCall?.officialResponse ?? {}),
      },
      /* 官方 `content.ui` 载荷通道（见 `AgentToolCallSnapshot.officialUi` 的注释）。
         官方 `$M` 的 `AD(e)`（mcpApp 卡）判据是 `content.ui.resource_uri` 非空 ⇒ 没有它卡片不可达。 */
      ...(toolCall?.officialUi ? { ui: toolCall.officialUi } : {}),
    },
    startedAt: toolCall?.startedAt ?? step.createdAt,
    endedAt: toolCall?.finishedAt ?? step.updatedAt,
  };
}

/** 「会变成官方 `tool_event`」的 `AgentStep`（官方只渲染工具事件，计划/回答步骤没有事件）。
 *  抽成独立导出，给有序 `contents` 的生产者（`messageContents.buildMessageContents`）复用，
 *  避免同一条过滤判据在仓库里落两份。 */
export function renderableToolSteps(task: AgentTask): AgentStep[] {
  return task.steps
    .filter((step) => step.kind === 'tool' || step.kind === 'approval' || step.kind === 'planning');
}

/** 把一条 MTV 工具步骤之外的可展示步骤过滤出来（官方只渲染 `tool_event`）。 */
export function taskStepsToToolEvents(task: AgentTask): ToolEventLike[] {
  return renderableToolSteps(task).map(stepToToolEvent);
}

/** 把一个 MTV 子任务变成官方**子代理**事件（官方 `sae`/`SubagentCard` 的 `item` 入参）。
 *  官方子代理载荷逐字：`{subagent_id, status, agent_type?, parent_tool_call_id?, task_description?,
 *  tools: ToolEvent[], text?}`（`qge(item)` 归一化；文案读 `task_description`，展开区正文读 `text`）。 */
export function childTaskToSubagentEvent(task: AgentTask): ToolEventLike {
  const startedAt = task.startedAt ?? task.createdAt;
  const endedAt = task.completedAt ?? task.updatedAt;
  return {
    type: 'tool_event',
    content: {
      subagent_id: task.id,
      status: taskStatusToOfficial(task.status),
      task_description: task.goal,
      tools: [],
      /* MTV 没有子代理的流式正文，用结果摘要充当官方 `text`（展开区正文）。 */
      text: task.resultSummary ?? '',
    },
    startedAt,
    endedAt,
  };
}
