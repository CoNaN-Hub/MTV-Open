/**
 * `view_media` —— 官方「看图/看片」工具的**客户端生产者**（覆盖表：agent 看不到图 ⇒ 只会回复
 * 「当前画布工具只返回节点元数据…请直接上传该图片」）。
 *
 * 官方事实（live `vendor-pkg-canvas-ChpWx5JY.js`）：
 *   · 工具名在官方工具表里：`xV = new Set(["view_media"])`（@2393308）；同族还有 `analyze_media`
 *     （都出现在 `cNe` 工具名数组 @431517 里）。
 *   · 结果形状：`lNe(t)`（@428841）= `response.images[] / response.videos[]` 的 `ref`（去掉 `node/` 前缀、去重）
 *     —— MTV 已逐字移植为 `toolEventNodeIds.viewMediaRefs`，`agentToolLabels` 用它渲染
 *     「已查看 N 项内容」+ 行尾节点缩略芯片。
 *   · **像素**由服务端在下一轮塞进模型上下文（客户端产物里看不到这一步）⇒ MTV 的等价物 = 本工具
 *     把 data URL 交到 `AgentToolExecutionResult.modelImages`，由 `agentRoundExecutor` 回灌。
 *
 * 因此本工具同时产出两样东西：
 *   ① `officialResponse = { images: [{ ref: "node/<id>" }] }` ⇒ 走既有的官方展示链（分组行 + 缩略芯片）；
 *   ② `modelImages = [{ url: <dataURL> }]` ⇒ 让**视觉模型真的看到画面**（这是本条用户报告的核心）。
 *
 * ⚠️ 与官方的一处诚实偏移：官方 `view_media` 也能看视频；MTV 的模型请求是**静态图**内容块
 * ⇒ 视频节点只报告「已定位但未取帧」，不假装能看（要帧就得先抽帧，属另一个功能）。
 */
import { useAppStore } from '../../../store/useAppStore';
import {
  fetchImageForCrop,
  readFileToDataUrl,
  resolveIndexedAssetPath,
} from '../../fileService';
import { bestNodeThumb } from '../../../components/nodes/shared/mentionEditorDom';
import { isLocalMediaUrl, localMediaUrlToPath } from '../../../utils/mediaUrl';
import { registerAgentTool } from '../toolRegistry';
import type { AgentModelImage } from '../toolRegistry';

/** 一次调用最多取几张（官方那侧也有上限；这里取 4，控制上下文体积）。 */
const MAX_IMAGES_PER_CALL = 4;
/** 回灌给模型的**总**字符预算（data URL）。四张原图很容易把请求体顶到十几 MB，
 *  很多 OpenAI 兼容网关会直接 4xx（用户实测 `处理失败: openai_error`）⇒ 这里总量兜底。 */
const MAX_TOTAL_DATA_URL_CHARS = 4_000_000;
/** 单张回灌前的最大边长（超过就等比缩到这么大再编码）。 */
const MAX_IMAGE_EDGE_PX = 1536;
/** 缩放后的编码质量（JPEG）。 */
const RESIZE_QUALITY = 0.85;
/** 每个候选来源最多读几次（瞬时失败重试）。 */
const READ_ATTEMPTS = 3;
/** 重试间隔（线性退避：250ms / 500ms）。 */
const READ_RETRY_DELAY_MS = 250;

/**
 * 把 data URL 缩到 `MAX_IMAGE_EDGE_PX` 以内并重新编码（JPEG），显著降低请求体体积。
 * 环境不支持（jsdom / 没有 canvas）或解码失败时**原样返回**，绝不因此让工具失败。
 */
async function downscaleDataUrl(dataUrl: string): Promise<string> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return dataUrl;
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_IMAGE_EDGE_PX && blob.size <= 600_000) {
      bitmap.close?.();
      return dataUrl;
    }
    const scale = Math.min(1, MAX_IMAGE_EDGE_PX / longest);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close?.();
      return dataUrl;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const jpeg = canvas.toDataURL('image/jpeg', RESIZE_QUALITY);
    return jpeg.length < dataUrl.length ? jpeg : dataUrl;
  } catch {
    return dataUrl;
  }
}

interface ViewMediaInput {
  /** 要看像素的节点 id（画布节点）。 */
  node_ids: string[];
}

interface ResolvedMedia {
  nodeId: string;
  title: string;
  kind: 'image' | 'video';
  dataUrl?: string;
  reason?: string;
  /** 该失败是否值得重试（读盘/协议就绪这类瞬时失败）。 */
  retryable?: boolean;
}

function nodeTitle(data: Record<string, unknown>, nodeId: string): string {
  const label = data.label ?? data.title ?? data.display_name;
  return typeof label === 'string' && label.trim() ? label.trim() : nodeId;
}

