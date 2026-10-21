/**
 * MessageBubble — 单条聊天消息
 *
 * 版式 = **官方 TapNow 消息行**（`official-chat.css` 的 `.c-msg*`，出处
 * `page-DVqoHdTT.js` @851377 的 `MessageItem` + `index-CF4eb3PV.css` 的 chat token）：
 *   · 官方 token：`--chat-foreground #d4d4d8`（正文色）· `--chat-bubble-surface #2e2e2e`
 *     （内容卡/用户气泡底）· `--chat-bubble-header #1a1a1a` · `--chat-background #141414`
 *   · 行：官方 `<Row from={role}>` > `<Body data-message-body className="gap-3">`（实测 `gap:12px`）
 *   · 正文色 = `text-chat-foreground`；**官方助手正文没有气泡底**（就是面板底上的正文）
 *   · 动作行：官方 `mt-2 -ml-1.5 flex`，按钮 `rounded-sm h-6 w-6 [&_svg]:size-3.5
 *     text-muted-foreground hover:bg-transparent hover:[&_svg]:text-chat-foreground`
 *     ⇒ 悬停**不加底色**，只把图标提亮
 *   · 时间戳：官方 `h-6 items-center text-xs leading-none text-muted-foreground/80`
 *
 * ⚠️ 与改版前的差别（都是「MTV 自造色/形态」）：
 *   1. 用户气泡靛蓝 15% 底（`indigo` 色族 500/15）⇒ 官方 `--chat-bubble-surface` #2e2e2e
 *   2. 助手气泡 `rounded-2xl border` + MTV `canvas-*` 卡片底 + `backdrop-blur-sm shadow` ⇒ 去掉气泡（官方无）
 *   3. 正文 MTV `canvas-*` 文字色 / `13px` ⇒ 官方 `--chat-foreground` / 14px
 *   4. 动作按钮 `h-7 w-7 rounded-md` + 靛蓝 focus 环 + hover 加底 ⇒ 官方 24×24 / 圆角 6 / 只提亮图标
 *   5. 时间戳 `text-[11px] opacity-60` ⇒ 官方 12px / `muted-foreground/80`
 *   6. 各种 tailwind 状态色（red-400/amber-400/blue-400/green-400）⇒ 官方状态色
 *      #f44336 / #ff9800 / #2196f3 / #4caf50
 * 行为一字未改：复制 / 编辑重发 / 重新生成 / 添加到画布 / 重试落盘 / 引用文本 / 时间线全部保留。
 */
import { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import type { ChatMessage } from '../../types/chat';
import type { AgentTask } from '../../types/agent';
import { type AgentTaskControls } from './AgentTaskTimeline';
import CollapsibleToolSection from './CollapsibleToolSection';
import AgentStepsSection from './AgentStepsSection';
import {
  absorbActivityRuns,
  buildActivitySegmentsFromContents,
  buildMessageContents,
  ensureAgentErrorContent,
  itemsDurationMs,
  type MessageActivitySegment,
} from '../../services/chat/messageContents';
import { resolveAgentErrorMessage } from '../../services/chat/agentErrorMessage';
import { resolveMediaFailureText } from '../../services/chat/mediaErrorMessage';
import { taskStepsToToolEvents } from '../../services/chat/agentActivityItems';
import { isAskQuestionTool } from '../../services/chat/askQuestion';
import AskQuestionSummary from './AskQuestionSummary';
import ConfirmationEventCard from './ConfirmationEventCard';
import { isAutoPreviewCardEvent, isConfirmationCardToolEvent, confirmationAnswerResolution, pendingGenerationConfirmationKey } from './confirmationEventDispatch';
import ShowWidgetLoading from './ShowWidgetLoading';
import StoppedByUserDivider from './StoppedByUserDivider';
import CompactLifecycleLine from './CompactLifecycleLine';
import ShowWidgetCard, { type ShowWidgetCardContent } from './ShowWidgetCard';
import ShowHtmlCard, { type ShowHtmlCardContent } from './ShowHtmlCard';
import { FormCard } from './FormCard';
import ConnectorAuthCard, { type ConnectorAuthCardProps } from './ConnectorAuthCard';
import McpAppCard, { type McpAppCardProps } from './McpAppCard';
import { isConnectorAuthCardEvent } from '../../services/chat/connectorAuthCard';
import { isMcpAppEvent } from '../../services/chat/mcpAppCard';
import { isDesktopConfirmationTool } from '../../services/chat/desktopConfirmationCard';
import { classifyToolEventFamily } from '../../services/chat/agentMessageContents';
import type { ToolEventLike } from '../../services/chat/agentToolLabels';
import type { AgentContentInput } from '../../services/chat/agentContents';
import { useAppStore } from '../../store/useAppStore';
import ChatReferenceText, { type ChatReferenceHandlers } from './ChatReferenceText';
import ChatMarkdown from './ChatMarkdown';
import ThinkingStatusLine from './ThinkingStatusLine';
import ToolLoadingIndicator from './ToolLoadingIndicator';
import MessageThumbRow from './MessageThumbRow';
import { CANVAS_ACTION_CLASS } from './mediaResultClasses';
import CollapsibleUserText from './CollapsibleUserText';
import AgentErrorBanner from './AgentErrorBanner';
import AgentTaskHistoryCard from './AgentTaskHistoryCard';
import NodeLinkChip from './NodeLinkChip';
import MessageTimestamp from './MessageTimestamp';
import {
  OfficialCheckIcon,
  OfficialCopyIcon,
  OfficialForkIcon,
  OfficialThumbsDownIcon,
  OfficialThumbsUpIcon,
} from './officialIcons';
import WebSearchSourceDisplay from './WebSearchSourceDisplay';
import { PinnedWebSearchSources } from './WebSearchQueryResultGroups';
import { hasSourceCitation } from '../../services/chat/webSourceDisplay';
import { useT } from '../../i18n';
/** 官方 `$M` 里 `mre` 的 `onSendPrompt` 兜底（@2426950 邻域逐字）：
 *  `onSendPrompt: c ?? (async () => { throw new Error("Widget prompt handler unavailable") })`。
 *  MTV 没有 widget host 的上行通道 ⇒ 与官方一样落到这个**会抛错**的兜底（不静默吞掉）。 */
const WIDGET_PROMPT_UNAVAILABLE = async (): Promise<never> => {
  throw new Error('Widget prompt handler unavailable');
};

/** 一条消息里**全部**工具项（官方 `RE`/`Zrt` 的入参口径：这些 item 的 `min(startedAt)..max(endedAt)`）。
 *  分段里的 `tools` 段是唯一来源；`cards`/`text`/`thinking`/`compact` 不是「操作」（官方 `wV` 先
 *  `filter(r=>!g0(r)&&!SL(r,t))` 把卡片剔掉，再 `RE`）⇒ 这里同样只取工具段。 */
function messageToolItems(segments: readonly MessageActivitySegment[]): ToolEventLike[] {
  return segments
    .flatMap((segment) => (segment.kind === 'tools'
      ? segment.blocks.flatMap((block) => (block.kind === 'items'
        ? [...(block.items ?? [])]
        : [block.agent, ...(block.children ?? [])]))
      : []))
    .filter(Boolean) as ToolEventLike[];
}

interface MessageBubbleProps extends ChatReferenceHandlers {
  message: ChatMessage;
  agentTask?: AgentTask;
  onAddToCanvas?: (messageId: string) => void;
  /** 产物落盘失败时重试保存；未传入则不展示重试入口。 */
  onRetryMediaSave?: (messageId: string) => Promise<void>;
  /* 官方操作栏只有 copy / fork / 👍 / 👎；「编辑重发 / 再次生成」官方 0 命中 ⇒ 相关 props
     （onEditMessage / regeneratePrompt / onRegenerate）已删除。 */
  agentControls?: AgentTaskControls;
  /** 官方 `onMessageFeedback(messageId, 'up' | 'down')`：**可选**（官方也是 `h?.(…)`）。 */
  onFeedback?: (messageId: string, vote: 'up' | 'down') => void;
  /** 官方 `onMessageFork(messageId)`：**可选** —— 未提供时不渲染 fork 钮（对应官方 `canFork` 开关）。 */
  onMessageFork?: (messageId: string) => void;
  /** 官方 `qae`(`AgentErrorBanner`) 的 `onRetry`：重跑这一轮失败的请求。 */
  onRetryMessage?: (messageId: string) => void;
  /** 官方 `MessageItem.isLastAssistantMessage`（`r`）：只有最后一条 assistant 才有完整动作条/占位。 */
  isLastAssistantMessage?: boolean;
  /** 官方 `MessageItem.suppressActions`（`g`，默认 false）：整体抑制动作条。 */
  suppressActions?: boolean;
}

/** 动作按钮（官方 `rounded-sm h-6 w-6 [&_svg]:size-3.5` + hover 只提亮图标）
 *  官方按下动画：`animate={{scale:1}} initial={{scale:.85}}`
 *  `transition={{type:'spring',stiffness:400,damping:25}} whileTap={{scale:.9}}`。
 *  ⚠️ 必须 `inline-flex items-center justify-center`：官方按钮是 24×24 的 icon 钮、图标 14px 居中，
 *     配合行的 `-ml-1.5`(-6px) 才让**图标字形**与正文左边缘对齐（实测：不居中会偏 6px）。 */
function MessageAction({
  label,
  tooltip,
  renderIcon,
  onClick,
  disabled,
  copied = false,
}: {
  label: string;
  tooltip?: string;
  renderIcon: (className: string) => React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** 官方 copied 态图标用 `text-chat-foreground`，否则 `text-muted-foreground`。 */
  copied?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      data-tooltip={tooltip ?? label}
      className="inline-flex items-center justify-center rounded-sm cursor-pointer hover:bg-transparent hover:[&_svg]:text-chat-foreground h-6 w-6 [&_svg]:size-3.5"
    >
      {/* 官方按下动画包在**图标**外面（不是按钮）：
          `<motion.span animate={{scale:1}} initial={{scale:.85}}
            transition={{type:'spring',stiffness:400,damping:25}} whileTap={{scale:.9}}
            className="inline-flex">`。 */}
      <MotionIconFrame>
        {renderIcon(copied ? 'text-chat-foreground transition-colors' : 'text-muted-foreground transition-colors')}
      </MotionIconFrame>
    </button>
  );
}

/** 官方操作钮里的图标按下动画外壳（`motion.span`，spring 400/25 + `whileTap 0.9`）。 */
function MotionIconFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.span
      animate={{ scale: 1 }}
      initial={{ scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      whileTap={{ scale: 0.9 }}
      className="inline-flex"
    >
      {children}
    </motion.span>
  );
}

/** 官方 👍/👎（`chatAdapter.feedback.thumbsUp/thumbsDown`，图标 = tabler thumbs-up / thumbs-down）：
 *  选中态 `text-chat-foreground` + `fill="currentColor"`，未选 `text-muted-foreground`；
 *  👎 图标多一个 `translate-y-px`。 */
function FeedbackAction({
  kind,
  active,
  label,
  onToggle,
}: {
  kind: 'up' | 'down';
  active: boolean;
  label: string;
  onToggle: () => void;
}) {
  const className = [
    kind === 'down' ? 'translate-y-px' : '',
    active ? 'text-chat-foreground' : 'text-muted-foreground',
    'transition-colors',
  ].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={label}
      className="inline-flex items-center justify-center rounded-sm cursor-pointer hover:bg-transparent hover:[&_svg]:text-chat-foreground h-6 w-6 [&_svg]:size-3.5"
    >
      <MotionIconFrame>
        {kind === 'up'
          ? <OfficialThumbsUpIcon size={14} strokeWidth={1.5} fill={active ? 'currentColor' : undefined} className={className} />
          : <OfficialThumbsDownIcon size={14} strokeWidth={1.5} fill={active ? 'currentColor' : undefined} className={className} />}
      </MotionIconFrame>
    </button>
  );
}

