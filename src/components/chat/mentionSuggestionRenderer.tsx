/**
 * 官方 `B4` —— 建议 `render()` 工厂（live `vendor-packages-jvPqKqU8.js` @489029）**逐字移植**。
 *
 * 官方原文（要点，全部来自 bundle）：
 * ```js
 * function B4({ component, componentProps = {}, tippyOptions = {}, getAppendTo, handleSelect,
 *               matchEditorWidth = false, matchEditorWidthSelector, matchEditorMaxWidth,
 *               getTotalItemCount, suggestionState }) {
 *   return () => {
 *     let tippyInstance = null, props = null, container = null, selectedIndex = -1, items = [], scrollables = [], reactRoot = null;
 *     const setKeyDownInterceptor = v => { keyDownInterceptor = v };
 *     let totalItemCountOverride = null;
 *     const setTotalItemCount = v => { totalItemCountOverride = v };
 *     const setSelectedIndex = v => { selectedIndex = v; render(); };
 *     const onSelect = item => { handleSelect?.(item, props) };
 *     const measureRef = V => matchEditorWidth ? (() => (matchEditorWidthSelector ? editorDom.closest(sel) ?? editorDom : editorDom).getBoundingClientRect()) : V.clientRect;
 *     const syncPopupWidth = V => { if (!container || !matchEditorWidth) return;
 *       const { width } = target(V).getBoundingClientRect();
 *       const w = (matchEditorMaxWidth != null && isFinite && >0) ? Math.min(width, matchEditorMaxWidth) : width;
 *       container.style.width = `${Math.round(w)}px`; container.style.maxWidth = "calc(100vw - 24px)"; };
 *     const close = () => { if (!props) return; const { editor, range } = props;
 *       editor.state.doc.textBetween(range.from, range.to, "", "").startsWith("@")
 *         && editor.chain().focus().deleteRange({ from: range.from, to: range.to }).run(); };
 *     const teardownScroll = () => { …remove scroll listeners… };
 *     const setupScroll = editor => { scrollables = collectScrollableAncestors(editor.view.dom);
 *       scrollables.forEach(el => el.addEventListener("scroll", () => close(), { passive: true })) };
 *     const totalCount = () => totalItemCountOverride !== null ? totalItemCountOverride
 *                          : getTotalItemCount ? getTotalItemCount(items) : items.length;
 *     const render = () => { reactRoot.render(<component items query={props?.query ?? ""} selectedIndex={selectedIndex}
 *       onSelect setKeyDownInterceptor setTotalItemCount setSelectedIndex onClose={close}
 *       matchContainerWidth={matchEditorWidth} {...componentProps}/>) };
 *     return {
 *       onStart: V => { suggestionState && (suggestionState.active = true); props = V; items = V.items; selectedIndex = -1;
 *         container = document.createElement("div"); reactRoot = createRoot(container); syncPopupWidth(V);
 *         const appendTo = getAppendTo?.(V.editor) ?? document.body; setupScroll(V.editor);
 *         tippyInstance = tippy(appendTo, { getReferenceClientRect: measureRef(V), appendTo,
 *           content: container, showOnCreate: true, interactive: true, trigger: "manual",
 *           placement: "bottom-start", sticky: true, ...(matchEditorWidth ? { maxWidth: "none" } : {}), ...tippyOptions });
 *         render(); },
 *       onUpdate: V => { props = V; items = V.items; selectedIndex = 0; tippyInstance && (syncPopupWidth(V),
 *         tippyInstance.setProps({ getReferenceClientRect: measureRef(V) })); render(); },
 *       onKeyDown: ({ event }) => { const count = totalCount();
 *         ArrowUp → count!==0 && (selectedIndex = (selectedIndex - 1 + count) % count, render()); true
 *         ArrowDown → count!==0 && (selectedIndex = (selectedIndex + 1) % count, render()); true
 *         ArrowRight|ArrowLeft|Tab → keyDownInterceptor?.(event) ? (render(), true) : false
 *         Enter → event.stopPropagation(); keyDownInterceptor?.(event) ? true : (selectedIndex >= 0 && onSelect(items[selectedIndex]), true)
 *         Escape → (keyDownInterceptor?.(event) || close(), true)
 *         default → false },
 *       onExit: () => { suggestionState && (suggestionState.active = false); teardownScroll(); tippyInstance?.destroy();
 *         reactRoot?.unmount(); … },
 *     };
 *   };
 * }
 * ```
 * `kP` 传入的 `tippyOptions`（`qie`，逐字）：`{ placement:"top-start", offset:[0,8],
 *   popperOptions:{ modifiers:[ {name:"flip", options:{ fallbackPlacements:["top-start","bottom-start","top-end","bottom-end"] }},
 *                               {name:"preventOverflow", options:{ padding:8 }} ] } }`
 * ⇒ 默认 `bottom-start` 被 `qie` 覆盖成 `top-start`。
 */
