/**
 * referenceTokens —— 官方「上游引用 → prompt 里的引用 token」这一整套的等价实现（**只覆盖图片/文本**，
 * 视频/音频/3D 后续再接）。
 *
 * 依据（EXE `zoom-slider-3ZcFvYQO.js`，逐字对照）：
 *   · `dm(nodeId, edges, nodesById)` @1451061（page chunk 里的定义）
 *       —— 取 `target === nodeId` 的入边，`slice().sort((a,b) => Ih(a) - Ih(b))`；
 *          每条取上游 `data.src` / `data.title`，文本卡另取 `data.text`；
 *          **`!url && type !== TEXT` 的源被跳过**（只有文本卡可以没有 src）。
 *   · `ew(list, kind)` @229506 —— 每个类各自编号：`renderText = "<Kind> <index+1>"`（从 1 起），
 *          `label = title || renderText`；文本要求 `textContent`、其它要求 `url`。
 *   · `_a`（= page 的 `ou`）@230151 —— 顺序固定：**图片 → 视频 → 音频 → 文本**。
 *   · `$1`（page）—— 图片卡专用：只传 `orderedImages + orderedTexts`。
 *   · `og`（= page 的 `Eb`）—— token 语法 `{{Image N}} / {{Video N}} / {{Audio N}} / {{Text N}}`；
 *        `Eb(text, before, after)`：token 在 before 找不到 ⇒ 原样保留；找到且该引用在 after 仍在 ⇒
 *          重写成 `{{after.renderText}}`；找到但 after 已无 ⇒ **删掉该 token**（并吃掉其前导空格）。
 */
import type { Node as RFNode, Edge } from '@xyflow/react';

export type ReferenceKind = 'image' | 'video' | 'audio' | 'text';

/** `dm` 的产物：一条上游引用（未编号） */
export interface UpstreamReference {
  edgeId: string;
  /** 官方 `Ih(edge)`：入边排序键（MTV 用 `data.order`） */
  order: number;
  nodeId: string;
  kind: ReferenceKind;
  url: string;
  title: string;
  /** 仅文本卡有 */
  textContent?: string;
}

/** `ew` 的产物：带编号的引用条目（prompt 里用 `renderText` 作为 token 名） */
export interface ReferenceEntry {
  id: string;
  label: string;
  renderText: string;
  type: ReferenceKind;
  url?: string;
  textContent?: string;
}

/** 官方 token 正则（`Dhe`） */
export const REFERENCE_TOKEN_RE = /\{\{(Image|Video|Audio|Text) (\d+)\}\}/g;

const KIND_LABEL: Record<ReferenceKind, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  text: 'Text',
};

/** 官方 `_a` 的固定顺序 */
const KIND_ORDER: readonly ReferenceKind[] = ['image', 'video', 'audio', 'text'];

/** MTV 节点类型 → 官方引用类别 */
export function referenceKindOfNodeType(type: string | undefined): ReferenceKind | null {
  switch (type) {
    case 'ai-image':
    case 'source-image':
    case 'ai-panorama':
      return 'image';
    case 'ai-video':
    case 'source-video':
    case 'ai-animation':
      return 'video';
    case 'ai-audio':
    case 'source-audio':
      return 'audio';
    case 'ai-text':
    case 'source-text':
    case 'ai-markdown':
      return 'text';
    default:
      return null;
  }
}

/** 上游卡的媒体地址：官方取 `data.src`；MTV 的卡把媒体放在各自的 url 字段上 */
export function referenceUrlOfData(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  for (const key of ['src', 'imageUrl', 'videoUrl', 'audioUrl', 'thumbnailUrl']) {
    const value = d[key];
    if (typeof value === 'string' && value) return value;
  }
  return '';
}

export function referenceTitleOfData(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const label = (data as Record<string, unknown>).title ?? (data as Record<string, unknown>).label;
  return typeof label === 'string' ? label : '';
}

export function referenceTextOfData(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const text = (data as Record<string, unknown>).text
    ?? (data as Record<string, unknown>).output;
  return typeof text === 'string' ? text : '';
}

