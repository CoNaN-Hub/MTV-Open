/**
 * AssetsPanel 资产管理面板 — 浏览项目文件 + 全局资产库（永久），支持：
 *  · 添加本地文件（拷贝到全局 {baseDataDir}/file）/ 文件夹（递归引用，不拷贝）
 *  · 搜索（名称 + 标签）、分类与标签筛选
 *  · 手动为文件打标签（持久化到 IndexedDB assetMeta）
 * 性能：useDeferredValue 搜索 + useMemo 过滤 + 增量渲染（IntersectionObserver）+ 图片懒加载，
 *       并移除了大列表下昂贵的逐项 layout 动画。
 */
import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useDeferredValue,
  type DragEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import {
  listProjectFiles,
  listGlobalFiles,
  listExternalFolderFiles,
  saveAssetToPermanent,
  deletePermanentFile,
  extractFilesFromNodeData,
  CATEGORY_LABELS,
  type AssetFileEntry,
  type FileCategory,
} from '../services/fileService';
import { getAllAssetMeta, putAssetMeta, deleteAssetMeta } from '../services/indexedDbService';
import { startAssetDrag, prepareDragIcon } from '../utils/assetDrag';
import { ALL_CATEGORIES, CATEGORY_ICONS, shortFolderName } from '../utils/assetFormat';
import AssetThumb from './shared/AssetThumb';
import { LibraryTopRows, LibraryFolderRow } from './assets/LibraryFolderRows';
import { libraryRootOrder, libraryFolderDir } from './assets/libraryFolderPaths';
import { LibraryAssetRow } from './assets/LibraryAssetRow';
import { listLibraryFolderContents, createLibraryFolder } from '../services/assetRowActions';
/* 官方「AI 角色」药丸图标（`library.aiCharacter`，官方 15×15 自绘 SVG 原文，见第 2 轮采集） */
import aiCharacterIcon from '../assets/official-icons/lib-ai-character.svg?raw';
/* 官方子视图（收藏 / 主体库）头部与卡片图标（官方 16/18/28 尺寸，逐字移植） */
import {
  FavChevronLeftIcon, FavLayoutGridIcon, FavListIcon,
  ElementChevronLeftIcon, ElementLayoutGridIcon, ElementPlus28Icon,
} from './assets/LibraryViewIcons';
/* 官方菜单原文 SVG（添加菜单两项 + 文件夹⋯六项；脚本从 9444 实测 dump 抽取生成） */
import { MenuFolderArrow14Icon, MenuFolderPlus14Icon } from './assets/LibraryMenuIcons';
/* 官方「AI角色库」全屏弹窗（药丸触发；数据 `src/data/aiRoleCatalog.ts` = 官方实测抽取） */
import { AiRoleLibraryDialog } from './assets/AiRoleLibraryDialog';
import Select from './shared/Select';
import { springSmooth, fadeFast } from '../utils/motion';
import { countUnreadDramaAssets } from '../store/store.dramaAssets';
import { distributeToColumns } from './assets/waterfallColumns';
import { getNodeTypeConfig } from '../types';
import CanvasNodeCardContent from './assets/CanvasNodeCardContent';
import { useResourceVideoPreview } from '../hooks/useResourceVideoPreview';

const DramaAssetsPanel = lazy(() => import('./DramaAssetsPanel'));

/** 仅磁盘真实文件可拖拽（排除节点引用的 node:// / virtual:// 虚拟路径）*/
function isDraggableEntry(file: AssetFileEntry): boolean {
  return !!file.path && !file.path.startsWith('node://') && !file.path.startsWith('virtual://');
}

type FileTabKey = 'project' | 'permanent';
type TabKey = FileTabKey | 'drama' | 'nodes';

/** 单页渲染数量（增量加载步长）— 限制 DOM 规模 */
const PAGE_SIZE = 48;
/** 标签筛选行最多展示的标签数 */
const MAX_TAG_CHIPS = 24;
const MIN_WATERFALL_COLUMNS = 2;
const MAX_WATERFALL_COLUMNS = 6;
const DEFAULT_WATERFALL_COLUMNS = 3;

function normalizeWaterfallColumns(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_WATERFALL_COLUMNS;
  return Math.min(MAX_WATERFALL_COLUMNS, Math.max(MIN_WATERFALL_COLUMNS, Math.round(value)));
}

function assetKey(file: AssetFileEntry): string {
  return file.assetId ?? file.path;
}

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springSmooth },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: fadeFast },
};

