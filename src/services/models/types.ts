/**
 * Provider Adapter 与 Canonical Model Registry —— 类型定义。
 *
 * 设计要点（用户 2026 定稿）：
 *   · **模型身份**用 `canonicalId`（小写 `vendor/slug`，内部稳定标识）
 *   · **调用渠道**用 `providerModelId`（第三方平台的完整真实 id，**原样**发请求）
 *   · **界面文案**只用 `displayName`
 *   · **异步属性**用 `executionMode` —— 异步**不新建** canonicalId
 *
 * 硬规则：
 *   1. UI 任何位置只读 `displayName`，不得直接渲染 `providerModelId`；
 *   2. 出站请求体的 model 字段恒等于 `providerModelId`（含 `async` 等后缀，不改写）；
 *   3. 同名不同平台是两个 `NormalizedModel`，**去重键是 `providerId + providerModelId`**，
 *      绝不用 `canonicalId`（否则同步/异步会被吞成一个）；
 *   4. 映射不上就显示原始平台名并标 `unverified` / `manual-review`，**不虚构官方名**。
 */

/** 执行方式。`sync` 之外的取值由平台配置声明（`async` / `batch` / …）。 */
export type ExecutionMode = 'sync' | 'async';

/** 映射状态。`verified` = 人工/平台明确核对过；`manual-review` = 有待人工确认的信号；`unverified` = 没映射上。 */
export type MatchStatus = 'verified' | 'unverified' | 'manual-review';

/** 官方模型的生命周期状态。 */
export type CanonicalStatus = 'active' | 'deprecated';

/** 归一化后对外的状态（规格里的 `NormalizedModel.status`）。 */
export type NormalizedStatus = 'verified' | 'unverified' | 'deprecated';

/** 模型族（与官方 `official-model-meta.json` 的分族一致）。 */
export type ModelFamily = 'image' | 'video' | 'audio' | 'text' | 'threeD';

/**
 * Canonical Model —— 官方模型身份。**一个模型实体一条**，与平台无关。
 *
 * ⚠️ 改名只改 `officialName`；只有模型实体确实变化时才新增 `canonicalId`（用户定稿）。
 */
export interface CanonicalModel {
  /** 小写 `vendor/slug`，如 `google/banana-pro`。内部稳定标识，≠ 展示名 ≠ 调用 id。 */
  canonicalId: string;
  /** 原厂官方名称 —— **严格保留大小写、空格、连字符、版本号与官方后缀**。 */
  officialName: string;
  /** 原厂厂商名（展示用，如 `Google`）。 */
  officialVendor?: string;
  /** 已验证别名（官方自己用多个 id 指同一个模型时列在这里）。 */
  aliases?: string[];
  /** 能力标签（`image` / `video` / `image.edit` …）。 */
  capabilities: string[];
  status: CanonicalStatus;
  /**
   * 该模型在**官方表**里的 id（`official-image-models.json` / `official-model-meta.json`）。
   * 用途：复用既有能力表做**精确**查表，替代原来的模糊匹配。
   */
  officialModelIds?: string[];
  /** 官方品牌图标键（`da.*`）。 */
  iconKey?: string;
  /** 该条目的来源说明（人工核对记录）。 */
  source?: string;
  updatedAt?: string;
}

/**
 * 平台的「规格后缀」声明 —— `async` / `batch` / `priority` 这类**平台执行规格**。
 * 换平台只改配置，不改代码。
 */
export interface ProviderSuffixSpec {
  /** 后缀分隔符，默认 `-`。 */
  separator: string;
  /** 会被识别为「规格后缀」的取值（小写）。 */
  suffixes: string[];
  /** 后缀 → 执行模式；未列出的后缀按 `sync` 处理。 */
  executionMode?: Record<string, ExecutionMode>;
}

/** 平台（= 用户说的「第三方聚合平台」）定义。 */
export interface ProviderDefinitionConfig {
  /** 平台标识，映射表就按它索引（例：`tudou`）。 */
  providerId: string;
  /** 平台展示名（设置页「模型映射」里显示，不进模型名）。 */
  label: string;
  /** 用哪个 Adapter 实现（`openai-compatible` / `local-manifest` / …）。 */
  adapterId: string;
  /** 域名匹配（优先于 `catalogIds`；同一个中转站换域名只改这里）。 */
  matchHosts?: string[];
  /** 连接 `catalogId` 匹配（内置厂商用）。 */
  catalogIds?: string[];
  suffixSpec?: ProviderSuffixSpec;
  /** 该平台是否走「所有模型都当官方名未知」的保守策略。 */
  strictDisplay?: boolean;
}

