/**
 * ScissorsEdge 白透边 — 复刻 FTV 的 `scissorsEdge` 边类型。
 * 描边为半透明白色 rgba(255,255,255,0.376)，无流动/虚线动画，用于
 * 「连线拖拽预览」与「待剪断边高亮」这类需要弱化、通透观感的场景。
 * 仅在显式声明 type: 'scissors-edge' 的边或连线预览线上生效，不改动
 * 其它已有连线的默认样式（DEFAULT_EDGE_STYLE）。
 */
import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

const SCISSORS_EDGE_COLOR = 'rgba(255,255,255,0.376)';
const SCISSORS_EDGE_WIDTH = 1.5;

function ScissorsEdge({
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
}: EdgeProps) {
  // @xyflow/react v12：labelX/labelY 由路径函数返回，不再由 EdgeProps 提供。
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={{
        stroke: SCISSORS_EDGE_COLOR,
        strokeWidth: SCISSORS_EDGE_WIDTH,
        ...style,
      }}
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

export default memo(ScissorsEdge);
