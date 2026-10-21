/**
 * 官方 `vS` 的时长格式化：`c1e(ms) = kp(Math.max(1, Math.round(ms / 1000)))`。
 * 官方 `kp(e)`（live bundle 偏移 ~450752）逐字：`t<60 → \`${t}s\``；否则 `n=floor(t/60)`, `o=t%60`，
 * `o>0 ? \`${n}m${o}s\` : \`${n}m\`` —— **分与秒之间没有空格**（`1m30s`，不是 `1m 30s`）。
 * 单独成文件是为了满足 `react-refresh/only-export-components`。
 */

/** 官方 `kp(e)`（秒 → 文本）。 */
export function formatDurationSeconds(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds));
  if (t < 60) return `${t}s`;
  const minutes = Math.floor(t / 60);
  const seconds = t % 60;
  return seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`;
}

/** 官方 `c1e(durationMs)`。 */
export default function formatWorkDuration(durationMs: number | null | undefined): string {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) return '';
  return formatDurationSeconds(Math.max(1, Math.round(durationMs / 1000)));
}
