/**
 * NodeImageHistoryGallery —— 官方图片节点「折叠变体」的**可见 UI**：计数药丸 `N ▾` +
 * 点开后横向展开的一行变体卡（`MediaGalleryOnNode` `UT` + `MediaItem` `Ree`）。
 *
 * 官方出处（`E:\TapNow-0.4.66\resources\web\assets\course-api-base-url-CGXqZmAy.js`，
 * 0-based 字符偏移；所有类名/数值/文案逐字）：
 *
 * ① 计数药丸 `$O` @3096620：
 * ```js
 * const $O=({totalCount:e,nodeId:t,nodeType:n="image",className:s,loading:r=!1,disabled:o=!1,trackOnOpen:i=!0})=>{
 *   const f=e>=50?"50+":e, m=o||r||e<=0, p=$x(t);
 *   return u?null:l.jsxs(Jt,{onClick:g,disabled:m,variant:"secondary",
 *     className:Z("group/indicator h-7 rounded-[10px] px-3 py-1.5 text-xs font-semibold",
 *                "bg-black/50 hover:bg-black/70 text-[#F5F5F5]",
 *                "cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",s),
 *     children:[r?l.jsx(ko,{className:"animate-spin",size:16}):l.jsx("span",{children:f}),
 *       l.jsx(l_,{className:Z(p?"rotate-0":"rotate-90","transition-transform duration-300 ease-in-out ml-2 group-hover/indicator:rotate-0"),size:16})]})}
 * ```
 * 渲染处（图像节点）@3238300 区域：`className:"absolute top-3 right-3 z-10"`；
 * 点击 `g` = `b.stopPropagation()` → `toggleGallery(nodeId)` + `updateNode(nodeId,{selected:!0})`。
 * 出现门 `!magicSelectionActive && !loadingOverlay && selected && src && Lee({...})`。
 *
 * ② 一行的布局（`MediaItem` `Ree` @3092533）：
 * ```js
 * const I = useMemo(()=>{const V=x?d:d+1,H=Math.min(V,V>4?4:2),$=x?n:n+1,W=$%H,Y=Math.floor($/H),
 *   Q=n<a?12*(n+1):0,q=n<a?4*(n+1):0;
 *   return{left:s?(o.width+i)*W:Q,top:s?-(o.height+i)*Y:q}},…);
 * const B = {width:r.width,height:r.height,zIndex:s?Bnt:-1*(n+1),scale:s?1:n<a?1-(n+1)*(.14/a):1};
 * const k = {rotate:s?0:n<a?c*(n+1):0,...I};
 * const P = {...Pnt,delay:s?n*.03:0};        // Pnt={type:"spring",damping:18,stiffness:280}
 * ```
 * 外层类名逐字：
 * `group/item min-w-full min-h-full absolute bg-muted/40 border rounded-xl border-border/60 overflow-hidden backdrop-blur-sm`
 * ＋ `cursor-pointer`；图片逐字
 * `w-full h-full object-contain transition-[transform,opacity] duration-300 group-hover/item:scale-110`（打开 `opacity-100`、折叠 `opacity-0`）。
 * ⚠️ MTV 是 Tailwind v3：上面那条 `scale-110` 会被编译成 `transform: … scale(1.1)`（**在**过渡列表里）
 *   ⇒ 会多出一段 300ms 缩放动画，与官方「瞬跳」不一致（详见下面 `<img>` 处的实测注释）
 *   ⇒ 落地时改写为 `group-hover/item:[scale:1.1]`（产出 v4 同名的独立 `scale` 属性）。
 *
 * ③ 卡片上的四个操作（同 @3092533 区域）：
 * 左上容器 `absolute top-2 left-2 flex items-center gap-0.5 bg-black/50 rounded-[10px] px-0.5 py-0.5 transition-opacity duration-300`
 * ＋ `opacity-0 pointer-events-none group-hover/item:opacity-100 group-hover/item:pointer-events-auto`；
 * 三颗幽灵按钮（官方 `JI`→`Jt variant="ghost" size="icon"`，`Dnt` @3091877）
 * `h-7 w-7 rounded-[10px] text-[#F5F5F5] hover:text-[#F5F5F5] hover:bg-white/10 cursor-pointer transition-colors`
 * ⇒ tooltip 依次 `common.favorite` / `common.applyToCanvas` / `common.download`
 *   （zh 逐字：收藏 @9140282 / 应用到画布 @9140906 附近 / 下载 @7869139 的 `zSs`）。
 * 右上「设为主图」药丸容器 `absolute top-2 right-2 flex items-center bg-black/50 rounded-[10px] px-3 py-1.5 transition-opacity duration-300`
 * ＋ 同上的 hover 显示门；按钮 `text-[#F5F5F5] text-xs font-semibold leading-4 cursor-pointer whitespace-nowrap hover:opacity-80 transition-opacity`
 * ⇒ 文案 `common.setAsMainImage`（zh「设为主图」@9140480）。
 *
 * ④ 展开行背后的暗色渐变层（图像节点 @3238300 区域逐字）+ 网格几何（`zee` 的 `De` @3145802，见
 *   `utils/officialNodeHistory.ts::officialGalleryGeometry`）。
 *
 * ⚠️ MTV 偏离（逐条诚实记账）：
 *  1. **没有服务端 node history** ⇒ 药丸的 `loading` 分支（`ko` 转圈）永不出现；条目集合 =
 *     `src + options` 去重（= 官方 `legacyGallery` 那支）。
 *  2. 官方卡片图走 CDN 的 `?variant_name=small` 小图；MTV 的地址是本地 `asset://` / blob ⇒ 直接用原地址。
 *  3. 官方 4 张以上才分 2 行（`cols = count>4?4:2`）；这里逐字沿用同一公式。
 *  4. `backdrop-blur-sm` 在官方（Tailwind v4）= 8px，MTV 是 v3 = 4px ⇒ 用 `backdrop-blur-[8px]` 对齐实测。
 *  5. 官方按钮**没有** `aria-label`（只有 radix tooltip）；这里补上 `aria-label`（= 同一份官方 i18n 文案）
 *     并用 MTV 既有的 `data-tooltip` 属性承载气泡。
 */
