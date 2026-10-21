// @vitest-environment jsdom
/**
 * **一个媒体生成回合里的多条真实步骤**在官方渲染管线里的落位（DOM 级验证）。
 *
 * 事实（官方证据）：
 *   · 官方把**连续的非联网搜索工具项**合并成**一个**折叠行：`live-assets\vendor-pkg-canvas-ChpWx5JY.js`
 *     @2394514 `jE=e=>BM(e)?"search":"activity"`、@2394546 `PF`（连续同 `jE` ⇒ 同一桶）、
 *     @2394689 `nie`（`exe` 先切 subagent，再 `PF` 分桶）；当前产物
 *     `live-assets-new\vendor-pkg-canvas-CvbAwZyy.js` @2433961 `sk` 判据**逐字相同**。
 *     ⇒ 一行（`ik` @2448014）承载一个桶；桶内每一项在**展开后的** `hie`
 *       （`live-工具行DOM实测.md` §5；本仓 `ToolActivityDetailList`）里各自一行。
 *   · 官方行文案取 `content.request.description`（`Mae` 邻域 → `agentToolLabels.commandDescriptionOf`），
 *     多条目时取**最后一条**的描述。
 *   · 官方折叠摘要时长 `RE` = `min(startedAt)..max(endedAt)`（本仓 `messageContents.itemsDurationMs`）。
 *
 * 所以「一个回合里多条步骤」的可达形态是：
 *   · 折叠摘要「处理了 Xs」= 全部真实步骤的真实时间跨度；
 *   · 行文案 = **最后一条**（提交那一步）的描述（= 官方截图里「提交9:16两只非洲象图像生成」）；
 *   · 展开后逐条列出每一条真实步骤（各自状态/文案）。
 * 本文件把这三条钉住，避免以后有人以为「行文案该是第一步」或「步骤被吞」。
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
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

/** 真机那条任务的审批步（字段抄自真机 dump，时间戳缩成小整数）。 */
function approvalStep(): AgentStep {
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
  } as AgentStep;
}

/** `createToolSubStepReporter` 追加的子步骤（形状与真实落盘一致：独立 callId + 真实时间）。 */
function subStep(index: number, title: string, start: number, end: number): AgentStep {
  return {
    id: `step-${index}`,
    taskId: 'task-1',
    index,
    kind: 'tool',
    title,
    status: 'succeeded',
    createdAt: start,
    updatedAt: end,
    toolCall: {
      callId: `${CALL_ID}~${index}`,
      toolId: 'media_generate',
      inputSummary: title,
      retryCount: 0,
      startedAt: start,
      finishedAt: end,
      effect: 'media_generation',
      resultSummary: title,
    },
    outputSummary: title,
  } as AgentStep;
}

function liveTask(): AgentTask {
  return {
    id: 'task-1',
    goal: '生成2只非洲象 9:16尺寸',
    status: 'completed',
    steps: [
      approvalStep(),
      subStep(1, '确认当前可用的图像生成选项', 25_000, 26_000),
      subStep(2, '确认9:16画面与2K尺寸选项', 26_000, 27_000),
      subStep(3, '提交9:16两只非洲象图像生成', 27_000, 56_000),
    ],
    createdAt: 1_000,
    startedAt: 1_000,
    completedAt: 56_000,
    updatedAt: 100_000,
  } as unknown as AgentTask;
}

function assistantMessage(): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    role: 'assistant',
    content: ANSWER,
    timestamp: 1_000,
    status: 'done',
    agentTaskId: 'task-1',
  } as ChatMessage;
}

function renderMessage() {
  return render(
    <MessageBubble message={assistantMessage()} agentTask={liveTask()} agentControls={AGENT_CONTROLS} />,
  ).container;
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(cleanup);

describe('一个媒体生成回合 = 一个折叠节 + 逐条真实步骤', () => {
  it('① 折叠摘要的时长来自全部步骤的真实时间跨度（官方 `RE`）', () => {
    const container = renderMessage();
    const summary = container.querySelector('[data-testid="agent-steps-summary"]');
    expect(summary).not.toBeNull();
    /* min(startedAt)=1000 … max(endedAt)=56000 ⇒ 55s。 */
    expect(summary?.textContent ?? '').toContain('处理了 55s');
  });

  it('② 折叠行文案 = **最后一条**步骤的描述（官方 `commandDescriptionOf` 取末条）', () => {
    const container = renderMessage();
    const rows = container.querySelectorAll('.group\\/tool-call-line');
    /* 官方 `PF`：连续 activity 项合并成**一个**桶 ⇒ 只有一行。 */
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent ?? '').toContain('提交9:16两只非洲象图像生成');
    /* 前面两条不会串进行文案里（它们属于展开后的明细）。 */
    expect(rows[0].textContent ?? '').not.toContain('确认当前可用的图像生成选项');
  });

  it('③ 展开后每条真实步骤各自一行（官方 `hie` 明细列表）', () => {
    const container = renderMessage();
    const row = container.querySelector('.group\\/tool-call-line') as HTMLElement | null;
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    const items = container.querySelectorAll('[data-tool-activity-item]');
    /* 4 条 = 父步骤（已经被执行的那次 `media_generate`）+ 3 条真实子步骤。
       官方同理：官方那节的最后一行就是被执行的那次工具调用，前面几行是它之前的步骤。 */
    expect(items).toHaveLength(4);
    expect([...items].map((item) => item.textContent)).toEqual([
      '生成媒体内容结果媒体内容已生成',
      '确认当前可用的图像生成选项',
      '确认9:16画面与2K尺寸选项',
      '提交9:16两只非洲象图像生成',
    ]);
    expect([...items].map((item) => item.getAttribute('data-tool-activity-status')))
      .toEqual(['completed', 'completed', 'completed', 'completed']);
  });

  it('④ 步骤状态真实反映失败（不伪装成已完成）', () => {
    const task = liveTask();
    task.steps[3] = {
      ...task.steps[3],
      status: 'failed',
      toolCall: { ...task.steps[3].toolCall!, errorCode: 'AGENT_MEDIA_FAILED' },
      errorCode: 'AGENT_MEDIA_FAILED',
    } as AgentStep;
    const container = render(
      <MessageBubble message={assistantMessage()} agentTask={task} agentControls={AGENT_CONTROLS} />,
    ).container;
    const row = container.querySelector('.group\\/tool-call-line') as HTMLElement | null;
    fireEvent.click(row!);
    const items = container.querySelectorAll('[data-tool-activity-item]');
    expect(items[3].getAttribute('data-tool-activity-status')).toBe('failed');
    expect(items[1].getAttribute('data-tool-activity-status')).toBe('completed');
  });
});

