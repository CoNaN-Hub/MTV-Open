/**
 * 官方「Query 锚点导航轨」（`query-locator-v2`）的纯函数层 —— live `vendor-pkg-canvas-ChpWx5JY.js` 逐字移植。
 *
 * 官方符号 → 本文件：
 *   `YM` @2618242  `"data-query-locator-anchor-id"`（**用户**消息行上的属性，锚点靠它找元素）
 *   `Sit`/`Nit`/`XM`/`Tit`/`Eit`/`kit`/`Ait`/`OI`/`Rit` @2618330  全部几何常量
 *   `MC` @2618330  空状态 `{fadeEdges:false,trackHeightPx:0,ticks:[],visible:false}`
 *   `zI`/`UI` @2618330  clamp / round
 *   `Iit` @2618442  标签截断（注意官方用的是 `...`，不是 `…`）
 *   `cae` @2618490  消息正文（`contents` 里全部 `text` item 拼起来、空白归一）
 *   `jit` @2618490  某条之后**第一条有正文的助手消息**的正文
 *   `Mit` @2618775  消息列表 → 锚点列表（每个用户消息一个，`Query N[: 标题]`）
 *   `Pit` @2618977  锚点 + 滚动量 → 轨道状态（`fadeEdges`/`trackHeightPx`/`ticks[].topPx`/`active`/`visible`）
 *   `rG`  @2619873  状态等价（避免每帧 setState）
 *   `BI`  @2619873  找真正可滚的祖先/自身/后代
 *   `Dit` @2620047  锚点 + 内容元素 → 带 `offsetTop` 的锚点
 *
 * 为什么 MTV 需要它：官方聊天右缘有一条**导航轨**（每个用户提问一个短横标记，当前所在的那条加粗），
 * 鼠标移到某条上会在其左侧弹出**预览卡**（第一行 = 该用户消息正文，含 `@技能` 芯片；
 * 第二行 = 其后第一条助手正文，`line-clamp-2`）。用户实测截图正是这一对元素（MTV 完全没有）。
 */

/** 官方 `YM`：用户消息行上承载锚点 id 的属性名。 */
export const QUERY_LOCATOR_ANCHOR_ATTRIBUTE = 'data-query-locator-anchor-id';

/** 官方 `Sit`：至少这么多个用户消息才显示导轨。 */
export const MIN_ANCHOR_COUNT = 2;
/** 官方 `Nit`：轨道上下留白（px）。 */
export const TRACK_PADDING_PX = 8;
/** 官方 `XM`：判定「可滚动」的最小溢出（px）。 */
export const MIN_SCROLL_OVERFLOW_PX = 1;
/** 官方 `Tit`：锚点标签里截取的用户消息正文字符数。 */
export const QUERY_LABEL_MAX_LENGTH = 80;
/** 官方 `Eit`/`kit`/`Ait`：轨道高度 = `clamp(可视高度*0.42, 168, 360)`。 */
export const TRACK_HEIGHT_RATIO = 0.42;
export const TRACK_HEIGHT_MIN_PX = 168;
export const TRACK_HEIGHT_MAX_PX = 360;
/** 官方 `OI`：相邻锚点间距（px）。 */
export const TICK_SPACING_PX = 12;
/** 官方 `Rit`：命中悬浮预览的垂直容差（px）。 */
export const HOVER_TOLERANCE_PX = 8;

export interface QueryAnchor {
  /** 官方用**用户消息 id**（`data-query-locator-anchor-id` 的值）。 */
  id: string;
  /** 官方 `label`：`Query N` 或 `Query N: <正文截断>`。 */
  label: string;
  /** 官方 `previewTitle`：该用户消息的正文章，无正文时回落 `label`。 */
  previewTitle: string;
  /** 官方 `previewText`：其后第一条有正文的助手消息正文（可空）。 */
  previewText?: string;
}

export interface QueryLocatorTick extends QueryAnchor {
  /** 官方 `targetTop`：夹到 `[0, maxScroll]` 的滚动目标。 */
  targetTop: number;
  /** 官方 `topPx`：轨道内的像素位置。 */
  topPx: number;
  /** 官方 `active`：当前滚动位置最近的一条。 */
  active: boolean;
}

export interface QueryLocatorState {
  fadeEdges: boolean;
  trackHeightPx: number;
  ticks: QueryLocatorTick[];
  visible: boolean;
}

/** 官方 `MC`。 */
export const EMPTY_QUERY_LOCATOR_STATE: QueryLocatorState = {
  fadeEdges: false,
  trackHeightPx: 0,
  ticks: [],
  visible: false,
};

/** 官方 `zI`。 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 官方 `UI`。 */
function round(value: number): number {
  return Math.round(value);
}

/** 官方 `Iit`：超长截断（**三个点**，不是省略号字符）。 */
export function truncateQueryLabel(value: string, max: number = QUERY_LABEL_MAX_LENGTH): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

/**
 * 官方 `cae`：消息正文 = `contents` 里全部 `text` item 拼起来、空白归一、trim。
 * ⚠️ MTV 侧的用户消息正文在 `ChatMessage.content`（`contents` 通常缺省）⇒ 这里先取
 * `contents` 的 text item，取不到再回落 `content`（渲染结果一致：官方写入口同样把它们写进 contents）。
 */
