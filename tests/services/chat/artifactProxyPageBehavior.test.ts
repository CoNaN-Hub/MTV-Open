/**
 * `artifact-proxy.html` 的**行为**回归（真实 DOM + 真实脚本，分级 b）。
 *
 * 官方 `HW`(`HtmlSandboxRenderer`) 的三步握手（`vendor-packages-jvPqKqU8.js` @10155，逐字见
 * `src/components/chat/HtmlPreview.tsx`）：
 *   1. 代理页 → 宿主：`{type:"proxy-ready"}`
 *   2. 宿主 → 代理页：`{type:"render", html, nonce}`
 *   3. 代理页 → 宿主：`{type:"rendered", nonce}`
 * 本文件用 JSDOM 真的把代理页跑起来，断言这三步（`artifactProxyPage.test.ts` 只锁源码契约）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const PROXY_PATH = path.resolve(process.cwd(), 'public/usercontent-proxy/artifact-proxy.html');

interface PostedMessage { type?: string; nonce?: string }

function boot() {
  const html = fs.readFileSync(PROXY_PATH, 'utf8');
  const posted: PostedMessage[] = [];
  /* ⚠️ 必须在**解析前**装好拦截：代理页的内联脚本在构造期就发 `proxy-ready`，
     构造完再赋值会漏掉它（`beforeParse` 是 JSDOM 给的那个时机）。
     顶层 JSDOM 里 `window.parent === window` ⇒ 拦 `postMessage` 就等于拦 `parent.postMessage`。 */
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.postMessage = ((message: PostedMessage) => {
        posted.push(message);
      }) as typeof window.postMessage;
    },
  });
  return { dom, posted };
}

describe('artifact-proxy.html —— 官方沙箱代理页的三步握手', () => {
  it('加载后立刻发 `{type:"proxy-ready"}`', () => {
    const { posted } = boot();
    expect(posted).toEqual([{ type: 'proxy-ready' }]);
  });

  it('收到 `{type:"render",html,nonce}` ⇒ 把产物写进 `#artifact` 并回 `{type:"rendered",nonce}`', async () => {
    const { dom, posted } = boot();
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
      data: { type: 'render', html: '<h1>hello</h1>', nonce: 'nonce-1' },
    }));
    const frame = dom.window.document.getElementById('artifact') as HTMLIFrameElement | null;
    expect(frame).not.toBeNull();
    expect(frame!.getAttribute('srcdoc')).toBe('<h1>hello</h1>');
    /* 宿主给的是 `sandbox="allow-scripts"`（不透明源）⇒ 产物页自己要能跑脚本/交互，但不能同源。 */
    expect(frame!.getAttribute('sandbox')).toContain('allow-scripts');
    expect(frame!.getAttribute('sandbox')).not.toContain('allow-same-origin');
    /* `rendered` 由 `setTimeout(0)` 兜底发出（jsdom 不会替 `srcdoc` 触发 `load`）。 */
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(posted).toContainEqual({ type: 'rendered', nonce: 'nonce-1' });
  });

  it('第二次 `render` 替换掉上一次的产物（不叠加）', () => {
    const { dom } = boot();
    for (const [html, nonce] of [['<p>a</p>', 'n-a'], ['<p>b</p>', 'n-b']] as const) {
      dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
        data: { type: 'render', html, nonce },
      }));
    }
    const frames = dom.window.document.querySelectorAll('#artifact');
    expect(frames).toHaveLength(1);
    expect(frames[0].getAttribute('srcdoc')).toBe('<p>b</p>');
  });

  it('非 `render` 消息一律忽略（官方只认 `type === "render"`）', () => {
    const { dom, posted } = boot();
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { type: 'ping' } }));
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: null }));
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: 'render' }));
    expect(posted).toEqual([{ type: 'proxy-ready' }]);
    expect(dom.window.document.getElementById('artifact')).toBeNull();
  });
});
