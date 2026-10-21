/**
 * 官方 `JN`(`kP`) —— Mention 扩展工厂的逐字移植（live `vendor-packages-jvPqKqU8.js` @492643）。
 *
 * 官方原文：
 * ```js
 * function kP({ char = "@", items = [], onSearch, suggestionEnabled = true,
 *               resolveMentionToken, renderer, nodeViewComponent }) {
 *   return Mention.extend({
 *     onCreate() { firstRender = true; requestAnimationFrame(() => firstRender = false) },
 *     onDestroy() { firstRender = true },
 *     addAttributes() { return { ...this.parent?.(), type, renderText, thumbnail, videoSrc,
 *                                mediaType, textContent, color, regionType, isLoading } },
 *     renderHTML({node, HTMLAttributes}) { …见下… },
 *     ...(nodeViewComponent ? {
 *       addKeyboardShortcuts() { return { Backspace: () => H4(this.editor, this.name) } },
 *       addNodeView() { return ReactNodeViewRenderer(nodeViewComponent,
 *         { as: "span", attrs: { "data-mention-node-view": "true", contenteditable: "false" } }) },
 *       addProseMirrorPlugins() { …mentionSuggestion + mentionBackspaceGuard 两个 Plugin… },
 *     } : {}),
 *   });
 * }
 * ```
 * `addAttributes()` 的 parse/render 映射（逐字，见 `live-ProseMirror-提及输入内核.md` §3）：
 * `type↔data-mention-type` · `renderText↔data-render-text` · `thumbnail↔data-thumbnail` ·
 * `videoSrc↔data-video-src` · `mediaType↔data-media-type` · `textContent↔data-text-content` ·
 * `color↔data-color` · `regionType↔data-region-type` · `isLoading`（只 parse 不 render，
 * 由 `data-render-text` 的 `magic_item:{…}` JSON 推出）。
 */
import Mention from '@tiptap/extension-mention';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { findSuggestionMatch } from '@tiptap/suggestion';
import type { SuggestionProps } from '@tiptap/suggestion';
import createMentionSuggestionRenderer from './mentionSuggestionRenderer';
import type { MentionSuggestionPanelProps } from './MentionSuggestionPanel';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import type { ComponentType } from 'react';

/** 官方 `al` / `Ku`：两个 PluginKey。 */
export const mentionSuggestionKey = new PluginKey('mentionSuggestion');
export const mentionBackspaceGuardKey = new PluginKey('mentionBackspaceGuard');
/** 官方 `NP`：提及节点视图选择器。 */
export const MENTION_NODE_VIEW_SELECTOR = "[data-mention-node-view='true']";

/** 官方 `H4(editor, typeName)`：光标紧贴 mention 节点。 */
export function isCursorAdjacentToMention(editor: { state: { selection: unknown; doc: unknown } }, typeName: string): boolean {
  const state = editor.state as { selection: { node?: { type: { name: string } }; to: number }; doc: { textBetween: (from: number, to: number) => string; content: { size: number } } };
  const selection = state.selection;
  if (!selection.node) return false;
  if (selection.node.type.name !== typeName) return false;
  const to = state.selection.to;
  return state.doc.textBetween(to, Math.min(to + 1, state.doc.content.size)) !== undefined;
}

function attribute(payload: { name: string; parse: (element: HTMLElement) => unknown; render?: (attrs: Record<string, unknown>) => Record<string, unknown> | null; defaultValue?: unknown }) {
  return {
    default: payload.defaultValue ?? null,
    parseHTML: (element: HTMLElement) => payload.parse(element),
    renderHTML: (attrs: Record<string, unknown>) => (payload.render
      ? payload.render(attrs) ?? {}
      : (attrs[payload.name] ? { [`data-${payload.name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`]: attrs[payload.name] } : {})),
  };
}

/**
 * 官方 `z4(doc, from, to, typeName)`（逐字）：
 * ```js
 * function z4(e, t, n, s) { let r = false;
 *   return e.nodesBetween(t, n, o => (o.type.name === s && (r = true), !r)), r; }
 * ```
 * ⇒ 区间 `[from, to)` 内是否含指定类型节点。
 */
