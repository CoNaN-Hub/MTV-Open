/**
 * LibraryAssetPreviewCard —— 官方素材条目 **hover 右侧预览卡**（`F2` @238047，逐字移植）
 *
 * 官方源码：
 * ```jsx
 * <HoverCard side="right" align="center" sideOffset={12} contentClassName="p-0"
 *   collisionPadding={{right:24, top:16, bottom:16}} open={…} onOpenChange={…}
 *   content={<F2 detail={k} onApply={m}/>}>{Z}</HoverCard>
 *
 * F2 = ({detail, onApply}) => (
 *   <div className="flex w-[280px] max-h-[var(--radix-popover-content-available-height)] flex-col
 *                   overflow-hidden rounded-2xl border border-white/10 bg-popover shadow-2xl">
 *     <div className="relative flex min-h-0 w-full flex-1 basis-[225px] items-center justify-center
 *                     overflow-hidden bg-[#0F0F0F]">
 *       <Preview/>                       // 内容预览
 *       {verified && <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-8 items-start
 *              justify-center gap-0.5 bg-gradient-to-b from-[rgba(0,0,0,0.5)] to-transparent pt-1.5">
 *         <VerifiedIcon size={14} className="shrink-0 text-[#1fa2dc]"/>
 *         <span className="whitespace-nowrap text-[10px] font-normal leading-[14px] text-white">{t('library.verified')}</span>
 *       </div>}
 *     </div>
 *     <div className="flex shrink-0 flex-col gap-2 p-2">
 *       <div className="flex flex-col gap-0.5">
 *         <div className="flex items-center justify-between gap-2">
 *           <div className="truncate text-sm font-medium leading-5 text-white/90">{asset.name}</div>
 *           <TypeBadge asset/>
 *         </div>
 *         <div className="text-sm font-normal leading-5 text-white/40">{t('library.created')} {date}</div>
 *       </div>
 *       <button className="flex h-10 w-full items-center justify-center self-stretch rounded-[8px]
 *          border-[1.33px] border-white/10 bg-[#646464] text-sm font-semibold leading-none text-[#FAFAFA]
 *          backdrop-blur-[50px] transition-colors hover:bg-[#757575]"
 *         onClick={() => onApply(…)}>{t('library.applyToCanvas')}</button>
 *     </div>
 *   </div>
 * )
 * ```
 * ★ hover 延迟：官方 `_X = 600ms`（进/出都用同一个值）；`sideOffset = 12`；右侧碰撞留白 24、上下 16。
 * ★ zh：`library.created` =「创建于」、`library.applyToCanvas` =「应用到画布」、`library.verified` =「已审核」
 */
import { useEffect, useState } from 'react';
import { stat } from '@tauri-apps/plugin-fs';
import type { AssetFileEntry } from '../../services/fs/core';
import { isTauriEnv } from '../../services/fs/core';
import { applyLibraryFileToCanvas } from '../../services/assetRowActions';
import { VideoTypeIcon, AudioTypeIcon, TextTypeIcon, ImageTypeIcon } from './LibraryTypeIcons';

export interface LibraryAssetPreviewCardProps {
  file: AssetFileEntry;
  /** 行的屏幕矩形（用于定位到右侧、垂直居中） */
  anchor: { top: number; bottom: number; right: number };
}

export function LibraryAssetPreviewCard({ file, anchor }: LibraryAssetPreviewCardProps) {
  const [created, setCreated] = useState<string | null>(null);

  /* 官方 `library.created` + `bB(created_at)`（`toLocaleString`）—— MTV 用文件 mtime */
  useEffect(() => {
    let cancelled = false;
    if (!isTauriEnv() || file.path.startsWith('virtual://')) return;
    void stat(file.path)
      .then((info) => {
        if (cancelled) return;
        const mtime = (info as { mtime?: Date | string | number }).mtime;
        if (!mtime) return;
        setCreated(new Date(mtime).toLocaleString());
      })
      .catch(() => { /* 忽略 */ });
    return () => { cancelled = true; };
  }, [file.path]);

  const isImage = file.category === 'image';
  /* 右侧 + 垂直居中（`side="right" align="center" sideOffset={12}`），并做上下 16 / 右侧 24 的碰撞留白 */
  const top = Math.max(16, Math.min(anchor.top + (anchor.bottom - anchor.top) / 2 - 150, window.innerHeight - 16 - 320));
  const left = Math.min(anchor.right + 12, window.innerWidth - 24 - 280);

  return (
    <div
      className="lib-preview"
      style={{ top, left }}
      data-testid="library-preview-card"
    >
      <div className="lib-preview-stage">
        {isImage && file.assetUrl ? (
          <img src={file.assetUrl} alt={file.name} className="lib-preview-media" />
        ) : (
          <div className="lib-preview-placeholder" aria-hidden="true">
            {file.category === 'video' ? '🎬' : file.category === 'audio' ? '🎵' : file.category === 'text' ? '📄' : '📁'}
          </div>
        )}
        {file.category === 'text' ? (
          <div className="lib-preview-verified">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="lib-preview-verified-icon">
              <path d="M12 2l2.4 2.4 3.3-.6.6 3.3L21 9.5l-1.5 3 1.5 3-2.7 2.4-.6 3.3-3.3-.6L12 22l-2.4-2.4-3.3.6-.6-3.3L3 14.5l1.5-3L3 9.5l2.7-2.4.6-3.3 3.3.6z" />
            </svg>
            <span className="lib-preview-verified-text">{'已审核'}</span>
          </div>
        ) : null}
      </div>
      <div className="lib-preview-body">
        <div className="lib-preview-meta">
          <div className="lib-preview-name-row">
            <div className="lib-preview-name">{file.name}</div>
            {/* ★ 官方名称行右侧槽 = `yB`（`zoom-slider` @314318 `I_`）：**按资产类型的图标**，
                  尺寸 VIDEO 16 / AUDIO 12 / TEXT 14 / IMAGE `size-4`(16) / WORLD 16 / default 16，
                  颜色一律 `text-white/40`（`kfe = "shrink-0 text-white/40"`）。
                  ⚠️ 它不是收藏按钮（收藏触发点官方 bundle 里仍未定位到） */}
            <span className="lib-preview-type" aria-hidden="true">
              {file.category === 'video' ? <VideoTypeIcon size={16} />
                : file.category === 'audio' ? <AudioTypeIcon size={12} />
                  : file.category === 'text' ? <TextTypeIcon size={14} />
                    : <ImageTypeIcon size={16} />}
            </span>
          </div>
          {created ? (
            <div className="lib-preview-created">{'创建于'} {created}</div>
          ) : null}
        </div>
        <button
          type="button"
          className="lib-preview-apply"
          onClick={() => { void applyLibraryFileToCanvas(file); }}
        >
          {'应用到画布'}
        </button>
      </div>
    </div>
  );
}

export default LibraryAssetPreviewCard;
