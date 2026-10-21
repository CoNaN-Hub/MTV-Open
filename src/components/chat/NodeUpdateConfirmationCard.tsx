/**
 * `node_update_confirmation` 卡 —— 官方 **分发器 `Btt`** + 两张子卡 —— live 官方逐字移植。
 *
 * 权威源码：`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`
 *
 * | 官方本地名 | 定义偏移 | 本文件导出名 | 说明 |
 * |---|---|---|---|
 * | `Btt` | 2358212 | `NodeUpdateConfirmationCard` | **顶层分派器**：`Ott` 命中 → `Utt`，否则 → `ztt` |
 * | `ztt` | 2350962 | `SingleNodeUpdateCard` | 单请求卡（`data-testid="node-update-confirmation-card"`） |
 * | `Utt` | 2353965 | `BatchNodeUpdateCard` | 批量卡（`data-testid="node-update-confirmation-batch-card"`） |
 * | `Ott` | 2350378 | （`services/chat/nodeUpdateConfirmation.ts`）`extractNodeUpdateViewModel` | viewModel |
 * | `Att` | 2348252 | `NodeUpdateBody`（内联在本文件） | body 渲染（prompt → `fF`，否则 `_D`） |
 * | `are` | 2347888 | `nodeUpdateReferencesForNode`（内联） | nodeId → references（`node/${id}`） |
 * | `Ff` / `Of` / `Dx` / `ore` | 2159117 / 2159421 / 2268748 / 2346210 | `generationConfirmation.ts` | 状态解析 |
 * | `Kf` | 2283167 | `NodeThumbRow`（`showTooltip={false}`） | 节点缩略图条（**旧表误标为 `zf`@2244248**） |
 * | `Rx` / `WJe` | 2244665 / 2245461 | `PromptItemList` / `PromptItem` | prompt 编辑区 |
 * | `ss` | vendor-packages `G → jk` @318777 | `MentionIconText`（仓库既有逐字移植） | 卡头图标（14×14 视框、`fill="none"`、**无 stroke**） |
 *
 * ⚠️ **无独立的「已应答静态卡」**：官方 `Btt` 是分发器，两条分支都可交互；非 `pending` 时只渲染状态点，
 * 不渲染按钮。§9.1 记载该项「未挖到」，本轮实测**确认仍为空**。
 *
 * ⚠️ 与官方的两处替换（均在代码内 `官方实体未解析，待替换` 标注）：
 *   1. `are`（@2347888）用 `Ic(nodeId)`（画布 store）取媒体形状并按 image/video/audio 分组；
 *      本文件读 MTV `useAppStore` 的节点 `data.type` 直接映射。
 *   2. `Att` 的 `fF`（mention pill 渲染）/ `_D`（markdown）→ 仓库既有 `ChatReferenceText` / `ChatMarkdown`。
 */
import { memo, useCallback, useMemo, useState } from 'react';
import {
  NodeThumbRow,
  PromptItemList,
} from './ConfirmationCardParts';
import { cx } from './confirmationCardUtils';
import { useSinglePromptState } from '../../services/chat/confirmationPromptState';
import ChatMarkdown from './ChatMarkdown';
import ChatReferenceText from './ChatReferenceText';
import { MentionIconText } from './MentionLibraryParts';
import { useAppStore } from '../../store/useAppStore';
import { useConfirmationText } from '../../services/chat/generationConfirmationStrings';
import {
  isConfirmationInFlight,
  resolveCardVisualStatus,
  statusStyleOf,
  type CardStatus,
  type ConfirmationStoreSlice,
} from '../../services/chat/generationConfirmation';
import {
  buildNodeUpdateAnswerPayload,
  buildNodeUpdateBody,
  collectNodeUpdateRefs,
  extractNodeUpdateViewModel,
  nodeUpdateCarrierOf,
  normalizeNodeUpdateChanges,
  resolveNodeUpdateEditTarget,
  type NodeUpdateViewModel,
  type NodeUpdateViewModelItem,
} from '../../services/chat/nodeUpdateConfirmation';

export type NodeUpdateAnswer = (
  confirmationId: string,
  action: 'confirm' | 'reject',
  payload?: unknown,
) => void;

