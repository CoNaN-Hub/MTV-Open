/**
 * Adapter: 土豆中转站（`api.ai-tudou.net`）——**自有接口形状**，不是通用标准。
 *
 * 平台规则集中在这里（原来写死在 `services/ai/imageRequestContracts.ts`）：
 *   · 只认连接域名（`modelProviders.json` 的 `matchHosts`）⇒ 不按模型名推广；
 *   · `-async` 后缀 → `executionMode: 'async'`，**出站 id 原样**（不改写、不补后缀）；
 *   · 异步端点是 `/v1/images/generations/async` + 轮询；同步端点没有参考图原语。
 *
 * 实测依据（2026-10，对照 `docs.ai-tudou.net/gpt-image-2(new)-docs.html`）：
 *   · ★ 土豆把「同步 / 异步」注册成**两组独立模型**（用户实测）：
 *       同步 `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst`
 *       异步 `gpt-image-2.5-flare-async` / `gpt-image-2.5-sunburst-async`
 *     ⇒ 本 Adapter 只为**异步那一组**构造协议，同步那一组原样走通用同步链路。
 *   · 同步 `/v1/images/generations` 与 `/v1/images/edits` 文档写着「需要…请联系管理员适配」
 *     ⇒ 同步端点**没有参考图原语**（发 `image` 或 `image_urls` 都被静默丢弃，实测出图与参考图无关）。
 *   · 异步端点认 **`images`** 字段（URL 或 `data:image/png;base64,…`）—— 实测参考图生效。
 *   · 提交返回 `data.id`（`task_` 前缀），轮询 `GET /v1/tasks/{id}`，
 *     取图 `data.result.images[0].url[0]`，失败读 `data.error.message`。
 *   · `resolution` 只认小写 `1k`/`2k`/`4k`，`quality` 只认 `low`/`medium`/`high`
 *     ⇒ 这两个值在**协议构建期**算成字面量（模板没有大小写转换能力）。
 */
import { mapImageDimensions } from '../../aiDimensions';
import { imageDimensionPreset } from '../../ai/mediaModelCapabilities';
import type { BuiltInImageRequestContract, ImageContractContext } from './contract';
import { createOpenAiCompatibleAdapter } from './openaiCompatible';
import type { ProviderAdapter } from '../types';

const RESOLUTIONS = new Set(['1k', '2k', '4k']);
const QUALITIES = new Set(['low', 'medium', 'high']);

/**
 * **round 122 追加（用户批准）**：土豆**异步**端点把 `resolution` 当必填档位
 * （`body.resolution = tier`），而公共函数 `generateImagesBatch` 不再替调用方编 `2K`
 * ⇒ 「用户没给、项目没设、模型目录也没有」时，这里**必须**有一个值才能发请求。
 *
 * 依据说明（如实登记）：土豆文档（`docs.ai-tudou.net`，见文件头）**没有**给出缺省档位；
 * 这两个字面量是 **MTV 的兜底**，值 = 搬迁前公共函数解构默认值（`2K` / `1:1`），
 * 目的是**保持既有行为不变**（搬到这里只是让「谁在造值」一目了然），不是「上游文档声明」。
 * 平台文档补齐缺省后应替换成文档值。
 */
const TUDOU_ASYNC_FALLBACK_TIER = '2K';
const TUDOU_ASYNC_FALLBACK_RATIO = '1:1';

/**
 * **文档列的** Gemini 原生渠道图像模型（`nano-banana-api-docs.html` 的「可用模型」表：
 * `gemini-3-pro-image-preview` / `gemini-3.1-flash-image-preview`）。
 *
 * 与 `grsai.ts` 的 `NANO_MODELS`/`GPT_MODELS` 同一纪律：**模型清单来自厂商文档，不靠
 * `includes('nano-banana')` 之类的名字匹配**（用户硬要求：不许按厂商名/模型 id 猜分支）。
 * 文档新增模型时改这里一行即可（引擎侧的能力是形状级的，不需要再动）。
 */
const TUDOU_GEMINI_NATIVE_IMAGE_MODELS = new Set([
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
]);

/** 文档「支持的 aspectRatio 值」逐字（不支持的比例**报错**，不替换、不猜）。 */
const TUDOU_GEMINI_RATIOS = new Set([
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9',
]);

