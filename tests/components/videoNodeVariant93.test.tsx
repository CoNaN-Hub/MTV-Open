// @vitest-environment jsdom
/**
 * §93 —— 官方**视频节点变体分派**（`data.type`）+ 官方**标题命名逻辑**。
 *
 * 逐字证据（`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`，偏移 = JS 字符串 charIdx）：
 *
 * | 项 | 官方符号 | 偏移 | 逐字 |
 * |---|---|---|---|
 * | 变体枚举 | `_o` | @152208 | `var _o=(e=>(e.UPLOAD="upload",e.GENERATE="generate",e.UPSCALE="upscale",e.CLIP="clip",e))(_o||{})` |
 * | 分派 | `vV` / `fse` | @2093744 | `const vV={[_o.UPLOAD]:dse,[_o.GENERATE]:cse,[_o.CLIP]:qoe,[_o.UPSCALE]:mse}` · `const o=e.data.type\|\|_o.GENERATE; return vV[o]\|\|vV[_o.GENERATE]` |
 * | GENERATE 体 | `cse` | @2076580 | `y?s.jsx(O0,{src:G,…}):s.jsx(EF,{isUploading:x})` · `C=n?.title\|\|"Video"` |
 * | UPLOAD 体 | `dse` | @2081160 | `…s.jsx(O0,{src:d,nodeId:e,selected:t}),!c&&s.jsx(TE,{…})…`（**无空态件**，也**无 `Su`**） |
 * | 标题壳 | `gr` | @846915 | `H=y?.title\|\|i\|\|"Title"` |
 * | 标题渲染 | `WDe` | @833604 | `children:e`（原样，无本地化） |
 * | 生成卡工厂 | `Tr` | @743392 | `C={src:"",prompt:"",title:"Video",type:_o.GENERATE,…}` |
 * | 上传卡工厂 | `ePe`/`KT` | @741800 | `data:{src:"",title:"Upload Video",type:_o.UPLOAD,…}` |
 * | 上传标题 | `S0t`+`qO` | @3522844 / @3522516 | `KT({src:t,title:qO(e,"Video")},…)` · `function qO(e,t){ return e.name?.split(".")[0]\|\|t }` |
 * | 上传体按钮 | `TE` | @1673867 | `canvas.replace`（zh @4324745「替换」· en @3651031 `Replace` · ja @4047530「置換」· ko @4188137「교체」） |
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const OFFICIAL_VIDEO_ICON_PATH_PREFIX = 'M31.7998 3C33.727';
const MTV_SELF_DRAWN_POLYGON = 'polygon[points="23 7 16 12 23 17 23 7"]';

const store = vi.hoisted(() => ({
  nodes: [] as Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>,
  edges: [] as Array<{ id: string; source: string; target: string }>,
  selectedNodeIds: ['video-1'] as string[],
  currentProjectId: 'project-a',
  outputHistoryRecords: [] as unknown[],
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

async function renderVideoNode(extra: Record<string, unknown> = {}) {
  if (Object.keys(extra).length) {
    store.nodes[0].data = { ...store.nodes[0].data, ...extra };
  }
  const { default: VideoNode } = await import('../../src/components/nodes/VideoNode');
  return render(<VideoNode id="video-1" data={store.nodes[0].data as never} selected />);
}

// ── 1. 变体解析（官方 `fse` 的分派语义） ──────────────────────────────────────
describe('变体解析（官方 `vV` / `fse` @2093744）', () => {
  it('官方 `_o` 值域逐字 = upload / generate / upscale / clip', async () => {
    const mod = await import('../../src/utils/officialVideoNodeVariant');
    expect(mod.OFFICIAL_VIDEO_NODE_TYPE).toEqual({
      UPLOAD: 'upload',
      GENERATE: 'generate',
      UPSCALE: 'upscale',
      CLIP: 'clip',
    });
  });

  it('无字段 ⇒ 官方缺省 `_o.GENERATE`（`e.data.type||_o.GENERATE`）', async () => {
    const { resolveOfficialVideoNodeType } = await import('../../src/utils/officialVideoNodeVariant');
    expect(resolveOfficialVideoNodeType({ type: 'ai-video', label: 'Video' })).toBe('generate');
    expect(resolveOfficialVideoNodeType({ type: 'ai-video', label: 'Video', role: 'generator' })).toBe('generate');
    expect(resolveOfficialVideoNodeType(null)).toBe('generate');
  });

  it('显式变体原样生效（四个值全覆盖）', async () => {
    const { resolveOfficialVideoNodeType } = await import('../../src/utils/officialVideoNodeVariant');
    for (const v of ['upload', 'generate', 'upscale', 'clip']) {
      expect(resolveOfficialVideoNodeType({ type: 'ai-video', label: 'x', videoNodeType: v })).toBe(v);
    }
  });

  it('未知值 ⇒ `vV[o]||vV[_o.GENERATE]` 回落 GENERATE', async () => {
    const { resolveOfficialVideoNodeType } = await import('../../src/utils/officialVideoNodeVariant');
    expect(resolveOfficialVideoNodeType({ type: 'ai-video', label: 'x', videoNodeType: 'nope' })).toBe('generate');
    expect(resolveOfficialVideoNodeType({ type: 'ai-video', label: 'x', videoNodeType: 42 })).toBe('generate');
  });

  it('历史数据兼容：`role:"source"`（MTV 旧上传路径）⇒ 官方 UPLOAD', async () => {
    const { resolveOfficialVideoNodeType } = await import('../../src/utils/officialVideoNodeVariant');
    expect(resolveOfficialVideoNodeType({ type: 'source-video', label: 'a.mp4', role: 'source' })).toBe('upload');
    /* 显式字段优先于 role */
    expect(resolveOfficialVideoNodeType({
      type: 'source-video', label: 'a.mp4', role: 'source', videoNodeType: 'generate',
    })).toBe('generate');
  });
});

