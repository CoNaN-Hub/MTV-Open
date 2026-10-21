/**
 * 内置图片接口合同的**中立类型**。
 *
 * 放在这里（而不是 `services/ai/imageRequestContracts.ts`）是为了断开循环依赖：
 * Adapter 需要合同的类型，而 `imageRequestContracts` 又要调 Adapter 注册表。
 * `imageRequestContracts.ts` 会 `export type` 转发一次，保持旧调用点不变。
 */
import type { NormalizedModelExecutionProtocol } from '../../../types/aiTypes';

export type BuiltInImageRequestContract = {
  kind: 'standard';
  imageReferenceRequestMode: 'edits-multipart';
} | {
  kind: 'protocol';
  referenceInput: 'data-url';
  protocol: NormalizedModelExecutionProtocol;
  dimensions: { width: number; height: number };
};

/**
 * 交给 Adapter 的上下文 —— **全部是原始值**，Adapter 自己决定怎么用。
 *
 * ⚠️ `providerModelId` 是**出站调用 id 原文**（含 `async` 等平台规格后缀）；
 *    `baseModelId` 只是去掉后缀用于**匹配**的副本，**不许**拿它发请求。
 */
export interface ImageContractContext {
  providerId: string;
  /** 出站调用 id 原文。 */
  providerModelId: string;
  /** 去掉平台规格后缀的主体 id（仅匹配用）。 */
  baseModelId: string;
  executionMode: 'sync' | 'async';
  providerSuffix?: string;
  /**
   * 画质档位（`1K`/`2K`/`4K`/`720p`）。**round 122 追加：可以为 `undefined`**
   * —— 公共函数（`generateImagesBatch`）不再替调用方编 `2K`；
   * 平台的**外部接口要求必填**时，由**该 Adapter 自己**声明兜底常量并注明依据（见 `tudou.ts` / `grsai.ts`）。
   */
  imageSize: string | undefined;
  /** 画幅比例（`16:9` / `3:4` / `auto` …）。同上：可以为 `undefined`，由需要它的合同自己决定。 */
  aspectRatio: string | undefined;
  /** 已映射成接口认的精细度（`low`/`medium`/`high`），见 `services/ai/imageQuality.ts` */
  quality?: string;
  baseUrl?: string;
  /** 内置厂商目录定义（自定义连接时为 undefined）。 */
  definitionId?: string;
  /** 该厂商目录里这个名字的参考图调用语义声明（`cccapi` 按它复用标准 edits，不按模型名猜）。 */
  catalogModelImageReferenceMode?: string;
}
