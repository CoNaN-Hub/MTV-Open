import { describe, expect, it } from 'vitest';
import { resolveCreditConnection } from '../../src/services/ai/creditConnection';
import { DEFAULT_BASE_URLS } from '../../src/constants/api';

/**
 * 「预计花费（积分）」要查连接公开的价目表，前提是先解析出**连接地址**与**上游模型 id**。
 * 解析不出来就必须返回 null —— 宁可不出数，也不能拿错模型的价格当预估。
 *
 * ★ 现在还会多带两样（分组权益层，**MTV 增强**）：
 *   · `providerId` —— 这条连接在 `config.providers` 里的 key（自定义连接是 `custom-<uuid8>`），
 *     权益按**连接**缓存，只有它才是正确的键；
 *   · `discount`  —— 该连接的上游分组折扣（拿不到就是 null ⇒ 原价，**不阻断**）。
 */
const config = {
  providers: {
    'custom-2611fc0a': { baseUrl: 'https://api.ai-tudou.net/v1', name: '土豆' },
    apimart: { baseUrl: 'https://api.apib.ai/v1', name: 'APIMart' },
    empty: { name: '没有地址' },
  },
  generalModels: [
    { id: 'provider-custom-2611fc0a-18oot7d', modelId: 'gpt-image-2.5-flare', providerConfigId: 'custom-2611fc0a' },
    { id: 'provider-custom-2611fc0a-vgcgsv', modelId: 'gpt-image-2.5-sunburst', providerConfigId: 'custom-2611fc0a' },
  ],
};

describe('resolveCreditConnection · 自定义连接', () => {
  it('从 `general/<配置 id>` 找到真实模型名与连接地址', () => {
    expect(resolveCreditConnection('general', 'general/provider-custom-2611fc0a-18oot7d', config))
      .toEqual({
        providerId: 'custom-2611fc0a',
        baseUrl: 'https://api.ai-tudou.net/v1',
        modelId: 'gpt-image-2.5-flare',
        discount: null,
      });
    expect(resolveCreditConnection('general', 'general/provider-custom-2611fc0a-vgcgsv', config))
      .toEqual({
        providerId: 'custom-2611fc0a',
        baseUrl: 'https://api.ai-tudou.net/v1',
        modelId: 'gpt-image-2.5-sunburst',
        discount: null,
      });
  });

  it('模型配置不存在 ⇒ null（不猜另一个模型的价格）', () => {
    expect(resolveCreditConnection('general', 'general/provider-custom-not-exist', config)).toBeNull();
    expect(resolveCreditConnection('general', undefined, config)).toBeNull();
  });

  it('连接没填地址 ⇒ null', () => {
    expect(resolveCreditConnection('general', 'general/provider-custom-2611fc0a-18oot7d', {
      providers: { 'custom-2611fc0a': { name: '土豆' } },
      generalModels: config.generalModels,
    })).toBeNull();
  });
});

describe('resolveCreditConnection · 内置厂商', () => {
  it('优先用连接自己填的地址，模型名去掉 `provider/` 前缀', () => {
    expect(resolveCreditConnection('apimart', 'apimart/gpt-image-2.5-flare', config))
      .toEqual({
        providerId: 'apimart',
        baseUrl: 'https://api.apib.ai/v1',
        modelId: 'gpt-image-2.5-flare',
        discount: null,
      });
  });

  it('连接没填地址时退回该厂商的默认地址', () => {
    const resolved = resolveCreditConnection('apimart', 'gpt-image-2.5-flare', { providers: {}, generalModels: [] });
    expect(resolved?.baseUrl).toBe(DEFAULT_BASE_URLS.apimart);
    expect(resolved?.modelId).toBe('gpt-image-2.5-flare');
  });

  it('地址和模型名缺一个就 ⇒ null', () => {
    expect(resolveCreditConnection('empty', 'empty/some-model', config)).toBeNull();
    expect(resolveCreditConnection('apimart', undefined, config)).toBeNull();
    expect(resolveCreditConnection(undefined, 'apimart/x', config)).toBeNull();
  });
});
