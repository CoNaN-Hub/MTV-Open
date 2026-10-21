/**
 * Provider model catalog — built-in provider metadata and model-list adapters.
 * Local manifests are supplied by the caller so this service stays independent
 * from component-owned model presentation data.
 */
import {
  APIMART_BASE_URL,
  BOCHA_SEARCH_BASE_URL,
  CCCAPI_BASE_URL,
  EXA_SEARCH_BASE_URL,
  GRSAI_BASE_URL,
  RUNNINGHUB_MODEL_BASE_URL,
  TAVILY_BASE_URL,
  TUDOU_BASE_URL,
  VOLCENGINE_BASE_URL,
  ZHIPU_SEARCH_BASE_URL,
} from '../../constants/api';
import type {
  ApiProviderConfig,
  AppConfig,
  ChatApiProtocol,
  GeneralModelCategory,
  ProviderCatalogAdapter,
  ProviderModelSelection,
  WebSearchProviderId,
} from '../../types';
import { corsSafeFetch } from './httpTransport';
import { baseUrlCandidates } from './providerBaseUrl';
import { normalizedModelOf, stampNormalized } from '../models/display';
import { getProviderAdapter } from '../models/adapters';
import { resolveProviderId } from '../models/providers';
import type { ProviderRawModel } from '../models/types';
import { APIMART_OMNI_MODELS, isLegacyApimartOmni } from './apimartVideoModels';
import { getChatApiHeaders, normalizeGeminiModelId, resolveChatApiProtocol } from './chatApiProtocol';
import { XAI_BASE_URL, XAI_MODEL_MANIFEST } from './providers/xaiModelManifest';
import {
  GOOGLE_GEMINI_BASE_URL,
  GOOGLE_MODEL_MANIFEST,
} from './providers/googleModelManifest';
import {
  SORA2U_BASE_URL,
  SORA2U_MODEL_MANIFEST,
  SORA2U_REQUEST_QUERY,
} from './providers/sora2uModelManifest';
import {
  parseNewApiEntitlements,
  recordProviderEntitlements,
} from './providerEntitlements';
import type { ProviderConnectionEntitlement, ProviderEntitlementsPayload } from './providerEntitlements';

export type ProviderAuthType = 'api-key' | 'oauth';
export type ProviderCredentialKey = 'apiKey' | 'baseUrl';

export interface ProviderCredentialField {
  key: ProviderCredentialKey;
  label: string;
  required: boolean;
  secret?: boolean;
  placeholder?: string;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  description: string;
  badgeText: string;
  authType: ProviderAuthType;
  catalogAdapter: ProviderCatalogAdapter;
  defaultBaseUrl?: string;
  modelsPath?: string;
  allowCustomBaseUrl?: boolean;
  /** 用户主动打开的注册、获取 Key 或充值页面；不得用作 API Base URL。 */
  externalUrl?: string;
  /** 无生成副作用的连接验证路径。 */
  connectionTestPath?: string;
  /** 该厂商 API 请求必须携带的固定查询参数。 */
  requestQuery?: Readonly<Record<string, string>>;
  /** 暂时不向用户暴露的模型 ID；保留底层协议，便于后续恢复。 */
  hiddenModelIds?: readonly string[];
  credentials: ProviderCredentialField[];
  /** 内置厂商随应用发布的模型及声明式执行协议。 */
  models?: readonly ProviderModelSelection[];
  /**
   * ★ 模型清单的**声明式来源**（能力，不是某家厂商的专属分支）。
   *
   * 位置语义：**第 0 条 = 权威清单**，其余为**补充元数据**（按模型名的归一化键合并，
   * 补充来源**不新增模型**——「哪些模型这条连接真的能用」只由权威来源回答）。
   *
   * `auth: 'connection-key'` = 发该连接的鉴权头；`auth: 'none'` = 匿名公开端点。
   * 没声明 `modelSources` 的厂商沿用既有的 `modelsPath`（OpenAI 兼容 `/models`）。
   */
  modelSources?: readonly ProviderModelSource[];
  /** web-search connections provide Agent capabilities and do not expose models. */
  kind?: 'model' | 'web-search' | 'workflow-api';
}

/**
 * 一条**模型清单来源**的声明。
 *
 * 通用能力：任何厂商都能声明「用哪个端点、要不要带本连接的 Key、响应怎么读」，
 * 所以这里只有形状，没有厂商名 —— 新增厂商是**加数据**，不是加代码分支。
 *
 * 实测来源示例（土豆 `api.ai-tudou.net`，new-api 系）：
 *   · `path: '/models'` + `auth: 'connection-key'` ⇒ `GET /v1/models`，返回**该 Key 实际可用**的模型；
 *   · `path: '/api/pricing'` + `auth: 'none'` ⇒ 匿名公开价目表，补厂商名 / 分组 / 分档价。
 */
export interface ProviderModelSource {
  /** 相对**连接地址**的路径；也可以给 `{origin}` 开头的绝对路径（如 new-api 挂在站点根的 `/api/pricing`）。 */
  path: string;
  /**
   * 该端点的鉴权语义：
   *   · `connection-key` = 必须带本连接的 Key（`/v1/models` 这类）；
   *   · `none`           = 匿名公开端点（`/api/pricing` 这类），**不发**凭据。
   */
  auth: 'connection-key' | 'none';
  /**
   * 要不要沿 `baseUrlCandidates` 逐候选探测。
   * `/v1/models` 这类版本段敏感的要探（用户常只填域名）；站点根上的端点不必探。
   */
  probeBaseUrlCandidates?: boolean;
  /** 补充来源：把响应解析成「按模型名分组的元数据」。有它 ⇒ 这条来源不产出模型。 */
  parseEnrichment?: (payload: unknown) => ProviderModelEnrichment;
  /**
   * ★ 补充来源：把响应解析成**连接级权益**（分组 / 倍率 / 每个模型对哪些分组开放）。
   *
   * 与 `parseEnrichment` 是**同一层级**的两个解析器，可以挂在**同一条来源**上
   * （new-api 的 `/api/pricing` 一次响应同时给出厂商元数据与分组权益 ⇒ **只发一次请求**）。
   *
   * ⚠️ 它读到的 `enable_groups` 只回答「这个模型对哪些分组开放」，
   *    **不回答**「这个 key 能不能用」—— 后者只由权威来源（带 Key 的 `/v1/models`）回答。
   *    见 `providerEntitlements.ts` 的文件头。
   */
  parseEntitlements?: (payload: unknown) => ProviderEntitlementsPayload | null;
}

/** 补充来源解析出的元数据，按 `modelKey()` 归一化后的模型名索引。 */
export interface ProviderModelEnrichmentEntry {
  /** 厂商 / 上游归属（如 new-api 价目表的 `vendors[]`） */
  vendorLabel?: string;
  /** 端点形态声明（厂商原文，如 `['openai']` / `['异步文生图+图生图']`） */
  endpointTypes?: string[];
  /** 厂商给的用途说明 */
  description?: string;
}

export type ProviderModelEnrichment = Map<string, ProviderModelEnrichmentEntry>;

