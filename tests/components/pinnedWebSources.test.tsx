// @vitest-environment jsdom
/**
 * 官方 `RF`(`PinnedWebSearchSources`) 与 `showCardIndex`(`fnt`) —— 覆盖表 §34.4 记的第二笔「已知代价」。
 *
 * 官方（`vendor-pkg-canvas-ChpWx5JY.js`）：
 * ```js
 * // `RF` 全 bundle 只有两个挂载点：
 * //   ① 吸收分支： <FF …>…</FF><RF items={toolItems} isStreaming={!1} hasFollowingVisibleContent showCardIndex={ge}/>
 * //   ② kh 折叠分支：<FF durationMs>{list}</FF><RF items={c} isStreaming hasFollowingVisibleContent showCardIndex={l}/>
 * const fnt = (text, sourcesByUrl=new Map()) => { … }   // 正文是否引用了来源 ⇒ `ge` = showCardIndex
 * ```
 * 验证分级 = **(b) jsdom 真 DOM + 纯函数**。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import { hasSourceCitation } from '../../src/services/chat/webSourceDisplay';
import type { AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage, WebSource } from '../../src/types/chat';

const AGENT_CONTROLS = {
  onResolveApproval: () => {}, mediaModelOptions: [], mediaModelAvailability: {}, onStop: () => {},
} as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

const SOURCES: WebSource[] = [
  { url: 'https://example.com/a', title: '来源甲', citationId: 'S1', favicon: '' },
  { url: 'https://example.org/b', title: '来源乙', citationId: 'S2', favicon: '' },
];

const ANSWER = '结论见 [S1]，另有补充';

function toolStep(): AgentStep {
  return {
    id: 's1', taskId: 'task-1', index: 0, kind: 'tool', title: '联网搜索',
    status: 'succeeded', createdAt: 1_000, updatedAt: 6_000,
    toolCall: { callId: 'call-1', toolId: 'web_search', retryCount: 0, startedAt: 1_000, finishedAt: 6_000 },
  };
}
const TASK = {
  id: 'task-1', goal: '测试', status: 'completed', steps: [toolStep()], createdAt: 1, updatedAt: 2,
} as AgentTask;

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

describe('官方 `fnt`：正文是否引用了来源', () => {
  it('裸标号 `[1]` / 脚注 `[^1]` / 行内链接 `[1](https://…)` / MTV 的 `[S1]` 都算引用', () => {
    expect(hasSourceCitation('见 [1]', [{ url: 'https://a', citationId: 'S1' }])).toBe(true);
    expect(hasSourceCitation('见 [^1]', [{ url: 'https://a', citationId: 'S1' }])).toBe(true);
    expect(hasSourceCitation('见 [1](https://a/b)', [])).toBe(true);
    expect(hasSourceCitation('见 [S1]', [{ url: 'https://a', citationId: 'S1' }])).toBe(true);
  });

  it('标号在来源表里找不到 / 没有标号 ⇒ 不算引用', () => {
    expect(hasSourceCitation('见 [9]', [{ url: 'https://a', citationId: 'S1' }])).toBe(false);
    expect(hasSourceCitation('完全没引用', SOURCES)).toBe(false);
    /* 前面是字母数字（`a[1]`）官方 `cN` 不认；`[1](` 之后不是 http 也不算行内链接。 */
    expect(hasSourceCitation('a[1]', [{ url: 'https://a', citationId: 'S1' }])).toBe(false);
    expect(hasSourceCitation('见 [1](ftp://a)', [{ url: 'https://a', citationId: 'S1' }])).toBe(false);
    expect(hasSourceCitation('', SOURCES)).toBe(false);
  });
});

describe('官方 `RF`：折叠面板下方的钉住来源卡', () => {
  it('被吸收的步骤区间之后渲染 `web-search-sources-pinned`，且顺序在摘要**之后**', () => {
    const { container } = render(
      <MessageBubble
        message={assistantMessage({
          sources: SOURCES,
          textItems: [
            { content: '先联网查一下', startedAt: 600 },
            { content: ANSWER, startedAt: 7_000 },
          ],
        })}
        agentTask={TASK}
        agentControls={AGENT_CONTROLS}
      />,
    );
    const pinned = container.querySelector('[data-testid="web-search-sources-pinned"]');
    expect(pinned).not.toBeNull();
    const html = container.innerHTML;
    expect(html.indexOf('data-testid="agent-steps-summary"'))
      .toBeLessThan(html.indexOf('data-testid="web-search-sources-pinned"'));
    /* 来源名走官方 `ax`/`Foe`：单词标题（无分隔符）会**回落到域名** —— 这里断言域名。 */
    expect(pinned!.textContent).toContain('example.com');
  });

  it('没有来源 ⇒ 不渲染 `RF`（官方 `cot(items)` 为空返回 `null`）', () => {
    const { container } = render(
      <MessageBubble
        message={assistantMessage({
          textItems: [
            { content: '先联网查一下', startedAt: 600 },
            { content: ANSWER, startedAt: 7_000 },
          ],
        })}
        agentTask={TASK}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(container.querySelector('[data-testid="web-search-sources-pinned"]')).toBeNull();
    expect(container.querySelector('[data-testid="agent-steps-summary"]')).not.toBeNull();
  });

  it('正文引用来源 ⇒ 卡片带编号（`showCardIndex`）；未引用 ⇒ 不带编号', () => {
    /* ⚠️ 编号只存在于**卡片**档（官方 `LD`(pill) 没有 index）；官方 `Qtt`：带图来源 ≥3 ⇒ 全部走卡片。
       所以这里给三条**带图**来源，才能观察 `showCardIndex` 的效果。 */
    const withImages: WebSource[] = [
      ...SOURCES,
      { url: 'https://example.net/c', title: '来源丙', citationId: 'S3', favicon: '' },
    ].map((source, index) => ({
      ...source,
      image: `https://img.example/${index}.png`,
    }));
    const indexBadges = (root: HTMLElement) => root.querySelectorAll('[data-testid="web-search-source-card-index"]');

    const cited = render(
      <MessageBubble
        message={assistantMessage({
          sources: withImages,
          textItems: [{ content: '先查', startedAt: 600 }, { content: ANSWER, startedAt: 7_000 }],
        })}
        agentTask={TASK}
        agentControls={AGENT_CONTROLS}
      />,
    );
    const citedPinned = cited.container.querySelector('[data-testid="web-search-sources-pinned"]')!;
    expect(indexBadges(citedPinned).length).toBeGreaterThan(0);
    cleanup();

    const uncited = render(
      <MessageBubble
        message={assistantMessage({
          content: '没有任何引用',
          sources: withImages,
          textItems: [{ content: '先查', startedAt: 600 }, { content: '没有任何引用', startedAt: 7_000 }],
        })}
        agentTask={TASK}
        agentControls={AGENT_CONTROLS}
      />,
    );
    const uncitedPinned = uncited.container.querySelector('[data-testid="web-search-sources-pinned"]')!;
    expect(uncitedPinned).not.toBeNull();
    expect(indexBadges(uncitedPinned)).toHaveLength(0);
  });
});
