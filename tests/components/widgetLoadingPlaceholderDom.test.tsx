// @vitest-environment jsdom
/**
 * `WidgetLoadingPlaceholder` 的**真实 DOM** 回归（jsdom + @testing-library/react）—— 验证分级 (b)。
 *
 * 覆盖官方 @2360571 的**状态机**部分（类串/内联 CSS 另见 `widgetFamilySsr.test.tsx`）：
 *   · `setInterval(..., 2500)` 文案轮播，**仅当 `messages.length > 1`**
 *   · `(index + 1) % messages.length` 的取模回环
 *   · `title` 优先级最高（此时轮播仍在跑，但文案不变）
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WidgetLoadingPlaceholder, {
  WIDGET_LOADING_MESSAGE_INTERVAL,
} from '../../src/components/chat/WidgetLoadingPlaceholder';

afterEach(cleanup);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const label = (container: HTMLElement) =>
  container.querySelector('span.text-\\[10px\\]')?.textContent;

describe('WidgetLoadingPlaceholder —— 2500ms 文案轮播（官方 `setInterval(...,2500)`）', () => {
  it('周期常量 = 2500', () => {
    expect(WIDGET_LOADING_MESSAGE_INTERVAL).toBe(2500);
  });

  it('多条 messages：每 2500ms 换一条，并在末尾取模回环', () => {
    const { container } = render(
      <WidgetLoadingPlaceholder messages={['第一条', '第二条', '第三条']} />,
    );
    expect(label(container)).toBe('第一条');

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(label(container)).toBe('第二条');

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(label(container)).toBe('第三条');

    /* (2 + 1) % 3 === 0 ⇒ 回到第一条 */
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(label(container)).toBe('第一条');

    /* 2499ms 不足以推进 */
    act(() => {
      vi.advanceTimersByTime(2499);
    });
    expect(label(container)).toBe('第一条');
  });

  it('messages.length <= 1 时**不起** interval（官方 `if(!t||t.length<=1)return;`）', () => {
    const single = render(<WidgetLoadingPlaceholder messages={['唯一一条']} />);
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(label(single.container)).toBe('唯一一条');

    const empty = render(<WidgetLoadingPlaceholder messages={[]} />);
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(label(empty.container)).toBe('正在生成...');
  });

  it('完全没有 messages 时不起 interval，文案回落 `chatAdapter.widget.generating`', () => {
    const { container } = render(<WidgetLoadingPlaceholder />);
    expect(vi.getTimerCount()).toBe(0);
    expect(label(container)).toBe('正在生成...');
  });

  it('title 优先于 messages（轮播照跑，但文案始终是 title）', () => {
    const { container } = render(
      <WidgetLoadingPlaceholder title="正在准备画布" messages={['第一条', '第二条']} />,
    );
    expect(label(container)).toBe('正在准备画布');
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(label(container)).toBe('正在准备画布');
  });

  it('卸载时 `clearInterval`（官方 useEffect 的返回清理）', () => {
    const { unmount } = render(<WidgetLoadingPlaceholder messages={['a', 'b']} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('默认高度 220px 体现在 inline style（DOM 层复核）', () => {
    const { container } = render(<WidgetLoadingPlaceholder />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.height).toBe('220px');
    expect(root.className).toBe(
      'my-2 overflow-hidden rounded-xl border border-white/10 bg-[#1F1F1F] relative',
    );
  });
});
