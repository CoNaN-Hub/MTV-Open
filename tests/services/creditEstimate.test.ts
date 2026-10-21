import { describe, expect, it } from 'vitest';
import {
  CREDITS_PER_PRICE_UNIT,
  creditModelCandidates,
  creditPriceEndpoint,
  creditsFromUnitPrice,
  estimateImageCredits,
  estimateWithBilling,
  formatCredits,
  lookupCreditUnitPrice,
  lookupOverrideUnitPrice,
  parseCreditPriceTable,
} from '../../src/services/ai/creditEstimate';

/**
 * 夹具逐字取自土豆（new-api）**公开**的 `GET /api/pricing` 响应，
 * 数值与它站点上显示的一致 —— 它的 `/api/status` 是 `quota_display_type:"CNY"` +
 * `display_in_currency:true` ⇒ 这些数**就是人民币**（¥）。
 * 结论：100 积分 = ¥1，即 1 积分 = ¥0.01。
 */
const TUDOU_PRICING = {
  group_ratio: { default: 1, svip: 1, test: 2, vip: 1, 企业测试专线: 1.15, 秋风专用: 3 },
  data: [
    { model_name: 'gpt-image-2.5-flare', quota_type: 1, model_ratio: 0, model_price: 0.03 },
    { model_name: 'gpt-image-2.5-sunburst', quota_type: 1, model_ratio: 0, model_price: 0.04 },
    { model_name: 'gpt-image-2-pro', quota_type: 1, model_ratio: 0, model_price: 0.05 },
    { model_name: 'gemini-3-pro-image-preview', quota_type: 1, model_ratio: 0, model_price: 0.1 },
    { model_name: 'gemini-3.1-flash-image-preview', quota_type: 1, model_ratio: 0, model_price: 0.078 },
    // 按 token 计费的文本模型：不该被当成"每张"
    { model_name: 'glm-5.3', quota_type: 0, model_ratio: 0.75, model_price: 0 },
  ],
  model_pricing_variants: {
    'gpt-image-2.5-flare': {
      dimensions: ['quality', 'resolution'],
      variants: [
        { params: { quality: 'low', resolution: '1k' }, price: 0.03 },
        { params: { quality: 'low', resolution: '4k' }, price: 0.06 },
        { params: { quality: 'medium', resolution: '1k' }, price: 0.04 },
        { params: { quality: 'medium', resolution: '4k' }, price: 0.08 },
        { params: { quality: 'high', resolution: '1k' }, price: 0.05 },
        { params: { quality: 'max', resolution: '4k' }, price: 0.16 },
      ],
    },
    'gpt-image-2.5-sunburst': {
      dimensions: ['quality', 'resolution'],
      variants: [
        { params: { quality: 'low', resolution: '1k' }, price: 0.04 },
        { params: { quality: 'medium', resolution: '1k' }, price: 0.05 },
        { params: { quality: 'high', resolution: '1k' }, price: 0.07 },
      ],
    },
    // 只按质量分档（没有 resolution 维度）
    'gpt-image-2-pro': {
      dimensions: ['quality'],
      variants: [
        { params: { quality: 'low' }, price: 0.04 },
        { params: { quality: 'medium' }, price: 0.08 },
        { params: { quality: 'high' }, price: 0.12 },
      ],
    },
    // 只按分辨率分档，而且**大写** K
    'gemini-3-pro-image-preview': {
      dimensions: ['resolution'],
      variants: [
        { params: { resolution: '1K' }, price: 0.1 },
        { params: { resolution: '2K' }, price: 0.1 },
        { params: { resolution: '4K' }, price: 0.14 },
      ],
    },
    // 按秒计费的视频模型：不能当"每张"
    'seedance-mini': {
      dimensions: ['duration'],
      unit: 'per_second',
      variants: [{ params: { duration: '10s' }, price: 1.85 }],
    },
  },
};

const table = parseCreditPriceTable(TUDOU_PRICING);

describe('creditEstimate · 解析价目表', () => {
  it('只收按次计费（quota_type=1）的基础单价', () => {
    expect(table.base.get('gpt-image-2.5-flare')).toBe(0.03);
    expect(table.base.has('glm-5.3')).toBe(false);
  });

  it('按秒计费的视频模型不进图片表', () => {
    expect(table.variants.has('seedance-mini')).toBe(false);
  });

  it('认识的形状之外一律空表（不猜数）', () => {
    expect(parseCreditPriceTable(null).variants.size).toBe(0);
    expect(parseCreditPriceTable({ data: 'nope' }).base.size).toBe(0);
  });
});

