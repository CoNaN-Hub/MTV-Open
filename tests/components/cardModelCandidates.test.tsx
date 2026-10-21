// @vitest-environment jsdom
/**
 * 生成确认卡的**模型下拉候选来源** —— 用户 2026-10-15 口径（逐字）：
 *
 * > 「我是自定义的厂商 我后台接入什么厂商 你就显示什么厂商的 我接入两个 你就显示两个厂商的 
 * >   你懂我意思吗？」
 *
 * ⇒ **MTV 内置目录（`official-model-meta.json` / `listDirectoryModelIds`）不再是候选来源**，
 *   只降级为**展示元数据**（按 id 匹配取名称/图标/分类）。
 *   候选 = 用户已配置连接声明的模型（`general/<配置 id>` / `<provider>/<modelId>`），
 *   来源标注（`connectionId` / `connectionName` / `unavailable`）由连接级权益层既有函数算出后透传。
 *
 * ⚠️ 不发真实网络：fixture 形状照 `_r129-tudou-pricing.json`（与 `providerEntitlements.test.ts` /
 *    `modelCandidateAvailability.test.ts` **同源**，不另造），key 一律占位符。
 */
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ParamChip } from '../../src/components/chat/ConfirmationCardParts';
import {
  useImageVideoChipController,
  type ImageVideoChipControllerInput,
} from '../../src/components/chat/generationChipController';
import { useAppStore } from '../../src/store/useAppStore';
import type { GeneralModelConfig, ProviderModelSelection } from '../../src/types';
import {
  clearProviderEntitlements,
  parseNewApiEntitlements,
  recordProviderEntitlements,
} from '../../src/services/ai/providerEntitlements';

/** 与 `providerEntitlements.test.ts` 同源的实测形状：两条对 vip-9折 开放，glm-5.3 / seedance 没有。 */
const PRICING = {
  group_ratio: { default: 1, svip: 1, vip: 1, test: 2, 企业测试专线: 1.15, 秋风专用: 3 },
  usable_group: { default: '默认分组', vip: 'vip分组' },
  data: [
    { model_name: 'gpt-5.5', enable_groups: ['default', 'svip', 'vip', 'vip-9折'] },
    { model_name: 'gemini-nano-banana-2.1', enable_groups: ['default', 'svip', 'vip', 'vip-9折'] },
    { model_name: 'glm-5.3', enable_groups: ['vip', 'svip', 'default'] },
    { model_name: 'seedance-2.5', enable_groups: ['test', 'vip', 'default', 'svip'] },
  ],
};
/** 该 key 实测能用的两条（对 `vip-9折` 开放）。 */
const AVAILABLE = ['gpt-5.5', 'gemini-nano-banana-2.1'];

const CONNECTION_A = 'custom-a';
const CONNECTION_B = 'custom-b';

function generalModel(
  id: string,
  modelId: string,
  providerConfigId: string,
  category: GeneralModelConfig['category'] = 'image',
): GeneralModelConfig {
  return { id, name: modelId, modelId, category, providerConfigId };
}

function selection(id: string, category: ProviderModelSelection['category'] = 'image'): ProviderModelSelection {
  return { id, name: id, category, provider: 'custom-openai' };
}

function connection(name: string, catalogId = 'custom-openai') {
  return {
    name,
    apiKey: 'placeholder-key-not-real',
    catalogId,
    /* `undefined` = 从没拉过目录；`[]` = 拉到了但一条没勾 —— 两者在候选集合里都是 0 条。 */
    selectedModels: [] as ProviderModelSelection[],
  };
}

/** 播种 store（连接 + 该连接声明的模型）。 */
function seed(config: { providers: unknown; generalModels: unknown }) {
  useAppStore.setState({
    config: { ...useAppStore.getState().config, ...config } as never,
  });
}

/** 图片卡的控制器输入：**不传 `directoryModelIds`** ⇒ 走新默认（候选只来自连接）。 */
function renderImage(overrides: Partial<ImageVideoChipControllerInput> = {}) {
  const props: ImageVideoChipControllerInput = {
    requestKind: 'image',
    params: { prompt: 'a cat', times: 1 },
    presentFields: ['model', 'prompt', 'aspectRatio', 'imageSize', 'times'],
    paramControlsEditable: true,
    modelSelectionRequired: true,
    ...overrides,
  };
  return renderHook(() => useImageVideoChipController(props));
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  clearProviderEntitlements();
});

