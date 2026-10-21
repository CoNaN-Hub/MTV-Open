// @vitest-environment jsdom
/**
 * §69 官方「生成方式」全链回归 —— 官方 `Roe`（`VideoConfigsPanel`）那颗选择器 + 它写进节点的
 * `data.params.modelType` / `data.params.variant` + 触发 chip 首段（`Poe` 的 `generateMethodLabel`）。
 *
 * 官方证据（`vendor-pkg-canvas-CvbAwZyy.js` / `vendor-packages-DRvCmDjR.js`，逐字）：
 *  · `LXe` @canvas:1991362  节点参数读出：`params: n?.params || {}`、
 *      `const h=n?.params?.modelType; … {…, modelType: g}`、`updateParams` = `{params:{...h.data?.params,...f}}`
 *  · `aDe` @canvas:815397 / `dd` @815624 / `EJ` @815812 / `VA` @815764
 *  · `an` @canvas:2058180（选择器写入）：`i({modelType:kn.modelType, variant:kn.variant, ...er})`，
 *      `kn = dDe(o.model, so, u.imageCount, u.videoCount, u.audioCount)`
 *  · `dDe` @canvas:816560 · `cDe` @canvas:816544 · `lDe` @canvas:816079
 *  · `_p`(`y9`) @vendor-packages:1220052 · `qb`(`v9`) @vendor-packages:1218799
 *  · `Uhe`(`x9`) @vendor-packages:1216950 · `YR`(`o$`) @vendor-packages:1219506
 *  · `CQe` @canvas:2037060（选模型时种 `modelType`/`variant`）
 *  · `Roe` @canvas:1875906（面板）· `Poe` @canvas:1873888（chip）
 */
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (value: string) => value }));
vi.mock('../../src/components/nodes/shared/WorkflowApiTaskStatus', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/image/cameraStudio', () => ({ buildGenerationCameraPrompt: () => '' }));
vi.mock('../../src/services/comfyWorkflowService', () => ({ cancelComfyUINodeTask: vi.fn() }));
vi.mock('../../src/services/pollManager', () => ({
  getPendingTasksForProject: () => [],
  resumeComfyUINodeTask: vi.fn(),
  resumeRunningHubNodeTask: vi.fn(),
  updatePendingTask: vi.fn(),
  removePendingTask: vi.fn(),
}));
vi.mock('../../src/services/workflowExecutionService', () => ({
  isCloudWorkflow: () => false,
  getCloudWorkflowPersistedOutput: () => undefined,
  workflowExecution: {},
}));
vi.mock('../../src/services/workflowApi/workflowApiAdapter', () => ({
  completeWorkflowApiNodeTask: vi.fn(),
  stopWorkflowApiNodeTask: vi.fn(),
}));
vi.mock('../../src/services/ai/providers/runninghubWorkflow', () => ({
  cancelRunningHubNodeTask: vi.fn(),
  completeRunningHubNodeTask: vi.fn(),
}));
vi.mock('../../src/services/canvasDerivationGuard', () => ({
  completeCanvasDerivation: vi.fn(),
  isCanvasDerivationFresh: () => true,
  registerCanvasDerivation: () => null,
}));
vi.mock('../../src/services/projectSettingsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/projectSettingsService')>()),
  getImageNodeDimensionsForAspectRatio: () => ({ nodeWidth: 280, nodeHeight: 158 }),
  resolveProjectGenerationPrompt: (prompt: string) => prompt,
}));

/* ── `VideoParamSelector` 单测用的轻量 store 打桩 ───────────────────────── */
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
  generateId: () => 'generated',
  computeImageNodeDimensions: async () => ({ nodeWidth: 280, nodeHeight: 158 }),
}));
/* `useT()` 用**真实实现**（zh 源串回落 + `{count}` 插值），才能验官方 hint 的逐字文案。 */

import {
  methodKeyOfModelType,
  videoGenerateMethodLabelKey,
  videoMethodKeys,
  videoReferenceCapabilitySummaries,
  videoVariantForMethod,
  videoVariantForModel,
  variantMatchesExactInputs,
} from '../../src/services/ai/modelParamCatalog';
import VideoParamSelector from '../../src/components/nodes/shared/VideoParamSelector';

