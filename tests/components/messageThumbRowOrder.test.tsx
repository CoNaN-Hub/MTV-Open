// @vitest-environment jsdom
/**
 * 用户消息的**引用缩略块**回归（覆盖表 §31）。
 *
 * 两个都由用户截图指出、并在官方源码里坐实的缺陷：
 *  1. **顺序反了**：官方用户消息构造器 `XXe`（`vendor-pkg-canvas-D-XuoEJY.js` @2130909 邻域，逐字）
 *     `t.length>0 && c.push({type:"context_nodes",content:{node_ids:t}}); c.push({type:"text",content:l})`
 *     ⇒ `context_nodes` 在**前**、`text` 在**后**；而 `$M` 按 `contents` 顺序渲染
 *     ⇒ 缩略行在**上**、正文在**下**。MTV 原来相反。
 *  2. **缩略图取不到**：官方 `DL` 用 `ND(node.type, data.src)`（@427153）派生 URL；MTV 直接比
 *     `type === 'image'` —— 而 MTV 的节点类型是 `ai-image` / `source-image` / `ai-video` …，
 *     **永远不匹配** ⇒ 恒为空框 + 兜底文档图标。
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { ChatMessage } from '../../src/types/chat';

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    role: 'user',
    content: '分析',
    timestamp: 1_000,
    status: 'complete',
    ...over,
  };
}

function seedNode(over: Record<string, unknown> = {}) {
  useAppStore.setState({
    nodes: [{
      id: 'n1',
      type: 'ai-image',
      position: { x: 0, y: 0 },
      data: {
        type: 'ai-image',
        label: 'visual-art-direction',
        imageUrl: 'https://example.test/ref.png',
        ...over,
      },
    }],
    edges: [],
  } as never);
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(cleanup);

describe('用户消息的引用缩略块', () => {
  it('`ai-image` 节点 ⇒ 渲染真实缩略图（`<img>`），不再是空框兜底图标', () => {
    seedNode();
    const { container } = render(<MessageBubble message={message({ contextNodeIds: ['n1'] })} />);
    const img = container.querySelector('button img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://example.test/ref.png');
    /* 有缩略图 ⇒ 官方类串是 `bg-white/[0.08]`（不是 `border border-white/10`）。 */
    const thumb = img!.closest('button')!;
    expect(thumb.className).toContain('bg-white/[0.08]');
    expect(thumb.className).not.toContain('border-white/10');
  });

  it('`source-image` / `ai-video` 同样被认作有缩略图的类型（官方 `nT` 的 MTV 版映射）', () => {
    seedNode({ type: 'source-image' });
    const a = render(<MessageBubble message={message({ contextNodeIds: ['n1'] })} />);
    expect(a.container.querySelector('button img')).not.toBeNull();
    cleanup();
    seedNode({ type: 'ai-video', imageUrl: undefined, thumbnailUrl: 'https://example.test/frame.png' });
    const b = render(<MessageBubble message={message({ contextNodeIds: ['n1'] })} />);
    expect(b.container.querySelector('button img')?.getAttribute('src'))
      .toBe('https://example.test/frame.png');
  });

  it('纯文本节点（无图）⇒ 仍走官方兜底：`border border-white/10` + 文档图标', () => {
    seedNode({ type: 'ai-text', imageUrl: undefined, thumbnailUrl: undefined });
    const { container } = render(<MessageBubble message={message({ contextNodeIds: ['n1'] })} />);
    const thumb = container.querySelector('button')!;
    expect(thumb.className).toContain('border-white/10');
    expect(container.querySelector('button img')).toBeNull();
  });

  it('**顺序**：缩略块排在正文之前（官方 `XXe`：`context_nodes` → `text`）', () => {
    seedNode();
    const { container } = render(<MessageBubble message={message({ contextNodeIds: ['n1'] })} />);
    const html = container.innerHTML;
    const thumbIndex = html.indexOf('visual-art-direction');
    const textIndex = html.indexOf('分析');
    expect(thumbIndex).toBeGreaterThanOrEqual(0);
    expect(textIndex).toBeGreaterThanOrEqual(0);
    expect(thumbIndex).toBeLessThan(textIndex);
  });

  it('没有引用节点/附件 ⇒ 不渲染缩略行（官方 `LF`：两者都空返回 null）', () => {
    const { container } = render(<MessageBubble message={message()} />);
    expect(container.querySelector('button[title^="node_"]')).toBeNull();
    expect(container.querySelector('button img')).toBeNull();
  });
});
