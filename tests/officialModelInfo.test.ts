/**
 * 官方「模型选择器」客户端常量表 + 列表分组的**逐字回归**
 * （`vendor-pkg-canvas-ChpWx5JY.js`：`fye`@58601 / `bs`@46929 / `uye`@46860 / `pye`@46890 /
 *   `mye`@58439 / `hye`@62211 / `gye`@62247 / `Uxe`@48628）。
 *
 * 验证分级：(d) 源码级（逐字常量与函数体对照）。真机读数见 §76 报告。
 */
import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_CAPABILITY_KEYS,
  OFFICIAL_MODEL_INFO,
  OFFICIAL_MODEL_INFO_DESCRIPTIONS,
  OFFICIAL_RECOMMENDED_ORDER,
  groupOfficialModelOptions,
  officialCapabilityEntries,
  officialCapabilityLabel,
  officialModelInfoDescription,
  officialModelKey,
} from '../src/services/chat/officialModelInfo';

describe('官方模型信息表（fye / hye / gye）', () => {
  it('能力字段顺序逐字：speed / intelligence / cost', () => {
    expect([...OFFICIAL_CAPABILITY_KEYS]).toEqual(['speed', 'intelligence', 'cost']);
  });

  it('表规模 29 条 = 28 个模型 key + default（与官方 fye 同集）', () => {
    expect(Object.keys(OFFICIAL_MODEL_INFO)).toHaveLength(29);
    expect(Object.keys(OFFICIAL_MODEL_INFO)).toContain('default');
  });

  it('用户截图里那张卡的数据源逐字：GPT 6 Luna = 速度 5 / 智能 4 / 成本 1', () => {
    expect(OFFICIAL_MODEL_INFO.gpt6Luna.capabilities).toEqual({ speed: 5, intelligence: 4, cost: 1 });
    expect(OFFICIAL_MODEL_INFO.gpt6Luna.description).toBe('Most efficient tier for focused, high-volume tasks.');
  });

  it('gye：只保留 1..5 的整数，顺序固定，缺字段直接跳过', () => {
    expect(officialCapabilityEntries({ description: '', capabilities: { speed: 3, intelligence: 4, cost: 4 } }))
      .toEqual([
        { capability: 'speed', value: 3 },
        { capability: 'intelligence', value: 4 },
        { capability: 'cost', value: 4 },
      ]);
    expect(officialCapabilityEntries({ description: '', capabilities: { speed: 0, cost: 6, intelligence: 2.5 } }))
      .toEqual([]);
    expect(officialCapabilityEntries({ description: '', capabilities: {} })).toEqual([]);
    expect(officialCapabilityEntries(null)).toEqual([]);
  });

  it('三行指标的标签走官方 i18n（成本，不是「花费」）', () => {
    expect(officialCapabilityLabel('cost', 'zh-CN')).toBe('成本');
    expect(officialCapabilityLabel('speed', 'zh-CN')).toBe('速度');
    expect(officialCapabilityLabel('intelligence', 'zh-CN')).toBe('智能');
    expect(officialCapabilityLabel('cost', 'en-US')).toBe('Cost');
  });
});

