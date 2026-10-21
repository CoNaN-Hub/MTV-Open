/**
 * 官方「模型思考档位」的**目录项来源**与**请求写入点**（MTV 侧适配层）。
 *
 * ## 官方逐字取证（`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`）
 *
 * | 官方行为 | 偏移 | 逐字 |
 * |---|---|---|
 * | 目录项形状 | — | `{id, display_name, is_default, availability, thinking}`（`thinking` **只来自服务端**） |
 * | 归一化 | 53079 一带 | `nye = e => ({…, thinking: e.thinking})` —— 原样透传 |
 * | 默认档位 | 55366 | `xq = e => {const t=e.thinking; if(!t) return null; const n=t.levels||[], o=t.default?.level||n[0]||null; return {enabled: CR(e)?t.default?.enabled??!0:!0, …(o?{level:o}:{})}; }` |
 * | 能否关掉 | 55333 | `CR = e => e.thinking?.can_disable !== !1` |
 * | 规范化 | 55400 一带 | `SR(model, setting)` = `setting ?? default`，不能在关时强制 `enabled:true` |
 * | 存储校验 | 27243 | `rxe` —— `enabled` 必须 boolean、`level` 若存在必须 string |
 * | 读已有会话 | 2700500 | `const tt = aye(Ee.thinking); tt && l.setChatModelThinkingSettings(Xe, tt)` |
 * | **请求写入** | 2700732 左右 | `const ir = Xo && Xo !== ni ? J.chatModelThinkingSettings[Xo] : void 0;` → `… ir ? {thinking: ir} : {} …` |
 *
 * ⇒ 官方的写入点 = **store 的 `chatModelThinkingSettings[选中的模型 id]`**（在发请求时读，
 *   并且**只对非 Auto 模型**发 `thinking`）。MTV 没有 `thinking` 这个服务端字段，
 *   但 MTV 的官方文本模型链路里已经有一份**官方同源**的线上字段映射
 *   （`modelThinking.ts` 的 `applyThinkingLevelToParams`：`thinking_level` / `reasoning_effort`）
 *   —— 本文件把「选中档位」接到那条映射上，保证「可点/可拖 ⇒ 真的改到请求体」。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️⚠️ **本工程相对官方产物唯一的一处行为偏离**（必须逐字登记，见 `agent-挖掘覆盖表.md` §78）⚠️⚠️
 *
 * **官方（逐字）**：`NR = ({model:e, settings:t, onChange:n, embedded:o=!1}) => {const r=e.thinking;
 *   if(!r) return null; …}`（`vendor-pkg-canvas-ChpWx5JY.js` @70900 一带）
 *   ⇒ 模型目录项**没有 `thinking` 字段时，官方整块控件不渲染**（离线兜底目录 `Tq` 同样不带该字段）。
 *
 * **MTV（本条偏离）**：`thinking` 缺失时，**用官方那套逐字档位词汇表**把同一个控件画出来
 *   —— 档位 code 与顺序 `low / medium / high / xhigh / extra_high / max` 逐字取自官方 i18n
 *   `chatAdapter.modelOptions.levels`（= `modelPickerStrings.ts` 的 `MODEL_LEVEL_CODES`，
 *   原样照抄官方字典的键序，**不自造档位名、不重排**）；
 *   默认档仍走官方那条 `||` 链 `settings?.level || thinking.default?.level || levels[0]` ⇒ 落到 `low`；
 *   可关仍走官方判据 `can_disable !== false`（fallback 里没有 `can_disable` ⇒ `undefined !== false` ⇒ 可关）
 *   ⇒ 序列 = `['__thinking_off__', 'low', 'medium', 'high', 'xhigh', 'extra_high', 'max']`。
 *   **理由**：MTV 的模型目录是用户自配的第三方连接，服务端 `thinking.levels` **永远拿不到**
 *   （§76 实测：土豆 `/v1/models` 21 条，含 thinking 线索 = 0）⇒ 不兜底就永远调不了。
 *   **代价（如实登记）**：MTV 会比官方**多渲染**这个控件，且这 6 个档位是**客户端词汇全集**，
 *   不代表该模型在服务端真的支持这 6 档。
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useAppStore } from '../../store/useAppStore';
import type { ChatModelThinkingSetting, ModelThinkingMeta } from '../../types/chat';
import { MODEL_LEVEL_CODES } from './modelPickerStrings';
import {
  THINKING_LEVEL_ENUM,
  formatThinkingLevelValue,
  resolveThinkingWireField,
} from './modelThinking';

/** 官方 `aye`：把 store 里的存储值收敛成可发送的形状。 */
function toWireSetting(setting: ChatModelThinkingSetting): ChatModelThinkingSetting {
  return {
    enabled: setting.enabled,
    ...(typeof setting.level === 'string' && setting.level.trim() ? { level: setting.level } : {}),
  };
}