/** 从 SSR 标记里抠出 chip（`AnimatedButton` ⇒ `button.img-pill-btn.ui-schema-menu-trigger`）的纯文本 */
function chipText(html: string): string {
  const at = html.indexOf('ui-schema-menu-trigger');
  expect(at, '找不到参数 chip 的按钮').toBeGreaterThan(-1);
  const open = html.indexOf('>', at);
  const close = html.indexOf('</button>', open);
  return html.slice(open + 1, close).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
const renderChip = (props: Record<string, unknown>) => renderToStaticMarkup(
  createElement(VideoParamSelector as unknown as (p: Record<string, unknown>) => ReactElement, props),
);

/* ══════════════════════════════════════════════════════════════════════ *
 * 1. 官方「生成方式」一族纯函数（目录层）
 * ══════════════════════════════════════════════════════════════════════ */
describe('官方生成方式的目录层（dd / EJ / VA / dDe / _p / x9）', () => {
  it('`dd`（`aDe`）把 `zt` 模式枚举折成 method key', () => {
    expect(methodKeyOfModelType('text_to_video')).toBe('frames');
    expect(methodKeyOfModelType('image_to_video')).toBe('frames');
    expect(methodKeyOfModelType('start_end_to_video')).toBe('frames');
    expect(methodKeyOfModelType('reference_to_video')).toBe('reference');
    expect(methodKeyOfModelType('reference_video_to_video')).toBe('reference');
    expect(methodKeyOfModelType('video_edit')).toBe('edit');
    expect(methodKeyOfModelType('video_extend')).toBe('reference');
    /* 官方 `dd` 逐字：`e?aDe[e]??null:null` */
    expect(methodKeyOfModelType(undefined)).toBeNull();
    expect(methodKeyOfModelType('digital_human')).toBeNull();
  });

  it('`EJ` 顺序恒为 `frames → reference → edit`', () => {
    expect(videoMethodKeys('seedance-2.0')).toEqual(['frames', 'reference']);
    expect(videoMethodKeys('seedance-2.5')).toEqual(['frames', 'reference', 'edit']);
    expect(videoMethodKeys('not-in-catalog')).toEqual([]);
    expect(videoMethodKeys(undefined)).toEqual([]);
  });

  it('`VA`：带 `referenceLabelKey` 的模型命中「全能参考」，其余走下一档', () => {
    expect(videoGenerateMethodLabelKey('seedance-2.0', 'reference')).toBe('videoConfigs.referenceOmni');
    expect(videoGenerateMethodLabelKey('kling-video-o1', 'reference')).toBe('videoConfigs.referenceOmni');
    expect(videoGenerateMethodLabelKey('veo3.1', 'reference')).toBe('videoConfigs.reference');
    expect(videoGenerateMethodLabelKey('seedance-2.0', 'edit')).toBe('videoModels.videoEdit');
    expect(videoGenerateMethodLabelKey('seedance-2.0', 'frames')).toBe('videoConfigs.frames');
  });

  it('`dDe`：把 method key 折成具体 variant（写入 `modelType` / `variant` 的真源）', () => {
    /* 0 输入时 `_p` 判 `reference_to_video` 不成立（它要求 `imageRange.min`），走官方 `?? l[0]` */
    expect(videoVariantForMethod('seedance-2.0', 'reference', 0, 0, 0)).toMatchObject({
      modelType: 'reference_to_video',
      variant: 'reference',
    });
    /* `frames` 的三个兄弟 variant（text / image / start_end）在 0 输入下 `_p` 只认 text */
    expect(videoVariantForMethod('seedance-2.0', 'frames', 0, 0, 0)).toMatchObject({
      modelType: 'text_to_video',
      variant: 'text',
    });
    expect(videoVariantForMethod('seedance-2.5', 'edit', 0, 0, 0)).toMatchObject({
      modelType: 'video_edit',
      variant: 'edit',
    });
    /* 模型没有该 method ⇒ 官方 `l.length===0 ⇒ null` */
    expect(videoVariantForMethod('seedance-2.0', 'edit', 0, 0, 0)).toBeNull();
    expect(videoVariantForMethod('not-in-catalog', 'frames', 0, 0, 0)).toBeNull();
  });

  it('`_p`（`variantMatchesExactInputs`）逐字：图片数决定 `frames` 的具体 variant', () => {
    expect(variantMatchesExactInputs('seedance-2.0', 'text_to_video', 0, 0, 0)).toBe(true);
    expect(variantMatchesExactInputs('seedance-2.0', 'image_to_video', 1, 0, 0)).toBe(true);
    expect(variantMatchesExactInputs('seedance-2.0', 'image_to_video', 0, 0, 0)).toBe(false);
    expect(variantMatchesExactInputs('seedance-2.0', 'start_end_to_video', 2, 0, 0)).toBe(true);
    expect(variantMatchesExactInputs('seedance-2.0', 'reference_to_video', 1, 0, 0)).toBe(true);
    /* 官方 seedance-2.0 的 reference variant 是 `min:0,max:9`（vendor-packages @1111671）⇒ 0 图也成立；
       换个 `min` 不为 0 的模型即报 false（`veo3.1` 的参考档见目录）。 */
    expect(variantMatchesExactInputs('seedance-2.0', 'reference_to_video', 0, 0, 0)).toBe(true);
    expect(variantMatchesExactInputs('veo3.1', 'reference_to_video', 0, 0, 0)).toBe(false);
    expect(variantMatchesExactInputs('seedance-2.0', undefined, 0, 0, 0)).toBe(false);
  });

  it('`x9`(Uhe) 再 `o$`(YR)：官方选模型时的 variant 解析', () => {
    /* seedance-2.0 目录里 reference variant 排在第一位且 `min:0` ⇒ `_p` 直接命中它 */
    expect(videoVariantForModel('seedance-2.0', 0, 0, 0)).toMatchObject({
      modelType: 'reference_to_video',
      variant: 'reference',
    });
    expect(videoVariantForModel('not-in-catalog', 0, 0, 0)).toBeNull();
  });

  it('`lDe`：参考档能力摘要（用于官方 hint）', () => {
    /* 官方 seedance-2.0 的 reference variant 逐字：
       `referenceImageRange:{min:0,max:9},referenceVideoRange:{min:0,max:3},referenceAudioRange:{min:0,max:3}`
       （vendor-packages @1111671）⇒ `lDe` 输出 `{imageMax:9,videoMax:3,audioMax:3}`。 */
    const summaries = videoReferenceCapabilitySummaries('seedance-2.0');
    expect(summaries).toEqual([{ imageMax: 9, videoMax: 3, audioMax: 3 }]);
    expect(videoReferenceCapabilitySummaries('not-in-catalog')).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════ *
 * 2. chip 首段（官方 `Poe` 的 `r`）+ 弹窗里的「生成方式」行（官方 `Roe` 的 `M` 段）
 * ══════════════════════════════════════════════════════════════════════ */
describe('chip 首段 = 生成方式', () => {
  beforeEach(() => { cleanup(); });

  it('选了模型 + 有生成方式 ⇒ chip 首段是官方 `VA` 文案', () => {
    const html = renderChip({
      provider: 'general',
      selectedModel: 'seedance-2.0',
      generateMethod: 'reference',
      availableGenerateMethods: ['frames', 'reference'],
    });
    expect(chipText(html).startsWith('全能参考 · ')).toBe(true);
  });

  it('没有生成方式（官方 `b` 为空）⇒ 首段整段消失，**不是**填空串', () => {
    const withMethod = renderChip({
      provider: 'general',
      selectedModel: 'seedance-2.0',
      generateMethod: 'frames',
      availableGenerateMethods: ['frames', 'reference'],
    });
    const without = renderChip({
      provider: 'general',
      selectedModel: 'seedance-2.0',
      availableGenerateMethods: ['frames', 'reference'],
    });
    expect(chipText(withMethod).startsWith('首尾帧 · ')).toBe(true);
    expect(chipText(without)).not.toContain('首尾帧');
    /* 去掉首段后剩下的部分与「有生成方式」那条的后半段逐字相同 */
    expect(chipText(without)).toBe(chipText(withMethod).replace(/^首尾帧 · /, ''));
  });

  it('老节点数据没有该字段 ⇒ 不炸、按官方缺省（无首段）', () => {
    const html = renderChip({ provider: 'general', selectedModel: 'seedance-2.0' });
    expect(chipText(html).startsWith(' · ')).toBe(false);
    expect(chipText(html)).not.toContain('全能参考');
  });
});

describe('弹窗里的「生成方式」行（官方 `Roe`）', () => {
  beforeEach(() => { cleanup(); });

  const openPanel = (props: Record<string, unknown>) => {
    const utils = render(createElement(
      VideoParamSelector as unknown as (p: Record<string, unknown>) => ReactElement,
      props,
    ));
    fireEvent.click(utils.container.querySelector('.ui-schema-menu-trigger') as HTMLElement);
    /* §123：面板已按官方 `PopoverPortal` 语义 **portal 到 `<body>`**
       （`VideoParamSelector.tsx` 的 `createPortal(…, document.body)`）
       ⇒ 断言一律在 `document.body` 上做（`beforeEach(cleanup)` 会清干净）。 */
    return document.body;
  };

  const methodArea = (container: HTMLElement) => {
    const labels = Array.from(container.querySelectorAll('.img-rp-section-label'));
    return labels.find((node) => node.textContent?.trim() === '生成方式')?.parentElement ?? null;
  };

  const optionLabels = (container: HTMLElement) => {
    const area = methodArea(container);
    return area
      ? Array.from(area.querySelectorAll('button')).map((b) => b.textContent?.trim())
      : [];
  };

  it('官方渲染门 `M = b && _ && _.length>0 && v`：三件套齐了才渲染', () => {
    const container = openPanel({
      provider: 'general',
      selectedModel: 'seedance-2.0',
      generateMethod: 'reference',
      availableGenerateMethods: ['frames', 'reference'],
      onGenerateMethodChange: vi.fn(),
    });
    const area = methodArea(container);
    expect(area).not.toBeNull();
    /* 官方 `options: _.map(H=>H.key)` + `renderOption: label`（`reference` 档还带官方 `lDe` hint 的
       信息图标 —— 官方是 lucide `info` **SVG**（`NR` size 12），不是文字 `!`）*/
    expect(optionLabels(container)).toEqual(['首尾帧', '全能参考']);
    expect(area!.querySelector('svg.lucide-info')).not.toBeNull();
    /* 官方 `value: b` ⇒ 当前项带 `active` */
    expect(area!.querySelector('.img-rp-quality-item.active')?.textContent?.trim()).toBe('全能参考');
  });

  it('官方 `b` 为空 ⇒ 整个「生成方式」段不渲染', () => {
    const container = openPanel({
      provider: 'general',
      selectedModel: 'seedance-2.0',
      availableGenerateMethods: ['frames', 'reference'],
      onGenerateMethodChange: vi.fn(),
    });
    expect(methodArea(container)).toBeNull();
  });

  it('官方 `_` 为空（模型没有生成方式）⇒ 不渲染', () => {
    const container = openPanel({
      provider: 'general',
      selectedModel: 'seedance-2.0',
      generateMethod: 'reference',
      availableGenerateMethods: [],
      onGenerateMethodChange: vi.fn(),
    });
    expect(methodArea(container)).toBeNull();
  });

  it('官方 `v`（onGenerateMethodChange）为空 ⇒ 不渲染（`M` 的第三项）', () => {
    const container = openPanel({
      provider: 'general',
      selectedModel: 'seedance-2.0',
      generateMethod: 'reference',
      availableGenerateMethods: ['frames', 'reference'],
    });
    expect(methodArea(container)).toBeNull();
  });

  it('点某一行 ⇒ 回调收到的是官方 method key（`frames|reference|edit`）', () => {
    const onChange = vi.fn();
    const container = openPanel({
      provider: 'general',
      selectedModel: 'seedance-2.5',
      generateMethod: 'frames',
      availableGenerateMethods: ['frames', 'reference', 'edit'],
      onGenerateMethodChange: onChange,
    });
    const area = methodArea(container)!;
    const edit = Array.from(area.querySelectorAll('button'))
      .find((b) => b.textContent?.trim().startsWith('视频编辑'));
    expect(edit).toBeTruthy();
    fireEvent.click(edit!);
    expect(onChange).toHaveBeenCalledWith('edit');
  });

  it('官方 `disabled: j || L.includes("generateMethod")`', () => {
    const container = openPanel({
      provider: 'general',
      selectedModel: 'seedance-2.0',
      generateMethod: 'reference',
      availableGenerateMethods: ['frames', 'reference'],
      onGenerateMethodChange: vi.fn(),
      lockedParameters: ['generateMethod'],
    });
    const area = methodArea(container)!;
    expect(Array.from(area.querySelectorAll('button')).every((b) => b.disabled)).toBe(true);
  });

  it('官方 `reference` 档的 hint（`lDe` 能力摘要）挂在选项上', () => {
    const container = openPanel({
      provider: 'general',
      selectedModel: 'seedance-2.0',
      generateMethod: 'reference',
      availableGenerateMethods: ['reference'],
      onGenerateMethodChange: vi.fn(),
    });
    const tip = methodArea(container)!.querySelector('.rh-tip');
    expect(tip).not.toBeNull();
    expect(tip!.getAttribute('data-tooltip')).toBe('最多9张图 + 最多3个视频 + 最多3段音频');
  });
});

/* ══════════════════════════════════════════════════════════════════════ *
 * 3. 节点级接线：`data.params.modelType` ⇄ chip ⇄ 选择器写入（`AINodeDialog`）
 * ══════════════════════════════════════════════════════════════════════ */
describe('视频节点 data.params.modelType 全链', () => {
  function installDialogStore(
    nodeData: Record<string, unknown>,
    canvas: {
      edges?: Array<{ id: string; source: string; target: string }>;
      extraNodes?: Array<Record<string, unknown>>;
    } = {},
  ) {
    return {
      activeNodeId: 'video-1' as string | null,
      dialogPosition: null as { x: number; y: number } | null,
      selectedNodeIds: ['video-1'] as string[],
      canvasNodeDragging: false,
      galleryNodeId: null as string | null,
      nodes: [
        { id: 'video-1', type: 'ai-video', position: { x: 0, y: 0 }, data: nodeData },
        ...(canvas.extraNodes ?? []),
      ],
      edges: (canvas.edges ?? []) as Array<{ id: string; source: string; target: string }>,
      workflows: [] as unknown[],
      currentProjectId: 'project-a',
      config: { performanceMode: false, generalModels: [] as unknown[], providers: {} as Record<string, unknown> },
      dramaAssets: { characters: [] as unknown[] },
      globalCharacters: [] as unknown[],
      loadGlobalCharacters: vi.fn(async () => {}),
      projectCharacters: [] as unknown[],
      focusEditNodeId: null as string | null,
      toolbarLayouts: {} as Record<string, unknown>,
      installedPlugins: [] as unknown[],
      userPresets: [] as unknown[],
      userSkills: [] as unknown[],
      outputHistoryRecords: [] as unknown[],
      closeNodeDialog: vi.fn(),
      updateNodeData: vi.fn(),
      updateNodeDataTransient: vi.fn(),
      commitToHistory: vi.fn(),
      recordOutputHistory: vi.fn(),
      showToast: vi.fn(),
      openNodeDialog: vi.fn(),
      setToolbarLayout: vi.fn(),
      showToastMessage: vi.fn(),
      setFocusEditNodeId: vi.fn(),
      setPendingPresetAction: vi.fn(),
      pendingPresetAction: null as unknown,
      setHoveredMentionNodeId: vi.fn(),
      onEdgesChange: vi.fn(),
      addNode: vi.fn(),
      setNodes: vi.fn(),
      updatePrompt: vi.fn(),
    };
  }

  async function mountDialog(
    nodeData: Record<string, unknown>,
    canvas: {
      edges?: Array<{ id: string; source: string; target: string }>;
      extraNodes?: Array<Record<string, unknown>>;
    } = {},
  ) {
    vi.resetModules();
    const dialogStore = installDialogStore(nodeData, canvas);
    vi.doMock('../../src/store/useAppStore', () => {
      const useAppStore = Object.assign(<T,>(selector: (state: typeof dialogStore) => T) => selector(dialogStore), {
        getState: () => dialogStore,
      });
      return {
        useAppStore,
        generateId: () => 'generated',
        computeImageNodeDimensions: async () => ({ nodeWidth: 280, nodeHeight: 158 }),
      };
    });
    const { default: AINodeDialog } = await import('../../src/components/nodes/AINodeDialog');
    const utils = render(<AINodeDialog />);
    return { ...utils, dialogStore };
  }

  beforeEach(() => { cleanup(); });

  it('节点上有 `params.modelType` ⇒ chip 首段 = 官方 `VA` 文案', async () => {
    const { container } = await mountDialog({
      type: 'ai-video',
      label: 'Video',
      prompt: '',
      model: 'seedance-2.0',
      params: { modelType: 'reference_to_video', variant: 'reference' },
    });
    const chip = container.querySelector('.ui-schema-menu-trigger');
    expect(chip).not.toBeNull();
    expect(chip!.textContent?.startsWith('全能参考 · ')).toBe(true);
  });

  it('老节点数据没有 `params` ⇒ chip 首段与弹窗「生成方式」行按官方 `Tr` 工厂的 `variants[0]` 兜底出现', async () => {
    /* §123 行为变更（登记）：官方 `Tr` @737829 建卡时把 `modelType: x?.modelType || null`
       （`x = (params.modelType ? find : null) || variants[0]`）写进 params ⇒ **官方节点永远带该字段**；
       MTV 的模型值是 `general/<cfgId>`，别名未解析时 `params.modelType` 会落成 `null`
       （真机取证：`node-uzc77cygr.params.modelType === null`）⇒ 这里按官方同一条 `variants[0]` 规则补回，
       `dd()` 才有值、`M = b && _ && _.length>0 && v` 才会成立。 */
    const { container } = await mountDialog({
      type: 'ai-video',
      label: 'Video',
      prompt: '',
      model: 'seedance-2.0',
    });
    const chip = container.querySelector('.ui-schema-menu-trigger')!;
    expect(chip.textContent?.startsWith('全能参考 · ')).toBe(true);
    fireEvent.click(chip);
    const panel = document.querySelector('.ui-schema-video-params-popup')!;
    expect(panel).not.toBeNull();
    const labels = Array.from(panel.querySelectorAll('.img-rp-section-label'))
      .map((node) => node.textContent?.trim());
    expect(labels).toContain('生成方式');
  });

  it('节点上有 `params.modelType` ⇒ 弹窗出现「生成方式」行，点它写回节点字段', async () => {
    const { container, dialogStore } = await mountDialog({
      type: 'ai-video',
      label: 'Video',
      prompt: '',
      model: 'seedance-2.5',
      params: { modelType: 'text_to_video', variant: 'text' },
    });
    fireEvent.click(container.querySelector('.ui-schema-menu-trigger')!);
    const panel = document.querySelector('.ui-schema-video-params-popup')!;
    const area = Array.from(panel.querySelectorAll('.img-rp-section-label'))
      .find((node) => node.textContent?.trim() === '生成方式')?.parentElement;
    expect(area).toBeTruthy();
    expect(Array.from(area!.querySelectorAll('button')).map((b) => b.textContent?.trim()))
      .toEqual(['首尾帧', '全能参考', '视频编辑']);

    const edit = Array.from(area!.querySelectorAll('button'))
      .find((b) => b.textContent?.trim().startsWith('视频编辑'))!;
    fireEvent.click(edit);

    /* 官方 `an` 逐字：`i({ modelType: kn.modelType, variant: kn.variant, ...er })`
       ⇒ 落到节点数据就是 `params.modelType` / `params.variant`（`updateParams` 是 params 内合并）。 */
    expect(dialogStore.updateNodeData).toHaveBeenCalledWith('video-1', {
      params: { modelType: 'video_edit', variant: 'edit' },
    });
  });

  it('源码级：`AINodeDialog` 把三件套真的传给了 `PromptPanel`', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(process.cwd(), 'src/components/nodes/AINodeDialog.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const prop of [
      'generateMethod={generateMethod}',
      'availableGenerateMethods={availableGenerateMethods}',
      'onGenerateMethodChange={onGenerateMethodChange}',
    ]) {
      expect(src, `${prop} 应出现在 <PromptPanel> 上`).toContain(prop);
    }
    /* `PromptPanel` 再原样转交给 `VideoParamSelector` */
    const panel = readFileSync(resolve(process.cwd(), 'src/components/nodes/shared/PromptPanel.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const prop of [
      'generateMethod={generateMethod}',
      'availableGenerateMethods={availableGenerateMethods}',
      'onGenerateMethodChange={onGenerateMethodChange}',
    ]) {
      expect(panel, `${prop} 应转发给 <VideoParamSelector>`).toContain(prop);
    }
  });

  /* §71 —— 官方 `LXe` 的 `parentCounts` 真的接进了两条 variant 解析路径
     （计数本身的逐字/边界在 `tests/utils/parentReferenceCounts.test.ts`） */
  it('§71 渲染级：连了 1 张图 ⇒ 切「首尾帧」写出 `image_to_video`（官方，不是 `text`）', async () => {
    const { container, dialogStore } = await mountDialog(
      {
        type: 'ai-video',
        label: 'Video',
        prompt: '',
        model: 'seedance-2.0',
        params: { modelType: 'text_to_video', variant: 'text' },
      },
      {
        edges: [{ id: 'e1', source: 'img-1', target: 'video-1' }],
        extraNodes: [{
          id: 'img-1',
          type: 'ai-image',
          position: { x: -400, y: 0 },
          data: { type: 'ai-image', label: 'Image', imageUrl: 'data:image/png;base64,AA' },
        }],
      },
    );
    /* 计数已进节点：`readParentCounts` 读到 1 张图（官方 `LXe` → `Sc`） */
    fireEvent.click(container.querySelector('.ui-schema-menu-trigger')!);
    const panel = document.querySelector('.ui-schema-video-params-popup')!;
    const area = Array.from(panel.querySelectorAll('.img-rp-section-label'))
      .find((node) => node.textContent?.trim() === '生成方式')?.parentElement;
    expect(area).toBeTruthy();
    const frames = Array.from(area!.querySelectorAll('button'))
      .find((b) => b.textContent?.trim().startsWith('首尾帧'))!;
    fireEvent.click(frames);
    /* 官方 `_p`：`imageCount===1 && videoCount===0` ⇒ `image_to_video`（**不是** `text_to_video`） */
    expect(dialogStore.updateNodeData).toHaveBeenCalledWith('video-1', {
      params: { modelType: 'image_to_video', variant: 'image' },
    });
  });

  it('§71 渲染级：没有连线 ⇒ 同一颗按钮仍写出 `text_to_video`', async () => {
    const { container, dialogStore } = await mountDialog({
      type: 'ai-video',
      label: 'Video',
      prompt: '',
      model: 'seedance-2.0',
      params: { modelType: 'text_to_video', variant: 'text' },
    });
    fireEvent.click(container.querySelector('.ui-schema-menu-trigger')!);
    const panel = document.querySelector('.ui-schema-video-params-popup')!;
    const area = Array.from(panel.querySelectorAll('.img-rp-section-label'))
      .find((node) => node.textContent?.trim() === '生成方式')?.parentElement;
    expect(area).toBeTruthy();
    const frames = Array.from(area?.querySelectorAll('button') ?? [])
      .find((b) => b.textContent?.trim().startsWith('首尾帧'));
    expect(frames).toBeTruthy();
    fireEvent.click(frames as HTMLElement);
    expect(dialogStore.updateNodeData).toHaveBeenCalledWith('video-1', {
      params: { modelType: 'text_to_video', variant: 'text' },
    });
  });

  it('源码级（§71）：两处 variant 解析都传真实 `parentCounts`，不再硬编码 0', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    /* ⚠️ 仓库源码是 CRLF ⇒ 先归一化换行，否则多行断言永远失败 */
    const src = readFileSync(resolve(process.cwd(), 'src/components/nodes/AINodeDialog.tsx'), 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    /* 官方 `CQe`（选模型，canvas:@2037060） */
    expect(src).toContain(
      'videoVariantForModel(model.value, parentCounts.imageCount, parentCounts.videoCount, parentCounts.audioCount)',
    );
    /* 官方 `an`（切「生成方式」，canvas:@2058180） */
    expect(src).toContain(
      'modelId,\n        method,\n        parentCounts.imageCount,\n        parentCounts.videoCount,\n        parentCounts.audioCount,',
    );
    /* 计数来自官方 `LXe` 的同源实现（`Cee`→`Ac`→`vu`→`Sc`） */
    expect(src).toContain("import { collectParentReferenceCounts } from '../../utils/referenceTokens';");
    expect(src).toContain('collectParentReferenceCounts(activeNodeId, state.edges ?? [], state.nodes)');
    /* 旧缺口（一律按 0）必须已经消失 */
    expect(src).not.toContain('videoVariantForModel(model.value, 0, 0, 0)');
    expect(src).not.toContain('videoVariantForMethod(modelId, method, 0, 0, 0)');
  });
});
