// @vitest-environment jsdom
/**
 * 「你已停止本次回复」分割线的**生产者**回归（覆盖表 §6 #14 —— 组件早已就位、缺的是数据源）。
 *
 * 官方渲染点（`vendor-pkg-canvas-ChpWx5JY.js` **@2629518** 邻域，逐字）：
 * ```js
 * w && Y.id === O && s.jsx(JV, {onClick: () => S?.(w)}),                 // fork 分割线
 * N?.includes(Y.id) && !(Y.id === k && o !== "idle") && s.jsx(Fit, {})   // 停止分割线
 * ```
 * `Fit` 的组件本体（@2624879 邻域）= `StoppedByUserDivider`（MTV 已就位）。
 * 这里补的是 **`N.includes(id)` 的 MTV 等价信号**：
 * 用户停止 ⇒ `agentTaskControl.transitionAgentTask(taskId, 'stopped', …)`（`agentTaskControl.ts` @151 邻域）
 * ⇒ `AgentTask.status === 'stopped'`。
 *
 * 验证分级 = **(b) jsdom 真 DOM**（未做 (a) live CDP）。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import type { AgentTask, AgentTaskStatus } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {},
  mediaModelOptions: [],
  mediaModelAvailability: {},
  onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '回答', timestamp: 1_000, status: 'done', ...over };
}

function task(status: AgentTaskStatus): AgentTask {
  return { id: 'task-1', goal: '测试', status, steps: [], createdAt: 1, updatedAt: 2 } as AgentTask;
}

/** 官方 `Fit` 的逐字类串（`shrink-0 text-muted-foreground` + 左右反向渐隐线）。 */
function divider(container: HTMLElement): Element | null {
  return container.querySelector('span.shrink-0.text-muted-foreground');
}

beforeEach(() => {
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
});

describe('MessageBubble —— 官方 `Fit`（「你已停止本次回复」）的生产者', () => {
  it('`agentTask.status === "stopped"` ⇒ 渲染分割线，文案 = 官方 `chatAdapter.streaming.stoppedByUser`', () => {
    const { container } = render(
      <MessageBubble message={message()} agentTask={task('stopped')} agentControls={AGENT_CONTROLS} />,
    );
    expect(container.textContent).toContain('你已停止本次回复');
  });

  it('`completed` / `running` / `failed` 都**不**渲染（官方 `N.includes(id)` 只含被停止的）', () => {
    for (const status of ['completed', 'running', 'failed', 'queued'] as AgentTaskStatus[]) {
      const { container } = render(
        <MessageBubble message={message()} agentTask={task(status)} agentControls={AGENT_CONTROLS} />,
      );
      expect(container.textContent).not.toContain('你已停止本次回复');
      cleanup();
    }
  });

  it('用户消息即使带 stopped 任务也不渲染（官方 `Fit` 只在 assistant 消息项里）', () => {
    const { container } = render(
      <MessageBubble
        message={message({ role: 'user', content: '提问' })}
        agentTask={task('stopped')}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(container.textContent).not.toContain('你已停止本次回复');
  });

  it('分割线结构 = 左 `to-foreground/25` + 文案 + 右 `to-l …`（官方两条线渐变方向相反）', () => {
    const { container } = render(
      <MessageBubble message={message()} agentTask={task('stopped')} agentControls={AGENT_CONTROLS} />,
    );
    const label = divider(container);
    expect(label).not.toBeNull();
    const root = label?.parentElement as HTMLElement;
    expect(root.className).toBe('flex w-full items-center gap-3 py-1.5 text-xs leading-4');
    const lines = root.querySelectorAll('span[aria-hidden]');
    expect(lines).toHaveLength(2);
    expect(lines[0]?.className).toBe('h-px flex-1 bg-gradient-to-r from-transparent to-foreground/25');
    expect(lines[1]?.className).toBe('h-px flex-1 bg-gradient-to-l from-transparent to-foreground/25');
  });
});
