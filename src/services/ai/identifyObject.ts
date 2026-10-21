/**
 * identifyObject — 焦点编辑（官方 `magicSelection`）的「点图识别元素」服务。
 *
 * ── 官方契约（`vendor-pkg-canvas-futqHM6N.js` @1576566，`jUe` 逐字）──
 *   `const h = (await Zh.touch2edit({ fileId: p, point: { x: m.x, y: m.y } })).data?.items;`
 *   ⇒ 传 **图片 fileId + 归一化点坐标**，拿回 `items[]`，每条形如
 *     `{ label_name: string, box_2d: [ymin, xmin, ymax, xmax], label_desc?: string }`。
 *   官方失败码：`BAD_REQUEST` / `RATE_LIMIT` / `SERVER_ERROR` / `MODEL_SERVICE_ERROR` / `NO_OBJECT_DETECTED`。
 *   过滤：`items.filter(y => y.label_name && Array.isArray(y.box_2d) && y.box_2d.length === 4)`，
 *   过滤后为空 ⇒ `NO_OBJECT_DETECTED`。
 *
 * ── MTV 的做法 ──
 *   官方 `Zh.touch2edit` 是 TapNow 云服务，MTV 没有该端点。
 *   这里改用**用户自己配置的第三方视觉模型**（走 MTV 既有 provider 体系 + `generateText`，
 *   它已支持 `imageUrls` → OpenAI 兼容 `image_url` 视觉输入）。
 *   ⇒ 只要用户在「设置 → API Key」里配了任意支持视觉的聊天模型，本功能即可用。
 *
 * ⚠️ 坐标系：官方 `box_2d` 是 **0–1000 归一化整千分坐标**，顺序 **`[ymin, xmin, ymax, xmax]`**
 *    （Gemini / Tap2Edit 风格）。对外一律按这个形状返回，调用方无需再换算。
 */
import { generateText } from './generateText';
import { resolveGeneralModelConnection } from './helpers';
import { loadImage } from './imageUtils';
import { getLocale } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';

export type IdentifyObjectErrorCode =
  | 'BAD_REQUEST'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'MODEL_SERVICE_ERROR'
  | 'NO_OBJECT_DETECTED'
  | 'NO_VISION_MODEL'
  | 'UNKNOWN';

export interface IdentifyObjectItem {
  label_name: string;
  /** 归一化千分坐标 `[ymin, xmin, ymax, xmax]` */
  box_2d: [number, number, number, number];
  label_desc?: string;
}

export interface IdentifyObjectResult {
  success: boolean;
  items?: IdentifyObjectItem[];
  error?: { code: IdentifyObjectErrorCode; message: string };
}

/** 归一化点（0–1000，与官方 `clickPosition` 同尺度）。 */
export interface IdentifyPoint {
  x: number;
  y: number;
}

const IDENTIFY_TIMEOUT_MS = 30_000;

/**
 * 解析出「用于识别的视觉模型」。
 *
 * 优先取用户在设置里显式指定的焦点编辑模型（`config.focusEditModel`），
 * 否则回落到通用模型里第一个**有可用连接（providerConfigId + baseUrl + apiKey）**的条目。
 * 官方没有这个选项（它用自家云服务），这里是 MTV 的必要补充。
 *
 * ⚠️ MTV 的 `GeneralModelConfig` 只有 `id` / `modelId` / `providerConfigId`，
 *   **没有 `value` 字段**（我第一版按 `value` 取，导致永远解析不到 ⇒ 见下方 git 注释）。
 *   `generateText` 要求的是 `general/${id}` 这种「模型引用」格式
 *   （`resolveGeneralModel` 里 `modelValue.replace(/^general\//,'')`）。
 */
function resolveVisionModel(): { ref: string } | null {
  const config = useAppStore.getState().config;

  const explicit = (config as { focusEditModel?: { model?: string; provider?: string } }).focusEditModel;
  if (explicit?.model && explicit?.provider) {
    return { ref: explicit.model };
  }

  const generalModels = config.generalModels ?? [];
  /* ⚠️ 必须筛 `category === 'text'`：`generalModels` 里混着 image / video / audio 生成模型
     （本机实测 26 条里绝大多数是 `category:'image'`）。挑到图像生成模型会直接请求失败。
     视觉识别属于文本+图片输入 ⇒ 只有 `text` 类模型才可能胜任。 */
  const textModels = generalModels.filter((entry) => entry?.id && entry.category === 'text');
  for (const entry of textModels) {
    const ref = `general/${entry.id}`;
    const connection = resolveGeneralModelConnection(ref);
    if (connection?.baseUrl) return { ref };
  }
  return null;
}

