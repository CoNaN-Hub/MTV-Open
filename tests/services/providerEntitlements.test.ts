/**
 * 分组权益层（**MTV 增强**）—— P1 分组门 / P2 真实候选 / P3 折扣。
 *
 * ⚠️ 纪律：**不发真实网络**。所有带 fetch 的用例一律 `vi.stubGlobal('fetch', ...)`
 *    并用 `_r129-tudou-pricing.json` 的**形状**做 fixture（不放任何凭据，key 用占位符）。
 *
 * ⚠️ 取证备注：官方读的是**账号级** `isPayingCustomer`（`stripev2("customer/paying-status")`），
 *    官方侧**没有任何读 `enable_groups` / `usable_group` / `group_ratio` 的代码（NOT FOUND）**
 *    ⇒ 本文件测的全是 MTV 自己加的能力，不是官方行为。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyCandidateAvailability,
  clearProviderEntitlements,
  connectionAvailability,
  connectionCandidateAvailability,
  connectionLabel,
  entitlementModelKey,
  evaluateModelGate,
  getProviderEntitlements,
  inferConnectionGroup,
  isCandidateProvablyBlocked,
  isCandidateUnavailable,
  parseNewApiEntitlements,
  recordProviderEntitlements,
  resolveConnectionDiscount,
  resolveGroupRatio,
  upstreamModelIdOf,
} from '../../src/services/ai/providerEntitlements';
import { fetchProviderModelCatalog } from '../../src/services/ai/providerCatalogService';
import { estimateWithBilling, parseCreditPriceTable } from '../../src/services/ai/creditEstimate';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 实测样本 `D:\DEEPSEEK\_r129-tudou-pricing.json`（2026-10 实取）的**形状** +
 * 逐字照抄的 `group_ratio` / `usable_group` / `auto_groups`。
 *
 * ⚠️ `group_ratio` 里**确实没有** `vip-9折` / `vip-95折` / `vip-8折` / `vip-6折` ——
 *    这不是我们漏抄，是上游原文就缺（实测只有 6 条）。倍率由**组名的「N折」语义**得出。
 */
const PRICING_FIXTURE = {
  auto_groups: ['svip', 'vip', 'default'],
  group_ratio: {
    default: 1,
    svip: 1,
    vip: 1,
    test: 2,
    企业测试专线: 1.15,
    秋风专用: 3,
  },
  usable_group: {
    default: '默认分组',
    svip: 'svip分组',
    test: 'test分组，平台管理员专用分组',
    vip: 'vip分组',
    企业测试专线: '企业测试',
    秋风专用: '秋风专用',
  },
  data: [
    /* ① 这三条对 vip-9折 开放 ⇒ 该 key 实测能用 */
    { model_name: 'gpt-5.5', vendor_id: 1, quota_type: 0, model_ratio: 0.9, model_price: 0, enable_groups: ['default', 'svip', 'vip', 'vip-9折'] },
    { model_name: 'gpt-6-sol', vendor_id: 1, quota_type: 0, model_ratio: 0.25, model_price: 0, enable_groups: ['vip', 'vip-9折', 'default', 'svip'] },
    { model_name: 'gemini-nano-banana-2.1', vendor_id: 2, quota_type: 1, model_ratio: 0, model_price: 0.088, enable_groups: ['default', 'svip', 'vip', 'vip-95折', 'vip-9折', 'vip-8折'] },
    /* ② 这些都没有 vip-9折 ⇒ 该 key 实测**用不了**（零反例的另一半） */
    { model_name: 'glm-5.3', vendor_id: 6, quota_type: 0, model_ratio: 0.75, model_price: 0, enable_groups: ['vip', 'svip', 'default'] },
    { model_name: 'seedance-2.5', vendor_id: 4, quota_type: 1, model_ratio: 0, model_price: 0.6, enable_groups: ['test', 'vip', 'default', 'svip'] },
    { model_name: 'suno_music', quota_type: 1, model_ratio: 0, model_price: 1, enable_groups: ['default', 'test', 'vip', 'svip'] },
    { model_name: 'minimax-h3', quota_type: 1, model_ratio: 0, model_price: 0.05, enable_groups: ['vip', 'vip-6折', 'svip', 'default'] },
  ],
  vendors: [{ id: 1, name: 'OpenAI' }, { id: 2, name: 'Google' }, { id: 4, name: '火山、豆包' }, { id: 6, name: '智谱' }],
  model_pricing_variants: {
    'gemini-nano-banana-2.1': {
      dimensions: ['resolution'],
      variants: [{ params: { resolution: '1K' }, price: 0.088 }, { params: { resolution: '4K' }, price: 0.11 }],
    },
  },
};

