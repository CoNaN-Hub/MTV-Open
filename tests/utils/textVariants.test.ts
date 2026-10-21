import { describe, expect, it } from 'vitest';
import {
  TEXT_MAX_VARIANTS,
  TEXT_TIMES_OPTIONS,
  resolveTextTimes,
} from '../../src/utils/textVariants';

/**
 * 官方依据（`zoom-slider-3ZcFvYQO.js`）：
 *   · 文本卡 `zee`(@3378851) 传给 `mx` 的 `timesOptions:[1,2,3,4].slice(0, timesLimit || Jrt)`，
 *     `Jrt = 4`(@3378845)；生成文本节点 `Uee`(@3388353) 调 `zee` 时不传 `timesLimit`
 *     ⇒ 文本卡实际就是 **[1,2,3,4]**。
 *   · times 存在节点 `params.times`，取值链 `currentCount: s?.params?.times || 1`（@3162712 / @3271391）。
 */
describe('official text card generation count (times)', () => {
  it('exposes the official [1,2,3,4] options', () => {
    expect([...TEXT_TIMES_OPTIONS]).toEqual([1, 2, 3, 4]);
    expect(TEXT_MAX_VARIANTS).toBe(4);
  });

  it('falls back to 1 for missing / invalid values (official `params.times || 1`)', () => {
    expect(resolveTextTimes(undefined)).toBe(1);
    expect(resolveTextTimes(null)).toBe(1);
    expect(resolveTextTimes('')).toBe(1);
    expect(resolveTextTimes('abc')).toBe(1);
    expect(resolveTextTimes(Number.NaN)).toBe(1);
    expect(resolveTextTimes(0)).toBe(1);
    expect(resolveTextTimes(-3)).toBe(1);
  });

  it('keeps valid counts and floors fractions', () => {
    expect(resolveTextTimes(1)).toBe(1);
    expect(resolveTextTimes(3)).toBe(3);
    expect(resolveTextTimes('2')).toBe(2);
    expect(resolveTextTimes(2.7)).toBe(2);
  });

  it('clamps to the official 4-variant ceiling', () => {
    expect(resolveTextTimes(4)).toBe(4);
    expect(resolveTextTimes(5)).toBe(4);
    /* 图卡上限是 8 ⇒ 文本卡必须自己收敛到 4 */
    expect(resolveTextTimes(8)).toBe(4);
  });
});
