/**
 * 确认卡族用到的官方图标 —— **内联官方 path**，保留官方类名口径。
 *
 * ⚠️ 修正文档 §0.1 的一处错误：文档把 `Yl`(`ChevronRight`) / `Hl`(`ChevronDown`) / `Ji`(`Lock`)
 * 记成 lucide。**实测源码不是**：三者都是 Tabler —— 它们经
 * `import{… hQ as Yl …}from"./vendor-libs-CQ5RMq_I.js"`，在 vendor-libs 的 `export{…}` 表里
 * `hQ → UTt`、`fF → FTt`、`fZ → D1n`，而 `UTt = p("outline","chevron-right","ChevronRight",_Sr)` 等
 * 全部走 Tabler 的 `p(t,e,n,a)` 工厂（@1530167），产物类名是 `tabler-icon tabler-icon-<name>`。
 * 只有 `us` 是 lucide：`dr → Px = L("x", IYa)`（`L` = lucide 的 `createLucideIcon`）。
 *
 * 以下 path 全部按 `node _gr_paths.mjs <局部常量名>` 从 vendor-libs 逐字抄录。
 *
 * ⚠️ **round 111 修正（r100 现行构建重核）**：上一版有两支图标的 path **抄错了相邻常量**
 * （off-by-one），另有一支根本没走官方资产。逐字证据（dump 目录 `D:\DEEPSEEK\live-assets-r100\`）：
 *
 * | 图标 | 文件 | 偏移 | 逐字 |
 * | --- | --- | --- | --- |
 * | `transform` | `vendor-libs-D64ouk08.js` | 常量 `pxi` @3091344，工厂 `Rxn=p("outline","transform","Transform",pxi)` @3091616；导出表 `Rxn as kL` @8938779 | 4 条 path（角上两个圆 + 两条折线箭头） |
 * | `aspect-ratio` | `vendor-libs-D64ouk08.js` | 常量 `H4r` @1623658，工厂 `ryt=p("outline","aspect-ratio","AspectRatio",H4r)` @1623871；导出表 `ryt as hj` @8937131 | 3 条 path（圆角矩形 + 左下/右上两笔小角标） |
 * | `copy` | `vendor-libs-D64ouk08.js` | 常量 `$Pr` @2087784，工厂 `HBt=p("outline","copy","Copy",$Pr)` @2088101；导出表 `HBt as dl` @8934607 | 2 条 path（两层错位圆角矩形） |
 *
 * 画布 chunk `vendor-pkg-canvas-DuoOicPr.js` 的接线（逐字偏移）：
 * - 卡头 `O0`：`s.jsx(ao,{size:12…})` @2225601（image）/ `es` @2225477（video）/ `_s` @2225545（audio）
 * - 生成方式 chip：`s.jsx(Ppe,{size:14…})` @2333517 ⇒ 官方 `transform`
 * - 比例 chip：`s.jsx(CR,{size:14…})` @2333838 ⇒ 官方 `aspect-ratio`
 * - 张数 chip：`s.jsx(_x,{size:14…})` @2336527 ⇒ 官方 `copy`
 *   （导入表 `dl as _x` @2526、`hj as CR`、`kL as Ppe`）
 */
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode, type SVGProps } from 'react';

/** 官方 `z2r.outline`（@1530167 邻域，逐字）。 */
const OUTLINE_BASE = {
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

export interface OfficialTablerIconProps extends Omit<ComponentPropsWithoutRef<'svg'>, 'children' | 'stroke'> {
  size?: number;
  /** 官方 Tabler `p(...)` 的 `stroke` 参数（**数字**，映射到 SVG 的 `strokeWidth`）。 */
  stroke?: number;
  title?: string;
}

/** 官方 Tabler `p("outline", …)` 工厂的逐字复刻（含类名拼接顺序）。 */
function createTablerOutlineIcon(
  name: string,
  displayName: string,
  paths: ReadonlyArray<readonly [string, Record<string, unknown>]>,
) {
  const Icon = forwardRef<SVGSVGElement, OfficialTablerIconProps>(function TablerIcon(
    { color = 'currentColor', size = 24, stroke = 2, title, className, ...rest },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        {...OUTLINE_BASE}
        width={size}
        height={size}
        className={['tabler-icon', `tabler-icon-${name}`, className].join(' ')}
        strokeWidth={stroke}
        stroke={color}
        {...rest}
      >
        {title && <title>{title}</title>}
        {paths.map(([tag, attrs]) => {
          if (tag !== 'path') return null;
          const { key: _key, ...svgAttrs } = attrs as { key?: string; [k: string]: unknown };
          return <path key={_key as string} {...(svgAttrs as SVGProps<SVGPathElement>)} />;
        })}
      </svg>
    );
  });
  Icon.displayName = displayName;
  return Icon;
}

/** 官方 `Yl`（`hQ → UTt`，lucide 口径的文档误记；实为 Tabler `chevron-right`，path 常量 `_Sr` @1965350）。 */
export const OfficialTablerChevronRight = createTablerOutlineIcon('chevron-right', 'ChevronRight', [
  ['path', { d: 'M9 6l6 6l-6 6', key: 'svg-0' }],
]);

/** 官方 `Hl`（`fF → FTt`，path 常量 `ySr` @1964845）。 */
export const OfficialTablerChevronDown = createTablerOutlineIcon('chevron-down', 'ChevronDown', [
  ['path', { d: 'M6 9l6 6l6 -6', key: 'svg-0' }],
]);

