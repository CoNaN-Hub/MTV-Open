import type { Edge, Node as RFNode } from '@xyflow/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaseNodeData } from '../../src/types';

/**
 * UpstreamReferenceChips = 官方底行「上游引用行」`gx`(@1700439) 的等价实现。
 * 断言的都是**官方写死的**规约：
 *   · 条目顺序固定：图片 → 视频 → 音频 → 文本（`gx` 就是按四个列表依次 map）
 *   · 条目标题为 `title || "Image"/"Video"/"Audio"`；文本是 `title || \`Text ${序号+1}\``
 *   · 图/视频条目 = `<img class="prompt-ref-chip-thumb">`；文本/音频条目 = 白底黑图标胶囊
 *   · 每条都带 -top-1/-right-1 的移除键（`onRemove: () => removeByEdgeId(edgeId)`）
 *   · 没有上游引用时整行不出（官方 `T = N > 0 || !!children`，文本卡没有 children）
 */
const driver = vi.hoisted(() => ({
  nodes: [] as RFNode<BaseNodeData>[],
  edges: [] as Edge[],
  onEdgesChange: vi.fn(),
}));

vi.mock('../../src/store/useAppStore', () => {
  const useAppStore = (selector: (state: typeof driver) => unknown) => selector(driver);
  (useAppStore as unknown as { getState: () => typeof driver }).getState = () => driver;
  return { useAppStore };
});
vi.mock('../../src/i18n', () => ({ useT: () => (message: string) => message }));

import UpstreamReferenceChips from '../../src/components/nodes/shared/UpstreamReferenceChips';
import {
  referenceChipTitle,
  removeUpstreamReference,
} from '../../src/utils/upstreamReferenceChips';

function upstreamNode(id: string, type: string, data: Record<string, unknown>): RFNode<BaseNodeData> {
  return { id, type, position: { x: 0, y: 0 }, data: { type, ...data } as BaseNodeData };
}

function edge(id: string, source: string, order: number): Edge {
  return { id, source, target: 'target', data: { order } };
}

beforeEach(() => {
  driver.nodes = [];
  driver.edges = [];
  driver.onEdgesChange.mockClear();
});

describe('reference chip titles (official gx)', () => {
  it('falls back to the kind label for image/video/audio', () => {
    expect(referenceChipTitle('', 'image', 0)).toBe('Image');
    expect(referenceChipTitle('', 'video', 3)).toBe('Video');
    expect(referenceChipTitle('', 'audio', 3)).toBe('Audio');
  });

  it('numbers text chips from 1 inside the text list', () => {
    expect(referenceChipTitle('', 'text', 0)).toBe('Text 1');
    expect(referenceChipTitle('', 'text', 2)).toBe('Text 3');
  });

  it('prefers the upstream node title', () => {
    expect(referenceChipTitle('分镜稿', 'text', 0)).toBe('分镜稿');
    expect(referenceChipTitle('参考图', 'image', 0)).toBe('参考图');
  });
});

describe('reference chip removal (official onRemove → removeByEdgeId)', () => {
  it('removes the upstream edge through the canvas edge-change path', () => {
    removeUpstreamReference('e-1');
    expect(driver.onEdgesChange).toHaveBeenCalledWith([{ id: 'e-1', type: 'remove' }]);
  });
});

describe('upstream reference chips row rendering', () => {
  it('renders nothing when the card has no upstream references', () => {
    driver.nodes = [upstreamNode('target', 'ai-text', { text: '正文' })];
    expect(renderToStaticMarkup(<UpstreamReferenceChips nodeId="target" />)).toBe('');
  });

  it('orders image chips before text chips and thumbnails only media chips', () => {
    driver.nodes = [
      upstreamNode('target', 'ai-text', { text: '正文' }),
      upstreamNode('txt-1', 'ai-text', { text: '上游文本' }),
      upstreamNode('img-1', 'ai-image', { imageUrl: 'https://cdn.local/a.png' }),
    ];
    // 传入顺序故意反着：文本边的 order 更小，仍应排在图片之后
    driver.edges = [edge('e-txt', 'txt-1', 0), edge('e-img', 'img-1', 1)];

    const html = renderToStaticMarkup(<UpstreamReferenceChips nodeId="target" />);

    expect(html).toContain('prompt-ref-scroll');
    expect(html).toContain('https://cdn.local/a.png');
    expect(html).toContain('prompt-ref-chip-thumb');
    expect(html).toContain('prompt-ref-chip-glyph');
    expect(html).toContain('title="Text 1"');
    // 图片来源的条目标题回落 "Image"
    expect(html).toContain('title="Image"');
    expect((html.match(/prompt-ref-chip-remove/g) ?? [])).toHaveLength(2);
    expect(html.indexOf('https://cdn.local/a.png')).toBeLessThan(html.indexOf('Text 1'));
  });

  it('ignores upstream nodes whose media url is missing (official dm filter)', () => {
    driver.nodes = [
      upstreamNode('target', 'ai-text', { text: '正文' }),
      upstreamNode('img-empty', 'ai-image', {}),
    ];
    driver.edges = [edge('e-img', 'img-empty', 0)];

    expect(renderToStaticMarkup(<UpstreamReferenceChips nodeId="target" />)).toBe('');
  });
});
