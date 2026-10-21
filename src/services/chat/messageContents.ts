/**
 * 「消息级有序 `contents`」模型层 —— 覆盖表 §6 #1 的**生产者 + 分段器**。
 *
 * 官方消息模型是 `{contents: Item[]}`，渲染器 `Z0`/`$M` **按数组顺序逐项分派**：
 *   · 命中卡片族的 item 各自渲染成一张卡：
 *     `ask_question`→`Moe`、`generation_confirmation`/`node_update_confirmation`/auto-preview→
 *     `qet`/`Btt`/`eet`、`show_widget`→`fre`/`mre`、`show_html`→`ure`、`show_form`→`HM`/`ase`、
 *     `get_connector_status`→`Loe`、mcpApp→`nre`；
 *   · 其余 `tool_event`/`subagent` 交给 `kh`(`CollapsibleToolSection`) 的**连续分桶**
 *     （块模型第 2 层 `PF`）；
 *   · `compact` → `Tie`。
 *
 * ⚠️ **MTV 的数据源差异（如实登记）**：`ChatMessage.content` 是流式正文字符串、任务态在
 * `agentTask`（含 `steps` 与子任务）、压缩事实在 `message.compactedAt`。所以本模块把这三处
 * **生产**成同一份官方有序 item 列表：
 *   · `buildMessageContents(...)` —— 生产者（`ChatMessage.contents` 缺省时的唯一回落路径）；
 *   · `buildActivitySegmentsFromContents(...)` —— 把**已经有序**的 contents 切成渲染段
 *     （**不再排序**，顺序完全由 contents 决定）；
 *   · `buildActivitySegments(...)` —— 旧 API（items + childTasks），保留给既有调用方，
 *     内部走**同一套**排序（`orderEntries`）与**同一个**分桶实现（`entriesToSegments`）。
 *
 * 排序规则**只有一处**（`orderEntries`）：**正文条目恒排在全部非正文条目之后**（MTV 只有一个
 * *最终* 正文字符串，等价于「最后到达的那段正文」），其余按 `startedAt` 稳定排序（同刻保持插入序）。
 * ⇒ 渲染顺序 = 官方「事件到达即追加」的最近似形态：`工具/卡片/子代理… → 正文`，
 * 于是官方「折叠摘要行在正文**之上**」的版式（`vS`/`AgentStepsSection`）才可能出现。
 *
 * ⚠️ 与 `agentMessageContents.assembleRawAgentMessageContents` 的**已知分歧**（另一个模块，未改）：
 * 那条装配路径是「活动项在前、正文在后」，本模块现在也是「正文在最后」——但本模块此前是
 * 「正文在最前」（用 `message.timestamp` 当排序键），已按官方改掉。两者仍不完全等于官方
 * （官方是「到达即追加」，正文天然插空在工具之间，且**中途正文**也是一个 item），
 * 仓库里没有生产者走那条路径，故未动它。见报告。
 */
import type { AgentTask } from '../../types/agent';
import type { ChatMessageTextItem, ChatMessageThinkingItem } from '../../types/chat';
import type { ToolEventLike } from './agentToolLabels';
import type { AgentMessageContentItem } from './agentMessageContents';
import { childTaskToSubagentItem, itemAppendOrderAt, stepToOfficialToolEventItems } from './agentMessageContents';
import type { SubagentItem, ToolEventItem } from './agentContents';
import { PF } from './agentBlocks';
import { classifyToolEventFamily } from './agentMessageContents';
import type { AgentContentInput } from './agentContents';
import { isAskQuestionTool } from './askQuestion';
import { isDesktopConfirmationTool } from './desktopConfirmationCard';
import { isConnectorAuthCardEvent } from './connectorAuthCard';
import { isMcpAppEvent } from './mcpAppCard';
import { renderableToolSteps, taskStepsToToolEvents } from './agentActivityItems';
import { isAutoPreviewCardEvent, isConfirmationCardToolEvent } from '../../components/chat/confirmationEventDispatch';

/** 官方块模型的块（`kh` 的 `blocks`）：子代理行 / 工具行桶。 */
export type MessageToolBlock =
  | { kind: 'subagent'; agent: ToolEventLike; children: readonly ToolEventLike[] }
  | { kind: 'items'; items: readonly ToolEventLike[] };

/** 有序分段：一段连续的「工具/子代理」、一段连续的「卡片」、一段正文（官方 `text` item）、
 *  一段思考（官方 `thinking` item）、官方 `compact` 行（`Tie`），或官方 `agent_error` 横幅
 *  （`Qrt`/`AgentErrorBanner`）。 */
export type MessageActivitySegment =
  | { kind: 'cards'; items: ToolEventLike[] }
  | { kind: 'tools'; blocks: MessageToolBlock[] }
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'compact'; phase: string }
  /** 官方 `agent_error` item（`$M` @2466855：`return s.jsx(Qrt,{message:content,…})`）——就地成段。 */
  | { kind: 'agent_error'; text: string };

