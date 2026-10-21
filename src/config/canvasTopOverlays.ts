/* ══════════════════════════════════════════════════════════════════════════
   画布顶部浮层开关
   ──────────────────────────────────────────────────────────────────────────
   ⚠️⚠️ **画布导航栏（`components/Header.tsx`）不在本开关范围内，必须常驻**：
        它 = 左（logo + 项目名 + 切换画布 ⌄ + 新建画布）+ 右（`TopRightNav`：角色库 / AI 助手 / 头像组）。
        2026-09-23 我曾把它当成「可取消的浮层」关掉 ⇒ 用户立刻反馈「导航栏呢？角色库/AI助手呢？」
        ⇒ **已恢复常驻** ✗ 不要再关它。

   ① `history` —— 右上角「操作记录」= `components/canvas/HistoryTimelinePanel.tsx`
      （`<Panel position="top-right" className="canvas-history-slot">`；撤销/还原 + 可回溯列表）
      用户明确点名要取消 ✓；而且**官方构建里没有这个浮层**（「操作记录」在 index/page bundle 0 命中）
      ⇒ 关掉更接近 1:1 ✓（撤销/重做仍可用 Ctrl+Z / 底部控制条）
      ⚠️ 注意：官方**有**顶部导航栏，所以「取消操作记录」≠「取消顶栏」。

   ② 顶部居中那条细横条 = `components/canvas/PinBar.tsx`（官方 `Panel position="top-center"` 的 Pin 条）
      **官方有**，本开关不动它。

   恢复操作记录：把 `history` 改回 `true`。
   ══════════════════════════════════════════════════════════════════════════ */
export const CANVAS_TOP_OVERLAYS = {
  /** 右上角「操作记录」时间线（HistoryTimelinePanel）—— 官方没有，用户要求取消 */
  history: false,
  /** ★ 右缘「剧集栏」（SeriesRail：默认画布 / 原著 / 剧本 / 分集 面板）**已整块删除**
      （2026）：官方没有这套功能（剧集/分集/剧本创作/原著 在官方 bundle 0 命中），
      用户口径「这是哪里来的 移除 移除」⇒ 组件 `components/SeriesRail.tsx`、
      它的资产浮层 `components/ProjectAssetsOverlay.tsx`、`App.tsx` 的挂载点全部移除，
      不再保留开关。 */
  /** 顶部居中「会话项目切换」胶囊（SessionProjectTabs：`● 默认画布 + 滑杆图标`）
      —— 自带注释即写明是「本次运行期间访问过的项目的快捷切换入口」，官方没有
      （官方项目切换在**左上角**那颗 logo+画布名+⌄ 胶囊里）⇒ 用户要求取消 */
  sessionTabs: false,
} as const;
