/**
 * ai/providers/standardImage — 标准 OpenAI 兼容图片生成
 *
 * 适用于 general 通用模型和任意 OpenAI 兼容 provider。
 * 缺省使用 /images/generations JSON；显式配置后，参考图请求使用 /images/edits multipart。
 */
import { isLocalMediaUrl } from '../../../utils/mediaUrl';
import { parseResponseError, buildAuthHeaders } from '../httpUtils';
import { corsSafeFetch } from '../httpTransport';
import {
  isOpenAIGptImageModel,
  formatImageSizeForModel,
  parseGeneralImageResponses,
} from '../helpers';
import { runBatchTasks } from '../batchUtils';
import type { ImageReferenceRequestMode } from '../../../types';
import type { BatchImageResult, ImageGenerationResult } from '../../../types/aiTypes';
import { buildStandardImageRequestBody } from '../imageParameterMappings';
import { prepareReferenceImageUpload } from '../referenceImageUpload';
import { imageDimensionPreset } from '../mediaModelCapabilities';
import { officialImageSize } from '../officialImageSizes';

/**
 * 出站 `size`（像素串）。三级取值，全部数据驱动、不写死任何厂商 id：
 *   1. **厂商自己声明的像素**（`imageDimensionPreset`）—— 中转站只认自己文档里的值，
 *      发别的值不报错但会静默回落到不受控的默认尺寸（用户 2026 实测，见该函数注释）；
 *   2. **官方画布像素表**（`officialImageSizes.ts`，抄自官方运行时）—— 厂商没声明时的同源兜底；
 *   3. 短边换算（旧行为）—— 前两者都不适用时保持原样。
 */
function resolveStandardImageSize(
  modelName: string,
  params: Pick<StandardImageParams, 'imageSize' | 'aspectRatio'>,
  dimensions: { width: number; height: number },
): string {
  const preset = imageDimensionPreset(modelName, params.imageSize, params.aspectRatio);
  if (preset) return `${preset.width}x${preset.height}`;
  return officialImageSize(modelName, params.imageSize, params.aspectRatio)
    ?? formatImageSizeForModel(modelName, dimensions);
}

export interface StandardImageParams {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  prompt: string;
  dimensions: { width: number; height: number };
  imageUrls?: string[];
  imageReferenceRequestMode?: ImageReferenceRequestMode;
  /** 官方「透明背景」开关 ✓（EXE：仅 2.5 系列那 2 个模型 ✓ → `background` + `output_format` ✓） */
  transparentBackground?: boolean;
  /** 官方界面「精细度」，**已经映射成接口认的值**（见 `services/ai/imageQuality.ts`）；
   *  由调用方按模型能力算好，这里只负责放进请求体（任何厂商都走这条，不写死土豆）。 */
  quality?: string;
  /** 官方档位（`1K`/`2K`/`4K`/`720p`）+ 比例；用于命中官方像素表（见 `officialImageSizes.ts`）。 */
  imageSize?: string;
  aspectRatio?: string;
}

interface ReferenceImageFile {
  blob: Blob;
  filename: string;
}

const MIME_EXTENSION: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function usesWebViewFetch(url: string): boolean {
  return isLocalMediaUrl(url);
}

async function loadReferenceImage(
  url: string,
  index: number,
  signal?: AbortSignal,
): Promise<ReferenceImageFile> {
  const response = await (usesWebViewFetch(url)
    ? fetch(url, { signal })
    : corsSafeFetch(url, { signal }));
  if (!response.ok) {
    throw new Error(`读取参考图 ${index + 1} 失败 (${response.status})`);
  }
  const sourceBlob = await response.blob();
  if (sourceBlob.size === 0) throw new Error(`参考图 ${index + 1} 内容为空`);
  const blobMime = sourceBlob.type.split(';')[0].trim().toLowerCase();
  const responseMime = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  const mimeType = blobMime || responseMime || 'application/octet-stream';
  const blob = sourceBlob.type === mimeType
    ? sourceBlob
    : new Blob([sourceBlob], { type: mimeType });
  return {
    blob,
    filename: `reference-${index + 1}.${MIME_EXTENSION[mimeType] || 'bin'}`,
  };
}

async function buildImageEditsBody(
  params: Pick<StandardImageParams, 'modelName' | 'prompt' | 'imageUrls'>,
  count: number,
  size: string,
  signal?: AbortSignal,
): Promise<FormData> {
  const imageUrls = params.imageUrls ?? [];
  const formData = new FormData();
  formData.append('model', params.modelName);
  formData.append('prompt', params.prompt);
  formData.append('n', String(count));
  formData.append('size', size);
  // 大参考图逐张解码，避免多张 4K PNG 同时占用解码与画布内存。
  for (const [index, url] of imageUrls.entries()) {
    signal?.throwIfAborted();
    const file = await loadReferenceImage(url, index, signal);
    const blob = await prepareReferenceImageUpload(file.blob, signal);
    const filename = blob === file.blob ? file.filename : `reference-${index + 1}.jpg`;
    formData.append('image[]', blob, filename);
  }
  return formData;
}

