/**
 * settings/ComfyUISettings — ComfyUI 设置子页。
 * 配置 ComfyUI 服务地址、启动 / 停止本地 ComfyUI、探测服务状态，
 * 并提供工作流面板入口与相关目录选择。
 */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import type { ComfyServer } from '../../types';
import { OfficialButton, OfficialInput } from './official/OfficialControls';
import { SettingsPaneBody, SettingsPaneHeader } from './SettingsPane';
import { useT } from '../../i18n';
import {
  DEFAULT_COMFY_URL,
  probeComfyServer,
  type ComfyServerAvailability,
} from '../../services/comfyServers';

type ComfyStatus = 'idle' | 'starting' | 'ready' | 'failed';

const DEFAULT_SERVER_STATUS_KEY = '__default__';
const STATUS_REFRESH_INTERVAL_MS = 15_000;
const STATUS_DEBOUNCE_MS = 250;

interface ServerStatusEntry {
  url: string;
  availability: ComfyServerAvailability;
}

/** 服务可用性指示灯（官方 `text-xs` + 状态色的小圆点；`role="status"` 保留原来的无障碍语义） */
function StatusDot({ availability, label }: { availability: ComfyServerAvailability; label: string }) {
  const tone = availability === 'available'
    ? ' o-state--ok'
    : availability === 'unavailable' ? ' o-state--error' : ' o-state--wait';
  return (
    <span className={`o-state${tone}`} role="status" aria-label={label} title={label}>
      <span className="o-dot" />
    </span>
  );
}

