// @vitest-environment jsdom
/**
 * 视频卡「官方已有但此前未接上」的部件 —— jsdom DOM 级验证。
 *
 * 对应官方产物 `D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`（charIdx = JS 字符串下标）：
 *   · `Goe`（`displayName="VideoPlayer"` @1961159；`Goe=` @1958433）—— 左上角操作行 + 收藏键
 *   · `O0`（`displayName="VideoRender"` @1964327；`O0=` @1962079）—— 「海报上的收藏指示」
 *   · `$oe`（`displayName="VideoPoster"` @1962047；`$oe=` @1961281）—— 海报 + 重试阶梯
 *
 * 覆盖：
 *  ① 解析到资产 ⇒ 操作行里第二颗键在 DOM 里，class 含官方 `h-7 w-7 rounded-[10px]`，
 *     且 `isFavorited` 切换 `text-[#FBBC05]` / `text-[#F5F5F5]`（官方逐字三元）
 *  ② 点击该键 ⇒ 调 `toggleFavorite(sourceFileId, asset)`，且 `stopPropagation` 生效
 *     （冒泡到卡片外层容器被拦下），`onPointerDown` 也拦下
 *  ③ 解析不到资产（`favoriteTargetOf` 返回 `null`）⇒ 该键**不渲染**（官方 `if(!o) return null` 同结果）
 *  ④ 操作行门 `O = !hasError && !isGenerating && !isGalleryOpen` / 可见门
 *     `U = isHovered || selected || isInClipMode || isFavorited`
 *  ⑤ 官方 `VideoPoster`：`data-testid="video-poster"`、逐字 class、重试阶梯 `[500,1000,2000]`
 *     （`onError` 递增重试 → 重挂 `<img>`；`onLoad` 清定时器；3 次用尽只 warn）
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

/* ── store / i18n / 周边打桩（与 `videoNodeCardOfficial.test.tsx` 同一套，此处只留必需的）── */
const store = vi.hoisted(() => ({
  nodes: [] as Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>,
  edges: [] as Array<{ id: string; source: string; target: string }>,
  selectedNodeIds: ['video-1'] as string[],
  currentProjectId: 'project-a',
  outputHistoryRecords: [] as unknown[],
  /** 官方 `nc.statuses` 的 MTV 表达（`hooks/useFavoriteStatus.ts` 读它 → 回落 config） */
  favoriteStatuses: {} as Record<string, boolean>,
  config: { favoriteSourceFileIds: {} as Record<string, boolean> },
  /** 官方 `L_(sourceFileId, asset)` 的 MTV 版 */
  toggleFavorite: vi.fn(async () => {}),
  updateNodeData: vi.fn(),
  updateNodeDataTransient: vi.fn(),
  showToast: vi.fn(),
  openNodeDialog: vi.fn(),
  addNode: vi.fn(),
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
/* 抽帧封面缓存：`posterState.src` 非空时解析出一张「抽帧封面」，否则保持 pending。
   ⚠️ 官方 `VideoPoster` 的重试阶梯只在**没有 suppliedCover** 的路径上真正生效 ——
      MTV 的 `onPosterError`（`setFailedCover(suppliedCover)`）会在第一次 error 就撤掉
      suppliedCover，从而让海报换成抽帧封面（MTV 既有语义，本轮按要求不改）。
      所以要观察官方的 `[500,1000,2000]` 阶梯，必须走 `generatedCover`（抽帧）这一支。 */
const posterState = vi.hoisted(() => ({ src: null as string | null }));
vi.mock('../../src/components/nodes/shared/video/canvasVideoPreviewCache', () => ({
  acquireCanvasVideoPoster: vi.fn(async () => (posterState.src
    ? {
      src: posterState.src,
      width: 320,
      height: 180,
      videoWidth: 1920,
      videoHeight: 1080,
      duration: 10,
      release: vi.fn(),
    }
    : null)),
  releaseCanvasVideo: vi.fn(),
  waitForCanvasVideoReady: vi.fn(async () => undefined),
}));
vi.mock('../../src/components/nodes/shared/media/MediaViewer', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/media/MediaViewerActions', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/NodeToolbarShell', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/NodeLabel', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/NodeError', () => ({
  default: ({ message }: { message?: string }) => <div data-testid="node-error">{message}</div>,
}));
vi.mock('../../src/components/nodes/shared/GooeyBtn', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/NodeGenerationProgress', () => ({ default: () => null }));

/* ── 官方 class 常量（逐字，来自产物）─────────────────────────────────────── */
/** `Goe` 操作行容器：`z("absolute top-3 left-3 z-20 flex items-center gap-1 nodrag transition-opacity duration-150", …)` */
const OFFICIAL_ACTION_ROW_BASE =
  'absolute top-3 left-3 z-20 flex items-center gap-1 nodrag transition-opacity duration-150';
/** `Goe` 收藏键：`z("h-7 w-7 rounded-[10px] bg-black/50 hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors", t ? "text-[#FBBC05]" : "text-[#F5F5F5]")` */
const OFFICIAL_FAVORITE_BASE =
  'h-7 w-7 rounded-[10px] bg-black/50 hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors';
/** `O0` 海报收藏指示键（整串逐字，含 `text-[#FBBC05]` 与结尾 `nodrag`） */
const OFFICIAL_POSTER_FAVORITE_CLASS =
  'absolute top-3 left-3 z-20 h-7 w-7 rounded-[10px] bg-black/50 text-[#FBBC05] hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors nodrag';
/** `$oe` 的 `<img>` class（`z("absolute inset-0 z-[1] …", n ? "opacity-0" : "opacity-100")`） */
const OFFICIAL_POSTER_CLASS =
  'absolute inset-0 z-[1] h-full w-full rounded-2xl object-cover pointer-events-none transition-opacity duration-[180ms] ease-out motion-reduce:transition-none';
/** 官方 `YB = [500, 1e3, 2e3]` */
const OFFICIAL_POSTER_RETRY_MS = [500, 1000, 2000];

/** 官方 `ql`（Tabler star-filled）的 path 首段 —— 用来区分两颗星（实心 / 描边） */
const STAR_FILLED_PATH_PREFIX = 'M8.243 7.34';
/** 官方 `pu`（Tabler star）的 path 首段 */
const STAR_OUTLINE_PATH_PREFIX = 'M12 17.75';

const REMOTE_VIDEO = 'https://cdn.example.com/files/9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f/clip.mp4';

/** 抽帧封面是异步 effect 里落进 state 的 ⇒ 冲洗微任务直到它出现（fake timers 下不能等 waitFor） */
async function getPoster(container: HTMLElement): Promise<HTMLImageElement> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const poster = container.querySelector<HTMLImageElement>('[data-testid="video-poster"]');
    if (poster) return poster;
    await act(async () => { await Promise.resolve(); });
  }
  throw new Error('video-poster 未出现：抽帧封面没有落进 generatedCover');
}

/** 推进假定时器并把由此产生的 React 更新一起冲掉（否则读到的还是旧 DOM） */
async function advance(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

function baseData(overrides: Record<string, unknown> = {}) {
  return {
    type: 'ai-video',
    label: 'Video',
    videoUrl: REMOTE_VIDEO,
    ...overrides,
  } as never;
}

async function renderNode(
  data: Record<string, unknown>,
  props: {
    selected?: boolean;
    /** React 合成事件冒泡探针：必须挂在**祖先的 React 节点**上，React 的委托分发才会经过它 */
    spies?: { onClick?: () => void; onPointerDown?: () => void };
  } = {},
) {
  const { default: VideoNode } = await import('../../src/components/nodes/VideoNode');
  store.nodes = [{ id: 'video-1', type: 'ai-video', position: { x: 0, y: 0 }, data }];
  const node = <VideoNode id="video-1" data={data as never} selected={props.selected} />;
  if (!props.spies) return render(node);
  return render(
    <div onClick={props.spies.onClick} onPointerDown={props.spies.onPointerDown}>{node}</div>,
  );
}

/** 操作行 = `.node-preview` 下那颗 `div.absolute.top-3.left-3`（不含海报指示键那支） */
function actionRow(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.node-preview > div.absolute.top-3.left-3');
}

/** 操作行里的收藏键（官方第二颗键：图标是星；静音键图标是 volume） */
function favoriteButton(row: HTMLElement | null): HTMLButtonElement | null {
  if (!row) return null;
  return Array.from(row.querySelectorAll('button')).find(
    (button) => button.querySelector('path[d^="M8.243"], path[d^="M12 17.75"]') !== null,
  ) ?? null;
}

beforeEach(() => {
  cleanup();
  vi.resetModules();
  vi.useRealTimers();
  posterState.src = null;
  store.favoriteStatuses = {};
  store.config = { favoriteSourceFileIds: {} };
  store.toggleFavorite = vi.fn(async () => {});
  store.selectedNodeIds = ['video-1'];
});

afterEach(() => {
  vi.useRealTimers();
});

/* ══ ① 收藏键渲染 + 官方 class + #FBBC05 切换规则 ══════════════════════════ */

describe('official VideoPlayer favourite key (Goe second button)', () => {
  it('renders the second key with the verbatim official classes and the outline star when not favourited', async () => {
    const { container } = await renderNode(baseData({ currentSourceFileId: 'file-abc' }));
    const row = actionRow(container);
    expect(row).not.toBeNull();
    /* 官方容器 class 逐字（含 `transition-opacity duration-150`） */
    for (const token of OFFICIAL_ACTION_ROW_BASE.split(' ')) {
      expect(row!.className.split(/\s+/)).toContain(token);
    }
    /* 两颗键：静音 + 收藏（官方 `O && <div>{mute}{p && <favorite/>}</div>`） */
    expect(row!.querySelectorAll('button')).toHaveLength(2);

    const favourite = favoriteButton(row)!;
    expect(favourite).not.toBeNull();
    for (const token of OFFICIAL_FAVORITE_BASE.split(' ')) {
      expect(favourite.className.split(/\s+/)).toContain(token);
    }
    /* 官方三元 `t ? "text-[#FBBC05]" : "text-[#F5F5F5]"`：未收藏 ⇒ `text-[#F5F5F5]` */
    expect(favourite.className).toContain('text-[#F5F5F5]');
    expect(favourite.className).not.toContain('text-[#FBBC05]');
    /* 官方 `pu` = Tabler `star`（描边），path 逐字 */
    const path = favourite.querySelector('path')!;
    expect(path.getAttribute('d')!.startsWith(STAR_OUTLINE_PATH_PREFIX)).toBe(true);
  });

  it('switches to the official filled star + text-[#FBBC05] when the asset is favourited', async () => {
    store.favoriteStatuses = { 'file-abc': true };
    const { container } = await renderNode(baseData({ currentSourceFileId: 'file-abc' }));
    const favourite = favoriteButton(actionRow(container))!;
    expect(favourite.className).toContain('text-[#FBBC05]');
    expect(favourite.className).not.toContain('text-[#F5F5F5]');
    /* 官方 `ql` = Tabler `star-filled`，path 逐字 */
    const path = favourite.querySelector('path')!;
    expect(path.getAttribute('d')!.startsWith(STAR_FILLED_PATH_PREFIX)).toBe(true);
    /* 实心版走 `fill="currentColor"`（`officialFavoriteIcons.tsx` 的 `OfficialStarFilledIcon`） */
    expect(favourite.querySelector('svg')!.getAttribute('fill')).toBe('currentColor');
  });

  it('reads the favourited state from the persisted layer too (config.favoriteSourceFileIds)', async () => {
    store.config = { favoriteSourceFileIds: { 'file-abc': true } };
    const { container } = await renderNode(baseData({ currentSourceFileId: 'file-abc' }));
    expect(favoriteButton(actionRow(container))!.className).toContain('text-[#FBBC05]');
  });
});

/* ══ ② 点击 → toggleFavorite + stopPropagation ═════════════════════════════ */

describe('official favourite key wiring', () => {
  it('calls toggleFavorite(sourceFileId, asset) and stops the click from bubbling', async () => {
    const onCardClick = vi.fn();
    const { container } = await renderNode(baseData({
      currentSourceFileId: 'file-abc',
      prompt: 'a cat',
      title: 'Clip',
    }), { spies: { onClick: onCardClick } });

    const favourite = favoriteButton(actionRow(container))!;
    fireEvent.click(favourite);

    expect(store.toggleFavorite).toHaveBeenCalledTimes(1);
    const [sourceFileId, asset] = store.toggleFavorite.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(sourceFileId).toBe('file-abc');
    /* 官方 `O0` 逐字 `favoriteSource: e`（= 原始 src）⇒ asset.sourceUrl 必须是 `data.videoUrl` */
    expect(asset.sourceUrl).toBe(REMOTE_VIDEO);
    expect(asset.sourceNodeId).toBe('video-1');
    expect(asset.generationType).toBe('ai-video');
    /* 官方 `onClick: B => { B.stopPropagation(); p(c) }` —— 事件不得冒泡到卡片 */
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('stops pointerdown from bubbling (official onPointerDown stopPropagation)', async () => {
    const onCardPointerDown = vi.fn();
    const { container } = await renderNode(
      baseData({ currentSourceFileId: 'file-abc' }),
      { spies: { onPointerDown: onCardPointerDown } },
    );

    fireEvent.pointerDown(favoriteButton(actionRow(container))!);
    expect(onCardPointerDown).not.toHaveBeenCalled();

    /* 对照：静音键官方**没有** onPointerDown 的 stopPropagation ⇒ 它应当冒泡上去 */
    const muteButton = actionRow(container)!.querySelector('button')!;
    fireEvent.pointerDown(muteButton);
    expect(onCardPointerDown).toHaveBeenCalledTimes(1);
  });
});

/* ══ ③ 解析不到资产 ⇒ 不渲染该键 ═══════════════════════════════════════════ */

describe('favourite key is not rendered when the asset cannot be resolved', () => {
  it('omits the key for a bare asset:// url with no file identity', async () => {
    /* `asset://video.mp4`：`Xs(url)` 三条正则都不命中，且没有 currentSourceFileId/assetId/… */
    const { container } = await renderNode(baseData({ videoUrl: 'asset://video.mp4' }));
    const row = actionRow(container);
    expect(row).not.toBeNull();
    expect(row!.querySelectorAll('button')).toHaveLength(1);
    expect(favoriteButton(row)).toBeNull();
  });

  it('renders the key once the node carries a stable file identity', async () => {
    const { container } = await renderNode(baseData({ videoUrl: 'asset://video.mp4', assetId: 'asset-42' }));
    expect(favoriteButton(actionRow(container))).not.toBeNull();
    fireEvent.click(favoriteButton(actionRow(container))!);
    expect(store.toggleFavorite).toHaveBeenCalledTimes(1);
    expect((store.toggleFavorite.mock.calls[0] as unknown as [string])[0]).toBe('asset-42');
  });
});

/* ══ ④ 操作行门 O / U ══════════════════════════════════════════════════════ */

describe('official action row gates (O and U)', () => {
  it('renders the row only when O = !hasError && !isGenerating && !isGalleryOpen', async () => {
    /* 正常态：门开 */
    const normal = await renderNode(baseData({ currentSourceFileId: 'file-abc' }));
    expect(actionRow(normal.container)).not.toBeNull();
    normal.unmount();

    /* O①：官方 `isGenerating`（MTV = `data.status === 'loading'`）⇒ 整排不渲染 */
    const generating = await renderNode(baseData({ currentSourceFileId: 'file-abc', status: 'loading' }));
    expect(actionRow(generating.container)).toBeNull();
    generating.unmount();

    /* O②：官方 `hasError` 的真实生产者 = `<video onError>`（`O0` 的 `onError={I}` → `hasError`）。
       ⚠️ 第 65 轮修正：先前这条用例断言的是 `data.status === 'error'` ⇒ 那是**判断不是实证**，
       且语义不同（`status='error'` 仍可能留着可播放的 `videoUrl`，官方那种情况**不会**隐藏操作行）⇒ 已撤销。 */
    const errored = await renderNode(baseData({
      currentSourceFileId: 'file-abc',
      status: 'error',
      error: 'boom',
    }));
    /* 节点级 `status:'error'` **不是**官方 `hasError` 因子 ⇒ 操作行照旧渲染。 */
    expect(actionRow(errored.container)).not.toBeNull();
    expect(errored.container.querySelector('[data-testid="node-error"]')).not.toBeNull();
    /* 真正的生产者：`<video>` 报错 ⇒ `hasError=true` ⇒ 整排不渲染。
       播放器只在 `shouldMountPlayer`（本节点独占选中 / 已激活 / 正在播）时才挂 ⇒ 这里传 `selected`。 */
    const mounted = await renderNode(baseData({ currentSourceFileId: 'file-abc' }), { selected: true });
    const videoEl = mounted.container.querySelector('video[data-testid="canvas-node-video-content"]');
    expect(videoEl).not.toBeNull();
    expect(actionRow(mounted.container)).not.toBeNull();
    fireEvent.error(videoEl!);
    await act(async () => { await Promise.resolve(); });
    expect(actionRow(mounted.container)).toBeNull();
  });

  it('uses U = isHovered || selected || isInClipMode || isFavorited for the visible/invisible pair', async () => {
    /* 未选中、未 hover、未收藏 ⇒ `opacity-0 pointer-events-none` */
    const hidden = await renderNode(baseData({ currentSourceFileId: 'file-abc' }), { selected: false });
    expect(actionRow(hidden.container)!.className).toContain('opacity-0 pointer-events-none');
    hidden.unmount();

    /* `selected` 为真 ⇒ `opacity-100` */
    const selected = await renderNode(baseData({ currentSourceFileId: 'file-abc' }), { selected: true });
    expect(actionRow(selected.container)!.className).toContain('opacity-100');
    selected.unmount();

    /* hover ⇒ `opacity-100`（官方 `r` 来自 `O0` 包裹层的 onMouseEnter/onMouseLeave） */
    const hovered = await renderNode(baseData({ currentSourceFileId: 'file-abc' }), { selected: false });
    fireEvent.mouseEnter(hovered.container.querySelector('.node-preview')!);
    expect(actionRow(hovered.container)!.className).toContain('opacity-100');
    fireEvent.mouseLeave(hovered.container.querySelector('.node-preview')!);
    expect(actionRow(hovered.container)!.className).toContain('opacity-0 pointer-events-none');
    hovered.unmount();

    /* `isFavorited` ⇒ 即使未选中未 hover 也让操作行可见（官方 `U` 的第 4 项） */
    store.favoriteStatuses = { 'file-abc': true };
    const favourited = await renderNode(baseData({ currentSourceFileId: 'file-abc' }), { selected: false });
    expect(actionRow(favourited.container)!.className).toContain('opacity-100');
  });
});

/* ══ ⑤ 官方 VideoPoster：testid + 逐字 class + 重试阶梯 ════════════════════ */

describe('official VideoPoster ($oe)', () => {
  const THUMB = 'https://cdn.example.com/thumb.jpg';

  it('renders data-testid="video-poster" with the verbatim official classes', async () => {
    const { container } = await renderNode(baseData({
      currentSourceFileId: 'file-abc',
      thumbnailUrl: THUMB,
    }));
    const poster = container.querySelector<HTMLImageElement>('[data-testid="video-poster"]');
    expect(poster).not.toBeNull();
    expect(poster!.getAttribute('src')).toBe(THUMB);
    expect(poster!.getAttribute('alt')).toBe('');
    expect(poster!.getAttribute('decoding')).toBe('async');
    for (const token of OFFICIAL_POSTER_CLASS.split(' ')) {
      expect(poster!.className.split(/\s+/)).toContain(token);
    }
    /* 官方 `n ? "opacity-0" : "opacity-100"` —— 这两支任何时候恰有其一 */
    const tokens = poster!.className.split(/\s+/);
    expect(tokens).toContain('opacity-100');
    expect(tokens).not.toContain('opacity-0');
    /* 旧的 MTV 自有 class 不再出现在视频主封面上 */
    expect(tokens).not.toContain('video-node-poster');
    expect(tokens).not.toContain('video-node-initial-cover');
  });

  it('walks the official retry ladder [500, 1000, 2000] and remounts the <img> each time', async () => {
    vi.useFakeTimers();
    posterState.src = 'blob:mtv-frame-poster';
    const { container } = await renderNode(baseData({ currentSourceFileId: 'file-abc' }));
    const first = await getPoster(container);
    expect(container.querySelectorAll('[data-testid="video-poster"]')).toHaveLength(1);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    /* 第 1 次 onError ⇒ 500ms 后重试（<img> 被重挂 ⇒ DOM 节点换成新的） */
    fireEvent.error(first);
    expect(container.querySelector('[data-testid="video-poster"]')).toBe(first);
    await advance(OFFICIAL_POSTER_RETRY_MS[0]);
    const second = container.querySelector<HTMLImageElement>('[data-testid="video-poster"]')!;
    expect(second).not.toBe(first);
    expect(second.getAttribute('src')).toBe('blob:mtv-frame-poster');

    /* 第 2 次 onError ⇒ 1000ms */
    fireEvent.error(second);
    await advance(OFFICIAL_POSTER_RETRY_MS[1] - 1);
    expect(container.querySelector('[data-testid="video-poster"]')).toBe(second);
    await advance(1);
    const third = container.querySelector<HTMLImageElement>('[data-testid="video-poster"]')!;
    expect(third).not.toBe(second);

    /* 第 3 次 onError ⇒ 2000ms */
    fireEvent.error(third);
    await advance(OFFICIAL_POSTER_RETRY_MS[2]);
    const fourth = container.querySelector<HTMLImageElement>('[data-testid="video-poster"]')!;
    expect(fourth).not.toBe(third);

    /* 阶梯用尽：再 onError 只 warn，不再排定时器 */
    fireEvent.error(fourth);
    await advance(10_000);
    expect(container.querySelector('[data-testid="video-poster"]')).toBe(fourth);
    expect(warn).toHaveBeenCalledWith('Video poster failed to load', expect.objectContaining({
      log_source: 'video_poster_load',
      nodeId: 'video-1',
      src: 'blob:mtv-frame-poster',
    }));
    warn.mockRestore();
  });

  it('clears the pending retry timer on load (official onLoad)', async () => {
    vi.useFakeTimers();
    posterState.src = 'blob:mtv-frame-poster';
    const { container } = await renderNode(baseData({ currentSourceFileId: 'file-abc' }));
    const poster = await getPoster(container);

    fireEvent.error(poster);
    /* 定时器还没到点就 load ⇒ 官方 `d()` 清掉它 ⇒ 永不重试 */
    fireEvent.load(poster);
    await advance(10_000);
    expect(container.querySelector('[data-testid="video-poster"]')).toBe(poster);
  });

  it('clears the pending retry timer on unmount', async () => {
    vi.useFakeTimers();
    posterState.src = 'blob:mtv-frame-poster';
    const rendered = await renderNode(baseData({ currentSourceFileId: 'file-abc' }));
    const poster = await getPoster(rendered.container);
    fireEvent.error(poster);
    const pending = vi.getTimerCount();
    expect(pending).toBeGreaterThan(0);
    rendered.unmount();
    /* 官方 `useEffect(() => () => { l.current !== null && window.clearTimeout(l.current) }, [])` */
    expect(vi.getTimerCount()).toBeLessThan(pending);
  });

  it('keeps the MTV supplied-thumbnail fallback: the first error drops suppliedCover (documented divergence)', async () => {
    /* ⚠️ 这条记录的是 **MTV 既有语义**（本轮按要求不改）：
       当封面来自 `data.thumbnailUrl`（`suppliedCover`）时，第一次 `onError` 就会
       `setFailedCover` ⇒ MTV 换封面（而不是像官方那样把同一个 src 重试 3 次）。
       官方阶梯这时会被「撤换封面」抢先，且卸载清理会清掉已排的定时器。 */
    vi.useFakeTimers();
    posterState.src = null;
    const { container } = await renderNode(baseData({
      currentSourceFileId: 'file-abc',
      thumbnailUrl: THUMB,
    }));
    const poster = container.querySelector<HTMLImageElement>('[data-testid="video-poster"]')!;
    expect(poster.getAttribute('src')).toBe(THUMB);

    fireEvent.error(poster);
    await advance(10_000);
    /* suppliedCover 被撤掉、又没有抽帧封面 ⇒ 海报整支退场（MTV 既有行为） */
    expect(container.querySelector('[data-testid="video-poster"]')).toBeNull();
  });
});

/* ══ 官方 `O0` 的「海报上的收藏指示」（播放器未挂载时才出现）═══════════════ */

/**
 * 官方 `O0` 的海报收藏指示是 `.node-preview` 的**直接子** `<button class="absolute top-3 left-3 …">`；
 * 同排的操作行是 `<div class="absolute top-3 left-3 …">`（不同标签）⇒ 这条选择器只命中指示键。
 */
const POSTER_FAVORITE_SELECTOR = '.node-preview > button.absolute.top-3.left-3';

describe('official VideoRender poster favourite indicator', () => {
  it('is absent while the player is mounted and while nothing is favourited', async () => {
    /* 选中 ⇒ 播放器挂载门为真 ⇒ 官方 `L = !k && …` 为假 */
    const mounted = await renderNode(baseData({ currentSourceFileId: 'file-abc' }), { selected: true });
    expect(mounted.container.querySelector(POSTER_FAVORITE_SELECTOR)).toBeNull();
    mounted.unmount();

    /* 未收藏 ⇒ `u` 为假 ⇒ 也不渲染 */
    const notFavourited = await renderNode(baseData({ currentSourceFileId: 'file-abc' }), { selected: false });
    expect(notFavourited.container.querySelector(POSTER_FAVORITE_SELECTOR)).toBeNull();
  });

  it('renders the verbatim poster indicator button when unmounted + favourited, and toggles on click', async () => {
    store.favoriteStatuses = { 'file-abc': true };
    const { container } = await renderNode(baseData({ currentSourceFileId: 'file-abc' }), { selected: false });
    const indicator = container.querySelector<HTMLButtonElement>(POSTER_FAVORITE_SELECTOR);
    expect(indicator).not.toBeNull();
    /* 官方整串逐字（含 `text-[#FBBC05]` 与结尾 `nodrag`） */
    for (const token of OFFICIAL_POSTER_FAVORITE_CLASS.split(' ')) {
      expect(indicator!.className.split(/\s+/)).toContain(token);
    }
    /* 官方 `children: s.jsx(ql,{size:16})` —— 恒为实心星 */
    expect(indicator!.querySelector('path')!.getAttribute('d')!.startsWith(STAR_FILLED_PATH_PREFIX)).toBe(true);

    fireEvent.click(indicator!);
    expect(store.toggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('disappears when the card is generating (official !o term of L)', async () => {
    store.favoriteStatuses = { 'file-abc': true };
    const generating = await renderNode(
      baseData({ currentSourceFileId: 'file-abc', status: 'loading' }),
      { selected: false },
    );
    expect(generating.container.querySelector(POSTER_FAVORITE_SELECTOR)).toBeNull();
  });
});
