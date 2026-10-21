/**
 * 官方 `Ub`（`@` 提及建议弹层）—— **资产库 / 方向分组 / 插件行子部件** 的逐字移植。
 *
 * 出处：官方线上 bundle `vendor-pkg-canvas-ChpWx5JY.js`（压缩单行）。
 * 跨 chunk 解析一律走 canvas chunk 顶部 `import{...}from"./..."` 的
 * **导出名 → 局部名** 映射链（`export{local as name}` 反查），不做同名猜测：
 *   canvas 局部 ← 来源 chunk 导出名 ← 该 chunk 局部名（真正的定义）。
 *
 * | 官方符号 | 本文件 | 备注 |
 * | --- | --- | --- |
 * | `Ik` | `MentionAssetRow` | 资产行（`button` + 缩略图 + 名称/路径 + 类型角标） |
 * | `jk` | `MentionAssetThumbnail` | 缩略图（audio/img/video/quote/text/default 六分支） |
 * | `Mk` | `MentionAssetTypeBadge` | 类型角标（`switch(type)`） |
 * | `n_e` | `MentionAssetTypeBadgeFromAssetType` | 类型角标（`switch` 改成资产类型判定，`Ik` 用的是它） |
 * | `t_e` | `MentionAssetRowThumbnail` | `Ik` 前一格缩略图（按 asset 取 src/type） |
 * | `Uv` | `MentionLibrarySearchInput` | 资产库搜索输入框 |
 * | `Am` | `MentionScrollFade` | 滚动渐隐外壳（`forwardRef`） |
 * | `Xwe` | `MentionPluginRow` | 插件行 |
 * | `Zwe` | `MentionGroupRow` | 方向分组行 |
 * | `KM` | `MentionReferenceCard` | 参考图卡（`memo`） |
 * | `e_e` | `MentionAssetRowsSkeleton` | 资产行骨架 |
 * | `Jwe` | `MentionPluginRowsSkeleton` | 插件行骨架 |
 * | `$n` | `MentionSkeletonBlock` | 骨架块（`animate-pulse rounded-md bg-input/30`） |
 * | `TK` | `MentionLazyImage` | 懒加载图（IntersectionObserver，root = scrollRoot） |
 * | `gS` | `MentionMediaPlayOverlay` | 视频播放态浮层 |
 * | `O1` | `MentionAudioRowPlaceholder` | 白底音频行占位 |
 * | `z1` | `MentionTextRowPlaceholder` | 白底文本行占位 |
 * | `Gi`(pill 分支) | `MentionPluginAvatar` | 插件头像胶囊外壳 |
 * | `Qa`/`N$`/`LP` | `MENTION_ROW_CLASS` | **复用** `MentionSuggestionParts.tsx`（不重复定义） |
 * | `hc`/`jP` | `MENTION_ROW_SELECTED_CLASS` | **复用** 同上 |
 *
 * 类串常量逐字（官方符号 → 值）：
 *  · `Xc` → `MENTION_THUMB_FRAME_CLASS`
 *  · `cg` → `MENTION_THUMB_ICON_CLASS`
 *  · `Qwe` → `MENTION_GROUP_ICON_BOX_CLASS`
 *  · `l3` → `MENTION_PLUGIN_AVATAR_CURSOR_CLASS`
 *  · `AR` = 16 → `MENTION_PLUGIN_PILL_DEFAULT_SIZE`；`s3` = 1 → `MENTION_SCROLL_FADE_THRESHOLD`
 *  · `O1`/`z1` 的白底容器类 → `MENTION_ROW_PLACEHOLDER_CLASS`
 *  · `Mk`/`n_e` 的角标类 → `MENTION_TYPE_BADGE_CLASS`
 *
 * 图标：官方这些图标**不是 lucide/tabler 的图形**，而是官方自绘的内联 SVG
 * （`A6`/`E6` 为 48 视框、`Uu` 16 视框、局部 `jk` 14 视框、`KM` 12 视框、`pc` viewBox `-3 0 13 10`…），
 * 因此按源码**逐字节内联 path**，不做「等价替换」。只有 `cf`/`Yl`/`LN`/`tg`/`df`/`yv`
 * 是 Tabler 图标（官方工厂 `p = createReactComponent`，见 `z2r` 默认属性），
 * 它们在此处同样按官方 path 数据内联（仓库未安装 `@tabler/icons-react`；`@iconify/react`
 * 无法离线取到同一份 path），保留官方 `tabler-icon tabler-icon-*` 类名以便逐字对比。
 */
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type SVGProps,
} from 'react';
import { useT } from '../../i18n';
import {
  MENTION_ROW_CLASS,
  MENTION_ROW_SELECTED_CLASS,
  MentionHighlight,
} from './MentionSuggestionParts';

/** 官方 `Qa`(`N$`=`LP`) / `hc`(`jP`) 定义在 `MentionSuggestionParts.tsx`，此处仅再导出。 */
export { MENTION_ROW_CLASS, MENTION_ROW_SELECTED_CLASS };

/* ------------------------------------------------------------------ *
 * 逐字类串常量
 * ------------------------------------------------------------------ */

/** 官方 `Xc`：缩略图外框。 */
export const MENTION_THUMB_FRAME_CLASS =
  'flex size-6 flex-col items-center justify-center aspect-square rounded-[4px] border border-white/10 bg-white/5 shadow-[inset_0_0.5px_0_0_rgba(255,255,255,0.16),0_4px_8px_0_0_rgba(0,0,0,0.16)] overflow-hidden';

/** 官方 `cg`：缩略图内图标。 */
export const MENTION_THUMB_ICON_CLASS = 'size-3 text-white/60';

/** 官方 `Mk`/`n_e` 内联的角标类串。 */
export const MENTION_TYPE_BADGE_CLASS = 'text-[rgba(255,255,255,0.3)] shrink-0';

/** 官方 `O1`/`z1` 的白底容器类串。 */
export const MENTION_ROW_PLACEHOLDER_CLASS =
  'flex items-center justify-center overflow-hidden bg-white shadow-[inset_0_0.5px_0_0_rgba(0,0,0,0.06),0_4px_8px_0_0_rgba(0,0,0,0.16)]';

/** 官方 `Qwe`：分组行图标外框。 */
export const MENTION_GROUP_ICON_BOX_CLASS =
  'flex size-6 shrink-0 items-center justify-center rounded-[4px] border border-white/[0.10] bg-white/[0.05] shadow-[inset_0_0.5px_0_0_rgba(255,255,255,0.16),0_4px_8px_0_0_rgba(0,0,0,0.16)]';

/** 官方 `l3`：插件头像光标。 */
export const MENTION_PLUGIN_AVATAR_CURSOR_CLASS =
  'cursor-default [&_img]:cursor-default [&_svg]:cursor-default';

/** 官方 `AR`：`Gi` 的 `variant="pill"` 默认尺寸。 */
export const MENTION_PLUGIN_PILL_DEFAULT_SIZE = 16;

/** 官方 `s3`：`Am` 判定上下渐隐的滚动阈值。 */
export const MENTION_SCROLL_FADE_THRESHOLD = 1;

/** 官方 `$n`(`bt`) 的骨架块类串（shadcn Skeleton）。 */
export const MENTION_SKELETON_BLOCK_CLASS = 'animate-pulse rounded-md bg-input/30';

/** 官方 `kt`(`ab`) 资产类型枚举（数值逐字：UNSPECIFIED 0 / IMAGE 1 / VIDEO 2 / AUDIO 3 / TEXT 4 / WORLD 5 / ELEMENT 6）。 */
const MENTION_ASSET_TYPE = {
  UNSPECIFIED: 0,
  IMAGE: 1,
  VIDEO: 2,
  AUDIO: 3,
  TEXT: 4,
  WORLD: 5,
  ELEMENT: 6,
} as const;

