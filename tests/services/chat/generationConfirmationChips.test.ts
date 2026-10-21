/**
 * 第 74 轮：官方生成确认卡的**四颗 chip**（模型 / 比例 / 清晰度 / 张数）在 MTV 侧的生产者。
 *
 * 用户真机对照：
 *   · 官方（图 2）逐字：`图片生成` + 提示词 + `Nano Banana 2.1` / `3:4` / `1K` / `1×`；
 *   · MTV（图 1）同位置**只有 `1×`** —— 模型/比例/清晰度都没有。
 *
 * 官方读侧（`generationConfirmationProtocol.ts` 的 `Sse` @2214xxx / `GB` @2227xxx，逐字）：
 * ```
 * o.model = BE(kind, Gr(e,"model_name"))              // presentFields += "model"
 * l("aspectRatio","aspect_ratio")                     // presentFields += "aspectRatio"
 * l("imageSize","image_size")                         // presentFields += "imageSize"
 * num("times","times")                                // presentFields += "times"
 * ```
 * `presentFields` 只装**载体里真的存在**的键 ⇒ 载荷不写，chip 就不渲染（`Jnt` / `show*Chip`）。
 *
 * 本文件验证「生产者 → 官方解析器 → presentFields」这条链：同一份 `settings` 喂出来的值
 * 既进载荷、也是这次生成**实际会用到**的那组（`generationRuntime.runMediaGeneration`）。
 *
 * 验证分级 = **(b) 真解析器 + (d) 源码级**。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { prepareApprovalInput } from '../../../src/services/chat/agentRoundExecutor';
import { prepareAgentToolCall, clearAgentToolRegistryForTests } from '../../../src/services/chat/toolRegistry';
import { registerMediaAgentTools } from '../../../src/services/chat/tools/mediaTools';
import {
  parseGenerationConfirmationLegacy,
  type GenerationConfirmationSingleViewModel,
} from '../../../src/services/chat/generationConfirmationProtocol';
import { generationConfirmationContent } from '../../../src/services/chat/agentApprovalContents';
import { useAppStore } from '../../../src/store/useAppStore';
import type { AgentApprovalSnapshot } from '../../../src/types/agent';

const CONTEXT = {
  taskId: 'task-74',
  projectId: 'project-74',
  conversationId: 'conversation-74',
  mode: 'collaborative' as const,
};

function seedStore(settings: Record<string, unknown>, generalModels: unknown[] = []) {
  useAppStore.setState({
    currentProjectId: 'project-74',
    projects: [{
      id: 'project-74',
      name: 'Chips',
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

/** 走**真实**工具注册表 + 真实 `prepareApprovalInput`，取审批载荷。 */
function approvalFor(
  input: Record<string, unknown>,
  settings: Record<string, unknown>,
  generalModels: unknown[] = [],
) {
  seedStore(settings, generalModels);
  registerMediaAgentTools();
  const call = { callId: 'call-74', toolId: 'media_generate', input };
  const prepared = prepareAgentToolCall(call, CONTEXT);
  if (!prepared.ok) throw new Error(`media preparation failed: ${prepared.result.summary}`);
  return prepareApprovalInput(prepared.prepared, '生成一张图片', 'collaborative', 'project-74');
}

/** 把审批载荷喂给官方解析器，返回单条 viewModel（= 卡片真正的输入）。 */
function viewModelOf(approval: ReturnType<typeof approvalFor>): GenerationConfirmationSingleViewModel {
  const content = generationConfirmationContent(
    {
      id: 'approval-74',
      kind: 'media_generation',
      status: 'pending',
      summary: '付费媒体生成和重新生成每次都需要确认',
      requestedAt: 1,
      inputRequest: approval.inputRequest,
    } as AgentApprovalSnapshot,
    { callId: 'call-74', toolId: 'media_generate', inputSummary: '生成 1 张图片' } as never,
  ).content;
  expect(content).not.toBeNull();
  const viewModel = parseGenerationConfirmationLegacy(content);
  if (!viewModel) throw new Error('official legacy parser rejected the payload');
  return viewModel;
}

