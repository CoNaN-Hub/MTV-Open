/**
 * AgentToolLine —— 官方工具行 `PE`（displayName `ToolCallStatusLine`，live bundle 偏移 2408414）1:1 复刻。
 *
 * 官方行（逐字，来自 live `vendor-pkg-canvas-ChpWx5JY.js`）：
 * ```
 * row(V)  = cx('my-0.5 flex w-full max-w-full items-center gap-2 py-0.5 text-[13px] font-normal leading-[1.65]',
 *              M && 'group/tool-call-line cursor-pointer')
 * icon(U) = cx('size-4 shrink-0',
 *              C ? 'tool-call-status-icon-active text-muted-foreground/80'
 *                : cx('text-muted-foreground/70',
 *                     M && 'transition-colors group-hover/tool-call-line:text-foreground/80'))
 * label(active) = <zp as="span" duration={2.1} spread={1.1}
 *                   className="min-w-0 truncate text-[13px] font-normal leading-[1.65]
 *                              [--color-muted-foreground:color-mix(in_srgb,var(--muted-foreground)_92%,transparent)]">
 * label(done)   = <span className="min-w-0 truncate text-[13px] font-normal leading-[1.65] text-muted-foreground/80
 *                          transition-colors group-hover/tool-call-line:text-foreground/80">
 * elapsed       = <span className="shrink-0 text-[13px] font-normal leading-[1.65] tabular-nums
 *                          text-muted-foreground/50">· {text}</span>
 * chevron(todo,常显)  = <cl className="size-4 shrink-0 text-muted-foreground/80 transition-[transform,color]
 *                          group-hover/tool-call-line:text-foreground/80
 *                          group-data-[state=open]/tool-details:rotate-90" strokeWidth={1.8}/>
 * chevron(普通,悬停显) = <cl className={cx(U, 'opacity-0 transition-all
 *                          group-hover/tool-call-line:opacity-100
 *                          group-data-[state=open]/tool-details:rotate-90')} strokeWidth={1.8}/>
 * root    = <hf className="group/tool-details" data-no-quote defaultOpen={false}>   ← Radix Collapsible，**非受控**
 * trigger = <gf aria-live={C?'polite':'off'} className={V} data-no-quote>
 * content = <ux className="space-y-1 overflow-hidden pt-0.5 text-[13px] leading-[1.65] text-muted-foreground/60
 *                      outline-none [--tw-duration:150ms] [--tw-ease:cubic-bezier(0.33,1,0.68,1)]
 *                      data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
 * 不可展开  = <output aria-live={C?'polite':'off'} className={V} data-no-quote>{H}</output>   ← 不是 Collapsible
 * ```
 *
 * **live DOM 实测**（CDP 9222）核对：图标由 **lucide-react** 渲染
 * （`<svg class="lucide lucide-<name> size-4 shrink-0 …" width="24" height="24" stroke-width="1.8">`），
 * 不是 iconify；chevron 的 `rotate-90` 走 **CSS** `group-data-[state=open]/tool-details`，不由 React 状态驱动。
 *
 * 图标 `Tot`（官方 `mie = e => Tot[e]`，偏移 2403422）：
 * `{webSearch:fue, skill:ti, viewMedia:ng, canvasContext:ng, exploration:ng, edit:GP, command:mue}`。
 * `ng`/`mue` 等的 lucide 名受 vendor-libs 内多作用域同名影响，**尚未在 live 侧可靠解析** ——
 * 此处沿用已核对的 dist 映射（globe / box / search / pencil / square-terminal），
 * 但 live 实测的**分组汇总行**图标是 `lucide-list-checks`（由 `Eot` 自带 `LeadingIcon`，不走 `mie`）。
 */
import { memo } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRight } from 'lucide-react';
import { getLocale } from '../../i18n';
import { agentToolLineLabel, agentToolLineText, dedupeToolItems, humanizeToolLineText, type ToolEventLike } from '../../services/chat/agentToolLabels';

