/**
 * 土豆（`api.ai-tudou.net`）文本模型的**展示名覆盖** —— 用户 2026 实测投诉的可执行约束。
 *
 * 用户原话（截图 1-2）：「图1-2 这些模型名的大小下 不能按照官方的大小写格式来吗？
 *   现在接入厂商模型格式 进来 就直接显示了」——列表里显示的是厂商原始 id。
 * 用户原话（截图 3）：「在这里我编辑好大小写 也还是没有大小写」
 *   —— 那块是「逐模型手动价」（计价），**不是**显示名配置。
 *
 * 三条约束：
 *   ① 官方有 displayName ⇒ 列表显示**官方名**（不再显示厂商原始 id）；
 *   ② 官方没有的模型 ⇒ 显示**原始 id**，绝不美化、绝不猜（只登记）；
 *   ③ 「逐模型手动价」的 `modelId` 是**计价匹配键**，不参与显示名。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { displayNameOfModelRef, normalizedModelOf } from '../../src/services/models/display';
import { lookupOverrideUnitPrice } from '../../src/services/ai/creditEstimate';
import type { ProviderBillingConfig } from '../../src/types';

/** 用户实测的连接：name「土豆」，baseUrl `https://api.ai-tudou.net/v1`，catalogId `custom-openai`。 */
const TUDOU_BASE_URL = 'https://api.ai-tudou.net/v1';
const CONNECTION_KEY = 'custom-2611fc0a';
const PROVIDERS = {
  [CONNECTION_KEY]: { name: '土豆', catalogId: 'custom-openai', baseUrl: TUDOU_BASE_URL },
};

/**
 * 节点/列表上存的引用 → 展示名。
 * 与 `ModelSelector` 完全同一条链：`displayNameOfModelRef('general/<cfgId>', { generalModels, providers })`
 * （`src/components/nodes/shared/ModelSelector.tsx:259-265`，组件层只透传，不自己拼名字）。
 */
function listNameOf(upstreamModelId: string): string {
  return displayNameOfModelRef('general/cfg', {
    generalModels: [{
      id: 'cfg',
      modelId: upstreamModelId,
      name: upstreamModelId,
      providerConfigId: CONNECTION_KEY,
    }],
    providers: PROVIDERS,
  });
}

const readTudouMapping = () => JSON.parse(
  readFileSync(new URL('../../src/data/modelMappings/tudou.json', import.meta.url), 'utf8'),
) as { mappings: Array<{ providerModelId: string; canonicalId?: string; matchStatus: string; source?: string }> };

