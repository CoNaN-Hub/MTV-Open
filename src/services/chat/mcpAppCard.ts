/**
 * `mcpApp` 卡（官方 `nre` = `McpAppCard` @2330684，`displayName` @2345376）的**纯函数层** ——
 * 逐字复刻 `live-确认卡与widget.md` 第 6 章 + live bundle 原文（**已用 `_rawat.mjs`
 * 读原始窗口逐字核对**）。无 React、无 store、无网络。
 *
 * ── 权威偏移（`vendor-pkg-canvas-ChpWx5JY.js`，0-based char 偏移）──
 * | 符号 | 偏移 | 角色 |
 * |---|---|---|
 * | `AD` | 444489 | 族谓词：`content.ui.resource_uri` 非空字符串 |
 * | `nre` | 2330684 | 卡片本体（`a.memo`） |
 * | `Stt` | 2345405 | loading 行子组件（无 displayName） |
 * | `att` | 2323804 | 初始 state |
 * | `ltt` | 2323838 | 自动重试延迟表 `[1e3,3e3]` |
 * | `Jse` | 2323841 | 下一次自动重试延迟 |
 * | `ctt` | 2324015 | reducer |
 * | `xtt` | 2329550 | 高度夹取（下限 **100**） |
 * | `f_`/`btt`/`sV`/`lh`/`vtt` | 2329669–2329731 | 互斥事件名 / previs uri / 快捷键键位 |
 * | `wtt` | 2329749（函数尾 2330106） | 快捷键阻断目标选择器 |
 * | `_tt` / `TI` | 2330067 / 2330060 | `call_id` 兜底生成器 / 投影更新事件名 |
 * | `are`/`Fx` | `vendor-packages-jvPqKqU8.js` @1693300 邻域 | `resource_uri` 解析 |
 * | `gg`/`rre`/`O1e` | 同文件 @1693300 邻域 | 资源策略表 |
 * | `HV`/`fd`/`zV`/`WV`/`Zp`/`KV`/`qV`/`uce` | 同文件 @675391–675688 | 代理页 URL |
 * | `cs` | 同文件 @10331 | 官方域名常量 `{GLOBAL:"app.tapnow.ai",CN:"app.tapnow.media"}` |
 * | `lre`/`cre` | 同文件 @1694859 | host bridge 定时器 **15000 ms / 800 ms** |
 *
 * 验证分级：**(d) 源码级**（逐字 + 偏移）。组件侧 (b) jsdom 见
 * `tests/components/desktopConnectorMcpCardsDom.test.tsx`。
 */
import type { ToolEventContent } from './agentContents';

/* ============================================================================
 * 1. 族谓词（`AD` @444489，逐字）
 * ============================================================================ */

/**
 * 官方 `AD` @444489（逐字）：
 * ```js
 * AD=e=>{if(e.type!=="tool_event"||typeof e.content!="object"||e.content===null)return!1;
 *   const t=e.content.ui;if(!t||typeof t!="object")return!1;
 *   const n=t.resource_uri;return typeof n=="string"&&n.length>0}
 * ```
 */
export function isMcpAppEvent(event: unknown): boolean {
  if (!event || typeof event !== 'object') return false;
  const e = event as { type?: unknown; content?: unknown };
  if (e.type !== 'tool_event' || typeof e.content !== 'object' || e.content === null) return false;
  const ui = (e.content as { ui?: unknown }).ui;
  if (!ui || typeof ui !== 'object') return false;
  const resourceUri = (ui as { resource_uri?: unknown }).resource_uri;
  return typeof resourceUri === 'string' && resourceUri.length > 0;
}

/* ============================================================================
 * 2. 常量（`att` / `ltt` / `f_` / `btt` / `sV` / `xtt` / `lre` / `cre`）
 * ============================================================================ */

/** 官方 `ltt` @2323838：自动重试延迟表（**1000 ms / 3000 ms**，最多 2 次）。 */
export const MCP_APP_RETRY_DELAYS = [1e3, 3e3] as const;

/** 官方 `xtt` @2329550 的硬下限。 */
export const MCP_APP_MIN_HEIGHT = 100;

/** 官方 `useState(200)` / `useRef(200)`：内联高度默认值。 */
export const MCP_APP_DEFAULT_HEIGHT = 200;

/** 官方 `xtt` 展开态高度算式里的 header 高度（`calc(88vh - 36px)` 的 36）。 */
export const MCP_APP_EXPANDED_HEADER_PX = 36;

