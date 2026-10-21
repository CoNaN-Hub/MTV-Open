import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import type { BaseNodeData, OutputHistoryEntry } from '../../src/types';
import {
  OFFICIAL_HISTORY_GROUP_COLOR,
  OFFICIAL_HISTORY_GROUP_OFFSET_X,
  OFFICIAL_HISTORY_GROUP_PADDING,
  OFFICIAL_HISTORY_ITEM_GAP,
  OFFICIAL_HISTORY_ROW_GAP,
  buildOfficialHistoryExpansion,
  officialDeleteVariantsPatch,
  officialHistoryBatches,
  officialNodeSrc,
  officialVariantCount,
} from '../../src/utils/officialNodeHistory';

/**
 * 官方依据（全部为 `E:\TapNow-0.4.66\resources\web\assets` 下 chunk 的字节偏移）：
 *   · 常量 `page-DVqoHdTT.js`@1357859 `const vl=80,U1=56,z1=72,mme="#3A3A3A",gme=100;`
 *   · 展开 `wme` @1358919（行 = 批次、列 = options；分组尺寸 = 最右+vl / 最下+vl；分组 `selected=true`）
 *   · 落点 `x` handler @1362018 `position:{x:M.x+mn(C)+200, y:M.y}`
 *   · 计数 `V0` @1359974
 *   · 删除变体 `Sme` @1360239
 */
function imageNode(id: string, overrides: Partial<BaseNodeData> = {}): Node<BaseNodeData> {
  return {
    id,
    type: 'ai-image',
    position: { x: 0, y: 0 },
    data: { label: '赛博朋克2', type: 'ai-image', ...overrides } as BaseNodeData,
  };
}

function record(nodeId: string, mediaUrl: string, overrides: Partial<OutputHistoryEntry> = {}): OutputHistoryEntry {
  return {
    id: `hist-${mediaUrl}`,
    projectId: 'p1',
    nodeId,
    nodeLabel: '赛博朋克2',
    timestamp: 1,
    prompt: 'p',
    output: mediaUrl,
    nodeType: 'ai-image',
    model: 'm',
    provider: 'x',
    status: 'success',
    mediaUrl,
    ...overrides,
  } as OutputHistoryEntry;
}

describe('official variant count `V0` (page-DVqoHdTT.js@1359974)', () => {
  it('counts distinct `src + options`', () => {
    expect(officialVariantCount(imageNode('a', { imageUrl: 'u1', options: ['u1', 'u2', 'u3'] }).data)).toBe(3);
  });

  it('falls back to `historyVariantCount` when it is larger (official `Math.max`)', () => {
    expect(officialVariantCount(imageNode('a', { imageUrl: 'u1', options: [], historyVariantCount: 4 }).data)).toBe(4);
  });

  it('returns 1 for a plain node with a single image (⇒ 菜单「删除其他历史」按 `N<=1` 隐藏)', () => {
    expect(officialVariantCount(imageNode('a', { imageUrl: 'u1' }).data)).toBe(1);
    expect(officialVariantCount(undefined)).toBe(0);
  });

  it('ignores `historyVariantCount` once hidden (official hidden branch returns `t.size`)', () => {
    expect(officialVariantCount(imageNode('a', {
      imageUrl: 'u1', options: [], historyVariantCount: 9, historyVariantsHidden: true,
    }).data)).toBe(1);
  });

  it('reads the main media from imageUrl (MTV `data.src` equivalent)', () => {
    expect(officialNodeSrc(imageNode('a', { imageUrl: 'u1' }).data)).toBe('u1');
    expect(officialNodeSrc(imageNode('a', { videoUrl: 'v1' }).data)).toBe('v1');
  });
});

