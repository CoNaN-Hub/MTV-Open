/**
 * **round 129 · Gemini 原生图像形态的两项引擎能力 + 土豆合同**（P0 端点路由修复）
 *
 * 第一方依据：土豆文档 `https://docs.ai-tudou.net/nano-banana-api-docs.html`
 * （2026-10-16 取，落盘 `D:\DEEPSEEK\_r130-nano-banana-doc.html`）逐字：
 *   · 「**必须使用 Gemini 原生渠道**，否则 `imageConfig` 参数会被忽略，比例和分辨率无法控制」；
 *     渠道表：`Gemini 原生渠道 /v1beta/models/{model}:generateContent` ✓ /
 *     **`OpenAI 兼容渠道 /v1/images/generations` ✗ 不支持，参数被忽略或者请求失败**；
 *   · 可用模型：`gemini-3-pro-image-preview`、`gemini-3.1-flash-image-preview`；
 *   · 请求：`{contents:[{role:"user",parts:[…inlineData…,{text}]}],
 *     generationConfig:{responseModalities:["TEXT","IMAGE"],imageConfig:{aspectRatio,imageSize}}}`；
 *   · 响应：逐 part 先 `if (part.thought) continue;`，再取 `part.inlineData || part.inline_data`
 *     的 `.data`；或从 `part.text` 里捞 Markdown data URL。
 *
 * 真机背景（用户 2026-10-15）：待决卡模型 `general/provider-custom-2611fc0a-1idsg9`
 * → 上游 `gemini-3-pro-image-preview`（`D:\DEEPSEEK\probe-t123-trigger.mjs:27`）；
 * MTV 把它发到通用同步链路的 `/v1/images/generations` ⇒ 上游回
 * `not supported model for image generation, only imagen models are supported`。
 */
import { describe, expect, it } from 'vitest';

import { tudouImageContract } from '../../src/services/models/adapters/tudou';
import { buildModelProtocolRequest } from '../../src/services/ai/modelProtocolRequest';
import { executeModelProtocol, parseModelExecutionProtocol } from '../../src/services/ai/modelProtocol';
import { readGeminiImageParts } from '../../src/services/ai/modelProtocolResponse';

const DOC_URL = 'https://docs.ai-tudou.net/nano-banana-api-docs.html';

function ctx(over: Record<string, unknown> = {}) {
  return {
    providerId: 'tudou',
    providerModelId: 'gemini-3-pro-image-preview',
    baseModelId: 'gemini-3-pro-image-preview',
    executionMode: 'sync' as const,
    imageSize: '2K',
    aspectRatio: '16:9',
    quality: 'medium',
    baseUrl: 'https://api.ai-tudou.net',
    ...over,
  } as Parameters<typeof tudouImageContract>[0];
}