/**
 * 该 item 是否「自成一张卡」（不进工具行分桶）。
 *
 * 判据与官方 `$M` 的各 `if` 分支**逐条对应**（条件未放宽）：
 * ```
 * $b / av → fEe.has(xl(e))      // AskUserQuestion / ask_question
 * dg / Eg → hEe.has(xl(e))      // generation_confirmation        → qet
 * iT / TE → xEe.has(xl(e))      // node_update_confirmation       → Btt
 * kD / pL → yEe.has(xl(e))      // 5 个 desktop_*_confirmation + batch_download_files_confirmation → $Qe
 * ib      → 自动模式预览卡（completed|failed）    // eet
 * aT      → show_widget                          // fre / mre
 * lT      → show_html                            // ure
 * jD      → UNe.has(xl(e)) = show_form           // HM / ase
 * ID      → get_connector_status                 // Loe
 * AD      → content.ui.resource_uri 非空          // nre（结构判据，不是工具名集合）
 * ```
 * 官方 `AEe = e => Eg(e) || TE(e) || pL(e)`（@449167）就是「三族确认卡」的并集。
 *
 * 官方原文（dump `D:\DEEPSEEK\live-assets-r100\`，`vendor-pkg-canvas-DuoOicPr.js`）：
 *   · 族集合 @447426：`fEe`/`hEe`/`gEe`/`xEe`/`yEe`（`yEe` 逐字 5 项，见下）
 *   · 族谓词 @449104–@449167：`av`/`Eg`/`UC`/`TE`/`pL`/`AEe`
 *   · `$M` 渲染器 @2458469 邻域：`if(UC(e))return null;`（`cost_limit_confirmation` **不渲染**）、
 *     `if(pL(e))return s.jsx(ret,{content:e.content,onAnswer:l});`
 *
 * ⚠️ **round 120 修正（用户 2026-10-15 裁决）**：原先第 2 行只走
 * `isConfirmationCardToolEvent`（= `generation_confirmation` + `node_update_confirmation`，官方 `Eg`/`TE`），
 * **漏了官方 `pL` 那一族**（`yEe` = `desktop_open_app_confirmation` / `desktop_capture_screen_confirmation` /
 * `desktop_fs_confirmation` / `desktop_shell_command_confirmation` / `batch_download_files_confirmation`）
 * ⇒ 这 5 类卡会落进 `tools` 段 → 被吸收进折叠摘要 (`absorbedRuns`) → `DesktopConfirmationCard`
 * **永远渲染不出来**（用户点不到「文件写入确认」）。现按官方补齐。
 * `cost_limit_confirmation`（官方 `gEe`/`UC`）官方是 `return null` ⇒ **明确不加**（不自行扩大）。
 */
export function isCardToolItem(item: ToolEventLike): boolean {
  const tool = String(item.content?.tool ?? '');
  if (isAskQuestionTool(tool)) return true;
  if (isConfirmationCardToolEvent(tool)) return true;
  /* 官方 `pL` / `yEe`：desktop / batch 确认卡（round 120 补）。 */
  if (isDesktopConfirmationTool(tool)) return true;
  if (isAutoPreviewCardEvent((item.content ?? {}) as Record<string, unknown>)) return true;
  const family = classifyToolEventFamily(item as unknown as AgentContentInput);
  if (family === 'show_widget' || family === 'show_html' || family === 'show_form') return true;
  if (isConnectorAuthCardEvent(item as unknown as Record<string, unknown>)) return true;
  if (isMcpAppEvent(item as unknown as Record<string, unknown>)) return true;
  return false;
}

/* ============================================================================
 * 内部有序条目 —— **唯一**排序规则作用于此
 * ============================================================================ */

type OrderedEntry =
  | { at: number; kind: 'text'; text: string }
  | { at: number; kind: 'thinking'; text: string }
  | { at: number; kind: 'compact'; phase: string }
  | { at: number; kind: 'agent_error'; text: string }
  | { at: number; kind: 'tool'; item: ToolEventItem }
  | { at: number; kind: 'subagent'; item: SubagentItem; children: readonly ToolEventLike[] };

/** 官方 item 的 `startedAt`（缺省 `0`）——与旧实现的取法逐字相同。 */
function itemAt(item: unknown): number {
  return Number((item as { startedAt?: unknown } | null | undefined)?.startedAt ?? 0) || 0;
}

/**
 * **唯一**排序规则：按 `at` 稳定排序（同刻保持插入序）。
 *
 * 官方 `contents` 是「事件到达即追加」⇒ item 的位置由**到达时刻**决定。MTV 的两种正文来源分别映射为：
 *   · `textItems`（流式落库）⇒ `at` = 该段正文**开始到达**的墙钟时间，与工具事件同轴 ⇒ 真·交错；
 *   · 单条 `content`（旧记录）⇒ 它是**最终**正文，由 `buildMessageContents` 以「不早于任何事件」的
 *     `at` 追加在列表末尾（见下），于是渲染顺序 = 官方最常见的形态「工具 → 折叠摘要 → 正文」。
 */
