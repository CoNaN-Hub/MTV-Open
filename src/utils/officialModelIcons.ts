/**
 * officialModelIcons — 官方**品牌图标**查表 ✓（数据：`src/data/official-model-icons.json` ✓）
 *
 * 单独一个模块（不是组件文件 ✓）：`OfficialModelIcon` 是组件 ✓
 *   React Fast Refresh 要求组件文件**只导出组件** ✗ → 查表函数放这里 ✓
 *
 * ⚠️ 官方 `da.SONILO` 是**位图 PNG**（`_icons` 里没有 path 数据 ✓）→ `viewBox: null` + `paths: []`
 *   → `hasOfficialModelIcon()` 返回 false ✓ 调用方退回 MTV 自己的 logo ✓（不会剩一个空槽 ✗）
 */
import ICONS from '../data/official-model-icons.json';

export interface OfficialModelIconPath {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string | number;
  strokeLinecap?: 'butt' | 'round' | 'square' | 'inherit';
  strokeLinejoin?: 'bevel' | 'miter' | 'round' | 'inherit';
  fillRule?: 'nonzero' | 'evenodd' | 'inherit';
  clipRule?: 'nonzero' | 'evenodd' | 'inherit';
  opacity?: string | number;
  transform?: string;
  clipPath?: string;
}

export interface OfficialModelIconRecord {
  iconName: string | null;
  viewBox: string | null;
  /** 官方**根 `<svg>` 上的 fill** ✓（3 个品牌标的颜色只写在根上 ✓ 丢了整图不可见 ✗）*/
  fill: string | null;
  paths: OfficialModelIconPath[];
}

const ICON_TABLE = ICONS as unknown as Record<string, OfficialModelIconRecord>;

/** 取官方图标记录 ✓（没有返回 null ✓）*/
export function getOfficialModelIcon(iconKey: string | undefined | null): OfficialModelIconRecord | null {
  if (!iconKey) return null;
  const icon = ICON_TABLE[iconKey];
  if (!icon || !icon.viewBox || icon.paths.length === 0) return null;
  return icon;
}

/** 该 iconKey 是否**真有**可渲染的官方 path 数据 ✓（没有 → 调用方退回 MTV 自己的 logo ✓）*/
export function hasOfficialModelIcon(iconKey: string | undefined | null): boolean {
  return !!getOfficialModelIcon(iconKey);
}
