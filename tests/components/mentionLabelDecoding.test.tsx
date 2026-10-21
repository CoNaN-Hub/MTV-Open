// @vitest-environment jsdom
/**
 * 引用芯片标签的**编码/解码对称性**回归（用户实测 图10：MTV 的「加入对话」引用芯片显示成
 * `%E9%A2%9D%E5%A8%98%E6%B7%B1%E7%A7%8B…` 这种原始百分号串 + `#15`）。
 *
 * 官方口径（逐字，`services/chat/mentionTokens.ts`）：
 *   · 写：`mwe` = `` `${prefix}${id}:${encodeURIComponent(trimmed)}` ``（@209257 邻域）
 *   · 读：`fwe` = `decodeURIComponent(raw)`，且**必须**满足 `encodeURIComponent(label) === raw`，
 *     否则视为**非编码**标签、原样返回（@209257 邻域，`mentionTokens.ts:58`）。
 *   ⇒ 「解码 + 严格往返校验」是官方语义；裸 `decodeURIComponent`（会把 `100%20off` 误解码）不是。
 *
 * MTV 的三个显示点都要遵守（本轮修的三处）：
 *   ① `components/chat/ChatComposerEditor.tsx`（输入框芯片）
 *   ② `components/chat/ChatReferenceText.tsx`（已发送消息里的引用）
 *   ③ `components/nodes/shared/mentionEditorDom.ts`（画布提示词编辑器芯片）
 *
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChatComposerEditor from '../../src/components/chat/ChatComposerEditor';
import ChatReferenceText from '../../src/components/chat/ChatReferenceText';
import { renderPromptToNodes } from '../../src/components/nodes/shared/mentionEditorDom';
import { setLocale } from '../../src/i18n';
import type { NodeMeta } from '../../src/components/nodes/shared/mentionEditorDom';

afterEach(cleanup);

const NODE_LABEL = '额度深秋的雨';
const ENCODED = encodeURIComponent(NODE_LABEL);

describe('引用芯片标签：官方 `mwe`/`fwe` 编解码对称', () => {
  it('① 输入框：`@{id:encodeURIComponent(label)}` ⇒ 芯片显示**解码后**的名字（不是百分号串）', () => {
    setLocale('zh-CN');
    const { container } = render(
      <ChatComposerEditor
        value={`@{n15:${ENCODED}} 帮我做一版`}
        onChange={() => {}}
        onSubmit={() => {}}
        nodeDisplayIds={new Map([['n15', 15]])}
        onMentionQueryChange={() => {}}
        onSlashQueryChange={() => {}}
        placeholder="随心输入"
      />,
    );
    const chip = container.querySelector('[data-chat-reference="node"]');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain(NODE_LABEL);
    expect(chip!.textContent).not.toContain('%E9');
    /* ⚠️ 官方 NodeView 芯片里**没有** `#编号`（第 53 轮已按官方换掉 MTV 自造的彩条 + `#15`）；
       编号仍保留在 `aria-label` 里（官方无障碍名的口径）。 */
    expect(chip!.textContent).not.toContain('#15');
    expect(chip!.getAttribute('aria-label')).toContain('编号 15');
    /* 原始 token 仍保留在属性上（供往返序列化用） */
    expect(chip!.getAttribute('data-chat-reference-raw')).toBe(`@{n15:${ENCODED}}`);
  });

  it('① 输入框：明文标签（历史/测试数据里的 `@{id:中文}`）**不受影响**', () => {
    setLocale('zh-CN');
    const { container } = render(
      <ChatComposerEditor
        value={`@{n-src:源图} 放大`}
        onChange={() => {}}
        onSubmit={() => {}}
        nodeDisplayIds={new Map()}
        onMentionQueryChange={() => {}}
        onSlashQueryChange={() => {}}
        placeholder="随心输入"
      />,
    );
    const chip = container.querySelector('[data-chat-reference="node"]');
    expect(chip!.textContent).toContain('源图');
  });

  it('① 输入框：非法转义序列（`100%zz`）不会被误解码（官方严格往返校验的兜底分支）', () => {
    setLocale('zh-CN');
    const { container } = render(
      <ChatComposerEditor
        value={'@{n7:100%zz off} 继续'}
        onChange={() => {}}
        onSubmit={() => {}}
        nodeDisplayIds={new Map()}
        onMentionQueryChange={() => {}}
        onSlashQueryChange={() => {}}
        placeholder="随心输入"
      />,
    );
    const chip = container.querySelector('[data-chat-reference="node"]');
    /* ⚠️ 已知且**官方同源**的歧义：`100%20off` 本身就是一个合法的 `encodeURIComponent('100 off')`，
       官方 `fwe` 也会把它解成 `100 off` —— 无法区分，故不在此断言。这里只钉住「非法转义不被破坏」。 */
    expect(chip!.textContent).toContain('100%zz off');
  });

  it('② 已发送消息里的引用（`compact`，即 `ChatMarkdown` 走的那条路）：同样解码显示', () => {
    setLocale('zh-CN');
    const { container } = render(
      <ChatReferenceText value={`分析 @{n15:${ENCODED}} 这张图`} compact />,
    );
    expect(container.textContent).toContain(NODE_LABEL);
    expect(container.textContent).not.toContain('%E9');
    expect(container.textContent).toContain('分析');
  });

  it('② 非 `compact`（确认卡正文）也**不再暴露内部 token 原文**', () => {
    setLocale('zh-CN');
    const { container } = render(<ChatReferenceText value={`分析 @{n15:${ENCODED}} 这张图`} />);
    expect(container.textContent).toContain(NODE_LABEL);
    expect(container.textContent).not.toContain('@{n15:');
    expect(container.textContent).not.toContain('%E9');
  });

  it('③ 画布提示词编辑器芯片：`renderPromptToNodes` 解码标签，明文标签保持原样', () => {
    const encoded = renderPromptToNodes(`@{n15:${ENCODED}} 参考`, new Map<string, NodeMeta>());
    const encodedText = encoded.map((node) => node.textContent ?? '').join('');
    expect(encodedText).toContain(NODE_LABEL);
    expect(encodedText).not.toContain('%E9');

    const plain = renderPromptToNodes('@{n-src:源图} 放大', new Map<string, NodeMeta>());
    expect(plain.map((node) => node.textContent ?? '').join('')).toContain('源图');
  });
});
