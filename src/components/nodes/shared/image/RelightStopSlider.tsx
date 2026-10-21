/**
 * RelightStopSlider —— 官方打光面板的「档位滑块」（`je`，`assets/index-TabNyQNQ.js` @214-233）
 * ══════════════════════════════════════════════════════════════════════════
 * 官方结构与数值（逐字）：
 *  · 常量：`ve = 132`（轨道宽）、`ti = 20`（数值胶囊拖动一格 = 20px）
 *  · `ii(el, clientX, count)`：`index = round(clamp(x/l,0,1) * (count-1))` 再 clamp
 *  · 外层 `flex items-center justify-between`
 *  · 轨道 `relative select-none cursor-pointer`，`style={{width:132,height:22,touchAction:'none'}}`
 *      · 内条 `absolute left-0 overflow-hidden pointer-events-none`
 *          `style={{top:6,width:132,height:10,padding:2,borderRadius:有渐变?16:18,
 *                  background:有渐变?'rgba(173,176,178,0.10)':'rgba(255,255,255,0.09)',backdropFilter:'blur(19px)'}}`
 *          · 有渐变时再叠 `absolute inset-[2px] rounded-[14px]`（`trackGradient`）
 *          · 档位格 `relative flex w-full h-full` + `flex-1 rounded-lg transition-colors duration-200`，
 *            选中格 `background = stop.color`，其余透明
 *      · 档位点 `absolute rounded-full transition-opacity duration-200 pointer-events-none`
 *          `style={{top:18,left:u*t+u/2-1,width:2,height:2,background:stop.color,opacity:选中?.7:.2}}`（`u = 132/count`）
 *  · 数值胶囊 `flex items-center shrink-0 rounded-sm bg-input/30 select-none`
 *      `style={{width:84,height:24,cursor:'ew-resize',touchAction:'none'}}`，拖动按 `ti=20px` 换档
 *      · 内层 `flex-1 flex items-center pl-3 justify-between pr-2 pointer-events-none`
 *          · 图标盒 `w-[14px] h-[14px] flex items-center justify-center text-foreground shrink-0`
 *          · 数值 `text-sm font-medium text-foreground leading-5`
 *          · 单位 `text-sm font-semibold text-foreground/[0.34] leading-5`
 *  · 指针按下即 `setPointerCapture` + `preventDefault`；`pointerup` 结束（另挂 window 兜底）
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

const TRACK_WIDTH = 132;   // 官方 `ve`
const PILL_STEP = 20;      // 官方 `ti`

export interface RelightStop {
  value: number;
  color: string;
}

export interface RelightStopSliderProps {
  stops: readonly RelightStop[];
  value: number;
  onChange: (value: number) => void;
  /** 官方 `trackGradient`：色温轨道才传 */
  trackGradient?: string;
  icon: ReactNode;
  suffix?: string;
  disabled?: boolean;
}

/** 官方 `ii()`：横向坐标 → 最近档位下标 */
function indexFromClientX(element: HTMLElement, clientX: number, count: number): number {
  const rect = element.getBoundingClientRect();
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const index = Math.round((x / rect.width) * (count - 1));
  return Math.max(0, Math.min(index, count - 1));
}

export default function RelightStopSlider({
  stops,
  value,
  onChange,
  trackGradient,
  icon,
  suffix,
  disabled = false,
}: RelightStopSliderProps) {
  const activeIndex = stops.findIndex((stop) => stop.value === value);
  const hasGradient = Boolean(trackGradient);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackDragging, setTrackDragging] = useState(false);
  const [pillDragging, setPillDragging] = useState(false);
  const pillStartX = useRef(0);
  const pillStartIndex = useRef(0);

  const selectAt = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const index = indexFromClientX(track, clientX, stops.length);
    onChange(stops[index].value);
  }, [onChange, stops]);

  const handleTrackDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setTrackDragging(true);
    selectAt(event.clientX);
  }, [selectAt]);

  const handleTrackMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (trackDragging) selectAt(event.clientX);
  }, [selectAt, trackDragging]);

  const handleTrackUp = useCallback(() => { setTrackDragging(false); }, []);

  const handlePillDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPillDragging(true);
    pillStartX.current = event.clientX;
    pillStartIndex.current = activeIndex;
  }, [activeIndex]);

  const handlePillMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pillDragging) return;
    const steps = Math.round((event.clientX - pillStartX.current) / PILL_STEP);
    const index = Math.max(0, Math.min(pillStartIndex.current + steps, stops.length - 1));
    if (stops[index].value !== value) onChange(stops[index].value);
  }, [onChange, pillDragging, stops, value]);

  const handlePillUp = useCallback(() => { setPillDragging(false); }, []);

  useEffect(() => {
    if (!trackDragging && !pillDragging) return;
    const stop = () => { setTrackDragging(false); setPillDragging(false); };
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, [trackDragging, pillDragging]);

  return (
    <div className="rl-slider">
      <div
        ref={trackRef}
        className="rl-slider-track"
        aria-disabled={disabled || undefined}
        style={{ width: TRACK_WIDTH }}
        onPointerDown={disabled ? undefined : handleTrackDown}
        onPointerMove={disabled ? undefined : handleTrackMove}
        onPointerUp={disabled ? undefined : handleTrackUp}
      >
        <div className={`rl-slider-bar${hasGradient ? ' is-gradient' : ''}`}>
          {trackGradient && <div className="rl-slider-gradient" style={{ background: trackGradient }} />}
          <div className="rl-slider-cells">
            {stops.map((stop, index) => (
              <div
                key={stop.value}
                className="rl-slider-cell"
                style={{ background: index === activeIndex ? stop.color : 'transparent' }}
              />
            ))}
          </div>
        </div>
        {stops.map((stop, index) => {
          const step = TRACK_WIDTH / stops.length;
          return (
            <div
              key={`dot-${stop.value}`}
              className="rl-slider-dot"
              style={{
                left: step * index + step / 2 - 1,
                background: stop.color,
                opacity: index === activeIndex ? 0.7 : 0.2,
              }}
            />
          );
        })}
      </div>
      <div
        className="rl-slider-pill"
        aria-disabled={disabled || undefined}
        onPointerDown={disabled ? undefined : handlePillDown}
        onPointerMove={disabled ? undefined : handlePillMove}
        onPointerUp={disabled ? undefined : handlePillUp}
      >
        <div className="rl-slider-pill-inner">
          <div className="rl-slider-icon">{icon}</div>
          <span className="rl-slider-value">{value}</span>
          {suffix && <span className="rl-slider-suffix">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}
