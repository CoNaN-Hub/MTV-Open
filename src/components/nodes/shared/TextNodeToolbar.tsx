/**
 * TextNodeToolbar 文本节点浮动工具栏 + 编辑态支持
 *
 * ★ 官方依据（EXE `zoom-slider-3ZcFvYQO.js` @3386555 `not`；`GenerateTextNode`/`PureTextNode` 共用）：
 *     组 1 `p = [ {背景色 color-picker} ]`                                  // `mQ`，tooltip=背景颜色
 *     组 2 `f = [ (pin)?, 复制全部, 保存到素材库, (canEdit)? 全屏 ]`          // 顺序逐字；pin = `hx`
 *     `if (isReadonly) return []`（只读 ⇒ 整套为空）· 组间一根 `w-px h-[18px]` 分隔线
 *   图标：复制全部 = `yU`(CopyButton) 内 **16px**（Tabler copy / check）· 保存到素材库 / 全屏 = **18px**
 *   ⚠️ 官方**没有**「清除空行 / 查看提示词」⇒ MTV 自有功能，只进 ⋯（`defaultHidden`）
 *   ⚠️ 官方组 1 的「背景色」需要文本卡有颜色字段；MTV 文本卡暂无 ⇒ 该组为空，
 *      容器按官方「空组跳过」规则不渲染它（`visibleZones`）。
 */
