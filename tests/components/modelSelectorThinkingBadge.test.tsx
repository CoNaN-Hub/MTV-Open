/**
 * 官方「模型思考徽标」(`bq`) 落地测试。
 *
 * 逐字取证（`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`）：
 *   · `bq` 定义 @56177：`!o || !e.thinking?.levels?.length ? null : o.enabled ? (o.level ? levels.<l> : null)
 *     : t("chatAdapter.modelOptions.thinkingOff","Thinking off") || "Thinking off"`
 *   · 官方 zh 字典 @4218048：`"thinkingOff":"思考关闭"`；`levels` @4218020 邻域：`低/中/高/极高/极高/最高`
 *   · 列表行 span class @80054：`shrink-0 text-[11px] leading-4 text-text-text-secondary/55`
 *   · 列表行的 summary 被官方 `dye` 闸门包住（调用处 @86944：`we=dye(fe,ke)?bq(fe,ke,L):null`）
 *     ⇒ `enabled===false` 时**行上不渲染任何徽标**；「思考关闭」只在触发器上出现（§82.8 裁决）
 *   · 触发器 `H` @91841：`bq(B, chatModelThinkingSettings[B.id], t)`，span class @~95420：
 *     `ml-1 shrink-0 border-l border-border/60 pl-1.5 text-[11px] leading-4 text-text-text-secondary`
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelGroup, ModelOption } from '../../src/types';

interface Element { props: Record<string, unknown> & { children?: unknown } }
const driver = vi.hoisted(() => ({
  states: [] as unknown[], stateIndex: 0, effectIndex: 0,
  effects: [] as Array<{ deps: readonly unknown[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>,
  config: { providers: {}, generalModels: [] },
  thinkingSettings: {} as Record<string, { enabled: boolean; level?: string }>,
  locale: 'zh-CN',
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
const storeState = () => ({
  config: driver.config,
  chatModelThinkingSettings: driver.thinkingSettings,
  showToast: vi.fn(),
});
vi.mock('../../src/store/useAppStore', () => ({ useAppStore: Object.assign(
  (select: (state: unknown) => unknown) => select(storeState()),
  { getState: () => storeState() },
) }));
vi.mock('../../src/i18n', () => ({
  useT: () => (text: string) => text,
  getLocale: () => driver.locale,
}));
vi.mock('../../src/services/comfyServers', () => ({
  probeComfyServer: vi.fn(), comfyBaseUrlFor: () => '', DEFAULT_COMFY_URL: 'http://127.0.0.1:8188',
}));
vi.mock('../../src/components/nodes/shared/defaultModels', () => ({
  defaultModelGroups: [], getConfiguredModelGroups: () => [], getGeneralModelGroups: () => [],
}));
vi.mock('../../src/components/shared/ProviderBadge', () => ({ default: 'badge' }));
import ModelSelector from '../../src/components/nodes/shared/ModelSelector';
import {
  MODEL_ROW_SUMMARY_CLASS,
  MODEL_TRIGGER_SUMMARY_CLASS,
  modelRowThinkingSummary,
  modelThinkingSummary,
  thinkingOffText,
} from '../../src/services/chat/thinkingBadge';
import { getModelPickerText } from '../../src/services/chat/modelPickerStrings';

const OFF = '思考关闭';

function all(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(all);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const element = tree as Element;
  return [element, ...all(element.props.children)];
}
function click(element: Element) {
  (element.props.onClick as (event: unknown) => void)({ stopPropagation: vi.fn() });
}
function makeModel(value: string, extra: Partial<ModelOption> = {}): ModelOption {
  return { value, provider: 'p', label: value, nodeTypes: ['ai-text'], ...extra };
}
function makeGroup(models: ModelOption[]): ModelGroup {
  return { id: 'grp', name: 'G', description: '', models };
}
function render(groups: ModelGroup[], extra: Record<string, unknown> = {}) {
  driver.stateIndex = 0;
  driver.effectIndex = 0;
  const tree = ModelSelector({
    nodeType: 'ai-text',
    configuredGroupsOverride: groups,
    onSelect: vi.fn(),
    agentStyle: true,
    autoSelected: false,
    onSelectAuto: undefined,
    ...extra,
  } as never);
  driver.pending.splice(0).forEach((effect) => effect());
  return all(tree);
}
/** 点开触发器 ⇒ 再渲染一次拿到下拉里的行。 */
function openRows(groups: ModelGroup[], extra: Record<string, unknown> = {}) {
  click(render(groups, extra).find((element) => String(element.props.className).startsWith('model-selector-trigger'))!);
  return render(groups, extra);
}
/**
 * 注入了 `renderTrigger` 时没有默认触发钮 ⇒ 用官方 `Ae` 的 `toggle` 打开，
 * 并在同一次渲染里抓 `secondary`（官方 `H`）。
 */
