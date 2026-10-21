/**
 * MediaViewerActions —— 官方媒体查看器底部操作条（`Qge` @436707 + `e$` @434454 + `t$` @434773，逐字）
 *
 * 官方容器 `e$`：
 *   `flex items-center gap-1 rounded-[24px] bg-[oklch(20%_0.008_250)] p-1.5
 *    shadow-[0_14px_40px_rgba(0,0,0,0.32)]`
 * 官方按钮 `t$`（= `Nw` → `H$` @439006，`surface` 默认 `transparent`；
 *   查看器左上返回箭头用同一颗 `H$` 的 `surface="solid"` 档）：
 *   `relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border`
 *   + `cursor-pointer text-[#F5F5F5]`
 *   + `transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none`
 *   + solid 时 `border-[oklch(31%_0.008_250)] bg-[oklch(20%_0.008_250)] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.10)]`
 *   + lit（active 或 hover 且未禁用）时 `border-[rgba(106,106,106,0.01)] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.16)]`
 *   + lit 层 `span` 用官方渐变 `Yge = "radial-gradient(ellipse 165.86% 163.75% at 50% 15%,
 *     #1A1A1A 0%, #282828 35.54%, #464847 67.77%, #656766 100%)"`，`scale-[0.78] opacity-0 → scale-100 opacity-100`
 *   + `aria-label`/`aria-busy`/`aria-pressed`/`aria-disabled`、禁用时 `tabIndex={-1}`、点击 `preventDefault+stopPropagation`
 *
 * 官方条目（`Qge` 里按 `actions` 开关渲染，全关 ⇒ 整个条返回 null）：
 *   · `copy && prompt.trim()` → 标签 `imagePreview.copyPrompt`（中文「复制提示词」），图标 `Gte`（Tabler clipboard-text）
 *   · `setAsMain && mainSrc && onSetAsMain` → 标签 = 当前主图 ? `imagePreview.currentMainImage`（「当前主图」）
 *       : `imagePreview.setAsMainImage`（「设为主图」）；`pressed`/`disabled` 都取「是否就是主图」；
 *       图标 `Zge` = `<span class="relative flex size-5 items-center justify-center">`
 *         `<Wc size=20/>` + 当前时再叠 `<badge size=10 class="absolute -right-0.5 -top-0.5 rounded-full bg-[oklch(20%_0.008_250)]"/>`
 *   · `download` → 标签 `imagePreview.download`（「下载」），`busy` 时图标换成 `Wo`（Tabler loader-2）+ `animate-spin`
 *   · `favorite` → 标签 `common.favorite`（「收藏」）/ `common.unfavorite`（「取消收藏」）；位置**在最后一位**；
 *       `pressed = b`（已收藏）、`busy = disabled = (b === void 0 || f)`（收藏态未拉到 或 点击中）；
 *       图标：busy ⇒ `Wo`（Tabler loader-2, 20）；已收藏 ⇒ `rh`（Tabler star-filled, 20, `text-[#FBBC05]`）；
 *       否则 ⇒ `Rg`（Tabler star, 20）。`b === void 0` 的语义见 `hooks/useFavoriteStatus.ts`。
 */
import { useCallback, useState } from 'react';
import { OfficialIcon } from '../../../sidebar/OfficialIcon';
import { useT } from '../../../../i18n';
import { OfficialStarFilledIcon, OfficialStarIcon } from '../officialFavoriteIcons';

/** 官方 `Yge`（逐字） */
const LIT_GRADIENT = 'radial-gradient(ellipse 165.86% 163.75% at 50% 15%, #1A1A1A 0%, #282828 35.54%, #464847 67.77%, #656766 100%)';

export interface MediaViewerActionButtonProps {
  label: string;
  /**
   * 官方 `H$` 的 `surface`（默认 `transparent`）：
   *   · `transparent` —— 查看器底条 `t$`/`Nw` 用的那档（无边框无底）
   *   · `solid`       —— 官方左上返回箭头用的那档（`border-[oklch(31%_0.008_250)] bg-[oklch(20%_0.008_250)] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.10)]`）
   */
  surface?: 'transparent' | 'solid';
  /** 官方 `H$` 的 `showTooltip`（默认 `!0`）；返回箭头传 `!1` ⇒ 不挂提示 */
  showTooltip?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  busy?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

/** 官方 `H$` @439006（surface 可切；底条条目走默认 `transparent`） */
export function MediaViewerActionButton({
  label,
  surface = 'transparent',
  showTooltip = true,
  disabled = false,
  pressed,
  busy,
  onClick,
  children,
}: MediaViewerActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const solid = surface === 'solid';
  const lit = pressed || (!disabled && hovered);
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) onClick?.();
  }, [disabled, onClick]);

  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy}
      aria-pressed={pressed}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      {...(showTooltip ? { 'data-tooltip': label, 'data-tooltip-pos': 'top' } : {})}
      onClick={handleClick}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        'relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border',
        'cursor-pointer text-[#F5F5F5]',
        'transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none',
        solid
          ? 'border-[oklch(31%_0.008_250)] bg-[oklch(20%_0.008_250)] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.10)]'
          : 'border-transparent bg-transparent',
        lit && 'border-[rgba(106,106,106,0.01)] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.16)]',
        disabled && 'cursor-default',
      ].filter(Boolean).join(' ')}
    >
      <span
        aria-hidden="true"
        style={{ background: LIT_GRADIENT }}
        className={[
          'pointer-events-none absolute inset-0 rounded-[inherit]',
          'transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none',
          lit ? 'scale-100 opacity-100' : 'scale-[0.78] opacity-0',
        ].join(' ')}
      />
      <span className="relative z-10 flex items-center justify-center">{children}</span>
    </button>
  );
}

