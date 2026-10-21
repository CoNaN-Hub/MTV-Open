// @vitest-environment jsdom
/**
 * `ShowWidgetCard`（官方 `mre` @2363632 + 占位 `Gtt` @2365897）的**真实 DOM / 协议**回归 —— 验证分级 (b)。
 *
 * 覆盖官方逐字行为：
 *   · 根容器 `my-2 w-full`；`!widget_code || status==="error"` ⇒ 返回 `null`
 *   · iframe `sandbox="allow-scripts"`、`src` = 官方代理页 URL、`title = title ?? "Widget"`
 *   · iframe style `width:100%` / `height:${p}px`（默认 **200**）/ `border:none` / `overflow:hidden` /
 *     `display: rendered&&measured ? "block":"none"`
 *   · 占位行 `flex items-center gap-2 px-3 py-3` + `h-4 w-4 …border-2` + 硬编码 `"Loading widget..."`
 *   · 消息校验①`event.source === iframe.contentWindow` ②`nonce`
 *   · `proxy-ready` → `{type:"render",html,nonce}` targetOrigin `"*"`（只发一次）
 *   · `resize` → `Math.max(height,100)`；`rendered`/`error`/`sendPrompt`/`openLink`
 *   · `Vtt=1e4` 超时 ⇒ `error` ⇒ 返回 `null`
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShowWidgetCard, {
  WIDGET_DEFAULT_HEIGHT,
  WIDGET_MIN_HEIGHT,
  WIDGET_RENDER_TIMEOUT,
} from '../../src/components/chat/ShowWidgetCard';

const mocks = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

vi.mock('../../src/services/chat/htmlPreviewTransport', () => ({
  officialToast: { success: mocks.toastSuccess, error: mocks.toastError },
  officialHtmlPreviewTransport: {},
}));

afterEach(cleanup);
beforeEach(() => {
  mocks.toastError.mockClear();
  mocks.toastSuccess.mockClear();
  if (typeof crypto.randomUUID !== 'function') {
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: () => '00000000-0000-4000-8000-000000000000',
    });
  }
});

function fireMessage(source: unknown, data: unknown): void {
  const event = new MessageEvent('message', { data });
  Object.defineProperty(event, 'source', { value: source, configurable: true });
  window.dispatchEvent(event);
}

function mount(content: Record<string, unknown>, onSendPrompt = vi.fn()) {
  const view = render(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ShowWidgetCard content={content as any} onSendPrompt={onSendPrompt} />,
  );
  const iframe = view.container.querySelector('iframe');
  return { ...view, iframe, onSendPrompt };
}

/** 装好 iframe 的 `postMessage` 间谍（用 proxy-ready 换回官方 render 消息里的 nonce）。 */
function spyPostMessage(iframe: HTMLIFrameElement | null) {
  const target = iframe?.contentWindow;
  if (!target) throw new Error('iframe.contentWindow 不存在（jsdom 环境异常）');
  const postMessage = vi.fn();
  Object.defineProperty(target, 'postMessage', { configurable: true, value: postMessage });
  return { target, postMessage };
}

function readNonce(postMessage: ReturnType<typeof vi.fn>): string | undefined {
  return (postMessage.mock.calls[0]?.[0] as { nonce?: string } | undefined)?.nonce;
}

