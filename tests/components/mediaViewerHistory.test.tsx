import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * 组件级断言：官方历史列的**类名 / 属性 / 计数**必须逐字（`Obe` @472356）
 *   · `aside.media-viewer__history` + `aria-label="历史版本"`（`common.historyVersions`）
 *   · 计数 `{index+1} / {total}`
 *   · 项：`media-viewer__history-item`、相邻加 `is-near`、当前项 `aria-current="true"`、
 *     非当前项 `tabIndex=-1`、`aria-label="历史版本 N"`、当前项 `loading="eager"` 其余 `lazy`
 *   · 上下翻页键 `media-viewer__history-edge`，首/尾分别 disabled
 *   · `≤1` 条时整列不渲染
 */
vi.mock('../../src/i18n', () => ({ useT: () => (message: string) => message }));

import MediaViewerHistory from '../../src/components/nodes/shared/media/MediaViewerHistory';
import MediaViewerFacts from '../../src/components/nodes/shared/media/MediaViewerFacts';

const VERSIONS = [
  { src: 'https://cdn.local/entry.png' },
  { src: 'https://cdn.local/mid.png', thumbnailSrc: 'https://cdn.local/mid-thumb.png' },
  { src: 'https://cdn.local/old.png' },
];

describe('media viewer history column markup', () => {
  it('renders the official structure for the active middle version', () => {
    const html = renderToStaticMarkup(
      <MediaViewerHistory versions={VERSIONS} currentSrc="https://cdn.local/mid.png" onSelect={() => {}} />,
    );

    expect(html).toContain('class="media-viewer__history"');
    expect(html).toContain('aria-label="历史版本"');
    expect(html).toContain('data-media-viewer-dismiss-blocker');
    expect(html).toContain('class="media-viewer__history-count"');
    expect(html).toContain('class="media-viewer__history-count">2 / 3<');
    expect(html).toContain('class="media-viewer__history-item is-near"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('aria-label="历史版本 2"');
    expect(html).toContain('src="https://cdn.local/mid-thumb.png"');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('loading="lazy"');
    expect((html.match(/media-viewer__history-edge/g) ?? [])).toHaveLength(2);
    expect(html).toContain('aria-label="上一个版本"');
    expect(html).toContain('aria-label="下一个版本"');
  });

  it('disables the previous arrow on the first version', () => {
    const html = renderToStaticMarkup(
      <MediaViewerHistory versions={VERSIONS} currentSrc="https://cdn.local/entry.png" onSelect={() => {}} />,
    );
    expect(html).toContain('class="media-viewer__history-count">1 / 3<');
    expect(html).toMatch(/aria-label="上一个版本"[^>]*disabled/);
  });

  it('renders nothing for a single version (official `e.length<=1`)', () => {
    expect(renderToStaticMarkup(
      <MediaViewerHistory versions={[VERSIONS[0]]} currentSrc={VERSIONS[0].src} onSelect={() => {}} />,
    )).toBe('');
  });
});

describe('media viewer facts markup', () => {
  it('renders the official definition list rows', () => {
    const html = renderToStaticMarkup(
      <MediaViewerFacts mediaType="image" width={1024} height={768} model="gpt-image-1" createdAt={1_700_000_000_000} />,
    );
    expect(html).toContain('class="space-y-6 text-white/72"');
    expect(html).toContain('text-[11px] font-semibold uppercase tracking-[0.12em] text-white/38');
    expect(html).toContain('break-words text-sm leading-5 text-white/74');
    expect(html).toContain('1024 × 768');
    /* 官方 `fye(model, t)` @443097：**查表换成可读名**，不能印原始 id
       （`q3("gpt-image-1")` → 官方 i18n 名；这里走 MTV 的 `officialCardMeta`） */
    expect(html).toContain('GPT Image');
    expect(html).not.toContain('gpt-image-1');
  });

  it('falls back to the raw model id when the name table misses it (official `: n`)', () => {
    const html = renderToStaticMarkup(
      <MediaViewerFacts mediaType="image" width={1} height={1} model="totally-unknown-model" />,
    );
    expect(html).toContain('totally-unknown-model');
  });

  it('omits the model row entirely when the model is empty (official `if(!n) return`)', () => {
    const html = renderToStaticMarkup(<MediaViewerFacts mediaType="image" width={1} height={1} model="   " />);
    expect(html).not.toContain('模型');
  });

  it('renders the skeleton rows while loading', () => {
    const html = renderToStaticMarkup(<MediaViewerFacts mediaType="image" loading />);
    expect(html).toContain('加载中...');
    expect(html).toContain('block h-5 w-20 animate-pulse rounded bg-white/10 motion-reduce:animate-none');
  });

  it('renders nothing when every field is unknown', () => {
    expect(renderToStaticMarkup(<MediaViewerFacts mediaType="image" />)).toBe('');
  });
});
