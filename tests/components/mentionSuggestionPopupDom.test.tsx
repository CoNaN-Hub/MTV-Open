// @vitest-environment jsdom
/**
 * `@` 建议弹层（官方 `Ub` + `B4`）的真实 DOM 回归。
 *
 * 官方逐字常量（`vendor-packages` @497816–497949）：
 *  · 外表面 `OP` = `text-white rounded-[16px] overflow-hidden backdrop-blur-[28px]`
 *  · 根 `Us` = `cx(OP, narrow ? "flex w-full min-w-0 flex-col" : "flex flex-col w-[320px]",
 *                    tall ? "h-[320px]" : "max-h-[320px]")`
 *  · 内层 `sw` = `flex min-h-0 flex-1 flex-col gap-2 p-2`
 *  · 行基类 `LP` = `flex items-center gap-[8px] w-full px-[8px] py-[6px] text-left transition-colors rounded-[6px] cursor-pointer hover:bg-white/10`
 *  · 选中态 `jP` = `bg-white/10`
 *  · 空态 = `px-1 py-3 text-[14px] text-[rgba(255,255,255,0.4)]`
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MentionSuggestionPanel from '../../src/components/chat/MentionSuggestionPanel';
import createMentionSuggestionRenderer from '../../src/components/chat/mentionSuggestionRenderer';
import { createMentionExtension, type MentionSuggestionItem } from '../../src/components/chat/createMentionExtension';

afterEach(cleanup);

/** tippy 的首次挂载走一个宏任务 tick（`showOnCreate` → popper 首次 update），React 树也要 flush。 */
const flushPopup = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
};

const items: MentionSuggestionItem[] = [
  { id: '111', label: '角色参考图' },
  { id: '222', label: '桥面全景', description: '12' },
];

