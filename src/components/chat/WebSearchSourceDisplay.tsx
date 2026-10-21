/**
 * 官方「联网搜索来源展示」—— `page-BeI7xydN.js` 逐字复刻：
 *   `xS` @652708 = `PinnedWebSearchSources`（`data-testid="web-search-sources-pinned"`）
 *   `cS` @636566 = `WebSearchSourceDisplay`（= `<UD cards/>` + `<OD pills/>`）
 *   `UD` @631319 = `WebSearchSourceCardList`（横向拖拽滚动 + 两端 mask）
 *   `FD` @…     = `WebSearchSourceCard`
 *   `OD` @628162 = `WebSearchSourcePillList`
 *   `LD` @…     = `WebSearchSourcePill`
 *   工具函数：`ax`（标题→展示名）· `If`（favicon）· `PD`（域名）· `aS`（打开外链）· `Uoe=4`（pill 上限）
 *
 * 取值函数逐字：
 *   `PD(url)`  = hostname 去掉 `www.`
 *   `If(src)`  = `src.favicon ?? https://www.google.com/s2/favicons?domain=<hostname>&sz=64`
 *   `ax(src)`  = 取 `Foe(title)`；结果非空且通过 `Ooe` 校验就用它，否则回落 `PD(url)`
 *   `Foe(t)`   = 按「管道/下划线/中点 分隔」或「空格-破折号-空格 分隔」切成多段；>1 段时取最后一段；
 *                若该段匹配 `-([\u4e00-\u9fff][^\s\-|｜_·]{1,11})$` 则取捕获组，否则（多段时）用该段，单段则空
 *   `Ooe(s)`   = `!(len<2 || len>24 || /https?:|www\./i || /^[\d\s.,:/-]+$/)`
 *
 * ✅ pill 内层 chip 已**反解并逐字落地**：`hs` ⇐ `use-chat-attachment-file-input-*.js` 的 `we`
 *    （`const we = memo(…); we.displayName = "NodeMentionPill"`），其基类
 *    `cp = "relative inline-flex items-center justify-center align-middle gap-1 h-5 min-w-[24px]
 *          max-w-[120px] p-1 cursor-pointer transition-[filter,box-shadow,color] duration-200 ease-out"`、
 *    常态色 `dp = "text-white/60 hover:text-white/80 hover:brightness-110
 *          hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"`；
 *    缩略图 `Ti`(`ChipThumbnail`) 14px / `Ys`(`PlaceholderIcon`) 14px / opacity .6，
 *    占位 glyph 表 `Hr`：text=`Ba`(自绘 14 视框三横线) · video=`La`(自绘 48 视框播放) ·
 *    audio/file/quote = 内联 lucide path（file 与 quote 的 path 已逐字抄进本文件）。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLocale, useT } from '../../i18n';
import type { WebSource } from '../../types/chat';
import { agentEventString } from '../../services/chat/agentEventStrings';
import OfficialTooltip from './OfficialTooltip';
import { OfficialPhotoIcon, OfficialTextLinesIcon, OfficialVideoPlaceholderIcon } from './officialIcons';
import { webSourceFavicon, webSourceLabel, splitWebSources } from '../../services/chat/webSourceDisplay';

/** 官方 `Uoe`：pill 列表默认最多显示 4 个，其余折成 `+N more`。 */
const PILL_LIMIT = 4;
/** 官方 `Jn` / `op`：chip 缩略图与占位 glyph 的尺寸。 */
const CHIP_THUMB_SIZE = 14;
/** 官方 `cp`：chip 基类。 */
const CHIP_BASE_CLASS = [
  'relative inline-flex items-center justify-center align-middle gap-1 h-5 min-w-[24px] max-w-[120px] p-1',
  'cursor-pointer transition-[filter,box-shadow,color] duration-200 ease-out',
].join(' ');
/** 官方 `dp`：chip 常态色。 */
const CHIP_ACTIVE_CLASS = [
  'text-white/60 hover:text-white/80 hover:brightness-110',
  'hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
].join(' ');