export interface ProviderCatalogResult {
  models: ProviderModelSelection[];
  source: 'remote' | 'local-manifest' | 'local-fallback';
  warning?: string;
  /** 实际拉通的接口地址；与用户填的不同（如补了 /v1）时调用方应回写。 */
  resolvedBaseUrl?: string;
  /**
   * ★ 本次拉取顺带解析到的**连接级权益**（分组 / 倍率 / 分组开放矩阵）。
   *
   * 没有这条来源、来源失败、或响应里没有分组字段 ⇒ `undefined`（**静默**，不阻断）。
   * ⚠️ 它是 **MTV 增强**（官方侧 NOT FOUND，见 `providerEntitlements.ts` 文件头）。
   */
  entitlements?: ProviderConnectionEntitlement;
  /**
   * ★★ 本次拉取**按平台价目表剔掉**的模型数（`/v1/models` 里列了、但厂商公开价目表里根本没有）。
   *
   * 用户 2026 口径（土豆真机）：「土豆都没有，你拉了干啥？」
   * —— 实测这类模型里有 `gpt-image-2.5-sunburst`（524）、`gpt-image-2.5-flash…`／`gpt-image-2-pro`
   *    （其中一条直接回 `503 No available channel for model … under group default`）
   *    ⇒ **「能拉到」不等于「能用」**，列出来只会让用户选中后失败。
   * 判据只在**拿到价目表快照**时生效（拿不到 ⇒ 不过滤，fail-open）；`0`/`undefined` = 没剔。
   */
  droppedUnlisted?: number;
}

export interface FetchProviderCatalogOptions {
  providerId: string;
  /**
   * ★ **这条连接**在 `config.providers` 里的 key（自定义连接是 `custom-<uuid8>`，
   * 与 `providerId`/`definition.id` 不是一回事）。
   *
   * 权益按**连接 + key** 变 ⇒ 缓存的键必须是它，否则两条自定义连接会互相覆盖。
   * 不填时退回 `providerId`（内置厂商两者本来就相等）。
   */
  connectionId?: string;
  config: ApiProviderConfig;
  fallbackModels?: ProviderModelSelection[];
  signal?: AbortSignal;
}

const API_KEY_FIELD: ProviderCredentialField = {
  key: 'apiKey',
  label: 'API Key',
  required: true,
  secret: true,
};

/**
 * 未填写 API Key 时展示的目录；填写后仍以远端 /models 为准。
 * 模型 ID 取自 CCC API 监控页 https://cccapi.cn/monitor 的 openai 渠道。
 * inputModalities 只在与按 ID 猜模态的兜底规则不一致时才显式声明，
 * 避免把 gpt-4 / o3-mini 这类纯文本模型误判成能吃图。
 */
