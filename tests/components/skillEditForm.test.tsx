// @vitest-environment jsdom
/**
 * 第 58 轮：官方「编辑技能」表单（`Bj` 的 `mode:"edit"`）1:1。
 *
 * 官方源码（`live-assets/vendor-pkg-canvas-ChpWx5JY.js` @170400-176200）+ CDP 9222 实测：
 *  · 管理面板里点技能卡 → 详情页 → 「编辑技能」⇒ **同一个 `[role=dialog]`** 正文整块换成表单
 *    （h-9 行仍是「返回 + ✕」），另有 `<h2 class="sr-only">编辑技能</h2>`；
 *  · 字段 id `edit-skill-name` / `edit-skill-description` / `edit-skill-instructions`，标题「编辑技能 + 个人」；
 *  · 页脚「取消」+「保存」：**未改动时两颗都禁用**（脏检测 = 与初值逐字段相等），改任一字段两颗都启用；
 *  · 名称非法（大写/空格）**没有内联报错**，校验只在提交时以 toast 报错；
 *  · 脏表单点「取消」/「返回」⇒ 先弹「放弃更改？」（`role=alertdialog`，取消 / 放弃）。
 *
 * 验证分级 = **(b) jsdom 真 DOM + (d) 源码级**（官方 DOM/源码偏移见上）。
 */
import { act, cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  content: '---\nname: visual-art-director\n---\n\n## 诊断顺序\n1. 阅读性与创作意图\n',
  manifest: { name: 'visual-art-director' },
  sourceType: 'folder',
  createdAt: 1,
} as UserSkill;

function mount() {
  return render(
    <SkillsManagerDialog
      open
      onClose={() => {}}
      onCreateSkill={() => {}}
      onUploadSkillFile={() => {}}
      onUploadSkillFolder={() => {}}
    />,
  );
}

const q = <T extends HTMLElement>(selector: string) => document.body.querySelector<T>(selector);
const buttonByText = (text: string) => Array.from(document.body.querySelectorAll('button'))
  .find((button) => button.textContent?.trim() === text)!;

/** 进入 详情页 → 编辑技能。 */
function openEditForm() {
  act(() => { q<HTMLElement>('[data-testid="skill-card-skill-1"]')!.click(); });
  act(() => { buttonByText('编辑技能').click(); });
}

/** React 受控 input 需要原生 setter + input 事件。 */
function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!;
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ userSkills: [SKILL] });
});
afterEach(cleanup);

