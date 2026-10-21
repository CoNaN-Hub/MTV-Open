// @vitest-environment jsdom
/**
 * 官方 `Wae`（`ToolLoadingIndicator` 的专属图标表）回归。
 *
 * 官方逐字（`page-BeI7xydN.js`@678060 邻域；`$M` @2426950 的 `jD` 分支把 `pending`/`started` 的
 * `show_form` 送到 `<HM toolName="show_form"/>`）：
 * ```js
 * Wae = { show_form: m4 }        // 只有 show_form 有专属图标，其余退回 An = tabler loader-2
 * ```
 * `m4` 的逐字身份 = **Tabler `forms`**（`live-提问表单族.md`）。
 *
 * 验证分级 = **(b) jsdom 真 DOM + (d) 源码级**。未做 (a) live CDP。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ToolLoadingIndicator from '../../src/components/chat/ToolLoadingIndicator';
import { setLocale } from '../../src/i18n';

beforeEach(() => {
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
});

describe('ToolLoadingIndicator —— 官方 `Wae = { show_form: m4 }`', () => {
  it('`show_form` 用官方专属图标（`tabler-icon tabler-icon-forms`，不是 loader-2）', () => {
    const { container } = render(<ToolLoadingIndicator toolName="show_form" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('tabler-icon-forms');
    expect(svg?.getAttribute('class')).toContain('tool-call-status-icon-active');
    expect(svg?.getAttribute('class')).toContain('size-4 shrink-0 text-muted-foreground/80');
    /* 官方 `An` 的转圈类串**不应**出现在专属图标上。 */
    expect(svg?.getAttribute('class')).not.toContain('animate-spin');
  });

  it('其余工具退回官方 `An` = tabler `loader-2`（转圈）', () => {
    const { container } = render(<ToolLoadingIndicator toolName="canvas_query" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('tabler-icon-loader-2');
    expect(svg?.getAttribute('class')).toContain('animate-spin');
  });

  it('根容器是官方那串（`my-1 inline-flex … leading-[1.65]`）', () => {
    const { container } = render(<ToolLoadingIndicator toolName="show_form" />);
    expect((container.firstElementChild as HTMLElement).className).toBe(
      'my-1 inline-flex max-w-full items-center gap-2 py-0.5 text-[13px] font-normal leading-[1.65]',
    );
  });
});
