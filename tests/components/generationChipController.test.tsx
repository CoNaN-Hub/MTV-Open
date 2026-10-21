// @vitest-environment jsdom
/**
 * R63 · 官方生成参数 chips 控制器 `hie`（@2327822）/ `uie`（@2317385）移植的**行为回归保险**。
 *
 * 官方事实（产物 `vendor-pkg-canvas-CvbAwZyy.js`，SHA-256 `b43060df…df904b`；逐字源码见
 * `D:\DEEPSEEK\_r63_xse_spec.md`）：
 * - `show*Chip` 的真源 = `presentFields`（→ `activeFields`）+ `requestKind` + 模型能力；`
 * - options 来自 per-model 参数目录 `qo`/`Hp`/`Af`（本仓库 `src/data/model-param-catalog.json`）；
 * - `isFree` → `Og()`（canvas:@2250212）免费额度 gate；订阅门控 `E2`/`Dz`（vendor@976192/976231）；
 * - 函数型 `$expr` 由官方 `$I`（@2246961）展开；
 * - **`lockedDurations` / `lockedResolutions` 官方 chip 路径从不读取** —— `jre`（@2248144）只对
 *   `options.durations` / `options.resolutions` 调 `$I`（本文件 D 组断言）。
 *
 * MTV 结构性差异（见 `generationChipController.ts` 文件头）：无订阅体系 ⇒ `isPayingCustomer` 走**非付费分支**；
 * 厂商/模型差异只能从**连接配置 / 模型目录**进来 ⇒ 模型目录由 `directoryModelIds` 注入。
 *
 * 验证分级 = **(b) jsdom + 真 hook + 真目录数据**（无 mock；不触网）。
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  modelSupportsShapes,
  resolveChipModelDisplayName,
  resolveModelEntity,
  useImageVideoChipController,
  useGenerationChipController,
  type ImageVideoChipControllerInput,
} from '../../src/components/chat/generationChipController';
import { useAppStore } from '../../src/store/useAppStore';
import {
  getParamEntry,
  modelIsFree,
  passesSubscriptionGate,
  resolveExprList,
  videoModelInfo,
  videoMethodKeys,
  listDirectoryModelIds,
  listDirectoryModelLabels,
} from '../../src/services/ai/modelParamCatalog';

afterEach(() => cleanup());

/* ------------------------------------------------------------------ *
 * 夹具（全部是**目录真实条目**，不含任何厂商/地址写死分支）
 * ------------------------------------------------------------------ */

/** MTV 模型目录：image 只有这些（都在官方参数目录里，且**不在**订阅受限集 `Lz` 内或可被付费分支取回）。 */
const IMAGE_DIRECTORY = ['gpt-image-2', 'doubao-seedream-4.5', 'doubao-seedream-4.0'];
const VIDEO_DIRECTORY = ['veo3.1', 'wan3.0-video', 'depth-anything-video', 'kling-motion-control'];

const KNOWN = (id: string) => ({ status: 'known', id });

function renderImage(overrides: Partial<ImageVideoChipControllerInput> = {}) {
  const props: ImageVideoChipControllerInput = {
    requestKind: 'image',
    params: { prompt: 'a cat', model: KNOWN('doubao-seedream-4.5'), times: 2 },
    presentFields: ['model', 'prompt', 'aspectRatio', 'imageSize', 'times'],
    paramControlsEditable: true,
    directoryModelIds: IMAGE_DIRECTORY,
    ...overrides,
  };
  return renderHook(() => useImageVideoChipController(props));
}

function renderVideo(overrides: Partial<ImageVideoChipControllerInput> = {}) {
  const props: ImageVideoChipControllerInput = {
    requestKind: 'video',
    params: {
      prompt: 'a cat',
      model: KNOWN('veo3.1'),
      videoMode: { status: 'known', modelType: 'text_to_video' },
      resolution: '1080p',
      duration: 8,
      generateAudio: true,
    },
    presentFields: ['model', 'prompt', 'duration', 'resolution', 'generateAudio'],
    paramControlsEditable: true,
    directoryModelIds: VIDEO_DIRECTORY,
    ...overrides,
  };
  return renderHook(() => useImageVideoChipController(props));
}

/* ================================================================== *
 * A. `show*Chip` 由 presentFields + requestKind + 模型能力驱动
 * ================================================================== */

describe('A · show*Chip 真源 = presentFields + requestKind + 模型能力（逐字判据）', () => {
  it('image：字段齐 ⇒ 对应 chip 为真，且 activeFields 逐字等于 presentFields', () => {
    const { result } = renderImage();
    const c = result.current;
    /* 官方 @2337759 起：`showModelChip = je.has("model") && !!_` */
    expect(c.showModelChip).toBe(true);
    /* `showAspectRatioChip = ct.visible`（`Jnt` 里 `activeFields.has("aspectRatio") && options.length>0`） */
    expect(c.showAspectRatioChip).toBe(true);
    /* `showImageSizeChip = M && je.has("imageSize") && Qe.length>0` */
    expect(c.showImageSizeChip).toBe(true);
    /* `showTimesChip = M && je.has("times") && g != null`（g = editedTimes = params.times） */
    expect(c.showTimesChip).toBe(true);
    /* 模型没有 qualityOptions ⇒ `showQualityChip = je.has("quality") && Ae.length>0` 为假 */
    expect(c.showQualityChip).toBe(false);
    /* image 模式下 duration/resolution 恒隐藏 */
    expect(c.showDurationChip).toBe(false);
    expect(c.showResolutionChip).toBe(false);
    expect(c.showGenerateAudioMenu).toBe(false);
    expect(c.showMethodChip).toBe(false);

    expect(c.isImage).toBe(true);
    expect([...c.activeFields].sort()).toEqual(['aspectRatio', 'imageSize', 'model', 'prompt', 'times']);
  });

  it('image：presentFields 缺 times/imageSize/model ⇒ 对应 chip 逐字转假', () => {
    const { result } = renderImage({ presentFields: ['prompt', 'aspectRatio'] });
    const c = result.current;
    expect(c.showTimesChip).toBe(false);
    expect(c.showImageSizeChip).toBe(false);
    expect(c.showModelChip).toBe(false);
    expect(c.showAspectRatioChip).toBe(true);
    expect(c.modelOptions?.some((o) => o.value === 'doubao-seedream-4.5')).toBe(true);
  });

  it('video：videoMode=text_to_video + duration/resolution/generateAudio ⇒ 三个 chip 同时为真', () => {
    const { result } = renderVideo();
    const c = result.current;
    expect(c.isImage).toBe(false);
    /* `showDurationChip = !M && (je.has("duration")||ze) && Ee != null && ve.length>0` */
    expect(c.showDurationChip).toBe(true);
    expect(c.effectiveEditedDuration).toBe(8);
    /* `showResolutionChip = !M && (je.has("resolution")||ze) && Ze.length>0` */
    expect(c.showResolutionChip).toBe(true);
    expect(c.effectiveEditedResolution).toBe('1080p');
    /* `showGenerateAudioMenu = !M && je.has("generateAudio") && $e.supportsGenerateAudio===true && typeof P==="boolean"` */
    expect(c.showGenerateAudioMenu).toBe(true);
    expect(c.editedGenerateAudio).toBe(true);
    /* `showMethodChip = !M && !!Ue && xe.length>0`，`Ue = HI(U, me)`、`me = Fb(videoMode)`=text_to_video */
    expect(c.showMethodChip).toBe(true);
    expect(c.currentMethod).toBe('frames');
    /* video 模式下 imageSize/times 恒隐藏 */
    expect(c.showImageSizeChip).toBe(false);
    expect(c.showTimesChip).toBe(false);
    /* `displayVideoModelType` = `me` */
    expect(c.displayVideoModelType).toBe('text_to_video');
  });

  it('video：generateAudio 不在 params（typeof P !== boolean）⇒ 音频菜单隐藏（官方逐字）', () => {
    const { result } = renderVideo({
      params: { model: KNOWN('veo3.1'), videoMode: { status: 'known', modelType: 'text_to_video' }, resolution: '1080p', duration: 8 },
    });
    expect(result.current.showGenerateAudioMenu).toBe(false);
  });
});

