/**
 * 画布左上角导航 / 切换画布下拉 的**官方契约**测试。
 *
 * 用户 2026 逐条反馈过（每一条都能对回官方的构建产物原文）：
 *   · 「行是居中排的」        → 官方 `.project-row,.folder-row{text-align:left}`
 *   · 「未命名文件呢 / 点击展开呢」→ 官方 `.project-folder` / `.folder-row` /
 *                                  `.folder-children` / `.project-row.is-nested{padding-left:36px}`
 *   · 「点击新建画布后名字不对」  → 官方 `Za(canvases, language)` = `画布 N` / `Canvas N`
 *                                  （最小未占用正整数），**不是** `Untitled`
 *   · 「滑条颜色/粗细/hover 不对」→ 官方 `.project-list{scrollbar-color:#404040 transparent;
 *                                  scrollbar-width:thin}`，且要关掉 MTV 自绘 overlay 滚动条
 *   · 「logo 被挤压」          → 官方 `.brand-mark-window img{width:auto;height:24px}` 是按方图写的，
 *                                  MTV 当年的 1.42:1 inline SVG 必须用 max-width/max-height 才不变形。
 *                                  ★ 2026 后续：这枚 logo 已换成**方形自排版的火焰组件**
 *                                  （`BrandFlameButton`，32×32 表面 + `object-fit:contain`），
 *                                  原来那条 24px max 规则不但多余、还会压过
 *                                  `.brand-flame-button__image{width:100%}` ⇒ 已删除；
 *                                  同时去掉窗口的 `overflow:hidden`（会裁掉官方舞台留给点火爆发的留白）。
 *                                  契约本身（logo 不变形/不被裁）不变，只是落点挪到了火焰组件的 CSS。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getLocale, setLocale } from '../../src/i18n';
import { officialDefaultCanvasName } from '../../src/utils/officialCanvasName';

const navCss = () => readFileSync(new URL('../../src/styles/canvas-nav.css', import.meta.url), 'utf8');
/** 断言前先去 CSS 注释 —— 注释里常为了说明「原来是什么」而原样引用被删掉的声明 */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const menu = () => readFileSync(new URL('../../src/components/canvas/CanvasSwitcherMenu.tsx', import.meta.url), 'utf8');

