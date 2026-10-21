/**
 * markdownEditing —— 官方放大面板底部「编辑工具条」的编辑逻辑（MTV 侧等价实现）
 *
 * 官方依据（`zoom-slider-3ZcFvYQO.js`）：
 *   `mye` @489845（= 媒体查看器底部操作条）：
 *     <Dock className="media-viewer__text-actions">
 *       <CopyButton/>                                  // 复制全部（`nodes.markdownToolbar.copyAll`→`copied`）
 *       {editable && <><span className="mx-1 h-5 w-px bg-white/10"/>
 *                      <MarkdownToolbar appearance="media-viewer" onAction={…} activeState={…}/></>}
 *     </Dock>
 *   `r$` @486152（= MarkdownToolbar）工具集，逐字：
 *     [h1, h2, h3, paragraph] 丨 [bold, italic] 丨 [bulletList, orderedList] 丨 [divider]
 *   `hye`（动作映射，逐字）：`bold → toggleBold` · `italic → toggleItalic` ·
 *     `h1/h2/h3/paragraph → setHeading/paragraph` · `list → bulletList` ·
 *     `ordered-list → orderedList` · `divider → setHorizontalRule`
 *   `fye`（激活态）：`isBold / isItalic / headingLevel(1|2|3|0) / isList / isOrderedList`
 *
 * ⚠️ 官方那套是 TipTap 富文本编辑器（`noe`）；MTV 的文本卡内容就是 **Markdown 源码**，
 *    所以这里把同一批动作映射成「对 Markdown 文本的编辑」：加/去 `**`、`*`、`# `、`- `、`1. `、`---`。
 *    纯函数 + 单测（`tests/utils/markdownEditing.test.ts`），不依赖 DOM。
 */

export type MarkdownAction =
  | 'h1' | 'h2' | 'h3' | 'paragraph'
  | 'bold' | 'italic'
  | 'list' | 'ordered-list'
  | 'divider';

export interface MarkdownSelection {
  value: string;
  /** 选区起点（含） */
  start: number;
  /** 选区终点（不含） */
  end: number;
}

export interface MarkdownEditResult {
  value: string;
  start: number;
  end: number;
}

export interface MarkdownActiveState {
  /** 1/2/3 = 该级标题；0 = 普通段落 */
  headingLevel: 0 | 1 | 2 | 3;
  isList: boolean;
  isOrderedList: boolean;
  isBold: boolean;
  isItalic: boolean;
}

/** 光标所在行的范围（行首、行尾，不含换行符）*/
function currentLineRange(value: string, pos: number): { lineStart: number; lineEnd: number; line: string } {
  const lineStart = value.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  const nl = value.indexOf('\n', pos);
  const lineEnd = nl === -1 ? value.length : nl;
  return { lineStart, lineEnd, line: value.slice(lineStart, lineEnd) };
}

/** 选区覆盖到的整行范围（用于列表/标题的前缀操作）*/
function selectedLineRange(value: string, start: number, end: number): { from: number; to: number } {
  const from = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nl = value.indexOf('\n', end);
  return { from, to: nl === -1 ? value.length : nl };
}

