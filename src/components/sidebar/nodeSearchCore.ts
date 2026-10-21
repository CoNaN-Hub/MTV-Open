/**
 * nodeSearchCore — 官方「节点搜索」(`Vxe`) 的**纯逻辑内核**逐字移植（无 React，故与组件分文件）。
 *
 * 官方出处：`E:\TapNow-0.4.66\resources\web\assets\page-DPdEgTS0.js`
 *   · 字段优先级表 `ni={title:0,prompt:1,text:2}`              @char1521614
 *   · 类型排序表   `nxe={…}` / `yc=e=>nxe[String(e.type||"")]??5` @char1521626
 *   · 排除类型集   `sxe=new Set([ge.DOC_EDITOR])`              @char1521790
 *   · 常量         `ek=140`（预览截断）· `rxe=3`（ASCII 子序列最短长度）
 *                  `ixe=2`（非 ASCII 子序列最短长度）· `oxe=4`（跨字段命中加成）
 *                  `nk=30`（默认条数上限，在 `Axe` 之前的同一句里）  @char1521796 起
 *   · 归一化/分词  `aO` / `Cp` / `fxe` / `tk` / `j_` / `lO`      @char1521840–1522965
 *   · 打分         `bc` / `pxe` / `hxe` / `mxe` / `gxe` / `xxe` / `yxe` / `T0`
 *                  / `bxe` / `R_` / `cO` / `wxe` / `_xe`          @char1523000–1526200
 *   · 建索引       `Ep` / `uxe`（可搜索文档 = 标题 / prompt / params.prompt / 文本）
 *   · 排序         `vxe`（无查询：按类型+序号）· `Sxe`（有查询：按分数）
 *   · 读字段       `Sl` / `Cxe`（`entries.find(field===t)?.value ?? ""`）@char1526607
 *
 * ⚠️ MTV 偏离：官方 `t.data` 的字段名是 `title` / `prompt` / `params.prompt` / `text`；
 *    MTV 对应为 `label`（= 官方 `data.title`，见 `nodes/shared/useNodeRename.ts` 的考证）
 *    / `prompt` / `params.prompt` / `output`（MTV 文本卡正文）。见 `readField` 的注释。
 */
import type { Node } from '@xyflow/react';
import type { BaseNodeData } from '../../types';

/** 官方 `ni` —— 字段优先级（数字越小越优先） */
export const FIELD_PRIORITY = { title: 0, prompt: 1, text: 2 } as const;

export type NodeSearchField = keyof typeof FIELD_PRIORITY;

/** 官方 `ek` —— 预览文本截断长度 */
const PREVIEW_MAX = 140;
/** 官方 `rxe` —— ASCII 查询走子序列模糊匹配的最小长度 */
const MIN_FUZZY_ASCII = 3;
/** 官方 `ixe` —— 非 ASCII 查询走子序列模糊匹配的最小长度 */
const MIN_FUZZY_NON_ASCII = 2;
/** 官方 `oxe` —— 多个字段各自命中时的分数加成（`_xe`） */
const MULTI_FIELD_BONUS = 4;
/** 官方 `nk` —— 结果条数上限 */
export const NODE_SEARCH_LIMIT = 30;

/** 官方 `ge`（节点类型枚举）在 MTV 里的 1:1 映射表 —— 用于 `nxe` / `Rxe` 两处判定 */
const IMAGE_TYPES = new Set([
  'ai-image',
  'source-image',
  'ai-animation',
  'ai-panorama',
  'ai-storyboard',
  'ai-shotlist',
]);
const VIDEO_TYPES = new Set(['ai-video', 'source-video']);
const TEXT_TYPES = new Set(['ai-text', 'source-text', 'ai-markdown']);
const AUDIO_TYPES = new Set(['ai-audio', 'source-audio']);
/** 官方 `THREED` / `THREE_D_STUDIO` ⇒ MTV 的「3D 片场」(`ai-director`) */
const WORLD_TYPES = new Set(['ai-director']);

/** 官方 `Rxe` —— 节点 → 筛选分类（`Axe` 的 id 之一） */
export type NodeSearchCategory = 'image' | 'video' | 'text' | 'audio' | 'world' | 'group' | 'other';