const NO_MODEL_MESSAGE =
  '焦点编辑需要一个支持视觉的模型来识别元素。\n'
  + '请在「设置 → API Key」中配置一个支持图片输入的聊天模型（官方原版用的是自家云识别服务，MTV 用你自己的模型替代）。';

/** 界面语言 → 让模型吐同语言标签（官方服务按用户语言返回，MTV 这里显式要求）。*/
function labelLanguageName(): string {
  switch (getLocale()) {
    case 'zh-CN': return 'Simplified Chinese';
    case 'ja-JP': return 'Japanese';
    case 'ko-KR': return 'Korean';
    default: return 'English';
  }
}

function buildPrompt(point: IdentifyPoint, extra?: { window?: string }): string {
  const x = Math.round(Math.min(1000, Math.max(0, point.x)));
  const y = Math.round(Math.min(1000, Math.max(0, point.y)));
  return [
    'You are an object-grounding model. The user clicked one point on the image.',
    `The click position is normalized to a 0-1000 scale: x=${x}, y=${y} (origin top-left).`,
    extra?.window
      ? `Only the region ${extra.window} of the full image is shown here; coordinates are relative to this crop.`
      : '',
    'Identify the single concrete object located at that point.',
    'Return ONLY minified JSON, no markdown fence, no commentary, shaped exactly like:',
    '{"items":[{"label_name":"<name>","label_desc":"<one short phrase>","box_2d":[ymin,xmin,ymax,xmax]}]}',
    'Rules:',
    '- box_2d must be 4 integers on the same 0-1000 scale, order [ymin,xmin,ymax,xmax], tightly around THAT object.',
    '- A box covering the whole picture (or nearly the whole picture) is almost always wrong: pick the object the click is on.',
    `- label_name must be a concrete WHOLE object noun in ${labelLanguageName()} (for example: 大象, 小象, 树, 杯子, 草地).`,
    '- NEVER name a part / region / texture of an object. Forbidden examples: 皮肤, 背部, 耳朵, 尾巴, 腿, 头部, 毛皮, 表面, 质感.',
    '- label_name must be 1-6 words, no punctuation.',
    '- Return 2-3 candidates when several objects overlap at that point, ordered from the most specific object to broader groups.',
    '- If nothing meaningful is at that point, return {"items":[]}',
  ].join('\n');
}

/** 从模型回复里抠出 JSON（容忍 ```json 围栏与前后噪声）。 */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const slice = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function normalizeItems(payload: unknown): IdentifyObjectItem[] {
  const raw = (payload as { items?: unknown } | null)?.items;
  if (!Array.isArray(raw)) return [];
  const out: IdentifyObjectItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const label = typeof record.label_name === 'string' ? record.label_name.trim() : '';
    const box = record.box_2d;
    if (!label || !Array.isArray(box) || box.length !== 4) continue;
    const nums = box.map((value) => Number(value));
    if (nums.some((value) => !Number.isFinite(value))) continue;
    out.push({
      label_name: label,
      label_desc: typeof record.label_desc === 'string' ? record.label_desc : undefined,
      box_2d: normalizeBox2d(nums),
    });
  }
  return out;
}

/**
 * 把模型返回的 `box_2d` 归一化到 **0–1**（官方尺度）。
 *
 * ⚠️ 不同平台给的尺度不一样：官方 Tap2Edit / Gemini 风格是 **0–1000 整千分**，
 *    但有些 OpenAI 兼容视觉模型直接给 0–1（本机实测「土豆」就是这样）。
 *    而官方消费端（`MagicSelectionOverlay`）一律按 0–1 处理
 *    （`top: box_2d[0]*100 + '%'`），所以这里必须统一，否则框会画到 47000% 去。
 *    判据：四个值全在 [0,1] 内 ⇒ 已经是 0–1；否则按 0–1000 除以 1000。
 */
function normalizeBox2d(box: number[]): [number, number, number, number] {
  const clamped = box.map((value) => Math.max(0, Math.min(1000, value)));
  const alreadyUnit = clamped.every((value) => value <= 1);
  const scaled = alreadyUnit ? clamped : clamped.map((value) => value / 1000);
  return [scaled[0], scaled[1], scaled[2], scaled[3]];
}

