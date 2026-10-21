/**
 * useCanvasContextMenu 画布右键菜单 Hook — 管理画布空白区域右键菜单的显示/隐藏、子菜单展开、节点添加操作
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Node as RFNode } from '@xyflow/react';
import { useAppStore, generateId } from '../store/useAppStore';
import type { BaseNodeData, NodeType } from '../types';
import { SHOTLIST_DEFAULT_COLUMNS, createShotRow } from '../types';
import * as fileService from '../services/fileService';
import { copyFiles as copyFilesToClipboard } from '../services/clipboardService';
import { cancelNodePolling } from '../services/pollManager';
import { playNodeExit } from '../utils/nodeAnimations';
import { startTransferBatch } from '../services/transferReporting';
import { setCanvasPointerPosition } from '../services/canvasPointerService';
/* ★ 官方「应用所有历史」的展开几何 / 「删除其他历史」的数据改写：逐字移植与出处见该文件头。
   ⚠️ 这里**不**用 `canvasSelectionService` 的 `selectNodesInCanvas*`：
   它们最终都落到 `flow.resetSelectedElements() + addSelectedNodes()`，而 MTV 的 `onNodesChange`
   不把 RF 的 select 变更写回 store、store 的 `node.selected` 又会随投影盖回 RF
   ⇒ 用它们选中的分组会在下一次 re-render 被清掉（实测 +0.85s 被清空 ✗）。见下方 `applyNodeHistory`。 */
import { getNodeBounds } from '../utils/nodeBounds';
import { imageNodeDefaultParamsForModelValue } from '../utils/imageNodeDefaults';
import {
  OFFICIAL_HISTORY_FIT_VIEW,
  buildOfficialHistoryExpansion,
  officialDeleteVariantsPatch,
  officialHistoryBatches,
} from '../utils/officialNodeHistory';
import {
  useNodeCreation,
  classifyFile,
  FILE_EXT_IMAGE,
  FILE_EXT_VIDEO,
  FILE_EXT_AUDIO,
} from './useNodeCreation';

/* 官方「上传」picker 的候选类型（与 MTV 拖入画布支持的类型同一组常量 ⇒ 不会两处漂移） */
const UPLOAD_ACCEPT = [...FILE_EXT_IMAGE, ...FILE_EXT_VIDEO, ...FILE_EXT_AUDIO]
  .map((e) => `.${e}`)
  .join(',');
import { createPluginNode, getAvailablePluginNodes } from '../services/plugins/pluginRuntime';
import type { AvailablePluginNode } from '../types/plugin';

// ── Model preference helper ──
const MODEL_PREF_KEY = 'canvas-model-prefs';

function loadDefaultModel(nodeType: string): { model: string; provider: string } | null {
  try {
    const raw = localStorage.getItem(MODEL_PREF_KEY);
    if (!raw) return null;
    const prefs: Record<string, string> = JSON.parse(raw);
    // 全景图回退到生图偏好
    const modelValue = prefs[nodeType]
      || (nodeType === 'ai-panorama' || nodeType === 'ai-animation' ? prefs['ai-image'] : undefined);
    if (!modelValue) return null;
    const slashIdx = modelValue.indexOf('/');
    if (slashIdx === -1) return null;
    const provider = modelValue.slice(0, slashIdx);
    if (!provider) return null;
    return { model: modelValue, provider };
  } catch {
    return null;
  }
}

interface ContextMenuState {
  visible: boolean;
  position: { x: number; y: number };
  flowPosition: { x: number; y: number };
  hoverMenu: 'addNode' | null;
}