// ── 2. 官方标题命名逻辑 ──────────────────────────────────────────────────────
describe('标题（官方 `gr` @846915 `H=y?.title||i||"Title"` + 各变体 defaultTitle）', () => {
  it('GENERATE 空卡 ⇒ 官方工厂硬编码字面量 `Video`', async () => {
    const { resolveOfficialVideoNodeTitle } = await import('../../src/utils/officialVideoNodeVariant');
    expect(resolveOfficialVideoNodeTitle({ type: 'ai-video', label: '', status: 'idle' })).toBe('Video');
    expect(resolveOfficialVideoNodeTitle({ type: 'ai-video', videoNodeType: 'generate' })).toBe('Video');
  });

  it('存量「生成视频」按官方口径被视作**未自定义** ⇒ 回落 `Video`', async () => {
    const { resolveOfficialVideoNodeTitle } = await import('../../src/utils/officialVideoNodeVariant');
    expect(resolveOfficialVideoNodeTitle({ type: 'ai-video', label: '生成视频' })).toBe('Video');
    expect(resolveOfficialVideoNodeTitle({ type: 'source-video', label: '视频', role: 'source' }))
      .toBe('Upload Video');
  });

  it('用户真正改过的标题**不吞**（官方 `data.title` 优先）', async () => {
    const { resolveOfficialVideoNodeTitle } = await import('../../src/utils/officialVideoNodeVariant');
    expect(resolveOfficialVideoNodeTitle({ type: 'ai-video', label: '我的镜头 01' })).toBe('我的镜头 01');
    expect(resolveOfficialVideoNodeTitle({
      type: 'source-video', role: 'source', label: '客户改名', fileName: 'a.mp4',
    })).toBe('客户改名');
  });

  it('UPLOAD ⇒ 官方 `qO` @3522516：**文件名去掉扩展名**', async () => {
    const { resolveOfficialVideoNodeTitle, officialUploadTitleFromFileName } =
      await import('../../src/utils/officialVideoNodeVariant');
    expect(officialUploadTitleFromFileName('TapNow_1777389894033_Video_1.mp4', 'Video'))
      .toBe('TapNow_1777389894033_Video_1');
    /* MTV 上传路径把 label 写成**带扩展名的文件名** ⇒ 与 fileName 相同即未自定义，按官方去扩展名 */
    expect(resolveOfficialVideoNodeTitle({
      type: 'source-video', role: 'source', label: 'TapNow_1.mp4', fileName: 'TapNow_1.mp4',
    })).toBe('TapNow_1');
    /* 官方 `ePe` @741800 的建卡默认 */
    expect(resolveOfficialVideoNodeTitle({ type: 'source-video', role: 'source', label: '' }))
      .toBe('Upload Video');
  });

  it('渲染层：MTV 真机存量节点（label「生成视频」）显示 `Video`', async () => {
    const { container } = await renderVideoNode({ label: '生成视频' });
    const text = container.querySelector('.node-label-text');
    expect(text).not.toBeNull();
    expect(text!.textContent).toBe('Video');
  });

  it('渲染层：上传来源节点显示官方 `qO` 结果（文件名去扩展名），不是原始文件名', async () => {
    const { container } = await renderVideoNode({
      label: 'TapNow_1777389894033_Video_1.mp4',
      fileName: 'TapNow_1777389894033_Video_1.mp4',
      role: 'source',
      videoUrl: 'asset://video.mp4',
    });
    expect(container.querySelector('.node-label-text')!.textContent)
      .toBe('TapNow_1777389894033_Video_1');
  });
});

