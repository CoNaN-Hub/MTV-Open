/**
 * magicItem —— 焦点编辑（官方 `magicSelection`）写在 prompt 里的元数据 token 工具。
 *
 * token 形状（官方 @1580120 逐字）：
 *   `{{magic_item:{"box_2d":[ymin,xmin,ymax,xmax],"label_name":"cat","label_desc":"…","_markId":"…","nodeId":"…"}}}`
 * 识别中的占位：
 *   `{{magic_item:{"isLoading":true,"label_name":"Recognizing...","_markId":"…"}}}`
 *
 * 它是**给生成请求用的元数据**（框选区域 + 标签），不是正文。
 * 两处需要它：
 *   ① **编辑器渲染**：不能把 JSON 当正文显示 ⇒ 渲染前剥离（芯片由配对的 `@{nodeId:label}` 渲染）
 *   ② **发给模型前**：绝不能让这段 JSON 进 prompt 正文 ⇒ 同样要剥离
 *
 * ⚠️ token 体里含**嵌套 `{}`**（JSON），必须做**配对花括号扫描**，不能用 `[^}]*`。
 *    官方那边用的是 `[^}]*` 正则，对嵌套 JSON 其实是不严谨的（它能work是因为它替换的是
 *    自己写进去的、结构可控的 token）；MTV 这边做严谨的分词扫描，顺带容忍 `label_desc`
 *    里出现 `}` 字符。
 */

export const MAGIC_ITEM_PREFIX = '{{magic_item:';

/** 一条焦点编辑元数据 token（`start`/`end` 是它在原串里的下标，`data` 是解析后的 JSON）。*/
export interface MagicItemToken {
  start: number;
  end: number;
  /** 原样的 `{{magic_item:{…}}}` 子串 */
  raw: string;
  /** 解析失败时为 `null`（该条按普通文本保留，不丢字符） */
  data: Record<string, unknown> | null;
}

/**
 * 扫出全部 `{{magic_item:…}}`（配对花括号 + 识别 JSON 字符串内的转义）。
 *
 * ⚠️ token 体里含**嵌套 `{}`**（JSON），必须做配对扫描，不能用 `[^}]*`。
 */
export function parseMagicItemTokens(text: string): MagicItemToken[] {
  const tokens: MagicItemToken[] = [];
  if (!text.includes(MAGIC_ITEM_PREFIX)) return tokens;
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf(MAGIC_ITEM_PREFIX, i);
    if (start < 0) break;
    // 从 token 的**第一个 `{`** 开始配对扫描（跳过 JSON 字符串里的花括号）
    // ⚠️ 必须从 `start` 开始（前缀里的第一个 `{` 就算第一层）——
    //    从 `start+1` 开始会少收一个 `}`，剥出来的正文会残留一个孤立的 `}`。
    let depth = 0;
    let j = start;
    let inString = false;
    let escaped = false;
    for (; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) { j += 1; break; }
      }
    }
    const raw = text.slice(start, j);
    const body = raw.slice(MAGIC_ITEM_PREFIX.length, raw.endsWith('}') ? -2 : undefined);
    let data: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      data = null;
    }
    tokens.push({ start, end: j, raw, data });
    i = j;
  }
  return tokens;
}

/** 剥离全部 `{{magic_item:…}}`（配对花括号 + 识别 JSON 字符串内的转义）。 */
export function stripMagicItemTokens(text: string): string {
  if (!text.includes(MAGIC_ITEM_PREFIX)) return text;
  const tokens = parseMagicItemTokens(text);
  if (tokens.length === 0) return text;
  let out = '';
  let cursor = 0;
  for (const token of tokens) {
    out += text.slice(cursor, token.start);
    cursor = token.end;
  }
  return out + text.slice(cursor);
}

/** 用新的 token 数据**就地替换**某条 mark 的 token（`label_name`/`box_2d` 变化时用）。*/
export function replaceMagicItemToken(
  text: string,
  markId: string,
  data: Record<string, unknown>,
): string {
  const tokens = parseMagicItemTokens(text);
  let out = '';
  let cursor = 0;
  let changed = false;
  for (const token of tokens) {
    const tokenMarkId = token.data?._markId;
    if (tokenMarkId !== markId) continue;
    out += text.slice(cursor, token.start) + `${MAGIC_ITEM_PREFIX}${JSON.stringify(data)}}}`;
    cursor = token.end;
    changed = true;
  }
  return changed ? out + text.slice(cursor) : text;
}

/** 摘掉某条 mark 的 token（连同一侧空白），返回新串。 */
export function removeMagicItemToken(text: string, markId: string): string {
  const tokens = parseMagicItemTokens(text);
  let out = '';
  let cursor = 0;
  let changed = false;
  for (const token of tokens) {
    if (token.data?._markId !== markId) continue;
    out += `${text.slice(cursor, token.start).replace(/\s+$/, '')} `;
    cursor = token.end;
    changed = true;
  }
  return changed ? (out + text.slice(cursor)).replace(/[ \t]{2,}/g, ' ').trim() : text;
}

/** 串里出现过的 mark id 集合（官方 `dN`：据此清理已经不在 prompt 里的标记）。*/
export function magicItemMarkIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const token of parseMagicItemTokens(text)) {
    const id = token.data?._markId;
    if (typeof id === 'string' && id) ids.add(id);
  }
  return ids;
}

/** 剥离元数据后收拾多余空白（避免 prompt 里留下双空格）。 */
export function stripMagicItemTokensAndSqueeze(text: string): string {
  return stripMagicItemTokens(text).replace(/[ \t]{2,}/g, ' ').trim();
}
