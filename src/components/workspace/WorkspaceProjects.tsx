/**
 * WorkspaceProjects —— 官方工作空间「我的项目」页（1:1，9444 实测）
 * ══════════════════════════════════════════════════════════════════════════
 * 官方路由：`tapnow://app/canvas/projects`；外层
 *   `section.w-full h-full container mx-auto flex flex-col overflow-hidden max-w-[1500px]`（实测 [530,84,1500,1260] 居中）
 *
 * 工具行 `div.flex flex-col md:flex-row items-start gap-y-2 pb-2 justify-between px-8`（[530,84,1500,50]，padding `0 32px 8px`）：
 *   左 `ul.flex gap-2 text-lg text-muted-foreground`（18px · gap 8 · #7A7A7A）；
 *      `li` 选中 `text-foreground border-b-2 !border-foreground cursor-pointer mx-3 py-1.5 rounded-t-md`
 *      （36×42 · 18px/400 · #F5F5F5 · 下边框 2px · `radius 10px 10px 0 0` · `padding 6px 0` · `margin 0 12px`）
 *      ★ 官方只有 **个人 / 团队项目** 两项
 *   右 `div.relative flex items-center gap-x-2`（[1465,84,533,40]）依次：
 *      ① 搜索 160×40 · r12 · p `8px 12px` · bg white/5 · ring inset white/10 · focus-within:ring-white/20
 *      ② 筛选 100×40 同上（文案 + chevron 16）
 *      ③ 视图 `div.p-1 gap-2 bg-white/5 rounded-lg ring-1 ring-inset ring-white/10`（80×40 · r12 · p4 · g8）
 *           两个 `button.p-1.5 rounded-md`，选中 `bg-input/50`
 *      ④ 分隔 `div.h-6 w-px bg-border mx-1`（1×24 · rgba(255,255,255,.1)）
 *      ⑤ 导入 40×40 · r12 · `bg-input/80 hover:bg-input`（仅图标）
 *      ⑥ 新建项目 104×40 · r12 · p `10px 12px` · `text-sm font-medium`
 *
 * 网格 `ul.w-full grid grid-cols-1 sm:2 md:3 lg:4 xl:5 auto-rows-auto gap-4 grid-flow-row py-4 px-2`
 * 卡片 `div.rounded-xl bg-card text-card-foreground shadow overflow-hidden relative p-2 pb-0 group/card border`
 *   （r16 · p `8px 8px 0` · bg #1F1F1F · border `0.667px rgba(255,255,255,.1)`；封面实高 = 宽 × 3/4）
 *   信息 `div.px-1 pt-2 pb-2`：`span.text-sm font-semibold truncate` + 改名钮（hover 才显）
 *     + `p.text-xs mt-1`（12px/400 #7A7A7A）
 *   菜单 `button.absolute p-1.5 rounded-md text-white/80 z-30 bg-black/50`（28×28 · r10 · p6 · **默认 opacity:0** · 右上 16px）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { MarbleAvatar } from '../projectLibrary/ProjectCovers';
import {
  CoverSet,
  GlassPocket,
  GlassPocketFilterDefs,
  GLASS_POCKET_MASK,
  ListCover,
  type CoverSetItem,
} from './WorkspaceCovers';
import { WorkspacePopper, type WorkspaceMenuAnchor, type WorkspaceMenuItem } from './WorkspaceMenu';
import {
  MOVE_OUT,
  WorkspaceMoveDialog,
  WorkspaceSelectionBar,
  type BatchAction,
  type MoveTarget,
} from './WorkspaceDialogs';
import { officialModal } from '../../services/officialModal';
import type { CanvasProject, WorkspaceCollection } from '../../types';

type ProjectTab = 'personal' | 'team';
type ViewMode = 'grid' | 'list';
type FilterBy = 'all' | 'projects' | 'collections';
type SortBy = 'lastModified' | 'dateCreated';
type SortOrder = 'newest' | 'oldest';

/** 官方 `ye`（`mixedItems`）：文件夹与项目混排的一项 */
type WorkspaceItem =
  | { kind: 'collection'; collection: WorkspaceCollection }
  | { kind: 'project'; project: CanvasProject };

const EMPTY_COLLECTIONS: WorkspaceCollection[] = [];

/**
 * 官方 `ia(t)`（`page-CoyqNJe1.js` @21050）—— 列表「创建时间」列的格式：
 *   `YYYY-MM-DD HH:mm`（本地时区、零填充），**不是** `toLocaleString`。
 */
