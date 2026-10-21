/**
 * GroupNodeToolbar —— 官方 **group（打组）浮动工具条**（`zoom-slider-3ZcFvYQO.js`@char2883801 的 group 三组按钮）
 *
 * 官方结构（逐字）：
 *   · 工具条容器 = `cPe`（`qD`）：`nodrag cursor-default w-fit h-12 p-1 rounded-full flex flex-nowrap
 *     items-center justify-between bg-popover border z-10 whitespace-nowrap gap-1 text-white/90`
 *     ⇒ 高 **48** · padding 4 · gap 4 · 全圆 · bg `#262626` · border 1px `#ffffff1a` · z-10
 *     —— 与**节点**工具条**同一个容器组件** ⇒ MTV 直接复用 `.node-floating-toolbar`（同一份官方取值）✓
 *   · 组 = `<ul class="flex flex-nowrap items-center gap-[2px] justify-between w-full border-primary-border">`
 *     ⇒ `.ftb-zone`（gap 2px）✓
 *   · 组间分隔线 = `<div class="w-px h-[18px] bg-primary-border"/>` ⇒ `.ftb-divider` ✓
 *   · 第 1 组：颜色选择器 `mQ` + 布局菜单 `gXe`
 *   · 第 2 组：整组执行（`text = common.runAll / common.cancel`）+ 创建模板 `mXe` + 解组（`text = common.ungroup`）
 *   · 第 3 组：下载 `gQ`（`buttonType:"unwrapped"`）
 *   · 带文字的分支（`dPe` obsidian 变体）类名逐字：`px-3 rounded-full flex gap-2 items-center`
 *     （宽度自适应 · padding 0 12px · gap 8px · 文字用按钮基类的 `text-xs` = 12px/16px · 高度仍 40）
 *
 * 颜色选择器（`mQ` @2757073）：
 *   触发器 `size-5 aspect-square rounded-full border cursor-pointer`（未设色时 `bg-card-foreground`）+ 内联 backgroundColor
 *   弹层 `<PopoverContent side="bottom" sideOffset={22}>` 内
 *     `flex flex-col gap-4 px-3 py-5 bg-black/60 backdrop-blur-lg rounded-xl border border-input`
 *   色块 `size-6 rounded-full border border-input transition-transform hover:scale-110`
 *   重置块 `size-6 rounded-full border border-input … bg-card-foreground` + `before` 16×1.5px、
 *     颜色 `rgba(122,122,122,.5)`（= `--muted-foreground #7a7a7a` 的 50%）、`rotate(45deg)` 的斜杠
 *
 * ★ MTV 的取舍（用户 2026 决策 A，均已记账）：
 *   · **「创建模板」不出**：官方 `mXe` 是「创建/更新工作流模板」，与 MTV 的 `WorkflowDefinition`
 *     （ComfyUI 形状）不是一回事 ⇒ 不做假控件（`MTVCAPS.createWorkflow = false`）。
 *   · **颜色表沿用 MTV 的 `GROUP_COLOR_PALETTE`**：官方 `R9e` 是另一套 7 色表；换表会改变既有分组的观感，
 *     属另一个议题 ⇒ 本轮只对齐**浮层形态与几何**。
 *   · **官方「整组执行 / 创建模板 / 颜色」的真实行为未被实测**（`taskbar-official-report.md` §4 第 7 条）
 *     ⇒ 一律接 MTV 已有的等价动作（`services/groupToolbarActions.ts`），不臆造官方语义。
 *   · 气泡延迟用 **200ms**（与其它节点工具条一致）：官方 `cPe` 虽然把整条包在
 *     `TooltipProvider delayDuration=300` 里，但每个按钮是 `Xm`，而 `Xm` 内部经 `Nn`(`P9e`) **又渲染了一层
 *     Provider，default 200** —— radix 取**最近**的 Provider ⇒ 实际生效 200（规格 §6 那行记的 300 是被遮蔽的外层值）。
 *
 * 出现条件（官方 `jl` @1486373）：`visible && !isLoading && nd(nodeId)`，
 * `nd` = `selectionSource === "direct" && selectedNodeCount === 1 && selectedNodeIds.has(id)`
 * —— 与 MTV 其它节点工具条同一口径（`.node-floating-toolbar` 的出现门由各卡片自己给）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { OFFICIAL_COLORS, groupColorOf } from '../../data/officialGroupColors';
import { useT } from '../../i18n';
import {
  canDownloadGroup,
  downloadGroupChildren,
  groupRunEstimateDescription,
  layoutGroupChildren,
  planGroupRun,
  runGroupChildren,
  ungroupGroupNode,
} from '../../services/groupToolbarActions';
/* 官方「通用对话框」(`ea`) —— 整组执行的确认框走它 */
import { officialModal } from '../../services/officialModal';
import OfficialSelectionToolbarIcon from '../../data/officialSelectionToolbarIcons';
/* 官方 `Xm`（ToolbarIconButton）的逐字移植件 —— 带内嵌 `mse` 悬浮光效 */
import ToolbarButton from '../canvas/SelectionToolbarButton';
import type { OfficialLayoutMode } from '../../utils/officialCanvasLayout';

