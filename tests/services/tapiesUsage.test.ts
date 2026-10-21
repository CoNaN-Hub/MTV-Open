/**
 * 「Tapies 用量」本地口径的回归测试。
 *
 * ★ 断言用的样本是**官方真机数据**：直接调官方
 *   `GET /api/billing/v2/tapies/usage?usageSubject=total`（登录态，只读）
 *   拿到的 `daily[]`（15 个非零日）与 `summary`（477 / 120 / 9.15 / 15 / 4）。
 *   这里把 `daily[]` 重放给 `summarizeUsage`，要求**逐项重现官方 summary**
 *   ⇒ 锁死 `services/usage/tapiesUsage.ts` 里那 5 个 KPI 的口径。
 */
import { describe, expect, it } from 'vitest';

import {
  USAGE_RANGE_DAYS,
  computeLocalAgentUsage,
  expandWindowKeys,
  summarizeUsage,
  toDateKey,
  usageWindow,
  type TapiesUsagePoint,
} from '../../src/services/usage/tapiesUsage';
import type { AgentTask } from '../../src/types/agent';

/** 官方 `GET /api/billing/v2/tapies/usage?usageSubject=total` 的 `daily[]` 非零项（逐字）。 */
const OFFICIAL_NON_ZERO_DAYS: [string, number][] = [
  ['2026-07-08', 2],
  ['2026-09-01', 5],
  ['2026-09-11', 40],
  ['2026-09-14', 84],
  ['2026-09-15', 2],
  ['2026-09-16', 63],
  ['2026-09-17', 4],
  ['2026-09-28', 10],
  ['2026-09-29', 10],
  ['2026-10-01', 66],
  ['2026-10-03', 120],
  ['2026-10-06', 36],
  ['2026-10-10', 10],
  ['2026-10-12', 9],
  ['2026-10-13', 16],
];

/** 官方同一响应的 `summary`（逐字）。 */
const OFFICIAL_SUMMARY = {
  totalAmount: 477,
  peakDailyAmount: 120,
  weeklyAverageAmount: 9.15,
  activeDays: 15,
  longestActiveStreakDays: 4,
};

function officialPoints(): TapiesUsagePoint[] {
  const amounts = new Map(OFFICIAL_NON_ZERO_DAYS);
  const start = new Date(2025, 9, 17); // 官方 window.startDate
  const end = new Date(2026, 9, 16); // 官方 window.endDate
  return expandWindowKeys(start, end).map((key) => {
    const [y, m, d] = key.split('-').map(Number);
    return { key, date: new Date(y, m - 1, d), amount: amounts.get(key) ?? 0 };
  });
}

describe('tapiesUsage 口径（对齐官方 summary）', () => {
  it('窗口是 365 天，含今天', () => {
    const window = usageWindow(new Date(2026, 9, 16));
    expect(window.rangeDays).toBe(USAGE_RANGE_DAYS);
    expect(toDateKey(window.endDate)).toBe('2026-10-16');
    expect(toDateKey(window.startDate)).toBe('2025-10-17');
  });

  it('稠密 365 条 daily', () => {
    expect(officialPoints()).toHaveLength(365);
  });

  it('5 个 KPI 逐项复现官方 summary', () => {
    expect(summarizeUsage(officialPoints())).toEqual(OFFICIAL_SUMMARY);
  });

  it('空序列 ⇒ 全 0（不编数）', () => {
    expect(summarizeUsage([])).toEqual({
      totalAmount: 0,
      peakDailyAmount: 0,
      weeklyAverageAmount: 0,
      activeDays: 0,
      longestActiveStreakDays: 0,
    });
  });

  it('周均 = 总消耗 ÷ (365/7)，不是 ÷52', () => {
    expect(summarizeUsage(officialPoints()).weeklyAverageAmount).toBe(9.15);
    expect(Math.round((477 / 52) * 100) / 100).toBe(9.17); // ÷52 是错的
  });
});

/** 造一个带 `model_round_end` 事件的最小 `AgentTask`（只填被统计到的字段）。 */
function taskWith(id: string, createdAt: number, rounds: { at: number; input: number; output: number }[]): AgentTask {
  return {
    id,
    projectId: 'p',
    conversationId: 'c',
    createdAt,
    events: rounds.map((round, index) => ({
      id: `${id}-e${index}`,
      taskId: id,
      sequence: index,
      type: 'model_round_end' as const,
      timestamp: round.at,
      data: { inputTokens: round.input, outputTokens: round.output },
    })),
  } as unknown as AgentTask;
}

describe('computeLocalAgentUsage（MTV 口径：token，官方 NOT FOUND）', () => {
  const today = new Date();
  const at = (daysAgo: number, hour = 12) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, hour);
    return d.getTime();
  };

  it('把各轮 input+output token 落在自然日上，并复用官方那套 KPI 算法', () => {
    const usage = computeLocalAgentUsage([
      taskWith('t1', at(0), [
        { at: at(0, 9), input: 1000, output: 100 },
        { at: at(0, 10), input: 2000, output: 200 },
      ]),
      taskWith('t2', at(2), [{ at: at(2), input: 5000, output: 500 }]),
    ]);
    expect(usage.points).toHaveLength(365);
    expect(usage.roundCount).toBe(3);
    expect(usage.noTokenData).toBe(false);
    expect(usage.summary.totalAmount).toBe(8800);
    expect(usage.summary.peakDailyAmount).toBe(5500);
    expect(usage.summary.activeDays).toBe(2);
    expect(usage.summary.longestActiveStreakDays).toBe(1);
    expect(usage.summary.weeklyAverageAmount).toBe(Math.round((8800 / (365 / 7)) * 100) / 100);
  });

  it('连续两天有量 ⇒ 最长连续活跃 = 2', () => {
    const usage = computeLocalAgentUsage([
      taskWith('t1', at(1), [{ at: at(1), input: 10, output: 0 }]),
      taskWith('t2', at(0), [{ at: at(0), input: 10, output: 0 }]),
    ]);
    expect(usage.summary.longestActiveStreakDays).toBe(2);
  });

  it('完全没有 agentTasks ⇒ 空序列 + noTokenData（不编数，走官方「暂无用量数据」态）', () => {
    const usage = computeLocalAgentUsage([]);
    expect(usage.points).toEqual([]);
    expect(usage.noTokenData).toBe(true);
    expect(usage.summary).toEqual({
      totalAmount: 0,
      peakDailyAmount: 0,
      weeklyAverageAmount: 0,
      activeDays: 0,
      longestActiveStreakDays: 0,
    });
  });

  it('任务无事件但有 metrics ⇒ 退到任务级 token（本机真实数据）', () => {
    const task = {
      id: 't9',
      projectId: 'p',
      conversationId: 'c',
      createdAt: at(0),
      events: [],
      metrics: { inputTokens: 77, outputTokens: 3 },
    } as unknown as AgentTask;
    const usage = computeLocalAgentUsage([task]);
    expect(usage.summary.totalAmount).toBe(80);
    expect(usage.noTokenData).toBe(false);
  });
});
