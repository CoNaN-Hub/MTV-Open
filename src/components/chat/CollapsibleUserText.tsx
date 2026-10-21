/**
 * 官方「用户消息文本（可折叠）」—— `page-BeI7xydN.js`@674894 的 `ML`（`displayName="CollapsibleUserText"`）逐字。
 *
 * 官方原文（`Z0` 分派里 `item.type === 'text' && role === 'user'` 走这条）：
 *   const [expanded, setExpanded] = useState(false);
 *   const [metrics, setMetrics] = useState(null);
 *   const innerRef = useRef(null); const userToggledRef = useRef(false);
 *   useLayoutEffect(() => { …measure via `$ae`… }, [quotedPart, bodyText, attachments]);
 *   const isClamped = metrics?.isClamped ?? false;
 *   const showToggle = isClamped || expanded;
 *   const masked = isClamped && !expanded;
 *   const duration = reducedMotion || !userToggledRef.current ? 0 : 0.32;
 *   const height = !metrics || !isClamped || expanded ? 'auto' : (metrics.collapsedHeight || 'auto');
 *   <div className="relative min-w-0 max-w-full" data-expanded={String(expanded)}>
 *     <motion.div initial={false} animate={{height}} transition={{duration, ease:[.22,1,.36,1]}}
 *                 className="overflow-hidden"
 *                 style={masked ? {maskImage: S1, WebkitMaskImage: S1} : undefined}>
 *       <div ref={innerRef} data-testid="user-message-text" className={cx(Bae, !metrics && Q0)}>
 *         {quotedPart && <span className="mb-1.5 block rounded-sm bg-white/[0.06] px-2.5 py-1.5
 *                                         text-[11px] leading-relaxed text-muted-foreground/70">{quotedPart}</span>}
 *         <InlineUserReferenceParts text={bodyText} attachments={attachments} />
 *       </div>
 *     </motion.div>
 *     {showToggle && <button type="button" data-testid="user-message-expand-toggle" aria-expanded={expanded}
 *         className="mt-2.5 text-[12px] leading-4 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
 *         onClick={() => { userToggledRef.current = true; setExpanded(v => !v); }}>
 *       {expanded ? t('chatAdapter.userMessage.showLess','Show less') : t('chatAdapter.userMessage.showMore','Show more')}
 *     </button>}
 *   </div>
 *
 * 常量（同址逐字）：
 *   `Bae` = 内层文本类串 · `Q0` = `line-clamp-6`（未测量前先按 6 行钳）
 *   `Vae` = 0.32（首次手动展开后的动画时长）· `Hae` = `[.22,1,.36,1]`
 *   `S1`  = `linear-gradient(to bottom, black 55%, transparent 100%)`（钳住但未展开时的下缘渐隐）
 *   `$ae` = 量法：把内层节点**克隆**到一个绝对定位的隐藏副本上，先量去掉 `line-clamp-6` 的
 *           `scrollHeight`（fullHeight），再量带钳制的 `clientHeight`（collapsedHeight），
 *           `isClamped = fullHeight > collapsedHeight + 1`
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useT } from '../../i18n';

/** 官方 `Bae`：内层文本类串。 */
const TEXT_CLASS = [
  'text-[14px] leading-[1.75] tracking-[0.01em] whitespace-pre-wrap break-words',
  '[overflow-wrap:anywhere] [word-break:break-all] text-chat-foreground',
].join(' ');
/** 官方 `Q0`：测量完成前先按 6 行钳住。 */
const CLAMP_CLASS = 'line-clamp-6';
/** 官方 `Vae`：首次手动展开后的动画时长（秒）。 */
const EXPAND_DURATION = 0.32;
/** 官方 `Hae`：缓动。 */
const EXPAND_EASE = [0.22, 1, 0.36, 1] as const;
/** 官方 `S1`：钳住但未展开时的下缘渐隐 mask。 */
const CLAMP_MASK = 'linear-gradient(to bottom, black 55%, transparent 100%)';