/** 官方容器 `cPe` 的点击语义：`{stopPropagation(); preventDefault()}`（点工具条本体不冒泡到画布） */
function stopContainerClick(event: React.MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
}

/** 官方 `mQ` 的默认色表 `R9e` 与落库规则（`M9e`）已抽到 `data/officialGroupColors.ts`：
 *  色板显示 `value`，**上色/落库**用 `M9e(appliedValue, applyOpacity)`，分组工具条传 `.8`。
 *  ⚠️ 上一轮我沿用了 MTV 的 10 色 `GROUP_COLOR_PALETTE`、还直接存了亮色 `value` ⇒ 分组整块是亮色，
 *     与官方不符（官方存的是暗色 `appliedValue` + 80%）——现按官方改。 */

/** 官方「整组执行」图标 `Vd`（未运行时）：自研播放三角，`viewBox "-3 0 13 10"`。
 *  ⚠️ 官方那条 `path` 的 `d` **没抽到**（`Vd` 在 zoom-slider 里是别名，跨 chunk 解析链太深）
 *     ⇒ 这里画等价三角并记账。 */
function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="-3 0 13 10" fill="currentColor" aria-hidden="true">
      <path d="M0 0l9 5l-9 5z" />
    </svg>
  );
}
/* ⚠️ 官方运行态那张「取消」按钮 MTV **不做**（不是漏做）：
 *   官方 `zoom-slider-3ZcFvYQO.js`@char2883268 的 execute 项逐字是
 *     `text: s(f ? "common.cancel" : "common.runAll")` ·
 *     `handle: () => { f ? p() : I() }`（`f`=isExecuting · `p`=cancelWorkflow）
 *     · 图标 `f ? <Pse size={16}/> : <Vd size={16}/>`
 *   MTV 的 `batchExecuteNodes` **没有任何批量取消入口**：全仓唯一相关的
 *   `pollManager.abortNodePolling` 只中断**轮询**（`controller.abort()`），
 *   并不能撤回上游已提交的生成任务 ⇒ 做一个「点了没反应/被 disable 的取消」= 假控件
 *   （用户明令禁止）⇒ 这里在运行期只把按钮置灰，文案保持 `common.runAll`。 */
/**
 * 官方「创建模板」按钮的图标 —— **源码真身**。
 *
 * 官方 `mXe`（`zoom-slider-3ZcFvYQO.js`@2874611）末尾逐字：
 * ```js
 * return l.jsx(fXe, { icon: t ? l.jsx(jg,{size:16}) : l.jsx(Ase,{size:16}), tooltip: r, … })
 * ```
 * （`t` = `workflowId` ⇒ 有模板时是「更新」态）
 * 别名链（**必须在 zoom-slider 的 import 子句里解析**）：
 *   · `Ase` <= `q0` ← index 的 `LWe as q0`；`LWe = g("outline","template","Template",GAo)` @4843454
 *     ⇒ **Tabler `template`**，5 条 path（上方一条横条 + 左下小方块 + 右侧三条横线）
 *   · `jg`  <= `gj` ← index 的 `jjn as gj`；`jjn = g("outline","refresh","Refresh",w5o)` @4637905
 *     ⇒ **Tabler `refresh`**（2 条 path），更新态用
 * ⚠️ 我上一版是**自己照 图2 猜的三条横线 + 加号** —— 用户实测「创建模板 图标现在也是错的」✗。
 *    真身是 Tabler `template`，形状完全不同（上方横条 + 左下块 + 右侧三横）。
 */
function CreateTemplateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4m0 1a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1z" />
      <path d="M4 12m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      <path d="M14 12l6 0" />
      <path d="M14 16l6 0" />
      <path d="M14 20l6 0" />
    </svg>
  );
}

/** 官方「更新模板」态图标 = Tabler **`refresh`**（`Ase` 的兄弟 `jg`，见上）—— 本处暂未用，登记备查 */
export function UpdateTemplateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
    </svg>
  );
}