const CCCAPI_MODEL_MANIFEST: readonly ProviderModelSelection[] = [
  { id: 'gpt-5.6', name: 'GPT-5.6', category: 'text', provider: 'cccapi', description: 'GPT-5.6 通用文本与多模态模型' },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', category: 'text', provider: 'cccapi', description: 'GPT-5.6 Sol 文本与多模态模型' },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', category: 'text', provider: 'cccapi', description: 'GPT-5.6 Luna 文本与多模态模型' },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', category: 'text', provider: 'cccapi', description: 'GPT-5.6 Terra 文本与多模态模型' },
  { id: 'gpt-5.5', name: 'GPT-5.5', category: 'text', provider: 'cccapi', description: 'GPT-5.5 通用文本与多模态模型' },
  { id: 'gpt-5.4', name: 'GPT-5.4', category: 'text', provider: 'cccapi', description: 'GPT-5.4 通用文本与多模态模型' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini', category: 'text', provider: 'cccapi', description: 'GPT-5.4 mini 轻量文本与多模态模型' },
  { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark', category: 'text', provider: 'cccapi', description: 'GPT-5.3 Codex Spark 编码模型' },
  { id: 'gpt-5.2', name: 'GPT-5.2', category: 'text', provider: 'cccapi', description: 'GPT-5.2 通用文本与多模态模型' },
  { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', category: 'text', provider: 'cccapi', description: 'GPT-5.2 Pro 高能力文本与多模态模型' },
  { id: 'gpt-5', name: 'GPT-5', category: 'text', provider: 'cccapi', description: 'GPT-5 通用文本与多模态模型' },
  { id: 'o4-mini', name: 'o4-mini', category: 'text', provider: 'cccapi', description: 'o4-mini 轻量推理模型，支持多模态输入' },
  { id: 'o3', name: 'o3', category: 'text', provider: 'cccapi', description: 'o3 强推理模型，支持多模态输入' },
  { id: 'o3-mini', name: 'o3-mini', category: 'text', provider: 'cccapi', description: 'o3-mini 轻量推理模型', inputModalities: ['text'] },
  { id: 'gpt-4.1', name: 'GPT-4.1', category: 'text', provider: 'cccapi', description: 'GPT-4.1 通用文本与多模态模型' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', category: 'text', provider: 'cccapi', description: 'GPT-4.1 mini 轻量文本与多模态模型' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 nano', category: 'text', provider: 'cccapi', description: 'GPT-4.1 nano 极轻量文本与多模态模型' },
  { id: 'gpt-4o', name: 'GPT-4o', category: 'text', provider: 'cccapi', description: 'GPT-4o 通用文本与多模态模型' },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    category: 'text',
    provider: 'cccapi',
    description: 'OpenAI 兼容文本与多模态模型',
    inputModalities: ['text', 'image'],
  },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', category: 'text', provider: 'cccapi', description: 'GPT-4 Turbo 通用文本与多模态模型' },
  { id: 'gpt-4', name: 'GPT-4', category: 'text', provider: 'cccapi', description: 'GPT-4 通用文本模型', inputModalities: ['text'] },
  { id: 'codex-auto-review', name: 'Codex Auto Review', category: 'text', provider: 'cccapi', description: 'Codex 自动代码评审模型' },
  {
    id: 'gpt-image-2.5-flare',
    name: 'GPT Image 2.5 Flare',
    category: 'image',
    provider: 'cccapi',
    description: '速度优先的轻量图片模型，支持文生图与图片编辑',
    imageReferenceRequestMode: 'edits-multipart',
  },
  {
    id: 'gpt-image-2.5-sunburst',
    name: 'GPT Image 2.5 Sunburst',
    category: 'image',
    provider: 'cccapi',
    description: '质量优先的高画质图片模型，支持文生图与图片编辑',
    imageReferenceRequestMode: 'edits-multipart',
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    category: 'image',
    provider: 'cccapi',
    description: 'OpenAI 兼容图片生成模型',
    imageReferenceRequestMode: 'edits-multipart',
  },
  { id: 'gpt-image-1', name: 'GPT Image 1', category: 'image', provider: 'cccapi', description: 'OpenAI 兼容图片生成模型（上一代）' },
];

const SORA2U_HIDDEN_MODEL_IDS = [
  'seedance-2.5',
  'seedance-2.5-character',
  'seedance-2.5-character-mono',
] as const;
const SORA2U_HIDDEN_MODEL_ID_SET = new Set<string>(SORA2U_HIDDEN_MODEL_IDS);

export const WEB_SEARCH_PROVIDER_IDS: readonly WebSearchProviderId[] = [
  'tavily',
  'bocha',
  'zhipu-search',
  'exa',
];

/**
 * ★ 「选择 API 厂商」弹窗里**不再出现**的厂商 id（用户 2026 指定）。
 *
 * ⚠️ 这里**只是 UI 选择项**：定义、适配器（`services/models/adapters/*`）、映射表
 *    （`data/modelMappings/*.json`）与既有连接**全部保留** —— 这些 id 被
 *    `generationRuntime` / `mediaModelCapabilities` / `defaultModels` / 测试大量引用，
 *    删定义会连锁破坏。要彻底删除请先看移除影响面报告。
 *
 * 仅供「新建连接」的选择框使用；`getProviderDefinitions()` / 设置页里的既有连接列表
 * 仍然拿得到这些定义（否则已配置的连接会失去名称、徽章与编辑入口）。
 */
export const HIDDEN_FROM_PROVIDER_PICKER_IDS: readonly string[] = [
  'cccapi',
  'google',
  'volcengine',
  'grsai',
  'tavily',
  'xai',
  'sora2u',
  'dreamina',
];

export function isProviderSelectable(providerId: string): boolean {
  return !HIDDEN_FROM_PROVIDER_PICKER_IDS.includes(providerId);
}

/**
 * 「选择 API 厂商」列表（**新建连接**时能挑的厂商）—— 纯函数，便于锁定行为。
 *
 * 规则与改动前一致，只多一条：`isProviderSelectable` 为假且不是当前正在编辑的连接 ⇒ 不列出。
 * 「当前正在编辑的那条」始终保留：用户可能正在改一条已下架厂商的连接，不列出来就认不出自己在改什么。
 */
export function selectableProviderDefinitions(
  definitions: readonly ProviderDefinition[],
  options: {
    initialDefinitionId?: string;
    connectedProviderIds: readonly string[];
    /** 是否还有别的联网搜索连接占位（与改动前一致：联网搜索在选择框里只给一个入口）。 */
    hasWebSearchConnection: boolean;
    isWebSearchProvider: boolean;
  },
): ProviderDefinition[] {
  return definitions.filter((item) => {
    const isCurrent = item.id === options.initialDefinitionId;
    if (!isProviderSelectable(item.id) && !isCurrent) return false;
    if (item.kind === 'web-search') {
      return (item.id === 'tavily' && !options.hasWebSearchConnection) || options.isWebSearchProvider;
    }
    /* ⚠️ 2026 用户实测：「土豆 内嵌到『选择 API 厂商』里怎么没有」——
       原来这里有 `!connectedProviderIds.includes(item.id)`，**已连接的厂商会被整条隐藏**
       （用户早就连了土豆 ⇒ 选择框里看不到它，用别的 Key 再建一条连接也没有入口）。
       官方没有这个对话框（provider 管理是 MTV 自有），所以按用户口径：已连接也照常列出，
       允许为同一厂商再建一条连接（不同 Key / 不同分组）。 */
    return true;
  });
}

/**
 * 土豆网关（`api.ai-tudou.net`）的模型来源 —— **声明式**，见 `ProviderModelSource`。
 *
 * ⚠️ 这里只有形状，没有厂商专属分支：任何 OpenAI 兼容厂商都能声明同样的两条。
 *
 *  ① `GET /v1/models` + 本连接的 Key —— **权威清单**：返回该 Key 实际可用的模型
 *     （OpenAI 兼容标准端点，所以这是**通用能力**；`/v1` 版本段交给候选探测）。
 *  ② `GET /api/pricing` 匿名 —— **补充元数据**：厂商归属、端点形态、用途说明。
 *     实测它挂在**站点根**（不在 `/v1` 下）⇒ 用 `{origin}` 绝对路径；
 *     它**不参与**「哪些模型可用」的判定（价目表里有的模型，该 Key 未必能用）。
 */
const TUDOU_MODEL_SOURCES: readonly ProviderModelSource[] = [
  { path: '/models', auth: 'connection-key', probeBaseUrlCandidates: true },
  {
    path: '{origin}/api/pricing',
    auth: 'none',
    probeBaseUrlCandidates: false,
    parseEnrichment: parseNewApiPricingEnrichment,
    /* ★ 同一次匿名响应的**第二个解析器**：分组名 / 倍率 / `enable_groups`
       （`providerEntitlements.ts`）—— 不额外发请求，也不参与「哪些模型可用」的判定。 */
    parseEntitlements: parseNewApiEntitlements,
  },
];

const BUILT_IN_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: 'workflow-api', name: '工作流 API', kind: 'workflow-api',
    description: '自定义平台、工作流路径、输入参数与结果映射', badgeText: 'WF',
    authType: 'api-key', catalogAdapter: 'local-manifest',
    credentials: [{ ...API_KEY_FIELD, label: 'API Key / Token', required: false, placeholder: '填写平台提供的密钥' },
      { key: 'baseUrl', label: '接口地址', required: true, placeholder: 'https://api.example.com' }],
  },
  {
    id: 'apimart',
    name: 'APIMart',
    description: '模型覆盖全面，价格适中。注册需使用境外网络，日常生成在国内网络环境下即可使用。',
    badgeText: 'AM',
    authType: 'api-key',
    catalogAdapter: 'openai-compatible',
    defaultBaseUrl: APIMART_BASE_URL,
    modelsPath: '/models',
    allowCustomBaseUrl: false,
    credentials: [
      API_KEY_FIELD,
      { key: 'baseUrl', label: '接口地址', required: false, placeholder: APIMART_BASE_URL },
    ],
  },
  {
    id: 'cccapi',
    name: 'CCC API',
    description: '群内大佬自建自用中转！平价对接，纯公益不赚一分钱✅，稳定、速度快、出图质量高',
    badgeText: 'CCC',
    authType: 'api-key',
    catalogAdapter: 'openai-compatible',
    defaultBaseUrl: CCCAPI_BASE_URL,
    modelsPath: '/models',
    allowCustomBaseUrl: false,
    externalUrl: 'https://cccapi.cn',
    credentials: [
      { ...API_KEY_FIELD, placeholder: 'sk-...' },
    ],
    models: CCCAPI_MODEL_MANIFEST,
  },
  {
    id: 'xai',
    name: 'xAI / Grok 官方',
    description: 'Grok 官方文本、图片与视频模型',
    badgeText: 'xAI',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: XAI_BASE_URL,
    credentials: [
      { ...API_KEY_FIELD, placeholder: 'xai-...' },
    ],
    models: XAI_MODEL_MANIFEST,
  },
  {
    id: 'google',
    name: 'Google Gemini 官方',
    description: 'Gemini 文本、Nano Banana 图片、Omni/Veo 视频与 TTS',
    badgeText: 'G',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: GOOGLE_GEMINI_BASE_URL,
    credentials: [
      { ...API_KEY_FIELD, placeholder: 'Google AI Studio API Key' },
    ],
    models: GOOGLE_MODEL_MANIFEST,
  },
  {
    id: 'sora2u',
    name: 'Sora2U',
    description: 'Seedance 全模态视频与 Gemini/Kontext 图片模型',
    badgeText: 'S2U',
    authType: 'api-key',
    catalogAdapter: 'openai-compatible',
    defaultBaseUrl: SORA2U_BASE_URL,
    modelsPath: '/api/v1/models',
    allowCustomBaseUrl: false,
    externalUrl: 'https://sora2u.com/?utm_source=tenney&utm_medium=canvas&utm_content=wx',
    connectionTestPath: '/api/v1/credits',
    requestQuery: SORA2U_REQUEST_QUERY,
    hiddenModelIds: SORA2U_HIDDEN_MODEL_IDS,
    credentials: [
      { ...API_KEY_FIELD, placeholder: 'sk_sora_...' },
    ],
    models: SORA2U_MODEL_MANIFEST.filter((model) => !SORA2U_HIDDEN_MODEL_ID_SET.has(model.id)),
  },
  {
    id: 'volcengine',
    name: '火山方舟',
    description: '火山引擎方舟模型服务',
    badgeText: 'V',
    authType: 'api-key',
    catalogAdapter: 'openai-compatible',
    defaultBaseUrl: VOLCENGINE_BASE_URL,
    modelsPath: '/models',
    allowCustomBaseUrl: false,
    credentials: [
      API_KEY_FIELD,
      { key: 'baseUrl', label: '接口地址', required: false, placeholder: VOLCENGINE_BASE_URL },
    ],
  },
  {
    id: 'runninghub-model',
    name: 'RunningHub',
    description: 'RunningHub 标准模型 API 与工作流',
    badgeText: 'RH',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: RUNNINGHUB_MODEL_BASE_URL,
    credentials: [{
      ...API_KEY_FIELD,
      label: '企业级-共享 API Key',
      placeholder: '用于 RunningHub 标准模型 API',
    }],
  },
  {
    /* ★ 土豆网关：new-api 系、OpenAI 兼容。模型清单**不内置**，完全靠连接的 Key 现拉
       （见 `TUDOU_MODEL_SOURCES` 的两条声明式来源），所以这里没有 `models`。 */
    id: 'tudou',
    name: '土豆',
    description: 'OpenAI 兼容网关；模型清单按该 Key 实际可用的范围现拉',
    badgeText: 'TD',
    authType: 'api-key',
    catalogAdapter: 'openai-compatible',
    defaultBaseUrl: TUDOU_BASE_URL,
    modelsPath: '/models',
    allowCustomBaseUrl: true,
    modelSources: TUDOU_MODEL_SOURCES,
    credentials: [
      { ...API_KEY_FIELD, placeholder: 'sk-...' },
      { key: 'baseUrl', label: '接口地址', required: false, placeholder: TUDOU_BASE_URL },
    ],
  },
  {
    id: 'grsai',
    name: 'GRSAI',
    description: '图像生成与多模态文本模型服务',
    badgeText: 'GR',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: GRSAI_BASE_URL,
    allowCustomBaseUrl: false,
    credentials: [
      API_KEY_FIELD,
      { key: 'baseUrl', label: '接口地址', required: false, placeholder: GRSAI_BASE_URL },
    ],
  },
  {
    id: 'dreamina',
    name: '即梦',
    description: '通过官方 OAuth 登录使用即梦模型',
    badgeText: 'JM',
    authType: 'oauth',
    catalogAdapter: 'local-manifest',
    credentials: [],
  },
  {
    id: 'tavily',
    name: 'Tavily',
    description: '面向 AI Agent 的搜索与来源服务',
    badgeText: 'TV',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: TAVILY_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, placeholder: 'tvly-...' }],
    kind: 'web-search',
  },
  {
    id: 'bocha',
    name: '博查 Web Search',
    description: '国内网络环境友好的结构化搜索服务',
    badgeText: 'BC',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: BOCHA_SEARCH_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, placeholder: 'sk-...' }],
    kind: 'web-search',
  },
  {
    id: 'zhipu-search',
    name: '智谱联网搜索',
    description: '智谱开放平台提供的 Web Search API',
    badgeText: 'ZP',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: ZHIPU_SEARCH_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, placeholder: '智谱 API Key' }],
    kind: 'web-search',
  },
  {
    id: 'exa',
    name: 'Exa',
    description: '支持语义检索与网页摘要的搜索服务',
    badgeText: 'EX',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: EXA_SEARCH_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, placeholder: 'Exa API Key' }],
    kind: 'web-search',
  },
  {
    id: 'custom-openai',
    name: '自定义接口',
    description: 'OpenAI 兼容接口；非标准接口用模型的调用协议单独声明',
    badgeText: 'API',
    authType: 'api-key',
    catalogAdapter: 'openai-compatible',
    modelsPath: '/models',
    allowCustomBaseUrl: true,
    credentials: [
      API_KEY_FIELD,
      { key: 'baseUrl', label: '接口地址', required: true },
    ],
  },
];

