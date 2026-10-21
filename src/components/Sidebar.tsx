/**
 * 应用主侧栏，集中承载节点创建、项目入口、功能面板切换与快捷操作。
 * 「设置／帮助」在底部弹窗里；版本与更新信息在设置面板的「关于与更新」页签（原「关于」弹窗已按用户要求移除）。
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { countUnreadDramaAssets } from '../store/store.dramaAssets';
// MTV 重品牌：自动更新器已移除，不再引入 updateService。
import AnimatedButton from './shared/AnimatedButton';
import { OfficialIcon } from './sidebar/OfficialIcon';
import NodePickerPanel from './sidebar/NodePickerPanel';
import NodeSearchPanel from './sidebar/NodeSearchPanel';
import CanvasStatsDialog from './canvas/CanvasStatsDialog';
import CreditBoltIcon from './shared/CreditBoltIcon';
import { useCreditBalance } from '../hooks/useCreditBalance';
import LazyLoadBoundary, { LazyLoadFallback } from './shared/LazyLoadBoundary';
import { useT, LOCALES, LOCALE_LABELS, getLocale, normalizeLocale, type Locale } from '../i18n';

const HelpCenterDialog = lazy(() => import('./HelpCenterDialog'));

/**
 * Sidebar 侧边栏面板 — 左侧节点类型列表、上传入口、项目切换、拖拽添加节点
 */

/* ============================================
   Node picker menu items
   ★ 目录已抽到 `sidebar/nodePickerCatalog.tsx`（唯一事实来源）——
     双击画布菜单与「+」面板共用同一份列表、同一个渲染组件
     `sidebar/NodePickerPanel.tsx`。**不要在这里再写一份节点列表。**
   ============================================ */

/* ============================================
   Node Picker popup
   ============================================ */
/**
 * 「添加节点」菜单的外壳 —— **两个入口共用**：
 *   ① 左侧「+」按钮悬停/点按（`openRailPicker()`，贴竖条弹出）；
 *   ② 画布空白处双击（`openRailPickerAt(pos)`，在点击位置弹出）。
 * 条目与「添加节点」动作都在 `NodePickerPanel` / `nodePickerCatalog` 里，
 * 所以两个入口显示的内容与顺序完全一致。
 * 本组件只负责**锚点与开合**。
 */
