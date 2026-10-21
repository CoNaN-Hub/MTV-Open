/**
 * 对话提交与恢复的统一控制层，按会话模式分派普通回复、Agent 任务和显式媒体生成。
 * 组件只调用本模块，不直接拼接运行时、调度器或审批流程。
 */
import { MEDIA_PERSIST_FAILED_MESSAGE, runMediaGeneration } from '../ai/generationRuntime';
import { workflowExecution } from '../workflowExecutionService';
import { completeWorkflowApiNodeTask } from '../workflowApi/workflowApiAdapter';
import {
  buildAssistantSystemPrompt,
  resolveAssistantModel,
} from '../ai/assistantStream';
import {
  runAssistantPipeline,
  runStreamingPipeline,
} from './assistantService';
import {
  resolveAgentApproval,
  runAgentLoop,
  runAgentTask,
  stopAgentTask,
} from './agentRuntime';
import {
  scheduleConversationAgentExecution,
  type AgentScheduleResult,
} from './agentScheduler';
import { getAvailableAgentTools } from './toolRegistry';
import { ensureAgentToolsRegistered } from './tools';
import {
  captureExplicitSkillBindings,
  expandSkillBindings,
  expandSkillReferences,
  resolveReferencedSkills,
  resolveSkillBindingToolAllowlist,
  SKILL_CONTENT_LIMITS,
} from '../skillPromptService';
import { useAppStore } from '../../store/useAppStore';
import type { ChatAttachment, ChatMessage } from '../../types/chat';
import {
  type AgentApprovalResolution,
  type AgentMode,
} from '../../types/agent';
import type { MediaGenerationIntent } from '../../types/media';
import { appendStreamingTextItem, reconcileStreamingTextItems } from './messageContents';
import {
  SEND_FAILED,
  STREAM_PROCESSING_ERROR,
} from './agentErrorMessage';
import { t } from '../../i18n';
import { deriveConversationTitle, refineConversationTitle, shouldAutoTitle } from './conversationTitle';
import {
  failMediaPlaceholderLifecycle,
  MEDIA_PLACEHOLDER_STALE_ERROR,
  registerMediaPlaceholderLifecycle,
  settleMediaPlaceholderLifecycle,
  type MediaPlaceholderLifecycle,
} from './mediaPlaceholderLifecycle';

const STREAMING_UI_FLUSH_INTERVAL_MS = 50;

/**
 * 官方错误文案的**写入侧**优先级（`zM(Be,u) || u("chatAdapter.errors.sendFailed")`，
 * `@2793225`/`@2795527`/`@2798291` 逐字）：**真实报错文本** → i18n 兜底键。
 *
 * ⚠️ 官方**从不加前缀**（官方没有任何「失败：xxx」式前缀，那类前缀是 MTV 自造、且在 `content` 里渲染成正文的那一行）。
 * 这里产出的字符串**只**落到 `ChatMessage.agentError`，由渲染层装配成官方 `agent_error` item
 * （`messageContents.buildMessageContents` / `ensureAgentErrorContent`），走 `AgentErrorBanner` 唯一那条通路。
 *
 * @param fallbackKey 官方 i18n 兜底键（MTV = 中文原文 key），例如 `SEND_FAILED` / `STREAM_PROCESSING_ERROR`。
 */
function agentErrorText(error: unknown, fallbackKey: string): string {
  const raw = error instanceof Error
    ? error.message
    : (typeof error === 'string' ? error : '');
  return raw.trim() ? raw : t(fallbackKey);
}

