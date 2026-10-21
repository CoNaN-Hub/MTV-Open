import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

/* ══════════════════════════════════════════════════════════════════════════
   窗口标题 —— 1:1 照官方（`page-DPdEgTS0.js` @1756051）
   ──────────────────────────────────────────────────────────────────────────
   官方源码：
     ```js
     ee = w.trim() ? `${w.trim()} | ${t('common.pageTitle')}` : t('common.pageTitle');
     V4(ee);
     ```
     · `w`        = 画布/项目名（官方新建时是 `Untitled`）
     · `pageTitle`= i18n `common.pageTitle` = **"TapNow｜你的智能体创意画布"**（zh-CN）
                   英文 = "TapNow | Your Agentic Creative Canvas"
     ⇒ 官方标题 = `项目名 | 应用名｜标语`；项目名为空时只用 pageTitle。
     Electron 的窗口标题跟随 `document.title` ⇒ 主进程里没有任何 `setTitle` ✓（已核对 `main.cjs`）。

   MTV（Tauri）：窗口标题**不跟随** `document.title` ⇒ 额外调 `getCurrentWindow().setTitle()`
   （需要 capability `core:window:allow-set-title`，已加进 `capabilities/default.json`）。
   ⚠️ 两个都写：`document.title` 保证浏览器调试窗口（localhost:5180）也一致。
   ══════════════════════════════════════════════════════════════════════════ */

/** MTV 的 pageTitle（对应官方 `common.pageTitle` = `品牌｜标语`）：
    官方 = `TapNow｜你的智能体创意画布` ⇒ MTV = `MTV｜导演画布`（同结构：品牌 ｜ 产品线） */
export const APP_PAGE_TITLE = 'MTV｜导演画布';

/** 官方 `ee` 的等价实现（纯函数，便于单测） */
export function buildWindowTitle(projectName: string | undefined | null): string {
  const name = (projectName ?? '').trim();
  return name ? `${name} | ${APP_PAGE_TITLE}` : APP_PAGE_TITLE;
}

export function useWindowTitle(): void {
  const projectName = useAppStore((s) => s.projectName);
  useEffect(() => {
    const title = buildWindowTitle(projectName);
    document.title = title;
    if (typeof window === 'undefined' || !('__TAURI__' in window)) return;
    let cancelled = false;
    void (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        if (!cancelled) await getCurrentWindow().setTitle(title);
      } catch {
        /* 标题设置失败不影响任何功能 */
      }
    })();
    return () => { cancelled = true; };
  }, [projectName]);
}
