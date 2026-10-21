/**
 * settings/UsageDashboard —— 官方「权益和账单 → 用量看板」的 MTV 逐字复刻。
 *
 * ## 产物级取证（**类名/尺寸/圆角/颜色逐字来自官方构建产物**，注释带文件+偏移）
 *
 * 文件：`D:\DEEPSEEK\live-assets-r127\index-CsQaPZ-H.js`（当前官方构建，1759042 字节）
 * i18n（中文原文）：`billingModule.tapiesUsage.*` @702023-702520
 *
 * | 元素 | 官方偏移 | 官方 class 串（逐字） |
 * |---|---|---|
 * | 容器 | @1186141 | `Bt` 基类 `mx-auto w-full max-w-7xl px-6 py-6 sm:px-8 sm:py-8` + 实参 `max-w-5xl space-y-7 pt-8`（`C`=tw-merge）|
 * | 头像 | @1164062 `JF.lg` + @1164245 | `w-12 h-12` / `text-lg` / `rounded-[10px]`，实参再给 `size-12 rounded-[10px] text-lg`；基类 `flex items-center justify-center text-white font-semibold uppercase flex-shrink-0` |
 * | 头像底色 | @1163807 `QF` | `["bg-[#9E835F]","bg-[#5F899E]","bg-[#5F9E87]","bg-[#62637B]","bg-[#262626]"]`，下标 = `|Σ charCodeAt + ((n<<5)-n)| % 5`；首字母 `name.trim().charAt(0)||"T"` |
 * | 标题 | @1186215 | `mt-4 text-2xl font-semibold tracking-normal text-foreground/90` |
 * | 副标题 | @1186237 | `mt-2 text-sm text-muted-foreground`，内容 `{团队} · {最近 365 天}` |
 * | 两个 Tab 外框 | @1186262 | `mt-4 flex w-fit rounded-lg border border-border bg-card/70 p-1` |
 * | 分段按钮 | @1170430 `ni` | `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors` + 选中 `bg-muted text-foreground shadow-sm` / 未选 `text-muted-foreground hover:bg-muted/60 hover:text-foreground` |
 * | 5 KPI 网格 | @1169766 `T5` | `grid overflow-hidden rounded-lg border border-border bg-card/55 sm:grid-cols-2 lg:grid-cols-5` |
 * | KPI 单元格 | @1169811 | `min-w-0 border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-5` |
 * | KPI 数字 | @1170020 | `truncate text-2xl font-semibold leading-8 text-foreground` |
 * | KPI 标签 | @1170100 | `mt-1 truncate text-xs leading-5 text-muted-foreground` |
 * | 活动面板 | @1186980 | `rounded-xl border border-border bg-card/55` |
 * | 活动面板头 | @1187000 | `flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between` + `h3.text-base font-semibold text-foreground` |
 * | 视图切换外框 | @1187060 | `flex w-fit rounded-lg bg-background/80 p-1` |
 * | 图表区 | @1187160 | `relative min-h-[156px] px-4 pt-4 pb-3`（内层 `tapies-activity-chart`）|
 * | 热力图外框 | @1170553 `C5` | `space-y-2`；网格 `grid gap-1` + `gridTemplateColumns:repeat(n,minmax(0,1fr))` |
 * | 热力图每列 | @1170700 | `grid min-w-0 grid-rows-7 gap-1` |
 * | 热力图格子 | @1170900 | `relative aspect-square rounded-[3px] transition-colors`；窗口外 `aspect-square`；悬停 `z-10 bg-[color-mix(in_srgb,var(--primary)_58%,white_42%)]` |
 * | 强度色阶 | @1166678 `s5` | `["bg-muted/25","bg-primary/20","bg-primary/35","bg-primary/55","bg-[color-mix(in_srgb,var(--primary)_82%,white_18%)]","bg-[color-mix(in_srgb,var(--primary)_64%,white_36%)]"]` |
 * | 月份刻度 | @1171030 | `relative h-4 text-[11px] font-medium leading-4 text-muted-foreground`，刻度 `absolute top-0 whitespace-nowrap`，`left = col/(n-1)*100%` |
 * | 悬浮提示 | @1169495 `wc` | `pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-3 py-2 text-xs font-semibold leading-4 text-popover-foreground shadow-lg` |
 * | 每周视图 | @1171665 `S5` | 每列 `relative grid min-w-0 grid-rows-7 gap-1 rounded-[5px]`，柱 `pointer-events-none absolute inset-x-0 bottom-0 rounded-[3px]`，高 `max(v/max*100,3)%` |
 * | 累计视图 | @1173182 `k5` | `svg viewBox="0 0 100 100"` + `preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible"` |
 * | 状态覆盖层 | @1176480 | `absolute inset-0 z-20 flex items-center justify-center rounded-b-xl bg-card/70 text-xs text-muted-foreground backdrop-blur-[1px]` |
 * | 关键帧 | @1168670 `w5` | 见 `OFFICIAL_KEYFRAMES` |
 *
 * 常量（逐字）：`ja=7`（每列 7 天）@1166560 / `ou=4`（gap）/@1166570 /
 * `uo=112`（图最小高）/`r5=.95`（强度上限取 95 分位）/`l5=640`（格子动画 ms）/
 * `d5=26`（每格延迟）/`u5=1300`（延迟上限）/`m5=1600`（累计线揭示 ms）/`us=8`、`mo=94`（趋势图上下边距）。
 *
 * ## 数据诚实性
 * 5 个 KPI 与热力图的算法见 `services/usage/tapiesUsage.ts`（官方口径已用真机 API 反推确认）。
 * MTV 没有服务端 Tapies：**总用量**用本机输出历史 + 连接价目表折积分；**Agent 用量**本地
 * **没有任何字段**可归因 ⇒ `NOT_FOUND`，走官方「暂无用量数据」态，不编数。
 * **「赠送Tapies权益」块官方有、但用户明确要求不做**（`billingModule.tapiesUsage.giftedAgentTapies`）。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { getLocale, useT, type Locale } from '../../i18n';
import {
  EMPTY_USAGE_SUMMARY,
  HEATMAP_PERCENTILE,
  computeLocalAgentUsage,
  computeLocalTapiesUsage,
  type TapiesUsagePoint,
  type TapiesUsageScope,
  type TapiesUsageSummary,
} from '../../services/usage/tapiesUsage';

/* ───────────── 官方常量（逐字，见文件头偏移表） ───────────── */
/** 官方 @1166560 `ja=7`：热力图每列 7 天 */
const DAYS_PER_COLUMN = 7;
/** 官方 @1166570 `ou=4`：格子间距（px），也用于列宽反推 */
const CELL_GAP = 4;
/** 官方 @1166580 `uo=112`：图表最小高度 */
const MIN_CHART_HEIGHT = 112;
/** 官方 @1166590 `r5=.95`：色阶上限取 95 分位 */
const MAX_VALUE_PERCENTILE = HEATMAP_PERCENTILE;
/** 官方 @1166680 `s5`：6 档强度色（0 档 = 有数据但金额为 0） */
const LEVEL_CLASSES = [
  'bg-muted/25',
  'bg-primary/20',
  'bg-primary/35',
  'bg-primary/55',
  'bg-[color-mix(in_srgb,var(--primary)_82%,white_18%)]',
  'bg-[color-mix(in_srgb,var(--primary)_64%,white_36%)]',
];
/** 官方 @1166788 `l5=640` */
const CELL_ANIMATION_MS = 640;
/** 官方 @1166789 `d5=26` */
const CELL_STAGGER_MS = 26;
/** 官方 @1166790 `u5=1300` */
const CELL_STAGGER_CAP_MS = 1300;
/** 官方 @1166791 `m5=1600` */
const TREND_REVEAL_MS = 1600;
/** 官方 @1166792 `us=8` / @1166793 `mo=94`：累计趋势图的上下基线 */
const TREND_TOP = 8;
const TREND_BOTTOM = 94;

