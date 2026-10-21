/**
 * AgentStepsSection —— 官方 `vS`（`page-BeI7xydN.js`@684247，`data-testid="agent-steps-summary"`）逐字复刻。
 *
 * 官方结构：
 *   <div data-testid="agent-steps-summary">
 *     <Collapsible className="group/agent-steps-details" open onOpenChange>
 *       <Trigger aria-controls={id}
 *         className={"group/agent-steps my-1 inline-flex max-w-full cursor-pointer items-center gap-1.5 py-0.5
 *                     text-[13px] font-normal leading-[1.65]
 *                     transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
 *                    + (open ? " opacity-80" : " opacity-100")}>
 *         <span className="min-w-0 truncate text-[13px] font-normal leading-[1.65] text-muted-foreground/80
 *                            transition-colors duration-200 group-hover/agent-steps:text-foreground/80">{summary}</span>
 *         <ChevronRight className="size-4 shrink-0 text-muted-foreground/70
 *                            transition-[transform,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]
 *                            group-hover/agent-steps:text-foreground/80
 *                            group-data-[state=open]/agent-steps-details:rotate-90" strokeWidth={1.8} />
 *       </Trigger>
 *       <Content className="grid overflow-hidden outline-none
 *                            transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
 *                            motion-reduce:transition-none data-[state=closed]:pointer-events-none
 *                            data-[state=closed]:grid-rows-[0fr] data-[state=closed]:opacity-0
 *                            data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100"
 *                data-agent-steps-content data-state>
 *         <div className="min-h-0 overflow-hidden">
 *           <div className="mt-1.5 mb-2 flex flex-col gap-2.5 border-l border-foreground/10 py-1.5 pl-3.5">…</div>
 *         </div>
 *       </Content>
 *     </Collapsible>
 *   </div>
 *
 * ⚠️ 本地化差异：
 *   1. 官方用 Radix/Collapsible 原语（`hf`=`Collapsible.Root`、`gf`=`Collapsible.Trigger`，
 *      同文件其它组件也已改用同一套原语：`AgentToolLine` / `SubAgentLine` / `AgentTaskHistoryCard`）。
 *      内容区官方**不是** `Collapsible.Content`，而是**普通 div**（手动 `data-agent-steps-content` +
 *      `data-state` + `grid-rows-[0fr/1fr]` 过渡），因为它要自己做网格展开动画；
 *      这里照官方：`Root` + `Trigger` 用 Radix，内容区保持裸 div。
 *   2. 官方在收起时给内容加 `inert`（`toggleAttribute('inert', !open)`）。
 *   3. `autoCollapse` 的首个自动收起延时 = 官方 `Oot = 380`（ms，live bundle 已挖到）。
 *   4. 官方只把每个 child 包一层 `div.w-full.min-w-0`，且**首次展开后**才挂载（`everOpened`）。
 */
/**
 * ⚠️ **第 65 轮：class 从「旧快照」更新到「当前产物」**（官方 build 又前移了）。
 *
 * 旧来源（文件头原先记的）：`page-BeI7xydN.js`@684247 —— 那版的 trigger 是
 *   `group/agent-steps my-1 inline-flex max-w-full cursor-pointer items-center gap-1.5 py-0.5`。
 * **当前**产物 `vendor-pkg-canvas-CvbAwZyy.js` 的 `EO = memo(({durationMs,tokens,tapies,costUsd,autoCollapse,…}))`
 * @**2470371**（`summary` 的 class 在 @**2470703**）逐字改成：
 * ```js
 * className: z(
 *   "group/agent-steps my-2 inline-flex min-h-9 max-w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 text-[13px] font-normal leading-[1.65]",
 *   "transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
 *   c ? "opacity-80" : "opacity-100")
 * ```
 * 官方真机实测（9222 当前画布 7 个 `summary.group/agent-steps`）读数 = **79×36**，
 * class 与上面逐字一致（`my-2 min-h-9 gap-2 rounded-lg px-2 py-1`）。
 * 内层文案 span 也变了：当前的逐字是
 * `min-w-0 text-left text-[13px] font-normal leading-[1.65] text-muted-foreground transition-colors duration-200 group-hover/agent-steps:text-foreground/80`
 * （旧版是 `min-w-0 truncate … text-muted-foreground/80`）⇒ 这里同步改掉。
 * 摘要文案的取法**没变**（`durationMs` 有值 ⇒「处理了 {{duration}}」，否则「已处理」），
 * 与当前 `EO` 里的 `v = _ ? workSummaryWithDuration : workSummary` 一致。
 *
 * 🚨 官方当前那支还有**运行指标**（`tokens` / `tapies` / `costUsd` 三个 prop，
 *    渲染成 `ml-2 tabular-nums` 的 `· {{count}}`）：MTV 的 `AgentStepsSection`
 *    **没有这三份数据源** ⇒ 不传、不渲染（不做等价替代）。
 */
