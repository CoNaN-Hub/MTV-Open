/**
 * 官方「联网搜索来源」分流的回归：`Qtt` 卡片 / pill **互斥**（`Xtt = 3`）。
 *
 * live 官方逐字（`vendor-pkg-canvas-ChpWx5JY.js` 偏移 2367472）：
 * ```js
 * Qtt = sources => sources.filter(s => s.image).length < Xtt(3)
 *   ? { cards: [], pills: sources }
 *   : { cards: sources, pills: [] };
 * ```
 * MTV 此前把同一批 sources 同时喂给卡片列表与 pill 列表 —— 这是错的。
 * `+N` 文案也必须走官方键 `chatAdapter.agentEvent.webSearch.more`（zh `+{{count}} 个`，fr `+{{count}}`）。
 */
import { describe, expect, it } from 'vitest';
import { splitWebSources, WEB_SOURCE_THUMBNAIL_THRESHOLD } from '../src/services/chat/webSourceDisplay';
import { agentEventString } from '../src/services/chat/agentEventStrings';

const source = (n: number, image?: string) => ({ url: `https://example.com/${n}`, title: `S${n}`, image });

describe('splitWebSources（官方 Qtt）', () => {
  it('阈值常量是 3', () => {
    expect(WEB_SOURCE_THUMBNAIL_THRESHOLD).toBe(3);
  });

  it('带图来源 < 3 ⇒ 全部 pill、卡片为空', () => {
    const sources = [source(1, 'a.png'), source(2, 'b.png'), source(3)];
    const { cards, pills } = splitWebSources(sources);
    expect(cards).toEqual([]);
    expect(pills).toHaveLength(3);
  });

  it('带图来源 = 3 ⇒ 全部卡片、pill 为空', () => {
    const sources = [source(1, 'a.png'), source(2, 'b.png'), source(3, 'c.png')];
    const { cards, pills } = splitWebSources(sources);
    expect(cards).toHaveLength(3);
    expect(pills).toEqual([]);
  });

  it('完全无图 ⇒ pill；两套永不同时非空', () => {
    const none = splitWebSources([source(1), source(2)]);
    expect(none.cards).toEqual([]);
    expect(none.pills).toHaveLength(2);
    for (const n of [0, 1, 2, 3, 4, 5]) {
      const sources = Array.from({ length: n }, (_, index) => source(index, index < 2 ? 'x.png' : undefined));
      const { cards, pills } = splitWebSources(sources);
      expect(cards.length > 0 && pills.length > 0).toBe(false);
    }
  });
});

describe('来源 `+N` 文案（官方 chatAdapter.agentEvent.webSearch.more）', () => {
  it('zh 是 `+{{count}} 个`', () => {
    expect(agentEventString('webSearch.more', 'zh-CN')).toBe('+{{count}} 个');
    expect(agentEventString('webSearch.more', 'zh-CN').replace(/\{\{count\}\}/g, '3')).toBe('+3 个');
  });

  it('en 是 `+{{count}} more`', () => {
    expect(agentEventString('webSearch.more', 'en-US')).toBe('+{{count}} more');
  });
});
