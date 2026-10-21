/**
 * Toast slice — ephemeral user-facing message state
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './useAppStore';

export interface ToastSlice {
  /* `description` = 官方 sonner toast 的**第二行**（例：复制成功 / 内容已复制到剪贴板）
     —— 官方 i18n：`copySuccess:"复制成功"` + `copySuccessDesc:"内容已复制到剪贴板"`（`index-BiTZf8mJ.js` @9768863 那个块） */
  toast: { visible: boolean; message: string; description?: string; type: 'success' | 'error' | 'info' };
  showToast: (message: string, type?: 'success' | 'error' | 'info', description?: string) => void;
  dismissToast: () => void;
}

const initialToast = { visible: false, message: '', description: undefined as string | undefined, type: 'success' as const };

/** 报错要留够读完和点复制的时间 */
const TOAST_DURATION = { error: 15_000, other: 2_500 };

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export const createToastSlice: StateCreator<AppState, [], [], ToastSlice> = (set) => ({
  toast: { ...initialToast },
  showToast: (message, type = 'success', description) => {
    // 上一条的定时器不清掉会把这条提前关掉
    clearTimeout(hideTimer);
    set({ toast: { visible: true, message, description, type } });
    hideTimer = setTimeout(
      () => set((state) => ({ toast: { ...state.toast, visible: false } })),
      type === 'error' ? TOAST_DURATION.error : TOAST_DURATION.other,
    );
  },
  dismissToast: () => {
    clearTimeout(hideTimer);
    set({ toast: { visible: false, message: '', description: undefined, type: 'success' } });
  },
});