import { Children, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { getLocale, useT } from '../../i18n';
import { agentEventString } from '../../services/chat/agentEventStrings';
import formatWorkDuration from './workDuration';

/** 官方 `Oot = 380`（`autoCollapse` 首次自动收起的延时，ms）。 */
const AUTO_COLLAPSE_DELAY_MS = 380;

/** 官方当前 `EO` 的 `summary` class（@2470703 逐字，两段 `z()` 拼接）。 */
const TRIGGER_BASE = [
  'group/agent-steps my-2 inline-flex min-h-9 max-w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 text-[13px] font-normal leading-[1.65]',
  'transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
].join(' ');

const CONTENT_CLASS = [
  'grid overflow-hidden outline-none',
  'transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
  'motion-reduce:transition-none',
  'data-[state=closed]:pointer-events-none data-[state=closed]:grid-rows-[0fr] data-[state=closed]:opacity-0',
  'data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100',
].join(' ');

export interface AgentStepsSectionProps {
  children: ReactNode;
  /** 官方 `durationMs`：有值时摘要为「Worked for {duration}」，否则「Worked」。 */
  durationMs?: number | null;
  /** 官方 `autoCollapse`：挂载后延时自动收起一次。 */
  autoCollapse?: boolean;
  /**
   * **MTV 自有增强 —— 官方 `vS`(`EO`) 没有这个 prop**（官方没有「把待决确认卡顶到可见」的行为）。
   *
   * 值 = 这一节里**待决**的生成确认卡的 `confirmationId`（由
   * `confirmationEventDispatch.pendingGenerationConfirmationKey` 从同批 `tool_event` 算出；
   * 那一批 event 只可能来自 `approvalRendersGenerationCard(step)` 为真的媒体生成审批）。
   * 非空 ⇒ 本节要「把官方确认卡顶到可见」。
   *
   * **用户 2026-10-15 裁决（追加）**：round 117 把媒体生成审批从 MTV 时间线卡收口给了官方确认卡，
   * 但官方卡落在聊天消息流的「工具步骤」折叠节里（`agent-steps-summary`）⇒ 用户看不见、
   * 找不到确认入口。用户明确要求**待决时自动展开**。
   * ⚠️ **这是 MTV 自有的可用性增强，官方没有对应行为** ——
   * 下一轮**不许**按「官方没有」把它删掉；要删必须先拿到用户的新裁决。
   *
   * 规则（三条，避免和用户交互打架）：
   *   1. **新出现**一个待决审批（键变化）⇒ 自动展开**一次**；
   *   2. **同一个**待决审批**不重复展开**（`autoExpandedKeyRef`）；
   *   3. 用户在这个待决审批上**手动折叠过** ⇒ **不再顶开**（`userCollapsedKeyRef`）；
   *      待决消失（已决议 / 换代）⇒ 两条记忆一起清空，下一次新待决重新可以展开一次。
   * 另外：**有待决确认时不跑官方的 380ms 自动收起**（否则刚顶开就被收起，等于没做）。
   *
   * ⚠️ **round 118 实测更正（重要，别被上面的动机误导）**：本增强在当前渲染器下**并不会**改变
   * 生成确认卡的可见性 —— 确认卡在 MTV 是**独立 `cards` 段**，永远不落进本折叠节：
   *   · `ConfirmationEventCard` 全仓**只有一个渲染点** = `MessageBubble.renderCardToolItem`
   *     （`MessageBubble.tsx:393`），它只被 `segment.kind === 'cards'` 调到（同文件 :734）；
   *   · `messageContents.isCardToolItem` 把**任何** `generation_confirmation`（不论待决/已决议）
   *     都归成 `cards` 段，而 `isAbsorbableSegment` 只认 `tools`/`text`/`thinking`
   *     ⇒ `absorbActivityRuns` 的 `[absorbFrom, lastAbsorbable]` 里**不可能**含 `cards`
   *     （真机读数：4 种排布下 `cardInsideAbsorbedRun` 全为 `false`）；
   *   · 用户真实聊天视图读数：两张卡的 `inSummary` 均为 `false`、`agent-steps-summary` 数量为 0。
   * ⇒ 本 prop 现在的实际作用是一条**不变量守卫**：「**待决确认卡绝不能被折叠的步骤摘要藏住**」——
   *   今天它恒被满足（所以是 no-op），但一旦将来 `isCardToolItem` 漏掉某个确认族、或卡片改走工具段，
   *   这条守卫就会生效。**已有 10 条回归测试钉住这套规则**。
   *   真正的「可发现性」问题（若用户仍觉得找不到确认入口）在本文件之外，见 §118 的「需要裁决」。
   */
  pendingConfirmationKey?: string | null;
}

/** 官方 `$$(durationMs)`：把毫秒格式化成人类可读时长（见 `workDuration.ts`）。 */

export default function AgentStepsSection({
  children,
  durationMs = null,
  autoCollapse = false,
  pendingConfirmationKey = null,
}: AgentStepsSectionProps) {
  useT(); // 仅用于订阅语言切换（getLocale() 本身不是响应式的）
  const [open, setOpen] = useState(autoCollapse);
  const [everOpened, setEverOpened] = useState(autoCollapse);
  const collapseOnceRef = useRef(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const contentId = useId();

  /* ── round 118：待决生成确认卡 ⇒ 自动展开（MTV 自有增强，见 prop 注释） ── */
  /** 已经为哪个待决审批自动展开过（规则 2：同一步骤不重复展开）。 */
  const autoExpandedKeyRef = useRef<string | null>(null);
  /** 用户在哪一个待决审批上手动折叠过（规则 3：不再顶开）。 */
  const userCollapsedKeyRef = useRef<string | null>(null);

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) setEverOpened(true);
    /* 规则 3：用户**手动**折叠时记下「是在哪个待决审批上折叠的」。
       ⚠️ Radix 的 `onOpenChange(false)` 也会被我们自己的自动收起触发 —— 那种情况
       `pendingConfirmationKey` 为空（有待决时压根不跑自动收起），不会误记为「用户折叠」。 */
    else if (pendingConfirmationKey) userCollapsedKeyRef.current = pendingConfirmationKey;
    setOpen(next);
  }, [pendingConfirmationKey]);

  /* 官方 `toggleAttribute('inert', !open)`：收起时内容不可交互/不可聚焦。 */
  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    if (open) node.removeAttribute('inert');
    else node.setAttribute('inert', '');
  }, [open]);

  /* 规则 1/2/3 的落点。 */
  useEffect(() => {
    const key = pendingConfirmationKey ?? null;
    if (!key) {
      /* 待决消失 ⇒ 清空两条记忆，下一次新待决可以再自动展开一次。 */
      autoExpandedKeyRef.current = null;
      userCollapsedKeyRef.current = null;
      return;
    }
    if (userCollapsedKeyRef.current === key) return;   // 规则 3
    if (autoExpandedKeyRef.current === key) return;    // 规则 2
    autoExpandedKeyRef.current = key;
    setEverOpened(true);
    setOpen(true);
  }, [pendingConfirmationKey]);

  useEffect(() => {
    if (!autoCollapse || collapseOnceRef.current) return undefined;
    /* round 118：**有待决确认时不自动收起** —— 否则刚被顶开就在 380ms 后被收起。
       待决消失后本 effect 会重跑，再按官方口径收起一次。 */
    if (pendingConfirmationKey) return undefined;
    collapseOnceRef.current = true;
    const timer = window.setTimeout(() => setOpen(false), AUTO_COLLAPSE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoCollapse, pendingConfirmationKey]);

  const locale = getLocale();
  const durationText = formatWorkDuration(durationMs);
  const summary = durationText
    ? agentEventString('workSummaryWithDuration', locale).replace(/\{\{duration\}\}/g, durationText)
    : agentEventString('workSummary', locale);

  return (
    <div data-testid="agent-steps-summary">
      <Collapsible.Root
        className="group/agent-steps-details"
        data-no-quote
        open={open}
        onOpenChange={handleOpenChange}
      >
        <Collapsible.Trigger
          aria-controls={contentId}
          data-no-quote
          className={`${TRIGGER_BASE} ${open ? 'opacity-80' : 'opacity-100'}`}
        >
          <span className="min-w-0 text-left text-[13px] font-normal leading-[1.65] text-muted-foreground transition-colors duration-200 group-hover/agent-steps:text-foreground/80">
            {summary}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width={16}
            height={16}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 shrink-0 text-muted-foreground/70 transition-[transform,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/agent-steps:text-foreground/80 group-data-[state=open]/agent-steps-details:rotate-90"
          >
            <path d="M9 6l6 6l-6 6" />
          </svg>
        </Collapsible.Trigger>
        <div
          ref={contentRef}
          id={contentId}
          aria-hidden={!open}
          data-agent-steps-content=""
          data-state={open ? 'open' : 'closed'}
          className={CONTENT_CLASS}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-1.5 mb-2 flex flex-col gap-2.5 border-l border-foreground/10 py-1.5 pl-3.5">
              {/* 官方 `FF` 会把**每个 child** 再包一层 `div.w-full.min-w-0`
                  （live DOM 实测：`div.mt-1.5.mb-2…` > `div.w-full.min-w-0` > `div.flex w-full min-w-0 flex-col gap-1.5`）。
                  ⚠️ 必须在 `everOpened` 为真时渲染 —— 与官方「首次展开后才挂载内容」一致。 */}
              {everOpened
                ? Children.map(children, (child, index) => (
                  <div className="w-full min-w-0" key={index}>{child}</div>
                ))
                : null}
            </div>
          </div>
        </div>
      </Collapsible.Root>
    </div>
  );
}
