import { describe, expect, it } from 'vitest';
import {
  buildMediaFacts,
  formatMediaDate,
  formatMediaDuration,
  formatMediaResolution,
} from '../../src/utils/mediaViewerFacts';

/**
 * 官方依据：`tbe` @438982（zoom-slider-3ZcFvYQO.js）
 *   字段顺序：分辨率 → 模型（有值才加）→ 日期 → 时长（仅视频）
 *   行过滤：`f.filter(g => g.loading || !!g.value)`
 *   `resolution = "{w} × {h}"`（乘号 U+00D7）· `dateCreated = new Date(v).toLocaleDateString()`
 *   `duration = "{m}:{ss}"`（`Math.floor(t/60)` + 秒补零，`t = Math.round(秒)`）
 */
const LABELS = { resolution: '分辨率', model: '模型', dateCreated: '日期', duration: '时长' };

describe('official media viewer facts (tbe)', () => {
  it('formats resolution with the official multiplication sign', () => {
    expect(formatMediaResolution(1024, 768)).toBe('1024 × 768');
    expect(formatMediaResolution(1024, undefined)).toBeUndefined();
    expect(formatMediaResolution(undefined, 768)).toBeUndefined();
  });

  it('formats duration as m:ss (rounded seconds)', () => {
    expect(formatMediaDuration(0)).toBeUndefined();
    expect(formatMediaDuration(9)).toBe('0:09');
    expect(formatMediaDuration(75)).toBe('1:15');
    expect(formatMediaDuration(125.4)).toBe('2:05');
  });

  it('formats the created date via toLocaleDateString', () => {
    const timestamp = Date.UTC(2026, 0, 2, 3, 4, 5);
    expect(formatMediaDate(timestamp)).toBe(new Date(timestamp).toLocaleDateString());
    expect(formatMediaDate(undefined)).toBeUndefined();
  });

  it('keeps the official field order and drops empty rows', () => {
    const facts = buildMediaFacts(
      { mediaType: 'image', width: 512, height: 512, model: '  gpt-image-1  ', createdAt: 1_700_000_000_000 },
      LABELS,
    );
    expect(facts.map((fact) => fact.label)).toEqual(['分辨率', '模型', '日期']);
    expect(facts[1].value).toBe('gpt-image-1'); // trim
  });

  it('omits the model row when the model is blank', () => {
    const facts = buildMediaFacts({ mediaType: 'image', width: 512, height: 512, model: '   ' }, LABELS);
    expect(facts.map((fact) => fact.label)).toEqual(['分辨率']);
  });

  it('adds the duration row only for videos', () => {
    const image = buildMediaFacts({ mediaType: 'image', width: 10, height: 10, durationSeconds: 42 }, LABELS);
    expect(image.some((fact) => fact.label === '时长')).toBe(false);

    const video = buildMediaFacts({ mediaType: 'video', width: 10, height: 10, durationSeconds: 42 }, LABELS);
    expect(video.map((fact) => fact.label)).toEqual(['分辨率', '时长']);
    expect(video[1].value).toBe('0:42');
  });

  it('returns an empty list when nothing is known (component then renders null)', () => {
    expect(buildMediaFacts({ mediaType: 'image' }, LABELS)).toEqual([]);
  });

  it('marks pending rows as loading so the skeleton can render', () => {
    const facts = buildMediaFacts({ mediaType: 'image', loading: true }, LABELS);
    expect(facts.map((fact) => fact.label)).toEqual(['分辨率', '日期']);
    expect(facts.every((fact) => fact.loading)).toBe(true);
  });
});
