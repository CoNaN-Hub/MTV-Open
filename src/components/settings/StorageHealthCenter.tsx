/**
 * StorageHealthCenter — 存储健康中心 UI
 * 展示项目空间占用、.trash 残留、孤儿文件、重复文件，提供清理操作
 * 包含 SVG 圆环图和条状图
 *
 * 版式 = **官方设计语言**（官方设置面板里没有「存储健康」这一页）：
 *   · 外壳：`SettingsPaneBody`（官方右栏内容 32/40 内边距 + `overflow-y-auto overflow-x-hidden`）
 *     + `SettingsPaneHeader`（18/500 #f5f5f5 + 14 #7a7a7a）
 *   · 面板头右侧动作：官方 `flex items-start justify-between gap-4`（`.o-pane-head`）+ 官方 Button `sm`
 *   · 卡片：官方 `overflow-hidden rounded-xl border border-border/80 bg-muted/30`（`.o-card`）
 *     行：`flex items-start gap-3 px-4 py-3.5 border-border/70 border-b`（`.o-card__row`）
 *   · 详情切换：官方 Tabs（`.o-tab`，选中态是 `inset 0 -2px 0 0 --o-primary` 下划线）
 *   · 筛选胶囊：官方 chip（`.o-filterchip`，选中 `bg-accent`）
 *   · 空状态：官方 `flex flex-col items-center justify-center gap-3`（`.o-empty`）
 *   · 配色：**只从官方色板取**（见下面 OFFICIAL_COLORS）
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import {
  scanStorageHealth,
  clearTrashDir,
  deleteOrphanFile,
  deleteDuplicateFile,
  collectNodeFilePaths,
  type StorageHealthReport,
  type TrashInfo,
  type OrphanFileInfo,
  type DuplicateFileGroup,
} from '../../services/fs/storageHealth';
import {
  estimateBrowserStorage,
  formatBytes,
  STORAGE_PRESSURE_RATIO,
  type StorageEstimate,
} from '../../services/storageQuota';
import { SettingsPaneBody, SettingsPaneHeader } from './SettingsPane';
import { OfficialButton } from './official/OfficialControls';
import DirectorDeskStorageManager from './DirectorDeskStorageManager';
import { useT } from '../../i18n';

// ============================================
// 颜色映射 —— 官方色板（暗色实测值）**是这里唯一的取色来源**
// ============================================
//
// 原来这里有两套「官方体系外」的颜色：分类色板里的青(#22d3ee)/紫(#a78bfa)/
// 粉(#f472b6)，以及问题分区里的琥珀/橙。它们和面板里那套官方 token 明显不是一家。
// 现在按「颜色承担的语义」分三类取色，全部落在官方色板上：
//   · 分类构成（圆环图）= **分类**语义 ⇒ 从官方状态色 + 主色里取 5 个可区分的值
//     （图片/视频同属视觉媒体，用主色与 tap-primary-1 两个蓝的深浅区分；
//      音频→warning、文本→info、其他→muted-foreground）
//   · 各项目占用（堆叠条）= **同一指标跨项目** ⇒ 主色 `#1fa2dc` 派生的有序色阶
//     （亮度交替，相邻段才分得开；不用状态色，免得「某个项目=错误红」这种错误语义）
//   · 问题分区（筛选胶囊/圆点）= **状态**语义 ⇒ 直接用官方状态色
const OFFICIAL_COLORS = {
  primary: '#1fa2dc',   // --o-primary / --tap-primary
  primary1: '#33a8ff',  // --tap-primary-1
  info: '#2196f3',      // --o-tap-state-info
  success: '#4caf50',   // --o-tap-state-success
  warning: '#ff9800',   // --o-tap-state-warning
  error: '#f44336',     // --o-tap-state-error
  muted: '#7a7a7a',     // --o-muted-foreground
} as const;

const CATEGORY_COLORS: Record<string, string> = {
  '图片': OFFICIAL_COLORS.primary,
  '视频': OFFICIAL_COLORS.primary1,
  '音频': OFFICIAL_COLORS.warning,
  '文本': OFFICIAL_COLORS.info,
  '其他': OFFICIAL_COLORS.muted,
};

/** 主色派生色阶（亮度交替，相邻项目段之间才有对比） */
const PROJECT_COLORS = [
  '#1fa2dc', '#7fcef5', '#166f99', '#33a8ff', '#a3dff9',
  '#1c86b8', '#5cbdf0', '#0f587a', '#b8e7fb', '#0b4360',
];

