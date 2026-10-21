/**
 * apimart 映射表 = 官方定价页清单的**重建**结果（用户 2026-10-15 裁决）。
 *
 * 官方来源（只读快照 `D:\DEEPSEEK\apimart-models.json`）：
 *   `https://apimart.ai/en/pricing` 的 React Server Component payload，
 *   `extracted_at 2026-10-15T07:06:29Z`，`model_count 47`（image 43 + token 4）。
 * ⚠️ 官方 47 条 id/name **内联**在本文件（仓库测试不依赖仓外临时产物），
 *   同时让「官方 name 逐字」成为可回归的契约。
 *
 * 钉住：
 *   ① canonicalId 形状 + **零悬空引用**（跨全部映射表）+ canonical 行不带 override + 不发明字段；
 *   ② 官方 47 个 id 全部在表里、官方 name 逐字记录；
 *   ③ 官方清单里没有的 MTV 39 条仍在、全部 `unverified`；其中**依据成立**的 11 条保留 canonicalId；
 *   ④ `providerModelId` 无重复（含归一化后重复）；
 *   ⑤ 品牌化命名白名单（2026-10-15 裁决保留的 2 条 tapnow）；
 *   ⑥ 官方名去品牌化 + 新增 canonical 条目的落地结果。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { allCanonicalModels, isValidCanonicalId } from '../../src/services/models/canonical';

interface MappingRow {
  providerId: string;
  providerModelId: string;
  providerModelName?: string;
  canonicalId?: string;
  displayNameOverride?: string;
  executionMode?: string;
  matchStatus: string;
  specification?: string;
  unit?: string;
  prices?: unknown;
  source?: string;
  updatedAt: string;
}

const REPO = new URL('../../', import.meta.url);
const MAPPING_DIR = new URL('src/data/modelMappings/', REPO);

const FILE = JSON.parse(readFileSync(new URL('apimart.json', MAPPING_DIR), 'utf8')) as {
  providerId: string; _readme: string[]; mappings: MappingRow[];
};
const CANON_RAW = JSON.parse(readFileSync(new URL('src/data/modelCanonical.json', REPO), 'utf8')) as {
  canonicalModels: Array<{ canonicalId: string; officialName: string; officialModelIds?: string[]; source?: string }>;
};

/** 官方 `id` + 官方 `name` **逐字**（大小写、连字符一律照抄，不做美化）。 */
const OFFICIAL: ReadonlyArray<readonly [id: string, name: string, specification: string]> = [
  ['dall-e-3', 'DALL-E 3', 'image'],
  ['midjourney', 'Midjourney', 'image'],
  ['gemini-2.5-flash-image-preview', 'Nano Banana', 'image'],
  ['gemini-3.1-flash-image-preview', 'Nano Banana 2', 'image'],
  ['gemini-nano-banana-2.1', 'Nano Banana 2.1', 'image'],
  ['gemini-3-pro-image-preview', 'Nano Banana Pro', 'image'],
  ['gemini-3.1-flash-lite-image', 'Nano-Banana-2-Lite', 'image'],
  ['flux-2-flex', 'flux-2-flex', 'image'],
  ['flux-2-max', 'flux-2-max', 'image'],
  ['flux-2-pro', 'flux-2-pro', 'image'],
  ['flux-3-image', 'flux-3-image', 'token'],
  ['flux-kontext-max', 'flux-kontext-max', 'image'],
  ['flux-kontext-pro', 'flux-kontext-pro', 'image'],
  ['gemini-2.5-flash-image-preview-official', 'gemini-2.5-flash-image-preview-official', 'image'],
  ['gemini-3-pro-image-preview-official', 'gemini-3-pro-image-preview-official', 'image'],
  ['gemini-3.1-flash-image-preview-official', 'gemini-3.1-flash-image-preview-official', 'image'],
  ['gemini-3.1-flash-lite-image-ext', 'gemini-3.1-flash-lite-image-ext', 'image'],
  ['gemini-nano-banana-2.1-ext', 'gemini-nano-banana-2.1-ext', 'image'],
  ['gpt-image-1', 'gpt-image-1', 'token'],
  ['gpt-image-1-official', 'gpt-image-1-official', 'image'],
  ['gpt-image-1.5-official', 'gpt-image-1.5-official', 'image'],
  ['gpt-image-2', 'gpt-image-2', 'image'],
  ['gpt-image-2-official', 'gpt-image-2-official', 'image'],
  ['gpt-image-2.5-ext', 'gpt-image-2.5-ext', 'image'],
  ['gpt-image-2.5-flare', 'gpt-image-2.5-flare', 'image'],
  ['gpt-image-2.5-sunburst', 'gpt-image-2.5-sunburst', 'image'],
  ['grok-imagine-1.5-apimart', 'grok-imagine-1.5-apimart', 'image'],
  /* 官方这条 name 是 UTF-8 被按 Latin-1 解码的产物 ⇒ 照抄不修 */
  ['grok-imagine-1.5-edit-apimart', 'grok-imagine-1.5-ext\u00ef\u00bc\u0088grok-imagine-1.5-apimart\u00ef\u00bc\u0089', 'image'],
  ['grok-imagine-2.0-ext', 'grok-imagine-2.0-ext', 'image'],
  ['grok-imagine-image', 'grok-imagine-image', 'image'],
  ['grok-imagine-image-2.0', 'grok-imagine-image-2.0', 'image'],
  ['grok-imagine-image-quality', 'grok-imagine-image-quality', 'image'],
  ['imagen-4.0-apimart', 'imagen-4.0-apimart', 'image'],
  ['mai-image-2.6', 'mai-image-2.6', 'token'],
  ['mai-image-2.6-flash', 'mai-image-2.6-flash', 'token'],
  ['qwen-image-2.0', 'qwen-image-2.0', 'image'],
  ['qwen-image-2.0-pro', 'qwen-image-2.0-pro', 'image'],
  ['qwen-image-3.0', 'qwen-image-3.0', 'image'],
  ['qwen-image-3.0-pro', 'qwen-image-3.0-pro', 'image'],
  ['seedream-4-0', 'seedream-4-0', 'image'],
  ['seedream-4-5', 'seedream-4-5', 'image'],
  ['seedream-5-0-flash', 'seedream-5-0-flash', 'image'],
  ['seedream-5-0-lite', 'seedream-5-0-lite', 'image'],
  ['seedream-5-0-pro', 'seedream-5-0-pro', 'image'],
  ['wan2.7-image', 'wan2.7-image', 'image'],
  ['wan2.7-image-pro', 'wan2.7-image-pro', 'image'],
  ['z-image-turbo', 'z-image-turbo', 'image'],
];

