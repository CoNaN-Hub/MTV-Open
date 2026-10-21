/**
 * 官方 `jv`(`K4`) —— Tiptap 编辑器封装（live `vendor-packages-jvPqKqU8.js` @498339）逐字移植。
 *
 * 官方要点（见 `live-ProseMirror-提及输入内核.md` §2）：
 * ```js
 * extensions = [
 *   StarterKit.configure({ heading:false, bulletList:false, orderedList:false, listItem:false,
 *     blockquote:false, codeBlock:false, horizontalRule:false,
 *     paragraph:{ HTMLAttributes:{ class:"leading-6!" } } }),
 *   Placeholder.configure({ placeholder: () => placeholderRef.current, emptyEditorClass: "is-editor-empty" }),
 *   ...(maxLength != null ? [textLengthLimit(maxLength)] : []),
 *   ...props.extensions,
 * ]
 * useEditor({ extensions, content: value, parseOptions, editable: editable && !disabled, autofocus,
 *             enableInputRules, enablePasteRules, onUpdate, onFocus, onBlur, editorProps })
 * editorProps = { scrollThreshold:24, scrollMargin:32, handleKeyDown, handlePaste, attributes:{…class…} }
 * ```
 * 命令式 handle：`insertTextAtCursor` · `setContentHtml` · `focus(pos)` · `clear` · `getText` ·
 * `isMentionSuggestionActive` · `getMentionIds` · `removeMention` · `insertMention` · `appendMention`。
 *
 * ⚠️ 版本差异（如实记录）：官方是 **Tiptap v2**，MTV 是 **v3**：
 *  · v3 的 `StarterKit` 默认带 `TrailingNode` ⇒ 按官方（没有该扩展）关掉，否则 DOM 会多一个空 `<p>`；
 *  · v3 的 Placeholder 走「顶层块 + isTextblock」快捷路径 ⇒ 用 MTV 已移植的 `OfficialPlaceholder`；
 *  · 官方不是 Tiptap 官方 CharacterCount，而是自研 `textLengthLimit`（`VP`）—— 见 `mentionTextLength.ts`。
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { OfficialPlaceholder } from '../nodes/shared/officialPlaceholder';
import { MENTION_NODE_VIEW_SELECTOR, mentionSuggestionKey } from './createMentionExtension';
import { createTextLengthLimitExtension } from './mentionTextLength';

/** 官方 `editorProps.attributes.class`（逐字）。 */
const EDITOR_CLASS = [
  'prose prose-sm dark:prose-invert max-w-none',
  'focus:outline-none',
  'nokey',
  'px-3 pb-2',
  '[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
  '[&_.is-editor-empty:first-child::before]:text-muted-foreground',
  '[&_.is-editor-empty:first-child::before]:float-left',
  '[&_.is-editor-empty:first-child::before]:h-0',
  '[&_.is-editor-empty:first-child::before]:pointer-events-none',
].join(' ');

export interface TiptapMentionEditorHandle {
  /** 官方 `insertTextAtCursor`。 */
  insertTextAtCursor: (text: string) => void;
  /** 官方 `setContentHtml(html)`。 */
  setContentHtml: (html: string) => void;
  /** 官方 `focus(pos?)`。 */
  focus: (position?: 'start' | 'end' | number | boolean) => void;
  /** 官方 `clear()`。 */
  clear: () => void;
  getText: () => string;
  /** 官方 `isMentionSuggestionActive()`（`al.getState(state)?.active === true`）。 */
  isMentionSuggestionActive: () => boolean;
  getMentionIds: () => string[];
  removeMention: (id: string) => void;
}

export interface TiptapMentionEditorProps {
  value: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extensions: any[];
  onChange?: (html: string) => void;
  onTextChange?: (text: string) => void;
  onSubmit?: (html: string, mentionIds: string[]) => void;
  shouldSubmitOnEnter?: () => boolean;
  onKeyDown?: (event: KeyboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  enableInputRules?: boolean;
  enablePasteRules?: boolean;
  minHeight?: number;
  maxHeight?: number;
  maxLength?: number | null;
  className?: string;
}

/** 官方 `jv`/`K4`。 */
const TiptapMentionEditor = forwardRef<TiptapMentionEditorHandle, TiptapMentionEditorProps>(
  function TiptapMentionEditor({
    value,
    extensions,
    onChange,
    onTextChange,
    onSubmit,
    shouldSubmitOnEnter,
    onKeyDown,
    onFocus,
    onBlur,
    placeholder = 'Type something...',
    ariaLabel,
    disabled = false,
    autoFocus = false,
    editable = true,
    enableInputRules = true,
    enablePasteRules = true,
    minHeight = 40,
    maxHeight = 200,
    maxLength = null,
    className,
  }, ref) {
    const placeholderRef = useRef(placeholder);
    placeholderRef.current = placeholder;
    const onSubmitRef = useRef(onSubmit);
    onSubmitRef.current = onSubmit;
    const shouldSubmitRef = useRef(shouldSubmitOnEnter);
    shouldSubmitRef.current = shouldSubmitOnEnter;
    const onKeyDownRef = useRef(onKeyDown);
    onKeyDownRef.current = onKeyDown;

    const resolvedExtensions = useMemo(() => [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        /* v3 默认带 TrailingNode，官方没有 ⇒ 关掉（否则每次格式化多一个空 `<p>`）。 */
        trailingNode: false,
        paragraph: { HTMLAttributes: { class: 'leading-6!' } },
      }),
      OfficialPlaceholder.configure({
        placeholder: () => placeholderRef.current,
        emptyEditorClass: 'is-editor-empty',
      }),
      ...(maxLength != null ? [createTextLengthLimitExtension(maxLength)] : []),
      ...extensions,
    ], [extensions, maxLength]);

