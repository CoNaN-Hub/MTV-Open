/**
 * services/usage/tapiesUsage —— 「Tapies 用量」看板的**本地口径**数据层。
 *
 * ## 官方（服务端）是什么样（产物级取证，逐字）
 *
 * 官方页面组件：`live-assets-r127/index-CsQaPZ-H.js`@1184600-1188000（组件本体）、
 * @1185539 `billingModule.tapiesUsage.metrics.totalUsed` 等 5 个 KPI 的 i18n key。
 * 官方请求：`live-assets-r127/vendor-packages-CvEFn1fJ.js`@761317
 *   `getUsage:(e={})=>Ae.Get(Te.stripev2("tapies/usage"),{params:e})`
 *   而 @745561 `stripev2:e=>\`/api/billing/v2${e?`/${e}`:""}\``
 *   ⇒ **`GET /api/billing/v2/tapies/usage?usageSubject=total|agent`**
 *
 * 官方响应形状（`index-CsQaPZ-H.js`@1164790 `XF={totalAmount:0,...}`、@1165962 选择器）：
 * ```
 * { code: 0, data: {
 *     usageSubject: 'total' | 'agent',
 *     window: { startDate: '2025-10-17', endDate: '2026-10-16', rangeDays: 365 },
 *     daily:  [{ date: 'YYYY-MM-DD', amount: string }],   // 稠密 365 条，含 0
 *     summary: { totalAmount, peakDailyAmount, weeklyAverageAmount, activeDays, longestActiveStreakDays },
 * } }
 * ```
 *
 * ### 5 个 KPI 的口径 —— 分两层，**别混淆**
 *
 * **① 产物证据（客户端）**：官方产物里**没有**任何求和/取最大/除法/连续段的代码 ——
 * `summary` 是服务端算好后客户端**原样透传**的（`i5` 选择器 @1165962 只做 `_5` 映射，
 * 5 个字段直接取自 `data.summary.*`）。⇒ 纯读产物，官方口径 = **NOT FOUND**。
 *
 * **② 运行期证据（真机）**：用官方页面登录态直接拉
 * `GET /api/billing/v2/tapies/usage?usageSubject=total`，把 `daily[]` 自己重算一遍，
 * 与 `summary` **逐项吻合**（实测样本 `477 / 120 / 9.15 / 15 / 4`，
 * 本地重算 `477 / 120 / 477÷(365/7)=9.15 / 15 / 4`）。⇒ 下列口径是**实测反推**，
 * 有运行期证据，但**不是**从产物里读出来的常量。
 *
 * | KPI | 官方字段 | 实测口径 |
 * |---|---|---|
 * | 总消耗 Tapies | `totalAmount` | `Σ daily[].amount` |
 * | 单日峰值 | `peakDailyAmount` | `max(daily[].amount)` |
 * | 周均消耗 Tapies | `weeklyAverageAmount` | `totalAmount / (rangeDays/7)`，2 位小数 |
 * | 活跃天数 | `activeDays` | `count(amount > 0)` |
 * | 最长连续活跃天数 | `longestActiveStreakDays` | `amount > 0` 的最长连续天数 |
 *
 * 实测样本：`totalAmount=477 / peak=120 / weekly=9.15 / active=15 / streak=4`，
 * 本地重算 `477 / 120 / 477÷(365/7)=9.15 / 15 / 4` —— 全部一致。
 * ⚠️ 其中 `weeklyAverageAmount` 的分母是 `rangeDays/7`（≈52.14）**由实测反推**：
 * `477/52=9.17 ≠ 9.15`，`477/(365/7)=9.1479→9.15 ✓`。这是**推断**，不是产物常量。
 *
 * ### 热力图
 * 官方 `daily` 是**稠密**序列（窗口内每一天都有条目，无消费为 0），
 * 前端按 7 天/列铺成 53 列（`index-CsQaPZ-H.js`@1167631 `f5` 分列函数）。
 *
 * ## MTV 侧：**没有**服务端 Tapies 账本 ⇒ 只能用本机数据等价实现
 *
 * · **总用量**：本机输出历史（`store.outputHistoryRecords`）里**能定价**的记录，
 *   用与「账单记录」页**同一套算法**（`estimateWithBilling` + 连接价目表）折成积分，
 *   再按 `record.timestamp` 落到自然日 ⇒ 与官方 `daily[]` 同构。
 * · **Agent 用量**（★ 2026 用户追加：不许是空壳）：官方 `usageSubject=agent` 是**服务端按
 *   Agent 归因的 Tapies 消耗**，MTV 没有这个账本 ⇒ 严格等价口径 **NOT FOUND**。
 *   但 MTV **有真实的 Agent 运行记录**：`store.agentTasks[].events[]` 里
 *   `type === 'model_round_end'` 的事件带 `data.inputTokens / data.outputTokens`
 *   （`src/types/agent.ts`@157 `AgentEvent.timestamp` 是**该轮的本地时间戳**，
 *    `data` 形状见 @139 `AgentEventData`；实测一轮 `inputTokens: 102284, outputTokens: 202`）。
 *   ⇒ Agent tab **用 token 合计**填同一套 5 个 KPI 与 365 天热力图，口径 = 「MTV 口径
 *   （官方 NOT FOUND）」：把每轮 token 落在 `event.timestamp` 的自然日上，
 *   再用**与官方同一套**求和/峰值/活跃天数/连续段算法（见 `summarizeUsage`）。
 *   ⚠️ **单位不同**：官方是 Tapies，MTV Agent tab 是 **token** ⇒ 界面标签不写「Tapies」
 *   （见 `UsageDashboard.tsx` 里的 `AgentMetrics` 标注），**不把 token 冒充 Tapies**。
 *   ⚠️ 拿不到的：官方 `summary.weeklyAverageAmount` 的服务端四舍五入策略、以及
 *   「哪些消耗算 Agent」的服务端归因规则 ⇒ **NOT FOUND**，本模块不做任何猜测性归因，
 *   只统计**本机 agentTasks 里真实记录到的 model round token**。
 *
 * ⚠️ 与官方的其余偏离（都写在这里，不在界面上假装是账单）：
 *   · 单价来自**本机连接价目表**，不是官方结算单；
 *   · 价格表覆盖不到的节点类型（视频/音频/文本…）**不计入**，只报 `unknownCount`；
 *   · 输出历史是**当前项目 + 分页**的（`historyHasMore`），不是全账号全量。
 */
