/**
 * useIsDirectSingleSelection —— 官方 `nd(nodeId)` 的等价物
 *
 * 官方定义（TapNowExtract · `index-BiTZf8mJ.js` @7601574，内部名 `eBl`，经导出名 `sV` 被
 * `zoom-slider` 以别名 `nd` 使用）：
 *
 *   const eBl = nodeId => store(s =>
 *     s.selectionSource === "direct"        // ★ 框选（"marquee"）不算
 *     && s.selectedNodeCount === 1          // ★ 必须恰好单选
 *     && s.selectedNodeIds.has(nodeId));    // ★ 且就是这一个
 *
 * 官方节点工具栏（`jl` = NodeToolbarLayer）用的就是这个门：
 *   `const visible = visibleProp && !isLoading && nd(nodeId)`
 * 外加浮层自己的 `!isDragging`（`eT` = NodeFloatingLayer）。
 */
import { useAppStore } from '../store/useAppStore';

export function useIsDirectSingleSelection(nodeId: string): boolean {
  return useAppStore((s) => (
    s.selectionSource === 'direct'
    && s.selectedNodeIds.length === 1
    && s.selectedNodeIds.includes(nodeId)
  ));
}

export default useIsDirectSingleSelection;
