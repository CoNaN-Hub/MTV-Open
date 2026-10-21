/**
 * PileNode —— 官方 **PILE（堆叠）节点渲染器** `uJe` 的移植。
 *
 * 官方出处：`zoom-slider-3ZcFvYQO.js`@char2983735…@2987591，注册于
 * `[he.PILE]: h.memo(uJe)`（@3390539）。完整抽取见 `D:\DEEPSEEK\official-pile-spec.md` §5。
 *
 * 官方结构（§5.2 / §5.3 / §5.5，类名与内联 style 逐字）：
 * ```jsx
 * <div role="button" tabIndex={V?0:-1} aria-disabled={!V}
 *      aria-label={t("pile.nodeLabel",{count})} aria-haspopup="dialog" data-pile-node={id}
 *      className="group relative size-full outline-none">
 *   <QZe>                                  // 工具条桥（38px）+ 缩放层，内部用官方 `eT` 浮层
 *     <aJe nodeId displayMembers canEdit shouldShow onUnpile />
 *   </QZe>
 *   <div className="relative size-full">   // 成员列表（画廊开 / 解堆中 ⇒ 追加 invisible）
 *     {members.map(m => <motion.div className="pointer-events-none absolute left-1/2 top-1/2 origin-center"
 *        style={{width,height,marginLeft:-w/2,marginTop:-h/2,zIndex}} />)}
 *     {_.length===0 && <div className="…h-[196px] w-32…">{t("pile.empty")}</div>}
 *   </div>
 * </div>
 * ```
 * **没有 React-Flow `<Handle>`**（§5.4）—— 连线由投影层留下的成员锚点承担。
 *
 * ★ 摆位数值全部来自 `utils/officialPile.ts`（官方 `yG` / `xG` / `fO` / `qM` / `wC`）。
 * ★ 浮层用 `NodeToolbarShell`（= 官方 `eT`，`QZe` 内部用的就是它）。
 * ★ 出现门 `rJe`：`canInteract && (hover || focus) && !dragging && !isEntryActive`，
 *   hover 收起延迟 `sJe = 200ms`。
 *
 * ⚠️ 成员预览内容：官方预览 `TT`（`h.memo(YZe)`@2937830）依赖 `OYe` 的 `display` 模型与
 *   图/视频/音频/文本四套子渲染器，**本轮未逐字移植**；这里按 MTV 自己的节点数据渲染同一份媒体
 *   （图/视频用 `imageUrl|videoUrl`，其余给空底）。**类名 / 几何 / 尺寸 / 层级 / 旋转全部来自官方**，
 *   只有「预览里画什么」这一层是 MTV 内容。已记账。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeProps, ReactFlowState } from '@xyflow/react';
import { useStore, useReactFlow } from '@xyflow/react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import {
  PILE_RENDER_CLASSES,
  PILE_TOOLBAR_BRIDGE_HEIGHT,
  PILE_TOOLBAR_BRIDGE_TOP,
  PILE_TOOLBAR_HIDE_DELAY,
  PILE_GALLERY_INITIAL_ZOOM,
  pileDisplaySize,
  pileLastFive,
  pileMemberIds,
  pilePreviewExpansion,
  pileStackLayers,
} from '../../utils/officialPile';
import { renderSizeOf } from '../../utils/officialCanvasLayout';
import {
  addSelectionToChat,
  canDownloadSelected,
  downloadNodesByIds,
  saveSelectionToLibrary,
} from '../../services/selectionToolbarActions';
import { motion } from 'framer-motion';
import NodeToolbarShell from './shared/NodeToolbarShell';
import { usePileToolbarOwnership } from '../../hooks/usePileToolbarOwnership';
import PileNodeToolbar from './PileNodeToolbar';
import PileMemberPreview from './PileMemberPreview';
import { pilePreviewContentOf } from '../../utils/officialPilePreviewContent';
import { usePileGallery } from './pileGalleryContext';
import { gallerySourceGeometryOf } from '../../utils/officialPileGallery';

/** 官方成员预览 `TT`（`h.memo(YZe)`）—— 见 `PileMemberPreview.tsx` */
type CanvasNode = ReturnType<typeof useAppStore.getState>['nodes'][number];

