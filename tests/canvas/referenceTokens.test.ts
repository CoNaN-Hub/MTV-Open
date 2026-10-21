/**
 * referenceTokens 单测 —— 官方引用 token 规则（dm / ew / ou / $1 / Eb）的等价性。
 * 依据：EXE `zoom-slider-3ZcFvYQO.js` @229506(ew) / @230151(ou) / @230170(Eb=og)；`page-DPdEgTS0.js` @1451061(dm)。
 */
import { describe, expect, it } from 'vitest';
import {
  buildReferenceEntries,
  collectUpstreamReferences,
  imageCardReferenceEntries,
  referenceEntriesForPrompt,
  rewriteReferenceTokens,
  type ReferenceEntry,
  type UpstreamReference,
} from '../../src/utils/referenceTokens';

function node(id: string, type: string, data: Record<string, unknown> = {}) {
  return { id, type, position: { x: 0, y: 0 }, data } as never;
}
function edge(id: string, source: string, target: string, order = 0) {
  return { id, source, target, data: { order } } as never;
}

describe('上游引用收集（官方 dm）', () => {
  it('只取入边，并按 order（官方 Ih）排序', () => {
    const nodes = new Map([
      ['a', node('a', 'ai-image', { imageUrl: 'A.png', label: 'A 卡' })],
      ['b', node('b', 'ai-image', { imageUrl: 'B.png', label: 'B 卡' })],
      ['t', node('t', 'ai-text', { text: '你好' })],
    ]);
    const refs = collectUpstreamReferences('t', [
      edge('e2', 'b', 't', 2),
      edge('e1', 'a', 't', 1),
      edge('e9', 'a', 'other', 0),
    ], nodes);
    expect(refs.map((r) => r.nodeId)).toEqual(['a', 'b']);
    expect(refs[0]).toMatchObject({ kind: 'image', url: 'A.png', title: 'A 卡', order: 1 });
  });

  it('没有 src 的图片卡被跳过；文本卡只要 textContent 就可入列', () => {
    const nodes = new Map([
      ['empty', node('empty', 'ai-image', {})],
      ['txt', node('txt', 'ai-text', { text: '文案' })],
    ]);
    const refs = collectUpstreamReferences('t', [edge('e1', 'empty', 't', 1), edge('e2', 'txt', 't', 2)], nodes);
    expect(refs.map((r) => r.nodeId)).toEqual(['txt']);
    expect(refs[0]).toMatchObject({ kind: 'text', textContent: '文案', url: '' });
  });
});

describe('引用条目编号（官方 ew / ou）', () => {
  const refs: UpstreamReference[] = [
    { edgeId: 'e1', order: 1, nodeId: 'i1', kind: 'image', url: '1.png', title: '' },
    { edgeId: 'e2', order: 2, nodeId: 'i2', kind: 'image', url: '2.png', title: '海报' },
    { edgeId: 'e3', order: 3, nodeId: 't1', kind: 'text', url: '', title: '', textContent: '文案' },
  ];

  it('每个类各自从 1 编号；label = 标题 || renderText', () => {
    const entries = buildReferenceEntries(refs);
    expect(entries.map((e) => e.renderText)).toEqual(['Image 1', 'Image 2', 'Text 1']);
    expect(entries[0].label).toBe('Image 1');
    expect(entries[1].label).toBe('海报');
  });

  it('顺序固定为 图片 → 视频 → 音频 → 文本', () => {
    const mixed: UpstreamReference[] = [
      ...refs,
      { edgeId: 'e4', order: 4, nodeId: 'v1', kind: 'video', url: 'v.mp4', title: '' },
      { edgeId: 'e5', order: 5, nodeId: 'a1', kind: 'audio', url: 'a.mp3', title: '' },
    ];
    expect(referenceEntriesForPrompt(mixed).map((e) => e.type)).toEqual([
      'image', 'image', 'video', 'audio', 'text',
    ]);
  });

  it('图片卡（官方 $1）只取 图片 + 文本', () => {
    const mixed: UpstreamReference[] = [
      ...refs,
      { edgeId: 'e4', order: 4, nodeId: 'v1', kind: 'video', url: 'v.mp4', title: '' },
    ];
    expect(imageCardReferenceEntries(mixed).map((e) => e.type)).toEqual(['image', 'image', 'text']);
  });
});

describe('prompt 引用 token 重写（官方 Eb = og）', () => {
  const before: ReferenceEntry[] = [
    { id: 'i1', label: 'Image 1', renderText: 'Image 1', type: 'image', url: '1.png' },
    { id: 'i2', label: 'Image 2', renderText: 'Image 2', type: 'image', url: '2.png' },
    { id: 't1', label: 'Text 1', renderText: 'Text 1', type: 'text', textContent: '文案' },
  ];

  it('引用仍在 ⇒ 按 after 重编号；引用被断开 ⇒ 删掉该 token（只吃**前导**空格）', () => {
    const after: ReferenceEntry[] = [
      { id: 'i2', label: 'Image 1', renderText: 'Image 1', type: 'image', url: '2.png' },
      { id: 't1', label: 'Text 1', renderText: 'Text 1', type: 'text', textContent: '文案' },
    ];
    /* 官方 `og` 只对 token **前面**的片段做 `replace(/[ \t]+$/, '')` ⇒ 断开 `{{Image 1}}` 后，
       它**后面**的「 和 」会保留；`Image 2` 在 after 里重编号为 `Image 1` ✓ */
    expect(rewriteReferenceTokens('看 {{Image 1}} 和 {{Image 2}} 与 {{Text 1}}', before, after))
      .toBe('看 和 {{Image 1}} 与 {{Text 1}}');
  });

  it('未知 token（before 里没有）原样保留', () => {
    expect(rewriteReferenceTokens('保留 {{Image 9}} 不动', before, before)).toBe('保留 {{Image 9}} 不动');
  });

  it('空文本原样返回', () => {
    expect(rewriteReferenceTokens('', before, before)).toBe('');
  });
});
