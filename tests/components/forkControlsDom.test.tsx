// @vitest-environment jsdom
/**
 * fork 族两件控件的**逐字**回归（覆盖表 §6 #11）。
 *
 * 官方定义（`vendor-pkg-canvas-ChpWx5JY.js`）：
 *   · `JV`  @2583040 —— 「延续自原对话」分割线
 *   · `Xrt` @2581826 —— 「查看 / 收起之前的历史」折叠条
 *
 * 图标三步解析（canvas 本地名 → vendor-libs 导出名 → vendor-libs 本地名 → 真身）：
 *   · `Aue` → `l4` → `BY`  = `L("git-branch")`   = lucide **`git-branch`**（@547326）
 *   · `kue` → `l3` → `jK`  = `L("history")`      = lucide **`history`**（@567908）
 *   · `sx`  → `fD` → `LQ`  = `L("chevron-down")` = lucide **`chevron-down`**（@447929）
 *
 * i18n：官方 `chatAdapter.fork.{fromConversation,viewPreviousHistory,hidePreviousHistory}`，
 * 四语言逐字取自官方词典（zh @4229795 邻域 / en @3565510 / ja @3959364 / ko @4096555）。
 *
 * 验证分级 = **(b) jsdom 真 DOM + (c) SSR 串断言 + (d) 源码级逐字类串**。未做 (a) live CDP。
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ForkContinuationDivider from '../../src/components/chat/ForkContinuationDivider';
import PreviousHistoryToggle from '../../src/components/chat/PreviousHistoryToggle';
import { setLocale } from '../../src/i18n';

/* 官方 `JV` 逐字类串。 */
const JV_ROOT = 'flex w-full items-center gap-3 py-1.5 text-xs leading-4';
const JV_LINE_LEFT = 'h-px flex-1 bg-gradient-to-r from-transparent to-foreground/25';
const JV_LINE_RIGHT = 'h-px flex-1 bg-gradient-to-l from-transparent to-foreground/25';
const JV_BUTTON = 'inline-flex shrink-0 cursor-pointer items-center gap-1.5 hover:underline hover:decoration-[#90C4E5]';
/* 官方 `Xrt` 逐字类串。 */
const XRT_ROOT = 'flex w-full justify-center py-1';
const XRT_BUTTON = 'group flex cursor-pointer flex-col items-center';
const XRT_HANDLES = 'flex flex-col items-center gap-[3px] pb-[4px]';
const XRT_PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-transparent px-3 py-1 text-xs font-medium leading-4 text-foreground/50 transition-colors duration-200 group-hover:bg-foreground/[0.08] group-hover:text-foreground/80';

beforeEach(() => {
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
});

