// @vitest-environment jsdom
/**
 * **round 120（用户 2026-10-15 裁决）**：官方「确认卡」族的判据必须与官方 `$M` 一致 ——
 * 这些卡**永不**落进折叠摘要（`absorbedRuns` / `AgentStepsSection`），否则「文件写入确认卡」
 * 这类必须始终可见的卡会被吸进折叠区、用户点不到。
 *
 * 官方原文（dump `D:\DEEPSEEK\live-assets-r100\`，`vendor-pkg-canvas-DuoOicPr.js`）：
 *
 * · **族集合** @447426 邻域：
 * ```js
 * fEe=new Set(["AskUserQuestion","ask_question"]),
 * hEe=new Set(["generation_confirmation"]),
 * gEe=new Set(["cost_limit_confirmation"]),
 * xEe=new Set(["node_update_confirmation"]),
 * yEe=new Set(["desktop_open_app_confirmation","desktop_capture_screen_confirmation",
 *              "desktop_fs_confirmation","desktop_shell_command_confirmation",
 *              "batch_download_files_confirmation"]),
 * bEe=new Set(["show_widget"]), vEe=new Set(["show_html"]), wEe=new Set(["get_connector_status"]),
 * _Ee=new Set(["show_form"]), SEe=new Set(["prepare_widget"]), …
 * ```
 * · **族谓词** @449104–@449167 逐字：
 * ```js
 * av=e=>fEe.has(xl(e)), Eg=e=>hEe.has(xl(e)), UC=e=>gEe.has(xl(e)),
 * TE=e=>xEe.has(xl(e)), pL=e=>yEe.has(xl(e)), AEe=e=>Eg(e)||TE(e)||pL(e)
 * ```
 * · **`$M` 渲染器**（@2458469 邻域，round 111 已逐字取证）：
 * ```js
 * if(av(e)) return s.jsx(Rse,{…});                                             // AskUserQuestion
 * if(UC(e)) return null;                                                       // cost_limit —— **不渲染**
 * if(Eg(e)) return s.jsx(pot,{content:e.content,onAnswer:l,generationFailedMap:h});  // generation
 * if(TE(e)) return s.jsx(Zot,{content:e.content,onAnswer:l});                  // node_update
 * if(pL(e)) return s.jsx(ret,{content:e.content,onAnswer:l});                  // ★ desktop / batch
 * ```
 * ⇒ 官方把 `yEe`（5 个 `desktop_*_confirmation` + `batch_download_files_confirmation`）
 *   **与 generation/node_update 同等当成「卡」**；`cost_limit_confirmation` 走 `return null`（不是卡）。
 *
 * ⚠️ 本轮修的就是 MTV `isCardToolItem` 把 `yEe` 那一族**漏掉**（只认 generation + node_update）
 * ⇒ 那 5 类卡会落进 `tools` 段 → 折叠摘要 → 永远渲染不出 `DesktopConfirmationCard`。
 *
 * 验证分级 = **(b) jsdom 真 DOM** + **(d) 源码级**（官方偏移见上）。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import {
  absorbActivityRuns,
  buildActivitySegmentsFromContents,
  isCardToolItem,
} from '../../src/services/chat/messageContents';
import { DESKTOP_CONFIRMATION_TOOLS } from '../../src/services/chat/desktopConfirmationCard';
import { OFFICIAL_TOOL_ASK_QUESTION, OFFICIAL_TOOL_GENERATION_CONFIRMATION, OFFICIAL_TOOL_NODE_UPDATE_CONFIRMATION } from '../../src/services/chat/agentApprovalContents';
import { setLocale } from '../../src/i18n';
import type { AgentApprovalKind, AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

/** 官方 `$M` 里**自成一张卡**的 tool 名（`av`/`Eg`/`TE`/`pL` 四族）。 */
const OFFICIAL_CARD_TOOLS = [
  OFFICIAL_TOOL_ASK_QUESTION,
  'ask_question',
  OFFICIAL_TOOL_GENERATION_CONFIRMATION,
  OFFICIAL_TOOL_NODE_UPDATE_CONFIRMATION,
  ...DESKTOP_CONFIRMATION_TOOLS,
];

beforeEach(() => { setLocale('zh-CN'); });
afterEach(() => { cleanup(); });

