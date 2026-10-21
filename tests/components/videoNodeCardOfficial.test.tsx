// @vitest-environment jsdom
/**
 * 视频节点卡（官方 1:1）—— jsdom DOM 级验证。
 *
 * 覆盖：
 *  1. 卡片本体：`<video>` 的官方 class / `data-testid`，左上角官方操作区（静音键）的逐字 class
 *     + 静音键点击真的改 `<video>.muted`
 *  2. 悬停控制条（`VideoNodeControls` = 官方 `$T` / `VideoHoverControls`）：播放/暂停、进度、时间、
 *     静音、全屏键存在性 + 进度条隐藏门 + 官方容器 class
 *  3. 工具栏项按 `hasSrc` / 生成中 的显隐与 disabled（官方 `invisible`/`disabled` 门）
 *  4. 底部编辑区（`AINodeDialog` 浮层）：官方 `node-float-ui generation-input-bar-width-transition`
 *     容器 class 与官方 prompt 结构（prompt/footer/submit）—— MTV 的视频底部编辑区就是这一条
 *
 * 官方偏移证据见 src/components/nodes/shared/video/officialVideoTestIds.ts 与
 * `D:\DEEPSEEK\agent-挖掘覆盖表.md` §54。
 */
import { createRef, type RefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

/* ── 底部编辑区（AINodeDialog 浮层）用的桩 ─────────────────────────────────── */
vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (value: string) => value }));
vi.mock('../../src/components/nodes/shared/WorkflowApiTaskStatus', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/image/cameraStudio', () => ({
  buildGenerationCameraPrompt: () => '',
}));
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
vi.mock('../../src/services/projectSettingsService', () => ({
  getImageNodeDimensionsForAspectRatio: () => ({ nodeWidth: 280, nodeHeight: 158 }),
  resolveProjectGenerationPrompt: (prompt: string) => prompt,
}));

// ── store / i18n 打桩 ────────────────────────────────────────────────────────

