/**
 * **裸官方 id → MTV 模型 value 的唯一解析**（用户 2026-10-15 裁决 A，附硬条件）。
 *
 * 缺陷背景（真机 + 进程内实测都复现过）：
 *   卡片的模型 chip 候选来自 `official-model-meta.json` 的**裸官方 id**
 *   （`listDirectoryModelIds`，真机取证 `["doubao-seedream-5.0-lite", …]`），
 *   而 MTV 自己的模型 value 一律带前缀（`apimart/…` / `general/…`）⇒
 *   用户在卡上选完模型 / `@model{<裸官方 id>}` 提及，走到执行期就是
 *   `Error: 未找到 @ 引用的媒体模型`（发送前被挡）。
 *
 * 纪律：**先精确、后后缀；唯一才认；歧义与不可用一律不认（保持原报错）**。
 * 本文件逐条钉住裁决里的 6 条硬条件。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captured } = vi.hoisted(() => ({ captured: [] as Array<Record<string, unknown>> }));

vi.mock('../../../src/services/ai/generateImage', () => ({
  generateImage: vi.fn(async (params: Record<string, unknown>) => {
    captured.push(params);
    throw new Error('CAPTURED_BEFORE_HTTP');
  }),
}));

import { useAppStore } from '../../../src/store/useAppStore';
import {
  findMediaModelOption,
  matchUniqueModelOptionByBareId,
  type MediaModelOption,
} from '../../../src/components/nodes/shared/defaultModels';
import { listDirectoryModelIds } from '../../../src/services/ai/modelParamCatalog';
import { runMediaGeneration } from '../../../src/services/ai/generationRuntime';

/** 一个「可用」的厂商连接（有 apiKey ⇒ 该组的模型才会进候选）。 */
function provider(name: string, extra: Record<string, unknown> = {}) {
  return { name, baseUrl: 'https://example.invalid', apiKey: 'test-only-key', ...extra };
}

function seedConfig(providers: Record<string, unknown>) {
  useAppStore.setState({
    currentProjectId: 'p-bare',
    projects: [{ id: 'p-bare', name: 'Bare', createdAt: 1, updatedAt: 1, settings: {} }],
    customStyles: [],
    config: { ...useAppStore.getState().config, providers: providers as never },
  });
}

