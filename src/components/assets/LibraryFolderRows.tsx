/**
 * LibraryFolderRows —— 官方素材库面板的**顶部固定区 + 文件夹行**（逐字移植官方 DOM/CSS）
 *
 * 官方来源（9444 实测 HTML + computed style，见 `D:\DEEPSEEK\t742-official-panel-full.html`）：
 * ```html
 * <div class="group/folder group/asset-folder flex h-8 w-full min-w-0 cursor-pointer items-center
 *             gap-2 rounded-sm pr-1 hover:bg-white/10" style="padding-left:6px">
 *   <div class="flex min-h-6 min-w-0 flex-1 items-center gap-2">
 *     <button class="flex size-6 shrink-0 items-center justify-center">
 *       <svg class="tabler-icon-chevron-right -ml-0.5 transition-transform rotate-90 text-white/90"><path d="M9 6l6 6l-6 6"/></svg>
 *     </button>
 *     <div class="flex size-6 shrink-0 items-center justify-center">
 *       <div class="group/asset-folder relative w-6 h-6 shrink-0 -translate-y-0.5 select-none">
 *         <svg class="absolute left-0 w-6" viewBox="0 0 24 16" style="top:3px;height:15.25px">…back 层(线性渐变 #A6A6A6→#737373)…</svg>
 *         <div class="absolute z-[2] bottom-0 left-0 w-6 rounded-[2px] overflow-hidden
 *                     transition-[transform] duration-200 ease-out
 *                     [transform:perspective(60px)_rotateX(0deg)]
 *                     group-hover/asset-folder:[transform:perspective(60px)_rotateX(-30deg)]"
 *              style="height:16px; transform-origin:center bottom; box-shadow: …">
 *           …front 层(径向渐变 #D9D9D9→#8C8C8C, rect rx=2)…
 *         </div>
 *       </div>
 *     </div>
 *     <div class="flex min-h-0 min-w-0 flex-1 items-center">
 *       <div class="flex min-w-0 max-w-full items-center gap-1.5 text-left">
 *         <span class="truncate text-sm leading-5 font-semibold text-white/90">角色</span>
 *       </div>
 *     </div>
 *     <div class="shrink-0">
 *       <button class="size-7 rounded-full opacity-0 group-hover/folder:opacity-100 …">…三点菜单…</button>
 *     </div>
 *   </div>
 * </div>
 * ```
 * ★ 关键：**行 hover 时文件夹 front 层绕底边做 `perspective(60px) rotateX(-30deg)`，200ms ease-out**。
 * ★ 名称字重 = `font-semibold` → **14px / 600 / lh20 / rgba(255,255,255,.9)**（不是 500/.6）。
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import folderBack from '../../assets/official-icons/lib-folder-back.svg?raw';
import folderFront from '../../assets/official-icons/lib-folder-front.svg?raw';
import subjectLibraryIcon from '../../assets/official-icons/lib-subject-library.svg?raw';
import {
  MenuDownload16Icon, MenuFolderArrow14Icon, MenuFolderPlus20Icon, MenuPencil14Icon, MenuTrash20Icon,
} from './LibraryMenuIcons';
import { createLibraryFolder, renameLibraryFolder, trashLibraryFolder } from '../../services/assetRowActions';
import PinConfirmDialog from '../canvas/PinConfirmDialog';
import { useAppStore } from '../../store/useAppStore';

/** ⚠️ 常量与纯函数已拆到 `./libraryFolderPaths`（组件文件只导出组件，见 react-refresh 规则）；
 *  面板等消费方请直接从 `./libraryFolderPaths` 引入。 */
import { LIBRARY_PANEL_FOLDERS } from './libraryFolderPaths';

/** ★ 官方 ⋯ 菜单是 radix `DropdownMenu`（portal）⇒ **同一时刻只会有一个菜单打开**。
 *  MTV 每个文件夹行各自持 `menuOpen` 状态 ⇒ 用模块级登记表在打开新菜单前关掉上一个。 */
