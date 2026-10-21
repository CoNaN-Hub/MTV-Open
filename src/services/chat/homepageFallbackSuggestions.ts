/**
 * homepageFallbackSuggestions —— 官方 `homepage_fallback_suggestions` 的 **150 条字面量**（5 语言 × 30 条）落地。
 *
 * 来源（逐字，未翻译/未去重/未合并）：
 *   · 官方产物 `readable/web/assets/index-Beoy3Atw.js:1475-1775`（`homepage_source`）；
 *   · 抽取件 `prompt-literals.json` 的顶层键 `homepage_fallback_suggestions`
 *     （`provenance: "Literal extraction from shipped web JS, not server system prompt"`）。
 *   · 逐字副本：`src/data/homepageFallbackSuggestions.json`（按语言分组，`id` / `title` / `prompt` /
 *     `icon_category` 全部原样保留，官方顺序 zh → en → ja → ko → fr）。
 *
 * ⚠️ 边界：**MTV 目前没有 homepage 界面** —— 本模块只是把官方字面量落地成可读数据，
 * **尚未接入任何 UI**，仓库里也没有任何调用方。
 *
 * ⚠️ 只做数据读取：不造默认值、不翻译、不回落别的语言。传入未知语言（或该语言缺数据）时返回空数组，
 * 绝不「发明」内容。调用方若来自 MTV 的 `Locale`（`zh-CN` 等），需自行映射到官方短码
 * （`zh` / `en` / `ja` / `ko` / `fr`），本模块不做这层映射。
 */
import RAW from '../../data/homepageFallbackSuggestions.json';

/** 官方字面量里的语言分组键（即 id 的 `home-fallback-<lang>-NN` 中段），顺序同官方。 */
export const HOMEPAGE_FALLBACK_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'fr'] as const;

export type HomepageFallbackLanguage = (typeof HOMEPAGE_FALLBACK_LANGUAGES)[number];

/** 一条官方 homepage 兜底建议（字段名与官方字面量一致）。 */
export interface HomepageFallbackSuggestion {
  /** 官方 id，形如 `home-fallback-zh-01`。 */
  readonly id: string;
  /** 官方 `title`（卡片标题）。 */
  readonly title: string;
  /** 官方 `prompt`（点击后送进输入框的完整提示词）。 */
  readonly prompt: string;
  /** 官方 `icon_category`（图标分类）。 */
  readonly icon_category: string;
}

type HomepageFallbackFile = Record<string, HomepageFallbackSuggestion[]>;

const FILE = RAW as unknown as HomepageFallbackFile;

/** 缺语言时的返回值：空数组（不回落、不翻译、不造默认值）。 */
const EMPTY: readonly HomepageFallbackSuggestion[] = [];

/** 取某一语言的官方 30 条（未知语言 / 缺数据 ⇒ 空数组）。 */
export function homepageFallbackSuggestions(language: string): readonly HomepageFallbackSuggestion[] {
  return FILE[language] ?? EMPTY;
}

/** 按官方顺序（zh → en → ja → ko → fr）拼出全部 150 条，顺序与官方字面量一致。 */
export function allHomepageFallbackSuggestions(): readonly HomepageFallbackSuggestion[] {
  return HOMEPAGE_FALLBACK_LANGUAGES.flatMap((language) => homepageFallbackSuggestions(language));
}
