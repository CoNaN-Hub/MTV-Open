/**
 * WorkspaceHome —— 官方 TapNow 首页（「主页」）1:1 移植
 * ══════════════════════════════════════════════════════════════════════════
 * 官方源码：`index-DdHBXEd8.js` 的 `Js()`（hero）+ `mn`（输入框）+ `Gs`（项目卡片）
 * 页面容器（实测 off-home-tree.txt）：`mx-auto min-h-full w-full pb-20 pt-16 max-w-[1920px]`（pt 64 / pb 80）
 *
 * ★ 范围（用户口径）：**只做图2 那段** —— 标题 + 输入框工具栏 + chips + 项目卡片横排 +「所有项目」；
 *   官方下面还有 Astra / MINIMAX H3 / SEEDANCE 2.5 促销、TapTV、竞技场、模板库、页脚，**一律不要**。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@iconify/react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { BlankCanvasCover } from '../projectLibrary/ProjectCovers';
import WorkspaceDotsBackground from './WorkspaceDotsBackground';
import HomeSuggestionOverlay from './HomeSuggestionOverlay';
import HomeSkillsPanel from './HomeSkillsPanel';
import HomeConnectorsBadge from './HomeConnectorsBadge';
/* 官方首页 chips 的**内置默认图标**（`index-bundle.js` @1648xxx 的 `qp` / `Vp` / `Bp`），
   已逐字下载/解码到本地，离线可用。 */
import whiteboxIcon from '../../assets/official-icons/home-app-whitebox-to-film-icon.png';
import depthStudioIcon from '../../assets/official-icons/home-app-depth-video-studio-icon.svg';
import castingRoomIcon from '../../assets/official-icons/home-app-casting-room-icon.png';
import BrandFlameButton from '../shared/BrandFlameButton';
import ModelSelector from '../nodes/shared/ModelSelector';
import ChatModelChip from '../chat/ChatModelChip';
import AgentModelFlyout from '../chat/AgentModelFlyout';
import GenerationConfirmModeSwitch from '../chat/GenerationConfirmModeSwitch';