/** 官方 `nwe`：字符串名 → 资产类型数值。 */
const MENTION_ASSET_TYPE_NAMES: Record<string, number> = {
  ASSET_TYPE_UNSPECIFIED: MENTION_ASSET_TYPE.UNSPECIFIED,
  ASSET_TYPE_IMAGE: MENTION_ASSET_TYPE.IMAGE,
  ASSET_TYPE_VIDEO: MENTION_ASSET_TYPE.VIDEO,
  ASSET_TYPE_AUDIO: MENTION_ASSET_TYPE.AUDIO,
  ASSET_TYPE_TEXT: MENTION_ASSET_TYPE.TEXT,
  ASSET_TYPE_WORLD: MENTION_ASSET_TYPE.WORLD,
  ASSET_TYPE_ELEMENT: MENTION_ASSET_TYPE.ELEMENT,
};

/** 官方 `yc`(`ac`=`HT`) 合规状态枚举（数值逐字）。 */
const MENTION_COMPLIANCE_STATUS = {
  UNSPECIFIED: 0,
  APPROVED: 1,
  REJECTED: 2,
} as const;

/** 官方 `owe`：字符串名 → 合规状态数值。 */
const MENTION_COMPLIANCE_STATUS_NAMES: Record<string, number> = {
  COMPLIANCE_STATUS_UNSPECIFIED: MENTION_COMPLIANCE_STATUS.UNSPECIFIED,
  COMPLIANCE_STATUS_APPROVED: MENTION_COMPLIANCE_STATUS.APPROVED,
  COMPLIANCE_STATUS_REJECTED: MENTION_COMPLIANCE_STATUS.REJECTED,
};

/** 官方 `na`：资产类型归一。 */
function normalizeMentionAssetType(
  value: number | string | null | undefined,
): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const named = MENTION_ASSET_TYPE_NAMES[trimmed];
    if (named != null) return named;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
  }
  return MENTION_ASSET_TYPE.UNSPECIFIED;
}

/** 官方 `B1`：合规状态归一。 */
function normalizeMentionComplianceStatus(
  value: number | string | null | undefined,
): number {
  if (value == null) return MENTION_COMPLIANCE_STATUS.UNSPECIFIED;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const named = MENTION_COMPLIANCE_STATUS_NAMES[trimmed];
    if (named != null) return named;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && Number.isInteger(numeric) && numeric >= 0 && numeric <= 2) return numeric;
  }
  return MENTION_COMPLIANCE_STATUS.UNSPECIFIED;
}

/** 官方 `gi`：`na(e) === kt.ASSET_TYPE_VIDEO`。 */
function isMentionVideoAsset(value: number | string | null | undefined): boolean {
  return normalizeMentionAssetType(value) === MENTION_ASSET_TYPE.VIDEO;
}

/** 官方 `cu`：`na(e) === kt.ASSET_TYPE_AUDIO`。 */
function isMentionAudioAsset(value: number | string | null | undefined): boolean {
  return normalizeMentionAssetType(value) === MENTION_ASSET_TYPE.AUDIO;
}

/** 官方 `t`（i18n）签名。 */
export type MentionTranslate = (text: string, vars?: Record<string, string | number>) => string;

/** 官方 `U1`：文件夹名本地化（只有已知语义名才走词条，否则原样返回）。 */
function localizeMentionFolderName(name: string, translate: MentionTranslate): string {
  const normalized = name.trim().toLowerCase();
  const key =
    normalized === 'favorites'
      ? 'common.favorite'
      : normalized === 'character'
        ? 'library.folders.character'
        : normalized === 'scene'
          ? 'library.folders.scene'
          : normalized === 'item'
            ? 'library.folders.item'
            : normalized === 'style'
              ? 'library.folders.style'
              : normalized === 'sound effect' || normalized === 'sound'
                ? 'library.folders.sound'
                : null;
  return key ? translate(key) : name;
}

/** 官方 `eD`：按 `/` 分段本地化。 */
function localizeMentionFolderPath(path: string, translate: MentionTranslate): string {
  return path.split('/').map((part) => localizeMentionFolderName(part, translate)).join('/');
}

/* ------------------------------------------------------------------ *
 * Tabler 图标（官方工厂 `p` 的 `z2r` 默认属性，逐字）
 * ------------------------------------------------------------------ */

const TABLER_OUTLINE_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const TABLER_FILLED_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  stroke: 'none',
} as const;

/** 官方 `p`(createReactComponent) 的 props。`stroke` 在官方是数值，与 SVG 原生 string 冲突，故一并 Omit。 */
export interface MentionTablerIconProps
  extends Omit<SVGProps<SVGSVGElement>, 'color' | 'stroke' | 'ref'> {
  color?: string;
  size?: number;
  stroke?: number;
  title?: string;
}

function tablerClassName(name: string, className?: string): string {
  return ['tabler-icon', `tabler-icon-${name}`, className].join(' ');
}

function TablerOutlineIcon({
  iconName,
  color = 'currentColor',
  size = 24,
  stroke = 2,
  title,
  className,
  children,
  paths,
  ref,
  ...rest
}: MentionTablerIconProps & {
  iconName: string;
  paths: readonly string[];
  ref?: React.Ref<SVGSVGElement>;
}) {
  return (
    <svg
      ref={ref}
      {...TABLER_OUTLINE_ATTRS}
      width={size}
      height={size}
      className={tablerClassName(iconName, className)}
      strokeWidth={stroke}
      stroke={color}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, index) => (
        <path d={d} key={`svg-${index}`} />
      ))}
      {children}
    </svg>
  );
}

/** 官方 `cf`(`fT`=`p7n` = `p("outline","search","Search",Nki)`)：Tabler `Search`。 */
export const MentionIconSearch = forwardRef<SVGSVGElement, MentionTablerIconProps>(
  function MentionIconSearch(props, ref) {
    return (
      <TablerOutlineIcon
        ref={ref}
        iconName="search"
        paths={['M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6']}
        {...props}
      />
    );
  },
);

/** 官方 `Yl`(`hQ`=`UTt` = `p("outline","chevron-right","ChevronRight",_Sr)`)：Tabler `ChevronRight`。 */
export const MentionIconChevronRight = forwardRef<SVGSVGElement, MentionTablerIconProps>(
  function MentionIconChevronRight(props, ref) {
    return <TablerOutlineIcon ref={ref} iconName="chevron-right" paths={['M9 6l6 6l-6 6']} {...props} />;
  },
);

/** 官方 `LN`(`g6`=`P5n` = `p("outline","quote","Quote",Wyi)`)：Tabler `Quote`。 */
export const MentionIconQuote = forwardRef<SVGSVGElement, MentionTablerIconProps>(
  function MentionIconQuote(props, ref) {
    return (
      <TablerOutlineIcon
        ref={ref}
        iconName="quote"
        paths={[
          'M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5',
          'M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5',
        ]}
        {...props}
      />
    );
  },
);

/** 官方 `tg`(`fM`=`ZLt` = `p("outline","clock","Clock",qRr)`)：Tabler `Clock`（`CK.duration`）。 */
export const MentionIconClock = forwardRef<SVGSVGElement, MentionTablerIconProps>(
  function MentionIconClock(props, ref) {
    return (
      <TablerOutlineIcon
        ref={ref}
        iconName="clock"
        paths={['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3']}
        {...props}
      />
    );
  },
);

/** 官方 `df`(`hl`=`ZTn` = `p("outline","video","Video",STi)`)：Tabler `Video`（`CK.cameraMovement`）。 */
export const MentionIconVideoDirection = forwardRef<SVGSVGElement, MentionTablerIconProps>(
  function MentionIconVideoDirection(props, ref) {
    return (
      <TablerOutlineIcon
        ref={ref}
        iconName="video"
        paths={[
          'M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z',
          'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z',
        ]}
        {...props}
      />
    );
  },
);

/** 官方 `yv`(`iF`=`u$n` = `p("filled","circle-check-filled","CircleCheckFilled",qOi)`)：`o_e` 的已审核徽标。 */
export const MentionIconCircleCheckFilled = forwardRef<SVGSVGElement, MentionTablerIconProps>(
  function MentionIconCircleCheckFilled(
    { color = 'currentColor', size = 24, stroke: _stroke, title, className, children, ...rest },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        {...TABLER_FILLED_ATTRS}
        width={size}
        height={size}
        className={tablerClassName('circle-check-filled', className)}
        fill={color}
        {...rest}
      >
        {title ? <title>{title}</title> : null}
        <path
          d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z"
          key="svg-0"
        />
        {children}
      </svg>
    );
  },
);

