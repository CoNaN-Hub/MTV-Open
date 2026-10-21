/**
 * useConnectionDropMenu —— 从节点 Handle 拖到画布空白处弹出的**命令菜单**（含建卡 + 连线）。
 *
 * ★ 1:1 对齐官方（`zoom-slider-3ZcFvYQO.js` @2899892–2905600 的
 *   `textNodeLeftCommands / textNodeRightCommands / imageNodeLeftCommands /
 *    imageNodeRightCommands / videoNodeLeftCommands / videoNodeRightCommands /
 *    audioNodeLeftCommands / audioNodeRightCommands`）：
 *
 *   官方这一套**不是**「目标节点类型表」，而是**按 源节点类型 × 拖拽侧 给出的命令表**：
 *     · 左柄（输入侧）→ 组标题 `common.newContext`       = 「添加上下文」
 *     · 右柄（输出侧）→ 组标题 `common.generateNewContent` = 「引用该节点生成」
 *   每项 = `{label, description, icon, onClick, disabled?}`，副标取自
 *   `common.textGenerationDescription / imageGenerationDescription /
 *    videoGenerationDescription / audioGenerationDescription`（见下 OFFICIAL_* 常量）。
 *
 *   官方四类节点 × 左右柄的条目集（本次逐条照抄，含顺序）：
 *     文本  左：文本 / 图片                                 右：文本生成 / 图片生成 / 视频生成 / 音频 / 3D
 *     图片  左：文本生成(生成或编辑文本) / 图片处理(生成或上传图片)   右：文本生成 / 图片生成 / 视频生成 / 音频生成 / 图片编辑器 / 3D
 *     视频  左：文本生成 / 图片生成 / 音频生成                  右：文本生成 / 音频生成 / 视频编辑 / 3D
 *     音频  左：文本                                      右：视频生成 / 数字人
 *
 *   ⚠️ 官方有、MTV 无节点类型的三项按用户 2026 定的 B 方案落地：
 *      · 图片编辑器 → 建 `ai-image` 卡（标题「图片编辑器」）并打开它的节点编辑面板
 *      · 视频编辑   → 打开 MTV 独立的「视频编辑器」窗口
 *      · 3D         → 置灰禁用（`disabled`）
 *
 *   ⚠️ MTV 独有节点类型（动画 / 全景图 / 分镜 / 导演台 / 分镜表 …）官方没有对应项，
 *      与 `nodePickerCatalog` 同规矩：**不塞进官方的条目集**，各自沿用 MTV 原有候选表。
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Node as RFNode, Edge, FinalConnectionState, Connection } from '@xyflow/react';
import { useAppStore, generateId } from '../store/useAppStore';
import { isCanvasConnectionValid } from '../store/store.nodes';
import { buildNodeData } from '../components/sidebar/nodePickerActions';
import type { BaseNodeData, NodeType } from '../types';

// ── 官方副标文案（`common.*GenerationDescription` zh，从官方 bundle 逐字提取）──
const D_TEXT = '脚本、广告词、品牌文案';
const D_IMAGE = '宣传图、海报、封面';
const D_VIDEO = '宣传视频、动画、电影';
const D_AUDIO = '配音、音效、背景音乐';
const D_AUDIO_NODE = '音乐、配音、音效'; // nodes.audioNodeDescription
const D_TEXT_EDIT = '生成或编辑文本'; // text.textGenerationAndEditDescription
const D_IMAGE_EDIT = '生成或上传图片'; // image.imageGenerationAndEditAndUploadDescription
const D_IMAGE_EDITOR = '编辑和处理图片'; // nodes.imageEditorDescription
/** 「对比」节点的描述（MTV 新增，非官方 i18n） */
const D_COMPARE = '并排对比两张图片的差异';
/** 「样机」节点的描述（MTV 新增，非官方 i18n）—— 与 `nodePickerCatalog` 菜单行的副标题同一句 */
const D_MOCKUP = '将图片呈现在可旋转的设备样机中';
const D_WORLD = '生成 3D 场景与对象'; // nodes.worldNodeDescription
const D_VIDEO_EDIT = '对传入的视频进行编辑'; // nodes.videoEditNodeDescription

/** 组标题（官方 `common.newContext` / `common.generateNewContent`） */
export const CONNECTION_GROUP_TITLE_INPUT = '添加上下文';
export const CONNECTION_GROUP_TITLE_OUTPUT = '引用该节点生成';

export type ConnectionMenuDirection = 'input' | 'output';

/** 选中一项后要做的事 —— 官方每项的 `onClick` 语义 */
export type ConnectionMenuAction =
  | {
      kind: 'create-node';
      type: NodeType;
      /** 官方建卡时的标题覆盖（如「图片生成」） */
      title?: string;
      /** 官方 `onClick` 里传给建卡函数的参数语义 */
      data?: Record<string, unknown>;
      /** 官方 `Z3(fromNode)`：建卡并继承源节点的生成参数 */
      inheritSourceParams?: boolean;
    }
  | { kind: 'open-video-editor' }
  /** 官方有、MTV 暂无 → 置灰 */
  | { kind: 'none' };

export interface ConnectionMenuOption {
  /** 稳定 key（官方 i18n key） */
  id: string;
  label: string;
  description?: string;
  /** `OfficialIcon` 的图标名 */
  icon: string;
  action: ConnectionMenuAction;
  disabled?: boolean;
}

export interface ConnectionMenuGroup {
  title: string;
  children: ConnectionMenuOption[];
}

