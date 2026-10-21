/**
 * 官方「任务 / 待办（todo）」数据层 —— `use-chat-attachment-file-input-CE59XJWo.js`@294130 一带逐字。
 *
 * 官方压缩名 → 语义（本文件导出名）：
 *   `An(status)`  → `normalizeTodoStatus`      `completed|in_progress|pending` 之外一律 `unknown`
 *   `_x`          → `isTodoCompleted`          `An(e)==='completed'`
 *   `Sx`          → `isTodoInProgress`         `An(e)==='in_progress'`
 *   `Qg(tool)`    → `isTodoTool`               `tool.toLowerCase()==='todowrite'`
 *   `yo(list)`    → `nonNullObjects`           只留非 null 的对象
 *   `Ug(item)`    → `todoActiveForm`           `activeForm` / `active_form`
 *   `Ex(event)`   → `todosFromToolRequest`     从 `event.request.todos` 取（`{content,status,activeForm}`）
 *   `Ix(snapshot)`→ `todosFromSnapshot`        从 `snapshot.tasks` 取
 *                                              （`{subject→content,status,active_form,task_id,description,blocks,blocked_by}`）
 *   `Nx(items)`   → `todoProgress`             `{total, completed, inProgress, pending}`
 *   `Mx(status)`  → `todoStatusClass`          `{iconClassName, textClassName}`
 *   `jx(items)`   → `todoItemsSignature`       `taskId|content|description` 拼接（做 memo 依赖）
 *   `Kue`/`yR`    → 见 `todosFromStreamState`  只接受 `applied` 且未被 `interrupted` 的快照；
 *                                              并且**只在 `active_form` 存在时**才认这份快照
 *
 * `chatAdapter.todoQueue.*` 文案同样逐字（`index-DjCL4F9p.js`@8461105/en、@8860265/ja、
 * @8997467/ko、@9131216/zh）——官方是 i18next 复数键（`summary_one`/`summary_other` …），
 * MTV 的 `t()` 没有复数，这里单独成表并按 `count` 选键，然后替换 `{{var}}`。
 */

/** 官方 `An` 的返回。 */
export type TodoStatus = 'completed' | 'in_progress' | 'pending' | 'unknown';

/* 类型定义在 `types/chat.ts`（避免 types ⇄ services 循环引用），此处转出供组件按语义导入。 */
import type { TodoItem, TodoProgress, TodoSnapshot } from '../../types/chat';
export type { TodoItem, TodoProgress, TodoSnapshot };

/** 官方 `An`：状态归一化。 */
export function normalizeTodoStatus(status: string | undefined | null): TodoStatus {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'in_progress':
      return 'in_progress';
    case 'pending':
      return 'pending';
    default:
      return 'unknown';
  }
}

/** 官方 `_x`。 */
export function isTodoCompleted(status: string | undefined | null): boolean {
  return normalizeTodoStatus(status) === 'completed';
}

/** 官方 `Sx`。 */
export function isTodoInProgress(status: string | undefined | null): boolean {
  return normalizeTodoStatus(status) === 'in_progress';
}

/** 官方 `Qg`：这个工具是不是待办写入。 */
export function isTodoTool(tool: string | undefined | null): boolean {
  return typeof tool === 'string' && tool.toLowerCase() === 'todowrite';
}

/** 官方 `yo`：只保留非 null 的对象。 */
export function nonNullObjects<T>(list: unknown): Array<T & object> {
  if (!Array.isArray(list)) return [];
  return list.map((entry) => (entry && typeof entry === 'object' ? entry : null)).filter(Boolean) as Array<T & object>;
}

/** 官方 `Ug`：`activeForm` / `active_form`。 */
export function todoActiveForm(item: unknown): string | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const record = item as { activeForm?: unknown; active_form?: unknown };
  if (typeof record.activeForm === 'string') return record.activeForm;
  if (typeof record.active_form === 'string') return record.active_form;
  return undefined;
}

