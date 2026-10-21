/**
 * ImageNodeToolbar 图像节点浮动工具栏 + 编辑态支持
 */
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import type { NodeType, BaseNodeData, ToolbarMenuRowDef } from '../../../../types';
import AnimatedButton from '../../../shared/AnimatedButton';
import { useToolbarEdit } from '../../../../hooks/useToolbarEdit';
import ToolbarEditor from '../toolbar/ToolbarEditor';
import ToolbarMoreMenu, { type ToolbarSubAction } from '../toolbar/ToolbarMoreMenu';
import QuickSplitPanel, { type QuickSplitGrid } from '../toolbar/QuickSplitPanel';
import PinToolbarButton from '../toolbar/PinToolbarButton';
import DeleteToolbarButton from '../toolbar/DeleteToolbarButton';
import { isTouchTabletDevice } from '../../../../utils/touchDevice';
import { OfficialIcon } from '../../../sidebar/OfficialIcon';
import { readPins, resolvePinnable } from '../../../../services/canvasPin';
import { useCanvasPinActions } from '../../../../hooks/useCanvasPin';
import { useNodePluginToolbar } from '../toolbar/NodePluginToolbarButtons';
import {
  getHiddenDefaultToolbarButtons,
  TOOLBAR_MORE_KEY,
} from '../toolbar/toolbarRegistry';
import { stopToolbarContainerClick } from '../toolbar/toolbarContainer';
import { resolvePresetAction, resolvePresetDef, createPresetNode } from '../toolbar/presetAction';
import { executeGeneration } from '../../../../services/generationService';
import { saveNodeOutputToFile } from '../../../../services/fileService';
import { requestPresetSequence } from '../../../../services/presetSequenceService';
import { startImageRoundtrip } from '../../../../services/imageRoundtripService';
import { useAppStore } from '../../../../store/useAppStore';
import type { Node } from '@xyflow/react';
import { useStore, type ReactFlowState } from '@xyflow/react';

const ImageGenerationHistoryDialog = lazy(() => import('./ImageGenerationHistoryDialog'));

interface ImageNodeToolbarProps {
  nodeId: string;
  onUpload?: () => void;
  onMatting?: () => void;
  /** 官方 `erase`（⋯ 菜单里的「擦除」）：以 erase 模式打开浮动编辑器（与重绘同一套宿主） */
  onErase?: () => void;
  onSubjectMatting?: () => void;
  onCameraStudio?: () => void;
  /** 官方 `relight`：以「打光」模式打开摄影棚 */
  onRelight?: () => void;
  onExpand?: () => void;
  /** 官方 `quickSplit`：支持任意 `rows × cols`（面板）或方形档（chips 传数字） */
  onMultiGrid?: (grid: number | QuickSplitGrid) => void;
  onCustomGrid?: () => void;
  onCompose?: () => void;
  onFullscreen?: () => void;
  onCrop?: () => void;
  onAnnotate?: () => void;
  onUpscale?: () => void;
  onRepaint?: () => void;
  onCopyFile?: () => void;
  onReversePrompt?: () => void;
  /** 「本卡有内容」——由卡片自己的内容门（`displaySrc`）算好传进来，供官方 Pin 的 `pinnable` 用 */
  hasContent?: boolean;
  isUpscaling?: boolean;
  isSubjectMattingRunning?: boolean;
}

/** 官方 `ptt` 的 `subActions` 文案（逐字：`"2×2"` / `"3×3"` / `"4×4"`） */
const QUICK_SPLIT_CHIPS = [2, 3, 4] as const;

/**
 * 工具条按钮图标：有官方原版 SVG 时优先用它（官方是 20×20），
 * 否则退回原来的 iconify 图标（14×14）。
 *
 * ⚠️ 形参收 `ToolbarMenuRowDef`（`icon` 可选的超集）而不是 `ToolbarButtonDef`：
 * 本函数既被**主行按钮**调用、也被「⋯ 浏览全部」菜单**行**复用，而官方菜单行允许没有 `icon`
 * （`x2e` 三帧菜单就没有）⇒ 用更宽的类型，缺 `icon` 时渲染空 `<span>`（不编造图标）。
 */
