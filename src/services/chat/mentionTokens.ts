/**
 * 官方「提及 token」纯函数层 —— live `vendor-pkg-canvas-ChpWx5JY.js` 逐字移植。
 *
 * 官方符号 → 本文件（全部来自 `live-ProseMirror-提及输入内核.md` §4）：
 *   `oD`/`gK`/`hwe`/`xK`/`Tf`/`gwe` @209257 邻域  严格 token 文法
 *   `hK`  @209257 邻域  正整数 & ≤ int64 上限校验
 *   `mwe` 生成 token · `fwe` 解析 token · `du` 严格 token 解析 · `$1` 严格文法解析
 *   `Ef`/`nc` @209549  缓存键 `kind/id`
 *   `sD`/`bx`/`Eh`/`xwe` @209829  资产预览 LRU 缓存（上限 200）
 *   `BV`/`grt` @2548895  兜底标题 `node_<前6位>` / `file_<前6位>`
 *   `Uc` @2548895  HTML 转义 · `UF` 值扫描正则 · `xrt` 空白归一 · `yrt`/`brt`
 *   `Wie` @2549511  token → 提及描述符
 *   `vrt` / `wrt`  value → 提及表 / value → HTML
 *   `Hq`/`D1`/`Mve`/`Pve` @150830  通用 token（`{{kind:payload}}`）与插件 token
 *
 * 说明：`wd`(技能查询) / `wp`(资产库路径查询) / `Sf`(插件展示名) / 资产预览缓存 在官方来自 store，
 * 这里以**注入**形式保留（`MentionLookups`），不猜测其实现。
 */

/* ── 严格 token 文法（逐字） ── */
const ID_CHARS = '[^{}\\s/]+';
const NODE_TOKEN = `node\\/${ID_CHARS}`;
const LIBRARY_TOKEN = '(?:library_asset|library_folder|element)\\/[1-9]\\d*';
/** 官方 `xK`。 */
const STRICT_BODY = `(?:${NODE_TOKEN}|${LIBRARY_TOKEN})`;
/** 官方 `Tf`：`{{<xK>}}`。 */
export const STRICT_MENTION_TOKEN = `\\{\\{${STRICT_BODY}\\}\\}`;
/** 官方 `UF`：值扫描正则（严格 token **或** 通用 `{{kind:payload}}`）。 */
export const MENTION_VALUE_PATTERN = `${STRICT_MENTION_TOKEN}|\\{\\{[a-zA-Z0-9_-]+:[^}]+\\}\\}`;
/** 官方 `Hq`：通用 token 捕获正则。 */
export const GENERIC_MENTION_TOKEN = /\{\{([a-zA-Z0-9_-]+):([^}]+)\}\}/g;

/** 官方把 int64 上限写成字符串常量。 */
const INT64_MAX = '9223372036854775807';

/** 官方 `hK`：正整数字符串且 ≤ int64 上限。 */
export function isPositiveInt64(value: string): boolean {
  if (!/^[1-9]\d*$/.test(value) || value.length > INT64_MAX.length) return false;
  return !(value.length === INT64_MAX.length && value > INT64_MAX);
}

/** 官方 `mwe`：生成 `{{<prefix><id>}}` 或 `{{<prefix><id>:<encodeURIComponent(label)>}}`。 */
export function buildMentionToken(prefix: string, { id, label }: { id: string; label: string }): string {
  const trimmed = label.trim();
  return trimmed ? `${prefix}${id}:${encodeURIComponent(trimmed)}` : `${prefix}${id}`;
}

/** 官方 `fwe`：解析 `<prefix><id>[:<label>]`。 */
export function parseMentionToken(token: string, prefix: string): { id: string; label: string } | null {
  if (!token.startsWith(prefix)) return null;
  const rest = token.slice(prefix.length);
  const colon = rest.indexOf(':');
  if (colon < 0 || colon === 0) return null;
  const id = rest.slice(0, colon);
  if (!isPositiveInt64(id)) return null;
  const raw = rest.slice(colon + 1);
  if (!raw) return null;
  try {
    const label = decodeURIComponent(raw);
    if (!label.trim() || encodeURIComponent(label) !== raw) return null;
    return { id, label };
  } catch {
    return null;
  }
}

