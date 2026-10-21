// @vitest-environment jsdom
/**
 * 第 56 轮：管理技能面板「每个技能可以点开」+ 技能展示名 + 应用页签的死条目。
 *
 * 官方（用户图 2/图 3）：技能卡点开后是**详情页** —— 左上「返回」+ 名称 + 来源徽章 + 描述 +
 * 可滚动的技能正文 + 底部「卸载 / 编辑技能 / 在对话中使用」。
 *
 * 验证分级 = **(b) jsdom 真 DOM + (d) 源码级**。
 */
import { act, cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SkillsManagerDialog from '../../src/components/chat/SkillsManagerDialog';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { UserSkill } from '../../src/types';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const SKILL: UserSkill = {
  id: 'skill-1',
  name: 'visual-art-director',
  description: '对插画、概念美术做专业艺术评审',
  fileName: 'SKILL.md',
  content: '---\nname: 视觉艺术总监分析\n---\n\n## 诊断顺序\n1. 阅读性与创作意图\n',
  /* 导入时由 `skillManifest` 解析并存下的 frontmatter（展示名优先取这里的 `name`）。 */
  manifest: { name: '视觉艺术总监分析' },
  sourceType: 'folder',
  createdAt: 1,
} as UserSkill;

function mount(props: Partial<React.ComponentProps<typeof SkillsManagerDialog>> = {}) {
  return render(
    <SkillsManagerDialog
      open
      onClose={() => {}}
      onCreateSkill={() => {}}
      onUploadSkillFile={() => {}}
      onUploadSkillFolder={() => {}}
      {...props}
    />,
  );
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ userSkills: [SKILL] });
});
afterEach(cleanup);

describe('技能卡可点开 ⇒ 详情页', () => {
  it('默认显示列表；点卡片进入详情页（返回 + 名称 + 来源 + 描述 + 正文 + 底部按钮）', () => {
    mount();
    expect(document.body.querySelector('[data-testid="skill-detail-panel"]')).toBeNull();
    const card = document.body.querySelector<HTMLElement>('[data-testid="skill-card-skill-1"]')!;
    expect(card).not.toBeNull();
    act(() => { card.click(); });

    const panel = document.body.querySelector('[data-testid="skill-detail-panel"]')!;
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('对插画、概念美术做专业艺术评审');
    /* 正文（frontmatter 已剥掉）。 */
    expect(panel.textContent).toContain('诊断顺序');
    expect(panel.textContent).not.toContain('---');
    /* 底部三颗：卸载 / 编辑技能 / 在对话中使用。 */
    expect(panel.textContent).toContain('卸载');
    expect(panel.textContent).toContain('编辑技能');
    expect(panel.textContent).toContain('在对话中使用');
    expect(document.body.querySelector('[data-testid="skill-detail-back"]')).not.toBeNull();
  });

  it('「返回」回列表；「在对话中使用」回调带上技能并关面板', () => {
    const onUseSkill = vi.fn();
    const onClose = vi.fn();
    mount({ onUseSkill, onClose });
    act(() => { document.body.querySelector<HTMLElement>('[data-testid="skill-card-skill-1"]')!.click(); });
    act(() => { document.body.querySelector<HTMLElement>('[data-testid="skill-detail-back"]')!.click(); });
    expect(document.body.querySelector('[data-testid="skill-detail-panel"]')).toBeNull();

    act(() => { document.body.querySelector<HTMLElement>('[data-testid="skill-card-skill-1"]')!.click(); });
    const useButton = Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('在对话中使用'))!;
    act(() => { useButton.click(); });
    expect(onUseSkill).toHaveBeenCalledWith({ id: 'skill-1', name: 'visual-art-director' });
    expect(onClose).toHaveBeenCalled();
  });

  it('展示名优先 frontmatter 的 `name`（中文技能就显示中文），回落文件夹名', () => {
    mount();
    /* frontmatter 里声明了 `视觉艺术总监分析` ⇒ 卡片标题就是它。 */
    expect(document.body.querySelector('[data-testid="skill-card-skill-1"]')!.textContent).toContain('视觉艺术总监分析');
    expect(document.body.querySelector('[data-testid="skill-card-skill-1"]')!.textContent).not.toContain('visual-art-director');
  });

  it('没有 frontmatter `name` 时回落文件夹名（行为不变）', () => {
    useAppStore.setState({
      userSkills: [{ ...SKILL, id: 'skill-2', content: '## 正文', manifest: undefined } as UserSkill],
    });
    mount();
    expect(document.body.querySelector('[data-testid="skill-card-skill-2"]')!.textContent).toContain('visual-art-director');
  });
  it('详情页右上开关：默认开；点一下 ⇒ 关（并写回 store；官方图 2 那颗）', () => {
    mount();
    const card = document.body.querySelector<HTMLElement>('[data-testid="skill-card-skill-1"]')!;
    act(() => { card.click(); });
    const toggle = document.body.querySelector<HTMLElement>('[data-testid="skill-detail-toggle"]')!;
    expect(toggle.getAttribute('role')).toBe('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    act(() => { toggle.click(); });
    expect(useAppStore.getState().userSkills[0].enabled).toBe(false);
    expect(document.body.querySelector<HTMLElement>('[data-testid="skill-detail-toggle"]')!.getAttribute('aria-checked')).toBe('false');
  });

  it('停用的技能仍在管理面板里列出，但从三个面下线（官方开关的语义）', async () => {
    useAppStore.setState({
      userSkills: [{ ...SKILL, enabled: false } as UserSkill],
    });
    const { listModelInvocableSkills, listUserInvocableSkills, listMcpReadableSkills } = await import('../../src/services/chat/skillCatalog');
    expect(listModelInvocableSkills()).toHaveLength(0);
    expect(listUserInvocableSkills()).toHaveLength(0);
    expect(listMcpReadableSkills()).toHaveLength(0);
    mount();
    expect(document.body.querySelector('[data-testid="skill-card-skill-1"]')).not.toBeNull();
  });

  it('列表卡右侧是**常驻对号**（官方图 1），不再有 hover 删除键', () => {
    mount();
    const card = document.body.querySelector<HTMLElement>('[data-testid="skill-card-skill-1"]')!;
    expect(card.querySelectorAll('button')).toHaveLength(0);
    expect(card.querySelector('[data-testid="skill-card-check-skill-1"]')).not.toBeNull();
  });
});

describe('源码级：接线与官方口径', () => {
  it('`ChatInput` 把「在对话中使用」接到既有 `insertSkillReference`', () => {
    const source = read('src/components/chat/ChatInput.tsx');
    expect(source).toContain('onUseSkill={(skill) => insertSkillReference(skill.id, skill.name)}');
  });

  it('技能详情正文用 `stripSkillFrontmatter` + `ChatMarkdown`（不裸渲染 frontmatter）', () => {
    const source = read('src/components/chat/SkillsManagerDialog.tsx');
    expect(source).toContain('stripSkillFrontmatter(detailSkill.content)');
    expect(source).toContain('<ChatMarkdown value=');
  });
});



