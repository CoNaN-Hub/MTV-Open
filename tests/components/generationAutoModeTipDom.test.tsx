// @vitest-environment jsdom
/**
 * `GenerationAutoModeTip`（官方 `tae`）的**真实 DOM** 回归（jsdom + @testing-library/react）。
 *
 * 官方事实（`vendor-pkg-canvas-ChpWx5JY.js`，逐字核对过偏移）：
 *  · 组件体 `Yrt` @2581382、`tae = a.memo(Yrt)` + `displayName="GenerationAutoModeTip"` @2582296
 *  · 外壳 `Mp` = 官方 `InputTopSheet`（@2557231：`Trt` / `Mp = a.memo(Trt)`），
 *    DOM 根 `pointer-events-auto absolute bottom-full inset-x-[4%]`，
 *    内层 `overflow-hidden rounded-t-xl bg-chat-bubble-surface` + 底部 12px `bg-chat-bubble-header` 条
 *  · `motionKey = "generation-auto-mode-tip"`
 *  · 文案容器 `flex items-start gap-2.5 px-4 py-3` / `flex-1 min-w-0` / `text-xs leading-snug text-white/90`
 *  · 关闭钮 `text-white/40 hover:text-white/70 transition-colors cursor-pointer focus:outline-none shrink-0 mt-0.5`
 *    + `aria-label = t("chatAdapter.generationConfirmation.closeTip","Close")`
 *  · 图标 `us`（= lucide `x`：`M18 6 6 18` / `m6 6 12 12`），props `size=14 strokeWidth=1.5`
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GenerationAutoModeTip from '../../src/components/chat/GenerationAutoModeTip';
import ChatInput from '../../src/components/chat/ChatInput';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';

afterEach(cleanup);

const TIP_TEXT: Record<string, string> = {
  'zh-CN': '自动生成模式下，所有生成任务将自动扣除 Tapies。',
  'en-US': 'In auto-generate mode, Tapies will be auto-deducted for all generation tasks.',
  'ja-JP': 'すべての生成タスクで Tapies が自動的に差し引かれます。',
  'ko-KR': '모든 생성 작업에서 Tapies가 자동 차감됩니다.',
};
const CLOSE_LABEL: Record<string, string> = {
  'zh-CN': '关闭',
  'en-US': 'Close',
  'ja-JP': '閉じる',
  'ko-KR': '닫기',
};

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  setLocale('zh-CN');
});

describe('GenerationAutoModeTip —— 真实 DOM（jsdom）', () => {
  it.each(['zh-CN', 'en-US', 'ja-JP', 'ko-KR'] as const)(
    '文案四语言逐字：%s',
    (locale) => {
      setLocale(locale);
      render(<GenerationAutoModeTip visible onClose={vi.fn()} />);
      const text = screen.getByText(TIP_TEXT[locale]);
      expect(text.className).toBe('text-xs leading-snug text-white/90');
      expect(text.parentElement!.className).toBe('flex-1 min-w-0');
      expect(text.parentElement!.parentElement!.className).toBe('flex items-start gap-2.5 px-4 py-3');
    },
  );

  it('✕ 按钮类串 + `aria-label`（官方 `closeTip`）逐字', () => {
    const { container } = render(<GenerationAutoModeTip visible onClose={vi.fn()} />);
    const button = screen.getByRole('button', { name: '关闭' });
    expect(button.className).toBe(
      'text-white/40 hover:text-white/70 transition-colors cursor-pointer focus:outline-none shrink-0 mt-0.5',
    );
    expect(button.getAttribute('type')).toBe('button');
    /* 关闭钮是内容条的第 2 个子节点。 */
    expect(container.querySelectorAll('div.flex.items-start.gap-2\\.5')[0].children[1]).toBe(button);
  });

  it.each(['zh-CN', 'en-US', 'ja-JP', 'ko-KR'] as const)(
    '✕ 的 `aria-label` 四语言逐字：%s',
    (locale) => {
      setLocale(locale);
      render(<GenerationAutoModeTip visible onClose={vi.fn()} />);
      expect(screen.getByRole('button', { name: CLOSE_LABEL[locale] })).toBeTruthy();
    },
  );

  it('图标是官方 `us`（lucide x）内联：类名 / 14px / strokeWidth 1.5 / 两段 path', () => {
    render(<GenerationAutoModeTip visible onClose={vi.fn()} />);
    const svg = screen.getByRole('button', { name: '关闭' }).querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('class')).toBe('lucide lucide-x');
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('height')).toBe('14');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('stroke-width')).toBe('1.5');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke-linecap')).toBe('round');
    expect(svg.getAttribute('stroke-linejoin')).toBe('round');
    /* 官方 `IYa` 的两段 path。 */
    const paths = [...svg.querySelectorAll('path')].map((path) => path.getAttribute('d'));
    expect(paths).toEqual(['M18 6 6 18', 'm6 6 12 12']);
  });

  it('外壳逐字 = 官方 `Mp`(`InputTopSheet`)：`bottom-full inset-x-[4%]` + `bg-chat-bubble-surface` + 12px header 条', () => {
    const { container } = render(<GenerationAutoModeTip visible onClose={vi.fn()} />);
    const sheet = container.querySelector('div.pointer-events-auto') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.className).toBe('pointer-events-auto absolute bottom-full inset-x-[4%]');
    expect(sheet.getAttribute('style')).toContain('margin-bottom: -12px');
    expect(sheet.getAttribute('style')).toContain('transform-origin: bottom center');
    const surface = sheet.children[0] as HTMLElement;
    expect(surface.className).toBe('overflow-hidden rounded-t-xl bg-chat-bubble-surface');
    const header = sheet.children[1] as HTMLElement;
    expect(header.getAttribute('aria-hidden')).toBe('true');
    expect(header.className).toBe('bg-chat-bubble-header');
    expect(header.getAttribute('style')).toContain('height: 12px');
  });

  it('点击 ✕ ⇒ 触发一次 `onClose`', () => {
    const onClose = vi.fn();
    render(<GenerationAutoModeTip visible onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('`visible=false` ⇒ 整个提示条（含文案与 ✕）不渲染', () => {
    const { container } = render(<GenerationAutoModeTip visible={false} onClose={vi.fn()} />);
    expect(container.querySelector('div.pointer-events-auto')).toBeNull();
    expect(screen.queryByText(TIP_TEXT['zh-CN'])).toBeNull();
    expect(screen.queryByRole('button', { name: '关闭' })).toBeNull();
  });
});

describe('ChatInput 接线 —— 确认模式开关（jsdom）', () => {
  const renderChatInput = (agentMode: 'collaborative' | 'autonomous') => {
    const props = {
      onAssistantModelChange: vi.fn(),
      mediaModels: [],
      mediaModelOptions: [],
      mediaModelAvailability: {},
      inputValue: '',
      onInputChange: vi.fn(),
      onSend: vi.fn(),
      onAgentModeChange: vi.fn(),
      agentMode,
    };
    const view = render(<ChatInput {...props} />);
    return {
      ...view,
      rerenderMode: (mode: 'collaborative' | 'autonomous') =>
        view.rerender(<ChatInput {...props} agentMode={mode} />),
    };
  };

  it('自动生成模式（`autonomous`）⇒ 输入卡内出现提示条；点 ✕ 后消失', async () => {
    const { container } = renderChatInput('autonomous');
    const card = container.querySelector('.c-composer__card') as HTMLElement;
    expect(card).not.toBeNull();
    const tip = card.querySelector('.pointer-events-auto') as HTMLElement;
    expect(tip).not.toBeNull();
    expect(tip.className).toBe('pointer-events-auto absolute bottom-full inset-x-[4%]');
    expect(screen.getByText(TIP_TEXT['zh-CN'])).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    /* 官方 `Mp` 是 `AnimatePresence` 退场壳（exit `{duration:.16,ease:[.4,0,.2,1]}`）
       ⇒ 节点在退场动画结束后才移除。 */
    await waitFor(() => expect(screen.queryByText(TIP_TEXT['zh-CN'])).toBeNull());
    expect(card.querySelector('.pointer-events-auto')).toBeNull();
  });

  it('手动确认（`collaborative`）⇒ 提示条消失；再切回自动 ⇒ 重新出现（关闭标记重置）', async () => {
    const { container, rerenderMode } = renderChatInput('autonomous');
    const card = container.querySelector('.c-composer__card') as HTMLElement;
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(screen.queryByText(TIP_TEXT['zh-CN'])).toBeNull());

    /* 切到手动 ⇒ 不渲染。 */
    rerenderMode('collaborative');
    await waitFor(() => expect(screen.queryByText(TIP_TEXT['zh-CN'])).toBeNull());
    expect(card.querySelector('.pointer-events-auto')).toBeNull();

    /* 再切回自动 ⇒ 关闭标记已重置 ⇒ 重新出现（用户口径）。 */
    rerenderMode('autonomous');
    await waitFor(() => expect(screen.getByText(TIP_TEXT['zh-CN'])).toBeTruthy());
  });

  it('未关闭时切模式不会遗留状态：自动 ⇒ 手动 ⇒ 自动始终可见', async () => {
    const { rerenderMode } = renderChatInput('autonomous');
    expect(screen.getByText(TIP_TEXT['zh-CN'])).toBeTruthy();
    rerenderMode('collaborative');
    await waitFor(() => expect(screen.queryByText(TIP_TEXT['zh-CN'])).toBeNull());
    rerenderMode('autonomous');
    await waitFor(() => expect(screen.getByText(TIP_TEXT['zh-CN'])).toBeTruthy());
    rerenderMode('collaborative');
    await waitFor(() => expect(screen.queryByText(TIP_TEXT['zh-CN'])).toBeNull());
  });
});