/** 该 key 实测可用的三条（= 上面标了 `vip-9折` 的）。 */
const AVAILABLE_IDS = ['gpt-5.5', 'gpt-6-sol', 'gemini-nano-banana-2.1'];

function payloadOf(fixture: unknown = PRICING_FIXTURE) {
  const parsed = parseNewApiEntitlements(fixture);
  if (!parsed) throw new Error('fixture 解析失败');
  return parsed;
}

beforeEach(() => {
  clearProviderEntitlements();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearProviderEntitlements();
});

/* ───────────────────────────── 解析 ───────────────────────────── */

describe('parseNewApiEntitlements —— 读 new-api `/api/pricing` 的分组字段', () => {
  it('逐字读出 auto_groups / group_ratio / usable_group / data[].enable_groups', () => {
    const parsed = payloadOf();
    expect(parsed.autoGroups).toEqual(['svip', 'vip', 'default']);
    expect(parsed.groupRatio).toEqual(PRICING_FIXTURE.group_ratio);
    expect(parsed.groupLabels.vip).toBe('vip分组');
    expect(parsed.groupLabels['企业测试专线']).toBe('企业测试');
    expect(parsed.models[entitlementModelKey('gpt-5.5')].enableGroups)
      .toEqual(['default', 'svip', 'vip', 'vip-9折']);
    /* 大小写不敏感 */
    expect(parsed.models[entitlementModelKey('GPT-5.5')]).toBeDefined();
  });

  it('结构不认识 ⇒ 返回 null（调用方按「没有数据」处理，不猜）', () => {
    expect(parseNewApiEntitlements(null)).toBeNull();
    expect(parseNewApiEntitlements('nope')).toBeNull();
    expect(parseNewApiEntitlements(42)).toBeNull();
  });

  it('缺字段 ⇒ 空表，不编默认值', () => {
    const parsed = parseNewApiEntitlements({ data: [] });
    expect(parsed).not.toBeNull();
    expect(parsed!.groupRatio).toEqual({});
    expect(parsed!.groupLabels).toEqual({});
    expect(parsed!.models).toEqual({});
  });
});

/* ───────────────────── 组名 → 倍率（P3 的规则） ───────────────────── */

describe('resolveGroupRatio —— 先查表，表里没有才按组名「N折」', () => {
  it('倍率表里**逐字**给了的，直接用', () => {
    expect(resolveGroupRatio('default', PRICING_FIXTURE.group_ratio)).toEqual({ ratio: 1, source: 'group_ratio' });
    expect(resolveGroupRatio('test', PRICING_FIXTURE.group_ratio)).toEqual({ ratio: 2, source: 'group_ratio' });
    expect(resolveGroupRatio('企业测试专线', PRICING_FIXTURE.group_ratio)).toEqual({ ratio: 1.15, source: 'group_ratio' });
    expect(resolveGroupRatio('秋风专用', PRICING_FIXTURE.group_ratio)).toEqual({ ratio: 3, source: 'group_ratio' });
  });

  it('表里没有的 vip-*折：倍率由**组名**得出（N折 ⇒ N/10，两位整数按 9.5折 那种写法）', () => {
    /* 实测：上游 group_ratio 只有 6 条，vip-9折 不在里面；平台 UI 自己显示「0.9x 倍率」 */
    expect(PRICING_FIXTURE.group_ratio).not.toHaveProperty('vip-9折');
    expect(resolveGroupRatio('vip-9折', PRICING_FIXTURE.group_ratio)).toEqual({ ratio: 0.9, source: 'group-name' });
    /* ⚠️ 只有 vip-9折 有「平台 UI 显示 0.9x」这层双重佐证；以下按同一命名约定推广 */
    expect(resolveGroupRatio('vip-95折', PRICING_FIXTURE.group_ratio)).toEqual({ ratio: 0.95, source: 'group-name' });
    expect(resolveGroupRatio('vip-8折', PRICING_FIXTURE.group_ratio)).toEqual({ ratio: 0.8, source: 'group-name' });
    expect(resolveGroupRatio('vip-6折', PRICING_FIXTURE.group_ratio)).toEqual({ ratio: 0.6, source: 'group-name' });
    /* 两种写法等价（`8.5折` 与 `85折` 都是 0.85） */
    expect(resolveGroupRatio('vip-8.5折', undefined).ratio).toBe(0.85);
    expect(resolveGroupRatio('vip-85折', undefined).ratio).toBe(0.85);
  });

  it('NOT FOUND 就是 NOT FOUND：解析不出来**留空并登记**，不默认 1', () => {
    for (const group of ['business-llm', 'business-专用', 'svip', '', '   ']) {
      const resolved = resolveGroupRatio(group, PRICING_FIXTURE.group_ratio);
      /* ⚠️ `default/svip/vip` 在表里 ⇒ 走 group_ratio；其余一律 not-found */
      if (['default', 'svip', 'vip'].includes(group)) {
        expect(resolved.source).toBe('group_ratio');
      } else {
        expect(resolved).toEqual({ ratio: null, source: 'not-found' });
      }
    }
    /* 表整个缺失时也一样：不猜 */
    expect(resolveGroupRatio('vip-9折', undefined)).toEqual({ ratio: 0.9, source: 'group-name' });
    expect(resolveGroupRatio('business-llm', undefined)).toEqual({ ratio: null, source: 'not-found' });
  });
});

