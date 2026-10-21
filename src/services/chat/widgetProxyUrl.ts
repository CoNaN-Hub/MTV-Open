/**
 * 官方 `KP`（= `uce`，`vendor-packages-jvPqKqU8.js` @675688，`export {uce as g}` ⇒ 本 chunk `import {g as KP}`）
 * 的逐字复刻 —— 三个 iframe 代理页的真实 URL 规则。
 *
 * 官方原文（逐字）：
 * ```js
 * function uce(e){
 *   const t=`/usercontent-proxy/${e}`;
 *   if(typeof window>"u")return t;
 *   const n=window.location.hostname,
 *         s=r=>`${r}/${HV}/${e}`;
 *   return n===fd.GLOBAL||n===fd.CN||n===fd.CN_LEGACY||qV(n)||KV.test(n) ? s(WV)
 *        : n===cs.GLOBAL||pa(n) ? s(zV)
 *        : t;
 * }
 * ```
 *
 * ⚠️ 诚实声明（**官方实体未解析，待替换**）：
 *   · `fd.GLOBAL` / `fd.CN` / `fd.CN_LEGACY` / `cs.GLOBAL`（域名常量）与
 *     `qV` / `KV` / `pa`（域名谓词）、`WV` / `zV`（两套 CDN 前缀）**均未挖到** ⇒
 *     本文件**没有**伪造任何域名或前缀，只把两个「首方/次方域名」分支保留为显式的
 *     `officialIsFirstPartyHost` / `officialIsSecondPartyHost`（当前恒 `false`，带 TODO），
 *     使函数在非官方域名（含 MTV 本地 / Tauri / SSR）下**逐字落到官方同一分支**：
 *     `/usercontent-proxy/${name}`。
 *   · `HV`（资源版本哈希）官方逐字为 `0a8da41c37db9507b96c3dc55fb843278f7127e5`
 *     （`BASE_URL:"https://fe-assets.tapnow.media/0a8da41c37db9507b96c3dc55fb843278f7127e5"`，
 *     构建期常量块 @7218 邻域）；本文件按逐字值保留为常量，但**当前不会拼进 URL**——
 *     因为两个拼接分支的 `WV` / `zV` 未解析。
 *
 * 受影响的挂载点（全部只在 MTV 本地运行 ⇒ 走 `/usercontent-proxy/...` 兜底）：
 *   · `show_widget` (`ShowWidgetCard`) → `KP("widget-proxy.html")` @2363754
 *   · `htmlPreview` 渲染器 (`HtmlSandboxRenderer`) → `KP("artifact-proxy.html")` @10155
 *   · `mcpApp` (`McpAppCard`) → `KP("mcp-app-proxy.html")` @2330956（**不属本轮**）
 */

/** 官方构建期资源版本哈希（`BASE_URL` 末段，逐字 @7218 邻域）。 */
export const OFFICIAL_ASSET_VERSION_HASH = '0a8da41c37db9507b96c3dc55fb843278f7127e5';

/** 官方三个代理页文件名（三者不可互换，见 §6.6 / §9.0-5）。 */
export const WIDGET_PROXY_PAGE = 'widget-proxy.html';
export const ARTIFACT_PROXY_PAGE = 'artifact-proxy.html';
export const MCP_APP_PROXY_PAGE = 'mcp-app-proxy.html';

/**
 * 官方 `n===fd.GLOBAL||n===fd.CN||n===fd.CN_LEGACY||qV(n)||KV.test(n)`。
 *
 * TODO(官方实体未解析，待替换)：`fd` / `qV` / `KV` 未挖到 ⇒ 恒 `false`，**不猜测域名**。
 */
export function officialIsFirstPartyHost(_hostname: string): boolean {
  return false;
}

/**
 * 官方 `n===cs.GLOBAL||pa(n)`。
 *
 * TODO(官方实体未解析，待替换)：`cs` / `pa` 未挖到 ⇒ 恒 `false`，**不猜测域名**。
 */
export function officialIsSecondPartyHost(_hostname: string): boolean {
  return false;
}

/**
 * 官方 `uce(e)` —— 参数是代理页文件名，返回该代理页的 URL。
 * SSR（无 `window`）⇒ 官方首行 `typeof window>"u"` 的兜底分支。
 */
export function officialWidgetProxyUrl(page: string): string {
  const fallback = `/usercontent-proxy/${page}`;
  if (typeof window === 'undefined') return fallback;
  const hostname = window.location.hostname;
  if (officialIsFirstPartyHost(hostname)) {
    // TODO(官方实体未解析，待替换)：官方为 `${WV}/${HV}/${e}`；`WV` 未挖到。
    return fallback;
  }
  if (officialIsSecondPartyHost(hostname)) {
    // TODO(官方实体未解析，待替换)：官方为 `${zV}/${HV}/${e}`；`zV` 未挖到。
    return fallback;
  }
  return fallback;
}
