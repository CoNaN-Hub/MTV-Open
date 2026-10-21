/**
 * agentApprovalContents —— MTV `AgentApprovalSnapshot` → 官方「确认卡族 `tool_event` content」的
 * **写侧（生产者）适配层**。纯函数、无 React、无 store。
 *
 * ── 为什么需要这一层 ────────────────────────────────────────────────────────────
 * 官方确认卡**只**认 `tool_event.content.tool` 是否落在族集合里。官方消息渲染器
 * （`vendor-pkg-canvas-ChpWx5JY.js` @2427106 邻域，逐字）：
 * ```js
 * if(e.type==="tool_event"){
 *   if($b(e))return s.jsx(Moe,{content:e.content,renderLabel:Iot});       // AskUserQuestion 摘要卡
 *   if(wS(e))return null;                                                 // cost_limit_confirmation
 *   if(dg(e))return s.jsx(qet,{content:e.content,onAnswer:l,...});        // generation_confirmation
 *   if(iT(e))return s.jsx(Btt,{content:e.content,onAnswer:l});            // node_update_confirmation
 *   if(kD(e))return s.jsx($Qe,{content:e.content,onAnswer:l});            // desktop_*_confirmation
 *   ...
 * }
 * ```
 * 而 `xl`（@443724）是**大小写敏感**地取 `content.tool`：
 * ```js
 * xl = e => e.type==="tool_event" && typeof e.content=="object" && e.content!==null ? String(e.content.tool??"") : ""
 * ```
 * MTV 侧的「生产者」是 `AgentApprovalSnapshot`（`agentToolExecution.ts` @161-172 与
 * `agentRoundExecutor.ts` @961-972 两处创建），它**只有**
 * `{id, kind, status, summary, requestedAt, resolvedAt?, inputRequest?}`，没有 content。
 * ⇒ 卡片搬过来也永远不可达。本模块就是那层「翻译」。
 *
 * ── 本模块**不**做的事 ──────────────────────────────────────────────────────────
 * · 不改 `policyEngine.ts` 的安全语义，不放松任何 effect→approvalKind 的判定；
 * · 不新增/改写 MTV 工具注册项，**不伪造工具调用**：这里翻译的是「**审批卡**的 content」，
 *   不是「工具本身」。`tool` 字段被写成官方确认卡的族名，是因为官方 `$M` 就用它做唯一分派键
 *   （这一点在报告里逐条标注）；
 * · 不接线（调用点由主 agent 统一加）；
 * · **不编造 MTV 没有的字段**。MTV 缺的字段一律 `undefined`/留空，并在 `missingMtvFields`
 *   与 `notes` 里逐条标出「MTV 无生产者」。
 *
 * ── 权威偏移（`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`，0-based char 偏移）──
 * | 符号 | 偏移 | 作用 |
 * |---|---|---|
 * | `MNe` | 442146 | `new Set(["AskUserQuestion","ask_question"])` |
 * | `PNe` | 442160 | `new Set(["generation_confirmation"])` |
 * | `DNe` | 442228 | `new Set(["node_update_confirmation"])` |
 * | `LNe` | 442270 | 5 个 `desktop_*_confirmation` / `batch_download_files_confirmation` |
 * | `$b`/`dg`/`iT`/`kD` | 443950 邻域 | 四个族谓词（`MNe/PNe/DNe/LNe.has(xl(e))`） |
 * | `qet` | 2287990 | `generation_confirmation` 分发器（`bJe` → `yJe` → `Zet`） |
 * | `bJe` / `yJe` | 2225676 / 2225316 | v1 / legacy 解析器（`generationConfirmationProtocol.ts` 已移植） |
 * | `uF` / `cF` / `dF` / `eJe` | 2214985 / 2215087 / 2215145 / 2213895 | 载体 → requestKind |
 * | `AF_GENERATION_REQUEST_V1` | 2213590 | `"tapnow.generation_request.v1"` |
 * | `Btt` | 2358212 | `node_update_confirmation` 分发器：`Ott` 命中→`Utt`，否则 `ztt` |
 * | `Ott` | 2350378 | 批量 viewModel（要求 `detail.items[]` 非空） |
 * | `Ett` | 2347042 | 单条载体查找（`confirmation_id` + `confirmation_kind==="node_update"`） |
 * | `Dtt` | 2349874 | `confirmation_kind==="node_update" \|\| tool_name==="node_update_confirmation"` |
 * | `Ltt` | 2349966 | `detail.items[]` 提取 |
 * | `Ftt` | 2350101 | summary 兜底 `"Update the node"` |
 * | `dre` | 2348849 | body 文案（`e?.summary \|\| n`） |
 * | `$Qe` | 2162950 | `desktop_*` 卡本体 |
 * | `Boe` | 2159902 | `detail.request_json` 展开到顶层 |
 * | `BQe` | 2159581 | titles 回退 map（含 `desktop_fs`） |
 * | `HQe` | 2160228 | desktop summary 构造器（逐字 operation 值域） |
 * | `Ff` / `Of` | 2159117 / 2159421 | 卡状态 / 在途判定 |
 * | `zQe` | 2158792 | 三个「非用户决定」error code（含 `generation_confirmation_expired`） |
 * | `iQe` | 2135282 | `Moe` 的实现（`AskQuestionSummary`） |
 * | `Moe` | 2135928 邻域 | `Moe=a.memo(iQe)`；`$M` 的 `$b` 分支组件 |
 * | `jM` / `MB` / `sQe` / `Ioe` / `rQe` / `l_` | 2133356–2134572 | AskUserQuestion 读写侧 |
 * | 官方 AskUserQuestion **生产者** | 2132894 | `{status:"started",tool_call_id:e.question_id,tool_use_id:e.question_id,tool:"AskUserQuestion",request:{question_id,question,mode,options,...}}` |
 * | `Xie`（`OptionRow`） | 2557583 | 官方 option 形状：`option.label` / `option.description`；`isSelected: _.includes(option.label)` |
 * | `Gge`（tool_event 归一化） | 21102 | `content` 补 `schema_version:"tool_event.v1"` |
 *
 * 验证分级：本模块是 **(d) 源码级**（官方 bundle 逐字 + 偏移）。**没有**做 live CDP / jsdom 实测。
 */
