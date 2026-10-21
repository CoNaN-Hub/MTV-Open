/**
 * 「从画布框选多个节点卡片 → 加入对话」的落点回归（用户实测图 1 官方 vs 图 2 MTV）。
 *
 * 官方逐字（`vendor-pkg-canvas-ChpWx5JY.js`）：
 * ```js
 * // ① 工具条那颗钮（@3227028 的 `Me`）—— 只开对话 + 派发事件（只挑有 `data.src` 的节点）
 * Me = () => { oe(!0), setTimeout(() => { const we = re.filter(Te => Te.data?.src);
 *   if (we.length > 0) window.dispatchEvent(new CustomEvent("nodes-dropped-on-chat", { detail: { nodes: we } })) }, 100) }
 * // ② 聊天侧处理（@2740531 的 `qlt`）—— 把**节点 id** 灌进上下文节点
 * t = n => { const r = n.detail.nodes.map(i => i.id).filter(Boolean);
 *   r.length > 0 && qe.getState().addContextNodeIds(r) }
 * ```
 * ⇒ 显示成 `ContextStrip` 那排 38×38 缩略图 chip，**不往正文插 `@`**。
 *
 * 验证分级 = **(b) 真 store + 桩画布选择 + (d) 源码级**。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addSelectionToChat } from '../../src/services/selectionToolbarActions';
import { useAppStore } from '../../src/store/useAppStore';

function seedSelection(): void {
  /* `selectedNodesOf()` 读的是 `state.selectedNodeIds`（不是 `node.selected`）。 */
  useAppStore.setState({
    selectedNodeIds: ['n1', 'n2', 'n3', 'n4'],
    nodes: [
      { id: 'n1', type: 'ai-image', position: { x: 0, y: 0 }, data: { label: '额娘深秋', imageUrl: 'https://img.example/1.png' } },
      { id: 'n2', type: 'source-image', position: { x: 0, y: 0 }, data: { label: '图片生成', imageUrl: 'https://img.example/2.png' } },
      { id: 'n3', type: 'ai-video', position: { x: 0, y: 0 }, data: { label: '分镜视频', videoUrl: 'https://img.example/3.mp4' } },
      { id: 'n4', type: 'ai-text', position: { x: 0, y: 0 }, data: { label: '纯文本节点', output: '正文' } },
      { id: 'n5', type: 'ai-image', position: { x: 0, y: 0 }, data: { label: '没选中的图', imageUrl: 'https://img.example/5.png' } },
    ],
  } as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ activeConversationId: 'c1' });
  seedSelection();
});

afterEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('官方 `ce()` / `qlt`：加入对话 = 上下文引用条', () => {
  it('选中的图/视频进 `contextNodeIds`，纯文本节点不进', () => {
    expect(addSelectionToChat()).toBe(true);
    const state = useAppStore.getState();
    expect(state.chatComposerContextNodeIds).toEqual(['n1', 'n2', 'n3']);
    expect(state.chatComposerContextNodeIds).not.toContain('n4');
    expect(state.chatComposerContextNodeIds).not.toContain('n5');
  });

  it('**不往输入框插 `@` 引用**（旧实现的正是这一点不对）', () => {
    addSelectionToChat();
    const draft = useAppStore.getState().chatComposerDraft;
    expect(draft ?? '').not.toContain('@{');
  });

  it('顺带打开对话面板（官方 `oe(true)`）', () => {
    useAppStore.setState({ chatOpen: false });
    addSelectionToChat();
    expect(useAppStore.getState().chatOpen).toBe(true);
  });

  it('没有合规节点 ⇒ 返回 false 且什么都不改', () => {
    useAppStore.setState({
      selectedNodeIds: ['t1'],
      nodes: [{ id: 't1', type: 'ai-text', position: { x: 0, y: 0 }, data: { output: 'x' } }],
    } as unknown as Partial<ReturnType<typeof useAppStore.getState>>);
    expect(addSelectionToChat()).toBe(false);
    expect(useAppStore.getState().chatComposerContextNodeIds ?? []).toEqual([]);
  });

  it('源码级：用的是 `addContextNodeIds`（官方 `qlt`），不再是 `openChatWithDraft(@…)`', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/services/selectionToolbarActions.ts'), 'utf8');
    const start = source.indexOf('export function addSelectionToChat');
    const body = source.slice(start, start + 900);
    expect(body).toContain('addContextNodeIds');
    expect(body).not.toContain('openChatWithDraft');
    expect(body).not.toContain('@{');
  });
});

