/**
 * P2 —— 候选「只列该 key 能用的模型」+ 标注「走哪条连接」。
 *
 * ⚠️ **MTV 增强**：官方读的是账号级 `isPayingCustomer`，
 *    官方侧**没有任何读 `enable_groups` / `usable_group` 的代码（NOT FOUND）**。
 *
 * ⚠️ 不发真实网络：这里只喂 fixture（形状照 `_r129-tudou-pricing.json`），key 用占位符。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getConfiguredModelGroups,
  getGeneralModelGroups,
  getMediaModelOptions,
} from '../../src/components/nodes/shared/defaultModels';
import type { AppConfig, GeneralModelConfig, ProviderModelSelection } from '../../src/types';
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

function selection(id: string, category: ProviderModelSelection['category']): ProviderModelSelection {
  return { id, name: id, category, provider: 'custom-edge' };
}

function generalModel(
  id: string,
  modelId: string,
  category: GeneralModelConfig['category'],
): GeneralModelConfig {
  return { id, name: modelId, modelId, category, providerConfigId: 'custom-edge' };
}

function configWith(patch: Partial<AppConfig['providers']['custom-edge']> = {}): AppConfig {
  return {
    theme: 'dark',
    providers: {
      'custom-edge': {
        name: '土豆 · 生图组',
        apiKey: 'placeholder-key-not-real',
        catalogId: 'custom-openai',
        selectedModels: [],
        ...patch,
      },
    },
  };
}

/** 造一份「连接持久化的权威清单」（= 上次 `/v1/models` 的结果）。 */
function catalogConfig(ids: readonly string[] = AVAILABLE): AppConfig {
  return configWith({ catalogModels: ids.map((id) => selection(id, 'image')) });
}

beforeEach(() => {
  clearProviderEntitlements();
});

afterEach(() => {
  clearProviderEntitlements();
});

describe('P2 · 自定义连接（`generalModels`）的候选', () => {
  it('没有任何权威清单 ⇒ **不裁剪**（退回现状，不阻断）', () => {
    const groups = getGeneralModelGroups(
      [generalModel('g1', 'glm-5.3', 'image')],
      configWith(),
      'ai-image',
    );
    /* 模型留着（行为与改动前一致），但连接标注已经带上 */
    expect(groups[0].models.map((model) => model.value)).toEqual(['general/g1']);
    expect(groups[0].models[0]).toMatchObject({
      connectionId: 'custom-edge',
      connectionName: '土豆 · 生图组',
    });
    /* 没有清单 ⇒ 不置位（不猜、不吓人） */
    expect(groups[0].models[0].unavailable).toBeUndefined();
  });

  it('只有持久化清单、**没有同刻证据** ⇒ 只标注「不可用」，**不删**', () => {
    const groups = getGeneralModelGroups(
      [generalModel('g1', 'glm-5.3', 'image'), generalModel('g2', 'gpt-5.5', 'image')],
      catalogConfig(),
      'ai-image',
    );
    const models = groups[0].models;
    /* 证据不足以「已证实挡掉」⇒ 两条都还在，只把 glm-5.3 标成不可用 */
    expect(models.map((model) => model.value)).toEqual(['general/g1', 'general/g2']);
    expect(models.find((model) => model.value === 'general/g1')?.unavailable).toBe(true);
    expect(models.find((model) => model.value === 'general/g2')?.unavailable).toBe(false);
  });

  it('证据齐全（同一次抓取的清单 + 分组矩阵）⇒ 已证实挡掉的被裁掉', () => {
    /* 缓存键 = **连接 key**（不是 `definition.id`）；`/v1/models` 与 `/api/pricing` 一次写入 */
    recordProviderEntitlements('custom-edge', parseNewApiEntitlements(PRICING)!, AVAILABLE);
    const groups = getGeneralModelGroups(
      [generalModel('g1', 'glm-5.3', 'image'), generalModel('g2', 'gpt-5.5', 'image')],
      catalogConfig(),
      'ai-image',
    );
    const models = groups[0].models;
    expect(models.map((model) => model.value)).toEqual(['general/g2']);
    expect(models[0].unavailable).toBe(false);
  });

  it('裁剪会把候选删光 ⇒ 退化成只标注（**永不清空**；空下拉是已知事故）', () => {
    recordProviderEntitlements('custom-edge', parseNewApiEntitlements(PRICING)!, AVAILABLE);
    const groups = getGeneralModelGroups(
      [generalModel('g1', 'glm-5.3', 'image'), generalModel('g3', 'seedance-2.5', 'image')],
      catalogConfig(),
      'ai-image',
    );
    const models = groups[0].models;
    expect(models).toHaveLength(2);
    expect(models.every((model) => model.unavailable)).toBe(true);
  });

  it('`getMediaModelOptions` 的自定义分支同样标注/裁剪，并带上连接名', () => {
    recordProviderEntitlements('custom-edge', parseNewApiEntitlements(PRICING)!, AVAILABLE);
    const options = getMediaModelOptions(
      [generalModel('g1', 'glm-5.3', 'image'), generalModel('g2', 'gpt-5.5', 'image')],
      catalogConfig(),
      [],
    );
    expect(options.map((option) => option.value)).toEqual(['general/g2']);
    expect(options[0]).toMatchObject({
      connectionId: 'custom-edge',
      connectionName: '土豆 · 生图组',
      mediaKind: 'image',
      unavailable: false,
    });
  });
});

describe('P2 · 内置厂商连接的候选只标注、不裁剪', () => {
  it('内置分组的候选本来就来自带 Key 的 /v1/models ⇒ 不因权益数据把它们删掉', () => {
    recordProviderEntitlements('apimart', parseNewApiEntitlements(PRICING)!, ['gpt-5.5']);
    const config: AppConfig = {
      theme: 'dark',
      providers: {
        apimart: {
          name: 'APIMart',
          apiKey: 'placeholder-key-not-real',
          catalogId: 'apimart',
          selectedModels: [selection('gpt-5.5', 'text'), selection('glm-5.3', 'text')],
        },
      },
    };
    const group = getConfiguredModelGroups(config, 'ai-text').find((item) => item.id === 'apimart');
    const values = group?.models.map((model) => model.value) ?? [];
    /* 用户勾过的两条都留着（**不裁**），只把不在清单里的那条标起来 */
    expect(values).toEqual(expect.arrayContaining(['apimart/gpt-5.5', 'apimart/glm-5.3']));
    expect(group?.models.find((model) => model.value === 'apimart/glm-5.3')?.unavailable).toBe(true);
    expect(group?.models.find((model) => model.value === 'apimart/gpt-5.5')?.unavailable).toBe(false);
    expect(group?.models[0]).toMatchObject({ connectionId: 'apimart', connectionName: 'APIMart' });
  });
});
