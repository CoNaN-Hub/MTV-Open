import { describe, expect, it } from 'vitest';
import {
  buildMediaHistoryVersions,
  mediaHistoryThumbnail,
  shouldShowMediaHistory,
} from '../../src/utils/mediaViewerHistory';

/**
 * 官方依据：`Obe` @472356（zoom-slider-3ZcFvYQO.js）
 *   · `e.length <= 1 ? null`（资源 ≤1 条时整列不存在，也没有空态文案）
 *   · 缩略图 `Fbe(r) = r.thumbnailSrc || hs(r.src, "thumbnail") || r.src`
 *   · 顺序 `pxe`：`[打开时的媒体, ...其余]` ⇒ 入口媒体钉在第 0 位，不因选中而上浮
 */
describe('official media viewer history column (Obe)', () => {
  it('never renders for a single version', () => {
    expect(shouldShowMediaHistory(0)).toBe(false);
    expect(shouldShowMediaHistory(1)).toBe(false);
    expect(shouldShowMediaHistory(2)).toBe(true);
  });

  it('falls back to the original media when no thumbnail exists', () => {
    expect(mediaHistoryThumbnail({ src: 'a.png' })).toBe('a.png');
    expect(mediaHistoryThumbnail({ src: 'a.png', thumbnailSrc: 'thumb.png' })).toBe('thumb.png');
  });

  it('pins the entry media at index 0 and keeps the remaining order', () => {
    const versions = buildMediaHistoryVersions('entry.png', [
      { src: 'older.png' },
      { src: 'entry.png', thumbnailSrc: 'entry-thumb.png' },
      { src: 'newer.png' },
    ]);
    expect(versions.map((version) => version.src)).toEqual(['entry.png', 'older.png', 'newer.png']);
    /* 入口项的缩略图仍然取自原列表 */
    expect(versions[0].thumbnailSrc).toBe('entry-thumb.png');
  });

  it('deduplicates and drops empty sources', () => {
    const versions = buildMediaHistoryVersions('entry.png', [
      { src: '' },
      { src: 'entry.png' },
      { src: 'a.png' },
      { src: 'a.png' },
    ]);
    expect(versions.map((version) => version.src)).toEqual(['entry.png', 'a.png']);
  });

  it('works when the entry media is not part of the list', () => {
    expect(buildMediaHistoryVersions('entry.png', []).map((version) => version.src)).toEqual(['entry.png']);
  });
});