/** 官方 `f_` @2329669：展开互斥事件名。 */
export const MCP_APP_CARD_EXPANDED_EVENT = 'tapnow:mcp-app-card-expanded';

/**
 * 官方 `TI` @2330060：投影更新事件名。属**未落地**的投影管线（`yy`/`NI`/`EI`/`gtt`），
 * 此处只保留常量供接线方对齐命名。
 */
export const MCP_APP_PROJECTION_UPDATED_EVENT = 'tapnow:mcp-app-projection-updated';

/** 官方 `btt` @2329669：previs 资源 uri（带版本）。 */
export const MCP_APP_PREVIS_URI = 'ui://tapnow/previs@v3';

/** 官方 `sV` @2329669：ecommerce-photoset 资源 uri（决定是否注入成本估算回调）。 */
export const MCP_APP_ECOMMERCE_PHOTOSET_URI = 'ui://tapnow/ecommerce-photoset@v2';

/** 官方 `lre` @1694859（host bridge 侧）：init 超时 **15000 ms**。 */
export const MCP_APP_HOST_INIT_TIMEOUT_MS = 15e3;

/** 官方 `cre` @1694859（host bridge 侧）：resource-ready 重发间隔 **800 ms**。 */
export const MCP_APP_RESOURCE_READY_RETRY_MS = 800;

/** 官方 onError 白名单（其它一律折叠成 `"resource_error"`）。 */
export const MCP_APP_FAILURE_REASONS = ['timeout', 'invalid_resource_uri', 'resource_error'] as const;

/** 官方 error 面板里 `T.reason?.slice(0,240)`。 */
export const MCP_APP_ERROR_REASON_MAX_CHARS = 240;

/** 官方 `lh` @2329669（逐字）：`e===btt`。 */
export function isMcpAppPrevisUri(resourceUri: string): boolean {
  return resourceUri === MCP_APP_PREVIS_URI;
}

/** 官方 `vtt` @2329669（逐字）。 */
export function isPresentationShortcutKey(key: string): boolean {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Enter';
}

/**
 * 官方 `_tt` @2330067（逐字）：`call_id` 兜底生成器。
 * ```js
 * _tt=()=>typeof crypto<"u"&&typeof crypto.randomUUID=="function"
 *   ? crypto.randomUUID()
 *   : `call-${Date.now()}-${Math.random().toString(36).slice(2,10)}`
 * ```
 */
export function mcpAppToolCallIdFallback(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 官方 `wtt` @2329995 邻域（逐字，全串已用 `_rawat.mjs` 读到结尾）：
 * ```js
 * function wtt(e){return e instanceof Element
 *   ? !!e.closest('button, a, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="radio"], [role="radiogroup"], [role="slider"]')
 *   : !1}
 * ```
 */
export function isPresentationShortcutBlockedTarget(target: unknown): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    'button, a, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="radio"], [role="radiogroup"], [role="slider"]',
  );
}

/* ============================================================================
 * 3. 高度夹取（`xtt` @2329550，逐字）
 * ============================================================================ */

/**
 * 官方 `xtt` @2329550（逐字）：
 * ```js
 * function xtt(e,t){const n=Math.max(e,100);return t===void 0?n:Math.min(n,t)}
 * ```
 */
export function clampMcpAppHeight(height: number, maxInlineHeight?: number): number {
  const clamped = Math.max(height, MCP_APP_MIN_HEIGHT);
  return maxInlineHeight === undefined ? clamped : Math.min(clamped, maxInlineHeight);
}

/** 官方 iframe style 高度：展开 `calc(88vh - 36px)`，否则 `` `${A}px` ``。 */
export function mcpAppIframeHeight(expanded: boolean, inlineHeight: number): string {
  return expanded ? `calc(88vh - ${MCP_APP_EXPANDED_HEADER_PX}px)` : `${inlineHeight}px`;
}

/* ============================================================================
 * 4. reducer（`att` @2323804 / `Jse` @2323841 / `ctt` @2324015，逐字）
 * ============================================================================ */

/** 官方 `att` @2323804（逐字）。 */
export interface McpAppHostState {
  status: 'loading' | 'ready' | 'error';
  attempt: number;
  automaticRetries: number;
  wasReady: boolean;
  reason: string | null;
}