/**
 * 官方 `dm`：收集某个卡的上游引用（入边 + 按 `Ih` 排序 + 取值 + 过滤）。
 * ⚠️ 过滤规则逐字照官方：`!url && kind !== 'text'` 的源**跳过**（只有文本卡可以没有 src）。
 * ⚠️⚠️ **空内容的文本卡也照出**（官方 `r0`/`eme` 对 text 档就是「icon 缩略图窗口 + hover 预览卡」，
 *      有没有正文都给一颗）——MTV 原来为了「prompt token 编号一致」把空文本跳过 ✗
 *      ⇒ 用户：「text 进入时不会被@，是以**缩略图窗口形式**[在]**焦点编辑行**出现，且有 hover」✓
 *      （实测：官方 9444 的生成卡 @ 候选里 `Text` 就在第 #6 位；顶行也是同一份列表）
 */
export function collectUpstreamReferences(
  targetId: string,
  edges: readonly Edge[],
  nodesById: ReadonlyMap<string, RFNode>,
): UpstreamReference[] {
  /* 官方 `gPe`（`vendor-pkg-canvas-CvbAwZyy.js` @747916 邻域，逐字）：
     ```js
     function gPe({configuredValue:e, edges:t, nodes:n, nodeId:o}){
       if(e!==void 0) return e;
       const r = new Set(t.filter(i=>i.target===o && vu(i.data?.purpose)).map(i=>i.source));   // ← 目标 + purpose 过滤 + **Set 去重**
       return HZ(n.filter(i=>r.has(i.id))) }
     ```
     ⇒ **官方的引用行也是先按 `source` 去重再映射成节点**：同一张上游卡连了多条边，官方只出一颗 chip。
     （第 65 轮修正：MTV 先前按**边**出条目 ⇒ 同源双线会出两颗，与官方不符；与 `Cee`/`Sc` 的去重口径现已一致。）
     去重发生在 kind/url 过滤**之前**（官方的 `Set` 建在 map(source) 上）⇒ 这里同样先记 seen 再判类型。 */
  const seenSources = new Set<string>();
  return edges
    .filter((edge) => edge.target === targetId)
    .slice()
    .sort((a, b) => edgeOrder(a) - edgeOrder(b))
    .flatMap((edge) => {
      if (seenSources.has(edge.source)) return [];
      seenSources.add(edge.source);
      const source = nodesById.get(edge.source);
      if (!source) return [];
      const kind = referenceKindOfNodeType(source.type);
      if (!kind) return [];
      const data = (source.data ?? {}) as Record<string, unknown>;
      const url = referenceUrlOfData(data);
      const textContent = referenceTextOfData(data);
      /* 文本档始终保留（空正文也给 chip）；其它档没有 url 才跳过 ✓ */
      if (kind !== 'text' && !url) {
        return [];
      }
      return [{
        edgeId: edge.id,
        order: edgeOrder(edge),
        nodeId: source.id,
        kind,
        url,
        title: referenceTitleOfData(data),
        ...(kind === 'text' ? { textContent } : {}),
      }];
    });
}

function edgeOrder(edge: Edge): number {
  const order = (edge.data as { order?: unknown } | undefined)?.order;
  return typeof order === 'number' && Number.isFinite(order) ? order : 0;
}

