/**
 * MessageTimestamp —— 官方消息时间戳（`page-BeI7xydN.js`@851378 的 `wde`）逐字复刻。
 * 格式化函数在 `messageTimeFormat.ts`（官方 `bde` / `vde` 逐字）。
 *
 * 官方 `wde`：
 *   const margin = side === "start" ? (visible ? "mr-0" : "-mr-1") : (visible ? "ml-0" : "-ml-1");
 *   <span data-message-time={visible ? "visible" : "hidden"}
 *     className={`pointer-events-none inline-flex h-6 items-center whitespace-nowrap font-normal text-xs
 *       leading-none text-muted-foreground/80
 *       [font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]
 *       ${visible ? "w-auto overflow-visible opacity-100" : "w-0 overflow-hidden opacity-0"} ${margin}`} />
 *
 * **平时 `w-0 opacity-0`，hover/可见时才撑开** —— 这是官方截图里「时间时有时无」的原因。
 */
import { useState } from 'react';
import { getLocale } from '../../i18n';
import { formatMessageTime, normalizeMessageLocale } from './messageTimeFormat';

export interface MessageTimestampProps {
  sentAtMs: number;
  /** 官方 `side`：`start` 在操作栏最前（user 用），`end` 在最后。 */
  side?: 'start' | 'end';
  /** 官方 `visible`：hover 才展开。 */
  visible?: boolean;
}

export default function MessageTimestamp({ sentAtMs, side = 'end', visible = false }: MessageTimestampProps) {
  /* 官方 `wde` 在 render 里读 `Date.now()`（只用于「是否同年」的判断）。
     React 纯度规则不允许 render 里调 `Date.now()` ⇒ 用一次性惰性 state 取「当前时刻」。 */
  const [now] = useState(() => Date.now());
  const text = formatMessageTime(sentAtMs, now, normalizeMessageLocale(getLocale()));
  const margin = side === 'start'
    ? (visible ? 'mr-0' : '-mr-1')
    : (visible ? 'ml-0' : '-ml-1');
  return (
    <span
      data-message-time={visible ? 'visible' : 'hidden'}
      className={[
        'c-msg-time pointer-events-none inline-flex h-6 items-center whitespace-nowrap font-normal text-xs leading-none',
        "[font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]",
        visible ? 'w-auto overflow-visible opacity-100' : 'w-0 overflow-hidden opacity-0',
        margin,
      ].join(' ')}
    >
      {text}
    </span>
  );
}
