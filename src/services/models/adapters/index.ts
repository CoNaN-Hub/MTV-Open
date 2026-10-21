/**
 * Adapter 注册表 —— `providerId → ProviderAdapter`，外加「该平台自有的图片接口合同」。
 *
 * 新增平台的流程（**只改数据 + 加一个 Adapter 文件，不碰 Agent UI**）：
 *   1. `src/data/modelProviders.json` 加一条平台定义（`matchHosts` / `catalogIds` / `suffixSpec`）；
 *   2. `src/data/modelMappings/<providerId>.json` 加映射；
 *   3. 若该平台接口形状特殊，在本目录加 `adapters/<providerId>.ts` 并在下面注册；
 *      否则什么都不用加（自动落到通用 `openai-compatible`）。
 */
import { cccapiAdapter, cccapiImageContract } from './cccapi';
import { grsaiAdapter, grsaiImageContract } from './grsai';
import { createLocalManifestAdapter } from './localManifest';
import { createOpenAiCompatibleAdapter } from './openaiCompatible';
import { tudouAdapter, tudouImageContract } from './tudou';
import type { BuiltInImageRequestContract, ImageContractContext } from './contract';
import { allProviderConfigs, getProviderConfig, suffixSpecForProvider } from '../providers';
import type { ProviderAdapter } from '../types';

export type { BuiltInImageRequestContract, ImageContractContext } from './contract';

/** 已注册的平台 Adapter（**显式登记**；没登记的平台自动落到通用 Adapter）。 */
const REGISTERED: Record<string, ProviderAdapter> = {
  tudou: tudouAdapter,
  grsai: grsaiAdapter,
  cccapi: cccapiAdapter,
};

/** 平台专属的图片接口合同构造器。没有 ⇒ 走通用同步链路。 */
const IMAGE_CONTRACTS: Record<string, (ctx: ImageContractContext) => BuiltInImageRequestContract | undefined> = {
  tudou: tudouImageContract,
  grsai: grsaiImageContract,
  cccapi: cccapiImageContract,
};

/** 每平台一个实例（suffixSpec 用 `modelProviders.json` 的声明为准）。 */
const CACHE = new Map<string, ProviderAdapter>();

export function getProviderAdapter(providerId: string): ProviderAdapter {
  const id = providerId.trim();
  const cached = CACHE.get(id);
  if (cached) return cached;

  const config = getProviderConfig(id);
  const base = REGISTERED[id]
    ?? (config?.adapterId === 'local-manifest'
      ? createLocalManifestAdapter(id, config.label)
      : createOpenAiCompatibleAdapter(id, config?.label ?? id));

  /* 后缀表以配置文件为准（`modelMappings/<id>.json` > `modelProviders.json`）——
     这样「新平台多一个 async/batch 后缀」是改配置，不是改代码。 */
  const adapter: ProviderAdapter = { ...base, suffixSpec: suffixSpecForProvider(id) };
  CACHE.set(id, adapter);
  return adapter;
}

export function allRegisteredAdapters(): ProviderAdapter[] {
  return allProviderConfigs().map((p) => getProviderAdapter(p.providerId));
}

/** 构造该平台的图片接口合同（没有就 undefined）。 */
export function resolveAdapterImageContract(ctx: ImageContractContext): BuiltInImageRequestContract | undefined {
  return IMAGE_CONTRACTS[ctx.providerId]?.(ctx);
}

/** 该平台有没有自有图片合同（管理视图/诊断用）。 */
export function hasOwnImageContract(providerId: string): boolean {
  return Boolean(IMAGE_CONTRACTS[providerId]);
}