export function useCanvasContextMenu() {
  const reactFlowInstance = useReactFlow();
  /* ★ 「上传」建节点复用 MTV 已有的「文件 → 节点」实现（与拖文件进画布同一套尺寸/比例口径） */
  const { addImageNode, addVideoNode, addAudioNode } = useNodeCreation();
  const addNode = useAppStore((s) => s.addNode);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const pasteNodes = useAppStore((s) => s.pasteNodes);
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds);
  const installedPlugins = useAppStore((s) => s.installedPlugins);
  const pluginNodes = getAvailablePluginNodes(installedPlugins);

  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    position: { x: 0, y: 0 },
    flowPosition: { x: 0, y: 0 },
    hoverMenu: null,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMenu = useCallback(() => {
    setMenu({ visible: false, position: { x: 0, y: 0 }, flowPosition: { x: 0, y: 0 }, hoverMenu: null });
  }, []);

  // Close on click outside or Escape
  useEffect(() => {
    if (!menu.visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const ctxEl = menuRef.current;
      const subEl = submenuRef.current;
      if ((ctxEl && ctxEl.contains(target)) || (subEl && subEl.contains(target))) return;
      if (target.closest('.canvas-ctx-menu')) return;
      closeMenu();
    };
    document.addEventListener('keydown', onKey);
    // 捕获阶段监听：传统交互模式下左键平移会被 React Flow(d3-zoom)在 pane 上 stopPropagation，
    // 冒泡阶段的 document 监听收不到事件，必须在捕获阶段先于其触发才能关闭菜单。
    document.addEventListener('mousedown', onClick, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick, true);
    };
  }, [menu.visible, closeMenu]);

  const addNodeAtCtxPos = useCallback(
    (type: NodeType, label: string, role: 'generator' | 'source' = 'generator') => {
      const pos = menu.flowPosition;
      const flowPos = reactFlowInstance.screenToFlowPosition({ x: pos.x, y: pos.y });
      const isImage = type === 'ai-image';
      const isPanorama = type === 'ai-panorama';
      const isAnimation = type === 'ai-animation';
      const isDirector = type === 'ai-director';
      const isShotlist = type === 'ai-shotlist';
      const isSource = role === 'source';
      const newWidth = isShotlist ? 720 : isAnimation || isDirector ? 320 : type === 'ai-audio' ? 260 : isPanorama ? 300 : 280;
      const newHeight = isShotlist ? 380 : isDirector ? 240 : isAnimation ? 358 : type === 'ai-audio' ? 140 : isImage ? 158 : isPanorama ? 200 : type === 'ai-markdown' ? 200 : 160;
      const defaultModel = !isSource ? loadDefaultModel(type) : null;
      const newNode: RFNode<BaseNodeData> = {
        id: `node-${generateId()}`,
        type,
        position: { x: flowPos.x - newWidth / 2, y: flowPos.y - newHeight / 2 },
        data: {
          label,
          type,
          role,
          prompt: '',
          status: 'idle',
          nodeWidth: newWidth,
          nodeHeight: newHeight,
          /* ★ 新图卡默认 比例/尺寸 按模型给 ✓（gpt-image-2.5 → 自适应 + 1K ✓ 见 `imageNodeDefaultParams` ✓）*/
          ...(isImage && !isSource ? imageNodeDefaultParamsForModelValue(defaultModel?.model) : {}),
          ...(isAnimation && !isSource ? {
            prompt: '2D俯视角游戏角色，保持角色造型、朝向、比例和光照一致',
            animationAction: 'idle' as const,
            animationFrames: 8 as const,
            animationPreviewMode: 'playing' as const,
            aspectRatio: '1:1',
            imageSize: '2K',
          } : {}),
          ...(isDirector ? {
            directorStatus: 'idle' as const,
            directorCaptureUrls: [] as string[],
          } : {}),
          // 开局给三行，空表让人不知道从哪下手
          ...(isShotlist ? {
            shotlistColumns: SHOTLIST_DEFAULT_COLUMNS,
            shotlistRows: [1, 2, 3].map((no) => createShotRow(`shot-${generateId()}`, no)),
          } : {}),
          ...(defaultModel ? { model: defaultModel.model, provider: defaultModel.provider } : {}),
        },
      };
      addNode(newNode);
      closeMenu();
    },
    [menu.flowPosition, reactFlowInstance, addNode, closeMenu],
  );

  const addPluginNodeAtCtxPos = useCallback((pluginNode: AvailablePluginNode) => {
    const flowPos = reactFlowInstance.screenToFlowPosition(menu.flowPosition);
    addNode(createPluginNode(pluginNode, flowPos));
    closeMenu();
  }, [menu.flowPosition, reactFlowInstance, addNode, closeMenu]);

  const handleUndo = useCallback(() => { undo(); closeMenu(); }, [undo, closeMenu]);
  const handleRedo = useCallback(() => { redo(); closeMenu(); }, [redo, closeMenu]);

  const handlePaste = useCallback(() => {
    const pos = menu.flowPosition;
    const flowPos = reactFlowInstance.screenToFlowPosition({ x: pos.x, y: pos.y });
    const { clipboard } = useAppStore.getState();
    if (clipboard.nodes.length > 0) {
      /* 带上 zoom：粘贴阶梯是「40 屏幕 px × 第几次」，要按 zoom 换算成流坐标（同 TapNow） */
      pasteNodes(flowPos, reactFlowInstance.getZoom());
    } else {
      useAppStore.getState().pasteExternalContent(flowPos);
    }
    closeMenu();
  }, [menu.flowPosition, reactFlowInstance, pasteNodes, closeMenu]);

  const handleCreateFolder = useCallback(() => {
    const pos = menu.flowPosition;
    useAppStore.getState().createEmptyGroup(
      reactFlowInstance.screenToFlowPosition({ x: pos.x, y: pos.y }),
    );
    closeMenu();
  }, [menu.flowPosition, reactFlowInstance, closeMenu]);

  const showSubmenu = useCallback((m: ContextMenuState['hoverMenu']) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setMenu((s) => ({ ...s, hoverMenu: m }));
  }, []);

  const hideSubmenu = useCallback((backTo: ContextMenuState['hoverMenu']) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setMenu((s) => ({ ...s, hoverMenu: backTo }));
    }, 250);
  }, []);

  /* ★★ 官方「添加节点 / 添加辅助工具」= **在点击处插入一个持久化的 command 节点**，
        该节点的内容就是那个 HANDLE_MENU 面板（官方 `uZe`）。
        官方源码（`page-DPdEgTS0.js` @1362622 逐字）：
          L（添加节点）：`const F=c({x:g.x,y:g.y}), ie=vb({type:"command",showUploadButton:!1,source:"right_click"},F); d([ie]), D()`
          P（添加辅助工具）：…同上… `vb({type:"command",showUploadButton:!1,source:"right_click",menuMode:"utility"},F)`
        `c` = `screenToFlowPosition`、`vb` = 命令节点工厂（`zoom-slider-3ZcFvYQO.js` @1205253 `Lke`：
        `position:t` ⇒ **左上角就是点击的 flow 坐标**，`draggable:!1`、`zIndex:1e3`、`data:{showUploadButton:!0,...e}`）。
        面板本体沿用 MTV 已有的 `NodePickerPanel variant="canvas"`（官方同一个 command 节点组件，
        `store.ui.ts` 里也记着「官方 = 画布上的 command 节点：288 宽 · r16 · 组标题 14px」），
        分组由 `canvasPickerMode` 按官方 `le/includeImageEditor` 规则开关。 */
  const insertCommandNodeAtCtxPos = useCallback((menuMode: 'default' | 'utility') => {
    const store = useAppStore.getState();
    const nodeId = `command-menu-${generateId()}`;
    const flowPos = reactFlowInstance.screenToFlowPosition({
      x: menu.flowPosition.x,
      y: menu.flowPosition.y,
    });
    /* 官方节点字段逐字：`type:'command'`、`data.showUploadButton=false`、`source:'right_click'`、
       `menuMode`（仅辅助工具那条带）、`draggable:false`、`zIndex:1000` */
    store.addNode({
      id: nodeId,
      type: 'command-menu',
      position: flowPos,
      draggable: false,
      zIndex: 1000,
      data: {
        label: 'Command',
        type: 'command-menu',
        showUploadButton: false,
        source: 'right_click',
        ...(menuMode === 'utility' ? { menuMode: 'utility' } : {}),
      },
    } as never);
    /* ★ 面板里选中条目后，`addNodeFromPicker` 用的是 `getCanvasPointerPosition()`（**flow 坐标**）
       ⇒ 这里把指针位置同步到这次右键的 flow 坐标，保证「新块落点 = 右键点」
       （官方那几个工厂 `Dx/Fp/Op/Fx` 都不接 position 参数，位置由 command 节点自己决定；
        右键不会触发 mousemove，不同步的话 `getCanvasPointerPosition()` 会停在旧值 ✗ 实测新块跑到画面外） */
    setCanvasPointerPosition(flowPos);
    /* ⚠️ `canvasPickerPosition` 是**侧栏相对坐标**（`.node-picker--at` 挂在 `.sidebar-floating` 里、
       `position:absolute`；双击那条也是自己减掉 `sidebar-floating` 的原点 —— 见 `useNodeCreation.onDoubleClick`）
       ⇒ 右键屏幕坐标必须做同样换算，否则面板会被父级偏移吃掉（实测偏了 15,518）✗ */
    const anchor = document.querySelector('.sidebar-floating')?.getBoundingClientRect();
    store.openCanvasPickerAt(
      {
        x: Math.round(menu.position.x - (anchor?.left ?? 0)),
        y: Math.round(menu.position.y - (anchor?.top ?? 0)),
      },
      { mode: menuMode === 'utility' ? 'utility' : 'block', commandNodeId: nodeId },
    );
    closeMenu();
  }, [menu.position.x, menu.position.y, menu.flowPosition.x, menu.flowPosition.y, reactFlowInstance, closeMenu]);

  const handleOpenProjectDir = useCallback(async () => {
    try {
      const { currentProjectId } = useAppStore.getState();
      if (!currentProjectId) return;
      const dir = await fileService.ensureProjectDataDir(currentProjectId);
      if (!dir) return;
      await fileService.openDirectoryInFileManager(dir);
    } catch (err) {
      console.warn('无法打开项目文件夹:', err);
    } finally {
      closeMenu();
    }
  }, [closeMenu]);

  const handleDelete = useCallback(() => {
    const state = useAppStore.getState();
    const nodeIds = state.selectedNodeIds;
    const selectedEdgeIds = state.edges.filter((ed) => ed.selected).map((ed) => ed.id);

    if (selectedEdgeIds.length === 0 && nodeIds.length === 0) return;

    // 立即清空选择 → 即时反馈
    useAppStore.setState({ selectedNodeIds: [] });

    // Expand to include descendants of any selected group nodes
    const expandedIds = new Set(nodeIds);
    const q = [...nodeIds];
    while (q.length > 0) {
      const pid = q.shift()!;
      state.nodes.filter((n) => n.parentId === pid).forEach((c) => {
        expandedIds.add(c.id);
        q.push(c.id);
      });
    }
    const allIds = Array.from(expandedIds);

    // Cancel any active polling for all deleted nodes
    for (const id of allIds) {
      cancelNodePolling(id);
    }

    // Delete associated local files
    const keepPaths = new Set(
      state.nodes.filter((n) => !allIds.includes(n.id))
        .map((n) => (n.data as BaseNodeData).filePath)
        .filter((p): p is string => !!p),
    );
    for (const node of state.nodes.filter((n) => allIds.includes(n.id))) {
      fileService.deleteNodeFile(node.data as BaseNodeData, keepPaths, state.currentProjectId).catch(() => {});
    }

    useAppStore.getState().commitToHistory();
    playNodeExit(allIds).then(() => {
      useAppStore.setState((s) => ({
        nodes: s.nodes.filter((n) => !expandedIds.has(n.id)),
        edges: s.edges.filter(
          (ed) => !expandedIds.has(ed.source) && !expandedIds.has(ed.target) && !selectedEdgeIds.includes(ed.id)
        ),
        groups: s.groups
          .filter((g) => !expandedIds.has(g.id))
          .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((nid) => !expandedIds.has(nid)) })),
        selectedNodeIds: [],
      }));
    });

    closeMenu();
  }, [closeMenu]);

  // ── 复制选中节点到内部剪贴板 ──
  const handleCopyNodes = useCallback(() => {
    const state = useAppStore.getState();
    if (state.selectedNodeIds.length === 0) return;
    state.copySelectedNodes();
    useAppStore.getState().showToast(`已复制 ${state.selectedNodeIds.length} 个节点`);
    closeMenu();
  }, [closeMenu]);

  // ── 复制选中节点的媒体文件到系统剪贴板（CF_HDROP 多文件）──
  // 收集所有选中节点中带本地文件路径的媒体文件，一次性写入剪贴板。
  const handleCopyFiles = useCallback(async () => {
    const state = useAppStore.getState();
    const toast = state.showToast.bind(state);
    const filePaths = state.nodes
      .filter((n) => state.selectedNodeIds.includes(n.id))
      .map((n) => (n.data as BaseNodeData).filePath)
      .filter((p): p is string => !!p);
    if (filePaths.length === 0) {
      toast('选中节点没有可复制的本地文件', 'error');
      closeMenu();
      return;
    }
    const ok = await copyFilesToClipboard(filePaths);
    toast(ok ? `已复制 ${filePaths.length} 个文件到剪贴板` : '复制失败', ok ? undefined : 'error');
    closeMenu();
  }, [closeMenu]);

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (!target.classList.contains('react-flow__pane')) return;
    setMenu({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      flowPosition: { x: e.clientX, y: e.clientY },
      hoverMenu: null,
    });
  }, []);

  /* ★ 官方空白菜单第一项「上传」（`HANDLE_MENU.UPLOAD_ITEM`，文案 `dock.upload`）：
       官方契约 = `N({ position: () => ({ ...c(g), zoom: f() }), source: 'right_click' })`
       —— `c` = `screenToFlowPosition`、`g` = 右键屏幕点、`f` = 当前 zoom。
       ★ 落点口径（实读官方源码 `zoom-slider-3ZcFvYQO.js` @1205253 的命令节点工厂 `Lke`）：
         `position: t` —— **传进来的 flow 坐标就是节点位置（左上角），不做半宽半高居中** ✗
         （我上一版按「以点击点为中心」减了 `w/2,h/2` ✗ 与官方不符）
       节点形状**复用 MTV 已有的「文件 → 节点」实现**（`useNodeCreation`：图片按真实比例定尺寸 +
       最接近的合法比例；视频 333×160；音频 260×140）—— 与「拖文件进画布」完全同一套口径，
       不再自创尺寸 ✗。字段补写 `filePath/fileName` 与 `ImageNode` 就地上传一致。 */
  const uploadNodeAtCtxPos = useCallback(async () => {
    const store = useAppStore.getState();
    startTransferBatch(`upload:${Date.now().toString(36)}`);
    const result = await fileService.uploadSourceFileToProject(UPLOAD_ACCEPT, store.currentProjectId);
    if (!result) return;
    const ext = String(result.fileName ?? result.filePath ?? '').split('.').pop()?.toLowerCase() ?? '';
    const kind = classifyFile(ext);
    if (!kind) return;
    const pos = menu.flowPosition;
    const flowPos = reactFlowInstance.screenToFlowPosition({ x: pos.x, y: pos.y });
    const createdId = kind === 'image'
      ? await addImageNode(flowPos, { dataUrl: result.dataUrl })
      : kind === 'video'
        ? addVideoNode(flowPos, { dataUrl: result.dataUrl })
        : kind === 'audio'
          ? addAudioNode(flowPos, { dataUrl: result.dataUrl })
          : null;
    if (!createdId) return;
    if (result.filePath || result.fileName) {
      store.updateNodeData(createdId, {
        ...(result.filePath ? { filePath: result.filePath } : {}),
        ...(result.fileName ? { fileName: result.fileName } : {}),
      });
    }
  }, [menu.flowPosition, reactFlowInstance, addImageNode, addVideoNode, addAudioNode]);
  /* ★ 官方卡片菜单「应用所有历史」(`applyAllHistory`, `hidden: !data.src`)：
       官方 handler（`page-DVqoHdTT.js`@1361795 起，逐字）：
       ```js
       const N=await gj(t,Eme(C),gme), k=vme(C);   // vme 是 "key" 变量，不是函数名
       const T=N.batches.length>0?N.batches:k?[k]:[];
       if(T.length===0){he.error(e("common.noHistoryToApply"),{id:E});return}
       const A=new Map((o?.()??[C]).map(j=>[j.id,j])); A.set(C.id,C);
       const M=ts(C,A), {groupNode:I,childNodes:P}=wme({
         sourceNode:C, historyBatches:T,
         position:{x:M.x+mn(C)+200,y:M.y},
         title:Cme(C.data,e("common.nodeHistoryGroup"))});
       c([I,...P]);
       requestAnimationFrame(()=>{d({nodes:[{id:I.id}],duration:800,padding:.2})});   // @1362195
       he.success(e("common.historyAppliedToCanvas"),{id:E})
       ```
       ⇒ 展开成 **groupNode + N 个子节点**（几何常量逐字见 `utils/officialNodeHistory.ts`），
         分组被选中，随后 `fitView({nodes:[分组], duration:800, padding:.2})`。
      官方 toast 文案（`index-BsHyQ2qj.js` zh `common`）：
        无历史 → `common.noHistoryToApply`「暂无可应用的历史」@9139345
        成功   → `common.historyAppliedToCanvas`「历史已应用到画布」@9139024
        失败   → `common.applyHistoryFailed`「应用历史失败」@9140955
      ⚠️ 官方先弹 radix 的 `he.loading` 占位 toast；MTV 的历史记录已在 store 里、同步完成 ⇒ 不发 loading。 */
  const applyNodeHistory = useCallback((nodeId: string) => {
    const store = useAppStore.getState();
    const sourceNode = store.nodes.find((n) => n.id === nodeId) as RFNode<BaseNodeData> | undefined;
    if (!sourceNode) return;
    /* 官方 `gj(canvasId, nodeRef, gme)` 取服务端 node history；MTV 的等价物 = 该节点的输出历史记录 */
    const records = store.outputHistoryRecords.filter((record) => record.nodeId === nodeId);
    const batches = officialHistoryBatches(sourceNode.data, records);
    if (batches.length === 0) {
      store.showToast('暂无可应用的历史', 'error');
      return;
    }
    try {
      const allNodes = store.nodes as RFNode<BaseNodeData>[];
      /* 官方 `M = ts(C, A)`：源节点的**绝对**坐标（MTV 用 `getNodeBounds` 展开 parentId 偏移） */
      const bounds = getNodeBounds(sourceNode, allNodes);
      const size = { width: bounds.width, height: bounds.height };
      const { groupNode, childNodes } = buildOfficialHistoryExpansion({
        sourceNode,
        sourcePosition: { x: bounds.x, y: bounds.y },
        sourceWidth: size.width,
        childSize: size,
        batches,
        /* 官方 `Cme(data, e("common.nodeHistoryGroup"))`：节点有标题用节点标题，否则「节点历史」 */
        title: (typeof sourceNode.data?.label === 'string' && sourceNode.data.label.trim())
          ? sourceNode.data.label
          : '节点历史',
      });
      /* 官方 `c([I,...P])`：分组节点必须排在子节点**之前**（xyflow 要求），且分组 `selected = true` */
      store.addNodes([groupNode, ...childNodes]);
      /* 官方是在同一批 `c([...])` 里把分组标成 `selected:true`（`page-DVqoHdTT.js`@1362135）；
         MTV 侧的落地方式见下：`node.selected` + `selectedNodeIds` **都在 store 里同步**。 */
      requestAnimationFrame(() => {
        void reactFlowInstance.fitView({
          nodes: [{ id: groupNode.id }],
          duration: OFFICIAL_HISTORY_FIT_VIEW.duration,
          padding: OFFICIAL_HISTORY_FIT_VIEW.padding,
        });
      });
      /* ⚠️ 为什么不用 `selectNodesInCanvas` / `selectNodesInCanvasAfterRender`：
         那两条路径最终都落到 `flow.resetSelectedElements() + addSelectedNodes()`，而 MTV 的
         `onNodesChange` **不把 RF 的 select 变更写回 store**、store 的 `node.selected` 又会随投影
         盖回 RF ⇒ 两条路径都无法让分组稳定保持选中（实测：+0.25s 选上了、+0.85s 被清空 ✗）。
         官方 `c([I,...P])` 本来就是「分组带 `selected:true` 一起入库」，所以这里照官方把
         `selected` 标记与 `selectedNodeIds` 一起写进 store（与 `duplicateNode` 同做法，
         见 `store.nodes.ts`@841-847）。 */
      const live = useAppStore.getState();
      if (live.nodes.some((node) => node.id === groupNode.id)) {
        live.setNodes(live.nodes.map((node) => {
          const shouldSelect = node.id === groupNode.id;
          return node.selected === shouldSelect ? node : { ...node, selected: shouldSelect };
        }));
        live.setSelectedNodeIds([groupNode.id], 'direct');
      }
      store.showToast('历史已应用到画布');
    } catch {
      store.showToast('应用历史失败', 'error');
    }
  }, [reactFlowInstance]);

  /* ★ 官方卡片菜单「删除其他历史」(`deleteVariants`, `hidden: V0(data) <= 1`)：
       官方 handler（`page-DVqoHdTT.js`@1361520 逐字）：
       ```js
       m=C=>{a(C.id,Sme(C.data)); he.success(e("common.variantsHistoryDeleted"))}
       ```
       `Sme`（@1360239）**只**把节点数据改成
       `{src, options:[], historyVariantsHidden:!0, historyVariantCount: src?1:0, …}`：
       主图 `src` 一个字不改、**历史记录一条都不删** —— 这正是官方 tips
       「一键删除当前节点的所有其他折叠变体。您仍可在侧边栏的“历史”面板中找到它们。」的语义。
       ⚠️ MTV 旧实现是「保留主图那条、其余逐条 `deleteHistoryEntry`」⇒ 侧边栏历史面板里也一起消失 ✗。
       toast = `common.variantsHistoryDeleted`「历史已被删除，可在文件管理内查看」@9138794。 */
  const deleteNodeVariants = useCallback((nodeId: string) => {
    const store = useAppStore.getState();
    const node = store.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    /* `updateNodeData` 内部已 `commitToHistory()`，与官方单步 `a(id, Sme(data))` 对齐 */
    store.updateNodeData(nodeId, officialDeleteVariantsPatch(node.data));
    store.showToast('历史已被删除，可在文件管理内查看');
  }, []);
  return {
    menu,
    menuRef,
    openMenu,
    closeMenu,
    addNodeAtCtxPos,
    applyNodeHistory,
    deleteNodeVariants,
    uploadNodeAtCtxPos,
    insertCommandNodeAtCtxPos,
    addPluginNodeAtCtxPos,
    pluginNodes,
    handleUndo,
    handleRedo,
    handlePaste,
    handleCreateFolder,
    handleDelete,
    handleCopyNodes,
    handleCopyFiles,
    handleOpenProjectDir,
    hasSelection: selectedNodeIds.length > 0,
    showSubmenu,
    hideSubmenu,
  };
}
