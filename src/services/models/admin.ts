/**
 * 映射管理视图的数据源 —— 「设置 → 模型映射」用它出表。
 *
 * 视图要显示（用户指定）：Provider / 原始模型名称 / 调用 ID / 官方展示名 /
 * canonicalId / 执行模式 / 映射状态 / 映射依据 / 更新时间。
 * 并对**未映射 / 冲突 / 下线 / 元数据变化**给出「待审核」标记。
 *
 * ★ 行的来源 = **已拉取模型目录 ∪ 现有映射数据**（2026 修复「重新拉取厂商模型后新模型不出现」）：
 *   ① 映射数据：`src/data/modelMappings/*.json` + 运行时覆盖层（`listExactMappings()`）；
 *   ② 目录数据：调用方把 `config.providers[*]` 的 `catalogModels` / `selectedModels`
 *      摊平成 `CatalogModelEntry[]`（见 `./catalog.ts`）传进来 —— **目录里有、映射表里没有的
 *      模型会新增一行**（同一套归一化器 → `canonicalId` 空、状态「待审核」、依据「未建立官方映射」）。
 *   ③ 映射表里有、目录里没有的条目**一律保留**（删了不能丢数据），只多标一个 `catalogStatus: 'absent'`。
 *
 * 官方证据（2026 查证）：官方 bundle 里 `映射` / `模型映射` / `canonicalId` / `providerModelId`
 * 全是 **0 次** ⇒ 官方未建模。这里「按 MTV 现有映射机制等价表达」：不新增第二套身份规则，
 * 新行与既有行走**同一个** `normalizeModel()`，只是把「厂商目录里实际存在的模型」并入行集合。
 *
 * ⚠️ 这里只读配置与 Registry，不碰 store / UI —— 保证「新增平台只加配置，不改 UI」。
 */
import { allCanonicalModels, getCanonicalModel } from './canonical';
import type { CatalogModelEntry } from './catalog';
import { listExactMappings, listMappingProviderIds } from './mappings';
import { normalizeModel } from './normalize';
import { providerLabel, suffixSpecForProvider } from './providers';
import type { ExecutionMode, MatchStatus, NormalizedStatus, ProviderModelMapping } from './types';

/** 待审核原因（可叠加）。 */
export type ReviewReason =
  /** 完全没映射 —— 界面显示原始平台 id */
  | 'unmapped'
  /** 有候选但没人工确认（`manual-review`） */
  | 'manual-review'
  /** 只有 MTV 策划名（未与官方表核对） */
  | 'planned-name-only'
  /** 官方模型已下线 */
  | 'deprecated'
  /** 映射登记时间早于官方表变更时间 —— 需要复核 */
  | 'metadata-stale';

export interface MappingRow {
  providerId: string;
  providerLabel: string;
  /** 平台给的原始模型名（`ProviderModelSelection.name` 一类）—— 只作排障 */
  providerModelName?: string;
  /** ★ 出站调用 id（原样发） */
  providerModelId: string;
  canonicalId?: string;
  /** 官方名（没有就空） */
  officialName: string;
  /** ★ 界面唯一显示的名字 */
  displayName: string;
  officialVendor?: string;
  executionMode: ExecutionMode;
  providerSuffix?: string;
  matchStatus: MatchStatus;
  status: NormalizedStatus;
  source?: string;
  updatedAt?: string;
  /** 该平台声明的执行规格后缀（管理视图用来解释 `async` 的来源） */
  declaredSuffixes: string[];
  review: ReviewReason[];
  /**
   * ★ 这一行**只**来自已拉取模型目录（映射表里没有登记）—— 「重新拉取厂商模型」后新增的行。
   *   它与映射行走同一个归一化器，所以形态完全一致（没有官方身份时 `canonicalId` 为空、
   *   状态「待审核」、依据「未建立官方映射」），只是没有 `source` / `updatedAt`。
   */
  fromCatalog?: boolean;
  /**
   * ★ 目录比对结果（同一个 providerId 的目录**拉过**才有意义）：
   *   · `present` —— 目录里有这条模型；
   *   · `absent`  —— 该平台目录拉过，但里面**没有**这条（已下架/改名）。行照旧保留，只做标注；
   *   · `undefined` —— 该平台没有目录数据（旧配置/没拉过）⇒ 无从比对，不标注。
   */
  catalogStatus?: 'present' | 'absent';
}

