/**
 * AuthenticityStatusBadge —— 官方 `Ob`（**内容校验 / authenticityCheck 状态徽标**）的逐字移植。
 *
 * 官方出处：`vendor-pkg-canvas-ChpWx5JY.js`@213827（紧随 `Cwe`@213650 之后），官方源码见
 * `D:\DEEPSEEK\_ub_parts\Ob.js`（145 行，已格式化）。官方是 `a.memo(function({status,assetType,
 * variant="inline",size=12,presentation="default",disableTooltip=false}){…})` ⇒ 本文件同样 `memo`。
 *
 * 压缩符号 → 真实定义（**跨 chunk 用「导出名 → 局部名」反查，不做同名猜测**）：
 * | 官方符号 | 来源 | 真实定义 |
 * | --- | --- | --- |
 * | `ro` | canvas `import{a3 as ro}from"./vendor-packages-jvPqKqU8.js"` → 该 chunk `export{d6 as a3}` | 状态枚举 `d6`@173721：`UNKNOWN:"unknown" PENDING:"pending" PROCESSING:"processing" APPROVED:"approved" REJECTED:"rejected" REJECTED_INVALID:"rejected_invalid"` ⇒ 复用 `src/utils/officialAuthenticityCheck.ts` 的 `AuthenticityStatus` |
 * | `S$` | canvas `{ad as S$}` → `export{gle as ad}` | `gle`@173898：`(e)=>e==="pending"||e==="processing"` ⇒ `isAuthenticityInProgress()` |
 * | `Cwe` | 本 chunk @213650 | `{Image:"…invalidParameterImage",Video:"…invalidParameterVideo",Audio:"…invalidParameterAudio"}` ⇒ `AUTHENTICITY_INVALID_PARAMETER_TOOLTIP` |
 * | `Hce` | canvas `{i9 as Hce}` @vendor-libs → `export{gNt as i9}` | `gNt`@1970889 = `p("outline","circle-check","CircleCheck",KSr)` = Tabler **`CircleCheck`** |
 * | `yv` | canvas `{iF as yv}` → `export{u$n as iF}` | `u$n`@3353332 = `p("filled","circle-check-filled","CircleCheckFilled",qOi)` = Tabler **`CircleCheckFilled`** |
 * | `DN` | canvas `{iG as DN}` → `export{fgt as iG}` | `fgt`@1555735 = `p("outline","alert-circle","AlertCircle",jfr)` = Tabler **`AlertCircle`** |
 * | `Dt` | canvas `{k as Dt}` @vendor-packages → `export{Ia as k}` | `Ia`@404206 = Radix tooltip 包装（`{content,side="top",align="center",sideOffset=8,delayDuration=200,className,children}`）⇒ **复用仓库既有同源封装 `src/components/chat/OfficialTooltip.tsx`**（其头注释即按 `Ia` 逐字复刻，props 语义完全一致） |
 *
 * ⚠️ 图标：**仓库并没有安装 `@tabler/icons-react`**（`package.json` 依赖里只有 `lucide-react` 与
 * `@iconify/react`；后者默认联网取图标，仓库里明确弃用过）。因此按仓库既有口径
 * （见 `src/components/chat/MentionLibraryParts.tsx` 头注释、`src/components/nodes/shared/NodeLabel.tsx`）
 * **逐字内联官方 Tabler path 数据**，并保留官方 `tabler-icon tabler-icon-<name>` 类名 ——
 * 既不是「自造 SVG」，也不走会联网的 iconify。path 数据来自上面 3 个 `p(...)` 工厂的第 4 参常量。
 *
 * 类名 / DOM 层级 / 图标 props 一律逐字，唯一的结构性差异是 `withTooltip` 的形参名（官方 `p(m,f,h=!1)`）。
 */
import { memo, type ReactNode } from 'react';
import OfficialTooltip from '../chat/OfficialTooltip';
import { getLocale, useT } from '../../i18n';
import {
  AUTHENTICITY_INVALID_PARAMETER_TOOLTIP,
  authenticityString,
} from '../../services/chat/authenticityStrings';
import {
  isAuthenticityInProgress,
  type AuthenticityStatus,
} from '../../utils/officialAuthenticityCheck';

/* ------------------------------------------------------------------ *
 * 图标（官方 `p` = Tabler `createReactComponent` 的默认属性，逐字）
 * ------------------------------------------------------------------ */

