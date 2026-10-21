/**
 * 展示名出口 —— **UI 只允许通过这里拿模型名**。
 *
 * 三个入口，覆盖现有全部模型引用形态：
 *   1. `normalizedModelOf()`   —— 按 `providerId + providerModelId` 归一化（带缓存）
 *   2. `displayNameOfModelRef()` —— 处理节点上存的 `"<provider>/<modelId>"`
 *   3. `useModelDisplayName()`  —— React 版，额外处理自定义连接的 `general/<cfgId>`
 *
 * ⚠️ 所有返回的都是 `displayName`（找不到映射时退化为**原始平台 id**）；
 *    调用方**不得**再自己拼名字、剥前缀、查官方表 —— 那些逻辑现在只有一处。
 */
import { useMemo } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { findCanonicalByOfficialId } from './canonical';
import { normalizeModel, type NormalizeInput } from './normalize';
import { getProviderConfig, resolveProviderId, type ResolveProviderInput } from './providers';
import type { NormalizedModel, ProviderRawModel } from './types';

/** `providerId + providerModelId` → NormalizedModel（纯函数结果，缓存以免每次 render 重算）。*/
const CACHE = new Map<string, NormalizedModel>();

function cacheKey(providerId: string, providerModelId: string, hint: string): string {
  return `${providerId}\u0000${providerModelId}\u0000${hint}`;
}

/**
 * ★ 定「平台标识（providerId）」—— 映射表 / 手工 Display Name 覆盖都按它索引。
 *
 * 规则（**只在「显式 providerId 不是已知平台」时才改动**，已知平台一律原样返回）：
 *   1. 显式 providerId 是 `modelProviders.json` 里的已知平台 ⇒ 用它（既有行为不变）；
 *   2. 否则用连接信息（**域名优先** → catalogId → 连接 key）解析，解析结果若是已知平台 ⇒ 用它；
 *   3. 都不认识 ⇒ 原样返回（未知平台 → 不虚构官方名）。
 *
 * 为什么需要它：自定义连接的 key 形如 `custom-2611fc0a`，而映射表与覆盖层是按
 * **平台**（`tudou`）写的。调用方常常只拿得到连接 key ⇒ 以前会直接把它当平台用，
 * 于是「在设置里存得进 Display Name、界面上读不出来」。
 */
function platformIdFor(explicit: string | undefined, connection: ResolveProviderInput): string {
  const given = (explicit ?? '').trim();
  if (given && getProviderConfig(given)) return given;
  const fromConnection = resolveProviderId(connection);
  if (fromConnection && getProviderConfig(fromConnection)) return fromConnection;
  return given || fromConnection;
}

export function normalizedModelOf(input: NormalizeInput): NormalizedModel {
  const connection = input.connection ?? {};
  const providerId = platformIdFor(input.providerId, connection).trim();
  const providerModelId = (input.providerModelId ?? '').trim();
  const hint = input.raw?.officialModelId ?? '';
  const key = cacheKey(providerId, providerModelId, hint);
  const hit = CACHE.get(key);
  if (hit) return hit;
  const result = normalizeModel({ ...input, providerId, providerModelId });
  CACHE.set(key, result);
  return result;
}

/** 清缓存（配置变化 / 测试用）。
 *  ⚠️ **必须在映射覆盖层 / canonical 变化时调用** —— 否则改了 Display Name 也要重载才生效。
 *  调用点在 `store.config.ts`（`syncMappingOverrides` / `syncCanonicalAdditions` 旁边）。 */
export function clearNormalizedCache(): void {
  CACHE.clear();
}

/**
 * 把归一化结果**盖**到目录条目上（`ProviderModelSelection` / `GeneralModelConfig`）。
 * 目录条目里同时保留：
 *   · `name`       = 平台原始名（**只用于排障，UI 不读**）
 *   · `normalized` = 归一化身份（UI 读 `displayName`）
 */
export function stampNormalized<T extends { id: string; name?: string }>(
  entry: T,
  connection: ResolveProviderInput,
  /** Adapter 解析出的平台原始条目（可带平台声明的原厂字段）—— 归一化第 3 档要用 */
  raw?: ProviderRawModel,
): T & { normalized: NormalizedModel } {
  const resolvedRaw: ProviderRawModel = raw ?? { providerModelId: entry.id, providerName: entry.name };
  return { ...entry, normalized: normalizedModelOf({ providerModelId: entry.id, connection, raw: resolvedRaw }) };
}

/** 目录列表批量盖章。 */
export function stampNormalizedList<T extends { id: string; name?: string }>(
  entries: readonly T[],
  connection: ResolveProviderInput,
): Array<T & { normalized: NormalizedModel }> {
  return entries.map((entry) => stampNormalized(entry, connection));
}

export interface ModelRefOptions {
  /** 连接目录 id（内置厂商）*/
  catalogId?: string;
  baseUrl?: string;
  providerId?: string;
  /** 自定义连接的上游信息（`general/<cfgId>` 时必需）*/
  generalModel?: { modelId?: string; providerConfigId?: string } | null;
}

/** 从 `"<provider>/<modelId>"` 里拆出平台与调用 id。 */
export function splitModelRef(modelRef: string): { provider: string; providerModelId: string } {
  const raw = (modelRef ?? '').trim();
  const slash = raw.indexOf('/');
  if (slash <= 0) return { provider: '', providerModelId: raw };
  return { provider: raw.slice(0, slash), providerModelId: raw.slice(slash + 1) };
}

