/**
 * textVariants —— 「文本卡生成次数（1x）」的官方口径
 *
 * 官方出处（`zoom-slider-3ZcFvYQO.js`，逐字）：
 *   · 文本卡底行组件 `zee` = `TextGenerationControls`（@3378851）把 times 交给 `mx`：
 *       `times:Ie, onTimesChange:Qe, timesOptions:[1,2,3,4].slice(0, t || Jrt)`
 *     其中 `t` = `zee` 的 `timesLimit` prop；`Jrt = 4`（@3378845）。
 *     ⚠️ 生成文本节点 `Uee`(@3388353) 调 `l.jsx(zee,{nodeId,onGenerate,visible:!0,isGenerating})`
 *        **不传 `timesLimit`** ⇒ 文本卡实际就是 **[1,2,3,4]**。
 *   · times 的读写（`zee` @3383190 附近）：
 *       `const {internalValue:Ie, handleChange:Qe} = Yc(b.currentCount || 1, oe => {
 *          v({times: oe});              // updateParams({times})
 *          b.model && G(b.model, {times: oe})   // 记到模型配置
 *        })`
 *     而 `b.currentCount = s?.params?.times || 1`（图/视频面板同款，见 @3162712 / @3271391）
 *     ⇒ **官方 times 存在节点 `params.times`，默认 1**。
 *   · 结果落库（生成入口 @2827275 / 结果回填 @1022981）：
 *       `Q = I.params?.times || 1` · `q = _.requestedResultCount ?? Q` ⇒ **目标节点数 = times**；
 *       `Bqe`（= 文本版 `dO` @2794625）走 `resultsPerRequest: 1` ⇒ **每个节点各发一次请求**；
 *       克隆体由 `Dqe` @2793626 造（首次生成 = 源节点 + N-1 个克隆，克隆体 `params.times` 强制回 1），
 *       布局 `Nqe` @2792075（SPREAD：`bG=64`、`cols=ceil(sqrt(N))`、源节点留在原地），
 *       入边 `Oqe` @2794374 逐条复制；结果按 `resultIndex` 写回各自节点 `data.text`（`qTe`）。
 *       ⇒ **文本「N 次」不是「一个节点里 N 条正文」，而是画布上 N 个兄弟节点** ✓
 *   · 多样体本地队列（`historyLocalQueues`/`options`/`historyVariantCount`/`historyLocalQueueMetadata`）
 *     只在 **IMAGE / VIDEO / AUDIO** 分支合并（`INe` 的调用点 @1038815 明确
 *     `if(M===he.IMAGE||M===he.VIDEO||M===he.AUDIO)`）⇒ **文本卡没有本地变体队列** ✓
 *
 * 落地口径：
 *   · MTV 的节点参数是扁平 `data.batchCount`（沿用图卡既有字段）⇒ 文本卡也用它
 *   · N 个兄弟节点由 `services/textVariantService.ts` 创建（克隆体清空 `output`、`batchCount: 1`、
 *     复制源节点入边、按官方 SPREAD 网格落位），每个节点各调用一次 `generateText`
 *     （MTV 的 `generateText` 没有 times 参数，官方也是每节点一条请求 ✓ 语义一致）
 */
export const TEXT_TIMES_OPTIONS = [1, 2, 3, 4] as const;

/** 官方 `Jrt = 4`（@3378845）：文本卡 timesOptions 的上限 */
export const TEXT_MAX_VARIANTS = 4;

/** 官方 `params.times || 1` + `[1,2,3,4]` 上限：把任意存量值收敛成合法的生成次数 */
export function resolveTextTimes(value: unknown): number {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count) || count < 1) return 1;
  return Math.min(TEXT_MAX_VARIANTS, count);
}
