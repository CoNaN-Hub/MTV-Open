import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Select Portal 点击边界', () => {
  it('项目设置把 fixedMenu 的 Portal 菜单视为弹层内交互', () => {
    const selectSource = readFileSync(
      new URL('../../src/components/shared/Select.tsx', import.meta.url),
      'utf8',
    );
    const projectSettingsSource = readFileSync(
      new URL('../../src/components/ProjectSettingsPopover.tsx', import.meta.url),
      'utf8',
    );

    expect(selectSource).toContain("data-ui-select-portal={fixedMenu ? '' : undefined}");
    expect(projectSettingsSource).toContain("closest('[data-ui-select-portal]')");
  });

  it('节点弹窗和图层编辑器保留下拉菜单的键盘边界', () => {
    const dialog = readFileSync(new URL('../../src/components/nodes/AINodeDialog.tsx', import.meta.url), 'utf8');
    const composer = readFileSync(new URL('../../src/components/nodes/shared/image/composer/ImageComposerEditor.tsx', import.meta.url), 'utf8');
    expect(dialog).toContain("if (document.querySelector('[data-ui-select-portal]')) return;");
    expect(composer).toContain("closest('.ui-select, [data-ui-select-portal]')");
  });

  /* AINodeDialog 常驻挂载（App 的 `mountNodeDialog`），它的 Escape 监听在 window **捕获**阶段
     且会 `stopPropagation()`。若不在「编辑条真正可见」时早退，整个应用的 Escape 都会被截走：
     CDP 实测 ⇒ 画布导航的「Esc 取消重命名 / Esc 关闭切换菜单」失效、
     `useKeyboardShortcuts` 的 document 捕获 Escape 分支一起死掉。 */
  it('节点弹窗的全局 Escape 只在编辑条可见时消费', () => {
    const dialog = readFileSync(new URL('../../src/components/nodes/AINodeDialog.tsx', import.meta.url), 'utf8');
    const guard = dialog.indexOf('panel.getClientRects().length === 0');
    const stop = dialog.indexOf('e.stopPropagation();');
    expect(guard).toBeGreaterThan(-1);
    expect(stop).toBeGreaterThan(guard);
  });
});
