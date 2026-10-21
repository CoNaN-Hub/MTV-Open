/**
 * 厂商连接的「分类可见性」—— 用户 2026 的线上故障回归：
 *
 *   「更新自定义土豆厂商的模型选择后 **选择模型按钮的弹窗失效了**」
 *
 * 实测：土豆连接的 `visibleModelCategories` 被存成了 **`[]`**
 *   ⇒ `[].includes('image') === false` ⇒ 该连接的**所有模型全被滤掉**
 *   ⇒ 画布上的模型下拉是空的（现场量到 `.model-dropdown` 280×16、`children: 0`）。
 *
 * `[]` 的来源：Agent 先建连接（那时模型列表还空着 ⇒ 算出来就是 `[]`），
 * 用户后来「更新模型选择」补模型时，合并分支把空数组**原样保留**了。
 *
 * 约定：`undefined` 与 `[]` 同义 —— **不限制**（空数组不是「一个都不显示」的有效意图：
 * 那会让连接彻底不可用，画布上没有任何入口能救回来）。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isProviderCategoryVisible } from '../../src/components/nodes/shared/defaultModels';

const config = (provider: unknown) => ({ providers: { 'custom-1': provider } }) as never;

describe('连接分类可见性', () => {
  it('undefined（未限制）⇒ 可见', () => {
    expect(isProviderCategoryVisible(config({ name: 'x' }), 'custom-1', 'image')).toBe(true);
  });

  it('★ 空数组按「不限制」处理（写坏的老数据自愈）', () => {
    expect(isProviderCategoryVisible(config({ visibleModelCategories: [] }), 'custom-1', 'image')).toBe(true);
    expect(isProviderCategoryVisible(config({ visibleModelCategories: [] }), 'custom-1', 'text')).toBe(true);
  });

  it('显式勾了分类 ⇒ 只放行勾中的', () => {
    const c = config({ visibleModelCategories: ['image', 'video'] });
    expect(isProviderCategoryVisible(c, 'custom-1', 'image')).toBe(true);
    expect(isProviderCategoryVisible(c, 'custom-1', 'video')).toBe(true);
    expect(isProviderCategoryVisible(c, 'custom-1', 'text')).toBe(false);
  });

  it('连接不存在 / 没有 providerConfigId ⇒ 与原来一致', () => {
    expect(isProviderCategoryVisible(config(undefined), 'custom-1', 'image')).toBe(false);
    expect(isProviderCategoryVisible(config(undefined), undefined, 'image')).toBe(true);
  });

  it('合并分支不得保留空数组（写入侧也要挡住）', () => {
    const source = readFileSync(
      new URL('../../src/services/chat/tools/providerConfigTools.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('mergeVisibleModelCategories(');
    expect(source).not.toContain('visibleModelCategories: existing ? existing.visibleModelCategories :');
    expect(source).toContain('union.length > 0 ? union : undefined');
  });
});
