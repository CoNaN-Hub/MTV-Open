/**
 * 第 59 轮：生成确认卡带上**真实生成参数**（官方 wire 名）—— 用户「图4 是 MTV、图5/6 是官方，
 * 你不是讲 1:1 吗」的直接兑现。
 *
 * 官方读侧（`generationConfirmationProtocol.ts` 的 `Sse` @2214xxx，逐字）：
 * ```
 * carrier.prompt
 * carrier.image.{aspect_ratio,image_size,quality,times}      // kind=image
 * carrier.video.{mode,aspect_ratio,duration,resolution,…}    // kind=video
 * ```
 * MTV 此前的 `generationConfirmationContent` 只写 `{kind,request_kind}` ⇒ 卡片比官方少一整块
 * （没有提示词、没有参数 chip）。现在 `media_model` 审批带上 `generationRequest`
 * （值全部来自 `media_generate` 工具入参）⇒ 读侧能解析出真实参数。
 *
 * 验证分级 = **(b) 真解析器 + (d) 源码级**。
 */
import { describe, expect, it } from 'vitest';
import {
  generationConfirmationContent,
} from '../../../src/services/chat/agentApprovalContents';
import {
  parseGenerationConfirmationLegacy,
  parseGenerationConfirmationV1,
} from '../../../src/services/chat/generationConfirmationProtocol';
import type { AgentApprovalSnapshot } from '../../../src/types/agent';

function approvalWith(generationRequest?: {
  kind: 'image' | 'video' | 'audio';
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  resolution?: string;
  duration?: number;
  times?: number;
}): AgentApprovalSnapshot {
  return {
    id: 'approval-1',
    kind: 'media_generation',
    status: 'pending',
    summary: '付费媒体生成和重新生成每次都需要确认',
    requestedAt: 1,
    inputRequest: {
      kind: 'media_model',
      mediaKind: generationRequest?.kind ?? 'image',
      ...(generationRequest ? { generationRequest } : {}),
    },
  } as AgentApprovalSnapshot;
}

const TOOL_CALL = {
  callId: 'call-1',
  toolId: 'media_generate',
  inputSummary: '生成 1 张图片',
} as never;

describe('生成确认卡：真实参数生产者', () => {
  it('图片：prompt + aspect_ratio + times 写进官方 `request_json.image`，读侧解析出来', () => {
    const result = generationConfirmationContent(
      approvalWith({ kind: 'image', prompt: '一只可爱的小猫，蓬松柔软的毛发', aspectRatio: '3:4', times: 1 }),
      TOOL_CALL,
    );
    const request = (result.content as { request?: Record<string, unknown> })!.request!;
    const requestJson = request.request_json as Record<string, unknown>;
    expect(requestJson.prompt).toBe('一只可爱的小猫，蓬松柔软的毛发');
    expect(requestJson.image).toMatchObject({ aspect_ratio: '3:4', times: 1 });
    /* 官方读侧（v1 批量解析器）能解析出这条载体。 */
    /* 单条请求走官方**单卡**（legacy）解析器；v1 批量解析器应为 null。 */
    expect(parseGenerationConfirmationV1(result.content)).toBeNull();
    const viewModel = parseGenerationConfirmationLegacy(result.content);
    expect(viewModel).not.toBeNull();
    expect(JSON.stringify(viewModel)).toContain('一只可爱的小猫');
  });

  it('视频：aspect_ratio + resolution + duration 写进 `request_json.video`', () => {
    const result = generationConfirmationContent(
      approvalWith({
        kind: 'video', prompt: '镜头缓缓推近', aspectRatio: '16:9', resolution: '1080p', duration: 5,
      }),
      TOOL_CALL,
    );
    const request = (result.content as { request?: Record<string, unknown> })!.request!;
    expect((request.request_json as Record<string, unknown>).video).toMatchObject({ aspect_ratio: '16:9', resolution: '1080p', duration: 5 });
  });

  it('没有 generationRequest 时**不写**参数（不补默认值），并继续声明缺哪些字段', () => {
    const result = generationConfirmationContent(approvalWith(), TOOL_CALL);
    const request = (result.content as { request?: Record<string, unknown> })!.request!;
    expect((request.request_json as Record<string, unknown>).prompt).toBeUndefined();
    expect((request.request_json as Record<string, unknown>).image).toBeUndefined();
    expect(result.missingMtvFields).toContain('request.request_json.prompt');
  });

  it('有真实参数时把对应字段从 missingMtvFields 里去掉（不再谎报缺字段）', () => {
    const result = generationConfirmationContent(
      approvalWith({ kind: 'image', prompt: '小猫', aspectRatio: '3:4', times: 1 }),
      TOOL_CALL,
    );
    expect(result.missingMtvFields).not.toContain('request.request_json.prompt');
    expect(result.missingMtvFields).not.toContain('request.request_json.aspect_ratio');
  });

  it('源码级：`prepareApprovalInput` 从 `media_generate` 入参造载荷（真实值，缺字段不写）', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(process.cwd(), 'src/services/chat/agentRoundExecutor.ts'), 'utf8');
    expect(source).toContain('generationRequest');
    expect(source).toContain("typeof input.aspectRatio === 'string'");
    expect(source).toContain("typeof input.resolution === 'string'");
    expect(source).toContain('times: 1');
  });
});
