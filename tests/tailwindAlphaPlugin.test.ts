/**
 * Tailwind 自定义「纯 `var()` 色键 + 透明度修饰符」插件的**回归**。
 *
 * ## 背景（这是个**真的把构建搞挂**的 bug）
 *
 * `tailwind.config.js` 里那个插件把 `src/**` 扫一遍，为 `prefix-<色>/<透明度>` 补
 * `color-mix(in oklab, var(--x) N%, transparent)`。它的 `register()` 有守卫：
 * ```js
 * const cssVar = varColors.get(key); if (!cssVar) return;
 * ```
 * 但**任意值分支**（`patternArbitrary`，处理 `border-white/[0.07]` 这种）**绕过了守卫**，
 * 直接写 `var(${varColors.get(match[2])})` ⇒ 对**默认调色板色**（`white` 不在 `varColors` 里）
 * 生成 `var(undefined)`：
 *   ① 浏览器视为**无效声明** ⇒ `border-white/[0.07]` 这类类名**从来没生效过**；
 *   ② `vite build` 的 lightningcss minify **直接抛错**
 *      （`[lightningcss minify] Unexpected token Ident("undefined")`）⇒ **整个前端构建不出来**。
 *
 * 后果极其严重：`dist/` 一直是旧包 ⇒ 桌面端跑的永远是很久以前的构建
 * ⇒ 「源码改了、界面上一个都没变」。
 *
 * 验证分级 = **(d) 源码级**（读 config 文本断言守卫存在 + 不再出现无守卫的 `varColors.get`）。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CONFIG_PATH = 'tailwind.config.js';

function readConfig(): string {
  return readFileSync(CONFIG_PATH, 'utf8');
}

describe('tailwind.config.js —— 透明度插件的 `var(undefined)` 回归', () => {
  it('任意值分支必须先查 `varColors` 并 `continue`（否则默认调色板色会生成 `var(undefined)`）', () => {
    const src = readConfig();
    const at = src.indexOf('patternArbitrary.lastIndex = 0;');
    expect(at).toBeGreaterThan(-1);
    const branch = src.slice(at, at + 1400);
    /* 守卫必须出现在写 utilities 之前。 */
    const guardAt = branch.indexOf('const cssVar = varColors.get(match[2]);');
    const writeAt = branch.indexOf('utilities[selector] = {');
    expect(guardAt).toBeGreaterThan(-1);
    expect(branch.slice(guardAt, guardAt + 120)).toContain('if (!cssVar) continue;');
    expect(guardAt).toBeLessThan(writeAt);
    /* 写 utilities 时用的必须是**已守卫**的 `cssVar`，不能是裸的 `varColors.get(...)`。 */
    expect(branch.slice(writeAt, writeAt + 300)).not.toContain('varColors.get(');
  });

  it('全文件不再出现无守卫的 `var(${varColors.get(`（那正是 `var(undefined)` 的来源）', () => {
    const src = readConfig();
    expect(src).not.toContain('var(${varColors.get(');
  });
});