/** 官方 `o_e`：已审核徽标（`span.inline-flex` + `yv` size 13 `text-primary`）。 */
export const MentionApprovedBadge = memo(function MentionApprovedBadge() {
  return (
    <span className="inline-flex items-center shrink-0">
      <MentionIconCircleCheckFilled size={13} className="text-primary" />
    </span>
  );
});

/* ------------------------------------------------------------------ *
 * 官方自绘图标（逐字节内联 path）
 * ------------------------------------------------------------------ */

/** 官方自绘图标通用 props。 */
export interface MentionIconProps {
  className?: string;
  size?: number;
  opacity?: number;
}

/** 官方 `es`（es ← E ← A6，vendor-packages 偏移 319667）：视频占位（48 视框，opacity 默认 0.2） */
export function MentionIconVideo({ className, size = 48, opacity = .2 }: MentionIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g opacity={opacity}>
    <path fillRule="evenodd" clipRule="evenodd" d="M31.7998 3C33.727 3 35.293 2.998 36.5606 3.10157C37.8514 3.20704 39.0084 3.43147 40.0859 3.98047C41.7794 4.84333 43.1567 6.22061 44.0195 7.91407C44.5685 8.99162 44.793 10.1486 44.8984 11.4395C45.002 12.7071 45 14.273 45 16.2002V31.7998C45 33.727 45.002 35.293 44.8984 36.5606C44.793 37.8514 44.5685 39.0084 44.0195 40.0859C43.1567 41.7794 41.7794 43.1567 40.0859 44.0195C39.0084 44.5685 37.8514 44.793 36.5606 44.8984C35.293 45.002 33.727 45 31.7998 45H16.2002C14.273 45 12.7071 45.002 11.4395 44.8984C10.1486 44.793 8.99162 44.5685 7.91407 44.0195C6.22061 43.1567 4.84333 41.7794 3.98047 40.0859C3.43147 39.0084 3.20704 37.8514 3.10157 36.5606C2.998 35.293 3 33.727 3 31.7998V16.2002C3 14.273 2.998 12.7071 3.10157 11.4395C3.20704 10.1486 3.43147 8.99162 3.98047 7.91407C4.84333 6.22061 6.22061 4.84333 7.91407 3.98047C8.99162 3.43147 10.1486 3.20704 11.4395 3.10157C12.7071 2.998 14.273 3 16.2002 3H31.7998ZM16.2002 7C14.2072 7 12.8325 7.00173 11.7656 7.08887C10.7223 7.17411 10.1502 7.33114 9.73047 7.54492C8.78966 8.02429 8.02429 8.78966 7.54492 9.73047C7.33114 10.1502 7.17411 10.7223 7.08887 11.7656C7.00173 12.8325 7 14.2072 7 16.2002V31.7998C7 33.7928 7.00173 35.1675 7.08887 36.2344C7.17411 37.2777 7.33114 37.8498 7.54492 38.2695C8.02429 39.2103 8.78967 39.9757 9.73047 40.4551C10.1502 40.6689 10.7223 40.8259 11.7656 40.9111C12.8325 40.9983 14.2072 41 16.2002 41H31.7998C33.7928 41 35.1675 40.9983 36.2344 40.9111C37.2777 40.8259 37.8498 40.6689 38.2695 40.4551C39.2103 39.9757 39.9757 39.2103 40.4551 38.2695C40.6689 37.8498 40.8259 37.2777 40.9111 36.2344C40.9983 35.1675 41 33.7928 41 31.7998V16.2002C41 14.2072 40.9983 12.8325 40.9111 11.7656C40.8259 10.7223 40.6689 10.1502 40.4551 9.73047C39.9757 8.78967 39.2103 8.02429 38.2695 7.54492C37.8498 7.33114 37.2777 7.17411 36.2344 7.08887C35.1675 7.00173 33.7928 7 31.7998 7H16.2002ZM18.5762 19.5801C18.5762 17.9469 20.4979 16.9432 21.9951 17.7949L29.7647 22.2158C31.1977 23.0313 31.1977 24.9687 29.7647 25.7842L21.9951 30.2051C20.4979 31.0568 18.5762 30.0531 18.5762 28.4199V19.5801Z" fill="currentColor" />
    </g>
    </svg>
  );
}

/** 官方 `io`（io ← C ← E6，vendor-packages 偏移 311875）：图片占位（48 视框，opacity 默认 0.2） */
export function MentionIconImage({ className, size = 48, opacity = .2 }: MentionIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g opacity={opacity}>
    <path fillRule="evenodd" clipRule="evenodd" d="M31.7998 3C33.727 3 35.293 2.998 36.5606 3.10157C37.8514 3.20704 39.0084 3.43147 40.0859 3.98047C41.7794 4.84333 43.1567 6.22061 44.0195 7.91407C44.5685 8.99162 44.793 10.1486 44.8984 11.4395C45.002 12.7071 45 14.273 45 16.2002V31.7998C45 33.727 45.002 35.293 44.8984 36.5606C44.793 37.8514 44.5685 39.0084 44.0195 40.0859C43.1567 41.7794 41.7794 43.1567 40.0859 44.0195C39.0084 44.5685 37.8514 44.793 36.5606 44.8984C35.293 45.002 33.727 45 31.7998 45H16.2002C14.273 45 12.7071 45.002 11.4395 44.8984C10.1486 44.793 8.99162 44.5685 7.91407 44.0195C6.22061 43.1567 4.84333 41.7794 3.98047 40.0859C3.43147 39.0084 3.20704 37.8514 3.10157 36.5606C2.998 35.293 3 33.727 3 31.7998V16.2002C3 14.273 2.998 12.7071 3.10157 11.4395C3.20704 10.1486 3.43147 8.99162 3.98047 7.91407C4.84333 6.22061 6.22061 4.84333 7.91407 3.98047C8.99162 3.43147 10.1486 3.20704 11.4395 3.10157C12.7071 2.998 14.273 3 16.2002 3H31.7998ZM16.6064 24.0537C16.0437 23.8709 15.4378 23.871 14.875 24.0537C14.6778 24.1178 14.3958 24.2616 13.8779 24.7012C13.3422 25.156 12.6948 25.8003 11.7207 26.7744L7 31.4951V31.7998C7 33.7928 7.00173 35.1675 7.08887 36.2344C7.17411 37.2777 7.33114 37.8498 7.54492 38.2695C8.02429 39.2103 8.78967 39.9757 9.73047 40.4551C10.1502 40.6689 10.7223 40.8259 11.7656 40.9111C12.8325 40.9983 14.2072 41 16.2002 41H31.7998C32.6238 41 33.342 40.9977 33.9766 40.9912L19.7598 26.7744C18.7856 25.8003 18.1383 25.155 17.6025 24.7002C17.085 24.2609 16.8036 24.1178 16.6064 24.0537ZM16.2002 7C14.2072 7 12.8325 7.00173 11.7656 7.08887C10.7223 7.17411 10.1502 7.33114 9.73047 7.54492C8.78967 8.02429 8.02429 8.78967 7.54492 9.73047C7.33114 10.1502 7.17411 10.7223 7.08887 11.7656C7.00173 12.8325 7 14.2072 7 16.2002V25.8389L8.89258 23.9463C9.82018 23.0187 10.5998 22.2365 11.2891 21.6514C11.9961 21.0511 12.7385 20.5413 13.6377 20.249C15.004 19.8051 16.4765 19.8042 17.8428 20.248C18.742 20.5402 19.4843 21.0511 20.1914 21.6514C20.8807 22.2366 21.6612 23.0186 22.5889 23.9463L38.79 40.1484C39.4929 39.6756 40.0676 39.0301 40.4551 38.2695C40.6689 37.8498 40.8259 37.2777 40.9111 36.2344C40.9983 35.1675 41 33.7928 41 31.7998V16.2002C41 14.2072 40.9983 12.8325 40.9111 11.7656C40.8259 10.7223 40.6689 10.1502 40.4551 9.73047C39.9757 8.78967 39.2103 8.02429 38.2695 7.54492C37.8498 7.33114 37.2777 7.17411 36.2344 7.08887C35.1675 7.00173 33.7928 7 31.7998 7H16.2002ZM31 13C33.2091 13 35 14.7909 35 17C35 19.2091 33.2091 21 31 21C28.7909 21 27 19.2091 27 17C27 14.7909 28.7909 13 31 13Z" fill="currentColor" />
    </g>
    </svg>
  );
}