export function nodeSearchCategory(type: string | undefined): NodeSearchCategory {
  const kind = String(type || '');
  if (WORLD_TYPES.has(kind)) return 'world';
  if (IMAGE_TYPES.has(kind)) return 'image';
  if (VIDEO_TYPES.has(kind)) return 'video';
  if (TEXT_TYPES.has(kind)) return 'text';
  if (AUDIO_TYPES.has(kind)) return 'audio';
  if (kind === 'group') return 'group';
  return 'other';
}

/** 官方 `nxe` + `yc` —— 类型排序权重（image/world=0 · video=1 · text=2 · audio=3 · group=4 · 其它=5） */
const CATEGORY_ORDER: Record<NodeSearchCategory, number> = {
  image: 0,
  world: 0,
  video: 1,
  text: 2,
  audio: 3,
  group: 4,
  other: 5,
};

function nodeTypeOrder(node: Node<BaseNodeData>): number {
  return CATEGORY_ORDER[nodeSearchCategory(node.type)];
}

/**
 * 官方 `dxe=e=>e.hidden||sxe.has(String(e.type||""))` —— 不可搜索的节点。
 * ⚠️ MTV 偏离：官方排除 `ge.DOC_EDITOR`（文档编辑器节点）；MTV 没有该节点类型，
 *    改排除「被角色库收纳隐藏」的节点（`data.hiddenByCharacterLibrary`，语义等价：当前不可见）。
 */
function isSearchableNode(node: Node<BaseNodeData>): boolean {
  if (node.hidden === true) return false;
  if (node.data?.hiddenByCharacterLibrary === true) return false;
  return true;
}

/** 官方 `Cp=e=>typeof e=="string"?e.trim():""` */
function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 官方 `Sl(e,t)` —— 读 `data` 上的字符串字段。
 * ⚠️ MTV 偏离：字段名映射（官方 → MTV）：
 *    `title`  → `label`     （`useNodeRename.ts` 已考证 `data.label` = 官方 `data.title`）
 *    `prompt` → `prompt`    `params.prompt` → `params.prompt`
 *    `text`   → `output`    （MTV 文本卡正文存 `data.output`）
 */
function readField(data: Record<string, unknown>, field: NodeSearchField): string {
  if (field === 'title') return readString(data.label);
  if (field === 'text') return readString(data.output);
  return readString(data.prompt);
}

/** 官方 `Cxe=(e,t)=>e.entries.find(s=>s.field===t)?.value??""` —— 取指定字段的原文 */
export function fieldValue(document_: NodeSearchDocument, field: NodeSearchField): string {
  return document_.entries.find((entry) => entry.field === field)?.value ?? '';
}

export interface NodeSearchEntry {
  field: NodeSearchField;
  value: string;
  normalized: string;
}

export interface NodeSearchDocument {
  node: Node<BaseNodeData>;
  index: number;
  title: string;
  entries: NodeSearchEntry[];
}

export interface NodeSearchResult {
  document: NodeSearchDocument;
  field: NodeSearchField;
  score: number;
  preview: string;
}

/** 官方 `axe=new RegExp("\\p{M}","gu")` —— 组合附加符号 */
const COMBINING_MARK = /\p{M}/gu;
/** 官方 `lxe=/[\p{L}\p{M}\p{N}]+/gu` */
const WORD_PATTERN = /[\p{L}\p{M}\p{N}]+/gu;
/** 官方 `cxe=/^[\p{L}\p{M}\p{N}]+$/u` */
const SINGLE_WORD_PATTERN = /^[\p{L}\p{M}\p{N}]+$/u;

/**
 * 官方 `aO` —— 归一化：NFKD → 去组合符 → 驼峰拆词 → 分隔符变空格 → 小写 → NFKC → trim
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(COMBINING_MARK, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[\s_.\-/]+/g, ' ')
    .toLocaleLowerCase()
    .normalize('NFKC')
    .trim();
}

/** 官方 `fxe` —— 惰性构造 `Intl.Segmenter`（不支持时返回 null） */
let cachedSegmenter: Intl.Segmenter | null | undefined;
function getWordSegmenter(): Intl.Segmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter;
  const Ctor = typeof Intl !== 'undefined' ? Intl.Segmenter : undefined;
  cachedSegmenter = Ctor ? new Ctor(undefined, { granularity: 'word' }) : null;
  return cachedSegmenter;
}

