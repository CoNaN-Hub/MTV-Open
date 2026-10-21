/**
 * 官方「媒体生成失败」文案 —— `chatAdapter.agentEvent.toolDescriptions.*` family 逐字移植。
 *
 * ⚠️ 背景：MTV 原来在 `MessageBubble` 里自造了一条
 * `t('媒体生成失败：{error}')`（「媒体生成失败：<原始报错>」）。**官方产物里没有这种句式**：
 * `_findall2.mjs 媒体生成失败` 在 4 个官方产物里命中 **0**（实测）。官方把「生成失败」表达成
 * **tool event 的失败描述**（`toolDescriptions.<tool>.failed_one`），渲染在工具行上。
 *
 * 官方取值（`live-assets-new/vendor-pkg-canvas-CvbAwZyy.js`，`toolDescriptions` 各语言块）：
 * ```jsonc
 * // zh 块 @4294602 起（`legacyToolEvent` 之后）
 * "gen_image": { "failed_one": "图片生成失败，本次生成不会消耗积分。" },   // @4295705
 * "gen_video": { "failed_one": "视频生成失败，本次生成不会消耗积分。" },   // @4296252
 * "fallback":  { "failed_one": "{{label}} 执行失败。" }                    // @4295361
 * // en @3602627 / fr @3811234 / ja @4015236 / ko @4155654 同结构
 * "gen_image.failed_one": "Failed to generate the image. This generation will not consume credits."
 * "gen_video.failed_one": "Failed to produce the video. This generation will not consume credits."
 * ```
 * 四语取值已逐字落进 `src/i18n/locales/{en-US,ja-JP,ko-KR}/chat.ts`（zh 即键本身）。
 *
 * ⚠️ **官方没有 `gen_audio` 的失败文案**（实测：四个语言的 `toolDescriptions` 里都**没有** `gen_audio`
 * 键 —— 官方只有 `gen_image` / `gen_video`；`gen_audio` 只出现在工具名集合 @455973 与
 * kind 映射 @2252963）。所以音频那一档用**官方通用失败模板**
 * `toolDescriptions.fallback.failed_one` = `{{label}} 执行失败。`，label 取**官方音频媒体类型标签**
 * `chatAdapter.agentEvent.featureTag.audio`（zh `音频` / en `Audio` / ja `音声` / ko `오디오`，
 * @4368253 邻域）。⇒ 这是**两个官方字符串的合成**，报告里登记为「MTV 适配点」。
 *
 * ⚠️ 另有一处**未采用**的官方串：`panoramaEdit.generationFailed` = `生成失败，本次生成不会消耗积分。`
 * （zh @4368654）。它读起来像「通用媒体生成失败」，但命名空间是**全景图编辑**（`panoramaEdit`）
 * ⇒ 不借用来冒充通用文案。
 */

/* ── 官方 `chatAdapter.agentEvent.toolDescriptions.*.failed_one` 的**中文原文**（= MTV i18n key）。 ── */

/** 官方 `toolDescriptions.gen_image.failed_one`（zh @4295705 逐字）。 */
export const MEDIA_FAILED_IMAGE = '图片生成失败，本次生成不会消耗积分。';

/** 官方 `toolDescriptions.gen_video.failed_one`（zh @4296252 逐字）。 */
export const MEDIA_FAILED_VIDEO = '视频生成失败，本次生成不会消耗积分。';

/**
 * 音频：官方**无** `gen_audio.failed_one` ⇒ 用官方通用模板
 * `toolDescriptions.fallback.failed_one`（`{{label}} 执行失败。`）+ 官方 `featureTag.audio`（`音频`）。
 * 合成结果 = `音频 执行失败。`
 */
export const MEDIA_FAILED_AUDIO = '音频 执行失败。';

/**
 * 媒体类型未知时的兜底。
 *
 * 官方 `canvas.agent.generationFailed` = `生成失败`（zh @4319677 / @4329651，
 * `canvas.agent` 命名空间，官方用它标画布节点/批次的生成失败）—— 这是官方最短的那条
 * 「生成失败」，**不含**「不消耗积分」承诺 ⇒ 只在拿不到 `mediaResult.kind` 时用。
 */
export const MEDIA_FAILED_UNKNOWN = '生成失败';

/** MTV 的 `t` 签名（`src/i18n`）：中文原文 key → 当前语言译文。 */
export type MediaFailureTranslate = (text: string) => string;

/**
 * 按媒体类型取官方失败文案。
 *
 * @param kind       `message.mediaResult?.kind`（`'image' | 'video' | 'audio'`，官方 `$M` 同族）
 * @param translate  MTV 的 `t`
 */
export function resolveMediaFailureText(
  kind: string | null | undefined,
  translate: MediaFailureTranslate,
): string {
  if (kind === 'image') return translate(MEDIA_FAILED_IMAGE);
  if (kind === 'video') return translate(MEDIA_FAILED_VIDEO);
  if (kind === 'audio') return translate(MEDIA_FAILED_AUDIO);
  return translate(MEDIA_FAILED_UNKNOWN);
}
