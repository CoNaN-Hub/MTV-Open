/**
 * **确认卡三颗参数胶囊的落地链路**（用户 2026-10-15 硬约束：
 * 「选中后要真的生效：写入该生成节点的参数，并让它成为下一次生成/重试时实际提交的参数（不是只改 UI 文案）」）。
 *
 * 链路（每一段都走**真实**代码，不 mock 中间层）：
 * ```
 * 卡片 confirm 载荷（官方 wire 名，`buildWireModifications`）
 *   └─ confirmationAnswerResolution   → AgentApprovalResolution.inputValues（camelCase）
 *        └─ resolveApprovalSelection  → media_generate 的**有效入参**（schema 已受理）
 *             ├─ buildMediaGenerationRequestSnapshot → 卡片载荷 `request_json.image.*`（重算后可见）
 *             └─ runMediaGeneration             → 真正发给 `generateImage` 的参数
 *                  └─ createMediaPlaceholder   → 节点数据（`imageSize` / `batchCount`）
 * ```
 *
 * 官方依据（逐字）：
 * · 卡片的 `onAnswer(confirmationId, action, modifications)` 第三参由官方 `Mv` 编码成
 *   `aspect_ratio` / `image_size` / `times`（编码表 `ETT` @2241685，见
 *   `generationChipController.buildWireModifications`）；
 * · 服务端 `gJe` 把 `modifications` **逐字段叠回** `request_json` ⇒ 用户改过的值优先；
 * · 清晰度候选 `imageSizeOptions:["1K","2K","4K"]` = `vendor-packages-DRvCmDjR.js` @1095139
 *   （`rq` = `NANO_BANANA_2_1`）；张数 `p8e=[1,2,4]` @1327920（`vendor-pkg-canvas-CvbAwZyy.js`）。
 *
 * ⚠️ **如实登记的能力边界**：MTV 的 `runMediaGeneration` 图片分支一次只产一个产物
 * （没有批量分支）⇒ `times` 本轮**不放大产出**，它的真实落点是节点数据 `batchCount`
 * （`generationService` 在「节点上再次生成」时按它批量跑）。见 `MediaGenerationIntent.times`。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captured } = vi.hoisted(() => ({ captured: [] as Array<Record<string, unknown>> }));

vi.mock('../../../src/services/ai/generateImage', () => ({
  generateImage: vi.fn(async (params: Record<string, unknown>) => {
    captured.push(params);
    /* 哨兵：拿到参数就结束（不建节点 / 不落盘 / 不联网）。 */
    throw new Error('CAPTURED_BEFORE_HTTP');
  }),
}));

import { runMediaGeneration } from '../../../src/services/ai/generationRuntime';
import { buildWireModifications } from '../../../src/components/chat/generationChipController';
import { confirmationAnswerResolution } from '../../../src/components/chat/confirmationEventDispatch';
import { prepareApprovalInput, resolveApprovalSelection } from '../../../src/services/chat/agentRoundExecutor';
import { clearAgentToolRegistryForTests, prepareAgentToolCall } from '../../../src/services/chat/toolRegistry';
import { registerMediaAgentTools } from '../../../src/services/chat/tools/mediaTools';
import { generationConfirmationContent } from '../../../src/services/chat/agentApprovalContents';
import { parseGenerationConfirmationLegacy } from '../../../src/services/chat/generationConfirmationProtocol';
import { useAppStore } from '../../../src/store/useAppStore';
import type { AgentApprovalSnapshot } from '../../../src/types/agent';
import type { MediaGenerationIntent } from '../../../src/types/media';

const PROJECT_ID = 'project-wiring';
const CONTEXT = {
  taskId: 'task-wiring',
  projectId: PROJECT_ID,
  conversationId: 'conversation-wiring',
  mode: 'collaborative' as const,
};

const IMAGE_MODEL = {
  id: 'audit-image',
  name: '直连图',
  modelId: 'nano-banana-2.1',
  category: 'image',
  providerConfigId: 'audit',
};

function seedStore() {
  useAppStore.setState({
    currentProjectId: PROJECT_ID,
    projects: [{ id: PROJECT_ID, name: 'Wiring', createdAt: 1, updatedAt: 1, settings: {} }],
    customStyles: [],
    config: {
      ...useAppStore.getState().config,
      providers: {
        ...useAppStore.getState().config.providers,
        audit: { name: 'Audit', baseUrl: 'https://example.invalid', apiKey: 'test-only-key' },
      },
      generalModels: [IMAGE_MODEL] as never,
    },
  });
}

/** 卡这一端：真实生产者 → 真实官方解析器（与 `mediaParamCardWireInvariant.test.ts` 同一套）。 */
function cardOf(generationRequest: unknown): ReturnType<typeof parseGenerationConfirmationLegacy> {
  const content = generationConfirmationContent(
    {
      id: 'approval-wiring',
      kind: 'media_generation',
      status: 'pending',
      summary: '付费媒体生成和重新生成每次都需要确认',
      requestedAt: 1,
      inputRequest: {
        kind: 'media_model',
        mediaKind: 'image',
        selectedModelRef: 'general/audit-image',
        generationRequest,
      },
    } as unknown as AgentApprovalSnapshot,
    { callId: 'wiring', toolId: 'media_generate', inputSummary: '生成 1 张图片' } as never,
  ).content;
  if (!content) throw new Error('approval payload missing');
  const viewModel = parseGenerationConfirmationLegacy(content);
  if (!viewModel) throw new Error('official parser rejected the payload');
  return viewModel;
}

