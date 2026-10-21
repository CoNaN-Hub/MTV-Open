/**
 * settings/BillingRecordsSettings —— 「账单和用量 → 账单记录」页。
 *
 * ## 数据是真的，不是摆设
 * 来源是本地**输出历史**（`store.outputHistoryRecords`，IndexedDB）。每条记录都带
 * `provider / model / params / timestamp` ⇒ 用与生成前徽章**同一套算法**
 * （`estimateWithBilling` + 连接价目表）算出这一条花了多少积分，再汇总。
 *
 * ⚠️ 这是**本地预估账**，不是厂商的结算单：真实扣费以厂商后台为准（官方 TapNow 那页是
 *    服务端 Tapies 账本，MTV 没有计费后端）。所以标题与说明里都写明口径，不假装是账单原单。
 *
 * ⚠️ 目前只对**图片**节点计价（`ai-image`）—— 只有图片有「每张」的价目表口径；
 *    视频按时长、文本按 token，价目表里对不上，强行算就是编数字 ⇒ 直接不计入并说明。
 */
import { useEffect, useMemo, useState } from 'react';
/* ★ 模型名唯一出口：账单行只显示 displayName */
import { useModelNameResolver } from '../../services/models/display';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { resolveCreditConnection } from '../../services/ai/creditConnection';
import { resolveOutgoingImageQuality } from '../../services/ai/imageQuality';
import {
  estimateWithBilling,
  formatCredits,
  loadCreditPriceTable,
  type CreditPriceTable,
} from '../../services/ai/creditEstimate';
import { SettingsPaneBody, SettingsPaneHeader, SettingsRow } from './SettingsPane';

interface BillingGroup {
  key: string;
  provider: string;
  model: string;
  resolution?: string;
  quality?: string;
  count: number;
  latest: number;
  credits: number | null;
}

export default function BillingRecordsSettings() {
  const t = useT();
  /* ★ 模型名唯一出口（账单行只显示 displayName）*/
  const modelName = useModelNameResolver();
  const records = useAppStore((state) => state.outputHistoryRecords);
  const providers = useAppStore((state) => state.config.providers);
  const generalModels = useAppStore((state) => state.config.generalModels);
  const [tables, setTables] = useState<Record<string, CreditPriceTable | null>>({});

  /** 按「连接 + 模型 + 档位」归并：同档位只需查一次表 */
  const groups = useMemo<BillingGroup[]>(() => {
    const map = new Map<string, BillingGroup>();
    for (const record of records ?? []) {
      if (record.status !== 'success' || record.nodeType !== 'ai-image') continue;
      const params = (record.params ?? {}) as Record<string, unknown>;
      const resolution = typeof params.imageSize === 'string' ? params.imageSize : undefined;
      const quality = typeof params.quality === 'string' ? params.quality : undefined;
      const key = [record.provider, record.model, resolution ?? '', quality ?? ''].join('|');
      const current = map.get(key);
      if (current) {
        current.count += 1;
        current.latest = Math.max(current.latest, record.timestamp);
      } else {
        map.set(key, {
          key,
          provider: record.provider,
          model: record.model,
          resolution,
          quality,
          count: 1,
          latest: record.timestamp,
          credits: null,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.latest - a.latest);
  }, [records]);

  useEffect(() => {
    /* 没有记录就什么都不做（别在 effect 体里同步 setState ⇒ `react-hooks/set-state-in-effect`） */
    if (groups.length === 0) return;
    let active = true;
    void (async () => {
      const targets = new Map<string, {
        baseUrl: string;
        billing: NonNullable<ReturnType<typeof resolveCreditConnection>>['billing'];
      }>();
      for (const group of groups) {
        const target = resolveCreditConnection(group.provider, group.model, { providers, generalModels });
        if (target) targets.set(target.baseUrl, { baseUrl: target.baseUrl, billing: target.billing });
      }
      const next: Record<string, CreditPriceTable | null> = {};
      for (const [baseUrl, info] of targets) {
        next[baseUrl] = await loadCreditPriceTable(info.baseUrl, info.billing);
      }
      if (active) setTables(next);
    })();
    return () => {
      active = false;
    };
  }, [groups, providers, generalModels]);

  /** 逐组算积分（与徽章同一套：手动价 → 价目表 → 兜底） */
  const rows = useMemo(() => groups.map((group) => {
    const target = resolveCreditConnection(group.provider, group.model, { providers, generalModels });
    if (!target) return { ...group, credits: null as number | null };
    const outgoingQuality = resolveOutgoingImageQuality(target.modelId, group.quality);
    const estimate = estimateWithBilling(
      target.baseUrl ? tables[target.baseUrl] ?? null : null,
      { modelId: target.modelId, quality: outgoingQuality, resolution: group.resolution, count: group.count },
      target.billing,
      /* ★ P3 分组折扣（**MTV 增强**）：与节点徽章同口径；拿不到就是 null ⇒ 原价、不阻断 */
      target.discount?.ratio ?? null,
    );
    return { ...group, credits: estimate ? estimate.credits : null };
  }), [groups, tables, providers, generalModels]);

  const total = useMemo(() => {
    let sum = 0;
    let unknown = 0;
    for (const row of rows) {
      if (row.credits === null) unknown += row.count;
      else sum += row.credits;
    }
    return { sum: Math.round(sum * 100) / 100, unknown };
  }, [rows]);

  const imageCount = useMemo(() => rows.reduce((acc, row) => acc + row.count, 0), [rows]);

  return (
    <SettingsPaneBody>
      <SettingsPaneHeader
        title={t('账单记录')}
        description={t('按本机输出历史，用连接价目表逐条估算的花费。真实扣费以厂商后台为准。')}
      />

      <div className="mt-8 space-y-5">
        <SettingsRow title={t('图片生成合计')} description={t('本地记录里成功生成的图片张数。')}>
          <p className="settings-pane-desc">{`${imageCount}`}</p>
        </SettingsRow>

        <SettingsRow
          title={t('预计总花费')}
          description={total.unknown > 0
            ? t('其中 {count} 张查不到价目，未计入。', { count: total.unknown })
            : t('全部档位都查到了价目。')}
        >
          <p className="settings-pane-desc">{`${formatCredits(total.sum)} ${t('积分')}`}</p>
        </SettingsRow>

        <SettingsRow
          stacked
          title={t('按模型与档位')}
          description={t('同一模型同一档位归为一行；积分 = 单价 × 张数。')}
        >
          {rows.length === 0 ? (
            <p className="settings-pane-desc">{t('当前项目还没有图片生成记录。')}</p>
          ) : (
            <div className="o-card">
              {rows.map((row) => (
                <div className="o-card__row o-card__row--center" key={row.key}>
                  <div className="o-card__body">
                    <div className="o-card__title">{modelName(row.model, row.provider)}</div>
                    <div className="o-card__desc">
                      {[row.provider, row.resolution, row.quality].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className="o-muted">{t('{count} 张', { count: row.count })}</span>
                  <span className="o-card__title">
                    {row.credits === null ? '-' : `${formatCredits(row.credits)} ${t('积分')}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SettingsRow>
      </div>
    </SettingsPaneBody>
  );
}
