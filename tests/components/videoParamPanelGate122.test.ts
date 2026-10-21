/**
 * §121 表驱动验收（数据源 = `src/data/model-param-catalog.json`，**不写 UI 快照**）
 *
 * 官方依据（`D:\DEEPSEEK\live-assets-r100\vendor-pkg-canvas-DuoOicPr.js` @1868054–1873100 的 `Eoe`）：
 *   面板 = 7 组，**每组 = `<Ir title>` 包一个 `<ti>`**（或官方静态「自适应」块）：
 *     ①`V` 模式 `modes.length>0` ②`M` 生成方式 ③比例（**恒渲染**：有档位 `ti`，无档位静态块）
 *     ④清晰度 `F=i&&l&&l.length>0&&c` ⑤时长 `O=p&&m&&m.length>0&&f`（`U` ⇒ 滑杆 + 面板 400px）
 *     ⑥生成音频 `B=supportsAudio&&generateAudio!==void 0`（`ti options={["on","off"]}`）⑦极速 `G`
 *   **没有任何一组叫「模型默认」**（`Eoe` 四组全查无此项）。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface CatalogVariant {
  modelType?: string;
  options?: Record<string, unknown>;
  defaults?: Record<string, unknown>;
  aspectRatioPolicy?: string;
}
type CatalogEntry = { kind?: string; variants?: CatalogVariant[] };

const CATALOG = JSON.parse(readFileSync('src/data/model-param-catalog.json', 'utf8')) as Record<string, CatalogEntry>;
const VIDEO_SRC = readFileSync('src/components/nodes/shared/VideoParamSelector.tsx', 'utf8');
/** 负向断言必须先去掉注释 —— 源码注释里**引用了**官方那串白名单与组名（生成模式 / 极速模式 / 模型默认） */
const stripComments = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1');
const VIDEO = stripComments(VIDEO_SRC);

const videoEntries = Object.entries(CATALOG).filter(([, e]) => e.kind === 'video');
const modelsWith = (pick: (v: CatalogVariant) => boolean) =>
  videoEntries.filter(([, e]) => (e.variants ?? []).some(pick)).map(([id]) => id).sort();

describe('§121-A 「模式」组只允许 3 个模型', () => {
  it('目录里带 `variant.options.modes` 的模型恰好是那 3 个（数据面）', () => {
    expect(modelsWith((v) => Array.isArray(v.options?.modes) && (v.options.modes as unknown[]).length > 0))
      .toEqual(['kling-v3-pro', 'kling-video-o3', 'kling-video-o3-edit']);
  });

  it('MTV **完全不做**「模式」组（所以其余 52 个模型必然不渲染它）', () => {
    expect(VIDEO).not.toContain('生成模式');
    expect(VIDEO).not.toContain('videoConfigs.modeOptions');
  });
});

describe('§121-B 「极速」组只允许 wan3.0-video', () => {
  it('目录里 `supportsTurbo:true` 的模型只有 wan3.0-video（数据面）', () => {
    expect(modelsWith((v) => v.options?.supportsTurbo === true)).toEqual(['wan3.0-video']);
  });

  it('MTV **完全不做**「极速」组', () => {
    expect(VIDEO).not.toContain('极速模式');
    expect(VIDEO).not.toContain('turbo');
  });
});

describe('§121-C 音频组：门 + 控件类型', () => {
  it('目录里有 `defaults.generateAudio===true` 的模型非空（否则该组恒不渲染）', () => {
    expect(modelsWith((v) => v.defaults?.generateAudio === true).length).toBeGreaterThan(5);
  });

  it('渲染成 `开启/关闭` 的 segmented（官方 `ti options={["on","off"]}`），**不是下拉**', () => {
    expect(VIDEO).toContain('{showGenerateAudio && supportsAudio && (');
    expect(VIDEO).toContain("(['on', 'off'] as const)");
    expect(VIDEO).toContain("value === 'on' ? '开启' : '关闭'");
    const audioBlock = VIDEO.slice(VIDEO.indexOf('{showGenerateAudio && supportsAudio && ('));
    /* §126：分段轨道改用 `VideoSegmented`（默认 className 仍是 `img-rp-quality-segmented`），
       因为要在轨道里渲染官方那颗滑动指示块 `.img-rp-segmented-thumb`。 */
    expect(audioBlock.slice(0, 3000)).toContain('<VideoSegmented activeKey={generateAudio === true ? \'on\' : \'off\'}>');
    expect(audioBlock.slice(0, 3000)).toContain("data-seg-active={(generateAudio === true ? 'on' : 'off') === value}");
    expect(VIDEO_SRC).not.toContain("from '../../shared/Select'");
    expect(VIDEO).not.toContain('视频音频策略');
  });
});

describe('§121-D/E 比例与清晰度：空档位 ⇒ 官方静态「自适应」块（不补默认格）', () => {
  it('目录来源为真时**不再回退 MTV 硬编码档位表**', () => {
    expect(VIDEO).toContain('const catalogIsSource = !parameterCapability && Boolean(catalogVideoInfo);');
    expect(VIDEO).toContain('catalogIsSource || generalModel ? [] : SEEDANCE_RESOLUTIONS');
  });

  it('空态静态块两处都在（比例 + 清晰度），类串照官方', () => {
    const blocks = VIDEO.split('flex bg-input/40 rounded-lg p-0.5').length - 1;
    expect(blocks).toBeGreaterThanOrEqual(2);
    expect(VIDEO).toContain('img-rp-section-label');
  });

  it('目录里确实存在「无 aspectRatios」的视频模型（D 的反例数据）', () => {
    const noRatio = videoEntries.filter(([, e]) => (e.variants ?? []).length > 0
      && !(e.variants ?? []).some((v) => Array.isArray(v.options?.aspectRatios)));
    expect(noRatio.length).toBeGreaterThan(0);
  });
});

