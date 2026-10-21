/**
 * LibraryAssetRow —— 官方素材库面板里的**素材条目**（列表行）
 *
 * 官方源码（`page-DPdEgTS0.js` @251437 `Iw` 组件，逐字）：
 * ```jsx
 * <div className={B(DF, "group/asset flex w-full min-w-0 items-center self-stretch rounded-sm", PF)}>
 *   <div className="flex w-full min-w-0 items-center gap-2.5 p-1" draggable>
 *     <div className="flex min-w-0 flex-1 items-center gap-2.5">
 *       <div className="flex size-6 shrink-0 items-center justify-center">
 *         <img src={thumb} alt={name} className="block size-6 object-cover" loading="lazy"/>   // CX 组件
 *       </div>
 *       <div className="min-h-0 min-w-0 flex-1 rounded-[4px]">
 *         <div className="flex min-w-0 flex-col text-left">
 *           <div className="truncate text-sm leading-snug font-normal text-[rgb(169,169,169)]">{name}</div>
 *           {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
 *         </div>
 *       </div>
 *     </div>
 *     <div className="flex shrink-0 items-center pr-0.5">…行尾操作…</div>
 *   </div>
 * </div>
 * ```
 * ★ 名称：**`text-sm leading-snug font-normal text-[rgb(169,169,169)]`** = 14px / **400** / 19.25px / `#A9A9A9`
 *   （搜索态才是 `font-medium text-white/60`）
 * ★ 缩略图：**`size-6`(24×24) `object-cover`**；类型徽章 10×10（搜索态 8×8）
 * ★ 行内距：`gap-2.5`(10px) + `p-1`(4px)；行尾操作区 `pr-0.5`(2px)
 */
import { useRef, useState } from 'react';
import type { AssetFileEntry } from '../../services/fs/core';
import { LIBRARY_PANEL_FOLDERS, libraryFolderDir } from './libraryFolderPaths';
import { OfficialFolderIcon } from './LibraryFolderRows';
import {
  renameAssetFile,
  copyAssetToLibraryFolder,
  moveAssetToLibraryFolder,
  trashAssetFile,
} from '../../services/assetRowActions';
import PinConfirmDialog from '../canvas/PinConfirmDialog';
import { useAppStore } from '../../store/useAppStore';
import LibraryAssetPreviewCard from './LibraryAssetPreviewCard';
import { VideoTypeIcon } from './LibraryTypeIcons';

export interface LibraryAssetRowProps {
  file: AssetFileEntry;
  /** 官方副标题（`subtitle`）—— MTV 传相对路径；无则不渲染 */
  subtitle?: string;
  /** 官方内层就是 `draggable`（拖到画布建节点） */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  /** 动作完成后刷新列表 */
  onChanged?: () => void;
  /** 搜索关键字 —— 官方 `SX`：命中片段 `text-white/90`，其余继承 */
  keyword?: string;
}

/** 官方 `SX`（`page-DPdEgTS0.js` @249179）：`keyword` 命中片段包一层 `text-white/90` */
function HighlightedText({ text, keyword }: { text: string; keyword?: string }) {
  if (!keyword) return <>{text}</>;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => (
        part.toLowerCase() === keyword.toLowerCase()
          ? <span key={i} className="lib-asset-name-hit">{part}</span>
          : <span key={i}>{part}</span>
      ))}
    </>
  );
}