/** 官方 `$1`：严格文法解析（`node/<id>` 或 `library_asset|library_folder|element/<正整数>`）。 */
export function parseStrictBody(body: string): { kind: 'node' | 'library_asset' | 'library_folder' | 'element'; id: string } | null {
  const nodeMatch = new RegExp(`^node\\/(${ID_CHARS})$`).exec(body);
  if (nodeMatch) return { kind: 'node', id: nodeMatch[1] };
  const libraryMatch = /^(library_asset|library_folder|element)\/([1-9]\d*)$/.exec(body);
  if (libraryMatch) return { kind: libraryMatch[1] as 'library_asset' | 'library_folder' | 'element', id: libraryMatch[2] };
  return null;
}

/** 官方 `du`：只认严格 token。 */
export function parseStrictMentionToken(token: string): { kind: 'node' | 'library_asset' | 'library_folder' | 'element'; id: string } | null {
  const trimmed = token.trim();
  if (!trimmed.startsWith('{{') || !trimmed.endsWith('}}')) return null;
  return parseStrictBody(trimmed.slice(2, -2));
}

/** 官方保留 kind（`Mve`）：这些 kind 走 `D1` 的专用分支，其余 kind 一律当插件名。 */
const RESERVED_KINDS = new Set([
  'quoted_text', 'node_id', 'file_ref', 'library_path', 'skill', 'brainstorm', 'ElementRef', 'Asset',
]);

/** 官方 `D1`：`{{kind:payload}}` → 结构化描述。 */
export function parseGenericMentionToken(kind: string, payload: string): ParsedMentionToken | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;
  switch (kind) {
    case 'skill': return { kind: 'skill', payload: trimmed };
    case 'brainstorm': return { kind: 'brainstorm' };
    case 'node_id': return { kind: 'node_id', id: trimmed };
    case 'file_ref': return { kind: 'file_ref', id: trimmed };
    case 'quoted_text': return { kind: 'quoted_text', id: trimmed };
    case 'library_path': return { kind: 'library_path', id: trimmed };
    default: break;
  }
  if (RESERVED_KINDS.has(kind)) return null;
  const skillName = trimmed.split(':')[0]?.trim() ?? trimmed;
  return { kind: 'plugin', pluginName: kind, skillName };
}

export type ParsedMentionToken =
  | { kind: 'skill'; payload: string }
  | { kind: 'brainstorm' }
  | { kind: 'node_id' | 'file_ref' | 'quoted_text' | 'library_path'; id: string }
  | { kind: 'plugin'; pluginName: string; skillName: string };

/** 官方 `Pve`：插件 token 的 renderText。 */
export function pluginRenderText(pluginName: string, skillName: string): string {
  return `plugin:${pluginName}:${skillName}`;
}

/** 官方 `$q`：解析 `plugin:<name>:<skill>`。 */
export function parsePluginRenderText(value: string): { pluginName: string; skillName: string } | null {
  if (!value.startsWith('plugin:')) return null;
  const rest = value.slice(7);
  const colon = rest.indexOf(':');
  if (colon < 0) {
    const name = rest.trim();
    return name ? { pluginName: name, skillName: name } : null;
  }
  const pluginName = rest.slice(0, colon).trim();
  const skillName = rest.slice(colon + 1).trim();
  return pluginName ? { pluginName, skillName: skillName || pluginName } : null;
}

/* ── 缓存键 / 转义 / 兜底标题（逐字） ── */

/** 官方 `nc`。 */
export function mentionCacheKey(parsed: { kind: string; id: string }): string {
  return `${parsed.kind}/${parsed.id}`;
}

/** 官方 `Ef`（与 `nc` 同式）。 */
export function mentionDisplayKey(parsed: { kind: string; id: string }): string {
  return `${parsed.kind}/${parsed.id}`;
}

/** 官方 `Uc`。 */
export function escapeMentionHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 官方 `BV`：节点提及的兜底标题。 */
export function nodeFallbackTitle(id: string): string {
  return `node_${id.slice(0, 6)}`;
}

/** 官方 `grt`：文件提及的兜底标题。 */
export function fileFallbackTitle(id: string): string {
  return `file_${id.slice(0, 6)}`;
}

