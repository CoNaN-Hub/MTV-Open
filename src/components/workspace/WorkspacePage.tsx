/**
 * WorkspacePage —— MTV「工作空间」页（官方 TapNow 工作空间壳层 1:1）
 * ══════════════════════════════════════════════════════════════════════════
 * 官方源码：`index-BsHyQ2qj.js` @12229505（`XTl` —— 工作空间顶栏）
 *   `nza = 28`（顶部拖拽区）/ `aza = 56`（导航条）/ `rza = nza + aza = 84`
 *   `<header className="fixed top-0 left-0 right-0 z-50 box-border text-foreground" style={{height: rza}}>`
 *     `<div aria-hidden className="w-full shrink-0" style={{height: nza}} />`
 *     `<div className="relative flex w-full min-w-0 items-center px-3" style={{height: aza}}>`
 *       左 `flex h-full min-w-0 flex-1 items-center justify-start` + 品牌按钮
 *       中 `nav.inline-flex h-full shrink-0 items-center justify-center gap-3 p-2`
 *          item = `span.relative inline-flex overflow-visible rounded-full`
 *               + 选中态 `absolute inset-0 rounded-full bg-white/5` + conic-gradient 描边环
 *               + `button`(`relative z-[1] box-border flex min-w-0 items-center justify-center gap-2
 *                            rounded-full border-0 px-4 py-2 text-base font-[400] transition-colors`)
 *       右 `flex h-full min-w-0 flex-1 items-center justify-end gap-1 text-base font-[400]`
 *   ★ 用户口径：中间**只要 主页 + 我的项目**（官方还有「应用市场」，本页不做）。
 *   导航模型（用户口径）：启动即进本页；点项目卡进画布；画布左上角 logo 回本页。
 */
import { useCallback, useState } from 'react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import TopRightNav from '../TopRightNav';
import WorkspaceHome from './WorkspaceHome';
import WorkspaceProjects from './WorkspaceProjects';
import { HomeNavIcon, ProjectsNavIcon } from './WorkspaceIcons';
import { consumeWorkspaceLandingTab, type WorkspaceTab } from './workspaceLanding';
import BrandFlameButton from '../shared/BrandFlameButton';

/** 官方常量 */
const NZA = 28;   // 顶部拖拽区
const AZA = 56;   // 导航条
const RZA = NZA + AZA;
/** 官方 `KTl`：选中态的 conic-gradient 描边环 */
const KTl = 'conic-gradient(from 270deg at 50% 50%, transparent 0%, rgba(144,144,144,0.45) 25%, transparent 50%, rgba(144,144,144,0.45) 75%, transparent 100%)';
/** 官方 `GNe` */
const GNE = 'text-[#E6E6E6]';

export type { WorkspaceTab } from './workspaceLanding';

