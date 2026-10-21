/**
 * `resolveDefaultMediaModelRef` —— 「媒体生成用哪个模型」的单一来源。
 *
 * 这条规则被**两个阶段共用**：审批卡（`agentRoundExecutor.prepareApprovalInput`）与
 * 真实请求（`tools/mediaTools.resolveMediaToolInput`）。两处必须给出同一个答案，
 * 否则会出现「卡上写 A、实际发 B」。
 *
 * 第 74 轮起本模块还承载同一件事的**参数**侧：`resolveDefaultMediaRequestParams`
 * （比例 / 清晰度 / 时长），逐字对标 `ai/generationRuntime.runMediaGeneration` 的决议点。
 *
 * 验证分级：**(b) jsdom/纯函数**（无外部依赖）。
 */
import { describe, expect, it } from 'vitest';
import {
  resolveDefaultMediaModelRef,
  resolveDefaultMediaRequestParams,
} from '../../../src/services/chat/mediaInputResolution';
import { getParamEntry, resolveExprList } from '../../../src/services/ai/modelParamCatalog';
import CATALOG_JSON from '../../../src/data/model-param-catalog.json';

describe('resolveDefaultMediaModelRef', () => {
  it('显式指定的模型优先于项目默认模型', () => {
    expect(resolveDefaultMediaModelRef({ defaultModels: { image: 'general/default' } }, 'image', 'general/explicit'))
      .toBe('general/explicit');
  });

  it('没有显式模型时用项目默认模型（按媒体类型取）', () => {
    const settings = { defaultModels: { image: 'general/img', video: 'general/vid' } };
    expect(resolveDefaultMediaModelRef(settings, 'image')).toBe('general/img');
    expect(resolveDefaultMediaModelRef(settings, 'video')).toBe('general/vid');
  });

  it('该类型没有默认模型 ⇒ undefined（调用方不写字段，不补默认值）', () => {
    expect(resolveDefaultMediaModelRef({ defaultModels: { text: 'gpt' } }, 'image')).toBeUndefined();
    expect(resolveDefaultMediaModelRef({ defaultModels: {} }, 'video')).toBeUndefined();
    expect(resolveDefaultMediaModelRef(undefined, 'audio')).toBeUndefined();
  });

  it('空白串一律视为「没有」（显式与默认两侧都要 trim 判定）', () => {
    expect(resolveDefaultMediaModelRef({ defaultModels: { image: 'general/default' } }, 'image', '   '))
      .toBe('general/default');
    expect(resolveDefaultMediaModelRef({ defaultModels: { image: '   ' } }, 'image')).toBeUndefined();
  });

  it('返回值做过 trim（卡上显示与请求上行必须逐字一致）', () => {
    expect(resolveDefaultMediaModelRef(undefined, 'image', '  general/x  ')).toBe('general/x');
    expect(resolveDefaultMediaModelRef({ defaultModels: { image: '  general/y ' } }, 'image')).toBe('general/y');
  });
});

