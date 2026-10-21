/**
 * Adapter: CCC API —— 复用「厂商目录里声明的参考图调用语义」，**不按模型名猜**。
 * 规则原来写死在 `services/ai/imageRequestContracts.ts`。
 *
 * 判据是**目录声明**（`ProviderModelSelection.imageReferenceRequestMode`），
 * 不是 `gpt-image-*` 这类名字前缀 —— 这正是「不靠字符串猜」的要求。
 */
import type { BuiltInImageRequestContract, ImageContractContext } from './contract';
import { createOpenAiCompatibleAdapter } from './openaiCompatible';
import type { ProviderAdapter } from '../types';

export function cccapiImageContract(ctx: ImageContractContext): BuiltInImageRequestContract | undefined {
  return ctx.catalogModelImageReferenceMode === 'edits-multipart'
    ? { kind: 'standard', imageReferenceRequestMode: 'edits-multipart' }
    : undefined;
}

export const cccapiAdapter: ProviderAdapter = {
  ...createOpenAiCompatibleAdapter('cccapi', 'CCC API'),
};
