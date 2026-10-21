// @vitest-environment jsdom
/**
 * 空态建议卡的 **1:1 官方形态** DOM 回归。
 *
 * 官方符号 → 定义偏移（live 主 chunk `vendor-pkg-canvas-ChpWx5JY.js`）：
 *   · `$rt` 空态根 @2576970 · `Hrt` 建议容器 @2574260 · `Grt` 单卡 @2570968
 *   · `__` 模糊入场动效壳 @2567334 · `Jie` 分类→图标 @2567697 · `YV` 分类图标分发 @2567784
 *   · `Brt` 卡片根类串 @2569810 · `Urt` @2569790 · `Vrt` 光晕 @2570385 · `XV` @2570652 · `QV` @2570688
 *   · `Rrt=460` / `Drt=32` / `Lrt=Rrt-Drt` @2568064 · `Frt(e)=e<Lrt` @2568091 · `zrt` 换一批图标 @2568245
 *
 * 图标三步解析（canvas 本地名 → 导出名 → vendor-libs 本地名 → 真身）：
 *   `Sue`→`kY`→`sZ`=lucide `lightbulb`；`$P`→`k$`→`m6`=lucide `sparkles`；`YN`→`l0`→`Q$`=lucide `arrow-right`。
 *
 * ⚠️ 验证分级 = **(b) jsdom 真 DOM + (c) SSR 串断言 + (d) 源码级逐字类串**。
 *   live CDP (a) 做不了 —— live 应用当前卡在 `Loading canvas, please wait...`。
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import EmptyChatState from '../../src/components/chat/EmptyChatState';
import { setLocale } from '../../src/i18n';

/* ── 官方 `Brt`（@2569810）逐字节选：MTV 曾把这些删掉过（用户点名的「质感 / hover」）。 ── */
const OFFICIAL_BRT_SHADOW =
  'shadow-[0_16px_40px_rgba(0,0,0,0.20),0_0_28px_rgba(255,255,255,0.02),inset_0_1px_0_rgba(255,255,255,0.05)]';
const OFFICIAL_BRT_TRANSITION =
  'transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out motion-reduce:transition-none';
const OFFICIAL_BRT_HOVER =
  'hover:border-white/[0.18] hover:bg-surface-secondary hover:shadow-[0_20px_48px_rgba(0,0,0,0.28),0_0_36px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.09)]';
/* 官方 `Vrt`（@2570385）逐字。 */
const OFFICIAL_VRT =
  'pointer-events-none absolute inset-0 opacity-0 blur-xl transition-opacity duration-700 group-hover/card:opacity-70 bg-[radial-gradient(circle_220px_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(178,239,255,0.07)_0%,rgba(213,241,255,0.025)_55%,transparent_85%)]';

let resizeCallbacks: Array<() => void> = [];

beforeEach(() => {
  setLocale('zh-CN');
  resizeCallbacks = [];
  /** jsdom 的 `ResizeObserver` 是空壳 ⇒ 这里换成「记录回调」的版本，好把官方 `Frt` 的测量手动触发。 */
  class RecordingResizeObserver {
    constructor(callback: () => void) {
      resizeCallbacks.push(callback);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: RecordingResizeObserver });
});

afterEach(() => {
  cleanup();
});

/** 官方 `Hrt` 量的是外层 `pb-5` 容器的 `clientWidth`。 */
function setMeasureWidth(container: HTMLElement, width: number): HTMLElement {
  const wrapper = container.querySelector('.pb-5') as HTMLElement;
  Object.defineProperty(wrapper, 'clientWidth', { configurable: true, value: width });
  return wrapper;
}

async function flushMeasure(): Promise<void> {
  await act(async () => {
    resizeCallbacks.forEach((callback) => callback());
  });
}

function cards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('button[class*="group/card"]')) as HTMLElement[];
}

