/**
 * streamParsers — SSE / NDJSON / UTF-8 分片解析器
 *
 * 将 ReadableStream<Uint8Array> 的 fetch body 转换为
 * AsyncGenerator<AssistantStreamEvent>，供 ChatPanel 逐 token 消费。
 *
 * 支持：
 * - 标准 SSE (data: ...\n\n)
 * - OpenAI 兼容的 SSE 事件类型
 * - UTF-8 多字节字符的跨 chunk 拼接
 */
import type { AssistantStreamEvent, FinishReason } from '../../types/chat';
import type { ChatApiProtocol } from '../../types';
import {
  parseChatApiResponse,
  readChatApiErrorMessage,
  resolveChatApiProtocol,
} from './chatApiProtocol';

// ============================================
// SSE line decoder
// ============================================

/**
 * 处理跨 chunk 的 UTF-8 多字节边界。
 * 返回 { lines, remainder }：remainder 会被拼接到下一批 bytes 前方。
 */
function decodeUtf8Lines(
  bytes: Uint8Array,
  prevRemainder: string,
  decoder: TextDecoder,
): { lines: string[]; remainder: string } {
  const text = prevRemainder + decoder.decode(bytes, { stream: true });

  // 按 \n 分割，最后一行可能不完整
  const raw = text.split('\n');
  if (text.endsWith('\n')) {
    // split 会在末尾多生成一个空字符串；移除它，但必须保留前一个空行，
    // 因为该空行是 SSE 的事件边界（data: ...\n\n）。
    raw.pop();
    return { lines: raw, remainder: '' };
  }

  // 移除最后一行作为 remainder
  const remainder = raw.pop() ?? '';
  return { lines: raw, remainder };
}

// ============================================
// SSE event parser
// ============================================

interface SseEvent {
  event?: string;
  data: string;
}

function parseSseEvent(lines: string[]): SseEvent | null {
  let eventName: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      // SSE 字段冒号后允许省略空格；只移除一个可选空格，保留正文缩进。
      const value = line.slice(5);
      dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
    }
  }

  if (dataLines.length === 0) return null;
  return { event: eventName, data: dataLines.join('\n') };
}

// ============================================
// OpenAI SSE chunk → AssistantStreamEvent
// ============================================

/**
 * 推理/思考分流（第 75 轮）。
 *
 * ⚠️ **官方产物取证结论（先看这条再看代码）**：官方客户端**不解析 provider 的推理字段**，
 * 它读的是自己服务端的 SSE **事件名** `thinking`（见 `types/chat.ts` 的 `thinking.delta`
 * 头注释里逐字的 `hG` / @717549 分派 / @42429 `appendMessageThinkingChunk`）。官方全产物
 * （9 个 JS）搜 `reasoning_content` / `reasoning_details` / `thinking_delta` /
 * `redacted_thinking` = **0 命中** ⇒ **这三个键名不是从官方产物抄来的**，而是 MTV 作为
 * 「客户端直连 provider」这一架构位置上，**贴死各协议语义命名**的字段：
 *
 * | 协议 | 读的字段 | 出处 |
 * | --- | --- | --- |
 * | OpenAI 兼容 | `choices[0].delta.reasoning_content`（流）/ `choices[0].message.reasoning_content`（非流） | DeepSeek / new-api 系聚合站（土豆 `api.ai-tudou.net` 就是 new-api 系）的**标准扩展字段** |
 * | OpenAI 兼容（兼容别名） | 同上位置的 `reasoning` | OpenRouter 等网关的别名；**不是**官方字段 |
 * | Anthropic 兼容 | `content_block_delta` 且 `delta.type === 'thinking_delta'` ⇒ `delta.thinking` | Anthropic Messages 流式协议原生 |
 * | Gemini 原生 | `candidates[0].content.parts[].text` 且该 part 的 `thought === true` | Gemini 原生 `part.thought` 标记 |
 *
 * 语义与官方 `event:thinking` **严格一致**：只进 thinking 通道，**不**当正文字符串、
 * **不**累加进 `parseStream` 的返回值、**不**触发 OpenAI 流的 `content` 事件。
 */
