/**
 * 多平台模型接入 · 官方名称展示 —— 归一化层契约。
 *
 * 用户口径（2026）：
 *   ·「API 调用使用第三方平台提供的原始模型 ID；用户界面统一展示官方模型名称」
 *   ·「支持第三方模型 ID 与官方名称完全不相似的情况」
 *   ·「保留如 async 等平台执行模式后缀」
 *   ·「不得将任何单一平台名称、模型规则或映射逻辑写死在 Agent UI 或业务组件中」
 *   ·「禁止凭模型 ID 猜测一个『看起来合理』的官方名称」
 *   · 补充规则：「canonicalId 使用小写 vendor/slug，只作为内部稳定标识；名称变更时优先更新
 *     officialName；异步版本不建议写成新的 canonicalId」
 *
 * 解析优先级（必须严格按序）：
 *   1 已验证精确映射 → 2 已验证平台别名 → 3 平台声明的官方标识 →
 *   4 交叉验证候选（标 manual-review，**不换名字**）→ 5 兜底保留原始名（unverified）
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  allCanonicalModels, createCanonicalIndex, findCanonicalByOfficialId,
  findCanonicalCandidateByNormalizedId, getCanonicalModel, isValidCanonicalId, normalizeOfficialId,
} from '../../src/services/models/canonical';
import {
  composeDisplayName, declaredSuffixes, NO_SUFFIX_SPEC, splitSuffix,
} from '../../src/services/models/suffix';
import {
  dedupeKey, dedupeNormalized, normalizeModel, normalizeModels, type ModelResolverDeps,
} from '../../src/services/models/normalize';
import {
  adapterIdForProvider, allProviderConfigs, getProviderConfig, providerLabel, resolveProviderId,
  suffixSpecForProvider,
} from '../../src/services/models/providers';
import {
  getMappingFile, hasMappingFile, listExactMappings, listMappingProviderIds,
} from '../../src/services/models/mappings';
import type { CanonicalModel, MatchStatus, ProviderModelMapping, ProviderSuffixSpec } from '../../src/services/models/types';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

/* ────────────────────────── 测试用的注册表替身 ────────────────────────── */

interface FakeDepsInput {
  canonical?: CanonicalModel[];
  exact?: ProviderModelMapping[];
  alias?: Array<{ providerId: string; alias: string; canonicalId: string; matchStatus: MatchStatus }>;
  suffixSpec?: Record<string, ProviderSuffixSpec>;
}

/** 用合成数据造一套 deps —— 这样「改名 / 下线 / 冲突」等数据态都能被测到。 */
function fakeDeps(input: FakeDepsInput): ModelResolverDeps {
  const index = createCanonicalIndex(input.canonical ?? []);
  const exact = new Map(input.exact?.map((m) => [`${m.providerId}\u0000${m.providerModelId}`, m]) ?? []);
  const alias = new Map(input.alias?.map((a) => [`${a.providerId}\u0000${a.alias.toLowerCase()}`, a]) ?? []);
  return {
    getCanonicalModel: (id) => (id ? index.byCanonicalId.get(id) ?? null : null),
    findCanonicalByOfficialId: (id) => (id ? index.byOfficialId.get(id.trim().toLowerCase()) ?? null : null),
    findCanonicalCandidateByNormalizedId: (v) => (v ? index.byNormalizedOfficialId.get(normalizeOfficialId(v)) ?? null : null),
    findExactMapping: (p, id) => exact.get(`${p}\u0000${id}`) ?? null,
    findAliasMapping: (p, a) => (alias.get(`${p}\u0000${a.toLowerCase()}`) ?? alias.get(`*\u0000${a.toLowerCase()}`) ?? null) as never,
    suffixSpecForProvider: (p) => input.suffixSpec?.[p] ?? NO_SUFFIX_SPEC,
  };
}

const bananaPro: CanonicalModel = {
  canonicalId: 'google/banana-pro',
  officialName: 'Nano Banana Pro',
  officialVendor: 'Google',
  officialModelIds: ['tamar-google-gemini-pro', 'nano-banana-2'],
  capabilities: ['image'],
  status: 'active',
  iconKey: 'da.BANANA',
};

