/**
 * 「消息级有序 `contents: Item[]`」**模型层生产者**回归（覆盖表 §6 #1）。
 *
 * 官方消息模型是 `{contents: Item[]}`，`Z0`/`$M` **按数组顺序逐项分派**。本模块是 MTV 侧的
 * **生产者**：`buildMessageContents` 把 `message.content`（`text` item）、`agentTask.steps`
 * （`tool_event` item）、子任务（`subagent` item）、`message.compactedAt`（`compact` item）
 * 装配成同一份官方有序列表；`buildActivitySegmentsFromContents` 只按该列表顺序分桶。
 *
 * 验证分级 = **(b) 纯逻辑断言**（未做 live CDP）。
 */
import { describe, expect, it } from 'vitest';
import {
  absorbActivityRuns,
  buildActivitySegments,
  buildActivitySegmentsFromContents,
  buildMessageContents,
  type MessageActivitySegment,
} from '../../../src/services/chat/messageContents';
import type { AgentMessageContentItem } from '../../../src/services/chat/agentMessageContents';
import type { AgentStep, AgentTask } from '../../../src/types/agent';
import type { ToolEventLike } from '../../../src/services/chat/agentToolLabels';

function toolStep(id: string, toolId: string, at: number, extra: Partial<AgentStep['toolCall']> = {}): AgentStep {
  return {
    id,
    taskId: 'task-1',
    index: 0,
    kind: 'tool',
    title: `步骤 ${id}`,
    status: 'succeeded',
    createdAt: at,
    updatedAt: at + 10,
    toolCall: { callId: `call-${id}`, toolId, retryCount: 0, startedAt: at, finishedAt: at + 10, ...extra },
  };
}

function task(steps: AgentStep[], over: Partial<AgentTask> = {}): AgentTask {
  return { id: 'task-1', goal: '测试', status: 'running', steps, createdAt: 1, updatedAt: 2, ...over } as AgentTask;
}

function childTask(id: string, at: number, over: Partial<AgentTask> = {}): AgentTask {
  return {
    id,
    parentTaskId: 'task-1',
    goal: `子任务 ${id}`,
    status: 'running',
    steps: [],
    createdAt: at,
    updatedAt: at,
    startedAt: at,
    ...over,
  } as AgentTask;
}

/** 有序列表的类型序列（断言顺序用）。 */
function types(contents: readonly AgentMessageContentItem[]): string[] {
  return contents.map((item) => item.type);
}

function kinds(segments: MessageActivitySegment[]): string[] {
  return segments.map((segment) => {
    if (segment.kind === 'cards') return `cards:${segment.items.length}`;
    if (segment.kind === 'compact') return `compact:${segment.phase}`;
    if (segment.kind === 'text') return `text:${segment.text}`;
    return `tools:${segment.blocks.length}`;
  });
}

const childEventOf = (item: AgentTask): ToolEventLike => (
  { type: 'tool_event', content: { subagent_id: item.id }, startedAt: item.startedAt ?? 0 } as ToolEventLike
);
const childItemsOf = (): readonly ToolEventLike[] => [];