/** 官方 `xs`（xs ← ar ← Pk 默认分支 Uu，vendor-packages 偏移 309126）：音频波形（16 视框） */
export function MentionIconAudio({ className, size = 48, opacity = .2 }: MentionIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g opacity={opacity}>
    <path d="M6.80013 2.16699C7.07621 2.16706 7.30013 2.39089 7.30013 2.66699V13.3337C7.30013 13.6098 7.07621 13.8336 6.80013 13.8337C6.52399 13.8337 6.30013 13.6098 6.30013 13.3337V2.66699C6.30013 2.39085 6.52399 2.16699 6.80013 2.16699Z" fill="currentColor" />
    <path d="M4.40007 3.94466C4.67614 3.9447 4.90001 4.16859 4.90007 4.44466V10.9632C4.90007 11.2393 4.67618 11.4632 4.40007 11.4632C4.12392 11.4632 3.90007 11.2394 3.90007 10.9632V4.44466C3.90012 4.16857 4.12396 3.94466 4.40007 3.94466Z" fill="currentColor" />
    <path d="M9.19987 5.12988C9.47599 5.12988 9.69983 5.35377 9.69987 5.62988V9.44466C9.69987 9.7208 9.47601 9.94466 9.19987 9.94466C8.92379 9.94459 8.69987 9.72076 8.69987 9.44466V5.62988C8.69991 5.35382 8.92381 5.12995 9.19987 5.12988Z" fill="currentColor" />
    <path d="M2 6.3151C2.27613 6.3151 2.49998 6.53898 2.5 6.8151V8.59277C2.5 8.86892 2.27614 9.09277 2 9.09277C1.72386 9.09277 1.5 8.86892 1.5 8.59277V6.8151C1.50002 6.53898 1.72387 6.3151 2 6.3151Z" fill="currentColor" />
    <path d="M11.5999 3.35221C11.8761 3.35221 12.0999 3.57607 12.0999 3.85221V7.92611C12.0999 8.20225 11.8761 8.42611 11.5999 8.42611C11.3238 8.42607 11.0999 8.20223 11.0999 7.92611V3.85221C11.0999 3.57609 11.3238 3.35225 11.5999 3.35221Z" fill="currentColor" />
    <path d="M14 6.3151C14.2761 6.3151 14.5 6.53898 14.5 6.8151V7.92611C14.5 8.20225 14.2761 8.42611 14 8.42611C13.7239 8.42611 13.5 8.20225 13.5 7.92611V6.8151C13.5 6.53898 13.7239 6.3151 14 6.3151Z" fill="currentColor" />
    <path d="M13.8333 10.8962C13.8333 11.1723 13.6095 11.3962 13.3333 11.3962C13.0572 11.3962 12.8333 11.1723 12.8333 10.8962V10.8337H12.3333V12.8337H12.3958C12.672 12.8337 12.8958 13.0575 12.8958 13.3337C12.8958 13.6098 12.672 13.8337 12.3958 13.8337H11.2708C10.9947 13.8337 10.7708 13.6098 10.7708 13.3337C10.7708 13.0575 10.9947 12.8337 11.2708 12.8337H11.3333V10.8337H10.8333V10.8962C10.8333 11.1723 10.6095 11.3962 10.3333 11.3962C10.0572 11.3962 9.83333 11.1723 9.83333 10.8962V10.5212C9.83333 10.3388 9.9059 10.1641 10.0348 10.0352C10.1638 9.90623 10.3385 9.83366 10.5208 9.83366H13.1458C13.3282 9.83366 13.5029 9.90623 13.6318 10.0352C13.7608 10.1641 13.8333 10.3388 13.8333 10.5212V10.8962Z" fill="currentColor" />
    </g>
    </svg>
  );
}

/** 官方 `ss`（ss ← G ← vendor-packages 局部 jk，偏移 311e3 附近）：文本行（14 视框，opacity 默认 0.6） */
export function MentionIconText({ className, size = 14, opacity = .6 }: MentionIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g opacity={opacity}>
    <path d="M9.71912 10.2559C10.0412 10.2559 10.3021 10.5167 10.3021 10.8389C10.3021 11.161 10.0412 11.4218 9.71912 11.4219H2.04138C1.71938 11.4217 1.45839 11.1609 1.45837 10.8389C1.45837 10.5168 1.71937 10.256 2.04138 10.2559H9.71912ZM7.80017 6.41699C8.12211 6.41721 8.38311 6.67802 8.38318 7C8.38318 7.32203 8.12215 7.58279 7.80017 7.58301H2.04138C1.71937 7.58283 1.45837 7.32206 1.45837 7C1.45844 6.678 1.71941 6.41717 2.04138 6.41699H7.80017ZM11.9584 2.57812C12.2804 2.57812 12.5412 2.8391 12.5414 3.16113C12.5414 3.4833 12.2805 3.74512 11.9584 3.74512H2.04138C1.71937 3.74494 1.45837 3.48319 1.45837 3.16113C1.45853 2.8392 1.71946 2.5783 2.04138 2.57812H11.9584Z" fill="currentColor" />
    </g>
    </svg>
  );
}

/** 官方 `op`（op ← aq ← KM，vendor-packages 偏移 239941）：素材库元素四角星（12 视框，fill #828282） */
export function MentionIconLibraryElement({ className, size = 12 }: MentionIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
    <path d="M6 5.27237L3.36382 2.63618L6 0L8.63618 2.63618L6 5.27237ZM9.36382 8.63618L6.72763 6L9.36382 3.36382L12 6L9.36382 8.63618ZM2.63618 8.63618L0 6L2.63618 3.36382L5.27237 6L2.63618 8.63618ZM6 12L3.36382 9.36382L6 6.72763L8.63618 9.36382L6 12Z" fill="#828282" />
    </svg>
  );
}

/** 官方 `ql`（ql ← as ← pc，vendor-packages 偏移 332853）：播放三角（viewBox "-3 0 13 10"） */
export function MentionIconPlay({ className, size = 12 }: MentionIconProps) {
  return (
    <svg width={size} height={size} viewBox="-3 0 13 10" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M4.75886e-08 1.11137C-5.64416e-05 0.915876 0.050179 0.72383 0.145634 0.554621C0.241089 0.385411 0.378384 0.24503 0.543656 0.147651C0.708928 0.0502717 0.896326 -0.000657228 1.08693 6.40356e-06C1.27753 0.000670035 1.46458 0.0529028 1.62921 0.151431L8.12708 4.03895C8.29106 4.13655 8.4272 4.27657 8.52189 4.44504C8.61658 4.61351 8.6665 4.80451 8.66667 4.99897C8.66683 5.19342 8.61723 5.38451 8.52283 5.55315C8.42843 5.72178 8.29252 5.86205 8.12871 5.95994L1.62921 9.84857C1.46458 9.9471 1.27753 9.99933 1.08693 9.99999C0.896326 10.0007 0.708928 9.94973 0.543656 9.85235C0.378384 9.75497 0.241089 9.61459 0.145634 9.44538C0.050179 9.27617 -5.64416e-05 9.08412 4.75886e-08 8.88863V1.11137Z" fill="currentColor" />
    </svg>
  );
}

