// @vitest-environment jsdom
/**
 * 「中途正文 item」落库 + 官方消息级「步骤吸收」(`lae` 的 `O` / `absorbTextInRange`) 回归。
 *
 * 官方事实（`vendor-pkg-canvas-ChpWx5JY.js`）：
 * ```js
 * // 写入口：每段正文 chunk 按到达顺序追加成一个 text item（`yxe`）
 * // 渲染：吸收区间内的 text item 包成 13px/1.65 的说明段，和工具段一起进 `FF`(`vS`)
 * const ue = Ne => F.slice(Ne+1).some(Oe =>
 *   xit(Oe) || (Oe.kind==="normal" && Oe.item.type!=="thinking" && Oe.item.type!=="text"));
 * const at = Ne === 0 ? Ne : xe;          // 段落从 0 开始 ⇒ 连前面的正文一起吸收
 * absorbTextInRange = ct.some(J => J.kind === "normal")
 * ```
 * ⇒ 「工具前的说明 + 工具段」在有后续正文时**整体**收进折叠面板，展开后能看到那句说明
 * （用户实测 图 8：「我会先读这次更新的剧本文本…」）。
 *
 * 验证分级 = **(b) jsdom 真 DOM**（`appendStreamingTextItem` / `absorbActivityRuns` 另有纯函数断言）。
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import {
  absorbActivityRuns,
  appendStreamingTextItem,
  buildActivitySegmentsFromContents,
  type MessageActivitySegment,
} from '../../src/services/chat/messageContents';
import type { AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {}, mediaModelOptions: [], mediaModelAvailability: {}, onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

const NARRATION = '我会先读这次更新的剧本文本，再从视觉导演角度分析它的叙事可读性';
const ANSWER = '这是最终回答';

function toolStep(): AgentStep {
  return {
    id: 's1', taskId: 'task-1', index: 0, kind: 'tool', title: '读取更新后的剧本，核对完整内容',
    status: 'succeeded', createdAt: 1_000, updatedAt: 6_000,
    toolCall: { callId: 'call-1', toolId: 'read_file', retryCount: 0, startedAt: 1_000, finishedAt: 6_000 },
  };
}
const TASK = {
  id: 'task-1', goal: '测试', status: 'completed', steps: [toolStep()], createdAt: 1, updatedAt: 2,
} as AgentTask;

function assistantMessage(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1', conversationId: 'c1', role: 'assistant',
    content: `${NARRATION}${ANSWER}`, timestamp: 500, status: 'complete', ...over,
  };
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});
afterEach(cleanup);

describe('官方写入口：流式正文按到达顺序落成 item', () => {
  it('同一段未被工具事件打断 ⇒ 续写最后一项；被打断后再来 ⇒ 新开一项', () => {
    let items = appendStreamingTextItem(undefined, '第一段', 1_000);
    expect(items).toEqual([{ content: '第一段', startedAt: 1_000 }]);
    items = appendStreamingTextItem(items, '，续写', 1_100);
    expect(items).toEqual([{ content: '第一段，续写', startedAt: 1_000 }]);
    /* 工具事件边界（`noteToolEvent` 的效果）= 第 4 参 `startNewItem` ⇒ 新开一项。 */
    const afterTool = appendStreamingTextItem(items, '第二段', 3_000, true);
    expect(afterTool).toEqual([
      { content: '第一段，续写', startedAt: 1_000 },
      { content: '第二段', startedAt: 3_000 },
    ]);
    /* 之后的正文仍续写这**新**的一项。 */
    expect(appendStreamingTextItem(afterTool, '，再续', 3_100)).toEqual([
      { content: '第一段，续写', startedAt: 1_000 },
      { content: '第二段，再续', startedAt: 3_000 },
    ]);
  });
});

