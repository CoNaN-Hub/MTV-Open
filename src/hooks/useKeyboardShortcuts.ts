/**
 * useKeyboardShortcuts 全局键盘快捷键 Hook —— 注册 Ctrl+S 保存、Ctrl+Z 撤销、Ctrl+Shift+Z 重做、Delete 删除、F 自适应等快捷键
 * Tauri 环境优先使用 tauri-plugin-global-shortcut 原生拦截，Web 环境退化为 document keydown 捕获
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import * as fileService from '../services/fileService';
import { openAssetSearchWindow } from '../utils/assetSearchWindow';
import { playNodeExit } from '../utils/nodeAnimations';
import { hasActiveTextSelection, isEditableTarget } from '../utils/textSelection';
import { cancelNodePolling } from '../services/pollManager';
import { getCanvasPointerPosition, isCanvasPointerOverCanvas } from '../services/canvasPointerService';
import { isInputBarSuppressedNode } from '../utils/officialInputBar';
import { imageNodeDefaultParamsForModelValue } from '../utils/imageNodeDefaults';
import type { Node as RFNode } from '@xyflow/react';
import type { BaseNodeData, NodeType } from '../types';
import { SHOTLIST_DEFAULT_COLUMNS, createShotRow } from '../types';
import { generateId } from '../store/store.utils';
import { invoke } from '@tauri-apps/api/core';

/**
 * 画布视口（React Flow 的 `translate(tx,ty) scale(z)`）+ 鼠标位置 ⇒ **粘贴落点**。
 *
 * 对齐 **TapNow** `page-DPdEgTS0.js` 的 `k_()`：它的粘贴落点分三级 ——
 *   ① 调用方给了屏幕坐标 ⇒ `screenToFlowPosition(它)`（右键菜单粘贴）
 *   ② **鼠标在画布矩形内** ⇒ `screenToFlowPosition(鼠标)`（"粘在我鼠标这儿"）
 *   ③ 都不满足 ⇒ **视口中心** `{(W/2 - tx)/z, (H/2 - ty)/z}`
 * MTV 这边快捷键是挂 window 的全局监听、拿不到 `useReactFlow()`，所以直接读
 * `.react-flow__viewport` 的 inline transform 反解（等价于 `screenToFlowPosition`）。
 * 视口读不到时退回 `getCanvasPointerPosition()`（至少是个画布坐标）。
 */
function readCanvasViewport(): { x: number; y: number; zoom: number } | null {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  const m = /translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)\s*scale\(\s*([-\d.]+)\s*\)/.exec(
    viewport?.style.transform ?? '',
  );
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]), zoom: Number(m[3]) || 1 };
}