function orderEntries(entries: OrderedEntry[]): OrderedEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const byAt = left.entry.at - right.entry.at;
      return byAt !== 0 ? byAt : left.index - right.index;
    })
    .map(({ entry }) => entry);
}

/** 有序条目 → 官方 item 列表（`ChatMessage.contents` 的元素）。 */
function entriesToContents(entries: readonly OrderedEntry[]): AgentMessageContentItem[] {
  return entries.map((entry): AgentMessageContentItem => {
    if (entry.kind === 'text') return { type: 'text', content: entry.text, startedAt: entry.at };
    /* 官方 `thinking` item：`appendMessageThinkingChunk` 的落库形状是
       `{type:"thinking",content,startedAt}`（@42429）—— 这里**只**带 `startedAt`，
       不带 `endedAt`：MTV 没有「思考结束」的独立事件（官方也没有，`endedAt` 是聚合时补的）。 */
    if (entry.kind === 'thinking') return { type: 'thinking', content: entry.text, startedAt: entry.at };
    if (entry.kind === 'compact') return { type: 'compact', content: { phase: entry.phase } };
    /* 官方 `agent_error` item：`$M` @2466855 读的是 `typeof e.content === "string" ? e.content : ""`
       ⇒ 这里**只**带 `content`（官方写入口 `appendMessageContent` 的 payload 也没有 `startedAt`）。 */
    if (entry.kind === 'agent_error') return { type: 'agent_error', content: entry.text };
    /* `tool` 与 `subagent` 都已是官方 item 本体（`tool_event` / `subagent`）。 */
    return entry.item;
  });
}

/* ============================================================================
 * 中途正文 item 的落库（官方「到达即追加」的 text item）
 * ============================================================================ */

/**
 * 把一段流式正文 delta 追加成 / 并入一个 `text` item（官方写入口 `yxe` 的追加语义）：
 *   · `startNewItem === false` 且列表**最后一项**就是 `text`（这一段还没被工具事件打断）⇒ 续写它；
 *   · 否则（`startNewItem === true`：上一条正文之后发生过工具事件／确认／还没有任何项）⇒ **新开**一项。
 *
 * ⇒「工具事件之前的说明」与「工具之后的最终回答」自然成为两个 item，
 * 渲染层才能按官方 `absorbTextInRange` 把它们分别处理（中途说明收进折叠面板）。
 */
export function appendStreamingTextItem(
  items: readonly ChatMessageTextItem[] | undefined,
  delta: string,
  startedAt: number,
  startNewItem = false,
): ChatMessageTextItem[] {
  const list = [...(items ?? [])];
  const last = list[list.length - 1];
  if (!startNewItem && last) list[list.length - 1] = { ...last, content: last.content + delta };
  else list.push({ content: delta, startedAt });
  return list;
}

/**
 * ★★ 收尾对账：把流式 `textItems` 补齐到**权威全文**。
 *
 * 事故（用户 2026 真机）：
 * ```
 * content   = '已在画布上生成 3:4 竖幅小猫图片：@{node-gxx0zfmw2:%E5%AF%B9…}'
 * textItems = '已在画布上生成 3:4 竖幅小猫图片：@'      ← 尾部整段丢了
 * DOM       = 同上（`@` 后面既没有 chip 也没有字）
 * ```
 * 成因：`onComplete` 用权威 `fullText` 整体覆盖 `content`，而 `textItems` 里**只有已 flush 的前缀**
 * （`cancel()` 还会把缓冲区里没刷的尾部直接丢掉）；渲染层用的是 `textItems`
 * （`buildMessageContents`：给了 `textItems` 就不再产 `content` item）⇒ 界面被截断。
 *
 * 语义（纯函数，便于直测）：
 *   · 完全一致 ⇒ 原样返回（同一个引用，不制造无谓的重渲染）；
 *   · `fullText` 以 `joined` 开头 ⇒ 只把差额补到最后一项（保住工具事件切出来的 item 边界）；
 *   · 前缀都对不上（模型补写/回滚）⇒ 收敛成**一项**权威全文。
 */
export function reconcileStreamingTextItems(
  items: readonly ChatMessageTextItem[] | undefined,
  fullText: string,
): ChatMessageTextItem[] {
  const list = [...(items ?? [])];
  const joined = list.map((item) => item.content).join('');
  if (joined === fullText) return items ? [...items] : [];
  if (joined && fullText.startsWith(joined)) {
    const last = list[list.length - 1];
    list[list.length - 1] = { ...last, content: last.content + fullText.slice(joined.length) };
    return list;
  }
  return [{ content: fullText, startedAt: list[0]?.startedAt ?? Date.now() }];
}

