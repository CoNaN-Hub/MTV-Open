/**
 * 用户映射覆盖层 —— 「模型映射」管理面板的**写入口**。
 *
 * 为什么需要它：`src/data/modelMappings/*.json` 与 `modelCanonical.json` 是**构建期配置**
 * （随应用发布、可版本管理）。管理面板要能「保存映射 / 标记已验证 / 关联或新建 canonical /
 * 解除映射」，就必须有一个**运行时可写**的层，落点选 `config`（本机持久化）。
 *
 * 分层（读取时叠加，**写在文件之前的顺序**）：
 *   `config.modelMappingOverrides`  →  覆盖同 `providerId + providerModelId` 的文件条目
 *   `config.modelCanonicalAdditions` →  追加/覆盖 canonical 条目
 *
 * ⚠️ 本模块**不碰** Provider Adapter、调用链与合同构造 —— 它只影响「身份与展示名怎么解析」。
 * ⚠️ 反过来，`mappings.ts` / `canonical.ts` 是**纯模块**（不 import store）
 *    ⇒ 由 store 侧调用 `syncMappingOverrides()` / `syncCanonicalAdditions()` 把快照推进来。
 */
import type { CanonicalModel, ProviderModelMapping } from './types';

let mappingSnapshot: readonly ProviderModelMapping[] = [];
let canonicalSnapshot: readonly CanonicalModel[] = [];

/** `config.modelMappingOverrides` 变了就推一次（store 的 updateConfig 里调）。 */
export function syncMappingOverrides(list?: readonly ProviderModelMapping[] | null): void {
  mappingSnapshot = list ?? [];
}

/** `config.modelCanonicalAdditions` 变了就推一次。 */
export function syncCanonicalAdditions(list?: readonly CanonicalModel[] | null): void {
  canonicalSnapshot = list ?? [];
}

export function getMappingOverrides(): readonly ProviderModelMapping[] {
  return mappingSnapshot;
}

export function getCanonicalAdditions(): readonly CanonicalModel[] {
  return canonicalSnapshot;
}

/** 测试用：清空（避免用例之间互相污染）。 */
export function resetModelOverridesForTest(): void {
  mappingSnapshot = [];
  canonicalSnapshot = [];
}

/**
 * 覆盖的优先级规则：**同 key 时运行时覆盖文件**，不同 key 时两边都在。
 * 返回的 Map 以 `providerId\0providerModelId` 为键。
 */
export function overrideMap(): Map<string, ProviderModelMapping> {
  const map = new Map<string, ProviderModelMapping>();
  for (const mapping of mappingSnapshot) {
    map.set(`${mapping.providerId}\u0000${mapping.providerModelId}`, mapping);
  }
  return map;
}
