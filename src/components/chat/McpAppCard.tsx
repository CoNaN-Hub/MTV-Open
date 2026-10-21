/**
 * `McpAppCard` —— 官方 `nre`（`vendor-pkg-canvas-ChpWx5JY.js` **@2330684**，`nre=a.memo(e=>{...})`；
 * `nre.displayName="McpAppCard"` **@2345376**）+ 子组件 `Stt`（**@2345405**）的**逐字**复刻。
 *
 * 官方 props（逐字 @2330684）：
 * ```js
 * const{content:t,onSendPrompt:n,onAppToolCallCompleted:o,onSubmitAppReply:r,
 *       autoExpand:i=!1,collapseOnSendMessage:l=!1}=e
 * ```
 *
 * ── ⚠️ 本轮**未接线**的依赖 ─────────────────────────────────────────────────────
 *   1. **host bridge `Vfe`**（`vendor-packages-jvPqKqU8.js` `class P1e` @1694948）：
 *      官方在 effect 里 `new Vfe({iframe,resourceUri,toolInput,toolResult,initialWidgetState,
 *      locale,callbacks:{...}})` 然后 `ct.start(), Se.src = x.current`。该 class 的依赖
 *      （`vo.callAppTool`/`putWidgetState`/`updateModelContext`/`getActiveRun`/`batchEstimatePrice`、
 *      埋点 `Mi`/`Di`/`Ea`/`ytt`、节点 store `ut()`、`ch`/`gF` 计价、`sre` 初始化响应）在 MTV
 *      **全无对应物** ⇒ 只把注入点 `createHostBridge` 留出。
 *      **未注入时**：卡片**不伪造** ready/error，`status` 停在官方初始态 `"loading"`
 *      （`att` @2323804），loading 骨架行常驻、iframe `display:none` —— 这正是官方
 *      「bridge 尚未 `onReady()`」时的真实画面。iframe 的 `src` 仍由本卡按官方逐字赋值。
 *   2. **previs 投影管线**（`Ntt`/`gtt`/`EI`/`NI`/`TI`/`yy`/`He`/`Me`/`ye`/`ke`/`H`/`W`）：
 *      官方 `He`（`projection_revision` 归一）、`Me`（`panelKey`）、`ye`（stale projection ⇒ 整卡 null）、
 *      `ke`（superseded ⇒ 整卡 null）全部**未落地** ⇒ 本实现固定 `H=W=false`、不注册 `yy`/`NI`，
 *      **不读也不写**这些模块级注册表（见报告「未落地清单」）。
 *      后果：`ye`/`ke` 恒 `false`，卡不会因投影竞态消失。
 *   3. **`mock` 分支**：官方 `re = dtt(Z)`，而 `dtt` 依赖的 `tre()` 官方实现就是 `return null`
 *      ⇒ `re` **恒 `false`**。本实现保留为常量 `false`（逐字结果，不是近似）。
 *   4. `onEstimateGenerationCost` / `onAddToCanvas` / `onValidateAppReply` / `onSendAppReply` /
 *      `onGetAppReplyRunStatus` / `onUpdateModelContext` / `onSetWidgetState` 等 callbacks 的**体内逻辑**
 *      依赖同一批 MTV 无对应物的 API ⇒ 只在 `createHostBridge` 的 options 里按官方形状透传，
 *      卡本体不实现它们。
 *
 * ── 与 `show_widget` 的区别（§6.10，勿混）────────────────────────────────────
 *   `AD` ↔ `nre`/`McpAppCard` ↔ `KP("mcp-app-proxy.html")` ↔ JSON-RPC 2.0；
 *   `aT` ↔ `mre`/`ShowWidgetCard` ↔ `KP("widget-proxy.html")` ↔ 裸 `type`。互斥且并存。
 *
 * 验证分级：**(b) jsdom**（`tests/components/desktopConnectorMcpCardsDom.test.tsx`）
 * + 纯函数 **(d) 源码级**（`tests/services/chat/mcpAppCard.test.ts`）。
 * **没有**做 (a) live 画布实测。
 */
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { ToolEventContent } from '../../services/chat/agentContents';
import {
  clampMcpAppHeight,
  isMcpAppPrevisUri,
  isPresentationShortcutBlockedTarget,
  isPresentationShortcutKey,
  MCP_APP_CARD_EXPANDED_EVENT,
  MCP_APP_DEFAULT_HEIGHT,
  mcpAppHeaderTitle,
  mcpAppIframeHeight,
  mcpAppIframeTitle,
  mcpAppRequestTitle,
  mcpAppResourceUri,
  mcpAppResponseSummary,
  mcpAppSupportsUpdateModelContext,
  mcpAppToolCallId,
  mcpAppToolCallIdFallback,
  MCP_APP_INITIAL_STATE,
  mcpAppHostReducer,
  nextMcpAppAutoRetryDelay,
  officialMcpAppProxyUrl,
  resolveMcpAppResourcePolicy,
} from '../../services/chat/mcpAppCard';
import { MCP_APP_PROXY_PAGE } from '../../services/chat/widgetProxyUrl';
import { useDesktopConnectorMcpText } from '../../services/chat/desktopConnectorMcpStrings';