describe('§121-F 删除 MTV 自造的「模型默认」格', () => {
  it('面板源码里不再有「模型默认」', () => {
    expect(VIDEO).not.toContain('模型默认');
  });
});

describe('§121-G 时长：官方滑杆白名单 + 档位来自模型能力', () => {
  it('滑杆白名单 = 官方 `ese` @2067100 区那三个模型', () => {
    expect(VIDEO).toContain("const OFFICIAL_SLIDER_DURATION_MODELS: readonly string[] = ['seedance-2.5', 'seedance-2.5-draft', 'wan3.0', 'wan3.0-video'];");
    expect(VIDEO).toContain('OFFICIAL_SLIDER_DURATION_MODELS.includes(videoCatalogModelId');
  });

  it('非滑杆档用官方 `ti` 形态：`${H}s` / `-1 ⇒ 自动` / 每项 `min-w-8`', () => {
    expect(VIDEO).toContain("value === -1 ? '自动' : `${value}s`");
    expect(VIDEO).toContain('img-rp-quality-item ui-schema-option min-w-8');
  });
});

describe('§121-H / §122 无 variants 的模型 —— **按取证结论**断言（不再断言「不渲染任何组」）', () => {
  it('目录里确实存在 0 variant 的视频模型', () => {
    const none = videoEntries.filter(([, e]) => (e.variants ?? []).length === 0).map(([id]) => id);
    expect(none).toContain('seedance-2.5-draft');
    expect(none.length).toBeGreaterThan(0);
  });

  it('取证：这两个模型**在官方模型选择器里是可选的**（`mtt` @2243728 的 id 字面量数组 + 只按 `isHidden` 过滤）', () => {
    /* 官方 r100 @2243728 区逐字：
         `u=["seedance-2.0","seedance-2.0-mini","seedance-2.0-fast","seedance-2.5","seedance-2.5-draft",
             "minimax-h3","minimax-h3-max","wan-3.0","kling-video-o3","flux-3","gemini-omni-1.1-flash","happyhorse-1.1"]
            .map(p=>{const m=Let(p)??Hb(p);if(!m)return null;const f=Gp(m);if(!f||f.isHidden)return null;…})`
       ⇒ 列表是**硬编码 id 数组**，唯一过滤是「目录项缺失 / `isHidden`」；
       `seedance-2.5-draft`、`minimax-h3-max` 都在数组里（且二者 `isHidden` 均为 undefined）
       ⇒ **它们可以被选中**，所以 `Eoe` 一定会为它们渲染面板。 */
    const list = readFileSync('src/data/official-model-meta.json', 'utf8');
    const meta = JSON.parse(list) as { video?: Record<string, { modelId?: string }> };
    const ids = Object.keys(meta.video ?? {});
    expect(ids).toContain('minimax-h3-max');
    /* MTV 侧登记（未修）：`seedance-2.5-draft` 不在 MTV 的 picker meta 里 ⇒ MTV 根本选不到它 */
    expect(ids).not.toContain('seedance-2.5-draft');
  });

  it('取证：`Eoe` 里**比例/清晰度/时长三组是无条件渲染的**（只有内层控件按档位切换）⇒ 0-variant 模型渲染三个「自适应」静态块', () => {
    /* 官方 `Eoe` @1870648 / @1871200 / @1871960 区结构逐字：
         `s.jsx(Ir,{title:L("videoConfigs.aspectRatio"), children:t.length>0?<ti…>:<静态auto块>})`
         `s.jsx(Ir,{title:L("videoConfigs.resolution"), children:F?<ti…>:<静态auto块>})`
         `s.jsx(Ir,{title:L("videoConfigs.duration"), tooltip:x, children:O?…:<静态auto块>})`
       而模式/生成方式/音频/极速是 `V&&` / `M&&` / `B&&` / `G&&` 条件渲染
       ⇒ 0-variant 模型下：比例/清晰度/时长**仍在**，各渲染官方静态「自适应」块。
       ⇒ 因此 §121-H 原来的「任何参数组都不得渲染」**与 `Eoe` 原文冲突**，本条按原文钉住。 */
    expect(VIDEO).toContain('{showSeedanceRatio && (');
    expect(VIDEO).toMatch(/showResolutionControl \|\| seedanceResolutions\.length === 0/);
    const autoBlocks = VIDEO.split('flex bg-input/40 rounded-lg p-0.5').length - 1;
    expect(autoBlocks).toBeGreaterThanOrEqual(2);
  });
});

describe('§122 帧率组：官方此位置没有 ⇒ 从面板移除（能力保留、标未接入）', () => {
  it('帧率组默认不渲染（开关常量），且注释写明官方位置在放大表单', () => {
    expect(VIDEO).toContain('const SHOW_MTV_FRAME_RATE_CONTROL = false;');
    expect(VIDEO).toContain('{SHOW_MTV_FRAME_RATE_CONTROL && showFrameRateControl && (');
    /* 官方取证写在注释里（负向断言用的是去注释文本 ⇒ 这里查原文） */
    expect(VIDEO_SRC).toContain('video.upscaleForm.selectFrameRate');
    expect(VIDEO_SRC).toContain('frameRate.auto');
    expect(VIDEO_SRC).toContain('frameRate.90fps');
  });
});
