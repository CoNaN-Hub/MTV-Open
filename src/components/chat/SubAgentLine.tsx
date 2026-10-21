/**
 * SubAgentLine —— 官方子代理行 `sae`（displayName `SubagentCard`，live bundle 偏移 2596917）1:1 复刻。
 *
 * ⚠️ 与旧版（`page-BeI7xydN.js`）的关键差别：**live 官方只有 5 个状态**
 * `running / completed / failed / stopped / ended_unknown`（`YW` 归一化，其它值一律成 `ended_unknown`），
 * `working = status === "running"`。旧 MTV 实现按 `started/pending/error/cancelled` 判，
 * 在 live 口径下正在跑的子代理会被显示成已完成/已停止。
 *
 * 官方逐字（`live-任务胶囊与子代理卡.md` §7）：
 * ```js
 * tG={running:"Subagent working",completed:"Subagent finished",failed:"Subagent failed",stopped:"Subagent stopped",ended_unknown:"Subagent ended"}
 * pit={running:"working",completed:"done",failed:"failed",stopped:"stopped",ended_unknown:"endedUnknown"}
 * status=r=o?.status ?? "ended_unknown";  working=r==="running";  isWorkingStreaming=working && isStreaming;
 * failed=r==="failed";  settled=!working;  description=o?.task_description?.trim()||"";  text=o?.text??"";
 * toolEvents=(o?.tools??[]).map(P=>({type:"tool_event",content:P}));  groups=PF(toolEvents);
 * expandable=!!text || toolEvents.length>0;  [open,setOpen]=useState(isWorkingStreaming);
 * w=b0(isWorkingStreaming, startedAt);  C=isWorkingStreaming && w>=ME(5) ? kp(w) : "";
 * S=isWorkingStreaming ? null : RE([item]);  N=S!==null && S>=1000 ? kp(floor(S/1000)) : "";  T=C||N;
 * E=pit[r];  label = description ? t(`…subagent.${E}WithDescription`,{description})
 *                              : t(`…subagent.${E}`);
 * I = cx("size-4 shrink-0", isWorkingStreaming ? "tool-call-status-icon-active text-muted-foreground/80"
 *        : cx(failed ? "text-destructive/70" : "text-muted-foreground/70",
 *             expandable && "transition-colors group-hover/subagent-card:text-foreground/80"));
 * M = cx("my-0.5 flex w-full max-w-full items-center gap-2 py-0.5 text-[13px] font-normal leading-[1.65]",
 *        expandable && "group/subagent-card cursor-pointer");
 * ```
 * 展开区摘要逐字 class：
 * `max-h-40 max-w-[min(640px,100%)] overflow-y-auto overflow-x-hidden overscroll-contain whitespace-pre-line
 *  [overflow-wrap:anywhere] text-[13px] leading-[1.65] text-muted-foreground/60 [scrollbar-width:none]
 *  [&::-webkit-scrollbar]:hidden`
 * 子行渲染：`<PE items isStreaming={isStreaming && !settled} hasFollowingVisibleContent={settled}
 *            suppressWebSearchSources={false}/>`
 * 图标：行首 lucide **`bot`**、箭头 lucide **`chevron-right`**，都**不传 size**（由 `size-4` 收到 16px），
 * `strokeWidth={1.8}`；箭头旋转由 CSS `group-data-[state=open]/subagent-card:rotate-90` 驱动。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Bot, ChevronRight } from 'lucide-react';
import { getLocale } from '../../i18n';
import { agentEventString } from '../../services/chat/agentEventStrings';
import { toolNameOf, type ToolEventLike } from '../../services/chat/agentToolLabels';
import ShimmerText from './ShimmerText';
import formatDurationSeconds from './workDuration';
import useElapsedSeconds, { ELAPSED_VISIBLE_AFTER_SECONDS } from './useElapsedSeconds';

/** 官方 `pit`：status → i18n key 后缀。 */
const STATUS_I18N_SUFFIX: Record<string, string> = {
  running: 'working',
  completed: 'done',
  failed: 'failed',
  stopped: 'stopped',
  ended_unknown: 'endedUnknown',
};
/** 官方 `tG`：status → 英文 defaultValue。 */
const STATUS_FALLBACK: Record<string, string> = {
  running: 'Subagent working',
  completed: 'Subagent finished',
  failed: 'Subagent failed',
  stopped: 'Subagent stopped',
  ended_unknown: 'Subagent ended',
};
/** 官方 `ED = 2000`：settled 后自动折叠延迟。 */
const AUTO_COLLAPSE_DELAY_MS = 2000;

