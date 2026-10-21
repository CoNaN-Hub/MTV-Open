/**
 * 官方「模型思考徽标」（`thinkingOff` / 档位标签）—— 逐字取证与落地点。
 *
 * ## 官方逐字取证
 * 产物：`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`
 * （新构建 `vendor-pkg-canvas-CvbAwZyy.js` 逐字同义，仅压缩名不同：`bq→EK`、`dye→Gbe`、`SR→fD`、`yq→TK`）
 *
 * | 官方符号 | 偏移 | 逐字 |
 * |---|---|---|
 * | `bq(model, settings, t)` | **56177**（`bq=` 定义；`thinkingOff` 字面量就在 56177） | `` bq=(e,t,n)=>{const o=SR(e,t);return!o||!e.thinking?.levels?.length?null:o.enabled?o.level?yq(o.level,n):null:n?.("chatAdapter.modelOptions.thinkingOff","Thinking off")||"Thinking off"} `` |
 * | `dye(model, settings)` | 56177 邻域（紧随 `bq`） | `dye=(e,t)=>SR(e,t)?.enabled?!!e.thinking?.levels?.length:!1` |
 * | `yq(level, t)` | 56128 | `` yq=(e,t)=>{const n=cye(e);return t?.(`chatAdapter.modelOptions.levels.${e}`,n)||n} `` |
 * | `SR(model, settings)` | 55673 | `SR=(e,t)=>{const n=t||xq(e);return n?n.enabled||CR(e)?n:{...n,enabled:!0}:null}` |
 *
 * ### 条件（逐字）
 * `bq` 输出文案的**充要条件**：`SR(model, setting)` 非空 **且** `model.thinking.levels.length > 0`，然后
 *   · `resolved.enabled === false` ⇒ 文案 = `t("chatAdapter.modelOptions.thinkingOff", "Thinking off")`
 *   · `resolved.enabled === true`  ⇒ `resolved.level ? levels.<level> 标签 : null`
 * ⇒ 「读哪个 store 字段」= **`chatModelThinkingSettings[model.id]`**（官方 `r?.[fe.id]` / `c[B.id]`），
 *   不是别的字段。`enabled === false` 就是关闭态（`SR` 只在 `can_disable !== false` 时保留 `enabled:false`）。
 *
 * ### 位置与 class（逐字）
 * | 落点 | 偏移 | 逐字 |
 * |---|---|---|
 * | **列表行**（`lbe`，普通行） | **80054** | `{n?s.jsx("span",{className:"shrink-0 text-[11px] leading-4 text-text-text-secondary/55",children:n}):null}` —— 在**模型名之后**、`flex min-w-0 flex-1 items-baseline gap-2` 里；`n` 由调用处 **86944** 传入：`const ke=r?.[fe.id],we=dye(fe,ke)?bq(fe,ke,L):null` |
 * | **触发器**（`Ae` 模型胶囊，官方 `H`） | **91841** → 渲染点 **~95420** | `H=B?bq(B,c[B.id],(Re,De)=>h(Re,De)):null`，渲染 `` s.jsx("span",{className:"ml-1 shrink-0 border-l border-border/60 pl-1.5 text-[11px] leading-4 text-text-text-secondary",children:H}) `` |
 *
 * ### 官方在**列表行**上有 `dye` 闸门（§82.8 已按官方原样收回）
 * 官方列表行 = `dye(fe,ke) ? bq(fe,ke,L) : null`（调用处 **86944**），而 `dye` 在 `enabled === false`
 *   时恒为 `false` ⇒ **官方列表行只显示档位标签（低/中/高/…），永远不显示「思考关闭」**。
 * 「思考关闭」在官方只在**触发器**（`H`，**无** `dye` 闸门）出现。
 * ⇒ 本模块提供两个函数，严格对应官方两处：
 *   · `modelRowThinkingSummary`  —— 官方**行**：`dye ? bq : null`（关闭态**不渲染**任何徽标）
 *   · `modelThinkingSummary`     —— 官方**触发器** `H`：只有 `bq`（关闭态渲染「思考关闭」）
 * 画布节点那侧的模型下拉（官方 `Sme`）**根本没有 summary 槽** ⇒ `agentStyle` 之外不渲染（与官方一致）。
 *
 * ### 文案来源（MTV 已有官方逐字表）
 * `getModelPickerText('thinkingOff', locale)`（`modelPickerStrings.ts` @19 · 官方 zh 字典在
 * `vendor-pkg-canvas-ChpWx5JY.js` **4218048**）：zh「思考关闭」/ en「Thinking off」/ ja「思考オフ」/ ko「사고 끔」。
 * 档位标签走 `localizeLevel`（官方 `yq` → `chatAdapter.modelOptions.levels.<code>`，zh 字典同址 4218020 邻域）。
 *
 * ### 元数据来源（与 MTV 的思考控件保持同口径）
 * `resolveThinkingMetaForModel(model)` —— 与 `ChatThinkingPanel`/`AgentModelFlyout` 里的控件**同一个函数**
 * （模型自带 `model.thinking` → 用户连接目录只读匹配 → ★§78 已登记的兜底★）。
 * 用同一个函数是为了保证「控件说关闭 ⇒ 徽标就说思考关闭」，绝不出现两者互相矛盾。
 * 代价（§78 同款）：MTV 的模型目录没有服务端 `thinking` ⇒ 聊天模型列表里**开着的**每一行都会带一颗
 * 档位徽标（默认档 = 官方 `||` 链的 `levels[0]` = `low` ⇒ zh「低」）。
 * **这不是官方「行必有」的行为**，而是 §78 那条兜底偏离的必然延伸，如实登记。
 *
 * ### ⚠️ 顺带修掉的逐字 bug（`modelThinking.ts`）
 * `normalizeThinkingSetting`（官方 `SR` @55673）原实现把判据写反了：
 *   `if (resolved.enabled || !canDisableThinking(model)) return resolved;`
 * 官方是 `n.enabled || CR(e) ? n : {...n, enabled:true}`（`CR` = **可关**思考）。
 * 取反的后果：**可关**思考的模型（`can_disable` 缺省）被强制改回 `enabled: true`
 *   ⇒ `bq` 永远走不到「思考关闭」支。该函数此前只被 `thinkingSummaryLabel` / `isThinkingRowVisible`
 * 调用（两者在 §82 之前无人使用）⇒ 一直没暴露。已按官方逐字改回（`!canDisableThinking` → `canDisableThinking`）。
 */
