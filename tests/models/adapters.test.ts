/**
 * Provider Adapter 层契约 —— 平台规则必须落在「Adapter + 配置」里，不散在业务代码。
 *
 * 用户口径（2026）：
 *   ·「每个 Provider Adapter 只负责：鉴权；获取模型列表；请求与响应格式转换；
 *      解析平台原始模型 ID、别名、原厂字段、能力字段和其他元数据；使用完整 providerModelId 发起真实 API 调用」
 *   ·「新接入平台时只新增 Adapter 与映射配置，不修改 Agent UI」
 *   ·「不得将任何单一平台名称、模型规则或映射逻辑写死在 Agent UI 或业务组件中」
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  allRegisteredAdapters, getProviderAdapter, hasOwnImageContract, resolveAdapterImageContract,
} from '../../src/services/models/adapters';
import { parseOpenAiCompatibleModel, bearerAuth } from '../../src/services/models/adapters/openaiCompatible';
import { parseLocalManifestModel } from '../../src/services/models/adapters/localManifest';
import { resolveBuiltInImageRequestContract } from '../../src/services/ai/imageRequestContracts';
import { getProviderDefinition } from '../../src/services/ai/providerCatalogService';
import { normalizeModel } from '../../src/services/models/normalize';
import { buildSameOriginUrl } from '../../src/services/ai/modelProtocolRequest';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const TUDOU = 'https://api.ai-tudou.net/v1';

describe('Adapter 注册表', () => {
  it('每个平台都拿得到一个 Adapter，且职责字段齐全（鉴权/解析/后缀）', () => {
    for (const adapter of allRegisteredAdapters()) {
      expect(adapter.id, adapter.id).toBeTruthy();
      expect(adapter.label, adapter.id).toBeTruthy();
      expect(typeof adapter.buildAuth, adapter.id).toBe('function');
      expect(typeof adapter.parseModel, adapter.id).toBe('function');
      expect(adapter.suffixSpec, adapter.id).toBeTruthy();
    }
  });

  it('鉴权：给了 key 才有 Authorization，没给就空（不伪造）', () => {
    expect(bearerAuth('k')).toEqual({ Authorization: 'Bearer k' });
    expect(bearerAuth('')).toEqual({});
    expect(bearerAuth(undefined)).toEqual({});
    expect(getProviderAdapter('tudou').buildAuth({ apiKey: 'abc' })).toEqual({ Authorization: 'Bearer abc' });
  });

  it('解析平台原始条目：只解析事实，不做任何名称推断', () => {
    expect(parseOpenAiCompatibleModel({ id: '  gemini-3-pro-image-preview  ', name: '特价渠道A' })).toMatchObject({
      providerModelId: 'gemini-3-pro-image-preview',
      providerName: '特价渠道A',
    });
    /* 平台声明的原厂字段要认（解析优先级第 3 档） */
    expect(parseOpenAiCompatibleModel({ id: 'x', official_model: 'gpt-image-2.5-flare' })?.officialModelId)
      .toBe('gpt-image-2.5-flare');
    /* 没 id 的条目直接丢 */
    expect(parseOpenAiCompatibleModel({ name: 'no id' })).toBeNull();
    expect(parseLocalManifestModel({ modelId: 'veo3.1', label: 'VEO3.1' })).toMatchObject({
      providerModelId: 'veo3.1', providerName: 'VEO3.1',
    });
    expect(parseLocalManifestModel({})).toBeNull();
  });

  it('自有合同的平台是**登记出来**的（tudou / grsai / cccapi），不是按名字猜', () => {
    expect(hasOwnImageContract('tudou')).toBe(true);
    expect(hasOwnImageContract('grsai')).toBe(true);
    expect(hasOwnImageContract('cccapi')).toBe(true);
    for (const p of ['apimart', 'google', 'xai', 'volcengine', 'custom-openai']) {
      expect(hasOwnImageContract(p), p).toBe(false);
    }
  });

  it('平台专属合同只在**该平台**生效（同一个 id 换平台不会套用别家的协议）', () => {
    const asyncModel = 'gpt-image-2.5-flare-async';
    const ctxBase = {
      providerModelId: asyncModel,
      baseModelId: 'gpt-image-2.5-flare',
      executionMode: 'async' as const,
      imageSize: '2K',
      aspectRatio: '16:9',
    };
    const onTudou = resolveAdapterImageContract({ ...ctxBase, providerId: 'tudou' });
    if (onTudou?.kind !== 'protocol') throw new Error('土豆应有异步协议');
    expect(onTudou.protocol.mode).toBe('async');
    expect(onTudou.protocol.submit.path).toBe('/images/generations/async');

    /* 同一个 id 在 GRSAI 上走的是 GRSAI 自己的合同（同步 JSON 协议），不是土豆的异步端点 */
    const onGrsai = resolveAdapterImageContract({ ...ctxBase, providerId: 'grsai' });
    if (onGrsai?.kind !== 'protocol') throw new Error('GRSAI 应有自己的协议');
    expect(onGrsai.protocol.submit.path).toBe('/api/generate');
    expect(onGrsai.protocol.mode).toBe('sync');

    /* 没有自有合同的平台 ⇒ undefined（走通用链路） */
    expect(resolveAdapterImageContract({ ...ctxBase, providerId: 'apimart' })).toBeUndefined();
  });

  it('★ 土豆 Gemini 原生生图端点挂在**站点根**下：Base URL 带 `/v1` 时不能拼成 `/v1/v1beta/…`', () => {
    /* 事故（用户真机 `canvasError`）：
       `模型请求失败 (404): Invalid URL (POST /v1/v1beta/models/gemini-3-pro-image-preview:generateContent)`
       —— 连接 Base URL 是 `https://api.ai-tudou.net/v1`，而文档端点 `/v1beta/models/{model}:generateContent`
       在**站点根**下 ⇒ 默认 `pathMode:'append'` 会多出一段 `/v1`。 */
    const contract = resolveAdapterImageContract({
      providerId: 'tudou',
      providerModelId: 'gemini-3-pro-image-preview',
      baseModelId: 'gemini-3-pro-image-preview',
      executionMode: 'sync',
      imageSize: '1K',
      aspectRatio: '3:4',
    });
    if (contract?.kind !== 'protocol') throw new Error('土豆 Gemini 应有原生协议');
    expect(contract.protocol.submit.path).toBe('/v1beta/models/{{model}}:generateContent');
    expect(contract.protocol.submit.pathMode).toBe('origin');

    const url = buildSameOriginUrl(TUDOU, contract.protocol.submit, { model: 'gemini-3-pro-image-preview' });
    expect(url).toBe('https://api.ai-tudou.net/v1beta/models/gemini-3-pro-image-preview:generateContent');

    /* 对照：异步那条（`/images/generations/async`）**确实**在 `/v1` 下，必须保持 append */
    const asyncContract = resolveAdapterImageContract({
      providerId: 'tudou',
      providerModelId: 'gpt-image-2.5-flare-async',
      baseModelId: 'gpt-image-2.5-flare',
      executionMode: 'async',
      imageSize: '2K',
      aspectRatio: '16:9',
    });
    if (asyncContract?.kind !== 'protocol') throw new Error('土豆异步应有协议');
    expect(asyncContract.protocol.submit.pathMode).toBeUndefined();
    expect(buildSameOriginUrl(TUDOU, asyncContract.protocol.submit, {}))
      .toBe('https://api.ai-tudou.net/v1/images/generations/async');
  });

  it('`gpt-image-2-all` 的异步属性来自**映射配置**，不再是代码里的特例分支', () => {
    /* 这个 id 没有 `-async` 后缀，但平台把它注册成异步 */
    const model = normalizeModel({ providerId: 'tudou', providerModelId: 'gpt-image-2-all' });
    expect(model.executionMode).toBe('async');
    expect(model.providerSuffix).toBeUndefined();
    expect(model.displayName).toBe('gpt-image-2-all');
    /* 合同确实按异步构造 */
    const contract = resolveBuiltInImageRequestContract(undefined, 'gpt-image-2-all', '4K', '16:9', TUDOU);
    expect(contract?.kind).toBe('protocol');
    if (contract?.kind === 'protocol') {
      expect(contract.protocol.mode).toBe('async');
      expect(contract.protocol.submit.body?.model).toBe('gpt-image-2-all');
    }
  });

  it('出站 model 恒为 `providerModelId` 原文（含 `-async`），从不发 `baseModelId`', () => {
    for (const id of ['gpt-image-2.5-flare-async', 'gpt-image-2.5-sunburst-async']) {
      const contract = resolveBuiltInImageRequestContract(undefined, id, '2K', '16:9', TUDOU);
      if (contract?.kind !== 'protocol') throw new Error('期望异步协议');
      expect(contract.protocol.submit.body?.model).toBe(id);
      expect(contract.protocol.submit.body?.model).not.toBe(id.replace('-async', ''));
    }
  });

  it('同步组不套异步合同（原样走通用链路）', () => {
    expect(resolveBuiltInImageRequestContract(undefined, 'gpt-image-2.5-flare', '2K', '16:9', TUDOU))
      .toBeUndefined();
  });

  it('GRSAI 合同用 `baseModelId` 查厂商能力表，但出站仍走模板变量（与调用方同源）', () => {
    const contract = resolveBuiltInImageRequestContract(getProviderDefinition('grsai'), 'nano-banana-2', '2K', '16:9');
    if (contract?.kind !== 'protocol') throw new Error('期望 GRSAI 协议');
    expect(contract.protocol.submit.body?.model).toBe('{{model}}');
  });

  it('CCC 合同按**目录声明**判定，不按模型名（同一个 gpt-image 名字在别家不生效）', () => {
    expect(resolveBuiltInImageRequestContract(getProviderDefinition('cccapi'), 'gpt-image-2.5-sunburst', '2K', '16:9'))
      .toEqual({ kind: 'standard', imageReferenceRequestMode: 'edits-multipart' });
    expect(resolveBuiltInImageRequestContract(getProviderDefinition('custom-openai'), 'gpt-image-2.5-sunburst', '2K', '16:9'))
      .toBeUndefined();
  });
});

