import { describe, expect, it } from 'vitest';
import {
  channelParamLimitsFor,
  isChannelDisabled,
} from '../../src/services/models/channelParamLimits';

/**
 * 土豆异步生图（免费池渠道）的参数限制 —— 依据是 2026-10-20 用真实 key 的逐参数实测：
 *   · `resolution=1k|2k` + `quality=low|medium` ⇒ 200 `submitted`
 *   · `resolution=4k` 或 `quality=high` ⇒ `409 {"code":"free_pool_param_mismatch",
 *     "message":"Unsupported parameters for this channel; switching automatically."}`
 */
describe('channel parameter limits', () => {
  it('flags tudou async image models (upstream name, prefixed ref, or general config id)', () => {
    expect(channelParamLimitsFor(['gpt-image-2.5-flare-async'])).not.toBeNull();
    expect(channelParamLimitsFor(['tudou/gpt-image-2.5-flare-async'])).not.toBeNull();
    expect(channelParamLimitsFor([undefined, 'gpt-image-2-all'])).not.toBeNull();
    expect(channelParamLimitsFor(['general/abc', 'GPT-IMAGE-2.5-SUNBURST-ASYNC'])).not.toBeNull();
  });

  it('leaves unrelated models and the sync endpoint alone', () => {
    // 同步端点收的是像素 `size`，没有 `resolution` 档位 ⇒ 不受免费池这条限制
    expect(channelParamLimitsFor(['gpt-image-2.5-flare'])).toBeNull();
    expect(channelParamLimitsFor(['tudou/gpt-image-2.5-flare'])).toBeNull();
    expect(channelParamLimitsFor(['gemini-3-pro-image-preview'])).toBeNull();
    expect(channelParamLimitsFor(['gpt-image-2-pro'])).toBeNull();
    expect(channelParamLimitsFor([])).toBeNull();
  });

  it('disables 4K and the top quality tiers, with usable fallbacks', () => {
    const limits = channelParamLimitsFor(['gpt-image-2.5-flare-async'])!;
    expect(limits.disabledImageSizes).toEqual(['4K']);
    expect(limits.disabledQualities).toEqual(['high', 'xhigh', 'max']);
    expect(isChannelDisabled(limits.disabledImageSizes, '4k')).toBe(true);
    expect(isChannelDisabled(limits.disabledImageSizes, '2K')).toBe(false);
    expect(isChannelDisabled(limits.disabledQualities, 'HIGH')).toBe(true);
    expect(isChannelDisabled(limits.disabledQualities, 'medium')).toBe(false);
    // 收敛目标本身必须是渠道能收的（否则收敛完还是 409）
    expect(isChannelDisabled(limits.disabledImageSizes, limits.fallbackImageSize)).toBe(false);
    expect(isChannelDisabled(limits.disabledQualities, limits.fallbackQuality)).toBe(false);
  });
});
