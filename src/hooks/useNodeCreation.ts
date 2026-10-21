/**
 * useNodeCreation — 节点创建 Hook
 * 封装所有节点创建方法（文本/图片/视频/音频）、文件拖放（浏览器 + Tauri 原生）
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Node as RFNode } from '@xyflow/react';
import { useAppStore, generateId, computeImageNodeDimensions } from '../store/useAppStore';
import { arrayBufferToBase64, copyFileToProjectData, readBinaryFile } from '../services/fileService';
import type { BaseNodeData } from '../types';
import { isExternalDropCaptured } from '../utils/dropCapture';
import {
  NODE_BASE_SIZE,
  nearestAspectRatioForImage,
  nodeBoxForImageSize,
  nodeSizeForAspect,
} from '../utils/nodeBounds';
import { imageNodeDefaultParamsForModelValue } from '../utils/imageNodeDefaults';
import { officialVideoNodeParamsSeed } from '../utils/officialVideoNodeParams';

// ── File type constants ──

const FILE_EXT_IMAGE: readonly string[] = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const FILE_EXT_VIDEO: readonly string[] = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
const FILE_EXT_AUDIO: readonly string[] = ['mp3', 'wav', 'ogg', 'flac', 'aac'];
const FILE_EXT_TEXT: readonly string[] = [
  'txt', 'md', 'json', 'xml', 'csv', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'log', 'py', 'java', 'c', 'cpp', 'h',
  'rs', 'go', 'rb', 'php', 'sh', 'bat', 'ps1', 'sql', 'r', 'swift', 'kt',
];

const MIME_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', avi: 'video/x-msvideo',
  mov: 'video/quicktime', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac',
};

export { FILE_EXT_IMAGE, FILE_EXT_VIDEO, FILE_EXT_AUDIO, FILE_EXT_TEXT };

// ── Model preference helper ──
const MODEL_PREF_KEY = 'canvas-model-prefs';

function loadDefaultModel(nodeType: string): { model: string; provider: string } | null {
  try {
    const raw = localStorage.getItem(MODEL_PREF_KEY);
    if (!raw) return null;
    const prefs: Record<string, string> = JSON.parse(raw);
    // 全景图回退到生图偏好
    const modelValue = prefs[nodeType] || (nodeType === 'ai-panorama' ? prefs['ai-image'] : undefined);
    if (!modelValue) return null;
    // modelValue format: "provider/modelId" → data.model stores the full value, data.provider stores the prefix
    const slashIdx = modelValue.indexOf('/');
    if (slashIdx === -1) return null;
    const provider = modelValue.slice(0, slashIdx);
    if (!provider) return null;
    return { model: modelValue, provider };
  } catch {
    return null;
  }
}

export type FileCategory = 'image' | 'video' | 'audio' | 'text';

export function classifyFile(ext: string): FileCategory | null {
  const e = ext.toLowerCase();
  if (FILE_EXT_IMAGE.includes(e)) return 'image';
  if (FILE_EXT_VIDEO.includes(e)) return 'video';
  if (FILE_EXT_AUDIO.includes(e)) return 'audio';
  if (FILE_EXT_TEXT.includes(e)) return 'text';
  return null;
}

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}


// ── Hook ──

export function useNodeCreation() {
  const rf = useReactFlow();
  const addNode = useAppStore((s) => s.addNode);

  // ── Drag-over visual state (shared by browser HTML5 + Tauri native) ──
  const [isDragOver, setIsDragOver] = useState(false);
  const enterCount = useRef(0);

  // ===========================
  //  Node creation helpers
  // ===========================

  const addTextNode = useCallback(
    (position: { x: number; y: number }, opts?: { label?: string; prompt?: string; width?: number; height?: number }) => {
      const defaultModel = loadDefaultModel('ai-text');
      addNode({
        id: `node-${generateId()}`,
        type: 'ai-text',
        position,
        data: {
          /* 官方文本创建器 `wT`(纯文本) / `Dx`(生成文本) 的 `title` 都是 **"Text"**（逐字）*/
          label: opts?.label ?? 'Text',
          type: 'ai-text' as const,
          prompt: opts?.prompt ?? '',
          status: 'idle' as const,
          /* ★ 官方文本卡默认尺寸 = `Ha`（= `Od` = **250×250**）：官方两个文本创建器
             （`wT` 纯文本 / `Dx` 生成文本，`zoom-slider-3ZcFvYQO.js` @2787783 起）都是
             `height: Ha.height, width: Ha.width`；内容多了**不撑高卡片**（内容区自己滚动）✓ */
          nodeWidth: opts?.width ?? NODE_BASE_SIZE.width,
          nodeHeight: opts?.height ?? NODE_BASE_SIZE.height,
          ...(defaultModel ? { model: defaultModel.model, provider: defaultModel.provider } : {}),
        },
      } as RFNode<BaseNodeData>);
    },
    [addNode],
  );

  const addImageNode = useCallback(
    async (position: { x: number; y: number }, opts?: { label?: string; dataUrl?: string }) => {
      const dataUrl = opts?.dataUrl;
      const isGenerator = !dataUrl;
      const defaultModel = isGenerator ? loadDefaultModel('ai-image') : null;
      /* ★★★★★ **新图卡的默认 比例/尺寸 按模型给** ✓✓（用户 2026：「gpt-image-2.5 改成 自适应 + 1K」✓）
         gpt-image-2.5-flare / sunburst → 「自适应」+ 1K（上游自定原生尺寸 ⇒ 出站 `size:"auto"` ✓）
         其余模型 → 旧默认 16:9 + 2K ✓（理由与实测数据见 `imageNodeDefaultParams` 的注释 ✓）*/
      const imageDefaults = imageNodeDefaultParamsForModelValue(defaultModel?.model);
      /* ★ 官方空图卡尺寸 = `pR(比例)`：`Od = {250,250}`，`ratio>1 ⇒ 高定 250 · 宽 = 250*ratio`。
         新建的图卡数据里带 `aspectRatio`（官方 UI 缺省 16:9：`params.aspectRatio || "16:9"`）
         ⇒ 尺寸必须是 **444×250**（= `pR(16/9)`）；官方 `RNe` 一旦发现节点尺寸与 `Ua(ratio)` 不一致
         就会把节点修正回 `pR(ratio)`，所以写入的尺寸必须与比例自洽 ✗（原来是 333×250 = 4:3 ✗ 自相矛盾）
         ⚠️ 比例改成「自适应」后盒子也要跟着 `pR(它)` 算 ✓（不能还写 16:9 的盒 ✗ 会被官方口径修正 ✓） */
      const generatorBox = nodeSizeForAspect(imageDefaults.aspectRatio);
      const dims = dataUrl
        ? await computeImageNodeDimensions(dataUrl)
        : { nodeWidth: generatorBox.width, nodeHeight: generatorBox.height };
      const nodeId = `node-${generateId()}`;
      addNode({
        id: nodeId,
        type: 'ai-image',
        position,
        data: {
          // 官方卡片左上角的标签文字是 **Image**（英文，首字母大写），不是「生成图像」。
          /* ★★★ **兜底名按官方** ✗✓（EXE 原文：`type.includes("image") → "Image"` ✓）
             原来写 `dataUrl ? '生成图像' : 'Image'` ✗
             → 从画布拖入图片时是「生成图像」✗ 而 ImageNode 只把 '生成图像' 归一化成 'Image'
               （那条归一化是我后来加的补丁 ✗）→ **兜底值本身就该是 'Image'** ✓
             → 用户："卡片标题依旧没解决" ✓（多处来源 ✗ 这是其中一处 ✓）*/
          label: opts?.label ?? 'Image',
          type: 'ai-image' as const,
          role: dataUrl ? ('source' as const) : ('generator' as const),
          status: dataUrl ? ('success' as const) : ('idle' as const),
          ...(dataUrl
            ? { imageUrl: dataUrl }
            : { prompt: '', aspectRatio: imageDefaults.aspectRatio, imageSize: imageDefaults.imageSize }),
          ...dims,
          /* ★ 比例取合法表里最接近的 ✓（卡片 = `pR(它)` ✓ 官方口径 ✓）+ 盒子数据自洽 ✓
             ⚠️ 不写原图真实比例 ✗（会被比例选择器的合法值夹取夹掉 ✗）*/
          ...(dataUrl ? nodeBoxForImageSize(dims.imageWidth, dims.imageHeight) : {}),
          ...(dataUrl ? nearestAspectRatioForImage(dims.imageWidth, dims.imageHeight) : {}),
          ...(defaultModel ? { model: defaultModel.model, provider: defaultModel.provider } : {}),
        },
      } as RFNode<BaseNodeData>);
      /* ★ 返回新建节点 id：供「右键菜单 → 上传」等调用方补写 `filePath/fileName`
         （与 ImageNode 就地上传写同一组字段） */
      return nodeId;
    },
    [addNode],
  );

  const addVideoNode = useCallback(
    (position: { x: number; y: number }, opts?: { label?: string; dataUrl?: string }) => {
      const dataUrl = opts?.dataUrl;
      const isGenerator = !dataUrl;
      const defaultModel = isGenerator ? loadDefaultModel('ai-video') : null;
      const nodeId = `node-${generateId()}`;
      addNode({
        id: nodeId,
        type: 'ai-video',
        position,
        data: {
          label: opts?.label ?? 'Video',
          type: 'ai-video' as const,
          role: dataUrl ? ('source' as const) : ('generator' as const),
          status: dataUrl ? ('success' as const) : ('idle' as const),
          ...(dataUrl ? { videoUrl: dataUrl } : { prompt: '' }),
          nodeWidth: 333,
          nodeHeight: 160,
          ...(defaultModel ? { model: defaultModel.model, provider: defaultModel.provider } : {}),
          /* ★ §93 官方视频节点工厂 `Tr` @743227 的变体 + `params` 种子（与
             `nodePickerActions.buildNodeData` 同一口径；官方 `type:_o.GENERATE` + `params.modelType`）。 */
          videoNodeType: 'generate' as const,
          params: officialVideoNodeParamsSeed(defaultModel?.model, defaultModel?.provider),
        },
      } as RFNode<BaseNodeData>);
      return nodeId;
    },
    [addNode],
  );

  const addAudioNode = useCallback(
    (position: { x: number; y: number }, opts?: { label?: string; dataUrl?: string }) => {
      const dataUrl = opts?.dataUrl;
      const isGenerator = !dataUrl;
      const defaultModel = isGenerator ? loadDefaultModel('ai-audio') : null;
      const nodeId = `node-${generateId()}`;
      addNode({
        id: nodeId,
        type: 'ai-audio',
        position,
        data: {
          label: opts?.label ?? 'Audio',
          type: 'ai-audio' as const,
          role: dataUrl ? ('source' as const) : ('generator' as const),
          status: dataUrl ? ('success' as const) : ('idle' as const),
          ...(dataUrl ? { audioUrl: dataUrl } : { prompt: '' }),
          nodeWidth: 260,
          nodeHeight: 140,
          ...(defaultModel ? { model: defaultModel.model, provider: defaultModel.provider } : {}),
        },
      } as RFNode<BaseNodeData>);
      return nodeId;
    },
    [addNode],
  );

  // ===========================
  //  Browser HTML5 drag-and-drop
  // ===========================

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (useAppStore.getState().workflowPanelOpen || isExternalDropCaptured()) return;
    enterCount.current++;
    if (e.dataTransfer?.types?.length > 0) setIsDragOver(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    enterCount.current--;
    if (enterCount.current <= 0) {
      enterCount.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      enterCount.current = 0;
      if (useAppStore.getState().workflowPanelOpen || isExternalDropCaptured()) return;
      const dt = e.dataTransfer;
      if (!dt || dt.files.length === 0) return;
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      await useAppStore.getState().pasteExternalFromDataTransfer(dt, pos, 20, '已拖入');
    },
    [rf],
  );

  // ===========================
  //  Tauri native drag-and-drop
  // ===========================

  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    let cancelled = false;

    (async () => {
      // Tauri v2 把拖拽拆成 drag-enter/over/drop/leave 四个事件。
      // 用【全局 listen】而非 webview 级 onDragDropEvent：后者收不到同进程 tauri-plugin-drag
      // （资源搜索窗拖拽）投递到本窗口的 drop。全局通道两种来源都能收到。
      const { listen } = await import('@tauri-apps/api/event');

      // Clean up any previous listener before registering a new one
      unlistenRef.current?.();
      unlistenRef.current = null;
      if (cancelled) return;

      type DragPayload =
        | { type: 'enter'; paths: string[]; position: { x: number; y: number } }
        | { type: 'over'; position: { x: number; y: number } }
        | { type: 'drop'; paths: string[]; position: { x: number; y: number } }
        | { type: 'leave' };

      // drop 会同时从 webview 与全局两路到达（外部拖拽），去重
      let lastDropTs = 0;

      const handleDrag = async (payload: DragPayload) => {
        if (cancelled) return;
        if (payload.type === 'drop') {
          if (Date.now() - lastDropTs < 400) return;
          lastDropTs = Date.now();
        }
        // 全屏编辑器（如合成器）独占外部拖放时，画布跳过建节点
        if (useAppStore.getState().workflowPanelOpen || isExternalDropCaptured()) { setIsDragOver(false); return; }

        if (payload.type === 'enter' || payload.type === 'over') {
          setIsDragOver(true);
          return;
        }
        if (payload.type === 'leave') {
          setIsDragOver(false);
          return;
        }

        // payload.type === 'drop'
        const { paths, position } = payload;
        setIsDragOver(false);
        if (!paths?.length) return;

        const scale = window.devicePixelRatio || 1;
        const flowPos = rf.screenToFlowPosition({ x: position.x / scale, y: position.y / scale });
        const store = useAppStore.getState();
        let count = 0;
        const maxItems = 20;

        for (const fp of paths) {
          if (count >= maxItems) break;
          const ext = fp.split('.').pop()?.toLowerCase() || '';
          const fileName = getFileName(fp);
          const cat = classifyFile(ext);
          if (!cat) continue;

          const offX = count * 30;
          const offY = count * 30;

          try {
            if (cat === 'image' || cat === 'video' || cat === 'audio') {
              const projectId = store.currentProjectId;
              if (projectId && projectId !== 'default') {
                // Create node immediately with loading, copy file in background
                if (cat === 'image') {
                  const nodeId = `node-${generateId()}`;
                  store.addNode({
                    id: nodeId,
                    type: 'ai-image',
                    position: { x: flowPos.x + offX, y: flowPos.y + offY },
                    data: { label: fileName, type: 'ai-image', role: 'source', status: 'loading', nodeWidth: 333, nodeHeight: 158 },
                  } as Parameters<typeof store.addNode>[0]);
                  count++;
                  void (async () => {
                    try {
                      const result = await copyFileToProjectData(fp, projectId);
                      if (result && result.assetUrl) {
                        const dims = await computeImageNodeDimensions(result.assetUrl);
                        store.updateNodeDataTransient(nodeId, { label: result.fileName, imageUrl: result.assetUrl, filePath: result.filePath, fileName: result.fileName, status: 'success', ...dims, ...nodeBoxForImageSize(dims.imageWidth, dims.imageHeight), ...nearestAspectRatioForImage(dims.imageWidth, dims.imageHeight) });
                      } else {
                        const content = await readBinaryFile(fp);
                        const base64 = arrayBufferToBase64(content.buffer);
                        const mime = MIME_MAP[ext] || 'application/octet-stream';
                        const dataUrl = `data:${mime};base64,${base64}`;
                        const dims = await computeImageNodeDimensions(dataUrl);
                        store.updateNodeDataTransient(nodeId, { imageUrl: dataUrl, status: 'success', ...dims, ...nodeBoxForImageSize(dims.imageWidth, dims.imageHeight), ...nearestAspectRatioForImage(dims.imageWidth, dims.imageHeight) });
                      }
                    } catch (err) {
                      console.error(`[drop] failed for "${fp}":`, err);
                      store.updateNodeDataTransient(nodeId, { status: 'error', error: err instanceof Error ? err.message : '拷贝失败' });
                    }
                  })();
                } else if (cat === 'video') {
                  const nodeId = `node-${generateId()}`;
                  store.addNode({
                    id: nodeId,
                    type: 'ai-video',
                    position: { x: flowPos.x + offX, y: flowPos.y + offY },
                    data: { label: fileName, type: 'ai-video', role: 'source', status: 'loading', nodeWidth: 333, nodeHeight: 160 },
                  } as Parameters<typeof store.addNode>[0]);
                  count++;
                  void (async () => {
                    try {
                      const result = await copyFileToProjectData(fp, projectId);
                      if (result && result.assetUrl) {
                        store.updateNodeDataTransient(nodeId, { label: result.fileName, videoUrl: result.assetUrl, filePath: result.filePath, fileName: result.fileName, status: 'success' });
                      } else {
                        const content = await readBinaryFile(fp);
                        const base64 = arrayBufferToBase64(content.buffer);
                        const mime = MIME_MAP[ext] || 'application/octet-stream';
                        const dataUrl = `data:${mime};base64,${base64}`;
                        store.updateNodeDataTransient(nodeId, { videoUrl: dataUrl, status: 'success' });
                      }
                    } catch (err) {
                      console.error(`[drop] failed for "${fp}":`, err);
                      store.updateNodeDataTransient(nodeId, { status: 'error', error: err instanceof Error ? err.message : '拷贝失败' });
                    }
                  })();
                } else {
                  const nodeId = `node-${generateId()}`;
                  store.addNode({
                    id: nodeId,
                    type: 'ai-audio',
                    position: { x: flowPos.x + offX, y: flowPos.y + offY },
                    data: { label: fileName, type: 'ai-audio', role: 'source', status: 'loading', nodeWidth: 260, nodeHeight: 140 },
                  } as Parameters<typeof store.addNode>[0]);
                  count++;
                  void (async () => {
                    try {
                      const result = await copyFileToProjectData(fp, projectId);
                      if (result && result.assetUrl) {
                        store.updateNodeDataTransient(nodeId, { label: result.fileName, audioUrl: result.assetUrl, filePath: result.filePath, fileName: result.fileName, status: 'success' });
                      } else {
                        const content = await readBinaryFile(fp);
                        const base64 = arrayBufferToBase64(content.buffer);
                        const mime = MIME_MAP[ext] || 'application/octet-stream';
                        const dataUrl = `data:${mime};base64,${base64}`;
                        store.updateNodeDataTransient(nodeId, { audioUrl: dataUrl, status: 'success' });
                      }
                    } catch (err) {
                      console.error(`[drop] failed for "${fp}":`, err);
                      store.updateNodeDataTransient(nodeId, { status: 'error', error: err instanceof Error ? err.message : '拷贝失败' });
                    }
                  })();
                }
                continue;
              }

              // Fallback: read into memory (browser mode or copy failed)
              const content = await readBinaryFile(fp);
              const base64 = arrayBufferToBase64(content.buffer);
              const mime = MIME_MAP[ext] || 'application/octet-stream';
              const dataUrl = `data:${mime};base64,${base64}`;

              if (cat === 'image') {
                const dims = await computeImageNodeDimensions(dataUrl);
                store.addNode({
                  id: `node-${generateId()}`,
                  type: 'ai-image',
                  position: { x: flowPos.x + offX, y: flowPos.y + offY },
                  data: { label: fileName, type: 'ai-image', role: 'source', imageUrl: dataUrl, status: 'success', fileName, ...dims, ...nodeBoxForImageSize(dims.imageWidth, dims.imageHeight), ...nearestAspectRatioForImage(dims.imageWidth, dims.imageHeight) },
                } as Parameters<typeof store.addNode>[0]);
              } else if (cat === 'video') {
                store.addNode({
                  id: `node-${generateId()}`,
                  type: 'ai-video',
                  position: { x: flowPos.x + offX, y: flowPos.y + offY },
                  data: { label: fileName, type: 'ai-video', role: 'source', videoUrl: dataUrl, status: 'success', fileName, nodeWidth: 333, nodeHeight: 160 },
                } as Parameters<typeof store.addNode>[0]);
              } else {
                store.addNode({
                  id: `node-${generateId()}`,
                  type: 'ai-audio',
                  position: { x: flowPos.x + offX, y: flowPos.y + offY },
                  data: { label: fileName, type: 'ai-audio', role: 'source', audioUrl: dataUrl, status: 'success', fileName, nodeWidth: 260, nodeHeight: 140 },
                } as Parameters<typeof store.addNode>[0]);
              }
            } else {
              // Text file
              const content = await readBinaryFile(fp);
              const text = new TextDecoder('utf-8').decode(content);
              if (!text.trim()) continue;
              store.addNode({
                id: `node-${generateId()}`,
                type: 'ai-text',
                position: { x: flowPos.x + offX, y: flowPos.y + offY },
                /* 官方文本卡固定 250×250（不按行数撑高，内容区滚动）*/
                data: { label: fileName, type: 'ai-text', role: 'source', output: text, status: 'success', fileName, nodeWidth: NODE_BASE_SIZE.width, nodeHeight: NODE_BASE_SIZE.height },
              } as Parameters<typeof store.addNode>[0]);
            }
            count++;
          } catch (err) {
            console.error('Tauri drag-drop: failed to read', fp, err);
          }
        }

        if (count > 0) store.showToast(`已拖入 ${count} 个源节点`);
      };

      type RawPaths = { paths: string[]; position: { x: number; y: number } };
      // webview 级：外部拖拽的 enter/over/leave/drop 只发到目标 webview
      const { getCurrentWebview } = await import('@tauri-apps/api/webview');
      const unWebview = await getCurrentWebview().onDragDropEvent((e) => {
        if (e.payload.type !== 'over') console.log('[drag webview]', e.payload.type);
        handleDrag(e.payload as DragPayload);
      });
      const un = [
        unWebview,
        // 全局 drop：补上 tauri-plugin-drag（资源搜索窗）投递、webview 收不到的 drop（外部 drop 也会来一份 → 去重）
        await listen<RawPaths>('tauri://drag-drop', (e) => {
          console.log('[drag global drop]', e.payload.paths);
          handleDrag({ type: 'drop', paths: e.payload.paths, position: e.payload.position });
        }),
      ];
      unlistenRef.current = () => un.forEach((u) => u());
    })();

    return () => {
      cancelled = true;
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, [rf]);

  // ===========================
  //  Double-click → text node
  // ===========================

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('react-flow__pane')) return;
      // 官方实测：双击画布空白处**弹出「添加节点」菜单**（不是直接建节点），且出现在点击位置。
      // 菜单挂在侧栏里（absolute），所以把视口坐标换算成侧栏相对坐标。
      const anchor = document.querySelector('.sidebar-floating')?.getBoundingClientRect();
      useAppStore.getState().openCanvasPickerAt({
        x: Math.round(e.clientX - (anchor?.left ?? 0)),
        y: Math.round(e.clientY - (anchor?.top ?? 0)),
      });
    },
    [],
  );

  return {
    addTextNode,
    addImageNode,
    addVideoNode,
    addAudioNode,
    isDragOver,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    onDoubleClick,
  } as const;
}