/* ============================================================================
 * 官方消息级「步骤吸收」（`lae` 的 `O`）—— 决定折叠摘要 `FF`(`vS`) 包住什么
 * ============================================================================ */

/** 官方 `nG`：可被吸收的项 = `collapsible`（工具段）或 `text`/`thinking`。
 *  ⚠️ 第 75 轮补齐 `thinking`：官方 `lae` 的 `nG` 逐字含 `thinking`（见上方 `isVisibleText` 的引用）。 */
function isAbsorbableSegment(segment: MessageActivitySegment): boolean {
  return segment.kind === 'tools' || segment.kind === 'text' || segment.kind === 'thinking';
}

/** 官方 `xit`：非空正文 ⇒ 「后面还有可见内容」。
 *  ⚠️ `thinking` **不算**这里的「可见正文」（官方 `xit` 只认 `text`），
 *  但它在上面 `hasFollowing` 的 `Oe.kind==="normal"` 那一支里算「非 text 项」。 */
function isVisibleText(segment: MessageActivitySegment): boolean {
  return segment.kind === 'text' && !!segment.text.trim();
}

/**
 * 官方 `lae` 的 `O`（`vendor-pkg-canvas-ChpWx5JY.js` 逐字转写）：
 *
 * ```js
 * const ue = Ne => F.slice(Ne+1).some(Oe =>
 *   xit(Oe) || (Oe.kind==="normal" && Oe.item.type!=="thinking" && Oe.item.type!=="text"));
 * // 对每段连续可吸收项 [Ne, Oe)，取其中 collapsible 的首尾下标 xe/Pe
 * if (xe < 0 || !ue(Pe)) continue;
 * const at = Ne === 0 ? Ne : xe;                       // 段从 0 开始 ⇒ 连前面的正文一起吸收
 * const ct = F.slice(at, Pe + 1);
 * le.push({ absorbFrom: at, lastCollapsible: Pe,
 *           toolItems: ct.filter(collapsible).flatMap(items),
 *           stepCount, durationMs,
 *           absorbTextInRange: ct.some(kind === "normal") });
 * ```
 *
 * ⚠️ MTV 侧的分段比官方粗（连续的同类项已被 `entriesToSegments` 合成一段）⇒ 这里以**段**为单位
 * 转写同一套判据：可吸收段 = `tools` / `text`，可吸收段里必须有 `tools`，且其后存在
 * 「非空正文」或任何非正文段。
 */
export interface AbsorbedStepsRun {
  /** 被吸收段落的起止下标（含）——渲染时只在 `absorbFrom` 处渲染一次。 */
  absorbFrom: number;
  lastAbsorbable: number;
  /** 被吸收的工具段（官方 `toolItems`）。 */
  toolSegments: Extract<MessageActivitySegment, { kind: 'tools' }>[];
  /** 官方 `absorbTextInRange`：区间内含正文 ⇒ 展开后连正文一起显示。 */
  absorbTextInRange: boolean;
  /** 官方 `wV`/`RE`：区间内全部工具项的时长（任务时长缺失时的兜底）。 */
  durationMs: number | null;
}

export function absorbActivityRuns(
  segments: readonly MessageActivitySegment[],
  options: { isStreaming?: boolean } = {},
): AbsorbedStepsRun[] {
  /* 官方 `O` 的**第一句**（`vendor-pkg-canvas-ChpWx5JY.js` @2608540 邻域逐字）：
   * ```js
   * const O = a.useMemo(() => { if (n) return [];      // n = isStreaming
   *   const ue = Ne => F.slice(Ne+1).some(…); … }, [n, F])
   * ```
   * ⇒ **流式期间完全不吸收**：工具行/操作行直接平铺在消息里（那时官方显示的是
   * `正在进行 N 个操作` 的实时行），**收尾后**才把它们折进「处理了 Xs」摘要。
   * MTV 早前没有这条门（只要「后面还有可见内容」就折叠），会让「处理了 Xs」在跑的过程中
   * 就出现、并随正文增长反复开合。 */
  if (options.isStreaming) return [];
  const runs: AbsorbedStepsRun[] = [];
  let index = 0;
  while (index < segments.length) {
    while (index < segments.length && !isAbsorbableSegment(segments[index])) index += 1;
    const start = index;
    while (index < segments.length && isAbsorbableSegment(segments[index])) index += 1;
    const end = index; // 独占
    let first = -1;
    let last = -1;
    for (let cursor = start; cursor < end; cursor += 1) {
      if (segments[cursor].kind === 'tools') {
        if (first < 0) first = cursor;
        last = cursor;
      }
    }
    if (first < 0) continue;
    /* 官方 `ue(Pe)`：最后一段可吸收项**之后**还有可见内容（非空正文，或任何非正文段）。 */
    const hasFollowing = segments
      .slice(last + 1)
      .some((segment) => isVisibleText(segment) || (segment.kind !== 'text' && segment.kind !== 'compact'));
    if (!hasFollowing) continue;
    const absorbFrom = start === 0 ? start : first;
    const absorbed = segments.slice(absorbFrom, last + 1);
    const toolSegments = absorbed.filter(
      (segment): segment is Extract<MessageActivitySegment, { kind: 'tools' }> => segment.kind === 'tools',
    );
    runs.push({
      absorbFrom,
      lastAbsorbable: last,
      toolSegments,
      absorbTextInRange: absorbed.some((segment) => segment.kind === 'text'),
      durationMs: itemsDurationMs(toolSegments.flatMap((segment) => segment.blocks.flatMap((block) => (
        block.kind === 'items' ? [...(block.items ?? [])] : [block.agent, ...(block.children ?? [])]
      )).filter(Boolean) as ToolEventLike[])),
    });
  }
  return runs;
}

