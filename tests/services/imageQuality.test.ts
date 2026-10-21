/**
 * 出站「精细度」（quality）—— 用户 2026：
 *   1.「一样的模型/参考图/提示词，官方效果更好」→ 官方会把界面的精细度发进请求，MTV 从来没发。
 *   2.「mtv 也同样发吧」（且**不要只针对土豆**，未来换厂商也要适配）。
 *
 * 规则（全部数据驱动，无 per-vendor 分支）：
 *   · 官方 7 键（low/medium/high/xhigh/max/hd/standard）→ 接口认的值
 *     （xhigh/max 只能降到 high，原样发会 400）；
 *   · 该不该发 = 查 MTV 的官方模型能力表 `qualityOptionsForModel(modelName)`
 *     （**按模型名匹配** ⇒ 任何连接/厂商只要模型名对得上就命中）；
 *   · 表里查不到 → 只有名字看起来就是 OpenAI 图像模型（`gpt-image` 系 / `dall-e` 系）才发。
 *
 * ★ 用户 2026 追加：「界面显示低，实际什么都没发」——
 *   节点没存过档位时用**模型默认档**兜底，保证「显示什么就发什么」。
 */
import { describe, expect, it } from 'vitest';
import { mapOfficialQualityToApi, resolveOutgoingImageQuality } from '../../src/services/ai/imageQuality';

describe('精细度映射（官方 7 键 → 接口值）', () => {
  it('同名档位原样；xhigh/max 降到 high（接口不认这两个词）', () => {
    expect(mapOfficialQualityToApi('low')).toBe('low');
    expect(mapOfficialQualityToApi('medium')).toBe('medium');
    expect(mapOfficialQualityToApi('high')).toBe('high');
    expect(mapOfficialQualityToApi('xhigh')).toBe('high');
    expect(mapOfficialQualityToApi('max')).toBe('high');
    expect(mapOfficialQualityToApi('hd')).toBe('hd');
    expect(mapOfficialQualityToApi('standard')).toBe('standard');
  });

  it('空值 / 未知值 ⇒ 不发', () => {
    expect(mapOfficialQualityToApi('')).toBeUndefined();
    expect(mapOfficialQualityToApi(undefined)).toBeUndefined();
    expect(mapOfficialQualityToApi('ultra')).toBeUndefined();
  });
});

describe('该不该发 quality', () => {
  it('GPT Image 系（官方能力表命中）⇒ 支持这一档就发', () => {
    expect(resolveOutgoingImageQuality('gpt-image-2.5-flare', 'low')).toBe('low');
    expect(resolveOutgoingImageQuality('gpt-image-2-pro', 'high')).toBe('high');
    expect(resolveOutgoingImageQuality('gpt-image-2.5-flare-async', 'xhigh')).toBe('high');
  });

  it('非 OpenAI 图像模型（能力表无 qualityOptions）⇒ 不发，避免 400', () => {
    expect(resolveOutgoingImageQuality('gemini-3-pro-image-preview', 'high')).toBeUndefined();
    expect(resolveOutgoingImageQuality('flux-kontext-pro', 'low')).toBeUndefined();
  });

  it('能力表查不到的陌生名字：只有看起来是 OpenAI 图像模型才发', () => {
    expect(resolveOutgoingImageQuality('gpt-image-9-turbo', 'medium')).toBe('medium');
    expect(resolveOutgoingImageQuality('dall-e-4', 'standard')).toBe('standard');
    expect(resolveOutgoingImageQuality('some-vendor-magic-image', 'high')).toBeUndefined();
  });

  it('节点里没存过档位 ⇒ 用**模型默认档**兜底（界面显示低就得发 low）', () => {
    /* 新图片卡没有 `data.quality`，选择器只显示默认值 ⇒ 以前请求里是空的，
       上游按自己的默认跑，界面上显示的档位名不副实。官方从不会空着发。 */
    expect(resolveOutgoingImageQuality('gpt-image-2.5-flare', undefined)).toBe('low');
    expect(resolveOutgoingImageQuality('gpt-image-2.5-flare', '')).toBe('low');
  });

  it('能力表查不到的陌生 OpenAI 名字且没选档 ⇒ 不发（不发明默认值）', () => {
    expect(resolveOutgoingImageQuality('gpt-image-9-turbo', undefined)).toBeUndefined();
    expect(resolveOutgoingImageQuality('gemini-3-pro-image-preview', undefined)).toBeUndefined();
  });
});
