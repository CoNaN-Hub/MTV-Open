/**
 * 第 79 轮：修「MTV Agent 生成确认卡」的两个真缺口（A / B）。
 *
 * ── 缺口 A：`@model{...}` 命中间接导致官方生成确认卡**根本不出现** ──
 * 旧 `prepareApprovalInput` 命中提及就 `return { prepared }` ⇒ 不产 `inputRequest`
 * ⇒ `agentApprovalContents.generationConfirmationContent` 拿不到 `media_model` 载荷
 * ⇒ 卡片只剩 `1×`（模型/比例/清晰度三颗 chip 全不见），在「用了 `@model`」这个用法下**必然**复现。
 *
 * ── 缺口 B：选了模型后**载荷不会重解析**（卡上显示的值 ≠ 实际会发的值）──
 * 审批那一刻模型可能还没定 ⇒ 视频的项目默认值被写进载荷；
 * 用户随后在卡上改选 `general` 直连模型 ⇒ 执行期 `generationRuntime` **不套**项目默认参数
 * ⇒ 卡上显示的项目默认值永远不会发出去。
 *
 * 官方出处（产物 `D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`，逐字）：
 *   · `WV`  @2265358（旧命名 `Sse`）：从载体读 `model_name` / `aspect_ratio` / `image_size` /
 *     `resolution` / `duration` / `times`，只把**载体里真的存在**的键放进 `presentFields`；
 *   · `Ott` @2262372（旧命名 `gJe`）：把用户 `modifications` 逐字段叠加在 params 之上
 *     （`str("model_name")` 等 ⇒ `r[p]=m`，`null` 才删键）。
 *
 * 验证分级 = **(b) 真解析器 + (d) 源码级**（卡片的 jsdom 真渲染在
 * `tests/components/generationConfirmationReselect.dom.test.tsx`）。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { prepareApprovalInput, resolveApprovalSelection } from '../../../src/services/chat/agentRoundExecutor';
import { prepareAgentToolCall, clearAgentToolRegistryForTests } from '../../../src/services/chat/toolRegistry';
import { registerMediaAgentTools } from '../../../src/services/chat/tools/mediaTools';
import {
  parseGenerationConfirmationLegacy,
  type GenerationConfirmationSingleViewModel,
} from '../../../src/services/chat/generationConfirmationProtocol';
import { generationConfirmationContent } from '../../../src/services/chat/agentApprovalContents';
import { useAppStore } from '../../../src/store/useAppStore';
import type { AgentApprovalInputRequest, AgentApprovalSnapshot } from '../../../src/types/agent';

const CONTEXT = {
  taskId: 'task-79',
  projectId: 'project-79',
  conversationId: 'conversation-79',
  mode: 'collaborative' as const,
};

type MediaInput = { kind: string; prompt: string; deliveryMode: string; modelRef?: string };

function seedStore(
  settings: Record<string, unknown>,
  generalModels: unknown[] = [],
) {
  useAppStore.setState({
    currentProjectId: 'project-79',
    projects: [{
      id: 'project-79',
      name: 'Reselect',
      createdAt: 1,
      updatedAt: 1,
      settings,
    }],
    config: {
      ...useAppStore.getState().config,
      providers: {
        ...useAppStore.getState().config.providers,
        audit: { name: 'Audit', baseUrl: 'https://example.invalid', apiKey: 'test-only-key' },
        apimart: { name: 'APIMart', baseUrl: 'https://example.invalid', apiKey: 'test-only-key' },
      },
      generalModels: generalModels as never,
    },
  });
}

/** 走**真实**工具注册表准备一次 `media_generate`（拿到 Registry 校验过的 `prepared` + 原始 `call`）。 */
function prepareMedia(input: MediaInput) {
  registerMediaAgentTools();
  const call = { callId: 'call-79', toolId: 'media_generate', input };
  const prepared = prepareAgentToolCall(call, CONTEXT);
  if (!prepared.ok) throw new Error(`media preparation failed: ${prepared.result.summary}`);
  return { call, prepared: prepared.prepared };
}