interface StreamingMessageBuffer {
  append: (delta: string) => void;
  flush: () => void;
  cancel: () => void;
  /** 官方 `contents` 的 item 边界：工具结果 / 待确认之后到达的正文要**新开**一个 `text` item。 */
  noteToolEvent: () => void;
  /**
   * 思考增量（推理/thinking）→ 官方 `appendMessageThinkingChunk` 的等价物。
   *
   * 官方写入口逐字（`vendor-pkg-canvas-CvbAwZyy.js` @42429）
   * `appendMessageThinkingChunk:(n,o,r)=>({…contents:[…d,{type:"thinking",content:p+o}]})`
   * 与正文写入口 `appendMessageTextChunk` **同形但不同 type** ⇒ 推理是**独立 item**，不是正文。
   * 所以这里**不**触碰 `content`，只落 `thinkingItems`。
   */
  appendThinking: (delta: string) => void;
  /**
   * ★★ 收尾对账：把 `textItems` 补齐到权威全文。
   * `onComplete` 只覆盖 `content`，而渲染层用的是 `textItems` ⇒ 不补就会出现
   * 「`content` 有全文、界面只显示前半句」（用户真机事故，详见实现处注释）。
   */
  reconcile: (fullText: string) => void;
}

export interface SubmitConversationMessageOptions {
  content: string;
  conversationId: string;
  projectId?: string;
  mode?: AgentMode;
  onProgress?: () => void;
  /** 官方 `bZ` 的 `quotedText`：引用文本，拼成 Markdown 引用块前置。 */
  quotedText?: string;
  /** 官方 `bZ` 的 `contextNodeIds`：独立 `context_nodes` part 的 MTV 等价物（挂到消息上）。 */
  contextNodeIds?: string[];
  /** 官方 `bZ` 的附件（`attachments`）。 */
  attachments?: ChatAttachment[];
}

export type SubmitConversationMessageResult =
  | { status: 'ignored' }
  | {
      status: 'started';
      userMessageId: string;
      assistantMessageId: string;
      taskId?: string;
    };

interface StartAgentMessageExecutionOptions {
  text: string;
  projectId: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  mode: AgentMode;
  onProgress?: () => void;
}

