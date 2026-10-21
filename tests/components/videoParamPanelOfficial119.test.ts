/**
 * §119 回归 —— 视频参数面板与底栏的「按官方」取值钉桩。
 *
 * 官方依据（`D:\DEEPSEEK\live-assets-r100\vendor-pkg-canvas-DuoOicPr.js`）：
 *  · 面板外层 @1868800 区：`${U?"w-[400px]":"w-[320px]"} p-1 rounded-[20px]
 *      shadow-[0px_4px_16px_rgba(0,0,0,0.16),inset_0px_0.5px_0px_rgba(255,255,255,0.16)]
 *      [background:rgba(51,51,51,0.80)] [backdrop-filter:blur(28px)]`
 *  · 分段控件 `ti` @1225800 区：容器 `relative flex bg-input/40 rounded-lg p-0.5`；
 *      项 `relative z-10 flex flex-1 items-center justify-center px-2 py-1.5 rounded-md text-sm transition-colors duration-200`
 *  · 同一个 `ti` **图像面板与视频面板共用**（图像 @1860009/@1860172/@1860977…；视频 @1869635…）
 *  · 面板七组顺序：生成模式 · 生成方式 · 比例 · 清晰度 · 生成时长 · 生成音频 · 极速模式
 *  · 官方真机（CDP 9222）实测：面板 320×452 / r20 / rgba(51,51,51,.8) / blur(28px) / pad 4；
 *      `ti` 容器 296×36 / flex / r12 / pad 2；项 97.3×32 / flex / r10 / pad 6px 8px / 14px / rgb(122,122,122)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');
const CSS = 'src/styles/quality-ratio.css';
const VIDEO = 'src/components/nodes/shared/VideoParamSelector.tsx';
const PANEL = 'src/components/nodes/shared/PromptPanel.tsx';

describe('§119 视频参数面板 = 官方 `ti`（不再给视频单独换皮）', () => {
  it('MTV 自造的 `.rh-video-resolution-seg` grid/11px 覆盖已删除；自定义输入那组自带 grid', () => {
    const css = read(CSS);
    /* 覆盖被删干净：不能再有「.rh-video-resolution-seg」规则体 */
    expect(css.includes('.rh-video-resolution-seg {')).toBe(false);
    expect(css.includes('.rh-video-resolution-seg .img-rp-quality-item')).toBe(false);
    /* 但「像素分辨率 + 自定义输入」那组依赖网格列 ⇒ 必须自带 display:grid */
    expect(css).toContain('.rh-res-seg-with-custom {');
    const block = css.slice(css.indexOf('.rh-res-seg-with-custom {'));
    expect(block.slice(0, 120)).toContain('display: grid');
    expect(block.slice(0, 120)).toContain('grid-template-columns: repeat(5, 1fr)');
  });

  it('基类保持官方 `ti` 取值（flex · r12 · pad2 · item 14px/6px 8px/r10 · 居中）', () => {
    const css = read(CSS);
    const seg = css.slice(css.indexOf('.img-rp-quality-segmented {'));
    expect(seg.slice(0, 400)).toContain('display: flex');
    expect(seg.slice(0, 400)).toContain('border-radius: 12px');
    expect(seg.slice(0, 400)).toContain('padding: 2px');
    const item = css.slice(css.indexOf('.img-rp-quality-item {'));
    expect(item.slice(0, 400)).toContain('display: flex');
    expect(item.slice(0, 400)).toContain('align-items: center');
    expect(item.slice(0, 400)).toContain('justify-content: center');
    expect(item.slice(0, 2200)).toContain('padding: 6px 8px');
    expect(item.slice(0, 2200)).toContain('font-size: 14px');
    expect(item.slice(0, 2200)).toContain('border-radius: 10px');
    /* §124 官方项按钮**没有** `height` 工具类（高度 = py-1.5 + 内容高）⇒ MTV 必须是 `min-height: 32px`，
       否则比例项（14 图标 + gap 2 + 16 文字 = 32 内容）会被压成 32 高 ⇒ 上下溢出（用户截图那行）。 */
    expect(item.slice(0, 2200)).toContain('min-height: 32px');
    expect(item.slice(0, 2200)).toContain('height: auto;');
    /* 声明块里不许再出现写死的 `height: 32px;`（上面注释里引用的那句不算 ⇒ 只看带缩进的声明行） */
    expect(item.slice(0, 2200)).not.toMatch(/\n\s+height: 32px;/);
  });

  it('面板宽度两档：320（默认）+ 400（时长滑杆档，`data-video-params-slider`）', () => {
    const css = read(CSS);
    expect(css).toContain('.ui-schema-video-params-popup {');
    expect(css).toContain("width: 320px");
    expect(css).toContain(".ui-schema-video-params-popup[data-video-params-slider='true']");
    expect(css).toContain('width: 400px');
    const tsx = read(VIDEO);
    expect(tsx).toContain('panelUsesSlider');
    expect(tsx).toContain("data-video-params-slider={panelUsesSlider ? 'true' : undefined}");
  });
});

