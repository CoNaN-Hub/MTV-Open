/**
 * PileMemberPreview —— 官方 **PILE 成员预览** `TT`（`h.memo(YZe)` @2937830）的移植。
 *
 * 官方出处：`zoom-slider-3ZcFvYQO.js` @char2937010（`YZe`）/ @char2936227（`qZe`）
 * / @char2936061（`zZe` 图）/ @char2936392（`GZe` 文本）/ @char2936540（`HZe` 未知类型）
 * / @char2936556（`$Ze` 视频）。完整抽取见 `D:\DEEPSEEK\official-pile-spec.md` §5.5。
 *
 * 官方结构（类名**逐字**）：
 * ```jsx
 * // YZe —— 外层
 * <div className="group/display-node relative size-full overflow-hidden rounded-xl">
 *   {qZe(content, previewEnabled, actions)}
 *   {status.kind==="loading" && (
 *     <div className="absolute inset-0 overflow-hidden rounded-xl bg-black/35">
 *       <span className="sr-only">{t("common.loading")}</span>
 *       <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/20
 *                       to-transparent motion-safe:animate-[pile-shimmer_1.4s_cubic-bezier(0.25,1,0.5,1)_infinite]"/>
 *     </div>)}
 *   {status.kind==="error" && <…/>}
 *   <span className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border border-white/10"/>
 * </div>
 *
 * // zZe —— 图：无 src / 加载失败 ⇒ 占位；否则 <img className="size-full object-contain" loading="lazy" decoding="async">
 * // GZe —— 文本：<div className="pointer-events-none size-full overflow-hidden bg-card text-card-foreground"
 * //                    style={{backgroundColor}}>
 * //                 <div className="origin-top-left bg-card p-3 px-4" style={{width,height,backgroundColor,zoom}}>
 * // 占位（图/视频/音频/未知）：<div className="flex size-full items-center justify-center bg-card text-muted-foreground/55">
 * // qZe —— 按 content.type 分派：image | video | audio | text | unsupported
 * ```
 *
 * ⚠️ 未逐字移植的几处（与官方**能力**有关，不是偷懒）：
 *  1. `hs(url, variant)` 是官方 **CDN 尺寸变体**（`Pn.SMALL` / `Pn.THUMBNAIL_V2`）；
 *     MTV 的媒体是本地文件 / 直链，没有这套服务 ⇒ 直接用原 URL（内容映射在
 *     `utils/officialPilePreviewContent.ts`）。
 *  2. 视频 hover 起播（`$Ze`：悬停 180ms 后起播 + 100ms 交叉淡入 + 静音切换）本轮未做，
 *     只落静态首帧（类名与官方同名）。
 *  3. `Rb(data, "Image")` 是官方 i18n 标题；MTV 用节点自己的 `label` 兜底。
 */
import { Children, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { useT } from '../../i18n';
import { PILE_RENDER_CLASSES } from '../../utils/officialPile';

/** 官方 `ms.gallery.mediaPreview`（`zoom-slider-3ZcFvYQO.js` 常量表逐字） */
const VIDEO_HOVER_INTENT_MS = 180;
const VIDEO_CROSSFADE_MS = 100;

/** 官方 `OYe` 返回的 `content`（只保留预览用到的字段） */
export type PilePreviewContent =
  | { type: 'image'; title: string; displaySrc: string; fallbackSrc?: string }
  | { type: 'video'; title: string; thumbnailSrc: string; playbackSrc: string }
  | { type: 'audio'; title: string; src: string }
  | {
      type: 'text';
      title: string;
      markdown: string;
      backgroundColor?: string;
      renderSize: { width: number; height: number };
      displayScale: number;
    }
  | { type: 'unsupported'; title: string };

export interface PilePreviewStatus {
  kind: 'loading' | 'ready';
}

/** 官方占位图标（Tabler `photo` / `movie` / `music` / `alert-circle`，28px） */
function PlaceholderIcon({ kind }: { kind: 'image' | 'video' | 'audio' | 'unsupported' }) {
  return (
    <span className="text-muted-foreground/55" aria-hidden>
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === 'video' ? (
          <>
            <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
            <path d="M8 4l0 16" />
            <path d="M16 4l0 16" />
            <path d="M4 8l4 0" />
            <path d="M4 16l4 0" />
            <path d="M4 12l16 0" />
            <path d="M16 8l4 0" />
            <path d="M16 16l4 0" />
          </>
        ) : kind === 'audio' ? (
          <>
            <path d="M6 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
            <path d="M9 17v-13h10v13" />
            <path d="M9 8h10" />
          </>
        ) : kind === 'unsupported' ? (
          <>
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" />
          </>
        ) : (
          <>
            <path d="M15 8h.01" />
            <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" />
            <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
            <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
          </>
        )}
      </svg>
    </span>
  );
}