/* ------------------------------------------------------------------ *
 * 官方「上游连线素材计数」（`parentCounts`）：`LXe` → `Sc` → `_p`/`x9` 的输入
 * ------------------------------------------------------------------ *
 * 官方出处（`vendor-pkg-canvas-CvbAwZyy.js`，逐字）：
 * ```js
 * // @1044905  `Cee` = 该节点**全部入边的 source**（去重，React Flow 的 target handle 查询）
 * const Cee=e=>{const t=d1({id:e,handleType:"target"});return a.useMemo(()=>!e||!t?[]:[...new Set(t.map(o=>o.source))],[e,t])},
 * // @1045039  `Ac(e,t)` = 入边 source → 节点对象（**不去重、不筛内容**，可选按类型过滤）
 *       Ac=(e,t)=>{const n=Cee(e),o=ki(n);return{parentNodes:a.useMemo(()=>!o||o.length===0?[]:o.filter(i=>i!==void 0&&(!t||i.type===t)),[o,t])}},
 * // @731952  `vu(e)` = 边的 purpose 过滤：**空 或 `'generation-input'`**
 * function vu(e){return e==null||e==="generation-input"}
 * // @810176  `Sc(nodes)` = 按节点类型分三类计数（就是 `parentCounts` 的三元组）
 * Sc=e=>{const t=e.filter(r=>r.type===Z.IMAGE).length,
 *             n=e.filter(r=>r.type===Z.VIDEO||r.type===Z.VIDEO_EDIT).length,
 *             o=e.filter(r=>r.type===Z.AUDIO).length;return{imageCount:t,videoCount:n,audioCount:o}},
 * // @1991414  `LXe` = 视频节点 hook：parentCounts 只算「generation-input」入边带进来的父节点
 * const{parentNodes:o}=Ac(e),r=cn(f=>f.edges),
 *       i=a.useMemo(()=>{const f=new Set(r.filter(h=>h.target===e&&vu(h.data?.purpose)).map(h=>h.source));return o.filter(h=>f.has(h.id))},[o,r,e]),
 *       l=a.useMemo(()=>Sc(i),[i]), … return{…, parentCounts:l, …}
 * // @2037060  `CQe` 消费端
 * const N=a.useCallback(E=>{…; let k=Uhe(E,o.imageCount,o.videoCount,o.audioCount); …},[…]),
 *       … s.jsx(Bhe,{model:t,imageCount:o.imageCount,videoCount:o.videoCount,audioCount:o.audioCount,…})
 * // @2074414  面板把 `parentCounts` 交给选择器：`s.jsx(CQe,{model:o.model,nodeId:e,parentCounts:u,disabled:A})`
 * ```
 * ⇒ 官方语义 = 「**目标节点的 generation-input 入边所带进来的上游节点**，按类型分三类计数」。
 *
 * ⚠️⚠️ **MTV 侧的一处刻意收窄（必须记账）**：
 *   官方 `Sc` 只看**节点类型**，**不要求上游节点有内容**（没出图的图片卡也算 1 张图）。
 *   MTV 的媒体节点是「先建卡、后出图」，卡片常处于无媒体态；而 MTV 的「上游引用」语义
 *   （`collectUpstreamReferences`，与官方 `Mc` @747916 同源）**要求媒体档有 url、文本档有正文**。
 *   两套口径若各用各的，会出现「底行引用 chip 是空的、但 variant 却按有图选」的自相矛盾。
 *   ⇒ 这里复用 `referenceKindOfNodeType`（保证与引用行**同源**），并按 `collectUpstreamReferences`
 *     的取址/过滤口径计数；即**官方的 purpose 过滤保留，官方「不看内容」收紧为「看内容」**。
 *   另：MTV 的 `NodeType` 与官方 `Z` 枚举不同名，映射见 `referenceKindOfNodeType`
 *   （`ai-animation → video`、`ai-panorama → image`、`ai-markdown → text` 为 MTV 独有并表；
 *    官方的 `VIDEO_EDIT` 在 MTV 里没有独立节点类型）。
 */

/**
 * 官方 `vu`（canvas:@731952）逐字：`purpose` 为空 或 `'generation-input'` 才算「生成输入」边。
 * （与 `utils/officialBatchEdges.ts` 的 `isOfficialGenerationInputEdge`（官方 `Gg` @668599）
 *   是同一个谓词的两个官方副本；这里按官方**画布 chunk** 的那份复用。）
 */
export function isGenerationInputPurpose(purpose: unknown): boolean {
  return purpose == null || purpose === 'generation-input';
}

/**
 * 官方 `LXe` 的 `parentCounts`（canvas:@1991414 → `Sc` @810176）在 MTV 的等价实现：
 * **目标节点入边（generation-input）带进来的上游素材**，按 image/video/audio 三类计数。
 *
 * @param targetId 目标节点（视频节点）
 * @param edges    画布现有边
 * @param nodes    画布节点（与画布 store 里同一份数组；内部自建 `id → node` 索引）
 */
