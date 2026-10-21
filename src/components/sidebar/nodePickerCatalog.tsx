/**
 * nodePickerCatalog — 加节点菜单的**唯一事实来源**（节点条目）。
 *
 * 左侧竖条「+」面板（`openRailPicker`）与画布空白双击菜单（`openCanvasPickerAt`）共用这一份目录
 * —— 官方两个菜单的节点项本来同源（都是 textNode/imageNode/videoNode/audioNode/worldNode ✓）。
 *
 * ⚠️ 但两个入口是**两套独立外壳**（240/r12/组标题 12px vs 288/r16/组标题 14px，状态互不影响），
 *    见 `Sidebar.tsx` 里那两处渲染 —— 不要再写成「同一个面板所以永远一致」✗。
 * ⚠️ 不要再在组件里另写一份节点列表 —— 那正是本次要消除的问题。
 */
import type { JSX } from 'react';
import type { NodeType } from '../../types';
import { OfficialIcon } from './OfficialIcon';

/** 菜单里的一条节点条目 */
export interface PickerEntry {
  /** 节点类型；null = 官方有、MTV 暂无 → 先放着，点击不做任何事 */
  type: NodeType | null;
  /** 中文原文（经 `t()` 翻译） */
  label: string;
  /** 副标题（经 `t()` 翻译）；hover 时显示 */
  sub?: string;
  /** 官网图标名（`OfficialIcon`）；缺省时回退 `NODE_TYPE_CONFIG[type].icon` */
  icon: JSX.Element;
  /** 行尾徽章 */
  badge?: string;
  beta?: boolean;
}

/**
 * 「添加节点」组 —— 官方双击菜单 / 「+」面板的生成类节点，顺序与官方一致。
 * ⚠️ 这一组保持 1:1 对齐官方（PGENTS: 文本/图片/视频/音频/3D），
 *    MTV 独有节点类型不塞进这一组，避免破坏官方面板的条目集。
 * ★ 唯一例外（用户 2026 点名）：「对比」**插在「图片」正下方** ——
 *    用户给的两张图正好是这条目录的两个入口（竖条「+」面板 / 画布双击菜单），
 *    ⇒ 加在共用目录里，两处同时生效 ✓（不要再挪位置、也不要只改其中一个外壳 ✗）
 */
export const generationItems: readonly PickerEntry[] = [
  {
    type: 'ai-text',
    // 官方双击菜单文案（实测）：标题「文本」+ 副标题「脚本、广告词、品牌文案」
    label: '文本',
    sub: '脚本、广告词、品牌文案',
    icon: <OfficialIcon name="pick-text" size={17} />,
  },
  {
    type: 'ai-image',
    label: '图片',
    sub: '宣传图、海报、封面',
    icon: <OfficialIcon name="pick-image" size={17} />,
  },
  {
    /* ★★ 用户 2026：「在图1的图片下方加上 对比，图2的也是图片下方加上」
       ⇒ 位置 = `ai-image` 的**正下方**（视频之前）。
       节点本身 = 画布上的「对比」卡（`CompareNode`）：把两张图片节点连进来即出对比效果。
       ★ 用户 2026：「添加节点菜单 图标也改成现在的 旋转90°后的」
         ⇒ 图标与卡片标题行/空卡占位**同一个资产**（`compare-placeholder`，已烘进 rotate(90)），
           保证菜单里、标题行、空卡三处是同一支图标 ✓
           （原来用的是官方 picker 里那把 `pick-compare`，与卡片不一致 ✗） */
    type: 'compare',
    label: '对比',
    sub: '并排对比两张图片的差异',
    icon: <OfficialIcon name="compare-placeholder" size={17} />,
  },
  {
    /* ★ 用户 2026：「是我要的，保留并补全入口」
       ⇒ 「样机」= MTV 新增节点（与上面的「对比」同性质：官方「添加节点」面板里**没有**这一行）。
       位置 = 「对比」正下方、「视频」上方。
       图标 = 用户上传的 `assets/official-icons/mockup.svg`（原样落库，**不是**官方 picker 资产）。 */
    type: 'mockup',
    label: '样机',
    sub: '将图片呈现在可旋转的设备样机中',
    icon: <OfficialIcon name="mockup" size={17} />,
  },
  {
    type: 'ai-video',
    label: '视频',
    sub: '宣传视频、动画、电影',
    icon: <OfficialIcon name="pick-video" size={17} />,
  },
  {
    type: 'ai-audio',
    label: '音频',
    sub: '音乐、配音、音效',
    icon: <OfficialIcon name="pick-audio" size={17} />,
  },
  {
    /* ★ 用户 2026 明确：「3D **不**映射到导演台；**3D 片场**才是去导演台」✓
       ⇒ 官方这条 `nodes.worldNode`「3D」在 MTV **没有对应节点类型** ⇒ `type: null`（只照抄外观/文案）✗
         （此前错误地把它接成了 `ai-director` ✗ 已改）*/
    type: null,
    // 官方这一条叫「3D」·「生成 3D 场景与对象」
    label: '3D',
    sub: '生成 3D 场景与对象',
    icon: <OfficialIcon name="pick-3d" size={17} />,
  },
];

