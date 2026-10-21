/**
 * officialModal —— 官方**通用对话框（命令式）**的逐字移植。
 *
 * 官方出处：`E:\TapNow-0.4.66\resources\web\assets\index-BiTZf8mJ.js`
 *   · `class jas`      @char6110647 —— 命令式 store（`modals`/`subscribers`/`idCounter`/`add`/`update`/`dismiss`/`dismissAll`）
 *   · `const Id=new jas` @char6111729
 *   · `const _m={confirm,…}` @char6116526 —— 对外 API（`confirm/alert/info/warning/error/success/custom/dismiss/dismissAll/update/promise`）
 *   · `const CA=…`      —— `typeof t=="string" ? {description:t} : t`
 *   · `const WP=t=>e=>{const n=CA(e);return Id.add({...n,variant:t})}`
 *
 * ★ 为什么 MTV 需要它：
 *   MTV 原有的 `services/confirmDialog.ts` 走的是 **Tauri 原生 `confirm()`**
 *   （`@tauri-apps/plugin-dialog`）——那是**系统级**弹窗，既不是官方那个 DOM 弹窗的形态，
 *   也无法用 CDP 截图/真鼠标点击复核 ⇒ 官方「整组执行」那层确认弹窗必须**另建**。
 *
 * ★ 严格逐字的地方（不发明）：
 *   · 全部字段名与语义（`isClosing` / `dismissDelay ?? 150` / `duration` 自动关闭 / `generateId` 形如 `modal-N-<ts>`）
 *   · `dismiss(id)` 先置 `isClosing:true` → notify → **延迟 150ms** 再 `onClose()` + 移除
 *   · `dismiss()` 无参 = 关掉**最后一个**
 *   · `add()` 会先按 id 去重再 push
 *   · `promise()` 的 loading/success/error 三段与文案（`Loading...` / `OK`）
 */
import type { ReactNode } from 'react';

/** 官方按钮三种形态：`false`（不显示）· `string`（只给 label）· 对象 */
export interface OfficialModalButton {
  label: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  /** 官方 `f.variant==="ghost" ? bg-transparent text-[#FAFAFA] : bg-white text-[#18181B]` */
  variant?: 'ghost' | 'destructive';
  className?: string;
}

export type OfficialModalButtonInput = false | string | OfficialModalButton;

/** 官方 `Has` 尺寸表（sm/md/lg）；`md` 是默认值 */
export type OfficialModalSize = 'sm' | 'md' | 'lg';

/** 官方 `Vas` 读到的全部 option（字段名逐字） */
export interface OfficialModalOptions {
  title?: ReactNode;
  description?: ReactNode;
  content?: ReactNode | ((args: { close: () => void }) => ReactNode);
  confirmButton?: OfficialModalButtonInput;
  cancelButton?: OfficialModalButtonInput;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  /** 有它时**完全接管**关闭请求（官方 `s` 第一条分支） */
  onDismissRequest?: () => void;
  onClose?: () => void;
  closeOnOverlayClick?: boolean;
  variant?: 'confirm' | 'alert' | 'info' | 'warning' | 'error' | 'success' | 'custom' | string;
  size?: OfficialModalSize;
  width?: number | string;
  modal?: boolean;
  enterAnimation?: 'fade' | string;
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  showCloseIcon?: boolean;
  showIcon?: boolean;
  preventOpenAutoFocus?: boolean;
  accessibilityTitle?: string;
  /** 官方 `e.duration` —— >0 时**自动关闭**（ms） */
  duration?: number;
  /** 官方 `e.dismissDelay ?? 150` —— 关闭动画时长（ms） */
  dismissDelay?: number;
  id?: string;
}

export interface OfficialModalRecord extends OfficialModalOptions {
  id: string;
  createdAt: number;
  isClosing?: boolean;
}

type Subscriber = (modals: OfficialModalRecord[]) => void;

/** 官方 `class jas` —— 逐字移植 */
export class OfficialModalStore {
  modals: OfficialModalRecord[] = [];
  subscribers = new Set<Subscriber>();
  idCounter = 0;
  /**
   * ⚠️ 官方 `Oba` 用的是 `useState` + `useEffect(()=>Id.subscribe(...))`；
   *   MTV 的 eslint 规则 `react-hooks/set-state-in-effect` **禁止**在 effect 里 setState
   *   ⇒ 这里改用 `useSyncExternalStore`，它要求 `getSnapshot()` **引用稳定**
   *   ⇒ 存一份快照，在状态真正变动的唯一出口 `notify()` 里更新。
   *   （语义与官方一致：`notify()` 本来就给订阅者发 `[...this.modals]`。）
   */
  snapshot: OfficialModalRecord[] = [];

