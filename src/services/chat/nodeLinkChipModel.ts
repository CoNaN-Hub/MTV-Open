/**
 * nodeLinkChipModel —— 官方「画布节点 chip」（`DF`，`displayName="NodeLink"`）用到的**纯函数**逐字移植。
 *
 * 官方逐字（live `vendor-pkg-canvas-ChpWx5JY.js`）：
 * ```js
 * // @2413076  kot：chip 文案四档
 * kot = ({dataTitle, payloadTitle, nodeExists, nodeType, tool, t}) => {
 *   if (dataTitle) return dataTitle;
 *   if (payloadTitle) return payloadTitle;
 *   if (nodeExists) { const l = nodeType || "node"; return t(`chatAdapter.agentEvent.nodeTypes.${l}`, l); }
 *   return oT(tool, t);
 * };
 *
 * // @428153  oT：工具名未知时的兜底文案（第 3 参 `n` 是 phase；`DF` 只传 2 个 ⇒ n === undefined）
 * oT = (e, t, n) => {
 *   if (t) {
 *     if (n) { const r = `chatAdapter.agentEvent.toolLabels.${e}_${n}`, i = t(r, ""); if (i) return i; }
 *     const o = t(`chatAdapter.agentEvent.toolLabels.${e}`, ""); if (o) return o;
 *     if (n) { const i = t(`chatAdapter.agentEvent.toolLabels.generic_${n === "pending" ? "started" : n}`, ""); if (i) return i; }
 *   }
 *   return e.replace(/_/g, " ").replace(/^./, o => o.toUpperCase());
 * };
 *
 * // @427152  ND(type, src)：缩略图地址（只有图片/视频有）
 * ND = (e, t) => t ? (e === X.IMAGE ? pn(t, $t.SMALL)
 *                   : (e === X.VIDEO || e === X.VIDEO_EDIT) ? pn(t, $t.THUMBNAIL) : "") : "";
 *
 * // @427246  nT(type)：占位 glyph 类型
 * nT = e => { switch (e) {
 *   case X.TEXT: case X.DOC_EDITOR: return "text";
 *   case X.VIDEO: case X.VIDEO_EDIT: return "video";
 *   case X.AUDIO: return "audio";
 *   case X.IMAGE: return "image";
 *   default: return "file"; } };
 *
 * // @143864  X = NodeType 枚举（逐字）
 * X = (e => (e.IMAGE = "image", e.VIDEO = "video", e.PLAYLIST = "playlist", e.AUDIO = "audio",
 *   e.VIDEO_EDIT = "videoEdit", e.GACHA = "gacha", e.THREED = "threed",
 *   e.THREE_D_STUDIO = "threeDStudio", e.THREE_D_STUDIO_V2 = "three-d-studio-v2", e.TEXT = "text",
 *   e.DOC_EDITOR = "doc-editor", e.AI_TABLE_EDITOR = "ai-table-editor", e.PPT = "ppt", e.CSV = "csv",
 *   e.COMMAND = "command", e.COMMENT = "comment", e.EMPTY = "empty", e.GROUP = "group",
 *   e.PILE = "pile", e.UNCLONABLE = "unclonable", e))(X || {})
 * ```
 *
 * 缩略图变体（`pn` = `vendor-packages-jvPqKqU8.js` 的 `qu` / `$t` = 同 chunk 的 `Lo`）逐字：
 * ```js
 * Lo = (e => (e.LARGE="large", e.MEDIUM="medium", e.SMALL="small",
 *             e.THUMBNAIL="thumbnail", e.THUMBNAIL_V2="display_hd", e.OSS="oss", e))(Lo || {});
 * function qu(e, t) { if (!e) return; const n = Or(e);
 *   if (t === "oss") { const r = n.includes("?") ? "&" : "?";
 *     return `${n}${r}x-oss-process=image/resize,w_600/quality,q_85/format,webp`; }
 *   if (n.includes("variant_name=")) { const [r, o = ""] = n.split("#", 2), [i, l = ""] = r.split("?", 2),
 *     d = new URLSearchParams(l); d.set("variant_name", t); const u = d.toString();
 *     return `${i}${u ? `?${u}` : ""}${o ? `#${o}` : ""}`; }
 *   const s = n.includes("?") ? "&" : "?"; return `${n}${s}variant_name=${t}`; }
 * ```
 *
 * 三步反解：`kot`/`ND`/`nT`/`oT` 都是 canvas chunk 的**本地**定义（@2413076 / @427152 / @427246 / @428153），
 *   `X` 本地 @143864；`pn`/`$t` 是 import 别名（canvas chunk 头部 `import{A as pn, F as $t}` ⇐
 *   `vendor-packages-jvPqKqU8.js` 的 `export{qu as A, Lo as F}` ⇒ local `qu`@520… / `Lo`@519311）。
 */
