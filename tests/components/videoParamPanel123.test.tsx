// @vitest-environment jsdom
/**
 * §123 回归 —— **视频参数面板与官方当前构建（r127）逐元素对齐**。
 *
 * 官方产物（`D:\DEEPSEEK\live-assets-r127\vendor-pkg-canvas-Dp0xADoD.js`，偏移 = JS 字符串 charIdx）：
 *  · 面板 `Uoe`（`VideoConfigsPanel`）= @1871044 … @1876194
 *  · 弹层 `Ds`（= `vendor-packages-CvEFn1fJ.js` 的 `PopoverContent`）调用点 @1871588 邻域：
 *      `s.jsx(Ds,{side:"top",align:"start",sideOffset:8,className:"w-auto p-0 bg-transparent border-none shadow-none",…})`
 *  · 比例组 `renderOption` @1874104：
 *      `G=>s.jsxs("div",{className:"flex flex-col items-center gap-0.5",children:[s.jsx(E0,{ratio:G}),
 *        s.jsx("span",{className:"text-xs",children:G==="adaptive"?F("videoConfigs.adaptive"):G})]})`
 *  · 比例图形 `E0` @1229953（`adaptive`/`auto*` ⇒ `u1` = lucide `fullscreen`；其余 = 14×14 描边框 `14 × 14/r`）
 *  · 时长控件 `TF` @1866900 … @1868800（`data-testid:"duration-selector"` + `ni` 药丸 +
 *      `Cr` 数字输入框 `w-[72px]` + 固定后缀 `s`）
 *  · 时长档位白名单 @2071153：
 *      `durationControl: o.model===vt.SEEDANCE_2_5||o.model===vt.SEEDANCE_2_5_DRAFT||o.model===vt.WAN_3_0
 *        ? "slider" : "options"`
 *
 * 真机取证（CDP 9222 · `app.tapnow.media` · Seedance 2.5 · 2026-10-15）：
 *  · 面板 400×390 @(765.3,284.7)（`w-[400px] p-1 rounded-[20px] …`）
 *  · 触发器 `[aria-haspopup="dialog"]` = 238.1×36 @(765.6,682.6)
 *  · 面板 left 765.3 == 触发器 left 765.6（align start）· 面板 bottom 674.7 == 触发器 top − 8
 *  · `[data-testid="duration-selector"]` = 376×36 @(777.3,552.7)，内含
 *    `4s…30s` 每颗 40×32（`min-w-10 whitespace-nowrap`）+ 72×32 的 `input[type=text]`（value `5`）
 *  · 比例「自适应」格 = `svg.lucide-fullscreen` 14×14；`16:9` 格 = 内层 `border-[1.5px]` 的 14×7.875 框
 */
import { createElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import VideoParamSelector from '../../src/components/nodes/shared/VideoParamSelector';

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (value: string) => value }));
vi.mock('../../src/i18n', async (importOriginal) => {
  /* `t()` 在测试里按官方 zh 直出（MTV 的 `t` 走中文 key，`useT()` 返回的正是该函数）。 */
  const actual = await importOriginal<typeof import('../../src/i18n')>();
  return { ...actual, useT: () => (key: string) => key };
});

const SELECTOR_PROPS = {
  provider: 'general',
  selectedModel: 'seedance-2.5',
  seedanceRatio: 'adaptive',
  seedanceResolution: '720p',
  seedanceDuration: 5,
  generateAudio: true,
  onChangeSeedanceRatio: vi.fn(),
  onChangeSeedanceResolution: vi.fn(),
  onChangeSeedanceDuration: vi.fn(),
  onChangeGenerateAudio: vi.fn(),
};

function openPanel(extra: Record<string, unknown> = {}) {
  const utils = render(createElement(
    VideoParamSelector as unknown as (p: Record<string, unknown>) => ReactElement,
    { ...SELECTOR_PROPS, ...extra },
  ));
  fireEvent.click(utils.container.querySelector('.ui-schema-menu-trigger') as HTMLElement);
  return document.querySelector('.ui-schema-video-params-popup') as HTMLElement;
}

beforeEach(() => { cleanup(); });

describe('§123 比例组：官方文案 + 官方比例图形', () => {
  it('`adaptive` 显示官方 zh「自适应」（不是英文 `adaptive`）', () => {
    const panel = openPanel();
    const labels = Array.from(panel.querySelectorAll('.img-rp-quality-item'))
      .map((node) => node.textContent?.trim());
    expect(labels).toContain('自适应');
    expect(labels).not.toContain('adaptive');
  });

  it('`adaptive` 格 = 官方 `u1`（lucide `fullscreen`）14×14', () => {
    const panel = openPanel();
    const adaptive = Array.from(panel.querySelectorAll('.img-rp-quality-item'))
      .find((node) => node.textContent?.trim() === '自适应')!;
    const svg = adaptive.querySelector('svg.lucide-fullscreen');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('14');
    expect(svg!.getAttribute('height')).toBe('14');
    /* 官方那五条子元素（真机 innerHTML 逐字） */
    expect(svg!.querySelectorAll('path').length).toBe(4);
    expect(svg!.querySelector('rect')?.getAttribute('width')).toBe('10');
  });

  it('数字比例格 = 官方 `E0` 描边框：外层 14×14、内层 `border-[1.5px] border-current rounded-[2px]`', () => {
    const panel = openPanel();
    const sixteen = Array.from(panel.querySelectorAll('.img-rp-quality-item'))
      .find((node) => node.textContent?.trim() === '16:9')!;
    expect(sixteen.querySelector('svg')).toBeNull();
    const box = sixteen.querySelector('.border-\\[1\\.5px\\]') as HTMLElement;
    expect(box).not.toBeNull();
    expect(box.className).toContain('border-current');
    expect(box.className).toContain('rounded-[2px]');
    /* 官方不取整：16:9 ⇒ 14 × (14 / (16/9)) = 14 × 7.875 */
    expect(box.style.width).toBe('14px');
    expect(box.style.height).toBe('7.875px');
  });
});