import type { ToolEventContent, ToolEventItem } from './agentContents';
import { classifyToolEventFamily } from './agentMessageContents';
import type { AgentToolFamily } from './agentMessageContents';
import type {
  AgentApprovalKind,
  AgentApprovalSnapshot,
  AgentApprovalStatus,
  AgentStep,
  AgentToolCallSnapshot,
} from '../../types/agent';
import { AF_GENERATION_REQUEST_V1 } from './generationConfirmationProtocol';

/* ============================================================================
 * 1. 官方常量（逐字；偏移见文件头表）
 * ============================================================================ */

/** 官方 `MNe` @442146 的**生产者字面量**（@2132894 里 `tool:"AskUserQuestion"`）。 */
export const OFFICIAL_TOOL_ASK_QUESTION = 'AskUserQuestion';
/** 官方 `PNe` @442160。 */
export const OFFICIAL_TOOL_GENERATION_CONFIRMATION = 'generation_confirmation';
/** 官方 `DNe` @442228。 */
export const OFFICIAL_TOOL_NODE_UPDATE_CONFIRMATION = 'node_update_confirmation';
/** 官方 `LNe` @442270 —— 本模块只用 `desktop_fs` 那一个（见 §5 的诚实标注）。 */
export const OFFICIAL_TOOL_DESKTOP_FS_CONFIRMATION = 'desktop_fs_confirmation';

/** 官方 `Dtt` @2349874 / `Ott` @2350378：node_update 载体的判别字段值。 */
export const OFFICIAL_CONFIRMATION_KIND_NODE_UPDATE = 'node_update';
/** 官方 `BQe` @2159581 + `HQe` @2160228 的 `case"desktop_fs"`。 */
export const OFFICIAL_CONFIRMATION_KIND_DESKTOP_FS = 'desktop_fs';

/**
 * 官方 `zQe` @2158792：`new Set(["superseded_by_new_message","generation_confirmation_expired","conversation_cancelled"])`。
 * `Ff` 把命中的 error code 归为官方状态 `"skipped"`。三个里只有 `generation_confirmation_expired`
 * 与 MTV 的 `AgentApprovalStatus.expired` 语义对齐，故取它。
 */
export const OFFICIAL_EXPIRED_ERROR_CODE = 'generation_confirmation_expired';

/**
 * 官方 `HQe` @2160228 的 `desktop_fs` operation 值域（逐字，从 `case` 分支抄出）。
 * ⚠️ MTV 侧**没有生产者**：`AgentApprovalSnapshot` / `AgentToolCallSnapshot` 都不表示 operation，
 * 故本模块**不写入 `operation`**（见 §5）。
 */
export const OFFICIAL_DESKTOP_FS_OPERATIONS = [
  'batch_write',
  'batch_upload',
  'pick_directory',
  'pick_file',
  'organize',
  'delete',
] as const;

/** 官方 `MB` @2133356：`multiSelect: e.multiSelect===!0 || e.mode==="multiple"`。 */
export const OFFICIAL_ASK_QUESTION_MULTI_MODE = 'multiple';

/* ============================================================================
 * 2. MTV kind → 官方族
 * ============================================================================ */

/**
 * MTV `AgentApprovalKind` → 官方 `$M` 的确认卡族。
 *
 * `null` = **官方没有对应族**，本模块明确拒绝产出（不造假的工具 id 去骗谓词）。
 * 依据：`MNe`/`PNe`/`DNe`/`LNe` 四个集合的成员并集只覆盖
 * `ask_question` / `generation_confirmation` / `node_update_confirmation` / `desktop_*` 四族；
 * `memory_write`（MTV 独有的「项目记忆」）与 `config_write`（MTV 独有的
 * 对话/画风/工作流/厂商配置/窗口控制）在官方确认卡族里**都没有载体**。
 */
export const APPROVAL_KIND_TO_OFFICIAL_FAMILY: Readonly<Record<AgentApprovalKind, AgentToolFamily | null>> = {
  user_choice: 'ask_question',
  media_generation: 'generation_confirmation',
  canvas_write: 'node_update_confirmation',
  file_write: 'desktop_confirmation',
  permanent_delete: 'desktop_confirmation',
  asset_write: 'desktop_confirmation',
  /* 官方无对应族 —— 明确返回「无官方形状」。 */
  memory_write: null,
  config_write: null,
};

/** MTV `AgentApprovalKind` → 官方 `content.tool`（`xl` @443724 读的就是这个字段）。 */
export const APPROVAL_KIND_TO_OFFICIAL_TOOL: Readonly<Record<AgentApprovalKind, string | null>> = {
  user_choice: OFFICIAL_TOOL_ASK_QUESTION,
  media_generation: OFFICIAL_TOOL_GENERATION_CONFIRMATION,
  canvas_write: OFFICIAL_TOOL_NODE_UPDATE_CONFIRMATION,
  file_write: OFFICIAL_TOOL_DESKTOP_FS_CONFIRMATION,
  permanent_delete: OFFICIAL_TOOL_DESKTOP_FS_CONFIRMATION,
  asset_write: OFFICIAL_TOOL_DESKTOP_FS_CONFIRMATION,
  memory_write: null,
  config_write: null,
};

/* ============================================================================
 * 3. MTV 审批状态 → 官方 content.status / response.action / error.code
 * ============================================================================ */

