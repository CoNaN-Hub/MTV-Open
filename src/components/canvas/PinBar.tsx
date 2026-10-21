/**
 * PinBar —— 官方 Pin 条（`page-DPdEgTS0.js` @1646332 `wbe` + `ybe`），**逐字对照**：
 *
 *   挂载：官方在画布 `<Panel position="top-center" className="!z-50 pointer-events-none !mt-4">` 里
 *         → `flex flex-col items-center gap-3` → `flex h-10 items-center gap-x-3` 的一行中，
 *         且**仅当这一行没有其它顶部控件在显示时**才渲染（`!y&&!x&&!w&&!_ && <vbe/>`）；
 *         条自身 = `pointer-events-auto mt-2.5 flex self-start items-center` + `WebkitAppRegion:'no-drag'`
 *   气泡：`TooltipProvider delayDuration={200}`；每个芯片 tooltip = `{{名}} · {{count}} 个节点`
 *         （`canvas.pin.bar.groupCount`），aria-label = `打开{{名}} Pin（{{count}}）`（`bar.openGroup`）
 *   芯片：`h-5 w-7` = **28×20** 胶囊 + 内层 `size-5` **20px 圆点**（组色），
 *         hover `scale-105`、active `scale-95`、focus 白环；打开态再加
 *         `-inset-0.5 rounded-full border-2 border-white/80` 的白圈
 *   行为：`open = filteredGroupId === groupId`、`onOpenChange = open => setGroupOpen(groupId, open)`
 *         ⇒ **点一下 = 打开该组的过滤**（画布上该组的卡会亮起对应颜色的边，见 PinCardBorder）；
 *         组内没有任何组属于该组时自动 `clearFilter()`
 *   组名：`names[groupId]`（config.pinGroupNames），空则回落 i18n 默认名
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { useCanvasPinGroups, useCanvasPinGroupNames } from '../../hooks/useCanvasPinGroups';
import { useCanvasPinActions } from '../../hooks/useCanvasPin';
import { useFilteredPinGroupId, usePinFilterStore } from '../../store/store.pin';
import { saveNodeOutputsToDirectory } from '../../services/fileService';
import { startTransferBatch } from '../../services/transferReporting';
import { PIN_EVENTS, trackPinEvent } from '../../services/pinAnalytics';
import PinGroupMenu from './PinGroupMenu';
import PinConfirmDialog from './PinConfirmDialog';

function PinBar() {
  const t = useT();
  const groups = useCanvasPinGroups();
  const filteredGroupId = useFilteredPinGroupId();
  const setGroupOpen = usePinFilterStore((s) => s.setGroupOpen);
  const clearFilter = usePinFilterStore((s) => s.clearFilter);
  const setLocatedNode = usePinFilterStore((s) => s.setLocatedNode);
  const { renameGroup, renameOf } = useCanvasPinGroupNames();
  const { removeAllNodesFromGroup } = useCanvasPinActions();
  const { fitView } = useReactFlow();

  /** 官方 `locateNode(id)`（page @1638428）：`clearHighlightedNodes()` → `addHighlightedNodes([id])`
   *  → `fitView({nodes:[{id}], ...pbe})` → 埋点 `Jat` = CANVAS_PIN_NODE_LOCATED
   *  MTV 没有高亮 store ⇒ 用 pin 过滤 store 里的 `locatedNodeId` 表达（卡片渲染白色高亮环，1.6s 后自动消失） */
  const locateNode = useCallback((nodeId: string, groupId: string, groupNodeCount: number) => {
    useAppStore.getState().setSelectedNodeIds([nodeId]);
    setLocatedNode(nodeId);
    // 官方是 `clearHighlightedNodes()` 手动清；MTV 用 1.6s 自动清（视觉上等价且不打扰）
    window.setTimeout(() => {
      if (usePinFilterStore.getState().locatedNodeId === nodeId) setLocatedNode(null);
    }, 1600);
    void fitView({ nodes: [{ id: nodeId }], padding: 1, maxZoom: 2, minZoom: 0.5, duration: 500 });
    trackPinEvent(PIN_EVENTS.NODE_LOCATED, { color_group_id: groupId, node_id: nodeId, group_node_count: groupNodeCount });
  }, [fitView, setLocatedNode]);

  /** 官方「下载全部」（`wbe` @1646332 → `Mx().downloadNodes`）：走官方「文件传输中心」，
   *  逐行显示每个节点的下载状态；官方是服务端打包 + 进度事件，MTV 只弹一次目录选择后逐个落盘 */
  const downloadGroupNodes = useCallback(async (groupId: string, nodeIds: string[]) => {
    const store = useAppStore.getState();
    const items = nodeIds.flatMap((id) => {
      const node = store.nodes.find((n) => n.id === id);
      if (!node) return [];
      const d = (node.data ?? {}) as Record<string, unknown>;
      const mediaUrl = typeof d.imageUrl === 'string' ? d.imageUrl
        : typeof d.videoUrl === 'string' ? d.videoUrl
          : typeof d.audioUrl === 'string' ? d.audioUrl : undefined;
      const label = typeof d.label === 'string' && d.label.trim() ? d.label.trim() : id;
      const thumbnail = typeof d.thumbnailUrl === 'string' ? d.thumbnailUrl : mediaUrl;
      const kind = node.type?.includes('video') ? 'video'
        : node.type?.includes('audio') ? 'audio'
          : node.type?.includes('text') || node.type?.includes('markdown') ? 'text' : 'image';
      return [{
        id,
        batch: {
          id,
          type: 'download' as const,
          name: label,
          thumbnail: kind === 'text' ? undefined : thumbnail,
          kind: kind as 'image' | 'video' | 'audio' | 'text',
          status: 'queued' as const,
          downloadPhase: 'preparing' as const,
          percentage: 0,
          total: 0,
          loaded: 0,
          updatedAt: Date.now(),
        },
        file: {
          id,
          mediaUrl,
          textOutput: !mediaUrl && typeof d.output === 'string' ? d.output : undefined,
          nodeType: node.type ?? 'ai-image',
          fileName: label,
        },
      }];
    });

    if (items.length === 0) return;
    /* 官方：一次「下载全部」= 一批（走同一套 `prepareForNewBatch` + upsert 语义） */
    startTransferBatch(`download-all:${Date.now().toString(36)}`);
    store.upsertTransferItems(items.map((entry) => entry.batch));

    const outcome = await saveNodeOutputsToDirectory(items.map((entry) => entry.file), {
      onItemStart: (id) => useAppStore.getState().patchTransferItem(id, {
        status: 'running', downloadPhase: 'downloading', updatedAt: Date.now(),
      }),
      onItemDone: (id, error) => useAppStore.getState().patchTransferItem(id, error
        ? { status: 'failed', error, updatedAt: Date.now() }
        // 官方：download 且 downloadPhase 保持 'downloading' 时文案是「已完成」（换成 preparing 才是「已开始」）
        : { status: 'completed', percentage: 100, updatedAt: Date.now() }),
    });

    if (outcome.canceled) {
      for (const entry of items) {
        useAppStore.getState().patchTransferItem(entry.id, { status: 'canceled', updatedAt: Date.now() });
      }
    }

    trackPinEvent(PIN_EVENTS.GROUP_DOWNLOADED, {
      color_group_id: groupId,
      node_count: nodeIds.length,
      file_count: outcome.savedIds.length,
    });
    if (outcome.failed.length > 0) {
      useAppStore.getState().showToast(`已下载 ${outcome.savedIds.length} 个节点，${outcome.failed.length} 个失败`, 'error');
    }
  }, []);

  const canDownload = useCallback((nodeIds: string[]) => nodeIds.some((id) => {
    const node = useAppStore.getState().nodes.find((n) => n.id === id);
    const d = (node?.data ?? {}) as Record<string, unknown>;
    return ['imageUrl', 'videoUrl', 'audioUrl', 'output'].some((k) => typeof d[k] === 'string' && (d[k] as string).length > 0);
  }), []);

  /** 官方「移出全部」= `hb.confirm({...})`：**居中模态**（不是面板内两步确认） */
  const [confirmTarget, setConfirmTarget] = useState<{ groupId: string; name: string; count: number } | null>(null);
  const confirmRemoveAll = useCallback((chip: { groupId: string; display: string; count: number }) => {
    setConfirmTarget({ groupId: chip.groupId, name: chip.display, count: chip.count });
  }, []);

  // 官方：`useEffect(() => { !filtered || groups.some(g => g.groupId === filtered) || clearFilter() }, [...])`
  useEffect(() => {
    if (!filteredGroupId) return;
    if (!groups.some((g) => g.groupId === filteredGroupId)) clearFilter();
  }, [filteredGroupId, groups, clearFilter]);
  // 官方：组件卸载时清过滤
  useEffect(() => clearFilter, [clearFilter]);

  const labelOf = useCallback((groupId: string, fallback: string) => renameOf(groupId) || fallback, [renameOf]);

  const chips = useMemo(() => groups.map((row) => {
    const display = labelOf(row.groupId, t(row.group.label));
    const custom = renameOf(row.groupId);
    const title = custom ? `${display} · ${t(row.group.label)}` : display;
    return {
      ...row,
      display,
      custom,
      title,
      aria: t('打开{name} Pin（{count}）', { name: title, count: row.count }),
      tip: `${title} · ${t('{count} 个节点', { count: row.count })}`,
      open: filteredGroupId === row.groupId,
    };
  }), [groups, filteredGroupId, labelOf, renameOf, t]);

  if (chips.length === 0) return null;

  return (
    <div className="pin-bar">
      {chips.map((chip) => (
        <div key={chip.groupId} className="pin-chip-wrap">
          <button
            type="button"
            className={`pin-chip${chip.open ? ' is-open' : ''}`}
            aria-label={chip.aria}
            aria-pressed={chip.open}
            aria-haspopup="menu"
            aria-expanded={chip.open}
            data-tooltip={chip.tip}
            data-tooltip-pos="bottom"
            onClick={(e) => {
              e.stopPropagation();
              setGroupOpen(chip.groupId, !chip.open);   // 官方：onOpenChange ⇒ setGroupOpen
            }}
            onKeyDown={(e) => { if (e.key === 'Escape' && chip.open) setGroupOpen(chip.groupId, false); }}
          >
            {/* 官方 `ybe` 结构：按钮 `h-5 w-7`（28×20 椭圆、无底色）内含 **`size-5` 20px 圆点**，
                白圈是**圆点的子元素**（`absolute -inset-0.5 rounded-full border-2 border-white/80`
                ⇒ 直径 20+4=24 的**正圆**）；打开态圆点 `scale-105`。
                ⚠️ 之前把白圈挂在 28×20 的按钮上 ⇒ 渲染成椭圆 ✗（用户反馈"形状不对"）。 */}
            <span className="pin-chip-dot" style={{ backgroundColor: chip.group.hex }}>
              <span className="pin-chip-ring" aria-hidden="true" />
            </span>
          </button>
          {chip.open && (
            <div className="pin-chip-menu" role="presentation">
              <PinGroupMenu
                row={chip}
                displayName={chip.display}
                defaultName={t(chip.group.label)}
                customName={chip.custom}
                onRename={(name) => renameGroup(chip.groupId, name)}
                onRemoveAllNodes={() => confirmRemoveAll(chip)}
                onDownloadAll={() => void downloadGroupNodes(chip.groupId, chip.nodeIds)}
                onLocate={(nodeId) => locateNode(nodeId, chip.groupId, chip.count)}
                canDownload={canDownload(chip.nodeIds)}
                onClose={() => setGroupOpen(chip.groupId, false)}
              />
            </div>
          )}
        </div>
      ))}
      {confirmTarget && (
        <PinConfirmDialog
          title={t('移出所有节点？')}
          description={t('将取消 {count} 个节点的“{name}”标记，节点本身不会被删除。', {
            count: confirmTarget.count,
            name: confirmTarget.name,
          })}
          confirmLabel={t('移出所有节点')}
          cancelLabel={t('取消')}
          onConfirm={() => { removeAllNodesFromGroup(confirmTarget.groupId); setConfirmTarget(null); }}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}

export default memo(PinBar);
