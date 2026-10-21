/**
 * PinToolbarButton —— 官方 `lIe` + `iIe` + `rIe`（zoom-slider @1220984 / @1218276 / @1216596）逐字落地：
 *
 *   官方按钮 = `tc`(obsidian, size:"md", className:"aspect-square rounded-full p-0")
 *              ⇒ 40px 圆形（MTV 复用 `.ftb-btn`，hover 高光是官方那两层）
 *   官方舞台 = `pin-toolbar-motion-stage pointer-events-none relative inline-grid size-[26px]
 *               shrink-0 select-none place-items-center`
 *              + 已 Pin 时 `translate-x-px translate-y-px`；hover/弹层打开时 `-translate-x-px -translate-y-px`
 *   官方图钉 = **Tabler `outline/tag` 18px/stroke 2**（`pin.svg`）+ `text-white
 *              drop-shadow-[0_1px_2px_rgba(0,0,0,0.72)]`；hover 时 `-rotate-[5deg]`
 *   官方色点 = 最多 6 个 `absolute top-[5px] right-[5px] size-1.5 rounded-full`，
 *              位移来自 `_B(i,count,3,-1)`（hover `4.2,-3`）；未选 `scale-75 opacity-0`、已选 `scale-100 opacity-100`
 *   官方弹层 = Radix popover `side=top align=center sideOffset=8`，
 *              容器 `flex items-center gap-1 rounded-full border bg-popover p-2 shadow-md`
 *              内含 6 个色点开关 `nIe`（size-6 圆钮 + 18px 圆点，选中加白描边 + 12px 对勾）
 *   官方气泡 = `canvas.pin.toolbar.tooltip`（= "Pin"）/ 已选 →「已 Pin：红、蓝」
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../../i18n';
import { OfficialIcon } from '../../../sidebar/OfficialIcon';
import { PIN_GROUPS, pinDotOffset, pinTooltip } from '../../../../services/canvasPin';

export interface PinToolbarButtonProps {
  /** 该节点当前的 `data.color_pins` */
  pins: string[];
  disabled?: boolean;
  onToggle: (groupId: string) => void;
}

function PinToolbarButton({ pins, disabled = false, onToggle }: PinToolbarButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => new Set(pins), [pins]);
  const activeGroups = useMemo(() => PIN_GROUPS.filter((g) => selected.has(g.id)), [selected]);
  const tooltip = pinTooltip(pins, t as unknown as (k: string, o?: Record<string, unknown>) => string);

  // 点击外部 / Esc 关闭（官方是 Radix popover 的默认行为）
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setOpen((v) => !v);
  }, [disabled]);

  return (
    <div ref={wrapRef} className="pin-wrap nodrag">
      <button
        type="button"
        className={`ftb-btn icon-only act-pin pin-trigger${open ? ' is-active' : ''}`}
        /* 官方：Radix Tooltip 内容 = `canvas.pin.toolbar.tooltip`（"Pin"）/「已 Pin：{{colors}}」 */
        data-tooltip={tooltip}
        data-tooltip-pos="top"
        aria-label={tooltip}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        data-pin-popover-open={open ? 'true' : undefined}
        onClick={handleClick}
      >
        <span className="sr-only">{tooltip}</span>
        <span
          className={`pin-stage${pins.length > 0 ? ' is-pinned' : ''}${open ? ' is-open' : ''}`}
          aria-hidden="true"
        >
          {/* 官方色点：位置由 `_B(index, count, 3, -1)` 给，写进 CSS 变量 */}
          {PIN_GROUPS.map((group) => {
            const index = activeGroups.findIndex((g) => g.id === group.id);
            const isOn = index >= 0;
            const at = isOn ? pinDotOffset(index, activeGroups.length, 3, -1) : { x: 0, y: 0 };
            const hover = isOn ? pinDotOffset(index, activeGroups.length, 4.2, -3) : { x: 0, y: 0 };
            return (
              <span
                key={group.id}
                className={`pin-dot${isOn ? ' is-on' : ''}`}
                style={{
                  '--pin-dot-x': `${at.x}px`,
                  '--pin-dot-y': `${at.y}px`,
                  '--pin-dot-hover-x': `${hover.x}px`,
                  '--pin-dot-hover-y': `${hover.y}px`,
                  backgroundColor: group.hex,
                } as React.CSSProperties}
              />
            );
          })}
          <OfficialIcon name="pin" size={18} className="pin-glyph" />
        </span>
      </button>

      {open && (
        <div
          className="pin-popover nodrag"
          role="dialog"
          aria-label={t('Pin')}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {PIN_GROUPS.map((group) => {
            const isOn = selected.has(group.id);
            return (
              <button
                key={group.id}
                type="button"
                className="pin-swatch"
                aria-pressed={isOn}
                aria-label={t(group.label)}
                data-tooltip={t(group.label)}
                data-tooltip-pos="top"
                onClick={() => onToggle(group.id)}
              >
                <span className={`pin-swatch-dot${isOn ? ' is-on' : ''}`} style={{ backgroundColor: group.hex }}>
                  {isOn && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" className="text-black" stroke="#000" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(PinToolbarButton);
