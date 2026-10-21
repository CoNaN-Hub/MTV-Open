// @vitest-environment jsdom
/**
 * `widgetProxyUrl`（官方 `KP` = `uce` @675688）与 `htmlPreviewTarget`（官方 store 切片 `setHtmlPreviewTarget`）
 * 的回归 —— 验证分级 (b) jsdom + (d) 源码级。
 *
 * ⚠️ 诚实标注：官方两个「首方/次方域名」分支的实体（`fd` / `cs` / `qV` / `KV` / `pa` / `WV` / `zV`）**未挖到**，
 * 本模块把它们保留为恒 `false` 的显式谓词；因此可用分支只有官方自己的兜底
 * `/usercontent-proxy/${page}`（非官方域名 / SSR 走的正是这一支）。
 */
import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_PROXY_PAGE,
  MCP_APP_PROXY_PAGE,
  OFFICIAL_ASSET_VERSION_HASH,
  officialIsFirstPartyHost,
  officialIsSecondPartyHost,
  officialWidgetProxyUrl,
  WIDGET_PROXY_PAGE,
} from '../../src/services/chat/widgetProxyUrl';
import {
  useHtmlPreviewTargetStore,
  type HtmlPreviewTargetInput,
} from '../../src/services/chat/htmlPreviewTarget';

describe('officialWidgetProxyUrl（官方 `uce`）', () => {
  it('三个代理页文件名逐字（§9.0-5：三者不可互换）', () => {
    expect(WIDGET_PROXY_PAGE).toBe('widget-proxy.html');
    expect(ARTIFACT_PROXY_PAGE).toBe('artifact-proxy.html');
    expect(MCP_APP_PROXY_PAGE).toBe('mcp-app-proxy.html');
  });

  it('资源版本哈希 = 官方 `BASE_URL` 末段（逐字）', () => {
    expect(OFFICIAL_ASSET_VERSION_HASH).toBe('0a8da41c37db9507b96c3dc55fb843278f7127e5');
  });

  it('非官方域名（含 jsdom localhost）⇒ 官方兜底 `/usercontent-proxy/${page}`', () => {
    expect(officialWidgetProxyUrl(WIDGET_PROXY_PAGE)).toBe(
      '/usercontent-proxy/widget-proxy.html',
    );
    expect(officialWidgetProxyUrl(ARTIFACT_PROXY_PAGE)).toBe(
      '/usercontent-proxy/artifact-proxy.html',
    );
  });

  it('未解析的两个域名谓词恒 false（TODO 待替换，不猜域名）', () => {
    expect(officialIsFirstPartyHost('tapnow.media')).toBe(false);
    expect(officialIsSecondPartyHost('tapnow.media')).toBe(false);
  });
});

describe('htmlPreviewTarget store（官方 `setHtmlPreviewTarget` + `pt(null)`）', () => {
  it('初始为 null；set 后为 `ShowHtmlCard` 传入的三字段；clear 回 null', () => {
    const store = useHtmlPreviewTargetStore;
    store.getState().clearHtmlPreviewTarget();
    expect(store.getState().htmlPreviewTarget).toBeNull();

    const input: HtmlPreviewTargetInput = {
      artifactPath: 'pages/a.html',
      title: 'T',
      description: 'D',
    };
    store.getState().setHtmlPreviewTarget(input);
    expect(store.getState().htmlPreviewTarget).toEqual(input);

    store.getState().clearHtmlPreviewTarget();
    expect(store.getState().htmlPreviewTarget).toBeNull();
  });
});