function errorFor(code: IdentifyObjectErrorCode, message: string): IdentifyObjectResult {
  return { success: false, error: { code, message } };
}

/** 框面积（0–1）。 */
function boxArea(box: readonly number[]): number {
  const [top, left, bottom, right] = box;
  return Math.max(0, bottom - top) * Math.max(0, right - left);
}

function boxContainsPoint(box: readonly number[], point: IdentifyPoint): boolean {
  const x = point.x / 1000;
  const y = point.y / 1000;
  const [top, left, bottom, right] = box;
  /* 留一点余量：模型给的框常有几像素偏移，点击点落在框边上不该被判丢 */
  const padY = Math.max(0.02, (bottom - top) * 0.12);
  const padX = Math.max(0.02, (right - left) * 0.12);
  return y >= top - padY && y <= bottom + padY && x >= left - padX && x <= right + padX;
}

/**
 * 候选筛选 —— 这是「识别到整张图」的直接对策。
 *
 * 现场：点大象身上的时候模型回了一个几乎盖满画面的框（或者把整幅图当成一个元素），
 * 画到卡片上就是「整张图都被框住」。
 * 规则（全部可解释，不含猜）：
 *   1. **包含点击点**的候选优先（不含的只有在没有别的候选时才用）；
 *   2. 面积**从小到大**排（同一处有「大象 / 象群 / 画面」三个候选取最具体的）；
 *   3. 面积 ≥ 0.9 的「整幅图」候选，在有更小候选时直接丢掉。
 */
function pickCandidates(items: IdentifyObjectItem[], point: IdentifyPoint): IdentifyObjectItem[] {
  if (items.length === 0) return items;
  const containing = items.filter((item) => boxContainsPoint(item.box_2d, point));
  const pool = containing.length > 0 ? containing : items;
  const sorted = [...pool].sort((left, right) => boxArea(left.box_2d) - boxArea(right.box_2d));
  const tight = sorted.filter((item) => boxArea(item.box_2d) < 0.9);
  const ordered = tight.length > 0 ? tight : sorted;
  const leftovers = items.filter((item) => !ordered.includes(item));
  return [...ordered, ...leftovers].filter((item, index, all) => all.indexOf(item) === index);
}

/** 框占画面比例过大（≥ 0.45）⇒ 认为是「范围识别得太粗」，值得裁一块重识别一次。 */
const OVERSIZED_BOX_AREA = 0.45;

/** 裁剪窗口：以点击点为心，边长 = 原图的 50%（归一化）。 */
const CROP_WINDOW = 0.5;

interface CropResult {
  dataUrl: string;
  /** 裁剪窗口在**原图**里的归一化范围 `[x0, y0, x1, y1]` */
  window: [number, number, number, number];
}