export interface MediaViewerActionsProps {
  prompt?: string;
  /** 官方标签按媒体类型取不同 i18n：image → 当前主图/设为主图；video → 当前主视频/设为主视频 */
  mediaType?: 'image' | 'video';
  /** 官方 `setAsMain && mainSrc && onSetAsMain` */
  canSetAsMain?: boolean;
  /** 官方 `w = setAsMain && mainSrc && mo(mainSrc, media.src)`：当前展示的就是主媒体 */
  isCurrentMain?: boolean;
  onCopyPrompt?: () => void;
  onSetAsMain?: () => void;
  onDownload?: () => void;
  downloading?: boolean;
  /**
   * 官方 `Qge` 形参里的 `actions.favorite`（局部变量 `g`）—— 有才渲染该条目。
   * `sourceFileId` / `status` 对应官方 `g.sourceFileId` 与 `nc(G => g ? G.statuses[g.sourceFileId] : void 0)`。
   */
  favorite?: MediaViewerFavoriteAction;
}

/** 官方 `Qge({…, actions})` 里 `actions.favorite` 的形状（= 官方 `b8` 会话的 `actions.favorite`） */
export interface MediaViewerFavoriteAction {
  /** 官方 `g.sourceFileId` */
  sourceFileId: string;
  /** 官方 `b = nc(G => g ? G.statuses[g.sourceFileId] : void 0)`（`undefined` = 收藏态未拉到） */
  status: boolean | undefined;
  /** 官方 `_` 回调体内的 `await L_(g.sourceFileId, g.asset)` */
  onToggle: () => void | Promise<void>;
}

export default function MediaViewerActions({
  prompt = '',
  mediaType = 'image',
  canSetAsMain = false,
  isCurrentMain = false,
  onCopyPrompt,
  onSetAsMain,
  onDownload,
  downloading = false,
  favorite,
}: MediaViewerActionsProps) {
  const t = useT();
  /** 官方 `Qge` 的 `[f,m] = useState(!1)` —— 收藏点击的 in-flight 忙态 */
  const [favoritePending, setFavoritePending] = useState(false);
  const hasPrompt = !!prompt.trim();
  const showCopy = hasPrompt && !!onCopyPrompt;
  const showSetAsMain = canSetAsMain && !!onSetAsMain;
  const showDownload = !!onDownload;
  /** 官方 `g = o.favorite` */
  const showFavorite = !!favorite;
  /* 官方 `if(!(o.copy&&v || o.download || g || y)) return null` */
  if (!showCopy && !showSetAsMain && !showDownload && !showFavorite) return null;

  /** 官方 `b === void 0 || f`（`f` = 本次点击忙态） */
  const favoriteBusy = favorite ? favorite.status === undefined || favoritePending : false;
  /** 官方 `_` @436698：`if(!(!g || b === void 0 || f)){ m(!0); try{ await L_(g.sourceFileId, g.asset) } finally { m(!1) } }` */
  const handleFavoriteClick = favorite
    ? async () => {
        if (favorite.status === undefined || favoritePending) return;
        setFavoritePending(true);
        try {
          await favorite.onToggle();
        } finally {
          setFavoritePending(false);
        }
      }
    : undefined;

  return (
    <div className="flex items-center gap-1 rounded-[24px] bg-[oklch(20%_0.008_250)] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.32)]">
      {showCopy && (
        <MediaViewerActionButton label={t('复制提示词')} onClick={onCopyPrompt}>
          <OfficialIcon name="actions-copy" size={20} />
        </MediaViewerActionButton>
      )}
      {showSetAsMain && (
        <MediaViewerActionButton
          label={isCurrentMain
            ? (mediaType === 'video' ? t('当前主视频') : t('当前主图'))
            : (mediaType === 'video' ? t('设为主视频') : t('设为主图'))}
          pressed={isCurrentMain}
          disabled={isCurrentMain}
          onClick={onSetAsMain}
        >
          {/* 官方 `Zge`：`photo` 图标 + 当前时右上角一颗小徽章（官方徽章 `$E` 未能解析，
              暂用 Tabler check 代替 —— 语义一致，已在 AGENTS.md 记账） */}
          <span className="relative flex size-5 items-center justify-center">
            <OfficialIcon name="actions-set-main" size={20} />
            {isCurrentMain && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-[oklch(20%_0.008_250)]">
                <OfficialIcon name="copied" size={10} />
              </span>
            )}
          </span>
        </MediaViewerActionButton>
      )}
      {showDownload && (
        <MediaViewerActionButton
          label={t('下载')}
          busy={downloading}
          disabled={downloading}
          onClick={onDownload}
        >
          {downloading
            ? <OfficialIcon name="actions-spinner" size={20} className="animate-spin motion-reduce:animate-none" />
            : <OfficialIcon name="actions-download" size={20} />}
        </MediaViewerActionButton>
      )}
      {/* 官方 `Qge` 末位条目：`g && l.jsx(yw,{label:D,tooltipsEnabled:i,pressed:b,busy:b===void 0||f,
          disabled:b===void 0||f,onClick:()=>{_()},children:N})` */}
      {showFavorite && favorite && (
        <MediaViewerActionButton
          label={t(favorite.status ? '取消收藏' : '收藏')}
          pressed={favorite.status}
          busy={favoriteBusy}
          disabled={favoriteBusy}
          onClick={() => { void handleFavoriteClick?.(); }}
        >
          {favoriteBusy
            ? <OfficialIcon name="actions-spinner" size={20} className="animate-spin motion-reduce:animate-none" />
            : favorite.status
              ? <OfficialStarFilledIcon size={20} className="text-[#FBBC05]" />
              : <OfficialStarIcon size={20} />}
        </MediaViewerActionButton>
      )}
    </div>
  );
}
