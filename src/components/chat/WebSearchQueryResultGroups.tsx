/**
 * 联网搜索结果的「按 query 分组」视图 —— 官方 `Ire`(`WebSearchQueryResultGroups`) +
 * `Are`(`WebSearchResultRow`) + `RF`(`PinnedWebSearchSources`) 逐字复刻。
 *
 * 官方（live `vendor-pkg-canvas-ChpWx5JY.js`，偏移：`Ire` 2378658 / displayName 2379044；
 * `Are` 2377843 / displayName 2378611；`RF` 2397624）：
 * ```js
 * Ire = memo(({groups}) => groups.length === 0 ? null :
 *   <div className="mb-1 ml-2 max-w-[min(640px,100%)] space-y-2 border-l border-white/10 pb-1.5 pl-3" data-no-quote="">
 *     {groups.map(g => <div key={g.query}>
 *       <div className="truncate px-1.5 py-0.5 text-[13px] leading-[1.65] text-muted-foreground/60">{g.query}</div>
 *       {g.sources.map(s => <Are source={s} key={s.url}/>)}
 *     </div>)}
 *   </div>);
 *
 * Are = memo(({source}) =>
 *   <button type="button" onClick={() => SF(source.url)}
 *     className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-[4px] px-1.5 py-0.5 text-left transition-colors hover:bg-white/[0.05]">
 *     <span className="flex size-3.5 shrink-0 items-center justify-center">
 *       {favicon && <img src={C0(source)} alt="" loading="lazy" className="size-3.5 rounded-[3px]" onError={hide}/>}
 *     </span>
 *     <span className="min-w-0 truncate text-[13px] leading-[1.65] text-muted-foreground transition-colors hover:text-foreground/90">{source.title}</span>
 *     <span className="shrink-0 text-xs leading-none text-muted-foreground/45">{" · "}{Cre(source.url)}</span>
 *   </button>);
 *
 * RF = memo(({items, isStreaming, hasFollowingVisibleContent=false, showCardIndex=false}) => {
 *   const sources = canRevealCards ? wF(payloads) : [];   // 为空返回 null
 *   return <div data-testid="web-search-sources-pinned" data-no-quote=""><TF sources={sources} showCardIndex={showCardIndex}/></div>;
 * });
 * ```
 * `RF` 与 `PE` **平级**，由 `AC`(`CollapsibleToolSection`) 在**折叠态**渲染（见 `AC` 的 collapse 分支）。
 * 取值函数（`services/chat/webSourceDisplay` 已逐字实现）：`C0(source)` = favicon（回落 Google s2）、
 * `Cre(url)` = hostname 去掉 `www.`、`EE(source)` = 展示名。
 */
import { memo, useCallback, useState } from 'react';
import type { WebSource } from '../../types/chat';
import { webSourceDomain, webSourceFavicon } from '../../services/chat/webSourceDisplay';
import WebSearchSourceDisplay from './WebSearchSourceDisplay';

/** 官方 `SF`：新窗口打开。 */
function openSource(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** 官方 `Are` = `WebSearchResultRow`。 */
const WebSearchResultRow = memo(function WebSearchResultRow({ source }: { source: WebSource }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const favicon = webSourceFavicon(source);
  const handleClick = useCallback(() => openSource(source.url), [source.url]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-[4px] px-1.5 py-0.5 text-left transition-colors hover:bg-white/[0.05]"
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        {favicon && !faviconFailed ? (
          <img
            src={favicon}
            alt=""
            loading="lazy"
            className="size-3.5 rounded-[3px]"
            onError={() => setFaviconFailed(true)}
          />
        ) : null}
      </span>
      <span className="min-w-0 truncate text-[13px] leading-[1.65] text-muted-foreground transition-colors hover:text-foreground/90">
        {source.title}
      </span>
      <span className="shrink-0 text-xs leading-none text-muted-foreground/45">{' · '}{webSourceDomain(source.url)}</span>
    </button>
  );
});

export interface WebSearchQueryGroup {
  query: string;
  sources: WebSource[];
}

/** 官方 `Ire` = `WebSearchQueryResultGroups`。 */
const WebSearchQueryResultGroups = memo(function WebSearchQueryResultGroups({
  groups,
}: {
  groups: readonly WebSearchQueryGroup[];
}) {
  if (groups.length === 0) return null;
  return (
    <div className="mb-1 ml-2 max-w-[min(640px,100%)] space-y-2 border-l border-white/10 pb-1.5 pl-3" data-no-quote>
      {groups.map((group) => (
        <div key={group.query}>
          <div className="truncate px-1.5 py-0.5 text-[13px] leading-[1.65] text-muted-foreground/60">{group.query}</div>
          {group.sources.map((source) => (
            <WebSearchResultRow key={source.url} source={source} />
          ))}
        </div>
      ))}
    </div>
  );
});

/**
 * 官方 `RF` = `PinnedWebSearchSources`：折叠态下把「已发布的联网来源」钉在步骤摘要下方。
 * 官方内部 `cot(items)` = `iie(...).canRevealCards ? wF(payloads) : []`；MTV 侧来源直接由调用方给出，
 * 为空时返回 `null`（与官方一致）。
 */
const PinnedWebSearchSources = memo(function PinnedWebSearchSources({
  sources,
  showCardIndex = false,
}: {
  sources: WebSource[];
  /** 官方 `RF` 也接 `items`/`isStreaming`/`hasFollowingVisibleContent`，MTV 的等价数据是 `sources`。 */
  showCardIndex?: boolean;
}) {
  if (sources.length === 0) return null;
  return (
    <div data-testid="web-search-sources-pinned" data-no-quote>
      <WebSearchSourceDisplay sources={sources} showCardIndex={showCardIndex} />
    </div>
  );
});

export { WebSearchResultRow, WebSearchQueryResultGroups, PinnedWebSearchSources };
export default WebSearchQueryResultGroups;
