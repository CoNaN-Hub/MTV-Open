/**
 * `stepToToolEvent` / `taskStepsToToolEvents` 的官方字段回归。
 *
 * 背景（round 27 主 agent 根治修复）：
 * 官方 `tool_event` 的 **content** 里带 `tool_call_id`（`Gge` @21175 生产、`iS` @21009 读取），
 * 而 MTV 的 `stepToToolEvent` **一直漏掉它** ⇒
 *   · `agentToolLabels.callIdOf`（官方 `Fx`）对 MTV 的工具项恒返回 `''`；
 *   · 于是 `dedupeByCallId`（官方 `oie`）恒不生效；
 *   · 官方 `e1e` 的 `pending-<callId>` 伪胶囊、`p1e` 的 `$b` 同 id 合并也全部失能。
 * 本次把 `content.tool_call_id`（= MTV `AgentToolCallSnapshot.callId`）与官方 `schema_version`
 * 补回**源头**（而不是在装配层打补丁）。
 *
 * 验证分级 = **(d) 源码级**（逐字字段 + 偏移）+ utils 行为断言。**没有**做 live CDP / jsdom / SSR。
 */
import { describe, expect, it } from 'vitest';
import { stepToToolEvent, taskStepsToToolEvents } from '../src/services/chat/agentActivityItems';
import { dedupeToolItems, toolNameOf } from '../src/services/chat/agentToolLabels';
import type { AgentApprovalKind as AgentApprovalSnapshotKind, AgentStep, AgentTask } from '../src/types/agent';

/** 一个最小的 MTV `AgentStep`（与 `tests/agentMessageContents.test.ts` 的工厂同形）。 */
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

function task(steps: AgentStep[]): AgentTask {
  return {
    id: 'task-1',
    goal: '测试',
    status: 'completed',
    steps,
    createdAt: 1,
    updatedAt: 2,
  } as AgentTask;
}

describe('stepToToolEvent —— 官方 `content.tool_call_id` / `schema_version`', () => {
  it('带上官方 `Gge`（@21175）的 `schema_version:"tool_event.v1"`', () => {
    const item = stepToToolEvent(step({ id: 's1', toolCall: { callId: 'c1', toolId: 'file_read_text', retryCount: 0, startedAt: 100, finishedAt: 200 } }));
    expect(item.content?.schema_version).toBe('tool_event.v1');
  });

  it('带上官方 `content.tool_call_id`（= `AgentToolCallSnapshot.callId`）', () => {
    const item = stepToToolEvent(step({ id: 's1', toolCall: { callId: 'call-42', toolId: 'file_read_text', retryCount: 0, startedAt: 100, finishedAt: 200 } }));
    expect(item.content?.tool_call_id).toBe('call-42');
  });

  it('没有 toolCall 的步骤（规划/回答）不带 tool_call_id（官方那条 wire 也只在有 id 时生产）', () => {
    const item = stepToToolEvent(step({ id: 's2', kind: 'planning', title: '规划' }));
    expect(item.content?.tool_call_id).toBeUndefined();
    expect(toolNameOf(item)).toBe('planning');
  });

  it('`taskStepsToToolEvents` 产出的每一项都带 callId（官方 `Fx` 才能拿到 id）', () => {
    const items = taskStepsToToolEvents(task([
      step({ id: 's1', toolCall: { callId: 'c1', toolId: 'file_read_text', retryCount: 0 } }),
      step({ id: 's2', toolCall: { callId: 'c2', toolId: 'canvas_query', retryCount: 0 } }),
    ]));
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.content?.tool_call_id)).toEqual(['c1', 'c2']);
  });
});