function PileMemberPreviewLayer({ node, size }: { node: CanvasNode; size: { width: number; height: number } }) {
  const content = pilePreviewContentOf(node, size, 1);
  const loading = (node.data as unknown as { status?: string })?.status === 'loading';
  return <PileMemberPreview content={content} status={{ kind: loading ? 'loading' : 'ready' }} />;
}

/** 官方 `ms.gallery.mediaPreview`… 不适用于此；下面是**堆叠入场动画**的官方常量。
 *
 * `zoom-slider-3ZcFvYQO.js`@2922576 逐字：
 * ```js
 * yu = [.16, 1, .3, 1];        // 旋转缓动
 * Bh = [.65, 0, .35, 1];       // 位移缓动
 * ms.stack.entry = { movementDurationSeconds:.46, movementEase:Bh,
 *                    rotationDurationSeconds:.28, rotationDelaySeconds:.16, rotationEase:yu,
 *                    staggerStepSeconds:.018, maxStaggerItems:5 }
 * ms.stack.reflow = { durationSeconds:.34, ease:Bh }
 * ```
 * 官方 `WG(e)`（@2982548）按 key 生成过渡：
 *   `x/y/scale/opacity` 用 `movementDurationSeconds` + `movementEase`，
 *   `rotate` 用 `rotationDurationSeconds` 且**再晚 `rotationDelaySeconds`**。
 * 官方 `lJe(e,t,n,s)`：有计划时 `{initial:start, animate:t, transition:WG(s)}`，
 *   没有计划时 `{initial:false, animate:t, transition:reflow}`。
 * 官方 `VYe` 的 `origins` 起点 = `{x:0, y:0, scale:1, rotate:0}`（即**从堆叠中心直立展开**）。
 */
const PILE_ENTRY_ORIGIN = { x: 0, y: 0, scale: 1, rotate: 0 };
const PILE_MOVEMENT_DURATION_S = 0.46;
const PILE_ROTATION_DURATION_S = 0.28;
const PILE_ROTATION_DELAY_S = 0.16;
const PILE_MOVEMENT_EASE = [0.65, 0, 0.35, 1] as const;
const PILE_ROTATION_EASE = [0.16, 1, 0.3, 1] as const;

/** 官方 `WG(delay)` 的逐 key 过渡表 */
const PILE_REFLOW_DURATION_S = 0.34;
/** 官方 `ms.stack.reflow = { durationSeconds:.34, ease:Bh }` —— 入场结束后的重排（悬浮展开/收起） */
function pileLayerTransition(delaySeconds: number) {
  const movement = { duration: PILE_MOVEMENT_DURATION_S, delay: delaySeconds, ease: PILE_MOVEMENT_EASE };
  return {
    x: movement,
    y: movement,
    scale: movement,
    opacity: movement,
    rotate: {
      duration: PILE_ROTATION_DURATION_S,
      delay: delaySeconds + PILE_ROTATION_DELAY_S,
      ease: PILE_ROTATION_EASE,
    },
  };
}

/** 官方 `PILE_STACK_OFFSETS`… 见 `utils/officialPile.ts`。这里只做逐层延迟。 */
export interface PileLayerDelayInput {
  animationIndex: number;
}

/** 官方 `ms.stack.entry` 的 stagger：`staggerStepSeconds × min(index, maxStaggerItems)` */
const PILE_STAGGER_STEP_S = 0.018;
const PILE_MAX_STAGGER_ITEMS = 5;
function pileEntryDelaySeconds(index: number): number {
  return PILE_STAGGER_STEP_S * Math.min(Math.max(index, 0), PILE_MAX_STAGGER_ITEMS);
}

