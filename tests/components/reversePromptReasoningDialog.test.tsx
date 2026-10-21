// @vitest-environment jsdom
/**
 * 反推弹窗的「思考」落点（第 81 轮）。
 *
 * ⚠️ **这是 MTV 自有落点、官方无对应物**：官方只有**对话**路径的 SSE `event:thinking`
 * （→ `ChatMessage.thinkingItems`），非对话生成路径（`reversePrompt` → `generateText`）
 * 官方**没有任何推理出口**。产物 9 个 JS 里 `reasoning_content` / `reasoning_details` /
 * `thinking_delta` / `redacted_thinking` 全 **0 命中**（见 `agent-挖掘覆盖表.md` §75/§81）。
 *
 * 本文件钉住三件事：
 *   ① 推理真的从 `generateText` 一路流到弹窗的 `.reverse-prompt-thinking` 里；
 *   ② 推理**绝不**混进「反推结果」文本框（它仍只有正文）；
 *   ③ 模型没有推理通道时，思考块**根本不渲染**（不凭空造 UI）。
 *
 * 验证分级 = **(b) jsdom 真 DOM**（真实组件 + 真实 `generateText` + stub `fetch`）。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReversePromptDialog from '../../src/components/nodes/shared/ReversePromptDialog';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';

const jsonResponse = (payload: unknown) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

/** 配一个「能读图」的通用模型（`gpt-4o` 命中 `isVisionCapableTextModel`）当反推模型。 */
function setupVisionModel(): void {
  useAppStore.setState((state) => ({
    config: {
      ...state.config,
      providers: {
        ...state.config.providers,
        'vision-provider': {
          name: '视觉连接',
          apiKey: 'secret',
          baseUrl: 'https://gateway.example',
          catalogId: 'custom-openai',
        },
      },
      generalModels: [{
        id: 'vision-4o',
        name: '看图模型',
        modelId: 'gpt-4o',
        category: 'text',
        providerConfigId: 'vision-provider',
      }],
    },
    reversePromptRequest: {
      sourceNodeId: 'node-source',
      kind: 'image',
      imageUrls: ['data:image/png;base64,Y2F0'],
    },
  }));
}

beforeEach(() => {
  setLocale('zh-CN');
  vi.unstubAllGlobals();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  cleanup();
});

describe('ReversePromptDialog 思考块', () => {
  it('只回推理：思考块渲染逐字推理，反推结果仍为空（推理不进结果）', async () => {
    setupVisionModel();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: '', reasoning_content: '先想一下画面构成' } }],
    })));

    render(<ReversePromptDialog />);
    fireEvent.click(screen.getByRole('button', { name: /开始反推/ }));

    const block = await waitFor(() => {
      const found = document.querySelector('.reverse-prompt-thinking-body');
      expect(found?.textContent).toBe('先想一下画面构成');
      return found;
    });
    expect(block?.textContent).toBe('先想一下画面构成');
    // 「思考过程」是折叠面板的标题
    expect(document.querySelector('.reverse-prompt-thinking > summary')?.textContent).toBe('思考过程');
    // 推理不进结果框：结果框此时还是空的（`''`，不抛异常）
    const resultBox = document.querySelector<HTMLTextAreaElement>('.reverse-prompt-result');
    expect(resultBox?.value ?? '').toBe('');
    expect(document.querySelector('.reverse-prompt-error')).toBeNull();
  });

  it('有正文 + 有推理：两个块各自独立（推理不并入正文）', async () => {
    setupVisionModel();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{
        message: { content: '一只橘猫坐在窗台，逆光', reasoning_content: '先看主体再看光线' },
      }],
    })));

    render(<ReversePromptDialog />);
    fireEvent.click(screen.getByRole('button', { name: /开始反推/ }));

    await waitFor(() => {
      expect(document.querySelector('.reverse-prompt-thinking-body')?.textContent)
        .toBe('先看主体再看光线');
    });
    const resultBox = document.querySelector<HTMLTextAreaElement>('.reverse-prompt-result');
    expect(resultBox?.value).toBe('一只橘猫坐在窗台，逆光');
    expect(resultBox?.value).not.toContain('先看主体再看光线');
  });

  it('模型没有推理通道：思考块不渲染（不凭空造 UI）', async () => {
    setupVisionModel();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      choices: [{ message: { content: '一只橘猫坐在窗台，逆光' } }],
    })));

    render(<ReversePromptDialog />);
    fireEvent.click(screen.getByRole('button', { name: /开始反推/ }));

    await waitFor(() => {
      expect(document.querySelector<HTMLTextAreaElement>('.reverse-prompt-result')?.value)
        .toBe('一只橘猫坐在窗台，逆光');
    });
    expect(document.querySelector('.reverse-prompt-thinking')).toBeNull();
  });
});
