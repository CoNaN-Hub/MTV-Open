/**
 * 官方「有序 `contents: Item[]`」装配层回归测试
 * （`agentMessageContents.ts`；官方源码 = `vendor-pkg-canvas-ChpWx5JY.js`）。
 *
 * 覆盖：
 *  · 有序性（user 的 `context_nodes`→`text`；assistant 的活动项 → `text` → `agent_error` → `task_snapshot`）；
 *  · 13 个特殊族各自被识别、并落到正确的 Item 类型 / 家族；
 *  · `content` 缺失的 `tool_event`：官方 `Ug` 的怪点（13 个谓词全 false ⇒ 返回 **true**）；
 *  · 边界（空消息、只有 `taskSnapshot`、未知工具名、`contents` 直通）；
 *  · `p1e`（ask_question 同 callId 合并）与 `YNe`（tapnow_cli 确认卡占位剔除）逐字行为；
 *  · 与 `agentContents.ts` 的交叉一致性（族成员必须让 `isPlainToolEvent` 为 false）。
 *
 * 验证分级：本轮是 **(d) 源码级**（官方 bundle 逐字 + 字节偏移），**没有**做 live CDP / jsdom 实测。
 */
import { describe, expect, it } from 'vitest';
import {
  assembleAgentMessageContents,
  assembleRawAgentMessageContents,
  childTaskToSubagentItem,
  classifyToolEventFamily,
  dropCliConfirmationPlaceholders,
  mergeDuplicateToolEvents,
  normalizeAgentContents,
  splitAgentMessageContents,
  stepToOfficialToolEventItem,
  TOOL_FAMILY_DISPATCH,
  toTaskSnapshotItem,
  upsertTaskSnapshotItem,
  type AgentToolFamily,
  type OfficialAgentContentItem,
} from '../src/services/chat/agentMessageContents';
import type { TaskSnapshotItem } from '../src/services/chat/agentContents';
import { isPlainToolEvent } from '../src/services/chat/agentContents';
import { taskStepsToToolEvents } from '../src/services/chat/agentActivityItems';
import { isAskQuestionTool } from '../src/services/chat/askQuestion';
import type { AgentStep, AgentTask } from '../src/types/agent';
import type { TodoSnapshot } from '../src/types/chat';

/* ── fixture 工厂 ─────────────────────────────────────────────────────────── */

type LooseItem = { type: string; content?: unknown; [key: string]: unknown };

/** 官方 `tool_event` wire 形状（`Gge` @21102），测试里只需要 `tool` / `status` / `ui` 这几个键。 */
function toolEvent(tool: string, extra: Record<string, unknown> = {}, status = 'completed'): LooseItem {
  return {
    type: 'tool_event',
    content: {
      schema_version: 'tool_event.v1',
      type: 'tool_event',
      tool,
      status,
      tool_call_id: `call-${tool}`,
      request: {},
      response: null,
      ...extra,
    },
  };
}

/** 一个最小的 MTV `AgentStep`。 */
function step(over: Partial<AgentStep> & { id: string }): AgentStep {
  return {
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: '步骤',
    status: 'succeeded',
    createdAt: 1000,
    updatedAt: 2000,
    ...over,
  };
}

/** 一个最小的 MTV `AgentTask`。 */
function task(over: Partial<AgentTask> & { id: string }): AgentTask {
  return {
    projectId: 'p1',
    conversationId: 'conv-1',
    userMessageId: 'u1',
    mode: 'collaborative',
    goal: '目标',
    status: 'completed',
    steps: [],
    modelRounds: 1,
    toolCallCount: 0,
    budget: {
      maxModelRounds: 12,
      maxToolCalls: 24,
      maxParallelReadTools: 3,
      maxReadRetries: 3,
    },
    createdAt: 1000,
    updatedAt: 2000,
    ...over,
  };
}