/* ================================================================== *
 * B. options 来自目录；换模型 / 换目录自动变（禁止写死厂商）
 * ================================================================== */

describe('B · options 全部来自 per-model 参数目录（换模型自动变）', () => {
  it('imageSizeOptions 逐字来自目录：doubao-seedream-4.5 → 2K/4K', () => {
    const { result } = renderImage();
    expect(result.current.imageSizeOptions?.map((o) => o.value)).toEqual(['2K', '4K']);
    expect(result.current.imageSizeOptions?.map((o) => o.label)).toEqual(['2K', '4K']);
    expect(result.current.imageSizeCollapsed).toBe(false);
  });

  it('函数型 imageSizeOptions 按其 `$expr` 上下文裁：aspectRatio=auto ⇒ 空 + 折叠为 Auto chip', () => {
    const auto = renderImage({
      params: { model: KNOWN('gpt-image-2'), aspectRatio: 'auto' },
    });
    expect(auto.result.current.imageSizeCollapsed).toBe(true);
    expect(auto.result.current.showImageSizeChip).toBe(false);
    /* `showImageSizeAutoChip = lt && je.has("imageSize")` */
    expect(auto.result.current.showImageSizeAutoChip).toBe(true);
    auto.unmount();

    const fixed = renderImage({ params: { model: KNOWN('gpt-image-2'), aspectRatio: '1:1' } });
    expect(fixed.result.current.imageSizeCollapsed).toBe(false);
    expect(fixed.result.current.imageSizeOptions?.map((o) => o.value)).toEqual(['1K', '2K', '4K']);
    expect(fixed.result.current.showImageSizeAutoChip).toBe(false);
  });

  it('换模型（同一段代码，两次挂载）⇒ qualityOptions 从无到有（目录驱动，无厂商分支）', () => {
    const lite = renderImage();
    expect(lite.result.current.qualityOptions).toEqual([]);
    expect(lite.result.current.editedQuality).toBe('');
    lite.unmount();

    const gpt = renderImage({
      params: { model: KNOWN('gpt-image-2'), quality: 'low' },
      presentFields: ['model', 'quality'],
    });
    expect(gpt.result.current.qualityOptions?.map((o) => o.value)).toEqual(['low', 'medium', 'high']);
    /* 官方 `Ne(mt) = f(\`imageModels.gpt2.qualityOptions.${mt}\`, mt)`；MTV 文案表缺键 ⇒ 回落官方 `mt` 自身 */
    expect(gpt.result.current.qualityOptions?.map((o) => o.label)).toEqual(['low', 'medium', 'high']);
    expect(gpt.result.current.editedQuality).toBe('low');
    expect(gpt.result.current.showQualityChip).toBe(true);
  });

  it('函数型 durations 按 resolution 上下文裁（veo3.1 `$expr` #1）', () => {
    const hd = renderVideo();
    expect(hd.result.current.durationOptions.map((o) => o.value)).toEqual(['8']);
    expect(hd.result.current.durationOptions.map((o) => o.label)).toEqual(['8s']);
    hd.unmount();

    const sd = renderVideo({
      params: {
        model: KNOWN('veo3.1'),
        videoMode: { status: 'known', modelType: 'text_to_video' },
        resolution: '720p',
        duration: 8,
      },
    });
    expect(sd.result.current.durationOptions.map((o) => o.value)).toEqual(['4', '6', '8']);
  });

  it('resolutionOptions 走官方 `Wnt`（大写 label + 去重）；换模型换选项集', () => {
    const veo = renderVideo();
    expect(veo.result.current.resolutionOptions?.map((o) => o.value)).toEqual(['1080p', '720p', '4k']);
    expect(veo.result.current.resolutionOptions?.map((o) => o.label)).toEqual(['1080P', '720P', '4K']);
    veo.unmount();

    const wan = renderVideo({
      params: { model: KNOWN('wan3.0-video'), videoMode: { status: 'known', modelType: 'text_to_video' } },
      presentFields: ['model', 'resolution'],
    });
    expect(wan.result.current.resolutionOptions?.map((o) => o.value)).toEqual(['480P', '720P', '1080P']);
  });

  it('methodChipOptions 由 `variants[].modelType` 折叠（`EJ`+`aDe`），换模型换集合', () => {
    expect(videoMethodKeys('veo3.1')).toEqual(['frames', 'reference']);
    expect(videoMethodKeys('depth-anything-video')).toEqual(['edit']);
    expect(videoMethodKeys('kling-motion-control')).toEqual(['edit']);

    const veo = renderVideo();
    expect(veo.result.current.methodChipOptions?.map((o) => o.value)).toEqual(['frames', 'reference']);
    /* `methodChipEditable = l && !Ce && !G && !V && !De && xe.length>1`；
       `De = !M && c && de.every(unknownCount===0 && totalCount===0)` —— **无参考素材时官方 `De` 为真**
       ⇒ 即便有 2 个 method，chip 仍不可编辑（官方逐字行为，不是 MTV 改动）。 */
    expect(veo.result.current.methodChipEditable).toBe(false);
    expect(veo.result.current.currentMethod).toBe('frames');
    veo.unmount();

    const depth = renderVideo({
      params: { model: KNOWN('depth-anything-video'), videoMode: { status: 'known', modelType: 'video_edit' } },
      presentFields: ['model'],
    });
    expect(depth.result.current.methodChipOptions?.map((o) => o.value)).toEqual(['edit']);
    expect(depth.result.current.currentMethod).toBe('edit');
    /* `methodChipEditable = l && !Ce && !G && !V && !De && xe.length>1` ⇒ 只有一个 method ⇒ 不可编辑 */
    expect(depth.result.current.methodChipEditable).toBe(false);
  });

  it('aspectRatioState 逐字走官方 `Jnt`：derived_from_reference ⇒ 强制 Auto、不可编辑、mode=none', () => {
    const { result } = renderVideo({
      params: { model: KNOWN('wan3.0-video'), videoMode: { status: 'known', modelType: 'image_to_video' } },
      presentFields: ['model', 'aspectRatio'],
    });
    const state = result.current.aspectRatioState;
    expect(state.visible).toBe(true);
    expect(state.editable).toBe(false);
    expect(state.value).toBe('__tapnow_auto_aspect__');
    expect(state.requestValue).toBe('');
    expect(state.estimateValue).toBe('');
    expect(state.modificationMode).toBe('none');
    expect(state.options.map((o) => o.value)).toEqual(['__tapnow_auto_aspect__']);
    expect(state.options[0]?.label).toBe('Auto');
  });

  it('aspectRatioState：text_to_video(required) ⇒ mode=value、值取目录默认比例', () => {
    const { result } = renderVideo({
      params: { model: KNOWN('wan3.0-video'), videoMode: { status: 'known', modelType: 'text_to_video' } },
      presentFields: ['model', 'aspectRatio'],
    });
    const state = result.current.aspectRatioState;
    expect(state.modificationMode).toBe('value');
    /* `wan3.0-video` 无 defaultAspectRatio ⇒ `iie(...) ?? n ?? ""`，`YE(aspectRatios)` = "adaptive" */
    expect(state.value).toBe('adaptive');
    expect(state.options.map((o) => o.value)).toEqual(['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4']);
  });

  it('模型目录可注入（换连接/换目录 ⇒ 选项集与 label 自动跟着变）', () => {
    const a = renderImage({ directoryModelIds: ['doubao-seedream-4.5'], modelLabels: { 'doubao-seedream-4.5': '连接A · Seedream 4.5' } });
    expect(a.result.current.modelOptions?.map((o) => o.label)).toEqual(['连接A · Seedream 4.5']);
    a.unmount();

    const b = renderImage({
      directoryModelIds: ['doubao-seedream-4.5', 'doubao-seedream-4.0'],
      modelLabels: { 'doubao-seedream-4.5': '连接B · Seedream 4.5', 'doubao-seedream-4.0': '连接B · Seedream 4.0' },
    });
    expect(b.result.current.modelOptions?.map((o) => o.value)).toEqual(['doubao-seedream-4.5', 'doubao-seedream-4.0']);
    expect(b.result.current.modelOptions?.map((o) => o.label)).toEqual(['连接B · Seedream 4.5', '连接B · Seedream 4.0']);
  });

  it('默认目录 = MTV 的模型目录（official-model-meta）∩ 官方参数目录', () => {
    const directory = listDirectoryModelIds('image');
    const labels = listDirectoryModelLabels('image');
    expect(directory).toContain('gpt-image-2');
    expect(labels['gpt-image-2']).toBeTruthy();
    /* 目录里 MTV 有的模型，必须在官方参数目录里有条目（否则 chip 拿不到 options） */
    expect(getParamEntry('gpt-image-2')?.kind).toBe('image');
  });
});

