/**
 * AgentUsageStats —— 官方头部第 3 颗「usageStats」（`page-DVqoHdTT.js`@733847 起）1:1 移植。
 *
 * 官方逐字依据：
 *   · 触发钮：`relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md cursor-pointer
 *     transition-colors text-foreground/80 hover:text-chat-foreground hover:bg-white/[0.12] focus-visible:outline-none`
 *     + 官方共享禁用类串 `disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent
 *      disabled:hover:text-muted-foreground disabled:focus-visible:ring-0 disabled:focus-visible:ring-offset-0`；
 *     图标 `WA` = **tabler gauge** @19 `strokeWidth 2`（MAIN@1358875 `F("gauge",…)`）；
 *     tooltip `chatAdapter.tooltips.usageStats`（用量统计）；点击 = `onOpenUsageStats()`。
 *
 * ⚠️ 官方那颗按钮旁的「礼包态用量说明弹层」（`fixed z-[120] w-[384px] rounded-[20px] bg-[#2B2B2B] …`，
 *   对应官方 i18n 的礼包说明文案组）**只在服务端礼包态出现**；
 *   MTV 没有这种礼包态 ⇒ **整套弹层已删除**（用户明确要求：不要这种礼包态）。
 *   MTV 的等价物 = 点击按钮直接打开设置页「用量看板」（`usage` tab），即官方 `onOpenUsageStats()` 的落点。
 */
import { OfficialGaugeIcon } from './officialIcons';
import { useT } from '../../i18n';

interface AgentUsageStatsProps {
  disabled?: boolean;
  onOpenUsageStats: () => void;
}

export default function AgentUsageStats({ disabled = false, onOpenUsageStats }: AgentUsageStatsProps) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onOpenUsageStats(); }}
      disabled={disabled}
      aria-label={t('用量统计')}
      data-tooltip={t('用量统计')}
      className={[
        'relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md cursor-pointer',
        'transition-colors text-foreground/80 hover:text-chat-foreground hover:bg-white/[0.12] focus-visible:outline-none',
        disabled ? 'cursor-default opacity-45 hover:bg-transparent hover:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0' : '',
      ].filter(Boolean).join(' ')}
    >
      <OfficialGaugeIcon size={19} strokeWidth={2} />
    </button>
  );
}