const store = vi.hoisted(() => ({
  nodes: [] as Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>,
  edges: [] as Array<{ id: string; source: string; target: string }>,
  selectedNodeIds: ['video-1'] as string[],
  currentProjectId: 'project-a',
  outputHistoryRecords: [] as unknown[],
  /** 官方收藏体系（`store.favorites.ts`）：视频卡左上角第二颗键读它 */
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

vi.mock('../../src/i18n', () => ({ useT: () => (message: string) => message }));

/* React Flow 的 `useStore` 需要 zustand provider；卡片本体用例不需要真实画布上下文 */
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
vi.mock('../../src/components/nodes/shared/useSourceFileUpload', () => ({
  useSourceFileUpload: () => ({ isUploading: false, handleUpload: vi.fn() }),
}));
vi.mock('../../src/services/fileService', () => ({
  downloadUrlAndSave: vi.fn(),
  saveDataUrlToProjectData: vi.fn(),
  buildNodeFileName: () => 'frame.jpg',
  saveNodeOutputToFile: vi.fn(async () => ({ ok: true })),
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
vi.mock('../../src/components/nodes/shared/NodeLabel', () => ({ default: 'NodeLabel' }));
vi.mock('../../src/components/nodes/shared/NodeError', () => ({ default: 'NodeError' }));
vi.mock('../../src/components/nodes/shared/GooeyBtn', () => ({ default: 'GooeyBtn' }));
vi.mock('../../src/components/nodes/shared/NodeGenerationProgress', () => ({ default: 'NodeGenerationProgress' }));

// ── 假 <video>：足够驱动 VideoNodeControls 的监听与状态 ──────────────────────

class FakeVideo {
  paused = true;
  ended = false;
  currentTime = 0;
  duration = 10;
  muted = true;
  volume = 1;
  videoWidth = 1920;
  videoHeight = 1080;
  readyState = 4;
  src = 'asset://video.mp4';
  listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, handler: () => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, handler: () => void) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type: string) {
    this.listeners.get(type)?.forEach((handler) => handler());
  }

  play = vi.fn(async () => { this.paused = false; this.emit('play'); });
  pause = vi.fn(() => { this.paused = true; this.emit('pause'); });
  load = vi.fn();
  getAttribute = () => this.src;
  removeAttribute = vi.fn();
}

let fakeVideo: FakeVideo;

beforeEach(() => {
  cleanup();
  vi.resetModules();
  store.nodes = [{
    id: 'video-1',
    type: 'ai-video',
    position: { x: 0, y: 0 },
    data: { type: 'ai-video', label: 'Video', videoUrl: 'asset://video.mp4' },
  }];
  store.edges = [];
  store.selectedNodeIds = ['video-1'];
  store.favoriteStatuses = {};
  store.config = { favoriteSourceFileIds: {} };
  fakeVideo = new FakeVideo();
});

// ── 1. 卡片本体 ──────────────────────────────────────────────────────────────

describe('video card body (official VideoPlayer markup)', () => {
  it('renders the official <video> class, test id, preload and muted initial state', async () => {
    const { default: VideoNode } = await import('../../src/components/nodes/VideoNode');
    const { container } = render(<VideoNode id="video-1" data={store.nodes[0].data as never} selected />);

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    /* ⚠️ 官方的逐字 class 是
       `absolute inset-0 h-full w-full rounded-2xl object-contain transition-opacity duration-150
        opacity-100|opacity-0 [blur-xl]`；MTV 沿用自有布局 class `video-preview-player compact`
       （生命周期测试按它取播放器），这里断言官方**属性**与官方初始静音态。 */
    expect(video!.getAttribute('data-testid')).toBe('canvas-node-video-content');
    expect(video!.getAttribute('preload')).toBe('auto');
    expect(video!.hasAttribute('crossorigin')).toBe(true);
    /* 官方 store `aU` 默认 `isMuted: !0` ⇒ 卡片初始静音 */
    expect(video!.muted).toBe(true);
  });

  it('renders the official top-left overlay button with the verbatim official classes', async () => {
    const { default: VideoNode } = await import('../../src/components/nodes/VideoNode');
    const { container } = render(<VideoNode id="video-1" data={store.nodes[0].data as never} selected />);

    const overlay = container.querySelector('.node-preview')?.querySelector('div.absolute.top-3.left-3');
    expect(overlay).not.toBeNull();
    expect(overlay!.className).toContain('absolute top-3 left-3 z-20 flex items-center gap-1 nodrag');
    expect(overlay!.className).toContain('transition-opacity duration-150');
    /* 未 hover 且未选中该卡（这里 selected 来自 React Flow prop，官方可见门读 hover/selected/clip）
       ⇒ 具体可见性由 selected 决定；class 必须二选一恰好其一 */
    expect(
      overlay!.className.includes('opacity-100') || overlay!.className.includes('opacity-0 pointer-events-none'),
    ).toBe(true);

    const muteButton = overlay!.querySelector('button');
    expect(muteButton).not.toBeNull();
    expect(muteButton!.className).toContain('h-7 w-7 rounded-[10px] bg-black/50');
    expect(muteButton!.className).toContain('hover:bg-black/70');
    expect(muteButton!.className).toContain('flex items-center justify-center cursor-pointer transition-colors');
    expect(muteButton!.getAttribute('aria-label')).toBe('取消静音');
  });

  it('omits the favourite key when the asset cannot be resolved (official `p && …` / `if(!o) return null`)', async () => {
    /* 本用例的节点只有 `asset://video.mp4`（`Xs(url)` 三条正则都不命中、也没有
       `currentSourceFileId/assetId/relativePath/filePath`）⇒ `favoriteTargetOf`(=`g8`) 返回 `null`
       ⇒ 官方 `Goe` 的 `p && <button/>` 那一支不成立。收藏键的正例见
       `videoNodeOfficialVideoParts.test.tsx`。 */
    const { default: VideoNode } = await import('../../src/components/nodes/VideoNode');
    const { container } = render(<VideoNode id="video-1" data={store.nodes[0].data as never} selected />);
    const overlay = container.querySelector('.node-preview')?.querySelector('div.absolute.top-3.left-3');
    expect(overlay!.querySelectorAll('button')).toHaveLength(1);
  });
});

// ── 2. 悬停控制条 ────────────────────────────────────────────────────────────

describe('video hover controls (official VideoHoverControls markup)', () => {
  async function renderControls(props: Record<string, unknown> = {}) {
    const { default: VideoNodeControls } = await import('../../src/components/nodes/shared/VideoNodeControls');
    const videoRef = createRef<HTMLVideoElement>() as unknown as RefObject<HTMLVideoElement | null>;
    (videoRef as { current: unknown }).current = fakeVideo;
    const onFullscreen = vi.fn();
    const onRequestPlayback = vi.fn();
    const utils = render(
      <VideoNodeControls
        videoRef={videoRef}
        source="asset://video.mp4"
        active
        isHovering
        muted
        onToggleMute={vi.fn()}
        showFullscreen
        onFullscreen={onFullscreen}
        onRequestPlayback={onRequestPlayback}
        {...props}
      />,
    );
    /* 让 effect 里的 `syncState()` 与监听器注册生效 */
    return { ...utils, onFullscreen, onRequestPlayback };
  }

  it('uses the official container classes and the official visible/invisible pair', async () => {
    const { container } = await renderControls();
    const bar = container.firstElementChild as HTMLElement;
    for (const token of [
      'absolute', 'bottom-0', 'left-0', 'right-0', 'z-20', 'nodrag', 'rounded-b-2xl',
      'bg-gradient-to-t', 'from-black/45', 'via-black/20', 'to-transparent',
      'px-2', 'pb-2.5', 'pt-8', 'flex', 'items-center', 'gap-2',
      'transition-all', 'duration-200', 'ease-out', 'opacity-100', 'translate-y-0',
    ]) {
      expect(bar.className.split(/\s+/)).toContain(token);
    }
  });

  it('hides the bar with the official opacity/translate/pointer-events trio when not hovering', async () => {
    const { container } = await renderControls({ isHovering: false });
    const bar = container.firstElementChild as HTMLElement;
    const tokens = bar.className.split(/\s+/);
    expect(tokens).toContain('opacity-0');
    expect(tokens).toContain('translate-y-1');
    expect(tokens).toContain('pointer-events-none');
    expect(tokens).not.toContain('opacity-100');
  });

  it('toggles play/pause on the bound <video> and mirrors the official ghost button class', async () => {
    const { container } = await renderControls();
    const playButton = screen.getByLabelText('播放视频');
    expect(playButton.className).toContain('h-6 w-6 p-0 text-white hover:text-white/80');
    expect(playButton.className).toContain('shrink-0 pointer-events-auto transition-colors');

    fireEvent.click(playButton);
    expect(fakeVideo.play).toHaveBeenCalledTimes(1);
    fakeVideo.paused = false;
    fakeVideo.emit('play');
    const pauseButton = screen.getByLabelText('暂停视频');
    fireEvent.click(pauseButton);
    expect(fakeVideo.pause).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBeTruthy();
  });

  it('renders the official progress range with its verbatim arbitrary-variant classes and seeks on change', async () => {
    const { container } = await renderControls();
    const range = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(range).not.toBeNull();
    expect(range.className).toContain('relative w-full h-4 bg-transparent cursor-pointer appearance-none z-10');
    expect(range.className).toContain('[&::-webkit-slider-thumb]:w-3');
    expect(range.className).toContain('[&::-webkit-slider-thumb]:hover:scale-110');
    expect(range.className).toContain('[&::-moz-range-thumb]:border-0');

    fireEvent.change(range, { target: { value: '4' } });
    expect(fakeVideo.currentTime).toBe(4);
  });

  it('shows the official time pair and drops the progress bar when hideProgressBar is set', async () => {
    const { container } = await renderControls();
    expect(container.textContent).toContain('0:00');
    expect(container.textContent).toContain('/');
    expect(container.querySelector('input[type="range"]')).not.toBeNull();

    const { container: hidden } = await renderControls({ hideProgressBar: true });
    expect(hidden.querySelector('input[type="range"]')).toBeNull();
    expect(hidden.firstElementChild!.getAttribute('data-hide-progress-bar')).toBe('true');
  });

  it('mutes the bound <video> from the control bar', async () => {
    fakeVideo.muted = false;
    const { container } = await renderControls({ muted: undefined });
    const muteButton = screen.getByLabelText('静音');
    fireEvent.click(muteButton);
    expect(fakeVideo.muted).toBe(true);
    expect(container.textContent).toContain('/');
  });

  it('renders the fullscreen button only when the official nodeId gate passes', async () => {
    const { container, onFullscreen } = await renderControls();
    const button = within(container).getByTestId('canvas-node-video-fullscreen-btn');
    expect(button.getAttribute('aria-label')).toBe('全屏');
    fireEvent.click(button);
    expect(onFullscreen).toHaveBeenCalledTimes(1);

    const hidden = await renderControls({ showFullscreen: false });
    expect(within(hidden.container).queryByTestId('canvas-node-video-fullscreen-btn')).toBeNull();
  });
});

// ── 3. 工具栏项显隐 / disabled ───────────────────────────────────────────────

describe('video node toolbar official action set and gates', () => {
  it('registers exactly the official desktop 0.4.99 keys (others are MTV-only and hidden)', async () => {
    const { VIDEO_BUTTONS } = await import(
      '../../src/components/nodes/shared/toolbar/toolbarRegistry'
    );
    const keys = VIDEO_BUTTONS.map((button) => button.key);
    /* 官方桌面版主行（左组 F 的 MTV 对应物 + **pin 组** + 右组 I 逐字 + ⋯）；
       §96 起键名也照官方 `xXe` 逐字：`video_frame_capture`(@1975961) / `scale`(@1974297)；
       §113（2026-10-15 用户裁决）按官方 `G=[O,...U?[[U]]:[],F]`（r100 @1969928）
       加入中间那组 `pin` ⇒ 注册表顺序 = 左组 · more · pin · 右组 · MTV 自有(隐藏)。 */
    expect(keys).toEqual([
      'upscale', 'video_frame_capture', 'more', 'pin', 'saveToLibrary', 'download', 'scale',
      'copyFile', 'showPrompt', 'reversePrompt',
    ]);
    const mainRow = VIDEO_BUTTONS.filter((button) => !button.defaultHidden).map((button) => button.key);
    expect(mainRow).toEqual(['upscale', 'video_frame_capture', 'more', 'pin', 'saveToLibrary', 'download', 'scale']);
    /* 官方右组顺序逐字：saveToLibrary → download → scale（pin 是它前面独立的一组） */
    expect(mainRow.slice(4)).toEqual(['saveToLibrary', 'download', 'scale']);
    expect(mainRow.slice(3, 4)).toEqual(['pin']);
    /* MTV 自有项只进 ⋯ */
    for (const key of ['copyFile', 'showPrompt', 'reversePrompt']) {
      expect(VIDEO_BUTTONS.find((button) => button.key === key)?.defaultHidden).toBe(true);
    }
  });

  it('migrates the legacy v2 default to the new official default layout', async () => {
    const { getDefaultLayout, migrateToolbarLayout } = await import(
      '../../src/components/nodes/shared/toolbar/toolbarRegistry'
    );
    const legacy = {
      version: 2,
      zones: [{ id: 'zone-0', name: '常用', buttonKeys: ['copyFile', 'captureFrame', 'showPrompt', 'reversePrompt', 'fullscreen', 'more'] }],
    };
    expect(migrateToolbarLayout('ai-video', legacy)).toEqual(getDefaultLayout('ai-video'));
  });

  it('keeps user-modified video layouts and only adds the newly official keys', async () => {
    const { migrateToolbarLayout } = await import(
      '../../src/components/nodes/shared/toolbar/toolbarRegistry'
    );
    /* 这份布局是**老用户已经持久化**的 v2：里面存的是 MTV 旧键名 */
    const custom = {
      version: 2,
      zones: [{ id: 'zone-0', name: '常用', buttonKeys: ['fullscreen'] }],
    };
    const migrated = migrateToolbarLayout('ai-video', custom);
    /* §96 旧键 `fullscreen` → 官方 `scale`（改名 + 补键一步不落） */
    expect(migrated.zones[0].buttonKeys).toContain('scale');
    expect(migrated.zones[0].buttonKeys).not.toContain('fullscreen');
    expect(migrated.zones[0].buttonKeys).toContain('upscale');
    expect(migrated.zones[0].buttonKeys).toContain('download');
    /* §113：目标版本 4 → 5（视频工具栏拆三段 + 补官方 pin 组） */
    expect(migrated.version).toBe(5);
  });

  it('§96 v3 布局里的旧键（fullscreen / captureFrame）读入时改名成官方键，且迁移幂等', async () => {
    const { migrateToolbarLayout } = await import(
      '../../src/components/nodes/shared/toolbar/toolbarRegistry'
    );
    const storedV3 = {
      version: 3,
      zones: [
        { id: 'zone-0', name: '常用', buttonKeys: ['upscale', 'captureFrame', 'more'] },
        { id: 'zone-1', name: '常用', buttonKeys: ['saveToLibrary', 'download', 'fullscreen'] },
      ],
    };
    const migrated = migrateToolbarLayout('ai-video', storedV3);
    expect(migrated.version).toBe(5);
    /* 原两个分区的**键名/顺序/键数**一个不变（`captureFrame`→`video_frame_capture`、
       `fullscreen`→`scale`），§113 另把官方 `pin` 作为**独立一组**插在「含 more 的那组」之后。 */
    expect(migrated.zones).toEqual([
      { id: 'zone-0', name: '常用', buttonKeys: ['upscale', 'video_frame_capture', 'more'] },
      { id: 'zone-video-pin', name: 'Pin', buttonKeys: ['pin'] },
      { id: 'zone-1', name: '常用', buttonKeys: ['saveToLibrary', 'download', 'scale'] },
    ]);
    /* 幂等：把迁移结果再喂一遍，必须逐字不变（不会又改一次 / 不会补回用户删掉的键） */
    expect(migrateToolbarLayout('ai-video', migrated)).toEqual(migrated);
    /* 幂等（不依赖版本号）：把结果版本号伪造成 3 再跑，键名也已稳定 */
    expect(migrateToolbarLayout('ai-video', { ...migrated, version: 3 })).toEqual(migrated);
  });

  it('§96 用户若已手工放进新键，旧键不会造成重复项', async () => {
    const { migrateToolbarLayout } = await import(
      '../../src/components/nodes/shared/toolbar/toolbarRegistry'
    );
    const mixed = {
      version: 3,
      zones: [{ id: 'zone-0', name: '常用', buttonKeys: ['scale', 'fullscreen'] }],
    };
    const migrated = migrateToolbarLayout('ai-video', mixed);
    expect(migrated.zones[0].buttonKeys).toEqual(['scale']);
  });

  it('gates every official key on "has src" and disables download while downloading', async () => {
    /* `NodeToolbarShell` 在本文件被 mock 掉（卡片本体用例不需要浮动层），
       这里用 `vi.doMock` + `beforeEach` 的 `vi.resetModules()` 重新拿到真实工具栏。 */
    vi.doMock('../../src/hooks/useToolbarEdit', async () => {
      const registry = await import('../../src/components/nodes/shared/toolbar/toolbarRegistry');
      const layout = registry.getDefaultLayout('ai-video');
      return {
        useToolbarEdit: () => ({
          isEditing: false,
          layout,
          registry: registry.getButtonRegistry('ai-video'),
          activeButtonKeys: new Set(layout.zones.flatMap((zone) => zone.buttonKeys)),
          longPressHandlers: {},
          removedButtons: [],
        }),
      };
    });
    vi.doMock('../../src/components/nodes/shared/toolbar/NodePluginToolbarButtons', () => ({
      useNodePluginToolbar: () => ({ renderButton: () => null, dialog: null }),
    }));

    const { default: VideoNodeToolbar } = await import('../../src/components/nodes/shared/VideoNodeToolbar');
    const noop = vi.fn();
    const baseProps = {
      nodeId: 'video-1',
      onCaptureFrame: noop,
      onFullscreen: noop,
      onCopyFile: noop,
      onReversePrompt: noop,
      onShowPrompt: noop,
    };

    /* 无 src：官方 `invisible: !k || t` ⇒ 主行整排消失（⋯ 也因为没有可见项而不渲染） */
    const withoutSrc = render(<VideoNodeToolbar {...baseProps} hasSrc={false} />);
    expect(withoutSrc.container.querySelector('.act-upscale')).toBeNull();
    expect(withoutSrc.container.querySelector('.act-scale')).toBeNull();
    expect(withoutSrc.container.querySelector('.act-download')).toBeNull();
    withoutSrc.unmount();

    /* 有 src：官方三颗键在，且带官方 data-testid */
    const withSrc = render(<VideoNodeToolbar {...baseProps} hasSrc isDownloading={false} />);
    expect(within(withSrc.container).getByTestId('canvas-node-video-upscale-btn')).toBeTruthy();
    expect(within(withSrc.container).getByTestId('canvas-node-video-download-btn')).toBeTruthy();
    expect(within(withSrc.container).getByTestId('canvas-node-video-fullscreen-btn')).toBeTruthy();
    expect(within(withSrc.container).getByTestId('canvas-node-video-capture-frame-btn')).toBeTruthy();
    expect(withSrc.container.querySelector('.act-upscale')!.hasAttribute('disabled')).toBe(false);
    withSrc.unmount();

    /* 下载中：官方 `disabled: !k || t || isDownloading` */
    const downloading = render(<VideoNodeToolbar {...baseProps} hasSrc isDownloading />);
    expect(downloading.container.querySelector('.act-download')!.hasAttribute('disabled')).toBe(true);
    downloading.unmount();
  });

  /* ══ 官方 `video_frame_capture`：`buttonType:"more"` 的三帧下拉 ══
     证据：桌面版 `course-api-base-url-DmmB7bTf.js@2687052`（工具项）+ `@2680931`（`x2e` 菜单表）。 */
  it('renders the frame capture trigger as an official "more" dropdown with the official tooltip and testid', async () => {
    const { default: VideoNodeToolbar } = await importRealVideoToolbar();
    const noop = vi.fn();
    const { container } = render(
      <VideoNodeToolbar
        nodeId="video-1"
        hasSrc
        onCaptureFrame={noop}
        onFullscreen={noop}
        onCopyFile={noop}
        onReversePrompt={noop}
        onShowPrompt={noop}
      />,
    );

    /* 官方 `tooltip: y("video.captureFrame")` =「截帧」（触发器 tooltip，不是 MTV 原来的「截取帧」） */
    const trigger = within(container).getByTestId('canvas-node-video-capture-frame-btn');
    expect(trigger.getAttribute('aria-label')).toBe('截帧');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.className).toContain('act-captureFrame');
    /* 未展开时菜单不存在 */
    expect(container.querySelector('.toolbar-more-menu--official')).toBeNull();
  });

  it('opens the official three-item capture menu with the verbatim zh labels and no invented icons', async () => {
    const { default: VideoNodeToolbar } = await importRealVideoToolbar();
    const noop = vi.fn();
    const { container } = render(
      <VideoNodeToolbar
        nodeId="video-1"
        hasSrc
        onCaptureFrame={noop}
        onFullscreen={noop}
        onCopyFile={noop}
        onReversePrompt={noop}
        onShowPrompt={noop}
      />,
    );

    fireEvent.click(within(container).getByTestId('canvas-node-video-capture-frame-btn'));

    /* 官方菜单外壳：官方 `dPe` 的竖向「图标+文字」列表 */
    const menu = container.querySelector('.toolbar-more-menu--official');
    expect(menu).not.toBeNull();
    expect(menu!.getAttribute('role')).toBe('menu');

    const rows = Array.from(container.querySelectorAll('.toolbar-more-menu-row'));
    expect(rows.map((row) => row.textContent)).toEqual(['截取当前帧', '截取首帧', '截取尾帧']);
    /* 官方三项**都没有 icon** ⇒ 行内不渲染任何图标（不编造） */
    for (const row of rows) {
      expect(row.querySelector('svg')).toBeNull();
    }
  });

  it('dispatches the official mode for each capture row', async () => {
    const { default: VideoNodeToolbar } = await importRealVideoToolbar();
    const onCaptureFrame = vi.fn();
    const noop = vi.fn();
    const { container } = render(
      <VideoNodeToolbar
        nodeId="video-1"
        hasSrc
        onCaptureFrame={onCaptureFrame}
        onFullscreen={noop}
        onCopyFile={noop}
        onReversePrompt={noop}
        onShowPrompt={noop}
      />,
    );

    /* 官方 `x2e` 的 mode 映射逐字：capture_current→current · capture_first→first · capture_last→last */
    const expectations: Array<[string, 'current' | 'first' | 'last']> = [
      ['截取当前帧', 'current'],
      ['截取首帧', 'first'],
      ['截取尾帧', 'last'],
    ];
    let calls = 0;
    for (const [label, mode] of expectations) {
      /* 菜单点行后**保持打开**（官方 radix 关、MTV 自管壳体不关）⇒ 只在没开时点一次触发器 */
      if (!container.querySelector('.toolbar-more-menu--official')) {
        fireEvent.click(within(container).getByTestId('canvas-node-video-capture-frame-btn'));
      }
      const row = Array.from(container.querySelectorAll('.toolbar-more-menu-row'))
        .find((candidate) => candidate.textContent === label);
      expect(row).toBeTruthy();
      fireEvent.click(row!);
      calls += 1;
      expect(onCaptureFrame).toHaveBeenLastCalledWith(mode);
      /* ⚠️ 官方 `dPe` 普通行（`Uo` = DropdownMenuItem）的点击**只执行 `E.handle()`**，
         关菜单由 radix `DropdownMenu` 的 item-select 语义负责；MTV 的 `ToolbarMoreMenu`
         是**自管开合**（普通行不调 `setOpen(false)`，只有子操作 chips 那条分支关）⇒
         这里断言「已执行 + 行仍是官方形态」，不断言自管关合（那是 MTV 壳体差异，已记 §54.5）。 */
      expect(onCaptureFrame).toHaveBeenCalledTimes(calls);
      expect(container.querySelector('.toolbar-more-menu--official')).not.toBeNull();
    }
    expect(onCaptureFrame).toHaveBeenCalledTimes(3);
  });

  it('hides the whole capture row when the node has no src (official invisible gate)', async () => {
    const { default: VideoNodeToolbar } = await importRealVideoToolbar();
    const noop = vi.fn();
    const { container } = render(
      <VideoNodeToolbar
        nodeId="video-1"
        hasSrc={false}
        onCaptureFrame={noop}
        onFullscreen={noop}
        onCopyFile={noop}
        onReversePrompt={noop}
        onShowPrompt={noop}
      />,
    );
    /* 官方 `invisible: !k || C || t` ⇒ 该项整颗不渲染（此时该卡所有官方键都无 src） */
    expect(container.querySelector('.act-captureFrame')).toBeNull();
    expect(container.querySelector('.toolbar-more-menu--official')).toBeNull();
  });
});

/** 真实 `VideoNodeToolbar`（文件顶部只把 `NodeToolbarShell` mock 成 null） */
async function importRealVideoToolbar() {
  vi.doMock('../../src/hooks/useToolbarEdit', async () => {
    const registry = await import('../../src/components/nodes/shared/toolbar/toolbarRegistry');
    const layout = registry.getDefaultLayout('ai-video');
    return {
      useToolbarEdit: () => ({
        isEditing: false,
        layout,
        registry: registry.getButtonRegistry('ai-video'),
        activeButtonKeys: new Set(layout.zones.flatMap((zone) => zone.buttonKeys)),
        longPressHandlers: {},
        removedButtons: [],
      }),
    };
  });
  vi.doMock('../../src/components/nodes/shared/toolbar/NodePluginToolbarButtons', () => ({
    useNodePluginToolbar: () => ({ renderButton: () => null, dialog: null }),
  }));
  return import('../../src/components/nodes/shared/VideoNodeToolbar');
}

// ── 4. 底部编辑区（视频卡的 prompt / 参考 / 参数 / 生成提交都在这里）────────────

describe('video bottom editor (official generation input bar)', () => {
  function installDialogStore() {
    const dialogStore = {
      activeNodeId: 'video-1' as string | null,
      dialogPosition: null as { x: number; y: number } | null,
      selectedNodeIds: ['video-1'] as string[],
      canvasNodeDragging: false,
      galleryNodeId: null as string | null,
      nodes: [] as Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>,
      edges: [] as Array<{ id: string; source: string; target: string }>,
      workflows: [] as unknown[],
      currentProjectId: 'project-a',
      config: { performanceMode: false },
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
    };
    return dialogStore;
  }

  it('uses the official container classes and the official data-testid for the input bar', async () => {
    const dialogStore = installDialogStore();
    dialogStore.nodes = [{
      id: 'video-1',
      type: 'ai-video',
      position: { x: 0, y: 0 },
      data: { type: 'ai-video', label: 'Video', videoUrl: 'asset://video.mp4', prompt: '' },
    }];

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
    vi.doMock('../../src/components/nodes/shared/PromptPanel', () => ({
      default: ({ nodeType }: { nodeType: string }) => (
        <div data-testid="prompt-panel-stub" data-node-type={nodeType}>prompt</div>
      ),
    }));

    const { default: AINodeDialog } = await import('../../src/components/nodes/AINodeDialog');
    const { container } = render(<AINodeDialog />);

    const bar = container.querySelector('.ai-dialog-float');
    expect(bar).not.toBeNull();
    /* 官方容器 class（`components`/web @1198716 逐字）：本仓库用 `.ai-dialog-float` 表达 fixed 浮层，
       但官方那三个语义类必须同时在 */
    const tokens = bar!.className.split(/\s+/);
    expect(tokens).toContain('node-float-ui');
    expect(tokens).toContain('generation-input-bar-width-transition');
    expect(tokens).toContain('node-float-ui-visible');
    expect(bar!.getAttribute('data-testid')).toBe('canvas-node-generation-input-bar');

    /* 底部编辑区的主体：prompt / 参考 / 参数 / 生成提交都由官方 PromptPanel 承载 */
    const panel = within(container).getByTestId('prompt-panel-stub');
    expect(panel.getAttribute('data-node-type')).toBe('ai-video');
  });

  it('keeps the video edit bar unmounted when nothing is selected', async () => {
    const dialogStore = installDialogStore();
    dialogStore.activeNodeId = null;
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
    const { container } = render(<AINodeDialog />);
    expect(container.querySelector('[data-testid="canvas-node-generation-input-bar"]')).toBeNull();
  });
});