import ShimmerText from './ShimmerText';
import ToolActivityDetailList from './ToolActivityDetailList';
import WebSearchQueryResultGroups, { type WebSearchQueryGroup } from './WebSearchQueryResultGroups';
import WebSearchSourceDisplay from './WebSearchSourceDisplay';
import type { WebSource } from '../../types/chat';
import { TOOL_GROUP_ICON, TOOL_KIND_ICONS } from './agentToolIcons';
import formatDurationSeconds from './workDuration';
import useElapsedSeconds, { ELAPSED_VISIBLE_AFTER_SECONDS } from './useElapsedSeconds';

const ROW_BASE = 'my-0.5 flex w-full max-w-full items-center gap-2 py-0.5 text-[13px] font-normal leading-[1.65]';
const CONTENT_CLASS = 'space-y-1 overflow-hidden pt-0.5 text-[13px] leading-[1.65] text-muted-foreground/60 outline-none [--tw-duration:150ms] [--tw-ease:cubic-bezier(0.33,1,0.68,1)] data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down';
/** 官方 `PE` 命令行列表：`k.length > 10` 才套 mask 滚动视口。 */
const COMMAND_SCROLL_LIMIT = 10;
/** 官方 `PE` 的 mask 渐变（逐字）。 */
const COMMAND_MASK_IMAGE = 'linear-gradient(to bottom, transparent 0, black 14px, black calc(100% - 18px), transparent 100%)';
const COMMAND_LIST_CLASS = 'max-w-[min(640px,100%)] space-y-1 text-[13px] leading-[1.65] text-muted-foreground/60';
const COMMAND_LIST_SCROLL_CLASS = 'h-[17.75rem] overflow-y-auto overscroll-contain py-1 pr-1 scroll-smooth [scrollbar-color:color-mix(in_srgb,var(--foreground)_22%,transparent)_transparent] [scrollbar-width:thin]';
/** 官方 `PE` 的 `q` 外层：来源区与工具行同宽并排。 */
const SOURCES_WRAPPER_CLASS = 'flex w-full min-w-0 flex-col gap-1.5';

/** 官方 `PE` 的 `k = d ? dot(e) : []` 里的一行。 */
export interface AgentCommandLine {
  tool: string;
  text: string;
}

function statusOf(item: ToolEventLike): string {
  const content = item.content;
  if (!content || typeof content !== 'object') return '';
  const status = (content as { status?: unknown }).status;
  return typeof status === 'string' ? status : '';
}

/** 官方 `Fx(item)`：工具调用 id（`content.tool_call_id || content.tool_use_id`，兜底 `item.id`）。 */
function callIdOf(item: ToolEventLike): string {
  const content = item.content;
  if (content && typeof content === 'object') {
    const record = content as { tool_call_id?: unknown; tool_use_id?: unknown };
    if (typeof record.tool_call_id === 'string') return record.tool_call_id;
    if (typeof record.tool_use_id === 'string') return record.tool_use_id;
  }
  const id = (item as { id?: unknown }).id;
  return typeof id === 'string' ? id : '';
}

/** 官方 `VM(status)`：取消/中止态。 */
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'aborted', 'interrupted']);
function isCancelledStatus(status: string): boolean {
  return CANCELLED_STATUSES.has(status);
}

/** 官方 `yV(items)`：组内是否有 `pending` / `started` 的工具事件。 */
function hasPendingOrStarted(items: readonly ToolEventLike[]): boolean {
  return items.some((item) => {
    if (item.type !== 'tool_event') return false;
    const status = statusOf(item);
    return status === 'pending' || status === 'started';
  });
}

/** 官方 `S`：组内最早的 `startedAt`。 */
function earliestStartedAt(items: readonly ToolEventLike[]): number | null {
  let min: number | null = null;
  for (const item of items) {
    const value = (item as { startedAt?: unknown }).startedAt;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    min = min === null ? value : Math.min(min, value);
  }
  return min;
}