import { memo, useCallback, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import type { BaseNodeData, NodeType, ToolbarButtonDef, ToolbarMenuRowDef } from '../../../types';
import AnimatedButton from '../../shared/AnimatedButton';
import { useToolbarEdit } from '../../../hooks/useToolbarEdit';
import ToolbarEditor from './toolbar/ToolbarEditor';
import ToolbarMoreMenu from './toolbar/ToolbarMoreMenu';
import PinToolbarButton from './toolbar/PinToolbarButton';
import ColorPickerButton from './toolbar/ColorPickerButton';
import DeleteToolbarButton from './toolbar/DeleteToolbarButton';
import { isTouchTabletDevice } from '../../../utils/touchDevice';
import { OfficialIcon } from '../../sidebar/OfficialIcon';
import { readPins, resolvePinnable } from '../../../services/canvasPin';
import { useCanvasPinActions } from '../../../hooks/useCanvasPin';
import { useNodePluginToolbar } from './toolbar/NodePluginToolbarButtons';
import {
  getHiddenDefaultToolbarButtons,
  TOOLBAR_MORE_KEY,
} from './toolbar/toolbarRegistry';
import { stopToolbarContainerClick } from './toolbar/toolbarContainer';
import { resolvePresetAction, resolvePresetDef, createPresetNode } from './toolbar/presetAction';
import { executeGeneration } from '../../../services/generationService';
import { requestPresetSequence } from '../../../services/presetSequenceService';
import { useAppStore } from '../../../store/useAppStore';
import type { Node } from '@xyflow/react';
import { useStore, type ReactFlowState } from '@xyflow/react';

interface TextNodeToolbarProps {
  nodeId: string;
  data: BaseNodeData;
  onCopy: (text: string) => void;
  onClearEmptyLines: () => void;
  onShowPrompt: () => void;
  onFullscreen: () => void;
}

/** 图标：有官方原版 SVG 用它（尺寸取该项的 `officialIconSize`，默认 20），否则退回 iconify
 *  ⚠️ 形参收 `ToolbarMenuRowDef`（`icon` 可选的超集）—— 本函数也被「⋯」菜单**行**复用，
 *     而官方菜单行允许没有 `icon`（见 `ToolbarMenuRowDef` 的注释）。 */
function DefIcon({ def }: { def: ToolbarMenuRowDef }) {
  if (def.officialIcon) return <OfficialIcon name={def.officialIcon} size={def.officialIconSize ?? 20} />;
  if (!def.icon) return null;
  return <Icon icon={def.icon} width={14} height={14} />;
}

function TextNodeToolbar({ nodeId, data, onCopy, onClearEmptyLines, onShowPrompt, onFullscreen }: TextNodeToolbarProps) {
  const nodeType = 'ai-text';
  // ★ 官方 `dPe`：`y = isFitZoomDisplay && zoom !== undefined ? zoom < .2 : false`
  //   画布缩放到 0.2 以下 ⇒ 按钮退化为纯图标（文字不再显示，文案交给 tooltip 承载）
  const canvasZoom = useStore((s: ReactFlowState) => s.transform[2]);
  const lowZoom = canvasZoom < 0.2;
  const edit = useToolbarEdit({ nodeType });
  const registry = edit.registry;
  const pluginToolbar = useNodePluginToolbar({ nodeId, iconSize: 12, rounded: true });
  const userPresets = useAppStore((s) => s.userPresets);

  const updateNodeData = useAppStore((s) => s.updateNodeData);
  const [copied, setCopied] = useState(false);

  /* 官方 `n4`：只有触屏平板才在工具条末尾补删除键（桌面端没有）*/
  const showTouchDelete = useMemo(() => isTouchTabletDevice(), []);

  // ── 官方 Pin（`S7` 读 + `uIe` 门控 + `mIe` 写）——文本节点官方恒 `pinnable` ✓ ──
  const pinNodeData = useAppStore((s) => s.nodes.find((n) => n.id === nodeId)?.data);
  const pinPins = useMemo(() => readPins(pinNodeData), [pinNodeData]);
  const pinPinnable = useMemo(
    () => resolvePinnable({ type: nodeType, data: pinNodeData }).pinnable,
    [pinNodeData],
  );
  const { togglePinOnNode } = useCanvasPinActions();

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!data.output) return;
      onCopy(data.output);
      setCopied(true);
      /* 官方 `yU`：`copyTimeout = 2000ms` 后回到默认态 */
      setTimeout(() => setCopied(false), 2000);
    },
    [data.output, onCopy],
  );

  const handleClearEmptyLines = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!data.output) return;
      onClearEmptyLines();
    },
    [data.output, onClearEmptyLines],
  );

  const addNodeWithEdge = useAppStore((s) => s.addNodeWithEdge);

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
      // 强制用带 @ 引用的 prompt（createPresetNode 已拼好）
      executeGeneration(newNode.id, newNode.data.prompt as string, resolved.postProcess, newNode.data);
    },
    [nodeId, addNodeWithEdge],
  );

  const actionMap = useMemo<Record<string, (e: React.MouseEvent) => void>>(() => ({
    copy: handleCopy,
    clearEmptyLines: handleClearEmptyLines,
    showPrompt: (e) => { e.stopPropagation(); onShowPrompt(); },
    fullscreen: (e) => { e.stopPropagation(); onFullscreen(); },
    /* ★ 官方「保存到素材库」= 先选素材库文件夹（`library.selectFolder`）→ 落盘 →
       toast「已保存到「{folder}」」（`library.savedToFolder`）；与右键卡片菜单**同一个动作** ✓ */
    saveToLibrary: (e) => { e.stopPropagation(); useAppStore.getState().openSaveToLibraryMenu(nodeId, { x: e.clientX, y: e.clientY }); },
    // `pin` 不在这里 —— 官方是 `buttonType:"unwrapped"`（自带 popover），由 `PinToolbarButton` 单独渲染
  }), [handleCopy, handleClearEmptyLines, onShowPrompt, onFullscreen, nodeId]);
  const hiddenDefaultButtons = getHiddenDefaultToolbarButtons(registry, edit.activeButtonKeys);

  const renderActionButton = (key: string) => {
    const pluginButton = pluginToolbar.renderButton(key);
    if (pluginButton) return pluginButton;
    const def = registry.find((button) => button.key === key);
    const handler = actionMap[key];
    const isPreset = !def;

    const presetDef = !def ? resolvePresetDef(key, nodeType as NodeType, userPresets) : null;
    if (!def && !presetDef) return null;

    const resolvedDef: ToolbarButtonDef = def ?? {
      key,
      label: presetDef!.label,
      icon: presetDef!.icon,
      defaultZone: '',
    } as ToolbarButtonDef;
    const clickHandler = handler ?? handlePresetClick(key);

    // ── 官方 `hx`：Pin 是 `buttonType:"unwrapped"`（自带 popover、不走 actionMap），先分流 ──
    if (key === 'pin' && def) {
      const locked = def.lockedTooltip;
      if (def.invisible && !locked) return null;
      return (
        <PinToolbarButton
          key={key}
          pins={pinPins}
          disabled={!!def.disabled || !!locked}
          onToggle={(groupId) => togglePinOnNode(nodeId, groupId)}
        />
      );
    }

    // ── 官方第 1 组「背景颜色」= `mQ`（色盘弹层；官方该项 `handle` 是空函数）──
    if (key === 'color-picker') {
      return (
        <ColorPickerButton
          key={key}
          color={(data.color as string | undefined) ?? ''}
          disabled={!!def?.disabled || !!def?.lockedTooltip}
          onColorChange={(color) => updateNodeData(nodeId, { color })}
        />
      );
    }

    // ★ 官方项级门（`cPe`：`g?.invisible!==!0||!!g?.lockedTooltip`）
    //   invisible 且无 lockedTooltip ⇒ 该项不渲染；有 lockedTooltip ⇒ 禁用 + 锁定提示
    if (def && def.invisible && !def.lockedTooltip) return null;
    const locked = def?.lockedTooltip;
    const lockedOrDisabled = !!def?.disabled || !!locked;

    /* 官方「复制全部」（`yU` CopyButton）：已复制态换图标 + 文案（`copied` = 已复制） */
    if (key === 'copy' && copied) {
      return (
        <AnimatedButton
          key={key}
          className={`ftb-btn icon-only act-copy${locked ? ' is-locked' : ''}`}
          data-tooltip={locked ?? '已复制'}
          aria-label="已复制"
          disabled={lockedOrDisabled}
          onClick={clickHandler}
        >
          <OfficialIcon name="copied" size={16} />
        </AnimatedButton>
      );
    }

    return (
      <AnimatedButton
        key={key}
        className={`ftb-btn icon-only${isPreset ? ' act-preset' : ''} act-${key}${locked ? ' is-locked' : ''}`}
        data-tooltip={locked ?? resolvedDef.label}
        aria-label={resolvedDef.label}
        disabled={lockedOrDisabled}
        onClick={clickHandler}
      >
        <DefIcon def={resolvedDef} />
      </AnimatedButton>
    );
  };

  /** ⋯ 菜单行点击 → 派发到工具栏自己的 actionMap（官方菜单行的行为就是执行该项） */
  const selectFromMoreMenu = useCallback((key: string) => {
    const handler = actionMap[key];
    if (!handler) return;
    handler({ stopPropagation() {}, preventDefault() {} } as unknown as React.MouseEvent);
  }, [actionMap]);

  // ── 编辑态 ──
  if (edit.isEditing) {
    return <ToolbarEditor edit={edit} nodeType={nodeType} />;
  }

  // ── 官方容器门：`d.every(m=>m.length===0) ? null`（所有组都空 ⇒ 整个工具栏不渲染）──
  const willRender = (key: string): boolean => {
    if (key === TOOLBAR_MORE_KEY) return hiddenDefaultButtons.length > 0;
    // 官方 `hx` 的门：`!readonly && pinnable`（文本节点官方恒 pinnable；锁定态仍渲染）
    if (key === 'pin') return pinPinnable || !!registry.find((button) => button.key === 'pin')?.lockedTooltip;
    /* 官方第 1 组「背景颜色」恒渲染（官方 `p` 组不受 pinnable 之类门控）*/
    if (key === 'color-picker') return true;
    if (pluginToolbar.renderButton(key)) return true;
    const def = registry.find((button) => button.key === key);
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
        className="node-floating-toolbar text-toolbar nodrag"
        data-icon-only={lowZoom ? 'true' : undefined}
        /* ★ 官方节点工具栏**行容器**这一层的 Tooltip Provider = **`delayDuration:300`**
           （`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1055675
            `s.jsx(ii,{delayDuration:300,children:s.jsxs("div",{ref:i==="canvas"?m:void 0,…` ⇒ `ii` = TooltipProvider）。
           气泡 `sideOffset: 8` · `side: "top"` · `align: "center"` 里的间距用容器 `data-tooltip-offset` 表达
           （气泡 hook 用 closest 读容器）。
           ⚠️ 之前**漏了这两个属性** ⇒ 气泡按官方原语默认 `sideOffset:4` 贴太近（用户：「纵向间距不对」✗） */
        data-tooltip-offset="8"
        data-tooltip-delay="200" /* §106 更正：官方按钮 tooltip **生效值 = 200**（Root 显式值优先于行容器 Provider 300）。
            依据 `live-assets-r100/vendor-packages-JNk8f0_N.js` @404156 + `vendor-libs-D64ouk08.js` @1382617。 */
        /* ★ 位置/尺寸/缩放/组/分隔线**全部由共用规则给**（styles/nodes.css `.node-floating-toolbar`
           + `.ftb-zone` + `.ftb-divider`）：top = `var(--float-top)`（官方 `od`）、
           scale = `var(--float-scale)`（官方 `Sh` 的 1/zoom）。
           ⇒ 这里**不再写内联 top / --float-y / transformOrigin**（原来那套是"每种节点各写一遍"的坑）。 */
        /* ★ 官方容器交互（`cPe` 逐字）：`onClick: m => { m.stopPropagation(); m.preventDefault(); }`
           ⇒ 点工具条本体（按钮之间的空隙 / 组间分隔线 / 容器 padding）不冒泡到画布 */
        onClick={stopToolbarContainerClick}
        {...edit.longPressHandlers}
      >
        {zonesToRender.flatMap(({ zone, keys }, zi) => [
          <div key={zone.id} className="ftb-zone nodrag">
            {keys.map((key) => (
              key === 'delete'
                ? <DeleteToolbarButton key={key} nodeId={nodeId} />
                : key === TOOLBAR_MORE_KEY
                  ? (
                    <ToolbarMoreMenu
                      key={key}
                      items={hiddenDefaultButtons}
                      renderItem={renderActionButton}
                      variant="official"
                      onSelect={selectFromMoreMenu}
                      renderIcon={(def) => <DefIcon def={def} />}
                    />
                  )
                  : renderActionButton(key)
            ))}
          </div>,
          // 官方 DOM：分隔线是容器的直接子节点（原来是塞在组内 → 与官方不一致）
          ...(zi < zonesToRender.length - 1
            ? [<div key={`divider-${zone.id}`} className="ftb-divider" />]
            : []),
        ])}
      </div>
      {pluginToolbar.dialog}
    </>
  );
}

export default memo(TextNodeToolbar);