import { agentEventString } from './agentEventStrings';

/**
 * 官方 `X`（NodeType 枚举）里与本 chip 相关的字面量（@143864 逐字）。
 * 完整枚举的其余成员（playlist/gacha/threed/…）在本支里只会落到 `default` 分支，
 * 这里保留原名以便与官方源码逐字对照。
 */
export const OFFICIAL_NODE_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  VIDEO_EDIT: 'videoEdit',
  AUDIO: 'audio',
  TEXT: 'text',
  DOC_EDITOR: 'doc-editor',
} as const;

/** 官方 `X` 的**全部**取值（@143864 逐字；用于判「已经是官方字面量」）。 */
const OFFICIAL_NODE_TYPE_VALUES: ReadonlySet<string> = new Set([
  'image', 'video', 'playlist', 'audio', 'videoEdit', 'gacha', 'threed', 'threeDStudio',
  'three-d-studio-v2', 'text', 'doc-editor', 'ai-table-editor', 'ppt', 'csv', 'command',
  'comment', 'empty', 'group', 'pile', 'unclonable',
]);

/**
 * ⚠️ MTV 适配点：官方 `X` 的字面量是 `image` / `video` / `videoEdit` / `text` / `doc-editor` …，
 * 而 MTV 的 `NodeType`（`src/types/index.ts` @109）用 `ai-*` / `source-*` 命名 ⇒ 先归一到官方字面量，
 * 再走官方的 `nT` switch（语义归类与 `components/chat/ChatPanel.tsx` @856 的 `Dle(node.type)` 一致）。
 */
const MTV_NODE_TYPE_TO_OFFICIAL: Readonly<Record<string, string>> = {
  'ai-image': OFFICIAL_NODE_TYPE.IMAGE,
  'ai-panorama': OFFICIAL_NODE_TYPE.IMAGE,
  'source-image': OFFICIAL_NODE_TYPE.IMAGE,
  'compare': OFFICIAL_NODE_TYPE.IMAGE,
  'ai-video': OFFICIAL_NODE_TYPE.VIDEO,
  'ai-animation': OFFICIAL_NODE_TYPE.VIDEO,
  'source-video': OFFICIAL_NODE_TYPE.VIDEO,
  'ai-audio': OFFICIAL_NODE_TYPE.AUDIO,
  'source-audio': OFFICIAL_NODE_TYPE.AUDIO,
  'ai-text': OFFICIAL_NODE_TYPE.TEXT,
  'ai-markdown': OFFICIAL_NODE_TYPE.TEXT,
  'ai-shotlist': OFFICIAL_NODE_TYPE.TEXT,
  'ai-storyboard': OFFICIAL_NODE_TYPE.TEXT,
  'ai-director': OFFICIAL_NODE_TYPE.TEXT,
  'source-text': OFFICIAL_NODE_TYPE.TEXT,
  'canvas-note': OFFICIAL_NODE_TYPE.TEXT,
};

/** 把 MTV / 官方任一形态的节点类型归一到官方 `X` 字面量（已归一或未知时原样返回）。 */
export function officialNodeTypeOf(type: string | undefined | null): string | undefined {
  if (!type) return undefined;
  if (OFFICIAL_NODE_TYPE_VALUES.has(type)) return type;
  return MTV_NODE_TYPE_TO_OFFICIAL[type] ?? type;
}

