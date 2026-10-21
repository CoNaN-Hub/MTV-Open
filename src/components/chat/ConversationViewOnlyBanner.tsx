/**
 * ConversationViewOnlyBanner —— 官方 `Pae`（会话视图，@2748457）里的**两条只读 banner**。
 *
 * 官方逐字（`vendor-pkg-canvas-ChpWx5JY.js` @2778057 / @2778235，同一行相邻两个分支）：
 * ```js
 * tt && s.jsx("div",{className:"shrink-0 px-3 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border/50",
 *   children:f("chatAdapter.conversation.legacyReadOnlyBanner")}),
 * je && s.jsx("div",{className:"shrink-0 px-3 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border/50",
 *   children:f("chatAdapter.conversation.starterReplayViewOnlyBanner")}),
 * ```
 * · 两条 banner 的**类串完全相同**；都**没有 English fallback 字面量**（单参 `t()`）。
 * · `tt = Pe.isLegacyReadOnly === true`（活跃会话的 `isLegacyReadOnly`，@2750862）。
 * · `je` = starter-replay 只读（前缀常量 `NY="starter-replay-"` @413776）。
 * · `legacyReadOnlyBanner` @2778057：zh「旧版聊天记录已归档。请复制内容至新版 Agent 窗口继续对话。」/ en "Archived. Continue in the new Agent."
 * · `starterReplayViewOnlyBanner` @2778235：zh「新手教程演示记录，仅供回看。」/ en "Starter tutorial demo. View only."
 *
 * ⚠️ MTV 没有官方的 `isLegacyReadOnly` 会话标志 —— 对位字段是 `ChatConversation.archived`
 * （见 `conversationMenuSpec.isLegacyConversation` 的说明）。
 */
import { useT } from '../../i18n';

export interface ConversationViewOnlyBannerProps {
  /** 官方 `tt`（活跃会话是 legacy 只读归档）。 */
  isLegacyReadOnly: boolean;
  /** 官方 `je`（活跃会话是 starter-replay 演示记录）。 */
  isStarterReplay: boolean;
}

export default function ConversationViewOnlyBanner({
  isLegacyReadOnly,
  isStarterReplay,
}: ConversationViewOnlyBannerProps) {
  const t = useT();
  if (!isLegacyReadOnly && !isStarterReplay) return null;
  const bannerClass = 'shrink-0 px-3 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border/50';
  return (
    <>
      {isLegacyReadOnly && (
        <div className={bannerClass}>
          {t('旧版聊天记录已归档。请复制内容至新版 Agent 窗口继续对话。')}
        </div>
      )}
      {isStarterReplay && (
        <div className={bannerClass}>
          {t('新手教程演示记录，仅供回看。')}
        </div>
      )}
    </>
  );
}
