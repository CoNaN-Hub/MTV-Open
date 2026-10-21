// @vitest-environment jsdom
/**
 * 用户实测（图 7/8）复现：官方完成后会有一行折叠摘要「处理了 1m13s ∨」（`vS`/`AgentStepsSection`，
 * 官方 `FF`），展开后是中间步骤；MTV 侧**没有这一行**。
 *
 * 官方条件（`vendor-pkg-canvas-ChpWx5JY.js` 的 `lae` 消息渲染器，逐字）：
 * ```js
 * // ① 消息级「步骤吸收」：对每段连续可分组项（nG = collapsible 或 item.type ∈ {text,thinking}）
 * //    找出其中 collapsible 的区间，且要求区间**之后**还有可见内容：
 * const O = useMemo(() => { if (n) return [];                       // n = isStreaming
 *   const ue = Ne => F.slice(Ne+1).some(Oe => xit(Oe) || Oe.kind==="normal" && Oe.item.type!=="thinking" && Oe.item.type!=="text");
 *   ... le.push({absorbFrom, lastCollapsible, toolItems, stepCount, durationMs, absorbTextInRange}) });
 * // ② 渲染：在吸收区间的**第一个**位置渲染一次
 * <FF durationMs autoCollapse>{absorbTextInRange ? 区间内每项（collapsible → AC；text → div.$M）
 *                                            : <AC items={toolItems} …/>}</FF>
 * ```
 * `xit(e)` = `e.kind==="normal" && e.item.type==="text" && content.trim()` ⇒ 「后面还有正文」是折叠前提。
 * 也就是说：**只要消息里有工具事件 + 后面跟着最终正文**，官方就一定会出这一行。
 *
 * 本文件钉住 MTV 在同一输入下也必须出这一行（不论 `agentTask.steps` 是否还在）。
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {},
  mediaModelOptions: [],
  mediaModelAvailability: {},
  onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

/** 普通工具步（非卡片族）⇒ 走官方 `AC`(工具行)。 */
function toolStep(): AgentStep {
  return {
    id: 's1',
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: '读取更新后的剧本，核对完整内容',
    status: 'succeeded',
    createdAt: 1_000,
    updatedAt: 6_000,
    toolCall: {
      callId: 'call-1',
      toolId: 'read_file',
      retryCount: 0,
      startedAt: 1_000,
      finishedAt: 6_000,
    },
  };
}

function task(over: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1', goal: '测试', status: 'completed', steps: [toolStep()], createdAt: 1, updatedAt: 2,
    ...over,
  } as AgentTask;
}

const ANSWER = '这是最终回答';

function assistantMessage(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1', conversationId: 'c1', role: 'assistant', content: ANSWER,
    timestamp: 500, status: 'complete', ...over,
  };
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(cleanup);

function summary(container: HTMLElement): Element | null {
  return container.querySelector('[data-testid="agent-steps-summary"]');
}

describe('官方 `lae` 的完成态折叠摘要（图 7/8）', () => {
  it('① AgentTask 带步 ⇒ 必须渲染摘要行，且**在正文之前**（官方按 contents 顺序渲染）', () => {
    const { container } = render(
      <MessageBubble message={assistantMessage()} agentTask={task()} agentControls={AGENT_CONTROLS} />,
    );
    const row = summary(container);
    expect(row).not.toBeNull();
    const html = container.innerHTML;
    expect(html.indexOf('data-testid="agent-steps-summary"')).toBeLessThan(html.indexOf(ANSWER));
  });

  it('② `contents` 有工具事件 + 正文 ⇒ 即使 AgentTask 的 `steps` 已空（完成态裁剪）也必须出摘要行', () => {
    const { container } = render(
      <MessageBubble
        message={assistantMessage({
          contents: [
            {
              type: 'tool_event',
              content: { schema_version: 'tool_event.v1', tool: 'read_file', status: 'completed', tool_call_id: 'call-1', request: { description: '读取更新后的剧本，核对完整内容' } },
              startedAt: 1_000,
              endedAt: 6_000,
            },
            { type: 'text', content: ANSWER, startedAt: 500 },
          ],
        })}
        agentTask={task({ steps: [] })}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(summary(container)).not.toBeNull();
    const html = container.innerHTML;
    expect(html.indexOf('data-testid="agent-steps-summary"')).toBeLessThan(html.indexOf(ANSWER));
  });

  it('③ 折叠后文案 = 官方 `处理了 {duration}`，时长按 item 的 `min(startedAt)..max(endedAt)` 算', async () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <MessageBubble message={assistantMessage()} agentTask={task()} agentControls={AGENT_CONTROLS} />,
      );
      /* 官方 `FF` 的 `autoCollapse`：首次展开后 `Oot = 380ms` 自动收起。 */
      act(() => { vi.advanceTimersByTime(400); });
      const trigger = container.querySelector('[data-testid="agent-steps-summary"] [data-state]');
      expect(trigger?.getAttribute('data-state')).toBe('closed');
      /* 1s..6s ⇒ `处理了 5s`（官方 `$$` 的 `Xs` 格式）。 */
      expect(container.querySelector('[data-testid="agent-steps-summary"]')?.textContent).toContain('处理了 5s');
    } finally {
      vi.useRealTimers();
    }
  });
});
