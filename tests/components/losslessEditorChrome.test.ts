/**
 * 无损改图浮编的**屏幕恒定**契约。
 *
 * 用户口径（2026）：
 *   · 「改动处的标注文案 不要随着画布放大缩小」⇒ 标注 chip 的字号/内边距/圆角、
 *     虚线框的线宽、顶栏/底栏的一切尺寸，都必须是**屏幕像素**；
 *   · 而**框的位置/大小**必须**跟着图**走（百分比）—— 那是"改动在哪"的信息，不能定死。
 *
 * 机制：编辑器挂在节点里、随画布缩放，所以「屏幕恒定」= 写 `calc(Npx * var(--irf-scale))`
 *   （`--irf-scale` 由 `.irf-root` 取 `--float-scale` = 1/zoom）⇒ 渲染出来正好 N 屏幕 px。
 * 实测（CDP 9333，画布从 zoom 2 连续缩到 zoom 0.15，每 30ms 采样一次）：
 *   chip 恒为 70×19 屏幕 px；卡片从 500px 缩到 38px。
 *
 * ⚠️ 这条契约很容易被"顺手把 calc 去掉"改坏 —— 去掉之后在 zoom 0.15 下字只有 1.7px、
 *    在 zoom 2 下变成 23px，也就是用户说的「跟着画布放大缩小」✗。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = () => readFileSync(new URL('../../src/styles/image-lossless-float.css', import.meta.url), 'utf8');
const editor = () =>
  readFileSync(
    new URL('../../src/components/nodes/shared/image/ImageFloatingCompositeEditor.tsx', import.meta.url),
    'utf8',
  );

/** 取出某条规则块（从选择器开头到第一个 `}`） */
function ruleBlock(source: string, selector: string): string {
  const at = source.indexOf(selector);
  expect(at, `找不到选择器 ${selector}`).toBeGreaterThan(-1);
  const open = source.indexOf('{', at);
  return source.slice(open + 1, source.indexOf('}', open));
}

describe('无损改图 · 屏幕恒定契约', () => {
  it('标注 chip 的字号 / 内边距 / 圆角都乘 `--irf-scale`（= 屏幕 px）', () => {
    const body = ruleBlock(css(), ".irf-root[data-mode='lossless'] .ilf-cand-chip {");
    expect(body).toMatch(/font-size:\s*calc\([^)]*var\(--irf-scale\)/);
    expect(body).toMatch(/padding:\s*calc\([^)]*var\(--irf-scale\)/);
    expect(body).toMatch(/border-radius:\s*calc\([^)]*var\(--irf-scale\)/);
    /* 一个裸 px 字号都不许有（那就是"跟着画布缩放"） */
    expect(body).not.toMatch(/font-size:\s*\d+(\.\d+)?px/);
  });

  it('虚线框的线宽也乘 `--irf-scale`；而**位置/大小必须用百分比**（跟着图走）', () => {
    const box = ruleBlock(css(), ".irf-root[data-mode='lossless'] .ilf-cand {");
    expect(box).toMatch(/outline:\s*calc\([^)]*var\(--irf-scale\)/);
    const src = editor();
    /* 框的 left/top/width/height 由区域坐标换算成百分比（跟随图片缩放） */
    expect(src).toContain('left: `${((r.minX / detSize.dw) * 100).toFixed(4)}%`');
    expect(src).toContain('width: `${(((r.maxX - r.minX + 1) / detSize.dw) * 100).toFixed(4)}%`');
    /* 不许再用"bbox 中心 + 最小屏幕尺寸"那套定位（框会和真实位置错开） */
    expect(src).not.toContain('translate(-50%, -50%)');
  });

  it('chip 的纵向避让偏移也按屏幕 px 写（150 / 30 是参考实现的屏幕值）', () => {
    const src = editor();
    /* 阈值换算成百分比要除以**画面的屏幕尺寸** */
    expect(src).toContain('const xTol = (150 / W) * 100;');
    expect(src).toContain('const yTol = (30 / H) * 100;');
    /* 写回 top 时乘回 `--irf-scale` */
    expect(src).toContain('top: `calc(${chipShift[i] ?? -4}px * var(--irf-scale))`');
  });

  it('顶栏 / 底栏同样是屏幕恒定（反缩放抵消画布 zoom）', () => {
    const body = ruleBlock(css(), ".irf-root[data-mode='lossless'] .irf-toolbar,\n");
    expect(body).toMatch(/scale\(var\(--irf-scale\)\)/);
  });

  /* ── 视图层（滚轮缩放 / 空格平移）与画布缩放的分工 ──
     用户实测两条：①「Ctrl+滚轮 放大缩小时 图像也跟着一起放大缩小」②「图卡内部也跟着变化、
     粉红蒙版和底图对不上」。根因分别是「抢了画布的 Ctrl+滚轮」与「默认态也挂 transform」。 */
  it('Ctrl/⌘+滚轮 让给画布：wheel 处理第一时间 return，不 preventDefault', () => {
    const src = editor();
    const at = src.indexOf('const onWheel = (event: WheelEvent) => {');
    expect(at).toBeGreaterThan(-1);
    const head = src.slice(at, at + 1200);
    expect(head).toContain('if (event.ctrlKey || event.metaKey) return;');
    /* return 必须**在** preventDefault 之前 */
    expect(head.indexOf('event.ctrlKey || event.metaKey')).toBeLessThan(head.indexOf('event.preventDefault()'));
    /* 非 Ctrl 的滚轮还要 stopPropagation：React Flow 的滚轮是祖先上的 JS 监听，
       preventDefault 拦不住 —— 2026 实机验收里它会把画布顺带平移 144px。 */
    expect(head).toContain('event.stopPropagation();');
    expect(head.indexOf('event.stopPropagation()')).toBeGreaterThan(head.indexOf('event.preventDefault()'));
  });

  it('视图层默认态不写 transform（不制造合成层 / containing block）', () => {
    const src = editor();
    expect(src).toContain('view.s === 1 && view.tx === 0 && view.ty === 0');
    expect(src).toContain('? undefined');
    /* 补偿的基准取自 `.irf-root` 上算好的倍率，不依赖 `--float-scale` 在不在 */
    const body = ruleBlock(css(), ".irf-root[data-mode='lossless'] .ilf-vport {").replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).toContain('calc(var(--irf-scale-base, 1) / var(--ilf-vscale, 1))');
    expect(body).not.toContain('--float-scale');
    /* 常驻合成层会改变取样 ⇒ 不许有 will-change */
    expect(body).not.toContain('will-change');
  });
});
