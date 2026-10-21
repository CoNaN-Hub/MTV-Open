// @vitest-environment jsdom
/**
 * 官方「当前视窗没有节点」提示（`fwt` @3561288）—— 回归点钉桩。
 *
 * 官方依据（`vendor-pkg-canvas-CvbAwZyy.js`，只读产物）：
 *   · `lwt` @3559820 相交 · `cwt=100` 重算防抖 · `dwt=1e3` 显示延迟
 *   · `uwt` @3559869 状态机 · `pwt` @3561297 取**最后一个**节点 · `mwt=.2`
 *   · `Cn`/`Ao` @506115/@506243 尺寸取值链（兜底 `ws={250,250}` @505425）
 *   · `lo` @507879 绝对坐标（沿 `parentId` 递归累加）
 *
 * 这里只 mock React Flow 的 `useStore` / `useReactFlow` / `Panel`（仓库既有惯例，见
 * `tests/components/distributionGapHandles.test.tsx`），**不 mock i18n**，文案走真实词典。
 */
import { createElement, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node as RFNode } from '@xyflow/react';
import type { BaseNodeData } from '../../src/types';

const driver = vi.hoisted(() => ({
  nodes: [] as unknown[],
  width: 800,
  height: 600,
  transform: [0, 0, 1] as [number, number, number] | undefined,
  fitView: vi.fn(),
  getNodes: vi.fn<() => unknown[]>(),
}));

vi.mock('@xyflow/react', async () => {
  const { createElement: h } = await import('react');
  return {
    Panel: (props: { children?: ReactNode; className?: string; position?: string }) =>
      h(
        'div',
        {
          'data-testid': 'rf-panel',
          'data-position': props.position,
          className: props.className,
        },
        props.children,
      ),
    useStore: (selector: (state: unknown) => unknown) =>
      selector({ width: driver.width, height: driver.height, transform: driver.transform }),
    useReactFlow: () => ({ fitView: driver.fitView, getNodes: driver.getNodes }),
  };
});

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: { nodes: unknown[] }) => unknown) => selector({ nodes: driver.nodes }),
}));

import { setLocale } from '../../src/i18n';
import CanvasViewportEmptyHint from '../../src/components/canvas/CanvasViewportEmptyHint';
import {
  VIEWPORT_EMPTY_FIT_MAX_ZOOM,
  VIEWPORT_EMPTY_RECOMPUTE_DEBOUNCE_MS,
  VIEWPORT_EMPTY_SHOW_DELAY_MS,
  pickLastNode,
  rectsIntersect,
  viewportNodeHeight,
  viewportNodeWidth,
} from '../../src/hooks/useViewportEmptyHint';

const MESSAGE_ZH = '当前视窗没有节点，可点击按钮快速回到内容区域';
const RECENTER_ZH = '回到节点';

/** 官方逐字类串（含两个官方死类 `bg-tap-background-primary/90` / `border-tap-border-primary`） */
const OFFICIAL_PILL_CLASS =
  'flex items-center gap-4 rounded-full bg-tap-background-primary/90 px-4 py-2 shadow-lg backdrop-blur-md border border-tap-border-primary';

function node(
  id: string,
  x: number,
  y: number,
  extra: Partial<RFNode<BaseNodeData>> = {},
): RFNode<BaseNodeData> {
  return {
    id,
    type: 'ai-image',
    position: { x, y },
    width: 100,
    height: 80,
    data: { type: 'ai-image', label: id },
    ...extra,
  };
}

/** 推进官方两段计时：100ms 重算防抖 + （可选）1000ms 显示延迟 */
function settle(showDelayMs = VIEWPORT_EMPTY_SHOW_DELAY_MS) {
  act(() => {
    vi.advanceTimersByTime(VIEWPORT_EMPTY_RECOMPUTE_DEBOUNCE_MS);
  });
  act(() => {
    vi.advanceTimersByTime(showDelayMs);
  });
}

function renderHint() {
  return render(createElement(CanvasViewportEmptyHint));
}

function hintRoot(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.canvas-viewport-empty-hint');
}

beforeEach(() => {
  driver.nodes = [];
  driver.width = 800;
  driver.height = 600;
  driver.transform = [0, 0, 1];
  driver.fitView.mockReset();
  driver.getNodes.mockReset();
  driver.getNodes.mockImplementation(() => driver.nodes);
  vi.useFakeTimers();
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setLocale('zh-CN');
});