beforeEach(() => {
  captured.length = 0;
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('裸官方 id 解析（裁决 A）', () => {
  it('硬条件① 精确优先：带前缀的 value 仍按全等命中（行为不变）', () => {
    seedConfig({ apimart: provider('APIMart') });
    const config = useAppStore.getState().config;
    const option = findMediaModelOption('apimart/gpt-image-2.5-flare', [], config, []);
    expect(option?.value).toBe('apimart/gpt-image-2.5-flare');
  });

  it('硬条件② 唯一裸 id 可解析：`gpt-image-2.5-flare` → `apimart/gpt-image-2.5-flare`', () => {
    seedConfig({ apimart: provider('APIMart') });
    const config = useAppStore.getState().config;
    const bare = listDirectoryModelIds('image').find((id) => id === 'gpt-image-2.5-flare');
    expect(bare).toBeDefined();
    const option = findMediaModelOption(bare!, [], config, []);
    expect(option?.value).toBe('apimart/gpt-image-2.5-flare');
    expect(option?.mediaKind).toBe('image');
  });

  it('硬条件② 真发请求路径打通：裸 id 不再停在「未找到」，而是走到 generateImage', async () => {
    seedConfig({ apimart: provider('APIMart') });
    await expect(runMediaGeneration(
      { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', modelRef: 'gpt-image-2.5-flare' },
      'p-bare',
    )).rejects.toThrow('CAPTURED_BEFORE_HTTP');
    expect(captured).toHaveLength(1);
    /* 发出去的仍是 MTV 解析后的 value（= 上游真实调用路径），不是裸 id。 */
    expect(captured[0].model).toBe('apimart/gpt-image-2.5-flare');
  });

  it('硬条件③ 歧义必须报错：两条连接都提供同一官方 id ⇒ 不解析，保持原报错（反面用例）', async () => {
    /* 纯匹配器层面：两个候选 ⇒ `undefined`，绝不任选。 */
    const options = [
      { value: 'apimart/gpt-image-2.5-flare', mediaKind: 'image' },
      { value: 'ppio/gpt-image-2.5-flare', mediaKind: 'image' },
    ] as unknown as MediaModelOption[];
    expect(matchUniqueModelOptionByBareId('gpt-image-2.5-flare', options)).toBeUndefined();

    /* 端到端层面：让两个**已配置**的厂商分组都声明这个模型 id ⇒ 候选真的出现两条。 */
    seedConfig({
      apimart: provider('APIMart', { selectedModels: [{ id: 'gpt-image-2.5-flare', category: 'image' }] }),
      grsai: provider('GRSAI', { selectedModels: [{ id: 'gpt-image-2.5-flare', category: 'image' }] }),
    });
    const config = useAppStore.getState().config;
    const candidates = ['apimart/gpt-image-2.5-flare', 'grsai/gpt-image-2.5-flare']
      .map((value) => findMediaModelOption(value, [], config, [])?.value);
    // 两个带前缀的 ref 各自精确命中（说明两条连接都可用、候选确实有两条）
    expect(candidates).toEqual(['apimart/gpt-image-2.5-flare', 'grsai/gpt-image-2.5-flare']);
    expect(findMediaModelOption('gpt-image-2.5-flare', [], config, [])).toBeUndefined();
    await expect(runMediaGeneration(
      { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', modelRef: 'gpt-image-2.5-flare' },
      'p-bare',
    )).rejects.toThrow('未找到 @ 引用的媒体模型');
  });

  it('硬条件④ 只认可用连接：没有 apiKey 的厂商不参与匹配（沿用既有可用性判定）', async () => {
    seedConfig({ apimart: { name: 'APIMart', baseUrl: 'https://example.invalid' } });
    const config = useAppStore.getState().config;
    /* 精确匹配也一致：不可用 ⇒ 选项根本不进列表（`getConfiguredModelGroups` 的 apiKey 门）。 */
    expect(findMediaModelOption('apimart/gpt-image-2.5-flare', [], config, [])).toBeUndefined();
    expect(findMediaModelOption('gpt-image-2.5-flare', [], config, [])).toBeUndefined();
    await expect(runMediaGeneration(
      { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', modelRef: 'gpt-image-2.5-flare' },
      'p-bare',
    )).rejects.toThrow('未找到 @ 引用的媒体模型');
  });

  it('硬条件⑤ 其它命名空间不受影响：`general/…` 仍精确命中，且裸 id 不会去匹配它', () => {
    useAppStore.setState({
      currentProjectId: 'p-bare',
      projects: [{ id: 'p-bare', name: 'Bare', createdAt: 1, updatedAt: 1, settings: {} }],
      customStyles: [],
      config: {
        ...useAppStore.getState().config,
        providers: { audit: provider('Audit') } as never,
        generalModels: [{
          id: 'gpt-image-2.5-flare', name: '我的直连图', modelId: 'media-a',
          category: 'image', providerConfigId: 'audit',
        }] as never,
      },
    });
    const config = useAppStore.getState().config;
    const generalModels = config.generalModels ?? [];
    /* `general/<cfgId>` 照旧精确命中自己。 */
    expect(findMediaModelOption('general/gpt-image-2.5-flare', generalModels, config, [])?.value)
      .toBe('general/gpt-image-2.5-flare');
    /* 裸 id 也**先**命中那条 general 模型（精确归一形状），不会被后缀解析抢走。 */
    expect(findMediaModelOption('gpt-image-2.5-flare', generalModels, config, [])?.value)
      .toBe('general/gpt-image-2.5-flare');
    /* `runninghub/…` 这类带前缀的 ref 一律不参与后缀匹配。 */
    expect(matchUniqueModelOptionByBareId('runninghub/x', [
      { value: 'runninghub/x', mediaKind: 'video' },
    ] as unknown as MediaModelOption[])).toBeUndefined();
  });

  it('硬条件⑥ 不是模糊匹配：只认同 `/` 后的**全等**（不做包含/前缀/相似度）', () => {
    const options = [
      { value: 'apimart/gpt-image-2.5-flare', mediaKind: 'image' },
      { value: 'apimart/gpt-image-2.5-flare-extra', mediaKind: 'image' },
    ] as unknown as MediaModelOption[];
    expect(matchUniqueModelOptionByBareId('gpt-image-2.5-flare', options)?.value)
      .toBe('apimart/gpt-image-2.5-flare');
    expect(matchUniqueModelOptionByBareId('gpt-image', options)).toBeUndefined();
    expect(matchUniqueModelOptionByBareId('GPT-IMAGE-2.5-FLARE', options)?.value)
      .toBe('apimart/gpt-image-2.5-flare');
  });
});