/** 官方 `aS`：新窗口打开。 */
function openSource(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** 官方 `FD` = `WebSearchSourceCard`。 */
const WebSearchSourceCard = memo(function WebSearchSourceCard({
  source,
  index,
  showIndex = false,
}: {
  source: WebSource;
  index: number;
  showIndex?: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const handleClick = useCallback(() => openSource(source.url), [source.url]);
  const favicon = webSourceFavicon(source);
  const showFavicon = !source.image || imageFailed;
  const displayIndex = index + 1;
  const label = webSourceLabel(source);
  const ariaLabel = source.title
    ? (showIndex ? `${displayIndex}. ${source.title}` : source.title)
    : (showIndex ? `Source ${displayIndex}` : 'Source');
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className="group/ws-card fade-in-0 slide-in-from-bottom-1 flex w-[clamp(140px,42%,172px)] shrink-0 animate-in cursor-pointer flex-col overflow-hidden rounded-lg bg-white/[0.07] fill-mode-backwards text-left transition-colors duration-300 hover:bg-white/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:animate-none"
      style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-white/[0.06]">
        {!imageLoaded && !showFavicon && (
          <div className="absolute inset-0 animate-pulse bg-white/[0.06]" />
        )}
        {showFavicon ? (
          favicon ? (
            <span className="flex h-full w-full items-center justify-center">
              <img
                src={favicon}
                alt=""
                loading="lazy"
                draggable={false}
                className="size-8 rounded-[6px] opacity-80"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            </span>
          ) : null
        ) : (
          <img
            src={source.image}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
            className={imageLoaded
              ? 'h-full w-full object-cover transition-transform duration-300 group-hover/ws-card:scale-[1.03] motion-reduce:transition-none'
              : 'h-full w-full object-cover opacity-0'}
          />
        )}
        {showIndex ? (
          <span
            aria-hidden="true"
            data-testid="web-search-source-card-index"
            className="pointer-events-none absolute top-2 left-2 z-[1] flex h-4 min-w-4 items-center justify-center rounded-[4px] bg-black/55 px-[5px] text-[9px] font-medium leading-none tabular-nums text-white/80 ring-1 ring-white/10"
          >
            {displayIndex}
          </span>
        ) : null}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-white/10 ring-inset" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 px-2.5 py-2">
        <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground/90">{source.title}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              loading="lazy"
              draggable={false}
              className="size-3.5 shrink-0 rounded-[3px]"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
          ) : null}
          <span className="truncate text-[11px] font-medium leading-none text-muted-foreground/80">{label}</span>
        </span>
      </div>
    </button>
  );
});

/** 官方 `UD` = `WebSearchSourceCardList`（含指针拖拽横向滚动与两端渐隐 mask）。 */
const WebSearchSourceCardList = memo(function WebSearchSourceCardList({
  sources,
  showIndex = false,
}: {
  sources: WebSource[];
  showIndex?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [hasLeft, setHasLeft] = useState(false);
  const [hasRight, setHasRight] = useState(false);

  const measure = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    setHasLeft(node.scrollLeft > 8);
    setHasRight(node.scrollWidth - node.clientWidth - node.scrollLeft > 8);
  }, []);

  useEffect(() => {
    measure();
    const node = scrollRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const node = scrollRef.current;
    if (!node) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: node.scrollLeft,
      dragging: false,
    };
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const node = scrollRef.current;
    if (!drag || !node || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (!drag.dragging) {
      if (Math.abs(delta) < 8) return;
      drag.dragging = true;
      node.setPointerCapture?.(event.pointerId);
    }
    suppressClickRef.current = true;
    node.scrollLeft = drag.startScrollLeft - delta;
    measure();
    event.preventDefault();
  }, [measure]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const node = scrollRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.dragging) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    if (node?.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }, []);

  const handleClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }, []);

  if (sources.length === 0) return null;
  const maskClasses = hasLeft && hasRight
    ? '[mask-image:linear-gradient(to_right,transparent_0%,black_64px,black_calc(100%-64px),transparent_100%)]'
    : hasLeft
      ? '[mask-image:linear-gradient(to_right,transparent_0%,black_64px)]'
      : hasRight
        ? '[mask-image:linear-gradient(to_right,black_calc(100%-64px),transparent_100%)]'
        : null;

  return (
    <div
      ref={scrollRef}
      onScroll={measure}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
      onClickCapture={handleClickCapture}
      className={[
        'mt-1.5 mb-1 flex cursor-grab gap-2 overflow-x-auto pb-1.5 select-none active:cursor-grabbing touch-pan-y',
        '[scrollbar-color:color-mix(in_srgb,var(--foreground)_22%,transparent)_transparent] [scrollbar-width:thin]',
        maskClasses ?? '',
      ].filter(Boolean).join(' ')}
      data-no-quote
    >
      {sources.map((source, index) => (
        <WebSearchSourceCard key={source.url} source={source} index={index} showIndex={showIndex} />
      ))}
    </div>
  );
});

/** 官方 `Ti` = `ChipThumbnail`：有缩略图就出图，否则出官方 `Ys`(`PlaceholderIcon`)。 */
function ChipThumbnail({
  thumb,
  label,
  placeholderType = 'image',
}: {
  thumb: string;
  label: string;
  placeholderType?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!thumb?.trim() || failed) return <PlaceholderIcon placeholderType={placeholderType} />;
  return (
    <img
      src={thumb}
      alt={label}
      className="object-cover shrink-0"
      style={{ width: CHIP_THUMB_SIZE, height: CHIP_THUMB_SIZE, borderRadius: '3px' }}
      onError={() => setFailed(true)}
    />
  );
}