/**
 * 官方「解组」图标 —— **用户 2026 提供的官方 SVG 逐字**
 * （`viewBox 0 0 11.33 11.33`，6 条 fill 路径：两个圆角方框 + 四个十字短划）。
 *
 * ⚠️⚠️ **两次都错过，这里把教训写死**：
 *   · 第一次：规格 §6 说「自研 16×16 两个分离方框是错的」⇒ 我照它画了别的 ⇒ 用户「解散的图标也不对」✗
 *   · 第二次：我从官方包读到 `Toe=F("folder-sync", Z9r)` ⇒ 改用 lucide `folder-sync` 描边路径 ⇒
 *     用户**再次**说「解散组图标是错的」✗
 *   ⇒ 结论：那个 `Toe` **不是**分组工具条上渲染的那个图标（跨 chunk 别名链上认错了对象）。
 *     真身在用户给的 SVG 里：**fill 型、11.33×11.33、两个方框 + 十字**。
 *     **以用户提供的 SVG 为准**（它是从官方界面上直接导出的，比我在 minified 包里追别名可靠）。
 */
function UngroupIcon() {
  return <OfficialSelectionToolbarIcon name="ungroup" size={16} />;
}
/* 官方下载钮 `gQ` 的图标 `Pd` = Tabler `download`（16×16 strokeWidth 2）——
   已由 `ToolbarButton` 的 `icon="downloadAll"` 提供（同一份逐字 path），此处不再自建。 */
/** 官方布局菜单触发器图标 `QO` = lucide `layout-template`，16×16 */
function LayoutMenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="7" x="3" y="3" rx="1" />
      <rect width="9" height="7" x="3" y="14" rx="1" />
      <rect width="5" height="7" x="16" y="14" rx="1" />
    </svg>
  );
}
/**
 * 布局菜单里的两项图标。
 *
 * 官方 `gXe`@2876782 逐字：
 * ```jsx
 * <Uo onClick={onSquareGridLayout} className="cursor-pointer flex items-center gap-2">
 *   <kse size={18}/><span className="text-sm">{t("common.squareGridLayout")}</span></Uo>
 * <Uo onClick={onHorizontalLayout} className="cursor-pointer flex items-center gap-2">
 *   <Ise className="-rotate-90" size={18}/><span className="text-sm">{t("common.horizontalLayout")}</span></Uo>
 * ```
 * ⇒ 两个图标都是 **`size={18}` 的填充型自定义图标**（不是 Tabler 24×24 描边型）。
 *
 * ⚠️ 水平布局：用户 2026 给了官方 SVG 逐字（`viewBox 0 0 15 15`，左列两个圆角方框 + 竖连线 +
 *    右侧一个方框 = 从左到右的流）⇒ 直接用它，**不再叠加 `-rotate-90`**
 *    （用户给的就是渲染后的样子，再加一次就转成竖向流了）。
 * ⚠️ 颜色：官方菜单项**不给图标写颜色类**，靠继承 —— 官方 `--popover-foreground:#ccc`
 *    （`index-DV4al4p1.css` 逐字）⇒ MTV 菜单里的 `#cccccc` **本来就是官方值**，
 *    这里改成 `currentColor` 继承，保证与菜单文字同一个色（避免将来菜单改色而图标不跟）。
 */
function LayoutItemIcon({ mode }: { mode: OfficialLayoutMode }) {
  if (mode === 'grid') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
        <path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
        <path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
        <path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      </svg>
    );
  }
  /**
   * 水平布局 —— 官方 `Ise` = Tabler **`sitemap`**（`g("outline","sitemap","Sitemap",G7o)`）
   * 逐字 5 条 path（`index-BiTZf8mJ.js`@4747994 的 `G7o`）：
   * ```
   * M3 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z
   * M15 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z
   * M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z
   * M6 15v-1a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v1     ← 连接线（矮而宽）
   * M12 9l0 3                                     ← 竖杆
   * ```
   * ⚠️⚠️ MTV 原来的**第 4、5 条是手写的、错的**：
   *   第4条写成 `M6 15v-4a1 1 0 0 1 1 -1h10a1 1 0 0 1 1 1v4`（又高又宽的方框，圆角半径 1 而非 2）
   *   第5条写成 `M12 10v-3`（起止点差 1）
   *   ⇒ 用户实测「**水平布局前的图标不对**」✗ —— 连接线的形状明显不同。现按官方 `G7o` 逐字改正。
   * 官方调用点：`l.jsx(Ise,{className:"-rotate-90",size:18})`（`gXe`@2876782）⇒ **保留 `-90deg`**。
   * （用户给的 SVG 是同一图标的 Illustrator 导出/重画版，源码里**没有**那条路径数据 ⇒ 以源码为准。）
   */
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
      <path d="M3 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
      <path d="M15 15m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
      <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
      <path d="M6 15v-1a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v1" />
      <path d="M12 9l0 3" />
    </svg>
  );
}