import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useT } from '../../../../i18n';
import {
  OFFICIAL_GALLERY_COUNT_DISPLAY_CAP,
  officialGalleryBackdropStyle,
  officialGalleryGeometry,
  officialGalleryItemLayout,
} from '../../../../utils/officialNodeHistory';
import {
  OfficialGalleryChevronRightIcon,
  OfficialGalleryCopyIcon,
  OfficialGalleryDownloadIcon,
  OfficialGalleryStarFilledIcon,
  OfficialGalleryStarIcon,
} from './officialGalleryIcons';

/** 官方 `Pnt`（@3091950 区域）：`{type:"spring",damping:18,stiffness:280}` */
const MEDIA_ITEM_TRANSITION = { type: 'spring', damping: 18, stiffness: 280 } as const;

/** 官方 `Dnt`（@3091877 逐字）：卡片内幽灵按钮 */
const GHOST_BUTTON_CLASS = [
  'inline-flex h-7 w-7 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[10px]',
  'text-[#F5F5F5] hover:bg-white/10 hover:text-[#F5F5F5] transition-colors',
  '[&_svg]:pointer-events-none [&_svg]:shrink-0',
].join(' ');

/** 官方卡片上两条浮层的公共类（`opacity-0 group-hover/item:*` 那套） */
const CARD_ACTION_BASE = 'absolute flex items-center bg-black/50 rounded-[10px] transition-opacity duration-300';

export interface ImageHistoryCountPillProps {
  /** 官方 `$O` 的 `totalCount`（= `legacyGalleryTotalCount`，去重后的 `src + options` 张数） */
  totalCount: number;
  /** 官方 `$x(nodeId)`：画廊是否已展开（决定箭头 `rotate-0` / `rotate-90`） */
  isOpen: boolean;
  disabled?: boolean;
  /** 官方渲染处逐字：`absolute top-3 right-3 z-10` */
  className?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /**
   * ⚠️ MTV 必需（官方没有）：React Flow 的 `Pane` 自带
   * `onClick = (e) => { onPaneClick?.(e); store.getState().resetSelectedElements(); nodesSelectionActive: false }`
   * （`node_modules/@xyflow/react/dist/esm/index.js` @57891）。实测只靠 `click` 阶段的
   * `stopPropagation()` **拦不住**它（9444/9333 对照：点药丸后 16ms 内 `selected:false`，
   * 药丸随卸载 ⇒ 画廊被自己的「药丸卸载即 closeGallery」规则关掉）。
   * ⇒ 与 MTV 其它节点按钮同一约定，在 `pointerdown` 就掐断。
   */
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
}