function MessageBubble({
  message,
  agentTask,
  onAddToCanvas,
  onRetryMediaSave,
  onNodeActivate,
  onNodeHover,
  onModelActivate,
  /* 官方 `lae`/`_le` 的消息体**确实**接任务控制台：确认卡的 `onAnswer`（= 会话的
     `answerConfirmation`）就是从这一层透传下去的（@2639873 `onAnswerConfirmation:l` →
     @2458469 `s.jsx(pot,{…,onAnswer:l,…})`）。round 111 起这里只接 `onResolveApproval`
     这一项（确认卡上行），其余任务控制仍留在 `AgentTaskTimeline`。 */
  agentControls,
  onFeedback,
  onMessageFork,
  onRetryMessage,
  isLastAssistantMessage = false,
  suppressActions = false,
}: MessageBubbleProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  /** 官方 `v`：点赞/点踩本地态（`'up' | 'down' | null`，可反复切换）。 */
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  /** 官方 `Me`/`Ce` 的可见性由 hover 驱动 ⇒ 时间戳 hover 才撑开。 */
  const [actionsVisible, setActionsVisible] = useState(false);

  const toggleVote = useCallback((next: 'up' | 'down') => {
    setVote((current) => {
      const value = current === next ? null : next;
      /* 官方：`next && (track('like'|'dislike'), onFeedback?.(id, value))` —— 回调可选。 */
      if (value) onFeedback?.(message.id, value);
      return value;
    });
  }, [message.id, onFeedback]);

  const [savingMedia, setSavingMedia] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  /* 官方 `kh` 需要一个任务下的全部子任务（`parentTaskId`）来渲染子代理行 ⇒ hook 必须在 early return 之前。 */
  const agentChildTasks = useAppStore((state) => state.agentTasks);
  /** 官方 `session.thinkingActivity`（驱动状态行是「思考中…」还是随机四档）。 */
  const chatThinkingActivity = useAppStore((state) => state.chatThinkingActivity);
  /** 官方 `MessageItem` 选择器里的 `S.pendingQuestion`（`C = S.pendingQuestion?.status==="pending"`，
   *  @2652726 邻域逐字）—— 模式串门控 `he` 的**唯一**在 MTV 有真实来源的会话态因子。
   *  ⚠️ 必须在 `isSystem` 的 early return **之前**订阅（hooks 顺序）。 */
  const pendingQuestion = useAppStore((state) => state.pendingQuestion);
  /** 官方 `S = Fe(os)` 取的是 **`getSessionState(activeSessionId)`** ⇒ 会话作用域**隐含在 store 形状里**。
   *  MTV 的 `pendingQuestion` 是**全局字段 + `conversationId` 戳**（见 `types/chat.ts` 的
   * `PendingAskQuestion.conversationId` 记账）⇒ 忠实翻译必须**显式比较该戳**，否则 A 会话待答时
   * B 会话的末条 assistant 也会被判成「等用户作答」。MTV 其它两个消费者就是这么做的：
   * `ChatPanel.tsx:1205-1208`、`AskQuestionSummary.tsx:113`。 */
  const activeConversationId = useAppStore((state) => state.activeConversationId);

  /* 官方 `XA` 的 `!w-full` 判据：消息里带了「非纯文本」的块。MTV 等价物见下。 */
  const hasRichContent = !!agentTask
    || (message.attachments?.length ?? 0) > 0
    || !!message.mediaResult
    || (message.executionResults?.length ?? 0) > 0;

  if (isSystem) {
    return (
      <div className="chat-message-bubble chat-message-system c-msg c-msg--assistant justify-center">
        <span className="c-msg__system">{message.content}</span>
      </div>
    );
  }

  const mediaResult = message.mediaResult;
  /* ⚠️ 2026 用户口径（官方全流程截图）：官方消息里**没有内联媒体块**
     （`c-msg__media` / `media-caption` 在官方 bundle 均 0 命中）——
     消息 = 处理步骤组 + 生成卡片 + 文本(带 mention chip)，图/视频/音频落在画布节点上。
     ⇒ 这里只保留「生成中」「未保存」这类状态行，不再内联渲染媒体本身。 */
  const isGenerating = message.mediaStatus === 'queued' || message.mediaStatus === 'generating';
  /** 官方 `$M` 的 `t`（`isStreaming`）：`show_widget` / 普通工具行的 loading 分支都读它。 */
  const streamingNow = message.status === 'streaming' || isGenerating;
  // 生成成功 ≠ 已保存到项目：落盘失败时 url 只是临时地址，重启后会失效
  const mediaUnsaved = !isGenerating && mediaResult?.persistence === 'failed';
  /* 官方 `lae` 的 `t1e(F)`：**已经有可见内容**（有可折叠工具块 / 非空正文 / 任何非 text 项）。
     状态行的条件（官方 `K`）是「还在流式 **且** 什么都还没渲染出来」：
     ```js
     t1e = F => F.some(t => t.kind === "collapsible" ? t.items.some(Ug)
                              : t.item.type === "text" ? (t.item.content ?? "").trim().length > 0 : true);
     K = n(isStreaming) && !t1e(F);
     ```
     ⚠️ MTV 原来在这条判据上多加了一道 `!showTimeline`，而 `showTimeline` 在 `agentTask`
     一建好（`status !== 'completed'`、`steps` 还是 0）就为 true ⇒ 状态行被压掉、而那时又没有任何
     item 可渲染 ⇒ **整行空白**（用户实测：发送后没有「整理中…」也没有前面的动图）。
     现在按官方改成看 `activitySegments`（= 渲染层的「有没有东西」），`isThinking` 的计算点下移到分段之后。 */
  /* ══ 官方**有序 `contents: Item[]`**（覆盖表 §6 #1）═════════════════════════════
     官方消息模型是 `{contents: Item[]}`，渲染层 `Z0`/`$M` **按数组顺序逐项分派**：
       · 命中卡片族的 item（`ask_question` / `generation_confirmation` /
         `node_update_confirmation` / 自动模式预览卡 / `show_widget` / `show_html` /
         `show_form` / `get_connector_status` / mcpApp）各自渲染成一张卡；
       · 其余 `tool_event` 与 `subagent` 交给 `kh`(`CollapsibleToolSection`) 的连续分桶；
       · `compact` → `Tie`(`CompactLifecycleLine`)。
     生产者/分段器都在 `services/chat/messageContents.ts`（模型层、可单测）：
       · `isCardToolItem(item)` —— 官方 `$M` 各分支的「自成一张卡」判据合集；
       · `buildMessageContents(...)` —— 官方有序 item 列表（`ChatMessage.contents` 的缺省回落）；
       · `buildActivitySegmentsFromContents(...)` —— 按列表顺序分桶，**不再排序**。
     用户可见差异（改版前恒为「活动区 → 提问 → 确认 → widget → 表单 → 连接器 → mcpApp」）：
     agent 中途弹了表单卡再继续跑工具时，MTV 会把表单卡排到**全部工具行之后**。 */
  const agentChildTasksOfTask = agentTask
    ? agentChildTasks.filter((task) => task.parentTaskId === agentTask.id)
    : [];
  /* 官方 `lae` 的 `ge`：正文里引用了来源 ⇒ 来源卡要显示编号（`showCardIndex`）。 */
  const showSourceCardIndex = !isUser
    && !!message.sources?.length
    && hasSourceCitation(message.content ?? '', message.sources);
  /* 官方 `RF`(`PinnedWebSearchSources`) 的数据源（`cot(items)` = 已发布的联网来源）；
     MTV 的等价数据是 `message.sources`。官方 `RF` 只有**两个**挂载点（本 bundle 全命中）：
     ① `AC`(`CollapsibleToolSection`) 的折叠分支；② 消息级吸收分支里 `FF` 之后。
     两处的「已结算 + 后面还有内容」前提由折叠/吸收条件本身保证。 */
  const pinnedSources = message.sources ?? [];
  /* 官方 `lae` 的 `R`/`F` 计算（`activitySegments`）—— 见下。 */
  /* ── 官方「Agent 错误文案」的**唯一**解析点（`Jct` @2713029 的移植，见 `agentErrorMessage.ts`）──
     · 有真实报错文本 ⇒ **原样**使用（官方 `e.message?.trim() ? e.message : …`）；
     · 没有 ⇒ 官方 i18n 兜底（`chatAdapter.errors.agentErrorFallback` 等，MTV 以中文原文为 key）。
     ⚠️ 官方**从来不加**「处理失败:」这类前缀；MTV 原来在 controller 里把前缀写进 `content`，
     渲染成正文那第二行 —— 那条路径已删除（见 `conversationExecutionController`）。
     ⚠️ 只用 `message.agentError` / `agentTask.errorMessage`，**不**读 `mediaError`：
     `message.mediaError` 属于媒体那条链（走 `resolveMediaFailureText` 的官方 tool-event 文案族，
     见下面的媒体行），与 Agent 报错不是一回事。 */
  const agentErrorMessage = (() => {
    const explicit = message.agentError?.trim() || agentTask?.errorMessage?.trim();
    /* 官方 `Jct` 的调用点只在**错误事件到达时**执行 ⇒ MTV 的等价触发信号 = 本条消息进入 `error` 态
       （或它的 agent 任务失败）。`status` 只是「要不要去解析文案」的门控，
       **不是**渲染门控 —— 渲染完全由 `contents` 里有没有 `agent_error` item 决定。 */
    const errored = message.status === 'error' || agentTask?.status === 'failed';
    if (!errored && !explicit) return undefined;
    return resolveAgentErrorMessage({ message: explicit }, t);
  })();
  const baseContents = message.contents && message.contents.length > 0
    ? message.contents
    : buildMessageContents({
      content: message.content,
      timestamp: message.timestamp,
      /* 中途正文 item（流式落库）：官方按到达顺序把每段正文当成独立 `text` item，
         这样「工具事件之间的说明」才会出现在折叠面板里（官方 `absorbTextInRange`）。 */
      textItems: message.textItems,
      /* 思考 item（官方 `thinking`）——与 `textItems` **并列**，不是同一份数据。 */
      thinkingItems: message.thinkingItems,
      compactedAt: message.compactedAt,
      agentTask,
      childTasks: agentChildTasksOfTask,
      errorMessage: agentErrorMessage,
    });
  /* `message.contents` 非空时是**完全接管**语义 ⇒ 官方 `appendMessageContent`（@41087）那条「追加」
     必须在这里再补一次（幂等；列表里已有 `agent_error` 就不再追加）。 */
  const orderedContents = ensureAgentErrorContent(baseContents, agentErrorMessage);
  const activitySegments = buildActivitySegmentsFromContents(orderedContents, {
    childTasks: agentChildTasksOfTask,
    childItemsOf: taskStepsToToolEvents,
  });
  /* `contents` 里存在正文 item ⇒ 正文由分段渲染就地渲染（见下面的 `text` 段分支）。 */
  const hasTextSegment = activitySegments.some((segment) => segment.kind === 'text');
  /* 官方 `lae` 的 `O`：消息级「步骤吸收」——决定折叠摘要 `vS`(`AgentStepsSection`) 包住哪几段
     （含被吸收的**中途正文**）。见 `messageContents.absorbActivityRuns` 的逐字转写。
     ⚠️ 官方那句 `if (n) return []`（`n` = isStreaming，@2608540）⇒ 流式期间**不吸收**：
     工具行/操作行平铺（`正在进行 N 个操作`），收尾后才折进「处理了 Xs」。这里传的就是
     同一份 `isStreaming`（与下面 `CollapsibleToolSection.isStreaming` 的表达式一致）。 */
  const absorbedRuns = absorbActivityRuns(activitySegments, { isStreaming: streamingNow });
  /* 官方 `K`：还在流式 **且** 什么都还没渲染出来（`!t1e(F)`）⇒ 出状态行
     （`[动图 logo] 思考中/处理中/整理中… + · 秒数`）。`activeToolName`（工具行 loading）优先级更高。 */
  const isThinking = !isUser
    && !message.content
    && !isGenerating
    && activitySegments.length === 0
    && ['queued', 'parsing', 'streaming'].includes(message.status);


  /** 逐项分派（官方 `$M` 的每个 `if` 分支，条件逐字保留）。 */
  const renderCardToolItem = (item: ToolEventLike, key: string) => {
    const content = (item.content ?? {}) as Record<string, unknown>;
    const tool = String(content.tool ?? '');
    const status = String(content.status ?? '');
    /** 卡片的上行通道（`ConfirmationEventCard` 的 `onAnswer`）—— 三个卡族分支共用同一份。 */
    const cardAnswer = (confirmationId: string, action: 'confirm' | 'reject', payload?: unknown) => {
      const resolve = agentControls?.onResolveApproval;
      if (!resolve) return;
      resolve(confirmationId, confirmationAnswerResolution(action, payload, content));
    };
    /* ① `ask_question` → `Moe`(`AskQuestionSummary`)；`pending` 时组件内部返回 null。 */
    if (isAskQuestionTool(tool)) {
      return <AskQuestionSummary key={key} content={item.content} />;
    }
    /* ② `dg`→`generation_confirmation` / `iT`→`node_update_confirmation` / 自动模式预览卡。
       round 111：官方这里把 `onAnswer: l`（= 会话的 `answerConfirmation`）**一起传进卡片**
       （`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @2458469：
       `if (Eg(e)) return s.jsx(pot, { content: e.content, onAnswer: l, generationFailedMap: h });`
       `if (TE(e)) return s.jsx(Zot, { content: e.content, onAnswer: l });`）。
       MTV 的等价上行 = `agentControls.onResolveApproval`（→ `resolveAgentApproval`）。
       此前这里 `onAnswer` 缺省 ⇒ `ConfirmationEventCard` 退化成派发 `chat-confirmation-answer`
       window 事件，而**全仓没有任何监听者** ⇒ 点「确认」毫无反应、代理也不会继续（用户实测
       「下了指令没有确认/没后续」）。 */
    if (isConfirmationCardToolEvent(tool) || isAutoPreviewCardEvent(content)) {
      return (
        <ConfirmationEventCard
          key={key}
          content={content}
          onNodeActivate={onNodeActivate}
          onAnswer={cardAnswer}
        />
      );
    }
    /**
     * ②b **`kD`/`pL` → `$Qe`(`DesktopConfirmationCard`)**（round 120 补的接线）。
     *
     * 官方原文（dump `D:\DEEPSEEK\live-assets-r100\`，`vendor-pkg-canvas-DuoOicPr.js`
     * `$M` 渲染器 @2458469 邻域逐字）：
     * ```js
     * if(pL(e)) return s.jsx(ret,{content:e.content,onAnswer:l});
     * ```
     * `pL` @449167 = `yEe.has(xl(e))`，`yEe` @447426 =
     * `new Set(["desktop_open_app_confirmation","desktop_capture_screen_confirmation",
     *           "desktop_fs_confirmation","desktop_shell_command_confirmation",
     *           "batch_download_files_confirmation"])`。
     *
     * ⚠️ 这里此前**没有**这条分支（`renderCardToolItem` 直接落到末尾 `return null`）：
     * 那时该族进的是 `tools` 段 ⇒ 退化成普通工具行（还能看见）；
     * 而 round 120 把该族按官方归进 `cards` 段后，**若不同时补这条分支，卡会在消息流里彻底消失**。
     * `ConfirmationEventCard` 内部已按 `isDesktopConfirmationTool` 分发到 `DesktopConfirmationCard`。
     */
    if (isDesktopConfirmationTool(tool)) {
      return (
        <ConfirmationEventCard
          key={key}
          content={content}
          onNodeActivate={onNodeActivate}
          onAnswer={cardAnswer}
        />
      );
    }
    const family = classifyToolEventFamily(item as unknown as AgentContentInput);
    /* ③ widget 族：`aT`(show_widget) → `fre`/`mre`；`lT`(show_html) → `ure`（`MD` 恒 null）。 */
    if (family === 'show_widget') {
      const request = (content.request ?? {}) as Record<string, unknown>;
      if ((status === 'pending' || status === 'started') && streamingNow) {
        return (
          <ShowWidgetLoading
            key={key}
            title={typeof request.title === 'string' ? request.title : undefined}
            messages={Array.isArray(request.loading_messages) ? (request.loading_messages as string[]) : undefined}
          />
        );
      }
      if (status === 'completed') {
        return (
          <ShowWidgetCard
            key={key}
            content={content as unknown as ShowWidgetCardContent}
            onSendPrompt={WIDGET_PROMPT_UNAVAILABLE}
          />
        );
      }
      return null;
    }
    if (family === 'show_html') {
      return status !== 'completed' ? null : (
        <ShowHtmlCard key={key} content={content as unknown as ShowHtmlCardContent} />
      );
    }
    /* ④ `jD`(show_form)：`(pending|started)&&isStreaming` ⇒ `HM`；`completed` ⇒ `ase`；其余 null。 */
    if (family === 'show_form') {
      if ((status === 'pending' || status === 'started') && streamingNow) {
        return <ToolLoadingIndicator key={key} toolName="show_form" />;
      }
      if (status !== 'completed') return null;
      return <FormCard key={key} content={content} isLoading={streamingNow} />;
    }
    /* ⑤ `ID`(get_connector_status)：只有 `completed` 才渲染 `Loe`(`ConnectorAuthCard`)。 */
    if (isConnectorAuthCardEvent(item as unknown as Record<string, unknown>)) {
      if (status !== 'completed') return null;
      return <ConnectorAuthCard key={key} content={content as unknown as ConnectorAuthCardProps['content']} />;
    }
    /* ⑥ `AD`(mcpApp)：`completed` 才渲染 `nre`(`McpAppCard`)。 */
    if (isMcpAppEvent(item as unknown as Record<string, unknown>)) {
      if (status !== 'completed') return null;
      const ui = (content.ui ?? {}) as Record<string, unknown>;
      return (
        <McpAppCard
          key={key}
          content={content as unknown as McpAppCardProps['content']}
          /* 官方：`collapseOnSendMessage: T.ui?.resource_uri === "ui://tapnow/animatic@v2"` */
          collapseOnSendMessage={ui.resource_uri === 'ui://tapnow/animatic@v2'}
        />
      );
    }
    return null;
  };

  /** 官方 `vS` 的 `durationMs`：任务耗时（`completedAt - startedAt`，缺任一则为 null ⇒ 摘要只显示「已处理」）。 */
  const taskDurationMs = (() => {
    const startedAt = agentTask?.startedAt;
    const completedAt = agentTask?.completedAt;
    if (typeof startedAt !== 'number' || typeof completedAt !== 'number') return null;
    const span = completedAt - startedAt;
    /* ⚠️ `0` 必须当「没有」：官方 `c1e(ms)`（本仓 `formatWorkDuration`）对 `<= 0` 返回空串 ⇒ 摘要退化成
       「已处理」而不是「处理了 0s」。`completedAt === startedAt` 在「任务先建好、同一毫秒内收尾」
       （或 `startedAt` 被归档数据写成了收尾时刻）的记录上真的会出现 —— 用户实测「有时只剩『已处理』」
       就是这条：`??` 把 0 当有效值，把后面按 `RE` 算出的真实区间时长挡掉了。 */
    return span > 0 ? span : null;
  })();
  /* 官方 `RE`/`Zrt`（`vendor-pkg-canvas-CvbAwZyy.js` @2469469 / @2469702）：区间自身时长 =
   * **这一批 item 的 `min(startedAt)..max(endedAt)`**，与任务记录无关。
   * 这里是第三层兜底（任务记录被裁剪 / 从历史恢复、且吸收区间里恰好没有带齐两端时间戳的项时）。 */
  const activityDurationMs = itemsDurationMs(messageToolItems(activitySegments));
  /* 官方 `Z0` 分派：`tool_event` 且状态是 `started/in_progress` 时渲染 `J0`(`ToolLoadingIndicator`)
     —— 优先级高于思考行（同一个消息体里两类 item 互斥：要么在思考、要么在跑工具）。 */
  const activeToolName = !isUser
    ? (() => {
        const steps = agentTask?.steps ?? [];
        for (let index = steps.length - 1; index >= 0; index -= 1) {
          const step = steps[index];
          if (step.status === 'running' && step.toolCall?.toolId) return step.toolCall.toolId;
        }
        return null;
      })()
    : null;
  /* 官方 `Z0` 的用户消息拆分：`/^> ([\s\S]+?)\n\n([\s\S]*)$/` ⇒ 引用段 + 正文。 */
  const userQuoteMatch = isUser ? /^> ([\s\S]+?)\n\n([\s\S]*)$/.exec(message.content) : null;
  const userQuotedPart = userQuoteMatch?.[1] ?? null;
  const userBodyText = userQuoteMatch ? userQuoteMatch[2] : message.content;
  const retryMediaSave = async () => {
    if (!onRetryMediaSave || savingMedia) return;
    setSavingMedia(true);
    try {
      await onRetryMediaSave(message.id);
    } finally {
      setSavingMedia(false);
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      /* 官方 copied 态复位延时 = 2000ms（`copied` 徽标的时长，逐字见官方消息动作条）。 */
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  /* 官方 `onMessageFork(messageId)`：MTV 没有服务端 fork ⇒ 走同一条链路里的宿主回调，
     未提供时派发 `chat-fork-message` 事件（与 `chat-focus-composer` 等同约定），钮本身始终渲染。
     注意：这里是普通函数不是 hook —— `copyMessage` 同样在 `isSystem` 提前 return 之后定义。 */
  const forkMessage = () => {
    if (onMessageFork) {
      onMessageFork(message.id);
      return;
    }
    window.dispatchEvent(new CustomEvent('chat-fork-message', { detail: { messageId: message.id } }));
  };

  /* 官方 copy 钮（`qe`）：类串与图标色见 `MessageAction`；`copied` 时换 `check` 图标。 */
  const copyAction = (
    <MessageAction
      label={copied ? t('消息已复制') : t('复制消息')}
      tooltip={copied ? t('已复制') : t('复制')}
      copied={copied}
      renderIcon={(cls) => (copied
        ? <OfficialCheckIcon size={14} strokeWidth={1.5} className={cls} />
        : <OfficialCopyIcon size={14} strokeWidth={1.5} className={cls} />)}
      onClick={() => void copyMessage()}
    />
  );

  return (
    <div
      className={`chat-message-bubble c-msg group ${isUser ? 'c-msg--user chat-message-user' : 'c-msg--assistant chat-message-assistant'}`}
      onPointerEnter={() => setActionsVisible(true)}
      onPointerLeave={() => setActionsVisible(false)}
    >
      {/* 官方消息壳**没有头像**（ground truth §6.1：Message 只有 `group flex w-full max-w-[95%] flex-col gap-2`
          + user 的 `ml-auto justify-end`）⇒ MTV 原有的 20px 助手头像已移除。
          官方结构：row（列）里 = MessageContent → MessageActions（copy/fork/👍/👎 + 时间戳）。
          ⇒ MTV 原来把时间戳当 row 的兄弟节点、把操作栏塞进内容里，现在按官方挪到内容之后同一行。 */}

      {/* 官方 `XA`(Body) 的类串是 `V("gap-3", (有工具卡/附件/引用等) && "!w-full")`
          —— 无附加内容时走 CSS 里的 `gap: 8px`（`gap-2`），**有附加内容时 gap 变 12px 且撑满整宽**。
          MTV 的等价判据：有 Agent 任务时间线、附件、媒体产物、指令/执行结果。 */}
      <div
        className={`c-msg__content chat-message-content ${isUser ? 'c-msg__bubble' : 'c-msg__plain'} ${
          hasRichContent ? 'c-msg__content--rich' : ''
        }`}
      >
        {activeToolName ? (
          /* 官方 `J0`（`ToolLoadingIndicator`）：转圈/专属图标 + ShimmerText 工具文案。 */
          <ToolLoadingIndicator toolName={activeToolName} />
        ) : isThinking ? (
          /* 官方思考行 = `ah`(`ThinkingIndicator`) → `P_`(`ThinkingStatusLine`)：
             `<output>` + 动图 `/agent-motion/motion-thinking.webp` + 「思考中...」+ `· mm:ss`。
             ⚠️ 这里原来是 MTV 自造的「正在分析请求」+ lucide loader-2 转圈（官方没有）。 */
          <ThinkingStatusLine
            streamState={message.status === 'streaming' ? 'streaming' : 'thinking'}
            /* 官方 `<IC streamState={o} thinkingActivity={G} startedAtMs={e.responseStartedAt}/>`：
               `G = session.thinkingActivity ?? null` ⇒ `'thinking'` 时文案是**思考中…**
               （否则随机四档）。见 `agentRoundExecutor` 里 `te()`/`Q()` 的等价实现。 */
            thinkingActivity={chatThinkingActivity}
            startedAtMs={message.timestamp}
          />
        ) : null}

        {/* 官方 `Z0` 的 `context_nodes` 分支 → `bS`(`MessageThumbRow`)：
            消息里引用的画布节点与附件各出一块 48×48 缩略块（`DL` / `BP`），点击节点 `fitView`。
            ⚠️ **必须排在正文之前**：官方用户消息构造器 `XXe`（`vendor-pkg-canvas-D-XuoEJY.js`
            @2130909 邻域，逐字）
            ```js
            XXe = ({brainstormPrefix:e="",contextNodeIds:t,quotedText:n="",rawInput:o,sourceInput:r}) => {
              const l = …, c = [];
              t.length>0 && c.push({type:"context_nodes",content:{node_ids:t}});   // ← 先缩略项
              c.push({type:"text",content:l});                                     // ← 后正文
              return c }
            ```
            而 `$M` 按 `contents` 顺序逐项渲染 ⇒ 缩略行在**上**、正文在**下**。
            MTV 原来渲染成「正文在上、缩略行在下」（用户截图指出，与官方相反）。 */}
        <MessageThumbRow
          nodeIds={message.contextNodeIds}
          attachments={message.attachments}
          onNodeActivate={onNodeActivate}
        />

        {message.content && (isUser ? (
          /* 官方 `Z0`：用户消息先按 `/^> ([\s\S]+?)\n\n([\s\S]*)$/` 拆出「引用段 + 正文」，
             再交给 `ML`(`CollapsibleUserText`) 渲染（引用段是灰底小块，正文超 6 行自动钳 + 「展开/收起」）。 */
          <CollapsibleUserText
            quotedPart={userQuotedPart}
            bodyText={userBodyText}
            attachmentKey={`${message.attachments?.length ?? 0}`}
          >
            <ChatReferenceText
              value={userBodyText}
              compact
              onNodeActivate={onNodeActivate}
              onNodeHover={onNodeHover}
              onModelActivate={onModelActivate}
            />
          </CollapsibleUserText>
        ) : (
          /* 助手正文：官方 `$M` 按 `contents` 顺序渲染 —— 正文本身就是列表里的一个 `text` item
             ⇒ 它由下面的「分段渲染」在**正确位置**就地渲染（折叠摘要行在正文之前时就在上面）。
             这里只在**没有** text 段时兜底（`contents` 缺省且没有任何工具事件的历史消息）。 */
          hasTextSegment ? null : (
            <div className="min-w-0">
              <ChatMarkdown
                value={message.content}
                onNodeActivate={onNodeActivate}
                onNodeHover={onNodeHover}
                onModelActivate={onModelActivate}
              />
            </div>
          )
        ))}

        {/* ══ 官方**有序 `contents`** 的渲染层落点（§6 #1）══
            逐段渲染：工具段 → 官方 `kh`(`CollapsibleToolSection`)；卡片段 → 逐项走
            `renderCardToolItem`（官方 `$M` 的每个分支）。顺序 = `activitySegments` 的顺序。 */}
        {activitySegments.map((segment, index) => {
          /* 官方 `lae` 的渲染分支顺序（逐字）：先判「本段是否落在某个吸收区间里」——
             落在里面时**只在区间起点渲染一次**（`if (le !== xe) return null`），
             整段包进 `FF`(`AgentStepsSection`)。 */
          const absorbedRun = absorbedRuns.find((run) => (
            index >= run.absorbFrom && index <= run.lastAbsorbable
          ));
          if (absorbedRun) {
            if (index !== absorbedRun.absorbFrom) return null;
            const runSegments = activitySegments.slice(absorbedRun.absorbFrom, absorbedRun.lastAbsorbable + 1);
            /* round 118（用户 2026-10-15 追加裁决）：这一节里若有**待决**的生成确认卡 ⇒ 自动展开
               （MTV 自有增强；规则见 `AgentStepsSection.pendingConfirmationKey`）。
               ⚠️ 同处那条「round 118 实测更正」也适用：确认卡是独立 `cards` 段，本分支的
               `runSegments` 只含 `tools`/`text`/`thinking` ⇒ 这里是**不变量守卫**。 */
            const runPendingKey = pendingGenerationConfirmationKey(
              runSegments.flatMap((s) => (s.kind === 'tools'
                ? s.blocks.flatMap((b) => (b.kind === 'items'
                  ? [...(b.items ?? [])]
                  : [b.agent, ...(b.children ?? [])]))
                : [])).filter(Boolean) as ToolEventLike[],
            );
            return (
              <div key={`agent-steps-${index}`} className="flex w-full min-w-0 flex-col gap-1.5">
                {/* 官方 `FF`：`durationMs = O.length===1 && k!==null ? k : 区间自身时长`。
                    三层口径（官方 @2661289 的 `EO` / @2469702 `Zrt`）：任务耗时 → 吸收区间
                    `min(startedAt)..max(endedAt)` → 整条消息工具项的同一口径。 */}
                <AgentStepsSection
                  durationMs={taskDurationMs ?? absorbedRun.durationMs ?? activityDurationMs}
                  autoCollapse
                  pendingConfirmationKey={runPendingKey}
                >
                  {runSegments.map((runSegment, runIndex) => {
                    if (runSegment.kind === 'text') {
                      /* 官方 `absorbTextInRange` 分支：区间内的正文包成 13px/1.65 的说明段。 */
                      return (
                        <div
                          key={`absorbed-text-${runIndex}`}
                          className="text-[13px] leading-[1.65] text-foreground/80 [&_*]:text-inherit"
                        >
                          <ChatMarkdown
                            value={runSegment.text}
                            onNodeActivate={onNodeActivate}
                            onNodeHover={onNodeHover}
                            onModelActivate={onModelActivate}
                          />
                        </div>
                      );
                    }
                    if (runSegment.kind === 'thinking') {
                      /* 官方把 `thinking` 归入可吸收项（`nG`，见 `messageContents.isAbsorbableSegment`）
                         ⇒ 落在折叠区间里的思考段**就地**渲染（去重：区间只在起点渲染一次）。 */
                      return (
                        <div
                          key={`absorbed-thinking-${runIndex}`}
                          data-agent-thinking=""
                          className="whitespace-pre-wrap break-words text-[13px] leading-[1.65] text-muted-foreground/70"
                        >
                          {runSegment.text}
                        </div>
                      );
                    }
                    if (runSegment.kind !== 'tools' || !runSegment.blocks.length) return null;
                    /* 官方 `AC … collapseAsStepsSummary={false} suppressWebSearchSources
                       hasFollowingVisibleContent` —— 折叠由外层 `FF` 负责，工具段自己不再折叠。 */
                    return (
                      <CollapsibleToolSection
                        key={`absorbed-tools-${runIndex}`}
                        blocks={runSegment.blocks}
                        durationMs={null}
                        isStreaming={false}
                        hasFollowingVisibleContent
                        collapseAsStepsSummary={false}
                      />
                    );
                  })}
                </AgentStepsSection>
                {/* 官方紧随其后的 `RF`(`PinnedWebSearchSources`)：
                    `<RF items={toolItems} isStreaming={false} hasFollowingVisibleContent showCardIndex={ge}/>` */}
                <PinnedWebSearchSources sources={pinnedSources} showCardIndex={showSourceCardIndex} />
              </div>
            );
          }
          /* 官方 `Bk(T, idx)`（「本项之后还有可见内容」）= 之后存在**非空 text** 项，或任何非 text 项。
             用户消息的正文走 `CollapsibleUserText`，故这里的 text 段只可能属于助手消息。 */
          const hasFollowingVisibleContent = activitySegments
            .slice(index + 1)
            .some((later) => (later.kind === 'text' ? !!later.text.trim() : true));
          if (segment.kind === 'text') {
            /* 官方 `$M` 的 `text` 分支（`z0e` = markdown）。用户消息的正文已由
               `CollapsibleUserText` 渲染过，这里跳过以免重复。 */
            return isUser ? null : (
              <div key={`text-${index}`} className="min-w-0">
                <ChatMarkdown
                  value={segment.text}
                  onNodeActivate={onNodeActivate}
                  onNodeHover={onNodeHover}
                  onModelActivate={onModelActivate}
                />
              </div>
            );
          }
          if (segment.kind === 'thinking') {
            /* 官方 `$M` 的 `thinking` 分支（`vendor-pkg-canvas-CvbAwZyy.js` @2426000 邻域的
               `if(e.type==="thinking"){ … <MF label="Thinking..." text={content}/> }`）：
               **独立 item**、与 `text` 并列就地渲染，**不是**正文的一部分。
               MTV 的落库位是 `ChatMessage.thinkingItems`（生产者：
               `AssistantStreamEvent.thinking.delta` → `StreamingMessageBuffer.appendThinking`），
               分段由 `messageContents.buildMessageContents/entriesToSegments` 产出。
               ⚠️ 用户消息不会带 thinking item ⇒ 只渲染 assistant。 */
            return isUser ? null : (
              <div
                key={`thinking-${index}`}
                data-agent-thinking=""
                className="whitespace-pre-wrap break-words text-[13px] leading-[1.65] text-muted-foreground/70"
              >
                {segment.text}
              </div>
            );
          }
          if (segment.kind === 'cards') {
            return segment.items.map((item, itemIndex) => renderCardToolItem(item, `card-${index}-${itemIndex}`));
          }
          /* 官方 `$M` @2426911 的 `compact` 分支：
             `<Tie phase={content?.phase ?? "started"} isStreaming={t}/>`。
             官方把它当 **contents 里的一个 item**（`yxe` @32322 写入口）⇒ 这里就按它在有序列表里
             的位置渲染，不再固定挂在消息末尾。
             ⚠️ `compact` 只出现在 assistant 的 contents 里（官方用户消息只有 `context_nodes` + `text`）。 */
          if (segment.kind === 'compact') {
            return isUser
              ? null
              : <CompactLifecycleLine key={`compact-${index}`} phase={segment.phase} isStreaming={false} />;
          }
          /* 官方 `$M` @2466855（逐字）：
             ```js
             if(e.type==="agent_error") return s.jsx(Qrt,{message:typeof e.content=="string"?e.content:"",
                                                          isStreaming:t,onRetry:d});
             ```
             ⚠️ 官方对 `agent_error` 是 **`return`** —— 只渲染这一张横幅，同一处不再渲染别的文字。
             这是**全 bundle 唯一**的 `data-testid="agent-error-banner"` 渲染点（`_findall2.mjs` 命中数 = 1）。
             `d` = `MessageItem` 的 `onRetry`（MTV = `onRetryMessage`）；`t` = `isStreaming`。 */
          if (segment.kind === 'agent_error') {
            return isUser ? null : (
              <AgentErrorBanner
                key={`agent-error-${index}`}
                message={segment.text}
                isStreaming={streamingNow}
                onRetry={onRetryMessage ? () => onRetryMessage(message.id) : undefined}
              />
            );
          }
          /* 未被吸收的工具段（后面没有可见内容 / 还在流式）：官方 `AC` 自己按 `kh` 的规则处理，
             不折叠成 `vS`（`collapseAsStepsSummary` 由 `CollapsibleToolSection` 内部的
             `!isStreaming && hasFollowingVisibleContent` 决定）。
             ⚠️ **不要求 `agentTask`/`agentControls`**：官方渲染器只认消息自己的 `contents`
             （任务记录被裁剪后 `steps` 为空也必须照常渲染 —— 用户实测 图7/8）。 */
          if (!segment.blocks.length) return null;
          return (
            <CollapsibleToolSection
              key={`tools-${index}`}
              blocks={segment.blocks}
              /* 官方 `wV`/`RE`：折叠摘要的时长从**这段 item 自己**算
                 （`O.length===1 && k!==null ? k : ct`：任务时长优先，否则取本段 `min(start)..max(end)`）。 */
              durationMs={taskDurationMs ?? itemsDurationMs(messageToolItems([segment]))}
              isStreaming={message.status === 'streaming' || isGenerating}
              hasFollowingVisibleContent={hasFollowingVisibleContent}
              collapseAsStepsSummary
              /* 官方 `kh` 的折叠分支：`<vS durationMs>{list}</vS><xS items={visible} …/>`
                 （`xS` = `PinnedWebSearchSources`，同一组来源在折叠态下钉在摘要下方）。 */
              renderSources={pinnedSources.length > 0
                ? <PinnedWebSearchSources sources={pinnedSources} showCardIndex={showSourceCardIndex} />
                : null}
            />
          );
        })}

        {/* 官方消息体末尾：`e.role==='assistant' && !isStreaming && taskSnapshot && <xO snapshot={…} />`
            —— `Nde`(`TaskHistoryCard`)：待办进度摘要 + 可折叠的任务列表。 */}
        {!isUser && message.status !== 'streaming' && message.todoSnapshot ? (
          <AgentTaskHistoryCard items={message.todoSnapshot.items} />
        ) : null}

        {/* ── 生成中状态 ── */}
        {isGenerating && (
          <div className="chat-message-media-generating c-msg__state" style={{ color: 'var(--c-text-2)' }}>
            <Icon icon="lucide:loader-2" width={14} className="shrink-0 animate-spin motion-reduce:animate-none" />
            {t('正在生成媒体内容...')}
          </div>
        )}

        {/* ── 图片结果 ── 官方 `WD`(`MarkdownImage`)：悬停蒙层 + 右上角「添加到画布 / 在画布上查看」胶囊钮 */}

        {/* ── 视频结果 ── */}
        {mediaUnsaved && (
          <div className="chat-message-media-unsaved c-msg__state c-msg__state--warning">
            <Icon icon="lucide:save-off" width={14} className="shrink-0" />
            <span className="min-w-0 flex-1">
              {t('已生成但未保存到项目：{error}', { error: mediaResult?.persistError || t('写入项目目录失败') })}
            </span>
            {onRetryMediaSave && (
              <button
                type="button"
                onClick={() => void retryMediaSave()}
                disabled={savingMedia}
                className="c-msg__action shrink-0"
                style={{ width: 'auto', padding: '0 6px', border: '1px solid rgba(255,152,0,.4)' }}
              >
                <Icon
                  icon={savingMedia ? 'lucide:loader-2' : 'lucide:download'}
                  width={12}
                  className={savingMedia ? 'animate-spin motion-reduce:animate-none' : undefined}
                />
                {savingMedia ? t('保存中') : t('重试保存')}
              </button>
            )}
          </div>
        )}
        {/* ── 媒体生成失败（按官方收口）──
            官方**没有**「媒体生成失败：<原始报错>」这种句式（`媒体生成失败` 在 4 个官方产物里
            命中数 = 0）。官方把生成失败表达成 **tool event 的失败描述**
            `chatAdapter.agentEvent.toolDescriptions.<tool>.failed_one`：
              · `gen_image.failed_one` = 「图片生成失败，本次生成不会消耗积分。」（zh @4295705）
              · `gen_video.failed_one` = 「视频生成失败，本次生成不会消耗积分。」（zh @4296252）
            这里按 `message.mediaResult.kind` 取对应那条（音频见 `mediaErrorMessage.ts` 的适配说明）。
            ⚠️ 原始报错**不再**拼进这条句子（官方不这么拼）；它仍保留在 `message.mediaError` /
            持久化记录 / 生成失败 toast 里，排查路径没有丢。 */}
        {message.mediaStatus === 'failed' && message.mediaError && (
          <div className="chat-message-media-error c-msg__state c-msg__state--error">
            <Icon icon="lucide:circle-alert" width={14} className="shrink-0" />
            <span>{resolveMediaFailureText(mediaResult?.kind, t)}</span>
          </div>
        )}
        {/* ── MTV 适配点（**授权偏离**，不是官方件）──
            `mediaNotice` = RunningHub / 工作流查询那套「任务已保留 / 请到平台核对」运维提示。
            官方没有任何对应物（官方没有异步保留语义），但这些提示**防止用户重复发起已经付费的
            生成**（重复扣费风险）⇒ **必须保留**。承载位刻意选 MTV 既有的 `c-msg__state--warning`
            行，而**不是**官方那条错误行 —— 不让它冒充官方 UI。 */}
        {message.mediaNotice && (
          <div className="chat-message-media-notice c-msg__state c-msg__state--warning">
            <Icon icon="lucide:triangle-alert" width={14} className="shrink-0" />
            <span>{message.mediaNotice}</span>
          </div>
        )}
        {message.canvasStatus === 'pending' && (
          <div className="c-msg__state c-msg__state--info">
            <Icon icon="lucide:square-dashed" width={14} />
            {t('正在创建画布节点...')}
          </div>
        )}
        {message.canvasStatus === 'created' && message.canvasNodeId && (
          <div className="c-msg__state c-msg__state--success">
            <Icon icon="lucide:circle-check" width={14} />
            {t('已添加到画布')}
            {/* 官方收尾是**带画布节点 chip 的一句**（用户实测官方：「已在画布上提交一张 9:16 竖幅的
                两只非洲象图，目前正在生成：🖼两只非洲象」）—— 那枚 chip 在官方是正文里的提及 chip
                （`ls`/`NodeMentionPill`，canvas @155848；正文提及走 `DF`/`NodeLinkChip`）。
                MTV 这句「已添加到画布」是 MTV 自有状态行（`official-chat.css` @270 已登记），
                但它缺了官方收尾里那枚 chip ⇒ 这里按官方 `DF`（`NodeLinkChip`，canvas @2413267）
                补上**真实**的 `canvasNodeId` chip，让收尾读成「…：[chip]」的官方形状。
                ⚠️ 只在正文**没有**提及该节点时补：正文提及（`{{node:<id>…}}`，见
                `mentionTokens.STRICT_MENTION_TOKEN`）已经渲染过同一枚 chip 时不重复渲染。 */}
            {!message.content.includes(message.canvasNodeId) && (
              <NodeLinkChip nodeId={message.canvasNodeId} tool="create_media_node" />
            )}
          </div>
        )}
        {message.canvasStatus === 'failed' && (
          <div className="c-msg__state c-msg__state--error">
            <Icon icon="lucide:square-x" width={14} className="shrink-0" />
            <span>{t('节点创建失败：{error}', { error: message.canvasError || t('未知错误') })}</span>
          </div>
        )}
        {!isUser && message.sources && message.sources.length > 0 && (
          /* 官方 `cS`(`WebSearchSourceDisplay`)：来源**卡片横滑行** + **pill 列表**
             （原来是 MTV 自造的 `<details>` 折叠列表 ⇒ 已按官方替换）。 */
          <WebSearchSourceDisplay sources={message.sources} />
        )}
        {/* 官方把「添加到画布」做在**图片卡右上角的悬停胶囊钮**里（`WD`），没有独立的那颗按钮 ⇒
            MTV 原来这颗 `c-empty__action` + `lucide:plus-square` 已移除；视频/音频仍各自保留
            （官方 `WD` 只覆盖 markdown 图片）。 */}
        {mediaResult && mediaResult.deliveryMode === 'chat' && message.canvasStatus !== 'created'
          && onAddToCanvas && (
          <button
            type="button"
            onClick={() => onAddToCanvas(message.id)}
            className={CANVAS_ACTION_CLASS}
          >
            {t('添加到画布')}
          </button>
        )}

        {/* Status indicator */}
        {message.status === 'streaming' && !!message.content && (
          <span className="chat-message-status chat-message-status-streaming c-msg__caret" aria-hidden="true" />
        )}
        {message.status === 'interrupted' && (
          <div className="chat-message-status chat-message-status-interrupted c-msg__state c-msg__state--warning">
            <Icon icon="lucide:triangle-alert" width={14} />
            {t('响应中断')}
          </div>
        )}

      </div>

      {/* ⚠️ 官方操作栏是 `Body`(`data-message-body`) 的**兄弟**，在 `Row`(`group flex w-full
          max-w-[95%] flex-col gap-2`) 里 —— 不是 `Body` 的子节点。
          `Body` 带 `overflow-hidden`，把操作栏塞进去会被**整行裁掉**（实测：只露出 3 个图标、
          时间戳直接消失）。这里按官方移出来当兄弟。

          ═══════════════════════════════════════════════════════════════════════════════════
          官方**当前**产物 `MessageItem`（`jle`，`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`
          UTF-8 4,832,071 B / SHA-256 b43060df…904b，charIdx **2652607 → 2666243**，
          `jle.displayName="MessageItem"` @**2666214**）的操作行门控 —— **逐字**：
          ═══════════════════════════════════════════════════════════════════════════════════

          ── 组件签名（@2652607 逐字）──
          jle=a.memo(({message:e,canvasId:t,isStreaming:n,streamState:o,isLastAssistantMessage:r,
            agentPickedImageUrls:i,onAnswerConfirmation:l,onSendPrompt:c,onRetry:d,onAppToolCompleted:u,
            onSubmitAppReply:p,onSubmitForm:m,onMessageFeedback:f,onMessageFork:h,suppressActions:g=!1})=>{
          ⇒ `n`=isStreaming(prop) · `r`=isLastAssistantMessage · `g`=suppressActions(默认 !1) · `h`=onMessageFork

          ── 会话 store 选择器 + contents（@2652726 / @2652800 邻域，逐字）──
          const S=Fe(os),C=S.pendingQuestion?.status==="pending",N=S.isLoading,
          {contents:T,taskSnapshot:E}=a.useMemo(()=>{const re=FTe(JTe((e.contents||[]).filter(
            Re=>Re.type!=="usage"&&Re.type!=="run_outcome"))),{inlineContents:Me,taskSnapshot:ke}=BTe(re);
            return{contents:Me,taskSnapshot:ke}},[e.contents])
          const k=a.useMemo(()=>eQ(T,{attachments:e.attachments,
            includeContextReferences:e.role==="user"}),[T,e.attachments,e.role])   // `k` = copyText

          ── 操作行旗标（@2657573 / @2658097 / @2659034 起，逐字，按产物中出现顺序）──
          de = a.useMemo(()=>{const re=S.billingNotice;return T.some(Me=>{if(!GC(Me))return!1;
               const ke=typeof Me.content=="object"&&Me.content?Me.content:{},
                     Re=String(ke.tool_use_id??ke.tool_call_id??ke.request?.confirmation_id
                               ??ke.request?.question_id??ke.response?.confirmation_id
                               ??ke.response?.question_id??ke.result?.confirmation_id
                               ??ke.result?.question_id??"");
               if(re?.type==="cost_limit_confirmation"&&re.confirmationId===Re)return re.status==="pending";
               const ce=String(ke.status??"");return ce!=="completed"&&ce!=="failed"})},[S.billingNotice,T])
          me = !g&&e.role==="user"&&!!k
          he = !!(N||S.runId||S.streamingMessageId||S.streamState!=="idle"
                  ||S.pendingConfirmation?.status==="pending"||S.pendingConfirmation?.status==="syncing"
                  ||C||de)
          _e = r&&he
          ge = !g&&e.role==="assistant"&&!n&&!_e
          Se = !g&&e.role==="assistant"&&(n||_e)
          Oe = ge&&!!h
          $e = e.sentAt??e.responseStartedAt
          nt = !g&&!e.unsent&&typeof $e=="number"&&Number.isFinite($e)
               &&!(e.role==="assistant"&&(n||r&&N))
          Ue = (re="end")=>nt&&typeof $e=="number"?s.jsx(jlt,{sentAtMs:$e,side:re,visible:We}):null
          ze = <copy 钮>

          ── 渲染（@2664443 起，逐字）──
          A3 = 动作行容器；官方 `A3` 是 re-export（本 chunk 的 import 表 `ga as A3` @8070），
               实体在 `vendor-packages-DRvCmDjR.js`：`lM as ga` @1807008 ⇒
               `lM=({className:e,children:t,...n})=>a.jsx("div",{className:I("flex items-center gap-1",e),
                ...n,children:t})` @**178899** —— 即「`flex items-center gap-1` + 传入 className」的裸 div。
          {me && s.jsxs(A3,{className:"mt-1 ml-auto",children:[Ue("start"),ze]})}
          {nt&&e.role==="user"&&!me && s.jsx("div",{className:"mt-1 ml-auto flex",children:Ue()})}
          {ge && s.jsxs(A3,{className:"mt-2 -ml-1.5",children:[ze,👍,👎,Oe&&Ee,Ue()]})}
          {Se && s.jsx("div",{className:"mt-2 h-6","aria-hidden":"true",
                            "data-message-actions-placeholder":!0})}
          {nt&&e.role==="assistant"&&!ge&&!Oe&&!Se && s.jsx("div",{className:"mt-2 -ml-1.5 flex",children:Ue()})}
          ⚠️ 注意：**只有** `me` / `ge` 两支用 `A3`（带 `items-center gap-1`）；`nt` 的两支时间戳行是
             裸 `<div className="… flex">`（**没有** `items-center gap-1`）—— 已按官方逐字改正。

          ── 官方每个因子 → MTV 真实来源逐条落实（**无来源者一律 false，不做等价替代**）──
          · `C`  = `S.pendingQuestion?.status==="pending"` ⇒ **MTV 有**：
                   `useAppStore(state=>state.pendingQuestion)`；字段 `src/store/store.chat.ts:140`、
                   初值 `:380`、生产者 `setPendingQuestion` `:700`（调用点
                   `src/services/chat/tools/askQuestionTools.ts:88`）。类型 `PendingAskQuestion`（types/chat.ts:292）。
          · `N`  = `S.isLoading`（**会话级** isLoading）官方有、**MTV 无生产者** ⇒ **false**。
                   `src/store/store.chat.ts` 的状态形状里没有 `isLoading`（`src/store/store.ui.ts:77` 的
                   `isLoading` 是「魔法标记识别」的 per-mark 字段，与本公式无关）。
                   ⚠️ 特别声明：**不得**拿 `message.mediaStatus`（MTV 现有的 `isGenerating` —— 那是**媒体**
                   生成态）或 `activeRequestAbort` 顶替 —— 语义不同，属禁止的「等价替代」。
          · `S.runId` 官方有、MTV 无 ⇒ **false**（`src/store/` 0 命中；MTV 只有 `message.requestId` /
                   `agentTask.id`，与官方 run 流不一一对应）。
          · `S.streamingMessageId` 官方有、MTV 无 ⇒ **false**（MTV 全库 0 命中）。
          · `S.streamState!=="idle"` 官方有、MTV 无 ⇒ **false**（MTV store 无该字段；`ThinkingStatusLine.tsx:63`
                   的 `streamState` 与 `todoTasks.ts:172` 的入参都是**调用方传的局部值**，无 store 生产者）。
          · `S.pendingConfirmation?.status==="pending"` / `==="syncing"` 官方有、MTV 无 ⇒ **false**
                   （MTV store 形状无 `pendingConfirmation`；`desktopConfirmationCard.ts:130` /
                   `generationConfirmation.ts:301` 里的 `pendingConfirmation?:` 是**官方 `hs` 切片**的类型注解，
                   不是 MTV 字段）。
          · `de`（`billingNotice`）官方有、MTV 无 ⇒ **false**。官方逐字表达式见上（依赖 `S.billingNotice`）；
                   MTV 全库对 `billingNotice` **只有本文件的一句注释命中**，无字段、无生产者。
          · `n`  = `isStreaming`（prop）。官方调用点 @**2677173**：
                   `s.jsx(jle,{message:Y,isStreaming:Y.id===P,streamState:Y.id===P?r:"idle",…})`
                   （`P` = `streamingMessageId`）。MTV 无 `streamingMessageId`，但 MTV 的
                   `message.status==='streaming'` 是由 `conversationExecutionController.ts:126/:244/:339`
                   真实写入的 **per-message 流式信号** ⇒ 用它作 `n`。**不再**并入 `mediaStatus`。
          · `r`  = `isLastAssistantMessage` ⇒ MTV **有**（prop 同名；`ChatMessages.tsx:163`）。
          · `g`  = `suppressActions` ⇒ MTV **有**（prop 同名，默认 false）。
          · `h`  = `onMessageFork` ⇒ MTV **有**（prop 同名）。
          · `k`  = copyText ⇒ MTV **有**：`message.content`。
          · `e.unsent` 官方有、MTV `ChatMessage` **无该字段**（`src/types/chat.ts:390` 形状；全库 0 命中）
                   ⇒ 恒 falsy ⇒ `!e.unsent` **恒真**（官方那条 `messageNotSent` 分支 MTV 同样不渲染）。
          · `$e` = 官方 `e.sentAt ?? e.responseStartedAt` ⇒ MTV **有**：`message.timestamp`
                   （`src/types/chat.ts:395`，必填 number；MTV 无 `sentAt`/`responseStartedAt` 字段，全库 0 命中）。
          · 官方 `contents` 过滤 `type!=="usage" && type!=="run_outcome"`（@2652800 邻域）：
                   MTV **无** `run_outcome` 内容类型（`services/chat/agentMessageContents` 联合里 0 命中）
                   ⇒ **该过滤不需要**；此处仅登记官方行为，**不发明**该类型。
          ═══════════════════════════════════════════════════════════════════════════════════ */}
      {(() => {
        /* ══ 官方当前公式的 5 个渲染旗标（`me` / `ge` / `Se` / `Oe` / `nt`）＋ 中间量 `he` / `_e` ══
           变量名本地化，**逻辑与因子集合与官方逐字一致**；官方无来源的因子已在上面注释里逐条
           声明为 `false`（不做等价替代）。 */
        const copyText = message.content;
        /* 官方 `C = S.pendingQuestion?.status==="pending"`（store 选择器，@2652726 邻域逐字）。
           官方那个 `S` 是**会话 store**（`Fe(os)` = `getSessionState(activeSessionId)`）⇒ 会话作用域隐含；
           MTV 是全局字段 + 戳 ⇒ 按 MTV 既有口径补上 `conversationId` 比较（**不是**新增因子，
           是把官方的作用域在 MTV 的数据形状里显式表达）。 */
        const C = pendingQuestion?.status === 'pending'
          && pendingQuestion.conversationId === activeConversationId;
        /* 官方 `N = S.isLoading`（**会话级** isLoading）：MTV **无生产者** ⇒ 恒 false。 */
        const N = false;
        /* 官方 `de`（`S.billingNotice` 驱动）：MTV **无来源** ⇒ 恒 false。 */
        const de = false;
        /* 官方 `he = !!(N||S.runId||S.streamingMessageId||S.streamState!=="idle"
             ||S.pendingConfirmation?.status==="pending"||S.pendingConfirmation?.status==="syncing"||C||de)`
           @2659034 逐字。MTV 侧：`N`/`runId`/`streamingMessageId`/`streamState`/`pendingConfirmation`
           **全部无来源 ⇒ false**；`de` false；⇒ `he` 只剩官方那个 `C`。 */
        const he = !!(
          N
          /* 官方紧接的 `||S.runId||S.streamingMessageId||S.streamState!=="idle"
             ||S.pendingConfirmation?.status==="pending"||S.pendingConfirmation?.status==="syncing"`
             —— 这 5 处会话态因子 MTV **全部无生产者** ⇒ 每处各取 false（**不做**等价替代）。 */
          || C
          || de
        );
        /* 官方 `n` = `isStreaming` prop（`Y.id===streamingMessageId`，调用点 @2677173）；
           MTV 的等价真实来源 = `message.status === 'streaming'`（`conversationExecutionController`
           写入，:126/:244/:339）。**不**并入 `mediaStatus`（那是官方没有的媒体态）。 */
        const n = message.status === 'streaming';
        /* 官方 `g` = `suppressActions`（prop，默认 !1）；`e.role==="assistant"` ⇒ `!isUser`。 */
        const g = suppressActions;
        const isAssistant = !isUser;
        /* 官方 `_e = r&&he`（`r` = `isLastAssistantMessage`）。 */
        const _e = isLastAssistantMessage && he;
        /* 官方 `ge = !g&&e.role==="assistant"&&!n&&!_e`（@2659034 逐字）。 */
        const ge = !g && isAssistant && !n && !_e;
        /* 官方 `Se = !g&&e.role==="assistant"&&(n||_e)`（@2659034 逐字）。 */
        const Se = !g && isAssistant && (n || _e);
        /* 官方 `Oe = ge&&!!h`（`h` = `onMessageFork`）—— 注意它**蕴含 `ge`**（旧版 MTV 少了这层）。 */
        const Oe = ge && !!onMessageFork;
        /* 官方 `$e = e.sentAt ?? e.responseStartedAt`；MTV 只有 `message.timestamp`
           （`ChatMessage` 无 `sentAt`/`responseStartedAt`，见上面注释声明）。 */
        const $e = message.timestamp;
        /* 官方 `nt = !g&&!e.unsent&&typeof $e=="number"&&Number.isFinite($e)
             &&!(e.role==="assistant"&&(n||r&&N))` @2659034 逐字。
           `e.unsent` MTV 无此字段 ⇒ 恒 falsy ⇒ `!e.unsent` 恒真；`N` false ⇒ `r&&N` false。 */
        const nt = !g
          && typeof $e === 'number' && Number.isFinite($e)
          && !(isAssistant && n);
        /* 官方 `me = !g&&e.role==="user"&&!!k`（`k` = copyText，@2658097 逐字）。 */
        const me = !g && isUser && !!copyText;
        /* 官方 `Ue=(re="end")=>nt&&typeof $e=="number"?s.jsx(jlt,{sentAtMs:$e,side:re,visible:We}):null`
           @2659034 逐字 —— 时间戳节点**自己带 `nt` 门**（官方不是在每个分支外面再判一次）；
           因此 `ge` 支里即使渲染 `Ue()`，`nt` 为假时它也是 `null`。 */
        const Ue = (side: 'start' | 'end' = 'end') => (
          nt && typeof $e === 'number'
            ? <MessageTimestamp sentAtMs={$e} side={side} visible={actionsVisible} />
            : null
        );
        const forkAction = Oe ? (
          <MessageAction
            label={t('在新会话中继续')}
            tooltip={t('在新会话中继续')}
            renderIcon={(cls) => <OfficialForkIcon size={14} strokeWidth={1.5} className={cls} />}
            onClick={() => forkMessage()}
          />
        ) : null;
        return (
          <>
            {me && (
              <div className="mt-1 ml-auto flex items-center gap-1">
                {Ue('start')}
                {copyAction}
              </div>
            )}
            {nt && isUser && !me && (
              <div className="mt-1 ml-auto flex">{Ue('start')}</div>
            )}
            {ge && (
              <div className="mt-2 -ml-1.5 flex items-center gap-1">
                {copyAction}
                <FeedbackAction
                  kind="up"
                  active={vote === 'up'}
                  label={t('好评')}
                  onToggle={() => toggleVote('up')}
                />
                <FeedbackAction
                  kind="down"
                  active={vote === 'down'}
                  label={t('差评')}
                  onToggle={() => toggleVote('down')}
                />
                {forkAction}
                {Ue()}
              </div>
            )}
            {Se && <div className="mt-2 h-6" aria-hidden="true" data-message-actions-placeholder />}
            {nt && isAssistant && !ge && !Oe && !Se && (
              <div className="mt-2 -ml-1.5 flex">{Ue()}</div>
            )}
          </>
        );
      })()}

      {/* 官方 `$M` @2426911 的 `compact` 分支（`<Tie phase={content?.phase ?? "started"} isStreaming={t}/>`）
          现在由上面的**有序 `contents` 分派**渲染（生产者 = `messageContents.buildMessageContents` 从
          `message.compactedAt` 产出 `{type:"compact", content:{phase:"finished"}}`，与官方 `yxe` 同形状）。
          「started（正在自动压缩上下文）」那半需要压缩**进行中**的实时信号，MTV 的压缩是回合间的同步过程
          ⇒ 仍由会话级生产者（`compactStartedProducer`）负责，不在本组件。 */}

      {/* 官方 `Fit` 的**生产者**（§6 #14）。
          官方渲染点（@2629518 邻域，逐字）：
          `N?.includes(Y.id) && !(Y.id === k && o !== "idle") && s.jsx(Fit, {})`
          —— `N` = **被用户停止**的消息 id 集合；`Y.id === k && o !== "idle"` 是「该条还在跑」的排除项。
          MTV 的等价信号 = 本消息的 agent 任务被用户停止
          （`agentTaskControl` 的 `transitionAgentTask(taskId, 'stopped', …)`，@151 邻域）。
          `status === 'stopped'` 本身已保证「不在跑」⇒ 官方那个排除项无需另写。
          ⚠️ 这条**不是** `contents` 里的 item：官方 `Fit` 是消息列表级的（全 bundle 的 `"stopped"`
          只出现在子代理 status/文案里）⇒ 位置保持原样（消息末尾）。 */}
      {!isUser && agentTask?.status === 'stopped' ? <StoppedByUserDivider /> : null}
    </div>
  );
}

export default memo(MessageBubble);