describe('官方模型 key 推导（uye / pye / mye）', () => {
  it('uye：按 id 直命中的两条 + 未命中回落 default', () => {
    expect(officialModelKey({ id: 'auto', label: 'Auto' })).toBe('auto');
    expect(officialModelKey({ id: 'deepseek-flash', label: 'DeepSeek' })).toBe('deepseekFlash');
    expect(officialModelKey({ id: 'unknown-model-x', label: 'Unknown' })).toBe('default');
  });

  it('pye：`${id} ${label}` 小写包含匹配，needles 顺序即优先级', () => {
    expect(officialModelKey({ id: 'apimart/gpt-6-luna', label: 'GPT-6 Luna' })).toBe('gpt6Luna');
    expect(officialModelKey({ id: 'x', label: 'Gemini 3.8 Flash' })).toBe('gemini38');
    // `gpt-5.5` 在 `gpt-5.6-*` 之后 ⇒ 先命中 5.6 的三支
    expect(officialModelKey({ id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' })).toBe('gpt56Luna');
  });

  it('信息卡简介：i18n 覆盖优先，回落 fye 英文原文', () => {
    const zh = officialModelInfoDescription({ id: 'apimart/gpt-6-luna', label: 'GPT-6 Luna' }, 'zh-CN');
    expect(zh.key).toBe('gpt6Luna');
    expect(zh.description).toBe('最高效的档位，适合聚焦的高频任务。');
    const en = officialModelInfoDescription({ id: 'apimart/gpt-6-luna', label: 'GPT-6 Luna' }, 'en-US');
    expect(en.description).toBe('Most efficient tier for focused, high-volume tasks.');
    // 四语言都齐全
    for (const locale of ['zh-CN', 'en-US', 'ja-JP', 'ko-KR']) {
      expect(OFFICIAL_MODEL_INFO_DESCRIPTIONS[locale].gpt6Luna).toBeTruthy();
    }
  });
});

describe('官方列表分组（Uxe）', () => {
  const m = (id: string, label: string, availability?: string) => ({ id, label, availability });

  it('Auto 进 primary；精选推荐按 Oxe 固定顺序；其余进 other', () => {
    const models = [
      m('auto', 'Auto'),
      m('deepseek-flash', 'DeepSeek V4.1 Flash'),
      m('gpt-6-sol', 'GPT 6 Sol'),
      m('gemini-3.8-flash', 'Gemini 3.8 Flash'),
      m('gpt-6-luna', 'GPT 6 Luna'),
      m('some-other', 'Some Other'),
    ];
    const { recommended, primary, other } = groupOfficialModelOptions(models);
    expect(recommended.map((x) => x.id)).toEqual([
      'gemini-3.8-flash',
      'gpt-6-luna',
      'gpt-6-sol',
      'deepseek-flash',
    ]);
    expect(primary.map((x) => x.id)).toEqual(['auto']);
    expect(other.map((x) => x.id)).toEqual(['some-other']);
    expect([...OFFICIAL_RECOMMENDED_ORDER]).toEqual(['gemini38', 'gpt6luna', 'gpt6sol', 'deepseekFlash']);
  });

  it('Lxe 排除集：comingSoon / gpt-5.6 三档 / opus 5 与 5.5 / fable / kimi 2.7 / 显式 id 集合 ⇒ other', () => {
    const models = [
      m('gpt-5.6-sol', 'GPT 5.6 Sol'),
      m('claude-opus-5-5', 'Opus 5.5'),
      m('claude-opus-5', 'Opus 5'),
      m('claude-fable-5', 'Fable 5'),
      m('kimi-k2.7-code', 'Kimi K2.7 Code'),
      m('claude-opus-4-8', 'Opus 4.8'),
      m('gemini-3.8-flash', 'Gemini 3.8 Flash', 'comingSoon'),
      m('gemini-3.8-flash', 'Gemini 3.8 Flash'),
    ];
    const { recommended, other } = groupOfficialModelOptions(models);
    expect(recommended.map((x) => x.label)).toEqual(['Gemini 3.8 Flash']);
    expect(other).toHaveLength(7);
  });

  it('recommendedModelIds 优先：给了就完全按它取，不再分桶（官方 `if (t)` 分支）', () => {
    const models = [m('a', 'A'), m('b', 'B'), m('auto', 'Auto')];
    const { recommended, primary, other } = groupOfficialModelOptions(models, ['b', 'a']);
    expect(recommended.map((x) => x.id)).toEqual(['b', 'a']);
    expect(primary).toEqual([]);
    expect(other.map((x) => x.id)).toEqual(['auto']);
  });
});
