// @vitest-environment jsdom
/**
 * **媒体生成失败 UI 按官方收口 + MTV 运维提示保留**（覆盖表 §91）。
 *
 * 官方逐字依据（`live-assets-new/vendor-pkg-canvas-CvbAwZyy.js`）：
 * · `媒体生成失败` 在 4 个官方产物里命中数 = **0**（`_findall2.mjs` 实测）⇒ MTV 原来那条
 *   `t('媒体生成失败：{error}')` 是**自造句式**，必须移除。
 * · 官方把生成失败表达成 **tool event 的失败描述**
 *   `chatAdapter.agentEvent.toolDescriptions.<tool>.failed_one`：
 *     `gen_image.failed_one` = 「图片生成失败，本次生成不会消耗积分。」（zh @4295705）
 *     `gen_video.failed_one` = 「视频生成失败，本次生成不会消耗积分。」（zh @4296252）
 *   四语取值：en @3604383 / @3605285，ja @4016639 / @4017190，ko @4157028 / @4157599。
 * · 官方**无** `gen_audio` 失败文案（四语言 `toolDescriptions` 里都没有该键）
 *   ⇒ 音频档用官方通用模板 `fallback.failed_one`（`{{label}} 执行失败。`）+ 官方
 *   `featureTag.audio`（`音频`）合成。**这是 MTV 适配点**，报告里已登记。
 *
 * ⚠️ 另一条硬约束（真金白银）：`mediaError` 同时承载 MTV 特有的异步轮询运维提示
 * （「任务已保留 / 请到平台核对」）。官方没有这套语义，但这些提示**防止用户重复发起已付费的
 * 生成** ⇒ **必须保留**，且**不得**塞进官方那条错误行冒充官方 UI（改走 `c-msg__state--warning`）。
 * 本文件把这四类都锁住。
 *
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import { setLocale } from '../../src/i18n';
import {
  MEDIA_FAILED_AUDIO,
  MEDIA_FAILED_IMAGE,
  MEDIA_FAILED_UNKNOWN,
  MEDIA_FAILED_VIDEO,
  resolveMediaFailureText,
} from '../../src/services/chat/mediaErrorMessage';
import type { MediaGenerationResult } from '../../src/types/media';
import type { ChatMessage } from '../../src/types/chat';

/** MTV 的异步轮询运维提示（`pollManager.ts` @1009 逐字；防重复扣费，**必须保留**）。 */
const RUNNINGHUB_NOTICE = 'RunningHub 提交状态未知，请到平台核对任务，避免重复生成';
/** `pollManager.ts` @1032 逐字。 */
const RUNNINGHUB_RETAINED = 'RunningHub 任务 task-7 已保留，重新打开项目可继续查询';
/** `mediaTools.ts` @572 逐字（供应商未确认远端取消 ⇒ 可能继续计费）。 */
const TRACKING_STOPPED = '已停止本地跟踪；供应商未确认远端取消，任务可能继续并产生费用';

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', conversationId: 'c1', role: 'assistant', content: '', timestamp: 1_000, status: 'done', ...over };
}

function mediaResult(kind: 'image' | 'video' | 'audio'): MediaGenerationResult {
  return {
    id: `media-${kind}`,
    kind,
    deliveryMode: 'chat',
    url: `https://example.invalid/${kind}.bin`,
    modelId: 'test-model',
    provider: 'test',
    createdAt: 1,
  } as MediaGenerationResult;
}

/** 错误行的文字（`c-msg__state--error`）。 */
function errorRowText(container: HTMLElement): string {
  return container.querySelector('.c-msg__state--error')?.textContent ?? '';
}

/** 告警/运维提示行的文字（`c-msg__state--warning`）。 */
function warningRowText(container: HTMLElement): string {
  return container.querySelector('.c-msg__state--warning')?.textContent ?? '';
}

beforeEach(() => setLocale('zh-CN'));
afterEach(() => cleanup());