/** 常见的图片地址键（按优先级）。`bestNodeThumb` 也在其中（聊天缩略图走的就是它）。 */
const IMAGE_SOURCE_KEYS = [
  'imageUrl', 'thumbnailUrl', 'filePath', 'localPath', 'src', 'url',
  'assetUrl', 'posterUrl', 'thumbUrl', 'previewUrl', 'output',
] as const;

/** 认得出是「图片源」的字符串：data URL / http(s) / asset|blob|tauri|file 协议 / **绝对**路径。
 *
 *  ⚠️ 第 58 轮修的真实 bug：旧版还认「以图片扩展名结尾」的**相对文件名**
 *  （例：`5ef6f3b65d85….jpg`，来自节点数据的 `relativePath`）。那不是可读地址 ——
 *  `readFileToDataUrl('5ef6f3….jpg')` 找不到文件 ⇒ 抛错 ⇒ 工具报「图片读取失败」。
 *  现场取证（CDP → IndexedDB `projects` 72269479 的 `#28` 节点）：
 *  `data.relativePath = "5ef6f3b65d85…--c8c6….jpg"`（相对）、
 *  `data.assetId = "9cab8502-…"`（可经资产索引换回绝对路径）、
 *  `data.imageUrl = "http://asset.localhost/E%3A%2F…jpg"`（可读）。
 *  ⇒ 这里只收「有协议」或「绝对路径」的字符串；相对文件名一律不算候选。 */
function looksLikeImageSource(value: string): boolean {
  if (/^data:image\//i.test(value)) return true;
  if (/^(https?|asset|blob|tauri|file):/i.test(value)) return true;
  const withoutQuery = value.split('?')[0] ?? '';
  const isAbsolutePath = /^[a-z]:[/\\]/i.test(withoutQuery) || withoutQuery.startsWith('/');
  return isAbsolutePath && /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(withoutQuery);
}

/** 失败时把该节点**真实存在的字段名**回报给模型（下一次就能一眼看出该补哪个键）。 */
function describeDataKeys(data: Record<string, unknown>): string {
  return Object.keys(data).slice(0, 16).join('、') || '(空)';
}

/**
 * 一个节点的**全部候选图片来源**（按可靠性排序）：
 *   ① `data.assetId` ⇒ 资产索引里的**绝对路径**（身份不受字段缺失/改名影响；官方 `assetId` 语义）；
 *   ② `bestNodeThumb(data)`（聊天缩略图同一条解析）；
 *   ③ 已知键；
 *   ④ 深度受限扫描（≤4 层；只认有协议或绝对路径的字符串）。
 * ⚠️ 第 58 轮：旧版只取**第一个**候选（常常是 `relativePath` 这种相对文件名）⇒ 一次读失败就整体失败；
 * 同时那次失败在 UI 上只显示成「查看媒体失败」，看不出原因。现在逐个试、把失败明细带回去。
 */
async function imageSourceCandidates(data: Record<string, unknown>): Promise<string[]> {
  const candidates: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed || !looksLikeImageSource(trimmed) || candidates.includes(trimmed)) return;
    candidates.push(trimmed);
  };

  const assetId = typeof data.assetId === 'string' ? data.assetId.trim() : '';
  if (assetId) {
    try {
      const indexed = await resolveIndexedAssetPath(assetId);
      if (indexed) push(indexed);
    } catch {
      /* 索引不可用（非 Tauri / 未登记）⇒ 继续用后面的候选 */
    }
  }

  push(bestNodeThumb(data as { imageUrl?: unknown; thumbnailUrl?: unknown; filePath?: unknown }));
  for (const key of IMAGE_SOURCE_KEYS) push(data[key]);

  const queue: Array<{ value: unknown; depth: number }> = [{ value: data, depth: 0 }];
  let visited = 0;
  while (queue.length > 0 && visited < 400) {
    const current = queue.shift() as { value: unknown; depth: number };
    visited += 1;
    /* 字符串先判（**再**看深度）——否则「对象→数组→数组→对象→字符串」这种常见嵌套
       （`historyLocalQueues[0][0].url`）里的值会在到达前就被深度门挡掉。 */
    if (typeof current.value === 'string') {
      push(current.value);
      continue;
    }
    if (current.depth >= 4) continue;
    if (Array.isArray(current.value)) {
      for (const item of current.value.slice(0, 12)) queue.push({ value: item, depth: current.depth + 1 });
      continue;
    }
    if (current.value && typeof current.value === 'object') {
      for (const nested of Object.values(current.value as Record<string, unknown>).slice(0, 24)) {
        queue.push({ value: nested, depth: current.depth + 1 });
      }
    }
  }
  return candidates;
}

const sleep = (ms: number) => new Promise<void>((resolve) => { globalThis.setTimeout(resolve, ms); });

