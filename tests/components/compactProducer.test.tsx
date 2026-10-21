// @vitest-environment jsdom
/**
 * 官方 `compact` item 的**生产者**回归（覆盖表 §6 #14 的后半）。
 *
 * 官方 `$M`（`vendor-pkg-canvas-ChpWx5JY.js` **@2426911** 逐字）：
 * ```js
 * if(e.type==="compact"){ const C = e.content?.phase ?? "started"; return s.jsx(Tie,{phase:C,isStreaming:t}) }
 * ```
 * `Tie` = `CompactLifecycleLine`（MTV 早已就位，但**全仓 0 渲染点**）。
 * 官方把 `{type:"compact",content:{phase}}` 追加进消息 `contents`；MTV 没有消息级 contents
 * ⇒ 生产者改为：压缩成功后给「被折进摘要的最后一条消息」打 `ChatMessage.compactedAt`
 * （见 `contextCompressionService.compressConversationContext` 末尾）。
 *
 * 验证分级 = **(b) jsdom 真 DOM**（未做 live CDP）。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import type { ChatMessage } from '../../src/types/chat';

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '回答', timestamp: 1_000, status: 'done', ...over };
}

beforeEach(() => {
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
});

describe('MessageBubble —— 官方 `compact`（`Tie`）的生产者', () => {
  it('`compactedAt` 已设置 ⇒ 渲染官方 `Tie` 的 finished 态（`上下文已自动压缩`）', () => {
    const { container } = render(<MessageBubble message={message({ compactedAt: 2_000 })} />);
    expect(container.textContent).toContain('上下文已自动压缩');
  });

  it('未设置 ⇒ **不**渲染（官方没有 `compact` item 时也不渲染）', () => {
    const { container } = render(<MessageBubble message={message()} />);
    expect(container.textContent).not.toContain('上下文已自动压缩');
    expect(container.textContent).not.toContain('正在自动压缩上下文');
  });

  it('用户消息即使有 `compactedAt` 也不渲染（官方 `compact` 只出现在 assistant 的 contents 里）', () => {
    const { container } = render(<MessageBubble message={message({ role: 'user', content: '提问', compactedAt: 2_000 })} />);
    expect(container.textContent).not.toContain('上下文已自动压缩');
  });

  it('分割线结构 = 官方 `Tie` 的 `<output>` + 左右渐隐线（逐字类串）', () => {
    const { container } = render(<MessageBubble message={message({ compactedAt: 2_000 })} />);
    const out = container.querySelector('output');
    expect(out).not.toBeNull();
    expect(out?.getAttribute('aria-live')).toBe('polite');
    expect(out?.className).toBe('flex w-full min-w-[280px] items-center gap-3 py-1.5 text-xs leading-4 text-foreground/70');
    const lines = out?.querySelectorAll('span[aria-hidden="true"]') ?? [];
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]?.className).toBe('h-px min-w-6 flex-1 bg-gradient-to-r from-transparent to-foreground/25');
    /* 未处于 active ⇒ 没有 `compact-elapsed` 秒表。 */
    expect(out?.querySelector('[data-testid="compact-elapsed"]')).toBeNull();
  });
});
