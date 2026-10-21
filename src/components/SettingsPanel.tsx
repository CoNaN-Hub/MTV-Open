/**
 * SettingsPanel 设置面板 — 模态弹窗，管理常规、文件与应用、API Key、快捷键、ComfyUI 等设置
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
/* ⚠️ `settings.css` / `settings-panel.css` / `official-controls.css` 已改到 `src/index.css` 里
   全局引入 —— 因为 `SettingsPanel` 是 `React.lazy`，放在这里会导致「助手里的子智能体面板」
   （同样用 `.o-*` 控件与 `--o-*` token）在没打开过设置之前**完全没有样式**。顺序不变。 */
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import ModalOverlay from './shared/ModalOverlay';
import ApiKeySettings from './settings/ApiKeySettings';
import StorageHealthCenter from './settings/StorageHealthCenter';
import McpControlSettings from './settings/McpControlSettings';
import SettingsNavigation from './settings/SettingsNavigation';
import ShortcutSettings from './settings/ShortcutSettings';
import ComfyUISettings from './settings/ComfyUISettings';
import FileAppSettings from './settings/FileAppSettings';
import PluginSettings from './settings/PluginSettings';
import GeneralSettings from './settings/GeneralSettings';
import AccountSettings from './settings/AccountSettings';
import ModelMappingSettings from './settings/ModelMappingSettings';
import CanvasSettings from './settings/CanvasSettings';
import DesktopPermissionsSettings from './settings/DesktopPermissionsSettings';
import UsageDashboard from './settings/UsageDashboard';
import AboutSettings from './settings/AboutSettings';
import CreditsSettings from './settings/CreditsSettings';
import BillingRecordsSettings from './settings/BillingRecordsSettings';

import type { SettingsTab } from '../store/store.ui';
import { useT } from '../i18n';