/** 逐个候选读；每个候选最多试 `READ_ATTEMPTS` 次（文件锁 / asset 协议刚就绪这类**瞬时**失败）。
 *  现场取证：同一个 `view_media(node-wxw3ghkpq)` 输入，一次 `VIEW_MEDIA_NO_PIXELS`、随后两次成功
 *  ⇒ 读盘失败是瞬时性的，重试是必要的。 */
async function readFirstAvailable(candidates: string[]): Promise<{ dataUrl?: string; errors: string[] }> {
  const errors: string[] = [];
  for (const source of candidates) {
    for (let attempt = 0; attempt < READ_ATTEMPTS; attempt += 1) {
      const outcome = await toDataUrlDetailed(source);
      if (outcome.dataUrl) return { dataUrl: outcome.dataUrl, errors };
      if (attempt === 0) errors.push(`${source.slice(0, 90)}：${outcome.error ?? '读取失败'}`);
      if (attempt + 1 < READ_ATTEMPTS) await sleep(READ_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  return { errors };
}

/** `blob:` → data URL（渲染进程内取，jsdom 也有 FileReader）。 */
function blobToDataUrl(blob: Blob): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    } catch {
      resolve(undefined);
    }
  });
}

/**
 * 任何来源 → data URL（再交给 `downscaleDataUrl` 压缩）。
 *
 * ⚠️ **顺序很重要**（用户实测「节点有缩略图、`view_media` 却报图片读取失败」的根因之一）：
 * `fetchImageForCrop` 对**本地媒体**返回的是 `asset://` URL（`getAssetUrlFromPath`），**不是** data URL；
 * 旧代码只认 `data:` 前缀 ⇒ 本地节点一律判失败。正确做法是：
 *   ① 本地媒体（裸路径 / `asset:` / `file:` / `blob:`）**先读盘**；
 *   ② 只有真正的远程 `http(s)` 才走 Rust 下载（绕 CORS）；
 *   ③ 万一 ② 回的是本地 asset URL，再退回读盘。
 *
 * 返回 `{ dataUrl }` 或 `{ error }`（**带失败原因**，供工具把真实原因回报给模型/用户；
 * 旧版只返回 `undefined`，用户端只能看到一句「查看媒体失败」）。
 */
