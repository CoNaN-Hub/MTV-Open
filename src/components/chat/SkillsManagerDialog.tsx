/**
 * SkillsManagerDialog —— 官方「管理技能」对话框 1:1 复刻（含 应用/技能 两个页签 + 顶部「添加」菜单）。
 *
 * 官方 DOM 实测（CDP 9222，`+` 菜单 → 技能 → 管理技能）逐字：
 * ```
 * <div role="dialog" data-testid="common-dialog-content"
 *      class="fixed left-[50%] top-[50%] z-50 text-popover-foreground min-w-[300px]
 *             translate-x-[-50%] translate-y-[-50%] inline-flex h-[min(640px,85vh)] w-[720px]
 *             max-w-[calc(100vw-32px)] flex-col items-start gap-4 overflow-hidden rounded-3xl
 *             border border-border p-6 bg-chat-bubble-header outline-none">
 *   <input type="file" accept=".md,.markdown,text/markdown,text/x-markdown" class="hidden">
 *   <input type="file" class="hidden" webkitdirectory directory>
 *   <div class="flex h-9 w-full shrink-0 items-center justify-between gap-3">
 *     <div role="tablist" aria-label="技能"
 *          class="relative grid auto-cols-fr grid-flow-col items-center gap-1 rounded-xl bg-white/10 p-1 w-auto shrink-0"
 *          style="border: 1px solid rgba(255,255,255,0.08)">
 *       滑块 <div class="pointer-events-none absolute rounded-lg bg-white/[0.12] backdrop-blur-[28px]"
 *              style="box-shadow: rgba(255,255,255,0.12) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.04) 0px 4px 8px 0px;
 *                     left:64px; top:4px; width:56px; height:28px"></div>
 *       <button role="tab" aria-selected class="relative z-10 flex h-7 w-full min-w-0 appearance-none items-center
 *               justify-center rounded-lg p-0 text-xs font-medium leading-none text-[rgba(255,255,255,0.60)]">
 *         <span class="flex h-full w-full items-center justify-center px-4 text-center">应用</span></button>
 *       …「技能」同结构（选中时 text-[rgba(255,255,255,0.88)]）…
 *     </div>
 *     <button class="flex size-8 shrink-0 aspect-square cursor-pointer items-center justify-center rounded-md
 *                    text-text-text-secondary transition-colors hover:bg-white/10 hover:text-text-text-primary"
 *             aria-label="关闭"><lucide-x/></button></div>
 *   <h2 class="sr-only">管理技能</h2>
 *   <div class="flex w-full shrink-0 items-center gap-3">
 *     <div class="w-full min-w-0 flex-1 self-stretch px-0 pt-0 pb-0">
 *       <div class="flex w-full items-center gap-[6px] border border-white/[0.08] bg-white/[0.04] h-[44px]
 *                   min-w-[48px] self-stretch rounded-2xl px-4 py-1">
 *         <tabler:search/><input placeholder="搜索"
 *           class="min-w-0 flex-1 border-none bg-transparent p-0 text-white/80 outline-none text-sm leading-5
 *                  placeholder:text-white/40"/></div></div>
 *     <button aria-label="添加" aria-haspopup="menu"
 *       class="group inline-flex h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl
 *              border border-white/[0.08] bg-white/[0.04] pl-3.5 pr-4 whitespace-nowrap text-[13px] font-medium
 *              leading-none text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white
 *              outline-none focus-visible:ring-1 focus-visible:ring-white/20">…添加</button></div>
 *   <div class="grid min-h-0 w-full flex-1 auto-rows-min grid-cols-2 content-start items-start justify-start
 *               gap-x-4 gap-y-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
 *     <button class="flex min-h-[109px] w-full flex-col gap-1.5 self-stretch rounded-2xl border border-white/[0.08]
 *                    bg-card-background/60 py-3 px-4 transition-[border-color,background-color] duration-200 ease-out
 *                    hover:border-white/[0.12] hover:bg-white/[0.04] group cursor-pointer text-left">
 *       <div class="flex items-start gap-3">
 *         <div class="shrink-0">[38×38 技能头像 span]</div>
 *         <div class="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
 *           <div class="flex min-w-0 flex-col items-start gap-0.5">
 *             <p class="w-full truncate text-sm font-semibold leading-5 tracking-tight text-white">名称</p>
 *             <p class="w-full truncate text-xs font-normal leading-[18px] text-white/60
 *                       group-hover:text-white/72">来源</p></div>
 *           <span class="pointer-events-none flex size-8 shrink-0 items-center justify-center text-[#E6E6E6]"/></div></div>
 *       <p class="line-clamp-2 w-full text-xs font-normal leading-[18px] text-white/60
 *                 group-hover:text-white/72">描述</p></button></div>
 * </div>
 * ```
 *
 * 顶部「添加」菜单（官方 `w-[240px] rounded-2xl border-0 bg-[#292929] p-1
 * shadow-[0_4px_16px_0_rgba(0,0,0,0.16),inset_0_0.5px_0_0_rgba(255,255,255,0.16)]`）三行：
 *   创建技能 · 上传技能文件（+ info tooltip）· 上传技能文件夹（+ info tooltip）
 * 行 = `flex h-8 cursor-pointer items-center justify-between self-stretch rounded-md px-2 py-1.5 focus:bg-white/10`，
 * 内容 = `<span class="flex min-w-0 items-center gap-1.5">[icon]<span class="truncate text-xs text-text-text-primary">…</span></span>`。
 *
 * ⚠️ 官方「应用」页签 = 插件 / 应用市场（服务端 `plugins` 接口）。MTV 侧的应用目录来自
 *    `services/plugins/pluginMarketplace.ts`（与 `settings/PluginSettings.tsx` 同一个市场源，
 *    本地 `public/plugin-marketplace.json` 兜底 + GitHub Release）⇒ 本页签渲染**真实市场数据**
 *    （官方 `FCe` 列表容器 + `RCe` 卡片，见 `PluginMarketPanel.tsx`）。
 *    市场为空时用官方空态文案「暂无应用」（`chatAdapter.addMenu.skills.emptyPlugins`），
 *    搜索无结果时用「没有匹配的应用」（`chatAdapter.addMenu.plugins.noSearchResults`）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import type { PluginCategory } from '../../types/plugin';
import {
  loadPluginMarketplace,
  type PluginMarketplaceItem,
} from '../../services/plugins/pluginMarketplace';
import { OfficialSkillAvatarIcon, OfficialSkillCreateIcon, OfficialUploadIcon } from './officialIcons';
import ChatMarkdown from './ChatMarkdown';
import SkillForm, { type SkillFormHandle } from './SkillForm';
import { stripSkillFrontmatter } from '../../services/chat/skillManifest';
import type { UserSkill } from '../../types';
import {
  PluginMarketList,
  SKILLS_DIALOG_GRID_CLASS,
} from './PluginMarketPanel';

/**
 * 技能展示名：**优先 frontmatter 的 `name`**（技能作者声明的名字，中文技能就能显示中文），
 * 回落文件名/文件夹名。官方面板对 `visual-art-director` 这类也显示英文名（图 3），
 * 所以这里不是「翻译」，而是「用作者声明的名字」——用户实测抱怨「全是英文、分不清哪个是哪个」。
 */
