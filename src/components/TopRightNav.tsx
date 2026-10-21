import { memo } from 'react';
import { useT } from '../i18n';
import { OfficialIcon } from './sidebar/OfficialIcon';
import { useAppStore } from '../store/useAppStore';
import CreditBoltIcon from './shared/CreditBoltIcon';
import { useCreditBalance } from '../hooks/useCreditBalance';
import { formatCredits } from '../services/ai/creditEstimate';

/**
 * TopRightNav 右上角导航 —— **逐字对齐官方实测**（统一视窗 2174×1263，CDP 量）
 *
 * 官方四块（用户指示的映射见下）：
 *   ① 「0」余额   57×40 · r12 · pad 4/12 · gap 4 · fs14 · color #cccccc · bg **#171717**
 *                 图标 svg **20×20 · viewBox="0 0 20 20"**（官方自定义图标 ✓ 已抠出 balance.svg）
 *   ② 「社区」    80×40 · r12 · pad 4/12 · gap 8 · fs14 · bg #171717
 *                 图标 tabler-icon-sparkles 20×20          → **用户指示：替换为「角色库」** ✓
 *   ③ 「分享」    40×40 · **全圆** · bg #171717 · 图标 tabler-icon-share 20×20
 *                                                          → **用户指示：替换为「AI 助手」** ✓
 *   ④ 头像组      4 个 **32×32** · **r10** · 色 rgba(247,247,247,.8)(= text-foreground/80)
 *                 图标依次 18(自定义12×11品牌logo) / 19(lucide-gauge) / 18(message-square-plus)
 *                 / 18(minimize2，带 `-ml-[3px]` 负边距与前者叠压 ✓)
 *                                                          → **用户指示：保留** ✓
 *
 * ⚠️ 官方这四块里，「0 余额 / 头像组」MTV 无对应功能 → 按用户指示**保留外观**，
 *    逻辑「先放着」（点击不做任何事 ✓）；「角色库 / AI 助手」是 MTV 真功能 ✓ 正常接。
 */
const TopRightNav = memo(function TopRightNav({ setCharacterLibraryOpen }: {
  setCharacterLibraryOpen: (open: boolean) => void;
}) {
  const t = useT();
  const { credits, loading } = useCreditBalance();

  return (
    <div
      data-tauri-drag-region
      className="absolute top-4 right-4 z-40 flex items-center gap-2 select-none"
      /* 官方 page-DPdEgTS0.js：画廊打开时右上工具栏右上移出（CSS 在 nodes-pile.css） */
      data-pile-gallery-chrome="top-right"
    >
      {/* ① 积分按钮 —— 官方那颗「0 余额」的位置与尺寸（57×40 · r12 · pad 4/12 · gap4 · fs14 #cccccc · bg #171717）
             用户 2026：①图标换成「积分-闪电」②显示真积分（= 厂商余额按连接比例折算）③点它跳「设置 → 充值积分」 */}
      <button
        type="button"
        className="topright-balance"
        data-tooltip={t('积分')}
        aria-label={t('积分')}
        onClick={() => useAppStore.getState().setSettingsOpen(true, 'credits')}
      >
        <CreditBoltIcon size={20} />
        <span>{loading ? '…' : credits === null ? '-' : formatCredits(credits)}</span>
      </button>

      {/* ② 官方「社区」位 → **角色库**（用户指示 ✓）
            官方规格：80×40 · r12 · pad 4/12 · gap 8 · fs14 · bg #171717 */}
      <button
        type="button"
        className="topright-pill"
        data-tooltip={t('角色库')}
        aria-label={t('打开角色库')}
        onClick={() => setCharacterLibraryOpen(true)}
      >
        <OfficialIcon name="tr-community" size={20} />
        <span>{t('角色库')}</span>
      </button>

      {/* ③ 官方「分享」位 —— MTV 曾按早先的指示把它换成自绘「AI 助手」机器人按钮 ✗
             现已按官方移除：进入 Agent 的入口 = 官方 **Chatbox 浮球**
             （`page-BeI7xydN.js` 的 `Lpe`，本仓 `AgentChatEntryOrb`，挂在画布右下角）。
             官方这个位置是「分享」；MTV 没有分享后端 ⇒ 不留死按钮、不伪造。 */}

      {/* ④ 官方那 4 个 32×32 图标（品牌logo / gauge / message-square-plus / minimize2）
             **已按用户指示移除** ✗ —— 用户说明：那是 **agent 面板的图标** ✓
             「只有点击 agent 时才出现」✓（不属于右上角导航 ✓） */}
    </div>
  );
});

export default TopRightNav;
