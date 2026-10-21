// @vitest-environment jsdom
/**
 * 会话侧栏 4 缺口落地守卫（官方契约 `live-侧栏-动作条-面板-输入区.md` §2 A)）：
 *   ① legacy 分组（`legacySectionTitle` @2483862 / `loading` @2484146 / `loadMoreLegacy` @2485660）
 *   ② 只读徽标（`readOnlyLabel` @2484927，纯文本 span + 行尾 Tabler `eye`）
 *   ③ 分页（哨兵 `<div class="h-px w-full"/>` + `threshold:.1` @2478431；`pageSize = Yx = 20` @457058）
 *   ④ banner（`legacyReadOnlyBanner` @2778057 / `starterReplayViewOnlyBanner` @2778235）
 *
 * 为什么必须 jsdom：`ConversationMenu` 在 `typeof document === 'undefined'` 时 `return null`，
 * 且内容走 `createPortal`（挂在 `document.body`，不在 RTL container 里）。
 *
 * 验证分级：(b) jsdom —— live 画布此刻 DOM 里没有这些侧栏元素，且不允许点用户 live 画布 ⇒ 做不到 (a)。
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import ConversationMenu from '../../src/components/chat/ConversationMenu';
import ConversationViewOnlyBanner from '../../src/components/chat/ConversationViewOnlyBanner';
import {
  CONVERSATION_PAGE_SIZE,
  CONVERSATION_SCROLL_THRESHOLD,
  CONVERSATION_SENTINEL_CLASS,
  isLegacyConversation,
  isStarterReplayConversation,
  paginateConversations,
  partitionConversations,
} from '../../src/components/chat/conversationMenuSpec';
import type { ChatConversation } from '../../src/types/chat';

afterEach(cleanup);

const noop = () => {};

const conversation = (id: string, title: string, archived = false): ChatConversation => ({
  id,
  title,
  archived,
  createdAt: Date.now(),
  updatedAt: Date.now(),
} as ChatConversation);

/* ── 官方 IntersectionObserver 的测试替身（jsdom 没有该 API）──
   官方代码不做存在性判断，MTV 加了守卫；这里装一个替身，手动触发回调来验证阈值条件。 */
type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>, observer: unknown) => void;
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  static options: Array<Record<string, unknown> | undefined> = [];
  callback: ObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(callback: ObserverCallback, options?: Record<string, unknown>) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
    FakeIntersectionObserver.options.push(options);
  }
  static reset() {
    FakeIntersectionObserver.instances = [];
    FakeIntersectionObserver.options = [];
  }
  static latest(): FakeIntersectionObserver {
    return FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];
  }
}

