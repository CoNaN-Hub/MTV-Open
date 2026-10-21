/**
 * imageModelCapabilities — **官方模型能力表**（数据来自 TapNow EXE 原文 ✓ 不发明 ✓）
 *
 * 数据源：`src/data/official-image-models.json`
 *   从 EXE `index-BiTZf8mJ.js` 抽出 **77 个图片模型**的
 *   `aspectRatios` / `imageSizeOptions` / `qualityOptions` / `thinkingLevelOptions` /
 *   `maxImages` / `defaults` ✓（结构见 EXE ✓）
 *
 * 用途：底部编辑栏的「比例·画质」弹窗**按模型**给可见比例与画质档 ✓
 *   （官方同一个弹窗在不同模型下项数不同：7 项 / 11 项 / 含 "Auto" ✓ 实测过 ✓）
 */
import OFFICIAL_MODELS from '../data/official-image-models.json';

export interface ImageModelCapability {
  model: string;
  provider: string;
  /** 该模型允许的比例（官方原文 ✓）· null = 官方没给该字段 ✓ · 可含 `"auto"`（= UI 的「自适应」✓）*/
  aspectRatios: string[] | null;
  /** 画质档（官方原文 ✓）：
   *    数组   = 字面量 ✓
   *    对象   = 官方**函数**形态 `{aspectRatio} => …` → `{kind:'fn', byAspectRatio:{auto:[], __default:[…]}}` ✓
   *    null   = 官方没有该字段 ✓
   *  （历史遗留的 `'(fn)'` 字符串仍兼容 ✓）*/
  imageSizeOptions: string[] | '(fn)' | { kind: 'fn'; byAspectRatio: Record<string, string[]> } | null;
  qualityOptions: string[] | null;
  thinkingLevelOptions: string[] | null;
  /** 官方图片节点里的「透明背景」开关是否对该模型开放 ✓（EXE 逐模型 ✓ 只有 2.5 系列 true ✓）*/
  transparentBackground?: boolean;
  /** ★★★★★ **官方显示名** ✓✓（EXE i18n `imageModels.name.*` 的**中文包** ✓ 用户："模型名对齐官方" ✓）
   *  例：`flux-2-pro → "Flux 2 Pro"` · `gemini-banana-2 → "Tap Nano Pro"` ✓ */
  displayName?: string | null;
  /** ★★★★★ **官方模型卡下方的标签** ✓✓（EXE 逐模型 `featureTags` ✓ 用户："下面几k" ✓）
   *  官方模板原文 ✓：`image.featureTag.resolution:"{{value}}"` → **只显示值** ✓（"4K"/"2K"/"1080P" ✓）*/
  featureTags?: Array<{ label: string; value: string | null }>;
  maxImages: number | null;
  defaultAspectRatio: string | null;
  defaultImageSize: string | null;
  defaultQuality: string | null;
}

/** 从 `imageSizeOptions` 里按 aspectRatio 取档位 ✓（三种形态统一处理 ✓）*/
function readSizeOptions(raw: ImageModelCapability['imageSizeOptions'], aspectRatio?: string): string[] | null {
  const isAuto = (aspectRatio ?? '').toLowerCase() === 'auto' || aspectRatio === '自适应';
  if (Array.isArray(raw)) return raw;
  if (raw === '(fn)') return isAuto ? [] : ['1K', '2K', '4K'];
  if (raw && typeof raw === 'object' && raw.byAspectRatio) {
    const by = raw.byAspectRatio;
    return (isAuto ? by.auto : by.__default) ?? by.__default ?? [];
  }
  return null;
}

const TABLE = OFFICIAL_MODELS as ImageModelCapability[];

/** ★★★★★ **可传多个候选名** ✓（用户："自定义模型 你映射官方的" ✓）
 *  自定义连接的模型 value 形如 `general/provider-custom-<hash>` ✗ 里面**没有官方模型名** ✗
 *  但 `GeneralModelConfig` 里有：
 *    · `modelId` = **上游真实模型名**（如 `gemini-3.1-flash-image-preview` ✓✓ 最有价值）
 *    · `name`    = 用户可读名（如 `Nano Banana Pro` ✓）
 *  → 调用方按 `[value, modelId, name]` 依次尝试匹配官方表 ✓（第一个命中即为准 ✓）
 *  兼容：只传一个 string 时行为与旧版完全一致 ✓
 */
export type ModelKey = string | Array<string | undefined | null> | undefined | null;