describe('官方常量与纯函数（逐字）', () => {
  it('常量 = 官方 cwt / dwt / mwt', () => {
    expect(VIEWPORT_EMPTY_RECOMPUTE_DEBOUNCE_MS).toBe(100); // 官方 cwt
    expect(VIEWPORT_EMPTY_SHOW_DELAY_MS).toBe(1000);        // 官方 dwt
    expect(VIEWPORT_EMPTY_FIT_MAX_ZOOM).toBe(0.2);          // 官方 mwt
  });

  it('rectsIntersect = 官方 lwt（边界相接算相交，完全错开不算）', () => {
    const view = { left: 0, top: 0, right: 800, bottom: 600 };
    expect(rectsIntersect(view, { left: 10, top: 10, right: 110, bottom: 90 })).toBe(true);
    expect(rectsIntersect(view, { left: -100, top: -100, right: 0, bottom: 0 })).toBe(true);   // 角点相接
    expect(rectsIntersect(view, { left: 800, top: 600, right: 900, bottom: 700 })).toBe(true); // 角点相接
    expect(rectsIntersect(view, { left: 900, top: 0, right: 1000, bottom: 100 })).toBe(false);
    expect(rectsIntersect(view, { left: -200, top: 0, right: -1, bottom: 100 })).toBe(false);
    expect(rectsIntersect(view, { left: 0, top: -200, right: 100, bottom: -1 })).toBe(false);
    expect(rectsIntersect(view, { left: 0, top: 601, right: 100, bottom: 700 })).toBe(false);
  });

  it('pickLastNode = 官方 pwt（最后一个，不是第一个）', () => {
    expect(pickLastNode([])).toBeNull();
    expect(pickLastNode(null)).toBeNull();
    const a = node('a', 0, 0);
    const b = node('b', 0, 0);
    expect(pickLastNode([a, b])?.id).toBe('b');
  });

  it('viewportNodeWidth/Height = 官方 Cn/Ao 取值链（width → measured → dimensions → 250）', () => {
    expect(viewportNodeWidth(node('a', 0, 0, { width: 333 }))).toBe(333);
    expect(viewportNodeWidth(node('a', 0, 0, { width: undefined, measured: { width: 44 } }))).toBe(44);
    expect(
      viewportNodeWidth({ ...node('a', 0, 0), width: undefined, dimensions: { width: 77 } } as RFNode<BaseNodeData>),
    ).toBe(77);
    expect(viewportNodeWidth(node('a', 0, 0, { width: undefined }))).toBe(250);
    expect(viewportNodeHeight(node('a', 0, 0, { height: undefined }))).toBe(250);
  });
});