describe('画布导航 1:1 官方（契约）', () => {
  it('行是左对齐的（官方 .project-row,.folder-row 里带 text-align:left）', () => {
    const css = navCss();
    const rule = css.slice(css.indexOf('.project-row,\n.folder-row {'));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('text-align: left');
  });

  it('文件夹树：容器 / 行 / 图标 / 竖线 / 子项缩进 都在 CSS 里', () => {
    const css = navCss();
    expect(css).toContain('.project-folder {');
    expect(css).toContain('.folder-glyph {');
    expect(css).toContain('.folder-glyph-hover {');
    expect(css).toContain('.folder-label {');
    expect(css).toContain('.folder-children-gap {');
    /* 官方 `.folder-children:before` —— 子画布左边那条 1px 竖线 */
    expect(css).toContain('.folder-children::before {');
    expect(css).toContain('left: 20px');
    /* 官方 `.project-row.is-nested{min-height:40px;padding-left:36px}` */
    expect(css).toContain('.project-row.is-nested {');
    expect(css).toContain('padding-left: 36px');
  });

  it('列表滚动条 = 官方原生细滚动条，且显式关掉 MTV 的自绘 overlay', () => {
    const css = navCss();
    expect(css).toContain('scrollbar-color: rgb(64, 64, 64) transparent');
    expect(css).toContain('.project-list[data-overlay-scrollbar=\'off\'] {');
    /* MTV 的 `[data-overlay-scrollbar][data-overlay-scrollbar]`（双属性选择器）会把
       scrollbar-width 压成 none，所以这行必须 !important —— 去掉就再也看不到滚动条了。 */
    expect(css).toContain('scrollbar-width: thin !important');
    /* JSX 侧要真的把 opt-out 属性挂上去 */
    expect(menu()).toContain('data-overlay-scrollbar="off"');
  });

  it('logo 不会变形也不会被裁：火焰组件方形自排版，窗口不再 overflow:hidden', () => {
    const css = stripComments(navCss());
    /* 窗口 32×32（logo 由 24 放大到 32），按钮跟着从 28 长到 36 —— 画布胶囊本身 40 高 */
    const win = css.slice(css.indexOf('.canvas-nav-bar .brand-mark-window {'));
    const winBody = win.slice(0, win.indexOf('}'));
    expect(winBody).toContain('width: 32px');
    expect(winBody).toContain('height: 32px');
    /* ⚠️ 不能有 overflow:hidden —— 火焰着色器层按 `inset:-46.154%` 铺开，
       四周那 24% 是官方留给点火爆发/湍流的舞台，裁掉就切掉羽流与烟雾 */
    expect(winBody).not.toContain('overflow: hidden');

    const trigger = css.slice(css.indexOf('.canvas-nav-bar .brand-trigger {'));
    expect(trigger.slice(0, trigger.indexOf('}'))).toContain('height: 36px');

    /* 原「给静态方图 24px max」那条必须删掉：它的特异性 (0,2,1) 会压过
       `.brand-flame-button__image`(0,1,0) ⇒ 静态图层被缩成 24px 错位 */
    expect(css).not.toContain('.canvas-nav-bar .brand-mark-window img,');

    /* 「不变形」的保证现在在火焰组件里：撑满方形窗口 + object-fit:contain */
    const flameCss = readFileSync(
      new URL('../../src/styles/brand-flame-button.css', import.meta.url),
      'utf8',
    );
    const image = flameCss.slice(flameCss.indexOf('.brand-flame-button__image {'));
    const imageBody = image.slice(0, image.indexOf('}'));
    expect(imageBody).toContain('width: 100%');
    expect(imageBody).toContain('height: 100%');
    expect(imageBody).toContain('object-fit: contain');
  });

  it('下拉渲染文件夹行 / 子行 / 页脚新建，并带官方 data-testid 与 aria', () => {
    const source = menu();
    expect(source).toContain('data-testid="canvas-switcher-collection-row"');
    expect(source).toContain('className="folder-row"');
    expect(source).toContain("folder-glyph-rest");
    expect(source).toContain("folder-glyph-hover");
    expect(source).toContain('role="group"');
    /* 子画布：level 2 ⇒ is-nested + aria-level 2 */
    expect(source).toContain("level === 2 ? 'is-nested' : ''");
    expect(source).toContain('aria-level={level}');
    /* 页脚的新建画布 */
    expect(source).toContain('className="project-create"');
    /* pill 上没有「+」（用户：「『+』是 MTV 自己的，不要」）——新建入口只在页脚 */
    expect(readFileSync(new URL('../../src/components/Header.tsx', import.meta.url), 'utf8'))
      .not.toContain('className="project-create"');
  });

  it('动效 = 官方 framer-motion 参数（弹层 spring 38/520、文件夹 .22s/.18s、重命名底衬 .14s）', () => {
    const source = menu();
    expect(source).toContain('damping: 38');
    expect(source).toContain('stiffness: 520');
    expect(source).toContain('opacity: 0, scale: 0.98, y: -4');
    expect(source).toContain('duration: 0.22');
    expect(source).toContain('duration: 0.18');
    expect(source).toContain('[0.215, 0.61, 0.355, 1]');
    expect(source).toContain('useReducedMotion');
    /* 官方 `data-anchor-offset`（实测 -179 = 药丸左 − 箭头左） */
    expect(source).toContain('data-anchor-offset={anchorOffset}');
    expect(readFileSync(new URL('../../src/components/Header.tsx', import.meta.url), 'utf8'))
      .toContain('duration: 0.14, ease: [0.22, 1, 0.36, 1]');
  });

  it('官方 popover / header 的 data-testid 与 aria 全部对齐', () => {
    const header = readFileSync(new URL('../../src/components/Header.tsx', import.meta.url), 'utf8');
    for (const id of [
      'canvas-header-control', 'canvas-header-logo-button', 'canvas-header-logo-window',
      'canvas-header-divider-start', 'canvas-header-title-control', 'canvas-header-rename-slot',
      'canvas-header-rename-surface', 'canvas-header-title-trigger', 'canvas-header-title-input',
      'canvas-header-switcher-trigger',
    ]) expect(header).toContain(id);
    const source = menu();
    for (const id of [
      'canvas-header-switcher-popover', 'canvas-switcher-panel', 'canvas-switcher-search-shell',
      'canvas-switcher-search', 'canvas-switcher-list', 'canvas-switcher-row',
      'canvas-switcher-selected', 'canvas-switcher-footer',
    ]) expect(source).toContain(id);
    /* 弹层外层：官方 Radix 属性（forceMount ⇒ 常驻 + data-state） */
    expect(source).toContain('data-state={open ? \'open\' : \'closed\'}');
    expect(source).toContain('data-side="bottom"');
    expect(source).toContain('data-align="start"');
  });

  it('roving tabindex + 官方方向键', () => {
    const source = menu();
    expect(source).toContain('tabIndex={index === activeIndex ? 0 : -1}');
    for (const k of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'ArrowRight', 'ArrowLeft']) {
      expect(source).toContain(`'${k}'`);
    }
  });

  /* ★ 实测崩过一次（整页「应用加载失败」）：本组件是**常驻挂载**，启动时 `config.collections`
     还没读出来；若在 zustand 选择器里写 `?? []`，每次 render 都会造一个新数组，
     `useShallow` 只做一层 `Object.is` 比较 ⇒ 快照永远不等 ⇒ 无限重渲染
     （`The result of getSnapshot should be cached…` → `Maximum update depth exceeded`）。
     必须回落到**模块级常量**。 */
  it('选择器不得返回新引用（空值回落必须用模块常量）', () => {
    const source = menu();
    expect(source).toContain('const EMPTY_COLLECTIONS: WorkspaceCollection[] = [];');
    expect(source).toContain('s.config.collections ?? EMPTY_COLLECTIONS');
    /* 选择器里**任何** `s.xxx ?? [` 都等价于每次返回新引用 */
    expect(source).not.toMatch(/s\.[A-Za-z.]+\s*\?\?\s*\[/);
  });
});

