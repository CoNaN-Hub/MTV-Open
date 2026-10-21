/**
 * officialGalleryIcons —— 官方「折叠变体画廊」用到的 4 枚 **Tabler** 图标的手工移植。
 *
 * 官方出处：`E:\TapNow-0.4.66\resources\web\assets\course-api-base-url-CGXqZmAy.js` 的
 * `MediaItem`（`Ree` @3092533）与计数药丸（`$O` @3096620）渲染出的真实 DOM。
 * 全部为 **9444 真机抠出的 `class` + `<path d>` 逐字**（2026 本轮实测，非猜测）：
 *
 * · `tabler-icon-star`（收藏，`MediaItem` 左上第 1 颗；官方组件 `Rg`）
 *   ```html
 *   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
 *        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
 *        class="tabler-icon tabler-icon-star ">
 *     <path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z">
 *   ```
 * · `tabler-icon-copy`（左上第 2 颗；**tooltip 是 `common.applyToCanvas`「应用到画布」**，见
 *   `officialNodeHistory.ts` 的记账）
 *   ```html
 *   <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z">
 *   <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1">
 *   ```
 * · `tabler-icon-download`（左上第 3 颗）
 *   ```html
 *   <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2">
 *   <path d="M7 11l5 5l5 -5">
 *   <path d="M12 4l0 12">
 *   ```
 * · `tabler-icon-chevron-right`（计数药丸里的箭头；折叠时 `rotate-90` ⇒ 视觉上是「▾」）
 *   ```html
 *   <path d="M9 6l6 6l-6 6">
 *   ```
 *
 * ⚠️ 与 `components/sidebar/OfficialIcon.tsx` 的关系：那支注册表是官方 svg 资产表，**本工作流不动它**；
 *    这里按 `officialFavoriteIcons.tsx` 已确立的约定手绘 path（path 数据逐字相同，
 *    props 只保留官方调用点真正用到的 `size` 与 `className`）。
 */

interface OfficialGalleryIconProps {
  size?: number;
  className?: string;
}

/** 官方 `MediaItem` 左上第 1 颗 = Tabler `star`（描边版） */
export function OfficialGalleryStarIcon({ size = 16, className }: OfficialGalleryIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" />
    </svg>
  );
}

/**
 * 官方 `MediaItem` 收藏后的**实心**星（官方 `hh`，`icon: v ? l.jsx(hh,{size:16}) : l.jsx(Lg,{size:16})`）。
 *
 * ⚠️ 诚实记账：`hh` 与 `Lg` 的定义不在 `course-…Chunk`（是 tabler 图标工厂 chunk 里的组件），
 * 本轮**没有**在 9444 上 DOM 抠出实心星的 `class`/`path`（避免改动用户的收藏数据）。
 * 这里按 Tabler 官方 `IconStarFilled` 的常量形态补：路径与 `IconStar` 逐字相同，
 * 只把 `fill` 改为 `currentColor`、`stroke` 置 `none`（Tabler filled 系列的统一做法）。
 * 颜色由按钮上的 `text-[#FBBC05] hover:text-[#FBBC05]` 提供（该 class 逐字来自官方 DOM）。
 */
export function OfficialGalleryStarFilledIcon({ size = 16, className }: OfficialGalleryIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" />
    </svg>
  );
}

/** 官方 `MediaItem` 左上第 2 颗 = Tabler `copy`（tooltip「应用到画布」） */export function OfficialGalleryCopyIcon({ size = 16, className }: OfficialGalleryIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
      <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
    </svg>
  );
}

/** 官方 `MediaItem` 左上第 3 颗 = Tabler `download` */
export function OfficialGalleryDownloadIcon({ size = 16, className }: OfficialGalleryIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
      <path d="M7 11l5 5l5 -5" />
      <path d="M12 4l0 12" />
    </svg>
  );
}

/** 官方计数药丸 `$O` 里的 `l_` = Tabler `chevron-right` */
export function OfficialGalleryChevronRightIcon({ size = 16, className }: OfficialGalleryIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 6l6 6l-6 6" />
    </svg>
  );
}