/** 官方 `RE([item])`：一组 item 的时长 = min(startedAt) → max(endedAt)。 */
function groupDurationMs(items: readonly ToolEventLike[]): number | null {
  let start: number | undefined;
  let end: number | undefined;
  for (const item of items) {
    const startedAt = (item as { startedAt?: unknown }).startedAt;
    const endedAt = (item as { endedAt?: unknown }).endedAt;
    if (typeof startedAt === 'number') start = start === undefined ? startedAt : Math.min(start, startedAt);
    if (typeof endedAt === 'number') end = end === undefined ? endedAt : Math.max(end, endedAt);
  }
  if (start === undefined || end === undefined || end < start) return null;
  return end - start;
}

/** 官方 `qge(item)` 的内容对象（`content` 是对象时返回它）。 */
function contentOf(agent: ToolEventLike): Record<string, unknown> | null {
  if (agent.type !== 'tool_event' || typeof agent.content !== 'object' || agent.content === null) return null;
  return agent.content as Record<string, unknown>;
}

/** 官方 `qge(item)` 归一出的人类可读描述（`task_description`）。 */
function taskDescriptionOf(agent: ToolEventLike): string {
  const content = contentOf(agent);
  const value = content?.task_description;
  return typeof value === 'string' ? value.trim() : '';
}

/** 官方 `o?.text`：子代理流式正文。 */
function textOf(agent: ToolEventLike): string {
  const content = contentOf(agent);
  const value = content?.text;
  return typeof value === 'string' ? value : '';
}

/** 官方 `PF`：把子代理的子工具事件按「同类连续」分组（MTV 侧恒为单一 `activity` 类）。 */
function groupChildren(items: readonly ToolEventLike[]): ToolEventLike[][] {
  const groups: ToolEventLike[][] = [];
  let lastKind = '';
  for (const item of items) {
    const kind = toolNameOf(item) ? 'activity' : 'activity';
    const tail = groups[groups.length - 1];
    if (tail && kind === lastKind) { tail.push(item); continue; }
    groups.push([item]);
    lastKind = kind;
  }
  return groups;
}

export interface SubAgentLineProps {
  /** 官方 `sae` 的 `item`（子代理事件，`content` 为 `subagent` 载荷）。 */
  agent: ToolEventLike;
  childItems: readonly ToolEventLike[];
  isStreaming: boolean;
  hasFollowingVisibleContent?: boolean;
  suppressWebSearchSources?: boolean;
  /** 子行的渲染器（官方是 `PE`；这里传入避免与 `AgentToolLine` 形成循环依赖）。 */
  renderChildGroup?: (items: readonly ToolEventLike[], key: string, props: { isStreaming: boolean; hasFollowingVisibleContent: boolean }) => React.ReactNode;
}

