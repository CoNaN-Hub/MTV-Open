/**
 * MtvLogo —— MTV 品牌标记（单路径，原始 viewBox `142 × 99.88` ≈ 1.42:1 的宽扁形）。
 *
 * · 颜色**默认写死纯白**、不跟随 `currentColor` —— 顶栏与积分胶囊的容器文字色不同，
 *   跟随会在某处变成灰的（用户明确要「白色」）。
 * · 尺寸按**高度**给，宽度按原始比例算（顶栏 24×16.88；积分胶囊里按宽 16 放进官方那个
 *   16×16 的图标盒 ⇒ 高 11.25）。
 * · 传 `stroke` 即切到**描边**模式（`fill` 自动变 `none`）—— 官方那颗金币图标就是描边
 *   （`fill=none` + `stroke-width:2`）：官方 viewBox 是 20 单位、渲染 16px ⇒ 有效 ~1.6px；
 *   MTV 的 viewBox 是 142 单位，按宽 16 渲染 ⇒ 想要 ~1px 有效描边得给 `strokeWidth ≈ 9`
 *   （`9 × 16 / 142 ≈ 1.01px`）。
 *
 * 抽出共用组件的原因：顶栏 `Header.tsx` 与积分胶囊都要这个标记，路径写两份必然漂移。
 */
interface MtvLogoProps {
  /** 高度（px）；宽度按 142:99.88 自动算 */
  height?: number;
  fill?: string;
  /** 给了就切描边模式（fill 默认变 none） */
  stroke?: string;
  /** 描边宽度，单位是 viewBox 的**用户单位**（不是 px） */
  strokeWidth?: number;
  className?: string;
}

export default function MtvLogo({
  height = 16.88,
  fill,
  stroke,
  strokeWidth,
  className,
}: MtvLogoProps) {
  const width = (height * 142) / 99.88;
  const resolvedFill = fill ?? (stroke ? 'none' : '#ffffff');
  return (
    <svg
      width={Number(width.toFixed(2))}
      height={height}
      viewBox="0 0 142 99.88"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill={resolvedFill}
        {...(stroke ? { stroke, strokeWidth, strokeLinejoin: 'round' as const } : {})}
        d="M91.16,24.62v68.54s-40.41,6.61-40.41,6.61l-.03-74.68c0-2.86-2.74-4.85-5.17-4.8-2.86.06-4.98,2.3-5.04,5.19l-.07,3.06v64.71S0,99.88,0,99.88V6.72S40.52.09,40.52.09l.11,21.07C43.04,8.34,54.17-.57,66.94.03c12.63.59,22.89,10.32,24.22,23.29C92.64,9.54,104.07-.39,117.57.11c13.31.49,24.15,11.41,24.42,25v68.01s-40.53,6.6-40.53,6.6l-.02-53.97-.07-20.51c0-2.65-2.3-4.53-4.57-4.84-2.7-.17-4.87,1.36-5.64,4.21Z"
      />
    </svg>
  );
}