/* ─────────────────── 反推分组（零反例判据） ─────────────────── */

describe('inferConnectionGroup —— 「/v1/models ∩ pricing.enable_groups」零反例', () => {
  it('实测用例：21/43 可用、被挡的全是没有 vip-9折 的 ⇒ 反推出 vip-9折，倍率 0.9x', () => {
    const inference = inferConnectionGroup(AVAILABLE_IDS, payloadOf());
    expect(inference).not.toBeNull();
    expect(inference!.group).toBe('vip-9折');
    /* 倍率来自**组名**（上游 group_ratio 里没有它）—— 与平台 UI 显示的 0.9x 一致 */
    expect(inference!.ratio).toBe(0.9);
    expect(inference!.ratioSource).toBe('group-name');
    /* 零反例不是一个分组独有的：`vip` / `default` / `svip` 也零反例（开放面更大）⇒ 记进 alternatives */
    expect(inference!.alternatives).toContain('vip');
    expect(inference!.evidence).toEqual({ availableModels: 3, groupModels: 3, pricingModels: 7 });
  });

  it('取**最具体**的那个（开放模型数最少）—— 这正是「分组门」的判据来源', () => {
    const inference = inferConnectionGroup(AVAILABLE_IDS, payloadOf());
    /* vip-9折 只开放 3 个；vip / default / svip 开放 7 个 ⇒ 选前者 */
    expect(inference!.evidence.groupModels).toBeLessThan(
      PRICING_FIXTURE.data.length,
    );
  });

  it('有反例 ⇒ 判不出来，返回 null（不猜）', () => {
    /* 把 glm-5.3 也算成「可用」：它没有 vip-9折 ⇒ 零反例被打破，只剩开放面更大的分组 */
    const inference = inferConnectionGroup([...AVAILABLE_IDS, 'glm-5.3'], payloadOf());
    expect(inference?.group).not.toBe('vip-9折');
    /* 一个约束都没有（清单里的模型价目表都不认识）⇒ null */
    expect(inferConnectionGroup(['unknown-model'], payloadOf())).toBeNull();
    expect(inferConnectionGroup([], payloadOf())).toBeNull();
  });

  it('价目表整个没有分组字段 ⇒ null（不编一个分组出来）', () => {
    expect(inferConnectionGroup(AVAILABLE_IDS, { models: {}, groupLabels: {}, groupRatio: {} })).toBeNull();
  });
});

/* ───────────────────────── P3：折扣 ───────────────────────── */

describe('resolveConnectionDiscount —— 连接级折扣', () => {
  it('反推分组 ⇒ vip-9折 / 0.9x', () => {
    recordProviderEntitlements('tudou', payloadOf(), AVAILABLE_IDS);
    expect(resolveConnectionDiscount('tudou', undefined)).toEqual({
      group: 'vip-9折',
      label: undefined,
      ratio: 0.9,
      ratioSource: 'group-name',
    });
  });

  it('连接设置里**用户声明**的分组优先于反推结果', () => {
    recordProviderEntitlements('tudou', payloadOf(), AVAILABLE_IDS);
    const declared = resolveConnectionDiscount('tudou', { group: '秋风专用' });
    expect(declared).toEqual({ group: '秋风专用', label: '秋风专用', ratio: 3, ratioSource: 'group_ratio' });
  });

  it('没有数据 / 解析不出倍率 ⇒ null（NOT FOUND，绝不默认 1）', () => {
    expect(resolveConnectionDiscount('nope', undefined)).toBeNull();
    /* 声明了一个组名解析不出倍率的分组：分组本身要如实给出，倍率留 null */
    expect(resolveConnectionDiscount('nope', { group: 'business-llm' }))
      .toEqual({ group: 'business-llm', label: undefined, ratio: null, ratioSource: 'not-found' });
  });
});

