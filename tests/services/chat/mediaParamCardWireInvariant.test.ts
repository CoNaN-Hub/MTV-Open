/**
 * **跨层不变量：卡上显示的值 == 实际请求携带的值**（用户 2026-10-15 要求单独立住）。
 *
 * 背景：两端**都**出过问题 ——
 *   · 卡这一端：`prepareApprovalInput` 用硬编码 `1:1` 兜底 ⇒ 用户下达 3:4、卡上却是 `1:1`；
 *   · 请求这一端：`generateImagesBatch` 的解构默认值又把它编回 `imageSize = '2K'` / `aspectRatio = '1:1'`
 *     ⇒ 「卡上不显示、请求却发常量」，同一病根的反方向。
 *
 * 本文件**两端都走真实代码**：
 *   卡：`prepareApprovalInput` → `generationConfirmationContent` → `parseGenerationConfirmationLegacy`
 *       （与 `generationConfirmationChips.test.ts` 同一套真实链路）；
 *   请求：`runMediaGeneration`（`generationRuntime`，图片分支就是最终决议点），把
 *       `./generateImage` 换成一个只**捕获参数**再抛哨兵错误的替身
 *       （不联网、不建节点、不写文件；参数就是真正会进 HTTP 层的那份）。
 *
 * 判据（逐字）= **展示有 ⇒ 请求有且相等；展示无 ⇒ 请求无**。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captured, capturedVideo } = vi.hoisted(() => ({
  captured: [] as Array<Record<string, unknown>>,
  capturedVideo: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../src/services/ai/generateImage', () => ({
  generateImage: vi.fn(async (params: Record<string, unknown>) => {
    captured.push(params);
    /* 哨兵：拿到参数就结束，避免走到节点创建/落盘那一段。 */
    throw new Error('CAPTURED_BEFORE_HTTP');
  }),
}));

vi.mock('../../../src/services/ai/generateVideo', () => ({
  generateVideo: vi.fn(async (params: Record<string, unknown>) => {
    capturedVideo.push(params);
    throw new Error('CAPTURED_BEFORE_HTTP');
  }),
}));

import { runMediaGeneration } from '../../../src/services/ai/generationRuntime';
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
import type { MediaGenerationIntent } from '../../../src/types/media';

const PROJECT_ID = 'project-invariant';
const CONTEXT = {
  taskId: 'task-invariant',
  projectId: PROJECT_ID,
  conversationId: 'conversation-invariant',
  mode: 'collaborative' as const,
};

/** 自接 provider 的图片模型 —— 目录里**查不到** ⇒ 没有「模型目录默认」这一级。 */
const GENERAL_IMAGE_MODEL = {
  id: 'audit-image',
  name: '直连图',
  modelId: 'media-a',
  category: 'image',
  providerConfigId: 'audit',
};

function seedStore(settings: Record<string, unknown>) {
  useAppStore.setState({
    currentProjectId: PROJECT_ID,
    projects: [{ id: PROJECT_ID, name: 'Invariant', createdAt: 1, updatedAt: 1, settings }],
    customStyles: [],
    config: {
      ...useAppStore.getState().config,
      providers: {
        ...useAppStore.getState().config.providers,
        audit: { name: 'Audit', baseUrl: 'https://example.invalid', apiKey: 'test-only-key' },
        /* 视频对照用例要用内置 `apimart/doubao-seedance-2.0`：内置模型的组会被
           「连接是否有 apiKey」过滤掉（`getConfiguredModelGroups`）⇒ 必须给它一个连接。 */
        apimart: { name: 'APIMart', baseUrl: 'https://example.invalid', apiKey: 'test-only-key' },
      },
      generalModels: [GENERAL_IMAGE_MODEL] as never,
    },
  });
}

/** 卡这一端：真实生产者 → 真实官方解析器。 */
function cardOf(input: Record<string, unknown>): GenerationConfirmationSingleViewModel {
  registerMediaAgentTools();
  const prepared = prepareAgentToolCall({ callId: 'inv', toolId: 'media_generate', input }, CONTEXT);
  if (!prepared.ok) throw new Error(`prepare failed: ${prepared.result.summary}`);
  const approval = prepareApprovalInput(prepared.prepared, '生成一张图片', 'collaborative', PROJECT_ID);
  const content = generationConfirmationContent(
    {
      id: 'approval-inv',
      kind: 'media_generation',
      status: 'pending',
      summary: '付费媒体生成和重新生成每次都需要确认',
      requestedAt: 1,
      inputRequest: approval.inputRequest,
    } as AgentApprovalSnapshot,
    { callId: 'inv', toolId: 'media_generate', inputSummary: '生成 1 张图片' } as never,
  ).content;
  if (!content) throw new Error('approval payload missing');
  const viewModel = parseGenerationConfirmationLegacy(content);
  if (!viewModel) throw new Error('official parser rejected the payload');
  return viewModel;
}

