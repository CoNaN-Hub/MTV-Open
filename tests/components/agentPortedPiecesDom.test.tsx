/**
 * 一批「契约移植件」的 **DOM 结构**回归 —— 断言 SSR 出来的 class 链 / `data-*` / 图标 path
 * 与 live 官方逐字一致。这类断言不依赖 live 会话状态，可以稳定跑。
 *
 * 覆盖：`AskQuestionSummary`(官方 `Moe`+`joe`) · `SubAgentLine`(官方 `sae`) ·
 * `CompactLifecycleLine`(官方 `Tie`) · `StoppedByUserDivider`(官方 `Fit`) ·
 * `TaskProgressList/Row`(官方 `VF`/`rae`) · `TodoProgressRing`(官方 `bat`)。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AskQuestionSummary from '../../src/components/chat/AskQuestionSummary';
import CompactLifecycleLine from '../../src/components/chat/CompactLifecycleLine';
import { TaskProgressList, TodoProgressRing } from '../../src/components/chat/AgentTaskProgressList';
import StoppedByUserDivider from '../../src/components/chat/StoppedByUserDivider';
import SubAgentLine from '../../src/components/chat/SubAgentLine';
import type { ToolEventLike } from '../../src/services/chat/agentToolLabels';
import type { TodoItem } from '../../src/services/chat/todoTasks';

describe('AskQuestionSummary（官方 Moe + joe）', () => {
  const content = {
    tool: 'ask_question',
    tool_call_id: 'call-1',
    response: {
      questions: [{ question_id: 'q1', header: '风格', question: '想要什么风格？', options: [{ label: 'A' }, { label: 'B' }] }],
      answers: [{ question_id: 'q1', selected_labels: ['A'] }],
    },
  };

  it('容器 class 逐字（已答 ⇒ 无 opacity-60）', () => {
    const html = renderToStaticMarkup(<AskQuestionSummary content={content} />);
    expect(html.startsWith('<div class="mt-2 space-y-1.5 rounded-[10px] bg-white/[0.03] px-3.5 py-2.5">')).toBe(true);
  });

  it('QuestionRow 三段结构 + header chip 用 bg-white/[0.06]（摘要与面板不同）', () => {
    const html = renderToStaticMarkup(<AskQuestionSummary content={content} />);
    expect(html).toContain('<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">');
    expect(html).toContain('class="shrink-0 rounded-[5px] bg-white/[0.06] px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"');
    expect(html).toContain('class="min-w-[8em] flex-1 text-[13px] leading-[1.6] text-muted-foreground"');
    expect(html).toContain('class="min-w-0 max-w-full break-words text-[13px] leading-[1.6] text-chat-foreground"');
    expect(html).toContain('风格');
    expect(html).toContain('想要什么风格？');
    expect(html).toContain('A');
  });

  it('未答 ⇒ 显示官方 `unanswered` 文案 + `opacity-60`', () => {
    const unanswered = { tool: 'ask_question', response: { questions: content.response.questions, answers: [] } };
    const html = renderToStaticMarkup(<AskQuestionSummary content={unanswered} />);
    expect(html).toContain('opacity-60');
    expect(html).toContain('未回答');
  });

  it('无问题 ⇒ 不渲染', () => {
    expect(renderToStaticMarkup(<AskQuestionSummary content={{ tool: 'ask_question' }} />)).toBe('');
  });
});

describe('SubAgentLine（官方 sae / SubagentCard）', () => {
  const agent = (status: string): ToolEventLike => ({
    type: 'tool_event',
    content: { subagent_id: 's1', status, task_description: '查资料', tools: [], text: '结果正文' },
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_005_000,
  });

  it('运行中 ⇒ 行 class 用 `subagent-card` group 名 + lucide bot（无 size 属性）', () => {
    const html = renderToStaticMarkup(<SubAgentLine agent={agent('running')} childItems={[]} isStreaming />);
    expect(html).toContain('group/subagent-card cursor-pointer');
    expect(html).toContain('tool-call-status-icon-active text-muted-foreground/80');
    expect(html).toMatch(/class="lucide lucide-bot size-4 shrink-0/);
    expect(html).toContain('子智能体执行中：查资料');
  });

  it('展开区摘要用官方 `max-h-40 … [scrollbar-width:none]`（不是 line-clamp-3）', () => {
    /* 官方 `useState(isWorkingStreaming)`：只有「运行中且流式」初值是展开 ⇒ 用 running 让内容渲染出来。
       （完成态默认收起，Radix 收起时不挂子节点 —— 这与官方一致。） */
    const html = renderToStaticMarkup(<SubAgentLine agent={agent('running')} childItems={[]} isStreaming />);
    expect(html).toContain('max-h-40 max-w-[min(640px,100%)]');
    expect(html).toContain('[scrollbar-width:none]');
    expect(html).toContain('[&amp;::-webkit-scrollbar]:hidden');
    expect(html).not.toContain('line-clamp-3');
    expect(html).toContain('结果正文');
  });

  it('ended_unknown 走官方 `endedUnknown` 键；completed 走 `done`', () => {
    const completed = renderToStaticMarkup(<SubAgentLine agent={agent('completed')} childItems={[]} isStreaming={false} />);
    expect(completed).toContain('子智能体已完成');
    const unknown = renderToStaticMarkup(<SubAgentLine agent={agent('weird')} childItems={[]} isStreaming={false} />);
    expect(unknown).toContain('子智能体已结束');
  });

  it('箭头旋转走 CSS `group-data-[state=open]/subagent-card`', () => {
    const html = renderToStaticMarkup(<SubAgentLine agent={agent('completed')} childItems={[]} isStreaming={false} />);
    expect(html).toContain('group-data-[state=open]/subagent-card:rotate-90');
  });
});

