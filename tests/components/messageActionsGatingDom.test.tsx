// @vitest-environment jsdom
/**
 * `MessageBubble` 的「**消息操作行**」门控 —— 官方**当前**产物公式的 jsdom 回归（round 65）。
 *
 * 官方依据（逐字）：`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`
 *   · `MessageItem` = `jle`，charIdx **2652607 → 2666243**，`jle.displayName="MessageItem"` @2666214
 *   · store 选择器 @2652726 邻域：`const S=Fe(os),C=S.pendingQuestion?.status==="pending",N=S.isLoading`
 *   · 操作行旗标 @2657573 / @2658097 / @2659034 起（`de` / `me` / `he` / `_e` / `ge` / `Se` / `Oe` / `nt`）
 *   · 渲染 @2664443 起，动作行容器 `A3`（= `lM` @vendor-packages-DRvCmDjR.js:178899，
 *     `a.jsx("div",{className:I("flex items-center gap-1",e),…})`）
 *
 * 官方逐字公式：
 * ```js
 * C  = S.pendingQuestion?.status==="pending"
 * N  = S.isLoading
 * de = a.useMemo(… S.billingNotice …)
 * me = !g&&e.role==="user"&&!!k
 * he = !!(N||S.runId||S.streamingMessageId||S.streamState!=="idle"
 *         ||S.pendingConfirmation?.status==="pending"||S.pendingConfirmation?.status==="syncing"||C||de)
 * _e = r&&he
 * ge = !g&&e.role==="assistant"&&!n&&!_e
 * Se = !g&&e.role==="assistant"&&(n||_e)
 * Oe = ge&&!!h
 * $e = e.sentAt??e.responseStartedAt
 * nt = !g&&!e.unsent&&typeof $e=="number"&&Number.isFinite($e)&&!(e.role==="assistant"&&(n||r&&N))
 * ```
 * MTV 侧只有 `C` 有真实来源（`useAppStore(state=>state.pendingQuestion)`）—— 其余会话态因子
 * （`N`/`runId`/`streamingMessageId`/`streamState`/`pendingConfirmation`/`billingNotice`）**无生产者
 * ⇒ false**，不做等价替代；`n` 用 MTV 真实的 `message.status==='streaming'`；`$e` 用 `message.timestamp`。
 *
 * 验证分级 = **(b) jsdom 真 DOM**（未做 (a) live CDP，见文件末尾说明）。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { ChatMessage, PendingAskQuestion } from '../../src/types/chat';

const COPY_LABEL = '复制消息';
const FORK_LABEL = '在新会话中继续';

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    role: 'assistant',
    content: '正文',
    timestamp: 1_000,
    status: 'complete',
    ...over,
  };
}

function pendingQuestion(over: Partial<PendingAskQuestion> = {}): PendingAskQuestion {
  return {
    toolUseId: 'call-1',
    conversationId: 'c1',
    questions: [],
    status: 'pending',
    ...over,
  };
}

/** 官方 `ge` 支的存在性判据：那一支里一定有 copy 钮（官方 `ze`）。 */
function hasActionRow(container: HTMLElement): boolean {
  return container.querySelector(`[aria-label="${COPY_LABEL}"]`) !== null;
}
/** 官方 `Se` 支的占位符（`data-message-actions-placeholder={!0}`）。 */
function hasPlaceholder(container: HTMLElement): boolean {
  return container.querySelector('[data-message-actions-placeholder]') !== null;
}
/** 官方时间戳 `jlt`/`wde` 的 `data-message-time`。 */
function timestamps(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-message-time]'));
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
  /* 官方 `S = Fe(os)` 取的是 `getSessionState(activeSessionId)` ⇒ 会话作用域隐含；
     MTV 的 `pendingQuestion` 是全局字段 + 戳 ⇒ 忠实翻译必须让「活动会话」与戳对得上。
     测试夹具统一把活动会话设为 `c1`（与 `message()` / `pendingQuestion()` 的 `conversationId` 一致）。 */
  useAppStore.setState({ activeConversationId: 'c1' });
});