function pasteAnchorAndZoom(): { position: { x: number; y: number }; zoom: number } {
  const viewport = readCanvasViewport();
  if (!viewport) return { position: getCanvasPointerPosition(), zoom: 1 };
  const pane = document.querySelector<HTMLElement>('.react-flow');
  const rect = pane?.getBoundingClientRect();
  const toFlow = (p: { x: number; y: number }) => ({
    x: (p.x - viewport.x) / viewport.zoom,
    y: (p.y - viewport.y) / viewport.zoom,
  });
  // ② 鼠标在画布内 ⇒ 就用鼠标位置（TapNow 的 `y.current`；MTV 这份真相在 canvasPointerService）
  if (isCanvasPointerOverCanvas()) {
    return { position: getCanvasPointerPosition(), zoom: viewport.zoom };
  }
  // ③ 兜底：视口中心（一定看得见）
  return {
    position: rect
      ? { x: (rect.left + rect.width / 2 - viewport.x) / viewport.zoom, y: (rect.top + rect.height / 2 - viewport.y) / viewport.zoom }
      : toFlow({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    zoom: viewport.zoom,
  };
}

interface NodeShortcutDefinition {
  type: NodeType;
  label: string;
}

const GENERATOR_NODE_SHORTCUTS: NodeShortcutDefinition[] = [
  { type: 'ai-text', label: '生成文本' },
  { type: 'ai-image', label: '生成图像' },
  /* §96：`ai-video` 用**官方逐字**「视频」（官方 i18n `nodes.videoNode:"视频"`，
     `index-BDGj8rGN.js` @909177）；MTV 原来写「生成视频」，而下面 `SOURCE_NODE_SHORTCUTS`
     同一个 type 写的是「视频」⇒ 按官方统一。其余行是 MTV 独有节点的文案，未动。 */
  { type: 'ai-video', label: '视频' },
  { type: 'ai-audio', label: '生成音频' },
  { type: 'ai-panorama', label: '生成360全景' },
  { type: 'ai-animation', label: '生成动画' },
  { type: 'ai-director', label: '3D 导演台' },
];

const SOURCE_NODE_SHORTCUTS: NodeShortcutDefinition[] = [
  { type: 'ai-text', label: '文本' },
  { type: 'ai-image', label: '图像' },
  { type: 'ai-video', label: '视频' },
  { type: 'ai-audio', label: '音频' },
  { type: 'ai-markdown', label: 'Markdown' },
  { type: 'ai-shotlist', label: '分镜表' },
];

function loadDefaultModel(nodeType: NodeType): { model: string; provider: string } | null {
  try {
    const raw = localStorage.getItem('canvas-model-prefs');
    if (!raw) return null;
    const prefs: Record<string, string> = JSON.parse(raw);
    const model = prefs[nodeType]
      || (nodeType === 'ai-panorama' || nodeType === 'ai-animation' ? prefs['ai-image'] : undefined);
    if (!model) return null;
    const separatorIndex = model.indexOf('/');
    if (separatorIndex <= 0) return null;
    return { model, provider: model.slice(0, separatorIndex) };
  } catch {
    return null;
  }
}

function createNodeFromNumberShortcut(shortcutIndex: number, isSource: boolean) {
  const definition = (isSource ? SOURCE_NODE_SHORTCUTS : GENERATOR_NODE_SHORTCUTS)[shortcutIndex];
  if (!definition) return false;

  const { type, label } = definition;
  const isImage = type === 'ai-image';
  const isAudio = type === 'ai-audio';
  const isPanorama = type === 'ai-panorama';
  const isAnimation = type === 'ai-animation';
  const isDirector = type === 'ai-director';
  const isShotlist = type === 'ai-shotlist';
  const nodeRole = isSource || isDirector ? 'source' : 'generator';
  const nodeWidth = isShotlist ? 720 : isAnimation || isDirector ? 320 : isAudio ? 260 : isPanorama ? 300 : 280;
  const nodeHeight = isShotlist ? 380 : isDirector ? 240 : isAnimation ? 358 : isAudio ? 140 : isImage ? 158 : isPanorama ? 200 : type === 'ai-markdown' ? 200 : 160;
  const defaultModel = nodeRole === 'source' ? null : loadDefaultModel(type);
  const state = useAppStore.getState();
  const position = getCanvasPointerPosition();

  const node: RFNode<BaseNodeData> = {
    id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    position: { ...position },
    data: {
      label,
      type,
      role: nodeRole,
      prompt: '',
      status: 'idle',
      nodeWidth,
      nodeHeight,
      /* ★ 新图卡默认 比例/尺寸 按模型给 ✓（gpt-image-2.5 → 自适应 + 1K，见 `imageNodeDefaultParams` ✓）*/
      ...(isImage && !isSource ? imageNodeDefaultParamsForModelValue(defaultModel?.model) : {}),
      ...(isPanorama && !isSource ? { previewMode: 'image' } : {}),
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
      ...(defaultModel ?? {}),
    },
  };

  state.addNode(node);
  return true;
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    let active = true; // guard against callbacks firing after unmount / HMR reload

    // ── Web fallback: JS keyboard events ──
    async function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isEditing = isEditableTarget(target);

      // Tab 只在画布表面开关资产抽屉；控件、输入和其他弹层保留原生焦点导航。
      if (e.key === 'Tab' && !e.defaultPrevented && !e.isComposing
        && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !isEditing) {
        const state = useAppStore.getState();
        const isCanvasTarget = target === document.body || target === document.documentElement
          || !!target.closest?.('.react-flow');
        const isControl = !!target.closest?.(
          'button, a, input, textarea, select, [contenteditable="true"], [role="button"], [role="tab"], [role="combobox"], [role="slider"], [role="menu"], [role="listbox"], [role="dialog"]',
        );
        const hasBlockingPanel = state.settingsOpen || state.projectLibraryOpen || state.helpOpen
          || state.characterLibraryOpen || state.characterActionLibraryOpen || state.historyPanelOpen
          || state.workflowPanelOpen || state.chatOpen || state.activeNodeId !== null
          || (state.railPickerOpen || state.canvasPickerPosition !== null) || state.nodeMenuVisible || state.avatarMenuOpen
          || !!state.reversePromptRequest || !!state.presetRunRequest
          || (state.assetsPanelOpen && state.assetsPanelMode !== 'drawer')
          || !!document.querySelector('[aria-modal="true"], dialog[open]');
        if (isCanvasTarget && !isControl && !hasBlockingPanel && document.querySelector('.react-flow')) {
          e.preventDefault();
          e.stopPropagation();
          if (!e.repeat) state.setAssetsPanelOpen(!state.assetsPanelOpen, 'drawer');
          return;
        }
      }

      // Ctrl+S / Alt+S —— always allow save even in inputs
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        await useAppStore.getState().saveCurrentProject();
        return;
      }

      // F12: 开关开发者工具（通过 Rust 命令实现 toggle）
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        try {
          await invoke('toggle_devtools');
        } catch { /* 非 Tauri 环境 */ }
        return;
      }

      // Ctrl+Shift+Space: 打开资源搜索窗口（Win+Space 被系统占用时的可靠备选；不与输入法冲突）
      if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        openAssetSearchWindow();
        return;
      }

      // Space: 选中节点时弹出 AI 对话框（在 isEditing 守卫之前，防止 React Flow 内部拦截 Space 事件）
      if ((e.key === ' ' || e.code === 'Space') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !e.repeat) {
        if (!isEditing) {
          const state = useAppStore.getState();
          const ids = state.selectedNodeIds;
          if (ids.length === 1) {
            const nodeId = ids[0];
            const node = state.nodes.find((n) => n.id === nodeId);
            if (node) {
              const data = node.data as BaseNodeData;
              const canOpen = !(
                node.type === 'group' ||
                data?.type === 'ai-markdown' ||
                /* 官方 `pe = 选中数<=1 && !data.hide_inputbar` ＋ `if (!be) return;`
                   ⇒ 上传/粘贴进来的图像卡（参考卡）不弹底部编辑区（见 utils/officialInputBar.ts）*/
                isInputBarSuppressedNode(node.type, data)
              );
              if (canOpen) {
                e.preventDefault();
                e.stopPropagation();
                const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
                if (el) {
                  const rect = el.getBoundingClientRect();
                  state.openNodeDialog(nodeId, { x: rect.left + rect.width / 2, y: rect.bottom });
                } else {
                  state.openNodeDialog(nodeId);
                }
                return;
              }
            }
          }
        }
      }

      if (isEditing) return;

      // 1–7: 创建内容节点；Alt+1–5: 创建源节点。节点左上角落在当前鼠标位置。
      const digitMatch = /^(?:Digit|Numpad)([1-7])$/.exec(e.code);
      if (digitMatch && !e.repeat && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const handled = createNodeFromNumberShortcut(Number(digitMatch[1]) - 1, e.altKey);
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Ctrl+C: 仅当「文本节点选中模式」内有有效选区时走原生文本复制，否则复制选中节点
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (hasActiveTextSelection()) {
          // 交给浏览器原生复制选中文本；清空节点剪贴板，避免之后 Ctrl+V 误粘节点
          useAppStore.setState({ clipboard: { nodes: [], edges: [], groups: [], projectId: null, pasteIteration: 0 } });
          return;
        }
        if (useAppStore.getState().selectedNodeIds.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          useAppStore.getState().copySelectedNodes();
        }
        return;
      }

      /* Ctrl+D: 复制并立刻粘一份（TapNow 的 `⌘D` ⇒ `T() && (... P==="d" && k())`）。
         守卫与 TapNow 逐条一致：有文字选区就不抢；`isEditing` 上面已经拦过。 */
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !e.shiftKey && !e.altKey && !e.repeat) {
        if (hasActiveTextSelection()) return;
        if (useAppStore.getState().selectedNodeIds.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          useAppStore.getState().copySelectedNodes();
          const { position, zoom } = pasteAnchorAndZoom();
          void useAppStore.getState().pasteNodes(position, zoom);
        }
        return;
      }

      /* ⚠️ Ctrl+V **不在这里处理**（TapNow 同款）：粘贴统一由 `Canvas.tsx` 的**原生 `paste` 事件**
         接管 —— 只有那里能**同步**看到 `clipboardData` 里有没有文件，从而决定是"粘节点"还是
         "粘外部图片"。原来这里 keydown 抢着粘节点，会导致「内部剪贴板非空时从外部复制图片再
         Ctrl+V」粘的是节点而不是图片 ✗（TapNow 的守卫 ② 正是为此）。 */

      // Ctrl+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        useAppStore.getState().undo();
        return;
      }

      // Ctrl+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        useAppStore.getState().redo();
        return;
      }

      // Ctrl+Y: Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        useAppStore.getState().redo();
        return;
      }

      // Delete / Backspace ⇒ batch edge+node deletion in a single commit
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useAppStore.getState();
        const nodeIds = state.selectedNodeIds;
        const selectedEdgeIds = state.edges.filter((ed) => ed.selected).map((ed) => ed.id);

        if (selectedEdgeIds.length === 0 && nodeIds.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        // 立即清空选择 ⇒ 即时反馈，并避免退场动画期间再次按 Delete 重复触发删除
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

        // Delete associated local files —— 跳过仍被存活节点引用的共享文件（复制节点场景）
        const keepPaths = new Set(
          state.nodes.filter((n) => !allIds.includes(n.id))
            .map((n) => (n.data as BaseNodeData).filePath)
            .filter((p): p is string => !!p),
        );
        for (const node of state.nodes.filter((n) => allIds.includes(n.id))) {
          fileService.deleteNodeFile(node.data as BaseNodeData, keepPaths, state.currentProjectId).catch(() => {});
        }

        // Single commit ⇒ undo always goes back to the real pre-delete state
        useAppStore.getState().commitToHistory();
        // 先播放退场动画，结束后再真正移除节点
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
        return;
      }

      // F: Fit view
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        window.dispatchEvent(new CustomEvent('canvas-fit-view'));
        return;
      }

      // M: Toggle MiniMap
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        useAppStore.getState().toggleMinimap();
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        useAppStore.getState().hideNodeMenu();
        useAppStore.getState().setSettingsOpen(false);
      }

      // Ctrl+Shift+M: 切换吉祥物显示（避开 Alt 键，避免被系统菜单栏拦截）
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyM' || e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        e.stopPropagation();
        const store = useAppStore.getState();
        store.updateConfig({ mascotVisible: !store.config.mascotVisible });
        const next = useAppStore.getState().config.mascotVisible;
        useAppStore.getState().showToast(next ? '吉祥物已显示' : '吉祥物已隐藏');
        store.saveConfig();
        return;
      }

      // Ctrl+G / Alt+G: Group / Ungroup
      if ((e.ctrlKey || e.metaKey || e.altKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        e.stopPropagation();
        const st = useAppStore.getState();
        const ids = st.selectedNodeIds;
        if (ids.length === 0) {
          st.showToast('请先选中节点', 'error');
          return;
        }
        // groupSelectedNodes auto-detects: if any selected node is in a group
        // or is a group node, it delegates to ungroupSelectedNodes.
        st.groupSelectedNodes();
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);

    // ── Tauri native: global-shortcut plugin ──
    // Register on focus, unregister on blur —— so shortcuts only work in this app.
    const GLB_SHORTCUTS = [
      { key: 'CommandOrControl+S', action: () => useAppStore.getState().saveCurrentProject() },
      { key: 'Alt+S', action: () => useAppStore.getState().saveCurrentProject() },
      // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y are handled by the JS keydown handler above;
      // registering them as native shortcuts would double-fire undo/redo.
    ];

    // Alt+Space：打开资源搜索窗口 —— 真全局监听，不随窗口失焦而注销（Win+Space 被系统保留无法抢注）。
    let unlistenFocus: (() => void) | undefined;
    let unlistenBlur: (() => void) | undefined;
    let shortcutModule: typeof import('@tauri-apps/plugin-global-shortcut') | null = null;

    (async () => {
      try {
        shortcutModule = await import('@tauri-apps/plugin-global-shortcut');
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();

        // Clean up leftover registrations from HMR
        try { await shortcutModule.unregisterAll(); } catch { /* ignore */ }

        // Alt+Space：注册一次，常驻到组件卸载，不受聚焦状态影响
        try {
          await shortcutModule.register('Alt+Space', (event) => {
            if (event?.state && event.state !== 'Pressed') return;
            openAssetSearchWindow();
          });
        } catch (err) {
          console.warn('[shortcut] 注册失败: Alt+Space', err);
        }

        // Register all shortcuts
        const registerAll = async () => {
          if (!active || !shortcutModule) return;
          // 先清理旧注册，避免重复注册（HMR / 窗口重新聚焦时可能残留）
          // 只清 GLB_SHORTCUTS 自己的 key，不用 unregisterAll —— 那会把 Alt+Space 常驻注册一起清掉
          for (const s of GLB_SHORTCUTS) {
            try { await shortcutModule.unregister(s.key); } catch { /* ignore */ }
          }
          for (const s of GLB_SHORTCUTS) {
            try {
              // 仅在按下时触发（插件会同时回报 Pressed / Released，避免重复执行）
              await shortcutModule.register(s.key, (event) => {
                if (event?.state && event.state !== 'Pressed') return;
                s.action();
              });
            } catch (err) {
              // 重复注册会抛错；Win+Space 等被系统保留的组合也可能注册失败
              console.warn(`[shortcut] 注册失败: ${s.key}`, err);
            }
          }
        };

        // Unregister the focus-scoped shortcuts (Alt+Space stays armed)
        const unregisterAll = async () => {
          if (!shortcutModule) return;
          for (const s of GLB_SHORTCUTS) {
            try { await shortcutModule.unregister(s.key); } catch { /* ignore */ }
          }
        };

        // Register on initial focus state
        const focused = await win.isFocused();
        if (focused) await registerAll();

        // Listen for focus/blur to toggle registration
        unlistenFocus = await win.onFocusChanged(async (ev) => {
          if (!active) return;
          if (ev.payload) {
            await registerAll();
          } else {
            await unregisterAll();
            // Clear stale internal clipboard —— when the user switches away,
            // they may have copied external content. If we don't clear, the
            // next Ctrl+V will still paste the old in-app copied nodes.
            useAppStore.setState({ clipboard: { nodes: [], edges: [], groups: [], projectId: null, pasteIteration: 0 } });
          }
        });

        // Store blob cleanup
        unlistenBlur = unlistenFocus; // onFocusChanged returns single unlisten for both
      } catch {
        // Not in Tauri env —— fall back to JS keyboard events only
      }
    })();

    /* ★ 鼠标位置不用自己记：`canvasPointerService` 里已经有（`setCanvasPointerPosition` +
       `setCanvasPointerOverCanvas`，由 Canvas 的鼠标事件维护）—— 一处真相，粘贴落点和
       "新建节点落在鼠标处"共用同一份。 */

    return () => {
      active = false;
      document.removeEventListener('keydown', handleKeyDown, true);

      // Unlisten focus events
      unlistenFocus?.();
      unlistenBlur?.();

      // Unregister all shortcuts
      import('@tauri-apps/plugin-global-shortcut')
        .then(({ unregisterAll }) => unregisterAll())
        .catch(() => {});
    };
  }, []);
}