/** MTV 有、官方 apimart 清单**没有**的 39 条 —— 只登记，全部 `unverified`。 */
const MTV_ONLY: readonly string[] = [
  'claude-opus-4-7', 'claude-sonnet-4-6', 'deepseek-v4-pro',
  'doubao-seedance-1-0-pro-fast', 'doubao-seedance-1-0-pro-quality', 'doubao-seedance-1-5-pro',
  'doubao-seedance-2.0', 'doubao-seedance-2.0-fast', 'doubao-seedance-2.0-mini', 'doubao-seedance-2.5',
  'doubao-seedream-4.0', 'doubao-seedream-4.5', 'doubao-seedream-5.0-lite',
  'flowmusic', 'gemini-3.1-pro-preview', 'gemini-3.5-flash',
  'gemini-omni-1.1-flash', 'gemini-omni-1.1-flash-ext', 'gemini-omni-flash-preview',
  'glm-5.1', 'gpt-4o', 'gpt-4o-mini-tts', 'gpt-5', 'gpt-5.2', 'gpt-5.4',
  'grok-imagine-1.0-apimart', 'kimi-k2-instruct', 'kimi-k2.5', 'kling-v3',
  'MiniMax-H3', 'MiniMax-H3-Context-IR', 'MiniMax-H3-Regeneration', 'MiniMax-Hailuo-2.3',
  'minimax-m2.5', 'skyreels-v4-std', 'sora-2', 'veo3.1-quality', 'viduq3-pro', 'wan2.7',
];

/**
 * 裁决 ①：这 11 条的 canonicalId **依据成立**（providerModelId 与 canonical `officialModelIds` 逐字相等）
 * ⇒ 保留绑定并标 unverified。`gemini-omni-1.1-flash` 是依据成立后**新增**的一条（原报告只列了 10 条）。
 */
const RESTORED: ReadonlyArray<readonly [id: string, canonicalId: string]> = [
  ['claude-opus-4-7', 'anthropic/claude-opus-4-7'],
  ['claude-sonnet-4-6', 'anthropic/claude-sonnet-4-6'],
  ['deepseek-v4-pro', 'deepseek/deepseek-v4-pro'],
  ['doubao-seedream-4.0', 'bytedance/seedream-4-0'],
  ['doubao-seedream-4.5', 'bytedance/seedream-4-5'],
  ['doubao-seedream-5.0-lite', 'bytedance/seedream-5-0-lite'],
  ['gemini-3.5-flash', 'google/gemini-3-5-flash'],
  ['gemini-omni-1.1-flash', 'google/gemini-omni-1-1-flash'],
  ['MiniMax-H3', 'minimax/minimax-h3'],
  ['MiniMax-Hailuo-2.3', 'minimax/hailuo-2-3'],
  ['viduq3-pro', 'vidu/vidu-q3'],
];

/** 裁决 ③-C：3 条 officialName 去品牌化（canonicalId 不变）。 */
const RENAMED: ReadonlyArray<readonly [canonicalId: string, officialName: string]> = [
  ['google/banana', 'Nano Banana'],
  ['google/banana-2', 'Nano Banana 2'],
  ['google/banana-pro', 'Nano Banana Pro'],
];

/** 裁决 ③-D：新增的 21 条 canonical（vendor 取真实厂商，`source` 带 apimart 出处）。 */
const ADDED_CANONICAL: ReadonlyArray<readonly [canonicalId: string, apimartId: string]> = [
  /* 2026-10-15 本轮新增的 37 条（其中 `google/nano-banana-2-1` 已存在于 Registry，用 `PRE_EXISTING_37` 标出） */
  ['bfl/flux-3-video', 'flux-3-video'],
  ['alibaba/wan-3-0-prime', 'wan-3-0-prime'],
  ['google/omni-flash-ext', 'omni-flash-ext'],
  ['google/gemini-omni-flash-preview', 'gemini-omni-flash-preview'],
  ['pixverse/pixverse-v6', 'pixverse-v6'],
  ['kuaishou/kling-3-0-turbo', 'kling-3-0-turbo'],
  ['kuaishou/kling-v2-6-motion-control', 'kling-v2-6-motion-control'],
  ['kuaishou/kling-v3-motion-control', 'kling-v3-motion-control'],
  ['minimax/minimax-hailuo-02', 'minimax-hailuo-02'],
  ['vidu/viduq3-turbo', 'viduq3-turbo'],
  ['vidu/viduq3-mix', 'viduq3-mix'],
  ['vidu/vidu-q4', 'vidu-q4'],
  ['alibaba/wan-2-6-i2v', 'wan-2-6-i2v'],
  ['alibaba/wan-2-6-i2v-flash', 'wan-2-6-i2v-flash'],
  ['alibaba/wan-2-7', 'wan-2-7'],
  ['alibaba/wan-2-7-r2v', 'wan-2-7-r2v'],
  ['alibaba/wan-2-7-videoedit', 'wan-2-7-videoedit'],
  ['xai/grok-video', 'grok-video'],
  ['skywork/skyreels-v4', 'skyreels-v4'],
  ['skywork/skyreels-v4-fast', 'skyreels-v4-fast'],
  ['bytedance/doubao-seedance-1-0-pro', 'doubao-seedance-1-0-pro'],
  ['bytedance/doubao-seedance-1-0-pro-fast', 'doubao-seedance-1-0-pro-fast'],
  ['openai/gpt-image-1-5', 'gpt-image-1-5'],
  ['openai/gpt-image-2-5', 'gpt-image-2-5'],
  ['xai/grok-image', 'grok-image'],
  ['xai/grok-imagine-1-5-ext', 'grok-imagine-1-5-ext'],
  ['xai/grok-imagine-2-0', 'grok-imagine-2-0'],
  ['bfl/flux-2', 'flux-2'],
  ['bfl/flux-kontext', 'flux-kontext'],
  ['alibaba/qwen-image-2-0-pro', 'qwen-image-2-0-pro'],
  ['alibaba/z-image-turbo', 'z-image-turbo'],
  ['alibaba/wan-2-7-image-pro', 'wan-2-7-image-pro'],
  ['midjourney/midjourney', 'midjourney'],
  ['google/nano-banana-2-1', 'gemini-nano-banana-2.1'],
  ['suno/suno', 'suno'],
  ['kuaishou/kling-4-0', 'kling-4-0'],
  ['kuaishou/kling-4-0-flash', 'kling-4-0-flash'],
  /* 上一轮（2026-10-15 apimart 官方清单重建）新增的 21 条 */
  ['openai/dall-e-3', 'dall-e-3'],
  ['google/nano-banana-2-1', 'gemini-nano-banana-2.1'],
  ['bfl/flux-2-flex', 'flux-2-flex'],
  ['bfl/flux-2-max', 'flux-2-max'],
  ['bfl/flux-3-image', 'flux-3-image'],
  ['google/gemini-3-pro-image-preview-official', 'gemini-3-pro-image-preview-official'],
  ['google/gemini-3-1-flash-lite-image-ext', 'gemini-3.1-flash-lite-image-ext'],
  ['google/gemini-nano-banana-2-1-ext', 'gemini-nano-banana-2.1-ext'],
  ['openai/gpt-image-1-official', 'gpt-image-1-official'],
  ['openai/gpt-image-1-5-official', 'gpt-image-1.5-official'],
  ['openai/gpt-image-2-official', 'gpt-image-2-official'],
  ['openai/gpt-image-2-5-ext', 'gpt-image-2.5-ext'],
  ['xai/grok-imagine-1-5-apimart', 'grok-imagine-1.5-apimart'],
  ['xai/grok-imagine-1-5-edit-apimart', 'grok-imagine-1.5-edit-apimart'],
  ['xai/grok-imagine-2-0-ext', 'grok-imagine-2.0-ext'],
  ['xai/grok-imagine-image-2-0', 'grok-imagine-image-2.0'],
  ['alibaba/qwen-image-2-0', 'qwen-image-2.0'],
  ['alibaba/qwen-image-3-0', 'qwen-image-3.0'],
  ['alibaba/qwen-image-3-0-pro', 'qwen-image-3.0-pro'],
  ['bytedance/seedream-5-0-flash', 'seedream-5-0-flash'],
  ['alibaba/wan-2-7-image', 'wan2.7-image'],
  /* vendor = Microsoft 由用户 2026-10-15 提供截图取证（非本变体自己的页面）⇒ 见下方来源层级断言 */
  ['microsoft/mai-image-2-6', 'mai-image-2.6'],
  ['microsoft/mai-image-2-6-flash', 'mai-image-2.6-flash'],
];

