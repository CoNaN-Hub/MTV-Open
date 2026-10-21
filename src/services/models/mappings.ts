/**
 * 映射表加载 —— `src/data/modelMappings/<providerId>.json`（一平台一文件，可版本管理）。
 *
 * 索引：
 *   · `EXACT[providerId][providerModelId]` —— 解析优先级第 1 档（最高）
 *   · `ALIAS[providerId][alias]` / `ALIAS['*'][alias]` —— 第 2 档
 *
 * ⚠️ 新增平台 = 新增一个 JSON 文件，**不改任何代码**（`import.meta.glob` 自动收录）。
 */
import { getMappingOverrides, overrideMap } from './overrides';
import type { ProviderAliasMapping, ProviderMappingFile, ProviderModelMapping, ProviderSuffixSpec } from './types';

const MODULES = import.meta.glob('../../data/modelMappings/*.json', { eager: true }) as Record<string, unknown>;

/** 文件名 → providerId（约定：文件名就是平台标识）。 */
function providerIdFromPath(path: string): string {
  return path.split('/').pop()!.replace(/\.json$/, '');
}

const FILES = new Map<string, ProviderMappingFile>();
const EXACT = new Map<string, Map<string, ProviderModelMapping>>();
const ALIAS = new Map<string, Map<string, ProviderAliasMapping>>();
const SUFFIX_SPEC = new Map<string, ProviderSuffixSpec>();

for (const [path, mod] of Object.entries(MODULES)) {
  const file = ((mod as { default?: unknown }).default ?? mod) as ProviderMappingFile;
  const fallbackId = providerIdFromPath(path);
  const providerId = (file.providerId ?? fallbackId).trim();
  if (!providerId) throw new Error(`映射文件缺少 providerId：${path}`);
  if (providerId !== fallbackId) {
    throw new Error(`映射文件名与 providerId 不一致：${path} 里写的是 ${providerId}`);
  }
  if (FILES.has(providerId)) throw new Error(`映射表重复：${providerId}`);

  FILES.set(providerId, file);
  if (file.suffixSpec) SUFFIX_SPEC.set(providerId, file.suffixSpec);

  const exact = new Map<string, ProviderModelMapping>();
  for (const mapping of file.mappings ?? []) {
    if (mapping.providerId !== providerId) {
      throw new Error(`${providerId}.json 里有一条 providerId=${mapping.providerId} 的映射（应为 ${providerId}）`);
    }
    const key = mapping.providerModelId.trim();
    if (!key) throw new Error(`${providerId}.json 有空 providerModelId`);
    /* 同一个 providerModelId 只能有一条映射 —— 冲突必须在构建期炸掉，不能运行时挑一条。
       ⚠️ 但**同步与异步是两个 providerModelId**（`x` 与 `x-async`）⇒ 天然不冲突。 */
    if (exact.has(key)) {
      throw new Error(`${providerId}.json 里 providerModelId 冲突：${key}`);
    }
    if (mapping.matchStatus === 'verified' && !mapping.source) {
      throw new Error(`${providerId}.json 的 verified 映射缺 source：${key}`);
    }
    exact.set(key, mapping);
  }
  EXACT.set(providerId, exact);

  const alias = new Map<string, ProviderAliasMapping>();
  for (const entry of file.aliases ?? []) {
    const key = entry.alias.trim().toLowerCase();
    if (!key) throw new Error(`${providerId}.json 有空 alias`);
    if (alias.has(key)) throw new Error(`${providerId}.json 里 alias 冲突：${key}`);
    alias.set(key, entry);
  }
  ALIAS.set(providerId, alias);
}

/**
 * 运行时覆盖的索引（懒建；overrides.ts 的快照换引用就重建）。
 * 管理面板改过的映射以 config 为准，文件配置是「出厂默认」。
 */
let overrideCache: { source: readonly ProviderModelMapping[]; map: Map<string, ProviderModelMapping> } | null = null;

function runtimeOverrides(): Map<string, ProviderModelMapping> {
  const source = getMappingOverrides();
  if (!overrideCache || overrideCache.source !== source) {
    overrideCache = { source, map: overrideMap() };
  }
  return overrideCache.map;
}

/**
 * 「解除映射」的落点：把文件配置里的条目**屏蔽掉**（不改文件）。
 * 键是 providerId + 分隔符 + providerModelId。
 */
let removedSnapshot: readonly string[] = [];

/** 同步「已解除映射」清单（store 侧推入，来源同样是 config）。 */
export function syncRemovedMappings(list?: readonly string[] | null): void {
  removedSnapshot = list ?? [];
}

export function isMappingRemoved(providerId: string, providerModelId: string): boolean {
  return removedSnapshot.includes(`${providerId}\u0000${providerModelId}`);
}

/** 该平台有没有映射表（管理视图标「未配置映射」用）。 */
export function hasMappingFile(providerId: string): boolean {
  return FILES.has(providerId);
}

export function listMappingProviderIds(): string[] {
  return [...FILES.keys()].sort();
}

export function getMappingFile(providerId: string): ProviderMappingFile | null {
  return FILES.get(providerId) ?? null;
}

/**
 * 第 1 档：已验证的精确映射（providerId + providerModelId）。
 * ⚠️ 运行时覆盖优先于文件配置（管理面板改过的以 config 为准）；
 *    被「解除映射」屏蔽掉的条目**在这里也要挡住** —— 否则 `normalizeModel` 的第 1 档
 *    仍会用文件条目给出身份，管理面板的「解除映射」就形同虚设。
 */
export function findExactMapping(providerId: string, providerModelId: string): ProviderModelMapping | null {
  const id = providerModelId.trim();
  if (isMappingRemoved(providerId, id)) return null;
  const runtime = runtimeOverrides().get(`${providerId}\u0000${id}`);
  if (runtime) return runtime;
  return EXACT.get(providerId)?.get(id) ?? null;
}

/**
 * 该平台声明的全部精确映射（管理视图列表用，含未命中的）。
 * ⚠️ 合并运行时覆盖；被「解除映射」屏蔽掉的条目会从结果里去掉。
 */
export function listExactMappings(providerId: string): ProviderModelMapping[] {
  const merged = new Map<string, ProviderModelMapping>();
  for (const mapping of EXACT.get(providerId)?.values() ?? []) merged.set(mapping.providerModelId, mapping);
  for (const mapping of runtimeOverrides().values()) {
    if (mapping.providerId !== providerId) continue;
    merged.set(mapping.providerModelId, mapping);
  }
  for (const key of removedSnapshot) {
    if (!key.startsWith(`${providerId}\u0000`)) continue;
    merged.delete(key.slice(providerId.length + 1));
  }
  return [...merged.values()];
}

/** 第 2 档：平台别名（先查本平台，再查 `*` 通用）。 */
export function findAliasMapping(providerId: string, alias: string): ProviderAliasMapping | null {
  const key = alias.trim().toLowerCase();
  if (!key) return null;
  return ALIAS.get(providerId)?.get(key) ?? ALIAS.get('*')?.get(key) ?? null;
}

/** 映射文件里覆盖的后缀声明（优先于 `modelProviders.json`）。 */
export function suffixSpecOfMapping(providerId: string): ProviderSuffixSpec | undefined {
  return SUFFIX_SPEC.get(providerId);
}
