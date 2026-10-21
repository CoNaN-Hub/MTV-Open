/**
 * SelectionToolbar —— 官方「多选浮动工具栏」（`page-DPdEgTS0.js` @1442137 组件 `Bme`）的 MTV 落地。
 *
 * 官方源码逐字（t978 抽取件）：
 *   const Ume = 56;                                             // ← 工具栏在选区上沿之上 56px（屏幕像素）
 *   const Be = selectedBounds();                                // 选中节点的包围盒（含 parentId 偏移）
 *   const ke = { x: (Be.minX+Be.maxX)/2 * zoom + tx,
 *                y:  Be.minY        * zoom + ty - Ume };
 *   <Portal><motion.div className="absolute z-50" style={{left,top}}
 *       initial={{opacity:0,scale:.8}} animate={{opacity:1,scale:1}}
 *       exit={{opacity:0,scale:.8}} transition={{duration:.15}}>
 *     <div className="w-fit rounded-full flex items-center gap-1 bg-popover/80 backdrop-blur-lg border transform -translate-x-1/2 p-1">
 *       {布局 → O8 下拉(宫格/水平)}  {q&&(He||Ye) && <分隔线/>}
 *       {堆叠} {打组} {加入对话} {图片编辑器} {新建主体}
 *       {He&&Ye && <分隔线/>}
 *       {保存到素材库} {下载全部} {反馈问题}
 *     </div>
 *   </motion.div></Portal>
 *
 * 门控（官方 `Fme` @1441823，逐字）：
 *   d = count>1;  saveToLibrary = d && canSave;  addToChat = d && canAdd && agentAllowed && chatEligible>0;
 *   createPlaylist = canCreate;  group = canGroup;  reportIssue = d && canReport;
 *   shouldShow = 任一为真
 *   ⚠️ 「新建主体」**不在 `Fme` 里**：它的门是 `re = 选中数>1 && se.length>0 && saveToLibrary 权限`
 *      （`page-DPdEgTS0.js`@char1444079，规格 §10；`se = 选中.filter(mme)`）。
 *
 * MTV 能力位（`MTV_CAPS`，见下）：布局 / 堆叠 / 打组 / 加入对话 / 保存到素材库 / 下载全部 = true；
 * 新建主体、图片编辑器 = false（面板/编辑器未接，见常量上的勘误说明）；「创建播放列表」MTV 没有该节点类型与图标
 * ⇒ 不配置；「反馈问题」用户已裁定在卡片菜单里用「在 PS 中打开」顶替 ⇒ false。
 * 按官方的门控语义，能力位为假时**整颗按钮不渲染**。
 *
 * 按钮 DOM 顺序（官方实测，`taskbar-official-report.md` §1）：
 *   布局 | 分隔线 | 堆叠 打组 加入对话 新建主体 | 分隔线 | 保存到素材库 下载全部 反馈问题
 *
 * 位置实测对照：`t98x-mtv-toolbar.png` / 官方 `t980-official-toolbar.png`。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore, type ReactFlowState, type Node as RFNode } from '@xyflow/react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { canLayoutSelection, renderSizeOf, selectionBoundsOf } from '../../utils/officialCanvasLayout';
/* 官方 PILE 的建堆门 `Glt` = `EQ(...) !== null`（`zoom-slider-3ZcFvYQO.js`@2775938 / @2776844） */
import { canCreatePile } from '../../utils/officialPile';
import { isEligibleCharacterReferenceNode } from '../../store/store.dramaAssets';
import { getNodeBounds } from '../../utils/nodeBounds';
import { clampFloatingAnchor } from '../../utils/popupPosition';
/* 圆钮本体 = 官方 `Xm`（`SelectionToolbarButton.tsx`，含 `mse` 光效层与 `gQ` 忙碌 spinner） */
import { ToolbarButton } from './SelectionToolbarButton';
import {
  addSelectionToChat,
  applyOfficialLayout,
  canDownloadSelected,
  canGroupSelected,
  chatEligibleOf,
  downloadSelectedNodes,
  groupSelection,
  saveSelectionToLibrary,
  selectionWithoutGroups,
} from '../../services/selectionToolbarActions';
import type { BaseNodeData } from '../../types';

/** 官方 `Ume = 56`：工具栏底边距选区上沿的屏幕距离 */
const TOOLBAR_OFFSET_Y = 56;

