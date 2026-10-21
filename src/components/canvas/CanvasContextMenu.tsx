/**
 * CanvasContextMenu 画布右键菜单 — 在画布空白区域右键弹出：上传 / 添加资产 / 添加节点 / 添加辅助工具 /
 * 撤销 / 重做 / 粘贴（条目与顺序按官方 `HANDLE_MENU`；官方**没有子菜单**）
 */
import { memo, useLayoutEffect, useState } from 'react';
import { calcFixedPosition } from '../../utils/popupPosition';
import { useT } from '../../i18n';
import { useMenuActiveRow } from '../../hooks/useMenuActiveRow';

const IS_MAC_OS = typeof navigator !== 'undefined'
  && /Macintosh|Mac OS X/.test(navigator.userAgent);
const MENU_SHORTCUTS = {
  /* ★ 快捷键串按官方逐字（官方条目文本实测：「复制CtrlC」「粘贴CtrlV」「撤销CtrlZ」「重做ShiftCtrlZ」「删除⌫,del」）
     ⚠️ 官方在 macOS 上的写法未实测（官方窗口只有 Windows 版），此处保留 ⌘ 映射。 */
  copy: IS_MAC_OS ? '⌘C' : 'CtrlC',
  paste: IS_MAC_OS ? '⌘V' : 'CtrlV',
  undo: IS_MAC_OS ? '⌘Z' : 'CtrlZ',
  redo: IS_MAC_OS ? '⇧⌘Z' : 'ShiftCtrlZ',
  delete: IS_MAC_OS ? '⌫,del' : '⌫,del',
};

/** 菜单项行高估算（含 padding） */
const ROW_HEIGHT = 28;
/** 菜单 padding + border 估算 */
const MENU_PADDING = 10;
/** 根菜单项数（上传 + 添加资产 + 添加节点 + 添加辅助工具 + 撤销 + 重做 + 粘贴 = 7 行 / 3 分隔线） */
const L1_ITEM_COUNT = 7;
const L1_SEP_COUNT = 3;

/** 估算菜单高度 */
function estMenuHeight(items: number, seps: number = 0): number {
  return items * ROW_HEIGHT + seps * 8 + MENU_PADDING;
}

/** 估算菜单宽度 */
function estMenuWidth(itemCount: number): number {
  // 最宽的情况：生成文本 (约 170px with padding)
  return Math.max(176, itemCount > 2 ? 180 : 160);
}

interface CanvasContextMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  menuRef: React.RefObject<HTMLDivElement | null>;
  onUndo: () => void;
  onRedo: () => void;
  onPaste: () => void;
  hasSelection: boolean;
  /** ★ 官方空白菜单第 2 项「添加资产」（canvas-pane-context-menu-add-asset-item）⇒ 打开 MTV 素材库面板 */
  onAddAsset: () => void;
  /** ★ 官方空白菜单第 3 项「添加节点」（`nodes.addBlock` / new-block-item）：
   *  在点击处插入 command 节点并弹出 command 面板（`source:'right_click'`） */
  onInsertCommandNode: () => void;
  /** ★ 官方空白菜单第 4 项「添加辅助工具」（`nodes.addUtilities` / add-utilities-item）：
   *  同一个 command 节点 + `menuMode:'utility'` ⇒ 面板只渲染「辅助工具」组（含「图片编辑器」） */
  onInsertUtilityNode: () => void;
  /** ★ 官方空白菜单第一项「上传」（HANDLE_MENU.UPLOAD_ITEM）—— 画布级上传，落成点击处的节点 */
  onUpload: () => void;
  /* ⚠️ `onCreateFolder/onDelete/onCopyNodes/onCopyFiles/onOpenProjectDir/hasSelection` 等旧菜单残留接口
     已被官方条目的实现逐步替换掉；这里不再保留子菜单相关的 `onShowSubmenu/onHideSubmenu` ✗ */
}