describe('creditEstimate · 按 模型+精细度+分辨率 查单价（不写死）', () => {
  const price = (modelId: string, quality?: string, resolution?: string) =>
    lookupCreditUnitPrice(table, { modelId, quality, resolution });

  it('flare：档位不同价不同', () => {
    expect(price('gpt-image-2.5-flare', 'low', '1K')).toBe(0.03);
    expect(price('gpt-image-2.5-flare', 'medium', '1K')).toBe(0.04);
    expect(price('gpt-image-2.5-flare', 'high', '1K')).toBe(0.05);
    expect(price('gpt-image-2.5-flare', 'low', '4K')).toBe(0.06);
    expect(price('gpt-image-2.5-flare', 'medium', '4K')).toBe(0.08);
  });

  it('同档位不同模型价不同（flare vs sunburst vs pro）', () => {
    expect(price('gpt-image-2.5-flare', 'medium', '1K')).toBe(0.04);
    expect(price('gpt-image-2.5-sunburst', 'medium', '1K')).toBe(0.05);
    expect(price('gpt-image-2-pro', 'medium')).toBe(0.08);
  });

  it('分辨率大小写不敏感（界面是 1K，表里是 1k / 1K 两种写法）', () => {
    expect(price('gemini-3-pro-image-preview', undefined, '1K')).toBe(0.1);
    expect(price('gemini-3-pro-image-preview', undefined, '1k')).toBe(0.1);
    expect(price('gemini-3-pro-image-preview', undefined, '4K')).toBe(0.14);
    expect(price('gpt-image-2.5-flare', 'low', '1k')).toBe(0.03);
  });

  it('只分质量的模型：给了分辨率也不串档', () => {
    expect(price('gpt-image-2-pro', 'low', '4K')).toBe(0.04);
    expect(price('gpt-image-2-pro', 'high', '1K')).toBe(0.12);
  });

  it('异步 id 也能查到（同步 id 与 -async 互为候选）', () => {
    expect(creditModelCandidates('gpt-image-2.5-sunburst')).toContain('gpt-image-2.5-sunburst-async');
    expect(price('gpt-image-2.5-sunburst-async', 'high', '1K')).toBe(0.07);
    expect(price('gpt-image-2.5-sunburst-async', 'medium', '1K')).toBe(0.05);
  });

  it('表里没有的模型返回 null（宁可不出数，也不猜）', () => {
    expect(price('flux-2-pro', 'medium', '1K')).toBeNull();
    expect(price('glm-5.3', 'medium', '1K')).toBeNull();
  });

  it('档位没命中明细时退回该模型基础单价', () => {
    // flare 的 'xhigh'+'4K' 不在夹具明细里 ⇒ 退回 model_price 0.03
    expect(price('gpt-image-2.5-flare', 'xhigh', '4K')).toBe(0.03);
  });

  /**
   * 土豆 2026 的真实形状：**明细挂在异步 id 上，同步 id 只剩高额兜底价**。
   * 逐个候选「先明细再基础价」的写法会在同步 id 上拿到 0.13 立刻返回 ⇒ 报错价 ✗
   * （实测踩到过：一张 ¥0.04 的图被报成 ¥0.13）
   */
  it('异步 id 才有明细、同步 id 只有兜底价时，必须取明细价', () => {
    const split = {
      data: [
        { model_name: 'gpt-image-2.5-sunburst', quota_type: 1, model_ratio: 0, model_price: 0.13 },
        { model_name: 'gpt-image-2.5-sunburst-async', quota_type: 1, model_ratio: 0, model_price: 0.04 },
      ],
      model_pricing_variants: {
        'gpt-image-2.5-sunburst-async': {
          dimensions: ['quality', 'resolution'],
          variants: [
            { params: { quality: 'low', resolution: '1k' }, price: 0.04 },
            { params: { quality: 'high', resolution: '4k' }, price: 0.12 },
          ],
        },
      },
    };
    const t2 = parseCreditPriceTable(split);
    expect(lookupCreditUnitPrice(t2, { modelId: 'gpt-image-2.5-sunburst', quality: 'low', resolution: '1K' })).toBe(0.04);
    expect(lookupCreditUnitPrice(t2, { modelId: 'gpt-image-2.5-sunburst', quality: 'high', resolution: '4K' })).toBe(0.12);
    // 明细确实没命中（比如给了不存在的档位）才退回基础价 —— 同步 id 的基础价就是那个高额兜底
    expect(lookupCreditUnitPrice(t2, { modelId: 'gpt-image-2.5-sunburst', quality: 'max', resolution: '4K' })).toBe(0.13);
    expect(estimateImageCredits(t2, { modelId: 'gpt-image-2.5-sunburst', quality: 'low', resolution: '1K' }))
      .toEqual({ unitPrice: 0.04, count: 1, credits: 4 });
  });
});

