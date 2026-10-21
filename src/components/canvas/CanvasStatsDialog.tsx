/**
 * 画布统计弹窗 —— 按《画布统计 · 复刻手册（单文件版）》（Artigine 2026-10-06 抓取）复刻。
 *
 * 入口：左侧竖条第 5 件（原「打开评论」的位置，用户 2026 指定替换）。
 *
 * ★ 结构/尺寸不是照截图目测的，是**从原版线上 DOM 逐项量出来的**（CDP 9223 ·
 *   `app.artigine.com/projects/…` 打开「项目名 → 画布 → 画布统计」后 dump）：
 *   · 面板 672×636 · 圆角 59px · `bg-zinc-50/80 dark:bg-zinc-900/70` · `backdrop-blur-xl`
 *     · `shadow-[0_36px_120px_rgba(15,23,42,0.18)]` · `max-h-[78vh]`
 *   · 头部 `px-6 py-6` + 标题 `text-base font-medium` + 18px 图标；下面一条 1px 分隔线
 *   · 内容 `p-6 space-y-6`；KPI `grid gap-4 sm:grid-cols-2`，卡 `rounded-2xl ring-1 ring-foreground/10 bg-card/50`
 *   · 类型分布卡 `bg-card/80`，内容 `grid gap-8 lg:grid-cols-[200px_1fr] items-center`
 *   · 甜甜圈 160×160 · r=70 · 中心洞 r=40 · 扇形 `stroke-white dark:stroke-zinc-900` + `stroke-width 2`
 *   · **中心数字不是 SVG text**，是 `absolute flex flex-col items-center` 的 HTML 叠层：
 *     `text-2xl font-bold` 的数字 + `text-[10px] uppercase tracking-wider text-muted-foreground` 的 Total
 *   · 图例一行 = `flex items-center justify-between py-2.5 px-2 -mx-2 rounded-xl`
 *     + 左侧**装着类型名的彩色药丸**（`px-2.5 py-1 rounded-md text-xs font-medium
 *       bg-{c}-500/10 dark:bg-{c}-500/20 text-{c}-600 dark:text-{c}-400`）
 *     + 右侧 `flex items-center gap-4`（`text-xs` 百分比 + `text-sm font-semibold w-6 text-right` 数量）
 *
 * 复刻手册的关键口径：
 *   · **纯前端零请求**：打开面板不发任何网络请求，直接从画布节点表现场聚合（`utils/canvasStats`）。
 *   · 面板关闭时**不订阅**节点表（手册 §2 的性能优化）。
 *   · 甜甜圈是**手写 SVG 扇形**（无图表库）：`polar` + `donutSlicePath`。
 *   · 「性能分析」在官方就是**占位空状态**（未实装）—— 这里照抄，不编数据。
 *
 * ★ 主题（用户 2026 补充）：面板的明暗**跟随「画布设置 → 画布背景」**——
 *   暗色为默认；选「米白浅色」时走浅色。MTV 已由 `App.tsx` 把这件事收敛成
 *   `document.documentElement[data-theme='light']`（`canvasBackground === 'off-white'` 时），
 *   所以这里只用 `var(--theme-*)` 画，明暗两套在 `styles/canvas-stats.css` 里按
 *   `[data-theme='light']` 覆盖即可，不自己判断主题。
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ModalOverlay from '../shared/ModalOverlay';
import PopupCloseButton from '../shared/PopupCloseButton';
import { OfficialIcon } from '../sidebar/OfficialIcon';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import {
  CANVAS_STATS_PALETTE,
  donutSlices,
  summarizeCanvasNodes,
} from '../../utils/canvasStats';

/** 甜甜圈几何：原版 DOM 实测（160×160 · r=70 · 中心洞 r=40）。 */
const DONUT = { size: 160, cx: 80, cy: 80, radius: 70, holeRadius: 40 } as const;

/** 面板关闭时的稳定空引用 —— 保证 selector 不会每次返回新数组（否则无限重渲染）。 */
const NO_NODES: readonly never[] = [];