/** 官方 `Ji`（`fZ → D1n`，path 常量 `Usi` @2548288）。 */
export const OfficialTablerLock = createTablerOutlineIcon('lock', 'Lock', [
  ['path', { d: 'M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z', key: 'svg-0' }],
  ['path', { d: 'M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0', key: 'svg-1' }],
  ['path', { d: 'M8 11v-4a4 4 0 1 1 8 0v4', key: 'svg-2' }],
]);

/** 官方 `Fs`（`dk → vTt`，path 常量 `Xxr` @1959402）。 */
export const OfficialTablerCheck = createTablerOutlineIcon('check', 'Check', [
  ['path', { d: 'M5 12l5 5l10 -10', key: 'svg-0' }],
]);

/** 官方 `Tb`（`iZ → kNn`，音频 scene chip 的 leadingIcon；path 常量 `ZTi` @3139710）。 */
export const OfficialTablerVolume = createTablerOutlineIcon('volume', 'Volume', [
  ['path', { d: 'M15 8a5 5 0 0 1 0 8', key: 'svg-0' }],
  ['path', { d: 'M17.7 5a9 9 0 0 1 0 14', key: 'svg-1' }],
  ['path', { d: 'M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5', key: 'svg-2' }],
]);

/** 官方 `tg`（`fM → ZLt`，音频 duration chip 的 leadingIcon；path 常量 `qRr` @2049220）。 */
export const OfficialTablerClock = createTablerOutlineIcon('clock', 'Clock', [
  ['path', { d: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', key: 'svg-0' }],
  ['path', { d: 'M12 7v5l3 3', key: 'svg-1' }],
]);

/** 官方 `z0`（`kH → Jyt`，图片尺寸 chip 的 leadingIcon；path 常量 `Lmr` @1638672）。 */
export const OfficialTablerBadgeHd = createTablerOutlineIcon('badge-hd', 'BadgeHd', [
  ['path', { d: 'M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z', key: 'svg-0' }],
  ['path', { d: 'M14 9v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1z', key: 'svg-1' }],
  ['path', { d: 'M7 15v-6', key: 'svg-2' }],
  ['path', { d: 'M10 15v-6', key: 'svg-3' }],
  ['path', { d: 'M7 12h3', key: 'svg-4' }],
]);

/** 官方 `ia`（`iz → VAn`，画质 chip 的 leadingIcon；path 常量 `hAi` @2970942）。 */
export const OfficialTablerSparkles = createTablerOutlineIcon('sparkles', 'Sparkles', [
  ['path', {
    d: 'M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z',
    key: 'svg-0',
  }],
]);

/** 官方 `Ppe`（`kL → Rxn`，生成方式 chip 的 leadingIcon）。
 *  ⚠️ round 111 修正：上一版写成 `Hxn = p("outline","transform","Transform",kxi)` @3091339 却抄了
 *  **相邻常量** `gxi`(`transition-bottom`) 的 path（实测：`node _r111-lookup2.mjs` 反查该 path
 *  ⇒ 唯一命中 `transition-bottom`）。真正的 `transform` 常量是
 *  `pxi` @3091344 / `Rxn=p("outline","transform","Transform",pxi)` @3091616，
 *  导出表 `Rxn as kL` @8938779（`live-assets-r100/vendor-libs-D64ouk08.js`）。 */
export const OfficialTablerTransform = createTablerOutlineIcon('transform', 'Transform', [
  ['path', { d: 'M3 6a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', key: 'svg-0' }],
  ['path', { d: 'M21 11v-3a2 2 0 0 0 -2 -2h-6l3 3m0 -6l-3 3', key: 'svg-1' }],
  ['path', { d: 'M3 13v3a2 2 0 0 0 2 2h6l-3 -3m0 6l3 -3', key: 'svg-2' }],
  ['path', { d: 'M15 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', key: 'svg-3' }],
]);

/** 官方 `CR`（`hj → ryt`）—— 比例 chip 的 leadingIcon。
 *  ⚠️ round 111 修正：上一版写成 `fyt = p("outline","aspect-ratio","AspectRatio",j4r)` @1623577 却抄了
 *  **相邻常量** `Q4r`(`assembly-off`，等轴测立方体带斜杠) 的 path（实测：`node _r111-lookup2.mjs`
 *  反查该 path ⇒ 唯一命中 `assembly-off`）。真正的 `aspect-ratio` 常量是
 *  `H4r` @1623658 / `ryt=p("outline","aspect-ratio","AspectRatio",H4r)` @1623871，
 *  导出表 `ryt as hj` @8937131（`live-assets-r100/vendor-libs-D64ouk08.js`）。 */
export const OfficialTablerAspectRatio = createTablerOutlineIcon('aspect-ratio', 'AspectRatio', [
  ['path', { d: 'M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z', key: 'svg-0' }],
  ['path', { d: 'M7 12v-3h3', key: 'svg-1' }],
  ['path', { d: 'M17 12v3h-3', key: 'svg-2' }],
]);

/** 官方 `_x`（`dl → HBt`）—— 张数 chip（`1×`）的 leadingIcon。
 *  `HBt = p("outline","copy","Copy",$Pr)`：常量 `$Pr` @2087784、工厂 @2088101、
 *  导出表 `HBt as dl` @8934607（`live-assets-r100/vendor-libs-D64ouk08.js`；
 *  画布侧导入 `dl as _x` @2526，用法 `s.jsx(_x,{size:14,className:"text-white/56"})` @2336527）。 */
export const OfficialTablerCopy = createTablerOutlineIcon('copy', 'Copy', [
  ['path', { d: 'M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z', key: 'svg-0' }],
  ['path', { d: 'M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1', key: 'svg-1' }],
]);

/** 供 `Rs` 的禁用/锁标记复用。 */
export type ConfirmationIconRenderer = (props: OfficialTablerIconProps) => ReactNode;
