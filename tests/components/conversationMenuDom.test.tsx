// @vitest-environment jsdom
/**
 * `ConversationMenu` 的**真实 DOM** 回归（jsdom + @testing-library/react）。
 *
 * 为什么必须 jsdom：该组件在 `typeof document === 'undefined'` 时 `return null`，且内容走 `createPortal`
 * ⇒ `renderToStaticMarkup` 什么都拿不到；且 port 内容在 `document.body` 而不是 RTL 的 container 里。
 * 另外它用 `position` 控制 `visibility`，所以必须给一个真实 anchor（否则 role 查询会被判为不可访问）。
 *
 * 官方事实（`live-侧栏-动作条-面板-输入区.md` §A.5 / §A.6）：
 *  · 加载态（`oe`）：`p-2 space-y-1.5` + 4 行 `flex items-center justify-between rounded-lg px-3 py-2.5`，
 *    每行两条 `animate-pulse` 灰条（`h-3.5 w-[60%] bg-foreground/15` / `h-3 w-12 bg-foreground/10`）。
 *  · 空态：`flex flex-col items-center justify-center py-10` + Tabler `history`（`w-5 h-5
 *    text-muted-foreground/40 mb-2`）+ `p.text-xs text-muted-foreground/50` 文案 `conversation.noHistory`。
 *  · 重命名输入 `maxLength = v4 = 100`。
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import ConversationMenu from '../../src/components/chat/ConversationMenu';
import type { ChatConversation } from '../../src/types/chat';

afterEach(cleanup);

const noop = () => {};

const conversation = (id: string, title: string): ChatConversation => ({
  id,
  title,
  createdAt: Date.now(),
  updatedAt: Date.now(),
} as ChatConversation);

/** 给组件一个真实 anchor，使 `position` 被算出（否则根节点 `visibility: hidden`，role 查询会失败）。 */
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

describe('ConversationMenu —— 真实 DOM（jsdom）', () => {
  it('空且非加载 ⇒ 官方**空态**（图标 + 文案），不是骨架', () => {
    render(<Harness conversations={[]} isLoading={false} />);
    const empty = document.body.querySelector('.flex.flex-col.items-center.justify-center.py-10');
    expect(empty).not.toBeNull();
    expect(empty!.querySelector('svg')).not.toBeNull();
    const text = empty!.querySelector('p');
    expect(text!.className).toBe('text-xs text-muted-foreground/50');
    expect(text!.textContent).toBe('暂无历史记录');
    expect(document.body.querySelector('.animate-pulse')).toBeNull();
  });

  it('加载中 ⇒ 官方 4 行骨架（每行两条 animate-pulse）', () => {
    render(<Harness conversations={[]} isLoading />);
    const rows = document.body.querySelectorAll('.p-2.space-y-1\\.5 > div');
    expect(rows).toHaveLength(4);
    for (const row of Array.from(rows)) {
      expect(row.className).toBe('flex items-center justify-between rounded-lg px-3 py-2.5');
      const bars = row.querySelectorAll('.animate-pulse');
      expect(bars).toHaveLength(2);
      expect(bars[0].className).toBe('h-3.5 w-[60%] rounded bg-foreground/15 animate-pulse');
      expect(bars[1].className).toBe('h-3 w-12 rounded bg-foreground/10 animate-pulse');
    }
    expect(document.body.querySelector('.py-10')).toBeNull();
  });

  it('有会话 ⇒ 渲染行；点「重命名」进入输入框且 `maxLength = 100`（官方 v4）', async () => {
    const onRename = vi.fn();
    render(<Harness conversations={[conversation('c1', '会话一')]} activeConversationId="c1" onRename={onRename} />);
    screen.getByLabelText('重命名').click();
    const input = await screen.findByDisplayValue('会话一');
    expect(input.getAttribute('maxlength')).toBe('100');
    expect(document.body.querySelector('.animate-pulse')).toBeNull();
  });

  it('菜单根是 portal 出来的 `role="menu"`，`aria-label` 用官方 `tooltips.history`（聊天记录）', () => {
    render(<Harness conversations={[]} />);
    expect(screen.getByRole('menu').getAttribute('aria-label')).toBe('聊天记录');
  });

  it('「新建对话」行在列表之前常驻', () => {
    render(<Harness conversations={[conversation('c1', '会话一')]} />);
    const items = screen.getAllByRole('menuitem');
    expect(items[0].textContent).toContain('新建对话');
  });
});