/* ============================================================================
 * 生产者：官方有序 `contents: Item[]`
 * ============================================================================ */

export interface BuildMessageContentsInput {
  /** 官方 `text` item 的正文（MTV 侧 = `ChatMessage.content`）。 */
  content?: string;
  /** 正文 item 的时间戳（官方按到达顺序追加；MTV 用消息时间戳，恒最早）。 */
  timestamp?: number;
  /**
   * **中途正文 item**（`ChatMessage.textItems`）。给了就不用 `content` 再产一个 text item
   * （流式路径下 `content` 就是这些 item 的拼接，会重复）。
   */
  textItems?: readonly ChatMessageTextItem[];
  /**
   * **思考 item**（`ChatMessage.thinkingItems`）。官方 `contents` 里 `thinking` 与 `text` **并列**，
   * 所以这里**不**与 `textItems` 互斥：两者各自产 item（见 `ChatMessage.thinkingItems` 注释）。
   */
  thinkingItems?: readonly ChatMessageThinkingItem[];
  /** 官方 `compact` item 的生产者（MTV = `ChatMessage.compactedAt`）。 */
  compactedAt?: number;
  /** `message.agentTaskId` 指向的主任务。 */
  agentTask?: AgentTask | null;
  /** 该任务的子任务（`parentTaskId === agentTask.id`）。 */
  childTasks?: readonly AgentTask[] | null;
  /**
   * **官方 `agent_error` item 的文案**（非空才产 item）。
   *
   * 官方生产者是 `appendMessageContent(id, {type:"agent_error", content: <string>}, sessionId)`
   * （`@41087` 逐字：`contents:[...(c.contents||[]), o]` ⇒ **追加在末尾**）以及若干
   * `updateMessage(id, {contents:[{type:"agent_error", content}]})`（整体替换）。
   * 文案来源见 `services/chat/agentErrorMessage.resolveAgentErrorMessage`（官方 `Jct` @2713029）。
   */
  errorMessage?: string;
}

/**
 * 把 MTV 的消息数据装配成**官方有序 item 列表**（`ChatMessage.contents` 的值）。
 *
 * 顺序 = 全部条目按 `at` 稳定排序（官方「事件到达即追加」的等价物）：
 * `text`（`message.timestamp`）→ `tool_event`/卡片（`step.toolCall.startedAt ?? step.createdAt`）
 * → `subagent`（`task.startedAt ?? task.createdAt`）→ `compact`（`message.compactedAt`）。
 * ⚠️ **唯一例外**：已批准的媒体生成那张 `generation_confirmation` 卡用**该次生成的收尾时刻**
 * （`agentMessageContents.itemAppendOrderAt`，官方成因见那里 §7c）—— 否则卡会排在它自己的子步骤
 * 之前，渲染成「卡 → 步骤组」，与官方「步骤组 → 卡 → 正文」相反。
 *
 * `compact` 用官方写入口 `yxe`（@32322）的形状 `{type:"compact", content:{phase}}`；MTV 只在
 * 压缩**成功后**打 `compactedAt` ⇒ 这里恒为 `finished`（`started` 那半由 `compactStartedProducer`
 * 那条会话级生产者负责，不属本函数）。
 */
/**
 * 官方 `appendMessageContent`（`@41087` 逐字）的**消息级**等价物：
 * ```js
 * appendMessageContent:(n,o,r)=>e(i=>bn(i,r,l=>({...l,
 *   messages:l.messages.map(c=>c.id!==n?c:{...c,contents:[...c.contents||[],o]})})))
 * ```
 * ⇒ 把 `{type:"agent_error", content}` **追加在 `contents` 末尾**。
 *
 * 为什么要有这个函数：`message.contents` 非空时是**完全接管**语义（`MessageBubble` 直通，
 * 不再调 `buildMessageContents`）⇒ 官方那条「追加」必须能在既有的 `contents` 上再叠一次，
 * 否则「历史导入 + 事后报错」的记录会丢横幅。
 *
 * 幂等：列表里已经有 `agent_error` 项时**不再追加**（官方 `appendMessageContent` 本身不判重，
 * 但官方那 10 个调用点各自互斥；MTV 的渲染层可能被多次求值 ⇒ 这里必须幂等，否则重复横幅）。
 */
