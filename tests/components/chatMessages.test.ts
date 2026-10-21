import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../src/types/chat';

const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  stateCursor: 0,
  refCursor: 0,
  layoutEffects: [] as Array<() => void | (() => void)>,
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: <T,>(callback: T) => callback,
    useEffect: vi.fn(),
    useLayoutEffect: (effect: () => void | (() => void)) => {
      hooks.layoutEffects.push(effect);
    },
    useMemo: <T,>(factory: () => T) => factory(),
    useRef: <T,>(initialValue: T) => {
      const index = hooks.refCursor;
      hooks.refCursor += 1;
      if (!hooks.refs[index]) hooks.refs[index] = { current: initialValue };
      return hooks.refs[index] as { current: T };
    },
    useState: <T,>(initialValue: T | (() => T)) => {
      const index = hooks.stateCursor;
      hooks.stateCursor += 1;
      if (!(index in hooks.values)) {
        hooks.values[index] = typeof initialValue === 'function'
          ? (initialValue as () => T)()
          : initialValue;
      }
      const setValue = (next: T | ((current: T) => T)) => {
        const current = hooks.values[index] as T;
        hooks.values[index] = typeof next === 'function'
          ? (next as (value: T) => T)(current)
          : next;
      };
      return [hooks.values[index] as T, setValue] as const;
    },
    useSyncExternalStore: () => 'zh-CN',
  };
});

vi.mock('framer-motion', () => ({
  useReducedMotion: () => false,
}));

vi.mock('../../src/components/chat/MessageBubble', () => ({
  default: vi.fn(() => null),
}));

import ChatMessages from '../../src/components/chat/ChatMessages';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';

function createMessage(
  id: string,
  role: ChatMessage['role'],
  content: string,
  conversationId = 'conversation-1',
): ChatMessage {
  return {
    id,
    conversationId,
    role,
    content,
    timestamp: Number(id.replace(/\D/g, '')) || 1,
    status: 'done',
  };
}

function collectElements(node: ReactNode, elements: ReactElement[] = []): ReactElement[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    elements.push(child);
    collectElements((child.props as { children?: ReactNode }).children, elements);
  });
  return elements;
}

function renderChat(messages: ChatMessage[]): ReactElement {
  hooks.stateCursor = 0;
  hooks.refCursor = 0;
  hooks.layoutEffects = [];
  const tree = ChatMessages({
    messages,
    showEmptyState: false,
  });
  hooks.layoutEffects.forEach((effect) => effect());
  return tree;
}

function collectMessageBubbles(tree: ReactNode): ReactElement[] {
  return collectElements(tree).filter((element) => element.type === MessageBubble);
}

/** 官方 `hce` 是**无限滚动自动加载**（没有按钮）⇒ 触发方式 = 滚动到顶部 80px 内。 */
function triggerOlderMessages(tree: ReactNode): void {
  const container = findMessagesContainer(tree);
  (container.props as { onScroll: (event: unknown) => void }).onScroll({
    currentTarget: { scrollHeight: 2_000, scrollTop: 0, clientHeight: 400 },
  });
}

function findMessagesContainer(tree: ReactNode): ReactElement {
  const container = collectElements(tree).find((element) => (
    element.type === 'div'
    && String((element.props as { className?: string }).className).includes('chat-panel-messages relative h-full')
  ));
  if (!container) throw new Error('messages container not found');
  return container;
}

