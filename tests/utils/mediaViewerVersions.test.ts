import { describe, expect, it } from 'vitest';
import type { OutputHistoryEntry } from '../../src/types';
import {
  collectNodeMediaVersions,
  historyRecordMediaUrl,
  versionFactsOf,
} from '../../src/utils/mediaViewerVersions';

function record(overrides: Partial<OutputHistoryEntry>): OutputHistoryEntry {
  return {
    id: 'h1',
    projectId: 'p1',
    nodeId: 'n1',
    nodeLabel: '图卡',
    timestamp: 1,
    prompt: '一只猫',
    output: 'https://cdn.local/a.png',
    nodeType: 'ai-image',
    model: 'gpt-image-1',
    provider: 'general',
    status: 'success',
    ...overrides,
  };
}

describe('media viewer versions from the generation history', () => {
  it('prefers mediaUrl over output', () => {
    expect(historyRecordMediaUrl(record({ mediaUrl: 'https://cdn.local/b.png' }))).toBe('https://cdn.local/b.png');
    expect(historyRecordMediaUrl(record({ mediaUrl: undefined }))).toBe('https://cdn.local/a.png');
    expect(historyRecordMediaUrl(record({ mediaUrl: undefined, output: '   ' }))).toBe('');
  });

  it('keeps only successful records of the requested node, newest first, deduped', () => {
    const versions = collectNodeMediaVersions('n1', [
      record({ id: 'h2', output: 'https://cdn.local/new.png', timestamp: 200 }),
      record({ id: 'h3', nodeId: 'n2', output: 'https://cdn.local/other.png', timestamp: 150 }),
      record({ id: 'h4', status: 'error', output: 'https://cdn.local/broken.png', timestamp: 120 }),
      record({ id: 'h5', output: 'https://cdn.local/new.png', timestamp: 100 }),
      record({ id: 'h6', output: 'https://cdn.local/old.png', timestamp: 50 }),
    ]);

    expect(versions.map((version) => version.src)).toEqual([
      'https://cdn.local/new.png',
      'https://cdn.local/old.png',
    ]);
    expect(versions[0].createdAt).toBe(200);
    expect(versions[1].model).toBe('gpt-image-1');
  });

  it('carries the local file path so the viewer download can reuse it', () => {
    const versions = collectNodeMediaVersions('n1', [
      record({ id: 'h2', output: 'https://cdn.local/new.png', filePath: '/tmp/new.png' }),
      record({ id: 'h6', output: 'https://cdn.local/old.png' }),
    ]);
    expect(versions[0].filePath).toBe('/tmp/new.png');
    expect(versions[1].filePath).toBeUndefined();
  });

  it('looks up the facts of the currently displayed version', () => {
    const versions = collectNodeMediaVersions('n1', [
      record({ id: 'h2', output: 'https://cdn.local/new.png', timestamp: 200, model: 'gpt-image-2' }),
      record({ id: 'h6', output: 'https://cdn.local/old.png', timestamp: 50, model: 'gpt-image-1' }),
    ]);
    expect(versionFactsOf(versions, 'https://cdn.local/old.png')).toEqual({
      createdAt: 50,
      model: 'gpt-image-1',
    });
    expect(versionFactsOf(versions, 'https://cdn.local/missing.png')).toEqual({});
    expect(versionFactsOf(versions, undefined)).toEqual({});
  });
});
