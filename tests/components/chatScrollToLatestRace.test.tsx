// @vitest-environment jsdom
/**
 * 「点『回到最新消息』圆钮后内容往回弹」的**确定性复现**与真因钉死。
 *
 * ── 症状 ──
 * 会话生成中，消息列表下方居中的那颗圆钮（`ChatMessages` 的 `!isNearBottom` 分支）点下去后，
 * 列表**没有停在最新消息**，而是往回弹到之前的内容。
 *
 * ── 本文件钉住的两件事 ──
 * ① `ChatMessages.scrollToLatest`（点击那一刻执行的 4 步）**自己**把视图停在底部：
 *    `scrollTo({top:scrollHeight,behavior:'smooth'})` → 翻 `isNearBottom` → 把尾部渲染窗口
 *    从 80+N 砍回 80（一次性卸载 N 条）→ `requestAnimationFrame(jumpToLatest)` 把 `scrollTop`
 *    钉到 `scrollHeight`。**最后写入的位置就是底部** ⇒ 「渲染窗口卸载 ⇒ 停在旧内容」这条假设**不成立**。
 * ② 真因在 `ChatPanel.scrollToBottom`（生成进度驱动的那次滚动）：它滚的是
 *    `document.querySelector('.chat-panel-messages')?.lastElementChild`，而官方四层壳
 *    （`ChatMessages` ③ 内容层 `gap-4 p-5 pb-0 pr-14`）让 `lastElementChild` 变成**整段内容的包裹层**，
 *    `scrollIntoView` 又没给 `block`（默认 `start`）⇒ 把整段内容的**顶边**对到视口顶边 = **滚回对话最开头**。
 *    生成中每个正文 flush 都会打一次（`conversationExecutionController.ts:159` 的 `onProgress?.()`
 *    → `ChatPanel.tsx` 的 `submitConversationMessage({… onProgress: scrollToBottom})`），
 *    所以点完钮约 100ms 后就被拽回旧内容。
 *
 * ── 证据分级 ──
 * · 本文件 = jsdom 真 DOM + 确定性滚动模型（**不含** Chromium 的 scroll anchoring；
 *   模型按真实浏览器语义做 `scrollTop` 钳制与 `scrollIntoView({block:'start'})` 的 start 边对齐）。
 * · 真机 Chromium（Edge 150，独立无头实例 + 同一 DOM 结构复刻）实测读数：
 *   `scrollIntoView({behavior:'smooth'})` 打在内容包裹层上 ⇒ `scrollTop` 8900 → **19**（= 内容最开头）；
 *   而点击 `scrollToLatest` 的 4 步走完 ⇒ `scrollTop` 稳稳停在 8900（= 底部）。
 *
 * 验证分级 = **(b) jsdom 真 DOM + (d) 源码级契约**。
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../src/types/chat';

/* `reduceMotion=false` ⇒ `scrollToLatest` 走官方那条 `behavior:'smooth'` 分支（不是 reduced-motion 的 auto）。 */
vi.mock('framer-motion', () => ({ useReducedMotion: () => false }));
/* 只钉滚动/渲染窗口行为，气泡本身用轻量替身（`data-chat-message-id` 由 ChatMessages 自己渲染）。 */
vi.mock('../../src/components/chat/MessageBubble', () => ({
  default: () => null,
}));

import ChatMessages from '../../src/components/chat/ChatMessages';
import { setLocale } from '../../src/i18n';

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');
const CHAT_PANEL_SOURCE = readSource('src/components/chat/ChatPanel.tsx');

/** `scrollToBottom` 的函数体（`const scrollToBottom = useCallback(() => { … }, []);`）。 */
function chatPanelScrollToBottomBody(): string {
  const start = CHAT_PANEL_SOURCE.indexOf('const scrollToBottom = useCallback(');
  const end = CHAT_PANEL_SOURCE.indexOf('}, []);', start);
  if (start < 0 || end < 0) throw new Error('ChatPanel.scrollToBottom not found');
  return CHAT_PANEL_SOURCE.slice(start, end);
}

const CONVERSATION_ID = 'conversation-scroll';
const ROW_HEIGHT = 120;
const VIEWPORT = 400;
const INITIAL_MESSAGE_BATCH = 80;

const cleanupTasks: Array<() => void> = [];

function makeMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `message-${index + 1}`,
    conversationId: CONVERSATION_ID,
    role: index % 4 === 0 ? 'user' : 'assistant',
    content: `message ${index + 1}`,
    timestamp: index + 1,
    status: 'done',
  } as ChatMessage));
}

function scrollerOf(container: HTMLElement): HTMLElement {
  const scroller = container.querySelector<HTMLElement>('.chat-panel-messages');
  if (!scroller) throw new Error('.chat-panel-messages not found');
  return scroller;
}

interface ScrollModel {
  events: string[];
  mountedRows: () => number;
  /** 规范里 `scrollIntoView` 默认 `block:'start'` 的落点（模型值）。 */
  scrollStartEdgeOf: (element: Element) => number;
}

