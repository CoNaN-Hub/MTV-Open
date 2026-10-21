/**
 * ContextStrip —— 官方输入卡上方的「引用 / 附件」条（官方组件 `VL`，`page-DVqoHdTT.js`@742183）。
 *
 * 官方逐字结构：
 *   const m = contextNodes.length + attachments.length + (quotedText ? 1 : 0);
 *   if (m === 0) return null;                       // ← 没有任何引用/附件时整条不渲染
 *   <div className={V("flex items-center pl-4 pt-3", m > 1 && overflowing ? "gap-1 pr-2" : "gap-2 pr-4")}>
 *     <div className="relative min-w-0 flex-1">
 *       {overflowing && !scrolledToEnd && <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-[1]
 *                                                   bg-gradient-to-l from-chat-bubble-header to-transparent transition-opacity" />}
 *       <div ref={ref} className="flex min-w-0 flex-1 items-center gap-2 overflow-x-hidden overflow-y-visible
 *                                 hover:overflow-x-auto pt-2 -mt-2 [&::-webkit-scrollbar]:hidden
 *                                 [-ms-overflow-style:none] [scrollbar-width:none]">
 *         {!isActiveSession && <button className={sae}><Uh size={16} …/></button>}       // 插入画布内容
 *         {quotedText && <QuotedTextChip …/>}
 *         {contextNodes.map(id => <NodeChip …/>)}
 *         {attachments.map(a => <AttachmentChip …/>)}
 *         {m > 1 && !overflowing && <button className={ZN}><Yn size={14} strokeWidth={2}/></button>}
 *       </div>
 *     </div>
 *     {m > 1 && overflowing && <button className={ZN}><Yn size={14} strokeWidth={2}/></button>}
 *   </div>
 *
 * 三种 chip 共用同一 38×38 外壳（`use-chat-attachment-file-input-*.js`@152457 逐字）：
 *   eR = "relative flex size-[38px] items-center justify-center rounded-[10px] overflow-hidden border border-white/10 cursor-pointer transition-all"
 *   Zj = "absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors"
 *   tR = "absolute -top-1 -right-1 w-4 h-4 bg-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
 *
 * ⚠️ 本地化差异（记账）：
 *   1. 官方 `Qv`（溢出测量 hook）未挖 ⇒ 这里用 ResizeObserver 量 `scrollWidth > clientWidth`
 *      与 `scrollLeft + clientWidth >= scrollWidth - 1`，语义等价（官方也是这两个判据）。
 *   2. 官方 tooltip 用的是 Radix `Kt/Qn` + 富文本预览 `tg`；MTV 用现有 `data-tooltip` 约定。
 *   3. 本组件是**纯 props 展示层**：官方那三条 session 状态（`contextNodeIds` / `quotedText` /
 *      `attachments`）在 MTV store 里**尚不存在**，切片落地后由 ChatInput 传入即可点亮。
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n';
import OfficialTooltip from './OfficialTooltip';
import useOverflowState from './useOverflowState';
import {
  OfficialAudioSceneIcon,
  OfficialFileIcon,
  OfficialImagePlaceholderIcon,
  OfficialMusicIcon,
  OfficialPlaceholderGlyph,
  OfficialSparkleIcon,
  OfficialTextLinesIcon,
  OfficialVideoPlaceholderIcon,
} from './officialIcons';

/** 官方 `eR`：三种 chip 共用的外壳。 */
const CHIP_SHELL_CLASS =
  'relative flex size-[38px] items-center justify-center rounded-[10px] overflow-hidden border border-white/10 cursor-pointer transition-all';
/** 官方 `Zj`：悬浮压暗层。 */
const CHIP_OVERLAY_CLASS = 'absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors';
/** 官方 `tR`：移除键（hover 才出现）。 */
const CHIP_REMOVE_CLASS =
  'absolute -top-1 -right-1 w-4 h-4 bg-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10';
