// @vitest-environment jsdom
/**
 * `ToolCallFileRow`（官方 `fie`，offset 2404588）与 `ToolActivityDetailList` 里的接线回归。
 *
 * 官方逐字：
 * ```js
 * <button type="button" data-tool-file-row="" onClick={() => requestWorkspaceFile(fileName)}
 *   className="block max-w-[min(640px,100%)] cursor-pointer truncate py-0.5 text-left underline
 *              decoration-transparent underline-offset-2 transition-colors hover:text-foreground/80
 *              hover:decoration-current">{t(ba(key), {fileName, defaultValue})}</button>
 * ```
 * `key` = `edit` 时 `editingFile`/`editedFile`，否则 `readingFile`/`readFile`（按 `isActive` 分）。
 * 触发行条件（官方 `hie`）：`fileName = trim(content.request.file_name)` 且 `labelInput.kind ∈ {edit, exploration}`。
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ToolActivityDetailList from '../../src/components/chat/ToolActivityDetailList';
import ToolCallFileRow from '../../src/components/chat/ToolCallFileRow';
import type { ToolEventLike } from '../../src/services/chat/agentToolLabels';

afterEach(cleanup);

const BUTTON_CLASS = 'block max-w-[min(640px,100%)] cursor-pointer truncate py-0.5 text-left underline decoration-transparent underline-offset-2 transition-colors hover:text-foreground/80 hover:decoration-current';

describe('ToolCallFileRow —— 官方 fie', () => {
  it('按钮的类串与 `data-tool-file-row` 逐字', () => {
    const { container } = render(<ToolCallFileRow fileName="src/a.ts" kind="edit" isActive />);
    const button = container.querySelector('button')!;
    expect(button.getAttribute('class')).toBe(BUTTON_CLASS);
    expect(button.getAttribute('data-tool-file-row')).toBe('');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('四个文案分支（zh-CN，`{{fileName}}` 官方同名插值）', () => {
    const text = (kind: 'edit' | 'exploration', isActive: boolean) => {
      const { container } = render(<ToolCallFileRow fileName="笔记.md" kind={kind} isActive={isActive} />);
      const value = container.querySelector('button')!.textContent;
      cleanup();
      return value;
    };
    expect(text('edit', true)).toBe('正在编辑 笔记.md');
    expect(text('edit', false)).toBe('已编辑 笔记.md');
    expect(text('exploration', true)).toBe('正在读取 笔记.md');
    expect(text('exploration', false)).toBe('已读取 笔记.md');
  });

  it('点击走官方 store 动作的替身 `onOpenFile(fileName)`', () => {
    const onOpenFile = vi.fn();
    const { container } = render(<ToolCallFileRow fileName="src/a.ts" kind="exploration" isActive={false} onOpenFile={onOpenFile} />);
    fireEvent.click(container.querySelector('button')!);
    expect(onOpenFile).toHaveBeenCalledWith('src/a.ts');
  });

  it('未注入 `onOpenFile` 时点击不抛（官方那条 store 动作 MTV 没有）', () => {
    const { container } = render(<ToolCallFileRow fileName="src/a.ts" kind="edit" isActive={false} />);
    expect(() => fireEvent.click(container.querySelector('button')!)).not.toThrow();
  });
});

describe('ToolActivityDetailList —— 文件行接线（官方 hie 的 `C` 分支）', () => {
  const item = (tool: string, status: string, fileName?: string): ToolEventLike => ({
    id: `call-${tool}-${status}`,
    type: 'tool_event',
    content: {
      tool,
      status,
      tool_call_id: `call-${tool}-${status}`,
      request: fileName === undefined ? {} : { file_name: `  ${fileName}  ` },
      response: {},
    },
  });

  it('`request.file_name` 存在且 kind ∈ {edit, exploration} ⇒ 渲染 `fie` 文件行（并 trim 文件名）', () => {
    const { container } = render(
      <ToolActivityDetailList items={[item('edit', 'started', ' 笔记.md ')]} />,
    );
    const button = container.querySelector('[data-tool-file-row]')!;
    expect(button).not.toBeNull();
    /* 官方 `_ot` 走 `bb`：取到的值会 `trim()`。 */
    expect(button.textContent).toBe('正在编辑 笔记.md');
    /* 文件行分支下不再渲染普通标签 span（官方 `C ? <fie/> : <span/>`）。 */
    expect(container.querySelector('li span.truncate')).toBeNull();
  });

  it('没有 `file_name` ⇒ 走普通标签分支（不渲染 `data-tool-file-row`）', () => {
    const { container } = render(<ToolActivityDetailList items={[item('edit', 'started')]} />);
    expect(container.querySelector('[data-tool-file-row]')).toBeNull();
    expect(container.querySelector('li')).not.toBeNull();
  });

  it('工具名不是 edit/exploration 语义 ⇒ 即便有 `file_name` 也走普通标签分支', () => {
    const { container } = render(<ToolActivityDetailList items={[item('Bash', 'completed', 'a.sh')]} />);
    expect(container.querySelector('[data-tool-file-row]')).toBeNull();
  });

  it('`onOpenFile` 从列表透传到文件行', () => {
    const onOpenFile = vi.fn();
    const { container } = render(
      <ToolActivityDetailList items={[item('edit', 'started', 'a.ts')]} onOpenFile={onOpenFile} />,
    );
    fireEvent.click(container.querySelector('[data-tool-file-row]')!);
    expect(onOpenFile).toHaveBeenCalledWith('a.ts');
  });
});
