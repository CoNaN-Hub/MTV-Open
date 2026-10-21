import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateText } from '../../src/services/ai/generateText';
import { useAppStore } from '../../src/store/useAppStore';
import type { ModelExecutionProfile } from '../../src/types/aiTypes';
import type { ChatApiProtocol } from '../../src/types';

const jsonResponse = (payload: unknown) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => {
  vi.unstubAllGlobals();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

/** 直连第三方连接（provider id = `apimart`），走 OpenAI 兼容连接协议。 */
function setOaiProvider(): void {
  useAppStore.setState((state) => ({
    config: {
      ...state.config,
      providers: {
        ...state.config.providers,
        apimart: { name: 'APIMart', apiKey: 'secret', baseUrl: 'https://gateway.example/v1' },
      },
    },
  }));
}

/** 通用模型 `general/native-text` + 指定连接协议（默认 openai-compatible）。 */
function setGeneralNativeProvider(chatApiProtocol: ChatApiProtocol = 'openai-compatible'): void {
  useAppStore.setState((state) => ({
    config: {
      ...state.config,
      providers: {
        ...state.config.providers,
        'native-text-provider': {
          name: '原生文本连接',
          apiKey: 'secret',
          baseUrl: 'https://gateway.example/v1',
          catalogId: 'custom-openai',
          chatApiProtocol,
        },
      },
      generalModels: [{
        id: 'native-text',
        name: '原生文本',
        modelId: 'vendor-chat',
        category: 'text',
        providerConfigId: 'native-text-provider',
      }],
    },
  }));
}

describe('custom text model protocol', () => {
  it('uses the configured endpoint, request body and text result path', async () => {
    const executionProfile = {
      preset: 'custom',
      protocol: {
        version: 1,
        mode: 'sync',
        auth: { type: 'header', name: 'X-API-Key' },
        submit: {
          method: 'POST',
          path: '/v1/chat/',
          body: {
            model_name: '{{model}}',
            input: '{{prompt}}',
            messages: '{{messages}}',
          },
        },
        resultTextPath: 'result.answer',
      },
    } as unknown as ModelExecutionProfile;
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        providers: {
          ...state.config.providers,
          'custom-text-provider': {
            name: '自定义文本连接',
            apiKey: 'secret',
            baseUrl: 'https://gateway.example',
            catalogId: 'custom-openai',
          },
        },
        generalModels: [{
          id: 'custom-text',
          name: '自定义文本',
          modelId: 'vendor-chat',
          category: 'text',
          providerConfigId: 'custom-text-provider',
          executionProfile,
        }],
      },
    }));
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ result: { answer: '自定义结果' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateText({
      provider: 'general',
      model: 'general/custom-text',
      prompt: '你好',
    });

    expect(result).toBe('自定义结果');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://gateway.example/v1/chat/');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'X-API-Key': 'secret' });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      model_name: 'vendor-chat',
      input: '你好',
    });
  });

  it.each([
    {
      protocol: 'anthropic-compatible' as const,
      expectedUrl: 'https://gateway.example/v1/messages',
      response: { content: [{ type: 'text', text: 'Anthropic 结果' }] },
      expectedText: 'Anthropic 结果',
      expectedHeader: ['x-api-key', 'secret'],
      expectedBody: { model: 'vendor-chat', max_tokens: 4096, messages: [{ role: 'user' }] },
    },
    {
      protocol: 'gemini-native' as const,
      expectedUrl: 'https://gateway.example/v1/models/vendor-chat:generateContent',
      response: { candidates: [{ content: { parts: [{ text: 'Gemini 结果' }] } }] },
      expectedText: 'Gemini 结果',
      expectedHeader: ['x-goog-api-key', 'secret'],
      expectedBody: { contents: [{ role: 'user', parts: [{ text: '你好' }] }] },
    },
  ])('uses $protocol for non-stream text generation', async ({
    protocol,
    expectedUrl,
    response,
    expectedText,
    expectedHeader,
    expectedBody,
  }) => {
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        providers: {
          ...state.config.providers,
          'native-text-provider': {
            name: '原生文本连接',
            apiKey: 'secret',
            baseUrl: 'https://gateway.example/v1',
            catalogId: 'custom-openai',
            chatApiProtocol: protocol,
          },
        },
        generalModels: [{
          id: 'native-text',
          name: '原生文本',
          modelId: 'vendor-chat',
          category: 'text',
          providerConfigId: 'native-text-provider',
        }],
      },
    }));
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(response));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateText({
      provider: 'general',
      model: 'general/native-text',
      prompt: '你好',
    })).resolves.toBe(expectedText);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(expectedUrl);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ [expectedHeader[0]]: expectedHeader[1] });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject(expectedBody);
  });
});

/**
 * 第 80 轮：`generateText` 这条非流式文本路径与 `streamParsers.ts` 同口径 ——
 * **推理非空也算有输出**（不抛「模型返回结果为空」）；真三空仍抛原逐字文案。
 */