/**
 * `/v1beta/models/{model}:generateContent`（Gemini 原生）合同。
 * 请求体逐字按文档「文生图 / 图生图（多图参考）」两节构造：
 *   · 参考图放前面（`parts[].inlineData`，走 `$forEach` + `$inlineData` 由引擎把
 *     data URL 展开成 `{mimeType, data}`），文本 prompt 放最后；
 *   · `generationConfig.responseModalities` 固定 `["TEXT","IMAGE"]`（文档）；
 *   · `imageConfig.imageSize` 必须大写 `1K/2K/4K`（文档）；`aspectRatio` 文档标**非必填**
 *     ⇒ 只有拿到受支持的值才写，`''`/`auto`/未指定**一律省略**（不替用户断言一个比例）。
 * 响应：`geminiImageParts: true`（形状级能力，逐字实现文档的提取逻辑，见
 * `services/ai/modelProtocolResponse.ts`）。
 */
function tudouGeminiImageContract(ctx: ImageContractContext): BuiltInImageRequestContract {
  const tier = (ctx.imageSize === '720p' ? '1K' : ctx.imageSize ?? TUDOU_ASYNC_FALLBACK_TIER).toUpperCase();
  if (!['1K', '2K', '4K'].includes(tier)) throw new Error(`土豆 Gemini 生图不支持图片档位 ${ctx.imageSize}`);

  const ratio = (ctx.aspectRatio ?? '').trim();
  if (ratio && ratio !== 'auto' && !TUDOU_GEMINI_RATIOS.has(ratio)) {
    throw new Error(`土豆 Gemini 生图不支持比例 ${ctx.aspectRatio}`);
  }
  const imageConfig: Record<string, string> = { imageSize: tier };
  if (ratio && ratio !== 'auto') imageConfig.aspectRatio = ratio;

  const preset = imageDimensionPreset(ctx.providerModelId, ctx.imageSize, ctx.aspectRatio)
    ?? imageDimensionPreset(ctx.baseModelId, ctx.imageSize, ctx.aspectRatio);
  const dimensions = preset
    ? { width: preset.width, height: preset.height }
    : mapImageDimensions(ctx.imageSize, ctx.aspectRatio);

  return {
    kind: 'protocol',
    referenceInput: 'data-url',
    dimensions,
    protocol: {
      version: 2,
      mode: 'sync',
      auth: { type: 'bearer' },
      submit: {
        method: 'POST',
        /* 文档端点逐字：`/v1beta/models/{model}:generateContent`。`{{model}}` 由
           `generateImage` 的 `variables.model` 提供（与 `ctx.providerModelId` 同源 ⇒ 出站 id 原文）。 */
        path: '/v1beta/models/{{model}}:generateContent',
        /* ★★ 必须 `origin` —— 这条端点挂在**站点根**下，不在 `/v1` 下。
           事故（用户真机）：连接 Base URL = `https://api.ai-tudou.net/v1`（土豆连接的实际形状），
           默认 `pathMode:'append'` 拼成 `…/v1/v1beta/models/…:generateContent`
           ⇒ 上游回 `404 Invalid URL (POST /v1/v1beta/models/gemini-3-pro-image-preview:generateContent)`
           （MTV 侧落盘成 `canvasError`）。
           官方同形的先例：`providers/googleModelManifest.ts` 的四条 Gemini 协议全部 `pathMode:'origin'`。
           `buildSameOriginUrl` 的 `origin` 分支仍是**同源校验**（`url.origin !== parsedBase.origin` 会抛）。 */
        pathMode: 'origin',
        bodyEncoding: 'json',
        body: {
          contents: [{
            role: 'user',
            parts: [
              /* 参考图逐项展开成 `{inlineData:{mimeType,data}}`；没有参考图时该项整段省略。 */
              { $forEach: '{{imageUrls}}', $value: { inlineData: { $inlineData: '{{imageUrls}}' } } },
              { text: '{{prompt}}' },
            ],
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig,
          },
        },
      },
      response: { type: 'json', result: { geminiImageParts: true } },
    },
  };
}

/** 只有**异步**那一组有这条自有合同；同步组是另一条合同（见下）。 */
export function tudouImageContract(ctx: ImageContractContext): BuiltInImageRequestContract | undefined {
  /* ── ★ round 129：Gemini 原生渠道的 Nano Banana 家族（同步，与 `-async` 无关）──
     第一方文档：`https://docs.ai-tudou.net/nano-banana-api-docs.html`（2026-10-16 取，落盘
     `D:\DEEPSEEK\_r130-nano-banana-doc.html`）。逐字要点：
       · 「**必须使用 Gemini 原生渠道**，否则 `imageConfig` 参数会被忽略，比例和分辨率无法控制」；
         渠道表：`Gemini 原生渠道 /v1beta/models/{model}:generateContent` ✓ /
         **`OpenAI 兼容渠道 /v1/images/generations` ✗ 不支持，参数被忽略或者请求失败**；
       · 「可用模型」明列 **`gemini-3-pro-image-preview`、`gemini-3.1-flash-image-preview`**（文档列的，不是按名字猜）；
       · 请求体 `{contents:[{role:"user",parts:[…inlineData…,{text}]}], generationConfig:{responseModalities:["TEXT","IMAGE"], imageConfig:{aspectRatio,imageSize}}}`；
       · 响应 `candidates[0].content.parts[]`（先跳 `thought`，再取 `inlineData||inline_data`；或从 `text` 里捞 Markdown base64）。
     ⚠️ 这解释了真机那句 `not supported model for image generation, only imagen models are supported`：
     MTV 以前把这两个模型发去了**通用同步链路**的 `/v1/images/generations`（文档标 ✗ 的那条）。 */
  if (ctx.executionMode !== 'async' && TUDOU_GEMINI_NATIVE_IMAGE_MODELS.has(ctx.providerModelId)) {
    return tudouGeminiImageContract(ctx);
  }

  if (ctx.executionMode !== 'async') return undefined;

  const tier = (ctx.imageSize === '720p' ? '1K' : ctx.imageSize ?? TUDOU_ASYNC_FALLBACK_TIER).toLowerCase();
  if (!RESOLUTIONS.has(tier)) throw new Error(`土豆异步生图不支持图片档位 ${ctx.imageSize}`);

  /* ⚠️ 协议模板只能引用 `{{model}}`/`{{prompt}}`/`{{imageUrls}}` —— 内置合同这条链路
     （`generateImage` 的 `executeModelProtocol` 调用）**不喂 `aspectRatio`/`imageSize`**，
     所以比例与档位必须在**合同构建期**写成字面量，写成 `{{…}}` 会被整条省略 ✗ */
  const ratio = (ctx.aspectRatio ?? TUDOU_ASYNC_FALLBACK_RATIO).trim();
  const size = /^\d+\s*:\s*\d+$/.test(ratio) ? ratio : TUDOU_ASYNC_FALLBACK_RATIO;

  /* 能力表（`dimensionPresets`）是按**同步** id 登记的；异步 id 查不到时退一步用它的
     主体 id（`…-flare-async` → `…-flare`）—— 同一族的原生像素相同，
     否则节点框会按全局「短边换算」算成 1024×1365。
     ⚠️ 用 `baseModelId`（去后缀）**只为了查像素表**，发出去的仍是 `providerModelId` 原文。 */
  const preset = imageDimensionPreset(ctx.providerModelId, ctx.imageSize, ctx.aspectRatio)
    ?? imageDimensionPreset(ctx.baseModelId, ctx.imageSize, ctx.aspectRatio);
  const dimensions = preset
    ? { width: preset.width, height: preset.height }
    : mapImageDimensions(ctx.imageSize, ctx.aspectRatio);

  return {
    kind: 'protocol',
    referenceInput: 'data-url',
    dimensions,
    protocol: {
      version: 2,
      mode: 'async',
      auth: { type: 'bearer' },
      submit: {
        method: 'POST',
        path: '/images/generations/async',
        bodyEncoding: 'json',
        body: {
          /* ★ 原样：`providerModelId`（含 `-async`）—— 不许 strip、不许改写 */
          model: ctx.providerModelId,
          prompt: '{{prompt}}',
          size,
          resolution: tier,
          quality: ctx.quality && QUALITIES.has(ctx.quality) ? ctx.quality : 'medium',
          images: '{{imageUrls}}',
        },
      },
      response: { type: 'json', taskIdPath: 'data.id', errorPath: 'data.error.message' },
      poll: {
        method: 'GET',
        path: '/tasks/{{submit.data.id}}',
        response: {
          statusPath: 'data.status',
          successValues: ['completed'],
          failureValues: ['failed'],
          errorPath: 'data.error.message',
          progressPath: 'data.progress',
          /* ⚠️ **不能写 `fetchUrl: true`** ✗ —— 它要求「用同源鉴权下载结果并转 data URL」，
             而土豆的产物挂在**另一个域名**上（`ms.ai-tudou.net` vs 连接地址 `api.ai-tudou.net`）
             ⇒ 实测报「模型结果下载地址与厂商连接地址不同源」✗
             产物 URL 是公开的，直接交给通用下载链路即可 ✓ */
          result: { urlPath: 'data.result.images.0.url.0' },
        },
        intervalMs: 4000,
        maxAttempts: 150,
        maxDurationMs: 900000,
      },
    },
  };
}

export const tudouAdapter: ProviderAdapter = {
  ...createOpenAiCompatibleAdapter('tudou', '土豆中转站'),
  suffixSpec: { separator: '-', suffixes: ['async'], executionMode: { async: 'async' } },
};