/** 一个最小的 MTV `TodoSnapshot`（官方 `task_snapshot` content 的 MTV 等价物）。 */
function todoSnapshot(over: Partial<TodoSnapshot> = {}): TodoSnapshot {
  const items = over.items ?? [{ content: '写脚本', status: 'in_progress', activeForm: '正在写脚本' }];
  return { items, progress: { total: items.length, completed: 0, inProgress: 1, pending: 0 }, digest: 'd', allCompleted: false, ...over };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 1. 13 个特殊族 + 普通工具：`$M` 的分派
 * ══════════════════════════════════════════════════════════════════════════ */

describe('classifyToolEventFamily（官方 $M @2425467 的分派序）', () => {
  it('非 tool_event 一律 null（$M 里它们走别的类型分支）', () => {
    expect(classifyToolEventFamily({ type: 'text', content: 'hi' })).toBeNull();
    expect(classifyToolEventFamily({ type: 'thinking', content: '想' })).toBeNull();
    expect(classifyToolEventFamily({ type: 'task_snapshot', content: {} })).toBeNull();
    expect(classifyToolEventFamily({})).toBeNull();
  });

  /* ── 第 1 族：$b = MNe @442098 ── */
  it('$b：ask_question / AskUserQuestion ⇒ ask_question（**大小写敏感**，因为 xl 不 toLowerCase）', () => {
    expect(classifyToolEventFamily(toolEvent('ask_question'))).toBe('ask_question');
    expect(classifyToolEventFamily(toolEvent('AskUserQuestion'))).toBe('ask_question');
    expect(classifyToolEventFamily(toolEvent('ASK_QUESTION'))).toBe('plain');
    expect(classifyToolEventFamily(toolEvent('askquestion'))).toBe('plain');
  });

  /* **用户 2026-10-15 裁决**：两处判据必须与官方 `$b` 逐字一致（round 120 已把 MTV 侧改成精确集合匹配）。 */
  it('官方 `$b` 与 `askQuestion.isAskQuestionTool` **语义一致**（都是 `fEe` 精确匹配，`AskUserQuestion` 命中）', () => {
    /* 官方 `$b = fEe.has(xl(e))`，`xl` @448796 **不**归一化，`fEe` @447426 含 `"AskUserQuestion"` ⇒ 命中。
       round 120 之前 MTV `isAskQuestionTool` 先 `toLowerCase()` 再比 `ask_question` ⇒ 两个字面量语义分叉；
       现已改成同一份精确集合。 */
    expect(classifyToolEventFamily(toolEvent('AskUserQuestion'))).toBe('ask_question');
    expect(isAskQuestionTool('AskUserQuestion')).toBe(true);
    expect(classifyToolEventFamily(toolEvent('ask_question'))).toBe('ask_question');
    expect(isAskQuestionTool('ask_question')).toBe(true);
  });

  /* ── 第 2 族：wS = RNe @442187 ── */
  it('wS：cost_limit_confirmation ⇒ cost_limit_confirmation', () => {
    expect(classifyToolEventFamily(toolEvent('cost_limit_confirmation'))).toBe('cost_limit_confirmation');
    expect(classifyToolEventFamily(toolEvent('cost_limit'))).toBe('plain');
  });

  /* ── 第 3 族：dg = PNe @442146 ── */
  it('dg：generation_confirmation ⇒ generation_confirmation', () => {
    expect(classifyToolEventFamily(toolEvent('generation_confirmation'))).toBe('generation_confirmation');
    expect(classifyToolEventFamily(toolEvent('Generation_Confirmation'))).toBe('plain');
  });

  /* ── 第 4 族：iT = DNe @442228 ── */
  it('iT：node_update_confirmation ⇒ node_update_confirmation', () => {
    expect(classifyToolEventFamily(toolEvent('node_update_confirmation'))).toBe('node_update_confirmation');
    expect(classifyToolEventFamily(toolEvent('node_update'))).toBe('plain');
  });

  /* ── 第 5 族：kD = LNe @442270（5 个成员逐个） ── */
  it('kD：desktop_* 与 batch_download_files_confirmation 这 5 个成员全部 ⇒ desktop_confirmation', () => {
    for (const member of [
      'desktop_open_app_confirmation',
      'desktop_capture_screen_confirmation',
      'desktop_fs_confirmation',
      'desktop_shell_command_confirmation',
      'batch_download_files_confirmation',
    ]) {
      expect(classifyToolEventFamily(toolEvent(member))).toBe('desktop_confirmation');
    }
    expect(classifyToolEventFamily(toolEvent('desktop_fs'))).toBe('plain');
  });

  /* ── 第 6 族：MD = BNe @442575（$M 里在 AD 之前判） ── */
  it('MD：prepare_widget ⇒ prepare_widget（且**优先于** AD）', () => {
    expect(classifyToolEventFamily(toolEvent('prepare_widget'))).toBe('prepare_widget');
    expect(classifyToolEventFamily(toolEvent('prepare_widget_v2'))).toBe('plain');
    /* $M 顺序：MD → AD ⇒ 即使带了 ui.resource_uri 也算 prepare_widget（该分支 return null）。 */
    expect(classifyToolEventFamily(toolEvent('prepare_widget', { ui: { resource_uri: 'ui://x' } })))
      .toBe('prepare_widget');
  });

  /* ── 第 7 族：AD @444487（不看工具名，看 content.ui.resource_uri） ── */
  it('AD：content.ui.resource_uri 为非空字符串 ⇒ mcp_app（不看工具名）', () => {
    expect(classifyToolEventFamily(toolEvent('show_previs', { ui: { resource_uri: 'ui://tapnow/previs@v3' } })))
      .toBe('mcp_app');
    expect(classifyToolEventFamily(toolEvent('show_previs', { ui: { resource_uri: '' } }))).toBe('plain');
    expect(classifyToolEventFamily(toolEvent('show_previs', { ui: {} }))).toBe('plain');
    expect(classifyToolEventFamily(toolEvent('show_previs', { ui: 'ui://x' }))).toBe('plain');
    expect(classifyToolEventFamily(toolEvent('show_previs'))).toBe('plain');
  });

  /* ── 第 8 族：aT = FNe @442454 ── */
  it('aT：show_widget ⇒ show_widget（AD 优先于 aT，与 $M 一致）', () => {
    expect(classifyToolEventFamily(toolEvent('show_widget'))).toBe('show_widget');
    expect(classifyToolEventFamily(toolEvent('Show_Widget'))).toBe('plain');
    expect(classifyToolEventFamily(toolEvent('show_widget', { ui: { resource_uri: 'ui://x' } }))).toBe('mcp_app');
  });

  /* ── 第 9 族：lT = ONe @442483 ── */
  it('lT：show_html ⇒ show_html', () => {
    expect(classifyToolEventFamily(toolEvent('show_html'))).toBe('show_html');
    expect(classifyToolEventFamily(toolEvent('show-html'))).toBe('plain');
  });

  /* ── 第 10 族：ID = zNe @442510 ── */
  it('ID：get_connector_status ⇒ connector_status', () => {
    expect(classifyToolEventFamily(toolEvent('get_connector_status'))).toBe('connector_status');
    expect(classifyToolEventFamily(toolEvent('connector_status'))).toBe('plain');
  });

  /* ── 第 11 族：jD = UNe @442548 ── */
  it('jD：show_form ⇒ show_form', () => {
    expect(classifyToolEventFamily(toolEvent('show_form'))).toBe('show_form');
    expect(classifyToolEventFamily(toolEvent('showform'))).toBe('plain');
  });

  /* ── 第 12 族：ib = XNe @445048 ── */
  it('ib：gen_image / gen_video / generation_request ⇒ generation；gen_audio **不算**（那是 HNe 不是 XNe）', () => {
    expect(classifyToolEventFamily(toolEvent('gen_image'))).toBe('generation');
    expect(classifyToolEventFamily(toolEvent('gen_video'))).toBe('generation');
    expect(classifyToolEventFamily(toolEvent('generation_request'))).toBe('generation');
    expect(classifyToolEventFamily(toolEvent('gen_audio'))).toBe('plain');
    /* 大小写敏感（XNe.has(xl(e))，xl 不归一化）。 */
    expect(classifyToolEventFamily(toolEvent('GEN_IMAGE'))).toBe('plain');
  });

  /* ── 第 13 族：Xv @445152 = VNe（todowrite / memory / inspect_canvas）+ 空集 UY ── */
  it('Xv：todowrite / memory / inspect_canvas ⇒ utility_excluded（这里**大小写不敏感**）', () => {
    expect(classifyToolEventFamily(toolEvent('todowrite'))).toBe('utility_excluded');
    expect(classifyToolEventFamily(toolEvent('TodoWrite'))).toBe('utility_excluded');
    expect(classifyToolEventFamily(toolEvent('memory'))).toBe('utility_excluded');
    expect(classifyToolEventFamily(toolEvent('inspect_canvas'))).toBe('utility_excluded');
    expect(classifyToolEventFamily(toolEvent('INSPECT_CANVAS'))).toBe('utility_excluded');
    /* 官方 `VNe` 里没有 `memory_list` 等 MTV 工具名。 */
    expect(classifyToolEventFamily(toolEvent('memory_list'))).toBe('plain');
    expect(classifyToolEventFamily(toolEvent('todowrite_v2'))).toBe('plain');
  });

  /* ── 交叉一致性：族成员必须让**既有导出谓词** `Ug` 为 false ── */
  it('每个特殊族成员都让 isPlainToolEvent（官方 Ug @446236）返回 false', () => {
    const special: Array<[AgentToolFamily, LooseItem]> = [
      ['ask_question', toolEvent('ask_question')],
      ['ask_question', toolEvent('AskUserQuestion')],
      ['cost_limit_confirmation', toolEvent('cost_limit_confirmation')],
      ['generation_confirmation', toolEvent('generation_confirmation')],
      ['node_update_confirmation', toolEvent('node_update_confirmation')],
      ['desktop_confirmation', toolEvent('desktop_open_app_confirmation')],
      ['desktop_confirmation', toolEvent('desktop_capture_screen_confirmation')],
      ['desktop_confirmation', toolEvent('desktop_fs_confirmation')],
      ['desktop_confirmation', toolEvent('desktop_shell_command_confirmation')],
      ['desktop_confirmation', toolEvent('batch_download_files_confirmation')],
      ['prepare_widget', toolEvent('prepare_widget')],
      ['mcp_app', toolEvent('show_previs', { ui: { resource_uri: 'ui://x' } })],
      ['show_widget', toolEvent('show_widget')],
      ['show_html', toolEvent('show_html')],
      ['connector_status', toolEvent('get_connector_status')],
      ['show_form', toolEvent('show_form')],
      ['generation', toolEvent('gen_image')],
      ['generation', toolEvent('gen_video')],
      ['generation', toolEvent('generation_request')],
      ['utility_excluded', toolEvent('todowrite')],
      ['utility_excluded', toolEvent('memory')],
      ['utility_excluded', toolEvent('inspect_canvas')],
    ];
    for (const [family, item] of special) {
      expect(classifyToolEventFamily(item), `${family} 分族`).toBe(family);
      expect(isPlainToolEvent(item), `${family} 必须不是普通工具（官方 Ug）`).toBe(false);
    }
  });

  it('TOOL_FAMILY_DISPATCH 覆盖全部 14 个家族', () => {
    const families: AgentToolFamily[] = [
      'ask_question', 'cost_limit_confirmation', 'generation_confirmation', 'node_update_confirmation',
      'desktop_confirmation', 'prepare_widget', 'mcp_app', 'show_widget', 'show_html', 'connector_status',
      'show_form', 'generation', 'utility_excluded', 'plain',
    ];
    for (const family of families) expect(TOOL_FAMILY_DISPATCH[family]).toBeDefined();
    expect(Object.keys(TOOL_FAMILY_DISPATCH)).toHaveLength(families.length);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 2. 官方 Ug 的怪点：content 缺失的 tool_event
 * ══════════════════════════════════════════════════════════════════════════ */

describe('content 缺失的 tool_event（官方 Ug @446236 的怪点）', () => {
  it('顶层 type=tool_event 但 content 缺失/null/非对象 ⇒ 官方 Ug 返回 **true** ⇒ 家族是 plain', () => {
    /* `Ug` 顶层只判 `e.type==="tool_event"`；content 的判据在 13 个谓词内部（各自先看 typeof），
       所以它们全 false ⇒ `!false && …` ⇒ `Ug` 返回 true。这是官方行为，不是宽松实现。 */
    expect(isPlainToolEvent({ type: 'tool_event' })).toBe(true);
    expect(classifyToolEventFamily({ type: 'tool_event' })).toBe('plain');
    expect(classifyToolEventFamily({ type: 'tool_event', content: null })).toBe('plain');
    expect(classifyToolEventFamily({ type: 'tool_event', content: 'tool_event' })).toBe('plain');
    expect(classifyToolEventFamily({ type: 'tool_event', content: 42 })).toBe('plain');
  });

  it('content 是对象但没有 tool 键 ⇒ 工具名空串 ⇒ 仍是 plain（不会误判成特殊族）', () => {
    expect(classifyToolEventFamily({ type: 'tool_event', content: {} })).toBe('plain');
    expect(classifyToolEventFamily(toolEvent('', {}, 'completed'))).toBe('plain');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 3. 官方 p1e（@452667）：ask_question 同 callId 合并
 * ══════════════════════════════════════════════════════════════════════════ */

describe('mergeDuplicateToolEvents（官方 p1e @452667）', () => {
  it('只有 $b（ask_question）参与分组：其它工具同 tool_call_id 不合并', () => {
    const contents = [
      toolEvent('read', { tool_call_id: 'dup' }),
      toolEvent('read', { tool_call_id: 'dup' }),
    ] as OfficialAgentContentItem[];
    const merged = mergeDuplicateToolEvents(contents);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(contents[0]);
  });

  it('ask_question 同 callId 合并成一条：保留首次出现的位置、后者覆盖前者、response 浅合并', () => {
    const contents = [
      toolEvent('read', { tool_call_id: 'r1' }),
      toolEvent('ask_question', { tool_call_id: 'dup', response: { a: 1 }, startedAt: 11 }),
      toolEvent('ask_question', { tool_call_id: 'dup', response: { b: 2 }, status: 'completed' }),
      toolEvent('write', { tool_call_id: 'w1' }),
    ] as OfficialAgentContentItem[];
    const merged = mergeDuplicateToolEvents(contents);

    expect(merged.map((item) => item.type)).toEqual(['tool_event', 'tool_event', 'tool_event']);
    const target = merged[1] as { type: string; content: Record<string, unknown>; startedAt?: number };
    expect(target.content).toMatchObject({ status: 'completed', response: { a: 1, b: 2 } });
    /* 官方 p1e 新建 `{type,content}` ⇒ **丢掉** startedAt/endedAt。 */
    expect(target.startedAt).toBeUndefined();
    /* 位置 = 该 id 第一次出现的位置（下标 1），read/write 原样保留。 */
    expect((merged[0] as { content: Record<string, unknown> }).content.tool).toBe('read');
    expect((merged[2] as { content: Record<string, unknown> }).content.tool).toBe('write');
  });

  it('没有重复时返回等长数组且元素原样（同一引用）', () => {
    const contents = [toolEvent('ask_question', { tool_call_id: 'a' })] as OfficialAgentContentItem[];
    const merged = mergeDuplicateToolEvents(contents);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(contents[0]);
  });

  it('ask_question 缺 tool_call_id / tool_use_id ⇒ 不参与分组', () => {
    const first = { type: 'tool_event', content: { tool: 'ask_question' } } as OfficialAgentContentItem;
    const second = { type: 'tool_event', content: { tool: 'ask_question' } } as OfficialAgentContentItem;
    expect(mergeDuplicateToolEvents([first, second])).toHaveLength(2);
    /* tool_use_id 回退路径。 */
    const third = toolEvent('ask_question', { tool_use_id: 'u1', tool_call_id: undefined });
    const fourth = toolEvent('ask_question', { tool_use_id: 'u1', tool_call_id: undefined });
    expect(mergeDuplicateToolEvents([third as OfficialAgentContentItem, fourth as OfficialAgentContentItem]))
      .toHaveLength(1);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 4. 官方 YNe（@444231）：tapnow_cli 确认卡占位剔除
 * ══════════════════════════════════════════════════════════════════════════ */

describe('dropCliConfirmationPlaceholders（官方 YNe @444231）', () => {
  it('status=started 的 tapnow_cli 后面紧跟确认卡 ⇒ 被剔除', () => {
    const contents = [
      toolEvent('tapnow_cli', {}, 'started'),
      toolEvent('generation_confirmation'),
      toolEvent('read'),
    ] as OfficialAgentContentItem[];
    expect(dropCliConfirmationPlaceholders(contents).map((item) => (item as { content: { tool: string } }).content.tool))
      .toEqual(['generation_confirmation', 'read']);
  });

  it('status=completed 的 tapnow_cli ⇒ **不**剔除（官方 `r!=="pending"&&r!=="started"` 短路）', () => {
    const contents = [
      toolEvent('tapnow_cli', {}, 'completed'),
      toolEvent('generation_confirmation'),
    ] as OfficialAgentContentItem[];
    expect(dropCliConfirmationPlaceholders(contents)).toHaveLength(2);
  });

  it('下一条非空项不是确认卡（dg/iT/kD）⇒ 不剔除', () => {
    for (const follower of ['read', 'show_widget', 'ask_question']) {
      const contents = [
        toolEvent('tapnow_cli', {}, 'pending'),
        toolEvent(follower),
      ] as OfficialAgentContentItem[];
      expect(dropCliConfirmationPlaceholders(contents), follower).toHaveLength(2);
    }
    /* 三条确认卡族都算（qNe = dg || iT || kD）。 */
    for (const follower of ['generation_confirmation', 'node_update_confirmation', 'desktop_fs_confirmation']) {
      const contents = [
        toolEvent('tapnow_cli', {}, 'pending'),
        toolEvent(follower),
      ] as OfficialAgentContentItem[];
      expect(dropCliConfirmationPlaceholders(contents), follower).toHaveLength(1);
    }
  });

  it('工具名比对前 toLowerCase，但**不 trim**（官方 `xl(o).toLowerCase() !== GNe`）', () => {
    const lowerCased = [
      toolEvent('TapNow_CLI', {}, 'started'),
      toolEvent('generation_confirmation'),
    ] as OfficialAgentContentItem[];
    expect(dropCliConfirmationPlaceholders(lowerCased)).toHaveLength(1);
    /* `xl` 不做 trim（与 `Kv`/`tT` 不同）⇒ 前后带空白就匹配不上。 */
    const padded = [
      toolEvent(' TapNow_CLI ', {}, 'started'),
      toolEvent('generation_confirmation'),
    ] as OfficialAgentContentItem[];
    expect(dropCliConfirmationPlaceholders(padded)).toHaveLength(2);
  });

  it('KNe 跳过空正文项：中间隔着空 text 也能看到后面的确认卡', () => {
    const contents = [
      toolEvent('tapnow_cli', {}, 'started'),
      { type: 'text', content: '' },
      { type: 'text', content: '   ' },
      toolEvent('node_update_confirmation'),
    ] as OfficialAgentContentItem[];
    expect(dropCliConfirmationPlaceholders(contents).map((item) => item.type)).toEqual(['text', 'text', 'tool_event']);
  });

  it('已经是最后一条（后面无非空项）⇒ 不剔除', () => {
    const contents = [toolEvent('tapnow_cli', {}, 'started')] as OfficialAgentContentItem[];
    expect(dropCliConfirmationPlaceholders(contents)).toHaveLength(1);
  });

  it('normalizeAgentContents = YNe(p1e(…))：先合并 ask_question，再剔 CLI 占位', () => {
    const contents = [
      toolEvent('ask_question', { tool_call_id: 'dup', response: { a: 1 } }),
      toolEvent('ask_question', { tool_call_id: 'dup', response: { b: 2 } }),
      toolEvent('tapnow_cli', {}, 'started'),
      toolEvent('generation_confirmation'),
    ] as OfficialAgentContentItem[];
    const normalized = normalizeAgentContents(contents);
    expect(normalized.map((item) => (item as { content: { tool: string } }).content.tool))
      .toEqual(['ask_question', 'generation_confirmation']);
    expect((normalized[0] as { content: Record<string, unknown> }).content.response).toEqual({ a: 1, b: 2 });
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 5. MTV → 官方 item 的单步适配
 * ══════════════════════════════════════════════════════════════════════════ */

describe('stepToOfficialToolEventItem / childTaskToSubagentItem', () => {
  it('补上 schema_version / type / tool_call_id（`stepToToolEvent` 漏掉的官方字段）', () => {
    const item = stepToOfficialToolEventItem(step({
      id: 's1',
      title: '读取文件',
      outputSummary: '10 行',
      toolCall: { callId: 'c1', toolId: 'file_read_text', retryCount: 0, startedAt: 100, finishedAt: 200 },
      createdAt: 90,
      updatedAt: 210,
    }));
    expect(item.type).toBe('tool_event');
    expect(item.content).toMatchObject({
      schema_version: 'tool_event.v1',
      type: 'tool_event',
      tool: 'read',
      status: 'completed',
      tool_call_id: 'c1',
      request: { description: '读取文件', prompt: '' },
      response: { summary: '10 行' },
    });
    expect(item.startedAt).toBe(100);
    expect(item.endedAt).toBe(200);
    /* 走官方 Ug ⇒ 普通工具行。 */
    expect(classifyToolEventFamily(item)).toBe('plain');
  });

  it('没有 toolCall 的步骤用 step.kind 当工具名（官方按 command 处理）', () => {
    const item = stepToOfficialToolEventItem(step({ id: 's2', kind: 'planning', title: '规划', status: 'running' }));
    expect(item.content.tool).toBe('planning');
    expect(item.content.status).toBe('started');
    expect(item.content.tool_call_id).toBeUndefined();
    expect(item.startedAt).toBe(1000);
    expect(item.endedAt).toBe(2000);
  });

  it('子任务产出官方 **subagent** item（不是 tool_event），时间戳来自 MTV 真实字段', () => {
    const child = task({ id: 'child-1', goal: '子目标', status: 'completed', startedAt: 100, completedAt: 400, createdAt: 50, updatedAt: 450, resultSummary: '结果' });
    const item = childTaskToSubagentItem(child);
    expect(item.type).toBe('subagent');
    expect(item.content).toMatchObject({ subagent_id: 'child-1', status: 'completed', task_description: '子目标', text: '结果', tools: [] });
    expect(item.startedAt).toBe(100);
    expect(item.endedAt).toBe(400);
  });

  it('RENDERABLE_STEP_KINDS 与既有 taskStepsToToolEvents 的过滤条件一致', () => {
    const mixed = task({
      id: 'task-mixed',
      steps: [
        step({ id: 'a', index: 0, kind: 'tool', title: 'A' }),
        step({ id: 'b', index: 1, kind: 'observation', title: 'B' }),
        step({ id: 'c', index: 2, kind: 'approval', title: 'C' }),
        step({ id: 'd', index: 3, kind: 'response', title: 'D' }),
        step({ id: 'e', index: 4, kind: 'planning', title: 'E' }),
      ],
    });
    const mine = assembleRawAgentMessageContents({ message: { role: 'assistant' }, agentTask: mixed })
      .filter((item) => item.type === 'tool_event');
    expect(mine.map((item) => (item as { content: { tool: string } }).content.tool))
      .toEqual(taskStepsToToolEvents(mixed).map((item) => String(item.content?.tool ?? '')));
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 6. 有序性
 * ══════════════════════════════════════════════════════════════════════════ */

describe('assembleRawAgentMessageContents：官方有序 contents', () => {
  it('user 消息：context_nodes 在前、text 在后（官方 bZ）', () => {
    const items = assembleRawAgentMessageContents({
      message: { role: 'user', content: '看下这个节点', contextNodeIds: ['n1', '', 'n2'] },
    });
    expect(items[0]).toEqual({ type: 'context_nodes', content: { node_ids: ['n1', 'n2'] } });
    expect(items[1]).toEqual({ type: 'text', content: '看下这个节点' });
    expect(items).toHaveLength(2);
  });

  it('user 消息没有 contextNodeIds ⇒ 只有 text（官方 context_nodes part 整条不渲染）', () => {
    const items = assembleRawAgentMessageContents({ message: { role: 'user', content: '嗨', contextNodeIds: [] } });
    expect(items.map((item) => item.type)).toEqual(['text']);
  });

  it('assistant：活动项（按时间戳）→ 正文 → task_snapshot', () => {
    const agentTask = task({
      id: 'task-1',
      goal: '做片子',
      steps: [
        step({ id: 's1', index: 0, title: '读', toolCall: { callId: 'c1', toolId: 'file_read_text', retryCount: 0, startedAt: 300, finishedAt: 350 }, createdAt: 290, updatedAt: 360 }),
        step({ id: 's2', index: 1, kind: 'planning', title: '规划', createdAt: 500, updatedAt: 560 }),
      ],
    });
    const child = task({ id: 'child-1', goal: '子目标', startedAt: 100, completedAt: 200, createdAt: 90, updatedAt: 210 });
    const items = assembleRawAgentMessageContents({
      message: { role: 'assistant', content: '做完了', status: 'done', timestamp: 900, todoSnapshot: todoSnapshot() },
      agentTask,
      childTasks: [child],
    });

    expect(items.map((item) => item.type)).toEqual(['subagent', 'tool_event', 'tool_event', 'text', 'task_snapshot']);
    expect(items[0]).toMatchObject({ content: { subagent_id: 'child-1' }, startedAt: 100 });
    expect(items[3]).toMatchObject({ type: 'text', content: '做完了', startedAt: 900 });
    expect(items[4]).toMatchObject({ type: 'task_snapshot', content: { schema_version: 'agent_task_snapshot.v1' } });
  });

  it('13 个特殊族 + 普通工具在同一条消息里交错，顺序与写入序一致', () => {
    const special: Array<[string, string]> = [
      ['call-ask', 'ask_question'],
      ['call-cost', 'cost_limit_confirmation'],
      ['call-gen-confirm', 'generation_confirmation'],
      ['call-node', 'node_update_confirmation'],
      ['call-desktop', 'desktop_fs_confirmation'],
      ['call-prepare', 'prepare_widget'],
      ['call-widget', 'show_widget'],
      ['call-html', 'show_html'],
      ['call-connector', 'get_connector_status'],
      ['call-form', 'show_form'],
      ['call-generation', 'gen_image'],
      ['call-utility', 'todowrite'],
      ['call-plain', 'file_read_text'],
    ];
    const steps = special.map(([callId, toolId], index) => step({
      id: `s${index}`,
      index,
      title: toolId,
      toolCall: { callId, toolId, retryCount: 0, startedAt: 1000 + index, finishedAt: 1100 + index },
      createdAt: 990 + index,
      updatedAt: 1110 + index,
    }));
    const agentTask = task({ id: 'task-order', steps });
    const items = assembleRawAgentMessageContents({ message: { role: 'assistant', content: '结果' }, agentTask })
      .filter((item) => item.type === 'tool_event');

    /* 工具 id → 官方工具名（`file_read_text` → `read`，其余原样）。 */
    expect(items.map((item) => (item as { content: { tool: string } }).content.tool)).toEqual([
      'ask_question', 'cost_limit_confirmation', 'generation_confirmation', 'node_update_confirmation',
      'desktop_fs_confirmation', 'prepare_widget', 'show_widget', 'show_html',
      'get_connector_status', 'show_form', 'gen_image', 'todowrite', 'read',
    ]);
    expect(items.map((item) => classifyToolEventFamily(item))).toEqual([
      'ask_question', 'cost_limit_confirmation', 'generation_confirmation', 'node_update_confirmation',
      'desktop_confirmation', 'prepare_widget', 'show_widget', 'show_html',
      'connector_status', 'show_form', 'generation', 'utility_excluded', 'plain',
    ]);
  });

  it('⚠️ mcp_app（AD）从 MTV 步骤里**不可达**：它只看 `content.ui.resource_uri`，' +
    '而 `AgentStep`/`AgentToolCallSnapshot` 没有这个字段', () => {
    /* 任何工具名都产不出 `ui` ⇒ 从 MTV 装配出来的 tool_event 永远不会命中 `AD`。 */
    const items = assembleRawAgentMessageContents({
      message: { role: 'assistant' },
      agentTask: task({
        id: 'task-mcp',
        steps: [step({ id: 's1', title: 'previs', toolCall: { callId: 'c1', toolId: 'show_previs', retryCount: 0 } })],
      }),
    });
    expect(items.map((item) => classifyToolEventFamily(item))).toEqual(['plain']);
    /* 家族识别本身是对的（结构判据），只是缺生产者。 */
    expect(classifyToolEventFamily(toolEvent('show_previs', { ui: { resource_uri: 'ui://tapnow/previs@v3' } })))
      .toBe('mcp_app');
  });

  it('agent_error 追加在末尾（官方 appendMessageContent {type:"agent_error", content}）', () => {
    const agentTask = task({ id: 'task-err', status: 'failed', errorMessage: '模型调用失败' });
    const items = assembleRawAgentMessageContents({
      message: { role: 'assistant', content: '部分结果', status: 'error', timestamp: 700 },
      agentTask,
    });
    expect(items.map((item) => item.type)).toEqual(['text', 'agent_error']);
    expect(items[1]).toEqual({ type: 'agent_error', content: '模型调用失败' });
  });

  it('status=error 但没有 errorMessage ⇒ 不产 agent_error（不臆造文案）', () => {
    const items = assembleRawAgentMessageContents({ message: { role: 'assistant', content: 'x', status: 'error' } });
    expect(items.map((item) => item.type)).toEqual(['text']);
  });

  it('task_snapshot 走官方 xxe：没有同类型项时**末尾追加**', () => {
    const snapshot = toTaskSnapshotItem(todoSnapshot()) as TaskSnapshotItem;
    const contents: OfficialAgentContentItem[] = [{ type: 'text', content: 'x' }];
    expect(upsertTaskSnapshotItem(contents, snapshot).map((item) => item.type))
      .toEqual(['text', 'task_snapshot']);
  });

  it('task_snapshot 走官方 xxe：已有同类型项时**原地替换首个**（不追加）', () => {
    const older = { type: 'task_snapshot', content: { schema_version: 'agent_task_snapshot.v1', tasks: [{ subject: '旧' }] } } as OfficialAgentContentItem;
    const newer = toTaskSnapshotItem(todoSnapshot()) as TaskSnapshotItem;
    const result = upsertTaskSnapshotItem([older, { type: 'text', content: 'x' }], newer);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(newer);
    expect(result[1]).toEqual({ type: 'text', content: 'x' });
  });

  it('`message.contents` 非空时 task_snapshot 不参与改写（直通完全接管）', () => {
    const existing = { type: 'task_snapshot', content: { schema_version: 'agent_task_snapshot.v1', tasks: [] } } as OfficialAgentContentItem;
    const items = assembleRawAgentMessageContents({
      message: { role: 'assistant', content: 'x', contents: [existing, { type: 'text', content: 'x' }], todoSnapshot: todoSnapshot() },
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toBe(existing);
  });

  it('assistant 没有 agentTask ⇒ 只有正文（不抛）', () => {
    const items = assembleRawAgentMessageContents({ message: { role: 'assistant', content: '只有正文' } });
    expect(items).toEqual([{ type: 'text', content: '只有正文' }]);
  });

  it('没有 agentTask 但有子任务 ⇒ 子任务照样产出 subagent item', () => {
    const items = assembleRawAgentMessageContents({
      message: { role: 'assistant' },
      childTasks: [task({ id: 'child-1', goal: '子目标', startedAt: 10, completedAt: 20 })],
    });
    expect(items.map((item) => item.type)).toEqual(['subagent']);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 7. 边界
 * ══════════════════════════════════════════════════════════════════════════ */

describe('边界', () => {
  it('空消息 ⇒ 空 contents，不抛', () => {
    expect(assembleRawAgentMessageContents({ message: {} })).toEqual([]);
    expect(assembleAgentMessageContents({ message: {} })).toEqual([]);
    expect(() => assembleRawAgentMessageContents({ message: {} })).not.toThrow();
  });

  it('空字符串正文不产 text item（官方写入口用 `{type:"text",content:""}` 占位）', () => {
    expect(assembleRawAgentMessageContents({ message: { role: 'assistant', content: '' } })).toEqual([]);
    /* 只有空白字符时仍然产 item（官方 dispatcher 才会 `!content.trim()` 返回 null）—— 逐字保留。 */
    expect(assembleRawAgentMessageContents({ message: { role: 'assistant', content: '   ' } }))
      .toEqual([{ type: 'text', content: '   ' }]);
  });

  it('只有 taskSnapshot ⇒ contents 只有 task_snapshot，split 后 inline 为空、快照非空', () => {
    const input = { message: { role: 'assistant', todoSnapshot: todoSnapshot() } };
    expect(assembleRawAgentMessageContents(input).map((item) => item.type)).toEqual(['task_snapshot']);
    const split = splitAgentMessageContents(input);
    expect(split.contents).toEqual([]);
    expect(split.taskSnapshot).toEqual({
      schema_version: 'agent_task_snapshot.v1',
      tasks: [{ subject: '写脚本', status: 'in_progress', active_form: '正在写脚本' }],
    });
  });

  it('todoSnapshot.items 为空 ⇒ 不产 task_snapshot（官方不会写空快照）', () => {
    const empty: TodoSnapshot = { items: [], progress: { total: 0, completed: 0, inProgress: 0, pending: 0 }, digest: '', allCompleted: false };
    expect(toTaskSnapshotItem(empty)).toBeNull();
    expect(toTaskSnapshotItem(null)).toBeNull();
    expect(toTaskSnapshotItem(undefined)).toBeNull();
    expect(assembleRawAgentMessageContents({ message: { role: 'assistant', todoSnapshot: empty } })).toEqual([]);
  });

  it('task_snapshot 不带 plan_ready（MTV 无此字段，不臆造）', () => {
    const item = toTaskSnapshotItem(todoSnapshot());
    expect(item?.content).not.toHaveProperty('plan_ready');
  });

  it('TodoItem → 官方 AgentTaskSnapshotTask 的字段名映射逐字', () => {
    const item = toTaskSnapshotItem(todoSnapshot({
      items: [{
        content: '题面',
        status: 'completed',
        activeForm: '正在做',
        taskId: 't1',
        description: '说明',
        blocks: ['t2', 3 as unknown as string],
        blockedBy: ['t3'],
      }],
    }));
    expect(item?.content.tasks).toEqual([{
      subject: '题面',
      status: 'completed',
      active_form: '正在做',
      task_id: 't1',
      description: '说明',
      blocks: ['t2'],
      blocked_by: ['t3'],
    }]);
  });

  it('未知工具名 ⇒ 普通工具（官方 `Ug` 兜底，按 command 处理）', () => {
    expect(classifyToolEventFamily(toolEvent('weird_tool_xyz'))).toBe('plain');
    const items = assembleRawAgentMessageContents({
      message: { role: 'assistant' },
      agentTask: task({
        id: 'task-unknown',
        steps: [step({ id: 's1', title: '未知', toolCall: { callId: 'c9', toolId: 'weird_tool_xyz', retryCount: 0 } })],
      }),
    });
    expect(items.map((item) => item.type)).toEqual(['tool_event']);
    expect(classifyToolEventFamily(items[0])).toBe('plain');
  });

  it('`message.contents` 非空 ⇒ 完全接管（直通）；空数组不接管', () => {
    const direct = [
      { type: 'tool_event', content: { tool: 'read', status: 'completed' } },
      { type: 'text', content: '直通' },
    ] as OfficialAgentContentItem[];
    expect(assembleRawAgentMessageContents({
      message: { role: 'assistant', content: '被忽略', contents: direct },
      agentTask: task({ id: 't', steps: [step({ id: 's', title: 'X' })] }),
    })).toEqual(direct);
    /* 空数组 ⇒ 仍从 MTV 派生。 */
    expect(assembleRawAgentMessageContents({ message: { role: 'assistant', content: '派生', contents: [] } }))
      .toEqual([{ type: 'text', content: '派生' }]);
  });

  it('timestamp 非有限数 ⇒ text item 不带 startedAt', () => {
    const items = assembleRawAgentMessageContents({ message: { role: 'assistant', content: 'x', timestamp: Number.NaN } });
    expect(items).toEqual([{ type: 'text', content: 'x' }]);
  });

  it('多次调用不共享内部状态（纯函数）', () => {
    const input = { message: { role: 'assistant', content: 'x' } };
    const first = assembleRawAgentMessageContents(input);
    const second = assembleRawAgentMessageContents(input);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 8. 与 agentContents.ts 的组合（官方 JNe 读侧）
 * ══════════════════════════════════════════════════════════════════════════ */

describe('splitAgentMessageContents（官方 JNe @446153 读侧）', () => {
  it('剔除 task_snapshot，其余按序保留；快照取最后一个合法 content', () => {
    const older = { schema_version: 'agent_task_snapshot.v1', tasks: [{ subject: '旧' }] };
    const input = {
      message: {
        role: 'assistant',
        content: '结果',
        contents: [
          { type: 'text', content: 'old' },
          { type: 'task_snapshot', content: older },
          { type: 'text', content: '结果' },
        ] as OfficialAgentContentItem[],
      },
    };
    const split = splitAgentMessageContents(input);
    expect(split.contents.map((item) => item.type)).toEqual(['text', 'text']);
    expect(split.taskSnapshot).toEqual(older);
  });

  it('反复调用稳定（幂等）', () => {
    const input = {
      message: { role: 'assistant', content: '结果', timestamp: 5, todoSnapshot: todoSnapshot() },
      agentTask: task({
        id: 't',
        steps: [step({ id: 's1', title: '读', toolCall: { callId: 'c1', toolId: 'file_read_text', retryCount: 0, startedAt: 1, finishedAt: 2 } })],
      }),
    };
    expect(splitAgentMessageContents(input)).toEqual(splitAgentMessageContents(input));
  });
});
