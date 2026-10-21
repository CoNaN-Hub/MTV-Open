// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPromptToNodes, serializeDOM } from '../../src/components/nodes/shared/mentionEditorDom';
import { useAppStore } from '../../src/store/useAppStore';

vi.mock('../../src/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/i18n')>();
  return { ...actual, useT: () => (key: string) => key, t: (key: string) => key };
});

/**
 * 焦点编辑（官方 `magicSelection`）的输入框芯片。
 *
 * 官方（`vendor-pkg-canvas-CvbAwZyy.js` @307211 / @1223925）：
 *   `{{magic_item:{…}}}` → `<span class="mention mention-magic">`
 *     · 识别中：`⏳ Recognizing...`
 *     · 已识别：`[12×12 缩略图] + label`（label = token/mark 里的 `label_name`，**不是节点标题**）
 *     · 多候选：尾巴一个 chevron，点开是候选下拉
 *   MTV 原来写的是 `@{nodeId:label}` 节点引用芯片（显示节点标题/文件名）⇒ 用户现场「命名有问题」。
 */
function tokenOf(data: Record<string, unknown>): string {
  return `{{magic_item:${JSON.stringify(data)}}}`;
}

function renderToDom(text: string): HTMLElement {
  const root = document.createElement('div');
  for (const node of renderPromptToNodes(text, new Map())) root.appendChild(node);
  return root;
}

beforeEach(() => {
  useAppStore.setState({ focusEditMarks: [] });
});

describe('magic item chip in the prompt editor', () => {
  it('renders the recognised label (not the node title) and round-trips back to the token', () => {
    useAppStore.setState({
      focusEditMarks: [{
        id: 'm1',
        targetNodeId: 'n1',
        label: '大象',
        box_2d: [0.1, 0.1, 0.5, 0.5],
        detections: [
          { label_name: '大象', box_2d: [0.1, 0.1, 0.5, 0.5] },
          { label_name: '象群', box_2d: [0.1, 0.1, 0.9, 0.9] },
        ],
        selectedIndex: 0,
        isLoading: false,
      }],
    });
    const token = tokenOf({ label_name: '大象', box_2d: [0.1, 0.1, 0.5, 0.5], _markId: 'm1', nodeId: 'n1' });
    const root = renderToDom(`把 ${token} 换成红色`);
    const chip = root.querySelector('[data-magic-item]') as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('data-label')).toBe('大象');
    expect(chip.textContent).toContain('大象');
    /* 官方是 `mention mention-magic`，不是 `@` 节点引用芯片 */
    expect(chip.className).toContain('mention-magic');
    expect(chip.hasAttribute('data-ref-id')).toBe(false);
    /* 多候选 ⇒ 有 chevron */
    expect(chip.querySelector('.prompt-chip-magic-chevron')).toBeTruthy();
    /* 序列化回 token（DOM → prompt 串，不能把芯片丢掉） */
    expect(serializeDOM(root)).toContain('{{magic_item:');
    expect(serializeDOM(root)).toContain('"_markId":"m1"');
  });

  it('shows the recognising state while the mark is still loading', () => {
    useAppStore.setState({
      focusEditMarks: [{
        id: 'm2',
        targetNodeId: 'n1',
        label: '',
        box_2d: [0, 0, 0, 0],
        detections: [],
        selectedIndex: 0,
        isLoading: true,
      }],
    });
    const root = renderToDom(tokenOf({ isLoading: true, label_name: 'Recognizing...', _markId: 'm2' }));
    const chip = root.querySelector('[data-magic-item]') as HTMLElement;
    expect(chip.className).toContain('mention-magic-loading');
    expect(chip.textContent).toContain('⏳');
    /* 识别中不显示 chevron */
    expect(chip.querySelector('.prompt-chip-magic-chevron')).toBeNull();
  });

  it('falls back to the token label when the mark is gone (page reload)', () => {
    const root = renderToDom(tokenOf({ label_name: '树叶', box_2d: [0.2, 0.2, 0.4, 0.4], _markId: 'gone', nodeId: 'n1' }));
    const chip = root.querySelector('[data-magic-item]') as HTMLElement;
    expect(chip.getAttribute('data-label')).toBe('树叶');
    expect(chip.textContent).toContain('树叶');
  });
});