function createMessageId(): string {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createStreamingMessageBuffer(
  messageId: string,
  onProgress?: () => void,
): StreamingMessageBuffer {
  let pendingText = '';
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** 自上一段正文之后是否发生过**工具事件/确认**（官方 `contents` 里它们之间必有 item 边界）。 */
  let afterToolEvent = false;

  const flushPending = () => {
    flushTimer = null;
    if (!pendingText) return;
    const delta = pendingText;
    pendingText = '';
    const store = useAppStore.getState();
    const message = store.messages.find((item) => item.id === messageId);
    if (!message) return;
    /* 官方流式协议把每段正文 chunk 按**到达顺序**追加成一个 `text` item（写入口 `yxe`）；
       MTV 的 `content` 只留最终字符串，中途正文的「到达位置」会丢。
       这里同时记录 `textItems`，渲染层才能按官方 `absorbTextInRange` 把中途正文收进折叠面板。 */
    const startNewItem = afterToolEvent;
    afterToolEvent = false;
    store.updateMessageTransient(messageId, {
      content: (message.content || '') + delta,
      /* `startedAt` 只用于**新开**的 item：取本次到达的墙钟时间（与工具事件同轴）。 */
      textItems: appendStreamingTextItem(message.textItems, delta, Date.now(), startNewItem),
      status: 'streaming',
    });
    onProgress?.();
  };

  const clearFlushTimer = () => {
    if (!flushTimer) return;
    clearTimeout(flushTimer);
    flushTimer = null;
  };

  return {
    append: (delta) => {
      if (!delta) return;
      pendingText += delta;
      if (!flushTimer) {
        flushTimer = setTimeout(flushPending, STREAMING_UI_FLUSH_INTERVAL_MS);
      }
    },
    flush: () => {
      clearFlushTimer();
      flushPending();
    },
    cancel: () => {
      clearFlushTimer();
      pendingText = '';
    },
    /* ★★ 收尾对账（2026 用户真机事故）：`onComplete` 拿到的是**权威全文** `fullText`，
       而 `content` 只在那一刻被整体覆盖，`textItems` 里**只有已经 flush 出去的前缀** ——
       `cancel()` 又把缓冲区里没刷的尾部直接丢掉 ⇒ `textItems.join('') !== content`，
       而渲染层**用 `textItems`**（`buildMessageContents`：给了 textItems 就不再产 content item）
       ⇒ **用户看到的正文被截断**。
       事故现场（原始数据）：
         `content`   = `已在画布上生成 3:4 竖幅小猫图片：@{node-gxx0zfmw2:%E5%AF%B9…}`
         `textItems` = `已在画布上生成 3:4 竖幅小猫图片：@`   ← 尾部整个 `{node-…:…}` 掉了
         DOM 渲染    = 同上（所以 `@` 后面既没有 chip、也没有字）
       这里先把缓冲冲出去，再按 `fullText` 补齐差额（前缀相同 ⇒ 只补尾部；否则整段替换成一项）。 */
    reconcile: (fullText: string) => {
      clearFlushTimer();
      flushPending();
      const store = useAppStore.getState();
      const message = store.messages.find((item) => item.id === messageId);
      if (!message) return;
      store.updateMessageTransient(messageId, {
        textItems: reconcileStreamingTextItems(message.textItems, fullText),
      });
      onProgress?.();
    },
    /* 工具结果 / 待确认 = 官方 `contents` 里的一段边界：其后到达的正文必须是**新** item。
       ⚠️ **必须先把待刷新的正文冲出去**：`append` 是防抖的（`STREAMING_UI_FLUSH_INTERVAL_MS`），
       若边界到达时缓冲区里还压着**边界之前**收到的文字，标记完再 flush 会把那段文字并进**新** item
       ⇒ 一句话被从中间劈开（用户实测：面板里到「不虚构像素」就断，其余「级细节。」掉到面板外）。 */
    noteToolEvent: () => {
      clearFlushTimer();
      flushPending();
      afterToolEvent = true;
    },
    /* 思考增量：官方 `appendMessageThinkingChunk` 的续写语义 —— 与**最后一项**是 `thinking` 就续写它，
       否则新开一项（时间戳 = 该段开始到达的墙钟时间）。推理**不**进 `content`。 */
    appendThinking: (delta) => {
      if (!delta) return;
      const store = useAppStore.getState();
      const message = store.messages.find((item) => item.id === messageId);
      if (!message) return;
      const items = [...(message.thinkingItems ?? [])];
      const last = items[items.length - 1];
      if (last) items[items.length - 1] = { ...last, content: last.content + delta };
      else items.push({ content: delta, startedAt: Date.now() });
      store.updateMessageTransient(messageId, { thinkingItems: items });
      onProgress?.();
    },
  };
}

/** 官方两态确认模式的切换提示（`chatAdapter.confirmMode.{ask,auto}`）。 */
export function getAgentModeToast(mode: AgentMode): string {
  if (mode === 'autonomous') {
    return '已切换到 Auto：操作自动执行（付费媒体与文件写入仍按权限设置处理）';
  }
  return '已切换到手动确认：写操作将先请求你的确认';
}

export function resolveConversationAgentApproval(
  approvalId: string,
  resolution: AgentApprovalResolution,
): boolean {
  if (!resolveAgentApproval(approvalId, resolution)) return false;

  const store = useAppStore.getState();
  const task = store.agentTasks.find((item) =>
    item.steps.some((step) => step.approval?.id === approvalId),
  );
  if (!task) return true;
  const step = task.steps.find((item) => item.approval?.id === approvalId);
  const message = store.messages.find((item) => item.agentTaskId === task.id);
  if (!message || !step) return true;
  const placeholder = `等待确认：${step.title}`;
  store.updateMessage(message.id, {
    content: message.content === placeholder ? '' : message.content,
    status: 'executing',
  });
  return true;
}

export function submitConversationMessage({
  content,
  conversationId,
  projectId,
  mode,
  onProgress,
  quotedText,
  contextNodeIds,
  attachments,
}: SubmitConversationMessageOptions): SubmitConversationMessageResult {
  const rawInput = content.trim();
  /* 官方 `bZ` 的 text 拼法逐字：编辑器里已含 `{{quoted_text:…}}` 就不重复前置；
     否则有 `quotedText` 时前置 Markdown 引用块 + 空行。（MTV 编辑器用内联 `@{id:label}` token，
     没有官方的 `{{quoted_text:…}}` 形态，故这里等价于「有引用文本就前置」。） */
  const text = quotedText
    ? `> ${quotedText}\n\n${rawInput}`
    : rawInput;
  if (!text || !conversationId) return { status: 'ignored' };

  const store = useAppStore.getState();
  const conversation = store.conversations.find((item) => item.id === conversationId);
  const executionProjectId = projectId ?? conversation?.projectId ?? store.currentProjectId ?? '';
  const userMessage: ChatMessage = {
    id: createMessageId(),
    conversationId,
    role: 'user',
    content: text,
    timestamp: Date.now(),
    status: 'done',
    ...(contextNodeIds && contextNodeIds.length > 0 ? { contextNodeIds: [...contextNodeIds] } : {}),
    ...(attachments && attachments.length > 0 ? { attachments: [...attachments] } : {}),
  };
  store.addMessage(userMessage);

  /* 官方自动标题（`onTitle` → `setConversationTitle`，**服务端**算好下发）；
     MTV 没有服务端 ⇒ 两条腿：先立刻落一个截断标题（不花钱、不等网络），
     再异步调一次文本模型换成官方那种短名（`refineConversationTitle`，失败静默保留截断标题）。 */
  if (shouldAutoTitle(conversation)) {
    const autoTitle = deriveConversationTitle(rawInput);
    if (autoTitle) {
      store.updateConversation(conversationId, { title: autoTitle, titleSource: 'auto' });
    }
    void refineConversationTitle(conversationId, rawInput);
  }

  const assistantMessage: ChatMessage = {
    id: createMessageId(),
    conversationId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    status: resolveAssistantModel(executionProjectId) ? 'streaming' : 'parsing',
  };
  store.addMessage(assistantMessage);

  const taskId = startAgentMessageExecution({
    text,
    projectId: executionProjectId,
    conversationId,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    mode: mode ?? conversation?.agentMode ?? 'collaborative',
    onProgress,
  });
  onProgress?.();

  return {
    status: 'started',
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    taskId,
  };
}

function startAgentMessageExecution({
  text,
  projectId,
  conversationId,
  userMessageId,
  assistantMessageId,
  mode,
  onProgress,
}: StartAgentMessageExecutionOptions): string | undefined {
  const store = useAppStore.getState();
  let taskId: string | undefined;

  try {
    ensureAgentToolsRegistered();
    const runtimeSkills = [...store.userSkills, ...store.agentPackageSkills];
    const referencedSkills = resolveReferencedSkills(text, runtimeSkills);
    if (referencedSkills.length > SKILL_CONTENT_LIMITS.maxExplicitBindings) {
      throw new Error(`单个任务最多注入 ${SKILL_CONTENT_LIMITS.maxExplicitBindings} 个 Skill`);
    }
    const skillBindings = captureExplicitSkillBindings(text, runtimeSkills);
    const task = store.createAgentTask({
      projectId,
      conversationId,
      userMessageId,
      mode,
      goal: text,
      toolAllowlist: resolveSkillBindingToolAllowlist(skillBindings),
      skillBindings,
    });
    taskId = task.id;
    store.updateMessage(assistantMessageId, { agentTaskId: task.id });
    scheduleAgentTaskExecution(task.id, assistantMessageId, onProgress);
    return task.id;
  } catch (error) {
    const errorMessage = agentErrorText(error, SEND_FAILED);
    if (taskId) {
      try {
        stopAgentTask(taskId);
        store.updateAgentTask(taskId, {
          errorCode: 'AGENT_START_FAILED',
          errorMessage,
        });
      } catch (stopError) {
        console.error('[AgentBootstrap] failed to stop incomplete task:', stopError);
      }
    }
    /* ✅ 官方收口：错误文案**只**落 `agentError`（⇒ 渲染层装配成官方 `agent_error` item ⇒ 唯一的
       `AgentErrorBanner`）。原来这里把「自造前缀 + 错误文本」写进正文 `content` —— 那个前缀官方没有，
       且会在正文里渲染出**第二行**同样的报错（用户实测截图：同一句话出现两次）。
       官方对照：`updateMessage(st.id,{contents:[{type:"agent_error",content:yt}]})`（@2798291 逐字）
       —— 那段代码**只**写 agent_error，**不动** `content`。 */
    store.updateMessage(assistantMessageId, {
      agentError: errorMessage,
      status: 'error',
      finishReason: 'error',
    });
    onProgress?.();
    console.error('[AgentBootstrap] failed to start chat task:', error);
    return undefined;
  }
}

function scheduleAgentTaskExecution(
  taskId: string,
  assistantMessageId: string,
  onProgress?: () => void,
): AgentScheduleResult | undefined {
  const task = useAppStore.getState().agentTasks.find((item) => item.id === taskId);
  if (!task) return undefined;
  const scheduled = scheduleConversationAgentExecution({
    taskId,
    conversationId: task.conversationId,
    onStart: () => {
      const store = useAppStore.getState();
      const message = store.messages.find((item) => item.id === assistantMessageId);
      if (message && message.status === 'queued') {
        store.updateMessage(assistantMessageId, {
          status: resolveAssistantModel(task.projectId) ? 'streaming' : 'parsing',
        });
      }
    },
    run: () => driveAgentTask(taskId, assistantMessageId, onProgress),
    onError: (error) => {
      console.error('[AgentScheduler] failed to execute chat task:', error);
    },
  });
  if (scheduled.state !== 'started') {
    useAppStore.getState().updateMessage(assistantMessageId, { status: 'queued' });
  }
  return scheduled;
}

function driveAgentTask(
  taskId: string,
  assistantMessageId: string,
  onProgress?: () => void,
): Promise<void> {
  const store = useAppStore.getState();
  ensureAgentToolsRegistered();
  const task = store.agentTasks.find((item) => item.id === taskId);
  if (!task) return Promise.resolve();
  const { projectId, conversationId, userMessageId, goal: text } = task;
  const mode = store.conversations.find((item) => item.id === conversationId)?.agentMode
    ?? task.mode;
  /** 官方「头脑风暴」会话开关：开启后系统提示要求维护 brainstorm.md，并在每轮结束时落盘。 */
  const brainstormMode = store.conversations
    .find((item) => item.id === conversationId)?.brainstormMode === true;

  return runAgentTask(taskId, async (signal) => {
    let failed = false;

    if (resolveAssistantModel(projectId)) {
      const streamingMessage = createStreamingMessageBuffer(assistantMessageId, onProgress);
      const availableTools = getAvailableAgentTools({
        taskId,
        projectId,
        conversationId,
        mode,
        toolAllowlist: task.toolAllowlist,
      });
      if (
        availableTools.length > 0
        || task.readOnly
        || task.toolAllowlist !== undefined
      ) {
        return runAgentLoop({
          taskId,
          systemPrompt: buildAssistantSystemPrompt({
            agentTools: true,
            projectId,
            includeCanvasContext: useAppStore.getState().currentProjectId === projectId,
            brainstorm: brainstormMode,
          }),
          userMessage: task.skillBindings === undefined
            ? expandSkillReferences(text, [...store.userSkills, ...store.agentPackageSkills])
            : expandSkillBindings(text, task.skillBindings),
          excludeMessageIds: [userMessageId, assistantMessageId],
          signal,
          callbacks: {
            onTextDelta: streamingMessage.append,
            onComplete: (fullText) => {
              streamingMessage.reconcile(fullText);
              streamingMessage.cancel();
              useAppStore.getState().updateMessage(assistantMessageId, {
                content: fullText,
                status: 'done',
              });
              /* ⚠️ 头脑风暴会话**不再**把这一轮的回答整体写成 brainstorm.md：
                 官方那条路是「agent 调 `brainstorm_update` 工具写 artifact，聊天里正常回答」
                 （证据见覆盖表 §36.4 / `tools/brainstormTools.ts` 头部）。
                 旧逻辑（`writeBrainstormDoc(全量回答)`）会让同一份文档同时出现在聊天正文与面板。 */
              onProgress?.();
            },
            onApprovalRequired: (_step) => {
              streamingMessage.flush();
              /* 一步确认 = 官方 `contents` 里的 item 边界（其后正文要新开 `text` item）。 */
              streamingMessage.noteToolEvent();
              const currentStore = useAppStore.getState();
              const message = currentStore.messages.find(
                (item) => item.id === assistantMessageId,
              );
              currentStore.updateMessage(assistantMessageId, {
                /* ⚠️ 第 64 轮：这里原来会写正文占位「等待确认：{title}」——官方产物 **493 个 JS 里
                   「等待确认 / Awaiting confirmation」0 命中**（核对见 `_r64_protocol_crosscheck.md` (a)），
                   而且任务卡标题（`AgentTaskTimeline`）已经显示同一条，同屏重复。
                   ⇒ 只保留**状态**切换，正文不动（为空时由状态行/思考行承载）。
                   下方 `onApprovalResolved` 里清理旧占位的分支保留，用于历史消息。 */
                content: message?.content ?? '',
                status: 'preview',
              });
            },
            onToolResult: (result) => {
              /* 工具结果 = 官方 `contents` 里的 item 边界：**先**标记（即使这条结果没有
                 sources 也要标记），其后到达的正文才会新开一个 `text` item。 */
              streamingMessage.noteToolEvent();
              if (!result.sources?.length) return;
              const currentStore = useAppStore.getState();
              const message = currentStore.messages.find(
                (item) => item.id === assistantMessageId,
              );
              const sources = [...(message?.sources ?? [])];
              for (const source of result.sources) {
                if (!sources.some((item) => item.url === source.url)) sources.push(source);
              }
              currentStore.updateMessage(assistantMessageId, { sources });
              onProgress?.();
            },
            onError: (error) => {
              streamingMessage.cancel();
              failed = true;
              /* 官方 `streamProcessingError`（@2767521 逐字：`contents:[{type:"agent_error",
                 content:u("chatAdapter.errors.streamProcessingError")}]`）。 */
              useAppStore.getState().updateMessage(assistantMessageId, {
                agentError: agentErrorText(error, STREAM_PROCESSING_ERROR),
                status: 'error',
                finishReason: 'error',
              });
            },
          },
        });
      }

      await runStreamingPipeline(text, conversationId, {
        onTextDelta: streamingMessage.append,
        /* 官方 `onThinking` ⇒ 独立 `thinking` item（不是正文），落 `message.thinkingItems`。 */
        onThinkingDelta: streamingMessage.appendThinking,
        onComplete: (fullText, results) => {
          streamingMessage.reconcile(fullText);
          streamingMessage.cancel();
          useAppStore.getState().updateMessage(assistantMessageId, {
            content: fullText,
            status: 'done',
            executionResults: results.length > 0 ? results : undefined,
          });
          onProgress?.();
        },
        onError: (error) => {
          streamingMessage.cancel();
          failed = true;
          /* 官方 `streamProcessingError`（同 `@2767889` 逐字写入口）。 */
          useAppStore.getState().updateMessage(assistantMessageId, {
            agentError: agentErrorText(error, STREAM_PROCESSING_ERROR),
            status: 'error',
            finishReason: 'error',
          });
        },
        onMediaIntent: (intent) => {
          void triggerMediaGeneration(assistantMessageId, intent);
        },
        signal,
      }, projectId);
      return failed ? 'failed' : 'completed';
    }

    if (task.toolAllowlist !== undefined) {
      useAppStore.getState().updateMessage(assistantMessageId, {
        content: '该 Skill 声明了工具限制，需要配置文本模型后才能安全执行；未执行任何操作。',
        status: 'done',
      });
      onProgress?.();
      return 'completed';
    }

    try {
      const result = await runAssistantPipeline(text, conversationId, projectId);
      useAppStore.getState().updateMessage(assistantMessageId, {
        content: result.reply,
        status: 'done',
        executionResults: result.commandResults.length > 0 ? result.commandResults : undefined,
      });
      onProgress?.();
      return 'completed';
    } catch (error) {
      useAppStore.getState().updateMessage(assistantMessageId, {
        agentError: agentErrorText(error, SEND_FAILED),
        status: 'error',
        finishReason: 'error',
      });
      return 'failed';
    }
  }).then(() => undefined).catch((error) => {
    console.error('[AgentRuntime] failed to execute chat task:', error);
  });
}

async function triggerMediaGeneration(
  messageId: string,
  intent: MediaGenerationIntent,
): Promise<void> {
  const store = useAppStore.getState();
  const projectId = store.currentProjectId;
  const originMessage = store.messages.find((message) => message.id === messageId);
  const apiWorkflow = store.workflows.find((workflow) => workflow.adapterType === 'workflow-api' && `workflow-api/${workflow.id}` === intent.modelRef);
  const taskContext = apiWorkflow && projectId && originMessage ? {
    projectId, conversationId: originMessage.conversationId, messageId, deliveryMode: intent.deliveryMode,
  } : undefined;
  const isCurrentApiMessage = () => useAppStore.getState().currentProjectId === projectId
    && useAppStore.getState().messages.some((message) => message.id === messageId && message.conversationId === originMessage?.conversationId);
  const needsCanvas = intent.deliveryMode === 'canvas' || intent.deliveryMode === 'both';
  let targetNodeId: string | undefined;
  let placeholderLifecycle: MediaPlaceholderLifecycle | null = null;

  if (needsCanvas) {
    targetNodeId = store.createMediaPlaceholder(intent);
    if (apiWorkflow) store.updateNodeDataTransient(targetNodeId, { ...workflowExecution(apiWorkflow), workflowInputs: intent.workflowInputs });
    placeholderLifecycle = registerMediaPlaceholderLifecycle(targetNodeId);
  }
  const mediaLabel = intent.kind === 'image'
    ? '图片'
    : intent.kind === 'video'
      ? '视频'
      : '音频';
  store.updateMessage(messageId, {
    mediaStatus: 'queued',
    mediaError: undefined,
    canvasStatus: needsCanvas ? 'pending' : 'none',
    canvasNodeId: targetNodeId,
    canvasError: undefined,
  });
  try {
    store.updateMessage(messageId, { mediaStatus: 'generating' });
    const result = await runMediaGeneration(intent, projectId, undefined, apiWorkflow ? targetNodeId : undefined, taskContext);
    if (apiWorkflow && !isCurrentApiMessage()) return;
    const nodeCreated = placeholderLifecycle
      ? settleMediaPlaceholderLifecycle(placeholderLifecycle, result)
      : targetNodeId ? useAppStore.getState().settleMediaPlaceholder(targetNodeId, result) : false;
    store.updateMessage(messageId, {
      mediaResult: result,
      mediaStatus: 'succeeded',
      mediaError: undefined,
      canvasStatus: targetNodeId ? (nodeCreated ? 'created' : 'failed') : 'none',
      canvasNodeId: targetNodeId,
      canvasError: targetNodeId && !nodeCreated ? MEDIA_PLACEHOLDER_STALE_ERROR : undefined,
    });
    if (result.workflowApiTaskId && (!targetNodeId || nodeCreated)) completeWorkflowApiNodeTask(targetNodeId ?? `workflow-api-message-${messageId}`, result.workflowApiTaskId);
    // 生成成功不代表已可靠保存，落盘失败必须让用户知道并能重试
    if (result.persistence === 'failed') {
      store.showToast(
        `${mediaLabel}已生成，但未保存到项目：${result.persistError || MEDIA_PERSIST_FAILED_MESSAGE}`,
        'error',
      );
    }
  } catch (error) {
    if (apiWorkflow && !isCurrentApiMessage()) return;
    const message = error instanceof Error ? error.message : '未知错误';
    if (placeholderLifecycle) failMediaPlaceholderLifecycle(placeholderLifecycle, message);
    else if (targetNodeId) useAppStore.getState().failMediaPlaceholder(targetNodeId, message);
    store.updateMessage(messageId, {
      mediaStatus: 'failed',
      mediaError: message,
      canvasStatus: targetNodeId ? 'failed' : 'none',
      canvasNodeId: targetNodeId,
      canvasError: targetNodeId ? message : undefined,
    });
    store.showToast(`${mediaLabel}生成失败: ${message}`, 'error');
  }
}
