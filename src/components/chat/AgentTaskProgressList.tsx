/**
 * 官方「任务进度」列表与进度环 —— `page-BeI7xydN.js`@853600 一带逐字。
 *
 *   `Aue` → `TodoProgressRing`      18×18 SVG 进度环（全完成时换成对勾）
 *   `Sde` → `TaskProgressList`      官方 `ES`（`l.memo(Sde)`，displayName `TaskProgressList`）
 *   `Cde` → `TaskProgressRow`       官方 `gO`（`l.memo(Cde)`，displayName `TaskProgressRow`）
 *
 * 常量（同址）：`hI=18`（环尺寸）· `iv=7`（半径）· `mI=2π·7`（周长）.
 */
import { memo } from 'react';
import {
  isTodoCompleted,
  isTodoInProgress,
  todoStatusClass,
  type TodoItem,
} from '../../services/chat/todoTasks';
import {
  OfficialCircleIcon,
  OfficialLoader2Icon,
  OfficialTablerCheckIcon,
} from './officialIcons';

/** 官方 `hI`：进度环 SVG 尺寸。 */
const RING_SIZE = 18;
/** 官方 `iv`：进度环半径。 */
const RING_RADIUS = 7;
/** 官方 `mI`：进度环周长。 */
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * 官方 `Aue`：任务进度环。
 * 全完成 ⇒ 换成对勾（`Dr` size 16 stroke 2.5）；否则画轨道 + 进度弧（`-rotate-90` 起画）。
 */
export function TodoProgressRing({
  current,
  total,
  label,
  isAllCompleted,
}: {
  current: number;
  total: number;
  label: string;
  isAllCompleted: boolean;
}) {
  const progress = total > 0 ? Math.min(current / total, 1) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  return (
    <span
      aria-label={label}
      aria-valuemax={total}
      aria-valuemin={0}
      aria-valuenow={current}
      className="relative flex size-[18px] shrink-0 items-center justify-center text-foreground"
      role="progressbar"
    >
      {isAllCompleted ? (
        <OfficialTablerCheckIcon aria-hidden size={16} strokeWidth={2.5} className="text-chat-foreground" />
      ) : (
        <svg aria-hidden className="-rotate-90" height={RING_SIZE} viewBox="0 0 18 18" width={RING_SIZE}>
          <circle className="stroke-foreground/20" cx="9" cy="9" fill="none" r={RING_RADIUS} strokeWidth="1.75" />
          <circle
            className={`stroke-current transition-[stroke-dashoffset,opacity] duration-500 ease-out motion-reduce:transition-none ${progress > 0 ? 'opacity-100' : 'opacity-0'}`}
            cx="9"
            cy="9"
            fill="none"
            r={RING_RADIUS}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
      )}
    </span>
  );
}

/** 官方 `Cde`：单条任务。 */
const TaskProgressRow = memo(function TaskProgressRow({
  index,
  item,
  showDetails,
  showIndex,
  comfortable,
}: {
  index: number;
  item: TodoItem;
  showDetails: boolean;
  showIndex: boolean;
  comfortable: boolean;
}) {
  const { iconClassName, textClassName } = todoStatusClass(item.status);
  const completed = isTodoCompleted(item.status);
  const inProgress = isTodoInProgress(item.status);
  const hasDetails = !!(showDetails && (item.description || (inProgress && item.activeForm)));
  const iconSize = comfortable ? 14 : 13;
  return (
    <li
      className={[
        'flex gap-2',
        hasDetails ? 'items-start' : 'items-center',
        comfortable ? 'text-[13px] leading-[18px]' : 'text-xs leading-4',
      ].join(' ')}
    >
      <span
        className={[
          'flex shrink-0 items-center justify-center',
          comfortable ? 'size-4' : 'size-3.5',
          hasDetails ? 'mt-0.5' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {completed ? (
          <OfficialTablerCheckIcon size={iconSize} strokeWidth={1.5} className={iconClassName} />
        ) : inProgress ? (
          <OfficialLoader2Icon size={iconSize} strokeWidth={1.5} className={iconClassName} />
        ) : (
          <OfficialCircleIcon size={iconSize} strokeWidth={1.5} className={iconClassName} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={[
            'block break-words',
            textClassName,
            showDetails && !inProgress ? 'text-chat-foreground' : '',
            comfortable ? (inProgress ? 'font-medium' : 'font-normal') : 'font-medium',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {showIndex ? `${index + 1}. ` : ''}
          {item.content}
        </span>
        {showDetails && item.description ? (
          <span className="mt-1 block line-clamp-2 break-words text-xs leading-5 text-secondary-muted-foreground">
            {item.description}
          </span>
        ) : null}
        {showDetails && inProgress && item.activeForm ? (
          <span className="mt-1 block break-words text-xs leading-5 text-chat-foreground">{item.activeForm}</span>
        ) : null}
      </span>
    </li>
  );
});

/** 官方 `Sde`（`ES`）：任务列表。 */
export const TaskProgressList = memo(function TaskProgressList({
  items,
  className,
  showDetails = true,
  showIndex = true,
  comfortable = false,
}: {
  items: TodoItem[];
  className?: string;
  showDetails?: boolean;
  showIndex?: boolean;
  comfortable?: boolean;
}) {
  return (
    <ul className={['flex flex-col', comfortable ? 'gap-2.5' : 'gap-3', className ?? ''].join(' ').trim()}>
      {items.map((item, index) => (
        <TaskProgressRow
          key={`${item.taskId ?? item.content}-${item.status ?? 'unknown'}-${index}`}
          comfortable={comfortable}
          index={index}
          item={item}
          showDetails={showDetails}
          showIndex={showIndex}
        />
      ))}
    </ul>
  );
});
