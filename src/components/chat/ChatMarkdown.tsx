/**
 * 渲染对话消息的受限 Markdown 子集，并把画布、模型与 Skill 引用交给专用引用组件处理。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import ChatReferenceText, { type ChatReferenceHandlers } from './ChatReferenceText';
import { useT } from '../../i18n';

interface ChatMarkdownProps extends ChatReferenceHandlers {
  value: string;
}

interface InlineContentProps extends ChatReferenceHandlers {
  value: string;
}

const INLINE_PATTERN = /(@\{[^:}\r\n]+:[^}\r\n]+\}|@model\{[^|}\r\n]+\|[^}\r\n]*\}|@skill\{[^|}\r\n]+\|[^}\r\n]*\}|`[^`\r\n]+`|\[[^\]\r\n]+\]\([^)\s]+\)|\*\*[^*\r\n]+\*\*|~~[^~\r\n]+~~|\*[^*\r\n]+\*)/g;

function resolveSafeHref(value: string): string | null {
  const href = value.trim();
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  return null;
}

function InlineContent({
  value,
  onNodeActivate,
  onNodeHover,
  onModelActivate,
}: InlineContentProps) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of value.matchAll(INLINE_PATTERN)) {
    const raw = match[0];
    const start = match.index;
    if (start == null) continue;
    if (start > cursor) {
      nodes.push(
        <ChatReferenceText
          key={`text-${cursor}`}
          value={value.slice(cursor, start)}
          compact
          onNodeActivate={onNodeActivate}
          onNodeHover={onNodeHover}
          onModelActivate={onModelActivate}
        />,
      );
    }

    if (raw.startsWith('@')) {
      nodes.push(
        <ChatReferenceText
          key={`ref-${start}`}
          value={raw}
          compact
          onNodeActivate={onNodeActivate}
          onNodeHover={onNodeHover}
          onModelActivate={onModelActivate}
        />,
      );
    } else if (raw.startsWith('`')) {
      nodes.push(
        /* 官方 `.chat-markdown` 36 条里**没有**行内 `code` 规则 ⇒ 这里对齐官方 `pre` 的算式
           （`background: color-mix(in srgb, var(--chat-foreground) 6%, transparent)`），
           不再用 MTV 自造的 emerald 配色。 */
        <code
          key={`code-${start}`}
          className="rounded-[4px] bg-white/[0.06] px-1 py-0.5 font-mono text-[12.5px] text-chat-foreground"
        >
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(raw);
      const href = linkMatch ? resolveSafeHref(linkMatch[2]) : null;
      nodes.push(href ? (
        <a
          key={`link-${start}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-chat-foreground underline decoration-current/30 underline-offset-2 hover:decoration-current focus-visible:outline-none"
        >
          {linkMatch?.[1]}
        </a>
      ) : (
        <span key={`unsafe-link-${start}`}>{linkMatch?.[1] ?? raw}</span>
      ));
    } else if (raw.startsWith('**')) {
      nodes.push(
        <strong key={`strong-${start}`}>
          <InlineContent
            value={raw.slice(2, -2)}
            onNodeActivate={onNodeActivate}
            onNodeHover={onNodeHover}
            onModelActivate={onModelActivate}
          />
        </strong>,
      );
    } else if (raw.startsWith('~~')) {
      nodes.push(
        <del key={`del-${start}`}>
          <InlineContent
            value={raw.slice(2, -2)}
            onNodeActivate={onNodeActivate}
            onNodeHover={onNodeHover}
            onModelActivate={onModelActivate}
          />
        </del>,
      );
    } else {
      nodes.push(
        <em key={`em-${start}`} className="italic">
          <InlineContent
            value={raw.slice(1, -1)}
            onNodeActivate={onNodeActivate}
            onNodeHover={onNodeHover}
            onModelActivate={onModelActivate}
          />
        </em>,
      );
    }
    cursor = start + raw.length;
  }

  if (cursor < value.length) {
    nodes.push(
      <ChatReferenceText
        key={`text-${cursor}`}
        value={value.slice(cursor)}
        compact
        onNodeActivate={onNodeActivate}
        onNodeHover={onNodeHover}
        onModelActivate={onModelActivate}
      />,
    );
  }
  return <>{nodes}</>;
}

/**
 * 官方 `VP`（`ChatCodeBlock`，`page-BeI7xydN.js@378144`）**逐字**：
 * ```jsx
 * <div className="chat-code-block group/code relative min-w-0 max-w-full"
 *      data-language={lang} data-wrap={wrap ? 'on' : 'off'}>
 *   <pre data-language={lang}>{highlighted ? <code>…带色 token…</code> : <code>{code}</code>}</pre>
 *   <div className="absolute top-2 right-2 flex items-center gap-0.5
 *                   opacity-0 transition-opacity focus-within:opacity-100
 *                   group-hover/code:opacity-100 [+copied && opacity-100]">
 *     <button aria-label={wrapLabel} aria-pressed={wrap} title={wrapLabel} onClick={() => setWrap(w => !w)}
 *       className={cx('flex size-6 cursor-pointer items-center justify-center rounded-[6px]',
 *                     'text-muted-foreground hover:text-chat-foreground', wrap && 'bg-foreground/8 text-chat-foreground')}>
 *       <VU className="size-3.5" strokeWidth={1.5}/></button>            // lucide wrap-text
 *     <button aria-label={copyLabel} title={copyLabel} onClick={copy}
 *       className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] text-muted-foreground hover:text-chat-foreground">
 *       {copied ? <qc …/> : <fa …/>}</button>                            // lucide check / copy
 *   </div>
 * </div>
 * ```
 * 官方 `setTimeout(..., 2e3)`；文案取官方 zh 包 `chatAdapter.feedback.*`
 * （`copy:"复制"` `copied:"已复制"` `wrap:"自动换行"` `unwrap:"不换行"`）。
 * ⚠️ MTV 之前自造了「语言标签 + 复制按钮」的头条（官方**没有**头栏），
 * 且没有 `data-wrap` 换行开关 ⇒ 代码块整体格式与官方不同（用户实测）。
 * 官方的高亮来自 shiki（`ste(code, lang)`）；未就绪时官方也退化成 `<code>{code}</code>`，
 * MTV 没有高亮器 ⇒ 走官方同一条退化分支。
 */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(true);
  const timerRef = useRef<number | null>(null);
  const lang = language?.toLowerCase();

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const wrapLabel = wrap ? t('不换行') : t('自动换行');
  const copyLabel = copied ? t('已复制') : t('复制');

  return (
    <div
      className="chat-code-block group/code relative min-w-0 max-w-full"
      data-language={lang}
      data-wrap={wrap ? 'on' : 'off'}
    >
      <pre data-language={lang}>
        <code>{code}</code>
      </pre>
      <div
        className={[
          'absolute top-2 right-2 flex items-center gap-0.5',
          'opacity-0 transition-opacity focus-within:opacity-100 group-hover/code:opacity-100',
          copied ? 'opacity-100' : '',
        ].filter(Boolean).join(' ')}
      >
        <button
          type="button"
          aria-label={wrapLabel}
          aria-pressed={wrap}
          title={wrapLabel}
          onClick={() => setWrap((value) => !value)}
          className={[
            'flex size-6 cursor-pointer items-center justify-center rounded-[6px]',
            'text-muted-foreground hover:text-chat-foreground',
            wrap ? 'bg-foreground/[0.08] text-chat-foreground' : '',
          ].filter(Boolean).join(' ')}
        >
          <Icon icon="lucide:wrap-text" width={14} height={14} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label={copyLabel}
          title={copyLabel}
          onClick={() => void copyCode()}
          className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] text-muted-foreground hover:text-chat-foreground"
        >
          <Icon icon={copied ? 'lucide:check' : 'lucide:copy'} width={14} height={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

function splitTableRow(value: string): string[] {
  return value.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableDivider(value: string): boolean {
  const cells = splitTableRow(value);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? '';
  if (!line.trim()) return true;
  if (/^```/.test(line) || /^#{1,6}\s+/.test(line) || /^>\s?/.test(line)) return true;
  if (/^\s*(?:[-+*]|\d+\.)\s+/.test(line) || /^\s*(?:-{3,}|\*{3,})\s*$/.test(line)) return true;
  return index + 1 < lines.length && line.includes('|') && isTableDivider(lines[index + 1]);
}

export default function ChatMarkdown({
  value,
  onNodeActivate,
  onNodeHover,
  onModelActivate,
}: ChatMarkdownProps) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  const inlineProps = { onNodeActivate, onNodeHover, onModelActivate };
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^```([^\s`]*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(<CodeBlock key={`code-${index}`} code={code.join('\n')} language={fence[1]} />);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      /* 官方字号/边距全部由 `.chat-markdown > h1..h6` 那组 CSS 负责（逐字搬自官方
         `page-DdKu6wtx.css`）⇒ 这里**不能再挂 MTV 的字号/颜色工具类**，
         否则和官方那套 24/20/18/16/15/14px + 1.6em 边距打架。 */
      const content = <InlineContent value={heading[2]} {...inlineProps} />;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      blocks.push(<Tag key={`h-${index}`}>{content}</Tag>);
      index += 1;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,})\s*$/.test(line)) {
      /* 官方 `.chat-markdown hr`。 */
      blocks.push(<hr key={`hr-${index}`} />);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && line.includes('|') && isTableDivider(lines[index + 1])) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push(
        /* 官方 `.chat-markdown` 36 条里**没有**表格规则（官方表格由 streamdown 自带样式）⇒
           这里保留 MTV 的表格实现，但配色改成官方 token（`--border` / 6% chat-foreground），
           不再用画布专用色 `canvas-*`。 */
        <div key={`table-${index}`} className="my-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[280px] border-collapse text-left text-[11px]">
            <thead className="bg-white/[0.04] text-muted-foreground">
              <tr>{header.map((cell, cellIndex) => (
                <th key={cellIndex} className="border-b border-border px-2.5 py-2 font-medium">
                  <InlineContent value={cell} {...inlineProps} />
                </th>
              ))}</tr>
            </thead>
            <tbody>{rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/60 last:border-b-0">
                {header.map((_, cellIndex) => (
                  <td key={cellIndex} className="px-2.5 py-2 align-top text-chat-foreground/90">
                    <InlineContent value={row[cellIndex] ?? ''} {...inlineProps} />
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const listItem = /^\s*([-+*]|\d+\.)\s+(.+)$/.exec(line);
    if (listItem) {
      const ordered = /\d+\./.test(listItem[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^\s*([-+*]|\d+\.)\s+(.+)$/.exec(lines[index]);
        if (!item || /\d+\./.test(item[1]) !== ordered) break;
        items.push(item[2]);
        index += 1;
      }
      const children = items.map((item, itemIndex) => (
        <li key={itemIndex}>
          <InlineContent value={item} {...inlineProps} />
        </li>
      ));
      blocks.push(ordered ? (
        <ol key={`list-${index}`}>{children}</ol>
      ) : (
        <ul key={`list-${index}`}>{children}</ul>
      ));
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {quote.map((quoteLine, quoteIndex) => (
            <p key={quoteIndex}><InlineContent value={quoteLine} {...inlineProps} /></p>
          ))}
        </blockquote>,
      );
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`p-${index}`}>
        {paragraph.map((paragraphLine, lineIndex) => (
          <span key={lineIndex}>
            {lineIndex > 0 && <br />}
            <InlineContent value={paragraphLine} {...inlineProps} />
          </span>
        ))}
      </p>,
    );
  }

  // overflow-wrap 会继承：长 URL、行内代码在列表项/表格/引用里也不会再撑破气泡
  /* 官方根类（`page-BeI7xydN.js@380187`）逐字：
       const rte = 'chat-markdown';
       const ite = `${rte} space-y-0 text-[14px] leading-[1.75] tracking-[0.01em] text-chat-foreground`;
     ⚠️ 之前只写了 `chat-markdown`，缺 `text-[14px] leading-[1.75] tracking-[0.01em]
     text-chat-foreground` ⇒ 正文沿用 MTV 的 13px/1.5 与画布配色（用户实测「助手产出格式不一致」）。

     ⚠️⚠️ **`space-y-0` 故意不写**（与官方类串的唯一差异，理由逐字）：
       官方是 Tailwind **v4**，`space-y-*` 编译成 `:where(& > :not(:last-child)){…}` —— **特异性 0**，
       所以官方那条 `.chat-markdown>*+*{margin-top:.9em}` 照样生效；
       MTV 是 **v3**，同一个类编译成 `.space-y-0>:not([hidden])~:not([hidden]){margin-top:0}` ——
       特异性 **0,3,0**，直接压过 `.chat-markdown>*+*`（0,1,0）⇒ **所有块间距被清零**
       （用户实测图 5：`1. P1 | …` 紧贴在上一段后面，与官方图 6 的间距不符）。
       官方要的是「根类里那个 space-y-0 不产生效果」，所以这里**不写**它，让官方 CSS 的 `.9em` 生效。 */
  return (
    <div className="chat-markdown text-[14px] leading-[1.75] tracking-[0.01em] text-chat-foreground min-w-0 [overflow-wrap:anywhere]">
      {blocks}
    </div>
  );
}
