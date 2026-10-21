/**
 * 会话下拉（官方唯一的会话/新建入口）守卫
 *
 * 官方依据（ground truth §2）：
 *   · 容器 `w-72 p-1.5 rounded-xl`、`sideOffset: 8`、`align: start`
 *   · 每行**只有**重命名 + 删除（官方无置顶/归档/分享/复制/分支）
 *   · 标题触发键 `flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium` + chevron @14
 *   · 空态文案 `conversation.noHistory`；行内时间 `conversation.justNow` =「刚刚」
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_MENU_MAX_HEIGHT,
  CONVERSATION_MENU_OFFSET,
  CONVERSATION_MENU_WIDTH,
  formatConversationRelativeTime,
} from '../../src/components/chat/conversationMenuSpec';

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

describe('conversationMenuSpec · 官方常量与相对时间', () => {
  it('几何常量取官方值（288 / 8 / 400）', () => {
    expect(CONVERSATION_MENU_WIDTH).toBe(288);
    expect(CONVERSATION_MENU_OFFSET).toBe(8);
    expect(CONVERSATION_MENU_MAX_HEIGHT).toBe(400);
  });

  it('一分钟内用官方「刚刚」，其余走相对时间', () => {
    expect(formatConversationRelativeTime(Date.now(), 'zh-CN', '刚刚')).toBe('刚刚');
    const fiveMin = Date.now() - 5 * 60_000;
    expect(formatConversationRelativeTime(fiveMin, 'zh-CN', '刚刚')).toContain('5');
    const threeHours = Date.now() - 3 * 60 * 60_000;
    expect(formatConversationRelativeTime(threeHours, 'zh-CN', '刚刚')).toContain('3');
  });
});

describe('ConversationMenu · 官方形态', () => {
  const menu = read('src/components/chat/ConversationMenu.tsx');
  const header = read('src/components/chat/ChatHeader.tsx');

  it('容器是官方 `w-72 p-1.5 rounded-xl`，且只有重命名与删除两个操作', () => {
    expect(menu).toContain('w-72 p-1.5 rounded-xl');
    expect(menu).toContain("t('重命名')");
    expect(menu).toContain("t('删除')");
    /* 官方没有的操作一律不得出现 */
    for (const absent of ['置顶', '归档', '分享', '复制会话']) {
      expect(menu).not.toContain(absent);
    }
  });

  it('标题即官方的会话下拉触发键（含 chevron @14 与 menu 语义）', () => {
    expect(header).toContain('flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium');
    expect(header).toContain('<OfficialChevronDownIcon');
    expect(header).toContain('aria-haspopup="menu"');
  });

  it('三语都补齐了官方空态/未命名/刚刚词条', () => {
    for (const locale of ['en-US', 'ja-JP', 'ko-KR']) {
      const dict = read(`src/i18n/locales/${locale}/chat.ts`);
      expect(dict).toContain("'未命名对话'");
      expect(dict).toContain("'暂无历史记录'");
      expect(dict).toContain("'刚刚'");
    }
  });

  it('官方第 4 颗「聊天记录」是同一份下拉的第二个触发器（align end）', () => {
    expect(header).toContain('<OfficialHistoryIcon');
    expect(header).toContain("t('聊天记录')");
    expect(menu).toContain("align?: 'start' | 'end'");
    const panel = read('src/components/chat/ChatPanel.tsx');
    expect(panel).toContain('align="end"');
  });

  it('非官方的 DEV 消息层已整体移除', () => {
    for (const gone of [
      'src/components/chat/AgentMessageList.tsx',
      'src/components/chat/AgentChatMessages.tsx',
      'src/components/chat/AgentMarkdown.tsx',
      'src/components/chat/AgentCodeBlock.tsx',
      'src/components/chat/agentMessageAdapter.ts',
      'src/components/chat/agentChatMessage.ts',
      'src/components/chat/agentMessageTime.ts',
      'src/types/agentMessage.ts',
      'src/styles/agent-chat.css',
    ]) {
      expect(existsSync(resolve(process.cwd(), gone)), `${gone} 应已删除`).toBe(false);
    }
    const messages = read('src/components/chat/ChatMessages.tsx');
    expect(messages).not.toContain('AgentChatMessages');
    expect(messages).not.toContain('mtv:agent-chat-layer');
    expect(messages).not.toContain('agent-layer-toggle');
  });
});
