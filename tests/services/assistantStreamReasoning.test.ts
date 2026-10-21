/**
 * 第 75 轮：推理/思考分流（thinking 通道）的三协议覆盖。
 *
 * 官方产物取证（逐字与偏移）见 `src/types/chat.ts` 的 `AssistantStreamEvent.thinking.delta`
 * 头注释与 `src/services/ai/streamParsers.ts` 的 `readReasoningDelta` 头注释。**结论摘要**：
 * - 官方客户端**不解析 provider 的推理字段**，它读自己服务端的 SSE **事件名** `thinking`
 *   （`vendor-packages-DRvCmDjR.js` @715043 事件名集合 / @717549 分派：
 *   `else if(p==="thinking") t.onThinking(b);`），写入口是
 *   `appendMessageThinkingChunk: …{type:"thinking",content:p+o}`（`vendor-pkg-canvas-CvbAwZyy.js` @42429）
 *   —— 独立 item、**不并入正文**。
 * - 官方全产物（9 个 JS）搜 `reasoning_content` / `reasoning_details` / `thinking_delta` /
 *   `redacted_thinking` = **0 命中** ⇒ 本文件里这三个键名是「客户端直连 provider」位置上的
 *   协议语义字段，不是从官方产物里抄的（详见上面两处头注释的字段表）。
 * - 官方**没有**「空正文即报错」的守卫（同类文案全产物 0 命中）⇒ MTV 的守卫按「推理算输出」收窄。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { streamAssistantReply } from '../../src/services/ai/assistantStream';
import { parseChatApiResponse } from '../../src/services/ai/chatApiProtocol';
import { useAppStore } from '../../src/store/useAppStore';
import type { ChatApiProtocol } from '../../src/types';

const configureAssistant = (chatApiProtocol?: ChatApiProtocol) => {
  useAppStore.setState((state) => ({
    config: {
      ...state.config,
      assistantModelId: 'assistant-model',
      providers: {
        ...state.config.providers,
        'custom-assistant': {
          name: '土豆中转站（OpenAI 兼容）',
          apiKey: 'secret',
          baseUrl: 'https://api.ai-tudou.net/v1',
          catalogId: 'custom-openai',
          chatApiProtocol,
        },
      },
      generalModels: [{
        id: 'assistant-model',
        name: '土豆 DeepSeek',
        modelId: 'deepseek-v4',
        category: 'text',
        providerConfigId: 'custom-assistant',
      }],
    },
  }));
};

/** 只建 SSE 响应，供 `streamAssistantReply` 的 fetch mock 使用。 */
const sseResponse = (body: string) => new Response(body, {
  headers: { 'Content-Type': 'text/event-stream' },
});

/** SSE 事件数组 → 报文（事件之间空行分隔 + 结尾空行）。 */
const sseBody = (events: readonly string[]) => `${events.join('\n\n')}\n\n`;

beforeEach(() => {
  vi.unstubAllGlobals();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('第 75 轮：OpenAI 兼容的推理分流（new-api 系聚合站的常见形态）', () => {
  it('① 只有 reasoning_content 的流不再抛「未返回回复正文」', async () => {
    configureAssistant();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sseBody([
      'data: {"choices":[{"delta":{"reasoning_content":"让我想想"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"reasoning_content":"……就这个方案"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      'data: [DONE]',
    ]))));
    const onEvent = vi.fn();

    await expect(streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent }))
      .resolves.toBe('');

    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(onEvent).toHaveBeenCalledWith({ type: 'done', finishReason: 'stop' });
  });

  it('② 推理进 thinking 通道、正文为空（不产生任何 text.delta）', async () => {
    configureAssistant();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sseBody([
      'data: {"choices":[{"delta":{"reasoning_content":"让我想想"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"reasoning_content":"……就这个方案"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
    ]))));
    const onEvent = vi.fn();

    const full = await streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent });

    // 返回值 = 正文（`fullContent`）⇒ 推理**不**在里面。
    expect(full).toBe('');
    expect(onEvent.mock.calls.filter(([event]) => event.type === 'text.delta')).toHaveLength(0);
    // 两段推理按到达顺序原样派发（官方 `appendMessageThinkingChunk` 的续写语义）。
    const thinkingDeltas = onEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === 'thinking.delta')
      .map((event) => event.delta);
    expect(thinkingDeltas).toEqual(['让我想想', '……就这个方案']);
  });

  it('③ 正常正文流不受影响（有 content 时只有 text.delta）', async () => {
    configureAssistant();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sseBody([
      'data: {"choices":[{"delta":{"content":"完整"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"content":"回复"},"finish_reason":"stop"}]}',
    ]))));
    const onEvent = vi.fn();

    await expect(streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent }))
      .resolves.toBe('完整回复');
    expect(onEvent.mock.calls
      .filter(([event]) => event.type === 'text.delta')
      .map(([event]) => event.delta)).toEqual(['完整', '回复']);
    expect(onEvent.mock.calls.filter(([event]) => event.type === 'thinking.delta')).toHaveLength(0);
  });

  it('④ 正文与推理交错时两条通道各走各的', async () => {
    configureAssistant();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sseBody([
      'data: {"choices":[{"delta":{"reasoning_content":"想一下"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"content":"答案"},"finish_reason":"stop"}]}',
    ]))));
    const onEvent = vi.fn();

    await expect(streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent }))
      .resolves.toBe('答案');
    expect(onEvent).toHaveBeenCalledWith({ type: 'thinking.delta', delta: '想一下' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'text.delta', delta: '答案' });
  });

  it('⑤ `reasoning` 别名（OpenRouter 等网关）同样进 thinking 通道', async () => {
    configureAssistant();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sseBody([
      'data: {"choices":[{"delta":{"reasoning":"别名推理"},"finish_reason":"stop"}]}',
    ]))));
    const onEvent = vi.fn();

    await expect(streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent }))
      .resolves.toBe('');
    expect(onEvent).toHaveBeenCalledWith({ type: 'thinking.delta', delta: '别名推理' });
  });

  it('⑥ 非流式 `message.reasoning_content` 也走 thinking 通道且不再被守卫拒掉', async () => {
    configureAssistant();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '', reasoning_content: '非流式推理' }, finish_reason: 'stop' }],
    }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })));
    const onEvent = vi.fn();

    await expect(streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent, nonStream: true }))
      .resolves.toBe('');
    expect(onEvent).toHaveBeenCalledWith({ type: 'thinking.delta', delta: '非流式推理' });
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

