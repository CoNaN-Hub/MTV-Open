// @vitest-environment jsdom
/**
 * 官方 `compact` item 的 **`phase:"started"` 生产者**回归（覆盖表 §6 #14 后半）。
 *
 * 官方 `$M`（`vendor-pkg-canvas-*.js` @2426911 逐字）：
 * ```js
 * if (e.type === "compact") { const C = e.content?.phase ?? "started"; return s.jsx(Tie,{phase:C,isStreaming:t}) }
 * ```
 * 官方在压缩**进行中**把 `{type:"compact",content:{phase:"started"}}` 追加进消息 `contents`（流末尾），
 * 完成后更新为 `"finished"`。MTV 没有消息级 `contents` ⇒ 生产者拆成两半：
 *   · `contextCompressingConversationId`（store 瞬时字段，**不持久化**）承载 started；
 *   · `ChatMessage.compactedAt` 承载 finished（§18.5 已落地）。
 * 本文件同时断言 store 生命周期与渲染层 DOM。
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/ai/assistantStream', () => ({
  resolveAssistantModel: () => 'test-model',
  streamAssistantReply: vi.fn(async () => {}),
}));
vi.mock('../../src/services/chat/chatHistoryService', () => ({
  loadMessages: vi.fn(async () => ({ messages: [] })),
}));

import ChatMessages from '../../src/components/chat/ChatMessages';
import { compressConversationContext } from '../../src/services/chat/contextCompressionService';
import { useAppStore } from '../../src/store/useAppStore';
import { setLocale } from '../../src/i18n';
import type { ChatMessage } from '../../src/types/chat';

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '回答', timestamp: 1_000, status: 'done', ...over };
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.getState().setContextCompacting(null);
});

afterEach(() => {
  cleanup();
});

describe('§6 #14 后半 —— `compact` `phase:"started"` 生产者', () => {
  it('store：`setContextCompacting` 设置 / 清除「正在压缩的会话」（默认 null）', () => {
    expect(useAppStore.getState().contextCompactingConversationId).toBeNull();
    useAppStore.getState().setContextCompacting('c-start');
    expect(useAppStore.getState().contextCompactingConversationId).toBe('c-start');
    useAppStore.getState().setContextCompacting(null);
    expect(useAppStore.getState().contextCompactingConversationId).toBeNull();
  });

  it('压缩调用**同步**置位，结束后清除（官方 started → finished 的生命周期）', async () => {
    const pending = compressConversationContext('conv-started-1');
    expect(useAppStore.getState().contextCompactingConversationId).toBe('conv-started-1');
    await pending.catch(() => undefined);
    expect(useAppStore.getState().contextCompactingConversationId).toBeNull();
  });

  it('`contextCompacting` ⇒ 消息流末尾渲染官方 `Tie` 的 **started** 态（含 `compact-elapsed` 秒表）', () => {
    const { container } = render(
      <ChatMessages
        messages={[message()]}
        showEmptyState={false}
        contextCompacting
      />,
    );
    expect(container.textContent).toContain('正在自动压缩上下文');
    const out = container.querySelector('output');
    expect(out).not.toBeNull();
    expect(out?.getAttribute('aria-live')).toBe('polite');
    expect(out?.className).toBe('flex w-full min-w-[280px] items-center gap-3 py-1.5 text-xs leading-4 text-foreground/70');
    /* `active = phase === "started" && isStreaming` ⇒ 有秒表、文案走 ShimmerText。 */
    expect(out?.querySelector('[data-testid="compact-elapsed"]')).not.toBeNull();
  });

  it('`contextCompacting` 为 false ⇒ 不渲染 started 行（官方没有 `compact` item 时也不渲染）', () => {
    const { container } = render(
      <ChatMessages messages={[message()]} showEmptyState={false} />,
    );
    expect(container.textContent).not.toContain('正在自动压缩上下文');
    expect(container.textContent).not.toContain('上下文已自动压缩');
  });
});