/**
 * 官方 `Ff`（@2159117，逐字）：
 * ```js
 * function Ff(e,t,n){const o=n?.pendingConfirmation;if(o?.confirmationId===t)return o.status;
 *   const r=n?.resolvedConfirmations?.[t];if(r)return r;
 *   const i=e?.status??e?.result?.status;
 *   return i==="completed"?Uoe(e)==="reject"?"rejected":"confirmed"
 *        :i==="failed"?zQe.has(UQe(e))?"skipped":"rejected":"pending"}
 * ```
 * 以及官方 `Of`（@2159421，逐字）—— `status==="started"` 且无 action 时返回 true（**卡整张 null**）：
 * ```js
 * function Of(e,t,n){return!((e?.status??e?.result?.status)!=="started"||Uoe(e)!=null||n?.pendingConfirmation?.confirmationId===t||n?.resolvedConfirmations?.[t])}
 * ```
 * ⇒ 本模块**必须**用 `"pending"` 而不是 `"started"` 表示未决，否则在官方 store 切片未接线时 `Of` 会
 *   把卡整张吞掉；而 `"pending"` 同时满足 `Of===false`（`status!=="started"`）与 `Ff==="pending"`。
 *   这一点与 `agentActivityItems.stepStatusToOfficial()`（给工具**行**用）的 `pending`→`"pending"` 一致。
 */
export function approvalStatusToOfficialStatus(status: AgentApprovalStatus): string {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'approved':
      return 'completed';
    case 'rejected':
      return 'completed';
    case 'expired':
      return 'failed';
  }
}

/**
 * 官方 `Uoe`（@2158894）：`e?.response?.action ?? e?.response?.answer?.action ?? e?.result?.action ?? e?.result?.answer?.action ?? e?.action`。
 * 只有 `status==="completed"` 时才需要（`Ff` 靠它区分 confirmed / rejected）。
 */
export function approvalStatusToOfficialAction(status: AgentApprovalStatus): 'confirm' | 'reject' | null {
  if (status === 'approved') return 'confirm';
  if (status === 'rejected') return 'reject';
  return null;
}

/* ============================================================================
 * 4. 适配层入口
 * ============================================================================ */

/** 适配层入参。 */
export interface AgentApprovalContentInput {
  /** 生产者：`AgentStep.approval`。 */
  approval: AgentApprovalSnapshot;
  /** 同一 `AgentStep.toolCall`（提供官方 `content.tool_call_id` 与时间戳）。 */
  toolCall?: AgentToolCallSnapshot | null;
  /**
   * `user_choice` 已作答时的官方 `selected_labels`（**由调用方提供**）。
   *
   * ⚠️ MTV **无生产者**：`AgentApprovalSnapshot` 不保存 `AgentApprovalResolution.inputValues`，
   * 所以解析结果里的 `selectedModelIds` / `modelRef` 在 `AgentStep` 上不可达。
   * 传了就产 `response.answers[]`，没传就不产（官方 `Ioe` 会判成 `cancelled`）。
   */
  userChoiceLabels?: readonly string[] | null;
}

/** 适配结果。 */
export interface AgentApprovalContentResult {
  /** MTV 审批 kind。 */
  kind: AgentApprovalKind;
  /** 官方 `$M` 族；`null` = 官方没有对应族。 */
  family: AgentToolFamily | null;
  /** 官方 `tool_event` content；无法映射时为 `null`。 */
  content: ToolEventContent | null;
  /** 官方 `tool_event` item（含 `startedAt`/`endedAt`）；无法映射时为 `null`。 */
  item: ToolEventItem | null;
  /** 官方 `content.status`。 */
  status: string | null;
  /** 人类可读说明（含降级原因）。 */
  notes: readonly string[];
  /** 官方契约里要求、但 **MTV 无生产者** 而按纪律留空的字段路径。 */
  missingMtvFields: readonly string[];
}

/** 官方 `Gge` @21102：`tool_event` content 的两个固定键。 */
function officialContentBase(
  tool: string,
  status: string,
  toolCall: AgentToolCallSnapshot | null | undefined,
): ToolEventContent {
  const callId = typeof toolCall?.callId === 'string' ? toolCall.callId : '';
  return {
    schema_version: 'tool_event.v1',
    type: 'tool_event',
    tool,
    status,
    ...(callId ? { tool_call_id: callId } : {}),
  };
}

/** 官方状态收敛（`Ff` @2159117 的两个非 store 分支）。 */
function statusEnvelope(approval: AgentApprovalSnapshot): Record<string, unknown> {
  const action = approvalStatusToOfficialAction(approval.status);
  if (action) return { response: { action } };
  if (approval.status === 'expired') {
    /* 官方 `UQe`（@2159023）读 `e?.error?.code ?? e?.result?.error?.code`。 */
    return { error: { code: OFFICIAL_EXPIRED_ERROR_CODE } };
  }
  return {};
}

function toItem(
  content: ToolEventContent,
  approval: AgentApprovalSnapshot,
): ToolEventItem {
  const startedAt = approval.requestedAt;
  const endedAt = approval.resolvedAt;
  return {
    type: 'tool_event',
    content,
    ...(typeof startedAt === 'number' && Number.isFinite(startedAt) ? { startedAt } : {}),
    ...(typeof endedAt === 'number' && Number.isFinite(endedAt) ? { endedAt } : {}),
  };
}

/* ============================================================================
 * 5. 各族 content 构造器
 * ============================================================================ */

/** `AgentApprovalInputRequest.kind === 'media_model'` 的 `mediaKind` → 官方 requestKind。 */
function generationRequestKind(approval: AgentApprovalSnapshot): 'image' | 'video' | 'audio' | null {
  const request = approval.inputRequest;
  if (!request || request.kind !== 'media_model') return null;
  const kind = request.mediaKind;
  return kind === 'image' || kind === 'video' || kind === 'audio' ? kind : null;
}

