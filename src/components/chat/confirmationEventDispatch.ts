/**
 * 确认卡分发的**非组件**部分（谓词 + store 切片推导）—— 官方消息渲染器 @2427106 的两条分支：
 * ```js
 * if (dg(e)) return s.jsx(qet, {content: e.content, onAnswer: l, generationFailedMap: h});
 * if (iT(e)) return s.jsx(Btt, {content: e.content, onAnswer: l});
 * ```
 * `dg` / `iT` 均读 `e.content.tool`（`xl` @443724，**大小写敏感**，无 `.toLowerCase()`）。
 *
 * 官方 `onAnswer` 读取 store 切片 `hs`（`pendingConfirmation` / `resolvedConfirmations`）；
 * MTV 没有同一 store ⇒ 这里从 tool_event 自身推导等价切片（**不虚构状态**）。
 */
import { answerActionOf, type ConfirmationStoreSlice } from '../../services/chat/generationConfirmation';
import type { AgentApprovalResolution } from '../../types/agent';
import {
  extractFallbackViewModel,
  isGenerationConfirmationTool,
  isGenerationRequestTool,
  isNodeUpdateConfirmationTool,
  parseGenerationConfirmationLegacy,
  parseGenerationConfirmationV1,
} from '../../services/chat/generationConfirmationProtocol';
import {
  collectNodeUpdateRefs,
  extractNodeUpdateViewModel,
  nodeUpdateCarrierOf,
} from '../../services/chat/nodeUpdateConfirmation';

export interface ConfirmationAnswerEventDetail {
  confirmationId: string;
  action: 'confirm' | 'reject';
  payload?: unknown;
  tool: string;
  content: Record<string, unknown>;
}

/** 官方 `dg(e) || iT(e)`（`qNe` 的两项；`desktop_*` 属第 3 章，不在本任务范围）。 */
export function isConfirmationCardToolEvent(tool: unknown): boolean {
  return isGenerationConfirmationTool(tool) || isNodeUpdateConfirmationTool(tool);
}

/**
 * 官方 `eet`（自动模式预览卡）的分派条件（渲染器 @2428328 邻域，逐字）：
 * ```js
 * if (ib(e) && !f) {                 // ib = tool_event && XNe.has(tool)
 *   const T = e.content;
 *   if (T.status === "completed" || T.status === "failed") return s.jsx(eet, {content: T});
 * }
 * ```
 * `XNe = new Set(["gen_image","gen_video","generation_request"])`（**大小写敏感**）。
 */
export function isAutoPreviewCardEvent(content: Record<string, unknown>): boolean {
  if (!isGenerationRequestTool(String(content.tool ?? ''))) return false;
  const status = content.status;
  return status === 'completed' || status === 'failed';
}

/** 官方 `Qet` / `bJe` / `yJe` 的 confirmationId（逐级回退，与 `qet` 的分支顺序一致）。 */
export function generationConfirmationIdOf(content: Record<string, unknown>): string {
  const v1 = parseGenerationConfirmationV1(content);
  if (v1) return v1.confirmationId;
  const legacy = parseGenerationConfirmationLegacy(content);
  if (legacy) return legacy.confirmationId;
  return extractFallbackViewModel(content)?.confirmationId ?? '';
}

/** 官方 `Ett` / `Ott` 的 confirmationId。 */
export function nodeUpdateConfirmationIdOf(content: Record<string, unknown>): string {
  const viewModel = extractNodeUpdateViewModel(content);
  if (viewModel) return viewModel.confirmationId;
  const carrier = nodeUpdateCarrierOf(content);
  if (!carrier) return '';
  if (typeof carrier.confirmation_id === 'string') return carrier.confirmation_id;
  /* 与官方 `ztt` 的 `ire(i)` 调用形状对齐（这里不消费结果）。 */
  collectNodeUpdateRefs(carrier);
  return '';
}