/** 官方 `brt`：引用文本标题超过 40 字截断。 */
export function truncateMentionTitle(value: string): string {
  return value.length > 40 ? `${value.slice(0, 40)}…` : value;
}

/** 官方 `yrt`：mentionId（`element` → `library-element:<id>`，其余把 `_` 换成 `-`）。 */
export function mentionIdWithKind(kind: string, id: string): string {
  if (kind === 'node') return id;
  if (kind === 'element') return `library-element:${id}`;
  return `${kind.replace('_', '-')}:${id}`;
}

/** 官方 `xrt`：把几类 token 后面多余的空白压成单个空格。 */
export function normalizeMentionSpacing(value: string): string {
  return value
    .replace(/(\{\{brainstorm:brainstorm\}\})\s+/g, '$1 ')
    .replace(/(\{\{skill:[^}]+\}\})\s+/g, '$1 ')
    .replace(
      /(\{\{(?!quoted_text:|node_id:|file_ref:|library_path:|brainstorm:|skill:|ElementRef:|Asset:)[a-zA-Z0-9_-]+:[^}]+\}\})\s+/g,
      '$1 ',
    );
}

/** 官方 `w_`：长度计算 —— 每个提及 token 只算 1 个字符。 */
export function mentionTextLength(value: string): number {
  return value.replace(new RegExp(MENTION_VALUE_PATTERN, 'g'), 'x').length;
}

/* ── 描述符（`Wie`） ── */

export interface MentionDescriptor {
  title: string;
  mentionType: string;
  mentionId: string;
  renderText: string;
  preview?: MentionPreview | null;
  isActivation?: boolean;
}

export interface MentionPreview {
  label?: string;
  type?: string;
  thumbnail?: string;
  videoSrc?: string;
  mediaType?: string;
  textContent?: string;
}

export interface MentionLookups {
  nodeTitleMap: ReadonlyMap<string, string | undefined>;
  fileTitleMap: ReadonlyMap<string, string | undefined>;
  brainstormLabel: string;
  /** 官方 `bx(parsed)`：资产/元素预览（来自 LRU 缓存）。 */
  previewOf?: (parsed: { kind: string; id: string }) => MentionPreview | null;
  /** 官方 `wd(payload)`：技能查询。 */
  skillOf?: (payload: string) => { label?: string; skillName?: string };
  /** 官方 `wp(id)`：资产库路径查询。 */
  libraryPathOf?: (id: string) => MentionPreview | null;
  /** 官方 `Sf(pluginName)`：插件展示名。 */
  pluginDisplayName?: (pluginName: string) => string;
}

/** 官方 `Wie`：token → 提及描述符（严格 token 分支 + 7 个通用 kind 分支）。 */
export function describeMentionToken(token: string, lookups: MentionLookups): MentionDescriptor | null {
  const parsed = parseStrictMentionToken(token);
  if (parsed) {
    const preview = lookups.previewOf?.(parsed) ?? null;
    return {
      title: parsed.kind === 'node'
        ? (lookups.nodeTitleMap.get(parsed.id) || nodeFallbackTitle(parsed.id))
        : (preview?.label || mentionDisplayKey(parsed)),
      mentionType: parsed.kind === 'node'
        ? 'node'
        : parsed.kind === 'library_folder'
          ? 'library_folder'
          : parsed.kind === 'element'
            ? 'library_element'
            : (preview?.type || 'library_asset'),
      mentionId: mentionIdWithKind(parsed.kind, parsed.id),
      renderText: mentionCacheKey(parsed),
      preview,
    };
  }
  const inner = token.slice(2, -2);
  const colon = inner.indexOf(':');
  if (colon < 0) return null;
  const generic = parseGenericMentionToken(inner.slice(0, colon), inner.slice(colon + 1));
  if (!generic) return null;
  switch (generic.kind) {
    case 'brainstorm':
      return { title: lookups.brainstormLabel, mentionType: 'brainstorm', mentionId: 'brainstorm', renderText: '{{brainstorm:brainstorm}}', isActivation: true };
    case 'skill': {
      const skill = lookups.skillOf?.(generic.payload) ?? {};
      const name = skill.skillName || generic.payload;
      return { title: skill.label || name, mentionType: 'skill', mentionId: name, renderText: `skill:${generic.payload}`, isActivation: true };
    }
    case 'plugin': {
      const display = lookups.pluginDisplayName?.(generic.pluginName) ?? generic.pluginName;
      return { title: display, mentionType: 'plugin', mentionId: generic.pluginName, renderText: pluginRenderText(generic.pluginName, generic.skillName), isActivation: true };
    }
    case 'quoted_text':
      return { title: truncateMentionTitle(generic.id), mentionType: 'node', mentionId: generic.id, renderText: `quoted_text:${generic.id}` };
    case 'library_path': {
      const preview = lookups.libraryPathOf?.(generic.id) ?? null;
      return {
        title: preview?.label || generic.id,
        mentionType: preview?.type === 'folder' ? 'library_folder' : (preview?.type || 'library_path'),
        mentionId: generic.id,
        renderText: `library_path:${generic.id}`,
        preview,
      };
    }
    case 'node_id':
      return {
        title: lookups.nodeTitleMap.get(generic.id) || nodeFallbackTitle(generic.id),
        mentionType: 'node',
        mentionId: generic.id,
        renderText: `node_id:${generic.id}`,
      };
    case 'file_ref':
      return {
        title: lookups.fileTitleMap.get(generic.id) || fileFallbackTitle(generic.id),
        mentionType: 'attachment',
        mentionId: generic.id,
        renderText: `file_ref:${generic.id}`,
      };
    default:
      return null;
  }
}