/** 请求这一端：真实 `runMediaGeneration`，只把最后一跳换成捕获替身。 */
async function wireOf(intent: MediaGenerationIntent): Promise<Record<string, unknown>> {
  captured.length = 0;
  capturedVideo.length = 0;
  await expect(runMediaGeneration(intent, PROJECT_ID)).rejects.toThrow('CAPTURED_BEFORE_HTTP');
  const list = intent.kind === 'video' ? capturedVideo : captured;
  expect(list).toHaveLength(1);
  return list[0];
}

interface Case {
  title: string;
  settings: Record<string, unknown>;
  input: Record<string, unknown>;
  intent: MediaGenerationIntent;
  /** 卡上**应当**出现的比例/清晰度（undefined = 不该出现）。 */
  expectRatio: string | undefined;
  expectSize: string | undefined;
  /** 视频对照用：请求里 `seedanceResolution` 应当是它。 */
  expectResolution?: string | undefined;
}

const CASES: Case[] = [
  {
    title: '项目无生成设置 + agent 显式 3:4 + 目录外模型 ⇒ 两边都只有 3:4，清晰度两边都没有',
    settings: { defaultModels: { image: `general/${GENERAL_IMAGE_MODEL.id}` } },
    input: { kind: 'image', prompt: '一只小猫', deliveryMode: 'chat', title: '测试标题', aspectRatio: '3:4' },
    intent: { kind: 'image', prompt: '一只小猫', deliveryMode: 'chat', title: '测试标题', modelRef: `general/${GENERAL_IMAGE_MODEL.id}`, aspectRatio: '3:4' },
    expectRatio: '3:4',
    expectSize: undefined,
  },
  {
    title: '完全无来源（项目没设、agent 没给、目录查不到）⇒ 卡上不显示，请求里也不得出现',
    settings: { defaultModels: { image: `general/${GENERAL_IMAGE_MODEL.id}` } },
    input: { kind: 'image', prompt: '一只小猫', deliveryMode: 'chat', title: '测试标题' },
    intent: { kind: 'image', prompt: '一只小猫', deliveryMode: 'chat', title: '测试标题', modelRef: `general/${GENERAL_IMAGE_MODEL.id}` },
    expectRatio: undefined,
    expectSize: undefined,
  },
  {
    title: '项目设置给了 16:9 / 1K ⇒ 卡与请求都是这两个值',
    settings: {
      defaultModels: { image: `general/${GENERAL_IMAGE_MODEL.id}` },
      generation: { imageAspectRatio: '16:9', imageSize: '1K' },
    },
    input: { kind: 'image', prompt: '一只小猫', deliveryMode: 'chat', title: '测试标题' },
    intent: { kind: 'image', prompt: '一只小猫', deliveryMode: 'chat', title: '测试标题', modelRef: `general/${GENERAL_IMAGE_MODEL.id}` },
    expectRatio: '16:9',
    expectSize: '1K',
  },
  {
    title: '显式 9:16 优先于项目设置 16:9（比例两侧都跟显式走；清晰度两侧都跟项目）',
    settings: {
      defaultModels: { image: `general/${GENERAL_IMAGE_MODEL.id}` },
      generation: { imageAspectRatio: '16:9', imageSize: '1K' },
    },
    input: { kind: 'image', prompt: '一只小猫', deliveryMode: 'chat', title: '测试标题', aspectRatio: '9:16' },
    intent: { kind: 'image', prompt: '一只小猫', deliveryMode: 'chat', title: '测试标题', modelRef: `general/${GENERAL_IMAGE_MODEL.id}`, aspectRatio: '9:16' },
    expectRatio: '9:16',
    expectSize: '1K',
  },
  {
    title: '（对照）视频：显式 9:16 + 项目 16:9 ⇒ 卡与请求都是 9:16，避免在别处改坏同源关系',
    settings: {
      defaultModels: { video: 'apimart/doubao-seedance-2.0' },
      generation: { videoAspectRatio: '16:9', videoResolution: '1080p', videoDuration: 5 },
    },
    input: { kind: 'video', prompt: '镜头推进', deliveryMode: 'chat', title: '测试标题', aspectRatio: '9:16' },
    intent: { kind: 'video', prompt: '镜头推进', deliveryMode: 'chat', title: '测试标题', modelRef: 'apimart/doubao-seedance-2.0', aspectRatio: '9:16' },
    expectRatio: '9:16',
    expectSize: undefined,
    /* 视频侧的清晰度字段叫 `resolution`（图片侧才是 `imageSize`）⇒ 单独钉一下。 */
    expectResolution: '1080p',
  },
];