import { createRoot, type Root } from 'react-dom/client';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { tippyStickyPlugin } from './tippyStickyPlugin';
import MentionSuggestionPanel from './MentionSuggestionPanel';
import type { MentionSuggestionPanelProps } from './MentionSuggestionPanel';
import type { MentionSuggestionItem } from './createMentionExtension';

/** 官方 `TP`：收集可滚动的祖先元素（`overflow/overflowX/overflowY` 命中 `auto|scroll|overlay`）。 */
export function collectScrollableAncestors(element: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  let node = element.parentElement;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflow = `${style.overflow}${style.overflowY}${style.overflowX}`;
    if (/(auto|scroll|overlay)/.test(overflow)) out.push(node);
    node = node.parentElement;
  }
  return out;
}

export interface MentionSuggestionRendererOptions {
  emptyLabel?: string;
  /**
   * 官方 `B4` 的 `componentProps = {}`：**最后**展开进 `Ub`
   * （`<component items query selectedIndex onSelect setKeyDownInterceptor setTotalItemCount
   *   setSelectedIndex onClose matchContainerWidth {...componentProps}/>` 逐字）。
   * `qie`/`MessageInputAreaV2` 传的 `enableAssetLibrary` / `showPlugins` / `plugins` /
   * `linkedSectionLabel` 等域数据都从这里进。
   */
  componentProps?: Partial<MentionSuggestionPanelProps>;
  /** 官方 `getAppendTo(editor)`。 */
  getAppendTo?: (editor: unknown) => HTMLElement;
  /** 官方 `handleSelect`（默认由 `Suggestion` 的 `command` 承担）。 */
  handleSelect?: (item: MentionSuggestionItem, props: SuggestionProps<MentionSuggestionItem>) => void;
  /** 官方 `matchEditorWidth` 一族。 */
  matchEditorWidth?: boolean;
  matchEditorWidthSelector?: string;
  matchEditorMaxWidth?: number;
  /** 官方 `getTotalItemCount(list)`。 */
  getTotalItemCount?: (list: readonly MentionSuggestionItem[]) => number;
  /** 官方 `suggestionState`（`{active}`，`kP` 的 `u`）。 */
  suggestionState?: { active: boolean };
  /** 官方 `tippyOptions`（`qie` 传 `{placement:"top-start", offset:[0,8], popperOptions:{…}}`）。 */
  tippyOptions?: Record<string, unknown>;
}