export default function PileNode({ id, dragging }: NodeProps) {
  const t = useT();
  const nodes = useAppStore((s) => s.nodes);
  const setSelectedNodeIds = useAppStore((s) => s.setSelectedNodeIds);
  const unpileSelectedNodes = useAppStore((s) => s.unpileSelectedNodes);
  /* 官方 `uJe`：`const s = h.useRef(null)`（根节点 ref）、`{getViewport:i} = Rt()`、`{session:m, openGallery:g} = _J()` */
  const rootRef = useRef<HTMLDivElement>(null);
  const { getViewport } = useReactFlow();
  const { session, openGallery } = usePileGallery();

  const sizeOf = useCallback(
    (node: Parameters<typeof renderSizeOf>[0]) => renderSizeOf(node, nodes as never),
    [nodes],
  );

  const memberIds = useMemo(() => {
    const pile = nodes.find((n) => n.id === id);
    return pileMemberIds(pile as never);
  }, [nodes, id]);

  const members = useMemo(
    () => memberIds.map((mid) => nodes.find((n) => n.id === mid)).filter(Boolean) as typeof nodes,
    [memberIds, nodes],
  );

  /** 官方 `_l`：只有**最后 5 个**参与封面尺寸与正面那摞 */
  const visibleMembers = useMemo(() => pileLastFive(members), [members]);

  /* 官方 `stt`@3009200 逐字：`M = _[0]`、`k = M?.displaySize ?? null`。
     ⚠️ 封面尺寸（`fO` 的 `coverSize`）取 **`_`（最后 ≤5 个）里第 0 个**成员的显示尺寸 ——
        不是「最后 5 个的并集」。并集是**堆叠节点自身尺寸**用的官方 `NO`（`Fg`/`kg`），
        两者不是一个量。 */
  const cover = useMemo(
    () => (visibleMembers.length === 0 ? null : pileDisplaySize(visibleMembers[0], sizeOf)),
    [visibleMembers, sizeOf],
  );

  /* ── 官方 `rJe` 的出现门 + `dJe` 的模式 ──
     ★★ 悬浮**展开/移开收起**的动画就是这里：
       官方 `dJe(entryActive, isDropTarget, shouldMountToolbar&&!dragging)`
          ⇒ `"compact" | "drop-target" | "interactive"`
       再由 `wC(mode)` 给出**展开倍数**（`compact:1` / `interactive:2` / `drop-target:2.35`），
       这个倍数被 `pileStackLayers` 传进官方 `xG(index,count,expansion)` ⇒ 各层 x/y/rotate 全乘它
       ⇒ 悬浮时整摞**散开**、移开时**收回**（过渡 = 官方 reflow `.34s` + `Bh[.65,0,.35,1]`）。
       ⚠️ 上一版我把 expansion 写死成 1 ⇒ 悬浮/移开**毫无反应**（用户：
          「堆叠后的光标悬浮停留和移开的动画呢？」✗）。 */
  const [hovered, setHovered] = useState(false);
  const [focused] = useState(false);
  /** 官方 `lJe` 的「有计划 / 无计划」分界：入场放完就切到 reflow 过渡 */
  const [entered, setEntered] = useState(false);

  const layers = useMemo(
    () =>
      pileStackLayers(
        visibleMembers.map((m) => m.id),
        /* 官方 `stt`@3009100：`z = ttt(C, _, G && !o ? D : null)`，`ttt` 在**没有入场计划**
           时直接 `return t`（`t` 就是 `_`）⇒ 堆叠体内**只渲染 `_`（最后 ≤5 个）**；
           溢出成员官方在这里**根本不画**（它们靠 `pile-member-anchor` 锚点留在画布上接边，
           见官方 `ott`@3012950）。⚠️ 上一版把全部成员都当 `visibleIndex = -1` 的「封面层」
           画了出来 ⇒ 多于 5 个时**多出若干张缩小的暗卡**（用户：「2D UI 不对」）。 */
        visibleMembers.map((m) => m.id),
        (mid) => {
          const node = nodes.find((n) => n.id === mid);
          return node ? pileDisplaySize(node, sizeOf) : { width: 0, height: 0 };
        },
        cover,
        /* 官方 `wC(dJe(...))`：`compact` = 1 · `interactive` = 2 · `drop-target` = 2.35 */
        pilePreviewExpansion(hovered || focused ? 'interactive' : 'compact'),
      ),
    [visibleMembers, cover, nodes, sizeOf, hovered, focused],
  );

  /* ── 官方 `rJe` 的出现门 + `dJe` 的模式 ──
     ★★ 悬浮**展开/移开收起**的动画就是这里：
       官方 `dJe(entryActive, isDropTarget, shouldMountToolbar&&!dragging)`
          ⇒ `"compact" | "drop-target" | "interactive"`
       再由 `wC(mode)` 给出**展开倍数**（`compact:1` / `interactive:2` / `drop-target:2.35`），
       这个倍数被 `pileStackLayers` 传进官方 `xG(index,count,expansion)` ⇒ 各层 x/y/rotate 全乘它
       ⇒ 悬浮时整摞**散开**、移开时**收回**（过渡 = 官方 reflow `.34s` + `Bh[.65,0,.35,1]`）。
       ⚠️ 上一版我把 expansion 写死成 1 ⇒ 悬浮/移开**毫无反应**（用户：
          「堆叠后的光标悬浮停留和移开的动画呢？」✗）。 */
  const hideTimer = useRef<number | null>(null);
  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);
  useEffect(() => () => clearHideTimer(), [clearHideTimer]);
  /* 入场动画放完（官方 `WG` 的最长 .46s + 逐层 stagger）后切到 reflow 过渡 */
  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  /**
   * 官方 `H = V && u <= 1 && !p`，其中 `u = Fg()` 是 **React Flow 侧的实时选中数**。
   * ⚠️ 不能读 `useAppStore.selectedNodeIds`：MTV 的 store 选区是 RF 选区的**镜像**，
   *    而 `pileSelectedNodes` 后的选区是靠 `pendingSelectionRef` **延迟**刷新的
   *    ⇒ 刚建完堆叠那一刻 store 里还是原来的 7 个成员，`canInteract` 会被算成 false，
   *      悬停时工具条**出不来**（实测踩过：`NO_TOOLBAR`）。用 RF 侧实时值就没有这个时序问题。
   */
  const rfSelectedCount = useStore((s: ReactFlowState) =>
    (s.nodes as unknown as Array<{ selected?: boolean }>).filter((n) => n.selected).length,
  );

  /** 官方 `H = V && 选中数 <= 1 && !userSelectionActive` */
  const canInteract = !dragging && rfSelectedCount <= 1;
  /* ★★ 官方 `G3e`（堆叠工具条 hover 状态机）逐字：
       `const y = e && (r || l || d) && !s;`   // shouldMountToolbar
       `const x = y && !t && !n;`              // shouldShowToolbar：再 && !dragging && !isEntryActive
     MTV 原来只写 `canInteract && hovered && !dragging` —— **少了 `!isGalleryOpen` 与 `!isEntryActive`**。
     ⚠️ 官方 mount 门**不吃 `!dragging`**（只有 show 门吃）；MTV 原来 mount 门也写了，
        拖拽时整条 unmount/remount 也是闪的来源。 */
  /* ★★★ **互斥**：两张堆叠卡位置重叠时，它们的 hover 桥也重叠 ⇒ 鼠标落在重叠区会
     **同时触发两个堆叠的 `onMouseEnter`** ⇒ 两条工具条同时真（实测：175×48@1448,392 与
     91×48@1189,432 同时 opacity=1）。官方每个堆叠也是各自一个 hover 状态、没有互斥，
     但官方那两张卡不重叠 ⇒ 实际不会同时出现；MTV 布局会重叠，所以必须显式保证
     **同一时刻只有一个堆叠显示工具条**（后进入者抢占）。 */
  const pileToolbarOwned = usePileToolbarOwnership(id, hovered || focused);
  const shouldMountToolbar = canInteract && (hovered || focused) && !session && pileToolbarOwned;
  const shouldShowToolbar = shouldMountToolbar && !dragging && entered;

  const handleEnter = useCallback(() => {
    clearHideTimer();
    setHovered(true);
  }, [clearHideTimer]);
  const handleLeave = useCallback(() => {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      setHovered(false);
    }, PILE_TOOLBAR_HIDE_DELAY);
  }, [clearHideTimer]);
  /* 官方 `G3e` 的 blur 守卫逐字：
       `S = C => { const N = C.relatedTarget;
          N instanceof Node && C.currentTarget.contains(N) || (c(!1), !r && v()) }`
     ⇒ **焦点在内部元素之间移动时不收起**（否则点工具条里的按钮会让它闪一下消失）。
     MTV 原来直接把 `onBlur` 接到 `handleLeave` ⇒ 点一次就闪。 */
  const handleBlur = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    handleLeave();
  }, [handleLeave]);

  /* ── 官方 `ne`（zoom-slider-3ZcFvYQO.js @2984072）—— 点卡片打开**全屏堆叠画廊** ──
   * ```js
   * const ne = h.useCallback(() => {
   *   if(!V || C.length===0 || m || !s.current) return;
   *   const pe = s.current.closest("[data-canvas-container]") ?? document.body,
   *         le = pe.getBoundingClientRect(),
   *         xe = CQe({ members:C, pileRect:s.current.getBoundingClientRect(),
   *                    portalRect:{left:le.left, top:le.top,
   *                                width:le.width || window.innerWidth,
   *                                height:le.height || window.innerHeight},
   *                    canvasZoom:i().zoom, previewExpansion:q });
   *   g({ pileId:e, canEdit:j, portalContainer:pe, snapshot:xe, initialZoom:iJe,
   *       previewMode:"source", sourceImageVariant:d });
   * }, [j, V, d, q, m, i, e, C, g]);
   * ```
   * 逐条对应：
   *   · `V`（`!isDisabled && !isUnstacking`）→ MTV 用 `!dragging`（MTV 这个层级没有那两个标志位）
   *   · `C`（`sb(node, variant)` 的显示成员）→ `members`（store 里的堆叠成员）
   *   · `m`（已开会话）→ `session`
   *   · `iJe = .6` → `PILE_GALLERY_INITIAL_ZOOM`
   *   · `q`（当前展开倍数）→ `pilePreviewExpansion(悬浮 ? "interactive" : "compact")`
   *   · `d`（sourceImageVariant）→ MTV 无该变体概念 ⇒ `undefined`
   * ⚠️ portal 锚点取自 `[data-canvas-container]`（= 画布根，见 Canvas.tsx 上那个属性）；
   *    取不到才退回 `document.body`（官方同款兜底）。
   */
  const handleCardClick = useCallback(() => {
    if (dragging || members.length === 0 || session || !rootRef.current) return;
    const portalEl =
      rootRef.current.closest<HTMLElement>('[data-canvas-container]') ?? document.body;
    const portalRect = portalEl.getBoundingClientRect();
    const snapshot = gallerySourceGeometryOf({
      pileRect: rootRef.current.getBoundingClientRect(),
      portalRect: {
        left: portalRect.left,
        top: portalRect.top,
        width: portalRect.width || window.innerWidth,
        height: portalRect.height || window.innerHeight,
      },
      canvasZoom: getViewport().zoom,
      previewExpansion: pilePreviewExpansion(hovered || focused ? 'interactive' : 'compact'),
    });
    openGallery({
      pileId: id,
      /* 官方 `j = !c.isDisabled && f.enabled`（工具条那边同款：`<PileNodeToolbar canEdit />`） */
      canEdit: true,
      portalContainer: portalEl,
      snapshot,
      initialZoom: PILE_GALLERY_INITIAL_ZOOM,
      previewMode: 'source',
      sourceImageVariant: undefined,
    });
  }, [dragging, members.length, session, getViewport, hovered, focused, openGallery, id]);

  /* 官方 `fe`：`Enter` / `Space` 也能打开画廊（`role="button"` 的键盘等价物） */
  const handleCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleCardClick();
    },
    [handleCardClick],
  );

  const selectedIds = members.map((m) => m.id);
  const canDownload = canDownloadSelected(selectedIds);

  const handleUnpile = useCallback(() => {
    /* 官方 `X = () => f.unpile(e, q, C)` 是**按堆叠 id** 解的；
       MTV 的 store action 按当前选区解 ⇒ 先把选区钉到这个堆叠上（工具条本来也只属于它）。 */
    setSelectedNodeIds([id], 'direct');
    unpileSelectedNodes();
  }, [id, setSelectedNodeIds, unpileSelectedNodes]);

  const handleAddToChat = useCallback(
    (subset: ReadonlyArray<(typeof nodes)[number]>) => {
      setSelectedNodeIds(subset.map((n) => n.id), 'direct');
      addSelectionToChat();
    },
    [setSelectedNodeIds],
  );

  const handleSaveToLibrary = useCallback(
    (subset: ReadonlyArray<(typeof nodes)[number]>) => {
      setSelectedNodeIds(subset.map((n) => n.id), 'direct');
      saveSelectionToLibrary();
    },
    [setSelectedNodeIds],
  );

  const handleDownload = useCallback((subset: ReadonlyArray<(typeof nodes)[number]>) => {
    void downloadNodesByIds(subset.map((n) => n.id));
  }, []);

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={canInteract ? 0 : -1}
      aria-disabled={!canInteract}
      aria-label={t('堆叠节点，共 {count} 个节点', { count: members.length })}
      aria-haspopup="dialog"
      data-pile-node={id}
      className={PILE_RENDER_CLASSES.root}
      /* 官方 `uJe` 根节点：`onClick:ne` + `onKeyDown:fe`（点卡片/回车进全屏画廊） */
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleBlur}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {/* 成员列表：官方在有可见成员时才画出那一摞。
          官方 `uJe` 的 className 逐字：`S || L ? "relative size-full invisible" : "relative size-full"`
          （`S` = 本项目画廊已开、`L` = 正在解堆）⇒ 画廊打开时这一摞**不可见**（但仍占位，
          因为全屏层的入场动画要从卡片位置飞出去）。 */}
      <div
        className={
          session?.pileId === id ? PILE_RENDER_CLASSES.memberListHidden : PILE_RENDER_CLASSES.memberList
        }
      >
        {layers.map((layer) => {
          const node = nodes.find((n) => n.id === layer.id);
          if (!node) return null;
          const size = pileDisplaySize(node, sizeOf);
          return (
            <motion.div
              key={layer.id}
              data-pile-preview-member={layer.id}
              className={PILE_RENDER_CLASSES.member}
              /* 官方 `lJe(e,t,n,s)`：有计划（刚建堆的入场）时用 `WG` 那套 460/280ms；
                 否则（**悬浮展开 / 移开收起**这类 reflow）用 `oJe = {duration:.34, ease:Bh}`。 */
              initial={layer.visibleIndex >= 0 ? PILE_ENTRY_ORIGIN : false}
              animate={{ x: layer.x, y: layer.y, scale: layer.scale, rotate: layer.rotate }}
              transition={
                entered
                  ? { duration: PILE_REFLOW_DURATION_S, ease: PILE_MOVEMENT_EASE }
                  : pileLayerTransition(pileEntryDelaySeconds(layer.visibleIndex))
              }
              style={{
                width: size.width,
                height: size.height,
                marginLeft: -size.width / 2,
                marginTop: -size.height / 2,
                zIndex: layer.zIndex,
              }}
            >
              {/* ⚠️ 官方 `uJe`@3011900 的成员子元素**只有两个平级兄弟**：
                    `children:[ l.jsx(TT,{...de.display}), l.jsx(fJ,{initialOpacity:…,opacity:ye,…}) ]`
                  `TT`（= 官方 `YZe`）**自带** `group/display-node relative size-full overflow-hidden rounded-xl`
                  根（见 `PileMemberPreview.tsx:433`）⇒ 这里**不能再套一层** `previewRoot`，
                  否则实测 DOM 会出现**两层** `group/display-node`，且遮罩被塞进内层（官方是兄弟）。 */}
              <PileMemberPreviewLayer node={node} size={size} />
              {/* ★★★ 官方的**层叠遮罩** `fJ`（`zoom-slider`@2938436 逐字）：
                    `function fJ({initialOpacity=!1,opacity,transition}){
                       return l.jsx($n.div,{className:"pointer-events-none absolute inset-0 z-20
                                                    rounded-xl bg-[#080B10]",
                        initial:e===!1?!1:{opacity:e}, animate:{opacity:t}, transition:n})}`
                 调用点（`uJe`@3012050）：`children:[l.jsx(TT,{...}), l.jsx(fJ,{initialOpacity:Ne?0:!1,
                                           opacity:ye, transition:Ie.transition})]`
                 ★ 透明度 `ye` 的来源（@3008950 逐字）：**`ye = qM(le, _.length)`**
                   —— 就是 `R0 = [0, .18, .3, .42, .54]`：**正面那张 0（无遮罩）**，
                   往后 .18 / .3 / .42 / .54（溢出层 `le = -1` ⇒ 取最大档 .54）。
                   ⇒ 这就是用户说的「各层之间不是阴影就是遮罩」——**是遮罩**（`#080B10`）。
                 9444 实测：2 层堆叠 ⇒ 底层 `style="opacity: 0.18;"`、正面层 `style="opacity: 0;"`。 */}
              <motion.div
                aria-hidden
                className={PILE_RENDER_CLASSES.shade}
                initial={entered ? false : { opacity: 0 }}
                animate={{ opacity: layer.staggerStep }}
                transition={{ duration: PILE_REFLOW_DURATION_S, ease: PILE_MOVEMENT_EASE }}
              />
            </motion.div>
          );
        })}
        {visibleMembers.length === 0 && (
          <div className={PILE_RENDER_CLASSES.empty}>{t('堆叠中暂无节点')}</div>
        )}
      </div>

      {/* 官方 `QZe`：38px hover 桥 + `--pile-toolbar-scale` 缩放层（外层就是官方 `eT`） */}
      {shouldShowToolbar && (
        <div
          aria-hidden
          className={PILE_RENDER_CLASSES.toolbarBridge}
          data-pile-toolbar-bridge=""
          style={{ top: PILE_TOOLBAR_BRIDGE_TOP, height: PILE_TOOLBAR_BRIDGE_HEIGHT }}
          onMouseEnter={handleEnter}
        />
      )}
      <NodeToolbarShell
        keepMounted={shouldMountToolbar}
        visible={shouldShowToolbar}
        placement="top"
        className="z-20"
      >
        <div
          aria-hidden={!shouldShowToolbar}
          className={PILE_RENDER_CLASSES.toolbarScaleLayer}
          data-pile-toolbar-scale-layer=""
          style={{ top: PILE_TOOLBAR_BRIDGE_TOP, transform: 'scale(var(--pile-toolbar-scale, 1))' }}
        >
          {/* ★★ 官方 `QZe` 的结构**逐字**：缩放层里**直接**放工具条本体（`cPe`）——
              工具条自己靠 `--float-y:-100%` + `--float-offset:12px` 定位在缩放层上方：
                `cPe` 内联 `style={{…, "--float-y":"-100%", "--float-offset":"12px",
                                    transformOrigin:"center bottom"}}`
              缩放层又在 `top:-Dk`（`Dk = 38`），`left-1/2`、`size-0`、`origin-bottom`
              ⇒ **卡片顶边 → 工具条底边 = 38px**（38 是那 38px 的 hover 桥高度）。
              ⚠️⚠️ 上一版我在缩放层里**多套了一层** `absolute bottom-0 left-1/2 -translate-x-1/2`
                 ⇒ 在官方基准上又叠了一次定位 ⇒ **纵向间距不对**（用户实测 ✗）。已删除该层。 */}
          <PileNodeToolbar
            canEdit
            members={members}
            shouldShow={shouldShowToolbar}
            onUnpile={handleUnpile}
            onAddToChat={handleAddToChat}
            onSaveToLibrary={handleSaveToLibrary}
            onDownload={handleDownload}
            canDownload={canDownload}
          />
        </div>
      </NodeToolbarShell>
    </div>
  );
}