export function rangeContainsNodeType(doc: PMNode, from: number, to: number, typeName: string): boolean {
  let found = false;
  doc.nodesBetween(from, to, (node) => {
    if (node.type.name === typeName) found = true;
    return !found;
  });
  return found;
}

/**
 * 官方 `MP(tr, oldDoc, typeName)`（逐字）：
 * ```js
 * function MP(e, t, n) { return e.steps.some(s => { const r = s.toJSON();
 *   if (typeof r.from != "number" || typeof r.to != "number" || r.to <= r.from) return false;
 *   const o = Math.max(0, Math.min(r.from, t.content.size)),
 *         i = Math.max(o, Math.min(r.to, t.content.size));
 *   return z4(t, o, i, n); }); }
 * ```
 * ⇒ 合并事务里**有任一步骤碰到了该类型节点**。
 */
export function transactionTouchesNodeType(
  transaction: { steps: readonly { toJSON: () => Record<string, unknown> }[] },
  oldDoc: PMNode,
  typeName: string,
): boolean {
  return transaction.steps.some((step) => {
    const json = step.toJSON();
    if (typeof json.from !== 'number' || typeof json.to !== 'number' || json.to <= json.from) return false;
    const from = Math.max(0, Math.min(json.from, oldDoc.content.size));
    const to = Math.max(from, Math.min(json.to, oldDoc.content.size));
    return rangeContainsNodeType(oldDoc, from, to, typeName);
  });
}

/** 官方 `SP`：交互元素排除表。 */
export const MENTION_INTERACTIVE_SELECTOR = "button,input,textarea,select,a,[role='button'],[data-mention-interactive='true']";

/** 官方 `RP(target)`：目标在交互元素内。 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(MENTION_INTERACTIVE_SELECTOR) !== null;
}

/** 官方 `m` 用到的编辑器最小形状（避免把 Tiptap 的 `Editor` 拖成硬依赖）。 */
interface MentionEditorLike {
  view: { dom: HTMLElement };
  chain: () => { focus: () => { insertContentAt: (range: unknown, content: unknown) => { run: () => void } } };
}

export interface MentionExtensionOptions {
  /** 官方 `char`（默认 `"@"`）。 */
  char?: string;
  /** 官方 `items()`。 */
  items?: () => MentionSuggestionItem[];
  /** 官方 `onSearch(query)`。 */
  onSearch?: (query: string) => MentionSuggestionItem[];
  /** 官方 `suggestionEnabled`。 */
  suggestionEnabled?: boolean;
  /** 官方 `nodeViewComponent`（`UR`）。未提供时退回 Tiptap 默认 `renderHTML` 渲染。 */
  nodeViewComponent?: ComponentType<ReactNodeViewProps>;
  /** 官方 `resolveMentionToken(attrs)`：把节点属性翻回 `{{…}}` 里的那段（用于 `renderText`）。 */
  resolveMentionToken?: (attrs: Record<string, unknown>) => string | undefined;
  /** 建议弹层的空态文案（官方 `omniReference.suggestion.noResults`）。 */
  emptyLabel?: string;
  /** 官方 `renderer.handleSelect`（`kP` 里 `handleSelect: i.handleSelect ?? m`）。未提供时用官方默认 `m`。 */
  handleSelect?: (item: MentionSuggestionItem, props: SuggestionProps<MentionSuggestionItem>) => void;
  /** 官方 `renderer.matchEditorWidth`（`qie` 传 `true`）⇒ 弹层宽度对齐编辑器所在容器。 */
  matchEditorWidth?: boolean;
  /** 官方 `renderer.matchEditorWidthSelector`（`qie` 传 `"[data-mention-popover-width-source='true']"`）。 */
  matchEditorWidthSelector?: string;
  /** 官方 `renderer.matchEditorMaxWidth`（`qie` 传 `320`）。 */
  matchEditorMaxWidth?: number;
  /**
   * 官方 `renderer.componentProps`（`B4` 里最后展开进 `Ub`）。
   * `qie`/`MessageInputAreaV2` 的 `enableAssetLibrary` / `libraryMentionMode` / `selectFolders` /
   * `showPlugins` / `linkedSectionLabel` / `plugins` 都从这里进。
   */
  componentProps?: Partial<MentionSuggestionPanelProps>;
}

