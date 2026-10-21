/**
 * 官方 `chatAdapter.agentEvent.*` 取词的**locale 索引**回归 + 时长格式 + 失败文案键位。
 *
 * 锁住三个已修的真 bug（全部以 live 官方 bundle 为口径）：
 *  1. `agentEventString(path, locale)` 用 `locale`（`'zh-CN'`）直接索引 `AGENT_EVENT_STRINGS`，
 *     而该表键是 `enUS/jaJP/koKR/zhCN` ⇒ **恒 miss、恒返回 key**，官方中文文案一个都取不到
 *     （MTV 的 Agent 步骤摘要因此恒走英文兜底）。
 *  2. `formatWorkDuration` 输出 `1m 30s`（分秒间多一个空格），官方 `kp` 是 `1m30s`。
 *     官方 live DOM 实测：`workSummaryWithDuration` + `kp(129)` ⇒ `处理了 2m9s`。
 *  3. viewMedia 失败文案的键在 `agentEvent.toolLabels.view_media_failed`，
 *     不在 `agentEvent.toolCallLine.*`。
 */
import { describe, expect, it } from 'vitest';
import { agentEventString } from '../src/services/chat/agentEventStrings';
import formatWorkDuration from '../src/components/chat/workDuration';

describe('agentEventString 的 locale 索引（官方 chatAdapter.agentEvent.*）', () => {
  it('zh-CN 能取到官方中文（此前恒 miss、恒返回 key）', () => {
    expect(agentEventString('workSummary', 'zh-CN')).toBe('已处理');
    expect(agentEventString('workSummaryWithDuration', 'zh-CN')).toBe('处理了 {{duration}}');
    expect(agentEventString('showLess', 'zh-CN')).toBe('收起');
    expect(agentEventString('showAll', 'zh-CN')).toBe('显示全部 {{count}} 个');
  });

  it('其余三语与官方逐字一致', () => {
    expect(agentEventString('workSummary', 'en-US')).toBe('Worked');
    expect(agentEventString('workSummaryWithDuration', 'en-US')).toBe('Worked for {{duration}}');
    expect(agentEventString('workSummary', 'ja-JP')).toBe('作業完了');
    expect(agentEventString('workSummaryWithDuration', 'ja-JP')).toBe('{{duration}} 作業');
    expect(agentEventString('workSummary', 'ko-KR')).toBe('작업 완료');
    expect(agentEventString('workSummaryWithDuration', 'ko-KR')).toBe('{{duration}} 작업');
  });

  it('失败文案在 toolLabels 组（不是 toolCallLine）', () => {
    expect(agentEventString('toolLabels.view_media_failed', 'zh-CN')).toBe('查看媒体失败');
    expect(agentEventString('toolLabels.view_media_failed', 'en-US')).toBe('Failed to look at media');
  });

  it('未知路径原样返回；未知 locale 与 MTV `normalizeLocale` 一致回落中文', () => {
    expect(agentEventString('nope.nope', 'zh-CN')).toBe('nope.nope');
    expect(agentEventString('workSummary', 'fr-FR')).toBe('已处理');
  });
});

describe('formatWorkDuration（官方 c1e → kp）', () => {
  it('官方 live DOM 实测值：129s ⇒ 2m9s', () => {
    expect(formatWorkDuration(129_000)).toBe('2m9s');
  });

  it('分秒之间没有空格；秒为 0 时只给 Nm', () => {
    expect(formatWorkDuration(90_000)).toBe('1m30s');
    expect(formatWorkDuration(60_000)).toBe('1m');
    expect(formatWorkDuration(120_000)).toBe('2m');
  });

  it('不足一分钟给 Ns；最小值钳到 1s', () => {
    expect(formatWorkDuration(5_000)).toBe('5s');
    expect(formatWorkDuration(59_400)).toBe('59s');
    expect(formatWorkDuration(400)).toBe('1s');
  });

  it('空/非法输入给空串', () => {
    expect(formatWorkDuration(0)).toBe('');
    expect(formatWorkDuration(null)).toBe('');
    expect(formatWorkDuration(undefined)).toBe('');
    expect(formatWorkDuration(Number.NaN)).toBe('');
  });
});