describe('官方 `O`：步骤吸收区间', () => {
  const text = (value: string): MessageActivitySegment => ({ kind: 'text', text: value });
  const tools = (): MessageActivitySegment => ({
    kind: 'tools',
    blocks: [{ kind: 'items', items: [{ type: 'tool_event', content: { tool: 'read_file' }, startedAt: 1_000, endedAt: 6_000 }] }],
  });

  it('正文 → 工具 → 正文 ⇒ 从 0 开始吸收（连前面的正文一起进面板）', () => {
    const runs = absorbActivityRuns([text(NARRATION), tools(), text(ANSWER)]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ absorbFrom: 0, lastAbsorbable: 1, absorbTextInRange: true });
    expect(runs[0].durationMs).toBe(5_000);
  });

  it('工具 → 正文 ⇒ 从工具段开始吸收（`at = Ne===0 ? Ne : xe`）', () => {
    const runs = absorbActivityRuns([tools(), text(ANSWER)]);
    expect(runs[0]).toMatchObject({ absorbFrom: 0, lastAbsorbable: 0, absorbTextInRange: false });
  });

  it('工具之后**没有**可见内容（仍在流式）⇒ 不吸收（官方 `ue(Pe)` 前提）', () => {
    expect(absorbActivityRuns([tools()])).toEqual([]);
    expect(absorbActivityRuns([text(NARRATION), tools()])).toEqual([]);
  });

  it('**流式中不吸收**（官方 `O` 的第一句 `if (n) return []`，@2608540）：收尾后才折成「处理了 Xs」', () => {
    const segments = [tools(), text(ANSWER)];
    expect(absorbActivityRuns(segments, { isStreaming: true })).toEqual([]);
    expect(absorbActivityRuns(segments, { isStreaming: false })).toHaveLength(1);
    /* 不传选项 = 旧行为（保持向后兼容）。 */
    expect(absorbActivityRuns(segments)).toHaveLength(1);
  });
});

describe('图 8：展开后的折叠面板里能看到中途说明', () => {
  it('`textItems` 交错 ⇒ 中途正文与工具段一起进 `vS`(`agent-steps-summary`)', () => {
    const { container } = render(
      <MessageBubble
        message={assistantMessage({
          /* 流式落库：工具事件之前先说了一段话，工具之后才是最终回答。 */
          textItems: [
            { content: NARRATION, startedAt: 600 },
            { content: ANSWER, startedAt: 7_000 },
          ],
        })}
        agentTask={TASK}
        agentControls={AGENT_CONTROLS}
      />,
    );
    const summary = container.querySelector('[data-testid="agent-steps-summary"]');
    expect(summary).not.toBeNull();
    /* 中途说明**在面板内部**，最终回答在面板**外面**（官方 `absorbTextInRange` 的语义）。 */
    expect(summary!.textContent).toContain(NARRATION);
    expect(summary!.textContent).not.toContain(ANSWER);
    expect(container.textContent).toContain(ANSWER);
  });

  it('中途说明与工具段同处一个吸收区间；面板内顺序 = 说明 → 工具行', () => {
    const { container } = render(
      <MessageBubble
        message={assistantMessage({
          textItems: [
            { content: NARRATION, startedAt: 600 },
            { content: ANSWER, startedAt: 7_000 },
          ],
        })}
        agentTask={TASK}
        agentControls={AGENT_CONTROLS}
      />,
    );
    const summary = container.querySelector('[data-testid="agent-steps-summary"]')!;
    const html = summary.innerHTML;
    expect(html.indexOf(NARRATION.slice(0, 8))).toBeLessThan(html.indexOf('读取更新后的剧本'));
  });

  it('`autoCollapse` 到点收起后，摘要行文案仍是官方「处理了 {duration}」', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <MessageBubble
          message={assistantMessage({
            textItems: [{ content: NARRATION, startedAt: 600 }, { content: ANSWER, startedAt: 7_000 }],
          })}
          agentTask={TASK}
          agentControls={AGENT_CONTROLS}
        />,
      );
      act(() => { vi.advanceTimersByTime(400); });
      expect(container.querySelector('[data-testid="agent-steps-summary"] [data-state]')?.getAttribute('data-state'))
        .toBe('closed');
      expect(container.querySelector('[data-testid="agent-steps-summary"]')?.textContent).toContain('处理了 5s');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('分段器：正文 item 按 `contents` 顺序成段', () => {
  it('`buildActivitySegmentsFromContents` 保留中途正文段', () => {
    const segments = buildActivitySegmentsFromContents([
      { type: 'text', content: NARRATION, startedAt: 600 },
      {
        type: 'tool_event',
        content: { schema_version: 'tool_event.v1', tool: 'read_file', status: 'completed', tool_call_id: 'call-1' },
        startedAt: 1_000,
        endedAt: 6_000,
      },
      { type: 'text', content: ANSWER, startedAt: 7_000 },
    ]);
    expect(segments.map((segment) => segment.kind)).toEqual(['text', 'tools', 'text']);
  });
});
