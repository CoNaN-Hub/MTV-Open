/**
 * `agentApprovalContents.ts`（MTV `AgentApprovalSnapshot` → 官方确认卡 `tool_event` content 的**写侧**）
 * 回归测试。
 *
 * 覆盖：
 *  · 8 个 `AgentApprovalKind` 的完整映射表（含 `memory_write` / `config_write` 明确「无官方形状」）；
 *  · `media_generation` → `generation_confirmation`：**必须**能被已移植的官方读侧
 *    `parseGenerationConfirmationV1` 解析出 viewModel（这是「谓词能命中、卡片能拿到数据」的硬证据）；
 *  · `canvas_write` → `node_update_confirmation`：必须走官方 `Btt`→`ztt`（单卡）分支（不产 `detail.items`）；
 *  · `user_choice` → `AskUserQuestion`：options 真字段翻译；MTV 缺 `inputValues` 时**拒绝**产出 answered content；
 *  · `file_write` / `permanent_delete` / `asset_write` → `desktop_fs_confirmation`：只产信封；
 *  · 状态映射（官方 `Ff`/`Of` @2159117/@2159421 的两个非 store 分支）与时间戳；
 *  · 边界：缺 `toolCall` / 空 options / 空 summary / 缺 `inputRequest`；
 *  · 与 `agentMessageContents.classifyToolEventFamily`（= 官方 `$M` 的 13 分支）的交叉一致性。
 *
 * 验证分级：本轮是 **(d) 源码级**（官方 bundle 逐字 + 字节偏移）。**没有**做 live CDP / jsdom 实测。
 */
import { describe, expect, it } from 'vitest';
import {
  APPROVAL_KIND_TO_OFFICIAL_FAMILY,
  APPROVAL_KIND_TO_OFFICIAL_TOOL,
  OFFICIAL_ASK_QUESTION_MULTI_MODE,
  OFFICIAL_CONFIRMATION_KIND_DESKTOP_FS,
  OFFICIAL_CONFIRMATION_KIND_NODE_UPDATE,
  OFFICIAL_DESKTOP_FS_OPERATIONS,
  OFFICIAL_EXPIRED_ERROR_CODE,
  OFFICIAL_TOOL_ASK_QUESTION,
  OFFICIAL_TOOL_DESKTOP_FS_CONFIRMATION,
  OFFICIAL_TOOL_GENERATION_CONFIRMATION,
  OFFICIAL_TOOL_NODE_UPDATE_CONFIRMATION,
  approvalStatusToOfficialAction,
  approvalStatusToOfficialStatus,
  approvalStepToOfficialToolEventItem,
  approvalStepsToOfficialToolEventItems,
  approvalToOfficialContent,
  approvalToOfficialToolEventItem,
  askUserQuestionContent,
  contentHitsExpectedFamily,
  desktopFsConfirmationContent,
  generationConfirmationContent,
  nodeUpdateConfirmationContent,
  type AgentApprovalContentResult,
} from '../src/services/chat/agentApprovalContents';
import {
  classifyToolEventFamily,
  assembleRawAgentMessageContents,
  splitAgentMessageContents,
  type OfficialAgentContentItem,
} from '../src/services/chat/agentMessageContents';
import {
  hasConfirmationItems,
  isAnyConfirmationCardTool,
  isDesktopConfirmationTool,
  isGenerationConfirmationTool,
  isNodeUpdateConfirmationTool,
  parseGenerationConfirmationLegacy,
  parseGenerationConfirmationV1,
  toolEventNameOf,
} from '../src/services/chat/generationConfirmationProtocol';
import type {
  AgentApprovalKind,
  AgentApprovalSnapshot,
  AgentStep,
  AgentToolCallSnapshot,
} from '../src/types/agent';

/* ── fixture 工厂 ─────────────────────────────────────────────────────────── */

const REQUESTED_AT = 1_700_000_000_000;
const RESOLVED_AT = 1_700_000_060_000;

/** MTV `agentToolExecution.ts` @148-160 / `agentRoundExecutor.ts` @945-960 的真实形状。 */
function toolCallFixture(overrides: Partial<AgentToolCallSnapshot> = {}): AgentToolCallSnapshot {
  return {
    callId: 'call-abc',
    toolId: 'canvas_update_node',
    inputSummary: '更新节点 n1 的文本',
    retryCount: 0,
    startedAt: REQUESTED_AT,
    ...overrides,
  };
}

