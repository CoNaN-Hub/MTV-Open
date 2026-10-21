/**
 * VideoNodeControls —— 视频卡底部的**播放/悬停控制条**。
 *
 * ══ 官方对应物：`$T` / `VideoHoverControls` ══
 * 桌面版 0.4.99 提取包 `course-api-base-url-DmmB7bTf.js:24849-24949`（md 记账）
 * 本文件的 class 全部逐字取自 **web 产物**（与桌面版同构，桌面版原文见
 * `components/02-video-card-player-hover.js:203` 的 `$T` 调用签名）：
 *   `D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`
 *   · 容器      @983799-983806
 *   · 播放/暂停 @984197-984204
 *   · 时间显示  @984476-984590
 *   · 进度条    @980260（`FOe`，range input 的全部 arbitrary variant 逐字）
 *   · 全屏键    @985419（`data-testid=…FULLSCREEN_BTN`）
 *
 * ══ 刻意保留的官方参数语义 ══
 * `hideProgressBar`（官方 clip/virtual 模式传 `true`）与 `virtual mode`（`isVirtualMode`
 * + `trimStart/trimEnd` 时间映射）在原实现里成对使用；MTV 当前没有 clip 模式调用点，
 * 但保留这两个 prop 以免再次引入时丢掉官方语义。
 */
import { memo, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Icon } from '@iconify/react';
import { useT } from '../../../i18n';
import { VIDEO_FULLSCREEN_BTN_TESTID } from './video/officialVideoTestIds';

interface VideoNodeControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  source?: string;
  onInteract?: () => void;
  active?: boolean;
  durationHint?: number;
  onRequestPlayback?: () => void;
  /** 官方 `isHovering`（`r||t||o`：hover / 选中 / clip 模式） */
  isHovering?: boolean;
  /** 官方 `isVirtualMode`：UI 时间映射回原视频 trim 区间 */
  isVirtualMode?: boolean;
  trimStart?: number;
  trimEnd?: number;
  /** 官方 `hideProgressBar`（clip 模式下不显示进度条） */
  hideProgressBar?: boolean;
  /** 官方 `trailingSlot`（进度条与全屏键之间的额外插槽） */
  trailingSlot?: React.ReactNode;
  /** 全局静音（官方 `aU` store；由调用方持有状态） */
  muted?: boolean;
  onToggleMute?: () => void;
  /** 官方 `nodeId` 存在时才渲染全屏键 */
  showFullscreen?: boolean;
  onFullscreen?: () => void;
}

/** 官方时间格式：`m:ss`（>1h 时 `h:mm:ss`）——与官方 `fee/bOe` 的取整一致（截断到秒） */
function formatMediaTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** 官方进度条（`FOe`）的全部样式 —— 逐字（含 arbitrary variants 与换行折叠） */
const OFFICIAL_RANGE_CLASS = 'relative w-full h-4 bg-transparent cursor-pointer appearance-none z-10 '
  + '[&::-webkit-slider-track]:h-1 [&::-webkit-slider-track]:bg-transparent [&::-webkit-slider-track]:rounded-full '
  + '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 '
  + '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg '
  + '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 '
  + '[&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:rounded-full '
  + '[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white '
  + '[&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer '
  + '[&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:hover:scale-110';

/** 官方「ghost / size=sm / h-6 w-6」图标按钮（播放、静音、全屏共用） */
const OFFICIAL_GHOST_BUTTON_CLASS =
  'h-6 w-6 p-0 text-white hover:text-white/80 shrink-0 pointer-events-auto transition-colors '
  + 'inline-flex items-center justify-center rounded-md bg-transparent cursor-pointer';

