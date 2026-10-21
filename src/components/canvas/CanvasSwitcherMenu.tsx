/**
 * CanvasSwitcherMenu —— 画布左上角「切换画布 ⌄」的下拉面板（1:1 对齐官方 `.project-menu`）。
 *
 * ★ 结构、类名、图标、动画、键盘全部来自**官方构建产物原文**
 *   （`page-DSy7Zc_d.js` + `page-CBD1_45g.css`，2026 官方重新部署后的 hash）。
 *
 * 官方 popover（`fs` 组件里的 `<Rt forceMount side="bottom" align="start" alignOffset={ce} sideOffset={8}>`）：
 * ```jsx
 * <PopoverContent forceMount side="bottom" align="start" alignOffset={ce} sideOffset={8}
 *   className="canvas-header-motion-popover z-[10001] border-0 bg-transparent p-0 shadow-none
 *              data-[state=closed]:pointer-events-none …"
 *   onEscapeKeyDown={h => { K && (h.preventDefault(), he('')) }}   // K = 搜索词
 *   onCloseAutoFocus={h => { h.preventDefault(); b.current?.focus() }}>
 *   <AnimatePresence>
 *     {open ? <motion.div className="project-menu" data-anchor-offset={ce}
 *                 animate={{opacity:1, scale:1, y:0}}
 *                 initial={reduced ? false : {opacity:0, scale:.98, y:-4}}
 *                 exit={reduced ? {opacity:0} : {opacity:0, scale:.98, y:-4}}
 *                 transition={reduced ? {duration:0} : It}>   // It = spring(damping 38, stiffness 520)
 *       …
 *     </motion.div> : null}
 *   </AnimatePresence>
 * </PopoverContent>
 * ```
 * 清单（`ds` 组件）：
 * ```jsx
 * <div class="project-switcher-panel is-aggressive">
 *   <div class="project-toolbar"><label class="project-search">…<input type="search" placeholder="搜索画布"></label></div>
 *   <div class="project-list" role="tree" onKeyDown={箭头/Home/End/Left/Right} data-testid="canvas-switcher-list">
 *     <div><button class="project-row canvas-row is-selected" role="treeitem" aria-current="page" aria-level=1 tabindex=0>
 *            <span class="project-thumbnail"><img></span><span class="project-copy">名字</span><svg class="project-check"></button></div>
 *     <div class="project-folder is-expanded">
 *       <button class="folder-row" role="treeitem" aria-expanded aria-level=1 tabindex=-1
 *               data-testid="canvas-switcher-collection-row" data-collection-id data-collection-marker="row">
 *         <span class="folder-glyph">folder|folder-open + chevron-right|chevron-down</span>
 *         <span class="folder-label">名字</span>[<span class="folder-count">N</span>]</button>
 *       <AnimatePresence initial={false}>
 *         <motion.div class="folder-children" role="group" aria-label
 *           initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}}
 *           exit={{height:0,opacity:0,transition:rs}} transition={ns}>   // ns .22s / rs .18s
 *           …子行（.project-row.canvas-row.is-nested，aria-level=2）
 *           <div class="folder-children-gap" aria-hidden="true"></div></motion.div>
 *       </AnimatePresence></div>
 *   </div>
 *   <div class="project-menu-footer"><button class="project-create"><svg plus><span>新建画布</span></button></div>
 * </div>
 * ```
 *
 * ★ 官方行模型 `Fe(dt(items), currentId)`：**当前画布排最前，其余按 updatedAt 倒序**，
 *   画布与文件夹（collection）**同一列表混排**；展开的文件夹后面紧跟它的子画布（`level:2`）。
 *
 * ★ 官方键盘（`onKeyDown` on `.project-list`）：↑↓ 上下、Home/End 首尾、
 *   →展开文件夹 / ←收起文件夹、Enter/空格 = 点击；`tabIndex` 是 **roving**
 *   （只有「当前项」是 0，其余 -1，focus 时更新）。
 *
 * ⚠️ 与官方的**有意差异**：官方树是服务端分页（`loadMore`/`loadCollection`/骨架屏），
 *    MTV 的画布与文件夹都在本地（`projects` / `config.collections`）⇒ 一次性渲染，
 *    没有骨架屏与加载更多；`.folder-count` 也没渲染（官方只在服务端给了
 *    `child_canvas_count` 数字时才渲染，而 MTV 的 `WorkspaceCollection` 没有这个字段）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import type { CanvasProject, WorkspaceCollection } from '../../types';

/** 官方占位图：`/assets/empty-project.svg`（80×80 灰底，实测从官方站点取回） */
const EMPTY_PROJECT_SVG = '/assets/empty-project.svg';

