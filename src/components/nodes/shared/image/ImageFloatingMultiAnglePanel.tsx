/**
 * ImageFloatingMultiAnglePanel —— 官方「多角度」面板（`_nt`）1:1 复刻
 * ══════════════════════════════════════════════════════════════════════════
 * 官方（`course-api-base-url-CGXqZmAy.js` @3074800 `_nt`）：
 *  壳     `absolute bg-[#1A1A1A] rounded-2xl left-1/2 -translate-x-1/2 top-full mt-3 z-50 flex flex-col
 *          pointer-events-auto nodrag shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/10 w-[600px] overflow-hidden`
 *  头     `flex items-center justify-between px-4 py-3` + 标题 `text-sm font-semibold text-white/90`
 *         + ✕ `p-1 hover:bg-white/10 rounded-md transition-colors text-white/40 hover:text-white`（18px）
 *  体     `flex gap-4 p-4 pt-0`
 *  左舞台 `relative flex flex-col items-center justify-center w-[240px] h-[240px] overflow-hidden shrink-0
 *          border border-white/5` + 内联 `backgroundColor: rgba(255,255,255,.03) / borderRadius 16px / perspective 1000px`
 *  立方体 `relative w-[60px] h-[60px] cursor-grab active:cursor-grabbing` + `transformStyle: preserve-3d`
 *         + `transform: rotateX(preview.x) rotateY(preview.y) scale3d(s,s,s)`（`s = 1 + move_forward*.1`）
 *         + `transition: dragging ? none : 'transform .5s cubic-bezier(.2,1,.3,1)'`
 *  面     `absolute w-full h-full flex items-center justify-center border backface-hidden select-none rounded-sm bg-[#222]`
 *         front `bg-[#444] border-white/20 overflow-hidden`（贴原图），其余 BK/L/R/T/B `text-[10px] font-bold text-white/30`
 *         transform：front/back `rotateY(0/180) translateZ(30px)`、left/right `rotateY(∓90) translateZ(30px)`、
 *                    top/bottom `rotateX(±90) translateZ(30px)`
 *  重置   `absolute bottom-3 left-3 flex items-center gap-1 text-[11px] font-medium text-white/30
 *          transition-colors hover:text-white/60`（图标 12px）
 *  右列   `flex-1 flex flex-col justify-center` > `space-y-4` 三条滑块 + 开关行；胶囊 `w-fit mt-4 justify-between self-end`
 *  预览↔参数：`preview = { x: vertical_angle*45, y: -rotate_right_left }`（拖拽即反算，`round2` 后 clamp）
 *  ★ 出现/执行/生成逻辑见 ImageNode 的 `handleMultiAngleGenerate`（+200 位置、MULTI_ANGLE、失败删节点）。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from '../../../../i18n';
import { Icon } from './floatingEditorIcons';
import {
  MULTI_ANGLE_DEFAULTS,
  MULTI_ANGLE_RANGES,
  normalizeMultiAngleParams,
  round2,
  type MultiAngleParams,
} from '../../../../services/ai/multiAngle';

type CubePosition = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

/** 官方 `qf`（逐字） */
const CUBE_TRANSFORM: Record<CubePosition, string> = {
  front: 'rotateY(0deg) translateZ(30px)',
  back: 'rotateY(180deg) translateZ(30px)',
  left: 'rotateY(-90deg) translateZ(30px)',
  right: 'rotateY(90deg) translateZ(30px)',
  top: 'rotateX(90deg) translateZ(30px)',
  bottom: 'rotateX(-90deg) translateZ(30px)',
};

const CUBE_LABEL: Record<Exclude<CubePosition, 'front'>, string> = {
  back: 'BK', left: 'L', right: 'R', top: 'T', bottom: 'B',
};

