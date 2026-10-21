/**
 * OfficialSlider —— 官方 Radix Slider 的**等价实现**（DOM 结构 / class / 内联 style / aria 逐字照官方）
 *
 * 官方在 MTV 需要复刻的两处用的是**同一个** slider 原语：
 *   · 展开弹窗「素材大小」：`mv`（= Radix Slider Root）
 *       `page-DVqoHdTT.js`@1608291 附近：
 *       `r.jsx(mv,{className:"w-32",min:zk,max:Bk,step:ub,value:[y],
 *                 onValueChange:([j])=>{…}, "aria-label":h("historyPanel.itemSize","Item size")})`
 *       （zk=80 / Bk=175 / ub=4）
 *   · 画布左下控制条「缩放」：`Pd`
 *       `page-DVqoHdTT.js`@1595xxx 附近（`pat` 里）：
 *       `l.jsx("div",{className:"flex w-[77px] items-center",children:l.jsx(Pd,{
 *          className:"w-full", color:"tap-blue", value:[d], min:c.min, max:c.max, step:.01,
 *          onValueChange:T=>b(T[0]), onValueCommit:…})})`
 *       ⇒ 实测 outerHTML（9444 真机）：
 *       `div.flex.w-[77px].items-center > span.group.relative.flex.touch-none.select-none.items-center
 *          [data-orientation=horizontal]:w-full … w-full[color=tap-blue]`
 *         > `span.relative.grow.overflow-hidden.rounded-full.bg-white/18…h-1.5`（**77×6**，`bg-white/18`）
 *         > `span.absolute.bg-white`（填充，白）
 *         > `span[style="transform: var(--radix-slider-thumb-transform); position: absolute;
 *                            left: calc(38.9487% + 1.76821px)"]`
 *            > `span[role=slider]…block.h-4.w-4.rounded-full.border-2.border-white.bg-white.shadow-md`
 *              （**16×16 白底 + 2px 白边**，`transition-transform ease-in-out group-hover:scale-110`）
 *
 * 官方把补间放在 CSS 上：
 *   · 轨道/填充/拇指几何靠内联 `left`/`right`/`calc()` 瞬跳（`transitionDuration: 0s`）
 *   · **只有拇指**有过渡：`transition-transform … ease-in-out`（实测 0.15s）+ `group-hover:scale-110`
 * 这里的指针拖动与方向键/Home/End 语义等价于 Radix Slider 的 `onValueChange`（step 同上）。
 */
import { useCallback, useRef, type CSSProperties } from 'react';

const THUMB_SIZE = 16; // 官方拇指 `h-4 w-4` = 16×16

export interface OfficialSliderProps {
  /** 当前值（受控） */
  value: number;
  /** 值变化（拖动 / 键盘），步进 = `step` */
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  /** 官方 Root 的额外 class（尺寸）：素材大小 = `w-32`，缩放 = `w-full` */
  className?: string;
  /** 官方 Root 的 `aria-label`：素材大小传「素材大小」；缩放官方**不传** */
  ariaLabel?: string;
  /** 官方缩放滑条的 `color="tap-blue"`（根节点上的非标准属性，逐字保留） */
  color?: string;
}

export default function OfficialSlider({
  value,
  onChange,
  min,
  max,
  step,
  className = '',
  ariaLabel,
  color,
}: OfficialSliderProps) {
  const trackRef = useRef<HTMLSpanElement | null>(null);
  const dragRef = useRef(false);
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  /* 官方 Radix 的拇指居中偏移：`calc(p% + (thumbSize/2 − p/100·thumbSize)px)`
     实测 38.9487% ⇒ 8 − 0.389487×16 = 1.76821px ✓ 逐字一致 */
  const thumbOffset = THUMB_SIZE / 2 - (percent / 100) * THUMB_SIZE;

  const valueFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return value;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const stepped = Math.round((min + ratio * (max - min) - min) / step) * step + min;
    return Math.min(max, Math.max(min, stepped));
  }, [max, min, step, value]);

  return (
    <span
      dir="ltr"
      data-orientation="horizontal"
      aria-disabled="false"
      aria-label={ariaLabel}
      color={color}
      className={`group relative flex touch-none select-none items-center data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:flex-col ${className}`}
      style={{ '--radix-slider-thumb-transform': 'translateX(-50%)' } as CSSProperties}
      onPointerDown={(event) => {
        dragRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        onChange(valueFromClientX(event.clientX));
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        onChange(valueFromClientX(event.clientX));
      }}
      onPointerUp={(event) => {
        dragRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => { dragRef.current = false; }}
    >
      <span
        ref={trackRef}
        data-orientation="horizontal"
        className="relative grow overflow-hidden rounded-full bg-white/[0.18] data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
      >
        <span
          data-orientation="horizontal"
          className="absolute bg-white data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          style={{ left: '0%', right: `${(100 - percent).toFixed(4)}%` }}
        />
      </span>
      <span
        style={{
          transform: 'var(--radix-slider-thumb-transform)',
          position: 'absolute',
          left: `calc(${percent.toFixed(4)}% + ${thumbOffset.toFixed(5)}px)`,
        }}
      >
        <span
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-orientation="horizontal"
          data-orientation="horizontal"
          tabIndex={0}
          className="block h-4 w-4 rounded-full border-2 border-white bg-white shadow-md transition-transform ease-in-out group-hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50"
          aria-valuenow={value}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault();
              onChange(Math.min(value + step, max));
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault();
              onChange(Math.max(value - step, min));
            } else if (event.key === 'Home') {
              event.preventDefault();
              onChange(min);
            } else if (event.key === 'End') {
              event.preventDefault();
              onChange(max);
            }
          }}
        />
      </span>
    </span>
  );
}
