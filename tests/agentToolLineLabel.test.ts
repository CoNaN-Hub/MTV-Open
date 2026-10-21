/**
 * 官方 `Eot`（多 kind 分组回落）与 `Sg`（单组）的文案回归。
 *
 * live 官方逐字（`vendor-pkg-canvas-ChpWx5JY.js`，`PE` 偏移 2408414 邻域）：
 * ```js
 * const R = d ? null : (!C && u.length > 1 ? Eot(E.length > 0 ? E : u, t) : Sg(f, C, t));
 * // Eot：kind 全部一致且 ∈ {edit, exploration, viewMedia, command} ⇒ 退回 Sg(items, false, t)
 * //      否则 ⇒ {kind:"command", key: ba("completedActions"), LeadingIcon: gue(ListChecks)}
 * ```
 * live DOM 实测：10 条混合工具 ⇒ 一行「已完成 10 个操作」+ `lucide-list-checks`。
 */
import { describe, expect, it } from 'vitest';
import { agentToolLineLabel, agentToolLineText, type ToolEventLike } from '../src/services/chat/agentToolLabels';

const item = (tool: string, id = ''): ToolEventLike => ({
  type: 'tool_event',
  content: { tool, status: 'completed', ...(id ? { tool_call_id: id } : {}) },
});

describe('agentToolLineLabel —— 官方 Eot 多 kind 回落', () => {
  it('混合 kind（read+write+view_media）且非活跃 ⇒ completedActions + listChecks', () => {
    const items = [item('read'), item('write'), item('view_media')];
    const label = agentToolLineLabel(items, false);
    expect(label.kind).toBe('command');
    expect(label.key).toBe('chatAdapter.agentEvent.toolCallLine.completedActions');
    expect(label.iconOverride).toBe('listChecks');
    expect(label.count).toBe(3);
    expect(agentToolLineText(label, 'zh-CN')).toBe('已完成 3 个操作');
    expect(agentToolLineText(label, 'en-US')).toBe('Completed 3 actions');
  });

  it('kind 全一致且属于 edit/exploration/viewMedia/command ⇒ 不回落，走单组文案', () => {
    const edits = agentToolLineLabel([item('write'), item('edit'), item('multiedit')], false);
    expect(edits.kind).toBe('edit');
    expect(edits.iconOverride).toBeUndefined();
    expect(agentToolLineText(edits, 'zh-CN')).toBe('已编辑 3 个文件');

    const reads = agentToolLineLabel([item('read'), item('read')], false);
    expect(reads.kind).toBe('exploration');

    const media = agentToolLineLabel([item('view_media'), item('view_media')], false);
    expect(media.kind).toBe('viewMedia');
  });

  it('kind 全一致但是 canvas_context / skill ⇒ **仍然**回落成 completedActions（不在官方白名单四类里）', () => {
    /* 官方 `Brt` 的白名单**逐字**只有 `edit` / `exploration` / `viewMedia` / `command`：
       ```js
       if (o.size===1 && (r==="edit"||r==="exploration"||r==="viewMedia"||r==="command")) return Vg(e,!1,t);
       ```
       `canvasContext` 与 `skill` 都会被 `Vg`（`_L` 的顺序里 `isCanvasContext` 在 `isExploration` 之前）
       判出来，但**不在白名单里** ⇒ 同类也回落成聚合行。这是官方行为，MTV 照抄。
       ⚠️ 两条必须带各自的 `tool_call_id`（官方 `oie` 会按 id 去重；无 id 的项原样保留）。 */
    for (const tool of ['canvas_context', 'skill']) {
      const label = agentToolLineLabel([item(tool, 'c1'), item(tool, 'c2')], false);
      expect(label.kind).toBe('command');
      expect(label.key).toBe('chatAdapter.agentEvent.toolCallLine.completedActions');
      expect(label.iconOverride).toBe('listChecks');
      expect(label.count).toBe(2);
    }
  });

  it('白名单四类（edit/exploration/viewMedia/command）同类 ⇒ 不回落', () => {
    /* ⚠️ 聚合判据的 kind **必须**用 `isActive:false` 那一套（官方 `Brt` 两条都是 `!1`）：
       早前这里用 `isActive:true` 分类，`view_media` 在活跃态会算成 `viewMedia`、
       非活跃态在「已结算但没取到像素」时同样算 `viewMedia` —— 两套在 `edit`/`exploration`
       上一致，但在 `viewMedia` 的 `count` 上不同，会让「同类」判据与最终文案不一致。
       这里钉死四条都被判成同一类、不回落。 */
    const commandLike = agentToolLineLabel([item('tapnow_cli', 'c1'), item('bash', 'c2')], false);
    expect(commandLike.kind).toBe('command');
    expect(commandLike.iconOverride).toBeUndefined();
    expect(agentToolLineText(commandLike, 'zh-CN')).toBe('已完成 2 个操作');
  });

  it('单条永不回落', () => {
    const label = agentToolLineLabel([item('skill')], false);
    expect(label.iconOverride).toBeUndefined();
    expect(label.kind).toBe('skill');
  });

  it('活跃时永不回落（走 workingOnActions / 单组）', () => {
    const label = agentToolLineLabel([item('read'), item('write')], true);
    expect(label.key).not.toBe('chatAdapter.agentEvent.toolCallLine.completedActions');
  });

  it('按 tool_call_id 去重后再计数（官方 `oie`）', () => {
    const label = agentToolLineLabel([item('read', 'c1'), item('write', 'c2'), item('edit', 'c2')], false);
    expect(label.count).toBe(2);
    expect(agentToolLineText(label, 'zh-CN')).toBe('已完成 2 个操作');
  });
});

describe('agentToolLineLabel —— 官方 Sot 同 kind 收窄（活跃时生效）', () => {
  it('末项 kind 在白名单（edit/exploration/viewMedia/command）⇒ 只保留同 kind', () => {
    const label = agentToolLineLabel([item('read'), item('write'), item('view_media')], true);
    /* 末项是 view_media ⇒ kind viewMedia 命中白名单 ⇒ 收窄成 [view_media]。 */
    expect(label.kind).toBe('viewMedia');
    expect(label.count).toBe(1);
  });

  it('同 kind 的多数项仍一起计数', () => {
    /* 末项是 edit ⇒ kind edit 命中白名单 ⇒ 收窄成 [write, edit]。 */
    const label = agentToolLineLabel([item('read'), item('write'), item('edit')], true);
    expect(label.kind).toBe('edit');
    expect(label.count).toBe(2);
    expect(agentToolLineText(label, 'zh-CN')).toBe('正在编辑 2 个文件');
  });

  it('末项 kind 不在白名单（skill / canvas_context）⇒ 只取末项本身', () => {
    const label = agentToolLineLabel([item('read'), item('skill')], true);
    expect(label.kind).toBe('skill');
    expect(label.count).toBe(1);
  });
});
