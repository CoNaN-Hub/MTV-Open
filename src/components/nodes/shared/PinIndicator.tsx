/**
 * PinIndicator —— 官方 `Qke`（zoom-slider @1213314）逐字：
 *   variant="title"（卡片标题行内）：
 *     尺寸 = `filteredGroupId === null ? 0.8em : 1em`（随标题字号走）
 *     多色叠排：前一个也是选中色 → marginLeft 2px；否则 `-0.333em`
 *     无描边（`borderWidth: 0`）；当前过滤色加 `box-shadow: 0 0 0 0.083em rgba(255,255,255,.8)`
 *     非当前过滤色 → `filter: saturate(.35) brightness(.55)`
 *   variant="default"：尺寸 = 单色 18 / 多色 14，多色叠排 marginLeft -10px，1px 白描边
 */
import { memo } from 'react';
import { PIN_GROUPS } from '../../../services/canvasPin';

export interface PinIndicatorProps {
  pins: string[];
  variant?: 'title' | 'default';
  /** 当前按色组过滤的 id（官方 `filteredGroupId`；null = 未过滤） */
  filteredGroupId?: string | null;
  className?: string;
}

function PinIndicator({ pins, variant = 'title', filteredGroupId = null, className }: PinIndicatorProps) {
  const set = new Set(pins);
  const groups = PIN_GROUPS.filter((g) => set.has(g.id));
  if (groups.length === 0) return null;

  const isTitle = variant === 'title';
  /* 官方 `Qke` 用 `0.8em` / `1em`（em 基准 = 标题字号 12px）⇒ **换算成 px 定死**，
     不再依赖继承来的 em 基准（实测继承会变成 16px ✗）。过滤中 → 1em = 12px；多色叠排仍是 14px。 */
  const titleSize = filteredGroupId === null ? 9.6 : 12;
  const plainSize = groups.length === 1 ? 18 : 14;
  const size = isTitle ? titleSize : plainSize;

  return (
    <span
      aria-hidden="true"
      className={`pin-indicator inline-flex shrink-0 items-center${className ? ` ${className}` : ''}`}
    >
      {groups.map((group, index) => {
        const isFiltered = filteredGroupId === group.id;
        const dimmed = filteredGroupId !== null && !isFiltered;
        const prevIsGroup = filteredGroupId === groups[index - 1]?.id;
        let marginLeft: number | string = 0;
        if (index > 0) marginLeft = isTitle ? (isFiltered || prevIsGroup ? 2 : '-0.333em') : -10;
        return (
          <span
            key={group.id}
            className="pin-indicator-dot"
            style={{
              width: size,
              height: size,
              maxWidth: isTitle ? 45 : undefined,
              maxHeight: isTitle ? 45 : undefined,
              backgroundColor: group.hex,
              borderWidth: isTitle ? 0 : 1,
              marginLeft,
              zIndex: isFiltered ? groups.length + 1 : index + 1,
              filter: dimmed ? 'saturate(0.35) brightness(0.55)' : 'saturate(1) brightness(1)',
              boxShadow: isTitle ? (isFiltered ? '0 0 0 1px rgba(255, 255, 255, 0.8)' : '0 0 0 0 transparent') : undefined,
            }}
          />
        );
      })}
    </span>
  );
}

export default memo(PinIndicator);