describe('§6 #1 —— `buildMessageContents`（官方有序 `contents` 的生产者）', () => {
  it('工具 → 子代理 → compact → 正文：四类 item 都在；**正文恒在最后**', () => {
    const contents = buildMessageContents({
      content: '正文',
      timestamp: 500,
      compactedAt: 9_000,
      agentTask: task([toolStep('s1', 'canvas_query', 1_000)]),
      childTasks: [childTask('child-1', 2_000)],
    });
    /* 官方 `contents` 是「事件到达即追加」；MTV 只有一个**最终**正文字符串
       ⇒ 它的到达顺序等价于「全部工具事件之后」（见 `orderEntries` 的注释）。
       早前这里把正文排在最前（用 `message.timestamp` 当排序键）⇒ 官方「折叠摘要行在正文之上」
       的版式永远不可能成立（用户实测 图7/8）。 */
    expect(types(contents)).toEqual(['tool_event', 'subagent', 'compact', 'text']);
    expect(contents[0]).toMatchObject({ type: 'tool_event', content: { tool: 'canvas_context' } });
    expect(contents[1]).toMatchObject({ type: 'subagent', content: { subagent_id: 'child-1' } });
    expect(contents[2]).toMatchObject({ type: 'compact', content: { phase: 'finished' } });
    expect(contents[3]).toMatchObject({ type: 'text', content: '正文' });
  });

  it('卡片不单独成型：`contents` 里它就是 `tool_event`（分派是渲染层 `$M` 的事）', () => {
    const contents = buildMessageContents({
      content: '',
      timestamp: 500,
      agentTask: task([
        toolStep('s1', 'canvas_query', 1_000),
        toolStep('s2', 'show_form', 2_000),
        toolStep('s3', 'canvas_undo', 3_000),
      ]),
    });
    expect(types(contents)).toEqual(['tool_event', 'tool_event', 'tool_event']);
    /* 顺序 = 时间戳（不是数组下标）。 */
    expect(contents.map((item) => (item.type === 'tool_event' ? item.content.tool : '')))
      .toEqual(['canvas_context', 'show_form', 'canvas_undo']);
  });

  it('空正文不产 `text` item；无任务/无压缩 ⇒ 空列表', () => {
    expect(buildMessageContents({ content: '', timestamp: 1 })).toEqual([]);
    expect(buildMessageContents({ content: undefined, agentTask: task([]) })).toEqual([]);
  });

  it('compact 只由 `message.compactedAt` 产出（phase 恒为 finished）', () => {
    const contents = buildMessageContents({ content: 'x', timestamp: 1, compactedAt: 4 });
    expect(types(contents)).toEqual(['compact', 'text']);
    expect(contents[0]).toEqual({ type: 'compact', content: { phase: 'finished' } });
    expect(buildMessageContents({ content: 'x', timestamp: 1 })).toHaveLength(1);
  });

  it('**没有** `stopped` item：官方 `contents` 里不存在这一型（官方 `Fit` 是消息列表级的）', () => {
    const contents = buildMessageContents({
      content: 'x',
      timestamp: 1,
      agentTask: task([toolStep('s1', 'canvas_query', 2_000)], { status: 'stopped' }),
    });
    expect(types(contents)).not.toContain('stopped');
    expect(types(contents)).toEqual(['tool_event', 'text']);
  });
});

describe('§6 #1 —— `buildActivitySegmentsFromContents`（按列表顺序分桶，不再排序）', () => {
  it('正文 → 工具 → 卡片 → 工具 ⇒ 正文也成一段（官方 `$M` 对 `text` 就是就地渲染）', () => {
    const contents: AgentMessageContentItem[] = [
      { type: 'text', content: '正文' },
      toolItem('canvas_query', 1_000),
      toolItem('show_form', 2_000),
      toolItem('canvas_undo', 3_000),
    ];
    expect(kinds(buildActivitySegmentsFromContents(contents)))
      .toEqual(['text:正文', 'tools:1', 'cards:1', 'tools:1']);
  });

  it('顺序**完全由 `contents` 决定**（与 item 自己的 `startedAt` 无关）', () => {
    const contents: AgentMessageContentItem[] = [
      toolItem('show_form', 9_000),
      toolItem('canvas_query', 1_000),
    ];
    expect(kinds(buildActivitySegmentsFromContents(contents))).toEqual(['cards:1', 'tools:1']);
  });

  it('`compact` 自成一（有序）段；`subagent` item 变子代理块', () => {
    const contents: AgentMessageContentItem[] = [
      toolItem('canvas_query', 1_000),
      { type: 'compact', content: { phase: 'finished' } },
      { type: 'subagent', content: { subagent_id: 'child-1', status: 'stopped' } },
    ];
    const segments = buildActivitySegmentsFromContents(contents, { childTasks: [childTask('child-1', 2_000)] });
    expect(kinds(segments)).toEqual(['tools:1', 'compact:finished', 'tools:1']);
    const last = segments[2];
    if (last.kind !== 'tools') throw new Error('unreachable');
    expect(last.blocks[0].kind).toBe('subagent');
  });

  it('子代理 item 在 `childTasks` 里找不到对应任务 ⇒ 子代理块无子项（不抛）', () => {
    const segments = buildActivitySegmentsFromContents([
      { type: 'subagent', content: { subagent_id: 'missing', status: 'running' } },
    ]);
    expect(segments).toHaveLength(1);
    const block = segments[0].kind === 'tools' ? segments[0].blocks[0] : null;
    expect(block?.kind).toBe('subagent');
    expect(block?.children ?? []).toHaveLength(0);
  });
});

