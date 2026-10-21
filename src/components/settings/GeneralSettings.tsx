/**
 * settings/GeneralSettings —— 「常规」页签（界面语言 / 启动时打开 / 应用窗口大小 / 窗口外观）
 *
 * 版式**按官方设计语言**（官方没有对应面板，所以用抠出来的官方版式原语 + 官方控件词汇表）：
 *   · 面板头 `SettingsPaneHeader`：`h2` 18/500/`#f5f5f5` + `p` 14/`#7a7a7a`（官方 `header.space-y-1.5`）
 *   · 设置项行 `SettingsRow`：官方
 *       `<section class="flex w-full flex-col gap-4 border-b border-border/60 pb-5
 *         sm:flex-row sm:items-center sm:justify-between sm:gap-8">`
 *       + 左 `div.min-w-0.space-y-1`（`h3` 14/500 + `p` 14/`#7a7a7a`）
 *   · 多选一 → 官方分段控件 `role="radiogroup"` `flex w-fit shrink-0 gap-1 rounded-lg bg-muted/50 p-1`
 *       + 选项 `h-9 min-w-24 rounded-md px-3 text-sm font-medium`
 *         （选中 `bg-background text-foreground shadow-sm`；未选中 `text-muted-foreground
 *           hover:bg-background/60 hover:text-foreground`）—— 类名在 `styles/official-controls.css`
 *   · 布尔 → 官方 `Switch`（`peer inline-flex h-5 w-9 rounded-full` + `data-[state=checked]:bg-primary`）
 *
 * ⚠️ 与改版前的差别：原来用的是 MTV 自绘的颜色令牌族（`canvas-*`）
 *    与 **indigo** 强调色；现在全换成官方色板与官方控件形态。
 *    行为（配置字段、`applyWindowSize`、Tauri 窗口尺寸监听）一字未改。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { SettingsPaneBody, SettingsPaneHeader, SettingsRow } from './SettingsPane';
import { OfficialSwitch } from './official/OfficialControls';
import { LOCALES, LOCALE_LABELS, getLocale } from '../../i18n';
import type { StartupView, WindowAspectRatio } from '../../types';

/** 窗口尺寸预设：每种比例给紧凑 / 标准 / 大屏三档主流尺寸 */
const WINDOW_ASPECT_OPTIONS: {
  id: WindowAspectRatio;
  presets: { w: number; h: number; label: string }[];
}[] = [
  { id: '16:9',  presets: [{ w: 1280, h: 720, label: '紧凑' }, { w: 1600, h: 900, label: '标准' }, { w: 1920, h: 1080, label: '大屏' }] },
  { id: '16:10', presets: [{ w: 1280, h: 800, label: '紧凑' }, { w: 1440, h: 900, label: '标准' }, { w: 1680, h: 1050, label: '大屏' }] },
  { id: '4:3',   presets: [{ w: 1024, h: 768, label: '紧凑' }, { w: 1280, h: 960, label: '标准' }, { w: 1440, h: 1080, label: '大屏' }] },
];

const STARTUP_VIEW_OPTIONS: { id: StartupView; label: string }[] = [
  { id: 'last-project', label: '上次画布' },
  { id: 'project-library', label: '项目列表' },
];