/* 导出给 `officialModelDisplay` 复用 ✓（候选名列表规则只此一份 ✓ 避免两份走岔 ✗）*/
export function candidateList(key: ModelKey): string[] {
  if (!key) return [];
  const arr = Array.isArray(key) ? key : [key];
  return arr
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/** 单个候选名的匹配（原逻辑 ✓ 不变 ✓） */
function matchOne(modelId: string): ImageModelCapability | null {
  const id = modelId.toLowerCase();

  /* ① 官方 id 按**长度降序**匹配 ✓（长 id 优先 ✓ 避免前缀抢占 ✓）*/
  const sorted = [...TABLE].sort((a, b) => b.model.length - a.model.length);
  const exact = sorted.find((m) => id.includes(m.model.toLowerCase()));
  if (exact) return exact;

  /* ② 关键词族 → 官方**真实 id** ✓（官方表里逐条核对过 ✓）*/
  const families: Array<[RegExp, string]> = [
    /* ★★★★★ **Pro 必须先于 Flash 判** ✗✓（用户实录：`gemini-3-pro-image-preview` 被
         `image.*preview` 抢去判成 Flash ✗ → 显示 "Banana 2" ✗ 而它其实是 **Pro** ✓）
         官方表里 Pro = `tamar-google-gemini-pro`（中文名 `Tap Nano Pro` ✓）*/
    [/gemini.*pro.*image|pro.*image.*preview|nano.?banana.*pro/, 'tamar-google-gemini-pro'],
    /* Google 家族 ✓ */
    [/flash.*image|gemini.*flash.*image|image.*preview/, 'nano-banana-flash'],
    [/nano.?banana.*lite/, 'nano-banana-flash-lite'],
    [/nano.?banana.*pro|nano.?banana.*2/, 'tamar-google-gemini-pro'],
    [/nano.?banana/, 'nano-banana'],
    [/gemini/, 'tamar-google-gemini-pro'],
    [/imagen/, 'imagen-4.0'],
    /* ByteDance 家族 ✓ */
    [/seedream.*5.*pro|seedream-5-0-pro/, 'doubao-seedream-5.0-pro'],
    [/seedream.*5.*lite/, 'doubao-seedream-5.0-lite'],
    [/seedream.*4\.?5/, 'doubao-seedream-4.5'],
    [/seedream/, 'doubao-seedream-4.0'],
    /* 其它 ✓ */
    [/flux.*2.*pro/, 'flux-2-pro'],
    [/flux.*kontext.*max/, 'flux-kontext-max'],
    [/flux.*kontext/, 'flux-kontext-pro'],
    [/flux.*3/, 'flux-3'],
    [/flux/, 'flux-2-pro'],
    [/recraft.*vector/, 'fal-recraft-v4-vector'],
    [/recraft/, 'fal-recraft-v4'],
    [/midjourney.*niji/, 'midjourney-niji7'],
    [/midjourney.*8\.?2/, 'midjourney-v8.2'],
    [/midjourney/, 'midjourney-v8.1'],
    [/gpt.?image.*2\.?5/, 'gpt-image-2.5-flare'],
    [/gpt.?image.*2/, 'gpt-image-2'],
    [/gpt.?image/, 'gpt-image-1'],
    [/grok/, 'grok-2-image'],
    [/happyhorse.*1\.?1/, 'happyhorse-1.1'],
    [/happyhorse/, 'happyhorse-1.0'],
    [/tapnow/, 'tapnow-image-turbo'],
  ];
  for (const [re, target] of families) {
    if (re.test(id)) {
      const hit = TABLE.find((m) => m.model === target);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * 按模型 id **模糊匹配**官方条目 ✓
 * ⚠️ 两个坑（实测踩过 ✓）：
 *   ① 必须**最长优先** ✗ —— `includes` 会让 `nano-banana-2` 抢先匹配到 `nano-banana` ✗
 *   ② 家族名要用**官方真实 id** ✓（官方表里是 `nano-banana-flash` / `tamar-google-gemini-pro` ✓
 *      不是 `gemini-banana` ✗ —— 我一开始猜错 ✗）
 * 匹配不到返回 null ✓（调用方用兜底 ✓）
 */
export function findImageModelCapability(key: ModelKey): ImageModelCapability | null {
  /* 依次尝试每个候选名 ✓（第一个命中为准 ✓）
     → 自定义连接的模型：value 匹配不到时，用上游 `modelId` / 可读 `name` 兜 ✓ */
  for (const candidate of candidateList(key)) {
    const hit = matchOne(candidate);
    if (hit) return hit;
  }
  return null;
}

/**
 * ⚠️ **已删除 compactId / upstreamModelIdOverride** ——
 * 它们的作用是「上游 id = 官方 id + 额外后缀时，把上游原文当显示名」，
 * 属于**在能力表里做名称决策**的猜测式匹配（用户 2026 点名删除）。
 * 现在：
 *   · 名字 → services/models/display（映射配置 → 官方 Registry → 原始调用 id）；
 *   · 变体（gpt-image-2-all / -pro / -async）→ src/data/modelMappings/<provider>.json 显式登记。
 */


/**
 * 「比例·画质」弹窗的**可见比例** ✓
 * 官方原文优先 ✓ · 匹配不到 → **官方出现频次最高的那套** ✓
 *   （EXE 统计：11 次为 `["16:9","9:16"]` ✓ · 8 次为 `["16:9","9:16","1:1"]` ✓
 *     5 次为 `["1:1","4:3","3:4","16:9","9:16"]` ✓）
 * ⚠️ MTV 原来**写死 10 项** ✗（`QualityRatioSelector.DEFAULT_RATIOS` ✓）
 *    → 官方是**按模型**给（7/9/11 项不等 ✓ 还可能含 "Auto" ✓）
 */
export function aspectRatiosForModel(model: ModelKey): string[] {
  const cap = findImageModelCapability(model);
  if (cap?.aspectRatios?.length) return cap.aspectRatios;
  /* 兜底：官方最常见的 7 项 ✓（EXE 频次统计 ✓）*/
  return ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'];
}

/** 弹窗的**画质档** ✓（官方原文 ✓ · 匹配不到 → ["1K","2K"] ✓ 官方最常见 ✓）
 *
 * ★★★★★ **官方函数形态（EXE 原文 ✓ 我此前只存了 "(fn)" 丢了规则 ✗）**：
 *   `imageSizeOptions: ({aspectRatio}) => aspectRatio === "auto" ? **[]** : ["1K","2K","4K"]`
 *   → **选了「自适应」(auto) 时画质档 = 空数组** ✓（GPT-Image 家族两个模型都是这个 fns ✓）
 *   → EXE 里 13 种形态：字面量 `["1K","2K"]` / `["2K","4K"]` / `["2K","3K"]` /
 *     `["512P","1K","2K","4K"]` / `["1K"]` / `["1K","2K","4K"]` + 上面这个函数 ✓
 *   所以必须**带 aspectRatio 一起算** ✓（`aspectRatio` 传 'auto' 或 '自适应' 都算 auto ✓）
 */
export function imageSizesForModel(
  model: ModelKey,
  aspectRatio?: string,
): string[] {
  const cap = findImageModelCapability(model);
  const list = readSizeOptions(cap?.imageSizeOptions ?? null, aspectRatio);
  if (list) return list;
  return ['1K', '2K'];
}

/** 该模型是否开放「透明背景」开关 ✓（官方逐模型 ✓ EXE：只有 `gpt-image-2.5-*` 是 true ✓）*/
export function transparentBackgroundForModel(model: ModelKey): boolean {
  return findImageModelCapability(model)?.transparentBackground === true;
}

/** ★★★★★ **模型卡要显示的东西** ✓✓（用户："模型选择内的模型名 + 下面几 K 都对齐官方的" ✓）
 *  官方模型卡（EXE ✓）：
 *    · 名称 = i18n `imageModels.name.*`（**中文包** ✓ 例 `Tap Nano Pro` ✓）
 *    · 下方标签 = `featureTags` ✓ 模板 `image.featureTag.resolution:"{{value}}"` → **只显示值** ✓
 *  匹配不到官方条目 → 两者都返回空 ✓（调用方保留 MTV 自己的名称/说明 ✓ 不覆盖 ✗）*/
export function officialModelDisplay(model: ModelKey): {
  displayName: string | null;
  featureTags: Array<{ label: string; value: string | null }>;
} {
  const cap = findImageModelCapability(model);
  return {
    displayName: cap?.displayName ?? null,
    featureTags: (cap?.featureTags ?? []).map((tag) => ({
      label: typeof tag.label === 'string' ? tag.label : '',
      value: tag.value ?? null,
    })),
  };
}

/** 「精细度」组的档位 —— **只认官方表 ✓ 不发明兜底** ✓
 *  官方 i18n（EXE `uBs.gpt2.qualityOptions` ✓）共 7 个键：
 *    low 低 · medium 中 · high 高 · xhigh 超高 · max 极致 · hd 2K · standard 标准
 *  每个模型**给自己的子集** ✓（官方实测：当前模型 = 低/中/高/超高/极致 5 档 ✓；
 *    GPT_IMAGE_2 = ["low","medium","high"] 3 档 ✓；`[...Ifs]` = ["low","medium","high","xhigh","max"] ✓）
 *  返回 null = 官方该模型**没有** qualityOptions → 不该显示这一组 ✓（如 flux-2-pro ✓）*/
export function qualityOptionsForModel(model: ModelKey): string[] | null {
  const cap = findImageModelCapability(model);
  const list = cap?.qualityOptions;
  return Array.isArray(list) && list.length ? list : null;
}

/**
 * 官方该模型的**默认精细度**（官方 UI 永远有一个具体选中值，不会空着）。
 *
 * 用户 2026 报的「界面显示低、实际什么都没发」：新图片卡没有 `data.quality`，
 * 选择器只是**显示**默认值 `low` ⇒ 出站请求里没有 `quality`，上游按自己的默认跑，
 * 界面上显示的档位名不副实。取值优先级：`defaultQuality` → 档位表第一项。
 * 该模型没有 `qualityOptions` 时返回 null（不发明兜底）。
 */
export function defaultQualityForModel(model: ModelKey): string | null {
  const options = qualityOptionsForModel(model);
  if (!options) return null;
  const cap = findImageModelCapability(model);
  const declared = typeof cap?.defaultQuality === 'string' ? cap.defaultQuality.trim().toLowerCase() : '';
  if (declared && options.includes(declared)) return declared;
  return options[0] ?? null;
}

/** 该模型是否有「思考等级」组 ✓（官方 `thinkingLevelOptions` ✓ EXE 里见过 ["MINIMAL","HIGH"] ✓）*/export function thinkingLevelsForModel(model: ModelKey): string[] | null {
  const cap = findImageModelCapability(model);
  const list = cap?.thinkingLevelOptions;
  return Array.isArray(list) && list.length ? list : null;
}

/** 该模型是否提供比例组（官方有的模型 `aspectRatios` 为 null ✗ → 不显示比例 ✓）*/
export function modelHasAspectRatios(model: ModelKey): boolean {
  const cap = findImageModelCapability(model);
  return !!(cap?.aspectRatios?.length);
}

/** 该模型是否提供画质组 ✓（fn 形态也算「提供」✓ 只是「自适应」时可能为空 ✓）*/
export function modelHasImageSizes(model: ModelKey): boolean {
  const cap = findImageModelCapability(model);
  return (readSizeOptions(cap?.imageSizeOptions ?? null, '1:1') ?? []).length > 0;
}

/** ★★★★★ **「自适应优先」的图片模型** ✓✓（默认档位见下 ✓）
 *
 *  只有官方 id 落在这里的两个 2.5 模型会走这条默认 ✓（用户 2026 明确："只改这两个模型" ✓）
 */
const AUTO_FIRST_IMAGE_MODELS = new Set(['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']);

/**
 * **新图片卡的默认 比例 / 尺寸** ✓✓（用户报「MTV 的图发糊」的根因修法）
 *
 * 现场实测（同模型 `gpt-image-2.5-flare` · 同提示词 · 同参考图，2026-10）：
 *   · artigine 该模型走 **Auto**（它的节点参数里只有 `presetIndex:0`，**没有 quality 字段**）
 *     ⇒ 上游自己定 ⇒ 产出 **768×1024** · PNG · 1,600,190 B（画面干净）
 *   · MTV 若强制档位 ⇒ 2K·3:4 = 1536×2048（~5 MB）· 4K·3:4 = 2480×3312（~13 MB）
 *   · 逐张量「每像素高频能量」（相邻像素亮度差均值 `grad/px` + 拉普拉斯标准差）：
 *       1K ≈ 6.3–9.8 · 2K ≈ 4.7–7.2 · 4K ≈ 3.4–6.3（单调下降）
 *     ⇒ 像素翻 4/16 倍而**每像素真实细节反而变少** = 上游按 ~1K 原生渲染后再放大 ⇒ 涂抹/发糊
 *
 * 所以这两个模型的新卡默认 **「自适应」+ 1K**：
 *   自适应时官方 fn 形态 `imageSizeOptions({aspectRatio:"auto"}) = []`
 *   ⇒ 出站 `size` 直接是 `"auto"`（见 `services/ai/officialImageSizes.ts` 的 `officialImageSize`）
 *   ⇒ 上游自己挑原生尺寸，与官方/artigine 行为一致 ✓
 *
 * 其余模型**保持旧默认**（16:9 + 2K）✓ 不动 ✓
 */
export function imageNodeDefaultParams(model: ModelKey): {
  aspectRatio: string;
  imageSize: string;
} {
  const cap = findImageModelCapability(model);
  const matched = cap ? AUTO_FIRST_IMAGE_MODELS.has(cap.model) : false;
  /* 兜底：自定义连接里 `model` 的值可能不是官方 id（形如 `general/provider-custom-<hash>`），
     但字符串本身常带上游真名（如 `gpt-image-2.5-flare-async` / `gpt-image-2.5-sunburst-high`）✓ */
  const byName = candidateList(model).some((k) => /gpt[\s_-]?image[\s_-]?2[.\s_-]?5/i.test(k));
  if (matched || byName) return { aspectRatio: '自适应', imageSize: '1K' };
  return { aspectRatio: '16:9', imageSize: '2K' };
}

export { TABLE as OFFICIAL_IMAGE_MODEL_TABLE };
