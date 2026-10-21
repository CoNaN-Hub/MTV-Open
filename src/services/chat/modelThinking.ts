/**
 * 官方「模型思考档位」逻辑层 —— `use-chat-attachment-file-input-CE59XJWo.js`@72729 一带逐字复刻。
 *
 * 官方这组函数（压缩名 → 语义）：
 *   eu = { low:"Low", medium:"Medium", high:"High", xhigh:"Extra High", extra_high:"Extra High", max:"Max" }
 *   tu(level)  = eu[level] ?? 把 code 按 `[-_\s]` 切分后首字母大写拼接            // 兜底标签
 *   vi(level,t)= tu(level)，优先取 i18n `chatAdapter.modelOptions.levels.<code>`  // 本地化标签
 *   Ai(model)  = 由 `model.thinking` 推默认档：`{levels, default:{enabled,level}, can_disable, switchable}`
 *                ⇒ `{enabled: can_disable ? default.enabled ?? true : true, level: default.level ?? levels[0]}`
 *   Us(model)  = `model.thinking.can_disable !== false`                          // 能否关掉思考
 *   Ks(model, s) = 规范化：不能关时强制 `enabled: true`
 *   J0(value)  = 存储值校验：`enabled` 必须 boolean，`level` 必须非空 string
 *   wi(model,s,t) = 思考摘要文案：无 levels ⇒ null；enabled ⇒ 本地化档位；否则 `thinkingOff`
 *   nu(model,s)   = 是否显示这一行：`enabled && levels.length > 0`
 *
 * 官方**请求侧**（`course-api-base-url-CyloymxZ.js`@1204075 一带，同一套字段的另一半）：
 *   GIe = ['thinking_level','reasoning_effort']  // 两个可能的线上字段名
 *   HIe = 'thinking_level'                       // 默认字段名
 *   wx(tl)        = `tl?.wireField ?? 'thinking_level'`            // 该模型用哪个字段
 *   aF(v, tl)     = `(tl?.wireCase ?? 'upper') === 'lower' ? lower : upper`
 *   v9(v, tl)     = 档位校验：trim 后大写，在 `tl.options` 里大小写不敏感地找回原始写法
 *   x9(params, m) = 先删掉 params 里已有的 `thinking_level`/`reasoning_effort`，
 *                   再按 `wx`/`aF` 写入模型目录里的默认档
 *   $B(level, m)  = `m?.labels?.[level] ?? UIe[level]`，`UIe` = `textModels.thinkingLevel.{off,light,standard,heavy}`
 *   La            = { OFF:'OFF', LIGHT:'LOW', STANDARD:'MEDIUM', HEAVY:'HIGH' }
 *
 * ⚠️ MTV 的模型配置里**没有** `thinking` 块（`textModels` 目录来自官方服务端）⇒
 *    `Ai()` 对 MTV 现有模型返回 null、`nu()` 恒 false，即该行不显示 —— 与官方在「模型不支持思考」时的
 *    行为一致。**注意**：MTV 的**选择器控件**另有一条兜底路径（`configuredModelThinking.ts` 的
 *    `officialFallbackThinkingMeta()`，★ 唯一偏离官方处 ★），它只负责把**控件画出来**，
 *    不改本文件的逻辑层（本文件对每个函数都保持官方逐字样）。
 */
import type { ChatModelThinkingSetting, ModelThinkingMeta } from '../../types/chat';
import { getModelLevelLabel } from './modelPickerStrings';

/** 官方 `model.thinking` 的形状（服务端模型目录字段）—— 定义在 `types/chat.ts`，此处转出。 */
export type { ModelThinkingMeta } from '../../types/chat';

export interface ModelWithThinking {
  thinking?: ModelThinkingMeta;
}

/** 官方 `eu`：档位兜底标签（i18n 未命中时用）。 */
const LEVEL_FALLBACK_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra High',
  extra_high: 'Extra High',
  max: 'Max',
};

