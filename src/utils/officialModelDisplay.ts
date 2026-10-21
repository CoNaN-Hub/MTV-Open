/**
 * officialModelDisplay — 官方「模型卡」元信息（**按模型族分别取官方表** ✓）
 *
 * 用户提醒 ✓：「不同卡片可选择的模型都不一样 —— 文本 / 图片 / 视频 / 音频 / 3D」✓
 *   → 节点类型 → 模型族 → 各自的官方表（官方本身就是分族的 ✓ EXE：图片 `jn`/`Rh`、
 *     视频 `Kt`/`po`、音频 `audio.virtualModel.*`、文本与 3D 各自有注册表 ✓）
 *
 * 每族给三样东西（都是官方原文 ✓ 不发明 ✗）：
 *   · `displayName` —— 官方 i18n `<族>Models.name.*`（中文包 ✓）
 *   · `featureTags` —— 官方逐模型 `featureTags` ✓（模板例：`image.featureTag.resolution:"{{value}}"`
 *       → **只显示值** ✓ 例 "4K" ✓）
 *   · `iconKey` —— 官方模型定义里的 `icon:da.XXX` ✓（path 数据见 `src/data/official-model-icons.json` ✓）
 *
 * 数据源（逐字段照抄官方抽取结果 ✓ 缺失一律 null ✓）：
 *   `src/data/official-model-meta.json`（111 条 = 图片 29 / 文本 16 / 视频 53 / 音频 8 / 3D 5 ✓）
 *   `src/data/official-model-icons.json`（官方 `_icons` 全部 33 条 ✓）
 *
 * ⚠️ **图片族仍用既有 `official-image-models.json`**（80 条，已现场实测过 ✓）：
 *   两张表逐条比对过 ✓ 有 6 条不一致（老表更长/更全，且部分是官方 `{...spread}` **继承**来的标签 ✓
 *   新抽表里是 null ✗）→ 换过去会**回退现场已验证的行为** ✗ → 图片族的名称/标签仍走老表 ✓
 *   新表在图片族只贡献 **iconKey** ✓（老表里没有图标字段 ✓）
 *
 * 未落地的族 → 返回空 ✓（调用方保留 MTV 自己的名称/说明 ✓ 不覆盖 ✗）
 */
import {
  candidateList,
  findImageModelCapability,
  officialModelDisplay as imageDisplay,
  type ModelKey,
} from './imageModelCapabilities';
import OFFICIAL_META from '../data/official-model-meta.json';

export type ModelFamily = 'image' | 'video' | 'audio' | 'text' | 'threeD';

/** 节点类型 → 官方模型族 ✓（MTV 的 NodeType ✓ 与官方族的对应关系 ✓）*/
export function nodeTypeToModelFamily(nodeType: string | undefined | null): ModelFamily | null {
  switch (nodeType) {
    case 'ai-image':
    case 'ai-panorama':
    case 'ai-animation':
      return 'image';
    case 'ai-video':
      return 'video';
    case 'ai-audio':
      return 'audio';
    case 'ai-text':
    case 'ai-markdown':
    case 'ai-storyboard':
    case 'ai-shotlist':
    case 'ai-director':
      return 'text';
    default:
      return null;
  }
}

export interface OfficialFeatureTag {
  label: string;
  value: string | null;
}

export interface OfficialCardMeta {
  /**
   * ⚠️ **已移除 displayName** —— 名称不再由本文件解析。
   *
   * 用户 2026：「UI 的模型选择器、当前模型标签、会话历史、消息卡片、设置页等所有位置，
   * 只能展示 displayName」「禁止凭模型 ID 猜测一个『看起来合理』的官方名称」。
   * 本文件原来用**正则关键词族 + 最长 includes + 变体名表**猜官方名
   * （KEYWORD_RULES / VARIANT_DISPLAY / upstreamModelIdOverride），属于被点名删除的猜测式匹配。
   * 现在名称的唯一来源是 services/models/display（映射配置 → 官方 Registry → 原始调用 id）；
   * 本文件只保留**不涉及名字**的元信息：图标 / 分辨率标签 / 简介。
   */
  featureTags: OfficialFeatureTag[];
  /** 官方品牌图标键（`da.*` ✓ 见 `official-model-icons.json`）*/
  iconKey: string | null;
  /** ★ 官方模型简介（中文包 ✓ EXE `descriptions:*` ✓ 用户选定用它替换「几K」那格 ✓）*/
  description?: string | null;
}