// ── 3. 卡体按变体分派 ───────────────────────────────────────────────────────
describe('卡体分派（官方 `cse` 空态 vs `dse` 上传体）', () => {
  it('GENERATE + 无 src ⇒ 官方 `EF` 空态（48×48 · opacity .2 · 官方视频图标）', async () => {
    const { container } = await renderVideoNode();
    const svg = container.querySelector('.node-preview svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 48 48');
    expect(svg!.querySelector('path')!.getAttribute('d')!.startsWith(OFFICIAL_VIDEO_ICON_PATH_PREFIX)).toBe(true);
    expect(svg!.querySelector('g')!.getAttribute('opacity')).toBe('0.2');
  });

  it('UPLOAD + 无 src ⇒ **空白**（官方 `dse` 无空态件；`O0` 对空 src `return null`）', async () => {
    const { container } = await renderVideoNode({ role: 'source', videoNodeType: 'upload' });
    const preview = container.querySelector('.node-preview')!;
    expect(preview.querySelector('svg')).toBeNull();
    expect(preview.textContent).toBe('');
  });

  it('UPLOAD ⇒ 卡上按钮是官方 `TE`「替换」（`canvas.replace`），**不是**「上传」胶囊', async () => {
    const { container } = await renderVideoNode({ role: 'source', videoNodeType: 'upload' });
    const buttons = Array.from(container.querySelectorAll('button'));
    const replace = buttons.find((b) => b.textContent === '替换');
    expect(replace).toBeTruthy();
    /* 官方 `TE` 的图标 `Da` = IconUpload 20px */
    expect((replace!.querySelector('.official-icon') as HTMLElement).style.width).toBe('20px');
    expect(buttons.some((b) => b.textContent === '上传')).toBe(false);
  });

  it('UPLOAD 的「替换」点击走官方 `onClick:m`（= `triggerUpload`）', async () => {
    const { container } = await renderVideoNode({ role: 'source', videoNodeType: 'upload' });
    const replace = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '替换')!;
    replace.click();
    expect(uploadSpy).toHaveBeenCalledTimes(1);
  });

  it('GENERATE ⇒ 仍然是官方「上传」胶囊（`canvas.upload`），没有被替换键顶掉', async () => {
    const { container } = await renderVideoNode();
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some((b) => b.textContent === '上传')).toBe(true);
    expect(buttons.some((b) => b.textContent === '替换')).toBe(false);
  });
});

// ── 4. 两处自绘件必须消失（用户裁决 三-2 / 三-3） ────────────────────────────
describe('自绘件已删除', () => {
  it('「有 videoUrl 无封面」不再渲染自绘相机占位（官方 0 命中）', async () => {
    const { container } = await renderVideoNode({ videoUrl: 'asset://video.mp4' });
    const preview = container.querySelector('.node-preview')!;
    expect(preview.querySelector('.node-preview-placeholder')).toBeNull();
    expect(preview.querySelector(MTV_SELF_DRAWN_POLYGON)).toBeNull();
    expect(preview.querySelector('polygon')).toBeNull();
    expect(preview.querySelector('rect[x="1"][y="5"]')).toBeNull();
  });

  it('UPLOAD 空态不再渲染自绘上传箭头（`M21 15v4a2 2 0 0 1-2 2H5…`）', async () => {
    const { container } = await renderVideoNode({ role: 'source', videoNodeType: 'upload' });
    const d = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');
    expect(d.some((v) => v.includes('M21 15v4a2 2 0 0 1-2 2H5'))).toBe(false);
    expect(container.querySelector('polyline[points="17 8 12 3 7 8"]')).toBeNull();
  });
});