let closeActiveFolderMenu: (() => void) | null = null;

/** 官方「tabler chevron-right」（`M9 6l6 6l-6 6`，展开态 `rotate-90`） */
function ChevronRight({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="lib-folder-chevron"
      style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <path d="M9 6l6 6l-6 6" />
    </svg>
  );
}

/** 官方自绘文件夹图标（两层 + 渐变 + hover 透视动画） */
export function OfficialFolderIcon() {
  return (
    <div className="lib-folder-icon">
      <span className="lib-folder-icon-back" dangerouslySetInnerHTML={{ __html: folderBack }} />
      <div className="lib-folder-icon-front" dangerouslySetInnerHTML={{ __html: folderFront }} />
    </div>
  );
}

/** 官方「tabler star-filled」（收藏） */
function StarFilled() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="lib-row-icon">
      <path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" />
    </svg>
  );
}

/** 官方「tabler help-circle」（主体库说明） */
function HelpCircle() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M12 16v.01" />
      <path d="M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483" />
    </svg>
  );
}

/** 官方「主体库说明」富提示（`tooltip.*` 文案逐字，来自官方 i18n `pBs.tooltip` / `oKs.tooltip`）
 *  - `label`                  = 「主体库说明」（= aria-label）
 *  - `purposeTitle`           = 「作用」
 *  - `purposeDescription`     = 「打包图、文、音、视频为统一「主体」，在视频节点中一键调用，免去逐一添加和引用素材的繁琐。」
 *  - `supportedModelsTitle`   = 「适用模型」
 *  - `supportedModelsDescription` = 「仅限 Seedance 2 系列及 Seedance 2.5 使用。」
 *  样式：`w-[300px] px-3 py-2.5 rounded-lg text-xs leading-[18px] bg-[rgba(51,51,51,0.80)] blur-[28px]`
 *       `shadow-[0px_4px_16px_rgba(0,0,0,0.16),inset_0px_0.5px_0px_rgba(255,255,255,0.16)]`，`side=right align=start sideOffset=8`。 */
function SubjectLibraryTip() {
  return (
    <span className="lib-help-tip" role="tooltip">
      <span className="lib-help-tip-body">
        <span>
          <span className="lib-help-tip-title">{'作用'}</span>
          <span className="lib-help-tip-text">
            {'打包图、文、音、视频为统一「主体」，在视频节点中一键调用，免去逐一添加和引用素材的繁琐。'}
          </span>
        </span>
        <span className="lib-help-tip-sec">
          <span className="lib-help-tip-title">{'适用模型'}</span>
          <span className="lib-help-tip-text">{'仅限 Seedance 2 系列及 Seedance 2.5 使用。'}</span>
        </span>
      </span>
    </span>
  );
}

export interface LibraryFolderRowProps {
  label: string;
  /** 行对应的**磁盘目录名**（默认 = label；`Others` 行 = 「其他」，即「显示 Others / 实际写 其他」） */
  path?: string;
  expanded?: boolean;
  onToggle?: () => void;
  /** 展开时是否显示官方空态行（library.emptyFolder） */
  showEmpty?: boolean;
  /** 文件夹动作（重命名/删除/新建）完成后刷新 */
  onChanged?: () => void;
  /** 官方缩进：`paddingLeft = H2 + depth*V2`（`V2=28`, `H2=6`，源码 @269274） */
  depth?: number;
  /** 展开时渲染子层（官方 `U2` 递归） */
  children?: React.ReactNode;
}

