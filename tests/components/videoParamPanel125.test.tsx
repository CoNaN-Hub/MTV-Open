// @vitest-environment jsdom
/**
 * §125 回归 —— 用户 2026-10-15 面板同开时的四条反馈（`高级设置的图标不对 / 面板的 hover / hover 底色 /
 * 过渡动画 / 各选项之间的间距均不对`）。**官方值全部来自 9222 真机计算样式**（面板同开时抓取）：
 *
 * | 位置 | 官方真机值 |
 * |---|---|
 * | 面板 | `400×390` · pad 4 · r20 · `rgba(51,51,51,.8)` · blur(28px) |
 * | 组盒 | `p-2 flex flex-col gap-1.5` ⇒ `gap 6px` · `padding 8px` · **无 margin**；组间 **0** |
 * | 标题 | `gap 4` · `padding 0 4px` · `12px/500/16px` · `rgb(122,122,122)` · `height:16px` |
 * | 项 | `padding 6px 8px` · `14px/400/20px` · `r10` · `flex:1 1 0%` · 项间 **0** |
 * | 项过渡 | `color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, …` · `0.2s` · `cubic-bezier(0.4,0,0.2,1)` |
 * | 项 hover | 类串只有 `hover:text-foreground`（**无背景**）；各态 `background-color: rgba(0,0,0,0)` |
 * | chip | `224.1×36` · `color rgb(245,245,245)` · `line-height 20px` · `gap 4` · `pad 4px 8px` · `r12` · `transition 0.15s cubic-bezier(0.4,0,0.2,1)` |
 * | 高级设置图标 | `lucide lucide-settings2 lucide-settings-2 h-4 w-4 text-foreground` · 16×16 · `stroke rgb(245,245,245)` · `M20 7h-9`/`M14 17H5`/`circle(17,17,3)`/`circle(7,7,3)` |
 * | 分隔符 ` · ` | **11.9px**（两空格 ≈3.9 + `·` 4） |
 */
import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import VideoParamSelector from '../../src/components/nodes/shared/VideoParamSelector';

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (value: string) => value }));
vi.mock('../../src/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/i18n')>();
  return { ...actual, useT: () => (key: string) => key };
});

const VIDEO = 'src/components/nodes/shared/VideoParamSelector.tsx';
const PANEL = 'src/components/nodes/shared/PromptPanel.tsx';
const CSS = 'src/styles/quality-ratio.css';

const PROPS = {
  provider: 'general',
  selectedModel: 'seedance-2.5',
  seedanceRatio: 'adaptive',
  seedanceResolution: '720p',
  seedanceDuration: 5,
  generateAudio: true,
  generateMethod: 'frames',
  availableGenerateMethods: ['frames', 'reference', 'edit'],
  onGenerateMethodChange: vi.fn(),
  onChangeSeedanceRatio: vi.fn(),
  onChangeSeedanceResolution: vi.fn(),
  onChangeSeedanceDuration: vi.fn(),
  onChangeGenerateAudio: vi.fn(),
};

function openPanel(extra: Record<string, unknown> = {}) {
  const utils = render(createElement(
    VideoParamSelector as unknown as (p: Record<string, unknown>) => ReactElement,
    { ...PROPS, ...extra },
  ));
  fireEvent.click(utils.container.querySelector('.ui-schema-menu-trigger') as HTMLElement);
  return document.querySelector('.ui-schema-video-params-popup') as HTMLElement;
}

beforeEach(() => { cleanup(); });

describe('§125 面板：组间距 / 标题提示', () => {
  it('生成时长与生成音频是面板的**两个直属组**（不再被 `.rh-v5-meta-panel` 的 gap:10 包住）', () => {
    const panel = openPanel();
    const areas = Array.from(panel.children).filter((el) => el.className === 'img-rp-quality-area');
    expect(areas.length).toBe(5);
    const labels = areas.map((a) => a.querySelector('.img-rp-section-label')?.textContent?.trim());
    expect(labels).toEqual(['生成方式', '比例', '清晰度', '生成时长', '生成音频']);
    expect(panel.querySelector('.rh-v5-meta-panel')).toBeNull();
  });

  it('「比例 / 清晰度」标题不再挂 MTV 自造的 `!`（官方 `Ir` 未传 tooltip ⇒ 真机 titleSvg: none）', () => {
    const panel = openPanel();
    for (const name of ['比例', '清晰度', '生成时长', '生成方式']) {
      const label = Array.from(panel.querySelectorAll('.img-rp-section-label'))
        .find((n) => n.textContent?.trim().startsWith(name))!;
      expect(label.querySelector('svg'), `${name} 标题不该有图标`).toBeNull();
      expect(label.textContent?.trim(), `${name} 标题不该有 !`).toBe(name);
    }
    /* 只有「生成音频」带官方 tabler `help` */
    const audioLabel = Array.from(panel.querySelectorAll('.img-rp-section-label'))
      .find((n) => n.textContent?.trim().startsWith('生成音频'))!;
    expect(audioLabel.querySelector('svg')?.getAttribute('class')).toContain('tabler-icon-help');
  });
});

