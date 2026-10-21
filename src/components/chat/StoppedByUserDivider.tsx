/**
 * StoppedByUserDivider —— 官方 `Fit`（live bundle 偏移 2624783）1:1 复刻。
 *
 * 官方逐字：
 * ```js
 * Fit = ({ className }) => {
 *   const { t } = se();
 *   return <div className={z("flex w-full items-center gap-3 py-1.5 text-xs leading-4", className)}>
 *     <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-foreground/25" />
 *     <span className="shrink-0 text-muted-foreground">{t("chatAdapter.streaming.stoppedByUser","You stopped this response")}</span>
 *     <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-foreground/25" />
 *   </div>;
 * };
 * ```
 * 注意两条分隔线的渐变方向**相反**（左 `to-foreground/25`、右 `to-l`）。
 */
import { memo } from 'react';
import { getLocale, useT } from '../../i18n';
import { streamLabel } from '../../services/chat/streamingStrings';

export interface StoppedByUserDividerProps {
  className?: string;
}

function StoppedByUserDivider({ className }: StoppedByUserDividerProps) {
  useT(); // 订阅语言切换
  const locale = getLocale();
  return (
    <div className={`flex w-full items-center gap-3 py-1.5 text-xs leading-4${className ? ` ${className}` : ''}`}>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-foreground/25" />
      <span className="shrink-0 text-muted-foreground">{streamLabel('stoppedByUser', locale)}</span>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-foreground/25" />
    </div>
  );
}

export default memo(StoppedByUserDivider);
