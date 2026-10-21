/**
 * 官方「模型选择器」文案表（TapNow 0.4.90 `index-DjCL4F9p.js`@8456317/en、@9127902/zh、
 * @8856574/ja、@8993647/ko）逐字。
 *
 * 官方这套文案在 i18n 里是 **modelPicker 命名空间**，且 `levels` 是 **以档位 code 为键** 的字典
 * （`low` / `medium` / `high` / `xhigh` / `extra_high` / `max`）—— 不适合走 MTV「中文源串当 key」的
 * i18n 约定，所以单独成表，按 locale 直查。
 *
 * ⚠️ 由官方产物逐字抄录；重生成见 `D:\DEEPSEEK\_levels.mjs`。
 */

const TABLES: Record<string, Record<string, string>> = {
  'zh-CN': {
    low: '低', medium: '中', high: '高', xhigh: '极高', extra_high: '极高', max: '最高',
    /* 官方 zh 的 `modelOptions` 里**没有** `thinking` 键（只有 `thinkingOff`）⇒ 官方 `Eu`
       取 `chatAdapter.modelOptions.thinking` 拿不到值时**回落到硬编码默认值 `"Thinking"`**。
       这里照抄官方实际表现（zh/ja/ko 同样显示英文 "Thinking"），不自造翻译。 */
    thinking: 'Thinking', effort: '思考强度',
    thinkingOff: '思考关闭', noModels: '暂无模型', moreModels: '更多模型', modelLocked: '模型已锁定',
    loading: '加载中', howToSelectModel: '如何选择模型？', off: '关', selectModel: '选择模型',
    modelComparison: '模型对比', recommended: '精选推荐', options: '选项',
    modelLockedHint: '会话开始后无法更改模型，请开启新对话以使用不同模型',
  },
  'en-US': {
    low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra High', extra_high: 'Extra High', max: 'Max',
    thinking: 'Thinking', effort: 'Effort',
    thinkingOff: 'Thinking off', noModels: 'No models', moreModels: 'More models', modelLocked: 'Model locked',
    loading: 'Loading', howToSelectModel: 'How to choose a model?', off: 'Off', selectModel: 'Select a model',
    modelComparison: 'Model comparison', recommended: 'Recommended', options: 'Options',
    modelLockedHint: "The model can't be changed once a session has started. Start a new chat to use a different model.",
  },
  'ja-JP': {
    low: '低', medium: '中', high: '高', xhigh: '非常に高い', extra_high: '非常に高い', max: '最大',
    thinking: 'Thinking', effort: '思考強度',
    thinkingOff: '思考オフ', noModels: 'モデルなし', moreModels: 'その他のモデル', modelLocked: 'モデルはロック済み',
    loading: '読み込み中', howToSelectModel: 'モデルの選び方', off: 'オフ', selectModel: 'モデルを選択',
    modelComparison: 'モデル比較', recommended: 'おすすめ', options: 'オプション',
    modelLockedHint: 'セッション開始後はモデルを変更できません。別のモデルを使うには新しいチャットを開始してください。',
  },
  'ko-KR': {
    low: '낮음', medium: '중간', high: '높음', xhigh: '매우 높음', extra_high: '매우 높음', max: '최대',
    thinking: 'Thinking', effort: '추론 강도',
    thinkingOff: '사고 끔', noModels: '모델 없음', moreModels: '더 많은 모델', modelLocked: '모델 잠김',
    loading: '로딩 중', howToSelectModel: '모델 선택 방법', off: '끔', selectModel: '모델 선택',
    modelComparison: '모델 비교', recommended: '추천', options: '옵션',
    modelLockedHint: '세션이 시작된 후에는 모델을 변경할 수 없습니다. 다른 모델을 사용하려면 새 채팅을 시작하세요.',
  },
};

/** 官方 `levels` 的档位顺序（`low/medium/high/xhigh/extra_high/max`；实际展示由模型自带的 options 决定）。
 *  ⚠️ MTV 在模型目录**没有** `thinking.levels` 时用这个常量兜底画控件
 *  （`configuredModelThinking.officialFallbackThinkingMeta()`，★ 唯一偏离官方处 ★）。 */
export const MODEL_LEVEL_CODES = ['low', 'medium', 'high', 'xhigh', 'extra_high', 'max'] as const;

export type ModelLevelCode = (typeof MODEL_LEVEL_CODES)[number];

/** 按档位 code 取官方本地化标签（未知 code 原样返回，回退英文）。 */
export function getModelLevelLabel(code: string, locale: string): string {
  const table = TABLES[locale] ?? TABLES['en-US'];
  return table[code] ?? TABLES['en-US'][code] ?? code;
}

/** 取官方模型选择器里的其它文案（`thinkingOff` / `modelLocked` / `modelLockedHint` …）。 */
export function getModelPickerText(key: string, locale: string): string {
  const table = TABLES[locale] ?? TABLES['en-US'];
  return table[key] ?? TABLES['en-US'][key] ?? key;
}
