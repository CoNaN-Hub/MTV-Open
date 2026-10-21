/**
 * 用户真实的第三方模型 → 展示名（原来叫 `upstreamModelIdOverride.test.ts`）。
 *
 * 背景（Tauri 9333 实测，用户的自定义连接「土豆」7 条图片配置）：
 *   `gpt-image-2-all` 与 `gpt-image-2-pro` 都映射到官方同一个 `gpt-image-2`
 *   ⇒ 只按官方表取名会出现**两条一模一样的行**（用户报的原始问题）。
 *
 * ★ 2026 改：这个问题的解法从「在能力表里猜前缀」换成了**映射配置**：
 *   · 名字 → `services/models/display`（映射配置 → 官方 Registry → 原始调用 id）
 *   · 变体（`-all` / `-pro` / `-async`）→ `src/data/modelMappings/tudou.json` 显式登记
 *   旧的 `upstreamModelIdOverride` / `VARIANT_DISPLAY` / `officialCardMeta().displayName`
 *   已按用户要求删除（属于「凭 id 猜官方名」）。
 */
import { describe, expect, it } from 'vitest';

import { displayNameOfModelRef, normalizedModelOf } from '../../src/services/models/display';

/** 土豆连接的形状：连接 key 是随机串，靠 baseUrl 认出平台 */
const TUDOU = { connectionKey: 'custom-openai-2611fc0a', baseUrl: 'https://api.ai-tudou.net/v1', catalogId: 'custom-openai' };

/** 用户现场那 7 条图片配置的上游 modelId（顺序与下拉一致）*/
const USER_MODEL_IDS = [
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gpt-image-2-all',
  'gpt-image-2-pro',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-flare-async',
  'gpt-image-2.5-sunburst-high',
];

const nameOf = (id: string) => normalizedModelOf({ providerModelId: id, connection: TUDOU }).displayName;

describe('土豆连接里那 7 条：展示名两两不同，且调用 id 原样', () => {
  it('逐条期望值（官方名优先；无官方名则保留平台原文）', () => {
    expect(nameOf('gemini-3-pro-image-preview')).toBe('Nano Banana Pro');
    expect(nameOf('gemini-3.1-flash-image-preview')).toBe('Nano Banana 2');
    /* 用户定稿：「`gpt-image-2-all` 就写成 `gpt-image-2-all` 吧」⇒ 不做官方名映射，保留原文 ✓ */
    expect(nameOf('gpt-image-2-all')).toBe('gpt-image-2-all');
    expect(nameOf('gpt-image-2-pro')).toBe('gpt-image-2-pro');
    expect(nameOf('gpt-image-2.5-flare')).toBe('GPT Image 2.5 Flare');
    /* ★ 新规：displayName = 官方名 + ' ' + 平台规格后缀（后缀保留、不翻译）*/
    expect(nameOf('gpt-image-2.5-flare-async')).toBe('GPT Image 2.5 Flare async');
    /* 官方表里没有 `-high` 这个变体 ⇒ 不编名字，保留原文 */
    expect(nameOf('gpt-image-2.5-sunburst-high')).toBe('gpt-image-2.5-sunburst-high');
  });

  it('7 条显示名**两两不同**（不会再出现两条一模一样的行）', () => {
    const names = USER_MODEL_IDS.map(nameOf);
    expect(new Set(names).size).toBe(USER_MODEL_IDS.length);
  });

  it('出站调用 id 一律是上游原文（含 `-async`），与展示名是两个字段', () => {
    for (const id of USER_MODEL_IDS) {
      const model = normalizedModelOf({ providerModelId: id, connection: TUDOU });
      expect(model.providerModelId, id).toBe(id);
      expect(model.providerId).toBe('tudou');
    }
  });

  it('同步与异步是两条独立模型（同一 canonicalId，不同调用 id / 展示名）', () => {
    const sync = normalizedModelOf({ providerModelId: 'gemini-3-pro-image-preview', connection: TUDOU });
    const async = normalizedModelOf({ providerModelId: 'gemini-3-pro-image-preview-async', connection: TUDOU });
    expect(sync.canonicalId).toBe('google/banana-pro');
    expect(async.canonicalId).toBe('google/banana-pro');
    expect(sync.executionMode).toBe('sync');
    expect(async.executionMode).toBe('async');
    expect(sync.displayName).toBe('Nano Banana Pro');
    expect(async.displayName).toBe('Nano Banana Pro async');
    expect(sync.providerModelId).not.toBe(async.providerModelId);
  });

  it('展示名里不出现任何平台前缀（界面只显示它）', () => {
    for (const id of USER_MODEL_IDS) {
      expect(nameOf(id), id).not.toMatch(/^(apimart|grsai|tudou|general|custom-openai)\//);
    }
  });

  it('`displayNameOfModelRef` 走同一条链路（节点上存的是 `provider/modelId`）', () => {
    expect(displayNameOfModelRef('tudou/gpt-image-2.5-flare-async')).toBe('GPT Image 2.5 Flare async');
    expect(displayNameOfModelRef('tudou/gemini-3-pro-image-preview')).toBe('Nano Banana Pro');
  });
});

describe('同一个上游 id 换平台 ⇒ 各按各的映射表', () => {
  it('每个平台用自己的表（同 id 可以有不同的平台侧名字）', () => {
    /* 官方身份只有土豆登记过 ⇒ 土豆显示官方名 */
    expect(normalizedModelOf({ providerId: 'tudou', providerModelId: 'gemini-3-pro-image-preview' }).displayName)
      .toBe('Nano Banana Pro');
    /* apimart 表里这条现在按「官方 name 逐字命中 canonical officialName」绑到 google/banana-pro，
       标 verified；展示名同样是官方名 Nano Banana Pro。 */
    const onApimart = normalizedModelOf({ providerId: 'apimart', providerModelId: 'gemini-3-pro-image-preview' });
    expect(onApimart.displayName).toBe('Nano Banana Pro');
    expect(onApimart.matchStatus).toBe('verified');
    /* ★ 关键：无论哪个平台，**出站调用 id 都是上游原文** */
    expect(onApimart.providerModelId).toBe('gemini-3-pro-image-preview');
  });

  it('没有任何表登记过的平台 ⇒ 保留原始 id，不借用别家的名字', () => {
    const onUnknown = normalizedModelOf({ providerId: 'brand-new-relay', providerModelId: 'gemini-3-pro-image-preview' });
    expect(onUnknown.displayName).toBe('gemini-3-pro-image-preview');
    expect(onUnknown.matchStatus).toBe('unverified');
  });
});
