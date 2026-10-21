import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ToolbarButton } from '../../src/components/canvas/SelectionToolbarButton';

/**
 * 官方多选工具栏那颗圆钮 = `Xm / ToolbarIconButton`（`zoom-slider-3ZcFvYQO.js`@char2758295）。
 *
 * 这里只断言**纯静态**就能判定的三条官方语义（全部来自规格 §2 / §9 与源码逐字），
 * 因为这颗钮最容易被改回「原生 disabled + 变色变淡」那种 MTV 老写法：
 *   ① 默认：`cursor-pointer` / `aria-disabled` 不出现 / `tabIndex` 不写死（官方 `void 0`）/ 无原生 `disabled`
 *   ② 禁用：**不用原生 `disabled`**，改 `aria-disabled=true` + `tabIndex=-1` + `cursor-default`，
 *      且**不加** opacity/颜色变化（官方：`无 opacity/颜色变化；仅光标与可聚焦性改变`）
 *   ③ 忙碌（官方 `gQ` 的 `isLoading`）：`aria-busy=true` + 同样 inert + 光效层 `opacity-100`（常亮）
 *      + 图标换成 40px 的 `animate-spin` spinner
 *
 * 光效层的两层渐变（conic/radial）也一并钉住 —— 它们的取值是官方内联 style 的逐字拷贝。
 */
const CONIC = 'conic-gradient(from 0deg, rgba(93, 93, 93, 1) 0deg';
const RADIAL = 'radial-gradient(200% 140% at 50% 40.25%, #1A1A1A 16%, #656766 85%)';

function render(props: Parameters<typeof ToolbarButton>[0]) {
  return renderToStaticMarkup(<ToolbarButton {...props} />);
}

describe('selection toolbar icon button (official Xm)', () => {
  it('默认态：cursor-pointer、无原生 disabled、aria-disabled 不出现在 DOM 上', () => {
    const html = render({ icon: 'pile', tooltip: '堆叠' });
    expect(html).toContain('cursor-pointer');
    expect(html).not.toContain('cursor-default');
    expect(html).not.toContain('aria-disabled');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('aria-label="堆叠"');
    expect(html).toContain('data-tooltip="堆叠"');
    // 官方基类：size-10 / rounded-full / overflow-hidden + 命名 group（光照层靠 group-hover/button）
    expect(html).toContain('group/button');
    expect(html).toContain('size-10');
    expect(html).toContain('rounded-full');
    expect(html).toContain('overflow-hidden');
  });

  it('光效层：真实 DOM、z-[-1]、两层官方渐变逐字', () => {
    const html = render({ icon: 'pile', tooltip: '堆叠' });
    expect(html).toContain('absolute inset-0 z-[-1]');
    expect(html).toContain('rounded-[inherit]');
    expect(html).toContain('group-hover/button:opacity-100');
    expect(html).toContain('duration-[400ms]');
    expect(html).toContain('ease-[cubic-bezier(0.25,0.8,0.25,1)]');
    expect(html).toContain('inset-[-100%]');
    expect(html).toContain('inset-[1px]');
    expect(html).toContain(CONIC);
    expect(html).toContain(RADIAL);
    expect(html).toContain('scale(1.1, 0.7)');
  });

  it('禁用态：aria-disabled + tabIndex=-1 + cursor-default，且**没有**变淡/变色', () => {
    const html = render({ icon: 'createSubject', tooltip: '新建主体', disabled: true });
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('cursor-default');
    expect(html).not.toContain('cursor-pointer');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('opacity-50');
    // 光效层不能被压掉：官方禁用时 hover 高光照样亮
    expect(html).toContain('group-hover/button:opacity-100');
  });

  it('忙碌态：aria-busy + inert + 光效常亮 + 40px spinner 取代 16px 图标', () => {
    const html = render({ icon: 'downloadAll', tooltip: '下载全部', busy: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('cursor-default');
    // 官方 `gQ`：`<_oe size={40} className="shrink-0 animate-spin"/>`
    expect(html).toContain('width="40"');
    expect(html).toContain('height="40"');
    expect(html).toContain('shrink-0 animate-spin');
    expect(html).toContain('d="M12 3a9 9 0 1 0 9 9"');
    // 忙碌时光效层被强制 op-100（官方 `isActive` 分支），不再依赖 group-hover
    expect(html).toContain('opacity-100');
    expect(html).not.toContain('opacity-0 group-hover/button:opacity-100');
  });

  it('非忙碌态渲染 16×16 官方图标，且不带 animate-spin', () => {
    const html = render({ icon: 'pile', tooltip: '堆叠' });
    expect(html).toContain('width="16"');
    expect(html).not.toContain('animate-spin');
    expect(html).toContain('data-pile-stack-layer="front"');
  });
});
