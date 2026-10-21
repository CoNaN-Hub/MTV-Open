/**
 * 官方「待办胶囊 / TodoQueueSheet」—— `page-BeI7xydN.js`@911500 的 `Tue`（`AO = memo(Tue)`，
 * `displayName="TodoQueueSheet"`）逐字。
 *
 * 官方结构（`activeTodo` = 快照 `{items, progress, digest, allCompleted}`）：
 *   `<AnimatePresence onExitComplete>`
 *     `<motion.div className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center"
 *         data-task-mode-active-capsule="true"
 *         initial={{opacity:0,y:8,scale:.98}} animate={{opacity:1,y:0,scale:1}}
 *         exit={{opacity:0,y:8,scale:.98,transition:seg}} transition={enter}
 *         style={{paddingBottom:12, transformOrigin:'bottom center'}}>`
 *       `<motion.div animate={{borderRadius: open ? 16 : 22, width: open ? Math.max(K, width ?? 0) : 'max-content'}}
 *           className="pointer-events-auto flex min-w-0 max-w-[calc(100%_-_2rem)] flex-col-reverse overflow-hidden
 *                      border border-border bg-chat-bubble-surface shadow-lg"
 *           style={{originX:.5, originY:1}} transition={seg}
 *           onMouseEnter onMouseLeave onBlurCapture onFocusCapture onKeyDown>`
 *         `<button ref={buttonRef} aria-controls={listId} aria-expanded={open} aria-label={`${summary}: ${current?.content ?? ''}`}
 *             className="flex h-11 w-max min-w-0 max-w-full shrink-0 items-center gap-2.5 rounded-[inherit] pl-3.5 pr-6 text-xs
 *                        hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40
 *                        focus-visible:ring-inset" onClick={() => setDismissed(open)}>`
 *           `<TodoProgressRing current={completed} total={progress.total} label={progressLabel} isAllCompleted={allCompleted}/>`
 *           `<span className={open? 'font-medium text-chat-foreground':'text-secondary-muted-foreground'}>{progressLabel}</span>`
 *           `{current?.content && <><span className="size-1 rounded-full bg-foreground/25"/><StaggeredTaskTitle text={current.content}/></>}`
 *         `</button>`
 *         `<motion.section id={listId} aria-hidden={!open} animate={{height: open ? expandedHeight : 0, opacity: open ? 1 : 0}}
 *             className="overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset
 *                        focus-visible:ring-foreground/40" data-task-mode-task-list="true" tabIndex={open ? 0 : -1}
 *             transition={seg}>`
 *           `<div ref={listRef}><TaskProgressList className="px-4 py-3.5" comfortable items={items} showDetails={false} showIndex={false}/></div>`
 *         `</motion.section>`
 *
 * 常量（同址逐字）：`pI=12`（胶囊与输入卡的间距，也是 `paddingBottom`）· `Sue=44`（按钮高 `h-11`）
 * · `Cue=64`、`gI=320`（展开宽度 `min(320, innerWidth-64)`）· `Eue=80`（移出后收起延迟）
 * · `kue=320`（展开列表 `max-h`）· `Nue`={spring 420/34/.82} · `Iue`={duration:.14, ease:[.16,1,.3,1]}
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getLocale } from '../../i18n';
import { todoQueueText, type TodoItem, type TodoSnapshot } from '../../services/chat/todoTasks';
import { TodoProgressRing, TaskProgressList } from './AgentTaskProgressList';

/** 官方 `pI`：胶囊与输入卡的间距（也是 `paddingBottom`）。 */
const CAPSULE_GAP = 12;
/** 官方 `Sue`：按钮高度 `h-11`。 */
const CAPSULE_BUTTON_HEIGHT = 44;
/** 官方 `Cue` / `gI`：展开宽度 = `min(320, innerWidth − 64)`。 */
const CAPSULE_VIEWPORT_INSET = 64;
const CAPSULE_MAX_WIDTH = 320;
/** 官方 `Eue`：鼠标移出后收起延迟（ms）。 */
const COLLAPSE_DELAY = 80;
/** 官方 `kue`：展开列表的 `max-h`。 */
const CAPSULE_LIST_MAX_HEIGHT = 320;
/** 官方 `Nue`：进场 spring。 */
const ENTER_TRANSITION = { type: 'spring', stiffness: 420, damping: 34, mass: 0.82 } as const;
/** 官方 `Iue`：各段过渡。 */
const SEGMENT_TRANSITION = { duration: 0.14, ease: [0.16, 1, 0.3, 1] } as const;
/** 官方 `bg-[length:...]` 之外，标题逐字淡入的节奏（`kO` = `StaggeredTaskTitle`）。 */
const STAGGER_STEP = 0.018;
const STAGGER_MAX_INDEX = 22;
const STAGGER_EASE = [0.16, 1, 0.3, 1] as const;

