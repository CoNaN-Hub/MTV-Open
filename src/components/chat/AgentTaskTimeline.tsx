/**
 * AgentTaskTimeline — Agent 任务时间线与后台控制（P3-E1）。
 *
 * 展示任务目标、状态、进度、可折叠步骤列表、待确认审批和控制操作
 * （暂停 / 继续 / 跳过 / 重新规划 / 停止）。
 * 只展示计划、工具调用、结果和错误摘要，不展示模型隐藏推理过程。
 * 控制均为可键盘操作的按钮，状态用图标 + 文字表达。
 */
import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  AGENT_TERMINAL_STATUSES,
  type AgentApprovalResolution,
  type AgentStep,
  type AgentTask,
  type AgentTaskStatus,
} from '../../types/agent';
import { getAgentRecoveryHint } from '../../services/chat/agentErrorCodes';
import { approvalRendersGenerationCard } from '../../services/chat/agentActivityItems';
import { getToolLabel } from '../../services/chat/toolLabels';
import { getLocale, useT } from '../../i18n';
import AgentStepCard from './AgentStepCard';
import AgentApprovalCard from './AgentApprovalCard';
import AgentExecutionRationale from './AgentExecutionRationale';
import type { MediaModelOption } from '../nodes/shared/defaultModels';

export interface AgentTaskControls {
  onResolveApproval: (approvalId: string, resolution: AgentApprovalResolution) => void;
  mediaModelOptions: MediaModelOption[];
  mediaModelAvailability: Record<string, boolean>;
  /* 官方只有「停止生成」这一项任务控制；暂停/继续/跳过/重新规划/回退画布修改官方都没有 ⇒ 已移除。 */
  onStop: (taskId: string) => void;
}

interface AgentTaskTimelineProps extends AgentTaskControls {
  task: AgentTask;
}

const STATUS_META: Record<AgentTaskStatus, { label: string; icon: string; className: string; spin?: boolean }> = {
  queued: { label: '排队中', icon: 'mdi:clock-outline', className: 'text-slate-400' },
  planning: { label: '规划中', icon: 'mdi:loading', className: 'text-violet-400', spin: true },
  running: { label: '执行中', icon: 'mdi:loading', className: 'text-emerald-400', spin: true },
  waiting_tool: { label: '调用工具', icon: 'mdi:loading', className: 'text-sky-400', spin: true },
  waiting_approval: { label: '等待确认', icon: 'mdi:shield-alert-outline', className: 'text-amber-400' },
  completed: { label: '已完成', icon: 'mdi:check-circle-outline', className: 'text-emerald-400' },
  failed: { label: '失败', icon: 'mdi:alert-circle-outline', className: 'text-red-400' },
  stopped: { label: '已停止', icon: 'mdi:stop-circle-outline', className: 'text-slate-400' },
};

const ACTIVE_STATUSES: AgentTaskStatus[] = ['queued', 'planning', 'running', 'waiting_tool', 'waiting_approval'];

/* ⚠️ 原来这里有一张 MTV 自造的 5 条 `TOOL_ACTIVITY_LABELS`（「正在搜索网页」等）——
   官方**没有**这张表：官方 agentEvent 的工具文案统一走
   `chatAdapter.agentEvent.toolLabels.<tool>_<started|completed|failed>`（106 条，见
   `services/chat/toolLabels.ts`，从官方产物逐字生成）。这里改成按工具名 + 状态查官方表。 */

/** MTV 的步骤状态 → 官方后缀（`_started` / `_completed` / `_failed`）。 */
function officialToolStatusSuffix(status: AgentStep['status']): 'started' | 'completed' | 'failed' {
  if (status === 'succeeded') return 'completed';
  if (status === 'failed') return 'failed';
  return 'started';
}

function findActiveStep(task: AgentTask): AgentStep | undefined {
  const selected = task.currentStepId
    ? task.steps.find((step) => step.id === task.currentStepId)
    : undefined;
  if (selected && ['pending', 'running', 'waiting_approval'].includes(selected.status)) {
    return selected;
  }
  for (let index = task.steps.length - 1; index >= 0; index -= 1) {
    const step = task.steps[index];
    if (['pending', 'running', 'waiting_approval'].includes(step.status)) return step;
  }
  return undefined;
}

function getActivityLabel(task: AgentTask, step: AgentStep | undefined, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (task.status === 'waiting_approval' || step?.status === 'waiting_approval') {
    return step ? t('等待确认：{title}', { title: step.title }) : t('等待用户确认');
  }
  if (step?.status === 'pending') return t('准备{title}', { title: step.title });
  if (step?.status === 'running') {
    const toolId = step.toolCall?.toolId ?? '';
    const official = toolId
      ? getToolLabel(`${toolId}_${officialToolStatusSuffix(step.status)}`, getLocale())
      : '';
    /* 官方表里没这条工具时 `getToolLabel` 回退成 tool 名本身 ⇒ 那样太难看，退回 MTV 的「正在{title}」。 */
    return official && official !== `${toolId}_${officialToolStatusSuffix(step.status)}`
      ? official
      : t('正在{title}', { title: step.title });
  }
  if (task.status === 'queued') return t('正在等待执行');
  if (task.status === 'planning') {
    return task.steps.some((item) => item.status === 'succeeded')
      ? t('正在分析工具结果')
      : t('正在分析请求');
  }
  if (task.status === 'waiting_tool') return t('正在调用工具');
  if (task.status === 'running') return t('正在整理结果');
  return t(STATUS_META[task.status].label);
}