import type { ChatModelThinkingSetting } from '../../types/chat';
import { resolveThinkingMetaForModel } from './configuredModelThinking';
import { getModelPickerText } from './modelPickerStrings';
import { thinkingSummaryLabel, isThinkingRowVisible, type ModelWithThinking } from './modelThinking';

/** 官方 `lbe` @80054：**列表行** summary span 的 class（逐字）。 */
export const MODEL_ROW_SUMMARY_CLASS = 'shrink-0 text-[11px] leading-4 text-text-text-secondary/55';

/** 官方 `Ae` @~95420：**触发器** summary span 的 class（逐字）。 */
export const MODEL_TRIGGER_SUMMARY_CLASS =
  'ml-1 shrink-0 border-l border-border/60 pl-1.5 text-[11px] leading-4 text-text-text-secondary';

/** 官方 `bq` 里 `t("chatAdapter.modelOptions.thinkingOff","Thinking off")` 的本地化文案。 */
export function thinkingOffText(locale: string): string {
  return getModelPickerText('thinkingOff', locale);
}

/**
 * 官方 `bq(model, settings, t)` 逐字（= `modelThinking.ts` 的 `thinkingSummaryLabel`）。
 *
 * @param model        模型（官方读 `model.thinking`；这里用 `resolveThinkingMetaForModel` 解析，见文件头）
 * @param setting      官方 `chatModelThinkingSettings[model.id]`
 * @param locale       MTV locale
 * @returns 档位标签 / 「思考关闭」/ `null`（不渲染）
 */
export function modelThinkingSummary(
  model: { value?: string; thinking?: ModelWithThinking['thinking'] } | null | undefined,
  setting: ChatModelThinkingSetting | null | undefined,
  locale: string,
): string | null {
  if (!model) return null;
  const thinking = resolveThinkingMetaForModel(model);
  return thinkingSummaryLabel({ thinking }, setting ?? null, locale, thinkingOffText(locale));
}

/**
 * 官方**列表行**的 summary（官方调用处 86944 逐字）：`dye(fe,ke) ? bq(fe,ke,L) : null`。
 *
 * `dye`（= `modelThinking.ts` 的 `isThinkingRowVisible`，官方定义 @56177
 * `` dye=(e,t)=>SR(e,t)?.enabled?!!e.thinking?.levels?.length:!1 ``）在 `enabled === false` 时恒为 `false`
 * ⇒ **关闭态在行上不渲染任何徽标**（保持官方行为）。开启且有档位 ⇒ 档位标签（官方 `yq`）。
 *
 * @returns 档位标签 / `null`（不渲染）
 */
export function modelRowThinkingSummary(
  model: { value?: string; thinking?: ModelWithThinking['thinking'] } | null | undefined,
  setting: ChatModelThinkingSetting | null | undefined,
  locale: string,
): string | null {
  if (!model) return null;
  const resolved = { thinking: resolveThinkingMetaForModel(model) };
  if (!isThinkingRowVisible(resolved, setting ?? null)) return null;
  return thinkingSummaryLabel(resolved, setting ?? null, locale, thinkingOffText(locale));
}
