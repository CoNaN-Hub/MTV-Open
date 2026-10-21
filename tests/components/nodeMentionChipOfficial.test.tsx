// @vitest-environment jsdom
/**
 * 消息里的**节点提及 chip** 必须与官方真机一致。
 *
 * 官方真机 DOM（CDP 9222 实测，`app.tapnow.media` 的「可爱的小猫」提及，逐字）：
 * ```html
 * <span class="mx-0.5 inline-flex align-middle">
 *   <span class="mention mention-node group relative inline-flex items-center justify-center align-middle
 *                gap-1 h-5 min-w-[24px] max-w-[120px] p-1 cursor-pointer
 *                transition-[filter,box-shadow,color] duration-200 ease-out text-white/60
 *                hover:text-white/80 hover:brightness-110 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
 *         data-mention-type="node" style="border-radius:4px; background: rgb(40,40,40)">
 *     <button type="button" tabindex="0" class="inline-flex min-w-0 items-center gap-1 cursor-pointer border-0 bg-transparent p-0">
 *       <img src="…variant_name=small" alt="可爱的小猫" class="object-cover shrink-0"
 *            style="width:14px; height:14px; border-radius:3px">
 *       <span class="truncate text-center text-xs font-normal leading-none transition-colors">可爱的小猫</span>
 *     </button>
 *   </span>
 * </span>
 * ```
 *
 * 事故：MTV 在消息里自造了一个蓝色 `rounded-[7px] border px-2 py-1` 的 token（左侧竖线 + `#displayId`），
 * 与官方那个 `#282828` 缩略图胶囊**完全不是同一个东西**（用户按官方截图对照指出）。
 *
 * ⚠️ 官方该 chip **没有任何 hover 浮层**（CDP 9222 实测：派发 `mouseover` 后 900ms，
 * `body` 子节点数不变、无 popper/dialog）—— 只有 `hover:text-white/80 hover:brightness-110
 * hover:shadow-[inset_…]` 三条 CSS。点它走官方 `jc()` 宿主桥 ⇒ 「画布素材预览」对话框
 * （见 `tests/components/canvasResourcePreviewDialog.test.tsx`）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import ChatReferenceText from '../../src/components/chat/ChatReferenceText';
import { useAppStore } from '../../src/store/useAppStore';

const NODE_ID = 'node-cat';
const LABEL = '可爱的小猫';

/** 官方那一层包裹（真机实测类串）。 */
const WRAPPER_CLASS = 'mx-0.5 inline-flex align-middle';

function seedNode(overrides: Record<string, unknown> = {}) {
  useAppStore.setState({
    currentProjectId: 'project-1',
    projects: [{ id: 'project-1', name: 'P', createdAt: 1, updatedAt: 1 }],
    nodes: [{
      id: NODE_ID,
      type: 'ai-image',
      position: { x: 0, y: 0 },
      data: {
        type: 'ai-image',
        label: LABEL,
        displayId: 7,
        imageUrl: 'https://example.com/cat.png',
        status: 'success',
        ...overrides,
      },
    }],
  } as never);
}

