/**
 * CommandMenuNode —— 连线命令菜单的**占位节点**（官方 `type: COMMAND`，`Lke({type:"command"}, pos)`）。
 *
 * 官方机制（`zoom-slider-3ZcFvYQO.js` @2905900 起 `uZe` / @1204650 起 `jke`）：
 *   拖拽结束（或点 + 按钮）时不只是弹菜单，而是**往画布上加一个节点**，并且
 *   `addEdges([qo(edges, {source: fromNodeId, target: menuNodeId, edgeTag:"command"}, {deletable:!1})])`
 *   —— 也就是把「连线」换成一条**连到菜单节点的真边**，所以**松手后线不会消失**，而且剪不断。
 *   菜单节点自己带两个 `invisible` Handle（target=左 / source=右）当锚点：
 *     <div className="w-px h-px">
 *       <Handle type="target" position={Left} className="invisible" />
 *       <Handle type="source" position={Right} className="invisible" />
 *     </div>
 *
 * ★ MTV 落地：占位节点**只活在 React 渲染层**（由 `useConnectionDropMenu` 的 `pending` 暴露、
 *   `Canvas` 追加进 `nodes`/`edges`），**不写 store、不进持久化** —— 菜单关闭即随之消失，
 *   不会在工程里留下垃圾节点 ✓（官方是写进画布的，但它有专门的 command 边/节点清理逻辑）。
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function CommandMenuNode() {
  return (
    <div className="w-px h-px">
      {/* 官方两个隐形锚点 Handle ✓（边就接在这里，所以线不会消失） */}
      <Handle type="target" position={Position.Left} className="invisible" />
      <Handle type="source" position={Position.Right} className="invisible" />
    </div>
  );
}

export default memo(CommandMenuNode);
