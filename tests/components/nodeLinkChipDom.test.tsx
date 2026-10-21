// @vitest-environment jsdom
/**
 * 「画布节点 chip」（官方 `DF`，`displayName="NodeLink"`）与 `hie` 里 `chips` 那一行的 DOM 回归。
 *
 * 官方逐字链：
 * ```js
 * // @2413267  DF
 * const i = Zt(cb => nodeId ? cb.nodeLookup.get(nodeId) ?? null : null);
 * const m = ND(i?.type, p), f = nT(i?.type);
 * const h = kot({dataTitle: u.title, payloadTitle: title, nodeExists: !!i, nodeType: i?.type, tool, t});
 * const g = () => { !i || !nodeId || fitView({nodes:[{id:nodeId}], padding:1, maxZoom:2, minZoom:.5, duration:500}); };
 * const x = d.current && !i, y = l ? !1 : x;
 * return <ls label={h} thumb={m} onClick={g} disabled={y} placeholderType={f} bg="#282828"/>;
 *
 * // @155848  ls 生成的 DOM（DF 路径）
 * <span class="mention mention-node group Lve Fve" data-mention-type="node"
 *       style="border-radius:4px;background:#282828">
 *   <button type="button" tabindex="-1" class="inline-flex min-w-0 items-center gap-1 cursor-pointer border-0 bg-transparent p-0">
 *     [缩略图或占位 glyph]
 *     <span class="truncate text-center text-xs font-normal leading-none transition-colors">label</span>
 *   </button>
 * </span>
 *
 * // @2400124  wot → hie 里的 chips 行
 * nodeIds = wot([item]);
 * chips = labelInput.kind === "viewMedia" ? nodeIds.filter(n => nodeLookup.has(n)) : nodeIds;
 * {!active && chips.length > 0 && <div className="flex flex-wrap items-center gap-1.5 pt-1 pl-6">…</div>}
 * ```
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node as FlowNode } from '@xyflow/react';
import NodeLinkChip, { NodeMentionChip } from '../../src/components/chat/NodeLinkChip';
import ToolActivityDetailList from '../../src/components/chat/ToolActivityDetailList';
import type { ToolEventLike } from '../../src/services/chat/agentToolLabels';
import {
  nodeLinkPlaceholderType,
  nodeLinkThumb,
  resolveNodeLinkLabel,
  resolveUnknownToolLabel,
} from '../../src/services/chat/nodeLinkChipModel';
import { toolEventNodeIds } from '../../src/services/chat/toolEventNodeIds';
import { setLocale } from '../../src/i18n';
import type { BaseNodeData, NodeType } from '../../src/types';
import { useAppStore } from '../../src/store/useAppStore';

/* 官方 `Lve` + `Fve`（@152336 / @152142 逐字）。 */
const CHIP_ENABLED_CLASS = 'mention mention-node group relative inline-flex items-center justify-center align-middle gap-1 h-5 min-w-[24px] max-w-[120px] p-1 cursor-pointer transition-[filter,box-shadow,color] duration-200 ease-out text-white/60 hover:text-white/80 hover:brightness-110 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]';
/* 官方 `Lve` + `Ove`（禁用态；@152634 逐字）。 */
const CHIP_DISABLED_CLASS = 'mention mention-node group relative inline-flex items-center justify-center align-middle gap-1 h-5 min-w-[24px] max-w-[120px] p-1 cursor-pointer transition-[filter,box-shadow,color] duration-200 ease-out bg-muted text-muted-foreground border-border';
/* 官方 `C`（buttonClassName 未传）。 */
const BUTTON_CLASS = 'inline-flex min-w-0 items-center gap-1 cursor-pointer border-0 bg-transparent p-0';

function canvasNode(
  id: string,
  type: NodeType,
  data: Record<string, unknown> = {},
): FlowNode<BaseNodeData> {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: `节点 ${id}`, type, ...data } as unknown as BaseNodeData,
  };
}