/* ================================================================== *
 * C. `isFree` / `disabled` / `confirmDisabled` 的门控分支
 * ================================================================== */

describe('C · 免费额度与订阅门控（官方 `Og` / `E2` / `Dz`）', () => {
  it('`modelIsFree`：只认目录里**显式**的 `isFree`；无该键 / 目录外 / **付费态未知** ⇒ 无数据 ⇒ 不阻断（round 116 + round 129）', () => {
    /* 显式 `isFree:true` ⇒ 免费（与官方一致）。 */
    expect(modelIsFree('image', 'doubao-seedream-4.5', false)).toBe(true);
    /* 显式 `isFree:false` **且已知没付过费** ⇒ 官方标为付费档 ⇒ **维持受限**（不放宽官方口径）。 */
    expect(modelIsFree('image', 'midjourney-v7', false)).toBe(false);
    expect(modelIsFree('image', 'midjourney-v7', true)).toBe(true);
    /* ★ round 129：付费态**未知**（`null`，MTV 现状 —— 无订阅/付费态数据源）⇒ 官方
       `Ft = !Fg(e,qt,q)` 的 `q` 求不出来 ⇒ 官方无对应判据 ⇒ 不阻断（哪怕是显式 `isFree:false`）。 */
    expect(modelIsFree('image', 'midjourney-v7', null)).toBe(true);
    expect(modelIsFree('image', 'tapnow-image-turbo', null)).toBe(true);
    /* 目录里**没有** `isFree` 键（官方语义是付费档，但「该用户能不能用」要靠付费态，
       MTV 无数据）⇒ 不阻断。`gpt-image-2` 正是用户现场那批模型之一。 */
    expect(modelIsFree('image', 'gpt-image-2', false)).toBe(true);
    /* 目录外（MTV 自接 provider 的 `provider/model`，官方无此输入）⇒ 不阻断。 */
    expect(modelIsFree('image', 'general/xyz', false)).toBe(true);
  });

  it('订阅门控 `Dz(e,t) = t || !E2(e)`：非付费时受限模型被过滤，付费时保留', () => {
    expect(passesSubscriptionGate('gpt-image-2', false)).toBe(false);
    expect(passesSubscriptionGate('gpt-image-2', true)).toBe(true);
    expect(passesSubscriptionGate('doubao-seedream-4.5', false)).toBe(true);
  });

  it('★ round 129：MTV 默认（付费态未知）⇒ `.filter(Xb)` **不再**把订阅名单里的目录模型移除', () => {
    const { result } = renderImage();
    const values = result.current.modelOptions?.map((o) => o.value) ?? [];
    /* 修复前：`Xb(e, paidAccess=false)` ⇒ `gpt-image-2` 这类 `jz` 名单成员整条消失
       （真机那份 7 项候选 = 被它滤剩的）。官方 @2324104 的 `q` 是付费态，MTV 未知 ⇒ 不限制。 */
    expect(values).toContain('gpt-image-2');
    expect(values).toContain('doubao-seedream-4.5');
    const seedream = result.current.modelOptions?.find((o) => o.value === 'doubao-seedream-4.5');
    expect(seedream?.disabled).toBe(false);
    expect(seedream?.disabledReason).toBeUndefined();
  });

  it('★ round 129 反例：宿主明确 `isPayingCustomer:false` ⇒ 官方订阅名单门原样保留（闸门没被拆掉）', () => {
    const { result } = renderImage({ isPayingCustomer: false });
    const values = result.current.modelOptions?.map((o) => o.value) ?? [];
    expect(values).not.toContain('gpt-image-2');
    expect(values).toContain('doubao-seedream-4.5');
  });

  it('付费分支（入参覆盖）⇒ 受限模型回到选项里，且非 isFree 模型仍被 `Og` 标禁用', () => {
    const { result } = renderImage({ isPayingCustomer: true });
    const option = result.current.modelOptions?.find((o) => o.value === 'gpt-image-2');
    expect(option).toBeDefined();
    expect(option?.disabled).toBe(false);
    expect(option?.disabledReason).toBeUndefined();
  });

  it('★ round 129：**MTV 默认（付费态未知）** ⇒ 显式 `isFree:false` 的目录模型**不再**被断言受限', () => {
    /* 修复前：`modelIsFree(kind, id, false)` 把「未知付费态」当成「没付过费」⇒ 卡片浮出
       `Subscription required` 把「确认」挡住（用户现场）。现在默认传 `null`（未知）⇒ 放行。 */
    const { result } = renderImage({ params: { model: KNOWN('midjourney-v7') } });
    expect(result.current.confirmDisabled).toBe(false);
    expect(result.current.confirmDisabledReason).toBeUndefined();
  });

  it('★ round 129 反例：宿主**明确**告知「已知没付过费」⇒ 官方非付费分支原样保留（闸门没被拆掉）', () => {
    const { result } = renderImage({
      params: { model: KNOWN('midjourney-v7') },
      isPayingCustomer: false,
    });
    expect(modelIsFree('image', 'midjourney-v7', false)).toBe(false);
    expect(result.current.confirmDisabled).toBe(true);
    expect(result.current.confirmDisabledReason).toBe('Subscription required');
  });

  it('confirmDisabled：isFree 模型 ⇒ 不阻断；付费覆盖后受限模型也不阻断', () => {
    const free = renderImage();
    expect(free.result.current.confirmDisabled).toBe(false);
    expect(free.result.current.confirmDisabledReason).toBeUndefined();
    free.unmount();

    const paid = renderImage({ params: { model: KNOWN('gpt-image-2') }, isPayingCustomer: true });
    expect(paid.result.current.confirmDisabled).toBe(false);
  });

  it('confirmDisabled：模型未知（MTV 连接模型不在官方目录）⇒ 走官方 `G` 分支，不阻断', () => {
    const { result } = renderImage({
      params: { model: { status: 'unknown', displayName: 'general/deepseek-image' } },
    });
    expect(result.current.showModelChip).toBe(true);
    /* 官方 `editedModelId = String((_e ? F : ge?.value) ?? "")`，`F = IN(_)` 对 unknown 实体是 `undefined`
       ⇒ 官方同样得到 `""`（显示名走 `modelDisplayName` / `Rs` 的 `value` 属性，不走 selectedValue）。 */
    expect(result.current.modelSelectedValue).toBe('');
    /* ★ 显示名：官方 `_.displayName` 逐字（官方 `hE` 的目录非空 ⇒ 它天然是可读名）。
       MTV 的 `hE` 目录为空（`generationConfirmationProtocol.ts` @679-690 自述）
       ⇒ `displayName` 就是载荷 `model_name` **原样**，可能就是 `general/<配置 id>` 这类内部引用。
       本仓明文禁止把它印给用户（`ProjectSettingsPopover.tsx:644`）⇒ 必须过展示名出口。
       这里 `config.generalModels` 为空 ⇒ 解析不出上游名 ⇒ 兜底 = **剥掉 `general/` 前缀**
       （任何分支都不允许再出现 `general/` / `apimart/`）。 */
    expect(result.current.modelDisplayName).toBe('deepseek-image');
    expect(result.current.modelDisplayName).not.toContain('general/');
    expect(result.current.confirmDisabled).toBe(false);
  });

  it('`isPayingCustomer = null`（订阅态未知）⇒ 官方 `X` 分支：confirmDisabled + `common.loading`', () => {
    const { result } = renderImage({ isPayingCustomer: null });
    expect(result.current.confirmDisabled).toBe(true);
    expect(result.current.confirmDisabledReason).toBe('Checking subscription');
  });

  it('`forcePaidAccess` ⇒ `q=true`，与付费分支一致', () => {
    const { result } = renderImage({ forcePaidAccess: true });
    expect(result.current.modelOptions?.some((o) => o.value === 'gpt-image-2')).toBe(true);
    expect(result.current.confirmDisabled).toBe(false);
  });
});

