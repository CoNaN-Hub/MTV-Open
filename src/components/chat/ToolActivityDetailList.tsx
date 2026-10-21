/**
 * ToolActivityDetailList —— 官方 `hie`（displayName `ToolActivityDetailList`，live bundle 偏移 2405250）1:1 复刻。
 *
 * 官方逐字：
 * ```js
 * const h_ = 8;
 * hie = memo(({items, continuingCallId = ""}) => {
 *   const {t} = se();
 *   const nodeLookup = useStore(s => s.nodeLookup);
 *   const rows = useMemo(() => oie(items), [items]);           // 按 tool_call_id 去重
 *   const olRef = useRef(null);
 *   const scrollable = rows.length > h_;                       // 超过 8 条
 *   const [overflowBottom, setOverflowBottom] = useState(false);
 *   // 写 CSS 变量 --tool-activity-viewport-height（第 8 个子元素 offsetTop + offsetHeight/2）
 *   // 滚动时 overflowBottom = scrollTop + clientHeight < scrollHeight - 1
 *   // useLayoutEffect: 初次执行两者；scrollable 且支持 ResizeObserver 时观察前 8 个子元素
 *   return <div className="relative max-w-[min(640px,100%)]" data-tool-activity-viewport="">
 *     <ol ref={olRef} onScroll={onScrollRef}
 *         className={cx("flex w-full flex-col gap-1 py-0.5 text-[13px] leading-[1.65] text-muted-foreground/60",
 *                       scrollable && "h-[var(--tool-activity-viewport-height,13.875rem)] overflow-y-auto overscroll-contain pr-1 scroll-smooth [scrollbar-color:color-mix(in_srgb,var(--foreground)_22%,transparent)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]")}
 *         data-tool-activity-list=""
 *         data-tool-activity-scroll-region={scrollable ? "true" : undefined}
 *         data-tool-activity-overflow-fade={overflowBottom ? "bottom" : undefined}
 *         data-tool-activity-visible-limit={scrollable ? 8 : undefined}>
 *       {rows.map((item, index) => {
 *         const tool = yi(item); const status = String(item.content.status ?? "");
 *         const selfActive = status === "pending" || status === "started";
 *         const id = Fx(item);
 *         const active = selfActive || (!!continuingCallId && id === continuingCallId);
 *         const label = Sg([item], active, t);
 *         const description = eie(item);     // request.description || response.description
 *         const showDescription = !isFileRow && !Jm(tool) && !!description
 *                                 && !label.displayText.toLowerCase().includes(description.toLowerCase());
 *         const nodeIds = wot([item]);
 *         const chips = label.labelInput.kind === "viewMedia" ? nodeIds.filter(n => nodeLookup.has(n)) : nodeIds;
 *         return <li aria-current={active ? "step" : undefined} className="min-w-0 py-0.5"
 *                    data-tool-activity-item=""
 *                    data-tool-activity-status={active ? "active" : (status || "unknown")}
 *                    data-tool-activity-tool={tool} key={id || `${tool || "tool"}-${index}`}>
 *           <div className="flex min-w-0 items-center gap-2">
 *             <label.LeadingIcon aria-hidden="true"
 *               className={cx("size-4 shrink-0", active ? "tool-call-status-icon-active text-muted-foreground/80"
 *                                                        : "text-muted-foreground/55")} strokeWidth={1.8}/>
 *             {isFileRow ? <fie fileName kind={label.labelInput.kind === "edit" ? "edit" : "exploration"} isActive={active}/>
 *                        : <span className={cx("min-w-0 truncate", active ? "text-muted-foreground/90" : "text-muted-foreground/65")}>
 *                            {label.displayText}
 *                            {showDescription && <span className="text-muted-foreground/45">{" · "}{description}</span>}
 *                          </span>}
 *           </div>
 *           {!active && chips.length > 0 && <div className="flex flex-wrap items-center gap-1.5 pt-1 pl-6">
 *             {chips.map(nodeId => <DF nodeId={nodeId} tool={tool || "tool"} key={nodeId}/>)}
 *           </div>}
 *           // 官方 `DF` = `NodeLinkChip`（`displayName="NodeLink"`，canvas @2413267）
 *         </li>;
 *       })}
 *     </ol>
 *     {overflowBottom && <div aria-hidden="true"
 *       className="pointer-events-none absolute right-3 bottom-0 left-0 z-[1] h-16 bg-gradient-to-b from-transparent via-chat-background/75 to-chat-background"
 *       data-tool-activity-fade-overlay=""/>}
 *   </div>;
 * });
 * ```
 *
 * ⚠️ MTV 侧剩余差异（已在 `agent-挖掘覆盖表.md` 记录）：
 *   1. `DF`（画布节点 chip，官方 `NodeLink`）—— **已按官方落地**（见 `NodeLinkChip.tsx`）：
 *      `nodeIds = wot([item])`（官方，逐字见 `services/chat/toolEventNodeIds.ts`），
 *      `chips = kind === "viewMedia" ? nodeIds.filter(n => nodeLookup.has(n)) : nodeIds`，
 *      行本体 `<div className="flex flex-wrap items-center gap-1.5 pt-1 pl-6">` 逐字。
 *      官方 `nodeLookup` 是 React Flow 的 store ⇒ MTV 改用 `useAppStore(s => s.nodes)` 的 id 集合
 *      （聊天面板不在 `ReactFlowProvider` 内，见 `NodeLinkChip.tsx` 的适配点说明）。
 *      官方在没有节点 id（或 viewMedia 且节点不在画布上）时同样不渲染该行 —— 自然退化。
 *   2. `fie`（`ToolCallFileRow`，`data-tool-file-row` 的文件名按钮）—— **本轮已按官方落地**
 *      （见 `ToolCallFileRow.tsx`）：`fileName = trim(content.request.file_name)`（官方 `_ot`+`bb`），
 *      `kind ∈ {edit, exploration}`，点击走可注入的 `onOpenFile`
 *      （官方是 store 动作 `requestWorkspaceFile`，MTV 侧无此动作 ⇒ 未注入时点击无副作用、DOM 与官方一致）。
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getLocale } from '../../i18n';
import { agentToolLineLabel, agentToolLineText, humanizeToolLineText, type ToolEventLike } from '../../services/chat/agentToolLabels';
import { toolEventNodeIds } from '../../services/chat/toolEventNodeIds';
import { useAppStore } from '../../store/useAppStore';
import { TOOL_KIND_ICONS } from './agentToolIcons';
import NodeLinkChip from './NodeLinkChip';
import ToolPublicResult from './ToolPublicResult';
import { OFFICIAL_SKIP_TEXTS } from '../../services/chat/toolPublicResult';
import ToolCallFileRow from './ToolCallFileRow';
/** 官方 `h_ = 8`：超过 8 条时启用滚动视口。 */
const VISIBLE_LIMIT = 8;
/** 官方 `Jm = Kv`：这些工具名不显示 description 后缀。 */
const NO_DESCRIPTION_TOOLS = new Set(['bash', 'tapnow_cli']);

