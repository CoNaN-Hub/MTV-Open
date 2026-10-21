/**
 * OfficialModalContainer —— 官方"通用对话框"渲染层（`Vas` + `Oba`）的逐字移植。
 *
 * 官方出处：`E:\TapNow-0.4.66\resources\web\assets\index-BiTZf8mJ.js`
 *   · `Vas=({modal:t,isTop:e})`  @char6111955   —— 单个弹窗
 *   · `const Has={sm:…,md:…,lg:…}` @char6111746 —— 尺寸表
 *   · `Oba=()=>{…}`              @char6116172   —— 容器（订阅 store，`isTop = index === length-1`）
 *   · 图标：`Zc` = lucide **Loader2**（@char4326487，path `M12 3a9 9 0 1 0 9 9`，现代 lucide 名 `LoaderCircle`）
 *           `S1` = lucide **X**（@char4975803）
 *
 * ★ 类名一律**逐字照抄**（含 `data-[state=*]:` 前缀那串）——见 `styles/official-modal.css`
 *   头部说明：那串类在 MTV 里不会被 Tailwind 生成，动画由该 CSS 按 tailwindcss-animate
 *   默认值手写等价实现（`.official-modal-*[data-state]` 钩子类）。
 *
 * ★ 与官方不同的**唯一**一点（结构层面，非视觉）：官方内容跑在 Radix
 *   `AlertDialog.Root/Portal/Overlay/Content` 上（`aQe/rQe/j9e/H9e`）；
 *   MTV 没有 `@radix-ui/*` 依赖 ⇒ 这里用 `createPortal` + 普通 DOM 复刻同一棵 DOM/同一批类名。
 *   Radix 的行为语义（Esc 关闭、外部点击、打开时自动聚焦、关闭后焦点归位）按官方取值手动实现：
 *     · `onOpenChange(!open)` → `s()`（= `onDismissRequest` 优先，否则 `onCancel` + `Id.dismiss`）
 *     · `onClick: u` = `closeOnOverlayClick !== false` 时才 `stopPropagation()` + `s()`
 *     · `onPointerDownOutside/onInteractOutside` = `closeOnOverlayClick === false` 时 `preventDefault()`
 *       （MTV 里 overlay 铺满全屏，外部点击必然落在 overlay 上 ⇒ 由 overlay 的 `onClick` 兜住）
 *     · `onOpenAutoFocus` = `preventOpenAutoFocus ? preventDefault+blur : 聚焦首个可聚焦元素`
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import {
  officialModalStore,
  type OfficialModalButton,
  type OfficialModalButtonInput,
  type OfficialModalRecord,
} from '../../services/officialModal';

/** 官方 `const Has` —— 逐字（`maxWidth` / `padding` / `cornerRadius`） */
const OFFICIAL_MODAL_SIZES = {
  sm: { maxWidth: '313px', padding: 'p-6', cornerRadius: 'rounded-2xl' },
  md: { maxWidth: '368px', padding: 'p-6', cornerRadius: 'rounded-2xl' },
  lg: { maxWidth: '502px', padding: 'px-6 pt-9 pb-7', cornerRadius: 'rounded-[32px]' },
} as const;

/** 官方 `h=(M,A)=>M===!1?null:typeof M=="string"?{label:M}:M||{label:A}` */
function normalizeButton(
  input: OfficialModalButtonInput | undefined,
  fallbackLabel: string,
): OfficialModalButton | null {
  if (input === false) return null;
  if (typeof input === 'string') return { label: input };
  return input || { label: fallbackLabel };
}

function classNames(...values: Array<string | false | null | undefined | string[]>): string {
  return values.flat().filter(Boolean).join(' ');
}