/** 官方 `tk=e=>e.match(lxe)??[]` */
function matchWords(text: string): string[] {
  return text.match(WORD_PATTERN) ?? [];
}

/** 官方 `j_` —— 分词（优先 `Intl.Segmenter`，失败回落正则） */
export function segmentWords(text: string): string[] {
  const segmenter = getWordSegmenter();
  if (!segmenter) return matchWords(text);
  const words = Array.from(segmenter.segment(text))
    .filter((part) => part.isWordLike ?? SINGLE_WORD_PATTERN.test(part.segment))
    .map((part) => part.segment.trim())
    .filter(Boolean);
  return words.length > 0 ? words : matchWords(text);
}

/** 官方 `lO` —— 查询词元（有空格按空格切，否则分词；都为空则用原串） */
export function queryTerms(query: string): string[] {
  const parts = query.split(' ').filter(Boolean);
  if (parts.length > 1) return parts;
  const words = segmentWords(query);
  return words.length > 0 ? words : parts;
}

/** 官方 `bc=e=>Array.from(e.replace(/\s/g,""))` */
function compactChars(text: string): string[] {
  return Array.from(text.replace(/\s/g, ''));
}

/** 官方 `pxe` —— 含非 ASCII 字符 */
function hasNonAsciiChar(text: string): boolean {
  return Array.from(text).some((char) => (char.codePointAt(0) ?? 0) > 127);
}

/** 官方 `hxe=e=>e<4?0:e>=8?2:1` —— 模糊匹配允许的最大编辑距离 */
function fuzzyBudget(length: number): number {
  if (length < 4) return 0;
  if (length >= 8) return 2;
  return 1;
}

/**
 * 官方 `mxe(e,t,n)` —— 受限编辑距离（超过 `n` 直接放弃）；返回距离或 null。
 * 逐字保留官方的滚动两行 DP（`o` = 上一行、`d` = 当前行）。
 */
function boundedEditDistance(haystack: string, needle: string, maxDistance: number): number | null {
  const source = compactChars(haystack);
  const target = compactChars(needle);
  if (Math.abs(source.length - target.length) > maxDistance) return null;
  let previous: number[] = target.map((_char, index) => index + 1);
  previous.unshift(0);
  for (let row = 0; row < source.length; row += 1) {
    const current: number[] = [row + 1];
    let rowMin = current[0];
    for (let column = 0; column < target.length; column += 1) {
      const cost = source[row] === target[column] ? 0 : 1;
      const distance = Math.min(previous[column + 1] + 1, current[column] + 1, previous[column] + cost);
      current.push(distance);
      rowMin = Math.min(rowMin, distance);
    }
    if (rowMin > maxDistance) return null;
    previous = current;
  }
  const result = previous[target.length];
  return result <= maxDistance ? result : null;
}

/** 官方 `gxe` —— 逐词匹配分（全等 / 前缀 / 模糊） */
function scoreWords(text: string, term: string): number | null {
  const words = segmentWords(text);
  let best: number | null = null;
  const budget = fuzzyBudget(compactChars(term).length);
  words.forEach((word, index) => {
    let score: number | null = null;
    if (word === term) {
      score = 12 + index * 1.5;
    } else if (word.startsWith(term)) {
      score = 16 + index * 1.5 + Math.max(0, word.length - term.length) * 0.02;
    } else if (budget > 0) {
      const distance = boundedEditDistance(word, term, budget);
      if (distance !== null) {
        score = 42 + distance * 10 + index * 1.5 + Math.max(0, word.length - term.length) * 0.05;
      }
    }
    if (score !== null && (best === null || score < best)) best = score;
  });
  return best;
}

/** 官方 `xxe` —— 首字母缩写匹配分 */
function scoreInitials(text: string, term: string): number | null {
  if (compactChars(term).length < 2) return null;
  const initials = segmentWords(text)
    .map((word) => compactChars(word)[0] ?? '')
    .join('');
  if (!initials) return null;
  if (initials === term) return 14;
  if (initials.startsWith(term)) return 18 + Math.max(0, initials.length - term.length) * 0.3;
  const index = initials.indexOf(term);
  return index !== -1 ? 24 + index * 1.5 : null;
}

