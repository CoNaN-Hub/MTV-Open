/**
 * `useGenerationCardCost` —— 生成确认卡头部的**预估花费**（官方 `Pc({enabled, buildRequest, deps, debounceMs})`
 * + `v5(priceDisplay)` 的 MTV 等价）。
 *
 * 官方事实（新版 `vendor-pkg-canvas-CvbAwZyy.js`）：
 * - 卡片头的价格 span：`<span class="relative inline-flex text-xs … text-white/60">{costText}</span>`，
 *   内层 `<span class="whitespace-nowrap tap-price-change">{text}</span>`，
 *   loading 时换成 `tap-price-shimmer`（见 `ConfirmationCardParts.GenerationCardHeader`，MTV 已逐字移植）；
 * - 价格**不是卡片载荷的一部分**，而是另发一次估价请求拿到的
 *   （`Pc` hook：`debounceMs=300` → `send()` → 响应 `{tapiesCost, priceDisplay:{text,max}, originalTapiesCost, serviceType}`
 *   → `v5()` 生成 `{kind:'regular'|'discount', text, originalText, countdown}`）。
 *
 * ⚠️ MTV 侧口径（**不锁死任何厂商**，见 `types/index.ts` 里「未来我会接入其他厂商的价格」）：
 * - 价格一律走 MTV 既有的连接级计费体系 `services/ai/creditEstimate.ts`：
 *   `手动覆盖 → 厂商价目表（new-api `/api/pricing` 等）→ 连接兜底单价`，再按 `creditsPerUnit` 折成**积分**；
 * - 取值连的是**当前项目该类型（image/video/audio）的默认模型**（与 `generationService` 的
 *   「节点模型 → 项目默认模型」口径一致），没有默认模型 ⇒ 不显示价格（官方此时也会是 loading/空）；
 * - 单位用 MTV 的「积分」（官方是 Tapies，两者币种不同，只对齐**位置与格式**：`~N 单位`）。
 * - 折扣态（原价 + 倒计时）需要「原价」字段，MTV 的价目表暂无 ⇒ 不显示（不编）。
 */
import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { resolveCreditConnection } from '../../services/ai/creditConnection';
import { resolveOutgoingImageQuality } from '../../services/ai/imageQuality';
import { imageNodeDefaultParams } from '../../utils/imageModelCapabilities';
import {
  estimateWithBilling,
  formatCredits,
  loadCreditPriceTable,
} from '../../services/ai/creditEstimate';
import { getProjectModelKind, parseProjectModelRef } from '../../services/projectSettingsService';

export interface GenerationCardCostRequest {
  kind: 'image' | 'video' | 'audio';
  /**
   * 卡片载荷里的官方 `request_json.model_name`（= `media_generate` **解析出的**模型；
   * MTV 形如 `provider/model` 或 `general/<配置 id>`）。
   * 有它就用它（官方就是拿服务端已指派的模型算价）；没有才回落项目默认模型。
   */
  modelName?: string;
  /** 界面档位（图片常用 `1K/2K/4K`）。 */
  imageSize?: string;
  /** 视频分辨率档位（`720p/1080p`…）。 */
  resolution?: string;
  quality?: string;
  /** 张数/条数（官方 `times`）。 */
  times?: number;
}

export interface GenerationCardCost {
  /** 已格式化的价格文本（`~5 积分`）；没有可算的价 ⇒ `null`（卡片头不渲染价格）。 */
  text: string | null;
  /** 是否正在取价（官方 `costLoading` ⇒ 走 `tap-price-shimmer`）。 */
  loading: boolean;
}

/**
 * 从生成确认卡的 `content` 里取官方 `request_json.model_name`
 * （= `media_generate` 解析出的模型；**没有就是不写**，此时价格回落项目默认模型或干脆不显示）。
 */
