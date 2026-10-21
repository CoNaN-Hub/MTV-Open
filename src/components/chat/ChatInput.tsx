/**
 * ChatInput — 输入区组件
 *
 * 常驻对话模型选择器；媒体模型通过轻量 @model mention 按轮覆盖。
 */
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Icon } from '@iconify/react';
import ComposerFirstEntryGlow from './ComposerFirstEntryGlow';
import { convertFileSrc } from '@tauri-apps/api/core';
import ModelSelector from '../nodes/shared/ModelSelector';
import AgentModelFlyout from './AgentModelFlyout';
import QueuedMessagesBar from './QueuedMessagesBar';
import AskQuestionSheet from './AskQuestionSheet';
import TodoQueueSheet from './TodoQueueSheet';
import ChatComposerEditor, { type ChatComposerEditorHandle } from './ChatComposerEditor';
import ContextStrip from './ContextStrip';
import ComposerDropzone from './ComposerDropzone';
import AgentAddMenu from './AgentAddMenu';
import ChatModelChip from './ChatModelChip';
import { OfficialSkillAvatarIcon } from './officialIcons';
import SkillCreateDialog from './SkillCreateDialog';
import SkillsManagerDialog from './SkillsManagerDialog';
import GenerationConfirmModeSwitch from './GenerationConfirmModeSwitch';
import GenerationAutoModeTip from './GenerationAutoModeTip';
import MentionPicker, {
  type MentionPickerGroup,
  type MentionPickerItem,
  /* ★ 官方 `omniReference.suggestion.*` 的 zh-CN 文案（规格书 §3/§5 + `services/chat/mentionStrings.ts:16`）：
     `linkedNodeShortcutHint`「输入序号快选」/ `privateSection`「个人素材库」/ `pluginSection`「应用」。
     ⚠️ **linked 段的标题不是 `linkedNodeSection`「已连接节点」**：官方 `@` 面板决定标题的那行是
        `children: l || C("omniReference.suggestion.linkedNodeSection")`
        （r127 `vendor-pkg-canvas-Dp0xADoD.js` @257958；r100 同名逻辑 @265300 邻域）
        ⇒ **宿主给了 `linkedSectionLabel` 就用宿主的**。聊天输入区那个宿主逐字传的是
        `linkedSectionLabel: m("chatAdapter.context.addReference", "Add reference")`
        （r127 @2578264，与它同级的 `componentProps` 还有 `enableAssetLibrary/enableElementLibrary/showPlugins`）
        ⇒ 聊天侧走 `t('chatAdapter.context.addReference')`（zh「添加参考」，官方键见 `src/i18n/locales/<locale>/index.ts`）。
        「已连接节点」只属于**不传 label 的宿主**（官方 `zf()` / `ynt()`）。 */
  MENTION_LINKED_HINT,
  /* 素材库段的官方键 = `omniReference.suggestion.privateSection`「个人素材库」（**不是** `myLibrarySection`，
     规格书 §4 注：官方 `Ub` 在该位置不渲染后者）。⚠️ **同一份 MTV 短剧资产数据、同一个官方键** ——
     `nodes/shared/MentionEditor.tsx` 的素材库段必须与本文件保持一致，改一处必须改两处。 */
  MENTION_PRIVATE_SECTION,
  MENTION_PLUGIN_SECTION,
} from '../shared/MentionPicker';
import { resolveDramaMentionItems, canvasMentionKind } from '../nodes/shared/mentionEditorSources';
import { bestNodeThumb, displayNodeTitle, mentionKindLabel } from '../nodes/shared/mentionEditorDom';
import type { BaseNodeData, GeneralModelConfig, ModelGroup, ModelOption } from '../../types';
import type { AgentMode } from '../../types/agent';
import type { SkillPickerOption } from '../../types/agentPackage';
import { useAppStore } from '../../store/useAppStore';
/* ★ 模型名唯一出口：`@` 引用面板里的模型条目只显示 displayName */
import { useModelNameResolver } from '../../services/models/display';
import { useT } from '../../i18n';
import { projectSkillPickerOptions } from '../../services/chat/skillCatalog';
import useMentionPluginSources from './useMentionPluginSources';
import {
  mentionPluginSkillName,
  type MentionPluginSource,
} from '../../services/chat/mentionPlugins';
import OfficialScrollFade from './OfficialScrollFade';
import {
  type MediaModelOption,
} from '../nodes/shared/defaultModels';
import type { LocalFileGrantSummary } from '../../services/chat/fileGrantService';
import type { QueuedChatMessage, TodoSnapshot } from '../../types/chat';

const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
type DramaMentionItem = ReturnType<typeof resolveDramaMentionItems>[number];
/* ★ 官方 `Ub` 的 `@` 面板**没有 Tab**（规格书 §0-1/§4）：来源以「分区」呈现，不是 Tab/芯片。
   官方分区顺序（规格书 §4）= 已连接节点 → 应用 → 素材库 → 指令；
   官方 `omniReference.suggestion.*` **没有「模型」键**（主 bundle 0 命中，规格书 §0-2）⇒ MTV 的模型段已移除。
   MTV 真正有数据的域只有三段（其余官方域 MTV 没有数据 ⇒ 按铁律**整段不渲染**，不造空段）：
     ① 已连接节点 = 画布节点；② 应用 = 已安装应用；③ 素材库 = 短剧人物/场景/道具。 */
type ReferenceSuggestion =
  | { key: string; kind: 'node'; nodeId: string; label: string; displayId?: number }
  | { key: string; kind: 'drama'; item: DramaMentionItem }
  /** 只在**模型菜单**（`referencePickerMode === 'model'`）里出现；官方 `@` 面板没有模型段。 */
  | { key: string; kind: 'model'; model: MediaModelOption }
  /** 官方「应用」分组（`componentProps.plugins`）——见 `services/chat/mentionPlugins.ts`。 */
  | { key: string; kind: 'plugin'; plugin: MentionPluginSource };

const DRAMA_KIND_LABELS: Record<string, string> = { character: '角色', scene: '场景', prop: '道具' };
/* 媒体类型词汇/图标 —— **只服务模型菜单**（`referencePickerMode === 'model'`）；
   官方 `@` 面板没有模型段 ⇒ 这些不会出现在官方分区单列表里。 */
const MEDIA_KIND_LABELS: Record<string, string> = { image: '图片', video: '视频', audio: '音频' };
const MEDIA_KIND_ICONS: Record<string, string> = {
  image: 'mdi:image-outline',
  video: 'mdi:video-outline',
  audio: 'mdi:music-note-outline',
};

const REFERENCE_SUGGESTION_LIST_ID = 'chat-reference-suggestions';
const SKILL_SUGGESTION_LIST_ID = 'chat-skill-suggestions';

interface SkillPickerGroup {
  id: string;
  label: string;
  sourceKind: SkillPickerOption['sourceKind'];
  options: SkillPickerOption[];
}

function filterSkillPickerOptions(
  options: SkillPickerOption[],
  query: string,
): SkillPickerOption[] {
  return options.filter((skill) => fuzzyMatchText(
    query,
    skill.name,
    skill.description,
    skill.fileName,
    skill.sourceLabel,
  ));
}

/** 保持目录原始顺序，只把用户 Skill 分组固定在智能体包之前。 */
function groupSkillPickerOptions(options: SkillPickerOption[]): SkillPickerGroup[] {
  const groups = new Map<string, SkillPickerGroup>();
  for (const option of options) {
    const existing = groups.get(option.sourceGroupId);
    if (existing) {
      existing.options.push(option);
      continue;
    }
    groups.set(option.sourceGroupId, {
      id: option.sourceGroupId,
      label: option.sourceLabel,
      sourceKind: option.sourceKind,
      options: [option],
    });
  }
  return [...groups.values()].sort((left, right) => {
    if (left.sourceKind === right.sourceKind) return 0;
    return left.sourceKind === 'user' ? -1 : 1;
  });
}

function resolveNodeThumbnail(data: BaseNodeData): string | undefined {
  if (data.imageUrl) {
    if (data.filePath && IS_TAURI) {
      try {
        return convertFileSrc(data.filePath);
      } catch {
        return data.thumbnailUrl || data.imageUrl;
      }
    }
    return data.thumbnailUrl || data.imageUrl;
  }
  return data.thumbnailUrl;
}

/** 模型菜单的模糊匹配（官方 `@` 面板不再有模型段，故只被模型口使用）。 */
function fuzzyMatchModel(model: MediaModelOption, rawQuery: string): boolean {
  const query = rawQuery.trim().toLocaleLowerCase().replace(/\s+/g, '');
  if (!query) return true;
  const text = [model.label, model.value, model.provider, model.groupName, model.description]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
    .replace(/\s+/g, '');
  if (text.includes(query)) return true;
  let cursor = 0;
  for (const char of query) {
    cursor = text.indexOf(char, cursor);
    if (cursor < 0) return false;
    cursor += 1;
  }
  return true;
}

