// @vitest-environment jsdom
/**
 * §93 —— 官方视频卡**工具栏**（图标 20×20 / 三档门 / 官方行容器）与**底部条**（testid 常量 / 参数段取值）。
 *
 * 逐字证据（`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`，偏移 = JS charIdx）：
 *
 * | 项 | 官方符号 | 偏移 | 逐字 |
 * |---|---|---|---|
 * | 工具栏组件 | `xXe` | @1970284 | 左组 `O` = `clip,upscale,video_replace,video_remove,video_creation,multi_view,video_frame_capture,more`；中组 `U=_0(e)`(pin)；右组 `F` = `saveToLibrary,download,scale`；`G=[O,...U?[[U]]:[],F]` |
 * | 图标尺寸 | `xXe` 每个 `node:` | @1970284 | **全部 `size:20`**（`oW`/`Npe` 另带 `stroke:1.75`） |
 * | 行容器 | `r3e` | @1063118/@1063658 | `"nodrag cursor-default w-fit h-12 p-1 rounded-full flex flex-nowrap items-center justify-between bg-popover border z-10 whitespace-nowrap gap-1 text-white/90"` |
 * | 行内列表 / 项外壳 / 分隔线 | `r3e` | @1063118 | `"flex flex-nowrap items-center gap-[2px] justify-between w-full border-primary-border"` · `"cursor-pointer w-fit h-10 rounded-full flex items-center justify-center"` · `"w-px h-[18px] bg-primary-border"` |
 * | 三档门 | `xXe` | @1970284 | 左组 `invisible:!k\|\|S\|\|t` / `disabled:!k\|\|t`；右组 `invisible:!k\|\|t` / `disabled:!k\|\|t`；`lockedTooltip:l(key,V)`，`V=A&&!S&&!t` |
 * | 行级门 | `r3e` | @1063118 | `u=e.map(h=>h?.filter(g=>g?.invisible!==!0\|\|!!g?.lockedTooltip))` |
 * | 底部条容器 | `S0` | @1196445/@1198657 | `"node-float-ui generation-input-bar-width-transition nodrag cursor-default absolute -bottom-2 z-20"` + 宽度三档 + `visible/hidden` |
 * | testid 表 | `hD.NODE` | packages @~630300 | `GENERATION_INPUT_BAR{CONTAINER,PROMPT_TEXTAREA,PARENT_IMAGES_CONTAINER,ADVANCED_SETTINGS_TOGGLE,ADVANCED_SETTINGS_PANEL,MAXIMIZE_BUTTON}` |
 * | 参数 chip 取值 | `Poe` | @1873820 | `f=[generateModeLabel,generateMethodLabel,(aspectRatio\|\|adaptive\|\|auto),(resolution\|\|auto)].join(" · ")` + ` · ${duration}s` + `· 🔊` |
 * | 建卡 params 种子 | `Tr` | @743227 | `w={model:f,provider:h.provider,modelType:x?.modelType\|\|null,...x?.defaults\|\|{}}` |
 */
import { describe, expect, it } from 'vitest';