/** 官方 `yxe` —— 子序列匹配分（按字符顺序扫一遍） */
function scoreSubsequence(text: string, term: string): number | null {
  const chars = compactChars(term);
  const minLength = hasNonAsciiChar(term) ? MIN_FUZZY_NON_ASCII : MIN_FUZZY_ASCII;
  if (chars.length < minLength) return null;
  let cursor = 0;
  let firstIndex = -1;
  let previousIndex = -1;
  let gapTotal = 0;
  let adjacentHits = 0;
  for (const char of chars) {
    const index = text.indexOf(char, cursor);
    if (index === -1) return null;
    if (firstIndex === -1) {
      firstIndex = index;
    } else {
      const gap = Math.max(0, index - previousIndex - 1);
      gapTotal += gap;
      if (gap === 0) adjacentHits += 1;
    }
    previousIndex = index;
    cursor = index + 1;
  }
  return (
    72 +
    firstIndex * 0.8 +
    gapTotal * 0.55 +
    Math.max(0, text.length - term.length) * 0.02 -
    adjacentHits * 1.5
  );
}

/** 官方 `T0` —— 单个字段对单个词元的最终分（取各策略最小值） */
function scoreFieldValue(normalized: string, term: string): number | null {
  if (normalized === term) return 0;
  if (normalized.startsWith(term)) return 6 + Math.max(0, normalized.length - term.length) * 0.01;
  const candidates: number[] = [];
  const wordScore = scoreWords(normalized, term);
  const initialScore = scoreInitials(normalized, term);
  if (wordScore !== null) candidates.push(wordScore);
  if (initialScore !== null) candidates.push(initialScore);
  const substringIndex = normalized.indexOf(term);
  if (substringIndex !== -1) {
    candidates.push(28 + substringIndex * 0.25 + Math.max(0, normalized.length - term.length) * 0.01);
  }
  const subsequenceScore = scoreSubsequence(normalized, term);
  if (subsequenceScore !== null) candidates.push(subsequenceScore);
  return candidates.length === 0 ? null : Math.min(...candidates);
}

/** 官方 `bxe` —— 一个字段对整条查询的分（整串命中优先，否则各词元平均） */
function scoreEntry(entry: NodeSearchEntry, query: string): number | null {
  const terms = queryTerms(query);
  if (terms.length === 0) return null;
  const whole = scoreFieldValue(entry.normalized, query);
  if (whole === 0) return whole;
  let total = 0;
  for (const term of terms) {
    const score = scoreFieldValue(entry.normalized, term);
    if (score === null) return null;
    total += score;
  }
  const average = total / terms.length;
  return whole === null ? average : Math.min(whole, average);
}

/** 官方 `R_` —— 预览文本（折叠空白 + 超长截断加省略号） */
export function previewText(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= PREVIEW_MAX ? collapsed : `${collapsed.slice(0, PREVIEW_MAX - 1)}…`;
}

/** 官方 `Ep` —— 字段入索引（`field:normalized` 去重） */
function pushEntry(
  entries: NodeSearchEntry[],
  seen: Set<string>,
  field: NodeSearchField,
  value: string,
): void {
  if (!value) return;
  const normalized = normalizeSearchText(value);
  if (!normalized) return;
  const key = `${field}:${normalized}`;
  if (seen.has(key)) return;
  seen.add(key);
  entries.push({ field, value, normalized });
}

/**
 * ⚠️ MTV 偏离：官方标题兜底是 `String(t.type || \`Node ${n+1}\`)`，即**类型枚举名**（"image" / "video" …）。
 *    MTV 的节点类型标识是 `ai-image` 这类内部串，直接当标题显示不可读 ⇒
 *    改用**各节点卡自己的兜底标题**（`useNodeRename(id,data,fallback)` 的第二个参数，见各 `nodes/*.tsx`）。
 */
const NODE_TITLE_FALLBACK: Record<string, string> = {
  'ai-image': 'Image',
  'source-image': 'Image',
  'ai-video': 'Video',
  'source-video': 'Video',
  'ai-audio': 'Audio',
  'source-audio': 'Audio',
  'ai-text': 'Text',
  'source-text': 'Text',
  'ai-animation': '生成动画',
  'ai-panorama': '360全景图',
  'ai-markdown': 'Markdown 文档',
  'ai-storyboard': '宫格分镜',
  'ai-shotlist': '分镜表',
  'ai-director': '3D 导演台',
  group: '分组',
};

