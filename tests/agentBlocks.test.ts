/**
 * 官方**块模型**（`exe` / `PF` / `nie`）逐字回归 —— 覆盖表 §6 #2。
 *
 * 官方偏移（`vendor-pkg-canvas-ChpWx5JY.js`）：
 *   `exe` @25081 · `Bge`/`Uge` @20805 邻域 · `tT` @414033 · `fl` @414155 ·
 *   `UM` @2393102 · `Xnt`/`eie`/`Fx` @2393525–@2393678 · `Qnt` @2394025 ·
 *   `tie`/`IE`/`BM`/`jE`/`PF` @2394546 邻域 · `nie` @2394688
 *
 * 验证分级 = **(d) 源码级**（纯函数，逐字算法 + 偏移）。未做 (a) live CDP。
 */
import { describe, expect, it } from 'vitest';
import {
  BM,
  Fx,
  IE,
  PF,
  Qnt,
  UM,
  Xnt,
  bR,
  eie,
  exe,
  fl,
  jE,
  nie,
  tie,
  tT,
  yi,
} from '../src/services/chat/agentBlocks';

type Item = {
  type: string;
  content?: Record<string, unknown>;
  startedAt?: number;
  endedAt?: number;
};

function toolEvent(tool: string, extra: Record<string, unknown> = {}, timing: { startedAt?: number; endedAt?: number } = {}): Item {
  return { type: 'tool_event', content: { tool, status: 'completed', ...extra }, ...timing };
}

function text(content: string): Item {
  return { type: 'text', content };
}

describe('agentBlocks —— 官方分桶判据 `BM` / `jE` 逐字', () => {
  it('`tT` = `trim().toLowerCase() || null`（非字符串 ⇒ null）', () => {
    expect(tT('  Web_Search ')).toBe('web_search');
    expect(tT('   ')).toBeNull();
    expect(tT(42)).toBeNull();
  });

  it('`fl`：`websearch` / `web_search` 命中，大小写与前后空白被归一', () => {
    expect(fl('websearch')).toBe(true);
    expect(fl(' WEB_SEARCH ')).toBe(true);
    expect(fl('web_search_extra')).toBe(false);
  });

  it('`fl(yi(e))`：工具名经 `yi` 小写化后仍能命中 `web_search`', () => {
    expect(fl(yi(toolEvent('Web_Search')))).toBe(true);
  });

  it('`UM` / `eie`：取 `request.description`，没有则 `response.description`（都 trim）', () => {
    expect(UM({ description: '  hi  ' })).toBe('hi');
    expect(UM(null)).toBe('');
    expect(eie(toolEvent('x', { request: { description: ' req ' } }))).toBe('req');
    expect(eie(toolEvent('x', { response: { description: 'resp' } }))).toBe('resp');
  });

  it('`Fx` / `tie`：`tool_call_id` 优先于 `tool_use_id`；命中 `web_search` 字面', () => {
    expect(Fx(toolEvent('x', { tool_call_id: 'a', tool_use_id: 'b' }))).toBe('a');
    expect(Fx(toolEvent('x', { tool_use_id: 'b' }))).toBe('b');
    expect(tie(toolEvent('x', { tool_call_id: 'call_web-search_1' }))).toBe(true);
    expect(tie(toolEvent('x', { tool_call_id: 'call_other' }))).toBe(false);
  });

  it('`Qnt`：按 `query` / `search_query` / `searchQuery` / `q` 顺序找，先 `request` 后 `response`', () => {
    expect(Qnt(toolEvent('x', { request: { searchQuery: ' 红烧肉 ' } }))).toBe('红烧肉');
    expect(Qnt(toolEvent('x', { response: { q: 'web' } }))).toBe('web');
    expect(Qnt(toolEvent('x', { request: { query: '' } }))).toBe('');
  });

  it('`Xnt`：官方正则逐字（含 `web research on` / `web search for` / 中文触发词与空白或冒号分隔）', () => {
    expect(Xnt.exec('web search for cats')?.[1]).toBe('cats');
    expect(Xnt.exec('web research on dogs')?.[1]).toBe('dogs');
    expect(Xnt.exec('联网搜索：红烧肉做法')?.[1]).toBe('红烧肉做法');
    expect(Xnt.exec('搜索网页 天气预报')?.[1]).toBe('天气预报');
    expect(Xnt.exec('随便聊聊')?.[1]).toBeUndefined();
  });

  it('`IE`：优先 `Xnt` 捕词，否则 `tie` 命中时回落 `Qnt` 或描述本身', () => {
    /* 描述里带指令式前缀 ⇒ 捕出查询词。 */
    expect(IE(toolEvent('x', { request: { description: 'web search for cats' } }))).toBe('cats');
    /* 描述不带前缀、但 callId 含 websearch ⇒ 回落 `Qnt`。 */
    expect(IE(toolEvent('x', { tool_call_id: 'call_websearch_9', request: { query: 'dogs' } }))).toBe('dogs');
    /* 两者都没有 ⇒ 空串 ⇒ `BM` 的第三项为 false。 */
    expect(IE(toolEvent('x', { request: { description: '随便' } }))).toBe('');
  });

  it('`BM` 三项各自可独立命中；`jE` 只有命中才 `search`', () => {
    expect(BM(toolEvent('web_search'))).toBe(true);                       // fl(yi)
    expect(BM(toolEvent('x', { tool_call_id: 'call_websearch' }))).toBe(true); // tie
    expect(BM(toolEvent('x', { request: { description: '联网搜索：猫' } }))).toBe(true); // IE
    expect(BM(toolEvent('canvas_query'))).toBe(false);
    expect(jE(toolEvent('canvas_query'))).toBe('activity');
    expect(jE(toolEvent('web_search'))).toBe('search');
  });
});