const createNode = (
  id: string,
  label: string,
  description: string,
  icon: string,
  type: NodeType,
  extra?: { title?: string; data?: Record<string, unknown>; inheritSourceParams?: boolean },
): ConnectionMenuOption => ({
  id,
  label,
  description,
  icon,
  action: { kind: 'create-node', type, ...extra },
});

/** 官方有、MTV 没有节点类型 → 置灰项 */
const unavailable = (
  id: string,
  label: string,
  description: string,
  icon: string,
): ConnectionMenuOption => ({
  id,
  label,
  description,
  icon,
  action: { kind: 'none' },
  disabled: true,
});

/**
 * 官方 `nodes.worldNode`「3D」·「生成 3D 场景与对象」。
 * ★ 用户 2026 明确：「**3D 不映射到导演台**；**3D 片场**才是去导演台」✓
 *   ⇒ 官方这条「3D」在 MTV **没有对应节点类型** ⇒ **置灰**（`unavailable`）✗
 *     （此前错误地把它接成了 `ai-director`（导演台）✗ 已改；
 *       MTV 的「3D 片场」→ 导演台 的映射见 `nodePickerCatalog.toolItems` ✓）
 */
const WORLD_COMMAND: ConnectionMenuOption = unavailable(
  'nodes.worldNode',
  '3D',
  D_WORLD,
  'pick-3d',
);

// ── 官方命令表：四类节点 × 左右柄（顺序与官方源码逐条一致）──
const TEXT_LEFT: ConnectionMenuOption[] = [
  createNode('nodes.textNode', '文本', D_TEXT, 'pick-text', 'ai-text'),
  createNode('nodes.imageNode', '图片', D_IMAGE, 'pick-image', 'ai-image'),
];
const TEXT_RIGHT: ConnectionMenuOption[] = [
  createNode('text.textGeneration', '文本生成', D_TEXT, 'pick-text', 'ai-text'),
  createNode('image.imageGeneration', '图片生成', D_IMAGE, 'pick-image', 'ai-image'),
  createNode('video.videoGeneration', '视频生成', D_VIDEO, 'pick-video', 'ai-video'),
  createNode('nodes.audioNode', '音频', D_AUDIO_NODE, 'pick-audio', 'ai-audio'),
  WORLD_COMMAND,
];
const IMAGE_LEFT: ConnectionMenuOption[] = [
  createNode('text.textGenerationAndEdit', '文本生成', D_TEXT_EDIT, 'pick-text', 'ai-text'),
  createNode('image.imageGenerationAndEditAndUpload', '图片处理', D_IMAGE_EDIT, 'pick-image', 'ai-image', {
    inheritSourceParams: true,
  }),
];
const IMAGE_RIGHT: ConnectionMenuOption[] = [
  createNode('text.textGeneration', '文本生成', D_TEXT, 'pick-text', 'ai-text'),
  createNode('image.imageGeneration', '图片生成', D_IMAGE, 'pick-image', 'ai-image', {
    title: '图片生成', // 官方 `image.redrawImageTitle`
    inheritSourceParams: true,
  }),
  createNode('video.videoGeneration', '视频生成', D_VIDEO, 'pick-video', 'ai-video'),
  createNode('audio.audioGeneration', '音频生成', D_AUDIO, 'pick-audio', 'ai-audio'),
  createNode('nodes.imageEditor', '图片编辑器', D_IMAGE_EDITOR, 'pick-editor', 'ai-image', {
    // 官方 `X3({title: e("nodes.imageEditor")})`：**只建卡**，编辑器靠双击打开
    //（官方 i18n `nodes.doubleClickToOpenEditor` =「双击打开编辑器」）→ 这里不自动开面板 ✓
    title: '图片编辑器',
  }),
  WORLD_COMMAND,
];
const VIDEO_LEFT: ConnectionMenuOption[] = [
  createNode('text.textGeneration', '文本生成', D_TEXT, 'pick-text', 'ai-text'),
  createNode('image.imageGeneration', '图片生成', D_IMAGE, 'pick-image', 'ai-image'),
  createNode('audio.audioGeneration', '音频生成', D_AUDIO, 'pick-audio', 'ai-audio'),
];
const VIDEO_RIGHT: ConnectionMenuOption[] = [
  createNode('text.textGeneration', '文本生成', D_TEXT, 'pick-text', 'ai-text'),
  createNode('audio.audioGeneration', '音频生成', D_AUDIO, 'pick-audio', 'ai-audio'),
  {
    id: 'nodes.videoEditNode',
    label: '视频编辑',
    description: D_VIDEO_EDIT,
    icon: 'pick-video',
    action: { kind: 'open-video-editor' },
  },
  WORLD_COMMAND,
];
const AUDIO_LEFT: ConnectionMenuOption[] = [
  createNode('nodes.textNode', '文本', D_TEXT, 'pick-text', 'ai-text'),
];
const AUDIO_RIGHT: ConnectionMenuOption[] = [
  createNode('video.videoGeneration', '视频生成', D_VIDEO, 'pick-video', 'ai-video'),
  // 官方：`video.omnihumanGeneration` —— 官方 bundle 的 i18n 里**没有**这条 key 的译文，
  // 且 MTV 无「数字人」节点类型 → 按 B 方案置灰。
  unavailable('video.omnihumanGeneration', '数字人', '', 'pick-video'),
];