describe('官方工具栏图标尺寸（`xXe` @1970284 每颗键 `size:20`）', () => {
  it('`OFFICIAL_TOOLBAR_ICON_SIZE` = 20，且工具栏渲染出的每个 svg 都是 20×20', async () => {
    const { OFFICIAL_TOOLBAR_ICON_SIZE } = await import(
      '../../src/components/nodes/shared/video/officialVideoTestIds'
    );
    expect(OFFICIAL_TOOLBAR_ICON_SIZE).toBe(20);
    /* 源码级断言：VideoNodeToolbar 里不再出现 14×14 的工具栏图标 */
    const src = await import('node:fs').then((fs) => fs.readFileSync(
      'src/components/nodes/shared/VideoNodeToolbar.tsx', 'utf8',
    ));
    /* 实际 JSX 用法里不再有 14×14 的图标（注释里提到旧值不算） */
    expect(src).not.toMatch(/width=\{14\}\s+height=\{14\}/);
    expect(src).toContain('width={20} height={20}');
    expect(src).toContain('size={20}');
    /* 「⋯ 浏览全部」触发器的字符串图标同样对齐到 20 */
    const moreSrc = await import('node:fs').then((fs) => fs.readFileSync(
      'src/components/nodes/shared/toolbar/ToolbarMoreMenu.tsx', 'utf8',
    ));
    expect(moreSrc).not.toMatch(/width=\{14\}\s+height=\{14\}/);
  });

  it('官方 3 组键的位置：MTV 已注册的键全部落在官方主行位置或官方 ⋯ 菜单里', async () => {
    const { VIDEO_BUTTONS } = await import(
      '../../src/components/nodes/shared/toolbar/toolbarRegistry'
    );
    const mainKeys = VIDEO_BUTTONS.filter((b) => !b.defaultHidden).map((b) => b.key);
    /* 官方右组 `F`（`saveToLibrary` → `download` → `scale`）；§96 起 MTV 的主行键名
       也照官方 `xXe` 逐字（原来 MTV 写 `fullscreen`，已改名为 `scale`）。 */
    expect(mainKeys).toContain('saveToLibrary');
    expect(mainKeys).toContain('download');
    expect(mainKeys).toContain('scale');
    /* 官方左组里 MTV **有实现**的两颗 */
    expect(mainKeys).toContain('upscale');
    expect(mainKeys).toContain('video_frame_capture');
    /* ⚠️ **裁决变更登记（2026-10-15）** —— 本用例原来把 `pin` 写进下面那份「不许占位」名单，
       依据是更早一次用户裁决「MTV 无实现的官方键一个都不许占位」。
       **2026-10-15 用户重新裁决：视频工具栏的 `pin` 要加，且按官方三组结构加**
       （官方 `live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1969928 区逐字
        `G=a.useMemo(()=>[O,...U?[[U]]:[],F],[O,U,F])`；`v0` @838584 与图像卡**共用同一支**，
        MTV 侧 `PinToolbarButton` / `canvasPin.PINNABLE_KIND['ai-video']` 基建本就齐全）。
       ⇒ `pin` 从「不许占位」名单移出，改为**必须注册且单独成组**。断言没有被删除，只是随裁决转向。 */
    expect(mainKeys).toContain('pin');
    const pinDef = VIDEO_BUTTONS.find((b) => b.key === 'pin');
    expect(pinDef).toBeTruthy();
    expect(pinDef?.officialIcon).toBe('pin');
    expect(pinDef?.defaultZone).toBe('Pin');
    /* MTV **无实现**的官方键仍然一个都不许占位（用户裁决：缺的实现不了就说明，不占位） */
    for (const absent of ['clip', 'video_replace', 'video_remove', 'video_creation', 'multi_view']) {
      expect(mainKeys).not.toContain(absent);
      expect(VIDEO_BUTTONS.some((b) => b.key === absent)).toBe(false);
    }
  });

  it('截帧键的图标 = 官方 `Tpe` 的 tabler `camera` 图集', async () => {
    const { VIDEO_BUTTONS } = await import(
      '../../src/components/nodes/shared/toolbar/toolbarRegistry'
    );
    expect(VIDEO_BUTTONS.find((b) => b.key === 'video_frame_capture')?.icon).toBe('tabler:camera');
  });

  it('§108 更正：upscale 的官方图标 = 官方 r100 的 `pq` 字形（= `enhance.svg`），**不再是** `redraw`', async () => {
    const { VIDEO_BUTTONS } = await import(
      '../../src/components/nodes/shared/toolbar/toolbarRegistry'
    );
    /* 官方源码 `live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1967837：
         `{node:s.jsx(pq,{size:20}),key:"upscale",buttonType:"obsidian",…tooltip:y("video.hdUpscaleShort")…}`
       官方真机 DOM（CDP 9222，node `video-661bd819-…` 选中态）第 1 组第 2 颗的 svg =
         `viewBox="0 0 20 20" fill="none"` + 单条 `path fill="currentColor"`，path 长 **1604**；
       该 path 与本仓 `src/assets/official-icons/enhance.svg` **逐字相同**，与 `redraw.svg`(2465) 不匹配。
       §96 依据的上一代构建（`CvbAwZyy.js` @1974773 的 `gq`）已失效 ⇒ 本用例随证据更正。 */
    expect(VIDEO_BUTTONS.find((b) => b.key === 'upscale')?.officialIcon).toBe('enhance');
    /* 图像卡的「重绘」仍用 `redraw`（官方图像菜单的 `repaint` 那支）。 */
    const { IMAGE_BUTTONS } = await import(
      '../../src/components/nodes/shared/toolbar/toolbarRegistry'
    );
    expect(IMAGE_BUTTONS.find((b) => b.key === 'repaint')?.officialIcon).toBe('redraw');
  });
});