describe('generateText reasoning-only responses', () => {
  it('OpenAI 兼容：只有 reasoning_content、无正文 ⇒ 不抛、不写正文', async () => {
    setOaiProvider();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: '', reasoning_content: '先想一下' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
    })).resolves.toBe('');
  });

  it('OpenAI 兼容：只有 reasoning 别名、无正文 ⇒ 不抛、不写正文', async () => {
    setOaiProvider();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { reasoning: '先想一下' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
    })).resolves.toBe('');
  });

  it.each([
    {
      protocol: 'anthropic-compatible' as const,
      response: { content: [{ type: 'thinking', thinking: '先想一下' }] },
    },
    {
      protocol: 'gemini-native' as const,
      response: { candidates: [{ content: { parts: [{ text: '先想一下', thought: true }] } }] },
    },
  ])('$protocol：只有推理、无正文 ⇒ 不抛、不写正文', async ({ protocol, response }) => {
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        providers: {
          ...state.config.providers,
          'native-text-provider': {
            name: '原生文本连接',
            apiKey: 'secret',
            baseUrl: 'https://gateway.example/v1',
            catalogId: 'custom-openai',
            chatApiProtocol: protocol,
          },
        },
        generalModels: [{
          id: 'native-text',
          name: '原生文本',
          modelId: 'vendor-chat',
          category: 'text',
          providerConfigId: 'native-text-provider',
        }],
      },
    }));
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(response));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateText({
      provider: 'general',
      model: 'general/native-text',
      prompt: '你好',
    })).resolves.toBe('');
  });

  it('通用模型宽松提取（parseGeneralTextResponse）对不上的形状，也先看推理再决定是否抛', async () => {
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        providers: {
          ...state.config.providers,
          'native-text-provider': {
            name: '原生文本连接',
            apiKey: 'secret',
            baseUrl: 'https://gateway.example/v1',
            catalogId: 'custom-openai',
            chatApiProtocol: 'openai-compatible',
          },
        },
        generalModels: [{
          id: 'native-text',
          name: '原生文本',
          modelId: 'vendor-chat',
          category: 'text',
          providerConfigId: 'native-text-provider',
        }],
      },
    }));
    // 宽松提取只认 choices[0].message.content / data.* / 顶层 content|text，
    // 这个 draft 形状命中不了它（旧代码会抛「无法解析模型返回的文本内容」）。
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { reasoning_content: '先想一下' } }],
      result: { answer: 'draft' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateText({
      provider: 'general',
      model: 'general/native-text',
      prompt: '你好',
    })).resolves.toBe('');
  });

  it('正常正文不受影响（推理同轮出现也不并入正文）', async () => {
    setOaiProvider();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: '正文结果', reasoning_content: '先想一下' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
    })).resolves.toBe('正文结果');
  });

  it('真三空（正文空 + 推理空）⇒ 仍抛原来的逐字文案', async () => {
    setOaiProvider();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
    })).rejects.toThrow('模型返回结果为空');
  });

  it('通用模型 + openai-compatible：宽松提取的逐字文案不被静默吞掉', async () => {
    setGeneralNativeProvider('openai-compatible');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    // 第 81 轮：`parseGeneralTextResponse`（helpers.ts L161）是「正文抽不出来」的**唯一**
    // 报告者，真三空时它自己的逐字文案原样浮出，不再被上一轮的 `catch {}` 静默替换。
    await expect(generateText({
      provider: 'general',
      model: 'general/native-text',
      prompt: '你好',
    })).rejects.toThrow('无法解析模型返回的文本内容');
  });
});

/**
 * 第 81 轮：`generateText` 的**推理出口** `AIGenerateParams.onReasoning`。
 *
 * ⚠️ **这是 MTV 自有通道、官方无对应物**（官方只有对话路径的 SSE `event:thinking`；
 * 产物 9 个 JS 里 `reasoning_content`/`reasoning_details`/`thinking_delta`/`redacted_thinking`
 * 全 0 命中，见 `agent-挖掘覆盖表.md` §75/§81）。
 * 铁律：推理**绝不**并入返回的正文；不传 `onReasoning` ⇒ 行为与改动前逐字一致。
 */