function CenteredPlaceholder({ kind }: { kind: 'image' | 'video' | 'audio' | 'unsupported' }) {
  return (
    <div className="flex size-full items-center justify-center bg-card text-muted-foreground/55">
      <PlaceholderIcon kind={kind} />
    </div>
  );
}

/** 官方 `PG` @2932192 —— `function PG(e){e.stopPropagation()}` */
function officialStopPropagation(event: SyntheticEvent): void {
  event.stopPropagation();
}

/**
 * 官方 `pJ` @2932627 —— 预览上的**操作行**（`zZe` 图 / `$Ze` 视频都用它包 `actions`）：
 * ```js
 * function pJ({children:e}){ return h.Children.toArray(e).length===0 ? null :
 *   l.jsx("div",{className:"nodrag nopan pointer-events-none absolute left-3 top-3 z-30 flex gap-1
 *     opacity-0 group-hover/display-node:pointer-events-auto group-hover/display-node:opacity-100
 *     group-focus-within/display-node:pointer-events-auto group-focus-within/display-node:opacity-100",
 *     onPointerDown:PG,onClick:PG,children:e}) }
 * ```
 * `group/display-node` 由根节点（官方 `YZe`）提供 —— MTV 侧是 `PILE_RENDER_CLASSES.previewRoot`。
 */
function PreviewActions({ children }: { children: ReactNode }) {
  if (Children.toArray(children).length === 0) return null;
  return (
    <div
      className={PILE_RENDER_CLASSES.previewActions}
      /* 官方 `onPointerDown:PG` / `onClick:PG` —— 操作行上的点击不许穿透成「打开媒体查看器」 */
      onPointerDown={officialStopPropagation}
      onClick={officialStopPropagation}
    >
      {children}
    </div>
  );
}

/** 官方 `zZe`（图） */
function ImagePreview({
  content,
  actions,
}: {
  content: Extract<PilePreviewContent, { type: 'image' }>;
  actions?: React.ReactNode;
}) {
  const src = content.displaySrc || content.fallbackSrc || '';
  if (!src) return <CenteredPlaceholder kind="image" />;
  return (
    <div className="relative size-full overflow-hidden bg-card">
      <img
        src={src}
        alt={content.title}
        draggable={false}
        decoding="async"
        loading="lazy"
        className="size-full object-contain"
      />
      {/* 官方 `zZe` 末位：`l.jsx(pJ,{children:s})`（`s` = `actions`） */}
      <PreviewActions>{actions}</PreviewActions>
    </div>
  );
}

/** 官方 `$Ze`（视频）—— 本轮只落静态首帧（hover 起播见文件头 ⚠️ ②） */
/**
 * 官方 `$Ze`（视频）—— **含 hover 起播**（`zoom-slider`@2936556 逐字）。
 *
 * ```js
 * const {videoHoverIntentMs:UZe=180, videoCrossfadeDurationMs:WZe=100} = ms.gallery.mediaPreview;
 * // ① 悬停 180ms「意图」后才挂 <video> 并起播（避免划过就加载）
 * // ② 挂上后先 onLoadedData 再 play；100ms opacity 交叉淡入
 * // ③ 移出：暂停 + 静音复位 + 收起；若已开始过渡则等 onTransitionEnd 再卸载
 * // ④ 静音开关（`pJ` 动作条里的按钮）
 * ```
 */
