// @vitest-environment jsdom
/**
 * 视频节点底部编辑条那颗**参数 chip** —— 官方 `VideoConfigsTrigger`（`Poe`）1:1 复刻的回归用例。
 *
 * 官方证据（`vendor-pkg-canvas-CvbAwZyy.js`，逐字，见 `VideoParamSelector.tsx` 文件上部注释）：
 *  · `Poe` @1873820 起：主文案 = `[generateModeLabel, generateMethodLabel, 比例|自适应, 清晰度|自适应]`
 *    `.join(" · ")`；时长后缀 `t ? (t === -1 ? videoConfigs.durationAuto : `${t}s`) : void 0`；
 *    音频是 `g = supportsAudio && generateAudio !== void 0` 的**图标**，不是文案。
 *  · `VA` @815764（生成方式 label 的键映射）· `aDe` @815397 · `dd` @815624 · `EJ` @815812
 *  · 自造文案 `模型默认参数` / `时长模型默认` / `比例模型默认` / `分辨率模型默认` / `帧率模型默认` /
 *    `音频模型默认` 在官方产物里 **0 命中**（全库 grep 实证）⇒ 必须删干净。
 *  · chip 的 `aria-haspopup="dialog"` / `aria-expanded` 来自 Radix `PopoverTrigger`
 *    （`vendor-libs-BqrVOBez…` 的 @4113439 逐字），弹层 `role="dialog"` 来自 Radix `PopoverContent`
 *    （同文件 @4113990 逐字）；官方弹层语义**确实是 dialog**。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { videoGenerateMethodLabelKey } from '../../src/services/ai/modelParamCatalog';
import VideoParamSelector, {
  videoConfigsTriggerDurationLabel,
  videoConfigsTriggerLabel,
  videoConfigsTriggerShowsAudio,
} from '../../src/components/nodes/shared/VideoParamSelector';
import PromptPanel from '../../src/components/nodes/shared/PromptPanel';

/* ── store / i18n 打桩（同 `styleSelector.test.tsx` 的既有做法） ───────────── */
const store = {
  config: { generalModels: [] as unknown[], providers: {} as Record<string, unknown> },
  customStyles: [] as unknown[],
  addCustomStyle: vi.fn(async () => {}),
  updateCustomStyle: vi.fn(async () => {}),
  deleteCustomStyle: vi.fn(async () => {}),
  projects: [] as unknown[],
  currentProjectId: null as string | null,
  dramaAssets: { characters: [] as unknown[] },
  globalCharacters: [] as unknown[],
  loadGlobalCharacters: vi.fn(async () => {}),
  edges: [] as unknown[],
  nodes: [] as unknown[],
  workflows: [] as unknown[],
};
vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: Object.assign(
    <T,>(selector: (state: typeof store) => T) => selector(store),
    { getState: () => store },
  ),
}));

/* ⚠️ 本文件是 jsdom 环境：jsdom 会把 `new URL(相对路径, import.meta.url)` 解析到文档 URL
   （`http://localhost:3000/...`）而不是仓库路径 ⇒ 必须按 cwd 拼绝对路径。 */
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');/** 去注释后的源码 —— 本文件里**写明**删掉了哪些自造文案，whole-file 匹配会自己误伤自己 */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SEL = 'src/components/nodes/shared/VideoParamSelector.tsx';

