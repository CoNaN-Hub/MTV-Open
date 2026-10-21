/**
 * ai/generateText — 文本生成入口
 *
 * **推理/思考（thinking 通道）**：这条路径是**非流式**，且**官方在非对话路径上没有对应物**
 * （官方只有服务端 SSE 事件名 `thinking` → `onThinking` → `appendMessageThinkingChunk`，
 * 且只挂在对话路径；产物 9 个 JS 里 `reasoning_content` / `reasoning_details` /
 * `thinking_delta` / `redacted_thinking` 全 **0 命中**，见 `streamParsers.ts` 头注释与
 * `agent-挖掘覆盖表.md` §75）。所以这里**只**提供可选出口 `AIGenerateParams.onReasoning`
 * （见 `types/aiTypes.ts` 的字段注释），**不**改返回值、**不**并进正文：
 *   · 不传 `onReasoning` ⇒ 行为与改动前逐字一致（零破坏）；
 *   · 传了 ⇒ 命中推理字段时回调一次（`delta` = 完整推理正文）。
 * 推理字段的读取**仍然只有** `chatApiProtocol.parseChatApiResponse()` 一处
 * （OpenAI 兼容 `reasoning_content` / 别名 `reasoning`、Anthropic `thinking` 块、
 * Gemini `part.thought`），本文件不新增任何字段名。
 */
import { useAppStore } from '../../store/useAppStore';
import { DEFAULT_BASE_URLS } from '../../constants/api';
import type { AIGenerateParams, ProtocolJsonValue } from '../../types/aiTypes';
import {
  extractModelName,
  parseGeneralTextResponse,
  resolveGeneralModel,
  resolveGeneralModelConnection,
} from './helpers';
import { parseResponseError } from './httpUtils';
import { corsSafeFetch } from './httpTransport';
import { resolvePromptToChatContent } from './promptResolver';
import { resolveChatContentImageDataUrls } from './imageUtils';
import { executeModelProtocol, resolveModelExecutionProfile } from './modelProtocol';
import {
  buildChatApiRequest,
  parseChatApiResponse,
  resolveChatApiProtocol,
  type ChatApiMessage,
} from './chatApiProtocol';
import type { ChatApiProtocol } from '../../types';

// aiService 内部仍保留 runninghubwf 的默认 URL
(DEFAULT_BASE_URLS as Record<string, string>).runninghubwf = 'https://api.runninghub.cn';

