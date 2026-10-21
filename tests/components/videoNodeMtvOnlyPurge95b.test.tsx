// @vitest-environment jsdom
/**
 * §95b —— 视频卡「MTV 独有件清除」回归。
 *
 * 本文件只覆盖**视频卡**范围内、本轮按官方产物删掉/改掉的件。每条断言的官方依据都写在用例里。
 *
 * 逐字证据（`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`，偏移 = JS 字符串 charIdx）：
 *
 * | 件 | 官方符号 | 偏移 | 逐字 |
 * |---|---|---|---|
 * | 工具栏行容器 | `r3e` | @1063665 | `className:z("nodrag cursor-default w-fit h-12 p-1 rounded-full flex flex-nowrap items-center justify-between bg-popover border z-10 whitespace-nowrap gap-1 text-white/90","node-float-ui-visible",t)` |
 * | 行容器 tooltip provider | `r3e` | @1063560 | `s.jsx(ii,{delayDuration:300 …})`（`ii` = `TooltipProvider`，同包另有 `ii,{delayDuration:200…}` 等 12 处用法可比对） |
 * | `<video>` | `Goe` | @1959933 | `className:z("absolute inset-0 h-full w-full rounded-2xl object-contain transition-opacity duration-150", _&&!e?"opacity-100":"opacity-0", o&&"blur-xl")` |
 * | 海报 `<img>` | `$oe` | @1961633 | `className:z("absolute inset-0 z-[1] h-full w-full rounded-2xl object-cover pointer-events-none transition-opacity duration-[180ms] ease-out motion-reduce:transition-none", n?"opacity-0":"opacity-100")` · `alt:""` · `"data-testid":"video-poster"` |
 * | GENERATE 空态上传分支 | `EF` | @1956117 | `s.jsx("div",{className:"absolute inset-0 bg-secondary z-10 animate-pulse w-full h-full"})` |
 * | UPLOAD 上传分支 | `dse` | @2081160 | `f && s.jsx("div",{className:"absolute inset-0 bg-background/50 z-10 animate-pulse w-full h-full"})` |
 *
 * 官方**全套产物 0 命中**的 MTV 自造名（8 个官方 JS + 12 个官方 CSS 逐个搜）：
 * `video-node-controls` · `video-node-control-row` · `video-node-control-btn` · `video-node-time`
 * · `video-node-control-spacer` · `video-node-progress` · `video-node-volume`
 * · `video-node-initial-cover` · `video-node-poster` · `node-preview-loading` · `spinner large`
 * · `img-toolbar` · `node-floating-toolbar` · `ftb-btn` · `ftb-zone` · `ftb-divider`
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

/** 官方 `r3e` @1063665 的类串第一段（逐字） */
const OFFICIAL_TOOLBAR_ROW_CLASS =
  'nodrag cursor-default w-fit h-12 p-1 rounded-full flex flex-nowrap items-center '
  + 'justify-between bg-popover border z-10 whitespace-nowrap gap-1 text-white/90';
/** 官方 `$oe` @1961633 的 `<img>` 类串第一段（逐字） */
const OFFICIAL_POSTER_CLASS =
  'absolute inset-0 z-[1] h-full w-full rounded-2xl object-cover pointer-events-none '
  + 'transition-opacity duration-[180ms] ease-out motion-reduce:transition-none';
/** 官方 `Goe` @1959933 的 `<video>` 类串第一段（逐字） */
const OFFICIAL_VIDEO_CLASS =
  'absolute inset-0 h-full w-full rounded-2xl object-contain transition-opacity duration-150';
/** 官方 `EF` @1956117 上传分支（逐字） */
const OFFICIAL_GENERATE_UPLOADING_CLASS = 'absolute inset-0 bg-secondary z-10 animate-pulse w-full h-full';
/** 官方 `dse` @2081160 上传分支（逐字） */
const OFFICIAL_UPLOAD_UPLOADING_CLASS = 'absolute inset-0 bg-background/50 z-10 animate-pulse w-full h-full';