/** 官方 @1168670 `w5`：`<style>` 注入的 6 条关键帧（逐字） */
const OFFICIAL_KEYFRAMES = `
  @keyframes tapies-chart-in {
    from { opacity: 0.72; }
    to { opacity: 1; }
  }

  @keyframes tapies-grid-cell-in {
    from { opacity: 0.34; filter: brightness(0.58); }
    to { opacity: 1; filter: brightness(1); }
  }

  @keyframes tapies-trend-reveal-in {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }

  .tapies-activity-chart {
    animation: tapies-chart-in 440ms ease-out both;
  }

  .tapies-trend-base-area {
    opacity: 0.32;
  }

  .tapies-trend-base-line {
    opacity: 0.42;
  }

  .tapies-trend-reveal {
    animation: tapies-trend-reveal-in ${TREND_REVEAL_MS}ms ease-out both;
    transform-box: fill-box;
    transform-origin: left center;
  }
`;

/* ───────────── 官方纯函数（逐字搬运，含偏移） ───────────── */

/** 官方 @1168150 `Za`：`maximumFractionDigits:1`，≥1e4 走 compact。 */
const formatAmount = (value: number, locale: string): string => new Intl.NumberFormat(locale, {
  maximumFractionDigits: 1,
  notation: value >= 1e4 ? 'compact' : 'standard',
}).format(value);

