/**
 * creditBalance —— 读「我在这个厂商那里还有多少钱」，折算成**积分**。
 *
 * ## 为什么单独一个文件
 * 余额与「单价」是两件事：单价来自价目表（`creditEstimate.ts`），余额来自**账户端点**，
 * 两者凭证、路径、单位都不一样。混在一起会让价目表逻辑被账户逻辑污染。
 *
 * ## 凭证（实测结论，2026）
 * | 厂商 | 用什么读 | 端点 |
 * |---|---|---|
 * | new-api 系（土豆） | **系统访问令牌**（控制台 → 个人设置 → 生成） | `GET /api/user/self` → `data.quota` |
 * | apimart | API Key 即可 | `GET /user/balance` → `remain_credits` |
 *
 * ⚠️ new-api **不接受 API Key**：`/api/user/self` 会返回 `Unauthorized, invalid access token`，
 *    而 OpenAI 计费端点 `/v1/dashboard/billing/subscription` 给的是 `hard_limit_usd = 1e8`
 *    （软/硬/系统三个 limit 完全相同的**哨兵值**，不是真余额），
 *    `/v1/dashboard/billing/usage` 只有**累计已用**。全都实测过，别拿它们当余额 ✓
 *
 * ## 单位
 * new-api 的 `quota` 是内部计数，要 ÷ `quota_per_unit`（土豆 = 500000）才是计价单位（元）；
 * 再乘连接的 `creditsPerUnit`（默认 100）得到积分。apimart 那种直接给积分数，配 `price` 单位即可。
 *
 * 读不到就返回 `null`（顶部按钮显示 `-`），绝不猜数。
 */
import { corsSafeFetch } from './httpTransport';
import { creditsFromUnitPrice, creditsPerUnit } from './creditEstimate';
import type { ProviderBillingConfig } from '../../types';

/** new-api 的 quota 基数默认值（`/api/status` 的 `quota_per_unit`；土豆实测 500000）。 */
export const DEFAULT_QUOTA_PER_UNIT = 500000;

export interface ConnectionBalance {
  /** 计价单位下的余额（元 / 美元…），用于「≈ ¥12.34」这类展示 */
  priceAmount: number;
  /** 折算后的积分 */
  credits: number;
  /** 实际请求的地址（便于排查） */
  endpoint: string;
}

/**
 * 读失败时的**原因**。刻意把服务端的原话带出来 ——
 * 只显示一个 `-` 的话，「令牌没填」「令牌填成了 API Key」「缺 New-Api-User 头」全都看不出来。
 */
export interface ConnectionBalanceFailure {
  error: string;
}

/** 余额查询地址：相对站点根解析；填绝对地址时原样使用。 */
export function balanceEndpoint(baseUrl: string, billing?: ProviderBillingConfig): string | null {
  const path = (billing?.balancePath ?? '').trim() || '/api/user/self';
  try {
    const origin = new URL(baseUrl).origin;
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
}

/** 充值页地址：默认 new-api 控制台的 `/wallet`（土豆实测的个人中心/钱包页）。 */
export function topUpEndpoint(baseUrl: string, billing?: ProviderBillingConfig): string | null {
  const path = (billing?.topUpPath ?? '').trim() || '/wallet';
  try {
    return new URL(path, new URL(baseUrl).origin).toString();
  } catch {
    return null;
  }
}

/** 按点号路径从响应里取值：`data.quota` / `remain_credits`。 */
export function readPath(payload: unknown, path: string): unknown {
  let current: unknown = payload;
  for (const key of path.split('.')) {
    if (!key) continue;
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 从响应体解析余额；结构不认识 / 取不到数就返回 null。
 * 纯函数，便于单测。
 */
export function parseConnectionBalance(
  payload: unknown,
  billing?: ProviderBillingConfig,
): { priceAmount: number; credits: number } | null {
  const amountPath = (billing?.balanceAmountPath ?? '').trim() || 'data.quota';
  const raw = toNumber(readPath(payload, amountPath));
  if (raw === null) return null;
  const unit = billing?.balanceAmountUnit ?? 'quota';
  const quotaPerUnit = billing?.balanceQuotaPerUnit && billing.balanceQuotaPerUnit > 0
    ? billing.balanceQuotaPerUnit
    : DEFAULT_QUOTA_PER_UNIT;
  const priceAmount = unit === 'quota' ? raw / quotaPerUnit : raw;
  return { priceAmount, credits: creditsFromUnitPrice(priceAmount, 1, creditsPerUnit(billing)) };
}

/**
 * 读一次余额。凭证优先用连接里单独配的「系统访问令牌」，没有才退回 API Key。
 * 任何失败都返回 null（静默，顶部按钮显示 `-`）。
 */
export async function fetchConnectionBalance(
  baseUrl: string,
  billing: ProviderBillingConfig | undefined,
  apiKey: string,
): Promise<ConnectionBalance | ConnectionBalanceFailure | null> {
  const token = (billing?.balanceToken ?? '').trim() || apiKey.trim();
  const endpoint = balanceEndpoint(baseUrl, billing);
  if (!token || !endpoint) return null;
  /* ⚠️ 有些厂商要求**随令牌一起发账户 ID**：实测 new-api 系（土豆）的前端请求拦截器
     无条件注入 `New-Api-User: <uid>`，只发 `Authorization` 会被判未授权
     （`{"message":"Unauthorized, New-Api-User header not provided"}`）⇒ 配了就一起带上 ✓ */
  const userId = (billing?.balanceUserId ?? '').trim();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (userId) headers['New-Api-User'] = userId;
  try {
    const response = await corsSafeFetch(endpoint, { method: 'GET', headers });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>).message
        : null;
      return { error: typeof message === 'string' && message ? message : `HTTP ${response.status}` };
    }
    if (payload && typeof payload === 'object' && (payload as Record<string, unknown>).success === false) {
      const message = (payload as Record<string, unknown>).message;
      return { error: typeof message === 'string' && message ? message : '读取余额失败' };
    }
    const parsed = parseConnectionBalance(payload, billing);
    return parsed ? { ...parsed, endpoint } : { error: '响应里没有找到余额字段' };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : '网络错误' };
  }
}
