/**
 * officialVideoTestIds —— 官方视频卡各元素的 `data-testid`。
 *
 * ✅ **本文件的常量如今全部有官方产物字面值实证**（2026-09 本轮复核；`canvas` 目录下的
 *    `symbol-index.json` 读不到，但**表体本身**在 `vendor-packages-DRvCmDjR.js` 里是明文）。
 *    之前「未实证 / 推导」的说法**已作废**，见下表。
 *
 * ══ 官方 testid 表的完整绑定链（逐字，全部可复读）══
 * · `vendor-packages-DRvCmDjR.js`（UTF-8，偏移 = JS 字符串 charIdx）
 *     · `gD = { LOGIN:{…}, REGISTER:{…}, LEGAL:{…} }`                ← AUTH 子树
 *     · `hD = { PROJECT:{…}, EDITOR:{…}, NODE:{…}, GROUP_NODE:{…} }` @630017   ← **CANVAS 子树**
 *     · `xD` / `CD` / `vD`                                           ← SETTINGS / COMMUNITY / COMMON
 *     · `lr = { AUTH: gD, CANVAS: hD, SETTINGS: xD, COMMUNITY: CD, COMMON: vD }` @641493  ← **根表**
 *     · 导出表：`lr as bt` @1804149
 * · `vendor-pkg-canvas-CvbAwZyy.js` 头部 import 表：`bt as At` @5251
 *   ⇒ 视频卡 JSX 里的 `At.CANVAS.NODE.VIDEO.*` **就是** `lr.CANVAS.NODE.VIDEO.*` **就是** `hD.NODE.VIDEO.*`。
 *
 * ══ 实证状态一览（偏移均指 `vendor-packages-DRvCmDjR.js`，除非另注）══
 * | 常量 | 官方 Key | 官方字面值 | 偏移 | 实证 |
 * |---|---|---|---|---|
 * | `VIDEO_CONTENT_TESTID` | `CANVAS.NODE.VIDEO.VIDEO_CONTENT` | `canvas-node-video-content` | @631953 | ✅ 产物明文 |
 * | `VIDEO_FULLSCREEN_BTN_TESTID` | `CANVAS.NODE.VIDEO.FULLSCREEN_BTN` | `canvas-node-video-fullscreen-btn` | @631757 | ✅ 产物明文 |
 * | `VIDEO_DOWNLOAD_BTN_TESTID` | `CANVAS.NODE.VIDEO.DOWNLOAD_BTN` | `canvas-node-video-download-btn` | @631807 | ✅ 产物明文 |
 * | `VIDEO_UPSCALE_BTN_TESTID` | `CANVAS.NODE.VIDEO.UPSCALE_BTN` | `canvas-node-video-upscale-btn` | @631853 | ✅ 产物明文 |
 * | `VIDEO_CAPTURE_FRAME_BTN_TESTID` | `CANVAS.NODE.VIDEO.CAPTURE_FRAME_BTN` | `canvas-node-video-capture-frame-btn` | @631897 | ✅ 产物明文 |
 * | `VIDEO_MODEL_SELECT_TESTID` | `CANVAS.NODE.VIDEO.MODEL_SELECT` | `canvas-node-video-model-select` | @631591 | ✅ 产物明文 |
 * | `VIDEO_MODEL_SELECT_DROPDOWN_TESTID` | `…MODEL_SELECT_DROPDOWN` | `canvas-node-video-model-select-dropdown` | @631637 | ✅ 产物明文 |
 * | `VIDEO_MODEL_SELECT_ITEM_TESTID` | `…MODEL_SELECT_ITEM` | `canvas-node-video-model-select-item` | @631701 | ✅ 产物明文 |
 * | `VIDEO_POSTER_TESTID` | —（**不是**常量表里的键） | `video-poster` | `vendor-pkg-canvas-CvbAwZyy.js` @1961989（`"data-testid":"video-poster"` 整串；值本身 @1962004） | ✅ 产物明文 |
 * | `GENERATION_INPUT_BAR_TESTID` | `CANVAS.NODE.GENERATION_INPUT_BAR.CONTAINER` | `canvas-node-generation-input-bar` | @630629（另见 `utils/officialInputBar.ts:15` 与 `types/index.ts:290` 的 CDP 实测选择器） | ✅ 产物明文 + CDP 实测 |
 *
 * 消费点（`vendor-pkg-canvas-CvbAwZyy.js` 逐字）：
 * · `<video>` 本体 `"data-testid": At.CANVAS.NODE.VIDEO.VIDEO_CONTENT` @1960205
 *   （对应的 JSX 是 `Goe` 的 `<video>`；`Goe` body @1958433）
 * · hover 控制条的全屏键 @985404
 * · 视频工具栏三帧下拉 `At.CANVAS.NODE.VIDEO.CAPTURE_FRAME_BTN` @1976051
 * · 海报 `"data-testid":"video-poster"` @1961989 —— 官方 `VideoPoster`（`$oe` @1961281）里的**字面量**
 *
 * ⚠️ 仍然不许写值的情况：本文件之外的其它官方键（audio/text/image 之外的未取证分支）若没有
 *    上面这种产物明文 + 偏移，一律不写。
 */

