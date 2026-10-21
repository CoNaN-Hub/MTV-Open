/**
 * 归一化器 —— **全系统唯一**产出 `NormalizedModel` 的地方。
 *
 * 解析优先级（用户 2026 定稿，**严格按序**）：
 *   1. 已验证的**精确映射**：`providerId + providerModelId`
 *   2. 已验证的**平台别名映射**
 *   3. 平台返回的**明确官方模型标识**（`ProviderRawModel.officialModelId`）
 *   4. 通过原厂/版本/上下文/能力/规格等元数据**交叉验证**出的候选
 *      ⇒ 只标 `manual-review`，**displayName 仍是原始平台名**（不冒充官方名）
 *   5. 无法确认 ⇒ `officialName = providerModelId`、`matchStatus = 'unverified'`
 *
 * 禁止凭模型 id 猜一个「看起来合理」的官方名 —— 第 4 档只认**官方 id 归一后精确对上**，
 * 且不给名字。
 *
 * 后缀规则：先按 `baseModelId`（去掉 `async` 等平台规格后缀）匹配；
 * 命中后 `displayName = officialName + ' ' + suffix`；`providerModelId` 原样保留。
 */
import { findCanonicalByOfficialId, findCanonicalCandidateByNormalizedId, getCanonicalModel } from './canonical';
import { findAliasMapping, findExactMapping } from './mappings';
import { resolveProviderId, suffixSpecForProvider, type ResolveProviderInput } from './providers';
import { composeDisplayName, splitSuffix, type SuffixSplit } from './suffix';
import type {
  CanonicalModel, ExecutionMode, MatchStatus, NormalizedModel, NormalizedStatus, ProviderAliasMapping,
  ProviderModelMapping, ProviderRawModel, ProviderSuffixSpec,
} from './types';

export interface NormalizeInput {
  /** 平台标识；不传时会尝试用 `connection` 归一化出来。 */
  providerId?: string;
  /** 平台真实调用 id（**必填**）—— 出站请求用的就是它。 */
  providerModelId: string;
  /** 连接信息（providerId 缺失时用来归一化平台）。 */
  connection?: ResolveProviderInput;
  /** Adapter 解析出来的平台元数据（第 3/4 档会用到）。 */
  raw?: ProviderRawModel | null;
}

/**
 * 解析器依赖（可注入 ⇒ 「改名 / 下线 / 冲突」这些数据态能被测试覆盖，
 * 生产用默认的注册表单例）。
 */
export interface ModelResolverDeps {
  getCanonicalModel: (canonicalId: string | undefined | null) => CanonicalModel | null;
  findCanonicalByOfficialId: (officialId: string | undefined | null) => CanonicalModel | null;
  findCanonicalCandidateByNormalizedId: (value: string | undefined | null) => CanonicalModel | null;
  findExactMapping: (providerId: string, providerModelId: string) => ProviderModelMapping | null;
  findAliasMapping: (providerId: string, alias: string) => ProviderAliasMapping | null;
  suffixSpecForProvider: (providerId: string) => ProviderSuffixSpec;
}

const DEFAULT_DEPS: ModelResolverDeps = {
  getCanonicalModel,
  findCanonicalByOfficialId,
  findCanonicalCandidateByNormalizedId,
  findExactMapping,
  findAliasMapping,
  suffixSpecForProvider,
};

/** 第 4 档「候选」命中的说明文案（待审核视图要显示依据）。 */
function candidateSource(canonical: CanonicalModel, viaSuffix: SuffixSplit, matchedOn: string): string {
  const suffixNote = viaSuffix.suffix ? `（已剥离平台后缀 \`${viaSuffix.suffix}\`）` : '';
  return `候选：id 归一后命中官方 id \`${matchedOn}\`${suffixNote} → ${canonical.canonicalId}；待人工确认`;
}

function statusOf(matchStatus: MatchStatus, canonical: CanonicalModel | null): NormalizedStatus {
  if (canonical?.status === 'deprecated') return 'deprecated';
  return matchStatus === 'verified' ? 'verified' : 'unverified';
}

/** 用一条 canonical 收口结果。 */
function fromCanonical(
  providerId: string,
  providerModelId: string,
  split: SuffixSplit,
  canonical: CanonicalModel,
  matchStatus: MatchStatus,
  source: string | undefined,
): NormalizedModel {
  return {
    providerId,
    providerModelId,
    canonicalId: canonical.canonicalId,
    officialName: canonical.officialName,
    displayName: composeDisplayName(canonical.officialName, split.suffix),
    officialVendor: canonical.officialVendor,
    executionMode: split.executionMode,
    capabilities: canonical.capabilities ?? [],
    status: statusOf(matchStatus, canonical),
    providerSuffix: split.suffix,
    baseModelId: split.baseModelId,
    matchStatus,
    source,
    iconKey: canonical.iconKey,
    officialModelIds: canonical.officialModelIds,
  };
}

/** 兜底：保留原始平台名，标待审核。 */
function fallback(
  providerId: string,
  providerModelId: string,
  split: SuffixSplit,
  matchStatus: MatchStatus,
  source: string,
  raw?: ProviderRawModel | null,
): NormalizedModel {
  /* ⚠️ 这里**绝不**用平台名当官方名（平台名可能是「渠道A-特价」这种）。
     官方名位置放 providerModelId 原文 —— 可核对、可排查；平台名只留在 raw 里做诊断。 */
  return {
    providerId,
    providerModelId,
    canonicalId: undefined,
    officialName: providerModelId,
    displayName: composeDisplayName(providerModelId, split.suffix),
    officialVendor: raw?.officialVendor,
    executionMode: split.executionMode,
    capabilities: raw?.capabilities ?? [],
    status: statusOf(matchStatus, null),
    providerSuffix: split.suffix,
    baseModelId: split.baseModelId,
    matchStatus,
    source,
    officialModelIds: undefined,
  };
}

