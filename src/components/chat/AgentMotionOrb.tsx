/**
 * AgentMotionOrb —— 官方 TapNow 助手「动效球」1:1 复刻（组件）。
 *
 * 事实与判定见 `agentMotion.ts`（同一份官方依据的纯数据部分）。本文件只负责渲染与事件：
 *   · 三层 `<img>` 绝对定位叠放，按当前状态切换 `opacity`，`transitionDuration` 取官方 600ms；
 *   · 鼠标进入 host → `motion-default`；进入 150px 半径 → `motion-medium`；否则 `motion-slow`；
 *   · chrome="floating" 时 shell 用官方 `p-1 bg-zinc-800 border border-zinc-600/50
 *     hover:border-zinc-500 overflow-hidden`，并在 hover 时给图 `scale-105`。
 *
 * 实现注记（**视觉等价、机制不同**，非保真度妥协）：
 *   官方是「prev/current 两层 img + 一个 600ms 过渡标志」；本仓库的 ESLint
 *   启用了 React 19 的 `react-hooks/set-state-in-effect` 与 `react-hooks/refs`
 *   （禁止 effect 同步体 setState、禁止渲染期读 ref），那套状态机无法原样落地。
 *   这里改为把三张图**常驻叠放**、由派生出的当前状态直接决定各自 opacity ——
 *   交叉淡入效果与官方一致（同为 600ms、同为那三张官方 webp、尺寸与外壳逐字一致）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AGENT_MOTION_DEFAULT_SRC,
  AGENT_MOTION_MEDIUM_SRC,
  AGENT_MOTION_PROXIMITY_RADIUS,
  AGENT_MOTION_SIZES,
  AGENT_MOTION_SLOW_SRC,
  AGENT_MOTION_TRANSITION_MS,
  resolveAgentMotionSrc,
  type AgentMotionOrbSize,
} from './agentMotion';

export interface AgentMotionOrbProps {
  className?: string;
  /** 官方 `chrome`；默认 floating。 */
  chrome?: 'floating' | 'plain';
  orbSize?: AgentMotionOrbSize;
  /** 官方 `proximityActive`；false 时靠近与 hover 都不参与判定。 */
  proximityActive?: boolean;
  onClick?: () => void;
  /** 官方 `tooltip`：同时作为 title 与 aria-label。 */
  tooltip?: string;
  disabled?: boolean;
}

const MOTION_SOURCES = [
  AGENT_MOTION_SLOW_SRC,
  AGENT_MOTION_MEDIUM_SRC,
  AGENT_MOTION_DEFAULT_SRC,
] as const;

export default function AgentMotionOrb({
  className,
  chrome = 'floating',
  orbSize = 'default',
  proximityActive = true,
  onClick,
  tooltip = '',
  disabled = false,
}: AgentMotionOrbProps) {
  const [hovered, setHovered] = useState(false);
  const [proximity, setProximity] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  /* 官方：window mousemove + 平方距离比较（避免每帧 sqrt）。 */
  useEffect(() => {
    if (!proximityActive) return;
    const onMouseMove = (event: MouseEvent) => {
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const next = dx * dx + dy * dy < AGENT_MOTION_PROXIMITY_RADIUS ** 2;
      /* 函数式更新：值没变时返回原引用，不触发无谓重渲染。 */
      setProximity((value) => (value === next ? value : next));
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [proximityActive]);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  /* proximityActive=false 时官方等同「靠近与 hover 都不成立」，这里用派生表达，
     避免在 effect 里 setState。 */
  const effectiveHovered = proximityActive && hovered;
  const activeSrc = resolveAgentMotionSrc({
    hovered: effectiveHovered,
    proximity: proximityActive && proximity,
  });

  const { orb, hit } = AGENT_MOTION_SIZES[orbSize];
  const scaleOnHover = chrome === 'floating' && effectiveHovered;

  const shellClass = chrome === 'plain'
    ? 'cursor-default p-0 bg-transparent border-0 shadow-none outline-none ring-0 overflow-visible flex items-center justify-center hover:bg-transparent hover:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0'
    : 'p-1 bg-zinc-800 border border-zinc-600/50 hover:border-zinc-500 overflow-hidden';

  const imageClass = `absolute inset-0 transition-all ease-in-out ${orb}${scaleOnHover ? ' scale-105' : ''}`;

  return (
    <div
      ref={hostRef}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        aria-label={tooltip || undefined}
        title={tooltip || undefined}
        disabled={disabled}
        onClick={onClick}
        className={`text-white transition-all duration-300 flex items-center justify-center rounded-full ${hit} ${shellClass}`}
      >
        <span
          className={`relative ${orb}`}
          data-testid="agent-motion-orb"
          data-motion-src={activeSrc}
        >
          {MOTION_SOURCES.map((source) => (
            <img
              key={source}
              src={source}
              alt=""
              draggable={false}
              className={imageClass}
              style={{
                opacity: source === activeSrc ? 1 : 0,
                transitionDuration: `${AGENT_MOTION_TRANSITION_MS}ms`,
              }}
            />
          ))}
        </span>
      </button>
    </div>
  );
}