/** MTV `agentToolExecution.ts` @163-170 的真实形状。 */
function approvalFixture(
  kind: AgentApprovalKind,
  overrides: Partial<AgentApprovalSnapshot> = {},
): AgentApprovalSnapshot {
  return {
    id: 'step-3-approval',
    kind,
    status: 'pending',
    summary: '需手动确认：画布修改要经你批准后才执行',
    requestedAt: REQUESTED_AT,
    ...overrides,
  };
}

function stepFixture(approval: AgentApprovalSnapshot | undefined): AgentStep {
  return {
    id: 'step-3',
    taskId: 'task-1',
    index: 3,
    kind: approval ? 'approval' : 'tool',
    title: '更新画布节点',
    status: 'waiting_approval',
    createdAt: REQUESTED_AT,
    updatedAt: REQUESTED_AT,
    toolCall: toolCallFixture(),
    ...(approval ? { approval } : {}),
  };
}

/** 断言「产出物能让官方 `$M` 命中预期族」并返回 content（顺带做非空收窄）。 */
function contentOf(result: AgentApprovalContentResult): Record<string, unknown> {
  expect(result.content).not.toBeNull();
  expect(contentHitsExpectedFamily(result)).toBe(true);
  return result.content as unknown as Record<string, unknown>;
}

/* ── 1. 映射总表 ─────────────────────────────────────────────────────────── */

describe('agentApprovalContents · 映射总表', () => {
  const ALL_KINDS: AgentApprovalKind[] = [
    'user_choice',
    'canvas_write',
    'file_write',
    'permanent_delete',
    'media_generation',
    'memory_write',
    'config_write',
    'asset_write',
  ];

  it('8 个 MTV kind 全部在表里（官方 4 族 + 2 个「无官方族」）', () => {
    expect(Object.keys(APPROVAL_KIND_TO_OFFICIAL_FAMILY).sort()).toEqual([...ALL_KINDS].sort());
    expect(Object.keys(APPROVAL_KIND_TO_OFFICIAL_TOOL).sort()).toEqual([...ALL_KINDS].sort());
  });

  it('memory_write / config_write 明确「官方没有对应族」（不造工具 id 骗谓词）', () => {
    expect(APPROVAL_KIND_TO_OFFICIAL_FAMILY.memory_write).toBeNull();
    expect(APPROVAL_KIND_TO_OFFICIAL_FAMILY.config_write).toBeNull();
    expect(APPROVAL_KIND_TO_OFFICIAL_TOOL.memory_write).toBeNull();
    expect(APPROVAL_KIND_TO_OFFICIAL_TOOL.config_write).toBeNull();

    for (const kind of ['memory_write', 'config_write'] as const) {
      const result = approvalToOfficialContent({
        approval: approvalFixture(kind, { summary: '项目记忆必须由用户确认后保存' }),
        toolCall: toolCallFixture(),
      });
      expect(result.family).toBeNull();
      expect(result.content).toBeNull();
      expect(result.item).toBeNull();
      expect(result.status).toBeNull();
      expect(result.notes.join('\n')).toContain('官方没有对应族');
      expect(contentHitsExpectedFamily(result)).toBe(false);
    }
  });

  it('四个官方族的工具名逐字等于官方集合成员（@442146/@442160/@442228/@442270）', () => {
    expect(APPROVAL_KIND_TO_OFFICIAL_TOOL.user_choice).toBe('AskUserQuestion');
    expect(APPROVAL_KIND_TO_OFFICIAL_TOOL.media_generation).toBe('generation_confirmation');
    expect(APPROVAL_KIND_TO_OFFICIAL_TOOL.canvas_write).toBe('node_update_confirmation');
    expect(APPROVAL_KIND_TO_OFFICIAL_TOOL.file_write).toBe('desktop_fs_confirmation');
    expect(APPROVAL_KIND_TO_OFFICIAL_TOOL.permanent_delete).toBe('desktop_fs_confirmation');
    expect(APPROVAL_KIND_TO_OFFICIAL_TOOL.asset_write).toBe('desktop_fs_confirmation');

    expect(isGenerationConfirmationTool(OFFICIAL_TOOL_GENERATION_CONFIRMATION)).toBe(true);
    expect(isNodeUpdateConfirmationTool(OFFICIAL_TOOL_NODE_UPDATE_CONFIRMATION)).toBe(true);
    expect(isDesktopConfirmationTool(OFFICIAL_TOOL_DESKTOP_FS_CONFIRMATION)).toBe(true);
    expect(isAnyConfirmationCardTool(OFFICIAL_TOOL_GENERATION_CONFIRMATION)).toBe(true);
    expect(isAnyConfirmationCardTool(OFFICIAL_TOOL_NODE_UPDATE_CONFIRMATION)).toBe(true);
    expect(isAnyConfirmationCardTool(OFFICIAL_TOOL_DESKTOP_FS_CONFIRMATION)).toBe(true);
  });
});

