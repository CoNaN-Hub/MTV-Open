// @vitest-environment jsdom
/**
 * `ChatMentionInput`（官方 `qie`）的**真实 DOM** 回归（jsdom + @testing-library/react）。
 *
 * 官方形态（`live-ProseMirror-提及输入内核.md` §1/§2）：
 *  · 根 `<div data-chat-mention-input="true" class="min-w-0 flex-1 {className}">`
 *  · 内容区是 Tiptap 的 `div.ProseMirror[contenteditable="true"][aria-label]`，
 *    class 含 `prose prose-sm dark:prose-invert max-w-none focus:outline-none nokey px-3 pb-2`
 *    与占位类 `[&_.is-editor-empty:first-child::before]:*`
 *  · 受控：`value`（含 `{{node/…}}` token）经 `wrt` 转成 `<span data-type="mention" …>`
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatMentionInput from '../../src/components/chat/ChatMentionInput';
import type { MentionLookups } from '../../src/services/chat/mentionTokens';

afterEach(cleanup);

const lookups: MentionLookups = {
  nodeTitleMap: new Map([['111', '角色参考图']]),
  fileTitleMap: new Map(),
  brainstormLabel: '头脑风暴',
};

const renderInput = (props: Partial<React.ComponentProps<typeof ChatMentionInput>> = {}) => render(
  <ChatMentionInput value="" onChange={() => {}} lookups={lookups} {...props} />,
);

describe('ChatMentionInput —— 真实 DOM（jsdom）', () => {
  it('根是官方 `data-chat-mention-input="true"` + `min-w-0 flex-1`', () => {
    const { container } = renderInput({ className: 'text-[13px]' });
    const root = container.querySelector('[data-chat-mention-input="true"]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.className).toBe('min-w-0 flex-1 text-[13px]');
  });

  it('内容区是 `.ProseMirror` 可编辑区，class 与 aria-label 逐字', async () => {
    const { container } = renderInput({ ariaLabel: '或直接打字回答，@ 引用节点 / 素材', placeholder: '或直接打字回答' });
    const editable = await waitFor(() => {
      const node = container.querySelector('.ProseMirror') as HTMLElement | null;
      if (!node) throw new Error('not ready');
      return node;
    });
    expect(editable.getAttribute('contenteditable')).toBe('true');
    expect(editable.getAttribute('aria-label')).toBe('或直接打字回答，@ 引用节点 / 素材');
    const cls = editable.className;
    for (const token of ['prose', 'prose-sm', 'max-w-none', 'focus:outline-none', 'nokey', 'px-3', 'pb-2']) {
      expect(cls).toContain(token);
    }
    /* 官方占位类（`is-editor-empty` 的 ::before 系列）。 */
    expect(cls).toContain('[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]');
    expect(cls).toContain('[&_.is-editor-empty:first-child::before]:text-muted-foreground');
    /* 提及节点类串（官方 `Xq`）。 */
    expect(cls).toContain('[&_.mention-node]:rounded-[4px]');
    expect(cls).toContain('[&_.mention-node]:bg-[#333333]');
  });

  it('`value` 里的 `{{node/111}}` 经 `wrt` → 解析 → 官方节点视图渲染出 `.mention-node`', async () => {
    const { container } = renderInput({ value: '看 {{node/111}} 这张' });
    const mention = await waitFor(() => {
      const node = container.querySelector('span.mention-node') as HTMLElement | null;
      if (!node) throw new Error('mention not rendered');
      return node;
    });
    /* 官方 `UR` 节点视图：外层 `NodeViewWrapper` 带 `data-mention-type`（`zve`/`gk` + `xk`），
       内层是 `ls`（提及 chip），其根 class 逐字是 `mention mention-node group`。 */
    expect(container.querySelector('[data-mention-type="node"]')).not.toBeNull();
    expect(mention.className.split(' ')).toEqual(expect.arrayContaining(['mention', 'mention-node']));
    /* chip 里是 label + 一个 hover 才显示的删除钮（官方 `ls` 的 `showDelete`）。 */
    expect(mention.textContent).toContain('角色参考图');
    expect(mention.querySelector('button[aria-label="remove mention"]')).not.toBeNull();
    /* 周边文本也要在（`wrt` 的纯文本段 + 提及标签）。 */
    expect(container.querySelector('.ProseMirror')!.textContent).toContain('看 角色参考图');
  });

  it('`brainstorm` 提及走 isActivation 分支（节点视图用被动 chip 类）', async () => {
    const { container } = renderInput({ value: '{{brainstorm:brainstorm}} 开始' });
    const mention = await waitFor(() => {
      const node = container.querySelector('span.mention-node') as HTMLElement | null;
      if (!node) throw new Error('mention not rendered');
      return node;
    });
    expect(container.querySelector('[data-mention-type="brainstorm"]')).not.toBeNull();
    expect(mention.textContent).toBe('头脑风暴');
    /* `brainstorm` / `skill` / `plugin` 分支用官方那份「被动」chip 类串。 */
    expect(mention.className).toContain('cursor-default p-0 hover:brightness-100 hover:shadow-none');
  });

  it('空值不报错，编辑器仍挂载', async () => {
    const { container } = renderInput({ value: '' });
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
  });

  it('`data-testid` 透传到根节点（官方 `"data-testid": testid`）', () => {
    const { container } = renderInput({ 'data-testid': 'ask-free-text' });
    expect(container.querySelector('[data-chat-mention-input="true"]')!.getAttribute('data-testid')).toBe('ask-free-text');
  });

  it('`onChange` 在初始化时不误触发', async () => {
    const onChange = vi.fn();
    const { container } = renderInput({ value: '初始', onChange });
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });
});
