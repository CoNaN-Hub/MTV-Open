/**
 * `generation_confirmation` 卡族的**状态 / 文案 / mention / 价格**纯函数层 —— live 官方逐字移植。
 *
 * 权威源码：`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`
 *
 * | 官方本地名 | 定义偏移 | 角色 |
 * |---|---|---|
 * | `pZe` | 2193324 | 状态 → `{colorClass,dotClass,labelKey}` 映射（卡头 `v0` 用） |
 * | `ore` | 2346210 | **内容完全相同**的第二份副本（节点更新卡 `ztt`/`Utt` 用） |
 * | `Dx` | 2268748 | `(cardStatus, generationFailed, isAuto, autoFailed)` → `pZe` 键 |
 * | `lnt` | 2281203 | 缩略图溢出计算（逐字 `lnt(e,t=4)`；`Kf` 调用处显式传 **3**） |
 * | `cnt` | 2281421 | 缩略图 `fitView` 参数 `{padding:1,maxZoom:2,minZoom:.5,duration:500}` |
 * | `tet` / `wI` / `net` | 2253440 / 2253490 / 2253553 | mention 解析（`{{node/<id>}}` → `{{Image N}}` / `{{Video N}}`） |
 * | `Ose` | 2264650 | 价格文案；`~N Tapies` / `0 Tapies` |
 *
 * ⚠️ 本轮**未落地**的官方实体（见落地报告「诚实清单」）：
 *   - `_et`（单条请求价格，@2264xxx）与 `d1`（按秒计费判定）依赖模型目录 ⇒
 *     以回调形式注入（`Ose` 保留官方算法结构）。
 *   - `zse`（@2265453，带网络请求 / `localStorage.access_token` / 300ms 防抖 / TTL 180000 的价格服务）：
 *     需要官方计费端点，MTV 无对应物 ⇒ 组件侧 `costText` 恒为 `null`。
 */
import type { GenerationRequestKind } from './generationConfirmationProtocol';

/* ------------------------------------------------------------------ *
 * 官方 `pZe` @2193324 / `ore` @2346210（两份同内容副本）
 * ------------------------------------------------------------------ */

export const GENERATION_CONFIRMATION_STATUS_KEYS = [
  'confirmed',
  'cancelled',
  'failed',
  'skipped',
  'auto',
] as const;

export type GenerationConfirmationStatusKey = (typeof GENERATION_CONFIRMATION_STATUS_KEYS)[number];

export interface ConfirmationStatusStyle {
  colorClass: string;
  dotClass: string;
  labelKey: string;
}

/** 官方 `pZe`（逐字）。 */
export const GENERATION_STATUS_PALETTE: Record<GenerationConfirmationStatusKey, ConfirmationStatusStyle> = {
  confirmed: {
    colorClass: 'text-[#7CD5A7]',
    dotClass: 'bg-[#7CD5A7]',
    labelKey: 'chatAdapter.generationConfirmation.confirmed',
  },
  cancelled: {
    colorClass: 'text-white/90',
    dotClass: 'bg-white/90',
    labelKey: 'chatAdapter.generationConfirmation.cancelled',
  },
  failed: {
    colorClass: 'text-[#A55050]',
    dotClass: 'bg-[#A55050]',
    labelKey: 'chatAdapter.generationConfirmation.generationFailed',
  },
  skipped: {
    colorClass: 'text-white/40',
    dotClass: 'bg-white/40',
    labelKey: 'chatAdapter.generationConfirmation.skipped',
  },
  auto: {
    colorClass: 'text-[#90C4E5]',
    dotClass: 'bg-[#90C4E5]',
    labelKey: 'chatAdapter.generationConfirmation.autoModeStatus',
  },
};

/** 官方 `ore` @2346210：与 `pZe` 逐字相同的第二份副本（节点更新卡引用的是这一份）。 */
export const NODE_UPDATE_STATUS_PALETTE = GENERATION_STATUS_PALETTE;

/* ------------------------------------------------------------------ *
 * 官方 `Dx` @2268748
 * ------------------------------------------------------------------ */

export interface CardVisualStatusInput {
  cardStatus?: string | null;
  generationFailed?: boolean;
  isAuto?: boolean;
  autoFailed?: boolean;
}