describe('§125 项与 chip：过渡 / 颜色 / 分隔符', () => {
  it('项过渡 = 官方 `transition-colors` 全属性表（0.2s / cubic-bezier(0.4,0,0.2,1)）', () => {
    const css = readFileSync(CSS, 'utf8');
    const item = css.slice(css.indexOf('.img-rp-quality-item {'));
    for (const prop of ['border-color', 'outline-color', 'text-decoration-color', 'fill', 'stroke']) {
      expect(item.slice(0, 2400)).toContain(`${prop} 0.2s cubic-bezier(0.4, 0, 0.2, 1)`);
    }
  });

  it('项 hover = 官方（只有颜色，没有背景）', () => {
    const css = readFileSync(CSS, 'utf8');
    const hover = css.slice(css.indexOf('\n.img-rp-quality-item:hover {'));
    expect(hover.slice(0, 120)).toContain('color: rgb(245, 245, 245)');
    expect(hover.slice(0, 120)).toContain('background: transparent');
  });

  it('chip 的 color/line-height/transition 按官方真机修，且**只作用于 videoParams 这一层**', () => {
    const css = readFileSync(CSS, 'utf8');
    expect(css).toContain(".prompt-footer .ui-schema-renderer[data-ui-schema-placement='videoParams'] .img-pill-btn {");
    expect(css).toContain('line-height: 20px;');
    expect(css).toContain('color 0.15s cubic-bezier(0.4, 0, 0.2, 1)');
    expect(css).toContain(".prompt-footer .ui-schema-renderer[data-ui-schema-placement='videoParams'] .img-pill-btn:hover,");
    /* 未受影响的判据：另外两个共用 `.img-pill-btn` 的面板用的是**别的 placement 值** */
    const quality = readFileSync('src/components/nodes/shared/QualityRatioSelector.tsx', 'utf8');
    const audio = readFileSync('src/components/nodes/shared/AudioParamSelector.tsx', 'utf8');
    expect(quality).toContain('data-ui-schema-placement="resolution"');
    expect(audio).toContain('data-ui-schema-placement="audioParams"');
    expect(quality).not.toContain('data-ui-schema-placement="videoParams"');
    expect(audio).not.toContain('data-ui-schema-placement="videoParams"');
  });

  it('分隔符 ` · ` 用 `whitespace-pre` 保住前后空格（官方真机 11.9px；MTV 曾 4px ⇒ `720p·19s`）', () => {
    const chip = (() => {
      const t = render(createElement(
        VideoParamSelector as unknown as (p: Record<string, unknown>) => ReactElement,
        { ...PROPS },
      )).container.querySelector('.ui-schema-menu-trigger') as HTMLElement;
      return t;
    })();
    void chip;
    const src = readFileSync(VIDEO, 'utf8');
    expect(src).toContain('<span className="opacity-50 shrink-0 whitespace-pre"> · </span>');
    const sep = Array.from(document.querySelectorAll('span')).find((s) => s.className.includes('whitespace-pre'));
    expect(sep).toBeTruthy();
    expect(sep!.textContent).toBe(' · ');
    expect(Array.from(sep!.textContent!).map((c) => c.charCodeAt(0))).toEqual([32, 183, 32]);
  });
});

describe('§125 高级设置图标 = 官方 `settings-2`', () => {
  it('`PromptPanel` 用的是官方 lucide `settings-2` 四条子元素（不是 MTV 原来的两 rect + 两点）', () => {
    const src = readFileSync(PANEL, 'utf8');
    expect(src).toContain('lucide lucide-settings2 lucide-settings-2 h-4 w-4 text-foreground');
    expect(src).toContain('<path d="M20 7h-9" />');
    expect(src).toContain('<path d="M14 17H5" />');
    expect(src).toContain('<circle cx="17" cy="17" r="3" />');
    expect(src).toContain('<circle cx="7" cy="7" r="3" />');
    /* 旧的自造图标（官方 0 命中）不许回归 */
    expect(src).not.toContain('<rect width="20" height="8" x="2" y="2" rx="2" ry="2" />');
    expect(src).not.toContain('<line x1="6" x2="6.01" y1="6" y2="6" />');
  });
});
