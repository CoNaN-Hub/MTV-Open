/**
 * 节点模型下拉的**空态**。
 *
 * 事故形状（本 bug 的用户现象）：候选一条都没有时，下拉渲染 **0 行**
 * （`ModelSelector` 只有触发器上的「选择模型」+ 一个打不开内容的下拉）
 * ⇒ 用户分不清「这条连接没有可用模型」和「模型被删了」。
 *
 * 这里钉两件事：
 *   ① 空候选 ⇒ 出现**可操作**提示（复用既有词条 `暂无可用模型，请先在设置中完成模型配置。`，
 *      四语言已落库，不新造文案）；
 *   ② 有候选（土豆那类**只能走 `generalModels`** 的连接）⇒ 照常列出、**不出**提示。
 *      镜像是怎么来的见 `tests/store/config.test.ts` 的「连接自有模型清单」。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeneralModelConfig } from '../../src/types';

interface Element { props: Record<string, unknown> & { children?: unknown } }

const driver = vi.hoisted(() => ({
  states: [] as unknown[], stateIndex: 0, effectIndex: 0,
  effects: [] as Array<{ deps: readonly unknown[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>,
  config: { providers: {}, generalModels: [] } as {
    providers: Record<string, unknown>;
    generalModels: GeneralModelConfig[];
  },
}));

vi.mock('react', async () => ({
  ...await vi.importActual<typeof import('react')>('react'),
  useMemo: <T,>(fn: () => T) => fn(),
  useCallback: <T,>(fn: T) => fn,
  useRef: <T,>(initial: T) => ({ current: initial }),
  useLayoutEffect: () => {},
  useState: <T,>(initial: T | (() => T)) => {
    const index = driver.stateIndex++;
    if (!(index in driver.states)) driver.states[index] = typeof initial === 'function' ? (initial as () => T)() : initial;
    return [driver.states[index], (next: T | ((value: T) => T)) => {
      driver.states[index] = typeof next === 'function' ? (next as (value: T) => T)(driver.states[index] as T) : next;
    }];
  },
  useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => {
    const index = driver.effectIndex++;
    const previous = driver.effects[index];
    if (previous && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
    driver.pending.push(() => {
      previous?.cleanup?.();
      driver.effects[index] = { deps, cleanup: effect() ?? undefined };
    });
  },
}));

const storeState = () => ({ config: driver.config, chatModelThinkingSettings: {}, showToast: vi.fn() });
vi.mock('../../src/store/useAppStore', () => ({ useAppStore: Object.assign(
  (select: (state: unknown) => unknown) => select(storeState()),
  { getState: () => storeState() },
) }));
vi.mock('../../src/i18n', () => ({
  useT: () => (text: string) => text,
  getLocale: () => 'zh-CN',
}));
vi.mock('../../src/services/comfyServers', () => ({
  probeComfyServer: vi.fn(async () => false),
  comfyBaseUrlFor: () => '',
  DEFAULT_COMFY_URL: 'http://127.0.0.1:8188',
}));
vi.mock('../../src/components/shared/ProviderBadge', () => ({ default: 'badge' }));

import ModelSelector from '../../src/components/nodes/shared/ModelSelector';

function all(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(all);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const element = tree as Element;
  return [element, ...all(element.props.children)];
}
function click(element: Element) {
  (element.props.onClick as (event: unknown) => void)({ stopPropagation: vi.fn() });
}
function render(extra: Record<string, unknown> = {}) {
  driver.stateIndex = 0;
  driver.effectIndex = 0;
  const tree = ModelSelector({ nodeType: 'ai-image', onSelect: vi.fn(), ...extra } as never);
  driver.pending.splice(0).forEach((effect) => effect());
  return all(tree);
}
/** 点开触发器 ⇒ 再渲染一次拿下拉内容。 */
function openDropdown(extra: Record<string, unknown> = {}) {
  click(render(extra).find((element) => String(element.props.className).startsWith('model-selector-trigger'))!);
  return render(extra);
}
function modelRows(elements: Element[]) {
  return elements.filter((element) => String(element.props.className).startsWith('model-item model-item-model'));
}
function emptyHints(elements: Element[]) {
  return elements.filter((element) => element.props['data-model-empty-hint'] !== undefined);
}
function trigger(elements: Element[]) {
  return elements.find((element) => String(element.props.className).startsWith('model-selector-trigger'))!;
}
function iconSlots(elements: Element[]) {
  return elements.filter((element) => String(element.props.className) === 'model-selector-icon');
}
/** 土豆连接：四类都有，镜像进 `generalModels` 的那份与本连接一致。 */
function tudouConfig(): typeof driver.config {
  const generalModels: GeneralModelConfig[] = [
    { id: 'provider-tudou-1', name: 'GPT-5.5', modelId: 'gpt-5.5', category: 'text', providerConfigId: 'tudou' },
    { id: 'provider-tudou-2', name: 'GPT Image 2.5', modelId: 'gpt-image-2.5', category: 'image', providerConfigId: 'tudou' },
    { id: 'provider-tudou-3', name: 'Seedance 2.5', modelId: 'seedance-2.5', category: 'video', providerConfigId: 'tudou' },
    { id: 'provider-tudou-4', name: 'Suno v5', modelId: 'suno-v5', category: 'audio', providerConfigId: 'tudou' },
  ];
  return {
    providers: {
      tudou: {
        name: '土豆',
        apiKey: 'placeholder-key-not-real',
        catalogId: 'tudou',
        baseUrl: 'https://api.ai-tudou.net/v1',
        visibleModelCategories: ['text', 'image', 'video', 'audio'],
        selectedModels: [
          { id: 'gpt-5.5', name: 'GPT-5.5', category: 'text', provider: 'tudou' },
          { id: 'gpt-image-2.5', name: 'GPT Image 2.5', category: 'image', provider: 'tudou' },
          { id: 'seedance-2.5', name: 'Seedance 2.5', category: 'video', provider: 'tudou' },
          { id: 'suno-v5', name: 'Suno v5', category: 'audio', provider: 'tudou' },
        ],
      },
    },
    generalModels,
  };
}

