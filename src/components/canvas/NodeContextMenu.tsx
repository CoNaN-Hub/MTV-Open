/**
 * NodeContextMenu 节点右键菜单 — 在节点上右键弹出，支持复制、剪切、创建副本、解除分组、删除操作
 * 自动检测屏幕边界，避免溢出
 */
import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { calcFixedPosition, calcSubmenuPosition } from '../../utils/popupPosition';
import { useT } from '../../i18n';
import { useMenuActiveRow } from '../../hooks/useMenuActiveRow';
import type { AvailableNodePluginTool } from '../../types/plugin';

/* ★ 条目/顺序按官方卡片右键菜单（`page-DPdEgTS0.js` @1359629 逐字）：
     保存到素材库((q: IMAGE/VIDEO/TEXT/AUDIO/(THREED未转换)) 仅这些类型显示)
     复制 CtrlC / 粘贴 CtrlV(官方在剪贴板无节点时是 **禁用** 态) / 副本
     ── 删除 ⌫,del
     ── (媒体条件组：复制到剪贴板 / 下载 / 保留主图 / 复制链接 …)
     ── 反馈问题
   ⚠️ MTV 原来多出官方**没有**的项：剪切 / 锁定 / 转换图片 / 在 PS 打开 / 编辑视频 / 在剪映打开 /
      在 PR 打开 / 打开文件所在位置 / 另存为 / 添加到角色库 / 打开文件夹 ⇒ 按官方删掉（本轮）。 */
const MENU_ITEMS = [
  { label: '保存到素材库', shortcut: '', action: 'saveToLibrary' as const, assetTypes: true },
  /* ★ 官方**有图时紧随其后那组**（源码 @1345868；`hidden` 取决于节点有 `data.src` / 历史数）：
       { label: applyAllHistory, testId: UNGROUP_ITEM,  hidden: !data.src }
       { label: deleteVariants,  testId: KEEP_MAIN_ITEM, hidden: N<=1 }
       { label: download,        testId: DOWNLOAD_ITEM, hidden: !data.src }
     ⚠️ 我上一轮把「下载」放到"删除之后"的媒体组 ✗ —— 官方它在**这里**
        （用户给的官方截图：保存到素材库 ── 应用所有历史 / 下载 ── 复制/粘贴/副本 ── 删除 ── 复制到剪贴板 ── 反馈问题）。
     MTV 可映射的只有「下载」= `saveAs`；「应用所有历史 / 删除其他历史」需要 MTV 的历史应用后端（已登记）。 */
  { label: '应用所有历史', shortcut: '', action: 'applyAllHistory' as const, conditional: true, sepBefore: true },
  /* ★ 官方这一项带 `tips`（`page-DVqoHdTT.js`@1362698 逐字）：
       `{label:e("common.deleteVariants"), tips:e("common.deleteVariantsTip"), testId:KEEP_MAIN_ITEM, hidden:N<=1, …}`
     文案 = `common.deleteVariantsTip`（`index-BsHyQ2qj.js` zh @9140347，逐字）：
       「一键删除当前节点的所有其他折叠变体。您仍可在侧边栏的“历史”面板中找到它们。」
     官方渲染（@1374790 `U.tips && J(U.tips)`）= 标签右侧一个 ⓘ + 右侧 tooltip（`_h`/`NA`）。
     ⚠️ MTV 差异：用原生 `title` 承担 tooltip（MTV 的菜单不是 radix，没有 `_h` 那套 tooltip 宿主）。 */
  { label: '删除其他历史', shortcut: '', action: 'deleteVariants' as const, conditional: true, tips: '一键删除当前节点的所有其他折叠变体。您仍可在侧边栏的“历史”面板中找到它们。' },
  { label: '下载', shortcut: '', action: 'saveAs' as const, conditional: true },

  { label: '复制', shortcut: 'CtrlC', action: 'copy' as const, sepBefore: true },
  { label: '粘贴', shortcut: 'CtrlV', action: 'paste' as const, disabled: true },
  { label: '副本', shortcut: '', action: 'duplicate' as const },
  { label: '删除', shortcut: '⌫,del', action: 'delete' as const, danger: true },
  /* 官方 `$` 媒体条件组 = **删除之后那组**（`{$.length>0 && <><Sep/><group>{…}</group></>}`）；MTV 这一项 = `copyMedia` */
  { label: '复制到剪贴板', shortcut: '', action: 'copyMedia' as const, conditional: true, sepBefore: true },
  { label: '解除分组', shortcut: '', action: 'ungroup' as const, groupOnly: true },
  /* ★ 用户裁定：官方最后那组「反馈问题」（`canvas.feedback.trigger`）MTV 不要，
     改用 **MTV 自己的「在 PS 中打开」** 放同一位置（前置分隔线 `sepBefore` 保留官方那根）。 */
  { label: '在 PS 中打开', shortcut: '', action: 'openInPS' as const, conditional: true, sepBefore: true },
];

