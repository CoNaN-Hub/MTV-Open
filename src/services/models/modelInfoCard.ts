/**
 * 模型说明卡（画布节点「选择模型」悬停浮出的信息卡）—— **数据装配层**。
 *
 * ## 为什么要有它（用户实测的两个问题）
 * ① 说明卡**根本不出现**：原来画布侧只用 `data/framiaModelInfo.ts` 的 Framia 目录做闸门
 *    （`hasFramiaModelInfo(model)` ⇒ 对不上就 `return null`），而 MTV 上真实在用的模型引用是
 *    `general/<配置 id>`（土豆这类自定义连接）。Framia 目录只认「模型名 / 别名」，
 *    上游 id `gemini-nano-banana-2.1`、`gpt-image-2-all` 这类**一个都对不上** ⇒ 永远没有卡。
 * ② 就算对上，MTV 也没有「官方目录条目」这一层信息（介绍 / 能力 / 参数 / 价目）。
 *
 * ## 数据来源链（一级一级往下走，**每一级都只读已存在的表，不发明字段**）
 *
 * | 这一屏的字段 | 来源（顺序 = 优先级） |
 * |---|---|
 * | 官方身份（canonicalId / 官方名 / 厂商 / 图标 / 能力） | `services/models/canonical`（`modelCanonical.json`）经 `normalizeModel` 归一化；<br>归一化器在「平台映射条目显式登记为 unverified」时会第 1 档提前返回 ⇒ 这里补同一判据的兜底 `findCanonicalByOfficialId(上游 id)` |
 * | 官方参数（比例 / 画质 / 精细度 / 张数） | `utils/imageModelCapabilities`（`official-image-models.json`，EXE 抽取）按**官方 id 精确**查；<br>非图片族用 `services/ai/modelParamCatalog`（`model-param-catalog.json`，官方目录逐字） |
 * | 介绍 | 官方目录简介（`official-model-meta.json`，经 `utils/officialModelDisplay.officialCardMeta`）→ Framia 卡片 → `ModelOption.description`（MTV 自己的） |
 * | 速度 / 质量 / 成本三档 | Framia 卡片（`data/framiaModelInfo.ts`，**只有该目录里的模型才有**） |
 * | 价目 | 该**连接**的价目体系：`creditEstimate.cachedCreditPriceTable`（**只读已拉取的缓存**，不因悬停发请求）+ `estimateWithBilling`（手动覆盖 → 价目表 → 兜底单价，与生成确认卡同一套） |
 *
 * ## 纪律
 * - **不编造官方字段**：官方表里没有的字段一律不渲染，并在卡片脚注里写明
 *   「官方目录未收录 / 官方未建模该字段，按 MTV 现有数据等价展示」。
 * - 模型名只走 `displayName`（`services/models/display` 是唯一出口）；本文件**不产出名字**，
 *   只在没传 `displayName` 时回落到 `label`。
 * - 解析不到官方条目**不是错误**：仍然返回一张最小卡（模型名 / 连接 / 类型 / 价目）。
 */
import type { AppConfig } from '../../types';
import { framiaModelInfoFor } from '../../data/framiaModelInfo';
import {
  OFFICIAL_IMAGE_MODEL_TABLE,
  aspectRatiosForModel,
  findImageModelCapability,
  imageNodeDefaultParams,
  imageSizesForModel,
  qualityOptionsForModel,
} from '../../utils/imageModelCapabilities';
import { officialCardMeta, type ModelFamily } from '../../utils/officialModelDisplay';
import { findCanonicalByOfficialId, getCanonicalModel } from './canonical';
import { normalizedModelOf } from './display';
import type { ResolveProviderInput } from './providers';
import { getParamEntry } from '../ai/modelParamCatalog';
import { resolveCreditConnection } from '../ai/creditConnection';
import { cachedCreditPriceTable, estimateWithBilling } from '../ai/creditEstimate';
import { resolveOutgoingImageQuality } from '../ai/imageQuality';

/** 说明卡脚注（组件侧用 `t()` 渲染；解析层只给「哪一条」，不给译文）。 */
export type ModelInfoCardNote =
  /** 官方（TapNow）目录里查不到这个模型 ⇒ 整张卡都是 MTV 现有数据。 */
  | 'official-catalog-missing'
  /** 官方身份有、但官方目录没建模它的参数/介绍 ⇒ 该部分按 MTV 现有数据展示。 */
  | 'official-fields-missing';

/** 卡片上「事实」一行的键（组件侧 `t()` 成中文/英文）。 */
export type ModelInfoCardFactKey = '类型' | '连接' | '厂商' | '官方条目';

export interface ModelInfoCardFact {
  label: ModelInfoCardFactKey;
  value: string;
}