/** 官方 `kO`（`StaggeredTaskTitle`）：逐字淡入 + 上移。 */
function StaggeredTaskTitle({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  const chars = Array.from(text);
  return (
    <span className={`min-w-0 overflow-hidden ${className ?? ''}`}>
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={text}
          className="inline-flex max-w-full whitespace-nowrap"
          exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.08 } }}
        >
          {chars.map((char, index) => (
            <motion.span
              key={`${text}-${index}`}
              animate={{ opacity: 1, y: 0 }}
              className="inline-block"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 0.14, delay: Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP, ease: STAGGER_EASE }
              }
            >
              {char === ' ' ? '\u00a0' : char}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default function TodoQueueSheet({
  visible,
  activeTodo,
  onHeightChange,
}: {
  visible: boolean;
  activeTodo: TodoSnapshot | null;
  onHeightChange?: (height: number) => void;
}) {
  const locale = getLocale();
  const reduced = useReducedMotion();
  const listId = useId();
  const enterTransition = reduced ? { duration: 0 } : ENTER_TRANSITION;
  const segmentTransition = reduced ? { duration: 0 } : SEGMENT_TRANSITION;

  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const [expandedHeight, setExpandedHeight] = useState(0);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [dismissedHover, setDismissedHover] = useState(false);
  const collapseTimer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (collapseTimer.current != null) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const handleEnter = () => {
    clearTimer();
    setDismissedHover(false);
    setHovered(true);
    setExpanded(true);
  };

  const handleLeave = () => {
    clearTimer();
    collapseTimer.current = window.setTimeout(() => {
      setExpanded(false);
      collapseTimer.current = null;
    }, COLLAPSE_DELAY);
  };

  /* ⚠️ 官方 `k` 用一个 ref 保留最后一份快照，让「隐藏」时退场动画里内容不闪空；
     这里直接用父层给的 `activeTodo`（`null` 即卸载）—— 差别只在退场那 0.2s 内可能瞬间没有内容，
     换来的是不在 render 期读 ref（`react-hooks/refs`）。 */
  const snapshot = activeTodo;
  const open = visible && !dismissedHover && (expanded || hovered);

  useEffect(() => () => clearTimer(), [clearTimer]);

  /* 官方 `P`：当前项 = 第一个 in_progress；否则第一个未完成；否则最后一项。 */
  const currentIndex = useMemo(() => {
    const items = snapshot?.items ?? [];
    const running = items.findIndex((item) => item.status === 'in_progress');
    if (running >= 0) return running;
    const unfinished = items.findIndex((item) => item.status !== 'completed');
    if (unfinished >= 0) return unfinished;
    return items.length > 0 ? items.length - 1 : -1;
  }, [snapshot]);
  const currentItem: TodoItem | undefined = currentIndex >= 0 ? snapshot?.items[currentIndex] : undefined;
  const completed = snapshot?.progress.completed ?? 0;

  /* 官方：收起时量按钮宽度作为展开宽度。 */
  useLayoutEffect(() => {
    if (expanded) return;
    const node = buttonRef.current;
    if (!node) return;
    const measured = Math.ceil(node.getBoundingClientRect().width);
    if (measured > 0) setWidth(measured);
  }, [currentItem?.content, completed, snapshot?.digest, expanded, visible]);

  /* 官方：展开列表高度 = min(scrollHeight, 320)。 */
  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return undefined;
    const measure = () => setExpandedHeight(Math.min(node.scrollHeight, CAPSULE_LIST_MAX_HEIGHT));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [snapshot?.digest, snapshot?.items.length]);

  const lastReportedRef = useRef(0);
  const report = useCallback(
    (height: number) => {
      const rounded = Math.round(height);
      if (rounded !== lastReportedRef.current) {
        lastReportedRef.current = rounded;
        onHeightChange?.(rounded);
      }
    },
    [onHeightChange],
  );
  useEffect(() => {
    if (visible) report(CAPSULE_BUTTON_HEIGHT + CAPSULE_GAP);
  }, [snapshot?.digest, report, visible]);
  useEffect(() => () => report(0), [report]);

  const handleBlurCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false);
  };
  const handleFocusCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setHovered(true);
    setDismissedHover(false);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    event.stopPropagation();
    buttonRef.current?.focus({ preventScroll: true });
    setDismissedHover(true);
  };

  if (!snapshot) return null;

  const summary = todoQueueText(
    'summary',
    locale,
    { count: snapshot.progress.total, completed: snapshot.progress.completed, total: snapshot.progress.total },
    snapshot.progress.total,
  );
  const progressLabel = todoQueueText(
    'progress',
    locale,
    { current: completed, total: snapshot.progress.total },
  );
  const expandedWidth = Math.min(
    CAPSULE_MAX_WIDTH,
    typeof window === 'undefined' ? CAPSULE_MAX_WIDTH : window.innerWidth - CAPSULE_VIEWPORT_INSET,
  );

  return (
    <AnimatePresence onExitComplete={() => { if (!visible) report(0); }}>
      {visible && (
        <motion.div
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center"
          data-task-mode-active-capsule="true"
          exit={{ opacity: 0, y: 8, scale: 0.98, transition: segmentTransition }}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          style={{ paddingBottom: CAPSULE_GAP, transformOrigin: 'bottom center' }}
          transition={enterTransition}
        >
          <motion.div
            animate={{
              borderRadius: open ? 16 : 22,
              width: open ? Math.max(expandedWidth, width ?? 0) : 'max-content',
            }}
            className="pointer-events-auto flex min-w-0 max-w-[calc(100%_-_2rem)] flex-col-reverse overflow-hidden border border-border bg-chat-bubble-surface shadow-lg"
            initial={false}
            onBlurCapture={handleBlurCapture}
            onFocusCapture={handleFocusCapture}
            onKeyDown={handleKeyDown}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            style={{ originX: 0.5, originY: 1 }}
            transition={segmentTransition}
          >
            <button
              ref={buttonRef}
              type="button"
              aria-controls={listId}
              aria-expanded={open}
              aria-label={`${summary}: ${currentItem?.content ?? ''}`}
              className="flex h-11 w-max min-w-0 max-w-full shrink-0 items-center gap-2.5 rounded-[inherit] pl-3.5 pr-6 text-xs hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-inset"
              onClick={() => setDismissedHover(open)}
            >
              <TodoProgressRing
                current={completed}
                isAllCompleted={snapshot.allCompleted}
                label={progressLabel}
                total={snapshot.progress.total}
              />
              <span
                className={
                  snapshot.allCompleted
                    ? 'shrink-0 tabular-nums font-medium text-chat-foreground'
                    : 'shrink-0 tabular-nums text-secondary-muted-foreground'
                }
              >
                {progressLabel}
              </span>
              {currentItem?.content && (
                <>
                  <span aria-hidden className="size-1 shrink-0 rounded-full bg-foreground/25" />
                  <StaggeredTaskTitle className="font-medium text-text-text-primary" text={currentItem.content} />
                </>
              )}
            </button>
            <motion.section
              id={listId}
              aria-hidden={!open}
              aria-label={summary}
              animate={{ height: open ? expandedHeight : 0, opacity: open ? 1 : 0 }}
              className="overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/40"
              data-task-mode-task-list="true"
              initial={false}
              tabIndex={open ? 0 : -1}
              transition={segmentTransition}
            >
              <div ref={listRef}>
                <TaskProgressList
                  className="px-4 py-3.5"
                  comfortable
                  items={snapshot.items}
                  showDetails={false}
                  showIndex={false}
                />
              </div>
            </motion.section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