/** 官方节点类型 → 命令表（MTV 的 `source-*` 与官方同语义，共用同一份） */
const OFFICIAL_COMMANDS: Record<string, { input: ConnectionMenuOption[]; output: ConnectionMenuOption[] }> = {
  'ai-text': { input: TEXT_LEFT, output: TEXT_RIGHT },
  'source-text': { input: TEXT_LEFT, output: TEXT_RIGHT },
  'ai-image': { input: IMAGE_LEFT, output: IMAGE_RIGHT },
  'source-image': { input: IMAGE_LEFT, output: IMAGE_RIGHT },
  'ai-video': { input: VIDEO_LEFT, output: VIDEO_RIGHT },
  'source-video': { input: VIDEO_LEFT, output: VIDEO_RIGHT },
  'ai-audio': { input: AUDIO_LEFT, output: AUDIO_RIGHT },
  'source-audio': { input: AUDIO_LEFT, output: AUDIO_RIGHT },
};

// ── MTV 独有节点类型的候选表（官方无对应项，保持 MTV 原有行为）──
/* §96 例外：候选表里指向 `ai-video` 的那一条，标签从 MTV 自造的「生成视频」改成**官方逐字**「视频」
   （官方 i18n `nodes.videoNode:"视频"`，`index-BDGj8rGN.js` @909177）。表里其余项
   （生成文本 / 生成图片 / 生成动画 / 生成360全景图 …）是 MTV 独有节点的文案，官方无对应物 ⇒ 未动。 */
interface LegacyOption {
  label: string;
  type: NodeType;
}

const LEGACY_OUTPUT_MAP: Record<string, LegacyOption[]> = {
  'ai-animation': [
    { label: '生成文本', type: 'ai-text' },
    { label: '生成图片', type: 'ai-image' },
    { label: '视频', type: 'ai-video' },
    { label: '生成动画', type: 'ai-animation' },
    { label: '生成360全景图', type: 'ai-panorama' },
  ],
  'ai-panorama': [
    { label: '生成文本', type: 'ai-text' },
    { label: '生成图片', type: 'ai-image' },
  ],
  'ai-storyboard': [
    { label: '生成文本', type: 'ai-text' },
    { label: '生成图片', type: 'ai-image' },
    { label: '视频', type: 'ai-video' },
    { label: '生成动画', type: 'ai-animation' },
    { label: '生成360全景图', type: 'ai-panorama' },
  ],
  'ai-director': [
    { label: '生成图片', type: 'ai-image' },
    { label: '视频', type: 'ai-video' },
  ],
  'ai-markdown': [],
  // 分镜表的下游产物是时间轴，不是再生成一个媒体节点
  'ai-shotlist': [],
};

/** MTV 独有节点类型的候选表用的节点名。
 *
 *  §96：`ai-video` 一律用**官方逐字**「视频」（官方 i18n `nodes.videoNode:"视频"`，
 *  `index-BDGj8rGN.js` @909177 `…videoNode:"视频",videoNodeDescription:"宣传视频、动画、电影",…`）；
 *  MTV 原来在这里写「生成视频」、在 `SOURCE_NODE_SHORTCUTS` 写「视频」⇒ 自己就不一致。
 *  ⚠️ 其余项（生成动画 / 生成360全景图 / 生成分镜 / 导演台）是 MTV 独有节点的候选文案，
 *  官方无对应物 ⇒ **一个字都不动**。 */
const LEGACY_NODE_LABELS: Partial<Record<NodeType, string>> = {
  'ai-text': '生成文本',
  'ai-image': '生成图像',
  'ai-video': '视频',
  'ai-audio': '生成音频',
  'ai-animation': '生成动画',
  'ai-panorama': '生成360全景图',
  'ai-storyboard': '生成分镜',
  'ai-director': '导演台',
};

const LEGACY_INPUT_MAP: Record<string, LegacyOption[]> = Object.fromEntries(
  Object.keys(LEGACY_OUTPUT_MAP).map((targetType) => [
    targetType,
    Object.entries(LEGACY_OUTPUT_MAP).flatMap(([candidateType, outputs]) => {
      const type = candidateType as NodeType;
      const label = LEGACY_NODE_LABELS[type];
      return label && outputs.some((option) => option.type === targetType) ? [{ label, type }] : [];
    }),
  ]),
);

const LEGACY_ICON_BY_TYPE: Record<string, string> = {
  'ai-text': 'pick-text',
  'ai-image': 'pick-image',
  'ai-video': 'pick-video',
  'ai-audio': 'pick-audio',
  'ai-animation': 'pick-video',
  'ai-panorama': 'pick-image',
  'ai-storyboard': 'timeline',
  'ai-director': 'stage-3d',
};

function legacyGroup(
  nodeType: string,
  direction: ConnectionMenuDirection,
): ConnectionMenuGroup[] {
  const map = direction === 'input' ? LEGACY_INPUT_MAP : LEGACY_OUTPUT_MAP;
  const options = map[nodeType] ?? [];
  if (options.length === 0) return [];
  return [
    {
      title: direction === 'input' ? CONNECTION_GROUP_TITLE_INPUT : CONNECTION_GROUP_TITLE_OUTPUT,
      children: options.map((option, index) => ({
        id: `legacy.${direction}.${nodeType}.${index}`,
        label: option.label,
        icon: LEGACY_ICON_BY_TYPE[option.type] ?? 'pick-text',
        action: { kind: 'create-node' as const, type: option.type },
      })),
    },
  ];
}

