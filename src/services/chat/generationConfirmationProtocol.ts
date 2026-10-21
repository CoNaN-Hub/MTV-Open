/**
 * `generation_confirmation` 协议层（纯函数）—— live 官方**逐字移植**。
 *
 * 权威源码：`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`（单行压缩 ESM，4,482,523 chars）。
 * 本文件所有符号均在该 chunk 内定义（无需跨 chunk），偏移为本文件实测的 **char 偏移**
 * （`fs.readFileSync(file,'utf8')` 后 `.slice(off,off+n)` 可直接复现）。
 *
 * | 官方本地名 | 定义偏移 | 角色 |
 * |---|---|---|
 * | `RM` / `aF` / `ZZe` | 2213552 / 2213590 / 2213626 | `tapnow.generation_confirmation.presentation.v1` / `tapnow.generation_request.v1` / `tapnow.animatic_storyboard_generation_request.v1` |
 * | `xse` / `jZe` | 2213663 / 2213698 | 显式字段白名单（wire → camel） |
 * | `As` | 2213700 | 非数组对象守卫 |
 * | `ra` | 2213737 | `typeof e==="string"?e:""` |
 * | `Gr` / `xE` / `DM` / `wg` | 2213755 / 2213787 / 2213815 / 2213843 | 字符串/数字/布尔/对象取值（类型不符返回 `undefined`） |
 * | `yE` | 2213870 | `request_kind` 守卫 |
 * | `eJe` | 2213895 | `tool_name` → requestKind |
 * | `yse` | 2213932 | `confirmation_kind` 非 `generation_submit` 守卫 |
 * | `sl` / `bse` | 2213963 / 2214039 | 字符串数组取值 / `element_refs` |
 * | `$1` | 2201826 邻域 | `element/<id>` ref 解析（本文件按官方结构保留；见下方「未落地」注释） |
 * | `vse` / `rJe` / `iJe` | 2217585 / 2217610 / 2217645 | `node/` 前缀剥离 / reference source 名 / mediaKind |
 * | `bE` / `wse` / `sJe` / `aJe` | 2217705 / 2217878 / 2217030 / 2217040 | `references` → normalized / `*_sources` / `reference_node_ids` |
 * | `tJe` / `nJe` | 2214470 / 2214560 | `normalized_references` 解析 |
 * | `lF` | 2214660 | `fields` 白名单过滤 |
 * | `cF` / `dF` / `uF` | 2215087 / 2215145 / 2215197 | request_json 载体 / 载体 requestKind / 载体守卫 |
 * | `mJe` / `oJe` / `uJe` / `pJe` | 2223100 / 2214985 / 2222232 / 2222758 | 载体 → 规范 params（三级回退） |
 * | `Sse` | 2221593 | presentation / request_json → params |
 * | `Cse` | 2221190 | video/audio 子对象回填 |
 * | `Oc` / `gI` / `BB` | 2216642 / 2216677 / 2216728 | params 写入器（string / number / boolean） |
 * | `Cl` / `xI` / `tm` / `xy` | 2217294 / 2217332 / 2217370 / 2217405 | `GB` 用的取值器 |
 * | `yI` / `cJe` / `dJe` | 2217436 / 2217035 / 2220955 | estimate_params |
 * | `xse` / `jZe` | 见上 | 白名单 |
 * | `AZe` / `kZe` / `IZe` | 2202031 / 2201966 / 2202299 | wire→camel 映射 |
 * | `VB` | 2222440 | 把 `params` / `requests[0]` 合进载体 |
 * | `fJe` / `hJe` | 2223178 / 2223220 | 已答 action / modifications |
 * | `gJe` | 2223368 | 把 modifications 叠加到 params |
 * | `bI` | 2223650 | model/videoMode/audioScene 归一化 |
 * | `xJe` | 2223844 | 两条 viewModel 请求是否「同配置」的指纹 |
 * | `Nse` | 2224829 | 单条 confirmation 载体 → 单条 viewModel |
 * | `Tse` | 2225040 | `detail.items[]` 提取 |
 * | `yJe` | 2225316 | **legacy** 解析器（单条） |
 * | `bJe` | 2225676 | **v1** 解析器（批量 + 一致性校验） |
 * | `Qet` | 2311252 邻域（@2310877 之后） | 回退卡 `Zet` 的 viewModel |
 * | `UZe` | 2205561 | `protocolContext` |
 *
 * ⚠️ **本轮未落地的官方数据表**（见报告「诚实清单」）：
 *   - `mZe` / `fZe` / `xZe`（`@2198xxx` 的 image/video/audio 模型目录）与 `hE`/`cse`/`nF`/`lJe`
 *     依赖的 `jt` 视频模式枚举 —— MTV 没有对应的 wireName↔modelId 目录，故
 *     `resolveModelHint` / `resolveVideoMode` 按官方**算法结构**保留，但数据表为空
 *     ⇒ 一切 `model_name` / `mode` 解析为 `{status:"unknown"}`。
 *   - `$1`（`element/<id>` 解析）同理：本文件对 `element_refs` 只做类型守卫，不产出 `elementId`。
 *     两处均在函数体内以 `官方实体未解析，待替换` 标注。
 */
/* ------------------------------------------------------------------ *
 * 常量（官方 @2213552 / @2213663 / @2213698）
 * ------------------------------------------------------------------ */

export const RM_PRESENTATION_V1 = 'tapnow.generation_confirmation.presentation.v1';
export const AF_GENERATION_REQUEST_V1 = 'tapnow.generation_request.v1';
export const ZZE_ANIMATIC_STORYBOARD = 'tapnow.animatic_storyboard_generation_request.v1';

/** 官方 `xse`（逐字）。 */
const xse = [
  'model_name',
  'prompt',
  'times',
  'aspect_ratio',
  'image_size',
  'quality',
  'duration',
  'resolution',
  'generate_audio',
  'mode',
] as const;

/** 官方 `jZe`（逐字）。 */
export const JZE_FIELD_WHITELIST = [
  'model_name',
  'prompt',
  'times',
  'aspect_ratio',
  'image_size',
  'quality',
  'duration',
  'resolution',
  'generate_audio',
  'mode',
  'element_refs',
  'references',
  'voice',
  'lyrics',
  'stability',
  'instrumental',
  'loop',
  'prompt_influence',
  'subtitle',
  'audio_format',
] as const;

/** 官方 `kZe`（逐字）。 */
const kZe: Record<string, string> = {
  model_name: 'model',
  prompt: 'prompt',
  times: 'times',
  aspect_ratio: 'aspectRatio',
  image_size: 'imageSize',
  quality: 'quality',
  duration: 'duration',
  resolution: 'resolution',
  generate_audio: 'generateAudio',
  voice: 'voice',
  lyrics: 'lyrics',
  stability: 'stability',
  instrumental: 'instrumental',
  loop: 'loop',
  prompt_influence: 'promptInfluence',
  subtitle: 'subtitle',
  audio_format: 'audioFormat',
};

/** 官方 `_se`（音频子字段类型表，逐字）。 */
const _se: ReadonlyArray<readonly [string, 'string' | 'number' | 'boolean']> = [
  ['mode', 'string'],
  ['duration', 'number'],
  ['voice', 'string'],
  ['stability', 'number'],
  ['lyrics', 'string'],
  ['instrumental', 'boolean'],
  ['loop', 'boolean'],
  ['prompt_influence', 'number'],
  ['subtitle', 'boolean'],
  ['audio_format', 'string'],
  ['sample_rate', 'number'],
  ['speech_rate', 'number'],
  ['pitch_rate', 'number'],
  ['loudness_rate', 'number'],
];

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

