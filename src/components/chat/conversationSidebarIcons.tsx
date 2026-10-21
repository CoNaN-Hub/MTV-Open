/**
 * conversationSidebarIcons —— 会话侧栏（历史下拉 / legacy 分组 / 分页）**新增**用到的官方图标。
 *
 * 为什么单独一个文件：`officialIcons.tsx` 是与其它 Agent 面板族共用的图标表，
 * 本轮的三个新图标只有会话侧栏用得到（其余 chevron / eye / history 已在
 * `officialIcons.tsx` 里，直接 import 复用，不重复造）。
 *
 * 三步符号解析（`D:\DEEPSEEK\_res4.mjs`，chunk = `vendor-pkg-canvas-ChpWx5JY.js`）：
 * ```
 *   ① canvas 引用点：s.jsx(eo,{className:"w-3.5 h-3.5 animate-spin text-muted-foreground/50"})
 *   ② import{dj as eo}from"./vendor-libs-CQ5RMq_I.js"
 *   ③ vendor-libs export{Tsn as dj}
 *      ⇒ Tsn=p("outline","loader-2","Loader2",$oi)  @2530476
 *      ⇒ $oi=[["path",{d:"M12 3a9 9 0 1 0 9 9",key:"svg-0"}]]  @2530424
 * ```
 * 官方 `eo`（Tabler `loader-2`）在会话下拉里出现 3 次，全是同一个 3.5 尺寸：
 *   · `@2483323` 普通列表「取下一页中」`className:"w-3.5 h-3.5 animate-spin text-muted-foreground/50"`
 *   · `@2484146` legacy 加载行  `className:"w-3.5 h-3.5 animate-spin shrink-0"`
 *   · `@2485660` legacy「加载更多」`className:"w-3.5 h-3.5 animate-spin"`
 *   · 以及会话行删除中 `@2483283` `className:"w-3.5 h-3.5 animate-spin"`
 */
import type { ReactNode } from 'react';

type TablerIconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

/** 与 `officialIcons.tsx` 的 `TablerSvg` 同一形态（官方 Tabler `createReactIcon` 产物）。 */
function TablerSvg({
  size = 24,
  strokeWidth = 2,
  className,
  children,
}: TablerIconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** 官方 `eo`（`dj` ← libs `Tsn`）= **Tabler `loader-2`**（会话下拉的 4 个转圈点全用它）。 */
export function OfficialTablerLoaderIcon(props: TablerIconProps) {
  return (
    <TablerSvg {...props}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </TablerSvg>
  );
}