function toolItem(name: string, response: unknown, status = 'completed'): ToolEventLike {
  return {
    type: 'tool_event',
    content: { tool: name, status, tool_call_id: `call-${name}`, request: {}, response },
  };
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState({ nodes: [] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useAppStore.setState({ nodes: [] });
});

describe('NodeMentionChip —— 官方 `ls` 的 DOM 与类串', () => {
  it('常态：外层 span 类串 + `data-mention-type` + 内联 style 逐字', () => {
    const { container } = render(<NodeMentionChip label="节点 A" onClick={() => {}} />);
    const chip = container.querySelector('span.mention') as HTMLElement;
    expect(chip.getAttribute('class')).toBe(CHIP_ENABLED_CLASS);
    expect(chip.getAttribute('data-mention-type')).toBe('node');
    /* 官方默认 `bg = "#333333"`、`style={{borderRadius:"4px", background:bg}}`。 */
    expect(chip.style.borderRadius).toBe('4px');
    expect(chip.style.background).not.toBe('');
    /* 官方 `DF` 没传 `title` ⇒ 外层 span 没有 title 属性。 */
    expect(chip.hasAttribute('title')).toBe(false);
  });

  it('常态：内层是 `<button type="button" tabindex="-1">`，类串逐字', () => {
    const { container } = render(<NodeMentionChip label="节点 A" onClick={() => {}} />);
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('tabindex')).toBe('-1');
    expect(button.getAttribute('class')).toBe(BUTTON_CLASS);
  });

  it('`bg` 默认 `#333333`；传 `#282828` 时 style 用传入值（官方 `DF` 恒传 `#282828`）', () => {
    const first = render(<NodeMentionChip label="A" onClick={() => {}} />);
    const rgbOf = (html: HTMLElement) => html.style.background;
    const defaultBg = rgbOf(first.container.querySelector('span.mention') as HTMLElement);
    first.unmount();
    const second = render(<NodeMentionChip label="A" onClick={() => {}} bg="#282828" />);
    const customBg = rgbOf(second.container.querySelector('span.mention') as HTMLElement);
    expect(defaultBg).not.toBe(customBg);
    expect(customBg.replace(/\s/g, '')).toBe('rgb(40,40,40)');
  });

  it('没有 `onClick` ⇒ 壳退化成 `<span>`（官方 `w = !n && !o`），类串带 `cursor-default`', () => {
    const { container } = render(<NodeMentionChip label="纯展示" />);
    expect(container.querySelector('button')).toBeNull();
    const inner = container.querySelector('span.mention > span') as HTMLElement;
    expect(inner.getAttribute('class')).toBe('inline-flex min-w-0 items-center gap-1 cursor-default');
    expect((container.querySelector('span.mention') as HTMLElement).getAttribute('class'))
      .toBe(`${CHIP_ENABLED_CLASS} cursor-default`);
  });

  it('禁用态：换 `Ove` 类串、清掉 style、按钮不再挂 onClick', () => {
    const onClick = vi.fn();
    const { container } = render(<NodeMentionChip label="已删除" onClick={onClick} disabled />);
    const chip = container.querySelector('span.mention') as HTMLElement;
    expect(chip.getAttribute('class')).toBe(CHIP_DISABLED_CLASS);
    expect(chip.getAttribute('style')).toBeNull();
    fireEvent.click(container.querySelector('button')!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('有缩略图出 `<img>`（14×14、圆角 3px、官方 `zR`）；无缩略图出官方占位 glyph 的 span', () => {
    const withThumb = render(
      <NodeMentionChip label="图" onClick={() => {}} thumb="https://cdn.test/a.png?variant_name=small" />,
    );
    const img = withThumb.container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.test/a.png?variant_name=small');
    expect(img.getAttribute('alt')).toBe('图');
    expect(img.getAttribute('class')).toBe('object-cover shrink-0');
    expect(img.style.width).toBe('14px');
    expect(img.style.borderRadius).toBe('3px');
    withThumb.unmount();

    const noThumb = render(<NodeMentionChip label="图" onClick={() => {}} placeholderType="video" />);
    expect(noThumb.container.querySelector('img')).toBeNull();
    /* 官方 `OR`/`Ys`：`<span class="inline-flex items-center justify-center shrink-0" style="width:14px;height:14px">`。 */
    const placeholder = noThumb.container.querySelector('button > span') as HTMLElement;
    expect(placeholder.getAttribute('class')).toBe('inline-flex items-center justify-center shrink-0');
    expect(placeholder.style.width).toBe('14px');
    expect(placeholder.style.height).toBe('14px');
  });
});

describe('图标 / 占位类型（官方 `nT`）与缩略图（官方 `ND`）', () => {
  it('`nT`：text/doc-editor→text · video/videoEdit→video · audio→audio · image→image · 其余→file', () => {
    expect(nodeLinkPlaceholderType('text')).toBe('text');
    expect(nodeLinkPlaceholderType('doc-editor')).toBe('text');
    expect(nodeLinkPlaceholderType('video')).toBe('video');
    expect(nodeLinkPlaceholderType('videoEdit')).toBe('video');
    expect(nodeLinkPlaceholderType('audio')).toBe('audio');
    expect(nodeLinkPlaceholderType('image')).toBe('image');
    expect(nodeLinkPlaceholderType(undefined)).toBe('file');
    expect(nodeLinkPlaceholderType('plugin-node')).toBe('file');
  });

  it('MTV `ai-*` 类型归一到官方 `X` 字面量后同样命中（image/video/audio/text）', () => {
    expect(nodeLinkPlaceholderType('ai-image')).toBe('image');
    expect(nodeLinkPlaceholderType('ai-panorama')).toBe('image');
    expect(nodeLinkPlaceholderType('ai-video')).toBe('video');
    expect(nodeLinkPlaceholderType('ai-animation')).toBe('video');
    expect(nodeLinkPlaceholderType('ai-audio')).toBe('audio');
    expect(nodeLinkPlaceholderType('ai-shotlist')).toBe('text');
  });

  it('`ND`：图片用 `variant_name=small`，视频用 `variant_name=thumbnail`，其余为空串', () => {
    expect(nodeLinkThumb('image', 'https://cdn.test/a.png')).toBe('https://cdn.test/a.png?variant_name=small');
    expect(nodeLinkThumb('image', 'https://cdn.test/a.png?x=1')).toBe('https://cdn.test/a.png?x=1&variant_name=small');
    expect(nodeLinkThumb('image', 'https://cdn.test/a.png?variant_name=large')).toBe('https://cdn.test/a.png?variant_name=small');
    expect(nodeLinkThumb('video', 'https://cdn.test/v.mp4')).toBe('https://cdn.test/v.mp4?variant_name=thumbnail');
    expect(nodeLinkThumb('ai-animation', 'https://cdn.test/v.mp4')).toBe('https://cdn.test/v.mp4?variant_name=thumbnail');
    expect(nodeLinkThumb('text', 'https://cdn.test/t.txt')).toBe('');
    expect(nodeLinkThumb('image', '')).toBe('');
    /* MTV 的本地地址（asset:// 等）不加 CDN 变体参数。 */
    expect(nodeLinkThumb('image', 'asset://local/a.png')).toBe('asset://local/a.png');
  });
});

describe('文案四档（官方 `kot` / `oT`）', () => {
  it('`dataTitle` > `payloadTitle` > 按 `nodeType` 查 `nodeTypes.*` > `oT(tool)`', () => {
    expect(resolveNodeLinkLabel({
      dataTitle: '节点自己的标题', payloadTitle: 'payload 标题', nodeExists: true, nodeType: 'image', tool: 'read', locale: 'zh-CN',
    })).toBe('节点自己的标题');
    expect(resolveNodeLinkLabel({
      payloadTitle: 'payload 标题', nodeExists: true, nodeType: 'image', tool: 'read', locale: 'zh-CN',
    })).toBe('payload 标题');
    expect(resolveNodeLinkLabel({
      nodeExists: true, nodeType: 'image', tool: 'read', locale: 'zh-CN',
    })).toBe('图片');
    expect(resolveNodeLinkLabel({
      nodeExists: false, nodeType: 'image', tool: 'gen_text', locale: 'zh-CN',
    })).toBe('生成文本');
  });

  it('`kot` 的 `nodeType` 分支：缺词条时回落成 `nodeType` 本身；`nodeType` 为空时用 `"node"`', () => {
    expect(resolveNodeLinkLabel({
      nodeExists: true, nodeType: 'zzz-unknown', tool: 'read', locale: 'zh-CN',
    })).toBe('zzz-unknown');
    expect(resolveNodeLinkLabel({
      nodeExists: true, tool: 'read', locale: 'zh-CN',
    })).toBe('node');
  });

  it('`oT`：命中 `toolLabels.<tool>` 用词条；缺词条时 `_`→空格 + 首字母大写', () => {
    expect(resolveUnknownToolLabel('gen_text', 'zh-CN')).toBe('生成文本');
    expect(resolveUnknownToolLabel('some_unknown_tool', 'zh-CN')).toBe('Some unknown tool');
    /* 官方表里 `bash` 的小写键不存在（只有 `Bash`）⇒ 走 `oT` 的兜底：`bash` → `Bash`。 */
    expect(resolveUnknownToolLabel('bash', 'zh-CN')).toBe('Bash');
  });
});

describe('NodeLinkChip —— 官方 `DF` 的行为', () => {
  it('点击调用注入的 `onFocusNode(nodeId)`（官方 `fitView({nodes:[{id}]…})` 的替身）', () => {
    useAppStore.setState({ nodes: [canvasNode('n1', 'ai-image', { imageUrl: 'https://cdn.test/a.png' })] });
    const onFocusNode = vi.fn();
    const { container } = render(<NodeLinkChip nodeId="n1" tool="view_media" onFocusNode={onFocusNode} />);
    expect((container.querySelector('span.mention') as HTMLElement).getAttribute('class')).toBe(CHIP_ENABLED_CLASS);
    fireEvent.click(container.querySelector('button')!);
    expect(onFocusNode).toHaveBeenCalledTimes(1);
    expect(onFocusNode).toHaveBeenCalledWith('n1');
  });

  it('节点存在时：label 取节点标题、thumb 取节点图、`bg` 恒 `#282828`', () => {
    useAppStore.setState({
      nodes: [canvasNode('n1', 'ai-image', { label: '首帧', imageUrl: 'https://cdn.test/a.png' })],
    });
    const { container } = render(<NodeLinkChip nodeId="n1" tool="view_media" />);
    expect(container.textContent).toBe('首帧');
    expect((container.querySelector('img') as HTMLImageElement).getAttribute('src'))
      .toBe('https://cdn.test/a.png?variant_name=small');
    expect((container.querySelector('span.mention') as HTMLElement).style.background.replace(/\s/g, ''))
      .toBe('rgb(40,40,40)');
  });

  it('未注入 `onFocusNode` 时点击不抛，并派发 MTV 现成的 `canvas-focus-nodes` 事件', () => {
    useAppStore.setState({ nodes: [canvasNode('n1', 'ai-image')] });
    const seen: string[][] = [];
    const listener = (event: Event) => {
      seen.push((event as CustomEvent<{ nodeIds: string[] }>).detail.nodeIds);
    };
    window.addEventListener('canvas-focus-nodes', listener);
    const { container } = render(<NodeLinkChip nodeId="n1" tool="view_media" />);
    fireEvent.click(container.querySelector('button')!);
    window.removeEventListener('canvas-focus-nodes', listener);
    expect(seen).toEqual([['n1']]);
  });

  it('占位态 400ms：窗口内即便节点已消失也不禁用，400ms 后才切到禁用态', () => {
    vi.useFakeTimers();
    useAppStore.setState({ nodes: [canvasNode('n1', 'ai-image')] });
    const onFocusNode = vi.fn();
    const { container } = render(<NodeLinkChip nodeId="n1" tool="view_media" onFocusNode={onFocusNode} />);
    const chipClass = () => (container.querySelector('span.mention') as HTMLElement).getAttribute('class');

    /* 节点被删掉：官方 `d.current` 已是 true ⇒ `x = true`，但 `l`（占位态）仍为 true ⇒ `y = false`。 */
    act(() => { useAppStore.setState({ nodes: [] }); });
    expect(chipClass()).toBe(CHIP_ENABLED_CLASS);

    /* 官方 `window.setTimeout(() => c(!1), 400)`。 */
    act(() => { vi.advanceTimersByTime(399); });
    expect(chipClass()).toBe(CHIP_ENABLED_CLASS);
    act(() => { vi.advanceTimersByTime(1); });
    expect(chipClass()).toBe(CHIP_DISABLED_CLASS);
  });

  it('从未存在过的节点 id：400ms 后仍是「可点但无动作」的常态 chip（官方 `d.current` 初值为 false）', () => {
    vi.useFakeTimers();
    const onFocusNode = vi.fn();
    const { container } = render(<NodeLinkChip nodeId="ghost" tool="read" onFocusNode={onFocusNode} />);
    act(() => { vi.advanceTimersByTime(400); });
    expect((container.querySelector('span.mention') as HTMLElement).getAttribute('class')).toBe(CHIP_ENABLED_CLASS);
    /* 官方 `g`：`!i || !e || …` ⇒ 节点不存在时点击什么都不做。 */
    fireEvent.click(container.querySelector('button')!);
    expect(onFocusNode).not.toHaveBeenCalled();
  });
});

describe('ToolActivityDetailList —— 官方 `hie` 的 chips 行', () => {
  it('非活跃 + 有节点 id ⇒ 渲染 `pl-6` 那一行与 `DF` chip', () => {
    useAppStore.setState({ nodes: [canvasNode('n1', 'ai-text', { label: '文案节点' })] });
    const { container } = render(
      <ToolActivityDetailList items={[toolItem('read', { node_ids: ['n1'] })]} />,
    );
    const row = container.querySelector('[data-tool-activity-item] > div.flex.flex-wrap') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.getAttribute('class')).toBe('flex flex-wrap items-center gap-1.5 pt-1 pl-6');
    expect((row.querySelector('span.mention') as HTMLElement).getAttribute('class')).toBe(CHIP_ENABLED_CLASS);
    expect(row.textContent).toBe('文案节点');
  });

  it('没有节点 id ⇒ chips 为空 ⇒ 整行不渲染（官方自然退化）', () => {
    const { container } = render(<ToolActivityDetailList items={[toolItem('read', {})]} />);
    expect(container.querySelector('[data-tool-activity-item] > div.flex.flex-wrap')).toBeNull();
    expect(container.querySelector('.mention')).toBeNull();
  });

  it('`viewMedia`：先把不在画布上的 id 过滤掉；全被过滤 ⇒ 整行不渲染', () => {
    useAppStore.setState({ nodes: [canvasNode('n1', 'ai-image')] });
    const withOne = render(
      <ToolActivityDetailList items={[toolItem('view_media', { images: [{ ref: 'node/n1' }, { ref: 'node/n9' }] })]} />,
    );
    const chips = withOne.container.querySelectorAll('.mention');
    expect(chips.length).toBe(1);
    expect((chips[0] as HTMLElement).textContent).toBe('节点 n1');
    withOne.unmount();

    const withNone = render(
      <ToolActivityDetailList items={[toolItem('view_media', { images: [{ ref: 'node/n9' }] })]} />,
    );
    expect(withNone.container.querySelector('.mention')).toBeNull();
    expect(withNone.container.querySelector('[data-tool-activity-item] > div.flex.flex-wrap')).toBeNull();
  });

  it('活跃行不渲染 chips 行（官方 `!active && …`）', () => {
    useAppStore.setState({ nodes: [canvasNode('n1', 'ai-text')] });
    const { container } = render(
      <ToolActivityDetailList items={[toolItem('read', { node_ids: ['n1'] }, 'started')]} />,
    );
    expect(container.querySelector('[data-tool-activity-item] > div.flex.flex-wrap')).toBeNull();
  });

  it('`onFocusNode` 从列表透传到 chip', () => {
    useAppStore.setState({ nodes: [canvasNode('n1', 'ai-text')] });
    const onFocusNode = vi.fn();
    const { container } = render(
      <ToolActivityDetailList
        items={[toolItem('read', { node_ids: ['n1'] })]}
        onFocusNode={onFocusNode}
      />,
    );
    fireEvent.click(container.querySelector('.mention button')!);
    expect(onFocusNode).toHaveBeenCalledWith('n1');
  });

  it('官方 `wot`：`{}` / 非 `tool_event` / 无 `response` 一律取不到 id，且结果去重', () => {
    expect(toolEventNodeIds([toolItem('read', { node_ids: ['a', 'b'] })])).toEqual(['a', 'b']);
    /* 官方 `t.includes(o) || t.push(o)` ⇒ 去重。 */
    expect(toolEventNodeIds([toolItem('read', { node_ids: ['a', 'a'] })])).toEqual(['a']);
    expect(toolEventNodeIds([{ type: 'message', content: { response: { node_ids: ['a'] } } }])).toEqual([]);
    expect(toolEventNodeIds([toolItem('read', {})])).toEqual([]);
  });
});
