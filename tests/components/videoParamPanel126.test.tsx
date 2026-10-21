// @vitest-environment jsdom
/**
 * §126 回归 —— 用户 2026-10-15 第二批反馈（**只用官方产物取证，不再用 CDP**）：
 *   ① 面板分段按钮的**选中底色 + 切换动画**（`点击选项时 底色没有 切换时 底色动画没有`）
 *   ② `视频编辑` 模式下「生成时长」应为**静态「自适应」块**（用户图2 MTV 渲染成数字输入框）
 *   ③ 「联网搜索」开关的**挂载层**（官方在底栏**下方独立一行**；MTV 跑进了编辑框内部）
 *   ④ switch 开/关两态的**颜色/圆点**
 *   ⑤ 该行**高度**（MTV +12px）· 面板宽度两档（`视频编辑` = 320，不是 400）
 *
 * 官方产物偏移：
 *  · `ni` 滑动指示块 @1229126 `vendor-pkg-canvas-Dp0xADoD.js`
 *  · `Uoe` 时长三段 @1874900 · 宽度两档 @1871830 · 比例恒渲染 @1873756
 *  · `fQe` 开关内容 @1999407 · `S0` 面板挂载 @1195200
 *  · `Switch`（shadcn）@455140 `vendor-packages-CvEFn1fJ.js`
 *  · tabler `hourglass`（时长静态块图标）@2452538 · tabler `aspect-ratio` @1623870 `vendor-libs-BOn5wEJU.js`
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const VIDEO = readFileSync('src/components/nodes/shared/VideoParamSelector.tsx', 'utf8');
const PANEL = readFileSync('src/components/nodes/shared/PromptPanel.tsx', 'utf8');
const DIALOG = readFileSync('src/components/nodes/AINodeDialog.tsx', 'utf8');

describe('§126-① 分段控件的选中底色 = 官方滑动指示块（不在按钮上）', () => {
  it('面板里渲染了官方那颗 `.img-rp-segmented-thumb`（改前 MTV 全文件 0 命中）', () => {
    expect(VIDEO).toContain('img-rp-segmented-thumb');
    expect(VIDEO.match(/<VideoSegmented /g)?.length).toBe(5);
    /* 官方量取方式逐字：`{left: k.offsetLeft, width: k.offsetWidth}` */
    expect(VIDEO).toContain('const next = { left: active.offsetLeft, width: active.offsetWidth };');
    expect(VIDEO).toContain('el.querySelector<HTMLElement>(\'[data-seg-active="true"]\')');
  });

  it('按钮上**没有** `bg-*`（官方选中项类串只有 `text-foreground`）—— MTV 沿用 `active` 类 + 指示块', () => {
    const classes = VIDEO.match(/className=\{`img-rp-quality-item[^`]*`\}/g) ?? [];
    expect(classes.length).toBeGreaterThanOrEqual(5);
    for (const c of classes) expect(c, c).not.toContain('bg-');
  });

  it('5 个分段组都标了 `data-seg-active`', () => {
    expect((VIDEO.match(/data-seg-active=\{/g) ?? []).length).toBe(5);
  });
});

describe('§126-② 视频编辑：生成时长 = 官方静态「自适应」块', () => {
  it('官方 `D` 为假时渲染静态块（含 tabler `hourglass` 图标）', () => {
    expect(VIDEO).toContain('durationFollowsOfficialCatalog ? (');
    expect(VIDEO).toContain('className="tabler-icon tabler-icon-hourglass"');
    expect(VIDEO).toContain('M6 20v-2a6 6 0 1 1 12 0v2a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1z');
    expect(VIDEO).toContain('M6 4v2a6 6 0 1 0 12 0v-2a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1z');
  });

  it('比例组在目录 variant 没有 `aspectRatios` 时**不再回退 MTV 硬编码表**（高度 74 而非 86）', () => {
    expect(VIDEO).toContain('const officialVariantHasNoRatios = Boolean(catalogVideoInfo)');
    expect(VIDEO).toContain('const seedanceRatios = officialVariantHasNoRatios ? [] : seedanceRatiosRaw;');
  });

  it('面板宽度两档 = 官方 `U = D && durationControl==="slider"`（视频编辑 ⇒ 320）', () => {
    expect(VIDEO).toContain('const panelUsesSlider = showDurationControl');
    expect(VIDEO).toContain("&& Boolean(allowedDurations)");
    expect(VIDEO).toContain("&& OFFICIAL_SLIDER_DURATION_MODELS.includes(videoCatalogModelId ?? '');");
  });
});

describe('§126-③ 高级设置面板：挂载在底栏**下方**，内容盒 = 官方 `p-4 bg-muted/30`', () => {
  it('面板 JSX 出现在 `.prompt-footer` **之后**', () => {
    const footer = PANEL.indexOf('<div className="prompt-footer">');
    const advanced = PANEL.indexOf('data-testid="official-advanced-settings-panel"');
    expect(footer).toBeGreaterThan(0);
    expect(advanced).toBeGreaterThan(footer);
  });

  it('内容盒用官方 `p-4 bg-muted/30`，且**不再多包一层 `mb-3`**（高度 64 → 52）', () => {
    expect(PANEL).toContain('className="prompt-advanced-inner p-4 bg-muted/30"');
    expect(PANEL).toContain('{advancedSettings}');
    expect(PANEL).not.toContain('{advancedSettings && <div className="mb-3">');
  });
});

describe('§126-④⑤ switch 开/关两态 = 官方 shadcn `Switch` 逐字', () => {
  it('轨道/圆点类串逐字（`bg-primary` / `bg-zinc-800` / `bg-white` / `translate-x-4`）', () => {
    expect(DIALOG).toContain('data-[state=checked]:bg-primary');
    expect(DIALOG).toContain('data-[state=unchecked]:bg-zinc-800 data-[state=unchecked]:shadow-inner');
    expect(DIALOG).toContain('h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-xs transition-colors');
    expect(DIALOG).toContain('pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4');
    /* 改前的自造值只出现在解释性注释里（上面 §126 那段引用了旧类串）⇒ 断言「声明行」里不带它们 */
    const switchRoot = DIALOG.match(/className="peer inline-flex h-5 w-9[^"]*"/)?.[0] ?? '';
    expect(switchRoot).toContain('data-[state=unchecked]:bg-zinc-800');
    expect(switchRoot).not.toContain('bg-input');
  });
});

describe('§128 卡片本体随比例变 —— 官方 `wPe` 的写回那一步', () => {
  const NODE = readFileSync('src/components/nodes/VideoNode.tsx', 'utf8');
  it('比例取值优先用**实时** `seedanceRatio`，快照 `params.aspectRatio` 只兜底（改前顺序反了）', () => {
    expect(NODE).toContain('return officialVideoNodeBox(d?.seedanceRatio) ?? officialVideoNodeBox(params?.aspectRatio);');
  });
  it('按官方 `wPe` 把比例盒子**写回节点**（±1 容差逐字保留）', () => {
    expect(NODE).toContain('const ratioBox = officialNodeBox;');
    expect(NODE).toContain('if (Math.abs(curW - ratioBox.nodeWidth) <= 1 && Math.abs(curH - ratioBox.nodeHeight) <= 1) return;');
    expect(NODE).toContain('nodeWidth: ratioBox.nodeWidth,');
    expect(NODE).toContain('nodeHeight: ratioBox.nodeHeight,');
  });
  /* §130 官方 `uv`（@501355）的 position 规则：水平**中心线固定**、垂直**底边固定** */
  it('同时按官方 `uv` 改 position（`x += (oldW-newW)/2`、`y += oldH-newH`）——改前只改尺寸 ⇒「从左边变」', () => {
    expect(NODE).toContain('x: live.position.x + (curW - ratioBox.nodeWidth) / 2,');
    expect(NODE).toContain('y: live.position.y + (curH - ratioBox.nodeHeight),');
    expect(NODE).toContain('const updateNodePositionTransient = useAppStore((s) => s.updateNodePositionTransient);');
  });
});
