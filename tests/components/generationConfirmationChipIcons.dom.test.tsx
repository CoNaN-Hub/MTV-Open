// @vitest-environment jsdom
/**
 * round 111：生成确认卡的 **chip 图标** 与 **确认上行通道** 回归。
 *
 * 用户连续两次实测报的两条：
 *   ① 「图标完全不对」—— 卡片底部三颗 chip（比例 / 清晰度 / 张数）的 leadingIcon 不是官方那套；
 *   ② 「指令下了也没有确认啥的 没后续了」—— 点「确认」没有任何上行/后续。
 *
 * 官方依据（dump 目录 `D:\DEEPSEEK\live-assets-r100\`）：
 *  · 卡头 `O0`：`vendor-pkg-canvas-DuoOicPr.js` @2225601 `s.jsx(ao,{size:12,…})`（图片生成）
 *  · chip 行 `xie`：同文件 @2333517 `Ppe`（生成方式）/ @2333838 `CR`（比例）/ @2334258…@2336014 `tw`
 *    （清晰度）/ @2336527 `_x`（张数）；分隔符是**元素** `<div class="h-4 w-px bg-white/10">`
 *  · `transform` = `vendor-libs-D64ouk08.js` 常量 `pxi` @3091344（工厂 @3091616，导出 `Rxn as kL` @8938779）
 *  · `aspect-ratio` = 同文件 常量 `H4r` @1623658（工厂 @1623871，导出 `ryt as hj` @8937131）
 *  · `badge-hd` = 同文件 常量 `Smr` @1638943
 *  · `copy` = 同文件 常量 `$Pr` @2087784（工厂 @2088101，导出 `HBt as dl` @8934607）
 *  · 确认卡上行：`vendor-pkg-canvas-DuoOicPr.js` @2458469
 *    `if (Eg(e)) return s.jsx(pot, { content: e.content, onAnswer: l, generationFailedMap: h });`
 *
 * 验证分级 = **(b) jsdom 真 DOM**（(a) live CDP 见覆盖表，官方卡片当场不可达）。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationConfirmationCard } from '../../src/components/chat/GenerationConfirmationCard';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { confirmationAnswerResolution, confirmationStoreSliceOf } from '../../src/components/chat/confirmationEventDispatch';
import type { AgentTaskControls } from '../../src/components/chat/AgentTaskTimeline';
import { generationConfirmationContent } from '../../src/services/chat/agentApprovalContents';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { AgentApprovalSnapshot, AgentGenerationRequestSnapshot, AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';

/** 官方 `transform`（`live-assets-r100/vendor-libs-D64ouk08.js` 常量 `pxi` @3091344）。 */
const OFFICIAL_TRANSFORM_PATHS = [
  'M3 6a3 3 0 1 0 6 0a3 3 0 0 0 -6 0',
  'M21 11v-3a2 2 0 0 0 -2 -2h-6l3 3m0 -6l-3 3',
  'M3 13v3a2 2 0 0 0 2 2h6l-3 -3m0 6l3 -3',
  'M15 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0',
];
/** 官方 `aspect-ratio`（同文件常量 `H4r` @1623658）。 */
const OFFICIAL_ASPECT_RATIO_PATHS = [
  'M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z',
  'M7 12v-3h3',
  'M17 12v3h-3',
];
/** 官方 `badge-hd`（同文件常量 `Smr` @1638943）。 */
const OFFICIAL_BADGE_HD_PATHS = [
  'M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z',
  'M14 9v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1z',
  'M7 15v-6',
  'M10 15v-6',
  'M7 12h3',
];
/** 官方 `copy`（同文件常量 `$Pr` @2087784）。 */
const OFFICIAL_COPY_PATHS = [
  'M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z',
  'M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1',
];