describe('§123 生成时长 = 官方 `TF`（药丸 + 数字输入框），**不是滑条**', () => {
  it('Seedance 2.5 命中官方白名单 ⇒ 渲染 `[data-testid="duration-selector"]`', () => {
    const panel = openPanel();
    const selector = panel.querySelector('[data-testid="duration-selector"]') as HTMLElement;
    expect(selector).not.toBeNull();
    expect(selector.className).toContain('flex');
    expect(selector.className).toContain('min-w-0');
    expect(selector.className).toContain('items-center');
    expect(selector.className).toContain('gap-2');
  });

  it('药丸 = `4s…30s`，每颗 `min-w-10 whitespace-nowrap`（官方 `ni` 的 itemClassName）', () => {
    const panel = openPanel();
    const selector = panel.querySelector('[data-testid="duration-selector"]')!;
    const pills = Array.from(selector.querySelectorAll('button'));
    expect(pills.map((b) => b.textContent)).toEqual(
      Array.from({ length: 27 }, (_, index) => `${index + 4}s`),
    );
    expect(pills.every((b) => b.className.includes('min-w-10'))).toBe(true);
    expect(pills.every((b) => b.className.includes('whitespace-nowrap'))).toBe(true);
    /* 选中态 = 官方 `text-foreground`；未选 = `text-muted-foreground hover:text-foreground` */
    const active = pills.find((b) => b.className.includes('text-foreground')
      && !b.className.includes('text-muted-foreground'));
    expect(active?.textContent).toBe('5s');
  });

  it('数字输入框 = 官方 `Cr` 逐属性：text/numeric/72px/后缀 `s`/min4 max30 step1', () => {
    const panel = openPanel();
    const input = panel.querySelector('[data-testid="duration-selector"] input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('pattern')).toBe('[0-9]*');
    expect(input.getAttribute('aria-label')).toBe('选择视频生成时长');
    expect(input.getAttribute('min')).toBe('4');
    expect(input.getAttribute('max')).toBe('30');
    expect(input.getAttribute('step')).toBe('1');
    expect(input.value).toBe('5');
    const wrapper = input.parentElement!;
    expect(wrapper.className).toBe('relative w-[72px] shrink-0');
    expect(wrapper.querySelector('span')?.textContent).toBe('s');
  });

  it('面板里**不再有** `<input type="range">`（旧滑杆）', () => {
    const panel = openPanel();
    expect(panel.querySelector('input[type="range"]')).toBeNull();
    expect(panel.querySelector('.rh-duration-slider')).toBeNull();
  });

  it('输入合法档位 ⇒ 立即写回；非法字符被官方 `wYe` 正则挡掉', () => {
    const onChangeSeedanceDuration = vi.fn();
    const panel = openPanel({ onChangeSeedanceDuration });
    const input = panel.querySelector('[data-testid="duration-selector"] input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9' } });
    expect(onChangeSeedanceDuration).toHaveBeenCalledWith(9);
    onChangeSeedanceDuration.mockClear();
    fireEvent.change(input, { target: { value: '9x' } });
    expect(onChangeSeedanceDuration).not.toHaveBeenCalled();
  });
});

describe('§123 弹层定位 = 官方 Radix `side:"top" align:"start" sideOffset:8`', () => {
  it('portal 到 `<body>`，且类名带 `img-ratio-popup--start`（去掉居中 translate）', () => {
    const trigger = render(createElement(
      VideoParamSelector as unknown as (p: Record<string, unknown>) => ReactElement,
      { ...SELECTOR_PROPS },
    )).container.querySelector('.ui-schema-menu-trigger') as HTMLElement;
    fireEvent.click(trigger);
    const popup = document.querySelector('.ui-schema-video-params-popup') as HTMLElement;
    expect(popup).not.toBeNull();
    /* 真 portal：弹层不是触发器的后代，而是 `<body>` 的直接子节点 */
    expect(trigger.contains(popup)).toBe(false);
    expect(popup.parentElement).toBe(document.body);
    expect(popup.className).toContain('img-ratio-popup--start');
  });

  it('left = 触发器 left · top = 触发器 top − 8 − 面板高度（seedOffset 8 / side top）', () => {
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    rectSpy.mockImplementation(function (this: Element) {
      if (this.classList?.contains('ui-schema-menu-trigger')) {
        return {
          left: 765.6, top: 682.6, right: 1003.7, bottom: 718.6, width: 238.1, height: 36, x: 765.6, y: 682.6,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(390);

    const container = render(createElement(
      VideoParamSelector as unknown as (p: Record<string, unknown>) => ReactElement,
      { ...SELECTOR_PROPS },
    )).container;
    fireEvent.click(container.querySelector('.ui-schema-menu-trigger') as HTMLElement);
    const popup = document.querySelector('.ui-schema-video-params-popup') as HTMLElement;

    expect(popup.style.left).toBe('765.6px');
    expect(popup.style.top).toBe('284.6px');

    heightSpy.mockRestore();
    rectSpy.mockRestore();
  });
});