/* ── 2. 状态映射（官方 Ff @2159117 / Of @2159421） ────────────────────────── */

describe('agentApprovalContents · 状态映射', () => {
  it('pending 用 "pending" 而**不是** "started"（否则官方 Of 会把卡整张吞掉）', () => {
    expect(approvalStatusToOfficialStatus('pending')).toBe('pending');
    expect(approvalStatusToOfficialAction('pending')).toBeNull();
  });

  it('approved / rejected 收敛成官方 completed + response.action', () => {
    expect(approvalStatusToOfficialStatus('approved')).toBe('completed');
    expect(approvalStatusToOfficialAction('approved')).toBe('confirm');
    expect(approvalStatusToOfficialStatus('rejected')).toBe('completed');
    expect(approvalStatusToOfficialAction('rejected')).toBe('reject');
  });

  it('expired 收敛成官方 failed + zQe 的过期 error code', () => {
    expect(approvalStatusToOfficialStatus('expired')).toBe('failed');
    expect(approvalStatusToOfficialAction('expired')).toBeNull();
    expect(OFFICIAL_EXPIRED_ERROR_CODE).toBe('generation_confirmation_expired');
  });

  it('四种状态都写进 content.status，且 action / error 只在对应状态出现', () => {
    const make = (status: AgentApprovalSnapshot['status']) =>
      contentOf(nodeUpdateConfirmationContent(approvalFixture('canvas_write', { status }), toolCallFixture()));

    expect(make('pending').status).toBe('pending');
    expect(make('pending').response).toBeUndefined();
    expect(make('pending').error).toBeUndefined();

    expect(make('approved').response).toEqual({ action: 'confirm' });
    expect(make('rejected').response).toEqual({ action: 'reject' });

    const expired = make('expired');
    expect(expired.status).toBe('failed');
    expect(expired.error).toEqual({ code: OFFICIAL_EXPIRED_ERROR_CODE });
    expect(expired.response).toBeUndefined();
  });
});

/* ── 3. media_generation → generation_confirmation ───────────────────────── */

