// @vitest-environment jsdom
/**
 * 「发送后立刻出现 `[动图 logo] 整理中…`」回归（用户实测：官方有、MTV 整行空白）。
 *
 * 官方 `lae`（`vendor-pkg-canvas-ChpWx5JY.js` 逐字）：
 * ```js
 * t1e = F => F.some(t => t.kind === "collapsible" ? t.items.some(Ug)
 *                          : t.item.type === "text" ? (typeof t.item.content === "string" ? t.item.content : "").trim().length > 0
 *                          : true);                       // 「已经有可见内容」
 * K = n(isStreaming) && !t1e(F);                            // ⇒ 出状态行
 * …
 * K && s.jsx(IC,{streamState:o, thinkingActivity:G, startedAtMs:e.responseStartedAt})
 * IC = MF = <output aria-live="polite" class="inline-flex items-center gap-2 py-1 text-[13px] …">
 *      <img src="/agent-motion/motion-thinking.webp" alt="" class="size-3.5 shrink-0"/>
 *      {streaming ? <ShimmerText duration={1.7} spread={1.4}>{label}</ShimmerText> : <span>{label}</span>}
 *      {elapsedText && <span …>· {elapsedText}</span>}
 *    </output>
 * ```
 * ⚠️ MTV 原来在这条判据上多加了一道 `!showTimeline`；而 `showTimeline` 在 `agentTask` 一建好
 * （`status !== 'completed'`、`steps` 还是 0）就为 true ⇒ 状态行被压掉、那一刻又没有任何 item 可渲染
 * ⇒ **整行空白**（用户实测 图1）。本文件钉住官方判据。
 *
 * 验证分级 = **(b) jsdom 真 DOM + (d) 源码级**。
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {}, mediaModelOptions: [], mediaModelAvailability: {}, onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

/** 刚创建、还没有任何步骤的主任务（`showTimeline` 判据下曾把状态行压掉的就是它）。 */
const RUNNING_TASK = {
  id: 'task-1', goal: 'g', status: 'running', steps: [], createdAt: 1, updatedAt: 2,
} as AgentTask;

function placeholder(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000,
    status: 'streaming', ...over,
  } as ChatMessage;
}

function renderPlaceholder(over: Partial<ChatMessage> = {}, task?: AgentTask) {
  return render(
    <MessageBubble message={placeholder(over)} agentTask={task} agentControls={AGENT_CONTROLS} />,
  );
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});
afterEach(cleanup);

describe('官方 `K`：发送后立刻出状态行', () => {
  it('占位消息（无任务）⇒ `<output>` + 官方动图 + 文案', () => {
    const { container } = renderPlaceholder();
    const output = container.querySelector('output');
    expect(output).not.toBeNull();
    expect(output!.className).toContain('inline-flex items-center gap-2 py-1 text-[13px]');
    expect(output!.getAttribute('aria-live')).toBe('polite');
    const img = output!.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/agent-motion/motion-thinking.webp');
    expect(img?.className).toContain('size-3.5');
    /* 文案取自官方四档（挂载时随机固定一条），这里只要求是其中之一。 */
    expect(['思考中...', '处理中...', '运行中...', '整理中...'])
      .toContain(output!.textContent?.replace(/·.*$/, '').trim());
  });

  it('**刚建好任务、0 步** 时同样要出（这就是用户实测缺失的那一态）', () => {
    const { container } = renderPlaceholder({}, RUNNING_TASK);
    expect(container.querySelector('output')).not.toBeNull();
  });

  it('流式期间 ≥5s 才显示计时（官方 `fx = 5` + `x0` 的 `Xs` 格式）', () => {
    const startedAt = Date.now() - 6_000;
    const { container } = renderPlaceholder({ timestamp: startedAt });
    expect(container.querySelector('output')?.textContent).toMatch(/· \d+s$/);
  });

  it('已经有可见内容（正文或工具项）⇒ 状态行消失（官方 `t1e`）', () => {
    const withText = renderPlaceholder({ content: '部分正文' });
    expect(withText.container.querySelector('output')).toBeNull();
    cleanup();

    const withTool = renderPlaceholder({
      contents: [{ type: 'tool_event', content: { tool: 'web_search', status: 'started' }, startedAt: 1_000 }],
    });
    expect(withTool.container.querySelector('output')).toBeNull();
  });

  it('源码级：`isThinking` 不再依赖 `showTimeline`，而是看 `activitySegments`', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/chat/MessageBubble.tsx'), 'utf8');
    /* 只钉**代码**（注释里对旧判据的引述不算）。 */
    expect(source).not.toContain('&& !showTimeline');
    expect(source).not.toContain('const showTimeline = !!agentTask');
    expect(source).toContain('activitySegments.length === 0');
  });
});
