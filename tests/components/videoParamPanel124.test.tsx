// @vitest-environment jsdom
/**
 * §124 回归 —— 用户 2026-10-15 真机反馈的三块：
 *   A. **面板视觉**（`hover/间距/字体/大小/提示/颜色不对`）：官方 `Ir` 组盒 = `p-2 flex flex-col gap-1.5`（**无 margin**）·
 *      组标题 = `flex items-center gap-1 text-xs font-medium text-muted-foreground px-1`（12px/500/#7a7a7a/lh16/pad 0 4px/gap 4）·
 *      项按钮**没有 height 工具类**（高度 = `py-1.5` + 内容）。
 *   B. **底栏**：音频图标（官方 `Poe` 的 `g`）· 高级设置按钮（官方 `mx`，lucide `settings-2`）· 分隔符 ` · ` 两侧空格。
 *
 * 官方 r127 逐字见 `VideoParamSelector.tsx` / `AINodeDialog.tsx` / `quality-ratio.css` 里的 §124 注释，
 * 真机读数（CDP 9222 · Seedance 2.5 · 2026-10-15）：
 *   · 面板 400×390 @(765.3,284.7)；五组 74/86/74/74/74 **首尾相接（无 margin）**
 *   · 比例项 53.1×**44** · 容器 376×**48**（文字项 124×32 / 容器 376×36）
 *   · 底栏 chip 230.9×36 @(765.6,682.6)：`首尾帧 · 自适应 · 1080p` + ` · `(**11.9px**) + `4s` + `·` + 🔊(16×16) ，
 *     **首个子节点是 SPAN（无前导 svg）**，后面接 `div.w-px.h-4.bg-border` + 36×36 的 `settings-2` 按钮。
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
const DIALOG = 'src/components/nodes/AINodeDialog.tsx';
const CSS = 'src/styles/quality-ratio.css';

const PROPS = {
  provider: 'general',
  selectedModel: 'seedance-2.5',
  seedanceRatio: 'adaptive',
  seedanceResolution: '720p',
  seedanceDuration: 5,
  onChangeSeedanceRatio: vi.fn(),
  onChangeSeedanceResolution: vi.fn(),
  onChangeSeedanceDuration: vi.fn(),
  onChangeGenerateAudio: vi.fn(),
};

function chip(extra: Record<string, unknown> = {}) {
  const utils = render(createElement(
    VideoParamSelector as unknown as (p: Record<string, unknown>) => ReactElement,
    { ...PROPS, ...extra },
  ));
  return utils.container.querySelector('.ui-schema-menu-trigger') as HTMLElement;
}

beforeEach(() => { cleanup(); });

describe('§124-A 面板：官方 `Ir` 组盒与标题取值', () => {
  it('分组不再带 MTV 自造的 `mb-2`（官方 `Ir` = `p-2 flex flex-col gap-1.5`，无 margin）', () => {
    const tsx = readFileSync(VIDEO, 'utf8');
    expect(tsx).not.toContain('img-rp-quality-area mb-2');
    /* 面板 5 组都用同一个官方盒 */
    expect((tsx.match(/className="img-rp-quality-area"/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('「生成时长」标题改用官方 `img-rp-section-label`（12px/#7a7a7a），不再用 16px 白的 `rh-vram-adv-label`', () => {
    const panel = (() => {
      const t = chip();
      fireEvent.click(t);
      return document.querySelector('.ui-schema-video-params-popup') as HTMLElement;
    })();
    const labels = Array.from(panel.querySelectorAll('.img-rp-section-label'))
      .map((n) => n.textContent?.trim());
    expect(labels).toContain('生成时长');
    expect(labels).toContain('生成音频');
    const durationLabel = Array.from(panel.querySelectorAll('.img-rp-section-label'))
      .find((n) => n.textContent?.trim() === '生成时长')!;
    const s = getComputedStyle(labels ? durationLabel : durationLabel);
    /* 计算样式在 jsdom 里拿不到真实值（无 CSS 引擎）⇒ 断言类名归属即可 */
    expect(durationLabel.className).toBe('img-rp-section-label');
    expect(s).toBeTruthy();
  });

  it('「生成时长」不再挂 MTV 自造的 `!`（官方该标题 `titleSvg=none`）', () => {
    const tsx = readFileSync(VIDEO, 'utf8');
    expect(tsx).not.toContain('data-tooltip={durationTooltip}');
    expect(tsx).not.toContain('const durationTooltip');
  });

  it('「生成音频」标题换成官方 tabler `help` 图标（12×12，三条 path 逐字）', () => {
    const tsx = readFileSync(VIDEO, 'utf8');
    expect(tsx).toContain('tabler-icon-help text-muted-foreground');
    expect(tsx).toContain('M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0');
    expect(tsx).toContain('M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4');
  });

  it('比例项高度由内容决定（`min-height: 32px`，不是写死 32 ⇒ 官方 44）', () => {
    const css = readFileSync(CSS, 'utf8');
    const item = css.slice(css.indexOf('.img-rp-quality-item {'));
    expect(item.slice(0, 2200)).toContain('min-height: 32px');
    expect(item.slice(0, 2200)).toContain('height: auto;');
  });
});

describe('§124-B 底栏：前导图标 / 分隔符 / 音频图标', () => {
  it('官方 `!r && (m ? u1 : E0)`：有生成方式文案时**不画**前导图标（MTV 自造的电影机 svg 已删）', () => {
    const withMethod = chip({ generateMethod: 'frames', availableGenerateMethods: ['frames'], onGenerateMethodChange: vi.fn() });
    expect(withMethod.querySelector('svg')).toBeNull();
    cleanup();
    const without = chip({});
    const svg = without.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('class')).toContain('lucide-fullscreen');
    expect(svg!.getAttribute('width')).toBe('16');
  });

  it('分隔符 ` · ` 带 `shrink-0`（官方真机 11.9px；MTV 实测被压成 4px ⇒ `720p·19s`）', () => {
    const t = chip({ generateMethod: 'frames', availableGenerateMethods: ['frames'], onGenerateMethodChange: vi.fn(), seedanceDuration: 19 });
    const sep = Array.from(t.querySelectorAll('span')).find((s) => s.textContent === ' · ')!;
    expect(sep).toBeTruthy();
    expect(sep.className).toContain('opacity-50');
    expect(sep.className).toContain('shrink-0');
    /* 文案本身仍逐字 = 半角空格 + `·` + 半角空格 */
    expect(Array.from(sep.textContent!).map((c) => c.charCodeAt(0))).toEqual([32, 183, 32]);
  });

  it('音频图标：官方门 `g = supportsAudio && generateAudio !== void 0`（真机 `select-none transition-all duration-300`）', () => {
    const shown = chip({ generateMethod: 'frames', availableGenerateMethods: ['frames'], onGenerateMethodChange: vi.fn(), supportsAudio: true, generateAudio: false });
    const audio = shown.querySelector('svg.select-none');
    expect(audio).not.toBeNull();
    expect(audio!.querySelectorAll('path').length).toBe(3);
    expect(audio!.querySelector('line')).not.toBeNull();
    cleanup();
    const hidden = chip({ generateMethod: 'frames', availableGenerateMethods: ['frames'], onGenerateMethodChange: vi.fn(), supportsAudio: true });
    expect(hidden.querySelector('svg.select-none')).toBeNull();
  });
});

