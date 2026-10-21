import { describe, expect, it, vi } from 'vitest';
import { imageNodeDefaultParams } from '../../src/utils/imageModelCapabilities';
import { officialImageSize } from '../../src/services/ai/officialImageSizes';
import { imageDimensionPreset } from '../../src/services/ai/mediaModelCapabilities';
import { buildNodeData } from '../../src/components/sidebar/nodePickerActions';

/**
 * 新图卡默认档位 —— 用户 2026「同样的模型、同样的提示词，artigine 出来是好的，MTV 的瓦」
 *
 * 现场实测（同模型 `gpt-image-2.5-flare` · 同提示词 · 同参考图）：
 *   · artigine 该模型走 **Auto**（节点参数只有 `presetIndex:0`，**没有 quality 字段**）
 *     ⇒ 上游自己定 ⇒ **768×1024** PNG 1,600,190 B（干净）
 *   · MTV 强制档位 ⇒ 2K·3:4 = 1536×2048（~5 MB）· 4K·3:4 = 2480×3312（~13 MB）
 *   · 逐张量每像素高频能量（相邻像素亮度差均值）：
 *       1K ≈ 6.3–9.8 · 2K ≈ 4.7–7.2 · 4K ≈ 3.4–6.3 ⇒ 像素翻倍而细节反而变少
 *     ⇒ 上游按 ~1K 原生渲染再放大 ⇒ 涂抹/发糊
 */
describe('imageNodeDefaultParams — 新图卡默认比例/尺寸', () => {
  it('gpt-image-2.5 两个模型默认「自适应 + 1K」', () => {
    expect(imageNodeDefaultParams('gpt-image-2.5-flare')).toEqual({ aspectRatio: '自适应', imageSize: '1K' });
    expect(imageNodeDefaultParams('gpt-image-2.5-sunburst')).toEqual({ aspectRatio: '自适应', imageSize: '1K' });
  });

  it('自定义连接的 `provider/model` 值也命中（含上游后缀变体）', () => {
    expect(imageNodeDefaultParams('土豆/gpt-image-2.5-flare')).toEqual({ aspectRatio: '自适应', imageSize: '1K' });
    expect(imageNodeDefaultParams('gpt-image-2.5-flare-async')).toEqual({ aspectRatio: '自适应', imageSize: '1K' });
    expect(imageNodeDefaultParams('gpt-image-2.5-sunburst-high')).toEqual({ aspectRatio: '自适应', imageSize: '1K' });
  });

  it('其它模型保持旧默认 16:9 + 2K（不动别人）', () => {
    expect(imageNodeDefaultParams('gpt-image-2')).toEqual({ aspectRatio: '16:9', imageSize: '2K' });
    expect(imageNodeDefaultParams('flux-2-pro')).toEqual({ aspectRatio: '16:9', imageSize: '2K' });
    expect(imageNodeDefaultParams('gemini-3.1-flash-image-preview')).toEqual({ aspectRatio: '16:9', imageSize: '2K' });
    expect(imageNodeDefaultParams(undefined)).toEqual({ aspectRatio: '16:9', imageSize: '2K' });
    expect(imageNodeDefaultParams('')).toEqual({ aspectRatio: '16:9', imageSize: '2K' });
  });
});

describe('默认值真的会变成出站 size', () => {
  it('「自适应」⇒ 发 size:"auto"（上游自定原生尺寸）', () => {
    expect(officialImageSize('gpt-image-2.5-flare', '1K', '自适应')).toBe('auto');
    expect(officialImageSize('gpt-image-2.5-sunburst', '1K', '自适应')).toBe('auto');
    /* 厂商标称像素表里没有 "自适应" 这一格 ⇒ 落空 ⇒ 走官方表 ⇒ auto ✓ */
    expect(imageDimensionPreset('gpt-image-2.5-flare', '1K', '自适应')).toBeUndefined();
  });

  it('老默认（2K·3:4）确实是 1536×2048 —— 就是那张「瓦」的图', () => {
    expect(imageDimensionPreset('gpt-image-2.5-flare', '2K', '3:4')).toEqual({ width: 1536, height: 2048 });
    expect(imageDimensionPreset('gpt-image-2.5-flare', '4K', '3:4')).toEqual({ width: 2480, height: 3312 });
    expect(imageDimensionPreset('gpt-image-2.5-flare', '1K', '3:4')).toEqual({ width: 768, height: 1024 });
  });
});

describe('建卡入口真的用上了新默认（buildNodeData）', () => {
  function withPrefs(prefs: Record<string, string>): () => void {
    const store: Record<string, string> = { 'canvas-model-prefs': JSON.stringify(prefs) };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: () => {},
      removeItem: () => {},
    });
    return () => vi.unstubAllGlobals();
  }

  it('上次用的是土豆 gpt-image-2.5-flare ⇒ 自适应 + 1K，盒子 = pR(自适应) = 250×250', () => {
    const restore = withPrefs({ 'ai-image': '土豆/gpt-image-2.5-flare' });
    try {
      const data = buildNodeData('ai-image');
      expect(data.aspectRatio).toBe('自适应');
      expect(data.imageSize).toBe('1K');
      expect(data.nodeWidth).toBe(250);
      expect(data.nodeHeight).toBe(250);
    } finally {
      restore();
    }
  });

  it('上次用的是别的模型 ⇒ 仍旧 16:9 + 2K，盒子 = pR(16:9) = 444×250', () => {
    const restore = withPrefs({ 'ai-image': 'apimart/flux-2-pro' });
    try {
      const data = buildNodeData('ai-image');
      expect(data.aspectRatio).toBe('16:9');
      expect(data.imageSize).toBe('2K');
      expect(data.nodeWidth).toBe(444);
      expect(data.nodeHeight).toBe(250);
    } finally {
      restore();
    }
  });
});

describe('自定义连接（土豆）的 hash 值也要命中 —— 去 config.generalModels 取上游 modelId', () => {
  it('general/provider-custom-<hash> + modelId=gpt-image-2.5-flare ⇒ 自适应 + 1K', async () => {
    const { useAppStore } = await import('../../src/store/useAppStore');
    const { imageNodeDefaultParamsForModelValue } = await import('../../src/utils/imageNodeDefaults');
    const prev = useAppStore.getState().config;
    useAppStore.setState({
      config: {
        ...prev,
        generalModels: [{ id: 'provider-custom-2611fc0a-18oot7d', modelId: 'gpt-image-2.5-flare', name: '土豆 Flare' }],
      },
    } as never);
    try {
      expect(imageNodeDefaultParamsForModelValue('general/provider-custom-2611fc0a-18oot7d'))
        .toEqual({ aspectRatio: '自适应', imageSize: '1K' });
    } finally {
      useAppStore.setState({ config: prev });
    }
  });

  it('hash 值 + 非 2.5 的上游 modelId ⇒ 保持旧默认', async () => {
    const { useAppStore } = await import('../../src/store/useAppStore');
    const { imageNodeDefaultParamsForModelValue } = await import('../../src/utils/imageNodeDefaults');
    const prev = useAppStore.getState().config;
    useAppStore.setState({
      config: {
        ...prev,
        generalModels: [{ id: 'provider-custom-xyz', modelId: 'flux-2-pro', name: 'Flux' }],
      },
    } as never);
    try {
      expect(imageNodeDefaultParamsForModelValue('general/provider-custom-xyz'))
        .toEqual({ aspectRatio: '16:9', imageSize: '2K' });
    } finally {
      useAppStore.setState({ config: prev });
    }
  });
});