/** 参数行（键同样是组件侧 `t()`）。 */
export type ModelInfoCardParamKey = '比例' | '画质' | '精细度' | '张数上限' | '时长' | '分辨率' | '生成方式';

export interface ModelInfoCardParam {
  label: ModelInfoCardParamKey;
  value: string;
}

/** 官方身份命中等级：`verified` = 官方身份表（canonical）命中；`catalog` = 只在官方参数/能力表命中。 */
export type ModelInfoCardIdentity = 'verified' | 'catalog' | 'none';

export interface ModelInfoCard {
  /** 与下拉行/触发器**同源**的展示名。 */
  displayName: string;
  /** 官方身份命中等级。 */
  identity: ModelInfoCardIdentity;
  /** 官方目录条目 id（`official-image-models.json` / `model-param-catalog.json` 的键）。 */
  officialId: string | null;
  canonicalId: string | null;
  officialVendor: string | null;
  iconKey: string | null;
  /** 模型族（`image` / `video` / `audio` / `text` / `threeD`）。 */
  family: string | null;
  executionMode: 'sync' | 'async';
  /** 走哪条连接（土豆这类）—— 说明卡「provider」那一行。 */
  connectionName: string | null;
  /** 上游真实调用 id（出站用的那个，含 `async` 之类平台后缀）。 */
  upstreamModelId: string;
  /** 事实行（类型 / 连接 / 厂商 …）。 */
  facts: ModelInfoCardFact[];
  description: string | null;
  descriptionSource: 'official' | 'framia' | 'model' | null;
  /** Framia 卡片的「适合」原文。 */
  bestFor: string | null;
  params: ModelInfoCardParam[];
  /** Framia 卡片的速度/质量/成本（1..5 / Low|Medium|High）；没有该目录条目 ⇒ `null`。 */
  scores: { speed: number; quality: number; cost: string } | null;
  /** 按该连接**已拉取的**价目表算出的积分（没有价目 ⇒ `null`，卡片不渲染这一行）。 */
  priceCredits: number | null;
  notes: ModelInfoCardNote[];
}

/** 解析输入：`ModelOption` 里说明卡用得上的那几项 + 展示名出口给的名字。 */
export interface ModelInfoCardModel {
  value: string;
  label: string;
  description?: string;
  provider?: string;
  connectionName?: string;
  /** 展示名（与下拉行同源）。不给则回落 `label`。 */
  displayName?: string;
}

/** 说明卡只需配置的这两块（`AppConfig` 的子集，测试好构造）。 */
export type ModelInfoCardConfig = Pick<AppConfig, 'providers' | 'generalModels'>;

const FAMILY_LABELS: Record<string, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  text: '文本',
  threeD: '3D',
};

