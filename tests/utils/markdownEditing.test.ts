import { describe, expect, it } from 'vitest';
import {
  applyMarkdownAction,
  markdownActiveState,
  type MarkdownSelection,
} from '../../src/utils/markdownEditing';

/**
 * 官方放大面板底部编辑工具条（`mye` + `r$` @486152）的**动作集**：
 *   [h1,h2,h3,paragraph] 丨 [bold,italic] 丨 [bulletList,orderedList] 丨 [divider]
 * 官方动作映射（`hye`）：bold→toggleBold · italic→toggleItalic · h1/h2/h3→setHeading ·
 *   paragraph→setParagraph · list→bulletList · ordered-list→orderedList · divider→setHorizontalRule
 * MTV 的文本是 Markdown 源码 ⇒ 这里断言等价的 Markdown 编辑结果。
 */
const sel = (value: string, start: number, end = start): MarkdownSelection => ({ value, start, end });

describe('markdownEditing · 官方编辑工具条动作', () => {
  it('bold：包裹选区 / 再点一次取消', () => {
    const wrapped = applyMarkdownAction('bold', sel('hello', 0, 5));
    expect(wrapped.value).toBe('**hello**');
    expect([wrapped.start, wrapped.end]).toEqual([2, 7]);

    const unwrapped = applyMarkdownAction('bold', { value: '**hello**', start: 2, end: 7 });
    expect(unwrapped.value).toBe('hello');
    expect([unwrapped.start, unwrapped.end]).toEqual([0, 5]);
  });

  it('italic：用单星号包裹（不与 bold 的 ** 冲突）', () => {
    const r = applyMarkdownAction('italic', sel('hi', 0, 2));
    expect(r.value).toBe('*hi*');
    expect([r.start, r.end]).toEqual([1, 3]);
  });

  it('无选区时插入一对标记并把光标放中间', () => {
    const r = applyMarkdownAction('bold', sel('ab', 1));
    expect(r.value).toBe('a****b');
    expect([r.start, r.end]).toEqual([3, 3]);
  });

  it('h1/h2/h3：给当前行加对应级别前缀，可逐级覆盖', () => {
    expect(applyMarkdownAction('h1', sel('title', 3)).value).toBe('# title');
    expect(applyMarkdownAction('h2', sel('# title', 4)).value).toBe('## title');
    expect(applyMarkdownAction('h3', sel('## title', 5)).value).toBe('### title');
  });

  it('paragraph：去掉标题前缀', () => {
    expect(applyMarkdownAction('paragraph', sel('### hi', 4)).value).toBe('hi');
  });

  it('list / ordered-list：整行加前缀，再点一次去掉（多行一起处理）', () => {
    const multi = applyMarkdownAction('list', { value: 'a\nb', start: 0, end: 3 });
    expect(multi.value).toBe('- a\n- b');

    const off = applyMarkdownAction('list', { value: '- a\n- b', start: 0, end: 7 });
    expect(off.value).toBe('a\nb');

    const ordered = applyMarkdownAction('ordered-list', { value: 'a\nb', start: 0, end: 3 });
    expect(ordered.value).toBe('1. a\n1. b');
  });

  it('divider：插入独立的一行 ---（官方 setHorizontalRule）', () => {
    const r = applyMarkdownAction('divider', sel('abc', 3));
    expect(r.value).toBe('abc\n---\n');
    expect([r.start, r.end]).toEqual([7, 7]);
  });

  it('markdownActiveState：按光标所在行推出官方那套激活态', () => {
    expect(markdownActiveState(sel('## t', 3)).headingLevel).toBe(2);
    expect(markdownActiveState(sel('plain', 2)).headingLevel).toBe(0);
    expect(markdownActiveState(sel('- a', 2)).isList).toBe(true);
    expect(markdownActiveState(sel('1. a', 2)).isOrderedList).toBe(true);
    expect(markdownActiveState({ value: '**x**', start: 0, end: 5 }).isBold).toBe(true);
    expect(markdownActiveState({ value: '*x*', start: 0, end: 3 }).isItalic).toBe(true);
  });
});