describe('CompactLifecycleLine（官方 Tie）', () => {
  it('无活动时显示 `上下文已自动压缩`，且不显示 `compact-elapsed`', () => {
    const html = renderToStaticMarkup(<CompactLifecycleLine phase="finished" isStreaming={false} />);
    expect(html).toContain('上下文已自动压缩');
    expect(html).not.toContain('data-testid="compact-elapsed"');
  });

  it('压缩中显示 `正在自动压缩上下文` + 计时节点', () => {
    const html = renderToStaticMarkup(<CompactLifecycleLine phase="started" isStreaming />);
    expect(html).toContain('正在自动压缩上下文');
    expect(html).toContain('data-testid="compact-elapsed"');
  });

  it('两条渐变线与宽度占位（invisible）逐字', () => {
    const html = renderToStaticMarkup(<CompactLifecycleLine phase="finished" isStreaming={false} />);
    expect(html).toContain('flex w-full min-w-[280px] items-center gap-3 py-1.5 text-xs leading-4 text-foreground/70');
    expect(html).toContain('h-px min-w-6 flex-1 bg-gradient-to-r from-transparent to-foreground/25');
    expect(html).toContain('h-px min-w-6 flex-1 bg-gradient-to-r from-foreground/25 to-transparent');
    expect(html).toContain('class="invisible"');
    expect(html).toContain('absolute inset-0 inline-flex items-center justify-center');
  });
});

describe('StoppedByUserDivider（官方 Fit）', () => {
  it('文案与两条反向渐变线逐字', () => {
    const html = renderToStaticMarkup(<StoppedByUserDivider />);
    expect(html).toContain('flex w-full items-center gap-3 py-1.5 text-xs leading-4');
    expect(html).toContain('你已停止本次回复');
    expect(html).toContain('h-px flex-1 bg-gradient-to-r from-transparent to-foreground/25');
    expect(html).toContain('h-px flex-1 bg-gradient-to-l from-transparent to-foreground/25');
  });
});

describe('TaskProgressList / TodoProgressRing（官方 VF / rae / bat）', () => {
  const items: TodoItem[] = [
    { taskId: 't1', content: '第一步', status: 'completed' },
    { taskId: 't2', content: '第二步', status: 'in_progress', description: '说明', activeForm: '进行中' },
    { taskId: 't3', content: '第三步', status: 'pending' },
  ];

  it('列表 class 与默认 props（comfortable=false ⇒ gap-3）', () => {
    const html = renderToStaticMarkup(<TaskProgressList items={items} />);
    expect(html.startsWith('<ul class="flex flex-col gap-3"')).toBe(true);
  });

  it('完成态用 Tabler `check` 单 path（`M5 12l5 5l10 -10`），不是 circle-check', () => {
    const html = renderToStaticMarkup(<TaskProgressList items={[items[0]]} />);
    expect(html).toContain('<path d="M5 12l5 5l10 -10">');
    expect(html).not.toContain('M9 12l2 2l4 -4');
  });

  it('进行中用 loader-2 且带 animate-spin；待办用 circle', () => {
    const inProgress = renderToStaticMarkup(<TaskProgressList items={[items[1]]} />);
    expect(inProgress).toContain('<path d="M12 3a9 9 0 1 0 9 9">');
    expect(inProgress).toContain('animate-spin text-foreground motion-reduce:animate-none');
    const pending = renderToStaticMarkup(<TaskProgressList items={[items[2]]} />);
    expect(pending).toContain('<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0">');
  });

  it('行 class 与 `index+1. ` 前缀逐字', () => {
    const html = renderToStaticMarkup(<TaskProgressList items={[items[0]]} />);
    expect(html).toContain('class="flex gap-2 items-center text-xs leading-4"');
    expect(html).toContain('1. ');
    expect(html).toContain('class="min-w-0 flex-1"');
    expect(html).toContain('block break-words');
  });

  it('进度环：全完成 ⇒ Tabler check(16/2.5)；否则轨道 + 进度弧（500ms + opacity）', () => {
    const done = renderToStaticMarkup(
      <TodoProgressRing current={2} total={2} label="已完成" isAllCompleted />,
    );
    expect(done).toContain('<path d="M5 12l5 5l10 -10">');

    const partial = renderToStaticMarkup(
      <TodoProgressRing current={1} total={2} label="进行中" isAllCompleted={false} />,
    );
    expect(partial).toContain('stroke-foreground/20');
    expect(partial).toContain('transition-[stroke-dashoffset,opacity] duration-500 ease-out');
    expect(partial).toContain('opacity-100');
    expect(partial).toContain('stroke-dasharray="43.982297150257104"');
  });
});