describe('round 129 · 土豆 Gemini 原生合同（文档规定的端点，不再走 /v1/images/generations）', () => {
  it('文档明列的两个模型 ⇒ 走 `/v1beta/models/{{model}}:generateContent`', () => {
    for (const model of ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview']) {
      const contract = tudouImageContract(ctx({ providerModelId: model, baseModelId: model }));
      expect(contract?.kind, model).toBe('protocol');
      if (contract?.kind !== 'protocol') throw new Error('unreachable');
      expect(contract.protocol.submit.path, model).toBe('/v1beta/models/{{model}}:generateContent');
      expect(contract.protocol.mode, model).toBe('sync');
      /* 文档：「必须使用 Gemini 原生渠道」⇒ 绝不是那条被标 ✗ 的 OpenAI 兼容图片端点。 */
      expect(contract.protocol.submit.path, model).not.toContain('/images/generations');
    }
  });

  it('★ 路径里的 `{{model}}` 真能渲染（不是旁路 replace）', () => {
    const contract = tudouImageContract(ctx());
    if (contract?.kind !== 'protocol') throw new Error('unreachable');
    const built = buildModelProtocolRequest({
      protocol: contract.protocol,
      baseUrl: 'https://api.ai-tudou.net',
      apiKey: 'test-only-key',
      variables: { model: 'gemini-3-pro-image-preview', prompt: 'a cat', imageUrls: [] },
    });
    expect(built.url).toBe('https://api.ai-tudou.net/v1beta/models/gemini-3-pro-image-preview:generateContent');
  });

  it('请求体逐字按文档：contents/parts/text + generationConfig.responseModalities + imageConfig', () => {
    const contract = tudouImageContract(ctx());
    if (contract?.kind !== 'protocol') throw new Error('unreachable');
    const body = contract.protocol.submit.body as Record<string, unknown>;
    const contents = body.contents as Array<Record<string, unknown>>;
    expect(contents[0]?.role).toBe('user');
    /* 参考图那一段是 `$forEach` 指令（渲染时才展开）；无参考图时整段省略，见下面的渲染用例。 */
    expect(contents[0]?.parts).toEqual([
      { $forEach: '{{imageUrls}}', $value: { inlineData: { $inlineData: '{{imageUrls}}' } } },
      { text: '{{prompt}}' },
    ]);
    expect(body.generationConfig).toEqual({
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: '2K', aspectRatio: '16:9' },
    });
    expect(contract.protocol.response).toEqual({ type: 'json', result: { geminiImageParts: true } });
  });

  it('★ 合同整体渲染出文档给的请求体（含参考图 → `parts[].inlineData`）', () => {
    const contract = tudouImageContract(ctx());
    if (contract?.kind !== 'protocol') throw new Error('unreachable');
    const built = buildModelProtocolRequest({
      protocol: contract.protocol,
      baseUrl: 'https://api.ai-tudou.net',
      apiKey: 'test-only-key',
      variables: {
        model: 'gemini-3-pro-image-preview',
        prompt: 'a cat',
        imageUrls: ['data:image/jpeg;base64,REF'],
      },
    });
    expect(built.renderedBody).toEqual({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: 'REF' } },
          { text: 'a cat' },
        ],
      }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '2K', aspectRatio: '16:9' } },
    });
  });

  it('文档标 `imageConfig.aspectRatio` **非必填** ⇒ 没来源/`auto` 一律**省略**（不替用户断言比例）', () => {
    for (const aspectRatio of [undefined, '', 'auto']) {
      const contract = tudouImageContract(ctx({ aspectRatio }));
      if (contract?.kind !== 'protocol') throw new Error('unreachable');
      const config = (contract.protocol.submit.body as { generationConfig: { imageConfig: Record<string, string> } })
        .generationConfig.imageConfig;
      expect(config, String(aspectRatio)).toEqual({ imageSize: '2K' });
    }
  });

  it('文档白名单外的比例 ⇒ **报错**（不替换、不猜）', () => {
    expect(() => tudouImageContract(ctx({ aspectRatio: '7:4' }))).toThrow(/不支持比例 7:4/);
  });

  it('档位必须落在文档的 1K/2K/4K', () => {
    for (const imageSize of ['1k', '4K', '2K']) {
      expect(() => tudouImageContract(ctx({ imageSize }))).not.toThrow();
    }
    expect(() => tudouImageContract(ctx({ imageSize: '8K' }))).toThrow(/不支持图片档位 8K/);
  });

  it('`-async` 那一组仍走原异步合同（本轮没动它）', () => {
    const contract = tudouImageContract(ctx({
      providerModelId: 'gpt-image-2.5-flare-async',
      baseModelId: 'gpt-image-2.5-flare',
      executionMode: 'async',
    }));
    if (contract?.kind !== 'protocol') throw new Error('unreachable');
    expect(contract.protocol.submit.path).toBe('/images/generations/async');
  });

  it('既非 async 组、也不在文档模型表里 ⇒ 仍返回 undefined（不擅自接管别人的模型）', () => {
    expect(tudouImageContract(ctx({ providerModelId: 'gpt-image-2-all', baseModelId: 'gpt-image-2-all' })))
      .toBeUndefined();
  });

  it('合同里的依据可回查第一方文档（注释里带 URL）', async () => {
    const source = await import('node:fs').then((fs) => fs.readFileSync(
      new URL('../../src/services/models/adapters/tudou.ts', import.meta.url),
      'utf8',
    ));
    expect(source).toContain(DOC_URL);
  });
});

describe('round 129 · `$inlineData`（请求侧形态能力）：data URL → `{mimeType, data}`', () => {
  function protocol(body: unknown) {
    return parseModelExecutionProtocol({
      version: 2,
      mode: 'sync',
      auth: { type: 'bearer' },
      submit: { method: 'POST', path: '/v1beta/models/{{model}}:generateContent', bodyEncoding: 'json', body },
      response: { type: 'json', result: { urlPath: 'url' } },
    });
  }

  it('参考图逐项展开成裸 base64 + 各自的 mimeType（不写死 mime）', () => {
    const built = buildModelProtocolRequest({
      protocol: protocol({
        contents: [{
          role: 'user',
          parts: [
            { $forEach: '{{imageUrls}}', $value: { inlineData: { $inlineData: '{{imageUrls}}' } } },
            { text: '{{prompt}}' },
          ],
        }],
      }),
      baseUrl: 'https://api.ai-tudou.net',
      apiKey: 'k',
      variables: {
        model: 'gemini-3-pro-image-preview',
        prompt: 'p',
        imageUrls: ['data:image/jpeg;base64,AAA', 'data:image/png;base64,BBB'],
      },
    });
    const contents = (built.renderedBody as { contents: Array<{ parts: unknown[] }> }).contents;
    expect(contents[0].parts).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: 'AAA' } },
      { inlineData: { mimeType: 'image/png', data: 'BBB' } },
      { text: 'p' },
    ]);
  });

  it('没有参考图 ⇒ 该段整段省略（不是塞一个空 inlineData）', () => {
    const built = buildModelProtocolRequest({
      protocol: protocol({
        parts: [
          { $forEach: '{{imageUrls}}', $value: { inlineData: { $inlineData: '{{imageUrls}}' } } },
          { text: '{{prompt}}' },
        ],
      }),
      baseUrl: 'https://api.ai-tudou.net',
      apiKey: 'k',
      variables: { model: 'm', prompt: 'p', imageUrls: [] },
    });
    expect((built.renderedBody as { parts: unknown[] }).parts).toEqual([{ text: 'p' }]);
  });

  it('拿到普通 URL ⇒ **报错**（不许把 URL 塞进 base64 字段，也不静默降级）', () => {
    expect(() => buildModelProtocolRequest({
      protocol: protocol({ parts: [{ $inlineData: '{{imageUrls.0}}' }] }),
      baseUrl: 'https://api.ai-tudou.net',
      apiKey: 'k',
      variables: { model: 'm', prompt: 'p', imageUrls: ['https://example.invalid/a.png'] },
    })).toThrow(/需要一个 data URL/);
  });
});