/** 从 SSR 标记里抠出那颗 chip（`AnimatedButton` ⇒ `button.img-pill-btn.ui-schema-menu-trigger`）的纯文本 */
function chipText(html: string): string {
  const at = html.indexOf('ui-schema-menu-trigger');
  expect(at, '找不到参数 chip 的按钮').toBeGreaterThan(-1);
  const open = html.indexOf('>', at);
  const close = html.indexOf('</button>', open);
  return html.slice(open + 1, close).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function chipHtml(html: string): string {
  const at = html.indexOf('ui-schema-menu-trigger');
  const open = html.indexOf('>', at);
  return html.slice(at, html.indexOf('</button>', open));
}

const renderChip = (props: Record<string, unknown>) => renderToStaticMarkup(
  createElement(VideoParamSelector as unknown as (p: Record<string, unknown>) => ReactElement, props),
);

/* ══════════════════════════════════════════════════════════════════════ *
 * 1. 官方 `Poe` 的主文案装配（纯函数，全部四种组合）
 * ══════════════════════════════════════════════════════════════════════ */
describe('官方 VideoConfigsTrigger 主文案装配', () => {
  const auto = '自适应';
  const adaptive = '自适应';

  it('生成方式 + 比例 + 清晰度 齐全 ⇒ `<方式> · <比例> · <清晰度>`', () => {
    expect(videoConfigsTriggerLabel('16:9', '1080p', undefined, '全能参考', auto, adaptive))
      .toBe('全能参考 · 16:9 · 1080p');
  });

  it('官方 chip 里没有「帧率」这一段（fps 只在弹窗里）', () => {
    const label = videoConfigsTriggerLabel('16:9', '1080p', undefined, undefined, auto, adaptive);
    expect(label).toBe('16:9 · 1080p');
    expect(label).not.toContain('帧');
  });

  it('比例、清晰度**都缺** ⇒ 只 push 一条 `videoConfigs.auto`（官方 `!e && !n` 分支）', () => {
    expect(videoConfigsTriggerLabel(undefined, undefined, undefined, undefined, auto, adaptive))
      .toBe('自适应');
  });

  it('只缺清晰度 ⇒ `<比例> · 自适应`；只缺比例 ⇒ `自适应 · <清晰度>`', () => {
    expect(videoConfigsTriggerLabel('16:9', undefined, undefined, undefined, auto, adaptive))
      .toBe('16:9 · 自适应');
    expect(videoConfigsTriggerLabel(undefined, '720p', undefined, undefined, auto, adaptive))
      .toBe('自适应 · 720p');
  });

  it('`aspectRatio === "adaptive"` ⇒ 改显 `videoConfigs.adaptive`', () => {
    expect(videoConfigsTriggerLabel('adaptive', '1080p', undefined, undefined, 'AUTO', 'ADAPTIVE'))
      .toBe('ADAPTIVE · 1080p');
  });

  it('生成模式（官方 `c`）+ 生成方式（官方 `r`）都排在比例/清晰度**之前**', () => {
    expect(videoConfigsTriggerLabel('16:9', '1080p', '首尾帧', '全能参考', auto, adaptive))
      .toBe('首尾帧 · 全能参考 · 16:9 · 1080p');
  });

  it('时长后缀：`-1` ⇒ `videoConfigs.durationAuto`；0 / undefined ⇒ 整段不渲染', () => {
    expect(videoConfigsTriggerDurationLabel(-1, '自动')).toBe('自动');
    expect(videoConfigsTriggerDurationLabel(5, '自动')).toBe('5s');
    expect(videoConfigsTriggerDurationLabel(0, '自动')).toBeUndefined();
    expect(videoConfigsTriggerDurationLabel(undefined, '自动')).toBeUndefined();
  });

  it('音频指示门 = `supportsAudio && generateAudio !== void 0`', () => {
    expect(videoConfigsTriggerShowsAudio(true, true)).toBe(true);
    expect(videoConfigsTriggerShowsAudio(true, false)).toBe(true);
    expect(videoConfigsTriggerShowsAudio(true, undefined)).toBe(false);
    expect(videoConfigsTriggerShowsAudio(false, true)).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════ *
 * 2. 官方 `VA` 的键映射（生成方式 label 的唯一真源）
 * ══════════════════════════════════════════════════════════════════════ */
describe('官方 VA（生成方式 label 的键映射）', () => {
  it('`edit` ⇒ `videoModels.videoEdit`；`frames` / `reference` ⇒ `videoConfigs.<method>`', () => {
    expect(videoGenerateMethodLabelKey('whatever', 'edit')).toBe('videoModels.videoEdit');
    expect(videoGenerateMethodLabelKey('whatever', 'frames')).toBe('videoConfigs.frames');
  });

  it('`reference` 档优先模型自己的 `referenceLabelKey`（§69 起已补齐）；缺该字段的模型走下一档', () => {
    /* 官方 `Fe['seedance-2.0'].referenceLabelKey === "videoConfigs.referenceOmni"`（vendor-packages
       @1111383 逐字）。§69 按 `modelParamCatalog.ts` 文件头写明的那条路径**重新抽取**进了
       `src/data/model-param-catalog.json`（全表 6 处：seedance-2.0 / -fast / -mini、seedance-2.5、
       kling-video-o1、kling-video-o3）⇒ `reference` 档命中官方**第一档** `videoConfigs.referenceOmni`
       （zh「全能参考」，canvas:@4399465 逐字）；没有该字段的模型仍走官方下一档 `videoConfigs.reference`。 */
    expect(videoGenerateMethodLabelKey('seedance-2.0', 'reference')).toBe('videoConfigs.referenceOmni');
    expect(videoGenerateMethodLabelKey('kling-video-o3', 'reference')).toBe('videoConfigs.referenceOmni');
    expect(videoGenerateMethodLabelKey('veo3.1', 'reference')).toBe('videoConfigs.reference');
    expect(videoGenerateMethodLabelKey(undefined, 'reference')).toBe('videoConfigs.reference');
  });
});

/* ══════════════════════════════════════════════════════════════════════ *
 * 3. 组件接线：真渲染出来的 chip 文案 / 属性
 * ══════════════════════════════════════════════════════════════════════ */
describe('参数 chip 真渲染', () => {
  beforeEach(() => { cleanup(); });

  it('原生 Seedance 模型：`<比例> · <清晰度> · <时长>s`（MTV 传不了生成方式 ⇒ 官方口径下这一段不 push）', () => {
    const html = renderChip({ provider: 'apimart', selectedModel: 'doubao-seedance-1-5-pro' });
    expect(chipText(html)).toBe('16:9 · 720p · 5s');
  });

  it('接上官方 `generateMethod` prop（含官方 `availableGenerateMethods`）⇒ 生成方式段按 `VA` 显示在比例之前', () => {
    /* 官方 `Roe` 传给触发器的取值门（@1875919 逐字）：
       `generateMethodLabel: _ && _.length>0 ? _.find(H=>H.key===b)?.label : void 0`
       ⇒ 只给 `b`、不给 `_` 时官方同样**不 push**（`_` 为空）。 */
    const html = renderChip({
      provider: 'apimart',
      selectedModel: 'doubao-seedance-1-5-pro',
      generateMethod: 'reference',
      availableGenerateMethods: ['frames', 'reference', 'edit'],
    });
    expect(chipText(html)).toBe('参考 · 16:9 · 720p · 5s');
  });

  it('只给 `generateMethod` 不给 `availableGenerateMethods` ⇒ 官方口径「为空就不 push」', () => {
    const html = renderChip({
      provider: 'apimart',
      selectedModel: 'doubao-seedance-1-5-pro',
      generateMethod: 'reference',
    });
    expect(chipText(html)).toBe('16:9 · 720p · 5s');
  });

  it('模型没声明比例/清晰度 ⇒ 官方兜底「自适应」，**不是**自造文案', () => {
    const html = renderChip({ provider: 'general', selectedModel: 'general/provider-custom-x' });
    const text = chipText(html);
    /* 官方 `!e && !n` 只 push **一条** `videoConfigs.auto`；时长走官方后缀 */
    expect(text).toBe('自适应 · 5s');
    for (const dead of ['模型默认参数', '时长模型默认', '比例模型默认', '分辨率模型默认', '帧率模型默认', '音频模型默认',
      '有声视频', '无声视频']) {
      expect(text).not.toContain(dead);
    }
  });

  it('本地工作流（ComfyUI）同样走官方口径：`<比例> · <清晰度> · <时长>s`（不再出现「帧率」）', () => {
    const html = renderChip({ provider: 'comfyui', selectedModel: 'builtin-minimax-h3-i2v' });
    expect(chipText(html)).toBe('16:9 · 832 · 5s');
    expect(chipText(html)).not.toContain('帧率');
  });

  it('`aria-haspopup="dialog"`（Radix `PopoverTrigger` 的官方值）+ `aria-expanded`', () => {
    const html = renderChip({ provider: 'apimart', selectedModel: 'doubao-seedance-1-5-pro' });
    expect(chipHtml(html)).toContain('aria-haspopup="dialog"');
    expect(chipHtml(html)).toContain('aria-expanded="false"');
  });

  it('音频是官方那颗**图标**（`oYe`），不是「有声视频 / 无声视频」文案', () => {
    const html = renderChip({
      provider: 'apimart',
      selectedModel: 'doubao-seedance-1-5-pro',
      generateAudio: true,
    });
    expect(chipHtml(html)).toContain('stroke-dasharray');
    /* 官方在图标前放了一颗 `opacity-50` 的 `·`（图标本身不带文字） */
    expect(chipText(html)).toBe('16:9 · 720p · 5s·');
    /* `generateAudio` 未显式取值（三态「模型默认」）⇒ 官方 `g` 为假 ⇒ 不渲染图标 */
    const off = renderChip({ provider: 'apimart', selectedModel: 'doubao-seedance-1-5-pro' });
    expect(chipHtml(off)).not.toContain('stroke-dasharray');
  });
});

describe('弹层语义 = dialog', () => {
  beforeEach(() => { cleanup(); });

  it('点开 chip ⇒ `aria-expanded="true"`，弹层 `role="dialog"`', () => {
    render(createElement(
      VideoParamSelector as unknown as (p: Record<string, unknown>) => ReactElement,
      { provider: 'apimart', selectedModel: 'doubao-seedance-1-5-pro' },
    ));
    const trigger = document.querySelector('.ui-schema-menu-trigger') as HTMLElement;
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.ui-schema-video-params-popup')?.getAttribute('role')).toBe('dialog');
  });
});

/* ══════════════════════════════════════════════════════════════════════ *
 * 4. 负向断言：自造文案已从源码里删干净（官方 0 命中）
 * ══════════════════════════════════════════════════════════════════════ */
describe('自造文案删除', () => {
  it('`VideoParamSelector.tsx` 的可执行代码里不再出现那 6 条 + 音频那 2 条', () => {
    const src = code(read(SEL));
    for (const dead of ['模型默认参数', '时长模型默认', '比例模型默认', '分辨率模型默认',
      '帧率模型默认', '音频模型默认']) {
      expect(src, `${dead} 应该已经删掉`).not.toContain(dead);
    }
    /* ⚠️ 用**带引号的字面量**判音频那两条：`生成有声视频`（弹窗里的开关标题）是**另一处**文案，
       它只是**包含** `有声视频` 这个子串，不是被删掉的那条 chip 文案。 */
    for (const dead of ["'有声视频'", "'无声视频'"]) {
      expect(src, `${dead} 应该已经删掉`).not.toContain(dead);
    }
    /* 旧的自造拼接也一并删掉 */
    expect(src).not.toContain('时长${displayedDuration}s');
    expect(src).not.toContain('durationTriggerLabel');
  });
});

/* ══════════════════════════════════════════════════════════════════════ *
 * 5. 「风格」chip 只属于图片/全景节点（官方视频卡没有这颗键）
 * ══════════════════════════════════════════════════════════════════════ */
describe('风格 chip 的挂载条件', () => {
  const PANEL = 'src/components/nodes/shared/PromptPanel.tsx';

  it('视频节点的底部条里**不存在** `.style-selector-btn`（官方视频卡没有这颗键）', () => {
    const { container } = render(createElement(
      PromptPanel as unknown as (p: Record<string, unknown>) => ReactElement,
      { nodeType: 'ai-video', onChange: () => {}, onSubmit: () => {}, onModelSelect: () => {} },
    ));
    expect(container.querySelectorAll('.prompt-footer').length).toBe(1);
    expect(container.querySelectorAll('.style-selector-btn').length).toBe(0);
    /* 参数 chip 仍然在（视频节点该有的那颗），分隔符只剩「模型」那一颗 —— 没有孤立分隔线 */
    expect(container.querySelectorAll('.ui-schema-menu-trigger').length).toBe(1);
    expect(container.querySelectorAll('.prompt-footer-sep--ratio').length).toBe(0);
    expect(container.querySelectorAll('.prompt-footer-sep--model').length).toBe(1);
  });

  it('图片节点仍然有 `.style-selector-btn`（防误伤）+ 它自己的 `sep--ratio`', () => {
    const { container } = render(createElement(
      PromptPanel as unknown as (p: Record<string, unknown>) => ReactElement,
      { nodeType: 'ai-image', onChange: () => {}, onSubmit: () => {}, onModelSelect: () => {} },
    ));
    expect(container.querySelectorAll('.style-selector-btn').length).toBe(1);
    expect(container.querySelectorAll('.prompt-footer-sep--ratio').length).toBe(1);
  });

  it('源码级同口径：`<StyleSelector>` 的挂载条件里不再有 `ai-video`', () => {
    const panel = code(read(PANEL));
    const at = panel.indexOf('<StyleSelector');
    expect(at).toBeGreaterThan(-1);
    /* 向上找最近的那个条件表达式 —— 里面不许再出现 'ai-video' */
    const condition = panel.slice(Math.max(0, at - 400), at);
    expect(condition).not.toContain("'ai-video'");
    expect(condition).toContain('ai-image');
    expect(condition).toContain('ai-panorama');
    /* 分隔符与风格键同一个条件块 —— 视频节点下不会剩一条孤立分隔线 */
    expect(condition).toContain('prompt-footer-sep prompt-footer-sep--ratio');
  });
});
