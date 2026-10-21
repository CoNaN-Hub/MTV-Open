/**
 * ChatHeader — 对话面板 Header
 *
 * 版式 = **官方 TapNow 助手头部**（源码 `page-DVqoHdTT.js`@731979 `eae`，逐字）：
 *
 *   · 根：`flex items-stretch justify-between gap-2 pt-4 pb-1 pr-4 border-b border-white/[0.06]`
 *     （官方 `V(ij,'pr-4 border-b border-white/[0.06]', className)`；`ij` = SHARED `Klt`
 *      = `"flex items-stretch justify-between gap-2 pt-4 pb-1"`）
 *     ⚠️ 会话里**一条消息都没有**时宿主再补 `border-b-0`（官方 `se.length===0 && !tt`）⇒ 空态无分线。
 *   · 品牌侧 `flex flex-1 min-w-0 items-stretch` + `gap-2 pl-2.5`（有 sidePanel 时才加 gap/padding）
 *       - 第 1 颗 sidePanel 开关（官方 `Koe`）
 *       - 标题位 `flex h-10 min-w-0 flex-1 items-center`（SHARED `qlt`）；
 *         **没有 sidePanel 时**补 `pl-2`（官方 `V(sj, !P && 'pl-2')`）
 *   · 动作区 `flex h-10 shrink-0 items-center gap-3`（SHARED `Ylt` = 官方 `rj`）
 *       - 第 3 颗 用量统计（`WA` = tabler gauge 19/2）
 *       - 第 4 颗 聊天记录（`sz` = tabler message-square-plus 18/2）
 *       - 第 5 颗 收起对话（`BA` = tabler minimize-2 18/2，`-ml-[3px]`）
 *
 * 图标**不是 Lucide**：官方整套是 **Tabler**，形状对不上，且 `@iconify/react` 会联网取图标
 * （本地画布下退化成空框）⇒ 全部换成 `officialIcons.tsx` 里内联的官方 path。
 */
import { type RefObject } from 'react';
import AgentUsageStats from './AgentUsageStats';
import {
  OfficialChevronDownIcon,
  OfficialCollapseChatIcon,
  OfficialHistoryIcon,
  OfficialSidePanelIcon,
} from './officialIcons';
import { useT } from '../../i18n';

interface ChatHeaderProps {
  onClose: () => void;
  /** 当前会话标题；**没有消息**时按钮显示官方 `tooltips.newChat`（新建对话）。 */
  conversationTitle?: string;
  /** 官方 `se.length===0`：会话是否已有消息（决定标题占位与底部 `border-b-0`）。 */
  hasMessages?: boolean;
  /** 标题即官方唯一的会话下拉入口（`conversation.addNewChat` / history 都在其中）。 */
  onToggleConversationMenu: () => void;
  conversationMenuOpen: boolean;
  titleButtonRef?: RefObject<HTMLButtonElement | null>;
  /** 官方第 4 颗「聊天记录」：同一个会话下拉的第二个触发器（`align: end`）。 */
  onToggleHistoryMenu: () => void;
  historyMenuOpen: boolean;
  historyButtonRef?: RefObject<HTMLButtonElement | null>;
  /** 官方第 3 颗「用量统计」：`onOpenUsageStats`（官方宿主回调）。 */
  onOpenUsageStats?: () => void;
  /** 官方第 1 颗 sidePanel：artifact（头脑风暴）面板开关。官方 `Koe` 的 `isOpen` / `active`。 */
  artifactPanelOpen?: boolean;
  onToggleArtifactPanel?: () => void;
  /** 官方 `hasBrainstormUnread`：未读点（`absolute right-1 top-1 …`）。 */
  artifactPanelHasUnread?: boolean;
  /* ⚠️ 官方头部只有 5 颗（sidePanel / 标题下拉 / usageStats / history / collapseChat）。
     ·「智能体中心 / 任务中心 / 项目记忆 / 子智能体」四个入口**官方没有** ⇒ 已删除；
     ·「独立窗口」入口与独立窗口镜像模式**官方没有**（`chat_window` / `detachedChat` 官方产物 0 命中）⇒ 已删除；
     ·「生成确认模式（Ask / Auto）」官方挂在**输入框底部控制条**上，不在这里 ⇒ 已移到 ChatInput。 */
}

