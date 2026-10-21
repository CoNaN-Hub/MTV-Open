// @vitest-environment jsdom
/**
 * 官方 `query-locator-v2`（聊天右缘 Query 导航轨 + 悬浮预览卡）—— MTV 端口回归。
 *
 * 用户实测（官方截图）：内容变长后右缘出现若干短横标记，鼠标悬停时左侧弹出预览卡
 * （第一行 = 该用户提问正文，含 `@技能` 芯片；第二行 = 其后第一条助手正文，`line-clamp-2`）。
 * 官方符号对照与几何公式见 `src/services/chat/queryLocator.ts` 的头部注释（全部 live 逐字）。
 *
 * 验证分级 = **(b) jsdom 真 DOM（几何用桩值注入） + (d) 源码级**。
 */
import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import QueryLocator from '../../src/components/chat/QueryLocator';
import {
  buildQueryAnchors,
  computeQueryLocatorState,
  EMPTY_QUERY_LOCATOR_STATE,
  truncateQueryLabel,
} from '../../src/services/chat/queryLocator';

afterEach(cleanup);

/** jsdom 的 `clientHeight/scrollHeight/offsetTop` 恒为 0 ⇒ 注入桩值。 */
function stub(element: HTMLElement, props: Record<string, number>) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(element, key, { configurable: true, get: () => value });
  }
}

const ANCHORS = [
  { id: 'u1', label: 'Query 1: 第一问', previewTitle: '第一问', previewText: '第一个回答' },
  { id: 'u2', label: 'Query 2: 第二问', previewTitle: '第二问', previewText: '第二个回答' },
  { id: 'u3', label: 'Query 3: 第三问', previewTitle: '第三问', previewText: '第三个回答' },
];

function mountRail(anchors = ANCHORS, offsets = [0, 600, 1200]) {
  const content = document.createElement('div');
  document.body.appendChild(content);
  /* 官方 `Dit`：靠 `[data-query-locator-anchor-id]` 找**用户消息行**并取 `offsetTop`。 */
  anchors.forEach((anchor, index) => {
    const row = document.createElement('div');
    row.setAttribute('data-query-locator-anchor-id', anchor.id);
    stub(row, { offsetTop: offsets[index] ?? index * 600 });
    content.appendChild(row);
  });
  const scrollRoot = document.createElement('div');
  document.body.appendChild(scrollRoot);
  stub(scrollRoot, { clientHeight: 600, scrollHeight: 3000, scrollTop: 0 });
  const scrollTo = vi.fn();
  (scrollRoot as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo;

  const contentRef = createRef<HTMLElement>();
  const scrollRootRef = createRef<HTMLElement>();
  (contentRef as { current: HTMLElement | null }).current = content;
  (scrollRootRef as { current: HTMLElement | null }).current = scrollRoot;

  const utils = render(
    <QueryLocator anchors={anchors} contentRef={contentRef} scrollRootRef={scrollRootRef} />,
  );
  return { ...utils, content, scrollRoot, scrollTo };
}

describe('QueryLocator —— 官方 `Lit` 的轨道与预览卡', () => {
  it('轨道高度 = 官方 `clamp(clientHeight*0.42, 168, 360)`，每条一个 `button`', () => {
    const { container } = mountRail();
    const nav = container.querySelector('[data-testid="query-locator-v2"]')!;
    expect(nav).not.toBeNull();
    expect(nav.getAttribute('aria-label')).toBe('Conversation query locator');
    /* 600 * 0.42 = 252（落在 [168,360] 内） */
    expect(nav.getAttribute('style')).toContain('height: 252px');
    expect(container.querySelectorAll('[data-testid="query-locator-track-v2"] button')).toHaveLength(3);
  });

  it('当前滚动位置最近的锚点带 `aria-current="location"`（官方 `active`）', () => {
    const { container } = mountRail();
    const active = container.querySelectorAll('[aria-current="location"]');
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('aria-label')).toBe('Jump to Query 1: 第一问');
  });

  it('点击锚点 ⇒ 官方平滑滚动到 `targetTop`（夹到 `[0, maxScroll]`）', () => {
    const { container, scrollTo } = mountRail();
    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-testid="query-locator-track-v2"] button');
    act(() => { buttons[2].click(); });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    const [options] = scrollTo.mock.calls[0] as unknown as [{ behavior: string; top: number }];
    expect(options.behavior).toBe('smooth');
    expect(options.top).toBeGreaterThanOrEqual(0);
    expect(options.top).toBeLessThanOrEqual(2400); // scrollHeight - clientHeight
  });

  it('鼠标移到标记上 ⇒ 弹出预览卡（标题 + 正文，正文 `line-clamp-2`）', () => {
    const { container } = mountRail();
    const hitArea = container.querySelector('[data-testid="query-locator-hit-area-v2"]')!;
    stub(hitArea as HTMLElement, {});
    (hitArea as HTMLElement).getBoundingClientRect = () => ({
      top: 0, left: 0, right: 44, bottom: 252, width: 44, height: 252, x: 0, y: 0, toJSON: () => ({}),
    });
    /* `topPx` 从 `trackHeight/2 - span/2` 起、间距 12 ⇒ 第一条在 252/2-12=114 */
    act(() => {
      hitArea.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: 114 }));
    });
    const card = container.querySelector('[data-testid="query-locator-preview-card"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain('第一问');
    expect(card!.textContent).toContain('第一个回答');
    expect(card!.querySelector('.line-clamp-2')).not.toBeNull();
  });

  it('锚点不足 2 条 / 不可滚动 ⇒ 整条导轨不渲染（官方 `Pit` 的前置条件）', () => {
    const one = mountRail([ANCHORS[0]]);
    expect(one.container.querySelector('[data-testid="query-locator-v2"]')).toBeNull();
  });

  it('源码级：`ChatMessages` 只给**用户**消息行挂锚点属性（官方 `ge = role==="user" ? {[YM]: id} : void 0`）', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(process.cwd(), 'src/components/chat/ChatMessages.tsx'), 'utf8');
    expect(source).toContain("message.role === 'user' ? { 'data-query-locator-anchor-id': message.id } : {}");
    expect(source).toContain('<QueryLocator');
  });
});