/**
 * 给滚动容器装上确定性模型：内容高 = 已挂载消息行数 × 行高，视口高固定，
 * `scrollTop` 像真浏览器一样按 `[0, scrollHeight - clientHeight]` 钳制。
 */
function installScrollModel(container: HTMLElement): ScrollModel {
  const scroller = scrollerOf(container);
  const events: string[] = [];
  let top = 0;
  const mountedRows = () => scroller.querySelectorAll('[data-chat-message-id]').length;
  const maxTop = () => Math.max(0, mountedRows() * ROW_HEIGHT - VIEWPORT);
  const clamp = (value: number) => Math.max(0, Math.min(value, maxTop()));

  Object.defineProperty(scroller, 'scrollHeight', {
    configurable: true,
    get: () => mountedRows() * ROW_HEIGHT,
  });
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => VIEWPORT });
  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    get: () => clamp(top),
    set: (value: number) => {
      top = value;
      events.push(`scrollTop=${clamp(value)}`);
    },
  });
  Object.defineProperty(scroller, 'scrollTo', {
    configurable: true,
    value: (options: ScrollToOptions = {}) => {
      const behavior = options.behavior ?? 'auto';
      events.push(`scrollTo(top=${options.top},behavior=${behavior})`);
      /* 平滑滚动在 jsdom 里不跑动画；它之后被 `jumpToLatest` 覆盖（真机读数见文件头）。 */
      if (behavior !== 'smooth') scroller.scrollTop = options.top ?? 0;
    },
  });

  /* DOM 变更（= React 提交时尾部窗口的卸载/挂载）也进同一条时间线，用来钉「谁先谁后」。 */
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.removedNodes.length) events.push(`dom:remove ${record.removedNodes.length}`);
      if (record.addedNodes.length) events.push(`dom:add ${record.addedNodes.length}`);
    }
  });
  observer.observe(scroller, { childList: true, subtree: true });
  cleanupTasks.push(() => observer.disconnect());

  return {
    events,
    mountedRows,
    scrollStartEdgeOf: (element: Element) => {
      if (element === scroller.lastElementChild) return 0; // 内容包裹层的顶边 = 内容最开头
      const rows = Array.from(scroller.querySelectorAll('[data-chat-message-id]'));
      const index = rows.indexOf(element);
      return index < 0 ? 0 : index * ROW_HEIGHT;
    },
  };
}

function atBottom(scroller: HTMLElement): boolean {
  return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 1;
}

function lastScrollWrite(events: string[]): string {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].startsWith('scrollTop=')) return events[index];
  }
  return '';
}

/** React 逐个 `removeChild` ⇒ 每个被卸载的行是一条独立记录，这里求和。 */
function totalRemovedRows(events: string[]): number {
  return events.reduce((sum, event) => {
    const match = /^dom:remove (\d+)$/.exec(event);
    return match ? sum + Number(match[1]) : sum;
  }, 0);
}

async function flushFrames(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
}

async function mountChat(messages: ChatMessage[]) {
  const view = render(<ChatMessages messages={messages} showEmptyState={false} />);
  const scroller = scrollerOf(view.container);
  const model = installScrollModel(view.container);
  /* 初始在底部（会话加载那一帧 `container.scrollTop = container.scrollHeight`）。 */
  await act(async () => { scroller.scrollTop = scroller.scrollHeight; });
  return { view, scroller, model };
}

function scrollToBottomButton(container: HTMLElement): HTMLElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => (candidate.getAttribute('aria-label') ?? '').startsWith('回到最新消息'),
  );
  if (!button) throw new Error('「回到最新消息」圆钮不在 DOM 里');
  return button;
}

beforeEach(() => {
  setLocale('zh-CN');
});

afterEach(() => {
  while (cleanupTasks.length) cleanupTasks.pop()?.();
  cleanup();
});

