/**
 * 官方「应用市场」列表 + 卡片 —— live `vendor-pkg-canvas-ChpWx5JY.js` 逐字移植。
 *
 * | 官方符号 | 偏移 | 本文件 | 说明 |
 * | --- | --- | --- | --- |
 * | `RCe` | 349411 | `MarketPluginCard` | 市场卡片（`vD`/`aY`/`lY`/`cY`/`dY`/`uY`/`MCe`/`PCe` 类串逐字；已安装 `Fs`(Tabler `check`,16/1.5) / 未安装 `$r`(Tabler `plus`,16/1.33) + `aria-label`） |
 * | `LCe` | 350658 | `MarketPluginSkeletonCard` | 骨架卡（`article className=vD aria-hidden`，`$n`(`animate-pulse rounded-md bg-input/30`) + `Tu`(`rounded bg-white/10`)） |
 * | `pY` | 351515 | `MarketPluginSkeletonList` | 骨架列表（`DCe = 8`） |
 * | `FCe` | 351606 | `PluginMarketList` | 市场列表容器（错误 + 重试 / 加载 / 空态 / 数据 四分支） |
 * | `Gi`/`fk`/`jbe`/`Mbe` | 100354–100672 | `PluginMarketIcon` | 插件图标：`brainstorm`/`visualize` 内置图 → `iconUrl` 图片 → 首字母色块 |
 *
 * 官方类串常量（@348389–349322，逐字）：
 * ```js
 * vD="flex min-h-[109px] w-full flex-col gap-1.5 self-stretch rounded-2xl border border-white/[0.08] bg-card-background/60 py-3 px-4"
 * aY=z("transition-[border-color,background-color] duration-200 ease-out","hover:border-white/[0.12] hover:bg-white/[0.04]"); lY="group"
 * cY=z("cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20")
 * dY=z("w-full truncate text-xs font-normal leading-[18px] text-white/60","transition-colors duration-200 group-hover:text-white/72")
 * uY=z("line-clamp-2 w-full text-xs font-normal leading-[18px] text-white/60","transition-colors duration-200 group-hover:text-white/72")
 * Z1="text-[#E6E6E6]"; jCe=z("size-4 shrink-0 aspect-square",Z1); t2=jCe
 * MCe=z("absolute right-4 top-3 z-10 flex size-8 shrink-0 aspect-square cursor-pointer items-center justify-center rounded-lg",Z1,"transition-colors hover:bg-white/[0.06]","disabled:cursor-not-allowed disabled:opacity-60")
 * PCe=z("absolute right-4 top-3 z-10 flex size-8 shrink-0 items-center justify-center",Z1)
 * DCe=8; Tu="rounded bg-white/10"
 * ```
 *
 * ⚠️ 如实记录（MTV 侧差异，均不猜测）：
 * 1. 官方卡片底 `bg-card-background/60`：MTV 的 tailwind 色表里**没有** `card-background` 键
 *    （只有 `card`）⇒ 本文件用与 `SkillsManagerDialog` 既有技能卡一致的 `bg-card/60`
 *    （否则该类名不生成、卡片背景透明）。
 * 2. 官方卡片的安装按钮带 `Dt` 气泡提示（shadcn Tooltip）；MTV 该弹窗未接 Tooltip 组件
 *    ⇒ 只保留官方 `aria-label={installPluginLabel}`（文案与官方一致）。
 * 3. 官方 `FCe` 的错误分支文案是 `Tp(errorCode, t, "chatAdapter.addMenu.plugins.errors.listFailed")`
 *    的「错误码 → 文案」映射；MTV 市场层给的是**原始错误串**，没有错误码 ⇒ 直接显示官方
 *    `errors.listFailed` 文案（原始错误串不展示）。
 */
import { memo, useState } from 'react';
import { useT } from '../../i18n';
import type { PluginMarketplaceItem } from '../../services/plugins/pluginMarketplace';
import { OfficialTablerCheckIcon, OfficialTablerPlusIcon } from './officialIcons';