describe('§6 #1 —— 旧 API `buildActivitySegments` 与生产者共用同一套排序/分桶', () => {
  it('工具 → 卡片 → 工具 ⇒ 三段（与 `buildMessageContents` 路径一致）', () => {
    const segments = buildActivitySegments({
      items: [toolItem('canvas_query', 1_000), toolItem('show_form', 2_000), toolItem('canvas_undo', 3_000)],
      childEventOf,
      childItemsOf,
    });
    expect(kinds(segments)).toEqual(['tools:1', 'cards:1', 'tools:1']);
  });

  it('顺序按时间戳（不是数组下标）；空输入返回空', () => {
    const segments = buildActivitySegments({
      items: [toolItem('show_form', 9_000), toolItem('canvas_query', 1_000)],
      childEventOf,
      childItemsOf,
    });
    expect(kinds(segments)).toEqual(['tools:1', 'cards:1']);
    expect(buildActivitySegments({ items: [], childEventOf, childItemsOf })).toEqual([]);
  });

  it('子任务按时间戳插进**同一工具段**', () => {
    const segments = buildActivitySegments({
      items: [toolItem('canvas_query', 1_000), toolItem('canvas_undo', 2_000)],
      childTasks: [childTask('child-1', 1_500)],
      childEventOf,
      childItemsOf,
    });
    expect(segments).toHaveLength(1);
    const segment = segments[0];
    if (segment.kind !== 'tools') throw new Error('unreachable');
    expect(segment.blocks.map((block) => block.kind)).toEqual(['items', 'subagent', 'items']);
  });
});

function toolItem(tool: string, at: number, extra: Record<string, unknown> = {}): AgentMessageContentItem {
  return {
    type: 'tool_event',
    content: { schema_version: 'tool_event.v1', type: 'tool_event', tool, status: 'completed', ...extra },
    startedAt: at,
  } as AgentMessageContentItem;
}

/* ============================================================================
 * 真机复现（用户实测「生成2只非洲象 9:16尺寸」那条消息）：
 * 一次 MTV 媒体生成 = `AgentStep.kind:'approval'` + `approval.kind:'media_generation'`
 * ⇒ 官方 `contents` 里必须是**两项**（确认卡 + 被执行的工具事件），否则消息里没有任何
 * 普通工具事件 ⇒ 官方 `lae` 的 `F` 分块没有 `collapsible` 块 ⇒「处理了 Xs」与操作行全不渲染。
 *
 * 下面的 fixture 字段全部来自真机 dump（`useAppStore.agentTasks` 里那条任务），只把
 * 绝对时间戳挪成小整数便于断言。
 * ========================================================================== */

const LIVE_CALL_ID = 'call_f8f32c8634b54ca68adb661666bd7c20';