/* ─────────────────── P2：候选的权威可用清单 ─────────────────── */

describe('connectionAvailability / 候选裁剪', () => {
  const connection = {
    catalogModels: AVAILABLE_IDS.map((id) => ({ id, name: id, category: 'text' as const, provider: 'tudou' })),
  };

  it('权威清单只认 `/v1/models`（`catalogModels`），**不认**价目表', () => {
    const availability = connectionAvailability(connection, 'tudou');
    expect(availability?.source).toBe('catalog');
    expect([...availability!.availableIds].sort()).toEqual([...AVAILABLE_IDS].sort());
    expect(availability!.availableIds.has('glm-5.3')).toBe(false);
  });

  it('没有任何清单 ⇒ null（调用方不裁剪，退回现状）', () => {
    expect(connectionAvailability(undefined, 'tudou')).toBeNull();
    expect(connectionAvailability({ catalogModels: [] }, 'tudou')).toBeNull();
  });

  it('内存快照优先于持久化的 catalogModels（同一次抓取的清单更新）', () => {
    recordProviderEntitlements('tudou', payloadOf(), ['gpt-5.5']);
    const availability = connectionAvailability(connection, 'tudou');
    expect(availability?.source).toBe('memory');
    expect([...availability!.availableIds]).toEqual(['gpt-5.5']);
  });

  it('上游 id 从 MTV value 里剥出来（`tudou/gpt-5.5` → `gpt-5.5`）', () => {
    expect(upstreamModelIdOf('tudou/gpt-5.5')).toBe('gpt-5.5');
    expect(upstreamModelIdOf('gpt-5.5')).toBe('gpt-5.5');
  });

  it('标注：不在权威清单里 ⇒ unavailable', () => {
    const availability = connectionCandidateAvailability(connection, 'tudou');
    expect(isCandidateUnavailable('tudou/gpt-5.5', availability)).toBe(false);
    expect(isCandidateUnavailable('tudou/glm-5.3', availability)).toBe(true);
    /* 没有数据 ⇒ 一律 false（不猜、不吓人） */
    expect(isCandidateUnavailable('tudou/glm-5.3', null)).toBe(false);
  });

  it('裁剪需要**同刻三重证据**：只有 catalogModels（没有同刻价目表）时**不裁**', () => {
    const availability = connectionCandidateAvailability(connection, 'tudou');
    expect(availability!.models).toBeNull();
    expect(isCandidateProvablyBlocked('tudou/glm-5.3', availability)).toBe(false);
    /* 于是裁剪退化成「原样保留」 */
    const models = [{ value: 'tudou/glm-5.3' }, { value: 'tudou/gpt-5.5' }];
    expect(applyCandidateAvailability(models, availability, (m) => m.value, { trim: true }))
      .toHaveLength(2);
  });

  it('有同刻价目表 ⇒ 证据齐全时裁掉已证实挡掉的', () => {
    recordProviderEntitlements('tudou', payloadOf(), AVAILABLE_IDS);
    const availability = connectionCandidateAvailability(connection, 'tudou');
    expect(availability!.group).toBe('vip-9折');
    expect(isCandidateProvablyBlocked('tudou/glm-5.3', availability)).toBe(true);
    /* glm-5.3 在价目表里、当时分组门关着 ⇒ 删；gpt-5.5 在清单里 ⇒ 留 */
    const kept = applyCandidateAvailability(
      [{ value: 'tudou/glm-5.3' }, { value: 'tudou/gpt-5.5' }],
      availability,
      (m) => m.value,
      { trim: true },
    );
    expect(kept.map((m) => m.value)).toEqual(['tudou/gpt-5.5']);
  });

  it('**永不清空**：裁剪会把候选删光时退化成只标注（空下拉是已知事故）', () => {
    recordProviderEntitlements('tudou', payloadOf(), AVAILABLE_IDS);
    const availability = connectionCandidateAvailability(connection, 'tudou');
    const kept = applyCandidateAvailability(
      [{ value: 'tudou/glm-5.3' }, { value: 'tudou/seedance-2.5' }],
      availability,
      (m) => m.value,
      { trim: true },
    );
    expect(kept).toHaveLength(2);
    expect(kept.every((m) => m.unavailable)).toBe(true);
  });

  it('拿不到数据 ⇒ 候选原样返回（退回现状，不阻断）', () => {
    const models = [{ value: 'tudou/glm-5.3' }];
    expect(applyCandidateAvailability(models, null, (m) => m.value, { trim: true })).toEqual(models);
  });

  it('连接展示名拿不到就退连接 id（候选上要标「走哪条连接」）', () => {
    expect(connectionLabel({ providers: { 'custom-aa': { name: '土豆', apiKey: '' } as never } }, 'custom-aa')).toBe('土豆');
    expect(connectionLabel({ providers: {} }, 'custom-aa')).toBe('custom-aa');
    expect(connectionLabel({ providers: {} }, undefined)).toBeUndefined();
  });
});