export interface NodeUpdateConfirmationCardProps {
  content: Record<string, unknown>;
  onAnswer?: NodeUpdateAnswer;
  /** 官方 `qe(hs)` 的只读切片。 */
  store?: ConfirmationStoreSlice | null;
  onNodeActivate?: (nodeId: string) => void;
}

/* ------------------------------------------------------------------ *
 * 官方 `are` @2347888 —— nodeId → references
 * ------------------------------------------------------------------ */

/** 官方 `are(e)`：`Ic(nodeId)` 取 `{orderedImages, orderedVideos, orderedAudios}` 后按类型展开。
 *  官方实体未解析，待替换：MTV 直接读 `useAppStore` 的节点 `data.type`。 */
function nodeUpdateReferencesForNode(nodeId: string) {
  const node = useAppStore.getState().nodes.find((item) => item.id === nodeId);
  const type = (node?.data ?? {}) as { type?: string };
  const declaredMediaKind = type.type === 'video' ? 'video' : type.type === 'audio' ? 'audio' : 'image';
  return [{ source: `node/${nodeId}`, nodeId, declaredMediaKind }];
}

/* ------------------------------------------------------------------ *
 * 官方 `Att` @2348252 —— body 渲染
 * ------------------------------------------------------------------ */

/** 官方 markdown 的 className（逐字；由调用点 `Utt` 传入）。 */
const BODY_MARKDOWN_CLASS = cx(
  '!text-sm !font-normal !leading-5 !tracking-[0.12px] !text-white/90',
  '[&_p]:!text-sm [&_p]:!font-normal [&_p]:!leading-5 [&_p]:!tracking-[0.12px] [&_p]:!text-white/90',
  '[&_ul]:!my-0 [&_ol]:!my-0 [&_[data-streamdown=code-block]]:!my-1',
);

/** 官方 `Att`（@2348252）。 */
function NodeUpdateBody({ nodeId, text, isPrompt }: { nodeId: string; text: string; isPrompt: boolean }) {
  /* 官方 `Att` 会先调 `are(nodeId)` 拿到 `references` 再交给 `fF`。
     官方实体未解析，待替换：仓库 `ChatReferenceText` 不接收 references（引用形状从文本 token 现算），
     这里保留 `nodeId` 入参以维持官方调用签名。 */
  void nodeId;
  return isPrompt
    ? <ChatReferenceText value={text} />
    : <div className={BODY_MARKDOWN_CLASS}><ChatMarkdown value={text} /></div>;
}

/* ------------------------------------------------------------------ *
 * 官方 `ztt` @2350962 —— 单请求卡
 * ------------------------------------------------------------------ */

/** 官方 `ztt` 的两个按钮的**单个静态字符串**（含 `disabled:` 变体，逐字）。 */
export const NODE_UPDATE_CANCEL_BUTTON_CLASS = 'inline-flex items-center rounded-lg bg-white/[0.09] px-3 py-2 text-xs font-normal leading-3 text-[#F5F5F5] transition-colors hover:bg-white/[0.14] focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.09]';
export const NODE_UPDATE_UPDATE_BUTTON_CLASS = 'inline-flex items-center rounded-lg bg-[#F5F5F5] px-3 py-2 text-xs font-normal leading-3 text-[#0F0F0F] transition-opacity hover:opacity-85 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-100';

/** 官方 `Ff` 的调用（带 `kind` 约束），与 `generationConfirmation.ts` 的实现同源。 */
function resolveNodeUpdateStatus(
  content: Record<string, unknown>,
  confirmationId: string,
  store: ConfirmationStoreSlice | null | undefined,
  requireKind: boolean,
): CardStatus {
  const pending = store?.pendingConfirmation;
  if (pending?.confirmationId === confirmationId) {
    if (requireKind && pending.kind !== 'node_update') {
      /* 官方：`m.kind === "node_update"` 不满足 ⇒ 不进入可交互态，但状态本身仍为 `pending`。 */
    } else {
      return (pending.status ?? 'pending') as CardStatus;
    }
  }
  const resolved = store?.resolvedConfirmations?.[confirmationId];
  if (resolved) return resolved;
  const result = content.result as Record<string, unknown> | undefined;
  const status = content.status ?? result?.status;
  if (status === 'completed') {
    const action = (content.response as Record<string, unknown> | undefined)?.action
      ?? (content.result as Record<string, unknown> | undefined)?.action
      ?? content.action;
    return action === 'reject' ? 'rejected' : 'confirmed';
  }
  if (status === 'failed') return 'rejected';
  return 'pending';
}