/** 官方 `vD`。 */
export const MARKET_CARD_BASE_CLASS = 'flex min-h-[109px] w-full flex-col gap-1.5 self-stretch rounded-2xl border border-white/[0.08] bg-card/60 py-3 px-4';
/** 官方 `aY` + `lY`。 */
const MARKET_CARD_HOVER_CLASS = 'group transition-[border-color,background-color] duration-200 ease-out hover:border-white/[0.12] hover:bg-white/[0.04]';
/** 官方 `cY`。 */
const MARKET_CARD_BUTTON_CLASS = 'cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60';
/** 官方 `dY`。 */
const MARKET_CARD_SUBTITLE_CLASS = 'w-full truncate text-xs font-normal leading-[18px] text-white/60 transition-colors duration-200 group-hover:text-white/[0.72]';
/** 官方 `uY`。 */
const MARKET_CARD_DESC_CLASS = 'line-clamp-2 w-full text-xs font-normal leading-[18px] text-white/60 transition-colors duration-200 group-hover:text-white/[0.72]';
/** 官方 `Z1` + `t2`。 */
const MARKET_ICON_CLASS = 'size-4 shrink-0 aspect-square text-[#E6E6E6]';
/** 官方 `MCe`。 */
const MARKET_INSTALL_BUTTON_CLASS = `absolute right-4 top-3 z-10 flex size-8 shrink-0 aspect-square cursor-pointer items-center justify-center rounded-lg text-[#E6E6E6] transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60`;
/** 官方 `PCe`。 */
const MARKET_INSTALLED_BADGE_CLASS = 'absolute right-4 top-3 z-10 flex size-8 shrink-0 items-center justify-center text-[#E6E6E6]';
/** 官方 `$n`。 */
const SKELETON_BLOCK_CLASS = 'animate-pulse rounded-md bg-input/30';
/** 官方 `Tu`。 */
const SKELETON_TINT_CLASS = 'rounded bg-white/10';
/** 官方 `DCe`。 */
export const MARKET_SKELETON_COUNT = 8;
/** 官方 `_Y` 的 2 列 grid（列表容器的父级）。 */
export const SKILLS_DIALOG_GRID_CLASS = 'grid min-h-0 w-full flex-1 auto-rows-min grid-cols-2 content-start items-start justify-start gap-x-4 gap-y-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';
/**
 * ⚠️ 官方这条列表**没有滑条**（`[&::-webkit-scrollbar]:hidden` + `[scrollbar-width:none]`）；
 * MTV 的全局自绘 `OverlayScrollbarLayer` 不吃 CSS、只认 `data-overlay-scrollbar="off"`
 * ⇒ 容器上必须同时挂这个属性，否则右侧会多出一条自绘滑条（用户实测图 3：「另外移除 右侧的滑条」）。
 * 见 `OverlayScrollbarLayer.tsx:22` 的 `DISCOVERY_EXCLUSION_SELECTOR`。
 * 该属性直接写在调用方的 JSX 上（这里不再额外导出常量，避免 react-refresh 只导出组件的约束）。 */

/* ── 官方插件图标链（`Gi`/`fk`/`jbe`/`Mbe`，@98917–100672，逐字） ── */

