// @vitest-environment jsdom
/**
 * 用户第 53 轮实测定点修复的回归：
 *   ① `整理中…` 文案全透明（`ShimmerText` 的 `var(--color-muted-foreground)` 在 MTV 未定义）
 *   ② 右缘导轨「看不见」（状态类与基础类冲突，官方 `twMerge` 会去重、MTV 拼字符串不会）
 *   ③ 中途正文被从句子中间切断（工具边界前的待刷新文本并进了新 item）
 *   ④ composer 里的节点引用芯片形状不对（自造彩条 + `#编号`；官方是 `#333` + 14px 缩略图）
 * 验证分级 = **(b) jsdom 真 DOM + (d) 源码级**。
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ChatComposerEditor from '../../src/components/chat/ChatComposerEditor';
import QueryLocator from '../../src/components/chat/QueryLocator';
import ThinkingStatusLine from '../../src/components/chat/ThinkingStatusLine';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});
afterEach(cleanup);

function stub(element: HTMLElement, props: Record<string, number>) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(element, key, { configurable: true, get: () => value });
  }
}

describe('① `整理中…` 文案可见（ShimmerText 底色回落）', () => {
  it('流光元素的 `background-image` 带 MTV 的回落底色（不再是未定义变量）', () => {
    const { container } = render(<ThinkingStatusLine streamState="streaming" startedAtMs={null} />);
    const shimmer = container.querySelector('output > span') as HTMLElement | null;
    expect(shimmer).not.toBeNull();
    expect(shimmer!.style.backgroundImage).toContain('var(--color-muted-foreground,');
    expect(shimmer!.style.backgroundImage).toContain('--muted-foreground');
    /* 文案本身在 DOM 里（此前是「有元素但全透明」）。 */
    expect(['思考中...', '处理中...', '运行中...', '整理中...'])
      .toContain((shimmer!.textContent ?? '').trim());
  });
});