describe('creditEstimate · 换算成积分', () => {
  it('1 积分 = 价目表计价单位的 1/100（土豆 = ¥0.01）', () => {
    expect(CREDITS_PER_PRICE_UNIT).toBe(100);
    expect(creditsFromUnitPrice(0.04)).toBe(4);
    expect(creditsFromUnitPrice(0.078)).toBe(7.8);
    expect(creditsFromUnitPrice(0.1)).toBe(10);
  });

  it('按张数相乘', () => {
    expect(creditsFromUnitPrice(0.04, 3)).toBe(12);
    const est = estimateImageCredits(table, {
      modelId: 'gpt-image-2.5-sunburst', quality: 'high', resolution: '1K', count: 4,
    });
    expect(est).toEqual({ unitPrice: 0.07, count: 4, credits: 28 });
  });

  it('张数非法按 1 张算', () => {
    expect(creditsFromUnitPrice(0.04, 0)).toBe(4);
    expect(creditsFromUnitPrice(0.04, -3)).toBe(4);
  });

  it('查不到就返回 null，调用方不渲染', () => {
    expect(estimateImageCredits(table, { modelId: 'flux-2-pro', quality: 'medium', resolution: '1K' })).toBeNull();
  });
});

describe('creditEstimate · 积分展示', () => {
  it('大数取整、小数保留一位（对齐官方「约 5 Tapies」的观感）', () => {
    expect(formatCredits(4)).toBe('4');
    expect(formatCredits(7.8)).toBe('7.8');
    expect(formatCredits(12)).toBe('12');
    expect(formatCredits(28)).toBe('28');
    expect(formatCredits(0.85)).toBe('0.85');
    expect(formatCredits(0)).toBe('0');
  });
});

describe('creditEstimate · 价目表地址', () => {
  it('从连接 baseUrl 推到站点根的 /api/pricing', () => {
    expect(creditPriceEndpoint('https://api.ai-tudou.net/v1')).toBe('https://api.ai-tudou.net/api/pricing');
    expect(creditPriceEndpoint('https://api.ai-tudou.net')).toBe('https://api.ai-tudou.net/api/pricing');
    expect(creditPriceEndpoint('not-a-url')).toBeNull();
  });
});

/**
 * ★ 连接级计费配置（用户 2026：「未来我会接入其他厂商的价格，不要锁死土豆这一套」）。
 * 换厂商时价目表路径不同 / 根本没有公开价目表 / 计价单位不是人民币 —— 都由 `billing` 覆盖。
 */