/**
 * 官方 `Dx`：收敛为视觉状态键。
 *
 * ⚠️ 逐字事实：`pending` **不是** `pZe` 的键。官方两处调用点（`ztt`/`Utt`）只传 `{cardStatus}`，
 * 因此 `isAuto`/`autoFailed` 恒为 `undefined` ⇒ 运行期 `failed`/`auto` 分支不可达。
 */
export function resolveCardVisualStatus({
  cardStatus,
  generationFailed,
  isAuto,
  autoFailed,
}: CardVisualStatusInput): GenerationConfirmationStatusKey | 'pending' {
  if (isAuto) return autoFailed ? 'failed' : 'auto';
  if (cardStatus === 'pending') return 'pending';
  if (cardStatus === 'rejected') return 'cancelled';
  if (cardStatus === 'skipped') return 'skipped';
  if (cardStatus === 'confirmed') return generationFailed ? 'failed' : 'confirmed';
  return 'pending';
}

/** 官方调用点的公共写法：`const W = $==="pending" ? void 0 : $`。 */
export function statusStyleOf(
  status: GenerationConfirmationStatusKey | 'pending',
): ConfirmationStatusStyle | null {
  return status === 'pending' ? null : GENERATION_STATUS_PALETTE[status];
}

/* ------------------------------------------------------------------ *
 * 官方 `VJe` @2242278 / `GJe` @2242075
 * ------------------------------------------------------------------ */

export interface ThumbnailSelection<T> {
  visible: T[];
  overflow: number;
  badgeText: string | null;
}

/** 官方 `lnt`@2281203：默认阈值 **4**（注意 `Kf` 调用处显式传 **3**）。 */
export function selectVisibleThumbnails<T>(items: readonly T[], threshold = 4): ThumbnailSelection<T> {
  if (!items.length) return { visible: [], overflow: 0, badgeText: null };
  if (items.length <= threshold) return { visible: [...items], overflow: 0, badgeText: null };
  const visible = items.slice(0, threshold);
  const overflow = items.length - threshold;
  return { visible, overflow, badgeText: `${overflow}+` };
}

/** 官方 `GJe`（逐字）。 */
export const THUMB_FIT_VIEW_OPTIONS = { padding: 1, maxZoom: 2, minZoom: 0.5, duration: 500 } as const;

/* ------------------------------------------------------------------ *
 * 官方 `tet` / `wI` / `net` @2253440 邻域
 * ------------------------------------------------------------------ */

const NODE_MENTION_PATTERN = /\{\{node\/([^{}\s/]+)\}\}/g;

/** 官方 `wI`（逐字）：占位串首字母大写。 */
function mentionPlaceholder(kind: 'image' | 'video', ordinal: number): string {
  return kind === 'image' ? `{{Image ${ordinal}}}` : `{{Video ${ordinal}}}`;
}

export interface MentionReference {
  nodeId?: string | null;
  mediaKind: 'image' | 'video' | 'audio' | null;
}

export interface MentionResolveInput {
  prompt: string;
  resolvedReferences?: readonly MentionReference[] | null;
  getNodeKind: (nodeId: string) => 'image' | 'video' | null;
}

export interface MentionResolveResult {
  prompt: string;
  addedNodeIds: string[];
  unresolvedNodeIds: string[];
  numberingUnavailable: boolean;
}

