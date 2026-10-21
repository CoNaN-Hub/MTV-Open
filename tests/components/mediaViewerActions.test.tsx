import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * 官方依据：`Qge` @436707（条目）/ `e$` @434454（容器）/ `t$` @434773（按钮）
 *   · 容器：`flex items-center gap-1 rounded-[24px] bg-[oklch(20%_0.008_250)] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.32)]`
 *   · 按钮：`size-12 shrink-0 rounded-full border` + `text-[#F5F5F5]` + `transition-[border-color,box-shadow] duration-200`
 *     + `aria-label/aria-busy/aria-pressed/aria-disabled`；禁用时 `tabIndex=-1`
 *   · 条目：复制提示词（`imagePreview.copyPrompt`）/ 设为主图·当前主图 / 下载（busy 时换 loader-2 + `animate-spin`）
 *   · 全无（`if(!(o.copy&&v || o.download || g || y)) return null`）
 */
vi.mock('../../src/i18n', () => ({ useT: () => (message: string) => message }));

import MediaViewerActions from '../../src/components/nodes/shared/media/MediaViewerActions';

describe('media viewer actions bar markup (Qge / e$ / t$)', () => {
  it('returns nothing when no action is available', () => {
    expect(renderToStaticMarkup(<MediaViewerActions />)).toBe('');
    /* 只有空白提示词 ⇒ 复制项也不渲染 */
    expect(renderToStaticMarkup(<MediaViewerActions prompt="   " onCopyPrompt={() => {}} />)).toBe('');
  });

  it('renders the official container and button classes', () => {
    const html = renderToStaticMarkup(
      <MediaViewerActions prompt="一只猫" onCopyPrompt={() => {}} onDownload={() => {}} />,
    );
    expect(html).toContain('rounded-[24px] bg-[oklch(20%_0.008_250)] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.32)]');
    expect(html).toContain('relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border');
    expect(html).toContain('text-[#F5F5F5]');
    expect(html).toContain('transition-[border-color,box-shadow] duration-200');
    expect(html).toContain('aria-label="复制提示词"');
    expect(html).toContain('aria-label="下载"');
    /* 官方 lit 渐变 */
    expect(html).toContain('radial-gradient(ellipse 165.86% 163.75% at 50% 15%, #1A1A1A 0%, #282828 35.54%, #464847 67.77%, #656766 100%)');
  });

  it('labels the set-as-main action per current state and disables it when it IS the main', () => {
    const current = renderToStaticMarkup(
      <MediaViewerActions prompt="x" canSetAsMain isCurrentMain onSetAsMain={() => {}} />,
    );
    expect(current).toContain('aria-label="当前主图"');
    expect(current).toContain('aria-pressed="true"');
    expect(current).toContain('aria-disabled="true"');
    expect(current).toContain('tabindex="-1"');

    const notCurrent = renderToStaticMarkup(
      <MediaViewerActions prompt="x" canSetAsMain onSetAsMain={() => {}} />,
    );
    expect(notCurrent).toContain('aria-label="设为主图"');
    expect(notCurrent).not.toContain('aria-disabled="true"');
  });

  it('swaps the download icon for the official spinner while busy', () => {
    const idle = renderToStaticMarkup(<MediaViewerActions onDownload={() => {}} />);
    const busy = renderToStaticMarkup(<MediaViewerActions onDownload={() => {}} downloading />);
    expect(idle).not.toContain('animate-spin');
    expect(busy).toContain('animate-spin motion-reduce:animate-none');
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain('aria-disabled="true"');
  });
});