/** `official-model-meta.json` 的一条记录 ✓ */
export interface OfficialMetaEntry {
  modelId: string;
  displayName: string | null;
  featureTags: OfficialFeatureTag[];
  iconKey: string | null;
  /** 官方模型简介（中文包 ✓ 见 `_notes`：5 条音频官方没有中文简介 → null ✓）*/
  description?: string | null;
  descriptionKey?: string;
}

const META = OFFICIAL_META as unknown as Record<ModelFamily, Record<string, OfficialMetaEntry>>;

const EMPTY_TAGS: OfficialFeatureTag[] = [];
const EMPTY: OfficialCardMeta = { featureTags: EMPTY_TAGS, iconKey: null };

/** 归一化 id：小写 + 把 `.` `_` `-` `/` 空白统一成 `-` ✓
 *  （官方 id 与上游 id 的分隔符不一致 ✓ 例：上游 `doubao-seedance-2-0-260128` ↔ 官方 `seedance-2.0` ✓）*/
function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[._\-\s/]+/g, '-');
}

const FAMILIES: ModelFamily[] = ['image', 'video', 'audio', 'text', 'threeD'];

/** 归一化官方 id → iconKey ✓（**跨族** ✓ 品牌图标与族无关 ✓ 也用于图片族按老表映射出来的官方 id 取图标 ✓）*/
const ICON_BY_OFFICIAL_MODEL_ID: Record<string, string> = {};
/** 每族官方 id 按**长度降序** ✓（长 id 优先 ✓ 避免短 id 抢匹配 ✓）*/
const SORTED_ENTRIES: Record<ModelFamily, Array<{ id: string; entry: OfficialMetaEntry }>> = {
  image: [], video: [], audio: [], text: [], threeD: [],
};

for (const family of FAMILIES) {
  for (const entry of Object.values(META[family])) {
    if (entry.iconKey) ICON_BY_OFFICIAL_MODEL_ID[normalizeId(entry.modelId)] = entry.iconKey;
    SORTED_ENTRIES[family].push({ id: normalizeId(entry.modelId), entry });
  }
  SORTED_ENTRIES[family].sort((a, b) => b.id.length - a.id.length);
}

/**
 * 关键词族 → 官方**真实 id** ✓（官方表里逐条核对过 ✓ 与 `imageModelCapabilities` 同一套思路 ✓）
 *
 * ⚠️ 只写**版本能对上**的规则 ✗ 对不上就不写 ✗（例：MTV `apimart/claude-opus-4-7` 而官方只有
 *    `anthropic.claude-opus-5` ✗ → 不写规则 → 名称保留 MTV 自己的 ✓ 图标仍走品牌兜底 ✓）
 * ⚠️ `null` = **显式屏蔽** ✓：这类候选**明确不是**官方模型（例 RunningHub 的 `kling-lip-sync`
 *    对口型工作流 ✗ 官方 `kling` = Kling 2.1 ✗）→ 不给官方名 ✓ 只给品牌图标 ✓
 * ⚠️ 顺序 = 优先级 ✓（具体的写在前面 ✓）
 */
type KeywordRule = readonly [RegExp, string | null];

