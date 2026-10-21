/**
 * UI slice — panel visibility, menu positioning, dialog state
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './useAppStore';
import type { ReversePromptRequest } from '../types';
import { generateId } from './store.utils';
import { identifyObject } from '../services/ai/identifyObject';
import {
  magicItemMarkIds,
  removeMagicItemToken,
  replaceMagicItemToken,
} from '../utils/magicItem';

/* ── 焦点编辑（官方 `magicSelection`）的 token 助手 ─────────────────────────
   官方把标记写成 `{{magic_item:{...}}}` 直接拼在 prompt 里，并用
   `_markId` 正则做「就地替换 / 整段摘除」。这里逐字同构。

   ⚠️ prompt 的读写只能走 store 的 `nodes` / `updateNodeData`（不是官方那种
      `getNode/updateNodeData` 直连），所以下面这个 helper 收一个 `get`。 */
function magicItemToken(payload: Record<string, unknown>): string {
  return `{{magic_item:${JSON.stringify(payload)}}}`;
}

/**
 * 设置面板的页签 id。
 *
 * ⚠️ 顺序/分组不在这里 —— 版式按官方设置面板（点右上角「0余额」打开的那个）重建，
 * 分组与顺序见 `components/settings/SettingsNavigation.tsx` 的 `SETTINGS_GROUPS`。
 * 新增（对齐官方「通用设置」组与「权益和账单」组里的同名项）：
 *   `canvas` 画布设置 · `permissions` 权限 · `usage` 用量看板 · `about` 关于与更新。
 *   `account` 账户管理 —— 官方账号菜单里「账户管理」那一项的个人资料页（用户点名移植，放在「常规」上方）。
 */
export type SettingsTab =
  | 'account'
  | 'general'
  | 'canvas'
  | 'files'
  | 'api'
  /* 模型映射管理视图（多平台接入 / 官方名称展示）—— 只读，数据来自 services/models */
  | 'modelMapping'
  | 'credits'
  | 'billing'
  | 'shortcuts'
  | 'comfyui'
  | 'storage'
  | 'plugins'
  | 'mcp'
  | 'usage'
  | 'permissions'
  | 'about';

export type ComfyNodeProgressStage = 'connecting' | 'queued' | 'running' | 'finalizing';

/**
 * 焦点编辑（官方 `magicSelection`）的一条「元素标记」。
 *
 * 官方 store `oi`（`vendor-pkg-canvas-futqHM6N.js` @279114 逐字）的 mark 形状：
 *   `{ id, targetNodeId, label:"", box_2d:[0,0,0,0], detections:[], selectedIndex:0, isLoading:true, clickPosition }`
 * 识别成功后官方再用 `setMarkSelectedIndex` 把 `detections[n]` 的
 * `label_name` / `box_2d` 提到顶层。
 *
 * `box_2d` 是**归一化千分坐标** `[ymin, xmin, ymax, xmax]`（官方 Gemini 风格 0–1000）。
 */
export interface FocusEditDetection {
  box_2d: number[];
  label_name: string;
  label_desc?: string;
}

export interface FocusEditMark {
  id: string;
  targetNodeId: string;
  label: string;
  box_2d: number[];
  detections: FocusEditDetection[];
  selectedIndex: number;
  isLoading: boolean;
  /** 官方：点击位置（相对目标图片的归一化坐标），识别服务要用它 */
  clickPosition?: { x: number; y: number };
  /** 官方 `clickPosition` 之外 MTV 额外记账：被点节点的图片地址，供 prompt token 回填 */
  targetUrl?: string;
}

export interface ComfyNodeProgress {
  projectId: string;
  nodeId: string;
  requestId: string;
  clientId: string;
  promptId?: string;
  stage: ComfyNodeProgressStage;
  value?: number;
  max?: number;
  percent?: number;
  executingNodeId?: string;
  updatedAt: number;
}

