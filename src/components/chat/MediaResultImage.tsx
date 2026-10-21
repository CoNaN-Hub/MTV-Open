/**
 * 官方「聊天内图片 + 画布动作」—— `page-BeI7xydN.js`@643072 的 `WD`（`displayName="MarkdownImage"`）逐字。
 *
 * 官方原文：
 *   const g1 = "inline-flex items-center gap-1.5 rounded-md bg-white/15 backdrop-blur-xs px-3 py-1.5
 *               text-sm font-medium text-white transition-colors hover:bg-white/25 cursor-pointer";
 *   <span className="group/img relative my-2 block overflow-hidden rounded-xl">
 *     <img src alt className="block w-full rounded-xl" />
 *     <span className="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200 group-hover/img:opacity-100" />
 *     <span className="absolute top-2.5 right-2.5 z-10 opacity-0 transition-opacity duration-200 group-hover/img:opacity-100">
 *       {已在画布上
 *         ? <button className={g1} onClick={聚焦到该节点}>
 *             <Check size={14} stroke={2.5} />{t('chatAdapter.mediaDetail.viewOnCanvas')}
 *           </button>
 *         : <button className={g1} onClick={添加到画布}>{t('chatAdapter.mediaDetail.applyToCanvas')}</button>}
 *     </span>
 *   </span>
 *
 * 官方还有一个 `src → nodeId` 的 Map 缓存（`Zy`）与 `Yc({src,title},{position})` 建节点；
 * MTV 侧这两件事由宿主的 `onAddToCanvas(messageId)` / `onNodeActivate(nodeId)` 承担（等价链路）。
 */
import { useCallback } from 'react';
import { useT } from '../../i18n';
import ViewportImage from '../shared/ViewportImage';
import { OfficialCheckIcon } from './officialIcons';
import { CANVAS_ACTION_CLASS } from './mediaResultClasses';


export default function MediaResultImage({
  src,
  alt,
  className,
  onAddToCanvas,
  canvasNodeId,
  onViewOnCanvas,
}: {
  src: string;
  alt: string;
  className?: string;
  /** 官方「添加到画布」（未在画布上时显示）。 */
  onAddToCanvas?: () => void;
  /** 已建节点 id ⇒ 按钮切成官方「在画布上查看」。 */
  canvasNodeId?: string;
  /** 官方「在画布上查看」＝聚焦到该节点。 */
  onViewOnCanvas?: (nodeId: string) => void;
}) {
  const t = useT();
  const added = Boolean(canvasNodeId);
  const handleView = useCallback(() => {
    if (canvasNodeId) onViewOnCanvas?.(canvasNodeId);
  }, [canvasNodeId, onViewOnCanvas]);

  return (
    <span className="group/img relative my-2 block overflow-hidden rounded-xl">
      <ViewportImage src={src} alt={alt} className={['block w-full rounded-xl', className ?? ''].join(' ')} />
      <span className="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200 group-hover/img:opacity-100" />
      <span className="absolute top-2.5 right-2.5 z-10 opacity-0 transition-opacity duration-200 group-hover/img:opacity-100">
        {added ? (
          <button type="button" onClick={handleView} className={CANVAS_ACTION_CLASS}>
            <OfficialCheckIcon size={14} strokeWidth={2.5} />
            {t('在画布上查看')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAddToCanvas?.()}
            className={CANVAS_ACTION_CLASS}
            disabled={!onAddToCanvas}
          >
            {t('添加到画布')}
          </button>
        )}
      </span>
    </span>
  );
}