/** 真机那条任务的唯一一步（`approval/media_generation`，已批准并执行成功）。 */
function liveMediaStep(over: Partial<AgentStep> = {}): AgentStep {
  return {
    id: 'agent-mvexfg1t-hblux8-step-0-y2k8',
    taskId: 'agent-mvexfg1t-hblux8',
    index: 0,
    kind: 'approval',
    title: '生成媒体内容',
    status: 'succeeded',
    createdAt: 1_000,
    updatedAt: 56_000,
    toolCall: {
      callId: LIVE_CALL_ID,
      toolId: 'media_generate',
      inputSummary: '使用 general/provider-tudou-vgcgsv生成图片，输出到对话',
      retryCount: 0,
      startedAt: 1_000,
      finishedAt: 56_000,
      effect: 'media_generation',
      resultSummary: '媒体内容已生成',
    },
    approval: {
      id: 'agent-mvexfg1t-hblux8-step-0-y2k8-approval',
      kind: 'media_generation',
      status: 'approved',
      summary: '付费媒体生成和重新生成每次都需要确认',
      requestedAt: 1_000,
      resolvedAt: 25_000,
      inputRequest: {
        kind: 'media_model',
        mediaKind: 'image',
        generationRequest: { kind: 'image', prompt: '两只非洲象…', modelName: 'general/provider-tudou-vgcgsv', aspectRatio: '9:16', times: 1 },
        selectedModelRef: 'general/provider-tudou-vgcgsv',
      },
    },
    outputSummary: '媒体内容已生成',
    ...over,
  } as AgentStep;
}

const LIVE_ANSWER = ' 已生成 9:16 竖版的两只非洲象图片。';