function pathsOf(svg: Element | null): string[] {
  if (!svg) return [];
  return [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d') ?? '');
}

function contentOf(generationRequest?: AgentGenerationRequestSnapshot) {
  const approval = {
    id: 'approval-111',
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

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  setLocale('zh-CN');
});

afterEach(cleanup);

describe('生成确认卡 chip 图标 = 官方资产（逐条 path 钉死）', () => {
  it('三颗 chip 的 leadingIcon 分别是 `aspect-ratio` / `badge-hd` / `copy`，path 与 r100 逐字相同', () => {
    const { container } = render(<GenerationConfirmationCard content={contentOf({
      kind: 'image',
      prompt: '一只可爱的小猫',
      modelName: 'general/audit-image',
      aspectRatio: '1:1',
      imageSize: '2K',
      times: 1,
    })} />);

    const ratio = container.querySelector('svg.tabler-icon-aspect-ratio');
    const size = container.querySelector('svg.tabler-icon-badge-hd');
    const times = container.querySelector('svg.tabler-icon-copy');

    expect(ratio).not.toBeNull();
    expect(size).not.toBeNull();
    expect(times).not.toBeNull();

    /* 官方三处都是 `<X size={14} className="text-white/56" />`。 */
    for (const svg of [ratio, size, times]) {
      expect(svg!.getAttribute('width')).toBe('14');
      expect(svg!.getAttribute('height')).toBe('14');
      expect(svg!.getAttribute('class')).toContain('text-white/56');
    }

    expect(pathsOf(ratio)).toEqual(OFFICIAL_ASPECT_RATIO_PATHS);
    expect(pathsOf(size)).toEqual(OFFICIAL_BADGE_HD_PATHS);
    expect(pathsOf(times)).toEqual(OFFICIAL_COPY_PATHS);

    /* 回归钉子：**不能再**出现被抄错相邻常量的那两支（`assembly-off` / `transition-bottom`）。 */
    const all = [...container.querySelectorAll('svg path')].map((p) => p.getAttribute('d') ?? '');
    expect(all.some((d) => d.includes('M18.376 18.377'))).toBe(false);
    expect(all.some((d) => d.includes('M21 18a3 3 0 0 1 -3 3h-12'))).toBe(false);
  });

  it('chip 之间的分隔符是**元素** `<div class="h-4 w-px bg-white/10">`，不是文本 `｜`', () => {
    const { container } = render(<GenerationConfirmationCard content={contentOf({
      kind: 'image',
      prompt: '一只猫',
      modelName: 'general/audit-image',
      aspectRatio: '1:1',
      imageSize: '2K',
      times: 1,
    })} />);
    const seps = container.querySelectorAll('div.h-4.w-px');
    expect(seps.length).toBeGreaterThanOrEqual(3);
    for (const sep of seps) expect(sep.getAttribute('class')).toBe('h-4 w-px bg-white/10');
    expect(container.textContent).not.toContain('｜');
  });

  it('生成方式 chip（方法）用官方 `transform`，不是 `transition-bottom`', () => {
    const { container } = render(<GenerationConfirmationCard content={contentOf({
      kind: 'video',
      prompt: '一只猫在跑',
      modelName: 'general/audit-video',
      aspectRatio: '16:9',
      resolution: '1080p',
      duration: 5,
    })} />);
    const transform = container.querySelector('svg.tabler-icon-transform');
    /* 生成方式 chip 只在 `!isImage && currentMethod` 时出现；出现时必须逐字等于官方 `transform`。 */
    if (transform) expect(pathsOf(transform)).toEqual(OFFICIAL_TRANSFORM_PATHS);
    const all = [...container.querySelectorAll('svg path')].map((p) => p.getAttribute('d') ?? '');
    expect(all.some((d) => d.includes('M21 18a3 3 0 0 1 -3 3h-12'))).toBe(false);
  });
});

describe('confirmationAnswerResolution —— 官方三参回参 → MTV `AgentApprovalResolution`', () => {
  const content = contentOf({ kind: 'image', prompt: 'x', modelName: 'general/audit-image', times: 1 });

  it('reject ⇒ `{approved:false}`', () => {
    expect(confirmationAnswerResolution('reject', undefined, content)).toEqual({ approved: false });
  });

  it('confirm 且用户改过模型 ⇒ `modelRef` 取 `modifications.model_name`', () => {
    expect(confirmationAnswerResolution('confirm', { model_name: 'general/edited-model' }, content))
      .toEqual({ approved: true, inputValues: { modelRef: 'general/edited-model' } });
  });

  it('confirm 且未改模型 ⇒ 回落卡片载荷 `request_json.model_name`（真实值，不编默认）', () => {
    expect(confirmationAnswerResolution('confirm', { prompt: 'x' }, content))
      .toEqual({ approved: true, inputValues: { modelRef: 'general/audit-image' } });
  });

  it('两处都没有模型 ⇒ 只批准、不带 `inputValues`（由下游 `media_model` gate 给出拒绝理由）', () => {
    expect(confirmationAnswerResolution('confirm', undefined, {} as Record<string, unknown>))
      .toEqual({ approved: true });
  });
});

describe('round 116：载荷没有 `model_name` ⇒ 卡片给出模型选择器（用户现场：模型 chip 不显示 + Subscription required 挡住确认）', () => {
  /** 与真机 `agentTasks` 同形：`generationRequest` 里只有 `prompt`/`times`，**没有 `modelName`**。 */
  const unassigned = () => contentOf({
    kind: 'image',
    prompt: '一只可爱的幼猫，圆润蓬松的外形',
    times: 1,
  });

  it('模型 chip 渲染出来（占位文案来自官方兜底键 `chatAdapter.modelOptions.model`），且「确认」存在', () => {
    const content = unassigned();
    render(<GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />);
    /* 模型 chip：`inline-flex … text-white/88` 那颗，文本 = 官方占位 `Model`。 */
    const chips = [...document.querySelectorAll('span,button')].filter((el) => (
      /inline-flex items-center gap-1\.5 rounded-lg px-2 py-1\.5 text-xs font-medium leading-5 text-white\/88/.test(
        String(el.className),
      )
    ));
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.some((el) => (el.textContent || '').includes('Model'))).toBe(true);
    /* 「确认」在，且因为还没选模型而禁用（下游 `resolveApprovalSelection` 要求 `modelRef`）。 */
    const confirm = screen.getByText('确认').closest('button') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('★ round 129：目录里**显式** `isFree:false` 的模型（官方付费档）⇒ MTV 默认（付费态未知）**不再**凭空空一个 `Subscription required`', () => {
    /* ⚠️ 本条**改的是旧断言**（原来期望 `disabled === true`「官方口径未放宽」）——
       那条旧断言把 **MTV 自己** 的用法当成了官方口径，钉错了。依据：
       · 官方逐字（r127 `vendor-pkg-canvas-Dp0xADoD.js` @2324104）：
         `{isPayingCustomer:G,loading:$}=hl(), q=i||G===!0, X=!i&&($||G===null)`；
         @2325285：`Ft=!Fg(e,qt,q)`；@2327092（确认门）：
         `const xe=H||!!O&&Fg(e,O,q)&&YF(e,O,ie) … : f("video.modelRestricted",{defaultValue:"Subscription required"})`。
         ⇒ 官方判受限 **必须** `!isPayingCustomer`；`isFree` 只是它与付费态**成对**使用的另一半。
       · 用户现场（2026-10-15）：自定义厂商（土豆 `api.ai-tudou.net`，用户所在分组 `vip-9折`），
         上游 `/api/pricing` 里对应模型 `enable_groups` **允许**该分组 ⇒ 上游没有拒绝；
         MTV 却用自己目录里的 `isFree` 单方面判「受限」⇒ 卡片上出现假的 `Subscription required`。
       · 纪律：`services/ai/modelParamCatalog.ts` 的「官方有、MTV 无数据源 ⇒ 不阻断」。
       ⇒ 新口径：MTV 默认（付费态未知）**放行**；宿主明确 `isPayingCustomer:false` 时才回到官方非付费分支
       （反例逐字钉在 `generationChipController.test.tsx` / `audioModelCatalog.test.tsx`）。 */
    const content = contentOf({ kind: 'image', prompt: '一只猫', modelName: 'midjourney-v7', times: 1 });
    render(<GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />);
    const confirm = screen.getByText('确认').closest('button') as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    expect(document.body.textContent).not.toContain('Subscription required');
  });
});

describe('MessageBubble → 确认卡「确认」真的上行（用户「没后续」的那一环）', () => {
  function message(): ChatMessage {
    return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000, status: 'complete' };
  }

  function task(): AgentTask {
    const step: AgentStep = {
      id: 'a1',
      taskId: 'task-1',
      index: 0,
      kind: 'approval',
      title: '等待确认',
      status: 'running',
      createdAt: 1_000,
      updatedAt: 2_000,
      approval: {
        id: 'ap-111',
        kind: 'media_generation',
        status: 'pending',
        summary: '付费媒体生成和重新生成每次都需要确认',
        requestedAt: 1_000,
        inputRequest: {
          kind: 'media_model',
          mediaKind: 'image',
          generationRequest: { kind: 'image', prompt: '一只猫', modelName: 'general/audit-image', times: 1 },
        },
      },
      toolCall: { callId: 'call-1', toolId: 'media_generate', retryCount: 0, startedAt: 1_000 },
    };
    return { id: 'task-1', goal: '测试', status: 'completed', steps: [step], createdAt: 1, updatedAt: 2 } as AgentTask;
  }

  it('点「确认」⇒ 调 `agentControls.onResolveApproval(confirmationId, {approved:true, inputValues:{modelRef}})`', () => {
    const onResolveApproval = vi.fn();
    const controls = {
      onResolveApproval,
      mediaModelOptions: [],
      mediaModelAvailability: {},
      onStop: () => {},
    } as unknown as AgentTaskControls;

    render(<MessageBubble message={message()} agentTask={task()} agentControls={controls} />);
    const confirm = screen.getByText('确认');
    fireEvent.click(confirm);
    expect(onResolveApproval).toHaveBeenCalledTimes(1);
    expect(onResolveApproval).toHaveBeenCalledWith('ap-111', {
      approved: true,
      inputValues: { modelRef: 'general/audit-image' },
    });
  });

  it('点「取消」⇒ `onResolveApproval(confirmationId, {approved:false})`', () => {
    const onResolveApproval = vi.fn();
    const controls = {
      onResolveApproval,
      mediaModelOptions: [],
      mediaModelAvailability: {},
      onStop: () => {},
    } as unknown as AgentTaskControls;

    render(<MessageBubble message={message()} agentTask={task()} agentControls={controls} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onResolveApproval).toHaveBeenCalledWith('ap-111', { approved: false });
  });
});
