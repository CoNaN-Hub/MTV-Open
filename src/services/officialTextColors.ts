/**
 * 官方「文本卡背景颜色」色板 —— EXE `zoom-slider-3ZcFvYQO.js` @2756123 `R9e` + `M9e` 逐字。
 *
 *   R9e = [{ value:"#964243", appliedValue:"#372626", label:"red" },
 *          { value:"#834915", appliedValue:"#33281D", label:"orange" },
 *          { value:"#8F8030", appliedValue:"#363323", label:"yellow" },
 *          { value:"#3D7344", appliedValue:"#253027", label:"green" },
 *          { value:"#337282", appliedValue:"#233033", label:"cyan" },
 *          { value:"#2B5284", appliedValue:"#222933", label:"blue" },
 *          { value:"#763886", appliedValue:"#312434", label:"purple" }]
 *   M9e = (value, opacity = 1) => { const a = Math.round(opacity*255).toString(16).padStart(2,"0").toUpperCase();
 *                                  return value.length===9 && value.startsWith("#") ? value.substring(0,7)+a : value+a }
 *
 * `value` = 面板上那个色点显示的颜色；`appliedValue` = **真正写到节点 `data.color` 上的**颜色。
 * 文本卡工具栏调用 `mQ` 时**没传 `applyOpacity`** ⇒ 走默认 `1` ⇒ 应用值 = `appliedValue + "FF"`。
 * （对照：分组节点工具栏传的是 `applyOpacity: .8` ⇒ `+ "CC"`。）
 *
 * ⚠️ i18n：官方 `common.colors.*` 的**中文包只有 6 个**（red/orange/yellow/green/blue/purple），
 *    缺 `cyan` ⇒ 官方中文界面该色点的 tooltip 会回退成键名 "cyan"。MTV 的键是中文原文，
 *    这里照官方含义补上「青色」。
 */
export interface OfficialTextColor {
  /** 面板色点的颜色（官方 `value`） */
  value: string;
  /** 写进节点数据的颜色（官方 `appliedValue`） */
  appliedValue: string;
  /** 官方色名（`common.colors.<label>`） */
  label: string;
}

export const TEXT_BACKGROUND_COLORS: readonly OfficialTextColor[] = [
  { value: '#964243', appliedValue: '#372626', label: 'red' },
  { value: '#834915', appliedValue: '#33281D', label: 'orange' },
  { value: '#8F8030', appliedValue: '#363323', label: 'yellow' },
  { value: '#3D7344', appliedValue: '#253027', label: 'green' },
  { value: '#337282', appliedValue: '#233033', label: 'cyan' },
  { value: '#2B5284', appliedValue: '#222933', label: 'blue' },
  { value: '#763886', appliedValue: '#312434', label: 'purple' },
] as const;

/** 官方 `M9e(value, opacity = 1)`：`#RRGGBB` 后拼两位十六进制 alpha */
export function applyColorOpacity(color: string, opacity = 1): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0').toUpperCase();
  return color.length === 9 && color.startsWith('#') ? color.substring(0, 7) + alpha : color + alpha;
}

/** 官方色名 → MTV i18n 键（原文即键） */
export const TEXT_BACKGROUND_COLOR_LABELS: Record<string, string> = {
  red: '红色',
  orange: '橙色',
  yellow: '黄色',
  green: '绿色',
  cyan: '青色',
  blue: '蓝色',
  purple: '紫色',
};