describe('官方三档门（`!k` / `!k||S||t` / `lockedTooltip`）', () => {
  it('官方行级门逐字：`invisible !== true || !!lockedTooltip` 才渲染该键', async () => {
    /* 与 `r3e` @1063118 的 `u=e.map(h=>h?.filter(g=>g?.invisible!==!0||!!g?.lockedTooltip))` 同构 */
    const filterRow = (row: Array<{ key: string; invisible?: boolean; lockedTooltip?: string }>) =>
      row.filter((item) => item.invisible !== true || !!item.lockedTooltip);
    expect(filterRow([
      { key: 'upscale', invisible: true },
      { key: 'download', invisible: true, lockedTooltip: '锁定' },
      { key: 'scale', invisible: false },
    ]).map((i) => i.key)).toEqual(['download', 'scale']);
  });

  it('VideoNodeToolbar 的门逐字口径：左组带 `S`（只读），右组不带；`hasSrc` 是首要门', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync(
      'src/components/nodes/shared/VideoNodeToolbar.tsx', 'utf8',
    ));
    /* 官方 `invisible:!k||t` / `disabled:!k||t`（右组）与 `disabled:!k||t||…`（左组附加项） */
    expect(src).toContain('invisible: !hasSrc, disabled: !hasSrc || isUpscaling');
    expect(src).toContain('invisible: !hasSrc, disabled: !hasSrc || isDownloading');
    expect(src).toContain('invisible: !hasSrc, disabled: !hasSrc');
  });
});

describe('官方底部条 testid 常量（`hD.NODE` @packages ~630300 逐字）', () => {
  it('全部 `CANVAS.NODE.*` 常量与官方字面值一致', async () => {
    const ids = await import('../../src/components/nodes/shared/video/officialVideoTestIds');
    expect(ids.GENERATION_INPUT_BAR_TESTID).toBe('canvas-node-generation-input-bar');
    expect(ids.GENERATION_INPUT_BAR_PROMPT_TEXTAREA_TESTID).toBe('canvas-node-prompt-textarea');
    expect(ids.GENERATION_INPUT_BAR_PARENT_IMAGES_CONTAINER_TESTID).toBe('canvas-node-parent-images-container');
    expect(ids.GENERATION_INPUT_BAR_ADVANCED_TOGGLE_TESTID).toBe('canvas-node-advanced-settings-toggle');
    expect(ids.GENERATION_INPUT_BAR_ADVANCED_PANEL_TESTID).toBe('canvas-node-advanced-settings-panel');
    expect(ids.GENERATION_INPUT_BAR_MAXIMIZE_BUTTON_TESTID)
      .toBe('canvas-node-generation-input-bar-maximize-button');
    expect(ids.GENERATION_ACTION_BAR_CONTAINER_TESTID).toBe('canvas-node-generation-action-bar');
    expect(ids.GENERATION_ACTION_BAR_GENERATE_BTN_TESTID).toBe('canvas-node-generate-btn');
    expect(ids.GENERATION_ACTION_BAR_GENERATE_LOADING_TESTID).toBe('canvas-node-generate-loading');
    expect(ids.NODE_TITLE_TESTID).toBe('canvas-node-title');
    expect(ids.NODE_TOOLBAR_TESTID).toBe('canvas-node-toolbar');
    expect(ids.NODE_DELETE_BTN_TESTID).toBe('canvas-node-delete-btn');
    /* 视频子表（§92 已登记，这里复核） */
    expect(ids.VIDEO_CONTENT_TESTID).toBe('canvas-node-video-content');
    expect(ids.VIDEO_FULLSCREEN_BTN_TESTID).toBe('canvas-node-video-fullscreen-btn');
    expect(ids.VIDEO_DOWNLOAD_BTN_TESTID).toBe('canvas-node-video-download-btn');
    expect(ids.VIDEO_UPSCALE_BTN_TESTID).toBe('canvas-node-video-upscale-btn');
    expect(ids.VIDEO_CAPTURE_FRAME_BTN_TESTID).toBe('canvas-node-video-capture-frame-btn');
    expect(ids.VIDEO_MODEL_SELECT_TESTID).toBe('canvas-node-video-model-select');
  });
});

