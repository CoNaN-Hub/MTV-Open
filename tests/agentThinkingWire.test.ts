/**
 * 官方「思考档位 → 请求参数」的回归测试
 * （`course-api-base-url-CyloymxZ.js`@1204075 的 `wx` / `aF` / `v9` / `x9` / `$B` / `La`）。
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THINKING_WIRE_FIELD,
  THINKING_LEVEL_ENUM,
  THINKING_WIRE_FIELDS,
  applyThinkingLevelToParams,
  formatThinkingLevelValue,
  resolveThinkingWireField,
  thinkingLevelLabel,
  validateThinkingLevel,
} from '../src/services/chat/modelThinking';
import type { ModelThinkingMeta } from '../src/types/chat';

const deepseek: ModelThinkingMeta = {
  levels: ['OFF', 'MEDIUM', 'HIGH'],
  default: { level: 'MEDIUM' },
  wireField: 'thinking_level',
  wireCase: 'upper',
  labels: {
    OFF: 'textModels.thinkingLevel.deepseekOff',
    MEDIUM: 'textModels.thinkingLevel.deepseekFast',
    HIGH: 'textModels.thinkingLevel.deepseekExpert',
  },
};

const gpt56: ModelThinkingMeta = {
  levels: ['LOW', 'MEDIUM', 'HIGH'],
  default: { level: 'LOW' },
  wireField: 'reasoning_effort',
  wireCase: 'lower',
};

describe('modelThinking 请求侧（官方 wx/aF/v9/x9/$B）', () => {
  it('La 枚举与默认字段名与官方一致', () => {
    expect(THINKING_LEVEL_ENUM).toEqual({ OFF: 'OFF', LIGHT: 'LOW', STANDARD: 'MEDIUM', HEAVY: 'HIGH' });
    expect(THINKING_WIRE_FIELDS).toEqual(['thinking_level', 'reasoning_effort']);
    expect(DEFAULT_THINKING_WIRE_FIELD).toBe('thinking_level');
  });

  it('resolveThinkingWireField：未配置 ⇒ thinking_level', () => {
    expect(resolveThinkingWireField(deepseek)).toBe('thinking_level');
    expect(resolveThinkingWireField(gpt56)).toBe('reasoning_effort');
    expect(resolveThinkingWireField(undefined)).toBe('thinking_level');
  });

  it('formatThinkingLevelValue：大小写按 wireCase，未配置 ⇒ 大写', () => {
    expect(formatThinkingLevelValue('medium', deepseek)).toBe('MEDIUM');
    expect(formatThinkingLevelValue('MEDIUM', gpt56)).toBe('medium');
    expect(formatThinkingLevelValue('low', undefined)).toBe('LOW');
  });

  it('validateThinkingLevel：大小写不敏感命中目录里的原始写法', () => {
    expect(validateThinkingLevel('high', deepseek)).toBe('HIGH');
    expect(validateThinkingLevel('  medium ', deepseek)).toBe('MEDIUM');
    expect(validateThinkingLevel('nope', deepseek)).toBeUndefined();
    expect(validateThinkingLevel('', deepseek)).toBeUndefined();
    expect(validateThinkingLevel('HIGH', undefined)).toBeUndefined();
  });

  it('applyThinkingLevelToParams：先清掉两个旧字段，再按模型目录写默认档', () => {
    const base = { prompt: 'hi', thinking_level: 'HIGH', reasoning_effort: 'high' };
    expect(applyThinkingLevelToParams(base, deepseek)).toEqual({ prompt: 'hi', thinking_level: 'MEDIUM' });
    expect(applyThinkingLevelToParams(base, gpt56)).toEqual({ prompt: 'hi', reasoning_effort: 'low' });
    /* 不带 thinking 元数据 ⇒ 只清字段，不写值 */
    expect(applyThinkingLevelToParams(base, undefined)).toEqual({ prompt: 'hi' });
    /* 不改原对象 */
    expect(base.thinking_level).toBe('HIGH');
  });

  it('thinkingLevelLabel：官方 off/light/standard/heavy 四语都是英文；deepseek 三条按语言本地化', () => {
    expect(thinkingLevelLabel('OFF', undefined, 'zh-CN')).toBe('Off');
    expect(thinkingLevelLabel('LOW', undefined, 'ja-JP')).toBe('Light');
    expect(thinkingLevelLabel('MEDIUM', undefined, 'ko-KR')).toBe('Standard');
    expect(thinkingLevelLabel('HIGH', undefined, 'en-US')).toBe('Heavy');
    expect(thinkingLevelLabel('OFF', deepseek, 'zh-CN')).toBe('关闭');
    expect(thinkingLevelLabel('HIGH', deepseek, 'zh-CN')).toBe('专家');
    expect(thinkingLevelLabel('MEDIUM', deepseek, 'ko-KR')).toBe('빠름');
    /* 未知档位原样返回 */
    expect(thinkingLevelLabel('WEIRD', undefined, 'zh-CN')).toBe('WEIRD');
  });
});