/** 把审批载荷喂给官方解析器（= 卡片真正的输入）。 */
function viewModelOf(inputRequest: AgentApprovalInputRequest | undefined): GenerationConfirmationSingleViewModel {
  const content = generationConfirmationContent(
    {
      id: 'approval-79',
      kind: 'media_generation',
      status: 'pending',
      summary: '付费媒体生成和重新生成每次都需要确认',
      requestedAt: 1,
      inputRequest,
    } as AgentApprovalSnapshot,
    { callId: 'call-79', toolId: 'media_generate', inputSummary: '生成 1 个媒体产物' } as never,
  ).content;
  expect(content).not.toBeNull();
  const viewModel = parseGenerationConfirmationLegacy(content);
  if (!viewModel) throw new Error('official legacy parser rejected the payload');
  return viewModel;
}

function generationOf(inputRequest: AgentApprovalInputRequest | undefined) {
  if (inputRequest?.kind !== 'media_model') throw new Error('not a media_model approval');
  return inputRequest.generationRequest;
}

beforeEach(() => {
  clearAgentToolRegistryForTests();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('缺口 A：`@model{...}` 提及也要产官方生成确认卡与完整载荷', () => {
  it('用了 `@model` ⇒ 仍有 `inputRequest`，`model_name` = 提及的模型，四颗 chip 全在', () => {
    seedStore(
      { generation: { imageAspectRatio: '3:4', imageSize: '1K' } },
      [{ id: 'audit-image', name: '画图', modelId: 'media-a', category: 'image', providerConfigId: 'audit' }],
    );
    const { prepared } = prepareMedia({ kind: 'image', prompt: '一只猫', deliveryMode: 'chat' });

    const approval = prepareApprovalInput(
      prepared,
      '生成一张图片 @model{general/audit-image|画图}',
      'collaborative',
      'project-79',
    );

    /* 旧代码在这里**没有** `inputRequest`（提前 return）⇒ 卡片完全没有载荷。 */
    expect(approval.inputRequest?.kind).toBe('media_model');
    /* 提及的模型就是这次请求会用的模型 ⇒ 必须写进官方 `request_json.model_name`。 */
    expect(generationOf(approval.inputRequest)?.modelName).toBe('general/audit-image');
    /* 提及把模型绑死了（`tools/mediaTools.ts` 的 `authorize`）⇒ 卡片预选它，模型 chip 因此有内容。 */
    expect(approval.inputRequest?.kind === 'media_model' ? approval.inputRequest.selectedModelRef : undefined)
      .toBe('general/audit-image');

    const vm = viewModelOf(approval.inputRequest);
    expect(vm.requestKind).toBe('image');
    expect(vm.presentFields).toEqual(
      expect.arrayContaining(['model', 'prompt', 'aspectRatio', 'imageSize', 'times']),
    );
    expect(vm.params.model).toMatchObject({ status: 'unknown', displayName: 'general/audit-image' });
    expect(vm.params.aspectRatio).toBe('3:4');
    expect(vm.params.imageSize).toBe('1K');
  });

  it('没有提及的老路径不受影响（`inputRequest` 照旧，不预选）', () => {
    seedStore(
      { defaultModels: { image: 'general/audit-image' } },
      [{ id: 'audit-image', name: '画图', modelId: 'media-a', category: 'image', providerConfigId: 'audit' }],
    );
    const { prepared } = prepareMedia({ kind: 'image', prompt: '一只猫', deliveryMode: 'chat' });
    const approval = prepareApprovalInput(prepared, '生成一张图片', 'collaborative', 'project-79');
    expect(approval.inputRequest?.kind).toBe('media_model');
    expect(approval.inputRequest).not.toHaveProperty('selectedModelRef');
    expect(generationOf(approval.inputRequest)?.modelName).toBe('general/audit-image');
  });

  it('提及与显式 `modelRef` 冲突时仍交给 `authorize` 拒绝（不放行）', () => {
    seedStore({}, [
      { id: 'audit-image', name: '显式', modelId: 'media-a', category: 'image', providerConfigId: 'audit' },
      { id: 'audit-style', name: '提及', modelId: 'media-b', category: 'image', providerConfigId: 'audit' },
    ]);
    const { prepared } = prepareMedia({
      kind: 'image', prompt: '一只猫', deliveryMode: 'chat', modelRef: 'general/audit-image',
    });
    const approval = prepareApprovalInput(
      prepared,
      '画一张 @model{general/audit-style}',
      'collaborative',
      'project-79',
    );
    /* 提及命中 ⇒ 审批输入**保留** modelRef（摘掉会变成「提及 ≠ undefined」而被 authorize 拒），
       保留的是**显式**那个 ⇒ 冲突仍由 Policy/`authorize` 拒绝，不被静默改写。 */
    expect((approval.prepared.input as { modelRef?: string }).modelRef).toBe('general/audit-image');
  });

  /**
   * **登记（未修）**：`@model{...}` 只在 `input.modelRef` 为空时才写进去。
   * `tools/mediaTools.resolveMediaToolInput` 会先把**项目默认模型**填进 `input.modelRef`
   * ⇒ 两者不同时，提及不覆盖项目默认模型，随后 `authorize`（提及 ≠ 项目默认）拒绝整次调用。
   * 本轮不改这条优先级：官方产物里**没有** `@model` 提及这套东西（`CvbAwZyy.js` 里搜不到
   * `@model`），改了就是自创；而且会推翻 `tests/services/chat/agentRoundExecutor.test.ts:472`
   * 已经定下的「显式 modelRef ≠ 提及 ⇒ 拒绝」语义。如实登记。
   */
  it('登记：提及与「项目默认模型」不同、且 agent 没传 modelRef 时，提及不覆盖（会被 authorize 拒）', () => {
    seedStore(
      { defaultModels: { image: 'general/audit-other' } },
      [
        { id: 'audit-image', name: '提及的', modelId: 'media-a', category: 'image', providerConfigId: 'audit' },
        { id: 'audit-other', name: '项目默认', modelId: 'media-b', category: 'image', providerConfigId: 'audit' },
      ],
    );
    const { prepared } = prepareMedia({ kind: 'image', prompt: '一只猫', deliveryMode: 'chat' });
    const approval = prepareApprovalInput(
      prepared,
      '画一张 @model{general/audit-image}',
      'collaborative',
      'project-79',
    );
    /* 现状：项目默认模型赢（`resolveMediaToolInput` 先填）⇒ 载荷与预选都是它。 */
    expect(generationOf(approval.inputRequest)?.modelName).toBe('general/audit-other');
  });
});

describe('缺口 B：用户在卡上选完模型 ⇒ 载荷按同一解析器重算', () => {
  const VIDEO_SETTINGS = {
    generation: { videoAspectRatio: '16:9', videoResolution: '1080p', videoDuration: 5 },
  };

  it('选 `general` 直连 ⇒ 视频项目默认值**不再出现**（与 `generationRuntime` 的门一致）', () => {
    seedStore(VIDEO_SETTINGS, [
      { id: 'audit-video', name: '直连', modelId: 'media-v', category: 'video', providerConfigId: 'audit' },
    ]);
    const { call, prepared } = prepareMedia({ kind: 'video', prompt: '镜头推近', deliveryMode: 'chat' });
    const approval = prepareApprovalInput(prepared, '生成视频', 'collaborative', 'project-79');

    /* 审批那一刻没有模型 ⇒ 旧决议把**项目默认值**写进了载荷（这正是缺口的来源）。 */
    expect(approval.inputRequest?.kind).toBe('media_model');
    expect(generationOf(approval.inputRequest)?.aspectRatio).toBe('16:9');
    expect(generationOf(approval.inputRequest)?.resolution).toBe('1080p');
    expect(generationOf(approval.inputRequest)?.duration).toBe(5);

    const selected = resolveApprovalSelection(
      call,
      approval.prepared,
      approval.inputRequest,
      { approved: true, inputValues: { modelRef: 'general/audit-video' } },
      CONTEXT,
    );
    expect(selected.error).toBeUndefined();
    const after = generationOf(selected.inputRequest);
    expect(after?.modelName).toBe('general/audit-video');
    /* `general` 直连 ⇒ `directGeneralProtocol` ⇒ 不套项目默认参数。 */
    expect(after?.aspectRatio).toBeUndefined();
    expect(after?.resolution).toBeUndefined();
    expect(after?.duration).toBeUndefined();
    /* 真正做到「卡上显示的值 = 实际会发的值」：执行输入里也没有那三个键。 */
    expect(selected.prepared.input).not.toHaveProperty('aspectRatio');
    expect(selected.prepared.input).not.toHaveProperty('resolution');
    expect(selected.prepared.input).not.toHaveProperty('duration');

    const vm = viewModelOf(selected.inputRequest);
    expect(vm.presentFields).not.toContain('aspectRatio');
    expect(vm.presentFields).not.toContain('resolution');
    expect(vm.presentFields).not.toContain('duration');
    expect(vm.params.model).toMatchObject({ status: 'unknown', displayName: 'general/audit-video' });
  });

  it('选内置模型（非直连）⇒ 项目默认值**出现**在重算后的载荷里，执行输入也带上', () => {
    seedStore(
      { ...VIDEO_SETTINGS, defaultModels: { video: 'general/audit-video' } },
      [{ id: 'audit-video', name: '直连', modelId: 'media-v', category: 'video', providerConfigId: 'audit' }],
    );
    const { call, prepared } = prepareMedia({ kind: 'video', prompt: '镜头推近', deliveryMode: 'chat' });
    const approval = prepareApprovalInput(prepared, '生成视频', 'collaborative', 'project-79');

    /* 项目默认模型是 `general` 直连 ⇒ 审批那一刻**不写**视频参数。 */
    expect(approval.inputRequest?.kind).toBe('media_model');
    expect(generationOf(approval.inputRequest)?.modelName).toBe('general/audit-video');
    expect(generationOf(approval.inputRequest)?.aspectRatio).toBeUndefined();

    const selected = resolveApprovalSelection(
      call,
      approval.prepared,
      approval.inputRequest,
      { approved: true, inputValues: { modelRef: 'apimart/doubao-seedance-2.0' } },
      CONTEXT,
    );
    expect(selected.error).toBeUndefined();
    const after = generationOf(selected.inputRequest);
    expect(after?.modelName).toBe('apimart/doubao-seedance-2.0');
    expect(after?.aspectRatio).toBe('16:9');
    expect(after?.resolution).toBe('1080p');
    expect(after?.duration).toBe(5);
    /* 「卡上显示 = 实际会发」：执行输入也带上了这三条。 */
    expect(selected.prepared.input).toMatchObject({
      modelRef: 'apimart/doubao-seedance-2.0',
      aspectRatio: '16:9',
      resolution: '1080p',
      duration: 5,
    });

    const vm = viewModelOf(selected.inputRequest);
    expect(vm.presentFields).toEqual(
      expect.arrayContaining(['model', 'aspectRatio', 'resolution', 'duration']),
    );
    expect(vm.params.aspectRatio).toBe('16:9');
    expect(vm.params.resolution).toBe('1080p');
    expect(vm.params.duration).toBe(5);
  });

  it('用户显式给的视频参数不因重算丢掉（`intent.*` 仍优先于项目设置）', () => {
    seedStore(VIDEO_SETTINGS, [
      { id: 'audit-video', name: '直连', modelId: 'media-v', category: 'video', providerConfigId: 'audit' },
    ]);
    const { call, prepared } = prepareMedia({
      kind: 'video', prompt: '竖屏镜头', deliveryMode: 'chat', aspectRatio: '9:16', duration: 8,
    });
    const approval = prepareApprovalInput(prepared, '生成视频', 'collaborative', 'project-79');
    const selected = resolveApprovalSelection(
      call,
      approval.prepared,
      approval.inputRequest,
      { approved: true, inputValues: { modelRef: 'general/audit-video' } },
      CONTEXT,
    );
    expect(selected.error).toBeUndefined();
    const after = generationOf(selected.inputRequest);
    expect(after?.aspectRatio).toBe('9:16');
    expect(after?.duration).toBe(8);
    /* 未显式给的分辨率：直连 ⇒ 项目设置不套。 */
    expect(after?.resolution).toBeUndefined();
    expect(selected.prepared.input).toMatchObject({ aspectRatio: '9:16', duration: 8 });
    expect(selected.prepared.input).not.toHaveProperty('resolution');
  });

  it('图片：**无来源**时比例/清晰度都不填（第 65 轮的硬兜底 `1:1`/`2K` 已被 round 122 推翻）', () => {
    seedStore({}, [
      { id: 'audit-image', name: '直连图', modelId: 'media-a', category: 'image', providerConfigId: 'audit' },
    ]);
    const { call, prepared } = prepareMedia({ kind: 'image', prompt: '一只猫', deliveryMode: 'chat' });
    const approval = prepareApprovalInput(prepared, '生成图片', 'collaborative', 'project-79');
    const selected = resolveApprovalSelection(
      call,
      approval.prepared,
      approval.inputRequest,
      { approved: true, inputValues: { modelRef: 'general/audit-image' } },
      CONTEXT,
    );
    expect(selected.error).toBeUndefined();
    const after = generationOf(selected.inputRequest);
    /**
     * **用户 2026-10-15 裁决（round 122）**：`aspectRatio` / `imageSize` 走**同一条链**
     * `显式入参 > 项目设置 > 所选模型目录 defaults.<key> > 不填`。
     *
     * 本用例的模型是自接 provider 的 `media-a`，`model-param-catalog.json` 里查不到
     * ⇒ 没有「目录默认」这一级；项目也没给生成设置 ⇒ **两级来源都没有 ⇒ 不填**。
     *
     * 官方依据（同一份，逐字）：
     * - `Pb(e,t)`（`vendor-pkg-canvas-DuoOicPr.js` @2239682 邻域）：`i = t ? { ...n.defaults, aspectRatio: t } : n.defaults`
     *   —— 当前值缺省时**只**用模型自己的 `defaults`，**不造值**；
     * - `Eoe` 的比例组 gate `M = b && _ && _.length > 0 && v`（@2322322 邻域）—— **要求当前值 `v` 已定义**
     *   ⇒ 无来源时官方根本渲染不出「已选比例」，更不会伪造 `1:1`。
     *
     * 旧断言钉的是 MTV 自己的常量（`generationRuntime` 的 `|| '1:1'` / `|| '2K'`），
     * 对 `nano-banana-flash-lite`（目录只有 `["1K"]`）这类模型会**发出它不支持的值** ⇒ 已判定为真 bug。
     */
    expect(after?.aspectRatio).toBeUndefined();
    expect(after?.imageSize).toBeUndefined();
    /* 张数有独立来源（请求自身 `times`），不受影响。 */
    expect(after?.times).toBe(1);
    const vm = viewModelOf(selected.inputRequest);
    expect(vm.params.aspectRatio).toBeUndefined();
    expect(vm.params.imageSize).toBeUndefined();
    expect(vm.presentFields).not.toContain('aspectRatio');
    expect(vm.presentFields).not.toContain('imageSize');
  });

  it('在卡上选完模型后，`selected.prepared.input` 就是最终执行的那份输入', () => {
    seedStore(VIDEO_SETTINGS, [
      { id: 'audit-video', name: '直连', modelId: 'media-v', category: 'video', providerConfigId: 'audit' },
    ]);
    const { call, prepared } = prepareMedia({ kind: 'video', prompt: '镜头推近', deliveryMode: 'chat' });
    const approval = prepareApprovalInput(prepared, '生成视频', 'collaborative', 'project-79');
    const selected = resolveApprovalSelection(
      call,
      approval.prepared,
      approval.inputRequest,
      { approved: true, inputValues: { modelRef: 'general/audit-video' } },
      CONTEXT,
    );
    expect(selected.error).toBeUndefined();
    expect((selected.prepared.input as { modelRef?: string }).modelRef).toBe('general/audit-video');
    expect(selected.call.input).toMatchObject({ modelRef: 'general/audit-video' });
  });
});

describe('源码级：两处改动点仍走同一个载荷构造器', () => {
  it('`prepareApprovalInput` 与 `resolveApprovalSelection` 都调 `buildMediaGenerationRequestSnapshot`', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(process.cwd(), 'src/services/chat/agentRoundExecutor.ts'), 'utf8');
    const calls = source.match(/buildMediaGenerationRequestSnapshot\(/g) ?? [];
    /* 1 次定义 + 2 次调用（审批那一刻 / 用户选完模型那一刻）。 */
    expect(calls.length).toBeGreaterThanOrEqual(3);
    /* 缺口 A：提及那条分支不许再出现「命中就 return」。 */
    expect(source).not.toMatch(/if \(mentionedModelRef\) \{\s*return \{/);
  });
});