const MENU_W = 176;
const MENU_H = 494; // 视频节点最多 13 items + 1 sep
const TEXT_SELECTION_MENU_EXTRA_H = 78; // 2 text-selection items + separator

function PluginToolsSubmenu({ tools, onSelect }: {
  tools: AvailableNodePluginTool[];
  onSelect: (pluginId: string, toolId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusOnOpen = useRef(false);
  const id = useId();
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const show = (focus = false) => {
    cancelClose();
    focusOnOpen.current = focus;
    setOpen(true);
    if (open && focus) submenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  };
  const hideLater = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [open]);
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const submenu = submenuRef.current;
    if (!open || !trigger || !submenu) return;
    const next = calcSubmenuPosition(trigger.getBoundingClientRect(), submenu.offsetWidth, submenu.offsetHeight);
    setPosition((previous) => previous.left === next.left && previous.top === next.top ? previous : next);
    if (focusOnOpen.current) {
      submenu.querySelector<HTMLButtonElement>('button')?.focus();
      focusOnOpen.current = false;
    }
  }, [open, tools]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`menu-row menu-row-split${open ? ' highlight' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onMouseEnter={() => show()}
        onMouseLeave={hideLater}
        onClick={() => show(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            show(true);
          }
        }}
      >
        <span>插件工具</span><span className="menu-arrow" aria-hidden="true">›</span>
      </button>
      {open && createPortal(
        <div
          ref={submenuRef}
          id={id}
          role="menu"
          aria-label="插件工具"
          className="canvas-ctx-menu submenu max-h-[calc(100vh-16px)] max-w-[calc(100vw-16px)] overflow-y-auto"
          style={{ left: position.left, top: position.top }}
          onMouseEnter={cancelClose}
          onMouseLeave={hideLater}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setOpen(false);
              triggerRef.current?.focus();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const buttons = Array.from(submenuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
            }
          }}
        >
          {tools.map((pluginTool) => (
            <button
              key={`${pluginTool.pluginId}:${pluginTool.tool.id}`}
              type="button"
              role="menuitem"
              className="menu-row menu-row-split"
              title={pluginTool.tool.description}
              onClick={() => {
                setOpen(false);
                onSelect(pluginTool.pluginId, pluginTool.tool.id);
              }}
            >
              <span className="min-w-0 truncate">{pluginTool.tool.title}</span>
              <span className="menu-kbd">{pluginTool.pluginName}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

interface NodeContextMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  menuRef: React.RefObject<HTMLDivElement | null>;
  onCopy: () => void;
  onCut: () => void;
  hasTextSelection?: boolean;
  onCopyText?: () => void;
  onCutText?: () => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
  isLocked: boolean;
  onConvertImage?: () => void;
  imageConversionLabel?: string;
  onAddToCharacter?: () => void;
  onUngroup?: () => void;
  onOpenGroupFolder?: () => void;
  onDelete: () => void;
  onShowInFolder?: () => void;
  onSaveAs?: () => void;
  onOpenInPS?: () => void;
  onEditVideo?: () => void;
  editVideoLabel?: string;
  onOpenInJianying?: () => void;
  onOpenInPremiere?: () => void;
  onCopyMedia?: () => void;
  copyMediaLabel?: string;
  pluginTools?: AvailableNodePluginTool[];
  onPluginTool?: (pluginId: string, toolId: string) => void;
  /** 官方「保存到素材库」⇒ 与节点工具栏同一 handler */
  onSaveToLibrary?: () => void;
  onDeleteVariants?: () => void;
  onApplyAllHistory?: () => void;
  showApplyHistory?: boolean;
  showDeleteVariants?: boolean;
  /** 官方条件 q：仅 IMAGE/VIDEO/TEXT/AUDIO/(THREED 未转换) 显示该项 */
  showSaveToLibrary?: boolean;
  /** ★ 官方菜单项是 radix `Item` ⇒ **选中即自动关闭菜单**（`onSelect` 后 radix 关菜单）。
   *  MTV 原来点完不关 ⇒ 菜单继续浮着，把随后弹出的「保存到素材库」对话框压在下面（用户实测反馈 1/2）。 */
  onClose?: () => void;
}
export function NodeContextMenu({
  visible,
  position,
  menuRef,
  onCopy,
  onCut,
  hasTextSelection,
  onCopyText,
  onCutText,
  onDuplicate,
  onToggleLock,
  onConvertImage,
  onAddToCharacter,
  onUngroup,
  onOpenGroupFolder,
  onDelete,
  onShowInFolder,
  onSaveAs,
  onOpenInPS,
  onEditVideo,
  onOpenInJianying,
  onOpenInPremiere,
  onCopyMedia,
  pluginTools = [],
  onPluginTool,
  onSaveToLibrary,
  onDeleteVariants,
  onApplyAllHistory,
  showApplyHistory = false,
  showDeleteVariants = false,
  showSaveToLibrary = true,
  onClose,
}: NodeContextMenuProps) {
  const t = useT();
  /* ★ 官方 cmdk：菜单打开即高亮首项，并支持 ↑/↓ 移动（底色 #2b2b2b） */
  useMenuActiveRow({ menuRef, visible });
  if (!visible) return null;

  const safePos = calcFixedPosition(
    position.x,
    position.y,
    MENU_W,
    MENU_H
      + (hasTextSelection ? TEXT_SELECTION_MENU_EXTRA_H : 0)
      + (pluginTools.length > 0 && onPluginTool ? 42 : 0),
  );

  const actionMap: Record<string, () => void> = {
    copy: onCopy,
    cut: onCut,
    duplicate: onDuplicate,
    toggleLock: onToggleLock,
    convertImage: onConvertImage || (() => {}),
    addToCharacter: onAddToCharacter || (() => {}),
    delete: onDelete,
    showInFolder: onShowInFolder || (() => {}),
    openGroupFolder: onOpenGroupFolder || (() => {}),
    saveAs: onSaveAs || (() => {}),
    openInPS: onOpenInPS || (() => {}),
    editVideo: onEditVideo || (() => {}),
    openInJianying: onOpenInJianying || (() => {}),
    openInPremiere: onOpenInPremiere || (() => {}),
    copyMedia: onCopyMedia || (() => {}),
    /* 官方「保存到素材库」= 与节点工具栏**同一个 handler**（MTV 现在那处是桩：showToast('保存到素材库功能待接入')） */
    saveToLibrary: onSaveToLibrary || (() => {}),
    deleteVariants: onDeleteVariants || (() => {}),
    applyAllHistory: onApplyAllHistory || (() => {}),
    /* 官方卡片菜单有「粘贴」，MTV 暂无节点级粘贴 ⇒ 先渲染成官方那种**禁用**态 */
    paste: () => {},
  };

  const items = MENU_ITEMS.filter((item) => {
    /* 官方条件：`q &&` = 只有 IMAGE/VIDEO/TEXT/AUDIO/(THREED 未转换) 才显示「保存到素材库」 */
    if ('assetTypes' in item && item.assetTypes && !showSaveToLibrary) return false;
    if (item.groupOnly && !onUngroup) return false;
    if (item.conditional && item.action === 'copyMedia' && !onCopyMedia) return false;
    if (item.conditional && item.action === 'saveAs' && !onSaveAs) return false;
    if (item.conditional && item.action === 'deleteVariants' && !showDeleteVariants) return false;
    if (item.conditional && item.action === 'applyAllHistory' && !showApplyHistory) return false;
    if (item.conditional && item.action === 'openInPS' && !onOpenInPS) return false;
    return true;
  });
  const renderItem = (item: (typeof MENU_ITEMS)[number]) => (
    <div key={item.action}>
      {item.danger || ('sepBefore' in item && item.sepBefore) ? <div className="menu-sep" /> : null}
      <div
        className={`menu-row menu-row-split${item.danger ? ' menu-row-danger' : ''}${'disabled' in item && item.disabled ? ' disabled' : ''}`}
        onClick={'disabled' in item && item.disabled ? undefined : () => {
          /* 官方 radix Item：先执行动作，再**关菜单**（顺序与官方一致：动作里可能要量菜单位置） */
          const run = item.action === 'ungroup' ? onUngroup : actionMap[item.action];
          run?.();
          onClose?.();
        }}
      >
        <span>
          {/* ★ 按官方：文案全部静态取自 i18n（官方 `$` 媒体条件组里的那一项固定为
              「复制到剪贴板」）；不再走 MTV 的动态文案（原会显示「复制图像」等 ✗） */}
          {t(item.label)}
          {/* 官方 `tips`（本菜单里只有「删除其他历史」有）= 标签右侧 ⓘ；
              图标 = lucide `info`（官方 `NA`）：`<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>` */}
          {'tips' in item && item.tips ? (
            <span className="menu-row-tip" title={t(item.tips)} aria-label={t(item.tips)} role="img">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </span>
          ) : null}
        </span>
        <span className="menu-kbd">{item.shortcut}</span>
      </div>
    </div>
  );

  return createPortal(
    <div
      ref={menuRef}
      className="node-ctx-menu canvas-ctx-menu"
      style={{ left: safePos.left, top: safePos.top }}
    >
      {hasTextSelection && (
        <>
          <div className="menu-row menu-row-split" onClick={onCopyText}>
            <span>{t('复制文字')}</span>
            <span className="menu-kbd">Ctrl C</span>
          </div>
          <div className="menu-row menu-row-split" onClick={onCutText}>
            <span>{t('剪切文字')}</span>
            <span className="menu-kbd">Ctrl X</span>
          </div>
          <div className="menu-sep" />
        </>
      )}
      {/* ★ 按**数组顺序**单一渲染：官方卡片菜单是「保存到素材库 / 复制 / 粘贴 / 副本 / ─ 删除 / … / 最后那组」，
          「删除」在官方里**不是最后一项**（它在中间，后面还有媒体条件组与最后那组）。
          ⚠️ MTV 原来把 `danger` 单独 `.filter().map()` 放到最后 ⇒ 删除永远在最底 ✗（在 PS 中打开就跑到删除前面了）。 */}
      {items.map(renderItem)}
      {pluginTools.length > 0 && onPluginTool && (
        <>
          <div className="menu-sep" />
          <PluginToolsSubmenu
            key={`${position.x}:${position.y}`}
            tools={pluginTools}
            onSelect={onPluginTool}
          />
        </>
      )}
    </div>,
    document.body,
  );
}

export default memo(NodeContextMenu);