export function ensureAgentErrorContent(
  contents: readonly AgentMessageContentItem[],
  errorMessage?: string,
): AgentMessageContentItem[] {
  const text = errorMessage?.trim();
  if (!text) return [...contents];
  if (contents.some((item) => item.type === 'agent_error')) return [...contents];
  return [...contents, { type: 'agent_error', content: text }];
}

export function buildMessageContents({
  content,
  timestamp,
  textItems,
  thinkingItems,
  compactedAt,
  agentTask,
  childTasks = [],
  errorMessage,
}: BuildMessageContentsInput): AgentMessageContentItem[] {
  const entries: OrderedEntry[] = [];

  /* ① 主任务的工具步骤 → 官方 `tool_event` item（卡片/普通工具的区分在分段时做，与官方一致：
        `$M` 才是分派点，`contents` 里它们都是 `tool_event`）。
        ⚠️ 用**复数**适配器：一次 MTV 媒体生成在为官方里是**两项**（确认卡 + 被执行的工具事件，
        见 `agentMessageContents.stepToOfficialToolEventItems` 的官方偏移）。只产确认卡时消息里
        一条普通工具事件都没有 ⇒ 官方 `lae` 的 `F` 分块（@2606530）没有 `kind:"collapsible"` 块
        ⇒ 「处理了 Xs」摘要行 `FF` 与操作行 `PE` 全都不渲染（用户实测的真机现象）。
        ⚠️ **排序键不是 `itemAt`**：生成确认卡必须排在**它自己那次生成的工具事件之后**，否则
        渲染成「卡 → 步骤组」，与官方「步骤组 → 卡 → 正文」相反。官方成因见
        `agentMessageContents` §7c（逐字）：卡片块 `JG === false` ⇒ 永不进折叠组；组只渲染在
        `absorbFrom`（第一个被吸收块）上 ⇒ 卡在组上还是组下**完全由它在 `contents` 里的下标决定**。 */
  for (const step of agentTask ? renderableToolSteps(agentTask) : []) {
    for (const item of stepToOfficialToolEventItems(step)) {
      entries.push({ at: itemAppendOrderAt(step, item), kind: 'tool', item });
    }
  }

  /* ② 子任务 → 官方 `subagent` item；子项取子任务自己的工具事件。 */
  for (const child of childTasks ?? []) {
    const item = childTaskToSubagentItem(child);
    entries.push({ at: itemAt(item), kind: 'subagent', item, children: taskStepsToToolEvents(child) });
  }

  /* ③ 官方 `compact` item。 */
  if (typeof compactedAt === 'number') entries.push({ at: compactedAt, kind: 'compact', phase: 'finished' });

  /* ④b 思考 item（官方 `thinking`）。与 `text` **并列**，不参与「有 textItems 就不产 content」的互斥。
        空思考不产 item（官方 `$M` 对空内容也是 `return null`）。 */
  for (const item of (thinkingItems ?? [])) {
    if (!item.content.trim()) continue;
    entries.push({ at: Number(item.startedAt) || 0, kind: 'thinking', text: item.content });
  }

  /* ⑤ 正文 item（官方 `text`）。空正文不产 item（官方 `$M` 对空 text 也是 `return null`）。
        · 有 `textItems`（流式落库）⇒ 逐段成为独立 item，位置 = 该段**开始到达**的时刻
          ⇒ 与上面的工具事件按时间**真交错**（官方「到达即追加」的等价物）；
        · 否则退回单条 `content`（旧记录）：它是**最终**正文，取「不早于任何已有事件」的时刻
          追加（同刻保持插入序 ⇒ 恒排最后），于是渲染顺序 = 官方最常见的形态
          「工具 → 折叠摘要 → 正文」。 */
  const recordedText = (textItems ?? []).filter((item) => !!item.content.trim());
  if (recordedText.length > 0) {
    for (const item of recordedText) {
      entries.push({ at: Number(item.startedAt) || 0, kind: 'text', text: item.content });
    }
  } else if (content) {
    const lastAt = entries.reduce((max, entry) => Math.max(max, entry.at), Number(timestamp ?? 0) || 0);
    entries.push({ at: lastAt, kind: 'text', text: content });
  }

  /* ⑥ 官方 `agent_error` item —— **追加在末尾**（官方 `appendMessageContent` 的追加语义；
        官方写入口 `updateMessage({contents:[{agent_error}]})` 那条是「整体替换」，MTV 侧等价于
        「正文/活动项都为空 ⇒ 列表里只剩它」，故两条官方语义在本函数下收敛成同一个位置）。 */
  return ensureAgentErrorContent(entriesToContents(orderEntries(entries)), errorMessage);
}