/**
 * 官方 `nZe`（图片节点左柄命令表）里的门禁：
 *   只有源节点 `data.type ∈ {fo.DEFAULT, fo.GENERATE}`（空卡 / 生成卡）才返回那两项，
 *   否则返回 `[]` ⇒ **不弹菜单**（`zoom-slider-3ZcFvYQO.js` @2901100 附近逐字）。
 * ⚠️ MTV 的节点数据没有这个字段 → 用「卡里有没有媒体」近似（用户 2026 定：保持官方一致 ✓）。
 */
const BLANK_CARD_GATED_TYPES: ReadonlySet<string> = new Set(['ai-image', 'source-image']);

/** 源节点是不是「空卡」（官方门禁用；`blankCard` 未传时按不门禁处理）*/
export function isBlankCardForCommands(data: unknown): boolean {
  if (!data || typeof data !== 'object') return true;
  const source = data as Record<string, unknown>;
  return [source.imageUrl, source.thumbnailUrl, source.videoUrl, source.audioUrl, source.filePath].every(
    (value) => value === undefined || value === null || value === '',
  );
}

export interface ConnectionMenuQuery {
  /** 源节点是不是空卡（只影响图片 / 素材库参考图的左柄） */
  blankCard?: boolean;
}

/** 该源节点类型 + 拖拽侧对应的命令分组（官方表优先；返回空数组 = 不弹菜单） */
export function getConnectionMenuGroups(
  nodeType: string,
  direction: ConnectionMenuDirection,
  query?: ConnectionMenuQuery,
): ConnectionMenuGroup[] {
  const official = OFFICIAL_COMMANDS[nodeType];
  if (official) {
    // 官方 nZe 门禁：图片节点左柄在「有媒体的卡」上不弹菜单
    if (direction === 'input' && BLANK_CARD_GATED_TYPES.has(nodeType) && query?.blankCard === false) {
      return [];
    }
    const children = official[direction];
    if (children.length === 0) return [];
    return [
      {
        title: direction === 'input' ? CONNECTION_GROUP_TITLE_INPUT : CONNECTION_GROUP_TITLE_OUTPUT,
        children,
      },
    ];
  }
  return legacyGroup(nodeType, direction);
}

/** 兼容入口：把分组拍平成一张条目表（拖拽结束时要判断「有没有菜单可弹」） */
export function getConnectionMenuOptions(
  nodeType: string,
  direction: ConnectionMenuDirection,
  query?: ConnectionMenuQuery,
): ConnectionMenuOption[] {
  return getConnectionMenuGroups(nodeType, direction, query).flatMap((group) => group.children);
}

interface ConnectionMenuState {
  visible: boolean;
  sourceNodeId: string;
  sourceNodeType: string;
  sourceHandleId: string | null;
  direction: ConnectionMenuDirection;
  position: { x: number; y: number };
  /** 官方 nZe 门禁用：拖拽起点是不是空卡 */
  blankCard: boolean;
  /**
   * `'source'`   = 从某个节点的 Handle 拖出来（官方按「源类型 × 左右侧」给的那套菜单）
   * `'selection'` = **点多选时的 `+` 按钮**（官方 `wme` @1430584：一次引用**所有选中节点**生成）
   */
  mode: 'source' | 'selection';
}

/** 官方 `nodes.stitchAllSelectedImages` / `nodes.stitchImagesDescription` / `common.generateNewContentWithImages`（zh 逐字）
 *  ⚠️ 三条标题都以 **「引用」** 开头（t1152 官方实测标题文本 + t1154 从官方 `index-BiTZf8mJ.js` 逐字抽出）：
 *     「引用所有选中的节点生成」/「引用所有选中的图片节点生成」/「引用所有选中的文本节点生成」
 *     MTV 原来写的是「**用**所有选中的…生成」✗（用户反馈：「内容不对」✓）
 *     官方另有一条「一键拼接所有选中的图片节点」✓（MTV 已经一致 ✓） */
const SELECTION_MENU_TITLE_IMAGES = '引用所有选中的图片节点生成';
const SELECTION_MENU_TITLE_TEXTS = '引用所有选中的文本节点生成';
const SELECTION_MENU_TITLE_MIXED = '引用所有选中的节点生成';
const SELECTION_STITCH_TITLE = '一键拼接所有选中的图片节点';
const D_STITCH = '一键拼图生成情绪板'; // nodes.stitchImagesDescription

/** 官方 `Eme(nodes)`：全是文本 → 文本版标题；混合 → 通用标题；否则图片版标题 */
function selectionMenuTitle(sourceTypes: readonly string[]): string {
  if (sourceTypes.length > 0 && sourceTypes.every((t) => t.includes('text') || t.includes('markdown'))) {
    return SELECTION_MENU_TITLE_TEXTS;
  }
  const allImage = sourceTypes.every((t) => t.includes('image') || t.includes('panorama'));
  return allImage ? SELECTION_MENU_TITLE_IMAGES : SELECTION_MENU_TITLE_MIXED;
}

/**
 * 官方 `wme`（`page-DPdEgTS0.js` @1430584）的条目集 —— 「引用所有选中的节点生成」：
 *   第 1 组（标题 = `common.generateNewContentWithImages` / `…WithTexts` / `…WithSelection`）：
 *     文本生成（`text.textGeneration` / `nodes.textNodeDescription`）
 *     图片生成（`image.imageGeneration` / `nodes.imageNodeDescription`）
 *     视频生成（`video.videoGeneration` / `nodes.videoNodeDescription`）
 *     3D（`nodes.worldNode` / `nodes.worldNodeDescription`，带「可用」小圆点）
 *   分隔线 + 第 2 组（标题 = `nodes.stitchAllSelectedImages`）：
 *     图片编辑器（`nodes.imageEditor` / `nodes.stitchImagesDescription`）
 * ⚠️ MTV 没有 3D/世界节点类型 ⇒ 3D 项沿用 MTV 既有的 `WORLD_COMMAND`（disabled），与拖拽菜单一致。
 */