function fuzzyMatchText(rawQuery: string, ...values: Array<string | number | undefined>): boolean {
  const query = rawQuery.trim().toLocaleLowerCase().replace(/\s+/g, '');
  if (!query) return true;
  const text = values.filter((value) => value != null).join(' ').toLocaleLowerCase().replace(/\s+/g, '');
  if (text.includes(query)) return true;
  let cursor = 0;
  for (const char of query) {
    cursor = text.indexOf(char, cursor);
    if (cursor < 0) return false;
    cursor += 1;
  }
  return true;
}

interface ChatInputProps {
  /** 当前选中的文本模型 ID */
  assistantModelId?: string;
  onAssistantModelChange: (modelId?: string) => void;
  /** 官方 Auto 行是否选中（= 用户没显式指定助手模型）。 */
  assistantModelIsAuto?: boolean;
  /** 官方 Auto 行点击（清掉显式指定，回到自动挑候选）。 */
  onAssistantModelAuto?: () => void;
  /** 独立窗口由主窗口下发的脱敏文本模型分组。 */
  assistantModelGroups?: ModelGroup[];
  mediaModels: GeneralModelConfig[];
  mediaModelOptions: MediaModelOption[];
  mediaModelAvailability: Record<string, boolean>;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  /** 官方排队条「编辑」：把待发消息（含附件 / 引用 / 上下文）放回输入框（官方 `queue.edit`）。 */
  onEditQueuedMessage?: (item: QueuedChatMessage) => void;
  /** 官方 `TodoQueueSheet` 的待办快照（来自消息上的 `todoSnapshot`；无生产者时为 null）。 */
  todoSnapshot?: TodoSnapshot | null;
  /** 官方 `AskQuestionSheet` 的 `onAnswer(toolUseId, {labels, freeText})`。 */
  onAnswerQuestion?: (toolUseId: string, answer: { labels: string[]; freeText?: string }) => void;
  /** 官方 `rq` 选择器：`pendingQuestion.status === "pending" && questions.length > 0`。 */
  pendingQuestionVisible?: boolean;
  /** 官方 `message-list-bottom-spacer`：排队条高度上报（写 `--queued-sheet-height-px`）。 */
  onSheetHeightChange?: (heightPx: number) => void;
  hasActiveTask?: boolean;
  /** 官方「停止生成」：`chatAdapter.tooltips.stop`。任务进行中时占位发送键（官方是二选一）。 */
  onStopTask?: () => void;
  localFileGrants?: LocalFileGrantSummary[];
  /** 官方「+」菜单里的 `addMenu.addLocalFolder`（桌面端）—— 待 R2 实现「+」菜单后从这里接入口。 */
  onAuthorizeLocalFiles?: () => void;
  onRevokeLocalFile?: (grantId: string) => void;
  disabled?: boolean;
  /* 官方「上下文占用」指示器在**头部第 3 颗**（usageStats），composer rail 里没有
     ⇒ MTV 原来放在 rail 的 `contextUsage` 指示器已移除。 */
  /** 独立窗口是只读镜像，上传只会写进本窗口 Store 并被下一帧同步覆盖 */
  allowSkillUpload?: boolean;
  /** 独立窗口只接收可选择的 Skill 元数据，不同步正文或来源路径。 */
  skillOptions?: SkillPickerOption[];
  /** 官方生成确认模式（Ask / Auto）：控件在**输入框底部控制条**最左侧（不是头部）。 */
  agentMode?: AgentMode;
  onAgentModeChange?: (mode: AgentMode) => void;
  agentModeDisabled?: boolean;
  /** 官方「+」菜单第 6 行「头脑风暴」：会话级开关。 */
  brainstormMode?: boolean;
  onToggleBrainstorm?: () => void;
  /** 官方 `VL`（ContextStrip）的三条数据 + 回调：引用节点 / 引用文本 / 附件。
      store 切片（`contextNodeIds` / `quotedText` / `attachments`）落地前为空 ⇒ 官方语义下整条不渲染。 */
  contextStrip?: React.ComponentProps<typeof ContextStrip>;
}

