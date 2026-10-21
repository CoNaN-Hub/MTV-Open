/**
 * ChatMessages — 消息列表区
 *
 * 渲染所有消息 + 空状态提示，自动滚动到底部。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback, type UIEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { ChatMessage } from '../../types/chat';
import type { AgentTask } from '../../types/agent';
import MessageBubble from './MessageBubble';
import CompactLifecycleLine from './CompactLifecycleLine';
import EmptyChatState from './EmptyChatState';
import MessageErrorBoundary from './MessageErrorBoundary';
import { OfficialArrowDownIcon } from './officialIcons';
import QueryLocator from './QueryLocator';
import { buildQueryAnchors } from '../../services/chat/queryLocator';
import type { AgentTaskControls } from './AgentTaskTimeline';
import type { ChatReferenceHandlers } from './ChatReferenceText';
import { useT } from '../../i18n';

interface ChatMessagesProps extends ChatReferenceHandlers {
  messages: ChatMessage[];
  agentTasks?: AgentTask[];
  showEmptyState: boolean;
  /** 官方 `compact` `phase:"started"`（§6 #14 后半）：本会话正在压缩上下文。
   *  官方把 `{type:"compact",content:{phase:"started"}}` 追加进消息 `contents`（流末尾），
   *  这里等价地在消息流末尾渲染官方 `Tie`（`CompactLifecycleLine`）。 */
  contextCompacting?: boolean;
  /** 官方：输入框已有内容时不渲染空态建议卡（`hasInputContent ? null : …`）。 */
  hasInputContent?: boolean;
  onAddMediaToCanvas?: (messageId: string) => void;
  onRetryMediaSave?: (messageId: string) => Promise<void>;
  /** 官方 `onMessageFeedback(messageId, 'up' | 'down')`（可选）。 */
  onMessageFeedback?: (messageId: string, vote: 'up' | 'down') => void;
  /** 官方 `onMessageFork(messageId)`（可选）。 */
  onMessageFork?: (messageId: string) => void;
  /** 官方 `qae`(`AgentErrorBanner`) 的 `onRetry`：重跑这一轮失败的请求（可选）。 */
  onRetryMessage?: (messageId: string) => void;
  agentControls?: AgentTaskControls;
  /** 点击示例提示 → 填入输入框 */
  onExampleClick?: (text: string) => void;
  onEditMessage?: (content: string) => void;
  onRegenerateMessage?: (content: string) => void;
}

/* MTV 原来的「开始对话 + 三个示例 chip」空态被官方空态取代（官方空态 = 问候 + 主句 + 2 张建议卡），
   示例文案改由 `emptyStateSuggestions.ts` 提供（官方 `Cue`/`Sue` 本地池）。 */
const EMPTY_AGENT_TASKS: AgentTask[] = [];
const INITIAL_MESSAGE_BATCH = 80;
const MESSAGE_BATCH_SIZE = 60;

interface ChatScrollState {
  conversationId: string;
  isNearBottom: boolean;
  unreadCount: number;
}

interface ChatRenderWindow {
  conversationId: string;
  limit: number;
  messageCount: number;
}

function mapChatMessageRows<T>(
  messages: ChatMessage[],
  renderRow: (message: ChatMessage) => T,
): T[] {
  /* 官方操作栏里没有「再次生成」（0 命中）⇒ 原先为它计算的「最近一条 user 内容」已删除。 */
  return messages.map((message) => renderRow(message));
}