/** 目录索引：providerId → 该平台目录里出现过的调用 id。`Map` 里没有该平台 = 没拉过目录。 */
function catalogIndex(catalog: readonly CatalogModelEntry[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const entry of catalog) {
    const id = (entry.providerModelId ?? '').trim();
    if (!id) continue;
    let ids = index.get(entry.providerId);
    if (!ids) {
      ids = new Set();
      index.set(entry.providerId, ids);
    }
    ids.add(id);
  }
  return index;
}

function reviewOf(row: Omit<MappingRow, 'review'>): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (!row.canonicalId) reasons.push(row.displayName === row.providerModelId ? 'unmapped' : 'planned-name-only');
  if (row.matchStatus === 'manual-review') reasons.push('manual-review');
  if (row.status === 'deprecated') reasons.push('deprecated');
  if (row.canonicalId) {
    const canonical = getCanonicalModel(row.canonicalId);
    if (canonical?.updatedAt && row.updatedAt && canonical.updatedAt > row.updatedAt) reasons.push('metadata-stale');
  }
  return reasons;
}

/**
 * 一行（映射数据 / 目录数据共用同一条构造路径）。
 *
 * ★ 身份一律过 `normalizeModel()` —— 系统里**唯一**产出 `NormalizedModel` 的地方。
 *   所以「目录里有、映射表里没有」的新行与「映射表里登记过」的行形态完全一致：
 *   没映射上 ⇒ `canonicalId` 空 + `displayName` = 平台原始 id + 状态「待审核」；
 *   若调用 id 恰好等于官方 id（归一化第 3.5 档，查表不是猜）⇒ 直接给出官方身份。
 */
function buildRow(input: {
  providerId: string;
  providerModelId: string;
  mapping?: ProviderModelMapping;
  providerModelName?: string;
  declaredSuffixes: string[];
  fromCatalog?: boolean;
  catalogStatus?: 'present' | 'absent';
}): MappingRow {
  const { providerId, mapping, declaredSuffixes } = input;
  const normalized = normalizeModel({
    providerId,
    providerModelId: input.providerModelId,
    /* 目录条目带平台原始名 ⇒ 归一化第 5 档的「依据」能写清楚（不影响身份判定） */
    raw: input.providerModelName ? { providerModelId: input.providerModelId, providerName: input.providerModelName } : null,
  });
  const base: Omit<MappingRow, 'review'> = {
    providerId,
    providerLabel: providerLabel(providerId),
    providerModelName: mapping?.providerModelName ?? input.providerModelName,
    providerModelId: normalized.providerModelId,
    canonicalId: normalized.canonicalId,
    officialName: normalized.canonicalId ? normalized.officialName : '',
    displayName: normalized.displayName,
    officialVendor: normalized.officialVendor,
    executionMode: normalized.executionMode,
    providerSuffix: normalized.providerSuffix,
    matchStatus: normalized.matchStatus,
    status: normalized.status,
    source: mapping?.source,
    updatedAt: mapping?.updatedAt,
    declaredSuffixes,
    fromCatalog: input.fromCatalog,
    catalogStatus: input.catalogStatus,
  };
  return { ...base, review: reviewOf(base) };
}

/**
 * 一张表：所有平台的映射条目（含未命中的兜底行）**∪**已拉取模型目录里的模型。
 *
 * @param catalog 已拉取模型目录（`catalogEntriesOfProviders(config.providers)`）。
 *                **不传 = 只看映射数据**（旧行为；导出/契约测试与 `mappingStats()` 的旧调用点不受影响）。
 *
 * 合并规则（键恒为 `providerId + providerModelId`）：
 *   1. 先铺映射数据（文件 + 运行时覆盖，已排除「解除映射」的条目）；
 *   2. 再铺目录里**没有映射登记**的模型 —— 新增行，`fromCatalog: true`；
 *   3. 同一个键以映射数据为准（映射里的人工结论/备注不会被目录覆盖）；
 *   4. 最后按 `providerId + providerModelId` 稳定排序（与旧行为一致），同步/异步天然两条。
 */