function openRowsWithTrigger(groups: ModelGroup[], captured: { secondary?: string | null }) {
  let toggle!: () => void;
  const extra = {
    selectedModel: 'm1',
    renderTrigger: (api: { secondary: string | null; toggle: () => void }) => {
      captured.secondary = api.secondary;
      toggle = api.toggle;
      return null;
    },
  };
  render(groups, extra);
  toggle();
  return render(groups, extra);
}
/** 所有 class 恰好等于官方行内徽标类的 span。 */
function rowBadges(elements: Element[]) {
  return elements.filter((element) => element.props.className === MODEL_ROW_SUMMARY_CLASS);
}
function texts(elements: Element[]) {
  return rowBadges(elements).map((element) => element.props.children);
}

beforeEach(() => {
  driver.states = []; driver.effects = []; driver.pending = [];
  driver.config = { providers: {}, generalModels: [] };
  driver.thinkingSettings = {};
  driver.locale = 'zh-CN';
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn(), matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  driver.effects.forEach((effect) => effect.cleanup?.());
});

describe('官方 thinkingOff 文案表', () => {
  it('zh 原文 = 思考关闭（官方 zh 字典 4218048 逐字）', () => {
    expect(thinkingOffText('zh-CN')).toBe('思考关闭');
    expect(getModelPickerText('thinkingOff', 'zh-CN')).toBe('思考关闭');
    /* 其余三语同样取自官方包（en 3546490 / ja 3946726 / ko 4083802） */
    expect(thinkingOffText('en-US')).toBe('Thinking off');
    expect(thinkingOffText('ja-JP')).toBe('思考オフ');
    expect(thinkingOffText('ko-KR')).toBe('사고 끔');
  });
});

describe('官方 dye 闸门：关闭态 ⇒ 行上无徽标（触发器仍有「思考关闭」）', () => {
  it('该模型 thinking 关闭 ⇒ 行上不渲染任何徽标，触发器仍拿到「思考关闭」', () => {
    driver.thinkingSettings = { m1: { enabled: false, level: 'high' } };
    const captured: { secondary?: string | null } = {};
    const rows = openRowsWithTrigger([makeGroup([
      makeModel('m1', { thinking: { levels: ['low', 'high'] } }),
      makeModel('m2', { thinking: { levels: ['low', 'high'] } }),
    ])], captured);
    /* 官方 `dye`（`SR(model,setting)?.enabled ? levels.length>0 : false`）在 enabled===false 时恒 false
       ⇒ 行上 `dye ? bq : null` = null ⇒ 不渲染。 */
    expect(texts(rows)).not.toContain(OFF);
    /* m1 关闭 ⇒ 无徽标；m2 没有 store 覆盖 ⇒ 默认档（开）⇒ 「低」 */
    expect(texts(rows)).toEqual(['低']);
    /* 官方 `Ae` 的 `H`（无闸门）⇒ 关闭态在触发器上照旧显示「思考关闭」 */
    expect(captured.secondary).toBe(OFF);
  });

  it('pure: 关闭态 ⇒ modelRowThinkingSummary 为 null，modelThinkingSummary 为「思考关闭」', () => {
    const model = makeModel('m1', { thinking: { levels: ['low', 'high'] } });
    expect(modelRowThinkingSummary(model, { enabled: false, level: 'high' }, 'zh-CN')).toBeNull();
    expect(modelThinkingSummary(model, { enabled: false, level: 'high' }, 'zh-CN')).toBe(OFF);
    /* 开启态 ⇒ 两边都是档位标签（官方 `yq`） */
    expect(modelRowThinkingSummary(model, { enabled: true, level: 'high' }, 'zh-CN')).toBe('高');
    expect(modelThinkingSummary(model, { enabled: true, level: 'high' }, 'zh-CN')).toBe('高');
  });

  it('触发器上的官方 H 也拿到同一文案（ChatModelChip 的 secondary 槽）', () => {
    driver.thinkingSettings = { m1: { enabled: false, level: 'high' } };
    const captured: { secondary?: string | null } = {};
    openRowsWithTrigger([makeGroup([makeModel('m1', { thinking: { levels: ['low', 'high'] } })])], captured);
    expect(captured.secondary).toBe(OFF);
  });
});

