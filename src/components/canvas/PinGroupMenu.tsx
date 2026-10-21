/**
 * PinGroupMenu —— 官方 `mbe`（`page-DPdEgTS0.js` @1638286）+ 芯片 `ybe`（@1644001）逐字对照
 *
 *  内容容器（官方 DropdownMenuContent `Ks` = `index-BiTZf8mJ.js` @6038459 `xQe`）：
 *    `align="center" sideOffset={8}` +
 *    `className="w-max min-w-40 max-w-[min(20rem,calc(100vw-1rem))]"` +
 *    `style={{ width: editing ? measuredWidth : undefined }}`   ← **编辑态锁宽**，面板尺寸不跳
 *
 *  ① 常态行：`flex h-9 items-center gap-2 px-2`
 *      · `kp`（`inline-flex size-5 shrink-0 items-center justify-center`）里一颗 `size-2.5 rounded-full` 组色点
 *      · 名字 `min-w-0 translate-y-[0.5px] truncate text-sm font-medium leading-5`（无颜色类 ⇒ 继承 #ccc）
 *      · 重命名钮 = **DropdownMenuItem** `className="size-7 shrink-0 justify-center p-0"` + 行基类
 *        （`rounded-sm` 4px / hover `bg-accent` #404040 / `[&_svg…]:text-muted-foreground` ⇒ 图标保持 #7a7a7a）
 *        图标 = Tabler `outline/pencil`（在 item 里被 `[&_svg]:size-4` 定为 16px）
 *      · 计数 `ml-auto shrink-0 text-xs text-muted-foreground`（12px/16px/#7a7a7a）
 *  ② 编辑态行：同一外壳，换成
 *      · `input.h-7 min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 text-sm font-medium
 *         leading-5 text-foreground outline-none placeholder:text-muted-foreground
 *         focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40`
 *        **placeholder = 颜色名**（`u` = `defaultName`），`aria-label` 才是 `canvas.pin.groupMenu.renameInput`
 *      · 保存钮 = **普通 button**：`inline-flex size-7 … rounded-md text-muted-foreground
 *         transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring`
 *        图标 = Tabler `check` 14px strokeWidth 2.5
 *      · Esc / 输入回车：官方 `onKeyDown` 里 `stopPropagation()`，Enter 保存、Esc 退出编辑（不关菜单）；
 *        菜单的 `onEscapeKeyDown` 在编辑态也 `preventDefault()` 后退出编辑
 *  ③ 分隔线 `bg-border -mx-1 my-1 h-px`
 *  ④ 节点列表 `max-h-48 overflow-y-auto`，行 = DropdownMenuItem：
 *      缩略图 `xbe`（`img.size-5.rounded-sm.object-cover` 或 16px 类型图标）+ `span.w-0.min-w-0.flex-1.truncate`
 *  ⑤ 分隔线；⑥「下载全部」`jt disabled={!canDownload}`；⑦「移出全部」`jt variant="destructive"`
 *  ⑧ 「移出全部」→ 官方 `hb.confirm({...})` 模态（见 PinConfirmDialog）
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { OfficialIcon } from '../sidebar/OfficialIcon';
import { PINNABLE_KIND, type CanvasPinGroupRow } from '../../services/canvasPin';

export interface PinGroupMenuProps {
  row: CanvasPinGroupRow;
  displayName: string;
  /** 官方 `defaultName` = 颜色名（`t(group.nameKey)`）—— 编辑态输入框的 **placeholder** */
  defaultName: string;
  customName?: string;
  onRename: (name: string | null) => void;
  onRemoveAllNodes: () => void;
  onDownloadAll: () => void;
  onLocate: (nodeId: string) => void;
  canDownload: boolean;
  onClose: () => void;
}

/** 官方 `fbe(node)`：节点 → {label, thumbnail, kind} */
function nodeDisplay(node: { id: string; type?: string; data?: Record<string, unknown> }) {
  const d = node.data ?? {};
  const kind = PINNABLE_KIND[node.type as keyof typeof PINNABLE_KIND] ?? 'image';
  const src = typeof d.src === 'string' ? d.src : '';
  const thumb = typeof d.thumbnailUrl === 'string'
    ? d.thumbnailUrl
    : (typeof d.imageUrl === 'string' ? d.imageUrl : (typeof d.videoUrl === 'string' ? d.videoUrl : src));
  /* 行标题必须与**卡片上显示的名字**一致 —— 卡片侧对默认标题做了归一化：
       `label={displayLabel === '生成图像' ? 'Image' : displayLabel}` */
  const raw = (typeof d.label === 'string' ? d.label.trim() : '')
    || (typeof d.title === 'string' ? d.title.trim() : '')
    || (typeof d.name === 'string' ? d.name.trim() : '');
  const kindName = ({ image: 'Image', video: 'Video', audio: 'Audio', text: 'Text', world: '3D' } as Record<string, string>)[kind] ?? 'Image';
  const label = !raw || raw === '生成图像' ? kindName : raw;
  return { label, thumbnail: kind === 'text' ? '' : thumb, kind };
}

