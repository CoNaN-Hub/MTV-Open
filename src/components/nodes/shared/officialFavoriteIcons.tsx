/**
 * officialFavoriteIcons —— 官方收藏按钮用的两枚 **Tabler 星形图标**的手工移植。
 *
 * 官方出处（`index-BiTZf8mJ.js`，0-based 字符偏移）：
 *   · `Rg` = `g("outline","star","Star", eMo)` @4811306
 *     ```js
 *     eMo=[["path",{d:"M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z",key:"svg-0"}]]
 *     ```
 *   · `rh` = `g("filled","star-filled","StarFilled", SQo)` @5499266
 *     ```js
 *     SQo=[["path",{d:"M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z",key:"svg-0"}]]
 *     ```
 *
 * ⚠️ MTV 偏离：官方图标来自 `index-BiTZf8mJ.js` 的 Tabler 包装组件（`g(type,name,displayName,paths)`），
 *    MTV 的同名资产只能在 `components/sidebar/OfficialIcon.tsx` 的 `RAW` 注册表里加 —— 该目录本工作流
 *    **禁止改动** ⇒ 与 `PileMemberPreview` 的 `PlaceholderIcon`、`PileGallery` 的 `GalleryTypeIcon`
 *    同一约定：**手绘 path**（path 数据与上表逐字相同），props 只留官方调用点真正用到的
 *    `size`（官方 `oQe` 用 16 / `Qge` 用 20）与 `className`。
 *
 * 官方两处调用点的尺寸/颜色（逐字）：
 *   · 卡片 `oQe` @2941561：已收藏 `l.jsx(rh,{size:16,className:"text-[#FBBC05]"})`；未收藏 `l.jsx(Rg,{size:16})`
 *   · 底条 `Qge` @436698：已收藏 `l.jsx(rh,{size:20,className:"text-[#FBBC05]"})`；未收藏 `l.jsx(Rg,{size:20})`
 *     （busy / 收藏态未拉到 ⇒ `l.jsx(Wo,{size:20,className:"animate-spin motion-reduce:animate-none"})`，
 *      MTV 用 `OfficialIcon name="actions-spinner"` —— 同一个 Tabler `loader-2`）
 */

/**
 * 官方 `Rg` = Tabler `star`（描边版，24 viewBox · stroke 2 · round）。
 * ```jsx
 * <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor"
 *      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 * ```
 */
export function OfficialStarIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
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
 * 官方 `rh` = Tabler `star-filled`（实心版：Tabler 的 `filled` 系列只换 `fill`/`stroke`，
 * 仍走同一个 24 viewBox `g("filled", …)` 工厂）。
 */
export function OfficialStarFilledIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" />
    </svg>
  );
}
