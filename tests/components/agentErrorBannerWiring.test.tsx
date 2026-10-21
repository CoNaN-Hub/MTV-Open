// @vitest-environment jsdom
/**
 * **Agent 报错 UI 按官方收口**（覆盖表 §91）—— 官方逐字依据：
 *
 * · 错误横幅组件 `Qrt` @**2465523**（`vendor-pkg-canvas-CvbAwZyy.js`，逐字）：
 *   `role="alert"` + `data-testid="agent-error-banner"`，图标 `size-5 … strokeWidth:1.8`，
 *   按钮 `disabled={!n||t||r}` + `Promise.resolve(n()).catch(()=>{}).finally(()=>i(!1))`。
 * · 分派 `$M` @**2466855**（逐字）：`if(e.type==="agent_error") return s.jsx(Qrt,{message:…})`
 *   —— 官方对 `agent_error` 是 **`return`**，同一处不再渲染第二份文字。
 *   `data-testid="agent-error-banner"` 在全 bundle 的命中数 = **1**（`_findall2.mjs` 实测）
 *   ⇒ 官方**只有这一条**错误横幅渲染路径，没有 `status==='error'` 那种第二条。
 * · 文案 `Jct` @**2713029**（逐字）：`e.message?.trim() ? e.message : t(chatAdapter.errors.…)`
 *   —— **有原文就原样显示、从不加前缀**；没有就用官方 i18n 兜底键。
 * · 追加写入口 `appendMessageContent` @**41087**（逐字）：
 *   `contents:[...(c.contents||[]), o]` ⇒ `agent_error` 追加在 `contents` 末尾。
 *
 * 本文件锁定 4 个真回归点（用户实测截图：同一句报错出现**两次**）：
 *   ① `status==='error'` 时**只**渲染一处错误（横幅），且整页**不含** MTV 自造前缀；
 *   ② 横幅文案取自官方通道（原文优先；没有原文时用官方 i18n 兜底句，且跟随语言切换）；
 *   ③ 无 `onRetry` / 正在流式时按钮 `disabled`（官方 `disabled={!n||t||r}`）；
 *   ④ `contents` 里**没有** `agent_error` 时**不**渲染横幅（渲染由 item 决定，不由 status 决定）。
 *
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import {
  AGENT_ERROR_FALLBACK,
  SEND_FAILED,
  STREAM_PROCESSING_ERROR,
  resolveAgentErrorMessage,
} from '../../src/services/chat/agentErrorMessage';
import { buildMessageContents } from '../../src/services/chat/messageContents';
import type { AgentMessageContentItem } from '../../src/services/chat/agentMessageContents';
import type { AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {},
  mediaModelOptions: [],
  mediaModelAvailability: {},
  onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

/** 用户实测截图里那句话（官方 `Jct` 的 `e.message` ⇒ 必须**原样**显示）。 */
const RAW_ERROR = 'system cpu overloaded (current: 91.4%, threshold: 90%)';

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000, status: 'done', ...over };
}

function toolStep(id: string, toolId: string, at: number): AgentStep {
  return {
    id,
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: `步骤 ${id}`,
    status: 'succeeded',
    createdAt: at,
    updatedAt: at + 10,
    toolCall: { callId: `call-${id}`, toolId, retryCount: 0, startedAt: at, finishedAt: at + 10 },
  };
}

function task(steps: AgentStep[], over: Partial<AgentTask> = {}): AgentTask {
  return { id: 'task-1', goal: '测试', status: 'running', steps, createdAt: 1, updatedAt: 2, ...over } as AgentTask;
}

function toolItem(tool: string, at: number): AgentMessageContentItem {
  return {
    type: 'tool_event',
    content: { schema_version: 'tool_event.v1', type: 'tool_event', tool, status: 'completed' },
    startedAt: at,
  } as AgentMessageContentItem;
}

/** 页面上某段文字出现几次（用户实测的「同一句话出现两次」就是这里 > 1）。 */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

beforeEach(() => setLocale('zh-CN'));
afterEach(() => cleanup());