/**
 * 从 tool_event 自身推导官方 `hs` store 切片。
 *
 * 逐字对应官方 `Ff` 的两级回退：
 *   · `status === "started"` 且尚无 answer action ⇒ 官方此时必有 `pendingConfirmation`（可交互）
 *   · 否则走 `content.status`（`completed` → confirmed/rejected，`failed` → rejected/skipped）
 *
 * ⚠️ round 111 修正：MTV 的写侧适配层（`agentApprovalContents.approvalStatusToOfficialStatus`）
 * 刻意用 **`"pending"`**（不是官方的 `"started"`）表示未决 —— 该文件 @178 的注释写明：
 * 「本模块**必须**用 `"pending"` 而不是 `"started"`，否则在官方 store 切片未接线时 `Of` 会把卡整张吞掉」。
 * 而这里原先只认 `"started"` ⇒ **MTV 产出的每一张确认卡都拿不到 `pendingConfirmation`**
 * ⇒ `interactive === false` ⇒ `GenerationConfirmationCard` 的卡脚门
 * （`visual === "pending" && interactive`，@716）不成立 ⇒ **「取消 / 确认」两颗按钮根本不渲染**，
 * 用户看到的就是「没有确认环节」。因此未决状态必须同时认 MTV 自己的 `"pending"`。
 */
export function confirmationStoreSliceOf(
  content: Record<string, unknown>,
  isNodeUpdate: boolean,
): ConfirmationStoreSlice | null {
  const result = content.result as Record<string, unknown> | undefined;
  const status = content.status ?? result?.status;
  const confirmationId = isNodeUpdate
    ? nodeUpdateConfirmationIdOf(content)
    : generationConfirmationIdOf(content);
  if (!confirmationId) return null;
  if ((status === 'started' || status === 'pending') && answerActionOf(content) == null) {
    return {
      pendingConfirmation: {
        confirmationId,
        status: 'pending',
        kind: isNodeUpdate ? 'node_update' : undefined,
      },
    };
  }
  return { resolvedConfirmations: {} };
}

/* ------------------------------------------------------------------ *
 * round 111：卡片 confirm/reject 的上行通道（「下了指令没有确认/没后续」的根因）
 * ------------------------------------------------------------------ */

/**
 * 官方消息渲染器 `NP` 的确认卡分支（`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js`
 * 的 `generationFailedMap:h` 处 @2458469 邻域，逐字）：
 * ```js
 * if (Eg(e)) return s.jsx(pot, { content: e.content, onAnswer: l, generationFailedMap: h });
 * if (TE(e)) return s.jsx(Zot, { content: e.content, onAnswer: l });
 * ```
 * `l` 由消息行 `_le` 一路透传（`onAnswerConfirmation:l` @2639873 / @2649282 / @2650315），
 * 最终来自会话 hook 的 `answerConfirmation`（@2790511 / @2801547 的 `answerConfirmation:Ye`）
 * ⇒ **官方在「代理下达生成指令」后确实有一张需要用户点一下的确认卡，确认即把答案上行、开始生成。**
 *
 * MTV 的等价上行通道 = `AgentTaskControls.onResolveApproval`（→ `resolveAgentApproval`，
 * 会 resolve 掉 `agentRoundExecutor` 里 `waitForAgentApproval` 的 promise，审批流才继续）。
 * 本函数把官方卡片的三参回调 `(confirmationId, action, modifications)` 映射成
 * `AgentApprovalResolution`。
 *
 * ⚠️ `resolveApprovalSelection`（`agentRoundExecutor.ts`）对 `inputRequest.kind === 'media_model'`
 * 要求 `inputValues.modelRef`，缺失即 `deny('确认生成前必须选择一个可用模型')` ⇒ 只批准是不够的，
 * 必须带上模型。取值优先级：
 *   1. `modifications.model_name`（用户真的在模型 chip 上改过 —— 官方 `rot`/`sot` 只在「改了」时才写）；
 *   2. 卡片载荷 `request_json.model_name`（= `media_generate` 解析出的真实模型）；
 * 两者都没有 ⇒ **不补默认值**（与官方「不写就是没值」一致），此时 `media_model` 审批会被下游拒绝并给出理由。
 */