describe('round 120 · A 官方卡族判据：`isCardToolItem` 必须与官方 `$M` 的 `av`/`Eg`/`TE`/`pL` 对齐', () => {
  it.each(OFFICIAL_CARD_TOOLS)('`%s` ⇒ 是卡（不进工具行分桶）', (tool) => {
    expect(isCardToolItem({ content: { tool } })).toBe(true);
  });

  it('`cost_limit_confirmation`（官方 `UC` ⇒ `return null`）**不是**卡 —— 不自行扩大', () => {
    expect(isCardToolItem({ content: { tool: 'cost_limit_confirmation' } })).toBe(false);
  });

  it('普通工具（`canvas_query` 等）不是卡', () => {
    expect(isCardToolItem({ content: { tool: 'canvas_query' } })).toBe(false);
    expect(isCardToolItem({ content: { tool: 'media_generate' } })).toBe(false);
  });
});

describe('round 120 · B 不变量：卡族永不落进 `absorbedRuns`（= 折叠摘要会吸收的区间）', () => {
  /** 「工具段 + 卡 + 正文」的排布 —— 这是折叠摘要最容易把卡吞掉的形状。 */
  const composition = (tool: string) => ([
    { type: 'text', content: '开头' },
    { type: 'tool_event', startedAt: 1_000, content: { schema_version: 'tool_event.v1', tool: 'canvas_query', status: 'completed' } },
    { type: 'tool_event', startedAt: 2_000, content: { schema_version: 'tool_event.v1', tool: 'canvas_write_node', status: 'completed' } },
    { type: 'tool_event', startedAt: 3_000, content: { schema_version: 'tool_event.v1', tool, status: 'pending' } },
    { type: 'text', content: '结尾' },
  ]);

  it.each(OFFICIAL_CARD_TOOLS)('`%s` ⇒ 自成 `cards` 段，且不在任何吸收区间里', (tool) => {
    const segments = buildActivitySegmentsFromContents(composition(tool) as never);
    const cardIndex = segments.findIndex((segment) => segment.kind === 'cards');
    expect(cardIndex, `${tool} 必须自成 cards 段`).toBeGreaterThanOrEqual(0);
    const runs = absorbActivityRuns(segments);
    for (const run of runs) {
      expect(
        cardIndex >= run.absorbFrom && cardIndex <= run.lastAbsorbable,
        `${tool} 的卡段落进了吸收区间 [${run.absorbFrom}, ${run.lastAbsorbable}]`,
      ).toBe(false);
    }
    /* 并且吸收区间里确实存在（工具段被吸收了）—— 否则这条断言是空转。 */
    expect(runs.length).toBeGreaterThan(0);
  });
});

describe('round 120 · C 真 DOM：desktop 族卡必须渲染出 `DesktopConfirmationCard`', () => {
  function message(): ChatMessage {
    return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000, status: 'complete' };
  }
  function task(steps: AgentStep[]): AgentTask {
    return { id: 'task-1', goal: '测试', status: 'completed', steps, createdAt: 1, updatedAt: 2 } as AgentTask;
  }
  function toolStep(id: string, toolId: string, officialRequest: Record<string, unknown>): AgentStep {
    return {
      id, taskId: 'task-1', index: 0, kind: 'tool', title: '步骤', status: 'succeeded',
      createdAt: 1_000, updatedAt: 2_000,
      toolCall: { callId: `call-${id}`, toolId, retryCount: 0, startedAt: 1_000, finishedAt: 2_000, officialRequest },
    };
  }
  function approvalStep(id: string, kind: AgentApprovalKind): AgentStep {
    return {
      id, taskId: 'task-1', index: 0, kind: 'approval', title: '等待确认', status: 'running',
      createdAt: 1_000, updatedAt: 2_000,
      approval: { id: `ap-${id}`, kind, status: 'pending', summary: `需要确认：${kind}`, requestedAt: 1_000 },
      toolCall: { callId: `call-${id}`, toolId: 'file_write_text', retryCount: 0, startedAt: 1_000 },
    };
  }
  const CONTROLS = {
    onResolveApproval: () => {}, mediaModelOptions: [], mediaModelAvailability: {}, onStop: () => {},
  } as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

  it('`desktop_fs_confirmation` 工具事件 ⇒ `[data-testid="desktop-confirmation-card"]` 在 DOM 里', () => {
    const { container } = render(
      <MessageBubble
        message={message()}
        agentTask={task([toolStep('s1', 'desktop_fs_confirmation', { confirmation_id: 'c1', confirmation_kind: 'desktop_fs' })])}
        agentControls={CONTROLS}
      />,
    );
    expect(container.querySelector('[data-testid="desktop-confirmation-card"]')).not.toBeNull();
  });

  it('`file_write` 待决审批（走改道）⇒ desktop 卡在 DOM 里（不会被折叠摘要藏住）', () => {
    const { container } = render(
      <MessageBubble message={message()} agentTask={task([approvalStep('a1', 'file_write')])} agentControls={CONTROLS} />,
    );
    expect(container.querySelector('[data-testid="desktop-confirmation-card"]')).not.toBeNull();
  });
});

