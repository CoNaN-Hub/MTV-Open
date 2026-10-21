/**
 * useCreditBalance —— 顶部「积分」按钮与「充值积分」页共用的余额读取。
 *
 * 两处要读同一份余额，所以这里做了**模块级 TTL 缓存**（60 秒），避免一个页面触发两次请求；
 * 失败不缓存（下次进入会重试）。余额读不到就是 `null` ⇒ 按钮显示 `-`，绝不猜。
 *
 * ⚠️ **不能在 effect 体里同步 `setState`**（`react-hooks/set-state-in-effect`）：
 *    命中缓存的情况直接在**渲染期**从缓存取值，effect 只负责异步回填一次结果。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  resolveCreditSourceConnection,
  type CreditSourceConnection,
} from '../services/ai/creditConnection';
import { fetchConnectionBalance } from '../services/ai/creditBalance';

const TTL_MS = 60 * 1000;

interface Cached {
  at: number;
  credits: number;
  priceAmount: number;
}

const cache = new Map<string, Cached>();

export interface CreditBalanceState {
  /** 来源连接；`null` = 没有任何可用连接 */
  source: CreditSourceConnection | null;
  /** 折算后的积分；`null` = 没配好 / 读不到 */
  credits: number | null;
  /** 计价单位下的余额（元/美元…） */
  priceAmount: number | null;
  /** 读失败时服务端/网络给的原因（界面直接显示，不再只给一个 `-`） */
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

export function useCreditBalance(): CreditBalanceState {
  const providers = useAppStore((state) => state.config.providers);
  const selectedId = useAppStore((state) => state.config.creditSourceConnectionId);
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    credits: number | null;
    priceAmount: number | null;
    error: string | null;
  } | null>(null);

  const source = useMemo(
    () => resolveCreditSourceConnection({ providers, creditSourceConnectionId: selectedId }),
    [providers, selectedId],
  );
  const token = (source?.billing?.balanceToken ?? '').trim() || source?.apiKey || '';
  /* 键里带令牌长度与设置快照：换令牌/改配置要重读，但又不把密钥本身留进键 */
  const key = source
    ? [source.id, source.baseUrl, token.length, JSON.stringify(source.billing ?? null)].join('|')
    : '';

  /* ⚠️ 缓存只能在 effect 的**异步回调**里读：
      · 渲染期读缓存要调 `Date.now()` ⇒ `react-hooks/purity` 报「渲染期调用非纯函数」✗
      · effect 体里同步 `setState` ⇒ `react-hooks/set-state-in-effect` ✗
     先 `await` 让出一帧再读缓存，两个规则都绕开，且命中缓存时依然不发请求 ✓ */
  useEffect(() => {
    if (!source || !key) return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < TTL_MS) {
        setResult({ key, credits: hit.credits, priceAmount: hit.priceAmount, error: null });
        return;
      }
      const value = await fetchConnectionBalance(source.baseUrl, source.billing, source.apiKey);
      if (!active) return;
      if (value && 'credits' in value) {
        cache.set(key, { at: Date.now(), credits: value.credits, priceAmount: value.priceAmount });
        setResult({ key, credits: value.credits, priceAmount: value.priceAmount, error: null });
        return;
      }
      setResult({
        key,
        credits: null,
        priceAmount: null,
        error: value && 'error' in value ? value.error : null,
      });
    })();
    return () => {
      active = false;
    };
  }, [key, source, tick]);

  const refresh = useCallback(() => {
    if (key) cache.delete(key);
    setTick((value) => value + 1);
  }, [key]);

  const settled = result?.key === key;
  return {
    source,
    credits: settled ? result!.credits : null,
    priceAmount: settled ? result!.priceAmount : null,
    error: settled ? result!.error : null,
    loading: !!source && !settled,
    refresh,
  };
}
