/**
 * 摄影机控制（官方「Lens Combo」）—— **逐字复刻官方那一套**。
 *
 * 官方出处：`web/resources/web/assets/zoom-slider-3ZcFvYQO.js`
 *   · `k0`  @3168320 滚轮选择器（本文件的 `CameraWheelPicker`）
 *   · `Snt` @3171270 弹层内容 Lens Combo（`CameraLensComboPanel`）
 *   · `Ant` @3177828 触发组（`CameraControl`）＝ 图标开关 + 文字 + hover 小叉 + Tooltip + Popover
 *   · `ynt` 默认项渲染 · `CH` 左右箭头 · `ui` 常量（见 `src/data/cameraControl.ts`）
 *
 * ⚠️ 官方原语 `Eo/Xr/Kr/qr/or`（radix Popover/Tooltip）MTV 没有 ⇒ 用**等价实现**：
 *   popover 走 `createPortal(document.body)` + 按触发器 rect 定位（与 MTV 其它浮层同款做法），
 *   tooltip 用本地 hover 状态自绘（官方那张是**富卡片**：缩略图 + 名字 + ON/OFF + 组合，
 *   MTV 的 `[data-tooltip]` 只能放纯文本 ⇒ 装不下）。
 *
 * ⚠️ 官方把「上次用的组合」存**云端模型偏好**（`KM()`）；MTV 无此后端 ⇒ 存本机 config
 *   （`config.cameraControlDefaults`），换机器不同步，这是唯一差异。
 *
 * ★ **按钮出不出现 = 官方逐模型白名单**：官方只在 7 个模型上挂这个组件
 *   （`zoom-slider-3ZcFvYQO.js` @3211385；枚举展开见 `src/data/cameraControl.ts` 的
 *   `CAMERA_OFFICIAL_MODELS` + `cameraControlAllowedFor`）。
 *   挂载点在 `PromptPanel.tsx`，**不在本文件** —— 本组件只管「已经该显示时怎么显示/怎么改」。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

import { useAppStore } from '../../../store/useAppStore';
import { getLocale, useT, type Locale } from '../../../i18n';
import type { CameraGenerationSettings } from '../../../types';
import {
  CAMERA_APERTURES, CAMERA_BODIES, CAMERA_DEFAULTS, CAMERA_FOCALS, CAMERA_LENSES, CAMERA_PICKER,
  CAMERA_PICKER_BG, type CameraOption,
} from '../../../data/cameraControl';
import { migrateCameraSettings } from './image/cameraStudio';
import lensOnUrl from '../../../assets/official-icons/camera/lens-on.png';
import lensOffUrl from '../../../assets/official-icons/camera/lens-off.png';

/* ────────────────────────────── k0 · 滚轮选择器 ────────────────────────────── */

/**
 * 官方 `camera_control.on` / `camera_control.off` 四语原文（逐字取自官方语言包）。
 * ⚠️ 为什么不走 `t()`：MTV 的 i18n 以**中文原文为 key**，而 `'关闭'` 在 `common.ts` 里已经是
 *    "Close"（17 处工具按钮复用）⇒ 同一个 key 塞不进 "OFF"。这张表是唯一能保证四语逐字一致的写法。
 */
const CAMERA_STATE: Record<'on' | 'off', Record<Locale, string>> = {
  on: { 'zh-CN': '开启', 'en-US': 'ON', 'ja-JP': 'オン', 'ko-KR': '켜기' },
  off: { 'zh-CN': '关闭', 'en-US': 'OFF', 'ja-JP': 'オフ', 'ko-KR': '끄기' },
};