/** 官方卡片时间文案：「编辑于 X」（相对时间） */
function relativeEdited(ts: number, t: (text: string, vars?: Record<string, string | number>) => string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (minutes < 1) return t('刚刚');
  if (minutes < 60) return t('{n} 分钟前', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('{n} 小时前', { n: hours });
  return t('{n} 天前', { n: Math.floor(hours / 24) });
}

/**
 * MTV 品牌标（官方这里是 44×44 按钮内嵌 36×36 的动态 orb）。
 * ★ 用户 2026：换成**火焰动画版**并放大（原图 30 → 48），且明确要求
 *   —— **没有点击功能**、**不要悬浮提示气泡** ⇒ 不给 `onActivate`（组件此时渲染
 *   一块不可点的表面，也不会挂 `data-tooltip`）。
 */
function BrandOrb() {
  return <BrandFlameButton label="MTV" size={48} autoIgnite className="z-0 shrink-0" />;
}

/**
 * 官方首页 chips = **写死的 3 条**（`index-bundle.js` @1648545 `vV`，逐字）：
 * ```js
 * vV=[{id:"whitebox-to-film",catalogKind:"skill",pluginName:"whitebox-to-film",title:"Whitebox Video Previs",icon:qp,tileIcon:qp},
 *     {id:"depth-video-studio",catalogKind:"skill",pluginName:"depth-video-studio",title:"Depth Filmmaking Studio",icon:Vp,tileIcon:Vp},
 *     {id:"casting-room",pluginName:"casting-room",title:"Casting Room",icon:Bp,tileIcon:Bp}]
 * ```
 * 标题/图标由应用市场目录 `Wg({userId,orgId,locale})` 覆盖（中文实测：白模视频预演 / 深度影视工坊 / 角色工坊）；
 * 点击官方跳 `/home/app-store?detail=skill&name=<pluginName>`（同文件 `wV` 的 `onSelect`）。
 *
 * 图标 = 官方**内置默认值**（同文件 @1648xxx 逐字）：
 *   · `qp` = `.../assets/home-app-whitebox-to-film-icon-Dxeci8dh.png`
 *   · `Bp` = `.../assets/home-app-casting-room-icon-Bw2wWoJf.png`
 *   · `Vp` = 一段内联 SVG data-URI（已逐字解码落盘为 `home-app-depth-video-studio-icon.svg`）
 * 三张图已下载到 `src/assets/official-icons/`，**离线可用**，不再依赖 fe-assets 域名。
 *
 * ⚠️ MTV 没有「应用市场」页 ⇒ 等价承载 = MTV 的官方「管理技能」面板（`SkillsManagerDialog` 的技能页签）。
 *    这是**已记账的实现差异**，不是设计差异：目标「点 chip 能进到对应技能」在 MTV 侧同样成立。
 */
const HOME_CAPABILITY_CARDS = [
  {
    id: 'whitebox-to-film',
    pluginName: 'whitebox-to-film',
    labelKey: '白模视频预演',
    icon: whiteboxIcon,
  },
  {
    id: 'depth-video-studio',
    pluginName: 'depth-video-studio',
    labelKey: '深度影视工坊',
    icon: depthStudioIcon,
  },
  {
    id: 'casting-room',
    pluginName: 'casting-room',
    labelKey: '角色工坊',
    icon: castingRoomIcon,
  },
] as const;

export interface WorkspaceHomeProps {
  /** 打开某个项目（进入画布） */
  onOpenProject: (id: string) => void;
  /** 新建项目 */
  onCreateProject: () => void;
  /**
   * 输入条「发一句就开始」：官方是「带 agent_query 建项目 → `/canvas/{id}?chat_mode=agent`
   * → agent 面板自动发出这句」（`index-bundle.js` @1425705 `Sz` 的生产侧 +
   * @1599900 的 `agentQuery` 消费侧）。MTV 侧由宿主建项目并把问句交给画布。
   */
  onStartAgentConversation: (query: string) => void;
  /** 「所有项目」→ 切到「我的项目」页 */
  onViewAll: () => void;
}

export default function WorkspaceHome({
  onOpenProject,
  onCreateProject,
  onStartAgentConversation,
  onViewAll,
}: WorkspaceHomeProps) {
  const t = useT();
  const projects = useAppStore((s) => s.projects);
  /* 官方首页/画布输入条共用的「选中模型」= 全局 `selectedModel`（MTV 对位 `config.assistantModelId`）。 */
  const assistantModelId = useAppStore((s) => s.config.assistantModelId);
  const updateConfig = useAppStore((s) => s.updateConfig);
  /** 官方首页那颗两态开关读全局 `AGENT_PREFS.generation_confirm_mode`；MTV 对位是 `config.agentDefaultMode`。 */
  const agentDefaultMode = useAppStore((s) => s.config.agentDefaultMode ?? 'collaborative');
  /** 官方首页「技能」按钮打开「管理技能」面板（`skills.title = 技能`，见 `HomeSkillsPanel`）。 */
  const setHomeSkillsOpen = useAppStore((s) => s.setHomeSkillsOpen);
  const setHomeSkillsTab = useAppStore((s) => s.setHomeSkillsTab);
  /** 官方 `addButtonAlignRef`：确认模式菜单的 `alignOffset` 要参考「+」按钮的左边界。 */
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const modelIsAuto = !assistantModelId;
  const [draft, setDraft] = useState('');
  const draftRef = useRef<HTMLTextAreaElement | null>(null);

  /* ── 输入框**自动长高**（官方逐字，`index-bundle.js` @1658345 邻域）────────────────
     官方那段是：
     ```js
     useEffect(()=>{ const Y=D.current; if(!Y) return; Y.style.height="auto";
       const fe=Math.min(Math.max(Y.scrollHeight,$p),Wp);   // $p=36(最小) Wp=140(最大)
       Y.style.height=`${fe}px` },[R,F.length,l.length]);
     ```
     也就是：每次内容变化先 `height:auto` 再量 `scrollHeight`，夹在 36–140px 之间。
     ⚠️ 少了这段会怎样（用户实测：「你看这个输入框 我真的服了」）：建议条塞进去的长 prompt
        只显示两行、第二行还被切掉 —— 因为 textarea 永远停在 `min-h-[36px]`。 */
  useEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 140)}px`;
  }, [draft]);

  /** 官方首页只展示「顶层项目」的前 3 张（第 4 格是「新建项目」磁贴） */
  const recent = useMemo(
    () => projects.filter((p) => !p.parentId).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3),
    [projects],
  );

  const submit = useCallback(() => {
    /* 官方（`index-bundle.js` @1425705 `Sz` + @1599900）：新建画布并把 `agentQuery`
       交给画布 ⇒ `/canvas/{id}?chat_mode=agent` 打开 agent 面板后**自动发出这一句**。
       不是「预填输入框」，也不是「只建个空项目」。 */
    const query = draft.trim();
    if (!query) return;
    setDraft('');
    onStartAgentConversation(query);
  }, [draft, onStartAgentConversation]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }, [submit]);

  /** 官方发送钮的态：有内容才亮（`bg-white/20 text-white`） */
  const canSend = draft.trim().length > 0;

  return (
    <div className="ws-scroll relative min-h-full w-full overflow-y-auto overflow-x-hidden px-7">
      {/* 官方首页的点阵背景（`Gr`）：只在「主页」。
          官方把 `Gr` 挂在**首页内容**的 `div.relative` 上（面罩高度 = 内容高度，首页内容比视口高 ⇒ 整屏都有点阵）；
          MTV 的首页内容高度 ≈ 视口高，若直接用官方面罩（30%→70% 渐隐）会在屏幕下半截断掉。
          这里保持面罩数值逐字不变，把绘制区高度放大到视口高的 100/0.7 ≈ 143%，
          使官方那条渐隐曲线正好在**视口底部**收完 —— 整个背景都有点阵（用户口径）。 */}
      <div className="pointer-events-none fixed left-0 top-0 z-0 w-full" style={{ height: '143vh' }}>
        <WorkspaceDotsBackground breathing intensity={1} />
      </div>
      <div className="mx-auto min-h-full w-full max-w-[1920px] pb-20 pt-16">
        <div className="relative">
          <div className="relative z-[1] flex flex-col">
          {/* ── hero：官方 `flex flex-col items-center gap-[24px] pt-12` ── */}
          <div className="flex flex-col items-center gap-[24px] pt-12">
            {/* 标题行：官方 `max-w-[780px] ... gap-1 sm:gap-1.5` */}
            <div className="mx-auto flex w-full max-w-[780px] flex-wrap items-center justify-start gap-1 pl-0 sm:gap-1.5">
              <div className="shrink-0">
                <BrandOrb />
              </div>
              <h2 className="m-0 text-[36px] font-normal leading-[44px] tracking-tighter text-[#F5F5F5]">
                {t('今天要做点什么？')}
              </h2>
            </div>

            <div className="flex w-full flex-col items-center gap-4">
              {/* ── 输入框：官方 `mn` ── */}
              <div className="relative isolate z-20 mx-auto w-full max-w-[780px]">
                <div className="relative z-10 flex w-full flex-col overflow-hidden rounded-[24px] bg-[#161616] px-1 pt-1">
                  <div className="relative z-[1] flex w-full flex-col gap-3 rounded-[20px] border border-white/10 bg-[#1D1D1D] px-4 pb-2 pt-3 shadow-[0_0.5px_0_0_rgba(255,255,255,0.16)_inset]">
                    <div className="relative min-w-0">
                      {/* 官方（@1658345）`placeholder:""` —— 提示语**不由 placeholder 承担**，
                          而是下面那条会打字循环的建议条（官方 `L` 非空时渲染）。 */}
                      <textarea
                        ref={draftRef}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        placeholder=""
                        aria-label={t('开始一段灵感对话...')}
                        data-testid="workspace-home-input"
                        className="relative z-0 max-h-[140px] min-h-[36px] w-full min-w-0 resize-none overflow-y-auto bg-transparent px-0.5 py-1 text-sm font-normal leading-5 text-white outline-none placeholder:text-[#a3a3a3]"
                      />
                      {!draft.trim() && (
                        <HomeSuggestionOverlay onPick={(prompt) => setDraft(prompt)} />
                      )}
                    </div>
                    {/* 工具栏：官方 `flex w-full items-center justify-between gap-3` */}
                    <div className="flex w-full items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="relative flex items-center">
                          <button
                            type="button"
                            ref={addButtonRef}
                            aria-label={t('添加附件')}
                            className="flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/10 p-0 text-[#f5f5f5] transition-colors hover:bg-white/15"
                          >
                            <Icon icon="lucide:plus" width={16} height={16} />
                          </button>
                        </div>
                        <div className="inline-flex">
                          {/* 官方输入条左侧这颗「手动确认 / 自动生成」两态开关就是 `GenerationConfirmModeSwitch`
                              （`use-chat-attachment-file-input-BcpbCD8t.js` @168588，逐字移植在
                              `src/components/chat/GenerationConfirmModeSwitch.tsx`）。官方首页读全局
                              `AGENT_PREFS.generation_confirm_mode`；MTV 的对位是 `config.agentDefaultMode`
                              （新建会话时写进 `conversation.agentMode`，见 `store.chat.ts:559`）。
                              原来这里是一颗写死的假按钮：`chatAdapter.confirmMode.ask` 文案 + 点了没反应 ✗。 */}
                          <GenerationConfirmModeSwitch
                            mode={agentDefaultMode}
                            onChange={(mode) => updateConfig({ agentDefaultMode: mode })}
                            addButtonAlignRef={addButtonRef}
                          />
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {/* 官方首页输入条与画布里的输入条**是同一个** `AgentModelPicker`
                            （`vbe`：`const vbe=a.memo(function({standalone:t=!1,...n}){…})`，
                             `standalone` 只影响「会话已开始 ⇒ 锁模型」的判定，首页传 true）。
                            官方那颗胶囊后面挂着 `dbe` 整个面板 + `cbe` 悬浮飞出面板
                            （`fixed z-120 w-[240px]`，模型信息卡 + `思考强度`），
                            ⇒ 首页这颗也必须是**真选择器**，不能是装饰性按钮。
                            （原来这里是一颗手写的假按钮：点了什么都不发生 ⇒ 用户看不到弹层。） */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          <ModelSelector
                            nodeType="ai-text"
                            selectedModel={assistantModelId}
                            onSelect={(model) => updateConfig({ assistantModelId: model.value })}
                            /* 官方 `Ae`：聊天输入条那颗**有** `chevron-down` 的模型胶囊。 */
                            renderTrigger={({ open: chipOpen, label, icon, toggle, secondary }) => (
                              <ChatModelChip
                                label={label}
                                icon={modelIsAuto ? undefined : icon}
                                open={chipOpen}
                                /* 官方 `Ae` 的 `H`：档位标签 / 「思考关闭」 */
                                secondary={secondary ?? undefined}
                                ariaLabel={label}
                                onClick={toggle}
                              />
                            )}
                            dropdownClassName="c-pop"
                            /* 官方「模型信息 + 思考强度」悬浮飞出面板（`cbe` → `bye` + `NR`）。 */
                            renderModelFlyout={(model, info) => <AgentModelFlyout model={model} info={info} />}
                            agentStyle
                            autoSelected={modelIsAuto}
                            onSelectAuto={() => updateConfig({ assistantModelId: undefined })}
                          />
                        </div>
                        <div className="relative flex min-w-0 items-center gap-1">
                          {/* 官方这颗麦克风是**真录音组件**（`index-bundle.js` @1658638 附近的 `K0`：
                              props 有 `analyserNode / onStart / onStop / onCancel / variant: Y0.Agent`，
                              录完把音频交给服务端转写再回填输入框）。
                              MTV 全仓没有录音实现（`getUserMedia` / `MediaRecorder` 零命中），
                              也没有转写后端 ⇒ 这里**明确置灰**并给出说明，而不是留一颗点了没反应的假按钮
                              （用户口径：假的按钮比没有更糟）。要做就按官方 `K0` 的交互另立一项。 */}
                          <button
                            type="button"
                            aria-label={t('语音输入（暂未接入）')}
                            title={t('语音输入暂未接入')}
                            disabled
                            data-testid="workspace-home-mic"
                            className="relative flex size-8 shrink-0 cursor-not-allowed items-center justify-center overflow-visible rounded-full p-0 text-[#f5f5f5] opacity-45"
                          >
                            <Icon icon="lucide:mic" width={16} height={16} />
                          </button>
                          {/* 官方发送钮（`index-DdHBXEd8.js` @113209 逐字）：
                              有内容 `bg-white/20 text-white hover:bg-white/28`，无内容 `bg-white/10 text-white/45 hover:bg-white/14`；
                              图标为 16×16 `viewBox="0 0 24 24"` 两条 path：`m5 12 7-7 7 7` + `M12 19V5` */}
                          <button
                            type="button"
                            aria-label={t('发送')}
                            data-testid="workspace-home-send"
                            onClick={submit}
                            disabled={!canSend}
                            className={`flex size-8 items-center justify-center rounded-full transition-[background-color,color] duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                              canSend ? 'bg-white/20 text-white hover:bg-white/28' : 'bg-white/10 text-white/45 hover:bg-white/14'
                            }`}
                          >
                            <svg
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
                              <path d="m5 12 7-7 7 7" />
                              <path d="M12 19V5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* chips 行：官方 `flex items-center justify-between gap-2 px-4 py-1.5`
                      （实测 DOM：`<section data-testid="home-agent-use-case-section">` +
                      `<div data-testid="home-capability-grid">`，chip 是
                      `button[data-testid="home-capability-trend-card"]`） */}
                  <div className="relative z-[1] flex items-center justify-between gap-2 px-4 py-1.5">
                    <section className="flex min-w-0 items-center" data-testid="home-agent-use-case-section">
                      <div className="flex min-w-0 flex-wrap items-center justify-start gap-1" data-testid="home-capability-grid">
                        {HOME_CAPABILITY_CARDS.map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            data-testid="home-capability-trend-card"
                            data-plugin={card.pluginName}
                            onClick={() => setHomeSkillsOpen(true)}
                            /* 官方实测 DOM（CDP 9222 /home）逐字：
                               `group inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border
                                bg-[#1A1A1A] px-1 pr-1.5 text-left outline-none transition-[border-color,
                                background-color,color] duration-200 ease-out focus-visible:ring-2
                                focus-visible:ring-white/35 border-transparent text-white/80
                                hover:border-white/15 hover:bg-[#1F1F1F] hover:text-white` */
                            className="group inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-transparent bg-[#1A1A1A] px-1 pr-1.5 text-left text-white/80 outline-none transition-[border-color,background-color,color] duration-200 ease-out hover:border-white/15 hover:bg-[#1F1F1F] hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
                          >
                            {/* 官方 `bV`：`<span class="relative size-5 shrink-0 overflow-hidden">`
                                + `<img src={card.icon} class="absolute inset-0 size-full object-cover" draggable=false>` */}
                            <span className="relative size-5 shrink-0 overflow-hidden" aria-hidden="true">
                              <img
                                src={card.icon}
                                alt=""
                                className="absolute inset-0 size-full object-cover"
                                draggable={false}
                              />
                            </span>
                            <span className="text-[12px] font-medium leading-none tracking-[0.01em]">{t(card.labelKey)}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHomeSkillsOpen(true)}
                        data-testid="workspace-home-skills"
                        /* 官方实测 DOM（CDP 9222 /home）：
                           `inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2
                            text-[12px] font-medium leading-none tracking-[0.01em] text-white/48
                            transition-colors hover:bg-white/[0.05] hover:text-white/82 …` */
                        className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2 text-[12px] font-medium leading-none tracking-[0.01em] text-white/48 transition-colors hover:bg-white/[0.05] hover:text-white/82 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('技能')}
                      </button>
                      {/* 官方那颗 `aria-label="Connectors"` 徽标：3 个 14×14 白方块叠压，
                          里面分别是 Figma / Slack / Linear 的官方 logo（见 `HomeConnectorsBadge`）。
                          原来 MTV 只画了 3 个空白方块 ⇒ 缺 logo。 */}
                      <button
                        type="button"
                        aria-label={t('连接器')}
                        onClick={() => {
                          /* 官方这颗 `aria-label="Connectors"` 打开的是**应用/连接器**侧
                             （bundle @1647071：`U0 includeSystemPlugins` + `onManagePlugin: ()=> s("plugin")`）。
                             MTV 没有独立连接器页 ⇒ 复用「管理技能」面板的**应用**页签等价承载。 */
                          setHomeSkillsTab('plugin');
                          setHomeSkillsOpen(true);
                        }}
                        data-testid="workspace-home-connectors"
                        className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2 transition-colors hover:bg-white/5"
                      >
                        <HomeConnectorsBadge />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 项目卡片：官方 `w-full max-w-[780px] mx-auto flex flex-col gap-4` ── */}
              <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4">
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={onCreateProject}
                    data-testid="workspace-new-project"
                    className="group h-[189px] w-full cursor-pointer rounded-xl border border-white/10 bg-[#1F1F1F] p-2 shadow transition-all duration-200"
                  >
                    <div className="ws-new-project-inner flex h-full flex-col rounded-lg pb-6 transition-all duration-300">
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 pt-6">
                        <Icon icon="lucide:plus" width={20} height={20} className="text-[#f5f5f5]" />
                        <span className="text-xs text-[#f5f5f5]">{t('新建项目')}</span>
                      </div>
                    </div>
                  </button>
                  {recent.map((project) => (
                    <div
                      key={project.id}
                      role="button"
                      tabIndex={0}
                      aria-label={t('打开项目 {name}', { name: project.name })}
                      data-testid={`workspace-project-${project.id}`}
                      onClick={() => onOpenProject(project.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpenProject(project.id);
                        }
                      }}
                      className="group flex aspect-square w-full min-w-0 cursor-pointer flex-col gap-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#1D1D1D] p-2 text-left transition-[border-color,background-color] hover:border-white/15 hover:bg-[#222222]"
                    >
                      <div className="w-full flex-1 overflow-hidden rounded-lg">
                        {project.snapshot
                          ? <img src={project.snapshot} alt="" className="h-full w-full object-cover" />
                          : <BlankCanvasCover seed={project.id} />}
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex min-w-0 items-center justify-between gap-1">
                          <span className="truncate text-xs font-normal leading-[150%] text-[#a3a3a3]">{project.name}</span>
                          <span className="shrink-0 whitespace-nowrap text-xs font-normal leading-[150%] text-[#a3a3a3]">
                            {t('编辑于 {time}', { time: relativeEdited(project.updatedAt, t) })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onViewAll}
                    data-testid="workspace-view-all"
                    className="flex items-center gap-1 text-xs font-normal leading-none text-[#a3a3a3] transition-colors hover:text-white/70"
                  >
                    {t('所有项目')}
                    <Icon icon="lucide:arrow-up-right" width={12} height={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
      {/* 官方「管理技能」面板（`skills.title="技能"`）：首页那颗「技能」按钮直接打开，
          不依赖画布里的 `ChatInput`（两个对话框都只读 store 动作）。 */}
      <HomeSkillsPanel />
    </div>
  );
}