function readReasoningDelta(delta: Record<string, unknown> | undefined): string {
  if (!delta) return '';
  // `reasoning_content` 是 DeepSeek/new-api 的标准键；`reasoning` 是 OpenRouter 等网关的别名。
  // 前者优先（两者同时出现时以标准键为准，避免同一段推理被记两次）。
  const value = delta.reasoning_content ?? delta.reasoning;
  return typeof value === 'string' ? value : '';
}

interface OpenAiChunk {
  error?: unknown;
  id?: string;
  object?: string;
  model?: string;
  choices?: Array<{
    index?: number;
    delta?: {
      role?: string;
      content?: string;
      /** DeepSeek / new-api 系聚合站的推理正文（见 `readReasoningDelta`）。 */
      reasoning_content?: string;
      /** OpenRouter 等网关的推理别名。 */
      reasoning?: string;
      tool_calls?: OpenAiToolCallDelta[];
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface OpenAiToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface BufferedToolCall {
  callId: string;
  toolId: string;
  argumentsJson: string;
}

interface AnthropicToolCallBuffer extends BufferedToolCall {
  initialInput?: unknown;
  finalized?: boolean;
}

class ProviderStreamPayloadError extends Error {}

/**
 * 「模型什么都没给」的守卫。
 *
 * ⚠️ 第 75 轮的取证与裁决（**与用户最初的怀疑不一致，以产物为准**）：
 *
 * 1. 官方**没有**等价守卫。官方全产物（9 个 JS，含 4,570,188 字符的
 *    `vendor-pkg-canvas-CvbAwZyy.js`）搜 `模型未返回` / `未返回回复正文` / `有效工具调用` /
 *    `empty_response` / `EMPTY_RESPONSE` / `no_content` / `EMPTY_STREAM` / `empty stream` /
 *    `no_choices` / `NO_OUTPUT` = **全部 0 命中**。官方流消费器
 *    （`vendor-packages-DRvCmDjR.js` @724299 起）在 `done` 事件后只做
 *    `else if(p==="done"){const E=b?JSON.parse(b):{};t.onDone(E),w=!bG(E)}` —— **不检查**这一轮
 *    有没有正文/工具调用；正文事件为空时 `onContent` 只是 `Xe.trim()&&l.markRunActivity(...)`
 *    为空不标记，随后照常 `appendMessageTextChunk(yt(),"",ie)` 追加一个**空 text item**，
 *    流正常收尾。⇒ **官方在「没有正文也没有工具调用」时既不报错也不抛**，是静默正常结束。
 * 2. 但 MTV 这条守卫**不是本轮要删的东西**：它是 MTV「客户端直连 provider」架构下唯一能
 *    区分「网关把响应吞了」与「模型真的空回复」的地方，且用户投诉的触发点是**推理被当成
 *    「什么都没有」**，不是守卫本身该不该存在。⇒ 按「推理是真实输出」把它**收窄**，
 *    而不是删掉：官方把 thinking 当**独立 item** 记录（@42429），推理非空 ⇒ 这一轮**有输出**。
 *
 * 逐字保留原有文案（用户报文里要能对上）。
 */
function assertAssistantOutput(text: string, toolCallCount: number, reasoning: string): void {
  if (!text.trim() && toolCallCount === 0 && !reasoning.trim()) {
    throw new ProviderStreamPayloadError('模型未返回回复正文或有效工具调用，请重试或检查模型接口的协议配置。');
  }
}

function parseOpenAiChunk(json: OpenAiChunk, requestId: string, modelId: string): AssistantStreamEvent[] {
  const events: AssistantStreamEvent[] = [];

  // first chunk → start event
  if (json.object === 'chat.completion.chunk' && json.choices?.[0]?.delta?.role) {
    events.push({ type: 'start', requestId, modelId });
  }

  // text delta —— **只**读 `delta.content`，推理字段走 thinking 通道（见下），不进正文。
  const content = json.choices?.[0]?.delta?.content;
  if (content) {
    events.push({ type: 'text.delta', delta: content });
  }

  // reasoning delta（`reasoning_content` / `reasoning`）→ 官方 `event:thinking` 的等价通道。
  const reasoning = readReasoningDelta(json.choices?.[0]?.delta);
  if (reasoning) {
    events.push({ type: 'thinking.delta', delta: reasoning });
  }

  // finish reason
  const finishReason = json.choices?.[0]?.finish_reason;
  if (finishReason) {
    events.push({
      type: 'done',
      finishReason: mapFinishReason(finishReason),
    });
  }

  // usage
  if (json.usage) {
    events.push({
      type: 'usage',
      inputTokens: json.usage.prompt_tokens,
      outputTokens: json.usage.completion_tokens,
    });
  }

  return events;
}

function mapFinishReason(reason: string): FinishReason {
  switch (reason) {
    case 'stop': return 'stop';
    case 'length': return 'length';
    case 'tool_calls': return 'stop';
    default: return 'stop';
  }
}

// ============================================
// Public API
// ============================================

export interface StreamParserOptions {
  requestId: string;
  modelId: string;
  onEvent: (event: AssistantStreamEvent) => void;
  signal?: AbortSignal;
  /** 缺省保持 OpenAI SSE 兼容。 */
  protocol?: ChatApiProtocol;
}

/**
 * 将 fetch Response.body 管道化为 AssistantStreamEvent 回调。
 *
 * @returns 完整文本内容（所有 delta 拼接结果）
 */
export async function parseStream(
  response: Response,
  options: StreamParserOptions,
): Promise<string> {
  const { onEvent, signal } = options;
  const protocol = resolveChatApiProtocol(options.protocol);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let errorMsg = `请求失败 (${response.status})`;
    try {
      errorMsg = readChatApiErrorMessage(JSON.parse(errorBody)) || errorMsg;
    } catch { /* ignore */ }
    onEvent({ type: 'error', code: 'HTTP_ERROR', message: errorMsg, retryable: response.status >= 500 });
    onEvent({ type: 'done', finishReason: 'error' });
    throw new Error(errorMsg);
  }

  // 部分兼容接口即使收到 stream=true 仍返回 JSON，沿用同一协议的解析与事件回调。
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType === 'application/json' || contentType?.endsWith('+json')) {
    return parseNonStream(response, options);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onEvent({ type: 'error', code: 'NO_BODY', message: '响应体为空', retryable: false });
    onEvent({ type: 'done', finishReason: 'error' });
    throw new Error('响应体为空');
  }

  let fullContent = '';
  /** 推理/思考正文的累计（thinking 通道）。**不**并进 `fullContent`，只用于守卫判「有输出」。 */
  let accumulatedReasoning = '';
  let doneSent = false;
  let toolCallsFinalized = false;
  let finalizedToolCallCount = 0;
  const toolCallBuffer = new Map<number, BufferedToolCall>();
  const anthropicToolCallBuffer = new Map<number, AnthropicToolCallBuffer>();
  const geminiToolCalls = new Set<string>();
  let nativeInputTokens: number | undefined;
  let nativeOutputTokens: number | undefined;
  let nativeUsageSent = false;
  let nativeFinishReason: FinishReason = 'stop';

  // SSE buffer
  let sseLines: string[] = [];
  let remainder = '';
  const decoder = new TextDecoder('utf-8', { fatal: false });

  const consumeToolCallDeltas = (json: OpenAiChunk) => {
    for (const delta of json.choices?.[0]?.delta?.tool_calls ?? []) {
      const index = delta.index ?? 0;
      const current = toolCallBuffer.get(index) ?? {
        callId: delta.id || `tool-${options.requestId}-${index}`,
        toolId: delta.function?.name || '',
        argumentsJson: '',
      };
      if (delta.id) current.callId = delta.id;
      if (delta.function?.name) current.toolId = delta.function.name;
      if (delta.function?.arguments) {
        current.argumentsJson += delta.function.arguments;
        onEvent({
          type: 'tool.call.delta',
          callId: current.callId,
          delta: delta.function.arguments,
        });
      }
      toolCallBuffer.set(index, current);
    }
  };

  const finalizeToolCalls = () => {
    if (toolCallsFinalized) return;
    toolCallsFinalized = true;
    for (const call of toolCallBuffer.values()) {
      if (!call.toolId || !call.argumentsJson) continue;
      try {
        const input = JSON.parse(call.argumentsJson) as unknown;
        finalizedToolCallCount += 1;
        onEvent({
          type: 'tool.call.final',
          call: { callId: call.callId, toolId: call.toolId, input },
        });
      } catch {
        // 不完整或非法 JSON 不能进入工具执行层。
      }
    }
  };

  const emitText = (delta: string) => {
    if (!delta) return;
    fullContent += delta;
    onEvent({ type: 'text.delta', delta });
  };

  /**
   * 思考增量 → thinking 通道（官方 `event:thinking` 的等价物）。
   * 与 `emitText` 的**唯一**区别：不写 `fullContent` —— 推理不是正文。
   */
  const emitThinking = (delta: string) => {
    if (!delta) return;
    accumulatedReasoning += delta;
    onEvent({ type: 'thinking.delta', delta });
  };

  const emitNativeUsage = () => {
    if (nativeUsageSent || (nativeInputTokens === undefined && nativeOutputTokens === undefined)) return;
    nativeUsageSent = true;
    onEvent({ type: 'usage', inputTokens: nativeInputTokens, outputTokens: nativeOutputTokens });
  };

  const finalizeAnthropicToolCall = (index: number) => {
    const call = anthropicToolCallBuffer.get(index);
    if (!call || call.finalized || !call.toolId) return;
    let input: unknown = call.initialInput ?? {};
    if (call.argumentsJson) {
      try {
        input = JSON.parse(call.argumentsJson) as unknown;
      } catch {
        return;
      }
    }
    call.finalized = true;
    finalizedToolCallCount += 1;
    onEvent({
      type: 'tool.call.final',
      call: { callId: call.callId, toolId: call.toolId, input },
    });
  };

  const finalizeAnthropicToolCalls = () => {
    for (const index of anthropicToolCallBuffer.keys()) finalizeAnthropicToolCall(index);
  };

  const processAnthropicEvent = (payload: Record<string, unknown>) => {
    const type = typeof payload.type === 'string' ? payload.type : '';
    if (type === 'error') {
      throw new ProviderStreamPayloadError(
        readChatApiErrorMessage(payload) || 'Anthropic 流式请求失败',
      );
    }
    if (type === 'message_start') {
      const message = payload.message && typeof payload.message === 'object'
        ? payload.message as Record<string, unknown>
        : {};
      const usage = message.usage && typeof message.usage === 'object'
        ? message.usage as Record<string, unknown>
        : {};
      if (typeof usage.input_tokens === 'number') nativeInputTokens = usage.input_tokens;
      if (typeof usage.output_tokens === 'number') nativeOutputTokens = usage.output_tokens;
      return;
    }
    if (type === 'content_block_start') {
      const index = typeof payload.index === 'number' ? payload.index : 0;
      const block = payload.content_block && typeof payload.content_block === 'object'
        ? payload.content_block as Record<string, unknown>
        : {};
      if (block.type === 'text' && typeof block.text === 'string') emitText(block.text);
      /* Anthropic 原生 `thinking` 内容块（`content_block_start.content_block.type === "thinking"`）：
         `thinking` 字段是该块的首段正文（通常为空，真正的增量走 `thinking_delta`）。
         它**不**进正文（与官方 `appendMessageThinkingChunk` 的独立 item 同语义）。 */
      if (block.type === 'thinking' && typeof block.thinking === 'string') {
        emitThinking(block.thinking);
      }
      if (block.type === 'redacted_thinking') {
        /* 官方产物里 `redacted_thinking` = 0 命中；这里**不**读它的 `data` ——
           它是加密串，不是可显示文本，官方也没有任何把它当文本的分支。仅登记存在。 */
      }
      if (block.type === 'tool_use' && typeof block.name === 'string') {
        anthropicToolCallBuffer.set(index, {
          callId: typeof block.id === 'string' ? block.id : `tool-${options.requestId}-${index}`,
          toolId: block.name,
          argumentsJson: '',
          initialInput: block.input,
        });
      }
      return;
    }
    if (type === 'content_block_delta') {
      const index = typeof payload.index === 'number' ? payload.index : 0;
      const delta = payload.delta && typeof payload.delta === 'object'
        ? payload.delta as Record<string, unknown>
        : {};
      if (delta.type === 'text_delta' && typeof delta.text === 'string') emitText(delta.text);
      /* Anthropic 原生扩展思考：`delta.type === "thinking_delta"` ⇒ `delta.thinking` 是推理增量。
         `signature_delta` / `citations_delta` 不是可显示文本 ⇒ 忽略（官方产物里两者均 0 命中）。 */
      if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        emitThinking(delta.thinking);
      }
      if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
        const current = anthropicToolCallBuffer.get(index) ?? {
          callId: `tool-${options.requestId}-${index}`,
          toolId: '',
          argumentsJson: '',
        };
        current.argumentsJson += delta.partial_json;
        anthropicToolCallBuffer.set(index, current);
        onEvent({ type: 'tool.call.delta', callId: current.callId, delta: delta.partial_json });
      }
      return;
    }
    if (type === 'content_block_stop') {
      finalizeAnthropicToolCall(typeof payload.index === 'number' ? payload.index : 0);
      return;
    }
    if (type === 'message_delta') {
      const usage = payload.usage && typeof payload.usage === 'object'
        ? payload.usage as Record<string, unknown>
        : {};
      if (typeof usage.output_tokens === 'number') nativeOutputTokens = usage.output_tokens;
      const delta = payload.delta && typeof payload.delta === 'object'
        ? payload.delta as Record<string, unknown>
        : {};
      if (delta.stop_reason === 'max_tokens') nativeFinishReason = 'length';
      return;
    }
    if (type === 'message_stop') {
      finalizeAnthropicToolCalls();
      emitNativeUsage();
    }
  };

  const processGeminiEvent = (payload: Record<string, unknown>) => {
    if (payload.error) {
      throw new ProviderStreamPayloadError(
        readChatApiErrorMessage(payload) || 'Gemini 流式请求失败',
      );
    }
    const usage = payload.usageMetadata && typeof payload.usageMetadata === 'object'
      ? payload.usageMetadata as Record<string, unknown>
      : {};
    if (typeof usage.promptTokenCount === 'number') nativeInputTokens = usage.promptTokenCount;
    if (typeof usage.candidatesTokenCount === 'number') nativeOutputTokens = usage.candidatesTokenCount;
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    const first = candidates[0] && typeof candidates[0] === 'object'
      ? candidates[0] as Record<string, unknown>
      : {};
    const content = first.content && typeof first.content === 'object'
      ? first.content as Record<string, unknown>
      : {};
    const parts = Array.isArray(content.parts) ? content.parts : [];
    for (const [index, item] of parts.entries()) {
      if (!item || typeof item !== 'object') continue;
      const part = item as Record<string, unknown>;
      /* Gemini 原生：带 `thought: true` 的 part 是**推理**（官方产物里 `thought` / `thoughtSignature`
         均 0 命中 —— 这是协议原生字段，不是从官方抄的）。⇒ 进 thinking 通道，不进正文。 */
      if (part.thought === true) {
        if (typeof part.text === 'string') emitThinking(part.text);
        continue;
      }
      if (typeof part.text === 'string') emitText(part.text);
      const call = part.functionCall && typeof part.functionCall === 'object'
        ? part.functionCall as Record<string, unknown>
        : undefined;
      if (!call || typeof call.name !== 'string') continue;
      const callId = typeof call.id === 'string'
        ? call.id
        : `tool-${options.requestId}-${index}-${call.name}`;
      const signature = `${callId}:${JSON.stringify(call.args ?? {})}`;
      if (geminiToolCalls.has(signature)) continue;
      geminiToolCalls.add(signature);
      finalizedToolCallCount += 1;
      const argumentsJson = JSON.stringify(call.args ?? {});
      onEvent({ type: 'tool.call.delta', callId, delta: argumentsJson });
      onEvent({
        type: 'tool.call.final',
        call: { callId, toolId: call.name, input: call.args ?? {} },
      });
    }
    if (first.finishReason === 'MAX_TOKENS') nativeFinishReason = 'length';
    if (typeof first.finishReason === 'string') emitNativeUsage();
  };

  const sendDoneIfNeeded = () => {
    if (!doneSent) {
      if (protocol === 'openai-compatible') finalizeToolCalls();
      else {
        if (protocol === 'anthropic-compatible') finalizeAnthropicToolCalls();
        emitNativeUsage();
      }
      assertAssistantOutput(fullContent, finalizedToolCallCount, accumulatedReasoning);
      doneSent = true;
      onEvent({ type: 'done', finishReason: nativeFinishReason });
    }
  };

  try {
    while (true) {
      // Check abort signal
      if (signal?.aborted) {
        onEvent({ type: 'done', finishReason: 'canceled' });
        doneSent = true;
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        sendDoneIfNeeded();
        break;
      }

      if (!value) continue;

      const { lines, remainder: newRemainder } = decodeUtf8Lines(value, remainder, decoder);
      remainder = newRemainder;

      for (const line of lines) {
        // Trim \r
        const trimmed = line.trimEnd();
        if (trimmed === '') {
          // Empty line = SSE event boundary for standard SSE
          if (sseLines.length > 0) {
            const event = parseSseEvent(sseLines);
            sseLines = [];
            if (event) {
              if (event.data === '[DONE]') {
                sendDoneIfNeeded();
                break;
              }
              try {
                if (protocol === 'anthropic-compatible') {
                  const json = JSON.parse(event.data) as Record<string, unknown>;
                  processAnthropicEvent(json);
                  if (json.type === 'message_stop') sendDoneIfNeeded();
                } else if (protocol === 'gemini-native') {
                  const json = JSON.parse(event.data) as Record<string, unknown>;
                  processGeminiEvent(json);
                  const candidates = Array.isArray(json.candidates) ? json.candidates : [];
                  const first = candidates[0] && typeof candidates[0] === 'object'
                    ? candidates[0] as Record<string, unknown>
                    : {};
                  if (typeof first.finishReason === 'string') sendDoneIfNeeded();
                } else {
                  const json = JSON.parse(event.data) as OpenAiChunk;
                  if (json.error) {
                    throw new ProviderStreamPayloadError(
                      readChatApiErrorMessage(json) || '模型流式请求失败',
                    );
                  }
                  consumeToolCallDeltas(json);
                  const events = parseOpenAiChunk(json, options.requestId, options.modelId);
                  for (const ev of events) {
                    if (ev.type === 'done') {
                      finalizeToolCalls();
                      assertAssistantOutput(fullContent, finalizedToolCallCount, accumulatedReasoning);
                      doneSent = true;
                    }
                    if (ev.type === 'text.delta') fullContent += ev.delta;
                    /* 推理**只**进 thinking 通道：不进 `fullContent`、不进 `emitText`，
                       与官方 `onThinking` → `appendMessageThinkingChunk` 同语义（独立 item）。 */
                    if (ev.type === 'thinking.delta') accumulatedReasoning += ev.delta;
                    onEvent(ev);
                  }
                }
              } catch (error) {
                if (error instanceof ProviderStreamPayloadError) throw error;
                // JSON parse error on non-JSON SSE line → skip silently
              }
            }
          }
          continue;
        }

        sseLines.push(trimmed);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}

/**
 * 简单的非流式文本提取（fallback：当模型不支持 stream 时使用）。
 */
export async function parseNonStream(
  response: Response,
  options: Pick<StreamParserOptions, 'onEvent' | 'signal' | 'protocol'>,
): Promise<string> {
  const { onEvent } = options;

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let errorMsg = `请求失败 (${response.status})`;
    try {
      errorMsg = readChatApiErrorMessage(JSON.parse(errorBody)) || errorMsg;
    } catch { /* ignore */ }
    onEvent({ type: 'error', code: 'HTTP_ERROR', message: errorMsg, retryable: response.status >= 500 });
    onEvent({ type: 'done', finishReason: 'error' });
    throw new Error(errorMsg);
  }

  const payload: unknown = await response.json();
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new ProviderStreamPayloadError(readChatApiErrorMessage(payload) || '模型请求失败');
  }
  const parsed = parseChatApiResponse(payload, options.protocol);
  assertAssistantOutput(parsed.text, parsed.toolCalls.length, parsed.reasoning);
  /* 推理**先**于正文派发（与流式侧同一个到达顺序），且**不**进 `parsed.text`。
     消费端（`assistantService` / `agentRoundExecutor`）按官方 `onThinking` 语义落到 thinking 通道。 */
  if (parsed.reasoning) onEvent({ type: 'thinking.delta', delta: parsed.reasoning });
  // Agent 与对话消息通过事件累计正文，不能只返回字符串而不通知消息消费者。
  if (parsed.text) onEvent({ type: 'text.delta', delta: parsed.text });
  for (const call of parsed.toolCalls) onEvent({ type: 'tool.call.final', call });
  if (parsed.inputTokens !== undefined || parsed.outputTokens !== undefined) {
    onEvent({
      type: 'usage',
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
    });
  }
  onEvent({ type: 'done', finishReason: parsed.finishReason });
  return parsed.text;
}