describe('official `Sme` delete-variants patch (page-DVqoHdTT.js@1360239)', () => {
  it('clears options, hides the variants and pins the count to 1 — main image untouched', () => {
    const patch = officialDeleteVariantsPatch(imageNode('a', {
      imageUrl: 'u1', options: ['u1', 'u2', 'u3'], historyVariantCount: 3,
    }).data);
    expect(patch).toEqual({ options: [], historyVariantsHidden: true, historyVariantCount: 1 });
    /* 官方 `Sme` 返回里 `src` 原样保留 ⇒ 这里不能出现 imageUrl/src 改写 */
    expect('imageUrl' in patch).toBe(false);
    expect('src' in patch).toBe(false);
  });

  it('uses 0 when the node has no media', () => {
    expect(officialDeleteVariantsPatch(imageNode('a').data)).toEqual({
      options: [], historyVariantsHidden: true, historyVariantCount: 0,
    });
  });
});

describe('official history batches (`vme` @1358433 + `x` handler @1362018)', () => {
  it('turns the current `src + options` variant set into the first batch', () => {
    const batches = officialHistoryBatches(
      imageNode('a', { imageUrl: 'u1', options: ['u1', 'u2'] }).data,
      [],
    );
    expect(batches).toHaveLength(1);
    expect(batches[0].options).toEqual(['u1', 'u2']);
  });

  it('appends every remaining success record as its own batch, newest first, without duplicates', () => {
    const batches = officialHistoryBatches(
      imageNode('a', { imageUrl: 'u3', options: ['u3'] }).data,
      [record('a', 'u3'), record('a', 'u2'), record('a', 'u1'), record('a', 'u0', { status: 'error' })],
    );
    expect(batches.map((batch) => batch.options)).toEqual([['u3'], ['u2'], ['u1']]);
  });

  it('skips records of a different node type', () => {
    const batches = officialHistoryBatches(imageNode('a').data, [
      record('a', 'v1', { nodeType: 'ai-video' }),
    ]);
    expect(batches).toEqual([]);
  });
});

