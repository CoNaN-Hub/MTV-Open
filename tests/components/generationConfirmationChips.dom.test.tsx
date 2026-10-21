// @vitest-environment jsdom
/**
 * 第 74 轮：官方生成确认卡的四颗 chip **真的渲染出来了吗**（jsdom + @testing-library/react）。
 *
 * 上游 `tests/services/chat/generationConfirmationChips.test.ts` 已经证明生产者把
 * `model_name` / `aspect_ratio` / `image_size` / `times` 写进了官方载体；
 * 这里再证明**同一份载荷经真实卡片**会渲染出对应 chip（官方 `Zse` @2301507 的 `show*Chip` 门）。
 *
 * 官方出处：`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`
 *  · `Zse` @2301507（`ImageVideoChipRow`）、`hie` @2327822（chip controller）、
 *    `Jnt` @2312154（`aspectRatioState.visible`）、`Sse` @2221593（载体 → params）。
 *
 * 验证分级 = **(b) jsdom**。
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GenerationConfirmationCard } from '../../src/components/chat/GenerationConfirmationCard';
import { generationConfirmationContent } from '../../src/services/chat/agentApprovalContents';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { AgentApprovalSnapshot, AgentGenerationRequestSnapshot } from '../../src/types/agent';

afterEach(cleanup);

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  setLocale('zh-CN');
});

function contentOf(generationRequest?: AgentGenerationRequestSnapshot) {
  const approval = {
    id: 'approval-74',
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
  const content = generationConfirmationContent(approval, undefined).content;
  if (!content) throw new Error('producer returned no content');
  return content as unknown as Record<string, unknown>;
}

describe('生成确认卡：四颗 chip 的渲染门', () => {
  it('载荷带模型/比例/清晰度/张数 ⇒ 四颗 chip 全部渲染（= 官方图 2）', () => {
    render(<GenerationConfirmationCard content={contentOf({
      kind: 'image',
      prompt: '一只可爱的小猫，蓬松柔软的毛发',
      modelName: 'general/audit-image',
      aspectRatio: '3:4',
      imageSize: '1K',
      times: 1,
    })} />);
    expect(screen.getByText('一只可爱的小猫，蓬松柔软的毛发')).toBeTruthy();
    /* ★ round 121：模型 chip 印**展示名**，不再印内部调用引用。
       载荷 `model_name = "general/audit-image"`（自定义连接引用）⇒ 过展示名出口
       （`services/models/display`）；本例 store 里**没有**该连接配置（`beforeEach` 已 reset），
       解析不出上游名 ⇒ 兜底 = 剥掉 `general/` 前缀（任何分支都不得吐内部前缀）。
       本仓禁止把调用引用印给用户：`components/ProjectSettingsPopover.tsx:644`。 */
    expect(screen.getByText('audit-image')).toBeTruthy();
    expect(screen.queryByText('general/audit-image')).toBeNull();
    expect(screen.getByText('3:4')).toBeTruthy();
    expect(screen.getByText('1K')).toBeTruthy();
    expect(screen.getByText('1×')).toBeTruthy();
  });

  it('载荷只有 prompt + times ⇒ 只剩 `1×`（= 用户图 1 的现象）', () => {
    render(<GenerationConfirmationCard content={contentOf({
      kind: 'image',
      prompt: '一只可爱的小猫，蓬松柔软的毛发',
      times: 1,
    })} />);
    expect(screen.getByText('1×')).toBeTruthy();
    expect(screen.queryByText('3:4')).toBeNull();
    expect(screen.queryByText('1K')).toBeNull();
    /* 没有任何模型 chip（官方 `showModelChip = activeFields.has("model") && !!editedModel`）。 */
    expect(screen.queryByText('Unknown')).toBeNull();
    expect(screen.queryByText('general/audit-image')).toBeNull();
  });

  it('`image_size: "0.5K"` 渲染成 `512P`（官方 `d === "0.5K" ? "512P" : d`，逐字）', () => {
    render(<GenerationConfirmationCard content={contentOf({
      kind: 'image',
      prompt: '一只猫',
      imageSize: '0.5K',
      times: 1,
    })} />);
    expect(screen.getByText('512P')).toBeTruthy();
    expect(screen.queryByText('0.5K')).toBeNull();
  });
});