/** 官方 `net`：`{{node/<id>}}` → `{{Image N}}` / `{{Video N}}`（逐字）。 */
export function resolveMentionTokens({
  prompt,
  resolvedReferences,
  getNodeKind,
}: MentionResolveInput): MentionResolveResult {
  const pattern = new RegExp(NODE_MENTION_PATTERN.source, 'g');
  if (!pattern.test(prompt)) {
    return { prompt, addedNodeIds: [], unresolvedNodeIds: [], numberingUnavailable: false };
  }
  pattern.lastIndex = 0;
  /* 官方：任一已解析引用的 mediaKind 为 null（类型未知）⇒ 直接 numberingUnavailable，不再替换。 */
  const numbered = resolvedReferences?.every((reference) => reference.mediaKind !== null) ?? false;
  const counters = { image: 0, video: 0 };
  const ordinalByNodeId = new Map<string, { kind: 'image' | 'video'; ordinal: number }>();
  if (numbered) {
    for (const reference of resolvedReferences ?? []) {
      if (reference.mediaKind !== 'image' && reference.mediaKind !== 'video') continue;
      const kind = reference.mediaKind;
      counters[kind] += 1;
      if (reference.nodeId && !ordinalByNodeId.has(reference.nodeId)) {
        ordinalByNodeId.set(reference.nodeId, { kind, ordinal: counters[kind] });
      }
    }
  }
  const addedNodeIds: string[] = [];
  const unresolvedNodeIds: string[] = [];
  const ordinalByUnknownId = new Map<string, { kind: 'image' | 'video'; ordinal: number }>();
  const markUnresolved = (raw: string, replacement: string) => {
    if (!unresolvedNodeIds.includes(raw)) unresolvedNodeIds.push(raw);
    return replacement;
  };
  if (!numbered) {
    return { prompt, addedNodeIds: [], unresolvedNodeIds: [], numberingUnavailable: true };
  }
  const next = prompt.replace(pattern, (match, captured: string | undefined) => {
    const nodeId = (captured ?? '').trim();
    if (!nodeId) return match;
    const kind = getNodeKind(nodeId);
    if (!kind) return markUnresolved(nodeId, match);
    const known = ordinalByNodeId.get(nodeId);
    if (known) return mentionPlaceholder(known.kind, known.ordinal);
    const cached = ordinalByUnknownId.get(nodeId);
    if (cached) return mentionPlaceholder(cached.kind, cached.ordinal);
    counters[kind] += 1;
    const entry = { kind, ordinal: counters[kind] };
    ordinalByUnknownId.set(nodeId, entry);
    addedNodeIds.push(nodeId);
    return mentionPlaceholder(kind, entry.ordinal);
  });
  return unresolvedNodeIds.length > 0
    ? { prompt, addedNodeIds: [], unresolvedNodeIds, numberingUnavailable: false }
    : { prompt: next, addedNodeIds, unresolvedNodeIds, numberingUnavailable: false };
}

/* ------------------------------------------------------------------ *
 * 官方 `Ose` @2264650
 * ------------------------------------------------------------------ */

export interface PriceEstimateRequest {
  requestKind: GenerationRequestKind;
  modelId?: string;
  duration?: number;
  referenceVideos?: readonly unknown[];
}

/**
 * 官方 `Ose`：价目串。
 *
 * 官方依赖两处未落地实体（以回调注入）：
 *   - `_et`（@2264xxx）单条请求价格
 *   - `d1`（@2264xxx）「按秒计费」判定
 */
export function formatPriceEstimate(
  prices: readonly (number | null | undefined)[],
  requests: readonly PriceEstimateRequest[],
  perSecondUnitLabel = '',
  isPerSecondBilling: (request: PriceEstimateRequest) => boolean = () => false,
): string | null {
  if (requests.length === 0) return '0 Tapies';
  if (prices.length !== requests.length) return null;
  let total = 0;
  for (const price of prices) {
    if (price == null) return null;
    total += price;
  }
  const perSecond = requests.map(
    (request) => request.requestKind === 'video' && isPerSecondBilling(request),
  );
  if (perSecond.some(Boolean) && !perSecond.every(Boolean)) return null;
  const amount = String(Number(total.toFixed(6)));
  const suffix = perSecond.every(Boolean) ? perSecondUnitLabel : '';
  return `~${amount} Tapies${suffix}`;
}

/* ------------------------------------------------------------------ *
 * 官方 `Ff` @2159117 / `Of` @2159421 / `zQe` @2158792 / `Uoe` @2158894 / `UQe` @2159023
 * ------------------------------------------------------------------ */

/** 官方 `zQe`（逐字）。 */
const SUPERSEDED_ERROR_CODES = new Set([
  'superseded_by_new_message',
  'generation_confirmation_expired',
  'conversation_cancelled',
]);

/** 官方 `Uoe`。 */
export function answerActionOf(content: unknown): unknown {
  const record = content as Record<string, unknown> | undefined;
  const response = record?.response as Record<string, unknown> | undefined;
  const result = record?.result as Record<string, unknown> | undefined;
  return response?.action
    ?? (response?.answer as Record<string, unknown> | undefined)?.action
    ?? result?.action
    ?? (result?.answer as Record<string, unknown> | undefined)?.action
    ?? record?.action;
}