/**
 * 本轮（2026-10-15 模型身份补全）新登记的 37 个 apimart 模型展示名 → canonicalId。
 * 其中 `google/nano-banana-2-1` **在本轮之前就已在 Registry**（本轮只补 vendor 分层出处，不重复新增）。
 */
const ROUND128_CANONICAL: ReadonlyArray<readonly [apimartId: string, canonicalId: string, vendorLayer: 'brand' | 'icon' | 'sibling']> = [
  ['flux-3-video', 'bfl/flux-3-video', 'brand'],
  ['wan-3-0-prime', 'alibaba/wan-3-0-prime', 'brand'],
  ['omni-flash-ext', 'google/omni-flash-ext', 'brand'],
  ['gemini-omni-flash-preview', 'google/gemini-omni-flash-preview', 'brand'],
  ['pixverse-v6', 'pixverse/pixverse-v6', 'brand'],
  ['kling-3-0-turbo', 'kuaishou/kling-3-0-turbo', 'brand'],
  ['kling-v2-6-motion-control', 'kuaishou/kling-v2-6-motion-control', 'brand'],
  ['kling-v3-motion-control', 'kuaishou/kling-v3-motion-control', 'brand'],
  ['minimax-hailuo-02', 'minimax/minimax-hailuo-02', 'brand'],
  ['viduq3-turbo', 'vidu/viduq3-turbo', 'brand'],
  ['viduq3-mix', 'vidu/viduq3-mix', 'brand'],
  ['vidu-q4', 'vidu/vidu-q4', 'brand'],
  ['wan-2-6-i2v', 'alibaba/wan-2-6-i2v', 'brand'],
  ['wan-2-6-i2v-flash', 'alibaba/wan-2-6-i2v-flash', 'brand'],
  ['wan-2-7', 'alibaba/wan-2-7', 'brand'],
  ['wan-2-7-r2v', 'alibaba/wan-2-7-r2v', 'brand'],
  ['wan-2-7-videoedit', 'alibaba/wan-2-7-videoedit', 'brand'],
  ['grok-video', 'xai/grok-video', 'brand'],
  ['skyreels-v4', 'skywork/skyreels-v4', 'brand'],
  ['skyreels-v4-fast', 'skywork/skyreels-v4-fast', 'brand'],
  ['doubao-seedance-1-0-pro', 'bytedance/doubao-seedance-1-0-pro', 'brand'],
  ['doubao-seedance-1-0-pro-fast', 'bytedance/doubao-seedance-1-0-pro-fast', 'brand'],
  ['gpt-image-1-5', 'openai/gpt-image-1-5', 'icon'],
  ['gpt-image-2-5', 'openai/gpt-image-2-5', 'icon'],
  /* 该 3 条身份在官方定价页清单里没有对应行（apimart 的定价 id 是 `grok-imagine-1.5-apimart` 等另一种写法） */
  ['grok-image', 'xai/grok-image', 'brand'],
  ['grok-imagine-1-5-ext', 'xai/grok-imagine-1-5-ext', 'brand'],
  ['grok-imagine-2-0', 'xai/grok-imagine-2-0', 'brand'],
  ['flux-2', 'bfl/flux-2', 'brand'],
  ['flux-kontext', 'bfl/flux-kontext', 'brand'],
  ['qwen-image-2-0-pro', 'alibaba/qwen-image-2-0-pro', 'brand'],
  ['z-image-turbo', 'alibaba/z-image-turbo', 'brand'],
  ['wan-2-7-image-pro', 'alibaba/wan-2-7-image-pro', 'brand'],
  ['midjourney', 'midjourney/midjourney', 'brand'],
  /* 本页无 brand/icon ⇒ vendor 由**同族页** brand 补齐（不许写成直接证据） */
  ['nano-banana-2-1', 'google/nano-banana-2-1', 'sibling'],
  ['suno', 'suno/suno', 'brand'],
  ['kling-4-0', 'kuaishou/kling-4-0', 'icon'],
  ['kling-4-0-flash', 'kuaishou/kling-4-0-flash', 'icon'],
];