describe('agentApprovalContents · media_generation → generation_confirmation（dg）', () => {
  const withMediaKind = (mediaKind: 'image' | 'video' | 'audio') =>
    approvalFixture('media_generation', {
      summary: '付费媒体生成和重新生成每次都需要确认',
      inputRequest: { kind: 'media_model', mediaKind },
    });

  it('产出的 content 能被官方**单卡**读侧解析出 viewModel（真正的「可达」证据）', () => {
    const result = generationConfirmationContent(withMediaKind('video'), toolCallFixture());
    const content = contentOf(result);

    expect(content.tool).toBe('generation_confirmation');
    expect(toolEventNameOf(result.item!)).toBe('generation_confirmation');
    /* 第 61 轮：不再产 `detail.items[]` ⇒ 走官方**单卡**（`LegacyGenerationCard`，与官方 图 2 一致），
       而不是「N 个任务」的批量卡。 */
    expect(hasConfirmationItems(content)).toBe(false);

    const vm = parseGenerationConfirmationLegacy(content);
    expect(vm).not.toBeNull();
    expect(vm!.confirmationId).toBe('step-3-approval');
    expect(vm!.requestKind).toBe('video');
    expect(parseGenerationConfirmationV1(content)).toBeNull();
  });

  it('三条 requestKind 都能解析，且 audio 走官方 Xet 分支的那个 requestKind', () => {
    for (const kind of ['image', 'video', 'audio'] as const) {
      const vm = parseGenerationConfirmationLegacy(
        generationConfirmationContent(withMediaKind(kind), toolCallFixture()).content,
      );
      expect(vm?.requestKind).toBe(kind);
    }
  });

  it('载体里**只有**官方最小键（没有真实参数时不夹带任何生成参数）', () => {
    const content = contentOf(generationConfirmationContent(withMediaKind('image'), toolCallFixture()));
    const carrier = (content.request as Record<string, unknown>).request_json as Record<string, unknown>;
    expect(Object.keys(carrier).sort()).toEqual(['kind', 'request_kind']);
  });

  it('读侧 presentFields 为空，且 params 里没有任何 MTV 生成参数（无载荷时）', () => {
    const vm = parseGenerationConfirmationLegacy(
      generationConfirmationContent(withMediaKind('image'), toolCallFixture()).content,
    )!;
    expect(vm.presentFields).toEqual([]);

    /* 官方 `GB` 的白名单字段（`xse`/`kZe` @2213663/@2202031）逐个确认没有值。 */
    const params = vm.params as Record<string, unknown>;
    for (const key of [
      'prompt', 'model', 'model_name', 'aspectRatio', 'aspect_ratio', 'imageSize', 'image_size',
      'quality', 'times', 'duration', 'resolution', 'generateAudio', 'generate_audio', 'mode',
      'videoMode', 'audioScene', 'voice', 'lyrics', 'element_refs',
    ]) {
      expect(params[key]).toBeUndefined();
    }

    /* ⚠️ 官方 `GB` @2227711 逐字：`o.normalizedReferences = tJe(e,"normalized_references") ?? nJe(e)`
       —— **无真值守卫**，空输入时官方 `nJe` 返回 `[]`，于是官方 params 里会出现一个空数组。
       本仓 `generationConfirmationProtocol.ts` 的移植把它写成 snake_case `normalized_references`
       （官方是 camelCase `normalizedReferences`），且多了一层 `if (normalizedReferences)` 守卫。
       那是**读侧**的差异，不在本轮两个文件范围内 ⇒ 这里只断言「它里面没有 MTV 数据」。 */
    const references = params.normalizedReferences ?? params.normalized_references;
    if (references !== undefined) expect(references).toEqual([]);
    expect(vm.originalParams).toEqual(vm.params);
    expect(vm.protocolContext).toEqual({
      originalReferences: undefined,
      originalModelName: undefined,
      originalVideoMode: undefined,
      originalAudioScene: undefined,
    });
  });

  it('走官方**单卡**路径（无 detail.items ⇒ v1 解析器返回 null、legacy 命中）', () => {
    const content = generationConfirmationContent(withMediaKind('image'), toolCallFixture()).content;
    expect(parseGenerationConfirmationV1(content)).toBeNull();
    expect(parseGenerationConfirmationLegacy(content)).not.toBeNull();
  });

  it('载体逐字是 tapnow.generation_request.v1 + request_kind（官方 cF/dF @2215087/@2215145）', () => {
    const content = contentOf(generationConfirmationContent(withMediaKind('video'), toolCallFixture()));
    const request = content.request as Record<string, unknown>;
    expect(request.confirmation_id).toBe('step-3-approval');
    expect(request.request_kind).toBe('video');
    expect(request.request_json).toEqual({
      kind: 'tapnow.generation_request.v1',
      request_kind: 'video',
    });
  });

  it('缺 inputRequest / mediaKind 非法 ⇒ 明确不产出（否则只会撞官方 Zet 回退卡）', () => {
    const noRequest = generationConfirmationContent(
      approvalFixture('media_generation', { summary: '付费媒体生成和重新生成每次都需要确认' }),
      toolCallFixture(),
    );
    expect(noRequest.content).toBeNull();
    expect(noRequest.item).toBeNull();
    expect(noRequest.family).toBe('generation_confirmation');
    expect(noRequest.notes.join('\n')).toContain('MTV 无 producer');
    expect(noRequest.missingMtvFields).toContain('request_kind（MTV 无 producer）');

    /* 未来若 MTV 新增别的 inputRequest 形状，同样不产出。 */
    const weird = generationConfirmationContent(
      approvalFixture('media_generation', {
        inputRequest: { kind: 'provider_models', options: [] },
      }),
      toolCallFixture(),
    );
    expect(weird.content).toBeNull();
  });

  it('声明了 MTV 无生产者的生成参数字段清单（供报告与后续接线核对）', () => {
    const result = generationConfirmationContent(withMediaKind('image'), toolCallFixture());
    expect(result.missingMtvFields).toContain('request.request_json.prompt');
    expect(result.missingMtvFields).toContain('request.request_json.model_name');
    expect(result.missingMtvFields).toContain('request.request_json.references');
  });
});