/** 官方 `tu`：先查表，否则把 code 按 `[-_\s]` 切分后首字母大写。 */
export function formatLevelCode(code: string): string {
  const known = LEVEL_FALLBACK_LABELS[code];
  if (known) return known;
  return code
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** 官方 `vi`：本地化档位标签（`chatAdapter.modelOptions.levels.<code>`，未命中回退 `tu`）。 */
export function localizeLevel(code: string, locale: string): string {
  return getModelLevelLabel(code, locale) || formatLevelCode(code);
}

/** 官方 `Us`：能否关闭思考（`can_disable !== false`）。 */
export function canDisableThinking(model: ModelWithThinking): boolean {
  return model.thinking?.can_disable !== false;
}

/** 官方 `Ai`：模型的默认思考档位；模型没有 `thinking` 元数据 ⇒ null（该行不显示）。 */
export function resolveDefaultThinking(model: ModelWithThinking): ChatModelThinkingSetting | null {
  const thinking = model.thinking;
  if (!thinking) return null;
  const levels = thinking.levels ?? [];
  const level = thinking.default?.level || levels[0] || null;
  return {
    enabled: canDisableThinking(model) ? (thinking.default?.enabled ?? true) : true,
    ...(level ? { level } : {}),
  };
}

/** 官方 `Ks`：规范化（不允许关思考的模型强制 `enabled: true`）。
 *
 *  ⚠️ 2026-10-13（§82）逐字修正：原实现写成 `if (resolved.enabled || !canDisableThinking(model))`，
 *  与官方 `SR` @55673 `` SR=(e,t)=>{const n=t||xq(e);return n?n.enabled||CR(e)?n:{...n,enabled:!0}:null} ``
 *  的判据**取反**了（官方是 `n.enabled || CR(e)`，`CR` = 可关思考）。后果：
 *  「可关」的模型（`can_disable` 缺省）被强制改回 `enabled: true` ⇒ `bq` 永远走不到「思考关闭」支。
 *  该函数此前只被 `thinkingSummaryLabel` / `isThinkingRowVisible` 调用（两者在 §82 之前无人使用），
 *  所以这个取反一直没被暴露。现已按官方逐字改回。 */
export function normalizeThinkingSetting(
  model: ModelWithThinking,
  setting: ChatModelThinkingSetting | null,
): ChatModelThinkingSetting | null {
  const resolved = setting ?? resolveDefaultThinking(model);
  if (!resolved) return null;
  if (resolved.enabled || canDisableThinking(model)) return resolved;
  return { ...resolved, enabled: true };
}

/** 官方 `J0`：存储值校验（脏值丢弃）。 */
export function sanitizeStoredThinkingSetting(value: unknown): ChatModelThinkingSetting | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as { enabled?: unknown; level?: unknown };
  if (typeof entry.enabled !== 'boolean') return null;
  return {
    enabled: entry.enabled,
    ...(typeof entry.level === 'string' && entry.level.trim() ? { level: entry.level } : {}),
  };
}

/** 官方 `wi`：思考摘要文案（无档位 ⇒ null；开 ⇒ 本地化档位；关 ⇒ `thinkingOff`）。 */
export function thinkingSummaryLabel(
  model: ModelWithThinking,
  setting: ChatModelThinkingSetting | null,
  locale: string,
  thinkingOffText: string,
): string | null {
  const resolved = normalizeThinkingSetting(model, setting);
  if (!resolved || !model.thinking?.levels?.length) return null;
  if (!resolved.enabled) return thinkingOffText;
  return resolved.level ? localizeLevel(resolved.level, locale) : null;
}

/** 官方 `nu`：是否显示思考这一行。 */
export function isThinkingRowVisible(
  model: ModelWithThinking,
  setting: ChatModelThinkingSetting | null,
): boolean {
  const resolved = normalizeThinkingSetting(model, setting);
  return !!resolved?.enabled && !!model.thinking?.levels?.length;
}

/* ══════════════════════════════════════════════════════════════════════════════
   请求侧：把选中的档位写到线上参数里（官方 `course-api-base-url-CyloymxZ.js`@1204075 一带）
   ══════════════════════════════════════════════════════════════════════════════ */

/** 官方 `GIe`：线上可能出现的两个思考档位字段名。 */
export const THINKING_WIRE_FIELDS = ['thinking_level', 'reasoning_effort'] as const;
/** 官方 `HIe`：默认字段名。 */
export const DEFAULT_THINKING_WIRE_FIELD = 'thinking_level';

/** 官方 `La`：档位枚举（值即线上写法）。 */
export const THINKING_LEVEL_ENUM = {
  OFF: 'OFF',
  LIGHT: 'LOW',
  STANDARD: 'MEDIUM',
  HEAVY: 'HIGH',
} as const;