/** 官方 `vrt`：value → `{[mentionId]: {label, renderText}}`（喂 `updateMentionLabels`）。 */
export function mentionsInValue(value: string, lookups: MentionLookups): Record<string, { label: string; renderText: string }> {
  const out: Record<string, { label: string; renderText: string }> = {};
  for (const match of value.matchAll(new RegExp(MENTION_VALUE_PATTERN, 'g'))) {
    const descriptor = describeMentionToken(match[0], lookups);
    if (descriptor) out[descriptor.mentionId] = { label: descriptor.title, renderText: descriptor.renderText };
  }
  return out;
}

/** 官方 `wrt`：value → 编辑器 HTML（`<p>…<span data-type="mention" …>…</span>…</p>`）。 */
export function valueToEditorHtml(value: string, lookups: MentionLookups): string {
  if (!value) return '<p></p>';
  const normalized = normalizeMentionSpacing(value);
  const pattern = new RegExp(MENTION_VALUE_PATTERN, 'g');
  let html = '';
  let cursor = 0;
  let match = pattern.exec(normalized);
  while (match !== null) {
    const descriptor = describeMentionToken(match[0], lookups);
    if (!descriptor) { match = pattern.exec(normalized); continue; }
    const plain = normalized.slice(cursor, match.index);
    if (plain) html += escapeMentionHtml(plain).replace(/\n/g, '<br>');
    const preview = descriptor.preview;
    const previewAttrs = preview
      ? `${preview.thumbnail ? ` data-thumbnail="${escapeMentionHtml(preview.thumbnail)}"` : ''}`
        + `${preview.videoSrc ? ` data-video-src="${escapeMentionHtml(preview.videoSrc)}"` : ''}`
        + `${preview.mediaType ? ` data-media-type="${escapeMentionHtml(preview.mediaType)}"` : ''}`
        + `${preview.textContent ? ` data-text-content="${escapeMentionHtml(preview.textContent)}"` : ''}`
      : '';
    html += `<span data-type="mention" data-id="${escapeMentionHtml(descriptor.mentionId)}"`
      + ` data-label="${escapeMentionHtml(descriptor.title)}"`
      + ` data-render-text="${escapeMentionHtml(descriptor.renderText)}"`
      + ` data-mention-type="${descriptor.mentionType}"${previewAttrs} class="mention mention-node">`
      + `${escapeMentionHtml(descriptor.title)}</span>`;
    cursor = match.index + match[0].length;
    if (descriptor.isActivation) {
      const whitespace = normalized.slice(cursor).match(/^\s+/)?.[0] ?? '';
      if (whitespace) { html += ' '; cursor += whitespace.length; }
    }
    match = pattern.exec(normalized);
  }
  const tail = normalized.slice(cursor);
  if (tail) html += escapeMentionHtml(tail).replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
}