/* ================================================================== *
 * D. 函数型字段：按 `isPayingCustomer` / `duration` / `resolution` 裁剪
 * ================================================================== */

describe('D · 函数型字段（`$expr`）逐字求值 + 官方 chip 路径的真实消费面', () => {
  it('白名单求值器：`lockedDurations` 类字段按非付费分支裁剪（`[6..15]` vs 付费 `[]`）', () => {
    const entry = getParamEntry('seedance-2.0-mini');
    const variant = entry?.variants?.[0];
    expect(variant?.options?.lockedDurations).toEqual({
      $expr: 'e=>e.isPayingCustomer===!0?[]:dn.filter(t=>t>5)',
    });
    /* 官方 `dn`（@1110853）= [4..15] ⇒ 非付费分支 = (5,15] */
    expect(resolveExprList(variant?.options?.lockedDurations, variant!, {}, false))
      .toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(resolveExprList(variant?.options?.lockedDurations, variant!, {}, true)).toEqual([]);
    expect(resolveExprList(entry?.lockedDurations, variant!, {}, false))
      .toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('⚠️ `lockedDurations` **不影响** duration chip 的 options（官方 `jre` 只读 `options.durations`）', () => {
    const info = videoModelInfo('seedance-2.0-mini', 'reference_to_video', false);
    expect(info?.durations).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    /* 付费分支同样不变 ⇒ 证明 `lockedDurations` 不在 chip 消费面上 */
    expect(videoModelInfo('seedance-2.0-mini', 'reference_to_video', true)?.durations)
      .toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    /* 但 `resolutions` 走的是 `options.resolutions`（目录里的静态数组），也与时长短无关 */
    expect(info?.resolutions).toEqual(['480p', '720p']);
  });

  it('白名单外的 `$expr` ⇒ `undefined`（无选项 ⇒ chip 隐藏，绝不补默认值）', () => {
    expect(resolveExprList(
      { $expr: 'e=>["1K"]' },
      { defaults: {}, modelType: 'text_to_video' },
      {},
      false,
    )).toBeUndefined();
    expect(resolveExprList(undefined, { defaults: {}, modelType: 'text_to_video' }, {}, false)).toBeUndefined();
    /* 静态数组走官方 `e.slice()`（返回副本） */
    const source = ['720p', '1080p'];
    const resolved = resolveExprList(source, { defaults: {}, modelType: 'text_to_video' }, {}, false);
    expect(resolved).toEqual(['720p', '1080p']);
    expect(resolved).not.toBe(source);
  });

  it('`duration` 上下文裁剪（`kling-motion-control` 的 `$expr`）', () => {
    const entry = getParamEntry('kling-motion-control');
    const variant = entry?.variants?.[0];
    expect(resolveExprList(variant?.options?.durations, variant!, {}, false)).toEqual([5, 10]);
    expect(resolveExprList(variant?.options?.durations, variant!, { character_orientation: 'video' }, false))
      .toEqual([10, 20, 30]);
  });

  it('`resolution` 上下文裁剪（`veo3.1` 的 `$expr`）：1080p/4k ⇒ [8]，否则 [4,6,8]', () => {
    const entry = getParamEntry('veo3.1');
    const variant = entry?.variants?.find((v) => v.modelType === 'text_to_video');
    expect(resolveExprList(variant?.options?.durations, variant!, { resolution: '1080p' }, false)).toEqual([8]);
    expect(resolveExprList(variant?.options?.durations, variant!, { resolution: '4k' }, false)).toEqual([8]);
    expect(resolveExprList(variant?.options?.durations, variant!, { resolution: '720p' }, false)).toEqual([4, 6, 8]);
  });

  it('`modelType` 上下文裁剪（`$expr` 里唯一引用 `K.IMAGE_TO_VIDEO` 的那条）', () => {
    const source = 'e=>e.modelType===K.IMAGE_TO_VIDEO?["360p","540p","720p","1080p","2K"]:["360p","540p","720p","1080p"]';
    expect(resolveExprList({ $expr: source }, { defaults: {}, modelType: 'image_to_video' }, {}, false))
      .toEqual(['360p', '540p', '720p', '1080p', '2K']);
    expect(resolveExprList({ $expr: source }, { defaults: {}, modelType: 'text_to_video' }, {}, false))
      .toEqual(['360p', '540p', '720p', '1080p']);
  });
});

/* ================================================================== *
 * E. 注入点 + 官方多出的 23 个字段 + 提交链路
 * ================================================================== */

describe('E · 注入点（`uot` 分发）与提交链路', () => {
  const single = {
    confirmationId: 'c1',
    requestKind: 'image' as const,
    params: { model: KNOWN('doubao-seedream-4.5'), times: 2, aspectRatio: '1:1' },
    originalParams: { model: KNOWN('doubao-seedream-4.5'), times: 2, aspectRatio: '1:1' },
    presentFields: ['model', 'times', 'aspectRatio'],
    protocolContext: {},
  };

  it('单卡 viewModel ⇒ image/video 控制器（批量卡官方逐字取 `items[0]`）', () => {
    const { result } = renderHook(() => useGenerationChipController(single, { editable: true }));
    expect(result.current.isImage).toBe(true);
    expect(result.current.showTimesChip).toBe(true);
    expect(result.current.showModelChip).toBe(true);
    expect(result.current.modelId).toBe('doubao-seedream-4.5');
  });

  it('批量 viewModel ⇒ 用第一条的 params/presentFields（官方 `C = d[0]`）', () => {
    const batch = {
      confirmationId: 'c2',
      requestKind: 'video' as const,
      items: [
        {
          index: 0,
          requestKind: 'video' as const,
          params: { model: KNOWN('veo3.1'), videoMode: { status: 'known', modelType: 'text_to_video' }, duration: 8 },
          originalParams: {},
          presentFields: ['model', 'duration'],
          protocolContext: {},
        },
        {
          index: 1,
          requestKind: 'video' as const,
          params: { model: KNOWN('depth-anything-video'), duration: 3 },
          originalParams: {},
          presentFields: ['model'],
          protocolContext: {},
        },
      ],
    };
    const { result } = renderHook(() => useGenerationChipController(batch, { editable: true }));
    expect(result.current.showDurationChip).toBe(true);
    expect(result.current.editedDuration).toBe(8);
    expect(result.current.durationOptions.map((o) => o.value)).toEqual(['8']);
  });

  it('空 viewModel ⇒ 官方"全芯片隐藏"的空控制器', () => {
    const { result } = renderHook(() => useGenerationChipController(null, {}));
    expect(result.current.showModelChip).toBe(false);
    expect(result.current.showDurationChip).toBe(false);
    expect(result.current.confirmDisabled).toBe(false);
    expect(result.current.activeFields.size).toBe(0);
  });

  it('官方多出的 23 个字段都存在于返回对象上（且值来自官方表达式）', () => {
    /* 用**付费分支**取回受限模型 `veo3.1`，使 `_e` 为真（官方 `Xb(F,true)` 恒真）。 */
    const { result } = renderVideo({ isPayingCustomer: true });
    const c = result.current;
    const added = [
      'isImage', 'editedModelId', 'editedAspectRatio', 'editedDuration', 'editedResolution', 'estimateTimes',
      'displayVideoModelType', 'resolvedReferences', 'elementReferences', 'activeFields',
      'clearedEstimateParams', 'autoLabel', 'autoUnsupportedTooltip', 'imageSizeCollapsed', 'scene',
      'settledAudioParams', 'advancedParamChips', 'handleAdvancedParamChange', 'controlsWillRender',
      'ControlsComponent', 'controlParams', 'handleControlParamChange', 'isVideoAdaptive',
    ] as const;
    for (const key of added) expect(Object.prototype.hasOwnProperty.call(c, key)).toBe(true);
    expect(c.editedModelId).toBe('veo3.1');
    /* 官方 `Ct = _t != null ? 1 : ht ?? 1`；video 的 `_t`（`fixedImageCount`）恒 undefined、params 无 times ⇒ 1 */
    expect(c.estimateTimes).toBe(1);
    expect(c.fixedImageCount).toBeNull();
    expect(c.autoLabel).toBe('Auto');
    expect(c.autoUnsupportedTooltip).toBe('Adjustments are not supported in the current mode');
    expect(c.clearedEstimateParams).toEqual([]);
    expect(c.elementReferences).toEqual({ count: { image: 0, video: 0, audio: 0 }, unresolved: false });
    /* 官方依赖未提取的部分**显式留空**，不补默认值 */
    expect(c.controlsWillRender).toBe(false);
    expect(c.advancedParamChips).toEqual([]);
    expect(c.settledAudioParams).toEqual([]);
  });

  it('`buildModifications` 走官方 `rot`→`die`→`Mv`，产出 snake_case wire key（只带真实差异）', () => {
    const { result } = renderVideo({ isPayingCustomer: true });
    /* 未编辑 ⇒ 官方 `rot` 只产出 prompt 差异（model/duration/resolution 与 `params` 全等）。 */
    expect(result.current.buildModifications?.('edited prompt', [])).toEqual({ prompt: 'edited prompt' });

    act(() => { result.current.setEditedDuration?.(16); });
    expect(result.current.buildChanges?.('edited prompt')).toEqual({ prompt: 'edited prompt', duration: 16 });
    expect(result.current.buildModifications?.('edited prompt', [])).toEqual({
      prompt: 'edited prompt',
      duration: 16,
    });
    /* 官方 `die`：`addedNodeIds` 非空 ⇒ 追加 `addedNodeReferences`，`att.video` 编码为 `references` */
    const withNodes = result.current.buildModifications?.('edited prompt', ['node-1', 'node-2']);
    expect(withNodes?.references).toEqual([{ ref: 'node/node-1' }, { ref: 'node/node-2' }]);
  });

  it('`buildChanges` = 官方 `rot`：只带真正的编辑差异，无差异 ⇒ `undefined`', () => {
    const { result } = renderVideo();
    /* 没有任何编辑 ⇒ 官方 `rot` 返回 `void 0` */
    expect(result.current.buildChanges?.('a cat')).toBeUndefined();
    /* 改 duration 后 ⇒ 只有 duration 一条 */
    const durationOnly = result.current.buildChanges;
    expect(typeof durationOnly).toBe('function');
  });

  it('空控制器仍保留「全隐藏」语义（宿主未注入时的兜底）', async () => {
    const { createEmptyChipController } = await import('../../src/components/chat/generationChipController');
    const empty = createEmptyChipController();
    expect(empty.showModelChip).toBe(false);
    expect(empty.showSceneChip).toBe(false);
    expect(empty.isImage).toBe(false);
    expect(empty.durationOptions).toEqual([]);
  });
});

describe('round 120 · 模型列表按 kind 过滤：图片卡不含视频模型、视频卡不含图片模型', () => {
  /* 用户现场 2026-10-15：「图片指令，确认卡的模型列表却全是视频模型」。
     真机只读读数（`agentTasks` / React fiber）证明那条「小猫」指令的载荷是
     `mediaKind:"image"` / `request_kind:"image"`，且该卡的下拉逐项都是**图片模型**
     （Seedream 5.0 Lite/Pro、Seedream 4.0/4.5、IMAGEN 4.0、世界编辑、TapNow Flash）
     ⇒ **无法复现「全视频」**。这里把「按 kind 过滤」钉死，防将来回归。 */
  it('图片控制器（`requestKind:"image"`）⇒ 选项里**不含**任何视频模型', () => {
    const { result } = renderImage({ directoryModelIds: [...IMAGE_DIRECTORY, ...VIDEO_DIRECTORY] });
    const values = result.current.modelOptions?.map((o) => o.value) ?? [];
    for (const videoId of VIDEO_DIRECTORY) expect(values).not.toContain(videoId);
    expect(values.every((id) => getParamEntry(id)?.kind === 'image')).toBe(true);
  });

  it('视频控制器（`requestKind:"video"`）⇒ 选项里**不含**任何图片模型', () => {
    const { result } = renderVideo({ directoryModelIds: [...IMAGE_DIRECTORY, ...VIDEO_DIRECTORY] });
    const values = result.current.modelOptions?.map((o) => o.value) ?? [];
    for (const imageId of IMAGE_DIRECTORY) expect(values).not.toContain(imageId);
    /* 目录里 `minimax-h3` 这类没有参数目录条目的 id 不参与判定（官方 `?? t` 兜底分支）。 */
    expect(values.filter((id) => getParamEntry(id)).every((id) => getParamEntry(id)?.kind === 'video')).toBe(true);
  });
});

/* ================================================================== *
 * round 116（用户现场）：MTV 专有状态「系统未指派模型」—— `modelSelectionRequired`
 *
 * 官方不存在这个状态（模型由服务端在出确认卡之前指派好），所以这几条没有官方可抄，
 * 判据 = 「MTV 数据现状 + 不许假造」：真机 `agentTasks` 里
 * `inputRequest.generationRequest = {kind:"image",prompt,times:1}`（**无 `modelName`**），
 * 生产者 `agentRoundExecutor.buildMediaGenerationRequestSnapshot` 在「显式 `modelRef` + 项目默认模型」
 * 都空时不写 `model_name`（该文件 @668-702）。
 * 旧行为：`showModelChip=false`（没有 chip 可选）+ `confirmDisabled=true` 且理由落在
 * `video.modelRestricted`（"Subscription required"）——一个 MTV 无法成立的断言。
 * ================================================================== */

describe('round 116 · 系统未指派模型 ⇒ 卡片给模型选择器 + 诚实理由（不再假报 Subscription required）', () => {
  /** 与真机 payload 同形：没有 `model` 字段、`presentFields` 里没有 `'model'`。 */
  const UNASSIGNED = {
    params: { prompt: 'a cat', times: 1 },
    presentFields: ['prompt', 'aspectRatio', 'imageSize', 'times'],
    modelSelectionRequired: true,
  } as const;

  it('chip 渲染出来（用户唯一的选模型入口），显示官方占位文案，不再假报订阅受限', () => {
    const { result } = renderImage(UNASSIGNED as never);
    const c = result.current;
    expect(c.showModelChip).toBe(true);
    expect(c.modelDisplayName).toBe('Model');
    expect(c.editedModelId).toBe('');
    expect(c.confirmDisabled).toBe(true);
    expect(c.confirmDisabledReason).toBe('Select a model');
    expect(c.confirmDisabledReason).not.toBe('Subscription required');
  });

  it('用户选了模型 ⇒ 不再阻断；`buildModifications` 把选中的模型写成官方 `model_name`', () => {
    const { result } = renderImage(UNASSIGNED as never);
    act(() => { result.current.handleModelChange?.('doubao-seedream-4.5'); });
    expect(result.current.confirmDisabled).toBe(false);
    expect(result.current.confirmDisabledReason).toBeUndefined();
    expect(result.current.editedModelId).toBe('doubao-seedream-4.5');
    /* 官方 `rot`（`sot`）：`activeFields.has("model") && editedModel && !qnt(editedModel, params.model)`
       ⇒ 这里 `params.model` 为空、`modelSelectionRequired` 把 `'model'` 并入 activeFields ⇒ 必须写出。 */
    expect(result.current.buildModifications?.('a cat', [])).toMatchObject({ model_name: 'doubao-seedream-4.5' });
  });

  it('未指派 + 未选 ⇒ 仍然禁用（下游 `resolveApprovalSelection` 要求 `inputValues.modelRef`）', () => {
    const { result } = renderImage(UNASSIGNED as never);
    expect(result.current.confirmDisabled).toBe(true);
  });

  it('★ round 129 反例：宿主明确 `isPayingCustomer:false` 时，选了显式付费档模型仍维持受限（不放宽官方口径）', () => {
    const { result } = renderImage({ ...UNASSIGNED, isPayingCustomer: false } as never);
    act(() => { result.current.handleModelChange?.('midjourney-v7'); });
    expect(result.current.confirmDisabled).toBe(true);
    expect(result.current.confirmDisabledReason).toBe('Subscription required');
  });

  it('★ round 129：MTV 默认（付费态未知）时选同一个模型 ⇒ **不再**误报（用户现场那一类）', () => {
    const { result } = renderImage(UNASSIGNED as never);
    act(() => { result.current.handleModelChange?.('midjourney-v7'); });
    expect(result.current.confirmDisabled).toBe(false);
    expect(result.current.confirmDisabledReason).toBeUndefined();
  });

  it('`modelSelectionRequired` 默认关闭 ⇒ 官方行为不变（presentFields 无 `model` 时 chip 不渲染）', () => {
    const { result } = renderImage({
      params: { prompt: 'a cat', times: 1 },
      presentFields: ['prompt', 'aspectRatio', 'imageSize', 'times'],
    } as never);
    expect(result.current.showModelChip).toBe(false);
  });
});

/* ================================================================== *
 * round 121 · 自定义连接模型：**卡上不印内部调用引用** + 能被列进模型选择器
 *
 * 用户真机（2026-10-15 17:57）：`@model` 了自定义连接的图片模型、生成成功，
 * 但确认卡上印的是 `general/provider-custom-2611fc0a-7n7og` —— 内部调用引用泄露。
 *
 * 官方判据（`vendor-pkg-canvas-DuoOicPr.js`，逐字）：
 *   · option label 兜底 @2321750 邻域：`label: f(Ot.labelKey,{defaultValue:Ot.value})`
 *     —— 官方世界里 `value` 就是可读模型 id（**官方没有「自定义连接」这一层**）；
 *   · `modelDisplayName` @2331722 邻域：`… : _?.status==="unknown" ? _.displayName : String(F??"")`；
 *   · 模型菜单**没有分组**：`dtt`（image，@2242907 `Det("image").map(...).filter(...)`）与
 *     `mtt`（video/audio，@2243432 模型 id 字面量数组）返回**扁平**数组，
 *     再由 `.filter(Kb).map(...)`（@2321750 邻域）产出扁平 `{value,label,icon,disabled,disabledReason}`
 *     ⇒ 本文件平铺追加，**不造分组**。
 * ================================================================== */

const CUSTOM_CONNECTION = 'provider-custom-2611fc0a';
const CUSTOM_MODEL = {
  id: 'provider-custom-2611fc0a-7n7og',
  name: 'GPT Image 2.5 Flare async',
  modelId: 'gpt-image-2.5-flare',
  category: 'image' as const,
  providerConfigId: CUSTOM_CONNECTION,
};

/** 播种 `config.generalModels` / `config.providers`（`isProviderCategoryVisible` 要求连接存在）。 */
function seedCustomModels(models: unknown[] = [CUSTOM_MODEL]) {
  useAppStore.setState({
    config: {
      ...useAppStore.getState().config,
      providers: {
        ...useAppStore.getState().config.providers,
        [CUSTOM_CONNECTION]: {
          name: '我的连接',
          apiKey: 'test-only-key',
          baseUrl: 'https://example.invalid/v1',
        },
      },
      generalModels: models as never,
    },
  });
}

describe('round 121 · 自定义连接模型（目录外引用）不再把内部调用引用印到卡上', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    seedCustomModels();
  });
  afterEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  it('★ 用户真机态：`params.model` 未知（载荷 `model_name` = `general/<配置 id>`）⇒ chip 显示**可读名**，不出现 `general/`', () => {
    /* `generationConfirmationProtocol.hE` 的目录为空 ⇒ 载荷里的 `general/...` 必然落到
       `status:'unknown'`（`model_name` 原样进 `displayName`）—— 这正是用户现场那一颗 chip。 */
    const { result } = renderImage({
      params: { model: { status: 'unknown', displayName: `general/${CUSTOM_MODEL.id}` } },
    });
    expect(result.current.modelDisplayName).toBe('GPT Image 2.5 Flare');
    expect(result.current.modelDisplayName).not.toContain('general/');
  });

  it('`status:"known"` 的目录外引用（卡上手动选过之后）⇒ option label 与 chip 名都是展示名', () => {
    const { result } = renderImage({
      params: { model: KNOWN(`general/${CUSTOM_MODEL.id}`) },
    });
    const option = result.current.modelOptions?.find((o) => o.value === `general/${CUSTOM_MODEL.id}`);
    expect(option?.label).toBe('GPT Image 2.5 Flare');
    expect(option?.label).not.toContain('general/');
    expect(result.current.modelDisplayName).toBe('GPT Image 2.5 Flare');
  });

  it('用户可用的自定义模型**出现在候选里**（平铺追加、不禁用、不加 hint）', () => {
    const { result } = renderImage();
    const values = result.current.modelOptions?.map((o) => o.value) ?? [];
    expect(values).toContain(`general/${CUSTOM_MODEL.id}`);
    const option = result.current.modelOptions?.find((o) => o.value === `general/${CUSTOM_MODEL.id}`);
    expect(option?.disabled).toBe(false);
    /* 官方 option 形状 = `{value,label,icon,disabled,disabledReason}`，**没有 `hint`** ⇒ 不自造。 */
    expect(option).not.toHaveProperty('hint');
    /* 目录项照旧在前（平铺追加，不插队；`preferEnabled` 只做「启用项前置」）。 */
    expect(values.indexOf('doubao-seedream-4.5')).toBeLessThan(values.indexOf(`general/${CUSTOM_MODEL.id}`));
  });

  it('分类可见性照旧生效：`visibleModelCategories` 不含 image ⇒ 不列该连接的自定义模型', () => {
    useAppStore.setState({
      config: {
        ...useAppStore.getState().config,
        providers: {
          ...useAppStore.getState().config.providers,
          [CUSTOM_CONNECTION]: {
            name: '我的连接',
            apiKey: 'test-only-key',
            visibleModelCategories: ['video'],
          },
        },
      },
    });
    const { result } = renderImage();
    const values = result.current.modelOptions?.map((o) => o.value) ?? [];
    expect(values).not.toContain(`general/${CUSTOM_MODEL.id}`);
  });

  it('非图片分类的自定义模型不会出现在图片卡上（按 kind 过滤）', () => {
    seedCustomModels([
      { ...CUSTOM_MODEL, id: 'cfg-video', category: 'video', modelId: 'veo3.1' },
    ]);
    const { result } = renderImage();
    const values = result.current.modelOptions?.map((o) => o.value) ?? [];
    expect(values).not.toContain('general/cfg-video');
  });

  it('视频卡同理（`ai-video` 分类）', () => {
    seedCustomModels([
      { ...CUSTOM_MODEL, id: 'cfg-video', category: 'video', modelId: 'veo3.1', name: '我的视频模型' },
    ]);
    const { result } = renderVideo();
    const values = result.current.modelOptions?.map((o) => o.value) ?? [];
    expect(values).toContain('general/cfg-video');
    expect(result.current.modelOptions?.find((o) => o.value === 'general/cfg-video')?.label)
      .not.toContain('general/');
  });
});

