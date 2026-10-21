// @vitest-environment jsdom
/**
 * `SkillsManagerDialog` 的**「应用」页签数据**回归（jsdom）。
 *
 * 官方对照（`vendor-pkg-canvas-ChpWx5JY.js`）：
 *  · `_Y` 管理弹窗 @403990：`r==="plugin" ? s.jsx(FCe,{…}) : s.jsx(BCe,{…})`（@410719）；
 *    sr-only 标题按页签取 `skills.managePluginDialogTitle` / `skills.manageDialogTitle`（@409872）。
 *  · `FCe` 市场列表容器 @351606：错误（`plugins.errors.listFailed` + `common.retry`）
 *    / 加载（`pY` 8 张 `LCe`）/ 空态（`searchQuery.trim() ? plugins.noSearchResults : skills.emptyPlugins`）
 *    / 数据（`RCe` 卡片，`article className=vD aY lY relative`）。
 *  · `RCe` 卡片 @349411：标题 `text-sm font-semibold leading-5 tracking-tight text-white`、
 *    副标题 `dY`（categoryLabel ?? category ?? `plugins.byTapNow`）、描述 `uY`；
 *    未安装 → 右上角 `$r`(Tabler plus,16/1.33) `aria-label=plugins.installPlugin`；已安装 → `Fs`(Tabler check) 徽标。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** 轻量 store 替身：只提供 `SkillsManagerDialog` 读的 4 个字段（避免加载 Tauri / IndexedDB）。 */
const store = vi.hoisted(() => ({
  userSkills: [] as unknown[],
  installedPlugins: [] as unknown[],
  deleteSkill: async () => {},
  showToast: () => {},
}));

const loadPluginMarketplace = vi.fn();

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: typeof store) => unknown) => selector(store),
}));
vi.mock('../../src/services/plugins/pluginMarketplace', () => ({
  loadPluginMarketplace: (...args: unknown[]) => loadPluginMarketplace(...args),
}));

import SkillsManagerDialog from '../../src/components/chat/SkillsManagerDialog';

afterEach(cleanup);

beforeEach(() => {
  loadPluginMarketplace.mockReset();
  store.userSkills = [];
  store.installedPlugins = [];
});

/** 官方 `RCe` 的 `vD`（MTV 用 `bg-card/60`，见 `PluginMarketPanel.tsx` 文件头差异 1）。 */
const MARKET_CARD_CLASS = 'flex min-h-[109px] w-full flex-col gap-1.5 self-stretch rounded-2xl border border-white/[0.08] bg-card/60 py-3 px-4 group transition-[border-color,background-color] duration-200 ease-out hover:border-white/[0.12] hover:bg-white/[0.04] relative';
/** 官方 `dY` / `uY`。 */
const MARKET_SUBTITLE_CLASS = 'w-full truncate text-xs font-normal leading-[18px] text-white/60 transition-colors duration-200 group-hover:text-white/[0.72]';
const MARKET_DESC_CLASS = 'line-clamp-2 w-full text-xs font-normal leading-[18px] text-white/60 transition-colors duration-200 group-hover:text-white/[0.72]';
/** 官方 `MCe` / `PCe`。 */
const MARKET_INSTALL_BUTTON_CLASS = 'absolute right-4 top-3 z-10 flex size-8 shrink-0 aspect-square cursor-pointer items-center justify-center rounded-lg text-[#E6E6E6] transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60';
const MARKET_INSTALLED_BADGE_CLASS = 'absolute right-4 top-3 z-10 flex size-8 shrink-0 items-center justify-center text-[#E6E6E6]';

const readyPlugin = {
  status: 'ready' as const,
  featured: true,
  repository: 'https://github.com/example/demo',
  releaseTag: 'v1.0.0',
  releaseUrl: 'https://github.com/example/demo/releases/tag/v1.0.0',
  manifestText: '{}',
  source: 'export default {}',
  resourcePayloads: [],
  manifest: {
    apiVersion: 1 as const,
    runtime: 'javascript' as const,
    id: 'demo',
    name: '演示应用',
    version: '1.0.0',
    category: 'utility' as const,
    entry: 'main.js' as const,
    permissions: [],
    contributes: { nodeTools: [] },
    description: '应用描述',
    repository: 'https://github.com/example/demo',
  },
};

function renderDialog(props: Partial<React.ComponentProps<typeof SkillsManagerDialog>> = {}) {
  return render(
    <SkillsManagerDialog
      open
      onClose={() => {}}
      onCreateSkill={() => {}}
      onUploadSkillFile={() => {}}
      onUploadSkillFolder={() => {}}
      {...props}
    />,
  );
}

/** 切到官方在前的「应用」页签（官方 `tabs:[{id:"plugin",…},{id:"skill",…}]`）。 */
function openAppsTab() {
  fireEvent.click(screen.getByRole('tab', { name: '应用' }));
}

