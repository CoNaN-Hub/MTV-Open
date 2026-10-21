/**
 * 官方「模型信息面板」的**客户端常量表** —— 逐字取自官方产物
 * `D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`（live app.tapnow.media 的 canvas chunk）。
 *
 * ## 官方压缩名 → 本文件导出
 *
 * | 本文件导出 | 官方符号 | 官方偏移 | 说明 |
 * |---|---|---|---|
 * | `OFFICIAL_CAPABILITY_KEYS` | `hye` | 62211 | `["speed","intelligence","cost"]` |
 * | `OFFICIAL_MODEL_INFO` | `fye` | 58601 | **能力评分 + 英文简介**（按官方模型 key） |
 * | `OFFICIAL_MODEL_LABEL_KEYS` | `bs` | 46929 一带 | key → i18n 标签键名 |
 * | `OFFICIAL_MODEL_ID_LABEL_KEYS` | `uye` | 46860 一带 | 模型 id → key（`auto` / `deepseek-flash`） |
 * | `OFFICIAL_MODEL_LABEL_NEEDLES` | `pye` | 46890 一带 | `id + label` 小写包含匹配 → key |
 * | `officialModelKey` | `mye` | 58439 | 由 `{id,label}` 推 key（命中不到 ⇒ `default`） |
 * | `officialCapabilityEntries` | `gye` | 62247 | 过滤出 1..5 的整数评分，顺序固定 |
 *
 * ## ⚠️ 数据来源结论（**用户问的「三行指标字段」逐字答案**）
 *
 * 官方 `bye`（信息卡）里三行指标**不是**读目录项的 `speed` / `intelligence` / `cost`：
 *
 * ```js
 * yye = e => { const t = mye(e); return { key: t, copy: fye[t] }; };
 * d   = gye(i);            // i = fye[key]
 * ```
 *
 * ⇒ 官方读的是**客户端常量表 `fye[key].capabilities`**（`{speed,intelligence,cost}` → 1..5 整数），
 *   key 由 `mye`（先查 `uye` 的 id 映射，再用 `pye` 的 needles 在 `` `${id} ${label}`.toLowerCase() ``
 *   里做包含匹配）推出，未命中回落 `bs.default`。
 *   目录项（服务端 `listModels` 条目）**只带** `thinking` / `availability` / `is_default` / `display_name`。
 *
 * ## ⚠️ 描述文案的两级来源（逐字）
 *
 * ```js
 * c = o(`chatAdapter.modelOptions.info.models.${r}.description`, i.description)
 * ```
 * ⇒ i18n 覆盖优先，回落 `fye[key].description`（英文）。四种语言的 i18n 覆盖逐字抄在下表。
 *
 * 本文件**只抄官方字面量**，不改字、不补默认值、不做等价改写。
 */

/** 官方 `hye`：能力评分字段顺序。 */
export const OFFICIAL_CAPABILITY_KEYS = ['speed', 'intelligence', 'cost'] as const;

export type OfficialCapability = (typeof OFFICIAL_CAPABILITY_KEYS)[number];

/** 官方 `fye[key]` 的形状。 */
export interface OfficialModelInfoCopy {
  description: string;
  capabilities: Partial<Record<OfficialCapability, number>>;
}