/* ── 4. canvas_write → node_update_confirmation ─────────────────────────── */

describe('agentApprovalContents · canvas_write → node_update_confirmation（iT）', () => {
  const approval = () =>
    approvalFixture('canvas_write', { summary: '需手动确认：画布修改要经你批准后才执行' });

  it('命中 iT/DNe 谓词，并被 $M 分派到 node_update_confirmation 族', () => {
    const result = nodeUpdateConfirmationContent(approval(), toolCallFixture());
    const content = contentOf(result);

    expect(result.family).toBe('node_update_confirmation');
    expect(content.tool).toBe('node_update_confirmation');
    expect(toolEventNameOf(result.item!)).toBe('node_update_confirmation');
    expect(isNodeUpdateConfirmationTool(toolEventNameOf(result.item!))).toBe(true);
    expect(classifyToolEventFamily(result.item!)).toBe('node_update_confirmation');
  });

  it('不产 detail.items ⇒ 官方 Ott 返回 null ⇒ 走 ztt（单请求卡）而不是 Utt（批量卡）', () => {
    const content = contentOf(nodeUpdateConfirmationContent(approval(), toolCallFixture()));
    const request = content.request as Record<string, unknown>;
    expect(request.detail).toBeUndefined();
    /* detail 缺失 ⇒ 官方 `hasConfirmationItems`（= Tse）为 false。 */
    expect(hasConfirmationItems(content)).toBe(false);
  });

  it('request 里只有官方要求的两个键 + **工具摘要**（官方语义「这次改什么」，不是审批原因）', () => {
    const content = contentOf(nodeUpdateConfirmationContent(approval(), toolCallFixture()));
    expect(content.request).toEqual({
      confirmation_id: 'step-3-approval',
      confirmation_kind: OFFICIAL_CONFIRMATION_KIND_NODE_UPDATE,
      /* 第 59 轮修：此前这里塞的是 `approval.summary`（= `policy.reason`，
         用户实测卡正文显示成内部原因串「B 协作模式的画布写操作需要确认」）⇒ 现在优先工具 `inputSummary`。
         第 85 轮：`协作模式` 是 MTV 自造词 ⇒ policy.reason 文案已换成官方两态词（见 `policyEngine.ts`）。 */
      summary: '更新节点 n1 的文本',
    });
    expect(OFFICIAL_CONFIRMATION_KIND_NODE_UPDATE).toBe('node_update');
  });

  it('工具没有摘要时回落 `approval.summary`（policy.reason）', () => {
    const content = contentOf(nodeUpdateConfirmationContent(approval(), null));
    const request = content.request as Record<string, unknown>;
    expect(request.summary).toBe('需手动确认：画布修改要经你批准后才执行');
  });

  it('summary 为空串时**不写** summary 键（让官方 Ftt 回落 "Update the node"）', () => {
    const content = contentOf(
      nodeUpdateConfirmationContent(approvalFixture('canvas_write', { summary: '' }), null),
    );
    const request = content.request as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(request, 'summary')).toBe(false);
  });

  it('声明 MTV 无 node_ref / changes / patch / replace_data 生产者', () => {
    const result = nodeUpdateConfirmationContent(approval(), toolCallFixture());
    expect(result.missingMtvFields).toContain('request.request_json.node_ref');
    expect(result.missingMtvFields).toContain('request.request_json.changes');
    expect(result.missingMtvFields).toContain('request.request_json.patch');
  });
});

