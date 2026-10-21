/**
 * 「选择 API 厂商」可选清单 + 土豆（new-api 系）模型来源。
 *
 * 两条纪律：
 *  1. 下架**只是从选择框里下架** —— 定义 / 适配器 / 既有连接必须全部保留（删定义会连锁破坏）；
 *  2. 土豆的模型清单来源是**声明式的通用能力**：`GET /v1/models`（带 Key）出清单、
 *     匿名 `GET /api/pricing` 只补元数据，**绝不新增模型**。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  connectionOwnsModelList,
  fetchProviderModelCatalog,
  getProviderDefinition,
  getProviderDefinitions,
  HIDDEN_FROM_PROVIDER_PICKER_IDS,
  providerDefinitionOwnsConnectionModelList,
  selectableProviderDefinitions,
  type ProviderDefinition,
} from '../../src/services/ai/providerCatalogService';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function pickerIds(options?: Partial<{
  initialDefinitionId: string;
  connectedProviderIds: readonly string[];
  hasWebSearchConnection: boolean;
  isWebSearchProvider: boolean;
}>): string[] {
  return selectableProviderDefinitions(getProviderDefinitions(), {
    initialDefinitionId: options?.initialDefinitionId ?? '',
    connectedProviderIds: options?.connectedProviderIds ?? [],
    hasWebSearchConnection: options?.hasWebSearchConnection ?? false,
    isWebSearchProvider: options?.isWebSearchProvider ?? false,
  }).map((item) => item.id);
}

describe('选择 API 厂商 —— 可选清单', () => {
  it('新建连接时不再列出用户指定下架的厂商', () => {
    const listed = pickerIds();
    for (const hidden of HIDDEN_FROM_PROVIDER_PICKER_IDS) {
      expect(listed, `${hidden} 不应出现在选择框里`).not.toContain(hidden);
    }
    // 逐项对照用户给的名单（避免以后有人「顺手」改常量却没人发现）
    for (const removed of ['cccapi', 'google', 'volcengine', 'grsai', 'tavily', 'xai', 'sora2u', 'dreamina']) {
      expect(listed).not.toContain(removed);
    }
  });

  it('保留的厂商都在：工作流 API / APIMart / RunningHub / 土豆 / 自定义接口', () => {
    const listed = pickerIds();
    expect(listed).toContain('workflow-api');
    expect(listed).toContain('apimart');
    expect(listed).toContain('runninghub-model');
    expect(listed).toContain('tudou');
    expect(listed).toContain('custom-openai');
  });

  it('下架厂商的定义仍然保留（既有连接、适配器与映射表都还在用）', () => {
    for (const hidden of HIDDEN_FROM_PROVIDER_PICKER_IDS) {
      expect(getProviderDefinition(hidden), `${hidden} 的定义被删了`).toBeDefined();
    }
  });

  it('正在编辑的那条连接仍列出来（否则用户认不出自己在改什么）', () => {
    expect(pickerIds({ initialDefinitionId: 'grsai' })).toContain('grsai');
    expect(pickerIds({ initialDefinitionId: 'tudou' })).toContain('tudou');
  });
});

describe('土豆厂商定义', () => {
  it('按实测登记：名称 / 默认地址 / 字段 / 模型来源', () => {
    const definition = getProviderDefinition('tudou');
    expect(definition).toMatchObject({
      id: 'tudou',
      name: '土豆',
      authType: 'api-key',
      catalogAdapter: 'openai-compatible',
      defaultBaseUrl: 'https://api.ai-tudou.net/v1',
      modelsPath: '/models',
    });
    // API Key 必填；baseUrl 可选可改
    expect(definition?.credentials.find((field) => field.key === 'apiKey')?.required).toBe(true);
    expect(definition?.credentials.find((field) => field.key === 'baseUrl')?.required).toBe(false);
    // 不内置模型清单：可用模型一律现拉（不硬编码会过期的名单）
    expect(definition?.models ?? []).toHaveLength(0);
    // 来源是声明式的：① 权威清单（带 Key）② 补充元数据（匿名）
    expect(definition?.modelSources?.map((source) => [source.path, source.auth])).toEqual([
      ['/models', 'connection-key'],
      ['{origin}/api/pricing', 'none'],
    ]);
  });

  it('土豆已登记在平台表里，归一化解析得到 providerId=tudou（映射表才能命中）', () => {
    expect(getProviderDefinition('tudou')?.id).toBe('tudou');
  });
});

describe('土豆模型来源（通用能力，不是厂商专属逻辑）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('清单只来自带 Key 的 /v1/models；匿名价目表只补元数据、不新增模型', async () => {
    const fetchMock = vi.fn()
      // ① 权威清单：该 Key 实际可用的模型
      .mockResolvedValueOnce(jsonResponse({
        object: 'list',
        data: [
          { id: 'gpt-5.5', object: 'model' },
          { id: 'gpt-image-2.5-flare-async', object: 'model' },
        ],
      }))
      // ② 补充元数据：站点公开价目表（匿名）
      .mockResolvedValueOnce(jsonResponse({
        vendors: [{ id: 1, name: 'OpenAI' }],
        data: [
          { model_name: 'gpt-5.5', vendor_id: 1, supported_endpoint_types: ['openai'], description: '通用文本' },
          {
            model_name: 'gpt-image-2.5-flare-async',
            vendor_id: 1,
            supported_endpoint_types: ['异步文生图+图生图'],
          },
          // ⚠️ 价目表里有、但该 Key 用不了的模型 —— 不能被塞进清单
          { model_name: 'key-cannot-use-this', vendor_id: 1, supported_endpoint_types: ['openai'] },
        ],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProviderModelCatalog({
      providerId: 'tudou',
      config: {
        name: '土豆',
        apiKey: 'test-key-not-a-real-credential',
        catalogId: 'tudou',
      },
    });

    /* ① 清单端点：OpenAI 兼容标准端点 + 本连接的 Key（不填 baseUrl ⇒ 用厂商默认地址） */
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.ai-tudou.net/v1/models');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer test-key-not-a-real-credential' },
    });
    /* ② 补充来源：匿名（**不发** Authorization），挂在站点根而不是 /v1 下 */
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.ai-tudou.net/api/pricing');
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string> | undefined)?.Authorization)
      .toBeUndefined();

    expect(result.source).toBe('remote');
    expect(result.resolvedBaseUrl).toBe('https://api.ai-tudou.net/v1');

    // 清单 = 该 Key 能用的两个，价目表里多出来的那个**不在**
    const ids = result.models.map((model) => model.id).sort();
    expect(ids).toEqual(['gpt-5.5', 'gpt-image-2.5-flare-async']);
    expect(result.models.find((model) => model.id === 'key-cannot-use-this')).toBeUndefined();

    // 元数据被并上去了（厂商名 + 端点形态）——这是补充来源存在的意义
    const text = result.models.find((model) => model.id === 'gpt-5.5');
    expect(text?.description).toContain('OpenAI');
    expect(text?.description).toContain('openai');
    // 分类仍按模型 id 推断（权威来源的判定不受补充元数据影响）
    expect(text?.category).toBe('text');
    expect(result.models.find((model) => model.id === 'gpt-image-2.5-flare-async')?.category).toBe('image');
  });

  it('补充来源失败不影响已经拉到的权威清单', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ object: 'list', data: [{ id: 'gpt-5.5', object: 'model' }] }))
      .mockRejectedValueOnce(new Error('pricing unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProviderModelCatalog({
      providerId: 'tudou',
      config: { name: '土豆', apiKey: 'test-key-not-a-real-credential', catalogId: 'tudou' },
    });

    expect(result.source).toBe('remote');
    expect(result.models.map((model) => model.id)).toEqual(['gpt-5.5']);
    expect(result.warning).toBeUndefined();
  });

  it('用户只填域名时按候选补 /v1（中转站最常见的漏填）', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ object: 'list', data: [{ id: 'gpt-5.5', object: 'model' }] }))
      .mockResolvedValueOnce(jsonResponse({ vendors: [], data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProviderModelCatalog({
      providerId: 'tudou',
      config: {
        name: '土豆',
        apiKey: 'test-key-not-a-real-credential',
        baseUrl: 'https://api.ai-tudou.net',
        catalogId: 'tudou',
      },
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'https://api.ai-tudou.net/models',
      'https://api.ai-tudou.net/v1/models',
      'https://api.ai-tudou.net/api/pricing',
    ]);
    expect(result.resolvedBaseUrl).toBe('https://api.ai-tudou.net/v1');
  });
});