export default function ChatMessages({
  messages,
  agentTasks = EMPTY_AGENT_TASKS,
  showEmptyState,
  contextCompacting = false,
  hasInputContent = false,
  onAddMediaToCanvas,
  onRetryMediaSave,
  onMessageFeedback,
  onMessageFork,
  onRetryMessage,
  agentControls,
  onExampleClick,
  onNodeActivate,
  onNodeHover,
  onModelActivate,
}: ChatMessagesProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const conversationId = messages[0]?.conversationId ?? '';
  /** 官方判据：会话里没有消息就显示空态（新建会话也算）。 */
  const isEmptySession = showEmptyState || messages.length === 0;
  const messagesRef = useRef<HTMLDivElement>(null);
  /** 官方 `contentRef`：`Lit`(QueryLocator) 找 `[data-query-locator-anchor-id]` 行的内容元素。 */
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const activeConversationRef = useRef(conversationId);
  const previousMessagesRef = useRef<{ conversationId: string; messages: ChatMessage[] }>({
    conversationId,
    messages: [],
  });
  const pendingOlderScrollRef = useRef<{
    conversationId: string;
    height: number;
    top: number;
  } | null>(null);
  const [scrollState, setScrollState] = useState<ChatScrollState>({
    conversationId,
    isNearBottom: true,
    unreadCount: 0,
  });
  const [renderWindow, setRenderWindow] = useState<ChatRenderWindow>({
    conversationId,
    limit: INITIAL_MESSAGE_BATCH,
    messageCount: messages.length,
  });
  const isNearBottom = scrollState.conversationId === conversationId
    ? scrollState.isNearBottom
    : true;
  const unreadCount = scrollState.conversationId === conversationId
    ? scrollState.unreadCount
    : 0;
  const baseRenderLimit = renderWindow.conversationId === conversationId
    ? renderWindow.limit
    : INITIAL_MESSAGE_BATCH;
  // 用户停留在历史位置时，新消息应扩展窗口末尾，不能把当前窗口顶部挤掉。
  const appendedWhileAway = renderWindow.conversationId === conversationId && !isNearBottom
    ? Math.max(0, messages.length - renderWindow.messageCount)
    : 0;
  const renderLimit = Math.min(messages.length, baseRenderLimit + appendedWhileAway);
  const visibleStartIndex = Math.max(0, messages.length - renderLimit);
  const visibleMessages = useMemo(
    () => visibleStartIndex === 0 ? messages : messages.slice(visibleStartIndex),
    [messages, visibleStartIndex],
  );
  const hiddenMessageCount = visibleStartIndex;
  const agentTaskById = useMemo(
    () => new Map(agentTasks.map((task) => [task.id, task])),
    [agentTasks],
  );
  const lastAssistantMessageId = useMemo(() => {
    for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
      if (visibleMessages[index].role === 'assistant') return visibleMessages[index].id;
    }
    return null;
  }, [visibleMessages]);
  const messageRows = useMemo(
    () => mapChatMessageRows(visibleMessages, (message) => (
      /* 官方 `Bit` 的每行外壳：`flex flex-col gap-4 transition-opacity duration-300`，
         并且**只有用户消息**带 `data-query-locator-anchor-id`（`YM` @2618242）——
         右缘那条 Query 导航轨（`QueryLocator` / 官方 `Lit`）就是靠它取 `offsetTop` 的。 */
      <div
        key={message.id}
        data-chat-message-id={message.id}
        {...(message.role === 'user' ? { 'data-query-locator-anchor-id': message.id } : {})}
        className="flex flex-col gap-4 transition-opacity duration-300"
      >
      <MessageErrorBoundary messageId={message.id}>
      <MessageBubble
        message={message}
        agentTask={message.agentTaskId ? agentTaskById.get(message.agentTaskId) : undefined}
        isLastAssistantMessage={message.id === lastAssistantMessageId}
        onAddToCanvas={onAddMediaToCanvas}
        onRetryMediaSave={onRetryMediaSave}
        onNodeActivate={onNodeActivate}
        onNodeHover={onNodeHover}
        onModelActivate={onModelActivate}
        onFeedback={onMessageFeedback}
        onMessageFork={onMessageFork}
        onRetryMessage={onRetryMessage}
        agentControls={agentControls}
      />
      </MessageErrorBoundary>
      </div>
    )),
    [
      agentControls,
      agentTaskById,
      lastAssistantMessageId,
      onAddMediaToCanvas,
      onRetryMediaSave,
      onMessageFeedback,
      onMessageFork,
      onRetryMessage,
      onModelActivate,
      onNodeActivate,
      onNodeHover,
      visibleMessages,
    ],
  );

  /** 官方 `isLoadingOlder`：转圈行是否可见。 */
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  /** 官方 `q = useMemo(() => Mit(V), [V])`：每个用户消息一个 Query 锚点。 */
  const queryAnchors = useMemo(() => buildQueryAnchors(visibleMessages), [visibleMessages]);

  const loadOlderMessages = useCallback(() => {
    const container = messagesRef.current;
    if (container) {
      pendingOlderScrollRef.current = {
        conversationId,
        height: container.scrollHeight,
        top: container.scrollTop,
      };
    }
    /* 官方 `isLoadingOlder`：展开期间显示 `h-5` 居中的 16px 转圈行。MTV 的展开是同步的，
       这里用一个真实的一帧状态驱动同一段官方 markup（不是伪造数据态，只是让滚动锚点恢复那一帧可见）。 */
    setIsLoadingOlder(true);
    setRenderWindow((current) => ({
      conversationId,
      limit: Math.min(
        messages.length,
        (current.conversationId === conversationId ? renderLimit : INITIAL_MESSAGE_BATCH)
        + MESSAGE_BATCH_SIZE,
      ),
      messageCount: messages.length,
    }));
    /* rAF 在纯 node 测试环境不存在（`typeof` 守卫；否则会抛错打断 `handleScroll`）。 */
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setIsLoadingOlder(false));
    } else {
      setIsLoadingOlder(false);
    }
  }, [conversationId, messages.length, renderLimit]);

  useLayoutEffect(() => {
    if (activeConversationRef.current !== conversationId) {
      activeConversationRef.current = conversationId;
      isNearBottomRef.current = true;
      previousMessagesRef.current = { conversationId, messages };
      pendingOlderScrollRef.current = null;
      setScrollState({ conversationId, isNearBottom: true, unreadCount: 0 });
      setRenderWindow({
        conversationId,
        limit: INITIAL_MESSAGE_BATCH,
        messageCount: messages.length,
      });
      const container = messagesRef.current;
      if (container) container.scrollTop = container.scrollHeight;
      return;
    }
    if (renderWindow.conversationId !== conversationId) {
      pendingOlderScrollRef.current = null;
      return;
    }
    const pending = pendingOlderScrollRef.current;
    const container = messagesRef.current;
    if (!pending || pending.conversationId !== conversationId || !container) return;
    container.scrollTop = pending.top + (container.scrollHeight - pending.height);
    pendingOlderScrollRef.current = null;
  }, [conversationId, messages, renderLimit, renderWindow.conversationId]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nextIsNearBottom = distanceFromBottom < 80;
    const wasNearBottom = isNearBottomRef.current;
    isNearBottomRef.current = nextIsNearBottom;
    setScrollState((current) => ({
      conversationId,
      isNearBottom: nextIsNearBottom,
      unreadCount: nextIsNearBottom
        ? 0
        : current.conversationId === conversationId ? current.unreadCount : 0,
    }));
    /* 官方是**无限滚动自动加载**（`hce` 里没有按钮，只有 `isLoadingOlder` 的转圈行）⇒
       滚到顶部 80px 内自动展开更早的消息（调用点见下方，必须在复位分支之后）。 */
    if (wasNearBottom !== nextIsNearBottom) {
      setRenderWindow({
        conversationId,
        limit: nextIsNearBottom ? INITIAL_MESSAGE_BATCH : renderLimit,
        messageCount: messages.length,
      });
    }
    /* ⚠️ 顺序要紧：上面的「离开底部」分支会把 limit 复位成 `renderLimit`，
       自动加载必须在它**之后**，否则会被覆盖回初始批次。 */
    if (container.scrollTop < 80 && hiddenMessageCount > 0) {
      loadOlderMessages();
    }
  }, [conversationId, messages.length, renderLimit, hiddenMessageCount, loadOlderMessages]);

  const jumpToLatest = useCallback(() => {
    const container = messagesRef.current;
    if (!container) return;
    const previousScrollBehavior = container.style.scrollBehavior;
    container.style.scrollBehavior = 'auto';
    container.scrollTop = container.scrollHeight;
    container.style.scrollBehavior = previousScrollBehavior;
  }, []);

  useEffect(() => {
    const previousSnapshot = previousMessagesRef.current;
    const previousMessages = previousSnapshot.conversationId === conversationId
      ? previousSnapshot.messages
      : [];
    previousMessagesRef.current = { conversationId, messages };

    if (isNearBottomRef.current) {
      jumpToLatest();
      const frameId = requestAnimationFrame(() => {
        jumpToLatest();
      });
      return () => cancelAnimationFrame(frameId);
    }

    const previousIds = new Set(previousMessages.map((message) => message.id));
    const newAssistantMessages = messages.filter(
      (message) => message.role !== 'user' && !previousIds.has(message.id),
    ).length;
    const previousLast = previousMessages[previousMessages.length - 1];
    const currentLast = messages[messages.length - 1];
    const streamedWhileAway = !!currentLast
      && currentLast.role === 'assistant'
      && currentLast.id === previousLast?.id
      && currentLast.content !== previousLast.content;
    if (newAssistantMessages > 0 || streamedWhileAway) {
      setScrollState((current) => {
        const currentUnread = current.conversationId === conversationId
          ? current.unreadCount
          : 0;
        return {
          conversationId,
          isNearBottom: false,
          unreadCount: newAssistantMessages > 0
            ? currentUnread + newAssistantMessages
            : Math.max(1, currentUnread),
        };
      });
    }
    return undefined;
  }, [conversationId, jumpToLatest, messages]);

  const scrollToLatest = useCallback(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
    isNearBottomRef.current = true;
    setScrollState({ conversationId, isNearBottom: true, unreadCount: 0 });
    setRenderWindow({
      conversationId,
      limit: INITIAL_MESSAGE_BATCH,
      messageCount: messages.length,
    });
    requestAnimationFrame(jumpToLatest);
  }, [conversationId, jumpToLatest, messages.length, reduceMotion]);

  useEffect(() => () => {
    onNodeHover?.(null);
  }, [onNodeHover]);

  /** 官方 `hce` ① 外壳 ② 滚动区 ③ 内容 ④ 消息列 —— 四层逐字。 */
  return (
    <div className="chat-panel-messages-shell relative flex flex-1 flex-col min-h-0">
      {/* 官方空态是**消息列表的同级**（不在滚动容器里）：官方 `yle` 自带 `flex min-h-0 flex-1 … px-4`
          + `my-auto` 垂直居中，因此不能塞进 `p-5 pb-0 pr-14` 的滚动内容里。
          官方判据是「会话里没有消息」（新建会话同样如此），不只是「没有会话」。 */}
      {isEmptySession ? (
        <EmptyChatState onExample={onExampleClick} hasInputContent={hasInputContent} />
      ) : (
      /* 官方 `hce` ①：`relative min-h-0 flex-1 text-sm` */
      <div className="relative min-h-0 flex-1 text-sm">
        <div
          ref={messagesRef}
          onScroll={handleScroll}
          /* 官方 ②：`relative h-full flex-1 scrollbar-thin scrollbar-track-transparent
             scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground scrollbar-thumb-rounded`
             （`data-overlay-scrollbar="off"` 是 MTV 的：关掉全局悬浮滑条，只留官方这套原生细条） */
          data-overlay-scrollbar="off"
          className="c-messages chat-panel-messages relative h-full flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground scrollbar-thumb-rounded"
        >
          {/* 官方 ③：`gap-4 p-5 pb-0 pr-14` */}
          <div ref={messagesContentRef} className="gap-4 p-5 pb-0 pr-14">
            {isLoadingOlder && (
              /* 官方「加载更早」= `h-5` 居中的 16px 转圈（不是按钮） */
              <div className="flex h-5 items-center justify-center">
                <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
              </div>
            )}
            {/* 官方 ④：`relative flex flex-col gap-4` */}
            <div className="relative flex flex-col gap-4">
              {messageRows}
              {/* 官方 `compact` `phase:"started"`（§6 #14 后半）：压缩进行中时，官方把
                  `{type:"compact",content:{phase:"started"}}` 追加在消息流**末尾** ⇒ 这里同位置渲染
                  官方 `Tie`(`CompactLifecycleLine`) 的 started 态（「正在自动压缩上下文」+ 计时）。
                  官方判据 `active = phase === "started" && isStreaming` 里的 `isStreaming` 语义是
                  「这一条还在进行中」；MTV 的 `contextCompacting` 本身就是进行中信号 ⇒ 传 `true`。
                  压缩完成后由 `ChatMessage.compactedAt` 在**被折进摘要的最后一条消息**上渲染 finished 态。 */}
              {contextCompacting && (
                <CompactLifecycleLine phase="started" isStreaming />
              )}
              {/* 官方 message-list-bottom-spacer（`page-BeI7xydN.js`@884855 逐字）：
                  高度 = `calc(3rem + max(排队/提问/锁会话 三个 sheet 的高度变量))`，
                  过渡用 `cubic-bezier(0.65,0,0.35,1)`，时长取 `--ask-question-spacer-transition-duration`。
                  作用：sheet 弹出时把消息列表顶上去，而不是盖住最后一条。 */}
              <div
                data-testid="message-list-bottom-spacer"
                className="transition-[height] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
                style={{
                  height:
                    'calc(3rem + max(var(--queued-sheet-height-px, 0px), var(--ask-question-sheet-height-px, 0px), var(--conversation-lock-sheet-height-px, 0px)))',
                  transitionDuration: 'var(--ask-question-spacer-transition-duration, 240ms)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 官方 `Lit`（`query-locator-v2`）：聊天消息列表右缘的 Query 导航轨 + 悬浮预览卡。
          官方挂在 ScrollArea 根这一层（= 上面那个 `relative min-h-0 flex-1 text-sm`），
          所以这里也在同一层、滚动视口之外。 */}
      {!isEmptySession && queryAnchors.length > 0 && (
        <QueryLocator
          anchors={queryAnchors}
          contentRef={messagesContentRef}
          scrollRootRef={messagesRef}
        />
      )}

      {/* 官方 `ga`（`vendor-packages-jvPqKqU8.js` 的 `KR`，在聊天消息列表里以 `Qfe` 渲染）——
          逐字形态：`!isAtBottom && <Button variant="outline" size="icon" type="button"
            className={cx('absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full',
                          cx('z-20', 'bottom-[calc(var(--todo-queue-sheet-height-px,_0px)_+_1rem)]'))}>
            <ArrowDown className="size-4" /></Button>`

          ⇒ 官方是 shadcn `Button`（`variant="outline"` = `border border-input bg-background shadow-sm
             hover:bg-accent hover:text-accent-foreground`，`size="icon"` = `h-9 w-9`，
             基类含 `rounded-md` 但被 `rounded-full` 覆盖）+ **只有一颗 16px 的 lucide `arrow-down`**；
             **没有文字、没有未读数字**。底部偏移用 `--todo-queue-sheet-height-px`（MTV 侧同一语义的
             变量名为 `--queued-sheet-height-px`，见 `ChatPanel` 的上报点）。
          官方没有 `aria-label`（无无障碍名）—— 这里补一个**不渲染成可见像素**的无障碍名，不改变视觉。 */}
      {!isNearBottom && (
        <button
          type="button"
          onClick={scrollToLatest}
          aria-label={unreadCount > 0 ? t('回到最新消息，{count} 条未读', { count: unreadCount }) : t('回到最新消息')}
          className="absolute left-[50%] z-20 inline-flex h-9 w-9 translate-x-[-50%] items-center justify-center gap-2 rounded-full border border-input bg-background text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bottom-[calc(var(--queued-sheet-height-px,_0px)_+_1rem)]"
        >
          <OfficialArrowDownIcon size={16} />
        </button>
      )}
    </div>
  );
}
