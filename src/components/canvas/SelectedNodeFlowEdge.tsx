/**
 * SelectedNodeFlowEdge — 选中节点的连线渲染。
 *
 * 这里原先还有一条「沿连线流动的光带」（SVG `<animateMotion>` + 品牌色渐变）。
 * 按 TapNow 官方实测已删除（Design.md §12.4 / §12.5 / §14.4 · checklist D8）：
 * 官方画布**零关键帧动画**、连线**没有流动效果**，选中只是把线提亮为**纯白 2px**
 * （见 `styles/reactflow.css` 的 `.react-flow__edge.selected`）。
 *
 * 组件与边类型名保留，仅用于承载「贝塞尔 / 平滑阶梯」的路径选择。
 */
import { memo } from 'react';
import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

const SMOOTHSTEP_TYPE = 'smoothstep';

function SelectedNodeFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  interactionWidth,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  data,
}: EdgeProps) {
  const pathParams = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };
  const [edgePath, labelX, labelY] = data?.selectedNodeFlowBaseType === SMOOTHSTEP_TYPE
    ? getSmoothStepPath(pathParams)
    : getBezierPath(pathParams);

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={interactionWidth}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
    />
  );
}

export default memo(SelectedNodeFlowEdge);
