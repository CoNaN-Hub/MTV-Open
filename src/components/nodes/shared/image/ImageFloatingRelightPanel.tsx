/**
 * ImageFloatingRelightPanel —— 官方「打光」（`RelightFeature`，`assets/index-TabNyQNQ.js`）
 * ══════════════════════════════════════════════════════════════════════════
 * 官方结构（逐字，源码 + 9444 实测 DOM 对齐）：
 *  · 右列 `flex flex-col pt-1`，`style={{width:246, height:322}}`
 *      「全局」`text-sm font-medium` + `flex flex-col gap-2` → 亮度 / 色温（滑块标题
 *      `text-sm font-semibold text-foreground/[0.48] mb-0.5 block`；滑块 = 官方 `je` 档位滑块，
 *      见 `RelightStopSlider`：132×22 轨道 + `top:18` 的 2×2 档位点 + 84×24 数值胶囊，色温带 `trackGradient`）
 *      → `h-px bg-border` → 「主光源」`gap-1` + 6 按钮网格（`h-6 px-6 rounded-sm text-xs font-semibold`）
 *      → `h-px bg-border` → 轮廓光行：`text-sm font-bold`（`R` 为假时 `text-white/30`）+
 *        ⓘ(`help-circle` 14px `text-white/30 cursor-help`) + Switch（`disabled = locked || !R`）
 *      → 胶囊 `w-fit mt-auto justify-between self-end`，`estimatedPrice`（官方实测 = 20）
 *  · 官方联动（逐字）：
 *      `ie(az,el)`：`preset = Ke(az,el)`，并 `rimEnabled = pe(az,el) ? 保持 : false`
 *      `ae(preset)`：同上一并落 `az/el`
 *      `R = pe(angle)`：轮廓光可用性（白色文字 / 开关可用）
 *      `U = ye.find(k).color` → 灯架 `lightColor`；`B = k<=4000?'#D5C6AA':k>=7000?'#9EC4F9':'#A6A196'` → 标签块光晕色
 *      标签块文案 `dragTarget==='rim' && rimEnabled ? 轮廓光 : 主光源`，文字色 `'#989898' : '#B4B4B4'`
 *  · 左列：官方为 three.js 球灯架；左上「透视 / 正面」切换、左下「重置」、下方「主光源」标签块（官方 `si`：
 *      `background:#212121; borderRadius:12px 12px 0 0; outline:1px solid var(--border); outlineOffset:-1;
 *       height:22px; padding:0 14px`，12px italic uppercase + 底部 `89×12` 光晕条 `opacity .33 blur 3.1px`）
 *  · 数据模型 / 提交：见 `services/ai/relight.ts`（6 方向预设、45° 吸附、`relight({...}).send()` → 原地替换源图）
 */
import { useCallback, useMemo, useState } from 'react';
import { useT } from '../../../../i18n';
import { Icon } from './floatingEditorIcons';
import RelightRig3D from './RelightRig3D';
import RelightStopSlider from './RelightStopSlider';
import {
  RELIGHT_BRIGHTNESS_STOPS,
  RELIGHT_DIRECTIONS,
  RELIGHT_RIM_PRESETS,
  RELIGHT_TEMPERATURE_STOPS,
  RELIGHT_TEMPERATURE_TRACK_GRADIENT,
  isRelightAngleAllowed,
  normalizeRelightParams,
  relightLightColorFor,
  relightTabGlowColorFor,
  type RelightParams,
  type RelightPresetKey,
} from '../../../../services/ai/relight';

export interface ImageFloatingRelightPanelProps {
  src: string;
  initialParams?: Partial<RelightParams> | null;
  parametersLocked?: boolean;
  onClose: () => void;
  onGenerate: (params: RelightParams) => void | Promise<void>;
}

/** 官方方向文案（9444 截图逐字）：左侧 / 顶部 / 右侧 / 前方 / 底部 / 后方 */
const DIRECTION_LABEL: Record<RelightPresetKey, string> = {
  left_90: '左侧',
  top_90: '顶部',
  right_90: '右侧',
  front_0: '前方',
  bottom_90: '底部',
  back_180: '后方',
};