/**
 * 取「某个模型 id 在用户连接目录里声明的 `thinking` 元数据」。
 *
 * MTV 的模型 id 有两种形态（与 `defaultModels` / `assistantStream` 一致）：
 *   · `general/<GeneralModelConfig.id>` —— 自定义连接模型（选择器里的标准 value）；
 *   · `<provider>/<上游 model id>` —— 内置连接里勾选的模型（`ProviderModelSelection`）。
 * 另外 `assistantModelId` 也可能存**裸的** `GeneralModelConfig.id`（`ChatInput` 只在需要时补
 * `general/` 前缀，`assistantStream.resolveAssistantModelById` 也会去掉前缀）⇒ 再补一条精确匹配。
 * 三条路都**只做原样读取**，命中不到就返回 `undefined`（不造值）。
 */
export function configuredThinkingMetaForModel(modelId: string): ModelThinkingMeta | undefined {
  if (!modelId) return undefined;
  const config = useAppStore.getState().config;
  if (!config) return undefined;

  const generalId = modelId.startsWith('general/') ? modelId.slice('general/'.length) : modelId;
  const generalEntry = config.generalModels?.find((model) => model.id === generalId);
  if (generalEntry?.thinking) return generalEntry.thinking;

  const slash = modelId.indexOf('/');
  if (slash > 0) {
    const providerKey = modelId.slice(0, slash);
    const upstreamId = modelId.slice(slash + 1);
    const provider = config.providers?.[providerKey];
    const pools = [provider?.selectedModels, provider?.catalogModels];
    for (const pool of pools) {
      const entry = pool?.find((model) => model.id === upstreamId);
      if (entry?.thinking) return entry.thinking;
    }
  }
  return undefined;
}

/**
 * ★ **兜底分支（本工程唯一偏离官方处）** ★
 *
 * 官方 `NR` 在 `!model.thinking` 时 `return null`（整块控件不渲染）。MTV 的目录拿不到服务端
 * `thinking.levels`，按用户决定改成就地画出控件 ⇒ 这里给出一个**只用官方逐字词汇**的 `thinking`：
 *
 *   `levels = [...MODEL_LEVEL_CODES]` =
 *   `['low','medium','high','xhigh','extra_high','max']`
 *   （= 官方 i18n `chatAdapter.modelOptions.levels` 的键序，见 `modelPickerStrings.ts`）
 *
 * **刻意不写的东西**（避免自造数据）：
 *   · 不写 `default` ⇒ 默认档落回官方那条 `||` 链的最后一环 `levels[0]` = `low`；
 *   · 不写 `can_disable` ⇒ 官方判据 `can_disable !== false` 判为**可关**（与官方对
 *     `{levels}` 形状的元数据的判定完全一致），于是序列前缀关闭哨兵 `__thinking_off__`；
 *   · 不写 `switchable`（官方本来就不用它，判据是 `levels.length > 1`）；
 *   · 不写 `wireField` / `wireCase` / `labels` ⇒ 走官方自己的默认值
 *     （`resolveThinkingWireField` ⇒ `thinking_level`、`formatThinkingLevelValue` ⇒ 大写）。
 *
 * 每次返回**新对象/新数组**，避免调用方改到共享常量。
 */