/** 官方 `fye`：客户端常量表（逐字；29 条 = 28 个模型 key + `default`）。 */
export const OFFICIAL_MODEL_INFO: Record<string, OfficialModelInfoCopy> = {
  deepseekFlash: {
    description: 'General-purpose model for creative planning, drafting, and follow-up tasks.',
    capabilities: { speed: 5, intelligence: 4, cost: 1 },
  },
  auto: {
    description: 'Balanced speed, effort, and cost.',
    capabilities: { speed: 4, intelligence: 4, cost: 3 },
  },
  sonnet5: {
    description: 'Strong reasoning for complex creative and agent tasks.',
    capabilities: { speed: 4, intelligence: 5, cost: 3 },
  },
  sonnet46: {
    description: 'Balanced reasoning for everyday creative work.',
    capabilities: { speed: 4, intelligence: 4, cost: 4 },
  },
  opus55: {
    description: 'Latest Opus: deep reasoning for long-horizon coding and knowledge work.',
    capabilities: { speed: 3, intelligence: 5, cost: 5 },
  },
  opus5: {
    description: 'Deep reasoning for long-horizon, high-complexity work.',
    capabilities: { speed: 3, intelligence: 5, cost: 5 },
  },
  opus48: {
    description: 'Deep reasoning for complex planning and agent work.',
    capabilities: { speed: 3, intelligence: 5, cost: 5 },
  },
  opus47: {
    description: 'Deep reasoning for complex creative refinement.',
    capabilities: { speed: 3, intelligence: 5, cost: 5 },
  },
  opus46: {
    description: 'Reliable reasoning for scripts and production planning.',
    capabilities: { speed: 3, intelligence: 4, cost: 5 },
  },
  kimi27: {
    description: 'Efficient coding and agent execution.',
    capabilities: { speed: 4, intelligence: 4, cost: 3 },
  },
  kimi26: {
    description: 'Capable coding and long-running agent work.',
    capabilities: { speed: 4, intelligence: 4, cost: 3 },
  },
  kimi2: {
    description: 'Cost-aware reasoning for tool-driven tasks.',
    capabilities: { speed: 4, intelligence: 3, cost: 3 },
  },
  gpt55: {
    description: 'Strong reasoning for complex professional work.',
    capabilities: { speed: 3, intelligence: 5, cost: 5 },
  },
  gpt6Astra: {
    description: 'Flagship reasoning tier: deeper reasoning at higher quality.',
    capabilities: { speed: 3, intelligence: 5, cost: 5 },
  },
  gpt6Sol: {
    description: 'Built for complex coding and agentic workflows.',
    capabilities: { speed: 4, intelligence: 5, cost: 3 },
  },
  gpt6Luna: {
    description: 'Most efficient tier for focused, high-volume tasks.',
    capabilities: { speed: 5, intelligence: 4, cost: 1 },
  },
  gpt56Sol: {
    description: 'Frontier reasoning for your hardest tasks.',
    capabilities: { speed: 4, intelligence: 5, cost: 4 },
  },
  gpt56Terra: {
    description: 'Balanced intelligence and cost for everyday production work.',
    capabilities: { speed: 4, intelligence: 5, cost: 4 },
  },
  gpt56Luna: {
    description: 'Fast, low-cost execution for focused tasks.',
    capabilities: { speed: 5, intelligence: 4, cost: 1 },
  },
  fable5: {
    description: 'High-end reasoning for long-running agents.',
    capabilities: { speed: 2, intelligence: 5, cost: 5 },
  },
  fable51: {
    description: "Anthropic's most capable model for long-running agents and demanding reasoning.",
    capabilities: { speed: 2, intelligence: 5, cost: 5 },
  },
  gemini35: {
    description: 'Fast multimodal reasoning for everyday tasks.',
    capabilities: { speed: 5, intelligence: 4, cost: 3 },
  },
  gemini37: {
    description: 'Fast multimodal reasoning for agent workflows.',
    capabilities: { speed: 5, intelligence: 4, cost: 2 },
  },
  gemini38: {
    description: 'Fast multimodal reasoning for agent workflows with Gemini 3.8 Flash.',
    capabilities: { speed: 5, intelligence: 4, cost: 2 },
  },
  gemini36: {
    description: 'Fast multimodal model with fixed sampling defaults, tuned for quick ideation and lightweight creative checks.',
    capabilities: { speed: 5, intelligence: 4, cost: 2 },
  },
  gemini31: {
    description: 'Multimodal reasoning for complex agent workflows.',
    capabilities: { speed: 3, intelligence: 4, cost: 4 },
  },
  qwen37: {
    description: 'Efficient multimodal reasoning for agent workflows.',
    capabilities: { speed: 4, intelligence: 4, cost: 1 },
  },
  qwen36: {
    description: 'Balanced reasoning for coding and productivity.',
    capabilities: { speed: 4, intelligence: 4, cost: 2 },
  },
  default: {
    description: 'General-purpose model for creative planning, drafting, and follow-up tasks.',
    capabilities: { speed: 3, intelligence: 3, cost: 3 },
  },
};

/** 官方 `bs`：官方模型 key 的枚举（`Object.values` 与 `pye`/`uye` 里的取值同集）。 */
export const OFFICIAL_MODEL_LABEL_KEYS = {
  auto: 'auto',
  deepseekFlash: 'deepseekFlash',
  sonnet5: 'sonnet5',
  sonnet46: 'sonnet46',
  opus55: 'opus55',
  opus5: 'opus5',
  opus48: 'opus48',
  opus47: 'opus47',
  opus46: 'opus46',
  kimi27: 'kimi27',
  kimi26: 'kimi26',
  kimi2: 'kimi2',
  gpt55: 'gpt55',
  gpt6Astra: 'gpt6Astra',
  gpt6Sol: 'gpt6Sol',
  gpt6Luna: 'gpt6Luna',
  gpt56Sol: 'gpt56Sol',
  gpt56Terra: 'gpt56Terra',
  gpt56Luna: 'gpt56Luna',
  fable5: 'fable5',
  fable51: 'fable51',
  gemini35: 'gemini35',
  gemini36: 'gemini36',
  gemini37: 'gemini37',
  gemini38: 'gemini38',
  gemini31: 'gemini31',
  qwen37: 'qwen37',
  qwen36: 'qwen36',
  default: 'default',
} as const;

