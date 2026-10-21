/**
 * useCanvasPinGroups —— 官方 Pin 的分组聚合 + 组名（`BAe/jAe` @1178019 · `ube(canvasId)` @1637352）
 *
 *   官方 `BAe(nodes)`：groupId → nodeIds，再用 `jAe` 过滤掉空组 ⇒ [{groupId, group, nodeIds, count}]
 *   官方 `ube(canvasId)` → {names, canRename, savingGroupIds, renameGroup}
 *     · names 以 **groupId 为键**，空值回落到 i18n 默认名（`canvas.pin.colors.*`）
 *     · renameGroup 是**乐观更新**：先本地写 → 调 `updateCanvasConfig({pin:{color_groups:{[id]:{name}}}})`
 *       → 失败回滚 + toast `canvas.pin.groupMenu.renameFailed`
 *   官方存储位置 = 画布配置的 `pin.color_groups[groupId].name`
 *     ⇒ MTV 对应物 = `config.pinGroupNames`（画布/项目级配置）
 */
import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PIN_GROUPS, groupPins, readPins, type PinGroup } from '../services/canvasPin';

export interface CanvasPinGroup {
  groupId: string;
  group: PinGroup;
  nodeIds: string[];
  count: number;
}

/** 官方 `BAe` + `jAe`：聚合出有节点的色组（顺序按官方色组表） */
export function useCanvasPinGroups(): CanvasPinGroup[] {
  const nodes = useAppStore((s) => s.nodes);
  return useMemo(() => {
    const byGroup = new Map<string, string[]>();
    for (const node of nodes) {
      for (const id of readPins(node.data)) {
        const list = byGroup.get(id);
        if (list) list.push(node.id);
        else byGroup.set(id, [node.id]);
      }
    }
    return groupPins(byGroup);
  }, [nodes]);
}

/** 官方 `ube(canvasId)`：组名读写（乐观更新 + **显式落盘** + 失败回滚） */
export function useCanvasPinGroupNames() {
  const names = useAppStore((s) => s.config.pinGroupNames);
  const updateConfig = useAppStore((s) => s.updateConfig);
  const saveConfig = useAppStore((s) => s.saveConfig);
  const showToast = useAppStore((s) => s.showToast);

  const renameGroup = useCallback((groupId: string, name: string | null) => {
    const trimmed = name?.trim();
    const next = { ...(names ?? {}) };
    if (trimmed) next[groupId] = trimmed;
    else delete next[groupId];
    // 乐观更新（官方也是先本地写、再调 API、失败回滚）
    updateConfig({ pinGroupNames: next });
    /* 必须显式落盘：`updateConfig` 只改内存，MTV 的持久化入口是 `saveConfig()`
       （SettingsPanel / OutputHistoryPanel 等处都是 `updateConfig(...)` 后再 `void saveConfig()`）。
       否则**重载后组名会回到旧值**（实测踩过：清掉自定义名，刷新又变回来）。 */
    void saveConfig({ silent: true }).catch(() => {
      updateConfig({ pinGroupNames: names ?? {} });
      showToast('重命名失败，请重试。');
    });
  }, [names, updateConfig, saveConfig, showToast]);

  const renameOf = useCallback(
    (groupId: string): string | undefined => names?.[groupId],
    [names],
  );

  return { names: names ?? {}, renameGroup, renameOf, canRename: true };
}

export { PIN_GROUPS };