describe('显示条件（真回归点）', () => {
  it('① 视窗内有节点 ⇒ 不显示', () => {
    driver.nodes = [node('in', 10, 10)];
    const { container } = renderHint();
    settle();
    expect(hintRoot(container)).toBeNull();
    expect(container.querySelector('[data-position="bottom-center"]')).toBeNull();
  });

  it('② 有节点但全在视窗外 ⇒ 显示', () => {
    driver.nodes = [node('out-a', 2000, 2000), node('out-b', -3000, -3000)];
    const { container } = renderHint();
    settle();
    expect(hintRoot(container)).not.toBeNull();
    expect(container.textContent).toContain(MESSAGE_ZH);
    expect(container.textContent).toContain(RECENTER_ZH);
  });

  it('③ 画布为空（nodes.length === 0）⇒ 不显示', () => {
    driver.nodes = [];
    const { container } = renderHint();
    settle();
    expect(hintRoot(container)).toBeNull();
  });

  it('④ 延迟不到 1000ms ⇒ 不显示（999ms 时仍未显示，1000ms 才显示）', () => {
    driver.nodes = [node('out', 5000, 5000)];
    const { container } = renderHint();
    /* 只等重算防抖，显示延迟走 999ms */
    act(() => {
      vi.advanceTimersByTime(VIEWPORT_EMPTY_RECOMPUTE_DEBOUNCE_MS);
    });
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(hintRoot(container)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hintRoot(container)).not.toBeNull();
  });

  it('视窗不可用（transform 缺失）⇒ 不显示', () => {
    driver.transform = undefined;
    driver.nodes = [node('out', 5000, 5000)];
    const { container } = renderHint();
    settle();
    expect(hintRoot(container)).toBeNull();
  });

  it('画布尺寸为 0 ⇒ 不显示', () => {
    driver.width = 0;
    driver.nodes = [node('out', 5000, 5000)];
    const { container } = renderHint();
    settle();
    expect(hintRoot(container)).toBeNull();
  });

  it('⑥ hidden 节点被排除（唯一的节点 hidden 且在视窗内 ⇒ 仍然显示）', () => {
    driver.nodes = [node('hidden', 10, 10, { hidden: true })];
    const { container } = renderHint();
    settle();
    expect(hintRoot(container)).not.toBeNull();
  });

  it('⑥ 有可见节点在视窗内时，另一个 hidden 节点不改变结论', () => {
    driver.nodes = [node('in', 10, 10), node('hidden-out', 9000, 9000, { hidden: true })];
    const { container } = renderHint();
    settle();
    expect(hintRoot(container)).toBeNull();
  });

  it('⑦ 子节点（parentId）按**绝对**坐标算：父在远处 ⇒ 提示显示', () => {
    driver.nodes = [
      node('group', 5000, 5000),
      node('child', 10, 10, { parentId: 'group' }), // 相对父坐标；绝对 = (5010,5010)
    ];
    const { container } = renderHint();
    settle();
    expect(hintRoot(container)).not.toBeNull();
  });

  it('⑦ 子节点（parentId）按**绝对**坐标算：父在近处 ⇒ 不显示', () => {
    driver.nodes = [
      node('group', 10, 10),
      node('child', 20, 20, { parentId: 'group' }), // 绝对 = (30,30) 仍在视窗内
    ];
    const { container } = renderHint();
    settle();
    expect(hintRoot(container)).toBeNull();
  });

  it('视窗被平移出节点 ⇒ 显示（证明用的是 transform 推出的视窗矩形）', () => {
    driver.nodes = [node('n', 0, 0)];
    driver.transform = [-5000, -5000, 1];
    const { container } = renderHint();
    settle();
    expect(hintRoot(container)).not.toBeNull();
  });
});

