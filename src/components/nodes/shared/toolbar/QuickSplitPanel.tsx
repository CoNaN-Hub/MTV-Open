/**
 * QuickSplitPanel —— 官方「快速切分」的宫格选择面板
 * （TapNow EXE · `zoom-slider-3ZcFvYQO.js` @3080396 `htt`，逐字对齐）
 *
 * 官方源码（逐字要点）：
 *   const a = previewGrid ?? defaultGrid ?? { rows:1, cols:1 };
 *   const pick = g => { if (disabled || !isGridAllowed(g)) return; onSplit(g); onPreviewGridChange(null); onDone(); };
 *   <div className="w-[212px] rounded-2xl bg-[#2F2F2F] p-3
 *        shadow-[0px_8px_28px_rgba(0,0,0,0.26),inset_0px_0.5px_0px_rgba(255,255,255,0.16)]"
 *        onClick={e=>e.stopPropagation()} onMouseLeave={()=>onPreviewGridChange(null)}>
 *     <div className="grid grid-cols-8 gap-1">
 *       {rows 1..8 × cols 1..8}.map((m, g) => {
 *         const size = { rows:m, cols:g }, allowed = isGridAllowed(size);
 *         const highlighted = !!previewGrid && m <= previewGrid.rows && g <= previewGrid.cols;
 *         <button type="button" disabled={disabled || !allowed} aria-label={`${m}×${g}`}
 *           onMouseEnter={()=>{ allowed && onPreviewGridChange(size) }}
 *           onFocus={()=>{ allowed && onPreviewGridChange(size) }}
 *           onClick={()=>pick(size)}
 *           className={["size-5 rounded-[4px] border transition-colors",
 *             highlighted ? "border-white/55 bg-white/28" : "border-white/10 bg-white/[0.07] hover:border-white/30",
 *             disabled || !allowed ? "cursor-not-allowed opacity-30" : ""].join(" ")} />
 *       })}
 *     </div>
 *     <div className="mt-2 text-center text-sm font-normal tabular-nums text-white/80">{a.rows}×{a.cols}</div>
 *   </div>
 *   · 最大档位 `n1 = 8`（同文件常量区 @3079902：`dH="quick_split"` / `n1=8`）
 *   · 官方子操作（⋯ 行内 chips）= `2×2` / `3×3` / `4×4`，hover 时把 previewGrid 设成对应方阵
 *   · 注意：官方**没有**「自定义裁切」这一项（那是 MTV 自有功能 ⇒ 单独一行进 ⋯ 菜单）
 */
import { memo, useCallback, useMemo } from 'react';

/** 官方 `n1 = 8`：宫格面板最大 8×8 */
export const MAX_QUICK_SPLIT = 8;

export interface QuickSplitGrid {
  rows: number;
  cols: number;
}

interface QuickSplitPanelProps {
  /** 官方 `disabled`（= 节点不可编辑时整面板禁用） */
  disabled?: boolean;
  /** 官方 `previewGrid`（hover 单元格时的高亮区域；离开面板清空） */
  previewGrid: QuickSplitGrid | null;
  onPreviewGridChange: (grid: QuickSplitGrid | null) => void;
  /** 官方 `defaultGrid`：未 hover 时读数显示的默认档 */
  defaultGrid?: QuickSplitGrid;
  /** 官方 `isGridAllowed`：策略允许的宫格；MTV 无策略 ⇒ 默认全允许（官方无策略时也是 `true`） */
  isGridAllowed?: (grid: QuickSplitGrid) => boolean;
  /** 官方 `onSplit` + `onDone`（= 关闭 ⋯ 菜单） */
  onSplit: (grid: QuickSplitGrid) => void;
  onDone: () => void;
  className?: string;
}

function QuickSplitPanel({
  disabled = false,
  previewGrid,
  onPreviewGridChange,
  defaultGrid,
  isGridAllowed,
  onSplit,
  onDone,
  className,
}: QuickSplitPanelProps) {
  const allowed = useMemo(() => isGridAllowed ?? (() => true), [isGridAllowed]);
  /** 官方 `a = s ?? o ?? {rows:1, cols:1}` */
  const readout = previewGrid ?? defaultGrid ?? { rows: 1, cols: 1 };

  /** 官方 `c = d => { e || !i(d) || (t(d), r(null), n()); }` */
  const pick = useCallback((grid: QuickSplitGrid) => {
    if (disabled || !allowed(grid)) return;
    onSplit(grid);
    onPreviewGridChange(null);
    onDone();
  }, [allowed, disabled, onDone, onPreviewGridChange, onSplit]);

  return (
    <div
      className={`toolbar-quicksplit-panel nodrag${className ? ` ${className}` : ''}`}
      onClick={(event) => event.stopPropagation()}
      onMouseLeave={() => onPreviewGridChange(null)}
      data-testid="toolbar-quicksplit-panel"
    >
      <div className="toolbar-quicksplit-grid">
        {Array.from({ length: MAX_QUICK_SPLIT }).map((_, rowIndex) => (
          Array.from({ length: MAX_QUICK_SPLIT }).map((__, colIndex) => {
            const rows = rowIndex + 1;
            const cols = colIndex + 1;
            const grid = { rows, cols };
            const ok = allowed(grid);
            /* 官方 `y = !!s && m <= s.rows && g <= s.cols` —— 只有存在 previewGrid 时才高亮 */
            const highlighted = !!previewGrid && rows <= previewGrid.rows && cols <= previewGrid.cols;
            return (
              <button
                key={`${rows}-${cols}`}
                type="button"
                disabled={disabled || !ok}
                aria-label={`${rows}×${cols}`}
                title={`${rows}×${cols}`}
                onMouseEnter={() => { if (ok) onPreviewGridChange(grid); }}
                onFocus={() => { if (ok) onPreviewGridChange(grid); }}
                onClick={() => pick(grid)}
                className={`toolbar-quicksplit-cell${highlighted ? ' is-preview' : ''}`}
              />
            );
          })
        ))}
      </div>
      <div className="toolbar-quicksplit-readout">{readout.rows}×{readout.cols}</div>
    </div>
  );
}

export default memo(QuickSplitPanel);
