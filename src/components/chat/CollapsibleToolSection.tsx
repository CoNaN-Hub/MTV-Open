/**
 * CollapsibleToolSection —— 官方 `kh`（`page-BeI7xydN.js@691xxx`）1:1 复刻。
 *
 * 官方原文要点（逐字核对）：
 * ```js
 * kh = memo(({items, isStreaming, hasFollowingVisibleContent = false, keepTerminalToolActive = false,
 *             collapseAsStepsSummary = true, suppressWebSearchSources = false, showCardIndex = false}) => {
 *   const visible = useMemo(() => { const set = Tw(items); return items.filter(x => !jw(x) && !Rw(x, set)); }, [items]);
 *   const blocks  = useMemo(() => pL(visible), [visible]);          // subagent 块 / 普通桶（`gS` 连续分组）
 *   const collapse = collapseAsStepsSummary && !isStreaming && hasFollowingVisibleContent && blocks.length > 0;
 *   const suppress = suppressWebSearchSources || collapse;
 *   const durationMs = useMemo(() => (collapse ? hx(visible) : null), [collapse, visible]);
 *   const nodes = blocks.map((block, i) => block.kind === 'subagent'
 *     ? <FL agent={block.agent} childItems={block.children} isStreaming hasFollowingVisibleContent
 *           suppressWebSearchSources={suppress} key={`subagent-${ld(block.agent) || i}`} />
 *     : <px items={block.items} isStreaming hasFollowingVisibleContent
 *           hasFollowingToolLine={i < blocks.length - 1}
 *           keepTerminalToolActive={keepTerminalToolActive && i === blocks.length - 1 && !hasFollowingVisibleContent}
 *           suppressWebSearchSources={suppress} showCardIndex={showCardIndex} key={`${ux(block.items[0]) || 'tool-line'}-${i}`} />);
 *   const list = <div className="flex w-full min-w-0 flex-col gap-1.5">{nodes}</div>;
 *   return collapse
 *     ? <div className="flex w-full min-w-0 flex-col gap-1.5">
 *         <vS durationMs={durationMs}>{list}</vS>
 *         <xS items={visible} isStreaming hasFollowingVisibleContent showCardIndex={showCardIndex} />
 *       </div>
 *     : list;
 * });
 * ```
 * ⚠️ 两处 MTV 等价处理（官方语义不变）：
 *   1. `Tw`/`jw`/`Rw` 是官方**联网搜索来源**的去重/过滤（`Tw` 收集 source id、`jw` 判是否来源项、
 *      `Rw` 判是否已被别的项覆盖）。MTV 的工具事件里没有官方那套 web 搜索 payload ⇒ 这三个是
 *      **恒等**（不过滤），已在调用方以默认值注入，行为与「没有来源项」时的官方完全一致。
 *   2. `pL`/`tV` 的「subagent 块」在 MTV 侧来自**子任务**（`task.parentTaskId`），由调用方在
 *      `blocks` 里给出（本组件只负责按官方结构渲染），避免把 MTV 的任务模型硬塞进官方事件模型。
 */
import { memo, useMemo } from 'react';
import AgentToolLine from './AgentToolLine';
import AgentStepsSection from './AgentStepsSection';
import SubAgentLine from './SubAgentLine';
import { pendingGenerationConfirmationKey } from './confirmationEventDispatch';
import type { ToolEventLike } from '../../services/chat/agentToolLabels';

export interface ToolSectionBlock {
  kind: 'subagent' | 'items';
  /** `kind === 'subagent'` 时是子代理的发起事件。 */
  agent?: ToolEventLike;
  /** `kind === 'subagent'` 时的子项。 */
  children?: readonly ToolEventLike[];
  /** `kind === 'items'` 时的工具项（已按官方 `gS` 连续分组）。 */
  items?: readonly ToolEventLike[];
}