export function cardModelName(content: unknown): string | undefined {
  const request = (content as { request?: Record<string, unknown> } | null)?.request;
  const requestJson = request?.request_json as Record<string, unknown> | undefined;
  const detail = request?.detail as { items?: Array<{ request_json?: Record<string, unknown> }> } | undefined;
  const fromRequest = typeof requestJson?.model_name === 'string' ? requestJson.model_name : undefined;
  const fromDetail = detail?.items?.[0]?.request_json;
  const fromItem = typeof fromDetail?.model_name === 'string' ? fromDetail.model_name : undefined;
  return (fromRequest ?? fromItem)?.trim() || undefined;
}

export function useGenerationCardCost(request: GenerationCardCostRequest): GenerationCardCost {
  const t = useT();
  const config = useAppStore((state) => state.config);
  const projects = useAppStore((state) => state.projects);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const [state, setState] = useState<GenerationCardCost>({ text: null, loading: false });

  const modelKind = getProjectModelKind(`ai-${request.kind}`);
  const projectSettings = projects.find((project) => project.id === currentProjectId)?.settings;
  const projectModelRef = modelKind ? projectSettings?.defaultModels?.[modelKind] : undefined;
  /* 官方口径：价格算的是**已指派的模型** ⇒ 卡片载荷里的 `model_name` 优先，其次才是项目默认模型。 */
  const parsed = parseProjectModelRef(request.modelName?.trim() || projectModelRef);
  const provider = parsed?.provider;
  const model = parsed?.model;
  /* 进 effect 依赖的稳定键（连接配置/默认模型/参数变了就重算）。 */
  const billingKey = JSON.stringify(
    provider ? (config.providers?.[provider]?.billing ?? null) : null,
  );
  const requestKey = [
    request.kind, request.modelName ?? '', request.imageSize ?? '', request.resolution ?? '',
    request.quality ?? '', request.times ?? '',
  ].join('|');

  useEffect(() => {
    let cancelled = false;
    /* ⚠️ 全部 setState 都放在异步函数里（react-hooks/set-state-in-effect 不允许在 effect 体内同步 setState：
       同步改 state 会引发级联渲染）。 */
    void (async () => {
      const target = resolveCreditConnection(provider, model, config);
      if (cancelled) return;
      if (!target) {
        setState((previous) => (previous.text === null && !previous.loading
          ? previous
          : { text: null, loading: false }));
        return;
      }
      setState((previous) => (previous.loading ? previous : { text: null, loading: true }));
      const table = await loadCreditPriceTable(target.baseUrl, target.billing).catch(() => null);
      /* ★★ **精准预估**：档位缺省时必须补上**实际会发出去的**那一档，否则
         `lookupCreditUnitPrice` 的「明细两轮查」找不到 variant，只会退回 `data[].model_price`
         这个基础价 —— 实测 `gpt-image-2.5-flare-async` 的基础价 $0.03 ⇒ 卡上「~3 积分」，
         而它的真实价格在 `/api/pricing` 顶层的 `model_pricing_variants`（quality×resolution 15 档，
         $0.04–$0.18）⇒ 差好几倍。
         · quality：走**出站解析器**（`resolveOutgoingImageQuality`，含模型默认档 + xhigh/max→high 映射）
           —— 报价必须对「实际发出去的值」，不是界面上的原始词。
         · resolution：payload 没有就用该模型的**节点默认档**（`imageNodeDefaultParams`，与新建卡一致）。 */
      const estimate = estimateWithBilling(
        table,
        {
          modelId: target.modelId,
          quality: resolveOutgoingImageQuality(target.modelId, request.quality),
          /* 官方 `image_size` / `resolution` 在 MTV 的预估口径里都走 `resolution`（见 `CreditEstimateRequest`）。 */
          resolution: request.resolution ?? request.imageSize ?? imageNodeDefaultParams(target.modelId).imageSize,
          count: request.times ?? 1,
        },
        target.billing,
        /* ★ P3 分组折扣（**MTV 增强**）：该连接上游分组的倍率（`vip-9折` ⇒ 0.9）。
           拿不到就是 `null` ⇒ 原价，**不阻断**。 */
        target.discount?.ratio ?? null,
      );
      if (cancelled) return;
      setState({
        text: estimate ? `~${formatCredits(estimate.credits)} ${t('积分')}` : null,
        loading: false,
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, billingKey, provider, model, requestKey, t]);

  return state;
}
