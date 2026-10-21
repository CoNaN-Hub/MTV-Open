// @vitest-environment jsdom
/**
 * `mcpApp` 卡的纯函数层回归 —— 验证分级 **(d) 源码级**。
 * 每条断言都对着 live bundle 的逐字源码（偏移见被测模块文件头）。
 *
 * ⚠️ jsdom：`officialMcpAppProxyUrl`（官方 `uce` @675688）读 `window.location.hostname`
 * 与 `typeof window`，node 环境下只会走 SSR 兜底分支。
 */
import { describe, expect, it } from 'vitest';
import {
  MCP_APP_CARD_EXPANDED_EVENT,
  MCP_APP_ASSET_VERSION_HASH,
  MCP_APP_DEFAULT_HEIGHT,
  MCP_APP_DEFAULT_RESOURCE_POLICY,
  MCP_APP_ECOMMERCE_PHOTOSET_URI,
  MCP_APP_ERROR_REASON_MAX_CHARS,
  MCP_APP_EXPANDED_HEADER_PX,
  MCP_APP_FAILURE_REASONS,
  MCP_APP_HOST_INIT_TIMEOUT_MS,
  MCP_APP_INITIAL_STATE,
  MCP_APP_MIN_HEIGHT,
  MCP_APP_PREVIS_URI,
  MCP_APP_RESOURCE_POLICIES,
  MCP_APP_RESOURCE_READY_RETRY_MS,
  MCP_APP_RESOURCE_URI_PATTERN,
  MCP_APP_RETRY_DELAYS,
  OFFICIAL_APP_HOSTS,
  OFFICIAL_CONTENT_HOST,
  OFFICIAL_CONTENT_TESTING_HOST,
  OFFICIAL_PREVIEW_HOSTS,
  OFFICIAL_TAMAREDGE_ZONE,
  OFFICIAL_TAPNOW_VERCEL_PR_PATTERN,
  clampMcpAppHeight,
  isMcpAppEvent,
  isMcpAppPrevisUri,
  isPresentationShortcutBlockedTarget,
  isPresentationShortcutKey,
  isTamarEdgeZoneHost,
  mcpAppHeaderTitle,
  mcpAppHostReducer,
  mcpAppIframeHeight,
  mcpAppIframeTitle,
  mcpAppPanelKey,
  mcpAppRequestTitle,
  mcpAppResourceUri,
  mcpAppResponseSummary,
  mcpAppSupportsUpdateModelContext,
  mcpAppToolCallId,
  nextMcpAppAutoRetryDelay,
  normalizeMcpAppFailureReason,
  officialMcpAppProxyUrlForHostname,
  parseMcpAppResourceUri,
  resolveMcpAppResourcePolicy,
  type McpAppHostState,
} from '../../../src/services/chat/mcpAppCard';

describe('mcpAppCard —— 族谓词（AD @444489，逐字）', () => {
  it('要求 tool_event + content.ui.resource_uri 为非空字符串', () => {
    expect(
      isMcpAppEvent({ type: 'tool_event', content: { ui: { resource_uri: 'ui://tapnow/previs@v3' } } }),
    ).toBe(true);
    expect(isMcpAppEvent({ type: 'tool_event', content: { ui: { resource_uri: '' } } })).toBe(false);
    expect(isMcpAppEvent({ type: 'tool_event', content: { ui: {} } })).toBe(false);
    expect(isMcpAppEvent({ type: 'tool_event', content: { ui: 'x' } })).toBe(false);
    expect(isMcpAppEvent({ type: 'tool_event', content: null })).toBe(false);
    expect(isMcpAppEvent({ type: 'text', content: { ui: { resource_uri: 'a' } } })).toBe(false);
    expect(isMcpAppEvent(null)).toBe(false);
  });
});