const KEYWORD_RULES: Record<ModelFamily, ReadonlyArray<KeywordRule>> = {
  image: [],
  text: [
    [/gemini.*3-6/, 'gemini-3.6-flash'],
    [/gemini.*3-5/, 'gemini-3.5-flash'],
    [/gemini.*3-1.*flash.*lite/, 'gemini-3.1-flash-lite'],
    [/gemini.*3-1.*pro/, 'gemini-3.1-pro'],
    [/gemini.*3.*flash/, 'gemini-3-flash'],
    [/gemini.*3.*pro/, 'gemini-3-pro'],
    [/gemini.*2-5.*flash/, 'gemini-2.5-flash'],
    [/gemini.*2-5.*pro/, 'gemini-2.5-pro'],
    [/deepseek/, 'deepseek-v4-pro'],
  ],
  video: [
    [/lip-?sync|identify-face|ai-avatar/, null],
    [/seedance.*2-5|seedance.*2\.5/, 'seedance-2.5'],
    [/seedance.*1-5.*pro/, 'seedance-1.5-pro'],
    [/seedance.*1-0.*pro/, 'doubao-seedance-pro'],
    [/seedance.*lite/, 'doubao-seedance-lite'],
    [/kling.*v?3.*pro/, 'kling-v3-pro'],
    [/kling.*v?3/, 'kling-v3-pro'],
    [/kling.*o3/, 'kling-video-o3'],
    [/kling.*o1/, 'kling-video-o1'],
    [/kling.*motion|motion-control/, 'kling-motion-control'],
    [/kling.*2-5/, 'kling-v2-5-turbo-pro'],
    [/kling.*2-6/, 'kling-v2-6'],
    [/sora.*2.*pro/, 'sora-2-pro'],
    [/sora/, 'sora-2-standard'],
    [/veo.*3-1.*lite/, 'veo3.1-lite'],
    [/veo.*3-1/, 'veo3.1'],
    [/veo.*3.*fast/, 'veo3-fast'],
    [/veo.*3/, 'veo3'],
    [/veo.*2/, 'veo2'],
    [/gemini.*omni.*1-1/, 'gemini-omni-1.1-flash'],
    [/gemini.*omni/, 'gemini-omni-flash'],
    [/hailuo.*2-3.*fast|minimax.*2-3.*fast/, 'MiniMax-Hailuo-2.3-Fast'],
    [/hailuo.*2-3|minimax.*2-3/, 'MiniMax-Hailuo-2.3'],
    [/h3.*max|hailuo.*h3.*max/, 'MiniMax-H3-Max'],
    [/h3/, 'MiniMax-H3'],
    [/vidu.*q3/, 'viduq3-pro'],
    [/vidu.*q2.*pro/, 'viduq2-pro'],
    [/vidu.*q2.*turbo/, 'viduq2-turbo'],
    [/vidu.*q2/, 'viduq2'],
    [/vidu.*q1/, 'viduq1'],
    [/wan.*3-0/, 'wan3.0-video'],
    [/wan.*2-6/, 'wanxiang-v2-6'],
    [/wan.*2-5/, 'wanxiang-preview'],
    [/wan.*2-2.*flash/, 'wanxiang-i2v-flash'],
    [/wan.*2-2/, 'wanxiang-plus'],
    [/happyhorse.*1-1/, 'happyhorse-1.1'],
    [/happyhorse/, 'happyhorse-1.0'],
    [/flux.*3/, 'flux-3'],
    [/omnihuman/, 'omnihuman-1.5'],
    [/grok.*1-5/, 'grok-imagine-video-1.5'],
    [/grok/, 'grok-imagine-video'],
    [/pixverse.*5-5/, 'pixverse-v5.5'],
    [/pixverse.*5/, 'pixverse-v5'],
    [/midjourney/, 'midjourney-video'],
  ],
  audio: [
    [/minimax.*music.*2-6/, 'minimax-music-26'],
    [/mureka.*v8/, 'mureka-v8'],
    [/mureka.*o2/, 'mureka-o2'],
    [/eleven.*v3|11lab/, 'elevenlabs-v3'],
    [/lyria.*3.*pro/, 'lyria-3-pro'],
    [/lyria/, 'lyria-3-clip'],
    [/seed.*audio|doubao.*audio/, 'seed-audio-1-0'],
    [/sonilo/, 'sonilo-music'],
  ],
  threeD: [
    [/tripo.*text/, 'tripo-text-to-model-h3'],
    [/tripo/, 'tripo-image-to-model-h3'],
    [/marble.*plus/, 'worldlabs-marble-1.1-plus'],
    [/marble|worldlabs/, 'worldlabs-marble-1.1'],
  ],
};