/* ───────────────────── P1：确认前的分组门 ───────────────────── */

describe('evaluateModelGate —— 确认前判「这条连接的 key 能不能用它」', () => {
  const connection = {
    catalogModels: AVAILABLE_IDS.map((id) => ({ id, name: id, category: 'text' as const, provider: 'tudou' })),
  };

  it('没有可用清单 ⇒ undetermined（**不阻断**，退回现状）', () => {
    const gate = evaluateModelGate({ providerId: 'tudou', modelId: 'gpt-5.5', connection: undefined });
    expect(gate).toMatchObject({ verdict: 'undetermined', reason: 'no-availability-data' });
    expect(gate.suggestions).toEqual([]);
  });

  it('在权威清单里 ⇒ available（**即使价目表的分组里没写它，也以 `/v1/models` 为准**）', () => {
    const gate = evaluateModelGate({ providerId: 'tudou', modelId: 'tudou/gpt-5.5', connection });
    expect(gate.verdict).toBe('available');
    expect(gate.reason).toBe('in-available-list');
  });

  it('不在清单里 + 分组门关着 ⇒ unavailable/group-not-enabled（原因写清楚）', () => {
    recordProviderEntitlements('tudou', payloadOf(), AVAILABLE_IDS);
    const gate = evaluateModelGate({
      providerId: 'tudou',
      modelId: 'tudou/minimax-h3',
      connection,
      category: 'image',
      candidates: [
        { id: 'tudou/gpt-5.5', name: 'GPT-5.5', category: 'text' },
        { id: 'tudou/gemini-nano-banana-2.1', name: 'Nano Banana 2.1', category: 'image' },
        { id: 'tudou/glm-5.3', name: 'GLM-5.3', category: 'text' },
      ],
    });
    expect(gate.verdict).toBe('unavailable');
    expect(gate.reason).toBe('group-not-enabled');
    expect(gate.group).toBe('vip-9折');
    expect(gate.ratio).toBe(0.9);
    /* 「它到底对哪些分组开放」要如实给出来（可操作提示的素材） */
    expect(gate.enableGroups).toEqual(['vip', 'vip-6折', 'svip', 'default']);
    /* ★ 可操作：只给**同类且在本连接可用**的候选 —— 别的分类/别的连接不叫「这条连接支持它」 */
    expect(gate.suggestions).toEqual([{ id: 'tudou/gemini-nano-banana-2.1', name: 'Nano Banana 2.1' }]);
  });

  it('价目表根本不认识它 ⇒ not-in-upstream-catalog（只陈述事实，不编原因）', () => {
    recordProviderEntitlements('tudou', payloadOf(), AVAILABLE_IDS);
    const gate = evaluateModelGate({ providerId: 'tudou', modelId: 'gpt-imaginary-9', connection });
    expect(gate).toMatchObject({ verdict: 'unavailable', reason: 'not-in-upstream-catalog' });
  });

  it('没有内存快照、只有清单 ⇒ not-in-available-list（不硬说是分组门）', () => {
    const gate = evaluateModelGate({ providerId: 'tudou', modelId: 'glm-5.3', connection });
    expect(gate).toMatchObject({ verdict: 'unavailable', reason: 'not-in-available-list' });
    expect(gate.group).toBeUndefined();
  });
});

/* ─────────── 接入：`fetchProviderModelCatalog` 顺带记权益 ─────────── */

