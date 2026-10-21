/**
 * 小地图节点统计 — 悬浮小地图时在上方浮层里统计画布各类型节点数量与总数量。
 * 统计口径与 React Flow 实际渲染的节点一致（已剔除隐藏节点），与小地图显示的内容同步。
 */
import { useMemo, useState } from 'react';
import { MiniMap, useStore } from '@xyflow/react';
import { useT } from '../../i18n';
import { getNodeTypeLabel } from '../../utils/nodeTypeLabels';

/* 尺寸照官方源码硬编码常量：`const Zde = 200, Qde = 150`
   （zoom-slider-3ZcFvYQO.js 里 MiniMap 的 width/height 默认值）
   —— 与用户从官方导出的 `缩略图.svg`（width=200 height=150）完全吻合 ✓
   原来 MTV 用的是 180×120 ✗ */
const MINIMAP_STYLE = {
  width: 200,
  height: 150,
  border: '1px solid var(--theme-border)',
  borderRadius: '8px',
};

/** 统计行的固定展示顺序：生成类 → 源素材类 → 容器与笔记；未列出的类型排在末尾 */
const STATS_ORDER = [
  'ai-text',
  'ai-image',
  'ai-video',
  'ai-audio',
  'ai-animation',
  'ai-panorama',
  'ai-markdown',
  'ai-storyboard',
  'ai-shotlist',
  'ai-director',
  'plugin-node',
  'source-text',
  'source-image',
  'source-video',
  'source-audio',
  'canvas-note',
  'comment',
  'group',
];

/** 统计卡片里圆点的配色（与小地图无关 —— 官方小地图节点色是统一的灰蓝） */
const DOT_CLASS: Record<string, string> = {
  'ai-text': 'is-text',
  'source-text': 'is-text',
  'ai-image': 'is-image',
  'source-image': 'is-image',
  'ai-storyboard': 'is-image',
  'ai-video': 'is-video',
  'source-video': 'is-video',
  'ai-audio': 'is-audio',
  'source-audio': 'is-audio',
  'ai-animation': 'is-animation',
  'ai-panorama': 'is-panorama',
  'ai-markdown': 'is-markdown',
  'ai-director': 'is-director',
  'ai-shotlist': 'is-shotlist',
  'plugin-node': 'is-plugin',
  'canvas-note': 'is-note',
  group: 'is-group',
};

interface NodeStatsRow {
  key: string;
  label: string;
  count: number;
  dotClass: string;
}

export default function MiniMapNodeStats() {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  // 直接读 React Flow 内部节点，保证统计与小地图渲染的是同一批节点
  const flowNodes = useStore((s) => s.nodes);

  const rows = useMemo<NodeStatsRow[]>(() => {
    const counts = new Map<string, number>();
    for (const node of flowNodes) {
      const type = node.type ?? '';
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    const known = STATS_ORDER.filter((type) => counts.has(type));
    const unknown = [...counts.keys()]
      .filter((type) => !STATS_ORDER.includes(type))
      .sort((a, b) => a.localeCompare(b));
    return [...known, ...unknown].map((type) => ({
      key: type,
      label: getNodeTypeLabel(type),
      count: counts.get(type) ?? 0,
      dotClass: DOT_CLASS[type] ?? 'is-default',
    }));
  }, [flowNodes]);

  const total = flowNodes.length;

  return (
    <div
      className="minimap-stats-zone"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MiniMap
        /* 位置由外层 .minimap-stats-zone 决定（官方：弹在左下控制条正上方，距左 15 / 距下 59） */
        position="bottom-left"
        pannable
        zoomable
        // 置空后 React Flow 不再注入默认 <title>Mini Map</title>，避免悬浮时的原生文字气泡
        ariaLabel=""
        /* 配色**照官方渲染值**（dump 官方小地图 DOM）：
             节点 fill        = rgba(90, 90, 99, 0.5)   ← 官方**不按节点类型分色**，全部同一个灰蓝
             节点 stroke      = rgba(255, 255, 255, 0.6)
             strokeWidth      = 1
             nodeBorderRadius = 4                        ← MTV 原来是 35（超圆）✗
             mask             = fill/stroke 全透明      ← 官方遮罩**不可见**（只靠 evenodd 挖洞）
             本体底色          = rgba(24, 24, 27, 0.92)
           MTV 原来：18 种类型 18 色 ✗ · var(--theme-border) ✗ · rx 35 ✗ · 可见遮罩 + 品牌色描边 ✗ */
        nodeColor="rgba(90, 90, 99, 0.5)"
        nodeStrokeColor="rgba(255, 255, 255, 0.6)"
        nodeStrokeWidth={1}
        nodeBorderRadius={4}
        bgColor="rgba(24, 24, 27, 0.92)"
        /* ★ 视口框（当前可见区域）——
             我上一版把 fill **和 stroke** 都设成 transparent ✗ → 把框弄没了 ✓
             （用户截图竖直中线采样：两条亮线 #2A2A2D，相距 76 design px，正是视口矩形 ✓
               #2A2A2D = 面板底色 #17171A + **rgba(255,255,255,0.1)** ✓）
             官方 mask 的 **fill 确实透明** ✓（源码 maskColor:"transparent" 可证），
             但**描边是可见的** → 这里给 1px rgba(255,255,255,0.1) ✓
             MTV 的 RoundedMiniMapMask 正好负责给这个框做圆角 ✓ */
        maskColor="transparent"
        maskStrokeColor="rgba(255, 255, 255, 0.1)"
        maskStrokeWidth={1}
        style={MINIMAP_STYLE}
      />
      {hovered && (
        <div className="minimap-stats-card" role="tooltip">
          <div className="minimap-stats-card__title">{t('画布节点统计')}</div>
          {rows.length === 0 ? (
            <div className="minimap-stats-card__empty">{t('画布暂无节点')}</div>
          ) : (
            <ul className="minimap-stats-card__list">
              {rows.map((row) => (
                <li key={row.key} className="minimap-stats-card__row">
                  <span className={`minimap-stats-card__dot ${row.dotClass}`} />
                  <span className="minimap-stats-card__label">{t(row.label)}</span>
                  <span className="minimap-stats-card__count">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="minimap-stats-card__total">
            <span>{t('总计')}</span>
            <span className="minimap-stats-card__count">{total}</span>
          </div>
        </div>
      )}
    </div>
  );
}