/** 官方 `sae`：左端「插入画布内容」钮。 */
const INSERT_FROM_CANVAS_CLASS =
  'size-[38px] flex items-center justify-center transition-all rounded-[10px] border border-white/10 shrink-0 focus:outline-none bg-white/[0.08] hover:bg-white/[0.12] cursor-pointer';
/** 官方 `ZN`：Clear 钮。 */
const CLEAR_CLASS =
  'shrink-0 cursor-pointer size-7 flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-white transition-all';

export interface ContextStripNode {
  id: string;
  label: string;
  thumbnailUrl?: string;
  /** 官方 `Dle(node.type)` 的档位：text / video / audio / image / file。 */
  kind?: 'image' | 'video' | 'audio' | 'text' | 'file' | 'other';
  /** 官方 `previewSrc`：图片用 SMALL 缩略图、视频用原 src（预览卡里播）。 */
  previewSrc?: string;
  /** 官方 `textContent`：文本节点给正文（预览卡里显示）。 */
  text?: string;
  /** 官方 `node.data.params?.scene`：音频占位 glyph 的三态分派（Text-to-Speech/Music/Sound）。 */
  scene?: string;
}

export interface ContextStripAttachment {
  src: string;
  name?: string;
  type?: string;
  /** 官方用 `mime_type` 区分 text/…（`Ba` 三横线 glyph）；MTV 的附件类型里没有独立 text 档。 */
  mimeType?: string;
}

/**
 * 官方 `Ng`（`Xs`，`use-chat-attachment-file-input-*.js`@156769）**逐字**：
 * ```jsx
 * Xs = memo(({previewSrc, label, textContent, placeholderType="image"}) => {
 *   const [imgError,setImgError]=useState(false); const bodyRef=useRef(null);
 *   const [clipped,setClipped]=useState(false);
 *   const isText = placeholderType==="text" || placeholderType==="quote";
 *   useLayoutEffect(()=>{ const el=bodyRef.current; el && setClipped(el.scrollHeight>el.clientHeight); },[textContent]);
 *   const body = previewSrc && !imgError
 *     ? <div className="relative">
 *         {placeholderType==="video"
 *           ? <video src={previewSrc} autoPlay muted loop playsInline className="w-40 h-40 object-cover" onError={…}/>
 *           : <img src={previewSrc} alt={label} className="w-40 h-40 object-cover" onError={…}/>}
 *         <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent"/>
 *       </div>
 *     : isText && textContent
 *       ? <div ref={bodyRef} className={cx("relative w-40 max-h-40 overflow-hidden px-3 pt-3 text-xs text-foreground/80", !clipped && "pb-3")}>
 *           {textContent}
 *           {clipped && <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#1c1c1e] to-transparent"/>}
 *         </div>
 *       : <div className="flex items-center justify-center w-40 h-40"><Ys placeholderType={placeholderType} size={32}/></div>;
 *   return <>{body()}<div className="px-3 py-2.5 text-[13px] font-medium text-foreground/90 truncate max-w-[160px]">{label}</div></>;
 * });
 * ```
 * 占位图标 `Ys`（`PlaceholderIcon`）：`<span className="inline-flex items-center justify-center shrink-0"
 * style={{width:size,height:size}}>{glyph({size, opacity})}</span>`，预览卡里固定 `size=32`（`Hr[type] ?? Hr.image`）。
 */