/**
 * 「辅助工具」分组 —— **照官方「添加节点」面板的该组逐字替换** ✓（用户指示「换」）
 *
 * 官方实测（统一视窗 2174×1263，真实鼠标点开 + 面板后量）：
 *   组标题「辅助工具」12px/500 rgb(122,122,122)
 *   时间轴     / 时间轴串联多段素材     —— 带 **Beta** 徽章（33×18 · fs10 · w500 · rgb(240,240,240)）
 *   3D 片场    / 布置场景、角色与镜头调度
 *   图片编辑器 / 编辑和处理图片
 *
 * ⚠️ 其中「剪辑时间线 / 图片编辑器」MTV **没有**对应节点类型 → `type: null`（只照抄外观与文案，点击不做任何事）✓
 * ★ 用户 2026 明确：「**3D 不映射到导演台；3D 片场才是去导演台**」
 *   ⇒ 「3D 片场」接到 `ai-director`（导演台）✓；上面的「生成」组里官方那条「3D」改为 `null` ✓
 * ⚠️ 原先放在这组的「全景图 / 逐帧动画」按「换」的指示**已移出** ✗
 *    （若要保留，请告知放哪，我再挂回去 ✓）
 */
export const toolItems: readonly PickerEntry[] = [
  {
    type: null, // MTV 无「时间轴」节点类型 → 先放着
    label: '剪辑时间线',
    sub: '时间轴串联多段素材',
    beta: true,
    icon: <OfficialIcon name="pick-timeline" size={17} />,
  },
  {
    /* ★ 用户 2026 明确：「3D 不映射到导演台；**3D 片场**才是去导演台」✓
       ⇒ 官方这条「3D 片场」（布置场景、角色与镜头调度）在 MTV 接到 **`ai-director`（导演台）** ✓
         （此前是 `type: null`「先放着」✗ 已改）*/
    type: 'ai-director',
    label: '3D 片场',
    sub: '布置场景、角色与镜头调度',
    icon: <OfficialIcon name="pick-studio" size={17} />,
  },
  {
    type: null, // MTV 无「图片编辑器」节点类型 → 先放着
    label: '图片编辑器',
    sub: '编辑和处理图片',
    icon: <OfficialIcon name="pick-editor" size={17} />,
  },
];

/**
 * 双击画布菜单的「辅助工具」组 —— **比竖条 + 面板少一项「图片编辑器」** ✓
 * （用户：「图片编辑器 是另外一套 左侧竖条+按钮内的 …这里就不该出现」）
 *
 * 官方源码（`zoom-slider-3ZcFvYQO.js` @2908250 起）：
 *   `pe = I(k, { source: e.data?.source, includeImageEditor: T === "utility", threeDStudioDisabled: !w })`
 *   —— 图片编辑器**只在 `menuMode === "utility"`** 时才进这一组；
 *   双击空白那条是 `vb({type:"command", params:{}, source:"double_click"})`（`menuMode` 默认 `default`）
 *   ⇒ 双击菜单的辅助工具组 = **剪辑时间线 + 3D 片场**，**没有图片编辑器** ✓
 *   （另：`le = !p && (T === "utility" || source !== "right_click")` ⇒ 右键「添加节点」那条
 *     **完全不渲染辅助工具组**；右键「添加辅助工具」那条**只渲染这一组、且含图片编辑器**。）
 */
export const canvasToolItems: readonly PickerEntry[] = toolItems.slice(0, 2);

/**
 * 「添加资源」分组 —— 目前只有「上传」。
 * ★ 副标题**保留** ✓ —— 官方 i18n `uploadDesc: "支持图片、视频、音频和 3D 资产"` ✓
 *   官方全量 dump 显示**九行都有副标题**（hover 时显示 ✓），上传那行也有 ✓
 */
export const resourceItems = [
  {
    key: 'upload',
    label: '上传',
    sub: '支持图片、视频、音频和 3D 资产',
    icon: <OfficialIcon name="pick-upload" size={16} />,
  },
] as const;

/** 整份目录（分组顺序即渲染顺序） */
export const nodePickerGroups = [
  { key: 'generation', title: '添加节点', entries: generationItems },
  { key: 'tools', title: '辅助工具', entries: toolItems },
  { key: 'resource', title: '添加资源', entries: resourceItems },
] as const;