/** 官方 `Ys` = `PlaceholderIcon`（`size` 默认 `op=14`，`opacity` 默认 `.6`）。 */
function PlaceholderIcon({ placeholderType = 'image' }: { placeholderType?: string }) {
  const size = CHIP_THUMB_SIZE;
  const opacity = 0.6;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', opacity } as const;
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      {placeholderType === 'video' ? (
        <OfficialVideoPlaceholderIcon size={size} opacity={opacity} />
      ) : placeholderType === 'text' ? (
        <OfficialTextLinesIcon size={size} opacity={opacity} />
      ) : placeholderType === 'audio' ? (
        <svg {...common} strokeWidth={1.5}>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" fill="currentColor" />
          <circle cx="18" cy="16" r="3" fill="currentColor" />
        </svg>
      ) : placeholderType === 'quote' ? (
        <svg {...common} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" />
          <path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" />
        </svg>
      ) : placeholderType === 'file' ? (
        /* 官方 `Hr.file`（lucide `file` 的 path 逐字；注意**不是** tabler file） */
        <svg {...common} strokeWidth={1.5}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ) : (
        /* 官方 `Hr.image` = `Tl`（未反解）⇒ tabler `photo` 兜底；来源 pill 实际只走 `file` 分支 */
        <OfficialPhotoIcon size={size} />
      )}
    </span>
  );
}

/**
 * 官方 `LD` = `WebSearchSourcePill`（内层 chip 即 `hs` = `we` = `NodeMentionPill`）**逐字**。
 * `LD` 传给 chip 的参数：`label=ax(source)`、`thumb=If(source)`、`placeholderType="file"`、
 * `bg="#282828"`、`className="max-w-[180px]"`；外层再套官方 tooltip（`lS`）。
 */
function SourcePill({ source }: { source: WebSource }) {
  const favicon = webSourceFavicon(source);
  const label = webSourceLabel(source);
  return (
    <OfficialTooltip content={source.title || label}>
      <span
        className={`${CHIP_BASE_CLASS} ${CHIP_ACTIVE_CLASS} max-w-[180px]`}
        data-mention-type="node"
        style={{ borderRadius: '4px', background: '#282828' }}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={() => openSource(source.url)}
          aria-label={label}
          className="inline-flex min-w-0 items-center gap-1 cursor-pointer border-0 bg-transparent p-0"
        >
          <ChipThumbnail thumb={favicon} label={label} placeholderType="file" />
          <span className="truncate text-center text-xs font-normal leading-none transition-colors">{label}</span>
        </button>
      </span>
    </OfficialTooltip>
  );
}

/** 官方 `OD` = `WebSearchSourcePillList`。 */
const WebSearchSourcePillList = memo(function WebSearchSourcePillList({ sources }: { sources: WebSource[] }) {
  const [expanded, setExpanded] = useState(false);
  useT(); // 订阅语言切换（getLocale() 不是响应式的）
  const locale = getLocale();
  const visible = expanded ? sources : sources.slice(0, PILL_LIMIT);
  const hidden = sources.length - visible.length;
  if (sources.length === 0) return null;
  /* 官方 `Tre`：`t("chatAdapter.agentEvent.webSearch.more", {count: rest, defaultValue: \`+\${rest} more\`})`。
     zh = `+{{count}} 个`，fr = `+{{count}}`（没有 "more"）⇒ 必须走官方键，不能按语言硬编码。 */
  const moreLabel = agentEventString('webSearch.more', locale).replace(/\{\{count\}\}/g, String(hidden));
  return (
    <div className="mt-1 mb-1 flex min-w-0 flex-wrap items-center gap-1.5" data-no-quote>
      {visible.map((source) => (
        <SourcePill key={source.url} source={source} />
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          className="h-5 rounded-[4px] bg-[#282828] px-1.5 text-[11px] leading-none text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          {moreLabel}
        </button>
      ) : null}
    </div>
  );
});

/** 官方 `cS` = `WebSearchSourceDisplay`。 */
export default function WebSearchSourceDisplay({
  sources,
  showCardIndex = false,
}: {
  sources: WebSource[];
  showCardIndex?: boolean;
}) {
  /* 官方 `Qtt(sources)`（偏移 2367472，逐字）：带图来源 < `Xtt(3)` ⇒ 全 pill，否则全卡片；
     ⇒ 卡片与 pill **互斥**，不是同时渲染两套（MTV 此前两套都渲染，是错的）。 */
  const { cards, pills } = useMemo(() => splitWebSources(sources), [sources]);
  if (sources.length === 0) return null;
  return (
    <div className="min-w-0" data-no-quote>
      <WebSearchSourceCardList sources={cards} showIndex={showCardIndex} />
      <WebSearchSourcePillList sources={pills} />
    </div>
  );
}
