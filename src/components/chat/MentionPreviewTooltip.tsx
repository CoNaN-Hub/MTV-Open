/**
 * MentionPreviewTooltip —— 官方**提及 hover 预览浮层**逐字移植（`Df` + `fu` + `Wn`）。
 *
 * ## 我上一轮读错了（必须记住这个教训）
 * 我先用 `dispatchEvent(new MouseEvent('mouseover'…))` 在官方页面上测「有没有 hover 浮层」，
 * 得到 0 个浮层 ⇒ 结论「官方没有 hover 预览」。**这是错的**：Radix 的 Tooltip Trigger 监听的是
 * **pointer** 事件（`onPointerMove` / `onPointerLeave`），合成 `mouseover` 不会触发它。
 * 换成 **真 CDP 输入事件**（`Input.dispatchMouseEvent` + `pointerType:"mouse"`）后立刻复现：
 *   `wrapper data-state: closed → delayed-open`，并出现 `[data-radix-popper-content-wrapper]`
 *   （`data-side="top" data-align="center"`，239×361，位于卡片正上方）。
 * ⇒ **凡是要验「Radix 组件会不会弹/会不会开」，一律用真输入事件，不许用合成 mouse 事件下结论。**
 *
 * ## 官方源码（`vendor-pkg-canvas-Dp0xADoD.js` @160147 区，逐字）
 * ```js
 * Rf = "agent-reference-preview pointer-events-none data-[state=closed]:hidden";
 * function Df({children: e}) {                       // ← Tooltip 包装（`ii`=Provider, `to`=Root）
 *   const [t, n] = a.useState(!1);
 *   return s.jsx(ii, { delayDuration: 200, skipDelayDuration: 0, disableHoverableContent: !0,
 *                      children: s.jsx(to, { open: t, onOpenChange: n, children: e }) });
 * }
 * // 预览里的图（`vn(e, tn.SMALL)` = 取 SMALL 变体；失败回落原图）
 * function Lwe({src: e, label: t, onError: n}) { … <img loading="eager" decoding="async"
 *   className="block w-auto h-auto object-contain"
 *   style={{maxWidth:"min(320px, calc(100vw - 32px))", maxHeight:"min(320px, calc(100vh - 96px))"}} /> … }
 * // 预览卡内容（`fu`，displayName="TooltipPreview"）
 * fu = memo(({previewSrc: e, label: t, textContent: n, placeholderType: o = "image"}) => {
 *   const u = o === "text" || o === "quote";
 *   const p = () => (e && !r)
 *     ? <div className="relative">{o === "video"
 *         ? <video src={e} autoPlay muted loop playsInline className="w-40 h-40 object-cover" …/>
 *         : <Lwe src={e} label={t} …/>}</div>
 *     : (u && n)
 *       ? <div ref={l} className={z("relative w-40 max-h-40 overflow-hidden px-3 pt-3 text-xs text-foreground/80", !c && "pb-3")}>
 *           {n}{c && <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#1c1c1e] to-transparent"/>}</div>
 *       : <div className="flex items-center justify-center w-40 h-40"><kD placeholderType={o} size={32}/></div>;
 *   return <>{p()}<div className="px-3 py-2.5 text-[13px] font-medium text-foreground/90 truncate max-w-[min(320px,calc(100vw-32px))]">{t}</div></>;
 * });
 * // 提及节点视图 `ID` 的挂载点（`ms` = 我们已逐字移植的 `NodeMentionChip`）
 * : s.jsxs(Df, {children: [
 *     s.jsx(Un, {asChild: !0, children: C}),                       // C 的壳类 = `Dwe = "inline-flex align-middle my-1"`
 *     s.jsx(Wn, {side: "top", sideOffset: 8,
 *       className: z(Rf, "p-0 overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl bg-[#1c1c1e] backdrop-blur-xl"),
 *       children: s.jsx(fu, {previewSrc: g, label: o, textContent: x, placeholderType: y})})]})
 * ```
 * ⚠️ 上面那句 `Wn` 的 className 是**编辑器**那条路。用户实际看到的**消息正文**那条路
 *    （CDP 9222 真机 outerHTML）用的是：`base + Rf + "p-0 overflow-hidden rounded-lg border
 *    border-border bg-popover text-popover-foreground shadow-lg"`，
 *    且触发壳是 `span.mx-0.5 inline-flex align-middle`（不是 `inline-flex align-middle my-1`）。
 *    本组件按**真机那条**走（`className` 见 `MENTION_PREVIEW_CONTENT_CLASS`）。
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

/* eslint-disable react-refresh/only-export-components -- 本文件同时导出「官方类串常量」与「纯展示正文组件」，是为了让 jsdom 能逐字断言官方 DOM（与 `CanvasResourcePreviewDialog` 的 `CanvasResourcePreviewBody` 同一约定）。 */
/** 官方 `Rf`（逐字）。 */
export const AGENT_REFERENCE_PREVIEW_CLASS = 'agent-reference-preview pointer-events-none data-[state=closed]:hidden';