/**
 * 本轮身份里 providerModelId 与 apimart 定价 id **不同写法**、故不构成「新绑定行」的 5 条（身份照登记）。
 */
const IDS_WITHOUT_APIMART_ROW: readonly string[] = [
  'grok-image', 'grok-imagine-1-5-ext', 'grok-imagine-2-0', 'gpt-image-1-5', 'gpt-image-2-5',
];

/**
 * 身份已登记、但对应 apimart 行**故意不绑**（登记为待办）：
 * `gemini-omni-flash-preview` —— 该行在官方定价清单里，按既有契约「不在清单 ⇒ 不带 canonicalId」保持未绑。
 */
const IDENTITY_ROW_LEFT_UNBOUND: readonly string[] = ['gemini-omni-flash-preview'];

/**
 * 身份已登记、apimart 行存在同名 providerModelId、但绑定**依据不是逐字相等**（定价 id 用 `.` 分隔）：
 * `doubao-seedance-1.0-pro` / `doubao-seedance-1.0-pro-fast`。本轮按用户指令未改绑，登记为待办。
 */
const NON_VERBATIM_ROW_LEFT_UNBOUND: readonly string[] = ['doubao-seedance-1-0-pro-quality', 'doubao-seedance-1-0-pro-fast'];

/**
 * 本轮**登记**的厂商名冲突（只报告、不统一、不改任何一边）：
 * 新增的 3 个 `xai/grok-*` canonical 的 `officialName` 与既有 `xai/grok-imagine-*` 归一后相同。
 * 既有平台（apimart 定价行 / `xai.json`）的绑定按原样保留；本轮不做合并、不改绑、不改名。
 */
const NAME_CONFLICT: ReadonlyArray<
  readonly [providerModelId: string, keptCanonicalId: string, newCanonicalId: string, conflictKey: string, normExpected: string]
> = [
  ['grok-imagine-image', 'xai/grok-imagine', 'xai/grok-image', 'grok-imagine-image', 'grokimagineimage'],
  ['grok-imagine-video', 'xai/grok-imagine', 'xai/grok-video', 'grok-imagine-video', 'grokimaginevideo'],
  ['grok-imagine-1.5-apimart', 'xai/grok-imagine-1-5-apimart', 'xai/grok-imagine-1-5-ext', 'grok-imagine-1.5-ext', 'grokimagine15ext'],
];

/** 因上面的厂商名冲突而豁免「name 优先」检查的 providerModelId。 */
const NAME_CONFLICT_PROVIDER_IDS = new Set(NAME_CONFLICT.map(([id]) => id));

/** 本轮身份里命中官方定价页清单的 apimart 行（绑定后必须 verified）。 */
const PRICING_ROWS_BOUND_THIS_ROUND: readonly string[] = ['midjourney', 'qwen-image-2.0-pro', 'wan2.7-image-pro', 'z-image-turbo'];

/**
 * 本轮显式登记的「依据分层」绑定：官方 id 与 canonical `officialModelIds` **不逐字相等**
 * （点 vs 连字符），按用户本轮指令绑定，**不属于** `_readme` 的「① id 命中 / ② name 命中」。
 */
const NON_VERBATIM_BINDING: readonly string[] = ['qwen-image-2.0-pro', 'wan2.7-image-pro'];

const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** 品牌化模式。裁决 ③-A：这 2 条**已裁决保留**，是唯一白名单例外。 */
const BRANDED = /tap\s*now|tap[-\s]?nano/i;
const BRAND_WHITELIST = new Set(['tapnow/tapnow-flash', 'tapnow/world-edit']);

const KNOWN = new Set(allCanonicalModels().map((c) => c.canonicalId));
const byId = new Map(FILE.mappings.map((m) => [m.providerModelId, m]));
const norm = (s: string) => s.trim().toLowerCase().replace(/[._\-\s/]+/g, '');
const canonById = new Map(CANON_RAW.canonicalModels.map((c) => [c.canonicalId, c]));
const OFFICIAL_IDS = new Set(OFFICIAL.map(([id]) => id));

/** 官方清单里的非空 alias（`$undefined` 已剔除）—— 防交叉绑定测试要用。 */
const ALIASES = new Map<string, string>([
  ['gemini-2.5-flash-image-preview', 'nano-banana-ext'],
  ['gemini-3.1-flash-image-preview', 'nano-banana-2-ext'],
  ['gemini-3-pro-image-preview', 'nano-banana-pro-ext'],
  ['gemini-2.5-flash-image-preview-official', 'nano-banana'],
  ['gemini-3-pro-image-preview-official', 'nano-banana-pro'],
  ['gemini-3.1-flash-image-preview-official', 'nano-banana-2'],
  ['gemini-3.1-flash-lite-image', 'nano-banana-2-lite'],
  ['gemini-3.1-flash-lite-image-ext', 'nano-banana-2-lite-ext'],
  ['gpt-image-2', 'gpt-image-2-ext'],
  ['grok-imagine-1.5-apimart', 'grok-imagine-1.5-ext'],
  ['grok-imagine-1.5-edit-apimart', 'grok-imagine-1.5-edit-ext'],
]);

function allMappingFiles(): Array<[string, MappingRow[]]> {
  return readdirSync(MAPPING_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const parsed = JSON.parse(readFileSync(new URL(f, MAPPING_DIR), 'utf8')) as { mappings?: MappingRow[] };
      return [f, parsed.mappings ?? []] as [string, MappingRow[]];
    });
}

