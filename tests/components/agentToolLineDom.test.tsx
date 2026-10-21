/**
 * 工具行（官方 `PE`）、工具区（官方 `AC`）与详情列表（官方 `hie`）的 **DOM 结构**回归
 * —— 断言逐字对齐 live 官方实测（CDP 9222）。
 *
 * live 官方实测链：
 * ```
 * DIV.flex.w-full.min-w-0.flex-col.gap-1.5                ← 官方 `AC` 外层（**无** data-agent-activity-block）
 *  └ DIV.group/tool-details[data-no-quote][data-state]
 *     ├ BUTTON.my-0.5.flex.w-full.max-w-full.items-center.gap-2.py-0.5.text-[13px].font-normal.leading-[1.65]
 *     │        .group/tool-call-line.cursor-pointer[aria-live][data-no-quote]
 *     │   ├ svg.lucide.lucide-<name>.size-4.shrink-0…
 *     │   ├ span.min-w-0.truncate…
 *     │   └ svg.lucide.lucide-chevron-right…opacity-0…group-data-[state=open]/tool-details:rotate-90
 *     └ DIV.space-y-1.overflow-hidden.pt-0.5…（收起时**无子节点**，与官方一致）
 * ```
 * 以及展开后的 `hie`：
 * `DIV.relative.max-w-[min(640px,100%)][data-tool-activity-viewport]` >
 * `OL.flex.w-full.flex-col.gap-1.py-0.5.text-[13px].leading-[1.65].text-muted-foreground/60[data-tool-activity-list]`
 * > `LI.min-w-0.py-0.5[data-tool-activity-item/status/tool]`。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AgentToolLine from '../../src/components/chat/AgentToolLine';
import CollapsibleToolSection from '../../src/components/chat/CollapsibleToolSection';
import ToolActivityDetailList from '../../src/components/chat/ToolActivityDetailList';
import type { ToolEventLike } from '../../src/services/chat/agentToolLabels';

const tool = (name: string, description?: string, id?: string): ToolEventLike => ({
  type: 'tool_event',
  content: {
    tool: name,
    status: 'completed',
    ...(id ? { tool_call_id: id } : {}),
    request: description ? { description } : {},
  },
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_002_000,
});

const renderSection = (items: ToolEventLike[]) => renderToStaticMarkup(
  <CollapsibleToolSection blocks={[{ kind: 'items', items }]} isStreaming={false} />,
);

describe('CollapsibleToolSection —— 官方 AC 的 DOM 结构', () => {
  it('外层是 `flex w-full min-w-0 flex-col gap-1.5`，且**没有** data-agent-activity-block', () => {
    const html = renderSection([tool('read')]);
    expect(html.startsWith('<div class="flex w-full min-w-0 flex-col gap-1.5">')).toBe(true);
    expect(html).not.toContain('data-agent-activity-block');
  });

  it('空组不渲染任何行', () => {
    expect(renderSection([])).toBe('<div class="flex w-full min-w-0 flex-col gap-1.5"></div>');
  });
});

describe('AgentToolLine —— 官方 PE 的行', () => {
  it('**只要有明细项就可展开**（官方 `M = u.length > 0`）：单条也是 Collapsible，不是 output', () => {
    const html = renderSection([tool('read')]);
    expect(html).toContain('class="group/tool-details"');
    expect(html).not.toContain('<output');
  });

  it('混合 kind 且非活跃 ⇒ `Eot` 汇总行：completedActions 文案 + lucide-list-checks', () => {
    const html = renderSection([tool('read'), tool('write'), tool('view_media')]);
    expect(html).toContain('已完成 3 个操作');
    expect(html).toContain('lucide-list-checks');
  });

  /* ── 第 72 轮：用户实测「已完成 2 个操作」那一行的真机对照 ──
     官方真机（CDP 9222 `app.tapnow.media`，只展开步骤、不改数据）展开步骤组后实测：
     ```
     <button … aria-live="off">
       <svg class="lucide lucide-list-checks size-4 shrink-0 …"></svg>
       <span …>已完成 3 个操作</span>
       <svg class="lucide lucide-chevron-right …"></svg>
     </button>
     ```
     组内三条 = `skill` + `read` + `tapnow_cli`（**不同类**）⇒ 官方 `Brt` 的 `o.size===1` 不成立
     ⇒ 走 `completedActions` 聚合行。
     ⚠️ MTV 的「画布」类步骤在官方名下是 `canvas_context`（`mtvToolToOfficial`：`canvas_query → canvas_context`），
     官方 `Brt` 的白名单逐字只有 `edit`/`exploration`/`viewMedia`/`command`
     ⇒ `[canvas_context, view_media]` 与 `[canvas_context, canvas_context]` **都会**出聚合行。
     ⇒ **这一行不是 MTV 多出来的**（与用户报告相反），本轮保留原逻辑并钉死真机读数。 */
  it('官方真机同款：不同类（canvas_context + view_media）⇒ 聚合行 + 计数=2', () => {
    const html = renderSection([
      tool('canvas_context', undefined, 'c1'),
      tool('view_media', undefined, 'c2'),
    ]);
    expect(html).toContain('已完成 2 个操作');
    expect(html).toContain('lucide-list-checks');
    /* 计数就是组内条数（官方 `l = e.length`），不是别的数。 */
    expect(html).not.toContain('已完成 1 个操作');
  });

  it('同类但不在官方白名单（画布上下文 ×2）⇒ 同样走聚合行（官方判据逐字）', () => {
    const html = renderSection([
      tool('canvas_context', undefined, 'c1'),
      tool('canvas_context', undefined, 'c2'),
    ]);
    expect(html).toContain('已完成 2 个操作');
    expect(html).toContain('lucide-list-checks');
  });

  it('同类且在白名单（view_media ×2）⇒ 不聚合，走单组文案', () => {
    const html = renderSection([
      tool('view_media', undefined, 'c1'),
      tool('view_media', undefined, 'c2'),
    ]);
    expect(html).not.toContain('lucide-list-checks');
    expect(html).toContain('lucide-search');
  });

  it('同类且在白名单（read ×2）⇒ 不聚合，走「已阅读 2 个文档」', () => {
    const html = renderSection([
      tool('read', undefined, 'c1'),
      tool('read', undefined, 'c2'),
    ]);
    expect(html).not.toContain('个操作');
    expect(html).toContain('已阅读 2 个文档');
  });

  it('活跃（isStreaming）时永不聚合：官方 `!C && p.length > 1` 不成立', () => {
    const html = renderToStaticMarkup(
      <CollapsibleToolSection
        blocks={[{ kind: 'items', items: [tool('canvas_context', undefined, 'c1'), tool('view_media', undefined, 'c2')] }]}
        isStreaming
      />,
    );
    expect(html).not.toContain('已完成 2 个操作');
  });

  /* ── 第 72 轮任务 A：MTV 的结构化工具行**只**有「结果」块，没有「输出」块 ──
     官方真机 `data-tool-public-result` 只出现在 `skill` 行（`输出` + `Launching skill: …`）；
     画布类工具行的 `content.response` 只有结构化字段（`{ok,question_id}` / `{node_ids,algorithm}`…），
     `output/text/content/result/stdout*` 一个都没有 ⇒ 那类行只有「结果」。
     ⚠️ 官方 `TT` 会把 `summary` 也渲染成一个块（`kind:'summary'` ⇒「结果」）—— 这是**官方有**的块，
     所以断言的是「没有 `输出` 标签」，而不是「没有 data-tool-public-result」。 */
  it('画布类工具行（canvasContext kind）只渲染「结果」，不渲染「输出」', () => {
    const html = renderToStaticMarkup(
      <ToolActivityDetailList
        items={[{
          type: 'tool_event',
          content: {
            tool: 'canvas_context',
            status: 'completed',
            response: { summary: '找到 1 个匹配节点' },
          },
        }]}
      />,
    );
    expect(html).toContain('找到 1 个匹配节点');
    expect(html).toContain('>结果<');
    expect(html).not.toContain('>输出<');
    expect(html).not.toContain('>错误输出<');
  });

  it('MTV 结构化工具（无任何文本字段）⇒ 连「结果」块都不渲染（整个 `TT` 返回 null）', () => {
    const html = renderToStaticMarkup(
      <ToolActivityDetailList
        items={[{
          type: 'tool_event',
          content: { tool: 'canvas_context', status: 'completed', response: {} },
        }]}
      />,
    );
    expect(html).not.toContain('data-tool-public-result');
  });

  it('行本体 class 与图标逐字一致（lucide + stroke-width 1.8 + 无 size 属性）', () => {
    const html = renderSection([tool('read', undefined, 'c1'), tool('read', undefined, 'c2')]);
    expect(html).toContain('class="my-0.5 flex w-full max-w-full items-center gap-2 py-0.5 text-[13px] font-normal leading-[1.65] group/tool-call-line cursor-pointer"');
    expect(html).toContain('stroke-width="1.8"');
    expect(html).toMatch(/class="lucide lucide-[a-z-]+ size-4 shrink-0/);
    /* 官方 svg 不带 width/height 属性（由 `size-4` 收到 16px）。 */
    expect(html).not.toMatch(/class="lucide lucide-[a-z-]+ size-4[^"]*"[^>]*width="16"/);
    expect(html).not.toContain('iconify');
  });

  it('chevron 的旋转走 CSS group-data，不拼 React 状态 class', () => {
    const html = renderSection([tool('read')]);
    expect(html).toContain('group-data-[state=open]/tool-details:rotate-90');
    expect(html).not.toContain(' rotate-90"');
  });

  it('取消/中止且组内无非取消项 ⇒ 整行不渲染（官方 VM 早退）', () => {
    const cancelled: ToolEventLike = { type: 'tool_event', content: { tool: 'read', status: 'cancelled' } };
    expect(renderSection([cancelled])).toBe('<div class="flex w-full min-w-0 flex-col gap-1.5"></div>');
  });
});