describe('官方 bq：档位标签（开启态）', () => {
  it('行上：开着思考 ⇒ 显示档位标签（zh「高」）', () => {
    driver.thinkingSettings = { m1: { enabled: true, level: 'high' } };
    const rows = openRows([makeGroup([makeModel('m1', { thinking: { levels: ['low', 'high'] } })])]);
    expect(texts(rows)).toEqual(['高']);
  });

  it('模型没有 thinking.levels ⇒ 整颗徽标不渲染（官方 `!e.thinking?.levels?.length ⇒ null`）', () => {
    driver.thinkingSettings = { m1: { enabled: false, level: 'high' } };
    const rows = openRows([makeGroup([
      makeModel('m1', { thinking: { levels: [] } }),
      makeModel('m2', { thinking: undefined }),
      makeModel('m3', { thinking: { levels: ['low'] } }),
    ])]);
    /* m1 空档位 ⇒ null；m2 无元数据 ⇒ 兜底元数据、但 store 里没有它的条目 ⇒ 默认档「低」；
       m3 有档位且没有 store 覆盖 ⇒ 默认档「低」。 */
    expect(texts(rows)).toEqual(['低', '低']);
    expect(texts(rows)).not.toContain(OFF);
  });

  it('没有 store 思考设置时，关闭态只由 store 决定 ⇒ 不误报关闭', () => {
    /* 触发器口径（官方 `bq`，无闸门） */
    expect(modelThinkingSummary(makeModel('m1', { thinking: { levels: ['low'] } }), undefined, 'zh-CN')).toBe('低');
    expect(modelThinkingSummary(makeModel('m1', { thinking: { levels: ['low'] } }), { enabled: false }, 'zh-CN')).toBe(OFF);
    expect(modelThinkingSummary(makeModel('m1', { thinking: { levels: [] } }), { enabled: false }, 'zh-CN')).toBeNull();
    /* 行口径（官方 `dye ? bq : null`）—— 关闭态与无档位都 ⇒ null */
    expect(modelRowThinkingSummary(makeModel('m1', { thinking: { levels: ['low'] } }), { enabled: false }, 'zh-CN')).toBeNull();
    expect(modelRowThinkingSummary(makeModel('m1', { thinking: { levels: [] } }), { enabled: true }, 'zh-CN')).toBeNull();
  });

  it('画布节点那侧的下拉（官方 `Sme` 无 summary 槽）不渲染', () => {
    driver.thinkingSettings = { m1: { enabled: false, level: 'high' } };
    const rows = openRows([makeGroup([makeModel('m1', { thinking: { levels: ['low', 'high'] } })])], { agentStyle: false });
    expect(rowBadges(rows)).toHaveLength(0);
  });
});

describe('官方 class 逐字', () => {
  it('行内徽标 class = 官方 lbe @80054 逐字（开启态才有徽标）', () => {
    driver.thinkingSettings = { m1: { enabled: true, level: 'high' } };
    const rows = openRows([makeGroup([makeModel('m1', { thinking: { levels: ['low', 'high'] } })])]);
    expect(MODEL_ROW_SUMMARY_CLASS).toBe('shrink-0 text-[11px] leading-4 text-text-text-secondary/55');
    expect(rowBadges(rows)).toHaveLength(1);
    expect(rowBadges(rows)[0].props.children).toBe('高');
    expect(rowBadges(rows)[0].props.className).toBe('shrink-0 text-[11px] leading-4 text-text-text-secondary/55');
  });

  it('触发器徽标 class = 官方 Ae @~95420 逐字（ChatModelChip 的 secondary 槽）', () => {
    expect(MODEL_TRIGGER_SUMMARY_CLASS)
      .toBe('ml-1 shrink-0 border-l border-border/60 pl-1.5 text-[11px] leading-4 text-text-text-secondary');
  });
});