export function listMappingRows(catalog: readonly CatalogModelEntry[] = []): MappingRow[] {
  const rows: MappingRow[] = [];
  const index = catalogIndex(catalog);
  const seen = new Set<string>();
  for (const providerId of listMappingProviderIds()) {
    const declaredSuffixes = suffixSpecForProvider(providerId).suffixes.map((s) => s.toLowerCase());
    const pulled = index.get(providerId);
    for (const mapping of listExactMappings(providerId)) {
      const key = `${providerId}\u0000${mapping.providerModelId}`;
      seen.add(key);
      rows.push(buildRow({
        providerId,
        providerModelId: mapping.providerModelId,
        mapping,
        declaredSuffixes,
        /* 只有「这家平台的目录拉过」才谈得上 present/absent，否则不标注 */
        catalogStatus: pulled ? (pulled.has(mapping.providerModelId.trim()) ? 'present' : 'absent') : undefined,
      }));
    }
  }
  /* ★ 目录新增行：映射表里没有登记过的模型 —— 这就是「重新拉取厂商模型后新模型不出现」的修复点。 */
  for (const entry of catalog) {
    const providerId = entry.providerId;
    const providerModelId = (entry.providerModelId ?? '').trim();
    if (!providerId || !providerModelId) continue;
    const key = `${providerId}\u0000${providerModelId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(buildRow({
      providerId,
      providerModelId,
      providerModelName: entry.providerModelName,
      declaredSuffixes: suffixSpecForProvider(providerId).suffixes.map((s) => s.toLowerCase()),
      fromCatalog: true,
      catalogStatus: 'present',
    }));
  }
  return rows.sort((a, b) => (
    a.providerId.localeCompare(b.providerId) || a.providerModelId.localeCompare(b.providerModelId)
  ));
}

/** 待审核条目（未映射 / 待人工确认 / 只登记了策划名 / 下线 / 元数据过期 / 冲突）。 */
export function listReviewRows(catalog: readonly CatalogModelEntry[] = []): MappingRow[] {
  return listMappingRows(catalog).filter((row) => row.review.length > 0);
}

/** 冲突检测：同一个 `providerId + providerModelId` 不许有两条（构建期已抛，这里给视图兜一层）。 */
export function listMappingConflicts(): Array<{ providerId: string; providerModelId: string; count: number }> {
  const seen = new Map<string, number>();
  for (const providerId of listMappingProviderIds()) {
    for (const mapping of listExactMappings(providerId)) {
      const key = `${providerId}\u0000${mapping.providerModelId}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [providerId, providerModelId] = key.split('\u0000');
      return { providerId, providerModelId, count };
    });
}

export interface MappingStats {
  providers: number;
  total: number;
  verified: number;
  manualReview: number;
  unverified: number;
  deprecated: number;
  review: number;
  canonicalModels: number;
  /** 已声明执行规格后缀的平台数（说明 async 这类后缀是配置来的） */
  providersWithSuffix: number;
}

/**
 * 统计（页面右上角「已验证 X · 待审核 Y · Provider Z」）——**必须与列表用同一份 rows**，
 * 否则会出现「表里多了一行、数字还是老的」。
 */
export function mappingStats(catalog: readonly CatalogModelEntry[] = []): MappingStats {
  const rows = listMappingRows(catalog);
  const withSuffix = new Set(rows.filter((r) => r.declaredSuffixes.length > 0).map((r) => r.providerId));
  return {
    /* ★ 平台数取**行里实际出现的** providerId —— 目录新增行也可能带进一个新平台 */
    providers: new Set(rows.map((r) => r.providerId)).size,
    total: rows.length,
    verified: rows.filter((r) => r.matchStatus === 'verified').length,
    manualReview: rows.filter((r) => r.matchStatus === 'manual-review').length,
    unverified: rows.filter((r) => r.matchStatus === 'unverified').length,
    deprecated: rows.filter((r) => r.status === 'deprecated').length,
    review: rows.filter((r) => r.review.length > 0).length,
    canonicalModels: allCanonicalModels().length,
    providersWithSuffix: withSuffix.size,
  };
}

/** 某个 canonical 被哪些平台映射（排障：改官方名会影响谁）。 */
export function mappingsForCanonical(canonicalId: string, catalog: readonly CatalogModelEntry[] = []): MappingRow[] {
  return listMappingRows(catalog).filter((row) => row.canonicalId === canonicalId);
}