describe('round 129 · `geminiImageParts`（响应侧形态能力）：逐字照文档提取', () => {
  it('格式 1：`inlineData.data` + 同 part 的 `mimeType`', () => {
    expect(readGeminiImageParts({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'AAA' } }] } }],
    })).toEqual(['data:image/jpeg;base64,AAA']);
  });

  it('★ 跳过 `thought`（文档第一句就是 `if (part.thought) continue;`）', () => {
    expect(readGeminiImageParts({
      candidates: [{
        content: {
          parts: [
            { thought: true, inlineData: { mimeType: 'image/png', data: 'THOUGHT' } },
            { inlineData: { mimeType: 'image/png', data: 'REAL' } },
          ],
        },
      }],
    })).toEqual(['data:image/png;base64,REAL']);
  });

  it('`inline_data` 别名也认（文档 `part.inlineData || part.inline_data`）', () => {
    expect(readGeminiImageParts({
      candidates: [{ content: { parts: [{ inline_data: { mimeType: 'image/webp', data: 'WWW' } }] } }],
    })).toEqual(['data:image/webp;base64,WWW']);
  });

  it('格式 2：`text` 里的 Markdown data URL（文档给的正则）', () => {
    expect(readGeminiImageParts({
      candidates: [{
        content: {
          parts: [
            { thought: true, text: 'thinking…' },
            { text: 'ok ![image](data:image/png;base64,CCC)' },
          ],
        },
      }],
    })).toEqual(['data:image/png;base64,CCC']);
  });

  it('★ 反例：`thought` 的 **text** 形态也不提取（文档第一句对每个 part 生效）', () => {
    expect(readGeminiImageParts({
      candidates: [{
        content: {
          parts: [
            { thought: true, text: 'thinking ![image](data:image/jpeg;base64,THOUGHTTEXT)' },
            { text: 'ok ![image](data:image/png;base64,REAL)' },
          ],
        },
      }],
    })).toEqual(['data:image/png;base64,REAL']);
  });

  it('★ text 形态的 mime 取自 data URL 前缀（jpeg 不能写成 png）', () => {
    expect(readGeminiImageParts({
      candidates: [{ content: { parts: [{ text: '![image](data:image/jpeg;base64,JPEGDATA)' }] } }],
    })).toEqual(['data:image/jpeg;base64,JPEGDATA']);
  });

  it('没有图片 ⇒ 空数组（调用方按「没找到结果」报错）', () => {
    expect(readGeminiImageParts({ candidates: [{ content: { parts: [{ text: 'no image' }] } }] })).toEqual([]);
    expect(readGeminiImageParts({})).toEqual([]);
  });

  it('`executeModelProtocol` 真把它当产物返回（接通到结果层）', async () => {
    const protocol = parseModelExecutionProtocol({
      version: 2,
      mode: 'sync',
      auth: { type: 'bearer' },
      submit: { method: 'POST', path: '/v1beta/models/{{model}}:generateContent', bodyEncoding: 'json', body: { contents: [] } },
      response: { type: 'json', result: { geminiImageParts: true } },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'OK' } }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
    try {
      const result = await executeModelProtocol({
        protocol,
        baseUrl: 'https://api.ai-tudou.net',
        apiKey: 'k',
        variables: { model: 'gemini-3-pro-image-preview', prompt: 'p', imageUrls: [] },
      });
      expect(result.urls).toEqual(['data:image/png;base64,OK']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('校验器接受它作为合法结果源（不再要求 urlPath/base64Path）', () => {
    expect(() => parseModelExecutionProtocol({
      version: 2,
      mode: 'sync',
      auth: { type: 'bearer' },
      submit: { method: 'POST', path: '/x', bodyEncoding: 'json', body: {} },
      response: { type: 'json', result: { geminiImageParts: true } },
    })).not.toThrow();
    expect(() => parseModelExecutionProtocol({
      version: 2,
      mode: 'sync',
      auth: { type: 'bearer' },
      submit: { method: 'POST', path: '/x', bodyEncoding: 'json', body: {} },
      response: { type: 'json', result: { geminiImageParts: 'yes' } },
    })).toThrow(/必须是布尔值/);
  });
});
