// @vitest-environment jsdom
/**
 * 第 79 轮：两个缺口的**真渲染**验证（jsdom + @testing-library/react）。
 *
 * 上游 `tests/services/chat/generationConfirmationMentionReselect.test.ts` 已证明
 * 生产者把值写进了官方载体；这里再证明**同一份载荷经真实卡片**会/不会渲染出对应 chip
 * （官方 `Zse` @2301507 的 `show*Chip` 门 + 读侧 `WV` @2265358 的 `presentFields`）。
 *
 * 覆盖：
 *   · 缺口 A：用了 `@model{...}` ⇒ 卡片上模型/比例/清晰度/张数四颗 chip **都在**；
 *   · 缺口 B：卡上选 `general` 直连 ⇒ 视频的项目默认值 chip **不渲染**；
 *             卡上选内置模型 ⇒ 项目默认值 chip **渲染出来**。
 *
 * 官方出处：`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`
 *  · `WV` @2265358（旧 `Sse`）载体 → params；`Ott` @2262372（旧 `gJe`）modifications 叠加；
 *  · `Zse` @2301507（`ImageVideoChipRow`）、`hnt`/`Jnt` @2312154 的 `show*Chip` 可见性门。
 *
 * 验证分级 = **(b) jsdom 真渲染**。
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GenerationConfirmationCard } from '../../src/components/chat/GenerationConfirmationCard';
import { prepareApprovalInput, resolveApprovalSelection } from '../../src/services/chat/agentRoundExecutor';
import { prepareAgentToolCall, clearAgentToolRegistryForTests } from '../../src/services/chat/toolRegistry';
import { registerMediaAgentTools } from '../../src/services/chat/tools/mediaTools';
import { generationConfirmationContent } from '../../src/services/chat/agentApprovalContents';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { AgentApprovalInputRequest, AgentApprovalSnapshot } from '../../src/types/agent';

const CONTEXT = {
  taskId: 'task-79-dom',
  projectId: 'project-79-dom',
  conversationId: 'conversation-79-dom',
  mode: 'collaborative' as const,
};

afterEach(cleanup);

beforeEach(() => {
  clearAgentToolRegistryForTests();
  useAppStore.setState(useAppStore.getInitialState(), true);
  setLocale('zh-CN');
});

function seedStore(settings: Record<string, unknown>, generalModels: unknown[] = []) {
  useAppStore.setState({
    currentProjectId: 'project-79-dom',
    projects: [{
      id: 'project-79-dom',
      name: 'Reselect DOM',
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

/** 审批载荷 → **真实卡片**（不是中间对象）。 */
function renderApproval(inputRequest: AgentApprovalInputRequest | undefined) {
  const content = generationConfirmationContent(
    {
      id: 'approval-79-dom',
      kind: 'media_generation',
      status: 'pending',
      summary: '付费媒体生成和重新生成每次都需要确认',
      requestedAt: 1,
      inputRequest,
    } as AgentApprovalSnapshot,
    { callId: 'call-79-dom', toolId: 'media_generate', inputSummary: '生成 1 个媒体产物' } as never,
  ).content;
  if (!content) throw new Error('producer returned no content');
  render(<GenerationConfirmationCard content={content as unknown as Record<string, unknown>} />);
}

function prepareMedia(input: Record<string, unknown>) {
  registerMediaAgentTools();
  const call = { callId: 'call-79-dom', toolId: 'media_generate', input };
  const prepared = prepareAgentToolCall(call, CONTEXT);
  if (!prepared.ok) throw new Error(`media preparation failed: ${prepared.result.summary}`);
  return { call, prepared: prepared.prepared };
}

describe('缺口 A：`@model{...}` 提及 ⇒ 官方生成确认卡照常渲染出四颗 chip', () => {
  it('`@model` 用法下卡片有提示词 + 模型 chip + 比例 + 清晰度 + `1×`', () => {
    seedStore(
      { generation: { imageAspectRatio: '3:4', imageSize: '1K' } },
      [{ id: 'audit-image', name: '画图', modelId: 'media-a', category: 'image', providerConfigId: 'audit' }],
    );
    const { prepared } = prepareMedia({ kind: 'image', prompt: '一只可爱的小猫', deliveryMode: 'chat' });
    const approval = prepareApprovalInput(
      prepared,
      '生成一张图片 @model{general/audit-image|画图}',
      'collaborative',
      'project-79-dom',
    );

    renderApproval(approval.inputRequest);

    expect(screen.getByText('一只可爱的小猫')).toBeTruthy();
    /* 模型 chip = 提及的模型（旧代码这条分支连载荷都没有 ⇒ 这颗 chip 不存在）。
       ★ round 121：chip 印**展示名**，不印 `general/audit-image` 这种内部调用引用
       —— 本例 store 里播了该连接（`audit-image` ⇒ 上游 `media-a`）⇒ 展示名 = `media-a`
       （与 `services/models/display` 同源；**不用用户起的名字**，见 `tests/models/display.test.ts`）。 */
    expect(screen.getByText('media-a')).toBeTruthy();
    expect(screen.queryByText('general/audit-image')).toBeNull();
    expect(screen.getByText('3:4')).toBeTruthy();
    expect(screen.getByText('1K')).toBeTruthy();
    expect(screen.getByText('1×')).toBeTruthy();
  });
});

