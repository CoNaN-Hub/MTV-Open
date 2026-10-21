/**
 * OfficialModelIcon — 官方**模型品牌图标**（内联 SVG ✓ path 数据逐字来自官方 EXE 的 `_icons` ✓）
 *
 * 数据源：`src/data/official-model-icons.json`（33 条 = 官方 `da.*` 品牌标 + 4 个 featureTag 小图标 ✓）
 *   生成时逐字段照抄 ✓ 没有重画 / 没有"清理" ✓
 *   ⚠️ 官方有 3 个品牌标（RECRAFT / REVE / PIXVERSE）**颜色只写在根 `<svg fill="#A3A3A3">` 上** ✗
 *      path 自己没有 fill ✗ → 根上写死 `fill="none"` 会让它们**整图不可见** ✗
 *      → 这里用数据里的 `fill`（官方根属性原文 ✓）· 官方没写根 fill 时才用 `none` ✓
 *   ⚠️ 颜色一律照抄官方（含官方的 `#A3A3A3` / 硬编码色 ✓）· **不强制 currentColor** ✗ 不换色 ✗
 *   ⚠️ `da.SONILO` 官方是位图 PNG（没有 path 数据 ✓）→ 本组件返回 `null` ✓
 *      调用方用 `hasOfficialModelIcon()` 判空 → 退回 MTV 自己的 logo ✓（见 utils/officialModelIcons ✓）
 */
import { getOfficialModelIcon } from '../../utils/officialModelIcons';

export interface OfficialModelIconProps {
  iconKey: string;
  size?: number;
  className?: string;
}

export default function OfficialModelIcon({ iconKey, size = 16, className }: OfficialModelIconProps) {
  const icon = getOfficialModelIcon(iconKey);
  if (!icon) return null;
  return (
    <svg
      viewBox={icon.viewBox ?? undefined}
      width={size}
      height={size}
      fill={icon.fill ?? 'none'}
      className={className}
      aria-hidden="true"
    >
      {icon.paths.map((path, index) => (
        // 官方 path 顺序固定且没有 id ✓ 用序号当 key ✓
        <path key={`${iconKey}-${index}`} {...path} />
      ))}
    </svg>
  );
}