describe('resolveDefaultMediaRequestParams', () => {
  const imageSettings = {
    defaultModels: { image: 'general/img' },
    generation: { imageAspectRatio: '3:4', imageSize: '1K' },
  };

  it('图片：比例 / 清晰度取项目设置（与 `applyProjectDefaultsToNodeData` 同一份 settings）', () => {
    expect(resolveDefaultMediaRequestParams(imageSettings, 'image')).toEqual({
      aspectRatio: '3:4',
      imageSize: '1K',
    });
  });

  it('图片：项目没设、**连模型都没有** ⇒ 比例与清晰度都不填（round 122 用户裁决①：无来源绝不伪造）', () => {
    /* round 122 之前这里是 `{aspectRatio:'1:1', imageSize:'2K'}`（常量兜底）——
       **用户裁决判定那是真 bug**：给 `nano-banana-flash-lite`（只支持 `["1K"]`）硬填 `2K`
       就是发它不支持的值。现在没有来源就不写该字段（卡片也不渲染该 chip）。
       「没有模型」⇒ 目录 `defaults` 那一级也无从谈起 ⇒ 两个值都不填。 */
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image')).toEqual({});
    expect(resolveDefaultMediaRequestParams(undefined, 'image')).toEqual({});
  });

  /**
   * **用户 2026-10-15 裁决：卡上显示的参数必须来自用户指令/请求**。
   *
   * 旧口径（本条原先钉住的）是「图片**忽略**工具入参的 aspectRatio」——它直接造成了用户现场：
   * 「我给 agent 下达『在画布上生成一只 3:4 的可爱的小猫』，卡上比例却是 **1:1**」。
   * 现在与视频分支（@81-88）**同一优先级**：请求显式值 > 项目默认 > 目录默认 > 不填。
   */
  it('图片：**显式入参优先** —— 用户说了 3:4 就必须是 3:4（用户 2026-10-15 裁决）', () => {
    expect(resolveDefaultMediaRequestParams(imageSettings, 'image', { aspectRatio: '3:4' }))
      .toEqual({ aspectRatio: '3:4', imageSize: '1K' });
    /* 项目**没设**图片默认时同样成立（用户 6 个项目 `settings.generation` 全为 null 的真实形状）。 */
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', { aspectRatio: '3:4' }))
      .toEqual({ aspectRatio: '3:4' });
  });

  it('图片：清晰度三级 = 项目默认 > 模型目录默认 > 不填；比例同链（round 122 用户裁决①）', () => {
    /* 模型目录默认：`nano-banana-flash-lite` 只支持 `["1K"]`、默认 `1K` ⇒ **绝不能是 2K**；
       它的比例默认是目录里写的 `"Auto"`（`aspectRatios` 数组里第一个也是 `"Auto"`）。 */
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: 'nano-banana-flash-lite' }))
      .toEqual({ aspectRatio: 'Auto', imageSize: '1K' });
    /* `doubao-seedream-5.0-lite` 目录默认恰好是 `2K`（用户那次**碰巧**撞对）。 */
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: 'doubao-seedream-5.0-lite' }))
      .toEqual({ aspectRatio: '1:1', imageSize: '2K' });
    /* 项目默认优先于目录默认。 */
    expect(resolveDefaultMediaRequestParams(imageSettings, 'image', {}, { modelId: 'nano-banana-flash-lite' }))
      .toEqual({ aspectRatio: '3:4', imageSize: '1K' });
    /* 目录里**没有** `defaults.imageSize` 的模型 ⇒ 清晰度不填，但比例**照旧**取目录默认
       （`reve-2.1` 的 `defaults` 是 `{aspectRatio:"Auto",outputFormat:"png"}`）——两者同一份来源、互不牵连。 */
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: 'reve-2.1' }))
      .toEqual({ aspectRatio: 'Auto' });
    /* 目录外模型（自接 provider）⇒ 两个值都没有来源 ⇒ 都不填。 */
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: 'general/whatever' }))
      .toEqual({});
  });

  it('图片：显式入参 > 项目默认 > 目录默认 > 不填（逐级回落，末级不伪造）', () => {
    expect(resolveDefaultMediaRequestParams(imageSettings, 'image', { aspectRatio: '9:16' }).aspectRatio).toBe('9:16');
    expect(resolveDefaultMediaRequestParams(imageSettings, 'image', {}).aspectRatio).toBe('3:4');
    /* 目录默认级：`doubao-seedream-4.5` 的 `defaults.aspectRatio` 是 `"16:9"`。 */
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: 'doubao-seedream-4.5' }).aspectRatio)
      .toBe('16:9');
    /* **末级 = 不填**（第 65 轮那条 `toBe('1:1')` 已被 round 122 用户裁决推翻）。 */
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}).aspectRatio).toBeUndefined();
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: 'general/whatever' }).aspectRatio)
      .toBeUndefined();
  });

  it('图片：空白串的显式入参一律视为「没有」⇒ 回落项目默认', () => {
    expect(resolveDefaultMediaRequestParams(imageSettings, 'image', { aspectRatio: '   ' }).aspectRatio).toBe('3:4');
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', { aspectRatio: ' 3:4 ' }).aspectRatio).toBe('3:4');
  });

  it('音频：没有任何参数来源 ⇒ 空对象', () => {
    expect(resolveDefaultMediaRequestParams(imageSettings, 'audio')).toEqual({});
  });

  it('视频：显式入参 > 项目设置（`intent.x ?? settings.x` 逐字）', () => {
    const settings = {
      defaultModels: { video: 'apimart/seedance' },
      generation: { videoAspectRatio: '16:9', videoResolution: '1080p', videoDuration: 5 },
    };
    expect(resolveDefaultMediaRequestParams(settings, 'video', { aspectRatio: '9:16', duration: 8 }))
      .toEqual({ aspectRatio: '9:16', resolution: '1080p', duration: 8 });
  });

  it('视频：`general` / `runninghub`（无 workflowId）/ `workflow-api` ⇒ 不套项目设置（`directGeneralProtocol`）', () => {
    const settings = { generation: { videoAspectRatio: '16:9', videoResolution: '1080p', videoDuration: 5 } };
    for (const provider of ['general', 'runninghub', 'workflow-api']) {
      expect(resolveDefaultMediaRequestParams(settings, 'video', {}, { provider })).toEqual({});
    }
  });

  it('视频：`runninghub` **带** workflowId ⇒ 按 `runMediaGeneration` 的判定套项目设置（MTV 内部口径不一致，已登记）', () => {
    const settings = { generation: { videoAspectRatio: '16:9', videoResolution: '1080p', videoDuration: 5 } };
    expect(resolveDefaultMediaRequestParams(settings, 'video', {}, { provider: 'runninghub', workflowId: 'wf-1' }))
      .toEqual({ aspectRatio: '16:9', resolution: '1080p', duration: 5 });
  });

  it('视频：没有显式、项目也没设 ⇒ 空对象（不补默认值）', () => {
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'video')).toEqual({});
    expect(resolveDefaultMediaRequestParams(undefined, 'video', {})).toEqual({});
  });

  it('空白串一律视为「没有」；返回的字符串都做过 trim', () => {
    expect(resolveDefaultMediaRequestParams({ generation: { videoAspectRatio: '   ' } }, 'video')).toEqual({});
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'video', { aspectRatio: '  16:9  ' }))
      .toEqual({ aspectRatio: '16:9' });
  });

  it('非有限数字的 duration 一律丢弃', () => {
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'video', { duration: Number.NaN })).toEqual({});
    expect(resolveDefaultMediaRequestParams({ generation: {} }, 'video', { duration: Number.POSITIVE_INFINITY }))
      .toEqual({});
  });

  /* ── round 122（用户裁决①）：**表驱动读目录 JSON**，不写死 `2K` ── */
  describe('图片清晰度兜底 = 读目录 `defaults.imageSize`（表驱动，读真 JSON）', () => {
    const catalog = CATALOG_JSON as unknown as Record<string, {
      kind?: string;
      aspectRatios?: unknown;
      imageSizeOptions?: unknown;
      defaults?: Record<string, unknown>;
    }>;
    /** 与 `catalogImageSizeDefault` 同一份求值路径，用来算「这个模型此刻有没有可选项」。 */
    const optionsFor = (entry: { imageSizeOptions?: unknown; defaults?: Record<string, unknown> }, ratio: string) => {
      const list = resolveExprList<string>(
        entry.imageSizeOptions as never,
        { defaults: entry.defaults ?? {}, modelType: undefined },
        { aspectRatio: ratio },
        false,
      );
      return Array.isArray(list) ? list.map(String) : [];
    };
    const imageIds = Object.entries(catalog).filter(([, e]) => e.kind === 'image').map(([id]) => id);
    const withDefault = imageIds.filter((id) => typeof catalog[id].defaults?.imageSize === 'string');
    const withoutDefault = imageIds.filter((id) => typeof catalog[id].defaults?.imageSize !== 'string');

    it('目录里图片模型确实分成「有 defaults.imageSize」与「没有」两拨（16 / 14）', () => {
      expect(imageIds.length).toBeGreaterThan(20);
      expect(withDefault.length).toBe(16);
      expect(withoutDefault.length).toBe(14);
    });

    it('30/30 图片模型都声明了 `defaults.aspectRatio`，且该值在它自己的 `aspectRatios` 里', () => {
      /* 这是 `catalogImageAspectRatioDefault` 那道门的**数据前提**：目录改坏时这里先红。 */
      expect(imageIds.length).toBe(30);
      for (const id of imageIds) {
        const value = catalog[id].defaults?.aspectRatio;
        expect(typeof value).toBe('string');
        expect(Array.isArray(catalog[id].aspectRatios)).toBe(true);
        expect(catalog[id].aspectRatios as string[]).toContain(value);
      }
    });

    it.each(withDefault)('`%s`：拿得到目录默认值（且该值确实在它的可选项里）', (id) => {
      const expected = String(catalog[id].defaults!.imageSize);
      expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: id }).imageSize)
        .toBe(expected);
      expect(optionsFor(catalog[id], '1:1')).toContain(expected);
    });

    it.each(withoutDefault)('`%s`：目录没声明 `imageSize` ⇒ **清晰度不填**；比例仍取目录 `defaults.aspectRatio`', (id) => {
      /**
       * 两条**互不牵连**的同一份目录来源：
       * - `imageSize`：这 14 个模型 `defaults.imageSize` 不存在 ⇒ **不写该字段、不渲染该 chip**
       *   （旧硬编码 `2K` 对它们是「发不支持的值」）；
       * - `aspectRatio`：目录 **30/30** 图片模型都声明了 `defaults.aspectRatio`
       *   （`"Auto"` / `"Auto(4K)"` / `"16:9"` / `"1:1"`），所以这一档**有**值可取。
       */
      const resolved = resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: id });
      expect(resolved.imageSize).toBeUndefined();
      expect(resolved).not.toHaveProperty('imageSize');
      const ratioDefault = catalog[id].defaults?.aspectRatio;
      if (typeof ratioDefault === 'string') {
        expect(resolved.aspectRatio).toBe(ratioDefault);
      } else {
        expect(resolved.aspectRatio).toBeUndefined();
      }
    });

    it('`nano-banana-flash-lite` 只支持 `["1K"]` ⇒ 得到 `1K` 而**不是**旧的硬编码 `2K`', () => {
      const entry = getParamEntry('nano-banana-flash-lite');
      expect(entry).toBeDefined();
      expect(entry!.imageSizeOptions).toEqual(['1K']);
      expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: 'nano-banana-flash-lite' }).imageSize)
        .toBe('1K');
      expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: 'nano-banana-flash-lite' }).imageSize)
        .not.toBe('2K');
    });

    it('`$expr` 型 `imageSizeOptions`：`aspectRatio==="auto"` ⇒ 空列表 ⇒ 不填', () => {
      /* `gpt-image-2.5-*` / `gpt-image-2` 的 `$expr` 逐字：`({aspectRatio})=>aspectRatio==="auto"?[]:["1K","2K","4K"]`。 */
      for (const id of ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'gpt-image-2']) {
        expect(optionsFor(catalog[id], 'auto')).toEqual([]);
        expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', { aspectRatio: 'auto' }, { modelId: id }).imageSize)
          .toBeUndefined();
        /* 非 auto ⇒ 有选项 ⇒ 取目录默认 `1K`。 */
        expect(resolveDefaultMediaRequestParams({ generation: {} }, 'image', {}, { modelId: id }).imageSize).toBe('1K');
      }
    });
  });
});