describe('§6 #1 —— 媒体生成步骤 = 官方两项（确认卡 + 执行的工具事件）', () => {
  it('已批准的 `media_generation` ⇒ `generation_confirmation` 卡 **+** 一条普通工具事件', () => {
    const contents = buildMessageContents({
      content: LIVE_ANSWER,
      timestamp: 1_000,
      agentTask: task([liveMediaStep()], { startedAt: 900, completedAt: 100_000 }),
    });
    expect(types(contents)).toEqual(['tool_event', 'tool_event', 'text']);
    /* 顺序 = 官方「组 → 卡 → 正文」所需的顺序：**执行的工具事件在前、确认卡在后**。
       官方成因（`agentMessageContents` §7c 有逐字偏移）：卡片块 `JG === false` 永不进折叠组，
       折叠组只渲染在 `absorbFrom`（第一个被吸收块）上 ⇒ 卡在组上/组下由它在 `contents` 里的下标决定。
       官方写入口里确认卡是「用户确认前到达的最后一条 tool_event」⇒ 排在本次生成的工具事件之后。 */
    expect(contents[0]).toMatchObject({
      type: 'tool_event',
      content: {
        tool: 'media_generate',
        status: 'completed',
        request: { description: '生成媒体内容' },
        response: { summary: '媒体内容已生成' },
      },
    });
    /* 第二项：官方 `dg` 确认卡（`generation_confirmation`）⇒ `qet`。 */
    expect(contents[1]).toMatchObject({ type: 'tool_event', content: { tool: 'generation_confirmation', status: 'completed' } });
    /* 两个 item 自己的时机**没有变**（只有装配排序键改道，见 `itemAppendOrderAt`）：
       卡 = 审批请求时刻 → 工具结束；执行项 = 审批**通过**时刻 → 工具结束。 */
    expect(contents[0]).toMatchObject({ startedAt: 25_000, endedAt: 56_000 });
    expect(contents[1]).toMatchObject({ startedAt: 1_000, endedAt: 56_000 });
    /* `tool_call_id` 必须与卡区分：同 id 会被官方 `oie`/`Fx` 去重掉一项。 */
    expect((contents[0] as { content: { tool_call_id: string } }).content.tool_call_id).toBe(`${LIVE_CALL_ID}:execution`);
    expect((contents[1] as { content: { tool_call_id: string } }).content.tool_call_id).toBe(LIVE_CALL_ID);
  });

  it('拆项后**真正**产生「处理了 Xs」分组：分段 = 工具段 + 卡 + 正文（卡在组**下方**，且常显）', () => {
    const contents = buildMessageContents({
      content: LIVE_ANSWER,
      timestamp: 1_000,
      agentTask: task([liveMediaStep()], { startedAt: 900, completedAt: 100_000 }),
    });
    const segments = buildActivitySegmentsFromContents(contents);
    /* 官方版式 = 「步骤组 → 卡 → 正文」（用户实测的官方截图）：
       `tools` 段在前 ⇒ `absorbActivityRuns` 的 `absorbFrom = 0`（组渲染在第 0 段），
       `cards` 段在组之后、正文之前 ⇒ 卡片**常显**且落在组**下方**。 */
    expect(kinds(segments)).toEqual(['tools:1', 'cards:1', `text:${LIVE_ANSWER}`]);
    const runs = absorbActivityRuns(segments);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ absorbFrom: 0, lastAbsorbable: 0, absorbTextInRange: false });
    /* 卡**不在**吸收区间里（= 不会被折进「处理了 Xs」内部，官方 `JG` 对卡片返回 false）。 */
    expect(runs[0].toolSegments).toHaveLength(1);
    expect(runs[0].toolSegments[0].blocks).toHaveLength(1);
  });

  it('审批还挂着（`pending`）⇒ 只有确认卡，不产执行行', () => {
    const step = liveMediaStep({
      status: 'waiting_approval',
      toolCall: { ...liveMediaStep().toolCall!, finishedAt: undefined },
      approval: { ...liveMediaStep().approval!, status: 'pending', resolvedAt: undefined },
    } as Partial<AgentStep>);
    const contents = buildMessageContents({ content: LIVE_ANSWER, agentTask: task([step]) });
    expect(contents.map((item) => (item.type === 'tool_event' ? item.content.tool : item.type)))
      .toEqual(['generation_confirmation', 'text']);
  });

  it('审批被拒（`rejected`）⇒ 只有确认卡（官方那时也没执行过）', () => {
    const step = liveMediaStep({
      status: 'skipped',
      approval: { ...liveMediaStep().approval!, status: 'rejected' },
    } as Partial<AgentStep>);
    const contents = buildMessageContents({ content: LIVE_ANSWER, agentTask: task([step]) });
    expect(contents.filter((item) => item.type === 'tool_event')).toHaveLength(1);
  });

  it('执行失败 ⇒ 执行行的 `status` 是官方 `failed`（组内文案回落官方 `toolLabels`）', () => {
    const step = liveMediaStep({
      status: 'failed',
      toolCall: { ...liveMediaStep().toolCall!, resultSummary: '图片生成失败' },
    } as Partial<AgentStep>);
    const contents = buildMessageContents({ content: LIVE_ANSWER, agentTask: task([step]) });
    /* 执行行在**前**（= 它进折叠组），确认卡在后（= 组下方常显，官方版式）。 */
    expect(contents[0]).toMatchObject({ type: 'tool_event', content: { tool: 'media_generate', status: 'failed' } });
    expect(contents[1]).toMatchObject({ type: 'tool_event', content: { tool: 'generation_confirmation' } });
  });

  it('非 `media_generation` 的审批（`canvas_write` → 节点更新卡）**不**拆项（本轮不扩面）', () => {
    const step = liveMediaStep({
      title: '更新画布节点',
      toolCall: { ...liveMediaStep().toolCall!, toolId: 'canvas_update_node' },
      approval: { ...liveMediaStep().approval!, kind: 'canvas_write' },
    } as Partial<AgentStep>);
    const contents = buildMessageContents({ content: LIVE_ANSWER, agentTask: task([step]) });
    expect(contents.filter((item) => item.type === 'tool_event')).toHaveLength(1);
  });
});
