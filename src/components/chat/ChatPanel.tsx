/**
 * ChatPanel — 对话助手主面板
 *
 * 官方形态：**内嵌悬浮**在画布右侧的助手面板（没有独立窗口这一种）。
 * - 头部三颗：标题下拉 / 聊天记录 / 收起对话（见 ChatHeader）
 * - 消息区 + 底部输入卡（控制条里是「+ / 确认模式 / 模型 / 发送」）
 * - 左侧 4px 拖拽条（官方 SHARED 常量：min 360 / default 480 / max 视口 48%）
 * - 使用 framer-motion 控制打开/关闭动画
 *
 * 子组件：
 * - ChatHeader.tsx          Header 栏
 * - ChatMessages.tsx        消息列表区
 * - ChatInput.tsx           输入区 + 模型选择器
 * - MessageBubble.tsx       单条消息气泡
 * - EmptyChatState.tsx      空会话状态
 * - ChatModelSelector.tsx   模型选择器
 */
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import { generateId } from '../../store/store.utils';
import { AGENT_TERMINAL_STATUSES } from '../../types/agent';
import { selectChatTodoSnapshot } from '../../services/chat/todoTasks';
import ChatHeader from './ChatHeader';
import AgentArtifactPanel from './AgentArtifactPanel';
import ConversationMenu from './ConversationMenu';
import ConversationViewOnlyBanner from './ConversationViewOnlyBanner';
import { isLegacyConversation, isStarterReplayConversation } from './conversationMenuSpec';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import CanvasResourcePreviewDialog from './CanvasResourcePreviewDialog';
import { onCanvasResourcePreview } from '../../services/chat/canvasResourcePreview';
import { focusCanvasNode } from '../../services/chat/nodeLinkChipModel';
import { isReferenceableNodeType } from './referenceableNodes';
import {
  stopAgentTask,
} from '../../services/chat/agentRuntime';
import {
  cancelScheduledAgentExecution,
} from '../../services/chat/agentScheduler';
import { retryMediaArtifactPersist } from '../../services/ai/generationRuntime';
import {
  getAgentModeToast,
  resolveConversationAgentApproval,
  submitConversationMessage,
} from '../../services/chat/conversationExecutionController';
import {
  getMediaModelAvailability,
} from '../../services/chat/mediaModelAvailability';
import type { AgentApprovalResolution, AgentMode } from '../../types/agent';
import type { QueuedChatMessage } from '../../types/chat';
import { answerPendingQuestion } from '../../services/chat/askQuestionRuntime';
import { askQuestionLabel } from '../../services/chat/askQuestionStrings';
import { stripAskQuestionFreeTextLabel } from '../../services/chat/askQuestion';
import {
  getMediaModelOptions,
} from '../nodes/shared/defaultModels';
import {
  authorizeConversationFiles,
  listConversationFileGrants,
  revokeFileGrant,
  subscribeFileGrants,
} from '../../services/chat/fileGrantService';
import { getAssistantTextModelCandidates } from '../../services/projectSettingsService';
import { getLocale, useT } from '../../i18n';

const DRAFT_SYNC_DEBOUNCE_MS = 300;
/* ── 面板几何：官方 SHARED 常量块（`course-api-base-url-*.js`@416206..416252）逐字 ──
   min 360 · default 480 · max = innerWidth × 48% · 隐藏位 x 偏移 12px · 宽度持久化 key "canvas-chat-width" */
const CHAT_PANEL_DEFAULT_WIDTH = 480;
const CHAT_PANEL_MIN_WIDTH = 360;
const CHAT_PANEL_MAX_VIEWPORT_RATIO = 0.48;
const CHAT_PANEL_WIDTH_STORAGE_KEY = 'canvas-chat-width';
/** 官方收起态位移（SHARED@416252 `Blt=12`）：面板宽度收 0 + x 右移 12px。 */
const CHAT_PANEL_HIDDEN_X_OFFSET = 12;

/* 官方只有内嵌面板一种形态；MTV 原有的「独立窗口」镜像模式（detached* 一组 props）
   官方全树 0 命中（`chat_window` / `detachedChat` / `dock_window` 在官方产物里都不存在）⇒ 已整体移除。 */

