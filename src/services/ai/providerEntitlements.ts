/**
 * providerEntitlements —— 连接级「分组权益层」。
 *
 * ## ⚠️ 这是 MTV 增强，**不是官方对齐**
 *
 * 已用官方原文取证：官方读的是**账号级** `isPayingCustomer`
 * （`stripev2("customer/paying-status")`）；**官方侧没有任何读 `enable_groups` /
 * `usable_group` / `group_ratio` 的代码（NOT FOUND）**。
 * 也就是说「这条连接 / 这个 key 在上游能用哪些模型、属于哪个分组、折扣多少」
 * 在官方产品里**根本没有对应实现** —— 本模块是 MTV 自己加的能力，
 * **不许**在任何地方把它描述成「官方有此能力」。
 *
 * ## 数据来源分层（两层，不许混为一谈）
 *
 * | 层 | 端点 | 鉴权 | 回答什么 |
 * |---|---|---|---|
 * | ① 权威可用清单 | `GET {baseUrl}/models`（OpenAI 兼容标准端点） | **本连接的 key** | 「这个 key 到底能调用哪些模型」 |
 * | ② 价目 / 分组元数据 | `GET {origin}/api/pricing`（new-api 系） | **匿名** | 「上游有哪些厂商、哪些分组、倍率多少、每个模型对哪些分组开放」 |
 *
 * ★★ **`/api/pricing` 里有售 ≠ 该 key 可用** ★★
 *   价目表是**全站公开**的，不认 key。判「能不能用」**只认 ①**；
 *   ② 只用来**解释原因**（该模型对哪些分组开放、被哪个分组门挡住）与**算折扣**。
 *
 * ## 生命周期（为什么不默认发网络请求）
 *   · 数据由 `providerCatalogService.fetchProviderModelCatalog` 在**用户主动刷新模型目录**时
 *     顺带取回（同一次匿名 `/api/pricing` 请求，**不额外发请求**）；
 *   · 取回后记进本模块的**连接级内存缓存**（key = 连接 id，即 `Object.keys(config.providers)`）；
 *   · 任何失败 / 字段缺失 ⇒ **静默**，缓存里什么都不记 ⇒ 上层退回现状（**不阻断**）；
 *   · 进程重启后缓存为空 ⇒ 没数据 ⇒ 同样**不阻断**（与「官方有、MTV 无数据源 ⇒ 不阻断」同一条纪律）。
 *
 * ⚠️ **刻意不写进 `AppConfig`**：`store.config.ts` 用 `configValuesEqual` 做脏标记，
 *    把被动学到的权益写进配置会把用户设置**误判成已修改并触发保存** ✗。
 *    权益是**连接的运行期观察结果**，不是用户设置 ⇒ 只放内存。
 */
import type { AppConfig, ApiProviderConfig } from '../../types';

/* ── 上游原始结构的解析（new-api 系；换一家同样适用，这里只有形状没有厂商名） ── */

/** 上游 `usable_group`：分组名 → 人类可读含义（如 `{ default: "默认分组" }`）。 */
export type ProviderGroupLabels = Record<string, string>;

/** 一个模型在上游价目表里的分组开放情况。 */
export interface ProviderModelEntitlementEntry {
  /** 上游 `enable_groups` 原文：该模型对哪些分组开放。空数组 = 上游没声明。 */
  enableGroups: readonly string[];
}

/** `parseEntitlements` 解析出来的、与连接无关的原始权益数据。 */
export interface ProviderEntitlementsPayload {
  /** `usable_group`：分组名 → 含义 */
  groupLabels: ProviderGroupLabels;
  /** `group_ratio`：分组名 → 倍率。**里面没有的分组不要在这里编**（见 `resolveGroupRatio`）。 */
  groupRatio: Record<string, number>;
  /** `auto_groups`：平台自动分组列表（原文透传，仅作排障证据） */
  autoGroups: readonly string[];
  /** 归一化模型名 → 分组开放情况 */
  models: Record<string, ProviderModelEntitlementEntry>;
}

/* ── 分组名 → 倍率 ──────────────────────────────────────────────────────── */

