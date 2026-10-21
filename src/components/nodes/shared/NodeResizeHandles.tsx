/**
 * NodeResizeHandles —— 官方节点「拖角缩放」的等价实现
 *
 * 官方出处（EXE `zoom-slider-3ZcFvYQO.js`）：
 *   `yW` @（resizer 包装器）：
 *     const Mle = ["top","right","bottom","left"];                  // 4 条边（Line 变体）
 *     const Rle = ["top-left","top-right","bottom-left","bottom-right"];  // 4 个角（Handle 变体）
 *     → 8 个 `<NodeResizeControl>`（React Flow 原生），`isVisible` 默认 true，
 *       `minWidth=10/minHeight=10` 只是签名兜底值
 *   外壳 `gIe` @1223400 调用处逐字：`l.jsx(yW,{minWidth:250,minHeight:X,...g})`
 *     · `X` = 外壳的 `minHeight`（签名默认 **250**）⇒ **最小 250×250**
 *     · `z = resizable && mergedPolicy.canvasMeta?.nodeResize !== false` 才渲染（MTV 无该策略 ⇒ 恒渲染）
 *     · 文本/图片/视频/音频节点的调用点都传 `resizable:!0`
 *   ⚠️ 官方节点的尺寸是 **React Flow 原生 `node.width/height`**（RF 自己 applyNodeChanges）；
 *      MTV 的尺寸存在 `data.nodeWidth/nodeHeight`（渲染时读它）⇒ 这里在 `onResize` 里把
 *      RF 算出来的尺寸**写回 data**，同时在拖动改变左上角时同步 `position`（官方由 RF 自己写）。
 *   ⚠️ 图片卡**不接**：MTV 的图卡尺寸完全由比例决定（`pR(ratio)`），而官方 `RNe` 也会把尺寸
 *      重新钉回 `Ua(ratio)` ⇒ 接上去等于白拖（源码如此）。
 */
import { memo, useCallback } from 'react';
import { NodeResizer, type ResizeParams } from '@xyflow/react';
import { useAppStore } from '../../../store/useAppStore';

/** 官方外壳的最小尺寸（`yW({minWidth:250, minHeight:250})`） */
export const OFFICIAL_NODE_MIN_SIZE = 250;

export interface NodeResizeHandlesProps {
  nodeId: string;
  /** 官方 `isVisible`（默认 true） */
  isVisible?: boolean;
  minWidth?: number;
  minHeight?: number;
}

function NodeResizeHandles({
  nodeId,
  isVisible = true,
  minWidth = OFFICIAL_NODE_MIN_SIZE,
  minHeight = OFFICIAL_NODE_MIN_SIZE,
}: NodeResizeHandlesProps) {
  const handleResize = useCallback((_event: unknown, params: ResizeParams) => {
    const store = useAppStore.getState();
    /* 尺寸写回 `data`（MTV 的渲染来源）*/
    store.updateNodeDataTransient(nodeId, {
      nodeWidth: Math.round(params.width),
      nodeHeight: Math.round(params.height),
    });
    /* 拖上/左边时 RF 会给新位置 ⇒ 同步过去（官方由 RF 原生尺寸流负责）*/
    const node = store.nodes.find((n) => n.id === nodeId);
    if (node && (node.position.x !== params.x || node.position.y !== params.y)) {
      store.onNodesChange([{ id: nodeId, type: 'position', position: { x: params.x, y: params.y }, dragging: true }]);
    }
  }, [nodeId]);

  const handleResizeEnd = useCallback(() => {
    useAppStore.getState().commitToHistory();
  }, []);

  return (
    <NodeResizer
      isVisible={isVisible}
      minWidth={minWidth}
      minHeight={minHeight}
      onResize={handleResize}
      onResizeEnd={handleResizeEnd}
    />
  );
}

export default memo(NodeResizeHandles);