export function collectParentReferenceCounts(
  targetId: string,
  edges: readonly Edge[],
  nodes: readonly RFNode[],
): { imageCount: number; videoCount: number; audioCount: number } {
  const nodesById = new Map(nodes.map((item) => [item.id, item] as const));
  const counts = { imageCount: 0, videoCount: 0, audioCount: 0 };
  /* 官方 `Cee`（canvas:@1044905，逐字 `[...new Set(入边 source)]`）**先按 source 去重**：
     同一张卡双线连到目标节点只算**一个**父节点。
     （第 65 轮修正：此前 MTV 按**边**计数 ⇒ 双线会算 2，与官方不符。见记录 §71 D2。） */
  const sources = new Set<string>();
  for (const edge of edges) {
    if (edge.target !== targetId) continue;
    if (!isGenerationInputPurpose((edge.data as { purpose?: unknown } | undefined)?.purpose)) continue;
    if (edge.source) sources.add(edge.source);
  }
  for (const sourceId of sources) {
    const source = nodesById.get(sourceId);
    if (!source) continue;
    const kind = referenceKindOfNodeType(source.type);
    if (!kind) continue;
    /* 文本档不计入这三类（官方 `Sc` 只对 `Z.TEXT` 之外的三类计数）。 */
    if (kind === 'text') continue;
    /* 官方 `Sc`（canvas:@810176，逐字 `{imageCount:filter(Z.IMAGE).length, videoCount:filter(Z.VIDEO||Z.VIDEO_EDIT).length,
       audioCount:filter(Z.AUDIO).length}`）**只看节点类型、不要求上游已有媒体地址**
       —— 连了一张**还没出图**的图片卡，官方照样算 1 张。
       （第 65 轮修正：此前 MTV 跳过无媒体地址的卡 ⇒ 计 0，与官方不符。见记录 §71 D1。） */
    if (kind === 'image') counts.imageCount += 1;
    else if (kind === 'video') counts.videoCount += 1;
    else if (kind === 'audio') counts.audioCount += 1;
  }
  return counts;
}

/** 官方 `ew(list, kind)`：每个类**各自**从 1 编号，`label = title || renderText` */
export function buildReferenceEntries(entries: readonly UpstreamReference[]): ReferenceEntry[] {
  const out: ReferenceEntry[] = [];
  for (const kind of KIND_ORDER) {
    const list = entries.filter((entry) => entry.kind === kind);
    list.forEach((entry, index) => {
      if (kind === 'text' ? !entry.textContent : !entry.url) return;
      const renderText = `${KIND_LABEL[kind]} ${index + 1}`;
      out.push({
        id: entry.nodeId,
        label: entry.title || renderText,
        renderText,
        type: kind,
        ...(kind === 'text' ? { textContent: entry.textContent } : { url: entry.url }),
      });
    });
  }
  return out;
}

/** 官方 `ou`：引用列表 → prompt 里的引用片段（图片→视频→音频→文本，由 `buildReferenceEntries` 保证顺序） */
export function referenceEntriesForPrompt(
  entries: readonly UpstreamReference[],
  kinds: readonly ReferenceKind[] = KIND_ORDER,
): ReferenceEntry[] {
  const filtered = kinds === KIND_ORDER ? entries : entries.filter((entry) => kinds.includes(entry.kind));
  return buildReferenceEntries(filtered).filter((entry) => kinds.includes(entry.type));
}

/**
 * 官方 `$1`：**图片卡**在「断/改边重写 prompt」这条路径上只传 `orderedImages + orderedTexts`。
 * ⚠️ 这是源码在该路径上的写法，不代表图片卡在别处不能引用视频/音频 —— 待后续核对（用户已提醒勿过度推断）。
 */
export function imageCardReferenceEntries(entries: readonly UpstreamReference[]): ReferenceEntry[] {
  return referenceEntriesForPrompt(entries, ['image', 'text']);
}

/**
 * 官方 `Eb`（= `og`）：按 before/after 两张引用表重写 prompt 里的引用 token。
 *   · token 在 before 找不到 ⇒ 原样保留
 *   · 找到且该引用在 after 仍在 ⇒ 重写成 `{{after.renderText}}`
 *   · 找到但 after 已无 ⇒ 删掉该 token（并吃掉其前导空格）
 */
export function rewriteReferenceTokens(
  text: string,
  before: readonly ReferenceEntry[],
  after: readonly ReferenceEntry[],
): string {
  if (!text) return text;
  const beforeByToken = new Map(before.map((entry) => [entry.renderText, entry]));
  const afterById = new Map(after.map((entry) => [entry.id, entry]));
  let out = '';
  let last = 0;
  for (const match of text.matchAll(REFERENCE_TOKEN_RE)) {
    const [full, kind, index] = match;
    const at = match.index ?? 0;
    const hit = beforeByToken.get(`${kind} ${index}`);
    const chunk = text.slice(last, at);
    if (!hit) {
      out += chunk + full;
      last = at + full.length;
      continue;
    }
    const next = afterById.get(hit.id);
    if (next) {
      out += `${chunk}{{${next.renderText}}}`;
    } else {
      out += chunk.replace(/[ \t]+$/, '');
    }
    last = at + full.length;
  }
  return out + text.slice(last);
}