/* ── 5. user_choice → AskUserQuestion ───────────────────────────────────── */

describe('agentApprovalContents · user_choice → AskUserQuestion（$b）', () => {
  const options = [
    { id: 'vendor/a', name: '模型 A', category: 'text' as const },
    { id: 'vendor/b', name: '模型 B', category: 'video' as const },
  ];
  const withOptions = () =>
    approvalFixture('user_choice', {
      summary: '需要你从清单中选择',
      inputRequest: { kind: 'provider_models', options, maxSelection: 4 },
    });

  it('命中 $b/MNe 族，request 形状逐字对齐官方生产者（@2132894）', () => {
    const result = askUserQuestionContent(withOptions(), toolCallFixture());
    const content = contentOf(result);

    expect(result.family).toBe('ask_question');
    expect(content.tool).toBe(OFFICIAL_TOOL_ASK_QUESTION);
    expect(toolEventNameOf(result.item!)).toBe('AskUserQuestion');
    expect(classifyToolEventFamily(result.item!)).toBe('ask_question');
    expect(content.request).toEqual({
      question_id: 'step-3-approval',
      question: '需要你从清单中选择',
      mode: OFFICIAL_ASK_QUESTION_MULTI_MODE,
      options: [{ label: '模型 A' }, { label: '模型 B' }],
    });
    expect(OFFICIAL_ASK_QUESTION_MULTI_MODE).toBe('multiple');
  });

  it('option 只写官方 Xie/OptionRow 认识的 label（不把 name/category 硬塞进 description）', () => {
    const content = contentOf(askUserQuestionContent(withOptions(), toolCallFixture()));
    const request = content.request as { options: Array<Record<string, unknown>> };
    for (const option of request.options) {
      expect(Object.keys(option)).toEqual(['label']);
    }
    expect(content.request).not.toHaveProperty('unused');
  });

  it('media_model（无 options）⇒ 明确不产出（官方 MB 要求 options 是数组）', () => {
    const result = askUserQuestionContent(
      approvalFixture('user_choice', {
        inputRequest: { kind: 'media_model', mediaKind: 'image' },
      }),
      toolCallFixture(),
    );
    expect(result.content).toBeNull();
    expect(result.family).toBe('ask_question');
    expect(result.notes.join('\n')).toContain('media_model');
    expect(result.missingMtvFields).toContain('request.options（MTV 无 producer）');
  });

  it('options 全为空 name / 空数组 ⇒ 明确不产出', () => {
    const empty = askUserQuestionContent(
      approvalFixture('user_choice', {
        inputRequest: { kind: 'provider_models', options: [] },
      }),
      toolCallFixture(),
    );
    expect(empty.content).toBeNull();

    const blank = askUserQuestionContent(
      approvalFixture('user_choice', {
        inputRequest: {
          kind: 'provider_models',
          options: [{ id: 'x', name: '   ', category: 'text' }],
        },
      }),
      toolCallFixture(),
    );
    expect(blank.content).toBeNull();
  });

  it('已作答但拿不到 selected_labels ⇒ 拒绝产出（官方会把空 answers 判成 cancelled）', () => {
    const result = askUserQuestionContent(withOptions(), toolCallFixture());
    expect(result.content).not.toBeNull(); /* pending 时产出 */

    const approved = askUserQuestionContent(
      approvalFixture('user_choice', {
        status: 'approved',
        resolvedAt: RESOLVED_AT,
        summary: '需要你从清单中选择',
        inputRequest: { kind: 'provider_models', options, maxSelection: 4 },
      }),
      toolCallFixture(),
    );
    expect(approved.content).toBeNull();
    expect(approved.notes.join('\n')).toContain('inputValues');
    expect(approved.missingMtvFields).toContain('response.answers[].selected_labels');
  });

  it('调用方显式提供 labels 时才写 response.answers', () => {
    const result = askUserQuestionContent(
      approvalFixture('user_choice', {
        status: 'approved',
        resolvedAt: RESOLVED_AT,
        summary: '需要你从清单中选择',
        inputRequest: { kind: 'provider_models', options, maxSelection: 4 },
      }),
      toolCallFixture(),
      ['模型 A', '模型 B'],
    );
    const content = contentOf(result);
    expect(content.status).toBe('completed');
    expect(content.response).toEqual({ action: 'confirm' });
    expect(content.answers).toEqual([
      { question_id: 'step-3-approval', selected_labels: ['模型 A', '模型 B'] },
    ]);
  });

  it('pending 时官方 Moe（iQe @2135282）本就在 c==="pending" 返回 null（只记 note，不造假）', () => {
    const result = askUserQuestionContent(withOptions(), toolCallFixture());
    expect(result.status).toBe('pending');
    expect(result.notes.join('\n')).toContain('Moe');
    expect(result.notes.join('\n')).toContain('null');
  });
});

