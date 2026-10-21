/**
 * PinCardBorder —— 官方 `Jke`（zoom-slider @1214248）逐字：
 *   const Jke = ({pinState}) => {
 *     const {isPinned, pins, primaryGroup} = pinState;
 *     const filtered = filteredGroupId();
 *     if (!isPinned || !primaryGroup) return null;
 *     const included = filtered !== null && pins.includes(filtered);
 *     const group = filtered ? groupById(filtered) : primaryGroup;   // ← 过滤中就用过滤色，否则用 primaryGroup
 *     const {hex} = group; const glow = rgba(hex, .6);
 *     return <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl z-[5]"
 *       style={{ border:`3px solid ${hex}`, boxShadow:`0 0 22px 0 ${glow}`, boxSizing:'border-box',
 *                opacity: included ? 1 : 0,
 *                transition:'opacity .3s ease, border-color .3s ease, box-shadow .3s ease' }} />;
 *   }
 * ★ 关键：**始终挂载**（只要 isPinned），仅靠 opacity 切换 ⇒ 0.3s 过渡才不会跳。
 */
import { memo } from 'react';
import { pinGroupById, primaryPinGroupId } from '../../../services/canvasPin';
import { useFilteredPinGroupId } from '../../../store/store.pin';

/** 官方 `tIe(hex, alpha)` */
function withAlpha(hex: string, alpha: number): string {
  const raw = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function PinCardBorder({ pins }: { pins: string[] }) {
  const filteredGroupId = useFilteredPinGroupId();
  const primaryGroupId = primaryPinGroupId(pins);
  if (pins.length === 0 || !primaryGroupId) return null;

  const included = filteredGroupId !== null && pins.includes(filteredGroupId);
  const group = (filteredGroupId ? pinGroupById(filteredGroupId) : undefined) ?? pinGroupById(primaryGroupId);
  if (!group) return null;

  return (
    <div
      aria-hidden="true"
      className="pin-card-border"
      style={{
        border: `3px solid ${group.hex}`,
        boxShadow: `0 0 22px 0 ${withAlpha(group.hex, 0.6)}`,
        opacity: included ? 1 : 0,
      }}
    />
  );
}

export default memo(PinCardBorder);