/** 官方 `wx`：该模型用哪个线上字段（未配置 ⇒ `thinking_level`）。 */
export function resolveThinkingWireField(meta: ModelThinkingMeta | undefined | null): string {
  return meta?.wireField ?? DEFAULT_THINKING_WIRE_FIELD;
}

/** 官方 `aF`：线上大小写（未配置 ⇒ 大写）。 */
export function formatThinkingLevelValue(level: string, meta: ModelThinkingMeta | undefined | null): string {
  return (meta?.wireCase ?? 'upper') === 'lower' ? String(level).toLowerCase() : String(level).toUpperCase();
}

/** 官方 `v9`：档位校验 —— 大小写不敏感地命中 `meta.levels`，返回目录里的原始写法。 */
export function validateThinkingLevel(
  level: unknown,
  meta: ModelThinkingMeta | undefined | null,
): string | undefined {
  if (!meta?.levels?.length || typeof level !== 'string' || level.trim() === '') return undefined;
  const upper = level.trim().toUpperCase();
  return meta.levels.find((candidate) => String(candidate).toUpperCase() === upper);
}

/** 官方 `x9`：把模型默认档写进请求参数（先清掉两个可能的旧字段）。 */
export function applyThinkingLevelToParams(
  params: Record<string, unknown>,
  meta: ModelThinkingMeta | undefined | null,
): Record<string, unknown> {
  const next = { ...params };
  for (const field of THINKING_WIRE_FIELDS) delete next[field];
  if (meta?.levels?.length) {
    const fallback = meta.default?.level ?? meta.levels[0];
    if (fallback) next[resolveThinkingWireField(meta)] = formatThinkingLevelValue(fallback, meta);
  }
  return next;
}

/** 官方 `UIe`：档位 → i18n 键（`textModels.thinkingLevel.*`）。 */
const THINKING_LEVEL_LABEL_KEYS: Record<string, string> = {
  OFF: 'textModels.thinkingLevel.off',
  LOW: 'textModels.thinkingLevel.light',
  MEDIUM: 'textModels.thinkingLevel.standard',
  HIGH: 'textModels.thinkingLevel.heavy',
};

/**
 * 官方 `textModels.thinkingLevel.*` 文案（`index-DjCL4F9p.js`@6153865/en、@6186738/ja、
 * @6198865/ko、@6210757/zh 逐字）。
 * ⚠️ 官方 `off/light/standard/heavy` 四档在**四种语言里都是英文原样**，只有 DeepSeek 那三条
 *    （`deepseekOff/deepseekFast/deepseekExpert`）被本地化 ⇒ 这里照抄，不自造翻译。
 */
const THINKING_LEVEL_LABELS: Record<string, Record<string, string>> = {
  'zh-CN': {
    off: 'Off', light: 'Light', standard: 'Standard', heavy: 'Heavy',
    deepseekOff: '关闭', deepseekFast: '快速', deepseekExpert: '专家',
  },
  'en-US': {
    off: 'Off', light: 'Light', standard: 'Standard', heavy: 'Heavy',
    deepseekOff: 'Off', deepseekFast: 'Fast', deepseekExpert: 'Expert',
  },
  'ja-JP': {
    off: 'Off', light: 'Light', standard: 'Standard', heavy: 'Heavy',
    deepseekOff: 'オフ', deepseekFast: '高速', deepseekExpert: 'エキスパート',
  },
  'ko-KR': {
    off: 'Off', light: 'Light', standard: 'Standard', heavy: 'Heavy',
    deepseekOff: '꺼짐', deepseekFast: '빠름', deepseekExpert: '전문가',
  },
};

/** 官方 `$B`：档位标签 —— 模型目录自带 `labels` 优先，否则走 `UIe` 默认键。 */
export function thinkingLevelLabel(
  level: string,
  meta: ModelThinkingMeta | undefined | null,
  locale: string,
): string {
  const table = THINKING_LEVEL_LABELS[locale] ?? THINKING_LEVEL_LABELS['en-US'];
  const customKey = meta?.labels?.[level];
  if (customKey) {
    const tail = customKey.split('.').pop() ?? '';
    return table[tail] ?? tail;
  }
  const defaultKey = THINKING_LEVEL_LABEL_KEYS[String(level).toUpperCase()];
  const tail = defaultKey?.split('.').pop();
  return tail ? (table[tail] ?? tail) : String(level);
}

