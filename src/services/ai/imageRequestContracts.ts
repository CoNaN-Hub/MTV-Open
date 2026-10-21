/**
 * 内置图片接口合同 —— **纯派发**，不再含任何单一平台的规则。
 *
 * 平台规则全部搬进了 Adapter：
 *   · 土豆（自有异步端点/参考图语义）→ `services/models/adapters/tudou.ts`
 *   · GRSAI（自有 JSON 协议 + 厂商像素表）→ `services/models/adapters/grsai.ts`
 *   · CCC API（按目录声明复用标准 edits）→ `services/models/adapters/cccapi.ts`
 *
 * 派发流程：
 *   1. 由 `definition.id` + `baseUrl` 归一化出**平台标识**（域名优先 ⇒ 用户自建的中转站也认得）；
 *   2. 用归一化器算出 `providerModelId` / `baseModelId` / `executionMode`（后缀在这里被识别，
 *      **但出站用的永远是 `providerModelId` 原文**）；
 *   3. 交给该平台的 Adapter 构造合同；没有自有合同的平台返回 `undefined` ⇒ 走通用链路。
 */
import type { ProviderDefinition } from './providerCatalogService';
import { normalizeModel } from '../models/normalize';
import { resolveAdapterImageContract, type BuiltInImageRequestContract } from '../models/adapters';
import { resolveProviderId } from '../models/providers';

export type { BuiltInImageRequestContract } from '../models/adapters';

export function resolveBuiltInImageRequestContract(
  definition: ProviderDefinition | undefined,
  modelId: string,
  /** round 122 追加：可能**没有来源**（公共函数不再编 `2K`/`1:1`）⇒ 由合同自己决定要不要兜底。 */
  imageSize: string | undefined,
  aspectRatio: string | undefined,
  /** 连接地址；土豆这类「自有接口形状」的中转站要按域名识别 */
  baseUrl?: string,
  /** 已映射成接口认的精细度（`low`/`medium`/`high`），见 `services/ai/imageQuality.ts` */
  quality?: string,
): BuiltInImageRequestContract | undefined {
  const providerId = resolveProviderId({
    connectionKey: definition?.id,
    catalogId: definition?.id,
    baseUrl,
  });
  if (!providerId || providerId === 'unknown') return undefined;

  /* 归一化只用来**识别后缀与主体 id**；`providerModelId` 原样保留，
     平台合同里发出去的也是它（不许 strip / 改写）。 */
  const normalized = normalizeModel({ providerId, providerModelId: modelId });

  return resolveAdapterImageContract({
    providerId,
    providerModelId: normalized.providerModelId,
    baseModelId: normalized.baseModelId,
    executionMode: normalized.executionMode,
    providerSuffix: normalized.providerSuffix,
    imageSize,
    aspectRatio,
    quality,
    baseUrl,
    definitionId: definition?.id,
    catalogModelImageReferenceMode:
      definition?.models?.find((item) => item.id === modelId)?.imageReferenceRequestMode,
  });
}

/** 同步接口只有 succeeded 才可交付；保留服务端错误，不把任务 ID 当图片。 */
export function validateBuiltInImageResponse(payload: unknown): void {
  const result = payload as { status?: string; error?: string } | null;
  /* ★★ 只有**确实是「任务状态」型响应**才做这项校验。
     事故（用户真机，土豆 `gemini-3-pro-image-preview` = Nano Banana Pro）：
     报「图片任务尚未成功完成，请先检查服务商任务记录，不要重复提交」，而请求**其实成功了**。
     成因：Gemini 原生渠道的响应是 `{candidates:[{content:{parts:[…]}}]}`（合同里声明
     `response.result.geminiImageParts = true`），**根本没有 `status` 字段** ——
     旧写法把「没有 status」当成「任务没成功」直接抛错。
     判据：既没有 `status` 也没有 `error` ⇒ 不是任务状态型响应 ⇒ 交给形状解析器
     （`readGeminiImageParts` 等）去判成功/失败。 */
  if (result?.status === undefined && result?.error === undefined) return;
  if (result?.status !== 'succeeded') {
    throw new Error(result?.error || '图片任务尚未成功完成，请先检查服务商任务记录，不要重复提交');
  }
}
