/**
 * 官方「Agent 错误横幅」—— `page-BeI7xydN.js`@679999 的 `qae` 逐字
 * （`Z0` 分派里 `item.type === 'agent_error'` 走这条）。
 *
 * 官方原文：
 *   const AgentErrorBanner = ({message, isStreaming, onRetry}) => {
 *     const [retrying, setRetrying] = useState(false);
 *     const handleRetry = () => {
 *       if (!onRetry || isStreaming || retrying) return;
 *       setRetrying(true);
 *       Promise.resolve(onRetry()).catch(() => {}).finally(() => setRetrying(false));
 *     };
 *     return (
 *       <div role="alert" data-testid="agent-error-banner"
 *         className="flex w-full min-w-0 items-center gap-3 rounded-[24px] border border-foreground/15
 *                    bg-background/40 px-4 py-3 text-sm text-foreground">
 *         <CircleAlert className="size-5 shrink-0 text-foreground/90" strokeWidth={1.8} />
 *         <span className="min-w-0 flex-1">{message}</span>
 *         <button type="button"
 *           className="shrink-0 rounded-full border border-foreground/15 px-3.5 py-1.5 font-medium
 *                      text-foreground transition-colors hover:bg-foreground/10
 *                      disabled:cursor-not-allowed disabled:opacity-50"
 *           onClick={handleRetry} disabled={!onRetry || isStreaming || retrying}>
 *           {t('common.retry','Retry')}
 *         </button>
 *       </div>
 *     );
 *   };
 *
 * 图标 `GT` 由官方 import 映射反解：`hi as GT` → `P3=F("circle-alert", …)` ⇒ **lucide `circle-alert`**。
 */
import { useCallback, useState } from 'react';
import { useT } from '../../i18n';
import { OfficialCircleAlertIcon } from './officialIcons';

export default function AgentErrorBanner({
  message,
  isStreaming = false,
  onRetry,
}: {
  message: string;
  isStreaming?: boolean;
  onRetry?: () => void | Promise<void>;
}) {
  const t = useT();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(() => {
    if (!onRetry || isStreaming || retrying) return;
    setRetrying(true);
    Promise.resolve(onRetry())
      .catch(() => {})
      .finally(() => setRetrying(false));
  }, [isStreaming, onRetry, retrying]);

  return (
    <div
      role="alert"
      data-testid="agent-error-banner"
      className="flex w-full min-w-0 items-center gap-3 rounded-[24px] border border-foreground/15 bg-background/40 px-4 py-3 text-sm text-foreground"
    >
      <OfficialCircleAlertIcon className="size-5 shrink-0 text-foreground/90" strokeWidth={1.8} />
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        className="shrink-0 rounded-full border border-foreground/15 px-3.5 py-1.5 font-medium text-foreground transition-colors hover:bg-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleRetry}
        disabled={!onRetry || isStreaming || retrying}
      >
        {t('重试')}
      </button>
    </div>
  );
}
