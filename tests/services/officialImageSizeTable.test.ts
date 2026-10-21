/**
 * 出站 `size` 的三级取值顺序回归测试。
 *
 * 用户 2026 报的「一样的模型/参考图/提示词，MTV 出图效果比官方差很多、涂抹痕迹重」，
 * 逐层查下来是**尺寸把用户选的档位吃掉了**。实测（土豆中转站 + gpt-image-2.5-flare）：
 *   · 中转站只认**自己文档里的像素**：`768x1024`⇒768x1024 ✓、`2480x3312`⇒2480x3312 ✓
 *   · 发别的值不报错但**静默回落到不受控的默认尺寸**：
 *       `864x1152`（官方 1K·3:4）⇒ 1536x2048 ✗；`1728x2304`（官方 2K·3:4）⇒ 2480x3312 ✗
 *       `1024x1360`（旧短边换算）⇒ 同样不被承认 ✗
 * ⇒ 顺序必须是：**厂商声明 > 官方画布表 > 短边换算**。
 * 官方画布表来自其运行时常量 `xYe`（`tapnow://app/assets/index-*.js`）。
 */
import { describe, expect, it, vi } from 'vitest';

const { corsSafeFetch } = vi.hoisted(() => ({ corsSafeFetch: vi.fn() }));
vi.mock('../../src/services/ai/httpTransport', () => ({ corsSafeFetch }));

import { generateImageStandardBatch } from '../../src/services/ai/providers/standardImage';
import {
  OFFICIAL_IMAGE_SIZES,
  dimensionsFromImageSize,
  isOfficialImageSizeModel,
  officialImageSize,
} from '../../src/services/ai/officialImageSizes';

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('官方像素表', () => {
  it('1:1 三档与官方一致', () => {
    expect(OFFICIAL_IMAGE_SIZES['1K']['1:1']).toBe('1024x1024');
    expect(OFFICIAL_IMAGE_SIZES['2K']['1:1']).toBe('2048x2048');
    expect(OFFICIAL_IMAGE_SIZES['4K']['1:1']).toBe('2880x2880');
  });

  it('发给上游的尺寸与官方逐条相同（含用户实测的那三档 3:4）', () => {
    expect(officialImageSize('gpt-image-2.5-flare', '1K', '3:4')).toBe('864x1152');
    expect(officialImageSize('gpt-image-2.5-flare', '2K', '3:4')).toBe('1728x2304');
    expect(officialImageSize('gpt-image-2.5-flare', '4K', '3:4')).toBe('2480x3312');
    expect(officialImageSize('gpt-image-2.5-flare', '1K', '16:9')).toBe('1360x768');
  });

  it('表里每一格都是合法像素串，且宽高比与键一致（±1.5%）', () => {
    for (const [tier, ratios] of Object.entries(OFFICIAL_IMAGE_SIZES)) {
      for (const [ratio, size] of Object.entries(ratios)) {
        const dims = dimensionsFromImageSize(size);
        expect(dims, `${tier} ${ratio}`).toBeDefined();
        const [w, h] = ratio.split(':').map(Number);
        expect(Math.abs(dims!.width / dims!.height - w / h) / (w / h)).toBeLessThan(0.015);
      }
    }
  });

  it('720p 归到 1K；表外比例/档位不猜，返回 undefined', () => {
    expect(officialImageSize('gpt-image-2', '720p', '1:1')).toBe('1024x1024');
    expect(officialImageSize('gpt-image-2', '1K', '7:5')).toBeUndefined();
    expect(officialImageSize('gpt-image-2', '6K', '1:1')).toBeUndefined();
    expect(officialImageSize('gpt-image-2', undefined, '1:1')).toBeUndefined();
  });

  it('「自适应」按官方发 size:"auto"（不再退成 1:1 的 1024x1024）', () => {
    expect(officialImageSize('gpt-image-2.5-flare', '1K', '自适应')).toBe('auto');
    expect(officialImageSize('gpt-image-2.5-flare', '2K', 'auto')).toBe('auto');
    // 非官方族模型不受影响
    expect(officialImageSize('gemini-3-pro-image-preview', '1K', '自适应')).toBeUndefined();
  });

  it('只对官方这一族模型生效（别的厂商保持各自原样）', () => {
    expect(isOfficialImageSizeModel('gpt-image-2.5-flare')).toBe(true);
    expect(isOfficialImageSizeModel('dall-e-3')).toBe(true);
    expect(isOfficialImageSizeModel('gemini-3-pro-image-preview')).toBe(false);
    expect(isOfficialImageSizeModel('doubao-seedream-4-0')).toBe(false);
    expect(isOfficialImageSizeModel(undefined)).toBe(false);
  });
});

