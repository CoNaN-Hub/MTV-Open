/**
 * officialVideoCaptureFrameMenu —— 官方视频卡工具栏 `video_frame_capture` 的**三帧下拉**定义。
 *
 * ══ 官方逐字证据（**桌面版 0.4.99 为准**）══
 * 工具项本体：`course-api-base-url-DmmB7bTf.js@2687052`（提取包 `components/03-video-toolbar-actions.js` 同段）
 * ```js
 * { node: a.jsx(y8,{size:20}), buttonType:"more", key:"video_frame_capture",
 *   tooltip: y("video.captureFrame"),
 *   dataTestId: fn.CANVAS.NODE.VIDEO.CAPTURE_FRAME_BTN,
 *   tooltipInsideTrigger: !0,
 *   invisible: !k || C || t, disabled: !k || t || U,
 *   lockedTooltip: i("video_frame_capture", K),
 *   menuItems: x2e.map($ => ({ key: $.key, label: y($.labelKey),
 *                              handle: () => { V($.mode) },
 *                              lockedTooltip: i("video_frame_capture", K) })) }
 * ```
 * 菜单表本体：`course-api-base-url-DmmB7bTf.js@2680931`
 * ```js
 * x2e = [ { key:"capture_current", labelKey:"video.captureCurrentFrame", mode:"current" },
 *         { key:"capture_first",   labelKey:"video.captureFirstFrame",   mode:"first"   },
 *         { key:"capture_last",    labelKey:"video.captureLastFrame",    mode:"last"    } ]
 * ```
 *
 * ⚠️ 官方 `menuItems` 的三项**只有 `key` + `label` + `handle` + `lockedTooltip`，没有 `icon`**
 *   （对比同一份代码里的 `more` 菜单项：`{ key:"scene_breakdown", icon:a.jsx(Sx,{size:16}), … }`）
 *   ⇒ MTV **不编造图标**，行内不渲染图标。
 *
 * ⚠️ `video.captureFrame` / `captureFirstFrame` / `captureLastFrame` 的**字面值**：
 *   `video.captureFrame` =「截帧」（桌面版 zh 语言块 `index-BWTZQB6c.js`，字节 9208697）
 *   `captureCurrentFrame` =「截取当前帧」（9219333）· `captureFirstFrame` =「截取首帧」（9208xxx+）
 *   · `captureLastFrame` =「截取尾帧」。**逐字取自 zh 语言块，不是自译。**
 *
 * ⚠️ 官方还有 `U = isCapturing` 这一维度（`disabled: !k || t || U`）。MTV 的 `onCaptureFrame`
 *   是**异步 Promise**，本轮把它接进来 → 截帧进行中整颗下拉 `disabled`（与官方同义）。
 */

/** 官方 `x2e` 的 `mode` 取值（= MTV 既有的 `CaptureFramePosition`） */
export type OfficialCaptureFrameMode = 'current' | 'first' | 'last';

export interface OfficialCaptureFrameMenuItem {
  /** 官方 `key`（逐字） */
  key: string;
  /** 官方 `mode`（逐字） */
  mode: OfficialCaptureFrameMode;
  /** 官方 `y(labelKey)` 的中文值（逐字取自 zh 语言块） */
  label: string;
}

/** 官方 `x2e` —— 顺序、key、mode、label 全部逐字 */
export const OFFICIAL_CAPTURE_FRAME_MENU: readonly OfficialCaptureFrameMenuItem[] = [
  { key: 'capture_current', mode: 'current', label: '截取当前帧' },
  { key: 'capture_first', mode: 'first', label: '截取首帧' },
  { key: 'capture_last', mode: 'last', label: '截取尾帧' },
];

/** 官方 `y("video.captureFrame")` =「截帧」（触发器 tooltip） */
export const OFFICIAL_CAPTURE_FRAME_TOOLTIP = '截帧';