beforeEach(() => {
  captured.length = 0;
  clearAgentToolRegistryForTests();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('跨层不变量：卡上 chip 展示的值 == 实际请求携带的值', () => {
  it.each(CASES)('$title', async ({ settings, input, intent, expectRatio, expectSize, expectResolution }) => {
    seedStore(settings);
    const card = cardOf(input);
    const params = card.params as Record<string, unknown>;

    /* ── 卡这一端 ── */
    if (expectRatio === undefined) {
      expect(card.presentFields).not.toContain('aspectRatio');
      expect(params.aspectRatio).toBeUndefined();
    } else {
      expect(card.presentFields).toContain('aspectRatio');
      expect(params.aspectRatio).toBe(expectRatio);
    }
    if (expectSize === undefined) {
      expect(card.presentFields).not.toContain('imageSize');
      expect(params.imageSize).toBeUndefined();
    } else {
      expect(card.presentFields).toContain('imageSize');
      expect(params.imageSize).toBe(expectSize);
    }

    /* ── 请求这一端（同一份 settings / 同一条 intent）── */
    const wire = await wireOf(intent);
    if (intent.kind === 'video') {
      expect(wire.seedanceRatio).toBe(expectRatio);
      expect(wire.seedanceResolution).toBe(expectResolution);
    } else {
      expect(wire.aspectRatio).toBe(expectRatio);
      expect(wire.imageSize).toBe(expectSize);
    }
    expect(wire.model).toBe(intent.modelRef);
  });

  it('图片这一侧现在**没有**任何 `2K`/`1:1` 常量兜底（源码级，防回退）', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('src/services/ai/generateImage.ts', 'utf8');
    /* 先把注释去掉：本文件头的说明**故意**引用了那条旧代码的形状，不能把注释算成实现。 */
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    /* 原来那一行是 `const { …, imageSize = '2K', aspectRatio = '1:1' } = params;`。 */
    expect(code).not.toMatch(/imageSize\s*=\s*'2K'/);
    expect(code).not.toMatch(/aspectRatio\s*=\s*'1:1'/);
    expect(code).toContain('const imageSize = params.imageSize;');
    expect(code).toContain('const aspectRatio = params.aspectRatio;');
  });

  it('尺寸换算层对「两个值都没有」不抛异常（缺省落在它自己的既有语义上）', async () => {
    const { mapImageDimensions } = await import('../../../src/services/aiDimensions');
    expect(() => mapImageDimensions(undefined, undefined)).not.toThrow();
    expect(mapImageDimensions(undefined, undefined)).toEqual({ width: 1024, height: 1024 });
    expect(mapImageDimensions(undefined, '3:4')).toEqual({ width: 1024, height: 1365 });
  });

  it('协议合同自己声明兜底：土豆异步缺档位用它的常量，GRSAI 缺比例落到 `auto` 且不支持的比例仍报错', async () => {
    const { tudouImageContract } = await import('../../../src/services/models/adapters/tudou');
    const tudou = tudouImageContract({
      providerId: 'tudou', providerModelId: 'gpt-image-2.5-flare-async', baseModelId: 'gpt-image-2.5-flare',
      executionMode: 'async', imageSize: undefined, aspectRatio: undefined,
    });
    expect(tudou).toBeDefined();
    const body = (tudou!.protocol.submit as { body: Record<string, unknown> }).body;
    expect(body.resolution).toBe('2k');
    expect(body.size).toBe('1:1');

    const { grsaiImageContract } = await import('../../../src/services/models/adapters/grsai');
    /* 缺比例 ⇒ 合同自己的协议兜底 `'auto'`（= 未指定，让上游定），**不是**替用户断言 `1:1`。 */
    const noRatio = grsaiImageContract({
      providerId: 'grsai', providerModelId: 'nano-banana-2', baseModelId: 'nano-banana-2',
      executionMode: 'sync', imageSize: '2K', aspectRatio: undefined,
    });
    const noRatioBody = (noRatio!.protocol.submit as { body: Record<string, unknown> }).body;
    expect(noRatioBody.aspectRatio).toBe('auto');
    /* 但用户给了**平台不支持**的比例 ⇒ 必须报错，不许替换成别的比例。 */
    expect(() => grsaiImageContract({
      providerId: 'grsai', providerModelId: 'nano-banana-2', baseModelId: 'nano-banana-2',
      executionMode: 'sync', imageSize: '2K', aspectRatio: '7:4',
    })).toThrow(/不支持比例/);
  });
});
