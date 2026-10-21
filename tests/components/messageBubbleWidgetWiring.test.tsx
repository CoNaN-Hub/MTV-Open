// @vitest-environment jsdom
/**
 * widget 族在消息渲染器里的**接线**回归（round 27 由主 agent 接线）。
 *
 * 官方 `$M`（`vendor-pkg-canvas-ChpWx5JY.js` **@2426950 邻域**，逐字）：
 * ```js
 * if(MD(e)) return null;                                   // prepare_widget —— 不渲染
 * if(AD(e)){ const T=e.content; ... }                      // mcpApp（未移植，见 §6 #5）
 * if(aT(e)){ const T=e.content;
 *   return (T.status==="pending"||T.status==="started")&&t ? <fre title={T.request?.title}
 *                                                                 messages={T.request?.loading_messages}/>
 *        : T.status==="completed" ? <mre content={T} onSendPrompt={...}/> : null }
 * if(lT(e)){ const T=e.content; return T.status!=="completed" ? null : <ure content={T}/> }
 * ```
 * （`t` = `isStreaming`；`fre`→`ShowWidgetLoading`、`mre`→`ShowWidgetCard`、`ure`→`ShowHtmlCard`。）
 *
 * 本测试走 **(b) jsdom + @testing-library 真 DOM**：用 MTV 的真实 `AgentTask`/`AgentStep` 形状，
 * 让 `stepToToolEvent` → `classifyToolEventFamily` 走完整链路，再断言 DOM。
 * **未做 (a) live CDP**（live 画布已有会话，这些卡片不在 DOM 里，且不许点用户画布）。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import type { AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    role: 'assistant',
    content: '',
    timestamp: 1_000,
    status: 'complete',
    ...over,
  };
}

function step(over: Partial<AgentStep> & { id: string }): AgentStep {
  return {
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: '步骤',
    status: 'succeeded',
    createdAt: 1_000,
    updatedAt: 2_000,
    ...over,
  };
}

function task(steps: AgentStep[]): AgentTask {
  return {
    id: 'task-1',
    goal: '测试',
    status: 'completed',
    steps,
    createdAt: 1,
    updatedAt: 2,
  } as AgentTask;
}

/** 造一个带指定官方工具名的工具步骤（`mtvToolToOfficial` 对未映射 id 原样透传）；
 *  `officialRequest` 是「工具生产者」把官方卡片载荷并进 `content.request` 的通道。 */
function toolStep(
  id: string,
  toolId: string,
  status: AgentStep['status'] = 'succeeded',
  officialRequest?: Record<string, unknown>,
): AgentStep {
  return step({
    id,
    status,
    toolCall: {
      callId: `call-${id}`,
      toolId,
      retryCount: 0,
      startedAt: 1_000,
      finishedAt: 2_000,
      ...(officialRequest ? { officialRequest } : {}),
    },
  });
}

/** `showTimeline` 需要 `agentControls`；工具行才会渲染。 */
const AGENT_CONTROLS = {
  onResolveApproval: () => {},
  mediaModelOptions: [],
  mediaModelAvailability: {},
  onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

function renderBubble(agentTask: AgentTask, msg = message()) {
  return render(<MessageBubble message={msg} agentTask={agentTask} agentControls={AGENT_CONTROLS} />);
}

beforeEach(() => {
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
});

describe('MessageBubble —— 官方 `$M` 的 widget 族接线', () => {
  it('`lT`(show_html) + `status==="completed"` ⇒ 渲染 `ShowHtmlCard`（官方 `ure`）', () => {
    const { queryByText } = renderBubble(task([
      toolStep('s1', 'show_html', 'succeeded', { artifact_path: 'widget/abc.html', title: '我的网页' }),
    ]));
    /* 官方 `ure` 的副标题是 `children:c` = `chatAdapter.artifactPanel.openInteractivePage`
       （**不是** `description`；见 widget 族落地报告的文档纠偏）。 */
    expect(queryByText('打开互动作品')).not.toBeNull();
    expect(queryByText('我的网页')).not.toBeNull();
  });

  it('`lT`(show_html) + `status!=="completed"` ⇒ `null`（官方 `T.status!=="completed" ? null : …`）', () => {
    const { queryByText } = renderBubble(task([
      toolStep('s1', 'show_html', 'running', { artifact_path: 'widget/abc.html' }),
    ]));
    expect(queryByText('打开互动作品')).toBeNull();
  });

  it('`lT`(show_html) + completed 但缺 `artifact_path` ⇒ 官方 `i ? … : null` 走空分支', () => {
    const { queryByText } = renderBubble(task([toolStep('s1', 'show_html')]));
    expect(queryByText('打开互动作品')).toBeNull();
  });

  it('`aT`(show_widget) + `completed` ⇒ 渲染 `ShowWidgetCard`（官方 `mre`）', () => {
    const { container } = renderBubble(task([
      toolStep('s1', 'show_widget', 'succeeded', { title: '我的小组件', widget_code: '<div>hi</div>' }),
    ]));
    /* 官方 `mre` 把 `title` 放在 iframe 的 `title` 属性上（`title ?? "Widget"`），不是文本节点。 */
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('title')).toBe('我的小组件');
    /* ⚠️ 这里**不断言**「Loading widget...」消失：官方 `mre` 的 loading 行条件是
       `!(status === 'rendered' && measured)`，而 iframe 的 `render` postMessage 在 jsdom 里不会发生
       ⇒ 官方行为下该行本就仍在（不是缺陷）。`title` 命中即证明官方载荷已到达卡片。 */
  });

  it('`aT`(show_widget) + `pending` 且流式中 ⇒ 渲染 `ShowWidgetLoading`（官方 `fre`）', () => {
    const { container } = renderBubble(
      task([toolStep('s1', 'show_widget', 'running', { title: '正在搭小组件' })]),
      message({ status: 'streaming' }),
    );
    /* 官方 `fre` 只是把 `{title, messages}` 原样交给 `pre`（`WidgetLoadingPlaceholder`）。 */
    expect(container.textContent).toContain('正在搭小组件');
  });

  it('`MD`(prepare_widget) ⇒ 什么都不渲染（官方 `return null`）', () => {
    const { container } = renderBubble(task([toolStep('s1', 'prepare_widget')]));
    expect(container.textContent).not.toContain('prepare_widget');
  });

  it('widget 事件不会同时落进普通工具行（`restToolItems` 已排除）', () => {
    const { container } = renderBubble(task([
      toolStep('s1', 'show_html', 'succeeded', { artifact_path: 'widget/abc.html' }),
      toolStep('s2', 'canvas_query'),
    ]));
    expect(container.textContent).toContain('打开互动作品');
    expect(container.textContent).not.toContain('show_html');
    /* 普通工具行仍在（`canvas_query` → 官方 `canvas_context`）。 */
    expect(container.textContent).toContain('读取画布');
  });
});