import type { AppConfig } from '../../types';
import type { AgentTask } from '../../types/agent';
import { resolveCreditConnection } from '../ai/creditConnection';
import { resolveOutgoingImageQuality } from '../ai/imageQuality';
import { estimateWithBilling, loadCreditPriceTable, type CreditPriceTable } from '../ai/creditEstimate';
import type { OutputHistoryEntry } from '../../types';

/** 与 `BillingRecordsSettings.tsx`@89 同一个入参口径。 */
export type UsageCreditConfig = Pick<AppConfig, 'providers' | 'generalModels'>;

/** 官方 `index-CsQaPZ-H.js`@1166531 `co={agent:1,total:0}` 的取值域。 */
export type TapiesUsageScope = 'total' | 'agent';

/** 官方 `XF={totalAmount:0,peakDailyAmount:0,weeklyAverageAmount:0,activeDays:0,longestActiveStreakDays:0}`@1164790 */
export interface TapiesUsageSummary {
  totalAmount: number;
  peakDailyAmount: number;
  weeklyAverageAmount: number;
  activeDays: number;
  longestActiveStreakDays: number;
}

/** 官方 `daily[]` 的一条；`key` 就是官方 `date`（`YYYY-MM-DD`），热力图按它做 React key。 */
export interface TapiesUsagePoint {
  date: Date;
  key: string;
  amount: number;
}

export interface TapiesUsageDataset {
  points: TapiesUsagePoint[];
  summary: TapiesUsageSummary;
  loading: boolean;
  hasError: boolean;
  isEmpty: boolean;
  /** 本机口径专有：因价目表缺失**没能计价**的条数（不编数，只报数）。 */
  unknownCount: number;
  /** 本机口径专有：该 scope 的口径来源。`NOT_FOUND` ⇒ 界面留空。 */
  source: 'local-estimate' | 'NOT_FOUND';
}

export const EMPTY_USAGE_SUMMARY: TapiesUsageSummary = {
  totalAmount: 0,
  peakDailyAmount: 0,
  weeklyAverageAmount: 0,
  activeDays: 0,
  longestActiveStreakDays: 0,
};

/** 官方 `window.rangeDays`（`GET /api/billing/v2/tapies/usage` 实测返回 365）。 */
export const USAGE_RANGE_DAYS = 365;

/* ────────────────────────── 日期工具（官方 @1164790 起同一套） ────────────────────────── */