/** 官方 `nT(type)`：占位 glyph 类型（chip 的 `placeholderType`）。 */
export function nodeLinkPlaceholderType(type: string | undefined | null): 'text' | 'video' | 'audio' | 'image' | 'file' {
  switch (officialNodeTypeOf(type)) {
    case OFFICIAL_NODE_TYPE.TEXT:
    case OFFICIAL_NODE_TYPE.DOC_EDITOR:
      return 'text';
    case OFFICIAL_NODE_TYPE.VIDEO:
    case OFFICIAL_NODE_TYPE.VIDEO_EDIT:
      return 'video';
    case OFFICIAL_NODE_TYPE.AUDIO:
      return 'audio';
    case OFFICIAL_NODE_TYPE.IMAGE:
      return 'image';
    default:
      return 'file';
  }
}

/** 官方 `$t`（图片变体枚举，@519311 邻域逐字）。 */
export const IMAGE_VARIANT = {
  LARGE: 'large',
  MEDIUM: 'medium',
  SMALL: 'small',
  THUMBNAIL: 'thumbnail',
  THUMBNAIL_V2: 'display_hd',
  OSS: 'oss',
} as const;

/** 官方 `pn(src, variant)`（`qu`）。 */
export function imageVariantUrl(src: string, variant: string): string {
  if (!src) return src;
  /* ⚠️ MTV 适配点：官方 `Or(e)` 归一化的是 CDN 绝对地址；MTV 的图片常是 `asset://` / `blob:` / `data:`
     ⇒ 加 `?variant_name=` 反而取不到图（同一结论见 `nodes/shared/image/NodeImageHistoryGallery.tsx` @57）。 */
  if (!/^https?:/i.test(src)) return src;
  const url = src;
  if (variant === IMAGE_VARIANT.OSS) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}x-oss-process=image/resize,w_600/quality,q_85/format,webp`;
  }
  if (url.includes('variant_name=')) {
    const [beforeHash, hash = ''] = url.split('#', 2);
    const [path, query = ''] = beforeHash.split('?', 2);
    const params = new URLSearchParams(query);
    params.set('variant_name', variant);
    const next = params.toString();
    return `${path}${next ? `?${next}` : ''}${hash ? `#${hash}` : ''}`;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}variant_name=${variant}`;
}

/** 官方 `ND(type, src)`：缩略图地址（非图片/视频恒 `""`）。 */
export function nodeLinkThumb(type: string | undefined | null, src: string): string {
  if (!src) return '';
  const official = officialNodeTypeOf(type);
  if (official === OFFICIAL_NODE_TYPE.IMAGE) return imageVariantUrl(src, IMAGE_VARIANT.SMALL);
  if (official === OFFICIAL_NODE_TYPE.VIDEO || official === OFFICIAL_NODE_TYPE.VIDEO_EDIT) {
    return imageVariantUrl(src, IMAGE_VARIANT.THUMBNAIL);
  }
  return '';
}

/** 用官方 `chatAdapter.agentEvent.*` 表取值；缺键返回 `''`（对应官方 i18next 的 `t(key, "")`）。 */
function readAgentEvent(path: string, locale: string): string {
  const text = agentEventString(path, locale);
  return text === path ? '' : text;
}

/**
 * 官方 `oT(tool, t, phase)`：工具名未知时的兜底文案。
 * 官方表里每个工具名都有 `<tool>` / `<tool>_<phase>` / `generic_<phase>` 三类词条。
 */
export function resolveUnknownToolLabel(tool: string, locale: string, phase?: string): string {
  if (locale) {
    if (phase) {
      const phased = readAgentEvent(`toolLabels.${tool}_${phase}`, locale);
      if (phased) return phased;
    }
    const plain = readAgentEvent(`toolLabels.${tool}`, locale);
    if (plain) return plain;
    if (phase) {
      const generic = readAgentEvent(`toolLabels.generic_${phase === 'pending' ? 'started' : phase}`, locale);
      if (generic) return generic;
    }
  }
  return tool.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase());
}

