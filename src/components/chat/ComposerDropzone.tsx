/**
 * ComposerDropzone —— 官方 `Cle`（`page-BeI7xydN.js`@730249 附近，拖拽附件时的覆盖层）逐字复刻。
 *
 * 官方原文：
 *   const Cle = ({isDragging, isOver, attachments = [], maxAttachments = 10}) => {
 *     const limitReached = attachments.length >= maxAttachments;
 *     if (!isDragging || !isOver) return null;
 *     return (
 *       <div className={cx(
 *         "absolute inset-0 backdrop-blur-[4px] flex items-center justify-center z-10 pointer-events-none
 *          transition-all duration-300 rounded-2xl",
 *         limitReached ? "bg-gradient-to-b from-destructive/5 to-destructive/10"
 *                      : "bg-gradient-to-b from-primary/10 via-primary/15 to-primary/20")}>
 *      ⚠️ 官方那四个渐变类名在 MTV（Tailwind v3 + 纯 `var()` 色键）下**不会生成** ⇒ 这里改写成
 *         显式 `color-mix` 任意值，颜色与官方一致。
 *         <div className="flex flex-col items-center gap-3">
 *           <div className={cx("p-4 rounded-full transition-all duration-300",
 *             limitReached ? "bg-destructive/10 scale-100" : "bg-primary/20 scale-110 animate-pulse")}>
 *             <svg className={cx("w-8 h-8 transition-colors duration-300",
 *               limitReached ? "text-destructive" : "text-primary")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
 *               {limitReached ? <path d="M6 18L18 6M6 6l12 12"/> : <path d="M12 4v16m8-8H4"/>}
 *             </svg>
 *           </div>
 *           <div className={cx("font-medium text-base", limitReached ? "text-destructive" : "text-primary")}>
 *             {limitReached ? t('chatAdapter.dropzone.limitReached', {maxAttachments})
 *                           : t('chatAdapter.dropzone.dropToAdd')}
 *           </div>
 *         </div>
 *       </div>
 *     );
 *   };
 */
import { useT } from '../../i18n';

export interface ComposerDropzoneProps {
  isDragging: boolean;
  isOver: boolean;
  /** 已挂的附件数（官方判据 `attachments.length >= maxAttachments`）。 */
  attachmentCount?: number;
  maxAttachments?: number;
}

export default function ComposerDropzone({
  isDragging,
  isOver,
  attachmentCount = 0,
  maxAttachments = 10,
}: ComposerDropzoneProps) {
  const t = useT();
  const limitReached = attachmentCount >= maxAttachments;
  if (!isDragging || !isOver) return null;
  return (
    <div
      className={[
        'absolute inset-0 backdrop-blur-[4px] flex items-center justify-center z-10 pointer-events-none',
        'transition-all duration-300 rounded-2xl',
        limitReached
          /* ⚠️ 这里**不能**写官方的 `from-destructive/5` 那套：Tailwind v3 对纯 `var()` 色键不生成透明度变体，
             那批渐变透明度类名全是惰性 class（渐进色根本不出现）。改用显式 `color-mix` 任意值，颜色与官方一致。 */
          ? 'bg-gradient-to-b from-[color-mix(in_oklab,var(--destructive)_5%,transparent)] to-[color-mix(in_oklab,var(--destructive)_10%,transparent)]'
          : 'bg-gradient-to-b from-[color-mix(in_oklab,var(--primary)_10%,transparent)] via-[color-mix(in_oklab,var(--primary)_15%,transparent)] to-[color-mix(in_oklab,var(--primary)_20%,transparent)]',
      ].join(' ')}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className={[
            'p-4 rounded-full transition-all duration-300',
            limitReached ? 'bg-destructive/10 scale-100' : 'bg-primary/20 scale-110 animate-pulse',
          ].join(' ')}
        >
          <svg
            className={`w-8 h-8 transition-colors duration-300 ${limitReached ? 'text-destructive' : 'text-primary'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            {limitReached
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />}
          </svg>
        </div>
        <div className={`font-medium text-base ${limitReached ? 'text-destructive' : 'text-primary'}`}>
          {limitReached
            ? t('已达到附件数量上限（最多{maxAttachments}个）', { maxAttachments })
            : t('松开以添加附件')}
        </div>
      </div>
    </div>
  );
}
