/**
 * 「已拉取模型目录」→ 映射视图的行来源（纯函数，不读 store）。
 *
 * 为什么需要它：`services/models/admin.ts` 的 `listMappingRows()` 只从**映射登记表**出表
 * （`src/data/modelMappings/*.json` + 运行时覆盖层），完全不知道用户在「连接设置」里
 * 重新拉取过厂商目录（`/v1/models`）—— 于是**新拉到的模型永远不出现在「模型映射」页**，
 * 看起来像「表格固定死了」。这里把 `config.providers[*]` 的目录字段摊平成
 * `CatalogModelEntry[]`，由调用方交给 `listMappingRows(catalog)` 做并集。
 *
 * 数据来源（`types/index.ts` 的 `ApiProviderConfig`）：
 *   · `catalogModels`  —— 最近一次拉取的**完整**目录（落库有上限，见 providerCatalogService）
 *   · `selectedModels` —— 用户在该连接里明确启用的模型（旧配置可能只有这一份）
 * 两者取并集再按 `providerId + providerModelId` 去重：**任一来源里存在 = 目录里存在**。
 *
 * ⚠️ 连接 key ≠ 平台标识（`custom-2611fc0a` vs `tudou`）—— 必须过
 *    `resolveProviderId()`（域名 → catalogId → 连接 key），与映射表/覆盖层的索引口径一致。
 * ⚠️ 本模块**不**改写任何调用逻辑：只决定「映射管理页列哪些行」。
 *
 * 官方证据（2026 查证，先查后写）：
 *   · 官方 TapNow 全量 bundle（`D:\DEEPSEEK\_official-interactions\bundles-live\index-CXggDgfF.js`，
 *     13,052,674 B）里 `映射` / `模型映射` / `canonicalId` / `providerModelId` / `别名` / `厂商`
 *     全部 **0 次** ⇒ 官方**没有建模**「模型映射」这张表（也搜不到对应的静态映射表）。
 *   · 官方能引的等价语义只有两条，且都是「运行时实际存在什么就列什么」：
 *     ① 账号可见的模型清单来自运行时数据而不是冻结数组 ——
 *        @byteOffset 6,475,202 `Kds=t=>(Array.isArray(t.models)?t.models:[]).filter(...)`、
 *        @byteOffset 6,475,457 `Xds=(t,e=Date.now())=>Array.from(new Set(t.filter(n=>YMa(n,e)).flatMap(Kds))).sort()`；
 *     ② 身份/展示名由 code-shipped registry 按官方 id 查表给出 ——
 *        @byteOffset 6,838,993 `function Dgs(t){const e=Ngs(t);return e?Lh[e].name:null}`。
 *   ⇒ 本页按 **MTV 现有映射机制等价表达**：行的来源 = 已拉取目录 ∪ 现有映射数据，
 *     身份判定仍然只走 `normalizeModel()` 那一个出口。
 */
import type { ApiProviderConfig } from '../../types';
import { resolveProviderId } from './providers';

/** 目录里的一条模型（映射视图只需要身份三件套）。 */
export interface CatalogModelEntry {
  /** 平台标识（已归一化，例 `tudou`）—— 行的稳定键的一半。 */
  providerId: string;
  /** 平台真实调用 id（出站原样发）。 */
  providerModelId: string;
  /** 平台自己给的名字（只作排障/候选，不上界面主展示名）。 */
  providerModelName?: string;
}

/**
 * 把 `config.providers` 摊平成目录条目（按 `providerId + providerModelId` 去重）。
 *
 * 返回顺序 = 连接在 config 里的顺序 + 该连接目录里的顺序；`listMappingRows` 最后会统一排序，
 * 所以这里不排序（保持可预测、不额外分配）。
 */
export function catalogEntriesOfProviders(
  providers: Record<string, ApiProviderConfig> | undefined | null,
): CatalogModelEntry[] {
  if (!providers) return [];
  const out = new Map<string, CatalogModelEntry>();
  for (const [connectionKey, connection] of Object.entries(providers)) {
    if (!connection) continue;
    const providerId = resolveProviderId({
      connectionKey,
      catalogId: connection.catalogId,
      baseUrl: connection.baseUrl,
    });
    if (!providerId) continue;
    /* 完整目录优先，再补用户启用的那批（旧配置可能没有 catalogModels） */
    for (const model of [...(connection.catalogModels ?? []), ...(connection.selectedModels ?? [])]) {
      const id = (model?.id ?? '').trim();
      if (!id) continue;
      const key = `${providerId}\u0000${id}`;
      if (out.has(key)) continue;
      out.set(key, { providerId, providerModelId: id, providerModelName: model.name });
    }
  }
  return [...out.values()];
}