describe('② 导轨状态类不再被基础类覆盖', () => {
  function mountRail() {
    const content = document.createElement('div');
    document.body.appendChild(content);
    ['u1', 'u2', 'u3'].forEach((id, index) => {
      const row = document.createElement('div');
      row.setAttribute('data-query-locator-anchor-id', id);
      stub(row, { offsetTop: index * 600 });
      content.appendChild(row);
    });
    const scrollRoot = document.createElement('div');
    document.body.appendChild(scrollRoot);
    stub(scrollRoot, { clientHeight: 600, scrollHeight: 3000, scrollTop: 0 });
    (scrollRoot as unknown as { scrollTo: () => void }).scrollTo = () => {};
    const contentRef = createRef<HTMLElement>();
    const scrollRootRef = createRef<HTMLElement>();
    (contentRef as { current: HTMLElement | null }).current = content;
    (scrollRootRef as { current: HTMLElement | null }).current = scrollRoot;
    return render(<QueryLocator
      anchors={[
        { id: 'u1', label: 'Query 1', previewTitle: '一' },
        { id: 'u2', label: 'Query 2', previewTitle: '二' },
        { id: 'u3', label: 'Query 3', previewTitle: '三' },
      ]}
      contentRef={contentRef}
      scrollRootRef={scrollRootRef}
    />);
  }

  it('每条 tick 的线**只有一个**高度类与一个底色类（否则 CSS 顺序会让基础类赢）', () => {
    const { container } = mountRail();
    const lines = Array.from(container.querySelectorAll<HTMLElement>('[data-testid="query-locator-track-v2"] button > span'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const classes = line.className.split(/\s+/).filter(Boolean);
      const heights = classes.filter((c) => /^h-/.test(c) && !c.startsWith('h-full'));
      /* 第 60 轮：底色改成**显式 rgba**（dev 构建里 g-chat-foreground/NN 没生成 ⇒ 透明）。 */
      const backgrounds = classes.filter((c) => /^bg-\[rgba\(212,212,216,/.test(c));
      expect(heights).toHaveLength(1);
      expect(backgrounds).toHaveLength(1);
    }
  });

  it('默认（未悬浮、且不是当前项）：1px + 24% 透明，与官方 idle 一致；当前项是 2px + 56%', () => {
    const { container } = mountRail();
    const buttons = Array.from(container.querySelectorAll<HTMLElement>('[data-testid="query-locator-track-v2"] button'));
    /* scrollTop = 0 ⇒ 第 1 条是 active（官方 `E`：`w-4 opacity-100` + `h-[2px] bg-chat-foreground/56`）。 */
    const activeLine = buttons[0].querySelector<HTMLElement>('span')!;
    expect(buttons[0].className).toContain('w-4');
    expect(buttons[0].className).toContain('opacity-100');
    expect(activeLine.className).toContain('h-[2px]');
    expect(activeLine.className).toContain('bg-[rgba(212,212,216,0.56)]');
    /* 非当前项 = idle。 */
    const idleLine = buttons[2].querySelector<HTMLElement>('span')!;
    expect(buttons[2].className).toContain('w-2.5');
    expect(buttons[2].className).toContain('opacity-60');
    expect(idleLine.className).toContain('h-px');
    expect(idleLine.className).toContain('bg-[rgba(212,212,216,0.24)]');
  });
});

describe('③ 工具边界先冲刷待刷新正文（不再把一句话劈开）', () => {
  it('源码级：`noteToolEvent` 先 `flushPending()` 再打标记', () => {
    const source = read('src/services/chat/conversationExecutionController.ts');
    const start = source.indexOf('noteToolEvent: () => {');
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, start + 200);
    expect(body.indexOf('flushPending()')).toBeGreaterThan(0);
    expect(body.indexOf('flushPending()')).toBeLessThan(body.indexOf('afterToolEvent = true'));
  });
});

describe('④ composer 的节点引用芯片 = 官方 NodeView 形状', () => {
  it('`#333333` 底 + 14px 缩略图 + 标签；**没有** `#编号`、没有彩色竖条', () => {
    useAppStore.setState({
      nodes: [{
        id: 'n1',
        position: { x: 0, y: 0 },
        /* 官方 `getNodeMetaMap` 读的是 `node.data.type`（不是 React Flow 的 `node.type`）。 */
        data: { type: 'ai-image', label: '额娘深秋', displayId: 15, thumbnailUrl: 'https://img.example/n1.png' },
      }],
    } as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
    const { container } = render(
      <ChatComposerEditor
        value={'@{n1:额娘深秋} 继续'}
        onChange={() => {}}
        onSubmit={() => {}}
        nodeDisplayIds={new Map([['n1', 15]])}
        onMentionQueryChange={() => {}}
        onSlashQueryChange={() => {}}
        placeholder="随心输入"
      />,
    );
    const chip = container.querySelector<HTMLElement>('[data-chat-reference="node"]');
    expect(chip).not.toBeNull();
    /* 官方 NodeView 是三层：`outer[data-mention-node-view]` > `viewWrapper[data-node-view-wrapper]` >
       `span.prompt-chip-node`（样式在 `prompt-chip-node` 规则里：`#333333` / `h-5` / `p-1` / `rounded-[4px]`）。 */
    expect(chip!.getAttribute('data-mention-node-view')).toBe('true');
    const body = chip!.querySelector<HTMLElement>('.prompt-chip-node');
    expect(body).not.toBeNull();
    /* 官方 `renderHTML` 的类：`mention mention-<type>`（这里 type=image；MTV 的 CSS 已确保它不再染蓝/绿/紫）。 */
    expect(body!.className).toContain('mention-image');
    /* 缩略图（官方 `nme` 14×14）。 */
    const thumb = body!.querySelector('img');
    expect(thumb?.getAttribute('src')).toBe('https://img.example/n1.png');
    expect(thumb?.className).toContain('prompt-chip-thumb');
    /* 文案里有标签、**没有** `#15`；也没有 MTV 自造的 indigo 竖条/描边。 */
    expect(body!.textContent).toContain('额娘深秋');
    expect(body!.textContent).not.toContain('#15');
    expect(chip!.innerHTML).not.toContain('indigo');
    /* 源码级：`.prompt-chip-node` 规则确实是官方那套取值。 */
    const css = read('src/styles/prompt.css');
    const ruleStart = css.indexOf('.prompt-chip-node,');
    expect(ruleStart).toBeGreaterThanOrEqual(0);
    const rule = css.slice(ruleStart, ruleStart + 600);
    expect(rule).toContain('background: #333333');
    expect(rule).toContain('border-radius: 4px');
    expect(rule).toContain('color: rgba(255, 255, 255, 0.6)');
  });
});