/** 官方 outline 组默认属性（`MentionLibraryParts.tsx` 同口径）。 */
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

/** 官方 **filled** 组默认属性（`fill=currentColor`、`stroke=none`）。 */
const TABLER_FILLED_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  stroke: 'none',
} as const;

/** 官方 Tabler 图标的出口类名（DOM 实测：`tabler-icon tabler-icon-<name>`）。 */
function tablerClassName(name: string, className?: string): string {
  return ['tabler-icon', `tabler-icon-${name}`, className].join(' ');
}

/**
 * 官方 Tabler 图标组件的 props。
 * ⚠️ `size` 官方允许 **number 或 string** —— `Ob` 的 `u` 在 `size` 为 string 时是
 * `` `calc(${size} + 2px)` ``，会原样落到 `<svg width|height>`。
 */
export interface AuthenticityIconProps {
  size?: number | string;
  className?: string;
}

/**
 * 官方 `Hce`（canvas `{i9 as Hce}` @vendor-libs `{gNt as i9}`）= Tabler `CircleCheck`（outline）。
 * 判断依据（path 片段）：`M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0` + `M9 12l2 2l4 -4`。
 */
export function AuthenticityCircleCheckIcon({ size = 24, className }: AuthenticityIconProps) {
  return (
    <svg {...TABLER_OUTLINE_ATTRS} width={size} height={size} className={tablerClassName('circle-check', className)}>
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M9 12l2 2l4 -4" />
    </svg>
  );
}

/**
 * 官方 `yv`（canvas `{iF as yv}` @vendor-libs `{u$n as iF}`）= Tabler `CircleCheckFilled`（filled）。
 * 判断依据：单条 path，`M17 3.34a10 10 0 1 1 -14.995 8.984…`（实心圆 + 白色对勾的合成路径）。
 */
export function AuthenticityCircleCheckFilledIcon({ size = 24, className }: AuthenticityIconProps) {
  return (
    <svg {...TABLER_FILLED_ATTRS} width={size} height={size} className={tablerClassName('circle-check-filled', className)}>
      <path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" />
    </svg>
  );
}

/**
 * 官方 `DN`（canvas `{iG as DN}` @vendor-libs `{fgt as iG}`）= Tabler `AlertCircle`（outline）。
 * 判断依据：`M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0` + `M12 8v4` + `M12 16h.01`。
 */