export const SingleNodeUpdateCard = memo(function SingleNodeUpdateCard({
  content,
  onAnswer,
  store,
  onNodeActivate,
}: NodeUpdateConfirmationCardProps) {
  const t = useConfirmationText();
  const carrier = nodeUpdateCarrierOf(content);
  const changes = useMemo(() => (carrier ? extractViewModelChanges(carrier) : []), [carrier]);
  const nodeRefs = useMemo(() => (carrier ? collectNodeUpdateRefs(carrier) : []), [carrier]);
  const references = useMemo(() => nodeUpdateReferencesForNode(nodeRefs[0] ?? ''), [nodeRefs]);
  const confirmationId = (carrier?.confirmation_id as string | undefined) ?? '';
  const cardStatus = confirmationId
    ? resolveNodeUpdateStatus(content, confirmationId, store, true)
    : 'pending';
  const pending = store?.pendingConfirmation;
  const interactive = cardStatus === 'pending'
    && pending?.confirmationId === confirmationId
    && pending.kind === 'node_update'
    && pending.status === 'pending';
  const visual = resolveCardVisualStatus({ cardStatus });
  const dotStatus = visual === 'pending' ? null : visual;
  const dotStyle = dotStatus ? statusStyleOf(dotStatus) : null;
  const fallbackSummary = t('chatAdapter.nodeUpdateConfirmation.defaultSummary');
  const summary = (carrier?.summary as string | undefined) || fallbackSummary;
  const body = carrier ? buildNodeUpdateBody(carrier, changes, summary) : summary;
  const editTarget = useMemo(() => resolveNodeUpdateEditTarget(carrier, changes), [carrier, changes]);
  const { getEffectivePrompt, handleItemChange, pendingEditsRef, prompt } = useSinglePromptState(body);
  const hasRefs = nodeRefs.length > 0;
  const inFlight = confirmationId ? isConfirmationInFlight(content, confirmationId, store) : false;

  const handleConfirm = useCallback(() => {
    if (!interactive) return;
    const value = getEffectivePrompt();
    const payload = editTarget && value !== body ? buildNodeUpdateAnswerPayload(editTarget, value) : undefined;
    if (payload) onAnswer?.(confirmationId, 'confirm', payload);
    else onAnswer?.(confirmationId, 'confirm');
  }, [confirmationId, editTarget, getEffectivePrompt, interactive, body, onAnswer]);

  const handleReject = useCallback(() => {
    if (interactive) onAnswer?.(confirmationId, 'reject');
  }, [confirmationId, interactive, onAnswer]);

  if (!carrier || inFlight) return null;

  return (
    <div
      data-testid="node-update-confirmation-card"
      style={{ containerType: 'inline-size' }}
      className={cx(
        'my-2 flex w-full flex-col gap-2 overflow-hidden rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
        (cardStatus === 'rejected' || cardStatus === 'skipped') && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-1.5 px-2">
        <MentionIconText size={12} className="text-white/60" opacity={1} />
        <span className="text-xs font-normal leading-4 tracking-[0.12px] text-white/60">
          {t('chatAdapter.nodeUpdateConfirmation.title')}
        </span>
        {dotStyle && (
          <span className={cx('ml-auto flex items-center gap-1.5', dotStyle.colorClass)}>
            <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', dotStyle.dotClass)} />
            <span className="hidden text-xs font-normal leading-4 @[350px]:inline">{t(dotStyle.labelKey)}</span>
          </span>
        )}
      </div>
      <PromptItemList
        mode="single"
        items={[{ prompt, references }]}
        editable={interactive && editTarget !== null}
        pendingEditsRef={pendingEditsRef}
        onItemChange={handleItemChange}
        onNodeActivate={onNodeActivate}
      />
      {hasRefs && (
        <div className="flex items-center justify-end gap-1.5">
          {nodeRefs.length > 0 && (
            <div className="inline-flex shrink-0 items-center gap-1.5">
              <span className="shrink-0 text-xs font-normal leading-4 tracking-[0.12px] text-white/45">
                {t('chatAdapter.nodeUpdateConfirmation.nodeUpdated')}
              </span>
              <NodeThumbRow nodeIds={nodeRefs} showTooltip={false} onNodeActivate={onNodeActivate} />
            </div>
          )}
        </div>
      )}
      {visual === 'pending' && (
        <div className="flex items-center gap-2">
          <span className="flex-1" />
          <button
            type="button"
            disabled={!interactive}
            className={NODE_UPDATE_CANCEL_BUTTON_CLASS}
            onClick={handleReject}
          >
            {t('chatAdapter.nodeUpdateConfirmation.cancel')}
          </button>
          <button
            type="button"
            disabled={!interactive}
            className={NODE_UPDATE_UPDATE_BUTTON_CLASS}
            onClick={handleConfirm}
          >
            {t('chatAdapter.nodeUpdateConfirmation.update')}
          </button>
        </div>
      )}
    </div>
  );
});

/** `sre` 的本地入口（保持 `ztt` 的 `useMemo` 依赖形状）。 */
function extractViewModelChanges(carrier: Record<string, unknown>) {
  const requestJson = (carrier.request_json ?? {}) as Record<string, unknown>;
  return normalizeNodeUpdateChanges(requestJson.changes);
}

/* ------------------------------------------------------------------ *
 * 官方 `Utt` @2353965 —— 批量卡
 * ------------------------------------------------------------------ */

export interface BatchNodeUpdateCardProps extends NodeUpdateConfirmationCardProps {
  viewModel: NodeUpdateViewModel;
}

export const BatchNodeUpdateCard = memo(function BatchNodeUpdateCard({
  viewModel,
  content,
  onAnswer,
  store,
  onNodeActivate,
}: BatchNodeUpdateCardProps) {
  const t = useConfirmationText();
  const { confirmationId, items } = viewModel;
  const cardStatus = resolveNodeUpdateStatus(content, confirmationId, store, true);
  const pending = store?.pendingConfirmation;
  const interactive = cardStatus === 'pending'
    && pending?.confirmationId === confirmationId
    && pending.kind === 'node_update'
    && pending.status === 'pending';
  const [rejectedIndices, setRejectedIndices] = useState<ReadonlySet<number>>(() => new Set<number>());
  const toggleReject = useCallback((index: number) => {
    setRejectedIndices((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!onAnswer || !interactive) return;
    /* 官方 `g`：`{index, action}` 的 per_request_modifications（逐字）。 */
    const perRequest = items.map((item, index) => (
      rejectedIndices.has(index)
        ? { index: item.index, action: 'reject' as const }
        : { index: item.index, action: 'confirm' as const }
    ));
    onAnswer(confirmationId, perRequest.some((entry) => entry.action === 'confirm') ? 'confirm' : 'reject', {
      per_request_modifications: perRequest,
    });
  }, [onAnswer, interactive, items, rejectedIndices, confirmationId]);

  const handleReject = useCallback(() => {
    if (interactive) onAnswer?.(confirmationId, 'reject');
  }, [confirmationId, interactive, onAnswer]);

  const visual = resolveCardVisualStatus({ cardStatus });
  const dotStatus = visual === 'pending' ? null : visual;
  const dotStyle = dotStatus ? statusStyleOf(dotStatus) : null;

  if (confirmationId && isConfirmationInFlight(content, confirmationId, store)) return null;

  return (
    <div
      data-testid="node-update-confirmation-batch-card"
      style={{ containerType: 'inline-size' }}
      className={cx(
        'my-2 flex w-full flex-col gap-2 overflow-hidden rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
        (cardStatus === 'rejected' || cardStatus === 'skipped') && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-1.5 px-2">
        <MentionIconText size={12} className="text-white/60" opacity={1} />
        <span className="text-xs font-normal leading-4 tracking-[0.12px] text-white/60">
          {t('chatAdapter.nodeUpdateConfirmation.title')}
        </span>
        <span className="text-xs font-normal leading-4 tracking-[0.12px] text-white/40">
          {t('chatAdapter.generationConfirmation.batchTasks', { count: items.length })}
        </span>
        {dotStyle && (
          <span className={cx('ml-auto flex items-center gap-1.5', dotStyle.colorClass)}>
            <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', dotStyle.dotClass)} />
            <span className="hidden text-xs font-normal leading-4 @[350px]:inline">{t(dotStyle.labelKey)}</span>
          </span>
        )}
      </div>
      <div className="rounded-2xl bg-[#2F2F2F] p-1">
        <div className={cx('flex flex-col gap-0.5', items.length > 1 && 'max-h-[320px] overflow-y-auto')}>
          {items.map((item: NodeUpdateViewModelItem, index: number) => {
            const rejected = rejectedIndices.has(index);
            const showBody = !!item.bodyText && item.bodyText !== item.summary;
            return (
              <div
                key={item.index}
                data-testid={`node-update-batch-item-${index}`}
                className="rounded-xl p-2 hover:bg-white/10"
              >
                <div className="flex items-start gap-1.5">
                  <span className={cx('shrink-0 text-sm leading-5 text-white/90', rejected && 'line-through opacity-40')}>
                    {index + 1}.
                  </span>
                  <div className={cx('min-w-0 flex-1', rejected && 'opacity-40')}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.nodeRefs.length > 0 && (
                        <NodeThumbRow nodeIds={item.nodeRefs} showTooltip={false} onNodeActivate={onNodeActivate} />
                      )}
                      <span className="min-w-0 text-xs font-normal leading-4 tracking-[0.12px] text-white/45">
                        {item.summary}
                      </span>
                    </div>
                    {showBody && (
                      <div className="mt-1 text-sm leading-5 tracking-[0.12px] text-white/90">
                        <NodeUpdateBody
                          nodeId={item.nodeRefs[0] ?? ''}
                          text={item.bodyText}
                          isPrompt={item.bodyIsPrompt}
                        />
                      </div>
                    )}
                  </div>
                  {interactive && (
                    <button
                      type="button"
                      data-testid={`node-update-batch-reject-${index}`}
                      className="shrink-0 self-start rounded-md px-1.5 py-0.5 text-xs leading-5 text-white/50 transition-colors hover:text-white/80 focus:outline-none"
                      onClick={() => toggleReject(index)}
                    >
                      {t(rejected
                        ? 'chatAdapter.generationConfirmation.restoreItem'
                        : 'chatAdapter.generationConfirmation.rejectItem')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {visual === 'pending' && (
        <div className="flex items-center gap-2">
          <span className="flex-1" />
          <button
            type="button"
            disabled={!interactive}
            className={NODE_UPDATE_CANCEL_BUTTON_CLASS}
            onClick={handleReject}
          >
            {t('chatAdapter.nodeUpdateConfirmation.cancel')}
          </button>
          <button
            type="button"
            disabled={!interactive}
            className={NODE_UPDATE_UPDATE_BUTTON_CLASS}
            onClick={handleConfirm}
          >
            {t('chatAdapter.nodeUpdateConfirmation.update')}
          </button>
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `Btt` @2358212 —— 顶层分派器
 * ------------------------------------------------------------------ */

/**
 * 官方 `Btt`（逐字）：
 * ```
 * Btt = a.memo(function({content, onAnswer}) {
 *   const o = Ott(content);
 *   return o ? s.jsx(Utt, {viewModel:o, content, onAnswer}) : s.jsx(ztt, {content, onAnswer});
 * })
 * ```
 */
export const NodeUpdateConfirmationCard = memo(function NodeUpdateConfirmationCard({
  content,
  onAnswer,
  store,
  onNodeActivate,
}: NodeUpdateConfirmationCardProps) {
  const viewModel = extractNodeUpdateViewModel(content);
  return viewModel
    ? (
      <BatchNodeUpdateCard
        viewModel={viewModel}
        content={content}
        onAnswer={onAnswer}
        store={store}
        onNodeActivate={onNodeActivate}
      />
    )
    : (
      <SingleNodeUpdateCard
        content={content}
        onAnswer={onAnswer}
        store={store}
        onNodeActivate={onNodeActivate}
      />
    );
});