describe('§91 —— 媒体生成失败走官方 tool-event 文案族', () => {
  it.each([
    ['image', MEDIA_FAILED_IMAGE],
    ['video', MEDIA_FAILED_VIDEO],
    ['audio', MEDIA_FAILED_AUDIO],
  ] as const)('`mediaResult.kind === "%s"` ⇒ 官方句子「%s」', (kind, expected) => {
    const { container } = render(
      <MessageBubble
        message={message({ mediaStatus: 'failed', mediaError: 'upstream 503', mediaResult: mediaResult(kind) })}
      />,
    );
    expect(errorRowText(container)).toContain(expected);
    /* 真回归点：官方没有「媒体生成失败：<原始报错>」这种句式 —— 一个字都不该有。 */
    expect(container.textContent ?? '').not.toContain('媒体生成失败');
    /* 原始报错**不再**拼进这条官方句子（官方不这么拼）。 */
    expect(errorRowText(container)).not.toContain('upstream 503');
  });

  it('拿不到 `mediaResult.kind` ⇒ 官方 `canvas.agent.generationFailed`（「生成失败」）', () => {
    const { container } = render(<MessageBubble message={message({ mediaStatus: 'failed', mediaError: 'boom' })} />);
    expect(errorRowText(container)).toContain(MEDIA_FAILED_UNKNOWN);
    expect(container.textContent ?? '').not.toContain('媒体生成失败');
  });

  it('没有 `mediaError` 时**不**渲染失败行（不再回落 MTV 自造的「未知错误」句子）', () => {
    const { container } = render(
      <MessageBubble message={message({ mediaStatus: 'failed', mediaResult: mediaResult('image') })} />,
    );
    expect(container.querySelector('.c-msg__state--error')).toBeNull();
  });

  it('文案跟随语言（en-US 时等于官方 en 词典原文，说明接的是官方 i18n 键）', () => {
    setLocale('en-US');
    const { container } = render(
      <MessageBubble
        message={message({ mediaStatus: 'failed', mediaError: 'x', mediaResult: mediaResult('image') })}
      />,
    );
    expect(errorRowText(container)).toContain('Failed to generate the image. This generation will not consume credits.');
    setLocale('zh-CN');
  });
});

describe('§91 —— MTV 运维提示（授权偏离）必须保留且不冒充官方 UI', () => {
  it.each([
    ['pollManager 提交状态未知', RUNNINGHUB_NOTICE],
    ['pollManager 任务已保留', RUNNINGHUB_RETAINED],
    ['mediaTools 已停止跟踪（可能继续计费）', TRACKING_STOPPED],
  ])('%s：文案逐字保留，落在告警行而**不是**官方错误行', (_label, notice) => {
    const { container } = render(
      <MessageBubble message={message({ mediaStatus: 'failed', mediaNotice: notice })} />,
    );

    /* ① 文案逐字保留（防重复扣费的信息一个字都不能丢）。 */
    expect(warningRowText(container)).toContain(notice);
    /* ② 官方那条错误行**不出现** —— 运维提示不冒充官方生成失败文案。 */
    expect(container.querySelector('.c-msg__state--error')).toBeNull();
    /* ③ 也不出现已被移除的自造句式。 */
    expect(container.textContent ?? '').not.toContain('媒体生成失败');
  });

  it('`mediaNotice` 只展示一行；`mediaStatus` 仍是 `failed` 也不冒用官方句子', () => {
    const { container } = render(
      <MessageBubble message={message({ mediaStatus: 'failed', mediaNotice: RUNNINGHUB_NOTICE })} />,
    );
    expect(container.querySelectorAll('.c-msg__state--warning')).toHaveLength(1);
    /* 没有 `mediaError` ⇒ 不该出现官方生成失败句子。 */
    expect(container.textContent ?? '').not.toContain(MEDIA_FAILED_IMAGE);
  });
});

describe('§91 —— `resolveMediaFailureText` 纯逻辑', () => {
  const identity = (text: string): string => text;

  it('按 kind 映射官方串；未知 kind 走官方 `generationFailed`', () => {
    expect(resolveMediaFailureText('image', identity)).toBe(MEDIA_FAILED_IMAGE);
    expect(resolveMediaFailureText('video', identity)).toBe(MEDIA_FAILED_VIDEO);
    expect(resolveMediaFailureText('audio', identity)).toBe(MEDIA_FAILED_AUDIO);
    expect(resolveMediaFailureText(undefined, identity)).toBe(MEDIA_FAILED_UNKNOWN);
    expect(resolveMediaFailureText(null, identity)).toBe(MEDIA_FAILED_UNKNOWN);
  });

  it('官方原文逐字（防手改）', () => {
    expect(MEDIA_FAILED_IMAGE).toBe('图片生成失败，本次生成不会消耗积分。');
    expect(MEDIA_FAILED_VIDEO).toBe('视频生成失败，本次生成不会消耗积分。');
  });
});
