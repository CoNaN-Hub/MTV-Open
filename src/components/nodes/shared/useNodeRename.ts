/**
 * useNodeRename — 统一的节点重命名 hook，消除 4 个节点组件中的重复代码
 */
import { useCallback } from 'react';
import type { BaseNodeData } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { getAssetUrlFromPath, renameProjectFileToLabel } from '../../../services/fileService';

export function useNodeRename(id: string, data: BaseNodeData, fallback: string) {
  const updateNodeData = useAppStore((s) => s.updateNodeData);

  /* ★★★★ **显示标题不再优先取 `fileName`** ✗✓（用户实测官方行为 ✓ 权威 ✓）
     官方：上传图后标题 = **"Image"** ✓，只有**用户主动双击重命名**才变 ✓
       （EXE 原文：`title = data.title || … || "Title"` ✓ —— **不拿 fileName 当标题** ✓）
     MTV 原来是 `**data.fileName** || data.label || fallback` ✗✓
       → 上传时写了 `fileName` ✓ → 它**压过** label ✗ → 永远显示「南京.jpg」✗✓
       → 用户："重新上传一张图 → 标题应是 Image，**没解决**" ✓✓
     改成 `data.label || fallback` ✓ = 官方的 `data.title || 兜底` ✓
     （`fileName` 仍照常存着 ✓ 供文件重命名等逻辑用 ✓ 只是**不再当显示标题** ✓）*/
  const displayLabel = data.label || fallback;

  const handleRename = useCallback(
    (newName: string) => {
      const payload: Partial<BaseNodeData> = { label: newName };
      if (data.fileName) (payload as Record<string, unknown>).fileName = newName;
      updateNodeData(id, payload);

      // 媒体节点：把项目目录内的底层文件一并重命名，并更新 filePath / 媒体 URL
      const filePath = data.filePath;
      const hasMedia = !!(data.imageUrl || data.videoUrl || data.audioUrl);
      if (filePath && hasMedia) {
        const projectId = useAppStore.getState().currentProjectId;
        if (!projectId) return;
        void (async () => {
          const oldAssetUrl = await getAssetUrlFromPath(filePath);
          const renamed = await renameProjectFileToLabel(filePath, newName, projectId);
          if (!renamed) return;

          const store = useAppStore.getState();
          const cur = store.nodes.find((n) => n.id === id)?.data as BaseNodeData | undefined;
          if (!cur) return;
          const patch: Record<string, unknown> = { filePath: renamed.filePath };
          for (const key of ['imageUrl', 'videoUrl', 'audioUrl'] as const) {
            if (cur[key] && cur[key] === oldAssetUrl) patch[key] = renamed.assetUrl;
          }
          store.updateNodeDataTransient(id, patch as Partial<BaseNodeData>);
          // 文件已重命名（fileService 已派发磁盘变更事件），useAutoSave 会静默落盘
        })();
      }
    },
    [id, updateNodeData, data.fileName, data.filePath, data.imageUrl, data.videoUrl, data.audioUrl],
  );

  return { displayLabel, handleRename };
}
