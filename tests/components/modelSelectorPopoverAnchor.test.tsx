// @vitest-environment jsdom
/**
 * `ModelSelector` 弹层锚点回归 —— 官方 `AgentModelPicker` 用 **Radix `Popover.Trigger` 的真实元素**
 * 作为锚点（`align="end"` / `alignOffset` / `sideOffset=8` / `side` 翻转全由该元素 rect 推导）。
 *
 * ⚠️ 事故（用户截图）：聊天输入条走 `renderTrigger`（官方胶囊 `ChatModelChip`，类名不是
 *   `.model-selector-trigger`）⇒ `measureDropdown()` 里 `querySelector('.model-selector-trigger')`
 *   取到 `null` ⇒ 直接 `return` ⇒ `.model-dropdown { position: fixed; left: 0; top: 0 }`
 *   一次定位都没拿到 ⇒ **弹层贴在整个窗口左上角**。
 * 本测试断言：`renderTrigger` 形态下打开弹层后，弹层被写上了 inline `left` / `top`。
 */
import { cleanup, render, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/i18n', () => ({ useT: () => (text: string) => text }));
vi.mock('../../src/store/useAppStore', () => {
  const state = { config: { providers: {}, comfyUIUrl: 'http://localhost:8188', comfyServers: [] }, showToast: vi.fn() };
  return { useAppStore: Object.assign((select: (s: unknown) => unknown) => select(state), { getState: () => state }) };
});
vi.mock('../../src/components/nodes/shared/defaultModels', () => ({
  defaultModelGroups: [], getConfiguredModelGroups: () => [], getGeneralModelGroups: () => [],
}));

import ModelSelector from '../../src/components/nodes/shared/ModelSelector';

afterEach(cleanup);

const GENERAL_MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'gemini-3.1-pro-preview', provider: 'google', description: 'Gemini 3.1', category: 'text' as const },
  { id: 'glm-4.6v', name: 'glm-4.6v', provider: 'zhipu', description: 'GLM', category: 'text' as const },
];

describe('ModelSelector —— 弹层锚点（renderTrigger 形态）', () => {
  it('打开后弹层拿到 inline left/top（不再贴在窗口左上角）', async () => {
    const { container } = render(
      <ModelSelector
        nodeType="ai-text"
        selectedModel={GENERAL_MODELS[0] as never}
        onSelect={() => {}}
        generalModelsOverride={GENERAL_MODELS as never}
        renderTrigger={({ open, label, toggle }) => (
          <button type="button" data-slot="dropdown-menu-trigger" data-icon-only={undefined} aria-label={label} onClick={toggle}>
            {open ? 'open' : 'closed'}
          </button>
        )}
      />,
    );

    const trigger = container.querySelector('[data-slot="dropdown-menu-trigger"]') as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();

    await act(async () => { trigger!.click(); });
    await act(async () => {});

    const popup = document.querySelector('.model-dropdown') as HTMLElement | null;
    expect(popup).not.toBeNull();
    /* 事故前：`left` / `top` 都是空串（只有 CSS 的 `left: 0; top: 0`）⇒ 贴窗口左上角。 */
    expect(popup!.style.left).not.toBe('');
    expect(popup!.style.top).not.toBe('');
    expect(popup!.style.left.endsWith('px')).toBe(true);
    expect(popup!.style.top.endsWith('px')).toBe(true);
  });
});
