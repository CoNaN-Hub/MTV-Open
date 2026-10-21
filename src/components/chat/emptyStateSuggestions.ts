/**
 * emptyStateSuggestions —— 官方空态建议的**本地兜底池**（逐字取自 `page-DVqoHdTT.js`@978362 / @979044）。
 *
 * 官方 `U5()`：语言以 `zh` 开头用 `Cue`（中文池），否则用 `Sue`（英文池）；
 * 空会话取前 `Nue=2` 条、已有消息时取前 `Iue=3` 条（`PAGE@979697` / `@981600`）。
 * 官方还会优先用服务端动态建议（带 `description`）；MTV 没有服务端 ⇒ 走这个本地池，
 * 条目没有 description 时官方会退化成用 prompt 文本当说明（`n$({query, pillsOnly:true})`）。
 */
/** 官方建议卡分类（`chip.category`）。
 *  六个「真」分类 = 官方 `Jie` 的键（live 主 chunk `vendor-pkg-canvas-ChpWx5JY.js` @2567697）：
 *  `inspiration` / `character` / `reference` / `analyze` / `next_step` / `organize`；
 *  另两个由官方 `YV`（@2567784）**前置分支**单独接管、不走 `Jie`：`brainstorm` / `visualize`。 */
export type SuggestionCategory =
  | 'next_step'
  | 'inspiration'
  | 'organize'
  | 'analyze'
  | 'reference'
  | 'character'
  | 'brainstorm'
  | 'visualize';

export interface EmptyStateSuggestion {
  id: string;
  /** 官方 `label`（卡片标题） */
  title: string;
  /** 官方 `query`（点击后填进输入框的提示词） */
  prompt: string;
  /** 官方 `chip.category` → 图标映射见官方 `Jie` / `YV` */
  iconCategory: SuggestionCategory;
  /** 官方 `chip.description`（可选）：服务端动态建议会带；本地兜底池没有 ⇒
   *  官方退化成渲染 `query` 本身（`b1e` pills + `y1e`），MTV 走同一退化的简化版（见 EmptyChatState）。 */
  description?: string;
  /** 官方 `chip.suggestionType`（可选）：横排卡片在图标右侧多渲染一枚 `text-[13px] font-semibold` 徽标。 */
  suggestionType?: string;
}

/** 官方 `Sue`（EN）逐字。 */
const SUE: ReadonlyArray<Omit<EmptyStateSuggestion, 'id'>> = [
  { title: 'Find the next step', prompt: 'Review this canvas and suggest the clearest next creative step.', iconCategory: 'next_step' },
  { title: 'Explore visual ideas', prompt: 'Help me explore a few strong visual directions based on this project.', iconCategory: 'inspiration' },
  { title: 'Improve the prompt', prompt: 'Turn the current idea into a more detailed generation prompt.', iconCategory: 'organize' },
  { title: 'Analyze what is here', prompt: 'Analyze this canvas and summarize what is working, what is missing, and what to try next.', iconCategory: 'analyze' },
  { title: 'Find references', prompt: 'Suggest reference directions that would help develop this project further.', iconCategory: 'reference' },
];

/** 官方 `Cue`（ZH）逐字。 */
const CUE: ReadonlyArray<Omit<EmptyStateSuggestion, 'id'>> = [
  { title: '看看下一步做什么', prompt: '请看一下当前画布内容，帮我判断最清晰的下一步创作方向。', iconCategory: 'next_step' },
  { title: '找点视觉灵感', prompt: '请基于这个项目，帮我发散几个有潜力的视觉方向。', iconCategory: 'inspiration' },
  { title: '优化生成提示词', prompt: '请把当前想法整理成更完整、更适合生成的 prompt。', iconCategory: 'organize' },
  { title: '分析当前内容', prompt: '请分析这个画布里已经成立的部分、缺失的部分，以及接下来值得尝试的方向。', iconCategory: 'analyze' },
  { title: '找参考方向', prompt: '请给我一些适合继续发展这个项目的参考方向。', iconCategory: 'reference' },
];

/** 官方 `U5()`：以 zh 开头用中文池，否则英文池。 */
export function suggestionPool(locale: string): ReadonlyArray<EmptyStateSuggestion> {
  const normalized = locale.replace(/_/g, '-').toLowerCase();
  const source = normalized === 'zh' || normalized.startsWith('zh-') ? CUE : SUE;
  return source.map((item, index) => ({ id: `local-suggestion-${index}`, ...item }));
}

/** 取一页建议（官方空态 2 条 / 有消息时 3 条）；`page` 用于「换一批」。 */
export function suggestionPage(
  locale: string,
  count: number,
  page = 0,
): EmptyStateSuggestion[] {
  const pool = suggestionPool(locale);
  if (pool.length === 0) return [];
  const start = ((page * count) % pool.length + pool.length) % pool.length;
  return Array.from({ length: Math.min(count, pool.length) }, (_, index) =>
    pool[(start + index) % pool.length]);
}
