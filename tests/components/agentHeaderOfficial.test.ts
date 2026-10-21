/**
 * 头部 / 消息壳「官方对齐」源码守卫
 *
 * 官方依据（`tapnow-agent-panel-ground-truth.md`）：
 *   · §1.2 头部左组 = sidePanel 开关 + 标题下拉；**没有品牌位/头像**；最后一颗是「收起对话」
 *     （`minimize-2`@18，tooltip `chatAdapter.tooltips.collapseChat` = 收起对话 / Collapse chat）。
 *   · §6.1 消息壳 `Message` = `group flex w-full max-w-[95%] flex-col gap-2`（user 加 `ml-auto justify-end`），
 *     **没有头像元素**。
 *   · §1.4 输入卡**没有任何 focus/hover 变色**。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

describe('头部与消息壳官方对齐', () => {
  const header = read('src/components/chat/ChatHeader.tsx');
  const bubble = read('src/components/chat/MessageBubble.tsx');
  const chatCss = read('src/styles/official-chat.css');

  it('头部不再有品牌位/头像，也没有自创的关闭图标', () => {
    expect(header).not.toContain('c-header__mark');
    expect(header).not.toContain('MascotAvatar');
    expect(header).not.toContain("icon=\"lucide:x\"");
    expect(chatCss).not.toContain('.c-header__mark');
  });

  it('收起键用官方 `BA` = tabler minimize-2 @18/2 与「收起对话」文案', () => {
    expect(header).toContain('<OfficialCollapseChatIcon size={18} strokeWidth={2} />');
    expect(header).toContain("t('收起对话')");
    /* 三语词条必须存在（zh 源串为键） */
    for (const locale of ['en-US', 'ja-JP', 'ko-KR']) {
      expect(read(`src/i18n/locales/${locale}/chat.ts`)).toContain("'收起对话'");
    }
  });

  it('消息壳不再渲染头像', () => {
    expect(bubble).not.toContain('MascotAvatar');
    expect(bubble).not.toContain('c-msg__avatar');
  });

  it('输入卡没有自创的 focus 变色', () => {
    expect(chatCss).not.toContain('.c-composer__card:focus-within');
  });

  it('头部按官方顺序摆 usageStats → history → collapseChat，且用量键是 tabler gauge @19', () => {
    const usage = read('src/components/chat/AgentUsageStats.tsx');
    /* 官方 `WA` = **tabler** gauge（MAIN@1358875 `F("gauge",…)`），@19 / strokeWidth 2，
       tooltip `tooltips.usageStats`。⚠️ 不是 lucide——官方整套图标是 Tabler。 */
    expect(usage).toContain('<OfficialGaugeIcon size={19} strokeWidth={2} />');
    expect(usage).toContain("t('用量统计')");
    /* 官方那套按钮类串逐字 */
    expect(usage).toContain('relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md cursor-pointer');
    expect(usage).toContain('hover:bg-white/[0.12]');
    /* 用户明确要求：不要「限时赠送 Tapies」这种服务端礼包态 ⇒ 教育弹层与 usageEducation 全删 */
    expect(usage).not.toContain('usageEducation');
    expect(usage).not.toContain('Tapies');
    expect(usage).not.toContain('createPortal');

    const usageAt = header.indexOf('<AgentUsageStats');
    const historyAt = header.indexOf('<OfficialHistoryIcon');
    const collapseAt = header.indexOf('<OfficialCollapseChatIcon');
    expect(usageAt).toBeGreaterThan(-1);
    expect(historyAt).toBeGreaterThan(usageAt);
    expect(collapseAt).toBeGreaterThan(historyAt);
  });

  it('头部图标全部来自官方 Tabler 复刻，且不再用会联网的 @iconify/react', () => {
    expect(header).not.toContain("from '@iconify/react'");
    expect(header).not.toContain('lucide:');
    const icons = read('src/components/chat/officialIcons.tsx');
    /* tabler chevron-down / gauge / message-square-plus / minimize-2 / arrow-narrow-right 的 path 逐字 */
    expect(icons).toContain('d="M6 9l6 6l6 -6"');
    expect(icons).toContain('d="M3.34 19a10 10 0 1 1 17.32 0"');
    expect(icons).toContain('d="M12 7v6"');
    expect(icons).toContain('d="m14 10 7-7"');
    expect(icons).toContain('d="M5 12l14 0"');
    expect(icons).toContain('d="M15 6l-6 6l6 6"');
  });

  it('收起键逐字带官方 `-ml-[3px]`', () => {
    expect(header).toContain('-ml-[3px] inline-flex h-8 w-8');
  });

  it('头部第 1 颗 = 官方 sidePanel 开关（`Koe`），且在标题之前', () => {
    /* 官方 `Koe`：唯一带 aria-pressed 的头部按钮，图标是自绘 12×11，tooltip `tooltips.sidePanel`（侧边栏） */
    /* DOM 顺序：sidePanel 开关在标题下拉之前（官方左组 = sidePanel + 标题） */
    const sideAt = header.indexOf('onClick={onToggleArtifactPanel}');
    const titleAt = header.indexOf('onClick={onToggleConversationMenu}');
    expect(sideAt).toBeGreaterThan(-1);
    expect(titleAt).toBeGreaterThan(sideAt);
    expect(header).toContain('aria-pressed={artifactPanelOpen}');
    expect(header).toContain("t('侧边栏')");
    expect(header).toContain('<OfficialSidePanelIcon size={18} />');
    expect(header).toContain('bg-white/[0.12] text-chat-foreground hover:bg-white/[0.18]');
    expect(header).toContain('h-1.5 w-1.5 rounded-full bg-[#90C4E5] ring-2 ring-chat-background');
    /* 官方头部根类串（`V(ij,'pr-4 border-b border-white/[0.06]', …)`，空会话补 `border-b-0`） */
    expect(header).toContain('flex items-stretch justify-between gap-2 pt-4 pb-1 pr-4');
    expect(header).toContain("hasMessages ? 'border-b border-white/[0.06]' : 'border-b-0'");
    /* 官方标题占位：没有消息时显示 `tooltips.newChat`（新建对话） */
    expect(header).toContain("const title = hasMessages ? (conversationTitle ?? '') : t('新建对话');");
  });

  it('artifact（头脑风暴）面板按官方 `Hoe` 的类串与文案落地', () => {
    const panel = read('src/components/chat/AgentArtifactPanel.tsx');
    /* 官方根类串 + aria-label */
    expect(panel).toContain('shadow-[0_8px_30px_rgba(0,0,0,0.5)]');
    expect(panel).toContain('aria-label="Side panel"');
    /* 官方常量：默认 320 / 下限 320（`cp`）/ 上限 520（`dp`）/ key `artifact-panel-width` */
    expect(panel).toContain('const ARTIFACT_PANEL_DEFAULT_WIDTH = 320;');
    expect(panel).toContain('const ARTIFACT_PANEL_MIN_WIDTH = 320;');
    expect(panel).toContain('const ARTIFACT_PANEL_MAX_WIDTH = 520;');
    expect(panel).toContain("const ARTIFACT_PANEL_WIDTH_KEY = 'artifact-panel-width';");
    /* 官方两条拖拽条：左缘左右拖（col）+ 底缘上下拖（row）；都是三点 bg-white/40 */
    expect(panel).toContain('cursor-col-resize');
    expect(panel).toContain('cursor-row-resize');
    expect(panel).toContain('rounded-full bg-white/40');
    expect(panel).toContain("const ARTIFACT_PANEL_HEIGHT_KEY = 'artifact-panel-height';");
    /* 官方文案（i18n zh 逐字）。
       ⚠️ `'更新'` / `'更新中'` / `'Agent 正忙——完成后再试'` **已按官方移除**：
       live 的 `cst`（artifact 面板）**不消费** `updating` / `agentBusy` / `onUpdate`
       （调用点 @2775490/@2775502/@2776335 传了，但 destructure 里没有、函数体 0 引用 ⇒ 死参数），
       `chatAdapter.artifactPanel.{update,updating,updateBusyHint}` 也**无调用点**
       ⇒ MTV 原先那颗「更新」键是反向多做，已删除（覆盖表 §6 #9）。 */
    for (const label of ['收起', '添加到画布', '在对话中讨论', '暂无内容', '开始对话，内容会自动同步到这里。', '编辑', '保存', '取消', '文件', '暂无输出']) {
      expect(panel).toContain(`t('${label}')`);
    }
    expect(panel).not.toContain("t('更新')");
    expect(panel).not.toContain("t('更新中')");
  });

  it('官方 chat 专属色键必须同时有 config 与变量（否则官方类名整块惰性）', () => {
    const tw = read('tailwind.config.js');
    const base = read('src/styles/base.css');
    expect(tw).toContain("'chat-background': 'var(--chat-background)'");
    expect(tw).toContain("'chat-foreground': 'var(--chat-foreground)'");
    expect(base).toContain('--chat-background: #141414;');
    expect(base).toContain('--chat-foreground: #d4d4d8;');
  });

  it('头部不再有官方没有的四个面板入口', () => {
    for (const label of ['智能体中心', '任务中心', '项目记忆', '子智能体']) {
      expect(header).not.toContain(`t('${label}')`);
    }
    /* 面板本体也不应再渲染这四个浮层 */
    const panel = read('src/components/chat/ChatPanel.tsx');
    for (const comp of ['ProjectMemoryPanel', 'SubAgentPanel', 'AgentCenterPanel', 'AgentTaskCenter']) {
      expect(panel).not.toContain(comp);
    }
  });

  it('头部不做官方没有的两行重排（官方 360px 宽也是单行 60px）', () => {
    const panels = read('src/styles/panels.css');
    expect(chatCss).not.toContain('@container chat-panel (max-width: 620px)');
    expect(panels).not.toContain('@container chat-panel (max-width: 480px)');
    /* 任何针对头部容器的 grid 模板都属于两行重排 */
    const headerGrid = /\.chat-panel-header\s*\{[^}]*grid-template-columns/s;
    expect(headerGrid.test(panels)).toBe(false);
    expect(headerGrid.test(chatCss)).toBe(false);
  });

  it('任务只保留官方的「停止」，暂停/继续/跳过/重新规划/回退画布修改全部移除', () => {
    const timeline = read('src/components/chat/AgentTaskTimeline.tsx');
    for (const gone of ["t('暂停')", "t('继续')", "t('跳过此步')", "t('重新规划')", "t('回退任务画布修改')"]) {
      expect(timeline).not.toContain(gone);
    }
    expect(timeline).toContain("t('停止')");
    /* 控件契约里也不应再有这几个回调 */
    for (const prop of ['onPause', 'onResume', 'onSkip', 'onReplan', 'onRewind']) {
      expect(timeline).not.toContain(`${prop}:`);
    }
    const panel = read('src/components/chat/ChatPanel.tsx');
    for (const prop of ['onPause:', 'onResume:', 'onSkip:', 'onReplan:', 'onRewind:']) {
      expect(panel).not.toContain(prop);
    }
  });
});