/** 官方 `Op`（canvas 导入 a8 ← vendor-packages f6）：音频行占位（12×11） */
export function MentionIconAudioRow({ className, size = 12 }: MentionIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={(size*11/12)} viewBox="0 0 12 11" fill="none" className={className} aria-hidden>
    <path d="M4.6377 0C4.87912 0.000105542 5.07502 0.19609 5.0752 0.4375V9.77148C5.07502 10.0129 4.87912 10.2089 4.6377 10.209C4.39618 10.209 4.20037 10.013 4.2002 9.77148V0.4375C4.20037 0.196025 4.39618 0 4.6377 0ZM8.83789 1.03711C9.07921 1.03735 9.27524 1.23326 9.27539 1.47461V8.21582C9.27527 8.4572 9.07924 8.65308 8.83789 8.65332C8.59636 8.65329 8.40051 8.45733 8.40039 8.21582V1.47461C8.40054 1.23313 8.59639 1.03714 8.83789 1.03711ZM2.53711 1.55566C2.77864 1.55569 2.97449 1.75166 2.97461 1.99316V7.69727C2.97448 7.93876 2.77863 8.13473 2.53711 8.13477C2.29577 8.13452 2.09974 7.93863 2.09961 7.69727V1.99316C2.09973 1.75179 2.29576 1.55591 2.53711 1.55566ZM6.7373 2.59277C6.97888 2.59277 7.17473 2.78872 7.1748 3.03027V6.66016C7.17469 6.90169 6.97886 7.09766 6.7373 7.09766C6.49584 7.09755 6.29991 6.90162 6.2998 6.66016V3.03027C6.29988 2.78878 6.49582 2.59288 6.7373 2.59277ZM0.4375 3.62988C0.6791 3.62988 0.874961 3.82579 0.875 4.06738V5.62305C0.874912 5.8646 0.67907 6.06055 0.4375 6.06055C0.19593 6.06055 8.79563e-05 5.8646 0 5.62305V4.06738C3.91341e-05 3.82579 0.1959 3.62988 0.4375 3.62988ZM10.9375 3.62988C11.1791 3.62988 11.375 3.82579 11.375 4.06738V5.62305C11.3749 5.8646 11.1791 6.06055 10.9375 6.06055C10.6959 6.06055 10.5001 5.8646 10.5 5.62305V4.06738C10.5 3.82579 10.6959 3.62988 10.9375 3.62988Z" fill="currentColor" />
    </svg>
  );
}

/** 官方 `cx`（canvas 导入 a9 ← vendor-packages I6）：文本行占位（10×11） */
export function MentionIconTextRow({ className, size = 12 }: MentionIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 10 11" preserveAspectRatio="xMidYMid meet" fill="none" className={className} aria-hidden>
    <path d="M9.1875 0C9.42912 0 9.625 0.195875 9.625 0.4375V2.1875C9.625 2.42912 9.42912 2.625 9.1875 2.625C8.94588 2.625 8.75 2.42912 8.75 2.1875V0.875H5.25V9.33333H6.27083C6.51246 9.33333 6.70833 9.52921 6.70833 9.77083C6.70833 10.0125 6.51246 10.2083 6.27083 10.2083H3.35417C3.11254 10.2083 2.91667 10.0125 2.91667 9.77083C2.91667 9.52921 3.11254 9.33333 3.35417 9.33333H4.375V0.875H0.875V2.1875C0.875 2.42912 0.679125 2.625 0.4375 2.625C0.195875 2.625 0 2.42912 0 2.1875V0.4375C0 0.195875 0.195875 0 0.4375 0H9.1875Z" fill="currentColor" />
    </svg>
  );
}

/** 官方 `Ape`（canvas 导入 ai ← vendor-packages jM）：运镜分组图标（16 视框） */
export function MentionIconCameraShot({ className, size = 16 }: MentionIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12.2507 10.3896C12.4038 10.1599 12.7142 10.0978 12.944 10.251C13.1738 10.4042 13.2359 10.7146 13.0827 10.9443L12.2676 12.167H14C14.1844 12.167 14.3537 12.2685 14.4408 12.431C14.5278 12.5936 14.5183 12.7909 14.416 12.9443L13.0827 14.9443C12.9295 15.1741 12.6191 15.2362 12.3893 15.083C12.1596 14.9298 12.0975 14.6194 12.2507 14.3896L13.0658 13.167H11.3333C11.149 13.167 10.9796 13.0655 10.8926 12.903C10.8056 12.7404 10.815 12.5431 10.9173 12.3896L12.2507 10.3896ZM9.5 8.66699C9.5 8.26917 9.34185 7.88775 9.06055 7.60645C8.77924 7.32514 8.39783 7.16699 8 7.16699C7.60217 7.16699 7.22076 7.32514 6.93945 7.60645C6.65815 7.88775 6.5 8.26917 6.5 8.66699C6.5 9.06482 6.65815 9.44623 6.93945 9.72754C7.22076 10.0088 7.60217 10.167 8 10.167C8.39783 10.167 8.77924 10.0088 9.06055 9.72754C9.34185 9.44623 9.5 9.06482 9.5 8.66699ZM13.5 8.33366V6.00033C13.5 5.77931 13.4121 5.56741 13.2559 5.41113C13.0996 5.25485 12.8877 5.16699 12.6667 5.16699H12C11.5138 5.16699 11.0476 4.9737 10.7038 4.62988C10.36 4.28607 10.1667 3.81989 10.1667 3.33366C10.1667 3.28946 10.1491 3.24708 10.1178 3.21582C10.0866 3.18456 10.0442 3.16699 10 3.16699H6C5.9558 3.16699 5.91342 3.18456 5.88216 3.21582C5.85091 3.24708 5.83333 3.28946 5.83333 3.33366C5.83333 3.81989 5.64004 4.28607 5.29622 4.62988C4.95241 4.9737 4.48623 5.16699 4 5.16699H3.33333C3.11232 5.16699 2.90042 5.25485 2.74414 5.41113C2.58786 5.56741 2.5 5.77931 2.5 6.00033V12.0003C2.5 12.2213 2.58786 12.4332 2.74414 12.5895C2.90042 12.7458 3.11232 12.8337 3.33333 12.8337H8.66667C8.94281 12.8337 9.16667 13.0575 9.16667 13.3337C9.16667 13.6098 8.94281 13.8337 8.66667 13.8337H3.33333C2.8471 13.8337 2.38093 13.6404 2.03711 13.2965C1.69329 12.9527 1.5 12.4866 1.5 12.0003V6.00033C1.5 5.5141 1.69329 5.04792 2.03711 4.7041C2.38093 4.36028 2.8471 4.16699 3.33333 4.16699H4C4.22101 4.16699 4.43291 4.07913 4.58919 3.92285C4.74547 3.76657 4.83333 3.55467 4.83333 3.33366C4.83333 3.02424 4.95634 2.72758 5.17513 2.50879C5.39392 2.29 5.69058 2.16699 6 2.16699H10C10.3094 2.16699 10.6061 2.29 10.8249 2.50879C11.0437 2.72758 11.1667 3.02424 11.1667 3.33366C11.1667 3.55467 11.2545 3.76657 11.4108 3.92285C11.5671 4.07913 11.779 4.16699 12 4.16699H12.6667C13.1529 4.16699 13.6191 4.36029 13.9629 4.7041C14.3067 5.04792 14.5 5.5141 14.5 6.00033V8.33366C14.5 8.6098 14.2761 8.83366 14 8.83366C13.7239 8.83366 13.5 8.6098 13.5 8.33366ZM10.5 8.66699C10.5 9.33003 10.2367 9.96606 9.7679 10.4349C9.29906 10.9037 8.66304 11.167 8 11.167C7.33696 11.167 6.70094 10.9037 6.2321 10.4349C5.76326 9.96606 5.5 9.33003 5.5 8.66699C5.5 8.00395 5.76326 7.36793 6.2321 6.89909C6.70094 6.43025 7.33696 6.16699 8 6.16699C8.66304 6.16699 9.29906 6.43025 9.7679 6.89909C10.2367 7.36793 10.5 8.00395 10.5 8.66699Z" fill="currentColor" fillOpacity="0.9" />
    </svg>
  );
}

