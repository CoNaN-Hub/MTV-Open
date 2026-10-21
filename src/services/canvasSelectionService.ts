/**
 * canvasSelectionService —— 让**非画布组件**（store 切片 / 服务 / 工具条）能请求画布改选区。
 *
 * 背景（为什么需要它）：MTV 有**两套**选区状态 ——
 *   ① React Flow 内部选区（`.react-flow__node.selected`、拖拽/Delete 的实际作用对象）
 *   ② MTV 自己的 store（`selectedNodeIds` / `selectionSource`，所有浮层与业务逻辑读它）
 * 二者平时是**单向同步**的：用户点击 → RF → `onSelectionChange` → store（`Canvas.tsx`）。
 * ⇒ 如果在别处只调 `store.setSelectedNodeIds(...)`，RF 那边**不会跟着变**，
 *    会出现「store 说选了 A、RF 仍select 着 B」的分裂状态（拖拽/删除按 RF 走、浮层按 store 走）。
 *
 * 所以凡是**程序化改选区**，都应当走这里：请求交给 Canvas（它持有 `useStoreApi()`），
 * 由 RF 自己改选中态，再经 `onSelectionChange` 回流到 store —— 单一事实来源仍然是 RF。
 *
 * 范式与 `services/canvasViewportService.ts` 的控制器注册完全一致（Canvas 挂载时注册）。
 */
export interface CanvasSelectionController {
  /** 把画布选区**替换**为给定节点（传空数组 = 全部取消选中） */
  selectNodes: (ids: readonly string[]) => void;
  /**
   * 只有「刚刚 `addNodes` 进来的新节点」才需要：这些节点**当帧不在 RF 的 lookup 里**，
   * 走 `selectNodes` 的延迟路径会一直悬到下一次任意 `nodes` 变化才生效。
   * 本方法返回一个 Promise：Canvas 会在新节点真正进 RF 的那一帧**立即**改选区并 resolve。
   */
  selectNodesAfterRender: (ids: readonly string[]) => Promise<void>;
}

let selectionController: CanvasSelectionController | null = null;

export function registerCanvasSelectionController(controller: CanvasSelectionController): () => void {
  selectionController = controller;
  return () => {
    if (selectionController === controller) selectionController = null;
  };
}

/** 请求画布把选区替换为 `ids`（Canvas 未挂载时静默忽略） */
export function selectNodesInCanvas(ids: readonly string[]): void {
  selectionController?.selectNodes(ids);
}

/** 等新节点落进 React Flow 之后再改选区（返回的 Promise 在选区真正落下后 resolve） */
export function selectNodesInCanvasAfterRender(ids: readonly string[]): Promise<void> {
  return selectionController?.selectNodesAfterRender(ids) ?? Promise.resolve();
}
