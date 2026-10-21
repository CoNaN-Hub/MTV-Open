/**
 * UpstreamReferenceChips —— 官方底行上方那条「上游引用行」（`gx` @1700439）的等价实现
 *
 * 官方源码（`zoom-slider-3ZcFvYQO.js`，逐字要点）：
 *   · 行（`gx` 返回值最外层）：`flex items-center gap-2 nodrag min-w-0` + className；
 *       文本卡（`zee` @3384358）只传 chips + 加号，没有 `leadingAction`/`magicSelection`，
 *       所以文本卡这一行 = 〔chips 区（flex-1）〕〔加号 38×38〕。
 *   · chips 区：`min-w-0 flex-1 relative`
 *   · 滚动容器：`flex items-center gap-1.5 pt-1 pr-1 -mt-1 -mr-1` +
 *       `overflow-x-auto | overflow-hidden`，`style={{scrollbarWidth:'none'}}`
 *       （`pt-1/pr-1/-mt-1/-mr-1` 是给条目右上角那个 -4px 的 ✕ 让位，别删）
 *   · 两端渐隐按钮：`absolute inset-y-0 -left-2|-right-2 w-8 z-10 cursor-pointer
 *       bg-gradient-to-r|l from-card to-transparent`（`aria-label="Scroll left|right"`，
 *       点击 `scrollBy({left:∓130, behavior:'smooth'})`）
 *   · 条目 `r0`：`relative group/frame shrink-0`
 *       - 图/视频：`<img class="size-[38px] object-cover rounded-[10px] border border-white/10">`
 *       - 文本/音频：`<div class="size-[38px] rounded-[10px] bg-white border border-white/10">`
 *         + 图标 `<Icon size={18} opacity={1} className="text-black">`（文本 `Si`、音频 `$o`）
 *       - 移除键：`absolute -top-1 -right-1 w-4 h-4 bg-black rounded-full opacity-0
 *         group-hover/frame:opacity-100 transition-opacity z-10` + `<X class="w-3 h-3 text-white">`
 *       - `title = title || "Image"/"Video"/"Audio"`；文本用 `title || \`Text ${index+1}\``
 *       - 顺序固定：**图片 → 视频 → 音频 → 文本**（`gx` 里就是按这四个列表依次 map）
 *   · 加号：`size-[38px] rounded-[10px] shrink-0 bg-white/[0.08] hover:bg-white/[0.12]`，
 *       `isSelecting` 时 `bg-white/[0.12] shadow-inner`（MTV 的 `+` 已存在，这里只补按压态样式）
 *
 * ⚠️ 与官方的**已知差异**（不造假交互，逐条记账在 AGENTS.md）：
 *   1. ~~官方条目点击 = `onMediaClick`（开媒体查看器 / 历史）~~ **这条旧注释是错的** ✗
 *      （用户 2026：「点击缩略图窗口 官方会自动让参考图进入输入区，MTV 现在无法点击 也无法进去」）。
 *      实测官方源码 `vendor-pkg-canvas-DKuSpVZP.js`：面板里传给 `Tx` 的 `onMediaClick` 是
 *      ```js
 *      Xe = useCallback(ot => {
 *        if (x) return;
 *        const pt = ue.find(it => it.id === ot.nodeId && it.type === ot.mediaType);
 *        pt && k.current?.insertMention?.(pt);   // ★ 把这条引用**插进提示词输入框**
 *      });
 *      ```
 *      ⇒ 条目点击 = **插入 mention 到输入区**（不是查看器）。MTV 现在按这个接：
 *          `UpstreamReferenceChips.onInsertMention` ← `PromptPanel.onInsertReferenceMention`
 *          ← `AINodeDialog` 的 `editorApiRef.insertMentionAtCursor(nodeId, label)`。
 *   2. 官方拖拽排序靠 dnd-kit（`activationConstraint.distance = 5`）；MTV 无该依赖 → 未接。
 *   3. 官方 `gx` 的 `emptyImageNodes/emptyVideoNodes/emptyAudioNodes` 空节点占位 chip
 *      （`dp`：点 ✕ 断开该空节点）MTV 没有对应态 → 未接。
 *   4. 官方文本条目即使没有 textContent 也会出 chip（只是不可点）；MTV 的 `collectUpstreamReferences`
 *      为 prompt token 编号一致会跳过空文本上游 ⇒ 这里也跳过。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { collectUpstreamReferences, type ReferenceKind } from '../../../utils/referenceTokens';
import {
  referenceChipTitle,
  removeUpstreamReference,
} from '../../../utils/upstreamReferenceChips';
import { useT } from '../../../i18n';
import { OfficialIcon } from '../../sidebar/OfficialIcon';
import { useReferenceHoverCard } from './referenceHoverCard';

/** 官方 `gx` 的固定渲染顺序 */
const KIND_ORDER: readonly ReferenceKind[] = ['image', 'video', 'audio', 'text'];

/** 官方滚动按钮位移：`const p = 130` */
const SCROLL_STEP = 130;

export interface UpstreamReferenceChipsProps {
  nodeId: string;
  className?: string;
  /**
   * 点条目 = 官方 `onMediaClick` → **把这条引用插入提示词输入区**（`insertMention`）。
   * 不传时条目不可点（保持旧行为）。
   */
  onInsertMention?: (reference: { nodeId: string; label: string }) => void;
}

