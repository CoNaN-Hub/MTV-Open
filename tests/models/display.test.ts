/**
 * 展示名出口契约 —— **UI 只允许通过 `services/models/display` 拿名字**。
 *
 * 这条是用户要求的核心：「API 调用使用第三方平台提供的原始模型 ID；用户界面统一展示官方模型名称」。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  clearNormalizedCache, displayNameOfModelRef, normalizedModelOf, splitModelRef, stampNormalized,
} from '../../src/services/models/display';
import { displayNameOfSelection } from '../../src/services/ai/providerCatalogService';
import { resetModelOverridesForTest, syncMappingOverrides } from '../../src/services/models/overrides';
import type { ProviderModelSelection } from '../../src/types';

describe('displayNameOfModelRef —— 节点上存的 `provider/modelId` → 展示名', () => {
  it('内置平台：官方表精确匹配的模型显示官方名', () => {
    expect(displayNameOfModelRef('cccapi/gpt-image-2')).toBe('GPT Image2');
    expect(displayNameOfModelRef('grsai/gemini-3-pro')).toBe('Gemini 3 Pro');
    /* 2026-10-15 二次裁决：`doubao-seedream-4.5` 虽不在官方 apimart 清单里，但
       providerModelId 与 canonical `officialModelIds` 逐字相等 ⇒ **依据成立、保留绑定**
       （标 unverified，unverified 只描述「不在官方清单」）。展示名仍由 canonical 收口。 */
    expect(displayNameOfModelRef('apimart/doubao-seedream-4.5')).toBe('Seedream 4.5');
    expect(displayNameOfModelRef('apimart/seedream-4-5')).toBe('Seedream 4.5');
  });

  it('用户自建的中转站：靠域名认出平台，再走它的映射表', () => {
    /* 连接 key 是 `custom-openai-xxxx`，只有 baseUrl 能定位到土豆 */
    expect(displayNameOfModelRef('custom-openai-ab12/gemini-3-pro-image-preview', {
      baseUrl: 'https://api.ai-tudou.net/v1',
    })).toBe('Nano Banana Pro');
  });

  it('同步 / 异步显示成两个名字，调用 id 各自不同', () => {
    expect(displayNameOfModelRef('tudou/gemini-3-pro-image-preview')).toBe('Nano Banana Pro');
    expect(displayNameOfModelRef('tudou/gemini-3-pro-image-preview-async')).toBe('Nano Banana Pro async');
  });

  it('没映射 ⇒ 显示**原始平台 id**（不虚构官方名）', () => {
    expect(displayNameOfModelRef('tudou/zzz-mystery-model')).toBe('zzz-mystery-model');
    expect(displayNameOfModelRef('custom-openai-ab12/zzz-mystery-model', {
      baseUrl: 'https://unknown.example.com/v1',
    })).toBe('zzz-mystery-model');
  });

  it('自定义连接 `general/<cfgId>`：用上游 modelId 归一化，不用用户起的名字', () => {
    const name = displayNameOfModelRef('general/cfg-1', {
      generalModels: [{ id: 'cfg-1', modelId: 'gpt-image-2.5-flare', name: '我的渠道A旗舰', providerConfigId: 'conn' }],
      providers: { conn: { catalogId: 'custom-openai', baseUrl: 'https://api.ai-tudou.net/v1' } },
    });
    expect(name).toBe('GPT Image 2.5 Flare');
    expect(name).not.toContain('渠道A');
  });

  it('自定义连接认不出平台：恰好等于官方 id 时给官方名；否则退回原始上游 id', () => {
    /* 上游 id 与官方 id 精确相等 ⇒ 查表命中（不是猜）*/
    expect(displayNameOfModelRef('general/cfg-2', {
      generalModels: [{ id: 'cfg-2', modelId: 'gpt-image-2.5-flare', name: 'GPT Image 2.5 Flare 旗舰版' }],
    })).toBe('GPT Image 2.5 Flare');
    /* 真的认不出 ⇒ 原始上游 id，且**绝不**拿用户起的名字当官方名 */
    const unknown = displayNameOfModelRef('general/cfg-3', {
      generalModels: [{ id: 'cfg-3', modelId: 'zzz-mystery-model', name: '我的神秘模型旗舰版' }],
    });
    expect(unknown).toBe('zzz-mystery-model');
    expect(unknown).not.toContain('旗舰版');
  });

  it('裸官方 id（历史记录只存了 id）⇒ 仍能给出官方名', () => {
    expect(displayNameOfModelRef('gpt-image-1')).toBe('GPT Image');
    expect(displayNameOfModelRef('totally-unknown')).toBe('totally-unknown');
  });

  it('空引用 / 认不出的形态 → 原样返回，不抛错', () => {
    expect(displayNameOfModelRef('')).toBe('');
    expect(displayNameOfModelRef('   ')).toBe('');
    expect(displayNameOfModelRef('no-slash-id')).toBe('no-slash-id');
    expect(displayNameOfModelRef('general/不存在的配置')).toBe('general/不存在的配置');
  });

  it('`splitModelRef` 只切第一个斜杠（上游 id 里可能还有斜杠）', () => {
    expect(splitModelRef('apimart/gpt-image-2')).toEqual({ provider: 'apimart', providerModelId: 'gpt-image-2' });
    expect(splitModelRef('runninghub/a/b/c')).toEqual({ provider: 'runninghub', providerModelId: 'a/b/c' });
    expect(splitModelRef('bare')).toEqual({ provider: '', providerModelId: 'bare' });
  });
});

