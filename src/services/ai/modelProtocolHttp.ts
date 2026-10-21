/**
 * ai/modelProtocolHttp — 协议执行过程中的 HTTP 细节与结果解码。
 *
 * 错误响应按协议声明的 errorPath 抽取上游文案；结果下载强制同源，
 * Base64 / PCM 结果在前端转成 data URL，避免把二进制处理散落到各调用方。
 */
import type { ModelProtocolAuthConfig, ModelProtocolResultConfig, ProtocolJsonValue } from '../../types/aiTypes';
import { corsSafeFetch } from './httpTransport';
import { readModelProtocolFirstScalar } from './modelProtocolResponse';
import { MIME_TYPE_RE, isRecord, resolveAuthentication } from './modelProtocolShared';
import { applyQueryAuthentication } from './modelProtocolRequest';

export class ModelProtocolHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(
    status: number,
    message: string,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ModelProtocolHttpError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, timestamp - Date.now());
}

/**
 * 上游有时把**真正的错误**再套一层 JSON 字符串里（土豆 400 就是这样：
 * `{"code":"fail_to_fetch_task","message":"{\"code\":400,\"data\":{\"error\":{…}}}"}`）。
 * 直接把整段转义 JSON 甩给用户没有任何用 ⇒ 抠出内层的 `error.message`。
 */
function unwrapNestedProviderMessage(message: string): string {
  const text = message.trim();
  if (!text.startsWith('{')) return message;
  try {
    const inner: unknown = JSON.parse(text);
    const candidate = isRecord(inner) && isRecord(inner.data) && isRecord(inner.data.error)
      ? inner.data.error.message
      : isRecord(inner) && isRecord(inner.error)
        ? inner.error.message
        : isRecord(inner)
          ? inner.message
          : undefined;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : message;
  } catch {
    return message;
  }
}

/**
 * 「当前渠道不支持这组参数」——土豆**免费池**渠道对 4K / high 档回
 * `409 {"code":"free_pool_param_mismatch","message":"Unsupported parameters for this channel;
 * switching automatically."}`
 * （2026-10-20 实测：`resolution=1k|2k` + `quality=low|medium` 一律 200，
 *  `resolution=4k` **或** `quality=high` 一律 409，与模型名/比例无关）。
 * 原文（「for this channel; switching automatically」）对用户没有任何指导意义
 * ⇒ 换成一句照着改就能过的话。
 */
const CHANNEL_PARAM_MISMATCH_RE = /unsupported parameters for this channel/i;

function friendlyChannelParamMessage(rawMessage: string, status: number): string | null {
  if (status !== 400 && status !== 409 && status !== 422) return null;
  if (!CHANNEL_PARAM_MISMATCH_RE.test(rawMessage)) return null;
  return '当前渠道不支持这次请求的参数组合（分辨率档位 / 质量档位）：'
    + '请把清晰度降到 2K 及以下、质量改成 medium 或 low 后重试';
}

export async function readJsonResponse(
  response: Response,
  label: string,
  errorPath?: string,
): Promise<ProtocolJsonValue> {
  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    let payload: unknown;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }
    const configuredMessage = errorPath && (isRecord(payload) || Array.isArray(payload))
      ? readModelProtocolFirstScalar(payload, errorPath)
      : undefined;
    const message = unwrapNestedProviderMessage(configuredMessage !== undefined && configuredMessage !== null
      ? String(configuredMessage)
      : isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
        ? payload.error.message
        : isRecord(payload) && typeof payload.message === 'string'
          ? payload.message
          : rawText.trim() || `${label} (${response.status})`);
    if (response.status === 429 && /no deployments available/i.test(message)) {
      throw new Error('所选模型暂无可用部署，请稍后手动重试（429）');
    }
    const friendly = friendlyChannelParamMessage(message, response.status);
    if (friendly) throw new Error(friendly);
    throw new ModelProtocolHttpError(
      response.status,
      `${label} (${response.status}): ${message}`,
      parseRetryAfterMs(response.headers.get('Retry-After')),
    );
  }
  const payload = await response.json().catch(() => null) as unknown;
  if (!isRecord(payload) && !Array.isArray(payload)) {
    throw new Error(`${label}：响应必须是 JSON 对象或数组`);
  }
  return payload as ProtocolJsonValue;
}

export async function ensureSuccessfulRawResponse(
  response: Response,
  label: string,
  errorPath?: string,
): Promise<Response> {
  if (response.ok) return response;
  await readJsonResponse(response, label, errorPath);
  return response;
}

export function encodeBytesBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64Bytes(value: string): Uint8Array {
  const encoded = /^data:[^;,]+;base64,/i.test(value)
    ? value.slice(value.indexOf(',') + 1)
    : value;
  const normalized = encoded.replace(/\s/g, '');
  try {
    const binary = atob(normalized);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error('模型响应中的 Base64 结果无效');
  }
}

function pcmS16LeToWav(pcm: Uint8Array, sampleRate: number, channels: number): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  if (pcm.byteLength % blockAlign !== 0) {
    throw new Error('模型响应中的 PCM 数据长度与声道配置不匹配');
  }
  const wav = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(wav.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      wav[offset + index] = value.charCodeAt(index);
    }
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  wav.set(pcm, 44);
  return wav;
}

export function normalizeBase64Result(
  value: string,
  mimeType: string,
  transform?: ModelProtocolResultConfig['base64Transform'],
): string {
  if (transform?.type === 'pcm-s16le-to-wav') {
    const wav = pcmS16LeToWav(
      decodeBase64Bytes(value),
      transform.sampleRate,
      transform.channels ?? 1,
    );
    return `data:audio/wav;base64,${encodeBytesBase64(wav)}`;
  }
  if (/^data:[^;,]+;base64,/i.test(value)) return value;
  return `data:${mimeType};base64,${encodeBytesBase64(decodeBase64Bytes(value))}`;
}

function buildResultAuthenticationHeaders(
  auth: ModelProtocolAuthConfig | undefined,
  apiKey: string,
): Record<string, string> {
  if (!apiKey) return {};
  const resolvedAuth = resolveAuthentication(auth);
  if (resolvedAuth.type === 'bearer') {
    return { Authorization: `${resolvedAuth.prefix ?? 'Bearer '}${apiKey}` };
  }
  if (resolvedAuth.type === 'header') {
    return { [resolvedAuth.name!]: `${resolvedAuth.prefix ?? ''}${apiKey}` };
  }
  return {};
}

export async function fetchSameOriginResultUrls(
  urls: readonly string[],
  baseUrl: string,
  auth: ModelProtocolAuthConfig | undefined,
  apiKey: string,
  fallbackMimeType?: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const allowedOrigin = new URL(baseUrl).origin;
  return Promise.all(urls.map(async (rawUrl) => {
    const url = new URL(rawUrl);
    if (url.origin !== allowedOrigin) {
      throw new Error('模型结果下载地址与厂商连接地址不同源');
    }
    const response = await corsSafeFetch(
      applyQueryAuthentication(url.toString(), auth, apiKey),
      { method: 'GET', headers: buildResultAuthenticationHeaders(auth, apiKey), signal },
    );
    await ensureSuccessfulRawResponse(response, '模型结果下载失败');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error('模型结果下载内容为空');
    const responseMimeType = response.headers.get('Content-Type')?.split(';')[0]?.trim();
    const mimeType = responseMimeType && MIME_TYPE_RE.test(responseMimeType)
      ? responseMimeType
      : fallbackMimeType ?? 'application/octet-stream';
    return `data:${mimeType};base64,${encodeBytesBase64(bytes)}`;
  }));
}
