/**
 * CompactLifecycleLine —— 官方 `Tie`（displayName `CompactLifecycleLine`，live bundle 偏移 2423475）1:1 复刻。
 *
 * 官方逐字：
 * ```js
 * Tie = memo(({phase, isStreaming}) => {
 *   const active = phase === "started" && isStreaming;
 *   const seconds = b0(active);
 *   const compacting = t("chatAdapter.streaming.compacting");
 *   const compacted  = t("chatAdapter.streaming.compacted");
 *   const label = active ? compacting : compacted;
 *   return <output aria-live="polite"
 *     className="flex w-full min-w-[280px] items-center gap-3 py-1.5 text-xs leading-4 text-foreground/70">
 *     <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-gradient-to-r from-transparent to-foreground/25" />
 *     <span className="inline-flex items-center gap-0.5">
 *       <Gfe className="size-3.5 shrink-0" />
 *       <span className="relative inline-flex items-center justify-center whitespace-nowrap">
 *         <span aria-hidden="true" className="invisible">{longer of the two}</span>
 *         <span className="absolute inset-0 inline-flex items-center justify-center">
 *           {active ? <zp as="span" duration={1.55} spread={2}>{label}</zp> : label}
 *         </span>
 *       </span>
 *       {active ? <span aria-hidden="true" className="ml-0.5 whitespace-nowrap tabular-nums text-foreground/60"
 *                   data-testid="compact-elapsed">· {kp(seconds)}</span> : null}
 *     </span>
 *     <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-gradient-to-r from-foreground/25 to-transparent" />
 *   </output>;
 * });
 * ```
 * **宽度稳定技巧**：用 `invisible` 的「compacting / compacted 里更长的那个」占位，实际文案绝对定位叠上去。
 * 事件形态：`{ type: "compact", content: { phase: "started" | "finished" } }`（`phase` 缺省为 `"started"`）。
 */
import { memo } from 'react';
import { getLocale, useT } from '../../i18n';
import { streamLabel } from '../../services/chat/streamingStrings';
import { OfficialCompactIcon } from './officialIcons';
import ShimmerText from './ShimmerText';
import formatDurationSeconds from './workDuration';
import useElapsedSeconds from './useElapsedSeconds';

export interface CompactLifecycleLineProps {
  /** 官方 `phase`：`"started"`（压缩中）/ `"finished"`（已压缩）。 */
  phase: string;
  isStreaming: boolean;
}

function CompactLifecycleLine({ phase, isStreaming }: CompactLifecycleLineProps) {
  useT(); // 订阅语言切换
  const locale = getLocale();
  /* 官方：`active = phase === "started" && isStreaming`；`b0(active)` 无 startedAt 参数。 */
  const active = phase === 'started' && isStreaming;
  const seconds = useElapsedSeconds(active, null);
  const compacting = streamLabel('compacting', locale);
  const compacted = streamLabel('compacted', locale);
  const label = active ? compacting : compacted;

  return (
    <output
      aria-live="polite"
      className="flex w-full min-w-[280px] items-center gap-3 py-1.5 text-xs leading-4 text-foreground/70"
    >
      <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-gradient-to-r from-transparent to-foreground/25" />
      <span className="inline-flex items-center gap-0.5">
        <OfficialCompactIcon className="size-3.5 shrink-0" />
        <span className="relative inline-flex items-center justify-center whitespace-nowrap">
          <span aria-hidden="true" className="invisible">{compacting.length >= compacted.length ? compacting : compacted}</span>
          <span className="absolute inset-0 inline-flex items-center justify-center">
            {active
              ? <ShimmerText as="span" duration={1.55} spread={2}>{label}</ShimmerText>
              : label}
          </span>
        </span>
        {active ? (
          <span
            aria-hidden="true"
            className="ml-0.5 whitespace-nowrap tabular-nums text-foreground/60"
            data-testid="compact-elapsed"
          >
            · {formatDurationSeconds(seconds)}
          </span>
        ) : null}
      </span>
      <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-gradient-to-r from-foreground/25 to-transparent" />
    </output>
  );
}

export default memo(CompactLifecycleLine);