describe('EmptyChatState — 官方 `$rt`/`Hrt`/`Grt` 逐字形态', () => {
  it('卡片根类串 = 官方 `Brt`（含被删过的 shadow / transition / hover 复合阴影）', () => {
    const { container } = render(<EmptyChatState onExample={() => {}} />);
    const [card] = cards(container);
    expect(card).toBeDefined();
    expect(card.className).toContain(OFFICIAL_BRT_SHADOW);
    expect(card.className).toContain(OFFICIAL_BRT_TRANSITION);
    expect(card.className).toContain(OFFICIAL_BRT_HOVER);
    /* 官方 `Urt`：横排卡最小高；官方 `Vrt` 光晕层逐字。 */
    expect(card.querySelector(`span[aria-hidden="true"][class*="blur-xl"]`)?.className).toBe(OFFICIAL_VRT);
  });

  it('官方 `Frt`：容器 clientWidth < 428 ⇒ `flex-col` + 卡片 `w-full min-h-[108px]`', async () => {
    const { container } = render(<EmptyChatState onExample={() => {}} />);
    const wrapper = setMeasureWidth(container, 427);
    await flushMeasure();
    expect((wrapper.firstElementChild as HTMLElement).className).toContain('flex-col');
    for (const card of cards(container)) {
      expect(card.className).toContain('w-full min-h-[108px]');
      expect(card.className).not.toContain('flex-1 basis-0');
    }
  });

  it('官方 `Frt`：容器 clientWidth ≥ 428 ⇒ `flex-row` + 卡片 `min-h-[140px] flex-1 basis-0`', async () => {
    const { container } = render(<EmptyChatState onExample={() => {}} />);
    const wrapper = setMeasureWidth(container, 900);
    await flushMeasure();
    expect((wrapper.firstElementChild as HTMLElement).className).toContain('flex-row');
    for (const card of cards(container)) {
      expect(card.className).toContain('min-h-[140px]');
      expect(card.className).toContain('flex-1 basis-0');
      expect(card.className).not.toContain('w-full min-h-[108px]');
    }
  });

  it('**`window.resize` 兜底**：真浏览器里 `ResizeObserver` 的投递可能被抑制（标签页被遮挡时 `visibilityState==="hidden"`）—— 只靠 observer 会让 `isStacked` 停在初始 `false`，窄面板仍然两列。补了 `resize` 监听后，改宽 + 派发 `resize` 必须重算。', async () => {
    const { container } = render(<EmptyChatState onExample={() => {}} />);
    /* 先在宽面板下稳定成 `flex-row`。 */
    const wrapper = setMeasureWidth(container, 900);
    await flushMeasure();
    expect((wrapper.firstElementChild as HTMLElement).className).toContain('flex-row');

    /* 变窄，但**不**触发 ResizeObserver，只派发 window resize。 */
    setMeasureWidth(container, 328);
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    expect((wrapper.firstElementChild as HTMLElement).className).toContain('flex-col');
    for (const card of cards(container)) {
      expect(card.className).toContain('w-full min-h-[108px]');
    }

    /* 反向：变宽 + resize 也要回到两列。 */
    setMeasureWidth(container, 448);
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    expect((wrapper.firstElementChild as HTMLElement).className).toContain('flex-row');
  });

  it('官方 `YN` = lucide `arrow-right`，size 16 / strokeWidth 1.6 / 官方类串逐字', () => {
    const { container } = render(<EmptyChatState onExample={() => {}} />);
    const arrows = Array.from(container.querySelectorAll('svg.lucide-arrow-right'));
    expect(arrows).toHaveLength(2);
    for (const arrow of arrows) {
      expect(arrow.getAttribute('width')).toBe('16');
      expect(arrow.getAttribute('height')).toBe('16');
      expect(arrow.getAttribute('stroke-width')).toBe('1.6');
      expect(arrow.getAttribute('aria-hidden')).toBe('true');
      expect(arrow.getAttribute('class')).toContain(
        'pointer-events-none absolute right-3 top-5 z-[1] shrink-0 text-white/25 transition-[color,transform] duration-200 group-hover/card:translate-x-0.5 group-hover/card:text-white/55',
      );
    }
  });

  it('官方 `Jie`/`YV`：本地池前两条 = `next_step`→lucide `lightbulb`、`inspiration`→lucide `sparkles`', () => {
    const { container } = render(<EmptyChatState onExample={() => {}} />);
    const [first, second] = cards(container);
    expect(first.querySelector('svg.lucide-lightbulb')).not.toBeNull();
    expect(second.querySelector('svg.lucide-sparkles')).not.toBeNull();
    /* 官方 `YV` 给图标的是 `size-4 shrink-0`（不是 width/height 属性硬编码）。 */
    for (const svg of [first.querySelector('svg.lucide-lightbulb'), second.querySelector('svg.lucide-sparkles')]) {
      expect(svg?.getAttribute('class')).toContain('size-4 shrink-0');
      expect(svg?.getAttribute('stroke-width')).toBe('1.6');
    }
  });

  it('官方 `__`（@2567334）：标题/说明各有一层模糊入场壳（`blur(4px)` + `y:4`）', () => {
    /* 用 SSR 断言 initial 态：framer-motion 在服务端只会把 `initial` 写进 style，不会推进动画。 */
    const markup = renderToStaticMarkup(<EmptyChatState onExample={() => {}} />);
    expect(markup).toContain('blur(4px)');
    expect(markup).toContain('translateY(4px)');
    /* 每张卡 2 层（标题 + 说明）× 2 张卡 = 4 层。 */
    expect(markup.match(/blur\(4px\)/g)).toHaveLength(4);
  });

  it('官方「换一批」键：`aria-label` 硬编码英文 `Refresh suggestions`、无 `data-tooltip`、图标是官方 `zrt` 内联 path', () => {
    const { container } = render(<EmptyChatState onExample={() => {}} />);
    const refresh = container.querySelector('button[aria-label="Refresh suggestions"]') as HTMLElement | null;
    expect(refresh).not.toBeNull();
    expect(refresh?.hasAttribute('data-tooltip')).toBe(false);
    expect(refresh?.className).toBe(
      'flex size-4 shrink-0 cursor-pointer items-center justify-center text-white/45 transition hover:text-white focus-visible:text-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-white/45',
    );
    expect(refresh?.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 16 16');
    expect(refresh?.querySelector('path')?.getAttribute('d')?.startsWith('M4.7959 8.72337')).toBe(true);
  });

  it('官方 `w`：mouseleave 会清掉 `--mouse-x` / `--mouse-y` 两个自定义属性', () => {
    const { container } = render(<EmptyChatState onExample={() => {}} />);
    const [card] = cards(container);
    fireEvent.mouseEnter(card, { clientX: 12, clientY: 34 });
    expect(card.style.getPropertyValue('--mouse-x')).toBe('12px');
    expect(card.style.getPropertyValue('--mouse-y')).toBe('34px');
    fireEvent.mouseLeave(card);
    expect(card.style.getPropertyValue('--mouse-x')).toBe('');
    expect(card.style.getPropertyValue('--mouse-y')).toBe('');
  });

  it('点「换一批」⇒ 换池 + 卡片 key 前缀变化（官方 `f` = ids 拼接 ⇒ 卡片重挂载、入场动画重放）', () => {
    const { container } = render(<EmptyChatState onExample={() => {}} />);
    const before = cards(container).map((card) => card.textContent);
    expect(before[0]).toContain('看看下一步做什么');
    const refresh = container.querySelector('button[aria-label="Refresh suggestions"]') as HTMLElement;
    fireEvent.click(refresh);
    const after = cards(container).map((card) => card.textContent);
    expect(after[0]).not.toBe(before[0]);
  });

  it('官方 `$rt`：`hasInputContent` ⇒ 问候 / 主句 / 建议卡整块不渲染', () => {
    const { container } = render(<EmptyChatState hasInputContent onExample={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('官方 `$rt`：`isSuggestionsVisible=false` ⇒ 问候与主句在、建议容器收起', () => {
    const { container } = render(<EmptyChatState isSuggestionsVisible={false} onExample={() => {}} />);
    expect(container.textContent).toContain('Hi New Tapper!');
    expect(container.textContent).toContain('今天一起创作点什么？');
    expect(container.querySelector('.pb-5')).toBeNull();
  });

  it('只读态（无 `onExample`）⇒ 卡片 disabled + 官方禁用态配色；官方刷新键在没有回调时整块不渲染', () => {
    const { container } = render(<EmptyChatState />);
    const [card] = cards(container);
    expect(card.hasAttribute('disabled')).toBe(true);
    expect(card.className).toContain('disabled:cursor-not-allowed disabled:opacity-45');
    /* 官方 `XV` 的禁用替身 + 官方 `r?null:<span Vrt/>`。 */
    expect(card.querySelector('span[class*="text-white/35"]')).not.toBeNull();
    expect(card.querySelector('span[aria-hidden="true"][class*="blur-xl"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Refresh suggestions"]')).toBeNull();
  });
});