export function isProviderModelVisible(catalogId: string | undefined, modelId: string): boolean {
  if (!catalogId) return true;
  if (catalogId === 'apimart' && isLegacyApimartOmni(modelId)) return false;
  const definition = BUILT_IN_PROVIDER_DEFINITIONS.find((item) => item.id === catalogId);
  return !definition?.hiddenModelIds?.includes(modelId);
}

const PROVIDER_DEFINITION_MAP = new Map(
  BUILT_IN_PROVIDER_DEFINITIONS.map((definition) => [definition.id, definition]),
);

/**
 * 落库的目录缓存上限。catalogModels 只是「下次打开对话框免去重新拉取」的缓存，
 * 而中转站 /models 常返回上千个模型，全量存进 config 会跟着每次 saveConfig
 * 重新序列化一遍。已勾选的模型是真配置，一个都不能丢，超出部分才截断。
 */
export const MAX_CACHED_CATALOG_MODELS = 300;

export function capCatalogModels(
  models: ProviderModelSelection[],
  selectedIds: ReadonlySet<string>,
): ProviderModelSelection[] {
  if (models.length <= MAX_CACHED_CATALOG_MODELS) return models;
  const selected = models.filter((model) => selectedIds.has(model.id));
  const remaining = MAX_CACHED_CATALOG_MODELS - selected.length;
  if (remaining <= 0) return selected;
  return [...selected, ...models.filter((model) => !selectedIds.has(model.id)).slice(0, remaining)];
}

export function getProviderDefinitions(): readonly ProviderDefinition[] {
  return BUILT_IN_PROVIDER_DEFINITIONS;
}

export function isWebSearchProviderId(value: string | undefined): value is WebSearchProviderId {
  return WEB_SEARCH_PROVIDER_IDS.includes(value as WebSearchProviderId);
}

export function getWebSearchProviderDefinitions(): readonly ProviderDefinition[] {
  return BUILT_IN_PROVIDER_DEFINITIONS.filter((definition) => definition.kind === 'web-search');
}

export function resolveWebSearchProviderId(
  config: Pick<AppConfig, 'providers' | 'webSearchProviderId'>,
): WebSearchProviderId | undefined {
  const configured = (providerId: WebSearchProviderId) =>
    Boolean(config.providers[providerId]?.apiKey?.trim());
  if (isWebSearchProviderId(config.webSearchProviderId) && configured(config.webSearchProviderId)) {
    return config.webSearchProviderId;
  }
  if (configured('tavily')) return 'tavily';
  return WEB_SEARCH_PROVIDER_IDS.find(configured);
}

/**
 * 连接 ID：内置厂商每种只允许一条连接，直接用目录 ID；
 * 自定义接口可以有多条，加随机后缀区分。
 */
export function createConnectionId(providerId: string): string {
  if (providerId !== 'custom-openai' && providerId !== 'workflow-api') return providerId;
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8)
    ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  return `${providerId === 'workflow-api' ? 'workflow-api' : 'custom'}-${suffix}`;
}