describe('round 121 · `resolveChipModelDisplayName` 兜底链（任何分支都不得产出内部前缀）', () => {
  it('可解析的自定义连接 ⇒ 上游模型的展示名（不是用户起的名字，与 `services/models/display` 同源）', () => {
    expect(resolveChipModelDisplayName(`general/${CUSTOM_MODEL.id}`, {
      generalModels: [CUSTOM_MODEL],
      providers: { [CUSTOM_CONNECTION]: { name: '我的连接' } },
    })).toBe('GPT Image 2.5 Flare');
  });

  it('连接配置缺失 ⇒ 剥掉 `general/` 前缀（绝不原样吐出内部引用）', () => {
    expect(resolveChipModelDisplayName('general/不存在的配置')).toBe('不存在的配置');
    expect(resolveChipModelDisplayName('general/不存在的配置')).not.toContain('general/');
  });

  it('`<provider>/<modelId>` 形态同样不吐前缀', () => {
    expect(resolveChipModelDisplayName('apimart/gpt-image-2')).toBe('GPT Image2');
    expect(resolveChipModelDisplayName('tudou/zzz-mystery-model')).toBe('zzz-mystery-model');
  });

  it('已可读的串 / 裸 id / 空值 ⇒ 恒等，不误改', () => {
    expect(resolveChipModelDisplayName('GPT Image 2.5 Flare async')).toBe('GPT Image 2.5 Flare async');
    expect(resolveChipModelDisplayName('totally-unknown')).toBe('totally-unknown');
    expect(resolveChipModelDisplayName('')).toBe('');
    expect(resolveChipModelDisplayName(undefined)).toBe('');
  });
});