describe('ChatMessages', () => {
  beforeEach(() => {
    hooks.values = [];
    hooks.refs = [];
    hooks.stateCursor = 0;
    hooks.refCursor = 0;
    hooks.layoutEffects = [];
    setLocale('zh-CN');
  });

  /* ⚠️ 原「associates assistant messages with the latest user prompt（regeneratePrompt）」与
     「only mounts the latest message batch and preserves the preceding user prompt」两条用例
     随「消息操作栏只保留官方 copy/fork/👍/👎」一起删除：官方操作栏里**没有**「再次生成」，
     该 regeneratePrompt 计算链（mapChatMessageRows 的 latestUserPrompt 追踪）已按官方移除。 */

  it('only mounts the latest message batch', () => {
    const messages = [createMessage('message-1', 'user', 'earlier prompt')];
    for (let index = 2; index <= 91; index += 1) {
      messages.push(createMessage(`message-${index}`, 'assistant', `answer ${index}`));
    }

    const tree = renderChat(messages);
    const messageBubbles = collectMessageBubbles(tree);

    expect(messageBubbles).toHaveLength(80);
    expect((messageBubbles[0].props as { message: ChatMessage }).message.id).toBe('message-12');
  });

  it('loads older messages in batches and translates the control', () => {
    const messages = Array.from({ length: 150 }, (_, index) => createMessage(
      `message-${index + 1}`,
      index === 0 ? 'user' : 'assistant',
      `message ${index + 1}`,
    ));

    let tree = renderChat(messages);
    expect(collectMessageBubbles(tree)).toHaveLength(80);
    triggerOlderMessages(tree);

    tree = renderChat(messages);
    const loadedBubbles = collectMessageBubbles(tree);
    expect(loadedBubbles).toHaveLength(140);
    expect((loadedBubbles[0].props as { message: ChatMessage }).message.id).toBe('message-11');

    /* 官方没有「加载更早」文案控件（无限滚动 + 转圈行）⇒ 改为核对官方滚动区类串。 */
    setLocale('en-US');
    tree = renderChat(messages);
    expect(String((findMessagesContainer(tree).props as { className?: string }).className))
      .toContain('scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border');
  });

  it('resets the scroll window on conversation switches, including when switching back', () => {
    const makeConversation = (conversationId: string) => Array.from(
      { length: 150 },
      (_, index) => createMessage(
        `${conversationId}-${index + 1}`,
        index === 0 ? 'user' : 'assistant',
        `message ${index + 1}`,
        conversationId,
      ),
    );
    const firstConversation = makeConversation('conversation-a');
    const secondConversation = makeConversation('conversation-b');

    let tree = renderChat(firstConversation);
    triggerOlderMessages(tree);
    tree = renderChat(firstConversation);
    expect(collectMessageBubbles(tree)).toHaveLength(140);

    const container = findMessagesContainer(tree);
    (container.props as { onScroll: (event: unknown) => void }).onScroll({
      currentTarget: { scrollHeight: 2_000, scrollTop: 200, clientHeight: 400 },
    });
    tree = renderChat(firstConversation);
    /* 回到底部圆钮 = 官方 `KR` 的定位串（`absolute left-[50%] translate-x-[-50%] rounded-full`）。 */
    expect(collectElements(tree).some((element) => (
      element.type === 'button'
      && String((element.props as { className?: string }).className).includes('absolute left-[50%]')
    ))).toBe(true);

    tree = renderChat(secondConversation);
    expect(collectMessageBubbles(tree)).toHaveLength(80);
    expect(collectElements(tree).some((element) => (
      element.type === 'button'
      && String((element.props as { className?: string }).className).includes('absolute left-[50%]')
    ))).toBe(false);

    tree = renderChat(firstConversation);
    expect(collectMessageBubbles(tree)).toHaveLength(80);
  });

  it('keeps the visible top message anchored when new messages arrive away from the bottom', () => {
    const messages = Array.from({ length: 100 }, (_, index) => createMessage(
      `message-${index + 1}`,
      index === 0 ? 'user' : 'assistant',
      `message ${index + 1}`,
    ));
    let tree = renderChat(messages);
    const firstVisibleId = (
      collectMessageBubbles(tree)[0].props as { message: ChatMessage }
    ).message.id;

    const container = findMessagesContainer(tree);
    (container.props as { onScroll: (event: unknown) => void }).onScroll({
      currentTarget: { scrollHeight: 2_000, scrollTop: 200, clientHeight: 400 },
    });
    const withNewMessage = [
      ...messages,
      createMessage('message-101', 'assistant', 'new answer'),
    ];
    tree = renderChat(withNewMessage);
    const visible = collectMessageBubbles(tree);
    expect((visible[0].props as { message: ChatMessage }).message.id).toBe(firstVisibleId);
    expect(visible).toHaveLength(81);
  });
});