beforeEach(() => {
  clearAgentToolRegistryForTests();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('生成确认卡 chip 载荷：有来源 ⇒ 写出并解析出 presentFields', () => {
  it('图片：模型 + 比例 + 清晰度 + 张数 全部写出（模型/比例/清晰度来自项目设置）', () => {
    const approval = approvalFor(
      { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', title: '测试标题' },
      {
        defaultModels: { image: 'general/audit-image' },
        generation: { imageAspectRatio: '3:4', imageSize: '1K' },
      },
      [{ id: 'audit-image', name: '画图', modelId: 'media-a', category: 'image', providerConfigId: 'audit' }],
    );
    expect(approval.inputRequest?.kind).toBe('media_model');
    const vm = viewModelOf(approval);
    expect(vm.requestKind).toBe('image');
    expect(vm.presentFields).toEqual(
      expect.arrayContaining(['model', 'prompt', 'aspectRatio', 'imageSize', 'times']),
    );
    expect(vm.params.aspectRatio).toBe('3:4');
    expect(vm.params.imageSize).toBe('1K');
    expect(vm.params.times).toBe(1);
    /* 官方 `hE(kind,"model_name")` 在 MTV 目录为空 ⇒ `{status:"unknown",displayName}`，
       但 `model` **照样进 presentFields**（模型 chip 因此渲染）。 */
    expect(vm.params.model).toMatchObject({ status: 'unknown', displayName: 'general/audit-image' });
  });

  it('视频：显式入参优先于项目设置（`intent.aspectRatio ?? settings` 逐字）', () => {
    const approval = approvalFor(
      { kind: 'video', prompt: '镜头推近', deliveryMode: 'chat', title: '测试标题', aspectRatio: '9:16', duration: 8 },
      {
        defaultModels: { video: 'apimart/doubao-seedance-2.0' },
        generation: { videoAspectRatio: '16:9', videoResolution: '1080p', videoDuration: 5 },
      },
    );
    const vm = viewModelOf(approval);
    expect(vm.requestKind).toBe('video');
    expect(vm.params.aspectRatio).toBe('9:16');
    expect(vm.params.duration).toBe(8);
    /* 未显式给的分辨率落到项目设置。 */
    expect(vm.params.resolution).toBe('1080p');
    expect(vm.presentFields).toEqual(expect.arrayContaining(['model', 'aspectRatio', 'resolution', 'duration']));
  });

  it('视频：`general` 直连模型**不套**项目设置（`directGeneralProtocol` 门，逐字）', () => {
    const approval = approvalFor(
      { kind: 'video', prompt: '镜头推近', deliveryMode: 'chat', title: '测试标题' },
      {
        defaultModels: { video: 'general/audit-video' },
        generation: { videoAspectRatio: '16:9', videoResolution: '1080p', videoDuration: 5 },
      },
      [{ id: 'audit-video', name: '视频', modelId: 'media-v', category: 'video', providerConfigId: 'audit' }],
    );
    const vm = viewModelOf(approval);
    expect(vm.params.aspectRatio).toBeUndefined();
    expect(vm.params.resolution).toBeUndefined();
    expect(vm.params.duration).toBeUndefined();
    expect(vm.presentFields).not.toContain('aspectRatio');
    expect(vm.presentFields).not.toContain('resolution');
    /* 模型仍然写（模型 chip 与 general 门无关）。 */
    expect(vm.presentFields).toContain('model');
  });
});

describe('生成确认卡 chip 载荷：模型来源（比例/清晰度 = 显式 > 项目默认 > 目录 defaults > 不填）', () => {
  it('项目无默认模型、无生成设置、agent 也没给 ⇒ 无模型、**比例与清晰度都不填**（无来源）', () => {
    const approval = approvalFor(
      { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', title: '测试标题' },
      {},
    );
    const vm = viewModelOf(approval);
    expect(vm.params.model).toBeUndefined();
    /**
     * **用户 2026-10-15 裁决**：`imageSize` 与 `aspectRatio` 走**同一条链**：
     * `显式值 > 项目默认 > 所选模型目录 defaults.<key> > 不填`（目录文件
     * `src/data/model-param-catalog.json`）。这里**连模型都没有** ⇒ 没有「目录默认」这一级
     * ⇒ 两个值都**不填**（不写字段、不渲染 chip）。
     * 旧断言钉的是硬编码兜底 `1:1` / `2K`（`generationRuntime` 的 `|| '1:1'` / `|| '2K'`），
     * 已被裁决判定为真 bug（`nano-banana-flash-lite` 只有 `["1K"]`，硬填 `2K` 是它不支持的值）。
     * 官方依据：`Pb(e,t)` 的 `i = t ? {...n.defaults, aspectRatio:t} : n.defaults`（用模型自己的 defaults）
     * + `Eoe` 的比例组 gate `M = b && _ && _.length>0 && v`（**要求当前值已定义** ⇒ 官方不伪造）。
     */
    expect(vm.params.aspectRatio).toBeUndefined();
    expect(vm.params.imageSize).toBeUndefined();
    expect(vm.presentFields).not.toContain('model');
    expect(vm.presentFields).not.toContain('aspectRatio');
    expect(vm.presentFields).not.toContain('imageSize');
    expect(vm.presentFields).toContain('times');
  });

  it('图片：没有来源时比例/清晰度**不填**（不再落 `1:1` / `2K` 硬兜底）', () => {
    const approval = approvalFor(
      { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', title: '测试标题' },
      { defaultModels: { image: 'general/audit-image' } },
      [{ id: 'audit-image', name: '画图', modelId: 'media-a', category: 'image', providerConfigId: 'audit' }],
    );
    const request = (approval.inputRequest as { generationRequest?: { aspectRatio?: string; imageSize?: string } })
      .generationRequest;
    /* 该模型是自接 provider 的 `provider-custom-…/media-a` ⇒ 目录里查不到 ⇒ 无 defaults ⇒ 不填。 */
    expect(request?.aspectRatio).toBeUndefined();
    expect(request?.imageSize).toBeUndefined();
    const vm = viewModelOf(approval);
    expect(vm.presentFields).not.toContain('aspectRatio');
    expect(vm.presentFields).not.toContain('imageSize');
  });
});

describe('优先级（以产物取证的顺序为准）', () => {
  it('模型：显式 `modelRef` > 项目默认模型', () => {
    const approval = approvalFor(
      { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', title: '测试标题', modelRef: 'general/audit-explicit' },
      { defaultModels: { image: 'general/audit-image' } },
      [
        { id: 'audit-image', name: '默认', modelId: 'media-a', category: 'image', providerConfigId: 'audit' },
        { id: 'audit-explicit', name: '显式', modelId: 'media-b', category: 'image', providerConfigId: 'audit' },
      ],
    );
    const request = (approval.inputRequest as { generationRequest?: { modelName?: string } }).generationRequest;
    expect(request?.modelName).toBe('general/audit-explicit');
  });

  it('模型：没有显式时用项目默认模型（`resolveDefaultMediaModelRef`，与执行期同一个函数）', () => {
    const approval = approvalFor(
      { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', title: '测试标题' },
      { defaultModels: { image: 'general/audit-image' } },
      [{ id: 'audit-image', name: '默认', modelId: 'media-a', category: 'image', providerConfigId: 'audit' }],
    );
    const request = (approval.inputRequest as { generationRequest?: { modelName?: string } }).generationRequest;
    expect(request?.modelName).toBe('general/audit-image');
  });

  it('模型：审批卡里用户选定的 `selectedModelRef` 按官方 `gJe` 叠加语义**覆盖**原载荷', () => {
    const content = generationConfirmationContent(
      {
        id: 'approval-74',
        kind: 'media_generation',
        status: 'approved',
        summary: '生成媒体',
        requestedAt: 1,
        inputRequest: {
          kind: 'media_model',
          mediaKind: 'image',
          selectedModelRef: 'general/audit-picked',
          generationRequest: { kind: 'image', prompt: '一只猫', modelName: 'general/audit-image', times: 1 },
        },
      } as AgentApprovalSnapshot,
      undefined,
    ).content;
    const viewModel = parseGenerationConfirmationLegacy(content);
    expect(viewModel?.params.model).toMatchObject({ displayName: 'general/audit-picked' });
  });

  it('比例：显式入参 > 项目设置；清晰度：MTV 只有项目设置这一个来源', () => {
    const approval = approvalFor(
      { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', title: '测试标题' },
      {
        defaultModels: { image: 'general/audit-image' },
        generation: { imageAspectRatio: '3:4', imageSize: '2K' },
      },
      [{ id: 'audit-image', name: '默认', modelId: 'media-a', category: 'image', providerConfigId: 'audit' }],
    );
    const request = (approval.inputRequest as {
      generationRequest?: { aspectRatio?: string; imageSize?: string };
    }).generationRequest;
    expect(request?.aspectRatio).toBe('3:4');
    expect(request?.imageSize).toBe('2K');
  });
});

describe('源码级：生产者不再只看 `media_generate` 入参', () => {
  it('`prepareApprovalInput` 调 `resolveDefaultMediaRequestParams` 并写 `imageSize`', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(process.cwd(), 'src/services/chat/agentRoundExecutor.ts'), 'utf8');
    expect(source).toContain('resolveDefaultMediaRequestParams');
    expect(source).toContain('requestParams.imageSize');
    /* 与执行期同一个门控（`directGeneralProtocol`）由 `mediaInputResolution` 承载。 */
    const resolver = readFileSync(resolve(process.cwd(), 'src/services/chat/mediaInputResolution.ts'), 'utf8');
    expect(resolver).toContain('directGeneralProtocol');
    expect(resolver).toContain('imageAspectRatio');
    expect(resolver).toContain('imageSize');
  });

  /**
   * 「读节点参数」的**可证伪形式**：`media_generate` 审批时目标节点还不存在
   * （`createMediaPlaceholder` 在执行期才建），所以载荷能读到的「节点参数」只能是
   * **喂给节点的那份 settings**。这条用例证明两者确实是同一份数据。
   */
  it('同一份 settings 经 `applyProjectDefaultsToNodeData` 会落到节点字段（与载荷同源）', async () => {
    const { applyProjectDefaultsToNodeData } = await import('../../../src/services/projectSettingsService');
    const settings = {
      defaultModels: { image: 'general/audit-image' },
      generation: { imageAspectRatio: '3:4', imageSize: '1K' },
    } as never;
    const nodeData = applyProjectDefaultsToNodeData(
      { type: 'ai-image', label: '新图片', role: 'generator' } as never,
      settings,
    ) as { model?: string; aspectRatio?: string; imageSize?: string };
    /* 节点侧（`projectSettingsService.ts:205-256`）。 */
    expect(nodeData.aspectRatio).toBe('3:4');
    expect(nodeData.imageSize).toBe('1K');
    /* 载荷侧（`prepareApprovalInput` → `resolveDefaultMediaRequestParams`）——同一个值。 */
    const approval = approvalFor(
      { kind: 'image', prompt: '一只猫', deliveryMode: 'chat', title: '测试标题' },
      settings as unknown as Record<string, unknown>,
      [{ id: 'audit-image', name: '画图', modelId: 'media-a', category: 'image', providerConfigId: 'audit' }],
    );
    const request = (approval.inputRequest as {
      generationRequest?: { aspectRatio?: string; imageSize?: string };
    }).generationRequest;
    expect(request?.aspectRatio).toBe(nodeData.aspectRatio);
    expect(request?.imageSize).toBe(nodeData.imageSize);
  });
});
