/**
 * ComposerFirstEntryGlow —— 官方「进入 Agent 时底部编辑区的光影变化」1:1 复刻。
 *
 * 官方逐字依据（`page-BeI7xydN.js`，`Xle` @771180；挂载在 `CanvasInputV2`（`ev`）@801604）：
 *
 * ```js
 * wr  = '#90c4e5';
 * qle = 2.5; Kle = .3;
 * Th  = qle;            // 2.5s —— 三段动画的总时长
 * Yle = Th * Kle * 1e3; // 750ms —— onRevealStart 的触发时刻
 *
 * Xle = ({ onComplete, onRevealStart }) => {
 *   const reduce = usePrefersReducedMotion();
 *   useEffect(() => {
 *     if (reduce) { onRevealStart?.(); onComplete?.(); return; }
 *     const id = setTimeout(() => onRevealStart?.(), Yle);
 *     return () => clearTimeout(id);
 *   }, [reduce, onComplete, onRevealStart]);
 *   if (reduce) return null;
 *   return <div className="pointer-events-none absolute inset-0 z-0"> … 三段 … </div>;
 * };
 * ```
 *
 * 挂载点逐字（`CanvasInputV2`）：
 * `{x ? <Xle onRevealStart={v} /> : null}` —— 第三参是 React key（`firstEntryGlowKey`），
 * 即「换一个 key 就重播一次」。官方 `x` = prop `firstEntryGlow`（默认 false），
 * `starterSendHighlighted`（`C`）另有一档**常驻**蓝阴影，只在 starter 重播时出现 ⇒ MTV 无该状态、不实现。
 *
 * 本仓接线：`ChatInput` 在输入卡内以 `key={activeSessionId}` 渲染本组件 ⇒
 * **每次进入助手 / 切换会话时播放一次**；播放完毕后自卸载（`onAnimationComplete`）。
 *
 * 三段（全部 `pointer-events-none`、全部在输入卡内）：
 *   ① 环形高光：`absolute -inset-px rounded-2xl` + 5 层 box-shadow，opacity `.85 → [.85,1,.7,0]`
 *   ② 底部辉光：`absolute -right-12 -bottom-14 -left-12 h-[118px]` 径向渐变 + blur(20px)
 *   ③ 顶部扫光：`absolute top-[-8px] h-[178px] w-[166%] rounded-[50%]`，x `-72% → [.., 78%]`
 */
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/** 官方 `wr`：整套光影的主色。 */
const GLOW_COLOR = '#90c4e5';
/** 官方 `Th` = `qle`：三段动画时长（秒）。 */
const GLOW_DURATION = 2.5;
/** 官方 `Yle`：`onRevealStart` 的触发延迟（毫秒）。 */
const REVEAL_START_MS = 750;

export interface ComposerFirstEntryGlowProps {
  /** 官方 `onRevealStart`：动画进行到 750ms 时回调（官方用它揭示编辑器内容）。 */
  onRevealStart?: () => void;
}

export default function ComposerFirstEntryGlow({ onRevealStart }: ComposerFirstEntryGlowProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      onRevealStart?.();
      return undefined;
    }
    const timer = window.setTimeout(() => onRevealStart?.(), REVEAL_START_MS);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion, onRevealStart]);

  if (prefersReducedMotion || finished) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="composer-first-entry-glow"
      className="pointer-events-none absolute inset-0 -z-10"
    >
      {/* ① 环形高光：五层 box-shadow，呼吸一次后熄灭 */}
      <motion.div
        className="absolute -inset-px rounded-2xl"
        style={{
          boxShadow: [
            '0 5px 11.4px 0 rgba(211,230,255,0.25)',
            `0 10px 30px 1px ${GLOW_COLOR}38`,
            'inset 0 -2px 4px 0 rgba(255,255,255,0.15)',
            'inset 0 4px 4px 0 rgba(130,169,198,0.27)',
            `inset 0 0 0 1px ${GLOW_COLOR}2e`,
          ].join(', '),
        }}
        initial={{ opacity: 0.85 }}
        animate={{ opacity: [0.85, 1, 0.7, 0] }}
        transition={{ duration: GLOW_DURATION, times: [0, 0.2, 0.7, 1], ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        {/* ② 底部辉光 */}
        <motion.div
          className="absolute -right-12 -bottom-14 -left-12 h-[118px]"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, ${GLOW_COLOR}66 0%, ${GLOW_COLOR}33 34%, ${GLOW_COLOR}00 72%)`,
            filter: 'blur(20px)',
          }}
          initial={{ opacity: 0.95 }}
          animate={{ opacity: [0.95, 0.9, 0.45, 0] }}
          transition={{ duration: GLOW_DURATION, times: [0, 0.35, 0.75, 1], ease: 'easeInOut' }}
        />
        {/* ③ 顶部扫光：从左掠过到右 */}
        <motion.div
          className="absolute top-[-8px] h-[178px] w-[166%] rounded-[50%]"
          style={{
            background: [
              `radial-gradient(ellipse at 50% 64%, ${GLOW_COLOR}b3 0%, ${GLOW_COLOR}66 24%, ${GLOW_COLOR}1f 46%, ${GLOW_COLOR}00 70%)`,
              `linear-gradient(180deg, ${GLOW_COLOR}00 0%, ${GLOW_COLOR}24 54%, ${GLOW_COLOR}00 100%)`,
            ].join(', '),
            filter: 'blur(24px)',
          }}
          initial={{ x: '-72%', opacity: 0.95 }}
          animate={{ x: ['-72%', '-36%', '18%', '78%'], opacity: [0.95, 1, 0.85, 0] }}
          transition={{ duration: GLOW_DURATION, times: [0, 0.26, 0.72, 1], ease: [0.25, 0.1, 0.25, 1] }}
          onAnimationComplete={() => setFinished(true)}
        />
      </div>
    </div>
  );
}