export default function SettingsPanel() {
  const t = useT();
  const saveStatus = useAppStore((s) => s.configSaveStatus);
  const saveError = useAppStore((s) => s.configSaveError);
  const configHydrated = useAppStore((s) => s.configHydrated);
  const unreadSecretCount = useAppStore((s) => s.configSecretReadErrors?.length ?? 0);
  const { settingsOpen, setSettingsOpen, settingsInitialTab, setSettingsInitialTab, saveConfig } =
    useAppStore(
      useShallow((s) => ({
        settingsOpen: s.settingsOpen,
        setSettingsOpen: s.setSettingsOpen,
        settingsInitialTab: s.settingsInitialTab,
        setSettingsInitialTab: s.setSettingsInitialTab,
        saveConfig: s.saveConfig,
      })),
    );
  const persist = async () => {
    try { await saveConfig(); return true; } catch { return false; }
  };
  const reload = async () => {
    if (useAppStore.getState().configDirty) {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      if (!await ask(t('重新加载会放弃当前未保存的设置，是否继续？'), {
        title: t('重新加载设置'), kind: 'warning', okLabel: t('重新加载'), cancelLabel: t('取消'),
      }).catch(() => false)) return;
    }
    await useAppStore.getState().loadConfig().catch(() => {});
  };
  const [selectedTab, setSelectedTab] = useState<SettingsTab>('general');

  // 外部（如 Agent 保存厂商配置后）请求的标签页在渲染期直接生效，不用 effect 回写 state；
  // 用户手动切换即视为消费掉该请求（关闭面板时 store 也会清空它）
  const activeTab = (settingsOpen ? settingsInitialTab : null) ?? selectedTab;
  const selectTab = (tab: SettingsTab) => {
    setSelectedTab(tab);
    setSettingsInitialTab(null);
  };

  /** 右栏滚动容器：切页签时复位到顶部。
   *  否则从长页签切到短页签会带着上一页的 `scrollTop` —— 实测「权限」一进去就滚到中间、
   *  连面板头（「权限 / 控制 MTV 桌面端 Agent …」）都看不见。 */
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = contentScrollRef.current;
    if (node) node.scrollTop = 0;
  }, [activeTab]);


  return (
    <ModalOverlay
      isOpen={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      ariaLabel={t('设置')}
      className="settings-panel-dialog"
      closeOnBackdrop={false}
    >
        {/* 官方对话框**没有可见标题栏**：标题是 `sr-only` 的 `<h2>Settings</h2>`，
            右上角一颗 `absolute right-4 top-4` 的 24×24 关闭键（`data-testid="common-dialog-close-btn"`，
            `lucide-x size-4 text-[#CCCCCC]`）。 */}
        <h2 className="sr-only">{t('设置')}</h2>
        <button
          type="button"
          aria-label={t('关闭设置')}
          data-testid="settings-panel-close-btn"
          className="settings-panel-close"
          onClick={() => setSettingsOpen(false)}
        >
          <Icon icon="lucide:x" width={16} height={16} />
        </button>
        {(saveError || !configHydrated || unreadSecretCount > 0 || (saveStatus !== 'idle' && saveStatus !== 'saved')) && (
        <div role="status" className={`ui-alert ${saveStatus === 'error' || saveStatus === 'conflict' ? 'ui-alert--danger' : 'ui-alert--info'} mx-3 my-2`} data-settings-persistence>
          <div className="ui-alert__body flex-1">
            {saveError ?? t(saveStatus === 'saving' ? '正在保存设置…' : saveStatus === 'dirty' ? '有未保存的设置'
              : saveStatus === 'saved' ? '设置已保存' : configHydrated ? '设置已加载' : '设置尚未加载完成')}
          </div>
          {(saveStatus === 'error' || saveStatus === 'dirty') && configHydrated && (
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => void persist()}>{t('重试保存')}</button>
          )}
          {(saveStatus === 'conflict' || !configHydrated || unreadSecretCount > 0) && (
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => void reload()}>{t('重新加载')}</button>
          )}
        </div>
        )}

        <div className="flex flex-1 min-h-0">
          <SettingsNavigation activeTab={activeTab} onSelect={selectTab} />

          {/* Content。
              ★ 切页签时把滚动位置复位到顶部 —— 否则从长页签切到短页签（或反过来）会带着上一页的
                `scrollTop`，实测「权限」面板会一进去就滚到中间、连面板头都看不见。
              ★ `data-overlay-scrollbar="off"`：右栏**不要滑条**（用户点名：ComfyUI / MCP 控制 /
                存储健康 / 文件与应用 / 插件 / 快捷键 / 权限 都不许出现 MTV 那条全局悬浮滑条）。
                官方设置面板右栏本来就只有一条原生细条；MTV 的悬浮拇指会飘到视口边缘，
                所以这里把悬浮层与本机原生条一起收掉，**只保留可滚动**（不影响滚轮 / 触控板 / PageDown）。 */}
          <div
            ref={contentScrollRef}
            className="settings-content flex-1 overflow-y-auto overflow-x-hidden p-3"
            data-overlay-scrollbar="off"
          >
            {activeTab === 'api' && (
              <ApiKeySettings onClose={() => setSettingsOpen(false)} />
            )}

            {activeTab === 'credits' && <CreditsSettings />}

            {activeTab === 'billing' && <BillingRecordsSettings />}

            {activeTab === 'general' && <GeneralSettings />}

            {/* ★ 官方账号菜单「账户管理」那一项的个人资料页（用户点名移植，放在「常规」上方）*/}
            {activeTab === 'account' && <AccountSettings />}
            {activeTab === 'modelMapping' && <ModelMappingSettings />}

            {activeTab === 'comfyui' && <ComfyUISettings />}

            {activeTab === 'files' && <FileAppSettings active />}

            {activeTab === 'shortcuts' && <ShortcutSettings />}

            {activeTab === 'storage' && <StorageHealthCenter />}

            {activeTab === 'mcp' && <McpControlSettings />}

            {activeTab === 'plugins' && <PluginSettings />}

            {/* ★ 以下四项按官方设置面板的对应项新建（用户 2026-09-28 点名） */}
            {activeTab === 'canvas' && <CanvasSettings />}

            {activeTab === 'permissions' && <DesktopPermissionsSettings />}

            {activeTab === 'usage' && <UsageDashboard />}

            {activeTab === 'about' && <AboutSettings />}
          </div>
        </div>
    </ModalOverlay>
  );
}
