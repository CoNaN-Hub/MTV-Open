// @vitest-environment jsdom
/**
 * §92 —— 官方「空视频卡」收口：标题文案 / 标题图标 / 卡体空态占位 / 「上传」胶囊 / 底部 chip 门。
 *
 * 逐字证据（`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`，偏移 = JS 字符串 charIdx）：
 *
 * | 项 | 官方符号 | 偏移 | 逐字值 |
 * |---|---|---|---|
 * | 菜单文案 | `nodes.videoNode` | zh @4403524 · en @3781502 · ja @4135656 · ko @4276918 | 「视频」/`Video`/「動画」/「비디오」 |
 * | **卡片默认标题** | `Tr`（视频节点工厂） | @742021 | `C={src:"",prompt:"",title:"Video",type:_o.GENERATE,…}` ⇒ **硬编码 `"Video"`，不走 i18n** |
 * | 标题渲染 | `gr`/`pLe` → `WDe` | @846915 / @833604 | `H=y?.title\|\|i\|\|"Title"` → `children:e`（原样） |
 * | 标题图标 | `cse` → `es`（vp 局部 `T6`） | @2076580 / @319667 | `titleIcon:s.jsx(es,{opacity:1})`；`T6=({size=48,opacity=.2})`，这里被 `PJ`（@833535 `size-[1em] [&>svg]:size-full`）压到 1em |
 * | 空态占位 | `EF`（`NoVideoHelper`） | @1956117 | `<div className="w-full h-full flex items-center justify-center"><es/></div>`（默认 size 48 / opacity .2） |
 * | 上传胶囊 | `Hne`（`NodeUploadButton`）在 `SE`（`NodeUploadToolbar`）里 | @1617962 / @1618713 | `canvas.upload`（zh「上传」@4335234 · en `Upload` @3668454 · ja「アップロード」@4060451 · ko「업로드」@4200790） |
 * | 上传胶囊门 | `cse` | @2076580 | `k = e && !y && !d && !N && !x && !E` |
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

/* ── 官方视频图标（`es` = vp `T6` = `IconNodeVideo`）的真实 path 前缀，
      用来把「官方件」和「MTV 自绘件」区分开 ── */
const OFFICIAL_VIDEO_ICON_PATH_PREFIX = 'M31.7998 3C33.727';
/* MTV 自绘的相机占位 path（官方 4 个产物 0 命中） */
const MTV_SELF_DRAWN_POLYGON = 'polygon[points="23 7 16 12 23 17 23 7"]';

// ── store 打桩（形状照 `videoNodeCardOfficial.test.tsx`） ─────────────────────
const store = vi.hoisted(() => ({
  nodes: [] as Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>,
  edges: [] as Array<{ id: string; source: string; target: string }>,
  selectedNodeIds: ['video-1'] as string[],
  currentProjectId: 'project-a',
  outputHistoryRecords: [] as unknown[],
  favoriteStatuses: {} as Record<string, boolean>,
  config: { favoriteSourceFileIds: {} as Record<string, boolean> } as Record<string, unknown>,
  toggleFavorite: vi.fn(async () => {}),
  updateNodeData: vi.fn(),
  updateNodeDataTransient: vi.fn(),
  showToast: vi.fn(),
  openNodeDialog: vi.fn(),
  openSaveToLibraryMenu: vi.fn(),
  addNode: vi.fn(),
  setReversePromptRequest: vi.fn(),
  getCurrentRevision: () => 1,
}));

vi.mock('../../src/store/useAppStore', () => {
  const useAppStore = Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
  });
  return {
    useAppStore,
    generateId: () => 'generated',
    computeImageNodeDimensions: async () => ({ nodeWidth: 280, nodeHeight: 158 }),
  };
});
/* 标题行里的 Pin 指示器槽：本文件只量标题文案/图标，Pin 一律「无」 */
vi.mock('../../src/store/store.pin', () => ({ useFilteredPinGroupId: () => null }));
vi.mock('../../src/components/nodes/shared/PinIndicator', () => ({ default: () => null }));
vi.mock('../../src/services/canvasPin', () => ({ readPins: () => [] }));

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
  cancelCanvasDerivation: vi.fn(),
}));
vi.mock('../../src/services/projectSettingsService', () => ({
  getImageNodeDimensionsForAspectRatio: () => ({ nodeWidth: 280, nodeHeight: 158 }),
  resolveProjectGenerationPrompt: (prompt: string) => prompt,
}));