afterEach(() => {
  cleanup();
  clearProviderEntitlements();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('卡片模型候选 = 用户接入的连接（内置目录不再是候选来源）', () => {
  it('只配**一个**自定义连接 ⇒ 候选恰为该连接声明的模型；内置目录里的模型一条都不出现', () => {
    seed({
      providers: { [CONNECTION_A]: connection('土豆 · 生图组') } as never,
      generalModels: [generalModel('g1', 'gpt-image-2.5-flare', CONNECTION_A)],
    });

    const { result } = renderImage();
    const values = result.current.modelOptions?.map((option) => option.value) ?? [];

    /* 恰好一条，且就是那条连接声明的模型。 */
    expect(values).toEqual([`general/g1`]);
    /* 内置目录（`official-model-meta` 图片表）里的其它模型**一条都不出现**。 */
    for (const builtIn of ['midjourney-v7', 'reve-2.1', 'fal-recraft-v4', 'tapnow-image-turbo', 'doubao-seedream-4.5', 'gpt-image-2']) {
      expect(values).not.toContain(builtIn);
    }
    /* 来源标注（连接名/连接 id）必须带上 —— 用户要能看出「这条来自哪个厂商」。 */
    expect(result.current.modelOptions?.[0]).toMatchObject({
      connectionId: CONNECTION_A,
      connectionName: '土豆 · 生图组',
    });
  });

  it('配**两个**连接 ⇒ 候选为两者的并集，且每一项带**正确的** `connectionId`', () => {
    seed({
      providers: {
        [CONNECTION_A]: connection('土豆 · 生图组'),
        [CONNECTION_B]: connection('云雾 · 出图'),
      } as never,
      generalModels: [
        generalModel('a1', 'gpt-image-2.5-flare', CONNECTION_A),
        generalModel('b1', 'gemini-nano-banana-2.1', CONNECTION_B),
      ],
    });

    const { result } = renderImage();
    const options = result.current.modelOptions ?? [];
    expect(options.map((option) => option.value)).toEqual(['general/a1', 'general/b1']);
    expect(options.map((option) => option.connectionId)).toEqual([CONNECTION_A, CONNECTION_B]);
    expect(options.map((option) => option.connectionName)).toEqual(['土豆 · 生图组', '云雾 · 出图']);
  });

  it('某连接**没有**任何模型数据 ⇒ 该连接贡献 0 条（另一条连接照旧）', () => {
    seed({
      providers: {
        [CONNECTION_A]: connection('土豆 · 生图组'),
        [CONNECTION_B]: connection('空连接 · 没拉过目录'),
      } as never,
      /* 只给 A 声明模型；B 什么都不声明。 */
      generalModels: [generalModel('a1', 'gpt-image-2.5-flare', CONNECTION_A)],
    });

    const { result } = renderImage();
    const options = result.current.modelOptions ?? [];
    expect(options.map((option) => option.value)).toEqual(['general/a1']);
    expect(options.some((option) => option.connectionId === CONNECTION_B)).toBe(false);
    /* 有候选 ⇒ **不**出提示。 */
    expect(result.current.modelOptionsHint).toBeUndefined();
  });

  it('★ 全部连接都没数据 ⇒ 候选 0 条、**不出内置模型充数**，改为可操作提示（不渲染空下拉）', () => {
    seed({
      providers: {
        [CONNECTION_A]: connection('土豆 · 生图组'),
        [CONNECTION_B]: connection('云雾 · 出图'),
      } as never,
      generalModels: [],
    });

    const { result } = renderImage();
    const c = result.current;
    /* 空下拉的防线：候选为空 ⇒ `ParamChip` 降级为静态 chip（打不开菜单），不再是一个空菜单。 */
    expect(c.modelOptions).toEqual([]);
    /* **不许**用内置模型充数。 */
    expect(c.modelOptions).toEqual([]);
    /* 可操作提示：告诉用户去哪儿把模型拉出来（而不是空白）。 */
    expect(c.modelOptionsHint).toBeTruthy();
    expect(c.modelOptionsHint).toContain('API 连接');
    /* 「确认」被禁用，且理由就是那句提示（不是「先选模型」——此时没得选）。 */
    expect(c.confirmDisabled).toBe(true);
    expect(c.confirmDisabledReason).toBe(c.modelOptionsHint);
    expect(c.confirmDisabledReason).not.toBe('Select a model');
  });

  it('内置目录只贡献**展示名**：连接声明的模型用可读名，且候选 value 里不出现内置裸 id', () => {
    seed({
      providers: { [CONNECTION_A]: connection('土豆 · 生图组') } as never,
      generalModels: [generalModel('g1', 'gpt-image-2.5-flare', CONNECTION_A)],
    });

    const { result } = renderImage();
    const options = result.current.modelOptions ?? [];
    /* 候选的 value 是**可执行引用** `general/<配置 id>`，不是内置目录裸 id。 */
    expect(options.map((option) => option.value)).toEqual(['general/g1']);
    expect(options.map((option) => option.value)).not.toContain('gpt-image-2.5-flare');
    /* label 走展示名出口（可读名），绝不把 `general/...` 内部引用印到卡上。 */
    expect(options[0].label).toBeTruthy();
    expect(options[0].label).not.toContain('general/');
  });
});

describe('来源标注 = 连接级权益层既有判定（只透传，不另写一套）', () => {
  it('★ 清单在 ⇒ **只列清单内**：不在该连接 `/v1/models` 里的候选被排除（能调用才是事实）', () => {
    seed({
      providers: {
        [CONNECTION_A]: {
          ...connection('土豆 · 生图组'),
          catalogModels: AVAILABLE.map((id) => selection(id)),
        },
      } as never,
      generalModels: [generalModel('g1', 'gpt-imaginary-9', CONNECTION_A)],
    });

    const { result } = renderImage();
    /* `gpt-imaginary-9` 不在该连接权威清单里（`isCandidateUnavailable` = true）⇒ 不列。 */
    expect(result.current.modelOptions).toEqual([]);
    /* 一个都没剩 ⇒ 可操作提示照旧给（不渲染空下拉，也不塞内置模型充数），且**带上隐藏计数**。 */
    expect(result.current.modelOptionsHint).toBeTruthy();
    expect(result.current.modelOptionsHint).toContain('有 1 个模型');
    expect(result.current.modelOptionsHint).toContain('已隐藏');
  });

  it('★ 部分隐藏也**不许静默**：隐藏 2 条 ⇒ 提示出现且计数正确，可见候选照留', () => {
    seed({
      providers: {
        [CONNECTION_A]: {
          ...connection('土豆 · 生图组'),
          catalogModels: AVAILABLE.map((id) => selection(id)),
        },
      } as never,
      generalModels: [
        /* 在清单里 ⇒ 保留 */
        generalModel('g1', 'gemini-nano-banana-2.1', CONNECTION_A),
        /* 不在清单里 ⇒ 隐藏（`catalogModels` 过时的那一类） */
        generalModel('g2', 'gpt-imaginary-9', CONNECTION_A),
        generalModel('g3', 'another-unknown', CONNECTION_A),
      ],
    });

    const { result } = renderImage();
    const c = result.current;
    /* 可见候选 = 清单内的那条。 */
    expect(c.modelOptions?.map((option) => option.value)).toEqual(['general/g1']);
    /* 隐藏 2 条 ⇒ 提示必须出现，计数正确、文案可操作（指向「设置 → API 连接」重新拉取）。 */
    expect(c.modelOptionsHint).toBeTruthy();
    expect(c.modelOptionsHint).toContain('有 2 个模型');
    expect(c.modelOptionsHint).toContain('已隐藏');
    expect(c.modelOptionsHint).toContain('API 连接');
    /* 有可见候选 ⇒ 提示**不**顶替「未选模型」的理由链（那是另一回事）。 */
    expect(c.confirmDisabledReason).not.toBe(c.modelOptionsHint);
  });

  it('零隐藏 ⇒ **不出提示**（不吓人）', () => {
    seed({
      providers: {
        [CONNECTION_A]: {
          ...connection('土豆 · 生图组'),
          catalogModels: AVAILABLE.map((id) => selection(id)),
        },
      } as never,
      generalModels: [
        generalModel('g1', 'gemini-nano-banana-2.1', CONNECTION_A),
        generalModel('g2', 'gpt-5.5', CONNECTION_A),
      ],
    });

    const { result } = renderImage();
    expect(result.current.modelOptions?.map((option) => option.value))
      .toEqual(['general/g1', 'general/g2']);
    expect(result.current.modelOptionsHint).toBeUndefined();
  });

  it('在权威清单里的候选：列出且 `unavailable` 为 false（在清单里 = 能调用 = 事实）', () => {
    seed({
      providers: {
        [CONNECTION_A]: {
          ...connection('土豆 · 生图组'),
          catalogModels: AVAILABLE.map((id) => selection(id)),
        },
      } as never,
      generalModels: [
        generalModel('g1', 'gemini-nano-banana-2.1', CONNECTION_A),
        generalModel('g2', 'gpt-imaginary-9', CONNECTION_A),
      ],
    });

    const { result } = renderImage();
    const options = result.current.modelOptions ?? [];
    expect(options.map((option) => option.value)).toEqual(['general/g1']);
    expect(options[0]?.unavailable).toBe(false);
    expect(options[0]?.connectionId).toBe(CONNECTION_A);
  });

  it('价目表**只用于解释**、不用于判定能力：同刻权益数据在也只按 `/v1/models` 判', () => {
    recordProviderEntitlements(CONNECTION_A, parseNewApiEntitlements(PRICING)!, AVAILABLE);
    seed({
      providers: {
        [CONNECTION_A]: {
          ...connection('土豆 · 生图组'),
          catalogModels: AVAILABLE.map((id) => selection(id)),
        },
      } as never,
      generalModels: [
        generalModel('g1', 'gemini-nano-banana-2.1', CONNECTION_A),
        /* `glm-5.3` 在**价目表里**（对 `vip`/`svip`/`default` 开放）但**不在** `/v1/models` 里。
           若有人拿 `enable_groups` 当判据，它反而可能被判「能用」⇒ 必须仍然不出现。 */
        generalModel('g2', 'glm-5.3', CONNECTION_A),
      ],
    });

    const { result } = renderImage();
    const values = result.current.modelOptions?.map((option) => option.value) ?? [];
    /* 在权威清单里 ⇒ 留着，即便价目表 `enable_groups` 里没写当前分组也以 `/v1/models` 为准。 */
    expect(values).toContain('general/g1');
    /* 不在权威清单里 ⇒ 不列（口径 = `/v1/models`，不是价目表的 `enable_groups`）。 */
    expect(values).not.toContain('general/g2');
  });

  it('拿不到任何权益数据/清单 ⇒ 候选原样列出（退回现状，不阻断）', () => {
    seed({
      providers: { [CONNECTION_A]: connection('土豆 · 生图组') } as never,
      generalModels: [
        generalModel('g1', 'whatever-model', CONNECTION_A),
        generalModel('g2', 'another-unknown', CONNECTION_A),
      ],
    });

    const { result } = renderImage();
    expect(result.current.modelOptions?.map((option) => option.value))
      .toEqual(['general/g1', 'general/g2']);
    expect(result.current.modelOptions?.[0]?.unavailable).toBeUndefined();
  });
});

describe('界面上怎么区分「哪条来自哪个厂商」', () => {
  it('模型下拉每一行带 `data-model-connection*` 属性 + 厂商徽章（与节点侧 `ModelSelector` 同形）', async () => {
    render(
      <ParamChip
        menuVariant="model"
        value="Model"
        selectedValue=""
        editable
        options={[
          {
            value: 'general/a1',
            label: 'GPT Image 2.5 Flare',
            connectionId: CONNECTION_A,
            connectionName: '土豆 · 生图组',
          },
          {
            value: 'general/b1',
            label: 'Nano Banana 2.1',
            connectionId: CONNECTION_B,
            connectionName: '云雾 · 出图',
            unavailable: true,
          },
        ]}
      />,
    );

    fireEvent.pointerDown(screen.getByRole('button'));

    const rowA = (await screen.findByText('GPT Image 2.5 Flare')).closest('[data-model-connection]');
    expect(rowA?.getAttribute('data-model-connection')).toBe(CONNECTION_A);
    expect(rowA?.getAttribute('data-model-connection-name')).toBe('土豆 · 生图组');
    expect(rowA?.getAttribute('data-model-unavailable')).toBeNull();
    /* 厂商徽章：接了多条连接时靠它分辨来源。 */
    expect(rowA?.querySelector('[data-model-connection-badge]')?.textContent).toBe('土豆 · 生图组');

    const rowB = (await screen.findByText('Nano Banana 2.1')).closest('[data-model-connection]');
    expect(rowB?.getAttribute('data-model-connection')).toBe(CONNECTION_B);
    /* 不在该连接权威清单里 ⇒ 只**标注**（徽章 + 属性），不阻断（行仍在）。 */
    expect(rowB?.getAttribute('data-model-unavailable')).toBe('1');
    expect(rowB?.querySelector('[data-model-unavailable-badge]')?.textContent).toBe('不可用');
  });
});