afterEach(() => {
  cleanup();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('MessageBubble 操作行门控 —— 官方当前公式 / 因子 C（pendingQuestion 待答）', () => {
  it('① 末条 assistant + `pendingQuestion.status==="pending"` ⇒ **无操作行**、有 `Se` 占位', () => {
    useAppStore.setState({ pendingQuestion: pendingQuestion() });
    const { container } = render(
      <MessageBubble message={message()} isLastAssistantMessage onMessageFork={() => {}} />,
    );
    /* `C` = true ⇒ `he` = true ⇒ `_e` = true ⇒ `ge` = false / `Se` = true。 */
    expect(hasActionRow(container)).toBe(false);
    expect(hasPlaceholder(container)).toBe(true);
    /* fork 钮在官方里只出现在 `ge` 支（`{ge&&…Oe&&Ee…}`）⇒ 这里也必须没有。 */
    expect(container.querySelector(`[aria-label="${FORK_LABEL}"]`)).toBeNull();
  });

  it('①-对照 **别的会话**在待答 ⇒ 本会话操作行照旧渲染（官方会话作用域在 MTV 里由戳显式表达）', () => {
    /* 官方 `S` 是会话 store，别会话的 `pendingQuestion` 根本不在 `S` 里；
       MTV 的全局字段必须靠 `conversationId` 戳比较，否则会跨会话误判成「等用户作答」。 */
    useAppStore.setState({ pendingQuestion: pendingQuestion({ conversationId: 'c2' }) });
    const { container } = render(
      <MessageBubble message={message()} isLastAssistantMessage onMessageFork={() => {}} />,
    );
    expect(hasActionRow(container)).toBe(true);
    expect(hasPlaceholder(container)).toBe(false);
  });

  it('①-对照 `pendingQuestion.status==="answered"` / 无提问 ⇒ 操作行回来、占位消失', () => {
    useAppStore.setState({ pendingQuestion: pendingQuestion({ status: 'answered' }) });
    const answered = render(
      <MessageBubble message={message()} isLastAssistantMessage onMessageFork={() => {}} />,
    );
    expect(hasActionRow(answered.container)).toBe(true);
    expect(hasPlaceholder(answered.container)).toBe(false);
    answered.unmount();

    useAppStore.setState({ pendingQuestion: null });
    const none = render(
      <MessageBubble message={message()} isLastAssistantMessage onMessageFork={() => {}} />,
    );
    expect(hasActionRow(none.container)).toBe(true);
    expect(hasPlaceholder(none.container)).toBe(false);
  });

  it('② `n` = MTV 真实流式信号 `message.status==="streaming"` ⇒ `ge` 关、`Se` 开', () => {
    useAppStore.setState({ pendingQuestion: null });
    const { container } = render(
      <MessageBubble message={message({ status: 'streaming' })} isLastAssistantMessage onMessageFork={() => {}} />,
    );
    /* 官方 `ge` 要求 `!n`；`Se = …&&(n||_e)` 在 n=true 时为真。 */
    expect(hasActionRow(container)).toBe(false);
    expect(hasPlaceholder(container)).toBe(true);
  });

  it('②-对照 媒体生成态（`mediaStatus`）**不是**官方因子 ⇒ 不影响操作行', () => {
    /* 官方公式里没有任何 mediaStatus 因子；MTV 旧实现把 `isGenerating` 当作 `N` 用 ⇒ 这里锁死。
       `mediaStatus:'generating'` 且非流式 ⇒ `n`=false、`_e`=false ⇒ `ge` 仍为真（操作行在）。 */
    useAppStore.setState({ pendingQuestion: null });
    const { container } = render(
      <MessageBubble message={message({ mediaStatus: 'generating' })} isLastAssistantMessage onMessageFork={() => {}} />,
    );
    expect(hasActionRow(container)).toBe(true);
    expect(hasPlaceholder(container)).toBe(false);
  });

  it('③ 非末条 assistant + 待答 ⇒ 操作行在（`_e = r && he` 里 `r` 为假）', () => {
    useAppStore.setState({ pendingQuestion: pendingQuestion() });
    const { container } = render(
      <MessageBubble message={message()} isLastAssistantMessage={false} onMessageFork={() => {}} />,
    );
    expect(hasActionRow(container)).toBe(true);
    expect(hasPlaceholder(container)).toBe(false);
  });

  it('③-对照 末条 assistant（无提问）与 非末条 都渲染操作行 —— 差别只在 `he` 为真时才显形', () => {
    useAppStore.setState({ pendingQuestion: null });
    const last = render(<MessageBubble message={message()} isLastAssistantMessage />);
    expect(hasActionRow(last.container)).toBe(true);
    last.unmount();
    const notLast = render(<MessageBubble message={message()} isLastAssistantMessage={false} />);
    expect(hasActionRow(notLast.container)).toBe(true);
  });

  it('`g`(suppressActions) ⇒ 所有分支全关（官方 `!g` 同时出现在 `me`/`ge`/`Se`/`nt`）', () => {
    useAppStore.setState({ pendingQuestion: pendingQuestion() });
    const { container } = render(
      <MessageBubble message={message()} isLastAssistantMessage suppressActions onMessageFork={() => {}} />,
    );
    expect(hasActionRow(container)).toBe(false);
    expect(hasPlaceholder(container)).toBe(false);
    expect(timestamps(container)).toHaveLength(0);
  });
});

describe('MessageBubble 操作行门控 —— `nt` 时间戳行（`me` / `ge` / 独立时间戳行）', () => {
  it('④ user + 有正文 + 有限时间戳 ⇒ `me` 支：start 时间戳 + copy（`mt-1 ml-auto` + 动作行容器）', () => {
    const { container } = render(
      <MessageBubble message={message({ role: 'user', content: '你好', id: 'u1' })} />,
    );
    const ts = timestamps(container);
    expect(ts).toHaveLength(1);
    expect(ts[0].getAttribute('data-message-time')).toBe('hidden');
    /* 官方 user 的 start 时间戳在 `A3` 容器里（`flex items-center gap-1`），且 copy 钮同排。 */
    expect(container.querySelector(`[aria-label="${COPY_LABEL}"]`)).not.toBeNull();
    expect(ts[0].closest('div')?.className).toContain('flex items-center gap-1');
    /* 官方的这段分支：`{me&&s.jsxs(A3,{className:"mt-1 ml-auto",children:[Ue("start"),ze]})}`。 */
    expect(ts[0].closest('div')?.className).toContain('mt-1 ml-auto');
  });

  it('④ user + **无正文** ⇒ `nt && user && !me` 支：裸 `<div className="mt-1 ml-auto flex">`（**无** items-center gap-1）', () => {
    const { container } = render(
      <MessageBubble message={message({ role: 'user', content: '', id: 'u2' })} />,
    );
    const ts = timestamps(container);
    expect(ts).toHaveLength(1);
    const row = ts[0].closest('div');
    /* 官方逐字 `s.jsx("div",{className:"mt-1 ml-auto flex",children:Ue()})` —— 没有 `items-center gap-1`。 */
    expect(row?.className).toBe('mt-1 ml-auto flex');
  });

  it('④ assistant + 非流式 ⇒ 时间戳在 `ge` 动作行内（`mt-2 -ml-1.5` + 动作行容器）', () => {
    const { container } = render(<MessageBubble message={message()} isLastAssistantMessage />);
    const ts = timestamps(container);
    expect(ts).toHaveLength(1);
    const row = ts[0].closest('div');
    expect(row?.className).toContain('mt-2 -ml-1.5');
    expect(row?.className).toContain('flex items-center gap-1');
  });

  it('④ assistant + 流式 ⇒ `nt` 为假（`!(assistant && n)`）⇒ **完全没有时间戳**', () => {
    const { container } = render(
      <MessageBubble message={message({ status: 'streaming' })} isLastAssistantMessage />,
    );
    expect(timestamps(container)).toHaveLength(0);
  });

  it('④ **非有限时间戳** ⇒ `Number.isFinite($e)` 为假 ⇒ 没有时间戳，但 `ge` 操作行**照旧存在**', () => {
    /* 官方 `ge` **不依赖** `nt`：时间戳是官方 `Ue()` 闭包自己判 `nt` 后才返回 `jlt`，
       所以 NaN 时间戳只会让时间戳为 `null`，操作行（copy/👍/👎）仍照 `ge` 渲染。
       （这一条同时锁住「时间戳节点自带 `nt` 门、不是每支外面再判一次」这个官方细节。） */
    const { container } = render(
      <MessageBubble message={message({ timestamp: Number.NaN })} isLastAssistantMessage />,
    );
    expect(timestamps(container)).toHaveLength(0);
    expect(hasActionRow(container)).toBe(true);
    expect(hasPlaceholder(container)).toBe(false);
  });

  it('④ `unsent`：官方 `!e.unsent` 在 MTV **无对应字段**（无生产者）⇒ 恒真，不抑制时间戳', () => {
    /* 官方 `nt` 的第二个因子是 `!e.unsent`；MTV `ChatMessage`（`src/types/chat.ts:390` 形状）里
       没有 `unsent`，全库 0 命中 ⇒ 该因子是**恒真的 no-op**。这里锁住「没有这个字段」这个事实：
       一旦将来有人补上 `unsent` 却忘了改公式，本断言会失败提醒。 */
    const msg = message({ id: 'u3', role: 'user', content: '你好' });
    expect('unsent' in msg).toBe(false);
    const { container } = render(<MessageBubble message={msg} />);
    expect(timestamps(container)).toHaveLength(1);
  });

  it('④ assistant 非末条 + 非流式 + 无提问 ⇒ 走 `ge` 支（官方**没有**独立的 fork 时间戳行）', () => {
    /* 旧版官方（MTV 原来照抄的版本）有第 5 支 `{assistant && !ke && Te && <行>{copy}{fork}{时间戳}</行>}`；
       官方**当前**产物（@2664443 起）只有 **5 支**，fork 钮只在 `ge` 支里（`Oe&&Ee`）⇒ 该支已删除。
       这里锁住：非末条 assistant 也走 `ge` 支（copy 在，`-ml-1.5` 动作行在）。 */
    const { container } = render(
      <MessageBubble message={message()} isLastAssistantMessage={false} onMessageFork={() => {}} />,
    );
    expect(hasActionRow(container)).toBe(true);
    const ts = timestamps(container);
    expect(ts).toHaveLength(1);
    expect(ts[0].closest('div')?.className).toContain('mt-2 -ml-1.5');
    /* 且**没有**第二行（旧版那一支会多出一行 `-ml-1.5`）。 */
    expect(container.querySelectorAll('.mt-2.-ml-1\\.5').length).toBe(1);
  });

  it('`Oe = ge && !!h`：没有 `onMessageFork` 时 fork 钮不渲染，但 `ge` 支其余仍在', () => {
    const { container } = render(<MessageBubble message={message()} isLastAssistantMessage />);
    expect(container.querySelector(`[aria-label="${FORK_LABEL}"]`)).toBeNull();
    expect(hasActionRow(container)).toBe(true);
    expect(container.querySelector('[aria-label="好评"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="差评"]')).not.toBeNull();
  });

  it('`Oe = ge && !!h`：有 `onMessageFork` 时 fork 钮在 `ge` 支内', () => {
    const { container } = render(
      <MessageBubble message={message()} isLastAssistantMessage onMessageFork={() => {}} />,
    );
    const fork = container.querySelector(`[aria-label="${FORK_LABEL}"]`);
    expect(fork).not.toBeNull();
    expect(fork?.closest('div')?.className).toContain('mt-2 -ml-1.5');
  });
});