function OfficialModalView({ modal, isTop }: { modal: OfficialModalRecord; isTop: boolean }) {
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const { onDismissRequest, onCancel, onConfirm, id, preventOpenAutoFocus } = modal;

  /** 官方 `s` —— 关闭请求 */
  const requestDismiss = useCallback(() => {
    if (onDismissRequest) {
      onDismissRequest();
      return;
    }
    onCancel?.();
    officialModalStore.dismiss(id);
  }, [onDismissRequest, onCancel, id]);

  /** 官方 `l` —— 确认 */
  const handleConfirm = useCallback(async () => {
    const buttonClick = typeof modal.confirmButton === 'object' ? modal.confirmButton.onClick : undefined;
    try {
      setConfirmBusy(true);
      if (buttonClick) await buttonClick();
      if (onConfirm) await onConfirm();
      officialModalStore.dismiss(id);
    } finally {
      setConfirmBusy(false);
    }
  }, [modal.confirmButton, onConfirm, id]);

  /** 官方 `c` —— 取消 */
  const handleCancel = useCallback(async () => {
    const buttonClick = typeof modal.cancelButton === 'object' ? modal.cancelButton.onClick : undefined;
    try {
      setCancelBusy(true);
      if (buttonClick) await buttonClick();
      onCancel?.();
      officialModalStore.dismiss(id);
    } finally {
      setCancelBusy(false);
    }
  }, [modal.cancelButton, onCancel, id]);

  /** 官方 `u` —— overlay 点击 */
  const handleOverlayClick = useCallback(
    (event: ReactMouseEvent) => {
      if (modal.closeOnOverlayClick === false) return;
      event.stopPropagation();
      requestDismiss();
    },
    [modal.closeOnOverlayClick, requestDismiss],
  );

  /**
   * 官方 Radix `AlertDialog` 的 Esc 语义（`DismissableLayer`）：
   * 只要 dismiss 未被 `onDismissRequest` 拦截就会走 `onOpenChange(false)`
   * ⇒ `closeOnOverlayClick:false` **不**拦 Esc（官方只用它拦外部点击）。
   */
  useEffect(() => {
    if (!isTop) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      requestDismiss();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isTop, requestDismiss]);

  /** 官方 Radix `onOpenAutoFocus`：默认聚焦首个可聚焦元素，`preventOpenAutoFocus` 时 preventDefault + blur */
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    if (preventOpenAutoFocus) {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      return;
    }
    const first = node.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (first ?? node).focus();
  }, [preventOpenAutoFocus]);

  const confirmButton = normalizeButton(modal.confirmButton, 'Confirm');
  const cancelButton = modal.cancelButton !== false ? normalizeButton(modal.cancelButton, 'Cancel') : null;
  const isDestructive =
    modal.variant === 'error' ||
    (typeof modal.confirmButton === 'object' && modal.confirmButton.variant === 'destructive');
  const size = modal.size || 'md';
  const sizeSpec = OFFICIAL_MODAL_SIZES[size] ?? OFFICIAL_MODAL_SIZES.md;
  const widthStyle =
    modal.width === undefined
      ? {}
      : typeof modal.width === 'number'
        ? { width: `${modal.width}px` }
        : { width: modal.width };
  const isFadeOnly = modal.enterAnimation === 'fade';
  const dataState = modal.isClosing ? 'closed' : 'open';

  return (
    <>
      {isTop && (
        <div
          data-state={dataState}
          className={classNames(
            'fixed inset-0 z-50 bg-black/80',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'official-modal-overlay',
            modal.overlayClassName,
          )}
          onClick={handleOverlayClick}
          onPointerDown={(event) => {
            // 官方 `onPointerDownOutside`：`closeOnOverlayClick === false` 时 preventDefault（不关）
            if (modal.closeOnOverlayClick === false) event.preventDefault();
          }}
        />
      )}
      <div
        ref={contentRef}
        role="alertdialog"
        aria-modal={modal.modal ?? true}
        aria-label={!modal.title ? (modal.accessibilityTitle || 'Dialog') : undefined}
        data-state={dataState}
        data-testid="official-modal-content"
        tabIndex={-1}
        className={classNames(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full border-2 border-[#3F3F46] bg-[#272729]',
          'rounded-2xl',
          sizeSpec.cornerRadius,
          sizeSpec.padding,
          'backdrop-blur-[88px]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          isFadeOnly
            ? 'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
            : [
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[52%]',
                'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[40%]',
              ],
          modal.preventOpenAutoFocus && 'outline-none focus:outline-none focus-visible:outline-none',
          'official-modal-content',
          isFadeOnly && 'official-modal-content--fade',
          modal.className,
        )}
        style={{ maxWidth: sizeSpec.maxWidth, ...widthStyle }}
      >
        {modal.showCloseIcon && (
          <button
            type="button"
            className="absolute right-6 top-6 rounded-sm text-[#F5F5F5] opacity-100 transition-opacity hover:opacity-70 focus:outline-none disabled:pointer-events-none"
            onClick={requestDismiss}
          >
            <Icon icon="lucide:x" className="h-5 w-5" strokeWidth={2} />
            <span className="sr-only">Close</span>
          </button>
        )}
        <div className={classNames('flex flex-col', size === 'lg' ? 'gap-1' : 'gap-2', modal.contentClassName)}>
          {modal.title ? (
            <h2
              className={classNames(
                'leading-[1.5] tracking-tight text-[#F5F5F5]',
                size === 'lg' ? 'text-2xl font-semibold' : 'text-lg font-bold',
              )}
            >
              {modal.title}
            </h2>
          ) : (
            <h2 className="sr-only">{modal.accessibilityTitle || 'Dialog'}</h2>
          )}
          {modal.description && (
            <p
              className={classNames(
                'leading-[1.5]',
                size === 'lg' ? 'text-base font-medium text-[#646464]' : 'text-sm text-[#A3A3A3]',
              )}
            >
              {modal.description}
            </p>
          )}
          {modal.content &&
            (typeof modal.content === 'function'
              ? modal.content({ close: () => officialModalStore.dismiss(id) })
              : modal.content)}
        </div>
        {(confirmButton || cancelButton) && (
          <div className={classNames('flex w-full gap-4', size === 'lg' ? 'mt-5' : 'mt-4')}>
            {cancelButton && (
              <button
                type="button"
                className={classNames(
                  'h-9 min-w-0 flex-1 rounded-lg bg-[#3F3F46] px-4 text-sm font-normal text-[#FAFAFA]',
                  'transition-opacity hover:opacity-80',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  cancelButton.className,
                )}
                disabled={cancelButton.disabled || cancelBusy}
                onClick={() => {
                  void handleCancel();
                }}
              >
                {cancelBusy ? '...' : cancelButton.label}
              </button>
            )}
            {confirmButton && (
              <button
                type="button"
                className={classNames(
                  'flex items-center justify-center gap-2',
                  'h-9 min-w-0 flex-1 rounded-lg px-4 text-sm font-normal',
                  'transition-opacity hover:opacity-80',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  isDestructive
                    ? 'bg-[#4D3030] text-[#FF6163]'
                    : confirmButton.variant === 'ghost'
                      ? 'bg-transparent text-[#FAFAFA]'
                      : 'bg-white text-[#18181B]',
                  confirmButton.className,
                )}
                disabled={confirmButton.disabled || confirmBusy}
                onClick={() => {
                  void handleConfirm();
                }}
              >
                {confirmBusy && <Icon icon="lucide:loader-circle" width={16} height={16} className="animate-spin" />}
                {confirmButton.label}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** 官方 `Oba`（`displayName = "ModalContainer"`）—— 常驻挂载一次 */
export default function OfficialModalContainer() {
  const modals = useSyncExternalStore(
    (onStoreChange) => officialModalStore.subscribe(onStoreChange),
    () => officialModalStore.getSnapshot(),
    () => officialModalStore.getSnapshot(),
  );

  if (modals.length === 0) return null;

  return createPortal(
    <>
      {modals.map((modal, index) => (
        <OfficialModalView key={modal.id} modal={modal} isTop={index === modals.length - 1} />
      ))}
    </>,
    document.body,
  );
}