/** 官方 `CANVAS.NODE.VIDEO.VIDEO_CONTENT` = `"canvas-node-video-content"`（`vendor-packages-DRvCmDjR.js` @631953） */
export const VIDEO_CONTENT_TESTID = 'canvas-node-video-content';

/** 官方 `CANVAS.NODE.VIDEO.FULLSCREEN_BTN` = `"canvas-node-video-fullscreen-btn"`（同表 @631757） */
export const VIDEO_FULLSCREEN_BTN_TESTID = 'canvas-node-video-fullscreen-btn';

/** 官方 `CANVAS.NODE.VIDEO.DOWNLOAD_BTN` = `"canvas-node-video-download-btn"`（同表 @631807） */
export const VIDEO_DOWNLOAD_BTN_TESTID = 'canvas-node-video-download-btn';

/** 官方 `CANVAS.NODE.VIDEO.UPSCALE_BTN` = `"canvas-node-video-upscale-btn"`（同表 @631853） */
export const VIDEO_UPSCALE_BTN_TESTID = 'canvas-node-video-upscale-btn';

/** 官方 `CANVAS.NODE.VIDEO.CAPTURE_FRAME_BTN` = `"canvas-node-video-capture-frame-btn"`（同表 @631897） */
export const VIDEO_CAPTURE_FRAME_BTN_TESTID = 'canvas-node-video-capture-frame-btn';

/** 官方 `CANVAS.NODE.VIDEO.MODEL_SELECT` = `"canvas-node-video-model-select"`（同表 @631591） */
export const VIDEO_MODEL_SELECT_TESTID = 'canvas-node-video-model-select';

/** 官方 `CANVAS.NODE.VIDEO.MODEL_SELECT_DROPDOWN` = `"canvas-node-video-model-select-dropdown"`（同表 @631637） */
export const VIDEO_MODEL_SELECT_DROPDOWN_TESTID = 'canvas-node-video-model-select-dropdown';

/** 官方 `CANVAS.NODE.VIDEO.MODEL_SELECT_ITEM` = `"canvas-node-video-model-select-item"`（同表 @631701） */
export const VIDEO_MODEL_SELECT_ITEM_TESTID = 'canvas-node-video-model-select-item';

/**
 * 官方视频海报的 `data-testid` —— ✅ **有实证**：
 * `vendor-pkg-canvas-CvbAwZyy.js` @1961989 的**字面量** `"data-testid":"video-poster"`
 * （不是 `At.*` 常量表里的键；值本身 @1962004）。
 * ⚠️ 旧记账写的 `@1961144` 是**错的**（该偏移落在 `Goe` 的 `retryStamp` 附近），本轮订正。
 */
export const VIDEO_POSTER_TESTID = 'video-poster';

/**
 * 官方生成输入条容器 `CANVAS.NODE.GENERATION_INPUT_BAR.CONTAINER`
 * = `"canvas-node-generation-input-bar"`（`vendor-packages-DRvCmDjR.js` @630629）。
 * 另有两处独立佐证：`src/utils/officialInputBar.ts:15` / `src/types/index.ts:290` 记的
 * 官方 CDP 实测选择器，以及 web 产物 @1198716 的 `At.CANVAS.NODE.GENERATION_INPUT_BAR.CONTAINER`。
 */
export const GENERATION_INPUT_BAR_TESTID = 'canvas-node-generation-input-bar';

