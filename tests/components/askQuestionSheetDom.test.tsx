// @vitest-environment jsdom
/**
 * `AskQuestionSheet`（官方 `Qie`）的**真实 DOM** 回归（jsdom + @testing-library/react）。
 *
 * 官方事实（`live-提问表单族.md` §1.3/§1.4/§1.5/§1.6/§1.7/§1.9 —— live 逐字）：
 *  · 常量 `$ie = 4`（渲染选项上限）/ `urt = 200`（自由文本 maxLength）
 *  · 根是 `div[role="listbox"].outline-none`（`tabIndex=-1`，`aria-label = 题干`）
 *  · 头部 `flex items-start gap-2 border-b border-white/[0.07] px-3.5 pb-2.5 pt-3`，
 *    header chip `bg-white/[0.08]`（与历史摘要卡的 `white/[0.06]` 不同），多题时右侧进度 `{{current}} / {{total}}`
 *  · 选项区 `p-1.5`；行基类 `flex min-h-[34px] w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 transition-colors`
 *  · `RowIndex` = `flex size-[15px] … rounded-[3px] text-[10px]`，激活 `bg-white/[0.13]`
 *  · 单选指示器 `rounded-full`（未选无边框）；多选 `rounded-[5px]`（未选 `border border-white/25`）
 *  · 页脚 `flex items-center gap-2 border-t border-white/[0.06] px-3.5 pb-2 pt-2`；
 *    上一题禁用 `cursor-not-allowed bg-white/[0.03] text-muted-foreground/30`；
 *    下一题/提交启用 `bg-[#F2F2F2] text-[#202020]`，多选带 `({selected.length})`
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AskQuestionSheet from '../../src/components/chat/AskQuestionSheet';
import { useAppStore } from '../../src/store/useAppStore';
import type { AskQuestion } from '../../src/services/chat/askQuestion';

afterEach(cleanup);

const question = (id: string, options: number, extra: Partial<AskQuestion> = {}): AskQuestion => ({
  question_id: id,
  question: `问题 ${id}`,
  options: Array.from({ length: options }, (_, index) => ({ label: `选项${index + 1}` })),
  multiSelect: false,
  ...extra,
});

const setPending = (questions: AskQuestion[], step = 0) => {
  useAppStore.setState({
    pendingQuestion: { toolUseId: 'call-1', questions, status: 'pending', step, collectedAnswers: [] },
    multiSelectDraft: [],
  });
};

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('AskQuestionSheet —— 真实 DOM（jsdom）', () => {
  it('可见时渲染 listbox / 题干 / 进度 / 选项 / 页脚，class 逐字', () => {
    setPending([question('q1', 2, { header: '风格' }), question('q2', 1)]);
    const { container } = render(<AskQuestionSheet onAnswer={vi.fn()} />);

    const listbox = screen.getByRole('listbox');
    expect(listbox.className).toBe('outline-none');
    expect(listbox.getAttribute('aria-label')).toBe('问题 q1');

    /* header chip 在面板里是 `bg-white/[0.08]`。 */
    const header = screen.getByText('风格');
    expect(header.className).toBe('shrink-0 rounded-[5px] bg-white/[0.08] px-1.5 py-0.5 text-[11px] leading-4 text-chat-foreground');
    expect(screen.getByText('问题 q1').className).toBe('min-w-0 flex-1 text-[13px] leading-[1.5] text-chat-foreground');
    /* 多题 ⇒ 显示官方 `progress`。 */
    expect(screen.getByText('1 / 2')).toBeTruthy();

    /* 选项行基类 + 单选指示器 `rounded-full`（指示器是行的最后一个子节点）。 */
    const rows = container.querySelectorAll('button[role="option"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toContain('min-h-[34px] w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 transition-colors');
    const indicator = rows[0].lastElementChild as HTMLElement;
    expect(indicator.className).toContain('rounded-full');

    /* 页脚：未选任何项时官方「下一题/提交」是**禁用态**（`canGoNext = false`）。 */
    expect(screen.getByRole('button', { name: '上一题' }).className).toContain('cursor-not-allowed bg-white/[0.03] text-muted-foreground/30');
    expect(screen.getByRole('button', { name: '下一题' }).className).toContain('cursor-not-allowed bg-white/[0.08] text-muted-foreground/40');
  });

  it('选项只渲染前 4 个（官方 `$ie = 4`）', () => {
    setPending([question('q1', 6)]);
    const { container } = render(<AskQuestionSheet onAnswer={vi.fn()} />);
    expect(container.querySelectorAll('button[role="option"]')).toHaveLength(4);
  });

  it('多选指示器是 `rounded-[5px]` + 未选 `border border-white/25`', () => {
    setPending([question('q1', 2, { multiSelect: true })]);
    const { container } = render(<AskQuestionSheet onAnswer={vi.fn()} />);
    const row = container.querySelector('button[role="option"]')!;
    const indicator = row.lastElementChild as HTMLElement;
    expect(indicator.className).toContain('rounded-[5px]');
    expect(indicator.className).toContain('border border-white/25');
  });

  it('点选项 ⇒ `aria-selected` 变真，多选时按钮带 `(1)` 且由禁用变启用', async () => {
    setPending([question('q1', 2, { multiSelect: true })]);
    render(<AskQuestionSheet onAnswer={vi.fn()} />);
    const options = screen.getAllByRole('option');
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    /* 单题 ⇒ 官方按钮文案是 `submit`（提交）。 */
    expect(screen.getByRole('button', { name: '提交' }).className).toContain('cursor-not-allowed');
    fireEvent.click(options[0]);
    await waitFor(() => expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true'));
    const submit = screen.getByRole('button', { name: /提交/ });
    expect(submit.textContent).toContain('(1)');
    expect(submit.className).toContain('cursor-pointer bg-[#F2F2F2] text-[#202020]');
  });

  it('最后一题 ⇒ 按钮文案是官方 `submit`（提交），非最后一题是 `next`（下一题）', () => {
    setPending([question('q1', 1), question('q2', 1)], 1);
    render(<AskQuestionSheet onAnswer={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '下一题' })).toBeNull();
    expect(screen.getByRole('button', { name: '提交' })).toBeTruthy();
  });

  it('单选点选后按「提交」⇒ `onAnswer(toolUseId, {labels})` 并清空多选草稿', async () => {
    const onAnswer = vi.fn();
    setPending([question('q1', 2)]);
    render(<AskQuestionSheet onAnswer={onAnswer} />);
    fireEvent.click(screen.getAllByRole('option')[1]);
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('call-1', { labels: ['选项2'], freeText: undefined }));
    expect(useAppStore.getState().multiSelectDraft).toEqual([]);
  });

  it('自由文本行：用官方 `qie`(`ChatMentionInput`) —— 根 `data-chat-mention-input` + 行内基类一致', () => {
    setPending([question('q1', 1)]);
    render(<AskQuestionSheet onAnswer={vi.fn()} />);
    const row = document.querySelector('[data-ask-free-text="true"]') as HTMLElement;
    expect(row.className).toContain('min-h-[34px] w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 transition-colors');
    expect(row.className).toContain('cursor-text');
    /* 官方 `qie` 的根标记（`qie` 自身逐字带 `data-chat-mention-input="true"`）。 */
    const mentionInput = row.querySelector('[data-chat-mention-input="true"]') as HTMLElement;
    expect(mentionInput).not.toBeNull();
    expect(mentionInput.className).toContain('min-w-0 flex-1');
    /* 编辑器内容区是 Tiptap 的 `.ProseMirror`，`aria-label` 与 placeholder 都用官方 `hintFreeText`。 */
    const editable = mentionInput.querySelector('.ProseMirror') as HTMLElement;
    expect(editable).not.toBeNull();
    expect(editable.getAttribute('aria-label')).toBe('或直接打字回答，@ 引用节点 / 素材');
    expect(editable.getAttribute('contenteditable')).toBe('true');
    /* `RowIndex` 的 index = options.length（官方自由文本行是第 n+1 行）。 */
    expect(row.querySelector('span[aria-hidden]')!.textContent).toBe('2');
  });

  it('`suppressed` 为真 ⇒ 不渲染', () => {
    setPending([question('q1', 1)]);
    render(<AskQuestionSheet onAnswer={vi.fn()} suppressed />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('非 pending 状态 / 无题 ⇒ 不渲染', () => {
    useAppStore.setState({ pendingQuestion: null, multiSelectDraft: [] });
    render(<AskQuestionSheet onAnswer={vi.fn()} />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