function formatCreatedAt(ts: number): string {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/** 官方 `Ms = 32`：列表左侧选择列宽 */
const LIST_SELECT_WIDTH = 32;
/** 官方 `Is = "72px 1fr 120px 150px 180px 180px"`：列表六列栅格 */
const LIST_COLUMNS = '72px 1fr 120px 150px 180px 180px';
/** 官方项目卡 `shadow`（v4 shadow-md 实测 `0 2px 4px 0 rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)`） */
const CARD_SHADOW = 'shadow-[0_2px_4px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]';

function editedLabel(ts: number, t: (text: string, vars?: Record<string, string | number>) => string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (minutes < 1) return t('刚刚');
  if (minutes < 60) return t('{n} 分钟前', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('{n} 小时前', { n: hours });
  return t('{n} 天前', { n: Math.floor(hours / 24) });
}

/**
 * 官方项目封面分支（`Ds` 项目卡 / `ca` 列表预览格）：
 *   previewImage 有 → `<img className="w-full h-full object-cover hover:scale-105 transition-all duration-200">`
 *   无             → boring-avatars marble（五色），宫格用 `h-full w-full rounded-lg hover:scale-110 transition-all duration-200`
 */
function GridProjectCover({ project }: { project: CanvasProject }) {
  if (project.snapshot) {
    return <img src={project.snapshot} alt="" className="w-full h-full object-cover hover:scale-105 transition-all duration-200" />;
  }
  return (
    <MarbleAvatar
      name={project.id}
      className="h-full w-full rounded-[12px] hover:scale-110 transition-all duration-200"
    />
  );
}

export interface WorkspaceProjectsProps {
  onOpenProject: (id: string) => void;
  onCreateProject: (collectionId?: string) => void;
}

export default function WorkspaceProjects({ onOpenProject, onCreateProject }: WorkspaceProjectsProps) {
  const t = useT();
  const projects = useAppStore((s) => s.projects);
  const renameProject = useAppStore((s) => s.renameProject);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const showToast = useAppStore((s) => s.showToast);

  const [tab, setTab] = useState<ProjectTab>('personal');
  const [view, setView] = useState<ViewMode>('grid');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [sortBy, setSortBy] = useState<SortBy>('lastModified');
  const [order, setOrder] = useState<SortOrder>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState('');
  /* 官方 `St`：kebab 下拉（side=bottom/align=end/sideOffset=4）与右键上下文菜单（指针处）共用同一份 menuItems */
  const [menu, setMenu] = useState<{ id: string; anchor: WorkspaceMenuAnchor } | null>(null);
  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  /* 官方：`activeCollection`（进入文件夹后的子列表）+ 多选模式（`isSelectionMode` / `selectedIds`） */
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveDialog, setMoveDialog] = useState<{ ids: string[]; selected: string | null } | null>(null);
  /* 官方无限滚动：一次先渲染 20 条，接近底部再 +20（`IntersectionObserver` 哨兵） */
  const [visibleCount, setVisibleCount] = useState(20);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const collections = useAppStore((s) => s.config.collections ?? EMPTY_COLLECTIONS);
  const createCollection = useAppStore((s) => s.createCollection);
  const renameCollection = useAppStore((s) => s.renameCollection);
  const deleteCollection = useAppStore((s) => s.deleteCollection);
  const moveProjectsToCollection = useAppStore((s) => s.moveProjectsToCollection);
  const batchDeleteProjects = useAppStore((s) => s.batchDeleteProjects);

  useEffect(() => {
    if (!filterOpen) return undefined;
    const close = (event: MouseEvent) => {
      if (filterRef.current && filterRef.current.contains(event.target as Node)) return;
      setFilterOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [filterOpen]);

  /** 官方 `ca`/`la` 之外的第三个概念：不在任何文件夹里、也不是分集的顶层项目 */
  const rootProjects = useMemo(
    () => projects.filter((project) => !project.parentId),
    [projects],
  );

  /** 文件夹里的项目（官方 `child_canvas_count` / `cover_set` 的反查来源） */
  const projectsOfCollection = useCallback(
    (collectionId: string) => rootProjects.filter((project) => project.collectionId === collectionId),
    [rootProjects],
  );

  /**
   * 官方 `ye`（`mixedItems`）：文件夹与项目混在同一个列表里，按同一个排序键排。
   * 9444 实测：默认「按最近修改 / 最新优先」时，新建的 4 个文件夹排在最前。
   */
  const list = useMemo(() => {
    if (tab === 'team') return [] as WorkspaceItem[];
    const keyword = query.trim().toLowerCase();

    if (activeCollectionId) {
      return projectsOfCollection(activeCollectionId)
        .filter((project) => (keyword ? project.name.toLowerCase().includes(keyword) : true))
        .map((project) => ({ kind: 'project' as const, project }));
    }

    const collectionItems: WorkspaceItem[] = filterBy === 'projects'
      ? []
      : collections.map((collection) => ({ kind: 'collection' as const, collection }));
    const projectItems: WorkspaceItem[] = filterBy === 'collections'
      ? []
      : rootProjects
        .filter((project) => !project.collectionId)
        .map((project) => ({ kind: 'project' as const, project }));

    const key = (item: WorkspaceItem) =>
      sortBy === 'dateCreated'
        ? (item.kind === 'collection' ? item.collection.createdAt : item.project.createdAt)
        : (item.kind === 'collection' ? item.collection.updatedAt : item.project.updatedAt);

    return [...collectionItems, ...projectItems]
      .filter((item) => {
        const name = item.kind === 'collection' ? item.collection.name : item.project.name;
        return keyword ? name.toLowerCase().includes(keyword) : true;
      })
      .sort((a, b) => (order === 'newest' ? key(b) - key(a) : key(a) - key(b)));
  }, [activeCollectionId, collections, filterBy, order, projectsOfCollection, query, rootProjects, sortBy, tab]);

  const visible = list.slice(0, visibleCount);

  /** 官方收藏夹封面数据 `cover_set`（`[{canvas_id, preview_image}]`，最多 3 张） */
  const coverSetOf = useCallback(
    (collectionId: string): CoverSetItem[] =>
      projectsOfCollection(collectionId)
        .slice(0, 3)
        .map((item) => ({ canvas_id: item.id, preview_image: item.snapshot })),
    [projectsOfCollection],
  );

  /* 官方 `Ts`：`IntersectionObserver(rootMargin:"100px", threshold:.1)` 哨兵触发加载更多 */
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisibleCount((count) => count + 20);
    }, { rootMargin: '100px', threshold: 0.1 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible.length, list.length]);

  const tabs: { key: ProjectTab; label: string }[] = [
    { key: 'personal', label: t('个人') },
    { key: 'team', label: t('团队项目') },
  ];
  const filterLabels: Record<FilterBy, string> = {
    all: t('显示全部'),
    projects: t('仅项目'),
    collections: t('仅文件夹'),
  };
  const sortLabels: Record<SortBy, string> = {
    lastModified: t('按最近修改'),
    dateCreated: t('按创建日期'),
  };
  const orderLabels: Record<SortOrder, string> = {
    newest: t('最新优先'),
    oldest: t('最早优先'),
  };

  const commitRename = useCallback(async () => {
    const id = renameFor;
    const name = renameDraft.trim();
    setRenameFor(null);
    if (!id || !name) return;
    if (collections.some((collection) => collection.id === id)) {
      const ok = await renameCollection(id, name);
      if (!ok) showToast(t('重命名失败，请重试'), 'error');
      return;
    }
    const ok = await renameProject(id, name);
    if (!ok) showToast(t('重命名失败，请重试'), 'error');
  }, [collections, renameCollection, renameDraft, renameFor, renameProject, showToast, t]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const enterSelection = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  /** 官方 `Qo`（删除文件夹确认）：`删除文件夹` / `确定要删除「X」吗？这将永久删除其中的所有 N 个项目。此操作无法撤销。` */
  const requestDeleteCollection = useCallback(
    (collection: WorkspaceCollection) => {
      const childCount = projectsOfCollection(collection.id).length;
      officialModal.custom({
        title: '删除文件夹',
        description: `确定要删除「${collection.name}」吗？这将永久删除其中的所有 ${childCount} 个项目。此操作无法撤销。`,
        confirmButton: { label: '删除文件夹', variant: 'destructive' },
        cancelButton: '取消',
        onConfirm: () => { void deleteCollection(collection.id); },
      });
    },
    [deleteCollection, projectsOfCollection],
  );

  /**
   * 官方菜单项（`Ds` 项目卡 / `_s` 收藏夹卡，逐字）：
   *   项目：打开 / 重命名 / 选择(后分隔) / 移动至... / 分享链接 / 移动至团队(后分隔) / 删除(danger)
   *   文件夹：打开 / 重命名(后分隔) / 删除(danger)
   */
  const buildMenuItems = useCallback(
    (item: WorkspaceItem): WorkspaceMenuItem[] => {
      if (item.kind === 'collection') {
        const collection = item.collection;
        return [
          { key: 'open', label: t('打开'), onSelect: () => setActiveCollectionId(collection.id) },
          {
            key: 'rename',
            label: t('重命名'),
            separator: true,
            onSelect: () => { setRenameFor(collection.id); setRenameDraft(collection.name); },
          },
          { key: 'delete', label: t('删除'), danger: true, onSelect: () => requestDeleteCollection(collection) },
        ];
      }
      const project = item.project;
      const open = () => onOpenProject(project.id);
      const rename = () => { setRenameFor(project.id); setRenameDraft(project.name); };
      return [
        { key: 'open', label: t('打开'), onSelect: open },
        { key: 'rename', label: t('重命名'), onSelect: rename },
        { key: 'select', label: t('选择'), separator: true, onSelect: () => enterSelection(project.id) },
        { key: 'moveTo', label: t('移动至...'), onSelect: () => setMoveDialog({ ids: [project.id], selected: null }) },
        { key: 'shareByLink', label: t('分享链接'), onSelect: () => showToast(t('MTV 暂不支持链接分享')) },
        { key: 'moveToTeam', label: t('移动至团队'), separator: true, onSelect: () => showToast(t('MTV 暂不支持团队空间')) },
        { key: 'delete', label: t('删除'), danger: true, onSelect: () => { void deleteProject(project.id); } },
      ];
    },
    [deleteProject, enterSelection, onOpenProject, requestDeleteCollection, showToast, t],
  );

  const findItem = useCallback(
    (id: string): WorkspaceItem | null => {
      const collection = collections.find((entry) => entry.id === id);
      if (collection) return { kind: 'collection', collection };
      const project = projects.find((entry) => entry.id === id);
      return project ? { kind: 'project', project } : null;
    },
    [collections, projects],
  );

  const menuItem = menu ? findItem(menu.id) : null;
  const menuItems = menuItem ? buildMenuItems(menuItem) : [];
  const moveTargets: MoveTarget[] = collections
    .filter((collection) => collection.id !== activeCollectionId)
    .map((collection) => ({
      id: collection.id,
      name: collection.name,
      childCount: projectsOfCollection(collection.id).length,
    }));

  /** 官方 `activeCollection`（`M ? l : null`）：进入文件夹后工具栏换成「返回 + 名称 (N)」 */
  const activeCollection = activeCollectionId
    ? collections.find((collection) => collection.id === activeCollectionId) ?? null
    : null;

  /**
   * 官方 `Xs`：多选批量条的三项 —— addToCollection(yt 20) / moveToTeam(Oo 20) / delete(zo 20)
   *
   * ★ 用户 2026 截图对比：「图1（MTV）中间那颗是三个人，图2（官方）是一个人」——
   *   官方那颗是 **`tabler:users`**（两个人：前景 + 后景），path 实测为
   *   `M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0` / `M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2` /
   *   `M16 3.13a4 4 0 0 1 0 7.75` / `M21 21v-2a4 4 0 0 0 -3 -3.85`；
   *   MTV 原来写的是 `users-group`（三个人）✗。
   *   另两颗实测一致：folder-plus `M12 19h-7a2 2 0 0 1 -2 -2v-11…` / `M16 19h6` / `M19 16v6`，
   *   trash `M4 7l16 0` / `M10 11l0 6` / `M14 11l0 6` / `M5 7l1 12a2 2 0 0 0 2 2h8…` / `M9 7v-3…` ✓
   */
  const selectionActions: BatchAction[] = [
    {
      key: 'addToCollection',
      label: t('添加到文件夹'),
      icon: <Icon icon="tabler:folder-plus" width={20} height={20} />,
      disabled: selectedIds.size === 0,
      onClick: () => setMoveDialog({ ids: [...selectedIds], selected: null }),
    },
    {
      key: 'moveToTeam',
      label: t('移动至团队'),
      icon: <Icon icon="tabler:users" width={20} height={20} />,
      disabled: selectedIds.size === 0,
      onClick: () => showToast(t('MTV 暂不支持团队空间')),
    },
    {
      key: 'delete',
      label: t('删除'),
      icon: <Icon icon="tabler:trash" width={20} height={20} />,
      disabled: selectedIds.size === 0,
      onClick: () => {
        const ids = [...selectedIds];
        void batchDeleteProjects(ids).then(() => exitSelection());
      },
    },
  ];

  /** 官方 `B`（对话框「继续」）：选中 `__move_out__` 走移出，否则移入该文件夹 */
  const confirmMove = useCallback(async () => {
    if (!moveDialog?.selected) return;
    await moveProjectsToCollection(
      moveDialog.ids,
      moveDialog.selected === MOVE_OUT ? null : moveDialog.selected,
    );
    setMoveDialog(null);
    exitSelection();
  }, [exitSelection, moveDialog, moveProjectsToCollection]);

  /** 官方 `pa` 里的「新建文件夹 / 创建并移入」 */
  const createCollectionAndMove = useCallback(async () => {
    const ids = moveDialog?.ids ?? [];
    const id = await createCollection();
    if (ids.length > 0) await moveProjectsToCollection(ids, id);
    setMoveDialog(null);
    exitSelection();
  }, [createCollection, exitSelection, moveDialog, moveProjectsToCollection]);
  /** 官方 Radix `DropdownMenuTrigger`：点触发器切换开合（再点一次关闭） */
  const toggleTriggerMenu = useCallback((id: string, el: HTMLElement) => {
    setMenu((current) =>
      current && current.id === id && current.anchor.kind === 'trigger' && current.anchor.el === el
        ? null
        : { id, anchor: { kind: 'trigger', el } },
    );
  }, []);

  return (
    <section className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden">
      {/* ── 工具行 ── */}
      <div className="flex flex-col items-start justify-between gap-y-2 px-8 pb-2 md:flex-row">
        <div className="flex items-center justify-between gap-4">
          {/* 官方 `xa`：进入文件夹后，标签行换成「返回 + 文件夹名 (N)」 */}
          {activeCollection ? (
            <div className="flex items-center gap-1 text-lg">
              <button
                type="button"
                aria-label={t('返回')}
                data-testid="workspace-collection-back"
                onClick={() => { setActiveCollectionId(null); exitSelection(); }}
                className="mx-3 cursor-pointer rounded-t-md border-b-2 border-transparent py-1.5 text-[#7a7a7a] transition-colors hover:text-[#f5f5f5]"
              >
                <Icon icon="tabler:arrow-back-up" width={18} height={18} />
              </button>
              <span className="mx-3 py-1.5 font-medium text-[#f5f5f5]">
                {activeCollection.name}
                <span className="ml-1 font-normal text-[#7a7a7a]">{`(${projectsOfCollection(activeCollection.id).length})`}</span>
              </span>
            </div>
          ) : (
          <ul className="flex gap-2 text-lg text-[#7a7a7a]">
            {tabs.map((item) => (
              <li
                key={item.key}
                data-testid={`workspace-projects-tab-${item.key}`}
                onClick={() => setTab(item.key)}
                /* 官方：选中 `text-foreground border-b-2 !border-foreground`；未选中**没有** border 类（靠 flex 拉伸同高） */
                className={`mx-3 cursor-pointer rounded-t-md py-1.5 hover:bg-transparent ${
                  tab === item.key ? 'border-b-2 border-[#F5F5F5] text-[#F5F5F5]' : ''
                }`}
              >
                {item.label}
              </li>
            ))}
          </ul>
          )}
        </div>

        <div className="relative flex items-center gap-x-2">
          {/* ① 搜索 */}
          <div
            className="flex h-10 items-center gap-1 rounded-lg bg-white/5 px-3 py-2 ring-1 ring-inset ring-white/10 transition-all duration-300 ease-out focus-within:ring-white/20"
            style={{ width: query ? 220 : 160 }}
          >
            <Icon icon="tabler:search" width={20} height={20} className="shrink-0 text-[#646464]" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('搜索')}
              data-testid="workspace-projects-search"
              className="min-w-0 flex-1 border-none bg-transparent text-sm font-normal leading-5 text-[#f5f5f5] outline-none placeholder:text-[#646464]"
            />
          </div>
          {/* ② 筛选（官方下拉：筛选 / 显示全部 / 仅文件夹 / 仅项目 / 排序方式 / 按最近修改 / 按创建日期 / 顺序 / 最新优先 / 最早优先）；
              官方 `hideFilterSection={V}` —— 进入文件夹后隐藏 */}
          {!activeCollection && (
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              data-testid="workspace-projects-filter"
              onClick={() => setFilterOpen((open) => !open)}
              className="flex h-10 items-center justify-center gap-1 rounded-lg bg-white/5 px-3 py-2 text-sm font-normal leading-5 text-white shadow-[0px_1px_2px_rgba(26,26,26,0.05)] ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
            >
              {filterLabels[filterBy]}
              <Icon icon="tabler:chevron-down" width={16} height={16} className="text-[#7a7a7a]" />
            </button>
            {filterOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-[180px] rounded-md border border-white/10 bg-[#262626] p-1 text-[#ccc] shadow-md">
                <div className="px-2 py-1.5 text-xs font-normal text-[#7a7a7a]">{t('筛选')}</div>
                {(['all', 'collections', 'projects'] as FilterBy[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setFilterBy(key); setFilterOpen(false); }}
                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-white/10"
                  >
                    <span>{filterLabels[key]}</span>
                    {filterBy === key && <Icon icon="tabler:check" width={16} height={16} />}
                  </button>
                ))}
                <div className="my-1 h-px bg-white/10" />
                <div className="px-2 py-1.5 text-xs font-normal text-[#7a7a7a]">{t('排序方式')}</div>
                {(Object.keys(sortLabels) as SortBy[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setSortBy(key); setFilterOpen(false); }}
                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-white/10"
                  >
                    <span>{sortLabels[key]}</span>
                    {sortBy === key && <Icon icon="tabler:check" width={16} height={16} />}
                  </button>
                ))}
                <div className="my-1 h-px bg-white/10" />
                <div className="px-2 py-1.5 text-xs font-normal text-[#7a7a7a]">{t('顺序')}</div>
                {(Object.keys(orderLabels) as SortOrder[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setOrder(key); setFilterOpen(false); }}
                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-white/10"
                  >
                    <span>{orderLabels[key]}</span>
                    {order === key && <Icon icon="tabler:check" width={16} height={16} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
          {/* ③ 宫格 / 列表（官方 tabler-icon-layout-2 / tabler-icon-list） */}
          <div className="flex items-center gap-2 rounded-lg bg-white/5 p-1 ring-1 ring-inset ring-white/10">
            {([['grid', 'tabler:layout-2'], ['list', 'tabler:list']] as [ViewMode, string][]).map(([mode, icon]) => (
              <button
                key={mode}
                type="button"
                aria-label={mode === 'grid' ? t('宫格视图') : t('列表视图')}
                data-testid={`workspace-projects-view-${mode}`}
                onClick={() => setView(mode)}
                className={`rounded-md p-1.5 transition-colors ${view === mode ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                <Icon icon={icon} width={20} height={20} className={view === mode ? 'text-[#f5f5f5]' : 'text-[#a3a3a3]'} />
              </button>
            ))}
          </div>
          <div className="mx-1 h-6 w-px bg-[#ffffff1a]" />
          {/* ⑤ 官方这里是「新建文件夹」（`tabler-icon-folder-plus` 20×20），不是导入；进入文件夹后隐藏（`!V`） */}
          {!activeCollection && (
          <button
            type="button"
            aria-label={t('新建文件夹')}
            data-testid="workspace-projects-new-folder"
            onClick={() => {
              void createCollection().then((id) => {
                setActiveCollectionId(null);
                setRenameFor(id);
                setRenameDraft('未命名文件夹');
              });
            }}
            className="flex h-10 items-center justify-center overflow-hidden rounded-lg px-3 py-2 text-[#fafafa] transition-colors hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.119)' }}
          >
            <Icon icon="tabler:folder-plus" width={20} height={20} />
          </button>
          )}
          {/* ⑥ 新建项目 */}
          <button
            type="button"
            onClick={() => onCreateProject(activeCollectionId ?? undefined)}
            data-testid="workspace-projects-new"
            className="flex h-10 items-center gap-1 rounded-lg px-3 py-2.5 text-sm font-medium leading-5 text-[#fafafa] transition-colors hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.119)' }}
          >
            <Icon icon="lucide:plus" width={16} height={16} />
            {t('新建项目')}
          </button>
        </div>
      </div>

      {/* ── 宫格 / 列表（官方 `so()` 的两个分支，逐字） ── */}
      {/* 宫格：`ScrollArea className="h-full px-8"` + `ul.grid …`（**无面板**）
          列表：`div.h-full flex flex-col px-10 pr-8 py-4 pb-20` + `div.flex-1 min-h-0 flex flex-col bg-white/5 rounded-xl`（**有面板**） */}
      {tab === 'team' ? (
        <div className="mt-16 flex items-center justify-center text-sm text-[#7a7a7a]">{t('还没有团队项目')}</div>
      ) : view === 'list' ? (
        <div className="flex h-full flex-col px-10 py-4 pb-20 pr-8">
          <div className="flex min-h-0 flex-1 flex-col rounded-xl bg-white/5">
            {/* 官方 `sa` 表头：非选择模式下左侧是 32px 空占位，选择模式显示勾选框 */}
            <div className="px-4 pt-5">
              <div className="flex items-center">
                <div className="flex shrink-0 items-center justify-center" style={{ width: LIST_SELECT_WIDTH }}>
                  {selectionMode && (
                    <button
                      type="button"
                      aria-label={t('全选')}
                      data-testid="workspace-list-select-all"
                      onClick={() => {
                        const selectable = visible.filter((item) => item.kind === 'project').map((item) => item.project.id);
                        setSelectedIds((current) => (
                          current.size === selectable.length ? new Set() : new Set(selectable)
                        ));
                      }}
                      className={`flex h-5 w-5 items-center justify-center rounded-[6px] transition-colors ${
                        selectedIds.size > 0 ? 'bg-white' : 'bg-[#ccc] ring-1 ring-inset'
                      }`}
                    >
                      {selectedIds.size > 0 && <Icon icon="tabler:check" width={14} height={14} stroke={'3'} className="text-black" />}
                    </button>
                  )}
                </div>
                <div
                  className="grid flex-1 items-center gap-6 pl-4 pr-14 text-sm font-normal text-[#7a7a7a]"
                  style={{ gridTemplateColumns: LIST_COLUMNS }}
                >
                  <div>{t('预览')}</div>
                  <div>{t('名称')}</div>
                  <div>{t('类型')}</div>
                  <div>{t('内容')}</div>
                  <div>{t('创建时间')}</div>
                  <div>{t('最近更新')}</div>
                </div>
              </div>
              <div className="mx-12 mr-4 mt-4 border-b border-white/10" />
            </div>
            <div className="ws-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
              {/* 官方 `div.flex flex-col px-4 pb-5`（列表项直接是 div，不是 li） */}
              <div className="flex flex-col px-4 pb-5">
                {visible.map((item) => {
                  const id = item.kind === 'collection' ? item.collection.id : item.project.id;
                  const name = item.kind === 'collection' ? item.collection.name : item.project.name;
                  const isCollection = item.kind === 'collection';
                  const childCount = isCollection ? projectsOfCollection(item.collection.id).length : 0;
                  const selected = !isCollection && selectedIds.has(id);
                  return (
                    <div key={id} className="group/menu relative outline-none">
                      <div>
                        <div
                          className="group/row flex cursor-pointer items-center"
                          onClick={() => {
                            if (selectionMode) {
                              if (!isCollection) toggleSelect(id);
                              return;
                            }
                            if (isCollection) setActiveCollectionId(id);
                            else onOpenProject(id);
                          }}
                        >
                          <div className="flex shrink-0 items-center justify-center" style={{ width: LIST_SELECT_WIDTH }}>
                            {selectionMode && !isCollection && (
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded-[6px] transition-colors ${
                                  selected ? 'bg-white' : 'bg-[#ccc] ring-1 ring-inset'
                                }`}
                              >
                                {selected && <Icon icon="tabler:check" width={14} height={14} stroke={'3'} className="text-black" />}
                              </div>
                            )}
                          </div>
                          <div
                            className="grid flex-1 items-center gap-6 rounded-lg py-3 pl-4 pr-14 transition-colors group-hover/row:bg-white/5"
                            style={{ gridTemplateColumns: LIST_COLUMNS }}
                          >
                            <div className="flex items-center justify-start">
                              <ListCover
                                item={
                                  isCollection
                                    ? { type: 'collection', coverSet: coverSetOf(id) }
                                    : { type: 'project', previewImage: item.project.snapshot, projectId: id }
                                }
                              />
                            </div>
                            <div className="truncate text-sm font-normal text-[#fafafa]">
                              {renameFor === id ? (
                                <input
                                  autoFocus
                                  value={renameDraft}
                                  onChange={(event) => setRenameDraft(event.target.value)}
                                  onBlur={() => void commitRename()}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') { event.preventDefault(); void commitRename(); }
                                    if (event.key === 'Escape') setRenameFor(null);
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                  maxLength={30}
                                  className="max-w-[200px] border-b border-[#1fa2dc] bg-transparent text-sm text-[#fafafa] outline-none"
                                />
                              ) : name}
                            </div>
                            <div className="text-sm font-normal text-[#fafafa]">{isCollection ? t('文件夹') : t('项目')}</div>
                            <div className="text-sm font-normal text-[#fafafa]">
                              {isCollection ? t('{n} 个项目', { n: childCount }) : ''}
                            </div>
                            <div className="whitespace-nowrap text-sm font-normal text-[#fafafa]">
                              {formatCreatedAt(isCollection ? item.collection.createdAt : item.project.createdAt)}
                            </div>
                            <div className="whitespace-nowrap text-sm font-normal text-[#fafafa]">
                              {t('编辑于 {time}', {
                                time: editedLabel(isCollection ? item.collection.updatedAt : item.project.updatedAt, t),
                              })}
                            </div>
                          </div>
                        </div>
                        {/* 官方每行后自带分隔线：`mx-12 mr-4 border-b border-border`（在 `St` 的 children 里，行之后） */}
                        <div className="mx-12 mr-4 border-b border-white/10" />
                      </div>
                      {/* 官方 `showTriggerButton={!isSelectionMode}`：多选模式下不显示 kebab */}
                      {!selectionMode && (
                        <button
                          type="button"
                          aria-label={t('更多')}
                          data-testid={`${isCollection ? 'workspace-collection-more' : 'workspace-project-more'}-${id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleTriggerMenu(id, event.currentTarget);
                          }}
                          className={`absolute top-1/2 right-3 z-30 -translate-y-1/2 rounded-[10px] p-1.5 text-white/80 outline-none transition-opacity duration-200 ${
                            isCollection ? '' : 'bg-black/50 '
                          }${menu?.id === id ? 'opacity-100' : 'opacity-0 group-hover/menu:opacity-100'}`}
                        >
                          <Icon icon="tabler:dots-vertical" width={16} height={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {visible.length < list.length && (
                <div className="flex flex-col gap-2 px-6 py-2" aria-hidden="true">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-[60px] animate-pulse rounded-lg bg-[#2b2b2b]/20" />
                  ))}
                </div>
              )}
              {/* 官方 `Ts`：1×100% 的哨兵 div（不在 ul 里，位于滚动容器末尾） */}
              <div ref={sentinelRef} style={{ height: 1, width: '100%' }} aria-hidden="true" />
            </div>
          </div>
        </div>
      ) : (
        <div className="ws-scroll h-full overflow-x-hidden overflow-y-auto px-8">
          <ul className="grid w-full grid-flow-row auto-rows-auto grid-cols-1 gap-4 px-2 py-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <li className="h-full w-full">
              <div
                role="button"
                tabIndex={0}
                onClick={() => onCreateProject(activeCollectionId ?? undefined)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCreateProject(activeCollectionId ?? undefined); } }}
                data-testid="workspace-projects-new-tile"
                className="group relative h-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[#1f1f1f] p-2 pb-0 text-[#fafafa] shadow transition-all duration-200"
              >
                <div className="pointer-events-none invisible select-none" aria-hidden="true">
                  <div className="aspect-[4/3] w-full" />
                  <div className="px-1 pb-2 pt-2">
                    <span className="block text-sm font-semibold">Project</span>
                    <p className="mt-1 text-xs">Updated</p>
                  </div>
                </div>
                <div className="absolute inset-x-2 bottom-0 top-2 flex flex-col rounded-lg bg-[#2b2b2b]/30 transition-all duration-300 group-hover:bg-[#2b2b2b]/50">
                  <div className="relative flex w-full flex-1 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden transition-all duration-200">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fafafa] transition-all duration-300 group-hover:scale-110">
                      <Icon icon="lucide:plus" width={20} height={20} className="text-[#1f1f1f]" />
                    </div>
                    <span className="text-sm text-[#f5f5f5] transition-colors duration-300">{t('新建项目')}</span>
                  </div>
                </div>
              </div>
            </li>

            {visible.map((item) => {
              const id = item.kind === 'collection' ? item.collection.id : item.project.id;
              const isFolder = item.kind === 'collection';
              const name = isFolder ? item.collection.name : item.project.name;
              const childCount = isFolder ? projectsOfCollection(id).length : 0;
              const selected = !isFolder && selectedIds.has(id);
              return (
              <li key={id} className="h-fit w-full">
                {/* 官方 `St`：`relative group/menu …`，右键同一份 menuItems */}
                <div
                  className="group/menu relative outline-none"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ id, anchor: { kind: 'point', x: event.clientX, y: event.clientY } });
                  }}
                >
                  {isFolder ? (
                    /* 官方收藏夹卡 `_s`：`rounded-2xl p-2 pb-2 bg-[#1F1F1F] outline outline-white/[0.08] -outline-offset-1` + 玻璃口袋 */
                    <div
                      className={`relative isolate overflow-hidden rounded-[16px] bg-[#1F1F1F] p-2 pb-2 outline outline-1 -outline-offset-1 outline-white/[0.08] transition-all duration-200 ${
                        selectionMode ? 'cursor-default' : 'cursor-pointer'
                      }`}
                      onClick={() => { if (!selectionMode) setActiveCollectionId(id); }}
                    >
                      <div
                        className="relative w-full overflow-hidden"
                        style={{
                          aspectRatio: '4 / 3',
                          background: 'linear-gradient(136deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0) 100%), #1D242A',
                          borderRadius: '12px',
                        }}
                      >
                        <CoverSet coverSet={coverSetOf(id)} />
                      </div>
                      {/* 官方高度占位：`pt-2 space-y-1 invisible` + `text-sm h-5` + `text-xs h-4` */}
                      <div className="invisible space-y-1 pt-2">
                        <div className="h-5 text-sm" />
                        <div className="h-4 text-xs" />
                      </div>
                      {/* 官方玻璃口袋：高 45%（拖拽目标 30%）、backdrop blur 10px、口袋遮罩 */}
                      <div
                        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
                        style={{
                          height: '45%',
                          transition: 'height 300ms ease-out',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          mask: GLASS_POCKET_MASK,
                          maskSize: '100% 100%',
                          maskRepeat: 'no-repeat',
                          WebkitMask: GLASS_POCKET_MASK,
                          WebkitMaskSize: '100% 100%',
                          WebkitMaskRepeat: 'no-repeat',
                        }}
                      >
                        <GlassPocket className="absolute inset-0" />
                      </div>
                      {/* 官方文字层 `Ko`：`absolute left-4 right-4 bottom-2 z-20` */}
                      <div className="absolute bottom-2 left-4 right-4 z-20">
                        <div className="flex flex-col gap-1">
                          <div className="group/name flex items-center gap-1">
                            {renameFor === id ? (
                              <input
                                autoFocus
                                value={renameDraft}
                                onChange={(event) => setRenameDraft(event.target.value)}
                                onClick={(event) => event.stopPropagation()}
                                onBlur={() => void commitRename()}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') { event.preventDefault(); void commitRename(); }
                                  if (event.key === 'Escape') setRenameFor(null);
                                }}
                                maxLength={30}
                                className="h-fit max-w-[200px] rounded-none border-none bg-transparent p-0 text-sm font-semibold text-[#fafafa] shadow-none outline-none transition-colors duration-200 disabled:opacity-60"
                              />
                            ) : (
                              <span
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setRenameFor(id);
                                  setRenameDraft(name);
                                }}
                                className="cursor-text truncate text-sm font-semibold transition-colors hover:text-white"
                              >
                                {name}
                              </span>
                            )}
                            {renameFor !== id && (
                              <button
                                type="button"
                                aria-label={t('重命名')}
                                data-testid={`${isFolder ? 'workspace-collection-rename' : 'workspace-project-rename'}-${id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setRenameFor(id);
                                  setRenameDraft(name);
                                }}
                                className="p-0.5 text-[#7a7a7a] opacity-0 transition-opacity group-hover/name:opacity-100"
                              >
                                <Icon icon="tabler:pencil-minus" width={14} height={14} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs text-[#7a7a7a]">
                            <span>{t('编辑于 {time}', { time: editedLabel(item.collection.updatedAt, t) })}</span>
                            <span className="text-[10px]">{t('{n} 个项目', { n: childCount })}</span>
                          </div>
                        </div>
                      </div>
                      {/* 官方 `_s`：多选模式下盖一层 `bg-black/30`（文件夹不可被选中） */}
                      {selectionMode && <div className="absolute inset-0 z-25 rounded-[16px] bg-black/30" />}
                    </div>
                  ) : (
                  /* 官方项目卡：`rounded-xl bg-card text-card-foreground shadow overflow-hidden relative p-2 pb-0 group/card border` */
                  <div
                    className={`group/card relative overflow-hidden rounded-xl border border-white/10 bg-[#1f1f1f] p-2 pb-0 text-[#fafafa] ${CARD_SHADOW} ${
                      selectionMode ? 'cursor-pointer' : ''
                    } ${selected ? 'border-transparent ring-2 ring-white ring-offset-0' : ''}`}
                    onClick={() => { if (selectionMode) toggleSelect(id); }}
                  >
                    <div className="transition-opacity duration-200">
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={t('打开项目 {name}', { name: name })}
                        data-testid={`workspace-project-${id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (selectionMode) toggleSelect(id);
                          else onOpenProject(id);
                        }}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenProject(id); } }}
                        /* 官方 `w-full overflow-hidden rounded-lg cursor-pointer relative` + 内联 `aspect-ratio: 4 / 3` */
                        className="relative w-full cursor-pointer overflow-hidden rounded-[12px]"
                        style={{ aspectRatio: '4 / 3' }}
                      >
                        <div className="h-full w-full overflow-hidden rounded-[12px]">
                          <GridProjectCover project={item.project} />
                        </div>
                      </div>
                      <div className="px-1 pb-2 pt-2">
                        <div className="group/name flex items-center">
                          {renameFor === id ? (
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(event) => setRenameDraft(event.target.value)}
                              onBlur={() => void commitRename()}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') { event.preventDefault(); void commitRename(); }
                                if (event.key === 'Escape') setRenameFor(null);
                              }}
                              onClick={(event) => event.stopPropagation()}
                              maxLength={30}
                              className="max-w-[200px] border-b border-[#1fa2dc] bg-transparent text-sm text-[#fafafa] outline-none"
                            />
                          ) : (
                            <>
                              <span className="truncate text-sm font-semibold">{name}</span>
                              <button
                                type="button"
                                aria-label={t('重命名')}
                                data-testid={`${isFolder ? 'workspace-collection-rename' : 'workspace-project-rename'}-${id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setRenameFor(id);
                                  setRenameDraft(name);
                                }}
                                className="ml-1.5 shrink-0 p-0.5 text-white/60 opacity-0 transition-opacity duration-200 group-hover/name:opacity-100"
                              >
                                <Icon icon="tabler:pencil-minus" width={16} height={16} />
                              </button>
                            </>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#7a7a7a] transition-colors duration-200">
                          {t('编辑于 {time}', { time: editedLabel(item.project.updatedAt, t) })}
                        </p>
                      </div>
                    </div>
                    {/* 官方 `Ds`：选择模式下的左上角勾选框 `absolute top-4 left-4 z-30 w-5 h-5 rounded-[6px]` */}
                    {selectionMode && (
                      <div
                        className={`absolute left-4 top-4 z-30 flex h-5 w-5 items-center justify-center rounded-[6px] transition-colors ${
                          selected ? 'bg-white' : 'bg-[#ccc] ring-1 ring-inset'
                        }`}
                      >
                        {selected && <Icon icon="tabler:check" width={14} height={14} stroke={'3'} className="text-black" />}
                      </div>
                    )}
                  </div>
                  )}

                  {/* 官方 kebab：`top-4 right-4`（16px）；项目卡带 `bg-black/50`，收藏夹卡**不带**；多选模式下不显示 */}
                  {!selectionMode && (
                    <button
                      type="button"
                      aria-label={t('更多')}
                      data-testid={`${isFolder ? 'workspace-collection-more' : 'workspace-project-more'}-${id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleTriggerMenu(id, event.currentTarget);
                      }}
                      className={`absolute top-4 right-4 z-30 rounded-[10px] p-1.5 text-white/80 outline-none transition-opacity duration-200 ${
                        isFolder ? '' : 'bg-black/50 '
                      }${menu?.id === id ? 'opacity-100' : 'opacity-0 group-hover/menu:opacity-100'}`}
                    >
                      <Icon icon="tabler:dots-vertical" width={16} height={16} />
                    </button>
                  )}
                </div>
              </li>
              );
            })}
            {visible.length < list.length && (
              <li className="flex flex-col gap-2 px-6 py-2" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-[60px] animate-pulse rounded-lg bg-[#2b2b2b]/20" />
                ))}
              </li>
            )}
          </ul>
          {/* 官方 `Ts`：1×100% 的哨兵 div（在 ul 之后） */}
          <div ref={sentinelRef} style={{ height: 1, width: '100%' }} aria-hidden="true" />
        </div>
      )}

      {/* 官方 `Wo`：玻璃口袋内阴影滤镜，全页只渲染一次 */}
      <GlassPocketFilterDefs />

      {/* 官方 `ga`：底部多选操作条（3 项：添加到文件夹 / 移动至团队 / 删除） */}
      <WorkspaceSelectionBar
        visible={selectionMode}
        selectedCount={selectedIds.size}
        onClose={exitSelection}
        actions={selectionActions}
      />

      {/* 官方 `pa`：「移动至...」对话框（项目菜单的「移动至...」与批量「添加到文件夹」共用） */}
      <WorkspaceMoveDialog
        open={moveDialog !== null}
        targets={moveTargets}
        selected={moveDialog?.selected ?? null}
        activeCollectionId={activeCollectionId}
        canCreateCollection={moveTargets.length === 0}
        onSelect={(id) => setMoveDialog((current) => (current ? { ...current, selected: id } : current))}
        onMoveOut={() => setMoveDialog((current) => (current ? { ...current, selected: MOVE_OUT } : current))}
        onCreateCollection={() => { void createCollectionAndMove(); }}
        onCancel={() => setMoveDialog(null)}
        onConfirm={() => { void confirmMove(); }}
      />

      {/* 官方 `St` 的 DropdownMenuContent / ContextMenuContent：w-34、align=end / 指针处 */}
      {menu && menuItems.length > 0 && (
        <WorkspacePopper anchor={menu.anchor} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </section>
  );
}
