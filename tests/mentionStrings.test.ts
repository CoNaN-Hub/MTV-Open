/**
 * 官方 `omniReference.*` 文案表回归（`mentionStrings.ts`）。
 *
 * 断言值全部来自 live `vendor-pkg-canvas-ChpWx5JY.js`
 * enUS@3631952 · jaJP@3995788 · koKR@4132969 · zhCN@4267472 的逐字抽取。
 */
import { describe, expect, it } from 'vitest';
import { MENTION_STRINGS, interpolateMentionString, mentionString } from '../src/services/chat/mentionStrings';

describe('mentionString —— 官方 omniReference.* 文案', () => {
  it('建议弹层的 12 个叶子键：zh-CN 逐字', () => {
    expect(mentionString('omniReference.suggestion.noResults', { locale: 'zh-CN' })).toBe('暂无结果');
    expect(mentionString('omniReference.suggestion.showMoreResults', { locale: 'zh-CN' })).toBe('还有 {{count}} 个结果');
    expect(mentionString('omniReference.suggestion.linkedNodeSection', { locale: 'zh-CN' })).toBe('已连接节点');
    expect(mentionString('omniReference.suggestion.linkedNodeShortcutHint', { locale: 'zh-CN' })).toBe('输入序号快选');
    expect(mentionString('omniReference.suggestion.directionSection', { locale: 'zh-CN' })).toBe('指令');
    expect(mentionString('omniReference.suggestion.teamSection', { locale: 'zh-CN' })).toBe('团队素材库');
    expect(mentionString('omniReference.suggestion.myLibrarySection', { locale: 'zh-CN' })).toBe('我的素材库');
    expect(mentionString('omniReference.suggestion.privateSection', { locale: 'zh-CN' })).toBe('个人素材库');
    expect(mentionString('omniReference.suggestion.pluginSection', { locale: 'zh-CN' })).toBe('应用');
    expect(mentionString('omniReference.suggestion.packageDrilldown.noNodes', { locale: 'zh-CN' })).toBe('该资产包内暂无节点');
    expect(mentionString('omniReference.suggestion.categoryDrilldown.noAssets', { locale: 'zh-CN' })).toBe('该分类下暂无资产');
    expect(mentionString('omniReference.suggestion.noMatchingAssetsInLibrary', { locale: 'zh-CN' })).toBe('资产库中未找到匹配资产');
  });

  it('四个语言的 `showMoreResults` 与官方插值一致', () => {
    expect(mentionString('omniReference.suggestion.showMoreResults', { locale: 'en-US', params: { count: 3 } })).toBe('3 more results');
    expect(mentionString('omniReference.suggestion.showMoreResults', { locale: 'ja-JP', params: { count: 3 } })).toBe('さらに 3 件');
    expect(mentionString('omniReference.suggestion.showMoreResults', { locale: 'ko-KR', params: { count: 3 } })).toBe('3개 더 보기');
    expect(mentionString('omniReference.suggestion.showMoreResults', { locale: 'zh-CN', params: { count: 3 } })).toBe('还有 3 个结果');
  });

  it('`{{mode}}` / `{{count}}` 插值；未给参数时保留原样占位符', () => {
    expect(mentionString('omniReference.mentionUnavailableMode', { locale: 'zh-CN', params: { mode: '视频' } })).toBe('@ 仅在视频模式下可用');
    expect(mentionString('omniReference.mentionUnavailableModel', { locale: 'zh-CN' })).toBe('当前模型不支持 @');
    expect(mentionString('omniReference.mentionUnavailableMode', { locale: 'en-US', params: { mode: 'Video' } })).toBe('@ is only available in Video mode');
    expect(mentionString('omniReference.suggestion.showMoreResults', { locale: 'zh-CN' })).toBe('还有 {{count}} 个结果');
    expect(mentionString('omniReference.assetLimitExceeded.image', { locale: 'zh-CN', params: { count: 9 } })).toBe('此模型将仅识别前 9 个图片引用。');
  });

  it('chip / skills / skillOptions 三族逐字（zh-CN 与 en-US）', () => {
    expect(mentionString('omniReference.chip.removeAriaLabel', { locale: 'zh-CN' })).toBe('移除引用');
    expect(mentionString('omniReference.chip.removeAriaLabel', { locale: 'en-US' })).toBe('Remove reference');
    expect(mentionString('omniReference.chip.removeAriaLabel', { locale: 'ja-JP' })).toBe('参照を削除');
    expect(mentionString('omniReference.chip.removeAriaLabel', { locale: 'ko-KR' })).toBe('참조 제거');
    expect(mentionString('omniReference.skills.duration', { locale: 'zh-CN' })).toBe('时间');
    expect(mentionString('omniReference.skills.cameraShot', { locale: 'zh-CN' })).toBe('镜头');
    expect(mentionString('omniReference.skills.speedRamp', { locale: 'zh-CN' })).toBe('速度');
    expect(mentionString('omniReference.skills.cameraMovement', { locale: 'zh-CN' })).toBe('运镜');
    expect(mentionString('omniReference.skillOptions.speed.bullet_time', { locale: 'zh-CN' })).toBe('子弹时间');
    expect(mentionString('omniReference.skillOptions.cam.push', { locale: 'zh-CN' })).toBe('推镜头');
    expect(mentionString('omniReference.skillOptions.cam.rotate_360', { locale: 'zh-CN' })).toBe('360度旋转');
    expect(mentionString('omniReference.skillOptions.cam.rotate_360', { locale: 'en-US' })).toBe('360° rotation');
    expect(mentionString('omniReference.skillOptions.shot.closeUp', { locale: 'zh-CN' })).toBe('特写');
    expect(mentionString('omniReference.skillOptions.shot.first_person', { locale: 'zh-CN' })).toBe('第一人称视角');
  });

  it('命中顺序：当前语言 → 英文 → fallback → 原样 path', () => {
    /* 官方 `C("omniReference.suggestion.referenceCurrentFolder","Reference folder")`：该键不在命名空间里 ⇒ 吃 fallback。 */
    expect(mentionString('omniReference.suggestion.referenceCurrentFolder', { locale: 'zh-CN', fallback: 'Reference folder' })).toBe('Reference folder');
    expect(mentionString('omniReference.notARealKey')).toBe('omniReference.notARealKey');
    /* 未知语言回落 zhCN。 */
    expect(mentionString('omniReference.suggestion.noResults', { locale: 'de-DE' })).toBe('暂无结果');
    /* MTV `Locale` 字面量 `zh-CN` 必须命中（历史上这里是恒 miss 的坑）。 */
    expect(mentionString('omniReference.suggestion.pluginSection', { locale: 'zh-CN' })).toBe('应用');
    expect(mentionString('omniReference.suggestion.pluginSection', { locale: 'zhCN' })).toBe('应用');
  });

  it('四个语言都齐备 12 个 suggestion 叶子键（结构完整性）', () => {
    const leaves = (node: unknown, prefix = ''): string[] => {
      if (!node || typeof node !== 'object') return [prefix];
      return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => leaves(value, prefix ? `${prefix}.${key}` : key));
    };
    for (const locale of ['enUS', 'jaJP', 'koKR', 'zhCN']) {
      const suggestion = (MENTION_STRINGS[locale] as { suggestion: unknown }).suggestion;
      expect(leaves(suggestion).sort()).toEqual([
        'categoryDrilldown.noAssets',
        'directionSection',
        'linkedNodeSection',
        'linkedNodeShortcutHint',
        'myLibrarySection',
        'noMatchingAssetsInLibrary',
        'noResults',
        'packageDrilldown.noNodes',
        'pluginSection',
        'privateSection',
        'showMoreResults',
        'teamSection',
      ]);
    }
  });

  it('`interpolateMentionString` 只替换已知键', () => {
    expect(interpolateMentionString('a {{x}} b {{y}}', { x: 1 })).toBe('a 1 b {{y}}');
    expect(interpolateMentionString('a {{x}}', undefined)).toBe('a {{x}}');
  });
});