/** 官方 @1168185 `Li`：`{month:'short',day:'numeric'}`（悬停提示用）。 */
const formatDayLabel = (date: Date, locale: string): string => new Intl.DateTimeFormat(locale, {
  month: 'short',
  day: 'numeric',
}).format(date);

interface UsageCell {
  date: Date;
  key: string;
  point?: TapiesUsagePoint;
  inRange: boolean;
}

/** 官方 @1167631 `f5`：把稠密日序列铺成 `列[7天]`，前后**居中**补空位。 */
const toColumns = (points: TapiesUsagePoint[]): UsageCell[][] => {
  if (points.length === 0) return [];
  const columnCount = Math.ceil(points.length / DAYS_PER_COLUMN);
  const slots = columnCount * DAYS_PER_COLUMN;
  const offset = Math.floor((slots - points.length) / 2);
  return Array.from({ length: columnCount }, (_, columnIndex) => Array.from({ length: DAYS_PER_COLUMN }, (_, rowIndex) => {
    const slot = columnIndex * DAYS_PER_COLUMN + rowIndex;
    const sourceIndex = slot - offset;
    const point = points[sourceIndex];
    const fallbackDate = new Date(points[0].date);
    fallbackDate.setDate(fallbackDate.getDate() + slot);
    return {
      date: point?.date ?? fallbackDate,
      key: point?.key ?? `padding-${slot}`,
      point,
      inRange: !!point,
    };
  }));
};

/** 官方 @1167914 `b5`：`max(1, min(5, ceil(amount/max*5)))`。 */
const levelOf = (amount: number, maxValue: number): number => (!amount || !maxValue
  ? 0
  : Math.max(1, Math.min(5, Math.ceil((amount / maxValue) * 5))));

/** 官方 @1167974 `v5`：色阶上限 = 正数序列的 **95 分位**（无正数 ⇒ 0）。 */
const percentileValue = (values: number[], percentile: number): number => {
  const positives = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (positives.length === 0) return 0;
  const index = Math.min(positives.length - 1, Math.max(0, Math.ceil(positives.length * percentile) - 1));
  return positives[index];
};

/** 官方 @1168150 `x5`：每周视图的数据 = 每列（7 天）求和。 */
const weeklyTotals = (columns: UsageCell[][]): number[] => columns
  .map((column) => column.reduce((sum, cell) => sum + (cell.point?.amount ?? 0), 0));

/** 官方 @1168208 `y5`：累计视图 = 每周值的累加。 */
const cumulativeTotals = (values: number[]): number[] => {
  let running = 0;
  return values.map((value) => {
    running += value;
    return running;
  });
};

/** 官方 @1168250 `yc` `Lc`：月份刻度 —— 每列里第一个「日期 ≤ 7」的在窗口内格子 ⇒ 该月一个刻度。 */
const monthTicks = (columns: UsageCell[][], locale: string) => {
  let lastBucket = '';
  return columns.flatMap((column, index) => {
    const anchor = column.find((cell) => cell.inRange && cell.date.getDate() <= DAYS_PER_COLUMN);
    if (!anchor) return [];
    const bucket = `${anchor.date.getFullYear()}-${anchor.date.getMonth()}`;
    if (bucket === lastBucket) return [];
    lastBucket = bucket;
    return [{
      key: bucket,
      label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(anchor.date),
      left: `${(index / Math.max(columns.length - 1, 1)) * 100}%`,
    }];
  });
};

