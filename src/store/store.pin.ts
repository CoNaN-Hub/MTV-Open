/**
 * store.pin —— 官方 Pin 的**过滤态**（zoom-slider @1213046 `Zke`，逐字语义）：
 *   filteredGroupId: null
 *   setGroupOpen(id, open): open  → 若已是该组则原样返回，否则 {filteredGroupId:id}
 *                           !open → 若正是该组则清空，否则原样返回
 *   clearFilter(): 已经是 null 就原样返回（避免无意义重渲染）
 * 纯 UI 态**不持久化**（官方也没存）；组名持久化在 config.pinGroupNames（见 useCanvasPinGroups）。
 */
import { create } from 'zustand';

interface PinFilterState {
  filteredGroupId: string | null;
  setGroupOpen: (groupId: string, open: boolean) => void;
  clearFilter: () => void;
  /** 官方 `locateNode` 里的 `highlightedNodes`（MTV 用"高亮环"表达，1.6s 后自动清） */
  locatedNodeId: string | null;
  setLocatedNode: (nodeId: string | null) => void;
}

export const usePinFilterStore = create<PinFilterState>((set) => ({
  filteredGroupId: null,
  setGroupOpen: (groupId, open) => set((state) => {
    if (open) return state.filteredGroupId === groupId ? state : { filteredGroupId: groupId };
    return state.filteredGroupId === groupId ? { filteredGroupId: null } : state;
  }),
  clearFilter: () => set((state) => (state.filteredGroupId === null ? state : { filteredGroupId: null })),
  locatedNodeId: null,
  setLocatedNode: (nodeId) => set((state) => (state.locatedNodeId === nodeId ? state : { locatedNodeId: nodeId })),
}));

/** 官方 `VD()` */
export function useFilteredPinGroupId(): string | null {
  return usePinFilterStore((s) => s.filteredGroupId);
}

/** 定位高亮的节点 id（官方 `addHighlightedNodes` 的等价物） */
export function useLocatedPinNodeId(): string | null {
  return usePinFilterStore((s) => s.locatedNodeId);
}