/** 去重 + 去空的候选名（顺序 = 优先级）。 */
function uniqueLabels(values: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = (raw ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/** `value` → 真正发出去的上游 id + 这条连接的解析输入。 */
function resolveRef(
  model: ModelInfoCardModel,
  config: ModelInfoCardConfig,
): { upstream: string; connection: ResolveProviderInput; connectionName: string | null } {
  const value = (model.value ?? '').trim();
  const provider = (model.provider ?? '').trim();
  const fallbackName = (model.connectionName ?? '').trim() || null;

  /* 自定义连接：`general/<配置 id>` —— 上游真名在 `modelId`，连接在 `providerConfigId`。 */
  if (value.startsWith('general/')) {
    const configId = value.slice('general/'.length);
    const entry = (config.generalModels ?? []).find((item) => item.id === configId);
    const connectionKey = entry?.providerConfigId;
    const connection = connectionKey ? config.providers?.[connectionKey] : undefined;
    return {
      upstream: (entry?.modelId ?? value).trim(),
      connection: { connectionKey, catalogId: connection?.catalogId, baseUrl: connection?.baseUrl },
      connectionName: (connection?.name ?? '').trim() || fallbackName,
    };
  }

  /* 内置连接：`<provider>/<modelId>`（没有 `/` 时整串就是模型 id）。 */
  const slash = value.indexOf('/');
  const providerKey = provider || (slash > 0 ? value.slice(0, slash) : '');
  const connection = providerKey ? config.providers?.[providerKey] : undefined;
  return {
    upstream: slash > 0 ? value.slice(slash + 1) : value,
    connection: { connectionKey: providerKey, catalogId: connection?.catalogId, baseUrl: connection?.baseUrl },
    connectionName: (connection?.name ?? '').trim() || fallbackName,
  };
}

/** 依次用候选名去 Framia 目录里找（该目录只认名字/别名，所以要逐个试）。 */
function firstFramiaEntry(candidates: readonly string[]) {
  for (const candidate of candidates) {
    const hit = framiaModelInfoFor({ value: candidate, label: '' });
    if (hit) return hit;
  }
  return null;
}

/** 官方 id 精确命中官方图片能力表（**不用 includes 模糊**，避免 `nano-banana-2` 抢 `…2.1`）。 */
function findExactImageCapability(officialIds: readonly string[]) {
  if (officialIds.length === 0) return null;
  const wanted = new Set(officialIds.map((id) => id.trim().toLowerCase()));
  return OFFICIAL_IMAGE_MODEL_TABLE.find((entry) => wanted.has(entry.model.toLowerCase())) ?? null;
}

/** 官方参数行（图片族走能力表；其余族走官方参数目录）。 */
function paramsFor(
  officialId: string | null,
  officialIds: readonly string[],
  family: ModelFamily | null,
): ModelInfoCardParam[] {
  const params: ModelInfoCardParam[] = [];
  /* `officialId` 是**能力表/参数目录亲自命中的那一条**（可能来自别名链而非官方身份表）⇒
     查字段时把它也算进去，否则「别名链命中的模型只有半张参数表」。 */
  const lookupIds = officialId ? [officialId, ...officialIds] : officialIds;
  const cap = family === 'image' || family === null ? findExactImageCapability(lookupIds) : null;

  if (cap) {
    const ratios = aspectRatiosForModel(cap.model);
    if (ratios.length > 0) params.push({ label: '比例', value: ratios.join(' / ') });
    const sizes = imageSizesForModel(cap.model);
    if (sizes.length > 0) params.push({ label: '画质', value: sizes.join(' / ') });
    const quality = qualityOptionsForModel(cap.model);
    if (quality && quality.length > 0) params.push({ label: '精细度', value: quality.join(' / ') });
    if (typeof cap.maxImages === 'number' && cap.maxImages > 0) {
      params.push({ label: '张数上限', value: String(cap.maxImages) });
    }
    return params;
  }

  /* 非图片族（视频/音频/…）：官方参数目录的逐模型条目。 */
  const entry = officialId ? getParamEntry(officialId) : undefined;
  if (!entry) return params;
  const variant = entry.variants?.[0];
  const ratios = entry.aspectRatios ?? variant?.options?.aspectRatios;
  if (Array.isArray(ratios) && ratios.length > 0) params.push({ label: '比例', value: ratios.join(' / ') });
  const durations = entry.durations ?? variant?.options?.durations;
  if (Array.isArray(durations) && durations.length > 0) {
    params.push({ label: '时长', value: durations.map((value) => `${value}s`).join(' / ') });
  }
  const resolutions = entry.resolutions ?? variant?.options?.resolutions;
  if (Array.isArray(resolutions) && resolutions.length > 0) {
    params.push({ label: '分辨率', value: resolutions.join(' / ') });
  }
  const quality = entry.qualityOptions ?? variant?.options?.qualityOptions;
  if (Array.isArray(quality) && quality.length > 0) params.push({ label: '精细度', value: quality.join(' / ') });
  return params;
}

/** 该连接**已拉取到**的价目（没有缓存 ⇒ `null`，绝不因为悬停去请求）。 */
function priceCreditsFor(
  model: ModelInfoCardModel,
  config: ModelInfoCardConfig,
  family: string | null,
): number | null {
  /* 只对图片族给价：视频/音频的计费维度（时长/分辨率）与图片预估不是同一套口径，
     混用会把「每秒」的价当成「每张」的价显示出来 ⇒ 宁可不显示。 */
  if (family !== 'image') return null;
  const connection = resolveCreditConnection(model.provider, model.value, {
    providers: config.providers ?? {},
    generalModels: config.generalModels ?? [],
  });
  if (!connection) return null;
  const table = cachedCreditPriceTable(connection.baseUrl, connection.billing);
  const estimate = estimateWithBilling(
    table,
    {
      modelId: connection.modelId,
      quality: resolveOutgoingImageQuality(connection.modelId),
      resolution: imageNodeDefaultParams(connection.modelId).imageSize,
    },
    connection.billing,
    connection.discount?.ratio ?? null,
  );
  return estimate ? estimate.credits : null;
}

/**
 * 装配一张模型说明卡。**永不返回 `null`** —— 官方目录查不到时返回最小卡
 * （模型名 / 连接 / 类型 / 价目），并在 `notes` 里写明「官方目录未收录」。
 */
export function buildModelInfoCard(
  model: ModelInfoCardModel,
  config: ModelInfoCardConfig,
  /** 调用方的节点模型族提示（`nodeTypeToModelFamily`）；官方身份查不到时用它兜底。 */
  familyHint: ModelFamily | null = null,
): ModelInfoCard {
  const ref = resolveRef(model, config);
  const normalized = normalizedModelOf({
    providerModelId: ref.upstream,
    connection: ref.connection,
    raw: { providerModelId: ref.upstream, providerName: model.label },
  });

  /* ① 官方身份：归一化器优先。兜底 = 归一化器的**第 3.5 档**判据
        （「调用 id 与官方 id 逐字相等」）—— 平台映射表里可能把条目登记成 `unverified`
        而 canonical Registry 里已经有同一 id 的条目（例：土豆 `gemini-nano-banana-2.1`
        ↔ `google/nano-banana-2-1`），归一化器第 1 档提前 return 会漏掉它。 */
  const canonical = getCanonicalModel(normalized.canonicalId)
    ?? findCanonicalByOfficialId(normalized.providerModelId)
    ?? findCanonicalByOfficialId(normalized.baseModelId);

  const officialIds = uniqueLabels([
    ...(canonical?.officialModelIds ?? []),
    ...(normalized.officialModelIds ?? []),
  ]);
  const candidates = uniqueLabels([
    model.displayName,
    model.label,
    ref.upstream,
    normalized.baseModelId,
    normalized.officialName,
    canonical?.officialName,
    ...officialIds,
  ]);

  const family = ((canonical?.capabilities?.[0] ?? '') as ModelFamily | '') || familyHint;

  /* ② 官方目录条目：有官方身份 ⇒ **只认官方 id 精确命中**；
        没有官方身份 ⇒ 走既有能力表的别名链（与下拉行 `officialCardMeta` 同一套口径）。
        ⚠️ 图片能力表只对**图片族**用 —— 它内部的 `includes` 会把文本模型
        （例 `gemini-3.1-pro-preview`）吸到 `tamar-google-gemini-pro` 上，给出错误的图片参数。 */
  const imageFamily = family === 'image' || family === null;
  const exactCap = imageFamily ? findExactImageCapability(officialIds) : null;
  const fuzzyCap = !canonical && imageFamily ? findImageModelCapability(candidates) : null;
  const catalogCap = exactCap ?? fuzzyCap;
  const officialId = catalogCap?.model
    ?? officialIds.find((id) => !!getParamEntry(id))
    ?? null;
  const identity: ModelInfoCardIdentity = canonical
    ? 'verified'
    : officialId
      ? 'catalog'
      : 'none';

  /* ③ 介绍：官方目录简介 → Framia 卡片 → MTV 自己的 description。 */
  const officialMeta = officialCardMeta(officialIds.length > 0 ? officialIds : candidates, family ?? null);
  const framia = firstFramiaEntry(candidates);
  const officialDescription = (officialMeta.description ?? '').trim() || null;
  const framiaDescription = framia ? ((framia.zh?.description ?? framia.description ?? '').trim() || null) : null;
  const modelDescription = (model.description ?? '').trim() || null;
  const description = officialDescription ?? framiaDescription ?? modelDescription;
  const descriptionSource: ModelInfoCard['descriptionSource'] = officialDescription
    ? 'official'
    : framiaDescription
      ? 'framia'
      : modelDescription
        ? 'model'
        : null;

  const params = paramsFor(officialId, officialIds, family ?? null);
  const priceCredits = priceCreditsFor(model, config, family ?? null);

  /* ④ 事实行：类型恒有；连接 / 厂商 / 官方条目按拿得到才给。 */
  const facts: ModelInfoCardFact[] = [];
  const familyLabel = family ? FAMILY_LABELS[family] ?? family : null;
  if (familyLabel) facts.push({ label: '类型', value: familyLabel });
  if (ref.connectionName) facts.push({ label: '连接', value: ref.connectionName });
  if (canonical?.officialVendor) facts.push({ label: '厂商', value: canonical.officialVendor });
  if (identity === 'catalog' && officialId) facts.push({ label: '官方条目', value: officialId });

  /* ⑤ 脚注：哪一块不是官方字段，必须写清楚。 */
  const notes: ModelInfoCardNote[] = [];
  if (identity === 'none') {
    notes.push('official-catalog-missing');
  } else if (!description && params.length === 0) {
    notes.push('official-fields-missing');
  }

  return {
    displayName: (model.displayName ?? '').trim() || model.label,
    identity,
    officialId,
    canonicalId: canonical?.canonicalId ?? null,
    officialVendor: canonical?.officialVendor ?? null,
    iconKey: canonical?.iconKey ?? officialMeta.iconKey ?? null,
    family: family ?? null,
    executionMode: normalized.executionMode,
    connectionName: ref.connectionName,
    upstreamModelId: ref.upstream,
    facts,
    description,
    descriptionSource,
    bestFor: framia ? (framia.zh?.bestFor ?? framia.bestFor ?? '').trim() || null : null,
    params,
    scores: framia ? { speed: framia.speed, quality: framia.quality, cost: framia.cost } : null,
    priceCredits,
    notes,
  };
}
