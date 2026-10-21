/**
 * AgentStepCard — Agent 单个步骤（P3-E1）。
 *
 * 展示工具调用的输入摘要、结果或错误、重试次数和耗时。
 * 状态用图标 + 文字表达，不只依赖颜色。不展示模型隐藏推理过程。
 *
 * 版式 = **官方 `TaskProgressRow`**（`official-chat.css` 的 `.c-step*`，出处
 * `page-DVqoHdTT.js` @840175 `Ble`，逐字）：
 *   · 行 `li flex gap-2` +（有说明时 `items-start`，否则 `items-center`）
 *     + `text-xs leading-4`
 *   · 图标槽 `flex shrink-0 items-center justify-center size-3.5`（有说明时 `mt-0.5`），
 *     图标 `size 13 stroke 1.5` —— **裸图标**，官方没有 MTV 那种「带底色的小圆片」
 *   · 正文 `min-w-0 flex-1`：标题 `block break-words text-xs leading-4 font-medium`
 *     （完成且展示细节时再 `text-chat-foreground`）；说明 `mt-1 text-xs leading-5
 *     text-secondary-muted-foreground`；进行中那句 `mt-1 text-chat-foreground`
 *   · 状态图标色：完成 `#7CD5A7` · 失败 `#A55050` · 进行中 `#90C4E5` · 待办/跳过 `white/40`
 *
 * ⚠️ 与改版前的差别：
 *   1. 原来是「20px 圆片 + 状态底色」（靛蓝 `indigo` 色族 500/10 底 / `bg-amber-500/10` /
 *      `bg-emerald-500/10` / `bg-red-500/10`）+ 行 hover 底色 + 12px 实心图标
 *      ⇒ 官方是**裸的 13px 线性图标**、行没有 hover 底
 *   2. 状态文字颜色（indigo/amber/emerald/red）⇒ 官方那四个状态色
 *   3. 图标全部换成 lucide（官方那套 1.5 描边）
 * 行为一字未改：状态图标 + 文字标签、重试次数、耗时、输入摘要、结果/错误、工具详情展开。
 */
import { Icon } from '@iconify/react';
import type { AgentStep, AgentStepStatus } from '../../types/agent';
import AgentToolDetails from './AgentToolDetails';
import { useT } from '../../i18n';

interface AgentStepCardProps {
  step: AgentStep;
}

/**
 * 状态 → 官方图标 + 官方状态色 class。
 * `tone` 对应 `.c-step__icon--ok/fail/running/idle`（官方 chat 状态色）。
 */
const STATUS_META: Record<AgentStepStatus, { icon: string; label: string; tone: string; spin?: boolean; done?: boolean }> = {
  pending: { icon: 'lucide:circle', label: '等待', tone: 'c-step__icon--idle' },
  running: { icon: 'lucide:loader-2', label: '执行中', tone: 'c-step__icon--running', spin: true },
  waiting_approval: { icon: 'lucide:shield-alert', label: '待确认', tone: 'c-step__icon--running' },
  succeeded: { icon: 'lucide:check', label: '完成', tone: 'c-step__icon--ok', done: true },
  failed: { icon: 'lucide:triangle-alert', label: '失败', tone: 'c-step__icon--fail' },
  skipped: { icon: 'lucide:chevron-right', label: '跳过', tone: 'c-step__icon--idle' },
  stopped: { icon: 'lucide:square', label: '停止', tone: 'c-step__icon--idle' },
};

/** 官方「工具调用进行中」的状态集合：这些状态下图标挂 `tool-call-status-icon-active`（shimmer 动画）。 */
const ACTIVE_STATUSES = new Set<AgentStepStatus>(['pending', 'running', 'waiting_approval']);

function formatDuration(step: AgentStep): string | null {
  const start = step.toolCall?.startedAt ?? step.createdAt;
  const end = step.toolCall?.finishedAt;
  if (!end || end < start) return null;
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AgentStepCard({ step }: AgentStepCardProps) {
  const t = useT();
  const meta = STATUS_META[step.status];
  const duration = formatDuration(step);
  const retryCount = step.toolCall?.retryCount ?? 0;
  const detail = step.errorMessage || step.outputSummary || step.toolCall?.resultSummary;
  const hasExtra = Boolean(step.toolCall?.inputSummary
    || (detail && detail !== step.toolCall?.inputSummary)
    || step.toolCall?.inputDisplay
    || step.toolCall?.resultDisplay);

  return (
    <div className={`agent-step-card c-step ${hasExtra ? 'c-step--stack' : ''}`}>
      <span
        className={`c-step__icon ${meta.tone} ${ACTIVE_STATUSES.has(step.status) ? 'tool-call-status-icon-active' : ''}`}
        aria-hidden="true"
      >
        <Icon
          icon={meta.icon}
          width={13}
          className={meta.spin ? 'animate-spin motion-reduce:animate-none' : undefined}
        />
      </span>
      <div className="c-step__body">
        <span className="c-step__title" data-done={meta.done && hasExtra ? '' : undefined}>
          <span className="c-step__name">{step.title}</span>
          <span className={`c-step__tag ${meta.tone}`}>
            {t(meta.label)}
            {retryCount > 0 ? ` · ${t('重试 {count}', { count: retryCount })}` : ''}
          </span>
          {duration && <span className="c-step__timing">{duration}</span>}
        </span>
        {step.toolCall?.inputSummary && (
          <span className="c-step__detail">{step.toolCall.inputSummary}</span>
        )}
        {detail && detail !== step.toolCall?.inputSummary && (
          <span className={`c-step__detail${step.status === 'failed' ? ' c-step__detail--fail' : ''}`}>
            {detail}
          </span>
        )}
        <AgentToolDetails
          input={step.toolCall?.inputDisplay}
          result={step.toolCall?.resultDisplay}
        />
      </div>
    </div>
  );
}