describe('standardImage 出站 size', () => {
  it('厂商（能力表）声明了像素时用它 —— 中转站只认自己文档里的值', async () => {
    corsSafeFetch.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn/out.png' }] }));

    await generateImageStandardBatch({
      apiKey: 'k',
      baseUrl: 'https://relay.example/v1',
      modelName: 'gpt-image-2.5-flare',
      prompt: 'p',
      // 调用方按旧算法算出来的尺寸；厂商表命中时必须被覆盖
      dimensions: { width: 1024, height: 1365 },
      imageSize: '1K',
      aspectRatio: '3:4',
      imageUrls: ['https://cdn/ref.png'],
      imageReferenceRequestMode: 'edits-json-images',
    }, 1);

    const body = JSON.parse(corsSafeFetch.mock.calls[0][1].body) as Record<string, unknown>;
    // 实测中转站对这个值产出 768x1024；发官方的 864x1152 会被无视
    expect(body.size).toBe('768x1024');
  });

  it('2K·3:4 同样用厂商声明的 1536x2048（实测该值被完整照做）', async () => {
    corsSafeFetch.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn/o2.png' }] }));

    await generateImageStandardBatch({
      apiKey: 'k',
      baseUrl: 'https://relay.example/v1',
      modelName: 'gpt-image-2.5-flare',
      prompt: 'p',
      dimensions: { width: 2048, height: 2731 },
      imageSize: '2K',
      aspectRatio: '3:4',
      imageUrls: ['https://cdn/ref.png'],
      imageReferenceRequestMode: 'edits-json-images',
    }, 1);

    const body = JSON.parse(corsSafeFetch.mock.calls[0][1].body) as Record<string, unknown>;
    expect(body.size).toBe('1536x2048');
  });

  it('厂商没声明时退回官方画布表', async () => {
    corsSafeFetch.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn/o4.png' }] }));

    await generateImageStandardBatch({
      apiKey: 'k',
      baseUrl: 'https://relay.example/v1',
      modelName: 'gpt-image-9-turbo',
      prompt: 'p',
      dimensions: { width: 1024, height: 1365 },
      imageSize: '1K',
      aspectRatio: '3:4',
      imageUrls: ['https://cdn/ref.png'],
      imageReferenceRequestMode: 'edits-json-images',
    }, 1);

    const body = JSON.parse(corsSafeFetch.mock.calls[0][1].body) as Record<string, unknown>;
    expect(body.size).toBe('864x1152');
  });

  it('非 gpt-image 族仍用调用方给的短边换算结果', async () => {
    corsSafeFetch.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn/o3.png' }] }));

    await generateImageStandardBatch({
      apiKey: 'k',
      baseUrl: 'https://relay.example/v1',
      modelName: 'some-vendor-image-v2',
      prompt: 'p',
      dimensions: { width: 1024, height: 1365 },
      imageSize: '1K',
      aspectRatio: '3:4',
      imageUrls: ['https://cdn/ref.png'],
      imageReferenceRequestMode: 'edits-json-images',
    }, 1);

    const body = JSON.parse(corsSafeFetch.mock.calls[0][1].body) as Record<string, unknown>;
    expect(body.size).toBe('1024x1365');
  });
});