function SubAgentLine({
  agent,
  childItems,
  isStreaming,
  renderChildGroup,
}: SubAgentLineProps) {
  const locale = getLocale();
  const content = contentOf(agent);
  const rawStatus = typeof content?.status === 'string' ? content.status : '';
  const status = STATUS_I18N_SUFFIX[rawStatus] ? rawStatus : 'ended_unknown';
  const working = status === 'running';
  const isWorkingStreaming = working && isStreaming;
  const failed = status === 'failed';
  const settled = !working;
  const description = taskDescriptionOf(agent);
  const text = textOf(agent);
  const groups = useMemo(() => groupChildren(childItems), [childItems]);
  const [open, setOpen] = useState(isWorkingStreaming);
  const settledRef = useRef(settled);
  const manualRef = useRef(false);
  useEffect(() => {
    if (settledRef.current || !settled || manualRef.current) return undefined;
    settledRef.current = true;
    const timer = window.setTimeout(() => { if (!manualRef.current) setOpen(false); }, AUTO_COLLAPSE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [settled]);
  const handleOpenChange = useCallback((next: boolean) => { manualRef.current = true; setOpen(next); }, []);

  const startedAt = typeof (agent as { startedAt?: unknown }).startedAt === 'number'
    ? ((agent as { startedAt?: number }).startedAt as number)
    : null;
  const elapsedSeconds = useElapsedSeconds(isWorkingStreaming, startedAt);
  const workingElapsed = isWorkingStreaming && elapsedSeconds >= ELAPSED_VISIBLE_AFTER_SECONDS
    ? formatDurationSeconds(elapsedSeconds)
    : '';
  const settledMs = isWorkingStreaming ? null : groupDurationMs([agent]);
  const settledElapsed = settledMs !== null && settledMs >= 1000
    ? formatDurationSeconds(Math.floor(settledMs / 1000))
    : '';
  const elapsedText = workingElapsed || settledElapsed;

  const suffix = STATUS_I18N_SUFFIX[status];
  const labelKey = `subagent.${suffix}${description ? 'WithDescription' : ''}`;
  const fallback = description
    ? `${STATUS_FALLBACK[status]}: ${description}`
    : STATUS_FALLBACK[status];
  const resolved = agentEventString(labelKey, locale);
  const label = (resolved === labelKey ? fallback : resolved).replace(/\{\{description\}\}/g, description);

  const expandable = !!text || childItems.length > 0;
  const iconClass = `size-4 shrink-0 ${isWorkingStreaming
    ? 'tool-call-status-icon-active text-muted-foreground/80'
    : `${failed ? 'text-destructive/70' : 'text-muted-foreground/70'}${expandable ? ' transition-colors group-hover/subagent-card:text-foreground/80' : ''}`}`;
  const rowClass = `my-0.5 flex w-full max-w-full items-center gap-2 py-0.5 text-[13px] font-normal leading-[1.65]${expandable ? ' group/subagent-card cursor-pointer' : ''}`;

  const body = (
    <>
      <Bot aria-hidden className={iconClass} strokeWidth={1.8} />
      {isWorkingStreaming ? (
        <ShimmerText
          as="span"
          duration={2.1}
          spread={1.1}
          className="min-w-0 truncate text-[13px] font-normal leading-[1.65] [--color-muted-foreground:color-mix(in_srgb,var(--muted-foreground)_92%,transparent)]"
        >
          {label}
        </ShimmerText>
      ) : (
        <span className={`min-w-0 truncate text-[13px] font-normal leading-[1.65] ${failed ? 'text-destructive/80' : 'text-muted-foreground/80'}${expandable ? ' transition-colors group-hover/subagent-card:text-foreground/80' : ''}`}>
          {label}
        </span>
      )}
      {elapsedText ? (
        <span className="shrink-0 text-[13px] font-normal leading-[1.65] tabular-nums text-muted-foreground/50">· {elapsedText}</span>
      ) : null}
      {expandable ? (
        <ChevronRight
          aria-hidden
          strokeWidth={1.8}
          className={`${iconClass} opacity-0 transition-all group-hover/subagent-card:opacity-100 group-data-[state=open]/subagent-card:rotate-90`}
        />
      ) : null}
    </>
  );

  if (!expandable) {
    return <output aria-live={isWorkingStreaming ? 'polite' : 'off'} className={rowClass} data-no-quote>{body}</output>;
  }
  return (
    <Collapsible.Root data-no-quote open={open} onOpenChange={handleOpenChange}>
      <Collapsible.Trigger aria-live={isWorkingStreaming ? 'polite' : 'off'} className={rowClass} data-no-quote>
        {body}
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden pt-0.5 outline-none [--tw-duration:150ms] [--tw-ease:cubic-bezier(0.33,1,0.68,1)] data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="ml-2 flex flex-col gap-1.5 border-l border-foreground/10 py-0.5 pl-3.5">
          {text ? (
            <div className="max-h-40 max-w-[min(640px,100%)] overflow-y-auto overflow-x-hidden overscroll-contain whitespace-pre-line [overflow-wrap:anywhere] text-[13px] leading-[1.65] text-muted-foreground/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {text}
            </div>
          ) : null}
          {groups.map((group, index) => (
            renderChildGroup
              ? renderChildGroup(group, `subagent-child-${index}`, {
                isStreaming: isStreaming && !settled,
                hasFollowingVisibleContent: settled,
              })
              : null
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export default memo(SubAgentLine);
