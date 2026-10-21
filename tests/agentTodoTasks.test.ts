/**
 * 官方「任务 / 待办」数据层回归测试
 * （`use-chat-attachment-file-input-CE59XJWo.js`@294130 的 `An`/`_x`/`Sx`/`Qg`/`yo`/`Ug`/`Ex`/`Ix`/`Nx`/`Mx`/`jx`）。
 */
import { describe, expect, it } from 'vitest';
import {
  isTodoCompleted,
  isTodoInProgress,
  isTodoTool,
  normalizeTodoStatus,
  todoActiveForm,
  todoItemsSignature,
  todoProgress,
  todoQueueText,
  todoSnapshotItems,
  todoStatusClass,
  todosFromSnapshot,
  todosFromToolRequest,
} from '../src/services/chat/todoTasks';

describe('todoTasks 状态与解析（官方 An/_x/Sx/Qg/yo/Ug）', () => {
  it('normalizeTodoStatus：三个已知状态之外一律 unknown', () => {
    expect(normalizeTodoStatus('completed')).toBe('completed');
    expect(normalizeTodoStatus('in_progress')).toBe('in_progress');
    expect(normalizeTodoStatus('pending')).toBe('pending');
    expect(normalizeTodoStatus('done')).toBe('unknown');
    expect(normalizeTodoStatus(undefined)).toBe('unknown');
  });

  it('isTodoCompleted / isTodoInProgress', () => {
    expect(isTodoCompleted('completed')).toBe(true);
    expect(isTodoCompleted('pending')).toBe(false);
    expect(isTodoInProgress('in_progress')).toBe(true);
    expect(isTodoInProgress('completed')).toBe(false);
  });

  it('isTodoTool：大小写不敏感，只认 todowrite', () => {
    expect(isTodoTool('todowrite')).toBe(true);
    expect(isTodoTool('TodoWrite')).toBe(true);
    expect(isTodoTool('memory')).toBe(false);
    expect(isTodoTool(undefined)).toBe(false);
  });

  it('todoActiveForm：camel 与 snake 都认，camel 优先', () => {
    expect(todoActiveForm({ activeForm: 'A' })).toBe('A');
    expect(todoActiveForm({ active_form: 'B' })).toBe('B');
    expect(todoActiveForm({ activeForm: 'A', active_form: 'B' })).toBe('A');
    expect(todoActiveForm({})).toBeUndefined();
    expect(todoActiveForm(null)).toBeUndefined();
  });
});

describe('todoTasks 取数（官方 Ex/Ix）', () => {
  it('todosFromToolRequest：取 request.todos，丢掉空 content 与非对象', () => {
    const items = todosFromToolRequest({
      request: {
        todos: [
          { content: '写脚本', status: 'in_progress', activeForm: '正在写脚本' },
          { content: '', status: 'pending' },
          null,
          { content: '审片', status: 'pending', active_form: '正在审片' },
        ],
      },
    });
    expect(items).toEqual([
      { content: '写脚本', status: 'in_progress', activeForm: '正在写脚本' },
      { content: '审片', status: 'pending', activeForm: '正在审片' },
    ]);
    expect(todosFromToolRequest(null)).toEqual([]);
    expect(todosFromToolRequest({ request: {} })).toEqual([]);
  });

  it('todosFromSnapshot：subject → content，并带上 task_id/description/blocks/blocked_by', () => {
    const items = todosFromSnapshot({
      tasks: [
        {
          task_id: 'T1',
          subject: '分镜',
          status: 'completed',
          active_form: '正在分镜',
          description: '把剧本拆成镜头',
          blocks: ['T2', 3],
          blocked_by: ['T0'],
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      content: '分镜',
      status: 'completed',
      activeForm: '正在分镜',
      taskId: 'T1',
      description: '把剧本拆成镜头',
      blocks: ['T2'],
      blockedBy: ['T0'],
    });
  });
});

describe('todoTasks 统计与样式（官方 Nx/Mx/jx）', () => {
  const items = [
    { content: 'A', status: 'completed' },
    { content: 'B', status: 'in_progress' },
    { content: 'C', status: 'pending' },
    { content: 'D' },
  ];

  it('todoProgress：total/completed/inProgress/pending', () => {
    expect(todoProgress(items)).toEqual({ total: 4, completed: 1, inProgress: 1, pending: 2 });
  });

  it('todoStatusClass：完成/进行中/其它三档与官方一致', () => {
    expect(todoStatusClass('completed')).toEqual({
      iconClassName: 'text-chat-foreground/80',
      textClassName: 'text-chat-foreground',
    });
    expect(todoStatusClass('in_progress').iconClassName).toContain('animate-spin');
    expect(todoStatusClass('pending')).toEqual({
      iconClassName: 'text-muted-foreground/70',
      textClassName: 'text-muted-foreground',
    });
  });

  it('todoItemsSignature：taskId|content|description 用不可见分隔符拼接', () => {
    expect(todoItemsSignature([{ content: 'A', taskId: 'T1', description: 'd' }])).toBe('T1\u0002A\u0002d');
    expect(todoItemsSignature([])).toBe('');
  });
});

describe('todoTasks 显示条件（官方 Kue）', () => {
  const valid = {
    plan_ready: true,
    tasks: [{ task_id: 'T1', subject: 'A', status: 'pending', active_form: '正在 A' }],
  };

  it('plan_ready 必须为 true', () => {
    expect(todoSnapshotItems({ ...valid, plan_ready: false })).toBeNull();
    expect(todoSnapshotItems(null)).toBeNull();
  });

  it('tasks 必须非空且状态合法（空数组因「无 active_form」同样不显示）', () => {
    expect(todoSnapshotItems({ plan_ready: true, tasks: [] })).toBeNull();
    expect(todoSnapshotItems({ plan_ready: true, tasks: [{ status: 'done' }] })).toBeNull();
  });

  it('必须至少有一条非空 active_form', () => {
    expect(
      todoSnapshotItems({ plan_ready: true, tasks: [{ task_id: 'T1', subject: 'A', status: 'pending' }] }),
    ).toBeNull();
  });

  it('interrupted 时不显示', () => {
    expect(todoSnapshotItems(valid, 'interrupted')).toBeNull();
    expect(todoSnapshotItems(valid)).toHaveLength(1);
  });
});

describe('todoQueue 文案（官方 chatAdapter.todoQueue.*，四语逐字）', () => {
  it('progress/allCompleted 按 count 选复数键后替换 {{var}}', () => {
    expect(todoQueueText('progress', 'zh-CN', { current: 2, total: 5 })).toBe('已完成 2 / 5');
    expect(todoQueueText('summary', 'en-US', { completed: 2, total: 5 }, 5)).toBe('5 tasks, 2 completed');
    expect(todoQueueText('summary', 'en-US', { completed: 0, total: 1 }, 1)).toBe('1 task, 0 completed');
    expect(todoQueueText('allCompleted', 'en-US', { total: 3 }, 3)).toBe('All 3 tasks completed');
    expect(todoQueueText('allCompleted', 'zh-CN', { total: 3 }, 3)).toBe('已完成全部 3 个任务');
    expect(todoQueueText('fraction', 'ja-JP', { current: 1, total: 4 })).toBe('1 / 4');
    expect(todoQueueText('progress', 'ko-KR', { current: 1, total: 4 })).toBe('1 / 4개 완료');
  });

  it('未知 locale 回落英文，未知键原样返回', () => {
    expect(todoQueueText('progress', 'fr-FR', { current: 1, total: 2 })).toBe('Completed 1 / 2');
    expect(todoQueueText('nope', 'zh-CN')).toBe('nope');
  });
});