describe('§91 —— Agent 报错只以官方 `agent_error` 横幅出现', () => {
  it('① `status==="error"` 只渲染一处错误，且页面不含 MTV 自造前缀', () => {
    const steps = [toolStep('s1', 'canvas_query', 2_000)];
    const { container } = render(
      <MessageBubble
        message={message({ status: 'error', agentError: RAW_ERROR })}
        agentTask={task(steps, { status: 'failed', errorMessage: RAW_ERROR })}
        agentControls={AGENT_CONTROLS}
        onRetryMessage={() => {}}
      />,
    );

    /* 官方唯一那条横幅（`data-testid` 逐字）。 */
    const banners = screen.getAllByTestId('agent-error-banner');
    expect(banners).toHaveLength(1);
    /* 文案 = 官方 `Jct` 的 `e.message`（原样，无前缀）。 */
    expect(banners[0].textContent).toContain(RAW_ERROR);

    /* 真回归点：同一句话**只出现一次**（用户实测截图里出现两次）。 */
    expect(occurrences(container.textContent ?? '', RAW_ERROR)).toBe(1);
    /* MTV 自造前缀（官方产物里没有这种句子）在页面上**一个字都不该有**。 */
    expect(container.textContent ?? '').not.toContain('处理失败');
    /* 官方分派对 `agent_error` 是 `return` ⇒ 不再渲染别处的同一句话；正文保持空。 */
    expect(container.textContent ?? '').not.toContain('响应失败');
  });

  it('② 横幅文案走官方通道：原文优先，其次官方 i18n 兜底键（且跟随语言切换）', () => {
    /* (a) 有原文 ⇒ 原文胜出（官方 `e.message?.trim() ? e.message : …`）。 */
    const first = render(
      <MessageBubble
        message={message({ status: 'error', agentError: RAW_ERROR })}
        agentTask={task([], { status: 'failed', errorMessage: '任务级兜底文案' })}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(screen.getByTestId('agent-error-banner').textContent).toContain(RAW_ERROR);
    expect(screen.getByTestId('agent-error-banner').textContent).not.toContain('任务级兜底文案');
    first.unmount();

    /* (b) 没有原文 ⇒ 官方 `chatAdapter.errors.agentErrorFallback` 兜底句（zh = 键本身）。 */
    const second = render(
      <MessageBubble message={message({ status: 'error' })} agentTask={task([])} agentControls={AGENT_CONTROLS} />,
    );
    expect(screen.getByTestId('agent-error-banner').textContent).toContain(AGENT_ERROR_FALLBACK);
    second.unmount();

    /* (c) 同一句兜底在 en-US 下等于官方 en 词典原文（证明接的是官方 i18n 键，不是硬编码中文）。 */
    setLocale('en-US');
    render(
      <MessageBubble message={message({ status: 'error' })} agentTask={task([])} agentControls={AGENT_CONTROLS} />,
    );
    expect(screen.getByTestId('agent-error-banner').textContent).toContain('The Agent run failed. Please try again.');
    setLocale('zh-CN');
  });

  it('③ 无 `onRetry` 或正在流式时，重试按钮 `disabled`（官方 `disabled={!n||t||r}`）', () => {
    /* (a) 没传 `onRetryMessage` ⇒ 官方 `!n` ⇒ 置灰。 */
    const withoutRetry = render(
      <MessageBubble message={message({ status: 'error', agentError: RAW_ERROR })} agentControls={AGENT_CONTROLS} />,
    );
    expect(screen.getByTestId('agent-error-banner').querySelector('button')?.disabled).toBe(true);
    withoutRetry.unmount();

    /* (b) 传了 `onRetry` 但消息仍在流式 ⇒ 官方 `t`(isStreaming) ⇒ 置灰。 */
    const streaming = render(
      <MessageBubble
        message={message({ status: 'error', agentError: RAW_ERROR, mediaStatus: 'generating' })}
        agentControls={AGENT_CONTROLS}
        onRetryMessage={() => {}}
      />,
    );
    expect(screen.getByTestId('agent-error-banner').querySelector('button')?.disabled).toBe(true);
    streaming.unmount();

    /* (c) 不在流式且给了 `onRetry` ⇒ 可按（官方唯一放行组合）。 */
    render(
      <MessageBubble
        message={message({ status: 'error', agentError: RAW_ERROR })}
        agentControls={AGENT_CONTROLS}
        onRetryMessage={() => {}}
      />,
    );
    expect(screen.getByTestId('agent-error-banner').querySelector('button')?.disabled).toBe(false);
  });

  it('④ `contents` 里没有 `agent_error` 时**不**渲染横幅（渲染由 item 决定）', () => {
    /* 注意 `status` 仍是 `done`：官方横幅只在 `agent_error` item 存在时出现。 */
    const { queryByTestId } = render(
      <MessageBubble
        message={message({ contents: [toolItem('canvas_query', 1_000)] })}
        agentTask={task([])}
        agentControls={AGENT_CONTROLS}
        onRetryMessage={() => {}}
      />,
    );
    expect(queryByTestId('agent-error-banner')).toBeNull();
  });

  it('④b `message.contents` 完全接管时不丢已有项，`agent_error` 追加在末尾（官方 `appendMessageContent`）', () => {
    const contents: AgentMessageContentItem[] = [toolItem('canvas_query', 1_000)];
    const { container } = render(
      <MessageBubble
        message={message({ status: 'error', agentError: RAW_ERROR, contents })}
        agentTask={task([])}
        agentControls={AGENT_CONTROLS}
        onRetryMessage={() => {}}
      />,
    );
    /* 已有的 tool_event **没有**被 `agent_error` 挤掉：它仍在（被官方 `vS`/`AgentStepsSection`
       折叠成「已完成 N 个操作」摘要 —— 官方把「工具段之后有可见项」才折叠，而横幅正是那个可见项）。 */
    expect(container.textContent ?? '').toContain('已完成 1 个操作');
    /* 横幅照常出现（说明「完全接管」路径也叠上了官方那条追加）。 */
    expect(screen.getAllByTestId('agent-error-banner')).toHaveLength(1);
  });
});

describe('§91 —— 官方 `Jct` 逐字语义（纯逻辑）', () => {
  const identity = (text: string): string => text;

  it('有 `message` 就原样返回，**不加任何前缀**', () => {
    expect(resolveAgentErrorMessage({ message: `  ${RAW_ERROR}  ` }, identity)).toBe(RAW_ERROR);
  });

  it('没有 `message` ⇒ `agentErrorFallback`；`runtime_stream_timeout` ⇒ 两个超时键', () => {
    expect(resolveAgentErrorMessage({}, identity)).toBe(AGENT_ERROR_FALLBACK);
    expect(resolveAgentErrorMessage({ reason: 'runtime_stream_timeout' }, identity)).toBe(
      '云端任务长时间未返回进展，已超时。可以重试继续。',
    );
    /* 官方第三个参数 `n`（压缩中）走 `compactionTimeout`。 */
    expect(resolveAgentErrorMessage({ reason: 'runtime_stream_timeout' }, identity, true)).toBe(
      '云端任务在压缩上下文期间超时，本轮已停止。此前完成的操作不会回滚；继续时请复用已有成果。',
    );
  });

  it('官方写入口用到的 `streamProcessingError` / `sendFailed` 也是官方原文', () => {
    expect(STREAM_PROCESSING_ERROR).toBe('流式处理出错，请重试。');
    expect(SEND_FAILED).toBe('抱歉，发生了错误。请稍后重试。');
  });

  it('`buildMessageContents` 产官方 `agent_error` item（`{type,content}`，追加在末尾）', () => {
    const contents = buildMessageContents({ content: '正文', timestamp: 1_000, errorMessage: RAW_ERROR });
    expect(contents.map((item) => item.type)).toEqual(['text', 'agent_error']);
    const last = contents[contents.length - 1];
    expect(last).toEqual({ type: 'agent_error', content: RAW_ERROR });
    /* 没有 `errorMessage` ⇒ 不产 item（官方「没有 agent_error item 就没有横幅」）。 */
    expect(buildMessageContents({ content: '正文', timestamp: 1_000 }).map((item) => item.type)).toEqual(['text']);
  });
});