// ============================================
// 工具函数
// ============================================

function formatShortPath(filePath: string, maxLen = 42): string {
  if (filePath.length <= maxLen) return filePath;
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.length <= 2) return filePath;
  const first = parts.slice(0, 1).join('/');
  const last = parts.slice(-2).join('/');
  const short = `${first}/.../${last}`;
  return short.length > maxLen ? `${first}/.../${parts[parts.length - 1]}` : short;
}

// ============================================
// ECharts 风格 SVG 圆环图
// ============================================

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/** 极坐标 → 笛卡尔坐标 */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** 生成单个扇叶的 SVG path：四角圆角 + 段间白色间隙 */
function buildDonutPath(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startAngle: number, endAngle: number,
  cr: number,
  gapDeg: number,
): string {
  const sa = startAngle + gapDeg / 2;
  const ea = endAngle - gapDeg / 2;
  const sweep = ea - sa;
  if (sweep <= 0) return '';

  const largeArc = sweep > 180 ? 1 : 0;

  // 小扇区需要同步收窄圆角，避免圆角互相穿插。
  const sweepRad = sweep * (Math.PI / 180);
  const cornerR = Math.min(cr, (outerR - innerR) / 2, (innerR * sweepRad) / 2);
  const outDeg = (cornerR / outerR) * (180 / Math.PI);
  const inDeg = (cornerR / innerR) * (180 / Math.PI);

  const oStart = polarToCartesian(cx, cy, outerR, sa + outDeg);
  const oEnd = polarToCartesian(cx, cy, outerR, ea - outDeg);
  const oEndCorner = polarToCartesian(cx, cy, outerR, ea);
  const oEndSide = polarToCartesian(cx, cy, outerR - cornerR, ea);
  const iEndSide = polarToCartesian(cx, cy, innerR + cornerR, ea);
  const iEndCorner = polarToCartesian(cx, cy, innerR, ea);
  const iEnd = polarToCartesian(cx, cy, innerR, ea - inDeg);
  const iStart = polarToCartesian(cx, cy, innerR, sa + inDeg);
  const iStartCorner = polarToCartesian(cx, cy, innerR, sa);
  const iStartSide = polarToCartesian(cx, cy, innerR + cornerR, sa);
  const oStartSide = polarToCartesian(cx, cy, outerR - cornerR, sa);
  const oStartCorner = polarToCartesian(cx, cy, outerR, sa);

  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `Q ${oEndCorner.x} ${oEndCorner.y} ${oEndSide.x} ${oEndSide.y}`,
    `L ${iEndSide.x} ${iEndSide.y}`,
    `Q ${iEndCorner.x} ${iEndCorner.y} ${iEnd.x} ${iEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    `Q ${iStartCorner.x} ${iStartCorner.y} ${iStartSide.x} ${iStartSide.y}`,
    `L ${oStartSide.x} ${oStartSide.y}`,
    `Q ${oStartCorner.x} ${oStartCorner.y} ${oStart.x} ${oStart.y}`,
    'Z',
  ].join(' ');
}

function DonutChart({ segments, total, size = 160 }: {
  segments: DonutSegment[];
  total: number;
  size?: number;
}) {
  const t = useT();
  const cx = size / 2;
  const cy = size / 2;
  const innerR = size * 0.27;
  const outerR = size * 0.46;
  const cornerR = size * 0.02;
  const gapDeg = 2;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (segments.length === 0 || total === 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* 环形底 = 官方 `bg-muted`（SVG 属性吃不了 var() ⇒ 走 `currentColor` + o-muted-t） */}
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="currentColor" strokeWidth={outerR - innerR} className="o-muted-t" />
          <text x={cx} y={cy} textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="600" className="o-fg-t">0 B</text>
        </svg>
        <div className="o-muted-t text-[11px]">{t('暂无数据')}</div>
      </div>
    );
  }

  // 计算每个扇叶的角度范围（用循环累加，不在 map 回调里改写外层变量）
  let cursor = 0;
  const slices = [];
  for (const seg of segments) {
    const sweep = (seg.value / total) * 360;
    slices.push({ ...seg, start: cursor, sweep, pct: (seg.value / total) * 100 });
    cursor += sweep;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 图例 — 居中放在顶部 */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {slices.map((s, i) => (
          <div
            key={i}
            className="flex cursor-default items-center gap-1.5 text-[11px]"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <span className="o-swatch" style={{ backgroundColor: s.color }} />
            <span className="o-muted-t">{t(s.label)}</span>
          </div>
        ))}
      </div>

      {/* 圆环 */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path
            key={i}
            d={buildDonutPath(cx, cy, innerR, outerR, s.start, s.start + s.sweep, cornerR, gapDeg)}
            fill={s.color}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{
              cursor: 'pointer',
              opacity: hoverIdx === null || hoverIdx === i ? 0.92 : 0.4,
              transition: 'opacity 0.2s ease',
              filter: hoverIdx === i ? 'drop-shadow(0 0 3px rgba(0,0,0,0.3))' : undefined,
            }}
          />
        ))}
        {/* 中心文字 */}
        {hoverIdx !== null ? (
          <>
            <text x={cx} y={cy - 12} textAnchor="middle" fill="currentColor" fontSize="20" fontWeight="bold" className="o-fg-t">
              {slices[hoverIdx].pct.toFixed(0)}%
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="600" className="o-fg-t">
              {formatBytes(slices[hoverIdx].value)}
            </text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
              fill="currentColor" fontSize="15" fontWeight="600" className="o-fg-t">
              {formatBytes(total).split(' ')[0]}
            </text>
            <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="middle"
              fill="currentColor" fontSize="11" className="o-muted-t">
              / {formatBytes(total).split(' ')[1] || 'B'}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ============================================
// SVG 条状图 (Bar Chart) 组件
// ============================================

interface BarItem {
  label: string;
  value: number;
  color: string;
}

function StackedBar({ items }: { items: BarItem[] }) {
  const t = useT();
  const total = items.reduce((s, i) => s + i.value, 0);

  if (items.length === 0 || total === 0) {
    return (
      <div className="o-muted-t flex items-center justify-center py-8 text-xs">
        {t('暂无项目数据')}
      </div>
    );
  }

  // 过滤掉占比小于 2% 的段，防止标签重叠
  const segments = items.map((item) => ({
    ...item,
    pct: (item.value / total) * 100,
  }));

  return (
    <div className="space-y-3">
      {/* 占比条 */}
      <div className="flex h-6 overflow-hidden rounded-[6px] border o-line o-inset">
        {segments.map((seg, i) => {
          const isFirst = i === 0;
          const isLast = i === segments.length - 1;
          return (
            <div
              key={i}
              className="group relative h-full min-w-[3px] transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{
                width: `${seg.pct}%`,
                backgroundColor: seg.color,
                opacity: 0.88,
                borderRadius: isFirst
                  ? '5px 0 0 5px'
                  : isLast
                    ? '0 5px 5px 0'
                    : undefined,
              }}
              title={`${t(seg.label)}: ${formatBytes(seg.value)} (${seg.pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex min-w-0 items-center gap-1.5 text-[11px]">
            <span className="o-swatch" style={{ backgroundColor: seg.color }} />
            <span className="o-muted-t max-w-[80px] truncate" title={t(seg.label)}>{t(seg.label)}</span>
            <span className="o-muted-t tabular-nums">{seg.pct.toFixed(0)}%</span>
            <span className="o-muted-t tabular-nums">{formatBytes(seg.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

export default function StorageHealthCenter() {
  const t = useT();
  const { projects, nodes, showToast } = useAppStore(
    useShallow((s) => ({
      projects: s.projects,
      currentProjectId: s.currentProjectId,
      nodes: s.nodes,
      showToast: s.showToast,
    })),
  );

  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<StorageHealthReport | null>(null);
  const [browserStorage, setBrowserStorage] = useState<StorageEstimate | null>(null);
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const scannedRef = useRef(false);

  // 执行扫描
  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      // 浏览器配额（IndexedDB 里的画布数据）和磁盘占用是两笔账，都要看
      void estimateBrowserStorage().then(setBrowserStorage);

      // 收集所有节点的 filePath 引用
      const nodeFilePaths = collectNodeFilePaths(nodes as Array<{ data?: Record<string, unknown> }>);
      const assetFolders = [] as { path: string; label: string }[];

      const result = await scanStorageHealth(projects, nodeFilePaths, assetFolders);
      setReport(result);
      scannedRef.current = true;

      const totalLabel = formatBytes(result.totalSize);
      const reclaimLabel = formatBytes(result.reclaimableSize);
      const issueCount =
        result.trashes.length +
        result.orphans.length +
        result.duplicates.length +
        result.offlineFolders.length;

      if (issueCount > 0) {
        showToast(
          t('总占用 {total}，可释放 {reclaim}，发现 {count} 个问题', { total: totalLabel, reclaim: reclaimLabel, count: issueCount }),
          result.reclaimableSize > 0 ? 'info' : 'success',
        );
      } else {
        showToast(t('总占用 {total}，一切正常', { total: totalLabel }));
      }
    } catch (err) {
      console.error('Storage scan failed:', err);
      showToast(t('扫描失败，请重试'), 'error');
    } finally {
      setScanning(false);
    }
  }, [projects, nodes, showToast, t]);

  // 打开时自动扫描一次
  useEffect(() => {
    if (!scannedRef.current) {
      handleScan();
    }
    return () => { scannedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 清空 .trash
  const handleClearTrash = useCallback(async (trash: TrashInfo) => {
    setDeleting((prev) => new Set(prev).add(trash.trashDir));
    try {
      await clearTrashDir(trash.trashDir);
      showToast(t('已清空「{name}」的回收站缓存', { name: trash.projectName }));
      // 重置扫描标记以触发重新扫描
      scannedRef.current = false;
      await handleScan();
    } catch {
      showToast(t('清理失败'), 'error');
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(trash.trashDir);
        return next;
      });
    }
  }, [showToast, handleScan, t]);

  // 删除孤儿文件
  const handleDeleteOrphan = useCallback(async (orphan: OrphanFileInfo) => {
    setDeleting((prev) => new Set(prev).add(orphan.path));
    try {
      const ok = await deleteOrphanFile(orphan.path);
      if (ok) {
        showToast(t('已删除：{name}', { name: orphan.name }));
        scannedRef.current = false;
        await handleScan();
      } else {
        showToast(t('删除失败'), 'error');
      }
    } catch {
      showToast(t('删除失败'), 'error');
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(orphan.path);
        return next;
      });
    }
  }, [showToast, handleScan, t]);

  // 删除重复文件
  const handleDeleteDuplicate = useCallback(async (file: DuplicateFileGroup['files'][0]) => {
    setDeleting((prev) => new Set(prev).add(file.path));
    try {
      const ok = await deleteDuplicateFile(file.path);
      if (ok) {
        showToast(t('已删除：{name}', { name: file.name }));
        scannedRef.current = false;
        await handleScan();
      } else {
        showToast(t('删除失败'), 'error');
      }
    } catch {
      showToast(t('删除失败'), 'error');
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(file.path);
        return next;
      });
    }
  }, [showToast, handleScan, t]);

  // 清空所有 .trash
  const handleClearAllTrash = useCallback(async () => {
    if (!report) return;
    for (const trash of report.trashes) {
      await clearTrashDir(trash.trashDir);
    }
    showToast(t('已清空所有回收站缓存'));
    scannedRef.current = false;
    await handleScan();
  }, [report, showToast, handleScan, t]);

  // 删除所有孤儿文件
  const handleDeleteAllOrphans = useCallback(async () => {
    if (!report) return;
    let count = 0;
    for (const orphan of report.orphans) {
      const ok = await deleteOrphanFile(orphan.path);
      if (ok) count++;
    }
    showToast(t('已删除 {count} 个孤儿文件', { count }));
    scannedRef.current = false;
    await handleScan();
  }, [report, showToast, handleScan, t]);

  // 汇总数据
  const overview = useMemo(() => {
    if (!report) return null;

    const categoryTotals: Record<string, number> = {};
    for (const p of report.projects) {
      for (const [cat, info] of Object.entries(p.categories)) {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + info.size;
      }
    }

    const donutSegments: DonutSegment[] = Object.entries(categoryTotals)
      .map(([cat, size]) => ({
        label: cat,
        value: size,
        color: CATEGORY_COLORS[cat] || '#94a3b8',
      }))
      .sort((a, b) => b.value - a.value);

    const projectBars: BarItem[] = report.projects
      .map((p, i) => ({
        label: p.projectName,
        value: p.fileSize,
        color: PROJECT_COLORS[i % PROJECT_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    const issueSections = [
      {
        id: 'trash',
        label: t('回收站残留'),
        count: report.trashes.length,
        totalSize: report.trashes.reduce((s, t) => s + t.trashSize, 0),
        color: OFFICIAL_COLORS.warning,
      },
      {
        id: 'orphans',
        label: t('孤儿文件'),
        count: report.orphans.length,
        totalSize: report.orphans.reduce((s, o) => s + o.size, 0),
        color: OFFICIAL_COLORS.error,
      },
      {
        id: 'duplicates',
        label: t('重复文件'),
        count: report.duplicates.length,
        totalSize: report.duplicates.reduce((s, d) => s + d.reclaimableSize, 0),
        color: OFFICIAL_COLORS.info,
      },
      {
        id: 'offline',
        label: t('离线文件夹'),
        count: report.offlineFolders.length,
        totalSize: 0,
        color: OFFICIAL_COLORS.muted,
      },
    ].filter((s) => s.count > 0);

    return { donutSegments, projectBars, issueSections };
  }, [report, t]);

  const isEmpty = !report || (report.projects.length === 0 && report.trashes.length === 0);

  return (
    <SettingsPaneBody>
      <div className="o-pane-head">
        <SettingsPaneHeader
          title={t('存储健康')}
          description={t('检测各项目的存储占用与可优化空间。')}
        />
        <div className="o-inline o-inline--wrap shrink-0">
          <OfficialButton variant="outline" size="sm" onClick={handleScan} disabled={scanning}>
            <Icon
              icon={scanning ? 'lucide:loader-2' : 'lucide:refresh-cw'}
              width={16}
              className={scanning ? 'animate-spin' : undefined}
            />
            {scanning ? t('扫描中…') : t('重新扫描')}
          </OfficialButton>
        </div>
      </div>

      <div className="o-stack mt-8">
      {/* 浏览器存储配额 — 画布数据存在 IndexedDB 里，配额用尽会导致自动保存失败 */}
      {browserStorage && browserStorage.quota > 0 && (() => {
        const ratio = Math.min(1, browserStorage.ratio);
        const pressured = ratio >= STORAGE_PRESSURE_RATIO;
        return (
          <div className="o-card o-card--pad">
            <div className="o-row o-inline--wrap">
              <div className="o-card__title">{t('浏览器存储配额')}</div>
              <div className="o-muted-t shrink-0 text-[11px] tabular-nums">
                {formatBytes(browserStorage.usage)} / {formatBytes(browserStorage.quota)}（{(ratio * 100).toFixed(1)}%）
              </div>
            </div>
            <div className="o-progress mt-3">
              <span
                className="o-progress__bar"
                data-tone={pressured ? 'warning' : undefined}
                style={{ width: `${Math.max(2, ratio * 100)}%` }}
              />
            </div>
            <p className="o-muted mt-2 text-[11px]">
              {pressured
                ? t('配额即将用尽，自动保存可能失败，建议清理下方可释放空间或导出并删除旧项目')
                : t('项目画布数据存放在浏览器存储中，配额用尽会导致自动保存失败')}
            </p>
          </div>
        );
      })()}

      {scanning && !report && (
        <div className="o-empty">
          <Icon icon="lucide:loader-2" width={32} className="o-primary-t animate-spin" />
          <p className="o-empty__desc">{t('正在分析存储状况…')}</p>
        </div>
      )}

      {report && !isEmpty && overview && (
        <>
          {/* 总览卡片 */}
          <div className="o-card o-card--pad">
            <div className="flex flex-wrap items-center gap-6">
              {/* 圆环图 */}
              <DonutChart
                segments={overview.donutSegments}
                total={report.totalSize}
                size={160}
              />

              {/* 右侧统计 */}
              <div className="o-stack min-w-[220px] flex-1">
                <div className="o-metrics">
                  <div>
                    <div className="o-metric__label">{t('总占用空间')}</div>
                    <div className="o-metric__value">{formatBytes(report.totalSize)}</div>
                  </div>
                  <div>
                    <div className="o-metric__label">{t('可释放空间')}</div>
                    <div
                      className="o-metric__value"
                      data-tone={report.reclaimableSize > 0 ? 'success' : undefined}
                    >
                      {formatBytes(report.reclaimableSize)}
                    </div>
                  </div>
                </div>
                <div className="o-card__meta">
                  <span>{t('{count} 个项目', { count: report.projects.length })}</span>
                  <span>{t('{count} 个文件', { count: report.projects.reduce((s, p) => s + p.fileCount, 0) })}</span>
                </div>
                {/* 问题标签 */}
                {overview.issueSections.length > 0 && (
                  <div className="o-filterbar o-filterbar--wrap">
                    {overview.issueSections.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="o-filterchip"
                        data-checked={activeSection === s.id || undefined}
                        onClick={() => setActiveSection(s.id)}
                      >
                        <span className="o-dot" style={{ backgroundColor: s.color }} />
                        <span>{s.label}</span>
                        <span className="opacity-60">{s.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 条状图 — 各项目存储占用 */}
          <div className="o-card o-card--pad">
            <h3 className="o-card__title">{t('各项目占用空间')}</h3>
            <div className="mt-4">
              <StackedBar items={overview.projectBars} />
            </div>
          </div>

          {/* 详情区域切换（官方 Tabs：`text-muted-foreground` + `aria-selected` 下划线） */}
          <div className="flex flex-wrap items-center gap-6 border-b o-line">
            {[
              { id: 'overview', label: t('概览') },
              { id: 'trash', label: `${t('回收站残留')} ${report.trashes.length > 0 ? `(${report.trashes.length})` : ''}` },
              { id: 'orphans', label: `${t('孤儿文件')} ${report.orphans.length > 0 ? `(${report.orphans.length})` : ''}` },
              { id: 'duplicates', label: `${t('重复文件')} ${report.duplicates.length > 0 ? `(${report.duplicates.length})` : ''}` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeSection === tab.id}
                className="o-tab"
                onClick={() => setActiveSection(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* === 概览详情 === */}
          {activeSection === 'overview' && (
            <div className="o-stack">
              {report.projects.map((p) => (
                <div key={p.projectId} className="o-card">
                  <div className="o-card__row o-card__row--center">
                    <div className="o-card__body">
                      <div className="o-card__title">{p.projectName}</div>
                    </div>
                    <span className="o-muted-t shrink-0 text-[11px] tabular-nums">{formatBytes(p.fileSize)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 px-4 py-3">
                    {Object.entries(p.categories).map(([cat, info]) => (
                      <span key={cat} className="o-badge o-badge--sm">
                        <span
                          className="o-dot mr-1"
                          style={{ backgroundColor: CATEGORY_COLORS[cat] || OFFICIAL_COLORS.muted }}
                        />
                        {t(cat)} {info.count}{t('个')} · {formatBytes(info.size)}
                      </span>
                    ))}
                    {Object.keys(p.categories).length === 0 && (
                      <span className="o-muted-t text-[10px]">{t('暂无文件')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* === .trash 残留 === */}
          {activeSection === 'trash' && (
            <div className="o-stack">
              {report.trashes.length === 0 ? (
                <div className="o-empty">
                  <span className="o-empty__icon"><Icon icon="lucide:trash-2" width={22} /></span>
                  <div className="o-empty__title">{t('没有发现回收站残留，很好！')}</div>
                </div>
              ) : (
                <>
                  <div className="flex justify-end">
                    <OfficialButton
                      variant="ghost"
                      size="sm"
                      className="o-danger-t"
                      onClick={handleClearAllTrash}
                    >
                      <Icon icon="lucide:trash-2" width={14} />
                      {t('清空全部')}
                    </OfficialButton>
                  </div>
                  <div className="o-card">
                    {report.trashes.map((trash) => (
                      <div key={trash.trashDir} className="o-card__row o-card__row--center">
                        <div className="o-card__body">
                          <div className="o-card__title">{trash.projectName}</div>
                          <div className="o-card__desc o-mono" title={trash.trashDir}>
                            {formatShortPath(trash.trashDir)}
                          </div>
                          <div className="o-card__meta o-warn-t">
                            {formatBytes(trash.trashSize)} · {t('{count} 个文件', { count: trash.fileCount })}
                          </div>
                        </div>
                        <div className="o-card__actions">
                          <OfficialButton
                            variant="outline"
                            size="sm"
                            className="o-danger-t"
                            onClick={() => handleClearTrash(trash)}
                            disabled={deleting.has(trash.trashDir)}
                          >
                            {deleting.has(trash.trashDir) ? t('清理中…') : t('清空')}
                          </OfficialButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* === 孤儿文件 === */}
          {activeSection === 'orphans' && (
            <div className="o-stack">
              {report.orphans.length === 0 ? (
                <div className="o-empty">
                  <span className="o-empty__icon"><Icon icon="lucide:check-check" width={22} /></span>
                  <div className="o-empty__title">{t('没有发现孤儿文件，所有文件均有引用')}</div>
                </div>
              ) : (
                <>
                  <div className="o-row o-inline--wrap">
                    <span className="o-muted-t text-[11px]">
                      {t('共 {count} 个孤儿文件，可释放 {size}', { count: report.orphans.length, size: formatBytes(report.orphans.reduce((s, o) => s + o.size, 0)) })}
                    </span>
                    <OfficialButton
                      variant="ghost"
                      size="sm"
                      className="o-danger-t"
                      onClick={handleDeleteAllOrphans}
                    >
                      {t('全部清理')}
                    </OfficialButton>
                  </div>
                  <div className="o-card">
                    <div className="max-h-[300px] overflow-y-auto">
                      {report.orphans.map((orphan) => (
                        <div key={orphan.path} className="o-list__row">
                          <div className="o-list__copy flex-1">
                            <strong title={orphan.path}>{orphan.name}</strong>
                            <small>{orphan.projectName} · {formatBytes(orphan.size)}</small>
                          </div>
                          <OfficialButton
                            variant="ghost"
                            size="sm"
                            className="o-danger-t shrink-0"
                            onClick={() => handleDeleteOrphan(orphan)}
                            disabled={deleting.has(orphan.path)}
                          >
                            {deleting.has(orphan.path) ? '…' : t('删除')}
                          </OfficialButton>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* === 重复文件 === */}
          {activeSection === 'duplicates' && (
            <div className="o-stack">
              {report.duplicates.length === 0 ? (
                <div className="o-empty">
                  <span className="o-empty__icon"><Icon icon="lucide:copy-check" width={22} /></span>
                  <div className="o-empty__title">{t('没有发现重复文件')}</div>
                </div>
              ) : (
                <div className="o-card">
                  <div className="max-h-[300px] space-y-px overflow-y-auto">
                    {report.duplicates.map((group) => (
                      <div key={group.key} className="o-list__row">
                        <div className="o-list__copy flex-1">
                          <strong className="truncate" title={group.files[0]?.name}>
                            {group.files[0]?.name || t('未知文件')}
                          </strong>
                          <small className="o-info-t">
                            {t('{count} 份 · 可释放 {size}', { count: group.files.length, size: formatBytes(group.reclaimableSize) })}
                          </small>
                          <div className="mt-1 space-y-1">
                            {group.files.map((file, fi) => (
                              <div
                                key={file.path}
                                className="flex items-center justify-between gap-2 border-l-2 o-line pl-2 text-[10px]"
                              >
                                <span className="o-muted-t min-w-0 flex-1 truncate" title={file.path}>
                                  {file.projectName} / {file.name}
                                </span>
                                <span className="o-muted-t shrink-0 tabular-nums">{formatBytes(file.size)}</span>
                                {fi > 0 && (
                                  <OfficialButton
                                    variant="ghost"
                                    size="sm"
                                    className="o-danger-t shrink-0"
                                    onClick={() => handleDeleteDuplicate(file)}
                                    disabled={deleting.has(file.path)}
                                  >
                                    {deleting.has(file.path) ? '…' : t('删除')}
                                  </OfficialButton>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {report && isEmpty && (
        <div className="o-empty">
          <span className="o-empty__icon"><Icon icon="lucide:hard-drive" width={22} /></span>
          <div className="o-empty__title">{t('暂无存储数据')}</div>
          <p className="o-empty__desc">{t('尚未创建项目或项目目录为空')}</p>
          <OfficialButton variant="outline" size="sm" onClick={handleScan}>
            <Icon icon="lucide:refresh-cw" width={16} />
            {t('重新扫描')}
          </OfficialButton>
        </div>
      )}

      {/* 3D 导演台的本地资源占用 —— 同一页签里的第二块，自己给官方设置项分隔线 */}
      <DirectorDeskStorageManager />
      </div>
    </SettingsPaneBody>
  );
}
