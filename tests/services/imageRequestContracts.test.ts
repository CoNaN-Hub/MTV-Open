import { describe, expect, it } from 'vitest';
import { resolveBuiltInImageRequestContract, validateBuiltInImageResponse } from '../../src/services/ai/imageRequestContracts';
import { getProviderDefinition } from '../../src/services/ai/providerCatalogService';
import { previewModelProtocolRequest, validateModelExecutionProtocol } from '../../src/services/ai/modelProtocol';
import { resolvePoll } from '../../src/services/ai/modelProtocolPoll';

const TUDOU = 'https://api.ai-tudou.net/v1';

function tudouContract(model = 'gpt-image-2.5-flare-async', size = '1K', ratio = '3:4', quality = 'medium') {
  const contract = resolveBuiltInImageRequestContract(
    undefined, model, size, ratio, TUDOU, quality,
  );
  if (contract?.kind !== 'protocol') throw new Error('Expected a 土豆 async protocol');
  return contract;
}

function contractFor(model: string, size = '2K', ratio = '16:9') {
  const contract = resolveBuiltInImageRequestContract(getProviderDefinition('grsai'), model, size, ratio);
  if (contract?.kind !== 'protocol') throw new Error('Expected a documented GRSAI protocol');
  return contract;
}

describe('built-in image request contracts', () => {
  it('reuses the CCC catalog contract without guessing from a GPT model name', () => {
    expect(resolveBuiltInImageRequestContract(getProviderDefinition('cccapi'), 'gpt-image-2.5-sunburst', '2K', '16:9'))
      .toEqual({ kind: 'standard', imageReferenceRequestMode: 'edits-multipart' });
    for (const provider of ['custom-openai', 'google', 'xai']) {
      expect(resolveBuiltInImageRequestContract(getProviderDefinition(provider), 'gpt-image-2.5-sunburst', '2K', '16:9')).toBeUndefined();
    }
    expect(resolveBuiltInImageRequestContract(getProviderDefinition('cccapi'), 'vendor-image', '2K', '16:9')).toBeUndefined();
    expect(resolveBuiltInImageRequestContract(getProviderDefinition('grsai'), 'undocumented-image', '2K', '16:9')).toBeUndefined();
  });

  it('maps Nano Banana references and sizes to native JSON fields through the shared protocol engine', () => {
    const { protocol } = contractFor('nano-banana-2');
    expect(validateModelExecutionProtocol(protocol)).toEqual([]);
    const request = previewModelProtocolRequest({
      baseUrl: 'https://gateway.example/v1', protocol,
      variables: { model: 'nano-banana-2', prompt: '合影', imageUrls: ['https://cdn.example/a.png', 'https://cdn.example/b.png'] },
    });
    expect(request.relativeUrl).toBe('/v1/api/generate');
    expect(request.body).toEqual({
      model: 'nano-banana-2', prompt: '合影', images: ['https://cdn.example/a.png', 'https://cdn.example/b.png'],
      aspectRatio: '16:9', imageSize: '2K', replyType: 'json',
    });
  });

  it.each(['gpt-image-2', 'gpt-image-2.5'])('keeps the documented 1K ratio contract for %s', (model) => {
    const contract = contractFor(model, '4K');
    expect(contract.protocol.submit.body).toMatchObject({ aspectRatio: '16:9', quality: 'auto' });
    expect(contract.dimensions).toEqual({ width: 1672, height: 941 });
    expect(contract.protocol.submit.body).not.toHaveProperty('imageSize');
    expect(contract.protocol.submit.body).not.toHaveProperty('resolution');
  });

  it.each(['gpt-image-2-vip', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'])('uses documented pixel sizes for %s', (model) => {
    const contract = contractFor(model);
    expect(contract.protocol.submit.body).toMatchObject({ aspectRatio: '2048x1152', quality: 'medium' });
    expect(contract.dimensions).toEqual({ width: 2048, height: 1152 });
    expect(validateModelExecutionProtocol(contract.protocol)).toEqual([]);
  });

  it.each(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9', '9:21', '2:1', '1:2'])(
    'keeps 4K GPT pixels within the documented limits (%s)', (ratio) => {
      const { width, height } = contractFor('gpt-image-2-vip', '4K', ratio).dimensions;
      expect(Math.max(width, height)).toBeLessThanOrEqual(3840);
      expect(width % 16).toBe(0);
      expect(height % 16).toBe(0);
      expect(width * height).toBeLessThanOrEqual(8294400);
      expect(width * height).toBeGreaterThanOrEqual(655360);
    },
  );

  it('rejects unsupported parameters before requesting a generation', () => {
    expect(() => contractFor('nano-banana-pro', '8K')).toThrow('不支持图片档位');
    expect(() => contractFor('nano-banana-pro', '2K', '1:8')).toThrow('不支持比例');
    expect(contractFor('nano-banana-2', '2K', '1:8').protocol.submit.body).toMatchObject({ aspectRatio: '1:8' });
    expect(contractFor('nano-banana-2', '720p').protocol.submit.body).toMatchObject({ imageSize: '1K' });
    expect(contractFor('gpt-image-2-vip', '4K', 'auto').protocol.submit.body).toMatchObject({ aspectRatio: 'auto' });
  });

  it('does not treat failed or unfinished task responses as generated images', () => {
    expect(() => validateBuiltInImageResponse({ status: 'failed', error: 'reference rejected' })).toThrow('reference rejected');
    expect(() => validateBuiltInImageResponse({ status: 'running', id: 'task-id' })).toThrow('不要重复提交');
    expect(() => validateBuiltInImageResponse({ status: 'succeeded' })).not.toThrow();
  });
});