function VideoPreview({
  content,
  actions,
}: {
  content: Extract<PilePreviewContent, { type: 'video' }>;
  actions?: React.ReactNode;
}) {
  const [errored, setErrored] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intentTimer = useRef<number | null>(null);
  const wantPlay = useRef(false);
  const mutedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (intentTimer.current !== null) {
      window.clearTimeout(intentTimer.current);
      intentTimer.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.muted = true;
      await video.play();
      video.muted = mutedRef.current;
    } catch {
      /* 自动播放被拒：保持静帧，不算错误（官方同样吞掉） */
    }
  }, []);

  const handleEnter = useCallback(() => {
    if (!content.playbackSrc) return;
    wantPlay.current = true;
    clearTimer();
    intentTimer.current = window.setTimeout(() => {
      intentTimer.current = null;
      if (!wantPlay.current) return;
      if (!videoRef.current) {
        setMounted(true);
        return;
      }
      setPlaying(true);
      void start();
    }, VIDEO_HOVER_INTENT_MS);
  }, [content.playbackSrc, clearTimer, start]);

  const handleLeave = useCallback(() => {
    wantPlay.current = false;
    clearTimer();
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.muted = true;
    mutedRef.current = true;
    setPlaying(false);
    if (!playing) setMounted(false);
  }, [clearTimer, playing]);

  const handleLoadedData = useCallback(() => {
    if (!content.playbackSrc || !wantPlay.current) return;
    setPlaying(true);
    void start();
  }, [content.playbackSrc, start]);

  const handleTransitionEnd = useCallback(() => {
    if (wantPlay.current || playing) return;
    setMounted(false);
  }, [playing]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }, []);

  useEffect(() => () => { clearTimer(); videoRef.current?.pause(); }, [clearTimer]);

  const thumb = content.thumbnailSrc || content.playbackSrc;
  if (!thumb || errored) return <CenteredPlaceholder kind="video" />;
  return (
    <div className="relative size-full bg-card" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <img
        src={thumb}
        alt={content.title}
        draggable={false}
        decoding="async"
        loading="lazy"
        className="pointer-events-none size-full object-contain"
        onError={() => setErrored(true)}
      />
      {mounted && (
        <video
          ref={videoRef}
          src={content.playbackSrc}
          muted={muted}
          loop
          playsInline
          preload="auto"
          aria-label={content.title}
          className="pointer-events-none absolute inset-0 size-full object-contain transition-opacity ease-out motion-reduce:transition-none"
          style={{ opacity: playing ? 1 : 0, transitionDuration: `${VIDEO_CROSSFADE_MS}ms` }}
          onLoadedData={handleLoadedData}
          onTransitionEnd={handleTransitionEnd}
        />
      )}
      {content.playbackSrc && (
        <button
          type="button"
          aria-label={muted ? '取消静音' : '静音'}
          aria-pressed={!muted}
          onClick={toggleMute}
          className="absolute bottom-1 right-1 z-30 flex size-5 items-center justify-center rounded-full bg-black/60 text-white"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {muted ? (
              <>
                <path d="M15 8a5 5 0 0 1 0 8" />
                <path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5" />
                <path d="M17 5l-12 14" />
              </>
            ) : (
              <>
                <path d="M15 8a5 5 0 0 1 0 8" />
                <path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5" />
              </>
            )}
          </svg>
        </button>
      )}
      {/* 官方 `$Ze` 末尾：`l.jsxs(pJ,{children:[ 静音键, actions ]})`。
          ⚠️ MTV 偏离：官方把**静音键也放进这个 pJ 条**（`hJ` 样式 + Tabler volume 16px）；
             MTV 已有的静音键是另一套外观且定在右下角（`absolute bottom-1 right-1 size-5`，本文件既有记账），
             本轮**不动它**，只把新的 `actions` 落进官方 `pJ` 条 —— 与官方同一条的位置/显隐/stopPropagation。 */}
      <PreviewActions>{actions}</PreviewActions>
    </div>
  );
}

/** 官方 `BZe`（音频）的占位分支 */
function AudioPreview({ content }: { content: Extract<PilePreviewContent, { type: 'audio' }> }) {
  if (!content.src) return <CenteredPlaceholder kind="audio" />;
  return (
    <div className="relative size-full bg-card">
      <CenteredPlaceholder kind="audio" />
    </div>
  );
}