/** 官方 `UQe`。 */
export function answerErrorCodeOf(content: unknown): string {
  const record = content as Record<string, unknown> | undefined;
  const error = record?.error as Record<string, unknown> | undefined;
  const result = record?.result as Record<string, unknown> | undefined;
  const resultError = result?.error as Record<string, unknown> | undefined;
  const code = error?.code ?? resultError?.code;
  return typeof code === 'string' ? code : '';
}

/** 卡片状态（官方 `Ff` 的返回域）。 */
export type CardStatus = 'pending' | 'confirmed' | 'rejected' | 'skipped';

/**
 * 确认态仓库切片（官方 `qe(hs)` 的 `hs` store 的**只读三字段**）。
 * MTV 没有同一 store ⇒ 以显式参数注入；默认 `{}`（等价于「无本地决议记录」，只按 content.status 判定）。
 */
export interface ConfirmationStoreSlice {
  pendingConfirmation?: { confirmationId?: string; status?: string; kind?: string } | null;
  resolvedConfirmations?: Record<string, CardStatus> | null;
}

/**
 * 官方 `Ff` @2159117：解析卡片状态。
 * ⚠️ 签名逐字保留三参（`content, confirmationId, store`）。
 */
export function resolveConfirmationCardStatus(
  content: unknown,
  confirmationId: string,
  store?: ConfirmationStoreSlice | null,
): CardStatus {
  const pending = store?.pendingConfirmation;
  if (pending?.confirmationId === confirmationId) return (pending.status ?? 'pending') as CardStatus;
  const resolved = store?.resolvedConfirmations?.[confirmationId];
  if (resolved) return resolved;
  const record = content as Record<string, unknown> | undefined;
  const result = record?.result as Record<string, unknown> | undefined;
  const status = record?.status ?? result?.status;
  if (status === 'completed') return answerActionOf(content) === 'reject' ? 'rejected' : 'confirmed';
  if (status === 'failed') return SUPERSEDED_ERROR_CODES.has(answerErrorCodeOf(content)) ? 'skipped' : 'rejected';
  return 'pending';
}

/** 官方 `Of` @2159421：工具调用是否仍在途（在途 ⇒ 整卡返回 `null`）。 */
export function isConfirmationInFlight(
  content: unknown,
  confirmationId: string,
  store?: ConfirmationStoreSlice | null,
): boolean {
  const record = content as Record<string, unknown> | undefined;
  const result = record?.result as Record<string, unknown> | undefined;
  const status = record?.status ?? result?.status;
  return !(
    status !== 'started'
    || answerActionOf(content) != null
    || store?.pendingConfirmation?.confirmationId === confirmationId
    || store?.resolvedConfirmations?.[confirmationId]
  );
}

/* ------------------------------------------------------------------ *
 * 参数控制器占位（官方 `Xse` @2288872 / `Wse` @2278435 未落地）
 * ------------------------------------------------------------------ */