/** 官方 `att` @2323804（逐字）。 */
export const MCP_APP_INITIAL_STATE: McpAppHostState = {
  status: 'loading',
  attempt: 0,
  automaticRetries: 0,
  wasReady: false,
  reason: null,
};

/** 官方 `ctt` 的 action。 */
export type McpAppHostAction =
  | { type: 'start' }
  | { type: 'ready' }
  | { type: 'failed'; reason: string }
  | { type: 'retry'; manual?: boolean };

/**
 * 官方 `Jse` @2323841（逐字）：
 * ```js
 * function Jse(e){return e.status!=="error"||e.wasReady||e.reason==="invalid_resource_uri"?null:ltt[e.automaticRetries]??null}
 * ```
 */
export function nextMcpAppAutoRetryDelay(state: McpAppHostState): number | null {
  if (
    state.status !== 'error' ||
    state.wasReady ||
    state.reason === 'invalid_resource_uri'
  ) {
    return null;
  }
  return MCP_APP_RETRY_DELAYS[state.automaticRetries] ?? null;
}

/** 官方 `ctt` @2324015（逐字）。 */
export function mcpAppHostReducer(state: McpAppHostState, action: McpAppHostAction): McpAppHostState {
  switch (action.type) {
    case 'start':
      return { ...state, status: 'loading', reason: null };
    case 'ready':
      return { ...state, status: 'ready', reason: null, wasReady: true };
    case 'failed':
      return { ...state, status: 'error', reason: action.reason };
    case 'retry':
      return state.status !== 'error' || (!action.manual && nextMcpAppAutoRetryDelay(state) === null)
        ? state
        : {
            ...state,
            status: 'loading',
            reason: null,
            attempt: state.attempt + 1,
            automaticRetries: action.manual ? 0 : state.automaticRetries + 1,
          };
  }
}

/** 官方 onError 的 reason 折叠（逐字白名单）。 */
export function normalizeMcpAppFailureReason(reason: unknown): string {
  return typeof reason === 'string' &&
    (MCP_APP_FAILURE_REASONS as readonly string[]).includes(reason)
    ? reason
    : 'resource_error';
}

/* ============================================================================
 * 5. resource_uri 解析 + 资源策略（`are`/`Fx`/`gg`/`rre`/`O1e`）
 * ============================================================================ */

/** 官方 `are` @1693300 邻域（逐字）。 */
export const MCP_APP_RESOURCE_URI_PATTERN = /^ui:\/\/tapnow\/([a-z0-9-]+)@(v\d+)$/;

/** 官方 `Fx` @1693300 邻域（逐字）：解析出 `{name, version}`，不匹配 ⇒ `null`。 */
export function parseMcpAppResourceUri(resourceUri: string): { name: string; version: string } | null {
  const match = MCP_APP_RESOURCE_URI_PATTERN.exec(resourceUri);
  return match ? { name: match[1], version: match[2] } : null;
}

/** 官方资源策略对象（`Object.freeze` 产物 ⇒ 全部只读）。 */
export interface McpAppResourcePolicy {
  readonly allowExpanded: boolean;
  readonly autoExpandOnReady: boolean;
  readonly maxInlineHeight?: number;
}

/** 官方 `gg` @1693300 邻域（逐字）：未知资源的默认策略。 */
export const MCP_APP_DEFAULT_RESOURCE_POLICY: Readonly<McpAppResourcePolicy> = Object.freeze({
  allowExpanded: false,
  autoExpandOnReady: false,
});

/** 官方 `rre` @1693300 邻域（逐字）。 */
export const MCP_APP_RESOURCE_POLICIES: Readonly<
  Record<string, Readonly<McpAppResourcePolicy>>
> = Object.freeze({
  'motion-picker': Object.freeze({ allowExpanded: true, autoExpandOnReady: false, maxInlineHeight: 520 }),
  'creative-picker': Object.freeze({ allowExpanded: true, autoExpandOnReady: false, maxInlineHeight: 520 }),
  'website-design-picker': Object.freeze({ allowExpanded: true, autoExpandOnReady: false, maxInlineHeight: 520 }),
  'actor-emotion': Object.freeze({ allowExpanded: true, autoExpandOnReady: false }),
  animatic: Object.freeze({ allowExpanded: true, autoExpandOnReady: true }),
  previs: Object.freeze({ allowExpanded: true, autoExpandOnReady: true }),
});