/**
 * `media_generation` → 官方 `generation_confirmation`（`dg` → `qet`）。
 *
 * 官方读侧要求（`uF` @2214985 / `cF` @2215087 / `dF` @2215145，逐字）：
 * ```js
 * cF = e => { const t=e.detail; if(As(t)&&As(t.request_json))return t.request_json;
 *             if(As(e.request_json))return e.request_json;
 *             if(e.kind===AF_GENERATION_REQUEST_V1)return e; return null }
 * dF = e => yE(e.request_kind) ? e.request_kind : As(e.image)?"image" : As(e.video)?"video" : As(e.audio)?"audio" : null
 * ```
 * ⇒ 最小的、能被 `bJe` @2225676 接受的载体是
 * ``{kind:"tapnow.generation_request.v1", request_kind:<image|video|audio>}``。
 *
 * ⚠️ **MTV 无生产者**：生成参数（`model_name` / `prompt` / `aspect_ratio` / `image_size` / `quality` /
 * `duration` / `resolution` / `generate_audio` / `mode` / `times` / `references` …）一个都没有 ——
 * `AgentToolCallSnapshot` 只有脱敏后的 `inputSummary` 字符串与 `inputDisplay`（标签-值对，标签是 MTV 自有中文，
 * 不是官方 wire 字段名）。硬塞会变成「自己断言」。因此 `params` / `originalParams` 走官方 `GB` @2214xxx
 * 的**空输入**分支 ⇒ `{}` + `presentFields: []`（卡头/条目仍渲染，只是没有 prompt 与参数 chip）。
 *
 * 唯一可用的真实字段是 `AgentApprovalInputRequest.mediaKind`（`inputRequest.kind === 'media_model'`）。
 * 没有它 ⇒ `uF` 无法定 requestKind ⇒ 本模块返回 `null`（不产出半截 content 去撞 `Zet` 回退卡）。
 */
export function generationConfirmationContent(
  approval: AgentApprovalSnapshot,
  toolCall?: AgentToolCallSnapshot | null,
): AgentApprovalContentResult {
  const notes: string[] = [];
  const missingMtvFields: string[] = [
    'request.request_json.prompt',
    'request.request_json.model_name',
    'request.request_json.aspect_ratio',
    'request.request_json.image_size',
    'request.request_json.quality',
    'request.request_json.times',
    'request.request_json.duration',
    'request.request_json.resolution',
    'request.request_json.generate_audio',
    'request.request_json.mode',
    'request.request_json.references',
    'request.request_json.element_refs',
    'request.request_json 以外的 presentFields 全部（MTV 无字段来源）',
  ];
  const status = approvalStatusToOfficialStatus(approval.status);
  const kind = generationRequestKind(approval);

  if (!kind) {
    return {
      kind: approval.kind,
      family: 'generation_confirmation',
      content: null,
      item: null,
      status,
      notes: [
        ...notes,
        'MTV 无 producer：`AgentApprovalInputRequest.kind !== "media_model"`（或 mediaKind 不是 image/video/audio）'
          + ' ⇒ 官方 `uF`/`dF` 定不出 requestKind，`bJe`/`yJe` 都会失败 ⇒ 不产出 content。',
      ],
      missingMtvFields: [...missingMtvFields, 'request_kind（MTV 无 producer）'],
    };
  }

  notes.push('requestKind 取自 MTV `AgentApprovalInputRequest.mediaKind`（唯一可用的真实字段）。');

  /**
   * 官方 `Sse` @2214xxx 从载体读的字段（逐字）：
   * `carrier.prompt` · `carrier.image.{aspect_ratio,image_size,quality,times}` ·
   * `carrier.video.{mode,aspect_ratio,duration,resolution,quality,generate_audio}` ·
   * `carrier.audio.*`。
   *
   * 第 59 轮起 MTV 有生产者：`media_model` 审批带上 `generationRequest`（来自 `media_generate` 工具入参的
   * **真实值**）⇒ 这里写进 `request_json`，官方读侧就能把提示词与参数渲染出来（此前卡片只有 requestKind，
   * 所以比官方少一整块）。没有的字段一律**不写**（不补默认值）。
   */
  const generation = approval.inputRequest?.kind === 'media_model'
    ? approval.inputRequest.generationRequest
    : undefined;
  /**
   * 官方 `Ott` @2264170 / `gJe` @2223368：**用户自己的修改**叠加在服务端给的 params 之上
   * （`c("model_name")` 等逐字段 `r[p]=m`）⇒ 用户选定/改过的值**优先于**原始载荷。
   *
   * MTV 的等价物 = 审批卡里选完的 `selectedModelRef`（`resolveApprovalSelection` @agentRoundExecutor
   * 在用户确认后写回 `{...inputRequest, selectedModelRef}`）。第 74 轮接上这条叠加：
   * 用户确认后卡片上的模型 chip 显示**实际会用的那个模型**，而不是空着。
   */
  const selectedModelRef = approval.inputRequest?.kind === 'media_model'
    && typeof approval.inputRequest.selectedModelRef === 'string'
    ? approval.inputRequest.selectedModelRef.trim()
    : '';
  const effectiveModelName = selectedModelRef || generation?.modelName;
  const nestedMedia: Record<string, unknown> = {};
  if (generation) {
    if (generation.aspectRatio) nestedMedia.aspect_ratio = generation.aspectRatio;
    if (generation.kind === 'image') {
      if (generation.imageSize) nestedMedia.image_size = generation.imageSize;
      if (typeof generation.times === 'number') nestedMedia.times = generation.times;
    }
    if (generation.kind === 'video') {
      if (generation.resolution) nestedMedia.resolution = generation.resolution;
      if (typeof generation.duration === 'number') nestedMedia.duration = generation.duration;
    }
  }
  const requestJson: Record<string, unknown> = {
    kind: AF_GENERATION_REQUEST_V1,
    request_kind: kind,
    ...(generation?.prompt ? { prompt: generation.prompt } : {}),
    /* 官方 `Sse` 读 `carrier.model_name`（**模型 chip 与价格**都靠它）。第 63 轮补：解析到的模型写这里。
       第 74 轮：用户选定的 `selectedModelRef` 按官方 `gJe` 的叠加语义优先。 */
    ...(effectiveModelName ? { model_name: effectiveModelName } : {}),
    ...(generation && Object.keys(nestedMedia).length > 0 ? { [generation.kind]: nestedMedia } : {}),
  };
  if (effectiveModelName) {
    notes.push(selectedModelRef
      ? '`request_json.model_name` = 用户在审批卡选定的模型（官方 `gJe` 的 modifications 叠加语义）。'
      : '`request_json.model_name` = `media_generate` 解析出的模型（真实数据；未解析到则不写）。');
  }
  if (generation?.prompt) {
    notes.push('`request_json.prompt` = `media_generate` 入参 prompt（真实数据）。');
  }
  if (Object.keys(nestedMedia).length > 0) {
    notes.push(`\`request_json.${generation?.kind}\` = 工具入参的 aspectRatio/resolution/duration/times（真实数据）。`);
  }
  const producedFields = new Set<string>();
  if (effectiveModelName) producedFields.add('request.request_json.model_name');
  if (generation?.prompt) producedFields.add('request.request_json.prompt');
  if (generation?.aspectRatio) producedFields.add('request.request_json.aspect_ratio');
  if (generation?.imageSize) producedFields.add('request.request_json.image_size');
  if (typeof generation?.times === 'number') producedFields.add('request.request_json.times');
  if (generation?.resolution) producedFields.add('request.request_json.resolution');
  if (typeof generation?.duration === 'number') producedFields.add('request.request_json.duration');

  const content: ToolEventContent = {
    ...officialContentBase(OFFICIAL_TOOL_GENERATION_CONFIRMATION, status, toolCall),
    request: {
      /* 官方 `bJe` @2225676：`typeof candidate.confirmation_id === "string"`。 */
      confirmation_id: approval.id,
      /* 官方 `yE` @2213870。 */
      request_kind: kind,
      /**
       * ⚠️ 第 61 轮（用户图 1 vs 图 2 实测）：这里**不再产 `detail.items[]`**。
       *
       * 官方 `Tse`(`hasConfirmationItems`) @2225040 的判据是 `detail.items[]` 非空 ⇒ 走 **v1 批量卡**
       * （`ett` = `BatchGenerationCard`：标题行 + 「N 个任务」 + 折叠的提示词行）。
       * 官方**单条**生成请求走的是 `yJe`（`LegacyGenerationCard`）——用户 图 2 那张官方卡片正是后者：
       * 提示词框（`line-clamp-5` + mask + Expand 按钮）+ 模型/比例/分辨率/张数 chips + 取消/确认。
       *
       * 旧注释里「不产 `detail` 会让官方 `Ott` 返回 null」是把两个族搞混了：`Ott` 是
       * `node_update_confirmation` 的判据；`generation_confirmation` 这边读的是 `cF`（载体解析，
       * `detail.request_json ?? request_json ?? (kind===v1 ? 自身 : null)`）⇒ 把载体放在 `request.request_json`
       * 一样能被 `yJe` 解析出 params（本文件测试里用官方解析器双向断言过）。
       */
      request_json: requestJson,
    },
    ...statusEnvelope(approval),
  };

  return {
    kind: approval.kind,
    family: 'generation_confirmation',
    content,
    item: toItem(content, approval),
    status,
    notes,
    missingMtvFields: missingMtvFields.filter((field) => !producedFields.has(field)),
  };
}

