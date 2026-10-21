/**
 * ai/modelProtocolResponse — 声明式模型协议响应的读取与预览。
 * 按点号路径（支持 * 通配、数字下标及 [*]/[0] 写法）从响应 JSON 中抽取 URL、文本、Base64、错误、进度等字段，
 * 路径解析屏蔽 __proto__ / prototype / constructor 等危险段；并提供给协议编辑器的响应预览条目
 * （Base64 结果脱敏为字符数）。
 */
import type { NormalizedModelExecutionProtocol, ProtocolJsonValue } from '../../types/aiTypes';

const BLOCKED_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export interface ModelProtocolResponsePreviewEntry {
  id: string;
  label: string;
  path: string;
  matchCount: number;
  values: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function readModelProtocolPathValues(value: unknown, path: string): unknown[] {
  let current = [value];
  const normalizedPath = path.replace(/\[(\*|\d+)\]/g, '.$1');
  for (const segment of normalizedPath.split('.')) {
    if (!segment || BLOCKED_PATH_SEGMENTS.has(segment)) return [];
    const next: unknown[] = [];
    for (const item of current) {
      if (segment === '*' && Array.isArray(item)) {
        next.push(...item);
      } else if (Array.isArray(item) && /^\d+$/.test(segment)) {
        const indexed = item[Number(segment)];
        if (indexed !== undefined) next.push(indexed);
      } else if (isRecord(item) && Object.hasOwn(item, segment)) {
        next.push(item[segment]);
      }
    }
    current = next;
  }
  return current;
}

export function readModelProtocolFirstScalar(
  value: unknown,
  path: string,
): string | number | boolean | null | undefined {
  const match = readModelProtocolPathValues(value, path).find((item) =>
    item === null || ['string', 'number', 'boolean'].includes(typeof item),
  );
  return match as string | number | boolean | null | undefined;
}

export function readModelProtocolUrls(value: unknown, path: string): string[] {
  return readModelProtocolPathValues(value, path)
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

/**
 * 文档给的「图片被塞进 `part.text` 的 Markdown data URL」形态的正则（照抄文档，
 * 只多开一个捕获组把前缀里的 mime 拿到手）：文档的 `data:image\/[^;]+;base64,`
 * 本身就带着 mime ⇒ 必须原样保留（`image/jpeg` 不能写成 `image/png`）。
 */
const GEMINI_TEXT_IMAGE_RE = /!\[.*?\]\(data:(image\/[^;]+);base64,([^)]+)\)/g;

/** 本文件自用（不引 `modelProtocolShared`，避免与模板渲染互相 import）。 */
const RESULT_MIME_RE = /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$/;

function geminiPartImage(part: unknown): string | undefined {
  if (!isRecord(part)) return undefined;
  const inline = isRecord(part.inlineData)
    ? part.inlineData
    : (isRecord(part.inline_data) ? part.inline_data : undefined);
  const data = inline?.data;
  if (typeof data !== 'string' || !data.trim()) return undefined;
  /* ⚠️ 登记一处**有据的偏离**：文档只写「取该 part 的 `mimeType`」，**没有**规定它缺失或非法时怎么办。
     这里的 `image/png` 是 MTV 自己的**缺失回退**（保持旧行为），不是文档取值，也不是「与官方一致」；
     上游给了合法 mimeType 时永远走前一支。 */
  const mimeType = typeof inline?.mimeType === 'string' && RESULT_MIME_RE.test(inline.mimeType)
    ? inline.mimeType
    : 'image/png';
  return `data:${mimeType};base64,${data}`;
}

/**
 * **Gemini 原生图像响应**（`candidates[].content.parts[]`）的图片抽取 ——
 * 逐字照抄土豆文档 `https://docs.ai-tudou.net/nano-banana-api-docs.html` 的「响应解析」：
 * 两种格式都收（`inlineData` 直返 / `text` 里 Markdown base64），**逐 part 先跳过 `thought`**。
 * 这是**形状**级能力（`ModelProtocolResultConfig.geminiImageParts`），不绑定任何厂商。
 */
export function readGeminiImageParts(payload: unknown): string[] {
  /* `readModelProtocolPathValues` 的 `*` 才是「摊平数组元素」⇒ 必须写到 parts 的元素一级
     （只写到 `candidates` 会拿到「装着数组的数组」）。 */
  const parts = readModelProtocolPathValues(payload, 'candidates.*.content.parts.*');
  const out: string[] = [];
  for (const part of parts) {
    if (!isRecord(part)) continue;
    /* ★ 文档第一句是对**每个** part 说的：`if (part.thought) continue;` ——
       thinking 过程不算产物 ⇒ inlineData 与 text 两种形态都不提取。
       （曾只挡 inline 分支，thought part 的 Markdown base64 会被误当产物。） */
    if (part.thought) continue;
    const image = geminiPartImage(part);
    if (image) {
      out.push(image);
      continue;
    }
    /* 格式 2：`part.text` 里带 Markdown data URL；mime 取自该 data URL 前缀（不写死 png）。 */
    const text = typeof part.text === 'string' ? part.text : '';
    if (!text) continue;
    for (const match of text.matchAll(GEMINI_TEXT_IMAGE_RE)) {
      if (match[1] && match[2]) out.push(`data:${match[1]};base64,${match[2]}`);
    }
  }
  return out;
}

function formatResponsePreviewValue(value: unknown, redactBase64: boolean): string {
  if (redactBase64 && typeof value === 'string') {
    const base64Value = value.includes(',') && /^data:/i.test(value)
      ? value.slice(value.indexOf(',') + 1)
      : value;
    return `[Base64 ${base64Value.replace(/\s/g, '').length} 字符]`;
  }
  const serialized = typeof value === 'string'
    ? value
    : value === undefined ? '' : JSON.stringify(value);
  return serialized.length > 240 ? `${serialized.slice(0, 240)}...` : serialized;
}

export function previewNormalizedModelProtocolResponse(
  protocol: NormalizedModelExecutionProtocol,
  payload: ProtocolJsonValue,
): ModelProtocolResponsePreviewEntry[] {
  const entries: ModelProtocolResponsePreviewEntry[] = [];
  const addEntry = (
    id: string,
    label: string,
    path: string | undefined,
    redactBase64 = false,
  ) => {
    if (!path) return;
    const matches = readModelProtocolPathValues(payload, path)
      .flatMap((value) => Array.isArray(value) ? value : [value]);
    entries.push({
      id,
      label,
      path,
      matchCount: matches.length,
      values: matches.map((value) => formatResponsePreviewValue(value, redactBase64)),
    });
  };

  if (protocol.mode === 'sync') {
    if (protocol.response.type !== 'json') return [];
    addEntry('result-url', 'URL 结果', protocol.response.result?.urlPath);
    addEntry('result-text', '文本结果', protocol.response.result?.textPath);
    addEntry('result-base64', 'Base64 结果', protocol.response.result?.base64Path, true);
    if (protocol.response.result?.geminiImageParts) {
      const matches = readGeminiImageParts(payload as ProtocolJsonValue);
      entries.push({
        id: 'result-gemini-image-parts',
        label: 'Gemini 原生 parts 图片',
        path: 'candidates.*.content.parts.*',
        matchCount: matches.length,
        values: matches.map((value) => formatResponsePreviewValue(value, true)),
      });
    }
    addEntry('submit-error', '错误信息', protocol.response.errorPath);
    return entries;
  }

  addEntry('task-id', '任务 ID（提交响应）', protocol.response.taskIdPath);
  addEntry('submit-error', '提交错误', protocol.response.errorPath);
  addEntry('status', '任务状态（轮询响应）', protocol.poll?.response.statusPath);
  addEntry('poll-result-url', 'URL 结果', protocol.poll?.response.result.urlPath);
  addEntry('poll-result-text', '文本结果', protocol.poll?.response.result.textPath);
  addEntry('poll-result-base64', 'Base64 结果', protocol.poll?.response.result.base64Path, true);
  addEntry('poll-error', '任务错误', protocol.poll?.response.errorPath);
  addEntry('progress', '任务进度', protocol.poll?.response.progressPath);
  return entries;
}