describe('官方管理弹窗「应用」页签 —— 市场数据', () => {
  it('默认落在「技能」页签，`sr-only` 标题是 `manageDialogTitle`（管理技能）；未进入应用页签不拉市场', () => {
    loadPluginMarketplace.mockResolvedValue([]);
    renderDialog();
    expect(screen.getByRole('heading', { name: '管理技能' })).not.toBeNull();
    expect(loadPluginMarketplace).not.toHaveBeenCalled();
  });

  it('切到「应用」页签：拉一次市场，标题换成 `managePluginDialogTitle`（管理应用）', async () => {
    loadPluginMarketplace.mockResolvedValue([readyPlugin]);
    renderDialog();
    openAppsTab();
    await waitFor(() => expect(loadPluginMarketplace).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: '管理应用' })).not.toBeNull();
    await waitFor(() => expect(screen.getByText('演示应用')).not.toBeNull());
  });

  it('卡片 DOM 逐字：`vD`+`aY`+`lY`+`relative`、名称 / 分类 / 描述三段', async () => {
    loadPluginMarketplace.mockResolvedValue([readyPlugin]);
    renderDialog();
    openAppsTab();
    await waitFor(() => expect(screen.getByText('演示应用')).not.toBeNull());
    /* 弹窗走 `createPortal(document.body)` ⇒ 查询要在 `document` 上，不在 render 的 container 里。 */
    const card = document.querySelector('article') as HTMLElement;
    expect(card.className).toBe(MARKET_CARD_CLASS);
    /* 官方 `dY` 副标题：MTV `manifest.category = "utility"` → 「通用工具」。 */
    expect(screen.getByText('通用工具').className).toBe(MARKET_SUBTITLE_CLASS);
    expect(screen.getByText('应用描述').className).toBe(MARKET_DESC_CLASS);
  });

  it('未安装 ⇒ 官方 `$r`(Plus) 按钮带 `plugins.installPlugin` 的 `aria-label`；未注入安装入口时按官方 `disabled` 分支渲染', async () => {
    loadPluginMarketplace.mockResolvedValue([readyPlugin]);
    renderDialog();
    openAppsTab();
    const install = await waitFor(() => screen.getByLabelText('安装应用'));
    expect(install.tagName).toBe('BUTTON');
    expect((install as HTMLButtonElement).disabled).toBe(true);
    expect(install.className).toBe(MARKET_INSTALL_BUTTON_CLASS);
  });

  it('注入 `onInstallPlugin` ⇒ 按钮可点并把市场项交回宿主', async () => {
    loadPluginMarketplace.mockResolvedValue([readyPlugin]);
    const onInstallPlugin = vi.fn();
    renderDialog({ onInstallPlugin });
    openAppsTab();
    const install = await waitFor(() => screen.getByLabelText('安装应用'));
    expect((install as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(install);
    expect(onInstallPlugin).toHaveBeenCalledWith(expect.objectContaining({ repository: readyPlugin.repository }));
  });

  it('市场为空 ⇒ 官方空态文案 `skills.emptyPlugins`（暂无应用）', async () => {
    loadPluginMarketplace.mockResolvedValue([]);
    renderDialog();
    openAppsTab();
    await waitFor(() => expect(screen.getByText('暂无应用')).not.toBeNull());
    expect(loadPluginMarketplace).toHaveBeenCalledTimes(1);
  });

  it('有数据但搜索无命中 ⇒ 官方 `plugins.noSearchResults`（没有匹配的应用）', async () => {
    loadPluginMarketplace.mockResolvedValue([readyPlugin]);
    renderDialog();
    openAppsTab();
    await waitFor(() => expect(screen.getByText('演示应用')).not.toBeNull());
    fireEvent.change(document.querySelector('input[type="text"]') as HTMLInputElement, {
      target: { value: 'zzz-不存在' },
    });
    await waitFor(() => expect(screen.getByText('没有匹配的应用')).not.toBeNull());
    expect(screen.queryByText('演示应用')).toBeNull();
  });

  it('市场加载失败 ⇒ 官方错误分支文案 `plugins.errors.listFailed` + 重试按钮 `common.retry`', async () => {
    loadPluginMarketplace.mockRejectedValue(new Error('boom'));
    renderDialog();
    openAppsTab();
    await waitFor(() => expect(screen.getByText('应用加载失败')).not.toBeNull());
    const retry = screen.getByText('重试');
    expect(retry.className).toBe('h-8 rounded-lg bg-white px-3 text-sm font-medium text-black transition-opacity hover:opacity-90');
    loadPluginMarketplace.mockResolvedValue([readyPlugin]);
    fireEvent.click(retry);
    await waitFor(() => expect(loadPluginMarketplace).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('演示应用')).not.toBeNull());
  });

  it('已安装（仓库已登记）⇒ 渲染官方 `Fs` 已安装徽标，不再是 Plus 按钮', async () => {
    loadPluginMarketplace.mockResolvedValue([readyPlugin]);
    store.installedPlugins = [{ id: 'demo', manifest: { repository: readyPlugin.repository } }];
    renderDialog();
    openAppsTab();
    await waitFor(() => expect(screen.getByText('演示应用')).not.toBeNull());
    expect(screen.queryByLabelText('安装应用')).toBeNull();
    const badge = document.querySelector('span.absolute') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.className).toBe(MARKET_INSTALLED_BADGE_CLASS);
    expect(badge.getAttribute('aria-hidden')).not.toBeNull();
  });
});