export default function CanvasStatsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  /* 手册 §2：**只在面板打开时订阅**画布节点表，关闭时恒为空（性能优化） */
  const nodes = useAppStore((s) => (open ? s.nodes : NO_NODES));
  /** 悬停联动：值 = 分组 key；null = 无悬停 */
  const [hovered, setHovered] = useState<string | null>(null);

  const summary = useMemo(() => summarizeCanvasNodes(nodes), [nodes]);
  const slices = useMemo(
    () => donutSlices(summary.groups, { cx: DONUT.cx, cy: DONUT.cy, r: DONUT.radius }),
    [summary],
  );

  return (
    <ModalOverlay
      isOpen={open}
      onClose={onClose}
      ariaLabel={t('画布统计')}
      className="canvas-stats-modal"
      motionPreset="quick"
    >
      <header className="canvas-stats-head">
        <h2 className="canvas-stats-head__title">
          <span className="canvas-stats-head__icon" aria-hidden="true">
            <OfficialIcon name="rail-stats" size={18} />
          </span>
          {t('画布统计')}
        </h2>
        <PopupCloseButton onClick={onClose} ariaLabel={t('关闭')} className="canvas-stats-head__close" />
      </header>

      <div className="canvas-stats-body" data-testid="canvas-stats-dialog">
        {summary.total === 0 ? (
          <section className="canvas-stats-empty">
            <p className="canvas-stats-empty__title">{t('画布还没有节点')}</p>
            <p className="canvas-stats-empty__desc">{t('添加节点后即可查看统计信息')}</p>
          </section>
        ) : (
          <>
            <div className="canvas-stats-kpis">
              <div className="canvas-stats-kpi">
                <span className="canvas-stats-kpi__label">{t('节点总数')}</span>
                <span className="canvas-stats-kpi__value" data-testid="canvas-stats-total">{summary.total}</span>
              </div>
              <div className="canvas-stats-kpi">
                <span className="canvas-stats-kpi__label">{t('类型数')}</span>
                <span className="canvas-stats-kpi__value" data-testid="canvas-stats-types">{summary.typeCount}</span>
              </div>
            </div>

            <div className="canvas-stats-card canvas-stats-card--distribution">
              <div className="canvas-stats-card__head">
                <span className="canvas-stats-card__title">{t('类型分布')}</span>
              </div>
              <div className="canvas-stats-dist">
                <div className="canvas-stats-donut-box">
                  {/* 手写扇形：10 色循环 + 中心挖洞（角度 0° = 12 点钟，见 utils/canvasStats `polar`） */}
                  <svg
                    className="canvas-stats-donut"
                    width={DONUT.size}
                    height={DONUT.size}
                    viewBox={`0 0 ${DONUT.size} ${DONUT.size}`}
                    role="img"
                    aria-label={t('类型分布')}
                  >
                    {slices.map((slice) => (
                      <motion.path
                        key={slice.key}
                        d={slice.d}
                        fill={CANVAS_STATS_PALETTE[slice.colorIndex].fill}
                        className="canvas-stats-donut__slice"
                        strokeWidth={2}
                        onMouseEnter={() => setHovered(slice.key)}
                        onMouseLeave={() => setHovered(null)}
                        animate={{ opacity: hovered && hovered !== slice.key ? 0.5 : 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.16 }}
                      />
                    ))}
                    {/* 悬停扇形**复制一份置顶**放大 —— 手册 §4 的做法（不改变原扇形的层级与顺序） */}
                    <AnimatePresence>
                      {hovered && (() => {
                        const slice = slices.find((item) => item.key === hovered);
                        if (!slice) return null;
                        return (
                          <motion.path
                            key={`hover-${slice.key}`}
                            d={slice.d}
                            fill={CANVAS_STATS_PALETTE[slice.colorIndex].fill}
                            className="canvas-stats-donut__slice canvas-stats-donut__slice--hover"
                            initial={{ opacity: 0, scale: 1 }}
                            animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1.06 }}
                            exit={{ opacity: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            style={{ transformOrigin: `${DONUT.cx}px ${DONUT.cy}px` }}
                          />
                        );
                      })()}
                    </AnimatePresence>
                    <circle cx={DONUT.cx} cy={DONUT.cy} r={DONUT.holeRadius} className="canvas-stats-donut__hole" />
                  </svg>
                  {/* 中心叠层：原版是 HTML（不是 SVG text）—— 数字 + Total 小字 */}
                  <div className="canvas-stats-donut-center">
                    <motion.span
                      className="canvas-stats-donut-center__value"
                      data-testid="canvas-stats-center"
                      animate={reduceMotion ? undefined : { scale: hovered ? 1.05 : 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    >
                      {summary.total}
                    </motion.span>
                    {/* 原版这里就是**硬编码英文**的 `Total`（它自己的中文界面上也显示 TOTAL）⇒ 1:1 照抄 */}
                    <span className="canvas-stats-donut-center__caption">Total</span>
                  </div>
                </div>

                <ul className="canvas-stats-legend">
                  {summary.groups.map((group) => {
                    const color = CANVAS_STATS_PALETTE[group.colorIndex];
                    return (
                      <li key={group.key}>
                        <button
                          type="button"
                          className="canvas-stats-legend__row"
                          data-active={hovered === group.key ? '' : undefined}
                          onMouseEnter={() => setHovered(group.key)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() => setHovered(group.key)}
                          onBlur={() => setHovered(null)}
                        >
                          <span
                            className="canvas-stats-legend__chip"
                            style={{
                              '--chip': color.hex,
                              '--chip-text': color.text,
                              '--chip-text-dark': color.textDark,
                            } as CSSProperties}
                          >
                            {t(group.label)}
                          </span>
                          <span className="canvas-stats-legend__meta">
                            <span className="canvas-stats-legend__percent">{group.percent}%</span>
                            <span className="canvas-stats-legend__count">{group.count}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="canvas-stats-card canvas-stats-card--performance">
              <div className="canvas-stats-card__head">
                <span className="canvas-stats-card__title canvas-stats-card__title--plain">{t('性能分析')}</span>
              </div>
              {/* 官方这一块就是占位空状态（未实装）—— 照抄，不编数据 */}
              <p className="canvas-stats-placeholder">{t('暂无性能数据')}</p>
            </div>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}