/** 官方 @1165307 `t5`：把 `YYYY-MM-DD` 解析成**本地** Date（非法返回 null）。 */
function parseDateKey(key: string): Date | null {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** 官方 @1165307 前的 `ZF`：Date → `YYYY-MM-DD`（本地时区，逐字同官方）。 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 官方 @1165307 `t5`：把 `window.startDate..endDate` 展开成稠密的每日 key 列表。 */
export function expandWindowKeys(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/** 官方窗口语义：`rangeDays` 天，**含**今天（实测 endDate=今天，startDate=今天-364）。 */
export function usageWindow(today = new Date()): { startDate: Date; endDate: Date; rangeDays: number } {
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (USAGE_RANGE_DAYS - 1));
  return { startDate, endDate, rangeDays: USAGE_RANGE_DAYS };
}

/* ────────────────────────── 官方 5 个 KPI 的算法（实测反推确认） ────────────────────────── */

/** 官方 `r5=.95` / `v5` ≈ 95 分位；这里保留给热力图强度上限用（**逐字同官方**）。 */
export const HEATMAP_PERCENTILE = 0.95;

export function summarizeUsage(points: TapiesUsagePoint[], rangeDays = USAGE_RANGE_DAYS): TapiesUsageSummary {
  if (points.length === 0) return { ...EMPTY_USAGE_SUMMARY };
  let total = 0;
  let peak = 0;
  let active = 0;
  let streak = 0;
  let best = 0;
  for (const point of points) {
    const amount = point.amount;
    total += amount;
    if (amount > peak) peak = amount;
    if (amount > 0) {
      active += 1;
      streak += 1;
      if (streak > best) best = streak;
    } else {
      streak = 0;
    }
  }
  /* 周均 = 总消耗 ÷ (rangeDays/7)，**2 位小数**（实测 477 → 9.15）。 */
  const weeklyAverageAmount = Math.round((total / (rangeDays / 7)) * 100) / 100;
  return {
    totalAmount: total,
    peakDailyAmount: peak,
    weeklyAverageAmount,
    activeDays: active,
    longestActiveStreakDays: best,
  };
}

/* ────────────────────────── 本地口径：输出历史 → 每日积分 ────────────────────────── */

export interface LocalUsageInput {
  records: OutputHistoryEntry[] | undefined;
  config: UsageCreditConfig;
}

interface PriceGroup {
  provider: string;
  model: string;
  resolution?: string;
  quality?: string;
  /** 该组每条记录的本地日 key（同组同价，逐条投放） */
  days: string[];
}

/**
 * 与 `BillingRecordsSettings.tsx`@104-126 **同一套算法**（手动价 → 价目表 → 兜底，
 * 再套连接分组倍率），只是把结果按 `timestamp` 落到自然日。
 *
 * 只对 **能定价**的记录计价：`estimateWithBilling` 返回 `null` 的（价目表查不到、
 * 或该连接 `billing.enabled === false`）**不计入**，计入 `unknownCount`。
 */
export async function computeLocalTapiesUsage(
  records: OutputHistoryEntry[] | undefined,
  config: UsageCreditConfig,
): Promise<{ points: TapiesUsagePoint[]; summary: TapiesUsageSummary; unknownCount: number }> {
  const window = usageWindow();
  const keys = expandWindowKeys(window.startDate, window.endDate);
  const all = records ?? [];

  /* 先按「连接 + 模型 + 档位」分组，同组只查一次价目表 */
  const groups = new Map<string, PriceGroup>();
  for (const record of all) {
    if (record.status !== 'success') continue;
    const params = (record.params ?? {}) as Record<string, unknown>;
    const resolution = typeof params.imageSize === 'string' ? params.imageSize : undefined;
    const quality = typeof params.quality === 'string' ? params.quality : undefined;
    const key = [record.provider, record.model, resolution ?? '', quality ?? ''].join('|');
    const day = toDateKey(new Date(record.timestamp));
    const group = groups.get(key);
    if (group) group.days.push(day);
    else groups.set(key, { provider: record.provider, model: record.model, resolution, quality, days: [day] });
  }

  const byDay = new Map<string, number>();
  let unknownCount = 0;

  if (groups.size > 0) {
    const targets = new Map<string, {
      baseUrl: string;
      billing: NonNullable<ReturnType<typeof resolveCreditConnection>>['billing'];
    }>();
    for (const group of groups.values()) {
      const target = resolveCreditConnection(group.provider, group.model, config);
      if (target) targets.set(target.baseUrl, { baseUrl: target.baseUrl, billing: target.billing });
    }
    const tables: Record<string, CreditPriceTable | null> = {};
    for (const [baseUrl, info] of targets) {
      tables[baseUrl] = await loadCreditPriceTable(info.baseUrl, info.billing);
    }

    for (const group of groups.values()) {
      const target = resolveCreditConnection(group.provider, group.model, config);
      if (!target) {
        unknownCount += group.days.length;
        continue;
      }
      const estimate = estimateWithBilling(
        target.baseUrl ? tables[target.baseUrl] ?? null : null,
        {
          modelId: target.modelId,
          quality: resolveOutgoingImageQuality(target.modelId, group.quality),
          resolution: group.resolution,
          count: 1,
        },
        target.billing,
        target.discount?.ratio ?? null,
      );
      if (!estimate) {
        unknownCount += group.days.length;
        continue;
      }
      for (const day of group.days) byDay.set(day, (byDay.get(day) ?? 0) + estimate.credits);
    }
  }

  const points: TapiesUsagePoint[] = keys
    .filter((key) => byDay.has(key))
    .map((key) => ({ date: parseDateKey(key) as Date, key, amount: byDay.get(key) ?? 0 }));
  /* 官方 `daily[]` 是**稠密**的（窗口内每天都有一条）⇒ 只要窗口内有消费就铺满 365 天，
     没有消费的日子 amount=0。窗口内**一条都没有** ⇒ 返回空序列，走官方「暂无用量数据」态。 */
  const dense = points.length === 0
    ? []
    : keys.map((key) => ({ date: parseDateKey(key) as Date, key, amount: byDay.get(key) ?? 0 }));

  return { points: dense, summary: summarizeUsage(dense, window.rangeDays), unknownCount };
}

/* ──────────────────── Agent 用量（MTV 口径：token 合计，官方 NOT FOUND） ──────────────────── */

export interface LocalAgentUsage {
  points: TapiesUsagePoint[];
  summary: TapiesUsageSummary;
  /** 本机口径专有：参与统计的 `model_round_end` 轮次数。 */
  roundCount: number;
  /** 本机口径专有：本机 agentTasks 里**一个 token 事件都没有**时为 true（如实留空）。 */
  noTokenData: boolean;
}

/**
 * **MTV 口径（官方 NOT FOUND）** —— Agent 用量 = 本机 `agentTasks` 里
 * `type === 'model_round_end'` 事件的 `inputTokens + outputTokens`，按 `event.timestamp`
 * 落到自然日；5 个 KPI 与热力图复用**与官方同一套**算法（`summarizeUsage`）。
 *
 * ⚠️ 单位是 **token，不是 Tapies**：官方 `usageSubject=agent` 由服务端按 Agent 归因 Tapies，
 * 该归因规则与计费口径在产物里 **NOT FOUND**，本模块**不做猜测性归因**、**不换算成 Tapies**。
 */
export function computeLocalAgentUsage(tasks: AgentTask[] | undefined): LocalAgentUsage {
  const window = usageWindow();
  const keys = expandWindowKeys(window.startDate, window.endDate);
  const byDay = new Map<string, number>();
  let roundCount = 0;
  let noTokenData = true;

  for (const task of tasks ?? []) {
    for (const event of task.events ?? []) {
      if (event.type !== 'model_round_end') continue;
      const data = event.data;
      if (!data) continue;
      const input = Number.isFinite(data.inputTokens) ? Number(data.inputTokens) : 0;
      const output = Number.isFinite(data.outputTokens) ? Number(data.outputTokens) : 0;
      /* 有事件但两个字段都缺 ⇒ 如实按 0 计（事件确实发生过，只是没记 token）；
         统计"是否完全没有 token 数据"时也只认真的取到了数的轮次。 */
      if (data.inputTokens !== undefined || data.outputTokens !== undefined) noTokenData = false;
      const timestamp = Number.isFinite(event.timestamp) ? event.timestamp : task.createdAt;
      const day = toDateKey(new Date(timestamp));
      byDay.set(day, (byDay.get(day) ?? 0) + input + output);
      roundCount += 1;
    }
    /* 事件表可能没落盘（老任务）⇒ 退到任务级 `metrics`（同样是本机真实数据，不是编的）。
       只在**该任务一个 model_round_end 事件都没有**时才用，避免重复计数。 */
    const hasRoundEvents = (task.events ?? []).some((event) => event.type === 'model_round_end');
    if (!hasRoundEvents && task.metrics) {
      const input = Number.isFinite(task.metrics.inputTokens) ? task.metrics.inputTokens : 0;
      const output = Number.isFinite(task.metrics.outputTokens) ? task.metrics.outputTokens : 0;
      if (input > 0 || output > 0) {
        noTokenData = false;
        const day = toDateKey(new Date(task.createdAt));
        byDay.set(day, (byDay.get(day) ?? 0) + input + output);
      }
    }
  }

  /* 与官方同构：窗口内一条都没有 ⇒ 空序列（走官方「暂无用量数据」态）；否则铺满 365 天。 */
  const dense: TapiesUsagePoint[] = byDay.size === 0
    ? []
    : keys.map((key) => ({ date: parseDateKey(key) as Date, key, amount: byDay.get(key) ?? 0 }));

  return {
    points: dense,
    summary: summarizeUsage(dense, window.rangeDays),
    roundCount,
    noTokenData,
  };
}