describe('① canonicalId：形状 / 零悬空引用 / 不发明字段', () => {
  it('apimart 每条非空 canonicalId 满足 services/models/canonical.ts 的形状正则', () => {
    for (const m of FILE.mappings) {
      if (!m.canonicalId) continue;
      expect(isValidCanonicalId(m.canonicalId), `apimart/${m.providerModelId}`).toBe(true);
      expect(m.canonicalId, `apimart/${m.providerModelId}`).toMatch(SHAPE);
    }
  });

  it('★ 零悬空引用：**全部**映射表的每个非空 canonicalId 都能在 Registry 里查到', () => {
    let bound = 0;
    for (const [file, rows] of allMappingFiles()) {
      for (const m of rows) {
        if (!m.canonicalId) continue;
        bound += 1;
        expect(KNOWN.has(m.canonicalId), `${file}: ${m.providerModelId} → ${m.canonicalId} 悬空`).toBe(true);
      }
    }
    expect(bound).toBeGreaterThan(40);
  });

  it('不发明字段：apimart.json 里不出现 schema 外的 `displayName` 键', () => {
    const raw = readFileSync(new URL('apimart.json', MAPPING_DIR), 'utf8');
    expect(raw).not.toContain('"displayName":');
    for (const m of FILE.mappings) expect(Object.keys(m)).not.toContain('displayName');
  });

  it('canonical 行一律不带 displayNameOverride（既有契约：展示名由 canonical 收口）', () => {
    for (const [file, rows] of allMappingFiles()) {
      for (const m of rows) {
        if (m.canonicalId) expect(m.displayNameOverride, `${file}: ${m.providerModelId}`).toBeUndefined();
      }
    }
  });
});

describe('② 官方 47 条：齐备 + 官方 name 逐字', () => {
  it('官方 47 个 id 全部命中（providerModelId 原样），且没有第 48 个官方行', () => {
    for (const [id] of OFFICIAL) expect(byId.has(id), `缺官方 id ${id}`).toBe(true);
    for (const m of FILE.mappings) {
      if (OFFICIAL_IDS.has(m.providerModelId)) continue;
      expect(MTV_ONLY, `多出来的 ${m.providerModelId}`).toContain(m.providerModelId);
    }
  });

  it('官方 name **逐字**落在 providerModelName（与 id 不同时）或 source 里，一字不改', () => {
    for (const [id, name] of OFFICIAL) {
      const row = byId.get(id)!;
      if (row.providerModelName !== undefined) expect(row.providerModelName, `apimart/${id}`).toBe(name);
      expect(row.source, `apimart/${id} 的 source 必须含官方 name 逐字`).toContain(name);
    }
  });

  it('官方大小写/连字符样张：Nano Banana 2.1 与 Nano-Banana-2-Lite 照抄', () => {
    expect(byId.get('gemini-nano-banana-2.1')!.providerModelName).toBe('Nano Banana 2.1');
    expect(byId.get('gemini-3.1-flash-lite-image')!.providerModelName).toBe('Nano-Banana-2-Lite');
    expect(canonById.get('google/nano-banana-2-1')!.officialName).toBe('Nano Banana 2.1');
    for (const m of FILE.mappings) {
      expect(m.providerModelName ?? '', m.providerModelId).not.toMatch(/Tap\s*Now|Tap\s*Nano/i);
    }
  });

  it('官方给出的 specification / unit / prices 逐字带上', () => {
    for (const [id, , specification] of OFFICIAL) {
      const row = byId.get(id)!;
      expect(row.specification, `apimart/${id}`).toBe(specification);
      expect(typeof row.unit, `apimart/${id}`).toBe('string');
      expect(row.prices, `apimart/${id}`).toBeTruthy();
    }
  });

  it('官方 47 + MTV 39 = 86 条', () => {
    expect(FILE.mappings.length).toBe(OFFICIAL.length + MTV_ONLY.length);
    expect(FILE.mappings.length).toBe(86);
  });
});

describe('③ MTV 自造的 39 条：仍在、全部 unverified、依据成立的保留 canonicalId', () => {
  it('39 条全部仍在表里', () => {
    for (const id of MTV_ONLY) expect(byId.has(id), `丢失登记行 ${id}`).toBe(true);
  });

  it('全部 matchStatus = unverified（unverified 只表示「不在官方清单」，不代表没有身份）', () => {
    for (const id of MTV_ONLY) expect(byId.get(id)!.matchStatus, id).toBe('unverified');
  });

  it('★ 裁决①：依据成立的 11 条保留 canonicalId，依据 = officialModelIds 逐字相等', () => {
    for (const [id, canonicalId] of RESTORED) {
      const row = byId.get(id)!;
      expect(row.canonicalId, id).toBe(canonicalId);
      expect(canonById.get(canonicalId)!.officialModelIds, `${canonicalId}.officialModelIds`).toContain(id);
      expect(row.source, id).toContain('① 不在官方 apimart 清单');
      expect(row.source, id).toContain('② canonicalId 依据');
    }
  });

  it('其余 28 条不得有 canonicalId（依据不成立 ⇒ 零猜测不绑，显示原始 id）', () => {
    const restored = new Set(RESTORED.map(([id]) => id));
    for (const id of MTV_ONLY) {
      if (restored.has(id)) continue;
      const row = byId.get(id)!;
      expect(row.canonicalId, id).toBeUndefined();
      expect(row.providerModelName, id).toBeUndefined();
      expect(row.displayNameOverride, id).toBeUndefined();
      expect(row.source, id).toContain('中不存在 ⇒ 登记为未核实');
    }
  });

  it('source 一律带官方出处 URL + extracted_at；不再有半成品措辞', () => {
    for (const m of FILE.mappings) {
      expect(m.source ?? '', m.providerModelId).toContain('https://apimart.ai/en/pricing');
      expect(m.source ?? '', m.providerModelId).toContain('2026-10-15T07:06:29Z');
      expect(m.source ?? '', m.providerModelId).not.toContain('待人工确认');
      expect(m.source ?? '', m.providerModelId).not.toContain('未与官方表核对');
      /* 已绑定的行不许再说自己「不绑定」（`\u` 转义那行曾因此漏改，2026-10-15 修） */
      if (m.canonicalId) {
        expect(m.source ?? '', m.providerModelId).not.toContain('不绑定 canonicalId');
        expect(m.source ?? '', m.providerModelId).not.toContain('无对应 canonical 条目');
      }
    }
  });

  it('★ 价格是**来源标注**（不是价值判断）：官方行写明「价格来源：apimart 厂商定价页」，无被撤回的措辞', () => {
    for (const [id] of OFFICIAL) {
      const src = byId.get(id)!.source ?? '';
      expect(src, id).toContain('价格来源：apimart 厂商定价页');
      expect(src, id).not.toContain('非计费依据');
      expect(src, id).not.toContain('计费以土豆');
    }
    /* 登记行没有 prices/unit 字段 ⇒ 不该带价格来源标注 */
    for (const id of MTV_ONLY) expect(byId.get(id)!.source ?? '', id).not.toContain('价格来源：');
  });

  it('★ _readme 写明「厂商与价格两层结构」+ 接入现状（当前仅接入土豆）', () => {
    const readme = FILE._readme.join('\n');
    expect(readme).toContain('两层结构');
    expect(readme).toContain('以 **apimart 清单**为准');
    expect(readme).toContain('跨厂商的公共身份');
    expect(readme).toContain('逐厂商各自持有、互不覆盖');
    expect(readme).toContain('只接入了土豆');
    /* 不得留价值判断式措辞 */
    expect(readme).not.toContain('非计费依据');
  });
});