export function getSelectionMenuGroups(sourceTypes: readonly string[]): ConnectionMenuGroup[] {
  return [
    {
      title: selectionMenuTitle(sourceTypes),
      children: [
        createNode('text.textGeneration', '文本生成', D_TEXT, 'pick-text', 'ai-text'),
        createNode('image.imageGeneration', '图片生成', D_IMAGE, 'pick-image', 'ai-image'),
        createNode('video.videoGeneration', '视频生成', D_VIDEO, 'pick-video', 'ai-video'),
        /* ★★ 用户 2026 指定：**插在「视频生成」下方**（3D 之前）。
           ⚠️ 上一版我加错了地方（加到了 `IMAGE_RIGHT` = 从 Handle 拖出来的菜单），
              这个「引用所有选中的图片节点生成」用的是 `getSelectionMenuGroups()` ⇒ 必须加在这里。
           参考实现：MOMO 画布 `compareNode`（节点标签「对比」、`show-output-handle:false`）。
           多选菜单本来就会「给每条选中节点各接一条边进来」⇒ 对比节点天然拿到 A/B 两路输入。
           ★★ 用户 2026：
             · 「这里的没改」⇒ 图标换成同一支「对比」SVG（`compare-placeholder`，已旋转 90°）；
             · 「添加节点菜单里的名字不变 依旧是 对比，创建/连接后 卡片左上角显示为 图片对比」
               ⇒ 菜单行文字 = 「对比」不变，但**建出来的卡片** `data.label` = 「图片对比」
               （这个 `title` 会写进 `data.label`，见本文件 @742 / @778）。 */
        createNode('nodes.compareNode', '对比', D_COMPARE, 'compare-placeholder', 'compare', {
          title: '图片对比',
          data: {
            sliderPosition: 50,
            swapLayer: false,
            compareMode: 'split',
            direction: 'horizontal',
            splitDirection: 'vertical',
            /* 尺寸不写死：对比卡的尺寸 = **入图那张图卡的尺寸**（见 `CompareNode.compareCardSize`），
               这两项只是「还没连图」时的初始值，组件挂载后会按源图回写 ✓ */
            nodeWidth: 250,
            nodeHeight: 250,
          },
        }),
        /* ★★ 用户 2026：「连接菜单加上」
           ⇒ 「样机」与「对比」同性质（MTV 新增 · 吃图片输入 · 官方没有对应项），
              按同一口径进**这张多选生成菜单**（`getSelectionMenuGroups`），
              位置 = 「对比」正下方、「3D」上方。
           ⚠️ **不要**塞进 `IMAGE_LEFT` / `IMAGE_RIGHT` 那几张 Handle 拖拽命令表 ——
              它们是官方 `zoom-slider-3ZcFvYQO.js` 里**逐条照抄**的，本文件开头已立规矩
              「MTV 独有节点类型**不塞进官方的条目集**」（「对比」当初就是从 `IMAGE_RIGHT` 挪出来的）。
           图标 = 用户上传的 `assets/official-icons/mockup.svg`；
           卡片默认标题 = 「样机」，由 `buildNodeData('mockup')` 写，与本菜单行文字同值 ⇒ 不需要 `title` 覆盖。 */
        createNode('nodes.mockupNode', '样机', D_MOCKUP, 'mockup', 'mockup'),
        WORLD_COMMAND,
      ],
    },
    {
      title: SELECTION_STITCH_TITLE,
      children: [
        createNode('nodes.imageEditor', '图片编辑器', D_STITCH, 'pick-editor', 'ai-image', {
          title: '图片编辑器',
        }),
      ],
    },
  ];
}