describe('缺口 B：卡上选完模型 ⇒ 卡片渲染出的值与最终会发的一致', () => {
  const VIDEO_SETTINGS = {
    generation: { videoAspectRatio: '16:9', videoResolution: '1080p', videoDuration: 5 },
  };

  it('选 `general` 直连 ⇒ 视频项目默认值**不渲染**任何 chip', () => {
    seedStore(VIDEO_SETTINGS, [
      { id: 'audit-video', name: '直连', modelId: 'media-v', category: 'video', providerConfigId: 'audit' },
    ]);
    const { call, prepared } = prepareMedia({ kind: 'video', prompt: '镜头推近', deliveryMode: 'chat' });
    const approval = prepareApprovalInput(prepared, '生成视频', 'collaborative', 'project-79-dom');

    /* 审批那一刻确实写着项目默认值（缺口来源）—— 先确认旧载荷会渲染这三颗。
       分辨率在卡上按官方映射渲染成大写 `1080P`（resolution chip）。 */
    renderApproval(approval.inputRequest);
    expect(screen.getByText('16:9')).toBeTruthy();
    expect(screen.getByText('1080P')).toBeTruthy();
    cleanup();

    const selected = resolveApprovalSelection(
      call,
      approval.prepared,
      approval.inputRequest,
      { approved: true, inputValues: { modelRef: 'general/audit-video' } },
      CONTEXT,
    );
    expect(selected.error).toBeUndefined();
    renderApproval(selected.inputRequest);

    expect(screen.getByText('media-v')).toBeTruthy();
    expect(screen.queryByText('general/audit-video')).toBeNull();
    expect(screen.queryByText('16:9')).toBeNull();
    expect(screen.queryByText('1080P')).toBeNull();
    expect(screen.queryByText('1080p')).toBeNull();
  });

  it('选内置模型（非直连）⇒ 项目默认值**渲染出来**', () => {
    seedStore(
      { ...VIDEO_SETTINGS, defaultModels: { video: 'general/audit-video' } },
      [{ id: 'audit-video', name: '直连', modelId: 'media-v', category: 'video', providerConfigId: 'audit' }],
    );
    const { call, prepared } = prepareMedia({ kind: 'video', prompt: '镜头推近', deliveryMode: 'chat' });
    const approval = prepareApprovalInput(prepared, '生成视频', 'collaborative', 'project-79-dom');

    /* 审批那一刻是 `general` 直连 ⇒ 这三颗都不在。 */
    renderApproval(approval.inputRequest);
    expect(screen.queryByText('16:9')).toBeNull();
    expect(screen.queryByText('1080P')).toBeNull();
    cleanup();

    const selected = resolveApprovalSelection(
      call,
      approval.prepared,
      approval.inputRequest,
      { approved: true, inputValues: { modelRef: 'apimart/doubao-seedance-2.0' } },
      CONTEXT,
    );
    expect(selected.error).toBeUndefined();
    renderApproval(selected.inputRequest);

    /* ★ 2026-10-15 口径变更：`apimart` 表按官方 apimart 清单重建后，`doubao-seedance-2.0`
       不在清单里 ⇒ 降级为 unverified 登记行，展示名回落到**原始平台 id** `doubao-seedance-2.0`
       （`豆包视频 2.0` 那类 MTV 策划名已按裁决作废）。
       本用例真正钉的是：chip 显示的是**平台 id**，不是内部的 `provider/id` 引用。 */
    expect(screen.getByText('doubao-seedance-2.0')).toBeTruthy();
    expect(screen.queryByText('apimart/doubao-seedance-2.0')).toBeNull();
    expect(screen.getByText('16:9')).toBeTruthy();
    expect(screen.getByText('1080P')).toBeTruthy();
  });

  it('图片：**无来源**时比例/清晰度 chip 不渲染（第 65 轮的 `1:1`/`2K` 硬兜底已被 round 122 推翻）', () => {
    seedStore({}, [
      { id: 'audit-image', name: '直连图', modelId: 'media-a', category: 'image', providerConfigId: 'audit' },
    ]);
    const { call, prepared } = prepareMedia({ kind: 'image', prompt: '一只猫', deliveryMode: 'chat' });
    const approval = prepareApprovalInput(prepared, '生成图片', 'collaborative', 'project-79-dom');
    const selected = resolveApprovalSelection(
      call,
      approval.prepared,
      approval.inputRequest,
      { approved: true, inputValues: { modelRef: 'general/audit-image' } },
      CONTEXT,
    );
    expect(selected.error).toBeUndefined();
    renderApproval(selected.inputRequest);
    /**
     * **用户 2026-10-15 裁决（round 122）**：`aspectRatio` / `imageSize` 同一条链
     * `显式 > 项目设置 > 模型目录 defaults > 不填`。本用例模型是自接 `media-a`（目录外）+ 项目无生成设置
     * ⇒ 无来源 ⇒ **卡片连 chip 都不渲染**（`presentFields` 里没有这两项）。
     * 官方 `Eoe` 的比例组 gate `M = b && _ && _.length > 0 && v` 要求当前值已定义 ⇒ 官方不伪造；
     * 旧断言里的 `1:1` / `2K` 是 MTV 硬编码常量（对 `nano-banana-flash-lite` 这类模型是**不支持的值**）。
     */
    expect(screen.queryByText('1:1')).toBeNull();
    expect(screen.queryByText('2K')).toBeNull();
  });
});
