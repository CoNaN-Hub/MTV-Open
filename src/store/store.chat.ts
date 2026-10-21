/**
 * Chat Slice — 对话助手状态管理
 * 管理聊天面板开关、会话列表、消息流、操作日志和 revision 计数
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './useAppStore';
import type {
  AskQuestionAnswer,
  ChatAttachment,
  ChatConversation,
  ChatMessage,
  ChatModelThinkingSetting,
  ChatModelThinkingSettings,
  OperationLog,
  PendingAskQuestion,
  QueuedChatMessage,
} from '../types/chat';
import { AGENT_TERMINAL_STATUSES } from '../types/agent';
import { clearConversationFileGrants } from '../services/chat/fileGrantService';
import { stopConversationAgentTasks } from '../services/chat/agentTaskControl';
import * as chatHistoryService from '../services/chat/chatHistoryService';
import { seriesOwnerId } from './store.utils';

// ============================================
// 常量
// ============================================

/** 批量操作默认上限 */
export const BATCH_NODE_LIMIT = 50;
/** 画布 revision 初始值 */
const INITIAL_REVISION = 0;
/** 流式消息持续输出时的持久化节流间隔。 */
const STREAMING_MESSAGE_PERSIST_INTERVAL_MS = 500;

/** 排队消息 id（官方 `queuedMessages[].id`；用于拖拽排序与按 id 移除）。 */
let queuedMessageSeq = 0;
function createQueuedMessageId(): string {
  queuedMessageSeq += 1;
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${queuedMessageSeq.toString(36)}`;
  return `queued-${random}`;
}
const ACTIVE_CONVERSATION_STORAGE_PREFIX = 'ai-canvas.chat.active-conversation';
const scheduledMessagePersistTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getActiveConversationStorageKey(projectId: string): string {
  return `${ACTIVE_CONVERSATION_STORAGE_PREFIX}:${projectId}`;
}

function readPersistedActiveConversation(projectId: string): string | null {
  try {
    return globalThis.localStorage?.getItem(getActiveConversationStorageKey(projectId)) ?? null;
  } catch {
    return null;
  }
}

function persistActiveConversation(projectId: string, conversationId: string): void {
  try {
    globalThis.localStorage?.setItem(
      getActiveConversationStorageKey(projectId),
      conversationId,
    );
  } catch {
    // localStorage 不可用时退化为本次运行内的 Store 状态。
  }
}

function clearPersistedActiveConversation(projectId: string, conversationId: string): void {
  try {
    const key = getActiveConversationStorageKey(projectId);
    if (globalThis.localStorage?.getItem(key) === conversationId) {
      globalThis.localStorage.removeItem(key);
    }
  } catch {
    // 清理失败不影响会话删除流程。
  }
}

// ============================================
// Slice interface
// ============================================

export interface ChatSlice {
  // ── 面板状态 ──
  chatOpen: boolean;
  /** 从应用其他入口请求预填到聊天输入框的一次性草稿。 */
  chatComposerDraft: string | null;
  /**
   * 首页输入条「发一句就开始」的一次性待发问句。
   * 官方证据：`index-bundle.js` @1425705 `Sz`（banner CTA）里把 `agent_query` 收进
   * `navigateState.agentQuery`；@1599900 的消费侧读的是**全局状态**里的
   * `{userId, agentQuery, agentAttachments, suggestionContext, starterWideAgentPanel}`
   * ⇒ 官方不是「只预填输入框」，而是**建项目 + 进画布 + 自动把这句话发进 agent 面板**。
   * MTV 没有路由 state ⇒ 用这一条一次性字段承担同样的交接。
   */
  pendingAgentQuery: string | null;
  /** 输入框当前草稿。 */
  chatComposerLiveDraft: string;

  /* ── 输入卡「引用条」状态（官方 session state 的 `contextNodeIds` / `quotedText` / `attachments`，
        官方 `ContextStrip`(`VL`) 读这三条）──
     ⚠️ 与官方差异：官方是按 session 存的（`getSessionState(sessionId)` 各存一份），
     MTV 现在跟随 `chatComposerLiveDraft` 的既有模式做成全局单份，切换会话时清空。 */
  /** 被 `@` 引用进本轮对话的画布节点 id。 */
  chatComposerContextNodeIds: string[];
  /** 被引用的文本（官方 `quotedText`，来自「在对话中讨论」等入口）。 */
  chatComposerQuotedText: string | null;
  /** 随本轮一起发出的附件。 */
  chatComposerAttachments: ChatAttachment[];
  /**
   * 官方 `session.thinkingActivity`：`null | 'thinking' | 'degraded'`。
   * `'thinking'` ⇒ 状态行显示「思考中…」（官方 `IC` 的分支），其余走随机四档。
   */
  chatThinkingActivity: 'thinking' | 'degraded' | null;

  /* ── 官方「按模型存思考档位」（`chatModelThinkingSettings`）──
     官方存 `Record<modelId, {enabled, level?}>`，落 localStorage
     `tap:agent_chat_thinking_settings:v1`；发送时把当前模型的设置带给请求。 */
  chatModelThinkingSettings: ChatModelThinkingSettings;

  // ── 会话状态 ──
  conversations: ChatConversation[];
  activeConversationId: string | null;

  // ── 消息状态 ──
  messages: ChatMessage[];
  /** 当前活动的 AI 请求 AbortController */
  activeRequestAbort: AbortController | null;
  /** 消息输入队列（官方 `queuedMessages`）：生成中再发送 ⇒ 进队列而不是打断。
   *  官方元素形状是 `{id, text, attachments?, contextNodeIds?, quotedText?}`（`page-BeI7xydN.js`@907446
   *  的 `QueuedMessagesBar`）；MTV 只保留 `id` + `text`，其余随发送时的上下文一起走。 */
  messageQueue: QueuedChatMessage[];
  /**
   * 官方 `compact` 生命周期的 **`phase:"started"` 生产者**（§6 #14 后半）。
   *
   * 官方把 `{type:"compact",content:{phase:"started"}}` 追加进消息 `contents`（压缩中），
   * 完成后同一条更新为 `phase:"finished"` ⇒ `Tie`(`CompactLifecycleLine`) 的
   * `active = phase === "started" && isStreaming` 决定显示「正在自动压缩上下文」+ 计时。
   * MTV 没有消息级 `contents`，压缩是**回合间**过程 ⇒ 用这个瞬时（不持久化）字段承载
   * 「哪个会话正在压缩」，渲染层在消息流末尾按 `phase="started"` 渲染同一颗 `Tie`。
   * `null` = 当前没有会话在压缩。
   */
  contextCompactingConversationId: string | null;

  // ── 提问（官方 `ask_question`）会话状态 ──
  /** 官方 `pendingQuestion`：待答问题（`null` = 无）。形状见 `PendingAskQuestion`。 */
  pendingQuestion: PendingAskQuestion | null;
  /** 官方 `multiSelectDraft`：多选模式下已勾选的标签草稿。 */
  multiSelectDraft: string[];
  /** 官方 `setPendingQuestion(n, sessionId)`。 */
  setPendingQuestion: (question: PendingAskQuestion | null) => void;
  /** 官方 `updatePendingQuestionStatus(status, selectedAnswers?, sessionId?)`。 */
  updatePendingQuestionStatus: (status: string) => void;
  /** 官方 `setPendingQuestionProgress(collectedAnswers, step, sessionId?)`。 */
  setPendingQuestionProgress: (collectedAnswers: (AskQuestionAnswer | null)[], step: number) => void;
  /** 官方 `clearPendingQuestion(sessionId?)`。 */
  clearPendingQuestion: () => void;
  /** 官方 `setMultiSelectDraft(labels, sessionId?)`。 */
  setMultiSelectDraft: (labels: string[]) => void;
  /** 官方 `clearMultiSelectDraft(sessionId?)`。 */
  clearMultiSelectDraft: () => void;

  // ── 操作日志 ──
  operationLogs: OperationLog[];

  // ── Revision 计数 ──
  /** 当前项目画布 revision，每次写操作 +1 */
  canvasRevision: number;
  /** 全局 revision 计数（revisionScope === 'global' 的项目使用） */
  globalCanvasRevision: number;

  // ── Panel Actions ──
  openChat: () => void;
  openChatWithDraft: (draft: string) => void;
  clearChatComposerDraft: () => void;
  /** 首页输入条「发一句就开始」：把问句交给画布的 agent 面板自动发出（`null` = 清除）。 */
  setPendingAgentQuery: (query: string | null) => void;
  /**
   * 首页「技能」按钮 → 官方「管理技能」面板（`skills.title="技能"`、页签「技能 / 应用」）。
   * MTV 直接复用 `SkillsManagerDialog`，这一对布尔只是它的开关（创建技能是二级面板）。
   */
  homeSkillsOpen: boolean;
  setHomeSkillsOpen: (open: boolean) => void;
  /** 打开「管理技能」面板时的初始页签：官方「技能」按钮 → 技能；「Connectors」→ 应用。 */
  homeSkillsTab: 'skills' | 'plugin';
  setHomeSkillsTab: (tab: 'skills' | 'plugin') => void;
  homeSkillCreateOpen: boolean;
  setHomeSkillCreateOpen: (open: boolean) => void;
  closeChat: () => void;
  toggleChat: () => void;
  setChatComposerLiveDraft: (draft: string) => void;
  /* 官方 session state 的对应 action：`setContextNodeIds` / `addContextNodeIds` /
     `removeContextNodeId` / `clearContextNodeIds` / `setQuotedText` / `clearQuotedText` /
     `addAttachment` / `removeAttachment`（官方 `useChatSessionState()`）。 */
  setContextNodeIds: (ids: string[]) => void;
  addContextNodeIds: (ids: string[]) => void;
  removeContextNodeId: (id: string) => void;
  clearContextNodeIds: () => void;
  /* 官方 `Gr` 画布拾取模式（`enterMode(sessionId)` / `exitMode()`）：
     「从画布添加」进入后，画布上点节点 = 加入/移出引用，而不是选中/开对话框。 */
  insertFromCanvasPickActive: boolean;
  enterInsertFromCanvasPick: () => void;
  exitInsertFromCanvasPick: () => void;
  setQuotedText: (text: string | null) => void;
  clearQuotedText: () => void;
  addAttachment: (attachment: ChatAttachment) => void;
  removeAttachment: (src: string) => void;
  clearAttachments: () => void;
  /** 官方 `setThinkingActivity(value, sessionId)`（`te()`/`Q()` 那两个）。 */
  setChatThinkingActivity: (value: 'thinking' | 'degraded' | null) => void;
  /** 官方 `setChatModelThinkingSettings(modelId, settings)`：按模型写思考档位（并落 localStorage）。 */
  setChatModelThinkingSettings: (modelId: string, settings: ChatModelThinkingSetting) => void;

  // ── Conversation Actions ──
  setConversations: (conversations: ChatConversation[]) => void;
  addConversation: (conversation: ChatConversation) => void;
  updateConversation: (id: string, partial: Partial<ChatConversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  /** 在当前项目创建空会话 */
  createConversation: (projectId: string, title?: string) => string;

  // ── 持久化 Actions ──
  /** 从 IndexedDB 加载当前项目的全部会话 */
  loadConversationsForProject: (projectId: string) => Promise<void>;
  /** 从 IndexedDB 加载指定会话的消息（替换当前 messages） */
  loadConversationMessages: (conversationId: string) => Promise<void>;
  /** 修复启动时遗留的中断消息 */
  repairInterruptedForProject: (projectId: string) => Promise<void>;

  // ── Message Actions ──
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, partial: Partial<ChatMessage>) => void;
  /** 更新流式展示状态，并按固定间隔持久化最新快照。 */
  updateMessageTransient: (id: string, partial: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  /** 设置活动 AbortController */
  setActiveRequestAbort: (ctrl: AbortController | null) => void;
  /** 官方 `compact` 的 `phase:"started"` 生产者：标记/清除「正在压缩上下文的会话」。 */
  setContextCompacting: (conversationId: string | null) => void;
  /** 消息队列入队（官方 `enqueueMessage`）；接受纯文本或完整载荷（含附件/引用/上下文）；返回入队的那条（带 id）。 */
  enqueueMessage: (payload: string | Omit<QueuedChatMessage, 'id'>) => QueuedChatMessage;
  /** 消息队列出队（官方 `dequeueMessage`）：取队首并移除。 */
  dequeueMessage: () => QueuedChatMessage | undefined;
  /** 官方 `removeQueuedMessage(id)`：按 id 移除一条。 */
  removeQueuedMessage: (id: string) => void;
  /** 官方 `reorderQueuedMessages(activeId, overId)`：拖拽排序。 */
  reorderQueuedMessages: (activeId: string, overId: string) => void;
  /** 清空消息队列 */
  clearMessageQueue: () => void;

  // ── Operation Log Actions ──
  addOperationLog: (log: OperationLog) => void;
  updateOperationLog: (id: string, partial: Partial<OperationLog>) => void;
  clearOperationLogs: () => void;

  // ── Revision Actions ──
  /** 画布写操作后调用，递增 revision */
  incrementRevision: () => number;
  /** 获取当前项目对应的 revision（根据 revisionScope） */
  getCurrentRevision: () => number;
  /** 设置 revision（项目切换/加载时使用） */
  setCanvasRevision: (rev: number) => void;
  setGlobalCanvasRevision: (rev: number) => void;
}

// ============================================
// 持久化 helper（fire-and-forget，不阻塞状态更新）
// ============================================

function persistConv(c: ChatConversation) {
  chatHistoryService.saveConversation(c).catch((e) =>
    console.warn('[chat.persist] 会话保存失败:', e),
  );
}

function persistMsg(m: ChatMessage, projectId: string) {
  chatHistoryService.persistMessage(m, projectId, m.conversationId).catch((e) =>
    console.warn('[chat.persist] 消息保存失败:', e),
  );
}

function retainBackgroundTaskMessages(state: AppState, targetConversationId?: string): ChatMessage[] {
  const activeConversationIds = new Set(
    state.agentTasks
      .filter((task) => !AGENT_TERMINAL_STATUSES.has(task.status))
      .map((task) => task.conversationId),
  );
  return state.messages.filter((message) =>
    message.conversationId !== targetConversationId
    && activeConversationIds.has(message.conversationId),
  );
}

function resolveMessageProjectId(state: AppState, conversationId: string): string | null {
  return state.conversations.find((conversation) => conversation.id === conversationId)?.projectId
    ?? state.agentTasks.find((task) => task.conversationId === conversationId)?.projectId
    ?? state.currentProjectId;
}

function mergeMessage(
  messages: ChatMessage[],
  id: string,
  partial: Partial<ChatMessage>,
): { messages: ChatMessage[]; changed: ChatMessage } | null {
  const index = messages.findIndex((message) => message.id === id);
  if (index < 0) return null;
  const changed = { ...messages[index], ...partial };
  const updated = [...messages];
  updated[index] = changed;
  return { messages: updated, changed };
}

function cancelScheduledMessagePersist(id: string): void {
  const timer = scheduledMessagePersistTimers.get(id);
  if (!timer) return;
  clearTimeout(timer);
  scheduledMessagePersistTimers.delete(id);
}

function persistMessageFromState(state: AppState, id: string): void {
  const message = state.messages.find((item) => item.id === id);
  if (!message) return;
  const projectId = resolveMessageProjectId(state, message.conversationId);
  if (projectId) persistMsg(message, projectId);
}

function scheduleMessagePersist(id: string, getState: () => AppState): void {
  if (scheduledMessagePersistTimers.has(id)) return;
  const timer = setTimeout(() => {
    scheduledMessagePersistTimers.delete(id);
    persistMessageFromState(getState(), id);
  }, STREAMING_MESSAGE_PERSIST_INTERVAL_MS);
  scheduledMessagePersistTimers.set(id, timer);
}

// ============================================
// Slice implementation
// ============================================

/* ── 官方思考档位持久化（`course-api-base-url-*.js`@192076 / @192297 逐字）──
   key `tap:agent_chat_thinking_settings:v1`；校验：`enabled` 必须 boolean、`level` 若存在必须 string。 */
const THINKING_SETTINGS_STORAGE_KEY = 'tap:agent_chat_thinking_settings:v1';

function canUseThinkingStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** 官方 `Ehe`。 */
function isValidThinkingSetting(value: unknown): value is ChatModelThinkingSetting {
  if (!value || typeof value !== 'object') return false;
  const entry = value as ChatModelThinkingSetting;
  return !(typeof entry.enabled !== 'boolean'
    || (entry.level != null && typeof entry.level !== 'string'));
}

/** 官方 `_he`。 */
export function readStoredThinkingSettings(): ChatModelThinkingSettings {
  if (!canUseThinkingStorage()) return {};
  try {
    const raw = window.localStorage.getItem(THINKING_SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: ChatModelThinkingSettings = {};
    for (const [modelId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!modelId || !isValidThinkingSetting(value)) continue;
      out[modelId] = { enabled: value.enabled, ...(value.level ? { level: value.level } : {}) };
    }
    return out;
  } catch {
    return {};
  }
}

/** 官方 `The`。 */
function writeStoredThinkingSettings(settings: ChatModelThinkingSettings): void {
  if (!canUseThinkingStorage()) return;
  try {
    window.localStorage.setItem(THINKING_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* 持久化失败不影响本次设置 */
  }
}

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set, get) => ({  // ── 面板初始状态 ──
  chatOpen: false,
  chatComposerDraft: null,
  pendingAgentQuery: null,
  homeSkillsOpen: false,
  homeSkillsTab: 'skills',
  homeSkillCreateOpen: false,
  chatComposerLiveDraft: '',
  chatComposerContextNodeIds: [],
  chatComposerQuotedText: null,
  chatComposerAttachments: [],
  /* 官方 `session.thinkingActivity`（`vendor-pkg-canvas` @2692515 的 `te()`/`Q()`）：
     取值域 `null | "thinking" | "degraded"`，驱动思考状态行的文案
     （`thinking` ⇒ 「思考中…」，否则随机四档；`jlt = 15e3` 后降级成 `degraded`）。
     ⚠️ 官方是按 session 存的；MTV 沿用 `chatComposer*` 那套全局单份。 */
  chatThinkingActivity: null,
  /* 官方 session 初始形状里的提问状态（`pendingQuestion: null` / `multiSelectDraft: []`）。 */
  pendingQuestion: null,
  multiSelectDraft: [],
  chatModelThinkingSettings: readStoredThinkingSettings(),

  // ── 会话初始状态 ──
  conversations: [],
  activeConversationId: null,

  // ── 消息初始状态 ──
  messages: [],
  activeRequestAbort: null,
  messageQueue: [],
  contextCompactingConversationId: null,

  // ── 操作日志初始状态 ──
  operationLogs: [],

  // ── Revision 初始状态 ──
  canvasRevision: INITIAL_REVISION,
  globalCanvasRevision: INITIAL_REVISION,

  // ==========================================
  // Panel Actions
  // ==========================================

  openChat: () => set({
    chatOpen: true,
    settingsOpen: false,
    assetsPanelOpen: false,
    characterLibraryOpen: false,
    historyPanelOpen: false,
    dramaAssetsPanelOpen: false,
  }),
  openChatWithDraft: (draft) => set({
    chatOpen: true,
    chatComposerDraft: draft,
    settingsOpen: false,
    assetsPanelOpen: false,
    characterLibraryOpen: false,
    historyPanelOpen: false,
    dramaAssetsPanelOpen: false,
  }),
  clearChatComposerDraft: () => set({ chatComposerDraft: null }),
  setPendingAgentQuery: (query) => set({ pendingAgentQuery: query }),
  setHomeSkillsOpen: (open) => set({ homeSkillsOpen: open, ...(open ? { homeSkillCreateOpen: false } : {}) }),
  setHomeSkillsTab: (tab) => set({ homeSkillsTab: tab }),
  setHomeSkillCreateOpen: (open) => set({ homeSkillCreateOpen: open, ...(open ? { homeSkillsOpen: false } : {}) }),
  closeChat: () => set({ chatOpen: false }),
  toggleChat: () => set((s) => (s.chatOpen
    ? { chatOpen: false }
    : {
        chatOpen: true,
        settingsOpen: false,
        assetsPanelOpen: false,
        characterLibraryOpen: false,
        historyPanelOpen: false,
        dramaAssetsPanelOpen: false,
      })),
  setChatComposerLiveDraft: (draft) => set({ chatComposerLiveDraft: draft }),

  /* ── 官方 session state 的引用条 action（`ContextStrip`(`VL`) 用）── */
  setContextNodeIds: (ids) => set({ chatComposerContextNodeIds: [...ids] }),
  addContextNodeIds: (ids) => set((state) => ({
    chatComposerContextNodeIds: [
      ...state.chatComposerContextNodeIds,
      ...ids.filter((id) => !state.chatComposerContextNodeIds.includes(id)),
    ],
  })),
  removeContextNodeId: (id) => set((state) => ({
    chatComposerContextNodeIds: state.chatComposerContextNodeIds.filter((item) => item !== id),
  })),
  clearContextNodeIds: () => set({ chatComposerContextNodeIds: [] }),
  /* 官方 `L = () => { _S(canvasId); Gr.getState().enterMode(canvasId); }`（PAGE@758100）：
     进入「从画布添加」拾取模式；`IW` 浮条的 Exit / 点完自动退出都走 `exitInsertFromCanvasPick`。 */
  insertFromCanvasPickActive: false,
  enterInsertFromCanvasPick: () => set({ insertFromCanvasPickActive: true }),
  exitInsertFromCanvasPick: () => set({ insertFromCanvasPickActive: false }),
  setQuotedText: (text) => set({ chatComposerQuotedText: text }),
  clearQuotedText: () => set({ chatComposerQuotedText: null }),
  addAttachment: (attachment) => set((state) => (
    state.chatComposerAttachments.some((item) => item.src === attachment.src)
      ? state
      : { chatComposerAttachments: [...state.chatComposerAttachments, attachment] }
  )),
  removeAttachment: (src) => set((state) => ({
    chatComposerAttachments: state.chatComposerAttachments.filter((item) => item.src !== src),
  })),
  clearAttachments: () => set({ chatComposerAttachments: [] }),
  /** 官方 `l.setThinkingActivity(value, sessionId)`：本轮模型活动状态。 */
  setChatThinkingActivity: (value) => set({ chatThinkingActivity: value }),

  /* ── 官方 `setChatModelThinkingSettings`（`course-api-base-url-*.js`@192297 的 `The` + `_he`）──
     写内存 + 落 localStorage；key 与校验函数逐字对齐官方。 */
  setChatModelThinkingSettings: (modelId, settings) => set((state) => {
    if (!modelId) return state;
    const next = { ...state.chatModelThinkingSettings, [modelId]: settings };
    writeStoredThinkingSettings(next);
    return { chatModelThinkingSettings: next };
  }),

  // ==========================================
  // Conversation Actions
  // ==========================================

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) => {
    set((s) => ({ conversations: [...s.conversations, conversation] }));
    persistConv(conversation);
  },

  updateConversation: (id, partial) =>
    set((s) => {
      const updated = s.conversations.map((c) =>
        c.id === id ? { ...c, ...partial, updatedAt: Date.now() } : c,
      );
      const changed = updated.find((c) => c.id === id);
      if (changed) persistConv(changed);
      return { conversations: updated };
    }),

  removeConversation: (id) => {
    clearConversationFileGrants(id);
    // 停止该会话仍在后台运行的 Agent 任务，避免删除后继续产生副作用
    stopConversationAgentTasks(id);
    // 删除来源对话不删除已确认记忆，只标记来源不可用
    get().markConversationMemorySourceUnavailable(id);
    const removedConversation = get().conversations.find((conversation) => conversation.id === id);
    if (removedConversation) {
      clearPersistedActiveConversation(removedConversation.projectId, id);
    }
    set((s) => {
      const conv = s.conversations.find((c) => c.id === id);
      if (conv) {
        // 异步软删除（持久化到 IndexedDB）
        chatHistoryService.softDeleteConversation(conv).catch((e) =>
          console.warn('[chat] 软删除会话失败:', e),
        );
      }
      return {
        conversations: s.conversations.filter((c) => c.id !== id),
        activeConversationId:
          s.activeConversationId === id ? null : s.activeConversationId,
      };
    });
  },

  setActiveConversation: (id) => {
    if (id) {
      const state = get();
      const projectId = state.conversations.find((conversation) => conversation.id === id)?.projectId
        ?? (state.currentProjectId ? seriesOwnerId(state.projects, state.currentProjectId) : null);
      if (projectId) persistActiveConversation(projectId, id);
    }
    set({ activeConversationId: id });
  },

  createConversation: (projectId, title) => {
    // 会话按剧集项目归属：同一部剧的分集共用会话，普通项目归自己（seriesOwnerId 对普通项目是恒等）
    const ownerId = seriesOwnerId(get().projects, projectId);
    const id = `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const conversation: ChatConversation = {
      id,
      projectId: ownerId,
      title: title || '新对话',
      titleSource: title ? 'user' : 'auto',
      pinned: false,
      archived: false,
      // 「设置 → 权限」里的本机默认批准方式；未设置时保持原来的 'collaborative'
      agentMode: get().config.agentDefaultMode ?? 'collaborative',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
    set((s) => ({
      conversations: [...s.conversations, conversation],
      activeConversationId: id,
    }));
    persistActiveConversation(ownerId, id);
    persistConv(conversation);
    return id;
  },

  // ==========================================
  // 持久化 Actions
  // ==========================================

  loadConversationsForProject: async (projectId) => {
    try {
      // 会话按剧集项目归属：分集共用剧集的会话（seriesOwnerId 对普通项目是恒等）
      const ownerId = seriesOwnerId(get().projects, projectId);
      const conversations = await chatHistoryService.loadProjectConversations(ownerId);
      if (get().currentProjectId !== projectId) return;
      const persistedId = readPersistedActiveConversation(ownerId);
      const restoredConversation = conversations.find((conversation) =>
        conversation.id === persistedId) ?? conversations[0];
      set((state) => ({
        conversations,
        activeConversationId: restoredConversation?.id ?? null,
        messages: retainBackgroundTaskMessages(state),
        operationLogs: [],
      }));
      if (restoredConversation) {
        persistActiveConversation(ownerId, restoredConversation.id);
        await get().loadConversationMessages(restoredConversation.id);
      }
    } catch (e) {
      console.warn('[chat] 加载会话列表失败:', e);
    }
  },

  loadConversationMessages: async (conversationId) => {
    try {
      const { messages } = await chatHistoryService.loadMessages(conversationId, 0, 200);
      // 只保留当前展示的 conversationId 的消息（时序上切换后仍然可能收到旧异步结果）
      if (get().activeConversationId !== conversationId) return;
      set((state) => ({
        messages: [
          ...retainBackgroundTaskMessages(state, conversationId),
          ...messages,
        ],
      }));
    } catch (e) {
      console.warn('[chat] 加载消息失败:', e);
    }
  },

  repairInterruptedForProject: async (projectId) => {
    try {
      const affectedIds = await chatHistoryService.repairInterruptedMessages(projectId);
      if (affectedIds.length > 0) {
        console.log('[chat] 已修复中断消息，涉及会话:', affectedIds);
      }
    } catch (e) {
      console.warn('[chat] 修复中断消息失败:', e);
    }
  },

  // ==========================================
  // Message Actions
  // ==========================================

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => {
    set((s) => {
      const convId = message.conversationId;
      const conversations = convId
        ? s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messageCount: c.messageCount + 1,
                  lastMessageAt: message.timestamp,
                  lastMessagePreview:
                    message.content.slice(0, 60) + (message.content.length > 60 ? '…' : ''),
                  updatedAt: Date.now(),
                }
              : c,
          )
        : s.conversations;
      return {
        messages: [...s.messages, message],
        conversations,
      };
    });
    const projectId = resolveMessageProjectId(get(), message.conversationId);
    if (projectId) persistMsg(message, projectId);
  },

  updateMessage: (id, partial) => {
    cancelScheduledMessagePersist(id);
    let changed: ChatMessage | undefined;
    set((s) => {
      const result = mergeMessage(s.messages, id, partial);
      if (!result) return s;
      changed = result.changed;
      return { messages: result.messages };
    });
    if (changed) {
      const projectId = resolveMessageProjectId(get(), changed.conversationId);
      if (projectId) persistMsg(changed, projectId);
    }
  },

  updateMessageTransient: (id, partial) => {
    let changed = false;
    set((s) => {
      const result = mergeMessage(s.messages, id, partial);
      if (!result) return s;
      changed = true;
      return { messages: result.messages };
    });
    if (changed) scheduleMessagePersist(id, get);
  },

  clearMessages: () =>
    set((s) => {
      const convId = s.activeConversationId;
      if (convId) {
        chatHistoryService.clearConversationMessages(convId).catch((e) =>
          console.warn('[chat] 清空消息失败:', e),
        );
      }
      const conversations = convId
        ? s.conversations.map((c) =>
            c.id === convId
              ? { ...c, messageCount: 0, lastMessagePreview: undefined, updatedAt: Date.now() }
              : c,
          )
        : s.conversations;
      return { messages: [], conversations };
    }),

  setActiveRequestAbort: (ctrl) => set({ activeRequestAbort: ctrl }),
  setContextCompacting: (conversationId) => set({ contextCompactingConversationId: conversationId }),
  /* 官方 session store 的提问状态（`@43226` / `@43274` / `@44825`，逐字语义）：
       setPendingQuestion(n, o)              → pendingQuestion = n
       updatePendingQuestionStatus(n, o, r)  → { ...pendingQuestion, status: n, selectedAnswers: o ?? 旧的 }
       setPendingQuestionProgress(n, o, r)   → { ...pendingQuestion, collectedAnswers: n, step: o }
       clearPendingQuestion(n)               → pendingQuestion = null
       setMultiSelectDraft(n, o)             → multiSelectDraft = n
       clearMultiSelectDraft(n)              → multiSelectDraft = [] */
  setPendingQuestion: (question) => set({ pendingQuestion: question }),
  updatePendingQuestionStatus: (status) => set((s) => ({
    pendingQuestion: s.pendingQuestion
      ? { ...s.pendingQuestion, status, selectedAnswers: s.pendingQuestion.selectedAnswers }
      : null,
  })),
  setPendingQuestionProgress: (collectedAnswers, step) => set((s) => ({
    pendingQuestion: s.pendingQuestion
      ? { ...s.pendingQuestion, collectedAnswers, step }
      : null,
  })),
  clearPendingQuestion: () => set({ pendingQuestion: null, multiSelectDraft: [] }),
  setMultiSelectDraft: (labels) => set({ multiSelectDraft: labels }),
  clearMultiSelectDraft: () => set({ multiSelectDraft: [] }),

  enqueueMessage: (payload) => {
    /* 官方入队会把 queue item 的 `attachments / contextNodeIds / quotedText` 一起存下来，
       编辑时要原样搬回输入框（只存 text 会丢附件与引用）。 */
    const item: QueuedChatMessage = typeof payload === 'string'
      ? { id: createQueuedMessageId(), text: payload }
      : { id: createQueuedMessageId(), ...payload };
    set((s) => ({ messageQueue: [...s.messageQueue, item] }));
    return item;
  },

  dequeueMessage: () => {
    const state = get();
    if (state.messageQueue.length === 0) return undefined;
    const [head, ...tail] = state.messageQueue;
    set({ messageQueue: tail });
    return head;
  },

  /* 官方 `removeQueuedMessage(id)`（`course-api-base-url-*.js`@203062） */
  removeQueuedMessage: (id) =>
    set((s) => ({ messageQueue: s.messageQueue.filter((item) => item.id !== id) })),

  /* 官方 `reorderQueuedMessages(activeId, overId)`：把 active 挪到 over 的位置 */
  reorderQueuedMessages: (activeId, overId) =>
    set((s) => {
      const from = s.messageQueue.findIndex((item) => item.id === activeId);
      const to = s.messageQueue.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0 || from === to) return {};
      const next = [...s.messageQueue];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { messageQueue: next };
    }),

  clearMessageQueue: () => set({ messageQueue: [] }),

  // ==========================================
  // Operation Log Actions
  // ==========================================

  addOperationLog: (log) =>
    set((s) => ({ operationLogs: [...s.operationLogs, log] })),

  updateOperationLog: (id, partial) =>
    set((s) => ({
      operationLogs: s.operationLogs.map((l) =>
        l.id === id ? { ...l, ...partial } : l,
      ),
    })),

  clearOperationLogs: () => set({ operationLogs: [] }),

  // ==========================================
  // Revision Actions
  // ==========================================

  incrementRevision: () => {
    const state = get();
    const nextCanvas = state.canvasRevision + 1;
    const nextGlobal = state.globalCanvasRevision + 1;
    set({
      canvasRevision: nextCanvas,
      globalCanvasRevision: nextGlobal,
    });
    return nextCanvas;
  },

  getCurrentRevision: () => {
    const state = get();
    const project = state.projects.find((p: { id: string }) => p.id === state.currentProjectId);
    if (project?.revisionScope === 'global') {
      return state.globalCanvasRevision;
    }
    return state.canvasRevision;
  },

  setCanvasRevision: (rev) => set({ canvasRevision: rev }),
  setGlobalCanvasRevision: (rev) => set({ globalCanvasRevision: rev }),
});