describe('节点模型下拉 —— 空态提示', () => {
  beforeEach(() => {
    driver.states = []; driver.effects = []; driver.pending = [];
    driver.config = { providers: {}, generalModels: [] };
    vi.stubGlobal('window', {
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => {
    driver.effects.forEach((effect) => effect.cleanup?.());
  });

  it('候选一条都没有 ⇒ 出可操作提示（不再是一个打不开的空下拉）', () => {
    const elements = openDropdown({ configuredGroupsOverride: [] });

    expect(modelRows(elements)).toHaveLength(0);
    expect(emptyHints(elements)).toHaveLength(1);
    /* 词条复用既有（`AgentApprovalCard` 的空态），不是本轮新造 */
    expect(emptyHints(elements)[0].props.children).toBe('暂无可用模型，请先在设置中完成模型配置。');
  });

  it('土豆连接（候选全在 generalModels 里）⇒ 四类都能选到，且**不出**空态提示', () => {
    driver.config = tudouConfig();

    const image = openDropdown();
    expect(modelRows(image)).toHaveLength(1);
    expect(emptyHints(image)).toHaveLength(0);

    /* 换节点类型 ⇒ 走同一份 generalModels 的对应分类 */
    for (const [nodeType, expected] of [
      ['ai-video', 'Seedance 2.5'],
      ['ai-audio', 'Suno v5'],
      ['ai-text', 'GPT-5.5'],
    ] as const) {
      driver.states = []; driver.effects = []; driver.pending = [];
      const elements = openDropdown({ nodeType });
      expect(modelRows(elements), nodeType).toHaveLength(1);
      expect(emptyHints(elements), nodeType).toHaveLength(0);
      expect(JSON.stringify(elements), nodeType).toContain(expected);
    }
  });

  it('有候选时提示不出现；模型被删（候选空）时提示回来 —— 两种状态可分', () => {
    /* 连接必须在 `config.providers` 里 —— `isProviderCategoryVisible` 对未知连接返回 false，
       所以「镜像里还挂着、连接却被删了」的条目本来就不会显示。 */
    driver.config = {
      providers: {
        'custom-a': { name: '自定义 A', apiKey: 'placeholder-key-not-real', catalogId: 'custom-openai' },
      },
      generalModels: [],
    };

    const withModels = openDropdown({ configuredGroupsOverride: [], generalModelsOverride: [
      { id: 'g1', name: 'GPT Image 2.5', modelId: 'gpt-image-2.5', category: 'image', providerConfigId: 'custom-a' },
    ] });
    expect(modelRows(withModels)).toHaveLength(1);
    expect(emptyHints(withModels)).toHaveLength(0);

    driver.states = []; driver.effects = []; driver.pending = [];
    const withoutModels = openDropdown({ configuredGroupsOverride: [], generalModelsOverride: [] });
    expect(modelRows(withoutModels)).toHaveLength(0);
    expect(emptyHints(withoutModels)).toHaveLength(1);
  });
});

describe('触发器图标槽 —— 按官方「有模型才渲染」', () => {
  /*
   * 官方（`vendor-packages-*.js` @1251728 视频模型触发器 / `vendor-pkg-canvas-*.js` @1241076 图片族，
   * 音频族同文件 @1649662）都是**图标跟着模型走**：没有模型就没有 `<img className="w-4 h-4">`，
   * 按钮只剩 `px-2` 的**左右对称**内边距。
   *
   * 事故：MTV 无条件渲染 16px 空槽 + `gap: 6px` ⇒ 未选模型时文案左边被顶出 30px、右边 8px，
   * 胶囊底色与文案不居中（用户："文案与底色都不对齐 好丑"）。
   * jsdom 量不到像素，这里钉的是**可测的 DOM 形状**：没有模型时不该有图标槽这个孩子。
   */
  beforeEach(() => {
    driver.states = []; driver.effects = []; driver.pending = [];
    driver.config = { providers: {}, generalModels: [] };
    vi.stubGlobal('window', {
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => {
    driver.effects.forEach((effect) => effect.cleanup?.());
  });

  it('未选模型 ⇒ **不渲染**图标槽（只有文案一个孩子 ⇒ 左右内边距对称）', () => {
    const elements = render({ configuredGroupsOverride: [] });

    expect(iconSlots(elements)).toHaveLength(0);
    const kids = trigger(elements).props.children as unknown[];
    /* 孩子只有那个文案 span（没有图标槽、没有 null 占位以外的东西） */
    const label = kids.filter((kid) => String((kid as Element)?.props?.className || '').startsWith('model-selector-label'));
    expect(label).toHaveLength(1);
  });

  it('选了模型 ⇒ 图标槽回来（官方「有模型才有图标」）', () => {
    driver.config = tudouConfig();

    const elements = render({ selectedModel: 'general/provider-tudou-2' });

    expect(iconSlots(elements)).toHaveLength(1);
  });
});
