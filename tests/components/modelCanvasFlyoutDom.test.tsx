// @vitest-environment jsdom
/**
 * 画布「选择模型」说明卡 —— **土豆模型（官方目录查不到）也必须出卡** 的真实 DOM 回归。
 *
 * ## 用户实测的两个问题
 * ① 悬停土豆 provider 的模型（`general/<配置 id>`，上游 id 形如 `gemini-nano-banana-2.1`）
 *    **什么都不弹**；
 * ② 用户点名「Nano Banana 2 / Nano Banana 2.1 的说明卡呢？」。
 *
 * ## 根因（已修）
 * 旧闸门 `hasFramiaModelInfo(model)` 只认 Framia 目录（模型名/别名），而土豆的上游 id
 * 与 Framia 的别名表一个都对不上 ⇒ `CanvasModelFlyout` 返回 `null` ⇒ 面板不挂载。
 * 现在 `buildModelInfoCard` 走**别名链**（`general/<id>` → `modelId` / `name` / 官方 id），
 * 命中官方目录 ⇒ 完整卡；命中不到 ⇒ **最小卡 + 「官方目录未收录」脚注**，永不留空。
 *
 * 验证分级：(b) jsdom 真 DOM。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { ModelOption } from '../../src/types';
import CanvasModelFlyout from '../../src/components/nodes/shared/CanvasModelFlyout';

/** 土豆连接（自定义 OpenAI 兼容连接，`providerConfigId` = store 里的连接 key）。 */
const TUDOU = 'provider-custom-tudou';

function generalModel(id: string, modelId: string, name: string) {
  return {
    id,
    providerConfigId: TUDOU,
    modelId,
    name,
    category: 'image' as const,
    inputModalities: ['text' as const, 'image' as const],
    description: '',
  };
}

function option(id: string, label: string): ModelOption {
  return {
    value: `general/${id}`,
    provider: 'general',
    label,
    description: '',
    nodeTypes: ['ai-image'],
    connectionId: TUDOU,
    connectionName: '土豆',
  };
}

function seed(generalModels: ReturnType<typeof generalModel>[]) {
  const state = useAppStore.getState();
  useAppStore.setState({
    config: {
      ...state.config,
      generalModels,
      providers: {
        ...state.config.providers,
        [TUDOU]: {
          name: '土豆',
          catalogId: 'custom-openai',
          baseUrl: 'https://api.ai-tudou.net/v1',
          apiKey: 'sk-test',
        },
      },
    },
  } as never);
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('土豆模型的说明卡', () => {
  it('官方目录查不到 ⇒ 仍然出**最小卡**（模型名 / 连接 / 类型）并注明「官方目录未收录」', () => {
    seed([generalModel('gm-private', 'acme-private-image-v9', 'Acme Private Image')]);
    const { container } = render(
      <CanvasModelFlyout
        model={option('gm-private', 'Acme Private Image')}
        info={{ displayName: 'Acme Private Image', description: null, family: 'image' }}
      />,
    );
    /* 标题 = 展示名（与下拉行同源） */
    expect(container.querySelector('h4')?.textContent).toBe('Acme Private Image');
    /* 最小卡必须有的三样：类型 / 连接 */
    expect(container.textContent).toContain('类型');
    expect(container.textContent).toContain('图片');
    expect(container.textContent).toContain('连接');
    expect(container.textContent).toContain('土豆');
    /* 脚注：官方目录未收录（用户口径：宁可写明，也不要空白/编造） */
    const note = container.querySelector('[data-model-flyout-note]');
    expect(note).toBeTruthy();
    expect(note?.getAttribute('data-model-flyout-note')).toBe('official-catalog-missing');
    expect(note?.textContent).toContain('官方目录未收录');
    /* 没有任何官方字段被编出来：没有参数行、没有档位条 */
    expect(container.querySelector('[data-model-flyout-params]')).toBeNull();
    expect(container.querySelectorAll('meter')).toHaveLength(0);
  });

  it('别名链命中官方身份（`gemini-nano-banana-2.1` ↔ `google/nano-banana-2-1`）⇒ 完整卡', () => {
    seed([generalModel('gm-nb21', 'gemini-nano-banana-2.1', 'Nano Banana 2.1')]);
    const { container } = render(
      <CanvasModelFlyout
        model={option('gm-nb21', 'Nano Banana 2.1')}
        info={{ displayName: 'Nano Banana 2.1', description: null, family: 'image' }}
      />,
    );
    expect(container.querySelector('h4')?.textContent).toBe('Nano Banana 2.1');
    /* 官方身份（canonical Registry）里的厂商 */
    expect(container.textContent).toContain('厂商');
    expect(container.textContent).toContain('Google');
    /* Framia 卡片的速度/质量/成本三行（Nano Banana 2.1：4 / 5 / Medium） */
    const meters = Array.from(container.querySelectorAll('meter')).map((m) => [
      m.getAttribute('aria-label'),
      m.getAttribute('value'),
    ]);
    expect(meters).toEqual([['速度', '4'], ['质量', '5']]);
    expect(container.textContent).toContain('成本');
    /* 不是「未收录」卡 */
    expect(container.querySelector('[data-model-flyout-note]')).toBeNull();
  });

  it('别名链只在官方能力表命中（`gpt-image-2-all` → `gpt-image-2`）⇒ 带官方参数行', () => {
    seed([generalModel('gm-g2a', 'gpt-image-2-all', 'GPT Image 2 All')]);
    const { container } = render(
      <CanvasModelFlyout
        model={option('gm-g2a', 'GPT Image 2 All')}
        info={{ displayName: 'GPT Image 2 All', description: null, family: 'image' }}
      />,
    );
    const params = container.querySelector('[data-model-flyout-params]');
    expect(params).toBeTruthy();
    expect(params?.textContent).toContain('比例');
    expect(params?.textContent).toContain('画质');
    /* 解析到哪一条官方条目要能在卡上看到（`官方条目` 事实行） */
    expect(container.textContent).toContain('gpt-image-2');
  });
});