/* ================================================================== *
 * round 122 · **不变量**：凡是被 `isCardToolItem` 判成「卡」的**确认卡族**，
 * `renderCardToolItem` **必须**有对应渲染分支。
 *
 * 动机（本轮最有价值的一条教训）：round 120 我先把 `desktop_*` 加进 `isCardToolItem`，
 * 却没注意 `renderCardToolItem` **根本没有 desktop 分支**（末尾 `return null`）——
 * 结果是「判据有了、渲染路径没有」⇒ 这些事件从 `tools` 段（还能看见普通工具行）
 * 被搬进 `cards` 段后**彻底消失**。只补判据不补渲染分支比不补更糟。
 *
 * 判据与渲染分支的对应关系（官方 `$M`）：
 * `av`→AskQuestionSummary · `Eg`→ConfirmationEventCard(generation) ·
 * `TE`→ConfirmationEventCard(node_update) · `pL`→ConfirmationEventCard(desktop)。
 * ================================================================== */
describe('round 122 · 不变量：判成「卡」的确认族必须都有渲染分支（不能只加判据）', () => {
  function message(): ChatMessage {
    return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000, status: 'complete' };
  }
  function task(steps: AgentStep[]): AgentTask {
    return { id: 'task-1', goal: '测试', status: 'completed', steps, createdAt: 1, updatedAt: 2 } as AgentTask;
  }
  const CONTROLS = {
    onResolveApproval: () => {}, mediaModelOptions: {}, mediaModelAvailability: {}, onStop: () => {},
  } as unknown as import('../../src/components/chat/AgentTaskTimeline').AgentTaskControls;

  /** 每族一个**最小可渲染**载荷（`confirmation_id` 是各卡的前提）。 */
  const FAMILIES: Array<{ tool: string; request: Record<string, unknown>; status?: string }> = [
    { tool: 'generation_confirmation', status: 'pending', request: { confirmation_id: 'c-gen', request_kind: 'image', request_json: { kind: 'tapnow.generation_request.v1', request_kind: 'image', prompt: 'x', image: { times: 1 } } } },
    { tool: 'node_update_confirmation', status: 'pending', request: { confirmation_id: 'c-node', confirmation_kind: 'node_update' } },
    { tool: 'desktop_fs_confirmation', request: { confirmation_id: 'c-dfs', confirmation_kind: 'desktop_fs' } },
    { tool: 'desktop_open_app_confirmation', request: { confirmation_id: 'c-doa', confirmation_kind: 'desktop_open_app' } },
    { tool: 'desktop_capture_screen_confirmation', request: { confirmation_id: 'c-dcs', confirmation_kind: 'desktop_capture_screen' } },
    { tool: 'desktop_shell_command_confirmation', request: { confirmation_id: 'c-dsc', confirmation_kind: 'desktop_shell_command' } },
    { tool: 'batch_download_files_confirmation', request: { confirmation_id: 'c-bdf', confirmation_kind: 'batch_download_files' } },
    { tool: 'AskUserQuestion', status: 'completed', request: { question_id: 'q1', question: '选一个', options: [{ label: 'A' }, { label: 'B' }] } },
    { tool: 'ask_question', status: 'completed', request: { question_id: 'q1', question: '选一个', options: [{ label: 'A' }, { label: 'B' }] } },
  ];

  it.each(FAMILIES)('`$tool` 是卡（`isCardToolItem`）**且**消息流里渲染出东西（非空）', ({ tool, request, status }) => {
    expect(isCardToolItem({ content: { tool } }), `${tool} 必须被 isCardToolItem 认成卡`).toBe(true);
    const step: AgentStep = {
      id: `s-${tool}`, taskId: 'task-1', index: 0, kind: 'tool', title: '步骤', status: 'succeeded',
      createdAt: 1_000, updatedAt: 2_000,
      toolCall: {
        callId: `call-${tool}`, toolId: tool, retryCount: 0, startedAt: 1_000, finishedAt: 2_000,
        officialRequest: { ...request, ...(status ? { status } : {}) },
      },
    } as AgentStep;
    const { container } = render(
      <MessageBubble message={message()} agentTask={task([step])} agentControls={CONTROLS} />,
    );
    /* 关键：**不能是空的** —— 只加判据不加渲染分支时这里会是空（卡被 `return null` 吞掉）。 */
    expect(container.innerHTML.length, `${tool} 渲染成了空内容（判据有了、渲染路径没有）`).toBeGreaterThan(0);
    const body = container.querySelector('.c-msg__content') ?? container;
    expect((body.textContent || '').trim().length, `${tool} 的卡片体为空`).toBeGreaterThan(0);
  });
});