/**
 * 官方 `uxe` —— 把画布节点摊平成可搜索文档（标题 / prompt / params.prompt / 文本）。
 * 标题兜底：`o || String(t.type || \`Node ${n+1}\`)`（MTV 的兜底名见表上方的偏离说明）
 */
export function buildSearchDocuments(nodes: readonly Node<BaseNodeData>[]): NodeSearchDocument[] {
  return nodes.flatMap((node, index) => {
    if (!isSearchableNode(node)) return [];
    const data = (node.data ?? {}) as unknown as Record<string, unknown>;
    const params = (data.params ?? {}) as Record<string, unknown>;
    const title = readField(data, 'title');
    const entries: NodeSearchEntry[] = [];
    const seen = new Set<string>();
    pushEntry(entries, seen, 'title', title);
    pushEntry(entries, seen, 'prompt', readField(data, 'prompt'));
    pushEntry(entries, seen, 'prompt', readString(params.prompt));
    pushEntry(entries, seen, 'text', readField(data, 'text'));
    if (entries.length === 0) return [];
    const kind = String(node.type || '');
    return [
      {
        node,
        index,
        title: title || NODE_TITLE_FALLBACK[kind] || kind || `Node ${index + 1}`,
        entries,
      },
    ];
  });
}

/** 官方 `Mxe=(e,t)=>t==="all"?e:e.filter(n=>Rxe(n.node)===t)` —— 按筛选分类过滤 */
export function filterDocuments(
  documents: readonly NodeSearchDocument[],
  filterId: string,
): NodeSearchDocument[] {
  if (filterId === 'all') return [...documents];
  return documents.filter((doc) => nodeSearchCategory(doc.node.type) === filterId);
}

/** 官方 `vxe` —— 无查询时的列表（按类型排序 + 原序，取标题字段作为展示字段） */
export function rankWithoutQuery(
  documents: readonly NodeSearchDocument[],
  limit: number = NODE_SEARCH_LIMIT,
): NodeSearchResult[] {
  return [...documents]
    .sort((a, b) => {
      const byType = nodeTypeOrder(a.node) - nodeTypeOrder(b.node);
      return byType !== 0 ? byType : a.index - b.index;
    })
    .slice(0, limit)
    .map((document_) => {
      const entry =
        document_.entries.find((item) => item.field === 'title') ?? document_.entries[0];
      return { document: document_, field: entry.field, score: 0, preview: previewText(entry.value) };
    });
}

/** 官方 `cO` —— 结果比较器（分数 → 字段优先级 → 类型 → 原序） */
function isBetterResult(candidate: NodeSearchResult, current: NodeSearchResult | null): boolean {
  if (!current) return true;
  const byScore = candidate.score - current.score;
  if (byScore !== 0) return byScore < 0;
  const byField = FIELD_PRIORITY[candidate.field] - FIELD_PRIORITY[current.field];
  if (byField !== 0) return byField < 0;
  const byType = nodeTypeOrder(candidate.document.node) - nodeTypeOrder(current.document.node);
  return byType !== 0 ? byType < 0 : candidate.document.index < current.document.index;
}

/** 官方 `wxe` —— 单字段最佳命中 */
function bestSingleFieldResult(
  document_: NodeSearchDocument,
  query: string,
): NodeSearchResult | null {
  let best: NodeSearchResult | null = null;
  for (const entry of document_.entries) {
    const score = scoreEntry(entry, query);
    if (score === null) continue;
    const candidate: NodeSearchResult = {
      document: document_,
      field: entry.field,
      score,
      preview: previewText(entry.value),
    };
    if (isBetterResult(candidate, best)) best = candidate;
  }
  return best;
}