/**
 * 官方选区 `+` 菜单的**估算尺寸**（`page-DPdEgTS0.js` @1437683 逐字）：
 * `x$(P, {width:258, height:297}, {padding:12, marginTop:16, centerX:true, container:{width,height}})`
 */
const SELECTION_MENU_ESTIMATE = { width: 258, height: 297 } as const;
/** 官方 `x$` 的 options（逐字）：padding 12 · marginTop 16 · centerX true · container = `.react-flow` 的 rect */
const SELECTION_ANCHOR_OPTIONS = { padding: 12, marginTop: 16, centerX: true } as const;

/** 官方 `Ce` 里那些**非选择相关**的能力位在 MTV 的取值（改这里就能打开对应按钮） */
const MTV_CAPS = {
  /** 官方 `re`：图片编辑器（需要 ≥2 个「有文件」的节点）。MTV 的多节点编辑器未接 ⇒ false */
  imageEditor: false,
  /**
   * ⚠️ **勘误（本轮修正）**：`createPlaylist` 是官方的**「创建播放列表」**（图标 `Gj`，自研 svg **viewBox 0 0 20 20**，
   * 带角标 `size-2 rounded-full bg-accent-primary`），**不等于「新建主体」**。官方「新建主体」是**另一颗**按钮：
   *   工具条 #4（实测 DOM 顺序里紧挨「加入对话」之后）= `Vv`（自研 svg **viewBox 0 0 18 18**），
   *   tooltip = i18n `elementLibrary.editor.createTitle`，显示条件 `re = 选中数>1 && se.length>0 && saveToLibrary 权限`
   *   （`page-DPdEgTS0.js`@char1444079，规格 §10；`se = 选中.filter(mme)`）。
   * ⇒ 之前把 18×18 那颗图标标成「新建主体 `Gj`」并挂在 `createPlaylist` 能力位上是**错的**：
   *     图标其实是「新建主体」，而 MTV 又把它整颗关掉了。本轮只做**命名/注释勘误 + 图标名改 `createSubject`**，
   *     按钮本身留到「新建主体面板」那一步一起开（避免出现点了没反应的假控件）。
   *   另一颗官方按钮「创建播放列表」(`Gj`)：MTV 没有播放列表节点类型、也没有该图标 ⇒ **不配置、不渲染**。
   */
  createSubject: true,
  /** 官方 `m = d && canUseReportIssue`：反馈问题。MTV 用户裁定用「在 PS 中打开」顶替 ⇒ false */
  reportIssue: false,
  /** 官方 `a = agentAllowed`：加入对话要求 agent 可用。MTV 对话助手常驻可用 ⇒ true */
  agentAllowed: true,
} as const;

/** 稳定空数组：没有多选时不订阅 nodes，避免拖拽期间每帧重渲染 */
const EMPTY_NODES: RFNode<BaseNodeData>[] = [];

/* 按钮本体（官方 `Xm` / `mse` / `gQ`）已抽到同目录 `SelectionToolbarButton.tsx`：那颗钮是纯展示的，
   单独成文件才能在 node 环境里做单测（见 tests/components/selectionToolbarButton.test.tsx）。 */