function CanvasContextMenu({
  visible,
  position,
  menuRef,
  onUndo,
  onRedo,
  onPaste,
  onAddAsset,
  onInsertCommandNode,
  onInsertUtilityNode,
  onUpload,
}: CanvasContextMenuProps) {
  const t = useT();
  /* ★ 官方 cmdk：菜单打开即高亮首项，并支持 ↑/↓ 移动（底色 #2b2b2b） */
  useMenuActiveRow({ menuRef, visible });
  // 估算值仅用于首次布局；挂载后使用真实 DOM 尺寸修正，避免菜单项变化或界面缩放导致底部被裁切。
  const [l1Pos, setL1Pos] = useState<{ left: number; top: number } | null>(null);

  const l1Height = estMenuHeight(L1_ITEM_COUNT, L1_SEP_COUNT);
  const l1Width = estMenuWidth(L1_ITEM_COUNT);

  // 计算 Level 1 菜单的安全位置
  const safeL1 = calcFixedPosition(position.x, position.y, l1Width, l1Height);

  // 当 L1 渲染后，先按真实尺寸修正根菜单，再计算子菜单位置。
  useLayoutEffect(() => {
    if (!visible) return;
    const l1El = menuRef.current;
    if (!l1El) return;

    const safeViewportPos = calcFixedPosition(
      position.x,
      position.y,
      l1El.offsetWidth,
      l1El.offsetHeight,
    );
    // contain: paint 会让画布视口成为 fixed 定位容器，样式坐标需换算到该容器内。
    const fixedContainer = l1El.closest<HTMLElement>('.app-canvas-viewport');
    const fixedContainerRect = fixedContainer?.getBoundingClientRect();
    const nextL1 = {
      left: safeViewportPos.left - (fixedContainerRect?.left ?? 0),
      top: safeViewportPos.top - (fixedContainerRect?.top ?? 0),
    };
    setL1Pos((current) => (
      current?.left === nextL1.left && current.top === nextL1.top ? current : nextL1
    ));
  }, [visible, position.x, position.y, menuRef]);

  if (!visible) return null;

  return (
    <>
      {/* Level 1: Root menu */}
      <div
        ref={menuRef}
        className="canvas-ctx-menu"
        style={{ left: l1Pos?.left ?? safeL1.left, top: l1Pos?.top ?? safeL1.top }}
      >
        {/* ★ 条目/顺序按官方空白画布右键菜单（`page-DPdEgTS0.js` @1364150 逐字 + 9444 实测）：
              [上传 / 添加资产] ‖ [添加节点 / 添加辅助工具] ‖ [撤销 / 重做] ‖ [粘贴]
            实测 data-testid：`canvas-handle-menu-upload-item` / `canvas-pane-context-menu-add-asset-item` /
            `canvas-pane-context-menu-new-block-item` / `canvas-pane-context-menu-add-utilities-item`
            ★★ 「添加节点 / 添加辅助工具」官方**不是子菜单**，而是在点击处插入一个 command 节点、
               由该节点渲染那个 HANDLE_MENU 面板（官方 `vb({type:'command',…}, flowPos)`）
               ⇒ MTV 原来的 ▶ 子菜单列表**已删** ✓ */}
        <div className="menu-row" onClick={onUpload}>
          <span>{t('上传')}</span>
        </div>
        <div className="menu-row" onClick={onAddAsset}>
          <span>{t('添加资产')}</span>
        </div>
        <div className="menu-sep" />
        <div className="menu-row menu-row-split" onClick={onInsertCommandNode}>
          <span className="menu-rowlabel">{t('添加节点')}</span>
          {/* ★ 官方那行**没有右侧箭头**（官方「添加节点」= 在点击处插 command 节点并弹出面板） */}
        </div>
        {/* ★ 官方第二项「添加辅助工具」（`nodes.addUtilities`）：
             同一个 command 节点，只是 `menuMode:'utility'` ⇒ 面板只渲染「辅助工具」组（含「图片编辑器」） */}
        <div className="menu-row menu-row-split" onClick={onInsertUtilityNode}>
          <span className="menu-rowlabel">{t('添加辅助工具')}</span>
        </div>
        <div className="menu-sep" />
        <div className="menu-row menu-row-split" onClick={onUndo}>
          <span>{t('撤销')}</span>
          <span className="menu-kbd">{MENU_SHORTCUTS.undo}</span>
        </div>
        <div className="menu-row menu-row-split" onClick={onRedo}>
          <span>{t('重做')}</span>
          <span className="menu-kbd">{MENU_SHORTCUTS.redo}</span>
        </div>
        {/* ★ 官方空白菜单是 **4 组 3 分隔线**（`page-DPdEgTS0.js` @1364150 逐字）：
              [上传 / 添加资产] ── [添加节点 / 添加辅助工具] ── [撤销 / 重做] ── [粘贴]
            ⇒ 「粘贴」是**单独一组**（我上轮把它和撤销/重做合成一组，少了一根分隔线 ✗） */}
        <div className="menu-sep" />
        <div className="menu-row menu-row-split" onClick={onPaste}>
          <span>{t('粘贴')}</span>
          <span className="menu-kbd">{MENU_SHORTCUTS.paste}</span>
        </div>
      </div>
      {/* ★ MTV 原有的「合并子菜单」（生成节点 + 源节点 + 插件节点）**已按官方删除** ✗：
           官方这两项都不开子菜单，而是插入 command 节点、由节点渲染 HANDLE_MENU 面板
           （插件节点仍可从竖条「+」/ 双击面板的「插件节点」组进入 ✓） */}
    </>
  );
}


export default memo(CanvasContextMenu);