describe('内置清单切换后不退化，且官方名优先', () => {
  it('官方表命中 ⇒ 显示**官方名**，MTV 自己的策划名让位（这就是"UI 显示官方名"）', () => {
    /* 官方表里 nano-banana-2 的官方名是「Nano Banana 2」（2026-10-15 按 apimart 官方清单逐字改名）；
       原先 Registry 把 `nano-banana-2` 挂在 `google/banana-pro` 上属数据错误 ⇒ 已按 name 优先改绑 `google/banana-2` */
    expect(displayNameOfModelRef('grsai/nano-banana-2')).toBe('Nano Banana 2');
    /* 官方表写的是 `GPT Image2`（无空格）—— 逐字保留，不做美化 */
    expect(displayNameOfModelRef('apimart/gpt-image-2')).toBe('GPT Image2');
    expect(displayNameOfModelRef('apimart/gpt-image-2.5-flare')).toBe('GPT Image 2.5 Flare');
  });

  it('官方表没这个模型 ⇒ 用映射配置里的名字（不退化、不虚构官方名）', () => {
    /* ⚠️ 2026-10-15：apimart 按官方清单重建后，这条的 displayNameOverride 不再是 MTV 手写策划名
       「Nano Banana 3.1」，而是**官方 apimart 清单的 name 逐字**「Nano Banana 2」。 */
    expect(displayNameOfModelRef('apimart/gemini-3.1-flash-image-preview')).toBe('Nano Banana 2');
    expect(displayNameOfModelRef('grsai/nano-banana-pro')).toBe('Nano Banana Pro');
    /* 上一轮报的缺口：官方 id + 日期尾巴 ⇒ 现在由配置兜住 */
    expect(displayNameOfModelRef('volcengine/doubao-seedream-4-5-251128')).toBe('Seedream 4.5');
    expect(displayNameOfModelRef('runninghub/youchuan-v81')).toBe('Midjourney V8.1');
  });

  it('没有 canonicalId 的条目一律标 `unverified` 且写明官方出处（进「待审核」）', () => {
    const file = JSON.parse(readFileSync(new URL('../../src/data/modelMappings/apimart.json', import.meta.url), 'utf8')) as {
      mappings: Array<{ providerModelId: string; canonicalId?: string; displayNameOverride?: string; matchStatus: string; source?: string }>;
    };
    const unbound = file.mappings.filter((m) => !m.canonicalId);
    expect(unbound.length).toBeGreaterThan(20);
    for (const m of unbound) {
      expect(m.matchStatus, m.providerModelId).toBe('unverified');
      expect(m.source, m.providerModelId).toContain('apimart.ai/en/pricing');
    }
    /* 已有 official 身份的条目**不许**被 override 覆盖 */
    const official = file.mappings.filter((m) => m.canonicalId);
    expect(official.length).toBeGreaterThan(5);
    for (const m of official) expect(m.displayNameOverride, m.providerModelId).toBeUndefined();
  });
});

