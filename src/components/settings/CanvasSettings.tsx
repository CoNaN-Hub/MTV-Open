/**
 * settings/CanvasSettings —— 官方「通用设置 → 画布设置」面板的 MTV 落点
 *
 * 官方出处（9444 实测 + `course-api-base-url-CGXqZmAy.js`）：
 *   · 面板头：`<header class="space-y-1.5">`
 *       `<h2 class="text-lg font-medium leading-7 text-foreground">画布设置</h2>`（18px / 500 / #f5f5f5）
 *       `<p class="text-sm text-muted-foreground">管理画布中的默认行为和显示偏好。</p>`（14px / #7a7a7a）
 *   · 每个设置项 = `<section class="flex w-full flex-col gap-4 border-b border-border/60 pb-5
 *       sm:flex-row sm:items-center sm:justify-between sm:gap-8">`
 *       左 `div.min-w-0.space-y-1`（`h3.text-sm.font-medium.text-foreground` + `p.text-sm.text-muted-foreground`）
 *       右控件（官方「批量生成结果」用的是 `role="radiogroup"` 分段控件）
 *   · 版式原语见 `SettingsPane.tsx`，尺寸/色值见 `styles/settings-panel.css`。
 *
 * ⚠️ MTV 偏离：官方这一页装的是官方自己的画布默认项（批量生成结果等）；MTV 装 **MTV 自己的 8 项**：
 *   画布交互方式 / 节点工具栏 / 画布笔记工具栏 / 鼠标指针 / 节点标题 / 侧边栏 / 性能模式 / 画布背景。
 *   · 前 7 项用官方的「两栏设置项行 + 分段控件」；
 *   · 「画布背景」的控件是**带缩略图的网格选择 + 自定义背景上传/透明度**，官方那种两栏行放不下
 *     ⇒ 标题在上、网格在下，仍用官方的 `border-b border-border/60 pb-5` 分隔线。
 *   · 这 8 项原来都在「常规」里（用的是 MTV 自绘的 `sidebar-pref-card` 开关）；本轮**整体搬到这里**，
 *     「常规」里对应的 8 段已删除（避免两份同名设置）。
 */
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { SettingsPaneBody, SettingsPaneHeader, SettingsRow, SettingsSegmented } from './SettingsPane';
import { BACKGROUND_OPTIONS } from '../backgrounds/backgroundOptions';
import { compressImageLossless, detectBackgroundBrightness } from '../../services/backgroundService';
import type { BackgroundDetection } from '../../services/backgroundService';
import type { CanvasBackground as CanvasBg, InteractionMode, NodeToolbarMode } from '../../types';

/** 文件体积显示（原来是 `SettingsPanel` 里的局部函数，随「画布背景」一起搬过来） */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** 官方 `Yxe`… 不是；这三个是「批量生成结果」的三个选项图标（逐字从官方 DOM 抠出）
 *  · 堆叠：官方自绘 16×16 三层叠框（`data-pile-stack-layer=back|middle|front`，opacity .6/.8/1）
 *  · 多变体 / 铺开：lucide `images` / `grid-2x2`（24 viewBox，stroke 2，`size-4`） */
function PileStackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
      aria-hidden="true"
      className="size-4 shrink-0"
      data-pile-stack-state="static"
    >
      <g data-pile-stack-layer="back" opacity="0.6">
        <path d="M6.5 2.5h6a1.5 1.5 0 0 1 1.5 1.5v6" />
      </g>
      <g data-pile-stack-layer="middle" opacity="0.8">
        <path d="M4.5 4.5h6a1.5 1.5 0 0 1 1.5 1.5v6" />
      </g>
      <g data-pile-stack-layer="front">
        <rect x="2.5" y="6.5" width="7.5" height="7.5" rx="1.5" />
      </g>
    </svg>
  );
}

function VariantsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="size-4 shrink-0" aria-hidden="true">
      <path d="M18 22H4a2 2 0 0 1-2-2V6" />
      <path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" />
      <circle cx="12" cy="8" r="2" />
      <rect width="16" height="16" x="6" y="2" rx="2" />
    </svg>
  );
}

function SpreadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="size-4 shrink-0" aria-hidden="true">
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

/** 官方 `radiogroup` + `label` 选项（`flex h-9 min-w-24 … rounded-md px-3 text-sm font-medium`） */
function BatchLayoutOption({
  value, label, icon, checked, onSelect,
}: {
  value: 'pile' | 'variants' | 'spread';
  label: string;
  icon: ReactNode;
  checked: boolean;
  onSelect: (value: 'pile' | 'variants' | 'spread') => void;
}) {
  const id = `generation-result-layout-${value}`;
  return (
    <label className="o-batch-option" htmlFor={id} data-checked={checked || undefined}>
      {icon}
      <span>{label}</span>
      <input
        type="radio"
        className="sr-only"
        id={id}
        name="generation-result-layout"
        value={value}
        checked={checked}
        onChange={() => { if (!checked) onSelect(value); }}
      />
    </label>
  );
}