describe('fetchProviderModelCatalog —— 权益随目录一起取回（不额外发请求）', () => {
  it('同一次匿名 /api/pricing 既出元数据又出权益，并按**连接 key** 缓存', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        object: 'list',
        data: AVAILABLE_IDS.map((id) => ({ id, object: 'model' })),
      }))
      .mockResolvedValueOnce(jsonResponse(PRICING_FIXTURE));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProviderModelCatalog({
      providerId: 'tudou',
      connectionId: 'custom-e2e00001',
      config: { name: '土豆', apiKey: 'placeholder-key-not-real', catalogId: 'tudou' },
    });

    /* 只发了两个请求：权威清单 + 匿名价目表（权益**没有**再加一次请求） */
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'https://api.ai-tudou.net/v1/models',
      'https://api.ai-tudou.net/api/pricing',
    ]);
    /* 匿名那一条**不带**凭据 */
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string> | undefined)?.Authorization)
      .toBeUndefined();

    /* 清单仍然只由 ` /v1/models ` 决定：价目表里多出来的 glm-5.3 / seedance-2.5 **不在** */
    expect(result.models.map((model) => model.id).sort()).toEqual([...AVAILABLE_IDS].sort());

    /* 权益缓存键 = **连接 key**（不是 definition.id） */
    expect(result.entitlements?.providerId).toBe('custom-e2e00001');
    expect(result.entitlements?.inferredGroup?.group).toBe('vip-9折');
    expect(result.entitlements?.inferredGroup?.ratio).toBe(0.9);
    expect(getProviderEntitlements('custom-e2e00001')).not.toBeNull();
    expect(getProviderEntitlements('tudou')).toBeNull();
  });

  it('价目表拿不到 ⇒ 静默失败：目录照旧返回，权益缺席（**不阻断**）', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ object: 'list', data: [{ id: 'gpt-5.5', object: 'model' }] }))
      .mockRejectedValueOnce(new Error('pricing down'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProviderModelCatalog({
      providerId: 'tudou',
      config: { name: '土豆', apiKey: 'placeholder-key-not-real', catalogId: 'tudou' },
    });
    expect(result.source).toBe('remote');
    expect(result.models.map((model) => model.id)).toEqual(['gpt-5.5']);
    expect(result.entitlements).toBeUndefined();
    expect(getProviderEntitlements('tudou')).toBeNull();
  });
});

/* ───────────────── P3 接线：倍率套在价目表价上 ───────────────── */

describe('estimateWithBilling —— 分组倍率（P3 接线）', () => {
  const table = parseCreditPriceTable(PRICING_FIXTURE);

  it('vip-9折 ⇒ 价目表价 × 0.9（倍率来自组名）', () => {
    const plain = estimateWithBilling(table, { modelId: 'gemini-nano-banana-2.1', resolution: '1K' }, undefined);
    expect(plain?.credits).toBeCloseTo(8.8, 6);
    const discounted = estimateWithBilling(
      table,
      { modelId: 'gemini-nano-banana-2.1', resolution: '1K' },
      undefined,
      0.9,
    );
    expect(discounted?.credits).toBeCloseTo(7.92, 6);
    expect(discounted?.baseUnitPrice).toBeCloseTo(0.088, 6);
    expect(discounted?.groupRatio).toBe(0.9);
  });

  it('倍率拿不到（null / undefined / 非正数）⇒ 原价，**不阻断**', () => {
    for (const ratio of [null, undefined, 0, -1, Number.NaN]) {
      const estimate = estimateWithBilling(
        table,
        { modelId: 'gemini-nano-banana-2.1', resolution: '1K' },
        undefined,
        ratio as number | null | undefined,
      );
      expect(estimate?.credits).toBeCloseTo(8.8, 6);
      expect(estimate?.groupRatio).toBeUndefined();
    }
  });

  it('用户手填的价**不套**倍率（越明确越优先 ⇒ 不替用户改价）', () => {
    const billing = { modelOverrides: [{ modelId: 'gemini-nano-banana-2.1', unitPrice: 0.1 }] };
    const estimate = estimateWithBilling(
      table,
      { modelId: 'gemini-nano-banana-2.1', resolution: '1K' },
      billing,
      0.9,
    );
    expect(estimate?.unitPrice).toBeCloseTo(0.1, 6);
    expect(estimate?.credits).toBeCloseTo(10, 6);
    expect(estimate?.groupRatio).toBeUndefined();

    const fallback = estimateWithBilling(table, { modelId: 'no-such-model' }, { fallbackUnitPrice: 0.5 }, 0.9);
    expect(fallback?.credits).toBeCloseTo(50, 6);
    expect(fallback?.groupRatio).toBeUndefined();
  });
});