export function AuthenticityAlertCircleIcon({ size = 24, className }: AuthenticityIconProps) {
  return (
    <svg {...TABLER_OUTLINE_ATTRS} width={size} height={size} className={tablerClassName('alert-circle', className)}>
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 徽标本体（官方 `Ob`）
 * ------------------------------------------------------------------ */

export interface AuthenticityStatusBadgeProps {
  /** 官方 `t`：`ro` 的 6 个取值（`AuthenticityStatus`）。 */
  status: AuthenticityStatus;
  /** 官方 `n`：`Cwe` 的键（`"Image" | "Video" | "Audio"`）；只对 `REJECTED_INVALID` 生效。 */
  assetType?: string;
  /** 官方 `o`：`"inline" | "block"`；`block` 时不加 `truncate`。 */
  variant?: 'inline' | 'block';
  /** 官方 `r`：number ⇒ `12px`，string ⇒ 原样（图标尺寸 `+2` 走 `calc()`）。 */
  size?: number | string;
  /** 官方 `i`：`"node-title"` 走标题行分支。 */
  presentation?: 'default' | 'node-title';
  /** 官方 `l`：true ⇒ 完全**不包** tooltip。 */
  disableTooltip?: boolean;
}

/**
 * 官方 `Ob` 逐字移植。
 *
 * 分支（官方顺序，逐字）：
 *   1. `status === ro.UNKNOWN` ⇒ `return null`（**什么都不渲染**）
 *   2. `status === ro.APPROVED` ⇒ `span.inline-flex items-center shrink-0`，
 *      `presentation==="node-title"` ? `Hce size={size} text-foreground/70`
 *      : `yv size={u} text-primary`
 *   3. `S$(status)`（PENDING / PROCESSING）⇒ `span.inline-flex items-center shrink-0 [truncate]`
 *      + `style={{fontSize:d,lineHeight:1.5}}` + `span.text-[rgba(255,255,255,0.4)]{statusText.pending}`
 *   4. `REJECTED / REJECTED_INVALID` ⇒ invalid 时 tooltip 键取 `Cwe[assetType]`；
 *      非 invalid 且 `node-title` ⇒ `span` + `DN size={size} text-tap-stateWarning/60`；
 *      否则行内文案 `span.text-[#D36A6A]`（`statusText.invalidParameter | statusText.rejected`），
 *      invalid 时 tooltip className = `whitespace-pre-line max-w-xs text-xs leading-relaxed`
 *   5. 其余 ⇒ `return null`
 */
export const AuthenticityStatusBadge = memo(function AuthenticityStatusBadge({
  status,
  assetType,
  variant = 'inline',
  size = 12,
  presentation = 'default',
  disableTooltip = false,
}: AuthenticityStatusBadgeProps) {
  /* 官方 `const{t:c}=se()`：语言切换时重渲染（`useT` 内部 `useSyncExternalStore` 订阅，
     文案本身走 `authenticityString` —— 与 `mentionStrings.ts` 同一套官方 key 口径）。 */
  useT();
  const t = (key: string): string => authenticityString(key, { locale: getLocale() });

  /* 官方 `d` / `u`：number ⇒ `12px` / `14`；string ⇒ 原样 / `calc(<size> + 2px)`。 */
  const fontSize = typeof size === 'number' ? `${size}px` : size;
  const iconSize = typeof size === 'number' ? size + 2 : `calc(${size} + 2px)`;

  /* 官方 `p=(m,f,h=!1)=>l?m:s.jsx(Dt,{content:f,side:"top",className:h?…:void 0,children:m})`。 */
  const withTooltip = (node: ReactNode, content: ReactNode, multiline = false): ReactNode => (
    disableTooltip ? node : (
      <OfficialTooltip
        content={content}
        side="top"
        className={multiline ? 'whitespace-pre-line max-w-xs text-xs leading-relaxed' : undefined}
      >
        {node}
      </OfficialTooltip>
    )
  );

  if (status === 'unknown') return null;

  if (status === 'approved') {
    const isNodeTitle = presentation === 'node-title';
    return withTooltip(
      <span className="inline-flex items-center shrink-0">
        {isNodeTitle
          ? <AuthenticityCircleCheckIcon size={size} className="text-foreground/70" />
          : <AuthenticityCircleCheckFilledIcon size={iconSize} className="text-primary" />}
      </span>,
      t('authenticityCheck.tooltip.approved'),
    );
  }

  if (isAuthenticityInProgress(status)) {
    return withTooltip(
      <span
        className={`inline-flex items-center shrink-0 ${variant === 'block' ? '' : 'truncate'}`}
        style={{ fontSize, lineHeight: 1.5 }}
      >
        <span className="text-[rgba(255,255,255,0.4)]">{t('authenticityCheck.statusText.pending')}</span>
      </span>,
      t('authenticityCheck.tooltip.pending'),
    );
  }

  if (status === 'rejected' || status === 'rejected_invalid') {
    const isInvalid = status === 'rejected_invalid';
    const statusText = t(
      isInvalid ? 'authenticityCheck.statusText.invalidParameter' : 'authenticityCheck.statusText.rejected',
    );
    /* 官方逐字：`let h="authenticityCheck.tooltip.rejected"; m&&(h = n ? Cwe[n] : "…invalidParameter")`。 */
    let tooltipKey = 'authenticityCheck.tooltip.rejected';
    if (isInvalid) {
      tooltipKey = assetType
        ? AUTHENTICITY_INVALID_PARAMETER_TOOLTIP[assetType]
        : 'authenticityCheck.tooltip.invalidParameter';
    }
    if (!isInvalid && presentation === 'node-title') {
      return withTooltip(
        <span className="inline-flex items-center shrink-0">
          <AuthenticityAlertCircleIcon size={size} className="text-tap-stateWarning/60" />
        </span>,
        t(tooltipKey),
      );
    }
    return withTooltip(
      <span
        className={`inline-flex items-center shrink-0 ${variant === 'block' ? '' : 'truncate'}`}
        style={{ fontSize, lineHeight: 1.5 }}
      >
        <span className="text-[#D36A6A]">{statusText}</span>
      </span>,
      t(tooltipKey),
      isInvalid,
    );
  }

  return null;
});