/** 官方 @1168555 `tl` `cl`：格子入场动画（RTL 时按列反向，延迟封顶 1300ms）。 */
const cellAnimation = (columnIndex: number, _rowIndex: number, columnCount: number, direction: 'ltr' | 'rtl'): CSSProperties => {
  const order = direction === 'rtl' ? Math.max(columnCount - 1 - columnIndex, 0) : columnIndex;
  return {
    animation: `tapies-grid-cell-in ${CELL_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
    animationDelay: `${Math.min(order * CELL_STAGGER_MS, CELL_STAGGER_CAP_MS)}ms`,
  };
};

/* ───────────── 官方子组件（逐字类名） ───────────── */

/** 官方 @1170430 `ni`：分段按钮 */
function SegmentedButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
        active ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/** 官方 @1169495 `wc`：热力图/趋势图共用的悬浮提示 */
function UsageTooltip({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-3 py-2 text-xs font-semibold leading-4 text-popover-foreground shadow-lg">
      {children}
    </div>
  );
}

/** 官方 @1169766 `T5`：5 个 KPI 卡 */
function UsageMetricGrid({ metrics }: { metrics: { label: string; value: string }[] }) {
  return (
    <div className="grid overflow-hidden rounded-lg border border-border bg-card/55 sm:grid-cols-2 lg:grid-cols-5">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="min-w-0 border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-5"
        >
          <div className="truncate text-2xl font-semibold leading-8 text-foreground">{metric.value}</div>
          <div className="mt-1 truncate text-xs leading-5 text-muted-foreground">{metric.label}</div>
        </div>
      ))}
    </div>
  );
}

/** 官方 @1170553 `C5`「每日」：GitHub 风格 365 天热力图 */
function DailyHeatmap({ animationDirection, columns, maxValue, locale }: {
  animationDirection: 'ltr' | 'rtl';
  columns: UsageCell[][];
  maxValue: number;
  locale: string;
}) {
  const ticks = monthTicks(columns, locale);
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column, columnIndex) => (
          <div key={column[0]?.key ?? columnIndex} className="grid min-w-0 grid-rows-7 gap-1">
            {column.map((cell, rowIndex) => {
              if (!cell.inRange) {
                return <div key={cell.key} className="aspect-square" aria-hidden="true" />;
              }
              const level = levelOf(cell.point?.amount ?? 0, maxValue);
              const tooltipText = `${formatDayLabel(cell.date, locale)} · ${formatAmount(cell.point?.amount ?? 0, locale)}`;
              const isHovered = hovered === cell.key;
              return (
                <div
                  key={cell.key}
                  onMouseEnter={() => setHovered(cell.key)}
                  onMouseLeave={() => setHovered(null)}
                  className={[
                    'relative aspect-square rounded-[3px] transition-colors',
                    isHovered
                      ? 'z-10 bg-[color-mix(in_srgb,var(--primary)_58%,white_42%)]'
                      : cell.point ? LEVEL_CLASSES[level] : 'bg-muted/15 opacity-60',
                  ].join(' ')}
                  style={cellAnimation(columnIndex, rowIndex, columns.length, animationDirection)}
                >
                  {isHovered && <UsageTooltip>{tooltipText}</UsageTooltip>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="relative h-4 text-[11px] font-medium leading-4 text-muted-foreground" aria-hidden="true">
        {ticks.map((tick) => (
          <div key={tick.key} className="absolute top-0 whitespace-nowrap" style={{ left: tick.left }}>{tick.label}</div>
        ))}
      </div>
    </div>
  );
}

/** 官方 @1171665 `S5`「每周」：每列一根柱（高度 = 该周总量 / 最大值） */
function WeeklyBars({ animationDirection, columns, values, locale }: {
  animationDirection: 'ltr' | 'rtl';
  columns: UsageCell[][];
  values: number[];
  locale: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxValue = Math.max(...values, 1);
  const ticks = monthTicks(columns, locale);
  return (
    <div className="space-y-2">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column, columnIndex) => {
          const value = values[columnIndex] ?? 0;
          const height = value > 0 ? `${Math.max((value / maxValue) * 100, 3)}%` : '0%';
          const inRange = column.filter((cell) => cell.inRange);
          const first = inRange[0]?.date;
          const last = inRange[inRange.length - 1]?.date;
          const isHovered = hovered === columnIndex;
          const tooltipText = first && last
            ? `${formatDayLabel(first, locale)} - ${formatDayLabel(last, locale)} · ${formatAmount(value, locale)}`
            : undefined;
          return (
            <div
              key={column[0]?.key ?? columnIndex}
              onMouseEnter={() => setHovered(columnIndex)}
              onMouseLeave={() => setHovered(null)}
              className="relative grid min-w-0 grid-rows-7 gap-1 rounded-[5px]"
            >
              {tooltipText && isHovered && <UsageTooltip>{tooltipText}</UsageTooltip>}
              {Array.from({ length: DAYS_PER_COLUMN }, (_, rowIndex) => {
                const cell = column[rowIndex];
                return (
                  <div
                    key={`${columnIndex}-${rowIndex}`}
                    className={[
                      'aspect-square rounded-[3px] transition-colors',
                      isHovered ? 'bg-primary/20' : 'bg-muted/25',
                    ].join(' ')}
                    style={cellAnimation(columnIndex, rowIndex, columns.length, animationDirection)}
                    aria-hidden={cell?.inRange ? undefined : true}
                  />
                );
              })}
              <div
                className={[
                  'pointer-events-none absolute inset-x-0 bottom-0 rounded-[3px] transition-[height,background-color,box-shadow]',
                  isHovered
                    ? 'bg-[color-mix(in_srgb,var(--primary)_58%,white_42%)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_42%,transparent)]'
                    : 'bg-[color-mix(in_srgb,var(--primary)_72%,white_28%)]',
                ].join(' ')}
                style={{ height, ...cellAnimation(columnIndex, 0, columns.length, animationDirection) }}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
      <div className="relative h-4 text-[11px] font-medium leading-4 text-muted-foreground" aria-hidden="true">
        {ticks.map((tick) => (
          <div key={tick.key} className="absolute top-0 whitespace-nowrap" style={{ left: tick.left }}>{tick.label}</div>
        ))}
      </div>
    </div>
  );
}

/** 官方 @1173182 `k5`「累计」：手绘 SVG 折线 + 面积（含揭示裁剪动画与悬停十字线） */
function CumulativeTrend({ animationDirection, columns, cumulativeValues, weeklyValues, locale }: {
  animationDirection: 'ltr' | 'rtl';
  columns: UsageCell[][];
  cumulativeValues: number[];
  weeklyValues: number[];
  locale: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const ticks = monthTicks(columns, locale);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(MIN_CHART_HEIGHT);

  /* 官方 @1166800 `g5` `V5`：图高随列数/容器宽自适应，下限 112px */
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      if (columns.length <= 1) {
        setHeight((prev) => (prev === MIN_CHART_HEIGHT ? prev : MIN_CHART_HEIGHT));
        return;
      }
      const count = Math.max(columns.length, 1);
      const available = element.clientWidth - (count - 1) * CELL_GAP;
      const cellWidth = Math.max(0, available / count);
      const next = Math.max(
        MIN_CHART_HEIGHT,
        Math.round(cellWidth * DAYS_PER_COLUMN + (DAYS_PER_COLUMN - 1) * CELL_GAP),
      );
      setHeight((prev) => (prev === next ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, [columns.length]);

  const maxValue = Math.max(...cumulativeValues, 1);
  const span = TREND_BOTTOM - TREND_TOP;
  const nodes = cumulativeValues.map((value, index) => {
    const x = cumulativeValues.length === 1 ? 50 : (index / Math.max(cumulativeValues.length - 1, 1)) * 100;
    const y = TREND_TOP + (1 - value / maxValue) * span;
    const column = columns[index] ?? [];
    const inRange = column.filter((cell) => cell.inRange);
    const first = inRange[0]?.date;
    const last = inRange[inRange.length - 1]?.date;
    const weekly = weeklyValues[index] ?? 0;
    return {
      key: column[0]?.key ?? `trend-${index}`,
      tooltip: first && last
        ? `${formatDayLabel(first, locale)} - ${formatDayLabel(last, locale)} · ${formatAmount(value, locale)} · +${formatAmount(weekly, locale)}`
        : undefined,
      x,
      y,
    };
  });
  const line = nodes.map((node, index) => `${index === 0 ? 'M' : 'L'} ${node.x} ${node.y}`).join(' ');
  const area = nodes.length
    ? `M ${nodes[0].x} ${TREND_BOTTOM} ${nodes.map((node) => `L ${node.x} ${node.y}`).join(' ')} L ${nodes[nodes.length - 1].x} ${TREND_BOTTOM} Z`
    : '';
  const active = hovered === null ? null : nodes[hovered];

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="relative overflow-visible" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
          <defs>
            <clipPath id="tapies-trend-reveal">
              <rect
                className="tapies-trend-reveal"
                x="0"
                y="0"
                height="100"
                width="100"
                style={{ transformOrigin: animationDirection === 'rtl' ? 'right center' : 'left center' }}
              />
            </clipPath>
          </defs>
          {[TREND_TOP, 28, 48, 68, TREND_BOTTOM].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} className="stroke-border" opacity="0.34" vectorEffect="non-scaling-stroke" />
          ))}
          {area && <path d={area} className="tapies-trend-base-area" fill="color-mix(in srgb, var(--primary) 18%, transparent)" />}
          {line && (
            <path
              d={line}
              className="tapies-trend-base-line"
              fill="none"
              stroke="color-mix(in srgb, var(--primary) 58%, white 8%)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <g clipPath="url(#tapies-trend-reveal)">
            {area && <path d={area} className="tapies-trend-area" fill="color-mix(in srgb, var(--primary) 26%, transparent)" />}
            {line && (
              <path
                d={line}
                className="tapies-trend-line"
                fill="none"
                stroke="color-mix(in srgb, var(--primary) 70%, white 30%)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        </svg>
        {active && (
          <>
            <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary/35" style={{ left: `${active.x}%` }} />
            <div
              className="pointer-events-none absolute z-20 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--primary)_58%,white_42%)] ring-2 ring-background"
              style={{ left: `${active.x}%`, top: `${active.y}%` }}
            >
              {active.tooltip && <UsageTooltip>{active.tooltip}</UsageTooltip>}
            </div>
          </>
        )}
        <div className="absolute inset-0 z-10 grid" style={{ gridTemplateColumns: `repeat(${Math.max(nodes.length, 1)}, minmax(0, 1fr))` }}>
          {nodes.map((node, index) => (
            <div key={node.key} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} />
          ))}
        </div>
      </div>
      <div className="relative h-4 text-[11px] font-medium leading-4 text-muted-foreground" aria-hidden="true">
        {ticks.map((tick) => (
          <div key={tick.key} className="absolute top-0 whitespace-nowrap" style={{ left: tick.left }}>{tick.label}</div>
        ))}
      </div>
    </div>
  );
}

/** 官方 @1176480 `bt`：加载 / 失败 / 空 三态覆盖层 */
function UsageStates({ hasError, isEmpty, loading, onRetry }: {
  hasError: boolean;
  isEmpty: boolean;
  loading: boolean;
  onRetry: () => void;
}) {
  const t = useT();
  if (!loading && !hasError && !isEmpty) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-b-xl bg-card/70 text-xs text-muted-foreground backdrop-blur-[1px]">
      {hasError ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-sm">
          <span>{t('加载失败')}</span>
          <button type="button" onClick={onRetry} className="font-semibold text-primary hover:text-primary/80">
            {t('重试')}
          </button>
        </div>
      ) : loading ? (
        <span className="font-medium text-muted-foreground">{t('加载中...')}</span>
      ) : (
        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-sm">
          {t('暂无用量数据')}
        </div>
      )}
    </div>
  );
}

/** 官方 @1164245 `Xa`：方形头像块（官方 5 色哈希底色 / 有头像 URL 时走 `img`） */
function UsageAvatar({ name, avatarUrl }: { name: string; avatarUrl: string }) {
  const palette = ['bg-[#9E835F]', 'bg-[#5F899E]', 'bg-[#5F9E87]', 'bg-[#62637B]', 'bg-[#262626]'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = palette[Math.abs(hash) % palette.length];
  const initial = name.trim().charAt(0) || 'T';
  /* 官方 @1164062 `JF.lg` = `w-12 h-12` + `text-lg` + `rounded-[10px]`，实参再给一遍
     `size-12 rounded-[10px] text-lg`（tw-merge 后等价于此处的合并结果）。 */
  const base = 'size-12 rounded-[10px] text-lg flex-shrink-0 flex items-center justify-center text-white font-semibold uppercase';
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" draggable={false} className={`${base} object-cover`} />;
  }
  return <div className={`${color} ${base}`}>{initial}</div>;
}

/* ───────────── 主组件 ───────────── */

export default function UsageDashboard() {
  const t = useT();
  const locale: Locale = getLocale();
  const records = useAppStore((state) => state.outputHistoryRecords);
  const providers = useAppStore((state) => state.config.providers);
  const generalModels = useAppStore((state) => state.config.generalModels);

  const [scope, setScope] = useState<TapiesUsageScope>('total');
  const [view, setView] = useState<'daily' | 'weekly' | 'cumulative'>('daily');
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');

  const [local, setLocal] = useState<{ points: TapiesUsagePoint[]; summary: TapiesUsageSummary; unknownCount: number }>({
    points: [],
    summary: { ...EMPTY_USAGE_SUMMARY },
    unknownCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  /** 官方 `E5`（@1165962）在本机对应的取数：输出历史 + 连接价目表 → 每日积分 */
  const reload = useCallback(async () => {
    try {
      const next = await computeLocalTapiesUsage(records, { providers, generalModels });
      setLocal(next);
      setHasError(false);
      setLoading(false);
    } catch {
      setHasError(true);
      setLoading(false);
    }
  }, [records, providers, generalModels]);

  useEffect(() => {
    let cancelled = false;
    /* ⚠️ `react-hooks/set-state-in-effect` 不许在 effect 体里同步 setState ⇒ 全部放进异步函数 */
    void (async () => {
      if (cancelled) return;
      setLoading(true);
      setHasError(false);
      await reload();
    })();
    return () => { cancelled = true; };
  }, [reload]);

  /* 官方 `co={agent:1,total:0}` / `iu={cumulative:2,daily:0,weekly:1}`：切 scope/view 时按序号决定滑动方向 */
  const scopeOrder: Record<TapiesUsageScope, number> = { total: 0, agent: 1 };
  const viewOrder: Record<'daily' | 'weekly' | 'cumulative', number> = { daily: 0, weekly: 1, cumulative: 2 };

  /**
   * ★ Agent 用量 = **MTV 口径（官方 NOT FOUND）**：官方 `usageSubject=agent` 是服务端按
   * Agent 归因的 **Tapies**；该归因/计费规则在产物与接口里都拿不到。MTV 改用本机**真实**
   * 的 Agent 运行记录 `store.agentTasks[].events[]` 里 `model_round_end` 的
   * `inputTokens + outputTokens`（`src/types/agent.ts`@127-164）按天分桶 ⇒ 同一套 5 KPI
   * 与热力图，**单位是 token 不是 Tapies**，所以下面两张带 Tapies 字样的标签要换成 token 版，
   * 其余 3 张（单日峰值 / 活跃天数 / 最长连续活跃天数）与官方逐字相同、且与单位无关。
   */
  const agentTasks = useAppStore((state) => state.agentTasks);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const loadAgentTasksForProject = useAppStore((state) => state.loadAgentTasksForProject);
  const agentUsage = useMemo(() => computeLocalAgentUsage(agentTasks), [agentTasks]);

  /* Agent 任务表在内存里可能是空的（还没为当前项目 hydrate 过）⇒ 切到 Agent tab 时按需拉一次。
     只读加载，不改任何用户数据；`loadAgentTasksForProject` 是 store 里的既有动作。 */
  useEffect(() => {
    if (scope !== 'agent' || agentTasks.length > 0 || !currentProjectId) return;
    void loadAgentTasksForProject(currentProjectId).catch(() => {});
  }, [scope, agentTasks.length, currentProjectId, loadAgentTasksForProject]);

  const points = useMemo(() => (scope === 'agent' ? agentUsage.points : local.points), [scope, agentUsage.points, local.points]);
  const summary = useMemo(
    () => (scope === 'agent' ? agentUsage.summary : local.summary),
    [scope, agentUsage.summary, local.summary],
  );
  const isEmpty = points.length === 0;

  const columns = useMemo(() => toColumns(points), [points]);
  const maxValue = useMemo(() => percentileValue(points.map((point) => point.amount), MAX_VALUE_PERCENTILE), [points]);
  const weekly = useMemo(() => weeklyTotals(columns), [columns]);
  const cumulative = useMemo(() => cumulativeTotals(weekly), [weekly]);

  const metrics = [
    {
      /* 官方 `billingModule.tapiesUsage.metrics.totalUsed` = 「总消耗 Tapies」 */
      label: scope === 'agent' ? t('总消耗 token') : t('总消耗 Tapies'),
      value: formatAmount(summary.totalAmount, locale),
    },
    { label: t('单日峰值'), value: formatAmount(summary.peakDailyAmount, locale) },
    {
      label: scope === 'agent' ? t('周均消耗 token') : t('周均消耗 Tapies'),
      value: formatAmount(summary.weeklyAverageAmount, locale),
    },
    { label: t('活跃天数'), value: new Intl.NumberFormat(locale).format(summary.activeDays) },
    { label: t('最长连续活跃天数'), value: new Intl.NumberFormat(locale).format(summary.longestActiveStreakDays) },
  ];

  /* 官方 `M`：`${scope}-${view}-${dir}-${firstKey}-${len}-${totalAmount}` —— 换 key 触发重挂载动画 */
  const chartKey = loading
    ? `${scope}-${view}-${direction}-loading`
    : `${scope}-${view}-${direction}-${points[0]?.key ?? 'empty'}-${points.length}-${summary.totalAmount}`;

  const selectScope = (next: TapiesUsageScope) => {
    if (next === scope) return;
    setDirection(scopeOrder[next] > scopeOrder[scope] ? 'ltr' : 'rtl');
    setScope(next);
  };
  const selectView = (next: 'daily' | 'weekly' | 'cumulative') => {
    if (next === view) return;
    setDirection(viewOrder[next] > viewOrder[view] ? 'ltr' : 'rtl');
    setView(next);
  };

  /* 官方 `k` = `organization.org_name || user.org_name || t('teamFallback')`，头像与副标题都用它。
     ⚠️ **MTV 偏离**：MTV 没有组织/团队，取本机资料名（`config.profileUsername`，与左侧账号菜单
     同一个字段），拿不到就退到官方兜底词「团队」。 */
  const profileName = useAppStore((state) => state.config.profileUsername) ?? '';
  const profileAvatarUrl = useAppStore((state) => state.config.profileAvatarUrl) ?? '';
  const identityName = profileName.trim() || t('团队');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 px-6 pt-8 pb-6 sm:px-8 sm:pb-8">
      <div className="flex flex-col items-center text-center">
        <UsageAvatar name={identityName} avatarUrl={profileAvatarUrl} />
        <h2 className="mt-4 text-2xl font-semibold tracking-normal text-foreground/90">{t('Tapies 用量')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{identityName} · {t('最近 365 天')}</p>
        <div className="mt-4 flex w-fit rounded-lg border border-border bg-card/70 p-1">
          <SegmentedButton active={scope === 'total'} onClick={() => selectScope('total')}>{t('总用量')}</SegmentedButton>
          <SegmentedButton active={scope === 'agent'} onClick={() => selectScope('agent')}>{t('Agent 用量')}</SegmentedButton>
        </div>
      </div>

      <UsageMetricGrid metrics={metrics} />

      <section className="rounded-xl border border-border bg-card/55">
        <style>{OFFICIAL_KEYFRAMES}</style>
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-foreground">{t('Tapies 活动')}</h3>
          <div className="flex w-fit rounded-lg bg-background/80 p-1">
            <SegmentedButton active={view === 'daily'} onClick={() => selectView('daily')}>{t('每日')}</SegmentedButton>
            <SegmentedButton active={view === 'weekly'} onClick={() => selectView('weekly')}>{t('每周')}</SegmentedButton>
            <SegmentedButton active={view === 'cumulative'} onClick={() => selectView('cumulative')}>{t('累计')}</SegmentedButton>
          </div>
        </div>
        <div className="relative min-h-[156px] px-4 pt-4 pb-3">
          <div className="tapies-activity-chart" key={chartKey}>
            {view === 'daily' && (
              <DailyHeatmap animationDirection={direction} columns={columns} maxValue={maxValue} locale={locale} />
            )}
            {view === 'weekly' && (
              <WeeklyBars animationDirection={direction} columns={columns} values={weekly} locale={locale} />
            )}
            {view === 'cumulative' && (
              <CumulativeTrend
                animationDirection={direction}
                columns={columns}
                cumulativeValues={cumulative}
                weeklyValues={weekly}
                locale={locale}
              />
            )}
          </div>
          <UsageStates
            hasError={hasError}
            isEmpty={isEmpty}
            loading={loading}
            onRetry={() => { void reload(); }}
          />
        </div>
      </section>
    </div>
  );
}