/** 官方 `Ex`：从工具事件的 `request.todos` 取待办。 */
export function todosFromToolRequest(event: { request?: { todos?: unknown } } | null | undefined): TodoItem[] {
  const raw = event?.request?.todos;
  if (!Array.isArray(raw)) return [];
  return nonNullObjects<{ content?: unknown; status?: unknown }>(raw)
    .map((item) => ({
      content: typeof item.content === 'string' ? item.content : '',
      status: typeof item.status === 'string' ? item.status : undefined,
      activeForm: todoActiveForm(item),
    }))
    .filter((item) => item.content.length > 0);
}

/** 官方 `Ix`：从任务快照的 `tasks` 取待办。 */
export function todosFromSnapshot(snapshot: { tasks?: unknown } | null | undefined): TodoItem[] {
  const raw = snapshot?.tasks;
  if (!Array.isArray(raw)) return [];
  return nonNullObjects<Record<string, unknown>>(raw)
    .map((item) => ({
      content: typeof item.subject === 'string' ? item.subject : '',
      status: typeof item.status === 'string' ? item.status : undefined,
      activeForm: typeof item.active_form === 'string' ? item.active_form : undefined,
      taskId: typeof item.task_id === 'string' ? item.task_id : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      blocks: Array.isArray(item.blocks) ? item.blocks.filter((v): v is string => typeof v === 'string') : undefined,
      blockedBy: Array.isArray(item.blocked_by)
        ? item.blocked_by.filter((v): v is string => typeof v === 'string')
        : undefined,
    }))
    .filter((item) => item.content.length > 0);
}

/** 官方 `Nx`。 */
export function todoProgress(items: readonly TodoItem[]): TodoProgress {
  return items.reduce<TodoProgress>(
    (acc, item) => {
      acc.total += 1;
      switch (normalizeTodoStatus(item.status)) {
        case 'completed':
          acc.completed += 1;
          break;
        case 'in_progress':
          acc.inProgress += 1;
          break;
        default:
          acc.pending += 1;
          break;
      }
      return acc;
    },
    { total: 0, completed: 0, inProgress: 0, pending: 0 },
  );
}

/** 官方 `Mx`：状态对应的图标/文字色。 */
export function todoStatusClass(status: string | undefined | null): {
  iconClassName: string;
  textClassName: string;
} {
  switch (normalizeTodoStatus(status)) {
    case 'completed':
      return { iconClassName: 'text-chat-foreground/80', textClassName: 'text-chat-foreground' };
    case 'in_progress':
      return {
        iconClassName: 'animate-spin text-foreground motion-reduce:animate-none',
        textClassName: 'text-foreground',
      };
    default:
      return { iconClassName: 'text-muted-foreground/70', textClassName: 'text-muted-foreground' };
  }
}

/** 官方 `jx`：列表签名（做 memo 依赖）。 */
export function todoItemsSignature(items: readonly TodoItem[]): string {
  return items.map((item) => [item.taskId ?? '', item.content, item.description ?? ''].join('\u0002')).join('\u0001');
}

/** 由条目列表组装快照（官方 `pR`/`hR`/`BG` 三件套）。 */
export function buildTodoSnapshot(items: TodoItem[]): TodoSnapshot {
  const progress = todoProgress(items);
  return {
    items,
    progress,
    digest: todoItemsSignature(items),
    allCompleted: progress.total > 0 && progress.completed === progress.total,
  };
}

/**
 * 官方 `xI`：从消息流里取「当前任务快照」，仅 `streaming` / `recovering` 期间有效。
 * 官方数据源是消息的 `contents` 数组里的 `task_snapshot` / `todowrite` 工具事件；
 * MTV 的 `ChatMessage` 没有 `contents`，但多了等价的 `todoSnapshot` 字段（同样**无生产者**，见文档 §9），
 * 所以这里按官方条件读取、拿不到就返回 `null`（胶囊不出现，与官方「没有待办时不显示」一致）。
 */
