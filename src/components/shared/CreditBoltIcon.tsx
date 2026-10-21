/**
 * CreditBoltIcon —— 积分图标（用户提供的「积分-闪电.svg」）。
 *
 * ⚠️ **填充，不是描边**（用户明确「注意不要 + 描边」）——
 * 原始 SVG 就是 `fill="currentColor"` 的单路径，这里逐字保留（含 `transform`）。
 *
 * 尺寸：官方那颗积分图标是 **16×16** 的盒子，这颗按同样的 16×16 渲染，
 * 颜色走 `currentColor` 由外层给（积分块容器是白色）。
 */
interface CreditBoltIconProps {
  size?: number;
  className?: string;
}

export default function CreditBoltIcon({ size = 16, className }: CreditBoltIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7.3.64A.5.5 0 0 0 7 .05a.6.6 0 0 0-.67.14L.13 7.05a.5.5 0 0 0-.08.56c.1.19.3.3.51.3H3.8l-.97 4.11c-.06.24.07.48.3.6.23.1.51.05.68-.14L10 5.62a.5.5 0 0 0 .08-.56.6.6 0 0 0-.51-.31H6.33z"
        fill="currentColor"
        transform="translate(2.935 1.665)"
      />
    </svg>
  );
}