/**
 * 官方消息正文那条路的 Tooltip.Content 类串（CDP 9222 真机 outerHTML 逐字，顺序照抄）。
 * ⚠️ 官方**没有**用标准提示气泡那套底类（`px-3 py-1.5 text-white shadow-[0px_4px_16px…]`）——
 * 预览浮层是 `p-0` + popover 皮 ⇒ 这里**不**复用 `OfficialTooltipContent` 的底类。
 */
export const MENTION_PREVIEW_CONTENT_CLASS = [
  'z-50 border-none font-medium',
  '[background:rgba(51,51,51,0.80)] [backdrop-filter:blur(28px)]',
  'animate-in fade-in-0 zoom-in-95',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
  'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
  'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
  'origin-[--radix-tooltip-content-transform-origin]',
  'break-words text-xs leading-relaxed whitespace-pre-line',
  AGENT_REFERENCE_PREVIEW_CLASS,
  'p-0 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg',
].join(' ');

export type MentionPreviewKind = 'image' | 'video' | 'audio' | 'text' | 'file' | 'quote';

export interface MentionPreviewPayload {
  /** 官方 `previewSrc`（大图/视频地址；官方 `Lwe` 内部再取 SMALL 变体）。 */
  previewSrc?: string;
  /** 官方 `label`。 */
  label: string;
  /** 官方 `textContent`（`placeholderType` 为 text/quote 时显示的正文）。 */
  textContent?: string;
  /** 官方 `placeholderType`（`Uve` 的 `j`）。 */
  placeholderType?: MentionPreviewKind;
  /** 无图时的官方占位 glyph（官方 `kD`）。 */
  placeholderIcon?: ReactNode;
}

/**
 * 官方 `fu`（`displayName = "TooltipPreview"`）—— 预览卡内容。
 * 纯展示、无副作用，单独导出以便 jsdom 直测。
 */
export function MentionPreviewBody({
  previewSrc,
  label,
  textContent,
  placeholderType = 'image',
  placeholderIcon,
}: MentionPreviewPayload) {
  const [failed, setFailed] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const isText = placeholderType === 'text' || placeholderType === 'quote';

  /* 官方 `a.useEffect(()=>i(!1),[e])`：换 src 就重置失败态 */
  const [lastSrc, setLastSrc] = useState(previewSrc);
  if (lastSrc !== previewSrc) {
    setLastSrc(previewSrc);
    setFailed(false);
  }
  /* 官方 `a.useLayoutEffect(()=>{const m=l.current; m&&d(m.scrollHeight>m.clientHeight)},[n])`：
     文本溢出时补底部渐变。 */
  useLayoutEffect(() => {
    const el = textRef.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight);
  }, [textContent]);

  const media = previewSrc && !failed
    ? (
      <div className="relative">
        {placeholderType === 'video' ? (
          <video
            src={previewSrc}
            autoPlay
            muted
            loop
            playsInline
            className="w-40 h-40 object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <img
            key={previewSrc}
            src={previewSrc}
            alt={label}
            loading="eager"
            decoding="async"
            className="block w-auto h-auto object-contain"
            style={{
              maxWidth: 'min(320px, calc(100vw - 32px))',
              maxHeight: 'min(320px, calc(100vh - 96px))',
            }}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    )
    : isText && textContent
      ? (
        <div
          ref={textRef}
          className={`relative w-40 max-h-40 overflow-hidden px-3 pt-3 text-xs text-foreground/80${overflowing ? '' : ' pb-3'}`}
        >
          {textContent}
          {overflowing && (
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#1c1c1e] to-transparent" />
          )}
        </div>
      )
      : (
        <div className="flex items-center justify-center w-40 h-40">{placeholderIcon ?? null}</div>
      );

  return (
    <>
      {media}
      <div className="px-3 py-2.5 text-[13px] font-medium text-foreground/90 truncate max-w-[min(320px,calc(100vw-32px))]">
        {label}
      </div>
    </>
  );
}

export interface MentionPreviewTooltipProps {
  /** 触发元素（会被 Radix `Trigger asChild` 接管，必须能接收 ref 与事件）。 */
  children: ReactNode;
  payload: MentionPreviewPayload;
}

/**
 * 官方 `Df` —— Provider `delayDuration:200` / `skipDelayDuration:0` / `disableHoverableContent:true`，
 * Root 由自身 state 控制；Content `side="top"` `sideOffset={8}`（官方真机实测间距 8px）。
 */
export default function MentionPreviewTooltip({ children, payload }: MentionPreviewTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={0}>
      <TooltipPrimitive.Root delayDuration={200} disableHoverableContent>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            align="center"
            sideOffset={8}
            className={MENTION_PREVIEW_CONTENT_CLASS}
          >
            <MentionPreviewBody {...payload} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
