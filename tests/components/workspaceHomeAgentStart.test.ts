/**
 * 首页「发一句就开始」的接线契约（官方行为 1:1）。
 *
 * 官方证据（`D:\DEEPSEEK\index-bundle.js`）：
 *   · @1425705 `Sz`（banner/CTA 的建画布入口）：把 `agent_query` 收进
 *     `navigateState.agentQuery`，并给 `getPath` 拼 `?chat_mode=agent`，
 *     同时 `openAgentPanel: !0, starterWideAgentPanel: !0`；
 *   · @1599900（消费侧）：`if(!(!a||a.userId!==e||typeof a.agentQuery!="string"))`
 *     → `return {userId, agentQuery, agentAttachments, suggestionContext, starterWideAgentPanel}`
 *     ⇒ 官方是「全局状态里的 agentQuery，在画布里**自动发出**」，不是只预填输入框。
 *
 * MTV 没有路由 state ⇒ 用 `pendingAgentQuery` 承担同一条交接：
 *   首页 submit → 宿主建项目 + `setPendingAgentQuery` → `switchProject`
 *   → ChatPanel 在会话就绪后 `sendMessageText(问句)`。
 *
 * ⚠️ 这条链路最容易被"顺手退回纯 UI"（只 toast 一句、或只 `onCreateProject()`）改坏 ——
 *    那样首页又变回「什么都不会发生」。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (rel: string) => readFileSync(new URL(`../../src/${rel}`, import.meta.url), 'utf8');

describe('首页输入条 → 画布 agent 自动发问', () => {
  it('首页 submit 走 onStartAgentConversation（不是自己建个空项目 + toast）', () => {
    const home = src('components/workspace/WorkspaceHome.tsx');
    expect(home).toContain('onStartAgentConversation: (query: string) => void;');
    expect(home).toContain('onStartAgentConversation(query);');
    /* 旧的假实现：只建项目 + 「请在画布内对话助手继续」 */
    expect(home).not.toContain('已新建项目，请在画布内对话助手继续');
    expect(home).not.toContain('void onCreateProject();');
  });

  it('宿主先写 pendingAgentQuery 再切项目', () => {
    const page = src('components/workspace/WorkspacePage.tsx');
    const at = page.indexOf('store.setPendingAgentQuery(query)');
    expect(at, 'WorkspacePage 没有把问句交给画布').toBeGreaterThan(-1);
    expect(page.indexOf('store.switchProject(id', at)).toBeGreaterThan(at);
    /* 官方 `navigateState` 带 `openAgentPanel: true`（@1425705）⇒ 进画布必须顺手把助手面板打开，
       否则问句发出去了但面板收着（2026 实机验收踩到：workspace 关了、面板没开）。 */
    expect(page).toContain('store.openChat();');
  });

  it('store 有一条一次性 pendingAgentQuery', () => {
    const store = src('store/store.chat.ts');
    expect(store).toContain('pendingAgentQuery: string | null;');
    expect(store).toContain('pendingAgentQuery: null,');
    expect(store).toContain('setPendingAgentQuery: (query) => set({ pendingAgentQuery: query }),');
  });

  it('ChatPanel 消费它：有会话直接发，没会话先建会话再发', () => {
    const panel = src('components/chat/ChatPanel.tsx');
    expect(panel).toContain('state.pendingAgentQuery');
    expect(panel).toContain('sendMessageText(query);');
    expect(panel).toContain('pendingAgentSendRef.current = query;');
    expect(panel).toContain('handleNewConversation();');
  });

  it('「手动确认」是真开关（GenerationConfirmModeSwitch），不是写死的胶囊', () => {
    const home = src('components/workspace/WorkspaceHome.tsx');
    expect(home).toContain('<GenerationConfirmModeSwitch');
    expect(home).toContain("updateConfig({ agentDefaultMode: mode })");
    /* 旧实现：一颗写死 ask 文案的按钮 */
    expect(home).not.toContain("{t('chatAdapter.confirmMode.ask')}</span>");
  });

  it('空态建议条 = 官方打字循环（不是 placeholder 文案）', () => {
    const home = src('components/workspace/WorkspaceHome.tsx');
    /* 官方 @1658345 `placeholder:""`：提示语只由覆盖层承担 */
    expect(home).toContain('placeholder=""');
    expect(home).toContain('<HomeSuggestionOverlay onPick={(prompt) => setDraft(prompt)} />');
    const overlay = src('components/workspace/HomeSuggestionOverlay.tsx');
    /* 官方 @1652884 `jV`：55 / 1100 / 22 / 光标 `_` */
    expect(overlay).toContain('const TYPING_SPEED = 55;');
    expect(overlay).toContain('const PAUSE_DURATION = 1100;');
    expect(overlay).toContain('const DELETING_SPEED = 22;');
    expect(overlay).toContain("const CURSOR = '_';");
    /* 官方 @1656712 `K`：点击只**填输入框**（`normalizeHomePrompt(prompt)`），不发送 */
    expect(overlay).toContain('onPick(normalizeHomePrompt(current.prompt));');
    /* 数据源必须是官方那 150 条兜底，不是自造文案 */
    expect(overlay).toContain('homepageFallbackSuggestions(');
  });

  it('项目画廊读真实 store 项目（顶层 · 按 updatedAt 倒序 · 前 3 张）', () => {    const home = src('components/workspace/WorkspaceHome.tsx');
    expect(home).toContain('useAppStore((s) => s.projects)');
    expect(home).toContain('projects.filter((p) => !p.parentId).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)');
    /* 「编辑于 X」相对时间 + 缩略图 + 进入画布 + 所有项目 */
    expect(home).toContain("t('编辑于 {time}'");
    expect(home).toContain('<BlankCanvasCover seed={project.id} />');
    expect(home).toContain('onClick={() => onOpenProject(project.id)}');
    expect(home).toContain('onClick={onViewAll}');
  });

  it('「技能」按钮打开官方「管理技能」面板（复用 SkillsManagerDialog）', () => {
    const home = src('components/workspace/WorkspaceHome.tsx');
    expect(home).toContain('onClick={() => setHomeSkillsOpen(true)}');
    expect(home).toContain('data-testid="workspace-home-skills"');
    expect(home).toContain('<HomeSkillsPanel />');

    const panel = src('components/workspace/HomeSkillsPanel.tsx');
    expect(panel).toContain('<SkillsManagerDialog');
    expect(panel).toContain('<SkillCreateDialog');
    /* 上传走 store 动作，而不是重写一遍文件选择逻辑 */
    expect(panel).toContain('useAppStore((s) => s.uploadSkill)');

    const store = src('store/store.chat.ts');
    expect(store).toContain('homeSkillsOpen: false,');
    expect(store).toContain('setHomeSkillsOpen: (open) =>');
  });

  it('chips = 官方写死的 3 条（whitebox-to-film / depth-video-studio / casting-room）', () => {
    const home = src('components/workspace/WorkspaceHome.tsx');
    /* 官方 @1648545 `vV` 逐字 */
    expect(home).toContain("pluginName: 'whitebox-to-film'");
    expect(home).toContain("pluginName: 'depth-video-studio'");
    expect(home).toContain("pluginName: 'casting-room'");
    /* 官方实测 DOM 的 testid / 类名锚点 */
    expect(home).toContain('data-testid="home-capability-trend-card"');
    expect(home).toContain('data-testid="home-capability-grid"');
    /* 点击：官方跳 /home/app-store 技能详情；MTV 用「管理技能」面板等价承载 */
    expect(home).toContain('onClick={() => setHomeSkillsOpen(true)}');
    /* 图标 = 官方内置默认值（`qp`/`Vp`/`Bp`），已落盘到 assets/official-icons ⇒ 离线可用 */
    expect(home).toContain("from '../../assets/official-icons/home-app-whitebox-to-film-icon.png'");
    expect(home).toContain("from '../../assets/official-icons/home-app-depth-video-studio-icon.svg'");
    expect(home).toContain("from '../../assets/official-icons/home-app-casting-room-icon.png'");
    expect(home).toContain('<img');
    expect(home).toContain('className="absolute inset-0 size-full object-cover"');
  });

  it('右侧 Connectors 徽标 = 官方 Figma / Slack / Linear 三枚 logo，且点击打开「应用」页签', () => {
    const home = src('components/workspace/WorkspaceHome.tsx');
    expect(home).toContain('<HomeConnectorsBadge />');
    /* 之前这颗是**死按钮**（没有 onClick）⇒ 用户实机点了没反应 */
    expect(home).toContain("setHomeSkillsTab('plugin');");
    expect(home).toContain('data-testid="workspace-home-connectors"');
    const badge = src('components/workspace/HomeConnectorsBadge.tsx');
    /* 官方实测 DOM 的叠压类名与 9×9 viewBox 逐个对得上 */
    expect(badge).toContain('size-3.5 items-center justify-center overflow-hidden rounded-[3px] bg-white');
    expect(badge).toContain("shadow-[0_0_0_1px_#141414]");
    expect(badge).toContain('width="9" height="9" viewBox="0 0 24 24"');
    /* 三家品牌色（Figma 五色 + Slack 四色 + Linear 紫），逐字取自官方 SVG */
    for (const fill of ['#0ACF83', '#A259FF', '#F24E1E', '#FF7262', '#1ABCFE', '#E01E5A', '#36C5F0', '#2EB67D', '#ECB22E', '#5E6AD2']) {
      expect(badge).toContain(fill);
    }
  });

  it('麦克风是「明确置灰」而不是假按钮（MTV 无录音/转写链路）', () => {
    const home = src('components/workspace/WorkspaceHome.tsx');
    expect(home).toContain('data-testid="workspace-home-mic"');
    expect(home).toContain('disabled');
    expect(home).toContain("t('语音输入暂未接入')");
  });
});