/**
 * `canvas_write` → 官方 `node_update_confirmation`（`iT` → `Btt`）。
 *
 * 官方 `Btt` @2358212：`const o=Ott(t); return o ? <Utt viewModel={o}/> : <ztt/>`。
 * MTV 的一次审批是**单个**工具调用 ⇒ 走 `ztt`（单请求卡），条件是 `Ott` 返回 `null`：
 * ```js
 * Ott = e => { for(const n of [e?.request,e?.response,e?.result,e]){ if(!yd(n)||typeof n.confirmation_id!="string"||!Dtt(n))continue;
 *   const o=Ltt(n); if(!o)continue; ... } return null }        // Ltt @2349966：detail.items[] 非空才返回数组
 * Ett = e => { for(const n of [...]){ if(!yd(n)||typeof n.confirmation_id!="string")continue;
 *   if(n.confirmation_kind==="node_update"||n.tool_name==="node_update_confirmation"||typeof n.node_ref==="string")return n } return null }
 * ```
 * ⇒ **不产 `detail`** 即可稳定落到 `ztt`（单卡），并且 `ztt` 会把 `request.summary` 当 body 文案：
 * ```js
 * y = i?.summary || o("chatAdapter.nodeUpdateConfirmation.defaultSummary","Update the node");
 * b = dre(i,l,y)     // dre @2348849：第 3 优先 `e?.summary || n`
 * ```
 * ⚠️ **MTV 无生产者**：官方 `changes[]` / `request_json.patch` / `request_json.replace_data` /
 * `node_ref` / `node_refs` 全都没有（MTV 的 `canvas_write` 只带脱敏 `inputSummary` 与
 * `inputDisplay`），所以 `Ftt` @2350101 会落到 `"Update the node"` 兜底、`ire` @2347734 得到空 nodeRefs
 * （⇒ `Kf` 缩略图行不渲染）、`Mtt` @2349067 得到 `null`（⇒ 卡上不出现 prompt 编辑按钮）。
 */