/* ============================================================================
 * 官方 `RE` / `wV`：折叠摘要的时长（从 **item 自己**算，不依赖 AgentTask）
 * ============================================================================ */

/**
 * 官方 `RE`（`vendor-pkg-canvas-ChpWx5JY.js` 逐字）：
 * ```js
 * RE = e => { let t, n; for (const o of e) {
 *   typeof o.startedAt === "number" && (t = t === undefined ? o.startedAt : Math.min(t, o.startedAt));
 *   typeof o.endedAt === "number" && (n = n === undefined ? o.endedAt : Math.max(n, o.endedAt)); }
 *   return t === undefined || n === undefined || n < t ? null : n - t; };
 * ```
 * ⇒ 折叠摘要「处理了 1m13s」的时长来自**这一段 item 的 `min(startedAt)..max(endedAt)`**，
 * 与 `message.agentTaskId` 指向的任务记录无关。MTV 早前只读 `AgentTask`（任务被裁剪/换会话后
 * 时长即 null），这里按官方改从 item 现算，并作为任务时长的兜底。
 */
export function itemsDurationMs(items: readonly ToolEventLike[]): number | null {
  let start: number | undefined;
  let end: number | undefined;
  for (const item of items) {
    const startedAt = (item as { startedAt?: unknown }).startedAt;
    const endedAt = (item as { endedAt?: unknown }).endedAt;
    if (typeof startedAt === 'number') start = start === undefined ? startedAt : Math.min(start, startedAt);
    if (typeof endedAt === 'number') end = end === undefined ? endedAt : Math.max(end, endedAt);
  }
  if (start === undefined || end === undefined || end < start) return null;
  return end - start;
}

/* ============================================================================
 * 分段器：有序条目 → 渲染段
 * ============================================================================ */

/**
 * 把有序条目切成**有序分段**：卡片打断工具段并自己成段（连续卡片合成一段）；`compact` 自成一
 * 段；连续的普通 item 累积成「工具段」，段内走官方 `PF` 连续分桶；子代理块按事件位置插进同段。
 */
function entriesToSegments(entries: readonly OrderedEntry[]): MessageActivitySegment[] {
  const segments: MessageActivitySegment[] = [];
  let blocks: MessageToolBlock[] = [];
  let pendingTools: ToolEventLike[] = [];
  let pendingCards: ToolEventLike[] = [];
  /** 官方 `PF`（@2394545 逐字）：连续 `plain` 段按 `jE`（`search`/`activity`）连续分桶。 */
  const bucketize = () => {
    for (const bucket of PF(pendingTools as unknown as Parameters<typeof PF>[0])) {
      blocks.push({ kind: 'items', items: bucket as unknown as readonly ToolEventLike[] });
    }
    pendingTools = [];
  };
  const flushTools = () => {
    bucketize();
    if (blocks.length) segments.push({ kind: 'tools', blocks });
    blocks = [];
  };
  const flushCards = () => {
    if (pendingCards.length) segments.push({ kind: 'cards', items: pendingCards });
    pendingCards = [];
  };
  const flushAll = () => {
    flushCards();
    flushTools();
  };

  for (const entry of entries) {
    /* 正文 item：**按顺序**成为一段（官方 `$M` 对 `text` 就是就地渲染 markdown）。
       早前这里 `continue` 丢掉正文 ⇒「折叠摘要行在正文之上」的官方版式无法成立（用户实测 图7/8）。 */
    if (entry.kind === 'text') {
      flushAll();
      segments.push({ kind: 'text', text: entry.text });
      continue;
    }
    if (entry.kind === 'thinking') {
      /* 官方 `$M` 的 `thinking` 分支：与 `text` 一样**就地**成为一段（独立 item，不并入正文）。
         它会打断工具段（`flushAll`），与官方「到达即追加、按序分派」一致。 */
      flushAll();
      segments.push({ kind: 'thinking', text: entry.text });
      continue;
    }
    if (entry.kind === 'compact') {
      flushAll();
      segments.push({ kind: 'compact', phase: entry.phase });
      continue;
    }
    if (entry.kind === 'agent_error') {
      /* 官方 `agent_error`：`$M` @2466855 就地 `return s.jsx(Qrt,…)`（**不**与相邻项合段）。
         `flushAll()` 保证它自成一段、且排在 contents 里它自己的位置上。
         注：`absorbActivityRuns` 的 `hasFollowing` 判据把「非 text/compact 段」算作「后面还有可见内容」
         （官方 `Oe.item.type!=="thinking" && Oe.item.type!=="text"`）⇒ 横幅落位与官方一致。 */
      flushAll();
      segments.push({ kind: 'agent_error', text: entry.text });
      continue;
    }
    if (entry.kind === 'subagent') {
      flushCards();
      bucketize();
      /* ⚠️ `SubAgentLine`（MTV 端口）的内容判据是 `type === "tool_event"`，而官方 `Lv`
         （@23777）是 `type === "subagent"`。这里在**渲染边界**转回 MTV 适配层形状，
         不动 `SubAgentLine`（越界）。 */
      blocks.push({
        kind: 'subagent',
        agent: { ...entry.item, type: 'tool_event' } as unknown as ToolEventLike,
        children: entry.children,
      });
      continue;
    }
    if (isCardToolItem(entry.item)) {
      flushTools();
      pendingCards.push(entry.item);
      continue;
    }
    flushCards();
    pendingTools.push(entry.item);
  }
  flushAll();
  return segments;
}