/** 官方 `ni`：Auto 模型的 id（`const ni="auto"`）。 */
export const OFFICIAL_AUTO_MODEL_ID = 'auto';

/**
 * 官方 `uye`：`new Map([[ni,bs.auto],["deepseek-flash",bs.deepseekFlash]])`
 * —— 只按**模型 id**命中（不看 label）。
 */
export const OFFICIAL_MODEL_ID_LABEL_KEYS = new Map<string, string>([
  [OFFICIAL_AUTO_MODEL_ID, OFFICIAL_MODEL_LABEL_KEYS.auto],
  ['deepseek-flash', OFFICIAL_MODEL_LABEL_KEYS.deepseekFlash],
]);

/**
 * 官方 `pye`：needles 顺序即优先级，在 `` `${id} ${label}`.toLowerCase() `` 上做 **includes** 匹配。
 * 逐字抄录（含 `["opus-5","opus 5"]` 在 `opus-4-8` 之前的顺序）。
 */
export const OFFICIAL_MODEL_LABEL_NEEDLES: Array<{ needles: string[]; key: string }> = [
  { needles: ['claude-sonnet-5', 'sonnet 5'], key: OFFICIAL_MODEL_LABEL_KEYS.sonnet5 },
  { needles: ['claude-sonnet-4-6', 'sonnet 4.6'], key: OFFICIAL_MODEL_LABEL_KEYS.sonnet46 },
  { needles: ['claude-opus-5-5', 'opus 5.5'], key: OFFICIAL_MODEL_LABEL_KEYS.opus55 },
  { needles: ['opus-5', 'opus 5'], key: OFFICIAL_MODEL_LABEL_KEYS.opus5 },
  { needles: ['opus-4-8', 'opus 4.8'], key: OFFICIAL_MODEL_LABEL_KEYS.opus48 },
  { needles: ['opus-4-7', 'opus 4.7'], key: OFFICIAL_MODEL_LABEL_KEYS.opus47 },
  { needles: ['opus-4-6', 'opus 4.6'], key: OFFICIAL_MODEL_LABEL_KEYS.opus46 },
  { needles: ['k2.7', 'kimi 2.7'], key: OFFICIAL_MODEL_LABEL_KEYS.kimi27 },
  { needles: ['k2.6', 'kimi 2.6'], key: OFFICIAL_MODEL_LABEL_KEYS.kimi26 },
  { needles: ['kimi-k2', 'kimi k2'], key: OFFICIAL_MODEL_LABEL_KEYS.kimi2 },
  { needles: ['gpt-6-astra', 'gpt 6 astra'], key: OFFICIAL_MODEL_LABEL_KEYS.gpt6Astra },
  { needles: ['gpt-6-sol', 'gpt 6 sol'], key: OFFICIAL_MODEL_LABEL_KEYS.gpt6Sol },
  { needles: ['gpt-6-luna', 'gpt 6 luna'], key: OFFICIAL_MODEL_LABEL_KEYS.gpt6Luna },
  { needles: ['gpt-5.6-sol', 'gpt 5.6 sol'], key: OFFICIAL_MODEL_LABEL_KEYS.gpt56Sol },
  { needles: ['gpt-5.6-terra', 'gpt 5.6 terra'], key: OFFICIAL_MODEL_LABEL_KEYS.gpt56Terra },
  { needles: ['gpt-5.6-luna', 'gpt 5.6 luna'], key: OFFICIAL_MODEL_LABEL_KEYS.gpt56Luna },
  { needles: ['gpt-5.5', 'gpt 5.5'], key: OFFICIAL_MODEL_LABEL_KEYS.gpt55 },
  { needles: ['claude-fable-5-1', 'fable 5.1'], key: OFFICIAL_MODEL_LABEL_KEYS.fable51 },
  { needles: ['fable'], key: OFFICIAL_MODEL_LABEL_KEYS.fable5 },
  { needles: ['gemini-3.6', 'gemini 3.6'], key: OFFICIAL_MODEL_LABEL_KEYS.gemini36 },
  { needles: ['gemini-3.5', 'gemini 3.5'], key: OFFICIAL_MODEL_LABEL_KEYS.gemini35 },
  { needles: ['gemini-3.7', 'gemini 3.7'], key: OFFICIAL_MODEL_LABEL_KEYS.gemini37 },
  { needles: ['gemini-3.8', 'gemini 3.8'], key: OFFICIAL_MODEL_LABEL_KEYS.gemini38 },
  { needles: ['gemini-3.1', 'gemini 3.1'], key: OFFICIAL_MODEL_LABEL_KEYS.gemini31 },
  { needles: ['qwen3.7', 'qwen 3.7'], key: OFFICIAL_MODEL_LABEL_KEYS.qwen37 },
  { needles: ['qwen3.6', 'qwen 3.6'], key: OFFICIAL_MODEL_LABEL_KEYS.qwen36 },
];

