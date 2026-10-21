/**
 * §78：让 MTV 的「思考强度」**真的可调** —— 元数据解析（优先级 + 兜底偏离）与请求字段落成。
 *
 * ## 官方逐字依据（`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`）
 *
 * | 官方行为 | 逐字 |
 * |---|---|
 * | 控件门槛 | `NR = ({model:e,…}) => { const r = e.thinking; if (!r) return null; … }` @70900 一带 |
 * | 默认档 | `const l = t?.level \|\| r.default?.level \|\| i[0] \|\| null;`（`i = r.levels \|\| []`） |
 * | 可关 | `CR = e => e.thinking?.can_disable !== !1` |
 * | 可切换 | `const u = i.length > 1;`（**不是** `switchable`） |
 * | 哨兵序列 | `const p = c ? [km, ...i] : i;`（`km = "__thinking_off__"`）；选哨兵 ⇒ `n({enabled:!1, …(l?{level:l}:{})})` |
 * | 写入点 | `setChatModelThinkingSettings(modelId, setting)` → `chatModelThinkingSettings[modelId]` |
 * | 提交时读 | `ir = Xo && Xo !== "auto" ? chatModelThinkingSettings[Xo] : undefined` → `… ir ? {thinking: ir} : {}` |
 * | 档位词汇表 | i18n `chatAdapter.modelOptions.levels` = `low/medium/high/xhigh/extra_high/max` |
 *
 * ## ★ 本工程唯一偏离官方处（逐字声明）★
 * 官方在 `!model.thinking` 时**不渲染**该控件。MTV 的模型目录（用户自配第三方连接）**永远**拿不到
 * 服务端 `thinking.levels` ⇒ 按用户决定：**用官方那套逐字档位词汇表兜底把同一个控件画出来**
 * （`officialFallbackThinkingMeta()`）。默认档仍走官方那条 `||` 链 ⇒ `levels[0]` = `low`；
 * 可关仍走官方判据 `can_disable !== false` ⇒ 序列 = 哨兵 + 6 档。
 * **不自造档位名、不重排官方字典键序、不新增档位**。
 *
 * 验证分级：(b) jsdom/真 DOM 见 `tests/components/agentModelFlyoutDom.test.tsx`；
 * 本文件是 (b) 服务层 + (b) 真 `fetch` 请求体落成。真机 (a) 读数见 §78 报告。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configuredThinkingMetaForModel,
  officialFallbackThinkingMeta,
  resolveThinkingMetaForModel,
  selectedThinkingSetting,
  thinkingBodyParams,
} from '../../src/services/chat/configuredModelThinking';
import { MODEL_LEVEL_CODES } from '../../src/services/chat/modelPickerStrings';
import { streamAssistantReply } from '../../src/services/ai/assistantStream';
import { useAppStore } from '../../src/store/useAppStore';
import type { ModelThinkingMeta } from '../../src/types/chat';

/** 官方 i18n `chatAdapter.modelOptions.levels` 的键序，**逐字**（顺序 = 官方字典键序）。 */
const OFFICIAL_LEVEL_VOCABULARY = ['low', 'medium', 'high', 'xhigh', 'extra_high', 'max'] as const;

const CONFIGURED: ModelThinkingMeta = {
  levels: ['LOW', 'MEDIUM', 'HIGH'],
  default: { enabled: true, level: 'MEDIUM' },
  can_disable: false,
  wireField: 'reasoning_effort',
  wireCase: 'lower',
};

/** 把「自定义连接 + 一个文本模型」装进 store（与 `assistantStreamReasoning.test.ts` 同形）。 */
function configureAssistant(generalModelThinking?: ModelThinkingMeta) {
  useAppStore.setState((state) => ({
    config: {
      ...state.config,
      assistantModelId: 'assistant-model',
      providers: {
        ...state.config.providers,
        'custom-assistant': {
          name: '土豆中转站（OpenAI 兼容）',
          apiKey: 'secret',
          baseUrl: 'https://api.ai-tudou.net/v1',
          catalogId: 'custom-openai',
        },
      },
      generalModels: [{
        id: 'assistant-model',
        name: '土豆 DeepSeek',
        modelId: 'deepseek-v4',
        category: 'text',
        providerConfigId: 'custom-assistant',
        ...(generalModelThinking ? { thinking: generalModelThinking } : {}),
      }],
    },
  }));
}

/** 只建 SSE 响应，供 `streamAssistantReply` 的 fetch mock 使用。 */
const sseResponse = (body: string) => new Response(body, {
  headers: { 'Content-Type': 'text/event-stream' },
});

