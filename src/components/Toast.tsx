/**
 * Toast 全局消息提示 —— **按官方 sonner toast 重建**（2026 第 35 轮）
 *
 * 官方实测（TapNow 0.4.66，CDP 9444，点「复制全部」后 `[data-sonner-toast]`）：
 * ```html
 * <div data-sonner-toast class="!bg-white dark:!bg-zinc-800 !border-0 !text-tap-text-1
 *                              [&_[data-icon]>svg]:!text-[#10b981]">
 *   <div data-icon><svg viewBox="0 0 20 20" width=20 height=20 fill="currentColor">…check-circle…</svg></div>
 *   <div data-content><div data-title>复制成功</div><div data-description class="!text-tap-text-3">内容已复制到剪贴板</div></div>
 * </div>
 * ```
 * | 项 | 官方值 |
 * |---|---|
 * | 位置 | `[data-sonner-toaster]` = `position:fixed; bottom:24px; left:50%`（**底部居中**），z 999999999 |
 * | 卡片 | `display:flex; align-items:center; gap:6px; padding:16px; border-radius:8px; border:0` |
 * | 底色 | `oklch(0.274 0.006 286.033)`（= zinc-800 档） |
 * | 图标 | 16×16 盒子里 20×20 svg，`color:#10b981`（check-circle） |
 * | 内容 | `flex column; gap:2px` |
 * | 标题 | 13px / **500** / line-height 19.5 / 白 |
 * | 说明 | 13px / 400 / line-height 18.2 / `oklch(0.705 0.015 286.067)` |
 * | 额外按钮 | **无**（官方没有复制/关闭按钮 ⇒ 本轮按用户确认删掉 MTV 自造的那两个） |
 *
 * ⚠️ 以前 MTV 的 toast 是「顶部居中 + 玻璃底 + 语义色调 + 复制/关闭按钮」，与官方完全不同 ✗。
 */
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { springSmooth, fadeFast } from '../utils/motion';

/** 官方图标：`viewBox 0 0 20 20` 的 solid check-circle（逐字抄自官方 toast 的 `[data-icon] > svg`） */
const CHECK_CIRCLE_PATH = 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z';
/** 错误/信息沿用同一套图标语言（官方只实测到 success 那颗 `#10b981`；这两色为同系语义色） */
const X_CIRCLE_PATH = 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z';
const INFO_CIRCLE_PATH = 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z';

const TOAST_ICON = {
  success: { path: CHECK_CIRCLE_PATH, color: '#10b981' },
  error: { path: X_CIRCLE_PATH, color: '#ef4444' },
  info: { path: INFO_CIRCLE_PATH, color: '#3b82f6' },
} as const;

export default function Toast() {
  const { toast, dismissToast } = useAppStore(
    useShallow((s) => ({ toast: s.toast, dismissToast: s.dismissToast })),
  );
  const icon = TOAST_ICON[toast.type] ?? TOAST_ICON.success;

  /* ★ 兜底自动消失：store 侧有 2.5s 定时器，但若被连续 `showToast` 重置 / HMR 丢了定时器，
     提示会**一直挂在屏幕上**（用户实测「文件已保存 / 已上传 两个提示不消失」）。
     这里再加一条**与 store 无关**的硬超时，保证任何提示最多停留 4 秒。 */
  useEffect(() => {
    if (!toast.visible) return;
    const t = setTimeout(() => dismissToast(), 4000);
    return () => clearTimeout(t);
  }, [toast.visible, toast.message, dismissToast]);

  return createPortal(
    <AnimatePresence>
      {toast.visible && (
        /* 官方 `[data-sonner-toaster]`：`fixed bottom:24px left:50%` ⇒ 底部居中、从下方浮入 */
        <motion.div
          className="pointer-events-none fixed bottom-6 left-1/2 z-[999999999]"
          style={{ x: '-50%' }}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98, transition: fadeFast }}
          transition={springSmooth}
          onClick={dismissToast}
        >
          {/* 官方卡片：flex / items-center / gap 6px / padding 16px / radius 8px / border 0 / bg oklch(0.274 0.006 286.033) */}
          <div
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
            /* 官方卡片刻度：flex / items-center / gap 6px / padding 16px / **width 356px**（sonner 默认 `--width:356px`）
               / **border-radius 8px** / border 0 / bg oklch(0.274 0.006 286.033)
               ⚠️ `rounded-lg` 在本项目映射到 `--radius`=12px ⇒ 必须写死 `rounded-[8px]` 才是官方值 */
            className="pointer-events-auto flex w-[356px] max-w-[calc(100vw-2rem)] items-center gap-1.5 rounded-[8px] p-4"
            style={{ background: 'oklch(0.274 0.006 286.033)' }}
          >
            <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true" style={{ color: icon.color }}>
              {/* 官方图标尺寸：`[data-icon]` 盒 16×16，里面的 svg 20×20；`data-icon` 不占额外背景 */}
              <svg width={20} height={20} viewBox="0 0 20 20" fill="currentColor" className="-m-0.5">
                <path fillRule="evenodd" d={icon.path} clipRule="evenodd" />
              </svg>
            </span>
            {/* 官方 `[data-content]`：竖排 gap 2px；标题 13/500/19.5，说明 13/400/18.2 */}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="min-w-0 break-words text-[13px] font-medium leading-[19.5px] text-white">
                {toast.message}
              </span>
              {toast.description && (
                <span
                  className="min-w-0 break-words text-[13px] font-normal leading-[18.2px]"
                  style={{ color: 'oklch(0.705 0.015 286.067)' }}
                >
                  {toast.description}
                </span>
              )}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