const uploadState = vi.hoisted(() => ({ isUploading: false }));

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
vi.mock('../../src/components/nodes/shared/useSourceFileUpload', () => ({
  useSourceFileUpload: () => ({ isUploading: uploadState.isUploading, handleUpload: vi.fn() }),
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
vi.mock('../../src/components/nodes/shared/media/MediaViewer', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/media/MediaViewerActions', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/NodeToolbarShell', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/NodeLabel', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/NodeGenerationProgress', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/NodeError', () => ({ default: () => null }));
vi.mock('../../src/components/nodes/shared/GooeyBtn', () => ({ default: () => null }));

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const readSource = (relative: string) => fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');

/** 去掉 CSS 块注释与 TS 注释后剩下的代码（注释里点名"已删除的类名"不算违规） */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

beforeEach(() => {
  cleanup();
  vi.resetModules();
  uploadState.isUploading = false;
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

describe('§95b 上传中的卡体 = 官方脉冲块（`EF` @1956117 / `dse` @2081160）', () => {
  it('GENERATE 变体：`absolute inset-0 bg-secondary z-10 animate-pulse w-full h-full`', async () => {
    uploadState.isUploading = true;
    const { container } = await renderVideoNode();
    const pulse = container.querySelector(`div[class="${OFFICIAL_GENERATE_UPLOADING_CLASS}"]`);
    expect(pulse).not.toBeNull();
    /* 🚫 MTV 自造件必须缺席：`.node-preview-loading` + `.spinner large` + 「上传中...」 */
    expect(container.querySelector('.node-preview-loading')).toBeNull();
    expect(container.querySelector('.spinner')).toBeNull();
    expect(container.textContent).not.toContain('上传中');
  });

  it('UPLOAD 变体：`absolute inset-0 bg-background/50 z-10 animate-pulse w-full h-full`（官方底色不同）', async () => {
    uploadState.isUploading = true;
    const { container } = await renderVideoNode({ videoNodeType: 'upload' });
    expect(container.querySelector(`div[class="${OFFICIAL_UPLOAD_UPLOADING_CLASS}"]`)).not.toBeNull();
    expect(container.querySelector(`div[class="${OFFICIAL_GENERATE_UPLOADING_CLASS}"]`)).toBeNull();
    expect(container.querySelector('.node-preview-loading')).toBeNull();
  });
});

describe('§95b 工具栏壳级出现门 = 图像卡同一逻辑（+ 官方 `t = isGenerating`）', () => {
  it('视频卡的 `NodeToolbarShell visible` 含 `data.status !== \'loading\'`，与图像卡逐字同门', () => {
    const video = stripComments(readSource('src/components/nodes/VideoNode.tsx'));
    const image = stripComments(readSource('src/components/nodes/ImageNode.tsx'));
    /* 图像卡原文（`ImageNode.tsx` 的 `NodeToolbarShell visible={… data.status !== 'loading' …}`） */
    expect(image).toContain("data.status !== 'loading'");
    /* 视频卡此前**缺这一条** ⇒ 生成中仍出工具条，与图像卡不同逻辑；本轮补齐 */
    expect(video).toMatch(/NodeToolbarShell\s+visible=\{[^}]*data\.status !== 'loading'/);
  });

  it('官方依据：`yXe` 把 `isGenerating` 当 `xXe` 的第二参 `t`，每颗键的 `invisible` 都含 `t`', () => {
    const official = fs.readFileSync(
      'D:/DEEPSEEK/live-assets-new/vendor-pkg-canvas-CvbAwZyy.js', 'utf8',
    );
    /* `function yXe({nodeId:e,nodeTitle:t,isGenerating:n}){const o=xXe(e,n); …}` */
    const caller = official.slice(official.indexOf('function yXe('), official.indexOf('function yXe(') + 120);
    expect(caller).toContain('isGenerating:n');
    expect(caller).toContain('xXe(e,n)');
    /* 左组首键 `clip` 的门逐字 */
    expect(official).toContain('invisible:!k||S||t,disabled:!k||t,lockedTooltip:l("clip",V)');
    /* `PE` 的 isLoading 再挡一层 */
    const pe = official.slice(official.indexOf('function PE({nodeId:e'), official.indexOf('function PE({nodeId:e') + 160);
    expect(pe).toContain('isLoading:o');
  });
});

describe('§95b 「只有缩略图」分支改用官方海报（`$oe` @1961633）', () => {  it('渲染 `data-testid="video-poster"` + 官方逐字 class + `alt=""`，且不再有 MTV 的 `video-node-poster`', async () => {
    const THUMB = 'https://cdn.example.com/thumb.jpg';
    const { container } = await renderVideoNode({ thumbnailUrl: THUMB, videoUrl: undefined });
    const poster = container.querySelector<HTMLImageElement>('[data-testid="video-poster"]');
    expect(poster).not.toBeNull();
    expect(poster!.getAttribute('src')).toBe(THUMB);
    expect(poster!.getAttribute('alt')).toBe('');
    expect(poster!.getAttribute('decoding')).toBe('async');
    for (const token of OFFICIAL_POSTER_CLASS.split(' ')) {
      expect(poster!.className.split(/\s+/)).toContain(token);
    }
    expect(poster!.className.split(/\s+/)).not.toContain('video-node-poster');
    expect(container.querySelector('.video-node-poster')).toBeNull();
  });
});

describe('§95b 卡内 `<video>` 带官方 `Goe` 逐字 class', () => {
  it('`object-contain` / `rounded-2xl` / `absolute inset-0` 与官方一致', async () => {
    const { container } = await renderVideoNode({ videoUrl: 'https://cdn.example.com/a.mp4' });
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    for (const token of OFFICIAL_VIDEO_CLASS.split(' ')) {
      expect(video!.className.split(/\s+/)).toContain(token);
    }
    /* 官方是 `object-contain`；MTV 旧的 `.video-preview-player{object-fit:cover}` 不再生效来源 */
    expect(video!.className).not.toContain('object-cover');
  });
});

describe('§95b 视频工具栏行容器 = 官方 `r3e` @1063665 逐字', () => {
  it('容器类串含官方第一段 + `node-float-ui-visible`，且不再借用图像节点的 `img-toolbar`', () => {
    const src = readSource('src/components/nodes/shared/VideoNodeToolbar.tsx');
    expect(src).toContain(OFFICIAL_TOOLBAR_ROW_CLASS);
    expect(src).toContain('node-float-ui-visible');
    /* 注释里点名 `img-toolbar`（说明为什么删）不算违规 ⇒ 去掉注释再查 */
    expect(stripComments(src)).not.toContain('img-toolbar');
  });

  it('官方行容器的 TooltipProvider 是 `delayDuration:300`（r100 @1055675）', () => {
    /* 只登记**事实**：行容器那一层 Provider 传 300。
       ⚠️ 这**不是**按钮的生效值 —— 见下一个 describe（§106 更正）。 */
    const official = fs.readFileSync(
      'D:/DEEPSEEK/live-assets-r100/vendor-pkg-canvas-DuoOicPr.js', 'utf8',
    );
    expect(official).toContain('s.jsx(ii,{delayDuration:300,children:s.jsxs("div",{ref:i==="canvas"');
  });
});

describe('§106 更正：工具条按钮 tooltip 的**生效值**是 `200`，不是行容器的 300', () => {
  /* ── 为什么更正 ──────────────────────────────────────────────────────────
     §96 曾按「行容器 Provider = 300」把工具条 tooltip 改成 300。但链路上还有一层：
     每颗按钮的 tooltip 经 `Ta` 渲染，而 `Ta` 给 radix Root **显式**传 `delayDuration`（默认 200）；
     Root 内部取 `v = s ?? l.delayDuration` ⇒ **显式值优先**，把外层 Provider 的 300 盖掉。
     ⇒ 官方按钮的实际生效延迟 = **200**。本仓已按官方退回 200。 */
  const r100 = (p: string) => fs.readFileSync(`D:/DEEPSEEK/live-assets-r100/${p}`, 'utf8');

  it('官方每颗按钮的 tooltip helper `Ta` 给 Root 显式 `delayDuration`（默认 200）', () => {
    /* `vendor-packages-JNk8f0_N.js` @404156 逐字 */
    expect(r100('vendor-packages-JNk8f0_N.js')).toContain(
      'const Ta=({children:e,content:t,side:n="top",align:s="center",sideOffset:r=8,delayDuration:o=200,',
    );
  });

  it('radix Tooltip Root 取「显式值优先」：`v=s??l.delayDuration`', () => {
    /* `vendor-libs-D64ouk08.js` @1382617 —— `s` = Root 自己的 delayDuration，`l` = Provider context */
    expect(r100('vendor-libs-D64ouk08.js')).toContain('v=s??l.delayDuration');
  });

  it('MTV 六条工具条的行容器都是 200（与官方生效值一致）', () => {
    for (const f of [
      'src/components/nodes/shared/VideoNodeToolbar.tsx',
      'src/components/nodes/shared/image/ImageNodeToolbar.tsx',
      'src/components/nodes/shared/TextNodeToolbar.tsx',
      'src/components/nodes/shared/AudioNodeToolbar.tsx',
      'src/components/nodes/shared/PanoramaNodeToolbar.tsx',
      'src/components/nodes/GroupNodeToolbar.tsx',
    ]) {
      const src = readSource(f);
      expect(src, `${f} 应为 200`).toContain('data-tooltip-delay="200"');
      expect(src, `${f} 不该是 300`).not.toContain('data-tooltip-delay="300"');
    }
  });
});

describe('§96 `.ftb-btn` hover：删掉 MTV 自加的文字色，只留官方 `ObsidianBg` 那层', () => {
  const css = stripComments(readSource('src/styles/nodes.css'));

  it('官方 `BO` 的 obsidian 变体没有任何 hover 文字色（`vendor-packages` @404856 起逐字）', () => {
    const official = fs.readFileSync(
      'D:/DEEPSEEK/live-assets-new/vendor-packages-DRvCmDjR.js', 'utf8',
    );
    expect(official).toContain(
      '"z-0 group/button relative flex items-center justify-center cursor-pointer '
      + 'focus-visible:outline-none text-xs transition-colors duration-300 '
      + 'disabled:opacity-50 disabled:cursor-not-allowed"',
    );
    expect(official).toContain(
      'obsidian:"bg-transparent text-nowrap transition-all duration-200 '
      + 'ease-[cubic-bezier(0.25,0.8,0.25,1)]"',
    );
    /* 官方 `ObsidianBg`(`P6` @404087) 的原文（本仓已按它落成 `.ftb-btn::before/::after`） */
    expect(official).toContain(
      'className:I("absolute inset-0 z-[-1] overflow-hidden rounded-[inherit] opacity-0 '
      + 'transition-opacity duration-400 ease-[cubic-bezier(0.25,0.8,0.25,1)] '
      + 'group-hover/button:opacity-100 pointer-events-none",e)',
    );
    expect(official).toContain(
      'background:"conic-gradient(from 0deg, rgba(93, 93, 93, 1) 0deg, rgba(106, 106, 106, 0.1) 70deg, '
      + 'rgba(144, 144, 144, 1) 180deg, rgba(144, 144, 144, 0.1) 290deg, rgba(93, 93, 93, 1) 360deg)"',
    );
    expect(official).toContain('transform:"scale(1.1, 0.7)"');
    expect(official).toContain(
      'background:"radial-gradient(200% 140% at 50% 40.25%, #1A1A1A 16%, #656766 85%)"',
    );
  });

  it('`nodes.css` 去注释后**没有** `.ftb-btn:hover` 文字色规则了', () => {
    expect(css).not.toMatch(/\.ftb-btn:hover\s*\{/);
    expect(css).not.toContain('.ftb-btn:hover {');
    /* 原来那条自加规则的全文（去注释后必须查不到） */
    expect(css).not.toMatch(/\.ftb-btn:hover\s*\{\s*color:/);
  });

  it('官方那层 overlay 仍在（conic + radial 逐字，opacity 0→1 / 0.4s / 官方贝塞尔）', () => {
    /* radial 层 = `::before` */
    expect(css).toMatch(/\.ftb-btn::before\s*\{[^}]*inset:\s*1px/);
    expect(css).toMatch(
      /\.ftb-btn::before\s*\{[^}]*radial-gradient\(\s*200% 140% at 50% 40\.25%,\s*rgb\(26, 26, 26\) 16%,\s*rgb\(101, 103, 102\) 85%\s*\)/,
    );
    expect(css).toMatch(/\.ftb-btn::before\s*\{[^}]*opacity:\s*0/);
    expect(css).toMatch(/\.ftb-btn::before\s*\{[^}]*transition:\s*opacity 0\.4s cubic-bezier\(0\.25, 0\.8, 0\.25, 1\)/);
    /* conic 层 = `::after`（3 倍大 + scale(1.1,0.7)） */
    expect(css).toMatch(/\.ftb-btn::after\s*\{[^}]*inset:\s*-100%/);
    expect(css).toMatch(/\.ftb-btn::after\s*\{[^}]*transform:\s*scale\(1\.1, 0\.7\)/);
    expect(css).toMatch(
      /\.ftb-btn::after\s*\{[^}]*conic-gradient\(\s*rgb\(93, 93, 93\) 0deg,\s*rgba\(106, 106, 106, 0\.1\) 70deg,\s*rgb\(144, 144, 144\) 180deg,\s*rgba\(144, 144, 144, 0\.1\) 290deg,\s*rgb\(93, 93, 93\) 360deg\s*\)/,
    );
    /* hover 才点亮（= 官方 `group-hover/button:opacity-100`） */
    expect(css).toMatch(/\.ftb-btn:hover::before,\s*\.ftb-btn:hover::after\s*\{\s*opacity:\s*1;\s*\}/);
  });
});

describe('§96 生成态文案：官方无对应物 ⇒ 视频卡不再显示 MTV 自造的「生成视频中...」', () => {
  it('官方生成态覆盖层 `Kp` 的 JSX 里没有任何文本节点', () => {
    const official = fs.readFileSync(
      'D:/DEEPSEEK/live-assets-new/vendor-pkg-canvas-CvbAwZyy.js', 'utf8',
    );
    const start = official.indexOf(',Kp=({nodeId:e,src:t,mediaType:n,estimatedDurationMs:o=3e4,noMedia:r=!1})=>');
    const end = official.indexOf('yM="__tapnow_force_starter_tutorial"');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const kp = official.slice(start, end);
    /* 覆盖层的全部层：backdrop / 媒体模糊 / 阴影 / 点阵 / 扫光 / 爆闪 / dither */
    for (const layer of [
      'node-loading-shadow-layer', 'node-loading-media-blur', 'node-loading-grid-stars',
      'node-loading-grid-sweep', 'node-loading-sweep-glow', 'node-loading-burst', 'node-loading-dither',
    ]) {
      expect(kp).toContain(layer);
    }
    /* **没有**任何文本：既没有 `children:"…"` 字符串子节点，也没有「生成」字样 */
    const jsx = kp.slice(kp.indexOf('s.jsxs("div",{className:"h-full w-full absolute top-0 left-0'));
    expect(jsx).not.toContain('生成');
    expect(jsx).not.toMatch(/children:"[^"]+"/);
  });

  it('`VideoNode.tsx` 不再把 `t(\'生成视频中...\')` 传给进度件（两处都留空）', () => {
    const src = stripComments(readSource('src/components/nodes/VideoNode.tsx'));
    expect(src).not.toContain('生成视频中');
    expect(src.match(/<NodeGenerationProgress nodeId=\{id\} fallbackLabel="" \/>/g)?.length).toBe(1);
    expect(src.match(/<NodeGenerationProgress nodeId=\{id\} fallbackLabel="" overlay \/>/g)?.length).toBe(1);
  });

  it('共用件 `NodeGenerationProgress` 只有标签非空才渲染那个 span（对音频/动画/图像零影响）', () => {
    const src = readSource('src/components/nodes/shared/NodeGenerationProgress.tsx');
    expect(src).toContain('const hasLabel = fallbackLabel.length > 0;');
    expect(src).toContain('{hasLabel && <span className="text-xs">{fallbackLabel}</span>}');
    expect(src).toContain('{hasLabel && <span>{fallbackLabel}</span>}');
    /* §97 尾款：该 span 的文本色已随「MTV 偏紫灰 `canvas-*` 族全仓移除」换成官方令牌 */
    expect(src).toContain('{detail.length > 0 && <span className="truncate text-text-text-secondary">{detail}</span>}');
    /* 其余三个调用方传的标签仍非空 ⇒ 行为不变（源码级复核） */
    for (const [file, label] of [
      ['src/components/nodes/AudioNode.tsx', "fallbackLabel={t('生成音频中...')}"],
      ['src/components/nodes/AnimationNode.tsx', "fallbackLabel={t('正在生成 Sprite Sheet')}"],
      ['src/components/nodes/ImageNode.tsx', "fallbackLabel={t('生成图像中...')} bare"],
    ] as const) {
      expect(stripComments(readSource(file))).toContain(label);
    }
  });
});

describe('§96 键名/命名 = 官方逐字（`scale` · `video_frame_capture` · 「视频」）', () => {
  it('视频工具栏默认布局用的是官方键，旧键名在源码里只剩迁移表与 v2 快照', () => {
    const src = stripComments(readSource('src/components/nodes/shared/toolbar/toolbarRegistry.ts'));
    expect(src).toContain("{ key: 'scale',");
    expect(src).toContain("{ key: 'video_frame_capture',");
    expect(src).toContain("['fullscreen', 'scale'],");
    expect(src).toContain("['captureFrame', 'video_frame_capture'],");
  });

  it('视频节点命名 = 官方 `nodes.videoNode`「视频」（不是 MTV 的「生成视频」）', () => {
    const official = fs.readFileSync('D:/DEEPSEEK/live-assets-new/index-BDGj8rGN.js', 'utf8');
    expect(official).toContain('videoNode:"视频",videoNodeDescription:"宣传视频、动画、电影"');
    expect(stripComments(readSource('src/hooks/useKeyboardShortcuts.ts'))).toContain("{ type: 'ai-video', label: '视频' }");
    const dropMenu = stripComments(readSource('src/hooks/useConnectionDropMenu.ts'));
    expect(dropMenu).toContain("{ label: '视频', type: 'ai-video' }");
    expect(dropMenu).toContain("'ai-video': '视频',");
    expect(dropMenu).not.toContain('生成视频');
  });
});

describe('§95b 已删除的 MTV 自造 CSS 类（官方 JS+CSS 全套 0 命中）', () => {
  const REMOVED = [
    'video-node-controls',
    'video-node-control-row',
    'video-node-control-btn',
    'video-node-time',
    'video-node-control-spacer',
    'video-node-progress',
    'video-node-volume',
    'video-node-initial-cover',
    'video-node-poster',
  ];

  it('`styles/nodes.css` 去注释后不再出现任何一个自造选择器', () => {
    const css = stripComments(readSource('src/styles/nodes.css'));
    for (const name of REMOVED) {
      expect(css, `残留选择器：.${name}`).not.toContain(`.${name}`);
    }
  });

  it('全仓 `src/**` 去注释后不再有这些类名的消费点', () => {
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
    });
    for (const file of walk(path.join(REPO_ROOT, 'src'))) {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      for (const name of REMOVED) {
        expect(code.includes(name), `残留消费点：${path.relative(REPO_ROOT, file)} → ${name}`).toBe(false);
      }
    }
  });
});