function skillDisplayName(skill: UserSkill): string {
  const declared = skill.manifest?.name?.trim();
  return declared || skill.name;
}

type SkillsTab = 'apps' | 'skills';

/**
 * 官方管理面板的视图状态机（`_Y` @403800-411200）：
 * ```
 * kd = { type: 'list' }                      // 默认
 * ve = { type: 'skill-detail', skill }       // 点技能卡
 * he = { type: 'edit-skill',   skill }       // 详情页「编辑技能」
 * me = { type: 'create-skill' }              // 顶部「添加 → 创建技能」
 * ```
 * ⚠️ 官方「编辑技能」**不是另开一个对话框**：它在**同一个** 720×640 对话框里把正文整块换掉
 * （h-9 行仍是「返回 + ✕」，另有 `<h2 class="sr-only">编辑技能</h2>`），CDP 实测只有一个 `[role=dialog]`。
 */
type ManagerView =
  | { type: 'list' }
  | { type: 'skill-detail'; skillId: string }
  | { type: 'skill-form'; mode: 'create' | 'edit'; skillId: string | null };

/* ⚠️ 居中**不能用 Tailwind 的 `translate-x-[-50%] translate-y-[-50%]`**：
   MTV 是 Tailwind v3，`translate-*` 写的是 `transform` 属性（v4 才改成独立的 `translate` 属性），
   而开合动画（framer-motion 的 `scale`，或 `animate-in zoom-in-*`）同样写 `transform`
   ⇒ 动画期间居中被覆盖，动画结束后再「啪」地跳回中间（用户实测「从下面闪一下出来」）。
   这里改用 CSS 独立的 `translate` 属性（`style={{ translate: '-50% -50%' }}`），与 `transform`
   是两个属性、互不覆盖，效果与官方 v4 的写法等价。 */
const DIALOG_CLASS = 'fixed left-[50%] top-[50%] z-[130] text-popover-foreground min-w-[300px] inline-flex h-[min(640px,85vh)] w-[720px] max-w-[calc(100vw-32px)] flex-col items-start gap-4 overflow-hidden rounded-3xl border border-border p-6 bg-chat-bubble-header outline-none';
const DIALOG_CENTER_STYLE = { translate: '-50% -50%' } as React.CSSProperties;

