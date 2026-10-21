/**
 * 官方「Agent 错误文案」解析器 —— `Jct` 逐字移植。
 *
 * 官方原文（`live-assets-new/vendor-pkg-canvas-CvbAwZyy.js`，函数起点 **@2713029**，逐字）：
 * ```js
 * function Jct(e,t,n=!1){return e.message?.trim()?e.message
 *   :t(e.reason==="runtime_stream_timeout"
 *       ? n?"chatAdapter.errors.compactionTimeout":"chatAdapter.errors.runtimeStreamTimeout"
 *       :"chatAdapter.errors.agentErrorFallback")}
 * ```
 * 语义（**没有前缀**，这是本次收口的核心）：
 *   · 有 `message` ⇒ **原样**返回（不做任何拼接、不加「处理失败:」这类 MTV 自造前缀）；
 *   · 没有 ⇒ 用官方 i18n 兜底键：
 *       `reason === "runtime_stream_timeout"` → 压缩中 `chatAdapter.errors.compactionTimeout`，
 *       否则 `chatAdapter.errors.runtimeStreamTimeout`；
 *       其余 → `chatAdapter.errors.agentErrorFallback`。
 *
 * 官方调用点（`@2754131`，逐字）：
 * ```js
 * const Ot=Jct(Xe,u,mt);
 * l.appendMessageContent(yt(),{type:"agent_error",content:Ot},ie)
 * ```
 * ⇒ 文案的落点是 **`agent_error` item 的 `content`**，不是消息正文。
 *
 * ⚠️ MTV 适配点：官方把 i18n **键路径**（`chatAdapter.errors.*`）交给 `t`；MTV 的 i18n 约定是
 * 「**中文原文即 key**」（`src/i18n/index.ts` @65：`DICTS[locale][text] ?? text`），所以这里传的
 * 是官方词典里的**中文原文**。四语词条已按官方逐字补进 `src/i18n/locales/{en-US,ja-JP,ko-KR}/chat.ts`
 * （zh 即键本身，无需词条）。官方四语取值与偏移见各词条上的注释。
 */

/* ── 官方 `chatAdapter.errors.*` 的**中文原文**（= MTV 的 i18n key）—— 逐字取自官方 zh 词典。 ── */

/** 官方 `chatAdapter.errors.agentErrorFallback`（zh 块 `errors`，@4304467 邻域逐字）。 */
export const AGENT_ERROR_FALLBACK = 'Agent 本轮执行失败，请重试。';

/** 官方 `chatAdapter.errors.runtimeStreamTimeout`（同上 zh 块）。 */
export const RUNTIME_STREAM_TIMEOUT = '云端任务长时间未返回进展，已超时。可以重试继续。';

/** 官方 `chatAdapter.errors.compactionTimeout`（同上 zh 块）。 */
export const COMPACTION_TIMEOUT = '云端任务在压缩上下文期间超时，本轮已停止。此前完成的操作不会回滚；继续时请复用已有成果。';

/**
 * 官方 `chatAdapter.errors.streamProcessingError`（同上 zh 块）。
 *
 * 官方写入口用它兜底（`@2767521` / `@2767889` 逐字）：
 * ```js
 * l.updateMessage(id,{contents:[{type:"agent_error",content:u("chatAdapter.errors.streamProcessingError")}]},ie)
 * ```
 */
export const STREAM_PROCESSING_ERROR = '流式处理出错，请重试。';

/**
 * 官方 `chatAdapter.errors.sendFailed`（同上 zh 块）。
 *
 * 官方写入口的**最后**兜底（`@2793225` / `@2795527` / `@2798291` 逐字）：
 * ```js
 * const xt=zM(Be,u)||(Be?.code?u(`errorCodes.${Be?.code}`):u("chatAdapter.errors.sendFailed"));
 * Ht||W.updateMessage(Ut.id,{contents:[{type:"agent_error",content:xt}]},le)
 * ```
 * ⇒ 优先级：**真实报错文本** → 官方 `errorCodes.*` → `sendFailed`。
 * ⚠️ MTV 没有官方那套 `errorCodes` 表（服务端错误码），故这一档留空、直接落到 `sendFailed`。
 */
export const SEND_FAILED = '抱歉，发生了错误。请稍后重试。';

/** `Jct` 的入参形状（官方 `e.message` / `e.reason`）。 */
export interface AgentErrorLike {
  message?: string | null;
  reason?: string | null;
}

/** MTV 的 `t` 签名（`src/i18n`）：中文原文 key → 当前语言译文。 */
export type AgentErrorTranslate = (text: string) => string;

/** 官方 `Jct` 的 `reason` 常量（`runtime_stream_timeout`）。 */
export const RUNTIME_STREAM_TIMEOUT_REASON = 'runtime_stream_timeout';

/**
 * 官方 `Jct(e, t, n = false)` **逐字**移植。
 *
 * @param error    `{ message, reason }`（官方事件对象；MTV 侧是「错误对象 / 任务错误字段」的适配形状）
 * @param translate 官方 `t`（MTV = `useT()` / `i18n.t`）
 * @param compacting 官方第三个参数 `n`：为 true 时 `runtime_stream_timeout` 用 `compactionTimeout` 文案
 */
export function resolveAgentErrorMessage(
  error: AgentErrorLike | null | undefined,
  translate: AgentErrorTranslate,
  compacting = false,
): string {
  const message = error?.message?.trim();
  if (message) return message;
  return translate(
    error?.reason === RUNTIME_STREAM_TIMEOUT_REASON
      ? (compacting ? COMPACTION_TIMEOUT : RUNTIME_STREAM_TIMEOUT)
      : AGENT_ERROR_FALLBACK,
  );
}