describe('ForkContinuationDivider —— 官方 `JV`（@2583040）', () => {
  it('根类串 + 左右渐隐线逐字', () => {
    const { container } = render(<ForkContinuationDivider />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe(JV_ROOT);
    const lines = root.querySelectorAll('span[aria-hidden="true"]');
    expect(lines).toHaveLength(2);
    expect(lines[0]?.className).toBe(JV_LINE_LEFT);
    expect(lines[1]?.className).toBe(JV_LINE_RIGHT);
  });

  it('按钮类串逐字 + 图标 = lucide `git-branch`（size 3.5 / strokeWidth 1.5 / text-foreground/70）', () => {
    const { container } = render(<ForkContinuationDivider />);
    const button = container.querySelector('button');
    expect(button?.className).toBe(JV_BUTTON);
    const svg = button?.querySelector('svg.lucide-git-branch');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('size-3.5 shrink-0 text-foreground/70');
    expect(svg?.getAttribute('stroke-width')).toBe('1.5');
  });

  it('文案 = 官方 key `chatAdapter.fork.fromConversation`，四语言各自取值（zh 逐字）', () => {
    const { container } = render(<ForkContinuationDivider />);
    expect(container.textContent).toContain('延续自原对话');
    const accent = container.querySelector('span.font-medium');
    expect(accent?.className).toBe('font-medium text-[#90C4E5]');

    setLocale('en-US');
    const en = renderToStaticMarkup(<ForkContinuationDivider />);
    expect(en).toContain('Continued from chat');
  });

  it('`onClick` 被调用（官方 `onClick:e`）', () => {
    const onClick = vi.fn();
    const { container } = render(<ForkContinuationDivider onClick={onClick} />);
    fireEvent.click(container.querySelector('button') as HTMLButtonElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('`className` 追加在官方根类串之后（官方 `z("…", className)`）', () => {
    const { container } = render(<ForkContinuationDivider className="mt-4" />);
    expect((container.firstElementChild as HTMLElement).className).toBe(`${JV_ROOT} mt-4`);
  });
});

describe('PreviousHistoryToggle —— 官方 `Xrt`（@2581826）', () => {
  it('折叠态：两条抓手 + 「查看之前的历史」，`aria-expanded=false`', () => {
    const { container } = render(<PreviousHistoryToggle collapsed onToggle={() => {}} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe(XRT_ROOT);
    const button = root.querySelector('button') as HTMLButtonElement;
    expect(button.className).toBe(XRT_BUTTON);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    const handles = root.querySelector(`span[aria-hidden="true"]`);
    expect(handles?.className).toBe(XRT_HANDLES);
    const bars = handles?.querySelectorAll('span') ?? [];
    expect(bars).toHaveLength(2);
    expect(bars[0]?.className).toBe('h-[3px] w-7 rounded-full bg-foreground/10 transition-transform duration-200 group-hover:-translate-y-[1.5px]');
    expect(bars[1]?.className).toBe('h-[3px] w-11 rounded-full bg-foreground/15 transition-transform duration-200 group-hover:-translate-y-[0.5px]');

    expect(container.textContent).toContain('查看之前的历史');
  });

  it('展开态：**不渲染**抓手、「收起之前的历史」，`aria-expanded=true`', () => {
    const { container } = render(<PreviousHistoryToggle collapsed={false} onToggle={() => {}} />);
    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
    expect((container.querySelector('button') as HTMLButtonElement).getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('收起之前的历史');
  });

  it('图标 = lucide `history`（3.5/1.5）+ `chevron-down`（3/1.5）；非折叠态 chevron 加 `rotate-180`', () => {
    const collapsedRender = render(<PreviousHistoryToggle collapsed onToggle={() => {}} />);
    const historyIcon = collapsedRender.container.querySelector('svg.lucide-history');
    expect(historyIcon?.getAttribute('class')).toContain('size-3.5 shrink-0');
    expect(historyIcon?.getAttribute('stroke-width')).toBe('1.5');
    const chevronCollapsed = collapsedRender.container.querySelector('svg.lucide-chevron-down');
    /* lucide 会在最前面拼 `lucide lucide-<name>`，官方那串接在其后。 */
    expect(chevronCollapsed?.getAttribute('class')).toContain('size-3 shrink-0 transition-transform duration-200');
    expect(chevronCollapsed?.getAttribute('class')).not.toContain('rotate-180');
    expect(chevronCollapsed?.getAttribute('stroke-width')).toBe('1.5');
    cleanup();

    const expanded = render(<PreviousHistoryToggle collapsed={false} onToggle={() => {}} />);
    const chevronExpanded = expanded.container.querySelector('svg.lucide-chevron-down');
    expect(chevronExpanded?.getAttribute('class')).toContain('size-3 shrink-0 transition-transform duration-200 rotate-180');
  });

  it('文字胶囊类串逐字 + `onToggle` 被调用', () => {
    const onToggle = vi.fn();
    const { container } = render(<PreviousHistoryToggle collapsed onToggle={onToggle} />);
    expect(container.querySelector('span.inline-flex')?.className).toBe(XRT_PILL);
    fireEvent.click(container.querySelector('button') as HTMLButtonElement);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