/**
 * 解析一条模型。**唯一入口。**
 *
 * ⚠️ `providerModelId` 逐字保留（含后缀）；返回的 `displayName` 才是给界面用的。
 */
export function normalizeModel(input: NormalizeInput, deps: ModelResolverDeps = DEFAULT_DEPS): NormalizedModel {
  const providerModelId = (input.providerModelId ?? '').trim();
  const providerId = (input.providerId ?? resolveProviderId(input.connection ?? {})).trim();
  const raw = input.raw ?? null;
  const split = splitSuffix(providerModelId, deps.suffixSpecForProvider(providerId));

  /* ---- 1. 已验证的精确映射 ---- */
  for (const candidateId of [providerModelId, split.baseModelId]) {
    const exact = deps.findExactMapping(providerId, candidateId);
    if (!exact) continue;
    /* 映射可以不给 canonicalId（纯展示覆盖） */
    const canonical = deps.getCanonicalModel(exact.canonicalId);
    const mode: ExecutionMode = exact.executionMode ?? split.executionMode;
    const suffix = exact.providerSuffix ?? split.suffix;
    if (!canonical) {
      return {
        providerId,
        providerModelId,
        canonicalId: exact.canonicalId,
        officialName: providerModelId,
        displayName: exact.displayNameOverride ?? composeDisplayName(providerModelId, suffix),
        executionMode: mode,
        capabilities: [],
        status: statusOf(exact.matchStatus, null),
        providerSuffix: suffix,
        baseModelId: split.baseModelId,
        matchStatus: exact.matchStatus,
        source: exact.source ?? `${providerId}.json 精确映射`,
      };
    }
    const result = fromCanonical(providerId, providerModelId, { ...split, suffix, executionMode: mode }, canonical, exact.matchStatus, exact.source);
    if (exact.displayNameOverride) result.displayName = exact.displayNameOverride;
    return result;
  }

  /* ---- 2. 已验证的平台别名映射 ---- */
  for (const alias of [providerModelId, split.baseModelId]) {
    const hit = deps.findAliasMapping(providerId, alias);
    if (!hit) continue;
    const canonical = deps.getCanonicalModel(hit.canonicalId);
    if (!canonical) break;
    return fromCanonical(providerId, providerModelId, split, canonical, hit.matchStatus, hit.source ?? `别名映射：${alias}`);
  }

  /* ---- 3. 平台返回的明确官方模型标识 ---- */
  if (raw?.officialModelId) {
    const canonical = deps.findCanonicalByOfficialId(raw.officialModelId);
    if (canonical) {
      return fromCanonical(providerId, providerModelId, split, canonical, 'verified', `平台声明 officialModelId=${raw.officialModelId}`);
    }
  }

  /* ---- 3.5 调用 id **本身就等于**官方 id（精确相等，不是相似）----
     ⚠️ 这**不是猜测**：拿上游 id 去官方表做**字符串精确相等**比对，命中即身份相同。
        绝大多数 OpenAI 兼容中转站直接用官方 id 当调用 id；若不做这一档，
        这些模型全都会退化成显示原始 id（功能直接不可用）。
     与第 4 档的区别：第 4 档是**归一化后**相似（分隔符/大小写差异）⇒ 只敢标 manual-review。 */
  for (const probe of [providerModelId, split.baseModelId]) {
    const canonical = deps.findCanonicalByOfficialId(probe);
    if (!canonical) continue;
    return fromCanonical(
      providerId,
      providerModelId,
      split,
      canonical,
      'verified',
      `调用 id 与官方 id 完全一致（${probe}）—— 不属于猜测，但不含人工核对记录`,
    );
  }

  /* ---- 4. 交叉验证候选（只标 manual-review，**不换名字**）---- */
  for (const probe of [split.baseModelId, providerModelId]) {
    const candidate = deps.findCanonicalCandidateByNormalizedId(probe);
    if (!candidate) continue;
    return fallback(providerId, providerModelId, split, 'manual-review', candidateSource(candidate, split, probe), raw);
  }

  /* ---- 5. 兜底：保留原始平台名，标 unverified ---- */
  return fallback(providerId, providerModelId, split, 'unverified', raw?.providerName ? '平台给了名称但无映射，保留原始模型 id' : '无映射，保留原始模型 id', raw);
}

/** 批量归一化（列表用）。 */
export function normalizeModels(inputs: NormalizeInput[], deps: ModelResolverDeps = DEFAULT_DEPS): NormalizedModel[] {
  return inputs.map((input) => normalizeModel(input, deps));
}

/**
 * ⚠️ 去重键 —— **必须是 `providerId + providerModelId`**。
 * 用 `canonicalId` 去重会把同步版与异步版吞成一个（用户明确禁止）。
 */
export function dedupeKey(model: Pick<NormalizedModel, 'providerId' | 'providerModelId'>): string {
  return `${model.providerId}\u0000${model.providerModelId}`;
}

/** 按 `providerId + providerModelId` 去重（保留先出现的），同步/异步各留一条。 */
export function dedupeNormalized(models: NormalizedModel[]): NormalizedModel[] {
  const seen = new Set<string>();
  const out: NormalizedModel[] = [];
  for (const model of models) {
    const key = dedupeKey(model);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(model);
  }
  return out;
}
