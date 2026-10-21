/**
 * 沙箱代理页契约回归（覆盖表 §6「让官方卡片族真正可达」）。
 *
 * 官方 `HW`(`HtmlSandboxRenderer`，`vendor-packages-jvPqKqU8.js` @10155) 把产物 HTML 塞进
 * `<iframe sandbox="allow-scripts" src={KP("artifact-proxy.html")}>`，协议逐字：
 *   1. 代理页 → 宿主：`{type:"proxy-ready"}`
 *   2. 宿主 → 代理页：`{type:"render", html, nonce}`
 *   3. 代理页 → 宿主：`{type:"rendered", nonce}`
 * 官方那份代理页是 CDN 资源，MTV 没有 ⇒ `officialWidgetProxyUrl()` 在本地落到
 * `/usercontent-proxy/artifact-proxy.html` 时若 404，沙箱永远是空白。
 * 本测试锁住「本地代理页存在 + 三种消息齐备」这一**源码级契约**（分级 d）。同一文件里的行为
 * 由 `htmlPreviewDom.test.tsx` 的 DOM 用例覆盖（分级 b）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARTIFACT_PROXY_PAGE, officialWidgetProxyUrl } from '../../../src/services/chat/widgetProxyUrl';

const PROXY_PATH = path.resolve(process.cwd(), 'public/usercontent-proxy/artifact-proxy.html');

describe('artifact-proxy.html（官方沙箱代理页的本地实现）', () => {
  it('文件就在 `officialWidgetProxyUrl()` 解析出的本地路径上', () => {
    expect(officialWidgetProxyUrl(ARTIFACT_PROXY_PAGE)).toBe(`/usercontent-proxy/${ARTIFACT_PROXY_PAGE}`);
    expect(fs.existsSync(PROXY_PATH)).toBe(true);
  });

  it('三种协议消息齐备（`proxy-ready` / `render` / `rendered`）', () => {
    const html = fs.readFileSync(PROXY_PATH, 'utf8');
    expect(html).toContain("'proxy-ready'");
    expect(html).toContain("data.type !== 'render'");
    expect(html).toContain("'rendered'");
    /* 回消息要带 nonce（宿主 `f.nonce === l` 校验）。 */
    expect(html).toContain('nonce: nonce');
  });

  it('内容自包含：不引用任何外部资源（宿主 sandbox 只有 `allow-scripts`，不透明源里取不到同源资源）', () => {
    const html = fs.readFileSync(PROXY_PATH, 'utf8');
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/https?:\/\//);
  });
});