/** 官方 `_xe` —— 跨字段命中（每个词元各挑一个最佳字段，命中多字段再加 `oxe`） */
function bestCrossFieldResult(
  document_: NodeSearchDocument,
  query: string,
): NodeSearchResult | null {
  const terms = queryTerms(query);
  if (terms.length <= 1) return null;
  let totalScore = 0;
  let representative: { entry: NodeSearchEntry; score: number } | null = null;
  const matchedFields = new Set<string>();
  for (const term of terms) {
    let best: { entry: NodeSearchEntry; score: number } | null = null;
    for (const entry of document_.entries) {
      const score = scoreFieldValue(entry.normalized, term);
      if (score === null) continue;
      const candidate = { entry, score };
      if (
        !best ||
        candidate.score < best.score ||
        (candidate.score === best.score &&
          FIELD_PRIORITY[candidate.entry.field] < FIELD_PRIORITY[best.entry.field])
      ) {
        best = candidate;
      }
    }
    if (!best) return null;
    totalScore += best.score;
    matchedFields.add(`${best.entry.field}:${best.entry.normalized}`);
    if (
      !representative ||
      FIELD_PRIORITY[best.entry.field] < FIELD_PRIORITY[representative.entry.field] ||
      (FIELD_PRIORITY[best.entry.field] === FIELD_PRIORITY[representative.entry.field] &&
        best.score < representative.score)
    ) {
      representative = best;
    }
  }
  if (!representative) return null;
  return {
    document: document_,
    field: representative.entry.field,
    score: totalScore / terms.length + (matchedFields.size > 1 ? MULTI_FIELD_BONUS : 0),
    preview: previewText(representative.entry.value),
  };
}

/**
 * 官方 `Sxe(e,t,n=30)` —— 带查询的排序（单字段命中 vs 跨字段命中，取更优者）。
 * `t` 会先过 `aO` 归一化；空查询返回空数组。
 */
export function rankWithQuery(
  documents: readonly NodeSearchDocument[],
  query: string,
  limit: number = NODE_SEARCH_LIMIT,
): NodeSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  const results: NodeSearchResult[] = [];
  for (const document_ of documents) {
    const single = bestSingleFieldResult(document_, normalizedQuery);
    const cross = bestCrossFieldResult(document_, normalizedQuery);
    const best = cross && isBetterResult(cross, single) ? cross : single;
    if (best) results.push(best);
  }
  return results
    .sort((a, b) => {
      const byScore = a.score - b.score;
      if (byScore !== 0) return byScore;
      const byField = FIELD_PRIORITY[a.field] - FIELD_PRIORITY[b.field];
      if (byField !== 0) return byField;
      const byType = nodeTypeOrder(a.document.node) - nodeTypeOrder(b.document.node);
      return byType !== 0 ? byType : a.document.index - b.document.index;
    })
    .slice(0, limit);
}

/**
 * 官方 `Dxe` —— 结果行缩略图取源（图片 / 视频）。
 * 官方优先级：`thumbnailSrc|thumbnailUrl|thumbnail|previewImage|preview_image` → `src`。
 * ⚠️ MTV 偏离：MTV 没有官方那套 CDN 缩略图变换 `fn(url, tn.THUMBNAIL)`（`rk`），
 *    直接用节点已存的 `thumbnailUrl` / `imageUrl` / `videoUrl`；官方对视频还会把
 *    无缩略图时的 `src` 同时当作图片缩略图，MTV 的 `videoUrl` 不是图片 ⇒ 只给 `<video>` 播首帧。
 */
export function resolveNodeSearchThumbnail(node: Node<BaseNodeData>): {
  imageSrc: string;
  videoSrc: string;
} {
  const data = (node.data ?? {}) as unknown as Record<string, unknown>;
  const category = nodeSearchCategory(node.type);
  const thumbnail = readString(data.thumbnailUrl);
  const imageUrl = readString(data.imageUrl);
  const videoUrl = readString(data.videoUrl);
  const isVideo = category === 'video';
  if (thumbnail) return { imageSrc: thumbnail, videoSrc: isVideo ? videoUrl : '' };
  if (imageUrl) return { imageSrc: imageUrl, videoSrc: isVideo ? videoUrl : '' };
  if (isVideo && videoUrl) return { imageSrc: '', videoSrc: videoUrl };
  return { imageSrc: '', videoSrc: '' };
}

/** 官方组件里 `C = g.trim() ? Sxe(S,g,nk) : vxe(S,nk)` —— 统一的取列表入口 */
export function computeNodeSearchResults(
  documents: readonly NodeSearchDocument[],
  query: string,
  limit: number = NODE_SEARCH_LIMIT,
): NodeSearchResult[] {
  return query.trim() ? rankWithQuery(documents, query, limit) : rankWithoutQuery(documents, limit);
}