describe('`dedupeToolItems`（官方 `oie`）现在真的能按 callId 去重', () => {
  it('同 callId 的后一条覆盖前一条、且保持位置（修复前 callId 恒为空 ⇒ 恒不去重）', () => {
    const first = stepToToolEvent(step({
      id: 's1',
      title: '读文件（进行中）',
      status: 'running',
      toolCall: { callId: 'same', toolId: 'file_read_text', retryCount: 0, startedAt: 100 },
    }));
    const second = stepToToolEvent(step({
      id: 's2',
      title: '读文件（已完成）',
      status: 'succeeded',
      toolCall: { callId: 'same', toolId: 'file_read_text', retryCount: 0, startedAt: 100, finishedAt: 300 },
    }));

    const deduped = dedupeToolItems([first, second]);
    expect(deduped).toHaveLength(1);
    /* 官方 `oie`：后者覆盖前者 ⇒ 留下的是第二条的 content。 */
    expect(deduped[0]?.content?.tool_call_id).toBe('same');
    expect(deduped[0]?.content?.request).toEqual({ description: '读文件（已完成）', prompt: '' });
  });

  it('不同 callId 不去重', () => {
    const a = stepToToolEvent(step({ id: 's1', toolCall: { callId: 'a', toolId: 'file_read_text', retryCount: 0 } }));
    const b = stepToToolEvent(step({ id: 's2', toolCall: { callId: 'b', toolId: 'file_read_text', retryCount: 0 } }));
    expect(dedupeToolItems([a, b])).toHaveLength(2);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 「工具生产者」接线：带 `step.approval` 的步骤改走官方确认族 content
 * ══════════════════════════════════════════════════════════════════════════ */

/** 一条带审批的 MTV 步骤。 */
function approvalStep(
  id: string,
  kind: AgentApprovalSnapshotKind,
  inputRequest?: AgentStep['approval'] extends undefined ? never : NonNullable<AgentStep['approval']>['inputRequest'],
): AgentStep {
  return step({
    id,
    kind: 'approval',
    title: '等待确认',
    status: 'running',
    approval: {
      id: `ap-${id}`,
      kind,
      status: 'pending',
      summary: `需要确认：${kind}`,
      requestedAt: 1_000,
      ...(inputRequest ? { inputRequest } : {}),
    },
    toolCall: { callId: `call-${id}`, toolId: 'media_generate', retryCount: 0, startedAt: 1_000 },
  });
}

describe('stepToToolEvent —— 审批步骤走官方确认族（用户指令「补工具生产者」）', () => {
  it('`media_generation` ⇒ `content.tool === "generation_confirmation"`（官方 `dg` → `qet`）', () => {
    const item = stepToToolEvent(approvalStep('a1', 'media_generation', { kind: 'media_model', mediaKind: 'image' }));
    expect(String(item.content?.tool)).toBe('generation_confirmation');
    /* 时间戳沿用步骤的真实值（不是装配层编的）。 */
    expect(item.startedAt).toBe(1_000);
  });

  it('`canvas_write` ⇒ `content.tool === "node_update_confirmation"`（官方 `iT` → `Btt`）', () => {
    const item = stepToToolEvent(approvalStep('a2', 'canvas_write'));
    expect(String(item.content?.tool)).toBe('node_update_confirmation');
  });

  it('`file_write` / `permanent_delete` / `asset_write` ⇒ 改道到 `desktop_fs_confirmation`（官方 `kD` → `$Qe`）', () => {
    /* round 30：`$Qe`(`DesktopConfirmationCard`) 移植完成 + 接进 `ConfirmationEventCard` 后，
       白名单放开 ⇒ 这三族不再退化成普通工具行（否则卡片明明存在却没人渲染）。 */
    for (const kind of ['file_write', 'permanent_delete', 'asset_write'] as const) {
      const item = stepToToolEvent(approvalStep(`a-${kind}`, kind));
      expect(String(item.content?.tool)).toBe('desktop_fs_confirmation');
    }
  });

  it('`memory_write` / `config_write`（官方无对应族）同样维持普通工具行', () => {
    expect(String(stepToToolEvent(approvalStep('a4', 'memory_write')).content?.tool)).toBe('media_generate');
    expect(String(stepToToolEvent(approvalStep('a5', 'config_write')).content?.tool)).toBe('media_generate');
  });

  it('没有审批的普通步骤行为不变', () => {
    const item = stepToToolEvent(step({ id: 's9', toolCall: { callId: 'c9', toolId: 'file_read_text', retryCount: 0 } }));
    expect(String(item.content?.tool)).toBe('read');
    expect(item.content?.tool_call_id).toBe('c9');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 第 72 轮任务 A：`content.response` **不**承载「输出」块（官方真机无该字段）
 * ══════════════════════════════════════════════════════════════════════════ */

describe('stepToToolEvent —— 官方「输出」块在 MTV 没有生产者', () => {
  /* 官方真机（CDP 9222）实测：`data-tool-public-result` 只出现在 `skill` 行，
     块内是 `输出` + `Launching skill: tapnow-cli:tapnow-cli`（服务端 payload 的文本）；
     画布类工具行的 `content.response` 只有结构化字段。
     官方产物里 `output:` 只出现在 `OX` 的键表与 `TT` 的兜底词典 ⇒ 无客户端生产者。 */
  it('只产出 `response.summary`；`output` / `text` / `content` / `result` / `stdout` 一个都不写', () => {
    const item = stepToToolEvent(step({
      id: 's-canvas',
      title: '查询画布',
      outputSummary: '找到 1 个匹配节点',
      toolCall: { callId: 'c-canvas', toolId: 'canvas_query', retryCount: 0, startedAt: 100, finishedAt: 200 },
    }));
    const response = (item.content as { response: Record<string, unknown> }).response;
    expect(response).toEqual({ summary: '找到 1 个匹配节点' });
    for (const key of ['output', 'text', 'content', 'result', 'stdout', 'stdout_preview', 'truncated']) {
      expect(response).not.toHaveProperty(key);
    }
  });

  it('历史快照里遗留的 `outputText` 不再被读（旧数据也不会再渲染出「输出」块）', () => {
    const item = stepToToolEvent(step({
      id: 's-legacy',
      outputSummary: '结果',
      toolCall: {
        callId: 'c-legacy',
        toolId: 'canvas_query',
        retryCount: 0,
        startedAt: 100,
        finishedAt: 200,
        /* 第 61 轮写入的字段（已从 `AgentToolCallSnapshot` 删除，这里按旧数据的形状强塞）。 */
        outputText: '{"summary":"找到 1 个匹配节点","revision":0}',
        outputTruncated: true,
      } as never,
    }));
    const response = (item.content as { response: Record<string, unknown> }).response;
    expect(response).toEqual({ summary: '结果' });
    expect(Object.keys(response)).not.toContain('output');
    expect(Object.keys(response)).not.toContain('truncated');
  });

  it('`officialResponse`（官方真实存在的 `content.response` 字段）仍然透传', () => {
    const item = stepToToolEvent(step({
      id: 's-ask',
      toolCall: {
        callId: 'c-ask',
        toolId: 'ask_question',
        retryCount: 0,
        startedAt: 100,
        finishedAt: 200,
        officialResponse: { answers: ['A'] },
      },
    }));
    const response = (item.content as { response: Record<string, unknown> }).response;
    expect(response).toEqual({ summary: '', answers: ['A'] });
  });
});