describe('官方「编辑技能」表单', () => {
  it('详情页点「编辑技能」⇒ 同一个对话框里换成三字段表单（标题 编辑技能 + 个人）', () => {
    mount();
    openEditForm();

    /* 只有一个 `role=dialog`（官方不另开对话框，CDP 实测）。 */
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(q('[data-testid="skill-detail-panel"]')).toBeNull();
    expect(q('#edit-skill-name')).not.toBeNull();
    expect(q('#edit-skill-description')).not.toBeNull();
    expect(q('#edit-skill-instructions')).not.toBeNull();

    const dialog = q<HTMLElement>('[data-testid="skills-manager-dialog"]')!;
    expect(dialog.textContent).toContain('编辑技能');
    expect(dialog.textContent).toContain('个人');
    /* h-9 行仍是「返回 + ✕」。 */
    expect(q('[data-testid="skill-detail-back"]')).not.toBeNull();
    expect(dialog.querySelector('button[aria-label="关闭"]')).not.toBeNull();
  });

  it('三个字段的初值 = 展示名 / 描述 / 剥掉 frontmatter 的正文', () => {
    mount();
    openEditForm();
    expect(q<HTMLInputElement>('#edit-skill-name')!.value).toBe('visual-art-director');
    expect(q<HTMLTextAreaElement>('#edit-skill-description')!.value).toBe('对插画、概念美术做专业艺术评审');
    expect(q<HTMLTextAreaElement>('#edit-skill-instructions')!.value).toBe('## 诊断顺序\n1. 阅读性与创作意图\n');
  });

  it('未改动时「取消」「保存」都禁用；改任一字段两颗都启用；改回原值又都禁用（官方脏检测）', () => {
    mount();
    openEditForm();
    const cancel = () => buttonByText('取消');
    const save = () => buttonByText('保存');
    expect(cancel().disabled).toBe(true);
    expect(save().disabled).toBe(true);

    typeInto(q<HTMLInputElement>('#edit-skill-name')!, 'visual-art-director-2');
    expect(cancel().disabled).toBe(false);
    expect(save().disabled).toBe(false);

    typeInto(q<HTMLInputElement>('#edit-skill-name')!, 'visual-art-director');
    expect(cancel().disabled).toBe(true);
    expect(save().disabled).toBe(true);
  });

  it('脏表单点「取消」⇒ 先弹「放弃更改？」；点「放弃」回详情页（不保存）', () => {
    mount();
    openEditForm();
    typeInto(q<HTMLTextAreaElement>('#edit-skill-description')!, '改过的描述');
    act(() => { buttonByText('取消').click(); });

    const alert = q<HTMLElement>('[data-testid="skill-form-discard-dialog"]')!;
    expect(alert).not.toBeNull();
    expect(alert.getAttribute('role')).toBe('alertdialog');
    expect(alert.textContent).toContain('放弃更改？');
    expect(alert.textContent).toContain('未保存的更改将会丢失。');

    act(() => {
      Array.from(alert.querySelectorAll('button')).find((b) => b.textContent?.trim() === '放弃')!.click();
    });
    /* 放弃 ⇒ 回详情页，且 store 没被改。 */
    expect(q('[data-testid="skill-form-discard-dialog"]')).toBeNull();
    expect(q('[data-testid="skill-detail-panel"]')).not.toBeNull();
    expect(useAppStore.getState().userSkills[0].description).toBe('对插画、概念美术做专业艺术评审');
  });

  it('「保存」把三字段写回技能（frontmatter name/description + 正文）并回详情页', async () => {
    mount();
    openEditForm();
    typeInto(q<HTMLInputElement>('#edit-skill-name')!, 'art-director');
    typeInto(q<HTMLTextAreaElement>('#edit-skill-description')!, '新的描述');
    typeInto(q<HTMLTextAreaElement>('#edit-skill-instructions')!, '# 新指令\n- 第一条');

    await act(async () => { buttonByText('保存').click(); });
    /* `updateSkillContent` 里 store 先更新、随后 `await fileService.saveSkill`（IndexedDB 的请求回调走事件循环）
       ⇒ 轮询等落盘后的 toast / 关表单。 */
    for (let i = 0; i < 40 && useAppStore.getState().toast.message === ''; i += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
    }

    const saved = useAppStore.getState().userSkills[0];
    expect(saved.id).toBe('skill-1');
    expect(saved.manifest?.name).toBe('art-director');
    expect(saved.description).toBe('新的描述');
    expect(saved.content).toContain('name: art-director');
    expect(saved.content).toContain('description: 新的描述');
    expect(saved.content).toContain('# 新指令');
    expect(useAppStore.getState().toast.message).toBe('技能更新成功');
    /* 回详情页，标题显示新名字。 */
    expect(q('[data-testid="skill-detail-panel"]')!.textContent).toContain('art-director');
  });

  it('名称超长时无内联报错，点「保存」以 toast 报错且停在表单', async () => {
    mount();
    openEditForm();
    typeInto(q<HTMLInputElement>('#edit-skill-name')!, 'x'.repeat(80));

    expect(q<HTMLElement>('[data-testid="skills-manager-dialog"]')!.textContent)
      .not.toContain('技能名称不能超过 64 个字符');

    await act(async () => { buttonByText('保存').click(); });
    expect(useAppStore.getState().toast.message).toBe('技能名称不能超过 64 个字符');
    expect(useAppStore.getState().toast.type).toBe('error');
    expect(q('#edit-skill-name')).not.toBeNull();
  });

  it('中文技能名可以保存（第 59 轮用户决定：MTV 用 id 当主键，放开字符集）', async () => {
    mount();
    openEditForm();
    typeInto(q<HTMLInputElement>('#edit-skill-name')!, '视觉艺术总监分析');

    await act(async () => { buttonByText('保存').click(); });
    for (let i = 0; i < 40 && useAppStore.getState().toast.message === ''; i += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
    }
    const saved = useAppStore.getState().userSkills[0];
    expect(saved.content).toContain('name: 视觉艺术总监分析');
    expect(useAppStore.getState().toast.message).toBe('技能更新成功');
  });

  it('表单态「返回」：干净时直接回详情页，脏时先问（官方 `le` → `requestSkillFormClose("back")`）', () => {
    mount();
    openEditForm();
    act(() => { q<HTMLElement>('[data-testid="skill-detail-back"]')!.click(); });
    expect(q('[data-testid="skill-detail-panel"]')).not.toBeNull();

    act(() => { buttonByText('编辑技能').click(); });
    typeInto(q<HTMLTextAreaElement>('#edit-skill-instructions')!, '改了');
    act(() => { q<HTMLElement>('[data-testid="skill-detail-back"]')!.click(); });
    expect(q('[data-testid="skill-form-discard-dialog"]')).not.toBeNull();
  });
});

describe('源码级：官方 `Bj` 口径', () => {
  it('同一组件按 `mode` 区分创建/编辑（字段 id 前缀 create-skill / edit-skill）', () => {
    const source = read('src/components/chat/SkillForm.tsx');
    expect(source).toContain("const idPrefix = mode === 'create' ? 'create-skill' : 'edit-skill';");
    expect(source).toContain('id={`${idPrefix}-name`}');
    expect(source).toContain('id={`${idPrefix}-description`}');
    expect(source).toContain('id={`${idPrefix}-instructions`}');
  });

  it('编辑保存走本地 `updateSkillContent(id, …)`（官方是 `PUT {skill_name, …}`）', () => {
    const source = read('src/components/chat/SkillForm.tsx');
    expect(source).toContain('updateSkillContent(skill.id, buildSkillDocument(value))');
    expect(source).toContain("showToast(t('技能更新成功'))");
  });

  it('官方遮罩层 `bg-black/70` 存在且点遮罩不关（`onInteractOutside: preventDefault`）', () => {
    const source = read('src/components/chat/SkillsManagerDialog.tsx');
    expect(source).toContain('data-testid="skills-dialog-overlay"');
    expect(source).toContain('bg-black/70');
    expect(source).not.toMatch(/skills-dialog-overlay[\s\S]{0,400}onClick=/);
  });

  it('表单态 Esc / ✕ 走 `requestSkillFormClose("dismiss")`（官方 `ke`），脏则先问', () => {
    const source = read('src/components/chat/SkillsManagerDialog.tsx');
    expect(source).toContain("requestSkillFormClose('dismiss')");
    expect(source).toContain("requestSkillFormClose('back')");
    expect(source).toContain('.requestClose()');
  });
});
