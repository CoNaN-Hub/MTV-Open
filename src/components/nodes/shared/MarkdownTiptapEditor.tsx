/**
 * MarkdownTiptapEditor —— 官方**富文本（WYSIWYG）markdown 编辑器**的等价实现。
 *
 * 官方出处（`E:/TapNow-0.4.66/resources/web/assets/`）：
 *   · 编辑器组件 kit `Hj`/`RU`（`use-waveform-data-DMduQqB-.js` @590233 起）+ 页面 `zoom-slider-3ZcFvYQO.js` 的用法
 *   · 全屏文本分支 `sxe` @571990：
 *       <noe value={markdown} editable onChange placeholder={t('nodes.doubleClickToInput')}
 *            contentClassName="canvas-text-markdown min-h-full !max-w-none !px-10 !py-8"/>
 *   · 文本卡本体 `Vee` @3386000：内容 = `<UP markdown/>`（markdown 渲染），双击 → 全屏编辑态
 *   · 底部工具栏 `r$` @486563（`MarkdownToolbar`）发的就是**编辑器命令**：
 *       h1/h2/h3 → toggleHeading({level}) · paragraph → setParagraph · bold → toggleBold ·
 *       italic → toggleItalic · list → toggleBulletList · ordered-list → toggleOrderedList ·
 *       divider → setHorizontalRule
 *
 * MTV 之前是「textarea + 自研 HTML 渲染」⇒ 内容显示与按钮行为都对不上（用户：「全部不对」）。
 * 现在照官方换成 tiptap：内容进出都是 **markdown 字符串**（`data.output` 不变），编辑态所见即所得 ✓
 */
import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { OfficialPlaceholder } from './officialPlaceholder';
import { Markdown } from 'tiptap-markdown';

export interface MarkdownTiptapEditorProps {
  value: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  /** 拿到编辑器实例（底部工具栏要发官方命令：toggleHeading / toggleBold …） */
  onEditorReady?: (editor: Editor | null) => void;
  /** 选区/内容变化时回报激活态（工具栏高亮用） */
  onStateChange?: (state: { h: 'h1' | 'h2' | 'h3' | 'paragraph'; bold: boolean; italic: boolean; list: boolean; orderedList: boolean }) => void;
  className?: string;
}

export default function MarkdownTiptapEditor({
  value,
  onChange,
  placeholder = '开启你的创作...',
  onEditorReady,
  onStateChange,
  className,
}: MarkdownTiptapEditorProps) {
  const lastEmitted = useRef(value);
  const editor = useEditor({
    extensions: [
      /* ★ `trailingNode: false`：StarterKit v3 **默认带 `TrailingNode`**
         （`@tiptap/starter-kit` dist：`if (this.options.trailingNode !== false) extensions.push(TrailingNode…)`），
         它会在非段落块（标题 / 列表 / 分隔线）末尾自动补一个空段落 ⇒ MTV 每点一次格式按钮就多一行空 `<p>`，
         而官方编辑器**没有**这个扩展（官方 9444 实测：点标题后 DOM 只有 `<h1 …>`；点无序列表后只有 `<ul …>`）✗
         ⇒ 按官方关掉，DOM 才能逐字一致。 */
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, trailingNode: false }),
      Link.configure({ openOnClick: false }),
      /* ★ 占位符用**官方移植版**（`officialPlaceholder.ts`，官方 `g1` @364958 逐字）：
         tiptap v3 原版走"顶层块 + 必须是 textblock"的快捷路径 ⇒ 空列表上不落装饰、
         占位符整段消失；官方那套是 `doc.descendants + !isLeaf + isNodeEmpty + 不下钻`
         ⇒ 装饰落在**外层空块**（`<ul>/<ol>` 也在内）上，占位符在空列表里继续显示 ✓ */
      OfficialPlaceholder.configure({ placeholder }),
      /* 官方内容进出都是 markdown ⇒ 用 markdown 扩展做 parse/serialize */
      Markdown.configure({ html: false, tightLists: true, linkify: false, breaks: false }),
    ],
    content: value,
    editorProps: {
      attributes: {
        /* 官方 `contentClassName`：`canvas-text-markdown min-h-full !max-w-none !px-10 !py-8` */
        class: `canvas-text-markdown min-h-full max-w-none px-10 py-8 outline-none ${className ?? ''}`.trim(),
      },
    },
    onUpdate: ({ editor: instance }) => {
      /* `tiptap-markdown` 未做 tiptap v3 的 Storage 模块增强 ⇒ 这里显式收窄类型 */
      const md = (
        instance.storage as unknown as { markdown: { getMarkdown(): string } }
      ).markdown.getMarkdown();
      lastEmitted.current = md;
      onChange?.(md);
    },
    onSelectionUpdate: ({ editor: instance }) => {
      onStateChange?.(readState(instance));
    },
    onTransaction: ({ editor: instance }) => {
      onStateChange?.(readState(instance));
    },
  });

  /* 外部值变化（切换节点 / 视图态同步）时同步进编辑器，避免回写死循环
     ★ 编辑中**绝不回灌**：`onUpdate → getMarkdown()` 产出的 markdown 常带尾随空行/缩进，
       在编辑器聚焦时 `setContent(markdown)` 会**重新解析**它 ⇒ 每个非段落块后面多出一个空 `<p>`
       （实测：点「标题 1」→ MTV `<h1 …></h1><p></p>`，官方只有 `<h1 …></h1>` ✗）。
       编辑器在聚焦期间本身就是唯一真源，外部值只在失焦/换节点时才需要覆盖。 */
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    if (editor.isFocused) return;
    lastEmitted.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  /* ★ 用 ref 存回调：调用方（`TextFullscreenViewer`）传的是**内联箭头函数**，identity 每次都变
     ⇒ 若把 `onEditorReady` 放进依赖，effect 会在**每次渲染**都重跑（先 `onEditorReady(null)` 再
     `onEditorReady(editor)`），把 `editorRef.current` 短暂置空；若这段刚好落在「mousedown → click」
     之间，工具条那次点击就会走"没有编辑器实例"的旧分支 ✗ ⇒ 只在 `editor` 真正变化时通知。 */
  const readyRef = useRef(onEditorReady);
  /* ⚠️ 赋值放 effect 里（渲染期写 ref 会被 `react-hooks/refs` 判错）。
     先声明的 effect 先跑 ⇒ 通知 effect 拿到的一定是本次渲染的最新回调。 */
  useEffect(() => { readyRef.current = onEditorReady; });

  useEffect(() => {
    readyRef.current?.(editor ?? null);
    return () => readyRef.current?.(null);
  }, [editor]);

  return <EditorContent editor={editor} className="size-full overflow-y-auto" />;
}

function readState(editor: Editor) {
  const h = editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
      : editor.isActive('heading', { level: 3 }) ? 'h3'
        : 'paragraph';
  return {
    h: h as 'h1' | 'h2' | 'h3' | 'paragraph',
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    list: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
  };
}