  generateId(): string {
    return `modal-${++this.idCounter}-${Date.now()}`;
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  notify(): void {
    this.snapshot = [...this.modals];
    this.subscribers.forEach((subscriber) => {
      subscriber(this.snapshot);
    });
  }

  /** 给 `useSyncExternalStore` 用的稳定快照（见 `snapshot` 字段说明） */
  getSnapshot(): OfficialModalRecord[] {
    return this.snapshot;
  }

  getModals(): OfficialModalRecord[] {
    return [...this.modals];
  }

  add(options: OfficialModalOptions): string {
    const id = options.id || this.generateId();
    this.modals = this.modals.filter((modal) => modal.id !== id);
    const record: OfficialModalRecord = { ...options, id, createdAt: Date.now() };
    this.modals.push(record);
    this.notify();
    if (options.duration && options.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, options.duration);
    }
    return id;
  }

  update(id: string, patch: Partial<OfficialModalOptions>): void {
    this.modals = this.modals.map((modal) => (modal.id === id ? { ...modal, ...patch } : modal));
    this.notify();
  }

  dismiss(id?: string): void {
    if (id) {
      this.modals = this.modals.map((modal) => (modal.id === id ? { ...modal, isClosing: true } : modal));
      this.notify();
      const delay = this.modals.find((modal) => modal.id === id)?.dismissDelay ?? 150;
      setTimeout(() => {
        const target = this.modals.find((modal) => modal.id === id);
        target?.onClose?.();
        this.modals = this.modals.filter((modal) => modal.id !== id);
        this.notify();
      }, delay);
      return;
    }
    const last = this.modals[this.modals.length - 1];
    if (last) this.dismiss(last.id);
  }

  dismissAll(): void {
    this.modals.map((modal) => modal.id).forEach((id) => {
      this.dismiss(id);
    });
  }

  getById(id: string): OfficialModalRecord | undefined {
    return this.modals.find((modal) => modal.id === id);
  }
}

/** 官方 `const Id=new jas` */
export const officialModalStore = new OfficialModalStore();

/** 官方 `const CA` —— 字符串入参等价于 `{description}` */
function toOptions(input: string | OfficialModalOptions): OfficialModalOptions {
  return typeof input === 'string' ? { description: input } : input;
}

/** 官方 `const WP=t=>e=>{const n=CA(e);return Id.add({...n,variant:t})}` */
function variantAdder(variant: string) {
  return (input: string | OfficialModalOptions): string =>
    officialModalStore.add({ ...toOptions(input), variant });
}

export interface OfficialModalPromiseOptions<T> {
  loading?: string | OfficialModalOptions;
  success?: string | OfficialModalOptions | ((value: T) => string | OfficialModalOptions);
  error?: string | OfficialModalOptions | ((error: unknown) => string | OfficialModalOptions);
}

/** 官方 `_m` —— 对外 API（同一份表面） */
export const officialModal = {
  confirm: variantAdder('confirm'),
  alert: variantAdder('alert'),
  info: variantAdder('info'),
  warning: variantAdder('warning'),
  error: variantAdder('error'),
  success: (input: string | OfficialModalOptions): string =>
    officialModalStore.add({ ...toOptions(input), variant: 'info', showIcon: true }),
  custom: (input: OfficialModalOptions): string => officialModalStore.add({ ...input, variant: 'custom' }),
  dismiss: (id?: string): void => {
    officialModalStore.dismiss(id);
  },
  dismissAll: (): void => {
    officialModalStore.dismissAll();
  },
  update: (id: string, patch: Partial<OfficialModalOptions>): void => {
    officialModalStore.update(id, patch);
  },
  promise: async <T>(
    task: () => Promise<T>,
    options: OfficialModalPromiseOptions<T>,
  ): Promise<T> => {
    const loading = options.loading ? toOptions(options.loading) : { description: 'Loading...' };
    const id = officialModalStore.add({
      ...loading,
      variant: 'info',
      cancelButton: false,
      confirmButton: false,
      showCloseIcon: false,
      closeOnOverlayClick: false,
    });
    try {
      const value = await task();
      if (options.success) {
        const success =
          typeof options.success === 'function' ? options.success(value) : options.success;
        officialModalStore.update(id, {
          ...toOptions(success),
          variant: 'info',
          confirmButton: { label: 'OK' },
          cancelButton: false,
          showCloseIcon: true,
          closeOnOverlayClick: true,
        });
      } else {
        officialModalStore.dismiss(id);
      }
      return value;
    } catch (error) {
      if (options.error) {
        const failure =
          typeof options.error === 'function' ? options.error(error) : options.error;
        officialModalStore.update(id, {
          ...toOptions(failure),
          variant: 'error',
          confirmButton: { label: 'OK' },
          cancelButton: false,
          showCloseIcon: true,
          closeOnOverlayClick: true,
        });
      } else {
        officialModalStore.dismiss(id);
      }
      throw error;
    }
  },
};