describe('mcpAppCard —— 常量逐字（att/ltt/f_/btt/sV/xtt/lre/cre）', () => {
  it('重试延迟表 [1000, 3000]、下限 100、默认 200、超时 15000 / 800', () => {
    expect([...MCP_APP_RETRY_DELAYS]).toEqual([1e3, 3e3]);
    expect(MCP_APP_MIN_HEIGHT).toBe(100);
    expect(MCP_APP_DEFAULT_HEIGHT).toBe(200);
    expect(MCP_APP_EXPANDED_HEADER_PX).toBe(36);
    expect(MCP_APP_HOST_INIT_TIMEOUT_MS).toBe(15_000);
    expect(MCP_APP_RESOURCE_READY_RETRY_MS).toBe(800);
    expect(MCP_APP_CARD_EXPANDED_EVENT).toBe('tapnow:mcp-app-card-expanded');
    expect(MCP_APP_PREVIS_URI).toBe('ui://tapnow/previs@v3');
    expect(MCP_APP_ECOMMERCE_PHOTOSET_URI).toBe('ui://tapnow/ecommerce-photoset@v2');
    expect(MCP_APP_ERROR_REASON_MAX_CHARS).toBe(240);
    expect([...MCP_APP_FAILURE_REASONS]).toEqual(['timeout', 'invalid_resource_uri', 'resource_error']);
  });

  it('初始 state 逐字', () => {
    expect(MCP_APP_INITIAL_STATE).toEqual({
      status: 'loading',
      attempt: 0,
      automaticRetries: 0,
      wasReady: false,
      reason: null,
    });
  });
});

/** 通过 iframe 高度算式反推 header 高度常量（`calc(88vh - 36px)`）。 */
void 0;

describe('mcpAppCard —— xtt 高度夹取（@2329550，逐字）', () => {
  it('Math.max(e,100)；有 max 再 Math.min', () => {
    expect(clampMcpAppHeight(50)).toBe(100);
    expect(clampMcpAppHeight(300)).toBe(300);
    expect(clampMcpAppHeight(900, 520)).toBe(520);
    expect(clampMcpAppHeight(50, 520)).toBe(100);
  });

  it('iframe height：展开 calc(88vh - 36px)，否则 `${A}px`', () => {
    expect(mcpAppIframeHeight(false, 200)).toBe('200px');
    expect(mcpAppIframeHeight(true, 640)).toBe('calc(88vh - 36px)');
  });
});

describe('mcpAppCard —— reducer（ctt @2324015）+ 自动重试（Jse @2323841，逐字）', () => {
  const errored = (over: Partial<McpAppHostState> = {}): McpAppHostState => ({
    ...MCP_APP_INITIAL_STATE,
    status: 'error',
    reason: 'resource_error',
    ...over,
  });

  it('start / ready / failed', () => {
    expect(mcpAppHostReducer(MCP_APP_INITIAL_STATE, { type: 'start' })).toEqual(
      MCP_APP_INITIAL_STATE,
    );
    expect(mcpAppHostReducer(errored(), { type: 'ready' })).toMatchObject({
      status: 'ready',
      reason: null,
      wasReady: true,
    });
    expect(mcpAppHostReducer(MCP_APP_INITIAL_STATE, { type: 'failed', reason: 'timeout' })).toMatchObject(
      { status: 'error', reason: 'timeout' },
    );
  });

  it('Jse：非 error / wasReady / invalid_resource_uri ⇒ null；否则按 automaticRetries 取表', () => {
    expect(nextMcpAppAutoRetryDelay(MCP_APP_INITIAL_STATE)).toBeNull();
    expect(nextMcpAppAutoRetryDelay(errored({ wasReady: true }))).toBeNull();
    expect(nextMcpAppAutoRetryDelay(errored({ reason: 'invalid_resource_uri' }))).toBeNull();
    expect(nextMcpAppAutoRetryDelay(errored())).toBe(1e3);
    expect(nextMcpAppAutoRetryDelay(errored({ automaticRetries: 1 }))).toBe(3e3);
    /* 第三次 ⇒ `ltt[2] ?? null` ⇒ 不再自动重试 */
    expect(nextMcpAppAutoRetryDelay(errored({ automaticRetries: 2 }))).toBeNull();
  });

  it('retry 自动：attempt+1、automaticRetries+1；上限后是 no-op', () => {
    const first = mcpAppHostReducer(errored(), { type: 'retry' });
    expect(first).toMatchObject({ status: 'loading', attempt: 1, automaticRetries: 1, reason: null });
    const second = mcpAppHostReducer(first, { type: 'failed', reason: 'resource_error' });
    const retried = mcpAppHostReducer(second, { type: 'retry' });
    expect(retried).toMatchObject({ attempt: 2, automaticRetries: 2 });
    /* automaticRetries=2 ⇒ Jse null ⇒ 自动 retry 无效 */
    const again = mcpAppHostReducer(retried, { type: 'retry' });
    expect(again).toBe(retried);
  });

  it('retry 手动：automaticRetries 归零；非 error 态直接返回原 state', () => {
    const state = errored({ automaticRetries: 2, attempt: 2 });
    expect(mcpAppHostReducer(state, { type: 'retry', manual: true })).toMatchObject({
      status: 'loading',
      attempt: 3,
      automaticRetries: 0,
    });
    expect(mcpAppHostReducer(MCP_APP_INITIAL_STATE, { type: 'retry' })).toBe(MCP_APP_INITIAL_STATE);
    expect(mcpAppHostReducer(MCP_APP_INITIAL_STATE, { type: 'retry', manual: true })).toBe(
      MCP_APP_INITIAL_STATE,
    );
  });

  it('onError 白名单折叠', () => {
    expect(normalizeMcpAppFailureReason('timeout')).toBe('timeout');
    expect(normalizeMcpAppFailureReason('invalid_resource_uri')).toBe('invalid_resource_uri');
    expect(normalizeMcpAppFailureReason('resource_error')).toBe('resource_error');
    expect(normalizeMcpAppFailureReason('whatever')).toBe('resource_error');
    expect(normalizeMcpAppFailureReason(undefined)).toBe('resource_error');
  });
});

