/**
 * workspaceLanding.ts —— 工作空间「落地页签」的传递（用户口径）
 * ══════════════════════════════════════════════════════════════════════════
 * · 启动 / 主页导航 → **主页**（`WorkspacePage` 默认）
 * · 画布左上角 logo、画布「切换画布 ⌄」→ **我的项目**（官方这两个入口都直接落到项目列表）
 * `App` 里是 `{workspaceOpen && <WorkspacePage />}` ⇒ 每次打开都是新挂载，
 * 所以在挂载时消费一次即可，不必为一个页签去动 store 结构。
 */
export type WorkspaceTab = 'home' | 'projects';

let pendingLandingTab: WorkspaceTab | null = null;

export function setWorkspaceLandingTab(tab: WorkspaceTab): void {
  pendingLandingTab = tab;
}

/** 挂载时消费一次（消费后清空，避免影响下一次从导航栏进入的默认行为） */
export function consumeWorkspaceLandingTab(): WorkspaceTab {
  const landing = pendingLandingTab;
  pendingLandingTab = null;
  return landing ?? 'home';
}