const TAB_BUTTON_CLASS = 'relative z-10 flex h-7 w-full min-w-0 appearance-none items-center justify-center rounded-lg p-0 text-xs font-medium leading-none';
const ADD_BUTTON_CLASS = 'group inline-flex h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] pl-3.5 pr-4 whitespace-nowrap text-[13px] font-medium leading-none text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white outline-none focus-visible:ring-1 focus-visible:ring-white/20';
const CARD_CLASS = 'flex min-h-[109px] w-full flex-col gap-1.5 self-stretch rounded-2xl border border-white/[0.08] bg-card/60 py-3 px-4 transition-[border-color,background-color] duration-200 ease-out hover:border-white/[0.12] hover:bg-white/[0.04] group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20';
const ADD_MENU_CLASS = 'z-[140] w-[240px] rounded-2xl border-0 bg-[#292929] p-1 shadow-[0_4px_16px_0_rgba(0,0,0,0.16),inset_0_0.5px_0_0_rgba(255,255,255,0.16)]';
const ADD_ROW_CLASS = 'flex h-8 w-full cursor-pointer items-center justify-between self-stretch rounded-md px-2 py-1.5 focus:bg-white/10 hover:bg-white/10';

/** MTV `PluginCategory` → 展示名（官方 `RCe` 的 `categoryLabel ?? category` 位；MTV 无 `categoryLabel`）。 */
const PLUGIN_CATEGORY_LABELS: Record<PluginCategory, string> = {
  content: '内容处理',
  media: '媒体处理',
  workflow: '工作流',
  utility: '通用工具',
};

export interface SkillsManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateSkill: () => void;
  onUploadSkillFile: () => void;
  onUploadSkillFolder: () => void;
  /**
   * 「应用」页签的安装入口。官方 `_Y` 走服务端安装 mutation；MTV 的安装流程带**权限审查弹窗**
   * （`settings/PluginSettings.tsx` 的 `reviewPluginInstall`，不在本文件的边界内）
   * ⇒ 这里只暴露注入点：不传时卡片右侧的 `$r`(Plus) 按钮按官方 `disabled` 分支渲染（不可点）。
   */
  onInstallPlugin?: (plugin: PluginMarketplaceItem) => void;
  /**
   * 「在对话中使用」：官方技能详情页右下角那颗 —— 点了把该技能作为引用插进输入框并关掉面板。
   * 由 `ChatInput` 注入（复用它既有的 `insertSkillReference`）。
   */
  onUseSkill?: (skill: { id: string; name: string }) => void;
  /**
   * 打开时的初始页签。官方首页右侧那颗 `aria-label="Connectors"` 打开的是「应用」侧、
   * 「技能」按钮打开「技能」侧 ⇒ 首页两个入口共用这一个面板，靠它区分。
   */
  initialTab?: 'skills' | 'plugin';
}