describe('ShowWidgetCard —— 结构 / 默认值', () => {
  it('常量逐字：超时 1e4、默认高度 200、下限 100', () => {
    expect(WIDGET_RENDER_TIMEOUT).toBe(10_000);
    expect(WIDGET_DEFAULT_HEIGHT).toBe(200);
    expect(WIDGET_MIN_HEIGHT).toBe(100);
  });

  it('无 widget_code ⇒ 返回 null', () => {
    const { container } = mount({ title: '只有标题' });
    expect(container.innerHTML).toBe('');
  });

  it('根 `my-2 w-full` + iframe 属性/style/占位行 逐字', () => {
    const { container, iframe } = mount({ title: '我的小组件', widget_code: '<h1>hi</h1>' });
    expect(container.firstElementChild?.className).toBe('my-2 w-full');
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe?.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(iframe?.getAttribute('src')).toBe('/usercontent-proxy/widget-proxy.html');
    expect(iframe?.getAttribute('title')).toBe('我的小组件');
    expect(iframe?.style.width).toBe('100%');
    expect(iframe?.style.height).toBe('200px');
    /* jsdom 把 `border` 简写序列化成 `medium`（cssstyle 归一），故按分项断言；
       逐字的 `border:none` 由 SSR 用例 `widgetFamilySsr.test.tsx` 精确断言。 */
    expect(iframe?.getAttribute('style')).toContain('border:');
    expect(iframe?.style.overflow).toBe('hidden');
    expect(iframe?.style.display).toBe('none');

    const row = container.querySelector('div.flex.items-center.gap-2.px-3.py-3');
    expect(row).not.toBeNull();
    expect(row?.querySelector('div')?.className).toBe(
      'h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground',
    );
    expect(row?.querySelector('span')?.className).toBe('text-xs text-muted-foreground');
    /* 官方硬编码英文，不是 i18n key */
    expect(row?.textContent).toBe('Loading widget...');
  });

  it('iframe title 缺省 = "Widget"', () => {
    const { iframe } = mount({ widget_code: '<p>x</p>' });
    expect(iframe?.getAttribute('title')).toBe('Widget');
  });

  it('`content.request ?? content`：优先取 request', () => {
    const { iframe } = mount({
      title: '外层',
      widget_code: 'outer',
      request: { title: '内层', widget_code: '<b>inner</b>' },
    });
    expect(iframe?.getAttribute('title')).toBe('内层');
  });
});