/* ── 6. file_write / permanent_delete / asset_write → desktop_fs ─────────── */

describe('agentApprovalContents · 三个本地写 effect → desktop_fs_confirmation（kD）', () => {
  const kinds = ['file_write', 'permanent_delete', 'asset_write'] as const;

  it('三个 kind 都命中 kD/LNe 族', () => {
    for (const kind of kinds) {
      const result = desktopFsConfirmationContent(
        approvalFixture(kind, { summary: '本地文件写入始终需要确认' }),
        toolCallFixture(),
      );
      const content = contentOf(result);
      expect(result.family).toBe('desktop_confirmation');
      expect(content.tool).toBe('desktop_fs_confirmation');
      expect(isDesktopConfirmationTool(toolEventNameOf(result.item!))).toBe(true);
      expect(isAnyConfirmationCardTool(toolEventNameOf(result.item!))).toBe(true);
      expect(classifyToolEventFamily(result.item!)).toBe('desktop_confirmation');
      expect(content.request).toEqual({
        confirmation_id: 'step-3-approval',
        confirmation_kind: 'desktop_fs',
      });
      expect(OFFICIAL_CONFIRMATION_KIND_DESKTOP_FS).toBe('desktop_fs');
    }
  });

  it('只产信封：不写 operation / detail.request_json / grant id（MTV 无生产者）', () => {
    const content = contentOf(
      desktopFsConfirmationContent(approvalFixture('file_write'), toolCallFixture()),
    );
    const request = content.request as Record<string, unknown>;
    expect(request.operation).toBeUndefined();
    expect(request.detail).toBeUndefined();
    expect(request.file_grant_id).toBeUndefined();
    expect(request.directory_grant_id).toBeUndefined();
    expect(request.relative_path).toBeUndefined();
    expect(request.file_name).toBeUndefined();
    expect(hasConfirmationItems(content)).toBe(false);
  });

  it('官方 operation 值域逐字抄自 HQe @2160228（供后续 MTV 侧补生产者）', () => {
    expect(OFFICIAL_DESKTOP_FS_OPERATIONS).toEqual([
      'batch_write',
      'batch_upload',
      'pick_directory',
      'pick_file',
      'organize',
      'delete',
    ]);
  });

  it('notes 明确说明「官方 desktop_fs 是本地文件夹授权语义」与 MTV effect 只是形状对应', () => {
    const result = desktopFsConfirmationContent(approvalFixture('asset_write'), toolCallFixture());
    expect(result.notes.join('\n')).toContain('本地文件夹授权');
    expect(result.notes.join('\n')).toContain('operation');
    expect(result.missingMtvFields).toContain('request.detail.request_json.operation');
  });
});

/* ── 7. item 信封 / 时间戳 / tool_call_id ───────────────────────────────── */

