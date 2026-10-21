/**
 * 项目库弹窗，提供项目搜索、排序、创建、重命名、打开和删除等管理操作。
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { listTopLevelProjects, resolveOpenTargetId, seriesOwnerId } from '../store/store.utils';
import type { CanvasProject } from '../types';
import * as fileService from '../services/fileService';
import { calcFixedPosition } from '../utils/popupPosition';
import ModalOverlay from './shared/ModalOverlay';
import PopupCloseButton from './shared/PopupCloseButton';
import Select from './shared/Select';
import { BlankCanvasCover, FolderCover } from './projectLibrary/ProjectCovers';
import { useT } from '../i18n';

type ProjectSort = 'updated' | 'created' | 'name';

interface ProjectLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const projectNameCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function formatProjectTimestamp(timestamp: number, t: (text: string, vars?: Record<string, string | number>) => string): string {
  const value = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfValue = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dayDifference = Math.round((startOfToday - startOfValue) / 86_400_000);
  const time = value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  if (dayDifference === 0) return t('今天 {time}', { time });
  if (dayDifference === 1) return t('昨天 {time}', { time });
  if (value.getFullYear() === now.getFullYear()) {
    return t('{month}月{date}日 {time}', { month: value.getMonth() + 1, date: value.getDate(), time });
  }
  return t('{year}年{month}月{date}日', { year: value.getFullYear(), month: value.getMonth() + 1, date: value.getDate() });
}

/** 官方文件夹卡「底部模糊带」的波浪形路径（原样） */
const FOLDER_BLUR_PATH = 'M0 12C0 5.37258 5.37258 0 12 0H97.5617C103.047 0 108.435 1.4556 113.174 4.2182L137.578 18.4446C141.095 20.4942 145.092 21.5742 149.162 21.5742H272C278.627 21.5742 284 26.9468 284 33.5742V100C284 108.837 276.837 116 268 116H16C7.16345 116 0 108.837 0 100V12Z';
/** 同一路径的 mask（官方原样，URL 编码） */
const FOLDER_BLUR_MASK = `url("data:image/svg+xml,%3Csvg width='284' height='116' viewBox='0 0 284 116' preserveAspectRatio='none' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='${FOLDER_BLUR_PATH}' fill='black'/%3E%3C/svg%3E") 0% 0% / 100% 100% no-repeat`;

/** 右键菜单估算尺寸，仅用于贴边时的翻转计算（官方实测菜单 136 宽）。 */
const PROJECT_MENU_WIDTH = 136;
const PROJECT_MENU_HEIGHT = 250;

/** 列表视图「创建时间」列 —— 官方格式：2026-09-18 18:56 */
function formatAbsoluteTime(value: number): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 菜单条目 — TapNow 官方实测：
 *   高 32 · radius 8px · padding 6px 8px · 字号 14px/400 · 颜色 rgb(204,204,204)
 *   hover: bg rgb(64,64,64) + color rgb(250,250,250)
 *   危险项 color rgb(147,76,76)
 *   **官方条目没有图标**（7 项全是纯文字），这里也不加。
 */
function ProjectMenuItem({ label, ariaLabel, danger, disabled, onClick }: {
  label: string;
  ariaLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-full items-center rounded-[8px] px-2 py-1.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${danger
          ? 'text-[rgb(147,76,76)] hover:bg-[#404040] hover:text-[#FAFAFA]'
          : 'text-[#CCCCCC] hover:bg-[#404040] hover:text-[#FAFAFA]'
        }`}
    >
      {label}
    </button>
  );
}

/* 缩略图 — TapNow 官方实测：容器 4:3 · radius 12px。
   优先级：① 有快照 → 直接显示缩略图（**文件夹里的子项目也走这条**：
   官方「有内容的文件夹」显示的是子项目缩略图，只有空文件夹才回到扇形叠卡）；
   ② 文件夹但拿不到缩略图 → 官方扇形叠卡封面；③ 无快照画布 → 官方模糊渐变封面。 */
function ProjectSnapshotPreview({ snapshot, folder, seed, fill }: {
  snapshot?: string;
  folder: boolean;
  seed: string;
  /** 列表视图用：撑满父容器而不锁定 4:3 */
  fill?: boolean;
}) {
  const box = fill ? 'h-full w-full' : 'aspect-[4/3] w-full';
  if (snapshot) {
    return (
      <div className={`relative overflow-hidden rounded-xl ${box}`}>
        {/* 官方：缩略图 hover scale-105（Tailwind v4 的 scale 属性）· transition-all .2s */}
        <img
          src={snapshot}
          alt=""
          className="h-full w-full object-cover transition-all duration-200 hover:scale-105"
          draggable={false}
        />
      </div>
    );
  }
  if (folder) {
    return (
      <div className={`relative overflow-hidden rounded-xl ${box}`}>
        <FolderCover />
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden rounded-xl ${box}`}>
      <BlankCanvasCover seed={seed} />
    </div>
  );
}