// ── 5. 底部生成输入条只在 GENERATE 变体出现（官方 `Su` 只在 `cse` 里） ──────
describe('底部生成输入条的门（官方 `Su` 只挂在 `cse`）', () => {
  it('UPLOAD 变体 ⇒ 输入条被挡（`isInputBarSuppressedNode`）', async () => {
    const { isInputBarSuppressedNode } = await import('../../src/utils/officialInputBar');
    expect(isInputBarSuppressedNode('source-video', { role: 'source' } as never)).toBe(true);
    expect(isInputBarSuppressedNode('ai-video', { videoNodeType: 'upload' } as never)).toBe(true);
    expect(isInputBarSuppressedNode('ai-video', { videoNodeType: 'generate' } as never)).toBe(false);
    expect(isInputBarSuppressedNode('ai-video', { label: 'Video' } as never)).toBe(false);
    /* 图像那一支不受影响 */
    expect(isInputBarSuppressedNode('ai-image', { role: 'generator' } as never)).toBe(false);
  });

  it('§114 **GENERATE 变体且有 src（生成卡）⇒ 输入条必须挂载**（官方 `tse` 里 `Su` 的门只看选中/拖拽/生成中）', async () => {
    const { isInputBarSuppressedNode } = await import('../../src/utils/officialInputBar');
    /* 官方 r100 `live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @2074243 区（`tse` 结尾逐字）：
         `s.jsx(_u,{visible:m&&!I&&!_&&!w,isDragging:t,children:s.jsx(ese,{nodeId:o})})`
       而 UPLOAD 体 `nse`（@2074360 区 → `nse.displayName="UploadVideoNode"` @2075352）的 JSX 里
       **既无 `_u` 也无 `ese`**，只挂节点工具条 `s.jsx(IT,{…})`
       ⇒ 「有 src」**不是**挡底栏的理由；只有 **UPLOAD 变体**才挡。
       本用例钉住这条：生成卡（`videoNodeType:'generate'` 或未写变体 + 无 file-backed 证据）
       即便已经有 `videoUrl`，也不许被挡。 */
    expect(isInputBarSuppressedNode('ai-video', { videoNodeType: 'generate', videoUrl: 'a.mp4' } as never)).toBe(false);
    expect(isInputBarSuppressedNode('ai-video', { videoUrl: 'a.mp4', status: 'success' } as never)).toBe(false);
    expect(isInputBarSuppressedNode('ai-video', { role: 'generator', videoUrl: 'a.mp4' } as never)).toBe(false);
    /* 真·上传卡（本地文件证据齐全）⇒ 仍按官方 `_o.UPLOAD` 挡掉（MTV 真机实证：
       `node-ucc1nchln` / `node-5jrvsrkh5` 的 `label===fileName===TapNow_…_Video_1.mp4`、
       `filePath` 指向本地文件、`role:'source'`、无 `videoNodeType`） */
    expect(isInputBarSuppressedNode('ai-video', {
      role: 'source', fileName: 'TapNow_1777389894033_Video_1.mp4', videoUrl: 'a.mp4',
    } as never)).toBe(true);
  });
});

// ── 6. `canvas.replace` 四语（官方逐字） ────────────────────────────────────
describe('`canvas.replace` 四语', () => {
  it('zh「替换」/ en `Replace` / ja「置換」/ ko「교체」', async () => {
    const i18n = await import('../../src/i18n');
    const expected: Array<[string, string]> = [
      ['zh-CN', '替换'],
      ['en-US', 'Replace'],
      ['ja-JP', '置換'],
      ['ko-KR', '교체'],
    ];
    for (const [locale, want] of expected) {
      i18n.setLocale(locale);
      expect([locale, i18n.t('替换')]).toEqual([locale, want]);
    }
    i18n.setLocale('zh-CN');
  });
});