function VideoNodeControls({
  videoRef,
  source,
  onInteract,
  active = true,
  durationHint = 0,
  onRequestPlayback,
  isHovering = false,
  isVirtualMode = false,
  trimStart = 0,
  trimEnd = 0,
  hideProgressBar = false,
  trailingSlot,
  muted: mutedProp,
  onToggleMute,
  showFullscreen = false,
  onFullscreen,
}: VideoNodeControlsProps) {
  const t = useT();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  /** 官方 `N = useRef(!1)`：拖动进度时暂停 `timeupdate` 回写 */
  const draggingRef = useRef(false);

  /* 官方 virtual 模式：UI 时间 = 原视频时间 − trimStart */
  const trimRange = isVirtualMode && trimEnd > trimStart ? trimEnd - trimStart : 0;
  const toUiTime = useCallback(
    (raw: number) => (isVirtualMode && trimStart !== undefined ? Math.max(0, raw - trimStart) : raw),
    [isVirtualMode, trimStart],
  );
  const fromUiTime = useCallback(
    (ui: number) => (isVirtualMode && trimStart !== undefined ? trimStart + ui : ui),
    [isVirtualMode, trimStart],
  );

  const syncState = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsPlaying(!video.paused);
    setCurrentTime(toUiTime(video.currentTime));
    if (trimRange > 0) {
      setDuration(trimRange);
      return;
    }
    const rawDuration = video.duration;
    if (Number.isFinite(rawDuration) && rawDuration > 0) setDuration(rawDuration);
  }, [trimRange, toUiTime, videoRef]);

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => { setIsPlaying(true); };
    const onPause = () => { setIsPlaying(false); };
    const onTimeUpdate = () => { if (!draggingRef.current) setCurrentTime(toUiTime(video.currentTime)); };
    const onLoadedMetadata = () => syncState();
    syncState();
    setMuted(video.muted);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [active, source, syncState, toUiTime, videoRef]);

  const togglePlayback = useCallback(() => {
    if (!active) { onRequestPlayback?.(); return; }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {});
      return;
    }
    video.pause();
  }, [active, onRequestPlayback, videoRef]);

  const handleSeek = useCallback((value: number) => {
    setCurrentTime(value);
    const video = videoRef.current;
    if (!video || !Number.isFinite(value)) return;
    video.currentTime = fromUiTime(value);
  }, [fromUiTime, videoRef]);

  const handleDragStart = useCallback(() => {
    draggingRef.current = true;
    setIsDraggingProgress(true);
    const video = videoRef.current;
    if (video && !video.paused) video.pause();
  }, [videoRef]);

  const handleDragEnd = useCallback(() => {
    draggingRef.current = false;
    setIsDraggingProgress(false);
  }, []);

  const effectiveMuted = mutedProp ?? muted;
  const toggleMuted = useCallback(() => {
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
    setMuted((current) => (video ? video.muted : !current));
    onToggleMute?.();
  }, [onToggleMute, videoRef]);

  const displayedDuration = active ? duration : durationHint;
  const displayedTime = isDraggingProgress ? currentTime : active ? currentTime : 0;
  const progress = displayedDuration > 0 ? Math.min(100, (displayedTime / displayedDuration) * 100) : 0;

  return (
    /* 官方容器（@983799-983806 逐字）：
       `absolute bottom-0 left-0 right-0 z-20 nodrag rounded-b-2xl`
       `bg-gradient-to-t from-black/45 via-black/20 to-transparent px-2 pb-2.5 pt-8`
       `flex items-center gap-2 transition-all duration-200 ease-out`
       + `opacity-100 translate-y-0` / `opacity-0 translate-y-1 pointer-events-none` */
    <div
      className={`nodrag absolute bottom-0 left-0 right-0 z-20 rounded-b-2xl bg-gradient-to-t from-black/45 via-black/20 to-transparent px-2 pb-2.5 pt-8 flex items-center gap-2 transition-all duration-200 ease-out ${
        isHovering ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'
      }`}
      data-hide-progress-bar={hideProgressBar ? 'true' : undefined}
      role="group"
      aria-label={t('视频播放控制')}
      onPointerDown={(event) => { event.stopPropagation(); onInteract?.(); }}
      onClick={(event) => event.stopPropagation()}
      onMouseEnter={() => {}}
      onMouseLeave={() => {}}
    >
      <button
        type="button"
        className={OFFICIAL_GHOST_BUTTON_CLASS}
        aria-label={isPlaying ? t('暂停视频') : t('播放视频')}
        onClick={(event) => { event.stopPropagation(); togglePlayback(); }}
      >
        <Icon icon={isPlaying ? 'mdi:pause' : 'mdi:play'} width={16} height={16} />
      </button>

      <span className="text-[14px] text-white/90 tabular-nums shrink-0 leading-none">
        {formatMediaTime(displayedTime)}
        <span className="mx-1 text-white/40">/</span>
        <span className="text-white/40">{displayedDuration > 0 ? formatMediaTime(displayedDuration) : '--'}</span>
      </span>

      {!hideProgressBar && (
        <div className="flex-1 pointer-events-auto flex items-center transition-opacity duration-200 opacity-100">
          <div className="relative w-full flex items-center h-4">
            <div className="absolute left-0 right-0 h-1 bg-white/20 rounded-full pointer-events-none top-1/2 -translate-y-1/2">
              <div className="absolute left-0 top-0 h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(displayedDuration, 1)}
              step={0.1}
              value={Math.min(displayedTime, Math.max(displayedDuration, 1))}
              className={OFFICIAL_RANGE_CLASS}
              aria-label={t('视频进度')}
              aria-valuetext={`${formatMediaTime(displayedTime)} / ${formatMediaTime(displayedDuration)}`}
              onChange={(event) => handleSeek(Number(event.target.value))}
              onMouseDown={handleDragStart}
              onMouseUp={handleDragEnd}
              onTouchStart={handleDragStart}
              onTouchEnd={handleDragEnd}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      )}

      {trailingSlot ? <div className="shrink-0 pointer-events-auto flex items-center">{trailingSlot}</div> : null}

      <button
        type="button"
        className={OFFICIAL_GHOST_BUTTON_CLASS}
        aria-label={effectiveMuted ? t('取消静音') : t('静音')}
        disabled={!active}
        onClick={(event) => { event.stopPropagation(); toggleMuted(); }}
      >
        <Icon icon={effectiveMuted ? 'mdi:volume-off' : 'mdi:volume-high'} width={16} height={16} />
      </button>

      {/* 官方：`nodeId` 存在才渲染（`t ? <Button …/> : null`） */}
      {showFullscreen && (
        <button
          type="button"
          className={OFFICIAL_GHOST_BUTTON_CLASS}
          aria-label={t('全屏')}
          data-testid={VIDEO_FULLSCREEN_BTN_TESTID}
          onClick={(event) => { event.stopPropagation(); onFullscreen?.(); }}
        >
          <Icon icon="mdi:fullscreen" width={16} height={16} />
        </button>
      )}
    </div>
  );
}

export default memo(VideoNodeControls);
