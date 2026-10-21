/**
 * Header 顶部栏 — 左上角「画布导航」+ 右上角 `TopRightNav`。
 *
 * ★★ 2026 用户要求：左上角这一簇**1:1 对齐官方**（hover / 字体 / 点击逻辑 / 下拉菜单 /
 *    「新建画布」入口 / 默认名 `Untitled`），并**保留 MTV 自己的 logo（改成白色）**。
 *
 * 官方结构（活的官方页面实测，CDP 9222；CSS 逐字见 `styles/canvas-nav.css`）：
 *   button.brand-trigger[返回工作空间]（内含 24×24 logo）
 *   span.control-divider
 *   div.title-control
 *     span.title-rename-slot
 *       span.title-rename-surface          ← 重命名态才浮现（border 白18% / bg #101010）
 *       button.title-label-trigger[重命名画布] > span.title-label
 *     button.title-menu-trigger[切换画布] > svg.title-menu-chevron（打开时旋转 180°）
 *   ⚠️ pill 里**没有**「+ 新建画布」——它在**下拉页脚**（`CanvasSwitcherMenu` 的 `.project-create`）。
 *      用户明确：「『+』是 MTV 自己的 不要 不要」。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { useT } from '../i18n';
import TopRightNav from './TopRightNav';
import { setWorkspaceLandingTab } from './workspace/workspaceLanding';
import CanvasSwitcherMenu from './canvas/CanvasSwitcherMenu';
/* 品牌标（官方 artigine `LogoShader` 火焰动画版）。
   ★ 用户 2026：导航栏这枚也换成火焰动画并**放大**（24 → 32），
   **不要悬浮提示气泡**，点击行为不变（外层 `.brand-trigger` 按钮仍负责「返回工作空间」）
   ⇒ 不给 `onActivate`：组件只渲染一块带 hover 动画的表面，既不套按钮也不挂 `data-tooltip`。 */
import BrandFlameButton from './shared/BrandFlameButton';

/**
 * 官方 `page-DSy7Zc_d.js` 的 `is = {duration:.14,ease:[.22,1,.36,1]}` ——
 * 重命名底衬 `.title-rename-surface` 的淡入淡出（`motion.span animate={{opacity:i?1:0}}`），
 * 不是 CSS transition。`reduced` 时官方用 `{duration:0}`。
 */
const RENAME_SURFACE_TRANSITION = { duration: 0.14, ease: [0.22, 1, 0.36, 1] as const };

