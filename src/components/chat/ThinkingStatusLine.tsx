/**
 * ThinkingStatusLine —— 官方 `P_`（`page-DVqoHdTT.js`@637560，`displayName="ThinkingStatusLine"`）逐字复刻。
 *
 * 官方原文：
 *   const P_ = memo(({label, isStreaming, elapsedText = ""}) => {
 *     const inner = isStreaming
 *       ? <ShimmerText as="span" duration={1.7} spread={1.4} className="text-[13px]">{label}</ShimmerText>
 *       : <span className="text-[13px]">{label}</span>;
 *     return (
 *       <output aria-live={isStreaming ? "polite" : "off"}
 *         className="inline-flex items-center gap-2 py-1 text-[13px] font-medium leading-[1.65] text-muted-foreground"
 *         data-no-quote>
 *         <img src="/agent-motion/motion-thinking.webp" alt="" className="size-3.5 shrink-0" />
 *         {inner}
 *         {elapsedText ? <span className="shrink-0 text-[13px] font-normal leading-[1.65] tabular-nums
 *                                       text-muted-foreground/50">· {elapsedText}</span> : null}
 *       </output>
 *     );
 *   });
 *
 * 上层 `ah`（`ThinkingIndicator`）选文案：
 *   recovering  → t('chatAdapter.streaming.recovering','Reconnecting...')
 *   interrupted → t('chatAdapter.streaming.interrupted','Stopping...')
 *   thinkingActivity（官方 `Jx` 四档）→ thinking / working / processing / composing
 *   streaming   → 另一条 streaming 文案
 *
 * ✅ 流光文字 `Aa`(ShimmerText, duration 1.7 / spread 1.4) 已在 `ShimmerText.tsx` 落地并在下面使用。
 */
import { useEffect, useState } from 'react';
import { getLocale, useT } from '../../i18n';
import { streamLabel } from '../../services/chat/streamingStrings';
import ShimmerText from './ShimmerText';

/** 官方 `pie`：与官方同路径的动图资源（MTV `public/agent-motion/` 下已存在同名文件）。 */
const THINKING_MOTION_SRC = '/agent-motion/motion-thinking.webp';

/**
 * 官方 `Jx`（`use-chat-attachment-file-input-CE59XJWo.js@305212`）**逐字**：
 * ```js
 * Jx = ["chatAdapter.streaming.thinking","chatAdapter.streaming.working",
 *       "chatAdapter.streaming.processing","chatAdapter.streaming.composing"];
 * Cee = list => { const [v] = useState(() => list[Math.floor(Math.random() * list.length)] ?? ''); return v; };
 * ```
 * ⇒ `ThinkingIndicator`（官方 `Ah`）在 `streamState === 'streaming'` 且没有明确 `thinkingActivity` 时，
 * **每次挂载随机挑一条**并固定下来（不是顺序轮播，也不是只显示「思考中」）。
 */
const ROTATING_ACTIVITY_KEYS = ['thinking', 'working', 'processing', 'composing'] as const;

/** 官方 `fx = 5`：elapsed 秒数 ≥ 5 才显示计时。 */
const ELAPSED_VISIBLE_AFTER_SECONDS = 5;

/** 官方 `x0`（同文件）**逐字**：`t<60 → "Xs"`，否则 `"NmSs"`（秒为 0 时只给 `Nm`）。 */
function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest > 0 ? `${minutes}m${rest}s` : `${minutes}m`;
}

export interface ThinkingStatusLineProps {
  /** 官方 `streamState`：`idle | streaming | thinking | recovering | interrupted`。 */
  streamState?: string;
  /** 官方 `thinkingActivity`：`thinking` 等。 */
  thinkingActivity?: string | null;
  /** 官方 `startedAtMs`：用于算 `elapsedText`。 */
  startedAtMs?: number | null;
}

export default function ThinkingStatusLine({
  streamState = 'streaming',
  thinkingActivity = null,
  startedAtMs = null,
}: ThinkingStatusLineProps) {
  useT(); // 仅用于订阅语言切换（getLocale() 本身不是响应式的）
  const isStreaming = streamState !== 'idle';
  /* 官方 `af(isStreaming, startedAtMs)` 是个会随时间推进的 hook；React 规则不允许在 render 里读
     `Date.now()`，所以用 state + 定时器驱动（流式期间每秒一跳）。 */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isStreaming || !startedAtMs) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isStreaming, startedAtMs]);
  const elapsedSeconds = isStreaming && startedAtMs
    ? Math.max(0, Math.floor((now - startedAtMs) / 1000))
    : null;
  /* 官方 `Ah`：`a = o >= fx ? Ia(o) : ""`（`fx = 5`、`Ia` = `x0` 的 `Xs` / `NmSs` 格式）。 */
  const elapsedText = elapsedSeconds != null && elapsedSeconds >= ELAPSED_VISIBLE_AFTER_SECONDS
    ? formatElapsed(elapsedSeconds)
    : '';
  /* 官方 `Cee(Y$)`：挂载时随机固定一条活动文案（`useState` 惰性初始化 ⇒ 整个挂载周期不变）。 */
  const [rotatingActivity] = useState(
    () => ROTATING_ACTIVITY_KEYS[Math.floor(Math.random() * ROTATING_ACTIVITY_KEYS.length)],
  );
  /* 官方的文案分支（live bundle 逐字）：recovering → interrupted →
     `thinkingActivity === "thinking" ? thinking : (streamState === "streaming" ? 随机挑中的那条 : thinking)`。
     ⚠️ 官方 `thinkingActivity` 的取值域只有 `null | "thinking" | "degraded"`（`jlt = 15e3` 把 thinking 降级成
     degraded），**"degraded" 不能直接拿去查文案**，否则会把字面量渲染出来；它必须回落到 streaming 的随机条。 */
  const locale = getLocale();
  const activityLabel = thinkingActivity === 'thinking' ? streamLabel('thinking', locale) : undefined;
  const label = streamState === 'recovering'
    ? streamLabel('recovering', locale)
    : streamState === 'interrupted'
      ? streamLabel('interrupted', locale)
      : activityLabel ?? (streamState === 'streaming'
        ? streamLabel(rotatingActivity, locale)
        : streamLabel('thinking', locale));

  return (
    <output
      aria-live={isStreaming ? 'polite' : 'off'}
      className="inline-flex items-center gap-2 py-1 text-[13px] font-medium leading-[1.65] text-muted-foreground"
      data-no-quote
    >
      <img src={THINKING_MOTION_SRC} alt="" className="size-3.5 shrink-0" />
      {/* 官方 `P_`：streaming 时摘要用流光文字 `Aa`(ShimmerText, duration 1.7 / spread 1.4)，
          非 streaming 用普通 span。 */}
      {isStreaming
        ? <ShimmerText as="span" duration={1.7} spread={1.4} className="text-[13px]">{label}</ShimmerText>
        : <span className="text-[13px]">{label}</span>}
      {elapsedText ? (
        <span className="shrink-0 text-[13px] font-normal leading-[1.65] tabular-nums text-muted-foreground/50">
          · {elapsedText}
        </span>
      ) : null}
    </output>
  );
}