function SkillsManagerDialogBody({
  onClose,
  onCreateSkill,
  onUploadSkillFile,
  onUploadSkillFolder,
  onInstallPlugin,
  onUseSkill,
  initialTab,
}: Omit<SkillsManagerDialogProps, 'open'>) {
  const t = useT();
  const userSkills = useAppStore((state) => state.userSkills);
  const deleteSkill = useAppStore((state) => state.deleteSkill);
  const setSkillEnabled = useAppStore((state) => state.setSkillEnabled);
  const showToast = useAppStore((state) => state.showToast);
  const installedPlugins = useAppStore((state) => state.installedPlugins);
  const [tab, setTab] = useState<SkillsTab>(initialTab === 'plugin' ? 'apps' : 'skills');
  const [query, setQuery] = useState('');
  /* 官方：**每个技能都能点开**（图 2/3 = 技能详情页：返回 + 名称/来源 + 描述 + 正文 + 底部按钮）；
     详情页的「编辑技能」把正文换成官方技能表单（`role=dialog` 不变，只有一个对话框）。 */
  const [view, setView] = useState<ManagerView>({ type: 'list' });
  const formRef = useRef<SkillFormHandle | null>(null);
  /** 官方 hook `sCe` 的 `skillFormCloseIntentRef`：✕ ⇒ 'dismiss'（关整个面板），返回/取消 ⇒ 'back'。 */
  const formCloseIntentRef = useRef<'back' | 'dismiss' | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [marketItems, setMarketItems] = useState<PluginMarketplaceItem[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketFetching, setMarketFetching] = useState(false);
  const [marketError, setMarketError] = useState('');
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  const installedRepositories = useMemo(
    () => installedPlugins.flatMap((plugin) => (plugin.manifest.repository ? [plugin.manifest.repository] : [])),
    [installedPlugins],
  );

  /** 与 `settings/PluginSettings.tsx` 同一市场源（本地 JSON 兜底 + GitHub Release）。 */
  const refreshMarketplace = useCallback(async (force = false) => {
    setMarketLoading(true);
    setMarketFetching(true);
    setMarketError('');
    try {
      setMarketItems(await loadPluginMarketplace(installedRepositories, { force }));
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : '');
    } finally {
      setMarketLoading(false);
      setMarketFetching(false);
    }
  }, [installedRepositories]);

  /* 官方 `_Y` 的应用页签是 `Wm({installed_only:!1})` 拉取 ⇒ 首次进入「应用」页签时取一次
     （在页签点击里发起，避免在 effect 里同步 setState 造成的级联渲染）。 */
  const marketRequestedRef = useRef(false);
  const ensureMarketplace = useCallback(() => {
    if (marketRequestedRef.current) return;
    marketRequestedRef.current = true;
    void refreshMarketplace();
  }, [refreshMarketplace]);

  const installedRepositoriesSet = useMemo(
    () => new Set(installedRepositories),
    [installedRepositories],
  );

  const visibleMarketItems = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return marketItems;
    return marketItems.filter((item) => {
      if (item.status === 'error') return item.repository.toLocaleLowerCase().includes(keyword);
      return [
        item.manifest.name,
        item.manifest.description,
        item.manifest.author,
        item.repository,
        ...(item.manifest.keywords ?? []),
      ].some((value) => value?.toLocaleLowerCase().includes(keyword));
    });
  }, [marketItems, query]);

  const visibleSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return userSkills;
    return userSkills.filter((skill) => (
      `${skill.name} ${skill.description ?? ''}`.toLowerCase().includes(q)
    ));
  }, [query, userSkills]);

  const handleDelete = useCallback((id: string, name: string) => {
    void deleteSkill(id).then(() => showToast(`已移除技能「${name}」`));
  }, [deleteSkill, showToast]);

  /** 详情页当前技能（列表里找不到时自动回落列表，避免删完留空白页）。 */
  const detailSkill = useMemo(
    () => (view.type === 'skill-detail'
      ? userSkills.find((skill) => skill.id === view.skillId) ?? null
      : null),
    [userSkills, view],
  );
  /** 编辑态的表单初值：名称取展示名（frontmatter `name` 优先），指令取剥掉 frontmatter 的正文。 */
  const formSkill = useMemo(() => {
    if (view.type !== 'skill-form' || view.mode !== 'edit' || !view.skillId) return null;
    const skill = userSkills.find((entry) => entry.id === view.skillId);
    if (!skill) return null;
    return {
      id: skill.id,
      name: skillDisplayName(skill),
      description: skill.description ?? '',
      instructions: stripSkillFrontmatter(skill.content),
    };
  }, [userSkills, view]);

  /** 官方 `Me`：重置对话框外壳（页签回「技能」、清搜索、视图回列表）。 */
  const resetDialogChrome = useCallback(() => {
    setTab('skills');
    setQuery('');
    setView({ type: 'list' });
  }, []);

  /** 官方 `sCe.handleSkillFormClosed`：按意图收尾（'dismiss' 关面板；否则回到详情页/列表）。 */
  const handleSkillFormClosed = useCallback(() => {
    const intent = formCloseIntentRef.current ?? 'back';
    formCloseIntentRef.current = null;
    if (intent === 'dismiss') {
      resetDialogChrome();
      onClose();
      return;
    }
    /* 编辑：回「技能详情页」（名称从 store 读，保存后自动是新的）。 */
    setView((current) => (current.type === 'skill-form' && current.mode === 'edit' && current.skillId
      ? { type: 'skill-detail', skillId: current.skillId }
      : { type: 'list' }));
  }, [onClose, resetDialogChrome]);

  /** 官方 `sCe.requestSkillFormClose(intent)`：脏表单会先弹「放弃更改？」（在 `SkillForm` 内）。 */
  const requestSkillFormClose = useCallback((intent: 'back' | 'dismiss') => {
    formCloseIntentRef.current = intent;
    formRef.current?.requestClose();
  }, []);

  /** 官方 `le`：左上「返回」——表单态先问再退，其它视图直接回列表。 */
  const handleBack = useCallback(() => {
    if (view.type === 'skill-form') {
      requestSkillFormClose('back');
      return;
    }
    setView({ type: 'list' });
    setAddMenuOpen(false);
  }, [requestSkillFormClose, view.type]);

  /** 官方 `ke`（✕ 与 Esc）：表单态把关闭意图记为 'dismiss'（脏 ⇒ 先问），其它视图重置外壳再关。 */
  const handleCloseDialog = useCallback(() => {
    if (view.type === 'skill-form') {
      requestSkillFormClose('dismiss');
      return;
    }
    resetDialogChrome();
    onClose();
  }, [onClose, requestSkillFormClose, resetDialogChrome, view.type]);

  /* 官方 Radix `Dialog`：Esc 触发 `onOpenChange(false)` ⇒ 同样走 `ke`；
     点遮罩**不关**（官方 `onInteractOutside: preventDefault`，CDP 实测点遮罩无效）。 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      handleCloseDialog();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [handleCloseDialog]);

  /** 官方 `RCe` 的 `d = displayName ?? e.displayName`。 */
  const pluginDisplayName = useCallback((plugin: PluginMarketplaceItem) => (
    plugin.status === 'ready' ? plugin.manifest.name : plugin.repository
  ), []);
  /** 官方 `RCe` 的 `u = categoryLabel?.trim() || category?.trim() || t("…plugins.byTapNow")`。 */
  const pluginCategoryLabel = useCallback((plugin: PluginMarketplaceItem) => {
    if (plugin.status !== 'ready') return t('chatAdapter.addMenu.plugins.byTapNow');
    return PLUGIN_CATEGORY_LABELS[plugin.manifest.category] ?? t('chatAdapter.addMenu.plugins.byTapNow');
  }, [t]);
  const pluginInstalled = useCallback((plugin: PluginMarketplaceItem) => (
    plugin.status === 'ready'
      && (installedPlugins.some((installed) => installed.id === plugin.manifest.id)
        || installedRepositoriesSet.has(plugin.repository))
  ), [installedPlugins, installedRepositoriesSet]);

  const tabs: Array<{ id: SkillsTab; label: string }> = [
    { id: 'apps', label: t('应用') },
    { id: 'skills', label: t('技能') },
  ];

  return (
    <>
      {/* 官方遮罩层（CDP 实测）：`data-testid="common-dialog-container"`
          `fixed inset-0 z-50 bg-black/70 duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0`，
          实测计算值 `oklab(0 0 0 / 0.7)`（早期记录写成「官方没有遮罩层」是错的，已在第 58 轮纠正）。
          ⚠️ 点遮罩**不关**面板（官方 `onInteractOutside: preventDefault`，实测点左上角无效）⇒ 这里不给 onClick。 */}
      <motion.div
        aria-hidden="true"
        data-testid="skills-dialog-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[129] bg-black/70"
      />
      {/* ⚠️ 动画必须在**对话框自己**身上（`motion.div` = 这个 `position:fixed` 的根）：
          任何**带 transform 的祖先**都会成为 `position:fixed` 后代的包含块（containing block），
          于是 `left:50%/top:50%` 不再是相对视口，而是相对那个零尺寸外壳 ⇒ 动画期间弹窗跑到别处、
          动画结束再「啪」地跳回中间（用户实测「从画布下方跳出来」，改 translate 治不了这个）。 */}
      <motion.div
        role="dialog"
        aria-modal="true"
        data-testid="skills-manager-dialog"
        className={DIALOG_CLASS}
        style={DIALOG_CENTER_STYLE}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >              {/* 标题行：列表态 = 页签（应用 / 技能）+ ✕；详情/表单态 = 官方那颗「返回」+ ✕。
                  官方「返回」（管理器 DOM 逐字，@412300）：
                  `group flex min-w-0 max-w-[50%] cursor-pointer items-center gap-1 rounded-md py-1 pr-2
                   transition-colors hover:bg-white/10` + chevron(size 16, text-white/60) + span(text-base)。 */}
              <div className="flex h-9 w-full shrink-0 items-center justify-between gap-3">
                {view.type !== 'list' ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    data-testid="skill-detail-back"
                    className="group flex min-w-0 max-w-[50%] cursor-pointer items-center gap-1 rounded-md py-1 pr-2 transition-colors hover:bg-white/10"
                  >
                    <Icon
                      icon="tabler:chevron-left"
                      width={16}
                      height={16}
                      className="shrink-0 text-white/60 group-hover:text-white/90"
                    />
                    <span className="truncate text-base font-medium leading-5 text-white/60 group-hover:text-white/90">
                      {t('返回')}
                    </span>
                  </button>
                ) : (
                <div
                  role="tablist"
                  aria-label={t('技能')}
                  className="relative grid auto-cols-fr grid-flow-col items-center gap-1 rounded-xl bg-white/10 p-1 w-auto shrink-0"
                  style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
                >
                  {/* 官方滑块（选中页签的底色）—— 管理技能对话框 DOM 逐字：
                      `<div class="pointer-events-none absolute rounded-lg bg-white/[0.12] backdrop-blur-[28px]"
                            style="box-shadow: rgba(255,255,255,0.12) 0px 0.5px 0px 0px inset,
                                   rgba(0,0,0,0.04) 0px 4px 8px 0px;
                                   left:64px; top:4px; width:56px; height:28px">`
                      官方按真实测量定位；这里用 grid 等宽列的**无测量**等价写法：
                      `left-1/top-1/bottom-1`（p-1=4px）+ `w-[calc(50%-6px)]`（列宽，扣掉 padding 与 gap），
                      第二列再 `translateX(calc(100% + 4px))`（列宽 + `gap-1`）。
                      ⚠️ 用户此前要求删过一次（「滑条取消 丑死了」），第 54 轮又明确要回来
                      （「应用 和技能的 默认底色 以及 点击底色 没有」）⇒ 按官方恢复。 */}
                  <div
                    aria-hidden="true"
                    data-testid="skills-dialog-tab-slider"
                    className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-6px)] rounded-lg bg-white/[0.12] backdrop-blur-[28px] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                    style={{
                      boxShadow: 'rgba(255,255,255,0.12) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.04) 0px 4px 8px 0px',
                      transform: tabs.findIndex((entry) => entry.id === tab) === 1
                        ? 'translateX(calc(100% + 4px))'
                        : undefined,
                    }}
                  />
                  {tabs.map((entry) => {
                    const selected = entry.id === tab;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => {
                          setTab(entry.id);
                          if (entry.id === 'apps') ensureMarketplace();
                        }}
                        className={TAB_BUTTON_CLASS}
                        style={{ color: selected ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.60)' }}
                      >
                        <span className="flex h-full w-full items-center justify-center px-4 text-center">
                          {entry.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                )}
                {/* 右上角关闭（三种视图共用）：官方 ✕ 也走 `ke()` —— 表单态脏了先弹「放弃更改？」。 */}
                <button
                  type="button"
                  aria-label={t('关闭')}
                  onClick={handleCloseDialog}
                  className="flex size-8 shrink-0 aspect-square cursor-pointer items-center justify-center rounded-md text-text-text-secondary transition-colors hover:bg-white/10 hover:text-text-text-primary"
                >
                  <Icon icon="lucide:x" width={20} height={20} strokeWidth={1.5} className="aspect-square shrink-0" />
                </button>
              </div>

              {/* 官方每个视图各有一个 `DialogTitle`（sr-only）：列表 = 管理技能/管理应用；详情 = 技能名；表单 = 编辑技能。 */}
              <h2 className="sr-only">
                {view.type === 'skill-form'
                  ? (view.mode === 'create' ? t('创建技能') : t('编辑技能'))
                  : view.type === 'skill-detail' && detailSkill
                    ? skillDisplayName(detailSkill)
                    : tab === 'apps'
                      ? t('chatAdapter.addMenu.skills.managePluginDialogTitle')
                      : t('管理技能')}
              </h2>

              {view.type === 'skill-form' ? (
                /* ── 官方技能表单（`Bj`，`showTitle:true`）：正文整块换成「编辑技能 + 个人 + 三字段 + 取消/保存」。
                    ⚠️ 官方**不另开对话框**（CDP 实测只有一个 `[role=dialog]`），h-9 行也保持「返回 + ✕」。 */
                <SkillForm
                  ref={formRef}
                  mode={view.mode}
                  skill={formSkill}
                  active
                  showTitle
                  onClose={handleSkillFormClosed}
                />
              ) : detailSkill ? (
                /* ── 官方技能详情页 `wY`（mode='manage'）────────────────────────────────
                    CDP 逐字（@400500-402900 + 实测）：
                    · 标题行 `flex w-full items-start gap-3` → 名称 `truncate text-lg font-extrabold leading-7
                      text-white/90` + 来源 `truncate text-base font-medium leading-5 text-white/60`（**不是胶囊徽章**）
                    · 描述 `w-full text-xs font-normal leading-4.5 text-white/60`
                    · 右上 `Switch`：`h-5 w-9 rounded-full`，选中 `bg-accent-primary`(#90c4e5)、未选 `bg-zinc-800`，
                      滑块 `block h-4 w-4 rounded-full bg-white shadow-sm`（translate-x-4 / x-0）
                    · 正文 `rounded-xl border border-white/8 bg-card-background` 内 `p-4`
                    · 页脚 `mt-6 flex w-full items-center gap-2 justify-between`（可编辑时）/`justify-end`，
                      三颗按钮逐字见下。 */
                <div className="flex h-full min-h-0 w-full flex-1 flex-col" data-testid="skill-detail-panel">
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex w-full shrink-0 flex-col gap-1.5">
                      <div className="flex w-full items-start gap-3">
                        <div className="flex min-w-0 flex-1 items-baseline gap-x-2">
                          <p className="truncate text-lg font-extrabold leading-7 text-white/90">
                            {skillDisplayName(detailSkill)}
                          </p>
                          <p className="truncate text-base font-medium leading-5 text-white/60">
                            {detailSkill.sourceType === 'folder' ? t('本地文件夹') : t('个人')}
                          </p>
                        </div>
                        {/* 官方右上那颗**启用/停用**开关（图 2）。关掉 ⇒ 技能仍在面板里，
                            但 `skillCatalog.isSkillAvailableOnSurface` 的硬门让它在模型/用户/MCP 三个面下线。 */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={detailSkill.enabled !== false}
                          aria-label={t('启用技能')}
                          data-state={detailSkill.enabled !== false ? 'checked' : 'unchecked'}
                          data-testid="skill-detail-toggle"
                          onClick={() => { void setSkillEnabled(detailSkill.id, detailSkill.enabled === false); }}
                          className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-sm transition-colors ${
                            detailSkill.enabled !== false ? 'bg-accent-primary' : 'bg-zinc-800 shadow-inner'
                          }`}
                        >
                          <span
                            className={`pointer-events-none block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                              detailSkill.enabled !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                      {detailSkill.description ? (
                        <p className="w-full text-xs font-normal leading-[18px] text-white/60">{detailSkill.description}</p>
                      ) : null}
                    </div>

                    <div
                      data-overlay-scrollbar="off"
                      className="min-h-0 w-full flex-1 overflow-y-auto rounded-xl border border-white/[0.08] bg-card p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                    >
                      <ChatMarkdown value={stripSkillFrontmatter(detailSkill.content)} />
                    </div>
                  </div>

                  <div className="mt-6 flex w-full shrink-0 items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => { handleDelete(detailSkill.id, skillDisplayName(detailSkill)); setView({ type: 'list' }); }}
                      className="-ml-2 flex cursor-pointer items-center rounded-lg px-3 py-1.5 text-sm font-medium leading-5 text-destructive-foreground transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('卸载')}
                    </button>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setView({ type: 'skill-form', mode: 'edit', skillId: detailSkill.id })}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-lg bg-white/10 px-3 text-sm font-medium leading-5 text-text-text-primary transition-colors hover:bg-white/15"
                      >
                        {t('编辑技能')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { onUseSkill?.({ id: detailSkill.id, name: detailSkill.name }); onClose(); }}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-lg bg-white px-3 text-sm font-medium leading-5 text-black transition-opacity hover:opacity-90"
                      >
                        {t('在对话中使用')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
              <>
              {/* 搜索 + 添加 */}
              <div className="flex w-full shrink-0 items-center gap-3">
                <div className="w-full min-w-0 flex-1 self-stretch px-0 pt-0 pb-0">
                  <div className="flex w-full items-center gap-[6px] border border-white/[0.08] bg-white/[0.04] h-[44px] min-w-[48px] self-stretch rounded-2xl px-4 py-1">
                    <Icon icon="tabler:search" width={14} height={14} className="shrink-0 text-white/40" />
                    <input
                      type="text"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t('搜索')}
                      autoComplete="off"
                      spellCheck={false}
                      className="min-w-0 flex-1 border-none bg-transparent p-0 text-white/80 outline-none text-sm leading-5 placeholder:text-white/40"
                    />
                  </div>
                </div>
                <button
                  ref={addButtonRef}
                  type="button"
                  aria-label={t('添加')}
                  aria-haspopup="menu"
                  aria-expanded={addMenuOpen}
                  onClick={() => setAddMenuOpen((value) => !value)}
                  className={ADD_BUTTON_CLASS}
                >
                  <Icon icon="tabler:plus" width={16} height={16} strokeWidth={2} />
                  {t('添加')}
                </button>
              </div>

              {/* 内容 */}
              {tab === 'skills' ? (
                visibleSkills.length === 0 ? (
                  <div className="flex w-full flex-1 items-center justify-center text-sm text-white/40">
                    {t('暂无已启用技能')}
                  </div>
                ) : (
                  <div className={SKILLS_DIALOG_GRID_CLASS} data-overlay-scrollbar="off">
                    {visibleSkills.map((skill) => (
                      <div
                        key={skill.id}
                        className={CARD_CLASS}
                        /* 官方：每个技能卡可点开详情页（图 2/3）。 */
                        role="button"
                        tabIndex={0}
                        data-testid={`skill-card-${skill.id}`}
                        onClick={() => setView({ type: 'skill-detail', skillId: skill.id })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setView({ type: 'skill-detail', skillId: skill.id });
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="shrink-0">
                            <OfficialSkillAvatarIcon size={38} skillName={skill.name} />
                          </div>
                          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
                            <div className="flex min-w-0 flex-col items-start gap-0.5">
                              <p className="w-full truncate text-sm font-semibold leading-5 tracking-tight text-white">
                                {skillDisplayName(skill)}
                              </p>
                              <p className="w-full truncate text-xs font-normal leading-[18px] text-white/60 transition-colors duration-200 group-hover:text-white/[0.72]">
                                {skill.sourceType === 'folder' ? t('本地文件夹') : t('个人')}
                              </p>
                            </div>
                            {/* 官方（用户图 1）：卡片右侧是**常驻的对号**（已安装标记），
                                不是 MTV 原来那个 hover 才出现的删除键 —— 删除移到详情页底部的「卸载」。 */}
                            <span
                              aria-hidden="true"
                              data-testid={`skill-card-check-${skill.id}`}
                              className="flex size-8 shrink-0 items-center justify-center text-white/85"
                            >
                              <Icon icon="lucide:check" width={16} height={16} strokeWidth={2} />
                            </span>
                          </div>
                        </div>
                        <p className="line-clamp-2 w-full text-xs font-normal leading-[18px] text-white/60 transition-colors duration-200 group-hover:text-white/[0.72]">
                          {skill.description || skill.fileName}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* 官方「应用」= 插件 / 应用市场（`FCe` 列表容器 + `RCe` 卡片，逐字见 `PluginMarketPanel.tsx`）。 */
                <div className={SKILLS_DIALOG_GRID_CLASS} data-overlay-scrollbar="off">
                  <PluginMarketList
                    plugins={marketItems}
                    pluginsWithInstallationState={visibleMarketItems}
                    isLoading={marketLoading}
                    isFetching={marketFetching}
                    isError={Boolean(marketError)}
                    refetch={() => { void refreshMarketplace(true); }}
                    searchQuery={query}
                    installPluginLabel={t('chatAdapter.addMenu.plugins.installPlugin')}
                    displayNameOf={pluginDisplayName}
                    categoryLabelOf={pluginCategoryLabel}
                    isInstalled={pluginInstalled}
                    /* 官方卡片点击 → 插件详情浮层（`oSe`/`xY`）；MTV 该浮层不在本弹窗内 ⇒ no-op。 */
                    onPluginClick={() => {}}
                    /* 官方 `onInstall` → 服务端安装 mutation；MTV 的安装流程在 `PluginSettings.tsx`。 */
                    onInstall={(plugin) => onInstallPlugin?.(plugin)}
                    installDisabled={!onInstallPlugin}
                  />
                </div>
              )}
              </>
              )}

              {/* 顶部「添加」菜单（官方三行） */}
              {addMenuOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-[139]"
                    onClick={() => setAddMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    aria-label={t('添加')}
                    className={`absolute right-6 top-[104px] ${ADD_MENU_CLASS}`}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className={ADD_ROW_CLASS}
                      onClick={() => { setAddMenuOpen(false); onCreateSkill(); }}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <OfficialSkillCreateIcon size={16} className="shrink-0" />
                        <span className="truncate text-xs text-text-text-primary">{t('创建技能')}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={ADD_ROW_CLASS}
                      onClick={() => { setAddMenuOpen(false); onUploadSkillFile(); }}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <OfficialUploadIcon size={16} />
                        <span className="truncate text-xs text-text-text-primary">{t('上传 Skill 文件')}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={ADD_ROW_CLASS}
                      onClick={() => { setAddMenuOpen(false); onUploadSkillFolder(); }}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <OfficialUploadIcon size={16} />
                        <span className="truncate text-xs text-text-text-primary">{t('上传技能文件夹')}</span>
                      </span>
                    </button>
                  </div>
                </>
              ) : null}
      </motion.div>
    </>
  );
}

export default function SkillsManagerDialog({
  open,
  onClose,
  onCreateSkill,
  onUploadSkillFile,
  onUploadSkillFolder,
  onInstallPlugin,
  onUseSkill,
  initialTab,
}: SkillsManagerDialogProps) {
  if (typeof document === 'undefined' || !document.body) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        /* 官方**没有遮罩层**（CDP 实测 0 个 `fixed inset-0` 非透明层）。
           ⚠️ 这里**不能**再套一层 `motion.div`：带 transform 的祖先会成为 `position:fixed`
           后代的包含块，动画面板就会先跑到别处再跳回（「从画布下方跳出来」）。
           动画放在 `SkillsManagerDialogBody` 自己的根 `motion.div` 上（它就是这个 fixed 元素）。 */
        <SkillsManagerDialogBody
          key="skills-manager-dialog"
          onClose={onClose}
          onCreateSkill={onCreateSkill}
          onUploadSkillFile={onUploadSkillFile}
          onUploadSkillFolder={onUploadSkillFolder}
          onInstallPlugin={onInstallPlugin}
          onUseSkill={onUseSkill}
          initialTab={initialTab}
        />
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