/* ══════════════════════════════════════════════════════════════════════════════
 * §93 —— 官方 `At.CANVAS.NODE.*` 常量表**全量**逐字（`vendor-packages-DRvCmDjR.js`
 * `hD = {…,NODE:{…}}` @~630300；canvas 侧 import 为 `bt as At`）。
 *
 * 官方逐字（`NODE` 子树）：
 * ```js
 * NODE:{TITLE:"canvas-node-title",TOOLBAR:"canvas-node-toolbar",DELETE_BTN:"canvas-node-delete-btn",
 *  GENERATION_INPUT_BAR:{CONTAINER:"canvas-node-generation-input-bar",
 *    PROMPT_TEXTAREA:"canvas-node-prompt-textarea",
 *    PARENT_IMAGES_CONTAINER:"canvas-node-parent-images-container",
 *    ADVANCED_SETTINGS_TOGGLE:"canvas-node-advanced-settings-toggle",
 *    ADVANCED_SETTINGS_PANEL:"canvas-node-advanced-settings-panel",
 *    MAXIMIZE_BUTTON:"canvas-node-generation-input-bar-maximize-button"},
 *  GENERATION_ACTION_BAR:{CONTAINER:"canvas-node-generation-action-bar",
 *    GENERATE_BTN:"canvas-node-generate-btn",GENERATE_LOADING:"canvas-node-generate-loading"},
 *  VIDEO:{MODEL_SELECT:"canvas-node-video-model-select",…}}
 * ```
 * ⚠️ MTV 现状（**未做**，见报告「没做到的验证」栏）：`CONTAINER` 已接（`AINodeDialog`），
 * 其余键 MTV 的底部条**尚未逐个挂**（`PROMPT_TEXTAREA` / `ADVANCED_SETTINGS_*` /
 * `MAXIMIZE_BUTTON` / `PARENT_IMAGES_CONTAINER` / `GENERATION_ACTION_BAR.*`）。
 * 本区块**只登记官方原文值**，不代表 MTV 已经消费。
 * ══════════════════════════════════════════════════════════════════════════════ */

/** 官方 `CANVAS.NODE.TITLE` = `"canvas-node-title"` */
export const NODE_TITLE_TESTID = 'canvas-node-title';
/** 官方 `CANVAS.NODE.TOOLBAR` = `"canvas-node-toolbar"`（官方工具栏行容器 `r3e` 的 `data-testid`） */
export const NODE_TOOLBAR_TESTID = 'canvas-node-toolbar';
/** 官方 `CANVAS.NODE.DELETE_BTN` = `"canvas-node-delete-btn"` */
export const NODE_DELETE_BTN_TESTID = 'canvas-node-delete-btn';
/** 官方 `CANVAS.NODE.GENERATION_INPUT_BAR.PROMPT_TEXTAREA` = `"canvas-node-prompt-textarea"` */
export const GENERATION_INPUT_BAR_PROMPT_TEXTAREA_TESTID = 'canvas-node-prompt-textarea';
/** 官方 `CANVAS.NODE.GENERATION_INPUT_BAR.PARENT_IMAGES_CONTAINER` = `"canvas-node-parent-images-container"` */
export const GENERATION_INPUT_BAR_PARENT_IMAGES_CONTAINER_TESTID = 'canvas-node-parent-images-container';
/** 官方 `CANVAS.NODE.GENERATION_INPUT_BAR.ADVANCED_SETTINGS_TOGGLE` = `"canvas-node-advanced-settings-toggle"` */
export const GENERATION_INPUT_BAR_ADVANCED_TOGGLE_TESTID = 'canvas-node-advanced-settings-toggle';
/** 官方 `CANVAS.NODE.GENERATION_INPUT_BAR.ADVANCED_SETTINGS_PANEL` = `"canvas-node-advanced-settings-panel"` */
export const GENERATION_INPUT_BAR_ADVANCED_PANEL_TESTID = 'canvas-node-advanced-settings-panel';
/** 官方 `CANVAS.NODE.GENERATION_INPUT_BAR.MAXIMIZE_BUTTON` = `"canvas-node-generation-input-bar-maximize-button"` */
export const GENERATION_INPUT_BAR_MAXIMIZE_BUTTON_TESTID = 'canvas-node-generation-input-bar-maximize-button';
/** 官方 `CANVAS.NODE.GENERATION_ACTION_BAR.CONTAINER` = `"canvas-node-generation-action-bar"` */
export const GENERATION_ACTION_BAR_CONTAINER_TESTID = 'canvas-node-generation-action-bar';
/** 官方 `CANVAS.NODE.GENERATION_ACTION_BAR.GENERATE_BTN` = `"canvas-node-generate-btn"` */
export const GENERATION_ACTION_BAR_GENERATE_BTN_TESTID = 'canvas-node-generate-btn';
/** 官方 `CANVAS.NODE.GENERATION_ACTION_BAR.GENERATE_LOADING` = `"canvas-node-generate-loading"` */
export const GENERATION_ACTION_BAR_GENERATE_LOADING_TESTID = 'canvas-node-generate-loading';

/**
 * 官方 `xXe`（视频卡工具栏）里每颗键的**图标尺寸**逐字：`size:20`
 * （`vendor-pkg-canvas-CvbAwZyy.js` @1970284 起，`Zv`/`fq`/`Mx`/`m2`/`gq`/`Cpe`/`hq`/`oW`/`Npe`/`Tpe`/`xq` 全部 `size:20`）。
 * §93 把 MTV 的 14×14 对齐到这个值。
 */
export const OFFICIAL_TOOLBAR_ICON_SIZE = 20;
