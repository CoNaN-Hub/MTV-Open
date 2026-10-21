/**
 * VideoNode 视频节点 — 在画布上渲染视频内容，支持上传本地视频、播放控制、连接其他节点
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Handle, Position } from '@xyflow/react';
import { Icon } from '@iconify/react';
import { isRemoteMediaUrl } from '../../utils/mediaUrl';
import { getCanvasNodeById } from '../../utils/canvasRenderProjection';
import type { BaseNodeData } from '../../types';
import NodeLabel from './shared/NodeLabel';
import NodeError from './shared/NodeError';
import GooeyBtn from './shared/GooeyBtn';
import VideoNodeControls from './shared/VideoNodeControls';
import VideoNodeToolbar, { type CaptureFramePosition } from './shared/VideoNodeToolbar';
import NodeToolbarShell from './shared/NodeToolbarShell';
import {
  acquireCanvasVideoPoster,
  releaseCanvasVideo,
  waitForCanvasVideoReady,
  type CanvasVideoPoster,
} from './shared/video/canvasVideoPreviewCache';
import MediaViewer from './shared/media/MediaViewer';
import MediaViewerActions from './shared/media/MediaViewerActions';
import { VIDEO_CONTENT_TESTID, VIDEO_POSTER_TESTID } from './shared/video/officialVideoTestIds';
import { collectNodeMediaVersions } from '../../utils/mediaViewerVersions';
import { useNodeRename } from './shared/useNodeRename';
import { useSourceFileUpload } from './shared/useSourceFileUpload';
/* ★ 官方视频节点**变体分派**（`_o` @152208 / `vV`+`fse` @2093744）与官方**标题命名逻辑**
   （`gr` 的 `H=y?.title||i||"Title"` @846915 + 各变体的 `defaultTitle`）。
   见 `utils/officialVideoNodeVariant.ts` 的逐字证据与「MTV 适配点」记账。 */
import {
  OFFICIAL_VIDEO_NODE_TYPE,
  resolveOfficialVideoNodeTitle,
  resolveOfficialVideoNodeType,
} from '../../utils/officialVideoNodeVariant';
/* 官方「上传」胶囊的图标 = `da`/`Da`（`vendor-packages-DRvCmDjR.js` 局部名 `gc`，导出表
   `IconUpload:gc`）—— 即 `assets/official-icons/upload.svg`（同一支 path）。 */
import { OfficialIcon } from '../sidebar/OfficialIcon';
import { computeImageNodeDimensions, generateId, useAppStore } from '../../store/useAppStore';
import { blobToDataUrl, derivedNodePlacement } from '../../store/store.utils';
import { nodeSizeForAspectRatio } from '../../utils/nodeBounds';
import { seekVideoTo } from '../../utils/videoSeek';
import { downloadUrlAndSave, saveDataUrlToProjectData, buildNodeFileName } from '../../services/fileService';
import { copyFile as copyFileToClipboard } from '../../services/clipboardService';
import { saveNodeOutputToFile } from '../../services/fileService';
import { useCompletionFlash } from '../../hooks/useCompletionFlash';
import { useCanvasNodeLodProtection } from '../../hooks/useCanvasNodeLod';
import { useNodeInPile } from '../../hooks/useNodeInPile';
/* ★ 官方收藏体系（`utils/officialFavorites.ts` = 官方 `g8`；`hooks/useFavoriteStatus.ts` = 官方 `nc`；
   `store/store.favorites.ts` = 官方 `L_`）—— 官方视频卡第二颗键（`VideoPlayer` 的收藏键）的接线依赖。 */
import { useFavoriteStatus } from '../../hooks/useFavoriteStatus';
import { favoriteTargetOf } from '../../utils/officialFavorites';
import { OfficialStarFilledIcon, OfficialStarIcon } from './shared/officialFavoriteIcons';
import {
  cancelCanvasDerivation,
  completeCanvasDerivation,
  isCanvasDerivationFresh,
  registerCanvasDerivation,
} from '../../services/canvasDerivationGuard';
import { buildVideoEditorProjectId } from '../../services/indexedDbService';
import {
  postVideoEditorAiTransitionResult,
  postVideoEditorModels,
  subscribeVideoEditorWindow,
  type VideoEditorAiTransitionRequest,
  type VideoEditorExportResult,
  type VideoEditorFrameExportResult,
} from '../../services/videoEditorWindowService';
import {
  listVideoEditorVideoModels,
  runVideoEditorAiTransition,
} from '../../services/videoEditorAiTransitionService';
import { useT } from '../../i18n';
import NodeGenerationProgress from './shared/NodeGenerationProgress';
/* 官方空视频卡的图标 `es`（`EF`/`NoVideoHelper` @1956117 用的就是它；默认 size=48 / opacity=.2）。 */
import { MentionIconVideo } from '../chat/MentionLibraryParts';

/* §108：官方新建视频卡尺寸 = `ar(16/9)` = **444×250**
   （`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @735528 区写死 `{width:N,height:E}=ar(16/9)`；
    `ar` @497533 基准 `ws={250,250}`；官方真机 CDP 9222 实测 inline `width:444px;height:250px`）。
   ⇒ 这里（**没有视频元数据**时的兜底）也改成官方那组值；MTV 原为 280×158 ✗。 */
const DEFAULT_VIDEO_NODE_WIDTH = 444;
const DEFAULT_VIDEO_NODE_HEIGHT = 250;
const VIDEO_FRAME_MAX_DIMENSION = 1280;
/* 官方 `xs.gallery.mediaPreview`（`course-api-base-url-CyloymxZ.js@2957344` 逐字）：
   `videoHoverIntentMs: 180` · `videoCrossfadeDurationMs: 100` —— 视频卡 hover 预览的意图延迟与交叉淡入时长。 */
const VIDEO_HOVER_INTENT_MS = 180;
const VIDEO_CROSSFADE_MS = 100;

function fitVideoFrameDimensions(
  video: Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight'>,
  maxDimension: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
  return {
    width: Math.max(1, Math.round(video.videoWidth * scale)),
    height: Math.max(1, Math.round(video.videoHeight * scale)),
  };
}

/* ══ §113 视频卡尺寸**只由比例决定**（官方 `wPe` + `ar` + `Xl`），不再按像素 fit ══
   官方 `wPe`（`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @742858 区逐字）：
     `function wPe(e,t){const n=e?.data,o=Xl(t)??(n?.params&&typeof n.params=="object"?Xl(n.params.aspectRatio):null);
      if(!o)return null;const r=ar(o),i=e?.width,l=e?.height;
      if(typeof i=="number"&&typeof l=="number"&&Math.abs(i-r.width)<=1&&Math.abs(l-r.height)<=1)return null;
      const{position:d,...u}=cv(e??{},r);return d?{...u,position:d}:u}`
   ⇒ ① 比例取 `Xl(显式参数) ?? Xl(data.params.aspectRatio)`；**拿不到就 `return null`（不改尺寸）**；
      ② 尺寸 = `ar(ratio)`（@497533，**短边恒 250**）；③ 与现值差 ≤1 时不动（容差 ±1）。
   官方 `Xl`（@497952 区逐字）：
     `Xl=e=>{if(!e)return null;const t=e.trim();if(!t)return null;
      if(t.toLowerCase().startsWith("auto"))return 1;const[n,o]=t.split(":"),r=Number(n),i=Number(o);
      return!r||!i?null:r/i}`
   ⇒ `auto*` / `自适应` ⇒ **1**（= 250×250）；非法串 ⇒ `null`（不改尺寸）。
   ⚠️ MTV 原来按**像素** fit（最长边 ≤320、最小 180×110，`computeVideoNodeDimensions`）——
      那是 MTV 自造规则，官方**完全没有**这一套 ⇒ §113 删除。 */
function officialVideoRatioValue(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith('auto')) return 1;
  const [w, h] = trimmed.split(':');
  const wn = Number(w);
  const hn = Number(h);
  return !wn || !hn ? null : wn / hn;
}

/** 官方 `ar(ratio)` 的节点盒子；比例拿不到 ⇒ `null`（= 官方 `wPe` 的 `return null`，**不改尺寸**）。 */
function officialVideoNodeBox(aspectRatio: unknown): { nodeWidth: number; nodeHeight: number } | null {
  const ratio = officialVideoRatioValue(aspectRatio);
  if (ratio === null) return null;
  const size = nodeSizeForAspectRatio(ratio);
  return { nodeWidth: size.width, nodeHeight: size.height };
}

/** 节点当前该用的官方盒子：官方 `Xl(params.aspectRatio)`；MTV 另接平铺字段 `seedanceRatio`（同义）。 */
function officialVideoBoxForNodeData(d: {
  params?: unknown;
  seedanceRatio?: unknown;
}): { nodeWidth: number; nodeHeight: number } | null {
  const params = (d?.params && typeof d.params === 'object' ? d.params : undefined) as { aspectRatio?: unknown } | undefined;
  /* §128 ⚠️ 顺序改正：官方 `wPe` 读的是 `Xl(显式参数) ?? Xl(data.params.aspectRatio)` —— 官方**只有一个**载体
     `params.aspectRatio`。MTV 的**实时 UI 值**写在平铺字段 `seedanceRatio` 上（参数面板 `onChangeSeedanceRatio`
     → `updateNodeData(id,{seedanceRatio})`），而 `params.aspectRatio` 只是**建卡时**由
     `officialVideoNodeParamsSeed` 写下的快照（seedance-2.5 = `"adaptive"`，永远不变）。
     ⇒ 原来的 `params.aspectRatio ?? seedanceRatio` 会让快照**永久压住**用户的选择 ⇒ 选 4:3 时
       `officialVideoBoxForNodeData` 仍返回 `adaptive`（= 1）对应的方形盒子。
     现在按「实时值优先、快照兜底」：`seedanceRatio ?? params.aspectRatio`。 */
  return officialVideoNodeBox(d?.seedanceRatio) ?? officialVideoNodeBox(params?.aspectRatio);
}

async function captureVideoFrame(
  video: HTMLVideoElement,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { width, height } = fitVideoFrameDimensions(video, VIDEO_FRAME_MAX_DIMENSION);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建截帧画布');
  }

  ctx.drawImage(video, 0, 0, width, height);
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('无法编码视频帧')),
        'image/jpeg',
        0.9,
      );
    });
    return { dataUrl: await blobToDataUrl(blob), width, height };
  } finally {
    // 立即释放 backing store，不把 1280px RGBA 表面留给 GC 猜测回收时机。
    canvas.width = 1;
    canvas.height = 1;
  }
}

/** 尾帧要略微退回，正好停在 duration 上多数解码器给不出画面 */
const LAST_FRAME_BACKOFF = 0.05;

const CAPTURE_FRAME_LABELS: Record<CaptureFramePosition, string> = {
  first: '首帧',
  current: '当前帧',
  last: '尾帧',
};

function resolveCaptureTime(video: HTMLVideoElement, position: CaptureFramePosition): number {
  if (position === 'current') return video.currentTime;
  if (position === 'first') return 0;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  return duration > 0 ? Math.max(0, duration - LAST_FRAME_BACKOFF) : video.currentTime;
}

/**
 * 把节点里的预览视频定位到目标时刻取一帧。
 * 不负责复位——连着取多帧时中间来回跳会让 seek 互相打架，由调用方取完一次性复位。
 */
async function captureFrameAtTime(
  video: HTMLVideoElement,
  targetTime: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  await seekVideoTo(video, targetTime);
  return await captureVideoFrame(video);
}

function isTaintedCanvasError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('Tainted canvases') || error.message.includes('may not be exported');
}

function releaseVideoElement(video: HTMLVideoElement | null): void {
  releaseCanvasVideo(video);
}

function restoreVideoTime(video: HTMLVideoElement, time: number): void {
  if (video.readyState > 0) video.currentTime = time;
}

