// @vitest-environment jsdom
/**
 * 官方 `PE`（`ToolCallStatusLine`）在**联网搜索形态**下的三段附加结构回归：
 *  · `k` 命令行列表（>10 条时套官方 mask 滚动视口）
 *  · `v` 分组结果 → `Ire`（`WebSearchQueryResultGroups`）
 *  · `_` 来源列表 → `TF`（`WebSearchSourceDisplay`）+ 官方 `flex w-full min-w-0 flex-col gap-1.5` 包裹层
 *
 * 期望值来自 live `vendor-pkg-canvas-ChpWx5JY.js` @2411821 邻域的逐字源码（见 `_hie_fmt.txt` 490–652）。
 *
 * ⚠️ 官方展开体是 Radix `Collapsible.Content`（`ux`）⇒ **收起时不挂载子节点**，
 *    所以这里必须真交互展开一次再断言（不能用 SSR 静态标记）。
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AgentToolLine from '../../src/components/chat/AgentToolLine';
import type { ToolEventLike } from '../../src/services/chat/agentToolLabels';

afterEach(cleanup);

const items: ToolEventLike[] = [
  {
    id: 'call-1',
    type: 'tool_event',
    content: { tool: 'Bash', status: 'completed', tool_call_id: 'call-1', request: {}, response: {} },
  },
];

/** 渲染并展开一次（Radix `Collapsible.Content` 收起时不含子节点）。 */
function renderOpen(props: Partial<React.ComponentProps<typeof AgentToolLine>> = {}) {
  const { container } = render(<AgentToolLine items={items} isStreaming={false} {...props} />);
  const trigger = container.querySelector('button[data-state]');
  if (trigger) fireEvent.click(trigger);
  return container;
}

const commandLines = (count: number) => Array.from({ length: count }, (_, index) => ({
  tool: 'web_search',
  text: `搜索结果 ${index + 1}`,
}));

describe('AgentToolLine —— 官方 PE 的联网搜索形态', () => {
  it('命令行 ≤10 条：不套 mask（无 `data-command-scroll-*`、无 `h-[17.75rem]`）', () => {
    const container = renderOpen({ webSearch: true, commandLines: commandLines(10) });
    const html = container.innerHTML;
    expect(html).toContain('max-w-[min(640px,100%)] space-y-1 text-[13px] leading-[1.65] text-muted-foreground/60');
    expect(html).not.toContain('data-command-scroll-region');
    expect(html).not.toContain('data-command-scroll-fade');
    expect(html).not.toContain('h-[17.75rem]');
    /* 每行是官方那层 `div.max-w-[min(640px,100%)].truncate.py-0.5`。 */
    expect(html).toContain('<div class="max-w-[min(640px,100%)] truncate py-0.5">搜索结果 1</div>');
    expect(html).toContain('搜索结果 10');
  });

  it('命令行 >10 条：`data-command-scroll-region="true"` + `data-command-scroll-fade="mask"` + 17.75rem 滚动视口', () => {
    const container = renderOpen({ webSearch: true, commandLines: commandLines(11) });
    const html = container.innerHTML;
    expect(html).toContain('data-command-scroll-region="true"');
    expect(html).toContain('data-command-scroll-fade="mask"');
    expect(html).toContain('h-[17.75rem] overflow-y-auto overscroll-contain py-1 pr-1 scroll-smooth');
    expect(html).toContain('[scrollbar-width:thin]');
    expect(html).toContain('搜索结果 11');
    /* mask 渐变走内联样式；jsdom 的 cssstyle 不认 `mask-image`，序列化时会被丢掉
       ⇒ 只在真支持时断言（Node 环境用 `renderToStaticMarkup` 的另一条路径已覆盖属性本身）。 */
    const region = container.querySelector('[data-command-scroll-fade="mask"]') as HTMLElement;
    expect(region).not.toBeNull();
    const serialized = `${region.getAttribute('style') ?? ''}${region.style.maskImage ?? ''}`;
    if (serialized) expect(serialized).toContain('linear-gradient');
  });

  it('`webSearch` 且命令行非空 ⇒ 可展开（Radix Collapsible，不是 `<output>`）', () => {
    const { container } = render(<AgentToolLine items={items} isStreaming={false} webSearch commandLines={commandLines(2)} />);
    expect(container.querySelector('[class*="group/tool-details"]')).not.toBeNull();
    expect(container.querySelector('output')).toBeNull();
  });

  it('`webSearch` 且命令行为空 ⇒ 不可展开（官方 `M = k.length > 0` 为假 ⇒ 渲染 `<output>`）', () => {
    const { container } = render(<AgentToolLine items={items} isStreaming={false} webSearch commandLines={[]} />);
    expect(container.querySelector('output')).not.toBeNull();
    expect(container.querySelector('[class*="group/tool-details"]')).toBeNull();
  });

  it('非搜索形态仍然渲染 `hie`(ToolActivityDetailList)（回归）', () => {
    const container = renderOpen({});
    const html = container.innerHTML;
    expect(html).toContain('data-tool-activity-viewport=""');
    expect(html).toContain('data-tool-activity-list=""');
    expect(html).not.toContain('data-command-scroll-region');
  });

  it('`webSearchGroups` 非空时展开体走 `Ire`，不再渲染命令行列表', () => {
    const container = renderOpen({
      webSearch: true,
      commandLines: commandLines(3),
      webSearchGroups: [{ query: '猫', sources: [] }],
    });
    const html = container.innerHTML;
    expect(html).toContain('data-no-quote');
    expect(html).not.toContain('data-command-scroll-region');
    expect(html).not.toContain('搜索结果 1');
  });

  it('来源列表非空 ⇒ 用官方 `flex w-full min-w-0 flex-col gap-1.5` 包住「工具行 + 来源区」，且来源区在后', () => {
    const container = renderOpen({
      sources: [{ id: 's1', url: 'https://example.com', title: '示例来源' }],
    });
    const wrapper = container.querySelector('div.flex.w-full.min-w-0.flex-col.gap-1\\.5');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.textContent).toContain('example.com');
    /* 来源区在工具行**之后**（官方 `return q ? <div …>{te}{q}</div> : te`）。 */
    const html = container.innerHTML;
    const toolIndex = html.indexOf('data-tool-activity-list');
    const sourcesIndex = html.indexOf('example.com');
    expect(toolIndex).toBeGreaterThanOrEqual(0);
    expect(sourcesIndex).toBeGreaterThan(toolIndex);
  });

  it('来源列表为空 ⇒ 不套包裹层（根仍是 Collapsible / `<output>`）', () => {
    const withItems = render(<AgentToolLine items={items} isStreaming={false} />);
    expect(withItems.container.querySelector('div.flex.w-full.min-w-0.flex-col.gap-1\\.5')).toBeNull();
    expect(withItems.container.querySelector('[class*="group/tool-details"]')).not.toBeNull();
    cleanup();
    /* 空 items ⇒ 组件不渲染任何东西（官方的空组早退），更不会有来源包裹层。 */
    const noItems = render(<AgentToolLine items={[]} isStreaming={false} />);
    expect(noItems.container.querySelector('div.flex.w-full.min-w-0.flex-col.gap-1\\.5')).toBeNull();
  });
});