export type GroupRatioSource =
  /** 上游 `group_ratio` 表里**逐字**给了倍率（最权威） */
  | 'group_ratio'
  /** 倍率表里没有，但分组名自带「N折」折扣语义 ⇒ 由**组名**推出 N/10 */
  | 'group-name'
  /** 查不到 ⇒ **留空并登记**（绝不猜一个数出来） */
  | 'not-found';

export interface ResolvedGroupRatio {
  ratio: number | null;
  source: GroupRatioSource;
}

/**
 * ★「组名 → 倍率」的规则（**实测 + 平台自身 UI 佐证 + 中文命名约定**）：
 *
 * 1. **优先查表**：`group_ratio[组名]` 有有限正数 ⇒ 直接用（`default:1` / `test:2` /
 *    `企业测试专线:1.15` / `秋风专用:3`，逐字来自 2026 实测的 `_r129-tudou-pricing.json`）。
 * 2. **表里没有时按组名解析**：中文「N折」= 按 N/10 计价，其中 N **可以写成两位**——
 *    商务写法里 `95折` 就是 `9.5折`（付 95%）。所以：
 *      · `9折`  → 0.9   （**实测**：用户的分组 `vip-9折`，平台 UI 自己显示「0.9x 倍率」）
 *      · `95折` → 0.95  · `8折` → 0.8  · `6折` → 0.6   （同一命名约定的推广）
 *      · `8.5折` → 0.85 · `85折` → 0.85（两种写法等价，数值一致）
 *    实现即：**小数位存在或数值 < 10 ⇒ ÷10；否则（两位整数）÷100**。
 *
 *    ⚠️ **取证边界（不藏）**：只有 `vip-9折 ⇒ 0.9` 是**实测 + 平台 UI 双重佐证**的；
 *      `95折 ⇒ 0.95` 等是按**同一个中文命名约定**推广的。它们都**不是**从上游
 *      `group_ratio` 表里读到的（实测该表只有 6 条，`vip-*折` 一个都不在里面）。
 *      因此上层只把它用于**显示与预估**（非阻断），并在 `ratioSource` 里标明 `'group-name'`。
 * 3. 组名里**没有**「N折」的（如 `business-llm` / `秋风专用` 且表里也没有）⇒
 *    一律 `{ ratio: null, source: 'not-found' }` —— **倍率留空并登记**，
 *    **不猜、不默认 1**（默认 1 会把「未知分组」伪装成「无折扣」，那是自造数据）。
 */
export function resolveGroupRatio(
  group: string,
  groupRatioTable: Record<string, number> | undefined,
): ResolvedGroupRatio {
  const name = group.trim();
  if (!name) return { ratio: null, source: 'not-found' };

  const fromTable = groupRatioTable?.[name];
  if (typeof fromTable === 'number' && Number.isFinite(fromTable) && fromTable > 0) {
    return { ratio: fromTable, source: 'group_ratio' };
  }

  /* 「N折」：9 / 95 / 8.5 / 85 …（两位整数按 9.5 折那种写法解释） */
  const matched = /(\d+(?:\.\d+)?)\s*折/.exec(name);
  if (matched) {
    const written = Number(matched[1]);
    const hasDecimal = matched[1].includes('.');
    if (Number.isFinite(written) && written > 0) {
      const ratio = hasDecimal || written < 10 ? written / 10 : written / 100;
      if (Number.isFinite(ratio) && ratio > 0 && ratio <= 1) return { ratio, source: 'group-name' };
    }
  }
  return { ratio: null, source: 'not-found' };
}

/* ── 连接级缓存 ──────────────────────────────────────────────────────────── */

/** 反推「这条连接用的是哪个分组」的证据与结论。 */
export interface ProviderGroupInference {
  /** 反推出的分组名 */
  group: string;
  /** 上游 `usable_group` 里的含义（拿得到才有） */
  label?: string;
  ratio: number | null;
  ratioSource: GroupRatioSource;
  /**
   * 零反例判据的证据：`/v1/models` 里能对上价目表的模型共 `availableModels` 个，
   * 该分组在价目表里开放 `groupModels` 个，全站价目表共 `pricingModels` 个。
   */
  evidence: {
    availableModels: number;
    groupModels: number;
    pricingModels: number;
  };
  /**
   * 同样满足零反例判据的**其他**分组名（排序后）。
   * 非空 = 判据不唯一 ⇒ 调用方**不要**把它当硬结论（本模块仍给出最具体的那一个）。
   */
  alternatives: readonly string[];
}