interface TextMetrics {
  fullHeight: number;
  collapsedHeight: number;
  isClamped: boolean;
}

/** 官方 `$ae`：克隆节点量「完整高度」与「钳制高度」。 */
function measureClamped(el: HTMLElement | null): TextMetrics | null {
  const parent = el?.parentElement;
  if (!el || !parent) return null;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.setAttribute('aria-hidden', 'true');
  clone.removeAttribute('data-testid');
  clone.style.position = 'absolute';
  clone.style.visibility = 'hidden';
  clone.style.pointerEvents = 'none';
  clone.style.inset = '0 auto auto 0';
  clone.style.width = `${el.offsetWidth}px`;
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'hidden';
  parent.appendChild(clone);
  clone.classList.remove(CLAMP_CLASS);
  const fullHeight = clone.scrollHeight;
  clone.classList.add(CLAMP_CLASS);
  const collapsedHeight = clone.clientHeight;
  clone.remove();
  return { fullHeight, collapsedHeight, isClamped: fullHeight > collapsedHeight + 1 };
}

export default function CollapsibleUserText({
  quotedPart,
  bodyText,
  /** 正文渲染器（官方 `Uu` = `InlineUserReferenceParts`；MTV 用 `ChatReferenceText`）。 */
  children,
  /** 附件签名（官方依赖里的 `attachments`；用长度+首尾拼一个稳定签名即可）。 */
  attachmentKey = '',
  /** 系统「减少动态效果」时不做高度补间（官方 `Gn()`）。 */
  reducedMotion = false,
}: {
  quotedPart?: string | null;
  bodyText: string;
  children: ReactNode;
  attachmentKey?: string;
  reducedMotion?: boolean;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [metrics, setMetrics] = useState<TextMetrics | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  /** 官方用 `userToggledRef`（不触发渲染）；这里用 state 等价替代，避免 render 期读 ref。 */
  const [userToggled, setUserToggled] = useState(false);

  /* 官方依赖就是 `[quotedPart, bodyText, attachments]`。 */
  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return undefined;
    const update = () => {
      const next = measureClamped(node);
      if (!next) return;
      setMetrics((current) =>
        current
        && current.fullHeight === next.fullHeight
        && current.collapsedHeight === next.collapsedHeight
        && current.isClamped === next.isClamped
          ? current
          : next,
      );
    };
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [quotedPart, bodyText, attachmentKey]);


  const isClamped = metrics?.isClamped ?? false;
  const showToggle = isClamped || expanded;
  const masked = isClamped && !expanded;
  const duration = reducedMotion || !userToggled ? 0 : EXPAND_DURATION;
  const height = !metrics || !isClamped || expanded ? 'auto' : (metrics.collapsedHeight || 'auto');

  const handleToggle = useCallback(() => {
    setUserToggled(true);
    setExpanded((value) => !value);
  }, []);

  return (
    <div className="relative min-w-0 max-w-full" data-expanded={expanded ? 'true' : 'false'}>
      <motion.div
        initial={false}
        animate={{ height }}
        transition={{ duration, ease: EXPAND_EASE }}
        className="overflow-hidden"
        style={masked ? { maskImage: CLAMP_MASK, WebkitMaskImage: CLAMP_MASK } : undefined}
      >
        <div
          ref={innerRef}
          data-testid="user-message-text"
          className={[TEXT_CLASS, metrics ? '' : CLAMP_CLASS].filter(Boolean).join(' ')}
        >
          {quotedPart ? (
            <span className="mb-1.5 block rounded-sm bg-white/[0.06] px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground/70">
              {quotedPart}
            </span>
          ) : null}
          {children}
        </div>
      </motion.div>
      {showToggle ? (
        <button
          type="button"
          data-testid="user-message-expand-toggle"
          aria-expanded={expanded}
          className="mt-2.5 text-[12px] leading-4 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          onClick={handleToggle}
        >
          {expanded ? t('收起') : t('展开')}
        </button>
      ) : null}
    </div>
  );
}
