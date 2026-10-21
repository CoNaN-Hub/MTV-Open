/**
 * Titlebar — 窗口标题栏（**54px**，原生观感：左图标+标题、右侧最小化/最大化/关闭）
 *
 * ★ 为什么自绘：Windows 的系统标题栏高度由系统固定（实测含边框 38px，Tauri/Electron 都无法配置），
 *   要做到**精确 54px** 只能 `decorations:false` + 自己画一条。自绘条保持原生行为：
 *   `data-tauri-drag-region` 拖动（含贴边/双击最大化，由 Tauri 走系统 `startDragging`）、
 *   右侧按钮调用系统 `minimize / toggleMaximize / close`，配色沿用系统浅色标题栏（#f3f3f3），
 *   与官方 Electron 端那条浅色原生标题栏观感一致（官方标题栏也是浅色 + 左标题 + 右按钮）。
 * macOS 走系统交通灯样式（沿用原实现）。
 */
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import AnimatedButton from './shared/AnimatedButton';
import { useT } from '../i18n';

export const TITLEBAR_HEIGHT = 54;

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
const isMacOS = typeof navigator !== 'undefined'
  && /Macintosh|Mac OS X/.test(navigator.userAgent);

export default function Titlebar() {
  // Not running in Tauri — render nothing
  if (!isTauri) return null;

  return <TauriTitlebar />;
}

function TauriTitlebar() {
  const [api, setApi] = useState<typeof import('@tauri-apps/api/window') | null>(null);

  useEffect(() => {
    import('@tauri-apps/api/window').then(setApi);
  }, []);

  const getCurrentWindow = api?.getCurrentWindow;
  if (!getCurrentWindow) return null;

  return <TitlebarInner getCurrentWindow={getCurrentWindow} />;
}

function TitlebarInner({
  getCurrentWindow,
}: {
  getCurrentWindow: typeof import('@tauri-apps/api/window').getCurrentWindow;
}) {
  const t = useT();
  const [isWindowExpanded, setIsWindowExpanded] = useState(false);
  const appWindow = getCurrentWindow();
  const projectName = useAppStore((state) => state.projectName);
  const sidebarFloating = useAppStore((state) => state.config.sidebarFloating) === true
    && !isWindowExpanded;

  useEffect(() => {
    const check = () => {
      const statePromise = isMacOS
        ? appWindow.isFullscreen()
        : appWindow.isMaximized();
      statePromise.then(setIsWindowExpanded);
    };
    check();
    const unlistenPromise = appWindow.onResized(check);
    return () => { unlistenPromise.then((fn) => fn()); };
  }, [appWindow]);

  const toggleWindowExpanded = async () => {
    if (!isMacOS) {
      await appWindow.toggleMaximize();
      return;
    }

    const isFullscreen = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFullscreen);
    setIsWindowExpanded(!isFullscreen);
  };

  if (isMacOS) {
    return (
      <div
        data-tauri-drag-region
        className={`fixed top-3 z-[200] flex h-6 items-center select-none ${
          sidebarFloating ? 'left-10' : 'left-3'
        }`}
      >
        <div
          className="glass-bevel glass-bevel--floating flex items-center gap-1.5 rounded-full border border-border
                     bg-secondary/45 px-2 py-1.5 shadow-lg shadow-black/20 backdrop-blur-xl"
        >
          <MacTrafficLight
            label={t('关闭')}
            className="bg-[#ff5f57] hover:bg-[#ff7b74]"
            onClick={() => appWindow.close()}
          >
            <CloseIcon />
          </MacTrafficLight>
          <MacTrafficLight
            label={t('最小化')}
            className="bg-[#febc2e] hover:bg-[#ffcb55]"
            onClick={() => appWindow.minimize()}
          >
            <MinimizeIcon />
          </MacTrafficLight>
          <MacTrafficLight
            label={isWindowExpanded ? t('退出全屏') : t('全屏')}
            className="bg-[#28c840] hover:bg-[#4dd662]"
            onClick={() => { void toggleWindowExpanded(); }}
          >
            {isWindowExpanded ? <RestoreIcon /> : <MaximizeIcon />}
          </MacTrafficLight>
        </div>
      </div>
    );
  }

  /* Windows / Linux：整条 54px 标题栏（原生观感） */
  return (
    <div className="app-titlebar" data-tauri-drag-region>
      <div className="app-titlebar__brand" data-tauri-drag-region>
        <span className="app-titlebar__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" opacity="0.9" />
            <rect x="4" y="4.5" width="3" height="7" rx="1" fill="#fff" />
            <rect x="9" y="4.5" width="3" height="7" rx="1" fill="#fff" />
          </svg>
        </span>
        <span className="app-titlebar__title" data-tauri-drag-region>
          {projectName ? `${projectName} | MTV 导演画布` : 'MTV 导演画布'}
        </span>
      </div>

      <div className="app-titlebar__controls">
        <button
          type="button"
          className="app-titlebar__btn"
          onClick={() => appWindow.minimize()}
          aria-label={t('最小化')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        <button
          type="button"
          className="app-titlebar__btn"
          onClick={() => { void toggleWindowExpanded(); }}
          aria-label={isWindowExpanded ? t('还原') : t('最大化')}
        >
          {isWindowExpanded ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="2" y="0" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="app-titlebar__btn app-titlebar__btn--close"
          onClick={() => appWindow.close()}
          aria-label={t('关闭')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MacTrafficLight({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatedButton
      onClick={onClick}
      aria-label={label}
      data-tooltip={label}
      scale={1.08}
      tapScale={0.92}
      className={`group flex h-3 w-3 items-center justify-center rounded-full
                  text-black/60 shadow-inner shadow-white/30 ring-1 ring-black/20
                  transition-colors ${className}`}
    >
      <span className="opacity-0 transition-opacity group-hover:opacity-100">
        {children}
      </span>
    </AnimatedButton>
  );
}

function MinimizeIcon() {
  return (
    <svg width="6" height="6" viewBox="0 0 7 7" aria-hidden="true">
      <rect x="1" y="3" width="5" height="1" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="6" height="6" viewBox="0 0 7 7" aria-hidden="true">
      <path d="M1.4 1h4.2L1 5.6V1.4C1 1.18 1.18 1 1.4 1Z" fill="currentColor" />
      <path d="M5.6 6H1.4L6 1.4v4.2c0 .22-.18.4-.4.4Z" fill="currentColor" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="6" height="6" viewBox="0 0 7 7" aria-hidden="true">
      <path d="M2.2 1h3.4c.22 0 .4.18.4.4v3.4L2.2 1Z" fill="currentColor" />
      <path d="M4.8 6H1.4a.4.4 0 0 1-.4-.4V2.2L4.8 6Z" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="6" height="6" viewBox="0 0 7 7" aria-hidden="true">
      <path d="M1.6 1.1 5.9 5.4l-.5.5L1.1 1.6l.5-.5Z" fill="currentColor" />
      <path d="M5.4 1.1 1.1 5.4l.5.5 4.3-4.3-.5-.5Z" fill="currentColor" />
    </svg>
  );
}