export function officialFallbackThinkingMeta(): ModelThinkingMeta {
  return { levels: [...MODEL_LEVEL_CODES] };
}

/**
 * 解析一个模型选项的 `thinking` 元数据：
 *   ① 模型选项自带（官方那一条路 `model.thinking`）；
 *   ② 用户连接目录里同 id 的条目（MTV 的透传通道，只**读配置**，不造值）；
 *   ③ ★兜底（偏离）★ `officialFallbackThinkingMeta()` —— 官方在这里 `return null`。
 *
 * @returns 一定返回非 `undefined`（除非入参为 `null`/`undefined`）⇒
 *          `ThinkingControl` 的 `if (!thinking) return null` 从此只对「模型项本身为空」生效。
 */
export function resolveThinkingMetaForModel(
  model: { value?: string; thinking?: ModelThinkingMeta } | null | undefined,
): ModelThinkingMeta | undefined {
  if (!model) return undefined;
  if (model.thinking) return model.thinking;
  const configured = model.value ? configuredThinkingMetaForModel(model.value) : undefined;
  return configured ?? officialFallbackThinkingMeta();
}

/**
 * 官方「提交请求时」的读取点：
 * `Xo = selectedModelAtStart ?? selectedModel` → `ir = Xo && Xo !== 'auto' ? thinkingSettings[Xo] : undefined`
 * → 请求体 `… ir ? {thinking: ir} : {}`。
 *
 * @param modelId 选中的模型 id（MTV 侧 = `ResolvedModelConfig.selectionId`）
 * @returns 官方同语义的 `{enabled, level?}`；Auto 或没有存储值时返回 `undefined`（不发该字段）
 */
export function selectedThinkingSetting(modelId: string | null | undefined): ChatModelThinkingSetting | undefined {
  if (!modelId || modelId === 'auto') return undefined;
  const stored = useAppStore.getState().chatModelThinkingSettings?.[modelId];
  return stored ? toWireSetting(stored) : undefined;
}

/**
 * 把选中档位落成**请求体字段**。
 *
 * 官方在 agent 网关里的字段名是 `thinking`（对象）。MTV 是直连各家 provider，没有该网关，
 * 因此走 MTV 已经落地的**官方同源**文本模型映射（`applyThinkingLevelToParams` 那一支）：
 *   · 关掉思考 ⇒ `thinking_level: 'OFF'`（官方 `La.OFF`）
 *   · 开 ⇒ `thinking_level: '<LEVEL>'`（官方 `aF`：默认大写；`wireCase: 'lower'` 则小写）
 * `meta` 没有 `levels` ⇒ 不写任何字段（调用方此时传的是真元数据；走兜底时 `levels` 恒非空）。
 * ⚠️ **只有用户真的动过那个控件**（store 里有 `chatModelThinkingSettings[modelId]`）才写字段
 *    —— 与官方 `ir ? {thinking: ir} : {}` 同语义：没设置过就一个字节都不多发。
 */
export function thinkingBodyParams(
  modelId: string | null | undefined,
  meta: ModelThinkingMeta | undefined | null,
): Record<string, unknown> {
  if (!meta?.levels?.length) return {};
  const setting = selectedThinkingSetting(modelId);
  if (!setting) return {};
  const level = setting.enabled ? (setting.level ?? meta.default?.level ?? meta.levels[0]) : null;
  /* 关掉思考 ⇒ 官方 `La.OFF`（`THINKING_LEVEL_ENUM.OFF = 'OFF'`）。 */
  const chosen = level ?? THINKING_LEVEL_ENUM.OFF;
  return { [resolveThinkingWireField(meta)]: formatThinkingLevelValue(chosen, meta) };
}
