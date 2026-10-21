/**
 * PinConfirmDialog —— 官方 `hb.confirm(...)` 的确认弹窗（`index-BiTZf8mJ.js` @6111746 `Has` / @6112174 `Vas`）
 *
 * 官方调用（Pin 菜单「移出全部」，`page-DPdEgTS0.js` @1638289）：
 *   hb.confirm({
 *     title: t('canvas.pin.confirm.removeAllNodes.title'),
 *     description: t('canvas.pin.confirm.removeAllNodes.message', { count, name }),
 *     confirmButton: { label: t('canvas.pin.confirm.removeAllNodes.action'), variant: 'destructive' },
 *     cancelButton: { label: t('canvas.pin.confirm.cancel') },
 *     onConfirm: () => removeAll(groupId),
 *   })
 * 未传 `size` ⇒ **md**；未传 `showCloseIcon` ⇒ **没有右上角 X**；未传 `closeOnOverlayClick` ⇒ **点遮罩即取消**。
 *
 * 官方尺寸表 `Has`：
 *   sm { maxWidth:'313px', padding:'p-6',          cornerRadius:'rounded-2xl' }
 *   md { maxWidth:'368px', padding:'p-6',          cornerRadius:'rounded-2xl' }   ← Pin 用这档
 *   lg { maxWidth:'502px', padding:'px-6 pt-9 pb-7', cornerRadius:'rounded-[32px]' }
 *
 * 官方 DOM（逐字）：
 *   overlay  fixed inset-0 z-50 bg-black/80  + fade-in-0/fade-out-0
 *   content  fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full
 *            border-2 border-[#3F3F46] bg-[#272729] rounded-2xl p-6 backdrop-blur-[88px]
 *            + zoom-in-95/zoom-out-95 + fade（`enterAnimation:'fade'` 时才去掉 zoom）
 *      ├ div.flex.flex-col.gap-2
 *      │   ├ Title       leading-[1.5] tracking-tight text-[#F5F5F5] text-lg font-bold
 *      │   └ Description leading-[1.5] text-sm text-[#A3A3A3]
 *      └ div.flex.w-full.gap-4.mt-4
 *          ├ 取消  h-9 min-w-0 flex-1 rounded-lg bg-[#3F3F46] px-4 text-sm font-normal text-[#FAFAFA]
 *          │        transition-opacity hover:opacity-80 disabled:opacity-50
 *          └ 确认  flex items-center justify-center gap-2 h-9 min-w-0 flex-1 rounded-lg px-4
 *                  text-sm font-normal transition-opacity hover:opacity-80 disabled:opacity-50
 *                  destructive ⇒ bg-[#4D3030] text-[#FF6163]
 */
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface PinConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 官方内容基类（`H9e`）+ md 档尺寸 + 变体类，逐字拼接
 *  ⚠️ 圆角必须写死 px：官方 `.dark{--radius:.75rem}` ⇒ `rounded-2xl`=1rem=16px、`rounded-lg`=var(--radius)=**12px**，
 *     而 MTV 是 Tailwind v3 默认刻度（lg=8px）✗ —— 直接用类名会小一圈 */
const CONTENT_CLASS = [
  'fixed left-1/2 top-1/2 z-[250] -translate-x-1/2 -translate-y-1/2 w-full',
  'border-2 border-[#3F3F46] bg-[#272729] rounded-[16px] p-6 backdrop-blur-[88px]',
  'font-[Inter,sans-serif]',
].join(' ');
const TITLE_CLASS = 'leading-[1.5] tracking-tight text-[#F5F5F5] text-lg font-bold';
const DESC_CLASS = 'leading-[1.5] text-sm text-[#A3A3A3]';
const FOOTER_CLASS = 'flex w-full gap-4 mt-4';
const CANCEL_CLASS = [
  'h-9 min-w-0 flex-1 rounded-[12px] bg-[#3F3F46] px-4 text-sm font-normal text-[#FAFAFA]',
  'transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ');
const CONFIRM_CLASS = [
  'flex items-center justify-center gap-2 h-9 min-w-0 flex-1 rounded-[12px] px-4 text-sm font-normal',
  'transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed',
  'bg-[#4D3030] text-[#FF6163]',   // destructive
].join(' ');

export default function PinConfirmDialog({
  title, description, confirmLabel, cancelLabel, onConfirm, onCancel,
}: PinConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  /** 官方 Radix 默认行为：打开时把焦点给第一个可聚焦元素（= 取消钮） */
  useEffect(() => { cancelRef.current?.focus(); }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  return createPortal(
    <>
      {/* overlay：`fixed inset-0 z-50 bg-black/80`，官方点遮罩 = 取消 */}
      <div
        aria-hidden="true"
        className="pin-confirm-overlay fixed inset-0 z-[250] bg-black/80"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={`pin-confirm-content ${CONTENT_CLASS}`}
        style={{ maxWidth: 368 }}
      >
        <div className="flex flex-col gap-2">
          <h2 className={TITLE_CLASS}>{title}</h2>
          <p className={DESC_CLASS}>{description}</p>
        </div>
        <div className={FOOTER_CLASS}>
          <button type="button" ref={cancelRef} className={CANCEL_CLASS} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={CONFIRM_CLASS} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