export default function ChatHeader({
  onClose,
  conversationTitle,
  hasMessages = true,
  onToggleConversationMenu,
  conversationMenuOpen,
  titleButtonRef,
  onToggleHistoryMenu,
  historyMenuOpen,
  historyButtonRef,
  onOpenUsageStats,
  artifactPanelOpen = false,
  onToggleArtifactPanel,
  artifactPanelHasUnread = false,
}: ChatHeaderProps) {
  const t = useT();
  /* 官方 `title: qe || (se.length===0 && !tt ? t('chatAdapter.tooltips.newChat') : null)`
     —— 没有消息时显示「新建对话」，有消息才显示会话标题。 */
  const title = hasMessages ? (conversationTitle ?? '') : t('新建对话');

  return (
    <div
      className={[
        'flex items-stretch justify-between gap-2 pt-4 pb-1 pr-4',
        hasMessages ? 'border-b border-white/[0.06]' : 'border-b-0',
      ].join(' ')}
    >
      <div
        className={[
          'flex flex-1 min-w-0 items-stretch',
          onToggleArtifactPanel ? 'gap-2 pl-2.5' : '',
        ].join(' ')}
      >
        {/* 官方第 1 颗：sidePanel 开关（`Koe`）。逐字类串：
            `relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md cursor-pointer
             transition-colors duration-150 focus-visible:outline-none`
            + 默认 `text-foreground/80 hover:bg-white/[0.12] hover:text-chat-foreground`
            + 激活 `bg-white/[0.12] text-chat-foreground hover:bg-white/[0.18]`
            + attention `bg-[#90C4E5] text-black hover:bg-[#A9D3EC]`（MTV 无 starter replay ⇒ 不用）
            图标 `Q$` @18；tooltip `chatAdapter.tooltips.sidePanel`（侧边栏）；未读点
            `absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#90C4E5] ring-2 ring-chat-background`。 */}
        {onToggleArtifactPanel && (
          <div className="flex shrink-0 items-center self-stretch">
            <button
              type="button"
              onClick={onToggleArtifactPanel}
              aria-pressed={artifactPanelOpen}
              aria-label={t('侧边栏')}
              data-tooltip={t('侧边栏')}
              className={[
                'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md cursor-pointer',
                'transition-colors duration-150 focus-visible:outline-none',
                artifactPanelOpen
                  ? 'bg-white/[0.12] text-chat-foreground hover:bg-white/[0.18]'
                  : 'text-foreground/80 hover:bg-white/[0.12] hover:text-chat-foreground',
              ].join(' ')}
            >
              <span className="relative z-10 inline-flex">
                <OfficialSidePanelIcon size={18} />
              </span>
              {artifactPanelHasUnread && !artifactPanelOpen && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#90C4E5] ring-2 ring-chat-background"
                />
              )}
            </button>
          </div>
        )}

        <div
          className={[
            'flex h-10 min-w-0 flex-1 items-center',
            onToggleArtifactPanel ? '' : 'pl-2',
          ].join(' ')}
        >
          {/* 官方标题按钮（PAGE@733313 逐字）：
              `flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium
               text-foreground/90 transition-colors cursor-pointer hover:bg-white/[0.06] hover:text-foreground
               focus:outline-none` + 文字 `truncate` + chevron `ca` @14/2（展开时 `rotate-180`）。 */}
          <button
            type="button"
            ref={titleButtonRef}
            onClick={onToggleConversationMenu}
            aria-expanded={conversationMenuOpen}
            aria-haspopup="menu"
            className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium text-foreground/90 transition-colors cursor-pointer hover:bg-white/[0.06] hover:text-foreground focus:outline-none"
          >
            <span className="truncate">{title}</span>
            <OfficialChevronDownIcon
              size={14}
              strokeWidth={2}
              className={`shrink-0 text-foreground/40 transition-transform ${conversationMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      <div className="flex h-10 shrink-0 items-center gap-3">
        {/* 官方第 3 颗：用量统计（`WA` = tabler gauge @19/2；tooltip `tooltips.usageStats`）。
            官方顺序：usageStats → history → collapseChat。 */}
        {onOpenUsageStats && (
          <AgentUsageStats onOpenUsageStats={onOpenUsageStats} />
        )}

        {/* 官方第 4 颗：聊天记录（`sz` = tabler message-square-plus @18/2，
            tooltip 与 aria 都是 `tooltips.history`）。它是**第二个**会话下拉实例（`align: end`）。 */}
        <button
          type="button"
          ref={historyButtonRef}
          onClick={onToggleHistoryMenu}
          aria-label={t('聊天记录')}
          aria-haspopup="menu"
          aria-expanded={historyMenuOpen}
          data-tooltip={t('聊天记录')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md cursor-pointer transition-colors text-foreground/80 hover:text-chat-foreground hover:bg-white/[0.12] focus-visible:outline-none"
        >
          <OfficialHistoryIcon size={18} strokeWidth={2} />
        </button>

        {/* 官方最后一颗「收起对话」（`BA` = tabler minimize-2 @18/2，`-ml-[3px]`，
            tooltip `tooltips.collapseChat`）。视觉结果 = 面板宽度收 0 + x 右移 12px。 */}
        <button
          type="button"
          className="-ml-[3px] inline-flex h-8 w-8 items-center justify-center rounded-md cursor-pointer transition-colors text-foreground/80 hover:text-chat-foreground hover:bg-white/[0.12] focus-visible:outline-none"
          onClick={onClose}
          data-tooltip={t('收起对话')}
          aria-label={t('收起对话')}
        >
          <OfficialCollapseChatIcon size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