export interface CollapsibleToolSectionProps {
  blocks: readonly ToolSectionBlock[];
  /** 官方 `hx(items)`：折叠摘要里显示的时长（ms）。 */
  durationMs?: number | null;
  isStreaming: boolean;
  hasFollowingVisibleContent?: boolean;
  keepTerminalToolActive?: boolean;
  collapseAsStepsSummary?: boolean;
  /** 官方 `showCardIndex`：只影响 `xS`（联网搜索来源卡）的编号；MTV 无该数据源 ⇒ 由调用方的 `renderSources` 负责。 */
  showCardIndex?: boolean;
  /** 官方 `xS`（联网搜索来源卡）的渲染位；MTV 无此数据源时传 null。 */
  renderSources?: React.ReactNode;
}

function CollapsibleToolSection({
  blocks,
  durationMs = null,
  isStreaming,
  hasFollowingVisibleContent = false,
  keepTerminalToolActive = false,
  collapseAsStepsSummary = true,
  showCardIndex = false,
  renderSources = null,
}: CollapsibleToolSectionProps) {
  const collapse = collapseAsStepsSummary && !isStreaming && hasFollowingVisibleContent && blocks.length > 0;
  /**
   * round 118（**用户 2026-10-15 追加裁决**）：这一节里**待决**的生成确认卡 ⇒ 折叠时自动展开。
   * 这是 **MTV 自有增强**（官方 `vS`(`EO`) 无此行为）；规则与「不许按官方没有就删掉」的说明见
   * `AgentStepsSection.pendingConfirmationKey`。
   * ⚠️ 同处那条注释里的 **round 118 实测更正**同样适用：当前渲染器下确认卡是独立 `cards` 段、
   * **不会**落进本节 ⇒ 这条是**不变量守卫**（今天恒满足），不是「可发现性」的修复点。
   * 键来自与读侧同源的 `confirmationEventDispatch.pendingGenerationConfirmationKey`。
   */
  const pendingKey = useMemo(() => pendingGenerationConfirmationKey(
    blocks.flatMap((block) => (
      block.kind === 'items'
        ? [...(block.items ?? [])]
        : [block.agent, ...(block.children ?? [])].filter(Boolean) as ToolEventLike[]
    )),
  ), [blocks]);
  /* 官方 `AC`(live 偏移 2435781) 的 DOM：`div.flex w-full min-w-0 flex-col gap-1.5` > 各行。
     MTV 早前多包了一层 `div.w-full.min-w-0[data-agent-activity-block]`，live 实测**没有**该层与属性
     （官方只在 `PE` 有来源卡时才自己多包一层 `div.flex w-full min-w-0 flex-col gap-1.5`）。 */
  const list = useMemo(() => (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      {blocks.map((block, index) => {
        if (block.kind === 'subagent' && block.agent) {
          return (
            <SubAgentLine
              key={`subagent-${index}`}
              agent={block.agent}
              childItems={block.children ?? []}
              isStreaming={isStreaming}
              hasFollowingVisibleContent={hasFollowingVisibleContent}
              suppressWebSearchSources={collapse}
              renderChildGroup={(items, key, childProps) => (
                <AgentToolLine
                  key={key}
                  items={items}
                  isStreaming={childProps.isStreaming}
                  hasFollowingVisibleContent={childProps.hasFollowingVisibleContent}
                  showCardIndex={showCardIndex}
                />
              )}
            />
          );
        }
        return (
          <AgentToolLine
            key={`tool-line-${index}`}
            items={block.items ?? []}
            isStreaming={isStreaming}
            hasFollowingVisibleContent={hasFollowingVisibleContent}
            hasFollowingToolLine={index < blocks.length - 1}
            keepTerminalToolActive={keepTerminalToolActive && index === blocks.length - 1 && !hasFollowingVisibleContent}
            suppressWebSearchSources={collapse}
            showCardIndex={showCardIndex}
          />
        );
      })}
    </div>
  ), [blocks, collapse, hasFollowingVisibleContent, isStreaming, keepTerminalToolActive, showCardIndex]);

  if (!collapse) return list;
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <AgentStepsSection durationMs={durationMs} autoCollapse pendingConfirmationKey={pendingKey}>{list}</AgentStepsSection>
      {renderSources}
    </div>
  );
}

export default memo(CollapsibleToolSection);