describe('① 官方有 displayName ⇒ 列表显示官方名（不再显示厂商原始 id）', () => {
  it('域名能认出土豆 ⇒ 走 tudou 的映射/官方 Registry，而不是原样吐出上游 id', () => {
    expect(normalizedModelOf({ providerId: 'tudou', providerModelId: 'gemini-3.8-flash' }).providerId)
      .toBe('tudou');
    expect(displayNameOfModelRef('general/cfg', {
      generalModels: [{ id: 'cfg', modelId: 'gemini-3.8-flash', providerConfigId: CONNECTION_KEY }],
      providers: PROVIDERS,
    })).toBe('Gemini 3.8 Flash');
  });

  it('gemini-3.8-flash ⇒ 官方 displayName「Gemini 3.8 Flash」（不再显示 gemini-3.8-flash）', () => {
    const name = listNameOf('gemini-3.8-flash');
    expect(name).toBe('Gemini 3.8 Flash');
    expect(name).not.toBe('gemini-3.8-flash');
  });

  it('gemini-3.5-flash ⇒ 官方 displayName「Gemini 3.5 Flash」', () => {
    const name = listNameOf('gemini-3.5-flash');
    expect(name).toBe('Gemini 3.5 Flash');
    expect(name).not.toBe('gemini-3.5-flash');
  });

  it('gemini-3.1-pro-preview ⇒ 官方 Gemini 3.1 Pro（上游 id ≠ 官方 id，逐条登记，不是剥后缀）', () => {
    const name = listNameOf('gemini-3.1-pro-preview');
    expect(name).toBe('Gemini 3.1 Pro');
    expect(name).not.toBe('gemini-3.1-pro-preview');
    /* ⚠️ 名字里**不许**冒出 `preview`：`-preview` 没有被当成平台规格后缀 */
    expect(name.toLowerCase()).not.toContain('preview');
    /* 出站调用 id 仍是上游原文（改名不改调用 id） */
    expect(normalizedModelOf({ providerId: 'tudou', providerModelId: 'gemini-3.1-pro-preview' }).providerModelId)
      .toBe('gemini-3.1-pro-preview');
  });

  it('改名不影响已映射的 `-preview` 图片模型（`-preview` 没被加成后缀）', () => {
    /* 若把 preview 写进 tudou 的 suffixSpec.suffixes，这条会变成「Banana Pro preview」 */
    expect(displayNameOfModelRef('tudou/gemini-3-pro-image-preview')).toBe('Nano Banana Pro');
    expect(normalizedModelOf({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview' }).providerSuffix)
      .toBeUndefined();
  });

  it('Registry 里登记的官方名与官方产物逐字一致（不是自造的写法）', () => {
    const canonical = JSON.parse(
      readFileSync(new URL('../../src/data/modelCanonical.json', import.meta.url), 'utf8'),
    ) as { canonicalModels: Array<{ canonicalId: string; officialName: string; officialModelIds?: string[] }> };
    const byOfficialId = new Map(canonical.canonicalModels.flatMap(
      (m) => (m.officialModelIds ?? []).map((id) => [id, m] as const),
    ));
    /* 官方产物 vendor-pkg-canvas-CvbAwZyy.js charIdx 92417：display_name:"Gemini 3.8 Flash" */
    expect(byOfficialId.get('gemini-3.8-flash')?.officialName).toBe('Gemini 3.8 Flash');
    /* 官方 textModels.name.gemini35Flash（vendor-packages-DRvCmDjR.js zh charIdx 584163） */
    expect(byOfficialId.get('gemini-3.5-flash')?.officialName).toBe('Gemini 3.5 Flash');
    /* 官方 textModels.name.gemini31Pro（vendor-packages-DRvCmDjR.js zh charIdx 584036） */
    expect(byOfficialId.get('gemini-3.1-pro')?.officialName).toBe('Gemini 3.1 Pro');
  });
});

describe('② 官方没有的模型 ⇒ 显示原始 id（不美化、不猜）', () => {
  it('glm-4.6v / glm-4.6v-flash 原样显示（官方产物里没有 GLM 任何条目）', () => {
    expect(listNameOf('glm-4.6v')).toBe('glm-4.6v');
    expect(listNameOf('glm-4.6v-flash')).toBe('glm-4.6v-flash');
    /* 不许自创大小写/空格：不做 `GLM-4.6V`、`GLM 4.6V Flash` 这种"美化" */
    expect(listNameOf('glm-4.6v')).not.toBe('GLM-4.6V');
    expect(listNameOf('glm-4.6v-flash')).not.toBe('GLM-4.6V Flash');
    expect(normalizedModelOf({ providerId: 'tudou', providerModelId: 'glm-4.6v' }).matchStatus).toBe('unverified');
  });

  it('「官方没名」这件事在映射表里**登记**了（source 写明依据，且不带 canonicalId）', () => {
    const { mappings } = readTudouMapping();
    for (const id of ['glm-4.6v', 'glm-4.6v-flash']) {
      const row = mappings.find((m) => m.providerModelId === id);
      expect(row, id).toBeTruthy();
      expect(row?.canonicalId, id).toBeUndefined();
      expect(row?.matchStatus, id).toBe('unverified');
      expect(row?.source, id).toContain('官方无此模型');
    }
  });

  it('完全没有映射的模型同样原样退回（兜底不猜）', () => {
    expect(listNameOf('zzz-mystery-model')).toBe('zzz-mystery-model');
  });
});

describe('③ 「逐模型手动价」的 modelId 是计价键，不参与显示名', () => {
  const billing = (modelId: string): ProviderBillingConfig => ({
    modelOverrides: [{ modelId, unitPrice: 0.5, variants: { 'low|1k': 0.04 } }],
  });

  it('填了手动价的 modelId ⇒ 只影响取价，显示名一个字都不变', () => {
    /* 计价侧：按上游 id 命中（含档位明细优先） */
    expect(lookupOverrideUnitPrice(billing('gemini-3.1-pro-preview'), {
      modelId: 'gemini-3.1-pro-preview', quality: 'low', resolution: '1k',
    })).toBe(0.04);
    expect(lookupOverrideUnitPrice(billing('gemini-3.1-pro-preview'), {
      modelId: 'gemini-3.1-pro-preview', quality: 'high', resolution: '4k',
    })).toBe(0.5);
    /* 显示侧：仍然只有官方名这一个出口，计价配置根本不是它的入参 */
    expect(listNameOf('gemini-3.1-pro-preview')).toBe('Gemini 3.1 Pro');
  });

  it('把**显示名**填进那个字段不会命中（证明它是匹配键，不是名字）', () => {
    expect(lookupOverrideUnitPrice(billing('Gemini 3.1 Pro'), {
      modelId: 'gemini-3.1-pro-preview', quality: 'low', resolution: '1k',
    })).toBeNull();
    /* 而且显示名不会因为用户在那格里打什么而改变 */
    expect(listNameOf('gemini-3.1-pro-preview')).toBe('Gemini 3.1 Pro');
  });

  it('结构上分家：展示名出口不引入任何计费类型/函数', () => {
    const display = readFileSync(new URL('../../src/services/models/display.ts', import.meta.url), 'utf8');
    expect(display).not.toMatch(/creditEstimate|ProviderBillingConfig|modelOverrides/);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * ④ 第 88 轮：把「官方有 displayName、MTV Registry 缺条目」的一批补齐。
 *    口径同 ①：官方名逐字（带 charIdx 出处写在 canonical 的 source 里），
 *    官方没有字面名的（qwen*）**不许造**，继续显示原始 id。
 * ──────────────────────────────────────────────────────────────────────────── */

/** 官方有 displayName、本轮补进 Registry 的（id → 官方名逐字）。 */
const OFFICIAL_NAMED_ADDITIONS: Array<[string, string]> = [
  /* 官方 chatAdapter.modelOptions.labels.* —— vendor-pkg-canvas-CvbAwZyy.js */
  ['gpt-5.5', 'GPT-5.5'],                       // labels.gpt55        zh 4305910
  ['gemini-3.7-flash', 'Gemini 3.7 Flash'],     // labels.gemini37     zh 4305560
  ['claude-sonnet-5', 'Sonnet 5'],              // labels.sonnet5      zh 4305539
  ['claude-sonnet-4-6', 'Sonnet 4.6'],          // labels.sonnet46     zh 4305928
  ['claude-opus-5-5', 'Opus 5.5'],              // labels.opus55       zh 4305952
  ['claude-opus-4-8', 'Opus 4.8'],              // labels.opus48       zh 4306009
  ['claude-opus-4-7', 'Opus 4.7'],              // labels.opus47       zh 4305989
  ['claude-opus-4-6', 'Opus 4.6'],              // labels.opus46       zh 4306029
  ['gpt-6-sol', 'GPT 6 Sol'],                   // labels.gpt6Sol      zh 4305777（官方空格写法，不美化）
  ['gpt-6-luna', 'GPT 6 Luna'],                 // labels.gpt6Luna     zh 4305799
  ['deepseek-flash', 'Deepseek V4.1 Flash'],    // labels.deepseekFlash zh 4305501 + Dbe/pD 硬编码
  /* 官方 textModels 注册表 —— vendor-packages-DRvCmDjR.js */
  ['anthropic.claude-fable-5-1', 'Claude Fable 5.1'],  // textModels.name.claudeFable51，zh 527093
  ['claude-fable-5-1', 'Claude Fable 5.1'],
  ['claude-fable-5', 'Claude Fable 5'],               // 追加到既有 anthropic/claude-fable-5
  ['claude-opus-5', 'Claude Opus 5'],                 // 追加到既有 anthropic/claude-opus-5
  /* 官方 info.models.<key>.version —— vendor-pkg-canvas-CvbAwZyy.js */
  ['kimi-k2.7-code', 'Kimi 2.7'],               // info.models.kimi27.version zh 4306401
  ['kimi-k2.6', 'Kimi 2.6'],                    // info.models.kimi26.version zh 4307721
];

/** 官方产物里**确实没有**的（保持原始 id，已在 tudou.json 登记为 unverified）。 */
const NO_OFFICIAL_NAME: string[] = [
  'glm-4.6v', 'glm-4.6v-flash', 'glm-5.3', 'glm-5.3-flash', 'grok-4.5',
  'minimax-h3-2k', 'wan3.0', 'wan3.0-fast', 'gpt-image-2-pro', 'gemini-nano-banana-2.1',
];

describe('④ 官方有名 / Registry 缺条目 —— 补齐后的逐条钉死', () => {
  it('每条补齐都能查到官方名（对任意平台都成立：canonical 是全局身份表）', () => {
    for (const [id, officialName] of OFFICIAL_NAMED_ADDITIONS) {
      expect(displayNameOfModelRef(`tudou/${id}`), id).toBe(officialName);
      /* 换个平台同样命中 —— 说明补的是身份表，不是某个平台的表 */
      expect(displayNameOfModelRef(`cccapi/${id}`), id).toBe(officialName);
      expect(displayNameOfModelRef(`tudou/${id}`), id).not.toBe(id);
    }
  });

  it('原有手写策划名让位给官方名（cccapi/grsai 的 GPT-5.5）', () => {
    expect(displayNameOfModelRef('cccapi/gpt-5.5')).toBe('GPT-5.5');
    expect(displayNameOfModelRef('grsai/gpt-5.5')).toBe('GPT-5.5');
    expect(displayNameOfModelRef('general/cfg', {
      generalModels: [{ id: 'cfg', modelId: 'gpt-5.5', providerConfigId: CONNECTION_KEY }],
      providers: PROVIDERS,
    })).toBe('GPT-5.5');
  });

  it('2026-10-15 二次裁决：apimart 的 Claude 两条**依据成立 ⇒ 保留绑定**，标 unverified 但仍显示官方名', () => {
    /* 用户裁决「tapnow 官方的不要了，以 apimart 表为准」后，apimart 官方清单里确实没有 Claude
       （该清单只有 image 43 + token 4 段）。但**依据成立**：providerModelId 与 canonical
       `officialModelIds` 逐字相等 ⇒ 按裁决①保留 canonicalId、标 unverified。
       `unverified` 只表示「不在官方清单」，不表示没有身份。 */
    expect(displayNameOfModelRef('apimart/claude-opus-4-7')).toBe('Opus 4.7');
    expect(displayNameOfModelRef('apimart/claude-opus-4-7')).not.toBe('claude-opus-4-7');
    expect(displayNameOfModelRef('apimart/claude-sonnet-4-6')).toBe('Sonnet 4.6');
    const canonical = JSON.parse(
      readFileSync(new URL('../../src/data/modelCanonical.json', import.meta.url), 'utf8'),
    ) as { canonicalModels: Array<{ canonicalId: string }> };
    const ids = canonical.canonicalModels.map((m) => m.canonicalId);
    expect(ids).toContain('anthropic/claude-opus-4-7');
    expect(ids).toContain('anthropic/claude-sonnet-4-6');
  });

  it('策划名覆盖层必须让位：带 canonicalId 的映射行不许再带 displayNameOverride', () => {
    for (const file of ['apimart.json', 'cccapi.json', 'grsai.json', 'tudou.json']) {
      const parsed = JSON.parse(
        readFileSync(new URL(`../../src/data/modelMappings/${file}`, import.meta.url), 'utf8'),
      ) as { mappings: Array<{ providerModelId: string; canonicalId?: string; displayNameOverride?: string; matchStatus: string; source?: string }> };
      for (const m of parsed.mappings) {
        if (m.canonicalId) expect(m.displayNameOverride, `${file}/${m.providerModelId}`).toBeUndefined();
        if (m.matchStatus === 'verified') expect(m.source, `${file}/${m.providerModelId}`).toBeTruthy();
      }
    }
  });

  it('正式字面名只认官方清单：apimart 清单新增了 qwen 条目，但 tudou 的 qwen3.7/3.6 仍不在任何官方清单里', () => {
    /* 官方 `vK()` 会由 id 算出「Qwen 3.7」，但官方**没有任何字面量** ⇒ 按铁律不做格式化规则，保持原始 id */
    expect(displayNameOfModelRef('tudou/qwen3.7-plus')).toBe('qwen3.7-plus');
    expect(displayNameOfModelRef('tudou/qwen3.6-plus')).toBe('qwen3.6-plus');
    const canonical = JSON.parse(
      readFileSync(new URL('../../src/data/modelCanonical.json', import.meta.url), 'utf8'),
    ) as { canonicalModels: Array<{ canonicalId: string; officialModelIds?: string[] }> };
    const allIds = canonical.canonicalModels.flatMap((m) => m.officialModelIds ?? []);
    /* 2026-10-15：apimart 官方清单新增了 3 条 qwen（qwen-image-2.0 / 3.0 / 3.0-pro）⇒ Registry 里有 qwen 了；
       但 tudou 那两条 `qwen3.7-plus` / `qwen3.6-plus` **不在**任何官方清单里 ⇒ 仍不补名。 */
    expect(allIds.some((id) => /qwen/i.test(id))).toBe(true);
    expect(allIds.some((id) => /qwen3\.[67]/i.test(id))).toBe(false);
  });

  it('官方没有的第三方模型仍原样显示（本轮只登记、不改名）', () => {
    for (const id of NO_OFFICIAL_NAME) {
      expect(displayNameOfModelRef(`tudou/${id}`), id).toBe(id);
    }
    /* 登记行必须在 tudou.json 里，且不带 canonicalId */
    const { mappings } = readTudouMapping();
    for (const id of NO_OFFICIAL_NAME) {
      const row = mappings.find((m) => m.providerModelId === id);
      expect(row, id).toBeTruthy();
      expect(row?.canonicalId, id).toBeUndefined();
      expect(row?.matchStatus, id).toBe('unverified');
      expect(row?.source, id).toContain('官方无此模型');
    }
  });

  it('补齐条目的 officialModelIds 全局唯一，且每条都写了出处（source 里带 charIdx）', () => {
    const canonical = JSON.parse(
      readFileSync(new URL('../../src/data/modelCanonical.json', import.meta.url), 'utf8'),
    ) as { canonicalModels: Array<{ canonicalId: string; officialModelIds?: string[]; source?: string }> };
    const ids = canonical.canonicalModels.flatMap((m) => m.officialModelIds ?? []);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [id] of OFFICIAL_NAMED_ADDITIONS) {
      const owner = canonical.canonicalModels.find((m) => (m.officialModelIds ?? []).includes(id));
      expect(owner, id).toBeTruthy();
      expect(owner?.source, id).toContain('charIdx');
    }
  });
});