function captureFrameFromVideoUrl(url: string, currentTime: number): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    let settled = false;
    let captureStarted = false;
    let timer = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      releaseVideoElement(video);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const done = () => {
      if (settled || captureStarted) return;
      captureStarted = true;
      void captureVideoFrame(video).then(
        (frame) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(frame);
        },
        (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        },
      );
    };

    timer = window.setTimeout(() => fail(new Error('本地视频加载超时')), 15000);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('error', () => fail(new Error('本地视频加载失败')), { once: true });
    video.addEventListener('loadedmetadata', () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const targetTime = duration > 0
        ? Math.min(Math.max(currentTime, 0), Math.max(duration - 0.01, 0))
        : 0;

      if (Math.abs(video.currentTime - targetTime) < 0.01) {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          done();
        } else {
          video.addEventListener('loadeddata', done, { once: true });
        }
        return;
      }

      video.addEventListener('seeked', done, { once: true });
      video.currentTime = targetTime;
    }, { once: true });
    video.src = url;
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   官方 `VideoPoster`（`$oe`）—— **逐字**复刻。
   证据：`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`
        `displayName="VideoPoster"` @charIdx 1962047；`$oe=` @1961281；函数体止于 1962041。

   官方逐字（同一行，此处按语句换行以便阅读）：
   ```js
   const lXe = Mn("VideoPoster"), YB = [500, 1e3, 2e3];
   function Hoe(e) { return vn(e, tn.THUMBNAIL_V2) }
   const $oe = a.memo(({ src: e, nodeId: t, hidden: n }) => {
     const o = Hoe(e), [r, i] = a.useState(0), l = a.useRef(null);
     a.useEffect(() => () => { l.current !== null && window.clearTimeout(l.current) }, []);
     function c() {
       if (r >= YB.length) {
         lXe.warn("Video poster failed to load", { log_source: "video_poster_load", nodeId: t, src: o });
         return;
       }
       l.current === null && (l.current = window.setTimeout(() => {
         l.current = null, i(u => u + 1);
       }, YB[r]));
     }
     function d() { l.current !== null && (window.clearTimeout(l.current), l.current = null) }
     return s.jsx("img", {
       src: o, alt: "",
       className: z("absolute inset-0 z-[1] h-full w-full rounded-2xl object-cover pointer-events-none
                     transition-opacity duration-[180ms] ease-out motion-reduce:transition-none",
                    n ? "opacity-0" : "opacity-100"),
       decoding: "async", "data-testid": "video-poster", onError: c, onLoad: d,
     }, r);   // ← 第三参 = React key ⇒ 重试计数一变就重挂 <img>，浏览器重新发起请求
   });
   ```

   · 重试阶梯 `YB = [500, 1000, 2000]`（毫秒）。`onError` 只在「当前没有待触发的定时器」时
     排一次定时器；到点 `retryCount + 1` ⇒ `key` 变化 ⇒ `<img>` 重挂。三次用尽后再 `onError`
     只记一条 `warn`（`log_source:"video_poster_load"`），**不再重试**。
   · `onLoad` 清定时器（**不**重置计数）；组件卸载也清定时器。
   · `data-testid="video-poster"` 是**字面量**（不是 `At.*` 常量表里的键）—— 本条推翻了
     旧记录里「`video-poster` 未实证」的说法，见 `shared/video/officialVideoTestIds.ts`。

   ⚠️ MTV 偏离（逐条，均按任务要求「**不硬改语义**」）：
    1. **`src` 的来源**：官方 `src = Hoe(f) = Xu(wo(rawSrc), THUMBNAIL_V2)` ——
       `wo`（= `bc` = `Pr`，`vendor-packages-DRvCmDjR.js@11462`）是 **CDN 主机名改写**，
       `Xu(v, "display_hd")`（同文件 @517xxx 邻域，`jo.THUMBNAIL_V2="display_hd"`）是
       **CDN 缩略图变体**。MTV 既没有变体服务也没有 CDN 改写 ⇒ 海报的 `src` 仍由调用方给
       （MTV 的 `initialCoverUrl` = 本地抽帧 blob URL 或节点自带 `thumbnailUrl`）。
       **只对齐 class / `data-testid` / 重试阶梯**，不改封面语义。
    2. **MTV 附加 `onPosterError`**（官方没有这个参数）：保留 MTV 既有的
       「自带缩略图加载失败 ⇒ 回落到抽帧封面（`setFailedCover`）」行为。
       🚨 这条 MTV 语义会**抢在官方阶梯之前**：当海报来自 `data.thumbnailUrl`（`suppliedCover`）时，
          第一次 `onError` 就撤掉 suppliedCover ⇒ 海报换源/退场，官方那 3 次重试只在
          **抽帧封面**（`generatedCoverUrl`）这一支上真正跑起来。已在
          `tests/components/videoNodeOfficialVideoParts.test.tsx` 里对**两种情形**分别用例固定。
    3. 官方海报是**常挂载**、靠 `hidden` 切 `opacity`（`O0` 传 `hidden: !j`）；MTV 的两处调用点
       各自处于互斥分支里（未挂载播放器 / 已挂载播放器且封面未撤），进入时官方
       `hidden = !j` 恒为 `false`（`j = !b || !k || x || o`）⇒ 两处都渲染 `opacity-100`。
       MTV 在「视频加载完成」时是**卸载**海报（`dismissedCoverSource`）而不是切成 `opacity-0` ——
       这是 MTV 既有的封面生命周期，本轮不动。
    4. ⚠️ **结构偏离（MTV 内部实现，DOM 输出完全一致）**：官方 `$oe` 是 `a.memo(...)` 组件，
       MTV 把它落成 **hook + 就地 `<img>`**（`useOfficialVideoPoster`）。原因：本仓库有几处
       测试（`tests/components/videoNodePreviewLifecycle.test.tsx`）**直接调用组件函数、没有
       renderer**，组件边界会让它们看不到海报的 `<img>`。hook 产出的仍是**同一颗 `<img>`**
       （同 class / 同 testid / 同 `key={retryCount}` / 同 `onError`/`onLoad`），行为逐字一致。
   ══════════════════════════════════════════════════════════════════════════════ */
/** 官方 `YB = [500, 1e3, 2e3]` —— 逐字 */
const OFFICIAL_VIDEO_POSTER_RETRY_DELAYS_MS = [500, 1000, 2000] as const;

/** 官方 `$oe` 里传给 `z(...)` 的第一个实参 —— 逐字 */
const OFFICIAL_VIDEO_POSTER_CLASS =
  'absolute inset-0 z-[1] h-full w-full rounded-2xl object-cover pointer-events-none '
  + 'transition-opacity duration-[180ms] ease-out motion-reduce:transition-none';

/**
 * 官方 `<video>`（`Goe` @1959933，`displayName="VideoPlayer"`）的 className —— 逐字：
 * ```js
 * className: z("absolute inset-0 h-full w-full rounded-2xl object-contain transition-opacity duration-150",
 *              _ && !e ? "opacity-100" : "opacity-0",   // _ = hasLoadedData · e = hasError
 *              o && "blur-xl")                          // o = isGenerating
 * ```
 * ⚠️ MTV 取**常量段 + `opacity-100`**：
 *   · `opacity-100`：官方 `opacity-0` 只在「还没 `loadeddata`」时出现，而 MTV 的 `<video>`
 *     是**条件挂载**的（`shouldMountPlayer`）⇒ 走到渲染就一定是有源的播放态。
 *   · **不取 `blur-xl`**：官方把生成中模糊做在 `<video>` 自己身上，MTV 生成中用的是
 *     `NodeGenerationProgress` 覆盖层（MTV 既有件，本轮不在范围内）⇒ 避免两层叠加。
 */
const OFFICIAL_VIDEO_ELEMENT_CLASS =
  'absolute inset-0 h-full w-full rounded-2xl object-contain transition-opacity duration-150 opacity-100';

/** 官方 `$oe` 的 `<img>` props（不含 `key`；`key` 单独给出，见 `posterKey`） */
interface OfficialVideoPosterProps {
  src: string | undefined;
  alt: string;
  className: string;
  decoding: 'async';
  'data-testid': string;
  onError: () => void;
  onLoad: () => void;
}

function useOfficialVideoPoster({ src, nodeId, onPosterError }: {
  src: string | null | undefined;
  nodeId: string;
  /** ⚠️ MTV 附加（官方无此参数），见上方偏离② */
  onPosterError: () => void;
}): { posterKey: number; posterProps: OfficialVideoPosterProps } {
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<number | null>(null);

  /** 官方 `a.useEffect(() => () => { l.current !== null && window.clearTimeout(l.current) }, [])` */
  useEffect(() => () => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
  }, []);

  /** 官方 `c` */
  const handlePosterError = useCallback(() => {
    onPosterError();
    if (retryCount >= OFFICIAL_VIDEO_POSTER_RETRY_DELAYS_MS.length) {
      console.warn('Video poster failed to load', {
        log_source: 'video_poster_load',
        nodeId,
        src,
      });
      return;
    }
    if (retryTimerRef.current === null) {
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        setRetryCount((current) => current + 1);
      }, OFFICIAL_VIDEO_POSTER_RETRY_DELAYS_MS[retryCount]);
    }
  }, [nodeId, onPosterError, retryCount, src]);

  /** 官方 `d` —— 只清定时器，不重置计数 */
  const handlePosterLoad = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  return {
    /* 官方 `s.jsx("img", {…}, r)` 的第三参：重试计数即 key ⇒ 计数一变就重挂 */
    posterKey: retryCount,
    posterProps: {
      src: src ?? undefined,
      alt: '',
      className: `${OFFICIAL_VIDEO_POSTER_CLASS} opacity-100`,
      decoding: 'async',
      'data-testid': VIDEO_POSTER_TESTID,
      onError: handlePosterError,
      onLoad: handlePosterLoad,
    },
  };
}