describe('④ providerModelId 唯一', () => {
  it('无精确重复，且无归一化后重复', () => {
    const ids = FILE.mappings.map((m) => m.providerModelId);
    expect(new Set(ids).size).toBe(ids.length);
    const seen = new Map<string, string>();
    for (const m of FILE.mappings) {
      const key = norm(m.providerModelId);
      expect(seen.has(key), `${m.providerModelId} 与 ${seen.get(key)} 归一化后重复`).toBe(false);
      seen.set(key, m.providerModelId);
    }
  });

  it('providerId 一律 apimart，与文件 providerId 一致', () => {
    expect(FILE.providerId).toBe('apimart');
    for (const m of FILE.mappings) expect(m.providerId).toBe('apimart');
  });
});

describe('⑤ 品牌化命名白名单（2026-10-15 裁决）', () => {
  it('canonicalId / officialName 不得命中品牌化模式，白名单只有已裁决保留的 2 条', () => {
    const hits = CANON_RAW.canonicalModels
      .filter((c) => BRANDED.test(c.canonicalId) || BRANDED.test(c.officialName))
      .map((c) => c.canonicalId);
    expect(new Set(hits)).toEqual(BRAND_WHITELIST);
  });

  it('白名单两条的理由写在 source 里（疑似 TapNow 造名、真实厂商未取证）', () => {
    for (const id of BRAND_WHITELIST) {
      expect(canonById.get(id)!.source, id).toContain('真实厂商未取证');
    }
  });

  it('Registry 里不存在 TapNow 品牌化的官方名（`TapNow O-*` / `Tap Nano *`），白名单除外', () => {
    for (const c of CANON_RAW.canonicalModels) {
      if (BRAND_WHITELIST.has(c.canonicalId)) continue;
      expect(c.officialName, c.canonicalId).not.toMatch(/^TapNow\s+[OF]|Tap\s+Nano/i);
    }
  });
});

