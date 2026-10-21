/**
 * 官方 `b0(active, startedAtMs)` —— 「已运行秒数」计时 hook（live bundle 偏移 2126750，逐字）：
 * ```js
 * b0 = (e, t) => {                       // e = active, t = startedAtMs
 *   const base = typeof t === "number" && Number.isFinite(t) ? t : null;
 *   const ref = useRef(null); const [n, setN] = useState(0);
 *   useEffect(() => {
 *     if (!e) { ref.current = null; setN(0); return; }
 *     const start = base ?? Date.now();
 *     ref.current = start;
 *     setN(Math.max(0, Math.floor((Date.now() - start) / 1000)));
 *     const id = setInterval(() => {
 *       if (ref.current == null) return;
 *       setN(Math.max(0, Math.floor((Date.now() - ref.current) / 1000)));
 *     }, 1000);
 *     return () => clearInterval(id);
 *   }, [e, base]);
 *   return n;
 * };
 * ```
 * ⚠️ 官方常量 `ME = 5`：秒数 ≥ 5 才把时长显示出来（`T = isActive && N >= ME ? kp(N) : ""`）。
 *
 * 单独成文件以满足 `react-refresh/only-export-components`。
 */
import { useEffect, useRef, useState } from 'react';

/** 官方 `ME = 5`：elapsed 秒数 ≥ 5 才显示。 */
export const ELAPSED_VISIBLE_AFTER_SECONDS = 5;

export default function useElapsedSeconds(active: boolean, startedAtMs: number | null): number {
  const [seconds, setSeconds] = useState(0);
  const baseRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      baseRef.current = null;
      /* 不能在 effect 体里同步 setState（react-hooks/set-state-in-effect）⇒ 延到下一帧。 */
      const reset = requestAnimationFrame(() => setSeconds(0));
      return () => cancelAnimationFrame(reset);
    }
    const base = typeof startedAtMs === 'number' && Number.isFinite(startedAtMs) ? startedAtMs : null;
    const start = base ?? Date.now();
    baseRef.current = start;
    const tick = () => {
      if (baseRef.current == null) return;
      setSeconds(Math.max(0, Math.floor((Date.now() - baseRef.current) / 1000)));
    };
    const first = requestAnimationFrame(tick);
    const timer = setInterval(tick, 1000);
    return () => { cancelAnimationFrame(first); clearInterval(timer); };
  }, [active, startedAtMs]);
  return seconds;
}