export interface ConfirmationChipOption {
  value: string;
  label: unknown;
  icon?: string;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * 官方 `Xse` / `Wse` 的返回形状的**最小可用子集**（渲染层 `Zse`/`Kse` 读到的字段）。
 * 完整定义见 `GenerationConfirmationCard.tsx` 的 `GenerationChipController`。
 */
export interface EmptyChipControllerFlags {
  showModelChip: boolean;
  showMethodChip: boolean;
  showAspectRatioChip: boolean;
  showImageSizeChip: boolean;
  showImageSizeAutoChip: boolean;
  showQualityChip: boolean;
  showDurationChip: boolean;
  showDurationAutoChip: boolean;
  showResolutionChip: boolean;
  showResolutionAutoChip: boolean;
  showTimesChip: boolean;
  showGenerateAudioMenu: boolean;
  showSceneChip: boolean;
  confirmDisabled: boolean;
}

/** 官方 `Xse`/`Wse` 未落地时使用的「全部芯片隐藏」开关组（`官方实体未解析，待替换`）。 */
export const EMPTY_CHIP_CONTROLLER_FLAGS: EmptyChipControllerFlags = {
  showModelChip: false,
  showMethodChip: false,
  showAspectRatioChip: false,
  showImageSizeChip: false,
  showImageSizeAutoChip: false,
  showQualityChip: false,
  showDurationChip: false,
  showDurationAutoChip: false,
  showResolutionChip: false,
  showResolutionAutoChip: false,
  showTimesChip: false,
  showGenerateAudioMenu: false,
  showSceneChip: false,
  confirmDisabled: false,
};

/* ------------------------------------------------------------------ *
 * i18n key（逐字，供组件使用）
 * ------------------------------------------------------------------ */

export const GENERATION_CONFIRMATION_KEYS = {
  generateImages: 'chatAdapter.generationConfirmation.generateImages',
  generateVideos: 'chatAdapter.generationConfirmation.generateVideos',
  imageGeneration: 'chatAdapter.generationConfirmation.imageGeneration',
  videoGeneration: 'chatAdapter.generationConfirmation.videoGeneration',
  audioGeneration: 'audio.audioGeneration',
  batchTasks: 'chatAdapter.generationConfirmation.batchTasks',
  noPrompt: 'chatAdapter.generationConfirmation.noPrompt',
  noReference: 'chatAdapter.generationConfirmation.noReference',
  reference: 'chatAdapter.generationConfirmation.reference',
  imageN: 'chatAdapter.generationConfirmation.imageN',
  videoN: 'chatAdapter.generationConfirmation.videoN',
  confirm: 'chatAdapter.generationConfirmation.confirm',
  cancel: 'chatAdapter.generationConfirmation.cancel',
  rejectAll: 'chatAdapter.generationConfirmation.rejectAll',
  rejectItem: 'chatAdapter.generationConfirmation.rejectItem',
  restoreItem: 'chatAdapter.generationConfirmation.restoreItem',
  edit: 'chatAdapter.generationConfirmation.edit',
  finish: 'chatAdapter.generationConfirmation.finish',
  autoMode: 'chatAdapter.generationConfirmation.autoMode',
  sceneUnsupportedByModel: 'chatAdapter.generationConfirmation.sceneUnsupportedByModel',
  mentionUnresolved: 'chatAdapter.generationConfirmation.mentionUnresolved',
  mentionNumberingUnavailable: 'chatAdapter.generationConfirmation.mentionNumberingUnavailable',
  inconsistentBatch: 'chatAdapter.generationConfirmation.inconsistentBatch',
  inconsistentBatchShort: 'chatAdapter.generationConfirmation.inconsistentBatchShort',
  inconsistentBatchMode: 'chatAdapter.generationConfirmation.inconsistentBatchMode',
  unsupportedKind: 'chatAdapter.generationConfirmation.unsupportedKind',
  unsupportedKindShort: 'chatAdapter.generationConfirmation.unsupportedKindShort',
} as const;

/**
 * 5 个 **locale 组内不存在**的 key 的英文 `defaultValue`（逐字抄录；中文环境回落英文）。
 * 见 §9.1「未挖到清单」。
 */
export const GENERATION_CONFIRMATION_FALLBACK_TEXT = {
  inconsistentBatch:
    'This batch does not share one model and generation configuration. Cancel it and ask Agent to retry.',
  inconsistentBatchShort: 'Inconsistent batch configuration',
  unsupportedKind:
    'This version cannot display the {{kind}} generation confirmation. Update the app or cancel this request.',
  unsupportedKindShort: 'Unsupported confirmation type',
  inconsistentBatchMode: 'These references require different generation modes. Cancel and ask Agent to retry.',
} as const;

/** 节点更新卡 i18n key（逐字）。 */
export const NODE_UPDATE_CONFIRMATION_KEYS = {
  title: 'chatAdapter.nodeUpdateConfirmation.title',
  update: 'chatAdapter.nodeUpdateConfirmation.update',
  cancel: 'chatAdapter.nodeUpdateConfirmation.cancel',
  defaultSummary: 'chatAdapter.nodeUpdateConfirmation.defaultSummary',
  nodeUpdated: 'chatAdapter.nodeUpdateConfirmation.nodeUpdated',
} as const;