/** 取出这次真实请求的 JSON 请求体。 */
function requestBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('§78 兜底档位词汇表（★ 唯一偏离官方处 ★）', () => {
  it('① 档位 code 与顺序**逐字**等于官方 i18n `chatAdapter.modelOptions.levels`', () => {
    expect(officialFallbackThinkingMeta().levels).toEqual([...OFFICIAL_LEVEL_VOCABULARY]);
    /* 同一份常量（`modelPickerStrings.MODEL_LEVEL_CODES`）—— 不许两处各写一份 */
    expect(officialFallbackThinkingMeta().levels).toEqual([...MODEL_LEVEL_CODES]);
  });

  it('② 刻意**不写** default / can_disable / switchable / wireField / wireCase / labels（不自造数据）', () => {
    const meta = officialFallbackThinkingMeta();
    expect(Object.keys(meta).sort()).toEqual(['levels']);
    /* 没有 `default` ⇒ 默认档落回官方 `||` 链最后一环 `levels[0]`；没有 `can_disable` ⇒ 官方判据判为可关 */
    expect(meta.default).toBeUndefined();
    expect(meta.can_disable).toBeUndefined();
    expect(meta.wireField).toBeUndefined();
  });

  it('③ 每次返回新数组（调用方改动不会污染共享常量）', () => {
    const first = officialFallbackThinkingMeta();
    first.levels?.push('__mutated__');
    expect(officialFallbackThinkingMeta().levels).toEqual([...OFFICIAL_LEVEL_VOCABULARY]);
    expect(MODEL_LEVEL_CODES).toHaveLength(6);
  });
});

describe('§78 元数据解析优先级：模型自带 > 用户连接目录 > 官方词汇表兜底', () => {
  it('① 模型选项自带 `thinking` ⇒ 原样用（官方那一条路优先）', () => {
    const meta = resolveThinkingMetaForModel({ value: 'apimart/gpt-6-luna', thinking: CONFIGURED });
    expect(meta).toBe(CONFIGURED);
  });

  it('② 连接目录里带 `thinking` ⇒ 用它，**不掺**兜底词汇表（`general/<id>` 与裸 id 两条都命中）', () => {
    configureAssistant(CONFIGURED);
    expect(configuredThinkingMetaForModel('general/assistant-model')).toEqual(CONFIGURED);
    expect(configuredThinkingMetaForModel('assistant-model')).toEqual(CONFIGURED);
    expect(resolveThinkingMetaForModel({ value: 'general/assistant-model' })?.levels)
      .toEqual(['LOW', 'MEDIUM', 'HIGH']);
    expect(resolveThinkingMetaForModel({ value: 'assistant-model' })?.levels)
      .toEqual(['LOW', 'MEDIUM', 'HIGH']);
  });

  it('② 内置连接勾选的模型（`<provider>/<上游 id>`）也读得到目录里的 `thinking`', () => {
    useAppStore.setState((state) => ({
      config: {
        ...state.config,
        providers: {
          ...state.config.providers,
          apimart: {
            name: 'APIMart',
            apiKey: 'k',
            baseUrl: 'https://api.apimart.ai/v1',
            selectedModels: [{ id: 'gpt-6-luna', thinking: CONFIGURED }],
          } as never,
        },
      },
    }));
    expect(configuredThinkingMetaForModel('apimart/gpt-6-luna')).toEqual(CONFIGURED);
  });

  it('③ 都没有 ⇒ 兜底（官方在此处 `return null`；MTV 返回官方词汇表）', () => {
    configureAssistant();
    expect(configuredThinkingMetaForModel('assistant-model')).toBeUndefined();
    const meta = resolveThinkingMetaForModel({ value: 'assistant-model' });
    expect(meta?.levels).toEqual([...OFFICIAL_LEVEL_VOCABULARY]);
    expect(meta?.default).toBeUndefined();
  });

  it('③ 入参为 null/undefined ⇒ 仍然 undefined（不凭空造控件）', () => {
    expect(resolveThinkingMetaForModel(null)).toBeUndefined();
    expect(resolveThinkingMetaForModel(undefined)).toBeUndefined();
  });

  it('③ 模型自带空的 `thinking: {}` ⇒ 按官方判据走（不兜底、不覆盖用户声明）', () => {
    const empty: ModelThinkingMeta = {};
    expect(resolveThinkingMetaForModel({ value: 'x/y', thinking: empty })).toBe(empty);
  });
});