describe('MentionSuggestionPanel（官方 Ub 外壳）', () => {
  it('根：官方 `Us` 默认分支 + `data-mention-panel` + onMouseDown 阻止默认', () => {
    const { container } = render(
      <MentionSuggestionPanel items={items} selectedIndex={0} onSelect={() => {}} onHover={() => {}} emptyLabel="无结果" />,
    );
    const root = container.querySelector('[data-mention-panel]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.className).toBe('text-white rounded-[16px] overflow-hidden backdrop-blur-[28px] flex flex-col w-[320px] max-h-[320px]');
    /* 官方 `PP` 的内表面。 */
    expect(root.style.backgroundColor).toBe('rgb(47, 47, 47)');
    expect(root.style.boxShadow).toContain('rgba(0,0,0,0.16)');
  });

  it('内层 `sw` + 官方 `Am` 滚动壳（`kk` + 主分支 `gap-[6px]`）逐字', () => {
    const { container } = render(
      <MentionSuggestionPanel items={items} selectedIndex={0} onSelect={() => {}} onHover={() => {}} emptyLabel="无结果" />,
    );
    expect(container.querySelector('.flex.min-h-0.flex-1.flex-col.gap-2.p-2')).not.toBeNull();
    /* 官方 `Am`（`MentionScrollFade`）外壳：`relative flex min-h-0 min-w-0 flex-1 flex-col`。 */
    const shell = container.querySelector('.relative.flex.min-h-0.min-w-0.flex-1.flex-col') as HTMLElement;
    expect(shell).not.toBeNull();
    /* 官方 `Am` 内层滚动 div = `cx("[scrollbar-width:none] [&::-webkit-scrollbar]:hidden", cx(kk, "gap-[6px]"))`
       （主分支是 `gap-[6px]`；文件夹/指令下钻分支才是 `gap-[2px]`，见 `_ub_fmt.txt` 2107 / 1885）。 */
    const list = shell.querySelector('.overflow-y-auto') as HTMLElement;
    expect(list.className).toContain('flex min-h-0 flex-1 w-full min-w-0 flex-col items-stretch overflow-y-auto pb-1');
    expect(list.className).toContain('[&::-webkit-scrollbar]:hidden');
    expect(list.className).toContain('[-ms-overflow-style:none] [scrollbar-width:none]');
    expect(list.className).toContain('gap-[6px]');
  });

  it('行：官方 `LP` 基类 + 选中 `bg-white/10` + 官方 linked 行结构', () => {
    const { container } = render(
      <MentionSuggestionPanel items={items} selectedIndex={1} onSelect={() => {}} onHover={() => {}} emptyLabel="无结果" />,
    );
    const rows = container.querySelectorAll('[data-selectable-index]');
    expect(rows).toHaveLength(2);
    const base = 'flex items-center gap-[8px] w-full px-[8px] py-[6px] text-left transition-colors rounded-[6px] cursor-pointer hover:bg-white/10';
    expect(rows[0].className).toBe(base);
    expect(rows[1].className).toBe(`${base} bg-white/10`);
    /* 官方 `Ub` 主分支的 linked 行：缩略图 → 名称包裹 span → `#n` 快捷号 → 类型角标。 */
    expect(rows[0].querySelector('span')!.className).toBe('flex-1 min-w-0 flex items-center gap-1');
    expect(rows[0].querySelector('span.text-sm')!.className).toBe('text-sm font-medium leading-5 text-white/90 truncate');
    /* description 在本行不参与渲染；官方渲染的是 `#序号`（`xe`，选中时附加 `text-white/60`）。 */
    const counter = rows[1].querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(counter.textContent).toBe('#2');
    expect(counter.className).toBe('min-w-[22px] shrink-0 text-right text-[11px] font-medium leading-4 tabular-nums text-white/30 text-white/60');
  });

  it('空态：官方逐字类串 + 注入文案；此时不渲染滚动壳', () => {
    const { container } = render(
      <MentionSuggestionPanel items={[]} selectedIndex={0} onSelect={() => {}} onHover={() => {}} emptyLabel="无匹配结果" />,
    );
    const empty = container.querySelector('.px-1.py-3') as HTMLElement;
    expect(empty.className).toBe('px-1 py-3 text-[14px] text-[rgba(255,255,255,0.4)]');
    expect(empty.textContent).toBe('无匹配结果');
    /* 官方空态分支（`_ub_fmt.txt` 1735–1764）只渲染 `[qr, noResults]`，没有 `Am`。 */
    expect(container.querySelector('.overflow-y-auto')).toBeNull();
  });

  it('点击行触发 onSelect，悬停触发 onHover', () => {
    const onSelect = vi.fn();
    const onHover = vi.fn();
    render(
      <MentionSuggestionPanel items={items} selectedIndex={0} onSelect={onSelect} onHover={onHover} emptyLabel="无结果" />,
    );
    fireEvent.click(screen.getByText('角色参考图'));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
    fireEvent.mouseMove(screen.getByText('桥面全景'));
    expect(onHover).toHaveBeenCalledWith(1);
  });
});

describe('createMentionSuggestionRenderer（官方 B4 + tippy.js）', () => {
  const props = () => ({
    editor: { state: { doc: { textBetween: () => '@' } }, view: { dom: document.body }, chain: () => ({ focus: () => ({ deleteRange: () => ({ run: () => {} }) }) }) } as never,
    range: { from: 0, to: 1 },
    query: '',
    text: '@',
    items,
    command: vi.fn(),
    decorationNode: null,
    clientRect: () => ({ top: 100, left: 20, bottom: 120, right: 40, width: 20, height: 20 }),
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('onStart 用官方 tippy 挂载（`[data-tippy-root]` 里是 `[data-mention-panel]`），onExit 销毁', async () => {
    const controller = createMentionSuggestionRenderer({
      emptyLabel: '无结果',
      tippyOptions: { placement: 'top-start', offset: [0, 8] },
    })();
    controller.onStart(props() as never);
    /* 官方 `B4`：`tippy(appendTo, {content, showOnCreate:true, interactive:true, trigger:"manual",
       placement:"bottom-start", plugins:[pv], sticky:true, …tippyOptions})`。 */
    const tippyRoot = document.querySelector('[data-tippy-root]');
    expect(tippyRoot).not.toBeNull();
    await flushPopup();
    expect(document.querySelector('[data-tippy-root] [data-mention-panel]')).not.toBeNull();
    /* 官方 `plugins:[pv]`（tippy sticky 插件）+ `sticky:true`。 */
    const instance = (document.querySelector('[data-tippy-root]') as HTMLElement & { _tippy?: { props: { sticky: boolean; plugins: { name: string }[]; interactive: boolean; trigger: string } } })._tippy!;
    expect(instance.props.plugins.map((plugin) => plugin.name)).toContain('sticky');
    expect(instance.props.sticky).toBe(true);
    expect(instance.props.interactive).toBe(true);
    expect(instance.props.trigger).toBe('manual');
    /* `tippyOptions.placement = "top-start"` 覆盖默认 `bottom-start`。 */
    expect(document.querySelector('[data-tippy-root] .tippy-box')!.getAttribute('data-placement')).toBe('top-start');
    controller.onExit();
    expect(document.querySelector('[data-tippy-root]')).toBeNull();
  });

  it('ArrowDown/ArrowUp 改选中索引，Enter 走 handleSelect，Escape 走 close（删 `@query`）', async () => {
    const handleSelect = vi.fn();
    const controller = createMentionSuggestionRenderer({ emptyLabel: '无结果', handleSelect })();
    const run = vi.fn();
    const deleteRange = vi.fn(() => ({ run }));
    const p = {
      ...props(),
      range: { from: 0, to: 1 },
      editor: {
        state: { doc: { textBetween: () => '@' } },
        view: { dom: document.body },
        chain: () => ({ focus: () => ({ deleteRange }) }),
      } as never,
    };
    controller.onStart(p as never);
    await flushPopup();
    const panel = () => document.querySelector('[data-mention-panel]') as HTMLElement;

    const selectedRows = () => [...panel().querySelectorAll('[data-selectable-index]')].filter((row) => row.classList.contains('bg-white/10'));
    /* 官方 `onStart` 时 `selectedIndex = -1`（无选中），`onUpdate` 才归 0。 */
    expect(selectedRows()).toHaveLength(0);
    await act(async () => { controller.onKeyDown({ event: new KeyboardEvent('keydown', { key: 'ArrowDown' }) }); });
    expect(selectedRows()).toHaveLength(1);
    expect(selectedRows()[0].getAttribute('data-selectable-index')).toBe('0');
    await act(async () => { controller.onKeyDown({ event: new KeyboardEvent('keydown', { key: 'ArrowDown' }) }); });
    expect(selectedRows()[0].getAttribute('data-selectable-index')).toBe('1');
    await act(async () => { controller.onKeyDown({ event: new KeyboardEvent('keydown', { key: 'ArrowUp' }) }); });
    expect(selectedRows()[0].getAttribute('data-selectable-index')).toBe('0');

    controller.onKeyDown({ event: new KeyboardEvent('keydown', { key: 'Enter' }) });
    /* 官方 `O`：只调 `handleSelect(item, props)`，**不**回落 `command`。 */
    expect(handleSelect).toHaveBeenCalledWith(items[0], p);
    expect(p.command).not.toHaveBeenCalled();

    controller.onKeyDown({ event: new KeyboardEvent('keydown', { key: 'Escape' }) });
    /* 官方 `N`：`close()` 只删掉光标前的 `@query`；弹层真正的卸载由 `onExit` 负责。 */
    expect(deleteRange).toHaveBeenCalledWith({ from: 0, to: 1 });
    expect(run).toHaveBeenCalled();
    controller.onExit();
    expect(document.querySelector('[data-tippy-root]')).toBeNull();
  });

  it('空列表时弹层渲染官方空态（tippy 仍在）', async () => {
    const controller = createMentionSuggestionRenderer({ emptyLabel: '无匹配结果' })();
    const p = props();
    controller.onStart({ ...p, items: [] } as never);
    await flushPopup();
    const empty = document.querySelector('[data-mention-panel] .px-1.py-3') as HTMLElement;
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe('无匹配结果');
    controller.onExit();
  });

  it('`onUpdate` 把选中索引归 0 并刷新列表', async () => {
    const controller = createMentionSuggestionRenderer({ emptyLabel: '无结果' })();
    const p = props();
    controller.onStart(p as never);
    await flushPopup();
    await act(async () => { controller.onUpdate({ ...p, items: [items[1], items[0]] } as never); });
    const rows = document.querySelectorAll('[data-mention-panel] [data-selectable-index]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('桥面全景');
    expect(rows[0].classList.contains('bg-white/10')).toBe(true);
    controller.onExit();
  });

  it('官方默认 `handleSelect`（`kP` 的 `m`）：插入提及节点 + 一个空格，并把选区塌到末尾', async () => {
    const extension = createMentionExtension({ emptyLabel: '无结果' });
    const suggestion = (extension.options as { suggestion: { render: () => { onStart: (value: unknown) => void } } }).suggestion;
    const renderer = suggestion.render();
    const insertContentAt = vi.fn(() => ({ run: () => {} }));
    const editor = {
      view: { dom: document.body },
      chain: () => ({ focus: () => ({ insertContentAt }) }),
    };
    /* jsdom 的 `Selection` 没有 range 时 `collapseToEnd()` 会抛 `InvalidStateError`，这里替身掉。 */
    const originalGetSelection = window.getSelection;
    const collapseToEnd = vi.fn();
    window.getSelection = () => ({ collapseToEnd }) as unknown as Selection;
    const p = { ...props(), editor: editor as never, range: { from: 3, to: 5 }, command: vi.fn() };
    renderer.onStart(p as never);
    await flushPopup();
    await act(async () => {
      fireEvent.click(document.querySelector('[data-mention-panel] [data-selectable-index="1"]') as HTMLElement);
    });
    expect(insertContentAt).toHaveBeenCalledWith({ from: 3, to: 5 }, [
      {
        type: 'mention',
        attrs: {
          id: '222', label: '桥面全景', type: undefined, renderText: undefined,
          thumbnail: undefined, videoSrc: undefined, mediaType: undefined, textContent: undefined,
        },
      },
      { type: 'text', text: ' ' },
    ]);
    expect(p.command).not.toHaveBeenCalled();
    /* 官方 `m` 末尾：`getSelection()?.collapseToEnd()`。 */
    expect(collapseToEnd).toHaveBeenCalled();
    window.getSelection = originalGetSelection;
  });

  it('官方 `matchEditorWidth` 三件套：弹层宽度对齐 `[data-mention-popover-width-source]` 并被 `matchEditorMaxWidth` 夹住', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-mention-popover-width-source', 'true');
    anchor.getBoundingClientRect = () => ({ width: 464, top: 0, left: 0, bottom: 0, right: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const editorDom = document.createElement('div');
    anchor.appendChild(editorDom);
    document.body.appendChild(anchor);

    const controller = createMentionSuggestionRenderer({
      emptyLabel: '无结果',
      matchEditorWidth: true,
      matchEditorWidthSelector: "[data-mention-popover-width-source='true']",
      matchEditorMaxWidth: 320,
    })();
    controller.onStart({
      ...props(),
      editor: { state: { doc: { textBetween: () => '@' } }, view: { dom: editorDom }, chain: () => ({ focus: () => ({ deleteRange: () => ({ run: () => {} }) }) }) } as never,
    } as never);
    /* 官方 `_`：`min(编辑器容器宽, matchEditorMaxWidth)` 取整 + `maxWidth: calc(100vw - 24px)`。 */
    const container = document.querySelector('.tippy-content > div') as HTMLElement;
    expect(container.style.width).toBe('320px');
    expect(container.style.maxWidth).toBe('calc(100vw - 24px)');
    await flushPopup();
    /* 官方 `matchEditorWidth` 为真时 tippy 侧传 `maxWidth: "none"`。 */
    const instance = (document.querySelector('[data-tippy-root]') as HTMLElement & { _tippy?: { props: { maxWidth: unknown } } })._tippy!;
    expect(instance.props.maxWidth).toBe('none');
    controller.onExit();
  });
});