/** 官方 `GZe`（文本） */
function TextPreview({ content }: { content: Extract<PilePreviewContent, { type: 'text' }> }) {
  if (!content.markdown.trim()) {
    return (
      <div
        className="flex size-full items-center justify-center bg-card text-muted-foreground/55"
        style={{ backgroundColor: content.backgroundColor }}
      >
        <PlaceholderIcon kind="unsupported" />
      </div>
    );
  }
  return (
    <div
      className="pointer-events-none size-full overflow-hidden bg-card text-card-foreground"
      style={{ backgroundColor: content.backgroundColor }}
    >
      <div
        className="origin-top-left bg-card p-3 px-4"
        style={{
          width: content.renderSize.width,
          height: content.renderSize.height,
          backgroundColor: content.backgroundColor,
          zoom: content.displayScale,
        }}
      >
        <pre className="whitespace-pre-wrap break-words text-sm">{content.markdown}</pre>
      </div>
    </div>
  );
}

/**
 * 官方 `qZe(e,t,n)` @2936227 —— 按 `content.type` 分派；**只有 image / video 收到 `actions`**：
 * ```js
 * function qZe(e,t,n){switch(e.type){
 *   case "image": return l.jsx(VZe,{...e,actions:n});
 *   case "video": return l.jsx(KZe,{...e,previewEnabled:t,actions:n});
 *   case "audio": return l.jsx(BZe,{...e,previewEnabled:t});   // ← 无 actions
 *   case "text":  return l.jsx(GZe,{...e});                    // ← 无 actions
 *   case "unsupported": return l.jsx(HZe,{...e}) }}            // ← 无 actions
 * ```
 */
function PreviewContent({ content, actions }: { content: PilePreviewContent; actions?: React.ReactNode }) {
  switch (content.type) {
    case 'image':
      return <ImagePreview content={content} actions={actions} />;
    case 'video':
      return <VideoPreview content={content} actions={actions} />;
    case 'audio':
      return <AudioPreview content={content} />;
    case 'text':
      return <TextPreview content={content} />;
    default:
      return <CenteredPlaceholder kind="unsupported" />;
  }
}

/**
 * 官方 `YZe`（`h.memo` 后即 `TT`）@2937010 —— 逐字：
 * ```jsx
 * function YZe({content:e,rootRef:t,previewEnabled:n=!1,actions:s,status:r,errorAction:o}){
 *   const {t:i} = Fe();
 *   return l.jsxs("div",{ref:t,className:"group/display-node relative size-full overflow-hidden rounded-xl",
 *     children:[ qZe(e,n,s),                       // ← actions 从这里进
 *       r.kind==="loading" && …, r.kind==="error" && …, <span className="…border border-white/10"/> ]})}
 * ```
 * `actions` = 官方画廊成员 `lQe` 里 `j ? l.jsx(oQe,{node:e.node}) : void 0` 传下来的
 * **收藏按钮**（`j = actionsEnabled && (IMAGE|VIDEO) && status.kind==="ready"`）。
 * ⚠️ MTV 偏离：`rootRef` / `previewEnabled` / `errorAction` 三个形参仍未接
 *    （`rootRef` 在 MTV 由 `PileGalleryItem` 自己的 ref 承担；`errorAction` 对应 MTV 不存在的
 *     `status.kind==="error"` 档，见本文件头 ⚠️①）；本轮只补 `actions` 这一个插槽。
 */
export default function PileMemberPreview({
  content,
  status = { kind: 'ready' },
  actions,
}: {
  content: PilePreviewContent;
  status?: PilePreviewStatus;
  /** 官方 `YZe` 的 `actions`：落在 `qZe` 的 image/video 分支里（`pJ` 操作行） */
  actions?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className={PILE_RENDER_CLASSES.previewRoot}>
      <PreviewContent content={content} actions={actions} />
      {status.kind === 'loading' && (
        <div className={PILE_RENDER_CLASSES.previewLoadingShade}>
          <span className="sr-only">{t('加载中...')}</span>
          <div className={PILE_RENDER_CLASSES.previewShimmer} />
        </div>
      )}
      <span aria-hidden className={PILE_RENDER_CLASSES.previewBorder} />
    </div>
  );
}
