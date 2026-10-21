/**
 * LibraryViewIcons —— 官方素材库**子视图**（收藏 / 主体库）头部与卡片图标
 *
 * 全部取自官方窗口（9444）实测 DOM（tabler 图标，`page-DPdEgTS0.js` / `zoom-slider-*.js`）：
 * · 收藏视图返回：`tabler-icon-chevron-left` 16×16 `text-white/60`（外层 `p-1 rounded-md`）
 * · 收藏视图网格切换：`tabler-icon-layout-grid` **18×18**
 * · 收藏视图列表切换：`tabler-icon-list` **18×18**
 * · 主体库返回：`tabler-icon-chevron-left` 16×16（外层 `size-8 rounded-[6px]`）
 * · 主体库网格切换：`tabler-icon-layout-grid` **16×16**
 * · 主体库「新建主体」卡：`tabler-icon-plus` **28×28**
 */

const TABLER = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** 收藏视图返回（16×16，`text-white/60`） */
export function FavChevronLeftIcon() {
  return (
    <svg {...TABLER} width="16" height="16" viewBox="0 0 24 24" className="text-white/60">
      <path d="M15 6l-6 6l6 6" />
    </svg>
  );
}

/** 收藏视图「网格」切换（18×18） */
export function FavLayoutGridIcon() {
  return (
    <svg {...TABLER} width="18" height="18" viewBox="0 0 24 24">
      <path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      <path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      <path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      <path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
    </svg>
  );
}

/** 收藏视图「列表」切换（18×18） */
export function FavListIcon() {
  return (
    <svg {...TABLER} width="18" height="18" viewBox="0 0 24 24">
      <path d="M9 6l11 0" />
      <path d="M9 12l11 0" />
      <path d="M9 18l11 0" />
      <path d="M5 6l0 .01" />
      <path d="M5 12l0 .01" />
      <path d="M5 18l0 .01" />
    </svg>
  );
}

/** 主体库返回（16×16） */
export function ElementChevronLeftIcon() {
  return (
    <svg {...TABLER} width="16" height="16" viewBox="0 0 24 24">
      <path d="M15 6l-6 6l6 6" />
    </svg>
  );
}

/** 主体库「网格」切换（16×16） */
export function ElementLayoutGridIcon() {
  return (
    <svg {...TABLER} width="16" height="16" viewBox="0 0 24 24">
      <path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      <path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      <path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      <path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
    </svg>
  );
}

/** 主体库「新建主体」卡内的 plus（28×28） */
export function ElementPlus28Icon() {
  return (
    <svg {...TABLER} width="28" height="28" viewBox="0 0 24 24">
      <path d="M12 5l0 14" />
      <path d="M5 12l14 0" />
    </svg>
  );
}
