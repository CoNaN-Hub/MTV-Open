import { describe, it, expect } from 'vitest';
import { normalizeMultiAngleParams, buildMultiAngleRequest, multiAnglePrompt, MULTI_ANGLE_DEFAULTS } from '../../src/services/ai/multiAngle';

describe('multiAngle 端点契约（官方逐字）', () => {
  it('默认值 = 官方 sy', () => {
    expect(MULTI_ANGLE_DEFAULTS).toEqual({ rotate_right_left: -30, move_forward: 0, vertical_angle: 0.5, wide_angle_lens: false });
  });
  it('归一化 clamp = 官方 Ent/ZI', () => {
    expect(normalizeMultiAngleParams({ rotate_right_left: -999, move_forward: 99, vertical_angle: 9, wide_angle_lens: true }))
      .toEqual({ rotate_right_left: -90, move_forward: 10, vertical_angle: 1, wide_angle_lens: true });
    expect(normalizeMultiAngleParams(null)).toEqual(MULTI_ANGLE_DEFAULTS);
    expect(normalizeMultiAngleParams({ rotate_right_left: Number.NaN })).toEqual(MULTI_ANGLE_DEFAULTS);
  });
  it('请求体字段官方一致，rotate 取负', () => {
    const req = buildMultiAngleRequest({ rotate_right_left: -30, move_forward: 2, vertical_angle: 0.5, wide_angle_lens: true },
      { imageUrls: ['a.png'], nodeId: 'n1', canvasId: 'c1' });
    expect(req).toEqual({
      image_urls: ['a.png'], rotate_right_left: 30, move_forward: 2, vertical_angle: 0.5, wide_angle_lens: true,
      metadata: { node_id: 'n1', canvas_id: 'c1' },
    });
    expect(multiAnglePrompt(req)).toContain('30 degrees to the left');
    expect(multiAnglePrompt(req)).toContain('22.5 degrees viewing from above');
    expect(multiAnglePrompt(req)).toContain('wide-angle lens');
  });
});