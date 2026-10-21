/**
 * creditConnection —— 从「节点上的 provider/model」解析出**连接地址**与**上游模型 id**。
 *
 * 单独成文件的两个原因：
 *   · `CreditEstimateBadge` 是组件文件，混着导出普通函数会破坏 Fast Refresh；
 *   · 这是纯解析逻辑，独立出来才好单测。
 *
 * 解析不出来一律返回 `null`（调用方不请求价目表、不渲染积分，绝不猜）。
 */
import { DEFAULT_BASE_URLS } from '../../constants/api';
import type { AppConfig, ProviderBillingConfig } from '../../types';
import { extractModelName } from './helpers';
import { resolveConnectionDiscount } from './providerEntitlements';
import type { ConnectionDiscount } from './providerEntitlements';

export interface CreditConnection {
  /**
   * ★ 这条连接在配置里的 key（= `config.providers` 的键）。
   *
   * 内置厂商的 key 就是 provider id；**自定义连接是 `custom-<uuid8>`** —— 所以
   * 「权益随连接 + key 变」时，只有这个字段才是连接级缓存的正确键（provider id 不够细）。
   */
  providerId: string;
  /** 连接地址（如 `https://api.ai-tudou.net/v1`），用于推出站点根的价目表地址 */
  baseUrl: string;
  /** 上游真实模型 id（如 `gpt-image-2.5-flare`），用于查价目表 */
  modelId: string;
  /** ★ 该连接的「计费 / 积分」设置（取价方式、换算比例、手动单价）；未配置时 `undefined` */
  billing?: ProviderBillingConfig;
  /**
   * ★ 该连接的**上游分组折扣**（`vip-9折` ⇒ 0.9x）。
   *
   * **MTV 增强** —— 官方读的是账号级 `isPayingCustomer`，官方侧没有任何读
   * `enable_groups` / `usable_group` 的代码（NOT FOUND，见 `providerEntitlements.ts` 文件头）。
   * `null` = 拿不到分组 / 解析不出倍率 ⇒ **原价显示，不阻断**。
   */
  discount: ConnectionDiscount | null;
}

export function resolveCreditConnection(
  provider: string | undefined,
  model: string | undefined,
  config: Pick<AppConfig, 'providers' | 'generalModels'>,
): CreditConnection | null {
  if (!provider) return null;
  /* 自定义连接：节点上存的是 `general/<配置 id>`，真实模型名在 generalModels 里 */
  if (provider === 'general') {
    const generalModel = (config.generalModels ?? []).find((item) => `general/${item.id}` === model);
    if (!generalModel) return null;
    const connection = config.providers?.[generalModel.providerConfigId];
    const baseUrl = (connection?.baseUrl || '').trim();
    if (!baseUrl || !generalModel.modelId) return null;
    return {
      providerId: generalModel.providerConfigId,
      baseUrl,
      modelId: generalModel.modelId,
      billing: connection?.billing,
      discount: resolveConnectionDiscount(generalModel.providerConfigId, connection?.billing),
    };
  }
  const connection = config.providers?.[provider];
  const fallback = DEFAULT_BASE_URLS[provider as keyof typeof DEFAULT_BASE_URLS];
  const baseUrl = (connection?.baseUrl || fallback || '').trim();
  const modelId = model ? extractModelName(model, provider) : '';
  if (!baseUrl || !modelId) return null;
  return {
    providerId: provider,
    baseUrl,
    modelId,
    billing: connection?.billing,
    discount: resolveConnectionDiscount(provider, connection?.billing),
  };
}

/** 顶部「积分」按钮与「充值积分」页用的余额来源连接。 */
export interface CreditSourceConnection {
  id: string;
  name: string;
  baseUrl: string;
  /** 连接里单独配的「系统访问令牌」优先，没有则用 apiKey 兜 */
  apiKey: string;
  billing?: ProviderBillingConfig;
}

/** 能当余额来源的连接：有接口地址，且至少有 apiKey / 系统访问令牌之一。 */
export function listCreditSourceConnections(
  config: Pick<AppConfig, 'providers'>,
): CreditSourceConnection[] {
  return Object.entries(config.providers ?? {}).flatMap(([id, provider]) => {
    const baseUrl = (provider?.baseUrl ?? '').trim();
    const apiKey = (provider?.apiKey ?? '').trim();
    const token = (provider?.billing?.balanceToken ?? '').trim();
    if (!baseUrl || (!apiKey && !token)) return [];
    return [{ id, name: provider?.name?.trim() || id, baseUrl, apiKey, billing: provider?.billing }];
  });
}

/**
 * 选定余额来源：用户显式选过就用它（失效则回落自动挑）。
 * 自动挑优先带「系统访问令牌」的连接 —— 那种是**专门为读余额配过**的，命中率最高。
 */
export function resolveCreditSourceConnection(
  config: Pick<AppConfig, 'providers' | 'creditSourceConnectionId'>,
): CreditSourceConnection | null {
  const all = listCreditSourceConnections(config);
  if (all.length === 0) return null;
  const chosen = all.find((item) => item.id === config.creditSourceConnectionId);
  if (chosen) return chosen;
  return all.find((item) => (item.billing?.balanceToken ?? '').trim()) ?? all[0];
}