export type GenerationRequestKind = 'image' | 'video' | 'audio';

/** 官方 `bI` 的产物：`model` / `videoMode` / `audioScene`。 */
export type KnownUnknownEntity = { status: 'known'; value: string | null } | { status: 'unknown'; value: string | null } | Record<string, unknown>;

/**
 * 官方 `GB`（@2227380 邻域）归一化**输出**的 params 形状。
 *
 * ⚠️ 逐字事实（主 agent 复核）：`GB` 等号**左边**一律 camelCase，snake_case 只出现在
 * 等号**右边**（读取原始输入 `e` 的键）。例：
 * ```js
 * o.referenceNodeIds      = sl(e,"reference_node_ids"),
 * o.normalizedReferences  = tJe(e,"normalized_references") ?? nJe(e),
 * o.elementRefs           = bse(e,"element_refs");
 * ```
 * 官方消费方读的也是 camelCase（`Jet`/`ett`：`d.normalizedReferences`、`Y.params.referenceNodeIds`）。
 */
export type GenerationParams = Record<string, unknown> & {
  prompt?: string;
  model?: KnownUnknownEntity | null;
  videoMode?: KnownUnknownEntity | null;
  audioScene?: KnownUnknownEntity | null;
  referenceNodeIds?: string[];
  referenceImageSources?: string[];
  referenceVideoSources?: string[];
  referenceAudioSources?: string[];
  normalizedReferences?: NormalizedReference[];
  elementRefs?: Array<{ elementId: string; alias: string }>;
  estimateParams?: Record<string, unknown>;
};

/**
 * **原始载体**（`detail.request_json` / `requests[0]` / `tapnow.generation_request.v1`）的 params 形状 ——
 * 这一侧才是 snake_case。官方在 `GB` 之前的所有 helper（`wse` / `sJe` / `aJe` / `VB` / `tJe` / `nJe` /
 * `gJe` / `UZe`）都作用于它。
 */
export type RawGenerationParams = Record<string, unknown> & {
  references?: unknown[];
  normalized_references?: NormalizedReference[];
  reference_node_ids?: string[];
  reference_image_sources?: string[];
  reference_video_sources?: string[];
  reference_audio_sources?: string[];
  model_name?: string;
  mode?: string;
};

export type NormalizedReference = {
  source: string;
  nodeId?: string;
  declaredMediaKind?: 'image' | 'video' | 'audio';
};

export type ProtocolContext = {
  originalReferences?: unknown[];
  originalModelName?: string;
  originalVideoMode?: string;
  originalAudioScene?: string;
};

export type GenerationConfirmationItem = {
  index: number;
  requestKind: GenerationRequestKind;
  params: GenerationParams;
  originalParams: GenerationParams;
  presentFields: string[];
  protocolContext: ProtocolContext;
};

/** 官方 `Nse` 的产物（**不含 `index`**；`index` 由 `bJe` 在批量路径上补）。 */
export type NormalizedConfirmationItem = Omit<GenerationConfirmationItem, 'index'>;

export type GenerationConfirmationSingleViewModel = {
  confirmationId: string;
  requestKind: GenerationRequestKind;
  params: GenerationParams;
  originalParams: GenerationParams;
  presentFields: string[];
  protocolContext: ProtocolContext;
};

export type GenerationConfirmationBatchViewModel = {
  confirmationId: string;
  requestKind: GenerationRequestKind;
  items: GenerationConfirmationItem[];
};

export type GenerationConfirmationViewModel =
  | GenerationConfirmationSingleViewModel
  | GenerationConfirmationBatchViewModel;

export type GenerationFallbackViewModel = {
  confirmationId: string;
  requestKind: string;
};

/** 官方 `Tse` 的载体类型（`detail.items` 元素）。 */
type CarrierRecord = Record<string, unknown>;

/* ------------------------------------------------------------------ *
 * 基础取值器（官方 @2213700 邻域，逐字）
 * ------------------------------------------------------------------ */