/** 官方 `Vfe` 构造参数的形状（`class P1e` @1694948 的 `options`）。 */
export interface McpAppHostBridgeOptions {
  iframe: HTMLIFrameElement;
  resourceUri: string;
  toolInput: unknown;
  toolResult: unknown;
  initialWidgetState: unknown;
  locale: string;
  callbacks: {
    onSendPrompt: (text: string, meta?: unknown) => Promise<unknown>;
    onReady: () => void;
    onError: (reason: string) => void;
    onSizeChanged: (height: number) => void;
    onToolCall: (toolName: string, args: unknown, callId?: string) => Promise<unknown>;
    onUpdateModelContext?: (content: unknown) => Promise<void>;
    onSetWidgetState?: (state: unknown) => Promise<void>;
    onValidateAppReply?: () => void;
    onGetAppReplyRunStatus?: (payload: unknown) => Promise<unknown>;
    onSendAppReply?: (payload: unknown) => Promise<unknown>;
  };
}

/** 官方 `class P1e` 暴露给卡片的 5 个方法（卡片实际调用的全集）。 */
export interface McpAppHostBridge {
  start(): void;
  dispose(): void;
  updatePresentationState(expanded: boolean): void;
  updateConversationRunActive(active: boolean): void;
  sendPresentationShortcut(key: string): void;
}

export interface McpAppCardProps {
  content: ToolEventContent;
  /** 官方 `onSendPrompt(text, meta?)`；返回 `false` ⇒ host bridge 回 `false`（不发消息）。 */
  onSendPrompt?: (text: string, meta?: unknown) => Promise<unknown>;
  /** 官方 `onAppToolCallCompleted(toolName, callId, clientResult)`。 */
  onAppToolCallCompleted?: (toolName: string, callId: string, result: unknown) => Promise<void>;
  /** 官方 `onSubmitAppReply`。 */
  onSubmitAppReply?: (payload: unknown) => Promise<unknown>;
  /** 官方 `autoExpand = !1`。 */
  autoExpand?: boolean;
  /** 官方 `collapseOnSendMessage = !1`（分派处对 `ui://tapnow/animatic@v2` 传 `true`）。 */
  collapseOnSendMessage?: boolean;
  /** 官方 `new Vfe({...})` 的替身工厂；**未注入 ⇒ 不伪造 ready/error**。 */
  createHostBridge?: (options: McpAppHostBridgeOptions) => McpAppHostBridge;
  /** 官方 `O.language || Bfe()`（i18n 语言）。 */
  locale?: string;
  /** 官方 `qe(Se=>hs(Se).conversationId)`。 */
  conversationId?: string;
  /** 官方 `qe(Se=>hs(Se).isLoading)`。 */
  conversationRunning?: boolean;
}

/** 官方内联 `Stt` @2345405（逐字）。 */
export function McpAppLoadingRow({ retrying = false }: { retrying?: boolean }) {
  const t = useDesktopConnectorMcpText();
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
      <output className="text-xs text-muted-foreground">
        {retrying
          ? t('chatAdapter.mcpApp.retryLoading', { defaultValue: 'Reloading panel…' })
          : t('chatAdapter.mcpApp.loading', { defaultValue: 'Loading panel…' })}
      </output>
    </div>
  );
}

