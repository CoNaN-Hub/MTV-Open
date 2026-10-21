/**
 * 官方消息时间戳的格式化（`page-BeI7xydN.js`@850626 的 `bde` + `vde` + `sI`）逐字复刻。
 * 单独成文件是为了满足 `react-refresh/only-export-components`（组件文件只导出组件）。
 */

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 官方 `vde`：zh* → `'zh-CN'`，其它原样（下划线换连字符）。 */
export function normalizeMessageLocale(locale: string): string {
  const normalized = (locale || 'en').replace(/_/g, '-');
  return normalized.toLowerCase().startsWith('zh') ? 'zh-CN' : normalized;
}

/** 官方 `bde(sentAtMs, nowMs, locale)` 逐字。 */
export function formatMessageTime(sentAtMs: number, nowMs: number, locale: string): string {
  const sentAt = new Date(sentAtMs);
  const sameYear = sentAt.getFullYear() === new Date(nowMs).getFullYear();
  const time = `${pad2(sentAt.getHours())}:${pad2(sentAt.getMinutes())}`;
  const lang = locale.toLowerCase();
  if (lang.startsWith('zh') || lang.startsWith('ja')) {
    const date = `${sentAt.getMonth() + 1}月${sentAt.getDate()}日`;
    return sameYear ? `${date} ${time}` : `${sentAt.getFullYear()}年${date} ${time}`;
  }
  if (lang.startsWith('ko')) {
    const date = `${sentAt.getMonth() + 1}월 ${sentAt.getDate()}일`;
    return sameYear ? `${date} ${time}` : `${sentAt.getFullYear()}년 ${date} ${time}`;
  }
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(sentAt);
  const day = sentAt.getDate();
  if (lang.startsWith('fr')) {
    return sameYear
      ? `${day} ${month} ${time}`
      : `${day} ${month} ${sentAt.getFullYear()} ${time}`;
  }
  return sameYear
    ? `${month} ${day}, ${time}`
    : `${month} ${day}, ${sentAt.getFullYear()}, ${time}`;
}