export interface UISlice {
  settingsOpen: boolean;
  /** 打开设置时要激活的标签页；SettingsPanel 消费后清空 */
  settingsInitialTab: SettingsTab | null;
  /** 打开 API Key 设置后要自动打开编辑的连接 id；ApiKeySettings 消费后清空 */
  pendingApiKeyConnectionId: string | null;
  nodeMenuVisible: boolean;
  nodeMenuPosition: { x: number; y: number };
  /**
   * 左侧竖条「+」的添加节点面板（官方 = DOCKBAR 弹层，贴竖条：240 宽 · r12 · 组标题 12px）。
   * ⚠️ 与画布双击那条**各自独立**（官方是两个不同组件、不同 testid 命名空间、互不影响）✗
   */
  railPickerOpen: boolean;
  /**
   * 画布空白处双击弹出的添加节点菜单（官方 = 画布上的 `command` 节点：288 宽 · r16 · 组标题 14px）。
   * null = 未打开；非 null = **点击位置**。
   */
  canvasPickerPosition: { x: number; y: number } | null;
  /**
   * ★ 官方 command 节点的 `menuMode`（`zoom-slider-3ZcFvYQO.js` `uZe`：`T=e.data?.menuMode??"default"`）：
   *   `'block'`   = 右键「添加节点」（`vb({type:'command',showUploadButton:!1,source:'right_click'})`，menuMode 默认）
   *                 ⇒ 官方 `le = !p && (T==="utility" || source!=="right_click")` 为**假** ⇒ **不渲染「辅助工具」组**
   *   `'utility'` = 右键「添加辅助工具」（`…,menuMode:'utility'`）⇒ **只渲染「辅助工具」组，且含「图片编辑器」**
   *   `'full'`    = MTV 竖条/双击那条（完整目录：添加节点 + 辅助工具(少图片编辑器) + 插件 + 添加资源）
   */
  canvasPickerMode: 'full' | 'block' | 'utility';
  /** 这次面板挂在哪个**持久化 command 节点**上（官方 `vb({type:'command'}, flowPos)`）；
   *  面板关闭时按官方清理语义把这个节点一起删掉（不给工程留垃圾节点） */
  canvasPickerCommandNodeId: string | null;
  /** 官方「保存到素材库 / 移动到 / 创建副本」共用**同一个**文件夹选择对话框（`z2`）：
   *  · `mode: 'save'`  = 节点右键/工具栏「保存到素材库」（标题「保存到素材库」，确认「保存」）
   *  · `mode: 'move'`  = 菜单「移动到」（标题「移动到」，确认「确认」）
   *  · `mode: 'copy'`  = 菜单「创建副本」（标题「创建副本」，确认「确认」）
   *  `nodeIds` = save 时的**节点集合**：官方右键是单节点，官方**多选工具栏**是「整个选择」
   *  一起进 `openForSelection`（`page-DPdEgTS0.js`@char1430453 区域，`k = openForSelection`）；
   *  `filePath` = move/copy 时的素材文件 */
  saveToLibraryMenu: {
    /** 'upload' = 官方「添加 → 上传」第一步的「选择文件夹」对话框（确认后才走系统选文件） */
    mode: 'save' | 'move' | 'copy' | 'upload';
    nodeIds?: string[];
    filePath?: string;
    /** 文件夹级移动/创建副本时的**源文件夹相对路径**（对应官方 disallowedFolderIds 的来源） */
    folderPath?: string;
    position?: { x: number; y: number };
  } | null;
  /**
   * 官方「新建主体」左侧面板（element library editor，`page-DPdEgTS0.js`@char1618455）：
   * 非 null 时打开；值是**打开那一刻已选中的可捕节点**（官方 `openForNodes(se)` 的 `se`）。
   */
  elementEditorNodeIds: string[] | null;
  avatarMenuOpen: boolean;
  projectLibraryOpen: boolean;
  /** 帮助中心弹窗；侧边栏菜单和首次引导都从这里打开 */
  helpOpen: boolean;
  activeNodeId: string | null;
  dialogPosition: { x: number; y: number } | null;
  /**
   * ★ 官方「卡片折叠变体画廊」的展开状态（官方 `Aee` 画廊 store 的 `openGalleryNodeId`，
   * `course-api-base-url-CGXqZmAy.js`@3091790 逐字）：
   * ```js
   * openGallery: n => e(t => ({ openGalleryNodeId: t.openGalleryNodeId === n ? null : n })),
   * closeGallery: () => e({ openGalleryNodeId: null }),
   * isGalleryOpen: n => t().openGalleryNodeId === n
   * ```
   * 读取点 `$x(t)` = `isGalleryOpen(nodeId)`；展开门是 `items.length>0 && (nodeSelected || isGalleryOpen)`。
   * 官方点药丸时同时 `updateNode(t,{ selected: !0 })`（@3096620）⇒ 打开画廊必然选中该节点。
   */
  galleryNodeId: string | null;
  openGallery: (nodeId: string) => void;
  closeGallery: () => void;
  toggleGallery: (nodeId: string) => void;
  /**
   * 官方 `isAnyNodeDragging`（`zoom-slider-3ZcFvYQO.js` @1691826）：
   *   底部编辑框的可见门 `le = pe && visible && **!isAnyNodeDragging** && !inProgress`
   *   ⇒ **拖任意节点期间，底部编辑框要隐藏**（官方 CSS `.node-float-ui-hidden{display:none}`）。
   * MTV 原来没有这个状态（面板在拖拽时仍跟着节点走）⇒ 按官方补上。
   */
  canvasNodeDragging: boolean;
  setCanvasNodeDragging: (dragging: boolean) => void;
  /** 焦点编辑模式 — 官方实测：底行左上第一个按钮进入，顶部蓝色横幅 + 卡片遮罩 + ESC 退出 */
  focusEditNodeId: string | null;
  /**
   * 焦点编辑的元素标记（官方 `oi.marks`，`vendor-pkg-canvas-futqHM6N.js` @279114）。
   * 每条 = 一次「点目标图片某处 → 识别出一个元素」。
   */
  focusEditMarks: FocusEditMark[];
  /** 官方 `oi.isProcessing`：识别进行中（用于「Recognizing...」态） */
  focusEditProcessing: boolean;
  /** 官方 `oi.activeTargetNodeId`：当前正在被识别的目标节点 */
  focusEditActiveTargetNodeId: string | null;
  /** 追加一条 mark（官方 `addMark`） */
  addFocusEditMark: (mark: FocusEditMark) => void;
  /** 补丁式更新一条 mark（官方 `updateMark`） */
  updateFocusEditMark: (id: string, patch: Partial<FocusEditMark>) => void;
  /** 移除一条 mark（官方 `removeMark`） */
  removeFocusEditMark: (id: string) => void;
  /**
   * 切换某个 mark 的选中候选（官方 `oi.setMarkSelectedIndex` 逐字）：
   *   `const i = r.detections[n]; return i ? { ...r, selectedIndex:n, label:i.label_name, box_2d:i.box_2d } : r`
   * ⇒ 选中的候选会把 `label_name` / `box_2d` 提升到 mark 顶层（覆盖层与 token 都用顶层值）。
   */
  setFocusEditMarkSelectedIndex: (id: string, index: number) => void;
  /**
   * 切换候选**并同步 prompt 里的 token**（芯片标签随之更新）。
   * 官方 `gCe` 的下拉就是这一条：`setMarkSelectedIndex` + `o({label, renderText})`。
   */
  selectFocusEditMark: (markId: string, index: number) => void;
  /** 删除一条 mark **并摘掉它的 token**（官方 `y()`：`removeMark` + 正则摘 token）。*/
  deleteFocusEditMark: (markId: string) => void;
  /** 清掉「prompt 里已经不存在的」标记（官方 `dN`：用户删掉芯片后画布框要跟着消失）。*/
  pruneFocusEditMarks: (prompt: string) => void;
  setFocusEditProcessing: (processing: boolean) => void;
  setFocusEditActiveTargetNodeId: (id: string | null) => void;
  /** 清空全部焦点编辑状态（官方 `oi.reset`） */
  resetFocusEdit: () => void;
  /**
   * 官方 `Jg.identifyObject` 的 store 版本：在目标图片的某个归一化点（0–1000）上识别元素。
   * 流程（逐字对齐官方 @1579208–1580410）：
   *   建 mark(isLoading) → 写 `{{magic_item:{isLoading,_markId}}}` 占位 → 调识别
   *   → 成功把 token 就地替换为真实结果；失败 removeMark + 摘掉 token。
   * 放在 store 里是为了让**节点卡片**（ImageNode）能直接触发，而不必把 hook 穿过整棵树。
   */
  identifyFocusEditElement: (targetNodeId: string, targetUrl: string | undefined, point: { x: number; y: number }) => Promise<void>;
  /** 从画布选择参考模式 — 底行左上第二个按钮进入（官方实测横幅：「从画布选择参考」） */
  referencePickNodeId: string | null;
  assetsPanelOpen: boolean;
  /** 同一资产库的展示方式，仅用于当前界面，不持久化。 */
  assetsPanelMode: 'modal' | 'drawer';
  characterLibraryOpen: boolean;
  /** 角色库里的动作库弹层；圆环快捷入口要能越过角色列表直接打开它 */
  characterActionLibraryOpen: boolean;
  historyPanelOpen: boolean;
  minimapVisible: boolean;
  directorDeskRuntimeRequest: {
    instanceId: string;
    openAfterInstall: boolean;
  } | null;
  /** 当前在 prompt 里被 hover 的 @引用节点 id — 用于联动 connected-nodes-float 高亮 */
  hoveredMentionNodeId: string | null;
  /** 从 Toolbar 点击快捷指令后，需要 PromptPanel 自动执行的 preset 操作 */
  pendingPresetAction: {
    nodeId: string;
    filledPrompt: string;
    shouldTrigger: boolean;
    postProcess?: string;
    override?: {
      model?: string;
      provider?: string;
      imageSize?: string;
      aspectRatio?: string;
    };
  } | null;
  /** 反推提示词弹窗的当前请求；null 表示弹窗关闭 */
  reversePromptRequest: ReversePromptRequest | null;
  /** 仅当前运行期使用的 ComfyUI 节点进度；不进入项目节点数据或 IndexedDB。 */
  comfyNodeProgress: Record<string, ComfyNodeProgress>;
  setSettingsOpen: (open: boolean, tab?: SettingsTab) => void;
  setSettingsInitialTab: (tab: SettingsTab | null) => void;
  /** 打开设置的 API Key 页，并可选自动打开某连接的编辑框（填写密钥） */
  openApiKeySettings: (connectionId?: string) => void;
  setPendingApiKeyConnectionId: (id: string | null) => void;
  showNodeMenu: (position: { x: number; y: number }) => void;
  hideNodeMenu: () => void;
  openRailPicker: () => void;
  toggleRailPicker: () => void;
  closeRailPicker: () => void;
  /** 双击画布空白处 / 右键「添加节点·添加辅助工具」：在点击位置弹出 command 面板
   *  （`opts.commandNodeId` = 本次面板挂着的持久化 command 节点；关闭时一并清理） */
  openCanvasPickerAt: (
    position: { x: number; y: number },
    opts?: { mode?: 'full' | 'block' | 'utility'; commandNodeId?: string | null },
  ) => void;
  closeCanvasPicker: () => void;
  /** 官方「保存到素材库」= **先选文件夹**（`library.selectFolder` / `openForSelection`）。
   *  单节点（右键 / 卡工具栏）传 `string`，多选工具栏传整个选择的 `string[]`。 */
  openSaveToLibraryMenu: (nodeIds: string | readonly string[], position: { x: number; y: number }) => void;
  /** 官方「新建主体」：把**可捕节点**交给左侧编辑器面板（`elementLibrary.editor.createTitle`） */
  openElementEditor: (nodeIds: readonly string[]) => void;
  closeElementEditor: () => void;
  /** 官方「移动到 / 创建副本 / 上传」：同一个「选择文件夹」对话框（`library.selectFolder`） */
  openLibraryFolderPicker: (payload: { mode: 'move' | 'copy' | 'upload'; filePath?: string; folderPath?: string }) => void;
  /** 素材库磁盘内容变更计数（画布侧对话框落盘后 +1，面板据此重读） */
  libraryRevision: number;
  bumpLibraryRevision: () => void;
  /** 用户新建的**根文件夹**（官方列表来自后端；MTV 顶层是固定六个官方名 ⇒ 新建的记在这里，面板与选择器共享） */
  libraryExtraRoots: string[];
  /** 磁盘上**实际存在**的根文件夹（排除官方固定分类）—— 重启后仍能看到用户自己的文件夹（官方 = 后端列表） */
  libraryDiskRoots: string[];
  addLibraryRoot: (name: string) => void;
  /** 删除根文件夹后从列表里去掉（官方删除后后端列表立即少一项） */
  removeLibraryRoot: (name: string) => void;
  /** 根文件夹改名后同步（官方 `renameFolder` 后列表重取） */
  renameLibraryRoot: (from: string, to: string) => void;
  setLibraryDiskRoots: (names: string[]) => void;
  closeSaveToLibraryMenu: () => void;
  toggleAvatarMenu: () => void;
  closeAvatarMenu: () => void;
  setProjectLibraryOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  openNodeDialog: (nodeId: string, position?: { x: number; y: number }) => void;
  closeNodeDialog: () => void;
  setFocusEditNodeId: (id: string | null) => void;
  setReferencePickNodeId: (id: string | null) => void;
  setAssetsPanelOpen: (open: boolean, mode?: UISlice['assetsPanelMode']) => void;
  setCharacterLibraryOpen: (open: boolean) => void;
  setCharacterActionLibraryOpen: (open: boolean) => void;
  setHistoryPanelOpen: (open: boolean) => void;
  toggleMinimap: () => void;
  requestDirectorDeskRuntime: (instanceId: string, openAfterInstall?: boolean) => void;
  clearDirectorDeskRuntimeRequest: () => void;
  setHoveredMentionNodeId: (id: string | null) => void;
  setPendingPresetAction: (action: UISlice['pendingPresetAction']) => void;
  setReversePromptRequest: (request: ReversePromptRequest | null) => void;
  beginComfyNodeProgress: (progress: Omit<ComfyNodeProgress, 'updatedAt'>) => void;
  updateComfyNodeProgress: (
    nodeId: string,
    requestId: string,
    patch: Partial<Omit<ComfyNodeProgress, 'projectId' | 'nodeId' | 'requestId' | 'clientId'>>,
  ) => void;
  clearComfyNodeProgress: (nodeId: string, requestId: string) => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set, get) => ({
  settingsOpen: false,
  settingsInitialTab: null,
  pendingApiKeyConnectionId: null,
  nodeMenuVisible: false,
  nodeMenuPosition: { x: 0, y: 0 },
  railPickerOpen: false,
  canvasPickerPosition: null,
  canvasPickerMode: 'full',
  canvasPickerCommandNodeId: null,
  saveToLibraryMenu: null,
  elementEditorNodeIds: null,
  libraryRevision: 0,
  libraryExtraRoots: [],
  libraryDiskRoots: [],
  avatarMenuOpen: false,
  projectLibraryOpen: false,
  helpOpen: false,
  activeNodeId: null,
  dialogPosition: null,
  galleryNodeId: null,
  canvasNodeDragging: false,
  focusEditNodeId: null,
  focusEditMarks: [],
  focusEditProcessing: false,
  focusEditActiveTargetNodeId: null,
  referencePickNodeId: null,
  assetsPanelOpen: false,
  assetsPanelMode: 'modal',
  characterLibraryOpen: false,
  characterActionLibraryOpen: false,
  historyPanelOpen: false,
  /* ★ 小地图**默认不出现**（官方初值 `isOpen:false`，`zoom-slider-3ZcFvYQO.js` @3140583 逐字：
       `qk = Ln(e => ({ isOpen: !1, setOpen: t => e({isOpen:t}), toggle: () => e(t => ({isOpen:!t.isOpen})) }))`
       ⇒ **只有点击左下第一个按钮（`lucide-map`）才出现**，再点关闭；官方**没有 persist**（localStorage 里
         没有任何小地图键）⇒ 刷新/重开画布回到「不出现」✓
     ⚠️ MTV 原来是 `true` ✗ ⇒ 一打开画布就顶着一个小地图，与官方相反；用户 2026「按照官方的」⇒ 改 false ✓ */
  minimapVisible: false,
  directorDeskRuntimeRequest: null,
  hoveredMentionNodeId: null,
  pendingPresetAction: null,
  reversePromptRequest: null,
  comfyNodeProgress: {},

  setSettingsOpen: (open, tab) => set(open
    ? {
        settingsOpen: true,
        settingsInitialTab: tab ?? null,
        assetsPanelOpen: false,
        characterLibraryOpen: false,
        characterActionLibraryOpen: false,
        historyPanelOpen: false,
        dramaAssetsPanelOpen: false,
        chatOpen: false,
      }
    : { settingsOpen: false, settingsInitialTab: null, pendingApiKeyConnectionId: null }),
  setSettingsInitialTab: (tab) => set({ settingsInitialTab: tab }),
  openApiKeySettings: (connectionId) => set({
    settingsOpen: true,
    settingsInitialTab: 'api',
    pendingApiKeyConnectionId: connectionId ?? null,
    assetsPanelOpen: false,
    characterLibraryOpen: false,
    historyPanelOpen: false,
    dramaAssetsPanelOpen: false,
    chatOpen: false,
  }),
  setPendingApiKeyConnectionId: (id) => set({ pendingApiKeyConnectionId: id }),
  showNodeMenu: (position) => set({ nodeMenuVisible: true, nodeMenuPosition: position }),
  hideNodeMenu: () => set({ nodeMenuVisible: false }),
  openRailPicker: () => set({ railPickerOpen: true, avatarMenuOpen: false }),
  toggleRailPicker: () => set((s) => ({ railPickerOpen: !s.railPickerOpen, avatarMenuOpen: false })),
  closeRailPicker: () => set({ railPickerOpen: false }),
  /* 画布双击那条：**独立状态**，不再动竖条那条（官方两个入口互不影响 ✓）
     ★ 右键「添加节点 / 添加辅助工具」复用同一条状态，但带 `mode` 与 command 节点 id */
  openCanvasPickerAt: (position, opts) => set({
    canvasPickerPosition: position,
    canvasPickerMode: opts?.mode ?? 'full',
    canvasPickerCommandNodeId: opts?.commandNodeId ?? null,
    avatarMenuOpen: false,
  }),
  /* ★ 关闭面板 = 官方 command 节点的清理时机：把这次插入的 command 节点一起删掉
     （官方也把 command 节点写进画布，但有专门的 command 节点/边清理逻辑）。
     ⚠️ 不用 `deleteNode`：那条会 `commitToHistory()` + 播退场动画 + 清文件引用 ⇒
        会给一个用户**根本没看见**的 1px command 节点留一条撤销历史 ✗、
        撤销回来还会把这个垃圾节点永久留在工程里 ✗。
        改走 `onNodesChange([{type:'remove'}])` = store 里**不提交历史**的移除路径 ✓ */
  closeCanvasPicker: () => {
    const commandNodeId = get().canvasPickerCommandNodeId;
    if (commandNodeId) get().onNodesChange([{ id: commandNodeId, type: 'remove' }]);
    set({ canvasPickerPosition: null, canvasPickerMode: 'full', canvasPickerCommandNodeId: null });
  },
  /* ★ 素材库「磁盘内容变了」的信号：画布侧的对话框（保存到素材库 / 上传选文件夹 / 移动 / 创建副本）
     落盘后 +1，素材库面板据此重新读取（面板在画布之外，否则会显示旧数据） */
  bumpLibraryRevision: () => set((s) => ({ libraryRevision: s.libraryRevision + 1 })),
  addLibraryRoot: (name) => set((s) => ({
    libraryExtraRoots: s.libraryExtraRoots.includes(name) ? s.libraryExtraRoots : [...s.libraryExtraRoots, name],
    libraryRevision: s.libraryRevision + 1,
  })),
  removeLibraryRoot: (name) => set((s) => ({
    libraryExtraRoots: s.libraryExtraRoots.filter((n) => n !== name),
    libraryDiskRoots: s.libraryDiskRoots.filter((n) => n !== name),
    libraryRevision: s.libraryRevision + 1,
  })),
  renameLibraryRoot: (from, to) => set((s) => ({
    libraryExtraRoots: s.libraryExtraRoots.map((n) => (n === from ? to : n)),
    libraryDiskRoots: s.libraryDiskRoots.map((n) => (n === from ? to : n)),
    libraryRevision: s.libraryRevision + 1,
  })),
  setLibraryDiskRoots: (names) => set((s) => (
    s.libraryDiskRoots.length === names.length && s.libraryDiskRoots.every((n, i) => n === names[i])
      ? {} : { libraryDiskRoots: names }
  )),
  /* 官方「保存到素材库」→ 先选文件夹（`library.selectFolder` / 多选时 `openForSelection`） */
  openSaveToLibraryMenu: (nodeIds, position) => set({
    saveToLibraryMenu: {
      mode: 'save',
      nodeIds: Array.isArray(nodeIds) ? [...nodeIds] : [nodeIds as string],
      position,
    },
  }),
  openLibraryFolderPicker: (payload) => set({ saveToLibraryMenu: { mode: payload.mode, filePath: payload.filePath, folderPath: payload.folderPath } }),
  closeSaveToLibraryMenu: () => set({ saveToLibraryMenu: null }),
  openElementEditor: (nodeIds) => set({ elementEditorNodeIds: [...nodeIds] }),
  closeElementEditor: () => set({ elementEditorNodeIds: null }),
  toggleAvatarMenu: () => set((s) => ({ avatarMenuOpen: !s.avatarMenuOpen, railPickerOpen: false })),
  closeAvatarMenu: () => set({ avatarMenuOpen: false }),
  setProjectLibraryOpen: (open) => set({ projectLibraryOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  openNodeDialog: (nodeId, position) => set({ activeNodeId: nodeId, dialogPosition: position ?? null }),
  /* 官方画廊 store（`course-…`@3091790）：`openGallery` 是**幂等的置位**（不是 toggle），
     切换由 `toggleGallery` 负责（= 官方 `openGallery` 里那句 `t.openGalleryNodeId===n?null:n` 的语义）。 */
  openGallery: (nodeId) => set({ galleryNodeId: nodeId }),
  closeGallery: () => set({ galleryNodeId: null }),
  toggleGallery: (nodeId) => set((s) => ({ galleryNodeId: s.galleryNodeId === nodeId ? null : nodeId })),
  setCanvasNodeDragging: (dragging) => set({ canvasNodeDragging: dragging }),
  // 关闭对话框时一并清掉焦点编辑模式，否则面板被卸载后卡片遮罩会残留
  /* 关闭对话框时一并清掉焦点编辑模式（官方 `oi.reset` 语义），
     否则面板被卸载后卡片遮罩、marks 与「Recognizing…」占位会残留。 */
  closeNodeDialog: () => set({
    activeNodeId: null,
    dialogPosition: null,
    pendingPresetAction: null,
    focusEditNodeId: null,
    focusEditMarks: [],
    focusEditProcessing: false,
    focusEditActiveTargetNodeId: null,
    referencePickNodeId: null,
  }),
  /* ★ 官方 `oi.toggleMode`（`vendor-pkg-canvas-futqHM6N.js` @279114 逐字）：
       `toggleMode:(t,n)=>set(s=>({ isActive:t, sourceNodeId:t?n:null,
                                    marks: t ? [] : s.marks.filter(r=>r.isLoading) }))`
     即 **进入模式清空 marks；退出模式只保留仍在 loading 的 mark**。
     MTV 的 `focusEditNodeId` 就是官方的 `sourceNodeId`（非 null 即 isActive）。 */
  setFocusEditNodeId: (id) => set((state) => ({
    focusEditNodeId: id,
    referencePickNodeId: null,
    focusEditMarks: id ? [] : state.focusEditMarks.filter((mark) => mark.isLoading),
    focusEditProcessing: false,
    focusEditActiveTargetNodeId: null,
  })),
  setReferencePickNodeId: (id) => set({ referencePickNodeId: id, focusEditNodeId: null }),
  addFocusEditMark: (mark) => set((state) => ({ focusEditMarks: [...state.focusEditMarks, mark] })),
  updateFocusEditMark: (id, patch) => set((state) => ({
    focusEditMarks: state.focusEditMarks.map((mark) => (mark.id === id ? { ...mark, ...patch } : mark)),
  })),
  removeFocusEditMark: (id) => set((state) => ({
    focusEditMarks: state.focusEditMarks.filter((mark) => mark.id !== id),
  })),
  /* 官方 `oi.setMarkSelectedIndex` 逐字镜像 */
  setFocusEditMarkSelectedIndex: (id, index) => set((state) => ({
    focusEditMarks: state.focusEditMarks.map((mark) => {
      if (mark.id !== id) return mark;
      const detection = mark.detections[index];
      if (!detection) return mark;
      return { ...mark, selectedIndex: index, label: detection.label_name, box_2d: detection.box_2d };
    }),
  })),
  /**
   * 官方 `gCe` 的候选下拉：`setMarkSelectedIndex` + **把 token 就地覆写成选中那条**。
   * 芯片标签来自 token / mark ⇒ 两处一起变，输入框里的名字立刻跟着换。
   */
  selectFocusEditMark: (markId, index) => {
    const state = get();
    state.setFocusEditMarkSelectedIndex(markId, index);
    const mark = get().focusEditMarks.find((entry) => entry.id === markId);
    const detection = mark?.detections[index];
    const sourceId = get().focusEditNodeId;
    if (!mark || !detection || !sourceId) return;
    const node = get().nodes.find((candidate) => candidate.id === sourceId);
    const prompt = (node?.data as { prompt?: string } | undefined)?.prompt ?? '';
    const next = replaceMagicItemToken(prompt, markId, {
      box_2d: detection.box_2d,
      label_name: detection.label_name,
      label_desc: detection.label_desc,
      _markId: markId,
      nodeId: mark.targetNodeId,
    });
    if (next !== prompt) get().updateNodeData(sourceId, { prompt: next });
  },
  deleteFocusEditMark: (markId) => {
    get().removeFocusEditMark(markId);
    const sourceId = get().focusEditNodeId;
    if (!sourceId) return;
    const node = get().nodes.find((candidate) => candidate.id === sourceId);
    const prompt = (node?.data as { prompt?: string } | undefined)?.prompt ?? '';
    const next = removeMagicItemToken(prompt, markId);
    if (next !== prompt) get().updateNodeData(sourceId, { prompt: next });
  },
  pruneFocusEditMarks: (prompt) => {
    const live = magicItemMarkIds(prompt);
    const state = get();
    const stale = state.focusEditMarks.filter((mark) => !mark.isLoading && !live.has(mark.id));
    if (stale.length === 0) return;
    set((current) => ({
      focusEditMarks: current.focusEditMarks.filter((mark) => mark.isLoading || live.has(mark.id)),
    }));
  },
  setFocusEditProcessing: (processing) => set({ focusEditProcessing: processing }),
  setFocusEditActiveTargetNodeId: (id) => set({ focusEditActiveTargetNodeId: id }),
  /* 官方 `oi.reset`：一次性清空全部（含 isActive / sourceNodeId / marks） */
  resetFocusEdit: () => set({
    focusEditNodeId: null,
    focusEditMarks: [],
    focusEditProcessing: false,
    focusEditActiveTargetNodeId: null,
  }),

  identifyFocusEditElement: async (targetNodeId, targetUrl, point) => {
    const state = get();
    const sourceId = state.focusEditNodeId;
    if (!sourceId || !targetNodeId || sourceId === targetNodeId || !targetUrl) return;

    const patchPrompt = (mutate: (prompt: string) => string) => {
      const node = get().nodes.find((candidate) => candidate.id === sourceId);
      const prompt = (node?.data as { prompt?: string } | undefined)?.prompt ?? '';
      const next = mutate(prompt);
      if (next !== prompt) get().updateNodeData(sourceId, { prompt: next });
    };

    const markId = generateId();
    get().addFocusEditMark({
      id: markId,
      targetNodeId,
      targetUrl,
      label: '',
      box_2d: [0, 0, 0, 0],
      detections: [],
      selectedIndex: 0,
      isLoading: true,
      clickPosition: { x: point.x, y: point.y },
    });
    get().setFocusEditProcessing(true);
    get().setFocusEditActiveTargetNodeId(targetNodeId);

    // 官方 @1579692：立刻写占位（「Recognizing…」），让点击立刻有反馈。
    // ⚠️ 官方**只写这一条 token**，不写任何 `@{nodeId:label}` 引用芯片 ——
    //    芯片由 token 自己渲染（`mention mention-magic`：缩略图 + 识别出的元素名 + 多候选下拉），
    //    MTV 之前额外塞的那条节点引用芯片会让输入框里显示**目标节点的标题/文件名**（用户现场：命名不对）。
    patchPrompt((prompt) => (
      `${prompt && !prompt.endsWith(' ') ? `${prompt} ` : prompt}`
      + magicItemToken({ isLoading: true, label_name: 'Recognizing...', _markId: markId })
      + ' '
    ));

    const result = await identifyObject(targetUrl, {
      // 官方 `clickPosition` 是 0–1 归一化；识别服务（对齐官方 `Zh.touch2edit`）用 0–1000
      x: Math.round(point.x * 1000),
      y: Math.round(point.y * 1000),
    });

    if (!result.success || !result.items?.length) {
      get().removeFocusEditMark(markId);
      // 回滚：把占位 token 摘掉（官方 `g()`：正则摘 token + 收空白）
      patchPrompt((prompt) => removeMagicItemToken(prompt, markId));
      get().setFocusEditProcessing(false);
      get().setFocusEditActiveTargetNodeId(null);
      if (result.error?.message) get().showToast(result.error.message, 'error');
      return;
    }

    const first = result.items[0];
    get().updateFocusEditMark(markId, {
      label: first.label_name,
      box_2d: first.box_2d,
      detections: result.items,
      selectedIndex: 0,
      isLoading: false,
    });
    // 官方 @1580120：占位 token **就地替换**成真实结果（芯片标签随之变成识别出的元素名）。
    patchPrompt((prompt) => replaceMagicItemToken(prompt, markId, {
      box_2d: first.box_2d,
      label_name: first.label_name,
      label_desc: first.label_desc,
      _markId: markId,
      nodeId: targetNodeId,
    }));
    get().setFocusEditProcessing(false);
    get().setFocusEditActiveTargetNodeId(null);
  },
  setAssetsPanelOpen: (open, mode = 'modal') => set(open
    ? {
        settingsOpen: false,
        assetsPanelOpen: true,
        assetsPanelMode: mode,
        characterLibraryOpen: false,
        characterActionLibraryOpen: false,
        historyPanelOpen: false,
        dramaAssetsPanelOpen: false,
        chatOpen: false,
      }
    : { assetsPanelOpen: false, assetsPanelMode: 'modal', dramaAssetsPanelOpen: false }),
  setCharacterLibraryOpen: (open) => set(open
    ? {
        settingsOpen: false,
        assetsPanelOpen: false,
        characterLibraryOpen: true,
        characterActionLibraryOpen: false,
        historyPanelOpen: false,
        dramaAssetsPanelOpen: false,
        chatOpen: false,
      }
    : { characterLibraryOpen: false, characterActionLibraryOpen: false }),
  // 角色库里点开时两个都开着（关掉动作库退回角色库）；圆环直接进来时只开这一个
  setCharacterActionLibraryOpen: (open) => set(open
    ? {
        settingsOpen: false,
        assetsPanelOpen: false,
        historyPanelOpen: false,
        dramaAssetsPanelOpen: false,
        chatOpen: false,
        characterActionLibraryOpen: true,
      }
    : { characterActionLibraryOpen: false }),
  setHistoryPanelOpen: (open) => set(open
    ? {
        settingsOpen: false,
        assetsPanelOpen: false,
        characterLibraryOpen: false,
        characterActionLibraryOpen: false,
        historyPanelOpen: true,
        dramaAssetsPanelOpen: false,
        chatOpen: false,
      }
    : { historyPanelOpen: false }),
  toggleMinimap: () => set((s) => ({ minimapVisible: !s.minimapVisible })),
  requestDirectorDeskRuntime: (instanceId, openAfterInstall = true) => set((state) => {
    const normalized = instanceId.trim();
    if (!normalized || state.directorDeskRuntimeRequest) return {};
    return { directorDeskRuntimeRequest: { instanceId: normalized, openAfterInstall } };
  }),
  clearDirectorDeskRuntimeRequest: () => set({ directorDeskRuntimeRequest: null }),
  setHoveredMentionNodeId: (id) => set({ hoveredMentionNodeId: id }),
  setPendingPresetAction: (action) => set({ pendingPresetAction: action }),
  setReversePromptRequest: (request) => set({ reversePromptRequest: request }),
  beginComfyNodeProgress: (progress) => set((state) => ({
    comfyNodeProgress: {
      ...state.comfyNodeProgress,
      [progress.nodeId]: { ...progress, updatedAt: Date.now() },
    },
  })),
  updateComfyNodeProgress: (nodeId, requestId, patch) => set((state) => {
    const current = state.comfyNodeProgress[nodeId];
    if (!current || current.requestId !== requestId) return {};
    return {
      comfyNodeProgress: {
        ...state.comfyNodeProgress,
        [nodeId]: { ...current, ...patch, updatedAt: Date.now() },
      },
    };
  }),
  clearComfyNodeProgress: (nodeId, requestId) => set((state) => {
    const current = state.comfyNodeProgress[nodeId];
    if (!current || current.requestId !== requestId) return {};
    const next = { ...state.comfyNodeProgress };
    delete next[nodeId];
    return { comfyNodeProgress: next };
  }),
});