/** 第三方平台给的一条原始模型记录（Adapter 解析后的产物）。 */
export interface ProviderRawModel {
  /** 平台 API 需要的完整模型 id（**调用用的就是它**）。 */
  providerModelId: string;
  /** 平台自己给的显示名 —— 可能是渠道名/套餐名，**绝不直接上 UI**，只作诊断与候选。 */
  providerName?: string;
  /** 平台声明的别名。 */
  aliases?: string[];
  /** 平台明确声明的原厂模型标识（若有，属解析优先级第 3 档）。 */
  officialModelId?: string;
  officialVendor?: string;
  capabilities?: string[];
  category?: string;
  raw?: unknown;
}

/**
 * 映射表里的一条显式映射（配置化，可版本管理）。
 * 允许把 `providerModelId` 直接写全（含 `async` 后缀）—— 优先级最高。
 */
export interface ProviderModelMapping {
  providerId: string;
  providerModelId: string;
  /**
   * 平台自己给这个模型起的名字（管理视图的「原始模型名称」一列）。
   * 与调用 id 不同时写在这里；相同就省略（视图回落到 id）。
   */
  providerModelName?: string;
  canonicalId?: string;
  executionMode?: ExecutionMode;
  providerSuffix?: string;
  /** 平台侧名字需要保留（例如平台特有的预览版标注）时的显式覆盖。 */
  displayNameOverride?: string;
  matchStatus: MatchStatus;
  /** 映射依据 —— `verified` 条目**必填**（构建期校验）。 */
  source?: string;
  updatedAt: string;
  /** 管理员备注（管理面板「审核信息 → 备注」，只在本机 config 的覆盖层里出现）。 */
  note?: string;
}

/** 平台别名 → canonical（解析优先级第 2 档）。`providerId: '*'` 表示跨平台通用别名。 */
export interface ProviderAliasMapping {
  providerId: string;
  alias: string;
  canonicalId: string;
  matchStatus: MatchStatus;
  source?: string;
  updatedAt: string;
}

/** 一个平台一份映射配置文件（`src/data/modelMappings/<providerId>.json`）。 */
export interface ProviderMappingFile {
  providerId: string;
  /** 可选：覆盖 `modelProviders.json` 里的后缀声明。 */
  suffixSpec?: ProviderSuffixSpec;
  mappings: ProviderModelMapping[];
  aliases?: ProviderAliasMapping[];
}

/**
 * 归一化结果 —— **UI 只允许读这个对象**。
 * 规格里给的是 `status: 'verified' | 'unverified' | 'deprecated'`；
 * 这里额外带上更精确的 `matchStatus`（含 `manual-review`）与判定依据，便于待审核视图。
 */
export interface NormalizedModel {
  providerId: string;
  /** 平台真实调用 id —— **原样**发请求，含规格后缀。 */
  providerModelId: string;
  canonicalId?: string;
  officialName: string;
  /** ★ 唯一允许出现在界面上的名字。 */
  displayName: string;
  officialVendor?: string;
  executionMode: ExecutionMode;
  capabilities: string[];
  status: NormalizedStatus;
  /** ---- 以下为内部附加（规格允许扩展）---- */
  /** 被识别出的平台规格后缀（`async` …），去后缀后的主体 = `providerModelId` 去掉它。 */
  providerSuffix?: string;
  /** 去掉规格后缀的**主体 id** —— 只用于匹配，**不用于发请求**。 */
  baseModelId: string;
  matchStatus: MatchStatus;
  /** 判定依据（待审核视图要显示）。 */
  source?: string;
  iconKey?: string;
  /** 官方表里的 id（能力查表用）。 */
  officialModelIds?: string[];
}

/** Adapter 的职责边界（只做这五件事）。 */
export interface ProviderAdapter {
  id: string;
  label: string;
  suffixSpec: ProviderSuffixSpec;
  /** ① 鉴权：把连接凭据变成请求头。 */
  buildAuth(config: { apiKey?: string; baseUrl?: string }): Record<string, string>;
  /** ② 获取模型列表：返回**原始**条目，交给 `parseModel` 解析。 */
  fetchModels?(ctx: { baseUrl?: string; apiKey?: string; signal?: AbortSignal }): Promise<unknown[]>;
  /** ③ 解析平台原始模型 ID、别名、原厂字段、能力字段与其它元数据。 */
  parseModel(raw: unknown): ProviderRawModel | null;
  /** ④ 请求格式转换（复用既有链路；不改变调用 id）。 */
  buildRequest?<T>(input: T): T;
  /** ⑤ 响应格式转换。 */
  parseResponse?<T>(payload: T): T;
}