export function LibraryAssetRow({ file, subtitle, draggable, onDragStart, onChanged, keyword }: LibraryAssetRowProps) {
  const thumb = file.assetUrl;
  const isImage = file.category === 'image';
  /* 官方 `O = !!highlightKeyword` ⇒ 有搜索词时整行走 **search 变体**：
     缩略图盒 `bX.search`（r3.333 / border .833px）、徽章 **8×8**、名称 `font-medium text-white/60` */
  const isSearch = !!keyword?.trim();
  const badgeSize = isSearch ? 8 : 10;
  /* 官方 `O2` 的菜单状态：`⋯`(size-7 rounded-full opacity-0 group-hover/asset:opacity-100) → 菜单
     `w-[240px] gap-1 rounded-2xl bg-[#2F2F2F] p-2 px-1 shadow-… backdrop-blur-[28px]` */
  const [menuOpen, setMenuOpen] = useState(false);
  /* 靠近底部时菜单上翻（同上） */
  const [menuUp, setMenuUp] = useState(false);
  const [submenu, setSubmenu] = useState<'move' | 'copy' | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(file.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const finish = () => { setMenuOpen(false); setSubmenu(null); onChanged?.(); };

  /* 官方 HoverCard：`_X = 600ms` 进/出延迟；`side="right" align="center" sideOffset={12}` */
  const [previewAnchor, setPreviewAnchor] = useState<{ top: number; bottom: number; right: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHoverTimer = () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; } };
  const schedulePreview = (el: HTMLElement | null) => {
    clearHoverTimer();
    if (!el) return;
    hoverTimer.current = setTimeout(() => {
      const r = el.getBoundingClientRect();
      setPreviewAnchor({ top: r.top, bottom: r.bottom, right: r.right });
    }, 600);
  };
  const cancelPreview = () => { clearHoverTimer(); setPreviewAnchor(null); };

  return (
    <div
      className={`lib-asset-row${isSearch ? ' lib-asset-row--search' : ''}`}
      onMouseEnter={(e) => schedulePreview(e.currentTarget)}
      onMouseLeave={cancelPreview}
    >
      <div
        className="lib-asset-row-inner"
        role="button"
        tabIndex={0}
        aria-label={file.name}
        draggable={draggable}
        onDragStart={onDragStart}
      >
        <div className="lib-asset-row-main">
          <div className="lib-asset-thumb-slot">
            {/* 官方 `bX.default` 缩略图盒：`flex size-6 aspect-square rounded-[4px] border border-white/10 bg-white/5`
                + `shadow-[inset_0_0.5px_0_0_rgba(255,255,255,.16),0_4px_8px_0_rgba(0,0,0,.16)] overflow-hidden`；
                有缩略图 → `img block size-6 object-cover`；无 → 居中 12×12 图标 `text-white/60`（官方 `rE`）；
                非图片类型叠类型徽章（官方 `iE`：`absolute inset-0 flex items-center justify-center` +
                `text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]`，默认尺寸 **10**、搜索态 8） */}
            <div className={`lib-asset-thumb-box${isSearch ? ' lib-asset-thumb-box--search' : ''}`}>
              {isImage && thumb ? (
                <img src={thumb} alt={file.name} className="lib-asset-thumb" loading="lazy" />
              ) : (
                <div className="lib-asset-thumb-fallback" aria-hidden="true">
                  {file.category === 'video' ? '🎬' : file.category === 'audio' ? '🎵' : file.category === 'text' ? '📄' : '📁'}
                </div>
              )}
              {/* ★ 官方徽章只在 `Pl(type)`（= **视频**）时叠加：`CX` 里
                    `c ? <div className={cn(n,'relative')}><img/>{Pl(type)?<iE size={s}/>:null}</div> : …`
                  ⇒ 我此前给所有非图片类型都加了徽章是错的 ✗；字形 = 视频图标 `xLt`（= `Vd`，同一组件）。
                  尺寸 `s = variant==='default' ? 10 : 8` */}
              {file.category === 'video' ? (
                <span className="lib-asset-badge" aria-hidden="true">
                  <VideoTypeIcon size={badgeSize} />
                </span>
              ) : null}
            </div>
          </div>
          <div className="lib-asset-meta">
            <div className="lib-asset-meta-col">
              {renaming ? (
                /* 官方就地重命名：`Hi` 输入框（此处按官方条目度量：14px/400） */
                <input
                  className="lib-asset-rename"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      await renameAssetFile(file.path, draft);
                      setRenaming(false);
                      finish();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setDraft(file.name);
                      setRenaming(false);
                    }
                  }}
                  onBlur={() => setRenaming(false)}
                />
              ) : (
                <div className="lib-asset-name"><HighlightedText text={file.name} keyword={keyword} /></div>
              )}
              {subtitle ? <div className="lib-asset-subtitle">{subtitle}</div> : null}
            </div>
          </div>
        </div>
        <div className="lib-asset-actions">
          <button
            type="button"
            className="lib-asset-menu-trigger"
            aria-label="更多"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const panel = (e.currentTarget as HTMLElement).closest('[data-library-panel]')?.getBoundingClientRect();
              setMenuUp(r.bottom + 240 > (panel ? panel.bottom : window.innerHeight));
              setMenuOpen((v) => !v); setSubmenu(null);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
          {menuOpen ? (
            <div className={`lib-menu${menuUp ? ' is-up' : ''}`} role="menu" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="lib-menu-item" role="menuitem"
                onClick={() => { setRenaming(true); setMenuOpen(false); }}>
                <span className="lib-menu-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
                    <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415" />
                  </svg>
                </span>
                {'重命名'}
              </button>
              <button type="button" className="lib-menu-item" role="menuitem"
                onClick={() => { useAppStore.getState().openLibraryFolderPicker({ mode: 'move', filePath: file.path }); setMenuOpen(false); }}>
                <span className="lib-menu-icon"><OfficialFolderIcon /></span>
                {'移动到'}
              </button>
              <button type="button" className="lib-menu-item" role="menuitem"
                onClick={() => { useAppStore.getState().openLibraryFolderPicker({ mode: 'copy', filePath: file.path }); setMenuOpen(false); }}>
                <span className="lib-menu-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 7a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -8" />
                    <path d="M16 17v2a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2h2" />
                  </svg>
                </span>
                {'创建副本'}
              </button>
              {submenu ? (
                <div className="lib-menu-sub">
                  <div className="lib-menu-sub-title">{submenu === 'move' ? '移动到' : '复制到'}</div>
                  {LIBRARY_PANEL_FOLDERS.map((folder) => (
                    <button key={folder} type="button" className="lib-menu-item" role="menuitem"
                      onClick={async () => {
                        /* 显示用 `folder`（`Others`），实际写磁盘目录 `libraryFolderDir(folder)`（「其他」） */
                        const dir = libraryFolderDir(folder);
                        if (submenu === 'move') await moveAssetToLibraryFolder(file.path, dir);
                        else await copyAssetToLibraryFolder(file.path, dir);
                        finish();
                      }}>
                      <span className="lib-menu-icon"><OfficialFolderIcon /></span>
                      {folder}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="lib-menu-sep" />
              <button type="button" className="lib-menu-item lib-menu-item--danger" role="menuitem"
                onClick={() => { setConfirmDelete(true); finish(); }}>
                <span className="lib-menu-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" />
                    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                  </svg>
                </span>
                {'删除'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {/* ★ 官方删除确认（`O2` 里挂的 AlertDialog）：`assets.deleteConfirmTitle` =「删除资产」、
          `assets.deleteConfirmDesc` =「确定要删除「{{name}}」吗？此操作无法撤销。」、
          `library.cancel` =「取消」；确认走 MTV 已有的同一套确认弹窗组件（官方 `hb.confirm` 移植） */}
      {confirmDelete ? (
        <PinConfirmDialog
          title="删除资产"
          description={`确定要删除「${file.name}」吗？此操作无法撤销。`}
          confirmLabel="删除"
          cancelLabel="取消"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false);
            await trashAssetFile(file.path);
            onChanged?.();
          }}
        />
      ) : null}
      {previewAnchor ? <LibraryAssetPreviewCard file={file} anchor={previewAnchor} /> : null}
    </div>
  );
}