describe('agentApprovalContents · item 信封', () => {
  it('tool_call_id 取 MTV callId；schema_version/type 逐字（官方 Gge @21102）', () => {
    const item = approvalStepToOfficialToolEventItem(
      stepFixture(approvalFixture('canvas_write')),
    )!;
    expect(item.type).toBe('tool_event');
    expect(item.content.schema_version).toBe('tool_event.v1');
    expect(item.content.type).toBe('tool_event');
    expect(item.content.tool_call_id).toBe('call-abc');
    expect(item.startedAt).toBe(REQUESTED_AT);
    expect(item.endedAt).toBeUndefined();
  });

  it('resolvedAt 存在时写 endedAt；缺 toolCall 时不写 tool_call_id', () => {
    const resolved = approvalToOfficialToolEventItem({
      approval: approvalFixture('canvas_write', { status: 'approved', resolvedAt: RESOLVED_AT }),
      toolCall: toolCallFixture(),
    })!;
    expect(resolved.endedAt).toBe(RESOLVED_AT);

    const noCall = approvalToOfficialToolEventItem({
      approval: approvalFixture('canvas_write'),
      toolCall: null,
    })!;
    expect(noCall.content.tool_call_id).toBeUndefined();
    expect(classifyToolEventFamily(noCall)).toBe('node_update_confirmation');
  });

  it('没有 approval 的 step 一律返回 null', () => {
    expect(approvalStepToOfficialToolEventItem(stepFixture(undefined))).toBeNull();
  });

  it('批量出口只收带审批的 step，并保持顺序 / 应用 labels 表', () => {
    const onlyApproval = approvalFixture('user_choice', {
      id: 'a-1',
      summary: '需要你从清单中选择',
      inputRequest: {
        kind: 'provider_models',
        options: [{ id: 'm', name: '模型 M', category: 'text' }],
      },
    });
    const resolvedChoice = approvalFixture('user_choice', {
      id: 'a-2',
      status: 'approved',
      resolvedAt: RESOLVED_AT,
      summary: '需要你从清单中选择',
      inputRequest: {
        kind: 'provider_models',
        options: [{ id: 'm', name: '模型 M', category: 'text' }],
      },
    });
    const steps: AgentStep[] = [
      stepFixture(undefined),
      stepFixture(onlyApproval),
      stepFixture(resolvedChoice),
    ];
    const items = approvalStepsToOfficialToolEventItems(steps, { 'a-2': ['模型 M'] });
    expect(items).toHaveLength(2);
    expect(items[0].content.request).not.toBeNull();
    expect((items[1].content as Record<string, unknown>).answers).toEqual([
      { question_id: 'a-2', selected_labels: ['模型 M'] },
    ]);
  });
});

/* ── 8. 与装配层 / 官方族分派的交叉一致性 ───────────────────────────────── */

describe('agentApprovalContents · 与装配层交叉一致性', () => {
  const built = [
    approvalToOfficialContent({
      approval: approvalFixture('media_generation', {
        inputRequest: { kind: 'media_model', mediaKind: 'video' },
      }),
      toolCall: toolCallFixture(),
    }),
    approvalToOfficialContent({
      approval: approvalFixture('canvas_write'),
      toolCall: toolCallFixture(),
    }),
    approvalToOfficialContent({
      approval: approvalFixture('file_write', {
        status: 'rejected',
        resolvedAt: RESOLVED_AT,
      }),
      toolCall: toolCallFixture(),
    }),
  ];

  it('每个产出物都通过 classifyToolEventFamily（= 官方 $M 的分派序）', () => {
    expect(built.map((result) => result.family)).toEqual([
      'generation_confirmation',
      'node_update_confirmation',
      'desktop_confirmation',
    ]);
    for (const result of built) expect(contentHitsExpectedFamily(result)).toBe(true);
  });

  it('产出物可以直接走 assembleRawAgentMessageContents 的 contents 直通口', () => {
    const items = built.map((result) => result.item!) as readonly OfficialAgentContentItem[];
    const assembled = assembleRawAgentMessageContents({ message: { contents: items } });
    expect(assembled).toHaveLength(items.length);
    expect(assembled.map((item) => classifyToolEventFamily(item))).toEqual([
      'generation_confirmation',
      'node_update_confirmation',
      'desktop_confirmation',
    ]);
  });

  it('splitAgentMessageContents 不会把确认卡当 task_snapshot 吃掉', () => {
    const items = built.map((result) => result.item!) as readonly OfficialAgentContentItem[];
    const split = splitAgentMessageContents({ message: { contents: items } });
    expect(split.contents).toHaveLength(items.length);
    expect(split.taskSnapshot).toBeNull();
  });

  it('产出的族名一定落在 APPROVAL_KIND_TO_OFFICIAL_FAMILY 的同一族（无漂移）', () => {
    for (const result of built) {
      expect(result.family).toBe(APPROVAL_KIND_TO_OFFICIAL_FAMILY[result.kind]);
    }
  });
});