const HEADING_RE = /^(#{1,6})\s+/;
const BULLET_RE = /^(\s*)[-*+]\s+/;
const ORDERED_RE = /^(\s*)\d+\.\s+/;

/** 官方 `fye` 的等价：由 Markdown 源码推断激活态 */
export function markdownActiveState({ value, start, end }: MarkdownSelection): MarkdownActiveState {
  const { line } = currentLineRange(value, start);
  const heading = line.match(HEADING_RE);
  const level = heading ? Math.min(3, heading[1].length) : 0;
  const selected = value.slice(start, end);
  const lineTrimmed = line.trimStart();
  return {
    headingLevel: (level === 1 || level === 2 || level === 3 ? level : 0),
    isList: BULLET_RE.test(lineTrimmed),
    isOrderedList: ORDERED_RE.test(lineTrimmed),
    /* 选区两端都是 `**` / `*`（且不是 `**`）时视为已加粗/斜体 */
    isBold: selected.length > 0 && /^\*\*[\s\S]+\*\*$/.test(selected),
    isItalic: selected.length > 0 && /^\*[^*][\s\S]*\*$/.test(selected),
  };
}

/** 给选中的每一行加/去前缀（`prefix` 为空串表示去掉已有前缀）*/
function toggleLinePrefix(
  value: string,
  start: number,
  end: number,
  prefix: string,
  matchRe: RegExp,
): MarkdownEditResult {
  const { from, to } = selectedLineRange(value, start, end);
  const block = value.slice(from, to);
  const lines = block.split('\n');
  const everyPrefixed = lines.every((l) => (l.trim() === '' ? true : matchRe.test(l)));
  const next = lines.map((line) => {
    if (line.trim() === '') return line;
    if (everyPrefixed) return line.replace(matchRe, '');
    const stripped = line.replace(matchRe, '').replace(HEADING_RE, '');
    return `${prefix}${stripped}`;
  }).join('\n');
  const out = value.slice(0, from) + next + value.slice(to);
  const delta = out.length - value.length;
  return { value: out, start, end: Math.max(start, end + delta) };
}

/** 行内包裹（`**` / `*`）：已包裹则去掉，否则包上；无选区时插入一对并把光标放中间 */
function toggleInlineWrap(value: string, start: number, end: number, marker: string): MarkdownEditResult {
  const selected = value.slice(start, end);
  if (selected.length === 0) {
    const inserted = marker + marker;
    const out = value.slice(0, start) + inserted + value.slice(end);
    const caret = start + marker.length;
    return { value: out, start: caret, end: caret };
  }
  const len = marker.length;
  /* ① 选区**自己**带着标记（`**hello**` 整段被选中）⇒ 去掉标记 */
  const selfWrapped = selected.startsWith(marker) && selected.endsWith(marker) && selected.length > len * 2;
  if (selfWrapped) {
    const inner = selected.slice(len, selected.length - len);
    const out = value.slice(0, start) + inner + value.slice(end);
    return { value: out, start, end: start + inner.length };
  }
  /* ② 标记在**选区外侧**（只选中 `hello`，两边是 `**`）⇒ 去掉外层的标记 */
  const outsideWrapped = start >= len
    && value.slice(start - len, start) === marker
    && value.slice(end, end + len) === marker;
  if (outsideWrapped) {
    const out = value.slice(0, start - len) + selected + value.slice(end + len);
    return { value: out, start: start - len, end: end - len };
  }
  const out = value.slice(0, start) + marker + selected + marker + value.slice(end);
  return { value: out, start: start + len, end: end + len };
}

/**
 * 官方 `hye` 的动作分发（等价实现）。
 * 返回新的文本与选区；调用方负责写回节点数据与恢复光标。
 */
export function applyMarkdownAction(action: MarkdownAction, selection: MarkdownSelection): MarkdownEditResult {
  const { value, start, end } = selection;
  switch (action) {
    case 'h1':
    case 'h2':
    case 'h3': {
      const level = Number(action.slice(1));
      const { lineStart, lineEnd, line } = currentLineRange(value, start);
      const stripped = line.replace(HEADING_RE, '');
      const nextLine = `${'#'.repeat(level)} ${stripped}`;
      const nextValue = value.slice(0, lineStart) + nextLine + value.slice(lineEnd);
      const delta = nextValue.length - value.length;
      return { value: nextValue, start: start + delta, end: end + delta };
    }
    case 'paragraph': {
      const { lineStart, lineEnd, line } = currentLineRange(value, start);
      const stripped = line.replace(HEADING_RE, '');
      const nextValue = value.slice(0, lineStart) + stripped + value.slice(lineEnd);
      const delta = nextValue.length - value.length;
      return { value: nextValue, start: start + delta, end: end + delta };
    }
    case 'bold':
      return toggleInlineWrap(value, start, end, '**');
    case 'italic':
      return toggleInlineWrap(value, start, end, '*');
    case 'list':
      return toggleLinePrefix(value, start, end, '- ', BULLET_RE);
    case 'ordered-list':
      return toggleLinePrefix(value, start, end, '1. ', ORDERED_RE);
    case 'divider': {
      /* 官方 `setHorizontalRule()`：插入一条独立成行的分隔线（其后另起一行，方便继续输入）*/
      const { lineStart, lineEnd, line } = currentLineRange(value, start);
      const emptyLine = line.trim() === '';
      const insert = emptyLine ? '---\n' : '\n---\n';
      const at = emptyLine ? lineStart : lineEnd;
      const nextValue = value.slice(0, at) + insert + value.slice(at);
      /* 光标落到 `---` 之后（仍在它自己那行）*/
      const caret = emptyLine ? at + 3 : at + 4;
      return { value: nextValue, start: caret, end: caret };
    }
    default:
      return { value, start, end };
  }
}