export default function ProjectLibraryModal({ isOpen, onClose }: ProjectLibraryModalProps) {
  const t = useT();
  const {
    projects, currentProjectId, createProject, renameProject, switchProject, deleteProject,
    exportProject, importProject, duplicateProject, isCreatingProject,
  } = useAppStore(
    useShallow((state) => ({
      projects: state.projects,
      currentProjectId: state.currentProjectId,
      createProject: state.createProject,
      renameProject: state.renameProject,
      switchProject: state.switchProject,
      deleteProject: state.deleteProject,
      exportProject: state.exportProject,
      importProject: state.importProject,
      duplicateProject: state.duplicateProject,
      isCreatingProject: state.isCreatingProject,
    })),
  );
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ProjectSort>('updated');
  // 视图切换 — 官方有「网格 / 列表」两套（工具栏右侧两枚 32×32 按钮）
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameProjectName, setRenameProjectName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CanvasProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ project: CanvasProject; x: number; y: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 项目库只列顶层项目；分集在画布右侧的分集栏里管理。
  const topLevelProjects = useMemo(() => listTopLevelProjects(projects), [projects]);
  const activeProjectId = currentProjectId ? seriesOwnerId(projects, currentProjectId) : null;
  // 「文件夹」= 有下级的项目（MTV 里的剧集容器）——官方给这类卡片画扇形叠卡封面
  const folderProjectIds = useMemo(
    () => new Set(projects.map((project) => project.parentId).filter((id): id is string => Boolean(id))),
    [projects],
  );
  // 列表视图的「内容」列：文件夹显示下级数量
  const folderChildCounts = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach((project) => {
      if (!project.parentId) return;
      counts.set(project.parentId, (counts.get(project.parentId) ?? 0) + 1);
    });
    return counts;
  }, [projects]);

  const deletableProjectCount = useMemo(
    () => topLevelProjects.filter((project) => project.id !== 'default').length,
    [topLevelProjects],
  );

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
    return topLevelProjects
      .filter((project) => project.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
      .sort((left, right) => {
        if (left.id === activeProjectId) return -1;
        if (right.id === activeProjectId) return 1;
        if (sort === 'name') return projectNameCollator.compare(left.name, right.name);
        if (sort === 'created') return right.createdAt - left.createdAt;
        return right.updatedAt - left.updatedAt;
      });
  }, [activeProjectId, topLevelProjects, query, sort]);

  useEffect(() => {
    if (!isOpen) return;
    const focusFrame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(focusFrame);
  }, [isOpen]);

  const closeLibrary = () => {
    setQuery('');
    setContextMenu(null);
    setRenameTargetId(null);
    setRenameProjectName('');
    setIsRenaming(false);
    setDeleteTarget(null);
    setIsDeleting(false);
    onClose();
  };

  const requestClose = () => {
    if (isCreatingProject) return;
    if (contextMenu) {
      setContextMenu(null);
      return;
    }
    if (deleteTarget) {
      setDeleteTarget(null);
      return;
    }
    if (renameTargetId) {
      setRenameTargetId(null);
      setRenameProjectName('');
      return;
    }
    closeLibrary();
  };

  const openProject = (projectId: string) => {
    // 只有从项目库切走才重拍缩略图 —— 这里是唯一会看到缩略图的地方
    if (projectId !== activeProjectId) switchProject(projectId, { captureSnapshot: true });
    closeLibrary();
  };

  const createNewProject = async () => {
    if (isCreatingProject) return;
    const projectId = await createProject();
    if (projectId) closeLibrary();
  };

  const beginRenameProject = (project: CanvasProject) => {
    setRenameTargetId(project.id);
    setRenameProjectName(project.name);
  };

  const cancelRenameProject = () => {
    if (isRenaming) return;
    setRenameTargetId(null);
    setRenameProjectName('');
  };

  const submitRenameProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameTargetId || isRenaming) return;
    const name = renameProjectName.trim();
    if (!name) return;

    setIsRenaming(true);
    try {
      if (await renameProject(renameTargetId, name)) {
        setRenameTargetId(null);
        setRenameProjectName('');
      }
    } finally {
      setIsRenaming(false);
    }
  };

  const runExportProject = async (project: CanvasProject) => {
    if (exportingId || isImporting) return;
    setExportingId(project.id);
    try {
      await exportProject(project.id);
    } finally {
      setExportingId(null);
    }
  };

  const openProjectFolder = async (project: CanvasProject) => {
    try {
      const dir = await fileService.ensureProjectDataDir(project.id);
      if (dir) await fileService.openDirectoryInFileManager(dir);
    } catch (error) {
      console.warn('[项目库] 打开项目文件夹失败:', error);
    }
  };

  const runDuplicateProject = async (project: CanvasProject) => {
    if (duplicatingId) return;
    setDuplicatingId(project.id);
    try {
      await duplicateProject(project.id);
    } finally {
      setDuplicatingId(null);
    }
  };

  const runImportProject = async () => {
    if (isImporting || exportingId) return;
    setIsImporting(true);
    try {
      const projectId = await importProject();
      if (projectId) closeLibrary();
    } finally {
      setIsImporting(false);
    }
  };

  const confirmDeleteProject = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const focusFirstProject = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      document.querySelector<HTMLElement>('[data-project-library-card]')?.focus();
    } else if (event.key === 'Enter' && visibleProjects.length === 1) {
      event.preventDefault();
      openProject(visibleProjects[0].id);
    }
  };

  const canDeleteProject = (project: CanvasProject) => (
    project.id !== 'default' && deletableProjectCount > 1
  );

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={requestClose}
      ariaLabel={t('项目库')}
      motionPreset="quick"
      backdropBlur={false}
      className="h-[min(680px,calc(100dvh-24px))] w-[min(1120px,calc(100vw-24px))]"
    >
      <div className="flex min-h-0 flex-1 flex-col bg-[#0F0F0F]">
        {/* 顶部一行 — TapNow 官方：左侧「个人」tab（18px/400，激活态白字 + 2px 白下划线，
            radius 10px 10px 0 0）与右侧工具条同处一行（justify-between）。
            官方第二个 tab 是「团队项目」，本项目无团队，故不设。 */}
        <header
          inert={deleteTarget ? true : undefined}
          aria-hidden={deleteTarget ? true : undefined}
          className="flex shrink-0 flex-col items-start justify-between gap-y-2 px-6 pb-2 pt-4 md:flex-row md:items-center"
        >
          <ul className="flex gap-2 text-lg text-[#7A7A7A]">
            <li className="mx-3 rounded-t-[10px] border-b-2 border-[#F5F5F5] py-1.5 text-[#F5F5F5]">
              {t('个人')}
            </li>
          </ul>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {/* 搜索 — 官方：160×40 · radius 12px · bg 白 5% · ring 1px 白 10% · padding 8×12
                · 图标 20px #646464 · 输入 14px/400 #F5F5F5 */}
            <label className="flex h-10 w-[200px] items-center gap-1 rounded-[12px] bg-[rgba(255,255,255,0.05)] px-3 ring-1 ring-inset ring-[rgba(255,255,255,0.1)]">
              <span className="sr-only">{t('搜索项目')}</span>
              <Icon
                icon="mdi:magnify"
                width="20"
                height="20"
                aria-hidden="true"
                className="pointer-events-none shrink-0 text-[#646464]"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={focusFirstProject}
                placeholder={t('搜索项目')}
                className="min-w-0 flex-1 border-none bg-transparent text-sm leading-5 text-[#F5F5F5] outline-none placeholder:text-[#7A7A7A]"
              />
            </label>

            {/* 排序（对应官方「显示全部 ▾」）— 官方：高 40 · radius 12px · bg 白 5% · 14px/400 白 */}
            <label className="relative">
              <span className="sr-only">{t('项目排序')}</span>
              <Select
                value={sort}
                onChange={(value) => setSort(value as ProjectSort)}
                className="project-library-sort w-[124px]"
                triggerStyle={{
                  height: 40,
                  paddingLeft: 12,
                  paddingRight: 28,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'transparent',
                  fontSize: 14,
                  color: '#FFFFFF',
                  // 官方：color / background-color .15s cubic-bezier(.4,0,.2,1)。
                  // 内联优先级最高，放这里才不会被 ui-kit 的 .ui-select--custom 规则盖掉
                  transition: 'color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                fixedMenu
                options={[
                  { value: 'updated', label: t('最近更新') },
                  { value: 'created', label: t('创建时间') },
                  { value: 'name', label: t('项目名称') },
                ]}
              />
            </label>

            {/* 视图切换 — 官方：两枚 32×32 · radius 10px；激活态底 = 白 7.45% */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t('网格视图')}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
                className={`flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors ${
                  view === 'grid'
                    ? 'bg-[rgba(255,255,255,0.0745)] text-[#F5F5F5]'
                    : 'text-[#CCCCCC] hover:bg-[rgba(255,255,255,0.05)]'
                }`}
              >
                <Icon icon="mdi:view-grid-outline" width="20" height="20" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t('列表视图')}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
                className={`flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors ${
                  view === 'list'
                    ? 'bg-[rgba(255,255,255,0.0745)] text-[#F5F5F5]'
                    : 'text-[#CCCCCC] hover:bg-[rgba(255,255,255,0.05)]'
                }`}
              >
                <Icon icon="mdi:view-list-outline" width="20" height="20" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void runImportProject()}
              data-tooltip={t('从 .aicanvas 项目包导入')}
              disabled={isImporting || exportingId !== null}
              className="inline-flex h-10 items-center gap-1 rounded-[12px] bg-[rgba(255,255,255,0.05)] px-3 text-sm text-[#F5F5F5] transition-colors hover:bg-[rgba(255,255,255,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon
                icon={isImporting ? 'mdi:loading' : 'mdi:tray-arrow-down'}
                width="20"
                height="20"
                aria-hidden="true"
                className={isImporting ? 'animate-spin' : undefined}
              />
              {isImporting ? t('正在导入') : t('导入')}
            </button>

            {/* 新建 — 官方：104×40 · radius 12px · bg 白 12% · 14px/500 · #FAFAFA（非品牌色） */}
            <button
              type="button"
              onClick={() => void createNewProject()}
              className="inline-flex h-10 items-center gap-1 rounded-[12px] bg-[rgba(255,255,255,0.12)] px-3 text-sm font-medium text-[#FAFAFA] transition-colors hover:bg-[rgba(255,255,255,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isCreatingProject}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5l0 14" />
                <path d="M5 12l14 0" />
              </svg>
              {t('新建')}
            </button>

            <PopupCloseButton ariaLabel={t('关闭项目库')} onClick={requestClose} />
          </div>
        </header>

        <main
          inert={deleteTarget ? true : undefined}
          aria-hidden={deleteTarget ? true : undefined}
          className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2"
        >
          {/* 网格 — TapNow 官方：gap 16px，1600 宽下 5 列 × 271px */}
          <div className={`grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 ${view === 'list' ? 'hidden' : ''}`}>
            {/* 「新建项目」磁贴 —— 官方放在网格**首位**：外层是卡片外壳（#1F1F1F / radius 16px / p-2），
                内嵌一块 radius 12px、bg rgba(43,43,43,.3)（悬停 .5）的块，居中 ⊕ + 文案。
                点击语义也对齐官方：**直接创建项目**，不弹表单、不填名字
                （官方该磁贴是个 cursor-pointer 的 div + 单个 click 监听，整页没有任何 dialog）。 */}
            {!query.trim() ? (
              <button
                type="button"
                onClick={() => void createNewProject()}
                disabled={isCreatingProject}
                className="group flex min-h-[220px] flex-col items-center justify-center overflow-hidden rounded-2xl bg-[#1F1F1F] p-2 pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.3)] disabled:cursor-not-allowed"
              >
                <span className="flex w-full flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-[rgba(43,43,43,0.3)] transition-colors duration-300 group-hover:bg-[rgba(43,43,43,0.5)]">
                  {/* 官方实测：⊕ 40×40 圆 · bg rgb(250,250,250) · 里面的 plus 20×20 ·
                      stroke-width 3 · 颜色 rgb(31,31,31) · hover scale-110（0.3s） */}
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FAFAFA] text-[#1F1F1F] transition-transform duration-300 group-hover:scale-110">
                    {isCreatingProject ? (
                      <Icon icon="mdi:loading" width="20" height="20" className="animate-spin" aria-hidden="true" />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 5l0 14" />
                        <path d="M5 12l14 0" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-[#F5F5F5]">{isCreatingProject ? t('创建中') : t('新建项目')}</span>
                </span>
              </button>
            ) : null}

            {visibleProjects.map((project) => {
              const isCurrent = project.id === activeProjectId;
              const isEditingName = renameTargetId === project.id;
              const isFolder = folderProjectIds.has(project.id);
              return (
                <div
                  key={project.id}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ project, x: event.clientX, y: event.clientY });
                  }}
                  className={`group relative overflow-hidden rounded-2xl bg-[#1F1F1F] ${isFolder
                      // 官方文件夹卡：outline 1px 白 8%（内缩）· padding 8px（四边）
                      ? 'p-2 outline outline-1 -outline-offset-1 outline-[rgba(255,255,255,0.08)]'
                      // 官方项目卡：border 1px 白 10% · padding 8px 8px 0
                      : 'border border-[rgba(255,255,255,0.1)] p-2 pb-0'
                    }`}
                >
                  <button
                    type="button"
                    data-project-library-card
                    aria-label={t('打开项目 {name}', { name: project.name })}
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={() => openProject(project.id)}
                    disabled={isEditingName || isRenaming}
                    className="block w-full overflow-hidden rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(255,255,255,0.3)]"
                  >
                    {/* 剧集自己没有画布，缩略图取点开后会看到的那一集 */}
                    <ProjectSnapshotPreview
                      folder={folderProjectIds.has(project.id)}
                      seed={project.id}
                      snapshot={project.snapshot
                        ?? projects.find((item) => item.id === resolveOpenTargetId(projects, project.id))?.snapshot}
                    />
                  </button>

                  {/* 卡片动作 — 官方位置：卡片右上内缩 16px，28×28 · radius 10px · bg 黑 50% ·
                      图标 16px 白 80% · 默认 opacity 0，悬停卡片淡入（0.2s）。
                      定位放在**外层 div**：tooltip.css 的 `[data-tooltip]{position:relative}`
                      会把按钮自身的 `absolute` 覆盖成 `relative`，right/top 就退化成相对偏移了。 */}
                  <div className="absolute right-4 top-4 z-30">
                    <button
                      type="button"
                      aria-label={t('项目操作')}
                      data-tooltip={t('项目操作')}
                      aria-haspopup="menu"
                      disabled={isEditingName || isRenaming}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        setContextMenu({ project, x: rect.right, y: rect.bottom + 4 });
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-[rgba(0,0,0,0.5)] p-1.5 text-[rgba(255,255,255,0.8)] opacity-0 transition-opacity duration-200 hover:bg-[rgba(0,0,0,0.7)] focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100 disabled:cursor-not-allowed"
                    >
                      {/* 官方图标 = tabler dots-vertical（竖排三点 · stroke 2 · 三个 r=1 圆），
                          内联原样，避免依赖图标集是否已打包 */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                        <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                        <path d="M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                      </svg>
                    </button>
                  </div>

                  {isEditingName ? (
                    <form onSubmit={(event) => void submitRenameProject(event)} className="flex min-h-14 items-center gap-1.5 px-2">
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">{t('项目名称')}</span>
                        <input
                          autoFocus
                          value={renameProjectName}
                          onChange={(event) => setRenameProjectName(event.target.value)}
                          onFocus={(event) => event.currentTarget.select()}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelRenameProject();
                            }
                          }}
                          disabled={isRenaming}
                          className="h-8 w-full rounded-[10px] bg-[rgba(255,255,255,0.08)] px-2 text-xs text-[#F5F5F5] outline-none focus:ring-2 focus:ring-[rgba(255,255,255,0.2)] disabled:opacity-60"
                        />
                      </label>
                      <button
                        type="submit"
                        aria-label={t('保存项目名称')}
                        data-tooltip={t('保存')}
                        disabled={!renameProjectName.trim() || isRenaming}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#F5F5F5] transition-colors hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Icon icon={isRenaming ? 'mdi:loading' : 'mdi:check'} width="17" height="17" className={isRenaming ? 'animate-spin' : undefined} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('取消重命名')}
                        data-tooltip={t('取消')}
                        disabled={isRenaming}
                        onClick={cancelRenameProject}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-text-tertiary transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                      >
                        <Icon icon="mdi:close" width="17" height="17" aria-hidden="true" />
                      </button>
                    </form>
                  ) : isFolder ? (
                    <>
                      {/* 官方文件夹卡专属两层（项目卡没有）：
                          ① 底部 45% 高的模糊带 —— backdrop-filter: blur(10px) + 波浪形 mask，z-10
                          ② 浮在模糊带之上的元信息 overlay —— left/right 16px · bottom 8px，z-20 */}
                      <div
                        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
                        style={{
                          height: '45%',
                          transition: 'height 300ms ease-out',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          mask: FOLDER_BLUR_MASK,
                          WebkitMask: FOLDER_BLUR_MASK,
                        }}
                      >
                        <svg
                          className="absolute inset-0"
                          width="100%"
                          height="100%"
                          viewBox="0 0 284 116"
                          preserveAspectRatio="none"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path d={FOLDER_BLUR_PATH} fill="rgba(89, 103, 107, 0.3)" />
                        </svg>
                      </div>
                      <div className="absolute bottom-2 left-4 right-4 z-20">
                        <div className="flex flex-col gap-1">
                          <div className="group/name flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openProject(project.id)}
                              className="min-w-0 truncate text-left text-sm font-semibold text-[#FAFAFA] transition-colors hover:text-white focus-visible:outline-none"
                            >
                              {project.name}
                            </button>
                            <button
                              type="button"
                              aria-label={t('重命名项目 {name}', { name: project.name })}
                              onClick={() => beginRenameProject(project)}
                              className="shrink-0 p-0.5 text-[#7A7A7A] opacity-0 transition-opacity duration-150 hover:text-[#FAFAFA] focus-visible:opacity-100 focus-visible:outline-none group-hover/name:opacity-100"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
                                <path d="M13.5 6.5l4 4" />
                                <path d="M16 19h6" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-xs text-[#A3A3A3]">
                            <span>{formatProjectTimestamp(project.updatedAt, t)}</span>
                            <span className="text-[10px]">
                              {t('{count} 个项目', { count: folderChildCounts.get(project.id) ?? 0 })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* 官方用一层不可见 sizer 撑出 48px，让绝对定位的元信息有位置 */}
                      <div className="h-12" aria-hidden="true" />
                    </>
                  ) : (
                    <div className="flex h-14 items-center px-1">
                      <div className="group/name min-w-0 flex-1">
                        <div className="flex min-w-0 items-center">
                          <button
                            type="button"
                            onClick={() => openProject(project.id)}
                            className="min-w-0 truncate text-left text-sm font-semibold leading-5 text-[#FAFAFA] focus-visible:outline-none"
                          >
                            {project.name}
                          </button>
                          {isCurrent ? (
                            <span className="ml-2 shrink-0 rounded bg-[rgba(255,255,255,0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[#F5F5F5]">{t('当前')}</span>
                          ) : null}
                          {/* 名称旁铅笔 — 官方实测：18×18（p-0.5 + 14×14 图标）· 灰 #7A7A7A ·
                              默认 opacity 0，悬停名称才淡入（.15s）· 图标 tabler pencil-minus */}
                          <button
                            type="button"
                            aria-label={t('重命名项目 {name}', { name: project.name })}
                            onClick={() => beginRenameProject(project)}
                            className="ml-1.5 shrink-0 p-0.5 text-[#7A7A7A] opacity-0 transition-opacity duration-150 hover:text-[#FAFAFA] focus-visible:opacity-100 focus-visible:outline-none group-hover/name:opacity-100"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
                              <path d="M13.5 6.5l4 4" />
                              <path d="M16 19h6" />
                            </svg>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => openProject(project.id)}
                          className="mt-1 block text-left text-xs leading-4 text-[#7A7A7A] focus-visible:outline-none"
                        >
                          {formatProjectTimestamp(project.updatedAt, t)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          </div>

          {/* 列表视图 — 官方：外层 bg 白 5% · radius 16px；表头 6 列 72/1fr/120/150/180/180 · gap 24px；
              行高 72 · 缩略图 72×48 · radius 12px */}
          {view === 'list' ? (
            <div className="flex flex-col overflow-hidden rounded-2xl bg-[rgba(255,255,255,0.05)]">
              <div className="px-4 pt-5">
                <div className="flex items-center">
                  <div className="shrink-0" style={{ width: 32 }} />
                  <div
                    className="grid flex-1 items-center gap-6 pl-4 pr-14 text-sm text-[#A3A3A3]"
                    style={{ gridTemplateColumns: '72px 1fr 120px 150px 180px 180px' }}
                  >
                    <div>{t('预览')}</div>
                    <div>{t('名称')}</div>
                    <div>{t('类型')}</div>
                    <div>{t('内容')}</div>
                    <div>{t('创建时间')}</div>
                    <div>{t('最近更新')}</div>
                  </div>
                </div>
                <div className="mx-12 mr-4 mt-4 border-b border-[rgba(255,255,255,0.1)]" />
              </div>
              <div className="flex flex-col px-4 pb-5">
                {visibleProjects.map((project) => {
                  const isFolder = folderProjectIds.has(project.id);
                  return (
                    <div
                      key={project.id}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setContextMenu({ project, x: event.clientX, y: event.clientY });
                      }}
                      className="group flex items-center"
                    >
                      <div className="shrink-0" style={{ width: 32 }} />
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openProject(project.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openProject(project.id);
                          }
                        }}
                        className="grid flex-1 cursor-pointer items-center gap-6 rounded-xl py-3 pl-4 pr-14 transition-colors hover:bg-[rgba(255,255,255,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.2)]"
                        style={{ gridTemplateColumns: '72px 1fr 120px 150px 180px 180px' }}
                      >
                        <div className="h-12 w-[72px] overflow-hidden">
                          <ProjectSnapshotPreview
                            fill
                            folder={isFolder}
                            seed={project.id}
                            snapshot={project.snapshot
                              ?? projects.find((item) => item.id === resolveOpenTargetId(projects, project.id))?.snapshot}
                          />
                        </div>
                        <div className="truncate text-sm font-semibold text-[#FAFAFA]">{project.name}</div>
                        <div className="text-sm text-[#A3A3A3]">{isFolder ? t('文件夹') : t('项目')}</div>
                        <div className="text-sm text-[#A3A3A3]">
                          {isFolder ? t('{count} 个项目', { count: folderChildCounts.get(project.id) ?? 0 }) : ''}
                        </div>
                        <div className="text-sm text-[#A3A3A3]">{formatAbsoluteTime(project.createdAt)}</div>
                        <div className="text-sm text-[#A3A3A3]">{formatProjectTimestamp(project.updatedAt, t)}</div>
                      </div>
                      <button
                        type="button"
                        aria-label={t('项目操作')}
                        data-tooltip={t('项目操作')}
                        aria-haspopup="menu"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          setContextMenu({ project, x: rect.right, y: rect.bottom + 4 });
                        }}
                        className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-[rgba(255,255,255,0.8)] opacity-0 transition-opacity duration-200 hover:bg-[rgba(255,255,255,0.08)] focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                          <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                          <path d="M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {visibleProjects.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-text-text-tertiary">
                <Icon icon="mdi:folder-search-outline" width="22" height="22" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-sm font-medium text-foreground">{t('没有找到项目')}</h3>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-3 h-8 rounded-md border border-border bg-card px-3 text-xs text-text-text-secondary transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('清除搜索')}
              </button>
            </div>
          ) : null}
        </main>

        {contextMenu ? createPortal(
          <div
            className="fixed inset-0 z-[260]"
            onMouseDown={() => setContextMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu(null);
            }}
          >
            <div
              role="menu"
              aria-label={t('项目操作')}
              style={calcFixedPosition(contextMenu.x, contextMenu.y, PROJECT_MENU_WIDTH, PROJECT_MENU_HEIGHT)}
              onMouseDown={(event) => event.stopPropagation()}
              className="fixed w-[136px] overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.1)] bg-[#262626] p-1"
            >
              <ProjectMenuItem
                label={t('打开项目')}
                onClick={() => openProject(contextMenu.project.id)}
              />
              <ProjectMenuItem
                label={t('打开项目文件夹')}
                onClick={() => {
                  void openProjectFolder(contextMenu.project);
                  setContextMenu(null);
                }}
              />
              <div role="separator" className="-mx-1 my-1 h-px bg-[rgba(255,255,255,0.1)]" />
              <ProjectMenuItem
                label={t('重命名')}
                ariaLabel={t('重命名项目 {name}', { name: contextMenu.project.name })}
                onClick={() => {
                  beginRenameProject(contextMenu.project);
                  setContextMenu(null);
                }}
              />
              <ProjectMenuItem
                label={t('创建副本')}
                ariaLabel={t('复制项目 {name}', { name: contextMenu.project.name })}
                disabled={duplicatingId !== null}
                onClick={() => {
                  void runDuplicateProject(contextMenu.project);
                  setContextMenu(null);
                }}
              />
              <ProjectMenuItem
                label={t('导出项目包')}
                ariaLabel={t('导出项目 {name}', { name: contextMenu.project.name })}
                disabled={exportingId !== null || isImporting}
                onClick={() => {
                  void runExportProject(contextMenu.project);
                  setContextMenu(null);
                }}
              />
              {canDeleteProject(contextMenu.project) ? (
                <>
                  <div role="separator" className="-mx-1 my-1 h-px bg-[rgba(255,255,255,0.1)]" />
                  <ProjectMenuItem
                    label={t('删除项目')}
                    ariaLabel={t('删除项目 {name}', { name: contextMenu.project.name })}
                    danger
                    onClick={() => {
                      setDeleteTarget(contextMenu.project);
                      setContextMenu(null);
                    }}
                  />
                </>
              ) : null}
            </div>
          </div>,
          document.body,
        ) : null}

        {deleteTarget ? (
          <div
            data-tauri-drag-region
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isDeleting) setDeleteTarget(null);
            }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-project-title"
              aria-describedby="delete-project-description"
              initial={{ opacity: 0, scale: 0.97, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-sm rounded-lg border border-border bg-secondary p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                  <Icon icon="mdi:alert-outline" width="21" height="21" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 id="delete-project-title" className="text-sm font-semibold text-foreground">{t('删除“{name}”？', { name: deleteTarget.name })}</h3>
                  <p id="delete-project-description" className="mt-1.5 text-xs leading-5 text-text-text-secondary">
                    {t('项目画布及本地项目数据将被删除，此操作不可撤销。')}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="h-9 rounded-md px-3.5 text-xs text-text-text-secondary transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {t('取消')}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => void confirmDeleteProject()}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-red-500 px-3.5 text-xs font-medium text-white transition-colors hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeleting ? <Icon icon="mdi:loading" width="16" height="16" className="animate-spin" aria-hidden="true" /> : null}
                  {isDeleting ? t('正在删除') : t('确认删除')}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </div>
    </ModalOverlay>
  );
}