function buildMultipartAuthHeaders(apiKey: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export async function generateImageStandard(
  params: StandardImageParams,
  signal?: AbortSignal,
): Promise<{ url: string; width: number; height: number }> {
  const batch = await generateImageStandardBatch(params, 1, signal);
  const result = batch.results[0];
  if (!result) throw new Error('图片生成返回结果为空');
  return result;
}

async function requestStandardImages(
  params: StandardImageParams,
  count: number,
  signal?: AbortSignal,
): Promise<Response> {
  const { apiKey, baseUrl, modelName, prompt, dimensions, imageUrls = [] } = params;

  const sizeStr = resolveStandardImageSize(modelName, params, dimensions);
  if (imageUrls.length > 0 && params.imageReferenceRequestMode === 'edits-multipart') {
    const apiUrl = baseUrl.replace(/\/+$/, '') + '/images/edits';
    const body = await buildImageEditsBody(params, count, sizeStr, signal);
    const files = body.getAll('image[]') as File[];
    const bytes = files.reduce((total, file) => total + file.size, 0);
    const startedAt = Date.now();
    try {
      const response = await corsSafeFetch(apiUrl, {
        method: 'POST', headers: buildMultipartAuthHeaders(apiKey), body, signal,
      });
      if (response.status === 504) await parseResponseError(response, '图片生成失败 (504)');
      return response;
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      const message = error instanceof Error ? error.message : '图片请求传输失败';
      throw new Error(`${message}\n提交信息：模型 ${modelName}；参考图 ${files.length} 张，共 ${(bytes / 1048576).toFixed(2)} MiB；输出 ${sizeStr}；等待 ${Math.round((Date.now() - startedAt) / 1000)} 秒。`, { cause: error });
    }
  }

  const apiUrl = baseUrl.replace(/\/+$/, '') + '/images/generations';
  if (imageUrls.length > 0 && params.imageReferenceRequestMode === 'edits-json-images') {
    /* ★★ 「编辑接口 + JSON body」（用户 2026 实测新增）——语义 = 官方 `scene:"image-edit"`：
       把这次调用声明成**图像编辑**（参考图当底图），而不是「文生图 + 参考图列表」。
       实测（土豆中转站 + gpt-image-2-pro）：
         · `/images/generations` + `image_urls`/`image`/`scene`/`{{Image 1}}` ⇒ 全部**无视参考图**（照样重新构思）
         · `/images/edits` + **multipart** ⇒ 400「multipart/form-data is not supported」
         · `/images/edits` + **JSON** `{model,prompt,size,images:[url|dataURL]}` ⇒ ✅ **完全跟着参考图**
           （用户原话即可，不需要提示词工程；`images` 数组与 `image` 字符串两种都被接受）
       ⇒ 参考图走 `images`（数组），值沿用调用方给的（公网 URL 或 data URL 都实测可用）。*/
    const editsBody: Record<string, unknown> = {
      model: modelName,
      prompt,
      size: sizeStr,
      images: imageUrls,
    };
    /* 官方界面「精细度」→ `quality`（值已由 `imageQuality.ts` 按模型能力映射好） */
    if (params.quality) editsBody.quality = params.quality;
    /* ⚠️ 这里**不带 `n`**：调用方（`generateImageStandardBatch`）在该模式下已改成并发单图请求。
       实测中转站对 `n:2` 会串行跑两次上游生成、却只回一条 URL 填两遍（重复 + 慢）。 */
    if (params.transparentBackground) {
      editsBody.background = 'transparent';
      editsBody.output_format = 'png';
    }
    if (isOpenAIGptImageModel(modelName)) delete editsBody.response_format;
    return corsSafeFetch(baseUrl.replace(/\/+$/, '') + '/images/edits', {
      method: 'POST',
      headers: buildAuthHeaders(apiKey),
      body: JSON.stringify(editsBody),
      signal,
    });
  }

  const requestBody = buildStandardImageRequestBody({
    modelName,
    prompt,
    count,
    size: sizeStr,
    imageUrls,
    imageReferenceRequestMode: params.imageReferenceRequestMode,
    /* 官方「透明背景」→ `background:"transparent"` + `output_format:"png"` ✓ */
    transparentBackground: params.transparentBackground,
    /* 官方界面「精细度」→ `quality` ✓ */
    quality: params.quality,
  });
  if (isOpenAIGptImageModel(modelName)) delete requestBody.response_format;

  return corsSafeFetch(apiUrl, {
    method: 'POST',
    headers: buildAuthHeaders(apiKey),
    body: JSON.stringify(requestBody),
    signal,
  });
}

async function parseStandardResponse(
  response: Response,
  dimensions: { width: number; height: number },
): Promise<ImageGenerationResult[]> {
  if (!response.ok) await parseResponseError(response, `图片生成失败 (${response.status})`);

  const responseText = await response.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    const contentType = response.headers.get('Content-Type') || '未知 Content-Type';
    if (/text\/html/i.test(contentType) || /^\s*<!doctype\s+html/i.test(responseText)) {
      throw new Error('图片接口返回了 HTML 页面，请检查连接地址是否指向 API 根路径（常见需要追加 /v1）');
    }
    throw new Error(`图片接口返回了非 JSON 响应 (${contentType})`);
  }
  const imageUrls = parseGeneralImageResponses(json);
  return imageUrls.map((url) => ({ url, width: dimensions.width, height: dimensions.height }));
}