    const editor = useEditor({
      extensions: resolvedExtensions,
      content: value,
      editable: editable && !disabled,
      autofocus: autoFocus,
      enableInputRules,
      enablePasteRules,
      onUpdate: ({ editor: instance }: { editor: Editor }) => {
        const html = instance.getHTML();
        onChange?.(html);
        onTextChange?.(instance.getText());
      },
      onFocus: () => { onFocus?.(); },
      onBlur: () => { onBlur?.(); },
      editorProps: {
        scrollThreshold: 24,
        scrollMargin: 32,
        attributes: {
          ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
          'data-keyboard-scope': 'text-editor',
          class: `${EDITOR_CLASS} ${className ?? ''}`.trim(),
        },
        handleKeyDown: (_view, event) => {
          onKeyDownRef.current?.(event);
          if (event.isComposing || event.keyCode === 229) return false;
          if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
            const suggestionActive = (() => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (mentionSuggestionKey as any).getState?.(_view.state)?.active === true;
              } catch { return false; }
            })();
            if (suggestionActive || !onSubmitRef.current) return false;
            event.preventDefault();
            if (shouldSubmitRef.current?.() !== false) {
              onSubmitRef.current(_view.state.doc.textBetween(0, _view.state.doc.content.size), []);
            }
            return true;
          }
          return false;
        },
      },
    });

    /* 受控同步：`value` 变化时写进编辑器（`emitUpdate:false` 避免回环触发 `onChange`）。
       官方 `K4` 把 `content: value` 交给 `useEditor`；Tiptap 只在创建时吃 `content`，
       这里补一个显式同步，保证外部 `value`（`{{node/…}}` token）能刷新到编辑器。 */
    useEffect(() => {
      if (!editor) return;
      if (editor.getHTML() === value) return;
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }, [editor, value]);

    useImperativeHandle(ref, () => ({
      insertTextAtCursor: (text: string) => {
        if (!editor) return;
        editor.commands.insertContent(text);
        editor.commands.focus();
      },
      setContentHtml: (html: string) => {
        if (!editor) return;
        if (html) editor.commands.setContent(html, { emitUpdate: true });
        else editor.commands.clearContent(true);
        editor.commands.focus('end');
      },
      focus: (position) => { editor?.commands.focus(position === undefined ? undefined : position); },
      clear: () => {
        if (!editor) return;
        editor.commands.clearContent(true);
      },
      getText: () => editor?.getText() ?? '',
      isMentionSuggestionActive: () => {
        if (!editor) return false;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (mentionSuggestionKey as any).getState?.(editor.state)?.active === true;
        } catch { return false; }
      },
      getMentionIds: () => {
        const ids: string[] = [];
        editor?.state.doc.descendants((node) => {
          if (node.type.name === 'mention' && node.attrs.id) ids.push(node.attrs.id as string);
          return true;
        });
        return ids;
      },
      removeMention: (id: string) => {
        if (!editor) return;
        const { tr } = editor.state;
        let removed = false;
        editor.state.doc.descendants((node, pos) => {
          if (removed) return false;
          if (node.type.name === 'mention' && node.attrs.id === id) {
            tr.delete(pos, pos + node.nodeSize);
            removed = true;
            return false;
          }
          return true;
        });
        if (removed) editor.view.dispatch(tr);
      },
    }), [editor]);

    const setDomRef = useCallback((node: HTMLDivElement | null) => {
      if (!node) return;
      node.style.minHeight = `${minHeight}px`;
      node.style.maxHeight = `${maxHeight}px`;
      node.style.overflowY = 'auto';
    }, [maxHeight, minHeight]);

    return (
      <div ref={setDomRef} data-mention-editor-selector={MENTION_NODE_VIEW_SELECTOR}>
        <EditorContent editor={editor} />
      </div>
    );
  },
);

export default TiptapMentionEditor;