describe('generateText 推理出口 onReasoning', () => {
  it('① 只回推理 ⇒ 返回空串，且 onReasoning 收到逐字推理', async () => {
    setOaiProvider();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: '', reasoning_content: '先想一下' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];

    const text = await generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
      onReasoning: (delta) => deltas.push(delta),
    });

    expect(text).toBe('');
    expect(deltas).toEqual(['先想一下']);
  });

  it('① 三协议都送达（Anthropic thinking 块 / Gemini thought part / OpenAI 别名 reasoning）', async () => {
    const cases = [
      {
        protocol: 'anthropic-compatible' as const,
        response: { content: [{ type: 'thinking', thinking: '想一想 A' }] },
        expected: '想一想 A',
      },
      {
        protocol: 'gemini-native' as const,
        response: { candidates: [{ content: { parts: [{ text: '想一想 B', thought: true }] } }] },
        expected: '想一想 B',
      },
    ];
    for (const testCase of cases) {
      useAppStore.setState(useAppStore.getInitialState(), true);
      setGeneralNativeProvider(testCase.protocol);
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(testCase.response));
      vi.stubGlobal('fetch', fetchMock);
      const deltas: string[] = [];

      const text = await generateText({
        provider: 'general',
        model: 'general/native-text',
        prompt: '你好',
        onReasoning: (delta) => deltas.push(delta),
      });

      expect(text).toBe('');
      expect(deltas).toEqual([testCase.expected]);
    }

    // OpenAI 兼容别名 `message.reasoning`（OpenRouter 等网关）
    useAppStore.setState(useAppStore.getInitialState(), true);
    setGeneralNativeProvider('openai-compatible');
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: '', reasoning: '想一想 C' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];
    await expect(generateText({
      provider: 'general',
      model: 'general/native-text',
      prompt: '你好',
      onReasoning: (delta) => deltas.push(delta),
    })).resolves.toBe('');
    expect(deltas).toEqual(['想一想 C']);
  });

  it('② 推理不并入正文（返回值只有正文）', async () => {
    setOaiProvider();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: '正文结果', reasoning_content: '先想一下' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];

    const text = await generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
      onReasoning: (delta) => deltas.push(delta),
    });

    expect(text).toBe('正文结果');
    expect(text).not.toContain('先想一下');
    expect(deltas).toEqual(['先想一下']);
  });

  it('③ 有正文、没有推理 ⇒ onReasoning 不误触', async () => {
    setOaiProvider();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: '正文结果' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const onReasoning = vi.fn();

    await expect(generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
      onReasoning,
    })).resolves.toBe('正文结果');

    expect(onReasoning).not.toHaveBeenCalled();
  });

  it('③ 推理为空串 / 只有空白 ⇒ 不误触；真三空仍抛原逐字文案', async () => {
    setOaiProvider();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: '正文结果', reasoning_content: '' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const onReasoning = vi.fn();
    await expect(generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
      onReasoning,
    })).resolves.toBe('正文结果');
    expect(onReasoning).not.toHaveBeenCalled();

    useAppStore.setState(useAppStore.getInitialState(), true);
    setOaiProvider();
    const emptyFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', emptyFetch);
    const onReasoningEmpty = vi.fn();
    await expect(generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
      onReasoning: onReasoningEmpty,
    })).rejects.toThrow('模型返回结果为空');
    expect(onReasoningEmpty).not.toHaveBeenCalled();
  });

  it('⑤ 同一输入下传 / 不传 onReasoning，返回值逐字一致（可选出口、零破坏）', async () => {
    const payload = { choices: [{ message: { content: '正文结果', reasoning_content: '先想一下' } }] };

    setOaiProvider();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(payload)));
    const withoutCallback = await generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
    });

    useAppStore.setState(useAppStore.getInitialState(), true);
    setOaiProvider();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(payload)));
    const withCallback = await generateText({
      provider: 'apimart',
      model: 'apimart/vendor-chat',
      prompt: '你好',
      onReasoning: () => {},
    });

    expect(withCallback).toBe(withoutCallback);
    expect(withoutCallback).toBe('正文结果');
  });

  it('⑤ 自定义 executionProfile 支路无推理字段概念 ⇒ 不调 onReasoning（不改该支路）', async () => {
    const executionProfile = {
      preset: 'custom',
      protocol: {
        version: 1,
        mode: 'sync',
        auth: { type: 'header', name: 'X-API-Key' },
        submit: {
          method: 'POST',
          path: '/v1/chat/',
          body: { model_name: '{{model}}', input: '{{prompt}}', messages: '{{messages}}' },
        },
        resultTextPath: 'result.answer',
      },
    } as unknown as ModelExecutionProfile;
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        providers: {
          ...state.config.providers,
          'custom-text-provider': {
            name: '自定义文本连接',
            apiKey: 'secret',
            baseUrl: 'https://gateway.example',
            catalogId: 'custom-openai',
          },
        },
        generalModels: [{
          id: 'custom-text',
          name: '自定义文本',
          modelId: 'vendor-chat',
          category: 'text',
          providerConfigId: 'custom-text-provider',
          executionProfile,
        }],
      },
    }));
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      result: { answer: '自定义结果', reasoning_content: '想一下' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const onReasoning = vi.fn();

    await expect(generateText({
      provider: 'general',
      model: 'general/custom-text',
      prompt: '你好',
      onReasoning,
    })).resolves.toBe('自定义结果');

    // `response.result` 只声明 `textPath`（无任何推理路径）⇒ 官方/MTV 都没有这条字段概念，
    // 不硬塞字段名 ⇒ 该支路永不触发 onReasoning。
    expect(onReasoning).not.toHaveBeenCalled();
  });
});