/**
 * ⚠️ 必须是**模块级常量**：在选择器里对 `config.collections` 用空数组字面量兜底时，
 * 每次调用都会造一个新数组，而 zustand 的 `useShallow` 只做一层 `Object.is` 比较
 * ⇒ 永远「不相等」⇒ `useSyncExternalStore` 每次 render 都拿到新快照 ⇒ **无限重渲染**
 * （实测报错：`The result of getSnapshot should be cached to avoid an infinite loop`
 *   → `Maximum update depth exceeded`，整页被 `LazyLoadBoundary` 兜住显示「应用加载失败」）。
 * 因为本组件现在是**常驻挂载**（官方 `forceMount` 语义），启动时 `config.collections`
 * 还没读出来，这条路径每次都会走到，所以必崩。
 */
const EMPTY_COLLECTIONS: WorkspaceCollection[] = [];

/* ── 官方常量（`page-DSy7Zc_d.js`：`It` / `ns` / `rs`） ── */
/** 弹层入场/退场：spring(damping 38, stiffness 520) */
const POPOVER_TRANSITION = { type: 'spring' as const, damping: 38, stiffness: 520 };
/** 文件夹展开 `.22s` / 收起 `.18s`，同一条 cubic-bezier */
const FOLDER_EXPAND_TRANSITION = { duration: 0.22, ease: [0.215, 0.61, 0.355, 1] as const };
const FOLDER_COLLAPSE_TRANSITION = { duration: 0.18, ease: [0.215, 0.61, 0.355, 1] as const };

/** 官方 tabler 图标（path 逐字取自活的官方 DOM 实测） */
const ICONS = {
  folderOpen: 'M5 19l2.757 -7.351a1 1 0 0 1 .936 -.649h12.307a1 1 0 0 1 .986 1.164l-.996 5.211a2 2 0 0 1 -1.964 1.625h-14.026a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v2',
  folder: 'M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2',
  chevronDown: 'M6 9l6 6l6 -6',
  chevronRight: 'M9 6l6 6l-6 6',
  check: 'M5 12l5 5l10 -10',
  search: 'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
  searchStem: 'M21 21l-6 -6',
  plus: 'M12 5l0 14',
  plusStem: 'M5 12l14 0',
} as const;

/** 官方 `.folder-glyph` 里的两颗图标：`folder-glyph-rest`（默认）+ `folder-glyph-hover`（hover/focus 时浮现） */
function FolderGlyph({ expanded }: { expanded: boolean }) {
  return (
    <span className="folder-glyph" aria-hidden="true">
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"
        className={`tabler-icon ${expanded ? 'tabler-icon-folder-open' : 'tabler-icon-folder'} folder-glyph-rest`}
      >
        <path d={expanded ? ICONS.folderOpen : ICONS.folder} />
      </svg>
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
        className={`tabler-icon ${expanded ? 'tabler-icon-chevron-down' : 'tabler-icon-chevron-right'} folder-glyph-hover`}
      >
        <path d={expanded ? ICONS.chevronDown : ICONS.chevronRight} />
      </svg>
    </span>
  );
}