/**
 * 节点上存的模型引用 → 展示名。
 * 支持两种形态：`"<provider>/<modelId>"`（内置/目录）与 `"general/<cfgId>"`（自定义连接）。
 */
export function displayNameOfModelRef(
  modelRef: string,
  options: ModelRefOptions & { generalModels?: Array<{ id: string; modelId?: string; name?: string; providerConfigId?: string }>; providers?: Record<string, { name?: string; catalogId?: string; baseUrl?: string }> } = {},
): string {
  const raw = (modelRef ?? '').trim();
  if (!raw) return '';

  const { provider, providerModelId } = splitModelRef(raw);

  /* 自定义连接：`general/<cfgId>` —— 上游真实 id 在 cfg.modelId 上 */
  if (provider === 'general') {
    const cfg = options.generalModels?.find((m) => m.id === providerModelId);
    if (!cfg) return raw;
    const connection = options.providers?.[cfg.providerConfigId ?? ''];
    return normalizedModelOf({
      providerModelId: cfg.modelId ?? raw,
      connection: { connectionKey: cfg.providerConfigId, catalogId: connection?.catalogId, baseUrl: connection?.baseUrl },
      raw: { providerModelId: cfg.modelId ?? raw, providerName: cfg.name },
    }).displayName;
  }

  if (!provider) {
    /* 没有平台前缀（例：历史记录里只存了裸 id）⇒ 仍可按**官方 id 精确相等**给出官方名；
       这是查表不是猜（与归一化器第 3.5 档同一口径）。 */
    const canonical = findCanonicalByOfficialId(raw);
    return canonical?.officialName ?? raw;
  }
  /* ★ 连接信息：调用方显式给的最优先；没给就从传进来的 `providers` 表里按连接 key 补。
     ⚠️ 以前这里**根本没用 `options.providers`** —— `ModelSelector` 只传 `providers`、不传
      `catalogId`/`baseUrl` ⇒ `resolveProviderId` 拿到空域名、平台永远解析不出来 ⇒
      映射表与手工 Display Name 覆盖全部失效、只能退回原始 id。 */
  const connection = options.providers?.[provider];
  return normalizedModelOf({
    providerId: options.providerId,
    providerModelId,
    connection: {
      connectionKey: provider,
      catalogId: options.catalogId ?? connection?.catalogId,
      baseUrl: options.baseUrl ?? connection?.baseUrl,
    },
  }).displayName;
}

/**
 * 目录条目 → 展示名（`ProviderModelSelection` / `GeneralModelConfig` 这类带 `normalized` 的条目）。
 *
 * 设置页的模型列表、计费行的模型名都用它。
 * ⚠️ 条目里的 `name` 是**平台原始名**（只作排障）；`id` / `modelId` 是**出站调用 id**。
 */
export function displayNameOfCatalogEntry(entry: {
  id?: string;
  modelId?: string;
  provider?: string;
  name?: string;
  normalized?: NormalizedModel | null;
}, 
/** ★ 可选连接信息：`entry.provider` 存的是**连接 key**（例 `custom-2611fc0a`），
 *  而映射表/覆盖层按**平台**（例 `tudou`）索引 ⇒ 调用方**应把该连接的 `baseUrl` 传进来**，
 *  否则平台解析不出来、Display Name 覆盖不生效。 */
connection?: ResolveProviderInput): string {
  if (entry.normalized) return entry.normalized.displayName;
  const providerModelId = (entry.modelId ?? entry.id ?? '').trim();
  if (!providerModelId) return '';
  return normalizedModelOf({
    providerId: entry.provider,
    providerModelId,
    connection: { connectionKey: entry.provider, ...connection },
    raw: { providerModelId, providerName: entry.name },
  }).displayName;
}

/**
 * 目录候选 → 展示名。给「手上只有目录快照」的地方用
 * （例：Agent 的 `provider_models` 审批卡，只有 `{catalogId, id, name}`）。
 */
export function displayNameOfCatalogModel(
  catalogId: string | undefined,
  providerModelId: string,
  providerName?: string,
): string {
  const id = (providerModelId ?? '').trim();
  if (!id) return '';
  if (!catalogId) return id;
  return normalizedModelOf({
    providerId: catalogId,
    providerModelId: id,
    raw: { providerModelId: id, providerName },
  }).displayName;
}

/**
 * React 版：节点/卡片要显示模型名时统一用它。
 * （读 store 只为拿 `generalModels` 与连接信息 —— 归一化逻辑本身在 models 层。）
 */
export function useModelDisplayName(modelRef: string | undefined, provider?: string): string {
  const resolve = useModelNameResolver();
  return useMemo(() => resolve(modelRef, provider), [modelRef, provider, resolve]);
}

/**
 * ★ **列表用**：返回一个「引用 → 展示名」的解析函数（可带缓存、可在 `.map` 里调）。
 *
 * 组件里凡是要渲染一串模型名（下拉选项、历史卡片、行标题…）都用它，
 * 不要再读 `model.label` / `model.name` / `entry.model` 之类的原始字段。
 */
export function useModelNameResolver(): (modelRef: string | undefined, provider?: string) => string {
  const generalModels = useAppStore((s) => s.config.generalModels);
  const providers = useAppStore((s) => s.config.providers);
  return useMemo(() => (
    (modelRef: string | undefined, provider?: string) => {
      if (!modelRef) return '';
      const connection = provider ? providers?.[provider] : undefined;
      return displayNameOfModelRef(modelRef, {
        providerId: provider,
        catalogId: connection?.catalogId,
        baseUrl: connection?.baseUrl,
        generalModels,
        providers,
      });
    }
  ), [generalModels, providers]);
}