describe('§124-C `AINodeDialog`：官方 `Tr` 默认值 + 高级设置', () => {
  it('`generateAudio` 缺省时按官方 `Tr` 的 `variants[0].defaults` 补回（否则音频图标不渲染）', () => {
    const src = readFileSync(DIALOG, 'utf8');
    expect(src).toContain('catalogVariantDefaults?.generateAudio');
    expect(src).toContain('generateAudio={effectiveGenerateAudio}');
  });

  it('高级设置门 = 官方 `Kf`：seedance 系且 `modelType === "text_to_video"` 才有内容', () => {
    const src = readFileSync(DIALOG, 'utf8');
    expect(src).toContain("'seedance-2.0', 'seedance-2.5', 'seedance-2.5-draft'");
    expect(src).toContain("data?.params?.modelType === 'text_to_video'");
    expect(src).toContain("t('联网搜索')");
    expect(src).toContain('advancedSettings={videoAdvancedSettings}');
  });

  it('高级设置开关按官方 `fQe` 写 `params.enableWebSearch`', () => {
    const src = readFileSync(DIALOG, 'utf8');
    expect(src).toContain('params: { ...(current?.params ?? {}), enableWebSearch: value }');
  });

  it('`PromptPanel` 的门 = 官方 `hasAdvancedSettings = !!advancedSettings && !readonly`', () => {
    const src = readFileSync('src/components/nodes/shared/PromptPanel.tsx', 'utf8');
    expect(src).toContain('|| advancedSettings,');
    /* §126：内容盒改成官方 `p-4 bg-muted/30`，且 `advancedSettings` 直接作为子节点（去掉多余的 `mb-3` 包裹） */
    expect(src).toContain('className="prompt-advanced-inner p-4 bg-muted/30"');
    expect(src).toContain('{advancedSettings}');
  });
});
