/**
 * App 根组件 — 装配 Header / Sidebar / Canvas / NodeMenu / SettingsPanel / Titlebar / Toast / AINodeDialog / WorkflowPanel
 * Tauri 环境下启用自定义窗口装饰和透明圆角窗口
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { MotionConfig, motion, useReducedMotion } from 'framer-motion';
import Header from './components/Header';
import { useWindowTitle } from './hooks/useWindowTitle';
import { CANVAS_TOP_OVERLAYS } from './config/canvasTopOverlays';
import Titlebar from './components/Titlebar';
import SessionProjectTabs from './components/SessionProjectTabs';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import NodeMenu from './components/NodeMenu';
import Toast from './components/Toast';
import TransferCenter from './components/canvas/TransferCenter';
/* 官方「通用对话框」(`ea`) 的常驻容器（= 官方 `Oba` / `ModalContainer`）
   ⚠️ 必须挂一次且**只有一个**：官方 store 是模块级单例，多挂会重复渲染同一批 modal。 */
import OfficialModalContainer from './components/shared/OfficialModalContainer';
import HtmlPreview from './components/chat/HtmlPreview';
import { useHtmlPreviewTarget, useHtmlPreviewTargetStore } from './services/chat/htmlPreviewTarget';
import WorkspacePage from './components/workspace/WorkspacePage';
import { setWorkspaceLandingTab } from './components/workspace/workspaceLanding';
import CanvasBackground from './components/backgrounds/CanvasBackground';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAutoSave } from './hooks/useAutoSave';
import { useReferencedImageWatcher } from './hooks/useReferencedImageWatcher';
import { useTooltipAutoPlacement } from './hooks/useTooltipAutoPlacement';
import { parseAspectRatio, useMainWindowSize } from './hooks/useMainWindowSize';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, type AppState } from './store/useAppStore';
import * as fileService from './services/fileService';
// MTV 重品牌：自动更新器已移除，仅保留类型，不再引入更新函数。
import { type UpdateInfo } from './services/updateService';
import { DOWNLOAD_MASCOT_EVENT } from './components/shared/ModelDownloadDialog';
import UpdateBubble from './components/shared/mascot/UpdateBubble';
import LazyLoadBoundary, { LazyLoadFallback } from './components/shared/LazyLoadBoundary';
import ModalOverlay from './components/shared/ModalOverlay';
import { useMascotStatus } from './hooks/useMascotStatus';
import { useMascotLifecycle } from './hooks/useMascotLifecycle';
import { useMascotDrag } from './hooks/useMascotDrag';
// type-only：Mascot 是懒加载的，类型导入不会把它拖进主包
import type { MascotHandle } from './components/shared/mascot/Mascot';
import { initComfyUIWindowBridge } from './services/comfyUIWindowService';
import { invoke } from '@tauri-apps/api/core';
import { prepareSettingsClose, resumeSettingsPersistence } from './services/configPersistenceQueue';

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