describe('mcpAppCard —— resource_uri 解析与资源策略（are/Fx/gg/rre/O1e @1693300 邻域，逐字）', () => {
  it('正则逐字 + 解析结果', () => {
    expect(MCP_APP_RESOURCE_URI_PATTERN.source).toBe('^ui:\\/\\/tapnow\\/([a-z0-9-]+)@(v\\d+)$');
    expect(parseMcpAppResourceUri('ui://tapnow/previs@v3')).toEqual({ name: 'previs', version: 'v3' });
    expect(parseMcpAppResourceUri('ui://tapnow/Previs@v3')).toBeNull();
    expect(parseMcpAppResourceUri('https://x')).toBeNull();
  });

  it('策略表逐字（含 maxInlineHeight 520 的三个 picker）', () => {
    expect(MCP_APP_RESOURCE_POLICIES['motion-picker']).toEqual({
      allowExpanded: true,
      autoExpandOnReady: false,
      maxInlineHeight: 520,
    });
    expect(MCP_APP_RESOURCE_POLICIES['creative-picker'].maxInlineHeight).toBe(520);
    expect(MCP_APP_RESOURCE_POLICIES['website-design-picker'].maxInlineHeight).toBe(520);
    expect(MCP_APP_RESOURCE_POLICIES['actor-emotion']).toEqual({
      allowExpanded: true,
      autoExpandOnReady: false,
    });
    expect(MCP_APP_RESOURCE_POLICIES.animatic).toEqual({
      allowExpanded: true,
      autoExpandOnReady: true,
    });
    expect(MCP_APP_RESOURCE_POLICIES.previs).toEqual({ allowExpanded: true, autoExpandOnReady: true });
    expect(MCP_APP_DEFAULT_RESOURCE_POLICY).toEqual({
      allowExpanded: false,
      autoExpandOnReady: false,
    });
  });

  it('O1e：已知资源取表，未知资源 / 非法 uri 取 gg', () => {
    expect(resolveMcpAppResourcePolicy('ui://tapnow/previs@v3').allowExpanded).toBe(true);
    expect(resolveMcpAppResourcePolicy('ui://tapnow/unknown@v1')).toBe(MCP_APP_DEFAULT_RESOURCE_POLICY);
    expect(resolveMcpAppResourcePolicy('bogus')).toBe(MCP_APP_DEFAULT_RESOURCE_POLICY);
  });

  it('lh：只认 previs', () => {
    expect(isMcpAppPrevisUri(MCP_APP_PREVIS_URI)).toBe(true);
    expect(isMcpAppPrevisUri('ui://tapnow/previs@v2')).toBe(false);
    expect(isMcpAppPrevisUri(MCP_APP_ECOMMERCE_PHOTOSET_URI)).toBe(false);
  });
});