/** 官方「布局」下拉（`O8`，`triggerVariant="toolbar"`）：两项 = 宫格布局 / 水平布局 */
function LayoutButton({ onPick }: { onPick: (mode: 'grid' | 'horizontal') => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (wrapRef.current && target instanceof Element && wrapRef.current.contains(target)) return;
      /* 菜单 portal 到 body ⇒ 不在 wrap 里，必须显式放行，否则 pointerdown 会先卸载菜单、
         后面的 click 打不到菜单项（这正是官方 radix 自己处理的那件事）。 */
      if (target instanceof Element && target.closest('.selection-layout-menu')) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    /* 官方 radix `align="start" side="bottom"`：左边缘对齐触发钮、向下展开。
       间距 = 官方那份 `Ga`(`DropdownMenuContent`) 的 **`sideOffset: 4`**（规格 §3 逐字；
       ⚠️ radix 自身默认是 0，是官方显式给的 4）—— MTV 原来写 `+1`，比官方贴得近 ✗ */
    const rect = triggerRef.current?.getBoundingClientRect();
    setAnchor(rect ? { left: rect.left, top: rect.bottom + 4 } : null);
    setOpen(true);
  };

  return (
    <div ref={wrapRef} className="selection-layout-wrap">
      {/* 官方「布局」触发器（`zoom-slider-3ZcFvYQO.js`@char2876782 逐字）：
            `l.jsx(Xm,{tooltip:e("common.layout"), onClick:()=>{}, preventEvent:!1, children:<QO size={16}/>})`
          —— 就是**同一颗 `Xm`**，只是 Radix 的 DropdownMenuTrigger 负责开合，官方自己的 handler 是空函数。
          ⚠️ `preventEvent:!1` 是给 Radix 让路用的；MTV 是手写下拉，必须保留 stopPropagation，
             否则画布会把这次点击当成「点空白」而清空选区。 */}
      <ToolbarButton
        buttonRef={triggerRef}
        icon="layout"
        tooltip={t('布局')}
        ariaHasPopup="menu"
        ariaExpanded={open}
        onClick={toggle}
      />
      {open && anchor && createPortal(
        <div
          className="selection-layout-menu"
          role="menu"
          style={{ left: anchor.left, top: anchor.top }}
          onClick={(event) => event.stopPropagation()}
        >
          {([
            { mode: 'grid' as const, label: t('宫格布局') },
            { mode: 'horizontal' as const, label: t('水平布局') },
          ]).map((item) => (
            <button
              key={item.mode}
              type="button"
              role="menuitem"
              className="selection-layout-item"
              onClick={() => { onPick(item.mode); close(); }}
            >
              <SelectionLayoutMenuIcon mode={item.mode} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** 官方菜单项图标：宫格 = tabler `layout-grid`，水平 = tabler `sitemap` + `-rotate-90`（18×18） */
function SelectionLayoutMenuIcon({ mode }: { mode: 'grid' | 'horizontal' }) {
  if (mode === 'grid') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
        <path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
        <path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
        <path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
      <path d="M3 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
      <path d="M15 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
      <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
      <path d="M6 15v-4a1 1 0 0 1 1 -1h10a1 1 0 0 1 1 1v4" />
      <path d="M12 10v-3" />
    </svg>
  );
}

/**
 * ★ 官方「选区右侧那个灰底白 +」（`page-DPdEgTS0.js` @1437683 逐字）：
 * ```
 * {C && !p && !y && (
 *   <div className="pointer-events-auto absolute z-50 flex cursor-crosshair items-center justify-center"
 *        style={{ left: C.x, top: C.y, transform: 'translate(12px, -50%)' }} onMouseDown={I}>
 *     <div className="flex size-5 items-center justify-center rounded-full bg-muted-foreground">
 *       <Ds size={16} className="stroke-2 text-white" />      // tabler plus
 *     </div>
 *   </div>
 * )}
 * ```
 * 位置：`left = 选区 maxX*zoom + tx`、`top = (minY+maxY)/2*zoom + ty`（再 `translate(12px,-50%)`）。
 * 交互：`onMouseDown` 进入拖拽（`+` 跟随光标）→ `mouseup` 在松手点打开 `wme` 多选生成菜单。
 *
 * ★ 官方 `I`（`page-DPdEgTS0.js` @1437683 逐字）:
 * ```
 * const I = k => { k.preventDefault(); k.stopPropagation(); if (!i) return;
 *   const j = N();                                   // N() = .react-flow 的 rect
 *   h(true); g({ x: k.clientX - j.left, y: k.clientY - j.top });   // 拖拽中：光标点（容器相对）
 *   const A = M => { const L = N(); g({ x: M.clientX - L.left, y: M.clientY - L.top }); };
 *   const D = M => {
 *     remove listeners; h(false);                    // 拖拽结束
 *     const L = N(), P = { x: M.clientX - L.left, y: M.clientY - L.top };
 *     const R = x$(P, {width:258,height:297}, {padding:12,marginTop:16,centerX:true,
 *                   container:{width:L.width,height:L.height}});
 *     w(R); g(R); x(true);                           // 锚点 = 钳制后的点（+ 也停在锚点上）
 *   };
 *   window.addEventListener('mousemove', A); window.addEventListener('mouseup', D);
 * }
 * ```
 * ⚠️ 注意坐标系：官方全程用**容器相对**坐标（比 client 坐标少一个 `.react-flow` 的 rect 偏移），
 *    因为那条白线 SVG 是 `absolute inset-0` 铺在画布容器里的 ✓（MTV 的 Portal 也挂在 `domNode` 上 ✓）。
 * ⚠️ MTV 原来只把 `+` 自己用 `translate` 拖着走 ✗（官方是**灰底白 + 消失、换成 SVG 里的白色圆+加号**）✓
 */
function SelectionPlusButton({
  x, y, dragging, onDragStart, onDragMove, onDragEnd,
}: {
  x: number;
  y: number;
  /**
   * 是否正在拖拽 —— 官方 `{C && !p && !y && <div …/>}`：拖拽中与菜单已打开时**这颗灰底 + 都不渲染**
   * （此时屏幕上只有 SVG 里的白色圆 + 白色曲线）。
   */
  dragging: boolean;
  onDragStart: (point: { x: number; y: number }) => void;
  onDragMove: (point: { x: number; y: number }) => void;
  onDragEnd: (point: { x: number; y: number }) => void;
}) {
  /**
   * ⚠️ 监听器必须在 `mousedown` 里直接挂（官方 `I` 就是这么写的）——
   *    若放到 `useEffect` 里靠 `dragRef` 判断，ref 变更**不触发重渲染** ⇒ effect 不会重跑 ⇒ 监听器永远不挂上
   *    （第一版就是这么写的，实测「点选区的 + 没有反应」）。
   */
  const onMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const container = document.querySelector('.react-flow')?.getBoundingClientRect();
    const origin = container ?? new DOMRect();
    const toLocal = (clientX: number, clientY: number) => ({
      x: clientX - origin.left,
      y: clientY - origin.top,
    });
    onDragStart(toLocal(event.clientX, event.clientY));
    const onMove = (moveEvent: MouseEvent) => {
      onDragMove(toLocal(moveEvent.clientX, moveEvent.clientY));
    };
    const onUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onDragEnd(toLocal(upEvent.clientX, upEvent.clientY));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (dragging) return null;

  return (
    <div
      className="absolute z-50 flex cursor-crosshair items-center justify-center pointer-events-auto"
      style={{ left: x, top: y, transform: 'translate(12px, -50%)' }}
      onMouseDown={onMouseDown}
      data-testid="canvas-selection-plus"
    >
      <div
        /* 官方内圆是 `bg-muted-foreground`，而官方根变量 `--muted-foreground` = **#7a7a7a**
           （t1144 实测：`getComputedStyle(:root).getPropertyValue('--muted-foreground')`）。
           ⚠️ MTV **没有**这个设计令牌 ⇒ Tailwind 的 `bg-muted-foreground` 计算值是
              `rgba(0, 0, 0, 0)`（全透明）⇒ 灰底白 + 变成「只有白色加号悬在画布上」✗
              （用户截图反馈：「右侧 + 按钮也不对」✓）
           ⇒ 按 MTV 既有约定写 `var(--muted-foreground, #7a7a7a)`（见 `nodes-text.css:118`）✓ */
        className="flex size-5 items-center justify-center rounded-full"
        style={{ background: 'var(--muted-foreground, #7a7a7a)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" className="stroke-2 text-white" aria-hidden="true">
          <path d="M12 5l0 14" />
          <path d="M5 12l14 0" />
        </svg>
      </div>
    </div>
  );
}

/**
 * ★ 官方「拖拽 `+` 时铺在画布上的那条 SVG」（`page-DPdEgTS0.js` @1437683 逐字）：
 * ```
 * {(p || y) && m && (
 *   <svg className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible">
 *     {E.map(k => {
 *       const j = m.x - k.x, A = k.x + j * .5, D = m.x - j * .5;
 *       return <path d={`M ${k.x} ${k.y} C ${A} ${k.y}, ${D} ${m.y}, ${m.x} ${m.y}`}
 *                    stroke="white" strokeWidth="1.4" fill="none" className="opacity-40" />;
 *     })}
 *     <circle cx={m.x} cy={m.y} r={10} fill="white" />
 *     <text x={m.x} y={m.y} textAnchor="middle" dominantBaseline="central"
 *           fontSize="20px" fontWeight="300" fill="currentColor"
 *           className="translate-y-[-1px] text-zinc-600" style={{ userSelect: 'none' }}>+</text>
 *   </svg>
 * )}
 * ```
 * `E`（`useMemo`，@1437683 逐字）＝ **每个选中节点的右边缘中点**：
 *   `{ x: (M.x + ln(D)) * zoom + tx, y: (M.y + bs(D) / 2) * zoom + ty }`（`M = 绝对流坐标`）
 * 可见条件 `p || y`：**拖拽中就画**（线跟着光标走），松手后菜单开着时**继续留着** ✓
 */
function SelectionConnectorCurves({
  points, target,
}: {
  points: readonly { id: string; x: number; y: number }[];
  target: { x: number; y: number } | null;
}) {
  if (!target) return null;
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
      data-testid="canvas-selection-curves"
    >
      {points.map((point) => {
        const dx = target.x - point.x;
        const c1x = point.x + dx * 0.5;
        const c2x = target.x - dx * 0.5;
        return (
          <path
            key={point.id}
            d={`M ${point.x} ${point.y} C ${c1x} ${point.y}, ${c2x} ${target.y}, ${target.x} ${target.y}`}
            stroke="white"
            strokeWidth="1.4"
            fill="none"
            className="opacity-40"
          />
        );
      })}
      <circle cx={target.x} cy={target.y} r={10} fill="white" />
      <text
        x={target.x}
        y={target.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="20px"
        fontWeight="300"
        fill="currentColor"
        className="translate-y-[-1px] text-zinc-600"
        style={{ userSelect: 'none' }}
      >
        +
      </text>
    </svg>
  );
}

function SelectionToolbar({
  onOpenSelectionMenu,
  selectionMenuOpen = false,
}: {
  /** 松手时在**钳制后的锚点**（client 坐标）打开官方 `wme` 多选生成菜单 */
  onOpenSelectionMenu?: (point: { x: number; y: number }) => void;
  /** 多选生成菜单当前是否开着 —— 官方 `y`：菜单关掉时把锚点/曲线一起收掉 ✓ */
  selectionMenuOpen?: boolean;
}) {
  const t = useT();
  const openElementEditor = useAppStore((s) => s.openElementEditor);
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds);
  /* 官方只有「≥2 个选中」时工具栏才可能出现（所有能力位都带 count>1）⇒ 单选时不订阅 nodes */
  const nodes = useAppStore((s) => (s.selectedNodeIds.length >= 2 ? s.nodes : EMPTY_NODES));
  const transform = useStore((s: ReactFlowState) => s.transform);
  const domNode = useStore((s: ReactFlowState) => s.domNode);
  const [busy, setBusy] = useState(false);
  /* ★ 官方 `Ame` 的两个状态：`p` = 拖拽中、`y` = 菜单已开 —— 两者都画白色曲线；
       `m` = 光标点 / 钳制后的锚点（**容器相对坐标**，与那条 `absolute inset-0` 的 SVG 同坐标系） */
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  const [tx, ty, zoom] = transform;

  const selected = useMemo(
    () => nodes.filter((node) => selectedNodeIds.includes(node.id)),
    [nodes, selectedNodeIds],
  );

  /** 官方 `Be`：选中节点包围盒（`Bi(...,0)`）——位置含 parentId 偏移、尺寸取真实渲染尺寸 */
  const bounds = useMemo(
    () => (selected.length === 0 ? null : selectionBoundsOf(selected, nodes)),
    [selected, nodes],
  );

  /** 官方 `Ce`（`Fme`）—— MTV 能力位 */
  const caps = useMemo(() => {
    const list = selectionWithoutGroups(selected);
    const count = list.length;
    const multi = count > 1;
    const layout = canLayoutSelection(list);
    const group = canGroupSelected();
    /* 官方 `V`（堆叠）= `E.enabled && selectionToolbar.allowedItems.includes("pile")
       && mergedPolicy.nodes.allowedCreateTypes.includes("PILE")
       && E.canCreateFromSelection(m)`（`page-DPdEgTS0.js`@1442908 / @1443700）。
       MTV 没有远端策略 ⇒ 前三个条件恒真，**只保留最后一个** —— 也就是官方 `Glt` = `EQ(...) !== null`。
       ⚠️ 传的是**原始选中 id**（不是 `selectionWithoutGroups` 的结果）：官方 `EQ` 会自己
       **整块跳过 GROUP**，而其余选中的普通节点仍然计数（旧实现「选区里含分组就整个禁用」是错的）。 */
    const pile = canCreatePile(nodes, selectedNodeIds, {}, (node) => renderSizeOf(node, nodes));
    const chatEligible = chatEligibleOf(list);
    const addToChat = multi && MTV_CAPS.agentAllowed && chatEligible.length > 0;
    const imageEditor = MTV_CAPS.imageEditor && multi;
    /* 官方 `re = 选中数>1 && 可捕数>0 && saveToLibrary 权限`（规格 §10）。
       MTV 的「可捕」= `isEligibleCharacterReferenceNode`（图/视频类且有 imageUrl|thumbnailUrl）；
       权限位 MTV 没有画布策略系统 ⇒ 用 `multi` 兜（与 saveToLibrary 同一口径）。 */
    const subjectEligibleIds = list.filter((node) => isEligibleCharacterReferenceNode(node)).map((node) => node.id);
    const createSubject = MTV_CAPS.createSubject && multi && subjectEligibleIds.length > 0;
    const ids = list.map((n) => n.id);
    const saveToLibrary = multi;
    const downloadAll = multi && canDownloadSelected(ids);
    const reportIssue = multi && MTV_CAPS.reportIssue;
    const firstSection = pile || group || addToChat || imageEditor || createSubject;
    const secondSection = saveToLibrary || downloadAll || reportIssue;
    return {
      layout, pile, group, addToChat, imageEditor, createSubject,
      subjectEligibleIds,
      saveToLibrary, downloadAll, reportIssue,
      firstSection, secondSection,
      visible: layout || firstSection || secondSection,
    };
  }, [selected, nodes, selectedNodeIds]);

  /** 官方 `ke`：`x = 中心 * zoom + tx`、`y = minY * zoom + ty - Ume`（内层再 `-translate-x-1/2`） */
  const position = useMemo(() => {
    if (!bounds) return null;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    return {
      x: centerX * zoom + tx,
      y: bounds.minY * zoom + ty - TOOLBAR_OFFSET_Y,
    };
  }, [bounds, zoom, tx, ty]);

  /** 同步动作直接执行；返回 Promise 的动作（保存/下载）走「下载中」忙碌态（官方 `we()` 的 `y(true)`） */
  const run = useCallback((action: () => unknown) => {
    const result = action();
    if (!result || typeof (result as Promise<unknown>).then !== 'function') return;
    setBusy(true);
    void (result as Promise<unknown>).finally(() => setBusy(false));
  }, []);

  /** 官方 `C`：`{ x: 选区 maxX*zoom + tx, y: (minY+maxY)/2*zoom + ty }`（再 `translate(12px,-50%)`） */
  const plusPosition = useMemo(() => {
    if (!bounds) return null;
    return {
      x: bounds.maxX * zoom + tx,
      y: ((bounds.minY + bounds.maxY) / 2) * zoom + ty,
    };
  }, [bounds, zoom, tx, ty]);

  /**
   * 官方 `E`（@1437683 逐字）＝ **每个选中节点的右边缘中点**，容器相对屏幕坐标：
   * ```js
   * for (const A of s) { const D = k.get(A); const M = U1(D, k);   // U1 = 绝对流坐标（含 parentId）
   *   j.push({ id: `${D.id}-connection`,
   *            x: (M.x + ln(D)) * f + d,                          // ln = 宽
   *            y: (M.y + bs(D) / 2) * f + u }); }                 // bs = 高
   * ```
   */
  const connectionPoints = useMemo(() => {
    if (selected.length === 0) return [] as { id: string; x: number; y: number }[];
    const all = nodes as RFNode<BaseNodeData>[];
    return selected.map((node) => {
      const origin = getNodeBounds(node, all);
      const size = renderSizeOf(node, all);
      return {
        id: `${node.id}-connection`,
        x: (origin.x + size.width) * zoom + tx,
        y: (origin.y + size.height / 2) * zoom + ty,
      };
    });
  }, [selected, nodes, zoom, tx, ty]);

  /* 官方 `y` 收尾：菜单一关，锚点与曲线一起收掉 ✓
     ⚠️ 不用 `useEffect` 里 setState（eslint `react-hooks/set-state-in-effect` 会报错，
        而且那会多一次级联渲染）—— 直接把「菜单是否开着」并进**取值**：
        菜单没开 ⇒ 锚点视作不存在 ⇒ 白曲线/白圆消失、灰底 `+` 回来（官方 `y=false` 的语义 ✓）
        `mousedown` 时 `setMenuAnchor(null)` 只是清陈旧值，保证松手必然写新锚点 ✓ */
  const activeAnchor = selectionMenuOpen ? menuAnchor : null;

  const handlePlusDragStart = useCallback((point: { x: number; y: number }) => {
    setDragPoint(point);
    setMenuAnchor(null);
  }, []);
  const handlePlusDragMove = useCallback((point: { x: number; y: number }) => {
    setDragPoint(point);
  }, []);
  const handlePlusDragEnd = useCallback((point: { x: number; y: number }) => {
    setDragPoint(null);
    /* 官方 `D`：`R = x$(P, {width:258,height:297}, {padding:12,marginTop:16,centerX:true,
         container:{width:L.width,height:L.height}})` —— 容器就是 `.react-flow` 的 rect ✓ */
    const rect = domNode?.getBoundingClientRect();
    const anchor = clampFloatingAnchor(point, SELECTION_MENU_ESTIMATE, {
      ...SELECTION_ANCHOR_OPTIONS,
      container: {
        width: rect?.width ?? window.innerWidth,
        height: rect?.height ?? window.innerHeight,
      },
    });
    setMenuAnchor(anchor);
    onOpenSelectionMenu?.({ x: (rect?.left ?? 0) + anchor.x, y: (rect?.top ?? 0) + anchor.y });
  }, [domNode, onOpenSelectionMenu]);

  if (!domNode) return null;

  const showToolbar = Boolean(caps.visible && position);
  const showPlus = selected.length >= 2 && Boolean(plusPosition) && Boolean(onOpenSelectionMenu);
  /* 官方 `{C && !p && !y && <灰底 + />}`：拖拽中 / 菜单已开 ⇒ 灰底 + 不渲染（改由 SVG 里的白色圆+加号表示） */
  const curveTarget = dragPoint ?? activeAnchor;
  if (!showToolbar && !(showPlus || curveTarget)) return null;

  return createPortal(
    <>
      {showToolbar && (
      <AnimatePresence>
        <motion.div
          key="selection-toolbar"
          /* 官方外层定位容器类名**逐字**：`absolute z-50`（`page-DPdEgTS0.js`@char1446132）
             ⚠️ MTV 原来多挂了一条 `transform-origin: center bottom`（.selection-toolbar-anchor）——
                官方源码里**没有**任何 transform-origin ⇒ 用默认 `50% 50%`（中心）缩放。已删。 */
          className="absolute z-50"
          style={{ left: position!.x, top: position!.y }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
        >
        {/* 官方外壳类名**逐字**（`page-DPdEgTS0.js`@char1446342）：
              `w-fit rounded-full flex items-center gap-1 bg-popover/80 backdrop-blur-lg
               border transform -translate-x-1/2 p-1`
            ⚠️ MTV 缺的 token **就地补**（照规格 §0 的官方 token 表），能照抄的类名一律照抄：
              · `bg-popover/80`：MTV 是 Tailwind **v3**、`theme.colors` 里没有 `popover` 这个色阶
                ⇒ `.bg-popover\/80` **根本不会被生成**（已在开发服务器里核对：样式表里查不到该规则），
                  照抄一个死类名只会误导 ⇒ 把它换成内联的**官方 CSS 生成的那一条**（规格 §0.2 逐字）：
                  `color-mix(in oklab, var(--popover) 80%, transparent)`，token 就地补 `#262626` 兜底；
                  （之所以不往 tailwind.config.js 里加 `popover` 色阶：那样会**顺带**让全仓 21 处
                    现在不生效的 `border-border`、以及 `bg-muted` / `bg-accent` / `text-foreground` 等
                    突然开始生效，属于本轮之外的连带改动。）
              · `backdrop-blur-lg`：MTV 是 Tailwind v3，`backdrop-blur-lg` 默认就是 **16px**
                = 官方 `--blur-lg`（规格 §0 表）⇒ **直接照抄类名**，不写内联；
              · `border` 的颜色：官方没有 `.border-border`（只有 `.!border-border`），实际靠全局
                `*{border-color:var(--border)}` 兜底 = `#ffffff1a` ⇒ 内联 `var(--border, #ffffff1a)`；
              · 文字色：官方变量表 `--foreground: #f5f5f5`（原 `.selection-floating-toolbar` 写死的 #f5f5f5）。
            ⚠️ 气泡的**间距与延迟挂在容器上**（`hooks/useTooltipAutoPlacement` 用 `closest()` 读容器）：
              官方 `P9e` 默认 `sideOffset: 8` / `delayDuration: 200`（规格 §8 逐字）；
              MTV 原来两个都没挂 ⇒ 落到原语默认 **4px / 300ms**（用户：「气泡贴太近、出现太慢」）。
            🗒 `.selection-floating-toolbar` 这个类**保留**，但已不承载几何/配色，只当作用域钩子
              （分隔线的 `mx-1` 与浅色主题覆写要按容器收窄，见 `styles/nodes.css`）。 */}
        <div
          className="selection-floating-toolbar w-fit rounded-full flex items-center gap-1 backdrop-blur-lg border transform -translate-x-1/2 p-1"
          style={{
            background: 'color-mix(in oklab, var(--popover, #262626) 80%, transparent)',
            borderColor: 'var(--border, #ffffff1a)',
            color: 'var(--foreground, #f5f5f5)',
          }}
          data-tooltip-offset="8"
          data-tooltip-delay="200"
          data-testid="canvas-selection-toolbar"
        >
          {caps.layout && <LayoutButton onPick={(mode) => run(() => applyOfficialLayout(mode))} />}
          {caps.layout && (caps.firstSection || caps.secondSection) && <div className="ftb-divider" />}

          {caps.pile && (
            <ToolbarButton
              icon="pile"
              tooltip={t('堆叠')}
              onClick={() => run(() => {
                /* 官方 `Te`@1444658 → `E.createFromSelection(m)` → `pqe`@2776891（建真 PILE 节点） */
                useAppStore.getState().pileSelectedNodes();
              })}
            />
          )}
          {caps.group && (
            <ToolbarButton icon="group" tooltip={t('打组')} onClick={() => run(() => groupSelection())} />
          )}
          {caps.addToChat && (
            <ToolbarButton icon="addToChat" tooltip={t('加入对话')} onClick={() => run(() => addSelectionToChat())} />
          )}
          {/* 官方「新建主体」（`Vv`，18×18；tooltip `elementLibrary.editor.createTitle`）。
              门 = `re = 选中数>1 && 可捕数>0 && saveToLibrary 权限`（`page-DPdEgTS0.js`@char1444079，规格 §10）：
              MTV 的「可捕」= `isEligibleCharacterReferenceNode`（图/视频类且有 imageUrl|thumbnailUrl）。 */}
          {caps.createSubject && (
            <ToolbarButton
              icon="createSubject"
              tooltip={t('新建主体')}
              onClick={() => openElementEditor(caps.subjectEligibleIds)}
            />
          )}

          {caps.firstSection && caps.secondSection && <div className="ftb-divider" />}

          {caps.saveToLibrary && (
            <ToolbarButton
              icon="saveToLibrary"
              tooltip={t('保存到素材库')}
              onClick={() => run(() => saveSelectionToLibrary())}
            />
          )}
          {caps.downloadAll && (
            <ToolbarButton
              icon="downloadAll"
              tooltip={t('下载全部')}
              busy={busy}
              onClick={() => run(() => downloadSelectedNodes())}
            />
          )}
          {caps.reportIssue && (
            <ToolbarButton icon="reportIssue" tooltip={t('反馈问题')} onClick={() => undefined} disabled dataTestId="canvas-feedback-toolbar-report-btn" />
          )}
        </div>
        </motion.div>
      </AnimatePresence>
      )}
      {showPlus && (
        <SelectionPlusButton
          x={plusPosition!.x}
          y={plusPosition!.y}
          dragging={dragPoint !== null || activeAnchor !== null}
          onDragStart={handlePlusDragStart}
          onDragMove={handlePlusDragMove}
          onDragEnd={handlePlusDragEnd}
        />
      )}
      {/* 官方把这条 SVG 和上面的 `+` 并排渲染（`+` z-50、SVG z-10）⇒ 顺序无关，但保持官方写法 */}
      {curveTarget && (
        <SelectionConnectorCurves points={connectionPoints} target={curveTarget} />
      )}
    </>,
    domNode,
  );
}

export default memo(SelectionToolbar);
