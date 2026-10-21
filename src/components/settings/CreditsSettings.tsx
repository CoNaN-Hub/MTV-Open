/**
 * settings/CreditsSettings —— 「充值积分」页（用户 2026 点名）。
 *
 * ## 它解决什么
 * 顶部那颗积分按钮点一下就跳到这里，页面回答两个问题：
 *   ① 我现在还有多少积分？（= 我在厂商那里的余额折算过来的）
 *   ② 怎么充值？（**打开厂商自己的充值页**）
 *
 * ## ⚠️ MTV 不碰钱
 * MTV 没有支付后端，钱只会进厂商账户 ⇒ 这里只负责「把厂商的充值页打开」，
 * 不在本地伪造一套充值流程（用户 2026 选定：按钮打开厂商自己的充值页）。
 *
 * ## 余额怎么来
 * 见 `services/ai/creditBalance.ts`：new-api 系（土豆）**必须**单独配「系统访问令牌」，
 * 它的 API Key 读不到余额（实测 `/api/user/self` → `Unauthorized, invalid access token`）。
 */
import Select from '../shared/Select';
import { Icon } from '@iconify/react';
import { useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { useCreditBalance } from '../../hooks/useCreditBalance';
import { listCreditSourceConnections } from '../../services/ai/creditConnection';
import { topUpEndpoint } from '../../services/ai/creditBalance';
import { formatCredits } from '../../services/ai/creditEstimate';
import { openExternal } from './providerConnection/providerConnectionShared';
import { OFFICIAL_SELECT_TRIGGER, OfficialButton } from './official/OfficialControls';
import { SettingsPaneBody, SettingsPaneHeader, SettingsRow } from './SettingsPane';
import CreditBoltIcon from '../shared/CreditBoltIcon';

export default function CreditsSettings() {
  const t = useT();
  const providers = useAppStore((state) => state.config.providers);
  const updateConfig = useAppStore((state) => state.updateConfig);
  const saveConfig = useAppStore((state) => state.saveConfig);
  const openApiKeySettings = useAppStore((state) => state.openApiKeySettings);
  const showToast = useAppStore((state) => state.showToast);
  const { source, credits, priceAmount, error, loading, refresh } = useCreditBalance();

  const options = useMemo(() => listCreditSourceConnections({ providers }), [providers]);
  const topUpUrl = source ? topUpEndpoint(source.baseUrl, source.billing) : null;

  const handleTopUp = useCallback(() => {
    if (!topUpUrl) {
      showToast(t('这条连接没有可用的充值地址，请补填接口地址'), 'error');
      return;
    }
    void openExternal(topUpUrl);
  }, [showToast, t, topUpUrl]);

  return (
    <SettingsPaneBody>
      <SettingsPaneHeader
        title={t('充值积分')}
        description={t('余额来自你在厂商账户里的充值，按连接的换算比例折成积分；充值时直接充到厂商账户。')}
      />

      <div className="mt-8 space-y-5">
        <SettingsRow
          title={t('余额来源连接')}
          description={t('顶部那颗积分按钮显示的就是这条连接的余额。')}
        >
          {options.length > 0 ? (
            <Select
              fixedMenu
              triggerClassName={OFFICIAL_SELECT_TRIGGER}
              menuClassName="o-menu"
              menuHideOverlayScrollbar
              closeOnScroll
              className="o-w28"
              value={source?.id ?? ''}
              onChange={(selectedOptionValue) => {
                /* `updateConfig` 只改内存 ⇒ 必须显式落盘，否则重开面板就丢了
                   （与 `store.favorites` 同一写法） */
                updateConfig({ creditSourceConnectionId: selectedOptionValue });
                void saveConfig({ silent: true });
              }}
            >
              {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          ) : (
            <span className="settings-pane-desc">{t('还没有配置任何连接')}</span>
          )}
        </SettingsRow>

        <SettingsRow
          title={t('当前积分')}
          description={source
            ? t('从 {name} 的账户余额折算（{url}）', {
              name: source.name,
              url: source.billing?.balancePath?.trim() || '/api/user/self',
            })
            : t('读不到余额时显示 -，请在连接里补「账户访问令牌」。')}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-2xl font-medium tabular-nums text-[rgb(245,245,245)]">
              <CreditBoltIcon size={18} />
              {loading ? '…' : credits === null ? '-' : formatCredits(credits)}
            </span>
            {priceAmount !== null && (
              <span className="settings-pane-desc">
                {t('≈ {amount} {unit}', {
                  amount: Math.round(priceAmount * 100) / 100,
                  unit: source?.billing?.currencyLabel?.trim() || t('计价单位'),
                })}
              </span>
            )}
            <OfficialButton type="button" variant="outline" size="sm" onClick={refresh}>
              <Icon icon="lucide:refresh-cw" width={16} />
              {t('刷新')}
            </OfficialButton>
          </div>
        </SettingsRow>

        {/* 读失败时把服务端的原话显示出来 —— 只给一个 `-` 的话，「令牌没填 / 填成了 API Key /
            缺账户 ID」全都看不出来（实测：土豆要 `New-Api-User: <用户ID>`，缺了就是 401） */}
        {error && (
          <SettingsRow
            title={t('读取失败')}
            description={t('这是厂商接口返回的原话；按它提示在连接的「余额与充值」里补配置。')}
          >
            <p className="o-field__error" data-credit-balance-error>{error}</p>
          </SettingsRow>
        )}

        <SettingsRow
          title={t('前往充值')}
          description={t('打开厂商自己的充值页；MTV 不参与收款，钱直接充进厂商账户。')}
        >
          <OfficialButton type="button" variant="default" size="md" disabled={!topUpUrl} onClick={handleTopUp}>
            <Icon icon="lucide:external-link" width={16} />
            {t('打开充值页')}
          </OfficialButton>
        </SettingsRow>

        {source && (
          <SettingsRow
            title={t('余额读取设置')}
            description={t('接口地址、访问令牌、字段路径都在连接的「计费与积分」里配。')}
          >
            <OfficialButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openApiKeySettings(source.id)}
            >
              <Icon icon="lucide:settings-2" width={16} />
              {t('编辑「{name}」', { name: source.name })}
            </OfficialButton>
          </SettingsRow>
        )}
      </div>
    </SettingsPaneBody>
  );
}