function DefIcon({ def }: { def: ToolbarMenuRowDef }) {
  if (def.officialIcon) return <OfficialIcon name={def.officialIcon} size={20} />;
  if (!def.icon) return null;
  return <Icon icon={def.icon} width={14} height={14} />;
}

function ImageNodeToolbar({
  nodeId: _nodeId,
  onUpload, onMatting, onErase, onSubjectMatting, onCameraStudio, onRelight, onExpand,
  onMultiGrid, onCustomGrid, onCompose, onFullscreen, onCrop,
  onAnnotate, onUpscale, onRepaint, onCopyFile, onReversePrompt,
  hasContent,
  isUpscaling, isSubjectMattingRunning,
}: ImageNodeToolbarProps) {
  const nodeType = 'ai-image';
  // ★ 官方 `dPe`：`y = isFitZoomDisplay && zoom !== undefined ? zoom < .2 : false`
  //   画布缩放到 0.2 以下 ⇒ 按钮退化为纯图标（文字不再显示，文案交给 tooltip 承载）
  const canvasZoom = useStore((s: ReactFlowState) => s.transform[2]);
  const lowZoom = canvasZoom < 0.2;
  const edit = useToolbarEdit({ nodeType });
  const registry = edit.registry;
  const {
    renderButton: renderPluginButton,
    dialog: pluginDialog,
  } = useNodePluginToolbar({ nodeId: _nodeId });
  const [historyOpen, setHistoryOpen] = useState(false);

  /* 官方 `n4`：只有触屏平板才在工具条末尾补删除键（桌面端没有）*/
  const showTouchDelete = useMemo(() => isTouchTabletDevice(), []);

  // ── 官方 `quickSplit` 的宫格预览（`htt` 的 `previewGrid` / `onPreviewGridChange`，逐字同义）──
  //    官方 `const [W, Y] = useState(null)`：hover 单元格/子操作时给出高亮区域，离开即清空。
  //    ⚠️ 官方**没有**「自定义裁切」那一项 ⇒ MTV 的自由裁切改成 ⋯ 里独立一行（`customGrid`）。
  const [previewGrid, setPreviewGrid] = useState<QuickSplitGrid | null>(null);

  /**
   * 官方 `ptt` 的宫格门 `b = (le) => !f || !m ? true : le.rows===le.cols && m.includes(le.rows)`
   * ⇒ 没有策略（`parametersLocked` 未开）时**全部 1..8 都允许**；MTV 无该策略 ⇒ 恒 true。
   * （官方面板上限 `n1 = 8`，见 QuickSplitPanel）
   */
  const isGridAllowed = useCallback((grid: QuickSplitGrid) => (
    Number.isInteger(grid.rows) && Number.isInteger(grid.cols)
  ), []);

  /** MTV 布局把「快速切分」放进主行时的锚定面板开合（官方只在 ⋯ 菜单里，故这是 MTV 分支） */
  const [mainGridOpen, setMainGridOpen] = useState(false);
  const mainGridWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mainGridOpen) return;
    const onDown = (event: MouseEvent) => {
      if (mainGridWrapRef.current && !mainGridWrapRef.current.contains(event.target as unknown as globalThis.Node)) {
        setMainGridOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [mainGridOpen]);

  /**
   * 官方 `ptt` 的 `quickSplit.subActions`（逐字）：chips = `2×2` / `3×3` / `4×4`
   *   `onMouseEnter: b({rows,cols}) && Y({rows,cols})`  ⇒ 允许时设置宫格高亮预览
   *   `handle: () => { Y(null); de(2|3|4) }`             ⇒ 清预览并按方形档切分
   */
  const quickSplitSubActions = useMemo<ToolbarSubAction[]>(() => (
    QUICK_SPLIT_CHIPS.map((side) => {
      const grid = { rows: side, cols: side };
      return {
        key: `split_${side}x${side}`,
        label: `${side}×${side}`,
        onMouseEnter: () => { if (isGridAllowed(grid)) setPreviewGrid(grid); },
        handle: () => { setPreviewGrid(null); onMultiGrid?.(side); },
      };
    })
  ), [isGridAllowed, onMultiGrid]);

  /** 官方 `renderHoverContent: le => <htt …/>`：行右侧 hover 面板 = 同一块宫格面板，点完即关菜单 */
  const renderGridHoverContent = useCallback((close: () => void) => (
    <QuickSplitPanel
      previewGrid={previewGrid}
      onPreviewGridChange={setPreviewGrid}
      isGridAllowed={isGridAllowed}
      onSplit={(grid) => onMultiGrid?.(grid)}
      onDone={close}
    />
  ), [isGridAllowed, onMultiGrid, previewGrid]);

  /** ★ 官方 `LJ` 组的 download（官方：`downloadNodes(nodeId)`）——
   *  MTV 复用节点右键「另存为...」的同一个服务 `saveNodeOutputToFile`（文案/失败提示也照该路径） */
  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const liveNode = useAppStore.getState().nodes.find((n) => n.id === _nodeId) as Node<BaseNodeData> | undefined;
    const d = liveNode?.data as BaseNodeData | undefined;
    if (!d) return;
    try {
      const result = await saveNodeOutputToFile({
        filePath: d.filePath,
        mediaUrl: d.imageUrl || d.videoUrl || d.audioUrl || undefined,
        textOutput: d.output as string | undefined,
        nodeType: 'ai-image',
        fileName: d.fileName || d.label,
      });
      /* 官方：保存/下载走「下载完成」进度卡，不再弹「文件已保存」toast */
      /* 官方：保存/下载由「文件传输中心」自动上报，不再弹「文件已保存」toast */
      void result;
    } catch {
      useAppStore.getState().showToast('文件保存失败');
    }
  }, [_nodeId]);

  const actionMap = useMemo<Record<string, (e: React.MouseEvent) => void>>(() => ({
    download:       handleDownload,
    /* ⋯ 菜单的「擦除」= 官方 `erase`（`k(e,'erase')`）⇒ 打开**同一套浮动编辑器**的 erase 模式
       （不是抠图编辑器；抠图是下一个 key `subjectMatting` = 官方 `cutout`）。 */
    matting:        (e) => { e.stopPropagation(); (onErase ?? onMatting)?.(); },
    expand:         (e) => { e.stopPropagation(); onExpand?.(); },
    /* 官方 `quickSplit` 的**唯一**入口是 ⋯ 菜单那一行（chips + hover 面板）。
       MTV 的工具栏编辑允许把它拖进主行 ⇒ 主行点击时用**同一块官方面板**锚定在按钮上方
       （不另造第二套 UI），见下面 `key === 'multiGrid'` 分支。 */
    multiGrid:      (e) => { e.stopPropagation(); setPreviewGrid(null); },
    /* MTV 自有（官方无此项）：自由裁切线，直接开编辑器 */
    customGrid:     (e) => { e.stopPropagation(); onCustomGrid?.(); },
    cameraStudio:   (e) => { e.stopPropagation(); onCameraStudio?.(); },
    relight:        (e) => { e.stopPropagation(); onRelight?.(); },
    // `pin` 不在这里 —— 官方是 `buttonType:"unwrapped"`（自带 popover），由 `PinToolbarButton` 单独渲染
    /* ★ 官方「保存到素材库」= 先选素材库文件夹（`library.selectFolder`）→ 落盘 →
       toast「已保存到「{folder}」」（`library.savedToFolder`）；与右键卡片菜单**同一个动作** ✓ */
    saveToLibrary:  (e) => { e.stopPropagation(); useAppStore.getState().openSaveToLibraryMenu(_nodeId, { x: e.clientX, y: e.clientY }); },
    repaint:        (e) => { e.stopPropagation(); onRepaint?.(); },
    upscale:        (e) => { e.stopPropagation(); if (!isUpscaling) onUpscale?.(); },
    subjectMatting: (e) => { e.stopPropagation(); if (!isSubjectMattingRunning) onSubjectMatting?.(); },
    annotate:       (e) => { e.stopPropagation(); onAnnotate?.(); },
    crop:           (e) => { e.stopPropagation(); onCrop?.(); },
    compose:        (e) => { e.stopPropagation(); onCompose?.(); },
    upload:         (e) => { e.stopPropagation(); onUpload?.(); },
    copyFile:       (e) => { e.stopPropagation(); onCopyFile?.(); },
    reversePrompt:  (e) => { e.stopPropagation(); onReversePrompt?.(); },
    history:        (e) => { e.stopPropagation(); setHistoryOpen(true); },
    /* MTV 自有「图片往返」：源图 → 本机桥接服务 → 外部编辑器（PS 等）→ 回传自动建下游卡。
       与其余项一样「点完就关菜单」（⋯ 菜单的官方点击语义），耗时流程交给服务里的 toast 报状态。 */
    roundtrip:      (e) => { e.stopPropagation(); void startImageRoundtrip(_nodeId); },
    /* §99 官方键名逐字 = `scale`（`vendor-pkg-canvas-CvbAwZyy.js` @1710782 `key:"scale"`），
       MTV 旧键 `fullscreen` 已改；老布局由 `migrateImageLayoutToV12` 改名（见 toolbarRegistry.ts）。 */
    scale:          (e) => { e.stopPropagation(); onFullscreen?.(); },
  }), [
    handleDownload,
    isSubjectMattingRunning,
    isUpscaling,
    onAnnotate,
    onErase,
    onCameraStudio,
    onCompose,
    onCopyFile,
    onCrop,
    onCustomGrid,
    onExpand,
    onFullscreen,
    onMatting,
    onRepaint,
    onRelight,
    onReversePrompt,
    onSubjectMatting,
    onUpload,
    onUpscale,
    setHistoryOpen,
    _nodeId,
  ]);

  const userPresets = useAppStore((s) => s.userPresets);
  const addNodeWithEdge = useAppStore((s) => s.addNodeWithEdge);

  // ── 官方 Pin（`S7` 读 + `uIe` 门控 + `mIe` 写）──
  const pinNodeData = useAppStore((s) => s.nodes.find((n) => n.id === _nodeId)?.data);
  const pinPins = useMemo(() => readPins(pinNodeData), [pinNodeData]);
  const pinPinnable = useMemo(
    () => resolvePinnable({ type: nodeType, data: pinNodeData }, { hasContent }).pinnable,
    [pinNodeData, hasContent],
  );
  const { togglePinOnNode } = useCanvasPinActions();

  const executePresetNode = useCallback((resolved: NonNullable<ReturnType<typeof resolvePresetAction>>) => {
    const liveNode = useAppStore.getState().nodes.find((n) => n.id === _nodeId) as Node<BaseNodeData> | undefined;
    if (!liveNode) return;
    const { node: newNode, edge } = createPresetNode(liveNode, resolved);
    addNodeWithEdge(newNode, edge);
    executeGeneration(newNode.id, newNode.data.prompt, resolved.postProcess, newNode.data);
  }, [_nodeId, addNodeWithEdge]);

  const handlePresetClick = useCallback(
    (key: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      // 实时从 store 读取，避免闭包过期导致对话框内容/ @引用丢失
      const liveNode = useAppStore.getState().nodes.find((n) => n.id === _nodeId) as Node<BaseNodeData> | undefined;
      if (!liveNode) return;
      const livePrompt = (liveNode.data?.prompt as string) ?? '';
      const livePresets = useAppStore.getState().userPresets;
      if (requestPresetSequence(key, nodeType as NodeType, _nodeId, livePresets)) return;
      const resolved = resolvePresetAction(key, nodeType as NodeType, livePrompt, livePresets);
      if (!resolved) return;

      // 用 newNode.data.prompt（含 @{sourceId:label} 引用），不用 resolved.filledPrompt（不含 @引用）
      executePresetNode(resolved);
    },
    [_nodeId, executePresetNode],
  );
  const hiddenDefaultButtons = getHiddenDefaultToolbarButtons(registry, edit.activeButtonKeys);

  // ── 渲染单个按钮 ──
  const renderButton = useCallback((key: string) => {
    const pluginButton = renderPluginButton(key);
    if (pluginButton) return pluginButton;
    const def = registry.find((d) => d.key === key);
    const handler = actionMap[key];
    const isPreset = !def;

    // ── 官方 `hx`：Pin 是 `buttonType:"unwrapped"`（自带 popover、**不走 actionMap**），
    //    所以必须在下面的 `!handler` 守卫**之前**分流（否则会被当成"没有 handler"直接 return null）──
    if (key === 'pin' && def) {
      const locked = def.lockedTooltip;
      if (def.invisible && !locked) return null;
      return (
        <PinToolbarButton
          key={key}
          pins={pinPins}
          disabled={!!def.disabled || !!locked}
          onToggle={(groupId) => togglePinOnNode(_nodeId, groupId)}
        />
      );
    }

    if (!def && isPreset) {
      const presetDef = resolvePresetDef(key, nodeType as NodeType, userPresets);
      if (!presetDef) return null;
      return (
        <AnimatedButton key={key} className="ftb-btn icon-only act-preset"
          data-tooltip={presetDef.label} aria-label={presetDef.label}
          onClick={handlePresetClick(key)}>
          <Icon icon={presetDef.icon} width={14} height={14} />
        </AnimatedButton>
      );
    }
    if (!def || !handler) return null;
    // ★ 官方项级门（`cPe`：`g?.invisible!==!0||!!g?.lockedTooltip`）
    //   invisible 且无 lockedTooltip ⇒ 该项直接不渲染；有 lockedTooltip ⇒ 渲染为禁用 + 锁定提示
    if (def.invisible && !def.lockedTooltip) return null;
    const locked = def.lockedTooltip;
    const baseDisabled = !!def.disabled || !!locked;

    if (key === 'upscale') {
      return (
        <AnimatedButton
          key={key}
          className={`ftb-btn icon-only act-hd${locked || isUpscaling ? ' is-locked' : ''}`}
          data-tooltip={locked ?? (isUpscaling ? '超分处理中...' : def.label)}
          aria-label={def.label}
          disabled={baseDisabled || isUpscaling}
          onClick={actionMap[key]}
        >
          <DefIcon def={def} />
        </AnimatedButton>
      );
    }

    if (key === 'subjectMatting') {
      return (
        <AnimatedButton
          key={key}
          className={`ftb-btn icon-only act-auto-subject${locked || isSubjectMattingRunning ? ' is-locked' : ''}`}
          data-tooltip={locked ?? (isSubjectMattingRunning ? '主体识别中...' : def.label)}
          aria-label={def.label}
          disabled={baseDisabled || isSubjectMattingRunning}
          onClick={actionMap[key]}
        >
          <DefIcon def={def} />
        </AnimatedButton>
      );
    }

    if (key === 'multiGrid') {
      /* 官方的 quickSplit **只在 ⋯ 菜单里**（chips + hover 面板）；MTV 的工具栏编辑可以把按钮
         拖进主行 ⇒ 这里用**同一块官方面板**（`htt`/QuickSplitPanel）锚定在按钮上方，不另造第二套 UI。 */
      return (
        <div key={key} className="multigrid-wrap" ref={mainGridWrapRef}>
          <AnimatedButton
            className={`ftb-btn icon-only act-multigrid${locked ? ' is-locked' : ''}`}
            data-tooltip={locked ?? def.label}
            aria-label={def.label}
            disabled={baseDisabled}
            onClick={(e) => {
              e.stopPropagation();
              setPreviewGrid(null);
              setMainGridOpen((open) => !open);
            }}
          >
            <DefIcon def={def} />
          </AnimatedButton>
          {mainGridOpen && (
            <QuickSplitPanel
              disabled={baseDisabled}
              previewGrid={previewGrid}
              onPreviewGridChange={setPreviewGrid}
              isGridAllowed={isGridAllowed}
              onSplit={(grid) => onMultiGrid?.(grid)}
              onDone={() => setMainGridOpen(false)}
            />
          )}
        </div>
      );
    }

    // ── 官方 `hx`：Pin 是 `buttonType:"unwrapped"`（自带 popover），单独渲染 ──
    if (key === 'pin') {
      return (
        <PinToolbarButton
          key={key}
          pins={pinPins}
          disabled={baseDisabled}
          onToggle={(groupId) => togglePinOnNode(_nodeId, groupId)}
        />
      );
    }

    return (
      <AnimatedButton
        key={key}
        className={`ftb-btn icon-only act-${key}${locked ? ' is-locked' : ''}`}
        data-tooltip={locked ?? def.label}
        aria-label={def.label}
        disabled={baseDisabled}
        onClick={actionMap[key]}
      >
        <DefIcon def={def} />
      </AnimatedButton>
    );
  }, [registry, actionMap, isUpscaling, isSubjectMattingRunning, mainGridOpen, previewGrid, isGridAllowed, onMultiGrid, handlePresetClick, renderPluginButton, userPresets, pinPins, togglePinOnNode, _nodeId]);

  /** ⋯ 菜单行点击 → 派发到工具栏自己的 actionMap（官方菜单行的行为就是执行该项） */
  const selectFromMoreMenu = useCallback((key: string) => {
    const handler = actionMap[key];
    if (!handler) return;
    handler({ stopPropagation() {}, preventDefault() {} } as unknown as React.MouseEvent);
  }, [actionMap]);

  // ── 编辑态 ──
  if (edit.isEditing) {
    return (
      <>
        <ToolbarEditor edit={edit} nodeType={nodeType} />
        {historyOpen && (
          <Suspense fallback={null}>
            <ImageGenerationHistoryDialog
              isOpen
              nodeId={_nodeId}
              onClose={() => setHistoryOpen(false)}
            />
          </Suspense>
        )}
      </>
    );
  }

  // ── 官方容器门：`d.every(m=>m.length===0) ? null`（所有组都空 ⇒ 整个工具栏不渲染）──
  const willRender = (key: string): boolean => {
    if (key === TOOLBAR_MORE_KEY) return hiddenDefaultButtons.length > 0;
    // 官方 `hx` 的门：`!readonly && pinnable`（pinnable 见 `resolvePinnable`）
    if (key === 'pin') return pinPinnable;
    if (renderPluginButton(key)) return true;
    const def = registry.find((d) => d.key === key);
    if (!def) return !!resolvePresetDef(key, nodeType as NodeType, userPresets);
    if (def.invisible && !def.lockedTooltip) return false;
    return !!actionMap[key];
  };
  const visibleZones = edit.layout.zones
    .map((zone) => ({ zone, keys: zone.buttonKeys.filter(willRender) }))
    .filter((entry) => entry.keys.length > 0);
  /* 官方 `uPe`（@1485700）：触屏平板（`n4`）且节点未被锁/非只读时，**工具条末尾补一组删除键**。
     桌面端 `n4 === false` ⇒ 不补（桌面上看不到它 ✓）。 */
  const zonesToRender = showTouchDelete
    ? [...visibleZones, { zone: { id: 'zone-touch-delete', name: 'Delete', buttonKeys: ['delete'] }, keys: ['delete'] }]
    : visibleZones;
  if (zonesToRender.length === 0) return null;

  // ── 正常态：按布局渲染 ──
  return (
    <>
      <div
        className="node-floating-toolbar img-toolbar nodrag"
        data-icon-only={lowZoom ? 'true' : undefined}
        /* 官方节点工具栏**行容器**这一层的 Tooltip Provider = **`delayDuration:300`**
           （`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1055675
            `s.jsx(ii,{delayDuration:300,children:s.jsxs("div",{ref:i==="canvas"?m:void 0,…` ⇒ `ii` = TooltipProvider）。
           气泡 `sideOffset:8` 用容器上的 `data-tooltip-offset` 表达（气泡 hook 用 closest 读容器，
           见 useTooltipAutoPlacement） */
        data-tooltip-offset="8"
        data-tooltip-delay="200" /* §106 更正：官方按钮 tooltip **生效值 = 200**（Root 显式值优先于行容器 Provider 300）。
            依据 `live-assets-r100/vendor-packages-JNk8f0_N.js` @404156（`Ta` 显式 `delayDuration:o=200`）
            + `live-assets-r100/vendor-libs-D64ouk08.js` @1382617（`v=s??l.delayDuration`）。 */
        /* ★ 位置/尺寸/缩放**全部由共用规则给**（styles/nodes.css 的 `.node-floating-toolbar`）：
             top  = `var(--float-top)`   ← 官方 `od` 的 `-min(48/zoom, 60)`（Canvas 每帧写在画布根上）
             scale= `var(--float-scale)` ← 官方 `Sh` 的 `1/zoom`
             高度 48 · padding 4 · 容器 gap 4 · 组 gap 2（`.ftb-zone`）· 分隔线 1×18（`.ftb-divider`）
           ⇒ 这里**不再写任何内联几何**，其它节点类型（文本/视频/音频/全景）用的是同一份 ✓ */
        /* ★ 官方容器交互（`cPe` 逐字）：`onClick: m => { m.stopPropagation(); m.preventDefault(); }`
           ⇒ 点工具条本体（按钮之间的空隙 / 组间分隔线 / 容器 padding）不会冒泡到画布：
             不取消选中、不触发画布点选/框选、不让节点开始拖拽（共用实现在 toolbarContainer.ts） */
        onClick={stopToolbarContainerClick}
        {...edit.longPressHandlers}
      >
        {zonesToRender.flatMap(({ zone, keys }, zi) => [
          <div key={zone.id} className="ftb-zone nodrag">
            {keys.map((key) => (
              key === 'delete'
                ? <DeleteToolbarButton key={key} nodeId={_nodeId} />
                : key === TOOLBAR_MORE_KEY
                  ? (
                    <ToolbarMoreMenu
                      key={key}
                      items={hiddenDefaultButtons}
                      renderItem={renderButton}
                      variant="official"
                      onSelect={selectFromMoreMenu}
                      renderIcon={(def) => <DefIcon def={def} />}
                      getRowState={(def) => {
                        if (def.key === 'upscale') {
                          return { disabled: isUpscaling, tooltip: isUpscaling ? '超分处理中...' : def.label };
                        }
                        if (def.key === 'subjectMatting') {
                          return { disabled: isSubjectMattingRunning, tooltip: isSubjectMattingRunning ? '主体识别中...' : def.label };
                        }
                        return undefined;
                      }}
                      /* ★ 官方 `quickSplit` 那一行：行内 chips（2×2/3×3/4×4）+ `›` + 右侧 hover 宫格面板
                         （官方 `ptt` 的 `subActions` + `renderHoverContent` + `onHoverEnd`，逐字同义） */
                      getSubActions={(key) => (key === 'multiGrid' ? quickSplitSubActions : undefined)}
                      renderHoverContent={(key, close) => (key === 'multiGrid' ? renderGridHoverContent(close) : null)}
                      onRowHoverEnd={() => setPreviewGrid(null)}
                    />
                  )
                  : renderButton(key)
            ))}
          </div>,
          // 官方 DOM：分隔线是容器的**直接子节点**（`[ul, div, ul, div, ul]`），不是组内的元素
          ...(zi < zonesToRender.length - 1
            ? [<div key={`divider-${zone.id}`} className="ftb-divider" />]
            : []),
        ])}
      </div>
      {pluginDialog}
      {historyOpen && (
        <Suspense fallback={null}>
          <ImageGenerationHistoryDialog
            isOpen
            nodeId={_nodeId}
            onClose={() => setHistoryOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}

export default memo(ImageNodeToolbar);