/**
 * 品牌 → 官方图标 ✓（**只给图标，不给名字** ✓）
 *
 * 用途：官方**没有这个模型**、但**有这个品牌**的官方图标时（例：MTV `apimart/gpt-5.4`
 *   官方文本表里没有 gpt-5.4 ✗ 但官方自己的 GPT 模型用的是 `da.OPENAI` ✓）
 *   → 名称/标签仍保留 MTV 自己的 ✓（不覆盖 ✗ 不编造 ✗），只是**不再退回灰色字母块** ✓
 *   （用户："logo 颜色不对 有的都没有" ✓）
 * ⚠️ 顺序 = 优先级 ✓（窄的写在前面 ✓ 例 `happyhorse` → ALIBABA ✓，`wan*` → WANXIANG ✓）
 */
const BRAND_ICON_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/gpt|openai|dall|(^|-)(o3|o4)(-|$)/, 'da.OPENAI'],
  [/claude|anthropic/, 'da.CLAUDE'],
  [/deepseek/, 'da.DEEPSEEK'],
  [/kimi|moonshot/, 'da.KIMI'],
  [/grok|xai/, 'da.XAI'],
  [/nano-?banana|gemini|imagen|veo/, 'da.GEMINI'],
  [/seedream|seedance|seed-audio|doubao|bytedance|jimeng|dreamina/, 'da.SEEDANCE'],
  [/kling|kuaishou/, 'da.KLING'],
  [/minimax|hailuo/, 'da.MINIMAX'],
  [/happyhorse/, 'da.ALIBABA'],
  [/(^|-)wan|wanxiang/, 'da.WANXIANG'],
  [/qwen|tongyi|alibaba/, 'da.ALIBABA'],
  [/vidu/, 'da.VIDU'],
  [/pixverse/, 'da.PIXVERSE'],
  [/sora/, 'da.SORA'],
  [/midjourney|(^|-)mj(-|$)/, 'da.MIDJOURNEY'],
  [/recraft/, 'da.RECRAFT'],
  [/reve/, 'da.REVE'],
  [/elevenlabs|11lab/, 'da.ELEVENLAB'],
  [/mureka/, 'da.MUREKA'],
  [/sonilo/, 'da.SONILO'],
  [/tripo/, 'da.TRIPO'],
  [/marble|worldlabs/, 'da.WORLDLABS'],
  [/flux|kontext|(^|-)bfl(-|$)/, 'da.BFL'],
  [/luma|dream-?machine/, 'da.LUMA'],
  [/tapnow/, 'da.TAPNOW'],
];

/**
 * 版本尾保护 ✓：`apimart/kling-v3` 里 `kling` 是官方 **2.1** 的 id ✗
 *   后面还跟着 `-v3` → 说明候选是**另一个版本** → 不能拿 2.1 的名字/标签 ✗
 *   （日期快照尾 `-260128` 不算版本 ✗ 所以只认 1~2 位数字 ✓）
 */
const VERSION_TAIL = /^-(v\d{1,2}|\d{1,2})(-|$)/;

/** 一个候选名的匹配结果 ✓（score = 命中官方 id 的**长度** ✓ 越长越具体 ✓）*/
interface CandidateMatch {
  entry: OfficialMetaEntry | null;
  score: number;
  /** 显式屏蔽（关键词规则里 target=null ✓）→ **该候选不给官方名** ✓ */
  blocked: boolean;
}

/** 单个候选名 → 官方记录 ✓（includes 与关键词**都比一遍取更具体的** ✓）*/
function matchOne(candidate: string, family: ModelFamily): CandidateMatch | null {
  const norm = normalizeId(candidate);
  if (!norm) return null;

  /* ① 关键词族（含显式屏蔽 ✓）*/
  let keyword: CandidateMatch | null = null;
  for (const [pattern, target] of KEYWORD_RULES[family]) {
    if (!pattern.test(norm)) continue;
    if (target === null) return { entry: null, score: 0, blocked: true };
    const entry = META[family][target.toLowerCase()];
    if (entry) keyword = { entry, score: normalizeId(entry.modelId).length, blocked: false };
    break;
  }

  /* ② 官方 id 长度降序 includes ✓ */
  let includes: CandidateMatch | null = null;
  for (const { id, entry } of SORTED_ENTRIES[family]) {
    if (!id) continue;
    const at = norm.indexOf(id);
    if (at < 0) continue;
    if (VERSION_TAIL.test(norm.slice(at + id.length))) continue;
    includes = { entry, score: id.length, blocked: false };
    break;
  }

  if (includes && keyword) return keyword.score > includes.score ? keyword : includes;
  return keyword ?? includes;
}