export function selectChatTodoSnapshot(
  messages: ReadonlyArray<{ todoSnapshot?: TodoSnapshot | null }>,
  streamState: string | undefined,
): TodoSnapshot | null {
  if (streamState !== 'streaming' && streamState !== 'recovering') return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const snapshot = messages[index]?.todoSnapshot;
    if (snapshot && snapshot.items.length > 0) return snapshot;
  }
  return null;
}

/**
 * 官方「任务历史卡」的显示条件：`plan_ready === true` 且列表非空，并且快照里至少有
 * 一个非空 `active_form`（官方 `Kue` 的第二段判断；`interrupted` 时不认）。
 */
export function todoSnapshotItems(
  snapshot: { plan_ready?: unknown; tasks?: unknown } | null | undefined,
  streamState?: string,
): TodoItem[] | null {
  if (streamState === 'interrupted') return null;
  if (!snapshot || snapshot.plan_ready !== true || !Array.isArray(snapshot.tasks)) return null;
  const tasks = snapshot.tasks;
  const validStatuses = tasks.every((task) => {
    if (!task || typeof task !== 'object') return false;
    const status = (task as { status?: unknown }).status;
    return status === 'completed' || status === 'in_progress' || status === 'pending';
  });
  const hasActiveForm = tasks.some(
    (task) => typeof (task as { active_form?: unknown }).active_form === 'string'
      && ((task as { active_form: string }).active_form.length > 0),
  );
  if (!validStatuses || !hasActiveForm) return null;
  return todosFromSnapshot(snapshot);
}

/* ══════════════════════════════════════════════════════════════════════════════
   `chatAdapter.todoQueue.*` 文案（官方四语逐字）
   ══════════════════════════════════════════════════════════════════════════════ */

const TODO_QUEUE_TABLE: Record<string, Record<string, string>> = {
  'zh-CN': {
    fraction: '{{current}} / {{total}}',
    progress: '已完成 {{current}} / {{total}}',
    summary_one: '共 {{total}} 个任务，已完成 {{completed}} 个',
    summary_other: '共 {{total}} 个任务，已完成 {{completed}} 个',
    allCompleted_one: '已完成全部 {{total}} 个任务',
    allCompleted_other: '已完成全部 {{total}} 个任务',
  },
  'en-US': {
    fraction: '{{current}} / {{total}}',
    progress: 'Completed {{current}} / {{total}}',
    summary_one: '{{total}} task, {{completed}} completed',
    summary_other: '{{total}} tasks, {{completed}} completed',
    allCompleted_one: 'All {{total}} task completed',
    allCompleted_other: 'All {{total}} tasks completed',
  },
  'ja-JP': {
    fraction: '{{current}} / {{total}}',
    progress: '{{current}} / {{total}} 件完了',
    summary_one: '全{{total}}件のタスク、{{completed}}件完了',
    summary_other: '全{{total}}件のタスク、{{completed}}件完了',
    allCompleted_one: '{{total}}件のタスクをすべて完了',
    allCompleted_other: '{{total}}件のタスクをすべて完了',
  },
  'ko-KR': {
    fraction: '{{current}} / {{total}}',
    progress: '{{current}} / {{total}}개 완료',
    summary_one: '총 {{total}}개 작업, {{completed}}개 완료',
    summary_other: '총 {{total}}개 작업, {{completed}}개 완료',
    allCompleted_one: '{{total}}개 작업을 모두 완료',
    allCompleted_other: '{{total}}개 작업을 모두 완료',
  },
};

/**
 * 取官方 `chatAdapter.todoQueue.<key>` 文案。
 * `count` 参与复数选择（官方 i18next 的 `_one` / `_other`），随后替换 `{{var}}`。
 */
export function todoQueueText(
  key: string,
  locale: string,
  vars: Record<string, string | number> = {},
  count?: number,
): string {
  const table = TODO_QUEUE_TABLE[locale] ?? TODO_QUEUE_TABLE['en-US'];
  let pattern = table[key] ?? TODO_QUEUE_TABLE['en-US'][key] ?? key;
  if (typeof count === 'number') {
    const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
    pattern = table[pluralKey] ?? pattern;
  }
  return pattern.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