describe('⑥ 去品牌化改名 + 新增 canonical 条目的落地', () => {
  it('3 条 officialName 已改为 apimart 官方 name 逐字，canonicalId 不变', () => {
    for (const [canonicalId, officialName] of RENAMED) {
      const canon = canonById.get(canonicalId)!;
      expect(canon.officialName, canonicalId).toBe(officialName);
      expect(canon.source, canonicalId).toContain('品牌化');
    }
  });

  it('3 条 Nano Banana 重叠行已按 officialName 逐字命中绑定', () => {
    expect(byId.get('gemini-2.5-flash-image-preview')!.canonicalId).toBe('google/banana');
    expect(byId.get('gemini-3.1-flash-image-preview')!.canonicalId).toBe('google/banana-2');
    expect(byId.get('gemini-3-pro-image-preview')!.canonicalId).toBe('google/banana-pro');
  });

  it('新增的 canonical（上一轮 21 条 + 本轮 37 条）存在、officialModelIds 指向 apimart 官方 id、source 带出处', () => {
    for (const [canonicalId, apimartId] of ADDED_CANONICAL) {
      const canon = canonById.get(canonicalId);
      expect(canon, `缺 canonical ${canonicalId}`).toBeTruthy();
      expect(isValidCanonicalId(canonicalId)).toBe(true);
      expect(canon!.officialModelIds, canonicalId).toContain(apimartId);
      expect(canon!.source, canonicalId).toContain('https://apimart.ai/en/pricing');
      expect(canon!.source, canonicalId).toContain('2026-10-15T07:06:29Z');
      expect(canonicalId.startsWith('tapnow/'), canonicalId).toBe(false);
      /* apimart 定价清单里没有该 id（视频类 / 详情页命名与定价 id 不同）⇒ 身份在 Registry 里就够 */
      const row = byId.get(apimartId);
      if (
        !row ||
        NAME_CONFLICT_PROVIDER_IDS.has(row.providerModelId) ||
        IDENTITY_ROW_LEFT_UNBOUND.includes(apimartId) ||
        NON_VERBATIM_ROW_LEFT_UNBOUND.includes(apimartId)
      ) continue;
      expect(row.canonicalId, apimartId).toBe(canonicalId);
      expect(row.matchStatus, apimartId).toBe(OFFICIAL_IDS.has(apimartId) ? 'verified' : 'unverified');
    }
  });

  it('★ 本轮 37 条身份的 vendor 分层出处落在 canonical.source（与同厂商行的 brand 一致）', () => {
    for (const [apimartId, canonicalId, layer] of ROUND128_CANONICAL) {
      const canon = canonById.get(canonicalId);
      expect(canon, `缺 canonical ${canonicalId}`).toBeTruthy();
      const src = canon!.source ?? '';
      const row = byId.get(apimartId);
      /* 定价 id 与详情页 id 不同写法、既有绑定归属不同、或已登记为待办的 → 绑定关系见对应登记 */
      const skipBindingCheck =
        !row ||
        NAME_CONFLICT_PROVIDER_IDS.has(row.providerModelId) ||
        IDENTITY_ROW_LEFT_UNBOUND.includes(apimartId) ||
        NON_VERBATIM_ROW_LEFT_UNBOUND.includes(apimartId);
      if (!skipBindingCheck) {
        expect(row!.canonicalId, apimartId).toBe(canonicalId);
        expect(row!.displayNameOverride, apimartId).toBeUndefined();
      }
      if (layer === 'sibling') {
        /* 本条自己的详情页无 brand/icon ⇒ 明确写成「同族页补齐」，不许冒充直接证据 */
        expect(src, canonicalId).toContain('同族页');
        expect(src, canonicalId).toContain('本页');
        expect(src, canonicalId).toContain('brand');
      } else if (layer === 'brand') {
        expect(src, canonicalId).toContain('**vendor 分层取证**');
        expect(src, canonicalId).toContain('模型详情页');
        expect(src).toContain(`https://apimart.ai/model/${apimartId}`);
      } else {
        /* `Service` 页无 brand ⇒ 厂商依据是 vendor icon 文件名 */
        expect(src, canonicalId).toContain('vendor icon 文件名');
      }
    }
  });

  it('本轮命中官方定价清单的 4 行：绑定 + verified + 去掉 displayNameOverride', () => {
    expect([...PRICING_ROWS_BOUND_THIS_ROUND].sort()).toEqual(
      ['midjourney', 'qwen-image-2.0-pro', 'wan2.7-image-pro', 'z-image-turbo'],
    );
    for (const apimartId of PRICING_ROWS_BOUND_THIS_ROUND) {
      const row = byId.get(apimartId)!;
      expect(row.canonicalId, apimartId).toBeTruthy();
      expect(row.matchStatus, apimartId).toBe('verified');
      expect(row.displayNameOverride, apimartId).toBeUndefined();
      expect(row.source, apimartId).toContain('**vendor 分层取证**');
    }
  });

  it('本轮 5 条只有身份、没有同名定价行的模型：登记在案（不假装有绑定行）', () => {
    for (const id of IDS_WITHOUT_APIMART_ROW) expect(byId.has(id), id).toBe(false);
  });

  it('本轮 1 条身份已登记、行**故意不绑**：登记原因写在 source（零猜测不绑）', () => {
    for (const id of IDENTITY_ROW_LEFT_UNBOUND) {
      const row = byId.get(id);
      expect(row, id).toBeTruthy();
      expect(row!.canonicalId, id).toBeUndefined();
      expect(row!.displayNameOverride, id).toBeUndefined();
      expect(row!.matchStatus, id).toBe('unverified');
    }
    /* 身份本身必须在 Registry 里（不许因为不绑就漏登记） */
    expect(canonById.get('google/gemini-omni-flash-preview')).toBeTruthy();
  });

  it('本轮 2 条同名定价行**故意不绑**（定价 id 用 `.` 分隔，依据不是逐字相等）', () => {
    for (const id of NON_VERBATIM_ROW_LEFT_UNBOUND) {
      const row = byId.get(id);
      expect(row, id).toBeTruthy();
      expect(row!.canonicalId, id).toBeUndefined();
      expect(row!.matchStatus, id).toBe('unverified');
    }
    expect(canonById.get('bytedance/doubao-seedance-1-0-pro')).toBeTruthy();
    expect(canonById.get('bytedance/doubao-seedance-1-0-pro-fast')).toBeTruthy();
  });

  it('本轮显式登记「非逐字」绑定：官方 id 与 officialModelIds 差在分隔符，source 写明依据分层', () => {
    for (const apimartId of NON_VERBATIM_BINDING) {
      const row = byId.get(apimartId)!;
      expect(row.canonicalId, apimartId).toBeTruthy();
      const canon = canonById.get(row.canonicalId!)!;
      expect(canon.officialModelIds).not.toContain(apimartId);
      expect(row.source, apimartId).toContain('不是逐字相等');
      expect(row.source, apimartId).toContain('本轮指令');
    }
  });

  it('官方行绑定 46 / 未绑定 1（唯一剩下的是 imagen-4.0-apimart，已登记原因）', () => {
    const officialRows = FILE.mappings.filter((m) => OFFICIAL_IDS.has(m.providerModelId));
    expect(officialRows.filter((m) => m.canonicalId)).toHaveLength(46);
    expect(officialRows.filter((m) => !m.canonicalId).map((m) => m.providerModelId).sort()).toEqual(
      ['imagen-4.0-apimart'],
    );
    expect(byId.get('imagen-4.0-apimart')!.source).toContain('仍不绑定');
  });

  it('★ mai 两条：vendor 出处必须分层写清（详情页 = vendor；定价页 = id/name），不许写成「用户口头确认」', () => {
    for (const canonicalId of ['microsoft/mai-image-2-6', 'microsoft/mai-image-2-6-flash']) {
      const canon = canonById.get(canonicalId)!;
      expect(canon.officialVendor, canonicalId).toBe('Microsoft');
      /* 逐字钉住分层：vendor 来自 apimart **模型详情页**（截图取证） */
      expect(canon.source, canonicalId).toContain('vendor = Microsoft');
      expect(canon.source, canonicalId).toContain('模型详情页');
      expect(canon.source, canonicalId).toContain('用户 2026-10-15 提供截图取证');
      /* 定价页那层只负责 id/name */
      expect(canon.source, canonicalId).toContain('https://apimart.ai/en/pricing');
      expect(canon.source, canonicalId).toContain('2026-10-15T07:06:29Z');
      /* 不许再把证据等级降级成「口头确认」 */
      expect(canon.source, canonicalId).not.toContain('口头确认');
      /* 也不许编造详情页 URL */
      expect(canon.source, canonicalId).not.toMatch(/apimart\.ai\/[a-z-]+\/models?\//);
    }
    /* 详情页给的规格落在 source（不发明字段）；2.6 那条按页面记 image.edit */
    const two6 = canonById.get('microsoft/mai-image-2-6')!;
    expect(two6.source).toContain('1K / 2K');
    expect(two6.source).toContain('最多 5 张参考图');
    expect(two6.source).toContain('Bing 联网增强');
    expect(two6.capabilities).toEqual(['image', 'image.edit']);
    /* -flash 变体自己的详情页未取证 ⇒ 不冒认规格 */
    const flash = canonById.get('microsoft/mai-image-2-6-flash')!;
    expect(flash.capabilities).toEqual(['image']);
    expect(flash.source).toContain('同族推断');
  });
});

/**
 * 2026-10-15 裁决 #3：**同一官方模型不能指两个 canonicalId**。
 * 起因：`gemini-3.1-flash-image-preview-official`（官方 alias `nano-banana-2`）被 alias 命中绑到
 * `google/banana-pro`，而 `gemini-3.1-flash-image-preview`（官方 name `Nano Banana 2`）绑 `google/banana-2`
 * —— 同一实体指两处。口径：**name 命中优先于 id / alias 命中**；alias 与 officialName 冲突时以 officialName 为准。
 */
describe('⑦ 防交叉绑定（name 优先，裁决 #3）', () => {
  it('同一 apimart `name` 不会绑到两个不同 canonicalId', () => {
    const byName = new Map<string, Set<string>>();
    for (const [id, name] of OFFICIAL) {
      const row = byId.get(id)!;
      if (!row.canonicalId) continue;
      const key = norm(name);
      if (!byName.has(key)) byName.set(key, new Set());
      byName.get(key)!.add(row.canonicalId);
    }
    expect(byName.size).toBeGreaterThan(30);
    for (const [name, set] of byName) {
      expect(set.size, `官方 name「${name}」绑到了多个 canonicalId：${[...set].join(', ')}`).toBe(1);
    }
  });

  it('★ name 命中优先：官方 id / alias / name 归一后命中某 canonical 的 officialName ⇒ 必须绑那一个', () => {
    /* 例外（已裁决，不按 name 优先改绑）：`gemini-3-pro-image-preview-official` 在 apimart 官方清单里是
       **独立 id**，裁决 #4 要求「照 id 逐条登记、本轮不合并」⇒ 它的 alias `nano-banana-pro` 虽与
       `google/banana-pro` 同名，本行仍保留按 id 登记的独立 canonical。 */
    const ID_REGISTERED_EXCEPTION = new Set([
      /* 上一轮裁决 #4：apimart 官方清单里的**独立 id**，照 id 逐条登记、本轮不合并 */
      'gemini-3-pro-image-preview-official',
      /* 本轮：identity 清单同时给了 `xai/grok-image`（官方名「Grok Imagine Image」）。原先按定价 id 登记、
         绑 `xai/grok-imagine` 的 3 行按既有归属保留；本条冲突已登记（见下方 NAME_CONFLICT 断言）。 */
      'grok-imagine-image',
      'grok-imagine-image-2.0',
      'grok-imagine-image-quality',
      /* 本轮登记：官方 alias「grok-imagine-1.5-ext」现与新增 `xai/grok-imagine-1-5-ext` 的 officialName 归一后相同 */
      'grok-imagine-1.5-apimart',
    ]);
    const byOfficialName = new Map(CANON_RAW.canonicalModels.map((c) => [norm(c.officialName), c]));
    const violations: string[] = [];
    for (const m of FILE.mappings) {
      if (!m.canonicalId || ID_REGISTERED_EXCEPTION.has(m.providerModelId)) continue;
      const off = OFFICIAL.find(([id]) => id === m.providerModelId);
      if (!off) continue;
      const [id, name] = off;
      for (const key of [id, ALIASES.get(id), name]) {
        if (!key || key === '$undefined') continue;
        const viaName = byOfficialName.get(norm(key));
        if (viaName && viaName.canonicalId !== m.canonicalId) {
          violations.push(`${m.providerModelId}：绑 ${m.canonicalId}，但「${key}」= ${viaName.canonicalId} 的 officialName`);
        }
      }
    }
    expect(violations).toEqual([]);
    /* 本轮登记的厂商名冲突：新增 `xai/grok-*` 的 officialName 与既有 `xai/grok-imagine-*` 归一后相同 ——
       只登记、不统一；既有绑定保留，新增 canonical 的 source 必须写明冲突。 */
    for (const [providerModelId, kept, added, conflictKey, normExpected] of NAME_CONFLICT) {
      expect(canonById.get(added)!.source, added).toContain('厂商名冲突');
      expect(norm(canonById.get(added)!.officialName)).toBe(normExpected);
      expect(norm(conflictKey)).toBe(normExpected);
      const row = byId.get(providerModelId);
      if (row) expect(row.canonicalId, providerModelId).toBe(kept);
    }
    expect(byId.get('grok-imagine-image')!.canonicalId).toBe('xai/grok-imagine');
    /* 例外那条必须把「登记待裁决」写进 source */
    const ex = byId.get('gemini-3-pro-image-preview-official')!;
    expect(ex.canonicalId).toBe('google/gemini-3-pro-image-preview-official');
    expect(ex.source).toContain('登记待裁决');
  });

  it('#3 的两条交叉绑定已按 name 优先修掉，Registry 数据错误已登记', () => {
    /* 旧：gemini-3.1-flash-image-preview-official → google/banana-pro（alias 命中）
       新：→ google/banana-2（与不带后缀那条一致，name 命中） */
    const row = byId.get('gemini-3.1-flash-image-preview-official')!;
    expect(row.canonicalId).toBe('google/banana-2');
    expect(row.source).toContain('id/alias 命中被 name 命中覆盖');
    /* Registry 数据错误已登记（未改 officialModelIds） */
    const bp = canonById.get('google/banana-pro')!;
    expect(bp.officialModelIds).toContain('nano-banana-2');
    expect(bp.source).toContain('Registry 数据错误');
    /* grsai 的同类交叉绑定也已按 name 优先改掉 */
    const grsai = JSON.parse(readFileSync(new URL('grsai.json', MAPPING_DIR), 'utf8')) as { mappings: MappingRow[] };
    const grsaiRow = grsai.mappings.find((m) => m.providerModelId === 'nano-banana-2')!;
    expect(grsaiRow.canonicalId).toBe('google/banana-2');
    /* 全部映射表不得再有同类交叉绑定（除上面那条已裁决例外 + 本轮登记的 grok 厂商名冲突） */
    const byOfficialName = new Map(CANON_RAW.canonicalModels.map((c) => [norm(c.officialName), c]));
    for (const [file, rows] of allMappingFiles()) {
      for (const m of rows) {
        if (!m.canonicalId || file === 'apimart.json') continue;
        if (NAME_CONFLICT_PROVIDER_IDS.has(m.providerModelId)) continue;
        const viaName = byOfficialName.get(norm(m.providerModelId));
        if (viaName) expect(m.canonicalId, `${file}: ${m.providerModelId}`).toBe(viaName.canonicalId);
      }
    }
  });
});
