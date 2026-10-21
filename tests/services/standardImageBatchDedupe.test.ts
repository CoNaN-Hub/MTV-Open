/**
 * 批量图片「不重复 / 不漏数」回归。
 *
 * 用户 2026：「数量 2 ⇒ MTV 出两张**一摸一样**的图，官方是风格近似但不同的两张」。
 * 实测（土豆中转站 + gpt-image-2-pro）：
 *   · 一次 `n:2`：中转站串行跑两次上游生成、却只回**一条 URL 填两遍**（`data[0].url === data[1].url`）
 *   · 两次独立调用：结果**不同**（md5 不同）
 * ⇒ `edits-json-images` 模式改为**并发 N 个单图请求**（不带 `n`）；
 *   其余模式保留「先按 URL 去重、不够再补单图请求」的通用安全网。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { corsSafeFetch } = vi.hoisted(() => ({ corsSafeFetch: vi.fn() }));
vi.mock('../../src/services/ai/httpTransport', () => ({ corsSafeFetch }));

import { generateImageStandardBatch } from '../../src/services/ai/providers/standardImage';

const jsonResponse = (payload: unknown): Response => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

const editsParams = {
  apiKey: 'k',
  baseUrl: 'https://relay.example/v1',
  modelName: 'gpt-image-2-pro',
  prompt: '参考图片1 生成日常生活道具的海报',
  dimensions: { width: 1024, height: 1024 },
  imageReferenceRequestMode: 'edits-json-images' as const,
  imageUrls: ['https://cdn/ref.png'],
};

const bodyOf = (callIndex: number): Record<string, unknown> =>
  JSON.parse(corsSafeFetch.mock.calls[callIndex][1].body as string) as Record<string, unknown>;

describe('编辑接口 JSON 模式：并发单图请求（不带 n，不出重复）', () => {
  beforeEach(() => {
    corsSafeFetch.mockReset();
  });

  it('数量 2 ⇒ 两次单图请求（都不带 n），拿到两张不同的图', async () => {
    let n = 0;
    corsSafeFetch.mockImplementation(async () => jsonResponse({ data: [{ url: `https://cdn/single-${++n}.png` }] }));

    const result = await generateImageStandardBatch(editsParams, 2);

    expect(corsSafeFetch).toHaveBeenCalledTimes(2);
    expect(bodyOf(0).n).toBeUndefined();
    expect(bodyOf(1).n).toBeUndefined();
    expect(result.results.map((item) => item.url).sort()).toEqual(['https://cdn/single-1.png', 'https://cdn/single-2.png']);
    expect(result.failedCount).toBe(0);
  });

  it('两次单图请求撞到同一张 ⇒ 去重后只交 1 张，并记账缺口（不硬凑重复图）', async () => {
    corsSafeFetch.mockImplementation(async () => jsonResponse({ data: [{ url: 'https://cdn/same.png' }] }));

    const result = await generateImageStandardBatch(editsParams, 2);

    expect(result.results.map((item) => item.url)).toEqual(['https://cdn/same.png']);
    expect(result.failedCount).toBe(1);
  });

  it('数量 1 ⇒ 只请求一次', async () => {
    corsSafeFetch.mockImplementation(async () => jsonResponse({ data: [{ url: 'https://cdn/one.png' }] }));

    const result = await generateImageStandardBatch(editsParams, 1);

    expect(corsSafeFetch).toHaveBeenCalledTimes(1);
    expect(result.results.map((item) => item.url)).toEqual(['https://cdn/one.png']);
  });
});

describe('其余模式：通用去重安全网（服务商把 n 当摆设时）', () => {
  beforeEach(() => {
    corsSafeFetch.mockReset();
  });

  const generationParams = { ...editsParams, imageReferenceRequestMode: 'generation-json-image-urls' as const };

  it('n=2 返回两条同一 URL ⇒ 去重 + 补一次单图请求（第一次带 n=2，补的不带）', async () => {
    corsSafeFetch
      .mockResolvedValueOnce(jsonResponse({ data: [{ url: 'https://cdn/same.png' }, { url: 'https://cdn/same.png' }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ url: 'https://cdn/other.png' }] }));

    const result = await generateImageStandardBatch(generationParams, 2);

    expect(result.results.map((item) => item.url)).toEqual(['https://cdn/same.png', 'https://cdn/other.png']);
    expect(corsSafeFetch).toHaveBeenCalledTimes(2);
    expect(bodyOf(0).n).toBe(2);
    /* 补的那次是单图请求（非编辑模式下请求体里会带 `n: 1`） */
    expect(bodyOf(1).n).toBe(1);
  });
});