/** 官方 `As`：非 null、object、非数组。 */
function As(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 官方 `ra`。 */
export function ra(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 官方 `Gr`：字符串字段。 */
function Gr(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

/** 官方 `xE`：有限数字字段。 */
function xE(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** 官方 `DM`：布尔字段。 */
function DM(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

/** 官方 `wg`：对象字段。 */
function wg(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];
  return As(value) ? value : null;
}

/** 官方 `yE`。 */
function yE(value: unknown): value is GenerationRequestKind {
  return value === 'image' || value === 'video' || value === 'audio';
}

/** 官方 `eJe`。 */
function eJe(value: unknown): GenerationRequestKind | null {
  return value === 'gen_image'
    ? 'image'
    : value === 'gen_video'
      ? 'video'
      : value === 'gen_audio'
        ? 'audio'
        : null;
}

/** 官方 `yse`。 */
function yse(record: Record<string, unknown>): boolean {
  return typeof record.confirmation_kind === 'string' && record.confirmation_kind !== 'generation_submit';
}

/** 官方 `sl`：字符串数组字段。 */
function sl(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter((item): item is string => typeof item === 'string');
  return filtered.length > 0 ? filtered : undefined;
}

/** 官方 `$1`：`element/<id>` → `{kind,id}`。 */
function parseElementRef(ref: string): { kind: 'element' | 'node'; id: string } | undefined {
  const trimmed = ref.trim();
  if (!trimmed) return undefined;
  const slash = trimmed.indexOf('/');
  if (slash < 0) return undefined;
  const kind = trimmed.slice(0, slash);
  const id = trimmed.slice(slash + 1).trim();
  if (!id) return undefined;
  /* 官方实体未解析，待替换：`$1` 的完整 kind 判定（`element` / `node`）在
     `@2201826` 邻域，本轮只保留 `element` 分支所需的最小结构。 */
  if (kind !== 'element' && kind !== 'node') return undefined;
  return { kind, id };
}

/** 官方 `bse`：`element_refs`。 */
function bse(record: Record<string, unknown>, key: string): Array<{ elementId: string; alias: string }> | undefined {
  const value = record[key];
  if (!Array.isArray(value)) return undefined;
  const out = value.flatMap((item) => {
    if (!As(item)) return [];
    if (typeof item.ref !== 'string') return [];
    const parsed = parseElementRef(item.ref);
    if (parsed?.kind !== 'element') return [];
    const alias = typeof item.alias === 'string' ? item.alias : '';
    return [{ elementId: parsed.id, alias }];
  });
  return out.length > 0 ? out : undefined;
}

/** 官方 `vse`。 */
function vse(ref: string): string | undefined {
  const trimmed = ref.trim();
  return (trimmed.startsWith('node/') && trimmed.slice(5).trim()) || undefined;
}

/** 官方 `rJe`。 */
function rJe(record: Record<string, unknown>, index: number): string {
  return (
    (Gr(record, 'url') ?? Gr(record, 'src') ?? Gr(record, 'uri') ?? Gr(record, 'ref'))?.trim()
    || `reference-${index}`
  );
}

/** 官方 `iJe`。 */
function iJe(record: Record<string, unknown>): 'image' | 'video' | 'audio' | null {
  const kind = (Gr(record, 'media_kind') ?? Gr(record, 'mediaKind') ?? Gr(record, 'kind') ?? Gr(record, 'type'))
    ?.trim()
    .toLowerCase();
  return kind === 'image' || kind === 'video' || kind === 'audio' ? kind : null;
}

/** 官方 `bE`：`references` → normalized references。 */
function bE(record: Record<string, unknown>): NormalizedReference[] | undefined {
  const references = record.references;
  if (!Array.isArray(references)) return undefined;
  return references.map((item, index) => {
    if (!As(item)) {
      return { source: typeof item === 'string' && item.trim() ? item.trim() : `reference-${index}` };
    }
    const source = rJe(item, index);
    const nodeId = vse(Gr(item, 'ref') ?? source);
    const declaredMediaKind = iJe(item) ?? undefined;
    return {
      source,
      ...(nodeId ? { nodeId } : {}),
      ...(declaredMediaKind ? { declaredMediaKind } : {}),
    };
  });
}

/** 官方 `wse`：按 mediaKind 拆成三个 `*_sources`。 */
function wse(record: Record<string, unknown>): Record<string, string[]> {
  const normalized = bE(record);
  if (!normalized) return {};
  const images: string[] = [];
  const videos: string[] = [];
  const audios: string[] = [];
  normalized.forEach((item) => {
    if (item.declaredMediaKind === 'image') images.push(item.source);
    if (item.declaredMediaKind === 'video') videos.push(item.source);
    if (item.declaredMediaKind === 'audio') audios.push(item.source);
  });
  return {
    ...(images.length > 0 ? { reference_image_sources: images } : {}),
    ...(videos.length > 0 ? { reference_video_sources: videos } : {}),
    ...(audios.length > 0 ? { reference_audio_sources: audios } : {}),
  };
}

/** 官方 `sJe`：从 `references[].ref` 里收集 `node/` id。 */
function sJe(record: Record<string, unknown>): string[] | undefined {
  const references = record.references;
  if (!Array.isArray(references)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of references) {
    if (!As(item)) continue;
    const ref = item.ref;
    if (typeof ref !== 'string') continue;
    const trimmed = ref.trim();
    if (!trimmed.startsWith('node/')) continue;
    const id = trimmed.slice(5).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length > 0 ? out : undefined;
}

/** 官方 `aJe`（导出供上层复用；`bJe` 路径不经过它）。 */
export function aJe(target: Record<string, unknown>, source: Record<string, unknown>): void {
  if (Array.isArray(source.references)) target.references = [...source.references];
  const normalized = bE(source);
  if (normalized) target.normalized_references = normalized;
  const nodeIds = sJe(source);
  if (nodeIds && !sl(target, 'reference_node_ids')) target.reference_node_ids = nodeIds;
  const sources = wse(source);
  if (sources.reference_image_sources && !sl(target, 'reference_image_sources')) {
    target.reference_image_sources = sources.reference_image_sources;
  }
  if (sources.reference_video_sources && !sl(target, 'reference_video_sources')) {
    target.reference_video_sources = sources.reference_video_sources;
  }
  if (sources.reference_audio_sources && !sl(target, 'reference_audio_sources')) {
    target.reference_audio_sources = sources.reference_audio_sources;
  }
}

/** 官方 `tJe`：`normalized_references` 解析。 */
function tJe(record: Record<string, unknown>, key: string): NormalizedReference[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    if (!As(item) || typeof item.source !== 'string') return [];
    const source = item.source.trim();
    if (!source) return [];
    const nodeId = typeof item.nodeId === 'string' && item.nodeId.trim() ? item.nodeId.trim() : undefined;
    const declaredMediaKind = item.declaredMediaKind === 'image' || item.declaredMediaKind === 'video'
      || item.declaredMediaKind === 'audio'
      ? item.declaredMediaKind
      : undefined;
    return [{
      source,
      ...(nodeId ? { nodeId } : {}),
      ...(declaredMediaKind ? { declaredMediaKind } : {}),
    }];
  });
}

/** 官方 `nJe`：`reference_*_sources` + `reference_node_ids` → normalized references。 */
function nJe(record: Record<string, unknown>): NormalizedReference[] {
  const out: NormalizedReference[] = [];
  const push = (key: string, kind: 'image' | 'video' | 'audio') => {
    for (const source of sl(record, key) ?? []) {
      const nodeId = vse(source);
      out.push({ source, ...(nodeId ? { nodeId } : {}), declaredMediaKind: kind });
    }
  };
  push('reference_image_sources', 'image');
  push('reference_video_sources', 'video');
  push('reference_audio_sources', 'audio');
  const nodeIds = sl(record, 'reference_node_ids') ?? [];
  if (out.length === 0) return nodeIds.map((id) => ({ source: `node/${id}`, nodeId: id }));
  const covered = new Set(out.flatMap((item) => (item.nodeId ? [item.nodeId] : [])));
  const remaining = nodeIds.filter((id) => !covered.has(id));
  const sourceless = out.filter((item) => !item.nodeId).length;
  const tail = remaining.slice(sourceless);
  return [...out, ...tail.map((id) => ({ source: `node/${id}`, nodeId: id }))];
}

/** 官方 `lF`：`fields` 白名单过滤。 */
function lF(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(xse);
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && allowed.has(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * request_json 载体（官方 @2215087 邻域，逐字）
 * ------------------------------------------------------------------ */

/** 官方 `cF`。 */
function cF(record: Record<string, unknown>): Record<string, unknown> | null {
  const detail = record.detail;
  if (As(detail) && As(detail.request_json)) return detail.request_json;
  if (As(record.request_json)) return record.request_json;
  if (record.kind === AF_GENERATION_REQUEST_V1) return record;
  return null;
}

/** 官方 `dF`。 */
function dF(record: Record<string, unknown>): GenerationRequestKind | null {
  if (yE(record.request_kind)) return record.request_kind;
  if (As(record.image)) return 'image';
  if (As(record.video)) return 'video';
  if (As(record.audio)) return 'audio';
  return null;
}

/** 官方 `uF`。 */
function uF(record: Record<string, unknown>): GenerationRequestKind | null {
  if (yse(record)) return null;
  const carrier = cF(record);
  if (carrier && typeof carrier.kind === 'string') {
    const animatic = record.kind === RM_PRESENTATION_V1
      && record.tool_name === 'animatic_storyboard_generate'
      && carrier.kind === ZZE_ANIMATIC_STORYBOARD;
    if (carrier.kind !== AF_GENERATION_REQUEST_V1 && !animatic) return null;
  }
  const carrierKind = carrier ? dF(carrier) : null;
  const declaredKind = yE(record.request_kind) ? record.request_kind : null;
  const toolKind = eJe(record.tool_name);
  const presentation = record.kind === RM_PRESENTATION_V1;
  const invalid = (record.confirmation_kind === 'generation_submit')
    ? true
    : (!presentation && !carrier && !toolKind);
  if (invalid) return null;
  if (carrierKind && declaredKind && carrierKind !== declaredKind) return null;
  if (carrierKind && toolKind && carrierKind !== toolKind) return null;
  if (declaredKind && toolKind && declaredKind !== toolKind) return null;
  return carrierKind ?? declaredKind ?? toolKind;
}

/* ------------------------------------------------------------------ *
 * params 写入器 / 白名单映射（官方 @2216642 邻域，逐字）
 * ------------------------------------------------------------------ */

/** 官方 `Oc`。 */
function Oc(target: Record<string, unknown>, key: string, value: unknown): void {
  if (typeof value === 'string') target[key] = value;
}

/** 官方 `gI`。 */
function gI(target: Record<string, unknown>, key: string, value: unknown): void {
  if (typeof value === 'number' && Number.isFinite(value)) target[key] = value;
}

/** 官方 `BB`。 */
function BB(target: Record<string, unknown>, key: string, value: unknown): void {
  if (typeof value === 'boolean') target[key] = value;
}

/** 官方 `Cl`。 */
function Cl(target: Record<string, unknown>, key: string, source: Record<string, unknown>, from: string): void {
  const value = Gr(source, from);
  if (value !== undefined) target[key] = value;
}

/** 官方 `xI`。 */
function xI(target: Record<string, unknown>, key: string, source: Record<string, unknown>, from: string): void {
  const value = xE(source, from);
  if (value !== undefined) target[key] = value;
}

/** 官方 `tm`。 */
function tm(target: Record<string, unknown>, key: string, source: Record<string, unknown>, from: string): void {
  const value = source[from];
  if (typeof value === 'boolean') target[key] = value;
}

/** 官方 `xy`。 */
function xy(target: Record<string, unknown>, key: string, source: Record<string, unknown>, from: string): void {
  const value = sl(source, from);
  if (value) target[key] = value;
}

/** 官方 `yI`。 */
function yI(record: Record<string, unknown>): Record<string, unknown> {
  const sources = wse(record);
  const out: Record<string, unknown> = {};
  if (sources.reference_image_sources?.length) out.images = sources.reference_image_sources;
  if (sources.reference_video_sources?.length) out.videos = sources.reference_video_sources;
  if (sources.reference_audio_sources?.length) out.audios = sources.reference_audio_sources;
  return out;
}

/** 官方 `cJe`：estimate_params 构造。 */
function cJe(record: Record<string, unknown>, kind: GenerationRequestKind): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  Cl(out, 'prompt', record, 'prompt');
  if (kind === 'image') {
    const image = wg(record, 'image');
    if (image) {
      Cl(out, 'aspectRatio', image, 'aspect_ratio');
      Cl(out, 'imageSize', image, 'image_size');
      Cl(out, 'quality', image, 'quality');
      xI(out, 'times', image, 'times');
      tm(out, 'hd', image, 'hd');
      tm(out, 'draft', image, 'draft');
      tm(out, 'enableGoogleSearch', image, 'enableGoogleSearch');
      tm(out, 'enable_image_search', image, 'enable_image_search');
      Cl(out, 'thinking_level', image, 'thinking_level');
      Cl(out, 'modelVariant', image, 'modelVariant');
      xy(out, 'images', image, 'images');
      xy(out, 'style_images', image, 'style_images');
      xy(out, 'image_normal', image, 'image_normal');
      xy(out, 'image_srefs', image, 'image_srefs');
      xy(out, 'image_oref', image, 'image_oref');
    }
    const refs = yI(record);
    if (!out.images && refs.images) out.images = refs.images;
  } else if (kind === 'video') {
    const video = wg(record, 'video');
    if (video) {
      Cl(out, 'aspectRatio', video, 'aspect_ratio');
      xI(out, 'duration', video, 'duration');
      Cl(out, 'resolution', video, 'resolution');
      Cl(out, 'generateMode', video, 'quality');
      tm(out, 'generateAudio', video, 'generate_audio');
      tm(out, 'enableWebSearch', video, 'enable_web_search');
      const modelType = lJe(video.mode);
      if (modelType) out.modelType = modelType;
    }
    Object.assign(out, yI(record));
  } else {
    const audio = wg(record, 'audio');
    if (audio) {
      Cl(out, 'scene', audio, 'mode');
      xI(out, 'duration', audio, 'duration');
      Cl(out, 'voice_id', audio, 'voice_id');
      Cl(out, 'audio_format', audio, 'audio_format');
      tm(out, 'loop', audio, 'loop');
    }
    Object.assign(out, yI(record));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 官方 `dJe`（导出供上层复用）。 */
export function dJe(target: Record<string, unknown>, source: Record<string, unknown>, kind: GenerationRequestKind): void {
  if (As(target.estimate_params)) return;
  const estimate = cJe(source, kind);
  if (estimate) target.estimate_params = estimate;
}

/** `lJe` 依赖官方 `nF`（模型模式枚举表），本轮未解析 ⇒ 恒 `undefined`。 */
function lJe(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const mode = nF(value);
  return mode?.status === 'known' ? mode.modelType : undefined;
}

/* ------------------------------------------------------------------ *
 * 官方模型目录边界（本轮未落地，见文件头「未落地」说明）
 * ------------------------------------------------------------------ */

export type ModelModeHint = { status: 'known'; modelType: string } | { status: 'unknown'; displayName: string };

/**
 * 官方 `nF`（@2200711）：`mode` 字符串 → 视频模式枚举。
 * 依赖 `wZe`（@2199438，`jt.*` 枚举表）。**官方实体未解析，待替换**：
 * `jt` 是官方视频模型枚举，MTV 无对应物；此处保留官方算法（`trim().toLowerCase().replace(/-/g,"_")` + 表查），
 * 表为空 ⇒ 恒返回 `{status:"unknown"}`。
 */
const WZE: Readonly<Record<string, string>> = {};

function CZe(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, '_');
}

export function nF(value: string | undefined): ModelModeHint | undefined {
  if (!value?.trim()) return undefined;
  const modelType = WZE[CZe(value)];
  return modelType ? { status: 'known', modelType } : { status: 'unknown', displayName: value };
}

/**
 * 官方 `hE` / `gZe`：`model_name` 字符串 → `{status:"known",id}`。
 * **官方实体未解析，待替换**：依赖 `mZe`/`fZe`/`xZe`（@2198xxx 的模型目录，`wireName`↔`modelId`）。
 * 本轮按官方结构保留，目录为空 ⇒ 恒 `{status:"unknown",displayName}`。
 */
function hE(kind: GenerationRequestKind, wireName: string | undefined): { status: 'known'; id: string } | { status: 'unknown'; displayName: string } | undefined {
  if (!wireName) return undefined;
  const catalog = MODEL_CATALOG[kind];
  const hit = catalog.find((entry) => entry.wireName === wireName);
  if (hit) return { status: 'known', id: hit.modelId };
  return { status: 'unknown', displayName: wireName };
}

/** 官方 `gZe`。 */
function gZe(wireName: string | undefined, _mode: string | undefined): ReturnType<typeof hE> {
  return hE('audio', wireName);
}

/** 官方 `mZe` / `fZe` / `xZe` 的载体（本轮为空表，见文件头）。 */
const MODEL_CATALOG: Readonly<Record<GenerationRequestKind, ReadonlyArray<{ wireName: string; modelId: string }>>> = {
  image: [],
  video: [],
  audio: [],
};

/* ------------------------------------------------------------------ *
 * 官方 `AZe` / `IZe` / `VB`（逐字）
 * ------------------------------------------------------------------ */

/** 官方 `AZe`。 */
function AZe(value: unknown, kind: string = 'video'): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    let mapped = kZe[item];
    if (item === 'mode') {
      switch (kind) {
        case 'audio':
          mapped = 'audioScene';
          break;
        case 'image':
        case 'video':
          mapped = 'videoMode';
          break;
        default:
          break;
      }
    }
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

/** 官方 `IZe`。 */
function IZe(value: Record<string, unknown>): Record<string, unknown> {
  const out = { ...value };
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['aspect_ratio', 'aspectRatio'],
    ['image_size', 'imageSize'],
    ['generate_audio', 'generateAudio'],
  ];
  for (const [from, to] of pairs) {
    if (out[to] === undefined && out[from] !== undefined) out[to] = out[from];
    delete out[from];
  }
  return out;
}

/** 官方 `VB`。 */
function VB(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of xse) {
    if (target[key] == null && source[key] != null) target[key] = source[key];
  }
  for (const key of ['reference_node_ids', 'reference_image_sources', 'reference_video_sources', 'reference_audio_sources']) {
    if (!sl(target, key)) {
      const value = sl(source, key);
      if (value) target[key] = value;
    }
  }
  if (!As(target.estimate_params) && As(source.estimate_params)) {
    target.estimate_params = { ...source.estimate_params };
  }
}

/* ------------------------------------------------------------------ *
 * 官方 `Sse` / `Cse` / `oJe` / `uJe` / `pJe` / `mJe`（逐字）
 * ------------------------------------------------------------------ */

/** 官方 `Cse`：把 `video.generate_audio` / `audio.*` 回填进 params。 */
function Cse(target: Record<string, unknown>, carrier: Record<string, unknown>, kind: GenerationRequestKind): void {
  if (kind === 'video' && As(carrier.video)) {
    const generateAudio = DM(carrier.video, 'generate_audio');
    if (generateAudio !== undefined && typeof target.generate_audio !== 'boolean') {
      target.generate_audio = generateAudio;
    }
  }
  if (kind === 'audio' && As(carrier.audio)) {
    for (const [key, type] of _se) {
      if (target[key] !== undefined) continue;
      const value = type === 'string'
        ? Gr(carrier.audio, key)
        : type === 'number'
          ? xE(carrier.audio, key)
          : DM(carrier.audio, key);
      if (value !== undefined) target[key] = value;
    }
  }
}

/** 官方 `Sse`。 */
function Sse(carrier: Record<string, unknown>, kind: GenerationRequestKind): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const model = hE(kind, Gr(carrier, 'model_name'));
  if (model) out.model = model;
  Oc(out, 'model_name', Gr(carrier, 'model_name'));
  Oc(out, 'prompt', Gr(carrier, 'prompt'));
  if (kind === 'image' && As(carrier.image)) {
    Oc(out, 'aspect_ratio', Gr(carrier.image, 'aspect_ratio'));
    Oc(out, 'image_size', Gr(carrier.image, 'image_size'));
    Oc(out, 'quality', Gr(carrier.image, 'quality'));
    gI(out, 'times', xE(carrier.image, 'times'));
  }
  if (kind === 'video' && As(carrier.video)) {
    Oc(out, 'mode', Gr(carrier.video, 'mode'));
    Oc(out, 'aspect_ratio', Gr(carrier.video, 'aspect_ratio'));
    gI(out, 'duration', xE(carrier.video, 'duration'));
    Oc(out, 'resolution', Gr(carrier.video, 'resolution'));
    Oc(out, 'quality', Gr(carrier.video, 'quality'));
    BB(out, 'generate_audio', DM(carrier.video, 'generate_audio'));
  }
  if (kind === 'audio' && As(carrier.audio)) {
    for (const [key, type] of _se) {
      const value = carrier.audio[key];
      if (type === 'string') Oc(out, key, value);
      else if (type === 'number') gI(out, key, value);
      else BB(out, key, value);
    }
  }
  Cse(out, carrier, kind);
  return out;
}

/** 官方 `oJe`：`presentation.v1` 载体 → params。 */
function oJe(record: Record<string, unknown>): Record<string, unknown> | null {
  if (record.kind !== RM_PRESENTATION_V1 || yse(record) || !yE(record.request_kind)) return null;
  const params: Record<string, unknown> = As(record.params) ? { ...record.params } : {};
  const carrier = cF(record);
  if (carrier) {
    if (typeof params.prompt !== 'string' || params.prompt.length === 0) {
      const detail = wg(record, 'detail');
      const detailPrompt = detail ? Gr(detail, 'prompt') : undefined;
      const carrierPrompt = Gr(carrier, 'prompt');
      const sheets = carrier.sheets;
      const sheet = Array.isArray(sheets) && As(sheets[0]) ? sheets[0] : null;
      const sheetPrompt = sheet ? Gr(sheet, 'prompt') : undefined;
      const prompt = detailPrompt ?? carrierPrompt ?? sheetPrompt;
      if (prompt !== undefined) params.prompt = prompt;
    }
    Cse(params, carrier, record.request_kind as GenerationRequestKind);
  }
  const originalParams = carrier && dF(carrier) === record.request_kind
    ? Sse(carrier, record.request_kind as GenerationRequestKind)
    : { ...params };
  return {
    requestKind: record.request_kind,
    params,
    originalParams,
    fields: lF(record.fields),
  };
}

/** 官方 `uJe`：`tapnow.generation_request.v1` 内联载体 → params。 */
function uJe(record: Record<string, unknown>): Record<string, unknown> | null {
  const carrier = cF(record);
  if (!carrier || (typeof carrier.kind === 'string' && carrier.kind !== AF_GENERATION_REQUEST_V1)) return null;
  const kind = dF(carrier);
  if (!kind) return null;
  const params = Sse(carrier, kind);
  return { requestKind: kind, params, originalParams: { ...params }, fields: lF(record.fields) };
}

/** 官方 `pJe`。 */
function pJe(record: Record<string, unknown>): Record<string, unknown> | null {
  const kind = uF(record);
  if (!kind) return null;
  const params: Record<string, unknown> = {};
  if (As(record.params)) VB(params, record.params);
  const requests = Array.isArray(record.requests) ? record.requests : [];
  if (requests.length === 1 && As(requests[0])) VB(params, requests[0]);
  return { requestKind: kind, params, originalParams: { ...params }, fields: lF(record.fields) };
}

/** 官方 `mJe`。 */
function mJe(record: Record<string, unknown>): Record<string, unknown> | null {
  return oJe(record) ?? uJe(record) ?? pJe(record);
}

/* ------------------------------------------------------------------ *
 * 官方 `GB` / `Nse` / `Tse` / `xJe` / `bI` / `gJe`（逐字）
 * ------------------------------------------------------------------ */

/** 官方 `GB`：`params` 原始字段 → 卡片用 camel 字段。 */
function GB(
  record: Record<string, unknown>,
  fields: readonly string[],
  kind: GenerationRequestKind,
): { params: GenerationParams; presentFields: string[] } {
  const params: Record<string, unknown> = {};
  const present = new Set<string>();
  const mark = (key: string) => {
    present.add(key);
  };
  const str = (key: string, from: string) => {
    const value = Gr(record, from);
    if (value !== undefined) {
      params[key] = value;
      mark(key);
    }
  };
  const num = (key: string, from: string) => {
    const value = xE(record, from);
    if (value !== undefined) {
      params[key] = value;
      mark(key);
    }
  };
  const bool = (key: string, from: string) => {
    const value = DM(record, from);
    if (value !== undefined) {
      params[key] = value;
      mark(key);
    }
  };
  const modelName = Gr(record, 'model_name');
  const model = kind === 'audio' ? gZe(modelName, Gr(record, 'mode')) : hE(kind, modelName);
  if (model) {
    params.model = model;
    mark('model');
  }
  str('prompt', 'prompt');
  str('aspectRatio', 'aspect_ratio');
  str('imageSize', 'image_size');
  str('quality', 'quality');
  if (kind === 'video') {
    const videoMode = nF(Gr(record, 'mode'));
    if (videoMode) {
      params.videoMode = videoMode;
      mark('videoMode');
    }
  } else if (kind === 'audio') {
    /* 官方这里调 `EZe`（@2202xxx，音频 scene 枚举表）。**官方实体未解析，待替换**：
       MTV 无对应 `Bo.*` scene 枚举 ⇒ 按官方结构保留但恒定不产出。 */
    const audioScene = undefined as undefined | { status: string; scene?: string };
    if (audioScene) {
      params.audioScene = audioScene;
      mark('audioScene');
    }
  }
  str('resolution', 'resolution');
  num('times', 'times');
  num('duration', 'duration');
  bool('generateAudio', 'generate_audio');
  str('voice', 'voice');
  str('lyrics', 'lyrics');
  str('audioFormat', 'audio_format');
  num('stability', 'stability');
  num('promptInfluence', 'prompt_influence');
  bool('instrumental', 'instrumental');
  bool('loop', 'loop');
  bool('subtitle', 'subtitle');
  num('sampleRate', 'sample_rate');
  num('speechRate', 'speech_rate');
  num('pitchRate', 'pitch_rate');
  num('loudnessRate', 'loudness_rate');
  /* ── 以下 6 条对应官方 @2227380 邻域，**逐字**：等号左边 camelCase、右边读原始 snake_case 键。
     `normalizedReferences` 带 `?? nJe(e)` 兜底 ⇒ **无条件赋值**（不是真值守卫）；
     `estimateParams` 那条官方确实有 `m &&` 守卫，故保留 `if`。 ── */
  const referenceNodeIds = sl(record, 'reference_node_ids');
  if (referenceNodeIds) params.referenceNodeIds = referenceNodeIds;
  const referenceImageSources = sl(record, 'reference_image_sources');
  if (referenceImageSources) params.referenceImageSources = referenceImageSources;
  const referenceVideoSources = sl(record, 'reference_video_sources');
  if (referenceVideoSources) params.referenceVideoSources = referenceVideoSources;
  const referenceAudioSources = sl(record, 'reference_audio_sources');
  if (referenceAudioSources) params.referenceAudioSources = referenceAudioSources;
  params.normalizedReferences = tJe(record, 'normalized_references') ?? nJe(record);
  const elementRefs = bse(record, 'element_refs');
  if (elementRefs) params.elementRefs = elementRefs;
  const estimateParams = wg(record, 'estimate_params');
  if (estimateParams) params.estimateParams = IZe(estimateParams);
  if (fields.length > 0) {
    const restricted = new Set(AZe(fields, kind));
    if (typeof params.generateAudio === 'boolean') restricted.add('generateAudio');
    return { params: params as GenerationParams, presentFields: [...restricted] };
  }
  return { params: params as GenerationParams, presentFields: [...present] };
}

/** 官方 `bI`。 */
function bI(value: unknown): KnownUnknownEntity | null {
  if (value === undefined) return null;
  if (!As(value)) return value as KnownUnknownEntity;
  if (value.status === 'known') {
    return { status: 'known', value: (value.id ?? value.modelType ?? value.scene ?? null) as string | null };
  }
  if (value.status === 'unknown') {
    return { status: 'unknown', value: (value.displayName ?? null) as string | null };
  }
  return value as KnownUnknownEntity;
}

/** 官方 `xJe`：两条请求「同配置」指纹（忽略 prompt）。 */
function xJe(item: NormalizedConfirmationItem): string {
  const pick = (params: GenerationParams) => ({
    model: bI(params.model),
    times: params.times ?? null,
    aspectRatio: params.aspectRatio ?? null,
    imageSize: params.imageSize ?? null,
    quality: params.quality ?? null,
    duration: params.duration ?? null,
    resolution: params.resolution ?? null,
    generateAudio: params.generateAudio ?? null,
    videoMode: bI(params.videoMode),
    audioScene: bI(params.audioScene),
  });
  return JSON.stringify({
    requestKind: item.requestKind,
    params: pick(item.params),
    originalParams: pick(item.originalParams),
    fields: [...item.presentFields].filter((field) => field !== 'prompt').sort(),
  });
}

/**
 * 官方 `gJe`：把 answer 的 modifications 叠加到 **`GB` 之前的原始 params**（snake_case 一侧）。
 * 官方 `Nse` 里 `gJe(o.params, o.fields, t)` 的 `o.params` 来自 `mJe`（`pJe`/`uJe`/`oJe`），
 * 那一侧全是原始键名 ⇒ 这里保留 `normalized_references`（snake）。
 */
function gJe(
  params: Record<string, unknown>,
  fields: readonly string[],
  modifications: Record<string, unknown> | null,
): { params: Record<string, unknown>; fields: string[] } {
  if (!modifications) return { params, fields: [...fields] };
  const next: Record<string, unknown> = { ...params };
  /* 官方逐字：`let i = t.length > 0`（`gJe` @2223400 邻域）；本 port 中 `i` 从不被重新赋值。 */
  const dirty = fields.length > 0;
  const present = new Set(fields);
  const str = (key: string) => {
    const value = modifications[key];
    if (value === null) {
      delete next[key];
      if (dirty) present.delete(key);
      return;
    }
    if (typeof value === 'string') {
      next[key] = value;
      if (dirty) present.add(key);
    }
  };
  const num = (key: string) => {
    const value = modifications[key];
    if (value === null) {
      delete next[key];
      if (dirty) present.delete(key);
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = value;
      if (dirty) present.add(key);
    }
  };
  const bool = (key: string) => {
    const value = modifications[key];
    if (value === null) {
      delete next[key];
      if (dirty) present.delete(key);
      return;
    }
    if (typeof value === 'boolean') {
      next[key] = value;
      if (dirty) present.add(key);
    }
  };
  str('model_name');
  str('prompt');
  str('aspect_ratio');
  str('image_size');
  str('quality');
  str('mode');
  str('resolution');
  num('times');
  num('duration');
  bool('generate_audio');
  if (Array.isArray(modifications.references)) {
    next.references = [...modifications.references];
    const normalized = bE(next);
    if (normalized) next.normalized_references = normalized;
  }
  return { params: next, fields: [...present] };
}

/** 官方 `UZe`：protocolContext（读**原始** params 的 snake_case 键）。 */
function UZe(params: Record<string, unknown>, kind: GenerationRequestKind = 'video'): ProtocolContext {
  return {
    originalReferences: Array.isArray(params.references) ? [...params.references] : undefined,
    originalModelName: typeof params.model_name === 'string' ? params.model_name : undefined,
    originalVideoMode: kind === 'video' && typeof params.mode === 'string' ? params.mode : undefined,
    originalAudioScene: kind === 'audio' && typeof params.mode === 'string' ? params.mode : undefined,
  };
}

/** 官方 `Nse`：单条 confirmation 载体 → 单条 viewModel（**不含 `index`**）。 */
function Nse(carrier: Record<string, unknown>, modifications: Record<string, unknown> | null = null): NormalizedConfirmationItem | null {
  const kind = uF(carrier);
  if (!kind) return null;
  const presented = mJe(carrier);
  if (!presented || presented.requestKind !== kind) return null;
  const declaredKind = Gr(carrier, 'request_kind');
  if (declaredKind && declaredKind !== kind) return null;
  const stacked = gJe(
    presented.params as Record<string, unknown>,
    (presented.fields as string[]) ?? [],
    modifications,
  );
  const resolved = GB(stacked.params, stacked.fields, kind);
  const original = GB(presented.originalParams as Record<string, unknown>, [], kind);
  return {
    requestKind: kind,
    params: resolved.params,
    originalParams: original.params,
    presentFields: resolved.presentFields,
    protocolContext: UZe(stacked.params, kind),
  };
}

/** 官方 `Tse`。 */
function Tse(record: Record<string, unknown>): CarrierRecord[] | null {
  const detail = wg(record, 'detail');
  const items = detail ? detail.items : undefined;
  if (!Array.isArray(items)) return null;
  return items.length > 0 && items.every(As) ? (items as CarrierRecord[]) : [];
}

/* ------------------------------------------------------------------ *
 * 官方解析器出口
 * ------------------------------------------------------------------ */

/** 官方 `fJe`。 */
function fJe(record: Record<string, unknown> | undefined): unknown {
  const response = record?.response as Record<string, unknown> | undefined;
  const answer = response?.answer as Record<string, unknown> | undefined;
  const result = record?.result as Record<string, unknown> | undefined;
  const resultAnswer = result?.answer as Record<string, unknown> | undefined;
  return response?.action
    ?? answer?.action
    ?? result?.action
    ?? resultAnswer?.action
    ?? record?.action;
}

/** 官方 `hJe`。 */
function hJe(record: Record<string, unknown>): Record<string, unknown> | null {
  if (fJe(record) !== 'confirm') return null;
  const response = record.response as Record<string, unknown> | undefined;
  const result = record.result as Record<string, unknown> | undefined;
  const candidates: unknown[] = [
    response?.modifications,
    (response?.answer as Record<string, unknown> | undefined)?.modifications,
    result?.modifications,
    (result?.answer as Record<string, unknown> | undefined)?.modifications,
    record.modifications,
    (record.answer as Record<string, unknown> | undefined)?.modifications,
  ];
  for (const candidate of candidates) if (As(candidate)) return candidate;
  return null;
}

/** 官方 `yJe`：**legacy** 解析器（只在 `detail.items` 不是非空数组时命中）。 */
export function parseGenerationConfirmationLegacy(content: unknown): GenerationConfirmationSingleViewModel | null {
  const record = content as Record<string, unknown> | undefined;
  const candidates = [record?.request, record?.response, record?.result, record];
  for (const candidate of candidates) {
    if (!As(candidate) || typeof candidate.confirmation_id !== 'string' || Tse(candidate)) continue;
    const item = Nse(candidate, hJe(record as Record<string, unknown>));
    if (item) {
      return {
        confirmationId: candidate.confirmation_id,
        requestKind: item.requestKind,
        params: item.params,
        originalParams: item.originalParams,
        presentFields: item.presentFields,
        protocolContext: item.protocolContext,
      };
    }
  }
  return null;
}

/** 官方 `bJe`：**v1** 解析器（`detail.items[]` 批量 + 全批一致性校验）。 */
export function parseGenerationConfirmationV1(content: unknown): GenerationConfirmationBatchViewModel | null {
  const record = content as Record<string, unknown> | undefined;
  const candidates = [record?.request, record?.response, record?.result, record];
  for (const candidate of candidates) {
    if (!As(candidate) || typeof candidate.confirmation_id !== 'string') continue;
    const carriers = Tse(candidate);
    if (!carriers) continue;
    const declared = yE(candidate.request_kind) ? candidate.request_kind : null;
    const items: GenerationConfirmationItem[] = [];
    let kind = declared;
    let fingerprint: string | null = null;
    let inconsistent = false;
    const seen = new Set<number>();
    carriers.forEach((carrier, position) => {
      const item = Nse(carrier);
      if (!item) {
        inconsistent = true;
        return;
      }
      if (kind && item.requestKind !== kind) {
        inconsistent = true;
        return;
      }
      kind = kind ?? item.requestKind;
      const nextFingerprint = xJe(item);
      if (fingerprint && nextFingerprint !== fingerprint) {
        inconsistent = true;
        return;
      }
      fingerprint = fingerprint ?? nextFingerprint;
      const index = xE(carrier, 'index') ?? position;
      if (seen.has(index)) {
        inconsistent = true;
        return;
      }
      seen.add(index);
      items.push({
        index,
        requestKind: item.requestKind,
        params: item.params,
        originalParams: item.originalParams,
        presentFields: item.presentFields,
        protocolContext: item.protocolContext,
      });
    });
    if (!(inconsistent || items.length !== carriers.length) && items.length !== 0) {
      return { confirmationId: candidate.confirmation_id, requestKind: items[0].requestKind, items };
    }
  }
  return null;
}

/** 官方 `qJe` / `KJe`（@2248797 邻域，逐字）。 */
export const QJE_TOOL_NAME = 'generation_request';
export const KJE_KIND = 'tapnow.generation_request.v1';

export interface GenerationAutoPreviewRequest {
  model_name?: string;
  prompt?: string;
  aspect_ratio?: string;
  image_size?: string;
  quality?: string;
  times?: number;
  duration?: number;
  resolution?: string;
  mode?: string;
  reference_node_ids?: string[];
}

export interface GenerationAutoPreview {
  toolName: string;
  modelName?: string;
  prompt?: string;
  aspectRatio?: string;
  imageSize?: string;
  quality?: string;
  times?: number;
  duration?: number;
  resolution?: string;
  mode?: string;
  isBatch: boolean;
  requestCount: number;
  requests: GenerationAutoPreviewRequest[];
  referenceNodeIds: string[];
  normalizedReferences?: NormalizedReference[];
  status: string;
}

/** 官方 `XJe`（@2249098，逐字）。 */
function XJe(toolName: string, request: Record<string, unknown> | undefined, status: string): GenerationAutoPreview | null {
  const requests = request?.requests;
  if (!Array.isArray(requests) || requests.length === 0) return null;
  const first = requests[0] as GenerationAutoPreviewRequest;
  return {
    toolName,
    modelName: first.model_name,
    prompt: first.prompt,
    aspectRatio: first.aspect_ratio,
    imageSize: first.image_size,
    quality: first.quality,
    times: first.times,
    duration: first.duration,
    resolution: first.resolution,
    mode: first.mode,
    isBatch: requests.length > 1,
    requestCount: requests.length,
    requests: requests as GenerationAutoPreviewRequest[],
    referenceNodeIds: Array.from(new Set(requests.flatMap((item) => (
      Array.isArray((item as GenerationAutoPreviewRequest).reference_node_ids)
        ? (item as GenerationAutoPreviewRequest).reference_node_ids as string[]
        : []
    )))),
    status,
  };
}

/** 官方 `ZJe`（逐字）。 */
function ZJe(record: Record<string, unknown>): string {
  if (typeof record.request_kind === 'string' && record.request_kind.trim()) return record.request_kind.trim();
  if (record.video && typeof record.video === 'object') return 'video';
  if (record.image && typeof record.image === 'object') return 'image';
  return '';
}

/** 官方 `JJe`（逐字）。 */
function JJe(references: unknown): string[] {
  if (!Array.isArray(references)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of references) {
    if (!item || typeof item !== 'object') continue;
    const ref = (item as Record<string, unknown>).ref;
    if (typeof ref !== 'string') continue;
    const trimmed = ref.trim();
    if (!trimmed.startsWith('node/')) continue;
    const id = trimmed.slice(5).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 官方 `QJe`（逐字）。 */
function QJe(request: Record<string, unknown> | undefined, status: string): GenerationAutoPreview | null {
  if (!request || request.kind !== KJE_KIND) return null;
  const kind = ZJe(request);
  if (kind !== 'image' && kind !== 'video') return null;
  const raw = request[kind];
  const nested = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const toolName = kind === 'video' ? 'gen_video' : 'gen_image';
  const draft: Record<string, unknown> = {
    model_name: request.model,
    prompt: request.prompt,
    reference_node_ids: JJe(request.references),
  };
  if (kind === 'image') {
    draft.aspect_ratio = nested.aspect_ratio;
    draft.image_size = nested.image_size;
    draft.quality = nested.quality;
    draft.times = nested.times;
  } else {
    draft.aspect_ratio = nested.aspect_ratio;
    draft.duration = nested.duration;
    draft.mode = nested.mode;
    draft.resolution = nested.resolution;
    draft.quality = nested.quality;
  }
  const compact = Object.fromEntries(Object.entries(draft).filter(([, value]) => value != null));
  const requests = [compact];
  const normalizedReferences = bE(request);
  return {
    toolName,
    modelName: compact.model_name as string | undefined,
    prompt: compact.prompt as string | undefined,
    aspectRatio: compact.aspect_ratio as string | undefined,
    imageSize: compact.image_size as string | undefined,
    quality: compact.quality as string | undefined,
    times: compact.times as number | undefined,
    duration: compact.duration as number | undefined,
    resolution: compact.resolution as string | undefined,
    mode: compact.mode as string | undefined,
    isBatch: false,
    requestCount: 1,
    requests,
    referenceNodeIds: (compact.reference_node_ids as string[] | undefined) ?? [],
    normalizedReferences,
    status,
  };
}

/** 官方 `YJe`（@2248830，自动模式预览卡的解析器链，逐字）。 */
export function parseGenerationAutoPreview(content: unknown): GenerationAutoPreview | null {
  const record = content as Record<string, unknown> | undefined;
  const tool = record?.tool;
  const status = (record?.status as string | undefined) ?? 'started';
  const request = record?.request as Record<string, unknown> | undefined;
  if (tool === QJE_TOOL_NAME) return QJe(request, status);
  if (tool !== 'gen_image' && tool !== 'gen_video') return null;
  return XJe(tool, request, status);
}

/** 官方 `Qet`：回退卡 `Zet` 的 viewModel（逐字）。 */
export function extractFallbackViewModel(content: unknown): GenerationFallbackViewModel | null {
  const record = content as Record<string, unknown> | undefined;
  const candidates = [record?.request, record?.response, record?.result, record];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const carrier = candidate as Record<string, unknown>;
    const confirmationId = typeof carrier.confirmation_id === 'string' ? carrier.confirmation_id : '';
    const detail = carrier.detail as Record<string, unknown> | undefined;
    const detailRequestJson = detail?.request_json as Record<string, unknown> | undefined;
    const requestKind = typeof carrier.request_kind === 'string'
      ? carrier.request_kind
      : typeof detailRequestJson?.request_kind === 'string'
        ? (detailRequestJson.request_kind as string)
        : '';
    if (confirmationId && requestKind) return { confirmationId, requestKind };
  }
  return null;
}

/** 官方 `Tse` 的公开形态（供上层判断「是不是批量确认」）。 */
export function hasConfirmationItems(content: unknown): boolean {
  const record = content as Record<string, unknown> | undefined;
  const candidates = [record?.request, record?.response, record?.result, record];
  return candidates.some((candidate) => As(candidate) && (Tse(candidate)?.length ?? 0) > 0);
}

/* ------------------------------------------------------------------ *
 * 谓词（官方 @443724 邻域，逐字）
 * ------------------------------------------------------------------ */

/**
 * 官方 `xl`（**定义偏移 @443724，逐字**）：
 * ```js
 * xl = e => e.type === "tool_event" && typeof e.content === "object" && e.content !== null
 *   ? String(e.content.tool ?? "") : ""
 * ```
 * ⚠️ **没有 `.toLowerCase()`，也没有 `.trim()`**（主 agent 仲裁复核，见落地报告
 * 「本轮被主 agent 仲裁推翻的先验」）。`MNe`/`PNe`/`RNe`/`DNe`/`LNe` 都是
 * `new Set([...字面工具名...])` ⇒ 命中判定**大小写敏感**。
 *
 * （真正会小写化的是同一邻域里的 `YNe`（@443950 之后，逐字 `xl(o).toLowerCase()`），
 *  以及 `src/services/chat/agentToolLabels.ts` 的 `gs` / `agentContents.ts` 的 `tT`；
 *  三者与 `xl` **不是**同一函数。）
 */
export function toolEventNameOf(item: { type?: unknown; content?: unknown }): string {
  return item.type === 'tool_event' && typeof item.content === 'object' && item.content !== null
    ? String((item.content as Record<string, unknown>).tool ?? '')
    : '';
}

/** 官方 `dg` + `PNe`（`new Set(["generation_confirmation"])`，逐字；大小写敏感）。 */
export function isGenerationConfirmationTool(tool: unknown): boolean {
  return String(tool ?? '') === 'generation_confirmation';
}

/** 官方 `XNe` + `ib`：`new Set(["gen_image","gen_video","generation_request"])`（逐字；大小写敏感）。 */
export function isGenerationRequestTool(tool: unknown): boolean {
  const name = String(tool ?? '');
  return name === 'gen_image' || name === 'gen_video' || name === 'generation_request';
}

/** 官方 `iT` + `DNe`（`new Set(["node_update_confirmation"])`，逐字；大小写敏感）。 */
export function isNodeUpdateConfirmationTool(tool: unknown): boolean {
  return String(tool ?? '') === 'node_update_confirmation';
}

/** 官方 `qNe`：任意「确认卡」（generation / node_update / desktop_*）。 */
export function isAnyConfirmationCardTool(tool: unknown): boolean {
  return isGenerationConfirmationTool(tool)
    || isNodeUpdateConfirmationTool(tool)
    || isDesktopConfirmationTool(tool);
}

/** 官方 `LNe`（5 个 desktop 确认工具，逐字；大小写敏感）。 */
export function isDesktopConfirmationTool(tool: unknown): boolean {
  const name = String(tool ?? '');
  return name === 'desktop_open_app_confirmation'
    || name === 'desktop_capture_screen_confirmation'
    || name === 'desktop_fs_confirmation'
    || name === 'desktop_shell_command_confirmation'
    || name === 'batch_download_files_confirmation';
}

/** 官方从工具事件取 `content` 的约定（`e.content.tool`，不是 `tool_name`）。 */
export function confirmationToolOf(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  return String((content as Record<string, unknown>).tool ?? '');
}