/** 官方文件夹行 */
export function LibraryFolderRow({ label, path, expanded = false, onToggle, showEmpty = false, onChanged, depth = 0, children }: LibraryFolderRowProps) {
  /** 磁盘目录名（`Others` → 「其他」）；显示仍用 `label` */
  const dir = path ?? label;
  /* 官方 `EX`（@253447）文件夹 `⋯` 菜单：新建文件夹 / 重命名 / 移动到 / 复制到 / ── / 删除
     ⚠️ MTV 素材库是 `{baseDataDir}/file/` 下的**扁平**六个文件夹 ⇒「移动到/复制到」在 MTV 模型里
        没有目标空间 ⇒ 按官方「无处理器即不渲染」的惯例（同 `下载`）省略，见报告 */
  const [menuOpen, setMenuOpen] = useState(false);
  /* 官方 `EX` 的 `⋯` 菜单由 Radix 渲染成 **portal**：`side=bottom align=start sideOffset=4`，
     左边缘对齐 `⋯` 按钮、下沿 +4px，**越出面板右边缘**（9444 实测：菜单 x283.33 y356.67，面板右缘 336）。
     空间不足时 Radix 翻到上方（`side=top`，仍 align=start）⇒ MTV 手工算 `left/top` + 上翻。 */
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  /** 官方 ⋯ 菜单实测高度（6 项 × 32 + 分隔线 1 + my-1 8 + p-2 16 = 217；含边框取整 241 用于上翻判定） */
  const MENU_EST_H = 241;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(label);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const finish = () => { setMenuOpen(false); setRenaming(false); setCreating(false); onChanged?.(); };

  /* 官方 radix 菜单：**点菜单外 / Esc 关闭**（MTV 的 ⋯ 菜单 portal 到 body ⇒ 需要自己接） */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.closest('.lib-menu--portal') || t.closest('.lib-asset-menu-trigger'))) return;
      setMenuOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      if (closeActiveFolderMenu) closeActiveFolderMenu = null;
    };
  }, [menuOpen]);

  return (
    <div className="lib-folder-row-group">
      {/* 官方缩进：`paddingLeft = H2 + depth*V2`（H2=6 / V2=28，@269274）；`pr-1` = 4px */}
      <div className="lib-folder-row" style={{ paddingLeft: 6 + depth * 28 }} onClick={onToggle} role="treeitem" aria-expanded={expanded} tabIndex={0}>
        <button type="button" className="lib-folder-chevron-slot" onClick={(e) => { e.stopPropagation(); onToggle?.(); }}>
          <ChevronRight expanded={expanded} />
        </button>
        <div className="lib-folder-icon-slot">
          <OfficialFolderIcon />
        </div>
        <div className="lib-folder-name-wrap">
          {renaming ? (
            <input
              className="lib-asset-rename"
              value={draft}
              autoFocus
              /* 官方 `Hi`：`initialSelection:"all"` ⇒ 聚焦时**全选**（rAF 里 `focus()` + `select()`） */
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); e.stopPropagation();
                  const next = draft.trim();
                  if (!next || next === label) { finish(); return; }
                  await renameLibraryFolder(dir, next);
                  /* 官方 `renameFolder` 后列表重取 ⇒ 顶部根文件夹行的名字同步（用户文件夹才会出现在固定六个之外） */
                  if (!(LIBRARY_PANEL_FOLDERS as readonly string[]).includes(label)) {
                    useAppStore.getState().renameLibraryRoot(label, next);
                  }
                  finish();
                } else if (e.key === 'Escape') { e.preventDefault(); setDraft(label); setRenaming(false); }
              }}
              /* 官方 `Hi`：**失焦即提交**（值有改动时）；未改则取消 */
              onBlur={async () => {
                if (!renaming) return;
                setRenaming(false);
                const next = draft.trim();
                if (next && next !== label) {
                  await renameLibraryFolder(dir, next);
                  if (!(LIBRARY_PANEL_FOLDERS as readonly string[]).includes(label)) {
                    useAppStore.getState().renameLibraryRoot(label, next);
                  }
                  finish();
                }
              }}
            />
          ) : (
            <span className="lib-folder-name">{label}</span>
          )}
        </div>
        <div className="lib-folder-trailing">
          <button
            type="button"
            className="lib-asset-menu-trigger"
            aria-label="更多"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              if (menuOpen) { closeActiveFolderMenu = null; setMenuOpen(false); return; }
              /* 官方 ⋯ 菜单是 radix `DropdownMenu` ⇒ **同时只会有一个打开**（点别的行的 ⋯ 会自动关掉上一个，
                 点别处/Esc 也会关）⇒ MTV 用模块级登记表关掉上一个（用户实测反馈 4）。 */
              closeActiveFolderMenu?.();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const below = r.bottom + 4;
              const top = below + MENU_EST_H > window.innerHeight - 8
                ? Math.max(8, r.top - 4 - MENU_EST_H)
                : below;
              setMenuPos({ left: r.left, top });
              closeActiveFolderMenu = () => setMenuOpen(false);
              setMenuOpen(true);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="lib-folder-menu-icon">
              <circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" />
            </svg>
          </button>
          {menuOpen && menuPos ? createPortal(
            <div
              className="lib-menu lib-menu--portal"
              role="menu"
              style={{ left: menuPos.left, top: menuPos.top }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className="lib-menu-item" role="menuitem"
                onClick={() => {
                  /* 官方 `EX` 的 `onNewFolder: () => a(y)`（y = 本文件夹 id）⇒ `onCreateChild(id)`：
                     · 输入行渲染在**本文件夹行正下方**（`W2()`：push 本行后立刻 push create 行，depth+1，在 children 之前）
                     · **建在本文件夹内**（`createFolder({name, parentId: 本 id})`）
                     · 自动展开本文件夹（`onCreateChild` 里 `de!==bo && S(de,!0)`） */
                  setCreating(true);
                  setMenuOpen(false);
                  if (!expanded) onToggle?.();
                }}>
                <span className="lib-menu-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                </span>
                {'新建文件夹'}
              </button>
              <button type="button" className="lib-menu-item" role="menuitem"
                onClick={() => { setRenaming(true); setMenuOpen(false); }}>
                <span className="lib-menu-icon"><MenuPencil14Icon /></span>
                {'重命名'}
              </button>
              <button type="button" className="lib-menu-item" role="menuitem"
                onClick={() => { useAppStore.getState().openLibraryFolderPicker({ mode: 'move', folderPath: label }); setMenuOpen(false); }}>
                <span className="lib-menu-icon"><MenuFolderArrow14Icon /></span>
                {'移动到…'}
              </button>
              <button type="button" className="lib-menu-item" role="menuitem"
                onClick={() => { useAppStore.getState().openLibraryFolderPicker({ mode: 'copy', folderPath: label }); setMenuOpen(false); }}>
                <span className="lib-menu-icon"><MenuFolderPlus20Icon /></span>
                {'创建副本'}
              </button>
              {/* 官方 `EX` 第 5 项「下载」（tabler download 16×16）。
                  ⚠️ 官方是把云端文件夹打包下载；MTV 素材库是本地 `{baseDataDir}/file/` 扁平目录，
                     没有对应后端 ⇒ 保留官方按钮与图标（1:1），行为留给后续接入本地导出。 */}
              <button type="button" className="lib-menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                <span className="lib-menu-icon"><MenuDownload16Icon /></span>
                {'下载'}
              </button>
              <div className="lib-menu-sep" />
              <button type="button" className="lib-menu-item lib-menu-item--danger" role="menuitem"
                onClick={() => { setConfirmDelete(true); setMenuOpen(false); }}>
                <span className="lib-menu-icon"><MenuTrash20Icon /></span>
                {'删除'}
              </button>
            </div>,
            document.body,
          ) : null}
        </div>
      </div>
      {/* ★ 官方 `W2()` 的行序：文件夹行 → **新建子文件夹的输入行** → 子层 → 空态行
          （9444 实测 t956：角色 ⋯→新建文件夹 时输入行紧贴角色行下方，场景等被整体下移）
          缩进 = `G2(depth+1)` = 6 + (depth+1)*28 */}
      {creating ? (
        <div className="lib-folder-creating" style={{ paddingLeft: 6 + (depth + 1) * 28 }}>
          <input
            className="lib-asset-rename"
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                e.preventDefault(); e.stopPropagation();
                const name = newName.trim();
                if (!name) { setNewName(''); setCreating(false); return; }
                /* 官方：建在**本文件夹内**（`parentId = 本 id`） */
                await createLibraryFolder(`${dir}/${name}`);
                setNewName('');
                finish();
              } else if (e.key === 'Escape') { e.preventDefault(); setNewName(''); setCreating(false); }
            }}
            /* 官方 `Hi`：**失焦即提交**（有改动时），空值/未改则取消 */
            onBlur={async () => {
              const name = newName.trim();
              setCreating(false);
              if (name) { await createLibraryFolder(`${dir}/${name}`); setNewName(''); finish(); }
            }}
          />
        </div>
      ) : null}
      {/* 子层（官方 `U2` 递归渲染；缩进随 depth 递增） */}
      {expanded && children ? children : null}
      {/* 官方空文件夹行（`DX` @271459，**行序在子层之后**）用 `Aw(depth)` = `H2 + depth*V2 + RX`（RX=34）——
          即「本文件夹」的下一层：`6 + (depth+1)*28 + 34`（depth 0 → 68px，与官方实测一致 ✓） */}
      {expanded && showEmpty ? (
        <div className="lib-folder-empty" style={{ paddingLeft: 6 + (depth + 1) * 28 + 34 }}>{'该文件夹暂无素材'}</div>
      ) : null}
      {confirmDelete ? (
        <PinConfirmDialog
          title="删除文件夹"
          description={`确定要删除「${label}」吗？此操作无法撤销。`}
          confirmLabel="删除"
          cancelLabel="取消"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false);
            await trashLibraryFolder(dir);
            /* 官方删除后后端列表立即少一项 ⇒ 顶端根文件夹行同步移除（固定六个官方分类不动） */
            if (!(LIBRARY_PANEL_FOLDERS as readonly string[]).includes(label)) {
              useAppStore.getState().removeLibraryRoot(label);
            }
            onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

export interface LibraryTopRowsProps {
  /** 官方「主体库」行 → 进入 `data-library-view="element-library"` 视图（官方 `yQ`） */
  onOpenSubjectLibrary?: () => void;
  /** 官方「收藏」行 → 进入 `data-library-view="favorite"` 视图（官方 `vQ`） */
  onOpenFavorite?: () => void;
}

/** 官方顶部固定区：「收藏」行 + 「主体库」行（+ 说明按钮）
 *  ⚠️ 官方「团队」空间**没有「收藏」行**（9444 实测 t822-D）⇒ 由 CSS
 *     `.assets-panel[data-space='team'] .lib-row--favorite { display:none }` 隐藏（不在此处判断空间）。 */
export function LibraryTopRows({ onOpenSubjectLibrary, onOpenFavorite }: LibraryTopRowsProps) {
  return (
    <div className="lib-top-rows">
      <button type="button" className="lib-row lib-row--favorite" onClick={onOpenFavorite}>
        <span className="lib-row-icon-slot"><StarFilled /></span>
        <span className="lib-row-label">收藏</span>
      </button>
      {/* 官方的外层 div 也带 onClick，且**只在点到自身时**触发：
          `onClick={a => { a.target === a.currentTarget && o() }}` */}
      <div
        className="lib-row lib-row--with-action"
        onClick={(e) => { if (e.target === e.currentTarget) onOpenSubjectLibrary?.(); }}
      >
        <button type="button" className="lib-row-main" onClick={onOpenSubjectLibrary}>
          <span className="lib-row-icon-slot lib-row-icon-slot--20">
            <span dangerouslySetInnerHTML={{ __html: subjectLibraryIcon }} />
          </span>
          <span className="lib-row-label">主体库</span>
        </button>
        <button type="button" className="lib-row-help" aria-label="主体库说明">
          <HelpCircle />
          <SubjectLibraryTip />
        </button>
      </div>
    </div>
  );
}