describe('第 75 轮：Anthropic 兼容的推理分流', () => {
  it('`content_block_delta` / `thinking_delta` 进 thinking 通道，正文与返回值都不含推理', async () => {
    configureAssistant('anthropic-compatible');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sseBody([
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":11,"output_tokens":1}}}',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"先推理"}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"再推理"}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"abc"}}',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
      'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"正式回答"}}',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":1}',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":9}}',
      'event: message_stop\ndata: {"type":"message_stop"}',
    ]))));
    const onEvent = vi.fn();

    await expect(streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent }))
      .resolves.toBe('正式回答');

    const thinkingDeltas = onEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === 'thinking.delta')
      .map((event) => event.delta);
    expect(thinkingDeltas).toEqual(['先推理', '再推理']);
    // `signature_delta` 不是可显示文本 ⇒ 一个事件都不产生（官方产物里该键 0 命中）。
    expect(thinkingDeltas).not.toContain('abc');
  });

  it('只有 thinking 块（无 text 块）时正常结束、不抛守卫错误', async () => {
    configureAssistant('anthropic-compatible');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sseBody([
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"只有思考"}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"更多思考"}}',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
      'event: message_stop\ndata: {"type":"message_stop"}',
    ]))));
    const onEvent = vi.fn();

    await expect(streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent }))
      .resolves.toBe('');
    expect(onEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === 'thinking.delta')
      .map((event) => event.delta)).toEqual(['只有思考', '更多思考']);
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('非流式 `{type:"thinking"}` 内容块由 `parseChatApiResponse` 分流', () => {
    const parsed = parseChatApiResponse({
      content: [
        { type: 'thinking', thinking: '块内思考' },
        { type: 'redacted_thinking', data: 'ENCRYPTED' },
        { type: 'text', text: '块内正文' },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 3, output_tokens: 4 },
    }, 'anthropic-compatible');

    expect(parsed.text).toBe('块内正文');
    expect(parsed.reasoning).toBe('块内思考');
    // `redacted_thinking` 的 `data` 是加密串，**不**当文本（产物里该键 0 命中）。
    expect(parsed.reasoning).not.toContain('ENCRYPTED');
  });
});

describe('第 75 轮：Gemini 原生的推理分流', () => {
  it('`thought: true` 的 part 进 thinking 通道，正文只取非 thought part', async () => {
    configureAssistant('gemini-native');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sseBody([
      'data: {"candidates":[{"content":{"parts":[{"text":"内心推演","thought":true}]}}]}',
      'data: {"candidates":[{"content":{"parts":[{"text":"对外回答"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":6}}',
    ]))));
    const onEvent = vi.fn();

    await expect(streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent }))
      .resolves.toBe('对外回答');
    expect(onEvent).toHaveBeenCalledWith({ type: 'thinking.delta', delta: '内心推演' });
    expect(onEvent.mock.calls
      .filter(([event]) => event.type === 'text.delta')
      .map(([event]) => event.delta)).toEqual(['对外回答']);
  });

  it('只有 thought part 时正常结束、不抛守卫错误', async () => {
    configureAssistant('gemini-native');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sseBody([
      'data: {"candidates":[{"content":{"parts":[{"text":"只有思考","thought":true}]},"finishReason":"STOP"}]}',
    ]))));
    const onEvent = vi.fn();

    await expect(streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent }))
      .resolves.toBe('');
    expect(onEvent).toHaveBeenCalledWith({ type: 'thinking.delta', delta: '只有思考' });
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('非流式 `parts[].thought` 由 `parseChatApiResponse` 分流', () => {
    const parsed = parseChatApiResponse({
      candidates: [{
        content: { parts: [{ text: '思考', thought: true }, { text: '正文' }] },
        finishReason: 'STOP',
      }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 },
    }, 'gemini-native');

    expect(parsed.text).toBe('正文');
    expect(parsed.reasoning).toBe('思考');
  });

  it('非流式 OpenAI 兼容的 `message.reasoning_content` 由 `parseChatApiResponse` 分流', () => {
    const parsed = parseChatApiResponse({
      choices: [{ message: { content: '', reasoning_content: '思考' }, finish_reason: 'stop' }],
    }, 'openai-compatible');

    expect(parsed.text).toBe('');
    expect(parsed.reasoning).toBe('思考');
  });
});