export function nodeUpdateConfirmationContent(
  approval: AgentApprovalSnapshot,
  toolCall?: AgentToolCallSnapshot | null,
): AgentApprovalContentResult {
  const status = approvalStatusToOfficialStatus(approval.status);
  const policySummary = typeof approval.summary === 'string' ? approval.summary.trim() : '';
  /**
   * 官方 `request.summary` 是**这次改动做了什么**（例：「新建 2 个画布节点」），**不是**审批原因
   * （官方卡上也不显示审批原因）。
   *
   * ⚠️ 第 59 轮修（用户图 4）：MTV 此前直接把 `approval.summary` 塞进 `request.summary`，而
   * `approval.summary` 存的是 **policy.reason**（`agentRoundExecutor` / `agentToolExecution` 里
   * `summary: policy.reason`）⇒ 卡正文显示成内部原因串「B 协作模式的画布写操作需要确认」。
   * 现在优先用工具自己的 `inputSummary`（= 工具 `summarizeInput` 的真实产物），原因串只作兜底。
   */
  const toolSummary = typeof toolCall?.inputSummary === 'string' ? toolCall.inputSummary.trim() : '';
  const summary = toolSummary || policySummary;

  const content: ToolEventContent = {
    ...officialContentBase(OFFICIAL_TOOL_NODE_UPDATE_CONFIRMATION, status, toolCall),
    request: {
      confirmation_id: approval.id,
      confirmation_kind: OFFICIAL_CONFIRMATION_KIND_NODE_UPDATE,
      /* 官方 `Ftt`/`dre` 读 `request.summary`；有真值就用 MTV 的 `policy.reason`。 */
      ...(summary ? { summary } : {}),
    },
    ...statusEnvelope(approval),
  };

  return {
    kind: approval.kind,
    family: 'node_update_confirmation',
    content,
    item: toItem(content, approval),
    status,
    notes: [
      '走 `Btt` → `ztt`（单卡）分支：故意不产出 `request.detail.items[]`，让官方 `Ott` 返回 null。',
      toolSummary
        ? '`request.summary` = 工具 `inputSummary`（= 官方语义「这次改什么」）。'
        : policySummary
          ? '`request.summary` = MTV `AgentApprovalSnapshot.summary`（policy.reason，工具无摘要时的兜底）。'
          : 'MTV 无 producer：摘要为空 ⇒ 官方 `Ftt` 回落硬编码英文 `"Update the node"`。',
    ],
    missingMtvFields: [
      'request.request_json.node_ref',
      'request.request_json.node_refs',
      'request.request_json.changes',
      'request.request_json.patch',
      'request.request_json.replace_data',
      'request.detail.items[].index',
    ],
  };
}

/**
 * `user_choice` → 官方 `AskUserQuestion`（`$b` → `Moe`）。
 *
 * 官方**生产者**（@2132894，逐字）：
 * ```js
 * e => { const t={status:"started",tool_call_id:e.question_id,tool_use_id:e.question_id};
 *   if(e.mode==="generation_confirmation"){...}
 *   return {...t,tool:"AskUserQuestion",
 *           request:{question_id:e.question_id,question:e.question,mode:e.mode,
 *                    options:e.options??[],...e.questions?{questions:e.questions}:{}}} }
 * ```
 * 官方**读侧**（@2133356 / @2133356 邻域，逐字）：
 * ```js
 * MB = (e,t,n) => !e||typeof e.question!="string"||!Array.isArray(e.options) ? null
 *      : {question_id:sQe(e.question_id,t,n),question:e.question,options:e.options,
 *         multiSelect:e.multiSelect===!0||e.mode==="multiple",header:...}
 * sQe = (e,t,n) => typeof e=="string"&&e ? e : `${t}#${n}`
 * jM  = e => 取 e.response.questions → e.request.questions → MB(e.response) → MB(e.request)
 * rQe = (e,t,n) => e || (Ioe(t,n).some(r=>r.length>0) ? "answered" : "cancelled")
 * ```
 * 官方 option 形状（`Xie` @2557583 `OptionRow`，逐字）：`e.label` / `e.description`，
 * 选中判定 `_.includes(K.label)` ⇒ `{label: string, description?: string}`（`label` 是**字符串**）。
 *
 * MTV 侧唯一可用来源是 `AgentApprovalInputRequest.kind === 'provider_models'` 的
 * `options: ProviderModelChoice[]`（`{id, name, category}`）：
 * · `name` → 官方 `label`（真字段翻译，不是等价实现）；
 * · 官方 `description` **不写**（MTV 的 `category` 是枚举、`id` 是内部标识，都不是官方 `description` 语义）；
 * · `mode` 写官方 `"multiple"` —— MTV `provider_models` 本身就是多选（`maxSelection`）。
 *
 * ⚠️ **两个 MTV 无生产者的硬缺口**（见 `missingMtvFields` / `notes`）：
 * 1. `inputRequest.kind === 'media_model'`（单模型选择）没有 options ⇒ 官方 `MB` 返回 null ⇒ 不产出 content；
 * 2. `AgentApprovalSnapshot` **不保存** `AgentApprovalResolution.inputValues` ⇒ 已作答时的
 *    官方 `response.answers[].selected_labels` 无来源。调用方可显式传 `userChoiceLabels` 补齐。
 *    未传时本模块**只在 pending 状态下产出** content（answered 态产出会被官方误判成 `cancelled`，
 *    那比自己断言更糟）。
 *
 * ⚠️ 另外：`$M` 的 `$b` 分支组件 `Moe`（@2135928，`displayName="AskQuestionSummary"`）在
 * `iQe`（@2135282）里 `if(i.length===0||c==="pending")return null` —— **pending 时它本来就不渲染**。
 * 真正可交互的 AskUserQuestion 卡是另一支（`jrt` @2558409 邻域 + `pendingQuestion` store），
 * 不在本轮的 `$M` 分派族里。本模块只保证 content 形状对得上。
 */
