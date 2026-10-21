/**
 * 官方 live「有序 contents: Item[]」层回归测试
 * （`vendor-pkg-canvas-ChpWx5JY.js` 的 `JNe`/`DD` @446152·@445911、`Ug` 及 13 个工具族谓词 @444004…@445151、
 *  `e1e` @446152 与它依赖的 `Kv` @414092 / `TY` @429244 / `TD` @430830 / `aNe` @428787 / `lNe` @428841 / `HNe` @442687）。
 *
 * ⚠️ `task_snapshot` / `tool_event` 的 fixture 一律用「写入口逐字形状」，见每个 fixture 上方的官方偏移。
 */
import { describe, expect, it } from 'vitest';
import {
  collectNodeChips,
  isPlainToolEvent,
  splitAgentContents,
} from '../src/services/chat/agentContents';

/* ── fixture 工厂（形状逐字照官方写入口） ─────────────────────────────────── */

/** 官方 `tool_event` wire 形状（`Gge` @21101；mock item @2327757 补 `ui`/`projection_revision`）。 */
function toolEvent(
  tool: string,
  extra: Record<string, unknown> = {},
  status = 'completed',
): { type: 'tool_event'; content: Record<string, unknown> } {
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

/** 官方 `task_snapshot` item（`xxe` @32022：只有 `type` + `content`）。 */
function taskSnapshot(content: unknown): { type: 'task_snapshot'; content: unknown } {
  return { type: 'task_snapshot', content };
}

const VALID_SNAPSHOT = {
  schema_version: 'agent_task_snapshot.v1',
  tasks: [{ subject: '写脚本', status: 'in_progress', active_form: '正在写脚本' }],
};

describe('splitAgentContents（官方 JNe @446152 / DD @445911）', () => {
  it('剔除 task_snapshot 并保留其余 item 的顺序', () => {
    const contents = [
      { type: 'text', content: 'hi' },
      taskSnapshot(VALID_SNAPSHOT),
      { type: 'thinking', content: '想' },
      toolEvent('read'),
    ];
    const { inlineContents, taskSnapshot: snapshot } = splitAgentContents(contents);

    expect(inlineContents.map((item) => item.type)).toEqual(['text', 'thinking', 'tool_event']);
    expect(snapshot).toEqual(VALID_SNAPSHOT);
  });

  it('taskSnapshot 取**最后一个**合法快照（DD 从后往前）', () => {
    const older = { schema_version: 'agent_task_snapshot.v1', tasks: [{ subject: '旧' }] };
    const newer = { schema_version: 'agent_task_snapshot.v1', tasks: [{ subject: '新' }] };
    expect(splitAgentContents([taskSnapshot(older), taskSnapshot(newer)]).taskSnapshot).toEqual(newer);
  });

  it('schema_version 不是 agent_task_snapshot.v1 ⇒ taskSnapshot 为 null，但该 item 仍被剔除', () => {
    const contents = [
      { type: 'text', content: 'a' },
      taskSnapshot({ schema_version: 'agent_task_snapshot.v2', tasks: [] }),
    ];
    const result = splitAgentContents(contents);

    expect(result.taskSnapshot).toBeNull();
    expect(result.inlineContents.map((item) => item.type)).toEqual(['text']);
  });

  it('tasks 不是数组 ⇒ taskSnapshot 为 null', () => {
    expect(splitAgentContents([taskSnapshot({ schema_version: 'agent_task_snapshot.v1', tasks: null })]).taskSnapshot).toBeNull();
    expect(splitAgentContents([taskSnapshot({ schema_version: 'agent_task_snapshot.v1' })]).taskSnapshot).toBeNull();
  });

  it('同一个 task_snapshot 不合法时会继续往前找（DD 的 continue 语义）', () => {
    const good = { schema_version: 'agent_task_snapshot.v1', tasks: [{ subject: '好' }] };
    const bad = { schema_version: 'agent_task_snapshot.v1', tasks: 'nope' };
    expect(splitAgentContents([taskSnapshot(good), taskSnapshot(bad)]).taskSnapshot).toEqual(good);
  });

  it('没有 task_snapshot ⇒ taskSnapshot 为 null，inlineContents 是全集', () => {
    const contents = [{ type: 'text', content: 'a' }, toolEvent('read')];
    const result = splitAgentContents(contents);

    expect(result.taskSnapshot).toBeNull();
    expect(result.inlineContents).toHaveLength(2);
  });

  it('空数组不抛', () => {
    expect(splitAgentContents([])).toEqual({ inlineContents: [], taskSnapshot: null });
  });

  it('task_snapshot 的 content 缺失/null/非对象时不抛，返回 null', () => {
    expect(() => splitAgentContents([taskSnapshot(null)])).not.toThrow();
    expect(splitAgentContents([taskSnapshot(null)]).taskSnapshot).toBeNull();
    expect(splitAgentContents([taskSnapshot('oops')]).taskSnapshot).toBeNull();
    expect(splitAgentContents([{ type: 'task_snapshot' }]).taskSnapshot).toBeNull();
  });
});

describe('isPlainToolEvent（官方 Ug @446152）', () => {
  it('非 tool_event 的 4 种 item 一律 false', () => {
    expect(isPlainToolEvent({ type: 'text', content: 'hi' })).toBe(false);
    expect(isPlainToolEvent({ type: 'thinking', content: '想' })).toBe(false);
    expect(isPlainToolEvent({ type: 'subagent', content: { subagent_id: 's1', status: 'running' } })).toBe(false);
    expect(isPlainToolEvent(taskSnapshot(VALID_SNAPSHOT))).toBe(false);
  });

  it('普通工具（read / write / 叫不出名字的自定义工具）返回 true', () => {
    expect(isPlainToolEvent(toolEvent('read'))).toBe(true);
    expect(isPlainToolEvent(toolEvent('write', {}, 'started'))).toBe(true);
    expect(isPlainToolEvent(toolEvent('create_text_node'))).toBe(true);
  });

  it('content 缺失 / 为 null / 为字符串时不抛；官方 Ug 只判顶层 type ⇒ 仍是 true', () => {
    /* 官方 `Ug` 的顶层只有 `e.type==="tool_event"`，content 的判据**在 13 个谓词内部**
       （`xl`/`Hb`/`AD` 各自先看 `typeof content === "object"`），所以 content 缺失时它们全 false，
       `!false && !false && …` ⇒ `Ug` 返回 **true**。这是官方行为，不是宽松实现。 */
    expect(() => isPlainToolEvent({ type: 'tool_event' })).not.toThrow();
    expect(isPlainToolEvent({ type: 'tool_event' })).toBe(true);
    expect(isPlainToolEvent({ type: 'tool_event', content: null })).toBe(true);
    expect(isPlainToolEvent({ type: 'tool_event', content: 'tool_event' })).toBe(true);
    /* 顶层 type 不是 tool_event ⇒ false。 */
    expect(isPlainToolEvent({})).toBe(false);
    expect(isPlainToolEvent({ type: 'text' })).toBe(false);
  });

  it('13 个谓词对「content 缺失」都不抛（逐个走一遍官方 xl/Hb 的 typeof 判据）', () => {
    const specialTools = [
      'AskUserQuestion', 'generation_confirmation', 'cost_limit_confirmation', 'node_update_confirmation',
      'desktop_fs_confirmation', 'show_widget', 'show_html', 'get_connector_status', 'show_form',
      'prepare_widget', 'gen_image', 'todowrite',
    ];
    for (const tool of specialTools) {
      expect(() => isPlainToolEvent({ type: 'tool_event', content: null })).not.toThrow();
      expect(isPlainToolEvent({ type: 'tool_event', content: { tool } })).toBe(false);
    }
  });

  /* ── 第 1 族：$b = MNe（AskUserQuestion / ask_question） ── */
  it('$b：AskUserQuestion / ask_question ⇒ false（大小写敏感）', () => {
    expect(isPlainToolEvent(toolEvent('AskUserQuestion'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('ask_question'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('askquestion'))).toBe(true);
    expect(isPlainToolEvent(toolEvent('ASK_QUESTION'))).toBe(true);
  });

  /* ── 第 2 族：dg = PNe ── */
  it('dg：generation_confirmation ⇒ false', () => {
    expect(isPlainToolEvent(toolEvent('generation_confirmation'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('Generation_Confirmation'))).toBe(true);
  });

  /* ── 第 3 族：wS = RNe ── */
  it('wS：cost_limit_confirmation ⇒ false', () => {
    expect(isPlainToolEvent(toolEvent('cost_limit_confirmation'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('cost_limit'))).toBe(true);
  });

  /* ── 第 4 族：iT = DNe ── */
  it('iT：node_update_confirmation ⇒ false', () => {
    expect(isPlainToolEvent(toolEvent('node_update_confirmation'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('node_update'))).toBe(true);
  });

  /* ── 第 5 族：kD = LNe（5 个成员，逐个） ── */
  it('kD：desktop_* 与 batch_download_files_confirmation 这 5 个成员全部 ⇒ false', () => {
    const members = [
      'desktop_open_app_confirmation',
      'desktop_capture_screen_confirmation',
      'desktop_fs_confirmation',
      'desktop_shell_command_confirmation',
      'batch_download_files_confirmation',
    ];
    for (const member of members) expect(isPlainToolEvent(toolEvent(member))).toBe(false);
    expect(isPlainToolEvent(toolEvent('desktop_fs'))).toBe(true);
  });

  /* ── 第 6 族：AD（不看工具名，看 content.ui.resource_uri） ── */
  it('AD：content.ui.resource_uri 为非空字符串 ⇒ false；空串/缺失/ui 非对象 ⇒ true', () => {
    expect(isPlainToolEvent(toolEvent('show_previs', { ui: { resource_uri: 'ui://tapnow/previs@v3' } }))).toBe(false);
    expect(isPlainToolEvent(toolEvent('show_previs', { ui: { resource_uri: '' } }))).toBe(true);
    expect(isPlainToolEvent(toolEvent('show_previs', { ui: {} }))).toBe(true);
    expect(isPlainToolEvent(toolEvent('show_previs', { ui: 'ui://x' }))).toBe(true);
    expect(isPlainToolEvent(toolEvent('show_previs'))).toBe(true);
  });

  /* ── 第 7 族：aT = FNe ── */
  it('aT：show_widget ⇒ false（大小写敏感）', () => {
    expect(isPlainToolEvent(toolEvent('show_widget'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('Show_Widget'))).toBe(true);
  });

  /* ── 第 8 族：lT = ONe ── */
  it('lT：show_html ⇒ false', () => {
    expect(isPlainToolEvent(toolEvent('show_html'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('show-html'))).toBe(true);
  });

  /* ── 第 9 族：ID = zNe ── */
  it('ID：get_connector_status ⇒ false', () => {
    expect(isPlainToolEvent(toolEvent('get_connector_status'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('connector_status'))).toBe(true);
  });

  /* ── 第 10 族：jD = UNe ── */
  it('jD：show_form ⇒ false', () => {
    expect(isPlainToolEvent(toolEvent('show_form'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('showform'))).toBe(true);
  });

  /* ── 第 11 族：MD = BNe ── */
  it('MD：prepare_widget ⇒ false', () => {
    expect(isPlainToolEvent(toolEvent('prepare_widget'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('prepare_widget_v2'))).toBe(true);
  });

  /* ── 第 12 族：ib = XNe（gen_image / gen_video / generation_request） ── */
  it('ib：gen_image / gen_video / generation_request ⇒ false', () => {
    expect(isPlainToolEvent(toolEvent('gen_image'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('gen_video'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('generation_request'))).toBe(false);
  });

  it('ib 的集合**不含** gen_audio（那是 HNe 的成员，不是 XNe 的）⇒ gen_audio 是普通工具', () => {
    expect(isPlainToolEvent(toolEvent('gen_audio'))).toBe(true);
  });

  it('ib 大小写敏感：GEN_IMAGE ⇒ true（与 Xv 不同，Xv 会 toLowerCase）', () => {
    expect(isPlainToolEvent(toolEvent('GEN_IMAGE'))).toBe(true);
  });

  /* ── 第 13 族：Xv = VNe（todowrite / memory / inspect_canvas）+ 空的 UY 分支 ── */
  it('Xv：todowrite / memory / inspect_canvas ⇒ false，且这里**大小写不敏感**（官方先 toLowerCase）', () => {
    expect(isPlainToolEvent(toolEvent('todowrite'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('memory'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('inspect_canvas'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('TodoWrite'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('INSPECT_CANVAS'))).toBe(false);
    expect(isPlainToolEvent(toolEvent('todowrite_v2'))).toBe(true);
  });

  it('Xv 的第二分支（官方 UY 是空 Set）是死代码：status=completed + 空/未知工具名仍算普通工具', () => {
    expect(isPlainToolEvent(toolEvent('', {}, 'completed'))).toBe(true);
    expect(isPlainToolEvent(toolEvent('whatever', {}, 'completed'))).toBe(true);
  });
});

describe('collectNodeChips（官方 e1e @446152；Kv @414092 / TY @429244 / TD @430830 / HNe @442687）', () => {
  it('Kv 归一化：`" TapNow_CLI "` + canvas_changed(actions 含 `" create "`) ⇒ 产出节点胶囊', () => {
    const chips = collectNodeChips([
      toolEvent(' TapNow_CLI ', {
        tool_call_id: 'cli-1',
        response: { canvas_changed: { actions: [' create '], node_ids: ['node-1', '   '] } },
      }),
    ]);

    expect(chips).toEqual([{ key: 'node-1', nodeId: 'node-1', tool: ' TapNow_CLI ', title: undefined }]);
  });

  it('Kv：`bash` 只有 status 为 completed 才算', () => {
    const response = { canvas_changed: { actions: ['generate'], node_ids: ['n1'] } };
    expect(collectNodeChips([toolEvent('bash', { response }, 'pending')])).toEqual([]);
    expect(collectNodeChips([toolEvent('bash', { response }, 'completed')])).toHaveLength(1);
  });

  it('Kv：canvas_changed.actions 不含 create/bind_job/generate ⇒ 无节点', () => {
    const chips = collectNodeChips([
      toolEvent('bash', {
        response: { canvas_changed: { actions: ['delete', 'update'], node_ids: ['n1'] } },
      }),
    ]);
    expect(chips).toEqual([]);
  });

  it('Kv：node_ids 里非 string 或全空白的项被过滤', () => {
    const chips = collectNodeChips([
      toolEvent('bash', {
        response: { canvas_changed: { actions: ['bind_job'], node_ids: ['n1', 7, '  ', null] } },
      }),
    ]);
    expect(chips.map((chip) => chip.nodeId)).toEqual(['n1']);
  });

  it('gen_image completed + response.items[].node_id ⇒ 胶囊（TD 路径，无 title）', () => {
    const chips = collectNodeChips([
      toolEvent('gen_image', { response: { items: [{ node_id: 'n1' }, { node_id: 'n2' }, { other: 1 }] } }),
    ]);

    expect(chips).toEqual([
      { key: 'n1', nodeId: 'n1', tool: 'gen_image' },
      { key: 'n2', nodeId: 'n2', tool: 'gen_image' },
    ]);
  });

  it('gen_image completed + response.group_node_id / node_ids ⇒ 组节点排在最前', () => {
    const chips = collectNodeChips([
      toolEvent('gen_video', { response: { group_node_id: 'g1', node_ids: ['a', 'b', 9] } }),
    ]);

    expect(chips.map((chip) => chip.nodeId)).toEqual(['g1', 'a', 'b']);
  });

  it('gen_image pending + response.node_ids ⇒ 先占位；同 nodeId 的后续项**不覆盖**（官方 n.has 判据）', () => {
    const chips = collectNodeChips([
      toolEvent('gen_image', { tool_call_id: 'c1', response: { node_ids: ['x'] } }, 'pending'),
      toolEvent('gen_video', { tool_call_id: 'c2', response: { node_ids: ['x'] } }, 'pending'),
    ]);

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ nodeId: 'x', tool: 'gen_image' });
  });

  it('gen_image completed 同 nodeId ⇒ **覆盖**（官方 n.set 无条件）', () => {
    const chips = collectNodeChips([
      toolEvent('gen_image', { tool_call_id: 'c1', response: { node_ids: ['x'] } }, 'pending'),
      toolEvent('gen_video', { tool_call_id: 'c2', response: { node_ids: ['x'] } }, 'completed'),
    ]);

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ nodeId: 'x', tool: 'gen_video' });
  });

  it('pending 且没有节点 ⇒ 产出 `pending-<toolCallId>` 伪胶囊（nodeId 为 null）', () => {
    expect(collectNodeChips([toolEvent('gen_image', { tool_call_id: 'c9', response: {} }, 'started')])).toEqual([
      { key: 'pending-c9', nodeId: null, tool: 'gen_image' },
    ]);
  });

  it('同一 callId 后来 completed 并产出节点 ⇒ pending 伪胶囊被丢弃', () => {
    const chips = collectNodeChips([
      toolEvent('gen_image', { tool_call_id: 'c9', response: {} }, 'pending'),
      toolEvent('gen_image', { tool_call_id: 'c9', response: { node_ids: ['n9'] } }, 'completed'),
    ]);

    expect(chips).toEqual([{ key: 'n9', nodeId: 'n9', tool: 'gen_image' }]);
  });

  it('status 为 failed / 未知 ⇒ 完全不参与计数', () => {
    const response = { node_ids: ['n1'] };
    expect(collectNodeChips([toolEvent('gen_image', { response }, 'failed')])).toEqual([]);
    expect(collectNodeChips([toolEvent('gen_image', { response }, 'progress')])).toEqual([]);
  });

  it('HNe 与 XNe 的差异：generation_request **不**进 e1e，gen_audio **进** e1e', () => {
    const response = { node_ids: ['n1'] };
    expect(collectNodeChips([toolEvent('generation_request', { response })])).toEqual([]);
    expect(collectNodeChips([toolEvent('gen_audio', { response })])).toEqual([
      { key: 'n1', nodeId: 'n1', tool: 'gen_audio' },
    ]);
  });

  it('闸门大小写敏感：GEN_IMAGE 未命中 HNe ⇒ 不计数', () => {
    expect(collectNodeChips([toolEvent('GEN_IMAGE', { response: { node_ids: ['n1'] } })])).toEqual([]);
  });

  it('tool_call_id 缺失时回退 tool_use_id（官方 p 的取值顺序）', () => {
    const item = {
      type: 'tool_event',
      content: {
        schema_version: 'tool_event.v1',
        type: 'tool_event',
        tool: 'gen_image',
        status: 'pending',
        tool_use_id: 'use-1',
        response: {},
      },
    };
    expect(collectNodeChips([item])).toEqual([{ key: 'pending-use-1', nodeId: null, tool: 'gen_image' }]);
  });

  it('非工具 item / content 缺失 / 空数组不抛', () => {
    expect(collectNodeChips([])).toEqual([]);
    expect(collectNodeChips([{ type: 'text', content: 'hi' }])).toEqual([]);
    expect(collectNodeChips([{ type: 'tool_event' }])).toEqual([]);
    expect(collectNodeChips([{ type: 'tool_event', content: null }])).toEqual([]);
  });
});
