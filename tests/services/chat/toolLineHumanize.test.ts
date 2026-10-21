/**
 * 工具行文案：MTV 自有工具名不能直接甩给用户。
 *
 * 用户实测：生成中状态下对话里出现一行 `media_generate`（「这是干嘛的 官方是这样的吗？」）。
 * 官方 bundle `media_generate` **0 命中**（官方对应 `gen_image` / `gen_video`，
 * 文案「生成图片 / 生成视频」，见 `toolLabels.ts` 的官方表）⇒ 这是 MTV 自有工具名泄漏。
 */
import { describe, expect, it } from 'vitest';
import { humanizeToolLineText } from '../../../src/services/chat/agentToolLabels';

describe('humanizeToolLineText（MTV 自有工具名 → 人话）', () => {
  it('media_generate 进行中 / 已完成', () => {
    expect(humanizeToolLineText('media_generate', true)).toBe('正在生成媒体内容');
    expect(humanizeToolLineText('media_generate', false)).toBe('已生成媒体内容');
  });

  it('其它 MTV 媒体工具也不露 snake_case', () => {
    expect(humanizeToolLineText('media_model_parameters', false)).toBe('已读取模型参数');
    expect(humanizeToolLineText('media_workflow_parameters', true)).toBe('正在读取工作流参数');
  });

  it('非工具名的正常文案原样返回（不误伤官方文案）', () => {
    expect(humanizeToolLineText('生成图片', true)).toBe('生成图片');
    expect(humanizeToolLineText('Working on an action', false)).toBe('Working on an action');
  });
});
