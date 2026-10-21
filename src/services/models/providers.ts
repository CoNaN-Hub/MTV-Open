/**
 * 平台解析 —— 「一个连接」→「哪个平台（providerId）」。
 *
 * 为什么需要它：用户自定义连接（土豆这类聚合平台）在 MTV 里 `catalogId` 都是 `custom-openai`，
 * 只有 `baseUrl` 能区分是哪一家。映射表要按**平台**索引（用户写的就是 `providerId: 'tudou'`），
 * 所以这里把 `{ catalogId, baseUrl, connectionKey }` 归一到平台标识。
 *
 * 数据：`src/data/modelProviders.json`（新增平台只改这份配置）。
 */
import RAW from '../../data/modelProviders.json';
import { suffixSpecOfMapping } from './mappings';
import { NO_SUFFIX_SPEC } from './suffix';
import type { ProviderDefinitionConfig, ProviderSuffixSpec } from './types';

interface ProvidersFile {
  _readme?: string[];
  providers: ProviderDefinitionConfig[];
}

const FILE = RAW as unknown as ProvidersFile;

const BY_ID = new Map<string, ProviderDefinitionConfig>();
for (const provider of FILE.providers) {
  if (BY_ID.has(provider.providerId)) throw new Error(`modelProviders.json 里 providerId 重复：${provider.providerId}`);
  BY_ID.set(provider.providerId, provider);
}

export function allProviderConfigs(): readonly ProviderDefinitionConfig[] {
  return FILE.providers;
}

export function getProviderConfig(providerId: string | undefined | null): ProviderDefinitionConfig | null {
  if (!providerId) return null;
  return BY_ID.get(providerId.trim()) ?? null;
}

/** 从 baseUrl 取 host（拿不到就空串）。 */
function hostOf(baseUrl: string | undefined | null): string {
  if (!baseUrl) return '';
  try {
    return new URL(baseUrl).host.toLowerCase();
  } catch {
    /* 用户可能只填了 `api.ai-tudou.net`（没有协议）—— 补一个协议再试 */
    try {
      return new URL(`https://${baseUrl}`).host.toLowerCase();
    } catch {
      return '';
    }
  }
}

export interface ResolveProviderInput {
  /** 连接 key（`config.providers` 的键）。 */
  connectionKey?: string;
  /** 连接配置里的 `catalogId`（内置厂商 = 厂商 id；自定义 = `custom-openai`）。 */
  catalogId?: string;
  baseUrl?: string;
}

/**
 * 归一化到平台标识。匹配顺序：**域名**（最具体）→ catalogId → 连接 key → 原样返回。
 * ⚠️ 域名优先：同一家中转站可能被用户建成 `custom-openai`，只有域名能定位到 `tudou`。
 */
export function resolveProviderId(input: ResolveProviderInput): string {
  const host = hostOf(input.baseUrl);
  if (host) {
    for (const provider of FILE.providers) {
      if (provider.matchHosts?.some((h) => h.toLowerCase() === host)) return provider.providerId;
    }
  }
  const catalogId = (input.catalogId ?? '').trim();
  if (catalogId) {
    for (const provider of FILE.providers) {
      if (provider.catalogIds?.includes(catalogId)) return provider.providerId;
    }
  }
  const key = (input.connectionKey ?? '').trim();
  if (key && BY_ID.has(key)) return key;
  /* 认不出来就原样返回：调用方按「未知平台」处理（不虚构官方名） */
  return catalogId || key || 'unknown';
}

/**
 * 该平台的后缀声明：映射文件里的优先（更贴近该平台的实况），否则用平台定义。
 * 都没有 ⇒ 不识别任何后缀。
 */
export function suffixSpecForProvider(providerId: string): ProviderSuffixSpec {
  return suffixSpecOfMapping(providerId) ?? getProviderConfig(providerId)?.suffixSpec ?? NO_SUFFIX_SPEC;
}

/** 该平台用哪个 Adapter。 */
export function adapterIdForProvider(providerId: string): string {
  return getProviderConfig(providerId)?.adapterId ?? 'openai-compatible';
}

/** 展示用的平台名（管理视图里显示；**不进模型名**）。 */
export function providerLabel(providerId: string): string {
  return getProviderConfig(providerId)?.label ?? providerId;
}
