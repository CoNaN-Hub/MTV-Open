/**
 * 参考图「调用语义」回归测试（用户 2026 实测出来的那条）。
 *
 * 背景（抓包 + 逐形态对照，土豆中转站 + gpt-image-2-pro）：
 *   · `/images/generations` + `image_urls`/`image`/`scene`/`{{Image 1}}` ⇒ 一律**无视参考图**（重新构思画面）
 *   · `/images/edits` + multipart ⇒ 400「multipart/form-data is not supported」
 *   · `/images/edits` + **JSON** `{model,prompt,size,images:[...]}` ⇒ ✅ 完全跟着参考图（用户原话即可）
 *   · 官方客户端同语义：`{prompt:"参考{{Image 1}} …", scene:"image-edit", images:[…]}`
 * ⇒ 本模式的意义就是「参考图当底图的编辑语义」，而**不是**「文生图 + 参考图列表」。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { corsSafeFetch } = vi.hoisted(() => ({ corsSafeFetch: vi.fn() }));
vi.mock('../../src/services/ai/httpTransport', () => ({ corsSafeFetch }));

import { generateImageStandardBatch } from '../../src/services/ai/providers/standardImage';

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('参考图调用语义：编辑接口 + JSON（edits-json-images）', () => {
  beforeEach(() => {
    corsSafeFetch.mockReset();
  });

  it('有参考图时打到 /images/edits（JSON，images 数组），不打 /images/generations', async () => {
    corsSafeFetch.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn/out.png' }] }));

    const result = await generateImageStandardBatch({
      apiKey: 'k',
      baseUrl: 'https://relay.example/v1/',
      modelName: 'gpt-image-2-pro',
      prompt: '参考图片1 生成日常生活道具的海报',
      dimensions: { width: 864, height: 1152 },
      imageUrls: ['https://cdn/ref.png'],
      imageReferenceRequestMode: 'edits-json-images',
    }, 1);

    expect(corsSafeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = corsSafeFetch.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe('https://relay.example/v1/images/edits');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.model).toBe('gpt-image-2-pro');
    expect(body.prompt).toBe('参考图片1 生成日常生活道具的海报');
    expect(body.size).toBe('864x1152');
    expect(body.images).toEqual(['https://cdn/ref.png']);
    // 编辑接口不认这两个字段：别把 generations 那套带过来
    expect(body.image_urls).toBeUndefined();
    expect(body.image).toBeUndefined();
    expect(result.results[0].url).toBe('https://cdn/out.png');
  });

  it('没有参考图时退回生成接口（不该无脑打 /images/edits）', async () => {
    corsSafeFetch.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn/out2.png' }] }));

    await generateImageStandardBatch({
      apiKey: 'k',
      baseUrl: 'https://relay.example/v1',
      modelName: 'gpt-image-2-pro',
      prompt: 'p',
      dimensions: { width: 1024, height: 1024 },
      imageUrls: [],
      imageReferenceRequestMode: 'edits-json-images',
    }, 1);

    expect(String(corsSafeFetch.mock.calls[0][0])).toContain('/images/generations');
  });

  it('参考图仍是本地/公网 URL 时原样透传（不强制内联 data URL）', async () => {
    corsSafeFetch.mockResolvedValue(jsonResponse({ data: [{ url: 'https://cdn/out3.png' }] }));

    await generateImageStandardBatch({
      apiKey: 'k',
      baseUrl: 'https://relay.example/v1',
      modelName: 'gemini-3-pro-image-preview',
      prompt: 'p',
      dimensions: { width: 1024, height: 1024 },
      imageUrls: ['https://h.uguu.se/abc.png', 'https://h.uguu.se/def.png'],
      imageReferenceRequestMode: 'edits-json-images',
    }, 1);

    const body = JSON.parse(corsSafeFetch.mock.calls[0][1].body) as Record<string, unknown>;
    expect(body.images).toEqual(['https://h.uguu.se/abc.png', 'https://h.uguu.se/def.png']);
  });
});