describe('新建画布默认名 = 官方 Za() 的等价物', () => {
  const original = getLocale();
  beforeEach(() => setLocale('zh-CN'));
  afterEach(() => setLocale(original));

  it('中文界面：画布 N，取最小未占用的正整数', () => {
    expect(officialDefaultCanvasName([])).toBe('画布 1');
    expect(officialDefaultCanvasName(['画布 1'])).toBe('画布 2');
    expect(officialDefaultCanvasName(['画布 2', '画布 1'])).toBe('画布 3');
    expect(officialDefaultCanvasName(['画布 5', '画布 1'])).toBe('画布 2');
    /* 槽位被占满时继续往上找 */
    expect(officialDefaultCanvasName(['画布 1', '画布 2', '画布 3'])).toBe('画布 4');
  });

  it('只有「画布 + 空白 + 数字」这种名字才占位（与官方正则一致）', () => {
    expect(officialDefaultCanvasName(['Untitled', '项目 1', '画布', '画布 x', '画布1'])).toBe('画布 1');
    expect(officialDefaultCanvasName([' 画布 1 '])).toBe('画布 2');
    expect(officialDefaultCanvasName(['画布 0', '画布 -1', '画布 1.5'])).toBe('画布 1');
  });

  it('非中文界面用 Canvas 前缀（官方 At() 只认 zh）', () => {
    setLocale('en-US');
    expect(officialDefaultCanvasName([])).toBe('Canvas 1');
    expect(officialDefaultCanvasName(['Canvas 1', '画布 1'])).toBe('Canvas 2');
  });
});