export default function Header() {
  const t = useT();
  const {
    projectName, renameProject, currentProjectId, isCreatingProject, setProjectLibraryOpen,
    setCharacterLibraryOpen,
  } = useAppStore(
    useShallow((s) => ({
      projectName: s.projectName,
      renameProject: s.renameProject,
      currentProjectId: s.currentProjectId,
      isCreatingProject: s.isCreatingProject,
      setProjectLibraryOpen: s.setProjectLibraryOpen,
      // 角色库入口从左侧竖条移到左上角导航（用户指示）
      setCharacterLibraryOpen: s.setCharacterLibraryOpen,
    })),
  );
  // 当前画布是一集时，名字前面挂上剧集名：「项目 4-第 1 集」。可编辑的仍然只有集名。
  const seriesName = useAppStore((s) => {
    const current = s.projects.find((project) => project.id === s.currentProjectId);
    return current?.parentId
      ? s.projects.find((project) => project.id === current.parentId)?.name ?? ''
      : '';
  });
  const openProjectLibrary = () => {
    // 官方：logo 落到**工作空间/项目列表**（`aria-label="返回工作空间"`）
    setWorkspaceLandingTab('projects');
    setProjectLibraryOpen(true);
  };

  /* ── 切换画布下拉（官方 `.project-menu`）── */
  const [menuOpen, setMenuOpen] = useState(false);
  /* ── 重命名态（官方 `.title-rename-slot[data-state=editing]` + `.title-rename-surface` 淡入）── */
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);
  /* 官方 Radix `onCloseAutoFocus` 里把焦点还给触发按钮 ⇒ MTV 也记着它 */
  const triggerRef = useRef<HTMLButtonElement>(null);
  /* 官方 `data-anchor-offset={ce}`：菜单左边缘 − 触发按钮左边缘（点击时量，render 里不读 ref） */
  const [anchorOffset, setAnchorOffset] = useState<number | undefined>(undefined);
  const reduceMotion = useReducedMotion() ?? false;

  const toggleMenu = useCallback(() => {
    const next = !menuOpen;
    if (next) {
      const trigger = triggerRef.current;
      const pill = trigger?.closest('.canvas-nav-bar');
      setAnchorOffset(trigger && pill
        ? Math.round(pill.getBoundingClientRect().left - trigger.getBoundingClientRect().left)
        : undefined);
    }
    setMenuOpen(next);
  }, [menuOpen]);

  useEffect(() => {
    if (!renaming) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [renaming]);

  /* 进入重命名态时才把草稿同步成当前名字（不在 effect 里 setState ⇒ 不做级联渲染） */
  const startRename = useCallback(() => {
    setDraft(projectName);
    setRenaming(true);
  }, [projectName]);

  const commitRename = useCallback(() => {
    const next = draft.trim();
    setRenaming(false);
    if (!next || next === projectName || !currentProjectId) return;
    void renameProject(currentProjectId, next);
  }, [draft, projectName, currentProjectId, renameProject]);

  return (
    <>
    <header
      data-tauri-drag-region
      /* ⚠️ 必须保持**内容宽度**（只用 left-4）——
         这条 header 自带 `bg rgb(23,23,23) · r13` 的独立胶囊背景，
         一旦加上 right-4/justify-between 就会被**拉满整宽**，
         左右两组就"连在一起"成一条长栏 ✗。
         官方顶栏是**各自独立的小胶囊**（左：logo+名称+⌄；右：0/社区/分享），**不连在一起**。
         所以右上角那组另起一个 `absolute top-4 right-4` 的容器（见文件末尾）。 */
      className="canvas-nav-bar absolute top-4 z-40 flex items-center select-none left-4"
      data-testid="canvas-header-control"
      /* 官方 page-DPdEgTS0.js：画廊打开时整个顶左簇左移飞出（CSS 在 nodes-pile.css） */
      data-pile-gallery-chrome="top-left"
    >
      {/* 品牌按钮 —— 官方 `brand-trigger control-button`（官方 29×28 · r8 · 内含 24×24 logo）
          ★ 用户 2026：logo 换成火焰动画版并放大到 **32**，按钮随之由 28 长到 **36**（画布胶囊本身 40 高）。
          ★ 用户：**不要悬浮提示气泡** ⇒ 火焰组件这里不给 `onActivate`，气泡由外层按钮的 aria-label 负责。
          点击行为不变：仍是「返回工作空间 / 我的项目」。
          官方属性逐条对齐：`data-testid=canvas-header-logo-button` / `aria-label=返回工作空间` */}
      <button
        type="button"
        onClick={openProjectLibrary}
        aria-label={t('返回工作空间')}
        data-testid="canvas-header-logo-button"
        className="brand-trigger control-button"
      >
        <span className="brand-mark-window" data-testid="canvas-header-logo-window" aria-hidden="true">
          <BrandFlameButton label={t('返回工作空间')} size={32} autoIgnite />
        </span>
      </button>

      {/* 官方 `.control-divider`：1×16 · margin 0 6 · bg rgb(47,47,47) */}
      <span className="control-divider" data-testid="canvas-header-divider-start" aria-hidden="true" />

      {/* 官方 `.title-control`（159 宽）= 重命名槽 + 切换按钮 */}
      <div className="title-control" data-testid="canvas-header-title-control">
        {/* 剧集名（MTV 自己的「剧集-集名」前缀；只读） */}
        {seriesName && (
          <span className="project-copy max-w-[110px] pr-1 text-text-text-secondary/70" title={seriesName}>
            {seriesName}-
          </span>
        )}
        <span className="title-rename-slot" data-state={renaming ? 'editing' : 'idle'} data-testid="canvas-header-rename-slot">
          {/* 官方是 `motion.span animate={{opacity}} initial={false} transition={is}` */}
          <motion.span
            className="title-rename-surface"
            data-testid="canvas-header-rename-surface"
            aria-hidden="true"
            initial={false}
            animate={{ opacity: renaming ? 1 : 0 }}
            transition={reduceMotion ? { duration: 0 } : RENAME_SURFACE_TRANSITION}
          />
          {renaming ? (
            <input
              ref={inputRef}
              className="title-input"
              type="text"
              data-testid="canvas-header-title-input"
              aria-label={t('重命名画布')}
              value={draft}
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
                if (event.key === 'Escape') { event.preventDefault(); setRenaming(false); setDraft(projectName); }
              }}
            />
          ) : (
            <button
              type="button"
              className="title-label-trigger control-button"
              data-testid="canvas-header-title-trigger"
              aria-label={t('重命名画布')}
              onClick={startRename}
            >
              <span className="title-label">{projectName}</span>
            </button>
          )}
        </span>

        {/* 切换画布（官方 `title-menu-trigger control-button`，打开时箭头旋转 180°） */}
        <button
          ref={triggerRef}
          type="button"
          onClick={toggleMenu}
          aria-label={t('切换画布')}
          title={t('切换画布')}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-state={menuOpen ? 'open' : 'closed'}
          data-testid="canvas-header-switcher-trigger"
          className={`title-menu-trigger control-button ${menuOpen ? 'is-active' : ''}`}
        >
          <svg className="title-menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6l6 -6" />
          </svg>
        </button>
      </div>

      {/* 新建画布**不在这里** —— 官方放在下拉页脚（`.project-create`）；用户明确「+ 不要」 */}
      {isCreatingProject && <span className="sr-only">{t('正在新建画布')}</span>}

      {/* ★ 官方弹层是 `forceMount`（常驻挂载，靠 `data-state=closed` 隐藏），
          入场/退场交给 `motion.div` ⇒ MTV 也必须**常驻**，否则 `AnimatePresence` 没机会跑 exit。 */}
      <CanvasSwitcherMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={triggerRef}
        anchorOffset={anchorOffset}
      />
    </header>
    {/* ═══ 右上角导航 —— 已抽成独立组件（逐字对齐官方实测）═══
        官方四块：0余额 57×40 · 社区 80×40 · 分享 40×40(全圆) · 头像组 4×32×32
        用户映射：社区→**角色库** ✓ · 分享→**AI助手** ✓ · 头像组保留 ✓ · 0余额保留 ✓
        见 src/components/TopRightNav.tsx ✓ */}
    <TopRightNav setCharacterLibraryOpen={setCharacterLibraryOpen} />
    </>
  );
}