/** 把主窗口设成指定逻辑尺寸；超出当前显示器可视范围时等比缩小，避免窗口大到没法操作 */
async function applyWindowSize(width: number, height: number): Promise<void> {
  try {
    const { getCurrentWindow, LogicalSize, currentMonitor } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    if (await win.isFullscreen()) await win.setFullscreen(false);
    if (await win.isMaximized()) await win.unmaximize();

    let w = width;
    let h = height;
    const monitor = await currentMonitor();
    if (monitor) {
      const maxW = monitor.size.width / monitor.scaleFactor - 40;
      const maxH = monitor.size.height / monitor.scaleFactor - 80;
      const scale = Math.min(1, maxW / w, maxH / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    await win.setSize(new LogicalSize(w, h));
    await win.center();
  } catch (error) {
    // 权限没配全时 Tauri 会直接 reject，静默 catch 会让人以为按钮没反应
    console.warn('[窗口尺寸] 设置失败:', error);
  }
}

export default function GeneralSettings() {
  const t = useT();
  const locale = getLocale();
  const config = useAppStore((s) => s.config);
  const updateConfig = useAppStore((s) => s.updateConfig);
  const saveConfig = useAppStore((s) => s.saveConfig);

  const persistAfter = useCallback((patch: Parameters<typeof updateConfig>[0]) => {
    updateConfig(patch);
    void saveConfig().catch(() => undefined);
  }, [saveConfig, updateConfig]);

  const startupView = config.startupView ?? 'last-project';
  const windowAspectRatio = config.windowAspectRatio ?? '16:9';
  const windowAspectLocked = config.windowAspectLocked === true;
  const performanceMode = config.performanceMode === true;
  const configuredWindowGlassFrame = config.windowGlassFrame !== false; // 默认开启
  const windowGlassFrame = configuredWindowGlassFrame && !performanceMode;

  /* 当前窗口实际尺寸 —— 用来给尺寸预设标出选中态 */
  const [currentWindowSize, setCurrentWindowSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const read = async () => {
          const size = (await win.innerSize()).toLogical(await win.scaleFactor());
          setCurrentWindowSize({ w: Math.round(size.width), h: Math.round(size.height) });
        };
        await read();
        const off = await win.onResized(() => { void read(); });
        if (disposed) off();
        else unlisten = off;
      } catch { /* 非 Tauri 环境（浏览器预览）忽略 */ }
    })();
    return () => { disposed = true; unlisten?.(); };
  }, []);

  const aspectPresets = useMemo(
    () => WINDOW_ASPECT_OPTIONS.find((item) => item.id === windowAspectRatio)?.presets
      ?? WINDOW_ASPECT_OPTIONS[0].presets,
    [windowAspectRatio],
  );
  const activePreset = currentWindowSize
    ? aspectPresets.find((preset) => preset.w === currentWindowSize.w && preset.h === currentWindowSize.h)
    : undefined;

  return (
    <SettingsPaneBody>
      <SettingsPaneHeader title={t('常规设置')} description={t('界面语言、启动行为与窗口外观。')} />

      <div className="mt-8 space-y-5">
        <SettingsRow title={t('界面语言')} description={t('切换界面语言，立即生效。')}>
          <div className="o-segmented" role="radiogroup" aria-label={t('界面语言')}>
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={locale === code}
                data-checked={locale === code || undefined}
                className="o-batch-option"
                onClick={() => { if (locale !== code) persistAfter({ language: code }); }}
              >
                <span>{LOCALE_LABELS[code]}</span>
              </button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow title={t('启动时打开')} description={t('软件启动后先打开上次的画布，还是先选项目。')}>
          <div className="o-segmented" role="radiogroup" aria-label={t('软件启动时打开')}>
            {STARTUP_VIEW_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={startupView === option.id}
                data-checked={startupView === option.id || undefined}
                className="o-batch-option"
                onClick={() => { if (startupView !== option.id) persistAfter({ startupView: option.id }); }}
              >
                <span>{t(option.label)}</span>
              </button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow title={t('窗口比例')} description={t('主窗口的宽高比。')}>
          <div className="o-segmented" role="radiogroup" aria-label={t('窗口比例')}>
            {WINDOW_ASPECT_OPTIONS.map(({ id }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={windowAspectRatio === id}
                data-checked={windowAspectRatio === id || undefined}
                className="o-batch-option"
                onClick={() => { if (windowAspectRatio !== id) persistAfter({ windowAspectRatio: id }); }}
              >
                <span>{id}</span>
              </button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow
          title={t('应用窗口大小')}
          description={t('按当前比例选一档常用尺寸；也可以在缩放后自动保持比例。')}
        >
          <div className="o-segmented" role="radiogroup" aria-label={t('应用窗口大小')}>
            {aspectPresets.map((preset) => (
              <button
                key={`${preset.w}x${preset.h}`}
                type="button"
                role="radio"
                aria-checked={activePreset === preset}
                data-checked={activePreset === preset || undefined}
                className="o-batch-option"
                onClick={() => { void applyWindowSize(preset.w, preset.h); }}
              >
                <span>{`${preset.w} × ${preset.h}`}</span>
              </button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow
          title={t('固定窗口比例')}
          description={windowAspectLocked
            ? t('拖拽缩放窗口时自动保持 {ratio}', { ratio: windowAspectRatio })
            : t('拖拽缩放窗口时不限制宽高比')}
        >
          <OfficialSwitch
            label={t('固定窗口比例')}
            checked={windowAspectLocked}
            onChange={(next) => persistAfter({ windowAspectLocked: next })}
          />
        </SettingsRow>

        <SettingsRow
          title={t('窗口外观')}
          description={performanceMode
            ? t('性能模式下已关闭玻璃外框')
            : windowGlassFrame
              ? t('显示 5px 玻璃带与双层边缘高光')
              : t('内容贴合窗口边缘，不显示外框')}
        >
          <OfficialSwitch
            label={t('玻璃外框')}
            checked={windowGlassFrame}
            disabled={performanceMode}
            onChange={(next) => persistAfter({ windowGlassFrame: next })}
          />
        </SettingsRow>
      </div>
    </SettingsPaneBody>
  );
}
