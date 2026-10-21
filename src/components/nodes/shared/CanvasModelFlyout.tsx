/**
 * 画布节点「选择模型」模型行 hover 的飞出说明卡。
 *
 * ## 版式（对应用户给的 Framia 参考图）
 *   ① 标题行：模型图标 + 名称（`text-base font-semibold`）
 *   ② 正文说明：`text-sm leading-6`，整段显示不截断
 *   ③ `适合：` 单独一行，斜体正文换行接在下面
 *   ④ `border-t` 分隔后三行档位：`速度` / `质量` 五段条，`成本` 文字（低绿 / 中黄 / 高红）
 *   ⑤ 官方参数（比例 / 画质 / 精细度 / 张数上限 …）：只在官方目录**有**该字段时出现
 *   ⑥ 价目：只在**该连接的价目表已经拉取过**时出现（悬停不发请求）
 *
 * 容器类串沿用官方 `uu`：`overflow-hidden rounded-2xl border border-border/60 bg-popover p-1 shadow-lg`。
 *
 * ## 数据口径
 * 全部字段由 `services/models/modelInfoCard.buildModelInfoCard` 装配（官方身份 / 官方参数 /
 * 官方简介 → Framia 卡片 → MTV 自己的 description / 连接价目）。这里**只渲染**，不做解析。
 *
 * ⚠️ **不再「查不到就什么都不出」**（用户实测：土豆模型悬停一片空白）。
 *    官方目录查不到 ⇒ 仍然出**最小卡**（模型名 / 类型 / 连接 / 价目），
 *    并在脚注里写明「官方目录未收录」。
 */
import { useMemo } from 'react';
import { t } from '../../../i18n';
import { useAppStore } from '../../../store/useAppStore';
import type { ModelOption } from '../../../types';
import type { ModelFlyoutInfo } from '../shared/ModelSelector';
import { CapabilityMeter } from '../../chat/ModelPickerFlyout';
import OfficialModelIcon from '../../shared/OfficialModelIcon';
import { hasOfficialModelIcon } from '../../../utils/officialModelIcons';
import { framiaCostAppearance } from '../../../data/framiaModelInfo';
import { isAsyncModel, stripAsyncToken } from '../../../utils/modelAsync';
import { buildModelInfoCard } from '../../../services/models/modelInfoCard';
import { formatCredits } from '../../../services/ai/creditEstimate';

export default function CanvasModelFlyout({ model, info }: { model: ModelOption; info: ModelFlyoutInfo }) {
  const config = useAppStore((state) => state.config);

  const card = useMemo(() => buildModelInfoCard(
    {
      value: model.value,
      label: model.label,
      /* `info.description` 已经是「官方卡 → 覆盖表 → 模型自身」的结果（`ModelSelector` 算好的）
         ⇒ 交给解析层当**最后一级**兜底，覆盖表不会因为走新链路而丢掉。 */
      description: info.description ?? model.description,
      provider: model.provider,
      connectionName: model.connectionName,
      displayName: info.displayName,
    },
    { providers: config.providers ?? {}, generalModels: config.generalModels ?? [] },
    info.family ?? null,
  ), [config.generalModels, config.providers, info.description, info.displayName, info.family, model.connectionName, model.description, model.label, model.provider, model.value]);

  const cost = card.scores ? framiaCostAppearance(card.scores.cost) : null;
  /* 图标与列表行同源：`info.iconKey` 就是行上那个 `cardMeta(...).iconKey`。 */
  const iconKey = info.iconKey ?? card.iconKey ?? null;
  /* 用户裁决：名字带 async 的模型，**说明卡标题上补一个 `Async`**
     （例：`GPT Image 2.5 Sunburst async` → 卡片标题 `GPT Image 2.5 Sunburst Async`）；
     其余说明 / 适合 / 档位与同步版逐字一致。 */
  const displayName = isAsyncModel(model)
    ? `${stripAsyncToken(info.displayName)} Async`
    : info.displayName;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-popover p-1 shadow-lg">
      <div className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {iconKey && hasOfficialModelIcon(iconKey) ? (
            <OfficialModelIcon iconKey={iconKey} size={18} className="shrink-0" />
          ) : null}
          <h4 className="min-w-0 truncate text-base font-semibold text-text-text-primary">{displayName}</h4>
        </div>

        {card.description ? (
          <p className="mt-2.5 text-sm leading-6 text-text-text-secondary">{card.description}</p>
        ) : null}

        {card.bestFor ? (
          <>
            <p className="mt-4 text-sm leading-6 text-text-text-secondary">{t('适合：')}</p>
            <p className="mt-1.5 text-sm italic leading-6 text-text-text-secondary">{card.bestFor}</p>
          </>
        ) : null}

        {/* 事实行（类型 / 连接 / 厂商 / 官方条目）：官方目录查不到时**这就是整张卡的主体** */}
        {card.facts.length > 0 ? (
          <dl className="mt-3 flex flex-col gap-1" data-model-flyout-facts="">
            {card.facts.map((fact) => (
              <div key={fact.label} className="flex items-center justify-between gap-4">
                <dt className="text-[13px] text-text-text-tertiary">{t(fact.label)}</dt>
                <dd className="min-w-0 truncate text-[13px] font-medium text-text-text-secondary">{fact.value}</dd>
              </div>
            ))}
            {card.priceCredits !== null ? (
              <div className="flex items-center justify-between gap-4" data-model-flyout-price="">
                <dt className="text-[13px] text-text-text-tertiary">{t('价目')}</dt>
                <dd className="text-[13px] font-medium text-text-text-secondary">
                  {`~${formatCredits(card.priceCredits)} ${t('积分')}`}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {/* 官方参数（官方目录里逐模型给的那几档；没有就不渲染） */}
        {card.params.length > 0 ? (
          <div className="mt-4 border-t border-border/40 pt-3">
            <dl className="flex flex-col gap-1.5" data-model-flyout-params="">
              {card.params.map((param) => (
                <div key={param.label} className="flex items-start justify-between gap-4">
                  <dt className="shrink-0 text-sm font-medium text-text-text-secondary">{t(param.label)}</dt>
                  <dd className="min-w-0 text-right text-sm text-text-text-secondary">{param.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {card.scores && cost ? (
          <div className="mt-4 border-t border-border/40 pt-3">
            <dl className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm font-medium text-text-text-secondary">{t('速度')}</dt>
                <dd>
                  <meter className="sr-only" aria-label={t('速度')} min={1} max={5} value={card.scores.speed} />
                  <CapabilityMeter value={card.scores.speed} size="md" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm font-medium text-text-text-secondary">{t('质量')}</dt>
                <dd>
                  <meter className="sr-only" aria-label={t('质量')} min={1} max={5} value={card.scores.quality} />
                  <CapabilityMeter value={card.scores.quality} size="md" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm font-medium text-text-text-secondary">{t('成本')}</dt>
                <dd className={`text-sm font-medium ${cost.className}`}>{t(cost.text)}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {/* 脚注：哪一块不是官方字段，必须写清楚（用户口径：宁可写明「未收录」，也不要空白/编造） */}
        {card.notes.length > 0 ? (
          <p
            className="mt-3 rounded-lg bg-muted px-2.5 py-2 text-[11px] leading-4 text-text-text-secondary"
            data-model-flyout-note={card.notes[0]}
          >
            {card.notes[0] === 'official-catalog-missing'
              ? t('官方目录未收录：以下模型名 / 连接 / 类型 / 价目均为 MTV 现有数据等价展示。')
              : t('官方未建模该模型的参数与介绍：以下按 MTV 现有数据等价展示。')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
