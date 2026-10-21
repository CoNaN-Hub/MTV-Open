/**
 * 通用 Adapter 基座 —— 把「所有开放兼容平台都一样」的那几件事抽出来复用：
 *   ① 鉴权（Bearer）
 *   ② 拉模型列表（`GET {baseUrl}/models`）
 *   ③ 解析平台原始条目
 *
 * ⚠️ 这里**不放任何平台专属规则**：平台特有的东西写在 `adapters/<providerId>.ts`。
 */
import { baseUrlCandidates } from '../../ai/providerBaseUrl';
import type { ProviderAdapter, ProviderRawModel } from '../types';

/** `openai-compatible` 的条目形状。不同中转站字段略有出入，这里逐个容错。 */
export interface OpenAiCompatibleModelEntry {
  id?: unknown;
  name?: unknown;
  display_name?: unknown;
  aliases?: unknown;
  owned_by?: unknown;
  category?: unknown;
  capabilities?: unknown;
  /** 少数平台会明确给出「原厂模型 id」—— 第一手官方身份线索（解析优先级第 3 档）。 */
  official_model?: unknown;
  officialModelId?: unknown;
  base_model?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim());
  return list.length ? list : undefined;
}

/** 解析一条开放兼容条目。**只解析事实，不做任何名称推断。** */
export function parseOpenAiCompatibleModel(raw: unknown): ProviderRawModel | null {
  const item = raw as OpenAiCompatibleModelEntry | null;
  const providerModelId = asString(item?.id);
  if (!providerModelId) return null;
  return {
    providerModelId,
    /* 平台的显示名可能是渠道名/套餐名 ⇒ 只作诊断与候选，**绝不直接上 UI** */
    providerName: asString(item?.name) ?? asString(item?.display_name),
    aliases: asStringList(item?.aliases),
    officialModelId: asString(item?.official_model) ?? asString(item?.officialModelId) ?? asString(item?.base_model),
    officialVendor: asString(item?.owned_by),
    capabilities: asStringList(item?.capabilities),
    category: asString(item?.category),
    raw,
  };
}

export function bearerAuth(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

/**
 * 拉模型列表。复用既有 `baseUrlCandidates`（它会补 `/v1`、去尾斜杠等），
 * 保证与 `providerCatalogService` 的既有行为一致。
 */
export async function fetchOpenAiCompatibleModels(ctx: {
  baseUrl?: string; apiKey?: string; signal?: AbortSignal;
}): Promise<unknown[]> {
  if (!ctx.baseUrl) return [];
  let lastError: unknown;
  for (const candidate of baseUrlCandidates(ctx.baseUrl)) {
    try {
      const response = await fetch(`${candidate.replace(/\/+$/, '')}/models`, {
        headers: bearerAuth(ctx.apiKey),
        signal: ctx.signal,
      });
      if (!response.ok) { lastError = new Error(`HTTP ${response.status}`); continue; }
      const payload = (await response.json()) as { data?: unknown };
      return Array.isArray(payload?.data) ? payload.data : [];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('拉取模型列表失败');
}

/** 造一个通用 Adapter（平台自身没有额外规则时直接用）。 */
export function createOpenAiCompatibleAdapter(providerId: string, label: string): ProviderAdapter {
  return {
    id: providerId,
    label,
    suffixSpec: { separator: '-', suffixes: [] },
    buildAuth: ({ apiKey }) => bearerAuth(apiKey),
    fetchModels: (ctx) => fetchOpenAiCompatibleModels(ctx),
    parseModel: parseOpenAiCompatibleModel,
  };
}
