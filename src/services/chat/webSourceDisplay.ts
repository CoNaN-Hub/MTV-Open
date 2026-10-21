/**
 * 官方「联网搜索来源」的三个取值函数 —— `page-BeI7xydN.js` 逐字。
 *   `PD(url)`  = hostname 去掉 `www.`
 *   `If(src)`  = `src.favicon ?? Google s2 favicon(hostname)`
 *   `ax(src)`  = 取 `Foe(title)`；结果非空且通过 `Ooe` 校验就用它，否则回落 `PD(url)`
 *   `Foe(t)`   = 按「管道/下划线/中点」或「空格-破折号-空格」切分；>1 段取最后一段；
 *                若该段匹配 `-([\u4e00-\u9fff][^\s\-|｜_·]{1,11})$` 取捕获组，否则（多段时）用该段，单段则空
 *   `Ooe(s)`   = `!(len<2 || len>24 || /https?:|www\./i || /^[\d\s.,:/-]+$/)`
 */

/** 官方 `PD`：取域名（去掉 `www.`）。 */
export function webSourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** 官方 `If`：favicon（没有就用 Google 的 s2 服务，与官方一致）。 */
export function webSourceFavicon(source: { url: string; favicon?: string }): string {
  if (source.favicon) return source.favicon;
  try {
    const host = new URL(source.url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return '';
  }
}

const TITLE_SPLIT = /\s*[|｜_·]\s*|\s+[-—–]\s*/;
const TITLE_TAIL = /-([\u4e00-\u9fff][^\s\-|｜_·]{1,11})$/;
const TITLE_MAX = 24;

/** 官方 `Ooe`。 */
function isUsableTitle(value: string): boolean {
  return !(
    value.length < 2
    || value.length > TITLE_MAX
    || /https?:|www\./i.test(value)
    || /^[\d\s.,:/-]+$/.test(value)
  );
}

/** 官方 `Foe`。 */
function deriveTitleSegment(title: string): string {
  const parts = title.split(TITLE_SPLIT).map((part) => part.trim()).filter(Boolean);
  const multi = parts.length > 1;
  const last = multi ? parts[parts.length - 1] : title;
  return last.match(TITLE_TAIL)?.[1] ?? (multi ? last : '');
}

/** 官方 `ax`：来源展示名。 */
export function webSourceLabel(source: { title?: string; url: string }): string {
  const title = source.title?.trim() ?? '';
  const derived = title ? deriveTitleSegment(title) : '';
  if (derived && isUsableTitle(derived)) return derived;
  return webSourceDomain(source.url);
}

/** 官方 `Xtt = 3`：带图来源少于此数 ⇒ 全部 pill；否则全部卡片。 */
export const WEB_SOURCE_THUMBNAIL_THRESHOLD = 3;

/**
 * 官方 `Qtt(sources)`（`vendor-pkg-canvas` 偏移 2367472，逐字）：
 * ```js
 * Qtt = sources => sources.filter(s => s.image).length < Xtt(3)
 *   ? { cards: [], pills: sources }
 *   : { cards: sources, pills: [] };
 * ```
 * **卡片与 pill 互斥** —— 不是同时渲染两套。
 */
export function splitWebSources<T extends { image?: string }>(sources: readonly T[]): {
  cards: T[];
  pills: T[];
} {
  const withThumbnail = sources.filter((source) => source.image).length;
  return withThumbnail < WEB_SOURCE_THUMBNAIL_THRESHOLD
    ? { cards: [], pills: [...sources] }
    : { cards: [...sources], pills: [] };
}

/* ============================================================================
 * 官方 `fnt`：正文里是否**引用了**来源（决定 `showCardIndex` 是否给来源卡编号）
 * ============================================================================ */

/** 官方 `dnt`：`[N](https://…)` 形式的行内链接。 */
const CITATION_MARKDOWN_LINK = /\[\d{1,3}\]\(<?https?:\/\//i;
/** 官方 `unt`：脚注引用 `[^N]`（后接 `:` 的是定义，不算引用）。 */
const CITATION_FOOTNOTE_REF = /\[\^(\d{1,3})\](?!:)/g;
/** 官方 `cN`：裸标号 `[N]`（前面不能是字母数字下划线或 `!`，后面不能是 `(`）。 */
const CITATION_BARE_REF = /(?<![A-Za-z0-9_!])\[(\d{1,3})\](?!\()/g;
/** MTV 的来源编号写法 `[S<n>]`（官方 `pnt` 里 `n.get('S'+e)` 的等价物）。 */
const CITATION_SOURCE_ID_REF = /(?<![A-Za-z0-9_!])\[(S\d{1,3})\](?!\()/g;
/** 官方 `vre`：脚注定义 `[^N]: …`。 */
const CITATION_FOOTNOTE_DEFINITION = /\[\^([^\]\s]{1,24})\]:\s*(.+)$/;

/** 官方 `_re`：正文里的脚注定义表（`{id → 文本}`）。 */
function footnoteDefinitions(text: string): Map<string, string> {
  const definitions = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = line.match(CITATION_FOOTNOTE_DEFINITION);
    if (match) definitions.set(match[1], match[2]);
  }
  return definitions;
}

/**
 * 官方 `fnt(text, sourcesByUrl)`（`vendor-pkg-canvas` @2369178 逐字）：
 * ```js
 * fnt = (text, sourcesByUrl = new Map()) => {
 *   if (dnt.test(text)) return true;                       // [N](https://…)
 *   const footnotes = _re(text);                            // 脚注定义表
 *   for (const m of text.matchAll(unt)) if (pnt(m[1], footnotes, sourcesByUrl)) return true;   // [^N]
 *   for (const m of text.matchAll(cN))  if (mnt(m[1], footnotes, sourcesByUrl)) return true;   // [N]
 *   return false };
 * pnt = (e,t,n) => !!(t.get(e) || n.get(e) || n.get(`S${e}`));   // 脚注里有 / 来源里有 / 来源里有 `S<e>`
 * mnt = (e,t,n) => !!(t.get(e) || n.get(e));
 * ```
 * ⇒ 官方靠「正文里的 `[N]` / `[^N]` 能在来源表里找到对应条目」判断。
 *
 * ⚠️ MTV 的来源编号是官方那套 `S<n>`（`webAccessGrantService.assignWebSourceCitations`），
 * 正文里既可能是 `[1]` 也可能是 `[S1]` ⇒ 这里对两种写法都认（`S<n>` 分支是 MTV 的等价映射，
 * 不是放宽判据：官方 `pnt` 里的 `n.get('S'+e)` 就是为 `S<n>` 这种键准备的）。
 */
export function hasSourceCitation(
  text: string,
  sources: readonly { url: string; citationId?: string }[],
  sourcesByUrl: ReadonlyMap<string, { url: string; citationId?: string }> = new Map(),
): boolean {
  if (!text) return false;
  if (CITATION_MARKDOWN_LINK.test(text)) return true;
  const byUrl = new Map(sourcesByUrl);
  const byCitation = new Map<string, true>();
  for (const source of [...sources, ...sourcesByUrl.values()]) {
    if (source.url) byUrl.set(source.url, source);
    /* 官方 `n.get(e)` / `n.get('S'+e)`：来源表既能按裸号也能按 `S<号>` 命中。 */
    const id = source.citationId;
    if (!id) continue;
    byCitation.set(id, true);
    const digits = id.replace(/^S/, '');
    byCitation.set(digits, true);
    byCitation.set(`S${digits}`, true);
  }
  const footnotes = footnoteDefinitions(text);
  const known = (id: string) => footnotes.has(id) || byCitation.has(id);
  for (const match of text.matchAll(CITATION_FOOTNOTE_REF)) if (known(match[1])) return true;
  for (const match of text.matchAll(CITATION_BARE_REF)) if (known(match[1])) return true;
  for (const match of text.matchAll(CITATION_SOURCE_ID_REF)) if (known(match[1])) return true;
  return false;
}