describe('平台规则不再写死在业务文件里', () => {
  it('`imageRequestContracts.ts` 只是派发：没有域名、没有厂商像素表、没有平台集合', () => {
    const src = code(read('src/services/ai/imageRequestContracts.ts'));
    for (const leak of ['ai-tudou', 'GRSAI_NANO', 'GRSAI_GPT', 'nano-banana', 'gpt-image-2.5-flare', '-async']) {
      expect(src, `不该再出现 ${leak}`).not.toContain(leak);
    }
    expect(src).toContain('resolveAdapterImageContract');
    expect(src).toContain('resolveProviderId');
  });

  it('平台名只出现在「平台定义配置」与「各自的 Adapter / 映射文件」里', () => {
    /* 业务侧（generateImage / providerCatalogService 之外）不该再硬编码 tudou */
    for (const f of ['src/services/ai/generateImage.ts', 'src/services/ai/imageQuality.ts']) {
      expect(code(read(f)), f).not.toMatch(/ai-tudou|tudou/i);
    }
    /* 平台定义表里必须有 */
    expect(read('src/data/modelProviders.json')).toContain('"providerId": "tudou"');
  });

  it('Adapter 目录里每个文件都只描述自己的平台', () => {
    for (const f of ['tudou.ts', 'grsai.ts', 'cccapi.ts']) {
      const src = code(read(`src/services/models/adapters/${f}`));
      expect(src).toContain("from './openaiCompatible'");
      /* 不 import 任何 UI / store */
      expect(src).not.toMatch(/from '\.\.\/\.\.\/\.\.\/components/);
      expect(src).not.toMatch(/from '\.\.\/\.\.\/\.\.\/store/);
    }
  });
});