describe('mcpAppCard —— vtt / wtt 键盘守卫（@2329669 邻域，逐字）', () => {
  it('vtt：ArrowLeft / ArrowRight / Enter', () => {
    expect(isPresentationShortcutKey('ArrowLeft')).toBe(true);
    expect(isPresentationShortcutKey('ArrowRight')).toBe(true);
    expect(isPresentationShortcutKey('Enter')).toBe(true);
    expect(isPresentationShortcutKey('Escape')).toBe(false);
    expect(isPresentationShortcutKey('a')).toBe(false);
  });

  it('wtt：非 Element 恒 false', () => {
    expect(isPresentationShortcutBlockedTarget(null)).toBe(false);
    expect(isPresentationShortcutBlockedTarget('x')).toBe(false);
  });

  it('wtt：逐字选择器命中时为 true（button / a / input / textarea / select / contenteditable / role）', () => {
    for (const tag of ['button', 'a', 'input', 'textarea', 'select']) {
      expect(isPresentationShortcutBlockedTarget(document.createElement(tag))).toBe(true);
    }
    expect(isPresentationShortcutBlockedTarget(document.createElement('span'))).toBe(false);

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const inner = document.createElement('span');
    editable.appendChild(inner);
    expect(isPresentationShortcutBlockedTarget(inner)).toBe(true);

    /* `[contenteditable]:not([contenteditable="false"])` —— false 不算阻断 */
    const notEditable = document.createElement('div');
    notEditable.setAttribute('contenteditable', 'false');
    const inner2 = document.createElement('span');
    notEditable.appendChild(inner2);
    expect(isPresentationShortcutBlockedTarget(inner2)).toBe(false);

    for (const role of ['button', 'radio', 'radiogroup', 'slider']) {
      const holder = document.createElement('div');
      holder.setAttribute('role', role);
      const child = document.createElement('span');
      holder.appendChild(child);
      expect(isPresentationShortcutBlockedTarget(child)).toBe(true);
    }
  });
});

describe('mcpAppCard —— 代理页 URL（uce @675688 逐字复刻）', () => {
  const page = 'mcp-app-proxy.html';

  it('常量逐字（HV / preview 三域 / app 两域 / 两套 CDN / tamaredge / vercel-pr 正则）', () => {
    expect(OFFICIAL_PREVIEW_HOSTS).toEqual({
      GLOBAL: 'preview.tapnow.ai',
      CN: 'preview.tapnow.media',
      CN_LEGACY: 'preview.tapnow.top',
    });
    expect(OFFICIAL_APP_HOSTS).toEqual({ GLOBAL: 'app.tapnow.ai', CN: 'app.tapnow.media' });
    expect(OFFICIAL_CONTENT_HOST).toBe('https://usercontent.tapnow.art');
    expect(OFFICIAL_CONTENT_TESTING_HOST).toBe('https://usercontent-testing.tapnow.art');
    expect(MCP_APP_ASSET_VERSION_HASH).toBe('fa3dd6f60a');
    expect(OFFICIAL_TAMAREDGE_ZONE).toBe('tamaredge.top');
    expect(OFFICIAL_TAPNOW_VERCEL_PR_PATTERN.source).toBe(
      '^tapnow-(?:test|cn)-pr-\\d+(?:-test-[1-5])?\\.vercel\\.app$',
    );
  });

  it('qV：等于或子域', () => {
    expect(isTamarEdgeZoneHost('tamaredge.top')).toBe(true);
    expect(isTamarEdgeZoneHost('a.tamaredge.top')).toBe(true);
    expect(isTamarEdgeZoneHost('notamaredge.top')).toBe(false);
  });

  it('preview / tamaredge / vercel-pr ⇒ testing CDN + HV 前缀', () => {
    for (const host of [
      'preview.tapnow.ai',
      'preview.tapnow.media',
      'preview.tapnow.top',
      'tamaredge.top',
      'x.tamaredge.top',
      'tapnow-test-pr-12.vercel.app',
      'tapnow-cn-pr-3-test-5.vercel.app',
    ]) {
      expect(officialMcpAppProxyUrlForHostname(host, page)).toBe(
        `https://usercontent-testing.tapnow.art/fa3dd6f60a/${page}`,
      );
    }
  });

  it('app.tapnow.ai ⇒ 正式 CDN + HV 前缀', () => {
    expect(officialMcpAppProxyUrlForHostname('app.tapnow.ai', page)).toBe(
      `https://usercontent.tapnow.art/fa3dd6f60a/${page}`,
    );
  });

  it('未知域（含本地 / Tauri）⇒ `/usercontent-proxy/<page>` 兜底', () => {
    for (const host of ['localhost', '127.0.0.1', 'tauri.localhost', 'example.com']) {
      expect(officialMcpAppProxyUrlForHostname(host, page)).toBe(`/usercontent-proxy/${page}`);
    }
    /* `app.tapnow.media` 走 `cs.GLOBAL||pa(n)` 的右支 `pa` —— **未挖到** ⇒ 落到兜底分支
       （诚实标注：官方此处会命中，本实现不会；见报告「未落地清单」）。 */
    expect(officialMcpAppProxyUrlForHostname('app.tapnow.media', page)).toBe(
      `/usercontent-proxy/${page}`,
    );
  });
});