/**
 * 土豆（ai-tudou）异步生图 —— 2026 实测：它的**同步**端点会把参考图静默丢弃
 * （`image` / `image_urls` 都不认），只有 `/images/generations/async` + `images` 吃参考图。
 * 这里锁住「端点 / 字段 / 小写档位 / 轮询取图」四件事，避免退回被丢参考图的老行为。
 *
 * ★ 用户 2026 纠正：同步与异步是**两组独立模型**（`…-flare`/`…-sunburst` 同步、
 *   `…-flare-async`/`…-sunburst-async` 异步）⇒ **只有 id 自带 `-async` 后缀的才走这条异步合同**；
 *   同步 id 一律**原样**交给通用同步链路，绝不再被改写成 `…-async`（旧行为 ✗）。
 */
describe('土豆异步生图合同', () => {
  it('同步模型（不带 -async）不套这条异步合同，原样走同步链路', () => {
    for (const model of ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']) {
      expect(resolveBuiltInImageRequestContract(undefined, model, '1K', '3:4', TUDOU, 'medium')).toBeUndefined();
    }
  });

  it('按连接域名识别，且 resolution 用文档要求的小写档位', () => {
    const contract = tudouContract('gpt-image-2.5-flare-async', '1K', '3:4');
    expect(contract.referenceInput).toBe('data-url');
    expect(contract.protocol.mode).toBe('async');
    expect(validateModelExecutionProtocol(contract.protocol)).toEqual([]);
    const request = previewModelProtocolRequest({
      baseUrl: TUDOU, protocol: contract.protocol,
      variables: { model: 'gpt-image-2.5-flare-async', prompt: '参考图片1 生成日常生活道具的海报', imageUrls: ['data:image/png;base64,AAAA'] },
    });
    expect(request.relativeUrl).toBe('/v1/images/generations/async');
    expect(request.body).toEqual({
      /* 用户选的异步模型 id **原样**发出去（不再从 `…-flare` 改写而来） */
      model: 'gpt-image-2.5-flare-async',
      prompt: '参考图片1 生成日常生活道具的海报',
      size: '3:4',
      resolution: '1k',
      quality: 'medium',
      images: ['data:image/png;base64,AAAA'],
    });
    expect(contract.dimensions).toEqual({ width: 768, height: 1024 });
  });

  it('2K/4K 也走小写，720p 归到 1k', () => {
    expect(tudouContract('gpt-image-2.5-sunburst-async', '2K').protocol.submit.body).toMatchObject({
      model: 'gpt-image-2.5-sunburst-async', resolution: '2k',
    });
    expect(tudouContract('gpt-image-2-all', '4K').protocol.submit.body).toMatchObject({
      model: 'gpt-image-2-all', resolution: '4k',
    });
    expect(tudouContract('gpt-image-2.5-flare-async', '720p').protocol.submit.body).toMatchObject({ resolution: '1k' });
  });

  it('精细度只放行 low/medium/high，越界回落 medium', () => {
    expect(tudouContract('gpt-image-2.5-flare-async', '1K', '3:4', 'low').protocol.submit.body).toMatchObject({ quality: 'low' });
    expect(tudouContract('gpt-image-2.5-flare-async', '1K', '3:4', 'high').protocol.submit.body).toMatchObject({ quality: 'high' });
    expect(tudouContract('gpt-image-2.5-flare-async', '1K', '3:4', 'max').protocol.submit.body).toMatchObject({ quality: 'medium' });
    expect(tudouContract('gpt-image-2.5-flare-async', '1K', '3:4', undefined).protocol.submit.body).toMatchObject({ quality: 'medium' });
  });

  it('轮询路径用提交响应里的 data.id，结果取 data.result.images[0].url[0]', () => {
    const contract = tudouContract();
    const poll = resolvePoll(TUDOU, contract.protocol.poll!, contract.protocol.auth, {
      submit: { code: 200, data: { id: 'task_ABC', status: 'submitted' } },
    });
    expect(poll.url).toBe('https://api.ai-tudou.net/v1/tasks/task_ABC');
    expect(poll).toMatchObject({
      statusPath: 'data.status', successValues: ['completed'], failureValues: ['failed'],
      resultUrlPath: 'data.result.images.0.url.0',
      errorPath: 'data.error.message', progressPath: 'data.progress',
    });
    /* 产物在另一个域名（ms.ai-tudou.net）⇒ 不能开同源下载，实测会报「不同源」✗ */
    expect(poll.resultFetchUrl).toBeUndefined();
  });

  it('不在土豆域名上就不启用这条自有协议（不按模型名推广）', () => {
    for (const baseUrl of ['https://api.openai.com/v1', 'https://api.apimart.ai/v1', 'https://api.ai-tudou.net.evil.com/v1', undefined]) {
      expect(resolveBuiltInImageRequestContract(undefined, 'gpt-image-2.5-flare-async', '1K', '3:4', baseUrl, 'medium')).toBeUndefined();
    }
    // 土豆上没有异步端点的模型也不接（`gpt-image-2-pro` 只注册了同步端点）
    expect(resolveBuiltInImageRequestContract(undefined, 'gpt-image-2-pro', '1K', '3:4', TUDOU, 'medium')).toBeUndefined();
    /* ★ round 129 改判：`gemini-3-pro-image-preview` 在土豆上**有**自有合同 —— **Gemini 原生渠道**。
       旧断言（`toBeUndefined()`，即落到通用同步链路）正是真机
       `not supported model for image generation, only imagen models are supported` 的来源。
       依据（第一方文档 `https://docs.ai-tudou.net/nano-banana-api-docs.html`）逐字：
       「必须使用 Gemini 原生渠道」；渠道表 `Gemini 原生渠道 /v1beta/models/{model}:generateContent` ✓ /
       `OpenAI 兼容渠道 /v1/images/generations` **✗ 不支持，参数被忽略或者请求失败**。
       逐字用例见 `tests/services/geminiNativeImageProtocol.test.ts`。 */
    const gemini = resolveBuiltInImageRequestContract(undefined, 'gemini-3-pro-image-preview', '1K', '3:4', TUDOU, 'medium');
    expect(gemini?.kind).toBe('protocol');
    if (gemini?.kind !== 'protocol') throw new Error('unreachable');
    expect(gemini.protocol.submit.path).toBe('/v1beta/models/{{model}}:generateContent');
    expect(gemini.protocol.mode).toBe('sync');
    expect(gemini.protocol.response).toEqual({ type: 'json', result: { geminiImageParts: true } });
  });

  it('不支持的档位在提交前就报错', () => {
    expect(() => tudouContract('gpt-image-2.5-flare-async', '3K')).toThrow('不支持图片档位');
  });
});