describe('① 点击「回到最新消息」：调用序列 / 卸载量 / 最终落点', () => {
  it('渲染窗口从 80+N 砍回 80（一次性卸载 N 条）后，最后写入仍是**底部** ⇒ 「卸载导致停在旧内容」不成立', async () => {
    const all = makeMessages(260);
    const { view, scroller, model } = await mountChat(all.slice(0, 140));

    /* 初始：尾部窗口 = 最后 80 条（消息 61..140）。 */
    expect(model.mountedRows()).toBe(INITIAL_MESSAGE_BATCH);

    /* 用户往上滚（`handleScroll` 判定离开底部）⇒ 圆钮出现。 */
    await act(async () => {
      scroller.scrollTop = 3_000;
      fireEvent.scroll(scroller);
    });
    expect(scrollToBottomButton(view.container).className).toContain('absolute left-[50%]');

    /* 生成中：又来了 120 条新消息 ⇒ `appendedWhileAway` 把窗口顶部钉住，窗口涨到 200。 */
    view.rerender(<ChatMessages messages={all} showEmptyState={false} />);
    expect(model.mountedRows()).toBe(200);

    model.events.length = 0;
    const scrollHeightBeforeClick = scroller.scrollHeight;

    await act(async () => {
      fireEvent.click(scrollToBottomButton(view.container));
    });
    await flushFrames();

    /* ② 调用序列：平滑滚动 → DOM 卸载 → rAF 把 scrollTop 钉到底（React 提交在前，rAF 在后）。 */
    const firstScrollTo = model.events.findIndex((event) => event.startsWith('scrollTo('));
    const firstRemoval = model.events.findIndex((event) => event.startsWith('dom:remove'));
    const lastWrite = model.events.findLastIndex((event) => event.startsWith('scrollTop='));
    expect(model.events[firstScrollTo]).toBe(
      `scrollTo(top=${scrollHeightBeforeClick},behavior=smooth)`,
    );
    expect(firstRemoval).toBeGreaterThan(firstScrollTo);
    expect(lastWrite).toBeGreaterThan(firstRemoval);

    /* ③ 卸载了哪些：窗口 200 → 80，最早挂载的 120 条（消息 61..180）被卸载。 */
    const mounted = Array.from(scroller.querySelectorAll('[data-chat-message-id]'))
      .map((row) => row.getAttribute('data-chat-message-id'));
    expect(mounted).toHaveLength(INITIAL_MESSAGE_BATCH);
    expect(mounted[0]).toBe('message-181');
    expect(mounted[mounted.length - 1]).toBe('message-260');
    expect(totalRemovedRows(model.events)).toBe(120);
    /* ④ 最终落点：底部（最新消息），**不是**卸载前看到的那条。 */
    expect(lastScrollWrite(model.events)).toBe(`scrollTop=${scroller.scrollHeight - VIEWPORT}`);
    expect(atBottom(scroller)).toBe(true);
  });

  it('消息数 ≤ 80（窗口不会截断）时，点击只做滚动、DOM 一条都不动（对照：主因不在渲染窗口）', async () => {
    const messages = makeMessages(60);
    const { scroller, model } = await mountChat(messages);

    await act(async () => {
      scroller.scrollTop = 1_000;
      fireEvent.scroll(scroller);
    });
    model.events.length = 0;
    const before = model.mountedRows();

    await act(async () => {
      fireEvent.click(scrollToBottomButton(document.body));
    });
    await flushFrames();

    expect(model.mountedRows()).toBe(before);
    expect(model.events.some((event) => event.startsWith('dom:'))).toBe(false);
    expect(model.events.some((event) => event.startsWith('scrollTo('))).toBe(true);
    expect(atBottom(scroller)).toBe(true);
  });
});

describe('② 真因：生成进度驱动的 `ChatPanel.scrollToBottom` 把视图拽回**内容最开头**', () => {
  it('官方四层壳让 `lastElementChild` = 内容包裹层；对它 `scrollIntoView`（默认 `block:"start"`）⇒ 落点 0', async () => {
    const messages = makeMessages(260);
    const { scroller, model } = await mountChat(messages);
    await act(async () => {
      scroller.scrollTop = scroller.scrollHeight; // 停在最新消息
    });
    expect(atBottom(scroller)).toBe(true);

    /* 这段是 `ChatPanel.scrollToBottom` 里正在跑的那个表达式（逐字）。 */
    const target = scroller.lastElementChild!;
    expect(target.hasAttribute('data-chat-message-id')).toBe(false);
    expect(String(target.className)).toContain('gap-4 p-5 pb-0 pr-14');
    /* 内容包裹层自己就是「整段内容」：它的顶边 = 内容最开头。 */
    expect(model.scrollStartEdgeOf(target)).toBe(0);

    /* 规范：`scrollIntoView` 默认 `block:"start"` ⇒ 把目标顶边对到视口顶边。 */
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoViewStub(
      this: Element,
      options?: ScrollIntoViewOptions,
    ) {
      if (!scroller.contains(this)) return original?.call(this, options);
      scroller.scrollTop = model.scrollStartEdgeOf(this);
    };
    try {
      target.scrollIntoView({ behavior: 'smooth' });
    } finally {
      Element.prototype.scrollIntoView = original;
    }

    /* 真机 Chromium 实测读数：8900 → 19（本条 jsdom 模型给 0，等价：内容最开头）。 */
    expect(scroller.scrollTop).toBe(0);
    expect(atBottom(scroller)).toBe(false);
    expect(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight).toBeGreaterThan(1_000);
  });

  it('源码级契约：`ChatPanel.scrollToBottom` 不得对 `lastElementChild` 用 `scrollIntoView`，必须滚容器到底', () => {
    const body = chatPanelScrollToBottomBody();
    expect(body).not.toContain('scrollIntoView');
    expect(body).toContain("querySelector<HTMLElement>('.chat-panel-messages')");
    expect(body).toContain('container.scrollTo({ top: container.scrollHeight');
  });
});