export function queryMessageText(
  message: { content?: string; contents?: readonly { type?: string; content?: unknown }[] },
): string {
  const fromContents = (message.contents ?? [])
    .filter((item) => item.type === 'text' && typeof item.content === 'string')
    .map((item) => String(item.content))
    .join(' ');
  const text = fromContents || (typeof message.content === 'string' ? message.content : '');
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 官方 `jit`：从 `from` 起第一条**有正文的助手消息**的正文（遇到下一条用户消息就停）。
 */
function nextAssistantPreviewText(
  messages: readonly { role?: string; content?: string; contents?: readonly { type?: string; content?: unknown }[] }[],
  from: number,
): string | undefined {
  for (let index = from; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === 'user') return undefined;
    if (message.role !== 'assistant') continue;
    const text = queryMessageText(message);
    if (text) return text;
  }
  return undefined;
}

/** 官方 `Mit`：消息列表 → 锚点列表（每个用户消息一个，序号从 1 开始）。 */
export function buildQueryAnchors(
  messages: readonly { id: string; role?: string; content?: string; contents?: readonly { type?: string; content?: unknown }[] }[],
): QueryAnchor[] {
  let queryIndex = 0;
  return messages.flatMap((message, index) => {
    if (message.role !== 'user') return [];
    queryIndex += 1;
    const label = `Query ${queryIndex}`;
    const title = queryMessageText(message);
    const short = truncateQueryLabel(title, QUERY_LABEL_MAX_LENGTH);
    return [{
      id: message.id,
      label: short ? `${label}: ${short}` : label,
      previewText: nextAssistantPreviewText(messages, index + 1),
      previewTitle: title || label,
    }];
  });
}

/** 官方 `Pit`。 */
export function computeQueryLocatorState({
  anchors,
  clientHeight,
  scrollHeight,
  scrollTop,
  trackPaddingPx = TRACK_PADDING_PX,
}: {
  anchors: readonly (QueryAnchor & { offsetTop: number })[];
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  trackPaddingPx?: number;
}): QueryLocatorState {
  if (anchors.length < MIN_ANCHOR_COUNT || clientHeight <= 0 || scrollHeight <= clientHeight + MIN_SCROLL_OVERFLOW_PX) {
    return EMPTY_QUERY_LOCATOR_STATE;
  }
  const maxScroll = Math.max(scrollHeight - clientHeight, 1);
  const trackHeightPx = round(clamp(clientHeight * TRACK_HEIGHT_RATIO, TRACK_HEIGHT_MIN_PX, TRACK_HEIGHT_MAX_PX));
  const ticksSpan = (anchors.length - 1) * TICK_SPACING_PX;
  const fadeEdges = trackPaddingPx * 2 + ticksSpan > trackHeightPx;
  const placed = anchors.map((anchor) => {
    const { offsetTop, ...rest } = anchor;
    return { ...rest, targetTop: round(clamp(offsetTop, 0, maxScroll)) };
  });
  let activeIndex = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < placed.length; index += 1) {
    const distance = Math.abs(placed[index].targetTop - scrollTop);
    if (distance < best) {
      activeIndex = index;
      best = distance;
    }
  }
  const rawStart = trackHeightPx / 2 - activeIndex * TICK_SPACING_PX;
  const start = fadeEdges
    ? clamp(rawStart, trackPaddingPx + ticksSpan, trackHeightPx - trackPaddingPx)
    : trackHeightPx / 2 - ticksSpan / 2;
  const ticks = placed.map((tick, index) => ({
    ...tick,
    active: index === activeIndex,
    topPx: round(start + index * TICK_SPACING_PX),
  }));
  return { fadeEdges, trackHeightPx, ticks, visible: true };
}

/** 官方 `rG`：状态等价（相同则不 setState，避免滚动时每帧重渲染）。 */
export function isSameQueryLocatorState(a: QueryLocatorState, b: QueryLocatorState): boolean {
  if (
    a.fadeEdges !== b.fadeEdges
    || a.visible !== b.visible
    || a.trackHeightPx !== b.trackHeightPx
    || a.ticks.length !== b.ticks.length
  ) return false;
  return a.ticks.every((tick, index) => {
    const other = b.ticks[index];
    return tick.active === other.active
      && tick.id === other.id
      && tick.label === other.label
      && tick.previewText === other.previewText
      && tick.previewTitle === other.previewTitle
      && tick.targetTop === other.targetTop
      && tick.topPx === other.topPx;
  });
}

/** 官方 `BI`：给定元素若可滚就用它，否则用第一个可滚的后代，再否则原样返回。 */
export function findScrollRoot(
  element: HTMLElement | null,
  minOverflow: number = MIN_SCROLL_OVERFLOW_PX,
): HTMLElement | null {
  if (!element) return null;
  if (element.scrollHeight > element.clientHeight + minOverflow) return element;
  for (const candidate of Array.from(element.querySelectorAll<HTMLElement>('*'))) {
    if (candidate.scrollHeight > candidate.clientHeight + minOverflow) return candidate;
  }
  return element;
}

/** 官方 `Dit`：锚点 + 内容元素 → 带 `offsetTop` 的锚点（找不到元素的消息直接跳过）。 */
export function attachAnchorOffsets(
  contentElement: HTMLElement | null,
  anchors: readonly QueryAnchor[],
): (QueryAnchor & { offsetTop: number })[] {
  if (!contentElement) return [];
  const byId = new Map<string, HTMLElement>();
  for (const element of Array.from(contentElement.querySelectorAll<HTMLElement>(`[${QUERY_LOCATOR_ANCHOR_ATTRIBUTE}]`))) {
    const id = element.getAttribute(QUERY_LOCATOR_ANCHOR_ATTRIBUTE);
    if (id) byId.set(id, element);
  }
  return anchors.flatMap((anchor) => {
    const element = byId.get(anchor.id);
    return element ? [{ ...anchor, offsetTop: element.offsetTop }] : [];
  });
}
