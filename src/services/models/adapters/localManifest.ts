/**
 * Adapter: 本地清单厂商（xAI / Google / Sora2U / RunningHub / 即梦 / 火山方舟 / 工作流 API）。
 *
 * 这些厂商的模型清单**随应用发布**（各自的 `*ModelManifest.ts`），不通过 `/models` 拉，
 * 所以 Adapter 不做远端拉取；它负责：
 *   · 鉴权（Bearer）；
 *   · 解析清单条目为 `ProviderRawModel`（**保留平台原始 id**）；
 *   · 平台专属的请求/响应转换各自由自己的执行链路负责（`modelProtocolRuntime` / `runninghubMedia` …），
 *     本 Adapter 不重复实现，只把**身份**归一化。
 */
import { bearerAuth } from './openaiCompatible';
import type { ProviderAdapter, ProviderRawModel } from '../types';

/** 本地清单条目：`{ id|modelId, label|name, category, kind, ... }` */
export interface LocalManifestEntry {
  id?: unknown;
  modelId?: unknown;
  label?: unknown;
  name?: unknown;
  kind?: unknown;
  category?: unknown;
  aliases?: unknown;
  official_model?: unknown;
  officialModelId?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseLocalManifestModel(raw: unknown): ProviderRawModel | null {
  const item = raw as LocalManifestEntry | null;
  const providerModelId = asString(item?.id) ?? asString(item?.modelId);
  if (!providerModelId) return null;
  return {
    providerModelId,
    providerName: asString(item?.label) ?? asString(item?.name),
    aliases: Array.isArray(item?.aliases)
      ? item.aliases.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      : undefined,
    officialModelId: asString(item?.official_model) ?? asString(item?.officialModelId),
    category: asString(item?.category) ?? asString(item?.kind),
    raw,
  };
}

export function createLocalManifestAdapter(providerId: string, label: string): ProviderAdapter {
  return {
    id: providerId,
    label,
    suffixSpec: { separator: '-', suffixes: [] },
    buildAuth: ({ apiKey }) => bearerAuth(apiKey),
    parseModel: parseLocalManifestModel,
  };
}