// 懒加载：吉祥物引入 three + gsap（体积大户），默认隐藏，首次 Ctrl+Shift+M 显示时才加载
const Mascot = lazy(() => import('./components/shared/mascot/Mascot'));
const PacmanMascot = lazy(() => import('./components/shared/mascot/PacmanDownloadMascot'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const AINodeDialog = lazy(() => import('./components/nodes/AINodeDialog'));
const WorkflowPanel = lazy(() => import('./components/WorkflowPanel'));
const AssetsPanel = lazy(() => import('./components/AssetsPanel'));
const CharacterLibraryPanel = lazy(() => import('./components/CharacterLibraryPanel'));
const OutputHistoryPanel = lazy(() => import('./components/OutputHistoryPanel'));
const ChatPanel = lazy(() => import('./components/chat/ChatPanel'));
/**
 * 对话助手**预加载**（用户实测：「点 agent 按钮 出现『正在加载对话助手』 这是干啥的」）。
 *
 * 面板是 `lazy()` 拆出来的独立 chunk，第一次点开要现下载 chunk ⇒ 会闪一个
 * 「正在加载对话助手」的胶囊。官方没有这个中间态（点开即出面板）。
 * ⇒ 启动后**空闲时**就把这块 chunk 拉下来（不阻塞首屏），点开时已经是同步可用。
 */
const preloadChatPanel = () => import('./components/chat/ChatPanel');
/** 官方 Chatbox 浮球入口：体积很小（=3 张 webp 引用 + framer-motion），随主包同步加载，
 *  否则「面板收起时右下角先空一块再蹦出来」。 */
import AgentChatEntryOrb from './components/chat/AgentChatEntryOrb';
import InsertFromCanvasPickToolbar from './components/chat/InsertFromCanvasPickToolbar';
import InsertFromCanvasPickCursorLabel from './components/chat/InsertFromCanvasPickCursorLabel';
const PresetRunnerDialog = lazy(() => import('./components/nodes/shared/PresetRunnerDialog'));
const ReversePromptDialog = lazy(() => import('./components/nodes/shared/ReversePromptDialog'));
const DirectorDeskRuntimeManager = lazy(() => import('./components/director/DirectorDeskRuntimeManager'));
const OnboardingDialog = lazy(() => import('./components/OnboardingDialog'));

/** 首次启动引导只弹一次；关掉后写入本地标记。 */
const ONBOARDING_SEEN_KEY = 'ai-canvas-onboarding-seen';

let cachedMascotNodes: AppState['nodes'] | undefined;
let cachedMascotLoading = false;

function selectMascotLoading(state: AppState) {
  if (!state.config.mascotVisible) return false;
  if (state.nodes !== cachedMascotNodes) {
    cachedMascotNodes = state.nodes;
    cachedMascotLoading = state.nodes.some(
      (node) => (node.data as { status?: string })?.status === 'loading',
    );
  }
  return cachedMascotLoading;
}

function useFeatureMount(active: boolean) {
  const [hasMounted, setHasMounted] = useState(active);
  if (active && !hasMounted) setHasMounted(true);
  return active || hasMounted;
}

export default function App() {
  const reduceMotion = useReducedMotion();
  useKeyboardShortcuts();
  useAutoSave();
  useReferencedImageWatcher();
  useTooltipAutoPlacement();
  /* 窗口标题 = `项目名 | MTV｜导演画布`（官方 `项目名 | pageTitle` 的等价实现，见 hook 注释） */
  useWindowTitle();
  // 记住窗口尺寸；勾了「固定窗口比例」时还会把比例锁住
  const lockedAspect = useAppStore((s) => (s.config.windowAspectLocked ? s.config.windowAspectRatio ?? '16:9' : null));
  useMainWindowSize(parseAspectRatio(lockedAspect));
  const {
    constraintsRef: mascotDragConstraintsRef,
    x: mascotX,
    y: mascotY,
    handlePointerDownCapture: handleMascotPointerDownCapture,
    handleDragStart: handleMascotDragStart,
    handleDrag: handleMascotDrag,
    handleDragEnd: handleMascotDragEnd,
    getDragForce: getMascotDragForce,
    consumeDragClick: consumeMascotDragClick,
  } = useMascotDrag();

  const featureVisibility = useAppStore(
    useShallow((state) => ({
      settings: state.settingsOpen,
      nodeDialog: state.activeNodeId !== null,
      workflows: state.workflowPanelOpen,
      assets: state.assetsPanelOpen,
      characters: state.characterLibraryOpen || state.characterActionLibraryOpen,
      history: state.historyPanelOpen,
      chat: state.chatOpen,
      presetRunner: state.presetRunRequest !== null,
      reversePrompt: state.reversePromptRequest !== null,
    })),
  );
  const mountSettings = useFeatureMount(featureVisibility.settings);
  const mountNodeDialog = useFeatureMount(featureVisibility.nodeDialog);
  const mountWorkflows = useFeatureMount(featureVisibility.workflows);
  const mountAssets = useFeatureMount(featureVisibility.assets);
  const mountCharacters = useFeatureMount(featureVisibility.characters);
  const mountHistory = useFeatureMount(featureVisibility.history);
  const mountChat = useFeatureMount(featureVisibility.chat);
  const mountPresetRunner = useFeatureMount(featureVisibility.presetRunner);
  const mountReversePrompt = useFeatureMount(featureVisibility.reversePrompt);

  const [closePhase, setClosePhase] = useState<'saving' | 'closing' | null>(null);
  const closeInProgress = useRef(false);
  /* ★ 启动画面（开屏）**已按用户要求删除** —— 组件 `OrbitSplash.tsx` 与样式
     `styles/orbit-splash.css` 一并移除，启动后直接进界面，不再有「Explore」那一屏。
     （更早的 `SplashScreen.tsx`（Hatom 黑白光影）与 `ProjectSwitchOverlay.tsx` 也早已删除，不要恢复。） */
  useEffect(() => {
    /* 保留原「点 Explore 之后」的落地状态：钉住工作空间的「首页」页签并打开工作空间视图。 */
    setWorkspaceLandingTab('home');
    useAppStore.getState().setProjectLibraryOpen(true);
  }, []);
  // 首次启动引导（开屏动画已移除 ⇒ 启动后立即弹）
  const [onboardingOpen, setOnboardingOpen] = useState(
    () => localStorage.getItem(ONBOARDING_SEEN_KEY) !== 'true',
  );
  const closeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    setOnboardingOpen(false);
  }, []);
  // 下载弹窗出现时，右下角吉祥物缩小消失
  const [mascotShrink, setMascotShrink] = useState(false);

  // 更新检测（MTV 重品牌：自动更新器已移除，updateInfo 恒为 null，仅保留气泡状态供后续复用）
  const [updateInfo] = useState<UpdateInfo | null>(null);
  const [updateBubbleVisible, setUpdateBubbleVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const configHydrated = useAppStore((state) => state.configHydrated);
  /** 官方 `mst`(`HtmlPreview`) 的宿主接线：预览目标来自 `show_html` 卡点击写入的独立 store。 */
  const htmlPreviewTarget = useHtmlPreviewTarget();
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const mcpAutoStart = useAppStore((state) => state.config.mcpAutoStart === true);

  // MTV 重品牌：自动更新器已移除，启动时不再静默检查更新。
  useEffect(() => {
    void (async () => {})();
  }, [configHydrated]);

  // 监听下载事件 → 控制吉祥物缩小动画
  useEffect(() => {
    const handler = ((e: CustomEvent) => setMascotShrink(e.detail.active)) as EventListener;
    window.addEventListener(DOWNLOAD_MASCOT_EVENT, handler);
    return () => window.removeEventListener(DOWNLOAD_MASCOT_EVENT, handler);
  }, []);

  /* 空闲时预加载对话助手 chunk（见 `preloadChatPanel` 注释）：让「点 agent 按钮」
     不再先闪一个「正在加载对话助手」的胶囊 —— 官方点开即出面板，没有这个中间态。 */
  useEffect(() => {
    const idle = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    const timer = window.setTimeout(() => {
      void preloadChatPanel();
    }, 1200);
    if (idle) {
      idle(() => { void preloadChatPanel(); }, { timeout: 4000 });
    }
    return () => window.clearTimeout(timer);
  }, []);

  // Load projects from IndexedDB on mount
  const initFromDb = useAppStore((s) => s.initFromDb);
  const migrateHistoryAndLoad = useAppStore((s) => s.migrateHistoryAndLoad);
  const loadAgentPackages = useAppStore((s) => s.loadAgentPackages);
  /* 工作空间（官方 TapNow 工作空间页；画布左上角 logo 也进这里） */
  const workspaceOpen = useAppStore((s) => s.projectLibraryOpen);
  // Agent Package 是可选增强层：独立加载且不参与项目、配置或画布 readiness。
  useEffect(() => {
    void loadAgentPackages();
  }, [loadAgentPackages]);
  useEffect(() => {
    void initFromDb().then(() => {
      const store = useAppStore.getState();
      /* ★ 用户口径（官方同款导航模型）：**启动后先进「工作空间」**（主页 我的项目），
         再点项目卡片进画布；画布左上角 logo 也回到这里。
         `config.startupView === 'project-library'` 是同一个落点，保留原语义。 */
      store.setProjectLibraryOpen(true);
      return migrateHistoryAndLoad();
    });
  }, [initFromDb, migrateHistoryAndLoad]);

  // 退出期间阻止画布快捷键继续编辑；窗口原生关闭请求由下面的重入锁处理。
  useEffect(() => {
    if (!closePhase) return;
    const blockKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', blockKeyDown, true);
    return () => window.removeEventListener('keydown', blockKeyDown, true);
  }, [closePhase]);

  // 保存与清理完成后再关闭窗口，全程展示反馈。
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        unlisten = await win.onCloseRequested(async (event) => {
          event.preventDefault();
          if (closeInProgress.current) return;
          closeInProgress.current = true;
          try {
            flushSync(() => setClosePhase('saving'));
            // 给提示一次绘制机会；窗口隐藏时 rAF 可能暂停，用计时器兜底。
            await new Promise<void>((resolve) => {
              const timeout = window.setTimeout(() => {
                cancelAnimationFrame(frame);
                resolve();
              }, 100);
              const frame = requestAnimationFrame(() => {
                window.clearTimeout(timeout);
                window.setTimeout(resolve, 0);
              });
            });
            const store = useAppStore.getState();
            let settingsSaved = await prepareSettingsClose();
            while (!settingsSaved) {
              const { ask } = await import('@tauri-apps/plugin-dialog');
              const retry = await ask('部分设置或工具栏布局尚未保存。是否重试保存？', {
                title: '设置尚未保存', kind: 'warning', okLabel: '重试保存', cancelLabel: '其他选择',
              }).catch(() => false);
              if (retry) { settingsSaved = await prepareSettingsClose(true); continue; }
              const discard = await ask('退出会放弃本次尚未保存的设置。是否仍然退出？', {
                title: '确认放弃未保存的设置', kind: 'warning', okLabel: '放弃并退出', cancelLabel: '取消退出',
              }).catch(() => false);
              if (!discard) return;
              break;
            }
            try {
              await store.captureCurrentProjectSnapshot();
            } catch (error) {
              console.warn('[退出] 生成画布快照失败:', error);
            }
            try {
              await store.saveCurrentProjectSilent();
            } catch (error) {
              console.warn('[退出] 保存失败:', error);
            }

            // 保存一直失败时不能默默销毁窗口，否则这次会话的工作全丢
            const failure = useAppStore.getState().autoSaveFailure;
            if (failure) {
              const { ask } = await import('@tauri-apps/plugin-dialog');
              const detail = failure.count > 1 ? `已连续失败 ${failure.count} 次。` : '';
              const quitAnyway = await ask(
                `${detail}${failure.reason}\n\n现在退出会丢失未保存的改动。建议先取消退出，再用「导出项目」把内容备份出去。`,
                { title: '保存失败，仍要退出吗？', kind: 'warning', okLabel: '仍然退出', cancelLabel: '取消退出' },
              ).catch(() => true); // 弹不出对话框时不要把用户关在应用里
              if (!quitAnyway) return;
            }

            setClosePhase('closing');
            try {
              await fileService.flushUndoTrashDirs();
              const { stopMcpBridge } = await import('./services/mcp/mcpBridgeService');
              await stopMcpBridge().catch(() => {});
            } catch (error) {
              console.warn('[退出] 清理失败:', error);
            }
            await win.destroy();
          } catch (error) {
            console.warn('[退出] 关闭窗口失败:', error);
            useAppStore.getState().showToast('关闭未完成，请重试', 'error');
          } finally {
            resumeSettingsPersistence();
            closeInProgress.current = false;
            setClosePhase(null);
          }
        });
      } catch { /* non-Tauri env */ }
    })();
    return () => { unlisten?.(); };
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void initComfyUIWindowBridge()
      .then((cleanup) => {
        if (cancelled) cleanup();
        else dispose = cleanup;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error || '未知错误');
        useAppStore.getState().showToast(`ComfyUI 保存桥初始化失败：${message}`, 'error');
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    import('./services/mcp/mcpControlService')
      .then(({ initMcpControlService }) => initMcpControlService())
      .then((cleanup) => {
        if (cancelled) cleanup();
        else dispose = cleanup;
      })
      .catch(() => {
        useAppStore.getState().showToast('MCP 控制器初始化失败，请重新加载应用后重试', 'error');
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  // 配置为默认开启时自动拉起 MCP 会话（用固定令牌与固定端口，客户端配置不必每次改）
  useEffect(() => {
    if (!isTauri || !configHydrated || !mcpAutoStart) return;
    let cancelled = false;
    void (async () => {
      const [{ getMcpBridgeStatus }, { startConfiguredMcpBridge }] = await Promise.all([
        import('./services/mcp/mcpBridgeService'),
        import('./services/mcp/mcpSessionConfig'),
      ]);
      if (cancelled || await getMcpBridgeStatus()) return;
      await startConfiguredMcpBridge();
    })().catch((startError) => {
      // 端口被占用等失败必须说出来，否则用户只看到「已关闭」而不知道为什么
      useAppStore.getState().showToast(
        `MCP 自动开启失败：${startError instanceof Error ? startError.message : String(startError)}`,
        'error',
      );
    });
    return () => {
      cancelled = true;
    };
  }, [configHydrated, mcpAutoStart]);

  // ── 更新相关操作 ──
  const handleUpdateNow = async () => {
    // MTV 重品牌：自动更新器已移除，此处保持空实现以避免调用已删除的插件。
    setUpdating(false);
  };
  const handleDismissUpdate = () => {
    setUpdateBubbleVisible(false);
  };
  const handleMascotActivate = async () => {
    // 官方只有内嵌面板：打开 ⇄ 关闭切换（独立窗口官方没有 ⇒ 已移除）
    useAppStore.getState().toggleChat();
  };

  // 同步主题到 document.documentElement，供 CSS [data-theme] 选择器生效
  // 米白色背景时自动切换为 light，其余背景使用用户手动设置的主题
  const configTheme = useAppStore((s) => s.config.theme);
  const canvasBackground = useAppStore((s) => s.config.canvasBackground);
  const windowGlassFrame = useAppStore((s) => s.config.windowGlassFrame);
  const performanceMode = useAppStore((s) => s.config.performanceMode === true);
  const mascotVisible = useAppStore((s) => s.config.mascotVisible);
  // 任意节点处于生成中 → 吉祥物切换为 LOADING 形态
  const mascotLoading = useAppStore(selectMascotLoading);
  const mascotStatus = useMascotStatus();
  // 播放句柄：窗口失焦、待审批任务等事件通过它触发一次性动画片段
  const mascotHandleRef = useRef<MascotHandle | null>(null);
  // 下载更新时显示的是吃豆人吉祥物，生命周期片段对不上，先停掉
  useMascotLifecycle(mascotHandleRef, Boolean(mascotVisible) && !updating);
  const effectiveTheme = canvasBackground === 'off-white' ? 'light' : configTheme;
  const nativeCursor = useAppStore((s) => s.config.customCursor === false);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    return () => document.documentElement.removeAttribute('data-theme');
  }, [effectiveTheme]);

  // 关闭自定义指针时打标记，cursors.css 据此把 --cursor-* 清空、回落系统指针
  useEffect(() => {
    document.documentElement.toggleAttribute('data-native-cursor', nativeCursor);
    return () => document.documentElement.removeAttribute('data-native-cursor');
  }, [nativeCursor]);

  // 性能模式取消 CSS 自绘圆角后，由 Windows DWM 提供系统原生圆角。
  useEffect(() => {
    if (!isTauri) return;
    invoke('set_main_window_native_corners', { rounded: performanceMode }).catch(() => {});
  }, [performanceMode]);

  // Tauri 模式下给 body 加属性，Portal 渲染的弹窗元素也在 body 下，CSS 选择器才能匹配
  useEffect(() => {
    if (isTauri) {
      document.body.setAttribute('data-tauri-window', '');
      return () => document.body.removeAttribute('data-tauri-window');
    }
  }, []);

  // 窗口最大化状态（Tauri）：最大化时取消悬浮效果（无透明边条可悬浮）
  const [isMaximized, setIsMaximized] = useState(false);
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const check = () => win.isMaximized().then(setIsMaximized).catch(() => {});
        await check();
        unlisten = await win.onResized(check);
      } catch { /* non-Tauri env */ }
    })();
    return () => { unlisten?.(); };
  }, []);

  // 侧边栏悬浮显示开关（默认关闭）；最大化时强制非悬浮。
  // 同步到 body 属性，供 CSS 切换侧边栏停靠/悬浮位置 + 弹窗蒙层的左偏移
  const sidebarFloatingCfg = useAppStore((s) => s.config.sidebarFloating);
  const effectiveFloating = sidebarFloatingCfg === true && !isMaximized;
  /* ★ 标题栏策略（用户要求：**自绘、54px**）：
     Windows 系统标题栏高度由系统固定（实测含边框 38px，Tauri/Electron 均不可配）⇒
     要精确 54px 只能 `decorations:false` + 页面内自绘（`Titlebar.tsx`），并把内容整体下移 54px。
     因此：
       · 无边框（`isDecorated()===false`）⇒ 渲染 54px 自绘标题栏 + `body[data-window-custom-titlebar]`；
       · 万一以后又开 `decorations:true` ⇒ 走系统标题栏，自绘条自动不渲染（`data-window-native-frame`）。
     两种模式下都要**关掉玻璃外框/圆角/透明底**（否则系统边框或自绘条旁会露直角白底 ✗）。 */
  const [isWindowDecorated, setIsWindowDecorated] = useState(false);
  useEffect(() => {
    if (!isTauri) return;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        setIsWindowDecorated(await getCurrentWindow().isDecorated());
      } catch { /* 旧版本/无权限：按无边框处理 */ }
    })();
  }, []);
  const showWindowGlassFrame = windowGlassFrame !== false && !isMaximized && !performanceMode
    && !isWindowDecorated && !isTauri;
  const useCustomTitlebar = isTauri && !isWindowDecorated;
  useEffect(() => {
    if (!isTauri) return;
    document.body.toggleAttribute('data-window-native-frame', isWindowDecorated);
    document.body.toggleAttribute('data-window-custom-titlebar', useCustomTitlebar);
    return () => {
      document.body.removeAttribute('data-window-native-frame');
      document.body.removeAttribute('data-window-custom-titlebar');
    };
  }, [isWindowDecorated, useCustomTitlebar]);
  useEffect(() => {
    if (!isTauri) return;
    document.body.toggleAttribute('data-window-glass-frame', showWindowGlassFrame);
    return () => document.body.removeAttribute('data-window-glass-frame');
  }, [showWindowGlassFrame]);
  useEffect(() => {
    if (effectiveFloating) {
      document.body.setAttribute('data-sidebar-floating', '');
    } else {
      document.body.removeAttribute('data-sidebar-floating');
    }
  }, [effectiveFloating]);

  const appContent = (
    <div
      /* ★ 官方 `data-canvas-container` 挂在**页面级容器**上（`page-DPdEgTS0.js` @1684009
          `div.flex-1.min-w-0.relative.bg-black`），它**同时**包住画布与四周的页面 chrome
          （顶左/顶右/左栏/左下/右下）。两个消费者都依赖这一点：
            1. `uJe` 打开堆叠画廊时 `closest("[data-canvas-container]")` 取 portal 宿主；
            2. `nodes-pile.css` 的 `[data-canvas-container][data-pile-gallery-phase] [data-pile-gallery-chrome]`
               —— 画廊打开时页面 chrome 整体往外飞出（后代选择器，宿主必须在容器**里面**）。
          ⚠️ MTV 曾把它挂在画布根（`.canvas-drawing-root`）上 ⇒ 上面第 2 条只对「左下」生效；
             移到 `.app-shell__content` 后仍漏掉「左栏」—— MTV 的 `<Sidebar />` 是**刻意**放在
             那个 `overflow-hidden` 容器**之外**的（见下方注释，否则会被裁掉）
             ⇒ 最终挂在**两者的共同父级** `.app-shell` 上，5 个 chrome 才全部是其后代 ✓ */
      className={`app-shell h-screen relative text-foreground font-sans ${
        showWindowGlassFrame ? 'app-shell--glass-frame ' : ''
      }${
        isTauri && effectiveFloating ? 'ml-[30px] w-[calc(100vw-30px)]' : 'w-screen'
      }`}
      data-canvas-container="true"
      /* ★ 左侧竖条让位给历史面板（用户 2026 反馈①）：
         官方画布页**没有**左侧竖条（9444 实测左侧只有 `div.canvas-control`），所以没有官方
         DOM 可抄 —— 用 MTV 自己的竖条 + 它**既有的** 0.42s token 滑出/淡出（见 sidebar.css）。
         宿主状态属性挂在 `.app-shell` 上（与 `[data-pile-gallery-phase]` 那套 chrome 飞出机制同构）。 */
      data-history-panel-open={featureVisibility.history ? 'true' : undefined}
      style={{
        transition:
          'margin-left 0.42s var(--ease-out-expo), width 0.42s var(--ease-out-expo)',
      }}
    >
      {/* Content area — clip-path clips ALL descendants including fixed-position backdrops */}
      <div className="app-box app-shell__content absolute bg-background shadow-2xl overflow-hidden">
        {/* 官方布局：画布与助手面板是**同一 flex 行**里的两个流内子项
            （官方 root `h-full shrink-0`，画布区 width 由面板宽度让出）。 */}
        <div className="flex h-full w-full">
          <div className="app-canvas-viewport relative h-full min-w-0 flex-1">
            <CanvasBackground />
            <Canvas />
            {/* 官方 Chatbox 浮球入口（`page-BeI7xydN.js` 的 `Lpe`）：面板收着时右下角出现，
                 点击即展开助手面板；面板展开期间自动隐藏。 */}
            <AgentChatEntryOrb />
            {/* 官方「从画布添加」拾取模式的浮条（`IW`）：进入后点画布节点 = 加/减引用。 */}
            <InsertFromCanvasPickToolbar />
            {/* 官方 `Gk`：拾取模式下悬浮可拾取卡片时，跟随光标的「选择 <节点名>」提示条。 */}
            <InsertFromCanvasPickCursorLabel />
            {/* 进入/切换画布时的全屏加载动画（渐变星光 Logo 旋转 + 「正在打开「X」」）已按用户要求**移除**：
                原来那层遮罩会先淡入 180ms 再淡出，观感上是「进画布前先看一段动画」。
                注意：store 的 `switchingProjectName` **保留**（`services/chat/tools/uiControlTools.ts:143`
                仍用它判定 `busy`/`switchingProject`），只是不再有对应的 UI。 */}
          </div>
          <LazyLoadBoundary label="对话助手">
            <Suspense fallback={<LazyLoadFallback label="对话助手" />}>
              {mountChat && <ChatPanel />}
            </Suspense>
          </LazyLoadBoundary>
        </div>
        {/* 顶部拖拽条 + 自绘标题栏：**只在无边框窗口**（decorations:false）下需要。
            当前窗口是系统标题栏模式（decorations:true，Windows 原生 38px）⇒ 都由系统负责，
            渲染它们会出现**双层标题栏**＋顶部 32px 点击死区 ✗。
            （54px 自绘标题栏的实现保留在 Titlebar.tsx，若以后想切回无边框即可用。） */}
        {!isWindowDecorated && (
          <>
            <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-8 z-10" />
            <Titlebar />
          </>
        )}
        {/* ⚠️ 画布导航栏（Header）**必须常驻** —— 它同时承载：
            左：logo + 项目名（默认画布/Untitled）+ 切换画布 ⌄ + 新建画布
            右：`TopRightNav`（角色库 / AI 助手 / 社区 / 分享 / 头像组）
            之前误把它当成「可取消的浮层」关掉过一次 ⇒ 用户立刻反馈「导航栏呢」⇒ 恢复常驻 ✓ */}
        <Header />
        {/* ⚠️ 顶部居中「会话项目切换」胶囊（● 默认画布 + 滑杆）—— 用户要求取消
            （官方没有它；官方项目切换在左上角 Header 那颗胶囊里。见 config/canvasTopOverlays.ts） */}
        {CANVAS_TOP_OVERLAYS.sessionTabs && <SessionProjectTabs />}
        <NodeMenu />
        <LazyLoadBoundary label="设置面板">
          <Suspense fallback={<LazyLoadFallback label="设置面板" />}>
            {mountSettings && <SettingsPanel />}
          </Suspense>
        </LazyLoadBoundary>
        <LazyLoadBoundary label="节点编辑器">
          <Suspense fallback={<LazyLoadFallback label="节点编辑器" />}>
            {mountNodeDialog && <AINodeDialog />}
          </Suspense>
        </LazyLoadBoundary>
        <LazyLoadBoundary label="工作流面板">
          <Suspense fallback={<LazyLoadFallback label="工作流面板" />}>
            {mountWorkflows && <WorkflowPanel />}
          </Suspense>
        </LazyLoadBoundary>
        <LazyLoadBoundary label="资产面板">
          <Suspense fallback={<LazyLoadFallback label="资产面板" />}>
            {mountAssets && <AssetsPanel />}
          </Suspense>
        </LazyLoadBoundary>
        <LazyLoadBoundary label="角色库">
          <Suspense fallback={<LazyLoadFallback label="角色库" />}>
            {mountCharacters && <CharacterLibraryPanel />}
          </Suspense>
        </LazyLoadBoundary>
        <LazyLoadBoundary label="输出历史">
          <Suspense fallback={<LazyLoadFallback label="输出历史" />}>
            {mountHistory && <OutputHistoryPanel />}
          </Suspense>
        </LazyLoadBoundary>
        <LazyLoadBoundary label="快捷指令运行器">
          <Suspense fallback={null}>
            {mountPresetRunner && <PresetRunnerDialog />}
          </Suspense>
        </LazyLoadBoundary>
        <LazyLoadBoundary label="反推提示词">
          <Suspense fallback={null}>
            {mountReversePrompt && <ReversePromptDialog />}
          </Suspense>
        </LazyLoadBoundary>
        <Toast />
        {/* 官方「文件传输中心」：画布底部居中的传输面板（下载/上传批次） */}
        <TransferCenter />
        {/* 官方「通用对话框」容器（`Oba`）：整组执行确认等命令式弹窗都从这里出 */}
        <OfficialModalContainer />
        {/* 官方 `mst`(`HtmlPreview`)：`show_html` 卡点击后写 `htmlPreviewTarget`，宿主在这里渲染
            （官方挂载点 @2773335/@2774482）。
            官方原文（`vendor-pkg-canvas-ChpWx5JY.js` @2773335，逐字）：
            ```js
            uO=ot&&x?{canvasId:x,artifactPath:ot.artifactPath,title:ot.title,description:ot.description}:null
            ```
            ⇒ `canvasId` 取**当时**的画布 id `x`，且 `ot && x` 有一个为空时 `uO` 为 null（预览器 `isOpen:!!uO`
            随之关闭、什么都不渲染）。MTV 的 `currentProjectId` 类型是 `string | null`，所以这里必须带上
            同一个真值判断 —— 否则会在「无当前项目」时造出 `canvasId:''` 的空目标，让预览器落进
            `getCanvasArtifact({canvas_id:''})` 的失败态，而官方此时根本不渲染预览器。 */}
        {htmlPreviewTarget && currentProjectId ? (
          <HtmlPreview
            isOpen
            onClose={() => useHtmlPreviewTargetStore.getState().clearHtmlPreviewTarget()}
            target={{ canvasId: currentProjectId, ...htmlPreviewTarget }}
          />
        ) : null}
      </div>
      {/* Sidebar — outside the overflow-hidden container so it's not clipped */}
      <Sidebar />

      {/* ★ 工作空间页（官方 TapNow 工作空间 1:1）：启动即进、画布左上角 logo 进入。
          放在裁剪容器之外、最上层，画布保持挂载（进出不丢状态）。 */}
      {workspaceOpen && <WorkspacePage />}


      {/* 吉祥物 — 可拖动浮层，默认隐藏，Ctrl+Shift+M 切换 */}
      {mascotVisible && (
        <LazyLoadBoundary label="吉祥物">
          <div
            ref={mascotDragConstraintsRef}
            className="pointer-events-none fixed inset-2 z-50"
            /* 官方 page-DPdEgTS0.js：画廊打开时右下 Chatbox 浮动按钮右下移出（CSS 在 nodes-pile.css） */
            data-pile-gallery-chrome="bottom-right"
          >
            <motion.div
              className="pointer-events-auto absolute left-0 top-0 h-[100px] w-[100px] touch-none"
              style={{ x: mascotX, y: mascotY }}
              drag={!mascotShrink}
              dragConstraints={mascotDragConstraintsRef}
              dragElastic={0}
              dragMomentum={false}
              onPointerDownCapture={handleMascotPointerDownCapture}
              onDragStart={handleMascotDragStart}
              onDrag={handleMascotDrag}
              onDragEnd={handleMascotDragEnd}
            >
              <motion.div
                className="h-full w-full"
                animate={mascotShrink
                  ? { scale: reduceMotion ? 1 : 0.94, opacity: 0 }
                  : { scale: 1, opacity: 1 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                <button
                  type="button"
                  className="h-full w-full cursor-grab rounded-full border-0 bg-transparent p-0 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  onClick={(event) => {
                    if (consumeMascotDragClick(event)) return;
                    void handleMascotActivate();
                  }}
                  disabled={mascotShrink}
                  aria-label={mascotStatus === 'thinking'
                    ? '打开画布助手，正在思考'
                    : mascotStatus === 'success'
                      ? '打开画布助手，任务已完成'
                      : mascotStatus === 'error'
                        ? '打开画布助手，任务失败'
                        : '打开画布助手'}
                  data-tooltip={mascotStatus === 'thinking'
                    ? '画布助手：思考中'
                    : mascotStatus === 'success'
                      ? '画布助手：已完成'
                      : mascotStatus === 'error'
                        ? '画布助手：任务失败'
                        : '打开画布助手'}
                >
                  <Suspense
                    fallback={(
                      <div
                        className="flex h-full w-full items-center justify-center"
                        role="status"
                        aria-label="正在加载吉祥物"
                      >
                        <span
                          className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  >
                    {updating ? (
                      <PacmanMascot />
                    ) : (
                      <Mascot
                        loading={mascotLoading}
                        status={mascotStatus}
                        theme={effectiveTheme}
                        reduceMotion={performanceMode || Boolean(reduceMotion)}
                        getDragForce={getMascotDragForce}
                        handleRef={mascotHandleRef}
                      />
                    )}
                  </Suspense>
                </button>
              </motion.div>
            </motion.div>
          </div>
        </LazyLoadBoundary>
      )}

      {/* 更新聊天气泡 — 悬停在吉祥物左上方 */}
      {updateInfo && (
        <UpdateBubble
          info={updateInfo}
          visible={updateBubbleVisible}
          onUpdate={() => { handleUpdateNow(); }}
          onDismiss={handleDismissUpdate}
          updating={updating}
        />
      )}

      <Suspense fallback={null}>
        <DirectorDeskRuntimeManager />
      </Suspense>

      {/* 首次启动引导：开屏已删除 ⇒ 启动后立即按原逻辑弹出。 */}
      {onboardingOpen && (
        <Suspense fallback={null}>
          <OnboardingDialog
            onClose={closeOnboarding}
            onOpenHelp={() => {
              closeOnboarding();
              useAppStore.getState().setHelpOpen(true);
            }}
          />
        </Suspense>
      )}

    </div>
  );

  return (
    <MotionConfig
      reducedMotion={performanceMode ? 'always' : 'user'}
      transition={performanceMode ? { duration: 0 } : undefined}
    >
      <>
        {/* 开屏动画（`SplashScreen`，Hatom 风格黑白光影，GSAP 时间轴 + 1400ms 上限）已按用户要求**移除**：
            启动后直接进画布，不再先播一段开屏。组件文件也已删除。 */}
        {appContent}
        <ModalOverlay
          isOpen={closePhase !== null}
          onClose={() => {}}
          closeOnBackdrop={false}
          motionPreset="quick"
          backdropBlur={false}
          ariaLabel="正在关闭软件"
          className="w-80 max-w-[calc(100vw-2rem)] p-6"
        >
          <div role="status" aria-live="polite" aria-atomic="true" className="flex flex-col items-center gap-3 text-center">
            <span
              aria-hidden="true"
              className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none"
            />
            <p className="text-sm font-medium text-foreground">
              {closePhase === 'closing' ? '正在关闭…' : '正在保存，准备关闭…'}
            </p>
            <p className="text-xs text-text-text-secondary">完成后将自动退出，请稍候</p>
          </div>
        </ModalOverlay>
      </>
    </MotionConfig>
  );
}