beforeEach(() => {
  clearAgentToolRegistryForTests();
  useAppStore.setState(useAppStore.getInitialState(), true);
  captured.length = 0;
});

describe('卡上改参数 → media_generate 有效入参 → 请求 / 节点', () => {
  it('选 16:9 / 2K / 2× ⇒ 入参、卡片载荷、请求参数、节点数据四处一致', async () => {
    seedStore();
    registerMediaAgentTools();
    const call = {
      callId: 'call-wiring',
      toolId: 'media_generate',
      input: { kind: 'image', prompt: '一只猫', title: '一只猫', deliveryMode: 'canvas' },
    };
    const prepared = prepareAgentToolCall(call, CONTEXT);
    if (!prepared.ok) throw new Error(`prepare failed: ${prepared.result.summary}`);
    const approval = prepareApprovalInput(prepared.prepared, '生成一张猫图', 'collaborative', PROJECT_ID);
    if (!approval.inputRequest) throw new Error('approval inputRequest missing');

    /* 审批那一刻卡片载荷里的真实值（未改动前）。 */
    const before = cardOf(approval.inputRequest.generationRequest);
    expect(before?.params.aspectRatio).toBeUndefined();
    expect(before?.params.imageSize).toBeUndefined();

    /**
     * 卡片「确认」时上行的载荷 —— 由**官方 wire 编码器**产出（这里直接调控制器里的
     * `buildWireModifications`，与 `GenerationConfirmationCard` 的 confirm 路径同一个函数）。
     */
    const payload = buildWireModifications('image', {
      aspectRatio: '16:9',
      imageSize: '2K',
      times: 2,
      model: { status: 'known', id: 'general/audit-image' },
    }, {}, new Set<string>());
    const resolution = confirmationAnswerResolution('confirm', payload, undefined);
    expect(resolution.inputValues).toEqual({
      aspectRatio: '16:9',
      imageSize: '2K',
      times: 2,
      modelRef: 'general/audit-image',
    });

    const selection = resolveApprovalSelection(call, prepared.prepared, approval.inputRequest, resolution, CONTEXT);
    expect(selection.error).toBeUndefined();
    /* ① 有效入参（= `media_generate` 真正会执行的那份） */
    expect(selection.prepared.input).toMatchObject({
      modelRef: 'general/audit-image',
      aspectRatio: '16:9',
      imageSize: '2K',
      times: 2,
    });
    /* ② 重算后的卡片载荷（`request_json.image.*`，官方 `gJe` 的叠加语义） */
    const after = cardOf(selection.inputRequest?.generationRequest);
    expect(after?.params.aspectRatio).toBe('16:9');
    expect(after?.params.imageSize).toBe('2K');
    expect(after?.params.times).toBe(2);
    expect(after?.presentFields).toEqual(
      expect.arrayContaining(['aspectRatio', 'imageSize', 'times']),
    );
  });

  it('`runMediaGeneration` 的图片请求真的带上 `imageSize`（优先级：请求显式 > 项目默认 > 目录默认）', async () => {
    seedStore();
    const intent: MediaGenerationIntent = {
      kind: 'image',
      prompt: '一只猫',
      title: '一只猫',
      modelRef: 'general/audit-image',
      deliveryMode: 'canvas',
      aspectRatio: '16:9',
      imageSize: '2K',
    };
    await expect(runMediaGeneration(intent, PROJECT_ID)).rejects.toThrow('CAPTURED_BEFORE_HTTP');
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ imageSize: '2K', aspectRatio: '16:9' });
  });

  it('节点数据：`createMediaPlaceholder` 写入 `imageSize` 与 `batchCount`（张数的真实落点）', () => {
    seedStore();
    const intent: MediaGenerationIntent = {
      kind: 'image',
      prompt: '一只猫',
      title: '一只猫',
      modelRef: 'general/audit-image',
      deliveryMode: 'canvas',
      aspectRatio: '16:9',
      imageSize: '4K',
      times: 4,
    };
    const nodeId = useAppStore.getState().createMediaPlaceholder(intent);
    const data = useAppStore.getState().nodes.find((node) => node.id === nodeId)?.data as
      | { imageSize?: string; batchCount?: number; aspectRatio?: string }
      | undefined;
    expect(data).toMatchObject({ imageSize: '4K', batchCount: 4, aspectRatio: '16:9' });
  });

  it('源码级：`media_generate` 的入参 schema 受理 `imageSize` / `times` 且**不把它们放进 `required`**', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(process.cwd(), 'src/services/chat/tools/mediaTools.ts'), 'utf8');
    expect(source).toContain('imageSize: {');
    expect(source).toContain('times: {');
    expect(source).toContain("required: ['kind', 'prompt', 'deliveryMode']");
    /* 执行期把两者带进 `MediaGenerationIntent`（否则卡上选了也到不了请求层）。 */
    expect(source).toContain('imageSize: input.imageSize');
    expect(source).toContain('times: input.times');
  });
});