/** 一条连接的权益快照（内存，不持久化）。 */
export interface ProviderConnectionEntitlement {
  providerId: string;
  /** 记录时刻的权威可用清单（归一化名）。`/v1/models` 的原文，**不是**价目表。 */
  availableModelIds: readonly string[];
  groupLabels: ProviderGroupLabels;
  groupRatio: Record<string, number>;
  autoGroups: readonly string[];
  /** 归一化模型名 → 分组开放情况（来自匿名 `/api/pricing`，**不代表该 key 可用**） */
  models: Record<string, ProviderModelEntitlementEntry>;
  /** 反推出的当前分组；判不出来就是 `null`（NOT FOUND，不猜） */
  inferredGroup: ProviderGroupInference | null;
  fetchedAt: number;
}

/** 归一化键：模型名大小写不敏感（上游写法不统一）。 */
export function entitlementModelKey(modelId: string): string {
  return modelId.trim().toLowerCase();
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

/**
 * 读 new-api 系 `GET /api/pricing` 响应里的**分组 / 倍率 / 开放矩阵**。
 *
 * 逐字对照落盘样本 `D:\DEEPSEEK\_r129-tudou-pricing.json`（2026 实取）：
 * ```
 * { "auto_groups": ["svip","vip","default"],
 *   "group_ratio": { "default":1, "svip":1, "vip":1, "test":2, "企业测试专线":1.15, "秋风专用":3 },
 *   "usable_group": { "default":"默认分组", "vip":"vip分组", … },
 *   "data": [{ "model_name":"…", "enable_groups":["vip-9折","vip","default", …] }] }
 * ```
 * 只做**通用结构读取**，不认厂商名 —— 换一家 new-api 站点同样适用。
 *
 * ⚠️ 这里**只解析**，不判「能不能用」：`enable_groups` 是「对哪些分组开放」，
 *    与「这个 key 属于哪个分组」是两件事，后者要拿 ① 的权威清单来反推（见 `inferConnectionGroup`）。
 */
export function parseNewApiEntitlements(payload: unknown): ProviderEntitlementsPayload | null {
  const root = readRecord(payload);
  if (!root) return null;

  const groupLabels: ProviderGroupLabels = {};
  const rawLabels = readRecord(root.usable_group);
  if (rawLabels) {
    for (const [group, label] of Object.entries(rawLabels)) {
      if (typeof label === 'string' && label.trim()) groupLabels[group] = label.trim();
    }
  }

  const groupRatio: Record<string, number> = {};
  const rawRatios = readRecord(root.group_ratio);
  if (rawRatios) {
    for (const [group, rawRatio] of Object.entries(rawRatios)) {
      const ratio = readFiniteNumber(rawRatio);
      if (ratio !== undefined && ratio > 0) groupRatio[group] = ratio;
    }
  }

  const models: Record<string, ProviderModelEntitlementEntry> = {};
  const rows = Array.isArray(root.data) ? root.data : [];
  for (const item of rows) {
    const record = readRecord(item);
    if (!record) continue;
    const rawName = typeof record.model_name === 'string'
      ? record.model_name
      : (typeof record.model === 'string' ? record.model : '');
    const name = rawName.trim();
    if (!name) continue;
    models[entitlementModelKey(name)] = {
      enableGroups: readStringArray(record.enable_groups),
    };
  }

  return { groupLabels, groupRatio, autoGroups: readStringArray(root.auto_groups), models };
}

/**
 * ★ **反推连接所属分组**（本模块的核心判据）。
 *
 * 上游**没有**任何匿名端点会告诉你「这个 key 属于哪个分组」——
 * `/api/pricing` 是匿名公开的，`group_ratio` 里也**没有**「当前分组」这一项（实测）。
 * 能用的证据只有「两个清单的**交集一致性**」：
 *
 *   · ① 权威清单 `/v1/models` = 这个 key **实际**能调用的模型（带 key，唯一权威）；
 *   · ② 匿名价目表 `data[].enable_groups` = 每个模型**对哪些分组**开放。
 *
 *   判据：分组 G 与 ① 一致 ⟺ 「① 里每一个**能在 ② 里找到**的模型，G 都在它的 `enable_groups` 里」
 *        （**零反例**）。实测该判据在土豆上成立：21/43 可用，被挡的 22 个全是没有 `vip-9折` 的。
 *
 * 多个分组同时满足「零反例」时（分组之间可能互相包含）：取**开放模型最少**的那个
 * （最具体 ⇒ 解释力最强），把其余记进 `alternatives` 供上层如实展示歧义。
 * 判不出来（没有数据 / 无一满足）⇒ 返回 `null`（**NOT FOUND，不猜**）。
 */
export function inferConnectionGroup(
  availableModelIds: readonly string[],
  payload: Pick<ProviderEntitlementsPayload, 'models' | 'groupLabels' | 'groupRatio'>,
): ProviderGroupInference | null {
  const catalogNames = Object.keys(payload.models);
  if (catalogNames.length === 0) return null;

  /* 只用「两个清单都有」的模型做判据：价目表不认识的模型给不出任何分组约束 */
  const constrained = availableModelIds
    .map((id) => payload.models[entitlementModelKey(id)])
    .filter((entry): entry is ProviderModelEntitlementEntry => Boolean(entry));
  if (constrained.length === 0) return null;

  /* 候选分组 = 价目表里出现过的所有 `enable_groups` */
  const candidates = new Set<string>();
  const enabledCount = new Map<string, number>();
  for (const entry of Object.values(payload.models)) {
    for (const group of entry.enableGroups) {
      candidates.add(group);
      enabledCount.set(group, (enabledCount.get(group) ?? 0) + 1);
    }
  }

  const consistent = [...candidates].filter((group) =>
    constrained.every((entry) => entry.enableGroups.includes(group)));
  if (consistent.length === 0) return null;

  /* 最具体（开放模型数最少）优先；并列时优先有官方含义说明的分组，再按名字定序（可复现）。 */
  consistent.sort((left, right) => {
    const byCount = (enabledCount.get(left) ?? 0) - (enabledCount.get(right) ?? 0);
    if (byCount !== 0) return byCount;
    const leftLabeled = payload.groupLabels[left] ? 0 : 1;
    const rightLabeled = payload.groupLabels[right] ? 0 : 1;
    if (leftLabeled !== rightLabeled) return leftLabeled - rightLabeled;
    return left.localeCompare(right);
  });

  const group = consistent[0];
  const { ratio, source } = resolveGroupRatio(group, payload.groupRatio);
  return {
    group,
    label: payload.groupLabels[group],
    ratio,
    ratioSource: source,
    evidence: {
      availableModels: constrained.length,
      groupModels: enabledCount.get(group) ?? 0,
      pricingModels: catalogNames.length,
    },
    alternatives: consistent.slice(1),
  };
}

/* ── 连接级内存缓存 ──────────────────────────────────────────────────────── */

const connectionEntitlements = new Map<string, ProviderConnectionEntitlement>();

/**
 * 记下一条连接的权益快照（由 `fetchProviderModelCatalog` 在**用户主动刷新目录**后调用）。
 *
 * ⚠️ `availableModelIds` 必须是 ① 的原文（`/v1/models`），**不能**拿价目表的 `data[]` 顶替 ——
 *    否则「哪些模型可用」就变成了「价目表有售」，那是本任务明令禁止的混淆。
 */
export function recordProviderEntitlements(
  providerId: string,
  payload: ProviderEntitlementsPayload | null,
  availableModelIds: readonly string[],
  now: number = Date.now(),
): ProviderConnectionEntitlement | null {
  const id = providerId.trim();
  if (!id || !payload) return null;
  const snapshot: ProviderConnectionEntitlement = {
    providerId: id,
    availableModelIds: [...availableModelIds],
    groupLabels: payload.groupLabels,
    groupRatio: payload.groupRatio,
    autoGroups: payload.autoGroups,
    models: payload.models,
    inferredGroup: inferConnectionGroup(availableModelIds, payload),
    fetchedAt: now,
  };
  connectionEntitlements.set(id, snapshot);
  return snapshot;
}

/** 读缓存；没有（从没拉过 / 拉失败 / 换过进程）就是 `null` —— 上层据此**不阻断**。 */
export function getProviderEntitlements(providerId: string | undefined): ProviderConnectionEntitlement | null {
  if (!providerId) return null;
  return connectionEntitlements.get(providerId) ?? null;
}

/** 仅供测试与「连接被删除 / 换 key」时清理。 */
export function clearProviderEntitlements(providerId?: string): void {
  if (providerId === undefined) connectionEntitlements.clear();
  else connectionEntitlements.delete(providerId);
}

/* ── 折扣（P3） ─────────────────────────────────────────────────────────── */

export interface ConnectionDiscount {
  group: string;
  label?: string;
  /** `null` = 组名解析不出倍率（NOT FOUND）⇒ 上层显示原价、不套折扣 */
  ratio: number | null;
  ratioSource: GroupRatioSource;
}

/**
 * 这条连接的折扣。
 *
 * ① `billing.group`（连接设置里**用户声明**的分组名）优先 —— 用户说的比自己反推的可靠；
 * ② 否则用 `/v1/models` × `/api/pricing` 反推出来的分组；
 * ③ 都没有 ⇒ `null`（NOT FOUND：不显示倍率、价格按原价，**不阻断**）。
 *
 * 倍率来源见 `resolveGroupRatio`：先查上游 `group_ratio`，查不到才按组名「N折」推，
 * 再查不到就 `ratio: null`（**留空并登记**，绝不猜）。
 */
export function resolveConnectionDiscount(
  providerId: string | undefined,
  billing?: { group?: string },
): ConnectionDiscount | null {
  const declared = billing?.group?.trim();
  const snapshot = getProviderEntitlements(providerId);
  const group = declared || snapshot?.inferredGroup?.group;
  if (!group) return null;

  const inferred = snapshot?.inferredGroup;
  if (declared && (!inferred || inferred.group !== declared)) {
    /* 用户声明的分组不在反推结果里 ⇒ 倍率仍按声明的组名解析，但**不谎称**它是反推出来的 */
    const { ratio, source } = resolveGroupRatio(group, snapshot?.groupRatio);
    return { group, label: snapshot?.groupLabels[group], ratio, ratioSource: source };
  }
  return {
    group,
    label: inferred?.label,
    ratio: inferred?.ratio ?? null,
    ratioSource: inferred?.ratioSource ?? 'not-found',
  };
}

/* ── 权威可用清单（P2 的取数口径） ──────────────────────────────────────── */

/** 归一化后的可用清单 + 「这份清单可不可信」的判定。 */
export interface ConnectionAvailability {
  availableIds: Set<string>;
  /** 清单来源：`catalog` = 连接里持久化的 `/v1/models` 结果；`memory` = 本次会话拉到的 */
  source: 'catalog' | 'memory';
}

/**
 * 取**该连接的权威可用清单**（P2 的候选口径）。
 *
 * 取数优先级：
 *   ① 本模块内存缓存里的 `availableModelIds`（**本次会话**拉到的，最新）；
 *   ② 连接配置里的 `catalogModels`（上次 `/v1/models` 的**完整**目录，随配置持久化，
 *      进程重启后还能用 —— 这正是「拿不到就退回现状、不阻断」需要的兜底）。
 * 都没有 ⇒ `null`（调用方**不做任何裁剪**）。
 *
 * ⚠️ **`selectedModels` 不能当权威清单用**：它是用户在目录里**勾选过**的子集，
 *    勾选是「我想看到它」，不是「上游允许我用它」。
 */
export function connectionAvailability(
  connection: Pick<ApiProviderConfig, 'catalogModels'> | undefined,
  providerId?: string,
): ConnectionAvailability | null {
  const snapshot = getProviderEntitlements(providerId);
  if (snapshot && snapshot.availableModelIds.length > 0) {
    return {
      availableIds: new Set(snapshot.availableModelIds.map(entitlementModelKey)),
      source: 'memory',
    };
  }
  const catalog = connection?.catalogModels;
  if (Array.isArray(catalog) && catalog.length > 0) {
    const ids = new Set<string>();
    for (const model of catalog) {
      const id = model?.id?.trim();
      if (id) ids.add(entitlementModelKey(id));
    }
    if (ids.size > 0) return { availableIds: ids, source: 'catalog' };
  }
  return null;
}

/**
 * ★ P2 的候选可用性判据（比 `connectionAvailability` 多一层「**证据同一时刻**」的保证）。
 *
 * `availableIds` 与 `models`（价目表的分组开放矩阵）**必须来自同一次抓取**，
 * 否则「上游当时没给我这个模型」与「它当时对哪些分组开放」可能对不上，
 * 据此裁剪候选就会误删 ✓✗。只有内存快照（`recordProviderEntitlements` 一次写入）满足这一点；
 * 单纯读持久化的 `catalogModels` 拿不到同刻的分组矩阵 ⇒ `models` 为 `null`（**只标记、不裁剪**）。
 */
export interface ConnectionCandidateAvailability {
  availableIds: Set<string>;
  /** 与 `availableIds` **同一时刻**的分组开放矩阵；`null` = 只有清单、没有同刻证据 */
  models: Record<string, ProviderModelEntitlementEntry> | null;
  /** 当时反推/声明的分组 */
  group: string | null;
}

export function connectionCandidateAvailability(
  connection: Pick<ApiProviderConfig, 'catalogModels' | 'billing'> | undefined,
  providerId: string | undefined,
): ConnectionCandidateAvailability | null {
  const availability = connectionAvailability(connection, providerId);
  if (!availability) return null;
  const snapshot = getProviderEntitlements(providerId);
  /* 只有当内存快照里的清单与当前判据用的是**同一份清单**时，才敢把它当同刻证据 */
  const sameList = snapshot
    && availability.source === 'memory';
  return {
    availableIds: availability.availableIds,
    models: sameList ? snapshot.models : null,
    group: (connection?.billing?.group?.trim()) || snapshot?.inferredGroup?.group || null,
  };
}

/**
 * 「该连接的 key 在上游**用不了**它」——**仅凭权威清单**（`/v1/models`）判定。
 * 没有清单 ⇒ `false`（**不猜**，宁可不说）。
 */
export function isCandidateUnavailable(
  candidateId: string,
  availability: ConnectionCandidateAvailability | null,
): boolean {
  if (!availability) return false;
  const key = entitlementModelKey(upstreamModelIdOf(candidateId));
  if (!key) return false;
  return !availability.availableIds.has(key);
}

/**
 * ★ **已证实**不可用 —— 可以据此把候选从下拉里**裁掉**。
 *
 * 需要**三重证据同时成立**（缺一不可）：
 *   ① 不在权威清单 `/v1/models` 里；
 *   ② 上游价目表**认识**这个模型（否则可能只是清单过时/不全，不能删）；
 *   ③ 当时的分组门确实关着（分组开放矩阵里没有当前分组）；
 * —— ①②③ 都来自**同一次抓取**（`connectionCandidateAvailability` 的 `sameList` 保证）。
 *
 * 这三条正是实测验证过的「分组门」判据（土豆：21/43 可用，被挡的 22 个全是没有 `vip-9折` 的，
 * **零反例**）。证据不足时一律返回 `false` ⇒ 候选**照旧列出**（退回现状，不阻断）。
 */
export function isCandidateProvablyBlocked(
  candidateId: string,
  availability: ConnectionCandidateAvailability | null,
): boolean {
  if (!availability?.models || !availability.group) return false;
  const key = entitlementModelKey(upstreamModelIdOf(candidateId));
  if (!key || availability.availableIds.has(key)) return false;
  const entry = availability.models[key];
  if (!entry) return false;
  return !entry.enableGroups.includes(availability.group);
}

/** 从 MTV 的 `ModelOption.value` / 目录 id 里剥出**上游模型 id**（`provider/model` → `model`）。 */
export function upstreamModelIdOf(value: string, provider?: string): string {
  const trimmed = value.trim();
  const slash = trimmed.indexOf('/');
  if (slash > 0) return trimmed.slice(slash + 1);
  if (provider && trimmed.startsWith(`${provider}/`)) return trimmed.slice(provider.length + 1);
  return trimmed;
}

/**
 * 把一张候选表按「权威清单」标注 / 必要时裁剪（P2）。
 *
 * · 标注：每项都算出 `unavailable`（不在清单里）——**用于加标记与确认前劝告**；
 * · 裁剪：**只**删「已证实挡掉」的（`isCandidateProvablyBlocked`）；
 * · 两者都遵守「**永不清空**」：如果裁剪会把这一组删空，就退化成只标注 ——
 *   空下拉是已知事故（见 `defaultModels.ts` 里 `visibleModelCategories` 空数组那条），
 *   宁可多列一个带标记的，也不能让用户点开什么都没有。
 *
 * `upstreamIdOf` 必须给出**上游模型 id**：自定义连接的 `value` 是 `general/<配置 id>`，
 * 那不是上游 id ⇒ 调用方要用自己的映射（`generalModels[].modelId`）解析。
 */
export function applyCandidateAvailability<T extends { value: string }>(
  models: readonly T[],
  availability: ConnectionCandidateAvailability | null,
  upstreamIdOf: (model: T) => string,
  options: { trim?: boolean } = {},
): T[] {
  if (!availability) return [...models];
  const annotated = models.map((model) => ({
    ...model,
    unavailable: isCandidateUnavailable(upstreamIdOf(model), availability),
  }));
  if (!options.trim) return annotated;
  const kept = annotated.filter((model) =>
    !isCandidateProvablyBlocked(upstreamIdOf(model), availability));
  return kept.length > 0 ? kept : annotated;
}

/* ── P1：确认前校验（分组门） ────────────────────────────────────────────── */

export type ProviderModelGateVerdict =
  /** 该连接的 key 能用它（在权威清单里） */
  | 'available'
  /** 该连接的 key **用不了**它 —— 确认前就要给出可操作提示 */
  | 'unavailable'
  /** 没有数据 / 无从判定 ⇒ **不阻断**（这是绝大多数情况，也是刻意的默认） */
  | 'undetermined';

export type ProviderModelGateReason =
  /** 在 `/v1/models` 里 ⇒ 通过 */
  | 'in-available-list'
  /** 不在 `/v1/models` 里，且该模型对当前分组**没有开放** ⇒ 分组门挡住（原因明确） */
  | 'group-not-enabled'
  /** 不在 `/v1/models` 里，且反推不出分组 ⇒ 挡在哪一层说不清（只说事实） */
  | 'not-in-available-list'
  /** 不在 `/v1/models` 里，且价目表根本不认识它 ⇒ 上游没这个模型 */
  | 'not-in-upstream-catalog'
  /** 连接里没有可用清单（从没拉过目录）⇒ 无从判定 */
  | 'no-availability-data'
  | 'no-entitlement-snapshot';

export interface ProviderModelGateSuggestion {
  /** 上游模型 id */
  id: string;
  /** 展示名（调用方给就给） */
  name?: string;
  /** 同一个分组/连接名（用于「这条连接只支持 X」的文案） */
  connectionLabel?: string;
}

export interface ProviderModelGateResult {
  verdict: ProviderModelGateVerdict;
  reason: ProviderModelGateReason;
  /** 反推/声明的当前分组（拿不到就没有） */
  group?: string;
  groupLabel?: string;
  ratio?: number | null;
  /** 该模型在上游价目表里声明开放的分组（原文，拿得到才有） */
  enableGroups: readonly string[];
  /** 权威可用清单里、与该模型**同类**的候选（「请改选 X」用的就是它） */
  suggestions: readonly ProviderModelGateSuggestion[];
}

export interface ModelGateCandidate {
  id: string;
  name?: string;
  /** MTV 的模型族/分类（`image` / `video` / `text` / `audio` …）；用于挑同类的替代品 */
  category?: string;
}

export interface EvaluateModelGateInput {
  providerId?: string;
  /** 要校验的模型（可带 `provider/` 前缀的 MTV value，会自动剥成上游 id） */
  modelId: string;
  /** 连接的持久化配置（读 `catalogModels` 与 `billing.group`） */
  connection?: Pick<ApiProviderConfig, 'catalogModels' | 'billing'>;
  /** 该模型所属的 MTV 分类；给了才能挑「同类替代品」 */
  category?: string;
  /** 候选池（一般为该连接的全部可选模型），用于生成可操作建议 */
  candidates?: readonly ModelGateCandidate[];
  /** 最多给几条建议 */
  maxSuggestions?: number;
}

/**
 * ★ **分组门**：选中模型后、**确认前**判断「这条连接 / 这个 key 到底能不能用它」。
 *
 * 判据（**从硬到软，绝不用价目表冒充可用性**）：
 *   ① 连接里**没有**任何可用清单 ⇒ `undetermined`（**不阻断**，退回现状）；
 *   ② 模型在 `/v1/models`（权威）里 ⇒ `available`；
 *   ③ 不在 ⇒ `unavailable`，并尽量**说清原因**：
 *        · 上游价目表认识它、反推出的分组不在它的 `enable_groups` 里 ⇒ `group-not-enabled`
 *          （这是「分组门」本身，日志与文案里要写清是**哪两个集合**对不上）；
 *        · 价目表不认识它 ⇒ `not-in-upstream-catalog`；
 *        · 其余 ⇒ `not-in-available-list`（只陈述事实，不编原因）。
 *   ④ 可操作建议：从**可用清单**里挑**同类**模型（`category` 相同）Top N，
 *      文案由调用方拼；这里只给数据 —— 「请改选 X」的 X 就是它。
 *
 * ⚠️ 判据 ③ 的**唯一权威**是 `/v1/models`；`enable_groups` 只用来**解释**，不用来**判定**。
 *    这才是「价目表有售 ≠ 该 key 可用」的代码级落实。
 */
export function evaluateModelGate(input: EvaluateModelGateInput): ProviderModelGateResult {
  const { providerId, connection } = input;
  const upstreamId = upstreamModelIdOf(input.modelId);
  const key = entitlementModelKey(upstreamId);
  const empty: ProviderModelGateResult = {
    verdict: 'undetermined',
    reason: 'no-availability-data',
    enableGroups: [],
    suggestions: [],
  };
  if (!key) return empty;

  const availability = connectionAvailability(connection, providerId);
  if (!availability) return empty;

  const snapshot = getProviderEntitlements(providerId);
  const entitlement = snapshot?.models[key];
  const discount = resolveConnectionDiscount(providerId, connection?.billing);
  const base = {
    group: discount?.group,
    groupLabel: discount?.label,
    ratio: discount?.ratio,
    enableGroups: entitlement?.enableGroups ?? [],
  };

  const suggestions = (input.candidates ?? [])
    .filter((candidate) => {
      const candidateKey = entitlementModelKey(upstreamModelIdOf(candidate.id));
      if (candidateKey === key) return false;
      if (!availability.availableIds.has(candidateKey)) return false;
      if (input.category && candidate.category && candidate.category !== input.category) return false;
      return true;
    })
    .slice(0, input.maxSuggestions ?? 3)
    .map((candidate) => ({ id: candidate.id, name: candidate.name }));

  if (availability.availableIds.has(key)) {
    /* ★ 在 ① 里 ⇒ 通过。即使 ② 的 `enable_groups` 里没写这个分组，也**以 ① 为准**
       （价目表与真实授权不一致时，能调用才是事实）。 */
    return { ...base, verdict: 'available', reason: 'in-available-list', suggestions };
  }

  const reason: ProviderModelGateReason = !snapshot
    ? 'not-in-available-list'
    : !entitlement
      ? 'not-in-upstream-catalog'
      : discount?.group && !entitlement.enableGroups.includes(discount.group)
        ? 'group-not-enabled'
        : 'not-in-available-list';

  return { ...base, verdict: 'unavailable', reason, suggestions };
}

/* ── 与 AppConfig 的胶水（纯函数，便于单测） ─────────────────────────────── */

/** 连接的展示名（拿不到就退连接 id）—— 候选上要标「走哪条连接」就用它。 */
export function connectionLabel(
  config: Pick<AppConfig, 'providers'>,
  providerId: string | undefined,
): string | undefined {
  if (!providerId) return undefined;
  return config.providers?.[providerId]?.name?.trim() || providerId;
}