function ChipPreview({
  src,
  label,
  text,
  kind,
}: {
  src?: string;
  label: string;
  text?: string;
  kind?: ContextStripNode['kind'];
}) {
  const [imgError, setImgError] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [clipped, setClipped] = useState(false);
  const isVideo = kind === 'video';
  const isText = kind === 'text';

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el) setClipped(el.scrollHeight > el.clientHeight);
  }, [text]);

  let body: React.ReactNode;
  if (src && !imgError) {
    /* 尺寸用**内联样式**写死 160×160 —— 与官方实测值（卡片 160×201 = 图 160×160 + 名字条 41）一致，
       避免 Tailwind 类在 merge/生成顺序上被别的规则盖掉（截图里出现过明显大于 160 的情况）。 */
    const mediaStyle: React.CSSProperties = { width: 160, height: 160, objectFit: 'cover', display: 'block' };
    body = (
      <div style={{ position: 'relative', width: 160 }}>
        {isVideo ? (
          <video
            src={src}
            autoPlay
            muted
            loop
            playsInline
            style={mediaStyle}
            onError={() => setImgError(true)}
          />
        ) : (
          <img
            src={src}
            alt={label}
            style={mediaStyle}
            onError={() => setImgError(true)}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
    );
  } else if (isText && text) {
    body = (
      <div
        ref={bodyRef}
        className={`relative w-40 max-h-40 overflow-hidden px-3 pt-3 text-xs text-foreground/80${clipped ? '' : ' pb-3'}`}
      >
        {text}
        {clipped ? (
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#1c1c1e] to-transparent" />
        ) : null}
      </div>
    );
  } else {
    body = (
      <div className="flex items-center justify-center w-40 h-40">
        {/* 官方 `Xs` 的占位分支逐字：`<Ys placeholderType={s} size={32}/>`，
            即 `(Hr[type] ?? Hr.image)({size:32, opacity:.6})` —— text=`Ba` video=`La`
            audio=<24 视框音符> file=<24 视框文件> quote=<24 视框双引号> image=`Tl`（48 视框自绘相片）。 */}
        <OfficialPlaceholderGlyph placeholderType={kind === 'other' ? 'file' : (kind ?? 'image')} size={32} />
      </div>
    );
  }

  return (
    <>
      {body}
      {/* 名字条：官方 `px-3 py-2.5 text-[13px] font-medium text-foreground/90 truncate max-w-[160px]` */}
      <div
        className="truncate px-3 py-2.5 text-[13px] font-medium text-foreground/90"
        style={{ maxWidth: 160 }}
      >
        {label}
      </div>
    </>
  );
}

interface ContextStripProps {
  contextNodes?: ContextStripNode[];
  quotedText?: string;
  attachments?: ContextStripAttachment[];
  /** 官方 `!isActiveSession` 时才渲染左端「插入画布内容」钮。 */
  showInsertFromCanvas?: boolean;
  onInsertFromCanvas?: () => void;
  onRemoveNode?: (nodeId: string) => void;
  onRemoveAttachment?: (attachment: ContextStripAttachment) => void;
  onRemoveQuotedText?: () => void;
  onClearAll?: () => void;
}

/** 官方 `Tt`/`$n` = **lucide `x`**（反解：`fq as Tt` → `index-DjCL4F9p.js` 的 `Av=F("x", WFr)`）。
    chip 里给的是 `className="w-3 h-3 text-white"`（12×12 / strokeWidth 1.5）；
    ContextStrip 的清空按钮给的是 `size={14} strokeWidth={2}`。 */
function RemoveGlyph({ size = 12, strokeWidth = 1.5, className = 'w-3 h-3 text-white' }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChipShell({
  label,
  onRemove,
  children,
  extraClass,
  previewSrc,
  previewText,
  previewKind,
  richTooltip = false,
}: {
  label: string;
  onRemove?: () => void;
  children?: React.ReactNode;
  extraClass?: string;
  previewSrc?: string;
  previewText?: string;
  previewKind?: ContextStripNode['kind'];
  /** 官方 `HL`（节点 chip）**无条件**用富预览卡；`sG`（附件 chip）只有图片/视频才用。 */
  richTooltip?: boolean;
}) {
  /* 官方 tooltip 壳：
     富预览 = `p-0 overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl bg-[#1c1c1e] backdrop-blur-xl`；
     纯文字 = `max-w-[200px] text-xs`。
     ⚠️ MTV 是 Tailwind v3 且**没有 tailwind-merge**：基础壳里的 `px-3 py-1.5`（`.px-3` 在样式表里
     排在 `.p-0` 之后）会盖掉追加的 `p-0` ⇒ 富预览卡实测比官方宽 24px（用户实测「引用缩略图 hover
     弹窗尺寸不对」，官方卡 = 160×201 = 160 图 + 41 名字条，不带内边距）。这里用 `!` 强制覆盖。 */
  const rich = richTooltip || ((previewKind === 'image' || previewKind === 'video') && !!previewSrc);
  return (
    <div className="relative shrink-0 group">
      <OfficialTooltip
        side="top"
        sideOffset={8}
        className={rich
          ? 'max-w-none !rounded-2xl !p-0 !border !border-solid border-white/[0.08] overflow-hidden shadow-2xl backdrop-blur-xl'
          : 'max-w-[200px] text-xs'}
        content={
          rich
            ? <ChipPreview src={previewSrc} label={label} text={previewText} kind={previewKind} />
            : label
        }
      >
        <div
          className={[CHIP_SHELL_CLASS, extraClass].filter(Boolean).join(' ')}
          style={{ width: 38, height: 38, flex: '0 0 auto' }}
        >{children}</div>
      </OfficialTooltip>
      {onRemove && (
        <button
          type="button"
          tabIndex={-1}
          className={CHIP_REMOVE_CLASS}
          onClick={onRemove}
          aria-label={label}
        >
          <RemoveGlyph />
        </button>
      )}
    </div>
  );
}

export default function ContextStrip({
  contextNodes = [],
  quotedText,
  attachments = [],
  showInsertFromCanvas = true,
  onInsertFromCanvas,
  onRemoveNode,
  onRemoveAttachment,
  onRemoveQuotedText,
  onClearAll,
}: ContextStripProps) {
  const t = useT();
  /** 官方 `Qv([contextNodes, attachments, quotedText])`：带 40px 迟滞的溢出测量。 */
  const { ref: scrollRef, isOverflowing: overflowing, isScrolledToEnd: scrolledToEnd } = useOverflowState<HTMLDivElement>(
    [contextNodes, attachments, quotedText],
  );

  const total = contextNodes.length + attachments.length + (quotedText ? 1 : 0);

  const clearButton = useMemo(() => (
    <OfficialTooltip content={t('清空')}>
      <button type="button" onClick={onClearAll} className={CLEAR_CLASS} aria-label={t('清空')}>
        {/* 官方 `O1` 钮里的 glyph：`<$n size={14} strokeWidth={2}/>`（lucide x）。 */}
        <RemoveGlyph size={14} strokeWidth={2} className="text-muted-foreground/60" />
      </button>
    </OfficialTooltip>
  ), [onClearAll, t]);

  if (total === 0) return null;

  return (
    <div className={['flex items-center pl-4 pt-3', total > 1 && overflowing ? 'gap-1 pr-2' : 'gap-2 pr-4'].join(' ')}>
      <div className="relative min-w-0 flex-1">
        {overflowing && !scrolledToEnd && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-[1] bg-gradient-to-l from-chat-bubble-header to-transparent transition-opacity" />
        )}
        <div
          ref={scrollRef}
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-hidden overflow-y-visible hover:overflow-x-auto pt-2 -mt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {showInsertFromCanvas && (
            <OfficialTooltip content={t('从画布添加')}>
              <button
                type="button"
                onClick={onInsertFromCanvas}
                className={INSERT_FROM_CANVAS_CLASS}
                aria-label={t('从画布添加')}
              >
                <OfficialSparkleIcon size={16} className="size-4 transition-colors text-white/60 hover:text-foreground" />
              </button>
            </OfficialTooltip>
          )}

          {quotedText && (
            <ChipShell label={t('引用文本')} onRemove={onRemoveQuotedText}>
              <div className={CHIP_OVERLAY_CLASS} />
              <span className="relative z-[1] line-clamp-2 px-1 text-[10px] leading-3 text-muted-foreground/60">
                {quotedText}
              </span>
            </ChipShell>
          )}

          {contextNodes.map((node) => (
            <ChipShell
              key={node.id}
              label={node.label}
              onRemove={onRemoveNode ? () => onRemoveNode(node.id) : undefined}
              extraClass={(node.kind === 'image' || node.kind === 'video') && (node.thumbnailUrl || node.previewSrc) ? 'bg-white/[0.08]' : undefined}
              previewSrc={node.previewSrc ?? node.thumbnailUrl}
              previewText={node.text}
              previewKind={node.kind}
              richTooltip
            >
              {/* 官方 `HL`(ContextChip) 的占位分支逐字（`page-BeI7xydN.js`@750262）：
                    `c==="video"` ⇒ `<Js size={18} opacity={1}/>`（48 视框播放）
                    `c==="text"`  ⇒ `<Zs size={18} opacity={1}/>`（14 视框三横线）
                    `c==="audio"` ⇒ `<Mr size={18} opacity={1} scene={h}/>`（16 视框，按 scene 三态）
                    `c==="file"`  ⇒ `<vc size={18}/>`（tabler file）
                    其余（image）⇒ `<fr size={18} opacity={1}/>`（48 视框自绘相片，**不是 tabler photo**） */}
              {(node.thumbnailUrl || node.previewSrc) && node.kind === 'image' ? (
                <img src={node.thumbnailUrl ?? node.previewSrc} alt={node.label} className="h-full w-full object-cover" />
              ) : node.kind === 'video' && node.previewSrc ? (
                <video src={`${node.previewSrc}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : node.kind === 'video' ? (
                <OfficialVideoPlaceholderIcon size={18} opacity={1} className="text-muted-foreground/60" />
              ) : node.kind === 'text' ? (
                <OfficialTextLinesIcon size={18} opacity={1} className="text-muted-foreground/60" />
              ) : node.kind === 'audio' ? (
                <OfficialAudioSceneIcon scene={node.scene} size={18} opacity={1} className="text-muted-foreground/60" />
              ) : node.kind === 'file' ? (
                <OfficialFileIcon size={18} className="text-muted-foreground/60" />
              ) : (
                <OfficialImagePlaceholderIcon size={18} opacity={1} className="text-muted-foreground/60" />
              )}
            </ChipShell>
          ))}

          {attachments.map((attachment) => (
            <ChipShell
              key={attachment.src}
              label={attachment.name ?? attachment.src}
              onRemove={onRemoveAttachment ? () => onRemoveAttachment(attachment) : undefined}
              extraClass={attachment.type === 'image' && attachment.src ? 'bg-white/[0.08]' : undefined}
              previewSrc={(attachment.type === 'image' || attachment.type === 'video') ? attachment.src : undefined}
              previewKind={attachment.type === 'video' ? 'video' : attachment.type === 'image' ? 'image' : (/^text\//.test(attachment.mimeType ?? '') ? 'text' : 'file')}
            >
              {/* 官方 `yp`(AttachmentChip) 的图标分支（反解后的真实 glyph）：
                  image⇒`img` · video⇒`La`(48 视框播放 glyph, opacity 1) · audio⇒`Vo`(tabler music)
                  · text⇒`Ba`(14 视框三横线, opacity .6) · 其它⇒`qo`(tabler file)；都是 18px。 */}
              {attachment.type === 'image' && attachment.src ? (
                <img src={attachment.src} alt={attachment.name ?? ''} className="h-full w-full object-cover" />
              ) : attachment.type === 'video' ? (
                <OfficialVideoPlaceholderIcon size={18} opacity={1} className="text-muted-foreground/60" />
              ) : attachment.type === 'audio' ? (
                <OfficialMusicIcon size={18} className="text-muted-foreground/60" />
              ) : /^text\//.test(attachment.mimeType ?? '') ? (
                <OfficialTextLinesIcon size={18} opacity={1} className="text-muted-foreground/60" />
              ) : (
                <OfficialFileIcon size={18} className="text-muted-foreground/60" />
              )}
            </ChipShell>
          ))}

          {total > 1 && !overflowing && clearButton}
        </div>
      </div>
      {total > 1 && overflowing && clearButton}
    </div>
  );
}