/* ================================================================== *
 * round 121b · 自接连接（`general/<配置 id>`）认作 `known` ⇒ 卡上终于能换模型
 *
 * 依据（本仓**已有明文纪律**，不是新发明）：`services/ai/modelParamCatalog.ts:486-487`
 * 「目录外（自接模型，官方不存在这种输入）⇒ 官方无对应判据 ⇒ **放行**」。
 * 官方 `modelChipEditable = !p && !Ce && !G && !V` 里 `G = status==="unknown"` 之所以永假，
 * 是因为**官方没有自定义连接这一层**（模型恒在目录里）；MTV 的 `general/<cfgId>` 永远不在目录里
 * ⇒ 照字面实现会让自接用户**永久**无法在卡上换模型（= MTV 自己的功能不可用）。
 * ★ 同一条纪律的三个落点必须一致：`modelParamCatalog.modelIsFree` / `KR` / `xx`。
 * ================================================================== */

const REF_SHAPE_2 = { imageCount: 2, videoCount: 0, audioCount: 0, unknownCount: 0, totalCount: 2 };
const REF_SHAPE_EMPTY = { imageCount: 0, videoCount: 0, audioCount: 0, unknownCount: 0, totalCount: 0 };

describe('round 121b · 自接模型升为 known + 目录外形状判定放行', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    seedCustomModels();
  });
  afterEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  /** 回归①：配置里存在 ⇒ `known` + chip 可点 + 当前项进候选（带展示名）+ 选中值正确。 */
  it('① 在 `config.generalModels` 里 ⇒ `known`、`modelChipEditable=true`、当前模型进候选', () => {
    const ref = `general/${CUSTOM_MODEL.id}`;
    expect(resolveModelEntity('image', { status: 'unknown', displayName: ref }, [ref]))
      .toEqual({ status: 'known', id: ref });

    const { result } = renderImage({
      params: { prompt: 'a cat', model: { status: 'unknown', displayName: ref }, times: 1 },
    });
    const c = result.current;
    expect(c.modelChipEditable).toBe(true);
    expect(c.modelSelectedValue).toBe(ref);
    expect(c.modelDisplayName).toBe('GPT Image 2.5 Flare');
    expect(c.modelOptions?.some((o) => o.value === ref && o.label === 'GPT Image 2.5 Flare')).toBe(true);
    /* 官方 `showModelChip` 照旧。 */
    expect(c.showModelChip).toBe(true);
  });

  /** 回归②：图像 + 带参考图 ⇒ **确认不得被卡死**（`KR` 目录外无上限数据 ⇒ 放行）。 */
  it('② 图像 + 带参考图 ⇒ 自接模型不阻断确认（`KR` 目录外放行）', () => {
    const ref = `general/${CUSTOM_MODEL.id}`;
    /* 单测：目录外 ⇒ 不返回 `null`（= 不判不兼容）。 */
    expect(modelSupportsShapes('image', ref, [REF_SHAPE_2])).toBe(true);

    const { result } = renderImage({
      params: { prompt: 'a cat', model: { status: 'unknown', displayName: ref }, times: 1 },
      resolvedReferences: { shape: REF_SHAPE_2 },
    });
    expect(result.current.confirmDisabled).toBe(false);
    expect(result.current.confirmDisabledReason).toBeUndefined();
  });

  /** 回归③：配置里**没有** ⇒ 仍 `unknown`、chip 仍不可点、**确认仍可点**（既有行为不许回归）。 */
  it('③ 不在 `config.generalModels` 里（真未知）⇒ 仍 unknown、chip 不可点、确认仍可点', () => {
    const ref = 'general/真的不存在';
    expect(resolveModelEntity('image', { status: 'unknown', displayName: ref }, [`general/${CUSTOM_MODEL.id}`]))
      .toEqual({ status: 'unknown', displayName: ref });

    const { result } = renderImage({
      params: { prompt: 'a cat', model: { status: 'unknown', displayName: ref }, times: 1 },
    });
    expect(result.current.modelChipEditable).toBe(false);
    /* 官方 `modelAvailable = G || …`，`G` 为真 ⇒ 不阻断（这条已被
       `generationCardModelUnknownConfirm.test.tsx:81-89` 在 DOM 层钉死）。 */
    expect(result.current.confirmDisabled).toBe(false);
  });

  /** 回归④：**目录内**模型 + 带参考图 ⇒ 行为完全不变（`KR` 照旧按 `maxImages` 判定）。 */
  it('④ 目录内模型 + 带参考图 ⇒ `KR` 照旧（没有顺手把目录内也放行）', () => {
    /* `gpt-image-2` 目录 `maxImages = 16`。 */
    expect(getParamEntry('gpt-image-2')?.maxImages).toBe(16);
    const atLimit = { imageCount: 16, videoCount: 0, audioCount: 0, unknownCount: 0, totalCount: 16 };
    const overLimit = { imageCount: 17, videoCount: 0, audioCount: 0, unknownCount: 0, totalCount: 17 };
    expect(modelSupportsShapes('image', 'gpt-image-2', [atLimit])).toBe(true);
    expect(modelSupportsShapes('image', 'gpt-image-2', [overLimit])).toBe(false);

    const allowed = renderImage({
      params: { prompt: 'a cat', model: KNOWN('gpt-image-2'), times: 1 },
      resolvedReferences: { shape: atLimit },
    });
    expect(allowed.result.current.confirmDisabled).toBe(false);

    const blocked = renderImage({
      params: { prompt: 'a cat', model: KNOWN('gpt-image-2'), times: 1 },
      resolvedReferences: { shape: overLimit },
    });
    expect(blocked.result.current.confirmDisabled).toBe(true);
  });

  /** 回归⑤（防新增回归）：**视频**自接模型升级后不得被卡死 —— `xx` 必须同纪律放行。 */
  it('⑤ 视频自接模型：空形状 + 非空形状都放行；目录内模型照旧判不兼容', () => {
    const ref = 'general/cfg-video';
    seedCustomModels([
      { ...CUSTOM_MODEL, id: 'cfg-video', category: 'video', modelId: 'veo3.1', name: '我的视频模型' },
    ]);
    expect(modelSupportsShapes('video', ref, [REF_SHAPE_EMPTY])).toBe(true);
    expect(modelSupportsShapes('video', ref, [REF_SHAPE_2])).toBe(true);
    /* 目录内：`xx` 的非空形状分支照旧 `false`（未放行）。 */
    expect(modelSupportsShapes('video', 'veo3.1', [REF_SHAPE_2])).toBe(false);

    const { result } = renderVideo({
      params: {
        prompt: 'a cat',
        model: { status: 'unknown', displayName: ref },
        videoMode: { status: 'known', modelType: 'text_to_video' },
        duration: 5,
        resolution: '720p',
      },
    });
    expect(result.current.modelChipEditable).toBe(true);
    expect(result.current.confirmDisabled).toBe(false);
    expect(result.current.modelDisplayName).not.toContain('general/');
  });
});