/** 官方 `QI`（逐字结构：1.5px 轨道 + 从 defaultValue 起的白色已选段 + 2.5px 白点 + 隐藏 range） */
function SliderRow({
  label,
  value,
  displayValue,
  unit = '',
  min,
  max,
  step,
  defaultValue,
  locked,
  onValueChange,
}: {
  label: string;
  value: number;
  displayValue?: number;
  unit?: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  locked: boolean;
  onValueChange: (next: number) => void;
}) {
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const cur = pct(value);
  const dflt = pct(defaultValue);
  const left = Math.min(cur, dflt);
  const width = Math.abs(cur - dflt);
  return (
    <div className="ma-slider">
      <span className="ma-slider-label">{label}</span>
      <div className="ma-slider-track-wrap">
        <div className="ma-slider-track">
          <div className="ma-slider-fill" style={{ left: `${left}%`, width: `${width}%` }} />
        </div>
        <div className="ma-slider-thumb" style={{ left: `calc(${cur}% - 5px)` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-disabled={locked || undefined}
          className="ma-slider-input"
          onChange={(event) => { if (!locked) onValueChange(Number.parseFloat(event.target.value)); }}
        />
      </div>
      <span className="ma-slider-value">{displayValue !== undefined ? displayValue : value}{unit}</span>
    </div>
  );
}

export interface ImageFloatingMultiAnglePanelProps {
  src: string;
  /** 官方 policy `actions.multi_angle.params` */
  initialParams?: Partial<MultiAngleParams> | null;
  /** 官方 `parametersLocked`（策略锁参数时控件 `aria-disabled`） */
  parametersLocked?: boolean;
  onClose: () => void;
  /** 官方 `k()`：返回 Promise；面板用 `sending` 显示发送态 */
  onGenerate: (params: MultiAngleParams) => void | Promise<void>;
}

export default function ImageFloatingMultiAnglePanel({
  src,
  initialParams,
  parametersLocked = false,
  onClose,
  onGenerate,
}: ImageFloatingMultiAnglePanelProps) {
  const t = useT();
  const normalized = useMemo(() => normalizeMultiAngleParams(initialParams), [initialParams]);
  /* 官方是 `useState(normalized)` + `useEffect(()=>setParams(normalized),[normalized])`；
     MTV 的 lint 禁止「effect 里 setState」⇒ 这里用 `null` 表示「还没有本地覆盖」，
     直接派生 `params = override ?? normalized`（行为等价：`initialParams` 变了就跟着变）。 */
  const [override, setOverride] = useState<MultiAngleParams | null>(null);
  const params = override ?? normalized;
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; preview: { x: number; y: number } } | null>(null);

  /* 官方：`z({ x: vertical_angle*45, y: -rotate_right_left })` */
  const preview = useMemo(
    () => ({ x: params.vertical_angle * 45, y: -params.rotate_right_left }),
    [params.rotate_right_left, params.vertical_angle],
  );

  const patch = useCallback((next: Partial<MultiAngleParams>) => {
    setOverride((current) => normalizeMultiAngleParams({ ...(current ?? normalized), ...next }));
  }, [normalized]);

  const reset = useCallback(() => {
    if (parametersLocked) return;
    setOverride(MULTI_ANGLE_DEFAULTS);
  }, [parametersLocked]);

  /* 官方拖拽：mousedown 记起点 → window mousemove 按位移反算（round2 + clamp）→ mouseup 收尾 */
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (parametersLocked || event.button !== 0) return;
    event.preventDefault();
    dragRef.current = { x: event.clientX, y: event.clientY, preview: { ...preview } };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const nextX = drag.preview.x + (event.clientX - drag.x);
      const nextY = drag.preview.y + (event.clientY - drag.y);
      patch({
        vertical_angle: round2(nextX / 45),
        rotate_right_left: round2(-nextY),
      });
    };
    const onUp = () => { setDragging(false); dragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, patch]);

  const submit = useCallback(async () => {
    if (sending || !src) return;
    setSending(true);
    try {
      await onGenerate(params);
    } finally {
      setSending(false);
    }
  }, [onGenerate, params, sending, src]);

  const cubeScale = 1 + params.move_forward * 0.1;
  const face = (position: CubePosition) => (
    <div
      key={position}
      className={`ma-cube-face${position === 'front' ? ' ma-cube-face--front' : ''}`}
      style={{ transform: CUBE_TRANSFORM[position] }}
    >
      {position === 'front'
        ? (src ? <img src={src} alt="" draggable={false} className="ma-cube-image" /> : <Icon name="rectangle" size={24} />)
        : <span className="ma-cube-label">{CUBE_LABEL[position]}</span>}
    </div>
  );

  return (
    <div className="ma-panel nodrag" data-testid="image-multi-angle-panel">
      <div className="ma-header">
        <span className="ma-title">{t('拖拽方块调整角度')}</span>
        <button type="button" className="ma-close" onClick={onClose} aria-label={t('取消')} data-testid="image-multi-angle-close">
          <Icon name="x" size={18} />
        </button>
      </div>
      <div className="ma-body">
        <div className="ma-stage">
          <div
            className="ma-cube"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${preview.x}deg) rotateY(${preview.y}deg) scale3d(${cubeScale}, ${cubeScale}, ${cubeScale})`,
              transition: dragging ? 'none' : 'transform 0.5s cubic-bezier(0.2, 1, 0.3, 1)',
            }}
            onPointerDown={onPointerDown}
            data-testid="image-multi-angle-cube"
          >
            {(['front', 'back', 'left', 'right', 'top', 'bottom'] as CubePosition[]).map(face)}
          </div>
          <button
            type="button"
            className="ma-reset"
            onClick={reset}
            aria-disabled={parametersLocked || undefined}
            data-testid="image-multi-angle-reset"
          >
            <Icon name="arrowBackUp" size={12} />
            {t('重置')}
          </button>
        </div>
        <div className="ma-right">
          <div className="ma-controls">
            <SliderRow
              label={t('旋转')}
              value={params.rotate_right_left}
              unit="°"
              {...MULTI_ANGLE_RANGES.rotate_right_left}
              locked={parametersLocked}
              onValueChange={(next) => patch({ rotate_right_left: next })}
            />
            <SliderRow
              label={t('俯仰')}
              value={params.vertical_angle}
              displayValue={Math.round(params.vertical_angle * 45)}
              unit="°"
              {...MULTI_ANGLE_RANGES.vertical_angle}
              locked={parametersLocked}
              onValueChange={(next) => patch({ vertical_angle: next })}
            />
            <SliderRow
              label={t('缩放')}
              value={params.move_forward}
              {...MULTI_ANGLE_RANGES.move_forward}
              locked={parametersLocked}
              onValueChange={(next) => patch({ move_forward: next })}
            />
            <div className="ma-switch-row">
              <span className="ma-switch-label">{t('广角镜头')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={params.wide_angle_lens}
                aria-disabled={parametersLocked || undefined}
                data-state={params.wide_angle_lens ? 'checked' : 'unchecked'}
                className="ma-switch"
                data-testid="image-multi-angle-wide"
                onClick={() => { if (!parametersLocked) patch({ wide_angle_lens: !params.wide_angle_lens }); }}
              >
                <span className="ma-switch-thumb" />
              </button>
            </div>
          </div>
          {/* 官方 `Af`（共享生成胶囊）：`className="w-fit mt-4 justify-between self-end"`、`estimatedPrice:"10"` */}
          <div className="ma-generate irf-generate">
            <div className="irf-generate-count">
              <Icon name="coins" size={16} />
              <span className="irf-generate-number">10</span>
            </div>
            <button
              type="button"
              className="irf-generate-btn"
              onClick={() => void submit()}
              disabled={sending || !src}
              title={t('生成')}
              aria-label="Multi angle generate"
              data-testid="image-multi-angle-generate"
            >
              <Icon name="arrowUp" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
