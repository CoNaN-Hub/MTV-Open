// @vitest-environment jsdom
/**
 * §6 #8「应用」提及在主输入卡 `@` 面板里的**接线**回归（jsdom 真 DOM）。
 *
 * 官方口径：`@` 提及面板的来源之一是 `componentProps.plugins`（`Ub` 的 `Re[]`），
 * 分组标题文案是 `omniReference.suggestion.pluginSection`（zh「应用」）。
 * MTV 主输入卡的内核是自写的 `ChatComposerEditor`（非官方 `qie`），`@` 面板由 `ChatInput`
 * 用 `MentionPicker` 渲染 ⇒ 本测试锁住「安装的应用能在主输入卡里被 `@` 到」。
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInput from '../../src/components/chat/ChatInput';
import { useAppStore } from '../../src/store/useAppStore';
import { setLocale } from '../../src/i18n';
import type { InstalledPlugin } from '../../src/types/plugin';

afterEach(cleanup);

const PLUGIN: InstalledPlugin = {
  id: 'tapnow-story',
  manifest: {
    id: 'tapnow-story',
    name: '故事工坊',
    version: '1.0.0',
    description: '把分镜写成故事',
    entry: 'index.js',
    category: 'skill',
    runtime: 'javascript',
  } as InstalledPlugin['manifest'],
  source: 'console.log(1)',
  enabled: true,
  installedAt: 1,
  updatedAt: 1,
};

function renderComposer() {
  return render(
    <ChatInput
      onAssistantModelChange={vi.fn()}
      mediaModels={[]}
      mediaModelOptions={[]}
      mediaModelAvailability={{}}
      inputValue=""
      onInputChange={vi.fn()}
      onSend={vi.fn()}
    />,
  );
}

/** 在输入框里敲出 `@`，让 `ChatInput` 打开官方提及面板。
 *  ⚠️ `ChatComposerEditor.detectTrigger` 读的是 **caret 前的文本**（`window.getSelection`），
 *  所以必须先真的放一个光标在文本末尾，再派发 `input`。 */
function openMentionPanel(container: HTMLElement) {
  const editor = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
  expect(editor).not.toBeNull();
  editor!.textContent = '@';
  const range = document.createRange();
  range.selectNodeContents(editor!);
  range.collapse(false);
  const selection = window.getSelection();
  expect(selection).not.toBeNull();
  selection!.removeAllRanges();
  selection!.addRange(range);
  fireEvent.input(editor!);
  return editor!;
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ installedPlugins: [PLUGIN] });
  setLocale('zh-CN');
});

describe('§6 #8 —— 主输入卡 `@` 面板的「应用」分区', () => {
  it('面板**没有 Tab 行**（官方 `Ub` 是「一个滚动列表 + 多分区」），「应用」是**分区标题**', () => {
    const { container } = renderComposer();
    openMentionPanel(container);
    /* ★ 官方没有 Tab（规格书 §0-1/§1）⇒ 旧的分类切换行必须消失。 */
    expect(container.querySelector('.mention-picker-tabs')).toBeNull();
    /* 官方分区标题 = `tm`（`mention-group-label` / `mention-group-hint`）。 */
    const labels = Array.from(container.querySelectorAll('.mention-group-label')).map((el) => el.textContent);
    expect(labels).toContain('应用');
    expect(labels).not.toContain('模型');
  });

  it('「应用」分区直接列出已安装应用（displayName），点击后写进官方 token', () => {
    /* `onInputChange` 承接 `ChatComposerEditor.insertReference` 的序列化结果。 */
    const onInputChange = vi.fn();
    const { container } = render(
      <ChatInput
        onAssistantModelChange={vi.fn()}
        mediaModels={[]}
        mediaModelOptions={[]}
        mediaModelAvailability={{}}
        inputValue=""
        onInputChange={onInputChange}
        onSend={vi.fn()}
      />,
    );
    openMentionPanel(container);

    /* 应用段默认展开 3 条 ⇒ 行直接可点（不需要先切 Tab）。 */
    const row = screen.getByText('故事工坊', { selector: '.mention-row-label' });
    expect(row).not.toBeNull();
    /* ⚠️ `MentionPicker` 的行用 **`onMouseDown`**（官方同款，防止输入框失焦）。 */
    fireEvent.mouseDown(row.closest('button') as HTMLElement);
    expect(onInputChange).toHaveBeenCalled();
    const next = onInputChange.mock.calls[onInputChange.mock.calls.length - 1][0] as string;
    /* 官方 `k0e(name, skill)`：MTV 的已安装应用没有 skills ⇒ 技能名退化为 pluginName（官方 `Pde` 的兜底）。 */
    expect(next).toContain('{{tapnow-story:tapnow-story}}');
  });
});
