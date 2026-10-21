/**
 * VideoNodeToolbar 视频节点浮动工具栏 + 编辑态支持
 */
import { memo, useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { OfficialIcon } from '../../sidebar/OfficialIcon';
import type { NodeType, BaseNodeData } from '../../../types';
import AnimatedButton from '../../shared/AnimatedButton';
import { useToolbarEdit } from '../../../hooks/useToolbarEdit';
import ToolbarEditor from './toolbar/ToolbarEditor';
import ToolbarMoreMenu from './toolbar/ToolbarMoreMenu';
import PinToolbarButton from './toolbar/PinToolbarButton';
import { readPins, resolvePinnable } from '../../../services/canvasPin';
import { useCanvasPinActions } from '../../../hooks/useCanvasPin';
import { useNodePluginToolbar } from './toolbar/NodePluginToolbarButtons';
import {
  getHiddenDefaultToolbarButtons,
  TOOLBAR_MORE_KEY,
} from './toolbar/toolbarRegistry';
import { stopToolbarContainerClick } from './toolbar/toolbarContainer';
import {
  VIDEO_CAPTURE_FRAME_BTN_TESTID,
  VIDEO_DOWNLOAD_BTN_TESTID,
  VIDEO_FULLSCREEN_BTN_TESTID,
  VIDEO_UPSCALE_BTN_TESTID,
} from './video/officialVideoTestIds';
import {
  OFFICIAL_CAPTURE_FRAME_MENU,
  OFFICIAL_CAPTURE_FRAME_TOOLTIP,
} from './video/officialVideoCaptureFrameMenu';
import { resolvePresetAction, resolvePresetDef, createPresetNode } from './toolbar/presetAction';
import { executeGeneration } from '../../../services/generationService';
import { requestPresetSequence } from '../../../services/presetSequenceService';
import { useAppStore } from '../../../store/useAppStore';
import type { Node } from '@xyflow/react';

/** 截帧位置：首帧 / 播放头当前帧 / 尾帧 */
export type CaptureFramePosition = 'first' | 'current' | 'last';

/* ★ 官方 `x2e` 三帧菜单（key / mode / label 逐字）已抽到 `./video/officialVideoCaptureFrameMenu`。
   MTV 原来那颗自造宫格菜单（`CAPTURE_FRAME_OPTIONS` + `.multigrid-wrap/.multigrid-menu`，图标
   `mdi:page-first|camera-outline|page-last`，文案「导出首帧/导出当前帧/导出尾帧」）已按官方删除。 */

interface VideoNodeToolbarProps {
  nodeId: string;
  onCaptureFrame: (position: CaptureFramePosition) => void;
  onFullscreen: () => void;
  onCopyFile: () => void;
  onReversePrompt: () => void;
  onShowPrompt: () => void;
  isReversingPrompt?: boolean;
  /** 官方 `k = data.src`：工具栏每颗键的 `invisible/disabled` 都以「有没有视频源」为首要门 */
  hasSrc?: boolean;
  /** 官方 `saveToLibrary` → `vp().openForNodes([nodeId])`（选素材库文件夹后保存） */
  onSaveToLibrary?: () => void;
  /** 官方 `download` → `Rg.downloadNodes(nodeId)`；`isDownloading` 时禁用 */
  onDownload?: () => void;
  isDownloading?: boolean;
  /**
   * 官方 `upscale`（`P("upscale")`）：在当前节点右侧 `+100px` **新建一个视频增强节点**，
   * 复制宽高并连 `source:e -> target:Q.id`。
   * MTV 的新建节点由 `VideoNode` 负责（它才知道节点位置/尺寸）⇒ 这里只声明回调。
   */
  onUpscale?: () => void;
  isUpscaling?: boolean;
}

function VideoNodeToolbar({
  nodeId, onCaptureFrame, onFullscreen, onCopyFile, onReversePrompt, onShowPrompt, isReversingPrompt,
  hasSrc = true, onSaveToLibrary, onDownload, isDownloading = false,
  onUpscale, isUpscaling = false,
}: VideoNodeToolbarProps) {
  const nodeType = 'ai-video';
  const edit = useToolbarEdit({ nodeType });
  const registry = edit.registry;
  const pluginToolbar = useNodePluginToolbar({ nodeId });
  const userPresets = useAppStore((s) => s.userPresets);
  const addNodeWithEdge = useAppStore((s) => s.addNodeWithEdge);

  /* ── §113 官方 Pin（视频与图像**共用同一支** `v0`，`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @838584）──
     官方工具对象 = `{key:"pin",buttonType:"unwrapped",node:<eLe pins onToggle/>}`，门 = `!readonly && pinnable`
     （`nLe(e)` 的 `pinnable` ⇒ MTV `resolvePinnable`；`ai-video` 在 `PINNABLE_KIND` 里是 `'video'`、要 `hasSrc`）。
     ⇔ 与 `ImageNodeToolbar.tsx:244-251` 逐字同一套读法，直接用同一个 `PinToolbarButton`。 */
  const pinNodeData = useAppStore((s) => s.nodes.find((n) => n.id === nodeId)?.data);
  const pinPins = useMemo(() => readPins(pinNodeData), [pinNodeData]);
  const pinPinnable = useMemo(
    () => resolvePinnable({ type: nodeType, data: pinNodeData }, { hasContent: hasSrc }).pinnable,
    [pinNodeData, hasSrc],
  );
  const { togglePinOnNode } = useCanvasPinActions();

  // ── 截帧子菜单：与图像节点的宫格菜单同一套结构与样式 ──
  const handlePresetClick = useCallback(
    (key: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      // 实时从 store 读取，避免闭包过期导致对话框内容/ @引用丢失
      const liveNode = useAppStore.getState().nodes.find((n) => n.id === nodeId) as Node<BaseNodeData> | undefined;
      if (!liveNode) return;
      const livePrompt = (liveNode.data?.prompt as string) ?? '';
      const livePresets = useAppStore.getState().userPresets;
      if (requestPresetSequence(key, nodeType as NodeType, nodeId, livePresets)) return;
      const resolved = resolvePresetAction(key, nodeType as NodeType, livePrompt, livePresets);
      if (!resolved) return;
      const { node: newNode, edge } = createPresetNode(liveNode, resolved);
      addNodeWithEdge(newNode, edge);
      executeGeneration(newNode.id, newNode.data.prompt, resolved.postProcess, newNode.data);
    },
    [nodeId, addNodeWithEdge],
  );

  const actionMap: Record<string, (e: React.MouseEvent) => void> = {
    copyFile: (e) => { e.stopPropagation(); onCopyFile(); },
    showPrompt: (e) => { e.stopPropagation(); onShowPrompt(); },
    reversePrompt: (e) => { e.stopPropagation(); if (!isReversingPrompt) onReversePrompt(); },
    scale: (e) => { e.stopPropagation(); onFullscreen(); },
    saveToLibrary: (e) => {
      e.stopPropagation();
      if (onSaveToLibrary) { onSaveToLibrary(); return; }
      /* 官方 `saveToLibrary` → `vp().openForNodes([nodeId])`（选素材库文件夹）
         ⇒ MTV 复用节点右键「保存到素材库」的同一个 store action（与图像/文本工具栏同一口径） */
      useAppStore.getState().openSaveToLibraryMenu(nodeId, { x: e.clientX, y: e.clientY });
    },
    download: (e) => { e.stopPropagation(); if (!isDownloading) onDownload?.(); },
    upscale: (e) => { e.stopPropagation(); if (!isUpscaling) onUpscale?.(); },
  };
  /**
   * 官方每颗键的 `invisible` / `disabled`（桌面版 `course-api-base-url-DmmB7bTf.js`
   * @2685052（右组 I）/ @2685552（左组 F）逐字；`k = data.src`、`t = disabled`）：
   *   · 左组 `upscale` / `video_frame_capture`：`invisible: !k || t`、`disabled: !k || t(...)`
   *   · 右组 `saveToLibrary` / `scale`：      `invisible: !k || t`、`disabled: !k || t`
   *   · 右组 `download`：                      `disabled: !k || t || isDownloading`
   * ⚠️ 左组首项 `invisible` 里还有 `C = Qs()`（运行时能力谓词）⇒ 静态包拿不到它的业务含义，
   *    MTV 不做等价猜测（`!k` 这一半是逐字可证的）。
   */
  const gating: Record<string, { invisible: boolean; disabled: boolean }> = {
    upscale: { invisible: !hasSrc, disabled: !hasSrc || isUpscaling },
    /* §96 键名照官方 `xXe` 逐字：`video_frame_capture`(@1975961) / `scale`(@1974297) */
    video_frame_capture: { invisible: !hasSrc, disabled: !hasSrc },
    saveToLibrary: { invisible: !hasSrc, disabled: !hasSrc },
    scale: { invisible: !hasSrc, disabled: !hasSrc },
    download: { invisible: !hasSrc, disabled: !hasSrc || isDownloading },
  };
  const hiddenDefaultButtons = getHiddenDefaultToolbarButtons(registry, edit.activeButtonKeys)
    .filter((button) => !gating[button.key]?.invisible);

  const renderActionButton = (key: string) => {
    const pluginButton = pluginToolbar.renderButton(key);
    if (pluginButton) return pluginButton;
    const def = registry.find((button) => button.key === key);
    const handler = actionMap[key];
    const isPreset = !def;

    /* ── §113 官方 `pin`（`buttonType:"unwrapped"`，自带 popover、**不走 actionMap**）──
       必须插在下面那条「没有 def 就按 preset 分流」**之前**，否则会被当成 MTV 自造 preset
       去走 `resolvePresetDef`/建卡分支（图像工具栏 `ImageNodeToolbar.tsx:288-299` 同一处置）。
       官方 `v0` 的门 = `!t || !n ? null` ⇒ **只读或不可 pin 时整组不渲染**（这里返回 null，
       外层 `visibleKeys` 也按 `pinPinnable` 过滤，避免留下一个空组 + 多余分隔线）。 */
    if (key === 'pin' && def) {
      if (!pinPinnable) return null;
      return (
        <PinToolbarButton
          key={key}
          pins={pinPins}
          onToggle={(groupId) => togglePinOnNode(nodeId, groupId)}
        />
      );
    }

    const presetDef = !def ? resolvePresetDef(key, nodeType as NodeType, userPresets) : null;
    if (!def && !presetDef) return null;

    const resolvedDef = def ?? { key, label: presetDef!.label, icon: presetDef!.icon, defaultZone: '' };
    const clickHandler = handler ?? handlePresetClick(key);
    /* 官方 `Wce` 的禁用/锁定外观（`cursor-not-allowed opacity-40`）由 `.ftb-btn:disabled` 承载 */
    const gate = gating[key];
    const gatedDisabled = !def ? undefined : gate?.disabled;

    /* ══ 官方 `video_frame_capture`：`buttonType:"more"` 的**三帧下拉** ══
       桌面版 `course-api-base-url-DmmB7bTf.js@2687052` 逐字：
         `{ node: a.jsx(y8,{size:20}), buttonType:"more", key:"video_frame_capture",
            tooltip: y("video.captureFrame"),            // =「截帧」
            dataTestId: fn.CANVAS.NODE.VIDEO.CAPTURE_FRAME_BTN, tooltipInsideTrigger:!0,
            invisible: !k || C || t, disabled: !k || t || U,   // U = isCapturing
            menuItems: x2e.map($ => ({ key:$.key, label:y($.labelKey), handle:()=>{ V($.mode) },
                                       lockedTooltip: i("video_frame_capture", K) })) }`
       `x2e` 在 @2680931，三项 key/mode/labelKey 逐字；**三项都没有 `icon`** ⇒ 不编造图标。
       ⇒ 复用官方菜单外壳（`ToolbarMoreMenu` 的 `official` 竖向行 = 官方 `dPe` 菜单），
         只把触发器换成这颗键自己的 tooltip / testid / 图标。 */
    if (key === 'video_frame_capture') {
      const captureMenuItems = OFFICIAL_CAPTURE_FRAME_MENU.map((item) => ({
        key: item.key,
        label: item.label,
        disabled: gate?.disabled,
      }));
      return (
        <ToolbarMoreMenu
          key={key}
          variant="official"
          items={captureMenuItems}
          renderItem={() => null}
          trigger={{
            label: OFFICIAL_CAPTURE_FRAME_TOOLTIP,
            icon: resolvedDef.icon,
            className: 'ftb-btn icon-only act-captureFrame',
            testId: VIDEO_CAPTURE_FRAME_BTN_TESTID,
            /* 官方 `disabled: !k || t || U`（U = isCapturing） */
            disabled: gate?.disabled,
          }}
          /* 官方 `handle:()=>{ V($.mode) }` —— 点行执行对应帧位；菜单自身会在点击后关闭 */
          onSelect={(menuKey) => {
            const picked = OFFICIAL_CAPTURE_FRAME_MENU.find((option) => option.key === menuKey);
            if (picked) onCaptureFrame(picked.mode);
          }}
          getRowState={() => ({ disabled: gate?.disabled })}
        />
      );
    }

    const isReversing = key === 'reversePrompt' && isReversingPrompt;
    return (
      <AnimatedButton
        key={key}
        className={`ftb-btn icon-only ${isPreset ? 'act-preset' : `act-${key}`}`}
        data-testid={key === 'upscale' ? VIDEO_UPSCALE_BTN_TESTID
          : key === 'download' ? VIDEO_DOWNLOAD_BTN_TESTID
            : key === 'scale' ? VIDEO_FULLSCREEN_BTN_TESTID
              : undefined}
        data-tooltip={isReversing ? '反推中...' : resolvedDef.label}
        aria-label={resolvedDef.label}
        disabled={isReversing || gatedDisabled}
        onClick={clickHandler}
      >
        {/* ══ §93 官方图标恒为 **20×20 内联 SVG** ══
            官方 `xXe`（canvas @1970284）里每颗键都逐字 `node:s.jsx(<官方图标>,{size:20})`：
              `Zv`(saveToLibrary) · `fq`(download) · `Mx`(scale) · `m2`(clip) · `gq`(upscale) ·
              `Cpe`/`hq`/`oW`/`Npe`/`Tpe`/`xq` —— **全部 `size:20`**（`oW`/`Npe` 另带 `stroke:1.75`）。
            MTV 原来渲染 iconify 图标是 **14×14**（`width/height` 两个 prop 都写 14）⇒ 与官方真机读数
            （`svg width=20`）不符。
            ⇒ 与图像工具栏同一套（`ImageNodeToolbar.tsx:74` 的 `DefIcon`）：
              有 `officialIcon`（= 本仓 `assets/official-icons/` 里已逐字落库的官方 SVG）就用它，20×20；
              没有官方件时才退回 iconify，但**尺寸同样 20**（不再 14）。 */}
        {resolvedDef.officialIcon
          ? <OfficialIcon name={resolvedDef.officialIcon} size={20} />
          : <Icon icon={resolvedDef.icon} width={20} height={20} />}
      </AnimatedButton>
    );
  };

  if (edit.isEditing) {
    return <ToolbarEditor edit={edit} nodeType={nodeType} />;
  }

  return (
    <>
      <div
        /* ══ §95b 行容器 = 官方 `r3e`（`vendor-pkg-canvas-CvbAwZyy.js` @1063665）**逐字** ══
           官方原文：
           ```js
           s.jsx("div",{ref:i==="canvas"?m:void 0,
             onClick:h=>{h.stopPropagation(),h.preventDefault()},
             style:{...r,...f,"--float-y":"-100%","--float-offset":"12px",transformOrigin:"center bottom"},
             className:z("nodrag cursor-default w-fit h-12 p-1 rounded-full flex flex-nowrap items-center
                          justify-between bg-popover border z-10 whitespace-nowrap gap-1 text-white/90",
                        "node-float-ui-visible", t),
             "data-testid":At.CANVAS.NODE.TOOLBAR, ...l,
             children:[ … s.jsx("ul",{className:"flex flex-nowrap items-center gap-[2px] justify-between w-full border-primary-border", …}),
                        … s.jsx("div",{className:"w-px h-[18px] bg-primary-border"}) … ]})
           ```
           🚫 已删除 MTV 自造/串味的类名 `img-toolbar`（**图像节点专属**的 MTV 钩子：
           `styles/nodes-image.css:17` `[data-theme='dark'] .img-toolbar{background:rgb(38,38,38)}`；
           官方视频工具栏里没有任何 image 类；深色底色 `.node-floating-toolbar` 已经给了同一值
           ⇒ 去掉后**零视觉变化**，只是不再借用图像节点的类名）。
           ⚠️ 2026-10-14 更正：那条规则**当前是生效的** —— 同一处「插入 nodes-mockup」的补丁
           曾把 `src/index.css` 里的 `@import './styles/nodes-image.css';` 整行顶掉（现已补回，
           并加了不变量测试 `tests/styles/indexCssImports.test.ts`）；本条只引用它，未受影响。
           `.node-floating-toolbar` 保留 = MTV 的**几何载体**（`top:var(--float-top)` /
           `transform: … scale(var(--float-scale))` / `h-12 p-1 gap-1` 全在里面，
           与官方 `.node-float-ui-visible` 的 transform 同值）——与 `GroupNodeToolbar.tsx:379`
           完全同一口径（那边也是 `node-floating-toolbar … + 官方逐字串 + node-float-ui-visible`）。 */
        className="node-floating-toolbar nodrag cursor-default w-fit h-12 p-1 rounded-full flex flex-nowrap items-center justify-between bg-popover border z-10 whitespace-nowrap gap-1 text-white/90 node-float-ui-visible"
        /* §96 官方行容器的 Tooltip Provider = **`delayDuration:300`**
           （`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1055675
            `s.jsx(ii,{delayDuration:300,children:s.jsxs("div",{ref:i==="canvas"?m:void 0,…className:"nodrag cursor-default
             w-fit h-12 p-1 rounded-full …"})})` —— 就是本行容器这一层；`ii` = `TooltipProvider`）。
           ⚠️ 旧注释引的是上一版构建 `vendor-pkg-canvas-CvbAwZyy.js` @1063432 —— 官方 2026-10-14
           更新过构建，该产物名/偏移已失效，现按 r100 dump 重新逐字定位。
           MTV 原来写的 200 取自另一处 Tooltip 原语（per-tooltip 包装组件）的默认值 ⇒ 改成 300。
           `data-tooltip-offset="8"`（气泡间距）**本轮不动**：那一项没在本轮取证范围内。 */
        data-tooltip-offset="8"
        data-tooltip-delay="200" /* §106 更正：官方按钮的**生效值**是 200，不是行容器 Provider 的 300。
            按钮经 `Ta` 渲染，`Ta` 给 radix Root 显式传 `delayDuration`(默认 200)，Root 取 `s ?? l.delayDuration`
            ⇒ 显式值盖掉外层 Provider。依据 `live-assets-r100/vendor-packages-JNk8f0_N.js` @404156 +
            `live-assets-r100/vendor-libs-D64ouk08.js` @1382617。⚠️ 本行下方 252-254 行旧注释说的「改成 300」已作废。 */
        /* ★ 官方容器交互（`cPe`）：stopPropagation + preventDefault —— 点工具条本体不冒泡到画布 */
        onClick={stopToolbarContainerClick}
        {...edit.longPressHandlers}
      >
        {/* ★ 位置/尺寸/缩放/组/分隔线全部由共用规则给（styles/nodes.css）：原来这里**连官方定位公式都没写** ✗，
            现在 top = `var(--float-top)`（官方 `od` 的 -min(48/zoom,60)）、scale = `var(--float-scale)`（1/zoom）。
            ★ 官方项级门：`invisible` 为真且没有 `lockedTooltip` 的键**直接不渲染**
              （官方 `Wce`/`cPe`：`g?.invisible !== !0 || !!g?.lockedTooltip`）—— 这里对**主行**同样过滤，
              否则「没有 src」时仍会渲染一排禁用键（官方是整排消失）。 */}
        {edit.layout.zones.flatMap((zone, zi) => {
          const visibleKeys = zone.buttonKeys.filter((key) => (
            key === TOOLBAR_MORE_KEY
              ? hiddenDefaultButtons.length > 0
              /* §113 官方 `v0` 的门：`!readonly || !pinnable ⇒ null` ⇒ 不可 pin 时该组整组缺席 */
              : key === 'pin'
                ? pinPinnable
                : !gating[key]?.invisible
          ));
          if (visibleKeys.length === 0) return [];
          return [
            <div key={zone.id} className="ftb-zone nodrag">
              {visibleKeys.map((key) => (
                key === TOOLBAR_MORE_KEY
                  ? (
                    <ToolbarMoreMenu
                      key={key}
                      items={hiddenDefaultButtons}
                      renderItem={renderActionButton}
                    />
                  )
                  : renderActionButton(key)
              ))}
            </div>,
            ...(zi < edit.layout.zones.length - 1
              ? [<div key={`divider-${zone.id}`} className="ftb-divider" />]
              : []),
          ];
        })}
      </div>
      {pluginToolbar.dialog}
    </>
  );
}

export default memo(VideoNodeToolbar);
