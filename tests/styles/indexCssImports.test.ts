/**
 * `@import` 清单完整性（回归：2026-10 round 103 之后 `src/index.css` 里
 * `@import './styles/nodes-image.css';` 被「插入 nodes-mockup」的补丁**整行顶掉**）。
 *
 * ── 事故现场 ──
 *   `src/index.css` 是**唯一**样式入口（`main.tsx` 只 import 它）。那行被顶掉后，
 *   `nodes-image.css` 里 **80 组选择器一条都没加载**（不报错），而它们**仍然被组件在用**：
 *     · `.multigrid-*`         ← `nodes/shared/toolbar` 的快速切分菜单
 *     · `.matting-*`           ← `nodes/shared/image/MattingEditor.tsx` / `MattingToolbar.tsx`
 *     · `.customgrid-*`        ← `nodes/shared/image/CustomGridEditor.tsx`
 *     · `.image-editor-zoom-*` ← `nodes/shared/image/ImageEditorZoomControls.tsx`
 *   全仓别处**只**在 `separators.css`（分隔线）与 `base.css`（`body[data-tauri-window]` 的圆角组）
 *   里顺带提到过同名类，其余 70+ 条选择器**只此一处定义** ⇒ 删文件不行，必须把 import 补回。
 *   真机读数（CDP 9333，改动前）：`document.styleSheets` 里 `.matting-toolbar` / `.customgrid-toolbar`
 *   / `.image-editor-zoom-controls` **命中 0**；补回 import 后同样三个选择器命中 1。
 *
 * ── 本文件钉住 ──
 *   ① `src/index.css` 的每条 `@import` 都要落到**真实存在的**文件（改名/打错要红）；
 *   ② `src/styles/*.css` 的每个文件都要能**从入口到达**（`index.css` 的 `@import` 链，
 *      或 `src` 下 `.ts`/`.tsx` 里的 `import '…css'`），否则必须列进下面的显式清单；
 *   ③ `nodes-image.css` 必须逐字出现在 `index.css` 里（这次事故的钉子）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const STYLES_DIR = path.join(SRC, 'styles');
const INDEX_CSS = path.join(SRC, 'index.css');

/** **故意不从入口加载**的样式文件（当前应为空 —— 加人必须写明理由）。 */
const NOT_REACHABLE_ALLOW: Record<string, string> = {};

const allCssFiles = () => readdirSync(STYLES_DIR).filter((f) => f.endsWith('.css'));

/** 递归收集 `src/**` 下所有 `import '…css'` 的目标（只保留落在 `src/styles/` 里的） */
function tsCssImports(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      const text = readFileSync(full, 'utf8');
      for (const m of text.matchAll(/import\s+(?:[^'"]*?\s+from\s+)?'([^']+\.css)'/g)) {
        const abs = path.resolve(path.dirname(full), m[1]);
        if (path.dirname(abs) === STYLES_DIR) out.push(path.basename(abs));
      }
    }
  };
  walk(SRC);
  return out;
}

/** 从 `src/index.css` 出发、沿 `@import` 链（含样式内部互相 import）收集可达文件 */
function indexCssReachable(): { reachable: Set<string>; missingTargets: string[] } {
  const reachable = new Set<string>();
  const missingTargets: string[] = [];
  const visit = (rel: string) => {
    if (reachable.has(rel)) return;
    reachable.add(rel);
    const text = readFileSync(path.join(STYLES_DIR, rel), 'utf8');
    for (const m of text.matchAll(/@import\s+'([^']+)'/g)) {
      const next = m[1].replace(/^\.\//, '');
      if (!allCssFiles().includes(next)) { missingTargets.push(rel + ' → ' + m[1]); continue; }
      visit(next);
    }
  };
  const entry = readFileSync(INDEX_CSS, 'utf8');
  for (const m of entry.matchAll(/@import\s+'\.\/styles\/([^']+)'/g)) {
    if (!allCssFiles().includes(m[1])) { missingTargets.push('index.css → ' + m[1]); continue; }
    visit(m[1]);
  }
  return { reachable, missingTargets };
}

describe('src/index.css 的 @import 清单完整性', () => {
  it('★ 不变量：index.css 的每条 @import 都指向真实存在的样式文件', () => {
    expect(indexCssReachable().missingTargets).toEqual([]);
  });

  it('★ 不变量：src/styles 下每个 .css 都能从入口到达（或列进显式清单）', () => {
    const { reachable } = indexCssReachable();
    for (const file of tsCssImports()) reachable.add(file);
    const orphans = allCssFiles().filter((f) => !reachable.has(f) && !(f in NOT_REACHABLE_ALLOW)).sort();
    expect(orphans).toEqual([]);
    /* 反向抽查：解析没退化（条目太少说明入口根本没读到，上面的 `[]` 是假绿） */
    expect(reachable.size).toBeGreaterThanOrEqual(60);
    expect(reachable.has('nodes.css')).toBe(true);
  });

  it('★ 回归钉子：`nodes-image.css` 逐字出现在 index.css 里（曾被整行顶掉）', () => {
    expect(readFileSync(INDEX_CSS, 'utf8')).toContain("@import './styles/nodes-image.css';");
  });

  it('该清单里的文件确实在用（不是空壳）：`.matting-*` / `.customgrid-*` 只在 nodes-image.css 定义', () => {
    const css = readFileSync(path.join(STYLES_DIR, 'nodes-image.css'), 'utf8');
    expect(css).toContain('.matting-toolbar {');
    expect(css).toContain('.customgrid-toolbar {');
    expect(css).toContain('.image-editor-zoom-controls {');
    expect(css).toContain('.multigrid-menu {');
  });
});