/**
 * 官方 `mye`：`{id,label}` → 官方模型 key。
 * 逐字等价：
 * ```js
 * mye = e => { const t = uye.get(e.id); if (t) return t;
 *   const n = `${e.id} ${e.label}`.toLowerCase();
 *   return pye.find(({needles:r}) => r.some(i => n.includes(i)))?.key ?? bs.default; };
 * ```
 */
export function officialModelKey(model: { id: string; label: string }): string {
  const direct = OFFICIAL_MODEL_ID_LABEL_KEYS.get(model.id);
  if (direct) return direct;
  const haystack = `${model.id} ${model.label}`.toLowerCase();
  const hit = OFFICIAL_MODEL_LABEL_NEEDLES.find(({ needles }) => needles.some((needle) => haystack.includes(needle)));
  return hit?.key ?? OFFICIAL_MODEL_LABEL_KEYS.default;
}

/** 官方 `yye`：`{ key, copy }`（`copy` 一定存在 —— `mye` 未命中回落 `default`）。 */
export function officialModelCopy(model: { id: string; label: string }): OfficialModelInfoCopy {
  return OFFICIAL_MODEL_INFO[officialModelKey(model)] ?? OFFICIAL_MODEL_INFO.default;
}

/**
 * 官方 `gye`：
 * ```js
 * gye = e => { const t = e.capabilities; return t ? hye.flatMap(n => {
 *   const o = t[n]; return Number.isInteger(o) && o >= 1 && o <= 5 ? [{capability:n,value:o}] : []; }) : []; };
 * ```
 * ⇒ 只保留 1..5 的**整数**，顺序固定 `speed / intelligence / cost`；为空时官方不画这一块。
 */
