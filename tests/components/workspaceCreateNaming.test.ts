/**
 * 「新建画布 / 新建项目」的**两条命名规则**（官方是两套，别混用）。
 *
 * 官方出处：
 *   1. **画布顶部切换器 → 新建画布**（`page-DSy7Zc_d.js` 的 `Za`）：
 *      `At(lang) = lang.startsWith('zh') ? '画布' : 'Canvas'`，名字 = `${前缀} ${最小未占用的正整数}`
 *      ⇒ 中文界面得到「画布 1 / 画布 2 / …」。
 *   2. **工作空间「我的项目 → 新建项目」**（`page-mqHAp5sL.js` 的 `Gt`）：
 *      `const i = { name: "Untitled", description: "" }` —— **写死 `Untitled`，不本地化**；
 *      并且当前打开着文件夹时补 `parent_id = 打开的文件夹 id`（新画布直接建进该文件夹）。
 *
 * 用户 2026：「从 我的项目 新建项目 命名的逻辑不对」= MTV 当时把两条都走了 `画布 N`。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { officialDefaultCanvasName } from '../../src/utils/officialCanvasName';
import { setLocale } from '../../src/i18n';

const read = (p: string) => readFileSync(new URL('../../src/' + p, import.meta.url), 'utf8');

describe('新建的命名规则（两条，与官方一致）', () => {
  it('顶部切换器：不带名字 ⇒ 默认走官方的「画布 N」', () => {
    const menu = read('components/canvas/CanvasSwitcherMenu.tsx');
    /* 必须是**不带参数**的调用，才会落到 store 的默认命名（画布 N） */
    expect(menu).toContain('createProject().then(() => onClose())');
    setLocale('zh-CN');
    expect(officialDefaultCanvasName([])).toBe('画布 1');
  });

  it('我的项目：显式传官方的 `Untitled`（不本地化），并把当前文件夹带上', () => {
    const page = read('components/workspace/WorkspacePage.tsx');
    expect(page).toContain("store.createProject('Untitled', { collectionId })");
    /* 非中文界面也仍然是 Untitled（官方是字面量，不走 i18n） */
    setLocale('en-US');
    expect(page).toContain("'Untitled'");
  });

  it('工作空间把「当前打开的文件夹」传给创建接口（官方 parent_id 的等价物）', () => {
    const projects = read('components/workspace/WorkspaceProjects.tsx');
    expect(projects).toContain('onCreateProject: (collectionId?: string) => void;');
    expect(projects).toContain('onCreateProject(activeCollectionId ?? undefined)');
    /* 两个入口（工具条按钮 + 新建卡片）都要带 */
    expect(projects.match(/onCreateProject\(activeCollectionId \?\? undefined\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('store.createProject 支持显式名字 + 目标文件夹，并落进项目记录', () => {
    const store = read('store/store.projects.ts');
    expect(store).toContain('createProject: (name?: string, options?: { collectionId?: string }) => Promise<string | undefined>;');
    expect(store).toContain('collectionId: options?.collectionId');
    /* 默认名只在**没传 name** 时才用 */
    expect(store).toContain('if (name) {');
    expect(store).toContain('defaultName = name;');
  });
});