export function askUserQuestionContent(
  approval: AgentApprovalSnapshot,
  toolCall?: AgentToolCallSnapshot | null,
  userChoiceLabels?: readonly string[] | null,
): AgentApprovalContentResult {
  const status = approvalStatusToOfficialStatus(approval.status);
  const request = approval.inputRequest;
  const missingMtvFields: string[] = [
    'request.question_id（MTV 无独立 question_id，退回 approval.id）',
    'request.question（MTV 无提问文本，退回 approval.summary）',
    'request.header（MTV 无 producer）',
    'request.options[].description（MTV 无 producer）',
  ];

  if (!request || request.kind !== 'provider_models') {
    return {
      kind: approval.kind,
      family: 'ask_question',
      content: null,
      item: null,
      status,
      notes: [
        'MTV 无 producer：`AgentApprovalInputRequest.kind` 不是 `provider_models`（多半是 `media_model`，'
          + '它没有 options 数组）⇒ 官方 `MB` @2133356 要求 `Array.isArray(e.options)`，返回 null ⇒ 不产出 content。',
      ],
      missingMtvFields: [...missingMtvFields, 'request.options（MTV 无 producer）'],
    };
  }

  const options = request.options
    .filter((option) => typeof option?.name === 'string' && option.name.trim().length > 0)
    .map((option) => ({ label: option.name }));

  if (options.length === 0) {
    return {
      kind: approval.kind,
      family: 'ask_question',
      content: null,
      item: null,
      status,
      notes: ['MTV 无 producer：`provider_models.options` 为空或 `name` 全为空串 ⇒ 官方 `MB` 仍会返回 null ⇒ 不产出 content。'],
      missingMtvFields: [...missingMtvFields, 'request.options（MTV 有 producer 但本次为空）'],
    };
  }

  const notes: string[] = [
    '`request.options[].label` ← MTV `ProviderModelChoice.name`（真字段翻译；官方 `Xie` @2557583 只认 `label`/`description`）。',
    '`request.mode="multiple"` ← MTV `provider_models` 是多选（官方 `MB`：`e.mode==="multiple"` ⇒ `multiSelect`）。',
  ];
  const labels = Array.isArray(userChoiceLabels)
    ? userChoiceLabels.filter((label): label is string => typeof label === 'string' && label.length > 0)
    : [];
  let response: Record<string, unknown> = {};

  if (labels.length > 0) {
    /* 官方 `Ioe` @2134054：`content.response.answers[].question_id` 与 `l_` 的 `selected_labels`。 */
    response = { answers: [{ question_id: approval.id, selected_labels: labels }] };
    notes.push('`response.answers[].selected_labels` ← 调用方传入的 `userChoiceLabels`。');
  } else if (approval.status !== 'pending') {
    return {
      kind: approval.kind,
      family: 'ask_question',
      content: null,
      item: null,
      status,
      notes: [
        ...notes,
        'MTV 无 producer：`AgentApprovalSnapshot` 不保存 `AgentApprovalResolution.inputValues`'
          + ' ⇒ 官方 `response.answers[].selected_labels` 无来源；此时官方 `rQe` @2134572 会把卡判成'
          + ' `cancelled`（显示「未回答」）。为避免「自己断言」，已作答而拿不到 labels 时**不产出** content。',
      ],
      missingMtvFields: [...missingMtvFields, 'response.answers[].selected_labels', 'response.answers[].free_text'],
    };
  } else {
    notes.push('pending：官方 `Moe`（`iQe` @2135282）在 `c==="pending"` 时 `return null`，摘要卡本就不可见。');
  }

  const content: ToolEventContent = {
    ...officialContentBase(OFFICIAL_TOOL_ASK_QUESTION, status, toolCall),
    request: {
      question_id: approval.id,
      question: approval.summary,
      mode: OFFICIAL_ASK_QUESTION_MULTI_MODE,
      options,
    },
    ...response,
    ...(statusEnvelope(approval)),
  };

  return {
    kind: approval.kind,
    family: 'ask_question',
    content,
    item: toItem(content, approval),
    status,
    notes,
    missingMtvFields,
  };
}

/**
 * `file_write` / `permanent_delete` / `asset_write` → 官方 `desktop_fs_confirmation`（`kD` → `$Qe`）。
 *
 * 官方 `$Qe` @2162950 派生（逐字）：
 * ```js
 * d = e.request ?? e.result ?? {}        // ← confirmation_id / confirmation_kind 都在这层
 * u = String(d.confirmation_id ?? ""), p = String(d.confirmation_kind ?? "")
 * v = Boe(d)                             // @2159902：有 detail.request_json 就展开它，否则用 d 本身
 * HQe(t, p, d, w, m?.available)          // @2160228：标题走 BQe[p]，正文走 case p
 * ```
 * `BQe.desktop_fs`（@2159581）= `"Agent requests local folder access"`；
 * `HQe` 的 `desktop_fs` 分支只有 5 个具名 operation + 未知 operation 的兜底
 * `` `Operation: ${l}\nTarget: ${c}` ``。
 *
 * ⚠️ **本节是「可做部分」**，即只产**信封**（`tool` / `status` / `tool_call_id` /
 * `request.{confirmation_id,confirmation_kind}`），**不产 operation 数据**：
 * MTV 的 `file_write` / `permanent_delete` / `asset_write` 是 MTV 自有的 effect 分类
 * （写剧本/分集/镜头表文件、删对话/任务/历史/资产/画风、写资产库与角色库），
 * 与官方 `desktop_fs` 的 operation 值域（本地文件夹授权语义）**不是同一件事**。
 * 硬把 MTV toolId 塞进 `operation` 会假装它是官方 operation ⇒ 违反「不许自己断言」纪律。
 * 因此本函数**故意不写 `operation` / `file_grant_id` / `directory_grant_id` / `relative_path` /
 * `file_name` / `items` / `actions`**，卡会渲染成 `Operation: \nTarget: choose target after confirming`
 * —— 标题正确、正文降级。要补齐必须先由 MTV 侧定义 operation 生产者。
 */