/* React Flow：只需 `Handle` / `Position` / `useStore` */
vi.mock('@xyflow/react', () => ({
  Handle: 'handle',
  Position: { Left: 'left', Right: 'right' },
  useStore: (selector: (state: { transform: [number, number, number] }) => unknown) => (
    selector({ transform: [0, 0, 1] })
  ),
}));

vi.mock('../../src/hooks/useCompletionFlash', () => ({ useCompletionFlash: () => false }));
vi.mock('../../src/hooks/useCanvasNodeLod', () => ({ useCanvasNodeLodProtection: vi.fn() }));
vi.mock('../../src/hooks/useNodeInPile', () => ({ useNodeInPile: () => false }));
vi.mock('../../src/components/nodes/shared/useNodeRename', () => ({
  useNodeRename: () => ({ displayLabel: 'Video', handleRename: vi.fn() }),
}));
const uploadSpy = vi.hoisted(() => vi.fn());
vi.mock('../../src/components/nodes/shared/useSourceFileUpload', () => ({
  useSourceFileUpload: () => ({ isUploading: false, handleUpload: uploadSpy }),
}));
vi.mock('../../src/services/fileService', () => ({
  downloadUrlAndSave: vi.fn(),
  saveDataUrlToProjectData: vi.fn(),
  buildNodeFileName: () => 'frame.jpg',
  saveNodeOutputToFile: vi.fn(async () => ({ ok: true })),
  getAssetUrlFromPath: vi.fn(),
  renameProjectFileToLabel: vi.fn(),
}));
vi.mock('../../src/services/clipboardService', () => ({ copyFile: vi.fn() }));
vi.mock('../../src/services/indexedDbService', () => ({ buildVideoEditorProjectId: () => 'editor' }));
vi.mock('../../src/services/videoEditorWindowService', () => ({
  postVideoEditorAiTransitionResult: vi.fn(),
  postVideoEditorModels: vi.fn(),
  subscribeVideoEditorWindow: () => vi.fn(),
}));
vi.mock('../../src/services/videoEditorAiTransitionService', () => ({
  listVideoEditorVideoModels: vi.fn(),
  runVideoEditorAiTransition: vi.fn(),
}));
vi.mock('../../src/store/store.utils', () => ({
  blobToDataUrl: async () => 'data:image/jpeg;base64,frame',
  derivedNodePlacement: () => ({ position: { x: 0, y: 0 } }),
}));
vi.mock('../../src/utils/videoSeek', () => ({ seekVideoTo: vi.fn() }));
vi.mock('../../src/components/nodes/shared/video/canvasVideoPreviewCache', () => ({
  acquireCanvasVideoPoster: vi.fn(() => new Promise(() => {})),
  releaseCanvasVideo: vi.fn(),
  waitForCanvasVideoReady: vi.fn(async () => undefined),
}));
vi.mock('../../src/components/nodes/shared/media/MediaViewer', () => ({ default: 'MediaViewer' }));
vi.mock('../../src/components/nodes/shared/media/MediaViewerActions', () => ({ default: 'MediaViewerActions' }));
vi.mock('../../src/components/nodes/shared/NodeToolbarShell', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/NodeError', () => ({ default: 'NodeError' }));
vi.mock('../../src/components/nodes/shared/GooeyBtn', () => ({ default: 'GooeyBtn' }));
vi.mock('../../src/components/nodes/shared/NodeGenerationProgress', () => ({ default: 'NodeGenerationProgress' }));

beforeEach(() => {
  cleanup();
  vi.resetModules();
  uploadSpy.mockClear();
  store.nodes = [{
    id: 'video-1',
    type: 'ai-video',
    position: { x: 0, y: 0 },
    data: { type: 'ai-video', label: 'Video' },
  }];
  store.edges = [];
  store.selectedNodeIds = ['video-1'];
});

async function renderVideoNode(extra: Record<string, unknown> = {}, edges: typeof store.edges = []) {
  store.edges = edges;
  if (Object.keys(extra).length) {
    store.nodes[0].data = { ...store.nodes[0].data, ...extra };
  }
  const { default: VideoNode } = await import('../../src/components/nodes/VideoNode');
  return render(<VideoNode id="video-1" data={store.nodes[0].data as never} selected />);
}

// ── 1. 官方四语文案 ──────────────────────────────────────────────────────────
describe('官方文案（逐字）', () => {
  it('卡片默认标题 = 官方工厂硬编码字面量 "Video"（不走 i18n）', async () => {
    const { buildNodeData } = await import('../../src/components/sidebar/nodePickerActions');
    expect(buildNodeData('ai-video').label).toBe('Video');
    /* 其它节点的 label 一律不动（只收口视频这一处） */
    expect(buildNodeData('ai-image').label).toBe('生成图像');
    expect(buildNodeData('ai-audio').label).toBe('生成音频');
  });

  it('菜单文案常量 = 官方 `nodes.videoNode` 的 zh 原文「视频」', async () => {
    const { NODE_TYPE_CONFIG } = await import('../../src/types');
    expect(NODE_TYPE_CONFIG['ai-video'].label).toBe('视频');
    expect(NODE_TYPE_CONFIG['ai-image'].label).toBe('生成图像');
    expect(NODE_TYPE_CONFIG['ai-audio'].label).toBe('生成音频');
  });

  it('`nodes.videoNode` 四语（zh/en/ja/ko）与官方逐字一致', async () => {
    const i18n = await import('../../src/i18n');
    const expected: Array<[string, string]> = [
      ['zh-CN', '视频'],
      ['en-US', 'Video'],
      ['ja-JP', '動画'],
      ['ko-KR', '비디오'],
    ];
    for (const [locale, want] of expected) {
      i18n.setLocale(locale);
      expect([locale, i18n.t('视频')]).toEqual([locale, want]);
    }
    i18n.setLocale('zh-CN');
  });

  it('`canvas.upload` 四语（zh/en/ja/ko）与官方逐字一致', async () => {
    const i18n = await import('../../src/i18n');
    const expected: Array<[string, string]> = [
      ['zh-CN', '上传'],
      ['en-US', 'Upload'],
      ['ja-JP', 'アップロード'],
      ['ko-KR', '업로드'],
    ];
    for (const [locale, want] of expected) {
      i18n.setLocale(locale);
      expect([locale, i18n.t('上传')]).toEqual([locale, want]);
    }
    i18n.setLocale('zh-CN');
  });
});

// ── 2. 标题图标 = 官方 `es`（vp `T6`），opacity 1 ─────────────────────────────
describe('标题行图标', () => {
  it('用官方视频图标（48 视框 / `M31.7998 3C33.727…`），不再用 iconify mdi:video-outline', async () => {
    const { default: NodeLabel } = await import('../../src/components/nodes/shared/NodeLabel');
    const { container } = render(
      <NodeLabel kind="ai-video" label="Video" nodeId="video-1" onRename={vi.fn()} />,
    );
    const icon = container.querySelector('.node-label-icon');
    expect(icon).not.toBeNull();
    const svg = icon!.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 48 48');
    expect(svg!.querySelector('path')!.getAttribute('d')!.startsWith(OFFICIAL_VIDEO_ICON_PATH_PREFIX)).toBe(true);
    /* 官方 `titleIcon:s.jsx(es,{opacity:1})` ⇒ 内层 <g> 的 opacity 必须是 1（不是空态那支的 .2） */
    expect(svg!.querySelector('g')!.getAttribute('opacity')).toBe('1');
    /* 旧的自造图标（iconify MDI）必须消失 */
    expect(container.querySelector('.iconify--mdi')).toBeNull();
  });
});

// ── 3. 空卡占位 = 官方 `EF`（`NoVideoHelper`） ───────────────────────────────
describe('空卡占位', () => {
  it('无 src 时渲染官方 `EF`：居中 + 官方视频图标（48×48 · opacity .2）', async () => {
    const { container } = await renderVideoNode();
    const holder = container.querySelector('.node-preview > div.w-full.h-full.flex.items-center.justify-center');
    expect(holder).not.toBeNull();
    const svg = holder!.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('48');
    expect(svg!.getAttribute('height')).toBe('48');
    expect(svg!.getAttribute('viewBox')).toBe('0 0 48 48');
    expect(svg!.querySelector('path')!.getAttribute('d')!.startsWith(OFFICIAL_VIDEO_ICON_PATH_PREFIX)).toBe(true);
    expect(svg!.querySelector('g')!.getAttribute('opacity')).toBe('0.2');
  });

  it('空态**不含** MTV 自绘件（`node-preview-placeholder` / 相机 polygon / 圆角 rect）', async () => {
    const { container } = await renderVideoNode();
    const preview = container.querySelector('.node-preview')!;
    expect(preview.querySelector(MTV_SELF_DRAWN_POLYGON)).toBeNull();
    expect(preview.querySelector('rect[x="1"][y="5"][width="15"][height="14"]')).toBeNull();
    expect(preview.querySelector('.node-preview-placeholder')).toBeNull();
  });
});

// ── 4. 「上传」胶囊（官方 `SE`/`Hne`） ───────────────────────────────────────
describe('上传胶囊（官方 NodeUploadToolbar / NodeUploadButton）', () => {
  it('空卡 + 选中 + 无入边 ⇒ 有胶囊，且文案/图标/几何逐字', async () => {
    const { container } = await renderVideoNode();
    const pill = container.querySelector('.node-upload-pill');
    expect(pill).not.toBeNull();
    expect(pill!.tagName).toBe('BUTTON');
    expect(pill!.textContent).toBe('上传');
    /* 官方 `Hne` 的图标 = `Da`（vp `gc`，导出表 `IconUpload`），16px */
    const icon = pill!.querySelector('.official-icon');
    expect(icon).not.toBeNull();
    expect((icon as HTMLElement).style.width).toBe('16px');
    expect(pill!.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 48 48');
  });

  it('点击胶囊触发官方 `onClick` 路径（上传）', async () => {
    const { container } = await renderVideoNode();
    const pill = container.querySelector('.node-upload-pill') as HTMLButtonElement;
    pill.click();
    expect(uploadSpy).toHaveBeenCalledTimes(1);
  });

  it('官方门 `k = selected && !src && !d && !N && !x && !E` ⇒ 有 src 时没有胶囊', async () => {
    const { container } = await renderVideoNode({ videoUrl: 'asset://video.mp4' });
    expect(container.querySelector('.node-upload-pill')).toBeNull();
  });

  it('官方门 `!N`（生成中）⇒ 生成中的空卡没有胶囊', async () => {
    const { container } = await renderVideoNode({ status: 'loading' });
    expect(container.querySelector('.node-upload-pill')).toBeNull();
  });

  it('官方门 `!E`（有入边）⇒ 被当作参考输入的空卡没有胶囊', async () => {
    const { container } = await renderVideoNode({}, [{ id: 'e1', source: 'image-1', target: 'video-1' }]);
    expect(container.querySelector('.node-upload-pill')).toBeNull();
  });
});

// ── 5. 底部 chip 的显示条件（离线判定：`VideoParamSelector` 的官方 `Poe` 口径） ──
describe('底部 chip 显示条件（官方 `VideoConfigsTrigger` = `Poe`）', () => {
  it('模型声明了比例/清晰度/时长/音频 ⇒ 与官方同形（`全能参考 · 16:9 · 720p` + `5s` + 🔊）', async () => {
    const { videoConfigsTriggerLabel, videoConfigsTriggerDurationLabel, videoConfigsTriggerShowsAudio } =
      await import('../../src/components/nodes/shared/VideoParamSelector');
    const label = videoConfigsTriggerLabel('16:9', '720p', undefined, '全能参考', '自适应', '自适应');
    expect(label).toBe('全能参考 · 16:9 · 720p');
    expect(videoConfigsTriggerDurationLabel(5, '自动')).toBe('5s');
    expect(videoConfigsTriggerShowsAudio(true, true)).toBe(true);
  });

  it('模型**没**声明比例与清晰度 ⇒ 只剩 `自适应`（= 图2 的 MTV 现状）', async () => {
    const { videoConfigsTriggerLabel, videoConfigsTriggerDurationLabel, videoConfigsTriggerShowsAudio } =
      await import('../../src/components/nodes/shared/VideoParamSelector');
    const label = videoConfigsTriggerLabel(undefined, undefined, undefined, undefined, '自适应', '自适应');
    expect(label).toBe('自适应');
    /* 未声明时长/音频时对应段一律不渲染（官方 `t ? … : void 0` / `i && l !== void 0`） */
    expect(videoConfigsTriggerDurationLabel(undefined, '自动')).toBeUndefined();
    expect(videoConfigsTriggerShowsAudio(false, undefined)).toBe(false);
  });
});