export default function ChatInput({
  assistantModelId,
  onAssistantModelChange,
  assistantModelIsAuto = false,
  onAssistantModelAuto,
  assistantModelGroups,
  mediaModels,
  mediaModelOptions,
  mediaModelAvailability,
  inputValue,
  onInputChange,
  onSend,
  onEditQueuedMessage,
  todoSnapshot,
  onAnswerQuestion,
  pendingQuestionVisible = false,
  onSheetHeightChange,
  hasActiveTask = false,
  onStopTask,
  localFileGrants = [],
  onAuthorizeLocalFiles,
  onRevokeLocalFile,
  disabled = false,
  skillOptions,
  agentMode = 'collaborative',
  onAgentModeChange,
  agentModeDisabled = false,
  brainstormMode = false,
  onToggleBrainstorm,
  contextStrip,
}: ChatInputProps) {
  const t = useT();
  const inputRef = useRef<ChatComposerEditorHandle>(null);
  const reduceMotion = useReducedMotion();
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  /* ★ 引用弹层的**触发口**（两个口共用同一个 `MentionPicker`，但形态完全不同）：
       · 'mention' = 编辑器里敲 `@` 触发 → **官方分区单列表**（`groups`，无 Tab / 无芯片行、无模型段）；
       · 'model'   = `chat-open-reference-menu` 触发（点消息里的 `@model{}` 芯片、
                     `ChatPanel.tsx:842`、`ChatReferenceText.tsx:291`）→ **模型菜单**：
                     行列表 + 媒体类型芯片，可插入 `@model{id|label}`。
     ⚠️ 官方 `@` 面板没有模型段，但官方**并不是没有模型入口** ⇒ 模型入口由这一个口承载，
        不许把它塞回官方 `@` 面板，也不许让 `chat-open-reference-menu` 落到空面板。 */
  const [referencePickerMode, setReferencePickerMode] = useState<'mention' | 'model'>('mention');
  const [mediaKind, setMediaKind] = useState<string>('all');
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState('');
  const [skillUploading, setSkillUploading] = useState(false);
  /** 官方技能子面板「管理技能」行 → 官方形态的管理对话框（应用/技能 页签 + 搜索 + 添加菜单）。 */
  const [skillManagerOpen, setSkillManagerOpen] = useState(false);
  /** 官方「创建技能」对话框。 */
  const [skillCreateOpen, setSkillCreateOpen] = useState(false);
  /* ── 官方 `Eat()`（`vendor-pkg-canvas-ChpWx5JY.js` @2663159 逐字）：
        const Sat="auto_mode_tip_dismissed";
        function Nat(){ return zn.get(Ln.AGENT_PREFS)?.auto_mode_tip_dismissed===!0 }
        function Tat(){ zn.update(Ln.AGENT_PREFS,{[Sat]:!0}) }
        function Eat(){ const[e,t]=a.useState(!1);
          a.useEffect(()=>{ const o=r=>{ const i=r.detail; i==="auto"?Nat()||t(!0):i==="ask"&&t(!1) };
            window.addEventListener(Lb,o); return ()=>window.removeEventListener(Lb,o) },[]);
          const n=a.useCallback(()=>{Tat(),t(!1)},[]); return{visible:e,dismiss:n} }
        （`Lb = "generation-confirm-mode-change"`、由 `nK(mode)` 在模式真正改变时 dispatch，@181595。）
        挂载点 @2781326：`s.jsx(tae,{visible:no&&!Le,onClose:js,onExitComplete:Us})`。
        MTV 的模式是 props `agentMode`（`autonomous`=auto / `collaborative`=ask，见 `GenerationConfirmModeSwitch`），
        没有官方那条 window 事件 ⇒ 用「`agentMode` 变化时把本地「已关闭」标记重置」等价实现官方语义：
        `visible = agentMode === 'autonomous' && !已关闭`，✕ 置「已关闭」；重新切模式 ⇒ 重置回可见。
        官方把关闭结果持久化进 `AGENT_PREFS.auto_mode_tip_dismissed`（跨会话），MTV 按用户口径只做**会话内**关闭。 */
  const [autoModeTipDismissed, setAutoModeTipDismissed] = useState(false);
  /* 官方是在 window 事件里 `t(!0)/t(!1)`；MTV 的模式是 prop ⇒ 用 React 官方的
     「prop 变化时在渲染期调整 state」写法等价重置（避免 effect 里 setState 的级联渲染）。 */
  const [autoModeTipMode, setAutoModeTipMode] = useState(agentMode);
  if (autoModeTipMode !== agentMode) {
    setAutoModeTipMode(agentMode);
    setAutoModeTipDismissed(false);
  }
  const showAutoModeTip = agentMode === 'autonomous' && !autoModeTipDismissed;
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  /* 官方 rail：容器宽度 ≤ 450 时 `data-icon-only`（PAGE@755181 `const mae=450`，
     官方同样用 ResizeObserver 观察 rail 自身宽度，取 `contentRect.width`）。 */
  const railRef = useRef<HTMLDivElement | null>(null);
  /* 官方 `addButtonAlignRef`（rail 最左控件）——用于确认模式菜单的 `alignOffset`。 */
  const railStartRef = useRef<HTMLDivElement | null>(null);
  const [railIconOnly, setRailIconOnly] = useState(false);
  /* 官方 `AgentModelPicker` 的 Auto 判定（与下方模型选择器 `autoSelected` 同一口径）：
     Auto 态下官方胶囊**不显示**任何模型图标。 */
  const modelIsAuto = assistantModelIsAuto ?? !assistantModelId;
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === 'undefined') return undefined;
    /* 官方 `Lst`（canvas @2512031 邻域逐字）：
       ```js
       oe = y !== null && y <= Dst;                 // Dst = 450
       useEffect(() => { const fe = h.current;
         if (!fe || (b(fe.getBoundingClientRect().width), typeof ResizeObserver > "u")) return;
         const we = new ResizeObserver(([Te]) => { b(Te?.contentRect.width ?? fe.getBoundingClientRect().width) }); … })
       ```
       而 `h` 挂在**输入卡底部那一行**上（@2513254 逐字：
       `<div ref={h} data-icon-only={oe||void 0} className="flex h-10 min-w-0 items-center justify-between px-2 pb-2">`
       —— 就是放「加号 / 麦克风 / 模型胶囊 / 发送」的那行）。
       ⇒ 官方量的是**这一行自己的宽度**，判据 `<= 450`，**只此一项**。
       ⚠️ MTV 曾经自造过 `min(rail 宽, 输入卡宽)`：窄卡片时这一行的子簇是 `shrink-0`、会**溢出**卡片，
       于是官方口径的 `y` 仍然 > 450（**不折叠**），而 MTV 取 min 会跟着卡片一起变窄 ⇒ **过早折叠**
       （小屏下官方仍是 `Auto ▾`，MTV 却把文字收掉只剩图标）。已按官方改回「只用这一行自己的宽度」。 */
    const measure = () => {
      const width = rail.getBoundingClientRect().width;
      if (width > 0) setRailIconOnly(width <= 450);
    };
    /* 官方逐字：首句量边框盒，RO 回调**覆盖**为 `contentRect.width`（内容盒，少这一行自己的 `px-2` 16px）。 */
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? rail.getBoundingClientRect().width;
      if (width > 0) setRailIconOnly(width <= 450);
    });
    observer.observe(rail);
    measure();
    return () => observer.disconnect();
  }, []);
  const canvasNodes = useAppStore((state) => state.nodes);
  const dramaAssets = useAppStore((state) => state.dramaAssets);
  const userSkills = useAppStore((state) => state.userSkills);
  const agentPackageSkills = useAppStore((state) => state.agentPackageSkills);
  const uploadSkill = useAppStore((state) => state.uploadSkill);
  const showToast = useAppStore((state) => state.showToast);
  /** 官方 `firstEntryGlowKey`（`CanvasInputV2` 的第 3 个参数 = React key）：
   *  换 key 就重播一次「进入时的光影」。这里用当前会话 id。 */
  const activeSessionId = useAppStore((state) => state.activeConversationId);
  const enterInsertFromCanvasPick = useAppStore((state) => state.enterInsertFromCanvasPick);
  /* ★ 模型名唯一出口 */
  const modelName = useModelNameResolver();
  const storeSkillOptions = useMemo(
    () => projectSkillPickerOptions(userSkills, agentPackageSkills),
    [agentPackageSkills, userSkills],
  );
  const availableSkillOptions = skillOptions ?? storeSkillOptions;
  const compatibleMediaModels = mediaModelOptions;
  const filteredMediaModels = useMemo(
    () => compatibleMediaModels.filter((model) => fuzzyMatchModel(model, modelQuery)),
    [compatibleMediaModels, modelQuery],
  );
  const filteredCanvasNodes = useMemo(() => canvasNodes
    .filter((node) => node.type !== 'group')
    .filter((node) => fuzzyMatchText(
      modelQuery,
      node.data.label,
      node.data.displayId,
      node.data.displayId != null ? `#${String(node.data.displayId)}` : undefined,
      node.data.type,
      node.id,
    )), [canvasNodes, modelQuery]);
  const filteredSkills = useMemo(
    () => filterSkillPickerOptions(availableSkillOptions, skillQuery),
    [availableSkillOptions, skillQuery],
  );
  const groupedSkills = useMemo(
    () => groupSkillPickerOptions(filteredSkills),
    [filteredSkills],
  );
  const orderedSkills = useMemo(
    () => groupedSkills.flatMap((group) => group.options),
    [groupedSkills],
  );
  const nodeDisplayIds = useMemo(
    () => new Map(canvasNodes.map((node) => [node.id, node.data.displayId])),
    [canvasNodes],
  );
  /* 媒体模型按类型分档 —— 只服务 **模型菜单**（`chat-open-reference-menu` 触发，见下方
     `referencePickerMode === 'model'`）；官方 `@` 面板**没有**模型段，也没有芯片行（规格书 §0-2/§1）。 */
  const mediaKindChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const model of filteredMediaModels) {
      counts.set(model.mediaKind, (counts.get(model.mediaKind) ?? 0) + 1);
    }
    if (counts.size === 0) return [];
    return [
      { id: 'all', label: t('全部'), count: filteredMediaModels.length },
      ...[...counts].map(([kind, count]) => ({ id: kind, label: t(MEDIA_KIND_LABELS[kind] ?? kind), count })),
    ];
  }, [filteredMediaModels, t]);
  const kindedMediaModels = useMemo(
    () => (mediaKind === 'all' ? filteredMediaModels : filteredMediaModels.filter((m) => m.mediaKind === mediaKind)),
    [filteredMediaModels, mediaKind],
  );
  // 资产库（短剧人物/场景/道具），与节点提示词的 @ 用同一份数据源
  const filteredDramaAssets = useMemo(
    () => resolveDramaMentionItems(dramaAssets, modelQuery),
    [dramaAssets, modelQuery],
  );

  /* 官方「应用」分组（§6 #8）：数据源 = 已安装应用，适配层是官方 `Ub` 的 `Re[]`
     （`services/chat/mentionPlugins.mentionPluginSourcesFromInstalled`，与 `ChatMentionInput`
     的 `mentionPlugins` 用同一份数据）。`@查询词` 命中 displayName / pluginName / description。 */
  const mentionPlugins = useMentionPluginSources();
  const visibleMentionPlugins = useMemo(
    () => mentionPlugins.filter((plugin) => (
      !modelQuery
      || fuzzyMatchText(modelQuery, plugin.displayName, plugin.pluginName, plugin.description)
    )),
    [mentionPlugins, modelQuery],
  );

  /* ══ ★ 官方 `Ub` 的「分区单列表」——`@` 面板不再有 Tab / 芯片行（规格书 §0-1、§1、§4）══
     官方 = 一个滚动列表 + 多段「分组标题行 + 行列表 + 可选『还有 N 个结果』」，段间 6px、段内 2px。
     分区顺序逐字照官方 §4：已连接节点（`linkedNodeSection`）→ 应用（`pluginSection`）→ 素材库。
     ⚠️ 铁律：**缺数据的段整段不渲染**（下面的 `mentionGroups` 只在 items 非空时 push），
        绝不造空段、绝不拿别的域顶替官方段位。 */
  const modelGroupAvailability = useMemo(() => {
    const availability: Record<string, boolean> = { 'general-models': true };
    for (const model of compatibleMediaModels) {
      availability[model.groupId] = availability[model.groupId]
        || !!mediaModelAvailability[model.value];
    }
    return availability;
  }, [compatibleMediaModels, mediaModelAvailability]);

  const isModelAvailable = useCallback(
    (model: MediaModelOption) => !!mediaModelAvailability[model.value],
    [mediaModelAvailability],
  );

  const handleTextModelSelect = useCallback((model: ModelOption) => {
    const modelId = model.value.startsWith('general/')
      ? model.value.slice('general/'.length)
      : model.value;
    onAssistantModelChange(modelId);
  }, [onAssistantModelChange]);

  const selectedTextModel = useMemo(() => {
    if (!assistantModelId || assistantModelId.startsWith('general/')) return assistantModelId;
    const isGeneralModel = mediaModels.some((model) => (
      model.category === 'text' && model.id === assistantModelId
    ));
    return isGeneralModel ? `general/${assistantModelId}` : assistantModelId;
  }, [assistantModelId, mediaModels]);

  /* ★ 模型引用（`@model{id|label}`）的**插入入口** = 模型菜单（`chat-open-reference-menu`
     触发时 `referencePickerMode === 'model'`），它**不是**官方 `@` 面板的一部分
     ⇒ `isModelAvailable` / `kindedMediaModels` / `insertModelMention` 全部保留可用。 */
  const insertModelMention = useCallback((model: MediaModelOption) => {
    inputRef.current?.insertReference({
      kind: 'model',
      /* `id` 是出站调用引用（原样保留）；`label` 是**展示名快照**（消息正文里给人看的）*/
      id: model.value,
      label: modelName(model.value) || model.label,
    });
    setModelMenuOpen(false);
    setModelQuery('');
    setMediaKind('all');
    setReferencePickerMode('mention');
    setActiveSuggestionIndex(0);
  }, [modelName]);

  /** 官方「应用」提及（§6 #8）：`renderText = plugin:<pluginName>:<skillName>`，
   *  写进输入值的 token 是 `{{<pluginName>:<skillName>}}`（官方 `k0e`/`Pve`）。
   *  技能名取官方 `Pde`（`mentionPluginSkillName`）。 */
  const insertPluginMention = useCallback((plugin: MentionPluginSource) => {
    inputRef.current?.insertReference({
      kind: 'plugin',
      id: plugin.pluginName,
      label: plugin.displayName,
      skill: mentionPluginSkillName(plugin),
    });
    setModelMenuOpen(false);
    setModelQuery('');
    setReferencePickerMode('mention');
    setActiveSuggestionIndex(0);
  }, []);

  /** 官方 `use-chat-attachment-file-input` 的 `handleUploadClick`：打开隐藏的 file input。 */
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const handleUploadAttachment = useCallback(() => {
    attachmentInputRef.current?.click();
  }, []);

  /** 官方 `handleFileChange` / drop → `addAttachment`：把本地文件变成会话附件
   *  （MTV 是本地画布应用 ⇒ 用 `URL.createObjectURL` 生成本地对象 URL，不联网上传）。 */
  const attachLocalFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const store = useAppStore.getState();
    for (const file of files) {
      const kind = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('video/') ? 'video'
          : file.type.startsWith('audio/') ? 'audio'
            : 'file';
      store.addAttachment({
        src: URL.createObjectURL(file),
        type: kind,
        name: file.name,
        mimeType: file.type,
      });
    }
  }, []);

  const handleAttachmentChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    attachLocalFiles(files);
  }, [attachLocalFiles]);

  /* 官方 `use-chat-attachment-file-input` 的拖放：`isDragging`（全局有文件在拖）+ `isOver`（落在输入卡上）。 */
  const [dropDragging, setDropDragging] = useState(false);
  const [dropOver, setDropOver] = useState(false);
  const dropDepthRef = useRef(0);
  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    dropDepthRef.current += 1;
    setDropDragging(true);
    setDropOver(true);
  }, []);
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);
  const handleDragLeave = useCallback(() => {
    dropDepthRef.current = Math.max(0, dropDepthRef.current - 1);
    if (dropDepthRef.current === 0) {
      setDropDragging(false);
      setDropOver(false);
    }
  }, []);
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    dropDepthRef.current = 0;
    setDropDragging(false);
    setDropOver(false);
    attachLocalFiles(Array.from(event.dataTransfer.files ?? []));
  }, [attachLocalFiles]);

  const insertNodeMention = useCallback((nodeId: string, label: string, displayId?: number) => {
    inputRef.current?.insertReference({
      kind: 'node',
      id: nodeId,
      label,
      displayId,
    });
    /* 官方 `B_`/`addContextNodeIds`：被 `@` 引用的画布节点同时进会话的 `contextNodeIds`
       ⇒ 输入卡上方的 ContextStrip 会出现对应的 38×38 节点 chip（官方也是两处一起写）。 */
    useAppStore.getState().addContextNodeIds([nodeId]);
    setModelMenuOpen(false);
    setModelQuery('');
    setMediaKind('all');
    setReferencePickerMode('mention');
    setActiveSuggestionIndex(0);
  }, []);

  // 资产芯片走 @drama{id:name}，发送前由 promptResolver 展开成设定正文或参考图
  const insertDramaMention = useCallback((item: DramaMentionItem) => {
    inputRef.current?.insertReference({ kind: 'drama', id: item.id, label: item.name });
    setModelMenuOpen(false);
    setModelQuery('');
    setReferencePickerMode('mention');
    setActiveSuggestionIndex(0);
  }, []);

  const insertSkillReference = useCallback((skillId: string, skillName: string) => {
    inputRef.current?.insertReference({
      kind: 'skill',
      id: skillId,
      label: skillName,
    });
    setSkillMenuOpen(false);
    setSkillQuery('');
    setActiveSuggestionIndex(0);
  }, []);

  /* ★ 官方节点显示名（`vendor-pkg-canvas-DuoOicPr.js` @189045–@189714 实测原文，`Gwe(e)`）：
     `const d = l.data?.title || \`Image ${c+1}\`` —— **有名字用名字，没名字才按同类 1-based 序号编号**；
     同类候选先按 `type`（且「有产物 src」）过滤，编号在该数组内从 1 起；返回顺序 图片→视频→音频→文本。
     ⚠️ **有意偏离官方字面**：官方对未命名节点**不设标题**，MTV 却把类型默认名（`Image` / 老数据「生成图像」）
        写进了 `data.label`；若照官方字面实现，MTV 这边会全叫 `Image`，等于没有编号。故这里把「类型默认名」
        视作**没有名字**（与 `mentionEditorDom.displayNodeTitle` 的归一化口径一致），落到 `Image N` / `Video N` / …
     依据：用户 2026-10-15 现场 —— 28 个图片节点在 `@` 面板里全长一个样，无法区分。 */
  const canvasNodeLabels = useMemo(() => {
    const counters = { image: 0, video: 0, audio: 0, text: 0 };
    const labels = new Map<string, string>();
    for (const node of filteredCanvasNodes) {
      const kind = canvasMentionKind(node.data.type);
      counters[kind] += 1;
      const kindLabel = mentionKindLabel(kind);
      const raw = displayNodeTitle(node.data.label);
      labels.set(node.id, !raw || raw === kindLabel ? `${kindLabel} ${counters[kind]}` : raw);
    }
    return labels;
  }, [filteredCanvasNodes]);

  /* ── 键盘拍平序列：顺序与面板渲染顺序**逐条对齐**（行 `domId` 就是它） ──
     `@` 面板 = 官方分区顺序（已连接节点 → 应用 → 素材库，规格书 §4）；
     模型菜单 = 模型（该菜单不是官方 `@` 面板的一部分，见 `referencePickerMode`）。 */
  const referenceSuggestions = useMemo<ReferenceSuggestion[]>(() => (
    referencePickerMode === 'model'
      ? kindedMediaModels.filter(isModelAvailable).map((model) => ({
        key: `model:${model.mediaKind}:${model.value}`,
        kind: 'model' as const,
        model,
      }))
      : [
        ...filteredCanvasNodes.map((node) => ({
          key: `node:${node.id}`,
          kind: 'node' as const,
          nodeId: node.id,
          label: canvasNodeLabels.get(node.id) ?? String(node.data.label || t('节点')),
          displayId: node.data.displayId,
        })),
        ...visibleMentionPlugins.map((plugin) => ({
          key: `plugin:${plugin.pluginName}`,
          kind: 'plugin' as const,
          plugin,
        })),
        ...filteredDramaAssets.map((item) => ({
          key: `drama:${item.id}`,
          kind: 'drama' as const,
          item,
        })),
      ]
  ), [
    canvasNodeLabels,
    filteredCanvasNodes,
    filteredDramaAssets,
    isModelAvailable,
    kindedMediaModels,
    referencePickerMode,
    t,
    visibleMentionPlugins,
  ]);
  const skillSuggestions = useMemo(
    () => orderedSkills.map((skill) => ({ key: `skill:${skill.id}`, skill })),
    [orderedSkills],
  );
  const referenceSuggestionIndexes = useMemo(
    () => new Map(referenceSuggestions.map((suggestion, index) => [suggestion.key, index])),
    [referenceSuggestions],
  );
  const activeSuggestionCount = modelMenuOpen
    ? referenceSuggestions.length
    : skillMenuOpen
      ? skillSuggestions.length
      : 0;
  const resolvedActiveSuggestionIndex = activeSuggestionCount > 0
    ? Math.min(activeSuggestionIndex, activeSuggestionCount - 1)
    : 0;

  const selectReferenceSuggestion = useCallback((suggestion: ReferenceSuggestion) => {
    if (suggestion.kind === 'node') {
      insertNodeMention(suggestion.nodeId, suggestion.label, suggestion.displayId);
    } else if (suggestion.kind === 'drama') {
      insertDramaMention(suggestion.item);
    } else if (suggestion.kind === 'plugin') {
      insertPluginMention(suggestion.plugin);
    } else {
      insertModelMention(suggestion.model);
    }
  }, [insertDramaMention, insertModelMention, insertNodeMention, insertPluginMention]);

  const handleSuggestionKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const suggestionsOpen = modelMenuOpen || skillMenuOpen;
    if (!suggestionsOpen) return false;
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return false;
    if (event.key === 'Enter' && event.shiftKey) return false;

    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      setModelMenuOpen(false);
      setSkillMenuOpen(false);
      setModelQuery('');
      setSkillQuery('');
      setMediaKind('all');
      setReferencePickerMode('mention');
      return true;
    }

    const suggestionCount = modelMenuOpen
      ? referenceSuggestions.length
      : skillSuggestions.length;
    if (suggestionCount === 0) return true;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      setActiveSuggestionIndex((index) => (index + offset + suggestionCount) % suggestionCount);
      return true;
    }

    if (modelMenuOpen) {
      const suggestion = referenceSuggestions[resolvedActiveSuggestionIndex] ?? referenceSuggestions[0];
      if (suggestion) selectReferenceSuggestion(suggestion);
    } else {
      const suggestion = skillSuggestions[resolvedActiveSuggestionIndex] ?? skillSuggestions[0];
      if (suggestion) insertSkillReference(suggestion.skill.id, suggestion.skill.name);
    }
    return true;
  }, [
    insertSkillReference,
    modelMenuOpen,
    referenceSuggestions,
    resolvedActiveSuggestionIndex,
    selectReferenceSuggestion,
    skillMenuOpen,
    skillSuggestions,
  ]);

  /* ══ 官方 `Ub` 的分区行（规格书 §2/§3/§5）：分区 = 「分组标题行 + 行列表 + 可选『还有 N 个结果』」══
     行解剖逐字同官方：① 缩略图框 ② 标签（`text-sm font-medium leading-5 text-white/90 truncate`）
                     ③ `#序号` ④ 尾部类型图标；第 4 行是「还有 N 个结果」（`MentionPicker` 已实现）。
     ⚠️ `domId` 取自**拍平序列**（`referenceSuggestions`），所以三个数组的拼接顺序 = 分区顺序。 */

  /** ① 已连接节点（官方 `qt` 段）——**标签三处同源**：面板 / `referenceSuggestions` / 插入后的 token。 */
  const nodeMentionItems: MentionPickerItem[] = filteredCanvasNodes.map((node) => {
    const label = canvasNodeLabels.get(node.id) ?? String(node.data.label || t('节点'));
    const index = referenceSuggestionIndexes.get(`node:${node.id}`);
    return {
      key: `node:${node.id}`,
      domId: index == null ? undefined : `chat-reference-suggestion-${index}`,
      label,
      thumbnailUrl: resolveNodeThumbnail(node.data),
      /* ★ 官方行尾 `#{xt}` = 该行在**已连接节点段里的 1-based 位次**（`xe`/`se` 映射），也正是
         `linkedNodeShortcutHint`「输入序号快选」指的那个号。节点自己的 `displayId`（画布角标）
         不是这个号 ⇒ 这里**不写 badge**，让 `MentionPicker` 按 `group.id === 'nodes'` 渲染位次
         （`MentionPicker.tsx:217-227`：`showIndex` 只对 nodes 组为真）。 */
      title: `${label} · ${String(node.data.type)}`,
      onSelect: () => insertNodeMention(node.id, label, node.data.displayId),
    };
  });

  /** ② 应用（官方 `be` / `pluginSection`）：圆角图标走 `iconUrl`，无图用 puzzle 兜底（本地插件无图标）。 */
  const pluginMentionItems: MentionPickerItem[] = visibleMentionPlugins.map((plugin) => {
    const index = referenceSuggestionIndexes.get(`plugin:${plugin.pluginName}`);
    return {
      key: `plugin:${plugin.pluginName}`,
      domId: index == null ? undefined : `chat-reference-suggestion-${index}`,
      label: plugin.displayName,
      icon: plugin.iconUrl ? undefined : 'mdi:puzzle-outline',
      thumbnailUrl: plugin.iconUrl,
      title: plugin.description,
      onSelect: () => insertPluginMention(plugin),
    };
  });

  /** ③ 素材库（MTV 的短剧人物/场景/道具）：官方**素材库段**用的键是
   *  `omniReference.suggestion.privateSection`「个人素材库」（规格书 §4 #6；官方 `Ub` 在此位置
   *  **不渲染** `myLibrarySection`「我的素材库」⇒ 旧实现是误用 key）。
   *  MTV 这类资产没有个人/团队之分（无 `teamSection`），就是用户自己的库。
   *  ⚠️ **同一数据、同一官方键**：`nodes/shared/MentionEditor.tsx` 的素材库段必须与本处一致。 */
  const dramaMentionItems: MentionPickerItem[] = filteredDramaAssets.map((item) => {
    const index = referenceSuggestionIndexes.get(`drama:${item.id}`);
    const boundNode = item.imageNodeId ? canvasNodes.find((n) => n.id === item.imageNodeId) : undefined;
    const thumbnailUrl = (boundNode ? bestNodeThumb(boundNode.data) : undefined)
      || item.imageUrl
      || item.referenceImages?.find((reference) => !!reference.imageUrl)?.imageUrl;
    return {
      key: `drama:${item.id}`,
      domId: index == null ? undefined : `chat-reference-suggestion-${index}`,
      label: item.name,
      thumbnailUrl,
      icon: 'mdi:account-box-outline',
      badge: t(DRAMA_KIND_LABELS[item.kind] ?? item.kind),
      title: thumbnailUrl ? t('{name}（引用参考图）', { name: item.name }) : t('{name}（引用设定文字）', { name: item.name }),
      onSelect: () => insertDramaMention(item),
    };
  });

  /** 模型菜单的行（**不属于**官方 `@` 面板；官方 `omniReference.suggestion.*` 无模型键）。 */
  const modelMentionItems: MentionPickerItem[] = kindedMediaModels.map((model) => {
    const available = isModelAvailable(model);
    const index = referenceSuggestionIndexes.get(`model:${model.mediaKind}:${model.value}`);
    return {
      key: `model:${model.mediaKind}:${model.value}`,
      domId: index == null ? undefined : `chat-reference-suggestion-${index}`,
      label: modelName(model.value),
      icon: MEDIA_KIND_ICONS[model.mediaKind],
      badge: available ? t(MEDIA_KIND_LABELS[model.mediaKind]) : t('未配置'),
      disabled: !available,
      title: available ? model.description : t('请先配置对应供应商'),
      onSelect: () => insertModelMention(model),
    };
  });

  /* ★ 官方 §4 的分区清单 + 渲染顺序 + gate：**段为空 ⇒ 整段不 push**（铁律：缺数据不造空段）。
     官方还有「元素库·个人/团队、个人/团队素材库、指令」四类段，MTV 没有这些域的数据
     ⇒ 一律不出现（`MentionSuggestionPanel.tsx:31-36` 已写明 MTV 无这些域）。 */
  const mentionGroups: MentionPickerGroup[] = [];
  if (nodeMentionItems.length > 0) {
    mentionGroups.push({
      id: 'nodes',
      /* ★ 官方聊天宿主逐字传的 `linkedSectionLabel`（r127 @2578264）⇒ 标题 =「添加参考」，
         不是不传 label 时的兜底 `linkedNodeSection`「已连接节点」（详见文件头 import 注释）。 */
      label: t('chatAdapter.context.addReference'),
      /* 官方全列表**只有这一段带 `hint`**（规格书 §4 #1；r127 @257958 逐字）。 */
      hint: MENTION_LINKED_HINT,
      items: nodeMentionItems,
    });
  }
  if (pluginMentionItems.length > 0) {
    mentionGroups.push({ id: 'plugins', label: MENTION_PLUGIN_SECTION, items: pluginMentionItems });
  }
  if (dramaMentionItems.length > 0) {
    mentionGroups.push({ id: 'assets', label: MENTION_PRIVATE_SECTION, items: dramaMentionItems });
  }

  const activeSuggestionId = modelMenuOpen
    ? (referenceSuggestions.length > 0
      ? `chat-reference-suggestion-${resolvedActiveSuggestionIndex}`
      : undefined)
    : skillMenuOpen && skillSuggestions.length > 0
      ? `chat-skill-suggestion-${resolvedActiveSuggestionIndex}`
      : undefined;

  const handleUploadSkill = useCallback(async (source: 'file' | 'folder' = 'file') => {
    if (skillUploading) return;
    setSkillUploading(true);
    try {
      await uploadSkill(source);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('上传 Skill 失败'), 'error');
    } finally {
      setSkillUploading(false);
    }
  }, [showToast, skillUploading, t, uploadSkill]);

  // 自动聚焦
  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  /* ★ `chat-open-reference-menu`（点消息里的 `@model{}` 芯片触发）→ 打开**模型菜单**，
     不是官方 `@` 面板：旧实现 `setPickerTab('models')` 打开的是 `@` 面板的模型 Tab，
     模型段按官方移除后那条路会开出一个**没有模型行的空面板**（死胡同）⇒ 已改为走 `'model'` 口。 */
  useEffect(() => {
    const openModelReferences = () => {
      setSkillMenuOpen(false);
      setSkillQuery('');
      setReferencePickerMode('model');
      setMediaKind('all');
      setModelQuery('');
      setModelMenuOpen(true);
      setActiveSuggestionIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener('chat-open-reference-menu', openModelReferences);
    return () => window.removeEventListener('chat-open-reference-menu', openModelReferences);
  }, []);

  return (
    <div className="c-composer chat-panel-input-area flex-shrink-0">
      {/* 官方拖放：整卡接 `dragenter/dragover/dragleave/drop`，命中时叠官方 `Cle` 覆盖层。 */}
      <div
        className={`c-composer__card chat-panel-input-box relative${dropOver ? ' is-drop-over' : ''}`}
        /* 官方 `CanvasInputV2`（canvas @2545516）的输入气泡锚点，逐字：
           `"data-canvas-input-bubble":!0, "data-mention-popover-width-source":"true"`。
           `@` 建议弹层靠后者对齐宽度（`B4` 的 `matchEditorWidthSelector`）。 */
        data-canvas-input-bubble="true"
        data-mention-popover-width-source="true"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 官方 `Xle`（`CanvasInputV2` @801604 `firstEntryGlow ? <Xle .../> : null`）：
            进入助手 / 切换会话时，输入卡上播放一次 2.5s 的光影（环形高光 + 底部辉光 + 顶部扫光）。 */}
        <ComposerFirstEntryGlow key={activeSessionId ?? 'no-session'} />
        <ComposerDropzone
          isDragging={dropDragging}
          isOver={dropOver}
          attachmentCount={contextStrip?.attachments?.length ?? 0}
        />
        {/* 官方 `IO`(`QueuedMessagesBar`)：生成中排队的消息条，浮在输入卡**上方**
            （`InputTopSheet` 的 `absolute bottom-full inset-x-[4%]`）。 */}
        <QueuedMessagesBar onEditItem={onEditQueuedMessage} onHeightChange={onSheetHeightChange} />
        {/* 官方 `Qie`(`AskQuestionSheet`)：提问面板，同样挂在 `bottom-full` 层
            （官方画布页挂载点偏移 2780165，参数 `{onAnswer, onFreeTextStart, onHeightChange, suppressed}`）。
            可见性由 store 的 `pendingQuestion.status === "pending"` 决定（官方 `rq` 选择器）。 */}
        <AskQuestionSheet
          onAnswer={onAnswerQuestion ?? (() => {})}
          onHeightChange={onSheetHeightChange}
          suppressed={!pendingQuestionVisible}
        />
        {/* 官方 `Tue`(`TodoQueueSheet`)：待办胶囊，同一个 `bottom-full` 层
            （`data-task-mode-active-capsule`）。数据来自消息上的 `todoSnapshot`（暂无生产者）。 */}
        <TodoQueueSheet visible={!!todoSnapshot} activeTodo={todoSnapshot ?? null} />
        {/* 官方 `tae`(`GenerationAutoModeTip`)：自动生成模式提示条。
            官方挂载点 @2781326 —— 在 `relative z-10` 容器里**紧跟 `yae`(TodoQueueSheet)、
            在排队条 `fae` / 上下文条 `o` / 编辑器 `WM` 之前**（`yae` → `tae` → … → `fae` → `WM`）。
            这里同样挂在 `.c-composer__card` 之内、`TodoQueueSheet` 之后、编辑器之前
            —— 与 `QueuedMessagesBar`/`InputTopSheet` 族同一个 `bottom-full` 浮层区（`Mp` 外壳自带
            `absolute bottom-full inset-x-[4%]` ⇒ 不动任何现有 `data-*` / 类串）。 */}
        <GenerationAutoModeTip
          visible={showAutoModeTip}
          onClose={() => setAutoModeTipDismissed(true)}
        />
        {localFileGrants.length > 0 && (
          <div className="mb-2 flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
            {localFileGrants.map((grant) => (
              <span
                key={grant.id}
                title={`${grant.displayName} · ${Math.ceil(grant.size / 1024)} KB`}
                className="c-grant"
              >
                <Icon icon="lucide:file-text" width={12} className="shrink-0 opacity-70" />
                <span className="max-w-[100px] truncate">{grant.displayName}</span>
                {onRevokeLocalFile && (
                  <button
                    type="button"
                    aria-label={t('撤销 {name} 的读取授权', { name: grant.displayName })}
                    onClick={() => onRevokeLocalFile(grant.id)}
                    className="c-grant__revoke"
                  >
                    <Icon icon="lucide:x" width={11} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {/* 官方卡片内 `relative z-10` 的顺序：`qL` → `VL`(ContextStrip) → `ZL`(编辑器) → `gae`(rail)。
            `VL` 在 `m===0` 时自身 `return null` ⇒ 没有引用/附件时不占位。 */}
        <ContextStrip {...contextStrip} />
        {/* 官方 `use-chat-attachment-file-input` 的隐藏 file input（`accept` = 图片/视频/音频；
            官方常量 `$6`/`HG`）。选中后 → `addAttachment`，进 ContextStrip 的附件 chip。 */}
        <input
          ref={attachmentInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={handleAttachmentChange}
        />
        <div className="c-composer__editor">
        <ChatComposerEditor
          ref={inputRef}
          value={inputValue}
          onChange={onInputChange}
          onSubmit={onSend}
          nodeDisplayIds={nodeDisplayIds}
          onMentionQueryChange={(query) => {
            setModelMenuOpen(query != null);
            setActiveSuggestionIndex(0);
            /* ★ 敲 `@` 触发的一定是官方引用面板（分区单列表），不是模型菜单。
               MTV 旧的 `@n / @a / @m` 作用域快捷方式随 Tab 结构一并移除（Tab 已不存在）。 */
            setReferencePickerMode('mention');
            if (query == null) setMediaKind('all');
            setModelQuery(query ?? '');
            if (query != null) setSkillMenuOpen(false);
          }}
          onSlashQueryChange={(query) => {
            setSkillMenuOpen(query != null);
            setActiveSuggestionIndex(0);
            setSkillQuery(query ?? '');
            if (query != null) setModelMenuOpen(false);
          }}
          onSuggestionKeyDown={handleSuggestionKeyDown}
          suggestionListId={modelMenuOpen ? REFERENCE_SUGGESTION_LIST_ID : SKILL_SUGGESTION_LIST_ID}
          activeSuggestionId={activeSuggestionId}
          suggestionsOpen={modelMenuOpen || skillMenuOpen}
          /* 官方窄版占位 `chatAdapter.input.placeholderCompact`（zh「随心输入」）；
             宽版由 `ChatComposerEditor` 按 `@[480px]` 容器查询切成官方长句。 */
          placeholder={t('随心输入')}
          disabled={disabled}
        />
        </div>

        <div
          ref={railRef}
          data-icon-only={railIconOnly || undefined}
          className="c-composer__toolbar chat-panel-input-toolbar flex h-10 min-w-0 items-center justify-between px-2 pb-2"
        >
          <AnimatePresence>
            {modelMenuOpen && (
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
              transition={reduceMotion
                ? { duration: 0.1 }
                : { type: 'spring', visualDuration: 0.22, bounce: 0 }}
              className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-20"
            >
              <MentionPicker
                listId={REFERENCE_SUGGESTION_LIST_ID}
                ariaLabel={referencePickerMode === 'model' ? t('模型') : t('节点与资产引用')}
                /* ══ ★ 官方 TapNow 的「分区单列表」口径（规格书 §1/§2/§4）══
                   官方 `Ub` 的面板 = 顶部搜索行 + **一个滚动列表 + 多分区**，
                   **没有 Tab 行、没有芯片行**（官方渲染路径在 `MentionPicker` 里已实现）。
                   ⇒ `@` 触发时传 `groups`（此时 `MentionPicker` 会跳过 Tab/芯片行）；
                      模型菜单（`chat-open-reference-menu` 触发）才用 `items` + 类型芯片。
                   ⚠️ 两处**不要**同时传：`usingGroups` 为真时 `items` 会被忽略（`MentionPicker.tsx:151-161`）。 */
                groups={referencePickerMode === 'mention' ? mentionGroups : undefined}
                items={referencePickerMode === 'model' ? modelMentionItems : []}
                /* ★ 模型口的行样式 = **官方模型菜单行**（`rounded-xl` 16px + `focus:bg-accent` #404040），
                   与官方 `@` 面板行（`rounded-[6px]` + `hover:bg-white/10`）**官方本来就不同**
                   ⇒ 只在模型口加 `mention-row--model-menu`（逐字依据见 `styles/mention-picker.css`）。 */
                modelMenu={referencePickerMode === 'model'}
                /* 模型菜单保留 MTV 的媒体类型芯片（官方 `@` 面板没有芯片行，故只在模型口出现）。 */
                chips={referencePickerMode === 'model' ? mediaKindChips : undefined}
                activeChip={referencePickerMode === 'model' ? mediaKind : undefined}
                onChipChange={(id) => {
                  setMediaKind(id);
                  setActiveSuggestionIndex(0);
                }}
                activeKey={referenceSuggestions[resolvedActiveSuggestionIndex]?.key}
                onItemHover={(key) => {
                  const index = referenceSuggestionIndexes.get(key);
                  if (index != null) setActiveSuggestionIndex(index);
                }}
                /* `@` 面板空态 = 官方 `omniReference.suggestion.noResults`（zh「暂无结果」，`MentionPicker` 默认值）；
                   模型菜单的空态是 MTV 自有文案（它不是官方 `@` 面板）—— 复用 MTV 既有的**参数化键**
                   `没有匹配"{query}"的{noun}` / `暂无可引用的{noun}`（不要写新的字面键，否则 4 个语种都查不到）。 */
                emptyText={referencePickerMode === 'model'
                  ? (modelQuery
                    ? t('没有匹配"{query}"的{noun}', { query: modelQuery, noun: t('模型') })
                    : t('暂无可引用的{noun}', { noun: t('模型') }))
                  : undefined}
              />
            </motion.div>
          )}
          </AnimatePresence>
          <AnimatePresence>
            {skillMenuOpen && (
            /* 官方 `/` 技能面板（`dce`，`page-BeI7xydN.js@778468`）**逐字**：
               挂载 `<div className="pointer-events-auto absolute bottom-full inset-x-0 z-20 mb-2">`
               面板 `text-white rounded-[16px] overflow-hidden backdrop-blur-[28px]` + `w-full max-h-[320px] overflow-hidden border-0`
                    style=`{backgroundColor:"#2f2f2f", boxShadow:"0px 4px 16px 0px rgba(0,0,0,0.16), inset 0px 0.5px 0px 0px rgba(255,255,255,0.16)"}`
               内层 `flex max-h-[320px] min-h-0 flex-col gap-2 p-2`
                 · 搜索框 `mV`（`wrapperClassName="px-0 pt-0 pb-0"`，placeholder = `chatAdapter.addMenu.skills.searchPlaceholder`）
                 · 分类标题 `w-full shrink-0 px-1 py-0 text-xs font-medium leading-[1.3] tracking-[0.48px] text-white/40`（= `chatAdapter.input.skillSlashCategory`「技能」）
                 · 滚动列表 `flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto pb-1`（外层 `gV` 带上下 h-5 渐隐）
                 · 行 `flex items-center gap-[8px] w-full px-[8px] py-[6px] text-left transition-colors rounded-[6px] cursor-pointer hover:bg-white/10`
                   + 选中态 `bg-white/10`；`onMouseDown` 阻止默认；行内容 `mG`(`Jh`)：
                   头像16 + 名称 `text-xs font-medium leading-5 text-text-text-primary max-w-[28%] shrink-0 truncate`
                   + 描述 `min-w-0 flex-1 overflow-hidden truncate text-xs font-normal leading-[18px] text-text-text-secondary`
                   + 来源 `shrink-0 text-xs font-normal leading-[18px] text-text-text-tertiary` */
            <div className="pointer-events-auto absolute bottom-full inset-x-0 z-20 mb-2">
              <div
                className="w-full max-h-[320px] overflow-hidden rounded-[16px] text-white backdrop-blur-[28px]"
                style={{
                  backgroundColor: '#2f2f2f',
                  boxShadow: '0px 4px 16px 0px rgba(0,0,0,0.16), inset 0px 0.5px 0px 0px rgba(255,255,255,0.16)',
                }}
              >
                <div className="flex max-h-[320px] min-h-0 flex-col gap-2 p-2">
                  <div className="w-full shrink-0 px-0 pt-0 pb-0" onMouseDown={(event) => event.stopPropagation()}>
                    <div className="flex h-[32px] w-full items-center gap-[6px] rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-2">
                      <Icon icon="tabler:search" width={14} height={14} className="shrink-0 text-white/40" />
                      <input
                        type="text"
                        value={skillQuery}
                        onChange={(event) => { setSkillQuery(event.target.value); setActiveSuggestionIndex(0); }}
                        placeholder={t('搜索')}
                        autoComplete="off"
                        spellCheck={false}
                        className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] leading-[18px] text-white/80 outline-none placeholder:text-white/30"
                      />
                    </div>
                  </div>
                  <p className="w-full shrink-0 px-1 py-0 text-xs font-medium leading-[1.3] tracking-[0.48px] text-white/40">
                    {t('技能')}
                  </p>
                  {/* 官方外层 `gV` = 滚动渐隐壳 `_s`(=`bN`)：上下各一条 h-5 渐变（色 `var(--popover)`），
                      阈值 1px，随滚动位置淡入淡出；滚动条隐藏。 */}
                  <OfficialScrollFade
                    className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto pb-1"
                    deps={[skillSuggestions.length]}
                  >
                    {skillSuggestions.length === 0 ? (
                      <p className="px-2 py-2 text-xs leading-[18px] text-white/40">
                        {skillQuery ? t('没有匹配"{query}"的 Skill', { query: skillQuery }) : t('暂无可调用 Skill')}
                      </p>
                    ) : skillSuggestions.map(({ skill }, index) => (
                      <button
                        key={skill.id}
                        id={`chat-skill-suggestion-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === resolvedActiveSuggestionIndex}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertSkillReference(skill.id, skill.name)}
                        className={`flex w-full cursor-pointer items-center gap-[8px] rounded-[6px] px-[8px] py-[6px] text-left transition-colors hover:bg-white/10${index === resolvedActiveSuggestionIndex ? ' bg-white/10' : ''}`}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <OfficialSkillAvatarIcon size={16} skillName={skill.name} />
                          <span className="max-w-[28%] shrink-0 truncate text-xs font-medium leading-5 text-text-text-primary">
                            {skill.name}
                          </span>
                          <span className="min-w-0 flex-1 overflow-hidden truncate text-xs font-normal leading-[18px] text-text-text-secondary">
                            {skill.description}
                          </span>
                          <span className="shrink-0 text-xs font-normal leading-[18px] text-text-text-tertiary">
                            {skill.sourceKind === 'agent-package' ? t('智能体') : t('个人')}
                          </span>
                        </span>
                      </button>
                    ))}
                  </OfficialScrollFade>
                </div>
              </div>
            </div>
          )}
          </AnimatePresence>

          {/* 官方 rail（`page-DVqoHdTT.js`@756933 逐字）：`flex h-10 min-w-0 items-center justify-between px-2 pb-2`
              + `data-icon-only`（rail 内容宽 ≤ 450 时成立）。两个簇：
                · 左簇 `flex shrink-0 items-center gap-2 transition-opacity duration-300`
                  = 「+」add 菜单 · 生成确认模式 · 桌面截图（桌面端）· 插件 Unlimited 开关
                · 右簇 `flex shrink-0 items-center gap-1.5`
                  = 模型选择器 · mic · 停止/发送
              ⚠️ MTV 多出来的 `@` / `/` / 附件 三个按钮、`↵ Enter` 提示与「上下文占用」指示器
              官方 rail 都没有 ⇒ 已移除（`@`/`/` 由编辑器输入触发；用量在官方头部第 3 颗）。 */}
          <div ref={railStartRef} className="flex shrink-0 items-center gap-2 transition-opacity duration-300">
            {/* 官方左簇第 1 颗「+」add 菜单（`fae`，PAGE@745924） */}
            <AgentAddMenu
              disabled={disabled}
              uploading={skillUploading}
              showAddLocalFolder={IS_TAURI && !!onAuthorizeLocalFiles}
              onInsertFromCanvas={() => {
                /* 官方 `L`（PAGE@758100）：`_S(canvasId); Gr.getState().enterMode(canvasId); closeMenu();`
                   —— 不是打开 MTV 的 `@` 引用面板，而是让**整块画布进入拾取模式**：
                   之后点画布节点 = 加/减本轮引用（见 `Canvas.tsx` 的 `onNodeClick`），
                   画布顶部同时出现官方 `IW` 浮条（`InsertFromCanvasPickToolbar`）。 */
                enterInsertFromCanvasPick();
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              onAddLocalDirectory={() => onAuthorizeLocalFiles?.()}
          onUploadAttachment={handleUploadAttachment}
              skills={skillSuggestions.map(({ skill }) => ({ id: skill.id, name: skill.name, description: skill.description }))}
              skillUploading={skillUploading}
              onSelectSkill={(skill: { id: string; name: string }) => insertSkillReference(skill.id, skill.name)}
              onUploadSkillFile={() => { void handleUploadSkill('file'); }}
              onUploadSkillFolder={() => { void handleUploadSkill('folder'); }}
              /* 官方 `chatAdapter.addMenu.skills.manageSkill`（zh「管理技能」）——
                 打开官方形态的管理对话框（应用/技能 页签 + 搜索 + 顶部「添加」菜单 + 双列卡片）。 */
              onManageSkills={() => setSkillManagerOpen(true)}
              /* 官方 `chatAdapter.addMenu.skills.createSkill`（zh「创建技能」）——
                 打开官方形态的创建对话框（技能名称/描述/指令）。 */
              onCreateSkill={() => setSkillCreateOpen(true)}
              brainstormActive={brainstormMode}
              onToggleBrainstorm={onToggleBrainstorm}
            />
            {onAgentModeChange && (
              <GenerationConfirmModeSwitch
                mode={agentMode}
                onChange={onAgentModeChange}
                disabled={agentModeDisabled}
                iconOnly={railIconOnly}
                addButtonAlignRef={railStartRef}
              />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <div className="shrink-0 transition-opacity duration-300">
              <ModelSelector
                nodeType="ai-text"
                selectedModel={selectedTextModel}
                onSelect={handleTextModelSelect}
                configuredGroupsOverride={assistantModelGroups}
                generalModelsOverride={mediaModels}
                groupAvailability={modelGroupAvailability}
                /* 官方**聊天输入条**的模型胶囊是 `Ae`（**有** `chevron-down`），
                   与节点面板那颗（官方 `Sme`，**没有**箭头）不是同一个组件
                   ⇒ 这里注入官方胶囊，替换掉节点面板的默认触发钮（见 `ChatModelChip.tsx`，live DOM 实测对齐）。 */
                renderTrigger={({ open, label, icon, toggle, secondary }) => (
                  <ChatModelChip
                    label={label}
                    /* 官方口径（用户实测）：**`Auto` 态前面没有模型图标**，只有选了具体模型才出现该模型的图标。 */
                    icon={modelIsAuto ? undefined : icon}
                    open={open}
                    /* 官方 `Ae` 的 `H`（偏移 91841）：`bq(选中模型, chatModelThinkingSettings[选中模型], t)`
                       ⇒ 档位标签 / 「思考关闭」。`ChatModelChip` 里那个 span 的类名就是官方逐字。 */
                    secondary={secondary ?? undefined}
                    /* ⚠️ **不要**给模型胶囊传 `iconOnly={railIconOnly}`（原来有）—— 那不是官方行为。
                       官方聊天工具条里模型胶囊的**唯一**渲染点（canvas，`oK`/`vbe` 同层）逐字是：
                         `s.jsx(vbe,{disabled:q,onModelComparisonClick:o,onSubscriptionUnlockClick:r})`
                       `vbe` → `Eq=memo(bbe)`，`bbe=({menuSide="top",disabled=!1,**iconOnly=!1**,…})`
                       ⇒ **根本没传 `iconOnly`**，吃默认 `false` ⇒ 胶囊**永远显示文案**（`Auto ▾`）。
                       那个 rail 宽度 `oe = y!==null && y<=450`（`Dst=450`）在官方只喂给两处：
                         · rail 自己的 `data-icon-only={oe||void 0}`；
                         · 确认模式开关 `s.jsx(oK,{addButtonAlignRef:f,disabled:q,iconOnly:oe})`。
                       对模型胶囊，`oe` 的**唯一**作用是录音时整块隐藏：
                         `oe && te!==wo.Idle ? null : <div …><s.jsx(vbe,{…})/></div>`
                       ⇒ MTV 原来接上 `railIconOnly` = 自造，「小屏把 `Auto` 收成图标」（用户指出）。
                       改回官方：不传（默认 `false`）。 */
                    ariaLabel={label}
                    onClick={toggle}
                  />
                )}
                /* 弹层 portal 到 body，祖先选择器命中不到 ⇒ 由这里挂官方 popover 皮（`.c-pop`） */
                dropdownClassName="c-pop"
                /* 官方「模型信息 + Effort」悬浮飞出面板（`th`/`uu`/`zs`）：悬浮模型行时在行左侧弹出 */
                renderModelFlyout={(model, info) => <AgentModelFlyout model={model} info={info} />}
                /* 官方 `AgentModelPicker`（`use-chat-attachment-file-input-*.js`）形态：
                   下拉顶部多一行 Auto（`Xd()`），面板外壳走官方 popover 皮。 */
                agentStyle
                autoSelected={assistantModelIsAuto ?? !assistantModelId}
                onSelectAuto={onAssistantModelAuto ?? (() => onAssistantModelChange(undefined))}
              />
            </div>

            {hasActiveTask && onStopTask && !disabled ? (
              /* 官方「停止生成」按钮（`page-BeI7xydN.js`@770445 逐字）：
                 `size-8 rounded-full · bg-foreground/15 text-foreground · hover:bg-foreground/25 ·
                  transition-all · disabled:cursor-not-allowed disabled:opacity-45`，
                 图标 **`N4`** = `index-*.js` 的 `oV` → `bB = F("square")` ⇒ lucide `square`，
                 挂载逐字 `<N4 size={14} fill="currentColor" strokeWidth={0} />`（14px 实心方块），
                 tooltip `chatAdapter.tooltips.stop`（zh 停止 / en Stop）。
                 官方是「停止 / 发送」二选一：生成中只显示停止。 */
              <button
                type="button"
                onClick={onStopTask}
                disabled={disabled}
                aria-label={t('停止')}
                title={t('停止')}
                className="size-8 shrink-0 cursor-pointer rounded-full flex items-center justify-center bg-foreground/15 text-foreground hover:bg-foreground/25 transition-all disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-foreground/15"
              >
                <Icon icon="lucide:square" width={14} height={14} style={{ fill: 'currentColor', stroke: 'none' }} />
              </button>
            ) : (
              /* 官方发送钮（`page-BeI7xydN.js`@770445）：`relative size-8 rounded-full overflow-visible
                 flex items-center justify-center bg-white text-black hover:bg-white/80 transition-all
                 disabled:opacity-50 disabled:cursor-not-allowed`
                 + 图标 **`I4`** = `index-*.js` 的 `n0` → `FE = F("arrow-up")` ⇒ lucide `arrow-up`，
                 挂载逐字 `<I4 className="relative z-[1] text-current" size={18} strokeWidth={2} />`。
                 （老注释把发送钮记成官方 `cz` 是跨 chunk 撞名 —— `cz` 实为 `THREE.Vector2`，已纠正。） */
              <button
                type="button"
                onClick={onSend}
                disabled={!inputValue.trim() || disabled}
                aria-label={hasActiveTask ? t('将消息加入队列') : t('发送消息')}
                title={hasActiveTask ? t('当前任务完成后发送') : t('发送消息')}
                className="c-send chat-panel-send-btn relative size-8 shrink-0 cursor-pointer overflow-visible rounded-full flex items-center justify-center bg-white text-black hover:bg-white/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon icon="lucide:arrow-up" width={18} height={18} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
      {/* 官方「管理技能」对话框（应用/技能 页签 + 搜索 + 添加菜单 + 双列卡片）。 */}
      <SkillsManagerDialog
        open={skillManagerOpen}
        onClose={() => setSkillManagerOpen(false)}
        onCreateSkill={() => setSkillCreateOpen(true)}
        onUploadSkillFile={() => { void handleUploadSkill('file'); }}
        onUploadSkillFolder={() => { void handleUploadSkill('folder'); }}
        /* 官方技能详情页右下角「在对话中使用」：插引用 + 关面板（复用既有的 `insertSkillReference`）。 */
        onUseSkill={(skill) => insertSkillReference(skill.id, skill.name)}
      />
      {/* 官方「创建技能」对话框（返回 = 回管理面板）。 */}
      <SkillCreateDialog
        open={skillCreateOpen}
        onClose={() => setSkillCreateOpen(false)}
        onBack={() => { setSkillCreateOpen(false); setSkillManagerOpen(true); }}
      />
    </div>
  );
}
