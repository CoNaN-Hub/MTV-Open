/**
 * officialGroupColors —— 官方分组/节点的**调色板与落库色**（逐字取自官方包）
 *
 * `zoom-slider-3ZcFvYQO.js`@char2757073 附近，逐字：
 * ```js
 * R9e = [
 *   { value: '#964243', appliedValue: '#372626', label: 'red' },
 *   { value: '#834915', appliedValue: '#33281D', label: 'orange' },
 *   { value: '#8F8030', appliedValue: '#363323', label: 'yellow' },
 *   { value: '#3D7344', appliedValue: '#253027', label: 'green' },
 *   { value: '#337282', appliedValue: '#233033', label: 'cyan' },
 *   { value: '#2B5284', appliedValue: '#222933', label: 'blue' },
 *   { value: '#763886', appliedValue: '#312434', label: 'purple' },
 * ]
 * M9e = (e, t = 1) => {                       // appliedValue + 不透明度 → 8 位 hex
 *   const n = Math.round(t * 255).toString(16).padStart(2, '0').toUpperCase();
 *   return e.length === 9 && e.startsWith('#') ? e.substring(0, 7) + n : e + n;
 * }
 * ```
 * 用法（官方 group 工具条 @char2882800 区域逐字）：
 *   `mQ({ selectedColor: w, onColorChange: G, applyOpacity: .8, showReset: true, onReset: () => G('') })`
 *   · 色板显示 = `value`（`style={{backgroundColor: u.value}}`）
 *   · **落库/上色** = `M9e(u.appliedValue, applyOpacity)` —— 分组工具条传的是 **0.8**
 *     ⇒ 例如 red = `#372626` + `CC` = **`#372626CC`**
 * ⚠️ 也就是说：官方分组表面拿到的是**暗色 `appliedValue` + 80% 不透明度**，**不是**色板上那个亮色 `value`。
 *    上一轮 MTV 直接存了亮色 `value` ⇒ 分组整块是亮色（截图可见），与官方不符 ⇒ 这里改正。
 */

export interface OfficialColor {
  /** 色板上显示的颜色 */
  value: string;
  /** 真正上色/落库用的暗色 */
  appliedValue: string;
  /** i18n key 后缀：`common.colors.${label}` */
  label: string;
  /** 中文名（官方 `common.colors.*` 中文包，MTV 直接用它做 tooltip） */
  name: string;
}

export const OFFICIAL_COLORS: readonly OfficialColor[] = [
  { value: '#964243', appliedValue: '#372626', label: 'red', name: '红' },
  { value: '#834915', appliedValue: '#33281D', label: 'orange', name: '橙' },
  { value: '#8F8030', appliedValue: '#363323', label: 'yellow', name: '黄' },
  { value: '#3D7344', appliedValue: '#253027', label: 'green', name: '绿' },
  { value: '#337282', appliedValue: '#233033', label: 'cyan', name: '青' },
  { value: '#2B5284', appliedValue: '#222933', label: 'blue', name: '蓝' },
  { value: '#763886', appliedValue: '#312434', label: 'purple', name: '紫' },
] as const;

/** 官方 `M9e(appliedValue, opacity)`：拼成 8 位 hex（默认 alpha `FF` 可省略） */
export function applyOpacityToColor(color: string, opacity = 1): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0').toUpperCase();
  if (alpha === 'FF') return color;
  return color.length === 9 && color.startsWith('#') ? color.substring(0, 7) + alpha : color + alpha;
}

/** 分组工具条用的 `applyOpacity`（官方 `mQ` 调用点逐字传 `.8`） */
export const GROUP_COLOR_OPACITY = 0.8;

/** 官方分组工具条里「点某个色块」最终存下来的颜色 */
export function groupColorOf(swatch: OfficialColor): string {
  return applyOpacityToColor(swatch.appliedValue, GROUP_COLOR_OPACITY);
}

/** 新建分组的默认色（官方按 `R9e` 取色；这里取首个未占用的，占用完则回到第一个） */
export function defaultGroupColor(usedColors: ReadonlySet<string>): string {
  const free = OFFICIAL_COLORS.find((c) => !usedColors.has(groupColorOf(c)));
  return groupColorOf(free ?? OFFICIAL_COLORS[0]);
}
