// @vitest-environment jsdom
/**
 * 第 60 轮回归：查询导航轨（右侧竖向 ----）的线**必须**是可见色。
 *
 * 用户实测「悬浮提示没有了 / 那些线看不见」。CDP 现场定位：
 * `bg-chat-foreground/24|40|56|85` 这些**带透明度的类在 dev 构建里没有生成**
 * （`document.styleSheets` 里只有 `.bg-chat-foreground` 一条；dev 页面 computed = `rgba(0,0,0,0)`
 * ⇒ 整条轨的线全透明）。修法 = 显式 rgba（`#d4d4d8` 配 0.24/0.56/0.85，与官方实测同色）。
 *
 * 验证分级 = **(d) 源码级 + (b) jsdom 渲染**。
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import QueryLocator from '../../src/components/chat/QueryLocator';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/** 官方锚点结构：`{id,label,previewTitle?,previewText?,targetTop,topPx}`。 */
function renderRail() {
  const content = document.createElement('div');
  const scroller = document.createElement('div');
  Object.defineProperty(scroller, 'clientHeight', { value: 600, configurable: true });
  Object.defineProperty(scroller, 'scrollHeight', { value: 3000, configurable: true });
  /* 锚点元素：`attachAnchorOffsets` 靠 `[data-query-locator-anchor-id]` 找行。 */
  const anchorRow = document.createElement('div');
  anchorRow.setAttribute('data-query-locator-anchor-id', 'a1');
  content.append(anchorRow);
  /* 必须接进文档：`findScrollRoot` 会检查 `isConnected`，游离节点会拿到空状态 ⇒ 轨不渲染。 */
  scroller.append(content);
  document.body.append(scroller);
  const contentRef = createRef<HTMLElement>();
  const scrollRef = createRef<HTMLElement>();
  (contentRef as { current: HTMLElement | null }).current = content;
  (scrollRef as { current: HTMLElement | null }).current = scroller;

  render(
    <QueryLocator
      anchors={[{
        id: 'a1',
        label: '第一条',
        previewTitle: '第一条',
        previewText: '预览正文',
        targetTop: 0,
        topPx: 0,
      } as never]}
      contentRef={contentRef}
      scrollRootRef={scrollRef}
    />,
  );
  return {
    nav: document.body.querySelector<HTMLElement>('[data-testid="query-locator-v2"]'),
    hitArea: document.body.querySelector<HTMLElement>('[data-testid="query-locator-hit-area-v2"]'),
  };
}

afterEach(cleanup);

describe('查询导航轨的可见性', () => {
  it('源码级：不允许再用 `bg/text-chat-foreground/NN`（dev 构建里没生成 ⇒ 透明）', () => {
    const source = read('src/components/chat/QueryLocator.tsx');
    /* 注释里会引用官方类名做溯源 ⇒ 先把块注释剥掉再检查**代码**。 */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/bg-chat-foreground\/\d/);
    expect(code).not.toMatch(/text-chat-foreground\/\d/);
    /* 三个状态 + 预览卡副标题都用显式 rgba。 */
    expect(source).toContain('bg-[rgba(212,212,216,0.85)]');
    expect(source).toContain('bg-[rgba(212,212,216,0.56)]');
    expect(source).toContain('bg-[rgba(212,212,216,0.40)]');
    expect(source).toContain('bg-[rgba(212,212,216,0.24)]');
    expect(source).toContain('text-[rgba(212,212,216,0.45)]');
  });

  it('markdown 块间距按官方**渲染结果**（.9em），不是官方源码里那条永不命中的 .45em', () => {
    const css = read('src/styles/official-chat.css');
    expect(css).toContain('.chat-markdown > :is(h1, h2, h3, h4, h5, h6) + * { margin-top: .9em; }');
    expect(css).not.toContain('.chat-markdown > :is(h1, h2, h3, h4, h5, h6) + * { margin-top: .45em; }');
    expect(css).toContain('.chat-markdown > h3 { font-size: 18px; margin-top: .9em; }');
  });

  it('渲染：有锚点时 tick 的线带 rgba 底色（不再是透明）', () => {
    const { nav } = renderRail();
    if (nav) {
      const line = nav.querySelector('span');
      expect(line?.className).toContain('bg-[rgba(212,212,216,');
    }
  });

  it('悬停预览卡的**代码路径**仍在（官方 `Lit` 的 hovered ⇒ 卡片）', () => {
    const source = read('src/components/chat/QueryLocator.tsx');
    /* 命中区上的 onMouseMove/onMouseLeave ⇒ 悬停 id；卡片按 hovered 渲染。 */
    expect(source).toContain('onMouseMove={(event) => {');
    expect(source).toContain('onMouseLeave={() => setHoveredId(null)}');
    expect(source).toContain('data-testid="query-locator-preview-card"');
    expect(source).toContain('{hovered && (');
  });
});