function chip(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-mention-type="node"]');
  if (!el) throw new Error('no node mention chip');
  return el;
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});
afterEach(() => {
  cleanup();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('消息里的节点提及 = 官方 `ls` 胶囊（缩略图 + 文案）', () => {
  it('外壳 = 官方类串 + `data-mention-type="node"` + `#282828`/`4px`', () => {
    seedNode();
    const { container } = render(<ChatReferenceText value={`看 @{${NODE_ID}:${LABEL}} 这张`} compact />);

    const el = chip(container);
    const cls = String(el.className);
    /* 官方 `Lve`：h-5 · min-w-[24px] · max-w-[120px] · p-1 · gap-1 · mention mention-node */
    for (const token of ['mention', 'mention-node', 'h-5', 'min-w-[24px]', 'max-w-[120px]', 'p-1', 'gap-1']) {
      expect(cls, token).toContain(token);
    }
    /* 官方 `DF`/`UR` 传的 `bg`：真机是 rgb(40,40,40) = #282828 */
    expect(el.style.background).toBe('rgb(40, 40, 40)');
    expect(el.style.borderRadius).toBe('4px');
    /* 官方那一层包裹 */
    expect(String(el.parentElement?.className)).toBe(WRAPPER_CLASS);
  });

  it('缩略图 = 官方 `zR`：14×14 · border-radius 3px · object-cover', () => {
    seedNode();
    const { container } = render(<ChatReferenceText value={`@{${NODE_ID}:${LABEL}}`} compact />);

    const img = chip(container).querySelector('img')!;
    expect(img).toBeTruthy();
    expect(img.style.width).toBe('14px');
    expect(img.style.height).toBe('14px');
    expect(img.style.borderRadius).toBe('3px');
    expect(String(img.className)).toContain('object-cover');
  });

  it('文案 span = 官方逐字类串；**不再**出现 MTV 自造的 `#displayId`', () => {
    seedNode();
    const { container } = render(<ChatReferenceText value={`@{${NODE_ID}:${LABEL}}`} compact />);

    const label = chip(container).querySelector('span')!;
    expect(String(label.className)).toBe('truncate text-center text-xs font-normal leading-none transition-colors');
    expect(label.textContent).toBe(LABEL);
    expect(container.textContent).not.toContain('#7');
    expect(container.innerHTML).not.toContain('rounded-[7px]');
  });

  it('按钮 = 官方真机 `tabindex="0"`；点击仍然走 `onNodeActivate`', () => {
    seedNode();
    const onNodeActivate = vi.fn();
    const { container } = render(
      <ChatReferenceText value={`@{${NODE_ID}:${LABEL}}`} compact onNodeActivate={onNodeActivate} />,
    );

    const button = chip(container).querySelector('button')!;
    expect(button.getAttribute('tabindex')).toBe('0');
    fireEvent.click(button);
    expect(onNodeActivate).toHaveBeenCalledWith(NODE_ID);
  });

  it('节点不存在 ⇒ 官方禁用态（无 onClick、无缩略图、官方占位 glyph）', () => {
    seedNode();
    const onNodeActivate = vi.fn();
    const { container } = render(
      <ChatReferenceText value={'@{node-gone:消失了}'} compact onNodeActivate={onNodeActivate} />,
    );

    const el = chip(container);
    expect(el.querySelector('img')).toBeNull();
    const button = el.querySelector('button')!;
    fireEvent.click(button);
    expect(onNodeActivate).not.toHaveBeenCalled();
  });

  it('hover 出官方 `Df` 预览浮层：`side="top"` / `align="center"` / `agent-reference-preview`', async () => {
    seedNode();
    const { container } = render(<ChatReferenceText value={`@{${NODE_ID}:${LABEL}}`} compact />);

    const trigger = chip(container).parentElement!;
    expect(trigger.className).toBe(WRAPPER_CLASS);
    expect(trigger.getAttribute('data-state')).toBe('closed');

    /* ⚠️ Radix Tooltip 监听的是 **pointer** 事件（`onPointerMove`）——
       用 `mouseOver` 测会得到「不弹」的**错误**结论（我上一轮就是这么读错的）。
       真机上是 `Input.dispatchMouseEvent(pointerType:'mouse')`，jsdom 里对应 `pointerMove`。 */
    fireEvent.pointerMove(trigger);

    const tip = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.agent-reference-preview');
      if (!el) throw new Error('tooltip not opened yet');
      return el;
    }, { timeout: 3000 });
    expect(tip.getAttribute('data-side')).toBe('top');
    expect(tip.getAttribute('data-align')).toBe('center');

    /* 官方 `fu`（TooltipPreview）：图 + 文案条 */
    const img = tip.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe(LABEL);
    expect(img.className).toBe('block w-auto h-auto object-contain');
    /* 官方源码写的是 `min(320px, calc(100vw - 32px))`；浏览器（以及 jsdom）会把它
       序列化成 `min(320px, -32px + 100vw)` —— 官方真机 outerHTML 里就是**序列化后**的这串。 */
    expect(img.style.maxWidth).toBe('min(320px, -32px + 100vw)');
    expect(img.style.maxHeight).toBe('min(320px, -96px + 100vh)');
    expect(String(tip.textContent)).toContain(LABEL);
    expect(tip.querySelector('.px-3.py-2\\.5')).toBeTruthy();
  });

  it('官方 `Df` 的延迟参数 = `delayDuration:200` / `skipDelayDuration:0` / `disableHoverableContent`', async () => {
    /* 源码逐字：`jsx(ii,{delayDuration:200,skipDelayDuration:0,disableHoverableContent:!0,…})`。
       jsdom 里不重测 Radix 内部计时，只钉「挂上了 Provider 且默认不弹」这条不变量。 */
    seedNode();
    const { container } = render(<ChatReferenceText value={`@{${NODE_ID}:${LABEL}}`} compact />);

    expect(document.querySelector('.agent-reference-preview')).toBeNull();
    expect(chip(container).parentElement!.getAttribute('data-state')).toBe('closed');
  });
});