export interface MentionSuggestionItem {
  id: string;
  label: string;
  description?: string;
  type?: string;
  renderText?: string;
  avatar?: string;
  videoSrc?: string;
  mediaType?: string;
  textContent?: string;
}

/** 官方 `JN`/`kP`。 */
export function createMentionExtension(options: MentionExtensionOptions = {}) {
  const { char = '@', items = () => [], onSearch, suggestionEnabled = true, nodeViewComponent, resolveMentionToken, emptyLabel = '', handleSelect, matchEditorWidth = false, matchEditorWidthSelector, matchEditorMaxWidth, componentProps } = options;
  /** 官方 `d`(firstRender) 与 `u`(suggestionState)：`onCreate` 起一帧内不激活、`onDestroy` 复原。 */
  let firstRender = true;
  const suggestionState = { active: false };

  /**
   * 官方 `m`（`kP` 内的默认 `handleSelect`，逐字）：
   * ```js
   * const m = (p, f) => { const { editor: g, range: v } = f;
   *   g.chain().focus().insertContentAt(v, [
   *     { type: "mention", attrs: { id: p.id, label: p.label, type: p.type, renderText: p.renderText,
   *                                thumbnail: p.avatar, videoSrc: p.videoSrc, mediaType: p.mediaType,
   *                                textContent: p.textContent } },
   *     { type: "text", text: " " },
   *   ]).run(),
   *   g.view.dom.ownerDocument.defaultView?.getSelection()?.collapseToEnd(); };
   * ```
   * ⇒ 应用时**总是在提及节点后补一个空格**，并把 DOM 选区塌到末尾。
   */
  const insertMention = (item: MentionSuggestionItem, props: SuggestionProps<MentionSuggestionItem>) => {
    const { editor, range } = props as unknown as { editor: MentionEditorLike; range: { from: number; to: number } };
    editor.chain().focus().insertContentAt(range, [
      {
        type: 'mention',
        attrs: {
          id: item.id,
          label: item.label,
          type: item.type,
          renderText: item.renderText,
          thumbnail: item.avatar,
          videoSrc: item.videoSrc,
          mediaType: item.mediaType,
          textContent: item.textContent,
        },
      },
      { type: 'text', text: ' ' },
    ]).run();
    editor.view.dom.ownerDocument.defaultView?.getSelection()?.collapseToEnd();
  };

  return Mention.extend({
    /** 官方 `onCreate` / `onDestroy`：挂载后一帧内 `allow` 不激活。 */
    onCreate() {
      firstRender = true;
      requestAnimationFrame(() => { firstRender = false; });
    },
    onDestroy() {
      firstRender = true;
    },
    addAttributes() {
      const parent = (this.parent?.() ?? {}) as Record<string, unknown>;
      return {
        ...parent,
        /* ⚠️ `type` 必须显式 render 成 `data-mention-type`（官方逐字）；
           通用回落路径会写成 `data-type`，与 `this.name` 撞车 ⇒ 会把 `data-type` 覆盖成 `node`。 */
        type: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute('data-mention-type'),
          renderHTML: (attrs: Record<string, unknown>) => (attrs.type ? { 'data-mention-type': attrs.type } : {}),
        },
        renderText: attribute({ name: 'renderText', parse: (el) => el.getAttribute('data-render-text') }),
        thumbnail: attribute({ name: 'thumbnail', parse: (el) => el.getAttribute('data-thumbnail') }),
        videoSrc: attribute({ name: 'videoSrc', parse: (el) => el.getAttribute('data-video-src') }),
        mediaType: attribute({ name: 'mediaType', parse: (el) => el.getAttribute('data-media-type') }),
        textContent: attribute({ name: 'textContent', parse: (el) => el.getAttribute('data-text-content') }),
        color: attribute({ name: 'color', parse: (el) => el.getAttribute('data-color') }),
        regionType: attribute({ name: 'regionType', parse: (el) => el.getAttribute('data-region-type') }),
        isLoading: {
          default: false,
          /* 官方只 parse 不 render：从 `data-render-text` 的 `magic_item:{…}` JSON 推 `isLoading`。 */
          parseHTML: (element: HTMLElement) => {
            const renderText = element.getAttribute('data-render-text');
            if (!renderText?.startsWith('magic_item:')) return false;
            try {
              return !!JSON.parse(renderText.replace('magic_item:', '')).isLoading;
            } catch {
              return false;
            }
          },
          renderHTML: () => ({}),
        },
      };
    },

    /** 官方 `renderHTML`（逐字）。 */
    renderHTML({ node, HTMLAttributes }) {
      const type = node.attrs.type as string | null;
      const label = (node.attrs.label ?? node.attrs.id) as string;
      const base = 'mention';
      const kindClass = type ? `mention-${type}` : '';
      if (type === 'magic') {
        const renderText = node.attrs.renderText as string | null;
        let loading = false;
        if (renderText?.startsWith('magic_item:')) {
          try { loading = !!JSON.parse(renderText.replace('magic_item:', '')).isLoading; } catch { /* 官方同样静默 */ }
        }
        return [
          'span',
          {
            'data-type': this.name,
            ...HTMLAttributes,
            class: [base, kindClass, loading ? 'mention-magic-loading' : ''].filter(Boolean).join(' '),
            'data-mention-type': type,
          },
          loading ? '⏳ ' : ['span', { class: 'mention-icon' }, '✨ '],
          label,
        ];
      }
      return [
        'span',
        {
          'data-type': this.name,
          ...HTMLAttributes,
          class: [base, kindClass].filter(Boolean).join(' '),
          'data-mention-type': type || undefined,
        },
        `${this.options.suggestion?.char ?? char}${label}`,
      ];
    },

    ...(nodeViewComponent
      ? {
        addKeyboardShortcuts() {
          /* 官方：退格紧贴 mention 时走 `H4(this.editor, this.name)`（阻止默认），与 Plugin 里的
             `handleKeyDown` 同源；这里直接交给 ProseMirror 的 filterTransaction 守卫处理。 */
          return {};
        },
        addNodeView() {
          return ReactNodeViewRenderer(nodeViewComponent as ComponentType<ReactNodeViewProps>, {
            as: 'span',
            attrs: { 'data-mention-node-view': 'true', contenteditable: 'false' },
          });
        },
        addProseMirrorPlugins() {
          const parentPlugins = this.parent?.() ?? [];
          const mentionTypeName = this.name;
          let backspaceFlag = false;
          let backspaceTimer: ReturnType<typeof setTimeout> | null = null;
          const guard = new Plugin({
            key: mentionBackspaceGuardKey,
            props: {
              handleDOMEvents: {
                /* 官方只在「无修饰键 Backspace」时置标记，并在 `setTimeout(…,0)` 后清掉；
                   `filterTransaction` 据此决定是否阻止「跨过 mention 的删除」。 */
                keydown: (_view, event) => {
                  const keyboard = event as KeyboardEvent;
                  backspaceFlag = keyboard.key === 'Backspace'
                    && !keyboard.altKey && !keyboard.ctrlKey && !keyboard.metaKey && !keyboard.shiftKey
                    && !(_view as unknown as { composing?: boolean }).composing;
                  if (backspaceFlag) {
                    if (backspaceTimer !== null) clearTimeout(backspaceTimer);
                    backspaceTimer = setTimeout(() => { backspaceFlag = false; backspaceTimer = null; }, 0);
                  }
                  return false;
                },
              },
            },
            /** 官方 `filterTransaction`（逐字）：
             * ```js
             * !flag || tr.getMeta(Ku) || !state.selection.empty ? true
             *   : !tr.docChanged && tr.selectionSet && !tr.selection.empty
             *       ? !z4(tr.doc, tr.selection.from, tr.selection.to, this.name)
             *   : tr.docChanged ? !MP(tr, state.doc, this.name) : true
             * ```
             * ⇒ 「无修饰键退格」这一拍的任何**把 mention 纳入选区**或**编辑到 mention** 的事务都被过滤掉，
             * 从而一次退格不会整块删掉提及节点。 */
            filterTransaction: (transaction, state) => {
              if (!backspaceFlag || transaction.getMeta(mentionBackspaceGuardKey) || !state.selection.empty) return true;
              if (!transaction.docChanged && transaction.selectionSet && !transaction.selection.empty) {
                return !rangeContainsNodeType(transaction.doc, transaction.selection.from, transaction.selection.to, mentionTypeName);
              }
              if (transaction.docChanged) {
                return !transactionTouchesNodeType(transaction, state.doc, mentionTypeName);
              }
              return true;
            },
          });
          /**
           * 官方第二个 Plugin（`mentionSuggestion`）：左键点在提及节点视图上时，
           * 把光标放到该节点**之后**（后面紧跟空格则再 +1），并阻止默认行为 + 聚焦。
           * 逐字逻辑：
           * ```js
           * mousedown(view, event) {
           *   if (!(event instanceof MouseEvent) || event.button !== 0 || meta/ctrl/shift/alt || RP(event.target)) return false;
           *   const el = event.target.closest(NP); if (!el || !view.dom.contains(el)) return false;
           *   let pos = view.posAtDOM(el, 0); let node = view.state.doc.nodeAt(pos);
           *   if (!node || node.type.name !== this.name) { const before = view.state.doc.resolve(pos).nodeBefore;
           *     if (before?.type.name === this.name) { pos -= before.nodeSize; node = before } }
           *   if (!node || node.type.name !== this.name) return false;
           *   const after = pos + node.nodeSize;
           *   const next = view.state.doc.textBetween(after, Math.min(after + 1, view.state.doc.content.size), "", "");
           *   const target = (next === " " || next === "\u00a0") ? after + 1 : after;
           *   event.preventDefault();
           *   view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target)));
           *   view.focus();
           *   return true;
           * }
           * ```
           */
          const clickToCaret = new Plugin({
            /* 官方这个 Plugin **没有** key（`al` 只给 `suggestion.pluginKey` 用）。 */
            props: {
              handleDOMEvents: {
                mousedown: (view, event) => {
                  const mouse = event as MouseEvent;
                  if (!(mouse instanceof MouseEvent)) return false;
                  if (mouse.button !== 0 || mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return false;
                  if (isInteractiveTarget(mouse.target)) return false;
                  const target = mouse.target;
                  if (!(target instanceof Element)) return false;
                  const element = target.closest(MENTION_NODE_VIEW_SELECTOR);
                  if (!element || !view.dom.contains(element)) return false;
                  let pos = view.posAtDOM(element, 0);
                  let node = view.state.doc.nodeAt(pos);
                  if (!node || node.type.name !== mentionTypeName) {
                    const before = view.state.doc.resolve(pos).nodeBefore;
                    if (before?.type.name === mentionTypeName) {
                      pos -= before.nodeSize;
                      node = before;
                    }
                  }
                  if (!node || node.type.name !== mentionTypeName) return false;
                  const after = pos + node.nodeSize;
                  const next = view.state.doc.textBetween(
                    after,
                    Math.min(after + 1, view.state.doc.content.size),
                    '',
                    '',
                  );
                  const caret = (next === ' ' || next === '\u00a0') ? after + 1 : after;
                  mouse.preventDefault();
                  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, caret)));
                  view.focus();
                  return true;
                },
              },
            },
          });
          /** 官方返回顺序：`[backspaceGuard, ...parentPlugins, clickToCaret]`。 */
          return [guard, ...parentPlugins, clickToCaret];
        },
      }
      : {}),
    /**
     * 官方 `configure({...})`（逐字，见 `live-ProseMirror-提及输入内核.md` §3）：
     * ```js
     * { HTMLAttributes:{class:"mention"},
     *   renderText({node}) { return `{{${resolveMentionToken?.(node.attrs) ?? node.attrs.renderText ?? node.attrs.label ?? node.attrs.id}}}` },
     *   suggestion: { pluginKey: al, char, allowedPrefixes: null, allowSpaces: true,
     *     findSuggestionMatch(position) { … },
     *     allow({editor, isActive}) { return suggestionEnabled ? (isActive ? true : firstRender ? false : editor.isFocused) : false },
     *     items: async ({query}) => …, render: B4({…}) } }
     * ```
     * `suggestion.render`（官方 `B4` + `Ub`）见 `mentionSuggestionRenderer.tsx` / `MentionSuggestionPanel.tsx`；
     * `handleSelect` 默认用官方 `m`（提及节点 + 一个空格）；`MessageInputAreaV2`(`Hie`) 的
     * `handleSelect: Ne`（插件 / 技能 / 连接器插入路径）由调用方经 `handleSelect` 注入。
     */
  }).configure({
    HTMLAttributes: { class: 'mention' },
    renderText({ node }: { node: { attrs: Record<string, unknown> } }) {
      const token = resolveMentionToken?.(node.attrs)
        ?? (node.attrs.renderText as string | undefined)
        ?? (node.attrs.label as string | undefined)
        ?? (node.attrs.id as string | undefined);
      return `{{${token}}}`;
    },
    suggestion: {
      pluginKey: mentionSuggestionKey as never,
      char,
      allowedPrefixes: null,
      allowSpaces: true,
      /** 官方自定义匹配：建议已激活时走 Tiptap 默认匹配并拒绝以空格开头的 query；
       *  未激活时只在光标前一个字符正好是 `char` 时触发（query 为空）。 */
      findSuggestionMatch(position: Parameters<typeof findSuggestionMatch>[0]) {
        if (suggestionState.active) {
          const match = findSuggestionMatch(position);
          return !match || match.query.startsWith(' ') ? null : match;
        }
        const { $position } = position as unknown as { $position: { pos: number; before: () => number; doc: { textBetween: (a: number, b: number, c: string, d: string) => string } } };
        const pos = $position.pos;
        const before = $position.before();
        if (pos <= before || $position.doc.textBetween(pos - 1, pos, '\0', '\0') !== char) return null;
        return { range: { from: pos - 1, to: pos }, query: '', text: char };
      },
      /** 官方 `allow`。 */
      allow({ editor, isActive }: { editor: { isFocused: boolean }; isActive?: boolean }) {
        if (!suggestionEnabled) return false;
        if (isActive) return true;
        if (firstRender) return false;
        return editor.isFocused;
      },
      items: async ({ query }: { query: string }) => {
        if (onSearch) return onSearch(query);
        const source = typeof items === 'function' ? items() : items;
        const needle = query.trim().toLowerCase();
        return source.filter((item) => (
          item.label.toLowerCase().includes(needle)
          || (item.description?.toLowerCase().includes(needle) ?? false)
        ));
      },
      /* 官方 `render: B4({component: Ub, …})`；MTV 用等价渲染器（面板类串逐字，定位方式见其文件头）。 */
      render: createMentionSuggestionRenderer({
        emptyLabel,
        suggestionState,
        /* 官方 `handleSelect: i.handleSelect ?? m`。 */
        handleSelect: handleSelect ?? insertMention,
        /* 官方 `matchEditorWidth` 三件套（`qie` 传 `true` / 选择器 / `320`）。 */
        matchEditorWidth,
        matchEditorWidthSelector,
        matchEditorMaxWidth,
        /* 官方 `renderer.componentProps`（`B4` 的最后一次展开；`Ub` 的域数据）。 */
        componentProps,
        /* 官方 qie 传给 JN 的 renderer 参数（逐字）。 */
        tippyOptions: {
          placement: 'top-start',
          offset: [0, 8],
          popperOptions: {
            modifiers: [
              { name: 'flip', options: { fallbackPlacements: ['top-start', 'bottom-start', 'top-end', 'bottom-end'] } },
              { name: 'preventOverflow', options: { padding: 8 } },
            ],
          },
        },
        getTotalItemCount: (list) => Math.min(list.length, 3) + (list.length > 3 ? 1 : 0),
      }),
    },
  });
}

export { mentionSuggestionKey as suggestionKey };