function UpstreamReferenceChips({ nodeId, className, onInsertMention }: UpstreamReferenceChipsProps) {
  const t = useT();
  const edges = useAppStore((s) => s.edges);
  const nodes = useAppStore((s) => s.nodes);

  const items = useMemo(() => {
    const nodesById = new Map(nodes.map((n) => [n.id, n] as const));
    const collected = collectUpstreamReferences(nodeId, edges, nodesById);
    return KIND_ORDER.flatMap((kind) => {
      const list = collected.filter((item) => item.kind === kind);
      return list.map((item, indexInKind) => ({ item, indexInKind }));
    });
  }, [edges, nodeId, nodes]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(max - el.scrollLeft > 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    syncScrollState();
    el.addEventListener('scroll', syncScrollState, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncScrollState);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', syncScrollState);
      observer?.disconnect();
    };
  }, [syncScrollState, items.length]);

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: direction === 'left' ? -SCROLL_STEP : SCROLL_STEP,
      behavior: 'smooth',
    });
  }, []);

  /* ══ 缩略图悬浮预览卡（官方 `eme` + `h6`，kit @364745 / @362996）══
     官方：hover 300ms 后在上方弹出 100px 高的媒体预览（`side="top" align="center" sideOffset={6}`），
           离开 150ms 后关闭；卡片 = `h-[100px] rounded-[12px] overflow-hidden
           shadow-[0px_8px_24px_rgba(0,0,0,0.5)] bg-black` + 底部 40px 渐变条里的 `@{标题}`。
     ⚠️ MTV 原来给缩略图挂 `title` + `data-tooltip`（自造的浏览器/应用气泡）✗ ⇒ 已按官方换成预览卡。
     实现抽到 `useReferenceHoverCard`（提示词里的提及芯片用**同一份**）。 */
  const { card: hoverCardNode, openFor: openHoverCard, scheduleClose: scheduleCloseHoverCard } = useReferenceHoverCard();

  if (items.length === 0) return null;

  const scrollable = canScrollLeft || canScrollRight;

  return (
    <div className={className ? `prompt-ref-area ${className}` : 'prompt-ref-area'}>
      <div className="prompt-ref-scroll nodrag" ref={scrollRef}>
        {items.map(({ item, indexInKind }) => {
          const title = referenceChipTitle(item.title, item.kind, indexInKind);
          const thumb = item.kind === 'image' || item.kind === 'video' ? item.url : '';
          return (
            <div
              key={item.edgeId}
              className={`prompt-ref-chip${onInsertMention ? ' is-clickable' : ''}`}
              /* 官方 `Rw`：条目自身没有 title / tooltip（悬浮是上面那张预览卡），
                 但**有点击**（`onClick:y?void 0:c`）+ `cursor-pointer`（`c&&"cursor-pointer"`） */
              onClick={onInsertMention
                ? () => onInsertMention({ nodeId: item.nodeId, label: item.title || title })
                : undefined}
              onMouseEnter={(event) => openHoverCard(event.currentTarget, {
                title,
                kind: item.kind,
                url: item.url,
                /* ⚠️ 原来读 `item.text` —— `UpstreamReference` 上**没有这个字段**（死引用 ✗）；
                   真实字段是 `textContent`（`utils/referenceTokens.ts:23` 起，注释「仅文本卡有」） */
                text: item.textContent ?? '',
                /* ★ 顶行参考图芯片挂的是官方 **`eme`**（@366745，`r0` @1699083 末尾
                   `return p ? x : <eme url mediaType title textContent>{x}</eme>`）
                   ⇒ 它的卡**每条分支后面都跟同一条 40px 底部渐变条**（`["@",n]`），
                     与输入框里提及芯片挂的 `Zj`（只有文本档带条）**不是同一套** ✔ */
                captionMode: 'always',
              })}
              onMouseLeave={scheduleCloseHoverCard}
            >
              {thumb ? (
                <img
                  className="prompt-ref-chip-thumb"
                  src={thumb}
                  alt={item.kind === 'image' ? 'referenceImage' : 'referenceVideo'}
                  draggable={false}
                />
              ) : (
                <span className="prompt-ref-chip-glyph">
                  <OfficialIcon
                    name={item.kind === 'text' ? 'chip-text' : 'chip-audio'}
                    size={18}
                  />
                </span>
              )}
              <button
                type="button"
                className="prompt-ref-chip-remove"
                aria-label={t('移除引用')}
                data-tooltip={t('移除引用')}
                data-tooltip-pos="top"
                /* 官方 `r0` 的移除键也是 `Nn` 封装（`l.jsx(Nn,{content:Zi(zs),children:<button…>})`）⇒ 8 / 200 */
                data-tooltip-offset="8"
                data-tooltip-delay="200"
                onClick={(event) => {
                  event.stopPropagation();
                  removeUpstreamReference(item.edgeId);
                }}
              >
                <OfficialIcon name="x" size={12} />
              </button>
            </div>
          );
        })}
      </div>
      {scrollable && canScrollLeft && (
        <button
          type="button"
          className="prompt-ref-scrollbtn prompt-ref-scrollbtn--left"
          aria-label="Scroll left"
          onClick={() => scrollBy('left')}
        />
      )}
      {scrollable && canScrollRight && (
        <button
          type="button"
          className="prompt-ref-scrollbtn prompt-ref-scrollbtn--right"
          aria-label="Scroll right"
          onClick={() => scrollBy('right')}
        />
      )}

      {/* 悬浮预览卡（官方 `eme`）：Portal 到 body，避免被编辑器的 overflow 裁掉 */}
      {hoverCardNode}
    </div>
  );
}

export default memo(UpstreamReferenceChips);
