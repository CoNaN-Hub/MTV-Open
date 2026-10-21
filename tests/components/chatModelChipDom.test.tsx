// @vitest-environment jsdom
/**
 * `ChatModelChip`（官方聊天输入条的模型胶囊 `Ae`）—— 与 **live CDP 9222 实测 outerHTML** 对齐的回归。
 *
 * live 实测（`_live_chips.txt`）关键片段：
 * ```
 * <button type="button" class="flex h-[26px] min-w-[26px] items-center overflow-hidden rounded-md
 *   max-w-[188px] shrink-0 px-2 sm:max-w-[228px] bg-transparent text-text-text-primary
 *   transition-[max-width,padding,background-color] duration-150 ease-out motion-reduce:transition-none
 *   cursor-pointer hover:bg-accent disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent
 *   focus:outline-none focus-visible:outline-none" aria-haspopup="menu" aria-expanded="false"
 *   data-state="closed" data-slot="dropdown-menu-trigger">
 *   <span class="flex size-4 shrink-0 items-center justify-center"><img … class="size-[17px] object-contain"></span>
 *   <span aria-hidden="false" data-adaptive-control-content="model"
 *     class="grid min-w-0 transition-[grid-template-columns,opacity,margin] duration-150 ease-out motion-reduce:transition-none grid-cols-[1fr] opacity-100 ml-1">
 *     <span class="flex min-w-0 items-center overflow-hidden whitespace-nowrap">
 *       <span class="min-w-0 truncate text-xs font-medium leading-5">TapNow G-6 L</span>
 *       <span class="ml-1 shrink-0 border-l border-border/60 pl-1.5 text-[11px] leading-4 text-text-text-secondary">中</span>
 *       <svg … class="tabler-icon tabler-icon-chevron-down ml-1 shrink-0 transition-transform duration-150 motion-reduce:transition-none"><path d="M6 9l6 6l6 -6"></path></svg>
 * ```
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChatModelChip from '../../src/components/chat/ChatModelChip';
import { modelProviderIconClass } from '../../src/components/chat/modelProviderIcon';

afterEach(cleanup);

const CHIP_CLASS = 'flex h-[26px] min-w-[26px] items-center overflow-hidden rounded-md max-w-[188px] shrink-0 px-2 sm:max-w-[228px] bg-transparent text-text-text-primary transition-[max-width,padding,background-color] duration-150 ease-out motion-reduce:transition-none cursor-pointer hover:bg-accent disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent focus:outline-none focus-visible:outline-none';

describe('ChatModelChip —— 官方 Ae 的触发胶囊', () => {
  it('默认态：按钮类串逐字（与 live outerHTML 同序同值）+ Radix Trigger 的四个属性', () => {
    const { container } = render(<ChatModelChip label="Auto" ariaLabel="Auto" />);
    const button = container.querySelector('button')!;
    expect(button.getAttribute('class')).toBe(CHIP_CLASS);
    expect(button.getAttribute('data-slot')).toBe('dropdown-menu-trigger');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('data-state')).toBe('closed');
  });

  it('默认态显示 `Auto` + **chevron-down**（live 实测：`tabler-icon-chevron-down ml-1 …` + `M6 9l6 6l6 -6`）', () => {
    const { container } = render(<ChatModelChip label="Auto" />);
    const label = container.querySelector('[data-adaptive-control-content="model"] span span')!;
    expect(label.textContent).toBe('Auto');
    const chevron = container.querySelector('svg.tabler-icon-chevron-down')!;
    expect(chevron).not.toBeNull();
    expect(chevron.getAttribute('class')).toContain('ml-1 shrink-0 transition-transform duration-150 motion-reduce:transition-none');
    expect(chevron.getAttribute('width')).toBe('14');
    expect(chevron.getAttribute('stroke-width')).toBe('1.5');
    expect(chevron.querySelector('path')!.getAttribute('d')).toBe('M6 9l6 6l6 -6');
    expect(chevron.getAttribute('class')).not.toContain('rotate-180');
  });

  it('打开态箭头 `rotate-180`（官方 `N && "rotate-180"`）', () => {
    const { container } = render(<ChatModelChip label="Auto" open />);
    expect(container.querySelector('svg.tabler-icon-chevron-down')!.getAttribute('class')).toContain('rotate-180');
    expect(container.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('button')!.getAttribute('data-state')).toBe('open');
  });

  it('品牌图走官方「`span.flex.size-4` > img」分支，且 `data-adaptive-control-content` 多一个 `ml-1`', () => {
    const { container } = render(
      <ChatModelChip label="TapNow G-6 L" icon={<img src="x.svg" alt="" aria-hidden="true" className={modelProviderIconClass('openai-gpt', 'GPT')} />} secondary="中" />,
    );
    const iconWrapper = container.querySelector('span.flex.size-4.shrink-0.items-center.justify-center')!;
    expect(iconWrapper).not.toBeNull();
    /* 官方 `mq(openai…)` = `size-[17px] object-contain`。 */
    expect(iconWrapper.querySelector('img')!.getAttribute('class')).toBe('size-[17px] object-contain');
    const content = container.querySelector('[data-adaptive-control-content="model"]')!;
    expect(content.getAttribute('class')).toContain('grid-cols-[1fr] opacity-100 ml-1');
    expect(container.querySelector('span.ml-1.shrink-0.border-l')!.textContent).toBe('中');
  });

  it('没有品牌图时渲染官方那个 `w-0 opacity-0` 的占位图标槽（不挤占宽度）', () => {
    const { container } = render(<ChatModelChip label="Auto" />);
    const slot = container.querySelector('[data-compact-control-icon="model"]')!;
    expect(slot.getAttribute('class')).toContain('w-0 opacity-0');
    expect(container.querySelector('[data-adaptive-control-content="model"]')!.getAttribute('class')).toContain('grid-cols-[1fr] opacity-100 ml-0');
  });

  it('`iconOnly`（官方 `n`）⇒ 类串切到 `max-w-[26px] justify-center px-[5px]`、标签块 `grid-cols-[0fr] opacity-0 ml-0`、`data-icon-only="true"`', () => {
    const { container } = render(<ChatModelChip label="Auto" iconOnly />);
    const button = container.querySelector('button')!;
    expect(button.getAttribute('class')).toContain('max-w-[26px] shrink-0 justify-center px-[5px]');
    expect(button.getAttribute('class')).not.toContain('max-w-[188px]');
    expect(button.getAttribute('data-icon-only')).toBe('true');
    expect(container.querySelector('[data-adaptive-control-content="model"]')!.getAttribute('class')).toContain('ml-0 grid-cols-[0fr] opacity-0');
    expect(container.querySelector('[data-compact-control-icon="model"]')!.getAttribute('class')).toContain('w-4 opacity-100');
  });

  it('`disabled`（官方 `V`）：不渲染箭头且类串走 `cursor-default`', () => {
    const { container } = render(<ChatModelChip label="Auto" disabled />);
    expect(container.querySelector('button')!.getAttribute('class')).toContain('cursor-default');
    expect(container.querySelector('button')!.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('svg.tabler-icon-chevron-down')).toBeNull();
  });

  it('`loading`（官方 `Y`）⇒ 渲染官方骨架条（`animate-pulse rounded-md bg-input/30 h-4 w-20`）', () => {
    const { container } = render(<ChatModelChip label="Auto" loading />);
    const skeleton = container.querySelector('span.animate-pulse')!;
    expect(skeleton.getAttribute('class')).toContain('rounded-md bg-input/30 h-4');
    expect(skeleton.getAttribute('class')).toContain('w-20');
    expect(container.querySelector('[data-adaptive-control-content="model"]')).toBeNull();
  });

  it('`errorIcon`（官方 `q` 的 model-error 变体）⇒ `data-adaptive-control-content="model-error"`', () => {
    const { container } = render(<ChatModelChip label="Auto" errorIcon={<span data-x="" />} />);
    expect(container.querySelector('[data-adaptive-control-content="model-error"]')).not.toBeNull();
    expect(container.querySelector('[data-adaptive-control-content="model"]')).toBeNull();
    expect(container.querySelector('svg.tabler-icon-chevron-down')).toBeNull();
  });

  it('`modelProviderIconClass` 逐字实现官方 `mq`', () => {
    expect(modelProviderIconClass('claude-sonnet', 'Claude')).toBe('size-[14px] object-contain');
    expect(modelProviderIconClass('x', 'Anthropic Opus')).toBe('size-[14px] object-contain');
    expect(modelProviderIconClass('openai', 'GPT')).toBe('size-[17px] object-contain');
    expect(modelProviderIconClass('x', 'gpt-5')).toBe('size-[17px] object-contain');
    expect(modelProviderIconClass('kimi-k2', 'Kimi')).toBe('size-[15px] object-contain');
    expect(modelProviderIconClass('moonshot', 'X')).toBe('size-[15px] object-contain');
    expect(modelProviderIconClass('qwen', 'Qwen')).toBe('size-4 object-contain');
  });
});