describe('mcpAppCard —— 派生值（De / Re / Z / ve / Ge / Me）', () => {
  it('Z = ui.resource_uri 或 ""', () => {
    expect(mcpAppResourceUri({ ui: { resource_uri: 'ui://x' } })).toBe('ui://x');
    expect(mcpAppResourceUri({ ui: {} })).toBe('');
    expect(mcpAppResourceUri(null)).toBe('');
  });

  it('De = request.title（仅字符串）', () => {
    expect(mcpAppRequestTitle({ request: { title: '分组动画' } })).toBe('分组动画');
    expect(mcpAppRequestTitle({ request: { title: 1 } })).toBeUndefined();
  });

  it('标题：De ?? (lh(Z) ? "Previs" : i18n)；iframe title **没有** Previs 分支', () => {
    expect(mcpAppHeaderTitle('自定义', MCP_APP_PREVIS_URI, '应用')).toBe('自定义');
    expect(mcpAppHeaderTitle(undefined, MCP_APP_PREVIS_URI, '应用')).toBe('Previs');
    expect(mcpAppHeaderTitle(undefined, 'ui://tapnow/other@v1', '应用')).toBe('应用');
    expect(mcpAppIframeTitle(undefined)).toBe('App');
    expect(mcpAppIframeTitle('X')).toBe('X');
  });

  it('Re = response.summary（仅字符串）', () => {
    expect(mcpAppResponseSummary({ response: { summary: 's' } })).toBe('s');
    expect(mcpAppResponseSummary({ response: { summary: 2 } })).toBeNull();
    expect(mcpAppResponseSummary(null)).toBeNull();
  });

  it('ve = tool_call_id（仅字符串）', () => {
    expect(mcpAppToolCallId({ tool_call_id: 't1' })).toBe('t1');
    expect(mcpAppToolCallId({})).toBe('');
  });

  it('Ge = ui.host_capabilities 含 update_model_context', () => {
    expect(
      mcpAppSupportsUpdateModelContext({ ui: { host_capabilities: ['a', 'update_model_context'] } }),
    ).toBe(true);
    expect(mcpAppSupportsUpdateModelContext({ ui: { host_capabilities: ['a', 1] } })).toBe(false);
    expect(mcpAppSupportsUpdateModelContext({ ui: {} })).toBe(false);
  });

  it('Me = !me && w && Ie && Z ? `${w}\\0${Ie}\\0${Z}` : ""', () => {
    expect(mcpAppPanelKey('c', 'm', 'u', false)).toBe('c\0m\0u');
    expect(mcpAppPanelKey('c', 'm', 'u', true)).toBe('');
    expect(mcpAppPanelKey('', 'm', 'u', false)).toBe('');
    expect(mcpAppPanelKey('c', '', 'u', false)).toBe('');
    expect(mcpAppPanelKey('c', 'm', '', false)).toBe('');
  });
});