export function getProviderDefinition(
  providerId: string,
  config?: Pick<ApiProviderConfig, 'catalogId'>,
): ProviderDefinition | undefined {
  const id = config?.catalogId || providerId;
  return PROVIDER_DEFINITION_MAP.get(id === 'autodl-workflow' ? 'workflow-api' : id);
}

/**
 * ★★ 「这条连接的可用模型清单**只能由连接自己回答**吗？」——**定义驱动**，没有任何厂商名单。
 *
 * 用途：决定该连接的 `selectedModels` 是否要镜像进 `config.generalModels`
 * （`store/store.config.ts` 的 `syncProviderModels`）。镜像的必要性来自**归属**：
 *
 *   · `true`  = 这个目录的候选**不在** `components/nodes/shared/defaultModels.ts` 的静态品牌分组里
 *               ⇒ 不镜像就永远选不到（节点下拉与 Agent 候选取的都是 `generalModels`）；
 *   · `false` = 这个目录的候选由静态品牌分组呈现
 *               （`defaultModelGroups` 里的 apimart / volcengine / grsai / dreamina / runninghub）
 *               ⇒ 再镜像一份只会让下拉出现重复项。
 *
 * 判据全部取自**定义自己的声明**（所以新增厂商只写定义、不改任何名单）：
 *   · `models`          —— 随应用发布的内置清单（cccapi / xai / google / sora2u）；
 *   · `modelSources`    —— 声明式现拉来源，清单按这条连接的 Key 现问（tudou）；
 *   · 连地址都要用户填 —— 没有默认地址的纯自定义接口（custom-openai）：
 *                        连上游是谁都不由应用决定 ⇒ 也没有任何静态目录能回答它的模型。
 * 搜索类（`kind: 'web-search'`）与工作流类（`kind: 'workflow-api'`）不产出模型。
 *
 * ⚠️ 反例必须保持 `false`：apimart / volcengine（`openai-compatible` + 默认地址 + **无** `models`）
 *    靠 `defaultModelGroups` 的静态分组出候选 —— 按「openai-compatible 就走 general 通路」判会
 *    让它们在下拉里各出现两份（`defaultModels.test.ts` 有钉子）。
 */
export function providerDefinitionOwnsConnectionModelList(
  definition: ProviderDefinition | undefined,
): boolean {
  if (!definition) return false;
  if (definition.kind !== undefined && definition.kind !== 'model') return false;
  if (definition.models !== undefined) return true;
  if (definition.modelSources !== undefined) return true;
  return definition.allowCustomBaseUrl === true && definition.defaultBaseUrl === undefined;
}

/** `providerDefinitionOwnsConnectionModelList` 的连接级包装：按该连接的 `catalogId` 查定义。 */
export function connectionOwnsModelList(
  provider: Pick<ApiProviderConfig, 'catalogId'> | undefined,
): boolean {
  if (!provider) return false;
  return providerDefinitionOwnsConnectionModelList(getProviderDefinition(provider.catalogId ?? ''));
}

function inferModelCategory(modelId: string): GeneralModelCategory {
  const id = modelId.toLowerCase();
  if (/tts|speech|audio|music|voice|whisper|transcri/.test(id)) return 'audio';
  // minimax-h3 及其 Context-IR / Regeneration 变体均为视频生成模型；
  // 中转站/自定义目录可能返回 MiniMax_H3、MiniMax H3 等写法，统一按分隔符变体识别。
  if (/video|seedance|sora|veo|kling|hailuo|wan\d|skyreels|vidu|minimax[-\s_.]?h3/.test(id)) return 'video';
  if (/image|seedream|imagen|flux|banana|midjourney|recraft|dall-e/.test(id)) return 'image';
  return 'text';
}

function readCatalogItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.models)) return record.models;
  return [];
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  return items.length > 0 ? items : undefined;
}

function readNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  return items.length > 0 ? items : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}



function parseVideoCapability(
  record: Record<string, unknown>,
  category: GeneralModelCategory,
): ProviderModelSelection['videoCapability'] {
  if (category !== 'video') return undefined;
  const durations = readNumberArray(record.durations);
  const durationRange = readRecord(record.duration_range ?? record.durationRange);
  const referenceLimits = readRecord(record.reference_limits ?? record.referenceLimits);
  const capability: NonNullable<ProviderModelSelection['videoCapability']> = {
    durations,
    minDuration: readFiniteNumber(durationRange?.min) ?? (durations ? Math.min(...durations) : undefined),
    maxDuration: readFiniteNumber(durationRange?.max) ?? (durations ? Math.max(...durations) : undefined),
    defaultDuration: readFiniteNumber(record.default_duration ?? record.defaultDuration),
    ratios: readStringArray(record.aspect_ratios ?? record.aspectRatios),
    defaultRatio: typeof (record.default_aspect_ratio ?? record.defaultAspectRatio) === 'string'
      ? String(record.default_aspect_ratio ?? record.defaultAspectRatio)
      : undefined,
    resolutions: readStringArray(record.resolutions),
    defaultResolution: typeof (record.default_resolution ?? record.defaultResolution) === 'string'
      ? String(record.default_resolution ?? record.defaultResolution)
      : undefined,
    maxImageReferences: readFiniteNumber(referenceLimits?.image),
    maxVideoReferences: readFiniteNumber(referenceLimits?.video),
    maxAudioReferences: readFiniteNumber(referenceLimits?.audio),
    supportsStandaloneAudio: record.supports_audio === true ? true : undefined,
    requiresReference: record.supports_text_only === false ? true : undefined,
  };
  return Object.values(capability).some((value) => value !== undefined) ? capability : undefined;
}

function parseCatalogItem(
  item: unknown,
  providerId: string,
  protocol: ChatApiProtocol,
): ProviderModelSelection | null {
  if (typeof item === 'string') {
    const id = item.trim();
    return id ? { id, name: id, category: inferModelCategory(id), provider: providerId } : null;
  }
  if (!item || typeof item !== 'object') return null;

  const record = item as Record<string, unknown>;
  const rawId = record.id ?? record.model ?? record.model_id
    ?? (protocol === 'gemini-native' ? record.name : undefined);
  if (typeof rawId !== 'string' || !rawId.trim()) return null;
  const id = protocol === 'gemini-native'
    ? normalizeGeminiModelId(rawId)
    : rawId.trim();
  const rawName = protocol === 'gemini-native'
    ? record.display_name ?? record.displayName
    : record.name ?? record.display_name ?? record.displayName;
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : id;
  const category = inferModelCategory(id);
  const supportsImageInput = record.supports_image === true || record.supportsImage === true;
  return {
    id,
    name,
    category,
    provider: providerId,
    inputModalities: supportsImageInput ? ['text', 'image'] : undefined,
    videoCapability: parseVideoCapability(record, category),
  };
}

/** 补充元数据的索引键：模型名大小写不敏感（厂商价目表里写法不统一）。 */
function modelKey(modelId: string): string {
  return modelId.trim().toLowerCase();
}