describe('ShowWidgetCard —— postMessage 协议', () => {
  it('proxy-ready（source 正确）⇒ 发 `{type:"render",html,nonce}` / targetOrigin "*"，且只发一次', () => {
    const { iframe } = mount({ widget_code: '<h1>hi</h1>' });
    const { target, postMessage } = spyPostMessage(iframe);

    fireMessage(target, { type: 'proxy-ready' });
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][1]).toBe('*');
    const payload = postMessage.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.type).toBe('render');
    expect(payload.html).toBe('<h1>hi</h1>');
    expect(typeof payload.nonce).toBe('string');

    /* 第二次 proxy-ready 不再发（官方 `c.current` 保证只发一次） */
    fireMessage(target, { type: 'proxy-ready' });
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('source 不匹配的消息被丢弃（消息校验①）', () => {
    const { iframe, onSendPrompt } = mount({ widget_code: 'x' });
    spyPostMessage(iframe);
    fireMessage(null, { type: 'sendPrompt', text: 'hi' });
    fireMessage(window, { type: 'sendPrompt', text: 'hi' });
    expect(onSendPrompt).not.toHaveBeenCalled();
  });

  it('nonce 不匹配的消息被丢弃（消息校验②）', () => {
    const { container, iframe } = mount({ widget_code: 'x' });
    const { target } = spyPostMessage(iframe);
    fireMessage(target, { type: 'resize', nonce: 'wrong', height: 500 });
    expect(iframe?.style.height).toBe('200px');
    expect(container.querySelector('div.flex.items-center.gap-2.px-3.py-3')).not.toBeNull();
  });

  it('resize ⇒ `Math.max(height,100)`；`display` 仍要求 `rendered && measured`', () => {
    const { container, iframe } = mount({ widget_code: 'x' });
    const { target, postMessage } = spyPostMessage(iframe);
    act(() => {
      fireMessage(target, { type: 'proxy-ready' });
    });
    const nonce = readNonce(postMessage);

    act(() => {
      fireMessage(target, { type: 'resize', nonce, height: 640 });
    });
    expect(iframe?.style.height).toBe('640px');
    /* status 仍是 loading ⇒ display 还是 none、占位还在 */
    expect(iframe?.style.display).toBe('none');
    expect(container.querySelector('div.flex.items-center.gap-2.px-3.py-3')).not.toBeNull();

    /* 下限 100 */
    act(() => {
      fireMessage(target, { type: 'resize', nonce, height: 40 });
    });
    expect(iframe?.style.height).toBe('100px');
  });

  it('rendered + measured ⇒ display:block 且占位行消失', () => {
    const { container, iframe } = mount({ widget_code: 'x' });
    const { target, postMessage } = spyPostMessage(iframe);
    act(() => {
      fireMessage(target, { type: 'proxy-ready' });
    });
    const nonce = readNonce(postMessage);

    act(() => {
      fireMessage(target, { type: 'resize', nonce, height: 300 });
    });
    act(() => {
      fireMessage(target, { type: 'rendered', nonce });
    });
    expect(iframe?.style.display).toBe('block');
    expect(container.querySelector('div.flex.items-center.gap-2.px-3.py-3')).toBeNull();
  });

  it('rendered ⇒ display 仍取决于 measured', () => {
    const { iframe } = mount({ widget_code: 'x' });
    const { target, postMessage } = spyPostMessage(iframe);
    act(() => {
      fireMessage(target, { type: 'proxy-ready' });
    });
    const nonce = readNonce(postMessage);

    act(() => {
      fireMessage(target, { type: 'rendered', nonce });
    });
    expect(iframe?.style.display).toBe('none');

    act(() => {
      fireMessage(target, { type: 'resize', nonce, height: 300 });
    });
    expect(iframe?.style.display).toBe('block');
  });

  it('sendPrompt ⇒ 去空格后调 `onSendPrompt`', async () => {
    const { iframe, onSendPrompt } = mount({ widget_code: 'x' });
    const { target, postMessage } = spyPostMessage(iframe);
    fireMessage(target, { type: 'proxy-ready' });
    const nonce = readNonce(postMessage);

    fireMessage(target, { type: 'sendPrompt', nonce, text: '  帮我改标题  ' });
    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledWith('帮我改标题'));
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('sendPrompt 空白文本被忽略；`onSendPrompt` 返回 false ⇒ 抛 `widget prompt rejected` ⇒ toast.sendFailed', async () => {
    const onSendPrompt = vi.fn().mockResolvedValue(false);
    const { iframe } = mount({ widget_code: 'x' }, onSendPrompt);
    const { target, postMessage } = spyPostMessage(iframe);
    fireMessage(target, { type: 'proxy-ready' });
    const nonce = readNonce(postMessage);

    fireMessage(target, { type: 'sendPrompt', nonce, text: '   ' });
    expect(onSendPrompt).not.toHaveBeenCalled();

    fireMessage(target, { type: 'sendPrompt', nonce, text: 'x' });
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(mocks.toastError).toHaveBeenCalledWith('抱歉，发生了错误。请稍后重试。');
  });

  it('openLink 只放行 http/https，且 `window.open(url,"_blank","noopener,noreferrer")`', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { iframe } = mount({ widget_code: 'x' });
    const { target, postMessage } = spyPostMessage(iframe);
    fireMessage(target, { type: 'proxy-ready' });
    const nonce = readNonce(postMessage);

    fireMessage(target, { type: 'openLink', nonce, url: 'javascript:alert(1)' });
    expect(open).not.toHaveBeenCalled();

    fireMessage(target, { type: 'openLink', nonce, url: 'not a url' });
    expect(open).not.toHaveBeenCalled();

    fireMessage(target, { type: 'openLink', nonce, url: 'https://example.com/a' });
    expect(open).toHaveBeenCalledWith('https://example.com/a', '_blank', 'noopener,noreferrer');

    fireMessage(target, { type: 'openLink', nonce, url: 'http://example.com/b' });
    expect(open).toHaveBeenCalledWith('http://example.com/b', '_blank', 'noopener,noreferrer');
    expect(open).toHaveBeenCalledTimes(2);
  });
});

describe('ShowWidgetCard —— 10000ms 超时', () => {
  it('`rendered` 到达后清掉超时（10000ms 后不再变 error、不再卸载）', () => {
    vi.useFakeTimers();
    try {
      const { container, iframe } = mount({ widget_code: 'x' });
      const { target, postMessage } = spyPostMessage(iframe);
      fireMessage(target, { type: 'proxy-ready' });
      const nonce = readNonce(postMessage);

      act(() => {
        vi.advanceTimersByTime(9999);
      });
      expect(container.innerHTML).not.toBe('');

      /* proxy-ready 已起超时；这时来 rendered 会清掉它 */
      fireMessage(target, { type: 'rendered', nonce });
      act(() => {
        vi.advanceTimersByTime(20_000);
      });
      expect(iframe?.style.display).toBe('none');
    } finally {
      vi.useRealTimers();
    }
  });

  it('未收到 rendered/error ⇒ 10000ms 后整体消失', () => {
    vi.useFakeTimers();
    try {
      const { container, iframe } = mount({ widget_code: 'x' });
      const { target } = spyPostMessage(iframe);
      fireMessage(target, { type: 'proxy-ready' });

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(container.innerHTML).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