function NodePicker({
  onEnter,
  onLeave,
}: {
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { nodePickerOpen, closeRailPicker } = useAppStore(
    useShallow((s) => ({
      nodePickerOpen: s.railPickerOpen,
      closeRailPicker: s.closeRailPicker,
    })),
  );
  const nodePickerPosition = useAppStore((s) => s.canvasPickerPosition);
  const closeCanvasPicker = useAppStore((s) => s.closeCanvasPicker);
  /** 画布双击那条（官方 = 288 宽 / r16 / 组标题 14px 的**另一套**菜单，与竖条这条互相独立 ✓） */
  const canvasPickerOpen = nodePickerPosition !== null;
  /* 面板根节点（`.node-picker`）—— 悬停开合与点击外部判定都用它 */
  const pickerRef = useRef<HTMLDivElement>(null);

  /* 内容与「添加节点」动作都在 NodePickerPanel 里；这里只传「怎么关」 */
  const closePicker = () => closeRailPicker();

  /* ★★★★★ **双击画布那条路径：点外部要关** ✓✓（官方实测 ✓ 用户："也不互相绑定" 引出的核对 ✓）
     官方实测（2026-09 · CDP 真实鼠标）：
       · 双击空白 → 菜单 288 宽 · r16 · 标题 14px ✓（与 `+` 面板 240/r12/12px **本来就不同** ✓ 保持 1:1 ✓）
       · **按 Esc → 不关** ✓（MTV 也不关 ✓ 一致 → **故意不加 Esc** ✗ 加了反而偏离官方 ✓）
       · **点外部 → 关闭** ✓（MTV 原来缺这条 ✗ 这里补上 ✓）
     ⚠️ 只对**定位菜单**（`nodePickerPosition` 非空 = 双击那条）生效 ✓
        `+` 面板是**悬停开合** ✗ 加 outside-click 会在「一直悬停」时被瞬间重开 ✗（悬停逻辑见下方 onLeave ✓） */
  useEffect(() => {
    if (!canvasPickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = pickerRef.current;
      if (el && !el.contains(e.target as Node)) closeCanvasPicker();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [canvasPickerOpen, closeCanvasPicker]);

  return (
    <AnimatePresence>
      {nodePickerOpen && (
        /* ★★ **去掉 framer-motion 的 transform 动画** ✗ —— 它与 CSS 的 `pickerSlideIn` **打架** ✓
           两套都改 `transform`：
             ① CSS  `.node-picker { animation: pickerSlideIn 180ms }`（keyframes 收在 scale(1) ✓）
             ② framer-motion 的内联 `initial/animate/exit`（也在改 transform ✗）
           实测：打开后面板**永远停在 `matrix(0.95,0,0,0.95,0,-4)`** ✗✓ = framer-motion 的 `initial` ✓
                7 秒都不变 ✓ → 面板常年缩小 5% ✗
           **后果比"动画不齐"严重得多** ✗ —— 整套度量都被 ×0.95 带偏：
             240→228 · 49→47 · 36→34 · 间距8→7.6 · **连字形都被缩小** → 观感就是"字体不一致" ✗
           官方打开后 `transform` = **none** ✓（实测 ✓）—— CSS 那套（fill-mode:none）正好收在无 transform ✓
           所以这里**去掉 motion 的 initial/animate/exit**，只留 CSS 动画 ✓ */
        <div
          ref={pickerRef}
          className={`node-picker${nodePickerPosition ? ' node-picker--at' : ''}`}
          style={nodePickerPosition ? { left: nodePickerPosition.x, top: nodePickerPosition.y } : undefined}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
      {/* ★★ 官方面板的「彩色晕染」层 —— **按 EXE 源码原样恢复** ✓
          之前被当作"误加"删掉了 ✗，理由是拿**双击菜单**的实测去否定**「+」面板** ✗。
          但 EXE 源码里它就是面板的一部分（组件 `XKo({theme, className})` ✓），
          且我实测也量到了那 4 个圆斑（rgb(0,147,255)×2 + rgb(241,91,14)×2 ✓）。

          官方源码（深色主题那一支，w-full h-full + `*:rounded-full` ✓）：
            <div className="absolute top-0 left-0 w-full h-full blur-3xl bg-[#3f3f46]/60 *:rounded-full">
              <div className="absolute inset-0 top-[55%] left-[83%] w-[28%] h-[45%] bg-[#0093FF]" />
              <div className="absolute inset-0 top-[95%] left-[40%] w-[58%] h-[25%] bg-[#0093FF]" />
              <div className="absolute inset-0 top-[80%] left-[75%] w-[29%] h-[35%] bg-[#F15B0E]" />
              <div className="absolute inset-0 top-[-10%] left-[-4%] w-[20%] h-[23%] bg-[#F15B0E]" />
            </div>
          （浅色主题是另一套：blur-[88px] + bg-white/80 + #ffa26c / #0093FF / #b5caff / #ffffff ✓） */}
      <div className="node-picker-glow" aria-hidden="true">
        <i className="node-picker-blob" style={{ top: '55%', left: '83%', width: '28%', height: '45%', background: '#0093FF' }} />
        <i className="node-picker-blob" style={{ top: '95%', left: '40%', width: '58%', height: '25%', background: '#0093FF' }} />
        <i className="node-picker-blob" style={{ top: '80%', left: '75%', width: '29%', height: '35%', background: '#F15B0E' }} />
        <i className="node-picker-blob" style={{ top: '-10%', left: '-4%', width: '20%', height: '23%', background: '#F15B0E' }} />
      </div>
      {/* ★ 菜单内容 = 内容组件；两个入口**各自一套状态/外壳**（官方就是两个不同组件 ✓） */}
      <NodePickerPanel onClose={closePicker} />
        </div>
      )}
      {/* ── 画布双击那条（官方 = 画布上的 `command` 节点，288 宽 · r16 · 组标题 14px）──
          ⚠️ 与竖条那条**完全独立**：不共用开关状态、不互相挪位置、不吃竖条的 hover 开合 ✗✓
          （此前两者共用 `nodePickerOpen/nodePickerPosition` → 双击会把竖条面板挪到点击位置 ✗） */}
      {canvasPickerOpen && (
        <div
          ref={pickerRef}
          className="node-picker node-picker--at"
          style={{ left: nodePickerPosition.x, top: nodePickerPosition.y }}
        >
          {/* ⚠️ **没有光晕层** ✗ —— 官方画布那个 `command` 菜单容器只有
              `w-72 max-w-[calc(100vw-24px)] h-fit max-h-none animate-in zoom-in overflow-x-hidden
               overflow-y-auto overscroll-contain nowheel nopan`，**不带 colorfulCard / 彩色晕染**；
              那层光斑只属于左侧竖条的 `+` 面板（官方 `variant:"colorfulCard"`）✓
              用户：「双击添加节点菜单 是没有光晕渲染的 移除掉」*/}
          <NodePickerPanel onClose={closeCanvasPicker} variant="canvas" />
        </div>
      )}
    </AnimatePresence>
  );
}

/* ============================================
   Avatar / Settings dropdown menu
   ============================================ */
function AvatarMenu() {
  const t = useT();
  const { avatarMenuOpen, closeAvatarMenu, setSettingsOpen, helpOpen, setHelpOpen } = useAppStore(
    useShallow((s) => ({
      avatarMenuOpen: s.avatarMenuOpen,
      closeAvatarMenu: s.closeAvatarMenu,
      setSettingsOpen: s.setSettingsOpen,
      helpOpen: s.helpOpen,
      setHelpOpen: s.setHelpOpen,
    })),
  );
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handler = (e: MouseEvent) => {
      // Ignore clicks on the gear button itself
      const gearBtn = document.getElementById('btn-user-gear');
      if (gearBtn && gearBtn.contains(e.target as Node)) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeAvatarMenu();
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [avatarMenuOpen, closeAvatarMenu]);

  return (
    <>
      <AnimatePresence>
      {avatarMenuOpen && (
        <motion.div
          ref={menuRef}
          className="avatar-menu"
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <AvatarMenuBody
            onOpenSettings={() => { setSettingsOpen(true); closeAvatarMenu(); }}
            /* ★ 官方账号菜单里「账户管理」点开的那个个人资料页 —— 就是设置面板的 `account` 页 */
            onOpenAccount={() => { setSettingsOpen(true, 'account'); closeAvatarMenu(); }}
            onOpenHelp={() => { setHelpOpen(true); closeAvatarMenu(); }}
          />
        </motion.div>
      )}
    </AnimatePresence>

      {helpOpen ? (
        <LazyLoadBoundary label={t('帮助中心')}>
          <Suspense fallback={<LazyLoadFallback label={t('帮助中心')} />}>
            <HelpCenterDialog onClose={() => setHelpOpen(false)} />
          </Suspense>
        </LazyLoadBoundary>
      ) : null}

    </>
  );
}

/**
 * 齿轮弹窗里的菜单项。
 *
 * ★ 用户 2026 点名（对齐官方账号菜单，见用户给的官方截图）：弹窗里**先接入**
 *   「简体中文」和「账户管理」两项 ——
 *     · 简体中文：官方 `_d` 行 + 右侧 `>`，**点击**展开官方那套语言弹层
 *       （`rounded-xl border border-white/10 bg-[#1F1F1F] p-1.5 shadow-lg` +
 *        选项 `rounded-lg px-3 py-2 text-sm hover:bg-[#404040]` + 当前项一个对勾）；
 *       列表 = 官方 `Yze` **去掉法语**（用户：「简体中文里 不要法语」）＝ MTV 的 4 个 locale。
 *     · 账户管理：打开设置面板的 `account` 页（官方那一项的个人资料页）。
 *
 * ⚠️ 抽成**子组件**是有意的：`langOpen` 随菜单卸载自动复位。
 *   若把状态留在 `AvatarMenu` 里，菜单关掉再开时二级弹层会「自己开着」——
 *   而用 `useEffect` 去复位会踩仓库的 `react-hooks/set-state-in-effect` 规则。
 */
function AvatarMenuBody({
  onOpenSettings,
  onOpenAccount,
  onOpenHelp,
}: {
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  onOpenHelp: () => void;
}) {
  const t = useT();
  const updateConfig = useAppStore((s) => s.updateConfig);
  const saveConfig = useAppStore((s) => s.saveConfig);
  /* 订阅 `config.language`：改完语言这里要立刻换行上的名字（`getLocale()` 自己不订阅）*/
  const configuredLanguage = useAppStore((s) => s.config.language);
  const locale = configuredLanguage ? normalizeLocale(configuredLanguage) : getLocale();
  /* 面板头（官方 `_9t`）读的资料 —— 与「个人设置」页同一份 `profile*` 字段 */
  const username = useAppStore((s) => s.config.profileUsername) ?? '';
  const avatarUrl = useAppStore((s) => s.config.profileAvatarUrl) ?? '';
  /* 官方 `y = (username?.trim() || '').charAt(0) || 'U'`，username = `user_name || email || 'User'` */
  const initial = ((username.trim() || 'User')[0] ?? 'U').toUpperCase();
  const { credits } = useCreditBalance();

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!langOpen) return;
    const handler = (event: MouseEvent) => {
      if (!langRef.current?.contains(event.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [langOpen]);

  const pickLanguage = (code: Locale) => {
    setLangOpen(false);
    if (getLocale() === code) return;
    /* 与「常规 → 界面语言」同一条链路：`store.config.ts` 在 `'language' in partial` 时
       会 `setLocale()` ⇒ 立即生效；同时随 config 落盘 ⇒ 重启保留。 */
    updateConfig({ language: code });
    void saveConfig().catch(() => undefined);
  };

  return (
    <>
      {/* ⓪ 面板头 —— 官方 `_9t`（逐字）：
            `flex items-center gap-3 pl-1 mb-4`
            + 头像 `h-10 w-10 … border border-white/10`（圆形容器 + 首字母 / 图片）
            + 名字 `text-lg text-primary-foreground truncate`
          ★ 用户 2026：「N + 圆形底色  New Tapper」——名字取 `profileUsername`，
            没填过就落官方那个默认名 `New Tapper`（首字母即 `N`，和官方图一致）。
          ★ 头像底色 = 空头像兜底那套（`--primary` #1fa2dc），与「个人设置」页的头像同源。 */}
      <div className="avatar-menu-head">
        <span className="avatar-menu-avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt="" draggable={false} />
            : <span className="avatar-menu-avatar-fallback">{initial}</span>}
        </span>
        <div className="avatar-menu-identity">
          <p className="avatar-menu-name">{username || 'New Tapper'}</p>
        </div>
      </div>

      {/* ⓪' 积分 —— 官方面板头下面那颗卡片；用户指定**图标用闪电**（`CreditBoltIcon`）。
            余额读不到就是 `—`，绝不猜（与顶部积分按钮同一口径、同一份 TTL 缓存）。 */}
      <div className="avatar-menu-credits" data-testid="avatar-menu-credits">
        <span className="avatar-menu-credits-icon">
          <CreditBoltIcon size={16} />
        </span>
        <span className="avatar-menu-credits-value">{credits ?? '—'}</span>
      </div>

      <div className="avatar-menu-sep" />

      {/* ① 简体中文 —— 当前语言名 + `>` ⇒ 点击展开语言弹层 */}
      <div className="avatar-menu-row" ref={langRef}>
        <AnimatedButton
          type="button"
          className="avatar-menu-item"
          scale={1}
          tapScale={1}
          aria-haspopup="listbox"
          aria-expanded={langOpen}
          onClick={() => setLangOpen((open) => !open)}
        >
          <span className="avatar-menu-item-icon">
            <Icon icon="lucide:globe" width={16} height={16} aria-hidden="true" />
          </span>
          <span className="avatar-menu-item-label">{LOCALE_LABELS[locale]}</span>
          <Icon
            className="avatar-menu-item-chevron"
            icon="lucide:chevron-right"
            width={16}
            height={16}
            aria-hidden="true"
          />
        </AnimatedButton>

        {langOpen && (
          <div className="avatar-submenu" role="listbox" aria-label={t('语言')}>
            {LOCALES.map((code) => {
              const active = locale === code;
              return (
                <div
                  key={code}
                  role="option"
                  tabIndex={-1}
                  aria-selected={active}
                  data-checked={active || undefined}
                  className="avatar-submenu-item"
                  onClick={() => pickLanguage(code)}
                >
                  <span>{LOCALE_LABELS[code]}</span>
                  {active && <Icon icon="lucide:check" width={16} height={16} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ② 账户管理 —— 官方那一项点开的是个人资料页（MTV 落在设置面板的 `account` 页）*/}
      <AnimatedButton
        type="button"
        className="avatar-menu-item"
        scale={1}
        tapScale={1}
        onClick={onOpenAccount}
      >
        <span className="avatar-menu-item-icon">
          <Icon icon="lucide:user-round" width={16} height={16} aria-hidden="true" />
        </span>
        {t('账户管理')}
      </AnimatedButton>

      <div className="avatar-menu-sep" />

      <AnimatedButton
        type="button"
        className="avatar-menu-item"
        scale={1}
        tapScale={1}
        onClick={onOpenSettings}
      >
        {/* ★ 官方 `_d` 的**图标外壳**（`flex h-6 w-6 … rounded-sm bg-muted`）——
            官方源码实测 24×24 + #2B2B2B 底；用户：「单行的 图标+底色+文案」✓ */}
        <span className="avatar-menu-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </span>
        {t('设置')}
      </AnimatedButton>

      <div className="avatar-menu-sep" />

      <AnimatedButton
        type="button"
        className="avatar-menu-item"
        scale={1}
        tapScale={1}
        onClick={onOpenHelp}
      >
        <span className="avatar-menu-item-icon">
          <Icon icon="mdi:help-circle-outline" width="16" height="16" aria-hidden="true" />
        </span>
        {t('帮助')}
      </AnimatedButton>
    </>
  );
}


/* ============================================
   Main Sidebar
   ============================================ */
export default function Sidebar() {
  const t = useT();
  const {
    openRailPicker,
    closeRailPicker,
    toggleAvatarMenu,
    nodePickerOpen,
    setAssetsPanelOpen,
    setHistoryPanelOpen,
    unreadDramaAssetCount,
  } = useAppStore(
      useShallow((s) => ({
        openRailPicker: s.openRailPicker,
        closeRailPicker: s.closeRailPicker,
        toggleAvatarMenu: s.toggleAvatarMenu,
        nodePickerOpen: s.railPickerOpen,
        setAssetsPanelOpen: s.setAssetsPanelOpen,
        setHistoryPanelOpen: s.setHistoryPanelOpen,
        unreadDramaAssetCount: countUnreadDramaAssets(s.dramaAssets),
      })),
    );
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ★ 官方竖条第 2 件「节点搜索」的开关 —— 官方 `Hxe` 用的是组件内 `useState`（不进 store）：
       · 点按钮 ⇒ `onClick:()=>n(!0)`（**只开不 toggle**，与「添加节点」那个 toggle 不同 ✓）
       · 另外官方同一个组件里还挂了 `Cmd/Ctrl+F` 全局快捷键（见下面的 effect）✓
     面板本身是 `sidebar/NodeSearchPanel.tsx`（官方 `Vxe` 的逐字移植），走 portal 到 body。 */
  const [nodeSearchOpen, setNodeSearchOpen] = useState(false);

  /* 官方竖条第 5 件 —— 用户 2026 指定：把「打开评论」换成**画布统计**（MTV 没有评论功能）。
     开关也是组件内 `useState`（与「节点搜索」同一口径，不进 store）。 */
  const [canvasStatsOpen, setCanvasStatsOpen] = useState(false);

  /* 官方 `Hxe` @char1536660 的快捷键：
       `Txe(target)`（输入框/文本域/contenteditable 里不触发）⇒ 必须 meta/ctrl ⇒ 必须是 f ⇒ preventDefault + 打开。
     ⚠️ 这条监听**不做** stopPropagation（MTV 曾因弹窗 Esc 监听吃掉事件踩过坑），
        仅在真的要打开时才 preventDefault（阻止浏览器/WebView 的「查找」）✓ */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = target
        ? target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest("[contenteditable='true']") !== null
        : false;
      if (isEditable) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'f') return;
      event.preventDefault();
      setNodeSearchOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleAddEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openRailPicker();
  };
  const handleAddLeave = () => {
    closeTimer.current = setTimeout(() => {
      // 双击画布打开的是**另一套**（canvasPickerPosition 非空 = 官方那个 288 宽的 command 菜单），不归竖条悬停逻辑管 ——
      // 否则鼠标离开竖条 120ms 后会把刚弹出的菜单关掉。
      if (useAppStore.getState().canvasPickerPosition) return;
      closeRailPicker();
    }, 120);
  };
  const handlePickerEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const handlePickerLeave = () => {
    if (useAppStore.getState().canvasPickerPosition) return;
    closeRailPicker();
  };

  /* ⚠️ 两个 `data-tooltip-*` 都挂在**竖条容器**上（不逐个按钮挂 ✓）—— 官方这一整条 DockBar：
     · `data-tooltip-relaxed`：气泡走 `qr`(K0) 那套 = 原语 + `leading-relaxed` → 行高 **19.5px**
       （官方线上实测：竖条「节点搜索」气泡盒 **72×32** = 6 + 19.5 + 6 ✓ 见 `styles/tooltip.css` ✓）
     · `data-tooltip-delay="0"`：官方竖条根节点是 Tooltip **Provider `delayDuration:0`**（源码逐字 ✓），
       条目 `<Hn>`（= Tooltip.Root）**不传任何 props** ⇒ 落到 **0ms**
       （官方线上实测 ✓ 真实鼠标：hover → 出现 **≈28ms** ≈ 即开 ✓ 出处 `D:\DEEPSEEK\probe-official-rail-delay.mjs`）
     ⚠️ 只对**竖条自己**的提示生效：Popover / 弹层都 portal 到 body，不在这个容器下 ✓ */
  return (
    <aside
      data-tauri-drag-region
      className="sidebar-floating"
      /* 官方 page-DPdEgTS0.js：画廊打开时左侧竖条左移飞出（CSS 在 nodes-pile.css） */
      data-pile-gallery-chrome="left"
      data-tooltip-relaxed="true"
      data-tooltip-delay="0"
    >
      {/* Add button — hover to open node picker */}
      <button
        id="btn-add-node"
        type="button"
        className={`sidebar-btn-v3 add-btn-v3 ${nodePickerOpen ? 'active' : ''}`}
        onMouseEnter={handleAddEnter}
        onMouseLeave={handleAddLeave}
        onClick={() => (nodePickerOpen ? closeRailPicker() : openRailPicker())}
        aria-label={t('添加节点')}
      >
        {/* Normal: plus — 官方 tabler-icon-plus（20×20 · stroke-width 2） */}
        <svg className="ico-normal" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5l0 14" />
          <path d="M5 12l14 0" />
        </svg>
        {/* Hover/active: cross */}
        <svg className="ico-hover" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6l-12 12" />
          <path d="M6 6l12 12" />
        </svg>
        {/* 官方实测：白圆右上角一枚 8×8 圆点徽标 rgb(144,196,229) */}
        <span className="rail-dot-badge" aria-hidden="true" />
      </button>

      {/* 节点搜索 — 官方竖条第 2 件（图标用从官方 DOM 抠出的原文件 rail/node-search.svg）
          ★ 原来的 `onClick={() => openRailPicker()}` 是**错的**（那正是「添加节点」的入口 ✗）：
            官方这一件是**独立的节点搜索面板**（组件 `Hxe` → 弹窗 `Vxe`，源码 @char1536660）✓ */}
      <button
        type="button"
        /* 官方 `Hxe`：面板打开时按钮加 `bg-sidebar-accent text-sidebar-accent-foreground`（= MTV 的 rail hover 变量） */
        className={`sidebar-btn-v3${nodeSearchOpen ? ' rail-node-search-open' : ''}`}
        data-tooltip={t('节点搜索')}
        data-tooltip-pos="right"
        aria-label={t('节点搜索')}
        onClick={() => setNodeSearchOpen(true)}
      >
        <OfficialIcon name="rail-node-search" size={20} />
      </button>

      {/* 素材库 — 官方竖条第 3 件（★ 用户指示：素材按钮与模板按钮**顺序对调** ⇒ 素材到第 3 件）
          = MTV 原来的「资产」，功能不变，只改名+换官方图标 */}
      <button
        type="button"
        className="sidebar-btn-v3"
        data-tooltip={unreadDramaAssetCount > 0 ? t('素材库 · 新增短剧资产 ({count})', { count: unreadDramaAssetCount }) : t('素材库')}
        data-tooltip-pos="right"
        aria-label={t('素材库')}
        onClick={() => setAssetsPanelOpen(true)}
      >
        <OfficialIcon name="rail-assets" size={20} />
        {unreadDramaAssetCount > 0 ? (
          <span className="sidebar-badge">
            {unreadDramaAssetCount > 99 ? '99+' : unreadDramaAssetCount}
          </span>
        ) : null}
      </button>

      {/* 模板 — 官方竖条第 4 件（原「画布 / 项目」入口让位给模板，按用户指示；
          用户："「画布 / 项目」接入模板"。MTV 暂无模板系统 → 先照抄外观，逻辑先放着 */}
      <button
        type="button"
        className="sidebar-btn-v3"
        data-tooltip={t('模板')}
        data-tooltip-pos="right"
        aria-label={t('模板')}
        onClick={(event) => event.preventDefault()}
      >
        <OfficialIcon name="rail-template" size={20} />
      </button>

      {/* 画布统计 — 官方竖条第 5 件的位置（用户 2026：把原来的「打开评论」替换成它）。
          复刻自 Artigine「画布统计」：纯前端聚合当前画布节点，出 KPI + 类型分布甜甜圈。 */}
      <button
        type="button"
        className={`sidebar-btn-v3${canvasStatsOpen ? ' rail-node-search-open' : ''}`}
        data-tooltip={t('画布统计')}
        data-tooltip-pos="right"
        aria-label={t('画布统计')}
        onClick={() => setCanvasStatsOpen(true)}
      >
        <OfficialIcon name="rail-stats" size={20} />
      </button>

      {/* 历史 — 官方竖条第 6 件（原「输出历史」，功能不变，只改名+换官方图标） */}
      <button
        type="button"
        className="sidebar-btn-v3"
        data-tooltip={t('历史')}
        data-tooltip-pos="right"
        aria-label={t('历史')}
        onClick={() => setHistoryPanelOpen(true)}
      >
        <OfficialIcon name="rail-history" size={20} />
      </button>

      {/* Task Center */}
      {/* <button type="button" className="sidebar-btn-v3 task-center-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 6h11" strokeLinecap="round" />
          <path d="M9 12h11" strokeLinecap="round" />
          <path d="M9 18h11" strokeLinecap="round" />
          <path d="M4 6l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 12l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 18l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="task-center-tooltip">
          <span>任务</span>
          <span className="task-center-tooltip-beta">beta</span>
        </span>
      </button> */}

      {/* Separator */}
      <div className="sidebar-sep-v3" />

      {/* Settings / Avatar */}
      <div className="avatar-wrap">
        {/* ★ 这个按钮**不要悬浮气泡**（用户：「设置按钮的 悬浮气泡提示 移除掉」）——
            提示系统就是 `[data-tooltip]` 的纯 CSS `::after`（见 styles/tooltip.css），
            所以这里**不挂 `data-tooltip` / `data-tooltip-pos`** 即可；
            竖条容器上那两条 `data-tooltip-relaxed` / `data-tooltip-delay` 是给**其余**按钮的，保持不动 ✓ */}
        <button
          id="btn-user-gear"
          type="button"
          className="user-gear-plain"
          onClick={toggleAvatarMenu}
          aria-label={t('设置')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
        </button>
        <AvatarMenu />
      </div>

      {/* Node Picker popup */}
      <NodePicker onEnter={handlePickerEnter} onLeave={handlePickerLeave} />

      {/* 官方「节点搜索」弹窗（`Vxe`）—— 自己 portal 到 body，放这里只为挂在同一棵组件树 ✓ */}
      <NodeSearchPanel open={nodeSearchOpen} onOpenChange={setNodeSearchOpen} />

      {/* 画布统计弹窗 —— 同样自己 portal 到 body */}
      <CanvasStatsDialog open={canvasStatsOpen} onClose={() => setCanvasStatsOpen(false)} />
    </aside>
  );
}