/**
 * 按 URL 去重 —— 用户 2026 报的「数量=2 时出两张**一摸一样**的图」的直接原因：
 * 中转站（土豆 + gpt-image-2-pro）对 `n:2` 会返回 **两条指向同一张图**的记录
 * （实测 `data[0].url === data[1].url`），MTV 原来照单全收 ⇒ 两张卡同一张画。
 * 而**两次独立调用结果并不相同**（实测 md5 不同）⇒ 去重后用单图请求补齐就是真正的变体。
 * 这是通用的安全网（任何服务商返回重复 URL 都该去重），不针对某一家。
 */
function uniqueImageResults(results: ImageGenerationResult[]): ImageGenerationResult[] {
  const seen = new Set<string>();
  const out: ImageGenerationResult[] = [];
  for (const item of results) {
    const url = (item.url || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(item);
  }
  return out;
}

export async function generateImageStandardBatch(
  params: StandardImageParams,
  count: number,
  signal?: AbortSignal,
): Promise<BatchImageResult> {
  const requestedCount = Math.max(1, Math.floor(count));

  /* ★★ 「编辑接口 JSON」模式**不依赖 `n`**：实测（土豆 + gpt-image-2-pro）
     一次 `n:2` 的 edits 请求，中转站**串行跑了两次上游生成**（耗时近两倍），却只回**一条 URL 填两遍**
     ⇒ 既慢又出一模一样的图。该模式改为**并发 N 个单图请求**（`runBatchTasks` 并发 3）：
       · 结果天然不同（实测两次独立调用 md5 不同）；
       · 总耗时 ≈ 单次调用（而不是 N 倍串行）。 */
  if (requestedCount > 1 && params.imageReferenceRequestMode === 'edits-json-images') {
    const singles = await runBatchTasks(requestedCount, 3, async () => {
      const response = await requestStandardImages(params, 1, signal);
      const results = await parseStandardResponse(response, params.dimensions);
      const result = results[0];
      if (!result) throw new Error('图片生成返回结果为空');
      return result;
    });
    const uniqueSingles = uniqueImageResults(singles.results);
    return {
      requestedCount,
      results: uniqueSingles.slice(0, requestedCount),
      failedCount: Math.max(singles.failedCount, requestedCount - uniqueSingles.length),
    };
  }

  const initialResponse = await requestStandardImages(params, requestedCount, signal);

  // User-configured OpenAI-compatible endpoints do not always implement n.
  if (!initialResponse.ok && requestedCount > 1 && [400, 422].includes(initialResponse.status)) {
    const fallback = await runBatchTasks(requestedCount, 3, async () => {
      const response = await requestStandardImages(params, 1, signal);
      const results = await parseStandardResponse(response, params.dimensions);
      const result = results[0];
      if (!result) throw new Error('图片生成返回结果为空');
      return result;
    });
    if (fallback.results.length === 0) {
      throw new Error('批量图片生成失败：服务不支持批量参数，单图降级请求也全部失败');
    }
    const uniqueFallback = uniqueImageResults(fallback.results);
    return {
      requestedCount,
      results: uniqueFallback.slice(0, requestedCount),
      failedCount: Math.max(fallback.failedCount, requestedCount - uniqueFallback.length),
    };
  }

  const initialResults = await parseStandardResponse(initialResponse, params.dimensions);
  if (initialResults.length === 0) throw new Error('图片生成返回结果为空');

  /* ★ 先按 URL 去重再看够不够：中转站可能把 `n` 当摆设（返回 N 条同一张图）——
     不去重就会一路「够数」直接返回，用户看到 N 张一摸一样（用户 2026 实测的 bug）。 */
  const uniqueInitial = uniqueImageResults(initialResults);
  if (uniqueInitial.length >= requestedCount) {
    return { requestedCount, results: uniqueInitial.slice(0, requestedCount), failedCount: 0 };
  }

  const missingCount = requestedCount - uniqueInitial.length;
  const supplement = await runBatchTasks(missingCount, 3, async () => {
    const response = await requestStandardImages(params, 1, signal);
    const results = await parseStandardResponse(response, params.dimensions);
    const result = results[0];
    if (!result) throw new Error('图片生成返回结果为空');
    return result;
  });

  /* 补齐出来的图也可能与已有/彼此撞车（偶发重复）⇒ 合并时再去一次重 */
  const merged = uniqueImageResults([...uniqueInitial, ...supplement.results]);
  return {
    requestedCount,
    results: merged.slice(0, requestedCount),
    failedCount: Math.max(supplement.failedCount, requestedCount - merged.length),
  };
}
