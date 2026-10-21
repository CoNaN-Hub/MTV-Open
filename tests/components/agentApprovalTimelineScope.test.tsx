/**
 * **用户 2026-10-15 裁决：媒体生成类改由官方确认卡承担。**
 *
 * 背景：官方**只有一张**确认卡（聊天流里的 `generation_confirmation`）；round 111/116 把它修到可交互后，
 * 「要不要生成这张图」在 MTV 上被问了**两遍**（官方卡 + 时间线里的 MTV `AgentApprovalCard`）。
 * 本轮把**官方卡真的会渲染**的那一类从时间线收掉，其余类别**一律保留**。
 *
 * 判别口径（从代码查实）：
 *   · `types/agent.ts:75` `AgentApprovalKind` 里媒体生成**只有一个**取值 `'media_generation'`；
 *     图片/视频/音频共用它，靠 `AgentApprovalInputRequest.mediaKind`（`image|video|audio`）区分
 *     ⇒ 按 `kind` 收，不按 `mediaKind`。
 *   · `effect: 'media_generation'` 的工具**不止 `media_generate`**（还有
 *     `shotlist_generate_frames` / `preset_run_media_step` / `director_render_frame` /
 *     `director_render_video` / `comfyui_execute_workflow` / `canvas_run_nodes`），
 *     它们拿到的审批 kind **同样是** `'media_generation'`（`policyEngine.ts:151`），
 *     但 `inputRequest: {kind:'media_model'}` 只对 `id === 'media_generate'` 产出
 *     （`agentRoundExecutor.prepareApprovalInput` @732-812）⇒ 它们**产不出官方 content**、
 *     官方卡不会渲染 ⇒ **必须保留 MTV 审批卡**，否则那条审批会从界面消失。
 *   · 判据用 `agentActivityItems.approvalRendersGenerationCard`（等价于
 *     「`kind === 'media_generation'` ∧ 官方 content.tool === `generation_confirmation`」）。
 *
 * 验证分级 = **(b) SSR 真 DOM 字符串**（`renderToStaticMarkup`，与 `agentTaskSkillBindings.test.tsx` 同法）。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import AgentTaskTimeline from '../../src/components/chat/AgentTaskTimeline';
import { approvalRendersGenerationCard } from '../../src/services/chat/agentActivityItems';
import { setLocale } from '../../src/i18n';
import {
  DEFAULT_AGENT_TASK_METRICS,
  type AgentApprovalKind,
  type AgentApprovalInputRequest,
  type AgentStep,
  type AgentTask,
} from '../../src/types/agent';

function step(over: {
  id: string;
  kind: AgentApprovalKind;
  toolId: string;
  inputRequest?: AgentApprovalInputRequest;
}): AgentStep {
  return {
    id: over.id,
    taskId: 'task-1',
    index: 0,
    kind: 'approval',
    title: '等待确认',
    status: 'waiting_approval',
    createdAt: 1_000,
    updatedAt: 2_000,
    approval: {
      id: `ap-${over.id}`,
      kind: over.kind,
      status: 'pending',
      summary: `需要确认：${over.kind}`,
      requestedAt: 1_000,
      ...(over.inputRequest ? { inputRequest: over.inputRequest } : {}),
    },
    toolCall: { callId: `call-${over.id}`, toolId: over.toolId, retryCount: 0, startedAt: 1_000 },
  };
}

function task(steps: AgentStep[]): AgentTask {
  return {
    id: 'task-1',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    userMessageId: 'message-1',
    mode: 'collaborative',
    goal: 'audit canvas',
    status: 'waiting_approval',
    steps,
    modelRounds: 0,
    toolCallCount: 0,
    budget: { maxModelRounds: 12, maxToolCalls: 24, maxParallelReadTools: 3, maxReadRetries: 3 },
    metrics: { ...DEFAULT_AGENT_TASK_METRICS },
    createdAt: 1,
    updatedAt: 2,
  };
}

function renderTimeline(value: AgentTask): string {
  return renderToStaticMarkup(
    <AgentTaskTimeline
      task={value}
      mediaModelOptions={[]}
      mediaModelAvailability={{}}
      onResolveApproval={() => {}}
      onStop={() => {}}
    />,
  );
}

beforeEach(() => {
  setLocale('zh-CN');
});

describe('round 117：媒体生成类从 MTV 审批卡收掉（改由官方确认卡承担）', () => {
  it('`media_generate`（`inputRequest.kind="media_model"`）⇒ 时间线**不再渲染** MTV 审批卡', () => {
    const mediaStep = step({
      id: 'a1',
      kind: 'media_generation',
      toolId: 'media_generate',
      inputRequest: { kind: 'media_model', mediaKind: 'image' },
    });
    /* 判据本身也要成立（这就是「官方卡会渲染」的那一类）。 */
    expect(approvalRendersGenerationCard(mediaStep)).toBe(true);

    const html = renderTimeline(task([mediaStep]));
    /* MTV 审批卡的动作行（`拒绝` / `确认生成`）**不在** DOM 里；媒体模型选择区同样不在。 */
    expect(html).not.toContain('拒绝');
    expect(html).not.toContain('确认生成');
    expect(html).not.toContain('选择图片模型');
    expect(html).not.toContain('c-card__actions');
    /* 但时间线本身仍在（任务卡 + 「停止」没有被动过）。 */
    expect(html).toContain('停止');
  });

  it('`media_generation` 但**产不出官方卡**的工具（`director_render_frame`）⇒ MTV 审批卡**保留**', () => {
    const directorStep = step({ id: 'a2', kind: 'media_generation', toolId: 'director_render_frame' });
    expect(approvalRendersGenerationCard(directorStep)).toBe(false);
    const html = renderTimeline(task([directorStep]));
    /* 审批动作行还在 ⇒ 这条审批仍然可被批准 / 拒绝（不会从界面消失）。 */
    expect(html).toContain('拒绝');
    expect(html).toContain('确认执行');
  });

  it('其余 `effect:"media_generation"` 工具（`shotlist_generate_frames` / `comfyui_execute_workflow` / `canvas_run_nodes`）⇒ MTV 审批卡**保留**', () => {
    for (const toolId of ['shotlist_generate_frames', 'comfyui_execute_workflow', 'canvas_run_nodes', 'preset_run_media_step']) {
      const s = step({ id: `a-${toolId}`, kind: 'media_generation', toolId });
      expect(approvalRendersGenerationCard(s)).toBe(false);
      const html = renderTimeline(task([s]));
      expect(html).toContain('拒绝');
      expect(html).toContain('确认执行');
    }
  });

  it('非媒体生成类一律保留：画布写入 / 文件写入 / 永久删除 / 项目记忆 / API 配置 / 用户选择', () => {
    const cases: Array<{ kind: AgentApprovalKind; toolId: string; inputRequest?: AgentApprovalInputRequest }> = [
      { kind: 'canvas_write', toolId: 'canvas_write_node' },
      { kind: 'file_write', toolId: 'file_write_text' },
      { kind: 'permanent_delete', toolId: 'file_delete' },
      { kind: 'asset_write', toolId: 'asset_write' },
      { kind: 'memory_write', toolId: 'memory_write' },
      { kind: 'config_write', toolId: 'config_write' },
      {
        kind: 'user_choice',
        toolId: 'provider_models_select',
        inputRequest: { kind: 'provider_models', options: [], maxSelection: 16 },
      },
    ];
    for (const c of cases) {
      const s = step({ id: `a-${c.kind}`, kind: c.kind, toolId: c.toolId, ...(c.inputRequest ? { inputRequest: c.inputRequest } : {}) });
      expect(approvalRendersGenerationCard(s)).toBe(false);
      const html = renderTimeline(task([s]));
      expect(html, `${c.kind} 的 MTV 审批卡必须保留`).toContain('拒绝');
    }
  });

  it('同一个任务里媒体生成审批 + 画布写入审批 ⇒ 只收媒体那一张，另一张照旧', () => {
    const mediaStep = step({
      id: 'm1',
      kind: 'media_generation',
      toolId: 'media_generate',
      inputRequest: { kind: 'media_model', mediaKind: 'video' },
    });
    const canvasStep = step({ id: 'c1', kind: 'canvas_write', toolId: 'canvas_write_node' });
    const html = renderTimeline(task([mediaStep, canvasStep]));
    /* 只按 `find` 取**第一个**待决审批：媒体那张被跳过 ⇒ 渲染的是画布写入那张。 */
    expect(html).toContain('拒绝');
    expect(html).not.toContain('确认生成');
  });
});
