/**
 * SaveToLibraryDialog —— 官方「保存到素材库」对话框（选择文件夹）
 *
 * 官方源码（`page-DPdEgTS0.js` @263193 `z2` 组件，逐字）：
 * ```jsx
 * <DialogContent showClose={false}
 *   className="z-[70] w-[360px] gap-0 rounded-2xl border border-white/10 bg-[rgba(38,38,38,0.95)] p-0 shadow-xl backdrop-blur-xl"
 *   style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
 *   <div className="flex items-center justify-between px-5 pt-5 pb-3">
 *     <div className="flex items-center gap-2">
 *       <FolderIcon size={18} className="text-white/90"/>
 *       <span className="truncate text-base font-semibold leading-6 text-white/90">{title || t('library.selectFolder')}</span>
 *     </div>
 *     <button className="flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-sm font-medium leading-5
 *                        text-white/60 transition-colors hover:bg-white/10 hover:text-white/90">
 *       <Plus size={14}/>{t('library.newFolder')}</button>
 *   </div>
 *   {allowSpaceSwitch && <div className="px-5 pb-2"><SpaceTabs/></div>}
 *   <div className="h-[320px] overflow-auto px-5 [scrollbar-width:thin]">
 *     <div className="min-w-max space-y-0.5 py-1">…文件夹行…</div>
 *   </div>
 *   <div className="flex items-center justify-end gap-2 px-5 py-4">
 *     <Button className="rounded-sm border-[0.5px] border-black/[0.12] bg-white/10 px-3 py-1.5
 *                        text-[14px] font-medium leading-[20px] text-white/90">取消</Button>
 *     <Button className="rounded-sm border-0 bg-white px-3 py-1.5 text-sm font-medium leading-5
 *                        text-black hover:bg-white/90 disabled:opacity-50">保存</Button>
 *   </div>
 * </DialogContent>
 * ```
 * ★ 「个人 / 团队」分段（`allowSpaceSwitch`）**MTV 已删**（用户 2026 决策）：
 *   官方两段各对一套云端空间（`library.private` / `library.team`），MTV 只有本地目录、无团队后端，
 *   原来那段只 `setSpace` 改 state、不影响列表 = 纯装饰件 ⇒ 按「不做假控件」删除。
 *   官方那套分段控件（`fT` = `jme`）的逐字类名与展开值留档在 `styles/panels.css` 原位置。
 *
 * ★ 实测（官方 9444）：对话框 **居中**（2560 视窗 → left 1100 = (2560-360)/2）、列表区 **359×320** ✓
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { libraryRootOrder, libraryFolderDir } from '../assets/libraryFolderPaths';
import { OfficialFolderIcon } from '../assets/LibraryFolderRows';
import { listLibraryFolderContents, isDisallowedMoveTarget, createLibraryFolder, renameLibraryFolder, trashLibraryFolder } from '../../services/assetRowActions';
import { useAppStore } from '../../store/useAppStore';
import PinConfirmDialog from './PinConfirmDialog';

export interface SaveToLibraryDialogProps {
  visible: boolean;
  /**
   * `mode==='save'` 时要保存的节点集合：官方右键是单节点、官方**多选工具栏**是「整个选择」
   * 一起进 `openForSelection`（`page-DPdEgTS0.js`@char1430453 区域）。
   * 对话框自身只负责「选文件夹」，落盘由调用方 `onConfirm(folder)` 做 ⇒ 这里只透传。
   */
  nodeIds?: string[];
  /** 官方 `z2` 的档位：save=保存到素材库 / move=移动到 / copy=创建副本 / upload=选择文件夹（官方「添加→上传」第一步） */
  mode?: 'save' | 'move' | 'copy' | 'upload';
  /** 文件夹级移动时的源相对路径 ⇒ 禁用「它自己 / 它的子孙」作为目标（官方 disallowedFolderIds） */
  sourceFolder?: string;
  onClose: () => void;
  onConfirm: (folder: string) => void;
}