export default function WorkspacePage() {
  const t = useT();
  /* 官方：`workspaceOpen` 为假时整页不渲染 ⇒ 每次打开都是新挂载，落地页签在挂载时消费一次 */
  const [tab, setTab] = useState<WorkspaceTab>(consumeWorkspaceLandingTab);

  const close = useCallback(() => {
    useAppStore.getState().setProjectLibraryOpen(false);
  }, []);

  const openProject = useCallback((id: string) => {
    const store = useAppStore.getState();
    store.setProjectLibraryOpen(false);
    store.switchProject(id, { captureSnapshot: true });
  }, []);

  const createProject = useCallback((collectionId?: string) => {
    const store = useAppStore.getState();
    /* ★ 官方工作空间「新建项目」：名字**写死 `Untitled`**（不本地化），
       且当前打开着文件夹时把新画布直接建进去（`parent_id = 打开的文件夹 id`）——
       与**画布顶部切换器**的「新建画布」（官方 `Za()` ⇒ `画布 N`）是两条不同规则。 */
    void store.createProject('Untitled', { collectionId }).then((id) => {
      if (id) {
        store.setProjectLibraryOpen(false);
        store.switchProject(id, { captureSnapshot: true });
      }
    });
  }, []);

  /**
   * 首页输入条「发一句就开始」。
   * 官方证据：`index-bundle.js` @1425705 `Sz` —— 建画布后 `getPath` 返回
   * `/canvas/{id}?chat_mode=agent`（`d==="agent"`），`navigateState` 带
   * `{agentQuery, openAgentPanel:true, starterWideAgentPanel:true}`；
   * @1599900 消费侧从全局状态读 `agentQuery` 并自动发出。
   * ⇒ 这里等价：新建项目（官方工作空间文案写死 `Untitled`）→ 交给画布自动发这句。
   */
  const startAgentConversation = useCallback((query: string) => {
    const store = useAppStore.getState();
    void store.createProject('Untitled').then((id) => {
      if (!id) return;
      store.setPendingAgentQuery(query);
      /* 官方 `navigateState` 里带 `openAgentPanel: true`（`index-bundle.js` @1425705）：
         进画布的同时**把助手面板打开**，否则问句发出去了但面板是收起的（实机验收发现）。 */
      store.openChat();
      store.setProjectLibraryOpen(false);
      store.switchProject(id, { captureSnapshot: true });
    });
  }, []);

  const items: { key: WorkspaceTab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    { key: 'home', label: t('主页'), icon: (active) => <HomeNavIcon size={18} active={active} className="shrink-0" /> },
    { key: 'projects', label: t('我的项目'), icon: (active) => <ProjectsNavIcon size={18} active={active} className="shrink-0" /> },
  ];

  const dragRegion = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <div className="ws-root fixed inset-0 z-[80] flex h-full w-full flex-col" data-testid="workspace-page">
      <header
        className="fixed left-0 right-0 top-0 z-50 box-border text-[#f5f5f5]"
        style={{ height: RZA, ...dragRegion }}
        data-testid="workspace-header"
      >
        <div aria-hidden className="w-full shrink-0" style={{ height: NZA }} />
        <div className="relative flex w-full min-w-0 items-center px-3" style={{ height: AZA }}>
          {/* 左：品牌按钮（官方 `flex h-10 ... gap-2 rounded-lg px-1.5`） */}
          <div className="flex h-full min-w-0 flex-1 items-center justify-start" style={noDrag}>
            <button
              type="button"
              /* ★ 用户 2026：这枚 logo 换成火焰动画版；整盘点击落到**「主页」**（原来是「我的项目」） */
              onClick={() => setTab('home')}
              data-testid="workspace-logo"
              className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-1.5 transition-colors hover:bg-white/5"
            >
              <span className="flex h-10 items-center">
                {/* 火焰 logo（官方 `LogoShader`）：hover 推节流阀 + 挂载时一次点火爆发。
                    尺寸沿用原标记的**宽度 40** ⇒ 40×40（`<= 64` ⇒ 官方 small 变体）。
                    ⚠️ 用户口径：**不要悬浮提示气泡**，所以不挂 `data-tooltip`；
                    点击由外层这个大盘按钮统一负责 ⇒ 这里**不给 `onActivate`**。 */}
                <BrandFlameButton label={t('主页')} size={40} autoIgnite />
              </span>
              <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-[#90C4E5] px-2 text-[10px] font-semibold leading-none text-[#90C4E5]" style={{ background: 'rgba(31,162,220,0.12)' }}>
                BETA
              </span>
            </button>
          </div>

          {/* 中：主导航（官方 `gap-3 p-2`，选中态叠 `bg-white/5` + conic 描边环） */}
          <nav
            className="inline-flex h-full shrink-0 items-center justify-center gap-3 p-2"
            aria-label="Primary"
            style={noDrag}
            data-testid="workspace-nav"
          >
            {items.map((item) => {
              const active = tab === item.key;
              return (
                <span key={item.key} className="relative inline-flex overflow-visible rounded-full">
                  {active ? (
                    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                      <span className="absolute inset-0 rounded-full bg-white/5" />
                      <span
                        className="pointer-events-none absolute inset-0 rounded-full"
                        style={{
                          background: KTl,
                          padding: '1px',
                          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                          WebkitMaskComposite: 'xor',
                          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                          maskComposite: 'exclude',
                        }}
                      />
                    </span>
                  ) : null}
                  <button
                    type="button"
                    data-testid={`workspace-nav-${item.key}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setTab(item.key)}
                    className={`group relative z-[1] box-border flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-full border-0 px-4 py-2 text-base font-[400] transition-colors ${
                      active ? 'text-[#f5f5f5]' : `${GNE} hover:bg-white/5 hover:text-[#f5f5f5]`
                    }`}
                  >
                    {item.icon(active)}
                    {item.label}
                  </button>
                </span>
              );
            })}
          </nav>

          {/* 右：沿用 MTV 自己的右上角导航（官方这里是「价格方案 / 通知 / 头像组」，MTV 无价格方案，不臆造） */}
          <div className="flex h-full min-w-0 flex-1 items-center justify-end gap-1 text-base font-[400]" style={noDrag}>
            <TopRightNav
              setCharacterLibraryOpen={(open) => {
                close();
                useAppStore.getState().setCharacterLibraryOpen(open);
              }}
            />
          </div>
        </div>
      </header>

      {/* 内容区：官方给 shell 加 `paddingTop: rza` */}
      <div className="relative z-10 flex h-full w-full min-h-0 flex-col" style={{ paddingTop: RZA }}>
        {tab === 'home' ? (
          <WorkspaceHome
            onOpenProject={openProject}
            onCreateProject={createProject}
            onStartAgentConversation={startAgentConversation}
            onViewAll={() => setTab('projects')}
          />
        ) : (
          <WorkspaceProjects onOpenProject={openProject} onCreateProject={createProject} />
        )}
      </div>
    </div>
  );
}