describe('胶囊结构（逐字类串 + 官方 Button）', () => {
  it('类串逐字保留官方死类，且挂在 bottom-center 的 Panel 上并带 pointer-events-auto', () => {
    driver.nodes = [node('out', 5000, 5000)];
    const { container } = renderHint();
    settle();
    const panel = container.querySelector('[data-position="bottom-center"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('class')).toContain('pointer-events-auto');

    const pill = hintRoot(container);
    expect(pill).not.toBeNull();
    const className = pill?.getAttribute('class') ?? '';
    /* 官方原始类串必须**原封不动**地连续出现（含两个死类，勿修），
       整串只允许多挂一个 MTV 适配钩子 `o-scope`（官方 Button 的 `--o-*` 令牌作用域）。 */
    expect(className).toBe(`${OFFICIAL_PILL_CLASS} o-scope canvas-viewport-empty-hint`);

    const span = pill?.querySelector('span');
    expect(span?.getAttribute('class')).toBe('text-sm text-tap-text-2');

    /* 官方 `Wt` 没写 variant ⇒ 落 defaultVariants `variant:"default"`
       = `bg-primary text-primary-foreground shadow hover:bg-primary/90`（蓝色实心）。
       MTV 的 OfficialButton 默认是 `outline` ⇒ 必须显式 default，否则按钮没有蓝底。 */
    const button = pill?.querySelector('button');
    expect(button?.getAttribute('class')).toContain('o-btn');
    expect(button?.getAttribute('class')).toContain('o-btn--default');
    expect(button?.getAttribute('class')).toContain('o-btn--sm');
  });

  it('文案走真实 i18n 词典（zh 原文 / en 官方译文）', () => {
    driver.nodes = [node('out', 5000, 5000)];
    const { container, unmount } = renderHint();
    settle();
    expect(container.textContent).toContain(MESSAGE_ZH);
    expect(container.textContent).toContain(RECENTER_ZH);
    unmount();

    cleanup();
    setLocale('en-US');
    const second = renderHint();
    settle();
    expect(second.container.textContent).toContain(
      'No nodes are visible in the current view. Use the button to jump back to your content.',
    );
    expect(second.container.textContent).toContain('Return to nodes');
  });
});

describe('⑤ 点「回到节点」', () => {
  it('对**最后一个**节点 fitView({nodes:[{id:last}],padding:.5,duration:500,maxZoom:.2})，并收起提示', () => {
    driver.nodes = [node('out-first', 5000, 5000), node('out-last', 6000, 6000)];
    const { container } = renderHint();
    settle();
    const button = hintRoot(container)?.querySelector('button');
    expect(button).not.toBeNull();

    fireEvent.click(button!);

    expect(driver.fitView).toHaveBeenCalledTimes(1);
    expect(driver.fitView).toHaveBeenCalledWith({
      nodes: [{ id: 'out-last' }],
      padding: 0.5,
      duration: 500,
      maxZoom: 0.2,
    });
    expect(hintRoot(container)).toBeNull();
  });

  it('节点表为空时不调用 fitView（官方 `d?.id&&` 短路）', () => {
    driver.nodes = [node('out', 5000, 5000)];
    const { container } = renderHint();
    settle();
    driver.getNodes.mockImplementation(() => []);
    fireEvent.click(hintRoot(container)!.querySelector('button')!);
    expect(driver.fitView).not.toHaveBeenCalled();
    /* 官方：`d?.id` 为假时**不会**调用 `dismissEmptyHint`，提示仍在 */
    expect(hintRoot(container)).not.toBeNull();
  });
});

describe('令牌与死类（源码级回归）', () => {
  const root = join(__dirname, '../..');
  const baseCss = readFileSync(join(root, 'src/styles/base.css'), 'utf8');
  const tailwindConfig = readFileSync(join(root, 'tailwind.config.js'), 'utf8');
  const hintCss = readFileSync(join(root, 'src/styles/canvas-viewport-empty-hint.css'), 'utf8');

  it('`--tap-text-2` 按官方真机原值补上（oklch 原值，不是换算后的 hex）', () => {
    expect(baseCss).toContain('--tap-text-2: oklch(87.1% 0.006 286.286)');
  });

  it('tailwind 只补了 `tap-text-2`；两个死类**不得**被补成真色键', () => {
    expect(tailwindConfig).toContain("'tap-text-2': 'var(--tap-text-2)'");
    expect(tailwindConfig).not.toMatch(/['"]?tap-background-primary['"]?\s*:/);
    expect(tailwindConfig).not.toMatch(/['"]?tap-border-primary['"]?\s*:/);
  });

  it('`shadow-lg` 只局部钉回官方 v4 取值链，且**没有**给死类编颜色', () => {
    expect(hintCss).toContain('box-shadow: var(--shadow-lg)');
    expect(hintCss).not.toContain('currentColor;');
    expect(hintCss).not.toMatch(/border-tap-border-primary\s*\{/);
    expect(hintCss).not.toMatch(/bg-tap-background-primary/);
  });

  /**
   * 官方真机里按钮是 **12px/16px**：cva base 的 `text-sm` 被 `size:"sm"` 的 `text-xs` 经
   * **tailwind-merge** 删掉了。MTV 没有 tailwind-merge ⇒ 只能靠 CSS 顺序让 `.o-btn--sm`
   * 盖住 `.o-btn` 的 14px。这条顺序一旦被调换，按钮字号就会变 14px（与官方不符）。
   */
  it('`.o-btn--sm` 必须排在 `.o-btn` 之后且给出 12px/16px（真机读数）', () => {
    const officialControls = readFileSync(join(root, 'src/styles/official-controls.css'), 'utf8');
    const baseAt = officialControls.indexOf('.o-btn {');
    const smAt = officialControls.indexOf('.o-btn--sm {');
    expect(baseAt).toBeGreaterThanOrEqual(0);
    expect(smAt).toBeGreaterThan(baseAt);
    const smBlock = officialControls.slice(smAt, officialControls.indexOf('}', smAt));
    expect(smBlock).toContain('height: 32px');
    expect(smBlock).toContain('padding: 0 12px');
    expect(smBlock).toContain('font-size: 12px');
    expect(smBlock).toContain('line-height: 16px');
  });

  /** `.o-scope` 的令牌是胶囊观感的实际来源（官方真机：bg rgb(31,162,220) / color rgb(250,250,250) /
      container box-shadow = `--shadow-lg`）—— 改坏了本胶囊就跟着坏。 */
  it('`.o-scope` 提供官方令牌：--o-primary #1fa2dc / --primary-foreground #fafafa / --shadow-lg', () => {
    const officialControls = readFileSync(join(root, 'src/styles/official-controls.css'), 'utf8');
    expect(officialControls).toContain('--o-primary: #1fa2dc');
    expect(officialControls).toContain('--o-primary-foreground: #fafafa');
    expect(officialControls).toContain(
      '--shadow-lg: 0px 2px 4px 0px #0000001a, 0px 4px 6px -1px #0000001a',
    );
  });

  /**
   * 官方按钮在**本胶囊内**的两处取值（官方真机 computed，提示显示态实测）：
   *   · `cursor: default` —— 官方 Button 的 base 类串里没有任何 cursor 工具类；
   *   · `box-shadow: rgba(0,0,0,.1) 0 2px 4px 0, rgba(0,0,0,.1) 0 1px 2px -1px` —— 官方 default
   *     variant 挂的是 `shadow`（读 `--shadow`），不是 MTV `.o-btn--default` 的 `shadow-sm`。
   * 两处都**只作用在本胶囊**（选择器 `.canvas-viewport-empty-hint .o-btn` 特异性 0,2,0
   * ⇒ 不需要依赖文件顺序就能盖住 `.o-btn--default` 的 0,1,0）。
   */
  it('胶囊内的官方按钮：cursor 钉成 default、投影钉成官方 --shadow', () => {
    const officialControls = readFileSync(join(root, 'src/styles/official-controls.css'), 'utf8');
    expect(officialControls).toContain(
      '--shadow: 0px 2px 4px 0px #0000001a, 0px 1px 2px -1px #0000001a',
    );

    const blockAt = hintCss.indexOf('.canvas-viewport-empty-hint .o-btn {');
    expect(blockAt).toBeGreaterThanOrEqual(0);
    const block = hintCss.slice(blockAt, hintCss.indexOf('}', blockAt));
    expect(block).toContain('cursor: default');
    expect(block).toContain('box-shadow: var(--shadow)');
    expect(block).toContain('border-width: 0');
    /* 不能写成 `.o-btn { … }`（那会波及全仓每一颗官方按钮） */
    expect(hintCss).not.toMatch(/^\.o-btn\s*\{/m);
  });

  /**
   * 官方字体栈必须**显式声明** —— 这是真机实测出来的、会造成「字形都不一样」的差异：
   * MTV 的 Tailwind v3 preflight 把 `html` 的 font-family 设成了
   * `ui-sans-serif, system-ui, sans-serif, …`，画布子树继承这一条 ⇒ 中文回退字体与官方不同。
   * 真机 `CSS.getPlatformFontsForNode`：官方 = `Noto Sans SC Thin`，MTV（修前）= `Microsoft YaHei UI`；
   * 声明官方栈后 MTV 也变成 `Noto Sans SC Thin`。
   */
  it('胶囊显式声明官方字体栈（否则中文回退到另一个字体）', () => {
    const at = hintCss.indexOf('.canvas-viewport-empty-hint {');
    expect(at).toBeGreaterThanOrEqual(0);
    const block = hintCss.slice(at, hintCss.indexOf('}', at));
    expect(block).toContain(
      'font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    );
  });

  /**
   * **全应用级**字体栈：Tailwind v3 没配 `fontFamily` 时 `font-sans` = `ui-sans-serif, system-ui, …`，
   * 而 `.app-shell` 上就挂着 `font-sans` ⇒ 整个 app-shell 子树（画布/聊天/面板）都被换成那条栈，
   * **盖掉了 html/body 上 `base.css` 写好的官方栈**。
   * 真机 `CSS.getPlatformFontsForNode`（同一台机器、同一串中文）：官方 = `Noto Sans SC Thin`，
   * 修前 MTV = `Microsoft YaHei UI`（墨迹像素数差 ~26%）⇒ 用户看到的「字体不一样」。
   * 这条用例钉住「`sans` = 官方栈、且不含任何中文字体」（含中文字体会命中自己 bundle 的字重）。
   */
  it('tailwind `fontFamily.sans` 必须是官方栈，且**不含任何中文字体**', () => {
    const at = tailwindConfig.indexOf('fontFamily:');
    expect(at).toBeGreaterThanOrEqual(0);
    const end = tailwindConfig.indexOf('],', at);
    const block = tailwindConfig.slice(at, end + 2);
    for (const fam of ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif']) {
      expect(block).toContain(fam);
    }
    expect(block).not.toMatch(/Noto Sans SC|YaHei|PingFang|Microsoft YaHei/);
    expect(block).not.toContain('ui-sans-serif');
    expect(block).not.toContain('system-ui');
  });
});
