// @vitest-environment jsdom
/**
 * `widgetCardUtils` —— 官方 `ust`（@2467914）/ `pst`（@2468224）/ `RI`（@2468479）三个 helper
 * 与 className 合并器 `z` 的**逐字**回归 —— 验证分级 (b) 真 DOM + (d) 源码级。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildHtmlDownloadPayload,
  downloadHtmlArtifact,
  HTML_DOWNLOAD_OBJECT_URL_REVOKE_DELAY,
  officialCx,
  shareArtifactUrl,
} from '../../src/components/chat/widgetCardUtils';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('officialCx（官方 `z` = classnames，widget 族只用到两种调用形状）', () => {
  it('过滤 falsy 后单空格连接', () => {
    expect(officialCx('relative', undefined)).toBe('relative');
    expect(officialCx('flex h-full w-full overflow-hidden', 'h-full w-full flex-1')).toBe(
      'flex h-full w-full overflow-hidden h-full w-full flex-1',
    );
    expect(officialCx('a', false, null, undefined, 'b')).toBe('a b');
  });
});

describe('buildHtmlDownloadPayload（官方 `ust`）', () => {
  it('取最后一段 + 去 `.html/.htm` + 追加 `.html`', () => {
    expect(buildHtmlDownloadPayload('<p/>', 'pages/a.html').filename).toBe('a.html');
    expect(buildHtmlDownloadPayload('<p/>', 'pages/a.htm').filename).toBe('a.html');
    expect(buildHtmlDownloadPayload('<p/>', 'C:\\canvas\\artifacts\\page.HTML').filename).toBe(
      'page.html',
    );
  });

  it('非法字符 `<>:"/\\|?*` ⇒ `_`；控制字符（\\p{Cc}）⇒ `_`', () => {
    expect(buildHtmlDownloadPayload('x', 'a<b>c:"d.html').filename).toBe('a_b_c__d.html');
    expect(buildHtmlDownloadPayload('x', 'a\u0001b\u007fc.html').filename).toBe('a_b_c.html');
  });

  it('去首尾点 + trim；空 ⇒ `creative-page`', () => {
    expect(buildHtmlDownloadPayload('x', '...name...html').filename).toBe('name.html');
    expect(buildHtmlDownloadPayload('x', '   spaced   .html').filename).toBe('spaced.html');
    expect(buildHtmlDownloadPayload('x', '/').filename).toBe('creative-page.html');
  });

  it('按**码点**截断 120（不是 UTF-16 单元）', () => {
    const long = 'a'.repeat(130);
    expect(buildHtmlDownloadPayload('x', `${long}.html`).filename).toBe(`${'a'.repeat(120)}.html`);

    const astral = '𝄞'.repeat(130); // 每个字符 2 个 UTF-16 单元
    const payload = buildHtmlDownloadPayload('x', `${astral}.html`);
    expect(Array.from(payload.filename.replace(/\.html$/, ''))).toHaveLength(120);
  });

  it('Blob MIME 逐字 `text/html;charset=utf-8`', async () => {
    const { blob } = buildHtmlDownloadPayload('<h1>hi</h1>', 'a.html');
    expect(blob.type).toBe('text/html;charset=utf-8');
    expect(await blob.text()).toBe('<h1>hi</h1>');
  });
});

describe('downloadHtmlArtifact（官方 `pst`）', () => {
  it('`<a download hidden>` + `click()` + `remove()`，并在 60000ms 后 revoke', async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:official');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    let clickedDownload: string | null = null;
    let clickedHidden = false;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedDownload = this.download;
        clickedHidden = this.hidden;
      });

    downloadHtmlArtifact('<h1>hi</h1>', 'dir/page.html');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(clickedDownload).toBe('page.html');
    expect(clickedHidden).toBe(true);
    /* 点击后 anchor 已从 DOM 移除 */
    expect(document.querySelector('a[download]')).toBeNull();
    /* revoke 延时逐字 6e4 */
    expect(HTML_DOWNLOAD_OBJECT_URL_REVOKE_DELAY).toBe(60_000);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:official');
  });
});

describe('shareArtifactUrl（官方 `RI`）', () => {
  it('`${origin}/share/artifact/${token}`', () => {
    expect(shareArtifactUrl('tok-1')).toBe(`${window.location.origin}/share/artifact/tok-1`);
  });
});
