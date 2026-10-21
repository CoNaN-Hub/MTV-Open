/**
 * CanvasControlPill 画布左下控制条
 *
 * 版式与图标**逐字对齐 TapNow 官方源码**（zoom-slider-3ZcFvYQO.js，非目测）：
 *
 *   容器 : `relative flex h-10 items-center gap-2 rounded-2xl bg-tap-background-secondary pl-2 pr-3`
 *          → 40 高 · gap 8 · r16 · 内边距 左8 右12
 *          + 内阴影层 `shadow-[inset_0px_0.1px_0.4px_0px_rgba(255,255,255,0.25)]`
 *          · 位置：距画布左 **15px**、距下 **15px**（React Flow Panel bottom-left 默认即 15）
 *
 *   按钮 : EC = "group relative flex size-7 shrink-0 cursor-pointer items-center justify-center
 *                rounded-lg text-[#E6E6E6]"                        → 28×28 · r8 · #E6E6E6
 *   高亮 : _C = "absolute -inset-0.5 rounded-[10px] opacity-0 transition-opacity duration-200
 *                group-hover:opacity-100 group-data-[active]:opacity-100
 *                bg-black/40 backdrop-blur-[56px]
 *                shadow-[0px_4px_16px_rgba(0,0,0,0.16),inset_0px_0.5px_0px_rgba(255,255,255,0.16)]"
 *
 *   ★ 图标切换动画（官方每个按钮都是**两个图标叠放**）：
 *     默认图标 : `transition-opacity duration-200` + `group-hover:opacity-0`
 *     hover图标: `absolute opacity-0 transition-opacity duration-200
 *                 text-tap-text-1 group-hover:opacity-100`（激活态为 opacity-100 text-white）
 *     官方实测两态图标尺寸：map 20→16 / grid 20→18 / focus 20→22
 *
 *   滑条 : 外层 `flex w-[77px] items-center`；thumb =
 *          `h-4 w-4 rounded-full border-2 border-white bg-white shadow-md
 *           transition-transform group-hover:scale-110`；范围 0.15 ~ 2
 *
 * 按钮顺序与功能**照官方**：① 缩略图 ② 连线显隐 ③ 网格吸附 ④ 重置（fitView）
 * 图标全部用官方原文件（src/assets/official-icons/zoom/）。
 */
import { memo, useCallback } from 'react';
import { useReactFlow, useStore, type ReactFlowState } from '@xyflow/react';
import { useT } from '../../i18n';
import { OfficialIcon } from '../sidebar/OfficialIcon';
import OfficialSlider from '../shared/OfficialSlider';

/** 官方滑条区间 `min: Ld.min / max: Ld.max / step: .01`（实测 aria-valuemin=0.15 / aria-valuemax=2） */
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.01;

interface CanvasControlPillProps {
  /** 官方「网格吸附」的开关状态（`snapToGrid`）—— **不是**网格显隐 ✗（官方没有网格显隐）*/
  snapToGrid: boolean;
  minimapVisible: boolean;
  /** 连线是否可见 —— 官方按钮②「隐藏节点连线 / 显示节点连线」的功能 */
  edgesVisible: boolean;
  /** 切换「网格吸附」（官方按钮③ onClick）*/
  onToggleSnap: () => void;
  onToggleMinimap: () => void;
  onToggleEdgesVisible: () => void;
  onOpenHelp: () => void;
}

/** 官方滑条的 `value=[d]` 里 `d` 就是画布**原始缩放**（不是百分比）：
    实测 `aria-valuenow=0.8705505632961259` ⇒ 拇指落位 `(0.8705−0.15)/(2−0.15)=38.9487%` ✓ */
const selectZoom = (state: ReactFlowState) => state.transform[2];

