/**
 * settings/AboutSettings —— 官方「帮助与支持」组里「版本 + 点击检查更新」那一块的 MTV 落点
 *
 * 官方实测（9444）左栏「帮助与支持」组里那一块：
 *   · `v2.19.0`（`p`，14px/500）
 *   · `Desktop v0.4.81`
 *   · 「点击检查更新」
 * 用户 2026-09-28 决定：**先保留一个空 UI**（MTV 的 Tauri updater 还没接）。
 *
 * ⚠️ MTV 偏离：这里只显示版本号 + 一颗**禁用**的「检查更新」按钮（点了给一句 toast 说明），
 *    不假装能更新 —— 等接上 Tauri updater 再打开。
 */
import { useCallback } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { SettingsPaneBody, SettingsPaneHeader, SettingsRow } from './SettingsPane';

/** 构建期注入的版本（与 `README`/`Cargo.toml` 的 sync-version 同源） */
const APP_VERSION = '1.0.0';

export default function AboutSettings() {
  const t = useT();
  const showToast = useAppStore((state) => state.showToast);
  const handleCheckUpdate = useCallback(() => {
    showToast(t('更新通道尚未接入（Tauri updater 未配置）'), 'info');
  }, [showToast, t]);

  return (
    <SettingsPaneBody>
      <SettingsPaneHeader title={t('关于与更新')} description={t('查看当前版本，检查是否有新版本可用。')} />

      <div className="mt-8 space-y-5">
        <SettingsRow title={t('TapNow 版本')} description={t('网页端版本号（官方对照用的那一版）。')}>
          <p className="settings-pane-desc">v2.19.0</p>
        </SettingsRow>

        <SettingsRow title={t('Desktop 版本')} description={t('当前桌面端（MTV）版本号。')}>
          <p className="settings-pane-desc">{`Desktop v${APP_VERSION}`}</p>
        </SettingsRow>

        <SettingsRow title={t('检查更新')} description={t('检查是否有可用的新版本。')}>
          <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={handleCheckUpdate}>
            {t('点击检查更新')}
          </button>
        </SettingsRow>
      </div>
    </SettingsPaneBody>
  );
}