export function SaveToLibraryDialog({ visible, onClose, onConfirm, mode = 'save', sourceFolder }: SaveToLibraryDialogProps) {
  const [folder, setFolder] = useState<string | null>(null);
  /* 官方 `allowSpaceSwitch` 的「个人 / 团队」分段（用户 2026-09-26 要求加回） */
  const [space, setSpace] = useState<'private' | 'team'>('private');
  /* 用户新建的根文件夹（store 共享：面板与选择器一致）+ 磁盘上真实存在的根文件夹 */
  const extraRoots = useAppStore((s) => s.libraryExtraRoots);
  const diskRoots = useAppStore((s) => s.libraryDiskRoots);
  useEffect(() => {
    if (!visible) return;
    void (async () => {
      try {
        const c = await listLibraryFolderContents('');
        useAppStore.getState().setLibraryDiskRoots(c.folders);
      } catch { /* 忽略 */ }
    })();
  }, [visible]);
  /* ★ 官方是 radix Dialog ⇒ **只有**「点遮罩」与「Esc」会关（内容区内部的任何点击都不关）。
     MTV 原来是画布侧一个全局 `mousedown` 捕获监听在关（还引用了没绑上的 ref）
     ⇒ **任何真实鼠标按下都会关掉对话框**，里面完全点不动（用户实测反馈 1/5）。 */
  useEffect(() => {
    /* ★★ 必须按 `visible` 门控（官方是 radix `Dialog` ⇒ Esc 行为**只在打开期间存在**）。
       ⚠️ 之前这里没门控（deps 只有 `[onClose]`）⇒ 这条监听**永远挂在 document 上**，
          而且对**每一次** Escape 都 `stopPropagation()`（还是 capture 相位）⇒
          事件在**冒泡相位之前**就被吃掉，任何挂在 `window` 冒泡上的 Esc 处理器（例如
          堆叠全屏画廊 `PileGallery` 的 `me`）**永远收不到** ⇒
          用户实测「堆叠进入全屏后 Esc 无法退出」（真因就在这里，不是画廊本身）。
          这里补上 `visible` 门控，并**只在对话框真的开着时**才吃掉 Esc。 */
    if (!visible) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, visible]);
  /* 官方选择器里的文件夹树（`U2`）：子层按需加载，缩进 `depth*IX`（IX=36，@269274） */
  const [subs, setSubs] = useState<Record<string, string[]>>({});
  /* 官方选择器行内 `⋯`（`jX`）/ 就地重命名 / 新建子层 / 删除确认 */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  /** ⋯ 菜单的 portal 定位（官方 radix `align=start side=bottom` ⇒ 左边缘对齐 ⋯、下沿 +4，空间不够翻上） */
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  /* 该菜单 3 项 × 32 + 分隔线 1 + p-2 上下 16 ≈ 113；取 121 用于上翻判定 */
  const MENU_EST_H = 121;
  /* 官方 radix：点菜单外 / Esc 关闭（portal 到 body ⇒ MTV 自己接） */
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.closest('.lib-menu--dialog') || t.closest('.lib-picker-menu-btn'))) return;
      setMenuFor(null);
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setMenuFor(null); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [menuFor]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [creatingUnder, setCreatingUnder] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const loadSubs = async (path: string) => {
    const contents = await listLibraryFolderContents(path);
    setSubs((prev) => ({ ...prev, [path]: contents.folders }));
  };
  const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
  const renderTarget = (path: string, label: string, depth: number): React.ReactNode => {
    const kids = subs[path];
    const expanded = Array.isArray(kids);
    /* 官方 `U2`：`disallowed && 'cursor-not-allowed opacity-40'`，且点击直接 return 不选中 */
    const disallowed = !!sourceFolder && mode === 'move' && isDisallowedMoveTarget(sourceFolder, path);
    /* 官方缩进是**占位 div** `style={{width: depth*IX}}`（IX = kw+$b = 28+8 = 36），不是 padding */
    const indent = depth * 36;
    return (
      <div key={path} className="lib-picker-node">
        <div className="lib-picker-row-wrap">
          <div className="lib-picker-indent" style={{ width: indent }} aria-hidden="true" />
          <div
            className={`lib-picker-row${folder === path ? ' is-selected' : ''}${disallowed ? ' is-disallowed' : ''}`}
            onClick={() => { if (!disallowed) setFolder(path); }}
            role="option"
            aria-selected={folder === path}
            aria-disabled={disallowed || undefined}
          >
            {/* 官方 chevron 槽 `flex h-5 w-7`，图标 16：展开 `rotate-90 text-white/90`，收起 `text-white/40` */}
            <button
              type="button"
              className="lib-picker-chevron"
              onClick={(e) => {
                e.stopPropagation();
                if (expanded) setSubs((prev) => { const next = { ...prev }; delete next[path]; return next; });
                else void loadSubs(path);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                className="lib-picker-chevron-icon"
                style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', color: expanded ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
                <path d="M9 6l6 6l-6 6" />
              </svg>
            </button>
            <div className="lib-folder-icon-slot"><OfficialFolderIcon /></div>
            {renaming === path ? (
              <input
                className="lib-asset-rename"
                value={draft}
                autoFocus
                /* 官方 `Hi`：`initialSelection:"all"` ⇒ 聚焦时全选 */
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); e.stopPropagation();
                    const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
                    await renameLibraryFolder(path, parent ? `${parent}/${draft}` : draft);
                    setRenaming(null);
                    await loadSubs(parent);
                  } else if (e.key === 'Escape') { e.preventDefault(); setRenaming(null); }
                }}
                onBlur={() => setRenaming(null)}
              />
            ) : (
              <span className="lib-picker-name">{label}</span>
            )}
            {/* ★ 官方 `U2`：`{!renaming && !disallowed && <div className="shrink-0"><jX folderName onNewFolder onRename onDelete/></div>}`
                触发器 `size-7 rounded-full opacity-0 group-hover/picker-folder:opacity-100`，dots 14 `text-white/40` */}
            {!disallowed && renaming !== path ? (
              <div className="lib-picker-trailing">
                <button
                  type="button"
                  className="lib-picker-menu-btn"
                  aria-label="更多"
                  aria-expanded={menuFor === path}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (menuFor === path) { setMenuFor(null); return; }
                    /* ★ 官方 `jX` 是 radix `DropdownMenuContent`：**portal 到 body**、`align="start" side="bottom"`、
                       `z-[80] w-[240px] rounded-2xl bg-[#2F2F2F] p-2 px-1`（不被对话框 overflow 裁剪）
                       ⇒ MTV 原来就地渲染（贴行左、被后续行盖住/裁掉）= 用户反馈「位置不对」 */
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const below = r.bottom + 4;
                    const top = below + MENU_EST_H > window.innerHeight - 8
                      ? Math.max(8, r.top - 4 - MENU_EST_H)
                      : below;
                    setMenuPos({ left: r.left, top });
                    setMenuFor(path);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
                  </svg>
                </button>
                {menuFor === path && menuPos ? createPortal(
                  <div
                    className="lib-menu lib-menu--portal lib-menu--dialog"
                    role="menu"
                    style={{ left: menuPos.left, top: menuPos.top, zIndex: 80 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button type="button" className="lib-menu-item" role="menuitem"
                      onClick={() => { setCreatingUnder(path); setMenuFor(null); }}>
                      <span className="lib-menu-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                      </span>
                      {'新建文件夹'}
                    </button>
                    <button type="button" className="lib-menu-item" role="menuitem"
                      onClick={() => { setDraft(label); setRenaming(path); setMenuFor(null); }}>
                      <span className="lib-menu-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
                          <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415" />
                        </svg>
                      </span>
                      {'重命名'}
                    </button>
                    <div className="lib-menu-sep" />
                    <button type="button" className="lib-menu-item lib-menu-item--danger" role="menuitem"
                      onClick={() => { setConfirmDelete(path); setMenuFor(null); }}>
                      <span className="lib-menu-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" />
                          <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                          <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                        </svg>
                      </span>
                      {'删除'}
                    </button>
                  </div>,
                  document.body,
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {expanded ? (
          <div className="lib-picker-children">
            {/* 官方：展开时一条**垂直引导线** `absolute top-0 bottom-0 w-px bg-white/[0.08]`，`left = depth*IX + kw/2` */}
            <span className="lib-picker-guide" style={{ left: indent + 14 }} aria-hidden="true" />
            {/* 官方 `U2`：新建子文件夹的就地输入，缩进 `depth*IX + Ox`（Ox = kw+$b+kX+$b = 72） */}
            {creatingUnder === path ? (
              <div className="lib-picker-create" style={{ paddingLeft: depth * 36 + 72 }}>
                <input
                  className="lib-asset-rename"
                  value={newName}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault(); e.stopPropagation();
                      await createLibraryFolder(newName ? `${path}/${newName}` : path);
                      setNewName(''); setCreatingUnder(null);
                      await loadSubs(path);
                    } else if (e.key === 'Escape') { e.preventDefault(); setNewName(''); setCreatingUnder(null); }
                  }}
                  onBlur={() => setCreatingUnder(null)}
                />
              </div>
            ) : null}
            {(kids as string[]).map((kid) => renderTarget(`${path}/${kid}`, kid, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };
  if (!visible) return null;

  return createPortal(
    <div
      className="lib-dialog-backdrop"
      /* 官方 `DialogOverlay` 自带 `data-testid="common-dialog-container"`（规格 §4 逐字）⇒ 照抄 */
      data-testid="common-dialog-container"
      onClick={onClose}
    >
      <div className="lib-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {/* 头部：18×18 文件夹图标 + 16/600/24 标题 + 「新建文件夹」 */}
        <div className="lib-dialog-header">
          <div className="lib-dialog-title-wrap">
            {/* ★ 官方 `z2` 头部图标 = `Vu`（tabler **folder 线框**，size 18，`text-white/90`）——
                不是行内那套填充文件夹图标（用户实测反馈「选择文件夹前的图标不对」） */}
            <span className="lib-dialog-title-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" />
              </svg>
            </span>
            <span className="lib-dialog-title">{mode === 'save' ? '保存到素材库' : mode === 'upload' ? '选择文件夹' : mode === 'move' ? '移动到' : '创建副本'}</span>
          </div>
          <button
            type="button"
            className="lib-dialog-newfolder"
            /* ★ 官方 `z2` 源码：头部「新建文件夹」= `onClick: () => S(bo)`，`bo` 是**根** folder id ⇒
               输入行出现在**列表最上方（根层）**，`parentId: bo` 建在根。
               ⚠️ `onMouseDown: preventDefault` = 别让按钮抢走 `autoFocus` 输入框的焦点
                  （否则输入框刚渲染就 `onBlur` ⇒ 行立刻消失）。 */
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setCreatingUnder(''); setNewName(''); }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5l0 14" /><path d="M5 12l14 0" />
            </svg>
            {'新建文件夹'}
          </button>
        </div>

        {/* ══ 「个人 / 团队」分段 ══
            官方由 `allowSpaceSwitch` 控制（`page-DPdEgTS0.js`@char1430453 逐字
            `r.jsx(z2,{open:t,onOpenChange:n,title:…,confirmLabel:…,allowSpaceSwitch:!0,onConfirm:s})`），
            两段对两套**云端空间**（`library.private` / `library.team`）。
            ⚠️ 历史：2026 曾按「不做假控件」删除（MTV 无团队后端、原实现只 `setSpace` 改 state
               不影响列表）。**用户 2026-09-26 明确要求加回** ⇒ 按官方形态恢复。
            官方 9444 实测（规格 §4 逐字）：
              外 `relative grid auto-cols-fr grid-flow-col items-center gap-1 rounded-xl
                  bg-white/10 p-1 w-full` + 内联 `border: 1px solid rgba(255,255,255,0.08)`
                  ⇒ 319×37 · r16 · pad4
              项 `relative z-10 flex h-7 w-full min-w-0 items-center justify-center rounded-lg
                  p-0 text-xs font-medium leading-none`
                  · 选中 `bg-white/[0.12]` + `blur(28px)`、文字 `rgba(255,255,255,0.88)`
                  · 未选 文字 `rgba(255,255,255,0.60)`，hover `bg-white/5`
            ⇒ CSS 见 `panels.css` 的 `.lib-dialog-space-row` / `.lib-space-tabs` / `.lib-space-tab*`。 */}
        <div className="lib-dialog-space-row">
          <div className="lib-space-tabs" role="tablist" aria-label="素材库空间">
            {([['private', '个人'], ['team', '团队']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={space === value}
                className={`lib-space-tab${space === value ? ' is-active' : ''}`}
                onClick={() => setSpace(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 文件夹列表（官方固定高 h-[320px]，内部为**文件夹树** `U2`：缩进 `depth*IX`，`IX=36`）*/}
        <div className="lib-dialog-list">
          <div className="lib-dialog-list-inner">
            {/* ★ 官方：根层新建（`v === bo`）⇒ `<div className="px-2"><Hi onConfirm…/></div>` 排在**所有文件夹之前** */}
            {creatingUnder === '' ? (
              <div className="lib-picker-create-root">
                <input
                  className="lib-create-input"
                  value={newName}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault(); e.stopPropagation();
                      const name = newName.trim();
                      if (!name) { setCreatingUnder(null); return; }
                      await createLibraryFolder(name);
                      useAppStore.getState().addLibraryRoot(name);
                      setNewName(''); setCreatingUnder(null);
                    } else if (e.key === 'Escape') { e.preventDefault(); setNewName(''); setCreatingUnder(null); }
                  }}
                  onBlur={() => setCreatingUnder(null)}
                />
              </div>
            ) : null}
            {/* ★ 根文件夹顺序（9444 实测 t956）：角色 → 用户新建的根文件夹（按创建顺序）→ 场景/道具/风格/音效/Others */}
            {libraryRootOrder([...extraRoots, ...diskRoots]).map((name) => renderTarget(libraryFolderDir(name), name, 0))}
          </div>
        </div>

        {/* 底部：取消 / 保存 */}
        <div className="lib-dialog-footer">
          <button type="button" className="lib-dialog-btn lib-dialog-btn--ghost" onClick={onClose}>{'取消'}</button>
          <button
            type="button"
            className="lib-dialog-btn lib-dialog-btn--primary"
            disabled={!folder}
            onClick={() => { if (folder) onConfirm(folder); }}
          >
            {mode === 'save' ? '保存' : '确认'}
          </button>
        </div>
      </div>
      {/* 删除确认（与面板/走查一致：官方文案 `assets.deleteConfirmTitle/Desc`） */}
      {confirmDelete ? (
        <PinConfirmDialog
          title="删除文件夹"
          description={`确定要删除「${confirmDelete.split('/').pop()}」吗？此操作无法撤销。`}
          confirmLabel="删除"
          cancelLabel="取消"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const p = confirmDelete;
            setConfirmDelete(null);
            if (!p) return;
            await trashLibraryFolder(p);
            await loadSubs(parentOf(p));
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}

export default SaveToLibraryDialog;