/** 官方 `B4`。 */
export default function createMentionSuggestionRenderer(options: MentionSuggestionRendererOptions = {}) {
  const {
    emptyLabel = '',
    getAppendTo,
    handleSelect,
    matchEditorWidth = false,
    matchEditorWidthSelector,
    matchEditorMaxWidth,
    getTotalItemCount,
    suggestionState,
    componentProps = {},
    tippyOptions = {},
  } = options;

  return () => {
    let tippyInstance: TippyInstance | null = null;
    let props: SuggestionProps<MentionSuggestionItem> | null = null;
    let container: HTMLDivElement | null = null;
    let reactRoot: Root | null = null;
    /** 官方 `v`：`onStart` 时 **-1**（未选中），`onUpdate` 时归 0。 */
    let selectedIndex = -1;
    let items: MentionSuggestionItem[] = [];
    let scrollables: HTMLElement[] = [];
    let totalItemCountOverride: number | null = null;
    let keyDownInterceptor: ((event: KeyboardEvent) => boolean) | null = null;

    /** 官方 `w`。 */
    const setKeyDownInterceptor = (interceptor: ((event: KeyboardEvent) => boolean) | null) => {
      keyDownInterceptor = interceptor;
    };
    /** 官方 `A`。 */
    const setTotalItemCount = (count: number) => { totalItemCountOverride = count; };
    /** 官方 `T`。 */
    const setSelectedIndex = (index: number) => { selectedIndex = index; render(); };

    const editorDom = (value: SuggestionProps<MentionSuggestionItem>): HTMLElement => {
      const dom = (value.editor as unknown as { view: { dom: HTMLElement } }).view.dom;
      return matchEditorWidthSelector ? (dom.closest(matchEditorWidthSelector) as HTMLElement ?? dom) : dom;
    };
    /** 官方 `R`。 */
    const referenceRect = (value: SuggestionProps<MentionSuggestionItem>) => (
      matchEditorWidth
        ? () => editorDom(value).getBoundingClientRect()
        : value.clientRect
    );
    /** 官方 `_`：`matchEditorWidth` 时把弹层宽度对齐编辑器（可被 `matchEditorMaxWidth` 夹住）。 */
    const syncPopupWidth = (value: SuggestionProps<MentionSuggestionItem>) => {
      if (!container || !matchEditorWidth) return;
      const { width } = editorDom(value).getBoundingClientRect();
      const target = (matchEditorMaxWidth != null && Number.isFinite(matchEditorMaxWidth) && matchEditorMaxWidth > 0)
        ? Math.min(width, matchEditorMaxWidth)
        : width;
      container.style.width = `${Math.round(target)}px`;
      container.style.maxWidth = 'calc(100vw - 24px)';
    };
    /** 官方 `N`：关闭 = 删掉光标前的 `@query`。 */
    const close = () => {
      if (!props) return;
      const { editor, range } = props;
      const query = editor.state.doc.textBetween(range.from, range.to, '', '');
      if (query.startsWith('@')) {
        editor.chain().focus().deleteRange({ from: range.from, to: range.to }).run();
      }
    };
    const teardownScroll = () => {
      for (const el of scrollables) el.removeEventListener('scroll', close);
      scrollables = [];
    };
    /** 官方 `G`：把 `@query` 的可滚动祖先全部挂上 scroll → close（先 `teardownScroll()`）。 */
    const setupScroll = (editor: SuggestionProps<MentionSuggestionItem>['editor']) => {
      teardownScroll();
      scrollables = collectScrollableAncestors((editor as unknown as { view: { dom: HTMLElement } }).view.dom);
      if (scrollables.length === 0) return;
      for (const el of scrollables) el.addEventListener('scroll', close, { passive: true });
    };
    /** 官方 `H`。 */
    const totalCount = () => (
      totalItemCountOverride !== null
        ? totalItemCountOverride
        : getTotalItemCount
          ? getTotalItemCount(items)
          : items.length
    );

    /** 官方 `q`：把 `Ub` 渲染进 tippy 的 content 容器。 */
    const render = () => {
      if (!reactRoot) return;
      reactRoot.render(
        <MentionSuggestionPanel
          items={items}
          selectedIndex={selectedIndex}
          emptyLabel={emptyLabel}
          onSelect={(item) => onSelect(item)}
          onHover={(index) => { selectedIndex = index; render(); }}
          onClose={close}
          matchContainerWidth={matchEditorWidth}
          setSelectedIndex={setSelectedIndex}
          setTotalItemCount={setTotalItemCount}
          setKeyDownInterceptor={setKeyDownInterceptor}
          {...componentProps}
        />,
      );
    };

    /** 官方 `O`：只走 `handleSelect`（`kP` 必定传入 `handleSelect ?? 默认插入`），无 `command` 回落。 */
    const onSelect = (item: MentionSuggestionItem) => {
      if (handleSelect && props) handleSelect(item, props);
    };

    return {
      onStart: (value: SuggestionProps<MentionSuggestionItem>) => {
        if (suggestionState) suggestionState.active = true;
        totalItemCountOverride = null;
        props = value;
        items = value.items;
        selectedIndex = -1;
        container = document.createElement('div');
        reactRoot = createRoot(container);
        syncPopupWidth(value);
        const appendTo = getAppendTo?.(value.editor) ?? document.body;
        setupScroll(value.editor);
        tippyInstance = tippy(appendTo, {
          getReferenceClientRect: referenceRect(value) as never,
          appendTo,
          content: container,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          /* 官方 `plugins:[pv]`：tippy sticky 插件（见 `tippyStickyPlugin.ts`）+ `sticky:true`。 */
          plugins: [tippyStickyPlugin],
          sticky: true,
          ...(matchEditorWidth ? { maxWidth: 'none' } : {}),
          ...tippyOptions,
        } as never);
        render();
      },
      onUpdate: (value: SuggestionProps<MentionSuggestionItem>) => {
        props = value;
        items = value.items;
        selectedIndex = 0;
        if (tippyInstance) {
          syncPopupWidth(value);
          tippyInstance.setProps({ getReferenceClientRect: referenceRect(value) as never });
        }
        render();
      },
      onKeyDown: ({ event }: SuggestionKeyDownProps): boolean => {
        const count = totalCount();
        if (event.key === 'ArrowUp') {
          if (count !== 0) { selectedIndex = (selectedIndex - 1 + count) % count; render(); }
          return true;
        }
        if (event.key === 'ArrowDown') {
          if (count !== 0) { selectedIndex = (selectedIndex + 1) % count; render(); }
          return true;
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Tab') {
          return keyDownInterceptor?.(event) ? (render(), true) : false;
        }
        if (event.key === 'Enter') {
          event.stopPropagation();
          if (keyDownInterceptor?.(event)) return true;
          if (selectedIndex >= 0) {
            const item = items[selectedIndex];
            if (item) onSelect(item);
          }
          return true;
        }
        if (event.key === 'Escape') {
          if (!keyDownInterceptor?.(event)) close();
          return true;
        }
        return false;
      },
      onExit: () => {
        if (suggestionState) suggestionState.active = false;
        teardownScroll();
        tippyInstance?.destroy();
        reactRoot?.unmount();
        tippyInstance = null;
        reactRoot = null;
        container = null;
        props = null;
      },
    };
  };
}
