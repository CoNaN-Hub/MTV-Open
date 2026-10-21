/**
 * AgentMotionOrb · 官方状态映射回归
 *
 * 锁定官方 `use-chat-attachment-file-input-BcpbCD8t.js` @3924 的判定与尺寸表：
 *   hover → motion-default；proximity(150px) → motion-medium；否则 → motion-slow
 * 一旦有人改了优先级或半径，这些用例会立刻失败。
 */
import { describe, expect, it } from 'vitest';
import {
  AGENT_MOTION_DEFAULT_SRC,
  AGENT_MOTION_MEDIUM_SRC,
  AGENT_MOTION_PROXIMITY_RADIUS,
  AGENT_MOTION_SIZES,
  AGENT_MOTION_SLOW_SRC,
  AGENT_MOTION_THINKING_SRC,
  AGENT_MOTION_TRANSITION_MS,
  resolveAgentMotionSrc,
} from '../../src/components/chat/agentMotion';

describe('AgentMotionOrb · 官方动效映射', () => {
  it('hover 优先于 proximity，且各自对应官方的 webp', () => {
    expect(resolveAgentMotionSrc({ hovered: true, proximity: true })).toBe(AGENT_MOTION_DEFAULT_SRC);
    expect(resolveAgentMotionSrc({ hovered: false, proximity: true })).toBe(AGENT_MOTION_MEDIUM_SRC);
    expect(resolveAgentMotionSrc({ hovered: false, proximity: false })).toBe(AGENT_MOTION_SLOW_SRC);
  });

  it('资源路径与官方字面量一致（含 thinking 状态图标）', () => {
    expect(AGENT_MOTION_DEFAULT_SRC).toBe('/agent-motion/motion-default.webp');
    expect(AGENT_MOTION_MEDIUM_SRC).toBe('/agent-motion/motion-medium.webp');
    expect(AGENT_MOTION_SLOW_SRC).toBe('/agent-motion/motion-slow.webp');
    expect(AGENT_MOTION_THINKING_SRC).toBe('/agent-motion/motion-thinking.webp');
  });

  it('半径与过渡时长取官方值（150px / 600ms）', () => {
    expect(AGENT_MOTION_PROXIMITY_RADIUS).toBe(150);
    expect(AGENT_MOTION_TRANSITION_MS).toBe(600);
  });

  it('四档尺寸取官方 orb/hit 组合', () => {
    expect(AGENT_MOTION_SIZES.small).toEqual({ orb: 'size-4', hit: 'h-8 w-8' });
    expect(AGENT_MOTION_SIZES.medium).toEqual({ orb: 'size-6', hit: 'size-6' });
    expect(AGENT_MOTION_SIZES.default).toEqual({ orb: 'size-8', hit: 'h-11 w-11' });
    expect(AGENT_MOTION_SIZES.large).toEqual({ orb: 'size-9', hit: 'h-11 w-11' });
  });
});