/** 官方 `O1e` @1693300 邻域（逐字）：`const t=Fx(e); return t ? rre[t.name] ?? gg : gg`。 */
export function resolveMcpAppResourcePolicy(resourceUri: string): Readonly<McpAppResourcePolicy> {
  const parsed = parseMcpAppResourceUri(resourceUri);
  if (!parsed) return MCP_APP_DEFAULT_RESOURCE_POLICY;
  return MCP_APP_RESOURCE_POLICIES[parsed.name] ?? MCP_APP_DEFAULT_RESOURCE_POLICY;
}

/* ============================================================================
 * 6. 代理页 URL（`uce` @675688 的逐字复刻）
 * ============================================================================ */

/** 官方 `HV` @675391（逐字）：资源版本哈希。 */
export const MCP_APP_ASSET_VERSION_HASH = 'fa3dd6f60a';

/** 官方 `fd` @675391（逐字）。 */
export const OFFICIAL_PREVIEW_HOSTS = {
  GLOBAL: 'preview.tapnow.ai',
  CN: 'preview.tapnow.media',
  CN_LEGACY: 'preview.tapnow.top',
} as const;

/** 官方 `cs` @10331（逐字，`vendor-packages-jvPqKqU8.js`）。 */
export const OFFICIAL_APP_HOSTS = { GLOBAL: 'app.tapnow.ai', CN: 'app.tapnow.media' } as const;

/** 官方 `zV` @675470（逐字）。 */
export const OFFICIAL_CONTENT_HOST = 'https://usercontent.tapnow.art';
/** 官方 `WV` @675470（逐字）。 */
export const OFFICIAL_CONTENT_TESTING_HOST = 'https://usercontent-testing.tapnow.art';
/** 官方 `Zp` @675470（逐字）。 */
export const OFFICIAL_TAMAREDGE_ZONE = 'tamaredge.top';
/** 官方 `KV` @675470（逐字）。 */
export const OFFICIAL_TAPNOW_VERCEL_PR_PATTERN =
  /^tapnow-(?:test|cn)-pr-\d+(?:-test-[1-5])?\.vercel\.app$/;

/** 官方 `qV` @675470（逐字）。 */
export function isTamarEdgeZoneHost(hostname: string): boolean {
  return hostname === OFFICIAL_TAMAREDGE_ZONE || hostname.endsWith(`.${OFFICIAL_TAMAREDGE_ZONE}`);
}

/**
 * 官方 `pa(n)`（`vendor-packages-jvPqKqU8.js` @12353）—— **未挖到**（依赖 `J1`/`VE`/`LE`/`jE`/`dE`/`GE`
 * 一整套区域域名表，本轮未解析）⇒ 此处恒 `false` 并留 TODO，**不猜域名**。后果：`app.tapnow.media`
 * 之外的官方自建域会落到 `/usercontent-proxy/...` 兜底分支（与官方「未知域」同一分支）。
 *
 * TODO(官方实体未解析，待替换)：把 `pa` 的区域域名表挖出后替换本函数。
 */
export function officialIsOfficialVercelHost(_hostname: string): boolean {
  return false;
}

/**
 * 官方 `uce(e)` @675688（逐字）：
 * ```js
 * function uce(e){const t=`/usercontent-proxy/${e}`;if(typeof window>"u")return t;
 *   const n=window.location.hostname,s=r=>`${r}/${HV}/${e}`;
 *   return n===fd.GLOBAL||n===fd.CN||n===fd.CN_LEGACY||qV(n)||KV.test(n)?s(WV)
 *        : n===cs.GLOBAL||pa(n)?s(zV):t}
 * ```
 * ⚠️ 本函数比同批 `widgetProxyUrl.officialWidgetProxyUrl` 更完整：`fd`/`cs`/`Zp`/`KV`/`WV`/`zV`/`HV`
 * 全部**已挖到并逐字实现**，只有 `pa` 是 TODO 占位。
 *
 * 本导出是「给定 hostname」的**同体**拆分（为可测性；官方读的 `window.location.hostname` 在
 * jsdom 里不可重定义）。逻辑与 `uce` 第 2 步起逐字一致。
 */