export interface AgentToolLineProps {
  items: readonly ToolEventLike[];
  isStreaming: boolean;
  hasFollowingVisibleContent?: boolean;
  /** 官方 `PE.hasFollowingToolLine`：本行之后还有工具行（影响 `keepTerminalToolActive` 的生效条件）。 */
  hasFollowingToolLine?: boolean;
  keepTerminalToolActive?: boolean;
  /** 官方 `PE.showCardIndex`：来源卡编号。 */
  showCardIndex?: boolean;
  /** 官方 `PE.suppressWebSearchSources`：抑制联网搜索来源区。 */
  suppressWebSearchSources?: boolean;
  /**
   * 官方 `PE` 的 `d`：整组都是联网搜索（`rot(items)` 判定）。
   * 为真时：可展开条件变成 `k.length > 0`（命令行非空），展开体变成 `d ? Q : hie`。
   */
  webSearch?: boolean;
  /** 官方 `PE` 的 `k = d ? dot(e) : []`：联网搜索命令行（每行 `{tool, text}`）。 */
  commandLines?: readonly AgentCommandLine[];
  /** 官方 `PE` 的 `v`：`Ire`(`WebSearchQueryResultGroups`) 的按 query 分组结果。 */
  webSearchGroups?: readonly WebSearchQueryGroup[];
  /** 官方 `PE` 的 `_`：来源列表（`TF` = `WebSearchSourceDisplay`）。 */
  sources?: readonly WebSource[];
  /** 可展开时的内容（官方 `PE` 的 `hie` 详情列表 / `Ire` 分组 / `TF` 来源区）。 */
  children?: React.ReactNode;
  /**
   * 覆盖「是否可展开」。**默认按官方派生**：`M = d ? k.length > 0 : u.length > 0`
   * （`d` = 整组 web 搜索；MTV 未建模 ⇒ false；`u = oie(items)` 去重后非空即为真）。
   * ⚠️ 早前 MTV 把它做成默认 `false` 的 prop，而调用方（`CollapsibleToolSection`）从不传它
   * ⇒ 所有工具行**都不可展开**，详情列表成了死代码。现在改为默认派生。
   */
  expandable?: boolean;
  groupName?: string;
}