export default function ComfyUISettings() {
  const {
    config,
    updateConfig,
    saveConfig,
    workflows,
    setSettingsOpen,
    setWorkflowPanelOpen,
    showToast,
  } = useAppStore(useShallow((state) => ({
    config: state.config,
    updateConfig: state.updateConfig,
    saveConfig: state.saveConfig,
    workflows: state.workflows,
    setSettingsOpen: state.setSettingsOpen,
    setWorkflowPanelOpen: state.setWorkflowPanelOpen,
    showToast: state.showToast,
  })));
  const t = useT();
  const [launching, setLaunching] = useState(false);
  const [opening, setOpening] = useState(false);
  const [status, setStatus] = useState<ComfyStatus>('idle');
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatusEntry>>({});
  const comfyUIPath = config.comfyUIPath;
  const servers = useMemo(() => config.comfyServers ?? [], [config.comfyServers]);

  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer: number | undefined;
    const targets = [
      {
        key: DEFAULT_SERVER_STATUS_KEY,
        url: config.comfyUIUrl?.trim() || DEFAULT_COMFY_URL,
      },
      ...servers.map((server) => ({ key: server.id, url: server.url.trim() })),
    ];

    const refresh = async (showChecking: boolean) => {
      if (showChecking) {
        setServerStatuses((current) => ({
          ...current,
          ...Object.fromEntries(targets.map(({ key, url }) => [
            key,
            { url, availability: 'checking' as const },
          ])),
        }));
      }
      await Promise.all(targets.map(async ({ key, url }) => {
        const available = await probeComfyServer(url, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setServerStatuses((current) => {
          if (current[key]?.url !== url) return current;
          return {
            ...current,
            [key]: { url, availability: available ? 'available' : 'unavailable' },
          };
        });
      }));
      if (!controller.signal.aborted) {
        refreshTimer = window.setTimeout(() => void refresh(false), STATUS_REFRESH_INTERVAL_MS);
      }
    };

    const debounceTimer = window.setTimeout(() => void refresh(true), STATUS_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(debounceTimer);
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    };
  }, [config.comfyUIUrl, servers]);

  const statusLabel = (availability: ComfyServerAvailability) => {
    if (availability === 'available') return t('ComfyUI 服务已就绪');
    if (availability === 'unavailable') return t('服务未就绪，请查看弹出的终端窗口中的日志');
    return t('正在等待 ComfyUI 服务就绪，首次启动可能需要几分钟时间…');
  };

  const availabilityFor = (key: string, url: string): ComfyServerAvailability => {
    const entry = serverStatuses[key];
    return entry?.url === url ? entry.availability : 'checking';
  };

  const openComfyUI = async () => {
    const comfyUrl = config.comfyUIUrl?.trim() || 'http://127.0.0.1:8188';
    setOpening(true);
    try {
      await invoke<void>('open_comfyui_window', { comfyUrl });
    } catch (error) {
      showToast(typeof error === 'string' ? error : t('打开 ComfyUI 页面失败'), 'error');
    } finally {
      setOpening(false);
    }
  };

  const choosePath = async () => {
    try {
      const selected = await openDialog({ directory: true, title: t('选择 ComfyUI 安装目录') });
      if (selected && typeof selected === 'string') {
        updateConfig({ comfyUIPath: selected });
        await saveConfig();
      }
    } catch {
      // 浏览器环境忽略
    }
  };

  const launch = async () => {
    const comfyPath = config.comfyUIPath?.trim();
    if (!comfyPath) {
      showToast(t('请先设置 ComfyUI 安装目录'), 'error');
      return;
    }
    setLaunching(true);
    setStatus('starting');
    try {
      await invoke<string>('launch_comfyui', { comfyPath });
      const base = (config.comfyUIUrl?.trim() || 'http://127.0.0.1:8188').replace(/\/+$/, '');
      const deadline = Date.now() + 300_000;
      let ready = false;
      while (Date.now() < deadline) {
        try {
          await fetch(`${base}/system_stats`, { mode: 'no-cors' });
          ready = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      setStatus(ready ? 'ready' : 'failed');
      if (ready) {
        await openComfyUI();
      }
      showToast(
        ready ? t('ComfyUI 服务已就绪') : t('ComfyUI 进程已启动，但等待服务就绪超时，请查看终端窗口日志'),
        ready ? 'success' : 'error',
      );
    } catch (error) {
      setStatus('failed');
      showToast(typeof error === 'string' ? error : t('启动 ComfyUI 失败'), 'error');
    } finally {
      setLaunching(false);
    }
  };

  const saveServers = async (next: ComfyServer[]) => {
    updateConfig({ comfyServers: next });
    await saveConfig().catch(() => {});
  };

  const addServer = () => saveServers([
    ...servers,
    { id: crypto.randomUUID(), name: t('服务端 {index}', { index: servers.length + 1 }), url: '' },
  ]);

  const patchServer = (id: string, patch: Partial<ComfyServer>) => saveServers(
    servers.map((server) => (server.id === id ? { ...server, ...patch } : server)),
  );

  const removeServer = (id: string) => saveServers(servers.filter((server) => server.id !== id));

  const openWorkflows = () => {
    setSettingsOpen(false);
    setWorkflowPanelOpen(true);
  };

  const statusTone = status === 'ready' ? ' o-state--ok'
    : status === 'failed' ? ' o-state--error'
      : status === 'starting' ? ' o-state--wait' : '';
  const statusText = status === 'starting'
    ? t('正在等待 ComfyUI 服务就绪，首次启动可能需要几分钟时间…')
    : status === 'ready'
      ? t('ComfyUI 服务已就绪（{url}），可以开始使用', { url: config.comfyUIUrl?.trim() || 'http://127.0.0.1:8188' })
      : status === 'failed'
        ? t('服务未就绪，请查看弹出的终端窗口中的日志')
        : t('服务就绪后会自动在软件内打开 ComfyUI 窗口，也可以手动打开');

  return (
    <SettingsPaneBody>
      <SettingsPaneHeader
        title={t('ComfyUI')}
        description={t('连接本地或远端的 ComfyUI 服务，用它执行导入的工作流。')}
      />

      <div className="mt-8 space-y-5">
        {/* 安装目录：官方「标题在上、控件在下」的堆叠行（同「画布背景」） */}
        <section className="settings-row settings-row--stacked">
          <div className="settings-row-label">
            <h3 className="settings-row-title">{t('ComfyUI 安装目录')}</h3>
            <p className="settings-row-desc">
              {t('选择 ComfyUI 的安装根目录，支持 GitHub 源码版 / 秋叶整合包 / 官方便携版 / Comfy Desktop（选安装基目录，如 F:\\ComfyUI）。将以 API 模式直接启动，跳过启动器检测')}
            </p>
          </div>

          <div className="o-inline">
            <div className={comfyUIPath ? 'o-path' : 'o-path o-path--empty'}>{comfyUIPath || t('未设置')}</div>
            <OfficialButton type="button" variant="outline" size="sm" onClick={() => void choosePath()}>
              {comfyUIPath ? t('更换') : t('选择文件夹')}
            </OfficialButton>
          </div>

          <div className="o-inline o-inline--wrap">
            <OfficialButton type="button" variant="default" size="sm" onClick={() => void launch()} disabled={launching}>
              {launching ? (
                <><Icon icon="lucide:loader-circle" width={16} className="settings-spin" />{t('正在启动…')}</>
              ) : (
                <><Icon icon="lucide:play" width={16} />{t('启动 ComfyUI')}</>
              )}
            </OfficialButton>
            <OfficialButton type="button" variant="outline" size="sm" onClick={() => void openComfyUI()} disabled={opening}>
              <Icon icon={opening ? 'lucide:loader-circle' : 'lucide:external-link'} width={16} className={opening ? 'settings-spin' : ''} />
              {t('打开 ComfyUI 页面')}
            </OfficialButton>
            <span className={`o-state${statusTone}`}>
              <span className="o-dot" />
              {statusText}
            </span>
          </div>
        </section>

        {/* 服务地址 */}
        <section className="settings-row settings-row--stacked">
          <div className="settings-row-label">
            <h3 className="settings-row-title">{t('ComfyUI 服务地址')}</h3>
            <p className="settings-row-desc">
              {t('ComfyUI 后端服务的地址，用于执行导入的工作流。默认端口为 8188')}
            </p>
          </div>

          <div className="o-inline">
            <OfficialInput
              type="text"
              className="flex-1 min-w-0"
              placeholder="http://127.0.0.1:8188"
              defaultValue={config.comfyUIUrl || ''}
              onBlur={async (event) => {
                updateConfig({ comfyUIUrl: event.target.value });
                await saveConfig().catch(() => {});
              }}
            />
            <StatusDot
              availability={availabilityFor(
                DEFAULT_SERVER_STATUS_KEY,
                config.comfyUIUrl?.trim() || DEFAULT_COMFY_URL,
              )}
              label={statusLabel(availabilityFor(
                DEFAULT_SERVER_STATUS_KEY,
                config.comfyUIUrl?.trim() || DEFAULT_COMFY_URL,
              ))}
            />
          </div>

          <div className="o-card">
            <div className="o-card__row o-card__row--center">
              <div className="o-card__body">
                <div className="o-card__title">{t('其他服务端')}</div>
                <div className="o-card__desc">
                  {t('在「工作流管理」里给工作流选择服务端；删掉服务端后，绑过它的工作流回落到默认地址')}
                </div>
              </div>
              <OfficialButton type="button" variant="outline" size="sm" onClick={() => void addServer()}>
                <Icon icon="lucide:plus" width={16} />
                {t('添加服务端')}
              </OfficialButton>
            </div>
            {servers.map((server) => (
              <div key={server.id} className="o-card__row o-card__row--center">
                <div className="o-card__body o-inline">
                  <OfficialInput
                    type="text"
                    className="o-w28"
                    placeholder={t('服务端名称')}
                    defaultValue={server.name}
                    onBlur={(event) => void patchServer(server.id, { name: event.target.value.trim() })}
                  />
                  <OfficialInput
                    type="text"
                    className="flex-1 min-w-0"
                    placeholder="http://127.0.0.1:8189"
                    defaultValue={server.url}
                    onBlur={(event) => void patchServer(server.id, { url: event.target.value.trim() })}
                  />
                  <StatusDot
                    availability={availabilityFor(server.id, server.url.trim())}
                    label={statusLabel(availabilityFor(server.id, server.url.trim()))}
                  />
                  <OfficialButton
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="o-icon-btn o-icon-btn--danger"
                    aria-label={t('删除服务端')}
                    data-tooltip={t('删除服务端')}
                    onClick={() => void removeServer(server.id)}
                  >
                    <Icon icon="lucide:trash-2" width={16} />
                  </OfficialButton>
                </div>
              </div>
            ))}
            {servers.length === 0 && (
              <div className="o-card__row">
                <div className="o-card__body">
                  <div className="o-card__desc">
                    {t('图片与视频分开部署时，在这里添加另一台服务端，再到「工作流管理」里把工作流绑定过去')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 工作流入口 */}
        <section className="settings-row settings-row--stacked">
          <div className="settings-row-label">
            <h3 className="settings-row-title">{t('ComfyUI 工作流')}</h3>
            <p className="settings-row-desc">{t('已导入 {count} 个工作流', { count: workflows.length })}</p>
          </div>

          <div className="o-card">
            <div className="o-card__row o-card__row--center">
              <span className="o-card__icon"><Icon icon="lucide:workflow" width={18} /></span>
              <div className="o-card__body">
                <div className="o-card__title">{t('工作流管理')}</div>
                <div className="o-card__desc">{t('已导入 {count} 个工作流', { count: workflows.length })}</div>
              </div>
              <OfficialButton type="button" variant="outline" size="sm" onClick={openWorkflows}>
                {t('管理工作流')}
                <Icon icon="lucide:chevron-right" width={16} />
              </OfficialButton>
            </div>
          </div>
        </section>
      </div>
    </SettingsPaneBody>
  );
}