/** 官方 `kpe`（canvas 导入 ah ← vendor-packages Qk）：变速分组图标（16 视框） */
export function MentionIconSpeedRamp({ className, size = 16 }: MentionIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M7.99989 2.16699C9.28546 2.16699 10.5423 2.54814 11.6112 3.26237C12.6801 3.97659 13.5131 4.99199 14.0051 6.17969C14.497 7.36733 14.6256 8.67411 14.3749 9.9349C14.1241 11.1957 13.5052 12.354 12.5962 13.263C12.401 13.4583 12.0841 13.4583 11.8889 13.263C11.6938 13.0678 11.6937 12.7512 11.8889 12.556C12.6581 11.7868 13.1819 10.8068 13.3941 9.73991C13.6063 8.67302 13.4975 7.56715 13.0813 6.56217C12.665 5.55719 11.96 4.69809 11.0556 4.09375C10.1511 3.48943 9.08766 3.16699 7.99989 3.16699C6.91211 3.16699 5.84868 3.48943 4.94422 4.09375C4.03976 4.69809 3.33479 5.55719 2.91851 6.56217C2.50223 7.56715 2.39348 8.67302 2.60568 9.73991C2.8179 10.8068 3.34171 11.7868 4.11089 12.556C4.30609 12.7512 4.30602 13.0678 4.11089 13.263C3.91563 13.4583 3.59879 13.4583 3.40353 13.263C2.49457 12.354 1.87567 11.1957 1.62489 9.9349C1.37413 8.67411 1.50277 7.36733 1.99468 6.17969C2.48664 4.992 3.31967 3.97659 4.38856 3.26237C5.45748 2.54814 6.71431 2.16699 7.99989 2.16699ZM10.313 5.64681C10.5083 5.45155 10.8248 5.45155 11.0201 5.64681C11.2153 5.84207 11.2153 6.15859 11.0201 6.35384L8.3534 9.02051C8.15815 9.21574 7.84163 9.21574 7.64637 9.02051C7.45112 8.82525 7.45114 8.50874 7.64637 8.31348L10.313 5.64681Z" fill="currentColor" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 官方 `$n` / `TK` / `gS` / `O1` / `z1`
 * ------------------------------------------------------------------ */

/** 官方 `$n`(`bt`)：骨架块（`cx("animate-pulse rounded-md bg-input/30", className)`）。 */
export const MentionSkeletonBlock = memo(function MentionSkeletonBlock({
  className,
}: {
  className?: string;
}) {
  return <div className={className ? `${MENTION_SKELETON_BLOCK_CLASS} ${className}` : MENTION_SKELETON_BLOCK_CLASS} />;
});

/** 官方 `TK`：进入 `scrollRoot` 视口后才挂 `src` 的懒加载图。 */
export const MentionLazyImage = memo(function MentionLazyImage({
  src,
  alt = '',
  className,
  style,
  onLoad,
  scrollRoot,
}: {
  src?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  scrollRoot?: RefObject<HTMLElement | null>;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [visible, setVisible] = useState(!scrollRoot);

  useEffect(() => {
    if (!scrollRoot || !src) return;
    const element = imageRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot.current ?? null, rootMargin: '100px', threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
    // 官方 deps 数组逐字为 `[e]`（仅 src）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <img
      ref={imageRef}
      src={visible ? src : undefined}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      onLoad={onLoad}
    />
  );
});

/** 官方 `gS`：视频播放态浮层（`span.absolute.inset-0` + `ql` size 默认 10）。 */
export const MentionMediaPlayOverlay = memo(function MentionMediaPlayOverlay({
  size = 10,
}: {
  size?: number;
}) {
  return (
    <span
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      <MentionIconPlay
        size={size}
        className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
      />
    </span>
  );
});

/** 官方 `O1`：白底音频行占位（`variant` 默认 `"row"`）。 */
export const MentionAudioRowPlaceholder = memo(function MentionAudioRowPlaceholder({
  className,
  variant = 'row',
}: {
  className?: string;
  variant?: 'row' | 'grid';
}) {
  return (
    <div
      className={`${MENTION_ROW_PLACEHOLDER_CLASS}${variant === 'row' ? ' size-6 shrink-0 rounded-[4px]' : ''}${variant === 'grid' ? ' h-full w-full rounded-lg' : ''}${className ? ` ${className}` : ''}`}
    >
      <MentionIconAudioRow size={variant === 'row' ? 12 : 32} className="shrink-0 text-black" />
    </div>
  );
});

/** 官方 `z1`：白底文本行占位（`variant` 默认 `"row"`）。 */
export const MentionTextRowPlaceholder = memo(function MentionTextRowPlaceholder({
  className,
  variant = 'row',
}: {
  className?: string;
  variant?: 'row' | 'grid';
}) {
  return (
    <div
      className={`${MENTION_ROW_PLACEHOLDER_CLASS}${variant === 'row' ? ' size-6 shrink-0 rounded-[4px]' : ''}${variant === 'grid' ? ' h-full w-full rounded-lg' : ''}${className ? ` ${className}` : ''}`}
    >
      <MentionIconTextRow size={variant === 'row' ? 12 : 32} className="shrink-0 text-black" />
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `Mk` / `n_e`：类型角标
 * ------------------------------------------------------------------ */

/** 官方 `Mk`：按字符串 `type` 出角标，未识别返回 `null`。 */
export const MentionAssetTypeBadge = memo(function MentionAssetTypeBadge({
  type,
}: {
  type?: string;
}) {
  switch (type) {
    case 'video':
      return <MentionIconVideo size={14} className={MENTION_TYPE_BADGE_CLASS} opacity={1} />;
    case 'image':
      return <MentionIconImage size={14} className={MENTION_TYPE_BADGE_CLASS} opacity={1} />;
    case 'audio':
      return <MentionIconAudio size={14} className={MENTION_TYPE_BADGE_CLASS} opacity={1} />;
    case 'text':
      return <MentionIconText size={14} className={MENTION_TYPE_BADGE_CLASS} opacity={1} />;
    case 'quote':
      return <MentionIconQuote size={14} className={MENTION_TYPE_BADGE_CLASS} strokeWidth={1.5} />;
    case 'library_element':
      return <MentionIconLibraryElement size={14} className={MENTION_TYPE_BADGE_CLASS} />;
    default:
      return null;
  }
});

/** 官方 `n_e`：按资产类型数值/名出角标（`Ik` 资产行用的就是这个）。 */
export const MentionAssetTypeBadgeFromAssetType = memo(function MentionAssetTypeBadgeFromAssetType({
  assetType,
}: {
  assetType?: number | string | null;
}) {
  const badgeClass = MENTION_TYPE_BADGE_CLASS;
  if (isMentionVideoAsset(assetType)) {
    return <MentionIconVideo size={14} className={badgeClass} opacity={1} />;
  }
  if (normalizeMentionAssetType(assetType) === MENTION_ASSET_TYPE.IMAGE) {
    return <MentionIconImage size={14} className={badgeClass} opacity={1} />;
  }
  if (isMentionAudioAsset(assetType)) {
    return <MentionIconAudio size={14} className={badgeClass} opacity={1} />;
  }
  if (normalizeMentionAssetType(assetType) === MENTION_ASSET_TYPE.TEXT) {
    return <MentionIconText size={14} className={badgeClass} opacity={1} />;
  }
  return null;
});

/* ------------------------------------------------------------------ *
 * 官方 `jk` / `t_e`：缩略图
 * ------------------------------------------------------------------ */

/** 官方缩略图 props。 */
export interface MentionAssetThumbnailProps {
  src?: string;
  videoSrc?: string;
  type?: string;
  scrollRoot?: RefObject<HTMLElement | null>;
}

/** 官方 `jk`：资产缩略图（六分支，顺序逐字）。 */
export const MentionAssetThumbnail = memo(function MentionAssetThumbnail({
  src,
  videoSrc,
  type,
  scrollRoot,
}: MentionAssetThumbnailProps) {
  if (type === 'audio') return <MentionAudioRowPlaceholder variant="row" />;
  if (src) {
    return (
      <div className={MENTION_THUMB_FRAME_CLASS}>
        <MentionLazyImage src={src} className="block size-6 object-cover" scrollRoot={scrollRoot} />
      </div>
    );
  }
  if (type === 'video' && videoSrc) {
    return (
      <div className={`${MENTION_THUMB_FRAME_CLASS} relative`}>
        <video
          src={videoSrc}
          className="block size-6 object-cover"
          muted
          playsInline
          preload="metadata"
        />
        <MentionMediaPlayOverlay size={10} />
      </div>
    );
  }
  switch (type) {
    case 'text':
      return <MentionTextRowPlaceholder variant="row" />;
    case 'quote':
      return (
        <div className={MENTION_THUMB_FRAME_CLASS}>
          <MentionIconQuote size={12} className={MENTION_THUMB_ICON_CLASS} strokeWidth={1.5} />
        </div>
      );
    case 'video':
      return (
        <div className={`${MENTION_THUMB_FRAME_CLASS} relative`}>
          <MentionIconVideo className={MENTION_THUMB_ICON_CLASS} opacity={1} />
          <MentionMediaPlayOverlay size={8} />
        </div>
      );
    default:
      return (
        <div className={MENTION_THUMB_FRAME_CLASS}>
          <MentionIconImage className={MENTION_THUMB_ICON_CLASS} opacity={1} />
        </div>
      );
  }
});

/** 官方 `t_e` 需要的资产最小字段。 */
export interface MentionAssetLike {
  name: string;
  assetType?: number | string | null;
  thumbnailUrl?: string;
  sourceUrl?: string;
  folderDisplayPath?: string;
  folderName?: string;
  complianceStatus?: number | string | null;
}

/** 官方 `t_e`：`Ik` 行首缩略图（先看 audio → text，再按 src/type 分支）。 */
export const MentionAssetRowThumbnail = memo(function MentionAssetRowThumbnail({
  asset,
  scrollRoot,
}: {
  asset: MentionAssetLike;
  scrollRoot?: RefObject<HTMLElement | null>;
}) {
  const src = asset.thumbnailUrl || asset.sourceUrl || undefined;
  const assetType = asset.assetType;
  if (isMentionAudioAsset(assetType)) return <MentionAudioRowPlaceholder variant="row" />;
  if (normalizeMentionAssetType(assetType) === MENTION_ASSET_TYPE.TEXT) {
    return <MentionTextRowPlaceholder variant="row" />;
  }
  if (src) {
    if (isMentionVideoAsset(assetType)) {
      return (
        <div className={`${MENTION_THUMB_FRAME_CLASS} relative`}>
          <video
            src={src}
            className="block size-6 object-cover"
            muted
            playsInline
            preload="metadata"
          />
          <MentionMediaPlayOverlay size={10} />
        </div>
      );
    }
    return (
      <div className={MENTION_THUMB_FRAME_CLASS}>
        <MentionLazyImage src={src} className="block size-6 object-cover" scrollRoot={scrollRoot} />
      </div>
    );
  }
  if (isMentionVideoAsset(assetType)) {
    return (
      <div className={`${MENTION_THUMB_FRAME_CLASS} relative`}>
        <MentionIconVideo className={MENTION_THUMB_ICON_CLASS} opacity={1} />
        <MentionMediaPlayOverlay size={8} />
      </div>
    );
  }
  return (
    <div className={MENTION_THUMB_FRAME_CLASS}>
      <MentionIconImage className={MENTION_THUMB_ICON_CLASS} opacity={1} />
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `Ik`：资产行
 * ------------------------------------------------------------------ */

/** 官方 `Ik` props。 */
export interface MentionAssetRowProps {
  asset: MentionAssetLike;
  globalIndex: number;
  isSelected?: boolean;
  onClick?: () => void;
  keyword?: string;
  scrollRoot?: RefObject<HTMLElement | null>;
  hidePath?: boolean;
  disabled?: boolean;
}

/** 官方 `Ik`：资产库资产行。 */
export const MentionAssetRow = memo(function MentionAssetRow({
  asset,
  globalIndex,
  isSelected,
  onClick,
  keyword,
  scrollRoot,
  hidePath,
  disabled,
}: MentionAssetRowProps) {
  const t = useT();
  const approved = normalizeMentionComplianceStatus(asset.complianceStatus) === MENTION_COMPLIANCE_STATUS.APPROVED;
  const folderPath = useMemo(() => {
    const localized = localizeMentionFolderPath(asset.folderDisplayPath ?? '', t);
    return localized || localizeMentionFolderName(asset.folderName ?? '', t) || '/';
  }, [asset.folderDisplayPath, asset.folderName, t]);

  return (
    <button
      type="button"
      data-selectable-index={disabled ? undefined : globalIndex >= 0 ? globalIndex : undefined}
      className={`${MENTION_ROW_CLASS}${!disabled && isSelected ? ` ${MENTION_ROW_SELECTED_CLASS}` : ''}${disabled ? ' opacity-35 cursor-not-allowed' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      <MentionAssetRowThumbnail asset={asset} scrollRoot={scrollRoot} />
      <span className="flex-1 min-w-0 flex flex-col gap-0">
        <span className="flex items-center gap-1 min-w-0">
          <span className="text-[13px] font-medium leading-[18px] text-white/80 truncate">
            <MentionHighlight text={asset.name} keyword={keyword} />
          </span>
          {approved ? <MentionApprovedBadge /> : null}
        </span>
        {!hidePath ? (
          <span className="text-[11px] leading-[14px] text-white/35 truncate">{folderPath}</span>
        ) : null}
      </span>
      <MentionAssetTypeBadgeFromAssetType assetType={asset.assetType} />
    </button>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `Uv`：资产库搜索输入框
 * ------------------------------------------------------------------ */

/** 官方 `Uv` props。 */
export interface MentionLibrarySearchInputProps {
  value: string;
  onChange?: (value: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  wrapperClassName?: string;
  barClassName?: string;
  inputClassName?: string;
}

/** 官方 `Uv`：资产库搜索输入框。 */
export const MentionLibrarySearchInput = memo(function MentionLibrarySearchInput({
  value,
  onChange = () => {},
  onKeyDown,
  onBlur,
  placeholder,
  inputRef,
  wrapperClassName,
  barClassName,
  inputClassName,
}: MentionLibrarySearchInputProps) {
  return (
    <div
      className={`w-full shrink-0 px-2 pt-1 pb-1${wrapperClassName ? ` ${wrapperClassName}` : ''}`}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className={`flex h-[32px] w-full items-center gap-[6px] rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-2${barClassName ? ` ${barClassName}` : ''}`}
      >
        <MentionIconSearch size={14} className="shrink-0 text-white/40" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] leading-[18px] text-white/80 outline-none placeholder:text-white/30${inputClassName ? ` ${inputClassName}` : ''}`}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `Am`：滚动渐隐外壳
 * ------------------------------------------------------------------ */

/** 官方 `Am` props。 */
export interface MentionScrollFadeProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
  fadeColor?: string;
  deps?: unknown[];
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

/** 官方 `Am`：上下渐隐遮罩 + 隐藏滚动条的外壳（`forwardRef`）。 */
export const MentionScrollFade = forwardRef<HTMLDivElement, MentionScrollFadeProps>(
  function MentionScrollFade(
    { children, className, fadeColor = 'var(--popover)', deps = [], onScroll, ...rest },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [showTop, setShowTop] = useState(false);
    const [showBottom, setShowBottom] = useState(false);

    const measureScroll = useCallback(() => {
      const node = scrollRef.current;
      if (!node) return;
      setShowTop(node.scrollTop > MENTION_SCROLL_FADE_THRESHOLD);
      setShowBottom(
        node.scrollTop + node.clientHeight < node.scrollHeight - MENTION_SCROLL_FADE_THRESHOLD,
      );
    }, []);

    const attachRef = useCallback(
      (node: HTMLDivElement | null) => {
        scrollRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const depsKey = JSON.stringify(deps);

    useEffect(() => {
      const node = scrollRef.current;
      if (!node) return;
      measureScroll();
      if (typeof ResizeObserver !== 'function') return;
      const observer = new ResizeObserver(measureScroll);
      observer.observe(node);
      return () => observer.disconnect();
      // 官方 deps 数组逐字为 `[h, x]`（h 为稳定 useCallback，x 为 JSON.stringify(deps)）。
    }, [measureScroll, depsKey]);

    return (
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 z-[1] h-5 transition-opacity duration-150 ${showTop ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: `linear-gradient(to bottom, ${fadeColor}, transparent)` }}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-5 transition-opacity duration-150 ${showBottom ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: `linear-gradient(to top, ${fadeColor}, transparent)` }}
        />
        <div
          ref={attachRef}
          className={`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden${className ? ` ${className}` : ''}`}
          onScroll={(event) => {
            measureScroll();
            onScroll?.(event);
          }}
          {...rest}
        >
          {children}
        </div>
      </div>
    );
  },
);

/* ------------------------------------------------------------------ *
 * 官方 `Gi`(pill) / `Xwe`：插件行
 * ------------------------------------------------------------------ */

/** 官方 `Gi` 的 `variant="pill"` props（其余变体不在本次范围）。 */
export interface MentionPluginAvatarProps {
  size?: number;
  className?: string;
  children?: ReactNode;
}

/** 官方 `Gi`（`variant="pill"` 分支）：插件头像胶囊外壳。 */
export const MentionPluginAvatar = memo(function MentionPluginAvatar({
  size = MENTION_PLUGIN_PILL_DEFAULT_SIZE,
  className,
  children,
}: MentionPluginAvatarProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] ${MENTION_PLUGIN_AVATAR_CURSOR_CLASS}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, aspectRatio: '1 / 1', cursor: 'default' }}
      aria-hidden
    >
      {children}
    </span>
  );
});

/** 官方 `Xwe` 的插件字段。 */
export interface MentionPluginLike {
  pluginName: string;
  displayName: string;
  iconUrl?: string;
}

/** 官方 `Xwe` props。 */
export interface MentionPluginRowProps {
  plugin: MentionPluginLike;
  globalIndex: number;
  isSelected?: boolean;
  onClick?: () => void;
  /**
   * 官方此处渲染 `Gi`（`variant="pill"`、`size=24`），其内部 `fk` 是插件图标分发器
   * （依赖 `Ibe` / `_f` 等插件注册表），本次未移植 ⇒ 由调用方注入。
   * 不传时仍渲染官方那层胶囊外壳（尺寸/类串逐字）。
   */
  avatar?: ReactNode;
}

/** 官方 `Xwe`：插件行。 */
export const MentionPluginRow = memo(function MentionPluginRow({
  plugin,
  globalIndex,
  isSelected,
  onClick,
  avatar,
}: MentionPluginRowProps) {
  return (
    <button
      type="button"
      data-selectable-index={globalIndex >= 0 ? globalIndex : undefined}
      className={`${MENTION_ROW_CLASS}${isSelected ? ` ${MENTION_ROW_SELECTED_CLASS}` : ''}`}
      onClick={onClick}
    >
      {avatar ?? <MentionPluginAvatar size={24} />}
      <span className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-white/90">
          {plugin.displayName}
        </span>
      </span>
    </button>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `Zwe`：方向分组行
 * ------------------------------------------------------------------ */

/** 官方 `CK`：方向分组图标表。 */
const MENTION_GROUP_ICONS: Record<
  string,
  React.ComponentType<MentionIconProps> | undefined
> = {
  duration: MentionIconClock,
  cameraShot: MentionIconCameraShot,
  cameraMovement: MentionIconVideoDirection,
  speedRamp: MentionIconSpeedRamp,
};

/** 官方 `Qwe`：分组行图标外框。 */
export const MentionGroupIconBox = memo(function MentionGroupIconBox({
  children,
}: {
  children?: ReactNode;
}) {
  return <span className={MENTION_GROUP_ICON_BOX_CLASS}>{children}</span>;
});

/** 官方 `Zwe` 的分组字段。 */
export interface MentionGroupLike {
  id: string;
  label: string;
  selectionMode?: string;
}

/** 官方 `Zwe` props。 */
export interface MentionGroupRowProps {
  group: MentionGroupLike;
  globalIndex: number;
  isSelected?: boolean;
  onClick?: () => void;
}

/** 官方 `Zwe`：方向分组行。 */
export const MentionGroupRow = memo(function MentionGroupRow({
  group,
  globalIndex,
  isSelected,
  onClick,
}: MentionGroupRowProps) {
  const GroupIcon = MENTION_GROUP_ICONS[group.id];
  return (
    <button
      type="button"
      data-selectable-index={globalIndex >= 0 ? globalIndex : undefined}
      className={`${MENTION_ROW_CLASS}${isSelected ? ` ${MENTION_ROW_SELECTED_CLASS}` : ''}`}
      onClick={onClick}
    >
      <MentionGroupIconBox>
        {GroupIcon ? <GroupIcon size={16} className="shrink-0 text-white/60" /> : null}
      </MentionGroupIconBox>
      <span className="flex-1 min-w-0 text-sm font-medium leading-5 text-white/90 truncate">
        {group.label}
      </span>
      {group.selectionMode !== 'direct' ? (
        <span className="shrink-0 text-white/30">
          <MentionIconChevronRight size={16} />
        </span>
      ) : null}
    </button>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `KM`：参考图卡
 * ------------------------------------------------------------------ */

/** 官方 `KM` 的条目字段。 */
export interface MentionReferenceItem {
  image_url: string;
  film_name?: string;
}

/** 官方 `KM` props。 */
export interface MentionReferenceCardProps {
  item: MentionReferenceItem;
  index: number;
  onClick?: () => void;
}

/** 官方 `KM`：参考图卡（`memo`，加载完成后才显示标题遮罩）。 */
export const MentionReferenceCard = memo(function MentionReferenceCard({
  item,
  index,
  onClick,
}: MentionReferenceCardProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="group relative h-40 cursor-pointer overflow-hidden rounded-xl bg-white/[0.06]"
      onClick={onClick}
    >
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse rounded-xl bg-white/[0.06]" />
      ) : null}
      <img
        src={item.image_url}
        alt={item.film_name || `Reference ${index + 1}`}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none hover:scale-[1.03]${!loaded ? ' opacity-0' : ''}`}
      />
      {loaded ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-2.5 pb-2 pt-6">
          {item.film_name ? (
            <div className="max-w-[80%] truncate text-[10px] font-medium text-white/95">
              {item.film_name}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 官方 `e_e` / `Jwe`：骨架屏
 * ------------------------------------------------------------------ */

/** 官方 `e_e`：资产行骨架（`$n` 三块，中间为横向两列）。 */
export const MentionAssetRowsSkeleton = memo(function MentionAssetRowsSkeleton({
  count,
}: {
  count: number;
}) {
  return (
    <div className="flex w-full flex-col gap-[2px]">
      {Array.from({ length: count }, (_, index) => (
        <div className={`${MENTION_ROW_CLASS} pointer-events-none`} key={index}>
          <MentionSkeletonBlock className="size-6 shrink-0 rounded-[4px]" />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <MentionSkeletonBlock className="h-5 w-16 rounded" />
            <MentionSkeletonBlock className="h-4 flex-1 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
});

/** 官方 `Jwe`：插件行骨架（`$n` 三块，横向三段）。 */
export const MentionPluginRowsSkeleton = memo(function MentionPluginRowsSkeleton({
  count,
}: {
  count: number;
}) {
  return (
    <div className="flex w-full flex-col gap-[2px]">
      {Array.from({ length: count }, (_, index) => (
        <div className={`${MENTION_ROW_CLASS} pointer-events-none`} key={index}>
          <MentionSkeletonBlock className="size-5 shrink-0 rounded-[4px]" />
          <MentionSkeletonBlock className="h-4 flex-1 rounded" />
          <MentionSkeletonBlock className="size-4 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
});