describe('ModelSelector 只从展示名出口取名字', () => {
  const selector = readFileSync(new URL('../../src/components/nodes/shared/ModelSelector.tsx', import.meta.url), 'utf8');
  const code = selector.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('导入了展示名出口，且三处名字（触发器/下拉行/首字母）都走它', () => {
    expect(code).toContain("import { displayNameOfModelRef } from '../../../services/models/display';");
    expect(code).toContain('const modelDisplayName = useCallback(');
    expect(code).toContain('displayNameOfModelRef(model.value');
    /* 触发器 + 下拉行都调同一个函数 */
    expect((code.match(/modelDisplayName\(currentModel\)/g) ?? []).length).toBe(1);
    expect((code.match(/modelDisplayName\(model\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('组件层不再有「覆盖表 → 官方 i18n → label」这套自己拼的优先级', () => {
    expect(code).not.toContain('override?.name ?? official.displayName ?? model.label');
    expect(code).not.toContain('modelDisplayOverride(currentModel.value');
    expect(code).not.toContain('official.displayName ?? model.label');
  });
});

describe('目录条目盖章（ProviderModelSelection.normalized）', () => {
  it('盖章后 `displayName` 是唯一给界面看的名字，`name` 保留平台原文', () => {
    const entry = stampNormalized(
      { id: 'gemini-3-pro-image-preview', name: '特价渠道-香蕉' },
      { connectionKey: 'tudou', baseUrl: 'https://api.ai-tudou.net/v1' },
    );
    expect(entry.name).toBe('特价渠道-香蕉');           // 平台原文，仅排障
    expect(entry.normalized.displayName).toBe('Nano Banana Pro');
    expect(entry.normalized.providerModelId).toBe('gemini-3-pro-image-preview');
    expect(entry.normalized.canonicalId).toBe('google/banana-pro');
  });

  it('`displayNameOfSelection`：有归一化就用它，没有就实时算（兼容旧配置）', () => {
    const fresh = stampNormalized({ id: 'gpt-image-2', name: 'gpt-image-2' }, { connectionKey: 'cccapi' });
    expect(displayNameOfSelection(fresh as ProviderModelSelection)).toBe('GPT Image2');

    const legacy = { id: 'gpt-image-2', name: 'gpt-image-2', provider: 'cccapi' } as ProviderModelSelection;
    expect(legacy.normalized).toBeUndefined();
    expect(displayNameOfSelection(legacy)).toBe('GPT Image2');
  });

  it('归一化结果被缓存（同一 key 返回同一对象，避免每次 render 重算）', () => {
    clearNormalizedCache();
    const a = normalizedModelOf({ providerId: 'cccapi', providerModelId: 'gpt-image-2' });
    const b = normalizedModelOf({ providerId: 'cccapi', providerModelId: 'gpt-image-2' });
    expect(a).toBe(b);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * 用户实测：在「设置 → 模型映射」改了 Display Name，界面上**读不出来**。
 * 两条根因各钉一条用例（都是真机复现过的）。
 * ──────────────────────────────────────────────────────────────────────────── */
describe('平台解析与名字缓存 —— 「改了 Display Name 要能立刻显示」', () => {
  it('① 只传 `providers` 也能认出平台（`ModelSelector` 的真实调用形态）', () => {
    /* 修前：`displayNameOfModelRef` 在非 general 分支里**根本没用** `options.providers`，
       只吃 `options.catalogId/baseUrl` ⇒ 平台永远解析不出来 ⇒ 这条会返回原始 id。 */
    const withProviders = displayNameOfModelRef('custom-2611fc0a/gemini-3-pro-image-preview', {
      providers: { 'custom-2611fc0a': { catalogId: 'custom-openai', baseUrl: 'https://api.ai-tudou.net/v1' } },
    });
    expect(withProviders).toBe('Nano Banana Pro');
    /* 反证：`providers` 里没有这个连接时认不出平台，只能退回原始 id */
    expect(displayNameOfModelRef('custom-2611fc0a/gemini-3-pro-image-preview', { providers: {} }))
      .toBe('gemini-3-pro-image-preview');
  });

  it('② 显式传的连接 key 不再顶掉平台解析（`useModelNameResolver` 的调用形态）', () => {
    /* 修前：`normalizedModelOf` 里 `input.providerId ?? resolveProviderId(connection)`
       ⇒ 一旦给了 `custom-2611fc0a` 就**不再看 baseUrl** ⇒ 映射表/覆盖层全查不到。
       现在：显式 providerId 若不是已知平台，就用连接解析出的已知平台。 */
    expect(displayNameOfModelRef('custom-2611fc0a/gemini-3-pro-image-preview-async', {
      providerId: 'custom-2611fc0a',
      catalogId: 'custom-openai',
      baseUrl: 'https://api.ai-tudou.net/v1',
      providers: { 'custom-2611fc0a': { baseUrl: 'https://api.ai-tudou.net/v1' } },
    })).toBe('Nano Banana Pro async');
    /* ② 的反面：显式 providerId **本来就是已知平台**时保持既有行为（不被连接改写） */
    expect(displayNameOfModelRef('tudou/gemini-3-pro-image-preview', { providers: {} })).toBe('Nano Banana Pro');
  });

  it('③ 手工 Display Name 覆盖生效，且**清缓存后立刻换名**（不需要重载）', () => {
    clearNormalizedCache();
    resetModelOverridesForTest();
    const ref = 'tudou/zzz-my-model';
    expect(displayNameOfModelRef(ref)).toBe('zzz-my-model');

    syncMappingOverrides([{
      providerId: 'tudou',
      providerModelId: 'zzz-my-model',
      displayNameOverride: '我的模型',
      matchStatus: 'unverified',
    }]);
    /* ⚠️ 覆盖层变了但**没清缓存** ⇒ 仍是旧名字 —— 这正是用户遇到的「改了不生效」 */
    expect(displayNameOfModelRef(ref)).toBe('zzz-my-model');
    clearNormalizedCache();
    expect(displayNameOfModelRef(ref)).toBe('我的模型');

    resetModelOverridesForTest();
    clearNormalizedCache();
  });

  it('④ 源码级：`store.config.ts` 必须在覆盖层 / 注册表变化时清名字缓存', () => {
    /* `display.ts` 的 CACHE 键里**不含**覆盖层状态 ⇒ 不清就一定读到旧名字。
       生产代码里 `clearNormalizedCache()` 原来**零调用点**（只有测试在调）。 */
    const src = readFileSync(new URL('../../src/store/store.config.ts', import.meta.url), 'utf8');
    const calls = src.match(/clearNormalizedCache\(\)/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const anchor of ["'modelMappingOverrides' in partial", "'removedModelMappings' in partial", "'modelCanonicalAdditions' in partial"]) {
      const at = src.indexOf(anchor);
      expect(at, anchor).toBeGreaterThanOrEqual(0);
      const blockEnd = src.indexOf('\n    }', at);
      expect(src.slice(at, blockEnd), anchor).toContain('clearNormalizedCache()');
    }
  });
});