/** 带文字的按钮（官方 obsidian 的 text 分支：`px-3 rounded-full flex gap-2 items-center`，字用基类 `text-xs`） */
/**
 * 带文字的按钮（官方 `dPe` 的 `obsidian` + `text` 分支）。
 *
 * ★★★ **这些按钮官方【没有】悬浮气泡** ✗✓
 *   （用户 2026：「布局 整组执行 创建模板 解组 官方是没有悬浮气泡的」）
 *   源码依据（`zoom-slider-3ZcFvYQO.js`）：
 *     · `cPe` 渲染每个工具项时传的是 `tooltip: b.lockedTooltip || **b.tooltip**`
 *     · group 的 tools 数组（@2883233 起）里这三项**只有 `text`、没有 `tooltip` 字段**（逐字）：
 *         `{key:"execute", node:…, text:s(f?"common.cancel":"common.runAll"), handle:…, buttonType:"obsidian", …}`
 *         `{key:"workflowManagement", node:l.jsx(mXe,{…,text:…}), buttonType:"obsidian", handle:…}`
 *         `{key:"ungroup", node:l.jsx(Toe,{}), buttonType:"obsidian", text:s("common.ungroup"), handle:…}`
 *     · `dPe` 末尾 `l.jsx(Nn,{content:w,…})` 里 `w` 就是那个 `undefined`
 *       ⇒ Radix Tooltip **没有内容可渲染** ⇒ 不弹气泡 ✓
 *   对照（**这两个官方有气泡**，因为 tools 项里显式传了 `tooltip`）：
 *     · `{key:"color-picker", node:l.jsx(mQ,{…}), tooltip:s("common.backgroundColor")}`（@2883703）
 *     · `l.jsx(gQ,{tooltip:s("common.batchDownload"),…})`（下载项）
 *   ⇒ 本组件**不再给文字按钮挂 `data-tooltip`**（MTV 气泡由 `data-tooltip` 驱动）；
 *     只留 `aria-label`（官方按钮上也一直有 `aria-label`）。
 *     布局触发器的情况见它自己的注释（官方用**原生 `title`**）。
 */