interface WheelPickerProps {
  options: CameraOption[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
  isActive?: boolean;
  onFocus?: () => void;
}

/**
 * 官方 `k0`：一列纵向滚动的器材；窗口上下各留 `PREVIEW_HEIGHT`，
 * 选中项 64×64 全亮、相邻项 48×48 半透明；轮播由 `translateY` 驱动（200ms ease-out）。
 */
function CameraWheelPicker({ options, value, onChange, disabled = false, isActive = false, onFocus }: WheelPickerProps) {
  const size = CAMERA_PICKER.ITEM_SIZE;
  const step = size + CAMERA_PICKER.ITEM_GAP;
  const index = useMemo(() => {
    const found = options.findIndex((option) => option.key === value);
    return found >= 0 ? found : 0;
  }, [options, value]);
  /** 切换动画期间的临时位移（官方 `g`）*/
  const [shift, setShift] = useState(0);
  const [animating, setAnimating] = useState(false);
  const alive = useRef(true);
  const wheel = useRef({ accumulated: 0, lastSwitch: 0 });

  /* 官方 `k0` 是 `const f = useRef(!0); useEffect(() => () => { f.current = !1 }, [])` ——
     生产构建里那没问题；但 **dev + React StrictMode 会 mount→cleanup→mount**，
     只写 cleanup 的话 `alive` 会被永久置 false ⇒ 下面的 200ms 定时器**每次都早退**、
     换档永远不生效（实测：面板里点相邻项毫无反应 ✗）。
     ⇒ effect 体内补一次 `alive.current = true`，语义与官方等价、且抗 StrictMode ✓ */
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const go = useCallback((nextIndex: number) => {
    if (disabled || animating) return;
    if (nextIndex < 0 || nextIndex >= options.length) return;
    const next = options[nextIndex].key;
    setAnimating(true);
    setShift(nextIndex > index ? -step : step);
    window.setTimeout(() => {
      if (!alive.current) return;
      onChange(next);
      setShift(0);
      setAnimating(false);
    }, CAMERA_PICKER.ANIMATION_DURATION);
  }, [animating, disabled, index, onChange, options, step]);

  /* 滚轮：累计到阈值才切一档，两次切换之间有冷却（官方 `THRESHOLD` / `COOLDOWN_MS`）*/
  const onWheel = useCallback((event: React.WheelEvent) => {
    if (disabled || animating) return;
    const now = Date.now();
    const state = wheel.current;
    if (now - state.lastSwitch < CAMERA_PICKER.COOLDOWN_MS) return;
    state.accumulated += event.deltaY;
    if (Math.abs(state.accumulated) < CAMERA_PICKER.THRESHOLD) return;
    if (state.accumulated > 0) go(index + 1); else go(index - 1);
    state.accumulated = 0;
    state.lastSwitch = now;
  }, [animating, disabled, go, index]);

  const current = options[index];
  const windowHeight = CAMERA_PICKER.PREVIEW_HEIGHT * 2 + size;
  const translate = -(index * step) + CAMERA_PICKER.PREVIEW_HEIGHT + (size - step) / 2 + shift;

  return (
    <div
      className={`cc-picker${disabled ? ' is-disabled' : ''}`}
      onClick={onFocus}
      onWheel={onWheel}
    >
      <div className="cc-picker__row">
        <span className="cc-picker__arrow">
          <Icon icon="lucide:chevron-down" width={10} height={10} className={`cc-picker__chevron cc-picker__chevron--left${isActive ? ' is-active' : ''}`} aria-hidden="true" />
        </span>
        <div className="cc-picker__window" style={{ width: size, height: windowHeight }}>
          <div
            className={`cc-picker__frame${isActive ? ' is-active' : ''}`}
            style={{ top: CAMERA_PICKER.PREVIEW_HEIGHT, height: size, backgroundImage: `url(${CAMERA_PICKER_BG})` }}
          />
          <div className="cc-picker__clip">
            <div
              className="cc-picker__list"
              style={{
                transform: `translateY(${translate}px)`,
                transitionDuration: animating ? `${CAMERA_PICKER.ANIMATION_DURATION}ms` : '0ms',
                gap: CAMERA_PICKER.ITEM_GAP,
              }}
            >
              {options.map((option, optionIndex) => {
                const selected = optionIndex === index;
                const offset = optionIndex - index;
                return (
                  <div
                    key={option.key}
                    className="cc-picker__item"
                    style={{ width: size, height: size }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onFocus?.();
                      if (offset === -1) go(index - 1);
                      else if (offset === 1) go(index + 1);
                    }}
                  >
                    {option.image ? (
                      <div className="cc-picker__media">
                        <img
                          src={option.image}
                          alt={option.label}
                          draggable={false}
                          className={`cc-picker__img${selected ? ' is-selected' : ''}`}
                          style={{ transitionDuration: `${CAMERA_PICKER.ANIMATION_DURATION}ms` }}
                        />
                        {option.badge && selected && (
                          <span className="cc-picker__badge" style={{ transitionDuration: `${CAMERA_PICKER.ANIMATION_DURATION}ms` }}>
                            {option.badge}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span
                        className={`cc-picker__text${selected ? ' is-selected' : ''}`}
                        style={{ transitionDuration: `${CAMERA_PICKER.ANIMATION_DURATION}ms` }}
                      >
                        {option.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <span className="cc-picker__arrow">
          <Icon icon="lucide:chevron-down" width={10} height={10} className={`cc-picker__chevron cc-picker__chevron--right${isActive ? ' is-active' : ''}`} aria-hidden="true" />
        </span>
      </div>
      {current && (
        <span
          className={`cc-picker__label${animating ? ' is-fading' : ''}`}
          style={{ transitionDuration: `${CAMERA_PICKER.ANIMATION_DURATION / 2}ms` }}
        >
          {current.label}
        </span>
      )}
    </div>
  );
}

/* ────────────────────────── Snt · 弹层内容（Lens Combo） ────────────────────────── */

interface ComboPanelProps {
  settings: CameraGenerationSettings;
  onChange: (next: CameraGenerationSettings) => void;
  onClose: () => void;
  locked?: boolean;
  lockedFields?: string[];
}

function CameraLensComboPanel({ settings, onChange, onClose, locked = false, lockedFields = [] }: ComboPanelProps) {
  const t = useT();
  const [focusField, setFocusField] = useState<string | null>(null);
  const can = (field: string) => !locked && !lockedFields.includes(field);

  return (
    <div className="cc-panel" role="dialog" aria-label={t('摄影机控制')}>
      <div className="cc-panel__head">
        <span className="cc-panel__title">{t('摄影机控制')}</span>
        <button type="button" className="cc-panel__save" onClick={onClose}>{t('保存')}</button>
      </div>
      <div className="cc-panel__row">
        <CameraWheelPicker
          options={CAMERA_BODIES}
          value={settings.cameraKey}
          onChange={(key) => can('camera') && onChange({ ...settings, cameraKey: key })}
          disabled={!can('camera')}
          isActive={focusField === 'camera'}
          onFocus={() => setFocusField('camera')}
        />
        <span className="cc-panel__sep" />
        <CameraWheelPicker
          options={CAMERA_LENSES}
          value={settings.lensKey}
          onChange={(key) => can('lens') && onChange({ ...settings, lensKey: key })}
          disabled={!can('lens')}
          isActive={focusField === 'lens'}
          onFocus={() => setFocusField('lens')}
        />
        <span className="cc-panel__sep" />
        <CameraWheelPicker
          options={CAMERA_FOCALS}
          value={settings.focalKey}
          onChange={(key) => can('focal') && onChange({ ...settings, focalKey: key })}
          disabled={!can('focal')}
          isActive={focusField === 'focal'}
          onFocus={() => setFocusField('focal')}
        />
        <span className="cc-panel__sep" />
        <CameraWheelPicker
          options={CAMERA_APERTURES}
          value={settings.apertureKey}
          onChange={(key) => can('aperture') && onChange({ ...settings, apertureKey: key })}
          disabled={!can('aperture')}
          isActive={focusField === 'aperture'}
          onFocus={() => setFocusField('aperture')}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────── Ant · 触发组（按钮本体） ──────────────────────────── */

interface CameraControlProps {
  /** 节点上的设置（可能是旧格式，内部会迁移）*/
  value?: CameraGenerationSettings;
  onChange: (next: CameraGenerationSettings | undefined) => void;
  /** 官方 `locked` / `lockedFields`（来自 nodeUI policy；MTV 无该策略源 ⇒ 恒不锁）*/
  locked?: boolean;
  lockedFields?: string[];
}

export default function CameraControl({ value, onChange, locked = false, lockedFields = [] }: CameraControlProps) {
  const t = useT();
  const defaults = useAppStore((s) => s.config.cameraControlDefaults);
  const updateConfig = useAppStore((s) => s.updateConfig);
  const saveConfig = useAppStore((s) => s.saveConfig);

  /* 官方三级回落：节点设置 → 上次用过的组合 → 官方默认值 */
  const settings = useMemo<CameraGenerationSettings>(() => {
    const resolved = migrateCameraSettings(value);
    if (value) return resolved;
    const fallback = { ...CAMERA_DEFAULTS, ...(defaults ?? {}) };
    return { enabled: false, ...fallback };
  }, [value, defaults]);

  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<{ left: number; top: number } | null>(null);

  const remember = useCallback((next: CameraGenerationSettings) => {
    updateConfig({
      cameraControlDefaults: {
        cameraKey: next.cameraKey,
        lensKey: next.lensKey,
        focalKey: next.focalKey,
        apertureKey: next.apertureKey,
      },
    });
    void saveConfig().catch(() => undefined);
  }, [saveConfig, updateConfig]);

  const commit = useCallback((next: CameraGenerationSettings) => {
    onChange(next.enabled ? next : { ...next, enabled: false });
  }, [onChange]);

  /* 面板定位：按触发器的实时 rect（官方 Popover `side="top" align="center" sideOffset={8}`）*/
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setAnchorRect({ left: rect.left + rect.width / 2, top: rect.top - 8 });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  /* 外部点击 / Escape 关闭（官方 radix `DismissableLayer` 行为）
     ⚠️ Escape：MTV 的节点面板在 **window 捕获阶段**监听并 `stopPropagation()`（`AINodeDialog`），
        所以那边已经加了 `.cc-popover` 豁免；本监听留在 **冒泡阶段**，等它放行后再关自己这一层。
        ⇒ 效果 = 官方：Esc 只关 Lens Combo，不关整个提示词面板。
     ⚠️「外部点击」用**标记类名**判定（MTV 已有约定，见 `PromptPanel` 的 `[data-batch-menu]`）：
        浮层是 `createPortal(document.body)` 的，**不在 `anchorRef` 里**，只判 ref 会把
        「点面板里的滚轮项」误判成 outside ⇒ 面板一按就关（实测踩过 ✗）。 */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Element | null;
      if (target?.closest('.cc-root, .cc-popover')) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const enabled = settings.enabled;
  const body = CAMERA_BODIES.find((item) => item.key === settings.cameraKey);
  const lens = CAMERA_LENSES.find((item) => item.key === settings.lensKey);
  const focal = CAMERA_FOCALS.find((item) => item.key === settings.focalKey);
  const aperture = CAMERA_APERTURES.find((item) => item.key === settings.apertureKey);
  /* 官方 tooltip 组合行：`Fi[lens] / ll[focal] / sh[aperture]`（**斜杠分隔**，逐字照抄）
     ⚠️ 官方 `NYe`（空格 + 逗号那种写法）在包里是**死代码** —— `Ant` 没接它，不抄。*/
  const comboText = `${lens?.label ?? settings.lensKey} / ${focal?.label ?? settings.focalKey} / ${aperture?.label ?? settings.apertureKey}`;
  /* 官方 `camera_control.on` / `camera_control.off`（开启/ON/オン/켜기 · 关闭/OFF/オフ/끄기）
     ⚠️ MTV 的 i18n 用中文原文当 key，`'关闭'` 已被 common.ts 占成 "Close"（17 处复用）
        ⇒ 无法再给「OFF」加译文，这里用官方四语的**本地小表**，保证与官方逐字一致。
       组件上方已调 `useT()`（内部 `useSyncExternalStore`）⇒ 切语言会重渲染，这里读 `getLocale()` 即可。*/
  const stateLabel = (enabled ? CAMERA_STATE.on : CAMERA_STATE.off)[getLocale()];

  const toggle = useCallback(() => {
    if (locked) return;
    const next = { ...settings, enabled: !enabled };
    commit(next);
    remember(next);
  }, [commit, enabled, locked, remember, settings]);

  return (
    <div
      ref={anchorRef}
      className={`cc-root${open ? ' is-open' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className={`cc-icon${enabled ? ' is-on' : ''}`}
        onClick={(event) => { event.stopPropagation(); toggle(); }}
        disabled={locked}
        aria-pressed={enabled}
        aria-label={t('摄影机控制')}
      >
        <img src={enabled ? lensOnUrl : lensOffUrl} alt={enabled ? 'Lens On' : 'Lens Off'} draggable={false} />
      </button>
      <button
        type="button"
        className="cc-text"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          /* ⚠️ 官方 `x` 是 `p(C), C && !o && !n && (f(!0), y(!0))` —— **先算再设**。
             不能把 `commit()` 写进 `setOpen` 的 updater 里：updater 在 render 阶段执行，
             那样会变成「渲染另一个组件时更新组件」⇒ React 报 warning（实测踩过）。 */
          const next = !open;
          setOpen(next);
          /* 官方：**打开面板即自动启用**（`C && !enabled && !locked → setEnabled(true)+保存`）*/
          if (next && !enabled && !locked) {
            const on = { ...settings, enabled: true };
            commit(on);
            remember(on);
          }
        }}
      >
        <span className={enabled ? 'cc-text__label is-truncate' : 'cc-text__label'}>
          {/* 官方两个分支都是 `camera_control.title`：开启时用**机身名**做兜底，未开启/无匹配时用标题 */}
          {enabled ? (body?.label ?? t('摄影机控制')) : t('摄影机控制')}
        </span>
      </button>
      {enabled && (
        <button
          type="button"
          className="cc-close"
          aria-label={t('关闭')}
          onClick={(event) => {
            event.stopPropagation();
            if (locked) return;
            commit({ ...settings, enabled: false });
          }}
        >
          <Icon icon="lucide:x" width={12} height={12} aria-hidden="true" />
        </button>
      )}

      {hover && !open && (
        <div className="cc-tooltip" role="tooltip">
          <div className="cc-tooltip__row">
            {body?.image && <img src={body.image} alt={body.label} className="cc-tooltip__thumb" />}
            <div>
              <div className="cc-tooltip__head">
                <span className="cc-tooltip__name">{body?.label ?? settings.cameraKey}</span>
                <span className={`cc-tooltip__state${enabled ? ' is-on' : ''}`}>{stateLabel}</span>
              </div>
              <p className="cc-tooltip__combo">{comboText}</p>
            </div>
          </div>
        </div>
      )}

      {open && anchorRect && createPortal(
        <div
          className="cc-popover"
          style={{ left: anchorRect.left, top: anchorRect.top }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CameraLensComboPanel
            settings={settings}
            onChange={(next) => { commit(next); remember(next); }}
            onClose={() => setOpen(false)}
            locked={locked}
            lockedFields={lockedFields}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