/** 官方 `kot({dataTitle, payloadTitle, nodeExists, nodeType, tool, t})`：chip 文案四档。 */
export function resolveNodeLinkLabel({
  dataTitle,
  payloadTitle,
  nodeExists,
  nodeType,
  tool,
  locale,
}: {
  dataTitle?: string;
  payloadTitle?: string;
  nodeExists: boolean;
  nodeType?: string;
  tool: string;
  locale: string;
}): string {
  if (dataTitle) return dataTitle;
  if (payloadTitle) return payloadTitle;
  if (nodeExists) {
    const key = nodeType || 'node';
    const text = agentEventString(`nodeTypes.${key}`, locale);
    return text === `nodeTypes.${key}` ? key : text;
  }
  return resolveUnknownToolLabel(tool, locale);
}

/**
 * 官方 `DF` 里 `p = typeof u.src === "string" ? u.src : ""` —— 缩略图源。
 * ⚠️ MTV 适配点：MTV 的 `BaseNodeData` 没有 `src`（图片是 `thumbnailUrl`/`imageUrl`，
 * 视频是 `videoUrl`/`mediaUrl`）⇒ 官方字段优先，缺失时按 MTV 字段回落
 * （同一结论见 `components/chat/ChatPanel.tsx` @866 的注释）。
 */
export function nodeLinkSource(data: unknown, type?: string | null): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  if (typeof record.src === 'string' && record.src) return record.src;
  const pick = (...keys: readonly string[]): string => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value) return value;
    }
    return '';
  };
  const official = officialNodeTypeOf(type);
  if (official === OFFICIAL_NODE_TYPE.IMAGE) return pick('thumbnailUrl', 'imageUrl', 'output');
  if (official === OFFICIAL_NODE_TYPE.VIDEO || official === OFFICIAL_NODE_TYPE.VIDEO_EDIT) {
    return pick('videoUrl', 'mediaUrl', 'output', 'thumbnailUrl');
  }
  if (official === OFFICIAL_NODE_TYPE.AUDIO) return pick('mediaUrl', 'audioUrl', 'output');
  return '';
}

/**
 * `DF` 里 `dataTitle: u.title` —— 官方节点的标题字段是 `data.title`。
 * MTV 的标题字段叫 `data.label`（`BaseNodeData.label` 必填）⇒ 依次回落。
 */
export function nodeLinkDataTitle(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  if (typeof record.title === 'string' && record.title) return record.title;
  if (typeof record.label === 'string' && record.label) return record.label;
  return undefined;
}

/**
 * 官方 `Ac()`（canvas @150174）—— 画布控制器：
 * ```js
 * function Ac() {
 *   const {fitView: e} = ut();               // useReactFlow()
 *   const n = kc()?.focusCanvasNodes;        // 画布宿主注入的「定位节点」控制器（可选）
 *   return { fitView: a.useCallback(async r => {
 *     if (!n) return e(r);
 *     const i = r?.nodes?.map(l => l.id) ?? [];
 *     return i.length ? (n(i), !0) : !1;
 *   }, [e, n]) };
 * }
 * ```
 * 官方调用点（`DF`）：`fitView({nodes:[{id: nodeId}], padding:1, maxZoom:2, minZoom:.5, duration:500})`。
 *
 * ⚠️ MTV 适配点：MTV 的聊天面板与 `Canvas` 是**兄弟节点**，聊天面板不在 `ReactFlowProvider` 之内
 *   （`App.tsx` @509/@524），组件里直接 `useReactFlow()/useStore()` 会抛错 ⇒ 复用仓库现成的
 *   「画布定位节点」事件通道（`AssetsPanel.tsx` @368 / `CharacterLibraryPanel.tsx` @446 /
 *   `ScriptWorkbench.tsx` @354 三处同款），它最终就是 `reactFlowInstance.fitView(...)`。
 *   需要覆盖时由调用方注入 `onFocusNode`。
 */
export function focusCanvasNode(nodeId: string): void {
  window.dispatchEvent(new CustomEvent('canvas-focus-nodes', {
    detail: { nodeIds: [nodeId], padding: 1, maxZoom: 2, duration: 500 },
  }));
}
