// @vitest-environment jsdom
/**
 * 第 63 轮：生成确认卡头部的**预估价格**（官方 `~8 Tapies` 那一位）。
 *
 * 官方事实（新版 `vendor-pkg-canvas-CvbAwZyy.js`）：价格**不在卡片载荷里**，而是另发一次估价请求
 * （`Pc` hook → `{tapiesCost, priceDisplay:{text,max}, …}` → `v5()`），渲染在卡片头
 * `<span class="relative inline-flex text-xs …">` 内的 `<span class="whitespace-nowrap tap-price-change">`。
 *
 * MTV 口径（**不锁死厂商**）：价格一律走 MTV 既有的连接级计费体系
 * `手动覆盖 → 厂商价目表 → 连接兜底单价`，再按 `creditsPerUnit` 折成积分；取值连的是
 * 「当前项目该类型默认模型」。查不到价 ⇒ `null`（卡片头不渲染价格，绝不编数）。
 *
 * 验证分级 = **(b) jsdom + 真预估函数**（只把「拉价目表」这一步 mock 掉，其余全走真代码）。
 */
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/ai/creditEstimate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/ai/creditEstimate')>();
  return { ...actual, loadCreditPriceTable: vi.fn(async () => null) };
});

const { cardModelName, useGenerationCardCost } = await import('../../src/components/chat/useGenerationCardCost');
const { useAppStore } = await import('../../src/store/useAppStore');
const { setLocale } = await import('../../src/i18n');

/** 只给「兜底单价」：0.08 → 0.08 × 100(creditsPerUnit) = 8 积分（对应官方那 ~8 Tapies 的位置）。 */
const CONNECTION = {
  id: 'custom-x',
  name: '自定义厂商 X',
  baseUrl: 'https://example.test/v1',
  apiKey: 'sk-test',
  billing: { fallbackUnitPrice: 0.08, creditsPerUnit: 100 },
};

function seed(options: { defaultModels?: Record<string, string>; withFallback?: boolean } = {}) {
  const { defaultModels = { image: 'custom-x/gpt-image-2-pro' }, withFallback = true } = options;
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    config: {
      ...useAppStore.getState().config,
      providers: { 'custom-x': { ...CONNECTION, billing: withFallback ? CONNECTION.billing : {} } },
      generalModels: [],
    } as never,
    projects: [{
      id: 'project-1',
      name: '项目',
      settings: { defaultModels },
    }] as never,
    currentProjectId: 'project-1',
  } as never);
}

beforeEach(() => { setLocale('zh-CN'); });
afterEach(cleanup);

describe('生成确认卡的价格：连接级计费 → 积分', () => {
  it('项目默认模型 + 连接兜底单价 ⇒ `~8 积分`', async () => {
    seed();
    const { result } = renderHook(() => useGenerationCardCost({ kind: 'image', imageSize: '1K', times: 1 }));
    await waitFor(() => expect(result.current.text).toBe('~8 积分'));
    expect(result.current.loading).toBe(false);
  });

  it('张数参与计价（2 张 ⇒ 16）', async () => {
    seed();
    const { result } = renderHook(() => useGenerationCardCost({ kind: 'image', imageSize: '1K', times: 2 }));
    await waitFor(() => expect(result.current.text).toBe('~16 积分'));
  });

  it('没有默认模型 ⇒ 不算价、不渲染（不编数）', async () => {
    seed({ defaultModels: {} });
    const { result } = renderHook(() => useGenerationCardCost({ kind: 'image', times: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.text).toBeNull();
  });

  it('连接没配任何单价 ⇒ 不算价（`billing.enabled === false` 同义：不猜）', async () => {
    seed({ withFallback: false });
    const { result } = renderHook(() => useGenerationCardCost({ kind: 'image', times: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.text).toBeNull();
  });

  it('换厂商只改配置：同一段代码，第二个连接的单价直接生效（厂商无关）', async () => {
    seed();
    /* 再塞一个连接 + 把项目默认模型指过去（模拟「更换厂商」） */
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        providers: {
          ...state.config.providers,
          'custom-y': { ...CONNECTION, id: 'custom-y', baseUrl: 'https://other.test/v1', billing: { fallbackUnitPrice: 0.21, creditsPerUnit: 100 } },
        },
      } as never,
      projects: [{ id: 'project-1', name: '项目', settings: { defaultModels: { image: 'custom-y/nano-banana-2.1' } } }] as never,
    }) as never);
    const { result } = renderHook(() => useGenerationCardCost({ kind: 'image', times: 1 }));
    await waitFor(() => expect(result.current.text).toBe('~21 积分'));
  });
});

describe('卡片载荷里的 model_name 优先（官方口径：价格算的是**已指派模型**）', () => {
  it('`cardModelName` 读 `request.request_json.model_name`（含 detail.items 兜底）', () => {
    expect(cardModelName({ request: { request_json: { model_name: 'custom-x/nano-banana-2.1' } } })).toBe('custom-x/nano-banana-2.1');
    expect(cardModelName({ request: { detail: { items: [{ request_json: { model_name: 'custom-y/m1' } }] } } })).toBe('custom-y/m1');
    expect(cardModelName({ request: {} })).toBeUndefined();
  });

  it('卡片给了 model_name ⇒ 用它（即使项目默认模型指向另一个连接）', async () => {
    seed();
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        providers: {
          ...state.config.providers,
          'custom-z': { ...CONNECTION, id: 'custom-z', baseUrl: 'https://z.test/v1', billing: { fallbackUnitPrice: 0.33, creditsPerUnit: 100 } },
        },
      } as never,
    }) as never);
    const { result } = renderHook(() => useGenerationCardCost({
      kind: 'image', modelName: 'custom-z/gpt-image-2-pro', times: 1,
    }));
    await waitFor(() => expect(result.current.text).toBe('~33 积分'));
  });
});