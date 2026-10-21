/**
 * 确认卡在消息流里的**分发点组件** —— 官方消息渲染器 @2427106 的：
 * ```js
 * if (dg(e)) return s.jsx(qet, {content: e.content, onAnswer: l, generationFailedMap: h});
 * if (iT(e)) return s.jsx(Btt, {content: e.content, onAnswer: l});
 * ```
 * 谓词与 store 切片推导见 `confirmationEventDispatch.ts`（本文件只导出组件）。
 */
import { useCallback } from 'react';
import { GenerationConfirmationCard, type ConfirmationAnswer } from './GenerationConfirmationCard';
import { NodeUpdateConfirmationCard } from './NodeUpdateConfirmationCard';
import { GenerationAutoPreviewCard } from './GenerationConfirmationCard';
import DesktopConfirmationCard, { type DesktopConfirmationCardProps } from './DesktopConfirmationCard';
import {
  confirmationStoreSliceOf,
  isAutoPreviewCardEvent,
  isConfirmationCardToolEvent,
  type ConfirmationAnswerEventDetail,
} from './confirmationEventDispatch';
import { isGenerationConfirmationTool, isNodeUpdateConfirmationTool } from '../../services/chat/generationConfirmationProtocol';
import { isDesktopConfirmationTool } from '../../services/chat/desktopConfirmationCard';

export interface ConfirmationEventCardProps {
  content: Record<string, unknown>;
  /** 宿主的上行通道；未提供时派发 `chat-confirmation-answer`（MTV 既有的事件约定）。 */
  onAnswer?: ConfirmationAnswer;
  generationFailedMap?: Record<string, boolean> | null;
  onNodeActivate?: (nodeId: string) => void;
}

export default function ConfirmationEventCard({
  content,
  onAnswer,
  generationFailedMap,
  onNodeActivate,
}: ConfirmationEventCardProps) {
  const tool = String(content.tool ?? '');
  const isNodeUpdate = isNodeUpdateConfirmationTool(tool);
  const store = confirmationStoreSliceOf(content, isNodeUpdate);

  const handleAnswer = useCallback<ConfirmationAnswer>((confirmationId, action, payload) => {
    if (onAnswer) {
      onAnswer(confirmationId, action, payload);
      return;
    }
    window.dispatchEvent(new CustomEvent<ConfirmationAnswerEventDetail>('chat-confirmation-answer', {
      detail: { confirmationId, action, payload, tool, content },
    }));
  }, [onAnswer, tool, content]);

  if (isNodeUpdate) {
    return (
      <NodeUpdateConfirmationCard
        content={content}
        onAnswer={handleAnswer}
        store={store}
        onNodeActivate={onNodeActivate}
      />
    );
  }
  if (isGenerationConfirmationTool(tool)) {
    return (
      <GenerationConfirmationCard
        content={content}
        onAnswer={handleAnswer}
        generationFailedMap={generationFailedMap}
        store={store}
        onNodeActivate={onNodeActivate}
      />
    );
  }
  /* 官方渲染器 @2428328：`gen_image`/`gen_video`/`generation_request` 且 completed|failed ⇒ `eet`。 */
  if (isAutoPreviewCardEvent(content)) {
    return <GenerationAutoPreviewCard content={content} />;
  }
  /* 官方 `$M`（@2426950）的 `kD` 分支：`if(kD(e)) return s.jsx($Qe,{content:e.content,onAnswer:l})`。
     `$Qe` = `DesktopConfirmationCard`（本轮由并发子代理移植，见 `live-确认卡与widget.md` 第 3 章）。
     ⚠️ 官方那张卡的 `bridge` 由宿主注入（`P1e`/`Vfe` 等 host bridge **尚未解析**）⇒ 不注入，
     卡片按 F 的约定**不伪造 ready/error**。 */
  if (isDesktopConfirmationTool(tool)) {
    return (
      <DesktopConfirmationCard
        content={content as unknown as DesktopConfirmationCardProps['content']}
        onAnswer={handleAnswer}
      />
    );
  }
  if (isConfirmationCardToolEvent(tool)) return null;
  return null;
}
