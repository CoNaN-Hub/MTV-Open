// @vitest-environment jsdom
/**
 * `htmlPreview` 全屏预览器的**真实 DOM** 回归（jsdom + @testing-library/react）—— 验证分级 (b)。
 *
 * 覆盖官方 `mst` @2468555 / `Rge` @11315 / `HW` @10155：
 *   · portal 到 `document.body`、key 语义、`zIndex:80`、`duration:.2`
 *   · 加载态 / 失败态 + retry 计数 / ready 态三态切换
 *   · Esc 关闭（裸 `window` keydown）、右上关闭按钮（`X` size 15 / strokeWidth 1.5）
 *   · 左栏布局壳全部类串 + 品牌图远端 URL + 免责声明 + 下载/分享按钮
 *   · 分享链路：上传 `share-page.txt`（text/plain）→ `shareHtmlArtifact` → 复制 `${origin}/share/artifact/${token}`
 *   · `HW` sandbox iframe 协议：`proxy-ready` → `{type:"render"}` → `rendered`；`Pge=1e4` 超时 ⇒ `renderFailed`
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getCanvasArtifact: vi.fn(),
  getSharedPageByArtifact: vi.fn(),
  shareHtmlArtifact: vi.fn(),
  uploadSharePage: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../src/services/chat/htmlPreviewTransport', () => ({
  officialHtmlPreviewTransport: {
    getCanvasArtifact: api.getCanvasArtifact,
    getSharedPageByArtifact: api.getSharedPageByArtifact,
    shareHtmlArtifact: api.shareHtmlArtifact,
    uploadSharePage: api.uploadSharePage,
  },
  officialToast: { success: api.toastSuccess, error: api.toastError },
}));

import HtmlPreview, {
  HtmlPreviewShell,
  HtmlSandboxRenderer,
  HTML_PREVIEW_FADE_DURATION,
  HTML_PREVIEW_Z_INDEX,
  HTML_RENDER_TIMEOUT,
  OFFICIAL_TAPNOW_LOGO_URL,
} from '../../src/components/chat/HtmlPreview';

const target = {
  canvasId: 'canvas-1',
  artifactPath: 'pages/creative page.html',
  title: '我的页面',
  description: '页面描述',
};

afterEach(cleanup);

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.getCanvasArtifact.mockResolvedValue({ data: { artifact: { content: '<h1>hi</h1>' } } });
  api.getSharedPageByArtifact.mockResolvedValue({ data: {} });
  api.uploadSharePage.mockResolvedValue({ success: true, fileInfo: { file_id: 'file-1' } });
  api.shareHtmlArtifact.mockResolvedValue({ data: { token: 'tok-1' } });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  if (typeof crypto.randomUUID !== 'function') {
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: () => '00000000-0000-4000-8000-000000000000',
    });
  }
});

const renderPreview = (props: Partial<Parameters<typeof HtmlPreview>[0]> = {}) =>
  render(<HtmlPreview isOpen onClose={vi.fn()} target={target} {...props} />);

describe('htmlPreview —— 常量与三态', () => {
  it('常量逐字：Pge=1e4 / duration .2 / zIndex 80', () => {
    expect(HTML_RENDER_TIMEOUT).toBe(10_000);
    expect(HTML_PREVIEW_FADE_DURATION).toBe(0.2);
    expect(HTML_PREVIEW_Z_INDEX).toBe(80);
  });

  it('isOpen=false ⇒ portal 里什么都不渲染', () => {
    render(<HtmlPreview isOpen={false} onClose={vi.fn()} target={target} />);
    expect(screen.queryByLabelText('HTML 预览')).toBeNull();
  });

  it('target=null ⇒ 什么都不渲染（官方 `e&&n`）', () => {
    render(<HtmlPreview isOpen onClose={vi.fn()} target={null} />);
    expect(screen.queryByLabelText('HTML 预览')).toBeNull();
  });

  it('加载态：根容器类串 + zIndex + `HTML 预览` aria-label + 加载中…', () => {
    api.getCanvasArtifact.mockReturnValue(new Promise(() => {}));
    renderPreview();

    const root = screen.getByLabelText('HTML 预览');
    expect(root.className).toBe('fixed inset-0 overflow-hidden bg-chat-background');
    expect((root as HTMLElement).style.zIndex).toBe('80');
    expect(root.getAttribute('data-projection-id')).toBeNull();
    expect(root.querySelector('div')?.className).toBe(
      'flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground',
    );
    expect(screen.getByText('加载中…')).not.toBeNull();
  });

  it('右上关闭按钮：类串 + `关闭预览` aria-label + X(15/1.5)', () => {
    api.getCanvasArtifact.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    renderPreview({ onClose });

    const close = screen.getByLabelText('关闭预览');
    expect(close.className).toBe(
      'absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/30 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-white/[0.12] hover:text-foreground/95',
    );
    const svg = close.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('15');
    expect(svg?.getAttribute('height')).toBe('15');
    expect(svg?.getAttribute('stroke-width')).toBe('1.5');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc 关闭（裸 window keydown，不区分 target）', () => {
    api.getCanvasArtifact.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    renderPreview({ onClose });

    fireEvent.keyDown(window, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('失败态：`预览加载失败` + retry 按钮类串；点击后 retry 计数递增并重新拉取', async () => {
    api.getCanvasArtifact.mockRejectedValueOnce(new Error('boom'));
    renderPreview();

    await waitFor(() => expect(screen.getByText('预览加载失败')).not.toBeNull());
    expect(api.getCanvasArtifact).toHaveBeenCalledWith({
      canvas_id: 'canvas-1',
      artifact_path: 'pages/creative page.html',
    });

    const retry = screen.getByText('重试');
    expect(retry.className).toBe(
      'inline-flex h-7 items-center justify-center rounded-md px-3 text-xs text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground/95',
    );
    fireEvent.click(retry);
    await waitFor(() => expect(api.getCanvasArtifact).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('预览加载失败')).toBeNull());
    expect(screen.getByText('我的页面')).not.toBeNull();
  });
});

describe('htmlPreview —— ready 态（mst + Rge + HW）', () => {
  it('左栏布局壳类串 / 品牌图 / 免责声明 逐字', async () => {
    renderPreview();
    await waitFor(() => expect(screen.getByText('我的页面')).not.toBeNull());

    const shell = screen.getByText('TapNow').closest('div') as HTMLElement;
    expect(shell.className).toBe('flex items-center gap-2.5 text-foreground/90');
    const logo = shell.querySelector('img');
    expect(logo?.getAttribute('src')).toBe(OFFICIAL_TAPNOW_LOGO_URL);
    expect(OFFICIAL_TAPNOW_LOGO_URL).toBe(
      'https://fe-assets.tapnow.media/0a8da41c37db9507b96c3dc55fb843278f7127e5/assets/tap_logo-B_K5uv9E.svg',
    );
    expect(logo?.getAttribute('alt')).toBe('TapNow');
    expect(logo?.className).toBe('h-11 w-11 opacity-90');
    expect(screen.getByText('TapNow').className).toBe('text-base font-semibold');

    const leftColumn = shell.parentElement as HTMLElement;
    expect(leftColumn.className).toBe(
      'flex w-1/4 min-w-[220px] max-w-[360px] shrink-0 flex-col gap-9 overflow-y-auto border-r border-white/[0.06] px-6 pt-6 pb-7',
    );

    const heading = screen.getByText('我的页面');
    expect(heading.tagName).toBe('H3');
    expect(heading.className).toBe('text-base font-semibold leading-snug text-foreground/95');

    const description = screen.getByText('页面描述');
    expect(description.tagName).toBe('P');
    expect(description.className).toBe('text-[13px] leading-relaxed text-muted-foreground');

    const disclaimer = screen.getByText(
      '本页内容由用户借助 AI 生成，可能存在不准确之处，请自行甄别。相关内容与观点均与 TapNow 平台无关。',
    );
    expect(disclaimer.className).toBe(
      'border-t border-white/[0.06] pt-6 text-[12px] leading-relaxed text-muted-foreground/70',
    );
  });

  it('HW 沙箱 iframe：`artifact-proxy.html` + sandbox allow-scripts + 类串逐字', async () => {
    renderPreview();
    await waitFor(() => expect(screen.getByText('我的页面')).not.toBeNull());

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('/usercontent-proxy/artifact-proxy.html');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(iframe.getAttribute('title')).toBe('我的页面');
    expect(iframe.className).toBe('h-full w-full bg-chat-background');
    /* HW 外层 `z("relative", className)` */
    expect(iframe.parentElement?.className).toBe('relative h-full w-full flex-1');
    expect(iframe.parentElement?.parentElement?.className).toBe(
      'flex h-full w-full overflow-hidden',
    );
  });

  it('左栏底部操作列：下载 HTML 按钮类串 + Download(14/1.6) + 分享按钮类串 + Share2(14/1.6)', async () => {
    renderPreview();
    await waitFor(() => expect(screen.getByText('我的页面')).not.toBeNull());

    const download = screen.getByText('下载 HTML');
    expect(download.tagName).toBe('BUTTON');
    expect(download.className).toBe(
      'flex w-full items-center justify-center gap-1.5 rounded-md bg-white/[0.06] px-3 py-2 text-[13px] font-medium text-foreground/85 transition-colors hover:bg-white/[0.12]',
    );
    const downloadIcon = download.querySelector('svg');
    expect(downloadIcon?.getAttribute('width')).toBe('14');
    expect(downloadIcon?.getAttribute('stroke-width')).toBe('1.6');

    const share = screen.getByText('分享此页面');
    expect(share.className).toBe(
      'flex w-full items-center justify-center gap-1.5 rounded-md bg-white/[0.06] px-3 py-2 text-[13px] font-medium text-foreground/85 transition-colors hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60',
    );
    const shareIcon = share.querySelector('svg');
    expect(shareIcon?.getAttribute('width')).toBe('14');
    expect(shareIcon?.getAttribute('stroke-width')).toBe('1.6');

    expect((download.parentElement as HTMLElement).className).toBe('flex flex-col gap-3');
    expect((download.parentElement?.parentElement as HTMLElement).className).toBe(
      'mt-auto pt-4 pb-6',
    );
  });

  it('描述缺省时**不**渲染描述 p（官方 `t?…:null`）', async () => {
    renderPreview({ target: { ...target, description: undefined } });
    await waitFor(() => expect(screen.getByText('我的页面')).not.toBeNull());
    expect(screen.queryByText('页面描述')).toBeNull();
  });

  it('下载：`<a download>` 文件名来自 artifactPath 末段', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    let downloaded: string | null = null;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = this.download;
      });

    renderPreview();
    await waitFor(() => expect(screen.getByText('我的页面')).not.toBeNull());
    fireEvent.click(screen.getByText('下载 HTML'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(downloaded).toBe('creative page.html');
    expect(api.toastError).not.toHaveBeenCalled();
  });

  it('分享成功：上传 `share-page.txt`（text/plain）→ shareHtmlArtifact → 复制 `${origin}/share/artifact/tok-1`', async () => {
    renderPreview();
    await waitFor(() => expect(screen.getByText('我的页面')).not.toBeNull());
    fireEvent.click(screen.getByText('分享此页面'));

    await waitFor(() => expect(api.uploadSharePage).toHaveBeenCalledTimes(1));
    const file = api.uploadSharePage.mock.calls[0][0] as File;
    expect(file.name).toBe('share-page.txt');
    expect(file.type).toBe('text/plain');
    expect(await file.text()).toBe('<h1>hi</h1>');

    expect(api.shareHtmlArtifact).toHaveBeenCalledWith({
      file_id: 'file-1',
      title: '我的页面',
      description: '页面描述',
      canvas_id: 'canvas-1',
      source_artifact_path: 'pages/creative page.html',
    });

    await waitFor(() => expect(screen.getByText('分享链接')).not.toBeNull());
    const input = document.querySelector('input') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe(`${window.location.origin}/share/artifact/tok-1`);
    expect(input.className).toBe(
      'min-w-0 flex-1 rounded-md bg-white/[0.06] px-2.5 py-2 text-[12px] text-foreground/85 outline-none',
    );
    expect(screen.getByText('分享链接').className).toBe('text-[12px] text-muted-foreground');

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/share/artifact/tok-1`,
      ),
    );
    expect(api.toastSuccess).toHaveBeenCalledWith('分享链接已复制');
    /* 分享成功后分享按钮被链接块替换 */
    expect(screen.queryByText('分享此页面')).toBeNull();
  });

  it('分享失败（上传 success=false）⇒ toast `分享失败`', async () => {
    api.uploadSharePage.mockResolvedValue({ success: false });
    renderPreview();
    await waitFor(() => expect(screen.getByText('我的页面')).not.toBeNull());
    fireEvent.click(screen.getByText('分享此页面'));

    await waitFor(() => expect(api.toastError).toHaveBeenCalledWith('分享失败'));
    expect(api.shareHtmlArtifact).not.toHaveBeenCalled();
  });

  it('分享失败（token 缺失）⇒ toast `分享失败`', async () => {
    api.shareHtmlArtifact.mockResolvedValue({ data: {} });
    renderPreview();
    await waitFor(() => expect(screen.getByText('我的页面')).not.toBeNull());
    fireEvent.click(screen.getByText('分享此页面'));

    await waitFor(() => expect(api.toastError).toHaveBeenCalledWith('分享失败'));
    expect(api.toastSuccess).not.toHaveBeenCalled();
  });
});

describe('HtmlPreviewShell（官方 `Rge`）', () => {
  it('className 参与 `z("flex h-full w-full overflow-hidden", className)` 合并', () => {
    const { container } = render(
      <HtmlPreviewShell title="T" description="D" html="<p/>" className="extra-class" />,
    );
    expect(container.firstElementChild?.className).toBe(
      'flex h-full w-full overflow-hidden extra-class',
    );
  });
});

describe('HtmlSandboxRenderer（官方 `HW`）—— 协议与超时', () => {
  it('`proxy-ready` ⇒ 回 `{type:"render",html,nonce}` targetOrigin "*"；`rendered`（nonce 对）⇒ 无失败遮罩', () => {
    const { container } = render(<HtmlSandboxRenderer html="<h1>hi</h1>" title="T" />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const win = iframe.contentWindow as Window;
    const postMessage = vi.fn();
    Object.defineProperty(win, 'postMessage', { configurable: true, value: postMessage });

    const send = (data: unknown) => {
      const event = new MessageEvent('message', { data });
      Object.defineProperty(event, 'source', { value: win, configurable: true });
      act(() => {
        window.dispatchEvent(event);
      });
    };

    send({ type: 'proxy-ready' });
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][1]).toBe('*');
    const payload = postMessage.mock.calls[0][0] as { type: string; html: string; nonce: string };
    expect(payload.type).toBe('render');
    expect(payload.html).toBe('<h1>hi</h1>');

    send({ type: 'rendered', nonce: payload.nonce });
    expect(container.textContent).toBe('');

    /* nonce 不匹配的 rendered 被忽略（但此时已是 rendered，遮罩仍不出现） */
    send({ type: 'rendered', nonce: 'wrong' });
    expect(container.textContent).toBe('');
  });

  it('`Pge=1e4` 超时 ⇒ `renderFailed` 遮罩（`pointer-events-none absolute inset-0 …`）', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<HtmlSandboxRenderer html="<h1>hi</h1>" title="T" />);
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      const win = iframe.contentWindow as Window;
      Object.defineProperty(win, 'postMessage', { configurable: true, value: vi.fn() });

      const event = new MessageEvent('message', { data: { type: 'proxy-ready' } });
      Object.defineProperty(event, 'source', { value: win, configurable: true });
      act(() => {
        window.dispatchEvent(event);
      });

      act(() => {
        vi.advanceTimersByTime(9_999);
      });
      expect(container.textContent).toBe('');

      act(() => {
        vi.advanceTimersByTime(1);
      });
      const overlay = container.querySelector('div.pointer-events-none') as HTMLElement;
      expect(overlay.className).toBe(
        'pointer-events-none absolute inset-0 flex items-center justify-center bg-chat-background/80 text-xs text-muted-foreground',
      );
      expect(overlay.textContent).toBe('渲染失败');
    } finally {
      vi.useRealTimers();
    }
  });
});
