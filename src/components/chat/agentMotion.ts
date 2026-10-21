/**
 * agentMotion —— 官方 TapNow 助手「动效球」的**纯数据/判定**（不含 React）。
 *
 * 官方依据（`use-chat-attachment-file-input-BcpbCD8t.js` @3924 起，逐字）：
 *   Rl = "/agent-motion/motion-default.webp"
 *   Pl = "/agent-motion/motion-medium.webp"
 *   kt = "/agent-motion/motion-slow.webp"
 *   ur = 150
 *   Fa = { small:{orb:"size-4",hit:"h-8 w-8"}, medium:{orb:"size-6",hit:"size-6"},
 *          default:{orb:"size-8",hit:"h-11 w-11"}, large:{orb:"size-9",hit:"h-11 w-11"} }
 *   let _ = kt; if (l) _ = Rl; else if (u) _ = Pl;      // l=hover, u=靠近
 *   style={{ transitionDuration: "600ms" }}             // 两层 img 交叉淡入
 *
 * 抽成独立模块的原因：① 组件文件只导出组件（react-refresh/only-export-components）；
 * ② 判定逻辑可以在 node 环境下直接单测，不需要 jsdom。
 */

export const AGENT_MOTION_DEFAULT_SRC = '/agent-motion/motion-default.webp';
export const AGENT_MOTION_MEDIUM_SRC = '/agent-motion/motion-medium.webp';
export const AGENT_MOTION_SLOW_SRC = '/agent-motion/motion-slow.webp';
/** 工具调用进行中的状态图标（官方 `page-DVqoHdTT.js` @626999 的 `pie`）。 */
export const AGENT_MOTION_THINKING_SRC = '/agent-motion/motion-thinking.webp';

/** 官方 `ur`：鼠标与球心的距离小于它即视为「靠近」。 */
export const AGENT_MOTION_PROXIMITY_RADIUS = 150;
/** 官方 `transitionDuration: "600ms"`。 */
export const AGENT_MOTION_TRANSITION_MS = 600;

export const AGENT_MOTION_SIZES = {
  small: { orb: 'size-4', hit: 'h-8 w-8' },
  medium: { orb: 'size-6', hit: 'size-6' },
  default: { orb: 'size-8', hit: 'h-11 w-11' },
  large: { orb: 'size-9', hit: 'h-11 w-11' },
} as const;

export type AgentMotionOrbSize = keyof typeof AGENT_MOTION_SIZES;

/** 官方状态 → 动效源：hover 优先于 proximity，两者都没有时用 slow。 */
export function resolveAgentMotionSrc(state: {
  hovered: boolean;
  proximity: boolean;
}): string {
  if (state.hovered) return AGENT_MOTION_DEFAULT_SRC;
  if (state.proximity) return AGENT_MOTION_MEDIUM_SRC;
  return AGENT_MOTION_SLOW_SRC;
}
