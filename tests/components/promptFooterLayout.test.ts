/**
 * 底部编辑区（提示词栏）底行的两条布局契约。
 *
 * 用户 2026 反馈（两张截图）：
 *   ①「卡片底部编辑区 选择模型按钮 选择模型后的显示名字很长 就把 提示词按钮 挤压掉」
 *      「既想保证模型名正常显示 又不想提示词按钮被遮挡或挤压」
 *   ②「去 看看源码 怎么设定的 怎么显示的 最长是多少」
 *   ③「积分数字的停留不对了 … 选其他模型就不对 选 gpt 模型就是对的」
 *
 * 官方真值（`zoom-slider-3ZcFvYQO.js`）：
 *   · 模型触发器 `Sme`：`Button variant="ghost" size="sm"` +
 *     `gap-1.5 px-2 text-sm font-normal h-8`，名字是
 *     `<span className="whitespace-nowrap capitalize">{t(name)}</span>`
 *     ⇒ **不截断、也没有任何「最长多少」的限制**。
 *   · 底栏容器 `fx`：`customWidth={680} adaptiveWidth`
 *     ⇒ 类名 `w-max max-w-[min(960px,calc(100vw-32px))]`
 *        + style `{ width:"max-content", minWidth: max(customWidth, minWidth ?? customWidth) }`
 *     ⇒ **宽度跟着内容变宽**（下限 680、上限 min(960, 100vw-32px)）—— 长名靠面板变宽容纳，
 *        而不是把名字截断，更不是让它去挤右边那排。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
  /* 统一换行：本仓是 CRLF，多行选择器按 `\n` 写会匹配不上 */
  .replace(/\r\n/g, '\n');

const PANELS = 'src/styles/panels.css';
const PROMPT = 'src/styles/prompt.css';
const MODEL = 'src/styles/model-selector.css';

/**
 * 取一条规则体。
 * ⚠️ **先剥注释再切**：`panels.css` 的说明里会出现 `}`（代码片段，例：`customWidth={680}` 那段），
 *    若先按 `}` 切，会把规则体从注释中间截断 ⇒ 断言假失败（实测踩过）。
 */
function block(css: string, selector: string): string {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const at = clean.indexOf(`${selector} {`);
  expect(at, `找不到 ${selector}`).toBeGreaterThan(-1);
  return clean.slice(at, clean.indexOf('}', at));
}

describe('底栏宽度 · 官方 adaptiveWidth', () => {
  it('`.ai-dialog-float` 用 `width: max-content` + 下限 680 + 上限 min(960px, 100vw-32px)', () => {
    const body = block(read(PANELS), '.ai-dialog-float');
    expect(body).toMatch(/width:\s*max-content/);
    expect(body).toMatch(/min-width:\s*680px/);
    expect(body).toMatch(/max-width:\s*min\(960px,\s*calc\(100vw\s*-\s*32px\)\)/);
    /* 钉死 680 是**错**的方向（长名无处可去 ⇒ 溢出压住右边那排）*/
    expect(body).not.toMatch(/(^|[^-])width:\s*680px/);
  });

  it('提示词正文**不参与** max-content（否则一行长文本会把面板顶到 960）', () => {
    const css = read(PANELS);
    const wrap = block(css, '.ai-dialog-float .prompt-header-row,\n.ai-dialog-float .prompt-input-wrap');
    expect(wrap).toMatch(/width:\s*0/);
    expect(wrap).toMatch(/min-width:\s*100%/);
  });
});

describe('模型名 · 按官方 nowrap，放得下就完整显示', () => {
  it('模型选择器可缩（`0 1 auto` + `min-width: 0`），标签才有机会省略号兜底', () => {
    const body = block(read(MODEL), '.prompt-footer .model-selector');
    expect(body).toMatch(/flex:\s*0 1 auto/);
    expect(body).toMatch(/min-width:\s*0/);
    /* 反向锁：`flex: 0 0 auto`（永不缩）会把左组顶溢出 ⇒ 「提示词」按钮被盖住 */
    expect(body).not.toMatch(/flex:\s*0 0 auto/);
  });

  it('标签保留省略号兜底（名字顶到 960 上限时截断，而不是盖住右边）', () => {
    const body = block(read(MODEL), '.prompt-footer .model-selector-label');
    expect(body).toMatch(/text-overflow:\s*ellipsis/);
    expect(body).toMatch(/overflow:\s*hidden/);
  });

  it('左组**不许**用 `overflow: hidden` 防溢出（会裁掉按钮的 `::after` tooltip）', () => {
    const body = block(read(PROMPT), '.prompt-footer-left');
    expect(body).not.toMatch(/overflow:\s*hidden/);
    /* 防溢出靠的是 min-width: 0 + 面板自适应 */
    expect(body).toMatch(/min-width:\s*0/);
    expect(body).toMatch(/flex:\s*1 1 auto/);
  });

  it('完整模型名可从原生 `title` 查（长名被兜底截断时也有据可查）', () => {
    expect(read('src/components/nodes/shared/ModelSelector.tsx'))
      .toContain('<span className="model-selector-label" title={displayLabel}>');
  });
});

describe('积分滚动数字 · 按列排', () => {
  it('`__roll` 显式 `grid-auto-flow: column`（否则多字符会竖着叠 → 被 20px 窗口裁掉半截）', () => {
    const body = block(read(PROMPT), '.prompt-footer .prompt-credit-estimate__roll');
    expect(body).toMatch(/display:\s*inline-grid/);
    expect(body).toMatch(/grid-auto-flow:\s*column/);
  });

  it('列宽按内容、整组居中 —— 否则 `width: 100%` 会把 auto 轨道拉伸，「10」变成「1 0」', () => {
    const body = block(read(PROMPT), '.prompt-footer .prompt-credit-estimate__roll');
    expect(body).toMatch(/grid-auto-columns:\s*max-content/);
    expect(body).toMatch(/justify-content:\s*center/);
  });

  it('数字窗口高 20、字符高 1em（12px）⇒ 上下各留 4px 居中', () => {
    const css = read(PROMPT);
    expect(block(css, '.prompt-footer .prompt-credit-estimate__value')).toMatch(/height:\s*20px/);
    expect(block(css, '.prompt-footer .prompt-credit-estimate__char')).toMatch(/height:\s*1em/);
  });
});
