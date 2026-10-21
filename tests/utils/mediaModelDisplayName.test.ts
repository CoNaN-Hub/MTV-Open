import { describe, expect, it } from 'vitest';

import { resolveMediaModelDisplayName } from '../../src/utils/mediaModelDisplayName';
import type { GeneralModelConfig } from '../../src/types';

/**
 * 官方 `fye(model, t)` @443097 的 MTV 实现（`utils/mediaModelDisplayName.ts`）：
 * ```js
 * function fye(e, t) { const n = e?.trim(); if (!n) return; const s = q3(n); return s ? t(s) : n }
 * ```
 * ⇒ 1) 空 ⇒ `undefined`（调用方整条不渲染）；2) 查表命中 ⇒ 可读名；3) 查不到 ⇒ 原文。
 * 自定义连接 `general/<id>` 的 value 里没有官方模型名 ⇒ 必须靠 `cfg.modelId` / 剥过前缀的 `cfg.name`。
 */
function generalModel(overrides: Partial<GeneralModelConfig> = {}): GeneralModelConfig {
  return {
    id: 'provider-custom-abc',
    name: '土豆我的图片模型',
    modelId: 'gpt-image-1',
    category: 'image',
    providerConfigId: 'p1',
    ...overrides,
  };
}

describe('resolveMediaModelDisplayName — 官方 fye 口径', () => {
  it('空 / 纯空白 ⇒ undefined（整条「模型」不渲染）', () => {
    expect(resolveMediaModelDisplayName({ modelId: undefined, family: 'image' })).toBeUndefined();
    expect(resolveMediaModelDisplayName({ modelId: '   ', family: 'image' })).toBeUndefined();
  });

  it('官方模型 id ⇒ 换成可读名（不走原文）', () => {
    const name = resolveMediaModelDisplayName({ modelId: 'gpt-image-1', family: 'image' });
    expect(name).toBe('GPT Image');
  });

  it('查不到 ⇒ 回落原文（官方 `: n`）', () => {
    expect(resolveMediaModelDisplayName({ modelId: 'totally-unknown-model', family: 'image' }))
      .toBe('totally-unknown-model');
  });

  it('family 为 null 时也回落原文（不炸）', () => {
    expect(resolveMediaModelDisplayName({ modelId: 'totally-unknown-model', family: null }))
      .toBe('totally-unknown-model');
  });

  it('自定义连接 `general/<id>` ⇒ 用 cfg.modelId 查表', () => {
    const name = resolveMediaModelDisplayName({
      modelId: 'general/provider-custom-abc',
      family: 'image',
      generalModels: [generalModel()],
      providers: { p1: { name: '土豆' } },
    });
    expect(name).toBe('GPT Image');
  });

  it('自定义连接缺连接名时仍能靠 cfg.modelId 命中', () => {
    const name = resolveMediaModelDisplayName({
      modelId: 'general/provider-custom-abc',
      family: 'image',
      generalModels: [generalModel()],
    });
    expect(name).toBe('GPT Image');
  });

  it('自定义连接且官方表也不认 ⇒ 回落**剥掉连接名前缀**的可读名', () => {
    const name = resolveMediaModelDisplayName({
      modelId: 'general/provider-custom-abc',
      family: 'image',
      generalModels: [generalModel({ name: '土豆zzz-unknown-model', modelId: 'zzz-unknown-model' })],
      providers: { p1: { name: '土豆' } },
    });
    expect(name).toBe('zzz-unknown-model');
  });

  it('自定义连接整条都查不到 ⇒ 至少回落原文，不返回空', () => {
    const name = resolveMediaModelDisplayName({
      modelId: 'general/provider-custom-abc',
      family: 'image',
      generalModels: [],
    });
    expect(name).toBe('general/provider-custom-abc');
  });
});
