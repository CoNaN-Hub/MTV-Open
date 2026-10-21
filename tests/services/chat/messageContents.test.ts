/**
 * 「消息级有序 `contents`」**模型层**回归（覆盖表 §6 #1）。
 *
 * 官方消息模型是 `{contents: Item[]}`，`Z0`/`$M` **按数组顺序逐项分派**；本模块是 MTV 侧的
 * 生产者：`isCardToolItem`（官方 `$M` 各分支的「自成一张卡」判据合集）+ `buildActivitySegments`
 * （把有序 item 流切成有序分段：卡片打断工具段）。验证分级 = **(d) 源码级 + (b) 纯逻辑断言）**。
 */
import { describe, expect, it } from 'vitest';
import { buildActivitySegments, isCardToolItem, type MessageActivitySegment } from '../../../src/services/chat/messageContents';
import type { AgentTask } from '../../../src/types/agent';
import type { ToolEventLike } from '../../../src/services/chat/agentToolLabels';

function toolEvent(tool: string, at: number, content: Record<string, unknown> = {}): ToolEventLike {
  return { type: 'tool_event', content: { tool, status: 'completed', ...content }, startedAt: at } as ToolEventLike;
}

const childEventOf = (task: AgentTask): ToolEventLike => (
  { type: 'tool_event', content: { subagent_id: task.id }, startedAt: task.createdAt } as ToolEventLike
);
const childItemsOf = (): readonly ToolEventLike[] => [];

function kinds(segments: MessageActivitySegment[]): string[] {
  return segments.map((segment) => (
    segment.kind === 'cards' ? `cards:${segment.items.length}` : `tools:${segment.blocks.length}`
  ));
}

describe('messageContents —— 官方有序 contents 的生产者', () => {
  it('`isCardToolItem`：卡片族逐条命中，普通工具不命中', () => {
    expect(isCardToolItem(toolEvent('ask_question', 1))).toBe(true);
    /* 官方 `fEe=new Set(["AskUserQuestion","ask_question"])`（@447426）+ `av=e=>fEe.has(xl(e))`（@449104），
       `xl`（@448796）**不**做大小写归一 ⇒ 两个字面量都命中，其余大小写变体都不命中。
       ⚠️ **round 120 更正**：本行原先断言 `AskUserQuestion` 为 `false`、`Ask_Question` 为 `true`
       （基于「`xl` 会 toLowerCase」的**错误**注释），现已按官方原文改正。 */
    expect(isCardToolItem(toolEvent('AskUserQuestion', 1))).toBe(true);
    expect(isCardToolItem(toolEvent('Ask_Question', 1))).toBe(false);
    expect(isCardToolItem(toolEvent('ASKUSERQUESTION', 1))).toBe(false);
    expect(isCardToolItem(toolEvent('generation_confirmation', 1))).toBe(true);
    expect(isCardToolItem(toolEvent('node_update_confirmation', 1))).toBe(true);
    /* 官方 `pL`/`yEe`（@449167 / @447426）：5 个 desktop_*_confirmation + batch_download_files_confirmation
       **与 generation/node_update 同等是「卡」**（官方 `$M` @2458469 邻域 `if(pL(e)) return s.jsx(ret,…)`）。
       round 120 之前这里缺这一族 ⇒ 那 5 类卡会落进工具段、被折叠摘要吸收。 */
    expect(isCardToolItem(toolEvent('desktop_fs_confirmation', 1))).toBe(true);
    expect(isCardToolItem(toolEvent('desktop_open_app_confirmation', 1))).toBe(true);
    expect(isCardToolItem(toolEvent('desktop_capture_screen_confirmation', 1))).toBe(true);
    expect(isCardToolItem(toolEvent('desktop_shell_command_confirmation', 1))).toBe(true);
    expect(isCardToolItem(toolEvent('batch_download_files_confirmation', 1))).toBe(true);
    /* 官方 `UC`/`gEe`（cost_limit_confirmation）在 `$M` 里是 `return null` ⇒ **不是**卡（不自行扩大）。 */
    expect(isCardToolItem(toolEvent('cost_limit_confirmation', 1))).toBe(false);
    expect(isCardToolItem(toolEvent('show_widget', 1))).toBe(true);
    expect(isCardToolItem(toolEvent('show_html', 1))).toBe(true);
    expect(isCardToolItem(toolEvent('show_form', 1))).toBe(true);
    expect(isCardToolItem(toolEvent('get_connector_status', 1))).toBe(true);
    /* mcpApp 是**结构判据**（`content.ui.resource_uri` 非空），不看工具名。 */
    expect(isCardToolItem(toolEvent('whatever', 1, { ui: { resource_uri: 'ui://x/y' } }))).toBe(true);
    /* 普通工具 / 无 ui 的同名工具都不算卡片。 */
    expect(isCardToolItem(toolEvent('canvas_query', 1))).toBe(false);
    expect(isCardToolItem(toolEvent('whatever', 1, { ui: { resource_uri: '' } }))).toBe(false);
  });

  it('工具 → 卡片 → 工具 ⇒ 三段（卡片**插在中间**）', () => {
    const segments = buildActivitySegments({
      items: [
        toolEvent('canvas_query', 1_000),
        toolEvent('show_form', 2_000),
        toolEvent('canvas_undo', 3_000),
      ],
      childEventOf,
      childItemsOf,
    });
    expect(kinds(segments)).toEqual(['tools:1', 'cards:1', 'tools:1']);
  });

  it('连续卡片合成一段；连续工具合成一段（段内按官方 `PF` 分桶）', () => {
    const segments = buildActivitySegments({
      items: [
        toolEvent('show_form', 1_000),
        toolEvent('ask_question', 2_000),
        toolEvent('canvas_query', 3_000),
        toolEvent('canvas_select', 4_000),
      ],
      childEventOf,
      childItemsOf,
    });
    /* 两个普通工具同属 `PF` 的 `activity` 键 ⇒ **同一个桶**（一条工具行）。 */
    expect(kinds(segments)).toEqual(['cards:2', 'tools:1']);
    const tools = segments[1];
    if (tools.kind !== 'tools') throw new Error('unreachable');
    expect(tools.blocks).toHaveLength(1);
    expect(tools.blocks[0].kind).toBe('items');
    if (tools.blocks[0].kind !== 'items') throw new Error('unreachable');
    expect(tools.blocks[0].items).toHaveLength(2);
  });

  it('子任务按时间戳插进**同一工具段**（官方 `pL` 的 subagent 块）', () => {
    const child = { id: 'child-1', parentTaskId: 'task-1', createdAt: 1_500, status: 'running' } as unknown as AgentTask;
    const segments = buildActivitySegments({
      items: [toolEvent('canvas_query', 1_000), toolEvent('canvas_undo', 2_000)],
      childTasks: [child],
      childEventOf,
      childItemsOf,
    });
    expect(segments).toHaveLength(1);
    const segment = segments[0];
    expect(segment.kind).toBe('tools');
    if (segment.kind !== 'tools') throw new Error('unreachable');
    expect(segment.blocks.map((block) => block.kind)).toEqual(['items', 'subagent', 'items']);
  });

  it('顺序按时间戳（不是数组下标）；空输入返回空', () => {
    const segments = buildActivitySegments({
      items: [toolEvent('show_form', 9_000), toolEvent('canvas_query', 1_000)],
      childEventOf,
      childItemsOf,
    });
    expect(kinds(segments)).toEqual(['tools:1', 'cards:1']);
    expect(buildActivitySegments({ items: [], childEventOf, childItemsOf })).toEqual([]);
  });
});
