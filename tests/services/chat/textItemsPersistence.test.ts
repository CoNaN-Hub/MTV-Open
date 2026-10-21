/**
 * `textItems`（流式正文分段）**落库/恢复**回归 —— 覆盖表 §34.4 记的那笔「已知代价」。
 *
 * 官方流式协议把每段正文 chunk 按到达顺序追加成一个 `text` item；MTV 的 `content` 只是最终
 * 拼接串 ⇒「中途正文的到达位置」必须单独落库，否则刷新后折叠面板里的中途说明全丢。
 *
 * 这里走**真实**的 `chatHistoryService` 落库路径（`fake-indexeddb`，`tests/setup.ts` 已全局装载）。
 * 验证分级 = **(b) 真 IndexedDB（fake-indexeddb）+ 真 service 代码路径**。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { STORE_CHAT_MESSAGES } from '../../../src/services/indexedDb/schema';
import {
  clearConversationMessages,
  loadMessages,
  persistMessage,
} from '../../../src/services/chat/chatHistoryService';
import type { ChatMessage } from '../../../src/types/chat';

const PROJECT_ID = 'p-text-items';
const CONVERSATION_ID = 'c-text-items';

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: CONVERSATION_ID,
    role: 'assistant',
    content: '我会先读剧本 这是最终回答',
    timestamp: 1_000,
    status: 'complete',
    ...over,
  };
}

async function roundTrip(over: Partial<ChatMessage> = {}): Promise<ChatMessage> {
  await persistMessage(message(over), PROJECT_ID, CONVERSATION_ID);
  const { messages } = await loadMessages(CONVERSATION_ID);
  return messages[0];
}

beforeEach(async () => {
  await clearConversationMessages(CONVERSATION_ID);
});

describe('`ChatMessage.textItems` 的持久化', () => {
  it('落库后能原样读回（含顺序与 `startedAt`）', async () => {
    const loaded = await roundTrip({
      textItems: [
        { content: '我会先读剧本', startedAt: 1_100 },
        { content: '这是最终回答', startedAt: 9_000 },
      ],
    });
    expect(loaded.textItems).toEqual([
      { content: '我会先读剧本', startedAt: 1_100 },
      { content: '这是最终回答', startedAt: 9_000 },
    ]);
    /* 正文本身不受影响。 */
    expect(loaded.content).toBe('我会先读剧本 这是最终回答');
  });

  it('没有分段（旧记录 / 单段）⇒ 字段缺省，渲染回落到整段正文', async () => {
    const loaded = await roundTrip();
    expect(loaded.textItems).toBeUndefined();
    expect(loaded.content).toBe('我会先读剧本 这是最终回答');
  });

  it('脏数据（非数组项 / 空正文 / 非法 `startedAt`）逐项丢弃，绝不抛错', async () => {
    const loaded = await roundTrip({
      /* 逐项校验发生在读回时（`fromTextItemsRecord`），所以这里直接塞进 store 的形状。 */
      textItems: [
        { content: '合法', startedAt: 5 },
        { content: '', startedAt: 6 },
        { content: '缺 startedAt' },
        null,
        'string',
        { startedAt: 7 },
      ] as unknown as ChatMessage['textItems'],
    });
    expect(loaded.textItems).toEqual([
      { content: '合法', startedAt: 5 },
      { content: '缺 startedAt', startedAt: 0 },
    ]);
  });

  it('store 名存在且可写（防止将来改 schema 时静默丢字段）', async () => {
    expect(STORE_CHAT_MESSAGES).toBe('chatMessages');
    const loaded = await roundTrip({ textItems: [{ content: 'x', startedAt: 1 }] });
    expect(loaded.textItems).toEqual([{ content: 'x', startedAt: 1 }]);
  });
});