/**
 * 读 new-api 系（土豆等）`GET /api/pricing` 的响应，解析出**按模型名索引的补充元数据**。
 *
 * 逐字对照落盘样本 `D:\DEEPSEEK\_r129-tudou-pricing.json`（2026 实取）：
 * ```
 * { "data": [{ "model_name": "...", "vendor_id": 1, "description": "...",
 *              "supported_endpoint_types": ["openai"] }],
 *   "vendors": [{ "id": 1, "name": "OpenAI" }] }
 * ```
 * 只做**通用结构读取**（`model_name` / `vendor_id` / `vendors[].id→name` /
 * `supported_endpoint_types` / `description`），不认厂商名 —— 换一家 new-api 站点同样适用。
 *
 * ⚠️ 这里**只补元数据、不产出模型**：模型清单的权威来源永远是带 Key 的 `/v1/models`，
 *    价目表里有、但该 Key 用不了的模型不能被当成「可用模型」塞进去。
 */
export function parseNewApiPricingEnrichment(payload: unknown): ProviderModelEnrichment {
  const enrichment: ProviderModelEnrichment = new Map();
  const root = readRecord(payload);
  if (!root) return enrichment;

  /* `vendors[]` 是 `vendor_id → name` 表（`vendor_id` 本身只是数字） */
  const vendorNames = new Map<number, string>();
  if (Array.isArray(root.vendors)) {
    for (const item of root.vendors) {
      const record = readRecord(item);
      const id = readFiniteNumber(record?.id);
      const name = typeof record?.name === 'string' ? record.name.trim() : '';
      if (id !== undefined && name) vendorNames.set(id, name);
    }
  }

  const rows = Array.isArray(root.data) ? root.data : [];
  for (const item of rows) {
    const record = readRecord(item);
    if (!record) continue;
    const name = typeof record.model_name === 'string'
      ? record.model_name.trim()
      : (typeof record.model === 'string' ? record.model.trim() : '');
    if (!name) continue;
    const vendorId = readFiniteNumber(record.vendor_id);
    const description = typeof record.description === 'string' && record.description.trim()
      ? record.description.trim()
      : undefined;
    enrichment.set(modelKey(name), {
      vendorLabel: vendorId !== undefined ? vendorNames.get(vendorId) : undefined,
      endpointTypes: readStringArray(record.supported_endpoint_types),
      description,
    });
  }
  return enrichment;
}

function normalizeModels(
  models: ProviderModelSelection[],
  providerId: string,
  /** 连接信息 —— 归一化「哪个平台」时要用（自定义连接的 catalogId 都一样，只能靠域名区分）*/
  connection?: { catalogId?: string; baseUrl?: string },
  /**
   * Adapter 解析出来的**平台原始条目**（按调用 id 索引）。
   * 里面可能带平台声明的原厂字段（`official_model` / `base_model` / `aliases`）——
   * 归一化器第 3 档「平台返回的明确官方模型标识」就靠它；不给就只走映射表与官方 id 精确匹配。
   */
  rawById?: Map<string, ProviderRawModel>,
): ProviderModelSelection[] {
  const unique = new Map<string, ProviderModelSelection>();
  for (const model of models) {
    const id = model.id.trim();
    if (!id || unique.has(id)) continue;
    /* ★ 平台调用 id 原样保留（`id` 就是要发出去的那串），归一化结果另存 `normalized` */
    const raw = rawById?.get(id);
    unique.set(id, stampNormalized(
      { ...model, id, name: model.name.trim() || id, provider: providerId },
      { connectionKey: providerId, ...connection },
      raw,
    ));
  }
  return [...unique.values()].sort((left, right) =>
    /* ⚠️ 排序也按**展示名**（用户看到的是它）—— 平台原始名只作兜底 */
    displayNameOfSelection(left).localeCompare(displayNameOfSelection(right), 'zh-CN', { sensitivity: 'base' }),
  );
}

/** 取目录条目的展示名：优先归一化结果，旧数据实时算。 */
export function displayNameOfSelection(model: ProviderModelSelection): string {
  if (model.normalized) return model.normalized.displayName;
  return normalizedModelOf({
    providerId: model.provider,
    providerModelId: model.id,
    raw: { providerModelId: model.id, providerName: model.name },
  }).displayName;
}

function mergeRemoteCatalogMetadata(
  remoteModels: ProviderModelSelection[],
  fallbackModels: ProviderModelSelection[],
): ProviderModelSelection[] {
  const fallbackById = new Map(fallbackModels.map((model) => [model.id, model]));
  return remoteModels.map((remote) => {
    const fallback = fallbackById.get(remote.id);
    if (!fallback) return remote;
    return {
      ...fallback,
      ...remote,
      description: remote.description ?? fallback.description,
      inputModalities: remote.inputModalities ?? fallback.inputModalities,
      executionProfile: remote.executionProfile ?? fallback.executionProfile,
      imageReferenceRequestMode: remote.imageReferenceRequestMode
        ?? fallback.imageReferenceRequestMode,
      videoCapability: remote.videoCapability || fallback.videoCapability
        ? { ...fallback.videoCapability, ...remote.videoCapability }
        : undefined,
    };
  });
}

function safeCatalogError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return '模型列表拉取已取消';
  if (error instanceof Error && /^模型列表拉取失败 \(HTTP \d{3}\)$/.test(error.message)) {
    return error.message;
  }
  return '无法连接模型目录，请检查接口地址、网络和 API Key';
}

async function fetchCatalogResponse(
  url: string,
  apiKey: string,
  protocol: ChatApiProtocol,
  signal?: AbortSignal,
): Promise<Response> {
  const headers = apiKey ? getChatApiHeaders(protocol, apiKey, false) : undefined;
  return corsSafeFetch(url, { method: 'GET', headers, signal });
}

/* ── ★ 声明式模型来源（`ProviderModelSource`）的解析与取数 ─────────────────── */

/**
 * 该厂商的**权威模型来源**。没声明 `modelSources` ⇒ 沿用既有的 `modelsPath`（OpenAI 兼容 `/models`），
 * 行为与改动前**逐字一致**。
 */
function primaryModelSource(definition: ProviderDefinition): ProviderModelSource {
  return definition.modelSources?.find((source) => !source.parseEnrichment && !source.parseEntitlements)
    ?? { path: definition.modelsPath || '/models', auth: 'connection-key' };
}

/** 补充来源（可能有多个），都在权威来源成功之后才取。补充来源不产出模型。 */
function enrichmentModelSources(definition: ProviderDefinition): readonly ProviderModelSource[] {
  return definition.modelSources?.filter((source) =>
    Boolean(source.parseEnrichment) || Boolean(source.parseEntitlements)) ?? [];
}

/**
 * 把来源声明里的 `{origin}` / `{baseUrl}` 占位展开成真实地址。
 *
 * 解析基准（**沿用既有的 `${baseUrl}${path}` 字符串拼接语义**）：
 *   · `/models`、`/v1/models` 这类相对路径 ⇒ 拼在**连接地址**后面；
 *   · `{origin}/api/pricing` 这类站点根地址 ⇒ 拼在**站点根**后面（不带 `/v1`）；
 *   · 展开后已是绝对地址 ⇒ 原样使用。
 *
 * ⚠️ **不能用 `new URL(path, baseUrl)` 解析绝对路径** ✗ —— URL 规范里以 `/` 开头的路径会
 *    **整体替换** base 的 pathname ⇒ 连接地址是 `https://host/v1` 时会被解析成
 *    `https://host/models`，`/v1` 被悄悄丢掉（实测踩到：请求打到了不存在的 `/models`）。
 */