function getActivityStartedAt(task: AgentTask, step?: AgentStep): number {
  if (step?.toolCall?.startedAt) return step.toolCall.startedAt;
  const eventType = task.status === 'planning' ? 'model_round_start' : 'tool_start';
  for (let index = (task.events?.length ?? 0) - 1; index >= 0; index -= 1) {
    const event = task.events?.[index];
    if (event?.type === eventType) return event.timestamp;
  }
  return task.startedAt ?? task.createdAt;
}

function formatElapsed(startedAt: number, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}m ${totalSeconds % 60}s`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${Math.max(0, Math.round(durationMs))}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

interface ControlButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'primary' | 'danger';
}

function ControlButton({ icon, label, onClick, tone = 'default' }: ControlButtonProps) {
  const toneClass = tone === 'primary'
    ? 'text-accent-primary hover:bg-primary/15'
    : tone === 'danger'
      ? 'text-red-400 hover:bg-red-500/10'
      : 'text-text-text-secondary hover:bg-foreground/5 hover:text-chat-foreground';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${toneClass}`}
    >
      <Icon icon={icon} width="14" />
      {label}
    </button>
  );
}

export default function AgentTaskTimeline({
  task,
  onResolveApproval,
  mediaModelOptions,
  mediaModelAvailability,
  onStop,
}: AgentTaskTimelineProps) {
  const t = useT();
  const isTerminal = AGENT_TERMINAL_STATUSES.has(task.status);
  const isExpertTask = !!task.parentTaskId;
  const [expanded, setExpanded] = useState(!isTerminal);

  const meta = STATUS_META[task.status];
  const isActive = ACTIVE_STATUSES.includes(task.status);
  const activeStep = findActiveStep(task);
  const activityLabel = getActivityLabel(task, activeStep, t);
  const activityDetail = activeStep?.toolCall?.inputSummary ?? activeStep?.approval?.summary;
  const activityStartedAt = getActivityStartedAt(task, activeStep);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isActive || task.status === 'waiting_approval') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeStep?.id, activeStep?.status, isActive, task.status]);
  const doneSteps = task.steps.filter((step) =>
    ['succeeded', 'failed', 'skipped', 'stopped'].includes(step.status),
  ).length;
  /**
   * **用户 2026-10-15 裁决：媒体生成类改由官方确认卡承担。**
   *
   * 官方**只有一张**确认卡（聊天流里的 `generation_confirmation`，round 111/116 已修到可交互）；
   * MTV 这边时间线里的 `AgentApprovalCard` 是 MTV 自有物 ⇒ 「要不要生成这张图」被问了**两遍**
   * （官方卡带模型 chip / 这张带媒体模型选择器）。⇒ 这里把**官方卡真的会渲染**的那一类从
   * 时间线收掉（`approvalRendersGenerationCard`，判别口径与依据见该函数注释：
   * 唯一的 `AgentApprovalKind` 取值是 `'media_generation'`，图片/视频/音频靠 `mediaKind` 区分）。
   *
   * ⚠️ **只收这一类**：
   *   · `effect:'media_generation'` 但**不是** `media_generate` 的 6 类工具
   *     （`shotlist_generate_frames` / 快捷指令 `runStep` / `director_render_frame` /
   *      `director_render_video` / ComfyUI 工作流 / `canvas_run`）产不出官方 content
   *     ⇒ `approvalRendersGenerationCard` 为假 ⇒ **它们的 MTV 审批卡保留**（否则审批会从界面消失）；
   *   · 画布写入 / 文件写入 / 永久删除 / 资产写入 / 项目记忆 / API 配置 / 用户选择 —— 官方没有这些卡
   *     ⇒ **一律保留**（那是 MTV 自己的审批机制，删了就没法审批）。
   */
  const pendingApprovalStep = task.steps.find((step) =>
    step.approval?.status === 'pending' && !approvalRendersGenerationCard(step));

  const recoveryHint = task.status === 'failed'
    ? getAgentRecoveryHint(task.errorCode)
    : undefined;
  const metrics = task.metrics;
  const totalTokens = metrics ? metrics.inputTokens + metrics.outputTokens : 0;
  const taskDuration = task.startedAt
    ? Math.max(0, (task.completedAt ?? task.updatedAt) - task.startedAt)
    : 0;
  const terminalLabel = task.status === 'completed' ? t('运行记录') : t(meta.label);

  return (
    <div className="agent-task-timeline c-taskcard max-w-full">
      {/* 折叠头 = 官方 `TaskHistoryCard` 的 trigger（`px-3.5 py-2.5 text-[13px] font-medium`） */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="c-taskcard__trigger"
      >
        <span className="c-taskcard__title">
          {isActive ? activityLabel : terminalLabel}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[12px] tabular-nums" style={{ color: 'var(--c-muted)' }}>
          {task.steps.length > 0 && (
            <span>{t('{count} 步', { count: isTerminal ? task.steps.length : `${doneSteps}/${task.steps.length}` })}</span>
          )}
          {!isActive && taskDuration > 0 && <span>· {formatDuration(taskDuration)}</span>}
          <Icon
            icon="lucide:chevron-down"
            width={14}
            className="c-taskcard__chevron"
            style={{ width: 14, height: 14 }}
          />
        </span>
      </button>

      {/* 运行态摘要（官方没有这一段；用官方 muted 词汇排在折叠头下方） */}
      {(isActive && activityDetail) || (isActive && task.status !== 'waiting_approval') ? (
        <div className="c-taskcard__meta">
          {isActive && <Icon icon="lucide:loader-2" width={12} className="shrink-0 animate-spin motion-reduce:animate-none" style={{ color: '#90c4e5' }} />}
          {isActive && activityDetail && <span className="min-w-0 break-words">{activityDetail}</span>}
          {isActive && task.status !== 'waiting_approval' && (
            <span className="shrink-0 tabular-nums">{formatElapsed(activityStartedAt, now)}</span>
          )}
        </div>
      ) : null}

      {!!task.skillBindings?.length && (
        <div className="c-taskcard__meta">
          <Icon icon="lucide:book-check" width={12} className="shrink-0" />
          <span className="shrink-0">{t('已注入 Skill')}</span>
          <span className="min-w-0 truncate" style={{ color: 'var(--c-text-2)' }}>
            {task.skillBindings.map((binding) => binding.name).join('、')}
          </span>
        </div>
      )}

      {expanded && metrics && (metrics.inputTokens > 0 || metrics.outputTokens > 0 || metrics.policyDenied > 0 || metrics.retryCount > 0) && (
        <div className="c-taskcard__meta">
          {totalTokens > 0 && <span>{totalTokens.toLocaleString()} token</span>}
          {metrics.policyDenied > 0 && <span>{t('{count} 次拒绝', { count: metrics.policyDenied })}</span>}
          {metrics.retryCount > 0 && <span>{t('{count} 次重试', { count: metrics.retryCount })}</span>}
        </div>
      )}

      <div className="c-taskcard__body">
        <AgentExecutionRationale task={task} />

        {task.status === 'failed' && task.errorMessage && (
          <p className="c-msg__state c-msg__state--error" style={{ padding: '0 14px' }}>{task.errorMessage}</p>
        )}
        {recoveryHint && (
          <p className="c-msg__state c-msg__state--info" style={{ padding: '0 14px' }}>
            <Icon icon="lucide:lightbulb" width={13} className="mt-0.5 shrink-0" />
            <span className="break-words">{recoveryHint.hint}</span>
          </p>
        )}

        {expanded && (
          <>
            {task.steps.length > 0 && (
              <div className="c-taskcard__list c-steplist">
                {task.steps.map((step) => (
                  <AgentStepCard key={step.id} step={step} />
                ))}
              </div>
            )}

            {/* 规划 / 整理阶段没有进行中的步骤卡片，这里补一行在下方明确显示助手当前在做什么 */}
            {isActive && !activeStep && task.status !== 'waiting_approval' && (
              <div className="c-taskcard__list c-step">
                <span className="c-step__icon c-step__icon--running" aria-hidden="true">
                  <Icon icon="lucide:loader-2" width={13} className="animate-spin motion-reduce:animate-none" />
                </span>
                <span className="c-step__body">
                  <span className="c-step__title">
                    <span className="c-step__name">{activityLabel}</span>
                    <span className="c-step__timing">{formatElapsed(activityStartedAt, now)}</span>
                  </span>
                </span>
              </div>
            )}

            {pendingApprovalStep && (
            <AgentApprovalCard
              key={pendingApprovalStep.approval?.id}
              step={pendingApprovalStep}
              mediaModelOptions={mediaModelOptions}
              mediaModelAvailability={mediaModelAvailability}
              onResolve={onResolveApproval}
            />
          )}

          {/* 控制操作：官方只有「停止生成」（`chatAdapter.tooltips.stop`）。
              官方**没有**暂停/继续、跳过此步、重新规划、回退任务画布修改这些操作 ⇒ 已全部移除。 */}
          {!isTerminal && !isExpertTask && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-border/60 pt-2">
              <ControlButton icon="mdi:stop" label={t('停止')} tone="danger" onClick={() => onStop(task.id)} />
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