function CanvasControlPill({
  snapToGrid,
  minimapVisible,
  edgesVisible,
  onToggleSnap,
  onToggleMinimap,
  onToggleEdgesVisible,
  onOpenHelp,
}: CanvasControlPillProps) {
  const t = useT();
  const zoom = useStore(selectZoom);
  const { zoomTo, fitView } = useReactFlow();

  /* 缩放逻辑不变：仍然只调 `zoomTo`（官方 `onValueChange:T=>b(T[0])`） */
  const handleZoomChange = useCallback(
    (next: number) => {
      zoomTo(next);
    },
    [zoomTo],
  );

  // 官方「重置」源码：onClick={() => fitView({ duration: 300 })}
  // （MTV 另加 padding/maxZoom，与官方单卡落点一致）
  const handleReset = useCallback(() => {
    void fitView({ padding: 0.2, maxZoom: 2, duration: 300 });
  }, [fitView]);

  /* ⚠️ `data-tooltip-relaxed` 挂在**控制条容器**上（不逐个按钮挂 ✓）：
     官方左下控制条（241×40 那一条）的气泡也走 `qr`(K0) 那套 —— 与全局默认只差 `leading-relaxed`，
     行高 **19.5px** ✓ 出处（逐字 · `zoom-slider-3ZcFvYQO.js`）：
       · 滑条 = `l.jsxs($r,{children:[l.jsx(Kr,{asChild:!0,children:N}),l.jsx(qr,{sideOffset:22,…})]})` ✓
       · 小地图/连线/网格/重置 = `Qg` / `fi({tooltip})` 同一套 `K0` ✓
     规格见 `styles/tooltip.css` 的 `[data-relaxed]` ✓ */
  return (
    <div className="canvas-control-cluster" data-tooltip-relaxed="true">
      <div className="canvas-control-pill">
        {/* ① 缩略图 — 官方 leftSlot（lucide-map 20 → hover 16×15）
            气泡取官方 i18n `minimap.open` / `minimap.close` */}
        <button
          type="button"
          className="canvas-control-item"
          data-active={minimapVisible || undefined}
          aria-pressed={minimapVisible}
          onClick={onToggleMinimap}
          aria-label={minimapVisible ? t('关闭小地图') : t('打开小地图')}
          data-tooltip={minimapVisible ? t('关闭小地图') : t('打开小地图')}
          data-tooltip-pos="top"
        >
          <span className="canvas-control-ico-default">
            <OfficialIcon name="zoom-map" size={20} />
          </span>
          <span className="canvas-control-ico-hover">
            <OfficialIcon name="zoom-map-hover" size={16} />
          </span>
        </button>

        {/* ② 连线显隐 — 官方功能（i18n：hideNodeConnections / showNodeConnections）
            ★ 官方源码是**单图标条件切换**（不是叠放淡出）：
                {edgesVisible ? <$re size={19}/>                          // 可见 → lucide workflow 19
                              : <Kre size={18} className="text-white"/>}  // 隐藏 → lucide unlink-2 18（白色）
              两个图标均已从官方 DOM 抠出（workflow.svg / workflow-hidden.svg）✓
            官方源码 data-active={!f}：**连线被隐藏时按钮呈激活态** */}
        <button
          type="button"
          className="canvas-control-item"
          data-active={(!edgesVisible) || undefined}
          aria-pressed={!edgesVisible}
          onClick={onToggleEdgesVisible}
          aria-label={edgesVisible ? t('隐藏节点连线') : t('显示节点连线')}
          data-tooltip={edgesVisible ? t('隐藏节点连线') : t('显示节点连线')}
          data-tooltip-pos="top"
        >
          <span className="canvas-control-ico-default">
            {edgesVisible ? (
              <OfficialIcon name="zoom-workflow" size={19} />
            ) : (
              <OfficialIcon name="zoom-workflow-hidden" size={18} />
            )}
          </span>
        </button>

        {/* ③ **网格吸附** — 官方 lucide-grid3x3 20 → hover 18×18
            官方气泡 i18n：`canvas.zoomSlider.snapToGrid` =「网格吸附」
            ★ 官方源码是 `data-active={snapToGrid}`（**吸附**状态）✓
            ⚠️ MTV 原来这个按钮接的是「显示/隐藏**背景网格**」✗（用户 2026 要求移除）——
               官方 i18n 里**没有**任何网格显隐的键、也没有这个行为 ⇒ 已改回官方语义 ✓ */}
        <button
          type="button"
          className="canvas-control-item"
          data-active={snapToGrid ? 'true' : undefined}
          aria-pressed={snapToGrid}
          onClick={onToggleSnap}
          aria-label={t('网格吸附')}
          data-tooltip={t('网格吸附')}
          data-tooltip-pos="top"
        >
          <span className="canvas-control-ico-default">
            <OfficialIcon name="zoom-grid" size={20} />
          </span>
          <span className="canvas-control-ico-hover">
            <OfficialIcon name="zoom-grid-hover" size={18} />
          </span>
        </button>

        {/* ④ 重置 — 官方 lucide-focus 20 → hover 22×22 · testid canvas-editor-fit-view-btn
            官方气泡 i18n：`canvas.zoomSlider.reset` =「重置」 */}
        <button
          type="button"
          className="canvas-control-item"
          onClick={handleReset}
          aria-label={t('重置')}
          data-tooltip={t('重置')}
          data-tooltip-pos="top"
          data-testid="canvas-editor-fit-view-btn"
        >
          <span className="canvas-control-ico-default">
            <OfficialIcon name="zoom-focus" size={20} />
          </span>
          <span className="canvas-control-ico-hover">
            <OfficialIcon name="zoom-focus-hover" size={22} />
          </span>
        </button>

        {/* ⑤ 缩放滑条 — 官方外层 `flex w-[77px] items-center`，范围 0.15~2
            官方气泡 i18n：`canvas.zoomSlider.zoomInOut` + 「(Ctrl/⌘ + 滚轮)」，sideOffset 22
            ★ 结构 = 与 Expand 弹窗「素材大小」**同一个** Radix Slider（共享组件 OfficialSlider）；
              官方源码（`page-DVqoHdTT.js`@1595xxx 附近的 `pat`）逐字：
                l.jsx("div",{className:"flex w-[77px] items-center",children:l.jsx(Pd,{
                   className:"w-full", color:"tap-blue", value:[d], min:c.min, max:c.max, step:.01,
                   onValueChange:T=>b(T[0]), onValueCommit:…})})
              ⇒ 轨道 6px / `bg-white/18`、填充纯白、拇指 16×16 白底 + 2px 白边。
              缩放**逻辑与数值**不变：仍然只调 `zoomTo`（d = 画布当前 zoom，step .01 = 1%）。 */}
        <div
          className="canvas-control-slider-wrap"
          /* 官方源码：主文案 + 	ext-xs opacity-70 的副文案（含滚轮图标 <Wre size={14}/>）✓ */
          data-tooltip={t('放大/缩小画布')}
          data-tooltip-label={t('放大/缩小画布')}
          data-tooltip-action={'(Ctrl/⌘ + [[mouse]])'}
          data-tooltip-pos="top"
          /* 官方滑条气泡源码：`<TooltipContent sideOffset={22}>` ✓ */
          data-tooltip-offset="22"
        >
          <OfficialSlider
            className="w-full"
            color="tap-blue"
            value={zoom}
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={ZOOM_STEP}
            onChange={handleZoomChange}
          />
        </div>
      </div>

      {/* 圆形帮助按钮 — 官方在容器**外面**（241 + 12 + 40 = 293 ✓） */}
      <button
        type="button"
        className="canvas-control-help"
        onClick={onOpenHelp}
        aria-label={t('帮助')}
        data-tooltip={t('帮助')}
        data-tooltip-pos="top"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
          <path d="M12 17l0 .01" />
          <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" />
        </svg>
      </button>
    </div>
  );
}

export default memo(CanvasControlPill);