export default function CanvasSettings() {
  const t = useT();
  const config = useAppStore((s) => s.config);
  const updateConfig = useAppStore((s) => s.updateConfig);
  const saveConfig = useAppStore((s) => s.saveConfig);
  const showToast = useAppStore((s) => s.showToast);

  const interactionMode = config.interactionMode ?? 'default';
  const nodeToolbarMode = config.nodeToolbarMode ?? 'icons';
  const noteToolbarVisible = config.canvasNoteToolbarVisible ?? true;
  const customCursor = config.customCursor !== false;
  const nodeLabelVisible = config.nodeLabelVisible !== false;
  const sidebarFloating = config.sidebarFloating === true;
  const performanceMode = config.performanceMode === true;
  /** 官方「批量生成结果」的默认值 = **铺开**（实测 + 源码双重证据）：
   *  `index-BsHyQ2qj.js`@6230713 `lBe()` 空存储 ⇒ `bCe = jg.VARIANTS`，
   *  而生成期用的是 `$w(){const t=lBe();return B_a(t)?t:Nos}`，`Nos = jg.SPREAD`
   *  ⇒ **无存储时生成期布局 = spread**。MTV 默认 `spread` 与官方一致。 */
  const batchResultLayout = config.batchResultLayout ?? 'spread';

  const persistAfter = useCallback((patch: Parameters<typeof updateConfig>[0]) => {
    updateConfig(patch);
    void saveConfig().catch(() => undefined);
  }, [saveConfig, updateConfig]);

  const handleBatchLayoutSelect = useCallback((value: 'pile' | 'variants' | 'spread') => {
    persistAfter({ batchResultLayout: value });
  }, [persistAfter]);

  /** 画布背景：自定义背景的上传 / 识别 / 移除（原样从 `SettingsPanel` 搬来，行为不变） */
  const [bgDetection, setBgDetection] = useState<BackgroundDetection | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('请选择图片文件'), 'error');
      return;
    }
    setBgUploading(true);
    setBgDetection(null);
    try {
      const compression = await compressImageLossless(file);
      const detection = await detectBackgroundBrightness(compression.dataUrl);
      setBgDetection(detection);
      updateConfig({
        canvasBackground: 'custom',
        customBackgroundUrl: compression.dataUrl,
        customBackgroundIsDark: detection.isDark,
        theme: detection.isDark ? config.theme : 'light',
      });
      if (!await saveConfig().then(() => true).catch(() => false)) return;

      const sizeLabel = formatBytes(compression.compressedSize);
      const ratioLabel = compression.keptOriginal
        ? t('（保留原图，重编码会增大）')
        : compression.compressionRatio > 0
          ? t('（缩减 {ratio}%，{format}）', { ratio: compression.compressionRatio, format: compression.format.toUpperCase() })
          : t('（已最优，{format}）', { format: compression.format.toUpperCase() });
      showToast(t('{tone}背景 · {size} {ratio}', {
        tone: detection.isDark ? t('深色') : t('浅色'),
        size: sizeLabel,
        ratio: ratioLabel,
      }), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('背景图片处理失败'), 'error');
    } finally {
      setBgUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveCustomBg = async () => {
    updateConfig({
      canvasBackground: 'default',
      customBackgroundUrl: undefined,
      customBackgroundIsDark: undefined,
    });
    setBgDetection(null);
    try { await saveConfig(); } catch { return; }
    showToast(t('已恢复默认背景'));
  };

  return (
    <SettingsPaneBody>
      <SettingsPaneHeader title={t('画布设置')} description={t('管理画布中的默认行为和显示偏好。')} />

      <div className="mt-8 space-y-5">
        {/* ★ 官方「画布设置 → 批量生成结果」（`generation-result-layout-*`，逐字）
            官方结构：`role="radiogroup"` `flex w-fit shrink-0 gap-1 rounded-lg bg-muted/50 p-1`
              + 每个选项 `label.flex.h-9.min-w-24…rounded-md.px-3.text-sm.font-medium`
                （选中 `bg-background text-foreground shadow-sm`；未选中 `text-muted-foreground
                  hover:bg-background/60 hover:text-foreground`）+ 16px 图标 + 文案 + `sr-only` radio */}
        <SettingsRow
          title={t('批量生成结果')}
          description={t('选择一次生成多个结果时的默认保存方式。')}
        >
          <div className="o-segmented" role="radiogroup" aria-label={t('批量生成结果')}>
            <BatchLayoutOption value="pile" label={t('堆叠')} icon={<PileStackIcon />}
              checked={batchResultLayout === 'pile'} onSelect={handleBatchLayoutSelect} />
            <BatchLayoutOption value="variants" label={t('多变体')} icon={<VariantsIcon />}
              checked={batchResultLayout === 'variants'} onSelect={handleBatchLayoutSelect} />
            <BatchLayoutOption value="spread" label={t('铺开')} icon={<SpreadIcon />}
              checked={batchResultLayout === 'spread'} onSelect={handleBatchLayoutSelect} />
          </div>
        </SettingsRow>

        <SettingsRow title={t('画布交互方式')} description={t('选择画布上的平移与缩放手势。')}>
          <SettingsSegmented<InteractionMode>
            label={t('画布交互方式')}
            value={interactionMode}
            onChange={(value) => persistAfter({ interactionMode: value })}
            options={[
              { value: 'default', label: t('Figma 模式') },
              { value: 'classic', label: t('经典模式') },
            ]}
          />
        </SettingsRow>

        <SettingsRow title={t('节点工具栏')} description={t('节点顶部工具栏显示图标还是图标加文字。')}>
          <SettingsSegmented<NodeToolbarMode>
            label={t('节点工具栏')}
            value={nodeToolbarMode}
            onChange={(value) => persistAfter({ nodeToolbarMode: value })}
            options={[
              { value: 'icons', label: t('仅图标') },
              { value: 'icons-and-text', label: t('图标 + 文字') },
            ]}
          />
        </SettingsRow>

        <SettingsRow title={t('画布笔记工具栏')} description={t('是否显示画布笔记顶部的工具栏。')}>
          <SettingsSegmented<'on' | 'off'>
            label={t('画布笔记工具栏')}
            value={noteToolbarVisible ? 'on' : 'off'}
            onChange={(value) => persistAfter({ canvasNoteToolbarVisible: value === 'on' })}
            options={[
              { value: 'on', label: t('显示') },
              { value: 'off', label: t('隐藏') },
            ]}
          />
        </SettingsRow>

        <SettingsRow title={t('鼠标指针')} description={t('使用内置指针（跟随明暗主题自动切黑白），还是系统默认指针。')}>
          <SettingsSegmented<'custom' | 'system'>
            label={t('鼠标指针')}
            value={customCursor ? 'custom' : 'system'}
            onChange={(value) => persistAfter({ customCursor: value === 'custom' })}
            options={[
              { value: 'custom', label: t('自定义指针样式') },
              { value: 'system', label: t('系统默认') },
            ]}
          />
        </SettingsRow>

        <SettingsRow title={t('节点标题')} description={t('节点上方是否显示类型图标与名称（双击可重命名）。')}>
          <SettingsSegmented<'on' | 'off'>
            label={t('节点标题')}
            value={nodeLabelVisible ? 'on' : 'off'}
            onChange={(value) => persistAfter({ nodeLabelVisible: value === 'on' })}
            options={[
              { value: 'on', label: t('显示') },
              { value: 'off', label: t('隐藏') },
            ]}
          />
        </SettingsRow>

        <SettingsRow title={t('侧边栏')} description={t('侧边栏是半隐悬浮在画布之上，还是停靠在窗口内侧。')}>
          <SettingsSegmented<'floating' | 'docked'>
            label={t('侧边栏')}
            value={sidebarFloating ? 'floating' : 'docked'}
            onChange={(value) => persistAfter({ sidebarFloating: value === 'floating' })}
            options={[
              { value: 'floating', label: t('悬浮显示') },
              { value: 'docked', label: t('停靠显示') },
            ]}
          />
        </SettingsRow>

        <SettingsRow title={t('性能模式')} description={t('关闭高开销视觉效果与装饰动画，画布更跟手。')}>
          <SettingsSegmented<'on' | 'off'>
            label={t('性能模式')}
            value={performanceMode ? 'on' : 'off'}
            onChange={(value) => persistAfter({ performanceMode: value === 'on' })}
            options={[
              { value: 'on', label: t('开启') },
              { value: 'off', label: t('关闭') },
            ]}
          />
        </SettingsRow>

        {/* 画布背景：控件是带缩略图的网格 + 自定义上传/透明度，官方两栏行放不下 ⇒ 标题在上、控件在下 */}
        <section className="settings-row settings-row--stacked">
          <div className="settings-row-label">
            <h3 className="settings-row-title">{t('画布背景')}</h3>
            <p className="settings-row-desc">{t('选择画布底色主题；自定义背景支持上传图片并自动识别深浅。')}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {BACKGROUND_OPTIONS.map(({ value, label, theme }) => {
              const isActive = (config.canvasBackground || 'default') === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    if (value === 'custom') {
                      if (config.customBackgroundUrl) {
                        updateConfig({
                          canvasBackground: 'custom',
                          theme: config.customBackgroundIsDark ? config.theme : 'light',
                        });
                        void saveConfig().catch(() => undefined);
                      } else {
                        fileInputRef.current?.click();
                      }
                      return;
                    }
                    updateConfig({ canvasBackground: value as CanvasBg, theme });
                    setBgDetection(null);
                    void saveConfig().catch(() => undefined);
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-1 transition-colors ${
                    isActive
                      ? 'border-primary bg-primary/10 text-accent-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-accent'
                  }`}
                >
                  <div
                    className={`flex h-12 w-full items-center justify-center overflow-hidden rounded border border-border ${
                      value === 'default'
                        ? 'bg-[#0a0a1a]'
                        : value === 'solar-system'
                          ? 'bg-gradient-to-br from-[#0a0a1a] via-[#1a1030] to-[#0a1020]'
                          : value === 'nebula'
                            ? 'bg-gradient-to-b from-[#0a0514] via-[#14081e] to-[#0a0514]'
                            : value === 'off-white'
                              ? 'bg-[#F4F6FB]'
                              : value === 'frosted-glass'
                                ? 'canvas-bg-frosted-preview'
                                : value === 'custom'
                                  ? (config.customBackgroundUrl ? '' : 'bg-secondary')
                                  : 'bg-black'
                    }`}
                    style={
                      value === 'custom' && config.customBackgroundUrl
                        ? { backgroundImage: `url(${config.customBackgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : undefined
                    }
                  >
                    {value === 'default' && (
                      <div className="size-full" style={{
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
                        backgroundSize: '8px 8px',
                      }} />
                    )}
                    {value === 'solar-system' && (
                      <div className="relative flex size-full items-center justify-center">
                        <div className="size-5 rounded-full bg-gradient-to-br from-purple-400 to-orange-400 opacity-80 shadow-lg shadow-orange-500/30" />
                        <div className="absolute inset-x-0 bottom-1 flex justify-center">
                          <div className="h-1 w-8 rounded-full" style={{ borderRadius: '50% 50% 0 0', borderTop: '1px solid var(--white-alpha-15)' }} />
                        </div>
                      </div>
                    )}
                    {value === 'nebula' && (
                      <div className="relative flex size-full items-center justify-center gap-1.5">
                        <div className="flex gap-1.5 opacity-60">
                          <div className="h-3 w-2 rounded-sm bg-purple-600/60 blur-[2px]" />
                          <div className="h-3 w-2 rounded-sm bg-fuchsia-600/50 blur-[2px]" />
                          <div className="h-3 w-2 rounded-sm bg-violet-600/40 blur-[2px]" />
                        </div>
                        <div className="absolute inset-0" style={{
                          backgroundImage: 'radial-gradient(1px 1px, rgba(180,150,255,0.3) 0%, transparent 100%)',
                          backgroundSize: '12px 12px',
                        }} />
                      </div>
                    )}
                    {value === 'off-white' && (
                      <div className="size-full" style={{
                        backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
                        backgroundSize: '8px 8px',
                      }} />
                    )}
                    {value === 'custom' && !config.customBackgroundUrl && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[11px] font-medium">{t(label)}</span>
                </button>
              );
            })}
          </div>

          {config.canvasBackground === 'custom' && config.customBackgroundUrl && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-2">
              <div className="flex items-center gap-3">
                <div
                  className="h-14 w-20 shrink-0 rounded border border-border"
                  style={{
                    backgroundImage: `url(${config.customBackgroundUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="settings-save-btn text-xs"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={bgUploading}
                    >
                      {bgUploading ? t('识别中…') : t('更换图片')}
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-3 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                      onClick={() => { void handleRemoveCustomBg(); }}
                    >
                      {t('移除背景')}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`size-2 shrink-0 rounded-full ${
                      bgDetection ? (bgDetection.isDark ? 'bg-primary' : 'bg-amber-400') : 'bg-border'
                    }`} />
                    <span className="text-[11px] text-muted-foreground">
                      {bgDetection
                        ? t('已识别为{tone}背景（亮度: {brightness}/255）', { tone: bgDetection.isDark ? t('深色') : t('浅色'), brightness: bgDetection.brightness })
                        : config.customBackgroundIsDark !== undefined
                          ? t('已识别为{tone}背景', { tone: config.customBackgroundIsDark ? t('深色') : t('浅色') })
                          : t('未检测')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[11px] text-muted-foreground">{t('透明度')}</span>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={Math.round((config.customBackgroundOpacity ?? 0.3) * 100)}
                      onChange={(e) => {
                        updateConfig({ customBackgroundOpacity: Number(e.target.value) / 100 });
                        void saveConfig().catch(() => undefined);
                      }}
                      className="h-1 flex-1 cursor-pointer accent-primary"
                    />
                    <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">
                      {Math.round((config.customBackgroundOpacity ?? 0.3) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { void handleBgFileChange(e); }}
          />
        </section>
      </div>
    </SettingsPaneBody>
  );
}
