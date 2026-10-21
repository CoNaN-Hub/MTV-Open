/**
 * useNodeInPile — 该节点是否已被收进某个**堆叠（PILE）**。
 *
 * 官方语义：进入堆叠后由**堆叠工具栏**统一操作成员 ⇒ **成员自身的节点工具栏不再显示**
 * （`PileNode` 的 `uJe` 只渲染堆叠自己那条）。MTV 的堆叠成员仍以
 * `pile-member-anchor` 形式留在画布上，会照常挂自己的工具栏 ⇒ 与堆叠工具栏
 * **同时可见**，用户实测「两个工具栏 + 闪烁」。
 *
 * ⚠️ `ImageNode` 早就内联了同样的判断（`inPile`），但 **video / text / audio / panorama
 *    四个节点类型漏了** ⇒ 堆叠里放这些类型时依然双工具栏。这里抽成共享 hook，
 *    四个类型统一用，避免再漏。
 *
 * 判据用 `utils/officialPile` 的 `pileMemberIds`，与 `PileNode` 的成员投影**同一份口径**。
 */
import { useAppStore } from '../store/useAppStore';
import { pileMemberIds } from '../utils/officialPile';

export function useNodeInPile(nodeId: string): boolean {
  return useAppStore((s) => s.nodes.some((n) => n.type === 'pile' && pileMemberIds(n).includes(nodeId)));
}