const McpAppCard = memo(function McpAppCard({
  content,
  onSendPrompt,
  onAppToolCallCompleted,
  onSubmitAppReply,
  autoExpand = false,
  collapseOnSendMessage = false,
  createHostBridge,
  locale,
  conversationId = '',
  conversationRunning = false,
}: McpAppCardProps) {
  const t = useDesktopConnectorMcpText();
  /** 官方 `c=a.useId()`。 */
  const cardId = useId();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  /** 官方 `u=a.useRef(!1)`：suppressSizeUpdates。 */
  const suppressSizeUpdatesRef = useRef(false);
  /** 官方 `p=a.useRef(200)`：last inline height。 */
  const lastInlineHeightRef = useRef(MCP_APP_DEFAULT_HEIGHT);
  /** 官方 `m=a.useRef(null)`：panel root（focus 目标）。 */
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  /** 官方 `f=a.useRef(null)`：focus 还原目标。 */
  const focusRestoreRef = useRef<HTMLElement | null>(null);
  /** 官方 `h=a.useRef(!1)`：wasExpanded。 */
  const wasExpandedRef = useRef(false);
  /** 官方 `g=a.useRef(!0)`：restoreFocus。 */
  const restoreFocusRef = useRef(true);
  /** 官方 `x=a.useRef(KP("mcp-app-proxy.html"))`。 */
  const proxySrcRef = useRef(officialMcpAppProxyUrl(MCP_APP_PROXY_PAGE));
  /** 官方 `M=a.useRef(null)`：initialWidgetState。 */
  const initialWidgetStateRef = useRef<unknown>(null);
  /** 官方 `G=a.useRef(null)`：host bridge 实例。 */
  const hostBridgeRef = useRef<McpAppHostBridge | null>(null);

  const [state, dispatch] = useReducer(mcpAppHostReducer, MCP_APP_INITIAL_STATE);
  const [inlineHeight, setInlineHeight] = useState(MCP_APP_DEFAULT_HEIGHT);
  const [expanded, setExpanded] = useState(false);

  const resourceUri = mcpAppResourceUri(content);
  const policy = resolveMcpAppResourcePolicy(resourceUri);
  const effectiveExpanded = policy.allowExpanded && expanded;
  const response = (content.response ?? null) as Record<string, unknown> | null;
  const request = (content.request ?? {}) as Record<string, unknown>;
  const responseSummary = mcpAppResponseSummary(content);
  const requestTitle = mcpAppRequestTitle(content);
  const toolCallId = mcpAppToolCallId(content);
  /* 官方 `ve` 的用途只有 `vo.callAppTool({source_tool_call_id: ee?.toolCallId ?? ve})` 与
     `putWidgetState` / `updateModelContext` 的 `tool_call_id` —— 那三处 API 均未落地（见文件头）
     ⇒ 此处只保留官方取值，不代入任何伪造调用。 */
  void toolCallId;
  const mcpManagedProjection = content.mcpManagedProjection === true;
  void mcpManagedProjection;
  /* 官方经 `Pe()` 闭包读 `conversationId`（`hs(qe.getState())`）；MTV 的会话 id 由接线方在
     `onAppToolCallCompleted` / host bridge 侧掌握 ⇒ 本卡只保留 prop 形状，不在卡内读取。 */
  void conversationId;
  const { status, attempt, reason } = state;
  const widgetState =
    content.widget_state && typeof content.widget_state === 'object' ? content.widget_state : null;
  const supportsUpdateModelContext = mcpAppSupportsUpdateModelContext(content);
  /* 官方 `re = dtt(Z)`；`dtt` 依赖的 `tre()` 官方实现就是 `return null` ⇒ 恒 `false`（§6.2 逐字）。 */
  const mockMode = false;
  /** 官方 `et = lh(Z) ? Jse(T) : null`：仅 previs 资源才自动重试。 */
  const autoRetryDelay = isMcpAppPrevisUri(resourceUri) ? nextMcpAppAutoRetryDelay(state) : null;
  const isReady = status === 'ready';

  /* 官方未落地的投影竞态：`H`/`W` 恒 false ⇒ `ye=false`、`ke=false`（见文件头）。
     官方 `Me = !me && w && Ie && Z ? `${w}\0${Ie}\0${Z}` : ""`（`panelKey`）与
     `yy`/`NI` 两个模块级注册表**本轮未落地**，故此处不注册、不读取（零副作用）。 */

  /** 官方自动重试定时器（逐字 @2333470）：`[et,I,ke,ye]`。 */
  useEffect(() => {
    if (autoRetryDelay === null) return;
    const timer = window.setTimeout(() => dispatch({ type: 'retry' }), autoRetryDelay);
    return () => window.clearTimeout(timer);
  }, [autoRetryDelay, attempt]);

  /** 官方 host bridge effect（逐字 @2333xxx，deps `[ke,ye,Z,I]`；`ke`/`ye` 未落地恒 false）。 */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !resourceUri) return;
    dispatch({ type: 'start' });
    let alive = true;
    let bridge: McpAppHostBridge | null = null;
    if (createHostBridge) {
      bridge = createHostBridge({
        iframe,
        resourceUri,
        toolInput: request,
        toolResult: response,
        initialWidgetState: initialWidgetStateRef.current ?? widgetState,
        locale: locale ?? 'en',
        callbacks: {
          onSendPrompt: async (text, meta) => {
            const trimmed = text.trim();
            if (!trimmed) return false;
            const result = await onSendPrompt?.(trimmed, meta);
            if (result === false) return false;
            if (collapseOnSendMessage) {
              restoreFocusRef.current = true;
              setExpanded(false);
            }
            return true;
          },
          onReady: () => {
            if (!alive) return;
            dispatch({ type: 'ready' });
            bridge?.updateConversationRunActive(conversationRunning);
          },
          onError: (rawReason) => {
            if (!alive) return;
            /* 官方：白名单 `["timeout","invalid_resource_uri","resource_error"]` 只用于埋点标签，
               `E({type:"failed",reason:Be})` 派发的是**原始** reason ⇒ 这里同样派发原始值。 */
            alive = false;
            dispatch({ type: 'failed', reason: rawReason });
            bridge?.dispose();
          },
          onSizeChanged: (height) => {
            if (suppressSizeUpdatesRef.current) return;
            const clamped = clampMcpAppHeight(height, policy.maxInlineHeight);
            lastInlineHeightRef.current = clamped;
            setInlineHeight(clamped);
          },
          onToolCall: async (toolName, args, callId) => {
            const resolvedCallId = callId ?? mcpAppToolCallIdFallback();
            if (mockMode) {
              return {
                status: 'completed',
                client_result: { mock: true, tool_name: toolName, args },
                error: null,
              };
            }
            /* 官方 `vo.callAppTool({...})` 未落地 ⇒ 交由接线方经 `onAppToolCallCompleted` 承接。 */
            await onAppToolCallCompleted?.(toolName, resolvedCallId, null);
            return { status: 'completed', client_result: null, error: null };
          },
          ...(supportsUpdateModelContext
            ? { onUpdateModelContext: async () => undefined }
            : {}),
          /* 官方 `onSubmitAppReply`（`v.current`）在 bridge 的 callbacks 里被包成
             `onSendAppReply` / `onValidateAppReply` / `onGetAppReplyRunStatus`。
             那三个回调的**体内逻辑**（previs 投影身份校验、`vo.getActiveRun`）MTV 无对应物
             ⇒ 只按官方形状把接线方给的 `onSubmitAppReply` 透传成 `onSendAppReply`。 */
          ...(onSubmitAppReply ? { onSendAppReply: (payload: unknown) => onSubmitAppReply(payload) } : {}),
        },
      });
      hostBridgeRef.current = bridge;
      const allowExpandedNow = resolveMcpAppResourcePolicy(resourceUri).allowExpanded;
      if (allowExpandedNow) {
        bridge.updatePresentationState(effectiveExpanded);
      }
      bridge.start();
    }
    /* 官方逐字：`ct.start(),Se.src=x.current` —— `src` 由本卡命令式赋值（JSX 里没有 src）。 */
    iframe.src = proxySrcRef.current;
    return () => {
      alive = false;
      hostBridgeRef.current = null;
      if (bridge) {
        const allowExpandedNow = resolveMcpAppResourcePolicy(resourceUri).allowExpanded;
        if (allowExpandedNow) bridge.updatePresentationState(false);
        bridge.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 官方 deps 逐字为 `[ke,ye,Z,I]`；`ke`/`ye` 未落地为常量 false
  }, [resourceUri, attempt]);

  /** 官方 locale effect：`G.current?.updateHostContext({locale:U})`。 */
  useEffect(() => {
    void locale;
  }, [locale]);

  /** 官方展开互斥监听（逐字 @2341300）：别家 cardId 展开时自家收起。 */
  useEffect(() => {
    const onExpanded = (event: Event) => {
      const detail = (event as CustomEvent<{ cardId?: string }>).detail;
      if (detail?.cardId !== cardId) {
        restoreFocusRef.current = false;
        setExpanded(false);
      }
    };
    window.addEventListener(MCP_APP_CARD_EXPANDED_EVENT, onExpanded);
    return () => window.removeEventListener(MCP_APP_CARD_EXPANDED_EVENT, onExpanded);
  }, [cardId]);

  /** 官方 `allowExpanded` 变 false 时强制收起（逐字）。 */
  useEffect(() => {
    if (!policy.allowExpanded) {
      restoreFocusRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 官方 `nre` 逐字：`oe.allowExpanded||(g.current=!1,R(!1))`
      setExpanded(false);
    }
  }, [policy.allowExpanded]);

  /** 官方展开时焦点管理（逐字 @2340700）。 */
  useEffect(() => {
    const wasExpanded = wasExpandedRef.current;
    wasExpandedRef.current = effectiveExpanded;
    if (effectiveExpanded && !wasExpanded) {
      suppressSizeUpdatesRef.current = true;
      focusRestoreRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return;
    }
    if (!effectiveExpanded && wasExpanded) {
      setInlineHeight(lastInlineHeightRef.current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          suppressSizeUpdatesRef.current = false;
        });
      });
      const target = focusRestoreRef.current;
      focusRestoreRef.current = null;
      if (restoreFocusRef.current && target?.isConnected) target.focus({ preventScroll: true });
      restoreFocusRef.current = true;
    }
  }, [effectiveExpanded]);

  /** 官方：展开且 ready 时把焦点给面板根（逐字）。 */
  useEffect(() => {
    if (!effectiveExpanded || status !== 'ready') return;
    panelRootRef.current?.focus({ preventScroll: true });
  }, [effectiveExpanded, status]);

  /** 官方 autoExpandOnReady（逐字 @2341398）。 */
  useEffect(() => {
    if (
      !policy.allowExpanded ||
      !policy.autoExpandOnReady ||
      !autoExpand ||
      status !== 'ready'
    ) {
      return;
    }
    window.dispatchEvent(new CustomEvent(MCP_APP_CARD_EXPANDED_EVENT, { detail: { cardId } }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 官方 `nre` 逐字：`...&&(window.dispatchEvent(...),R(!0))`
    setExpanded(true);
  }, [autoExpand, cardId, policy.allowExpanded, policy.autoExpandOnReady, status]);

  /** 官方 Esc 关展开 + previs 快捷键转发（逐字 @2342400）。 */
  useEffect(() => {
    if (!effectiveExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        restoreFocusRef.current = true;
        setExpanded(false);
        return;
      }
      if (
        !isMcpAppPrevisUri(resourceUri) ||
        !isPresentationShortcutKey(event.key) ||
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.key === 'Enter' && event.repeat) ||
        isPresentationShortcutBlockedTarget(event.target)
      ) {
        return;
      }
      const root = panelRootRef.current;
      if (!(event.target instanceof Node) || !root?.contains(event.target)) return;
      const bridge = hostBridgeRef.current;
      if (bridge) {
        event.preventDefault();
        bridge.sendPresentationShortcut(event.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [effectiveExpanded, resourceUri]);

  /** 官方 `Ve`（逐字 @2342280）：展开/收起切换。 */
  const allowExpanded = policy.allowExpanded;
  const toggleExpanded = useCallback(() => {
    if (!allowExpanded) return;
    setExpanded((current) => {
      if (current) {
        restoreFocusRef.current = true;
      } else {
        suppressSizeUpdatesRef.current = true;
        restoreFocusRef.current = true;
        window.dispatchEvent(new CustomEvent(MCP_APP_CARD_EXPANDED_EVENT, { detail: { cardId } }));
      }
      return !current;
    });
  }, [cardId, allowExpanded]);

  /** 官方 `if(!Z||ye||ke)return null;`（`ye`/`ke` 未落地恒 false）。 */
  if (!resourceUri) return null;

  const toggleLabel = effectiveExpanded
    ? t('chatAdapter.mcpApp.collapse', { defaultValue: 'Collapse app' })
    : t('chatAdapter.mcpApp.expand', { defaultValue: 'Expand app' });

  return (
    <Fragment>
      {effectiveExpanded && (
        <button
          type="button"
          aria-label={t('chatAdapter.mcpApp.closeExpanded', {
            defaultValue: 'Close expanded app',
          })}
          className="fixed inset-0 z-[99] cursor-default bg-black/55"
          data-testid="mcp-app-backdrop"
          onClick={() => {
            restoreFocusRef.current = true;
            setExpanded(false);
          }}
        />
      )}
      <div
        aria-modal={effectiveExpanded}
        className={
          effectiveExpanded
            ? 'fixed left-1/2 top-1/2 z-[100] flex h-[88vh] w-[min(1280px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl'
            : 'my-2 w-full'
        }
        data-expanded={effectiveExpanded ? 'true' : 'false'}
        ref={panelRootRef}
        role="dialog"
        tabIndex={effectiveExpanded ? -1 : undefined}
      >
        <div
          className={
            effectiveExpanded
              ? 'flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-2.5'
              : 'flex h-8 items-center justify-between gap-2 px-1'
          }
        >
          <span className="min-w-0 truncate text-[13px] font-medium text-muted-foreground">
            {mcpAppHeaderTitle(
              requestTitle,
              resourceUri,
              t('chatAdapter.mcpApp.title', { defaultValue: 'App' }),
            )}
          </span>
          {policy.allowExpanded && (
            <button
              type="button"
              aria-expanded={effectiveExpanded}
              aria-label={toggleLabel}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-mcp-app-expand-toggle=""
              onClick={toggleExpanded}
              title={toggleLabel}
            >
              {effectiveExpanded ? <MinimizeIcon /> : <MaximizeIcon />}
            </button>
          )}
        </div>

        {status === 'loading' && <McpAppLoadingRow retrying={attempt > 0} />}

        {status === 'error' && (
          <div
            className="flex min-h-40 flex-col items-start justify-center gap-3 rounded-lg border border-border/50 px-4 py-5"
            aria-live="polite"
          >
            <p className="text-sm font-medium text-foreground">
              {t('chatAdapter.mcpApp.loadFailed', { defaultValue: 'Unable to load the panel' })}
            </p>
            {responseSummary && <p className="text-sm text-muted-foreground">{responseSummary}</p>}
            <p className="break-all text-xs text-muted-foreground">
              {reason === 'timeout'
                ? t('chatAdapter.mcpApp.loadTimeout', {
                    defaultValue: 'Panel loading or initialization timed out',
                  })
                : (reason ?? '').slice(0, 240)}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => dispatch({ type: 'retry', manual: true })}
              >
                {t('chatAdapter.mcpApp.reload', { defaultValue: 'Reload panel' })}
              </button>
              <span className="text-xs text-muted-foreground">
                {autoRetryDelay !== null
                  ? t('chatAdapter.mcpApp.retryScheduled', {
                      defaultValue: 'Retrying automatically…',
                    })
                  : t('chatAdapter.mcpApp.retrySafe', {
                      defaultValue: 'Reloads the panel without resubmitting generation',
                    })}
              </span>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          style={{
            width: '100%',
            height: mcpAppIframeHeight(effectiveExpanded, inlineHeight),
            border: 'none',
            overflow: 'hidden',
            display: isReady ? 'block' : 'none',
            flex: effectiveExpanded ? '1 1 auto' : undefined,
          }}
          title={mcpAppIframeTitle(requestTitle)}
        />
      </div>
    </Fragment>
  );
});

/**
 * 官方 `a$` = lucide **Minimize2**、`l$` = lucide **Maximize2**（§6.6）。
 * 官方 JSX 逐字：`{"aria-hidden":"true",className:"size-4"}` —— **未传 `size` / `strokeWidth`**
 * （走 lucide 默认），故这里也不传（只给 `aria-hidden` + `className`）。
 */
function MinimizeIcon() {
  return <Minimize2 aria-hidden="true" className="size-4" />;
}

function MaximizeIcon() {
  return <Maximize2 aria-hidden="true" className="size-4" />;
}

export default McpAppCard;