function resolveModelSourceUrl(source: ProviderModelSource, baseUrl: string): string | null {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return null;
  }
  const declared = source.path;
  if (!declared) return null;
  /* 站点根地址（`{origin}/…`）带不带协议都认 —— 两种写法都拼在 origin 上 */
  const onOrigin = declared.includes('{origin}') || /^[a-z][a-z\d+.-]*:\/\//i.test(declared);
  const prefix = onOrigin ? origin : baseUrl.replace(/\/+$/, '');
  const tail = declared
    .replace(/\{origin\}/gi, '')
    .replace(/\{baseUrl\}/gi, '');
  const combined = `${prefix}/${tail.replace(/^\/+/, '')}`;
  try {
    /* 只做合法性校验：路径里的 `{{…}}` 模板占位原样保留，不做 URL 规范化 */
    new URL(combined);
    return combined;
  } catch {
    return null;
  }
}

/**
 * 该来源要探测的候选地址。
 *
 * ⚠️ `baseUrl` 与「实际请求的 url」**不是一回事**：来源路径挂在站点根（`{origin}/…`）时，
 *    请求地址在站点根上，而连接地址仍然是 `/v1` 那一条 —— 回写给用户的必须是后者。
 */
interface ModelSourceCandidate {
  url: string;
  baseUrl: string;
}

function modelSourceCandidates(
  source: ProviderModelSource,
  config: ApiProviderConfig,
  definition: ProviderDefinition,
): ModelSourceCandidate[] {
  const raw = config.baseUrl || definition.defaultBaseUrl || '';
  const bases = source.probeBaseUrlCandidates === false
    ? [raw]
    : baseUrlCandidates(raw, resolveChatApiProtocol(config.chatApiProtocol));
  const out: ModelSourceCandidate[] = [];
  for (const candidate of bases) {
    const url = resolveModelSourceUrl(source, candidate);
    if (url) out.push({ url, baseUrl: candidate.replace(/\/+$/, '') });
  }
  return out;
}

interface CatalogPayload {
  payload: unknown;
  /** 本条来源解析出的模型条目（**未经归一化**），以及平台原始条目 */
  models: ProviderModelSelection[];
  rawById: Map<string, ProviderRawModel>;
}

/** 把一条来源的成功响应解析成模型条目（不含来源结构信息）。 */
function parseCatalogPayload(
  payload: unknown,
  definition: ProviderDefinition,
  providerId: string,
  protocol: ChatApiProtocol,
  baseUrl: string,
): CatalogPayload {
  /* ★ 平台标识：域优先（用户自建的中转站 catalogId 都是 custom-openai，只能靠域名定位）*/
  const platformId = resolveProviderId({ connectionKey: providerId, catalogId: definition.id, baseUrl });
  const adapter = getProviderAdapter(platformId);
  /** Adapter 解析出的**平台原始条目**（含平台声明的原厂字段）—— 归一化第 3 档要用 */
  const rawById = new Map<string, ProviderRawModel>();
  const models = readCatalogItems(payload)
    .map((item) => {
      const selection = parseCatalogItem(item, providerId, protocol);
      if (!selection) return null;
      const parsed = adapter.parseModel(item);
      if (parsed) rawById.set(parsed.providerModelId, parsed);
      return selection;
    })
    .filter((item): item is ProviderModelSelection => (
      item !== null && isProviderModelVisible(definition.id, item.id)
    ));
  return { payload, models, rawById };
}

/** 按一条来源取「该连接可用的模型清单」。HTTP 元信息与解析器一致。 */
async function fetchCatalogFromSource(
  source: ProviderModelSource,
  url: string,
  definition: ProviderDefinition,
  providerId: string,
  config: ApiProviderConfig,
  signal?: AbortSignal,
): Promise<CatalogPayload> {
  const requestUrl = new URL(url);
  for (const [key, value] of Object.entries(definition.requestQuery ?? {})) {
    requestUrl.searchParams.set(key, value);
  }
  const apiKey = source.auth === 'connection-key' ? config.apiKey : '';
  const response = await fetchCatalogResponse(
    requestUrl.toString(),
    apiKey,
    resolveChatApiProtocol(config.chatApiProtocol),
    signal,
  );
  if (!response.ok) throw new Error(`模型列表拉取失败 (HTTP ${response.status})`);
  const payload: unknown = await response.json().catch(() => null);
  const parsed = parseCatalogPayload(
    payload,
    definition,
    providerId,
    resolveChatApiProtocol(config.chatApiProtocol),
    url,
  );
  if (parsed.models.length === 0) throw new Error('模型列表拉取失败 (HTTP 200)');
  return parsed;
}

/**
 * 取**补充数据**（new-api 的匿名 `/api/pricing` 同时给元数据与分组权益）。
 *
 * ⚠️ 补充来源**必须完全静默失败**：它只让清单更有信息量，
 *    挂了不能把已经拉到的权威清单一起判死。
 */