describe('queryLocator 纯函数 —— 官方 `Mit` / `Pit` / `Iit`', () => {
  const messages = [
    { id: 'u1', role: 'user', content: '第一问问了什么' },
    { id: 'a1', role: 'assistant', content: '第一个回答' },
    { id: 'a1b', role: 'assistant', content: '' },
    { id: 'u2', role: 'user', content: '第二问' },
    { id: 'a2', role: 'assistant', contents: [{ type: 'tool_event', content: {} }, { type: 'text', content: '第二个\n回答' }] },
  ];

  it('每个用户消息一个锚点，标签 = `Query N[: 正文截断]`，预览 = 其后第一条有正文的助手消息', () => {
    expect(buildQueryAnchors(messages)).toEqual([
      { id: 'u1', label: 'Query 1: 第一问问了什么', previewTitle: '第一问问了什么', previewText: '第一个回答' },
      { id: 'u2', label: 'Query 2: 第二问', previewTitle: '第二问', previewText: '第二个 回答' },
    ]);
  });

  it('官方 `Iit` 用**三个点**截断（`Tit = 80`）', () => {
    expect(truncateQueryLabel('x'.repeat(10), 80)).toBe('x'.repeat(10));
    expect(truncateQueryLabel('y'.repeat(100), 80)).toBe(`${'y'.repeat(77)}...`);
  });

  it('`Pit` 的前置条件：<2 个锚点 / clientHeight<=0 / 不可滚动 ⇒ 空状态', () => {
    const base = { anchors: ANCHORS.map((anchor, index) => ({ ...anchor, offsetTop: index * 100 })), scrollTop: 0 };
    expect(computeQueryLocatorState({ ...base, clientHeight: 600, scrollHeight: 3000 }).visible).toBe(true);
    expect(computeQueryLocatorState({ ...base, anchors: base.anchors.slice(0, 1), clientHeight: 600, scrollHeight: 3000 }))
      .toEqual(EMPTY_QUERY_LOCATOR_STATE);
    expect(computeQueryLocatorState({ ...base, clientHeight: 0, scrollHeight: 3000 })).toEqual(EMPTY_QUERY_LOCATOR_STATE);
    expect(computeQueryLocatorState({ ...base, clientHeight: 600, scrollHeight: 600 })).toEqual(EMPTY_QUERY_LOCATOR_STATE);
  });

  it('`Pit` 的 `active` = 与 `scrollTop` 最近的锚点；`targetTop` 夹到 `[0, maxScroll]`', () => {
    const state = computeQueryLocatorState({
      /* 第三条 `offsetTop` 远超 maxScroll(2400) ⇒ 必须被夹住。 */
      anchors: ANCHORS.map((anchor, index) => ({ ...anchor, offsetTop: index * 1400 })),
      clientHeight: 600,
      scrollHeight: 3000,
      scrollTop: 2400,
    });
    expect(state.ticks.map((tick) => tick.targetTop)).toEqual([0, 1400, 2400]);
    expect(state.ticks.map((tick) => tick.active)).toEqual([false, false, true]);
    /* 3 条 × 12px 间距 = 24 < 252 ⇒ 不触发 fadeEdges，整组居中：252/2 - 12 = 114 */
    expect(state.fadeEdges).toBe(false);
    expect(state.ticks.map((tick) => tick.topPx)).toEqual([114, 126, 138]);
  });
});
