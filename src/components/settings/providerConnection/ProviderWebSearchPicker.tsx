/**
 * settings/providerConnection/ProviderWebSearchPicker — 联网搜索厂商切换卡片。
 * 所有厂商密钥都保留在本地，这里只决定当前使用哪一家。
 */
import { Icon } from '@iconify/react';
import { useT } from '../../../i18n';
import type { ApiProviderConfig } from '../../../types';
import type { ProviderDefinition } from '../../../services/ai/providerCatalogService';

interface ProviderWebSearchPickerProps {
  definitions: readonly ProviderDefinition[];
  providerConfigs: Record<string, ApiProviderConfig>;
  currentDefinition: ProviderDefinition;
  onChoose: (definition: ProviderDefinition) => void;
}

export default function ProviderWebSearchPicker({
  definitions,
  providerConfigs,
  currentDefinition,
  onChoose,
}: ProviderWebSearchPickerProps) {
  const t = useT();

  return (
    <section className="o-section">
      <div className="o-section__head">
        <div>
          <h4 className="o-section__title">{t('搜索厂商')}</h4>
          <p className="o-section__desc">{t('选择当前使用的服务，其他厂商密钥会保留在本地')}</p>
        </div>
      </div>
      <div className="o-picker">
        {definitions.map((item) => {
          const selected = item.id === currentDefinition.id;
          const configured = Boolean(providerConfigs[item.id]?.apiKey?.trim());
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              className="o-picker__item"
              onClick={() => onChoose(item)}
            >
              <span className="o-picker__badge">{item.badgeText}</span>
              <span className="o-picker__copy">
                <strong>{item.name}</strong>
                <small>{configured ? t('API Key 已配置') : item.description}</small>
              </span>
              <Icon icon={selected ? 'lucide:circle-check' : 'lucide:chevron-right'} width={18} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