/**
 * 候选名数组 → 官方记录 ✓（**取最具体的一个** ✓ 不是"第一个能命中的" ✗）
 *
 * 事故：RunningHub `minimax/hailuo-h3/text-to-video` 的 value 里只有 `minimax`
 *   （官方 `minimax` = Hailuo-02 ✗）而它的 **label** 是 `MiniMax-H3 Text-to-Video` ✓
 *   → 逐候选比长度后由 label 胜出 ✓（否则会把 Hailuo-03 显示成 Hailuo-02 ✗）
 */
function matchEntry(candidates: string[], family: ModelFamily): OfficialMetaEntry | null {
  let best: CandidateMatch | null = null;
  for (const candidate of candidates) {
    const hit = matchOne(candidate, family);
    if (!hit || hit.blocked) continue;
    if (!best || hit.score > best.score) best = hit;
  }
  return best?.entry ?? null;
}

/** 品牌兜底：候选里出现官方认得出来的**品牌**时给该品牌的官方图标 ✓（给不出就 null ✓）*/
function brandIconKey(candidates: string[]): string | null {
  const haystack = normalizeId(candidates.join(' '));
  if (!haystack) return null;
  for (const [pattern, iconKey] of BRAND_ICON_RULES) {
    if (pattern.test(haystack)) return iconKey;
  }
  return null;
}

/** 该族该模型的官方**图标 key** ✓（独立导出：调用方可以只取图标 ✓）*/
export function officialIconKey(key: ModelKey, family: ModelFamily | null): string | null {
  if (!family) return null;
  const candidates = candidateList(key);
  if (!candidates.length) return null;

  /* 图片族：先按老表映射出来的**官方 id** 直接查 ✓（老表 80 条比官方 29 条宽 ✓）*/
  if (family === 'image') {
    const cap = findImageModelCapability(key);
    const fromCap = cap ? ICON_BY_OFFICIAL_MODEL_ID[normalizeId(cap.model)] : undefined;
    if (fromCap) return fromCap;
  }
  const entry = matchEntry(candidates, family);
  if (entry?.iconKey) return entry.iconKey;
  return brandIconKey(candidates);
}

/** 取该族该模型的官方模型卡元信息 ✓ */
export function officialCardMeta(key: ModelKey, family: ModelFamily | null): OfficialCardMeta {
  if (!family) return EMPTY;
  const iconKey = officialIconKey(key, family);
  /* 图片族：名称/标签走**既有老表** ✓（见文件头注释 ✓ 换新表会回退已验证行为 ✗）
     ★ 但**简介**要取新表 ✓（老表里没有简介字段 ✗）→ 用老表匹配出来的官方 id 去新表查 ✓ */
  if (family === 'image') {
    /* 图片族：**名称由 services/models/display 负责**（本文件不再产出名字）
       —— 这里只补「分辨率标签 + 简介 + 图标」。
       ⚠️ 标签仍走既有老表（见文件头：换新表会回退现场已验证的 6 条行为 ✗）。*/
    const legacy = imageDisplay(key);
    const legacyId = findImageModelCapability(key)?.model ?? null;
    const entry = legacyId ? matchEntry([legacyId], 'image') : null;
    return {
      featureTags: legacy.featureTags.length ? legacy.featureTags : EMPTY_TAGS,
      iconKey,
      description: entry?.description ?? null,
    };
  }
  /* 其余族（文本/视频/音频/3D）：官方新表 ✓ */
  const entry = matchEntry(candidateList(key), family);
  if (!entry) return { featureTags: EMPTY_TAGS, iconKey, description: null };
  return {
    featureTags: entry.featureTags.length ? entry.featureTags : EMPTY_TAGS,
    iconKey: entry.iconKey ?? iconKey,
    description: entry.description ?? null,
  };
}

/** 便于校验脚本/调试：某族的官方 id 列表 ✓ */
export function officialFamilyModelIds(family: ModelFamily): string[] {
  return SORTED_ENTRIES[family].map((item) => item.entry.modelId);
}