/**
 * **渲染顺序**回归（用户 2026 实测：官方 = 「步骤组 → 生成卡 → 正文」，MTV 修前是「生成卡 → 步骤组」）。
 *
 * 官方成因（逐字偏移见 `agentMessageContents` §7c）：
 *   · 卡片块 `JG === false` ⇒ 永不被 `blt` 吸收、永不进折叠组；
 *   · 折叠组只渲染在 `absorbFrom`（第一个被吸收块）上 ⇒ 卡片在组上/组下**只由它在 `contents` 里的下标决定**。
 * ⇒ 生成卡必须排在「它自己那次生成的工具事件」**之后**、正文之前。
 */
describe('官方版式：步骤组 → 生成卡 → 正文（卡常显、不进折叠组）', () => {
  it('① DOM 顺序 = `agent-steps-summary` < 卡片标题 < 正文', () => {
    const container = renderMessage();
    const html = container.innerHTML;
    const summaryAt = html.indexOf('data-testid="agent-steps-summary"');
    const cardAt = html.indexOf('图片生成');
    const answerAt = html.indexOf(ANSWER);
    expect(summaryAt).toBeGreaterThanOrEqual(0);
    expect(cardAt).toBeGreaterThanOrEqual(0);
    expect(answerAt).toBeGreaterThanOrEqual(0);
    /* 组在卡上方（官方截图版式），卡在正文上方。 */
    expect(summaryAt).toBeLessThan(cardAt);
    expect(cardAt).toBeLessThan(answerAt);
  });

  it('② 卡片**不在**折叠组内部（常显）：不在 `data-agent-steps-content` 里', () => {
    const container = renderMessage();
    const cardTitle = [...container.querySelectorAll('span')]
      .find((node) => (node.textContent ?? '').trim() === '图片生成');
    expect(cardTitle).toBeTruthy();
    expect(cardTitle!.closest('[data-agent-steps-content]')).toBeNull();
  });

  it('③ 任务记录缺 `startedAt`/`completedAt` 时，时长仍走官方 `RE`（min startedAt..max endedAt）', () => {
    /* 用户实测「有时只剩『已处理』」：`taskDurationMs` 为 null/0 时必须回落到区间自身时长，
       不能显示成「已处理」。这里任务的起止时刻被抹掉，只剩工具项自己的真实时间戳：
       父执行项 / 子步骤 = 25_000…56_000 ⇒ 31s。 */
    const task = liveTask();
    task.startedAt = undefined;
    task.completedAt = undefined;
    const container = render(
      <MessageBubble message={assistantMessage()} agentTask={task} agentControls={AGENT_CONTROLS} />,
    ).container;
    const summary = container.querySelector('[data-testid="agent-steps-summary"]');
    expect(summary).not.toBeNull();
    expect(summary?.textContent ?? '').toContain('处理了 31s');
    expect(summary?.textContent ?? '').not.toBe('已处理');
  });

  it('④ `completedAt === startedAt`（时长为 0）不得把摘要退化成「已处理」', () => {
    const task = liveTask();
    task.startedAt = 5_000;
    task.completedAt = 5_000;
    const container = render(
      <MessageBubble message={assistantMessage()} agentTask={task} agentControls={AGENT_CONTROLS} />,
    ).container;
    const summary = container.querySelector('[data-testid="agent-steps-summary"]');
    /* 0 当「没有」⇒ 回落区间时长 31s（官方 `c1e(0)` 也是空串，不会显示「处理了 0s」）。 */
    expect(summary?.textContent ?? '').toContain('处理了 31s');
  });
});