function AgentToolLine({
  items,
  isStreaming,
  hasFollowingVisibleContent = false,
  hasFollowingToolLine = false,
  keepTerminalToolActive = false,
  children,
  expandable,
  showCardIndex = false,
  webSearch = false,
  commandLines = [],
  webSearchGroups = [],
  sources = [],
  groupName = 'tool-call-line',
}: AgentToolLineProps) {
  const locale = getLocale();
  /* 官方 `PE` 的 `u = oie(items)`（按 `tool_call_id` 去重）与 `M`（可展开）：
       M = d ? k.length > 0 : u.length > 0
     `d` = 整组 web 搜索（MTV 未建模 ⇒ false）⇒ `M = u.length > 0`。 */
  const detailItems = dedupeToolItems(items);
  /* 官方 `M = d ? k.length > 0 : u.length > 0`（`d` = 整组联网搜索，`k` = 命令行，`u` = 去重后的工具事件）。 */
  const lines = webSearch ? commandLines : [];
  const isExpandable = expandable ?? (webSearch ? lines.length > 0 : detailItems.length > 0);
  /* 官方 `PE` 用 Radix **非受控** `defaultOpen={false}`，折叠状态由 Radix 内部维护；
     chevron 的旋转由 CSS `group-data-[state=open]/tool-details:rotate-90` 完成，不经过 React 状态。 */
  const label = agentToolLineLabel(items, isStreaming);
  /* ⚠️ MTV 自有工具（`media_generate` 等，官方 bundle **0 命中**）在官方文案表里没有条目，
     会原样露出 snake_case 工具名 —— 用户实测看到「media_generate 是干嘛的」。
     这里统一换成可读标题（与工具注册时的 `title` 一致）。 */
  const text = humanizeToolLineText(agentToolLineText(label, locale), isStreaming);

  /* 官方 `PE` 的 isActive 链路（逐字，偏移 2408414 邻域）：
       w = keepTerminalToolActive && !hasFollowingVisibleContent && !hasFollowingToolLine && !d
       C = w ? true
         : d ? (!settled && (isStreaming || yV(items)))
             : (isStreaming && p != null && yV([p]))
     `d` = 整组都是 web 搜索（MTV 侧未建模 ⇒ false）；`p` = 最后一条「新」tool_event。
     非搜索分支 ⇒ `isStreaming && 最后一条是 tool_event && 它有 pending/started`。 */
  const lastItem = items.length > 0 ? items[items.length - 1] : null;
  /* 官方 `w`：`keepTerminalToolActive` 真正生效的条件（`continuingCallId` 也用它）。 */
  const keepActive = keepTerminalToolActive && !hasFollowingVisibleContent && !hasFollowingToolLine;
  const isActive = keepActive
    ? true
    : isStreaming && !!lastItem && hasPendingOrStarted([lastItem]);

  /* 官方 `T = C && N >= ME(5) ? kp(N) : ""`（`N = b0(C, S)`，`S` = 最早 startedAt）。
     ⚠️ 必须在使用它的早退之前调用（React hooks 不能条件调用）。 */
  const elapsedSeconds = useElapsedSeconds(isActive, earliestStartedAt(items));
  const elapsedText = isActive && elapsedSeconds >= ELAPSED_VISIBLE_AFTER_SECONDS
    ? formatDurationSeconds(elapsedSeconds)
    : '';

  /* 官方里空组不可能出现（`pL`/`gS` 只会为**非空**的连续分组建块）；这里做防御性早退，
     避免空组被渲染成一行 `已完成 1 个操作`。所有可达状态下的 DOM 与官方一致。
     ⚠️ 必须放在所有 hook 调用之后。 */
  if (items.length === 0) return null;

  /* 官方唯一的 null 早退（逐字）：
       g = fV(f) === "failed" ? "completed" : fV(f)     // 失败也当「已完成」用于取消判定
       E = u.filter(x => !VM(fV([x])))                   // 排除取消项
       if (!isStreaming && VM(g) && (d || E.length === 0)) return null
     即：不在流式、且这组已取消/中止、且组内没有非取消项 ⇒ 这一行**不渲染**。
     （`d` = 整组 web 搜索模式，MTV 未建模 ⇒ false。） */
  const lastStatus = lastItem ? statusOf(lastItem) : '';
  const settledStatus = lastStatus === 'failed' ? 'completed' : lastStatus;
  const hasNonCancelled = items.some((item) => !isCancelledStatus(statusOf(item)));
  if (!isStreaming && isCancelledStatus(settledStatus) && !hasNonCancelled) return null;

  const LeadingIcon = label.iconOverride === 'listChecks' ? TOOL_GROUP_ICON : TOOL_KIND_ICONS[label.kind];
  const iconClass = `size-4 shrink-0 ${isActive ? 'tool-call-status-icon-active text-muted-foreground/80' : 'text-muted-foreground/70'}${isExpandable && !isActive ? ' transition-colors group-hover/tool-call-line:text-foreground/80' : ''}`;
  const rowClass = `${ROW_BASE}${isExpandable ? ` group/${groupName} cursor-pointer` : ''}`;

  const body = (
    <>
      <LeadingIcon aria-hidden className={iconClass} strokeWidth={1.8} />
      {isActive ? (
        <ShimmerText
          as="span"
          duration={2.1}
          spread={1.1}
          className="min-w-0 truncate text-[13px] font-normal leading-[1.65] [--color-muted-foreground:color-mix(in_srgb,var(--muted-foreground)_92%,transparent)]"
        >
          {text}
        </ShimmerText>
      ) : (
        <span className="min-w-0 truncate text-[13px] font-normal leading-[1.65] text-muted-foreground/80 transition-colors group-hover/tool-call-line:text-foreground/80">{text}</span>
      )}
      {elapsedText ? (
        <span className="shrink-0 text-[13px] font-normal leading-[1.65] tabular-nums text-muted-foreground/50">· {elapsedText}</span>
      ) : null}
      {isExpandable ? (
        <ChevronRight
          aria-hidden
          strokeWidth={1.8}
          className={`${iconClass} opacity-0 transition-all group-hover/tool-call-line:opacity-100 group-data-[state=open]/tool-details:rotate-90`}
        />
      ) : null}
    </>
  );

  /* ── 官方 `PE` 的三段附加结构（逐字）────────────────────────────────────────────
     `const $ = k.length > 10, W = $ ? {WebkitMaskImage, maskImage} : undefined;`
     `const K = <div className={cx("max-w-[min(640px,100%)] space-y-1 …", $ && "h-[17.75rem] …")}
                     data-command-scroll-fade={$ ? "mask" : undefined}
                     data-command-scroll-region={$ ? "true" : undefined} style={W}>…行…</div>;`
     `const q = _.length > 0 ? <TF sources={_} showCardIndex={l}/> : null;`
     `const Q = d && v.length > 0 ? <Ire groups={v}/> : K;`
     `const te = M ? <Collapsible.Root …>{…}{d ? Q : <hie items={u} …/>}…</Collapsible.Root>
                   : <output …>{H}</output>;`
     `return q ? <div className="flex w-full min-w-0 flex-col gap-1.5" data-no-quote>{te}{q}</div> : te;`
     ──────────────────────────────────────────────────────────────────────────── */
  const masked = lines.length > COMMAND_SCROLL_LIMIT;
  const commandList = (
    <div
      className={`${COMMAND_LIST_CLASS}${masked ? ` ${COMMAND_LIST_SCROLL_CLASS}` : ''}`}
      data-command-scroll-fade={masked ? 'mask' : undefined}
      data-command-scroll-region={masked ? 'true' : undefined}
      style={masked ? { WebkitMaskImage: COMMAND_MASK_IMAGE, maskImage: COMMAND_MASK_IMAGE } : undefined}
    >
      {lines.map((line) => (
        <div className="max-w-[min(640px,100%)] truncate py-0.5" key={`${line.tool}-${line.text}`}>{line.text}</div>
      ))}
    </div>
  );

  const detailBody = children ?? (webSearch
    ? (webSearchGroups.length > 0
      /* 官方 `Ire` = `WebSearchQueryResultGroups`。 */
      ? <WebSearchQueryResultGroups groups={[...webSearchGroups]} />
      : commandList)
    /* 官方 `hie` = `ToolActivityDetailList`。 */
    : (
      <ToolActivityDetailList
        items={items}
        continuingCallId={keepActive && lastItem ? callIdOf(lastItem) : ''}
      />
    ));

  const line = isExpandable ? (
    <Collapsible.Root className="group/tool-details" data-no-quote defaultOpen={false}>
      <Collapsible.Trigger className={rowClass} aria-live={isActive ? 'polite' : 'off'} data-no-quote>
        {body}
      </Collapsible.Trigger>
      <Collapsible.Content className={CONTENT_CLASS}>
        {detailBody}
      </Collapsible.Content>
    </Collapsible.Root>
  ) : (
    /* 官方：不可展开时渲染 `<output>`。 */
    <output aria-live={isActive ? 'polite' : 'off'} className={rowClass} data-no-quote>
      {body}
    </output>
  );

  const sourcesBlock = sources.length > 0 ? (
    /* 官方 `TF` = `WebSearchSourceDisplay`（`{sources, showCardIndex}`）。 */
    <WebSearchSourceDisplay sources={[...sources]} showCardIndex={showCardIndex} />
  ) : null;

  /* 官方 `q ? <div className="flex w-full min-w-0 flex-col gap-1.5" data-no-quote>{te}{q}</div> : te`。 */
  return sourcesBlock ? (
    <div className={SOURCES_WRAPPER_CLASS} data-no-quote>
      {line}
      {sourcesBlock}
    </div>
  ) : line;
}

export default memo(AgentToolLine);