export default function ChatPanel() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const {
    chatOpen,
    chatComposerDraft,
    closeChat,
    clearChatComposerDraft,
    activeConversationId,
    conversations,
    messages,
    agentTasks,
    currentProjectId,
    projects,
    createConversation,
    setActiveConversation,
    updateConversation,
    removeConversation,
    loadConversationMessages,
    showToast,
    assistantModelId,
    chatComposerContextNodeIds,
    chatComposerQuotedText,
    chatComposerAttachments,
    generalModels,
    providers,
    dreaminaLoggedIn,
    workflows,
    updateConfig,
    saveConfig,
    updateProjectSettings,
  } = useAppStore(
    useShallow((s) => ({
      chatOpen: s.chatOpen,
      chatComposerDraft: s.chatComposerDraft,
      closeChat: s.closeChat,
      clearChatComposerDraft: s.clearChatComposerDraft,
      activeConversationId: s.activeConversationId,
      conversations: s.conversations,
      messages: s.messages,
      agentTasks: s.agentTasks,
      currentProjectId: s.currentProjectId,
      projects: s.projects,
      createConversation: s.createConversation,
      setActiveConversation: s.setActiveConversation,
      updateConversation: s.updateConversation,
      removeConversation: s.removeConversation,
      loadConversationMessages: s.loadConversationMessages,
      showToast: s.showToast,
      assistantModelId: s.config.assistantModelId,
      /* 官方 session state 的引用条三条（`ContextStrip` 读） */
      chatComposerContextNodeIds: s.chatComposerContextNodeIds,
      chatComposerQuotedText: s.chatComposerQuotedText,
      chatComposerAttachments: s.chatComposerAttachments,
      generalModels: s.config.generalModels ?? [],
      providers: s.config.providers,
      dreaminaLoggedIn: !!s.config.dreaminaAuth?.loggedIn,
      workflows: s.workflows,
      updateConfig: s.updateConfig,
      saveConfig: s.saveConfig,
      updateProjectSettings: s.updateProjectSettings,
    })),
  );

  const effectiveConversations = conversations;
  const effectiveActiveConversationId = activeConversationId;
  const effectiveMessages = messages;
  const effectiveAgentTasks = agentTasks;
  const effectiveProjectId = currentProjectId;
  const currentProject = projects.find((item) => item.id === currentProjectId);
  const projectAssistantModelId = getAssistantTextModelCandidates(
    currentProject?.settings,
    assistantModelId,
  )[0];
  const effectiveAssistantModelId = projectAssistantModelId;
  /* 官方 `AgentModelPicker` 的 **Auto** 行是否选中 = 「用户没有显式指定助手模型」
     （`assistantModelId` 未设 且 项目 defaultModels.text 未设）——这与官方 `Xd()` 的
     「后端给了 enabled 的 auto 模型」在 MTV 侧的等价语义：交给候选解析器自动挑第一个可用候选。 */
  const assistantModelIsAuto = !assistantModelId && !currentProject?.settings?.defaultModels?.text;
  const effectiveGeneralModels = useMemo(() => generalModels, [generalModels]);
  const effectiveAssistantModelGroups = undefined;
  const mediaCatalogConfig = useMemo(() => ({
    providers,
    dreaminaAuth: { loggedIn: dreaminaLoggedIn },
  }), [dreaminaLoggedIn, providers]);
  const mediaModelOptions = useMemo(
    () => getMediaModelOptions(effectiveGeneralModels, mediaCatalogConfig, workflows),
    [effectiveGeneralModels, mediaCatalogConfig, workflows],
  );
  const localMediaModelAvailability = useMemo(
    () => getMediaModelAvailability(
      mediaModelOptions,
      generalModels,
      providers,
      dreaminaLoggedIn,
    ),
    [dreaminaLoggedIn, generalModels, mediaModelOptions, providers],
  );
  const effectiveMediaModelAvailability = localMediaModelAvailability;
  const effectiveActiveConversation = effectiveConversations.find(
    (conversation) => conversation.id === effectiveActiveConversationId,
  );
  /* 官方 `Pae` 的两条只读 banner 条件（@2778057 / @2778235）：
     · `tt = Pe.isLegacyReadOnly === true` ⇒ MTV 对位字段是 `ChatConversation.archived`
       （`conversationMenuSpec.isLegacyConversation`）；
     · `je = Ce||Be`，`ct = rb(xe)` 即**活跃会话 id 以 `starter-replay-` 开头**（`NY` @413776）。 */
  const activeConversationIsLegacyReadOnly = !!effectiveActiveConversation
    && isLegacyConversation(effectiveActiveConversation);
  const activeConversationIsStarterReplay = isStarterReplayConversation(effectiveActiveConversationId);
  const effectiveAgentMode = effectiveActiveConversation?.agentMode ?? 'collaborative';
  const activeConversationTask = effectiveAgentTasks.find(
    (task) => task.conversationId === effectiveActiveConversationId
      && ['planning', 'running', 'waiting_tool', 'waiting_approval'].includes(task.status),
  );
  const hasActiveConversationTask = !!activeConversationTask;

  const [inputValue, setInputValue] = useState('');
  const conversationDraftsRef = useRef(new Map<string, string>());
  const pendingConversationDraftRef = useRef<string | null>(null);
  /** 官方标题下拉（会话菜单）开关 */
  const [conversationsMenuOpen, setConversationsMenuOpen] = useState(false);
  const conversationTitleButtonRef = useRef<HTMLButtonElement | null>(null);
  /* 官方第 4 颗「聊天记录」是同一个会话下拉的第二个触发器（独立 open 状态，align: end）。 */
  const [historyMenuOpen, setHistoryMenuOpen] = useState(false);
  const historyButtonRef = useRef<HTMLButtonElement | null>(null);
  /** 官方头部第 1 颗 sidePanel 打开的面板（artifact / 头脑风暴），停靠在本面板左侧。 */
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const [artifactPanelHasUnread, setArtifactPanelHasUnread] = useState(false);
  /**
   * 官方 `uIt` @4562757 的 `[p,m]=a.useState(null)` —— 宿主桥 `focusCanvasNodes` 塞进来的 nodeId。
   * `p !== null` 就渲染「画布素材预览」对话框（`CanvasResourcePreviewDialog.tsx`）。
   * 官方 `focusCanvasNodes:C=>m(C[0]??null)` 只取**第一个** id、且**不校验存在性**。
   */
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  /** 官方 `D`（hover）/ `j`（拖拽中）：左缘拖拽条的指示条显隐。 */
  const [chatResizeHover, setChatResizeHover] = useState(false);
  const [chatPanelResizing, setChatPanelResizing] = useState(false);
  const chatPanelRef = useRef<HTMLElement | null>(null);
  /** 面板宽度（px）——官方是 motion `animate={{width,minWidth}}` 的数值，不是 CSS 变量。 */
  const [panelWidth, setPanelWidth] = useState(CHAT_PANEL_DEFAULT_WIDTH);
  const preferredChatPanelWidthRef = useRef(CHAT_PANEL_DEFAULT_WIDTH);
  const chatPanelWidthInitializedRef = useRef(false);

  /** 官方：max = `window.innerWidth * 48%`，下限不破 min。 */
  const maxChatPanelWidth = useCallback((): number => (
    Math.max(CHAT_PANEL_MIN_WIDTH, Math.round(window.innerWidth * CHAT_PANEL_MAX_VIEWPORT_RATIO))
  ), []);

  const applyDockedChatPanelWidth = useCallback((preferredWidth: number) => {
    const width = Math.min(
      maxChatPanelWidth(),
      Math.max(CHAT_PANEL_MIN_WIDTH, preferredWidth),
    );
    setPanelWidth(Math.round(width));
  }, [maxChatPanelWidth]);

  useEffect(() => {
    if (!chatOpen) return;
    const panel = chatPanelRef.current;
    if (!panel) return;

    if (!chatPanelWidthInitializedRef.current) {
      /* 官方把宽度存在 localStorage 的 `canvas-chat-width`（SHARED@416026）。 */
      let restored = CHAT_PANEL_DEFAULT_WIDTH;
      try {
        const raw = globalThis.localStorage?.getItem(CHAT_PANEL_WIDTH_STORAGE_KEY);
        const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
        if (Number.isFinite(parsed) && parsed > 0) restored = parsed;
      } catch {
        /* localStorage 不可用时退回默认宽度 */
      }
      preferredChatPanelWidthRef.current = Math.min(
        maxChatPanelWidth(),
        Math.max(CHAT_PANEL_MIN_WIDTH, restored),
      );
      chatPanelWidthInitializedRef.current = true;
    }

    const syncWidthToViewport = () => {
      applyDockedChatPanelWidth(preferredChatPanelWidthRef.current);
    };
    syncWidthToViewport();
    window.addEventListener('resize', syncWidthToViewport);
    return () => window.removeEventListener('resize', syncWidthToViewport);
  }, [applyDockedChatPanelWidth, chatOpen, maxChatPanelWidth]);

  useEffect(() => () => {
    document.body.classList.remove('cursor-col-resize', 'select-none');
  }, []);

  const handleChatPanelResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const panel = chatPanelRef.current;
    if (!panel) return;
    event.preventDefault();
    /* 官方 `FF`：`document.body.classList.add('cursor-col-resize','select-none')`，
       鼠标移动/抬起都挂在 `document` 上（拖拽条只有 4px 宽，靠 pointer capture 会丢）。 */
    const startWidth = panel.getBoundingClientRect().width;
    const startX = event.clientX;
    setChatPanelResizing(true);
    document.body.classList.add('cursor-col-resize', 'select-none');
    const onMove = (moveEvent: MouseEvent) => {
      const preferredWidth = Math.min(
        maxChatPanelWidth(),
        Math.max(CHAT_PANEL_MIN_WIDTH, startWidth + startX - moveEvent.clientX),
      );
      preferredChatPanelWidthRef.current = preferredWidth;
      applyDockedChatPanelWidth(preferredWidth);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('cursor-col-resize', 'select-none');
      setChatPanelResizing(false);
      /* 官方把最终宽度写回 `canvas-chat-width`（PAGE@1008621）。 */
      try {
        globalThis.localStorage?.setItem(
          CHAT_PANEL_WIDTH_STORAGE_KEY,
          String(Math.round(preferredChatPanelWidthRef.current)),
        );
      } catch {
        /* 持久化失败不影响本次拖拽结果 */
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [applyDockedChatPanelWidth, maxChatPanelWidth]);
  const [, setFileGrantVersion] = useState(0);
  useEffect(() => subscribeFileGrants(
    () => setFileGrantVersion((version) => version + 1),
  ), []);
  const effectiveLocalFileGrants = effectiveActiveConversationId
    ? listConversationFileGrants(effectiveActiveConversationId)
    : [];

  // 草稿只在切换窗口时用得上，逐键写 Store / 发 IPC 是白扔的开销，防抖到停手后再同步一次
  const draftSyncRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    value: string | null;
  }>({ timer: null, value: null });

  const flushDraftSync = useCallback(() => {
    const pending = draftSyncRef.current;
    if (pending.timer) clearTimeout(pending.timer);
    pending.timer = null;
    if (pending.value == null) return;
    const value = pending.value;
    pending.value = null;
    useAppStore.getState().setChatComposerLiveDraft(value);
  }, []);

  const queueDraftSync = useCallback((value: string) => {
    const pending = draftSyncRef.current;
    pending.value = value;
    if (pending.timer) return;
    pending.timer = setTimeout(() => {
      pending.timer = null;
      flushDraftSync();
    }, DRAFT_SYNC_DEBOUNCE_MS);
  }, [flushDraftSync]);

  // 关窗时 React 的清理未必来得及跑，beforeunload 兜住草稿
  useEffect(() => {
    window.addEventListener('beforeunload', flushDraftSync);
    return () => {
      window.removeEventListener('beforeunload', flushDraftSync);
      flushDraftSync();
    };
  }, [flushDraftSync]);

  const updateInputDraft = useCallback((value: string) => {
    setInputValue(value);
    queueDraftSync(value);
    if (!effectiveActiveConversationId) return;
    if (value) conversationDraftsRef.current.set(effectiveActiveConversationId, value);
    else conversationDraftsRef.current.delete(effectiveActiveConversationId);
  }, [effectiveActiveConversationId, queueDraftSync]);

  useEffect(() => {
    if (effectiveActiveConversationId && pendingConversationDraftRef.current != null) {
      const pendingDraft = pendingConversationDraftRef.current;
      pendingConversationDraftRef.current = null;
      conversationDraftsRef.current.set(effectiveActiveConversationId, pendingDraft);
      setInputValue(pendingDraft);
      return;
    }
    setInputValue(effectiveActiveConversationId
      ? (conversationDraftsRef.current.get(effectiveActiveConversationId) ?? '')
      : '');
  }, [effectiveActiveConversationId]);

  // 面板首次接管时把上一轮留下的草稿灌一次，之后本地编辑
  const draftHandoffRef = useRef(false);
  useEffect(() => {
    if (draftHandoffRef.current) return;
    draftHandoffRef.current = true;
    const draft = useAppStore.getState().chatComposerLiveDraft;
    if (!draft) return;
    // 灌草稿是一次性同步，放到下一帧异步执行，避免在 effect 内同步 setState 引发级联渲染
    const frame = requestAnimationFrame(() => updateInputDraft(draft));
    return () => cancelAnimationFrame(frame);
  }, [updateInputDraft]);

  const handleTextModelChange = useCallback((modelId?: string) => {
    if (currentProject) {
      void updateProjectSettings({
        ...currentProject.settings,
        defaultModels: {
          ...currentProject.settings?.defaultModels,
          text: modelId,
        },
      });
    } else {
      updateConfig({ assistantModelId: modelId });
      void saveConfig({ silent: true });
    }
  }, [currentProject, saveConfig, updateConfig, updateProjectSettings]);

  /** 官方 Auto 行点击 = 清掉「显式指定」，回到自动挑候选。 */
  const handleAssistantModelAuto = useCallback(() => {
    if (currentProject) {
      const { text: _dropped, ...restDefaults } = currentProject.settings?.defaultModels ?? {};
      void updateProjectSettings({
        ...currentProject.settings,
        defaultModels: restDefaults,
      });
    }
    updateConfig({ assistantModelId: undefined });
    void saveConfig({ silent: true });
  }, [currentProject, saveConfig, updateConfig, updateProjectSettings]);

  const handleAgentModeChange = useCallback((mode: AgentMode) => {
    if (!effectiveActiveConversationId || mode === effectiveAgentMode) return;
    updateConversation(effectiveActiveConversationId, { agentMode: mode });
    showToast(getAgentModeToast(mode), 'info');
  }, [
    effectiveActiveConversationId,
    effectiveAgentMode,
    showToast,
    updateConversation,
  ]);

  // ── 消息过滤 ──
  const conversationMessages = effectiveActiveConversationId
    ? effectiveMessages.filter((m) => m.conversationId === effectiveActiveConversationId)
    : [];

  // ── 会话操作 ──
  const handleNewConversation = useCallback(() => {
    if (!effectiveProjectId) return;
    createConversation(effectiveProjectId);
  }, [effectiveProjectId, createConversation]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversation(id);
      loadConversationMessages(id);
    },
    [setActiveConversation, loadConversationMessages],
  );

  /* 官方会话下拉里的两个操作：重命名 / 删除（官方只有这两个）。 */
  const handleRenameConversation = useCallback((id: string, title: string) => {
    updateConversation(id, { title, titleSource: 'user' });
  }, [updateConversation]);

  const handleDeleteConversation = useCallback((id: string) => {
    removeConversation(id);
  }, [removeConversation]);

  const handleToggleConversationMenu = useCallback(() => {
    setConversationsMenuOpen((open) => !open);
  }, []);

  const closeConversationMenu = useCallback(() => setConversationsMenuOpen(false), []);
  const handleToggleHistoryMenu = useCallback(() => {
    setHistoryMenuOpen((open) => !open);
  }, []);
  const closeHistoryMenu = useCallback(() => setHistoryMenuOpen(false), []);

  const handleExampleClick = useCallback((text: string) => {
    if (!effectiveActiveConversationId && effectiveProjectId) {
      pendingConversationDraftRef.current = text;
      handleNewConversation();
      setInputValue(text);
      return;
    }
    updateInputDraft(text);
  }, [effectiveActiveConversationId, effectiveProjectId, handleNewConversation, updateInputDraft]);

  useEffect(() => {
    if (!chatComposerDraft || !effectiveProjectId) return;
    let focusFrame = 0;
    const draftFrame = requestAnimationFrame(() => {
      handleExampleClick(chatComposerDraft);
      clearChatComposerDraft();
      focusFrame = requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('chat-focus-composer'));
      });
    });
    return () => {
      cancelAnimationFrame(draftFrame);
      if (focusFrame) cancelAnimationFrame(focusFrame);
    };
  }, [
    chatComposerDraft,
    clearChatComposerDraft,
    effectiveProjectId,
    handleExampleClick,
  ]);

  const handleAddMediaToCanvas = useCallback((messageId: string) => {
    const store = useAppStore.getState();
    const message = store.messages.find((item) => item.id === messageId);
    if (!message?.mediaResult) return;

    store.updateMessage(messageId, { canvasStatus: 'pending', canvasError: undefined });
    try {
      const nodeId = store.materializeMediaArtifact(message.mediaResult);
      store.updateMessage(messageId, {
        canvasStatus: 'created',
        canvasNodeId: nodeId,
        canvasError: undefined,
      });
      store.showToast(t('已添加到画布'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('添加节点失败');
      store.updateMessage(messageId, { canvasStatus: 'failed', canvasError: errorMessage });
      store.showToast(errorMessage, 'error');
    }
  }, [t]);

  /**
   * 生成完成的图片/视频**自动落画布**（官方行为）。
   * 用户 2026 实测：「不是应该直接在画布上自动生成图卡吗？」——原来只有当模型把
   * `deliveryMode` 选成 `canvas/both` 才会自动建卡，选 `chat` 就只剩一颗「添加到画布」按钮，
   * 而官方那条消息里**没有**这颗按钮：结果总是直接落到画布上，对话里只留卡片 + mention。
   * ⇒ 这里对「已生成、还没上画布（`canvasStatus === 'none'`）」的消息补一次自动落地。
   * 幂等：`handleAddMediaToCanvas` 会先把状态置 `pending` 再置 `created/failed`，
   * 并且用 `autoAddedRef` 兜住同一 tick 内的重复触发。
   */
  const autoAddedRef = useRef<Set<string>>(new Set());
  const autoAddMediaToCanvas = useCallback((messageId: string) => {
    if (autoAddedRef.current.has(messageId)) return;
    const message = useAppStore.getState().messages.find((item) => item.id === messageId);
    if (!message?.mediaResult || message.canvasStatus !== 'none') return;
    autoAddedRef.current.add(messageId);
    handleAddMediaToCanvas(messageId);
  }, [handleAddMediaToCanvas]);


  /* 自动落画布：消息列表一变就扫一遍「已生成但还没上画布」的（幂等，见 `autoAddMediaToCanvas`）。 */
  useEffect(() => {
    for (const item of messages) {
      if (item.role !== 'assistant') continue;
      if (!item.mediaResult) continue;
      if (item.mediaStatus === 'queued' || item.mediaStatus === 'generating') continue;
      if (item.canvasStatus !== 'none') continue;
      autoAddMediaToCanvas(item.id);
    }
  }, [autoAddMediaToCanvas, messages]);

  const handleRetryMediaSave = useCallback(async (messageId: string) => {
    const store = useAppStore.getState();
    const message = store.messages.find((item) => item.id === messageId);
    if (!message?.mediaResult) return;

    try {
      const artifact = await retryMediaArtifactPersist(
        message.mediaResult,
        store.currentProjectId,
      );
      const currentStore = useAppStore.getState();
      currentStore.updateMessage(messageId, { mediaResult: artifact });
      if (message.canvasNodeId) {
        currentStore.settleMediaPlaceholder(message.canvasNodeId, artifact);
      }
      currentStore.showToast(t('产物已保存到项目'));
    } catch (error) {
      useAppStore.getState().showToast(
        error instanceof Error ? error.message : t('保存失败'),
        'error',
      );
    }
  }, [t]);

  const handleResolveApproval = useCallback((
    approvalId: string,
    resolution: AgentApprovalResolution,
  ) => {
    if (!resolveConversationAgentApproval(approvalId, resolution)) {
      showToast(t('该确认已过期，请重新发起操作'), 'info');
    }
  }, [showToast, t]);

  /* 「滚到最新」= 滚**滚动容器自己**到底，不是把某个子节点 `scrollIntoView`。
     官方依据（`vendor-libs-D64ouk08.js` 的 `use-stick-to-bottom`，hook `TYa` @911104）逐字：
     ```js
     get targetScrollTop(){return!m.current||!y.current?0:m.current.scrollHeight-1-m.current.clientHeight}   // @911829
     ```
     ——`m` = `scrollRef`（滚动容器），`y` = `contentRef`（内容层）；官方 `scrollToBottom()` 写的就是容器自己的
     `scrollTop`（同文件 @911732：`set scrollTop(M){m.current&&(m.current.scrollTop=M,…)}`）。
     聊天列表的官方配置（`vendor-packages-JNk8f0_N.js` 的 IM @177345 / NM @177573 逐字）：
     ```js
     IM=({className:e,...t})=>a.jsx(Zg,{className:I("relative flex-1 overflow-y-hidden",e),initial:"smooth",resize:"smooth",role:"log",...t}),
     NM=({className:e,...t})=>{const{isAtBottom:n,scrollToBottom:s}=$g(),r=d.useCallback(()=>{s()},[s]);return!n&&a.jsx(fe,{className:I("absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full",e),onClick:r,size:"icon",type:"button",variant:"outline",...t,children:a.jsx(W1,{className:"size-4"})})},O
     ```
     ——`Zg` = `StickToBottom`，`$g` = `useStickToBottomContext`；官方圆钮点下去只调 `scrollToBottom()`。
     ⚠️ 这里以前是 `.lastElementChild?.scrollIntoView({behavior:'smooth'})`：官方四层壳（`ChatMessages` ③
     内容层 `gap-4 p-5 pb-0 pr-14`）让 `lastElementChild` = **整段内容的包裹层**，而 `scrollIntoView` 没给 `block`
     ⇒ 默认 `start` ⇒ 把整段内容的**顶边**对到视口顶边 = **滚回对话最开头**。生成中每个正文 flush 都走
     本文件 `submitConversationMessage({… onProgress: scrollToBottom})`（源头 `conversationExecutionController.ts:159`
     的 `onProgress?.()`），于是刚点完「回到最新消息」约 100ms 就被拽回旧内容。
     真机 Chromium（Edge 150）实测：容器 `scrollTop` 8900（底部）→ **19**（开头）。 */
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      const container = document.querySelector<HTMLElement>('.chat-panel-messages');
      if (!container) return;
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  const agentControls = useMemo(() => ({
    onResolveApproval: handleResolveApproval,
    mediaModelOptions,
    mediaModelAvailability: effectiveMediaModelAvailability,
    /* 官方只有「停止」这一项任务控制（暂停/继续/跳过/重新规划/回退画布修改官方都没有）。 */
    onStop: (taskId: string) => {
      cancelScheduledAgentExecution(taskId);
      stopAgentTask(taskId);
      showToast(t('已停止任务'), 'info');
    },
  }), [
    effectiveMediaModelAvailability,
    handleResolveApproval,
    mediaModelOptions,
    showToast,
    t,
  ]);

  /* 官方「+」菜单里的「添加本地文件夹」（桌面端）→ MTV 的本地读取授权入口。 */
  const handleAuthorizeLocalFiles = useCallback(() => {
    if (!effectiveActiveConversationId) return;
    void authorizeConversationFiles(effectiveActiveConversationId)
      .then((created) => {
        showToast(
          created.length > 0 ? t('已授权 {count} 个文件', { count: created.length }) : t('未新增文件授权'),
          'info',
        );
      })
      .catch((error) => showToast(
        error instanceof Error ? error.message : t('文件授权失败'),
        'error',
      ));
  }, [effectiveActiveConversationId, showToast, t]);

  const handleRevokeLocalFile = useCallback((grantId: string) => {
    if (!effectiveActiveConversationId) return;
    revokeFileGrant(effectiveActiveConversationId, grantId);
  }, [effectiveActiveConversationId]);

  // ── 发送消息 ──
  const sendMessageText = useCallback((
    content: string,
    /* 官方 `dequeueMessage` 补发 / 编辑回填时，附件与引用随队列项一起还原。 */
    queued?: Pick<QueuedChatMessage, 'attachments' | 'contextNodeIds' | 'quotedText'>,
  ) => {
    const text = content.trim();
    if (!text || !effectiveActiveConversationId) return;

    submitConversationMessage({
      content: text,
      projectId: effectiveProjectId ?? '',
      conversationId: effectiveActiveConversationId,
      mode: effectiveAgentMode,
      /* 官方 `bZ({brainstormPrefix, contextNodeIds, quotedText, rawInput, sourceInput})`：
         引用文本 / 引用节点 / 附件随本轮一起发出。 */
      quotedText: (queued?.quotedText ?? chatComposerQuotedText) ?? undefined,
      contextNodeIds: queued?.contextNodeIds ?? chatComposerContextNodeIds,
      attachments: queued?.attachments ?? chatComposerAttachments,
      onProgress: scrollToBottom,
    });
    /* 官方发送后 `clearContextNodeIds / clearQuotedText / clearAttachments`。 */
    const store = useAppStore.getState();
    store.clearContextNodeIds();
    store.clearQuotedText();
    store.clearAttachments();
    updateInputDraft('');
    scrollToBottom();
  }, [
    effectiveActiveConversationId,
    effectiveAgentMode,
    effectiveProjectId,
    scrollToBottom,
    updateInputDraft,
    chatComposerQuotedText,
    chatComposerContextNodeIds,
    chatComposerAttachments,
  ]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    /* ══ 官方 @2724686（`vendor-pkg-canvas-ChpWx5JY.js` 逐字）══
       ```js
       if(!We && de.pendingQuestion?.status==="pending" && (pt||ot)){
         const bn=de.pendingQuestion.toolUseId,
               hn=pt ? Rlt(lt, u("chatAdapter.askQuestion.freeText","")) : "";
         if(pt && !hn){ ne.error(u("chatAdapter.askQuestion.emptyFreeText","Enter your answer first.")); tt(!1); return }
         J.setInputValue("",ee); J.clearMultiSelectDraft(ee); J.clearPendingSuggestionContext(ee);
         await Ve(bn,{labels: ot?de.multiSelectDraft:void 0, freeText: hn},ee); tt(!1); return }
       ```
       其中 `ot = de.multiSelectDraft.length>0`、`pt = lt.trim().length>0`（@2723314/@2723404），
       `Rlt=(e,t)=>{…}`（@2720270）把「我另有想法」这类**预填标签**连同其后的 `:` / `：` 前缀剥掉。
       ⇒ **有待答问题时，发送键 = 提交答案**（composer 文本当自由回答 + 多选草稿当选项），
       而不是发一条新消息。MTV 原来完全没有这条分支（那两串文案早就移植在
       `askQuestionStrings`，但无人使用）。 */
    const sendStore = useAppStore.getState();
    const pendingQuestionNow = sendStore.pendingQuestion;
    const hasFreeText = text.length > 0;
    const hasDraftLabels = sendStore.multiSelectDraft.length > 0;
    /* 会话戳不匹配 ⇒ 这条提问**不属于当前会话**（官方 per-session 语义），发送键按普通消息走。 */
    const pendingQuestionIsHere = pendingQuestionNow?.status === 'pending'
      && pendingQuestionNow.conversationId === effectiveActiveConversationId;
    if (pendingQuestionIsHere && (hasFreeText || hasDraftLabels)) {
      const freeText = hasFreeText
        ? stripAskQuestionFreeTextLabel(inputValue, askQuestionLabel('freeText', getLocale()))
        : '';
      if (hasFreeText && !freeText) {
        showToast(askQuestionLabel('emptyFreeText', getLocale()), 'error');
        return;
      }
      updateInputDraft('');
      answerPendingQuestion(pendingQuestionNow.toolUseId, {
        labels: hasDraftLabels ? sendStore.multiSelectDraft : [],
        freeText: freeText || undefined,
      });
      sendStore.clearMultiSelectDraft();
      return;
    }
    if (!text) return;
    /* 官方（`page-BeI7xydN.js`@979728）：助手正在生成、或队列里已经有消息时，
       新输入**进队列**而不是打断当前回合。 */
    const store = useAppStore.getState();
    if (hasActiveConversationTask || store.messageQueue.length > 0) {
      /* 官方入队会把附件 / 引用节点 / 引用文本一起存进队列项。 */
      store.enqueueMessage({
        text,
        attachments: chatComposerAttachments,
        contextNodeIds: chatComposerContextNodeIds,
        quotedText: chatComposerQuotedText ?? undefined,
      });
      store.clearContextNodeIds();
      store.clearQuotedText();
      store.clearAttachments();
      updateInputDraft('');
      return;
    }
    sendMessageText(text);
  }, [
    effectiveActiveConversationId,
    hasActiveConversationTask,
    inputValue,
    showToast,
    sendMessageText,
    updateInputDraft,
    chatComposerAttachments,
    chatComposerContextNodeIds,
    chatComposerQuotedText,
  ]);

  /* ── 首页输入条「发一句就开始」的消费端 ──────────────────────────────
     官方证据：`index-bundle.js` @1425705 `Sz` 把 `agent_query` 放进 navigateState，
     @1599900 的消费侧从**全局状态**取 `{agentQuery, starterWideAgentPanel}`，随后
     `/canvas/{id}?chat_mode=agent` 打开 agent 面板并**自动发出这一句**（不是只预填）。
     MTV 没有路由 ⇒ `WorkspaceHome` 写 `pendingAgentQuery`，这里在画布会话就绪后发出：
       · 已经有活动会话 ⇒ 直接发；
       · 还没有会话（刚新建的空项目）⇒ 先建会话，等它变成活动会话再发（`pendingAgentSendRef`）。 */
  const pendingAgentQuery = useAppStore((state) => state.pendingAgentQuery);
  const pendingAgentSendRef = useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveProjectId) return;
    /* 一律推迟一帧再动作：effect 体内直接 setState 会被 `react-hooks/set-state-in-effect` 拦，
       也会在首次挂载时和面板自身的初始化撞车（草稿一次性灌入是同样的写法）。 */
    const frame = requestAnimationFrame(() => {
      const store = useAppStore.getState();
      const query = store.pendingAgentQuery;
      if (query) {
        if (!effectiveActiveConversationId) {
          pendingAgentSendRef.current = query;
          store.setPendingAgentQuery(null);
          handleNewConversation();
          return;
        }
        store.setPendingAgentQuery(null);
        updateInputDraft(query);
        sendMessageText(query);
        return;
      }
      const queued = pendingAgentSendRef.current;
      if (!queued || !effectiveActiveConversationId) return;
      pendingAgentSendRef.current = null;
      updateInputDraft(queued);
      sendMessageText(queued);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    pendingAgentQuery,
    effectiveProjectId,
    effectiveActiveConversationId,
    handleNewConversation,
    sendMessageText,
    updateInputDraft,
  ]);

  /* 官方排队条：当前回合跑完后自动发队首那条（队列非空时新输入也继续排队）。
     推迟一个宏任务再发，避免在 effect 体里同步改状态（也会被 lint 拦）。 */
  const messageQueue = useAppStore((state) => state.messageQueue);
  /** 官方 `compact` 的 `phase:"started"` 生产者（§6 #14 后半）：正在压缩上下文的会话 id。 */
  const contextCompactingConversationId = useAppStore((state) => state.contextCompactingConversationId);
  /** 官方 `pendingQuestion`（`ask_question` 工具的生产者写入）：提问面板 + 摘要卡都读它。 */
  const pendingQuestion = useAppStore((state) => state.pendingQuestion);
  /**
   * 官方 `Qie`(`AskQuestionSheet`) 的 `onAnswer(toolUseId, {labels, freeText})` 宿主实现
   * （= 官方 `chatAdapter.answerQuestion` / `Ve` @2717400 的非数组分支，见 `answerPendingQuestion`）：
   * 面板一次显示一题、点「下一题」就回调一次 —— 答案写回 `collectedAnswers`；
   * 还有下一题 ⇒ `setPendingQuestionProgress(collected, step + 1)`（面板跳到下一题，**工具继续等**）；
   * 已是最后一题 ⇒ 先 `updatePendingQuestionStatus("answered")`（官方同款状态迁移），
   * 再唤醒等待中的 `ask_question` 工具；会话态由工具自己的 `finally` 清掉。
   */
  const handleAnswerQuestion = useCallback((
    toolUseId: string,
    answer: { labels: string[]; freeText?: string },
  ) => {
    answerPendingQuestion(toolUseId, answer);
  }, []);
  useEffect(() => {
    if (hasActiveConversationTask || messageQueue.length === 0) return undefined;
    const timer = window.setTimeout(() => {
      const next = useAppStore.getState().dequeueMessage();
      if (next) {
        sendMessageText(next.text, {
          attachments: next.attachments,
          contextNodeIds: next.contextNodeIds,
          quotedText: next.quotedText,
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hasActiveConversationTask, messageQueue, sendMessageText]);

  /* 官方「停止生成」：走任务控制器（`agentControls.onStop`）。 */
  const handleStopActiveTask = useCallback(() => {
    if (activeConversationTask) agentControls.onStop(activeConversationTask.id);
  }, [activeConversationTask, agentControls]);

  /* 官方 `A`（队列项的编辑回调）：把 `text + attachments + contextNodeIds + quotedText` **全部**
     搬回输入框；队列项的移除由 `QueuedMessagesBar` 按官方顺序（先搬回、再 remove）完成。 */
  const handleEditQueuedMessage = useCallback((item: QueuedChatMessage) => {
    updateInputDraft(item.text);
    const store = useAppStore.getState();
    for (const attachment of item.attachments ?? []) store.addAttachment(attachment);
    if ((item.contextNodeIds?.length ?? 0) > 0) store.setContextNodeIds(item.contextNodeIds ?? []);
    if (item.quotedText) store.setQuotedText(item.quotedText);
    window.dispatchEvent(new CustomEvent('chat-focus-composer'));
  }, [updateInputDraft]);

  const handleEditMessage = useCallback((content: string) => {
    updateInputDraft(content);
    window.dispatchEvent(new CustomEvent('chat-focus-composer'));
  }, [updateInputDraft]);

  const handleRegenerateMessage = useCallback((content: string) => {
    sendMessageText(content);
  }, [sendMessageText]);

  /* 官方 `qae`(`AgentErrorBanner`) 的 `onRetry`：重跑这一轮失败的请求 ——
     找到该 assistant 消息之前最近的一条 user 消息，原样重发（官方也是在错误横幅上重跑本轮）。 */
  const handleRetryMessage = useCallback((messageId: string) => {
    const list = useAppStore.getState().messages;
    const index = list.findIndex((item) => item.id === messageId);
    if (index < 0) return;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const candidate = list[cursor];
      if (candidate.role === 'user' && candidate.content.trim()) {
        sendMessageText(candidate.content);
        return;
      }
    }
  }, [sendMessageText]);

  /**
   * ⚠️ 官方事实更正（原注释「节点不存在 → toast」**不是**官方语义）：
   * 官方 `jc()`@152784 的宿主桥在**画布页**被 `uIt`@4562700 实现为
   * `focusCanvasNodes: C => m(C[0] ?? null)` —— `m` 恒被调用、**不查节点是否存在**；
   * 取不到时弹窗标题退化成 nodeId（`String(u(p??"")?.data?.title ?? p ?? "")`）、
   * 正文退化成文本分支（`String(n.text ?? n.content ?? "在画布中查看此素材。")`）。
   * ⇒ 官方**没有**任何 toast；这里按官方照做（去掉原来的 `引用的节点已不存在` 拦截）。
   *
   * 官方这条桥的调用点覆盖：`@`mention（prompt 引用）/ 生成确认卡的引用缩略图 /
   * 工具行 chip（`DF`）/ `MessageBubble` 的「在画布上查看」——
   * MTV 侧它们**统一**经 `onNodeActivate` 进来（`ChatMessages` → `ChatMarkdown` / 各确认卡）。
   */
  const handleNodeActivate = useCallback((nodeId: string) => {
    /* ★ 官方**主画布页**里，提及 chip 的点击出口就是 `ID` 的 `w`：
         `const {fitView: v} = jc(); v({nodes:[{id: n}], ...jwe})`，`jwe = {padding:1, maxZoom:2, minZoom:.5, duration:500}`
       —— 把镜头居中并放大到该节点（用户口径：「两个 chip 点击都可以自动定位到相关卡片到画布中央」）。
       ⚠️ **不弹「画布素材预览」框**。官方那个 `focusCanvasNodes` 宿主桥只存在于 **Studio 嵌画布**那条路
         （`uIt`@4562700 的 Provider 在 `StudioAgentPanel` 里），主画布页**没有**这条桥
         ⇒ `jc()` 里 `if(!n) return e(r)` 会走真正的 `fitView`。
         真机实测（CDP 9222，真鼠标点击官方「可爱的小猫」chip）：无弹窗、无 popper，
         镜头若已在位则**看不出变化**（这正是「只有 fitView、没有弹窗」的表现）。
         我上一轮把两条路都做了（居中 + 弹窗），弹窗那半是多出来的，已去掉。 */
    focusCanvasNode(nodeId);
  }, []);

  /** 官方 `onOpenChange: C => !C && m(null)` 的 `m(null)` 那半边（✕ / Esc / 点遮罩）。 */
  const handlePreviewNodeClose = useCallback(() => {
    setPreviewNodeId(null);
  }, []);

  /**
   * 官方底部 `Kme`(react-router `Link`) 的 MTV 等价物（本仓库**没有 router**）：
   * 关掉预览对话框 + 复用既有的 `canvas-focus-node` 事件把该节点聚焦到画布
   * （`Canvas.tsx` @1407 `handleSingleNodeFocus` → `focusNodes([id],{maxZoom:1,duration:400})`）。
   */
  const handlePreviewOpenInCanvas = useCallback((nodeId: string) => {
    setPreviewNodeId(null);
    window.dispatchEvent(new CustomEvent('canvas-focus-node', { detail: { nodeId } }));
  }, []);

  /* 官方同一条 `jc()` 桥的**其它**入口（拿不到上面这个 `onNodeActivate` 的调用点，
     例：`ChatReferenceText` 未注入 handler 时的默认分支）通过 window 事件送进来。 */
  useEffect(() => onCanvasResourcePreview(setPreviewNodeId), []);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    useAppStore.getState().setHoveredMentionNodeId(nodeId);
  }, []);

  const handleModelActivate = useCallback((modelId: string) => {
    window.dispatchEvent(new CustomEvent('chat-open-reference-menu', {
      detail: { kind: 'model', modelId },
    }));
  }, []);

  /* 官方 `onMessageFeedback(messageId, 'up' | 'down')`：MTV 把评价落在消息上（本地，无服务端上报）。 */
  const handleMessageFeedback = useCallback((messageId: string, vote: 'up' | 'down') => {
    useAppStore.getState().updateMessage(messageId, { feedback: vote });
  }, []);

  /* 官方 `onMessageFork(messageId)`：在新会话里继续（服务端做的是把该消息之前的上下文复制过去）。
     MTV 等价物：新建会话（`createConversation` 自己会把新会话设为 active），
     把本会话到该消息为止的消息复制过去（新 id 前缀避免撞号）。
     ⚠️ 不能再调 `loadConversationMessages(newId)` —— 那会从 IndexedDB 读空列表，
     把刚复制进内存的消息覆盖掉。 */
  const handleMessageFork = useCallback((messageId: string) => {
    if (!effectiveProjectId) return;
    const store = useAppStore.getState();
    /* 从 store 现取（而不是闭包 `conversationMessages`）：那个数组每次渲染都是新引用，
       放进依赖会让 useCallback 每渲染都重建（eslint 也会报 exhaustive-deps）。 */
    const source = store.messages.filter((item) => item.conversationId === effectiveActiveConversationId);
    const index = source.findIndex((item) => item.id === messageId);
    if (index < 0) return;
    const forked = source.slice(0, index + 1);
    const newConversationId = createConversation(effectiveProjectId);
    if (!newConversationId) return;
    for (const item of forked) {
      store.addMessage({
        ...item,
        id: `${newConversationId}-${item.id}`,
        conversationId: newConversationId,
      });
    }
    showToast(t('已在新会话中继续'), 'info');
  }, [
    createConversation,
    effectiveActiveConversationId,
    effectiveProjectId,
    showToast,
    t,
  ]);

  /* 官方头部第 1 颗 open/close（`artifactPanelOpen`）。首次打开时清掉未读点。 */
  const handleToggleArtifactPanel = useCallback(() => {
    setArtifactPanelOpen((open) => {
      if (!open) setArtifactPanelHasUnread(false);
      return !open;
    });
  }, []);

  /** 官方 `artifactPanel.addToCanvas`：把文档正文建成画布上的文本节点。 */
  const handleBrainstormAddToCanvas = useCallback((markdown: string) => {
    if (!markdown.trim()) return;
    const store = useAppStore.getState();
    const nodeId = `node-${generateId()}`;
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    store.addNode({
      id: nodeId,
      type: 'ai-text',
      position: center,
      data: {
        label: 'brainstorm.md',
        type: 'ai-text',
        role: 'source',
        output: markdown,
        status: 'success',
      },
    } as never);
    showToast(t('已添加到画布'), 'info');
  }, [showToast, t]);

  /** 官方 `artifactPanel.discuss`：**不是**把正文塞进输入框，而是写入官方提示词
      `chatAdapter.artifactPanel.discussPrompt` =「我们来讨论：{{title}}」（zh 逐字），并唤出输入框。 */
  const handleBrainstormDiscuss = useCallback((markdown: string) => {
    if (!markdown.trim()) return;
    updateInputDraft(t('我们来讨论：{title}', { title: 'brainstorm.md' }));
    window.dispatchEvent(new CustomEvent('chat-focus-composer'));
  }, [t, updateInputDraft]);

  /* 官方「+」菜单第 6 行「头脑风暴」：会话级开关（开启后助手维护 brainstorm.md，面板第 1 颗查看）。 */
  const handleToggleBrainstorm = useCallback(() => {
    if (!effectiveActiveConversationId) return;
    const next = !(effectiveActiveConversation?.brainstormMode === true);
    updateConversation(effectiveActiveConversationId, { brainstormMode: next });
    showToast(next ? t('已开启头脑风暴') : t('已关闭头脑风暴'), 'info');
  }, [
    effectiveActiveConversation?.brainstormMode,
    effectiveActiveConversationId,
    showToast,
    t,
    updateConversation,
  ]);

  /* 官方头部 #3「用量统计」的宿主回调 `onOpenUsageStats`：MTV 落在设置页的「用量看板」。 */
  const handleOpenUsageStats = useCallback(() => {
    useAppStore.getState().setSettingsOpen(true, 'usage');
  }, []);

  // ── 空状态判断 ──
  const showEmptyState = !effectiveActiveConversationId;

  /* 画布节点快照（引用 chip 的标题/缩略图/类型 + 死节点清理都要它）。
     以前是 `getState()` 惰性取 ⇒ 画布变了本面板不知道，chip 永远是旧的（也可能因此
     「加了第一个之后再也加不上」）。这里订阅它，代价只是画布改动时本面板重渲染。 */
  const canvasNodes = useAppStore((state) => state.nodes);
  /** 官方拾取模式（`Gr.isActive`）：引用条左端那颗「从画布添加」钮只在**非**拾取模式时显示。 */
  const insertFromCanvasPickActive = useAppStore((state) => state.insertFromCanvasPickActive);

  /* 官方 `zL`（节点 chip）从画布 `nodeLookup` 取标题/缩略图/类型。
     MTV 用 `getState()` 惰性取（不进 selector，避免画布每次改动都重渲染本面板）。
     同时按官方 `tae(contextNodeIds, sessionId)` 做**清理**：画布上已不存在的节点
     从会话状态里剔除（条件 `<` 与官方一致，只在真的少了节点时才写 store，避免死循环）。 */
  const contextStripNodes = useMemo(() => {
    const nodes = canvasNodes;
    /* 官方 `jle(o, s)` 的过滤条件**逐字**：`nodeLookup.get(id) != null && Jd(node)`，
       `Jd = e => !!(e.id && BIe.has(e.type ?? ''))` ⇒ 只有文本/图片/视频/视频编辑/音频五类才算引用。
       `m = p.length + attachments.length + (quotedText ? 1 : 0)` 直接决定「清空」按钮的出现（`m > 1`），
       所以这里多留一个不可引用的节点就会让清空按钮出现得不对（用户实测）。 */
    const alive = chatComposerContextNodeIds.filter((id) => {
      const found = nodes.find((item) => item.id === id);
      return !!found && isReferenceableNodeType(found.type ?? '');
    });
    /* ⚠️ 这里**不能**写 store：原实现在 render 期调 `setContextNodeIds(alive)`，
       属于「渲染期间更新另一个组件」⇒ 加第 2 个引用时就可能直接崩（用户实测）。
       现在只做展示过滤，剔除死节点放到下面那个 effect 里。 */
    return alive.map((id) => {
      const node = nodes.find((item) => item.id === id);
      const data = (node?.data ?? {}) as {
        label?: string; title?: string; name?: string; src?: string; type?: string; text?: string;
        imageUrl?: string; thumbnailUrl?: string; videoUrl?: string; mediaUrl?: string; output?: string;
      };
      /* 官方 `Dle(node.type)`：TEXT→text · VIDEO/VIDEO_EDIT→video · AUDIO→audio · IMAGE→image · 其余→file。
         MTV 的节点类型是 `ai-text` / `ai-image` / `ai-video` / `ai-audio` / `ai-shotlist` … ⇒ 按关键字归类。 */
      const raw = `${node?.type ?? ''} ${data.type ?? ''}`.toLowerCase();
      const kind: 'image' | 'video' | 'audio' | 'text' | 'file' =
        raw.includes('image') || raw.includes('panorama') ? 'image'
          : raw.includes('video') || raw.includes('animation') ? 'video'
            : raw.includes('audio') ? 'audio'
              : raw.includes('text') || raw.includes('markdown') || raw.includes('shotlist') ? 'text'
                : 'file';
      /* 官方 `Ple(type, src)`：只有图片/视频才有缩略图；`previewSrc` 图片用小图、视频用原 src。
         ⚠️ 官方的字段叫 `data.src`；**MTV 的图片/视频不在 `src` 上** —— 图片是 `imageUrl`/`thumbnailUrl`，
         视频是 `videoUrl`/`mediaUrl`（`types/index.ts` 的 `BaseNodeData`）。之前只读 `src` ⇒ 永远取不到，
         chip 只能画通用图标（用户实测「没预览 / 7 张一模一样的图标」）。 */
      const pick = (...candidates: Array<string | undefined>) =>
        candidates.find((value) => typeof value === 'string' && value.length > 0) ?? '';
      const isUrl = (value?: string) => !!value && /^(https?:|data:|blob:|asset:|tauri:)/.test(value);
      const src = kind === 'image'
        ? pick(data.thumbnailUrl, data.imageUrl, data.src, isUrl(data.output) ? data.output : undefined)
        : kind === 'video'
          ? pick(data.videoUrl, data.mediaUrl, data.src, isUrl(data.output) ? data.output : undefined)
          : kind === 'audio'
            ? pick(data.mediaUrl, data.src)
            : pick(data.src);
      const hasThumb = (kind === 'image' || kind === 'video') && !!src;
      return {
        id,
        label: data.label || data.title || data.name || `node_${id.slice(0, 6)}`,
        thumbnailUrl: hasThumb ? src : undefined,
        previewSrc: kind === 'image' || kind === 'video' ? src : '',
        kind,
        text: typeof data.text === 'string' ? data.text.trim() : undefined,
        /* 官方 `HL`：`const h = typeof i.params?.scene === "string" ? i.params.scene : void 0`，
           喂给音频占位 glyph `Mr`（Text-to-Speech / Music / Sound 三态）。 */
        scene: typeof (data as { params?: { scene?: unknown } }).params?.scene === 'string'
          ? ((data as { params?: { scene?: string } }).params!.scene as string)
          : undefined,
      };
    });
  }, [chatComposerContextNodeIds, canvasNodes]);

  /* 官方 `uS`：画布上被删掉的节点要从引用里剔除。放在 effect 里（渲染期写 store 会崩）。 */
  useEffect(() => {
    const ids = useAppStore.getState().chatComposerContextNodeIds;
    if (ids.length === 0) return;
    const nodes = canvasNodes;
    const alive = ids.filter((id) => {
      const found = nodes.find((item) => item.id === id);
      return !!found && isReferenceableNodeType(found.type ?? '');
    });
    if (alive.length !== ids.length) useAppStore.getState().setContextNodeIds(alive);
  }, [chatComposerContextNodeIds, canvasNodes]);

  /* 官方 `Tue`(`TodoQueueSheet`) 的快照：官方 `xI(messages, sessionId, streamState)` 只在
     `streaming` / `recovering` 期间取，数据源是消息里的 `task_snapshot` / `todowrite`。
     MTV 侧读消息上的 `todoSnapshot` 字段（暂无生产者）⇒ 拿不到就是 null，胶囊不显示。 */
  const chatTodoSnapshot = useMemo(
    () => selectChatTodoSnapshot(
      messages,
      activeConversationTask && !AGENT_TERMINAL_STATUSES.has(activeConversationTask.status)
        ? 'streaming'
        : 'idle',
    ),
    [activeConversationTask, messages],
  );

  /* 官方 `message-list-bottom-spacer` 的高度变量：`QueuedMessagesBar` 上报排队条高度后写进 CSS 变量，
     否则排队条弹出时会**盖住最后一条消息**（spacer 高度恒为 `3rem + 0`）。 */
  const [queuedSheetHeight, setQueuedSheetHeight] = useState(0);

  // ── 渲染 ──
  return (
    <>
      {/* 官方 `Hoe`：artifact（头脑风暴）面板停靠在助手面板**左侧**（`gap 12` / 默认宽 320）。
          官方那边这颗面板是 **`position: fixed`**（CDP 实测：`position: fixed; top: 0;
          left: <chatPanelLeft - 320 - 12>px; width: 320px; z-index: 30; max-height: 480px`）
          ⇒ 它**悬浮在画布之上**，画布不缩、面板下面看到的是画布而不是一块黑。
          MTV 原来把它放进 flex 行里（`mr-3 h-full shrink-0`）⇒ ① 占掉一整列 ⇒ 面板下面那条
          空白露出应用黑底（用户说的「多了一块黑色」）；② `items-stretch` 又把它拉成满高。
          这里改成**零宽相对定位容器 + 面板绝对定位**，等价于官方的 `fixed`：不占布局空间、
          右缘贴住助手面板左缘留 12px。
          ⚠️ 官方**不要求「当前有会话」**就能开这个面板（它挂在 canvas 上）。MTV 原来多加了
          `effectiveActiveConversationId` 这个条件 ⇒ 新建对话态下点「侧边栏」会 `aria-pressed`
          变 true 却**什么都不渲染**（CDP 实测复现）。会话缺失时传空串，由面板内部跳过产物读写。 */}
      <AnimatePresence>
        {artifactPanelOpen && effectiveProjectId && (
          <div key="artifact-panel-slot" className="relative w-0 shrink-0">
            <AgentArtifactPanel
              conversationId={effectiveActiveConversationId ?? ''}
              projectId={effectiveProjectId}
              anchorRef={chatPanelRef as unknown as React.RefObject<HTMLElement | null>}
              chatPanelOpen={chatOpen}
              agentBusy={hasActiveConversationTask}
              onClose={() => setArtifactPanelOpen(false)}
              onAddToCanvas={handleBrainstormAddToCanvas}
              onDiscuss={handleBrainstormDiscuss}
            />
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
      {chatOpen && (        /* 官方外壳（PAGE@1028153 的 `bt.div` + `rU`/`iU`）。
          官方逐字：
            style={{ transformOrigin: 'right center' }}
            className = "h-full shrink-0 bg-black overflow-hidden" + (dragging && "relative z-[30]")
                        + (isOpen ? "pointer-events-auto" : "pointer-events-none")
            rU = { opacity: isOpen?1:0, width: F?0:Jf, minWidth: F?0:ml, x: isOpen?0:FV }
            iU = { opacity:{duration: isOpen?LV(.24):OV(.28), ease: isOpen?[.22,1,.36,1]:[.7,0,.84,0]},
                   width:{duration:0}, minWidth:{duration:0},
                   x:{duration: isOpen?LV:OV, ease: isOpen?[.22,1,.36,1]:[.7,0,.84,0]} }
            reduce-motion: opacity 只有 .2(展开)/.16(收起)、easeOut/easeIn，其余 duration 0，x 恒 0
          其中 `F` = `BO(isOpen, cbe=280).isPanelCollapsed` —— **收起 280ms 后** 宽度才归零，
          所以观感是「先 opacity 淡出 + x 右移 12px（.28s），280ms 才把宽度收掉」。
          AnimatePresence 里用 `width:{duration:0, delay:.28}` 表达同一个时序（等价、无需额外 state）。
          内层膜（PAGE@1028153）逐字：`h-full bg-chat-background flex flex-col overflow-hidden relative
          transition-all duration-300 rounded-l-xl`（#141414，仅左侧 16px 圆角）；
          拖拽文件悬停其上时官方再加 `scale-[1.02] shadow-2xl shadow-primary/20 ring-2 ring-primary/50`。 */
        <motion.aside
          className="chat-panel-shell relative z-50 h-full shrink-0 overflow-hidden bg-black"
          style={{ transformOrigin: 'right center' }}
          initial={false}
          /* ⚠️ **不要**再往 `animate` 里放 `minWidth`（原来有）。
             `shrink-0`（`flex-shrink:0`）已经保证这颗 flex 子项不被压缩 ⇒ `minWidth` 完全多余；
             而 framer 在「同一帧里 width 变了、minWidth 没跟上」时会把 `min-width` 留成旧值
             ⇒ **面板宽度被旧的 min-width 钉住**。
             实测（CDP，`innerWidth` 压到 820）：`style.width` 已是 `394px`（`820×0.48`），
             但 `min-width` 仍是 `480px` ⇒ 实际渲染宽度仍是 **480** ⇒ `.pb-5 = 448 ≥ 428`
             ⇒ **小屏上仍是左右两列**（官方小屏是上下排列）。删掉 `minWidth` 即解。 */
          animate={reduceMotion
            ? { opacity: 1, width: panelWidth, x: 0, transition: { duration: 0.2, ease: 'easeOut' } }
            : {
                opacity: 1,
                width: panelWidth,
                x: 0,
                transition: {
                  opacity: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                  x: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                  width: { duration: 0 },
                },
              }}
          exit={reduceMotion
            ? { opacity: 0, transition: { duration: 0.16, ease: 'easeIn' } }
            : {
                opacity: 0,
                width: 0,
                x: CHAT_PANEL_HIDDEN_X_OFFSET,
                transition: {
                  opacity: { duration: 0.28, ease: [0.7, 0, 0.84, 0] },
                  x: { duration: 0.28, ease: [0.7, 0, 0.84, 0] },
                  width: { duration: 0, delay: 0.28 },
                },
              }}
        >
          {/* 官方内层膜（PAGE@1009540）逐字：`h-full bg-chat-background flex flex-col
              overflow-hidden relative transition-all duration-300 rounded-l-xl`（#141414，仅左侧 16px 圆角） */}
          <div
            ref={chatPanelRef as unknown as React.RefObject<HTMLDivElement>}
            className="chat-panel-root c-scope chat-panel c-panel h-full bg-chat-background flex flex-col overflow-hidden relative transition-all duration-300 rounded-l-xl"
          >
            {/* 官方左缘宽度拖拽条（PAGE@1009533 逐字）：
                `absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-50 group`
                + 指示条 `absolute left-0 top-0 bottom-0 bg-foreground/50 transition-all duration-150`
                  （拖拽 `w-[2px] opacity-100`；hover `w-0.5 opacity-100`；常态 `w-0.5 opacity-0`）
                + 扩大命中区 `absolute -left-1 -right-1 top-0 bottom-0` */}
            <div
              aria-hidden="true"
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-50 group"
              onMouseDown={handleChatPanelResizeStart}
              onMouseEnter={() => setChatResizeHover(true)}
              onMouseLeave={() => setChatResizeHover(false)}
            >
              <div
                className={[
                  'absolute left-0 top-0 bottom-0 bg-foreground/50 transition-all duration-150',
                  chatPanelResizing ? 'w-[2px] opacity-100' : chatResizeHover ? 'w-0.5 opacity-100' : 'w-0.5 opacity-0',
                ].join(' ')}
              />
              <div className="absolute -left-1 -right-1 top-0 bottom-0" />
            </div>
            {/* Header */}
            <ChatHeader
              conversationTitle={effectiveActiveConversation?.title}
              hasMessages={conversationMessages.length > 0}
              onToggleConversationMenu={handleToggleConversationMenu}
              conversationMenuOpen={conversationsMenuOpen}
              titleButtonRef={conversationTitleButtonRef}
              onToggleHistoryMenu={handleToggleHistoryMenu}
              historyMenuOpen={historyMenuOpen}
              historyButtonRef={historyButtonRef}
              onOpenUsageStats={handleOpenUsageStats}
              artifactPanelOpen={artifactPanelOpen}
              onToggleArtifactPanel={handleToggleArtifactPanel}
              artifactPanelHasUnread={artifactPanelHasUnread}
              onClose={closeChat}
            />

            {/* 官方 `Pae` 的两条只读 banner（`legacyReadOnlyBanner` @2778057 /
                `starterReplayViewOnlyBanner` @2778235，类串 `shrink-0 px-3 py-2 text-xs
                text-muted-foreground bg-muted/50 border-b border-border/50`）。 */}
            <ConversationViewOnlyBanner
              isLegacyReadOnly={activeConversationIsLegacyReadOnly}
              isStarterReplay={activeConversationIsStarterReplay}
            />

            {/* 官方标题下拉：会话列表 + 新建对话（唯一的会话入口，替代 MTV 原先的整屏列表面板） */}
            {conversationsMenuOpen && (
              <ConversationMenu
                anchorRef={conversationTitleButtonRef}
                conversations={effectiveConversations}
                activeConversationId={effectiveActiveConversationId}
                onSelect={handleSelectConversation}
                onNew={handleNewConversation}
                onRename={handleRenameConversation}
                onDelete={handleDeleteConversation}
                onClose={closeConversationMenu}
              />
            )}

            {/* 官方第 4 颗「聊天记录」触发同一个下拉，但 `align: end` */}
            {historyMenuOpen && (
              <ConversationMenu
                anchorRef={historyButtonRef}
                align="end"
                conversations={effectiveConversations}
                activeConversationId={effectiveActiveConversationId}
                onSelect={handleSelectConversation}
                onNew={handleNewConversation}
                onRename={handleRenameConversation}
                onDelete={handleDeleteConversation}
                onClose={closeHistoryMenu}
              />
            )}

            {/* Body：官方只有单一消息区（会话列表是标题下拉，没有整屏列表面板） */}
            <div
              className="chat-panel-body flex flex-1 min-h-0"
              /* 官方 `message-list-bottom-spacer` 读这三个变量；MTV 目前只有排队条会设置高度
                 （`--queued-sheet-height-px`），由 `QueuedMessagesBar.onHeightChange` 上报。 */
              style={{ '--queued-sheet-height-px': `${queuedSheetHeight}px` } as React.CSSProperties}
            >
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { x: 12, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={reduceMotion
                  ? { duration: 0.12 }
                  : { type: 'spring', visualDuration: 0.24, bounce: 0 }}
                className="c-body chat-panel-chat-area flex-1 flex flex-col min-h-0 min-w-0"
              >
                  {/* Messages */}
                  <ChatMessages
                    messages={conversationMessages}
                    agentTasks={effectiveAgentTasks}
                    showEmptyState={showEmptyState}
                    /* 官方 `compact` `phase:"started"`：本会话正在压缩上下文时，
                       在消息流末尾渲染官方 `Tie`（`CompactLifecycleLine`）的 started 态。 */
                    contextCompacting={
                      !!effectiveActiveConversationId
                      && contextCompactingConversationId === effectiveActiveConversationId
                    }
                    hasInputContent={inputValue.trim().length > 0}
                    onExampleClick={handleExampleClick}
                    onAddMediaToCanvas={handleAddMediaToCanvas}
                    onRetryMediaSave={handleRetryMediaSave}
                    onEditMessage={handleEditMessage}
                    onRegenerateMessage={handleRegenerateMessage}
                    onNodeActivate={handleNodeActivate}
                    onNodeHover={handleNodeHover}
                    onModelActivate={handleModelActivate}
                    onMessageFeedback={handleMessageFeedback}
                    onMessageFork={handleMessageFork}
                    onRetryMessage={handleRetryMessage}
                    agentControls={agentControls}
                  />

                  {/* Input area */}
                  {!showEmptyState && (
                    <ChatInput
                      assistantModelId={effectiveAssistantModelId}
                      onAssistantModelChange={handleTextModelChange}
                      assistantModelIsAuto={assistantModelIsAuto}
                      onAssistantModelAuto={handleAssistantModelAuto}
                      assistantModelGroups={effectiveAssistantModelGroups}
                      /* 官方 `ask_question` 交互（生产者 = `ask_question` 工具；见 `askQuestionTools.ts`）：
                         面板可见性 = `getSessionState(activeSessionId).pendingQuestion` 满足
                         `status === "pending" && questions.length > 0`（官方 `rq` @32655）。
                         ⚠️ 官方那份是 **per-session** 的 ⇒ 这里必须同时要求会话戳匹配
                         （`PendingAskQuestion.conversationId`），否则 A 会话的提问面板会跟到 B 会话。 */
                      pendingQuestionVisible={
                        pendingQuestion?.status === 'pending'
                        && !!pendingQuestion.conversationId
                        && pendingQuestion.conversationId === effectiveActiveConversationId
                      }
                      onAnswerQuestion={handleAnswerQuestion}
                      mediaModels={effectiveGeneralModels}
                      mediaModelOptions={mediaModelOptions}
                      mediaModelAvailability={effectiveMediaModelAvailability}
                      inputValue={inputValue}
                      onInputChange={updateInputDraft}
                      onSend={handleSend}
              onEditQueuedMessage={handleEditQueuedMessage}
                      todoSnapshot={chatTodoSnapshot}
                      onSheetHeightChange={setQueuedSheetHeight}
                      hasActiveTask={hasActiveConversationTask}
                      onStopTask={handleStopActiveTask}
                      localFileGrants={effectiveLocalFileGrants}
                      onAuthorizeLocalFiles={handleAuthorizeLocalFiles}
                      onRevokeLocalFile={handleRevokeLocalFile}
                      allowSkillUpload
                      agentMode={effectiveAgentMode}
                      onAgentModeChange={handleAgentModeChange}
                      agentModeDisabled={!effectiveActiveConversationId}
                      brainstormMode={effectiveActiveConversation?.brainstormMode === true}
                      onToggleBrainstorm={handleToggleBrainstorm}
                      contextStrip={{
                        contextNodes: contextStripNodes,
                        quotedText: chatComposerQuotedText ?? undefined,
                        attachments: chatComposerAttachments,
                        /* 官方 `ContextStrip` 里是 `{!f && <button …/>}`，
                           `f` = **拾取模式是否激活**（`Gr(s => s.isActive)`，就是 `enterMode` 那个 store）。
                           ⚠️ 之前 MTV 传的是 `!effectiveActiveConversationId`（有没有会话）—— 不是一回事：
                           结果「有会话时按钮消失」（用户实测「从画布中添加的按钮也没有」），
                           而拾取模式开着时反而还留着按钮。 */
                        showInsertFromCanvas: !insertFromCanvasPickActive,
                        onInsertFromCanvas: () => useAppStore.getState().enterInsertFromCanvasPick(),
                        onRemoveNode: (nodeId) => useAppStore.getState().removeContextNodeId(nodeId),
                        onRemoveAttachment: (attachment) => useAppStore.getState().removeAttachment(attachment.src),
                        onRemoveQuotedText: () => useAppStore.getState().clearQuotedText(),
                        onClearAll: () => {
                          const store = useAppStore.getState();
                          store.clearContextNodeIds();
                          store.clearQuotedText();
                          store.clearAttachments();
                        },
                      }}
                    />
                  )}
                </motion.div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
    {/* 官方 `uIt` 里的「画布素材预览」对话框（`Ko`/`Yo`/`ns`/`qv` + `pIt`）。
        真实 DOM 由 `createPortal` 挂到 `document.body`（官方 Radix 同样 portal 到 body）。 */}
    <CanvasResourcePreviewDialog
      nodeId={previewNodeId}
      onClose={handlePreviewNodeClose}
      onOpenInCanvas={handlePreviewOpenInCanvas}
    />
    </>
  );
}
