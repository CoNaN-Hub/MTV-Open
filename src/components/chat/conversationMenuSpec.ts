/**
 * conversationMenuSpec —— 官方会话下拉的**纯数据/格式化**（不含 React）。
 *
 * 官方依据（`tapnow-agent-panel-ground-truth.md` §2）：
 *   · 容器 `w-72 p-1.5 rounded-xl`、`sideOffset: 8`（PAGE@723910）
 *   · 滚动区 `max-h-[400px]`
 *   · 行内时间 `text-[11px] text-muted-foreground/50 tabular-nums`，`conversation.justNow` = 「刚刚」
 *
 * ⚠️ 文件名故意不叫 `conversationMenu.ts`：与 `ConversationMenu.tsx` **仅大小写不同**，
 *   在 Windows 上会触发 TS1261（Already included file name … differs only in casing）。
 *
 * 说明：官方的时间串走内部相对时间格式器（未能在产物里定位到完整词表），
 * 这里用平台 `Intl.RelativeTimeFormat` 生成同语义相对时间 + 官方「刚刚」文案。
 */
export const CONVERSATION_MENU_OFFSET = 8;
export const CONVERSATION_MENU_WIDTH = 288;
export const CONVERSATION_MENU_MAX_HEIGHT = 400;

/* ── 官方分页 / legacy 分组的常量（全部逐字取自 `vendor-pkg-canvas-ChpWx5JY.js`）──

   · `Yx=20` @457058 —— 同一常量块里还有 `v4=100`（重命名输入 `maxLength`）。
     官方两处用它：`listConversations({pageSize:Yx,…})`（legacy 首页）与
     `$fe({canvas_id,scope:"all",limit:Yx})`（普通列表的 useInfiniteQuery 页大小）。
   · `threshold:.1` @2478431 —— 无限滚动哨兵 `<div ref={k} className="h-px w-full"/>` 的
     IntersectionObserver 阈值；官方回调逐字：
       `me=>{me[0].isIntersecting&&H&&!oe&&!V&&$()}`（H=hasNextPage · oe=loading · V=isFetchingNextPage · $=fetchNextPage）
   · `NY="starter-replay-"` @413776（`rb=e=>e.startsWith(NY)`）—— starter-replay 会话 id 前缀。 */
export const CONVERSATION_PAGE_SIZE = 20;
export const CONVERSATION_SCROLL_THRESHOLD = 0.1;
export const CONVERSATION_SENTINEL_CLASS = 'h-px w-full';
export const CONVERSATION_STARTER_REPLAY_PREFIX = 'starter-replay-';

/**
 * 官方 `rb=e=>e.startsWith(NY)`（`NY="starter-replay-"` @413776）。
 * 官方 `Pae` 用它推出 `je`（starterReplayViewOnlyBanner 的条件）。
 */
export function isStarterReplayConversation(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(CONVERSATION_STARTER_REPLAY_PREFIX);
}

/**
 * MTV 没有官方的 `isLegacyReadOnly` 会话标志；对位字段是 `ChatConversation.archived`
 * （「旧版只读归档」语义，`store.chat.ts` 建会话时为 `false`，只有 `conversation_update`
 * 工具能改）。官方 legacy 区块的数据源是**另一个分页接口**
 * `listConversations({channel:"canvas",pageSize:20,currentPage:n,orderBy:"updated_at",sortOrder:"desc"})`，
 * MTV 的全量会话本来就在 store 里 ⇒ 用 `archived` 分桶等价。
 */
export function isLegacyConversation(conversation: { archived?: boolean }): boolean {
  return conversation.archived === true;
}

/** 按官方两条数据路把会话分成「普通列表 `re`」与「legacy 列表 `g`」。 */
export function partitionConversations<T extends { archived?: boolean }>(
  conversations: readonly T[],
): { active: T[]; legacy: T[] } {
  const active: T[] = [];
  const legacy: T[] = [];
  for (const conversation of conversations) {
    (isLegacyConversation(conversation) ? legacy : active).push(conversation);
  }
  return { active, legacy };
}

/**
 * 客户端分页（官方 `pageSize = Yx = 20`）。
 *
 * 官方 `hasNextPage`/`S` 的口径是「**刚取回的那一页条数 >= 20**」
 * （legacy：`N(He.length>=Yx)`；普通列表：react-query 的 `hasNextPage`）。
 * MTV 没有服务端往返，`items.length >= 20` 在「正好 20 条」时会多给一次空页，
 * 所以这里用**精确**口径 `total > page*20`（等价于「还有没渲染出来的条目」），
 * 边界（0 / 20 / 21 条）由单测钉死。
 */
export function paginateConversations<T>(
  conversations: readonly T[],
  page: number,
): { items: T[]; hasNextPage: boolean } {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const end = safePage * CONVERSATION_PAGE_SIZE;
  return { items: conversations.slice(0, end), hasNextPage: conversations.length > end };
}

export function formatConversationRelativeTime(
  timestamp: number,
  locale: string,
  justNow: string,
): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return justNow;
  const formatter = new Intl.RelativeTimeFormat(locale || 'zh-CN', { numeric: 'auto' });
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 30) return formatter.format(-days, 'day');
  return formatter.format(-Math.floor(days / 30), 'month');
}
