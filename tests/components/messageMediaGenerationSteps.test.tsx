// @vitest-environment jsdom
/**
 * **用户实测复现**：「生成2只非洲象 9:16尺寸」那条 MTV 助手消息，只渲染了
 * 【图片生成 卡片】+ 一句正文 + 「✓ 已添加到画布」，**没有**官方那行「处理了 Xs ⌄」与操作行。
 *
 * 根因（真机 dump：`useAppStore.agentTasks` 里该消息的任务只有**一步**）：
 * ```
 * step = { kind:'approval', toolCall:{ toolId:'media_generate' }, approval:{ kind:'media_generation', status:'approved' } }
 * ```
 * `agentActivityItems.stepToToolEvent` 把这一步**改道成官方确认卡**（round 117 裁决）
 * ⇒ `contents` 里只有 `generation_confirmation` 一张卡 + 正文
 * ⇒ 官方 `lae` 的 `F` 分块（`vendor-pkg-canvas-ChpWx5JY.js` @2606530，
 *   `if(ib(Ce)||dg(Ce)){xe();Pe();ue.push({kind:"normal",...});continue}`）里**没有任何
 *   `kind:"collapsible"` 块** ⇒ 消息级吸收 `O`（`if(n)return[]` 之后 `xe<0||!ue(Pe)` ⇒ `continue`）
 * 没有可吸收块 ⇒ `FF`(`AgentStepsSection`，「处理了 Xs」) 与 `AC`/`PE`（操作行）全都不渲染。
 *
 * 修法：把「已批准的媒体生成」按官方**两项**装配（确认卡 + 被执行的工具事件，
 * 见 `agentMessageContents.stepToOfficialToolEventItems`）。本文件钉住修好后的 DOM。
 *
 * 验证分级 = **(b) jsdom 真 DOM**（生产者的纯逻辑断言在
 * `tests/services/chat/buildMessageContents.test.ts`）。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {}, mediaModelOptions: [], mediaModelAvailability: {}, onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

const ANSWER = '已生成 9:16 竖版的两只非洲象图片。';
const CALL_ID = 'call_f8f32c8634b54ca68adb661666bd7c20';

/** 真机那条任务的唯一一步（字段抄自真机 dump，时间戳缩成小整数）。 */
function mediaStep(over: Partial<AgentStep> = {}): AgentStep {
  return {
    id: 'step-0',
    taskId: 'task-1',
    index: 0,
    kind: 'approval',
    title: '生成媒体内容',
    status: 'succeeded',
    createdAt: 1_000,
    updatedAt: 56_000,
    toolCall: {
      callId: CALL_ID,
      toolId: 'media_generate',
      inputSummary: '使用 general/provider-tudou-vgcgsv生成图片，输出到对话',
      retryCount: 0,
      startedAt: 1_000,
      finishedAt: 56_000,
      effect: 'media_generation',
      resultSummary: '媒体内容已生成',
    },
    approval: {
      id: 'step-0-approval',
      kind: 'media_generation',
      status: 'approved',
      summary: '付费媒体生成和重新生成每次都需要确认',
      requestedAt: 1_000,
      resolvedAt: 25_000,
      inputRequest: {
        kind: 'media_model',
        mediaKind: 'image',
        generationRequest: {
          kind: 'image',
          prompt: '两只非洲象，恰好两只，置身非洲稀树草原。',
          modelName: 'general/provider-tudou-vgcgsv',
          aspectRatio: '9:16',
          times: 1,
        },
        selectedModelRef: 'general/provider-tudou-vgcgsv',
      },
    },
    outputSummary: '媒体内容已生成',
    ...over,
  } as AgentStep;
}

function liveTask(over: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1',
    goal: '生成2只非洲象 9:16尺寸',
    status: 'completed',
    steps: [mediaStep()],
    createdAt: 900,
    startedAt: 900,
    completedAt: 100_000,
    updatedAt: 100_000,
    ...over,
  } as AgentTask;
}

function assistantMessage(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    role: 'assistant',
    content: ANSWER,
    timestamp: 1_000,
    status: 'done',
    agentTaskId: 'task-1',
    ...over,
  };
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(cleanup);

describe('真机复现：单条 `media_generate` 审批也必须有官方「处理了 Xs」+ 操作行', () => {
  it('① 渲染出 `agent-steps-summary`（处理了 Xs），且**在正文之前**', () => {
    const { container } = render(
      <MessageBubble message={assistantMessage()} agentTask={liveTask()} agentControls={AGENT_CONTROLS} />,
    );
    const summary = container.querySelector('[data-testid="agent-steps-summary"]');
    expect(summary).not.toBeNull();
    /* 官方 `workSummaryWithDuration` = 「处理了 {{duration}}」。 */
    expect(summary?.textContent ?? '').toContain('处理了');
    const html = container.innerHTML;
    expect(html.indexOf('data-testid="agent-steps-summary"')).toBeLessThan(html.indexOf(ANSWER));
  });

  it('② 展开位置里有操作行，文案走官方口径（`request.description` = 步骤标题）', () => {
    const { container } = render(
      <MessageBubble message={assistantMessage()} agentTask={liveTask()} agentControls={AGENT_CONTROLS} />,
    );
    const summary = container.querySelector('[data-testid="agent-steps-summary"]');
    /* 官方 `PE`（`ToolCallStatusLine`）的行本体：`output` 或 `Collapsible.Trigger`。 */
    const lines = summary?.querySelectorAll('output, [data-state] button') ?? [];
    const texts = [...lines].map((node) => node.textContent ?? '');
    expect(texts.join('|')).toContain('生成媒体内容');
  });

  it('③ 生成确认卡仍在（官方 `dg` → `qet`），没有被操作行取代', () => {
    const { container } = render(
      <MessageBubble message={assistantMessage()} agentTask={liveTask()} agentControls={AGENT_CONTROLS} />,
    );
    expect(container.textContent ?? '').toContain('图片生成');
  });

  it('④ 审批未决时**不**出现分组（官方那时只有确认卡）', () => {
    const pending = liveTask({
      steps: [mediaStep({
        status: 'waiting_approval',
        toolCall: { ...mediaStep().toolCall!, finishedAt: undefined },
        approval: { ...mediaStep().approval!, status: 'pending', resolvedAt: undefined },
      } as Partial<AgentStep>)],
      status: 'waiting_approval',
    });
    const { container } = render(
      <MessageBubble message={assistantMessage({ status: 'executing' })} agentTask={pending} agentControls={AGENT_CONTROLS} />,
    );
    expect(container.querySelector('[data-testid="agent-steps-summary"]')).toBeNull();
    /* 确认卡仍然在（它是审批 UI，不能丢）。 */
    expect(container.textContent ?? '').toContain('图片生成');
  });
});
