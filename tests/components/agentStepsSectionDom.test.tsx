/**
 * `AgentStepsSection`（官方 `FF`）的 **DOM 结构**回归 —— 断言逐字对齐 live 官方实测的 class 链。
 *
 * live 官方（CDP 9222 实测）结构：
 * ```
 * DIV[data-testid="agent-steps-summary"]                                  (无 class)
 *  └ DIV.group/agent-steps-details[data-state][data-no-quote="true"]
 *     ├ BUTTON.group/agent-steps …（摘要）
 *     └ DIV[data-agent-steps-content][data-state]
 *        └ DIV.min-h-0.overflow-hidden
 *           └ DIV.mt-1.5.mb-2.flex.flex-col.gap-2.5.border-l.border-foreground/10.py-1.5.pl-3.5
 *              └ DIV.w-full.min-w-0                                        ← 每个 child 一层
 * ```
 * 最后那层 `div.w-full.min-w-0` 此前 MTV 缺失（已按本轮修复）。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AgentStepsSection from '../../src/components/chat/AgentStepsSection';

const render = (autoCollapse = true) => renderToStaticMarkup(
  <AgentStepsSection autoCollapse={autoCollapse}>
    <div className="flex w-full min-w-0 flex-col gap-1.5" data-inner-list="">
      <span>row</span>
    </div>
  </AgentStepsSection>,
);

describe('AgentStepsSection —— 官方 FF 的 DOM 结构', () => {
  it('外层是 data-testid="agent-steps-summary" 的无 class 包裹层', () => {
    const html = render();
    expect(html.startsWith('<div data-testid="agent-steps-summary">')).toBe(true);
  });

  it('第二层是 group/agent-steps-details + data-no-quote + data-state', () => {
    /* Radix `Collapsible.Root` 自己会输出 `data-state`，且属性**顺序**由 Radix 决定
       ⇒ 只断言各片段存在，不锁死顺序。 */
    const rootTag = (html: string) => html.slice(html.indexOf('<div data-state'), html.indexOf('><button') + 1);
    const open = rootTag(render());
    expect(open).toContain('class="group/agent-steps-details"');
    expect(open).toContain('data-no-quote="true"');
    expect(open).toContain('data-state="open"');
    const closed = rootTag(render(false));
    expect(closed).toContain('class="group/agent-steps-details"');
    expect(closed).toContain('data-state="closed"');
  });

  it('用官方 Radix `Collapsible` 原语（Trigger 带 `aria-controls`/`aria-expanded`/`data-state`）', () => {
    const triggerTag = (html: string) => html.slice(html.indexOf('<button'), html.indexOf('>', html.indexOf('<button')) + 1);
    const open = triggerTag(render());
    expect(open).toContain('data-state="open"');
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('aria-controls=');
    expect(triggerTag(render(false))).toContain('aria-expanded="false"');
  });

  it('摘要按钮的 class 链与**当前**官方产物逐字一致（展开态 `opacity-80`、收起态 `opacity-100`）', () => {
    /* 第 65 轮：官方 build 前移 —— 旧快照（`page-BeI7xydN.js`@684247）是
       `my-1 … gap-1.5 py-0.5`；当前产物 `EO`@2470371（summary class @2470703）逐字为下面这串。 */
    const base = 'class="group/agent-steps my-2 inline-flex min-h-9 max-w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 text-[13px] font-normal leading-[1.65] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]';
    expect(render()).toContain(`${base} opacity-80"`);
    expect(render(false)).toContain(`${base} opacity-100"`);
  });

  it('内容区三层壳逐字一致，并且**每个 child 再包一层 `w-full min-w-0`**', () => {
    const html = render();
    expect(html).toContain('data-agent-steps-content=""');
    expect(html).toContain('<div class="min-h-0 overflow-hidden">');
    expect(html).toContain('<div class="mt-1.5 mb-2 flex flex-col gap-2.5 border-l border-foreground/10 py-1.5 pl-3.5">');
    /* 关键断言：`div.w-full.min-w-0` 紧跟在上面那层之后，且里面才是调用方给的 child。 */
    const marker = '<div class="mt-1.5 mb-2 flex flex-col gap-2.5 border-l border-foreground/10 py-1.5 pl-3.5"><div class="w-full min-w-0">';
    expect(html).toContain(marker);
    expect(html).toContain('<div class="flex w-full min-w-0 flex-col gap-1.5" data-inner-list="">');
  });

  it('收起态不渲染 children（官方「首次展开后才挂载内容」）', () => {
    const html = render(false);
    expect(html).not.toContain('data-inner-list');
    expect(html).not.toContain('w-full min-w-0');
  });

  it('时长格式走官方 kp：`处理了 2m9s`', () => {
    const html = renderToStaticMarkup(
      <AgentStepsSection autoCollapse durationMs={129_000}>
        <span>x</span>
      </AgentStepsSection>,
    );
    expect(html).toContain('处理了 2m9s');
  });
});
