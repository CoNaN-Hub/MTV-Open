/**
 * 官方 `qie` —— `ChatMentionInput`（live `vendor-pkg-canvas-ChpWx5JY.js` @2552774）逐字移植。
 *
 * 官方结构（见 `live-ProseMirror-提及输入内核.md` §1）：
 * ```js
 * qie = forwardRef(({value, onChange, placeholder, ariaLabel, className, maxLength,
 *   linkedSectionLabel, enableAssetLibrary = true, autoFocus = false, onKeyDown, onFocus, onBlur,
 *   onSubmit, minHeight = 20, maxHeight = 96, "data-testid": testid}, ref) => {
 *   // 根：<div data-chat-mention-input="true" data-testid className={cx("min-w-0 flex-1", className)}
 *   //        onCompositionStart={composing = true} onCompositionEnd={…下一帧校验长度…}>
 *   //   <jv value={html} extensions={[mentionExt]} onChange onTextChange onFocus onBlur onKeyDown
 *   //       onSubmit={O} shouldSubmitOnEnter={L} autoFocus enableInputRules={false} enablePasteRules={false}
 *   //       placeholder ariaLabel className={cx("w-full border-none bg-transparent shadow-none",
 *   //         "[&_.is-editor-empty:first-child::before]:text-muted-foreground", Crt, Xq)}
 *   //       minHeight maxHeight/>
 *   // 受控同步：value !== valueRef.current 时 html = wrt(value, maps)（**value → HTML**）
 *   // 长度：w_(text) 里每个提及记 1 个字符；超限则 setContentHtml(上一次 html) 回滚
 *   // handle：{focus:()=>editor.focus("end"), insertText: t=>editor.insertTextAtCursor(t),
 *   //          getText:()=>editor.getText() ?? value, isMentionSuggestionActive:()=>…}
 *   // 默认 onSubmit（无 onSubmit 时）：editor.insertTextAtCursor("<br>")
 *   // shouldSubmitOnEnter = () => editor.isMentionSuggestionActive() !== true
 * });
 * ```
 * `Crt`（官方类串数组，逐字）见 `Crt` 常量；`Xq`（提及节点类串 36 项）见 `Xq` 常量。
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { useT } from '../../i18n';
import {
  mentionTextLength,
  parsePluginRenderText,
  valueToEditorHtml,
  type MentionLookups,
} from '../../services/chat/mentionTokens';
import {
  buildMentionPluginConnectDetail,
  insertMentionPluginValue,
  mentionPluginSkillName,
  mentionPluginTokenReady,
  type MentionConnectorStatus,
  type MentionPluginConnectDetail,
  type MentionPluginSource,
  type MentionSuggestionPluginItem,
} from '../../services/chat/mentionPlugins';
import TiptapMentionEditor, { type TiptapMentionEditorHandle } from './TiptapMentionEditor';
import MentionNodeView from './MentionNodeView';
import { createMentionExtension, type MentionSuggestionItem } from './createMentionExtension';

/** 官方 `Crt`：编辑器类串数组（逐字）。 */
const Crt = [
  '[&_.ProseMirror]:whitespace-normal!',
  '[&_.ProseMirror]:break-words',
  '[&_.ProseMirror]:[overflow-wrap:anywhere]',
  "[&_.ProseMirror_[data-mention-node-view='true']]:inline-flex!",
  "[&_.ProseMirror_[data-mention-node-view='true']]:w-auto!",
  "[&_.ProseMirror_[data-mention-node-view='true']]:align-middle!",
  "[&_.ProseMirror_[data-mention-node-view='true']]:whitespace-nowrap!",
  '[&_.ProseMirror_p]:my-0!',
  '[&_.ProseMirror_p]:whitespace-normal!',
  '[&_.ProseMirror_p]:break-words',
  '[&_.ProseMirror_p]:[overflow-wrap:anywhere]',
  '[&_.ProseMirror]:px-0!',
  '[&_.ProseMirror]:pb-0!',
  '[&_.ProseMirror]:scrollbar-thin',
];