describe('official `wme` expansion geometry (page-DVqoHdTT.js@1358919)', () => {
  const source = imageNode('src');
  const build = (batches: { options: string[] }[]) => buildOfficialHistoryExpansion({
    sourceNode: source,
    sourcePosition: { x: 1000, y: 500 },
    sourceWidth: 250,
    childSize: { width: 250, height: 250 },
    batches,
    title: '赛博朋克2',
  });

  it('keeps the official padding / item-gap / row-gap constants', () => {
    expect(OFFICIAL_HISTORY_GROUP_PADDING).toBe(80);
    expect(OFFICIAL_HISTORY_ITEM_GAP).toBe(56);
    expect(OFFICIAL_HISTORY_ROW_GAP).toBe(72);
    expect(OFFICIAL_HISTORY_GROUP_COLOR).toBe('#3A3A3A');
    expect(OFFICIAL_HISTORY_GROUP_OFFSET_X).toBe(200);
  });

  it('places the group at `source.x + width + 200`, top aligned, and selects it', () => {
    const { groupNode } = build([{ options: ['a', 'b'] }]);
    expect(groupNode.position).toEqual({ x: 1000 + 250 + 200, y: 500 });
    expect(groupNode.selected).toBe(true);
    expect(groupNode.data.color).toBe('#3A3A3A');
    expect(groupNode.data.layoutType).toBe('none');
    expect(groupNode.data.createdBy).toBe('client');
  });

  it('lays one batch out as a single row at y=80, step = width + 56', () => {
    const { childNodes } = build([{ options: ['a', 'b', 'c'] }]);
    expect(childNodes.map((n) => n.position)).toEqual([
      { x: 80, y: 80 },
      { x: 80 + 250 + 56, y: 80 },
      { x: 80 + 2 * (250 + 56), y: 80 },
    ]);
    /* 官方 `a=Math.max(a, h-U1+vl)`，`h` 从 `vl`(80) 起 ⇒ 最右子节点右边 + 80 */
    const { groupNode } = build([{ options: ['a', 'b', 'c'] }]);
    expect(groupNode.width).toBe(80 + 3 * (250 + 56) - 56 + 80);
    /* 官方 `c = o - z1 + vl`，`o` 从 `vl`(80) 起 ⇒ 行底 + 80 */
    expect(groupNode.height).toBe(80 + 250 + 80);
  });

  it('stacks batches vertically with the 72px row gap', () => {
    const { childNodes } = build([{ options: ['a', 'b'] }, { options: ['c'] }]);
    expect(childNodes.map((n) => [n.position.x, n.position.y])).toEqual([
      [80, 80],
      [80 + 306, 80],
      [80, 80 + 250 + 72],
    ]);
    const { groupNode } = build([{ options: ['a', 'b'] }, { options: ['c'] }]);
    expect(groupNode.height).toBe(80 + 250 + 72 + 250 + 80);
  });

  it('parents every child to the group node and names them `<title> <batch>-<index>`', () => {
    const { groupNode, childNodes } = build([{ options: ['a', 'b'] }, { options: ['c', 'd'] }]);
    expect(childNodes.every((child) => child.parentId === groupNode.id)).toBe(true);
    expect(childNodes.map((child) => child.data.label)).toEqual([
      '赛博朋克2 1-1', '赛博朋克2 1-2', '赛博朋克2 2-1', '赛博朋克2 2-2',
    ]);
    expect(childNodes.every((child) => child.selected === false)).toBe(true);
  });

  it('falls back to the official `vl*2` size when there is nothing to expand', () => {
    const { groupNode, childNodes } = build([]);
    expect(childNodes).toEqual([]);
    expect(groupNode.width).toBe(160);
    expect(groupNode.height).toBe(160);
  });

  /* 官方 `bme` 的子节点 `params` 是 `{...bO(source), ...batch.params}`（源节点参数优先合并），
     而 MTV 的图片卡尺寸读 `aspectRatio` / `imageWidth`+`imageHeight` ⇒ 必须一并透传，
     否则子节点画成 250×250、而分组框按 `mn(source)` 算 ⇒ 框与内容不匹配。 */
  it('carries the source box fields onto the child nodes so they render at the same size', () => {
    const withBox = {
      ...source,
      data: { ...source.data, aspectRatio: '16:9', imageWidth: 1024, imageHeight: 576 },
    } as typeof source;
    const { childNodes } = buildOfficialHistoryExpansion({
      sourceNode: withBox,
      sourcePosition: { x: 0, y: 0 },
      sourceWidth: 444,
      childSize: { width: 444, height: 250 },
      batches: [{ options: ['a'] }],
      title: 't',
    });
    expect(childNodes[0].data.aspectRatio).toBe('16:9');
    expect(childNodes[0].data.imageWidth).toBe(1024);
    expect(childNodes[0].data.imageHeight).toBe(576);
    expect(childNodes[0].data.nodeWidth).toBe(444);
    expect(childNodes[0].data.nodeHeight).toBe(250);
  });

  /* 官方 `wme` 里子节点标题取的是**源节点的 title**（`e.data.title`），
     取不到时按源节点类型回落到 `"Video"` / `"Image"`（`page-DVqoHdTT.js`@1359xxx）。 */
  it('falls back to the official `Image` / `Video` child-title prefix when the source has no label', () => {
    const noLabel = { ...source, data: { ...source.data, label: '' } } as typeof source;
    const imageChild = buildOfficialHistoryExpansion({
      sourceNode: noLabel,
      sourcePosition: { x: 0, y: 0 },
      sourceWidth: 250,
      childSize: { width: 250, height: 250 },
      batches: [{ options: ['a'] }],
      title: '节点历史',
    });
    expect(imageChild.childNodes[0].data.label).toBe('Image 1-1');
    expect(imageChild.groupNode.data.label).toBe('节点历史');

    const video = { ...noLabel, type: 'ai-video' } as typeof source;
    const videoChild = buildOfficialHistoryExpansion({
      sourceNode: video,
      sourcePosition: { x: 0, y: 0 },
      sourceWidth: 250,
      childSize: { width: 250, height: 250 },
      batches: [{ options: ['a'] }],
      title: '节点历史',
    });
    expect(videoChild.childNodes[0].data.label).toBe('Video 1-1');
  });
});
