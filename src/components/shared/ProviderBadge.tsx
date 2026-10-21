import type { ApiProviderConfig } from '../../types';
import { getProviderDefinition } from '../../services/ai/providerCatalogService';

interface ProviderBadgeProps {
  providerId: string;
  config?: ApiProviderConfig;
  fallbackName?: string;
  fallbackBadge?: string;
  size?: 'small' | 'medium' | 'large';
}

const SIZES = {
  small: 'h-5 w-5 rounded-md text-[9px]',
  medium: 'h-6 w-6 rounded-md text-[10px]',
  large: 'h-[34px] w-[34px] rounded-lg text-[11px]',
};

const TONES: Record<string, string> = {
  apimart: 'bg-[var(--success-bg)] text-[var(--success-light)]',
  volcengine: 'bg-[var(--info-bg)] text-[var(--info-light)]',
  grsai: 'bg-[var(--danger-bg)] text-[var(--danger-light)]',
  dreamina: 'bg-[var(--warning-bg)] text-[var(--warning-light)]',
};

function abbreviateName(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) || [];
  if (words.length > 1) {
    return `${Array.from(words[0] || '')[0]}${Array.from(words[words.length - 1] || '')[0]}`.toUpperCase();
  }
  const word = words[0] || '';
  const capitals = word.match(/[A-Z]/g);
  if (capitals && capitals.length > 1) return capitals.slice(0, 2).join('');
  return Array.from(word).slice(0, 2).join('').toUpperCase() || '?';
}

/** 按实际连接展示厂商身份，自定义连接使用名称缩写。 */
export default function ProviderBadge({
  providerId,
  config,
  fallbackName,
  fallbackBadge,
  size = 'medium',
}: ProviderBadgeProps) {
  const definition = getProviderDefinition(providerId, config);
  const catalogId = definition?.id || providerId;
  const isCustom = catalogId === 'custom-openai' || (!definition && !!config);
  const name = (isCustom ? config?.name?.trim() : definition?.name)
    || fallbackName || definition?.name || providerId;
  const badge = isCustom
    ? abbreviateName(name)
    : definition?.badgeText || fallbackBadge || abbreviateName(name);
  // ⚠️ 兜底色原来是 MTV 的 `--brand-*`（靛蓝 #6366f1 / #818cf8），与官方主色 `--primary #1fa2dc`
  //    在同一屏里会同时出现 ⇒ 实测「一个界面 3 种蓝」。
  //    现按**官方 `Badge` 的 `default` variant** 走：`bg-white/10 text-white/80`（中性，不带任何蓝）。
  const tone = TONES[catalogId] || 'bg-white/10 text-white/80';

  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={`inline-flex shrink-0 select-none items-center justify-center border border-[var(--separator-color)] font-semibold leading-none tracking-wide ${SIZES[size]} ${tone}`}
    >
      {badge}
    </span>
  );
}
