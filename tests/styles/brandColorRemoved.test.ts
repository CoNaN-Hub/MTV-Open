/**
 * MTV 品牌色（`--brand` 靛蓝一族）**全仓移除**的源码级回归。
 *
 * 用户 2026：「按照源码 和官方来 MTV 的 移除 包括 MTV 的品牌色」
 * ⇒ 全部换官方 `:root` 逐字值（`vendor-pkg-canvas` 打包的官方 CSS 实测，`:root` 段）：
 *
 *   · 强调填充     → `--primary`(#1fa2dc) / `--primary-foreground`(#fafafa)
 *   · 浅强调文字/面 → `--accent-primary`(#90c4e5)
 *   · 淡化底/描边/焦点环 → 官方中性白透明度（官方 `--border:#ffffff1a` / `--input:#ffffff26` /
 *                          `bg-white/[0.10]` 同一套刻度）
 *
 * 本仓既有先例（同一口径）：`reactflow.css` @790「画布内不出现品牌色」、
 * `official-controls.css` 的 `.o-*` 作用域、`quality-ratio.css`「选中不是品牌色底」、
 * `sidebar.css`「按官方改为无品牌色描边」。
 *
 * ⚠️ 本测试只钉「MTV 品牌色」这一件事；**官方品牌资产**（`.brand-flame-button` /
 * `.canvas-brand-nav` / `.brand-trigger` / `.brand-mark-window` 火焰 logo）与**厂商徽标机制**
 * `--badge-hue` 明确不在范围内，最后两条测试就是防止误伤它们。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const REPO = fileURLToPath(new URL('../../', import.meta.url));

/** ★ 声明的残留数：本轮扫完之后全仓 `src/**` 里 `var(--brand` 的出现次数。 */
const DECLARED_BRAND_REFERENCE_RESIDUAL = 0;

const SCANNED_EXTENSIONS = ['.css', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const sourceFiles = walk(SRC).filter((f) => SCANNED_EXTENSIONS.some((ext) => f.endsWith(ext)));

/** 注释里的同名文本不算引用（本仓习惯在注释里原样引用「被删掉的东西」）。 */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('MTV 品牌色已按官方移除', () => {
  it(`全仓 src/** 里 var(--brand 的引用数 == 声明的残留数 ${DECLARED_BRAND_REFERENCE_RESIDUAL}`, () => {
    const hits: string[] = [];
    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8');
      const count = (text.match(/var\(--brand/g) ?? []).length;
      if (count > 0) hits.push(`${relative(REPO, file)} ×${count}`);
    }
    expect(hits, `仍未清理的 var(--brand 引用：\n${hits.join('\n')}`).toHaveLength(
      DECLARED_BRAND_REFERENCE_RESIDUAL,
    );
  });

  it('`--brand` 一族（含 `--brand-alpha-*`）的定义已全部删除，浅色主题那份也没了', () => {
    const definitions: string[] = [];
    for (const file of sourceFiles) {
      stripComments(readFileSync(file, 'utf8'))
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (/--brand[-\w]*\s*:/.test(line)) definitions.push(`${relative(REPO, file)}:${i + 1}`);
        });
    }
    expect(definitions, `仍存在的 --brand 定义：\n${definitions.join('\n')}`).toHaveLength(0);
  });

  it('tailwind.config.js 里不再有 brand 色键（否则 .bg-brand/.text-brand 会重新生成）', () => {
    const config = readFileSync(join(REPO, 'tailwind.config.js'), 'utf8');
    const colorBlock = stripComments(config);
    expect(colorBlock).not.toMatch(/['"]brand['"]\s*:/);
    expect(colorBlock).not.toMatch(/['"]brand-(light|pale|hover)['"]\s*:/);
  });

  it('.o-scope / .o-* 作用域内不出现任何 MTV 品牌色，且 --o-primary 是官方 #1fa2dc', () => {
    const controls = readFileSync(join(SRC, 'styles/official-controls.css'), 'utf8');
    const body = stripComments(controls);

    /* `.o-scope` 的每个声明块都必须干净 */
    for (const m of body.matchAll(/\.o-scope[^{]*\{([\s\S]*?)\}/g)) {
      expect(m[1]).not.toMatch(/--brand|var\(--brand/);
    }
    /* 整个 `.o-*` 令牌载体里也不许有 */
    expect(body).not.toMatch(/var\(--brand/);

    /* 官方 `:root` 逐字：`--primary:#1fa2dc` / `--primary-foreground:#fafafa` */
    expect(body).toMatch(/--o-primary:\s*#1fa2dc;/);
    expect(body).toMatch(/--o-primary-foreground:\s*#fafafa;/);
    /* 浅色主题覆盖里那条 `--o-primary: var(--brand)` 缺陷已修 */
    expect(body).not.toMatch(/--o-primary:\s*var\(--brand\)/);
  });

  it('官方品牌资产与厂商徽标机制未受影响（不许误伤）', () => {
    const flame = readFileSync(join(SRC, 'styles/brand-flame-button.css'), 'utf8');
    for (const sel of ['.brand-flame-button {', '.canvas-brand-nav {', '.brand-flame-button__image {']) {
      expect(flame).toContain(sel);
    }

    const nav = readFileSync(join(SRC, 'styles/canvas-nav.css'), 'utf8');
    expect(nav).toContain('.canvas-nav-bar .brand-trigger {');
    expect(nav).toContain('.canvas-nav-bar .brand-mark-window {');

    /* `--badge-hue` = 厂商徽标各带自己的品牌色（官方模型徽标机制），必须保留 */
    const modelSelector = readFileSync(join(SRC, 'styles/model-selector.css'), 'utf8');
    expect(modelSelector).toContain('--badge-hue:');
  });

  it('替换值全部来自官方令牌 / 官方中性刻度，不新造颜色', () => {
    const base = readFileSync(join(SRC, 'styles/base.css'), 'utf8');
    /* 官方 `:root` 逐字（vendor-pkg-canvas 打包 CSS 的 `:root` 段） */
    expect(base).toMatch(/--primary:\s*#1fa2dc;/);
    expect(base).toMatch(/--primary-foreground:\s*#fafafa;/);
    expect(base).toMatch(/--accent-primary:\s*#90c4e5;/);
    expect(base).toMatch(/--border:\s*#ffffff1a;/);
    expect(base).toMatch(/--input:\s*#ffffff26;/);
    expect(base).toMatch(/--ring:\s*#7373731a;/);
  });
});