describe('creditEstimate · 连接级计费配置', () => {
  it('价目表地址：auto 默认、endpoint 支持占位、manual 完全不请求', () => {
    expect(creditPriceEndpoint('https://a.example/v1', { priceSource: 'auto' }))
      .toBe('https://a.example/api/pricing');
    expect(creditPriceEndpoint('https://a.example/v1', { priceSource: 'endpoint', priceEndpoint: '/pricing' }))
      .toBe('https://a.example/pricing');
    expect(creditPriceEndpoint('https://a.example/v1', { priceSource: 'endpoint', priceEndpoint: '{origin}/x/price' }))
      .toBe('https://a.example/x/price');
    expect(creditPriceEndpoint('https://a.example/v1', { priceSource: 'endpoint', priceEndpoint: '{baseUrl}/price' }))
      .toBe('https://a.example/v1/price');
    expect(creditPriceEndpoint('https://a.example/v1', { priceSource: 'endpoint', priceEndpoint: 'price.json' }))
      .toBe('https://a.example/price.json');
    expect(creditPriceEndpoint('https://a.example/v1', { priceSource: 'manual' })).toBeNull();
    expect(creditPriceEndpoint('https://a.example/v1', { priceSource: 'endpoint' })).toBeNull();
  });

  it('积分换算比例可配（默认 100）', () => {
    expect(creditsFromUnitPrice(0.04)).toBe(4);
    expect(creditsFromUnitPrice(0.04, 2)).toBe(8);
    // 某厂商的 1 单位 = 1 积分 ⇒ 0.04 单位 = 0.04 积分
    expect(creditsFromUnitPrice(0.04, 1, 1)).toBe(0.04);
    expect(creditsFromUnitPrice(0.04, 2, 10)).toBe(0.8);
    // 非法比例回落默认
    expect(creditsFromUnitPrice(0.04, 1, 0)).toBe(4);
  });

  it('逐模型手动价：档位明细优先、支持 * 通配、再退回基础单价', () => {
    const billing = {
      modelOverrides: [
        {
          modelId: 'my-model',
          unitPrice: 0.9,
          variants: { 'low|1k': 0.02, '*|2k': 0.06 },
        },
      ],
    };
    expect(lookupOverrideUnitPrice(billing, { modelId: 'my-model', quality: 'low', resolution: '1K' })).toBe(0.02);
    expect(lookupOverrideUnitPrice(billing, { modelId: 'my-model', quality: 'high', resolution: '2k' })).toBe(0.06);
    // 明细都不命中 ⇒ 退回基础单价
    expect(lookupOverrideUnitPrice(billing, { modelId: 'my-model', quality: 'high', resolution: '4k' })).toBe(0.9);
    // 维度缺失时只有 `*` 能配上
    expect(lookupOverrideUnitPrice(billing, { modelId: 'my-model' })).toBe(0.9);
  });

  it('逐模型手动价：模型名大小写不敏感，异步 id 与同步 id 互为候选', () => {
    const billing = { modelOverrides: [{ modelId: 'My-Model-Async', unitPrice: 0.05 }] };
    expect(lookupOverrideUnitPrice(billing, { modelId: 'my-model' })).toBe(0.05);
    expect(lookupOverrideUnitPrice(billing, { modelId: 'MY-MODEL-ASYNC' })).toBe(0.05);
    expect(lookupOverrideUnitPrice(billing, { modelId: 'other' })).toBeNull();
    expect(lookupOverrideUnitPrice(undefined, { modelId: 'my-model' })).toBeNull();
  });

  it('优先级：手动价 > 价目表 > 兜底单价', () => {
    const table = parseCreditPriceTable(TUDOU_PRICING);
    const request = { modelId: 'gpt-image-2.5-sunburst', quality: 'low', resolution: '1K' };

    // 没有覆盖 ⇒ 用价目表（土豆 low·1k = 0.04 ⇒ 4 积分）
    expect(estimateWithBilling(table, request, undefined)?.credits).toBe(4);
    // 兜底单价只在价目表查不到时生效
    expect(estimateWithBilling(table, { modelId: 'flux-2-pro' }, { fallbackUnitPrice: 0.2 })?.credits).toBe(20);
    expect(estimateWithBilling(table, request, { fallbackUnitPrice: 0.2 })?.credits).toBe(4);
    // 手动价覆盖公开价目表
    const withOverride = estimateWithBilling(table, request, {
      modelOverrides: [{ modelId: 'gpt-image-2.5-sunburst', unitPrice: 0.01 }],
    });
    expect(withOverride).toEqual({ unitPrice: 0.01, count: 1, credits: 1 });
    // 自定义换算比例一起生效
    expect(estimateWithBilling(table, request, { creditsPerUnit: 1 })?.credits).toBe(0.04);
  });

  it('关掉预估 ⇒ 一律 null（徽章整块不渲染）', () => {
    const table = parseCreditPriceTable(TUDOU_PRICING);
    expect(estimateWithBilling(table, { modelId: 'gpt-image-2.5-sunburst' }, { enabled: false })).toBeNull();
  });

  it('价目表拉不到但配了手动价，仍然算得出来', () => {
    const estimate = estimateWithBilling(null, { modelId: 'flux-2-pro', count: 2 }, {
      priceSource: 'manual',
      modelOverrides: [{ modelId: 'flux-2-pro', unitPrice: 0.05 }],
    });
    expect(estimate).toEqual({ unitPrice: 0.05, count: 2, credits: 10 });
  });
});

