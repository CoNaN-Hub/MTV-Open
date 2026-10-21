import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_QUOTA_PER_UNIT,
  balanceEndpoint,
  parseConnectionBalance,
  readPath,
  topUpEndpoint,
} from '../../src/services/ai/creditBalance';

/**
 * 余额读取的口径都是从**实测**来的（2026）：
 *   · new-api（土豆）`GET /api/user/self` → `data.quota`，要 ÷ `quota_per_unit`(500000) 才是元
 *   · apimart `GET /user/balance` → `remain_credits`，本身就是积分
 */
describe('creditBalance · 端点解析', () => {
  it('默认用 new-api 的 /api/user/self，可覆盖', () => {
    expect(balanceEndpoint('https://api.ai-tudou.net/v1'))
      .toBe('https://api.ai-tudou.net/api/user/self');
    expect(balanceEndpoint('https://api.ai-tudou.net/v1', { balancePath: '/user/balance' }))
      .toBe('https://api.ai-tudou.net/user/balance');
    expect(balanceEndpoint('not-a-url')).toBeNull();
  });

  it('充值页默认 /wallet（土豆实测的个人中心），可覆盖', () => {
    expect(topUpEndpoint('https://api.ai-tudou.net/v1')).toBe('https://api.ai-tudou.net/wallet');
    expect(topUpEndpoint('https://api.ai-tudou.net/v1', { topUpPath: 'https://x.example/pay' }))
      .toBe('https://x.example/pay');
    expect(topUpEndpoint('nope')).toBeNull();
  });

  it('点号路径取值', () => {
    expect(readPath({ data: { quota: 123 } }, 'data.quota')).toBe(123);
    expect(readPath({ remain_credits: 5 }, 'remain_credits')).toBe(5);
    expect(readPath({ data: null }, 'data.quota')).toBeUndefined();
    expect(readPath('text', 'a.b')).toBeUndefined();
  });
});

describe('creditBalance · 金额解析', () => {
  it('new-api 的 quota 要除以 quota_per_unit（默认 500000）', () => {
    /* 500000 quota = 1 元；1 元 = 100 积分 */
    expect(parseConnectionBalance({ data: { quota: 500000 } }))
      .toEqual({ priceAmount: 1, credits: 100 });
    expect(parseConnectionBalance({ data: { quota: 650000 } }))
      .toEqual({ priceAmount: 1.3, credits: 130 });
    expect(DEFAULT_QUOTA_PER_UNIT).toBe(500000);
  });

  it('quota_per_unit 可覆盖（不同中转站基数不同）', () => {
    expect(parseConnectionBalance({ data: { quota: 1000 } }, { balanceQuotaPerUnit: 1000 }))
      .toEqual({ priceAmount: 1, credits: 100 });
  });

  it('已是计价单位时按 price 读（apimart 的 remain_credits）', () => {
    expect(parseConnectionBalance(
      { remain_credits: 12.5 },
      { balanceAmountPath: 'remain_credits', balanceAmountUnit: 'price' },
    )).toEqual({ priceAmount: 12.5, credits: 1250 });
  });

  it('自定义换算比例一起生效', () => {
    expect(parseConnectionBalance({ data: { quota: 500000 } }, { creditsPerUnit: 1 }))
      .toEqual({ priceAmount: 1, credits: 1 });
  });

  it('取不到数 / 结构不认识 ⇒ null（顶部按钮显示 -，不猜）', () => {
    expect(parseConnectionBalance({ message: 'Unauthorized, invalid access token', success: false })).toBeNull();
    expect(parseConnectionBalance(null)).toBeNull();
    expect(parseConnectionBalance({ data: { quota: 'abc' } })).toBeNull();
    /* new-api 那个哨兵值不是余额，但也不能让解析器崩掉 —— 取了 quota 才算 */
    expect(parseConnectionBalance({ hard_limit_usd: 100000000 })).toBeNull();
  });
});

describe('creditBalance · 账户 ID 头', () => {
  it('配了账户 ID 时随请求一起发 New-Api-User（土豆前端就是这么干的）', async () => {
    const { fetchConnectionBalance } = await import('../../src/services/ai/creditBalance');
    const http = await import('../../src/services/ai/httpTransport');
    const seen: Array<Record<string, string>> = [];
    const spy = vi.spyOn(http, 'corsSafeFetch').mockImplementation(async (_url, init) => {
      seen.push((init?.headers ?? {}) as Record<string, string>);
      return new Response(JSON.stringify({ data: { quota: 500000 } }), { status: 200 });
    });
    const withId = await fetchConnectionBalance('https://a.example/v1', { balanceToken: 't', balanceUserId: '42' }, '');
    const withoutId = await fetchConnectionBalance('https://a.example/v1', { balanceToken: 't' }, '');
    spy.mockRestore();
    expect(seen[0]).toEqual({ Authorization: 'Bearer t', 'New-Api-User': '42' });
    expect(seen[1]).toEqual({ Authorization: 'Bearer t' });
    expect(withId?.credits).toBe(100);
    expect(withoutId?.credits).toBe(100);
  });
});