/**
 * 官方计数药丸 `$O`（@3096620）。
 * 折叠态箭头 `rotate-90`（视觉上是「▾」）；展开态 `rotate-0`（指向右）。
 */
export function ImageHistoryCountPill({
  totalCount,
  isOpen,
  disabled = false,
  className,
  onClick,
  onPointerDown,
}: ImageHistoryCountPillProps) {
  const t = useT();
  const label = t('图片历史');
  /* 官方 `f = e>=50 ? "50+" : e` */
  const display = totalCount >= OFFICIAL_GALLERY_COUNT_DISPLAY_CAP ? '50+' : String(totalCount);
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={isOpen}
      disabled={disabled || totalCount <= 0}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={[
        'group/indicator absolute top-3 right-3 z-10 nodrag nopan',
        'inline-flex h-7 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-3 py-1.5',
        'text-xs font-semibold',
        /* 官方 `Jt variant="secondary"` 的 `shadow-sm`：Tailwind v4 的 `shadow-sm` 实测 computed =
           `0 2px 4px 0 rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)`（9444 抠出）；
           MTV 是 v3，`shadow-sm` = `0 1px 2px 0 rgba(0,0,0,.05)` ⇒ 这里用等值 arbitrary 对齐官方。 */
        'shadow-[0_2px_4px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'bg-black/50 hover:bg-black/70 text-[#F5F5F5]',
        'cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        className ?? '',
      ].filter(Boolean).join(' ')}
    >
      <span>{display}</span>
      <OfficialGalleryChevronRightIcon
        size={16}
        className={[
          isOpen ? 'rotate-0' : 'rotate-90',
          'ml-2 transition-transform duration-300 ease-in-out group-hover/indicator:rotate-0',
        ].join(' ')}
      />
    </button>
  );
}

export interface NodeImageHistoryGalleryProps {
  /** 全部变体（去重后的 `[src, ...options]`，官方 `galleryItems`） */
  items: readonly string[];
  /** 官方 `W`：当前展示的那张（= `historyPreviewSrc ?? src`） */
  currentItem: string;
  /** 官方 `$x(nodeId)`：画廊是否展开 */
  isOpen: boolean;
  /** 官方 `ae`：历史模式（点一张卡 = 直接换主图；否则点 = 展开/收回） */
  isHistoryMode: boolean;
  /** 官方 `pe`：每张卡的单元尺寸（= 节点卡片尺寸） */
  cell: { width: number; height: number };
  /** 官方 `c`（disabled）：禁用时点击不响应 */
  disabled?: boolean;
  /** 该地址是否已收藏（`undefined` = 未拉取） */
  favoriteStatusOf?: (url: string) => boolean;
  /** 正在下载的地址（用于忙态） */
  downloadingUrl?: string | null;
  /** 官方 `onSelect` / `onSelectMain`：把这张变体设为主图并收回画廊 */
  onSelect: (url: string) => void;
  /** 官方 `onApply`（tooltip「应用到画布」）：把这张变体复制成画布上的新节点 */
  onApply: (url: string) => void;
  onFavorite: (url: string) => void;
  onDownload: (url: string) => void;
}

/**
 * 官方 `UT`（`MediaGalleryOnNode` @3097729）+ `Ree`（`MediaItem`）。
 * 直接挂在节点根（`.node-wrapper`，`position:relative`）下 —— 与官方把 `UT` 挂在
 * `canvas-node-shell` 里同层。
 */