export function desktopFsConfirmationContent(
  approval: AgentApprovalSnapshot,
  toolCall?: AgentToolCallSnapshot | null,
): AgentApprovalContentResult {
  const status = approvalStatusToOfficialStatus(approval.status);
  const content: ToolEventContent = {
    ...officialContentBase(OFFICIAL_TOOL_DESKTOP_FS_CONFIRMATION, status, toolCall),
    request: {
      confirmation_id: approval.id,
      confirmation_kind: OFFICIAL_CONFIRMATION_KIND_DESKTOP_FS,
    },
    ...statusEnvelope(approval),
  };

  return {
    kind: approval.kind,
    family: 'desktop_confirmation',
    content,
    item: toItem(content, approval),
    status,
    notes: [
      '只产信封：`request` 里只有官方 `$Qe` 必需的 `confirmation_id` / `confirmation_kind`。',
      '官方 `HQe` 的 5 个具名 operation（batch_write / batch_upload / pick_directory / pick_file / organize）'
        + ' MTV 全无生产者 ⇒ 落到兜底分支 ``Operation: ${l}\\nTarget: ${c}``，`operation` 为空串。',
      'MTV `AgentApprovalSnapshot.summary`（真实数据）在官方 `$Qe` 里**没有任何字段可承接**（标题来自'
        + ' `chatAdapter.desktopConfirmation.titles.${confirmation_kind}`，正文来自 `HQe`）⇒ 本卡不显示 MTV 摘要。',
      '官方 `desktop_fs` 语义是「本地文件夹授权」，与 MTV 这三个 effect 只是**形状上的**对应；'
        + '接线时必须知道这一点。',
    ],
    missingMtvFields: [
      'request.detail.request_json.operation',
      'request.detail.request_json.items',
      'request.detail.request_json.actions',
      'request.detail.request_json.directory_grant_id',
      'request.detail.request_json.file_grant_id',
      'request.detail.request_json.relative_path',
      'request.detail.request_json.file_name',
      'request.detail.request_json.batch_source',
    ],
  };
}

/* ============================================================================
 * 6. 总入口
 * ============================================================================ */

/** 按 `approval.kind` 分派到对应构造器。 */
export function approvalToOfficialContent(input: AgentApprovalContentInput): AgentApprovalContentResult {
  const { approval, toolCall, userChoiceLabels } = input;
  switch (approval.kind) {
    case 'media_generation':
      return generationConfirmationContent(approval, toolCall);
    case 'canvas_write':
      return nodeUpdateConfirmationContent(approval, toolCall);
    case 'user_choice':
      return askUserQuestionContent(approval, toolCall, userChoiceLabels);
    case 'file_write':
    case 'permanent_delete':
    case 'asset_write':
      return desktopFsConfirmationContent(approval, toolCall);
    case 'memory_write':
    case 'config_write':
      /* 官方**没有**这两族：`MNe/PNe/DNe/LNe` 并集不含任何「项目记忆 / 应用配置」确认卡。 */
      return {
        kind: approval.kind,
        family: null,
        content: null,
        item: null,
        status: null,
        notes: [
          `官方没有对应族：\`${approval.kind}\` 在 \`MNe\`(@442146)/\`PNe\`(@442160)/`
            + '`DNe`(@442228)/`LNe`(@442270) 四个确认卡集合里都没有载体 ⇒ 明确返回「无官方形状」。',
        ],
        missingMtvFields: [],
      };
  }
}

/** 便捷出口：只取官方 item（不可映射时为 `null`）。 */
export function approvalToOfficialToolEventItem(input: AgentApprovalContentInput): ToolEventItem | null {
  return approvalToOfficialContent(input).item;
}

/** 便捷出口：一条 `AgentStep`（`kind === 'approval'`）→ 官方 item。 */
export function approvalStepToOfficialToolEventItem(
  step: AgentStep,
  userChoiceLabels?: readonly string[] | null,
): ToolEventItem | null {
  if (!step.approval) return null;
  return approvalToOfficialToolEventItem({
    approval: step.approval,
    toolCall: step.toolCall,
    userChoiceLabels,
  });
}

/**
 * 批量：把一串 `AgentStep` 里**带审批**的步骤翻成官方 item（顺序 = 入参顺序）。
 * 供接线时一次性喂给 `assembleRawAgentMessageContents` 的 `contents` 直通口。
 */
export function approvalStepsToOfficialToolEventItems(
  steps: readonly AgentStep[],
  userChoiceLabelsByApprovalId?: Readonly<Record<string, readonly string[]>> | null,
): ToolEventItem[] {
  const out: ToolEventItem[] = [];
  for (const step of steps) {
    if (!step.approval) continue;
    const labels = userChoiceLabelsByApprovalId?.[step.approval.id] ?? null;
    const item = approvalStepToOfficialToolEventItem(step, labels);
    if (item) out.push(item);
  }
  return out;
}

/* ============================================================================
 * 7. 自检：产出的 content 必须让官方谓词命中（供测试与接线方各用一次）
 * ============================================================================ */

/**
 * 自检入口：产出的 item 是否**真的**被官方 `$M` 分派到预期族。
 * 直接复用 `agentMessageContents.classifyToolEventFamily`（它已逐字复刻 `$M` 的 13 个分支），
 * 不在本模块重写一套谓词 —— 两边一旦漂移测试就会红。
 */
export function contentHitsExpectedFamily(result: AgentApprovalContentResult): boolean {
  if (!result.item || !result.family) return false;
  return classifyToolEventFamily(result.item) === result.family;
}