describe('§78 写入链路（官方 store 读取点 + 请求字段落成）', () => {
  it('① 提交时读 `chatModelThinkingSettings[modelId]`；Auto / 没设过 ⇒ 不发该字段', () => {
    expect(selectedThinkingSetting('auto')).toBeUndefined();
    expect(selectedThinkingSetting('apimart/gpt-6-luna')).toBeUndefined();
    /* 官方 `ir ? {thinking: ir} : {}` 同语义：没动过控件 ⇒ 一个字节都不多发 */
    expect(thinkingBodyParams('apimart/gpt-6-luna', officialFallbackThinkingMeta())).toEqual({});
  });

  it('② 选档 ⇒ 只写**该模型**的条目（per-model，不继承）', () => {
    useAppStore.getState().setChatModelThinkingSettings('apimart/a', { enabled: true, level: 'max' });
    expect(useAppStore.getState().chatModelThinkingSettings).toEqual({
      'apimart/a': { enabled: true, level: 'max' },
    });
    expect(selectedThinkingSetting('apimart/b')).toBeUndefined();
  });

  it('③ 落成请求字段：兜底词汇表档位 ⇒ `thinking_level`（官方默认字段名）大写', () => {
    useAppStore.getState().setChatModelThinkingSettings('apimart/a', { enabled: true, level: 'max' });
    expect(thinkingBodyParams('apimart/a', officialFallbackThinkingMeta())).toEqual({
      thinking_level: 'MAX',
    });
  });

  it('④ 关闭哨兵 ⇒ `{enabled:false}` ⇒ 落成官方 `La.OFF`', () => {
    const slider = { enabled: false, level: 'max' };
    expect(slider.enabled).toBe(false);
    useAppStore.getState().setChatModelThinkingSettings('apimart/a', { enabled: false, level: 'max' });
    expect(selectedThinkingSetting('apimart/a')).toEqual({ enabled: false, level: 'max' });
    expect(thinkingBodyParams('apimart/a', officialFallbackThinkingMeta())).toEqual({
      thinking_level: 'OFF',
    });
  });

  it('⑤ 连接目录自带 `wireField` / `wireCase` ⇒ 按目录走（`reasoning_effort` + 小写）', () => {
    configureAssistant(CONFIGURED);
    useAppStore.getState().setChatModelThinkingSettings('assistant-model', { enabled: true, level: 'medium' });
    expect(thinkingBodyParams('assistant-model', CONFIGURED)).toEqual({ reasoning_effort: 'medium' });
  });
});

describe('§78 真请求体落成（`streamAssistantReply` → `extraBody` → HTTP body）', () => {
  it('① 动过控件 ⇒ 请求体里真的出现该字段', async () => {
    configureAssistant();
    useAppStore.getState().setChatModelThinkingSettings('assistant-model', { enabled: true, level: 'max' });
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(
      'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}\n\n',
    ));
    vi.stubGlobal('fetch', fetchMock);

    await streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent: vi.fn() });

    const body = requestBody(fetchMock);
    expect(body.thinking_level).toBe('MAX');
  });

  it('② 选关闭哨兵 ⇒ 请求体落成 `OFF`', async () => {
    configureAssistant();
    useAppStore.getState().setChatModelThinkingSettings('assistant-model', { enabled: false, level: 'high' });
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(
      'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}\n\n',
    ));
    vi.stubGlobal('fetch', fetchMock);

    await streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent: vi.fn() });

    expect(requestBody(fetchMock).thinking_level).toBe('OFF');
  });

  it('③ 没动过控件 ⇒ 请求体**逐字不含**该字段（与改动前一致）', async () => {
    configureAssistant();
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(
      'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}\n\n',
    ));
    vi.stubGlobal('fetch', fetchMock);

    await streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent: vi.fn() });

    const body = requestBody(fetchMock);
    expect('thinking_level' in body).toBe(false);
    expect('reasoning_effort' in body).toBe(false);
  });

  it('④ 连接目录声明了 `wireField` ⇒ 请求体用目录给的字段名，而不是默认字段', async () => {
    configureAssistant(CONFIGURED);
    useAppStore.getState().setChatModelThinkingSettings('assistant-model', { enabled: true, level: 'HIGH' });
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(
      'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}\n\n',
    ));
    vi.stubGlobal('fetch', fetchMock);

    await streamAssistantReply({ systemPrompt: '', userMessage: '你好', onEvent: vi.fn() });

    const body = requestBody(fetchMock);
    expect(body.reasoning_effort).toBe('high');
    expect('thinking_level' in body).toBe(false);
  });
});