function TextButton({
  label, onClick, disabled, children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      /* 官方 `dPe` 的 `obsidian` + `text` 分支 —— 合并后的类名**逐字**：
         `tc` 基类 `z-0 group/button relative flex items-center justify-center cursor-pointer
                  focus-visible:outline-none text-xs transition-colors duration-300
                  disabled:opacity-50 disabled:cursor-not-allowed`
         + `obsidian` `bg-transparent text-nowrap transition-all duration-200
                       ease-[cubic-bezier(0.25,0.8,0.25,1)]`
         + `size:"md"` `h-10`
         + 调用点 `px-3 rounded-full flex gap-2 items-center`
         （`Ie` = tailwind-merge ⇒ `transition-all` 覆盖基类的 `transition-colors`，故只留前者） */
      className="group-toolbar-text-btn z-0 group/button relative flex items-center justify-center cursor-pointer focus-visible:outline-none text-xs disabled:opacity-50 disabled:cursor-not-allowed bg-transparent text-nowrap transition-all duration-200 ease-[cubic-bezier(0.25,0.8,0.25,1)] h-10 px-3 rounded-full flex gap-2 items-center text-white/90"
      aria-label={label}
      aria-disabled={disabled ? true : undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) return;
        onClick();
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

export default function GroupNodeToolbar({ groupId, color }: { groupId: string; color: string }) {
  const t = useT();
  const [running, setRunning] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [colorAnchor, setColorAnchor] = useState<{ left: number; top: number } | null>(null);
  const [layoutAnchor, setLayoutAnchor] = useState<{ left: number; top: number } | null>(null);
  /* 官方 `mQ` 的触发器是 **`<div>`**（不是 button）⇒ ref 类型跟着改 */
  const colorTriggerRef = useRef<HTMLDivElement>(null);
  const layoutTriggerRef = useRef<HTMLButtonElement>(null);
  const setGroupColor = useAppStore((s) => s.setGroupColor);
  const showToast = useAppStore((s) => s.showToast);
  /* 组内是否有可下载内容（官方同理：没有就不渲染那一组） */
  const childSignature = useAppStore((s) => s.nodes
    .filter((node) => node.parentId === groupId)
    .map((node) => `${node.id}:${node.data.imageUrl ?? ''}${node.data.videoUrl ?? ''}${node.data.audioUrl ?? ''}`)
    .join('|'));
  const downloadable = canDownloadGroup(groupId);
  void childSignature;

  /* 官方 radix：点弹层外 / Esc 关闭（portal 到 body ⇒ MTV 自己接） */
  useEffect(() => {
    if (!colorOpen && !layoutOpen) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target && target.closest('.group-toolbar-popover, .group-toolbar-menu, .group-toolbar-color-trigger, .group-toolbar-layout-trigger')) return;
      setColorOpen(false);
      setLayoutOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setColorOpen(false); setLayoutOpen(false); }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [colorOpen, layoutOpen]);

  /**
   * 官方「整组执行」（`zoom-slider-3ZcFvYQO.js`@char2879977 `I`）：
   *   ① 两道门（组非空 + 至少一个可执行成员）→ 不过就**什么都不发生**（`planGroupRun` 返回 null）
   *   ② `ea.confirm({title: workflow.groupRunConfirmation.title,
   *                  description: workflow.groupRunConfirmation.estimating,
   *                  confirmButton:{label: common.runAll},
   *                  cancelButton:{label: common.cancel},
   *                  closeOnOverlayClick:false, onConfirm})`
   *   ③ 预估/校验那一段 `.then` → `ea.update(q, {description, confirmButton:{…disabled}})` 改写同一张弹窗
   *   ★ 注意 `onConfirm` 里官方是 `u(V, Y, {…})`（组内成员 + 组内连线），不是 MTV 原来的
   *     「按 id 列表再自己算一遍」，语义上等价（`batchExecuteNodes` 只认传入 id 集合内的边）。
   */
  const runAll = useCallback(() => {
    if (running) return;
    /* 官方两道门：组非空 + 至少一个可执行成员；不过门**什么 UI 都不弹** */
    if (!planGroupRun(groupId)) return;
    const modalId = officialModal.confirm({
      title: t('运行整组？'),
      description: t('正在预估本次执行花费...'),
      confirmButton: { label: t('整组执行') },
      cancelButton: { label: t('取消') },
      closeOnOverlayClick: false,
      onConfirm: async () => {
        setRunning(true);
        try {
          const { ok, fail } = await runGroupChildren(groupId);
          const parts: string[] = [];
          if (ok > 0) parts.push(t('{count} 个成功', { count: ok }));
          if (fail > 0) parts.push(t('{count} 个失败', { count: fail }));
          if (parts.length > 0) {
            showToast(t('分组批量生成完成：{result}', { result: parts.join('，') }), fail > 0 ? 'error' : undefined);
          }
        } finally {
          setRunning(false);
        }
      },
    });
    /* 官方那一段 `.then` 的结果（MTV 侧必然落到兜底分支，见 `groupRunEstimateDescription`） */
    officialModal.update(modalId, { description: groupRunEstimateDescription() });
  }, [groupId, running, showToast, t]);

  const openColor = () => {
    if (colorOpen) { setColorOpen(false); return; }
    const rect = colorTriggerRef.current?.getBoundingClientRect();
    /* 官方 `PopoverContent side="bottom" sideOffset={22}` */
    setColorAnchor(rect ? { left: rect.left + rect.width / 2, top: rect.bottom + 22 } : null);
    setLayoutOpen(false);
    setColorOpen(true);
  };
  const openLayout = () => {
    if (layoutOpen) { setLayoutOpen(false); return; }
    const rect = layoutTriggerRef.current?.getBoundingClientRect();
    /* 与多选工具栏的「布局」同款：radix `Ga` 的 sideOffset 4 */
    setLayoutAnchor(rect ? { left: rect.left, top: rect.bottom + 4 } : null);
    setColorOpen(false);
    setLayoutOpen(true);
  };

  return (
    <>
      <div
        className="node-floating-toolbar group-toolbar nodrag cursor-default w-fit h-12 p-1 rounded-full flex flex-nowrap items-center justify-between bg-popover border z-10 whitespace-nowrap gap-1 text-white/90 node-float-ui-visible"
        /* 官方分组工具条与**节点**工具条是**同一个行容器组件**
           （全产物里 `w-fit h-12 p-1 rounded-full` 只出现一次：`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1055923，
            其外层就是 @1055675 的 `s.jsx(ii,{delayDuration:300,…})` = TooltipProvider 300）
           ⇒ 延迟与节点工具条同口径 */
        data-tooltip-offset="8"
        data-tooltip-delay="200" /* §106 更正：官方按钮 tooltip **生效值 = 200**（Root 显式值优先于行容器 Provider 300）。
            依据 `live-assets-r100/vendor-packages-JNk8f0_N.js` @404156 + `vendor-libs-D64ouk08.js` @1382617。
            ⚠️ 上方 381-383 行旧注释说的 300 是行容器那一层，**不是生效值**。 */
        onClick={stopContainerClick}
      >
        {/* 第 1 组：颜色 + 布局（官方 `cPe` 的 `<ul>` 逐字：
              `flex flex-nowrap items-center gap-[2px] justify-between w-full border-primary-border`） */}
        <ul className="flex flex-nowrap items-center gap-[2px] justify-between w-full border-primary-border">
          {/* ★★ 官方 `cPe` 给**每个工具项**都套一层外层（逐字）：
                `<div class="cursor-pointer w-fit h-10 rounded-full flex items-center justify-center">`
              颜色项也不例外 ⇒ 那 20×20 的圆点应该在一个 **40 高、w-fit** 的居中盒子里。
              ⚠️ MTV 原来直接把 20×20 的按钮丢进 zone ✗（少了这层 `h-10` 包装）。 */}
          <div className="cursor-pointer w-fit h-10 rounded-full flex items-center justify-center">
            {/* ★★★ 官方颜色项的 **`buttonType:"normal"`** 分支（`dPe`@1479352 逐字）——
                上一版我漏了这一层，只画了 20×20 的色点 ⇒ **左右各少 6px**（用户实测
                「背景颜色按钮与底部胶囊左侧间距不对」、「缺少一个类似焦点环的东西」✗）。
                ```js
                const C = e==="normal" || e==="custom" ? "ghost" : e;
                return l.jsx(Nn,{content:w, children: l.jsxs(Wt,{
                  onClick:o, variant:C, size:"sm",
                  className:"cursor-pointer p-2 rounded-full aspect-square overflow-hidden",
                  disabled:r, "data-testid":a, children:[n, !y && s]})})
                ```
                `size:"sm"` = `h-8`(32) + 形状默认 `custom: "rounded-md px-3 py-1"` 被
                `p-2 rounded-full aspect-square` 覆盖 ⇒ **32×32 圆钮 · padding 8 · overflow-hidden**。
                色点 20×20 居中在这个 32×32 钮里（`p-2` 把可用区压到 16×16，多出的 2px 被
                `overflow-hidden` + `rounded-full` 裁掉）⇒ 视觉上就是「色点外面一圈圆形底」，
                也就是用户说的那个「类似焦点环」。
                ⚠️ MTV 分组工具条上 `ghost` 的悬浮态沿用本文件布局触发器那套
                   （`hover:bg-accent hover:text-accent-foreground`，见 `gXe` 调用点）。 */}
            <button
              type="button"
              /* 官方 `Wt`（= `Un`，`index-BiTZf8mJ.js`@1746784 的 `_Ve` cva）合并后的类名**逐字**：
                 基类 `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md
                       text-sm font-medium transition-colors
                       **focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring**
                       disabled:pointer-events-none disabled:opacity-50
                       [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0`
                 + ghost `hover:bg-accent hover:text-accent-foreground`
                 + size sm `h-8 rounded-md px-3 text-xs`
                 + 调用点 `cursor-pointer p-2 rounded-full aspect-square overflow-hidden`
                 `Ie` = tailwind-merge ⇒ `rounded-full` 覆盖 `rounded-md`、`p-2` 覆盖 `px-3`。
                 ★★ 用户指出的两点都在基类里：
                   · **hover** = `hover:bg-accent hover:text-accent-foreground`（悬浮出一圈圆底）
                   · **点击的焦点环** = `focus-visible:ring-1 focus-visible:ring-ring`
                     （上一版我手写的类串**两条都漏了** ⇒ 用户「hover 呢？点击的类似焦点环呢？」✗） */
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-8 rounded-full aspect-square overflow-hidden cursor-pointer p-2"
              aria-label={t('背景颜色')}
              aria-haspopup="dialog"
              aria-expanded={colorOpen}
              data-tooltip={t('背景颜色')}
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); openColor(); }}
            >
              <div
                ref={colorTriggerRef}
                /* 官方 `mQ` 的内层色点类名逐字：
                   `size-5 aspect-square rounded-full border cursor-pointer` + `!selectedColor && "bg-card-foreground"`
                   官方 `--border:#ffffff1a`（`.group-toolbar` 上已补该变量）。 */
                className={`size-5 aspect-square rounded-full border cursor-pointer${color ? '' : ' bg-card-foreground'}`}
                style={{ backgroundColor: color || undefined }}
              />
            </button>
          </div>
          {/* ★ 官方 `gXe` 的**分组**触发器（`triggerVariant` 默认 `"group"`）逐字：
                `Wt variant="ghost" size="sm" className="cursor-pointer !px-1" aria-label={布局} title={布局}`
              ⇒ `size="sm"` = `h-8`(**32**) + `rounded-md`(**10px**) + `px-3`，再被 `!px-1` 覆写成 padding-inline **4px**；
                变体 ghost = `hover:bg-accent hover:text-accent-foreground`。
              ⚠️ 它不是多选工具栏那种 40×40 圆钮（`Xm`）——上一轮我用 `ftb-btn` 做成了 40 圆钮 ✗。 */}
          {/* 官方 `cPe` 的**工具项外层**（逐字，与颜色项同一层）：
                `<div class="cursor-pointer w-fit h-10 rounded-full flex items-center justify-center">` */}
          <div className="cursor-pointer w-fit h-10 rounded-full flex items-center justify-center">
            <button
              ref={layoutTriggerRef}
              type="button"
              className="group-toolbar-layout-trigger inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground cursor-pointer h-8 rounded-md px-1"
              aria-label={t('布局')}
              aria-haspopup="menu"
              aria-expanded={layoutOpen}
              /* 官方 `gXe`@2876782 逐字：
                 `l.jsx(Wt,{variant:"ghost",size:"sm",className:"cursor-pointer !px-1",
                          "aria-label":r, **title:r**, children:l.jsx(QO,{size:16})})`
                 ⇒ 官方这里是**原生 `title`**（浏览器自带提示），**不是**那套 styled tooltip；
                   branch 只在 `triggerVariant==="toolbar"` 时用 `Xm`（带 Radix tooltip），
                   而 group 的工具条**没传** triggerVariant ⇒ 走幽灵按钮 + 原生 title。
                 ⚠️ MTV 原来挂 `data-tooltip`（styled 气泡）✗ ⇒ 改成官方那样只留 `title`。 */
              title={t('布局')}
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); openLayout(); }}
            >
              <LayoutMenuIcon />
            </button>
          </div>
        </ul>

        {/* 官方 `cPe` 的分隔线逐字：`<div class="w-px h-[18px] bg-primary-border"/>`
            ⚠️ 补 `shrink-0`：容器是 `flex flex-nowrap` + `w-full` 的 `<ul>`
            ⇒ 1px 分隔线会被 flex 压成 **0 宽**（实测 `w: 0` ⇒ 用户「分割线呢？」✗）。
            官方那份没写，但容器 `w-fit` 的解析路径不同；这里显式钉住宽度。 */}
        <div className="w-px h-[18px] shrink-0 bg-primary-border" />

        {/* 第 2 组：整组执行 + 创建模板 + 解组
            官方 `vXe` 的 tools 顺序逐字（`zoom-slider-3ZcFvYQO.js`@2883233）：
              `execute`（text = common.runAll）→ `workflowManagement`（`mXe`，text = common.createWorkflow）
              → `ungroup`（text = common.ungroup）
            ⇒ 「创建模板」夹在中间，与官方一致。 */}
        <ul className="flex flex-nowrap items-center gap-[2px] justify-between w-full border-primary-border">
          <TextButton
            label={t('整组执行')}
            disabled={running}
            onClick={runAll}
          >
            <PlayIcon />
          </TextButton>
          {/* 官方 `mXe`（@2874612）——「创建模板 / 更新模板」。
              ⏸ 用户 2026 明确指示：**本轮只做占位空壳，不实现点击逻辑**
                 （官方那条链要 `Go.createCanvasTemplate` 云端接口 + 模板列表/封面/标签表单，
                  MTV 没有这套后端）。所以这里**故意不挂 onClick**，只保留官方按钮形态与文案。 */}
          <TextButton
            label={t('创建模板')}
            onClick={() => undefined}
          >
            <CreateTemplateIcon />
          </TextButton>
          <TextButton
            label={t('解组')}
            onClick={() => ungroupGroupNode(groupId)}
          >
            <UngroupIcon />
          </TextButton>
        </ul>

        {/* 第 3 组：下载（官方 `gQ`，`buttonType:"unwrapped"`）—— 组内没有可下载内容时整组不渲染 */}
        {downloadable && (
          <>
            {/* 官方 `cPe` 的分隔线逐字：`<div class="w-px h-[18px] bg-primary-border"/>`
            ⚠️ 补 `shrink-0`：容器是 `flex flex-nowrap` + `w-full` 的 `<ul>`
            ⇒ 1px 分隔线会被 flex 压成 **0 宽**（实测 `w: 0` ⇒ 用户「分割线呢？」✗）。
            官方那份没写，但容器 `w-fit` 的解析路径不同；这里显式钉住宽度。 */}
        <div className="w-px h-[18px] shrink-0 bg-primary-border" />
            <ul className="flex flex-nowrap items-center gap-[2px] justify-between w-full border-primary-border">
              <div className="cursor-pointer w-fit h-10 rounded-full flex items-center justify-center">
              {/* 官方 `gQ`（= 下载那项）逐字：
                    `function gQ({tooltip,isLoading=!1,dataTestId,onClick}){
                       return l.jsx(Xm,{tooltip,isActive:isLoading,isDisabled:isLoading,ariaBusy:isLoading,
                                        dataTestId,onClick,children:isLoading?<spinner/>:<Pd size={16}/>})}`
                  ⇒ 它就是官方 `Xm`（ToolbarIconButton），**内嵌 `mse` 悬浮光效**。
                    MTV 已有 `Xm` 的逐字移植件：`components/canvas/SelectionToolbarButton.tsx`
                    ⇒ 直接复用，hover 光效/尺寸/圆角天然与官方一致（上一版手写类串时把光效层漏了 ✗）。 */}
              <ToolbarButton
                icon="downloadAll"
                tooltip={t('下载全部')}
                dataTestId="group-toolbar-download"
                onClick={() => { void downloadGroupChildren(groupId); }}
              />
              </div>
            </ul>
          </>
        )}
      </div>

      {/* 颜色弹层 —— 官方 `mQ` 逐字：
            `<PopoverContent className="w-auto" sideOffset={22} side="bottom">` 内
            `<div className="flex flex-col gap-4 px-3 py-5 bg-black/60 backdrop-blur-lg rounded-xl border border-input">`
            ⚠️⚠️ 内层是 **`flex flex-col`（竖排一列）**！上一轮我做成 5 列网格 —— 那是**我自己编的**
                （用户实测：「点击颜色 弹窗的排列布局也不对」✗）。官网就是竖着一排 24×24 圆点。
            子项顺序也逐字：先 `showReset` 的重置块，再依次 7 个色块。 */}
      {colorOpen && colorAnchor && createPortal(
        <div
          className="group-toolbar-popover"
          role="dialog"
          style={{ left: colorAnchor.left, top: colorAnchor.top }}
          onClick={(event) => event.stopPropagation()}
        >
          {/* 重置块（官方 showReset 分支，逐字）：`size-6 rounded-full border border-input
              transition-transform hover:scale-110 bg-card-foreground relative cursor-pointer`
              + `before` 16×1.5px、`bg-muted-foreground/50`、`rotate-45`
              ⚠️ 官方 `onReset` 写空字符串「无底色」；MTV 的分组**必须有颜色**
                 （GroupNode 拼 `${color}08`/`${color}20`）⇒ 这里回到 MTV 新建分组的默认色，如实记账。 */}
          <button
            type="button"
            className="group-toolbar-swatch group-toolbar-swatch--reset"
            aria-label={t('重置颜色')}
            data-tooltip={t('重置颜色')}
            onClick={() => { setGroupColor(groupId, ''); setColorOpen(false); }}
          />
          {OFFICIAL_COLORS.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              className="group-toolbar-swatch"
              aria-label={swatch.name}
              data-tooltip={swatch.name}
              style={{ backgroundColor: swatch.value }}
              onClick={() => { setGroupColor(groupId, groupColorOf(swatch)); setColorOpen(false); }}
            />
          ))}
        </div>,
        document.body,
      )}

      {/* 布局菜单：与多选工具栏「布局」同一套官方类名与取值（`gXe`） */}
      {layoutOpen && layoutAnchor && createPortal(
        <div
          className="group-layout-menu group-toolbar-menu"
          role="menu"
          style={{ left: layoutAnchor.left, top: layoutAnchor.top }}
          onClick={(event) => event.stopPropagation()}
        >
          {([
            { mode: 'grid' as const, label: t('宫格布局') },
            { mode: 'horizontal' as const, label: t('水平布局') },
          ]).map((item) => (
            <button
              key={item.mode}
              type="button"
              role="menuitem"
              className="group-layout-item"
              onClick={() => { layoutGroupChildren(item.mode, groupId); setLayoutOpen(false); }}
            >
              <LayoutItemIcon mode={item.mode} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}