/**
 * **渲染层入口**：把已经有序的官方 `contents` 切成段。
 *
 * 这里**不排序** —— 顺序完全由传入的列表决定（`message.contents` 存在时就是它，
 * 否则是 `buildMessageContents` 的产物），所以全仓只有一处排序规则。
 */
export function buildActivitySegmentsFromContents(
  contents: readonly AgentMessageContentItem[],
  options: {
    childTasks?: readonly AgentTask[];
    childItemsOf?: (task: AgentTask) => readonly ToolEventLike[];
  } = {},
): MessageActivitySegment[] {
  const childTasks = options.childTasks ?? [];
  const childItemsOf = options.childItemsOf ?? (() => []);
  const entries: OrderedEntry[] = [];
  for (const item of contents) {
    if (item.type === 'text') {
      /* 官方 `$M` 的 `text` 分支：正文是**列表里的一个 item**，按它的位置渲染
         （空正文官方也 `return null`，故这里同样丢弃空白正文）。 */
      const text = typeof item.content === 'string' ? item.content : '';
      if (text.trim()) entries.push({ at: itemAt(item), kind: 'text', text });
      continue;
    }
    if (item.type === 'thinking') {
      /* 官方 `$M` 的 `thinking` 分支：`{type:"thinking",content,startedAt}` 也是**列表里的一个 item**，
         与 `text` 并列就地渲染（空内容官方 `return null`）。 */
      const text = typeof item.content === 'string' ? item.content : '';
      if (text.trim()) entries.push({ at: itemAt(item), kind: 'thinking', text });
      continue;
    }
    if (item.type === 'compact') {
      /* 官方 `$M`：`content?.phase ?? "started"`。 */
      entries.push({ at: 0, kind: 'compact', phase: String(item.content?.phase ?? 'started') });
      continue;
    }
    if (item.type === 'subagent') {
      const subagentId = String(item.content?.subagent_id ?? '');
      const child = childTasks.find((task) => task.id === subagentId);
      entries.push({ at: 0, kind: 'subagent', item, children: child ? childItemsOf(child) : [] });
      continue;
    }
    if (item.type === 'tool_event') {
      entries.push({ at: 0, kind: 'tool', item });
    }
    /* 官方 `agent_error` item：`$M` @2466855 的 `return s.jsx(Qrt,{message:content,…})` ——
       就地成一「段」并由 `MessageBubble` 渲染成 `AgentErrorBanner`（官方只有这一条渲染路径）。 */
    if (item.type === 'agent_error') {
      entries.push({ at: 0, kind: 'agent_error', text: typeof item.content === 'string' ? item.content : '' });
    }
    /* 其余官方 item（`task_snapshot` / `context_nodes` / `form_submission`）不是本模块的活动段 ——
       `MessageBubble` 各走自己的渲染位。 */
  }
  return entriesToSegments(entries);
}

/* ============================================================================
 * 旧 API（保留）
 * ============================================================================ */

export interface BuildActivitySegmentsInput {
  /** 本任务的 `steps → tool_event` 适配结果（`taskStepsToToolEvents`），**已按官方形状**。 */
  items: readonly ToolEventLike[];
  /** 子任务（`task.parentTaskId === parentTaskId` 的那些）。 */
  childTasks?: readonly AgentTask[];
  childEventOf: (task: AgentTask) => ToolEventLike;
  childItemsOf: (task: AgentTask) => readonly ToolEventLike[];
}

/**
 * 旧 API：`items` + `childTasks` → 有序分段。保留给既有调用方；内部与 `buildMessageContents`
 * 走**同一套** `orderEntries` 排序与**同一个** `entriesToSegments` 分桶，不再各写一份。
 */
export function buildActivitySegments({
  items,
  childTasks = [],
  childEventOf,
  childItemsOf,
}: BuildActivitySegmentsInput): MessageActivitySegment[] {
  const entries: OrderedEntry[] = [
    ...items.map((item): OrderedEntry => ({
      at: itemAt(item),
      kind: 'tool',
      item: item as unknown as ToolEventItem,
    })),
    ...childTasks.map((child): OrderedEntry => {
      const event = childEventOf(child);
      return {
        at: itemAt(event),
        kind: 'subagent',
        item: { ...event, type: 'subagent' } as unknown as SubagentItem,
        children: childItemsOf(child),
      };
    }),
  ];
  return entriesToSegments(orderEntries(entries));
}