export function officialCapabilityEntries(
  copy: OfficialModelInfoCopy | null | undefined,
): Array<{ capability: OfficialCapability; value: number }> {
  const capabilities = copy?.capabilities;
  if (!capabilities) return [];
  return OFFICIAL_CAPABILITY_KEYS.flatMap((capability) => {
    const value = capabilities[capability];
    return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5
      ? [{ capability, value: value as number }]
      : [];
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   官方 i18n 覆盖表（`chatAdapter.modelOptions.*`）
   逐字取自官方 canvas chunk 的四个语言包：
     en-US @3546096 · ja-JP @3946425 · ko-KR @4083500 · zh-CN @4217797
   ══════════════════════════════════════════════════════════════════════════════ */

/** 官方 `chatAdapter.modelOptions.info.capabilities.*`（三行指标的**标签**）。 */
export const OFFICIAL_CAPABILITY_LABELS: Record<string, Record<OfficialCapability, string>> = {
  'zh-CN': { speed: '速度', intelligence: '智能', cost: '成本' },
  'en-US': { speed: 'Speed', intelligence: 'Intelligence', cost: 'Cost' },
  'ja-JP': { speed: '速度', intelligence: '知能', cost: 'コスト' },
  'ko-KR': { speed: '속도', intelligence: '지능', cost: '비용' },
};

/** 官方 `chatAdapter.modelOptions.info.models.<key>.description`（i18n 覆盖优先）。 */
export const OFFICIAL_MODEL_INFO_DESCRIPTIONS: Record<string, Record<string, string>> = {
  'zh-CN': {
    auto: '平衡速度、思考强度与成本。',
    kimi27: '高效处理编程与 Agent 执行。',
    fable51: '面向长时间 Agent 与高难推理的旗舰模型。',
    fable5: '面向长时间 Agent 的高阶推理。',
    gpt6Astra: '旗舰推理档，推理更深、质量更高。',
    gpt6Sol: '为复杂编码与 Agent 工作流打造。',
    gpt6Luna: '最高效的档位，适合聚焦的高频任务。',
    gpt56Sol: '面向高难度任务的前沿推理。',
    qwen36: '兼顾编程与生产力任务的均衡推理。',
    gemini35: '适合日常任务的快速多模态推理。',
    deepseekFlash: '通用模型，适合创意规划、草稿生成和后续追问。',
    default: '通用模型，适合创意规划、草稿生成和后续追问。',
    sonnet46: '适合日常创意工作的均衡推理。',
    opus55: '最新一代 Opus，适合长周期编码与知识工作的深度推理。',
    opus5: '适合长周期、高复杂度工作的深度推理。',
    opus47: '适合复杂创意内容的深度打磨。',
    sonnet5: '擅长复杂创意与 Agent 任务。',
    gemini37: '适合 Agent 工作流的快速多模态推理。',
    gemini38: '适合 Agent 工作流的 Gemini 3.8 Flash 快速多模态推理。',
    kimi2: '适合工具任务的成本可控推理。',
    gemini36: '采样参数固定的快速多模态模型，适合灵感探索和轻量检查。',
    kimi26: '适合编程与长时间 Agent 工作。',
    gpt56Luna: '快速低成本地处理聚焦任务。',
    gemini31: '适合复杂 Agent 工作流的多模态推理。',
    gpt56Terra: '兼顾智能与成本的日常工作模型。',
    gpt55: '擅长复杂专业工作的高阶推理。',
    qwen37: '适合 Agent 工作流的高效多模态推理。',
    opus48: '适合复杂规划与 Agent 工作。',
    opus46: '适合剧本与制作规划的稳定推理。',
  },
  'en-US': {
    auto: 'Balanced speed, effort, and cost.',
    kimi27: 'Efficient coding and agent execution.',
    fable51: "Anthropic's most capable model for long-running agents and demanding reasoning.",
    fable5: 'High-end reasoning for long-running agents.',
    gpt6Astra: 'Flagship reasoning tier: deeper reasoning at higher quality.',
    gpt6Sol: 'Built for complex coding and agentic workflows.',
    gpt6Luna: 'Most efficient tier for focused, high-volume tasks.',
    gpt56Sol: 'Frontier reasoning for your hardest tasks.',
    qwen36: 'Balanced reasoning for coding and productivity.',
    gemini35: 'Fast multimodal reasoning for everyday tasks.',
    deepseekFlash: 'General-purpose model for creative planning, drafting, and follow-up tasks.',
    default: 'General-purpose model for creative planning, drafting, and follow-up tasks.',
    sonnet46: 'Balanced reasoning for everyday creative work.',
    opus55: 'Latest Opus: deep reasoning for long-horizon coding and knowledge work.',
    opus5: 'Deep reasoning for long-horizon, high-complexity work.',
    opus47: 'Deep reasoning for complex creative refinement.',
    sonnet5: 'Strong reasoning for complex creative and agent tasks.',
    gemini37: 'Fast multimodal reasoning for agent workflows.',
    gemini38: 'Fast multimodal reasoning for agent workflows with Gemini 3.8 Flash.',
    kimi2: 'Cost-aware reasoning for tool-driven tasks.',
    gemini36: 'Fast multimodal model with fixed sampling defaults, tuned for quick ideation and lightweight checks.',
    kimi26: 'Capable coding and long-running agent work.',
    gpt56Luna: 'Fast, low-cost execution for focused tasks.',
    gemini31: 'Multimodal reasoning for complex agent workflows.',
    gpt56Terra: 'Balanced intelligence and cost for everyday work.',
    gpt55: 'Strong reasoning for complex professional work.',
    qwen37: 'Efficient multimodal reasoning for agent workflows.',
    opus48: 'Deep reasoning for complex planning and agent work.',
    opus46: 'Reliable reasoning for scripts and production planning.',
  },
  'ja-JP': {
    auto: '速度、思考量、コストのバランスを取ります。',
    kimi27: '日常の企画、プロンプト草案、短いタスクに向いた高速で低コストなモデルです。',
    fable51: '長時間エージェントと高度な推論向けの最上位モデルです。',
    fable5: '物語構成、脚本、トーンを保った文章制作に向いたモデルです。',
    gpt6Astra: '最上位の推論モデル。より深い推論と高い品質。',
    gpt6Sol: '複雑なコーディングとエージェントワークフロー向け。',
    gpt6Luna: '絞られた高頻度タスクに最も効率的なモデル。',
    gpt56Sol: '高難度タスク向けの最上位推論モデルです。',
    qwen36: 'コーディングと生産性タスク向けのバランス型推論です。',
    gemini35: '素早い発想、視覚参照、軽い確認に向いた高速マルチモーダルモデルです。',
    deepseekFlash: '企画、草案、追質問に使える汎用モデルです。',
    default: '企画、草案、追質問に使える汎用モデルです。',
    sonnet46: 'ブレスト、動画コンセプト、プロンプト作成、脚本生成に向いた標準モデルです。',
    opus55: '最新の Opus。長期のコーディングや知的作業に向いた深い推論モデルです。',
    opus5: '長期かつ高難度の作業に向いた深い推論モデルです。',
    opus47: '絵コンテ調整、プロンプト反復、脚本磨き込みに向いた創造推論モデルです。',
    sonnet5: '複雑な制作とエージェント作業に強い推論モデルです。',
    gemini37: 'エージェント作業向けの高速マルチモーダル推論です。',
    gemini38: 'Gemini 3.8 Flash によるエージェント作業向けの高速マルチモーダル推論です。',
    kimi2: 'ツールを使うタスク向けの低コストな推論モデルです。',
    gemini36: 'サンプリング設定が固定された高速マルチモーダルモデル。アイデア出しや軽量なチェックに適しています。',
    kimi26: '軽いブレスト、プロンプト作成、簡単な追質問に向いています。',
    gpt56Luna: '絞られたタスクを高速かつ低コストで実行します。',
    gemini31: '視覚分析、構造化推論、大きめのタスクに向いたマルチモーダルモデルです。',
    gpt56Terra: '日常作業で知能とコストを両立します。',
    gpt55: '複雑な制作ワークフローと制作計画向けの高度な推論モデルです。',
    qwen37: 'エージェント作業向けの効率的なマルチモーダル推論です。',
    opus48: '複雑なタスク編成、複数カットの動画設計、長い物語推論に向いています。',
    opus46: '長い脚本、方向性整理、シーン単位の計画を安定して扱えます。',
  },
  'ko-KR': {
    auto: '속도, 사고량, 비용의 균형을 맞춥니다.',
    kimi27: '일상 창작 기획, 프롬프트 초안, 짧은 작업에 빠르고 경제적인 모델입니다.',
    fable51: '장기 실행 에이전트와 고난도 추론을 위한 최상위 모델입니다.',
    fable5: '스토리 구조, 스크립트, 일관된 문체 작성에 초점을 둔 모델입니다.',
    gpt6Astra: '최상위 추론 등급. 더 깊은 추론과 높은 품질.',
    gpt6Sol: '복잡한 코딩과 에이전트 워크플로를 위해 설계되었습니다.',
    gpt6Luna: '집중된 대량 작업에 가장 효율적인 등급입니다.',
    gpt56Sol: '고난도 작업을 위한 최상위 추론 모델입니다.',
    qwen36: '코딩과 생산성 작업을 위한 균형 잡힌 추론입니다.',
    gemini35: '빠른 아이데이션, 시각 참고, 가벼운 확인에 적합한 멀티모달 모델입니다.',
    deepseekFlash: '창작 기획, 초안 작성, 후속 작업에 쓰는 범용 모델입니다.',
    default: '창작 기획, 초안 작성, 후속 작업에 쓰는 범용 모델입니다.',
    sonnet46: '브레인스토밍, 영상 콘셉트, 프롬프트 초안, 스크립트 생성에 적합한 기본 모델입니다.',
    opus55: '최신 Opus. 장기 코딩과 지식 작업에 적합한 심층 추론 모델입니다.',
    opus5: '장기적이고 복잡한 작업에 적합한 심층 추론 모델입니다.',
    opus47: '스토리보드 보정, 프롬프트 반복, 스크립트 다듬기에 적합합니다.',
    sonnet5: '복잡한 창작과 에이전트 작업에 강한 추론 모델입니다.',
    gemini37: '에이전트 작업을 위한 빠른 멀티모달 추론입니다.',
    gemini38: 'Gemini 3.8 Flash를 사용하는 에이전트 작업용 빠른 멀티모달 추론입니다.',
    kimi2: '도구 기반 작업을 위한 비용 효율적인 추론 모델입니다.',
    gemini36: '샘플링 설정이 고정된 빠른 멀티모달 모델로, 아이디어 구상과 가벼운 확인 작업에 적합합니다.',
    kimi26: '가벼운 브레인스토밍, 프롬프트 작성, 간단한 후속 질문에 적합합니다.',
    gpt56Luna: '집중된 작업을 빠르고 저렴하게 실행합니다.',
    gemini31: '시각 분석, 구조적 추론, 더 큰 작업에 적합한 멀티모달 기획 모델입니다.',
    gpt56Terra: '일상 작업에서 지능과 비용의 균형을 제공합니다.',
    gpt55: '복잡한 창작 워크플로와 제작 기획을 위한 고급 추론 모델입니다.',
    qwen37: '에이전트 작업을 위한 효율적인 멀티모달 추론입니다.',
    opus48: '복잡한 작업 편성, 다중 샷 영상 기획, 긴 스토리 추론에 적합합니다.',
    opus46: '긴 스크립트, 창작 방향, 장면별 기획을 안정적으로 처리합니다.',
  },
};

/** 取官方 `info.capabilities.<cap>` 标签（未命中回落英文，再回落 capability 名）。 */
export function officialCapabilityLabel(capability: OfficialCapability, locale: string): string {
  const table = OFFICIAL_CAPABILITY_LABELS[locale] ?? OFFICIAL_CAPABILITY_LABELS['en-US'];
  return table[capability] ?? OFFICIAL_CAPABILITY_LABELS['en-US'][capability] ?? capability;
}

/**
 * 取官方信息卡简介 —— 逐字对应 `o(\`chatAdapter.modelOptions.info.models.${key}.description\`, copy.description)`。
 * i18n 覆盖优先，回落 `fye[key].description`。
 */
export function officialModelInfoDescription(
  model: { id: string; label: string },
  locale: string,
): { key: string; copy: OfficialModelInfoCopy; description: string } {
  const key = officialModelKey(model);
  const copy = OFFICIAL_MODEL_INFO[key] ?? OFFICIAL_MODEL_INFO.default;
  const table = OFFICIAL_MODEL_INFO_DESCRIPTIONS[locale] ?? OFFICIAL_MODEL_INFO_DESCRIPTIONS['en-US'];
  const description = table?.[key] ?? OFFICIAL_MODEL_INFO_DESCRIPTIONS['en-US']?.[key] ?? copy.description;
  return { key, copy, description };
}

/* ══════════════════════════════════════════════════════════════════════════════
   官方列表分组 `Uxe`（Auto / 精选推荐 / 其余）—— 纯函数逐字移植
   ══════════════════════════════════════════════════════════════════════════════ */

/** 官方 `ua`：`(id, label) => \`${id} ${label}\`.toLowerCase()`。 */
function lowerName(id: string, label: string): string {
  return `${id} ${label}`.toLowerCase();
}

/** 官方 `Ov`：即将上线。 */
function isComingSoon(item: { availability?: string }): boolean {
  return item.availability === 'comingSoon';
}

/** 官方 `fq`：订阅锁定。 */
function isSubscriptionLocked(item: { availability?: string }): boolean {
  return item.availability === 'subscriptionLocked';
}

/** 官方 `ig`：可用（无 availability 或 `available`）。 */
export function isOfficialModelAvailable(item: { availability?: string }): boolean {
  return !item.availability || item.availability === 'available';
}

/** 官方 `hq`：是否 Auto 行（`e.id.toLowerCase() === "auto"`）。 */
function isAutoRow(item: { id: string }): boolean {
  return item.id.toLowerCase() === OFFICIAL_AUTO_MODEL_ID;
}

/** 官方 `wR`：gpt-5.6 的三种档位（`luna`/`sol`/`terra`）。 */
function gpt56Variant(item: { id: string; label: string }): 'luna' | 'sol' | 'terra' | undefined {
  const text = lowerName(item.id, item.label);
  if (/gpt[\s._-]*5[\s._-]*6[\s._-]*(?:luna|l)\b/.test(text)) return 'luna';
  if (/gpt[\s._-]*5[\s._-]*6[\s._-]*(?:sol|s)\b/.test(text)) return 'sol';
  if (/gpt[\s._-]*5[\s._-]*6[\s._-]*(?:terra|t)\b/.test(text)) return 'terra';
  return undefined;
}

/** 官方 `Txe` 用的 `Exe`：是 gpt-5.6 三档之一。 */
function isGpt56Tier(item: { id: string; label: string }): boolean {
  return gpt56Variant(item) !== undefined;
}

/** 官方 `cq`：Kimi / Moonshot。 */
function isKimiFamily(item: { id: string; label: string }): boolean {
  const text = lowerName(item.id, item.label);
  return text.includes('kimi') || text.includes('moonshot');
}

/** 官方 `dq`：Kimi 的版本号（`"27"` / `"26"` / null）。 */
function kimiVersion(item: { id: string; label: string }): '27' | '26' | null {
  if (!isKimiFamily(item)) return null;
  const text = lowerName(item.id, item.label).replace(/[\s._-]+/g, '');
  if (text.includes('k27') || text.includes('kimi27')) return '27';
  if (text.includes('k26') || text.includes('kimi26')) return '26';
  return null;
}

/** 官方 `T1`：Opus 5.5。 */
function isOpus55(item: { id: string; label: string }): boolean {
  const text = lowerName(item.id, item.label);
  return text.includes('claude-opus-5-5') || /\bopus[\s_-]*5\.5\b/.test(text);
}

/** 官方 `Mxe`：Opus 5（排除 5.5）。 */
function isOpus5(item: { id: string; label: string }): boolean {
  if (isOpus55(item)) return false;
  const text = lowerName(item.id, item.label);
  return text.includes('claude-opus-5') || /\bopus 5\b/.test(text);
}

/** 官方 `Pxe`：Fable 家族。 */
function isFableFamily(item: { id: string; label: string }): boolean {
  return lowerName(item.id, item.label).includes('fable');
}

/** 官方 `aq` / `lq` / `Axe`：gpt-6 的三支。 */
function isGpt6Sol(item: { id: string; label: string }): boolean {
  return /gpt[\s._-]*6[\s._-]*sol\b/.test(lowerName(item.id, item.label));
}
function isGpt6Luna(item: { id: string; label: string }): boolean {
  return /gpt[\s._-]*6[\s._-]*luna\b/.test(lowerName(item.id, item.label));
}

/** 官方 `Fxe`：Gemini 3.8 Flash。 */
function isGemini38Flash(item: { id: string; label: string }): boolean {
  const text = lowerName(item.id, item.label);
  return text.includes('gemini-3.8-flash') || text.includes('gemini 3.8 flash');
}

/** 官方 `_R`：DeepSeek Flash。 */
function isDeepseekFlash(item: { id: string }): boolean {
  return item.id === 'deepseek-flash';
}

/** 官方 `Dxe`：被排除出「精选推荐」的显式 id 集合。 */
const OFFICIAL_EXCLUDED_RECOMMENDED_IDS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'kimi-k2.6',
]);

/** 官方 `Lxe`：是否**不进**「精选推荐」（归入「更多模型」）。 */
export function isExcludedFromOfficialRecommended(item: { id: string; label: string; availability?: string }): boolean {
  return OFFICIAL_EXCLUDED_RECOMMENDED_IDS.has(item.id)
    || isComingSoon(item)
    || isGpt56Tier(item)
    || isOpus55(item)
    || isOpus5(item)
    || isFableFamily(item)
    || kimiVersion(item) === '27';
}

/** 官方 `Oxe`：精选推荐的**固定顺序**。 */
export const OFFICIAL_RECOMMENDED_ORDER = ['gemini38', 'gpt6luna', 'gpt6sol', 'deepseekFlash'] as const;

/** 官方 `zxe`：该模型属于精选推荐里的哪一格（不属于 ⇒ null）。 */
function recommendedSlot(item: { id: string; label: string }): string | null {
  if (isGemini38Flash(item)) return 'gemini38';
  if (isGpt6Luna(item)) return 'gpt6luna';
  if (isGpt6Sol(item)) return 'gpt6sol';
  if (isDeepseekFlash(item)) return 'deepseekFlash';
  return null;
}

export interface OfficialModelGroups<T> {
  /** 官方 `f`：`精选推荐` 标题下的行（顺序 = `Oxe`）。 */
  recommended: T[];
  /** 官方 `h`（去掉 Auto 后是 `w`）：Auto 之外的**主列表**行（官方目前只会放 Auto）。 */
  primary: T[];
  /** 官方 `g`：`更多模型` 折叠区里的行。 */
  other: T[];
}

/**
 * 官方 `Uxe` **逐字**：
 * ```js
 * Uxe = (e,t) => {
 *   if (t) return { recommended: t.flatMap(i => e.filter(l => l.id === i)), primary: [], other: e.filter(i => !t.includes(i.id)) };
 *   const n = { gemini38:[], gpt6luna:[], gpt6sol:[], deepseekFlash:[] }, o = [], r = [];
 *   for (const i of e) {
 *     if (Lxe(i)) { r.push(i); continue }
 *     const l = zxe(i);
 *     if (l) { n[l].push(i); continue }
 *     if (hq(i)) { o.push(i); continue }
 *     r.push(i);
 *   }
 *   return { recommended: Oxe.flatMap(i => n[i]), primary: o, other: r };
 * };
 * ```
 * ⚠️ `recommendedModelIds`（官方 `recommendedModelIds`）**优先**：给了就完全按它取，不再做 key 分桶。
 */
export function groupOfficialModelOptions<T extends { id: string; label: string; availability?: string }>(
  models: T[],
  recommendedModelIds?: string[] | null,
): OfficialModelGroups<T> {
  if (recommendedModelIds) {
    return {
      recommended: recommendedModelIds.flatMap((id) => models.filter((model) => model.id === id)),
      primary: [],
      other: models.filter((model) => !recommendedModelIds.includes(model.id)),
    };
  }
  const buckets: Record<string, T[]> = { gemini38: [], gpt6luna: [], gpt6sol: [], deepseekFlash: [] };
  const primary: T[] = [];
  const other: T[] = [];
  for (const model of models) {
    if (isExcludedFromOfficialRecommended(model)) {
      other.push(model);
      continue;
    }
    const slot = recommendedSlot(model);
    if (slot) {
      buckets[slot].push(model);
      continue;
    }
    if (isAutoRow(model)) {
      primary.push(model);
      continue;
    }
    other.push(model);
  }
  return {
    recommended: OFFICIAL_RECOMMENDED_ORDER.flatMap((slot) => buckets[slot]),
    primary,
    other,
  };
}

/** 供列表使用：`subscriptionLocked`（官方 `fq`）—— 行内会渲染「订阅解锁」徽标。 */
export { isSubscriptionLocked as isOfficialModelSubscriptionLocked };