/** 官方 `Xq`：提及节点在编辑器里的附加类串（36 项，逐字）。 */
const Xq = [
  '[&_.ProseMirror_[data-mention-type]]:my-0',
  '[&_.mention-node]:rounded-[4px]',
  '[&_.mention-node]:bg-[#333333]',
  '[&_.mention-node]:p-1',
  '[&_.mention-node]:h-5',
  '[&_.mention-node]:min-w-[24px]',
  '[&_.mention-node]:max-w-[120px]',
  '[&_.mention-node]:gap-1',
  '[&_.mention-node]:text-white/60',
  "[&_.mention-node[data-mention-type='skill']]:p-0",
  "[&_.mention-node[data-mention-type='skill']]:text-text-text-primary",
  "[&_.mention-node[data-mention-type='brainstorm']]:bg-transparent",
  "[&_.mention-node[data-mention-type='brainstorm']]:p-0",
  "[&_.mention-node[data-mention-type='brainstorm']]:cursor-default",
  "[&_.mention-node[data-mention-type='brainstorm']]:text-text-text-primary",
  "[&_.mention-node[data-mention-type='plugin']]:bg-transparent",
  "[&_.mention-node[data-mention-type='plugin']]:p-0",
  "[&_.mention-node[data-mention-type='plugin']]:cursor-default",
  "[&_.mention-node[data-mention-type='plugin']]:text-text-text-primary",
  "[&_.mention-node[data-mention-type='skill']]:cursor-default",
  '[&_.mention-node]:transition-[filter,box-shadow,color]',
  '[&_.mention-node]:duration-200',
  '[&_.mention-node]:ease-out',
  '[&_.mention-node:hover]:text-white/80',
  "[&_.mention-node[data-mention-type='skill']:hover]:text-text-text-primary",
  "[&_.mention-node[data-mention-type='brainstorm']:hover]:text-text-text-primary",
  "[&_.mention-node[data-mention-type='plugin']:hover]:text-text-text-primary",
  '[&_.mention-node:hover]:brightness-110',
  '[&_.mention-node:hover]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
  "[&_.mention-node[data-mention-type='skill']:hover]:brightness-100",
  "[&_.mention-node[data-mention-type='skill']:hover]:shadow-none",
  "[&_.mention-node[data-mention-type='brainstorm']:hover]:brightness-100",
  "[&_.mention-node[data-mention-type='brainstorm']:hover]:shadow-none",
  "[&_.mention-node[data-mention-type='plugin']:hover]:brightness-100",
  "[&_.mention-node[data-mention-type='plugin']:hover]:shadow-none",
];

export interface ChatMentionInputHandle {
  focus: () => void;
  insertText: (text: string) => void;
  getText: () => string;
  isMentionSuggestionActive: () => boolean;
}

export interface ChatMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  maxLength?: number;
  autoFocus?: boolean;
  onKeyDown?: (event: KeyboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit?: () => void;
  minHeight?: number;
  maxHeight?: number;
  'data-testid'?: string;
  /** 提及展示所需的查询表（官方来自 `vE()` + 资产缓存）。 */
  lookups: MentionLookups;
  /** `@` 建议弹层的候选（官方 `vE().mentionItems`）。 */
  mentionItems?: () => MentionSuggestionItem[];
  onSearchMentions?: (query: string) => MentionSuggestionItem[];

  /* ── 「应用」组（官方 `MessageInputAreaV2` 的 `renderer.componentProps`，canvas @2537631） ── */

  /**
   * 官方 `componentProps.plugins`：`Ub` 的「应用」分组行数据（`Re`）。
   * **传入即开启应用分组**（`showPlugins: true`）；不传时保持官方 `qie`
   * （canvas @2554637）的 `showPlugins: !1` —— 即 `AskQuestionSheet` 的自由文本输入
   * 与官方一致地**没有**应用分组。
   */
  mentionPlugins?: readonly MentionPluginSource[];
  /** 官方 `ae`：连接器状态表（喂 `I1` 合并状态）。 */
  connectorStatusById?: ReadonlyMap<string, MentionConnectorStatus>;
  /** 官方 `linkedSectionLabel`（`qie` 的 prop `l`；缺省 `t("chatAdapter.context.addReference","Add reference")`）。 */
  linkedSectionLabel?: string;
  /**
   * 官方 `Ne` 里未就绪分支的 `sn.getState().setPluginToConnect({...yt, isInstalled:!0, status:…})`。
   * MTV 无应用连接浮层 ⇒ 由宿主注入（缺省时只把 `@query` 还原成普通文本，与官方 `r(lt)` 一致）。
   */
  onPluginNeedsConnect?: (detail: MentionPluginConnectDetail) => void;
  /** 官方 `_p` 的 `r.setActivePlugin(name)` / `r.setActivePluginExamplePrompt(…)`。 */
  onPluginActivate?: (pluginName: string, examplePrompt: string | null) => void;
}

