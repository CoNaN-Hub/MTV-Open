/**
 * 展示导演台运行时占用空间，并协调关闭窗口后移除本地运行时文件。
 *
 * 版式 = 官方设置项行：`section.settings-row settings-row--stacked`
 *   （官方原文 `flex w-full flex-col gap-4 border-b border-border/60 pb-5`，
 *     左侧标题 14/500 #f5f5f5 + 说明 14 #7a7a7a，控件放不下两栏时整块落到下方）
 * 卡片 = 官方 `o-card` + `o-card__row`（`flex items-start gap-3 px-4 py-3.5 border-border/70 border-b`）。
 * 本组件不再自带面板外壳 —— 它由「存储健康」页签的 `SettingsPaneBody` 承载。
 */
import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAppStore } from '../../store/useAppStore';
import {
  getDirectorDeskRuntimeStatus,
  isDirectorDeskRuntimeAvailable,
  removeDirectorDeskRuntime,
  type DirectorDeskRuntimeStatus,
} from '../../services/directorDeskRuntimeService';
import { closeDirectorDeskWindow } from '../../services/directorDeskWindowService';
import { OfficialButton } from './official/OfficialControls';
import { SettingsRow } from './SettingsPane';
import { useT } from '../../i18n';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export default function DirectorDeskStorageManager() {
  const t = useT();
  const showToast = useAppStore((state) => state.showToast);
  const runtimeAvailable = isDirectorDeskRuntimeAvailable();
  const [status, setStatus] = useState<DirectorDeskRuntimeStatus | null>(null);
  const [loading, setLoading] = useState(runtimeAvailable);
  const [removing, setRemoving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!runtimeAvailable) return;
    let active = true;
    void getDirectorDeskRuntimeStatus()
      .then((nextStatus) => {
        if (active) setStatus(nextStatus);
      })
      .catch((reason) => {
        if (active) showToast(reason instanceof Error ? reason.message : String(reason), 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [runtimeAvailable, showToast]);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await closeDirectorDeskWindow();
      setStatus(await removeDirectorDeskRuntime());
      setConfirming(false);
      showToast(t('已删除 3D 导演台本地资源'), 'success');
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : String(reason), 'error');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <SettingsRow
      stacked
      title={t('3D 导演台资源')}
      description={t('按需下载的运行资源由所有导演台节点共用。')}
    >
      <div className="o-card">
        <div className="o-card__row o-card__row--center">
          <span className="o-icon-tile">
            <Icon icon="mdi:video-3d" width={18} />
          </span>
          <div className="o-card__body">
            <div className="o-card__title">
              {loading
                ? t('正在读取...')
                : status?.installed
                  ? t('已安装 v{version}', { version: status.version })
                  : t('未安装')}
            </div>
            <div className="o-card__desc">
              {status?.installed
                ? t('占用 {size}', { size: formatBytes(status.installedBytes) })
                : t('创建或打开导演台节点时可下载')}
            </div>
          </div>
          <div className="o-card__actions">
            {status?.installed && (confirming ? (
              <>
                <OfficialButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={removing}
                >
                  {t('取消')}
                </OfficialButton>
                <OfficialButton
                  variant="destructive"
                  size="sm"
                  onClick={() => { void handleRemove(); }}
                  disabled={removing}
                >
                  {removing ? t('正在删除...') : t('确认删除')}
                </OfficialButton>
              </>
            ) : (
              <OfficialButton
                variant="outline"
                size="sm"
                className="o-danger-t"
                onClick={() => setConfirming(true)}
              >
                <Icon icon="lucide:trash-2" width={14} />
                {t('删除资源')}
              </OfficialButton>
            ))}
          </div>
        </div>
      </div>
    </SettingsRow>
  );
}
