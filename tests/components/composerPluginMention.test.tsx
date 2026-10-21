// @vitest-environment jsdom
/**
 * §6 #8「应用」提及（官方 `componentProps.plugins` / `Ub` 的 `Re[]`）在**主输入卡**里的落地回归。
 *
 * 官方口径（逐字见 `services/chat/mentionPlugins.ts` 的表）：
 *   · 行数据 `Re[]` = `componentProps.plugins`（`{pluginName, displayName, description, skills, …}`）；
 *   · 行点击后 `tt(plugin)` 造出 mention 项，`renderText = Pve(name, skill) = "plugin:<name>:<skill>"`；
 *   · 写进输入值的是 `k0e(name, skill) = "{{<name>:<skill>}}"`（`Pve`/`k0e` 均逐字）。
 * MTV 主输入卡的内核是自写的 `ChatComposerEditor`（不是官方 `qie`），本测试锁住：
 *   ① 插入「应用」引用后，序列化出的 value 就是官方 token；
 *   ② 反向：value 里的官方 token 会被渲染成带 `data-chat-reference="plugin"` 的 chip（可往返）。
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatComposerEditor, { type ChatComposerEditorHandle } from '../../src/components/chat/ChatComposerEditor';
import { setLocale } from '../../src/i18n';

afterEach(cleanup);

describe('§6 #8 —— 主输入卡的官方「应用」提及', () => {
  it('`{{pluginName:skillName}}` ⇒ chip（`data-chat-reference="plugin"` + 原始 token 落在 `data-chat-reference-raw`）', () => {
    setLocale('zh-CN');
    const { container } = render(
      <ChatComposerEditor
        value="{{tapnow-story:story-skill}} 帮我写一个分镜"
        onChange={() => {}}
        onSubmit={() => {}}
        nodeDisplayIds={new Map()}
        onMentionQueryChange={() => {}}
        onSlashQueryChange={() => {}}
        placeholder="随心输入"
      />,
    );
    const chip = container.querySelector('[data-chat-reference="plugin"]');
    expect(chip).not.toBeNull();
    expect(chip!.getAttribute('data-chat-reference-raw')).toBe('{{tapnow-story:story-skill}}');
    /* 文本部分原样保留。 */
    expect(container.textContent).toContain('帮我写一个分镜');
  });

  it('`insertReference({kind:"plugin"})` ⇒ `onChange` 收到官方 token 形式的值', () => {
    setLocale('zh-CN');
    const onValue = vi.fn();
    const ref = createRef<ChatComposerEditorHandle>();
    render(
      <ChatComposerEditor
        ref={ref}
        value=""
        onChange={onValue}
        onSubmit={() => {}}
        nodeDisplayIds={new Map()}
        onMentionQueryChange={() => {}}
        onSlashQueryChange={() => {}}
        placeholder="随心输入"
      />,
    );
    act(() => {
      ref.current!.insertReference({
        kind: 'plugin',
        id: 'tapnow-story',
        label: '故事工坊',
        skill: 'story-skill',
      });
    });
    expect(onValue).toHaveBeenCalled();
    const next = onValue.mock.calls[onValue.mock.calls.length - 1][0] as string;
    expect(next).toContain('{{tapnow-story:story-skill}}');
    expect(next).not.toContain('plugin:');
  });
});