/** 官方 `Ne` 的默认（非 plugin）分支所需的编辑器最小形状（与 `createMentionExtension` 的 `m` 同源）。 */
interface MentionSelectEditorLike {
  chain: () => {
    focus: () => {
      deleteRange: (range: unknown) => { run: () => void };
      insertContentAt: (range: unknown, content: unknown) => { run: () => void };
    };
  };
  getText: () => string;
  view: { dom: { ownerDocument: { defaultView: { getSelection: () => Selection | null } | null } } };
}

const ChatMentionInput = forwardRef<ChatMentionInputHandle, ChatMentionInputProps>(
  function ChatMentionInput({
    value,
    onChange,
    placeholder,
    ariaLabel,
    className,
    maxLength,
    autoFocus = false,
    onKeyDown,
    onFocus,
    onBlur,
    onSubmit,
    minHeight = 20,
    maxHeight = 96,
    'data-testid': testid,
    lookups,
    mentionItems,
    onSearchMentions,
    mentionPlugins,
    connectorStatusById,
    linkedSectionLabel,
    onPluginNeedsConnect,
    onPluginActivate,
  }, ref) {
    /** 官方 `se().t`：`linkedSectionLabel` 兜底 + 语言切换重渲染。 */
    const t = useT();
    const editorRef = useRef<TiptapMentionEditorHandle | null>(null);
    const valueRef = useRef<string | null>(null);
    const htmlRef = useRef('<p></p>');
    const composingRef = useRef(false);
    /** 官方 `Ge.current`：显式写回编辑器后，`onTextChange` 的这一次回调要跳过。 */
    const suppressTextChangeRef = useRef(false);
    const [html, setHtml] = useState('<p></p>');

    /**
     * 官方 `MessageInputAreaV2` 的 `renderer.componentProps`（canvas @2537631，逐字）：
     * `{enableAssetLibrary:!0, enableElementLibrary:!0, libraryMentionMode:"agent-reference",
     *   selectFolders:!0, showPlugins:!0, linkedSectionLabel:m("chatAdapter.context.addReference","Add reference")}`。
     *
     * ⚠️ 如实记录：MTV 没有「素材库 / 元素库 / 连接器」数据域 ⇒ 这里只接**应用组**
     * （`showPlugins` + `plugins` + `connectorStatusById` + `linkedSectionLabel`）；
     * `enableAssetLibrary` / `enableElementLibrary` / `libraryMentionMode` / `selectFolders`
     * 保持 `Ub` 的 props 缺省（§8.5 第 3 条：数据源在 MTV 侧仍缺）。
     */
    const componentProps = useMemo(() => ({
      showPlugins: mentionPlugins != null,
      plugins: mentionPlugins,
      connectorStatusById,
      linkedSectionLabel: linkedSectionLabel ?? t('chatAdapter.context.addReference'),
    }), [mentionPlugins, connectorStatusById, linkedSectionLabel, t]);

    /* 官方受控同步：`value !== valueRef.current` ⇒ `html = wrt(value, maps)` 并写回编辑器。 */
    useEffect(() => {
      if (value === valueRef.current) return;
      valueRef.current = value;
      if (!value) {
        htmlRef.current = '<p></p>';
        setHtml('<p></p>');
        editorRef.current?.clear();
        return;
      }
      const next = valueToEditorHtml(value, lookups);
      htmlRef.current = next;
      setHtml(next);
    }, [lookups, value]);

    /* 官方 `updateMentionLabels`：提及标题表变化时刷新（MTV 侧暂无增量接口，保留 effect 位）。 */
    useEffect(() => {
      if (valueRef.current === null) return;
    }, [lookups]);

    /** 官方 `P`：编辑器 HTML 变化。 */
    const handleChange = useCallback((nextHtml: string) => { setHtml(nextHtml); }, []);

    /** 官方 `j`：把「上一次的 html」写回编辑器（超限回滚用）。 */
    const restoreHtml = useCallback(() => {
      editorRef.current?.setContentHtml(htmlRef.current);
    }, []);

    /** 官方 `R = onTextChange`：长度超限则回滚，否则向上抛 value。 */
    const handleTextChange = useCallback((text: string) => {
      /* `applyMentionValue` 显式写回编辑器时，`setContentHtml`（`emitUpdate:true`）会回调一次
         `onTextChange(editor.getText())`，而编辑器里是提及的**展示名**、不是 `{{…}}` token
         ⇒ 跳过这一次，保留刚写进去的 token 值（官方用 `FI(text)` 反推 value，MTV 未移植）。 */
      if (suppressTextChangeRef.current) { suppressTextChangeRef.current = false; return; }
      if (valueRef.current !== null) {
        if (maxLength != null && !composingRef.current) {
          const next = mentionTextLength(text);
          const previous = mentionTextLength(valueRef.current);
          if (next > maxLength && next > previous) { restoreHtml(); return; }
        }
        if (text !== valueRef.current) {
          valueRef.current = text;
          onChange(text);
        }
      }
    }, [maxLength, onChange, restoreHtml]);

    /**
     * 官方 `f.current?.setContentHtml(Ke)` + `r(Ke)`：把一个 **value**（含 token）同时写回
     * 受控状态与编辑器。
     */
    const applyMentionValue = useCallback((next: string) => {
      const nextHtml = valueToEditorHtml(next, lookups);
      valueRef.current = next;
      htmlRef.current = nextHtml;
      setHtml(nextHtml);
      suppressTextChangeRef.current = true;
      editorRef.current?.setContentHtml(nextHtml);
      onChange(next);
    }, [lookups, onChange]);

    /**
     * 官方 `Ne`（`MessageInputAreaV2`，canvas @2527922 内，逐字见
     * `live-ProseMirror-提及输入内核.md` §6 / `_sym` 全文）：
     * ```js
     * Ne = useCallback(async (Ee, tt) => {
     *   const Ke = Ee.type === "plugin" && Ee.renderText ? $q(Ee.renderText) : null;
     *   if (Ke) {
     *     if (Ee.pluginIsInstalled !== !0) return;
     *     const {editor: We, range: st} = tt;
     *     We.chain().focus().deleteRange({from: st.from, to: st.to}).run();
     *     const lt = We.getText();
     *     Ge.current = !0, Fe.current = lt;
     *     const ze = …skills…, ft = …connectors…;
     *     const yt = {pluginName, displayName, description, downloadCount:"0", isInstalled,
     *                 status, isUpdateAvailable:!1, skills, connectors, marketingSlots:[], iconUrl};
     *     if (!lrt(yt, Ee.pluginConnectorStatus)) {
     *       r(lt); const pt = ue(lt); g(pt), f.current?.setContentHtml(pt);
     *       sn.getState().setPluginToConnect({...yt, isInstalled:!0, status:(yt.status??"enabled")==="enabled"?"enabled":"disabled"});
     *       return;
     *     }
     *     const ot = _p(yt, b, lt);
     *     if (ot) { Fe.current = ot, r(ot); const pt = ue(ot); g(pt), f.current?.setContentHtml(pt); }
     *     return;
     *   }
     *   const {editor: Ze, range: be} = tt;
     *   Ze.chain().focus().insertContentAt(be, [
     *     {type:"mention", attrs:{id, label, type, renderText, thumbnail: Ee.avatar, videoSrc, mediaType, textContent}},
     *     {type:"text", text:" "},
     *   ]).run();
     *   Ze.view.dom.ownerDocument.defaultView?.getSelection()?.collapseToEnd();
     * }, [b, r, ue]);
     * ```
     * MTV 侧差异（如实）：官方 `_p` 读/写「会话输入值」（`qe.getState()`），MTV 完全受控
     * ⇒ 用 `applyMentionValue` 取代 `r(...) + f.current?.setContentHtml(...)`；
     * 官方 `_p` 里的 `setActivePlugin` / `setActivePluginExamplePrompt` 经 `onPluginActivate` 注入。
     */
    const handleSelectMention = useCallback((
      item: MentionSuggestionItem,
      props: SuggestionProps<MentionSuggestionItem>,
    ) => {
      const pluginItem = item as MentionSuggestionItem & Partial<MentionSuggestionPluginItem>;
      const parsed = pluginItem.type === 'plugin' && pluginItem.renderText
        ? parsePluginRenderText(pluginItem.renderText)
        : null;
      if (parsed) {
        /* 官方：未安装直接 return（不插入、不改输入值）。 */
        if (pluginItem.pluginIsInstalled !== true) return;
        const editor = props.editor as unknown as MentionSelectEditorLike;
        const { from, to } = props.range;
        editor.chain().focus().deleteRange({ from, to }).run();
        const text = editor.getText();
        const detail = buildMentionPluginConnectDetail(pluginItem as MentionSuggestionPluginItem, parsed);
        if (!mentionPluginTokenReady(detail, pluginItem.pluginConnectorStatus)) {
          applyMentionValue(text);
          onPluginNeedsConnect?.({
            ...detail,
            isInstalled: true,
            status: (detail.status ?? 'enabled') === 'enabled' ? 'enabled' : 'disabled',
          });
          return;
        }
        /* 官方 `_p(detail, sessionId, text)` ⇒ `I0e(value, pluginName, C$({...}))`。 */
        applyMentionValue(insertMentionPluginValue(
          text,
          detail.pluginName,
          mentionPluginSkillName(detail),
        ));
        /* 官方 `setActivePluginExamplePrompt(o.examplePrompt ? null : e.examplePrompts?.[0]?.trim() || null)`。 */
        onPluginActivate?.(detail.pluginName, null);
        return;
      }
      /* 官方默认分支（与 `kP` 的 `m` 逐字同文）。 */
      const editor = props.editor as unknown as MentionSelectEditorLike;
      editor.chain().focus().insertContentAt(props.range, [
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
    }, [applyMentionValue, onPluginActivate, onPluginNeedsConnect]);

    /** 官方 `F = useMemo(() => JN({items, onSearch, nodeViewComponent, renderer}), [componentProps, handleSelect, t])`。 */
    const extensions = useMemo(() => [
      createMentionExtension({
        char: '@',
        items: mentionItems,
        onSearch: onSearchMentions,
        /* 官方 `nodeViewComponent: UR`（提及节点视图）。 */
        nodeViewComponent: MentionNodeView,
        /* 官方 `MessageInputAreaV2` 的 `renderer` 三件套（canvas @2537631，逐字）。 */
        matchEditorWidth: true,
        matchEditorWidthSelector: "[data-mention-popover-width-source='true']",
        matchEditorMaxWidth: 320,
        /* 官方 `renderer.componentProps`（`Ub` 的域数据；`B4` 里最后一次展开）。 */
        componentProps,
        /* 官方 `handleSelect: Ne`（`MessageInputAreaV2`）；没有应用组时不接，保持 `qie` 的默认 `m`。 */
        handleSelect: mentionPlugins != null ? handleSelectMention : undefined,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any, [componentProps, handleSelectMention, mentionItems, mentionPlugins, onSearchMentions]);

    /** 官方 `D`：`compositionend` 后下一帧再校验长度。 */
    const handleCompositionEnd = useCallback(() => {
      composingRef.current = false;
      if (maxLength == null) return;
      requestAnimationFrame(() => {
        const text = editorRef.current?.getText() ?? '';
        if (text.length > maxLength) restoreHtml();
      });
    }, [maxLength, restoreHtml]);

    /** 官方 `O`：有 `onSubmit` 就走它，否则插入 `<br>`。 */
    const handleSubmit = useCallback(() => {
      if (onSubmit) { onSubmit(); return; }
      editorRef.current?.insertTextAtCursor('<br>');
    }, [onSubmit]);

    /** 官方 `L`：`shouldSubmitOnEnter`。 */
    const shouldSubmitOnEnter = useCallback(
      () => editorRef.current?.isMentionSuggestionActive() !== true,
      [],
    );

    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus('end'),
      insertText: (text: string) => editorRef.current?.insertTextAtCursor(text),
      getText: () => editorRef.current?.getText() ?? value,
      isMentionSuggestionActive: () => editorRef.current?.isMentionSuggestionActive() === true,
    }), [value]);

    /* `useT()` 已订阅语言切换（官方 `t` 用于 `linkedSectionLabel` 兜底）。 */

    return (
      <div
        data-chat-mention-input="true"
        data-testid={testid}
        className={`min-w-0 flex-1 ${className ?? ''}`.trim()}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={handleCompositionEnd}
      >
        <TiptapMentionEditor
          ref={editorRef}
          value={html}
          extensions={extensions}
          onChange={handleChange}
          onTextChange={handleTextChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onSubmit={handleSubmit}
          shouldSubmitOnEnter={shouldSubmitOnEnter}
          autoFocus={autoFocus}
          enableInputRules={false}
          enablePasteRules={false}
          placeholder={placeholder ?? ''}
          ariaLabel={ariaLabel}
          minHeight={minHeight}
          maxHeight={maxHeight}
          className={`w-full border-none bg-transparent shadow-none [&_.is-editor-empty:first-child::before]:text-muted-foreground ${Crt.join(' ')} ${Xq.join(' ')}`}
        />
      </div>
    );
  },
);

export default ChatMentionInput;