async function toDataUrlDetailed(source: string): Promise<{ dataUrl?: string; error?: string }> {
  try {
    if (/^data:image\//i.test(source)) return { dataUrl: await downscaleDataUrl(source) };
    const localPath = localMediaUrlToPath(source);
    const isLocal = !!localPath || isLocalMediaUrl(source) || !/^https?:/i.test(source);
    if (isLocal) {
      const read = await readFileToDataUrl(source);
      if (read?.startsWith('data:')) return { dataUrl: await downscaleDataUrl(read) };
      if (/^blob:/i.test(source)) {
        const dataUrl = await blobToDataUrl(await (await fetch(source)).blob());
        if (dataUrl) return { dataUrl: await downscaleDataUrl(dataUrl) };
        return { error: 'blob 读取失败' };
      }
      return { error: read ? '读到的不是 data URL' : '读盘返回空' };
    }
    const fetched = await fetchImageForCrop(source);
    if (fetched?.startsWith('data:')) return { dataUrl: await downscaleDataUrl(fetched) };
    if (fetched) {
      const read = await readFileToDataUrl(fetched);
      if (read?.startsWith('data:')) return { dataUrl: await downscaleDataUrl(read) };
      return { error: read ? '远程下载后读到的不是 data URL' : '远程下载后读盘返回空' };
    }
    return { error: '远程下载未返回内容' };
  } catch (error) {
    return { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
}

export function registerViewMediaAgentTools(): Array<() => void> {
  return [registerAgentTool<ViewMediaInput>({
    id: 'view_media',
    title: '查看画面',
    description: [
      '把画布上**指定节点**的图片取回给你**实际查看**（像素会随工具结果一并提供）。',
      '需要判断主体、构图、光线、色彩、材质、表情或瑕疵时**必须**先调用它 —— ',
      '只调用 canvas_query 只会拿到元数据，看不到画面。',
      '一次最多 4 项；视频节点只能定位、不能取帧。',
    ].join(''),
    effect: 'read',
    inputSchema: {
      type: 'object',
      required: ['node_ids'],
      additionalProperties: false,
      properties: {
        node_ids: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_IMAGES_PER_CALL,
          items: { type: 'string', minLength: 1, maxLength: 180 },
        },
      },
    },
    summarizeInput: (input) => `查看 ${input.node_ids?.length ?? 0} 项内容`,
    execute: async (_context, input) => {
      const ids = Array.from(new Set((input.node_ids ?? []).map((id) => id.trim()).filter(Boolean)))
        .slice(0, MAX_IMAGES_PER_CALL);
      if (ids.length === 0) {
        return {
          status: 'error',
          summary: '查看画面失败：没有指定节点',
          modelContent: 'view_media 需要至少一个 node_id。',
          retryable: false,
          errorCode: 'VIEW_MEDIA_NO_NODES',
        };
      }
      const nodes = useAppStore.getState().nodes;
      const resolved: ResolvedMedia[] = [];
      const missing: string[] = [];
      for (const nodeId of ids) {
        /* 每次都用**最新**的 store 快照找节点：agent 轮次里可能刚切过项目 / 加载过画布，
           旧快照会把「节点存在」误判成不存在（现场那两次 `VIEW_MEDIA_NO_PIXELS` 的可能原因之一）。 */
        const nodesNow = useAppStore.getState().nodes;
        const node = nodesNow.find((item) => item.id === nodeId) ?? nodes.find((item) => item.id === nodeId);
        if (!node) {
          missing.push(nodeId);
          continue;
        }
        const data = (node.data ?? {}) as Record<string, unknown>;
        const type = typeof data.type === 'string' ? data.type : '';
        const title = nodeTitle(data, nodeId);
        if (/video/i.test(type) || typeof data.videoUrl === 'string') {
          resolved.push({ nodeId, title, kind: 'video', reason: '客户端模型请求只能带静态图，未取视频帧' });
          continue;
        }
        const candidates = await imageSourceCandidates(data);
        if (candidates.length === 0) {
          resolved.push({
            nodeId,
            title,
            kind: 'image',
            reason: `该节点没有可读的图片地址（现有字段：${describeDataKeys(data)}）`,
          });
          continue;
        }
        const { dataUrl, errors } = await readFirstAvailable(candidates);
        if (!dataUrl) {
          resolved.push({
            nodeId,
            title,
            kind: 'image',
            reason: `图片读取失败或体积超出上限（候选 ${candidates.length} 个，逐个尝试 ${READ_ATTEMPTS} 次均失败：${errors.join(' | ') || '无可用候选'}）`,
            retryable: true,
          });
          continue;
        }
        resolved.push({ nodeId, title, kind: 'image', dataUrl });
      }

      const withPixels = resolved.filter((item) => !!item.dataUrl);
      const failed = resolved.filter((item) => !item.dataUrl);
      if (withPixels.length === 0) {
        const reason = failed.map((item) => `${item.title}：${item.reason ?? '不可用'}`).join('；')
          || `节点不存在：${missing.join('、')}`;
        return {
          status: 'error',
          summary: '查看画面失败：没有可用的图片',
          modelContent: `view_media 没能取到像素（${reason}）。`,
          /* 读盘/协议就绪这类**瞬时**失败允许运行时重试（现场同一输入一次失败、两次成功）。 */
          retryable: failed.some((item) => item.retryable === true),
          errorCode: 'VIEW_MEDIA_NO_PIXELS',
        };
      }

      const modelImages: AgentModelImage[] = [];
      const includedNodeIds = new Set<string>();
      let totalChars = 0;
      for (const item of withPixels) {
        const url = item.dataUrl as string;
        if (totalChars + url.length > MAX_TOTAL_DATA_URL_CHARS) {
          /* 总量超预算：这一张不回灌（文本结果里仍然报告它被看到了）。 */
          failed.push({ ...item, reason: '图片体积超出本轮预算，未随结果回灌' });
          continue;
        }
        totalChars += url.length;
        includedNodeIds.add(item.nodeId);
        modelImages.push({ url, label: item.title });
      }
      const pixelItems = withPixels.filter((item) => includedNodeIds.has(item.nodeId));
      const payload = {
        images: pixelItems.map((item) => ({
          ref: `node/${item.nodeId}`,
          title: item.title,
          mime_type: /^data:([^;]+)/i.exec(item.dataUrl as string)?.[1] ?? 'image/png',
        })),
        unavailable: [...failed.map((item) => ({ ref: `node/${item.nodeId}`, reason: item.reason })), ...missing.map((id) => ({ ref: id, reason: '节点不存在' }))],
      };
      return {
        status: 'success',
        summary: `已查看 ${withPixels.length} 项内容`,
        modelContent: JSON.stringify(payload),
        /* 官方展示链：`lNe` 读 `response.images[].ref` ⇒ 分组行「已查看 N 项内容」+ 缩略芯片。 */
        officialResponse: { images: payload.images.map((image) => ({ ref: image.ref })) },
        modelImages,
      };
    },
    authorize: (context, input) => {
      const nodes = useAppStore.getState().nodes;
      const ids = input.node_ids ?? [];
      const known = ids.filter((id) => nodes.some((node) => node.id === id));
      if (known.length === 0) return { allowed: false, reason: '指定的节点不存在' };
      return useAppStore.getState().currentProjectId === context.projectId
        ? { allowed: true }
        : { allowed: false, reason: '只能查看当前项目的画布节点' };
    },
  })];
}