export function officialMcpAppProxyUrlForHostname(hostname: string, page: string): string {
  const fallback = `/usercontent-proxy/${page}`;
  const join = (base: string) => `${base}/${MCP_APP_ASSET_VERSION_HASH}/${page}`;
  if (
    hostname === OFFICIAL_PREVIEW_HOSTS.GLOBAL ||
    hostname === OFFICIAL_PREVIEW_HOSTS.CN ||
    hostname === OFFICIAL_PREVIEW_HOSTS.CN_LEGACY ||
    isTamarEdgeZoneHost(hostname) ||
    OFFICIAL_TAPNOW_VERCEL_PR_PATTERN.test(hostname)
  ) {
    return join(OFFICIAL_CONTENT_TESTING_HOST);
  }
  if (hostname === OFFICIAL_APP_HOSTS.GLOBAL || officialIsOfficialVercelHost(hostname)) {
    return join(OFFICIAL_CONTENT_HOST);
  }
  return fallback;
}

/** 官方 `uce(e)` 的公开形态（读 `window.location.hostname`；SSR ⇒ 官方首行兜底）。 */
export function officialMcpAppProxyUrl(page: string): string {
  if (typeof window === 'undefined') return `/usercontent-proxy/${page}`;
  return officialMcpAppProxyUrlForHostname(window.location.hostname, page);
}

/* ============================================================================
 * 7. 标题（逐字：`De??(lh(Z)?"Previs":L("chatAdapter.mcpApp.title",{defaultValue:"App"}))`）
 * ============================================================================ */

/** 官方 `De = typeof Ae.title=="string" ? Ae.title : void 0`，`Ae = content.request ?? {}`。 */
export function mcpAppRequestTitle(content: ToolEventContent | null | undefined): string | undefined {
  const request = (content?.request ?? {}) as { title?: unknown };
  return typeof request.title === 'string' ? request.title : undefined;
}

/** 官方 header 标题（**有** Previs 分支）。 */
export function mcpAppHeaderTitle(
  requestTitle: string | undefined,
  resourceUri: string,
  titleText: string,
): string {
  return requestTitle ?? (isMcpAppPrevisUri(resourceUri) ? 'Previs' : titleText);
}

/** 官方 iframe `title` 属性（**没有** Previs 分支）：`De ?? "App"`。 */
export function mcpAppIframeTitle(requestTitle: string | undefined): string {
  return requestTitle ?? 'App';
}

/* ============================================================================
 * 8. 其它派生（逐字）
 * ============================================================================ */

/** 官方 `Z`：`typeof t.ui?.resource_uri == "string" ? t.ui.resource_uri : ""`。 */
export function mcpAppResourceUri(content: ToolEventContent | null | undefined): string {
  const ui = (content?.ui ?? {}) as { resource_uri?: unknown };
  return typeof ui.resource_uri === 'string' ? ui.resource_uri : '';
}

/** 官方 `Re`：错误面板第二行（`content.response.summary`）。 */
export function mcpAppResponseSummary(content: ToolEventContent | null | undefined): string | null {
  const response = (content?.response ?? null) as { summary?: unknown } | null;
  return typeof response?.summary === 'string' ? response.summary : null;
}

/** 官方 `ve`：`typeof t.tool_call_id == "string" ? t.tool_call_id : ""`。 */
export function mcpAppToolCallId(content: ToolEventContent | null | undefined): string {
  return typeof content?.tool_call_id === 'string' ? content.tool_call_id : '';
}

/** 官方 `Ge`：`ui.host_capabilities` 是否含 `"update_model_context"`。 */
export function mcpAppSupportsUpdateModelContext(
  content: ToolEventContent | null | undefined,
): boolean {
  const ui = (content?.ui ?? {}) as { host_capabilities?: unknown };
  const capabilities = Array.isArray(ui.host_capabilities)
    ? ui.host_capabilities.filter((entry): entry is string => typeof entry === 'string')
    : [];
  return capabilities.includes('update_model_context');
}

/** 官方 `Me`：`!me && w && Ie && Z ? `${w}\0${Ie}\0${Z}` : ""`（`panelKey`）。 */
export function mcpAppPanelKey(
  conversationId: string,
  manifestIdentity: string,
  resourceUri: string,
  mcpManagedProjection: boolean,
): string {
  return !mcpManagedProjection && conversationId && manifestIdentity && resourceUri
    ? `${conversationId}\0${manifestIdentity}\0${resourceUri}`
    : '';
}

/** 官方 `k === "ready"`（iframe 是否可见）。 */
export function mcpAppIsReady(state: McpAppHostState): boolean {
  return state.status === 'ready';
}