type TreeRow =
  | { kind: 'canvas'; canvas: CanvasProject; level: 1 | 2 }
  | { kind: 'collection'; collection: WorkspaceCollection };

export interface CanvasSwitcherMenuProps {
  /** 官方 popover 是 `forceMount`：**常驻挂载**，用 `open` 控制内容与 `data-state` */
  open: boolean;
  onClose: () => void;
  /** 官方 `onCloseAutoFocus` 把焦点还给触发按钮 */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  /**
   * 官方 `data-anchor-offset={ce}`：**菜单左边缘相对触发按钮左边缘的偏移**
   * （实测官方 = -179 = 药丸左 16 − 箭头左 195 ⇒ 菜单对齐的是**药丸**而不是箭头）。
   * ⚠️ 由 `Header` 在**点击时**量好传进来：render 里读 ref 会被 `react-hooks/refs` 拦。
   */
  anchorOffset?: number;
}

export default function CanvasSwitcherMenu({ open, onClose, triggerRef, anchorOffset }: CanvasSwitcherMenuProps) {
  const t = useT();
  const reduceMotion = useReducedMotion() ?? false;
  const [query, setQuery] = useState('');
  /** 展开的文件夹 id（官方 `expandedCollectionIds`，MTV 本地状态即可） */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { projects, collections, currentProjectId, switchProject, createProject, isCreatingProject } = useAppStore(
    useShallow((s) => ({
      projects: s.projects,
      collections: s.config.collections ?? EMPTY_COLLECTIONS,
      currentProjectId: s.currentProjectId,
      switchProject: s.switchProject,
      createProject: s.createProject,
      isCreatingProject: s.isCreatingProject,
    })),
  );

  const keyword = query.trim().toLowerCase();

  /* 官方 `Fe()`：当前画布排最前，其余按 updatedAt 倒序（本地等价物）。 */
  const sortCanvases = useCallback((list: CanvasProject[]) => (
    [...list].sort((a, b) => {
      if (a.id === currentProjectId) return -1;
      if (b.id === currentProjectId) return 1;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    })
  ), [currentProjectId]);

  /**
   * 官方行模型（`n.push({kind:"collection"|"canvas", level, parentId})`）：
   * 顶层画布 = 不属于任何文件夹的；文件夹后面紧跟它已展开的子画布（`level:2`）。
   * 搜索时官方走另一条分支（只保留命中的），这里等价处理：命中文件夹名 → 展开全部子画布；
   * 只有子画布命中 → 只列出命中的子画布。
   */
  const rows = useMemo<TreeRow[]>(() => {
    const visible = projects.filter((project) => project.id !== 'default');
    const byCollection = new Map<string, CanvasProject[]>();
    const roots: CanvasProject[] = [];
    for (const project of visible) {
      if (project.collectionId) {
        const bucket = byCollection.get(project.collectionId);
        if (bucket) bucket.push(project);
        else byCollection.set(project.collectionId, [project]);
      } else {
        roots.push(project);
      }
    }
    for (const [id, bucket] of byCollection) byCollection.set(id, sortCanvases(bucket));

    const matches = (name: string) => name.toLowerCase().includes(keyword);

    /* 官方顶层顺序 = `Fe(dt(items), currentId)`：当前画布最前，其余按 updatedAt 倒序，
       而且画布与文件夹在**同一个列表里混排**（不是「画布全部在前、文件夹垫底」）。 */
    const topLevel = [
      ...roots.map((canvas) => ({ kind: 'canvas' as const, id: canvas.id, updatedAt: canvas.updatedAt ?? 0, canvas })),
      ...collections.map((collection) => ({ kind: 'collection' as const, id: collection.id, updatedAt: collection.updatedAt ?? 0, collection })),
    ].sort((a, b) => {
      const aCurrent = a.kind === 'canvas' && a.canvas.id === currentProjectId;
      const bCurrent = b.kind === 'canvas' && b.canvas.id === currentProjectId;
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

    const out: TreeRow[] = [];
    if (!keyword) {
      for (const item of topLevel) {
        if (item.kind === 'canvas') {
          out.push({ kind: 'canvas', canvas: item.canvas, level: 1 });
          continue;
        }
        out.push({ kind: 'collection', collection: item.collection });
        if (!expandedIds.has(item.id)) continue;
        for (const canvas of byCollection.get(item.id) ?? []) out.push({ kind: 'canvas', canvas, level: 2 });
      }
      return out;
    }

    for (const item of topLevel) {
      if (item.kind === 'canvas') {
        if (matches(item.canvas.name)) out.push({ kind: 'canvas', canvas: item.canvas, level: 1 });
        continue;
      }
      const children = byCollection.get(item.id) ?? [];
      const folderHit = matches(item.collection.name);
      const hits = children.filter((canvas) => matches(canvas.name));
      if (!folderHit && hits.length === 0) continue;
      out.push({ kind: 'collection', collection: item.collection });
      /* 搜索态官方按 `expandedCollectionIds` 决定展开；命中文件夹名时等价于“全部展开” */
      const show = folderHit && hits.length === 0 ? children : hits;
      for (const canvas of show) out.push({ kind: 'canvas', canvas, level: 2 });
    }
    return out;
  }, [collections, currentProjectId, expandedIds, keyword, projects, sortCanvases]);

  /* 官方 key 是每一行的 `canvas-<id>` / `collection-<id>` */
  const rowKey = useCallback((row: TreeRow) => (
    row.kind === 'canvas' ? `canvas-${row.canvas.id}` : `collection-${row.collection.id}`
  ), []);

  const toggleCollection = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* roving tabindex（官方 `E`）：只有「当前项」是 0，focus 时更新。
     ⚠️ 不用 effect 同步（会触发 `react-hooks/set-state-in-effect`）：焦点索引为 null 时
     自然回落到「当前画布所在行」，行数/当前画布一变就自动跟着走 ✓ */
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const currentIndex = useMemo(() => {
    const index = rows.findIndex((row) => row.kind === 'canvas' && row.canvas.id === currentProjectId);
    return index < 0 ? 0 : index;
  }, [currentProjectId, rows]);
  const activeIndex = focusIndex === null ? currentIndex : focusIndex;

  /* 点外面 / Esc 关闭（官方 Radix 行为）。
     ⚠️ 搜索框有内容时，Esc 先**清空搜索词**（官方 `onEscapeKeyDown`：`K && (preventDefault, he(''))`），
        再按才关面板。 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (query) {
        e.preventDefault();
        setQuery('');
        return;
      }
      onClose();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest('button[aria-label="切换画布"], .title-menu-trigger')) return;
      if (rootRef.current && !rootRef.current.contains(target)) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown, true);
    };
  }, [onClose, open, query]);

  /* 官方 `onCloseAutoFocus`：关闭后焦点回到触发按钮 */
  useEffect(() => {
    if (open) return;
    const trigger = triggerRef?.current;
    if (!trigger || !rootRef.current) return;
    /* 只有「本来焦点在菜单里」时才把焦点要回来，避免抢走用户别处的焦点 */
    if (rootRef.current.contains(document.activeElement)) trigger.focus();
  }, [open, triggerRef]);

  /* 官方 `.project-list` 的键盘导航：↑↓ / Home / End / ←→（文件夹）/ Enter·空格 由 button 原生触发 */
  const onListKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;
    const rowsInDom = [...list.querySelectorAll<HTMLElement>('[role="treeitem"]')];
    const index = rowsInDom.findIndex((node) => node === document.activeElement);
    if (index < 0) return;
    const focusAt = (next: number) => {
      event.preventDefault();
      rowsInDom[Math.max(0, Math.min(rowsInDom.length - 1, next))]?.focus();
    };
    const row = rowsInDom[index];
    const collectionId = row.dataset.collectionId;
    if (event.key === 'ArrowDown') focusAt(index + 1);
    else if (event.key === 'ArrowUp') focusAt(index - 1);
    else if (event.key === 'Home') focusAt(0);
    else if (event.key === 'End') focusAt(rowsInDom.length - 1);
    else if (collectionId && event.key === 'ArrowRight' && !expandedIds.has(collectionId)) {
      event.preventDefault();
      toggleCollection(collectionId);
    } else if (collectionId && event.key === 'ArrowLeft' && expandedIds.has(collectionId)) {
      event.preventDefault();
      toggleCollection(collectionId);
    }
  }, [expandedIds, toggleCollection]);

  const handleSwitch = (id: string) => {
    if (id !== currentProjectId) switchProject(id);
    onClose();
  };

  const handleCreate = () => {
    if (isCreatingProject) return;
    void createProject().then(() => onClose());
  };

  const renderCanvasRow = (canvas: CanvasProject, level: 1 | 2, index: number): ReactNode => {
    const isCurrent = canvas.id === currentProjectId;
    const isPlaceholder = !canvas.snapshot;
    return (
      <button
        key={`canvas-${canvas.id}`}
        type="button"
        id={`canvas-switcher-option-${canvas.id}`}
        data-testid="canvas-switcher-row"
        role="treeitem"
        aria-current={isCurrent ? 'page' : undefined}
        aria-level={level}
        tabIndex={index === activeIndex ? 0 : -1}
        className={`project-row canvas-row ${level === 2 ? 'is-nested' : ''} ${isCurrent ? 'is-selected' : ''}`}
        onFocus={() => setFocusIndex(index)}
        onClick={() => handleSwitch(canvas.id)}
      >
        <span
          className={`project-thumbnail${isPlaceholder ? ' is-placeholder' : ''}`}
          data-testid={isPlaceholder ? 'canvas-thumbnail-fallback' : undefined}
          aria-hidden="true"
        >
          <img alt="" src={canvas.snapshot || EMPTY_PROJECT_SVG} draggable={false} />
        </span>
        <span className="project-copy">{canvas.name}</span>
        {isCurrent && (
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-check project-check"
            data-testid="canvas-switcher-selected" aria-hidden="true"
          >
            <path d={ICONS.check} />
          </svg>
        )}
      </button>
    );
  };

  const folderChildren = (collectionId: string, label: string): ReactNode => {
    const children = rows.filter((row) => row.kind === 'canvas' && row.level === 2 && row.canvas.collectionId === collectionId);
    return (
      <AnimatePresence initial={false}>
        {expandedIds.has(collectionId) || keyword ? (
          <motion.div
            key={`${collectionId}-children`}
            className="folder-children"
            role="group"
            aria-label={label}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0, transition: FOLDER_COLLAPSE_TRANSITION }}
            transition={reduceMotion ? { duration: 0 } : FOLDER_EXPAND_TRANSITION}
          >
            {children.map((row) => (
              row.kind === 'canvas'
                ? renderCanvasRow(row.canvas, 2, rows.indexOf(row))
                : null
            ))}
            {/* 官方空文件夹就是「只有一条 gap」（实测活 DOM：`folder-children` 里只有一个 `folder-children-gap`），
                不额外造文案 */}
            <div aria-hidden="true" className="folder-children-gap" />
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  };

  return (
    <div
      className="canvas-nav-menu-anchor"
      ref={rootRef}
      /* 官方 Radix 外层属性：forceMount ⇒ 常驻，靠 data-state 表达开关 */
      data-state={open ? 'open' : 'closed'}
      data-side="bottom"
      data-align="start"
      role="dialog"
      tabIndex={-1}
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            key="project-menu"
            className="project-menu"
            data-anchor-offset={anchorOffset}
            data-testid="canvas-header-switcher-popover"
            aria-label={t('切换画布')}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: -4 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -4 }}
            transition={reduceMotion ? { duration: 0 } : POPOVER_TRANSITION}
          >
            <div className="project-switcher-panel is-aggressive" data-testid="canvas-switcher-panel">
              <div className="project-toolbar">
                <label className="project-search" data-testid="canvas-switcher-search-shell">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-search" aria-hidden="true">
                    <path d={ICONS.search} />
                    <path d={ICONS.searchStem} />
                  </svg>
                  {/* ⚠️ 官方**不**自动聚焦搜索框：实测打开后 `document.activeElement` 仍是
                      `[data-testid="canvas-header-switcher-trigger"]`（Radix 默认聚焦容器，
                      而官方连容器都不聚焦）⇒ 这里**不能**加 `autoFocus`，否则与官方不一致。 */}
                  <input
                    type="search"
                    placeholder={t('搜索画布')}
                    data-testid="canvas-switcher-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              </div>

              {/* ⚠️ `data-overlay-scrollbar="off"`：关掉 MTV 自绘的 overlay 滚动条
                  （`--scrollbar-thumb:#3a3a50` 发蓝紫），改用官方那套原生细滚动条
                  （`.project-list{scrollbar-width:thin;scrollbar-color:#404040 transparent}`）。 */}
              <div
                className="project-list"
                role="tree"
                aria-label={t('搜索画布')}
                data-testid="canvas-switcher-list"
                data-overlay-scrollbar="off"
                ref={listRef}
                onKeyDown={onListKeyDown}
              >
                {rows.length === 0 && (
                  /* 官方空态就是**放大镜**图标 + `canvas.headerSwitcher.empty`（zh 实测「未找到相关画布」） */
                  <div className="project-empty">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={ICONS.search} />
                      <path d={ICONS.searchStem} />
                    </svg>
                    <span>{t('未找到相关画布')}</span>
                  </div>
                )}

                {rows.map((row, index) => {
                  if (row.kind === 'canvas') {
                    /* 官方：顶层行外包一层无 class 的 `<div>`；子行**不包**（直接是 `.folder-children` 的孩子） */
                    return row.level === 1 ? <div key={rowKey(row)}>{renderCanvasRow(row.canvas, 1, index)}</div> : null;
                  }
                  const collection = row.collection;
                  const expanded = expandedIds.has(collection.id) || Boolean(keyword);
                  return (
                    <div key={rowKey(row)} className={`project-folder ${expanded ? 'is-expanded' : ''}`}>
                      <button
                        type="button"
                        role="treeitem"
                        aria-expanded={expanded}
                        aria-level={1}
                        tabIndex={index === activeIndex ? 0 : -1}
                        data-testid="canvas-switcher-collection-row"
                        data-collection-id={collection.id}
                        data-collection-marker="row"
                        className="folder-row"
                        onFocus={() => setFocusIndex(index)}
                        onClick={() => toggleCollection(collection.id)}
                      >
                        <FolderGlyph expanded={expanded} />
                        <span className="folder-label">{collection.name}</span>
                        {/* 官方 `<span class="folder-count">` 只在服务端给了 `child_canvas_count`（数字）时渲染；
                            MTV 的 `WorkspaceCollection` 没有这个字段 ⇒ 与官方实测（那几个文件夹都没有数字）一致，不渲染。
                            CSS 已备好，真拿到数字时直接放上来即可。 */}
                      </button>
                      {/* 子行由上面 `rows` 里的 level-2 项负责渲染，这里按文件夹分组取出 */}
                      {folderChildren(collection.id, collection.name)}
                    </div>
                  );
                })}
              </div>

              <div className="project-menu-footer" data-testid="canvas-switcher-footer">
                <button type="button" className="project-create" disabled={isCreatingProject} onClick={handleCreate}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                    strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-plus" aria-hidden="true">
                    <path d={ICONS.plus} />
                    <path d={ICONS.plusStem} />
                  </svg>
                  <span>{isCreatingProject ? t('正在新建画布') : t('新建画布')}</span>
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