export default function AssetsPanel() {
  const reduceMotion = useReducedMotion();
  const {
    assetsPanelOpen,
    assetsPanelMode,
    setAssetsPanelOpen,
    dramaAssetsPanelOpen,
    setDramaAssetsPanelOpen,
    markDramaAssetsViewed,
    unreadDramaAssetCount,
    currentProjectId,
    projects,
    assetFolders,
    assetWaterfallColumns,
    updateConfig,
    saveConfig,
  } =
    useAppStore(
      useShallow((s) => ({
        assetsPanelOpen: s.assetsPanelOpen,
        assetsPanelMode: s.assetsPanelMode,
        setAssetsPanelOpen: s.setAssetsPanelOpen,
        dramaAssetsPanelOpen: s.dramaAssetsPanelOpen,
        setDramaAssetsPanelOpen: s.setDramaAssetsPanelOpen,
        markDramaAssetsViewed: s.markDramaAssetsViewed,
        unreadDramaAssetCount: countUnreadDramaAssets(s.dramaAssets),
        dramaAssetCount:
          s.dramaAssets.characters.length
          + s.dramaAssets.scenes.length
          + s.dramaAssets.props.length,
        canvasNodeCount: s.nodes.length,
        currentProjectId: s.currentProjectId,
        projects: s.projects,
        assetFolders: s.config.assetFolders,
        assetWaterfallColumns: s.config.assetWaterfallColumns,
        updateConfig: s.updateConfig,
        saveConfig: s.saveConfig,
      })),
    );

  const [activeTab, setActiveTab] = useState<FileTabKey>('permanent');
  const [nodeListOpen, setNodeListOpen] = useState(false);
  const visibleTab: TabKey = dramaAssetsPanelOpen ? 'drama' : nodeListOpen ? 'nodes' : activeTab;
  const isNodeList = visibleTab === 'nodes';
  // 只在节点页订阅标识和内容；移动节点不改变 data，避免位置更新重绘整个资产面板。
  const canvasNodeIds = useAppStore(useShallow((s) => assetsPanelOpen && isNodeList ? s.nodes.map((node) => node.id) : []));
  const canvasNodeData = useAppStore(useShallow((s) => assetsPanelOpen && isNodeList ? s.nodes.map((node) => node.data) : []));
  // 项目文件 Tab 查看的项目；null 表示「跟随当前项目」（关闭时复位，故每次打开默认当前项目）
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FileCategory | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [nodeSearch, setNodeSearch] = useState('');
  const deferredNodeSearch = useDeferredValue(nodeSearch);
  const isDrawer = assetsPanelMode === 'drawer';
  const waterfallColumns = isDrawer ? DEFAULT_WATERFALL_COLUMNS : normalizeWaterfallColumns(assetWaterfallColumns);

  const [projectFiles, setProjectFiles] = useState<AssetFileEntry[]>([]);
  const [permanentFiles, setPermanentFiles] = useState<AssetFileEntry[]>([]);
  // 标签 Map（path -> tags），作为标签的唯一真相源，编辑时只更新它，避免重新读盘
  const [tagMap, setTagMap] = useState<Record<string, string[]>>({});

  const [loading, setLoading] = useState(false);
  const [busy] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [filterRowExpanded, setFilterRowExpanded] = useState(false);
  const [filterRowOverflow, setFilterRowOverflow] = useState(false);
  const [visibleFilterItemCount, setVisibleFilterItemCount] = useState(Number.POSITIVE_INFINITY);
  const filterRowRef = useRef<HTMLDivElement | null>(null);
  const filterListRef = useRef<HTMLDivElement | null>(null);
  const loadRequestRef = useRef(0);

  /* ★ 官方面板右侧有**改宽把手**（`w-3 cursor-col-resize`）⇒ 宽度可拖（默认 320 = 官方实测值） */
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('assets-panel-width'));
    return Number.isFinite(saved) && saved >= 280 && saved <= 720 ? saved : 320;
  });
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = { x: e.clientX, width: panelWidth };
    const onMove = (ev: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const next = Math.min(720, Math.max(280, start.width + (ev.clientX - start.x)));
      setPanelWidth(next);
    };
    const onUp = () => {
      resizeStartRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setPanelWidth((w) => {
        localStorage.setItem('assets-panel-width', String(w));
        return w;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  /* ★ 官方「添加」按钮在**头部**（32×32 · r8 · bg white/10 · 图标态），不在搜索行里
     ⇒ 把 MTV 原来的「添加」下拉控件抽出来，画布面板放进头部、抽屉态仍留在工具栏（同一份 JSX） */
  const renderAddControl = () => (

    <div className="assets-add-wrap" ref={addWrapRef}>
      <motion.button
        type="button" className="assets-add-btn" disabled={busy}
        onClick={() => setAddMenuOpen((v) => !v)}
        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        添加
      </motion.button>
      <AnimatePresence>
        {addMenuOpen && (
          <motion.div
            className="assets-add-menu"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96, transition: fadeFast }}
            transition={springSmooth}
          >
            {/* 官方 `gQ` 的两项（逐字）：`library.upload`「上传」/ `library.createFolder`「新建文件夹」，
                各自带 `size-5` 图标槽；图标是官方**自绘 14×14 / viewBox 0 0 20 20**
                （上传 = folder+ 带 `<g transform="translate(3.5,2)">`；新建文件夹 = 带箭头文件夹）
                —— 官方原文 SVG 由 `LibraryMenuIcons.tsx` 从 9444 实测 dump 抽取，勿手改 */}
            <button type="button" onClick={handleAddFiles}>
              <span className="lib-menu-icon"><MenuFolderPlus14Icon /></span>
              {'上传'}
            </button>
            <button type="button" onClick={handleAddFolder}>
              <span className="lib-menu-icon"><MenuFolderArrow14Icon /></span>
              {'新建文件夹'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // 同一组件在两种展示方式之间复用；每次从画布打开时跟随当前项目。
  const presentation = assetsPanelOpen ? assetsPanelMode : null;
  const [previousPresentation, setPreviousPresentation] = useState(presentation);
  const [motionMode, setMotionMode] = useState(assetsPanelMode);
  if (presentation !== previousPresentation) {
    setPreviousPresentation(presentation);
    if (presentation) setMotionMode(presentation);
    if (presentation === 'drawer') {
      setActiveTab('project');
      setNodeListOpen(false);
      setNodeSearch('');
      setSelectedProjectId(null);
      setSearch('');
      setActiveCategory(null);
      setActiveTag(null);
      setVisibleCount(PAGE_SIZE);
      setFilterRowExpanded(false);
      setEditingPath(null);
      setAddMenuOpen(false);
    }
  }

  const folders = useMemo(() => assetFolders ?? [], [assetFolders]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  }, []);

  const adjustWaterfallColumns = useCallback((delta: number) => {
    const current = normalizeWaterfallColumns(useAppStore.getState().config.assetWaterfallColumns);
    const next = normalizeWaterfallColumns(current + delta);
    if (next === current) return;
    updateConfig({ assetWaterfallColumns: next });
    void saveConfig({ silent: true }).catch(() => toast('列数设置保存失败'));
  }, [saveConfig, toast, updateConfig]);

  // 载入标签元数据 → Map
  const loadTags = useCallback(async () => {
    try {
      const metas = await getAllAssetMeta();
      const map: Record<string, string[]> = {};
      for (const m of metas) if (m.tags?.length) map[m.assetId] = m.tags;
      setTagMap(map);
    } catch { /* ignore */ }
  }, []);

  // 载入文件列表（按 Tab 聚合）
  const loadFiles = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const isCurrentRequest = () => requestId === loadRequestRef.current
      && currentProjectId === useAppStore.getState().currentProjectId;
    setLoading(true);
    try {
      if (activeTab === 'project') {
        const viewProjectId = selectedProjectId ?? currentProjectId;
        if (!viewProjectId) { setProjectFiles([]); return; }
        const diskFiles = await listProjectFiles(viewProjectId);
        if (!isCurrentRequest()) return;
        const known = new Set(diskFiles.map((f) => f.path));
        const nodeEntries: AssetFileEntry[] = [];
        // 仅当查看的是「当前项目」时，才并入画布上尚未落盘的节点文件
        // （store.nodes 始终是当前项目的画布，其他项目无法从内存取节点）
        if (viewProjectId === currentProjectId) {
          for (const node of useAppStore.getState().nodes) {
            const entry = extractFilesFromNodeData(node.data as Record<string, unknown>);
            if (entry && !known.has(entry.path)) { nodeEntries.push(entry); known.add(entry.path); }
          }
        }
        setProjectFiles([...diskFiles, ...nodeEntries]);
      } else {
        // 永久 = 全局 file 目录 + 登记的外部文件夹（递归）
        const [globalFiles, folderFiles] = await Promise.all([
          listGlobalFiles(),
          listExternalFolderFiles(folders),
        ]);
        if (!isCurrentRequest()) return;
        const seen = new Set<string>();
        const merged: AssetFileEntry[] = [];
        for (const f of [...globalFiles, ...folderFiles]) {
          if (seen.has(f.path)) continue;
          seen.add(f.path);
          merged.push(f);
        }
        setPermanentFiles(merged);
      }
    } catch { /* ignore */ } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, [activeTab, currentProjectId, selectedProjectId, folders]);

  const libraryRevision = useAppStore((s) => s.libraryRevision);
  useEffect(() => {
    if (assetsPanelOpen) {
      // 异步读取外部文件和 IndexedDB 标签；setState 发生在 Promise 完成后。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadFiles().then(loadTags);
      void prepareDragIcon();
    }
    return () => { loadRequestRef.current += 1; };
  }, [assetsPanelOpen, loadFiles, loadTags]);

  useEffect(() => {
    if (!assetsPanelOpen || visibleTab !== 'drama') return;
    if (unreadDramaAssetCount > 0 || useAppStore.getState().dramaAssets.lastViewedAt === undefined) {
      markDramaAssetsViewed();
    }
  }, [assetsPanelOpen, markDramaAssetsViewed, unreadDramaAssetCount, visibleTab]);

  const handleClose = useCallback(() => {
    setSelectedProjectId(null); // 复位项目选择，下次打开默认当前项目
    setFilterRowExpanded(false);
    setAssetsPanelOpen(false);
  }, [setAssetsPanelOpen]);

  const handleLocateNode = useCallback((nodeId: string) => {
    const focusNode = () => {
      const state = useAppStore.getState();
      if (state.currentProjectId !== currentProjectId) return;
      if (!state.nodes.some((node) => node.id === nodeId)) {
        toast('节点已不存在');
        return;
      }
      // 与历史记录共用画布定位与放大回弹；左侧面板保留，方便连续查看。
      window.dispatchEvent(new CustomEvent('canvas-focus-node', { detail: { nodeId, pulse: true } }));
    };
    if (isDrawer) {
      focusNode();
    } else {
      handleClose();
      setTimeout(focusNode, 300);
    }
  }, [currentProjectId, handleClose, isDrawer, toast]);

  // 拖拽文件到画布：dragstart 内同步发起原生拖拽，并立即隐藏弹窗露出画布
  const handleCardDragStart = useCallback((file: AssetFileEntry, e: DragEvent) => {
    if (!isDraggableEntry(file)) return;
    e.preventDefault();
    startAssetDrag(file);
    setAssetsPanelOpen(false);
  }, [setAssetsPanelOpen]);

  // Esc 关闭
  useEffect(() => {
    if (!assetsPanelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // 抽屉之上的确认框/选择器先消费 Esc，避免连带关闭资产库。
      if (isDrawer && document.querySelector('[aria-modal="true"], [role="listbox"], dialog[open]')) return;
      handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [assetsPanelOpen, handleClose, isDrawer]);

  // 点击外部关闭「添加」菜单
  const addWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!addMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (addWrapRef.current && !addWrapRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [addMenuOpen]);

  // 原始文件（按 Tab）
  const rawFiles = activeTab === 'project' ? projectFiles : permanentFiles;

  // 合并标签（useMemo，标签变化时不动文件数组）
  const files = useMemo(
    () => rawFiles.map((f) => (tagMap[assetKey(f)] ? { ...f, tags: tagMap[assetKey(f)] } : f)),
    [rawFiles, tagMap],
  );

  // 分类计数
  const categoryCounts = useMemo(() => {
    const c: Record<FileCategory, number> = { image: 0, video: 0, audio: 0, text: 0, other: 0 };
    for (const f of files) c[f.category]++;
    return c;
  }, [files]);

  // 标签计数（用于筛选 chip）
  const tagList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of files) for (const t of f.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_TAG_CHIPS);
  }, [files]);

  const listedCategories = useMemo(
    () => ALL_CATEGORIES.filter((category) => categoryCounts[category] > 0),
    [categoryCounts],
  );

  const measureFilterRowOverflow = useCallback(() => {
    const row = filterRowRef.current;
    const list = filterListRef.current;
    if (!row || !list) return;

    const rowStyle = window.getComputedStyle(row);
    const availableWidth = row.clientWidth
      - (Number.parseFloat(rowStyle.paddingLeft) || 0)
      - (Number.parseFloat(rowStyle.paddingRight) || 0);
    const rowGap = Number.parseFloat(rowStyle.columnGap) || 0;
    const listGap = Number.parseFloat(window.getComputedStyle(list).columnGap) || 0;
    const items = Array.from(list.children) as HTMLElement[];
    const itemWidths = items.map((item) => {
      const itemStyle = window.getComputedStyle(item);
      return item.getBoundingClientRect().width
        + (Number.parseFloat(itemStyle.marginLeft) || 0)
        + (Number.parseFloat(itemStyle.marginRight) || 0);
    });
    const contentWidth = itemWidths.reduce((total, width) => total + width, 0)
      + Math.max(0, items.length - 1) * listGap;
    const hasOverflow = contentWidth > availableWidth + 1;

    setFilterRowOverflow(hasOverflow);
    if (!hasOverflow) {
      setVisibleFilterItemCount(items.length);
      setFilterRowExpanded(false);
      return;
    }
    if (filterRowExpanded) {
      setVisibleFilterItemCount(items.length);
      return;
    }

    const collapsedWidth = availableWidth - 28 - rowGap;
    let usedWidth = 0;
    let visibleCount = 0;
    for (const width of itemWidths) {
      const nextWidth = usedWidth + (visibleCount > 0 ? listGap : 0) + width;
      if (nextWidth > collapsedWidth) break;
      usedWidth = nextWidth;
      visibleCount++;
    }
    if (items[visibleCount - 1]?.hasAttribute('data-filter-separator')) visibleCount--;
    setVisibleFilterItemCount(visibleCount);
  }, [filterRowExpanded]);

  useEffect(() => {
    if (!assetsPanelOpen || visibleTab === 'drama' || visibleTab === 'nodes') return;
    const row = filterRowRef.current;
    if (!row) return;

    const frame = window.requestAnimationFrame(measureFilterRowOverflow);
    const resizeObserver = new ResizeObserver(measureFilterRowOverflow);
    resizeObserver.observe(row);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [assetsPanelOpen, categoryCounts, measureFilterRowOverflow, tagList, visibleTab]);

  // 过滤（分类 + 标签 + 搜索）
  const filteredFiles = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return files.filter((f) => {
      if (activeCategory && f.category !== activeCategory) return false;
      if (activeTag && !(f.tags ?? []).includes(activeTag)) return false;
      if (q) {
        const inName = f.name.toLowerCase().includes(q);
        const inTags = (f.tags ?? []).some((t) => t.toLowerCase().includes(q));
        if (!inName && !inTags) return false;
      }
      return true;
    });
  }, [files, activeCategory, activeTag, deferredSearch]);

  const visibleFiles = useMemo(() => filteredFiles.slice(0, visibleCount), [filteredFiles, visibleCount]);

  const filteredNodes = useMemo(() => {
    const query = deferredNodeSearch.trim().toLowerCase();
    return canvasNodeIds.map((id, index) => {
      const data = canvasNodeData[index];
      const config = getNodeTypeConfig(data.type);
      const label = data.label?.trim() || data.fileName?.trim() || config.label;
      return { id, label, displayId: data.displayId, config, data };
    }).filter((node) => !query || [node.label, node.config.label, node.id, node.displayId === undefined ? '' : `#${node.displayId}`]
      .some((value) => value.toLowerCase().includes(query)));
  }, [canvasNodeData, canvasNodeIds, deferredNodeSearch]);
  const videoPreview = useResourceVideoPreview(
    JSON.stringify([assetsPanelOpen, assetsPanelMode, currentProjectId, visibleTab, selectedProjectId, search, nodeSearch, activeCategory, activeTag]),
    isNodeList ? filteredNodes.map((node) => node.id) : visibleFiles.map(assetKey),
  );
  const totalResultCount = isNodeList ? filteredNodes.length : filteredFiles.length;

  // 无限滚动哨兵
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount((c) => (c < totalResultCount ? c + PAGE_SIZE : c));
      }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [totalResultCount, visibleCount, visibleTab]);

  // ── 添加文件 / 文件夹 ──
  /* ★ 官方「添加 → 上传」是**两步**（9444 实测 t822-C2）：
     ① 先弹 `library.selectFolder`「选择文件夹」对话框（`z2`：个人/团队 + 文件夹树 + 取消/确认）
     ② 确认后才走系统文件选择，并把文件落到所选文件夹
     ⇒ MTV 原来直接 `addAssetFilesToGlobal()` 选文件（跳过了第 ① 步）✗ */
  const handleAddFiles = useCallback(() => {
    setAddMenuOpen(false);
    useAppStore.getState().openLibraryFolderPicker({ mode: 'upload' });
  }, []);

  /* 官方「添加 ── 新建文件夹」：**不是**给 MTV 添加监视文件夹，而是在文件夹列表**最上方插入一行内联输入**
     （9444 实测 t822-C3：新建行 h32 `flex h-8 items-center pr-1` + `paddingLeft:6`，
      输入框 `h-8 w-full px-3 py-1 rounded-lg border-white/10 bg-white/[0.04] text-sm`，
      下方 6 个文件夹整体下移 32px，收藏/主体库行不动）。 */
  const [rootCreateOpen, setRootCreateOpen] = useState(false);
  const [rootCreateDraft, setRootCreateDraft] = useState('');
  /* 官方文件夹列表来自后端（可含用户新建的根文件夹）；MTV 顶层是固定的官方六个名字 ⇒
     新建成功的根文件夹进 store（`libraryExtraRoots`），素材库面板与「选择文件夹」对话框共享同一份。 */
  const extraRootFolders = useAppStore((s) => s.libraryExtraRoots);
  /* ★ 磁盘上真实存在的根文件夹（官方列表 = 后端返回的全部根文件夹；MTV 之前只渲染固定六个 ⇒
     用户自己的文件夹重启后就不见了）。这里把磁盘根目录并入列表（官方固定分类除外）。 */
  const diskRootFolders = useAppStore((s) => s.libraryDiskRoots);
  const libRootNames = useMemo(
    () => libraryRootOrder([...extraRootFolders, ...diskRootFolders]),
    [extraRootFolders, diskRootFolders],
  );
  const handleAddFolder = useCallback(() => {
    setAddMenuOpen(false);
    setRootCreateDraft('');
    setRootCreateOpen(true);
  }, []);
  /* `confirmRootCreate` 定义在 `loadLibraryFiles` 之后（依赖它刷新素材） */

  const handleRemoveFolder = useCallback(async (path: string) => {
    updateConfig({ assetFolders: folders.filter((f) => f !== path) });
    try { await saveConfig(); } catch { return; }
    if (activeTab === 'permanent') await loadFiles();
  }, [folders, updateConfig, saveConfig, activeTab, loadFiles]);

  // ── 全局资产 / 删除 ──
  const handleSavePermanent = useCallback(async (file: AssetFileEntry) => {
    const dest = await saveAssetToPermanent(file);
    toast(dest ? `已保存: ${file.name}` : '保存失败');
    if (dest && activeTab === 'permanent') await loadFiles();
  }, [activeTab, loadFiles, toast]);

  const handleDeletePermanent = useCallback(async (file: AssetFileEntry) => {
    await deletePermanentFile(file.path);
    setPermanentFiles((prev) => prev.filter((f) => f.path !== file.path));
    toast(`已删除: ${file.name}`);
  }, [toast]);

  // ── 标签编辑（手动）──
  const persistTags = useCallback(async (assetId: string, path: string, tags: string[]) => {
    setTagMap((prev) => {
      const next = { ...prev };
      if (tags.length) next[assetId] = tags; else delete next[assetId];
      return next;
    });
    try {
      if (tags.length) await putAssetMeta({ assetId, path, tags, taggedBy: 'manual', updatedAt: Date.now() });
      else await deleteAssetMeta(assetId);
    } catch { /* ignore */ }
  }, []);

  const addTag = useCallback((file: AssetFileEntry, raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    const key = assetKey(file);
    const cur = tagMap[key] ?? [];
    if (cur.includes(tag)) return;
    persistTags(key, file.path, [...cur, tag]);
  }, [tagMap, persistTags]);

  const removeTag = useCallback((file: AssetFileEntry, tag: string) => {
    const key = assetKey(file);
    persistTags(key, file.path, (tagMap[key] ?? []).filter((t) => t !== tag));
  }, [tagMap, persistTags]);

  const switchTab = useCallback((tab: TabKey) => {
    setNodeListOpen(tab === 'nodes');
    if (tab === 'drama') {
      setDramaAssetsPanelOpen(true);
    } else {
      if (tab !== 'nodes') setActiveTab(tab);
      setDramaAssetsPanelOpen(false);
    }
    setActiveCategory(null);
    setActiveTag(null);
    setEditingPath(null);
    setVisibleCount(PAGE_SIZE);
  }, [setDramaAssetsPanelOpen]);

  /* ★ 官方文件夹行点击：`角色/场景/道具` = MTV 创作资产（drama）里管理的那三类 ⇒ 切到该 tab；
     官方另外三个（风格/音效/Others）与「收藏」MTV 无后端 ⇒ 只高亮（内容区仍显示当前列表） */
  const [expandedLibraryFolders, setExpandedLibraryFolders] = useState<string[]>([]);
  const toggleLibraryFolder = useCallback((folder: string) => {
    setExpandedLibraryFolders((prev) => (prev.includes(folder) ? prev.filter((f) => f !== folder) : [...prev, folder]));
  }, []);

  /* ★ 官方面板是**多视图**（`data-library-view="library" | "favorite" | "element-library"`）：
       · library        = 收藏行 / 主体库行 / 文件夹树 / 素材列表（默认）
       · favorite       = 点「收藏」进入（官方 `vQ`）：独立视图 + 返回 + 网格/列表切换 + 空态「暂无收藏」
       · element-library= 点「主体库」进入（官方 `yQ`）：独立视图 + 返回 + 网格切换 + 「新建主体」卡
     ⚠️ 按用户要求：**面板内不接入 MTV 原有功能**（不打开 MTV 角色库、不做 MTV 本地星标），
        一律照官方结构与文案渲染；MTV 没有的资产/收藏后端 ⇒ 对应视图显示官方空态。 */
  const [space, setSpace] = useState<'private' | 'team'>('private');
  const [libView, setLibView] = useState<'library' | 'favorite' | 'element-library'>('library');
  /* 官方收藏视图右侧的**网格 / 列表**切换（官方默认 grid：`bg-white/10` 高亮在网格按钮上） */
  const [favMode, setFavMode] = useState<'grid' | 'list'>('grid');
  /* 官方「AI 角色」药丸 → 全屏「AI角色库」弹窗（`AiRoleLibraryDialog`，门户到 body） */
  const [aiRoleOpen, setAiRoleOpen] = useState(false);

  /* 官方内容区数据源 = 素材库全部文件（`listGlobalFiles()`）；展开某个文件夹时把它的素材**内联成子行**
     （官方 `LX` 的 `kind:'asset'`），不再有 MTV 自己的独立列表 */
  const [libraryFiles, setLibraryFiles] = useState<AssetFileEntry[]>([]);
  const loadLibraryFiles = useCallback(async () => {
    try { setLibraryFiles(await listGlobalFiles()); } catch { /* 忽略 */ }
  }, []);
  /* 画布侧对话框（上传/保存/移动/副本）落盘后 `libraryRevision` +1 ⇒ 面板重读素材库文件
     ⚠️ 放进 async 回调里：effect 同步体里直接调会被 `react-hooks/set-state-in-effect` 判错
        （`loadLibraryFiles` 内部 setState），行为不变（仍是本次 effect 触发的一次重读）。 */
  useEffect(() => {
    if (!assetsPanelOpen || isDrawer) return;
    void (async () => { await loadLibraryFiles(); })();
  }, [assetsPanelOpen, isDrawer, libraryRevision, loadLibraryFiles]);
  /** 重读磁盘上的根文件夹（官方 = 后端返回的根文件夹列表） */
  const loadDiskRoots = useCallback(async () => {
    try {
      const c = await listLibraryFolderContents('');
      useAppStore.getState().setLibraryDiskRoots(c.folders);
    } catch { /* 忽略 */ }
  }, []);
  useEffect(() => {
    if (assetsPanelOpen && !isDrawer) void loadDiskRoots();
  }, [assetsPanelOpen, isDrawer, libraryRevision, loadDiskRoots]);
  /** 官方「添加 → 新建文件夹」的确认：建目录 + 立刻出现在列表里（官方后端行为等价） */
  const confirmRootCreate = useCallback(async () => {
    const name = rootCreateDraft.trim();
    setRootCreateOpen(false);
    if (!name) return;
    try {
      await createLibraryFolder(name);
      useAppStore.getState().addLibraryRoot(name);
      await loadLibraryFiles();
      await loadDiskRoots();
      toast(`已新建文件夹「${name}」`);
    } catch { toast('新建文件夹失败'); }
  }, [rootCreateDraft, loadLibraryFiles, loadDiskRoots, toast]);

  /* 子文件夹缓存：原来是 `useRef` + `bump` 计数强制重渲染 —— 渲染期读 `ref.current`
     会被 `react-hooks/refs` 判为错误（且缓存变化依赖额外的 bump 状态）。改成 state 后
     行为完全一致（写入即重渲染），也去掉了一个隐藏状态。 */
  const [libFolderChildren, setLibFolderChildren] = useState<Record<string, { folders: string[]; fileCount: number }>>({});
  const ensureFolderChildren = useCallback(async (path: string) => {
    const contents = await listLibraryFolderContents(path);
    setLibFolderChildren((prev) => ({ ...prev, [path]: contents }));
  }, []);
  const renderLibFolder = (path: string, label: string, depth: number): React.ReactNode => {
    const expanded = expandedLibraryFolders.includes(path);
    const contents = libFolderChildren[path] ?? { folders: [], fileCount: 0 };
    const kids = contents.folders;
    /* 官方 `LX`：展开的文件夹里，**该文件夹的素材**作为内联子行（缩进 `Aw(depth+1) = 6+(depth+1)*28+34`） */
    const assets = expanded
      ? libraryFiles.filter((f) => {
        const rel = (f.relativePath || f.name);
        return rel.startsWith(`${path}/`) && !rel.slice(path.length + 1).includes('/');
      })
      : [];
    return (
      <LibraryFolderRow
        key={path}
        label={label}
        path={path}
        depth={depth}
        expanded={expanded}
        /* 官方空态行（`DX`）渲染条件（源码 `U2`）：
           `children.length === 0 && !assets.length` ⇒ **既无子文件夹、也无素材**，且仅在该文件夹展开时 */
        showEmpty={kids.length === 0 && assets.length === 0}
        onChanged={() => {
          setLibFolderChildren((prev) => ({ ...prev, [path]: { folders: [], fileCount: 0 } }));
          void ensureFolderChildren(path);
          void loadFiles();
          useAppStore.getState().bumpLibraryRevision();
        }}
        onToggle={() => {
          toggleLibraryFolder(path);
          if (!expanded) void ensureFolderChildren(path);
        }}
      >
        {kids.map((kid) => renderLibFolder(`${path}/${kid}`, kid, depth + 1))}
        {/* 官方 `kind:'asset'`：`<div className="h-8" style={{paddingLeft: Aw(depth)}}><Iw …/></div>`
            —— 素材行紧跟在子文件夹之后内联（不再有 MTV 自己的独立列表） */}
        {assets.map((file) => (
          <div className="lib-tree-asset" key={`asset-${assetKey(file)}`} style={{ paddingLeft: 6 + (depth + 1) * 28 + 34 }}>
            <LibraryAssetRow
              file={file}
              subtitle={file.relativePath && file.relativePath !== file.name ? file.relativePath : undefined}
              draggable={isDraggableEntry(file)}
              onDragStart={(e) => handleCardDragStart(file, e)}
              onChanged={() => { void loadFiles(); void loadTags(); void loadLibraryFiles(); void ensureFolderChildren(path); }}
              keyword={search}
            />
          </div>
        ))}
      </LibraryFolderRow>
    );
  };

  // 与右侧助手面板保持相同的弹簧节奏，左侧抽屉镜像进退方向。
  const drawerTransition = reduceMotion
    ? { duration: 0.12 }
    : { type: 'spring' as const, visualDuration: 0.35, bounce: 0 };
  // 关闭时保留 AnimatePresence，让面板完成退场后再卸载。
  const panel = (
    <AnimatePresence>
      {assetsPanelOpen && (
        <>
          <div className={`assets-panel-wrapper${isDrawer ? ' assets-panel-wrapper--drawer' : ''}`}>
            {/* ★ 官方**没有**面板遮罩：素材库是非模态侧栏 ⇒ 面板与画布**互不影响**（面板开着照样能操作画布）。
                MTV 原来这层是 `pointer-events:auto` 的全屏遮罩 ⇒ 把画布全挡了（用户实测反馈 1）。
                关闭面板走「返回 ‹」（官方行为）与 Esc。 */}
            <motion.div
              data-resource-video-boundary
              className={`assets-panel${isDrawer ? ' assets-panel--drawer' : ''}`}
              /* 官方面板根的属性（源码 `{"data-library-panel":!0}`）—— 搜索框的 ↑/↓ 键盘导航靠它定位；
                 `data-space` = 个人/团队（团队在 MTV 无后端 ⇒ 内容区留空）
                 `data-lib-view` = 当前视图（library/favorite/element-library）——
                   官方是三个 `data-library-view` 容器叠放，MTV 用根属性驱动「原内容淡出左移 + 子视图滑入」 */
              data-space={space}
              data-lib-view={isDrawer ? undefined : libView}
              data-library-panel
              role={isDrawer ? 'region' : 'dialog'}
              aria-label={isDrawer ? '资产库快捷面板' : '资产管理'}
              aria-modal={isDrawer ? undefined : true}
              variants={isDrawer ? {
                hidden: { opacity: 0, x: reduceMotion ? 0 : '-100%' },
                visible: { opacity: 1, x: 0, transition: drawerTransition },
                exit: { opacity: 0, x: reduceMotion ? 0 : '-100%', transition: drawerTransition },
              } : panelVariants}
              initial="hidden" animate="visible" exit="exit"
              onClick={(e) => e.stopPropagation()}
              style={isDrawer ? undefined : { width: panelWidth }}
            >
              {/* 右侧改宽把手 —— 官方 `absolute right-0 top-0 bottom-0 z-50 w-3 cursor-col-resize`
                  + 三点 3×3 `rounded-full bg-white/40`，默认 `opacity-0`（hover 才显形） */}
              <div
                className="assets-resize-handle"
                role="separator"
                aria-orientation="vertical"
                aria-label="调整素材库宽度"
                onMouseDown={handleResizeStart}
              >
                <span><i /><i /><i /></span>
              </div>

              {/* Header —— 官方 `xQ` 逐字：`flex w-full items-center gap-1.5` =
                  [返回 ‹] [标题 20/600/28 + letter-spacing -0.6px] [AI 角色药丸] [添加 ＋]
                  官方**没有** × 关闭按钮 ⇒ 画布面板用最左的「返回」承担关闭（官方 `onClose`） */}
              <div className="assets-panel-header">
                {!isDrawer && (
                  <button
                    type="button"
                    className="lib-header-back"
                    aria-label="返回"
                    data-tooltip="返回"
                    onClick={handleClose}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 6l-6 6l6 6" />
                    </svg>
                  </button>
                )}
                <h2 className="assets-panel-title">
                  {/* 官方标题逐字 = 「素材库」（`text-xl font-semibold leading-7` = 20/600/28） */}
                  {isDrawer ? '资产库' : '素材库'}
                </h2>
                {/* ★ 官方头部第 3 件 = 「AI 角色」药丸，是一个**独立 button**（不是标题里的 span）：
                    `flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-sm
                     bg-white/10 px-2.5 py-0.5 text-white/88 hover:bg-white/[0.14]`
                    + `<span class="flex size-4 …">` 内 15×15 自绘图标 + `<span class="whitespace-nowrap
                     text-xs font-medium leading-5">AI 角色</span>`
                    （9444 实测 t843：x208 y77 81×32 · r8 · pad 2/10 · gap6 · 图标槽 16×16 · 文本 12/500/20）
                    ⚠️ 官方点它 = 打开全屏「AI角色库」，见下方 `aiRoleOpen`。 */}
                {!isDrawer && (
                  <button
                    type="button"
                    className="lib-pill"
                    aria-label="AI 角色"
                    /* 官方点它 = 打开全屏「AI角色库」弹窗（`role=dialog` · z-200 inset-20 ·
                       bg rgba(8,8,8,.72) blur56 + z-199 背板 rgba(0,0,0,.5) blur8）。
                       弹窗本体 `AiRoleLibraryDialog`（门户到 body），数据来自 `src/data/aiRoleCatalog.ts`。 */
                    onClick={() => setAiRoleOpen(true)}
                  >
                    <span className="lib-pill-icon" dangerouslySetInnerHTML={{ __html: aiCharacterIcon }} />
                    <span className="lib-pill-label">{'AI 角色'}</span>
                  </button>
                )}
                {/* ★ 官方头部第 4 件 = 「添加」按钮（32×32 · r8 · bg white/10，图标态） */}
                {!isDrawer && renderAddControl()}
                {isDrawer ? (
                  <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={handleClose} aria-label="收起资产库">
                    收起 <kbd>Tab</kbd>
                  </button>
                ) : null}{/* 官方头部无 × 关闭（关闭由最左「返回」承担） */}
              </div>

              {/* ★★ 官方分段控件 = **个人 / 团队**（`fT`：`library.private` / `library.team`，2 项）
                  ⚠️ 用户裁定「面板内不要 MTV 原有的」⇒ MTV 的 4 个 tab
                     （项目文件 / 全局资产 / 创作资产 / 节点列表）**整块删除** ✗
                  样式仍用官方实测的 303×37 · r16 · pad4 · gap4 · bg white/.1 · 选中 bg white/.12 + blur28
                  （`switchTab` 仍在：个人 ⇒ 本地素材库；团队 ⇒ MTV 无云端 space 后端 ⇒ 空态） */}
              <div className="assets-tabs">
                {(['private', 'team'] as const).map((sp) => (
                  <motion.button
                    key={sp} type="button"
                    role="tab"
                    aria-selected={space === sp}
                    className={`assets-tab ${space === sp ? 'active' : ''}`}
                    onClick={() => {
                      setSpace(sp);
                      if (sp === 'private') switchTab('permanent');
                    }}
                    whileHover={{ scale: space === sp ? 1 : 1.03 }} whileTap={{ scale: 0.97 }}
                  >
                    {sp === 'private' ? '个人' : '团队'}
                  </motion.button>
                ))}
              </div>

              {/* ★ 官方结构：搜索是**独立整行**（303×32 · radius 全圆 · pad 4px 12px 4px 34px），
                  不属于 tabs 那一行 ⇒ 这里把 MTV 原来的 `.assets-toolbar`（项目选择 + 搜索 + 列数）
                  从 `.assets-tabs` 里**移出来**单独成行（原来在 grid 里 → 517px 溢出到面板外 ✗）。 */}
              <div className="assets-panel-toolbar-row">
                {/* Toolbar: 搜索 + 添加 */}
              {visibleTab !== 'drama' ? <div className="assets-toolbar">
                {visibleTab === 'project' && (
                  <Select
                    className="assets-project-select-wrap"
                    triggerClassName="assets-project-select"
                    value={selectedProjectId ?? currentProjectId ?? ''}
                    onChange={(value) => setSelectedProjectId(value || null)}
                    options={projects.map((p) => ({
                      value: p.id,
                      label: p.id === currentProjectId ? `${p.name}（当前）` : p.name,
                    }))}
                  />
                )}
                <div className="assets-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text" placeholder={isNodeList ? '搜索节点名称、类型或编号…' : '搜索'}
                    value={isNodeList ? nodeSearch : search}
                    onChange={(e) => { (isNodeList ? setNodeSearch : setSearch)(e.target.value); setVisibleCount(PAGE_SIZE); }}
                    /* ★ 官方 `RB`(`KJ`) 的键盘行为（`zoom-slider` @3122324 逐字）：
                         Escape → blur ｜ ArrowDown → 聚焦内容区第一个按钮 ｜ ArrowUp → 聚焦当前选中的 tab */
                    onKeyDown={(e) => {
                      const el = e.currentTarget;
                      if (e.key === 'Escape') { el.blur(); return; }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        el.closest('[data-library-panel]')?.querySelector('[data-library-content]')
                          ?.querySelector('button')?.focus();
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        el.closest('[data-library-panel]')?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
                      }
                    }}
                  />
                  {(isNodeList ? nodeSearch : search) && (
                    <button type="button" className="assets-search-clear" onClick={() => { (isNodeList ? setNodeSearch : setSearch)(''); setVisibleCount(PAGE_SIZE); }} aria-label="清空">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
                {!isDrawer && !isNodeList && <div className="assets-column-stepper" role="group" aria-label="瀑布流列数">
                  <Icon icon="lucide:columns-3" className="assets-column-stepper-icon" aria-hidden="true" />
                  <button
                    type="button"
                    aria-label="减少瀑布流列数"
                    disabled={waterfallColumns <= MIN_WATERFALL_COLUMNS}
                    onClick={() => adjustWaterfallColumns(-1)}
                  >
                    <Icon icon="lucide:minus" aria-hidden="true" />
                  </button>
                  <output aria-label={`当前 ${waterfallColumns} 列`}>{waterfallColumns}</output>
                  <button
                    type="button"
                    aria-label="增加瀑布流列数"
                    disabled={waterfallColumns >= MAX_WATERFALL_COLUMNS}
                    onClick={() => adjustWaterfallColumns(1)}
                  >
                    <Icon icon="lucide:plus" aria-hidden="true" />
                  </button>
                </div>}
                {visibleTab === 'permanent' && isDrawer && renderAddControl()}
              </div> : null}
              </div>

              {/* ★ 官方「内容区」分组（源码 `xQ`）：
                  ```html
                  <div data-library-content class="min-h-0 min-w-0 w-full flex-1 …">
                    <div class="flex h-full min-h-0 flex-col">
                      <div class="shrink-0 pr-3">                        ← 固定区（pr-3 = 12px）
                        <div class="flex flex-col gap-1 pl-1">           ← 组内间距 4px、缩进 4px
                          [收藏行] [主体库行] [1px 分隔线 px-1 py-1] [「文件夹」标题 px-2 py-1]
                        </div>
                      </div>
                      <div class="min-h-0 flex-1"> …虚拟列表(pr-3)… </div>   ← 与固定区**紧贴**，无间距
                  ```
                  · 固定区与文件夹列表之间**没有间距**（不是面板的 12px gap）⇒ MTV 用 `.lib-content` 包住两者。
                  · 9444 实测（t834/t836）纵向栈：组 x25 y214 w291 h109（pl-1 4px / gap 4px）
                    收藏行 x29 y214 287×28 · 主体库行 x29 y246 287×28 · 分隔线块 x29 y278 287×9
                    （线体 x33 y282 w279 h1）· 标题块 x29 y291 287×**32**（pad 4px 8px，文字 x37）· 首行 y323。 */}
              {!isDrawer && !isNodeList && visibleTab !== 'drama' && (
                <div className="lib-content">
                  <div className="lib-fixed-top">
                    <LibraryTopRows onOpenFavorite={() => setLibView('favorite')}
                    onOpenSubjectLibrary={() => setLibView('element-library')} />
                    <div className="assets-lib-sep" aria-hidden="true" />
                    <div className="assets-lib-section-title">{'文件夹'}</div>
                  </div>
                  <div className="lib-folder-list">
                    {/* 官方 `LX` 的 `kind:'create-folder'` 行：`<div className="flex h-8 items-center pr-1"
                        style={{paddingLeft: G2(depth)}}>` + 输入框（depth 0 ⇒ paddingLeft 6）。
                        只在文件夹列表**最上方**插入，其余文件夹整体下移 32px（官方实测行为）。 */}
                    {rootCreateOpen ? (
                      <div className="lib-create-row" style={{ paddingLeft: 6 }}>
                        <input
                          className="lib-create-input"
                          autoFocus
                          /* 官方 `Hi`：聚焦时全选（新建时值为空，等价无操作） */
                          onFocus={(e) => e.currentTarget.select()}
                          value={rootCreateDraft}
                          onChange={(e) => setRootCreateDraft(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') { e.preventDefault(); await confirmRootCreate(); }
                            else if (e.key === 'Escape') { e.preventDefault(); setRootCreateDraft(''); setRootCreateOpen(false); }
                          }}
                          /* 官方 `Hi`：**失焦即提交**（空值则取消，不建空名文件夹） */
                          onBlur={() => { if (rootCreateDraft.trim()) void confirmRootCreate(); else { setRootCreateDraft(''); setRootCreateOpen(false); } }}
                        />
                      </div>
                    ) : null}
                    {/* 官方文件夹树：递归渲染 + 按 depth 缩进（G2(depth)=6+depth*28）
                        ★ 根文件夹顺序（9444 实测 t956）：角色 → **用户新建的根文件夹（按创建顺序）** → 场景/道具/风格/音效/Others */}
                    {libRootNames.map((folder) => renderLibFolder(libraryFolderDir(folder), folder, 0))}
                  </div>
                </div>
              )}

              {isNodeList ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pt-2">
                  {filteredNodes.length === 0 ? (
                    <div className="assets-empty">
                      <Icon icon="lucide:workflow" width="32" height="32" aria-hidden="true" />
                      <span>{nodeSearch.trim() ? '没有匹配的节点' : '当前画布暂无节点'}</span>
                    </div>
                  ) : (
                    <>
                      <ul className="flex flex-col gap-1.5" aria-label="当前画布节点">
                        {filteredNodes.slice(0, visibleCount).map((node) => (
                          <li key={node.id} data-node-id={node.id} className="ui-card assets-node-card p-2">
                            <div className="flex items-center gap-2">
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${node.config.color} ${node.config.bg}`}>
                                <Icon icon={node.config.icon} width="18" height="18" aria-hidden="true" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs text-foreground" title={node.label}>{node.label}</p>
                                <p className="truncate text-[11px] text-text-text-tertiary">
                                  {node.displayId !== undefined && <span>#{node.displayId} · </span>}{node.config.label}
                                </p>
                              </div>
                              <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm shrink-0"
                                aria-label={`查看节点 ${node.label}`} onClick={() => handleLocateNode(node.id)}>
                                查看节点
                              </button>
                            </div>
                            <CanvasNodeCardContent nodeId={node.id} data={node.data} projectId={currentProjectId} connectable={isDrawer}
                              videoExpanded={videoPreview.expandedId === node.id}
                              onVideoExpandedChange={(expanded) => videoPreview.setExpanded(expanded ? node.id : null)} />
                          </li>
                        ))}
                      </ul>
                      {visibleCount < filteredNodes.length && (
                        <div ref={sentinelRef} className="assets-load-sentinel">
                          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>加载更多节点</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : visibleTab === 'drama' ? (
                <Suspense
                  fallback={(
                    <div className="flex flex-1 items-center justify-center text-xs text-text-text-tertiary">
                      正在加载短剧资产...
                    </div>
                  )}
                >
                  <DramaAssetsPanel compact={isDrawer} />
                </Suspense>
              ) : (
                <>
              {/* 已添加的外部文件夹 */}
              {activeTab === 'permanent' && folders.length > 0 && (
                <div className="assets-folder-row">
                  {folders.map((f) => (
                    <span key={f} className="assets-folder-chip">
                      📁 {shortFolderName(f)}
                      <button type="button" onClick={() => handleRemoveFolder(f)} aria-label="移除">×</button>
                    </span>
                  ))}
                </div>
              )}

              {/* 分类 + 标签筛选 */}
              <div
                ref={filterRowRef}
                className={`assets-category-row ${filterRowExpanded ? 'expanded' : ''}`}
              >
                <div ref={filterListRef} id="assets-filter-list" className="assets-category-list">
                  <button
                    type="button"
                    className={`assets-cat-chip ${activeCategory === null ? 'active' : ''} ${filterRowExpanded || visibleFilterItemCount > 0 ? '' : 'assets-filter-item-hidden'}`}
                    onClick={() => { setActiveCategory(null); setVisibleCount(PAGE_SIZE); }}
                  >
                    全部<span className="assets-cat-count">{files.length}</span>
                  </button>
                  {listedCategories.map((cat, index) => (
                    <button
                      key={cat} type="button"
                      className={`assets-cat-chip ${activeCategory === cat ? 'active' : ''} ${filterRowExpanded || index + 1 < visibleFilterItemCount ? '' : 'assets-filter-item-hidden'}`}
                      onClick={() => { setActiveCategory(cat); setVisibleCount(PAGE_SIZE); }}
                    >
                      {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                      <span className="assets-cat-count">{categoryCounts[cat]}</span>
                    </button>
                  ))}
                  {tagList.length > 0 && (
                    <span
                      data-filter-separator
                      className={`assets-chip-sep ${filterRowExpanded || listedCategories.length + 1 < visibleFilterItemCount ? '' : 'assets-filter-item-hidden'}`}
                    />
                  )}
                  {tagList.map(([tag, count], index) => (
                    <button
                      key={tag} type="button"
                      className={`assets-cat-chip assets-tag-chip ${activeTag === tag ? 'active' : ''} ${filterRowExpanded || listedCategories.length + index + 2 < visibleFilterItemCount ? '' : 'assets-filter-item-hidden'}`}
                      onClick={() => { setActiveTag((t) => (t === tag ? null : tag)); setVisibleCount(PAGE_SIZE); }}
                    >
                      #{tag}<span className="assets-cat-count">{count}</span>
                    </button>
                  ))}
                </div>
                {filterRowOverflow && (
                  <button
                    type="button"
                    className="assets-filter-more"
                    aria-controls="assets-filter-list"
                    aria-expanded={filterRowExpanded}
                    aria-label={filterRowExpanded ? '收起标签' : '展开更多标签'}
                    title={filterRowExpanded ? '收起标签' : '更多标签'}
                    onClick={() => setFilterRowExpanded((expanded) => !expanded)}
                  >
                    <Icon icon={filterRowExpanded ? 'lucide:chevron-up' : 'lucide:ellipsis'} aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* ★★ 官方内容区 = **文件夹树（素材作为内联子行）** —— 不再有 MTV 自己的独立列表 ✗
                  官方 `LX` 的行分发（逐字）：
                    kind 'folder' → `<MX depth …/>`
                    kind 'asset'  → `<div className="h-8" style={{paddingLeft: Aw(depth)}}><Iw asset …/></div>`
                    kind 'load-more' / 空 → `PX` / `DX`
                  ⇒ 素材行的缩进用 `Aw(depth) = 6 + depth*28 + 34`；外层 `h-8`（32px 行距）
                  搜索时显示官方「搜索结果」行（`hQ` 的 `searchResults`） */}
              {!isDrawer && !isNodeList && search.trim() ? (
                <div className="lib-search-results" data-library-content>
                  {libraryFiles
                    .filter((f) => (f.relativePath || f.name).toLowerCase().includes(search.trim().toLowerCase()))
                    .map((file) => (
                      <div className="lib-tree-asset" key={assetKey(file)} style={{ paddingLeft: 40 }}>
                        <LibraryAssetRow
                          file={file}
                          subtitle={file.relativePath && file.relativePath !== file.name ? file.relativePath : undefined}
                          draggable={isDraggableEntry(file)}
                          onDragStart={(e) => handleCardDragStart(file, e)}
                          onChanged={() => { void loadFiles(); void loadTags(); void loadLibraryFiles(); }}
                          keyword={search}
                        />
                      </div>
                    ))}
                </div>
              ) : null}

              {/* 文件瀑布流 */}
              <div className="assets-file-scroll-shell" style={!isDrawer && !isNodeList ? { display: 'none' } : undefined}>
                <div className="assets-file-scroll">
                  <div className="assets-file-waterfall" data-columns={waterfallColumns}>
                    {loading ? (
                      <div className="assets-empty">
                        <motion.div className="assets-spinner" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }} />
                        <span>加载中...</span>
                      </div>
                    ) : filteredFiles.length === 0 ? (
                      <div className="assets-empty">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                        <span>{search || activeCategory || activeTag ? '没有匹配的文件' : activeTab === 'project' ? '暂无项目文件' : '暂无文件，点击「添加」导入'}</span>
                      </div>
                    ) : (
                      <>
                        <div className="assets-waterfall-cols">
                          {distributeToColumns(visibleFiles, waterfallColumns).map((column, columnIndex) => (
                            <div className="assets-waterfall-col" key={columnIndex}>
                              {column.map((file) => (
                                <AssetCard
                                  key={assetKey(file)}
                                  file={file}
                                  isProject={activeTab === 'project'}
                                  draggable={isDraggableEntry(file)}
                                  onDragStart={(e) => handleCardDragStart(file, e)}
                                  editing={editingPath === assetKey(file)}
                                  tagDraft={editingPath === assetKey(file) ? tagDraft : ''}
                                  onToggleEdit={() => { const key = assetKey(file); setEditingPath((p) => (p === key ? null : key)); setTagDraft(''); }}
                                  onTagDraftChange={setTagDraft}
                                  onAddTag={(t) => { addTag(file, t); setTagDraft(''); }}
                                  onRemoveTag={(t) => removeTag(file, t)}
                                  onSave={() => handleSavePermanent(file)}
                                  onDelete={() => handleDeletePermanent(file)}
                                  videoExpanded={videoPreview.expandedId === assetKey(file)}
                                  onVideoExpandedChange={(expanded) => videoPreview.setExpanded(expanded ? assetKey(file) : null)}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                        {visibleCount < filteredFiles.length && (
                          <div ref={sentinelRef} className="assets-load-sentinel">加载更多…</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
                </>
              )}

              {/* Toast */}
              <AnimatePresence>
                {toastMsg && (
                  <motion.div
                    className="assets-toast"
                    initial={{ opacity: 0, y: 12, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.92, transition: fadeFast }}
                    transition={springSmooth}
                  >
                    {toastMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ★★ 官方多视图（`data-library-view="library" | "favorite" | "element-library"`）★★
                  官方（9444 实测 t822/t823）：三视图**同时挂载**、`absolute inset-0` 叠放；切换 = 整块内容
                  「淡入 + 从 translateX(-20px) 滑到 0」（非当前视图 `opacity:0; translateX(-20px)`）。
                  · 切到子视图时，面板原内容（素材库头 / 个人·团队分段 / 搜索 / 文件夹树）整体淡出左移
                    （CSS `.assets-panel[data-lib-view='…'] > *`），子视图滑入覆盖 —— 与官方渲染结果一致。
                  · 子视图各有**自己的头部**：收藏 = 返回 + 「收藏」+ 网格/列表切换；
                    主体库 = 返回 + 「主体库」+ 网格切换（官方 `yQ`）。
                  ⚠️ 按用户要求：不接入 MTV 原有功能（不打开 MTV 角色库 / 不做 MTV 本地星标）。
                  · 收藏视图 = 官方头部 + 官方空态「暂无收藏」（MTV 无收藏后端）
                  · 主体库视图 = 官方头部 + 官方「新建主体」卡（MTV 无元素库后端） */}
              {!isDrawer ? (
                <>
                  <div data-library-view="favorite" className="lib-view" aria-hidden={libView !== 'favorite'}>
                    <div className="lib-view-col">
                      <div className="lib-fav-header">
                        <div className="lib-fav-head-left">
                          <button type="button" className="lib-fav-back" aria-label="返回" onClick={() => setLibView('library')}>
                            <FavChevronLeftIcon />
                          </button>
                          <span className="lib-fav-title">{'收藏'}</span>
                        </div>
                        <div className="lib-fav-head-right">
                          <button
                            type="button"
                            className={`lib-fav-toggle${favMode === 'grid' ? ' is-active' : ''}`}
                            aria-label="网格视图"
                            aria-pressed={favMode === 'grid'}
                            onClick={() => setFavMode('grid')}
                          >
                            <FavLayoutGridIcon />
                          </button>
                          <button
                            type="button"
                            className={`lib-fav-toggle${favMode === 'list' ? ' is-active' : ''}`}
                            aria-label="列表视图"
                            aria-pressed={favMode === 'list'}
                            onClick={() => setFavMode('list')}
                          >
                            <FavListIcon />
                          </button>
                        </div>
                      </div>
                      <div className="lib-scroll">
                        <div className="lib-scroll-viewport">
                          <div className="lib-scroll-inner">
                            <div className="lib-fav-body">
                              {/* 官方空态：`flex items-center justify-center py-12 text-sm text-white/40`「暂无收藏」 */}
                              <div className="lib-subview-empty">{'暂无收藏'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    data-library-view="element-library"
                    className="lib-view lib-view--element"
                    aria-hidden={libView !== 'element-library'}
                  >
                    <div className="lib-view-col">
                      <div className="lib-el-header">
                        <div className="lib-el-head-left">
                          <button type="button" className="lib-el-back" aria-label="返回" onClick={() => setLibView('library')}>
                            <ElementChevronLeftIcon />
                          </button>
                          <span className="lib-el-title">{'主体库'}</span>
                        </div>
                        <button type="button" className="lib-el-toggle" aria-label="列表视图" aria-pressed="false">
                          <ElementLayoutGridIcon />
                        </button>
                      </div>
                      <div className="lib-scroll">
                        <div className="lib-scroll-viewport">
                          <div className="lib-scroll-inner">
                            <div className="lib-el-grid">
                              {/* ★ 官方 element library 的「新建主体」卡（`yQ` 视图里的入口）：
                                  原来这里是个**没有任何 onClick 的桩**；现接上官方 style 的
                                  `ElementEditorPanel`（与多选工具栏「新建主体」同一个面板）。
                                  ⚠️ 从面板进时**没有画布选区** ⇒ 传空数组（面板里可「本地上传」建参考图）；
                                     从工具栏进时传的是选中的可捕节点。 */}
                              <button type="button" className="lib-el-card" onClick={() => useAppStore.getState().openElementEditor([])}>
                                <span className="lib-el-thumb"><ElementPlus28Icon /></span>
                                <span className="lib-el-card-label">{'新建主体'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              {/* 官方「AI角色库」全屏弹窗（药丸触发；门户渲染到 body） */}
              {!isDrawer && aiRoleOpen ? <AiRoleLibraryDialog onClose={() => setAiRoleOpen(false)} /> : null}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  // 关闭 Action 会重置展示模式；保留上次打开的动效宿主，避免退场被中断。
  // 局部覆盖性能模式，仍尊重系统减少动态效果设置。
  return motionMode === 'drawer'
    ? <MotionConfig reducedMotion="user" transition={drawerTransition}>{panel}</MotionConfig>
    : createPortal(panel, document.body);
}

/* ============================================
   单个资产卡片（轻量，无 layout 动画）
   ============================================ */
interface AssetCardProps {
  file: AssetFileEntry;
  isProject: boolean;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  editing: boolean;
  tagDraft: string;
  onToggleEdit: () => void;
  onTagDraftChange: (v: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onSave: () => void;
  onDelete: () => void;
  videoExpanded?: boolean;
  onVideoExpandedChange?: (expanded: boolean) => void;
}

function AssetCard({
  file, isProject, draggable, onDragStart, editing, tagDraft,
  onToggleEdit, onTagDraftChange, onAddTag, onRemoveTag, onSave, onDelete,
  videoExpanded = false, onVideoExpandedChange,
}: AssetCardProps) {
  const tags = file.tags ?? [];
  return (
    <div
      className={`assets-waterfall-card anim-card-in${videoExpanded ? ' has-expanded-video' : ''}`}
      draggable={draggable && !videoExpanded}
      onDragStart={onDragStart}
    >
      <AssetThumb
        assetUrl={file.assetUrl}
        filePath={file.path}
        videoExpanded={videoExpanded}
        onVideoExpandedChange={onVideoExpandedChange}
        name={file.name}
        category={file.category}
        size={file.size}
        badge={file.source === 'folder' ? '外部' : undefined}
      >
        <CardActions isProject={isProject} onSave={onSave} onDelete={onDelete} onToggleEdit={onToggleEdit} />
      </AssetThumb>

      {(tags.length > 0 || editing) && (
        <div className="assets-card-tags">
          {tags.map((t) => (
            <span key={t} className="assets-card-tag">
              {t}
              {editing && <button type="button" onClick={() => onRemoveTag(t)} aria-label="移除标签">×</button>}
            </span>
          ))}
          {editing && (
            <input
              className="assets-tag-input" autoFocus value={tagDraft}
              placeholder="加标签…"
              onChange={(e) => onTagDraftChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddTag(tagDraft); } }}
              onBlur={() => { if (tagDraft.trim()) onAddTag(tagDraft); }}
            />
          )}
        </div>
      )}
      {!isProject && <div className="assets-card-name">{file.name}</div>}
    </div>
  );
}

function CardActions({ isProject, onSave, onDelete, onToggleEdit }: {
  isProject: boolean; onSave: () => void; onDelete: () => void; onToggleEdit: () => void;
}) {
  return (
    <div className="assets-card-actions">
      <button type="button" className="assets-card-action-btn" onClick={onToggleEdit}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      </button>
      {isProject ? (
        <button type="button" className="assets-card-action-btn" onClick={onSave}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      ) : (
        <button type="button" className="assets-card-action-btn assets-card-delete" onClick={onDelete}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