/**
 * 「这条连接的模型清单**只能由连接自己回答**吗」—— 决定 `selectedModels` 要不要镜进
 * `generalModels`（`store/store.config.ts`）。以前是一份写死的 id 名单 ⇒ 新厂商（tudou）
 * 落盘了 35 条 `selectedModels` 却永远镜不过去，四类候选同时归零。
 */
describe('连接自有模型清单 —— 定义驱动判定（没有厂商名单）', () => {
  it('土豆与既有 5 个走 general 通路的 catalog 判定都为 true', () => {
    for (const catalogId of ['tudou', 'custom-openai', 'cccapi', 'xai', 'google', 'sora2u']) {
      expect(connectionOwnsModelList({ catalogId }), catalogId).toBe(true);
    }
  });

  it('有静态品牌分组的厂商保持 false（否则下拉会同时出现品牌分组与通用分组两份）', () => {
    for (const catalogId of ['apimart', 'volcengine', 'grsai', 'dreamina', 'runninghub-model']) {
      expect(connectionOwnsModelList({ catalogId }), catalogId).toBe(false);
    }
  });

  it('不产出模型的连接（搜索 / 工作流 API）保持 false', () => {
    for (const catalogId of ['tavily', 'bocha', 'zhipu-search', 'exa', 'workflow-api']) {
      expect(connectionOwnsModelList({ catalogId }), catalogId).toBe(false);
    }
  });

  it('没有 catalogId 的旧连接不被卷进来（与旧 `Set.has(config.catalogId ?? "")` 同判 false）', () => {
    expect(connectionOwnsModelList(undefined)).toBe(false);
    expect(connectionOwnsModelList({})).toBe(false);
    expect(connectionOwnsModelList({ catalogId: '' })).toBe(false);
    expect(connectionOwnsModelList({ catalogId: 'custom-2611fc0a' })).toBe(false);
  });

  it('★ 未来式：只加一条定义就自动可用，判定表一个字都不用改', () => {
    /* 合成定义 = 「以后新加一个厂商」的最小形态；这里**没有**任何地方登记过 `future-brand`。 */
    const future = {
      id: 'future-brand',
      name: '未来厂商',
      description: '',
      badgeText: 'FB',
      authType: 'api-key',
      catalogAdapter: 'openai-compatible',
      defaultBaseUrl: 'https://future.example/v1',
      allowCustomBaseUrl: true,
      credentials: [],
    } satisfies ProviderDefinition;

    // ① 只有默认地址、没有清单来源 ⇒ 与 apimart 同类：「模型靠静态品牌分组枚举」⇒ 不镜像
    expect(providerDefinitionOwnsConnectionModelList(future)).toBe(false);
    // ② 声明了声明式清单来源（土豆那种现拉）⇒ 自动算「连接自有」⇒ 立刻可镜像，没人改过名单
    expect(providerDefinitionOwnsConnectionModelList({
      ...future,
      modelSources: [{ path: '/models', auth: 'connection-key' as const }],
    })).toBe(true);
    // ③ 声明了内置清单（cccapi 那种随应用发布）⇒ 同样自动算「连接自有」
    expect(providerDefinitionOwnsConnectionModelList({ ...future, models: [] })).toBe(true);
    // ④ 纯自定义接口（没有默认地址 ⇒ 连上游是谁都得用户填）⇒ 也自动算「连接自有」
    expect(providerDefinitionOwnsConnectionModelList({
      ...future, defaultBaseUrl: undefined,
    })).toBe(true);
  });

  it('判定是**定义的属性**，不是 id 的：同一个 catalogId 换个定义就换个归属', () => {
    const asManifest = getProviderDefinitions().find((definition) => definition.id === 'cccapi');
    expect(asManifest && providerDefinitionOwnsConnectionModelList(asManifest)).toBe(true);
    /* 把 cccapi 的内置清单摘掉、又给它一个静态默认地址 ⇒ 判定立刻变 false（id 没变） */
    expect(asManifest && providerDefinitionOwnsConnectionModelList({
      ...asManifest, models: undefined, modelSources: undefined,
    })).toBe(false);
  });
});
