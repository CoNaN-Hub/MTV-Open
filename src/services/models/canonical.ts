/**
 * Canonical Model Registry —— 官方模型身份表（只读）。
 *
 * 数据：`src/data/modelCanonical.json`（由官方三表 `official-model-meta.json` /
 * `official-image-models.json` / `official-model-icons.json` 生成 + 人工核对）。
 *
 * 这一层的唯一职责：**canonicalId ↔ 官方名/厂商/能力/官方 id** 的精确查表。
 * ⚠️ 它**不做任何猜测**：给一个乱七八糟的 id 进来只会返回 null（调用方保留原始名）。
 *
 * 为什么要有它：原来 `utils/officialModelDisplay.ts` 与 `utils/imageModelCapabilities.ts`
 * 各写一套「正则族 + `includes` 最长匹配」去猜官方名，两边规则还不一样（官方 id 分隔符不统一、
 * Pro 必须先于 Flash 判、`kling-v3` 会抢到 Kling 2.1 的名字…）。
 * 现在改成：**身份只在映射表里显式登记**，查不到就老实显示原始平台名。
 */
import RAW from '../../data/modelCanonical.json';
import { getCanonicalAdditions } from './overrides';
import type { CanonicalModel, ModelFamily } from './types';

interface CanonicalFile {
  _readme?: string[];
  canonicalModels: CanonicalModel[];
}

const FILE = RAW as unknown as CanonicalFile;

/** canonicalId 形状：小写 `vendor/slug`（只允许 a-z0-9 与 `-`）。 */
const CANONICAL_ID_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidCanonicalId(value: string): boolean {
  return CANONICAL_ID_SHAPE.test(value);
}

/** 归一化一个**官方 id** 用于第 4 档「候选」比对（分隔符不敏感）。**只产出候选，不产出名字。** */
export function normalizeOfficialId(value: string): string {
  return value.trim().toLowerCase().replace(/[._\-\s/]+/g, '-').replace(/^-+|-+$/g, '');
}

const BY_CANONICAL_ID = new Map<string, CanonicalModel>();
/** 官方 id（原样，小写比较）→ canonical */
const BY_OFFICIAL_ID = new Map<string, CanonicalModel>();
/** 归一化官方 id → canonical（第 4 档候选） */
const BY_NORMALIZED_OFFICIAL_ID = new Map<string, CanonicalModel>();

/**
 * 「改名 / 下线」规则的可测版本：由一个 canonical 数组建索引。
 * 生产用 `RAW`；测试用合成数据（例：造一条 `status: 'deprecated'` 验状态推导）。
 */
export interface CanonicalIndex {
  byCanonicalId: Map<string, CanonicalModel>;
  byOfficialId: Map<string, CanonicalModel>;
  byNormalizedOfficialId: Map<string, CanonicalModel>;
  all: CanonicalModel[];
}

export function createCanonicalIndex(models: readonly CanonicalModel[]): CanonicalIndex {
  const byCanonicalId = new Map<string, CanonicalModel>();
  const byOfficialId = new Map<string, CanonicalModel>();
  const byNormalizedOfficialId = new Map<string, CanonicalModel>();
  for (const model of models) {
    if (byCanonicalId.has(model.canonicalId)) {
      throw new Error(`canonicalId 重复：${model.canonicalId}`);
    }
    if (!isValidCanonicalId(model.canonicalId)) {
      throw new Error(`canonicalId 必须是小写 vendor/slug：${model.canonicalId}`);
    }
    byCanonicalId.set(model.canonicalId, model);
    for (const officialId of model.officialModelIds ?? []) {
      const key = officialId.trim().toLowerCase();
      if (!key) continue;
      if (!byOfficialId.has(key)) byOfficialId.set(key, model);
      const normalized = normalizeOfficialId(key);
      if (!byNormalizedOfficialId.has(normalized)) byNormalizedOfficialId.set(normalized, model);
    }
  }
  return { byCanonicalId, byOfficialId, byNormalizedOfficialId, all: [...models] };
}

const INDEX = createCanonicalIndex(FILE.canonicalModels);

/**
 * 运行时**追加**的 canonical（管理面板「创建新的 Canonical Model」）。
 * ⚠️ 只是叠加：同 canonicalId 时**追加层优先**（用户刚建的以用户为准）；
 *    文件里那份仍然是「出厂 Registry」，不受影响。
 */
let additionsCache: { source: readonly CanonicalModel[]; index: CanonicalIndex } | null = null;

function additions(): CanonicalIndex | null {
  const source = getCanonicalAdditions();
  if (source.length === 0) return null;
  if (!additionsCache || additionsCache.source !== source) {
    additionsCache = { source, index: createCanonicalIndex(source) };
  }
  return additionsCache.index;
}
for (const [k, v] of INDEX.byCanonicalId) BY_CANONICAL_ID.set(k, v);
for (const [k, v] of INDEX.byOfficialId) BY_OFFICIAL_ID.set(k, v);
for (const [k, v] of INDEX.byNormalizedOfficialId) BY_NORMALIZED_OFFICIAL_ID.set(k, v);

/** 全部 canonical 模型（管理视图 / 测试用）。 */
export function allCanonicalModels(): readonly CanonicalModel[] {
  const extra = additions();
  return extra ? [...extra.all, ...INDEX.all] : INDEX.all;
}

export function getCanonicalModel(canonicalId: string | undefined | null): CanonicalModel | null {
  if (!canonicalId) return null;
  const id = canonicalId.trim();
  return additions()?.byCanonicalId.get(id) ?? BY_CANONICAL_ID.get(id) ?? null;
}

/** 精确按**官方 id** 找（大小写不敏感，值本身逐字保留）。 */
export function findCanonicalByOfficialId(officialId: string | undefined | null): CanonicalModel | null {
  if (!officialId) return null;
  const key = officialId.trim().toLowerCase();
  return additions()?.byOfficialId.get(key) ?? BY_OFFICIAL_ID.get(key) ?? null;
}

/**
 * 第 4 档「交叉验证候选」：官方 id 去掉分隔符差异后能对上的 candidate。
 * ⚠️ 调用方**只能**据此标记 `manual-review`，**不得**用它的名字当官方名。
 */
export function findCanonicalCandidateByNormalizedId(value: string | undefined | null): CanonicalModel | null {
  if (!value) return null;
  const key = normalizeOfficialId(value);
  return additions()?.byNormalizedOfficialId.get(key) ?? BY_NORMALIZED_OFFICIAL_ID.get(key) ?? null;
}

/** 该 canonical 的族（capabilities 第 0 项就是族，见生成脚本）。 */
export function familyOf(model: CanonicalModel | null | undefined): ModelFamily | null {
  const first = model?.capabilities?.[0];
  return (first as ModelFamily | undefined) ?? null;
}
