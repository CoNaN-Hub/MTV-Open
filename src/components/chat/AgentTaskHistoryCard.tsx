/**
 * 官方「任务历史卡」—— `page-BeI7xydN.js`@857279 的 `Nde` 逐字。
 *
 * 结构：
 *   `<Collapsible class="my-1.5 overflow-hidden rounded-lg border border-border/50 bg-chat-bubble-surface"
 *                 data-testid="task-history-card">`
 *     `<CollapsibleTrigger class="flex w-full items-center justify-between gap-3 px-3.5 py-2.5
 *        text-[13px] leading-5 font-medium text-chat-foreground transition-colors hover:bg-accent/40
 *        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset">`
 *       `<span class="min-w-0 truncate">{全完成 ? todoQueue.allCompleted : todoQueue.summary}</span>`
 *       `<ChevronDown size=14 stroke=1.5 class="shrink-0 text-chat-foreground/70 transition-transform
 *          {open && rotate-180}" />`
 *     `</CollapsibleTrigger>`
 *     `<CollapsibleContent class="overflow-hidden data-[state=open]:animate-collapsible-down
 *        data-[state=closed]:animate-collapsible-up">`
 *       `{items.length > 8 ? <ScrollArea class="border-t border-border/40
 *            [&>[data-radix-scroll-area-viewport]]:!h-auto
 *            [&>[data-radix-scroll-area-viewport]]:max-h-80"><TaskProgressList comfortable class="gap-3 px-3.5 py-3"/></ScrollArea>
 *          : <div class="border-t border-border/40"><TaskProgressList comfortable class="gap-3 px-3.5 py-3"/></div>}`
 *     `</CollapsibleContent>`
 *   `</Collapsible>`
 *
 * 常量（同址）：`Ede = 8`（超过 8 条才套滚动区）；初始展开态 `useState(!isAllCompleted)`。
 * 显示条件：`snapshot.plan_ready === true` 且列表非空（见 `todoSnapshotItems`）。
 */
import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { getLocale, useT } from '../../i18n';
import { todoProgress, todoQueueText, type TodoItem } from '../../services/chat/todoTasks';
import { OfficialChevronDownIcon } from './officialIcons';
import { TaskProgressList } from './AgentTaskProgressList';
import OfficialScrollArea from './OfficialScrollArea';

/** 官方 `Ede`：超过这个条数才套 `max-h-80` 的滚动区。 */
export const TASK_HISTORY_SCROLL_THRESHOLD = 8;

export default function AgentTaskHistoryCard({
  items,
  className,
}: {
  items: TodoItem[];
  className?: string;
}) {
  useT();
  const locale = getLocale();
  const progress = todoProgress(items);
  const isAllCompleted = progress.total > 0 && progress.completed === progress.total;
  const [open, setOpen] = useState(!isAllCompleted);
  const summary = isAllCompleted
    ? todoQueueText('allCompleted', locale, { count: progress.total, total: progress.total }, progress.total)
    : todoQueueText(
        'summary',
        locale,
        { count: progress.total, completed: progress.completed, total: progress.total },
        progress.total,
      );

  if (items.length === 0) return null;

  const list = (
    <TaskProgressList className="gap-3 px-3.5 py-3" comfortable items={items} showDetails showIndex />
  );

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={[
        'my-1.5 overflow-hidden rounded-lg border border-border/50 bg-chat-bubble-surface',
        className ?? '',
      ]
        .join(' ')
        .trim()}
      data-testid="task-history-card"
    >
      <Collapsible.Trigger
        className={[
          'flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] leading-5 font-medium',
          'text-chat-foreground',
          'transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-primary/60 focus-visible:ring-inset',
        ].join(' ')}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <OfficialChevronDownIcon
          size={14}
          strokeWidth={1.5}
          className={['shrink-0 text-chat-foreground/70 transition-transform', open ? 'rotate-180' : '']
            .filter(Boolean)
            .join(' ')}
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        {items.length > TASK_HISTORY_SCROLL_THRESHOLD ? (
          /* 官方 `Ni`（Radix ScrollArea）+ 任意变体覆盖 viewport：`!h-auto` + `max-h-80`。 */
          <OfficialScrollArea className="border-t border-border/40 [&>[data-radix-scroll-area-viewport]]:!h-auto [&>[data-radix-scroll-area-viewport]]:max-h-80">
            {list}
          </OfficialScrollArea>
        ) : (
          <div className="border-t border-border/40">{list}</div>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