describe('底部条参数段取值 = 官方目录表（`Zs`/`Fe` → `model-param-catalog.json`）', () => {
  it('建卡 params 种子逐字照官方 `Tr` @743227：`modelType` 必写（= 官方 `state.modelType`）', async () => {
    const { officialVideoNodeParamsSeed, officialVideoNodeFlatDefaults } = await import(
      '../../src/utils/officialVideoNodeParams'
    );
    const seed = officialVideoNodeParamsSeed('seedance-2.0', 'volcengine');
    expect(seed.model).toBe('seedance-2.0');
    expect(seed.provider).toBe('volcengine');
    /* `x?.modelType||null` —— 目录 `variants[0].modelType` = `reference_to_video` */
    expect(seed.modelType).toBe('reference_to_video');
    /* `...x?.defaults||{}` —— 官方 `variants[0].defaults` */
    expect(seed.aspectRatio).toBe('16:9');
    expect(seed.resolution).toBe('720p');
    expect(seed.duration).toBe(5);
    /* MTV 请求层读的平铺字段（MTV 适配点） */
    const flat = officialVideoNodeFlatDefaults('seedance-2.0');
    expect(flat).toEqual({
      seedanceRatio: '16:9',
      seedanceResolution: '720p',
      seedanceDuration: 5,
      generateAudio: true,
    });
  });

  it('目录里查不到的模型 ⇒ `modelType: null`（= 官方 `x?.modelType||null`，chip「生成方式」段不 push）', async () => {
    const { officialVideoNodeParamsSeed, officialVideoNodeFlatDefaults } = await import(
      '../../src/utils/officialVideoNodeParams'
    );
    expect(officialVideoNodeParamsSeed('no-such-model', 'x').modelType).toBeNull();
    expect(officialVideoNodeFlatDefaults('no-such-model')).toEqual({});
  });

  it('底部条参数三段的取值链路：`videoModelInfo` 能读出比例/清晰度/时长（不再只剩「自适应」）', async () => {
    const { videoModelInfo, getParamEntry } = await import('../../src/services/ai/modelParamCatalog');
    expect(getParamEntry('seedance-2.0')).toBeTruthy();
    const info = videoModelInfo('seedance-2.0', 'reference_to_video', false);
    expect(info).not.toBeNull();
    expect(info!.aspectRatios).toEqual(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9']);
    expect(info!.resolutions).toEqual(['480p', '720p', '1080p', '4k']);
    expect(info!.durations).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(info!.defaultAspectRatio).toBe('16:9');
    expect(info!.defaultResolution).toBe('720p');
    expect(info!.defaultDuration).toBe(5);
    expect(info!.supportsGenerateAudio).toBe(true);
    /* chip 文案：`Poe` @1873820 的 `f = [..].join(" · ")` */
    const { videoConfigsTriggerLabel, videoConfigsTriggerDurationLabel } = await import(
      '../../src/components/nodes/shared/VideoParamSelector'
    );
    expect(videoConfigsTriggerLabel(
      info!.defaultAspectRatio, info!.defaultResolution, undefined, undefined, '自适应', '自适应',
    )).toBe('16:9 · 720p');
    expect(videoConfigsTriggerDurationLabel(info!.defaultDuration, '自动')).toBe('5s');
  });

  it('VideoParamSelector 已接官方目录兜底（源码级：`videoModelInfo` 用进 `effectiveCapability`）', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync(
      'src/components/nodes/shared/VideoParamSelector.tsx', 'utf8',
    ));
    /* §121：`videoModelInfo` 现在多传第 4 参 `overrides`（官方 `$I(e,t,n={},o=true)` 的第 3 参）
       —— 官方 19 条 `$expr` 里多条依赖它（如时长随 1080p/4k 变、清晰度随时长变）⇒ 只匹配前缀。 */
    expect(src).toContain('videoModelInfo(videoCatalogModelId, catalogModelType, false, {');
    expect(src).toContain('const effectiveCapability = parameterCapability ?? catalogCapability;');
    /* 三段取值全部改读 `effectiveCapability` */
    expect(src).toContain('effectiveCapability?.defaultResolution');
    expect(src).toContain('effectiveCapability?.defaultRatio');
    expect(src).toContain('effectiveCapability?.defaultDuration');
    /* 建卡侧真的写了 params 种子 */
    const picker = await import('node:fs').then((fs) => fs.readFileSync(
      'src/components/sidebar/nodePickerActions.ts', 'utf8',
    ));
    expect(picker).toContain('officialVideoNodeParamsSeed');
    expect(picker).toContain('officialVideoNodeFlatDefaults');
  });
});