/** 官方 `xbe`：按 kind 选图标 —— 用**用户从官方 DOM 导出的**节点图标来对齐 */
const KIND_OFFICIAL_ICON: Record<string, string> = {
  world: 'node-3d',
  video: 'node-video',
  audio: 'node-audio',
  text: 'node-text',
  image: 'node-image',
};

function PinGroupMenu({
  row, displayName, defaultName, customName, onRename, onRemoveAllNodes, onDownloadAll, onLocate, canDownload, onClose,
}: PinGroupMenuProps) {
  const t = useT();
  const nodes = useAppStore((s) => s.nodes);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(customName ?? '');
  /** 官方 `G()`：进编辑前量一次内容宽度并锁住，编辑态面板尺寸不跳 */
  const [lockedWidth, setLockedWidth] = useState<number | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => row.nodeIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => ({ id: n.id, ...nodeDisplay(n as never) })), [row.nodeIds, nodes]);

  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing]);

  const startEdit = useCallback(() => {
    const width = menuRef.current?.getBoundingClientRect().width ?? 0;
    setLockedWidth(width > 0 ? width : undefined);
    setDraft(customName ?? '');
    setEditing(true);
  }, [customName]);

  const cancelEdit = useCallback(() => {
    setLockedWidth(undefined);
    setEditing(false);
  }, []);

  const commit = useCallback(() => {
    const next = draft.trim();
    onRename(next ? next : null);       // 清空 = 删掉自定义名（回落到颜色名）
    setLockedWidth(undefined);
    setEditing(false);
  }, [draft, onRename]);

  return (
    <div
      ref={menuRef}
      className="pin-group-menu nodrag"
      role="menu"
      aria-label={displayName}
      style={editing && lockedWidth ? { width: lockedWidth } : undefined}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ① / ② 重命名行（常态 / 编辑态同一外壳） */}
      <div className="pin-group-row">
        <span className="pin-group-dot-slot" aria-hidden="true">
          <span className="pin-group-dot" style={{ backgroundColor: row.group.hex }} />
        </span>
        {editing ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              maxLength={40}
              placeholder={defaultName}
              aria-label={t('Pin 名称')}
              className="pin-group-input"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
              }}
            />
            <button
              type="button"
              aria-label={t('保存名称')}
              title={t('保存名称')}
              className="pin-group-save-btn"
              onClick={commit}
            >
              <Icon icon="tabler:check" width="14" strokeWidth={2.5} />
            </button>
          </>
        ) : (
          <>
            <span className="pin-group-name">{displayName}</span>
            <button
              type="button"
              aria-label={t('重命名“{name}”', { name: displayName })}
              title={t('重命名“{name}”', { name: displayName })}
              className="pin-group-icon-btn"
              onClick={startEdit}
            >
              <Icon icon="tabler:pencil" width="16" />
            </button>
            <span className="pin-group-count">{t('{count} 个节点', { count: row.count })}</span>
          </>
        )}
      </div>

      <div className="pin-group-sep" />

      {/* ④ 节点列表 */}
      <div className="pin-group-nodes">
        {rows.length === 0
          ? <button type="button" className="pin-group-item" disabled>{t('暂无标记节点')}</button>
          : rows.map((n) => (
            <button
              key={n.id}
              type="button"
              className="pin-group-item"
              onClick={() => { onLocate(n.id); onClose(); }}
            >
              <span className="pin-group-thumb">
                {n.thumbnail
                  ? <img src={n.thumbnail} alt="" loading="lazy" className="pin-group-thumb-img" />
                  : <OfficialIcon name={KIND_OFFICIAL_ICON[n.kind] ?? 'node-image'} size={16} />}
              </span>
              <span className="pin-group-item-label">{n.label || t('未命名')}</span>
            </button>
          ))}
      </div>

      <div className="pin-group-sep" />

      {/* ⑥ 下载全部 */}
      <button
        type="button"
        className="pin-group-item"
        disabled={!canDownload}
        onClick={() => { onDownloadAll(); onClose(); }}
      >
        <span className="pin-group-thumb"><Icon icon="tabler:download" width="16" /></span>
        {t('下载全部')}
      </button>

      {/* ⑦ 移出全部：官方 `onSelect` 默认会关掉菜单（只有重命名那条 preventDefault 保持打开），
             确认弹窗由父级 `hb.confirm` 等价物（PinConfirmDialog）弹 */}
      <button
        type="button"
        className="pin-group-item is-destructive"
        onClick={() => { onClose(); onRemoveAllNodes(); }}
      >
        <span className="pin-group-thumb"><Icon icon="tabler:pinned-off" width="16" /></span>
        {t('移出全部')}
      </button>
    </div>
  );
}

export default memo(PinGroupMenu);