function AIVideoNode({ id, data, selected }: { id: string; data: BaseNodeData; selected?: boolean }) {
  const t = useT();
  const justCompleted = useCompletionFlash(data.status);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreenPlaybackRef = useRef({ currentTime: 0, wasPlaying: false });
  const compactPlaybackRestoreRef = useRef<{
    source: string;
    currentTime: number;
    shouldPlay: boolean;
    volume?: number;
    muted?: boolean;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** 官方媒体查看器正在展示的媒体（打开时 = 卡片当前视频） */
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerDownloading, setViewerDownloading] = useState(false);
  const outputHistoryRecords = useAppStore((s) => s.outputHistoryRecords);
  const [generatedCover, setGeneratedCover] = useState<(CanvasVideoPoster & { source: string; projectId: string | null }) | null>(null);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  /**
   * 官方 `O0` 的 `hasError`（`x` 状态；生产者 = `<video onError>` 的 `I` 回调，`I=()=>{_(!1),y(!0)}`）。
   * 官方重试键 `A=()=>{R.stopPropagation(),y(!1),_(!1),w(Date.now())}` 把 `hasError` 清回 `false`
   * —— 即「换一次加载尝试就清错」。MTV 没有 `retryStamp`（官方重试浮层未复刻）⇒ 等价动作只有
   * 「src 变了」这一条，所以这里**把 src 记在 state 里并派生**：src 一变，旧失败态自然失效，
   * 既不需要 `useEffect`（`react-hooks/set-state-in-effect` 禁止）也不需要在渲染期改 ref。
   */
  const [videoLoadFailure, setVideoLoadFailure] = useState<{ src?: string; failed: boolean }>({
    src: data.videoUrl,
    failed: false,
  });
  const videoLoadFailed = videoLoadFailure.failed && videoLoadFailure.src === data.videoUrl;
  const [activatedSource, setActivatedSource] = useState<string | null>(null);
  const [playingSource, setPlayingSource] = useState<string | null>(null);
  const pendingVideoOperations = useRef(new Set<AbortController>());
  const heldPosters = useRef(new Set<() => void>());
  const [dismissedCoverSource, setDismissedCoverSource] = useState<string | null>(null);
  const updateNodeData = useAppStore((s) => s.updateNodeData);
  const updateNodeDataTransient = useAppStore((s) => s.updateNodeDataTransient);
  /* §130 官方 `uv` 改尺寸时**同时改 position**（中心/底边锚点）⇒ 需要位置写入口。 */
  const updateNodePositionTransient = useAppStore((s) => s.updateNodePositionTransient);
  const openNodeDialog = useAppStore((s) => s.openNodeDialog);
  const isSingleSelection = useAppStore((s) => s.selectedNodeIds.length <= 1);
  const isSoleSelectedNode = useAppStore((s) => s.selectedNodeIds.length === 1 && s.selectedNodeIds[0] === id);
  /* ★ 堆叠成员不显示自身工具栏（官方由堆叠工具栏统一操作成员）——
     否则会与堆叠工具栏**同时可见**（用户实测「两个工具栏 + 闪烁」）。见 `useNodeInPile`。 */
  const inPile = useNodeInPile(id);
  /* ★ 官方视频档「上传」胶囊门 `k` 里的 `E`：`d1({id,handleType:'target'}).length>0`
     —— 本节点**有入边**（已被当作参考输入）时不给上传入口。
     （`cse` @2076580 逐字：`k=e&&!y&&!d&&!N&&!x&&!E`） */
  const hasIncomingConnection = useAppStore((s) => s.edges?.some((edge) => edge.target === id) ?? false);
  const projectId = useAppStore((s) => s.currentProjectId);
  /* ══════════════════════════════════════════════════════════════════════════
     ★ §93 官方**视频节点变体分派**（用户裁决「五 · 按官方」）
     官方 `fse` @2093744 逐字：
       `const o=e.data.type||_o.GENERATE; return vV[o]||vV[_o.GENERATE]`
       `vV={[_o.UPLOAD]:dse,[_o.GENERATE]:cse,[_o.CLIP]:qoe,[_o.UPSCALE]:mse}`
     MTV 的槽名/兼容策略见 `utils/officialVideoNodeVariant.ts`。
     ⚠️ MTV 只实现了 **UPLOAD（`dse`）** 与 **GENERATE（`cse`）** 两个体；
        `CLIP`/`UPSCALE` **无实现** ⇒ 与官方「未知值回落 GENERATE」同结果，
        这里显式写清，**不占位、不自绘**。 */
  const videoNodeType = resolveOfficialVideoNodeType(data);  const isUploadVariant = videoNodeType === OFFICIAL_VIDEO_NODE_TYPE.UPLOAD;
  const isGenerateVariant = !isUploadVariant;
  /* §113 官方 `wPe`：节点尺寸由**比例**决定（`ar(ratio)`，短边恒 250）；比例拿不到 ⇒ `null` ⇒ 不改尺寸。
     这里 memo 一份，供兜底 / poster 回写 / loadedmetadata 回写三处共用。 */
  const officialNodeBox = useMemo(() => officialVideoBoxForNodeData(data), [data]);
  const fallbackDimensions = officialNodeBox
    ?? { nodeWidth: DEFAULT_VIDEO_NODE_WIDTH, nodeHeight: DEFAULT_VIDEO_NODE_HEIGHT };
  const nodeWidth = data.nodeWidth ?? fallbackDimensions.nodeWidth;
  const nodeHeight = data.nodeHeight ?? fallbackDimensions.nodeHeight;
  /* ══ §128 官方 `wPe` 的**写回**那一步（`VideoNode.tsx` 头部注释里已逐字抄录，@497533 邻域）══
       ```js
       const r = ar(o), i = e?.width, l = e?.height;
       if (typeof i=="number" && typeof l=="number" && Math.abs(i-r.width)<=1 && Math.abs(l-r.height)<=1) return null;
       const {position:d, ...u} = cv(e??{}, r); return d ? {...u, position:d} : u
       ```
     ⚠️ **MTV 的断点就在这里**（用户 2026-10-15：「我选择比例时 卡片本体 不做任何变化 譬如选择 4:3
        卡片应该变成 4:3 的比例 现在没变」）：
       上面两行是 `data.nodeWidth ?? 比例推导值` ⇒ **建卡时写进 `data.nodeWidth/nodeHeight` 的值永远压住比例**。
       于是参数面板改 `seedanceRatio` 后 `officialNodeBox` 虽然变了，`nodeWidth/nodeHeight` 不动 ⇒ 卡片形状不变。
     ⇒ 按官方补上「差异 >1 就把官方盒子写回节点」。用 `updateNodeDataTransient`（与 MTV 其它实时写回同一口径，
        不逐次进历史）。官方 `wPe` 的 ±1 容差逐字保留。 */
  const ratioBox = officialNodeBox;
  useEffect(() => {
    if (!ratioBox) return;
    const curW = data.nodeWidth;
    const curH = data.nodeHeight;
    if (typeof curW !== 'number' || typeof curH !== 'number') return; // 没存过尺寸 ⇒ 渲染时已按比例算，无需写回
    if (Math.abs(curW - ratioBox.nodeWidth) <= 1 && Math.abs(curH - ratioBox.nodeHeight) <= 1) return;
    updateNodeDataTransient(id, {
      nodeWidth: ratioBox.nodeWidth,
      nodeHeight: ratioBox.nodeHeight,
    } as Partial<BaseNodeData>);
    /* ══ §130 官方 `uv`（= 上面注释里的 `cv`）的 **position 规则**（`vendor-pkg-canvas-Dp0xADoD.js` @501355 逐字）══
         ```js
         function uv(e,t){const n=Number.isFinite(e.width)?Number(e.width):t.width,
                                 o=Number.isFinite(e.height)?Number(e.height):t.height,
                           r=e.position?{x:e.position.x+(n-t.width)/2,     // ★ 水平：**中心线固定**
                                         y:e.position.y+o-t.height}      // ★ 垂直：**底边固定**
                                      :e.position;
           return{width:t.width,height:t.height,position:r}}
         ```
         基准盒 `ws={width:250,height:250}`；`cr(ratio)` @500637（ratio>1 ⇒ 高 250、宽 250×r；ratio<1 ⇒ 宽 250、高 250/r）；
         `PQ` @501470 是门（比例拿不到 ⇒ null；与现值**严格相等** ⇒ null）。
         另有动画版 `RQ`（@501530 区）逐帧插值到 `{x: center-w/2, y: bottom-h}`（`r=280ms`、easeOutCubic）—— **同一套锚点**。
        ⚠️ 用户 2026-10-15：「变时能变了 但是变化逻辑 不对 怎么从左边 变化了」——
           MTV 改前**只写 `nodeWidth/nodeHeight`、没写 `position`** ⇒ 左上角固定 ⇒ 看起来「从左边/往右边长」。
           官方从来不是左上角固定。
        ⇒ 这里按官方 `uv` 逐字补 position：`x += (oldW-newW)/2`、`y += oldH-newH`。 */
    const live = useAppStore.getState().nodes.find((n) => n.id === id);
    if (live?.position) {
      updateNodePositionTransient(id, {
        x: live.position.x + (curW - ratioBox.nodeWidth) / 2,
        y: live.position.y + (curH - ratioBox.nodeHeight),
      });
    }
  }, [ratioBox, data.nodeWidth, data.nodeHeight, id, updateNodeDataTransient, updateNodePositionTransient]);
  const source = data.videoUrl;
  if (generatedCover && (generatedCover.source !== source || generatedCover.projectId !== projectId)) {
    setGeneratedCover(null);
  }
  const shouldMountPlayer = !!source && !isFullscreen
    && ((!!selected && isSoleSelectedNode) || activatedSource === source || playingSource === source);

  /* ══════════════════════════════════════════════════════════════════════
     ★ 官方**视频卡独有的 hover 动画** —— hover-to-play 交叉淡入。
     用户 2026：「视频卡和其它卡的 hover 动画不一样」⇒ 确实不一样，官方源码里是独立一条：

     常量（`course-api-base-url-CyloymxZ.js@2957344` 的 `xs.gallery.mediaPreview`）：
       `videoHoverIntentMs: 180` · `videoCrossfadeDurationMs: 100`

     组件 `XJe`（同文件 @2965255）**逐字**：
     ```js
     const { videoHoverIntentMs: qJe, videoCrossfadeDurationMs: YJe } = xs.gallery.mediaPreview;
     const [videoRequested, setVideoRequested] = useState(false);   // f：是否挂 <video>
     const [videoVisible,   setVideoVisible]   = useState(false);   // g：视频层 opacity
     const onEnter = () => { if (!previewEnabled || !playbackSrc) return;
       hoveringRef.current = true; clearTimer();
       timerRef.current = setTimeout(() => { if (!hoveringRef.current) return;
         if (!videoRef.current) { setVideoRequested(true); return; }   // 先挂载，等 loadeddata
         setVideoVisible(true); play(); }, qJe); };
     const onLeave = () => { hoveringRef.current = false; clearTimer();
       videoRef.current?.pause(); videoRef.current && (videoRef.current.muted = true);
       (!videoVisible || reducedMotion) && setVideoRequested(false); setVideoVisible(false); setMuted(true); };
     const onLoadedData  = () => { if (!previewEnabled || !hoveringRef.current) return; setVideoVisible(true); play(); };
     const onTransitionEnd = () => { if (hoveringRef.current || videoVisible) return; setVideoRequested(false); };
     return (
       <div className="relative size-full bg-card" onMouseEnter={onEnter} onMouseLeave={onLeave}>
         <img className="pointer-events-none size-full object-contain" …/>
         {videoRequested && <video ref={videoRef} src={playbackSrc} muted loop playsInline preload="auto"
             className="pointer-events-none absolute inset-0 size-full object-contain transition-opacity ease-out motion-reduce:transition-none"
             style={{ opacity: videoVisible ? 1 : 0, transitionDuration: `${YJe}ms` }}
             onLoadedData={onLoadedData} onTransitionEnd={onTransitionEnd}/>}
         …
       </div>);
     ```
     ⇒ **hover 180ms 意图延迟后把视频层以 100ms `ease-out` 淡入并播放；离开立刻淡出 + 暂停**。
     其它类型的卡没有这条（只有 `flowing-border` 扫光）。MTV 此前只有「hover 弹出播放控制条」。
     ══════════════════════════════════════════════════════════════════════ */
  const [hoverPreviewRequested, setHoverPreviewRequested] = useState(false);
  const [hoverPreviewVisible, setHoverPreviewVisible] = useState(false);
  const hoverPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const hoverIntentTimerRef = useRef<number | null>(null);
  const hoverPreviewHoveringRef = useRef(false);
  /* ★ 原生 hover 态 —— 官方 `VideoPlayer` 的 `r`（`onMouseEnter/onMouseLeave` 在 `sm` 容器上）
     ⇒ 播放器顶左角那排操作 + hover 控制条的**可见门**都读它：
       `O = !hasError && !isGenerating && !isGalleryOpen`（控制条挂载门）
       `U = isHovered || selected || isInClipMode`（可见门） */
  const [isPlayerHovered, setIsPlayerHovered] = useState(false);
  /** 官方 `aU` store 的全局静音（默认 `isMuted:!0`）——MTV 用卡片本地状态表达，语义相同 */
  const [globalMuted, setGlobalMuted] = useState(true);
  const toggleGlobalMuted = useCallback(() => setGlobalMuted((current) => !current), []);

  const clearHoverIntent = useCallback(() => {
    if (hoverIntentTimerRef.current !== null) {
      window.clearTimeout(hoverIntentTimerRef.current);
      hoverIntentTimerRef.current = null;
    }
  }, []);

  const playHoverPreview = useCallback(() => {
    const video = hoverPreviewVideoRef.current;
    if (!video) return;
    video.muted = true;
    void video.play().catch(() => {});
  }, []);

  const handlePreviewMouseEnter = useCallback(() => {
    if (!source || isFullscreen || shouldMountPlayer) return;
    hoverPreviewHoveringRef.current = true;
    clearHoverIntent();
    hoverIntentTimerRef.current = window.setTimeout(() => {
      hoverIntentTimerRef.current = null;
      if (!hoverPreviewHoveringRef.current) return;
      if (!hoverPreviewVideoRef.current) { setHoverPreviewRequested(true); return; }
      setHoverPreviewVisible(true);
      playHoverPreview();
    }, VIDEO_HOVER_INTENT_MS);
  }, [clearHoverIntent, isFullscreen, playHoverPreview, shouldMountPlayer, source]);

  const handlePreviewMouseLeave = useCallback(() => {
    hoverPreviewHoveringRef.current = false;
    clearHoverIntent();
    const video = hoverPreviewVideoRef.current;
    if (video) { video.pause(); video.muted = true; }
    setHoverPreviewVisible(false);
  }, [clearHoverIntent]);

  const handlePreviewLoadedData = useCallback(() => {
    if (!hoverPreviewHoveringRef.current) return;
    setHoverPreviewVisible(true);
    playHoverPreview();
  }, [playHoverPreview]);

  const handlePreviewTransitionEnd = useCallback(() => {
    if (hoverPreviewHoveringRef.current || hoverPreviewVisible) return;
    setHoverPreviewRequested(false);
  }, [hoverPreviewVisible]);

  /* 卸载时清掉意图定时器（官方 `useEffect(() => () => E(), [E])`）。 */
  useEffect(() => () => {
    if (hoverIntentTimerRef.current !== null) window.clearTimeout(hoverIntentTimerRef.current);
    const video = hoverPreviewVideoRef.current;
    if (video) { video.pause(); }
  }, []);
  // 既有生成结果会把视频本身写入 thumbnailUrl，不能把它当作图片封面。
  const suppliedCover = typeof data.thumbnailUrl === 'string'
    && data.thumbnailUrl !== source && data.thumbnailUrl !== data.sourceUrl
    && data.thumbnailUrl !== failedCover ? data.thumbnailUrl : null;

  useEffect(() => {
    if (!source || suppliedCover || isFullscreen) return;
    const controller = new AbortController();
    const derivation = registerCanvasDerivation(useAppStore.getState(), id);
    let current = true;
    void acquireCanvasVideoPoster(source, controller.signal).then((poster) => {
      if (!current) { poster?.release(); return; }
      if (poster) {
        heldPosters.current.add(poster.release);
        setGeneratedCover({ ...poster, source, projectId });
        const state = useAppStore.getState();
        const liveData = getCanvasNodeById(state.nodes, id)?.data;
        if (derivation && isCanvasDerivationFresh(derivation, state) && liveData?.videoUrl === source
          && (liveData.videoWidth !== poster.videoWidth || liveData.videoHeight !== poster.videoHeight
            || liveData.nodeWidth == null || liveData.nodeHeight == null)) {
          state.updateNodeDataTransient(id, {
            videoWidth: poster.videoWidth, videoHeight: poster.videoHeight,
            /* §113：官方按**比例**给尺寸（拿不到比例 ⇒ 不写尺寸，官方 `wPe` 亦 `return null`） */
            ...(officialNodeBox ?? {}),
          });
        }
      }
      if (derivation) completeCanvasDerivation(derivation);
    });
    return () => {
      current = false;
      controller.abort();
      if (derivation) cancelCanvasDerivation(derivation);
    };
  }, [source, suppliedCover, projectId, isFullscreen, id, officialNodeBox]);

  useEffect(() => () => {
    if (generatedCover) {
      generatedCover.release();
      heldPosters.current.delete(generatedCover.release);
    }
  }, [generatedCover]);

  useEffect(() => {
    const held = heldPosters.current;
    const operations = pendingVideoOperations.current;
    return () => {
      held.forEach((release) => release());
      held.clear();
      operations.forEach((controller) => controller.abort());
      operations.clear();
    };
  }, []);

  useEffect(() => {
    const video = shouldMountPlayer ? videoRef.current : null;
    const operations = pendingVideoOperations.current;
    // StrictMode 的额外 cleanup 会清除 src；setup 必须恢复同一 DOM 的当前来源。
    if (video && source && video.getAttribute('src') !== source) {
      video.src = source;
      video.load();
    }
    const previousPlayback = compactPlaybackRestoreRef.current;
    if (video && previousPlayback && previousPlayback.source === source) {
      if (typeof previousPlayback.volume === 'number') video.volume = previousPlayback.volume;
      if (typeof previousPlayback.muted === 'boolean') video.muted = previousPlayback.muted;
    }
    return () => {
      operations.forEach((controller) => controller.abort());
      operations.clear();
      if (video && source && video.readyState > 0) {
        compactPlaybackRestoreRef.current = { source, currentTime: video.ended ? 0 : video.currentTime, shouldPlay: false,
          volume: video.volume, muted: video.muted };
      }
      releaseVideoElement(video);
    };
  }, [shouldMountPlayer, source, projectId]);

  const activateCompactVideo = useCallback(() => {
    if (!source || isFullscreen) return null;
    // 点击回调内同步挂载，随后的 play() 仍属于用户手势，兼容 WebKit。
    flushSync(() => setActivatedSource(source));
    return videoRef.current;
  }, [source, isFullscreen]);

  const requestPlayback = useCallback(() => {
    const video = activateCompactVideo();
    if (video) void video.play().catch(() => setActivatedSource(null));
  }, [activateCompactVideo]);

  
  const handleLoadedMetadata = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (videoWidth > 0 && videoHeight > 0) {
      const mediaDimensionsChanged = data.videoWidth !== videoWidth || data.videoHeight !== videoHeight;
      const nodeDimensionsMissing = data.nodeWidth == null || data.nodeHeight == null;
      /* §113 官方 `wPe` 的容差 ±1：节点尺寸与 `ar(ratio)` 不一致（差 >1）时**改回**官方值。
         比例拿不到（`officialNodeBox === null`）⇒ 官方 `return null` ⇒ 这里也不动尺寸。 */
      const nodeBoxMismatch = officialNodeBox != null && (
        typeof data.nodeWidth !== 'number' || typeof data.nodeHeight !== 'number'
        || Math.abs(data.nodeWidth - officialNodeBox.nodeWidth) > 1
        || Math.abs(data.nodeHeight - officialNodeBox.nodeHeight) > 1
      );
      if (mediaDimensionsChanged || nodeDimensionsMissing || nodeBoxMismatch) {
        updateNodeDataTransient(id, {
          videoWidth,
          videoHeight,
          ...(officialNodeBox ?? {}),
        });
      }
    }

    const source = data.videoUrl;
    const pendingRestore = compactPlaybackRestoreRef.current;
    if (source && pendingRestore?.source === source) {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = duration > 0
        ? Math.min(Math.max(pendingRestore.currentTime, 0), Math.max(duration - 0.01, 0))
        : Math.max(pendingRestore.currentTime, 0);
      compactPlaybackRestoreRef.current = null;
      if (pendingRestore.shouldPlay) {
        void video.play().catch(() => {});
      }
      return;
    }
  }, [
    data.nodeHeight,
    data.nodeWidth,
    data.videoHeight,
    data.videoUrl,
    data.videoWidth,
    id,
    officialNodeBox,
    updateNodeDataTransient,
  ]);

  const dismissInitialCover = useCallback(() => {
    if (data.videoUrl) setDismissedCoverSource(data.videoUrl);
  }, [data.videoUrl]);

  // ── Upload handler for source nodes ──
  const { isUploading, handleUpload: doUpload } = useSourceFileUpload('.mp4,.webm,.avi,.mov,.mkv');

  const handleUpload = useCallback(async () => {
    const result = await doUpload();
    if (!result) return;
    updateNodeData(id, {
      videoUrl: result.dataUrl,
      thumbnailUrl: undefined,
      sourceUrl: undefined,
      filePath: result.filePath,
      fileName: result.fileName,
      label: result.fileName,
      status: 'success',
    } as Partial<BaseNodeData>);
  }, [doUpload, id, updateNodeData]);

  /* ════════════════════════════════════════════
     Fullscreen State — **只由工具栏那颗「全屏」按钮打开**
     ════════════════════════════════════════════
     ⚠️ MTV 偏离（已删）：`onDoubleClick → handleOpenFullscreen`（原来挂在 `.node-preview`、
        `<video>`、封面 `<img>` 三处）是 MTV 自己加的。官方画布上的视频卡
        **没有任何 `onDoubleClick`**（全 chunk 的 `onDoubleClick` 里没有视频节点那处），
        官方进查看器一律走工具栏按钮（图片卡是 `yn.CANVAS.NODE.IMAGE.FULLSCREEN_BTN` + `c(e)`，
        `c = nT()` = `Pc.getState().open(...)`）。 */
  const [isReversingPrompt, setIsReversingPrompt] = useState(false);
  const handleOpenFullscreen = useCallback(() => {
    if (!data.videoUrl && !data.thumbnailUrl) return;
    const compactVideo = videoRef.current;
    const savedPlayback = compactPlaybackRestoreRef.current;
    fullscreenPlaybackRef.current = {
      currentTime: compactVideo?.currentTime
        ?? (savedPlayback && savedPlayback.source === data.videoUrl ? savedPlayback.currentTime : 0),
      wasPlaying: compactVideo ? !compactVideo.paused && !compactVideo.ended : false,
    };
    compactVideo?.pause();
    setIsFullscreen(true);
  }, [data.videoUrl, data.thumbnailUrl]);
  /* ════════════════════════════════════════════
     官方媒体查看器（视频分支）：历史版本 = 本节点生成历史
     ════════════════════════════════════════════ */
  const nodeMediaVersions = useMemo(
    () => collectNodeMediaVersions(id, outputHistoryRecords),
    [id, outputHistoryRecords],
  );
  const viewerPrompt = useMemo(() => {
    if (!viewerSrc) return '';
    return nodeMediaVersions.find((version) => version.src === viewerSrc)?.prompt
      || (data.prompt as string | undefined)
      || '';
  }, [data.prompt, nodeMediaVersions, viewerSrc]);
  const viewerVersion = useMemo(
    () => nodeMediaVersions.find((version) => version.src === viewerSrc),
    [nodeMediaVersions, viewerSrc],
  );
  const viewerShowsCurrentMain = !!viewerSrc && viewerSrc === data.videoUrl;
  const handleViewerCopyPrompt = useCallback(() => {
    if (!viewerPrompt.trim()) return;
    void navigator.clipboard?.writeText(viewerPrompt).then(() => {
      useAppStore.getState().showToast(t('提示词已复制'));
    }).catch(() => {});
  }, [t, viewerPrompt]);
  const handleViewerSetAsMain = useCallback(() => {
    if (!viewerSrc || viewerShowsCurrentMain) return;
    updateNodeData(id, { videoUrl: viewerSrc, thumbnailUrl: viewerSrc } as Partial<BaseNodeData>);
    useAppStore.getState().showToast(t('主视频已更新'));
  }, [id, updateNodeData, t, viewerShowsCurrentMain, viewerSrc]);
  const handleViewerDownload = useCallback(async () => {
    if (!viewerSrc || viewerDownloading) return;
    setViewerDownloading(true);
    try {
      const result = await saveNodeOutputToFile({
        filePath: viewerVersion?.filePath || (data.filePath as string | undefined),
        mediaUrl: viewerSrc,
        textOutput: undefined,
        nodeType: 'ai-video',
        fileName: (data.fileName as string | undefined) || (data.label as string | undefined),
      });
      /* 官方：保存/下载由「文件传输中心」自动上报，不再弹「文件已保存」toast */
      void result;
    } catch {
      useAppStore.getState().showToast(t('文件保存失败'));
    } finally {
      setViewerDownloading(false);
    }
  }, [data.fileName, data.filePath, data.label, t, viewerDownloading, viewerSrc, viewerVersion]);

  const handleCloseFullscreen = useCallback(() => {
    const fullscreenVideo = fullscreenVideoRef.current;
    if (data.videoUrl) {
      compactPlaybackRestoreRef.current = {
        ...(compactPlaybackRestoreRef.current?.source === data.videoUrl ? compactPlaybackRestoreRef.current : {}),
        source: data.videoUrl,
        currentTime: fullscreenVideo?.currentTime ?? fullscreenPlaybackRef.current.currentTime,
        // 旧实现关闭全屏后，节点播放器会保持打开前的播放/暂停状态。
        // 全屏播放器会自动播放，不能据此把原本暂停的节点意外改成播放。
        shouldPlay: fullscreenPlaybackRef.current.wasPlaying,
      };
      setActivatedSource(fullscreenPlaybackRef.current.wasPlaying ? data.videoUrl : null);
    }
    releaseVideoElement(fullscreenVideo);
    fullscreenVideoRef.current = null;
    setIsFullscreen(false);
    setViewerSrc(null);
  }, [data.videoUrl]);
  const setFullscreenVideoElement = useCallback((video: HTMLVideoElement | null) => {
    // React StrictMode 会额外执行一次 callback ref 的 detach/attach。
    // detach 时不能移除 src，否则同一 DOM 节点重新 attach 后会停在 0:00。
    if (!video) return;
    if (fullscreenVideoRef.current && fullscreenVideoRef.current !== video) {
      releaseVideoElement(fullscreenVideoRef.current);
    }
    fullscreenVideoRef.current = video;
  }, []);
  const handleFullscreenLoadedMetadata = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = duration > 0
      ? Math.min(Math.max(fullscreenPlaybackRef.current.currentTime, 0), Math.max(duration - 0.01, 0))
      : Math.max(fullscreenPlaybackRef.current.currentTime, 0);
  }, []);

  useEffect(() => () => {
    releaseVideoElement(fullscreenVideoRef.current);
    fullscreenVideoRef.current = null;
  }, []);

  /* ══ §93 ★ 官方**标题命名逻辑** ══
     官方外层壳 `gr`（`pLe` @846915）逐字：`H = y?.title || i || "Title"`
       （`y` = `data` ⇒ 官方 `data.title`；`i` = 调用方传的 `defaultTitle`）
     各变体 `defaultTitle` 逐字：
       · `cse` GENERATE @2076580：`C=n?.title||"Video"`（**硬编码 `"Video"`，不走 i18n**）
       · `dse` UPLOAD   @2081160：**不传 defaultTitle** ⇒ `data.title`；上游建卡
         `S0t` @3522844 `KT({src:t,title:qO(e,"Video")},…)` + `qO` @3522516
         `return e.name?.split(".")[0]||t` ⇒ **标题 = 文件名去掉扩展名**
       · `qoe` CLIP @1977578 / `mse` UPSCALE @2093105 ⇒ MTV 无实现，见工具文件
     渲染处 `WDe` @833604 `children:e` 原样输出，全链**无本地化**。
     ⇒ `displayLabel` 不再走 `useNodeRename` 的 `data.label || fallback`
       （那会把 MTV 旧的类型默认「生成视频」当作用户标题），改用官方口径解析器。 */
  const displayLabel = resolveOfficialVideoNodeTitle(data);
  const { handleRename } = useNodeRename(id, data, displayLabel);
  const generatedCoverUrl = generatedCover && generatedCover.source === data.videoUrl && generatedCover.projectId === projectId
    ? generatedCover.src
    : null;
  const initialCoverUrl = suppliedCover || generatedCoverUrl;
  const showInitialCover = !!initialCoverUrl && dismissedCoverSource !== data.videoUrl;

  // 独立编辑器窗口导出完成后，在源节点旁新建一个视频节点承载结果
  useEffect(() => {
    const projectId = useAppStore.getState().currentProjectId;
    if (!projectId) return;

    const instanceId = buildVideoEditorProjectId(projectId, id);
    return subscribeVideoEditorWindow(instanceId, (message) => {
      // 编辑器没有 Store 也没有 API Key：模型目录与转场生成都由主窗口代跑
      if (message.type === 'storyai:video-editor-models-request') {
        void postVideoEditorModels(instanceId, listVideoEditorVideoModels())
          .catch((error) => console.error('[videoEditor] 下发视频模型列表失败:', error));
        return;
      }

      if (message.type === 'storyai:video-editor-ai-transition-request') {
        const request = (message.payload ?? {}) as Partial<VideoEditorAiTransitionRequest>;
        const requestId = typeof request.requestId === 'string' ? request.requestId : '';
        if (!requestId) return;
        void (async () => {
          try {
            const outcome = await runVideoEditorAiTransition(
              request as VideoEditorAiTransitionRequest,
              projectId,
            );
            await postVideoEditorAiTransitionResult(instanceId, { requestId, ...outcome });
          } catch (error) {
            console.error('[videoEditor] AI 转场生成失败:', error);
            await postVideoEditorAiTransitionResult(instanceId, {
              requestId,
              error: error instanceof Error ? error.message : String(error),
            }).catch(() => {});
          }
        })();
        return;
      }

      if (message.type === 'storyai:video-editor-frame-exported') {
        const framePayload = (message.payload ?? {}) as Partial<VideoEditorFrameExportResult>;
        const imageUrl = typeof framePayload.imageUrl === 'string' ? framePayload.imageUrl : '';
        if (!imageUrl) return;

        const frameStore = useAppStore.getState();
        const frameDerivation = registerCanvasDerivation(frameStore, id);
        if (!frameDerivation) return;

        void (async () => {
          try {
            const dims = await computeImageNodeDimensions(imageUrl);
            // 取帧要等图片解码，期间可能已切项目或删节点，落盘前再验一次
            if (!isCanvasDerivationFresh(frameDerivation, useAppStore.getState())) {
              cancelCanvasDerivation(frameDerivation);
              return;
            }

            const liveStore = useAppStore.getState();
            const frameSource = liveStore.nodes.find((node) => node.id === id);
            const framePosition = frameSource?.position ?? { x: 0, y: 0 };
            const time = typeof framePayload.time === 'number' ? framePayload.time : 0;

            liveStore.addNode({
              id: `node-${generateId()}`,
              type: 'ai-image',
              // 放在剪辑结果节点下方，避免和"导出为新节点"的产物叠在一起
              position: {
                x: framePosition.x + nodeWidth + 40,
                y: framePosition.y + nodeHeight + 40,
              },
              data: {
                label: t('{name} {time}s 帧', { name: displayLabel, time: time.toFixed(2) }),
                type: 'ai-image',
                role: 'source',
                status: 'success',
                imageUrl,
                filePath: typeof framePayload.filePath === 'string' ? framePayload.filePath : undefined,
                fileName: typeof framePayload.fileName === 'string' ? framePayload.fileName : undefined,
                imageWidth: typeof framePayload.width === 'number' ? framePayload.width : undefined,
                imageHeight: typeof framePayload.height === 'number' ? framePayload.height : undefined,
                ...dims,
              },
            } as Parameters<typeof liveStore.addNode>[0]);

            completeCanvasDerivation(frameDerivation);
            useAppStore.getState().showToast(t('当前帧已生成图片节点'));
          } catch (error) {
            cancelCanvasDerivation(frameDerivation);
            console.error('[videoEditor] 当前帧回写失败:', error);
            useAppStore.getState().showToast(t('当前帧生成节点失败'), 'error');
          }
        })();
        return;
      }

      if (message.type !== 'storyai:video-editor-exported') return;
      const payload = (message.payload ?? {}) as Partial<VideoEditorExportResult>;
      const videoUrl = typeof payload.videoUrl === 'string' ? payload.videoUrl : '';
      if (!videoUrl) return;

      // 导出是跨窗口的异步结果：期间可能已切换项目或删掉源节点，
      // 用派生守卫挡掉过期回写，避免落到别的画布上
      const store = useAppStore.getState();
      const derivation = registerCanvasDerivation(store, id);
      if (!derivation) return;
      if (!isCanvasDerivationFresh(derivation, useAppStore.getState())) {
        cancelCanvasDerivation(derivation);
        return;
      }

      const sourceNode = store.nodes.find((node) => node.id === id);
      const position = sourceNode?.position ?? { x: 0, y: 0 };
      const outputWidth = typeof payload.width === 'number' ? payload.width : 0;
      const outputHeight = typeof payload.height === 'number' ? payload.height : 0;
      /* §113：官方视频节点工厂写死 `ar(16/9)`（`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js`
         @735528 区 `{width:N,height:E}=ar(16/9)`）；不是按导出像素 fit。 */
      const dimensions = officialVideoNodeBox('16:9')
        ?? { nodeWidth: DEFAULT_VIDEO_NODE_WIDTH, nodeHeight: DEFAULT_VIDEO_NODE_HEIGHT };

      store.addNode({
        id: `node-${generateId()}`,
        type: 'ai-video',
        position: { x: position.x + nodeWidth + 40, y: position.y },
        data: {
          label: t('{name} 剪辑', { name: displayLabel }),
          type: 'ai-video',
          role: 'source',
          status: 'success',
          videoUrl,
          filePath: typeof payload.filePath === 'string' ? payload.filePath : undefined,
          fileName: typeof payload.fileName === 'string' ? payload.fileName : undefined,
          videoDuration: typeof payload.duration === 'number' ? payload.duration : undefined,
          videoWidth: outputWidth || undefined,
          videoHeight: outputHeight || undefined,
          ...dimensions,
        },
      } as Parameters<typeof store.addNode>[0]);

      completeCanvasDerivation(derivation);
      useAppStore.getState().showToast(t('剪辑结果已生成新节点'));
    });
  }, [displayLabel, id, nodeHeight, nodeWidth, t]);

  const handleCopyFile = useCallback(async () => {
    const store = useAppStore.getState();
    const filePath = data.filePath as string | undefined;
    if (!filePath) {
      store.showToast(t('该视频没有本地文件，无法复制'), 'error');
      return;
    }
    const ok = await copyFileToClipboard(filePath);
    store.showToast(ok ? t('已复制视频到剪贴板') : t('复制失败'), ok ? undefined : 'error');
  }, [data.filePath, t]);

  /* ★ 官方工具栏 `download`（`R(case "download")`，桌面版 @2685052）：
       `const H = await Rg.downloadNodes(e); if (!H.success || H.downloadableNodeCount === 0)
          toast.error("Video download failed")`
     MTV 复用节点右键「另存为…」的同一个服务 `saveNodeOutputToFile`（与图像工具栏同一口径），
     失败文案照官方 `Video download failed` 的中文对应（MTV 其余下载路径统一用「文件保存失败」）。 */
  const [isDownloading, setIsDownloading] = useState(false);
  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    const store = useAppStore.getState();
    setIsDownloading(true);
    try {
      await saveNodeOutputToFile({
        filePath: data.filePath as string | undefined,
        mediaUrl: data.videoUrl as string | undefined,
        textOutput: undefined,
        nodeType: 'ai-video',
        fileName: (data.fileName as string | undefined) || (data.label as string | undefined),
      });
    } catch {
      store.showToast(t('文件保存失败'), 'error');
    } finally {
      setIsDownloading(false);
    }
  }, [data.fileName, data.filePath, data.label, data.videoUrl, isDownloading, t]);

  /* 官方工具栏 `upscale`（桌面版 @2686052）：在当前节点右侧 `+100px` 新建视频增强节点，
     复制宽高、连 `source:e -> target:Q.id`，参数写入
     `{resolution:"1080p", frameRate:"auto", slow_motion:1}`。
     ⚠️ MTV 没有「视频增强节点」这个节点类型（官方 `g8` + `Gje.handleUpscale` 那一整套
        浮层/请求链未实现）⇒ 按官方 `hdUpscaleMaintenance` 文案给出「维护升级中」提示，
        **不伪造一个官方语义的节点**。§54 记为未做到。 */
  const isUpscaling = false;
  const handleUpscale = useCallback(() => {
    useAppStore.getState().showToast(t('视频增强功能维护升级中，请稍后再试'), 'error');
  }, [t]);

  const handleCaptureFrame = useCallback(async (position: CaptureFramePosition = 'current') => {
    const store = useAppStore.getState();
    const video = videoRef.current ?? activateCompactVideo();
    const frameLabel = t(CAPTURE_FRAME_LABELS[position]);

    if (!video || !data.videoUrl) {
      store.showToast(t('没有可截取的视频'), 'error');
      return;
    }

    const controller = new AbortController();
    const derivation = registerCanvasDerivation(store, id, { onCancel: () => controller.abort() });
    if (!derivation) {
      store.showToast(t('视频节点已失效，请重试'), 'error');
      return;
    }
    pendingVideoOperations.current.add(controller);
    try {
      try {
        await waitForCanvasVideoReady(video, controller.signal);
      } catch {
        if (!controller.signal.aborted && isCanvasDerivationFresh(derivation, useAppStore.getState())) {
          store.showToast(t('视频尚未加载到可截取的帧'), 'error');
        }
        return;
      }
      if (controller.signal.aborted || !isCanvasDerivationFresh(derivation, useAppStore.getState())) return;
      const captureTime = resolveCaptureTime(video, position);
      const ensureFresh = () => {
        const fresh = !controller.signal.aborted && isCanvasDerivationFresh(derivation, useAppStore.getState());
        if (!fresh) cancelCanvasDerivation(derivation);
        return fresh;
      };

      const createFrameNode = async (
        frame: { dataUrl: string; width: number; height: number },
        localizedSource?: Pick<BaseNodeData, 'videoUrl' | 'filePath' | 'sourceUrl'>,
      ): Promise<boolean> => {
        const dims = await computeImageNodeDimensions(frame.dataUrl);
        if (!ensureFresh()) return false;

        let liveStore = useAppStore.getState();
        const currentNode = liveStore.nodes.find((node) => node.id === id);
        const currentPosition = currentNode?.position ?? { x: 0, y: 0 };
        const frameFileName = buildNodeFileName(`${displayLabel} ${frameLabel}`, 'jpg', `video-frame-${Date.now()}`);
        const savedFrame = derivation.projectId !== 'default'
          ? await saveDataUrlToProjectData(frame.dataUrl, derivation.projectId, frameFileName)
          : null;
        if (!ensureFresh()) return false;

        liveStore = useAppStore.getState();
        const imageUrl = savedFrame?.assetUrl || frame.dataUrl;

        if (localizedSource) {
          // 取帧和保存均已完成；接下来同步交付，避免自己的来源更新触发播放器卸载而取消结果。
          pendingVideoOperations.current.delete(controller);
          liveStore.updateNodeData(id, localizedSource);
          liveStore = useAppStore.getState();
        }

        liveStore.addNode({
          id: `node-${generateId()}`,
          type: 'ai-image',
          ...derivedNodePlacement({
            position: currentPosition,
            parentId: currentNode?.parentId,
            data: currentNode?.data ?? ({ nodeWidth } as BaseNodeData),
          }),
          data: {
            label: `${displayLabel} ${frameLabel}`,
            type: 'ai-image',
            role: 'source',
            status: 'success',
            imageUrl,
            filePath: savedFrame?.filePath,
            fileName: frameFileName,
            imageWidth: frame.width,
            imageHeight: frame.height,
            ...dims,
          },
        } as Parameters<typeof liveStore.addNode>[0]);
        completeCanvasDerivation(derivation);
        return true;
      };

      const restoreTime = video.currentTime;
      try {
        const frame = await captureFrameAtTime(video, captureTime);
        if (!ensureFresh()) return;
        restoreVideoTime(video, restoreTime);
        const created = await createFrameNode(frame);
        if (created) useAppStore.getState().showToast(t('已截取{frame}为图像节点', { frame: frameLabel }), 'success');
      } catch (error) {
        if (!ensureFresh()) return;
        restoreVideoTime(video, restoreTime);
        if (!isTaintedCanvasError(error)) {
          cancelCanvasDerivation(derivation);
          const message = error instanceof Error ? error.message : t('截取{frame}失败', { frame: frameLabel });
          if (useAppStore.getState().currentProjectId === derivation.projectId) {
            useAppStore.getState().showToast(t('截取{frame}失败：{message}', { frame: frameLabel, message }), 'error');
          }
          return;
        }

        if (!ensureFresh()) return;
        const remoteUrl = isRemoteMediaUrl(data.sourceUrl) ? data.sourceUrl : data.videoUrl;
        if (!isRemoteMediaUrl(remoteUrl)) {
          cancelCanvasDerivation(derivation);
          const message = error instanceof Error ? error.message : t('本地资源截帧失败');
          useAppStore.getState().showToast(t('截取{frame}失败：{message}', { frame: frameLabel, message }), 'error');
          return;
        }
        if (derivation.projectId === 'default') {
          cancelCanvasDerivation(derivation);
          useAppStore.getState().showToast(t('该视频来源禁止导出{frame}，请先上传为本地视频后再截帧', { frame: frameLabel }), 'error');
          return;
        }
        useAppStore.getState().showToast(t('远程视频受跨域限制，正在转为本地资源后重试...'), 'success');
        const saved = await downloadUrlAndSave(remoteUrl, derivation.projectId, 'video-source');
        if (!ensureFresh()) return;
        if (!saved?.assetUrl) {
          cancelCanvasDerivation(derivation);
          useAppStore.getState().showToast(t('远程视频本地化失败，无法截取{frame}', { frame: frameLabel }), 'error');
          return;
        }

        try {
          const frame = await captureFrameFromVideoUrl(saved.assetUrl, captureTime);
          if (!ensureFresh()) return;
          const created = await createFrameNode(frame, {
            videoUrl: saved.assetUrl,
            filePath: saved.filePath,
            sourceUrl: remoteUrl,
          });
          if (created) useAppStore.getState().showToast(t('已截取{frame}为图像节点', { frame: frameLabel }), 'success');
        } catch (fallbackError) {
          if (!ensureFresh()) return;
          cancelCanvasDerivation(derivation);
          const message = fallbackError instanceof Error ? fallbackError.message : t('本地资源截帧失败');
          if (useAppStore.getState().currentProjectId === derivation.projectId) {
            useAppStore.getState().showToast(t('截取{frame}失败：{message}', { frame: frameLabel, message }), 'error');
          }
        }
      }
    } finally {
      pendingVideoOperations.current.delete(controller);
      cancelCanvasDerivation(derivation);
    }
  }, [activateCompactVideo, data.sourceUrl, data.videoUrl, displayLabel, id, nodeWidth, t]);

  // 反推提示词：抽首/中/尾三帧当序列喂给文本模型，让它把画面和运动一起还原
  const handleShowPrompt = useCallback(() => {
    const nodeElement = document.querySelector(`.react-flow__node[data-id="${id}"]`);
    if (nodeElement) {
      const rect = nodeElement.getBoundingClientRect();
      openNodeDialog(id, { x: rect.left + rect.width / 2, y: rect.bottom });
      return;
    }
    openNodeDialog(id);
  }, [id, openNodeDialog]);

  const handleReversePrompt = useCallback(async () => {
    const store = useAppStore.getState();
    const video = videoRef.current ?? activateCompactVideo();
    if (!video || !data.videoUrl) {
      store.showToast(t('没有可反推的视频'), 'error');
      return;
    }
    const controller = new AbortController();
    const derivation = registerCanvasDerivation(store, id, { onCancel: () => controller.abort() });
    if (!derivation) return;
    pendingVideoOperations.current.add(controller);
    setIsReversingPrompt(true);
    let restoreTime = video.currentTime;
    try {
      await waitForCanvasVideoReady(video, controller.signal);
      restoreTime = video.currentTime;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const times = duration > 0
        ? [0, duration / 2, Math.max(0, duration - LAST_FRAME_BACKOFF)]
        : [video.currentTime];
      const frames: string[] = [];
      for (const time of times) {
        if (controller.signal.aborted || !isCanvasDerivationFresh(derivation, useAppStore.getState())) return;
        frames.push((await captureFrameAtTime(video, time)).dataUrl);
      }
      if (controller.signal.aborted || !isCanvasDerivationFresh(derivation, useAppStore.getState())) return;
      useAppStore.getState().setReversePromptRequest({
        sourceNodeId: id,
        kind: 'video',
        imageUrls: frames,
      });
    } catch (error) {
      if (controller.signal.aborted || !isCanvasDerivationFresh(derivation, useAppStore.getState())) return;
      const message = isTaintedCanvasError(error)
        ? t('远程视频受跨域限制，请先把视频本地化后再反推')
        : error instanceof Error ? error.message : t('读取视频帧失败');
      useAppStore.getState().showToast(message, 'error');
    } finally {
      // 三帧一次性取完再复位，中间来回跳会让 seek 互相打架
      if (!controller.signal.aborted) restoreVideoTime(video, restoreTime);
      pendingVideoOperations.current.delete(controller);
      completeCanvasDerivation(derivation);
      setIsReversingPrompt(false);
    }
  }, [activateCompactVideo, data.videoUrl, id, t]);

  useCanvasNodeLodProtection(id, isFullscreen || !!playingSource || !!activatedSource
    || isUploading || isReversingPrompt || !!failedCover);

  /* ══════════════════════════════════════════════════════════════════════════════
     ★ 官方 `VideoRender`（`O0`）/ `VideoPlayer`（`Goe`）**因子对齐**（逐个因子给 MTV 来源）
     证据：`live-assets-new/vendor-pkg-canvas-CvbAwZyy.js`（charIdx = JS 字符串下标）
       · `Goe = a.memo(({hasError,isFavorited,isGalleryOpen,isGenerating,isHovered,isInClipMode,
          isOptimistic,favoriteSource,nodeId,onError,onFavorite,onFrameChange,retryStamp,selected,
          src,trimEnd,trimStart}) => …)` —— `Goe=` @1958433，body 2483 字符
       · `O0 = a.memo(({src,mediaViewerResources,onSetAsMain,isGenerating,nodeId,selected,trimStart,
          trimEnd,isOptimistic,isFavorited,onFavorite}) => …)` —— `O0=` @1962079
     ══════════════════════════════════════════════════════════════════════════════ */

  /** 官方 `Goe` 的 `hasError`（`O0` 的 `x` 状态）。
      官方生产者链（逐字）：\`<video onError={F}>\` → \`F\` 里 \`M()\`（= \`m(!1), u()\`）→ \`O0\` 的
      \`onError={I}\` → \`I=()=>{_(!1), y(!0)}\` ⇒ \`hasError = true\`。
      **MTV 现在补上了同一条链**：主 \`<video>\` 挂 \`onError={() => setVideoLoadFailed(true)}\`
      （本文件上面），换 src 时清回 \`false\`（对应官方重试键的动作）。
      ⚠️ 先前那版曾用节点状态枚举 \`data.status === 'error'\` 顶替 —— 那是**判断不是实证**，
      且语义不同（\`status='error'\` 仍可能留着可播放的 \`videoUrl\`，官方那种情况不会隐藏操作行）⇒ 已撤销。 */
  const videoHasError = videoLoadFailed;

  /** 官方 `O0` 的 `T = N === "video-clip"`（`N` 读浮动编辑器 store 的 `floatingEditorMode`）。
      🚨 **官方有、MTV 无生产者** ⇒ 取 `false`（MTV 没有 `video-clip` 浮层、`clip` 工具栏键未注册）。 */
  const isInClipMode = false;

  /** 官方 `Goe` 的 `isGenerating`（`O0` 的 `o` prop，缺省 `!1`；调用方逐字传
      `isGenerating: !!o.loading || Nr(o.taskInfo)`）。MTV 同义物 = `data.status === 'loading'`
      （本文件别处已用同一判据表达「生成中」）。 */
  const isGenerating = data.status === 'loading';

  /** 官方 `Goe` 的 `isGalleryOpen`（`O0` 的 `S = D0(nodeId)`；
      `D0 = e => pF(t => t.openGalleryNodeId === e)` @`vendor-pkg-canvas-CvbAwZyy.js` 1694239
      ⇒ 语义 = 「**本节点**的全屏媒体画廊处于打开态」）。
      MTV 同义物 = 本节点的全屏媒体查看器 `isFullscreen`（同为「按节点」的布尔，且打开时
      本节点整卡被查看器覆盖）。⚠️ MTV 另有一个 `PileGallery` 堆叠画廊，那**不是**官方的
      `openGalleryNodeId`，不要拿它来顶。 */
  const isGalleryOpen = isFullscreen;

  /* ── 官方收藏（`Goe` 的 `favoriteSource` / `isFavorited` / `onFavorite`）──────────────
     官方 `O0` 逐字传 `favoriteSource: e` —— `e` 就是 `O0` 的**原始 `src` prop**，
     **不是** `wo(src)`（CDN 归一）也不是 `Hoe(src)`（`display_hd` 缩略图变体）。
     ⇒ MTV 的 `favoriteSource` = `data.videoUrl`（原始地址），**不是** `initialCoverUrl`。
     `isFavorited` / `onFavorite` 在官方是**调用方给的两个独立 prop**
     （`GenerateVideoNode` 逐字 `s.jsx(O0,{src:G,mediaViewerResources:R,onSetAsMain:…,isGenerating:N,
     nodeId:o,selected:e,isFavorited:je,onFavorite:$})` @2080379 邻域）；MTV 没有这条上层链，
     改用官方同源的资产解析就地求出：`favoriteTargetOf`(=`g8`) + `useFavoriteStatus`(=`nc`)
     + `store.toggleFavorite`(=`L_`)。 */
  const favoriteSource = data.videoUrl;
  const favoriteTarget = useMemo(
    () => (favoriteSource
      ? favoriteTargetOf({ id, type: data.type, data }, favoriteSource)
      : null),
    [data, favoriteSource, id],
  );
  const favoriteStatus = useFavoriteStatus(favoriteTarget?.sourceFileId);
  /** 官方 `isFavorited` 是布尔 prop（缺省 `!1`）⇒ MTV 把 `undefined`（无 `sourceFileId`）压成 `false` */
  const isFavorited = favoriteStatus === true;
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  /** 官方 `Goe` 收藏键 `onClick: B => { B.stopPropagation(); p(c) }`（`p`=onFavorite，`c`=favoriteSource） */
  const handleToggleFavorite = useCallback(() => {
    if (!favoriteTarget) return;
    void toggleFavorite(favoriteTarget.sourceFileId, favoriteTarget.asset);
  }, [favoriteTarget, toggleFavorite]);

  /**
   * 官方 `Goe` 的操作行**整体门** —— 逐字 `O = !e && !o && !n`
   * （`e`=hasError · `o`=isGenerating · `n`=isGalleryOpen）。
   */
  const officialActionRowGate = !videoHasError && !isGenerating && !isGalleryOpen;

  /**
   * 官方 `Goe` 的操作行**可见门** —— 逐字 `U = r || h || i || t`
   * （`r`=isHovered · `h`=selected · `i`=isInClipMode · `t`=isFavorited）
   * ⇒ `opacity-100` / `opacity-0 pointer-events-none`。
   */
  const officialActionRowVisible = isPlayerHovered || !!selected || isInClipMode || isFavorited;

  /** MTV 侧的「卡片有媒体」外壳：对应官方 `O0` 的 `f = wo(src); if (!f) return null`
      —— 官方**没有媒体就整张卡不渲染**，这里保留为操作行的外壳条件。 */
  const hasCardMedia = !!(data.videoUrl || data.thumbnailUrl);

  /**
   * 官方 `O0` 的「海报上的收藏指示」门 —— 逐字 `L = !k && !!p && u && !o && !S`
   * （`k` = 播放器**挂载门** `eXe({isHovered, mountImmediately})` · `p`=onFavorite ·
   *   `u`=isFavorited · `o`=isGenerating · `S`=isGalleryOpen）。
   *
   * ⚠️ 复核订正：任务书把这一条写成 `!isPlayerMounted`，但产物里 `!isPlayerMounted` 的**真身是 `k`
   *    （挂载门）而不是 `b`（`isPlayerMounted` 状态）** —— `O0` 里 `b` 只出现在
   *    `j = !b || !k || x || o`（海报 hidden）。MTV 的同位物 = `shouldMountPlayer`（MTV 的挂载门）。
   *
   * `!!p`（onFavorite 存在）⇒ MTV 用 `!!favoriteTarget`（`favoriteTargetOf` 解析不到资产 = 官方
   * `g8` 返回 `undefined`，与 `oQe` 的 `if(!o) return null` 同结果：**这颗键不渲染**）。
   */
  const showPosterFavoriteIndicator = !shouldMountPlayer && !!favoriteTarget
    && isFavorited && !isGenerating && !isGalleryOpen;

  /** MTV 附加（官方 `VideoPoster` 无此参数）：自带缩略图加载失败 ⇒ 回落到抽帧封面 */
  const handlePosterError = useCallback(() => {
    if (suppliedCover) setFailedCover(suppliedCover);
  }, [suppliedCover]);

  /**
   * 官方 `VideoPoster`（`$oe`）的状态机（重试阶梯 `[500,1000,2000]` + `key={retryCount}` 重挂）。
   * ⚠️ MTV 偏离④：官方是 `a.memo(...)` 组件，这里落成 hook + 就地 `<img>`（DOM 输出一致），
   *    原因见函数上方的记账。这里**无条件**调用（hook 规则），两处渲染点共用同一份 `<img>` props。
   */
  const { posterKey, posterProps } = useOfficialVideoPoster({
    src: initialCoverUrl,
    nodeId: id,
    onPosterError: handlePosterError,
  });

  return (
    <div className="node-wrapper relative" style={{ width: nodeWidth }}>
      <NodeLabel
        kind="ai-video"
        label={displayLabel}
        displayId={data.displayId as number | undefined}
        nodeId={id}
        onRename={handleRename}
      />
      {/* ══════════════════════════════════════════════════════════════════════
          官方「上传」胶囊（节点层）—— **有 src 时不存在，空卡且有选中态时才有**。

          官方逐字（`vendor-pkg-canvas-CvbAwZyy.js`）：
          · 出现门（`cse` = `GenerateVideoNode` @2076580）：
              `k = e && !y && !d && !N && !x && !E`
                e = selected · y = `data.src`
                d = `bu(o)`（**不是** focused！`bu` @521485 = `dr()(画布只读) || <本节点被别的设备锁住>`）
                N = `Nr(taskInfo)`（生成中）· x = isUploading
                E = `d1({id,handleType:'target'}).length>0`（**有入边**）
              `s.jsx(SE,{nodeId:o,visible:k,isDragging:t,onClick:g})`
            ★ 图像卡用的是**同一个** `SE`（`CN` @1938591 逐字
              `s.jsx(SE,{nodeId:o,visible:$e,isDragging:l,disabled:!u,onClick:f,tooltip:…})`，
              门 `$e = t && !g && !d && !Oe && !h && !S` @1935325；`Oe` = 生成中 **或** 生成完 12s 余温，
              比视频多这一条余温门，并多一个 `disabled:!u`（上传策略））⇒ 两卡同源，MTV 也走同一套。
          · 壳 `SE`（`displayName="NodeUploadToolbar"` @1618713）→ `rc`（`NodeToolbarLayer` @1071669，
            `placement:"top"`）→ `Hne`（`displayName="NodeUploadButton"` @1617962），`Hne` 逐字：
              `<div ref={r} className="nodrag nopan pointer-events-auto absolute left-1/2 z-10 rounded-full border bg-popover"
                    style={{ bottom:"calc(100% + 24px)",
                             transform:"translateX(-50%) scale(var(--float-scale, 1))",
                             transformOrigin:"center bottom" }}
                    onPointerDown={e=>e.stopPropagation()}>
                 <Button variant="obsidian" size="custom" disabled={disabled}
                         className={z("h-auto gap-1.5 rounded-full px-3 py-2 text-sm text-popover-foreground",
                                      disabled && "opacity-60")}
                         onClick={e=>{e?.stopPropagation(); !disabled && onClick()}}>
                   <Da size={16}/><span>{t("canvas.upload")}</span>
                 </Button>
               </div>`
            `Da` = `vendor-packages-DRvCmDjR.js` 局部名 `gc`（导出表 `IconUpload:gc` @512962；
            定义 @375799 `gc=({className:e,size:t=16})=>…viewBox"0 0 48 48"…path d="M24 9.375V28.875…"`
            ）—— MTV 的 `assets/official-icons/upload.svg` 就是同一支 path ✓
            `canvas.upload` 四语（canvas @3668454 / @3880151 / @4060451 / @4200790 / @4335234）：
              en `Upload` · fr `Télécharger` · ja `アップロード` · ko `업로드` · zh「上传」

          ★ MTV 落地方式：**复用图像卡那一套**（用户要求「视频卡的状态与逻辑应与图像卡是同一套」）：
            · DOM/几何/高光全部走既有的 `.node-upload-pill`（`styles/nodes.css` @378，官方抠值）
            · 图标 = `OfficialIcon name="upload"`（同一支官方 path，size 16）
            · 文案 = `t('上传')`（= 官方 `canvas.upload`，四语已补）
            · 可见性 = `.react-flow__node.selected .node-upload-pill{opacity:1;pointer-events:auto}`（官方
              「仅选中态」；hover 不带出胶囊 —— 官方四态实测）
            · 生成中/刚生成完不出胶囊（与图像卡同一门；对应官方 `!N` / `!Ue`）
            · 额外补官方视频档独有的 `!E`（有入边 = 已被当作参考输入，不给上传入口）
          ⚠️ 未逐字确证：官方 `d = bu(o)` 在 MTV 没有等价量；MTV 用 `inPile`（堆叠成员不显示自身外层件）
             作为同义门，见下方条件。`onUploadError`（官方把 `data.type` 重置回 `_o.GENERATE`）在 MTV
             没有 `data.type` 变体字段 ⇒ 无对应物。
          ══════════════════════════════════════════════════════════════════════ */}
      {isGenerateVariant && !data.videoUrl && !isUploading && data.status !== 'loading' && !justCompleted
        && !hasIncomingConnection && !inPile && (
        <button
          type="button"
          className="node-upload-pill nodrag nopan"
          onClick={() => { void handleUpload(); }}
          aria-label={t('上传')}
        >
          <OfficialIcon name="upload" size={16} />
          {t('上传')}
        </button>
      )}
      {/* ══ 官方 `dse`（UPLOAD，@2081160）的卡上按钮 `TE` ══
          官方逐字（`TE` = `vendor-pkg-canvas-CvbAwZyy.js` @1673867，`displayName="UploadButton"`）：
          ```js
          const TE=a.memo(({onClick:e,className:t})=>{const{t:n}=se();return Ux()>1?null
            :s.jsx("div",{children:s.jsxs(Wt,{variant:"secondary",
                className:z("text-white flex items-center gap-2 w-fit bg-secondary/80 cursor-pointer border border-border/50 ",t),
                onClick:e,children:[s.jsx(Da,{size:20}),n("canvas.replace")]})})});
          ```
          调用点 `dse`：`!c && s.jsx(TE,{className:"absolute top-2 right-2 z-5 opacity-0 group-hover:opacity-100 transition-opacity",onClick:m})`
            · `c = dr()`（只读画布）· `m = triggerUpload`（本文件 = `handleUpload`）
            · `Ux()>1` = 选中数 > 1 ⇒ 多选时不渲染
            · `Da` = 同一支官方 upload path（MTV `OfficialIcon name="upload"`）
            · `canvas.replace` zh = **「替换」**（canvas i18n zh @4324756 逐字 `replace:"替换"`）
          ⚠️ MTV 未逐字确证：`Wt variant="secondary"` 是 shadcn `Button`，其**类串在
             `vendor-libs-BqrVOBEZ.js` 的 cva 变体表里**，MTV 没有该组件；这里用 MTV 既有的
             `.node-upload-pill`（几何/高光本身就是从官方抠的）承载同一颗键，文案/图标/位置/门全部照官方。 */}
      {isUploadVariant && isSingleSelection && !inPile && (
        <button
          type="button"
          className="node-upload-pill nodrag nopan"
          onClick={() => { void handleUpload(); }}
          aria-label={t('替换')}
        >
          <OfficialIcon name="upload" size={20} />
          {t('替换')}
        </button>
      )}
      {data.videoUrl && (
        /* ══ §95b 工具栏的**壳级出现门** —— 与图像卡**同一逻辑**（用户点名的「卡的状态和逻辑
           应该和图像卡是同一逻辑」）══
           · 图像卡 `ImageNode.tsx:2126` 逐字：
               `visible={isDirectSingleSelection && !inPile && data.status !== 'loading' && …}`
             ⇒ **生成中不出工具条**。
           · 官方视频侧同义（两条独立证据）：
               ① `xXe` 的调用点 `yXe`（@1977233）逐字
                    `function yXe({nodeId:e,nodeTitle:t,isGenerating:n}){const o=xXe(e,n); …}`
                  ⇒ `xXe(e,t=!1)` 的第二参 **`t` = `isGenerating`**，而 `xXe` 里
                  **每一颗键**的 `invisible` 都含 `t`（左组 `invisible:!k||S||t`、
                  右组 `invisible:!k||t`、`video_frame_capture` `invisible:!k||S||t`）
                  ⇒ 生成中整排被 `r3e` 的行级过滤 `g?.invisible!==!0` 整排丢掉。
               ② `PE`（@1956940）逐字 `s.jsx(rc,{nodeId:e,visible:n,isLoading:o,isDragging:r,…})`
                  —— `rc` = `NodeToolbarLayer`，`isLoading` 再挡一层。
           ⚠️ MTV 只在**壳级**挡（与图像卡同一处），不再重复逐键算 `t`：壳不可见时逐键门不可达。 */
        <NodeToolbarShell visible={selected && isSingleSelection && !inPile && data.status !== 'loading'}>
          <VideoNodeToolbar
            nodeId={id}
            /* 官方 `k = data.src`：工具栏每颗键的首要和门 */
            hasSrc={!!data.videoUrl}
            onCaptureFrame={handleCaptureFrame}
            onFullscreen={handleOpenFullscreen}
            onCopyFile={handleCopyFile}
            onReversePrompt={handleReversePrompt}
            onShowPrompt={handleShowPrompt}
            onDownload={handleDownload}
            isDownloading={isDownloading}
            onUpscale={handleUpscale}
            isUpscaling={isUpscaling}
            isReversingPrompt={isReversingPrompt}
          />
        </NodeToolbarShell>
      )}
      <div
        className={`node video-node ${selected ? 'selected' : ''} ${data.status === 'loading' || isUploading ? 'loading' : ''} ${justCompleted ? 'just-completed' : ''}`}
        style={{ height: nodeHeight }}
      >
        <div
          className={`node-preview compact${data.videoUrl || data.thumbnailUrl ? ' has-media' : ''}`}
          onMouseEnter={() => { setIsPlayerHovered(true); handlePreviewMouseEnter(); }}
          onMouseLeave={() => { setIsPlayerHovered(false); handlePreviewMouseLeave(); }}
        >
          {shouldMountPlayer ? (
            <video
              ref={videoRef}
              src={data.videoUrl}
              className={`video-preview-player compact ${OFFICIAL_VIDEO_ELEMENT_CLASS}`}
              crossOrigin="anonymous"
              playsInline
              preload="auto"
              muted={globalMuted}
              data-testid={VIDEO_CONTENT_TESTID}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => { dismissInitialCover(); setPlayingSource(source ?? null); }}
              onPause={() => { setPlayingSource(null); setActivatedSource(null); }}
              onEnded={() => { setPlayingSource(null); setActivatedSource(null); }}
              /* 官方 `Goe` 的 `onError={F}`（`O0` 传 `onError={I}` ⇒ 置 `hasError`）：
                 媒体加载失败是操作行门 `O = !hasError && …` 的**唯一**生产者。 */
              onError={() => setVideoLoadFailure({ src: data.videoUrl, failed: true })}
              data-source-url={data.sourceUrl}
            />
          ) : shouldMountPlayer ? null : hoverPreviewRequested && source ? (
            /* 官方 `XJe` 的 hover 预览层（180ms 意图 + 100ms 交叉淡入；`motion-reduce` 关闭过渡）。 */
            <video
              ref={hoverPreviewVideoRef}
              src={source}
              muted
              loop
              playsInline
              preload="auto"
              aria-label={String(data.label || data.title || '')}
              className="pointer-events-none absolute inset-0 size-full object-contain transition-opacity ease-out motion-reduce:transition-none"
              style={{ opacity: hoverPreviewVisible ? 1 : 0, transitionDuration: `${VIDEO_CROSSFADE_MS}ms` }}
              onLoadedData={handlePreviewLoadedData}
              onTransitionEnd={handlePreviewTransitionEnd}
            />
          ) : data.videoUrl && initialCoverUrl ? (
            /* 官方 `VideoPoster`（`$oe`）：播放器**未挂载**时它就是卡片封面。
               官方此处 `hidden = !j`，而 `j = !b || !k || x || o` —— 走到本支本身就意味着
               `!shouldMountPlayer` ⇒ `!k` ⇒ `j` 为真 ⇒ `hidden` 为 `false`（⇒ `opacity-100`）。 */
            <img key={posterKey} {...posterProps} />
          ) : data.videoUrl ? (
            /* ══ §93 已按官方**删除** MTV 自绘的「相机占位」 ══
               [用户裁决三-2 / 五] 原 MTV 分支（`node-preview-placeholder` + 自绘
               `<polygon points="23 7 16 12 23 17 23 7"/>` + `<rect x=1 y=5 width=15 height=14 rx=2/>`）
               在官方 4 个产物里 **0 命中**（自造），官方 `O0`（`VideoRender` @1962079）里**没有**任何
               「相机形状占位图」：`f=wo(e)` 为空即 `return null`，有 src 时只渲染
               `$oe`（海报 `video-poster`）+ `Goe`（`<video>`）+ 错误浮层。
               ⇒ 本支现在渲染 **`null`**（= 官方的「不渲染」），**不保留任何自绘 svg**。 */
            null
          ) : data.thumbnailUrl ? (
            /* 「只有缩略图、没有 `videoUrl`」的卡 —— MTV 独有状态（官方 `O0` 在 `wo(src)` 为空时
               `return null`，**没有**这条分支）。**保留能力，但 DOM 全部换成官方海报的逐字输出**：
               🚫 删掉 MTV 自造件 `className="video-node-poster"`（官方 JS+CSS 全套 **0 命中**）
                  + 自造 `alt="Video thumbnail"`（官方 `$oe` 的 `alt` 是**空串** `alt:""`；
                  产物里唯一那句 `alt:"Video thumbnail"` 在 @2092474，属于**视频增强表单**里的
                  36×36 小图，**不是**卡片海报）。
               ⇒ 这里直接复用官方 `$oe` 的 props（同 class / 同 `data-testid="video-poster"` /
                 同 `alt=""` / 同 `decoding="async"` / 同重试阶梯），只把 `src` 指到 `thumbnailUrl`。 */
            <img key={posterKey} {...posterProps} src={data.thumbnailUrl} />
          ) : isUploading ? (
            /* ══ §95b 上传中的卡体 —— 按官方**变体分派**逐字 ══
               官方 `cse`（GenerateVideoNode @2076580，无 `src` 时的卡体）：
                 `s.jsx(EF,{isUploading:x})`  ⇒ `EF` 的 `isUploading` 分支逐字（@1956117）：
                 `s.jsx("div",{className:"absolute inset-0 bg-secondary z-10 animate-pulse w-full h-full"})`
               官方 `dse`（UploadVideoNode @2081160）逐字（**底色不同**）：
                 `f && s.jsx("div",{className:"absolute inset-0 bg-background/50 z-10 animate-pulse w-full h-full"})`
                 （同段还有 `titleIcon:s.jsx(es,{opacity:1})`。）

               🚫 已删除 MTV 自造件：`.node-preview-loading` + `<div className="spinner large"/>`
                  + 文案「上传中...」。官方 JS（8 个）+ 官方 CSS（12 个）全套里
                  `node-preview-loading` / `spinner large` **均 0 命中**；「上传中」只出现在
                  官方别的表面（`index-BDGj8rGN.js` 的语言块），**不是**视频卡的上传态。 */
            <div
              className={isGenerateVariant
                ? 'absolute inset-0 bg-secondary z-10 animate-pulse w-full h-full'
                : 'absolute inset-0 bg-background/50 z-10 animate-pulse w-full h-full'}
            />
          ) : data.status === 'loading' ? (
            /* §96 生成态**不带任何文案**（官方无对应物）：
               官方生成态覆盖层 `Kp`（= node-loading，`vendor-pkg-canvas-CvbAwZyy.js` @1045343）
               返回的 JSX 里**只有** backdrop / 媒体模糊 / `node-loading-shadow-layer` / 点阵
               `node-loading-grid-stars` / 扫光 `node-loading-grid-sweep` / `node-loading-sweep-glow` /
               `node-loading-burst` / `node-loading-dither` —— **一个文本节点都没有**。
               本仓实测：`生成视频中`（MTV 那句的逐字）在官方 9 个 JS + 14 个 CSS 产物里 **0 命中**
               （注意区分：`生成视频` 这四个字作为**长句片段**在官方语言块里有 20 处，例如
                `video.generateVideoFromImage:"根据图片生成视频"`，但**没有**任何一处是
                「节点生成态」的 UI 文案）。
               ⇒ MTV 自造的 `生成视频中...` 按规矩删除：不再传文案（留空），
                 `NodeGenerationProgress` 已改成「标签为空 ⇒ 不渲染那个 span」。
                 文案键 `生成视频中...` 本身留在 i18n 里成为**死键**（i18n 文件不在本轮白名单，未删）。 */
            <NodeGenerationProgress nodeId={id} fallbackLabel="" />
          ) : (
            /* ═══ 无 `src` 时的卡体 —— 按 §93 官方变体分派 ═══
               官方 `cse`（GENERATE，@2076580）逐字：
                 `y ? s.jsx(O0,{src:G,…}) : s.jsx(EF,{isUploading:x})`   // y = `data.src`
               官方 `dse`（UPLOAD，@2081160）逐字：
                 `… children:[f&&<div className="absolute inset-0 bg-background/50 z-10 animate-pulse w-full h-full"/>,
                              s.jsx(O0,{src:d,nodeId:e,selected:t}),
                              !c&&s.jsx(TE,{…}), …]`
                 ⇒ **UPLOAD 体没有空态件**：`O0` 在 `wo(src)` 为空时 `return null`
                   ⇒ 空上传卡的卡体就是**空白**（这正是官方行为，不是缺件）。
               ⇒ 本支：
                 · GENERATE → 官方 `EF`（`NoVideoHelper` @1956117）逐字空态
                   ```js
                   EF = a.memo(({isUploading:e}) => e
                     ? s.jsx("div",{className:"absolute inset-0 bg-secondary z-10 animate-pulse w-full h-full"})
                     : s.jsx("div",{className:"w-full h-full flex items-center justify-center",
                                    children:s.jsx(es,{})}));
                   ```
                   图标 `es` = `vendor-packages-DRvCmDjR.js` 局部名 `T6`（导出表
                   `IconNodeVideo:T6` @512962；定义 @319667 `T6=({size=48,opacity=.2})`）
                   —— MTV 的 `MentionIconVideo` 是它的逐字内联 ✓
                 · UPLOAD → `null`（官方同结果）
               🚫 **已删除** MTV 自绘的「上传箭头」按钮（`isSource` 分支：自绘
                  `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>` +
                  `<polyline points="17 8 12 3 7 8"/>` + `<line x1="12" y1="3" x2="12" y2="15"/>`）
                  —— 官方产物 0 命中（用户裁决三-3 / 五）。上传能力由 **UPLOAD 体自带的
                  `TE`（`UploadButton`，@1673867，`canvas.replace`=「替换」）** 承担。 */
            isGenerateVariant ? (
              <div className="w-full h-full flex items-center justify-center">
                <MentionIconVideo />
              </div>
            ) : null
          )}
          {(data.videoUrl || data.thumbnailUrl) && data.status === 'loading' && (
            <NodeGenerationProgress nodeId={id} fallbackLabel="" overlay />
          )}
          {/* ══ 官方 `VideoPlayer`（`Goe`）左上角操作区 —— **逐字** ══
              证据：`vendor-pkg-canvas-CvbAwZyy.js`，`Goe` body @1958433 起 2483 字符，
                    操作区在 body 偏移 1600 邻域。

              官方逐字：
              ```js
              O = !e && !o && !n;                          // e=hasError o=isGenerating n=isGalleryOpen
              U = r || h || i || t;                        // r=isHovered h=selected i=isInClipMode t=isFavorited
              O && s.jsxs("div", {
                className: z("absolute top-3 left-3 z-20 flex items-center gap-1 nodrag transition-opacity duration-150",
                             U ? "opacity-100" : "opacity-0 pointer-events-none"),
                children: [
                  s.jsx("button", { type:"button",
                    className: "h-7 w-7 rounded-[10px] bg-black/50 text-[#F5F5F5] hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors",
                    onClick: B => { B.stopPropagation(), N() },
                    children: C ? s.jsx(hR,{size:16}) : s.jsx(gR,{size:16}) }),   // C=isMuted
                  p && s.jsx("button", { type:"button",
                    className: z("h-7 w-7 rounded-[10px] bg-black/50 hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors",
                                 t ? "text-[#FBBC05]" : "text-[#F5F5F5]"),
                    onClick: B => { B.stopPropagation(), p(c) },               // p=onFavorite c=favoriteSource
                    onPointerDown: B => B.stopPropagation(),
                    children: t ? s.jsx(ql,{size:16}) : s.jsx(pu,{size:16}) }), // ql=Tabler star-filled, pu=Tabler star
                ],
              })
              ```

              门对齐（逐个因子见上方因子块）：
                `O` ⇒ `officialActionRowGate`  ·  `U` ⇒ `officialActionRowVisible`
              外壳 `hasCardMedia` = 官方 `O0` 的 `if (!f) return null`（无媒体就没有这张卡）。
              ⚠️ 本组件是 `memo` 的**自由函数**（非 hook），官方 `hR`/`gR` 是 Tabler
                 `volume-off`/`volume-2`（`vendor-libs-BqrVOBEZ.js`：`cNn=p("outline","volume-off",…)`、
                 `sNn=p("outline","volume-2",…)`），MTV 既有的静音键用的是 MDI 图标 ——
                 **本轮不改静音键图标**（不在任务范围内），差异已记账。 */}
          {hasCardMedia && officialActionRowGate && (
            <div
              className={`absolute top-3 left-3 z-20 flex items-center gap-1 nodrag transition-opacity duration-150 ${
                officialActionRowVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <button
                type="button"
                className="h-7 w-7 rounded-[10px] bg-black/50 text-[#F5F5F5] hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors"
                aria-label={globalMuted ? t('取消静音') : t('静音')}
                onClick={(event) => {
                  event.stopPropagation();
                  const video = videoRef.current;
                  if (video) video.muted = !video.muted;
                  toggleGlobalMuted();
                }}
              >
                <Icon
                  icon={globalMuted ? 'mdi:volume-off' : 'mdi:volume-high'}
                  width={16}
                  height={16}
                />
              </button>
              {/* 官方第二颗键（收藏）：`p && <button …>` —— MTV 的 `p`（onFavorite）只在
                  `favoriteTargetOf`(=`g8`) 解析出资产时才存在；解析不到 ⇒ 与官方
                  `oQe` 的 `if(!o) return null` **同结果**：这颗键不渲染。 */}
              {favoriteTarget && (
                <button
                  type="button"
                  className={`h-7 w-7 rounded-[10px] bg-black/50 hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors ${
                    isFavorited ? 'text-[#FBBC05]' : 'text-[#F5F5F5]'
                  }`}
                  /* ⚠️ MTV 附加（官方这颗键没有 aria-label；与同一排静音键的既有 a11y 约定一致） */
                  aria-label={isFavorited ? t('取消收藏') : t('收藏')}
                  aria-pressed={isFavorited}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleFavorite();
                  }}
                  /* 官方有这一手（`onPointerDown: B => B.stopPropagation()`），必须保留：
                     掐断 pointerdown，避免 React Flow 在 pointerdown 阶段选中/拖动节点。 */
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {/* 官方 `ql` = Tabler `star-filled`（16） / `pu` = Tabler `star`（16） */}
                  {isFavorited
                    ? <OfficialStarFilledIcon size={16} />
                    : <OfficialStarIcon size={16} />}
                </button>
              )}
            </div>
          )}
          {/* ══ 官方 `VideoRender`（`O0`）的「海报上的收藏指示」（只在播放器没挂载时出现）—— **逐字** ══
              官方 `L = !k && !!p && u && !o && !S`（`k`=播放器挂载门 · `p`=onFavorite ·
              `u`=isFavorited · `o`=isGenerating · `S`=isGalleryOpen），渲染：
              ```js
              L && s.jsx("button", { type:"button",
                className: "absolute top-3 left-3 z-20 h-7 w-7 rounded-[10px] bg-black/50 text-[#FBBC05] hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors nodrag",
                onClick: R => { R.stopPropagation(), p(e) },
                onPointerDown: R => R.stopPropagation(),
                children: s.jsx(ql,{size:16}) })
              ``` */}
          {showPosterFavoriteIndicator && (
            <button
              type="button"
              className="absolute top-3 left-3 z-20 h-7 w-7 rounded-[10px] bg-black/50 text-[#FBBC05] hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors nodrag"
              /* ⚠️ MTV 附加（官方这颗键没有 aria-label，见上一条同款说明） */
              aria-label={t('取消收藏')}
              aria-pressed
              onClick={(event) => {
                event.stopPropagation();
                handleToggleFavorite();
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <OfficialStarFilledIcon size={16} />
            </button>
          )}
          {/* ══ 官方 `VideoPoster`（`$oe`）盖在**已挂载**播放器上的那层封面 ══
              官方 `O0`：`C && s.jsx($oe,{src:f,nodeId:r,hidden:!j},f)` —— 与上面那处是**同一个**
              `$oe`，靠 `hidden` 切换而不是换组件。官方此处 `hidden = !j`，而 MTV 走到本支时
              `showInitialCover` 为真（封面尚未撤销）⇒ 官方 `b`（isPlayerMounted）为假 ⇒ `j` 为真
              ⇒ `hidden` 为 `false`（⇒ `opacity-100`）。 */}
          {shouldMountPlayer && showInitialCover && (
            <img key={posterKey} {...posterProps} />
          )}
          {data.videoUrl && !isFullscreen && (
            <VideoNodeControls
              videoRef={videoRef}
              source={data.videoUrl}
              onInteract={dismissInitialCover}
              /* ⚠️ MTV 自有机制（**不是**官方因子）：官方 `m5` 没有 `active` 这个 prop，
                 MTV 用它承载「播放器是否已挂载」的 LOD 门。 */
              active={shouldMountPlayer}
              /* 官方 `Goe` 调 `m5` 的逐字入参：`isHovering: r || h || i`
                 （`r`=isHovered · `h`=selected · `i`=isInClipMode）。
                 🚨 这里**不再**把 MTV 自有的 `shouldMountPlayer` 当官方因子塞进来（旧值是
                 `isPlayerHovered || shouldMountPlayer`，其中 `shouldMountPlayer` 无官方对应）。 */
              isHovering={isPlayerHovered || !!selected || isInClipMode}
              muted={globalMuted}
              onToggleMute={toggleGlobalMuted}
              /* 官方 `$T`：`nodeId` 存在才渲染全屏键；MTV 全屏入口是卡片工具栏那颗（同义） */
              showFullscreen
              onFullscreen={handleOpenFullscreen}
              durationHint={generatedCover && generatedCover.source === source ? generatedCover.duration
                : typeof data.videoDuration === 'number' ? data.videoDuration : 0}
              onRequestPlayback={requestPlayback}
              /* 官方 `m5` 的 `isVirtualMode` / `trimStart` / `trimEnd` / `hideProgressBar`：
                 MTV **没有调用点** ⇒ 一律不传，`VideoNodeControls` 的缺省值
                 （`isVirtualMode=false` / `trimStart=0` / `trimEnd=0` / `hideProgressBar=false`）
                 与官方 `m5` 的缺省逐字一致（`isVirtualMode=!1,trimStart=0,trimEnd=0,hideProgressBar=!1`）。 */
            />
          )}
        </div>
        {data.error && <NodeError nodeId={id} message={data.error} />}
        <Handle type="source" position={Position.Left} id="left" className="node-handle handle-source handle-video" >
          <GooeyBtn className="gooey-btn-left" hue={217} />
        </Handle>
        <Handle type="source" position={Position.Right} id="right" className="node-handle handle-source handle-video" >
          <GooeyBtn className="gooey-btn-right" hue={217} />
        </Handle>
      </div>

      
      {/* 官方媒体查看器（视频分支）：结构/几何/动效/侧栏见 shared/media/MediaViewer.tsx；
          视频本体仍由本节点的 `<video ref={setFullscreenVideoElement}>` 承担（播放交接 + 内存守卫机件不变），
          经 `mediaContent` 放进官方媒体列 ✓ */}
      <MediaViewer
        isOpen={isFullscreen && !!(data.videoUrl || data.thumbnailUrl)}
        mediaType="video"
        entrySrc={(data.videoUrl as string | undefined) ?? (data.thumbnailUrl as string | undefined) ?? ''}
        versions={nodeMediaVersions}
        activeSrc={viewerSrc ?? (data.videoUrl as string | undefined) ?? undefined}
        prompt={viewerPrompt}
        model={viewerVersion?.model || (data.model as string | undefined)}
        width={data.videoWidth as number | undefined}
        height={data.videoHeight as number | undefined}
        createdAt={viewerVersion?.createdAt}
        durationSeconds={data.videoDuration as number | undefined}
        onSelectVersion={setViewerSrc}
        onClose={handleCloseFullscreen}
        mediaContent={data.videoUrl ? (
          <video
            ref={setFullscreenVideoElement}
            src={(viewerSrc ?? data.videoUrl) as string}
            className="media-viewer__media"
            controls
            autoPlay
            playsInline
            crossOrigin="anonymous"
            data-source-url={data.sourceUrl}
            onLoadedMetadata={handleFullscreenLoadedMetadata}
          />
        ) : (
          <img
            src={data.thumbnailUrl as string}
            alt="Video thumbnail"
            className="media-viewer__media"
          />
        )}
        actions={(
          <MediaViewerActions
            prompt={viewerPrompt}
            mediaType="video"
            canSetAsMain={!!viewerSrc}
            isCurrentMain={viewerShowsCurrentMain}
            onCopyPrompt={handleViewerCopyPrompt}
            onSetAsMain={handleViewerSetAsMain}
            onDownload={() => { void handleViewerDownload(); }}
            downloading={viewerDownloading}
          />
        )}
      />
    </div>
  );
}

export default memo(AIVideoNode);