beforeEach(() => {
  FakeIntersectionObserver.reset();
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Harness(props: Partial<React.ComponentProps<typeof ConversationMenu>>) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  return (
    <>
      <div ref={anchorRef} data-testid="anchor" />
      <ConversationMenu
        anchorRef={anchorRef}
        conversations={[]}
        activeConversationId={null}
        onSelect={noop}
        onNew={noop}
        onRename={noop}
        onDelete={noop}
        onClose={noop}
        {...props}
      />
    </>
  );
}

/* ══════════════ 纯逻辑（分页 / 分组的边界） ══════════════ */

describe('conversationMenuSpec · 官方分页与分桶', () => {
  it('pageSize 是官方 `Yx = 20`，哨兵阈值是官方 `.1`', () => {
    expect(CONVERSATION_PAGE_SIZE).toBe(20);
    expect(CONVERSATION_SCROLL_THRESHOLD).toBe(0.1);
    expect(CONVERSATION_SENTINEL_CLASS).toBe('h-px w-full');
  });

  it('分页边界：0 / 20 / 21 条', () => {
    const make = (count: number) => Array.from({ length: count }, (_, index) => `c${index + 1}`);
    expect(paginateConversations(make(0), 1)).toEqual({ items: [], hasNextPage: false });
    /* 正好一页 ⇒ 不再给「空下一页」 */
    expect(paginateConversations(make(20), 1)).toEqual({ items: make(20), hasNextPage: false });
    /* 21 条 ⇒ 第一页 20 条 + hasNextPage */
    const page1 = paginateConversations(make(21), 1);
    expect(page1.items).toHaveLength(20);
    expect(page1.hasNextPage).toBe(true);
    /* 第二页全量、不再有下一页 */
    const page2 = paginateConversations(make(21), 2);
    expect(page2.items).toHaveLength(21);
    expect(page2.hasNextPage).toBe(false);
  });

  it('分页：非法 page（0 / NaN）按第 1 页处理', () => {
    const list = Array.from({ length: 25 }, (_, index) => `c${index + 1}`);
    expect(paginateConversations(list, 0).items).toHaveLength(20);
    expect(paginateConversations(list, Number.NaN).items).toHaveLength(20);
  });

  it('分桶：只有 `archived === true` 才进 legacy（官方 `g`）', () => {
    expect(isLegacyConversation({ archived: true })).toBe(true);
    expect(isLegacyConversation({ archived: false })).toBe(false);
    expect(isLegacyConversation({})).toBe(false);
    const { active, legacy } = partitionConversations([
      conversation('a', 'A'),
      conversation('b', 'B', true),
      conversation('c', 'C'),
    ]);
    expect(active.map((item) => item.id)).toEqual(['a', 'c']);
    expect(legacy.map((item) => item.id)).toEqual(['b']);
  });

  it('starter-replay 前缀常量是官方 `NY = "starter-replay-"`', () => {
    expect(isStarterReplayConversation('starter-replay-tutorial-1')).toBe(true);
    expect(isStarterReplayConversation('starter-replay')).toBe(false);
    expect(isStarterReplayConversation(null)).toBe(false);
  });
});

/* ══════════════ ① legacy 分组 + ② 只读徽标 ══════════════ */

describe('ConversationMenu · legacy 分组与只读徽标', () => {
  it('legacy 默认收起：只有折叠头，行不渲染', () => {
    render(<Harness conversations={[conversation('n1', '普通会话'), conversation('l1', '旧版会话', true)]} />);
    const header = screen.getByText('历史对话（仅可查看）');
    expect(header).not.toBeNull();
    expect(header.closest('button')!.className).toBe(
      'flex w-full items-center gap-1.5 px-2.5 py-2 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider hover:text-muted-foreground/80 cursor-pointer rounded-md hover:bg-white/[0.04]',
    );
    /* 收起态显示 chevron-right（官方 `Yl`：`M9 6l6 6l-6 6`） */
    expect(header.closest('button')!.querySelector('path')!.getAttribute('d')).toBe('M9 6l6 6l-6 6');
    expect(screen.queryByText('旧版会话')).toBeNull();
    /* 普通会话不受影响 */
    expect(screen.getByText('普通会话')).not.toBeNull();
  });

  it('展开后：legacy 行标题 + 只读徽标（纯文本 span）+ 行尾 Tabler eye', () => {
    render(<Harness conversations={[conversation('l1', '旧版会话', true)]} />);
    const headerButton = screen.getByText('历史对话（仅可查看）').closest('button')!;
    act(() => { headerButton.click(); });

    /* 展开态换成 chevron-down（官方 `Hl`：`M6 9l6 6l6 -6`） */
    expect(headerButton.querySelector('path')!.getAttribute('d')).toBe('M6 9l6 6l6 -6');
    const title = screen.getByText('旧版会话');
    expect(title.className).toBe(
      'text-[13px] font-normal truncate text-foreground/80 group-hover/item:text-foreground/95',
    );

    /* 只读徽标 = 纯文本 span：`shrink-0 text-[10px] text-muted-foreground/50`，没有 pill / 背景 / 边框 */
    const badge = screen.getByText('仅可查看');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toBe('shrink-0 text-[10px] text-muted-foreground/50');

    /* 行尾 Tabler `eye`（官方 `yO` = `ejt=p("outline","eye",…)`，两条 path）
       ⚠️ 官方图标工厂 `p(prefix,name,…)` 恒把类名拼成
       `['tabler-icon','tabler-icon-'+name, className].join(' ')`
       ⇒ `tabler-icon tabler-icon-eye` **必须**在自定义类之前（本断言原先漏了这两个类，
          与它自己上面那句注释矛盾；经 vendor-libs 的 `p("outline","eye",…)` 核实后补上）。 */
    const row = title.closest('div.group\\/item')!;
    const eye = row.lastElementChild!;
    expect(eye.tagName).toBe('svg');
    expect(eye.getAttribute('class')).toBe('tabler-icon tabler-icon-eye w-3.5 h-3.5 shrink-0 text-muted-foreground/40');
    expect(Array.from(eye.querySelectorAll('path')).map((path) => path.getAttribute('d'))).toEqual([
      'M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0',
      'M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6',
    ]);
  });

  it('边界：没有 legacy 会话时整块（含折叠头）不渲染', () => {
    render(<Harness conversations={[conversation('n1', '普通会话')]} />);
    expect(screen.queryByText('历史对话（仅可查看）')).toBeNull();
    expect(screen.queryByText('仅可查看')).toBeNull();
  });

  it('legacy 行没有重命名 / 删除操作区（官方 legacy 行只有标题 + 徽标 + 时间 + eye）', () => {
    render(<Harness conversations={[conversation('l1', '旧版会话', true)]} />);
    act(() => { screen.getByText('历史对话（仅可查看）').closest('button')!.click(); });
    const row = screen.getByText('旧版会话').closest('div.group\\/item')!;
    expect(row.querySelectorAll('button')).toHaveLength(0);
  });

  it('点 legacy 行走 `onSelectLegacy`（官方 `e(ve.id,{isLegacy:!0})`），缺省回落 `onSelect`', () => {
    const onSelect = vi.fn();
    const onSelectLegacy = vi.fn();
    render(
      <Harness
        conversations={[conversation('l1', '旧版会话', true)]}
        onSelect={onSelect}
        onSelectLegacy={onSelectLegacy}
      />,
    );
    act(() => { screen.getByText('历史对话（仅可查看）').closest('button')!.click(); });
    act(() => { screen.getByText('旧版会话').closest('div.group\\/item')!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onSelectLegacy).toHaveBeenCalledWith('l1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('`isLegacyLoading` 为真 ⇒ 官方加载行（`px-2.5 py-2 flex items-center gap-2 text-muted-foreground/50` + Tabler loader-2 + 加载对话中...）', () => {
    render(<Harness conversations={[]} isLegacyLoading />);
    /* legacy 区块因为有 loading 也要出现（官方条件 `g.length>0 || y`） */
    act(() => { screen.getByText('历史对话（仅可查看）').closest('button')!.click(); });
    const loadingText = screen.getByText('加载对话中...');
    const row = loadingText.parentElement!;
    expect(row.className).toBe('px-2.5 py-2 flex items-center gap-2 text-muted-foreground/50');
    expect(loadingText.className).toBe('text-xs');
    const spinner = row.firstElementChild!;
    expect(spinner.getAttribute('class')).toBe('w-3.5 h-3.5 animate-spin shrink-0');
    expect(spinner.querySelector('path')!.getAttribute('d')).toBe('M12 3a9 9 0 1 0 9 9');
  });
});

/* ══════════════ ③ 分页 ══════════════ */

describe('ConversationMenu · 分页', () => {
  const many = (count: number, archived = false) =>
    Array.from({ length: count }, (_, index) => conversation(`c${index + 1}`, `会话${index + 1}`, archived));

  it('21 条 ⇒ 首屏只渲染 20 条，且哨兵 `h-px w-full` 存在、observer 阈值 `.1`', () => {
    render(<Harness conversations={many(21)} />);
    expect(screen.queryByText('会话20')).not.toBeNull();
    expect(screen.queryByText('会话21')).toBeNull();
    const sentinel = screen.getByText('会话20').closest('div.space-y-1')!.querySelector('div.h-px');
    expect(sentinel!.className).toBe('h-px w-full');
    expect(FakeIntersectionObserver.options[0]).toEqual({ threshold: 0.1 });
  });

  it('哨兵可见 ⇒ 取下一页（官方 `me[0].isIntersecting&&H&&!oe&&!V&&$()`）', () => {
    render(<Harness conversations={many(21)} />);
    const observer = FakeIntersectionObserver.latest();
    expect(observer.observe).toHaveBeenCalledTimes(1);
    act(() => { observer.callback([{ isIntersecting: true }], observer); });
    expect(screen.queryByText('会话21')).not.toBeNull();
  });

  it('边界：正好 20 条 ⇒ 哨兵在，但触发不可见也不会多拉（hasNextPage=false）', () => {
    render(<Harness conversations={many(20)} />);
    const observer = FakeIntersectionObserver.latest();
    act(() => { observer.callback([{ isIntersecting: true }], observer); });
    expect(screen.queryByText('会话21')).toBeNull();
    expect(document.body.querySelectorAll('div.group\\/item')).toHaveLength(20);
  });

  it('`isFetchingNextPage` 为真 ⇒ 哨兵下方官方转圈（`flex items-center justify-center py-2`）', () => {
    render(<Harness conversations={many(21)} isFetchingNextPage />);
    const spinner = document.body.querySelector('div.flex.items-center.justify-center.py-2');
    expect(spinner).not.toBeNull();
    const icon = spinner!.querySelector('svg')!;
    expect(icon.getAttribute('class')).toBe('w-3.5 h-3.5 animate-spin text-muted-foreground/50');
    /* 取下一页中 ⇒ 官方回调里的 `!V` 不成立 ⇒ 即便哨兵可见也不重复拉页 */
    const observer = FakeIntersectionObserver.latest();
    act(() => { observer.callback([{ isIntersecting: true }], observer); });
    expect(screen.queryByText('会话21')).toBeNull();
  });

  it('legacy 分页：21 条 legacy ⇒ 展开后 20 行 + 官方「加载更多」按钮；点击后 21 行、按钮消失', () => {
    render(<Harness conversations={many(21, true)} />);
    act(() => { screen.getByText('历史对话（仅可查看）').closest('button')!.click(); });
    expect(screen.queryByText('会话20')).not.toBeNull();
    expect(screen.queryByText('会话21')).toBeNull();
    const more = screen.getByText('加载更多').closest('button')!;
    expect(more.className).toBe(
      'w-full py-2 text-xs text-muted-foreground hover:text-foreground/80 rounded-lg border border-border/50 hover:bg-white/[0.04] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50',
    );
    act(() => { more.click(); });
    expect(screen.queryByText('会话21')).not.toBeNull();
    expect(screen.queryByText('加载更多')).toBeNull();
  });

  it('legacy 分页边界：正好 20 条 legacy ⇒ 没有「加载更多」按钮', () => {
    render(<Harness conversations={many(20, true)} />);
    act(() => { screen.getByText('历史对话（仅可查看）').closest('button')!.click(); });
    expect(screen.queryByText('加载更多')).toBeNull();
  });

  it('`isLoadingMoreLegacy` ⇒ 「加载更多」禁用 + 内联 Tabler loader-2（官方 `T?eo:null`）', () => {
    render(<Harness conversations={many(21, true)} isLoadingMoreLegacy />);
    act(() => { screen.getByText('历史对话（仅可查看）').closest('button')!.click(); });
    const more = screen.getByText('加载更多').closest('button')!;
    expect(more.hasAttribute('disabled')).toBe(true);
    const icon = more.querySelector('svg')!;
    expect(icon.getAttribute('class')).toBe('w-3.5 h-3.5 animate-spin');
    expect(icon.querySelector('path')!.getAttribute('d')).toBe('M12 3a9 9 0 1 0 9 9');
  });
});

/* ══════════════ ④ banner ══════════════ */

describe('ConversationViewOnlyBanner · 官方两条只读 banner', () => {
  const BANNER_CLASS = 'shrink-0 px-3 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border/50';

  it('两个条件都假 ⇒ 不渲染任何节点', () => {
    const { container } = render(<ConversationViewOnlyBanner isLegacyReadOnly={false} isStarterReplay={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('legacy 只读 ⇒ 官方 `conversation.legacyReadOnlyBanner` 文案与类串', () => {
    const { container } = render(<ConversationViewOnlyBanner isLegacyReadOnly isStarterReplay={false} />);
    const banners = container.querySelectorAll('div');
    expect(banners).toHaveLength(1);
    expect(banners[0].className).toBe(BANNER_CLASS);
    expect(banners[0].textContent).toBe('旧版聊天记录已归档。请复制内容至新版 Agent 窗口继续对话。');
  });

  it('starter-replay ⇒ 官方 `conversation.starterReplayViewOnlyBanner` 文案', () => {
    const { container } = render(<ConversationViewOnlyBanner isLegacyReadOnly={false} isStarterReplay />);
    const banners = container.querySelectorAll('div');
    expect(banners).toHaveLength(1);
    expect(banners[0].className).toBe(BANNER_CLASS);
    expect(banners[0].textContent).toBe('新手教程演示记录，仅供回看。');
  });

  it('同时命中 ⇒ 两条 banner 按官方顺序上下排列', () => {
    const { container } = render(<ConversationViewOnlyBanner isLegacyReadOnly isStarterReplay />);
    const texts = Array.from(container.querySelectorAll('div')).map((node) => node.textContent);
    expect(texts).toEqual([
      '旧版聊天记录已归档。请复制内容至新版 Agent 窗口继续对话。',
      '新手教程演示记录，仅供回看。',
    ]);
  });
});

/* ══════════════ 宿主接线（源码级） ══════════════ */

describe('ChatPanel · 只读 banner 宿主', () => {
  it('banner 挂在 ChatHeader 之后、消息区之前，条件取官方 `tt` / `je`', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const panel = readFileSync(resolve(process.cwd(), 'src/components/chat/ChatPanel.tsx'), 'utf8');
    expect(panel).toContain('<ConversationViewOnlyBanner');
    expect(panel).toContain('isLegacyConversation(effectiveActiveConversation)');
    expect(panel).toContain('isStarterReplayConversation(effectiveActiveConversationId)');
    expect(panel.indexOf('<ConversationViewOnlyBanner')).toBeGreaterThan(panel.indexOf('<ChatHeader'));
    expect(panel.indexOf('<ConversationViewOnlyBanner')).toBeLessThan(panel.indexOf('chat-panel-body'));
  });
});
