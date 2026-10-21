/**
 * 联网搜索来源（官方 `TF`）与任务历史卡（官方 `iae`）的 **DOM 结构**回归。
 *
 * 官方 `Qtt`（偏移 2367472）：带图来源 < `Xtt(3)` ⇒ 全部 pill，否则全部卡片，**互斥**。
 * `+N` 按钮文案走 `chatAdapter.agentEvent.webSearch.more`（zh `+{{count}} 个`）。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AgentTaskHistoryCard from '../../src/components/chat/AgentTaskHistoryCard';
import OfficialScrollArea from '../../src/components/chat/OfficialScrollArea';
import WebSearchSourceDisplay from '../../src/components/chat/WebSearchSourceDisplay';
import type { WebSource } from '../../src/types/chat';
import type { TodoItem } from '../../src/services/chat/todoTasks';

const source = (n: number, image?: string): WebSource => ({
  url: `https://example.com/${n}`,
  title: `站点 ${n}`,
  image,
});

describe('WebSearchSourceDisplay（官方 TF + Qtt 分流）', () => {
  it('无来源 ⇒ 不渲染', () => {
    expect(renderToStaticMarkup(<WebSearchSourceDisplay sources={[]} />)).toBe('');
  });

  it('带图来源 < 3 ⇒ 只渲染 pill 列表，不渲染卡片横滑行', () => {
    const html = renderToStaticMarkup(<WebSearchSourceDisplay sources={[source(1, 'a.png'), source(2)]} />);
    expect(html).toContain('mt-1 mb-1 flex min-w-0 flex-wrap items-center gap-1.5');
    /* 卡片横滑行的 class 不应出现。 */
    expect(html).not.toContain('cursor-grab');
  });

  it('带图来源 ≥ 3 ⇒ 只渲染卡片横滑行，不渲染 pill 列表', () => {
    const html = renderToStaticMarkup(
      <WebSearchSourceDisplay sources={[source(1, 'a.png'), source(2, 'b.png'), source(3, 'c.png')]} />,
    );
    expect(html).toContain('cursor-grab');
    expect(html).toContain('w-[clamp(140px,42%,172px)]');
    expect(html).not.toContain('mt-1 mb-1 flex min-w-0 flex-wrap items-center gap-1.5');
  });

  it('pill 超过 4 个 ⇒ `+N` 按钮文案取官方键（zh `+N 个`）', () => {
    const sources = [1, 2, 3, 4, 5, 6].map((n) => source(n));
    const html = renderToStaticMarkup(<WebSearchSourceDisplay sources={sources} />);
    expect(html).toContain('+2 个');
    expect(html).toContain('h-5 rounded-[4px] bg-[#282828] px-1.5 text-[11px] leading-none');
  });
});

describe('OfficialScrollArea（官方 Ni 的 Radix 组合）', () => {
  it('viewport 与根 class 逐字；ScrollBar/Thumb 由 Radix 在客户端挂载（SSR 不渲染）', () => {
    const html = renderToStaticMarkup(
      <OfficialScrollArea className="border-t border-border/40 [&>[data-radix-scroll-area-viewport]]:max-h-80">
        <div>inner</div>
      </OfficialScrollArea>,
    );
    expect(html).toContain('data-radix-scroll-area-viewport');
    expect(html).toContain('h-full w-full rounded-[inherit]');
    /* Corner 与 ScrollBar 一样是 Radix 的客户端条件渲染；SSR 里只能看到它写入的 CSS 变量。 */
    expect(html).toContain('--radix-scroll-area-corner-width');
    /* `>` 会被 React 转义成 `&gt;`。 */
    expect(html).toContain('&gt;[data-radix-scroll-area-viewport]]:max-h-80');
  });
});

describe('AgentTaskHistoryCard（官方 iae / TaskHistoryCard）', () => {
  const items: TodoItem[] = [
    { taskId: 't1', content: '第一步', status: 'completed' },
    { taskId: 't2', content: '第二步', status: 'in_progress' },
  ];

  it('根 class + data-testid 逐字，且**没有**官方不存在的 data-todo-signature', () => {
    const html = renderToStaticMarkup(<AgentTaskHistoryCard items={items} />);
    expect(html).toContain('class="my-1.5 overflow-hidden rounded-lg border border-border/50 bg-chat-bubble-surface"');
    expect(html).toContain('data-testid="task-history-card"');
    expect(html).not.toContain('data-todo-signature');
  });

  it('摘要用官方 allCompleted/summary 文案（复数已按 total 处理）', () => {
    const html = renderToStaticMarkup(<AgentTaskHistoryCard items={items} />);
    expect(html).toContain('共 2 个任务，已完成 1 个');
  });

  it('全完成 ⇒ `已完成全部 N 个任务`', () => {
    const done: TodoItem[] = items.map((item) => ({ ...item, status: 'completed' as const }));
    const html = renderToStaticMarkup(<AgentTaskHistoryCard items={done} />);
    expect(html).toContain('已完成全部 2 个任务');
  });

  it('Trigger 的完整 class 串逐字；初始展开态（未全完成）带 rotate-180，全完成态收起不带', () => {
    const html = renderToStaticMarkup(<AgentTaskHistoryCard items={items} />);
    expect(html).toContain('flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] leading-5 font-medium text-chat-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset');
    expect(html).toContain('shrink-0 text-chat-foreground/70 transition-transform rotate-180');

    const done: TodoItem[] = items.map((item) => ({ ...item, status: 'completed' as const }));
    expect(renderToStaticMarkup(<AgentTaskHistoryCard items={done} />)).not.toContain('rotate-180');
  });

  it('≤8 条走普通 div；>8 条走 Radix ScrollArea', () => {
    const few = renderToStaticMarkup(<AgentTaskHistoryCard items={items} />);
    expect(few).toContain('<div class="border-t border-border/40">');

    const many: TodoItem[] = Array.from({ length: 9 }, (_, index) => ({
      taskId: `t${index}`, content: `第 ${index + 1} 步`, status: 'pending' as const,
    }));
    const lots = renderToStaticMarkup(<AgentTaskHistoryCard items={many} />);
    expect(lots).toContain('data-radix-scroll-area-viewport');
    expect(lots).toContain('&gt;[data-radix-scroll-area-viewport]]:!h-auto');
  });
});