/** 把原图以点击点为中心裁一块（浏览器 canvas），失败返回 null（CORS 等）。*/
async function cropAroundPoint(imageUrl: string, point: IdentifyPoint): Promise<CropResult | null> {
  if (typeof document === 'undefined') return null;
  try {
    const image = await loadImage(imageUrl);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (!naturalWidth || !naturalHeight) return null;
    const cx = Math.min(1, Math.max(0, point.x / 1000));
    const cy = Math.min(1, Math.max(0, point.y / 1000));
    const half = CROP_WINDOW / 2;
    const x0 = Math.min(1 - CROP_WINDOW, Math.max(0, cx - half));
    const y0 = Math.min(1 - CROP_WINDOW, Math.max(0, cy - half));
    const x1 = Math.min(1, x0 + CROP_WINDOW);
    const y1 = Math.min(1, y0 + CROP_WINDOW);
    const sx = Math.round(x0 * naturalWidth);
    const sy = Math.round(y0 * naturalHeight);
    const sw = Math.max(1, Math.round((x1 - x0) * naturalWidth));
    const sh = Math.max(1, Math.round((y1 - y0) * naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    return { dataUrl: canvas.toDataURL('image/png'), window: [x0, y0, x1, y1] };
  } catch {
    return null;
  }
}

/** 把裁剪图里的框映射回原图归一化坐标。 */
function mapBoxFromCrop(
  box: readonly number[],
  window: readonly [number, number, number, number],
): [number, number, number, number] {
  const [x0, y0, x1, y1] = window;
  const width = x1 - x0;
  const height = y1 - y0;
  return [
    y0 + box[0] * height,
    x0 + box[1] * width,
    y0 + box[2] * height,
    x0 + box[3] * width,
  ];
}

/** 跑一次识别（复用同一套 generateText 调用点）。 */
async function askModel(
  imageUrl: string,
  point: IdentifyPoint,
  window?: { label: string },
): Promise<IdentifyObjectItem[]> {
  const vision = resolveVisionModel();
  if (!vision) return [];
  const reply = await generateText({
    prompt: buildPrompt(point, window ? { window: window.label } : undefined),
    model: vision.ref,
    provider: 'general',
    imageUrls: [imageUrl],
  });
  return normalizeItems(extractJson(reply));
}

/**
 * 在 `imageUrl` 的 `point`（归一化 0–1000）处识别元素。
 *
 * 流程（官方 `Zh.touch2edit` 是云服务，一步到位；MTV 用通用视觉模型，所以要自己补两步保险）：
 *   1. 原图上问一次 —— 提示词要求「具体物体名 + 紧凑框 + 不要整幅图」；
 *   2. 候选筛选：包住点击点、面积从小到大（见 `pickCandidates`）；
 *   3. 如果最紧凑的框**仍然占画面 ≥ 45%**（「识别到整张图」那种），
 *      就以点击点为心裁 50% 窗口再问一次，把框映射回原图 —— 几何上保证框是局部的。
 *
 * @param imageUrl 目标图片地址（本地 `asset:` / `data:` / http 均可，`generateText` 会转成受限 data URL）
 * @param point    归一化点坐标，与官方 `Zh.touch2edit` 的 `point` 同尺度
 */
export async function identifyObject(
  imageUrl: string,
  point: IdentifyPoint,
): Promise<IdentifyObjectResult> {
  if (!imageUrl || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
    return errorFor('BAD_REQUEST', '缺少图片地址或点击坐标');
  }

  const vision = resolveVisionModel();
  if (!vision) return errorFor('NO_VISION_MODEL', NO_MODEL_MESSAGE);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IDENTIFY_TIMEOUT_MS);
  try {
    const items = pickCandidates(await askModel(imageUrl, point), point);
    if (items.length === 0) {
      return errorFor('NO_OBJECT_DETECTED', '该位置没有识别到元素');
    }

    const first = items[0];
    if (boxArea(first.box_2d) < OVERSIZED_BOX_AREA) {
      return { success: true, items };
    }

    /* 范围太粗 ⇒ 裁一块重来。裁不出来（CORS / 非图片）就按原结果返回，不阻断。 */
    const crop = await cropAroundPoint(imageUrl, point);
    if (!crop) return { success: true, items };
    const [x0, y0, x1, y1] = crop.window;
    const localPoint: IdentifyPoint = {
      x: Math.round(((point.x / 1000 - x0) / (x1 - x0)) * 1000),
      y: Math.round(((point.y / 1000 - y0) / (y1 - y0)) * 1000),
    };
    const windowLabel = `[x ${Math.round(x0 * 100)}%-${Math.round(x1 * 100)}%, y ${Math.round(y0 * 100)}%-${Math.round(y1 * 100)}%]`;
    const localItems = pickCandidates(
      await askModel(crop.dataUrl, localPoint, { label: windowLabel }),
      localPoint,
    );
    if (localItems.length === 0) return { success: true, items };
    const remapped = localItems.map((item) => ({
      ...item,
      box_2d: mapBoxFromCrop(item.box_2d, crop.window),
    }));
    /* 裁剪结果永远比整图框更具体 ⇒ 用它；同时把原图那次更泛的候选接在后面当备选。 */
    const merged = [...remapped, ...items].filter((item, index, all) => (
      all.findIndex((entry) => entry.label_name === item.label_name) === index
    ));
    return { success: true, items: merged };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (controller.signal.aborted) {
      return errorFor('SERVER_ERROR', '识别超时，请稍后重试');
    }
    if (/rate|429/i.test(message)) {
      return errorFor('RATE_LIMIT', '识别请求过于频繁，请稍后再试');
    }
    if (/api key|未配置|连接/.test(message)) {
      return errorFor('NO_VISION_MODEL', message);
    }
    return errorFor('MODEL_SERVICE_ERROR', `识别服务出错：${message}`);
  } finally {
    clearTimeout(timer);
  }
}