async function fetchEnrichmentFromSource(
  source: ProviderModelSource,
  url: string,
  config: ApiProviderConfig,
  signal?: AbortSignal,
): Promise<ProviderEnrichmentResult | null> {
  try {
    const response = await fetchCatalogResponse(
      url,
      source.auth === 'connection-key' ? config.apiKey : '',
      resolveChatApiProtocol(config.chatApiProtocol),
      signal,
    );
    if (!response.ok) return null;
    const payload: unknown = await response.json().catch(() => null);
    return {
      enrichment: source.parseEnrichment?.(payload),
      entitlements: source.parseEntitlements?.(payload) ?? null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return null;
  }
}

/** 一条补充来源的解析结果：元数据与权益各一份，都可以缺席。 */
interface ProviderEnrichmentResult {
  enrichment: ProviderModelEnrichment | undefined;
  entitlements: ProviderEntitlementsPayload | null;
}

/**
 * 权威清单拉通后，再补元数据与权益（同一条已解析的连接地址；失败静默）。
 * 每条来源各自探测自己的候选地址 —— 有的挂在 `/v1` 下，有的挂在站点根。
 *
 * ★ **权益只在这里记录**（`recordProviderEntitlements`）：只有拿到 ① 的**权威清单**之后，
 *   才谈得上「反推这条连接属于哪个分组」（判据要两个清单的交集）。
 *   顺序反了就会把「价目表有售」误当「该 key 可用」✗。
 */
export async function applyCatalogEnrichment(
  models: ProviderModelSelection[],
  resolvedBaseUrl: string,
  definition: ProviderDefinition,
  providerId: string,
  config: ApiProviderConfig,
  signal?: AbortSignal,
): Promise<{ models: ProviderModelSelection[]; entitlements?: ProviderConnectionEntitlement; listedKeys?: ReadonlySet<string> }> {
  const sources = enrichmentModelSources(definition);
  if (sources.length === 0) return { models };
  const scoped: ApiProviderConfig = { ...config, baseUrl: resolvedBaseUrl };
  let enriched = models;
  let entitlements: ProviderConnectionEntitlement | null = null;
  /* ★ 价目表里出现过的模型名集合（归一化键）—— 用于把「价目表根本没收录」的模型剔掉。 */
  let listedKeys: ReadonlySet<string> | undefined;
  for (const source of sources) {
    for (const { url } of modelSourceCandidates(source, scoped, definition)) {
      const result = await fetchEnrichmentFromSource(source, url, config, signal);
      if (!result) continue;
      if (result.enrichment) {
        enriched = mergeModelEnrichment(enriched, result.enrichment);
        if (result.enrichment.size > 0) listedKeys = new Set(result.enrichment.keys());
      }
      /* ★ 权益的判据是**权威清单**（`models`），不是价目表 —— 见本函数头 */
      if (result.entitlements) {
        entitlements = recordProviderEntitlements(
          providerId,
          result.entitlements,
          models.map((model) => model.id),
        );
      }
      break;
    }
  }
  return { models: enriched, entitlements: entitlements ?? undefined, listedKeys };
}

/**
 * 把补充元数据并进清单（按模型名归一化键匹配）。
 *
 * ⚠️ **不新增模型**、**不覆盖**权威来源已有的字段，只填空：
 *    「这条连接用哪些模型」只能由带 Key 的权威来源回答。
 */
function mergeModelEnrichment(
  models: ProviderModelSelection[],
  entries: ProviderModelEnrichment,
): ProviderModelSelection[] {
  if (entries.size === 0) return models;
  return models.map((model) => {
    const entry = entries.get(modelKey(model.id));
    if (!entry) return model;
    const context: string[] = [];
    if (entry.vendorLabel) context.push(entry.vendorLabel);
    if (entry.endpointTypes?.length) context.push(entry.endpointTypes.join(' / '));
    const description = model.description
      ?? (context.length > 0 ? context.join(' · ') : entry.description);
    if (description === model.description) return model;
    return { ...model, description };
  });
}

async function fetchOpenAiCompatibleCatalog(
  definition: ProviderDefinition,
  providerId: string,
  config: ApiProviderConfig,
  signal?: AbortSignal,
): Promise<{ models: ProviderModelSelection[]; baseUrl: string }> {
  const source = primaryModelSource(definition);
  const candidates = modelSourceCandidates(source, config, definition);
  if (candidates.length === 0) throw new Error('请填写接口地址');

  let lastError: unknown;
  for (const { url, baseUrl } of candidates) {
    try {
      const parsed = await fetchCatalogFromSource(
        source,
        url,
        definition,
        providerId,
        config,
        signal,
      );
      const models = normalizeModels(
        parsed.models,
        providerId,
        { catalogId: definition.id, baseUrl },
        parsed.rawById,
      );
      return { models, baseUrl };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('模型列表拉取失败');
}

export async function fetchProviderModelCatalog(
  options: FetchProviderCatalogOptions,
): Promise<ProviderCatalogResult> {
  const { providerId, config, fallbackModels = [], signal } = options;
  /* ★ 权益的缓存键 = **连接 key**（不是 `providerId`/`definition.id`）—— 见 `FetchProviderCatalogOptions.connectionId` */
  const entitlementKey = options.connectionId?.trim() || providerId;
  if (signal?.aborted) throw new DOMException('模型列表拉取已取消', 'AbortError');
  const definition = getProviderDefinition(providerId, config);
  if (!definition) throw new Error('未知厂商目录');
  const normalizedFallback = normalizeModels(fallbackModels, providerId, {
    catalogId: definition.id,
    baseUrl: config.baseUrl || definition.defaultBaseUrl,
  })
    .filter((model) => isProviderModelVisible(definition.id, model.id));

  if (definition.id === 'runninghub-model') {
    const { RUNNINGHUB_MODEL_MANIFEST, RUNNINGHUB_LEGACY_MODELS, getRunningHubModel, normalizeRunningHubModelId } = await import('./providers/runninghubModelManifest');
    const models = new Map<string, ProviderModelSelection>();
    for (const id of Object.keys(RUNNINGHUB_LEGACY_MODELS)) {
      const model = getRunningHubModel(id)!;
      models.set(id, { id, name: id, provider: 'runninghub', category: model.kind, description: '兼容已有选择；按图片引用自动切换生成或编辑' });
    }
    for (const model of normalizedFallback) {
      const id = normalizeRunningHubModelId(model.id);
      if (getRunningHubModel(id)) models.set(id, { ...model, id });
    }
    for (const model of RUNNINGHUB_MODEL_MANIFEST) models.set(model.id, {
      id: model.id, name: model.label, provider: 'runninghub', category: model.kind, description: model.id,
      inputModalities: [...new Set(model.parameters.flatMap((field) => field.binding === 'prompt' ? ['text' as const] : field.mediaKind === 'image' ? ['image' as const] : []))],
    });
    /* ★ 运行清单是**本地**的，也要盖章：界面读 `normalized.displayName`，不再读 `name` */
    return {
      models: [...models.values()].map((model) =>
        stampNormalized(model, { connectionKey: providerId, catalogId: definition.id })),
      source: 'local-manifest',
    };
  }
  if (definition.catalogAdapter === 'local-manifest') {
    return { models: normalizedFallback, source: 'local-manifest' };
  }

  try {
    const { models, baseUrl } = await fetchOpenAiCompatibleCatalog(
      definition,
      providerId,
      config,
      signal,
    );
    /* ★ 权威清单到手后才补元数据与权益（声明式；没有声明就是恒等变换） */
    const enrichment = await applyCatalogEnrichment(
      models,
      baseUrl,
      definition,
      entitlementKey,
      config,
      signal,
    );
    const enrichedModels = enrichment.models;
    /* ★★ 把「厂商公开价目表里根本没收录」的模型**剔出去**（用户 2026 口径：土豆都没有，你拉了干啥？）。
       判据：拿到过非空价目表快照（`listedKeys`）才过滤；拿不到 ⇒ **不过滤**（fail-open，不猜）。
       ⚠️ 权威清单仍是 `/v1/models`：这里不是「用价目表决定有哪些模型」，而是
         「`/v1/models` 会列出平台自己都没有的模型（实测其中一个回 503 No available channel）⇒ 过滤掉」。
       剔掉的**数量**要回传（不许静默），见 `droppedUnlisted`。 */
    const keptModels = enrichment.listedKeys
      ? enrichedModels.filter((model) => enrichment.listedKeys!.has(modelKey(model.id)))
      : enrichedModels;
    const droppedUnlisted = enrichedModels.length - keptModels.length;
    return {
      models: mergeRemoteCatalogMetadata(
        definition.id === 'apimart'
          ? [
              ...keptModels.map((remote) => {
                const omni = APIMART_OMNI_MODELS.find((model) => model.id === remote.id);
                return omni ? { ...remote, ...omni, provider: providerId } : remote;
              }),
              ...APIMART_OMNI_MODELS.filter((model) => normalizedFallback.some((item) => item.id === model.id)
                && !keptModels.some((remote) => remote.id === model.id))
                .map((model) => ({ ...model, provider: providerId })),
            ]
          : keptModels,
        normalizedFallback,
      ),
      source: 'remote',
      resolvedBaseUrl: baseUrl,
      entitlements: enrichment.entitlements,
      ...(droppedUnlisted > 0 ? { droppedUnlisted } : {}),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    const warning = safeCatalogError(error);
    if (normalizedFallback.length > 0) {
      return { models: normalizedFallback, source: 'local-fallback', warning };
    }
    throw new Error(warning, { cause: error });
  }
}