const TUDOU_SUFFIX: ProviderSuffixSpec = { separator: '-', suffixes: ['async'], executionMode: { async: 'async' } };

/* ────────────────────────── 1. 完全不同名 ────────────────────────── */

describe('① 第三方 id 与官方名完全不相似', () => {
  it('用户给的例子：`gemini-3-pro-image-preview` → 官方名 `Banana Pro`，调用 id 不变', () => {
    const model = normalizeModel({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview' });
    expect(model.canonicalId).toBe('google/banana-pro');
    expect(model.officialName).toBe('Nano Banana Pro');
    expect(model.displayName).toBe('Nano Banana Pro');
    expect(model.officialVendor).toBe('Google');
    expect(model.executionMode).toBe('sync');
    expect(model.matchStatus).toBe('verified');
    /* ★ 调用 id **逐字**保留 */
    expect(model.providerModelId).toBe('gemini-3-pro-image-preview');
  });

  it('平台给的显示名（渠道名）绝不进界面 —— 官方名位置只放官方名或原始调用 id', () => {
    const model = normalizeModel({
      providerId: 'tudou',
      providerModelId: 'gemini-3-pro-image-preview',
      raw: { providerModelId: 'gemini-3-pro-image-preview', providerName: '【特价】Banana超值渠道' },
    });
    expect(model.displayName).toBe('Nano Banana Pro');
    expect(model.displayName).not.toContain('特价');
  });
});

/* ────────────────────────── 2. 大小写 / 版本 / 空格逐字保真 ────────────────────────── */

describe('② 官方名逐字保真（大小写、空格、连字符、版本号、官方后缀）', () => {
  it('官方表里的名字原样返回，不做任何大小写/空格规范化', () => {
    const samples: Array<[string, string]> = [
      ['MiniMax-Hailuo-2.3', 'Hailuo-2.3'],
      ['gpt-image-2.5-flare', 'GPT Image 2.5 Flare'],
      ['gpt-image-2', 'GPT Image2'],
      ['veo3.1-lite-extend', 'VEO3.1-Lite 视频延长'],
      ['imagen-4.0', 'IMAGEN 4.0'],
    ];
    for (const [officialId, expectedName] of samples) {
      const canonical = findCanonicalByOfficialId(officialId);
      expect(canonical?.officialName, officialId).toBe(expectedName);
    }
  });

  it('`composeDisplayName` 只拼后缀，不动名字本体', () => {
    expect(composeDisplayName('GPT Image 2.5 Flare')).toBe('GPT Image 2.5 Flare');
    expect(composeDisplayName('GPT Image 2.5 Flare', 'async')).toBe('GPT Image 2.5 Flare async');
    expect(composeDisplayName('MiniMax-Hailuo-2.3', 'batch')).toBe('MiniMax-Hailuo-2.3 batch');
  });
});

/* ────────────────────────── 3. 多 Provider ────────────────────────── */

describe('③ 多 Provider 各自映射，互不影响', () => {
  it('同一个 canonicalId 在三个平台上是三条独立的 NormalizedModel', () => {
    const deps = fakeDeps({
      canonical: [bananaPro],
      exact: [
        { providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview', canonicalId: 'google/banana-pro', executionMode: 'sync', matchStatus: 'verified', source: 'A', updatedAt: '2026-10-12' },
        { providerId: 'apimart', providerModelId: 'tamar-google-gemini-pro', canonicalId: 'google/banana-pro', executionMode: 'sync', matchStatus: 'verified', source: 'B', updatedAt: '2026-10-12' },
        { providerId: 'grsai', providerModelId: 'nano-banana-pro', canonicalId: 'google/banana-pro', executionMode: 'sync', matchStatus: 'verified', source: 'C', updatedAt: '2026-10-12' },
      ],
    });
    const models = normalizeModels([
      { providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview' },
      { providerId: 'apimart', providerModelId: 'tamar-google-gemini-pro' },
      { providerId: 'grsai', providerModelId: 'nano-banana-pro' },
    ], deps);
    expect(models.map((m) => m.displayName)).toEqual(['Nano Banana Pro', 'Nano Banana Pro', 'Nano Banana Pro']);
    expect(models.map((m) => m.providerModelId)).toEqual([
      'gemini-3-pro-image-preview', 'tamar-google-gemini-pro', 'nano-banana-pro',
    ]);
    expect(new Set(models.map((m) => m.providerId)).size).toBe(3);
  });

  it('平台解析：域名优先于 catalogId（用户自定义连接也认得出是哪一家）', () => {
    expect(resolveProviderId({ catalogId: 'custom-openai', baseUrl: 'https://api.ai-tudou.net/v1' })).toBe('tudou');
    expect(resolveProviderId({ catalogId: 'custom-openai', baseUrl: 'api.ai-tudou.net' })).toBe('tudou');
    expect(resolveProviderId({ catalogId: 'apimart' })).toBe('apimart');
    expect(resolveProviderId({ connectionKey: 'apimart' })).toBe('apimart');
    expect(resolveProviderId({ catalogId: 'custom-openai', baseUrl: 'https://unknown.example.com' })).toBe('custom-openai');
    expect(resolveProviderId({})).toBe('unknown');
  });
});

/* ────────────────────────── 4. 同步 / 异步并存 ────────────────────────── */

describe('④ 同步与异步是两条独立模型，后缀必须保留', () => {
  it('`-async` 解析为 executionMode: async，displayName = 官方名 + " async"', () => {
    const sync = normalizeModel({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview' });
    const async = normalizeModel({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview-async' });
    expect(sync.executionMode).toBe('sync');
    expect(sync.displayName).toBe('Nano Banana Pro');
    expect(async.executionMode).toBe('async');
    expect(async.displayName).toBe('Nano Banana Pro async');
    /* 同一个模型身份，两个调用 id */
    expect(async.canonicalId).toBe(sync.canonicalId);
    expect(async.providerModelId).toBe('gemini-3-pro-image-preview-async');
    expect(async.baseModelId).toBe('gemini-3-pro-image-preview');
  });

  it('★ 去重按 `providerId + providerModelId` —— 用 canonicalId 去重会把异步版吞掉', () => {
    const list = [
      normalizeModel({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview' }),
      normalizeModel({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview-async' }),
    ];
    const deduped = dedupeNormalized(list);
    /* 同一个 canonicalId，但两条都要在 */
    expect(new Set(list.map((m) => m.canonicalId)).size).toBe(1);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((m) => m.providerModelId)).toEqual([
      'gemini-3-pro-image-preview', 'gemini-3-pro-image-preview-async',
    ]);
    expect(dedupeKey(list[0])).not.toBe(dedupeKey(list[1]));
    /* 真正的重复才会被合并 */
    expect(dedupeNormalized([list[0], list[0]])).toHaveLength(1);
  });

  it('后缀不改写、不翻译、不隐藏：providerModelId 里 `async` 原样存在', () => {
    for (const id of ['gemini-3-pro-image-preview-async', 'gpt-image-2.5-flare-async']) {
      const model = normalizeModel({ providerId: 'tudou', providerModelId: id });
      expect(model.providerModelId).toBe(id);
      expect(model.providerModelId).toContain('async');
      expect(model.displayName).toContain('async');
    }
  });

  it('映射里显式登记了同步与异步两条（tudou.json）', () => {
    const mappings = listExactMappings('tudou');
    const flare = mappings.filter((m) => m.providerModelId.startsWith('gpt-image-2.5-flare'));
    expect(flare).toHaveLength(2);
    expect(flare.map((m) => m.executionMode).sort()).toEqual(['async', 'sync']);
  });
});

/* ────────────────────────── 5. 其它平台后缀（batch / priority）────────────────────────── */

describe('⑤ `batch` / `priority` 等后缀走同一套可配置机制', () => {
  const multi: ProviderSuffixSpec = {
    separator: '-',
    suffixes: ['async', 'batch', 'priority'],
    executionMode: { async: 'async', batch: 'async', priority: 'sync' },
  };
  const deps = fakeDeps({
    canonical: [bananaPro],
    exact: [{ providerId: 'p1', providerModelId: 'x-pro', canonicalId: 'google/banana-pro', executionMode: 'sync', matchStatus: 'verified', source: 's', updatedAt: '2026-10-12' }],
    suffixSpec: { p1: multi },
  });

  it('拆后缀：separator 与 suffixes 全来自配置', () => {
    expect(splitSuffix('x-async', multi)).toEqual({ baseModelId: 'x', suffix: 'async', executionMode: 'async' });
    expect(splitSuffix('x-batch', multi)).toEqual({ baseModelId: 'x', suffix: 'batch', executionMode: 'async' });
    expect(splitSuffix('x-priority', multi)).toEqual({ baseModelId: 'x', suffix: 'priority', executionMode: 'sync' });
    expect(splitSuffix('x', multi)).toEqual({ baseModelId: 'x', executionMode: 'sync' });
    /* 未声明的后缀不认（避免把真 id 的尾巴当规格） */
    expect(splitSuffix('x-turbo', multi).suffix).toBeUndefined();
  });

  it('未声明的后缀不会被切：`nano-banana-flash` 不会被当成 `nano-banana` + `flash`', () => {
    const spec: ProviderSuffixSpec = { separator: '-', suffixes: ['async'] };
    expect(splitSuffix('nano-banana-flash', spec)).toEqual({ baseModelId: 'nano-banana-flash', executionMode: 'sync' });
  });

  it('displayName 用后缀原文拼（不翻译）', () => {
    const model = normalizeModel({ providerId: 'p1', providerModelId: 'x-pro-batch' }, deps);
    expect(model.displayName).toBe('Nano Banana Pro batch');
    expect(model.providerModelId).toBe('x-pro-batch');
    expect(model.baseModelId).toBe('x-pro');
  });

  it('`declaredSuffixes` 汇总所有平台声明（管理视图用）', () => {
    expect(declaredSuffixes([TUDOU_SUFFIX, multi, undefined])).toEqual(['async', 'batch', 'priority']);
  });
});

/* ────────────────────────── 6. 未知模型 ────────────────────────── */

describe('⑥ 未知模型：不虚构官方名', () => {
  it('完全没映射 ⇒ officialName = providerModelId，matchStatus = unverified', () => {
    const model = normalizeModel({ providerId: 'brand-new-platform', providerModelId: 'zzz-super-model-v9' });
    expect(model.canonicalId).toBeUndefined();
    expect(model.officialName).toBe('zzz-super-model-v9');
    expect(model.displayName).toBe('zzz-super-model-v9');
    expect(model.matchStatus).toBe('unverified');
    expect(model.status).toBe('unverified');
  });

  it('平台给了名字也不许当官方名用', () => {
    const model = normalizeModel({
      providerId: 'brand-new-platform',
      providerModelId: 'zzz-super-model-v9',
      raw: { providerModelId: 'zzz-super-model-v9', providerName: 'SuperModel 旗舰版' },
    });
    expect(model.displayName).toBe('zzz-super-model-v9');
    expect(model.displayName).not.toContain('SuperModel');
  });

  it('第 4 档候选（**归一化后**相似）只给 `manual-review`，displayName 仍是原始 id', () => {
    /* `gpt-image-2-5-flare`（全横线）归一化后 == 官方 `gpt-image-2.5-flare`（点号）⇒ 只敢当候选 */
    const model = normalizeModel({ providerId: 'brand-new-platform', providerModelId: 'gpt-image-2-5-flare' });
    expect(model.matchStatus).toBe('manual-review');
    expect(model.displayName).toBe('gpt-image-2-5-flare');
    expect(model.source).toMatch(/待人工确认/);
  });

  it('第 3.5 档：调用 id **精确等于**官方 id ⇒ 用官方名（这是查表不是猜）', () => {
    const model = normalizeModel({ providerId: 'any-relay', providerModelId: 'gpt-image-2.5-flare' });
    expect(model.matchStatus).toBe('verified');
    expect(model.canonicalId).toBe('openai/gpt-image-2-5-flare');
    expect(model.displayName).toBe('GPT Image 2.5 Flare');
    expect(model.providerModelId).toBe('gpt-image-2.5-flare');
    expect(model.source).toMatch(/与官方 id 完全一致/);
  });

  it('第 3.5 档也认「去平台后缀后的主体 id」（`…-async` ⇒ 用官方名 + async）', () => {
    const model = normalizeModel({ providerId: 'tudou', providerModelId: 'gpt-image-2.5-sunburst-async' });
    expect(model.canonicalId).toBe('openai/gpt-image-2-5-sunburst');
    expect(model.displayName).toBe('GPT Image 2.5 Sunburst async');
    expect(model.executionMode).toBe('async');
  });

  it('空 id 不炸，返回空壳（调用方自己处理）', () => {
    const model = normalizeModel({ providerId: 'tudou', providerModelId: '   ' });
    expect(model.providerModelId).toBe('');
    expect(model.matchStatus).toBe('unverified');
  });
});

/* ────────────────────────── 7. 模型改名 ────────────────────────── */

describe('⑦ 改名：只动 officialName，canonicalId 冻结', () => {
  it('canonicalId 不是由名字实时推导的（含 CJK 官方名的条目就是证据）', () => {
    const kling = allCanonicalModels().find((m) => m.canonicalId === 'kuaishou/kling-o3-video-edit');
    expect(kling?.officialName).toBe('Kling 3.0 Omni 视频编辑');
    /* 名字里有 CJK，slug 却是 ASCII 的官方 id ⇒ 证明 canonicalId 是冻结值，不是 slug(officialName) */
    expect(kling!.canonicalId).not.toContain('视频编辑');
    expect(isValidCanonicalId(kling!.canonicalId)).toBe(true);
  });

  it('改 officialName 后：displayName 跟着变，canonicalId 与 providerModelId 都不动', () => {
    const renamed: CanonicalModel = { ...bananaPro, officialName: 'Nano Banana Pro 2' };
    const deps = fakeDeps({
      canonical: [renamed],
      exact: [{ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview', canonicalId: 'google/banana-pro', executionMode: 'sync', matchStatus: 'verified', source: 's', updatedAt: '2026-10-12' }],
    });
    const model = normalizeModel({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview' }, deps);
    expect(model.displayName).toBe('Nano Banana Pro 2');
    expect(model.canonicalId).toBe('google/banana-pro');
    expect(model.providerModelId).toBe('gemini-3-pro-image-preview');
  });
});

/* ────────────────────────── 8. 模型下线 ────────────────────────── */

describe('⑧ 下线：status = deprecated，调用 id 不变（不做静默替换）', () => {
  const deprecated: CanonicalModel = { ...bananaPro, status: 'deprecated' };

  it('deprecated ⇒ NormalizedModel.status = deprecated', () => {
    const deps = fakeDeps({
      canonical: [deprecated],
      exact: [{ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview', canonicalId: 'google/banana-pro', executionMode: 'sync', matchStatus: 'verified', source: 's', updatedAt: '2026-10-12' }],
    });
    const model = normalizeModel({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview' }, deps);
    expect(model.status).toBe('deprecated');
    expect(model.matchStatus).toBe('verified');
    /* ★ 不因为下线就改写调用 id */
    expect(model.providerModelId).toBe('gemini-3-pro-image-preview');
    expect(model.displayName).toBe('Nano Banana Pro');
  });
});

/* ────────────────────────── 9. 冲突 / 配置校验 ────────────────────────── */

describe('⑨ 映射表构建期校验（冲突必须炸，不能运行时挑一条）', () => {
  it('canonicalId 重复 ⇒ 抛错', () => {
    expect(() => createCanonicalIndex([bananaPro, { ...bananaPro, officialName: 'X' }]))
      .toThrow(/canonicalId 重复/);
  });

  it('canonicalId 形状不合法 ⇒ 抛错（必须小写 vendor/slug）', () => {
    for (const bad of ['Google/Banana', 'banana-pro', 'google/', '/banana', 'google/Banana_Pro']) {
      expect(isValidCanonicalId(bad), bad).toBe(false);
      expect(() => createCanonicalIndex([{ ...bananaPro, canonicalId: bad }])).toThrow(/vendor\/slug/);
    }
    expect(isValidCanonicalId('google/banana-pro')).toBe(true);
  });

  it('仓库里现存的 109 条 canonicalId 全部合法且无重复', () => {
    const all = allCanonicalModels();
    expect(all.length).toBeGreaterThanOrEqual(100);
    expect(new Set(all.map((m) => m.canonicalId)).size).toBe(all.length);
    for (const m of all) expect(isValidCanonicalId(m.canonicalId), m.canonicalId).toBe(true);
    for (const m of all) expect(m.officialName.trim(), m.canonicalId).toBe(m.officialName);
  });

  it('同一 providerId + providerModelId 在映射文件里只能出现一次', () => {
    for (const providerId of listMappingProviderIds()) {
      const ids = listExactMappings(providerId).map((m) => m.providerModelId);
      expect(new Set(ids).size, providerId).toBe(ids.length);
    }
  });

  it('所有 `verified` 映射都必须写 source（依据）', () => {
    for (const providerId of listMappingProviderIds()) {
      for (const m of listExactMappings(providerId)) {
        if (m.matchStatus === 'verified') expect(m.source, `${providerId}/${m.providerModelId}`).toBeTruthy();
      }
    }
  });

  it('映射引用的 canonicalId 必须存在于 Registry（不写空头票据）', () => {
    for (const providerId of listMappingProviderIds()) {
      for (const m of listExactMappings(providerId)) {
        if (!m.canonicalId) continue;
        expect(getCanonicalModel(m.canonicalId), `${providerId}/${m.providerModelId} → ${m.canonicalId}`).not.toBeNull();
      }
    }
  });

  it('映射文件里的 providerId 与文件名一致（约定：一平台一文件）', () => {
    for (const providerId of listMappingProviderIds()) {
      expect(getMappingFile(providerId)?.providerId).toBe(providerId);
      expect(hasMappingFile(providerId)).toBe(true);
    }
  });
});

/* ────────────────────────── 10. 出站 id 原样 ────────────────────────── */

describe('⑩ 出站调用 id 恒等于 providerModelId', () => {
  it('解析结果里的 providerModelId 就是入参原文（含前缀、点号、大小写、后缀）', () => {
    const ids = [
      'gemini-3-pro-image-preview',
      'gemini-3-pro-image-preview-async',
      'MiniMax-Hailuo-2.3',
      'doubao-seedream-5-0-pro-260628',
      'gpt-image-2.5-flare-async',
    ];
    for (const id of ids) {
      const model = normalizeModel({ providerId: 'tudou', providerModelId: id });
      expect(model.providerModelId, id).toBe(id);
    }
  });

  it('展示名与调用 id 是两个字段：展示可以换、调用 id 不许动', () => {
    const model = normalizeModel({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview' });
    expect(model.displayName).not.toBe(model.providerModelId);
    expect(model.displayName).toBe('Nano Banana Pro');
  });

  it('`baseModelId` 只用于匹配，不得当作调用 id 使用（类型上二者分开）', () => {
    const model = normalizeModel({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview-async' });
    expect(model.baseModelId).toBe('gemini-3-pro-image-preview');
    expect(model.providerModelId).toBe('gemini-3-pro-image-preview-async');
    expect(model.providerModelId).not.toBe(model.baseModelId);
  });
});

/* ────────────────────────── 11. 平台配置自身 ────────────────────────── */

describe('⑪ 平台配置化（新增平台不改代码）', () => {
  it('每个平台定义都有 providerId / label / adapterId', () => {
    for (const p of allProviderConfigs()) {
      expect(p.providerId).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.adapterId).toBeTruthy();
    }
  });

  it('平台标识唯一', () => {
    const ids = allProviderConfigs().map((p) => p.providerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('后缀声明来自配置（映射文件优先于平台定义）', () => {
    expect(suffixSpecForProvider('tudou').suffixes).toEqual(['async']);
    expect(suffixSpecForProvider('apimart').suffixes).toEqual([]);
    expect(adapterIdForProvider('apimart')).toBe('openai-compatible');
    expect(providerLabel('tudou')).toBe('土豆中转站');
    expect(getProviderConfig('不存在')).toBeNull();
  });

  it('映射文件由 glob 自动收录 —— 新增平台只需加一个 JSON', () => {
    const dir = read('src/data/modelMappings/tudou.json');
    expect(dir).toContain('"providerId": "tudou"');
    expect(listMappingProviderIds()).toContain('tudou');
    expect(listMappingProviderIds().length).toBeGreaterThan(1);
  });

  it('映射层不 import 任何 UI / store（否则就是"写死在业务组件里"）', () => {
    for (const f of ['canonical.ts', 'mappings.ts', 'normalize.ts', 'suffix.ts', 'providers.ts', 'types.ts']) {
      const src = read(`src/services/models/${f}`);
      expect(src, f).not.toMatch(/from '\.\.\/\.\.\/components/);
      expect(src, f).not.toMatch(/from '\.\.\/\.\.\/store/);
      expect(src, f).not.toMatch(/from '\.\.\/\.\.\/hooks/);
    }
  });
});

/* ────────────────────────── 12. 官方表一致性 ────────────────────────── */

describe('⑫ Registry 与官方表逐字一致', () => {
  it('用户例子里的 canonicalId / officialName / vendor 与官方表完全对得上', () => {
    const banana = getCanonicalModel('google/banana-pro');
    expect(banana?.officialName).toBe('Nano Banana Pro');
    expect(banana?.officialVendor).toBe('Google');
    expect(banana?.officialModelIds).toContain('tamar-google-gemini-pro');
    expect(banana?.officialModelIds).toContain('nano-banana-2');
  });

  it('官方三表里**每个有官方名的模型**都进了 Registry（不遗漏）', () => {
    const meta = JSON.parse(read('src/data/official-model-meta.json')) as Record<string, Record<string, { modelId: string; displayName: string | null }>>;
    const named = new Set<string>();
    for (const family of Object.values(meta)) {
      for (const entry of Object.values(family)) if (entry.displayName) named.add(entry.modelId);
    }
    const inRegistry = new Set(allCanonicalModels().flatMap((m) => m.officialModelIds ?? []));
    for (const id of named) expect(inRegistry.has(id), id).toBe(true);
    expect(named.size).toBeGreaterThan(100);
  });

  it('没有官方名的模型**没有被编造**进 Registry（官方表没名的就是不编）', () => {
    const img = JSON.parse(read('src/data/official-image-models.json')) as Array<{ model: string; displayName?: string | null }>;
    const meta = JSON.parse(read('src/data/official-model-meta.json')) as Record<string, Record<string, { modelId: string; displayName: string | null }>>;
    const namedAnywhere = new Set<string>();
    for (const family of Object.values(meta)) {
      for (const entry of Object.values(family)) if (entry.displayName) namedAnywhere.add(entry.modelId);
    }
    const inRegistry = new Set(allCanonicalModels().flatMap((m) => m.officialModelIds ?? []));
    /* 没名的（图片表没名、meta 里也没名）一个都不许进 —— 例外：2026-10-15 本轮身份清单里
       用户**显式**给出的模型（apidocs/详情页有身份，官方三表没给 displayName）。 */
    const DECLARED_IDENTITY = new Set(['midjourney']);
    const unnamed = img
      .filter((e) => !e.displayName && !namedAnywhere.has(e.model))
      .map((e) => e.model)
      .filter((id) => !DECLARED_IDENTITY.has(id));
    for (const id of unnamed) expect(inRegistry.has(id), id).toBe(false);
    /* 显式声明的那些必须真的进了 Registry（不是白名单空转） */
    for (const id of DECLARED_IDENTITY) expect(inRegistry.has(id), id).toBe(true);
    /* 有名的必须**全部**进（不遗漏） */
    for (const id of namedAnywhere) expect(inRegistry.has(id), id).toBe(true);
    expect(namedAnywhere.size).toBe(111);
  });

  it('`normalizeOfficialId` 只用于候选比对（分隔符不敏感），不产出展示名', () => {
    expect(normalizeOfficialId('doubao-seedream-5.0-pro')).toBe('doubao-seedream-5-0-pro');
    expect(findCanonicalCandidateByNormalizedId('doubao-seedream-5.0-pro')?.canonicalId).toBe('bytedance/seedream-5-0-pro');
    /* 找不到就 null —— 不返回"最像的那个" */
    expect(findCanonicalCandidateByNormalizedId('totally-unknown-model')).toBeNull();
  });
});