export function confirmationAnswerResolution(
  action: 'confirm' | 'reject',
  payload: unknown,
  content?: Record<string, unknown>,
): AgentApprovalResolution {
  if (action !== 'confirm') return { approved: false };
  const modifications = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const request = content?.request as Record<string, unknown> | undefined;
  const requestJson = request?.request_json as Record<string, unknown> | undefined;
  const detail = request?.detail as { items?: Array<{ request_json?: Record<string, unknown> }> } | undefined;
  const candidates = [
    modifications.model_name,
    requestJson?.model_name,
    detail?.items?.[0]?.request_json?.model_name,
  ];
  const modelRef = candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0);
  /**
   * ★ 2026-10-15：**比例 / 清晰度 / 分辨率 / 时长 / 张数** 一并上行。
   *
   * 官方 `qet` 的 `onAnswer(confirmationId, action, modifications)` 第三参由官方 `Mv`
   * （`live-assets-new/vendor-pkg-canvas-CvbAwZyy.js` 的 chip 控制器邻域，见
   * `generationChipController.buildWireModifications`）编码成 **wire 名**：
   * `aspect_ratio` / `image_size` / `resolution` / `duration` / `times`（`ETT` @2241685 表）。
   * 服务端拿它做 `gJe` 的逐字段叠加 ⇒ 用户改过的值优先。
   *
   * 这里把它翻回**工具入参的 camelCase**（`media_generate` 的 `GenerateMediaInput` /
   * `AgentApprovalInputValues`），由 `resolveApprovalSelection` 叠进本轮有效入参 ——
   * 否则「卡上选了 2K」只会改 UI 文案，真正发出去的还是旧值（用户现场：「点了没反应」）。
   *
   * ⚠️ 只认**用户真的改过**的键：官方 `rot`/`nG` 只在「与原始 params 不同」时才写该键
   * ⇒ 这里的 `modifications` 天然只含改动项，不会把「没动」误报成「改过」。
   */
  const pickString = (...keys: readonly string[]): string | undefined => {
    for (const key of keys) {
      const value = modifications[key];
      if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
    return undefined;
  };
  const aspectRatio = pickString('aspect_ratio', 'aspectRatio');
  const imageSize = pickString('image_size', 'imageSize');
  const resolution = pickString('resolution');
  const durationRaw = modifications.duration;
  const duration = typeof durationRaw === 'number' && Number.isFinite(durationRaw) && durationRaw > 0
    ? durationRaw
    : undefined;
  const timesRaw = modifications.times;
  const times = typeof timesRaw === 'number' && Number.isInteger(timesRaw) && timesRaw > 0
    ? timesRaw
    : undefined;
  const inputValues = {
    ...(modelRef ? { modelRef } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(imageSize ? { imageSize } : {}),
    ...(resolution ? { resolution } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(times !== undefined ? { times } : {}),
  };
  return { approved: true, ...(Object.keys(inputValues).length > 0 ? { inputValues } : {}) };
}

/* ------------------------------------------------------------------ *
 * round 118：待决生成确认卡的**去重键**（供「自动展开」用，MTV 自有增强）
 * ------------------------------------------------------------------ */

/**
 * **用户 2026-10-15 追加裁决**：待决的媒体生成审批出现时，要把它所在的那一节
 * **自动展开**，让官方确认卡在消息流里直接可见（解决 round 117 收口后的可发现性下降）。
 *
 * 本函数给出「**这一批 tool_event 里有没有一张还在等用户点确认的生成确认卡**」，
 * 有 ⇒ 返回它的 `confirmationId`（用作「同一步骤不重复展开」的去重键），没有 ⇒ `null`。
 *
 * 判据与读侧**完全同源**（不新增一套判定）：
 *   · `content.tool === 'generation_confirmation'` —— 该 content 只由
 *     `agentApprovalContents.approvalToOfficialContent` 的 `case 'media_generation'` 产出，
 *     而 `generationConfirmationContent` 只在 `inputRequest.kind === 'media_model'` 时给 content
 *     ⇒ 这一条**等价于** `agentActivityItems.approvalRendersGenerationCard(step)` 为真
 *     （即 round 117 收掉 MTV 审批卡、交给官方卡的那一类）。
 *   · `confirmationStoreSliceOf(content,false)?.pendingConfirmation` 命中 —— 即「仍未决议」
 *     （`content.status` 为 `'started' | 'pending'` 且还没有 answer action；与 round 111 的卡脚门同源）。
 *
 * ⚠️ **round 118 实测更正**：MTV 的确认卡是**独立 `cards` 段**（`messageContents.isCardToolItem`），
 * 而折叠摘要只吸收 `tools`/`text`/`thinking` ⇒ 这个键当前**恒不改变**确认卡的可见性。
 * 它的真实用途是 `AgentStepsSection` 的**不变量守卫**（待决确认绝不能被折叠摘要在视觉上藏住），
 * 详见 `AgentStepsSection.pendingConfirmationKey` 的注释。
 */
export function pendingGenerationConfirmationKey(
  items: readonly { content?: unknown }[] | null | undefined,
): string | null {
  for (const item of items ?? []) {
    const content = (item?.content ?? null) as Record<string, unknown> | null;
    if (!content || !isGenerationConfirmationTool(content.tool)) continue;
    const pending = confirmationStoreSliceOf(content, false)?.pendingConfirmation;
    if (pending?.confirmationId) return pending.confirmationId;
  }
  return null;
}