describe('§119 面板分组 = 官方七组（MTV 自造的两组关掉 UI、保留能力）', () => {
  it('参考帧/参考角色的开关常量存在且为 false（用户 2026-10-15 裁决：只关 UI、勿删能力）', () => {
    const tsx = read(VIDEO);
    expect(tsx).toContain('const SHOW_MTV_REFERENCE_PICKERS = false;');
    expect(tsx).toContain('{SHOW_MTV_REFERENCE_PICKERS && onChangeVideoReferences');
    /* 裁决语句必须在注释里，防下一轮误删 */
    expect(tsx).toContain('只关 UI、保留能力');
  });

  it('四个组标题 = 官方 zh 逐字（比例 / 清晰度 / 生成时长 / 生成音频）', () => {
    const tsx = read(VIDEO);
    /* §124 官方 `Ir` 的 `title` 就是一个文本子节点（不是 span）：`s.jsxs("div",{className:"…px-1",children:[e,…]})`
       ⇒ MTV 的「生成时长」标题不再用 `<span>` 包（原来那颗 `!` 也一并删掉：官方该标题 `titleSvg=none`）。 */
    expect(tsx).toContain('生成时长\n');
    expect(tsx).toContain('<span>生成音频</span>');
    /* 组标题在 `.img-rp-section-label` 里（后面紧跟 `!` 提示图标 ⇒ 不能断言 `>比例<`） */
    expect(tsx).toMatch(/img-rp-section-label">\s*比例/);
    expect(tsx).toMatch(/img-rp-section-label">\s*清晰度/);
    /* 自造标题不许回归：`生成时长` 只应有 1 处（本地工作流 ComfyUI/RunningHub 那一支，
       官方视频面板没有这一组 ⇒ 保留 MTV 自有命名），Seedance/官方那一支必须是「生成时长」。 */
    const legacyDuration = tsx.split('<span>生成时长（秒）</span>').length - 1;
    expect(legacyDuration).toBe(1);
    expect(tsx).not.toContain('<span>生成有声视频</span>');
    /* 官方视频面板没有「宽高比」这个标题（=「比例」）⇒ 不许回归；
       ⚠️ 「分辨率」在 MTV 的**本地工作流**那一支（ComfyUI/RunningHub 像素分辨率）仍在 ⇒ 不做全局否定断言。 */
    expect(tsx).not.toMatch(/img-rp-section-label">\s*宽高比/);
  });

  it('比例段**恒渲染**（不再挂在 showRatioControl 后面），空档位走官方「自适应」静态块', () => {
    const tsx = read(VIDEO);
    /* 恒渲染的门 = showSeedanceRatio；老的 `{showRatioControl && (` 形态不许回来 */
    expect(tsx).toContain('{showSeedanceRatio && (');
    expect(tsx).not.toContain('{showRatioControl && (');
    expect(tsx).toContain('flex bg-input/40 rounded-lg p-0.5');
  });
});

describe('§119 底栏价格段：视频卡也接上 MTV 本地积分预估', () => {
  it('CreditEstimateBadge 的门包含 ai-video，并按视频传清晰度档', () => {
    const tsx = read(PANEL);
    expect(tsx).toContain("(nodeType === 'ai-image' || nodeType === 'ai-video') && (");
    expect(tsx).toContain("imageSize={nodeType === 'ai-video' ? seedanceResolution : imageSize}");
    /* 必须有「MTV 有本地积分预估」的更正说明（防再写出「无计费数据源」的错话） */
    expect(tsx).toContain('MTV 的计费链在本仓是完整的');
  });

  it('数量选择器（官方 `Bee` / `1×`）在视频卡也启用', () => {
    const tsx = read(PANEL);
    expect(tsx).toContain("(nodeType === 'ai-image' || nodeType === 'ai-video' || textTimesControl)");
  });
});
