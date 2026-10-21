/**
 * ModelEntitlementNotice —— **确认前**的「分组门」提示（P1）。
 *
 * ## 它解决什么
 * 用户选中一个模型、**还没点发送**时，如果这条连接的 key 在上游**根本调不动**这个模型，
 * 就在这里给一句**可操作**的话（「这条连接图片侧只支持 X / Y，请改选其中一个」），
 * 而不是等用户点了发送、再吃上游那句 `model not found` / `无可用渠道`。
 *
 * ## ⚠️ 这是 MTV 增强，**不是官方对齐**
 * 官方读的是**账号级** `isPayingCustomer`；官方侧**没有任何读 `enable_groups` / `usable_group`
 * 的代码（NOT FOUND）**，也就没有「这条连接的分组能不能用这个模型」这个概念。
 * 本组件是 MTV 自己加的能力，见 `services/ai/providerEntitlements.ts` 文件头。
 *
 * ## 纪律：**只劝告，不阻断**
 *   · 判不出（从没拉过目录 / 拉取失败 / 进程重启后缓存为空）⇒ **整块不渲染**，行为与改动前一致；
 *   · 判得出且模型确实不可用 ⇒ 显示提示，**发送按钮照旧可点**（用户可能就是要试，
 *     也可能上游另有别名的路由）——「官方有、MTV 无数据源 ⇒ 不阻断」这条纪律同样适用于此；
 *   · 提示里的判据**只认带 Key 的 `/v1/models`**；匿名 `/api/pricing` 的 `enable_groups`
 *     只用来**解释为什么**（分组门），绝不拿来当「能用 / 不能用」的依据。
 */
import { useMemo } from 'react';
import { useT } from '../../../i18n';
import { useAppStore } from '../../../store/useAppStore';
import type { NodeType } from '../../../types';
import { resolveCreditConnection } from '../../../services/ai/creditConnection';
import {
  evaluateModelGate,
  upstreamModelIdOf,
} from '../../../services/ai/providerEntitlements';
import { displayNameOfSelection } from '../../../services/ai/providerCatalogService';
import {
  getMediaModelOptions,
  type MediaModelKind,
  type MediaModelOption,
} from './defaultModels';

export interface ModelEntitlementNoticeProps {
  nodeType: NodeType;
  provider?: string;
  model?: string;
  /** 点「改选」时切模型；不给就只把候选名写出来（仍然是可操作的） */
  onSelectSuggestion?: (model: MediaModelOption) => void;
}

/** 节点类型 → 媒体族（与 `getMediaModelOptions` 的口径一致）。 */
function mediaKindOf(nodeType: NodeType): MediaModelKind | null {
  if (nodeType === 'ai-image' || nodeType === 'ai-animation' || nodeType === 'ai-panorama') return 'image';
  if (nodeType === 'ai-video') return 'video';
  if (nodeType === 'ai-audio') return 'audio';
  return null;
}

export default function ModelEntitlementNotice({
  nodeType,
  provider,
  model,
  onSelectSuggestion,
}: ModelEntitlementNoticeProps) {
  const t = useT();
  const config = useAppStore((state) => state.config);
  const generalModels = useMemo(() => config.generalModels ?? [], [config.generalModels]);

  const target = useMemo(
    () => resolveCreditConnection(provider, model, { providers: config.providers, generalModels }),
    [provider, model, config.providers, generalModels],
  );
  const kind = mediaKindOf(nodeType);

  const notice = useMemo(() => {
    if (!target || !kind) return null;
    const connection = config.providers[target.providerId];
    /* 候选池：**该连接 + 其它连接**在同一媒体族里能选的模型。
       上游 id 由各自的连接解析（自定义连接走 generalModels 的 `modelId`）—— 不在这里猜。 */
    const mediaOptions = getMediaModelOptions(generalModels, config, [])
      .filter((option) => option.mediaKind === kind);
    const candidates = mediaOptions.flatMap((option) => {
      const resolved = resolveCreditConnection(option.provider, option.value, {
        providers: config.providers,
        generalModels,
      });
      if (!resolved) return [];
      return [{
        id: resolved.modelId,
        name: displayNameOfSelection({
          id: resolved.modelId,
          name: option.label,
          category: option.mediaKind === 'image' ? 'image' : option.mediaKind === 'video' ? 'video' : 'audio',
          provider: option.provider,
        }),
        category: option.mediaKind,
        /** 同一个上游 id 可能挂在多条连接上 ⇒ 建议里回指的锚点 */
        mediaOption: option,
        /** 只有**本连接的**候选才配当「改选」建议 —— 换到别的连接是另一回事 */
        sameConnection: resolved.providerId === target.providerId,
      }];
    });

    const gate = evaluateModelGate({
      providerId: target.providerId,
      modelId: target.modelId,
      connection,
      category: kind,
      /* 建议只从**本连接**里挑：换别的连接不是「这条连接支持它」 */
      candidates: candidates.filter((candidate) => candidate.sameConnection),
      maxSuggestions: 3,
    });
    if (gate.verdict !== 'unavailable') return null;
    return {
      gate,
      suggestions: gate.suggestions.map((suggestion) => {
        const hit = candidates.find((candidate) =>
          candidate.sameConnection && upstreamModelIdOf(candidate.id) === upstreamModelIdOf(suggestion.id));
        return { ...suggestion, mediaOption: hit?.mediaOption };
      }),
    };
  }, [target, kind, config, generalModels]);

  if (!notice) return null;
  const { gate, suggestions } = notice;

  return (
    <div
      className="ui-alert ui-alert--warning mx-3 mb-2 flex-wrap items-center gap-2"
      role="status"
      data-model-entitlement-notice={gate.reason}
      data-model-gate-group={gate.group ?? ''}
    >
      <span>
        {gate.reason === 'group-not-enabled' && gate.group
          ? t('这条连接所在的分组「{group}」在上游没有开通「{model}」，发出去会被上游拒绝。', {
            group: gate.groupLabel || gate.group,
            model: target?.modelId ?? '',
          })
          : gate.reason === 'not-in-upstream-catalog'
            ? t('上游目录里没有「{model}」这个模型，发出去会被上游拒绝。', {
              model: target?.modelId ?? '',
            })
            : t('上游没有把这个模型开放给当前这条连接，发出去会被上游拒绝。')}
      </span>
      {suggestions.length > 0 && (
        <span className="flex flex-wrap items-center gap-1">
          {t('可改选：')}
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className="model-item-badge"
              data-model-entitlement-suggestion={suggestion.id}
              title={suggestion.name || suggestion.id}
              onClick={() => suggestion.mediaOption && onSelectSuggestion?.(suggestion.mediaOption)}
            >
              {suggestion.name || suggestion.id}
            </button>
          ))}
        </span>
      )}
      {gate.enableGroups.length > 0 && (
        <span className="text-text-text-secondary">
          {t('「{model}」上游只对 {groups} 开放。', {
            model: target?.modelId ?? '',
            groups: gate.enableGroups.join(' / '),
          })}
        </span>
      )}
    </div>
  );
}