describe('agentBlocks —— 官方 `PF` 连续分桶', () => {
  it('同 key 相邻才并入同桶，key 变了就新开桶', () => {
    const items = [
      toolEvent('web_search'),        // search
      toolEvent('websearch'),         // search（连续 ⇒ 同桶）
      toolEvent('canvas_query'),      // activity
      toolEvent('canvas_select'),     // activity（连续 ⇒ 同桶）
      toolEvent('web_search'),        // search（新桶）
    ];
    const buckets = PF(items);
    expect(buckets.map((bucket) => bucket.length)).toEqual([2, 2, 1]);
    expect(buckets.map((bucket) => jE(bucket[0]))).toEqual(['search', 'activity', 'search']);
  });

  it('空数组 ⇒ 空桶列表', () => {
    expect(PF([])).toEqual([]);
  });
});

describe('agentBlocks —— 官方 `exe` / `nie` 分块', () => {
  it('`bR`：工具名小写等于 `"agent"` 才起 subagent 块（大小写不敏感、名字不同不算）', () => {
    expect(bR(toolEvent('agent'))).toBe(true);
    expect(bR(toolEvent('Agent'))).toBe(true);
    expect(bR(toolEvent('agent_run_sub_agent'))).toBe(false);
  });

  it('`exe`：`agent` 项开块，之后 `startedAt <= agent.endedAt` 的项全部进 `children`', () => {
    const agent = toolEvent('agent', {}, { startedAt: 100, endedAt: 500 });
    const blocks = exe([
      text('前文'),
      agent,
      toolEvent('child_a', {}, { startedAt: 200 }),
      toolEvent('child_b', {}, { startedAt: 500 }),   // == endedAt ⇒ 归入（判据是 `>` 才切）
      toolEvent('after', {}, { startedAt: 501 }),     // > endedAt ⇒ 切出去
      text('后文'),
    ]);
    expect(blocks.map((block) => block.kind)).toEqual(['plain', 'subagent', 'plain']);
    const sub = blocks[1];
    expect(sub.kind).toBe('subagent');
    if (sub.kind !== 'subagent') throw new Error('unreachable');
    expect(sub.children).toHaveLength(2);
    expect((sub.children[0].content as { tool: string }).tool).toBe('child_a');
    /* 末尾的 plain 段含 `after` 与 `后文`。 */
    const tail = blocks[2];
    if (tail.kind !== 'plain') throw new Error('unreachable');
    expect(tail.items).toHaveLength(2);
  });

  it('`agent` 项缺 `endedAt` ⇒ 后面所有项都归入它的 children（官方判据要求两个 number）', () => {
    const agent = toolEvent('agent', {}, { startedAt: 100 });
    const blocks = exe([agent, toolEvent('a', {}, { startedAt: 999 }), text('尾')]);
    expect(blocks).toHaveLength(1);
    const sub = blocks[0];
    if (sub.kind !== 'subagent') throw new Error('unreachable');
    expect(sub.children).toHaveLength(2);
  });

  it('`nie`：subagent 块原样保留，plain 段按 `PF` 切成 bucket', () => {
    const agent = toolEvent('agent', {}, { startedAt: 100, endedAt: 150 });
    const blocks = nie([
      toolEvent('web_search'),
      toolEvent('canvas_query'),
      agent,
      text('x'),
    ]);
    expect(blocks.map((block) => block.kind)).toEqual(['bucket', 'bucket', 'subagent']);
    expect(blocks[0].kind === 'bucket' ? blocks[0].items.length : -1).toBe(1);
    expect(blocks[1].kind === 'bucket' ? blocks[1].items.length : -1).toBe(1);
  });
});
