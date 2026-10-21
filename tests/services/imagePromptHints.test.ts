/**
 * 出站提示词组装 —— 用户 2026 的线上问题回归：
 *
 *   「批量生成时 一样的模型 一样的参考图 一样的提示词，但是官方的生成结果 效果更好，
 *     MTV 生图结果相比官方就差很多」
 *
 * 根因：**我们发出去的提示词和官方不是同一段文本**。
 *   官方 = 用户原话直发（只带用户自己打的 `参考{{Image 1}}`）；
 *   MTV  = 「【参考图输入】…以参考图为基图…不要重新构思画面」+ 用户原话 + 「【输出画幅】…」。
 *
 * 那段样板是「参考图完全不生效」那轮打的补丁（而它从没让参考图生效过 —— 真正生效的是换端点/换字段），
 * 却把「重新构图」的请求按住不动 ⇒ 实测出图几乎跟参考图一样。
 *
 * 用户 2026 追加：「我接入的是自定义 api 厂商，未来我可能会更换厂商，
 * 所以上面的修改不要单纯只针对土豆，未来适配进来的厂商也要适配」
 *   ⇒ **不按 provider / 不按参考图模式分支**：所有情况一律原话直发。
 */
import { describe, expect, it } from 'vitest';
import { buildImagePrompt, isVerbatimPromptMode } from '../../src/services/ai/imagePromptHints';

const RAW = '参考{{Image 1}} 生成日常生活道具的海报';

describe('出站提示词 = 用户原话（与官方同构，且对所有厂商一致）', () => {
  it('★ 不带任何样板（这是「出图没啥变化 / 效果差很多」的修复）', () => {
    const prompt = buildImagePrompt({
      rawPrompt: RAW,
      referenceCount: 1,
      styleAsFirst: false,
      aspectRatio: '3:4',
      mode: 'edits-json-images',
    });
    expect(prompt).toBe(RAW);
    expect(prompt).not.toContain('【参考图输入】');
    expect(prompt).not.toContain('【输出画幅】');
    expect(prompt).not.toContain('不要重新构思画面');
  });

  it('★ 其它模式 / 未指定模式也一律原话（不针对某个厂商）', () => {
    for (const mode of [undefined, 'edits-multipart', 'generation-json-image-urls'] as const) {
      expect(buildImagePrompt({ rawPrompt: RAW, referenceCount: 2, styleAsFirst: false, aspectRatio: '1:1', mode })).toBe(RAW);
    }
  });

  it('开了项目风格母图时只保留母图那一行（那是只有 MTV 才知道的语义）', () => {
    const prompt = buildImagePrompt({
      rawPrompt: RAW,
      referenceCount: 2,
      styleAsFirst: true,
      aspectRatio: '16:9',
      mode: undefined,
    });
    expect(prompt.startsWith('【项目风格母图】')).toBe(true);
    expect(prompt).toContain('【内容参考图】');
    expect(prompt).toContain(RAW);
    /* 仍然不许出现通用样板 */
    expect(prompt).not.toContain('【参考图输入】');
    expect(prompt).not.toContain('【输出画幅】');
  });

  it('没有参考图时永远是原话', () => {
    expect(buildImagePrompt({ rawPrompt: RAW, referenceCount: 0, styleAsFirst: true, aspectRatio: '1:1' })).toBe(RAW);
  });

  it('判定函数保留（文档/兼容用）', () => {
    expect(isVerbatimPromptMode('edits-json-images')).toBe(true);
    expect(isVerbatimPromptMode(undefined)).toBe(false);
  });
});