function getClientPosition(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ('changedTouches' in event) {
    const touch = event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

export function resolveNodeBodyHandle(clientX: number, left: number, width: number): 'left' | 'right' {
  return clientX < left + width / 2 ? 'left' : 'right';
}

/** 官方 `Z3(fromNode)`：建卡时继承源节点的生成参数（MTV 取这几项） */
function inheritedParams(data: BaseNodeData | undefined): Record<string, unknown> {
  if (!data) return {};
  const source = data as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of ['aspectRatio', 'imageSize', 'model', 'provider']) {
    if (source[key] !== undefined) picked[key] = source[key];
  }
  return picked;
}

export function useConnectionDropMenu() {
  const reactFlowInstance = useReactFlow();
  const addNodeWithEdge = useAppStore((s) => s.addNodeWithEdge);
  const connectNodes = useAppStore((s) => s.onConnect);
  const nodes = useAppStore((s) => s.nodes);
  const edges = useAppStore((s) => s.edges);

  const [menu, setMenu] = useState<ConnectionMenuState>({
    visible: false,
    sourceNodeId: '',
    sourceNodeType: '',
    sourceHandleId: null,
    direction: 'output',
    position: { x: 0, y: 0 },
    blankCard: true,
    mode: 'source',
  });
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * 官方 `jke()`：拖拽到空白/点 + 按钮时**往画布上加一个 `command` 占位节点**，并接一条
   * `edgeTag:"command"` 且 `deletable:false` 的**真边** ⇒ 松手后连线不消失、也剪不断 ✓
   * ⚠️ MTV 里它只活在 React 渲染层（`Canvas` 把它追加进 `nodes`/`edges`），**不写 store、不持久化** ✓
   */
  const [pending, setPending] = useState<{ node: RFNode<BaseNodeData>; edge: Edge } | null>(null);

  const close = useCallback(() => {
    setMenu((s) => ({ ...s, visible: false }));
    setPending(null);
  }, []);

  // Close on click outside or Escape
  useEffect(() => {
    if (!menu.visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Element)) {
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    // 捕获阶段监听：传统交互模式下左键平移会被 React Flow(d3-zoom)在 pane 上 stopPropagation，
    // 冒泡阶段的 document 监听收不到事件，必须在捕获阶段先于其触发才能关闭菜单。
    document.addEventListener('mousedown', onClick, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick, true);
    };
  }, [menu.visible, close]);

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (connectionState.isValid === true) return;
      if (!connectionState.fromNode) return;

      const clientPosition = getClientPosition(event);
      if (!clientPosition) return;
      const hitNodeElement = document
        .elementFromPoint(clientPosition.x, clientPosition.y)
        ?.closest<HTMLElement>('.react-flow__node[data-id]');
      const hitNodeId = hitNodeElement?.dataset.id;
      if (hitNodeElement && hitNodeId) {
        if (hitNodeId === connectionState.fromNode.id) return;
        const rect = hitNodeElement.getBoundingClientRect();
        /* ★ 「对比」节点只有一路输入（`left`，照参考实现 `show-output-handle:false`）。
           `resolveNodeBodyHandle` 是按**落点在卡的哪一半**给手柄 id 的 ⇒ 落在右半边会给 `right`，
           而 MTV 的合法性规则要求 `sourceHandle !== targetHandle`（`isCanvasConnectionValid`）
           ⇒ 从图卡右柄（`right`）拖到对比卡右半边会判非法、**松手毫无反应** ✗
           ⇒ 这里把对比卡的落点一律收成 `left`：**整张卡都是可落区** ✓
              （用户要的就是「把两张图卡连到对比卡上就出对比」。）*/
        const hitNodeType = useAppStore.getState().nodes.find((n) => n.id === hitNodeId)?.type;
        const targetHandle = hitNodeType === 'compare'
          ? 'left'
          : resolveNodeBodyHandle(clientPosition.x, rect.left, rect.width);
        const connection: Connection = {
          source: connectionState.fromNode.id,
          sourceHandle: connectionState.fromHandle?.id ?? null,
          target: hitNodeId,
          targetHandle,
        };
        if (isCanvasConnectionValid(connection)) connectNodes(connection);
        return;
      }

      const fromNode = connectionState.fromNode as RFNode;
      const sourceType = fromNode.type;
      const sourceHandleId = connectionState.fromHandle?.id ?? null;
      const direction = sourceHandleId === 'left' ? 'input' : 'output';
      // 官方 nZe 门禁：图片节点左柄在「有媒体的卡」上不弹菜单。
      // ⚠️ 不能读 `fromNode.data` —— MTV 的 `canvasRenderProjection` 把送进 React Flow 的
      //   `data` 投影成了 `{label, type, displayId}` 渲染桩（实测 `dataKeys` 就这三个键 ✗），
      //   媒体字段只在 store 里 ⇒ 必须回 store 取真数据。
      const storeNode = useAppStore.getState().nodes.find((n) => n.id === fromNode.id);
      const blankCard = isBlankCardForCommands(storeNode?.data ?? fromNode.data);
      if (!sourceType || getConnectionMenuOptions(sourceType, direction, { blankCard }).length === 0) return;

      /* ★ 官方 `jke()`：建 `command` 占位节点 + `edgeTag:"command"` / `deletable:false` 的真边
         （左柄方向反转：`{source: 占位, target: fromNode}`）⇒ 松手后连线**不消失**、也剪不断 ✓ */
      const placeholderId = `command-${generateId()}`;
      const placeholder: RFNode<BaseNodeData> = {
        id: placeholderId,
        type: 'command-menu',
        position: reactFlowInstance.screenToFlowPosition(clientPosition),
        draggable: false,
        selectable: false,
        zIndex: 1000,
        data: { label: '', type: 'canvas-note' } as BaseNodeData,
      };
      const commandEdge: Edge = direction === 'input'
        ? {
            id: `command-${generateId()}`,
            source: placeholderId,
            target: fromNode.id,
            targetHandle: sourceHandleId,
            data: { edgeTag: 'command' },
            deletable: false,
            selectable: false,
          }
        : {
            id: `command-${generateId()}`,
            source: fromNode.id,
            sourceHandle: sourceHandleId,
            target: placeholderId,
            data: { edgeTag: 'command' },
            deletable: false,
            selectable: false,
          };
      setPending({ node: placeholder, edge: commandEdge });

      setMenu({
        visible: true,
        sourceNodeId: fromNode.id,
        sourceNodeType: sourceType,
        sourceHandleId,
        direction,
        position: clientPosition,
        blankCard,
        mode: 'source',
      });
    },
    [connectNodes, reactFlowInstance],
  );

  /**
   * ★ 官方 `Wke` 的 `onClick`（`zoom-slider-3ZcFvYQO.js` @1209989 逐字）：
   *   `onClick = (w, x) => { w.stopPropagation(); …; setNodes(选中该节点 → selected:false); C && d(w.nativeEvent, {nodeId, nodeType, handleType:x}) }`
   * 其中 `d` 就是**拖拽结束用的同一个派发器**（`jke().handleNodeHandleClick`）⇒ 「点 + 」与「拖到空白」走同一条路。
   * 区别只在**选中数**：官方 `wme` 是「一次引用所有选中节点生成」，所以这里：
   *   · 选中 ≥2 → 多选生成菜单（`getSelectionMenuGroups`）
   *   · 选中 1  → 与拖拽同一套「源类型 × 侧」菜单
   */
  const openHandleMenu = useCallback(
    (nodeId: string, handleId: string | null, clientPosition: { x: number; y: number }) => {
      const store = useAppStore.getState();
      const selectedIds = store.selectedNodeIds.filter((id) => id !== nodeId);
      if (selectedIds.length >= 1) {
        const sourceNodes = store.nodes.filter((n) => selectedIds.includes(n.id));
        if (sourceNodes.length > 0) {
          close();
          setPending(null);
          setMenu({
            visible: true,
            sourceNodeId: '',
            sourceNodeType: '',
            sourceHandleId: handleId,
            direction: 'output',
            position: clientPosition,
            blankCard: true,
            mode: 'selection',
          });
          return;
        }
      }
      const node = store.nodes.find((n) => n.id === nodeId);
      const sourceType = node?.type;
      if (!sourceType) return;
      const direction: ConnectionMenuDirection = handleId === 'left' ? 'input' : 'output';
      const blankCard = isBlankCardForCommands(node?.data ?? {});
      if (getConnectionMenuOptions(sourceType, direction, { blankCard }).length === 0) return;

      const placeholderId = `command-${generateId()}`;
      const placeholder: RFNode<BaseNodeData> = {
        id: placeholderId,
        type: 'command-menu',
        position: reactFlowInstance.screenToFlowPosition(clientPosition),
        draggable: false,
        selectable: false,
        zIndex: 1000,
        data: { label: '', type: 'canvas-note' } as BaseNodeData,
      };
      const commandEdge: Edge = direction === 'input'
        ? {
            id: `command-${generateId()}`,
            source: placeholderId,
            target: nodeId,
            targetHandle: handleId,
            data: { edgeTag: 'command' },
            deletable: false,
            selectable: false,
          }
        : {
            id: `command-${generateId()}`,
            source: nodeId,
            sourceHandle: handleId,
            target: placeholderId,
            data: { edgeTag: 'command' },
            deletable: false,
            selectable: false,
          };
      setPending({ node: placeholder, edge: commandEdge });
      setMenu({
        visible: true,
        sourceNodeId: nodeId,
        sourceNodeType: sourceType,
        sourceHandleId: handleId,
        direction,
        position: clientPosition,
        blankCard,
        mode: 'source',
      });
    },
    [close, reactFlowInstance],
  );

  /**
   * ★ 官方「选区右侧那个灰底白 +」（`page-DPdEgTS0.js` @1437683 逐字）：
   *   `onMouseDown` → 进入拖拽（`+` 跟随光标，`cursor-crosshair`）→ `mouseup` 时
   *   `x$(P, {width:258,height:297}, {padding:12,marginTop:16,centerX:true,…})` 算锚点 → 打开菜单。
   * 菜单本身就是多选那套 `wme`（`mode:'selection'`）⇒ 这里只负责「在某个屏幕点打开多选菜单」。
   */
  const openSelectionMenuAt = useCallback((clientPosition: { x: number; y: number }) => {
    close();
    setPending(null);
    setMenu({
      visible: true,
      sourceNodeId: '',
      sourceNodeType: '',
      sourceHandleId: 'right',
      direction: 'output',
      position: clientPosition,
      blankCard: true,
      mode: 'selection',
    });
  }, [close]);

  const handleSelect = useCallback(
    async (option: ConnectionMenuOption) => {
      if (option.disabled) return;
      const { sourceNodeId, sourceHandleId, position } = menu;
      const action = option.action;

      if (action.kind === 'none') return;

      // 官方 `nodes.videoEditNode` → MTV 最近的等价能力：打开独立的「视频编辑器」窗口
      if (action.kind === 'open-video-editor') {
        close();
        try {
          const { currentProjectId, config } = useAppStore.getState();
          const { openVideoEditorBlank } = await import('../services/videoEditorService');
          await openVideoEditorBlank({
            projectId: currentProjectId ?? '',
            theme: config.theme === 'light' ? 'light' : 'dark',
          });
        } catch (error) {
          useAppStore
            .getState()
            .showToast(error instanceof Error ? error.message : '打开视频编辑器失败', 'error');
        }
        return;
      }

      const flowPos = reactFlowInstance.screenToFlowPosition({ x: position.x, y: position.y });
      const nodeType: NodeType = action.type;

      /* ★ 多选生成菜单（官方 `wme`）：建的卡要**引用所有选中节点** ⇒ 每条选中节点各接一条边进来 */
      if (menu.mode === 'selection') {
        const sourceIds = useAppStore.getState().selectedNodeIds.filter((id) => id !== '');
        if (sourceIds.length === 0) return;
        const data: Record<string, unknown> = {
          ...buildNodeData(nodeType),
          label: option.label,
          ...(action.kind === 'create-node' ? action.data ?? {} : {}),
        };
        if (action.kind === 'create-node' && action.title) data.label = action.title;
        const newHeight = typeof data.nodeHeight === 'number' ? data.nodeHeight : 160;
        const newNodeId = `node-${generateId()}`;
        const newNode: RFNode<BaseNodeData> = {
          id: newNodeId,
          type: nodeType,
          position: { x: flowPos.x, y: flowPos.y - newHeight / 2 },
          data: data as BaseNodeData,
          selected: true,
        };
        const newEdges: Edge[] = sourceIds.map((sourceId, index) => ({
          id: `edge-${generateId()}`,
          source: sourceId,
          sourceHandle: 'right',
          target: newNodeId,
          targetHandle: 'left',
          data: { order: index },
        }));
        useAppStore.getState().addNodesWithEdges([newNode], newEdges);
        close();
        setPending(null);
        return;
      }

      // 输入/输出语义由开始拖拽的 Handle 决定，不再随空白落点跨过节点而翻转。
      const edgeSourceHandle = sourceHandleId === 'left' ? 'left' : 'right';
      const edgeTargetHandle = edgeSourceHandle === 'left' ? 'right' : 'left';

      const data: Record<string, unknown> = {
        ...buildNodeData(nodeType),
        label: option.label,
        ...(action.kind === 'create-node' && action.inheritSourceParams
          ? inheritedParams(nodes.find((n) => n.id === sourceNodeId)?.data)
          : {}),
        ...(action.kind === 'create-node' ? action.data ?? {} : {}),
      };
      if (action.kind === 'create-node' && action.title) data.label = action.title;

      const newWidth = typeof data.nodeWidth === 'number' ? data.nodeWidth : 280;
      const newHeight = typeof data.nodeHeight === 'number' ? data.nodeHeight : 160;

      // Position at the drop point:
      // - left side:  right edge of new node aligns with cursor  (nodeX = flowPos.x - newWidth)
      // - right side: left edge of new node aligns with cursor   (nodeX = flowPos.x)
      const nodeX = edgeSourceHandle === 'left' ? flowPos.x - newWidth : flowPos.x;
      const nodeY = flowPos.y - newHeight / 2;

      const newNodeId = `node-${generateId()}`;
      const newNode: RFNode<BaseNodeData> = {
        id: newNodeId,
        type: nodeType,
        position: { x: nodeX, y: nodeY },
        data: data as BaseNodeData,
      };
      const edgeSource = edgeSourceHandle === 'left' ? newNodeId : sourceNodeId;
      const edgeTarget = edgeSourceHandle === 'left' ? sourceNodeId : newNodeId;
      /* ★ 官方 `qo(e, t, n)`（zoom-slider @1018856）逐项对齐：
           · `id = t.edgeTag ? \`${t.edgeTag}-${hr()}\` : hr()`  → 无 tag 时就是随机 id ✓
           · `source / target / sourceHandle / targetHandle` 原样透传 ✓
           · `data = { order: OTe(e, t.target), …(t.purpose?{purpose}:{}), …t.data }`
             —— **`order` = 该 target 现有入边数**（同一 target 的入边排序）✓
           · **不写 `type`** ✓（走 React Flow 默认/画布 defaultEdgeOptions ⇒ 与官方一致；
             MTV 原来写死 `smoothLine ? "smoothstep" : "default"` ✗ 已按用户指示移除该设置）
           另：官方选中后先 `setEdges(nt => nt.filter(h => h.source !== menuId && h.target !== menuId))`
           再 concat 新边 —— 那一步依赖「菜单占位节点」，随点 3 一起落地 ✓ */
      const order = edges.filter((existing) => existing.target === edgeTarget).length;
      const edge: Edge = {
        id: `edge-${generateId()}`,
        // 新节点建在原节点左侧时，原节点的左接口是输入；方向必须反转为新节点右出、原节点左入。
        source: edgeSource,
        sourceHandle: edgeSourceHandle === 'left' ? edgeTargetHandle : edgeSourceHandle,
        target: edgeTarget,
        targetHandle: edgeSourceHandle === 'left' ? edgeSourceHandle : edgeTargetHandle,
        data: { order },
      };
      addNodeWithEdge(newNode, edge);
      setMenu((s) => ({ ...s, visible: false }));
      // 官方选中后 `setEdges(nt => nt.filter(h => h.source !== menuId && h.target !== menuId))`
      // —— 清掉连着菜单节点的那条 command 临时边（MTV 里它只在渲染层，随 pending 一起消失 ✓）
      setPending(null);
      // ⚠️ 官方 `nodes.imageEditor` 该项**只建卡**（编辑器靠双击打开：官方 i18n
      //   `nodes.doubleClickToOpenEditor` =「双击打开编辑器」）→ 这里不自动开任何面板 ✓
    },
    [menu, nodes, edges, reactFlowInstance, addNodeWithEdge, close],
  );

  const sourceNode = nodes.find((n) => n.id === menu.sourceNodeId);
  const menuGroups = menu.mode === 'selection'
    ? getSelectionMenuGroups(
        useAppStore.getState().selectedNodeIds
          .map((id) => nodes.find((n) => n.id === id)?.type ?? '')
          .filter(Boolean),
      )
    : menu.sourceNodeType
      ? getConnectionMenuGroups(menu.sourceNodeType, menu.direction, { blankCard: menu.blankCard })
      : [];

  return {
    menu,
    menuRef,
    sourceNode,
    handleConnectEnd,
    handleSelect,
    closeMenu: close,
    menuGroups,
    /** ★ 官方 `Wke` 的 `+` 按钮 onClick（点 = 与拖到空白同一条路；选中 ≥2 时是「引用所有选中节点生成」） */
    openHandleMenu,
    /** ★ 官方「选区右侧灰底白 +」：在指定屏幕点打开多选生成菜单（`wme`） */
    openSelectionMenuAt,
    /** 官方那套「菜单占位节点 + command 临时边」——Canvas 追加进 nodes/edges 即可 ✓ */
    pending,
  };
}