export async function generateText(params: AIGenerateParams): Promise<string> {
  const { prompt: rawPrompt, model, provider } = params;

  const config = useAppStore.getState().config;

  let baseUrl: string;
  let apiKey: string;
  let modelName = '';
  let generalModel: ReturnType<typeof resolveGeneralModel> = undefined;
  let chatApiProtocol: ChatApiProtocol;

  // ── 通用模型 ──
  if (provider === 'general') {
    const gm = resolveGeneralModel(model);
    if (!gm) throw new Error('未找到该通用模型配置\n请在「设置 → API Key」中检查');
    const connection = resolveGeneralModelConnection(model);
    if (!connection) throw new Error(`通用模型 "${gm.name}" 的连接配置不存在`);
    if (!connection.baseUrl) throw new Error(`通用模型 "${gm.name}" 未配置接口地址`);
    apiKey = connection.apiKey;
    baseUrl = connection.baseUrl;
    modelName = gm.modelId;
    generalModel = gm;
    chatApiProtocol = resolveChatApiProtocol(connection.provider.chatApiProtocol);
  } else if (provider === 'localllm') {
    // 已合并到通用模型，此处保留兼容旧数据
    throw new Error('本地大模型已迁移到「通用模型」，请重新选择模型\n请在「设置 → API Key」中添加通用模型');
  } else {
    const providerConfig = config.providers[provider];
    apiKey = providerConfig?.apiKey || '';
    if (!apiKey) {
      throw new Error(`未配置 ${provider} 的 API Key\n请在「设置 → API Key」中配置`);
    }
    baseUrl = providerConfig?.baseUrl || DEFAULT_BASE_URLS[provider] || '';
    chatApiProtocol = resolveChatApiProtocol(providerConfig?.chatApiProtocol);
  }

  if (!baseUrl) {
    throw new Error(`未配置 ${provider === 'general' ? resolveGeneralModel(model)?.name || '通用模型' : provider} 的服务地址\n请在「设置 → API Key」中添加`);
  }

  if (provider !== 'general') {
    modelName = extractModelName(model, provider);
  }

  // 解析 @{nodeId:label} 引用：图片节点构建 image_url，其他节点内联文本
  const { content, textContent } = await resolvePromptToChatContent(rawPrompt);
  if (!textContent.trim()) {
    throw new Error('提示词不能为空');
  }

  // 调用方直接给的图片（截帧、节点自身产物等）接在 @ 引用之后
  const contentWithImages = params.imageUrls?.length
    ? [
        ...(typeof content === 'string' ? [{ type: 'text', text: content }] : content),
        ...params.imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
      ]
    : content;

  // 文本/VLM 请求使用 OpenAI 兼容的 Base64 data URL，不经第三方图床泄露视觉素材。
  const resolvedContent = await resolveChatContentImageDataUrls(contentWithImages);

  const messages: ChatApiMessage[] = [];
  messages.push({ role: 'user', content: resolvedContent });

  if (generalModel?.executionProfile) {
    const protocol = resolveModelExecutionProfile(generalModel.executionProfile);
    if (!protocol) throw new Error(`通用模型 "${generalModel.name}" 未配置调用协议`);
    const result = await executeModelProtocol({
      apiKey,
      baseUrl,
      protocol,
      variables: {
        model: modelName,
        prompt: textContent,
        messages: messages as unknown as ProtocolJsonValue,
        stream: false,
      },
    });
    /* ⚠️ 这条支路**没有** thinking 落点，也**不接** `onReasoning`：
       `executeModelProtocol` 只按 executionProfile 的 response.result 读
       `textPath` / `urlPath` / `base64Path` 三个标量（`src/types/aiTypes.ts` 的
       `ModelProtocolResultConfig` **没有**任何推理路径字段；`modelProtocolPresets.ts` 的
       OpenAI chat 预设也只声明 `result:{textPath:'choices.0.message.content'}`），
       既不派发任何事件，也没有 `reasoning_content`/`reasoning`/`thinking`/`part.thought` 概念。
       ⇒ 该支路**无推理字段概念 ⇒ 不改**（维持原判据、原逐字文案；不硬塞任何字段名）。
       结论同 `agent-挖掘覆盖表.md` §80.7 第 1 条与 §81。 */
    if (!result.text) throw new Error('模型返回结果为空');
    return result.text;
  }

  // 未配置模型级协议时按连接协议执行；旧连接缺省仍是 OpenAI Chat Completions。
  const request = buildChatApiRequest({
    protocol: chatApiProtocol,
    apiKey,
    baseUrl,
    model: modelName,
    messages,
    stream: false,
  });
  // 不设超时（仅 ComfyUI 才设超时）
  const response = await corsSafeFetch(request.url, request.init);

  if (!response.ok) {
    await parseResponseError(response, `API 请求失败 (${response.status})`);
  }

  const json = await response.json();
  const parsed = parseChatApiResponse(json, chatApiProtocol);
  /* 推理/思考正文（第 80 轮，与 `streamParsers.ts` 同口径）。
     `parseChatApiResponse` 已按三协议读齐推理字段，且**不**把它并进 `parsed.text`：
       · OpenAI 兼容 `choices[0].message.reasoning_content`（别名 `message.reasoning`）
       · Anthropic 兼容 `content[]` 里 `{type:"thinking", thinking:"…"}` 内容块
         （`redacted_thinking` 是加密串，不读它的 `data`）
       · Gemini 原生 `candidates[0].content.parts[].text` 且该 part `thought === true`
     与官方 `event:thinking`（`thinking.delta` 事件 → `ChatMessage.thinkingItems`）**严格同语义**：
     推理是真实输出，不算「什么都没给」。 */
  const reasoning = parsed.reasoning;
  /* 推理的**唯一**出口（可选）：`AIGenerateParams.onReasoning`。
     ⚠️ 这是 **MTV 自有通道、官方无对应物**（官方非对话路径没有推理出口；见文件头注释）。
     本路径非流式 ⇒ 至多调用一次，`delta` = 该响应的完整推理正文；**不传则一个字节都不发**。
     位置在守卫**之前**：只要模型确实回了推理就送达，即使正文为空（那正是最需要可见反馈的情形）。 */
  if (reasoning) params.onReasoning?.(reasoning);
  // OpenAI 兼容通用模型保留既有宽松响应提取，原生协议只接受各自规范结构。
  // 宽松提取对不上的形状会抛它自己的文案（`无法解析模型返回的文本内容`）—— 只有当
  // 这一轮**确实三空**（无正文、推理也空）时才允许那个抛点跑出来，否则它会把
  // 「模型只回了推理」误判成错误（守卫在下面用原逐字文案统一收口）。
  let replyText = parsed.text;
  if (!replyText && provider === 'general' && chatApiProtocol === 'openai-compatible') {
    try {
      replyText = parseGeneralTextResponse(json);
    } catch (looseError) {
      /* ⚠️ 第 81 轮把上一轮的**静默** `catch {}` 改成这条**只吞「推理非空」**的收窄：
         宽松提取（`parseGeneralTextResponse`，helpers.ts L161 逐字文案
         `无法解析模型返回的文本内容`）是「正文抽不出来」的**唯一**报告者，它的文案是
         **逐字不变的**、也是用户实际会看到的那一条 ⇒ 不能被无声吞掉。
         判据与下面守卫同一套：这一轮**确实三空**（无正文 + 推理也空）⇒ 把宽松提取的
         **原文案**原样抛出（而不是把它换成「模型返回结果为空」）；
         推理非空 ⇒ 才算「有输出」，继续落到下面的守卫/返回。 */
      if (!reasoning) throw looseError;
      replyText = '';
    }
  }
  /* 逐字沿用原来的文案与判据，只把「推理非空」补成有输出（与 `streamParsers.ts` 的
     `assertAssistantOutput(text, toolCallCount, reasoning)` 同一套口径）。
     推理**不**并进正文（返回值仍只有正文，沿用「推理不是正文」）；第 81 轮起它另有
     **可选**出口 `params.onReasoning`（见上；不传则整条路径与改动前逐字一致）。
     真三空（正文空 + 推理空）时仍抛原逐字文案。 */
  if (!replyText && !reasoning) {
    throw new Error('模型返回结果为空');
  }
  return replyText;
}
