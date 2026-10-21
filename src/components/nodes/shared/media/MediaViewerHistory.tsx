/**
 * MediaViewerHistory —— 官方「历史版本列」（`Obe` @472356，逐字）
 *
 * 官方结构：
 *   `e.length <= 1 ? null`（**资源 ≤1 时整列不存在，也没有空态文案**）
 *   → `aside.media-viewer__history[data-media-viewer-dismiss-blocker]
 *        [data-media-viewer-history-overflow={overflow || undefined}]`
 *        `aria-label={t("common.historyVersions")}` `onWheel`（溢出时才 preventDefault + scrollBy）
 *      → 上翻键 `button.media-viewer__history-edge`（`aria-label=t("common.previousHistoryVersion")`、
 *         `disabled={index===0}`、`onClick={selectRelative(-1)}`、图标 `Wte`=Tabler chevron-up size 16）
 *      → `div.media-viewer__history-content`
 *         → `div.media-viewer__history-count` = `{index+1} / {total}`
 *         → `div.media-viewer__history-list`
 *            → `button.media-viewer__history-item`（`cn(…, isNear && "is-near")`、`aria-current`、
 *               `aria-label={\`${t("common.historyVersions")} ${i+1}\`}`、`tabIndex={active?0:-1}`）→ `img`
 *      → 下翻键（`common.nextHistoryVersion`、`disabled={index===total-1}`）
 *
 * 细节（逐字）：
 *   · **零 framer 动效**：这是原生 `<aside>`，只有 CSS 的 width/opacity/border-color 过渡
 *   · 缩略图/顺序/阈值等纯逻辑见 `utils/mediaViewerHistory.ts`（带单测）
 *   · 溢出检测：`ResizeObserver` + `scrollHeight > clientHeight + 1`
 *   · 选中项垂直居中：`list.scrollTo({ top: item.offsetTop - (list.clientHeight - item.offsetHeight)/2,
 *     behavior: reducedMotion ? "auto" : "smooth" })`
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { OfficialIcon } from '../../../sidebar/OfficialIcon';
import { useT } from '../../../../i18n';
import {
  mediaHistoryThumbnail,
  shouldShowMediaHistory,
  type MediaHistoryVersion,
} from '../../../../utils/mediaViewerHistory';

export interface MediaViewerHistoryProps {
  versions: readonly MediaHistoryVersion[];
  /** 当前展示的版本地址（官方 `currentUrl`） */
  currentSrc: string;
  onSelect: (src: string) => void;
}

export default function MediaViewerHistory({ versions, currentSrc, onSelect }: MediaViewerHistoryProps) {
  const t = useT();
  const reducedMotion = useReducedMotion();
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const [overflow, setOverflow] = useState(false);

  const activeIndex = useMemo(
    () => Math.max(0, versions.findIndex((version) => version.src === currentSrc)),
    [currentSrc, versions],
  );

  /* 官方：`ResizeObserver` + `scrollHeight > clientHeight + 1` */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const measure = () => setOverflow(list.scrollHeight > list.clientHeight + 1);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(list);
    return () => observer?.disconnect();
  }, [versions.length]);

  /* 官方：选中项垂直居中（减动效时 `behavior:"auto"`） */
  useEffect(() => {
    const list = listRef.current;
    const item = itemRefs.current.get(versions[activeIndex]?.src ?? '');
    if (!list || !item) return;
    list.scrollTo({
      top: item.offsetTop - (list.clientHeight - item.offsetHeight) / 2,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [activeIndex, reducedMotion, versions]);

  const selectRelative = useCallback((delta: -1 | 1) => {
    const next = versions[activeIndex + delta];
    if (next) onSelect(next.src);
  }, [activeIndex, onSelect, versions]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (!overflow) return;
    const list = listRef.current;
    if (!list) return;
    event.preventDefault();
    list.scrollBy({ top: event.deltaY, behavior: 'auto' });
  }, [overflow]);

  if (!shouldShowMediaHistory(versions.length)) return null;

  return (
    <aside
      data-media-viewer-dismiss-blocker=""
      data-media-viewer-history-overflow={overflow || undefined}
      aria-label={t('历史版本')}
      className="media-viewer__history"
      onWheel={handleWheel}
    >
      <button
        type="button"
        aria-label={t('上一个版本')}
        disabled={activeIndex === 0}
        className="media-viewer__history-edge"
        onClick={() => selectRelative(-1)}
      >
        <OfficialIcon name="chevron-up" size={16} />
      </button>
      <div className="media-viewer__history-content">
        <div className="media-viewer__history-count">
          {activeIndex + 1}
          {' / '}
          {versions.length}
        </div>
        <div ref={listRef} className="media-viewer__history-list">
          {versions.map((version, index) => {
            const active = index === activeIndex;
            const near = Math.abs(index - activeIndex) === 1;
            return (
              <button
                key={version.src}
                ref={(element) => {
                  if (element) itemRefs.current.set(version.src, element);
                  else itemRefs.current.delete(version.src);
                }}
                type="button"
                tabIndex={active ? 0 : -1}
                aria-label={`${t('历史版本')} ${index + 1}`}
                aria-current={active ? 'true' : undefined}
                className={`media-viewer__history-item${near ? ' is-near' : ''}`}
                onClick={() => onSelect(version.src)}
              >
                <img
                  src={mediaHistoryThumbnail(version)}
                  alt=""
                  draggable={false}
                  loading={active ? 'eager' : 'lazy'}
                  onError={(event) => {
                    const image = event.currentTarget;
                    if (image.dataset.fallbackApplied) return;
                    image.dataset.fallbackApplied = 'true';
                    image.src = version.src;
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        aria-label={t('下一个版本')}
        disabled={activeIndex === versions.length - 1}
        className="media-viewer__history-edge"
        onClick={() => selectRelative(1)}
      >
        <OfficialIcon name="chevron-down" size={16} />
      </button>
    </aside>
  );
}