/** 官方 `zge`。 */
const BRAINSTORM_ICON_URL = 'https://fe-assets.tapnow.media/0a8da41c37db9507b96c3dc55fb843278f7127e5/assets/brainstorm-icon-DOBrugdc.svg';
/** 官方 `Cbe`。 */
const VISUALIZE_ICON_URL = 'https://fe-assets.tapnow.media/0a8da41c37db9507b96c3dc55fb843278f7127e5/assets/visualize-icon-Bw9rqZKG.svg';
/** 官方 `Sbe` / `AR`。 */
export const MARKET_PLUGIN_ICON_SIZE = 38;
const PLUGIN_ICON_SMALL_SIZE = 16;
/** 官方 `Aq`。 */
const PLUGIN_ICON_CARD_CLASS = 'flex shrink-0 items-center justify-center overflow-hidden rounded-[10px]';
/** 官方 `Nbe(e)`。 */
function pluginIconFrameClass(size: number): string {
  return size <= PLUGIN_ICON_SMALL_SIZE
    ? 'flex shrink-0 items-center justify-center overflow-hidden rounded-[4px]'
    : PLUGIN_ICON_CARD_CLASS;
}
/** 官方 `Abe`。 */
function normalizePluginId(pluginId: string): string {
  return pluginId.toLowerCase().trim().replace(/[\s-]+/g, '_');
}
/** 官方 `Ibe`。 */
function builtinPluginIcon(pluginId: string): 'brainstorm' | 'visualize' | null {
  const normalized = normalizePluginId(pluginId);
  if (normalized === 'brainstorm' || normalized === 'tapnow_brainstorm') return 'brainstorm';
  if (normalized === 'visualize' || normalized === 'tapnow_visualize') return 'visualize';
  return null;
}
/** 官方 `c3`。 */
const PLUGIN_ICON_PALETTE = ['#4385BE', '#3AA99F', '#879A39', '#D0A215', '#DA702C', '#D14D41', '#8B7EC8', '#CE5D97'];
/** 官方 `Tbe`。 */
// eslint-disable-next-line react-refresh/only-export-components
export function pluginIconColor(pluginId: string): string {
  let hash = 0;
  for (let index = 0; index < pluginId.length; index += 1) {
    hash = pluginId.charCodeAt(index) + ((hash << 5) - hash);
  }
  return PLUGIN_ICON_PALETTE[Math.abs(hash) % PLUGIN_ICON_PALETTE.length];
}
/** 官方 `Ebe`。 */
// eslint-disable-next-line react-refresh/only-export-components
export function pluginInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2
    ? `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
    : label.trim().slice(0, 2).toUpperCase();
}
/** 官方 `kbe(e)`。 */
function pluginInitialsClass(size: number): string {
  return size <= PLUGIN_ICON_SMALL_SIZE
    ? 'text-[8px] font-semibold leading-none tracking-wide'
    : 'text-[13px] font-semibold leading-none tracking-wide';
}

export interface PluginMarketIconProps {
  pluginId: string;
  label: string;
  iconUrl?: string;
  size?: number;
}

/** 官方 `Gi`（`variant="card"` 分支）+ `fk`(b) + `jbe` + `Mbe`。 */
export const PluginMarketIcon = memo(function PluginMarketIcon({
  pluginId,
  label,
  iconUrl,
  size = MARKET_PLUGIN_ICON_SIZE,
}: PluginMarketIconProps) {
  const [failed, setFailed] = useState(false);
  const resolvedLabel = label || pluginId;
  const source = failed ? undefined : iconUrl?.trim() || undefined;
  const builtin = builtinPluginIcon(pluginId);
  return (
    <span className={PLUGIN_ICON_CARD_CLASS} style={{ width: size, height: size }}>
      {builtin === 'brainstorm' ? (
        <img src={BRAINSTORM_ICON_URL} alt="" aria-hidden draggable={false} className="shrink-0 rounded-[22%] object-cover" style={{ width: size, height: size }} />
      ) : builtin === 'visualize' ? (
        <img src={VISUALIZE_ICON_URL} alt="" aria-hidden draggable={false} className="shrink-0 rounded-[22%] object-cover" style={{ width: size, height: size }} />
      ) : source ? (
        <img
          src={source}
          alt={resolvedLabel}
          draggable={false}
          className="size-full cursor-default object-contain"
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={`${pluginIconFrameClass(size)} ${pluginInitialsClass(size)} text-white`}
          style={{ width: size, height: size, backgroundColor: pluginIconColor(pluginId.toLowerCase()) }}
          aria-hidden
        >
          {pluginInitials(resolvedLabel)}
        </span>
      )}
    </span>
  );
});

/* ── 卡片 / 骨架 / 列表 ── */

export interface MarketPluginCardProps {
  plugin: PluginMarketplaceItem;
  displayName: string;
  /** 官方 `u = categoryLabel?.trim() || category?.trim() || t("…plugins.byTapNow")` 的结果。 */
  categoryLabel: string;
  isInstalled: boolean;
  isBusy?: boolean;
  /**
   * MTV 侧「没有安装入口」时置真（宿主没给 `onInstallPlugin`）。
   * 官方卡片在这一位只有 `isBusy` 一种禁用来源 ⇒ 这里复用同一条 `disabled` 分支
   * （`disabled:cursor-not-allowed disabled:opacity-60` 逐字保留），不新增类串。
   */
  installDisabled?: boolean;
  installPluginLabel: string;
  onOpenDetail: (plugin: PluginMarketplaceItem) => void;
  onInstall: (plugin: PluginMarketplaceItem) => void;
}

/** 官方 `RCe`。 */
export const MarketPluginCard = memo(function MarketPluginCard({
  plugin,
  displayName,
  categoryLabel,
  isInstalled,
  isBusy = false,
  installDisabled = false,
  installPluginLabel,
  onOpenDetail,
  onInstall,
}: MarketPluginCardProps) {
  return (
    <article className={`${MARKET_CARD_BASE_CLASS} ${MARKET_CARD_HOVER_CLASS} relative`}>
      <button
        type="button"
        className={`flex w-full flex-col gap-1.5 ${MARKET_CARD_BUTTON_CLASS}`}
        disabled={isBusy}
        onClick={() => onOpenDetail(plugin)}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            {/* 官方 `Gi pluginId={e.pluginName} label={d} iconUrl={e.iconUrl}`；
                ⚠️ MTV 的 `PluginManifest` 没有 `iconUrl` 字段 ⇒ 恒为 `undefined`，
                `fk` 走 `Mbe`（首字母色块）分支。 */}
            <PluginMarketIcon pluginId={pluginNameOf(plugin)} label={displayName} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-9">
            <p className="w-full truncate text-sm font-semibold leading-5 tracking-tight text-white">{displayName}</p>
            <p className={MARKET_CARD_SUBTITLE_CLASS}>{categoryLabel}</p>
          </div>
        </div>
        <p className={MARKET_CARD_DESC_CLASS}>{descriptionOf(plugin)}</p>
      </button>
      {isInstalled ? (
        <span className={MARKET_INSTALLED_BADGE_CLASS} aria-hidden>
          <OfficialTablerCheckIcon className={MARKET_ICON_CLASS} size={16} strokeWidth={1.5} />
        </span>
      ) : (
        <button
          type="button"
          disabled={isBusy || installDisabled}
          onClick={(event) => {
            event.stopPropagation();
            onInstall(plugin);
          }}
          className={MARKET_INSTALL_BUTTON_CLASS}
          aria-label={installPluginLabel}
        >
          <OfficialTablerPlusIcon className={MARKET_ICON_CLASS} size={16} strokeWidth={1.33} />
        </button>
      )}
    </article>
  );
});

/** 官方 `LCe` 的单块骨架。 */
function SkeletonBlock({ className }: { className: string }) {
  return <div className={`${SKELETON_BLOCK_CLASS} ${SKELETON_TINT_CLASS} ${className}`} />;
}

/** 官方 `LCe`：骨架卡（`variant="plugin"` 的中间块是「图标 + 短块」）。 */
export const MarketPluginSkeletonCard = memo(function MarketPluginSkeletonCard({
  index,
  variant = 'skill',
}: {
  index: number;
  variant?: 'skill' | 'plugin';
}) {
  return (
    <article className={MARKET_CARD_BASE_CLASS} aria-hidden>
      <div className="flex items-start gap-3">
        <SkeletonBlock className="size-[38px] shrink-0 rounded-[10px]" />
        <div className="flex min-w-0 flex-1 items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <SkeletonBlock className="h-5 w-4/5" />
            {variant === 'plugin' ? (
              <div className="flex items-center gap-1">
                <SkeletonBlock className="size-3.5 shrink-0 rounded-sm" />
                <SkeletonBlock className="h-[18px] w-10" />
              </div>
            ) : (
              <SkeletonBlock className="h-[18px] w-2/5" />
            )}
          </div>
          {index % 3 === 0 ? <SkeletonBlock className="size-8 shrink-0 rounded-md" /> : null}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <SkeletonBlock className="h-[18px] w-full" />
        <SkeletonBlock className="h-[18px] w-[88%]" />
      </div>
    </article>
  );
});

/** 官方 `pY`（`DCe = 8`）。 */
export const MarketPluginSkeletonList = memo(function MarketPluginSkeletonList({
  variant = 'skill',
}: {
  variant?: 'skill' | 'plugin';
}) {
  return (
    <>
      {Array.from({ length: MARKET_SKELETON_COUNT }, (_, index) => (
        <MarketPluginSkeletonCard key={index} index={index} variant={variant} />
      ))}
    </>
  );
});

/** 卡片要用到的「插件名」（官方 `e.pluginName`）：MTV 用 manifest id 兜底。 */
// eslint-disable-next-line react-refresh/only-export-components
export function pluginNameOf(plugin: PluginMarketplaceItem): string {
  return plugin.status === 'ready' ? plugin.manifest.id : plugin.repository;
}

/** 卡片描述（官方 `e.description`）。 */
// eslint-disable-next-line react-refresh/only-export-components
export function descriptionOf(plugin: PluginMarketplaceItem): string | undefined {
  return plugin.status === 'ready' ? plugin.manifest.description : plugin.error;
}

export interface PluginMarketListProps {
  /** 官方 `plugins`（未过滤全量；只用于判断「是否处于加载中」）。 */
  plugins: readonly PluginMarketplaceItem[];
  /** 官方 `pluginsWithInstallationState`（已按搜索词过滤）。 */
  pluginsWithInstallationState: readonly PluginMarketplaceItem[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  /** 官方 `refetch`。 */
  refetch: () => void;
  /** 官方 `searchQuery`（决定空态是「暂无应用」还是「没有匹配的应用」）。 */
  searchQuery: string;
  /** 官方 `busyPluginName`（MTV 用仓库地址）。 */
  busyPluginName?: string;
  /** 官方 `installPluginLabel`（`chatAdapter.addMenu.plugins.installPlugin`）。 */
  installPluginLabel: string;
  /** 官方 `displayNameOf(plugin)`。 */
  displayNameOf: (plugin: PluginMarketplaceItem) => string;
  /** 官方 `categoryLabelOf(plugin)`（`categoryLabel ?? category ?? t(byTapNow)`）。 */
  categoryLabelOf: (plugin: PluginMarketplaceItem) => string;
  isInstalled: (plugin: PluginMarketplaceItem) => boolean;
  onPluginClick: (plugin: PluginMarketplaceItem) => void;
  onInstall: (plugin: PluginMarketplaceItem) => void;
  /** 见 `MarketPluginCardProps.installDisabled`。 */
  installDisabled?: boolean;
}

/** 官方 `FCe`：市场列表容器（放在 `_Y` 的 2 列 grid 里）。 */
export const PluginMarketList = memo(function PluginMarketList({
  plugins,
  pluginsWithInstallationState,
  isLoading,
  isFetching,
  isError,
  refetch,
  searchQuery,
  busyPluginName,
  installPluginLabel,
  displayNameOf,
  categoryLabelOf,
  isInstalled,
  onPluginClick,
  onInstall,
  installDisabled = false,
}: PluginMarketListProps) {
  const t = useT();
  if (isError) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center gap-3 px-2 py-10 text-center">
        <p className="text-sm text-text-text-tertiary">{t('chatAdapter.addMenu.plugins.errors.listFailed')}</p>
        <button
          type="button"
          className="h-8 rounded-lg bg-white px-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
          onClick={refetch}
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }
  if (isLoading || (isFetching && plugins.length === 0)) {
    return <MarketPluginSkeletonList variant="plugin" />;
  }
  if (pluginsWithInstallationState.length === 0) {
    /* 官方：`searchQuery.trim() ? x("…plugins.noSearchResults",{defaultValue:"No matching Apps"}) : x("…skills.emptyPlugins")`。
       ⚠️ MTV 侧 `…skills.emptyPlugins` 用**中文原文 key**「暂无应用」（四语言词条已存在，
       官方 zh 值就是「暂无应用」）⇒ 与官方同一个可见文案，但走 MTV 的 key 体系。 */
    return (
      <div className="col-span-full px-2 py-10 text-center text-sm text-text-text-tertiary">
        {searchQuery.trim()
          ? t('chatAdapter.addMenu.plugins.noSearchResults')
          : t('暂无应用')}
      </div>
    );
  }
  return (
    <>
      {pluginsWithInstallationState.map((plugin) => (
        <MarketPluginCard
          key={pluginNameOf(plugin)}
          plugin={plugin}
          displayName={displayNameOf(plugin)}
          categoryLabel={categoryLabelOf(plugin)}
          isInstalled={isInstalled(plugin)}
          isBusy={busyPluginName === pluginNameOf(plugin)}
          installDisabled={installDisabled}
          installPluginLabel={installPluginLabel}
          onOpenDetail={onPluginClick}
          onInstall={onInstall}
        />
      ))}
    </>
  );
});

export default PluginMarketList;
