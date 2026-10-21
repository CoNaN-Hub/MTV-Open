/**
 * ModelSelector 模型选择器 — 下拉面板选择 AI 模型或工作流，支持按供应商分组折叠、搜索过滤、当前选中高亮
 * 未配置 API Key 的供应商分组自动禁用（锁图标 + tooltip + 不可展开）
 * 自动检测上下空间，向上或向下弹出
 */
import { findModelLogo } from '../../../utils/modelLogos';
import { officialCardMeta, nodeTypeToModelFamily } from '../../../utils/officialModelDisplay';
/* ★ 模型名的唯一出口：界面只显示 displayName（映射配置 → 官方 Registry → 原始平台 id）*/
import { displayNameOfModelRef } from '../../../services/models/display';
import { hasOfficialModelIcon } from '../../../utils/officialModelIcons';
/* 说明文案表（纯数据；名字不在这里 —— 唯一来源是 `services/models/display`）*/
import { modelDescriptionOverride } from '../../../data/modelDescriptions';
import OfficialModelIcon from '../../shared/OfficialModelIcon';
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useFlyoutPosition, useModelRowFlyout } from '../../chat/useModelRowFlyout';
import { ModelPickerFlyout } from '../../chat/ModelPickerFlyout';
import CanvasModelFlyout from './CanvasModelFlyout';
import { isAsyncModel, stripAsyncToken } from '../../../utils/modelAsync';
import type {
  GeneralModelConfig,
  NodeType,
  ModelOption,
  ModelGroup,
  WorkflowDefinition,
} from '../../../types';
import { getWorkflowCategory } from '../../../types';
import {
  defaultModelGroups,
  getConfiguredModelGroups,
  getGeneralModelGroups,
} from './defaultModels';
import { useAppStore } from '../../../store/useAppStore';
import { getLocale, useT } from '../../../i18n';
/* ★ 官方「模型思考徽标」(`bq`)：关闭态文案 = `chatAdapter.modelOptions.thinkingOff`（zh「思考关闭」）
     —— 逐字取证 / 条件 / class 见 `services/chat/thinkingBadge.ts` 文件头。 */
import { MODEL_ROW_SUMMARY_CLASS, modelRowThinkingSummary, modelThinkingSummary } from '../../../services/chat/thinkingBadge';
import ProviderBadge from '../../shared/ProviderBadge';
import { comfyBaseUrlFor, DEFAULT_COMFY_URL, probeComfyServer } from '../../../services/comfyServers';

const MODEL_PREF_KEY = 'canvas-model-prefs';

/**
 * 下拉面板 portal 到 `<body>`（= 官方 Radix Portal ✓，避免被 `.prompt-panel { overflow:hidden }` 裁掉）。
 * ⚠️ vitest 跑在 `environment: 'node'`，`document` 被 stub 成没有 `body` 的对象 ✗ →
 *    `createPortal(node, document.body)` 会抛 `Target container is not a DOM element` ✗✓
 * → **没有 DOM 时内联渲染同一棵节点树** ✓；真实浏览器 / Tauri WebView 永远有 `document.body` ✓
 *   → 生产行为不变（仍是 portal ✓），测试环境也不再抛错 ✓
 */
function withPortal(node: ReactElement): ReactElement {
  if (typeof document === 'undefined' || !document.body) return node;
  return createPortal(node, document.body);
}

/** 官方 Auto 行 `aria-*` id 的模块级自增序号（避免 `useId()`，见组件内的说明）。 */
let autoIdSeq = 0;


/**
 * 没有独立模型清单的节点类型，借用哪一类的模型和偏好。
 * 分镜表让文本模型把剧本拆成表格行，用的就是生文那批模型。
 */
const MODEL_TYPE_FALLBACK: Partial<Record<NodeType, NodeType>> = {
  'ai-panorama': 'ai-image',
  'ai-animation': 'ai-image',
  'ai-shotlist': 'ai-text',
};