function toolNameOf(item: ToolEventLike): string {
  const content = item.content;
  if (!content || typeof content !== 'object') return '';
  const tool = (content as { tool?: unknown }).tool;
  return String(tool ?? '').trim().toLowerCase();
}

function statusOf(item: ToolEventLike): string {
  const content = item.content;
  if (!content || typeof content !== 'object') return '';
  return String((content as { status?: unknown }).status ?? '');
}

/** 官方 `Fx(it)`：工具调用 id。 */
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

/** 官方 `UM(o)`。 */
function descriptionOf(record: unknown): string {
  if (!record || typeof record !== 'object') return '';
  const value = (record as { description?: unknown }).description;
  return typeof value === 'string' ? value.trim() : '';
}

/** 官方 `eie(it)` = `request.description || response.description`。 */
function itemDescription(item: ToolEventLike): string {
  const content = item.content;
  if (!content || typeof content !== 'object') return '';
  const record = content as { request?: unknown; response?: unknown };
  return descriptionOf(record.request) || descriptionOf(record.response);
}

/** 官方 `bb(o, keys)`：取第一个「字符串且 trim 后非空」的值并 trim。 */
function firstNonEmptyString(record: unknown, keys: readonly string[]): string {
  if (!record || typeof record !== 'object') return '';
  for (const key of keys) {
    const value = (record as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** 官方 `_ot(content)`：`content.request` 非对象 ⇒ `""`，否则 `bb(request, ["file_name"])`。 */
function workspaceFileNameOf(item: ToolEventLike): string {
  const content = item.content;
  if (!content || typeof content !== 'object') return '';
  return firstNonEmptyString((content as { request?: unknown }).request, ['file_name']);
}

export interface ToolActivityDetailListProps {
  items: readonly ToolEventLike[];
  /** 官方 `continuingCallId`：`keepTerminalToolActive` 生效时最后一条的 id。 */
  continuingCallId?: string;
  /** 官方 store 动作 `requestWorkspaceFile(fileName)` 的 MTV 侧替身（见 `ToolCallFileRow`）。 */
  onOpenFile?: (fileName: string) => void;
  /**
   * 官方 `DF` 里 `Ac().fitView` 的 MTV 侧替身（画布定位到节点）。
   * 不注入时 `NodeLinkChip` 走现成的 `canvas-focus-nodes` 事件通道，见 `NodeLinkChip.tsx`。
   */
  onFocusNode?: (nodeId: string) => void;
}

function ToolActivityDetailList({ items, continuingCallId = '', onOpenFile, onFocusNode }: ToolActivityDetailListProps) {
  const locale = getLocale();
  const rows = items;
  /* 官方 `hie` 里 `const nodeLookup = useStore(s => s.nodeLookup)`：
     `chips` 的 viewMedia 分支要 `nodeLookup.has(id)`。MTV 的画布节点表在 app store 里
     （聊天面板不在 `ReactFlowProvider` 内），这里只取 id 集合。 */
  const canvasNodes = useAppStore((state) => state.nodes);
  const canvasNodeIds = useMemo(() => new Set(canvasNodes.map((node) => node.id)), [canvasNodes]);
  const listRef = useRef<HTMLOListElement | null>(null);
  const scrollable = rows.length > VISIBLE_LIMIT;
  const [overflowBottom, setOverflowBottom] = useState(false);

  /* 官方 `u()`：把第 8 个子元素的中线写成 `--tool-activity-viewport-height`。 */
  const syncViewportHeight = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    if (!scrollable) { list.style.removeProperty('--tool-activity-viewport-height'); return; }
    const target = list.children[VISIBLE_LIMIT - 1] as HTMLElement | undefined;
    if (!target) return;
    list.style.setProperty('--tool-activity-viewport-height', `${target.offsetTop + target.offsetHeight / 2}px`);
  }, [scrollable]);

  /* 官方 `p()`：底部是否还有内容（决定渐变遮罩）。 */
  const syncOverflowFade = useCallback(() => {
    const list = listRef.current;
    if (!list || !scrollable) { setOverflowBottom(false); return; }
    setOverflowBottom(list.scrollTop + list.clientHeight < list.scrollHeight - 1);
  }, [scrollable]);

  useLayoutEffect(() => {
    syncViewportHeight();
    syncOverflowFade();
  }, [rows.length, scrollable, syncOverflowFade, syncViewportHeight]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !scrollable || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => { syncViewportHeight(); syncOverflowFade(); });
    Array.from(list.children).slice(0, VISIBLE_LIMIT).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [rows.length, scrollable, syncOverflowFade, syncViewportHeight]);

  const listClass = `flex w-full flex-col gap-1 py-0.5 text-[13px] leading-[1.65] text-muted-foreground/60${scrollable
    ? ' h-[var(--tool-activity-viewport-height,13.875rem)] overflow-y-auto overscroll-contain pr-1 scroll-smooth [scrollbar-color:color-mix(in_srgb,var(--foreground)_22%,transparent)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]'
    : ''}`;

  return (
    <div className="relative max-w-[min(640px,100%)]" data-tool-activity-viewport="">
      <ol
        ref={listRef}
        onScroll={syncOverflowFade}
        className={listClass}
        data-tool-activity-list=""
        data-tool-activity-scroll-region={scrollable ? 'true' : undefined}
        data-tool-activity-overflow-fade={overflowBottom ? 'bottom' : undefined}
        data-tool-activity-visible-limit={scrollable ? VISIBLE_LIMIT : undefined}
      >
        {rows.map((item, index) => {
          const tool = toolNameOf(item);
          const status = statusOf(item);
          const id = callIdOf(item);
          const active = status === 'pending' || status === 'started'
            || (!!continuingCallId && id === continuingCallId);
          const label = agentToolLineLabel([item], active);
          const displayText = humanizeToolLineText(agentToolLineText(label, locale), active);
          const description = itemDescription(item);
          /* 官方 `w = _ot(h)`、`C = !!w && (labelInput.kind === "edit" || labelInput.kind === "exploration")`
             ⇒ 渲染 `fie` 文件行。（MTV 把官方 `labelInput.kind` 拍平成了 `label.kind`。） */
          const fileName = workspaceFileNameOf(item);
          const isFileRow = !!fileName
            && (label.kind === 'edit' || label.kind === 'exploration');
          /* 官方 `T = !C && !Jm(tool) && !!desc && !displayText.includes(desc)`。 */
          const showDescription = !isFileRow && !NO_DESCRIPTION_TOOLS.has(tool) && !!description
            && !displayText.toLowerCase().includes(description.toLowerCase());
          const LeadingIcon = TOOL_KIND_ICONS[label.kind];
          /* 官方 `const nodeIds = wot([item])`；`chips = labelInput.kind === "viewMedia"
             ? nodeIds.filter(n => nodeLookup.has(n)) : nodeIds`。 */
          const nodeIds = toolEventNodeIds([item]);
          const chips = label.kind === 'viewMedia'
            ? nodeIds.filter((nodeId) => canvasNodeIds.has(nodeId))
            : nodeIds;
          return (
            <li
              key={id || `${tool || 'tool'}-${index}`}
              aria-current={active ? 'step' : undefined}
              className="min-w-0 py-0.5"
              data-tool-activity-item=""
              data-tool-activity-status={active ? 'active' : (status || 'unknown')}
              data-tool-activity-tool={tool}
            >
              <div className="flex min-w-0 items-center gap-2">
                <LeadingIcon
                  aria-hidden
                  strokeWidth={1.8}
                  className={`size-4 shrink-0 ${active ? 'tool-call-status-icon-active text-muted-foreground/80' : 'text-muted-foreground/55'}`}
                />
                {isFileRow ? (
                  /* 官方 `C ? <fie fileName kind={kind === "edit" ? "edit" : "exploration"} isActive={active}/> : <span …>`。 */
                  <ToolCallFileRow
                    fileName={fileName}
                    kind={label.kind === 'edit' ? 'edit' : 'exploration'}
                    isActive={active}
                    onOpenFile={onOpenFile}
                  />
                ) : (
                  <span className={`min-w-0 truncate ${active ? 'text-muted-foreground/90' : 'text-muted-foreground/65'}`}>
                    {displayText}
                    {showDescription ? <span className="text-muted-foreground/45">{' · '}{description}</span> : null}
                  </span>
                )}
              </div>
              {/* 官方**新版**（`vendor-pkg-canvas-CvbAwZyy.js` @2447495）在这一行里插了
                  `o ? <TT payload={g} hideErrors omitTexts={[label.displayText, description, ...Mae]}/> : null`，
                  位置就在 chips 行**之前**。MTV 用同源组件 `ToolPublicResult`（逐字移植）。 */}
              <ToolPublicResult
                payload={item.content}
                hideErrors
                omitTexts={[displayText, description, isFileRow ? fileName : '', ...OFFICIAL_SKIP_TEXTS]}
              />
              {!active && chips.length > 0 ? (
                /* 官方逐字：`<div className="flex flex-wrap items-center gap-1.5 pt-1 pl-6">` + `DF` 列表。 */
                <div className="flex flex-wrap items-center gap-1.5 pt-1 pl-6">
                  {chips.map((nodeId) => (
                    <NodeLinkChip nodeId={nodeId} tool={tool || 'tool'} key={nodeId} onFocusNode={onFocusNode} />
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {overflowBottom ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-3 bottom-0 left-0 z-[1] h-16 bg-gradient-to-b from-transparent via-chat-background/75 to-chat-background"
          data-tool-activity-fade-overlay=""
        />
      ) : null}
    </div>
  );
}

export default memo(ToolActivityDetailList);