/** 官方 `Ve`：亮度档位（3 档，颜色统一 `#CCCCCC`） */
const RELIGHT_BRIGHTNESS_SLIDES = RELIGHT_BRIGHTNESS_STOPS.map((value) => ({ value, color: '#CCCCCC' }));
/** 官方 `ye`：色温档位（6 档，各带灯色） */
const RELIGHT_TEMPERATURE_SLIDES = RELIGHT_TEMPERATURE_STOPS.map((stop) => ({ value: stop.value, color: stop.color }));

export default function ImageFloatingRelightPanel({
  src,
  initialParams,
  parametersLocked = false,
  onClose,
  onGenerate,
}: ImageFloatingRelightPanelProps) {
  const t = useT();
  const normalized = useMemo(() => normalizeRelightParams(initialParams), [initialParams]);
  const [override, setOverride] = useState<RelightParams | null>(null);
  const params = override ?? normalized;
  const [viewMode, setViewMode] = useState<'perspective' | 'front'>('perspective');
  const [sending, setSending] = useState(false);

  const patch = useCallback((next: Partial<RelightParams>) => {
    setOverride((current) => normalizeRelightParams({ ...(current ?? normalized), ...next }));
  }, [normalized]);

  /** 官方 `ie`：角度变化 → `preset = Ke(az,el)`；角度不在允许集合 `Bt` 内则强制关掉轮廓光 */
  const applyAngle = useCallback((azimuthDeg: number, elevationDeg: number) => {
    setOverride((current) => {
      const base = current ?? normalized;
      return normalizeRelightParams({
        ...base,
        azimuthDeg,
        elevationDeg,
        rimEnabled: isRelightAngleAllowed(azimuthDeg, elevationDeg) ? base.rimEnabled : false,
      });
    });
  }, [normalized]);

  /** 官方 `ae`：点方向按钮 */
  const selectPreset = useCallback((key: string, azimuthDeg: number, elevationDeg: number) => {
    setOverride((current) => {
      const base = current ?? normalized;
      return normalizeRelightParams({
        ...base,
        anglePreset: key,
        azimuthDeg,
        elevationDeg,
        rimEnabled: isRelightAngleAllowed(azimuthDeg, elevationDeg) ? base.rimEnabled : false,
      });
    });
  }, [normalized]);

  const rear = RELIGHT_RIM_PRESETS.find((item) => item.key === params.rimPreset) ?? RELIGHT_RIM_PRESETS[0];
  const rearAzimuth = rear.azimuthDeg;
  const rearElevation = rear.elevationDeg;
  const [dragTarget, setDragTarget] = useState<'main' | 'rim'>('main');

  const submit = useCallback(async () => {
    if (sending || !src) return;
    setSending(true);
    try { await onGenerate(params); } finally { setSending(false); }
  }, [onGenerate, params, sending, src]);

  /** 官方 `R = pe(angle)`：轮廓光可用性 */
  const rimAvailable = isRelightAngleAllowed(params.azimuthDeg, params.elevationDeg);
  /** 官方 `U`：色温 → 灯架灯色 */
  const lightColor = relightLightColorFor(params.temperatureK);
  /** 官方 `B`：色温 → 标签块底部光晕色 */
  const tabGlowColor = relightTabGlowColorFor(params.temperatureK);
  /** 官方 `si` 文字色：拖轮廓光且开启时 `#989898`，否则 `#B4B4B4` */
  const tabTextColor = dragTarget === 'rim' && params.rimEnabled ? '#989898' : '#B4B4B4';

  return (
    <div className="rl-panel nodrag" data-testid="image-relight-panel">
      <button
        type="button"
        className="rl-close"
        onClick={onClose}
        aria-label={t('取消')}
        data-testid="image-relight-close"
      >
        <Icon name="x" size={18} />
      </button>
      <div className="ma-body">
        <div className="rl-stage">
          <div className="rl-stage-inner">
            <RelightRig3D
              imageSrc={src}
              azimuthDeg={params.azimuthDeg}
              elevationDeg={params.elevationDeg}
              brightnessPercent={params.brightnessLevel}
              rimEnabled={params.rimEnabled}
              rimAzimuthDeg={rearAzimuth}
              rimElevationDeg={rearElevation}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              lightColor={lightColor}
              disabled={parametersLocked}
              onDragTargetChange={setDragTarget}
              onRimPresetChange={(preset) => patch({ rimPreset: preset })}
              onAngleChange={({ azimuthDeg, elevationDeg }) => applyAngle(azimuthDeg, elevationDeg)}
            />
          </div>
          <button
            type="button"
            className="rl-reset"
            aria-disabled={parametersLocked || undefined}
            data-testid="image-relight-reset"
            onClick={() => { if (!parametersLocked) setOverride(null); }}
          >
            <Icon name="arrowBackUp" size={12} />
            {t('重置')}
          </button>
          <div className="rl-tab-chip-wrap">
            <span className="rl-tab-chip" style={{ color: tabTextColor }}>
              {dragTarget === 'rim' && params.rimEnabled ? t('轮廓光') : t('主光源')}
              <span className="rl-tab-glare" aria-hidden="true" style={{ background: tabGlowColor }} />
            </span>
          </div>
        </div>
        <div className="rl-right">
          <div className="rl-groups">
            <div className="rl-group-wide">
              <span className="rl-section-title">{t('全局')}</span>
              <div className="rl-group-wide">
                <div>
                  <span className="rl-slider-title">{t('亮度')}</span>
                  <RelightStopSlider
                    stops={RELIGHT_BRIGHTNESS_SLIDES}
                    value={params.brightnessLevel}
                    onChange={(value) => patch({ brightnessLevel: value })}
                    icon={<Icon name="sun" size={14} />}
                    suffix="%"
                    disabled={parametersLocked}
                  />
                </div>
                <div>
                  <span className="rl-slider-title">{t('色温')}</span>
                  <RelightStopSlider
                    stops={RELIGHT_TEMPERATURE_SLIDES}
                    value={params.temperatureK}
                    onChange={(value) => patch({ temperatureK: value })}
                    trackGradient={RELIGHT_TEMPERATURE_TRACK_GRADIENT}
                    icon={<Icon name="temperature" size={14} />}
                    suffix="K"
                    disabled={parametersLocked}
                  />
                </div>
              </div>
            </div>
            <div className="rl-divider" />
            <div className="rl-group">
              <span className="rl-section-title">{t('主光源')}</span>
              <div className="rl-preset-grid">
                {RELIGHT_DIRECTIONS.map((direction) => (
                  <button
                    key={direction.key}
                    type="button"
                    className="rl-preset-cell"
                    data-state={params.anglePreset === direction.key ? 'on' : 'off'}
                    aria-disabled={parametersLocked || undefined}
                    data-testid={`image-relight-direction-${direction.key}`}
                    onClick={() => {
                      if (parametersLocked) return;
                      selectPreset(direction.key, direction.azimuthDeg, direction.elevationDeg);
                    }}
                  >
                    {t(DIRECTION_LABEL[direction.key])}
                  </button>
                ))}
              </div>
            </div>
            <div className="rl-divider" />
            <div className="rl-rim-row">
              <div className="rl-rim-label">
                <span className={`rl-rim-text${rimAvailable ? ' is-on' : ''}`}>{t('轮廓光')}</span>
                <span
                  className="rl-rim-info"
                  title={t('轮廓光是主光在主体边缘形成的亮边；开启后会在输入图边缘补一圈背光')}
                >
                  <Icon name="helpCircle" size={14} />
                </span>
              </div>
              <button
                type="button" role="switch"
                aria-checked={params.rimEnabled}
                aria-disabled={parametersLocked || !rimAvailable || undefined}
                data-state={params.rimEnabled ? 'checked' : 'unchecked'}
                className="ma-switch rl-switch"
                data-testid="image-relight-rim"
                onClick={() => { if (!parametersLocked && rimAvailable) patch({ rimEnabled: !params.rimEnabled }); }}
              >
                <span className="ma-switch-thumb" />
              </button>
            </div>
          </div>
          <div className="ma-generate irf-generate rl-generate">
            <div className="irf-generate-count">
              <Icon name="coins" size={16} />
              <span className="irf-generate-number">20</span>
            </div>
            <button
              type="button" className="irf-generate-btn"
              onClick={() => void submit()}
              disabled={sending || !src}
              title={t('生成')} aria-label="Relight generate"
              data-testid="image-relight-generate"
            >
              <Icon name="arrowUp" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