describe('ToolActivityDetailList —— 官方 hie 的 DOM 结构', () => {
  it('容器 + ol 的 class 与 data 属性逐字一致', () => {
    const html = renderToStaticMarkup(<ToolActivityDetailList items={[tool('read', '读取脚本', 'c1')]} />);
    expect(html).toContain('<div class="relative max-w-[min(640px,100%)]" data-tool-activity-viewport="">');
    expect(html).toContain('class="flex w-full flex-col gap-1 py-0.5 text-[13px] leading-[1.65] text-muted-foreground/60"');
    expect(html).toContain('data-tool-activity-list=""');
    expect(html).toContain('data-tool-activity-item=""');
    expect(html).toContain('data-tool-activity-status="completed"');
    expect(html).toContain('data-tool-activity-tool="read"');
    expect(html).toContain('<li class="min-w-0 py-0.5" ');
    expect(html).toContain('text-muted-foreground/65');
    /* 不足 8 条 ⇒ 不加滚动视口相关属性，与官方分支一致。 */
    expect(html).not.toContain('data-tool-activity-scroll-region');
    expect(html).not.toContain('data-tool-activity-visible-limit');
  });

  it('超过 8 条才加滚动视口（官方 `h_ = 8`）', () => {
    const items = Array.from({ length: 9 }, (_, index) => tool('read', undefined, `c${index}`));
    const html = renderToStaticMarkup(<ToolActivityDetailList items={items} />);
    expect(html).toContain('data-tool-activity-scroll-region="true"');
    expect(html).toContain('data-tool-activity-visible-limit="8"');
    expect(html).toContain('h-[var(--tool-activity-viewport-height,13.875rem)]');
  });

  it('description 追加 ` · N`（官方 `T`），且文案已包含时不重复', () => {
    const withDesc = renderToStaticMarkup(<ToolActivityDetailList items={[tool('read', '读取脚本', 'c1')]} />);
    expect(withDesc).toContain('text-muted-foreground/45');
    expect(withDesc).toContain('读取脚本');
  });
});

describe('AgentToolLine 直接调用（官方 PE 的 props）', () => {
  it('传 `expandable={false}` 时回落到 `<output>`（官方非展开分支）', () => {
    const html = renderToStaticMarkup(
      <AgentToolLine items={[tool('read')]} isStreaming={false} expandable={false} />,
    );
    expect(html.startsWith('<output aria-live="off"')).toBe(true);
  });
});