export default function NodeImageHistoryGallery({
  items,
  currentItem,
  isOpen,
  isHistoryMode,
  cell,
  disabled = false,
  favoriteStatusOf,
  downloadingUrl,
  onSelect,
  onApply,
  onFavorite,
  onDownload,
}: NodeImageHistoryGalleryProps) {
  const t = useT();

  /* 官方 `S = C ? t : j$(t,s)`；展开时 `E = S`，折叠时 `E = Vnt({items:_,…})` */
  const rendered = useMemo(() => {
    if (isOpen) return isHistoryMode ? [...items] : items.filter((url) => url !== currentItem);
    return isHistoryMode
      ? items.filter((url) => url !== currentItem).slice(0, Math.min(Math.max(items.length - 1, 0), 3))
      : items.slice(0, Math.min(items.length, 4));
  }, [isOpen, isHistoryMode, items, currentItem]);

  /* 官方 `De`（运行端 @3150770 同构）：展开行网格几何 + 暗色层尺寸（始终按 `galleryItems.length` 算） */
  const geometry = useMemo(() => officialGalleryGeometry(cell, items.length), [cell, items.length]);
  const backdropStyle = useMemo(() => officialGalleryBackdropStyle(geometry), [geometry]);

  const handleCardClick = useCallback((event: React.MouseEvent<HTMLDivElement>, url: string) => {
    event.stopPropagation();
    if (disabled) return;
    /* 官方 `Hnt({isOpen,isHistoryMode,isPlaceholder})`：展开或有历史（且非占位）⇒ select，否则 toggle */
    if (isOpen || isHistoryMode) onSelect(url);
  }, [disabled, isHistoryMode, isOpen, onSelect]);

  if (rendered.length === 0) return null;

  return (
    <>
      {rendered.map((url, index) => {
        /* 官方 `Ree` 的 `I`/`B`/`k`：`$ = isHistoryMode ? index : index+1`，`H` 取自渲染集合长度 */
        const layout = officialGalleryItemLayout(index, isOpen, cell, rendered.length, isHistoryMode);
        const favorited = favoriteStatusOf?.(url) ?? false;
        const downloading = downloadingUrl === url;
        return (
          <motion.div
            key={url}
            /* 官方外层类名逐字 */
            className={[
              'group/item min-w-full min-h-full absolute overflow-hidden rounded-xl border border-border/60 bg-muted/40 backdrop-blur-[8px] nodrag nopan',
              disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
            ].join(' ')}
            style={{
              width: cell.width,
              height: cell.height,
              zIndex: layout.zIndex,
              scale: isOpen ? 1 : layout.closedScale,
            }}
            animate={{
              left: isOpen ? layout.openLeft : layout.closedLeft,
              top: isOpen ? layout.openTop : layout.closedTop,
              rotate: layout.closedRotate,
            }}
            transition={{ ...MEDIA_ITEM_TRANSITION, delay: isOpen ? index * 0.03 : 0 }}
            onClick={(event) => handleCardClick(event, url)}
            data-gallery-item={url}
          >
            {isOpen && (
              /* ★★ 用户 2026：「hover 在铺开的卡上是 动画不对」—— 官方出处（运行端 chunk
                 `tapnow://app/assets/course-api-base-url-0D9Dk52r.js` @3097942 区域，`MediaItem` `Mee`）逐字：
                 ```js
                 const j = Q("w-full h-full object-contain transition-[transform,opacity] duration-300 group-hover/item:scale-110",
                             s ? "opacity-100" : "opacity-0");
                 ```
                 官方是 Tailwind **v4**：`scale-110` 编译成**独立的 `scale` 属性**（`scale: 1.1`），
                 而 `transition-[transform,opacity]` 只列了 `transform, opacity` ⇒ **`scale` 不在过渡列表里**
                 ⇒ 官方 hover 是**瞬间**跳到 1.1、**没有 300ms 缩放动画**。
                 9444 实测（真实鼠标 hover 官方第 0/1 张展开卡，逐帧 16ms 采样）：
                   · 卡片图 `transform: none`（全程），`scale: none → 1.1`（第 1 帧即到位，无中间值）
                   · `getAnimations()` 在 hover 期间为 **[]**（没有任何 CSS transition 在跑）
                   · computed transition = `transform, opacity | 0.3s | cubic-bezier(0.4, 0, 0.2, 1)`（逐字相同）
                   · 图 box 171.4×304.4 → 188.5×334.8（= ×1.1）
                   · 同帧只有卡上的按钮浮层 opacity 在 0→1 过渡（~344ms，`transition-opacity duration-300`）
                 MTV 是 Tailwind **v3**：`scale-110` 编译成 `--tw-scale-*` + **`transform: … scale(1.1)`**，
                 而 `transform` **在**过渡列表里 ⇒ 实测 MTV hover 会跑一段 `transform` 300ms 过渡
                 （逐帧采样：matrix(1)→…→matrix(1.1)，`getAnimations()` = `[{transitionProperty:"transform", duration:300}]`）
                 ⇒ 与官方「瞬跳」不一致，这就是用户看到的「动画不对」✗
                 修法：用 v3 的任意属性语法直接产出**和 v4 同名的 `scale` 属性**，这样
                 ① computed `scale`/`transform` 与官方逐字一致（`scale:1.1` / `transform:none`）；
                 ② `transition-property` 仍是 `transform, opacity`（不覆盖 `scale`）⇒ 同样是瞬跳。 */
              <img
                src={url}
                loading="lazy"
                alt={`Option ${index + 1}`}
                draggable={false}
                className="w-full h-full object-contain transition-[transform,opacity] duration-300 group-hover/item:[scale:1.1] opacity-100"
              />
            )}
            {isOpen && !disabled && (
              <>
                {/* 左上三颗：收藏 / 应用到画布（图标是 copy，tooltip 是官方 i18n）/ 下载 */}
                <div className={`${CARD_ACTION_BASE} top-2 left-2 gap-0.5 px-0.5 py-0.5 opacity-0 pointer-events-none group-hover/item:opacity-100 group-hover/item:pointer-events-auto`}>
                  <button
                    type="button"
                    aria-label={favorited ? t('取消收藏') : t('收藏')}
                    aria-pressed={favorited}
                    data-tooltip={favorited ? t('取消收藏') : t('收藏')}
                    /* 官方 `JI` 的 `className: v ? "text-[#FBBC05] hover:text-[#FBBC05]" : ""`（v = isFavorited） */
                    className={`${GHOST_BUTTON_CLASS}${favorited ? ' text-[#FBBC05] hover:text-[#FBBC05]' : ''}`}
                    onClick={(event) => { event.stopPropagation(); onFavorite(url); }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    {/* 官方 `icon: v ? l.jsx(hh,{size:16}) : l.jsx(Lg,{size:16})`（实心 / 描边两枚不同图标） */}
                    {favorited
                      ? <OfficialGalleryStarFilledIcon size={16} />
                      : <OfficialGalleryStarIcon size={16} />}
                  </button>
                  <button
                    type="button"
                    aria-label={t('应用到画布')}
                    data-tooltip={t('应用到画布')}
                    className={GHOST_BUTTON_CLASS}
                    onClick={(event) => { event.stopPropagation(); onApply(url); }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <OfficialGalleryCopyIcon size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={t('下载')}
                    aria-busy={downloading}
                    data-tooltip={t('下载')}
                    className={GHOST_BUTTON_CLASS}
                    onClick={(event) => { event.stopPropagation(); onDownload(url); }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <OfficialGalleryDownloadIcon size={16} />
                  </button>
                </div>
                {/* 右上「设为主图」药丸（官方对**每一张**都渲染，靠 hover 才浮现） */}
                <div className={`${CARD_ACTION_BASE} top-2 right-2 px-3 py-1.5 opacity-0 pointer-events-none group-hover/item:opacity-100 group-hover/item:pointer-events-auto`}>
                  <button
                    type="button"
                    aria-label={t('设为主图')}
                    data-tooltip={t('设为主图')}
                    className="whitespace-nowrap text-xs font-semibold leading-4 text-[#F5F5F5] cursor-pointer transition-opacity hover:opacity-80"
                    onClick={(event) => { event.stopPropagation(); onSelect(url); }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    {t('设为主图')}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        );
      })}
      {/* 官方 @3238300：展开时垫在 node 自身图片之下（z-[5]）、卡片之下（卡片 z-10）的暗色渐变层 */}
      {isOpen && (
        <div
          className="absolute z-[5] nodrag rounded-3xl"
          style={backdropStyle}
          aria-hidden="true"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      )}
    </>
  );
}
