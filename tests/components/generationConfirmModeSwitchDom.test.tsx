// @vitest-environment jsdom
/**
 * `GenerationConfirmModeSwitch`（官方 `GenerationConfirmModeSwitch`，canvas @183023）回归。
 *
 * 官方逐字（触发钮内部）：
 * ```jsx
 * <span aria-hidden={n} data-adaptive-control-content="confirm-mode"
 *   className={cx("grid min-w-0 transition-[grid-template-columns,opacity,margin] duration-150 ease-out motion-reduce:transition-none",
 *                 n ? "ml-0 grid-cols-[0fr] opacity-0" : "ml-1.5 grid-cols-[1fr] opacity-100")}>
 *   <span className="flex min-w-0 items-center overflow-hidden whitespace-nowrap">
 *     <span>{t(w.labelKey)}</span>
 *     <sx size={12} strokeWidth={1.5}
 *         className={cx("ml-2.5 aspect-square size-3 shrink-0 text-white/40 transition-transform duration-150 motion-reduce:transition-none",
 *                       open && "rotate-180")}/>
 * ```
 * ⚠️ 用户实测指出的两个坑（本测试锁住，防止回归）：
 *   1. 箭头必须是 **Tabler `chevron-down`（24 视框）**；此前 MTV 自造 `viewBox="0 0 16 16"` 却塞 24 视框的
 *      path ⇒ 箭头被裁切错位。
 *   2. 两态的**字形与文案**不能搞反：`collaborative` = ✋ + `chatAdapter.confirmMode.ask`；
 *      `autonomous` = ↺ + `chatAdapter.confirmMode.auto`。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GenerationConfirmModeSwitch from '../../src/components/chat/GenerationConfirmModeSwitch';

afterEach(cleanup);

const CHEVRON_PATH = 'M6 9l6 6l6 -6';
/* 官方 `kl`（ask）与 `Sl`（auto）两个字形 path 的开头（判别用）。 */
const ASK_PATH_PREFIX = 'M3.83328 4.33301';
const AUTO_PATH_PREFIX = 'M13.8176 4.87041';

const renderSwitch = (mode: 'collaborative' | 'autonomous', iconOnly = false) => {
  const { container } = render(
    <GenerationConfirmModeSwitch mode={mode} onChange={vi.fn()} iconOnly={iconOnly} />,
  );
  return container;
};

describe('GenerationConfirmModeSwitch —— 官方两态与箭头', () => {
  it('`collaborative` ⇒ 文案「手动确认」+ ✋ 字形（官方 `kl`）', () => {
    const container = renderSwitch('collaborative');
    expect(screen.getByTestId('generation-confirm-mode-switch').textContent).toContain('手动确认');
    const glyph = container.querySelector('button > svg')!;
    expect(glyph.querySelector('path')!.getAttribute('d')).toContain(ASK_PATH_PREFIX);
    expect(glyph.getAttribute('viewBox')).toBe('0 0 16 16');
  });

  it('`autonomous` ⇒ 文案「自动生成」+ ↺ 字形（官方 `Sl`，描边而非填充）', () => {
    const container = renderSwitch('autonomous');
    expect(screen.getByTestId('generation-confirm-mode-switch').textContent).toContain('自动生成');
    const glyph = container.querySelector('button > svg')!;
    expect(glyph.querySelector('path')!.getAttribute('d')).toContain(AUTO_PATH_PREFIX);
    expect(glyph.querySelector('path')!.getAttribute('stroke')).toBe('currentColor');
  });

  it('箭头是官方 `sx`（Tabler chevron-down：24 视框 + `M6 9l6 6l6 -6` + 12×12 + strokeWidth 1.5）', () => {
    const container = renderSwitch('collaborative');
    const chevron = container.querySelector('svg.tabler-icon-chevron-down')!;
    expect(chevron).not.toBeNull();
    expect(chevron.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(chevron.getAttribute('width')).toBe('12');
    expect(chevron.getAttribute('height')).toBe('12');
    expect(chevron.getAttribute('stroke-width')).toBe('1.5');
    expect(chevron.querySelector('path')!.getAttribute('d')).toBe(CHEVRON_PATH);
    expect(chevron.getAttribute('class')).toContain('ml-2.5 aspect-square size-3 shrink-0 text-white/40');
    expect(chevron.getAttribute('class')).not.toContain('rotate-180');
  });

  it('打开菜单后箭头 `rotate-180`，并渲染官方两行菜单项', () => {
    const container = renderSwitch('collaborative');
    fireEvent.click(screen.getByTestId('generation-confirm-mode-switch'));
    expect(container.querySelector('svg.tabler-icon-chevron-down')!.getAttribute('class')).toContain('rotate-180');
    expect(screen.getByTestId('generation-confirm-mode-menu')).not.toBeNull();
    expect(screen.getByTestId('generation-confirm-mode-ask')).not.toBeNull();
    expect(screen.getByTestId('generation-confirm-mode-auto')).not.toBeNull();
    /* 当前态那一行有勾（官方 `qo` = lucide check）。 */
    expect(screen.getByTestId('generation-confirm-mode-ask').querySelectorAll('svg').length).toBeGreaterThan(1);
  });

  it('点菜单里另一态 ⇒ `onChange(该态)`；点当前态 ⇒ 不触发', () => {
    const onChange = vi.fn();
    render(<GenerationConfirmModeSwitch mode="collaborative" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('generation-confirm-mode-switch'));
    fireEvent.click(screen.getByTestId('generation-confirm-mode-ask'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('generation-confirm-mode-switch'));
    fireEvent.click(screen.getByTestId('generation-confirm-mode-auto'));
    expect(onChange).toHaveBeenCalledWith('autonomous');
  });

  it('`iconOnly`（官方 `n`）⇒ 标签块折叠为 `ml-0 grid-cols-[0fr] opacity-0` 且按钮带 `data-icon-only`', () => {
    const container = renderSwitch('collaborative', true);
    const button = screen.getByTestId('generation-confirm-mode-switch');
    expect(button.getAttribute('data-icon-only')).toBe('true');
    const content = container.querySelector('[data-adaptive-control-content="confirm-mode"]')!;
    expect(content.getAttribute('class')).toContain('ml-0 grid-cols-[0fr] opacity-0');
    expect(content.getAttribute('aria-hidden')).toBe('true');
  });

  it('默认（非 iconOnly）标签块是 `ml-1.5 grid-cols-[1fr] opacity-100` 且 `aria-hidden=false`', () => {
    const container = renderSwitch('collaborative', false);
    const content = container.querySelector('[data-adaptive-control-content="confirm-mode"]')!;
    expect(content.getAttribute('class')).toContain('ml-1.5 grid-cols-[1fr] opacity-100');
    expect(content.getAttribute('aria-hidden')).toBe('false');
  });
});