function loadModelPrefs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MODEL_PREF_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveModelPref(nodeType: string, modelValue: string) {
  try {
    const prefs = loadModelPrefs();
    prefs[nodeType] = modelValue;
    // 生图模型选择时同步到全景图节点
    if (nodeType === 'ai-image') {
      prefs['ai-panorama'] = modelValue;
    }
    localStorage.setItem(MODEL_PREF_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

interface ModelSelectorProps {
  nodeType: NodeType;
  selectedModel?: string;
  selectedProvider?: string;
  selectedWorkflowId?: string;
  onSelect: (model: ModelOption) => void;
  onWorkflowSelect?: (workflowId: string | undefined) => void;
  groups?: ModelGroup[];
  /** 已由可信宿主按配置筛选的模型分组；用于没有完整配置的独立窗口。 */
  configuredGroupsOverride?: ModelGroup[];
  workflows?: WorkflowDefinition[];
  generalModelsOverride?: GeneralModelConfig[];
  groupAvailability?: Record<string, boolean>;
  /**
   * 弹层追加类名。弹层是 `createPortal(document.body)` 的 ⇒ 宿主的祖先选择器命中不到它，
   * 需要按宿主皮肤定制的场合（例：助手面板传 `c-pop` 走官方 popover 皮）用这个。
   */
  dropdownClassName?: string;
  /**
   * 官方**聊天输入条**的模型胶囊（`Ae`）由调用方注入时，用它替换默认触发钮
   * （节点面板不传 ⇒ 外观与行为完全不变）。官方 `Ae` 与节点面板的触发钮**不是同一个组件**：
   * 节点面板那颗按官方 `Sme` **没有向下箭头**，聊天胶囊则有 `chevron-down`。
   */
  renderTrigger?: (api: {
    open: boolean;
    label: string;
    icon: ReactNode;
    toggle: () => void;
    /**
     * 官方 `Ae` 的 `H`（`bq(选中模型, chatModelThinkingSettings[选中模型], t)`，偏移 91841）：
     * 档位标签 / 「思考关闭」/ `null`。官方渲染成
     * `ml-1 shrink-0 border-l border-border/60 pl-1.5 text-[11px] leading-4 text-text-text-secondary`
     * 的 span（`ChatModelChip` 的 `secondary` 槽逐字就是这个类名）⇒ 注入方原样透传即可。
     */
    secondary: string | null;
  }) => ReactNode;
  /**
   * 官方「模型信息 + Effort」悬浮飞出面板（`uu`/`th`/`zs`）：返回节点 ⇒ 鼠标悬浮该模型行时
   * 在行**左侧**弹出（`fixed z-120 w-[240px]` + 6px 过桥 + 400ms 迟滞 + 安全三角）。
   * 返回 `null`/`undefined` 则该行不出面板（与官方对「无 thinking、无能力评分」的模型一致）。
   */
  renderModelFlyout?: (model: ModelOption, info: ModelFlyoutInfo) => ReactNode;
  /**
   * 助手面板专用：按官方 `AgentModelPicker` 的形态渲染 —— 下拉顶部多一行 **Auto**
   * （官方 `Xd()`：`{id: Se, label: display_name || 'Auto', labelKey: 'chatAdapter.modelOptions.labels.auto'}`，
   * 行样式 `min-h-12 … rounded-md py-1.5 pr-2 pl-3` + 选中态 `bg-accent/85` + 右侧 15×15 tabler-check），
   * 面板外壳走 `.agent-model-picker`（官方 `w-fit overflow-visible rounded-2xl border border-border/50 bg-popover p-0 shadow-lg`）。
   * 画布节点那一侧**不传**，行为完全不变。
   */
  agentStyle?: boolean;
  /** 官方 Auto 行是否处于选中态（MTV：`assistantModelId` 未指定 ⇒ 交给候选解析器自动挑）。 */
  autoSelected?: boolean;
  /** 官方 Auto 行点击。 */
  onSelectAuto?: () => void;
}

/** 说明卡上要用的展示信息（名字走 `modelDisplayName`，简介走官方卡 → 覆盖表 → 模型自身）。 */
export interface ModelFlyoutInfo {
  displayName: string;
  description: string | null;
  /** 官方图标 key（有则卡片标题行左侧画官方图标，与列表行同源）。 */
  iconKey?: string | null;
  /** 本节点对应的官方模型族（`image`/`video`/`audio`/`text`/`threeD`）——
   *  说明卡在没有官方身份时用它给出「类型」那一行。 */
  family?: import('../../../utils/officialModelDisplay').ModelFamily | null;
}

/** 画布说明卡宽度：按参考图比例（比聊天侧 240 宽，比上一版 320 收窄）。 */
const CANVAS_FLYOUT_WIDTH = 288;
/** 画布说明卡与模型列表之间的可见间隙（参考图里是明显留白，不是贴边）。 */
const CANVAS_FLYOUT_GAP = 16;

export default function ModelSelector({
  nodeType,
  selectedModel,
  selectedWorkflowId,
  onSelect,
  onWorkflowSelect,
  groups = defaultModelGroups,
  configuredGroupsOverride,
  workflows = [],
  generalModelsOverride,
  groupAvailability,
  dropdownClassName,
  renderTrigger,
  renderModelFlyout,
  agentStyle = false,
  autoSelected = false,
  onSelectAuto,
}: ModelSelectorProps) {
  const t = useT();
  /** 官方 Auto 行的 `aria-labelledby` / `aria-describedby`。
   *  ⚠️ 不用 `useId()`：本仓的组件测试跑在 node 环境且 React 被 stub 成没有 `useId`
   *  （`modelSelectorWorkflows.test.tsx` 会 `Cannot read properties of null (reading 'useId')`）。
   *  改用模块级自增计数器 + 惰性初始化，等价。 */
  const [autoIds] = useState(() => {
    autoIdSeq += 1;
    return { label: `agent-model-auto-label-${autoIdSeq}`, desc: `agent-model-auto-desc-${autoIdSeq}` };
  });
  const [open, setOpen] = useState(false);
  const [editorOpening, setEditorOpening] = useState(false);
  const editorOpeningRef = useRef(false);
  const [workflowsCollapsed, setWorkflowsCollapsed] = useState(true);
  const [availableComfyUrls, setAvailableComfyUrls] = useState<Record<string, boolean>>({});
  const modelNodeType = MODEL_TYPE_FALLBACK[nodeType] ?? nodeType;

  // 读取配置 — 判断哪些 provider 有 API Key
  const config = useAppStore((s) => s.config);
  const configProviders = config.providers;
  const configuredGeneralModels = useMemo(() => config.generalModels ?? [], [config.generalModels]);

  /* ★★★★★ **官方「模型思考徽标」**（`bq`，偏移 56177）✓✓
     `bq(model, settings, t)` 读的 store 字段就是 **`chatModelThinkingSettings[model.id]`**
     （官方调用处 `const ke=r?.[fe.id], we=dye(fe,ke)?bq(fe,ke,L):null`，偏移 86944）。
     文案：`enabled === false` ⇒ `chatAdapter.modelOptions.thinkingOff`（zh「思考关闭」，官方 zh 字典 4218048）；
           开 ⇒ `chatAdapter.modelOptions.levels.<level>`（zh 低/中/高/极高/极高/最高，同址 4218020 邻域）。
     ⚠️ 官方两处并不同口径，这里分别逐字对应（§82.8）：
       · **列表行**（`modelRowThinkingSummary`）= `dye(...) ? bq(...) : null`
         ⇒ 关闭态**行上不渲染任何徽标**（`dye` 在 `enabled===false` 时恒 false）。
       · **触发器**（`modelThinkingSummary`，官方 `Ae` 的 `H` @91841）= 只有 `bq`
         ⇒ 关闭态在触发器上渲染「思考关闭」。
     元数据来源与思考控件同口径（`resolveThinkingMetaForModel`，见 `thinkingBadge.ts` 文件头）。
     ⚠️ `getLocale()` 本身不订阅语言切换，但本组件开头已 `useT()`（内部 `useSyncExternalStore`）⇒ 切语言会重渲染。 */
  const thinkingSettings = useAppStore((s) => s.chatModelThinkingSettings);
  /** 官方**行**：`dye ? bq : null`（关闭态不渲染）。 */
  const rowThinkingSummaryOf = useCallback(
    (model: ModelOption) => modelRowThinkingSummary(model, thinkingSettings?.[model.value], getLocale()),
    [thinkingSettings],
  );
  /** 官方**触发器** `H`：只有 `bq`（关闭态渲染「思考关闭」）。 */
  const triggerThinkingSummaryOf = useCallback(
    (model: ModelOption) => modelThinkingSummary(model, thinkingSettings?.[model.value], getLocale()),
    [thinkingSettings],
  );

  /** ★★★★★ **模型 → 官方能力表的候选名** ✓✓（用户："模型选择内的模型名 + 下面几K 都对齐官方的" ✓）
   *  自定义连接：value 是 `general/<id>` ✗ 没有官方模型名 → 用同一配置里的
   *    `modelId`（上游真实模型名 ✓）与 `name`（可读名 ✓）一起匹配官方表 ✓
   *  ⚠️⚠️ **匹配前必须先去掉连接名前缀** ✗✓（用户："映射土豆是 不是土豆的名字 我让你强制改了官方的
   *        这样才判定失误了" ✓）—— 名字形如「**土豆**gpt-image-2-all」时：
   *        带前缀去匹配 → 可能被判到**错的官方模型**（甚至两条不同模型判成同一个 → 看着就是「重复」✗）
   *        → 这里统一剥掉连接名前缀再当候选 ✓（`modelId` 本来就干净 ✓）
   *  → 命中后：**名称**用官方 `imageModels.name.*` ✓ · **下方 chip** 用官方分辨率值 ✓ */
  const modelAliasKey = useCallback((model: { value: string; label?: string }) => {
    if (model.value.startsWith('general/')) {
      const cfg = configuredGeneralModels.find((m) => `general/${m.id}` === model.value);
      if (cfg) {
        const connectionName = configProviders[cfg.providerConfigId]?.name;
        const strip = (raw?: string) => (connectionName && connectionName.length >= 2 && raw?.startsWith(connectionName)
          ? raw.slice(connectionName.length).trim()
          : raw);
        return [model.value, cfg.modelId, strip(cfg.name), strip(model.label)];
      }
    }
    return [model.value, model.label];
  }, [configuredGeneralModels, configProviders]);

  /** ★★★★★ **本节点对应的官方模型族** ✓✓（用户："不同卡片可选择的模型都不一样 —— 文本/图片/视频/音频/3D" ✓）
   *  图片/全景图/逐帧动画 → image ✓ · 视频 → video ✓ · 音频 → audio ✓
   *  文本/分镜表/镜头表/导演台 → text ✓（官方分族 ✓ 见 utilities/officialModelDisplay ✓）*/
  const modelFamily = useMemo(() => nodeTypeToModelFamily(modelNodeType), [modelNodeType]);
  /**
   * 该模型在本族的官方模型卡元信息 —— **只有 图标 / 分辨率标签 / 简介**。
   *
   * ⚠️ 名称**不在这里**：唯一来源是上面的 `modelDisplayName()`
   *    （`services/models/display`：映射配置 → 官方 Registry → 原始调用 id）。
   *    原来这里还兜一层「官方匹配不到就剥连接名前缀当名字」，属于被点名删除的
   *    猜测式命名，已移除 ✗。
   */
  const cardMeta = useCallback(
    (model: { value: string; label?: string }) => officialCardMeta(modelAliasKey(model), modelFamily),
    [modelAliasKey, modelFamily],
  );
  /**
   * ★★★★★ **界面上的模型名只走这一个函数**。
   *
   * 优先级由 `services/models` 的归一化器决定（映射配置 → 官方 Registry → 原始平台 id），
   * 组件层不再自己拼名字、不再剥连接名前缀、不再查官方表。
   * 下拉行 / 触发器 / 首字母兜底 / 图标兜底全部用它 ⇒ 天然一致。
   */
  const modelDisplayName = useCallback(
    (model: { value: string; label?: string }) => displayNameOfModelRef(model.value, {
      generalModels: configuredGeneralModels,
      providers: config.providers,
    }) || model.label || '',
    [configuredGeneralModels, config.providers],
  );

  const dreaminaLoggedIn = !!config.dreaminaAuth?.loggedIn;
  const generalModels = generalModelsOverride ?? configuredGeneralModels;

  const configuredGroups = useMemo(
    () => configuredGroupsOverride ?? getConfiguredModelGroups(config, modelNodeType, groups, {
      filterSelectedModels: groups === defaultModelGroups,
    }),
    [config, configuredGroupsOverride, groups, modelNodeType],
  );

  /** 通用执行协议保持不变，只把有独立品牌展示的内置连接拆成厂商分组。 */
  const generalModelGroups = useMemo(() => getGeneralModelGroups(
    generalModels,
    config,
    modelNodeType,
    {
      genericName: t('通用模型'),
      genericDescription: t('用户自定义的兼容接口模型'),
    },
  ), [config, generalModels, modelNodeType, t]);

  /** 合并默认分组与通用模型分组 */
  const allGroups = useMemo(() => {
    return [...configuredGroups, ...generalModelGroups];
  }, [configuredGroups, generalModelGroups]);

  /** 判断某个 group 是否可用（该 group 的 provider 已配置 API Key） */
  const isGroupAvailable = useCallback(
    (groupId: string) => {
      // 独立窗口只接收主窗口已经筛选过的分组，不持有厂商凭据。
      if (configuredGroupsOverride?.some((group) => group.id === groupId)) return true;
      // 通用模型分组：每个模型自带 API Key，始终可用
      if (groupId === 'general-models' || groupId.startsWith('general-provider-')) return true;
      if (groupAvailability && groupId in groupAvailability) {
        return groupAvailability[groupId];
      }
      // 即梦：走 OAuth 登录，无 API Key，按登录态判定
      if (groupId === 'dreamina') return dreaminaLoggedIn;
      const providerKey = groupId === 'runninghubwf'
        ? 'runninghub'
        : groupId === 'runninghub'
          ? 'runninghub-model'
          : groupId;
      const provider = configProviders[providerKey];
      return !!provider?.apiKey;
    },
    [configProviders, configuredGroupsOverride, dreaminaLoggedIn, groupAvailability],
  );
  const ref = useRef<HTMLDivElement>(null);

  // 动态计算下拉弹出方向
  const [dropdownDir, setDropdownDir] = useState<'up' | 'down'>('up');
  const [dropdownAlignRight, setDropdownAlignRight] = useState(false);
  /* ★★★★★ **弹窗 portal 到 body + fixed 定位** ✓✓（= 官方 Radix Portal ✓）
     事故（用户："弹窗被遮挡了" ✓）：
       实测 ✓ → **`.prompt-panel { overflow: hidden }`** ✗✓ 把下拉裁掉了 ✓
         祖先链：`.prompt-panel`(ovf=hidden) ← `.ai-dialog-float`(z=200, 有 transform) ✗
       官方用 Radix Portal ✓ → 渲染到 body ✓ → 永不被裁 ✓
       ⚠️ 光加 `position: fixed` 也逃不掉 ✗ —— 祖先有 transform ✗ → **必须真 portal** ✓
     定位照官方 ✓：side=**top**（不够则翻到 bottom ✓）· align=**start**（左对齐 ✓）· sideOffset=**8** ✓ */
  const popupRef = useRef<HTMLDivElement>(null);
  /* 官方模型行悬浮飞出面板（`th`/`uu`/`zs`）：当前悬浮的模型 + 该行的 DOM 锚点。
     `ju`=悬浮意图状态机 · `th` 的定位用 `Wu`/`Yu`（在行左侧，6px 过桥）。 */
  const [flyoutModel, setFlyoutModel] = useState<ModelOption | null>(null);
  /* 官方画布侧与 Agent 侧共用同一个飞出面板；画布调用方（PromptPanel / VideoNodeControls …）
     以前都没传 `renderModelFlyout` ⇒ 节点上的「选择模型」hover 什么都不出。
     这里给画布默认版（同一套官方 `uu` 面板，但不带 Agent 的思考档位控件），
     显式传入 `renderModelFlyout` 的聊天侧行为不变。 */
  const flyoutRenderer = renderModelFlyout
    ?? ((model: ModelOption, info: ModelFlyoutInfo) => <CanvasModelFlyout model={model} info={info} />);
  /* 用户口径（2026-10 二次裁决）：**每个模型都要有说明卡**。
     原来这里只按 Framia 目录取卡（`hasFramiaModelInfo`）⇒ 土豆这类自定义连接的模型
     整片空白（用户实测：「Nano Banana 2 / 2.1 的说明卡呢？」）。
     现在「有没有卡」不再由目录决定：`CanvasModelFlyout` 永远返回一张卡
     （官方目录命中 ⇒ 完整卡；命中不到 ⇒ 最小卡 + 「官方目录未收录」脚注）。 */
  const flyoutEnabled = (model: ModelOption | null) => !!model;
  const flyoutAnchorRef = useRef<HTMLElement | null>(null);
  const {
    onRowEnter: onFlyoutRowEnter,
    panelRef: flyoutPanelRef,
    rowRefs: flyoutRowRefs,
  } = useModelRowFlyout(open ? (flyoutModel?.value ?? null) : null);
  const flyoutPosition = useFlyoutPosition({
    active: open && flyoutEnabled(flyoutModel),
    /* ★ 换行必须重算：`active` 跨行时一直是 true，只靠它面板会钉在第一次悬停那一行。 */
    anchorKey: flyoutModel?.value ?? null,
    width: CANVAS_FLYOUT_WIDTH,
    gap: CANVAS_FLYOUT_GAP,
    anchorRef: flyoutAnchorRef,
    panelRef: flyoutPanelRef,
    containerRef: popupRef,
  });
  const measureDropdown = useCallback(() => {
    /* 官方 `AgentModelPicker` 的锚点是 **Radix `Popover.Trigger` 那个真实元素**：
       `use-chat-attachment-file-input-*.js` 里 `<Popover.Trigger asChild>` 包住模型胶囊，
       Radix 把 ref 挂在胶囊上 ⇒ 弹层几何（`align="end"` / `alignOffset` / `sideOffset=8` /
       `side` 翻转）全部由**胶囊自身的 rect** 推导。
       ⚠️ MTV 这里原来只查 `.model-selector-trigger`（= 本组件默认触发钮的类名）。
       而**聊天输入条**走的是 `renderTrigger`（传入官方胶囊 `ChatModelChip`，类名不是它）
       ⇒ `triggerEl === null` ⇒ 本函数直接 return ⇒ `.model-dropdown { position: fixed; left: 0; top: 0 }`
       连一次定位都没拿到 ⇒ **弹层贴在整个窗口左上角**（用户实测复现，截图里就是窗口左上角那坨）。
       修法：按官方语义找「真正的触发元素」——默认触发钮 → 官方胶囊（`data-slot="dropdown-menu-trigger"`）
       → 兜底本组件内的第一颗 button。 */
    const triggerEl = ref.current?.querySelector('.model-selector-trigger')
      ?? ref.current?.querySelector('[data-slot="dropdown-menu-trigger"]')
      ?? ref.current?.querySelector('button');
    const pop = popupRef.current;
    if (!triggerEl || !pop) return;
    const t = triggerEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const PADDING = 8;
    /* 官方 max-h-[400px] ✓（用它做翻转判断的阈值 ✓）*/
    const H = Math.min(pop.offsetHeight || 400, 400);
    const W = pop.offsetWidth || 280;
    const spaceAbove = t.top - PADDING;
    const spaceBelow = vh - t.bottom - PADDING;
    const dir: 'up' | 'down' = spaceAbove >= H || spaceAbove >= spaceBelow ? 'up' : 'down';
    /* ★ 官方 `AgentModelPicker`（`use-chat-attachment-file-input-*.js`）：
         `<Popover.Content align="end" alignOffset={compact ? -40 : 0} side={side} sideOffset={8}>`
       ⇒ **永远是 align="end"**（内容右边缘贴触发器右边缘），不是「溢出才右对齐」；
         窄屏（`data-icon-only`，官方 `compact`）再整体左移 40px。
       之前这里写的是「默认左对齐、溢出才右对齐」⇒ 位置一直不对（用户实测），
       而且模型名一长、触发器变宽，左对齐的位移就更明显。 */
    const compact = triggerEl.getAttribute('data-icon-only') !== null;
    const alignOffset = compact ? -40 : 0;
    const endAligned = Math.max(PADDING, t.right - W + alignOffset);
    const alignRight = true;
    pop.style.left = `${Math.min(endAligned, vw - W - PADDING)}px`;
    /* ★ 官方 sideOffset=8 ✓ */
    pop.style.top = dir === 'up' ? `${Math.max(PADDING, t.top - 8 - H)}px` : `${t.bottom + 8}px`;
    setDropdownDir(dir);
    setDropdownAlignRight(alignRight);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measureDropdown();
    const raf = requestAnimationFrame(measureDropdown);
    const onMove = () => measureDropdown();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, measureDropdown]);

  // 点击外部关闭（捕获阶段避免 React Flow 拦截）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      /* portal 后弹窗**不在 ref 里** ✗ → 也要判断它 ✓ 否则点弹窗内部会立刻关闭 ✗ */
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)
        && !(popupRef.current && popupRef.current.contains(target))) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handler, true);
    }
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  // Escape 键关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      window.addEventListener('keydown', handler);
    }
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // 筛选当前节点类型下可用的模型分组
  // 全景图和动画节点只复用生图模型，不复用图片节点的参数 UI
  const filteredGroups = allGroups
    .map((g) => ({
      ...g,
      models: g.models.filter((m) => m.nodeTypes.includes(modelNodeType)),
    }))
    .filter((g) => g.models.length > 0);

  // 持久化偏好：优先 props 传入的 selectedModel，其次 localStorage 中的记录
  // 全景图/动画回退到生图偏好，分镜表回退到生文偏好
  const effectiveModel = useMemo(
    () => {
      const prefs = loadModelPrefs();
      const fallbackType = MODEL_TYPE_FALLBACK[nodeType];
      return selectedModel
        || prefs[nodeType]
        || (fallbackType ? prefs[fallbackType] : undefined)
        || undefined;
    },
    [selectedModel, nodeType],
  );

  const currentGroup = effectiveModel
    ? filteredGroups.find((group) => group.models.some((model) => model.value === effectiveModel))
    : undefined;
  const currentModel = currentGroup?.models.find((model) => model.value === effectiveModel);

  const renderProviderBadge = (group: ModelGroup, model?: ModelOption, size: 'small' | 'medium' = 'medium') => {
    const generalModel = model?.provider === 'general'
      ? generalModels.find((candidate) => `general/${candidate.id}` === model.value)
      : undefined;
    const providerId = generalModel?.providerConfigId
      || (group.id.startsWith('general-provider-')
        ? group.id.slice('general-provider-'.length)
        : group.id === 'runninghub' ? 'runninghub-model'
          : group.id === 'runninghubwf' ? 'runninghub' : group.id);
    return (
      <ProviderBadge
        providerId={providerId}
        config={configProviders[providerId]}
        fallbackName={group.name}
        fallbackBadge={group.badgeText}
        size={size}
      />
    );
  };

  // 匹配当前节点类型的工作流
  const targetCategory = getWorkflowCategory(nodeType);
  const matchingWorkflows = useMemo(
    () => (targetCategory ? workflows.filter((w) => w.category === targetCategory) : []),
    [workflows, targetCategory],
  );

  // 与生成时一致：未绑定或服务器已删除时回落默认地址；云端工作流不检测 ComfyUI。
  const workflowUrls = useMemo(() => new Map(matchingWorkflows
    .filter((workflow) => !workflow.adapterType || workflow.adapterType === 'comfyui')
    .map((workflow) => {
      const bound = config.comfyServers?.find((server) => server.id === workflow.serverId)?.url;
      const normalize = (url?: string) => (url ?? '').trim().replace(/\/+$/, '');
      return [workflow.id, normalize(bound) || normalize(config.comfyUIUrl)];
    })), [matchingWorkflows, config.comfyServers, config.comfyUIUrl]);
  const probeUrlsKey = JSON.stringify([...new Set(workflowUrls.values())].filter(Boolean).sort());
  const canSelectWorkflow = !!onWorkflowSelect;
  useEffect(() => {
    if (!open || !canSelectWorkflow) return;
    const urls = JSON.parse(probeUrlsKey) as string[];
    if (urls.length === 0) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      await Promise.all(urls.map(async (url) => {
        const available = await probeComfyServer(url, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setAvailableComfyUrls((current) => ({ ...current, [url]: available }));
        }
      }));
      if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 10_000);
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, canSelectWorkflow, probeUrlsKey]);
  const visibleWorkflows = matchingWorkflows.filter((workflow) => {
    const url = workflowUrls.get(workflow.id);
    return url === undefined || availableComfyUrls[url] === true;
  });

  const currentWorkflow = selectedWorkflowId
    ? matchingWorkflows.find((w) => w.id === selectedWorkflowId)
    : undefined;
  /* ★ 空态：候选一条都没有、也没有工作流可挑时，下拉**原来什么也不渲染**
     （用户只看到触发器的「选择模型」+ 一个打不开内容的下拉）——
     分不清「这条连接没有可用模型」和「模型被删了」。这里补一句可操作的提示。
     文案复用既有词条（`AgentApprovalCard` 的空态，四语言均已落库），不新造。 */
  const showEmptyModelHint = filteredGroups.length === 0
    && !(targetCategory && onWorkflowSelect && visibleWorkflows.length > 0);
  const canEditWorkflow = !!currentWorkflow
    && (!currentWorkflow.adapterType || currentWorkflow.adapterType === 'comfyui');
  const editWorkflow = async () => {
    if (!currentWorkflow || !canEditWorkflow || editorOpeningRef.current) return;
    editorOpeningRef.current = true;
    setEditorOpening(true);
    setOpen(false);
    try {
      const { openComfyUIWorkflowEditor } = await import('../../../services/comfyUIWindowService');
      const result = await openComfyUIWorkflowEditor(
        comfyBaseUrlFor(currentWorkflow.id) || DEFAULT_COMFY_URL,
        currentWorkflow,
      );
      if (result.missingNodeClasses.length > 0) {
        useAppStore.getState().showToast(`已打开，但 ComfyUI 缺少这些节点：${result.missingNodeClasses.join('、')}`, 'error');
      }
    } catch (error) {
      const message = typeof error === 'string' ? error
        : error instanceof Error ? error.message : '无法在 ComfyUI 中打开工作流';
      useAppStore.getState().showToast(message, 'error');
    } finally {
      editorOpeningRef.current = false;
      setEditorOpening(false);
    }
  };

  /* ★★★★★ 触发器上的名字 = **展示名出口**（`services/models/display`）
       ⚠️ 与下拉里的名字**同源同函数**，不会再出现「下拉写 GPT Image 2.5 Sunburst、
          触发器写 `gpt-image-2.5-sunburst-high`」这种不一致 ✗✓
       · 有官方身份 ⇒ 官方名（含 async 等平台规格后缀）
       · 有平台策划名 ⇒ 用映射配置里的 `displayNameOverride`
       · 都没有 ⇒ 保留**原始平台调用 id**（不虚构官方名）
       工作流状态下仍显示工作流名 ✓（不改 ✗）*/
  const triggerLabel = currentModel
    ? modelDisplayName(currentModel)
    : currentWorkflow?.name ?? t('选择模型');
  /* 官方 `AgentModelPicker` 在 Auto 生效时，触发器上显示的就是 **`Auto`**
     （实测新会话 `aria-label="Auto"` / 文案 `Auto`），这里照做。 */
  const displayLabel = agentStyle && autoSelected && !currentWorkflow ? 'Auto' : (currentWorkflow ? currentWorkflow.name : triggerLabel);

  /* 官方 `Ae` 的 `H`（偏移 91841）：`H = B ? bq(B, chatModelThinkingSettings[B.id], t) : null`
     —— 触发器上那颗「档位 / 思考关闭」徽标，无 `dye` 闸门。`ChatModelChip` 的 `secondary` 槽逐字就是这个位置。 */
  const triggerThinkingSummary = currentModel ? triggerThinkingSummaryOf(currentModel) : null;

  /* 默认触发钮的图标（官方品牌图标优先 → MTV 品牌 SVG → 字母徽章）。聊天胶囊复用同一份。 */
  const triggerIcon: ReactNode = selectedWorkflowId ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ) : (() => {
    const iconKey = currentModel ? cardMeta(currentModel).iconKey : null;
    if (iconKey && hasOfficialModelIcon(iconKey)) {
      return <OfficialModelIcon iconKey={iconKey} size={16} className="model-selector-logo" />;
    }
    const logo = findModelLogo(currentModel?.label, currentModel?.value, currentGroup?.name);
    if (logo) return <img className="model-selector-logo" src={logo} alt="" aria-hidden="true" />;
    return currentGroup && currentModel ? renderProviderBadge(currentGroup, currentModel) : null;
  })();
  const toggleTrigger = () => {
    if (!open) setAvailableComfyUrls({});
    setOpen(!open);
  };

  return (
    <div className="model-selector" ref={ref}>
      {/* ★★★★★ **官方这个按钮**是有 tooltip 的 ✓✓（用户："模型按钮没有悬浮提示" ✓）
           证据 ① 源码（EXE `index-BiTZf8mJ.js` @6918710 · 图片/视频族共用的模型触发器 ✓）：
             `const V=p("nodeDetail.selectModel"), X=jsx(Un,{variant:"ghost",size:"sm",
                className:"gap-1.5 px-2 text-sm font-normal h-8 cursor-pointer",
                "data-testid":Ja.CANVAS.NODE.VIDEO.MODEL_SELECT,children:G&&…`
             → 它外层包的是官方 Tooltip 原语，content = **`nodeDetail.selectModel`** ✓
           证据 ② 官方线上实测（CDP 9222 · 真实鼠标 hover 底部面板那颗「GPT Image2」）：
             **219ms 后弹出**、文案 = **「选择一个模型」** ✓
             （源码里该站点是显式 `delayDuration:200` ✓ → 用 `data-tooltip-delay="200"` ✓）
             该站点还显式给了 `sideOffset:8`（实测垂直间距 7.69px ✓）→ `data-tooltip-offset="8"` ✓
           ⚠️ 官方 en/ja/ko 同族包取值（`selectModel` 与 `startGeneration`/`generationCount` 相邻 ✓）：
             "Select a model" / 「モデルを選択」 / "모델 선택" ✓ → 已补进 i18n ✓ */}
      {renderTrigger ? renderTrigger({ open, label: displayLabel, icon: triggerIcon, toggle: toggleTrigger, secondary: triggerThinkingSummary }) : (
      <button
        type="button"
        className={`model-selector-trigger${selectedWorkflowId ? ' has-workflow' : ''}${currentModel ? ' has-model' : ''}${canEditWorkflow ? ' has-workflow-editor' : ''}`}
        data-tooltip={t('选择一个模型')}
        data-tooltip-delay="200"
        data-tooltip-offset="8"
        onClick={(e) => {
          e.stopPropagation();
          toggleTrigger();
        }}
      >
        {/* ★ 官方**图标槽是按模型条件渲染的** —— 没有模型就**不渲染**这个槽。
            证据（官方 `vendor-packages-*.js` @1251728 视频模型触发器，逐字）：
              `children:V&&jsxs(Fragment,{children:[jsx("img",{src:V.icon,…className:"w-4 h-4"}),
                jsx("span",{className:"whitespace-nowrap capitalize",children:C(V.name)})]})`
              （图片族 `vendor-pkg-canvas-*.js` @1241076 同形：`children:v&&jsxs(Fragment,{children:[<img/><span/>]})`；
                音频族同文件 @1649662：`children:[R?.icon&&jsx("img",…),jsx("span",{children:F||l("audio.selectModel")})]`）
            ⇒ 官方**永远不为空图标留位**，未选模型时按钮只有 `px-2` 的左右对称内边距。
            ⚠️ MTV 原来无条件渲染 16px 空槽 + `gap:6px` ⇒ 文案左边被顶出 30px、右边只有 8px，
               胶囊底色与文案明显不居中（用户："文案与底色都不对齐 好丑"）。 */}
        {triggerIcon ? (
          <span className="model-selector-icon">
            {triggerIcon}
          </span>
        ) : null}
        {/* `title` = 完整模型名：长名在底栏会被省略号收尾（改自「永不截断」那个方向，
            见 model-selector.css 的说明），原生提示让完整名字仍然可查 ✓ */}
        <span className="model-selector-label" title={displayLabel}>{displayLabel}</span>
        {/* ⚠️ 官方模型触发器**没有向下箭头**（`Sme` @383177 逐字）：
             `Button className="gap-1.5 px-2 text-sm font-normal h-8"` 里只有
             `<img className="w-4 h-4"/>` + `<span className="whitespace-nowrap capitalize">` ✓
             ⇒ MTV 原来那个 `.caret`（`polyline 6 9 12 15 18 9`）是自造的占位符 ✗ 已删。 */}
      </button>
      )}

      {canEditWorkflow && (
        <button
          type="button"
          className="ui-icon-btn model-workflow-edit nodrag nopan"
          aria-label={t('在 ComfyUI 中编辑')}
          data-tooltip={t('在 ComfyUI 中编辑')}
          aria-busy={editorOpening}
          disabled={editorOpening}
          onClick={(event) => {
            event.stopPropagation();
            void editWorkflow();
          }}
        >
          {editorOpening ? <span className="ui-spinner" /> : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m16 3 5 5M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15l-1 6 6-1" />
            </svg>
          )}
        </button>
      )}

      {open && withPortal(
        <div
          ref={popupRef}
          className={`model-dropdown${dropdownDir === 'down' ? ' drop-down' : ''}${dropdownAlignRight ? ' drop-align-right' : ''}${agentStyle ? ' agent-model-picker' : ''}${dropdownClassName ? ` ${dropdownClassName}` : ''}`}
        >
          {/* 官方 `AgentModelPicker` 的 **Auto** 行（`sh variant="model-list"` 的第一行）逐字：
              `<div class="relative flex min-h-12 w-full items-center self-stretch rounded-md py-1.5 pr-2 pl-3
                        transition-colors duration-150 hover:bg-accent/70 [选中态] bg-accent/85">
                 <button aria-labelledby aria-describedby class="flex w-full min-w-0 cursor-pointer items-start
                         gap-2 pr-5 text-left focus:outline-none">
                   <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                     <span class="min-w-0 truncate text-xs font-medium text-text-text-primary">Auto</span>
                     <span class="text-[11px] leading-4 text-text-text-secondary">平衡速度、思考强度与成本。</span>
                   </span></button>
                 <span class="pointer-events-none absolute top-1/2 right-2 flex size-4 -translate-y-1/2
                              items-center justify-center">[15×15 tabler-check]</span></div>`
              MTV 语义：`assistantModelId` 未指定 ⇒ `getAssistantTextModelCandidates` 自动挑第一个可用候选
              （`services/ai/assistantStream.ts:57`），这就是 MTV 的「自动」。 */}
          {agentStyle && onSelectAuto ? (
            <>
              <div className="group/model w-full">
                <div
                  className={`relative flex min-h-12 w-full items-center self-stretch rounded-md py-1.5 pr-2 pl-3 transition-colors duration-150 hover:bg-accent/70${autoSelected ? ' bg-accent/85' : ''}`}
                >
                  <button
                    type="button"
                    aria-labelledby={autoIds.label}
                    aria-describedby={autoIds.desc}
                    className="flex w-full min-w-0 cursor-pointer items-start gap-2 pr-5 text-left focus:outline-none"
                    onClick={() => {
                      onSelectAuto();
                      setOpen(false);
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span id={autoIds.label} className="min-w-0 truncate text-xs font-medium text-text-text-primary">
                        Auto
                      </span>
                      <span id={autoIds.desc} className="text-[11px] leading-4 text-text-text-secondary">
                        {t('平衡速度、思考强度与成本。')}
                      </span>
                    </span>
                  </button>
                  {autoSelected ? (
                    <span className="pointer-events-none absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center">
                      <Icon icon="tabler:check" width={15} height={15} strokeWidth={2} className="text-popover-foreground" />
                    </span>
                  ) : null}
                </div>
              </div>
              {/* 官方分组分隔：`border-t border-border/35 pt-1` */}
              <div className="mt-1 h-px w-full bg-border/35" aria-hidden="true" />
            </>
          ) : null}
          {/* 官方结构 = 一层平铺的模型列表（EXE Sme 源码：Fv 里直接 D.map，无分组标题/折叠/锁定图标）；各供应商模型拼成一个数组，isGroupAvailable 仅用于 disabled */}
          {filteredGroups.flatMap((group) => {
            const groupAvailable = isGroupAvailable(group.id);
            return group.models.map((model) => {
              /* 官方 `we`（调用处偏移 86944 逐字）：`dye(fe,ke) ? bq(fe,ke,L) : null`
                 ⇒ **关闭态在行上不渲染任何徽标**（`dye` 在 `enabled===false` 时恒 false，保持官方行为）；
                    「思考关闭」只出现在触发器上（官方 `Ae` 的 `H`，无闸门）。
                 画布节点那侧的模型下拉（官方 `Sme`）**没有 summary 槽** ⇒ `agentStyle` 之外不渲染。 */
              const rowThinkingSummary = agentStyle ? rowThinkingSummaryOf(model) : null;
              /* ★★★★★ 行版式：**画布节点那侧按官方 `Sme` 两行**（名字行 + 标签行），
                 聊天/助手那两套（`c-pop` / `agentStyle`）保持原来的单行内联徽标 ——
                 它们的官方参考是 `use-chat-attachment-file-input-*.js` 的 `h-8` 单行 /
                 DropdownMenu 菜单行，与画布图片下拉不是同一个组件。 */
              const twoRowLayout = !agentStyle && !(dropdownClassName ?? '').includes('c-pop');
              const rowBadges = [
                model.badgeText ? (
                  <span key="kind" className="model-item-badge">{model.badgeText}</span>
                ) : null,
                /* ★ P2：不在该连接权威清单（带 Key 的 `/v1/models`）里的候选加一枚标记。
                    取不到清单时**不会**出现（`unavailable` 恒为 undefined）⇒ 退回现状、不吓人。
                    **MTV 增强**：官方只有账号级 `isPayingCustomer`，没有连接级可用性概念。 */
                model.unavailable ? (
                  <span
                    key="unavailable"
                    className="model-item-badge"
                    data-model-unavailable-badge=""
                    title={t('上游没有把这个模型开放给当前这条连接，发出去可能被拒绝')}
                  >
                    {t('不可用')}
                  </span>
                ) : null,
                /* ★ P2：**自定义连接**的候选把「走哪条连接」直接写在行上 ——
                    这类候选全挤在同一组（内置品牌连接才有独立分组），
                    两个中转站都接了 `gpt-4o` 时只靠模型名分不出来。 */
                model.provider === 'general' && model.connectionName ? (
                  <span
                    key="connection"
                    className="model-item-badge"
                    data-model-connection-badge={model.connectionId ?? ''}
                    title={t('该候选走这条连接：{name}', { name: model.connectionName })}
                  >
                    {model.connectionName}
                  </span>
                ) : null,
                /* ★ 用户口径：异步请求模型（名字里带 async）→ 名字后面挂「异步」标签，
                    位置固定在**所有徽标之后**（不要在名字后面第一个）。 */
                isAsyncModel(model) ? (
                  <span
                    key="async"
                    className="model-item-badge"
                    data-model-async-badge=""
                    title={t('该模型走异步任务队列：提交后由服务端排队生成，不是同步返回')}
                  >
                    {t('异步')}
                  </span>
                ) : null,
              ].filter((badge): badge is ReactElement => badge !== null);
              return (
              <button
                key={model.value}
                type="button"
                /* 官方「模型行」：鼠标进入时才触发飞出面板（`ju` 的 `request`，带安全三角 + 400ms 迟滞）。
                   `rowRefs` 是官方同款的行元素表，供文档级 `pointermove` 判断「是否仍在当前行内」。 */
                ref={(el) => {
                  if (el) flyoutRowRefs.current.set(model.value, el);
                  else flyoutRowRefs.current.delete(model.value);
                }}
                onPointerEnter={(event) => {
                  /* 没有 Framia 情报的模型：不请求 hover，列表里就是普通一行。 */
                  if (!flyoutEnabled(model)) return;
                  flyoutAnchorRef.current = event.currentTarget;
                  onFlyoutRowEnter(event, () => setFlyoutModel(model));
                }}
                onPointerLeave={() => {
                  if (flyoutModel?.value === model.value) flyoutAnchorRef.current = null;
                }}
                /* 排障用：真实 value + **出处分组** + **匹配候选（value | 上游 modelId | 名字）** ✓
                   （用户："API 配置里有默认的接口、也有我自定义进去的，我主要用土豆的" ✓
                     → 靠这两个属性一眼分清「默认接口那条」与「土豆那条」，以及各自映射到哪个官方模型 ✓）*/
                data-model-value={model.value}
                data-model-group={group.id}
                data-model-key={modelAliasKey(model).filter(Boolean).join(' | ')}
                /* ★ P2：这条候选**走哪条连接** —— 两条连接都接了同一个上游模型 id 时，
                   光看模型名分不出是哪条（自定义连接的配置 key 是 `custom-<uuid8>`）。
                   `data-model-unavailable` = 带 Key 的 `/v1/models` 里没有它（**MTV 增强**）。 */
                data-model-connection={model.connectionId ?? ''}
                data-model-connection-name={model.connectionName ?? ''}
                data-model-unavailable={model.unavailable ? '1' : undefined}
                title={model.unavailable
                  ? t('该连接的 key 在上游用不了这个模型（以带 Key 的模型清单为准）')
                  : model.connectionName || undefined}
                className={`model-item model-item-model${effectiveModel === model.value ? ' active' : ''}${groupAvailable ? '' : ' disabled'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!groupAvailable) return;
                  saveModelPref(nodeType, model.value);
                  onSelect(model);
                  onWorkflowSelect?.(undefined);
                  setOpen(false);
                }}
              >
                {/* 官方选项结构（EXE Sme 源码）：img w-4 h-4 shrink-0 rounded-sm overflow-hidden object-cover + span text-[12px] font-medium text-white/90 + 渐变徽章 + 标签行 bg-[#363636] px-1.5 py-1 rounded-md / text-[10px] #AFAFAF；MTV 原来没有模型图标，用 findModelLogo 补 */}
                <div className="model-item-info">
                  <div className="model-item-name-row">
                    {(() => {
                      const official = cardMeta(model);
                      /* ★ 名字走展示名出口（与触发器同源），官方表只负责 iconKey/featureTags */
                      const name = modelDisplayName(model);
                      /* ⚠️ 上一轮我删掉了第一档 `OfficialModelIcon`（官方 path 数据）⇒ GLM 那几行掉到
                         MTV 的**黑色**品牌图兜底、图标变黑 ✗（用户：「你怎么改成黑色了」）—— 现按原样恢复：
                         ① 官方 `icon:da.XXX`（官方 path 数据原样内联 ✓ 颜色正确 ✓）
                         ② MTV 既有 `findModelLogo`（品牌 SVG ✓）
                         ③ 字母回退块 ✓ */
                      if (official.iconKey && hasOfficialModelIcon(official.iconKey)) {
                        return <OfficialModelIcon iconKey={official.iconKey} size={16} className="model-item-logo" />;
                      }
                      const logo = findModelLogo(name, model.value, group.name);
                      /* ★ 内联渲染（`inlineLogoSvg`）：SVG 颜色随行 ⇒ 与官方行内图标、与
                         `OfficialModelIcon` **统一**；`<img>` 那条路会让 `currentColor` 失效（黑/写死色）✗ */
                      return logo
                        ? <img className="model-item-logo" src={logo} alt="" aria-hidden="true" />
                        : <span className="model-item-logo model-item-logo--fallback" aria-hidden="true">{name.slice(0, 1)}</span>;
                    })()}
                    {/* ★★★★★ **模型名对齐官方** ✓✓（用户："模型选择内的模型名…都对齐官方的" ✓）
                         官方名 = EXE i18n `imageModels.name.*`（**中文包** ✓ 例 `Tap Nano Pro` ✓）
                         匹配不到官方条目 → 仍显示 MTV 自己的 `model.label` ✓（不覆盖 ✗）*/}
                    {(() => {
                      /* ★ 显示名 = 展示名出口（映射配置 → 官方 Registry → 原始平台 id）
                         组件层不再有「第三方覆盖表 / 官方 i18n / label」这套自己拼的优先级。
                         ⚠️ 名字里带 `async` 的是异步请求模型（用户口径）⇒ 名字去掉 async 片段，
                            改由后面的「异步」徽标表达，避免「… async 异步」这种重复。 */
                      const rawName = modelDisplayName(model);
                      const name = isAsyncModel(model) ? stripAsyncToken(rawName) : rawName;
                      return <div className="model-item-name" title={rawName}>{name}</div>;
                    })()}
                    {/* ★ 用户口径：异步请求模型在名字后面挂「异步」标签（位置放在所有徽标之后） */}

                    {/* ★★★★★ **官方「思考」徽标**（行内，模型名之后）✓✓
                        官方 `lbe` @80054 逐字：
                          `{n?s.jsx("span",{className:"shrink-0 text-[11px] leading-4 text-text-text-secondary/55",children:n}):null}`
                        `n` = 86944 的 `we = dye(fe,ke) ? bq(fe,ke,L) : null` ⇒ 关闭态这里为 null（不渲染）。 */}
                    {rowThinkingSummary ? (
                      <span className={MODEL_ROW_SUMMARY_CLASS}>{rowThinkingSummary}</span>
                    ) : null}
                    {/* 聊天/助手那两套仍是单行内联徽标（见上面的 `twoRowLayout`） */}
                    {twoRowLayout ? null : rowBadges}
                  </div>
                  {/* ★★★★★ **官方标签行**（vendor-packages-DRvCmDjR.js @1226275 逐字）：
                       `P.featureTags && P.featureTags.length>0 && <div className="flex items-start gap-1 w-full flex-wrap">…`
                       —— **条件渲染**（没有标签的走单行高，不硬塞空行）；
                       行容器 = `.model-item-tags`（`display:flex; align-items:flex-start; gap:4px; flex-wrap:wrap`），
                       与名字行相隔 4px（父层 `.model-item-info` 就是官方 `flex flex-col gap-1 flex-1 min-w-0`）。
                       ⚠️ 原来这四枚徽标全挤在名字行上 ⇒ ① 模型名被压成「GPT Image 2.5 Fl…」
                          ② 每行只有一行高、行与行贴成一片（用户：「你看这个纵向间距 我这服了」）。 */}
                  {twoRowLayout && rowBadges.length > 0 ? (
                    <div className="model-item-tags">{rowBadges}</div>
                  ) : null}
                  {/* ★ 用户裁决（2026-10）：**模型行只留名字 + 徽标，名字下面不再写说明**。
                      说明一律挪到鼠标悬停弹出的说明卡里（`CanvasModelFlyout`）；
                      原先这里「官方简介 → 覆盖表 → 分辨率标签」的三级回退整块删除。 */}
                </div>
                <span className="model-item-status" aria-hidden="true">
                  {effectiveModel === model.value && (
                    <svg className="model-item-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
              </button>
              );
            });
          })}

          {/* 空态提示（无候选 / 无工作流）——类名沿用 `CharacterVoiceSelector` 的同款空态行 */}
          {showEmptyModelHint && (
            <p className="px-2 py-4 text-xs text-text-text-tertiary" data-model-empty-hint="">
              {t('暂无可用模型，请先在设置中完成模型配置。')}
            </p>
          )}

          {/* ComfyUI 工作流区域 */}
          {targetCategory && onWorkflowSelect && visibleWorkflows.length > 0 && (
            <div className="model-group model-group-wf">
              <button
                type="button"
                className="model-group-header"
                aria-expanded={!workflowsCollapsed}
                onClick={(event) => {
                  event.stopPropagation();
                  setWorkflowsCollapsed((collapsed) => !collapsed);
                }}
              >
                <span className="text-model-icon text-model-icon-wf">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </span>
                <div className="model-group-info">
                  <div className="model-group-name">{t('工作流')}</div>
                  <div className="model-group-desc">{t('ComfyUI、RunningHub 与工作流 API')}</div>
                </div>
                <svg className={`model-group-chevron${workflowsCollapsed ? ' collapsed' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className={`model-group-items${workflowsCollapsed ? ' collapsed' : ''}`} inert={workflowsCollapsed}>
                {/* 各匹配工作流 */}
                {visibleWorkflows.map((wf) => (
                  <button
                    key={wf.id}
                    type="button"
                    className={`model-item${selectedWorkflowId === wf.id ? ' active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onWorkflowSelect(wf.id);
                      setOpen(false);
                    }}
                  >
                    <span className="text-model-icon text-model-icon-mini wf-dot" />
                    <div className="model-item-info">
                      <div className="model-item-name">{wf.name}</div>
                      {wf.fileName && (
                        <div className="model-item-desc">{wf.fileName}</div>
                      )}
                    </div>
                    {selectedWorkflowId === wf.id && (
                      <svg className="model-item-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>,
      )}

      {/* 官方 `th`：飞出面板本体（自己 portal 到 body；`fixed z-120 w-[240px]` + 左侧 6px 过桥）。
          `position` 为 null 时官方给的是 `visibility:hidden + pointer-events:none`。 */}
      {open && flyoutEnabled(flyoutModel) && flyoutModel ? (
        <ModelPickerFlyout
          panelRef={flyoutPanelRef}
          position={flyoutPosition}
          width={CANVAS_FLYOUT_WIDTH}
          gap={CANVAS_FLYOUT_GAP}
        >
          {flyoutRenderer(flyoutModel, {
            displayName: modelDisplayName(flyoutModel),
            description:
              cardMeta(flyoutModel).description
              ?? modelDescriptionOverride(modelDisplayName(flyoutModel))?.description
              ?? flyoutModel.description
              ?? null,
            iconKey: cardMeta(flyoutModel).iconKey,
            family: modelFamily,
          })}
        </ModelPickerFlyout>
      ) : null}
    </div>
  );
}
